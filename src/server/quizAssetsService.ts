import { sanitizeLiveTestForPublic, isValidFirestoreDocId } from './liveTestService';

export interface QuizAssetsServiceDeps {
  getAdminDb: () => any;
  projectId: string;
  databaseId: string;
  apiKey: string;
  fetchImpl?: typeof fetch;
}

export interface QuizVersionManifest {
  curriculumVersion: number;
  lastUpdated: string;
  bundleVersions: Record<string, number>;
  contentDigest?: string;
}

export interface QuizCurriculumPayload {
  version: number;
  subjects: any[];
  chapters: any[];
  topics: any[];
  banners: any[];
  examCategories: any[];
  generatedAt: string;
}

export interface QuizBundlePayload {
  id: string;
  topicId: string;
  chapterId?: string;
  subjectId?: string;
  questionCount: number;
  updatedAt: string;
  version: number;
  contentHash?: string;
  questions: any[];
}

function parseFirestoreRestValue(val: any): any {
  if (!val || typeof val !== 'object') return val;
  if ('nullValue' in val) return null;
  if ('booleanValue' in val) return Boolean(val.booleanValue);
  if ('integerValue' in val) return Number(val.integerValue);
  if ('doubleValue' in val) return Number(val.doubleValue);
  if ('timestampValue' in val) return val.timestampValue;
  if ('stringValue' in val) return val.stringValue;
  if ('arrayValue' in val) {
    const items = Array.isArray(val.arrayValue?.values) ? val.arrayValue.values : [];
    return items.map((item: any) => parseFirestoreRestValue(item));
  }
  if ('mapValue' in val) {
    return parseFirestoreRestFields(val.mapValue?.fields || {});
  }
  return val;
}

export function parseFirestoreRestFields(fields: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = {};
  if (!fields || typeof fields !== 'object') return result;
  for (const [key, val] of Object.entries(fields)) {
    result[key] = parseFirestoreRestValue(val);
  }
  return result;
}

export function createQuizAssetsService(deps: QuizAssetsServiceDeps) {
  const VERSION_TTL_MS = 60 * 1000; // 60 seconds
  const MAX_VERSIONED_ENTRIES = 6;
  const MAX_BUNDLE_ENTRIES = 250;

  let cachedVersion: { data: QuizVersionManifest; expiresAt: number } | null = null;
  const curriculumCache = new Map<string, QuizCurriculumPayload>();
  const bundleCache = new Map<string, QuizBundlePayload>();
  const pyqPapersCache = new Map<string, { version: number; papers: any[]; generatedAt: string }>();
  const liveTestsCache = new Map<string, { version: number; tests: any[]; generatedAt: string }>();
  const liveTestByIdCache = new Map<string, any>();
  const inFlight = new Map<string, Promise<any>>();

  const doFetch = (): typeof fetch => deps.fetchImpl || fetch;

  function setBounded<K, V>(map: Map<K, V>, key: K, val: V, maxSize: number): void {
    if (map.has(key)) map.delete(key);
    map.set(key, val);
    while (map.size > maxSize) {
      const oldest = map.keys().next().value;
      if (oldest === undefined) break;
      map.delete(oldest);
    }
  }

  function coalesce<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const existing = inFlight.get(key);
    if (existing) return existing as Promise<T>;
    const promise = fn().finally(() => {
      inFlight.delete(key);
    });
    inFlight.set(key, promise);
    return promise;
  }

  async function readDoc(collectionName: string, docId: string): Promise<any | null> {
    const adminDb = deps.getAdminDb();
    if (adminDb) {
      try {
        const snap = await adminDb.collection(collectionName).doc(docId).get();
        if (!snap || !snap.exists) return null;
        return { ...(snap.data() || {}), id: snap.id || docId };
      } catch (err) {
        console.warn(`[QuizAssets] adminDb readDoc(${collectionName}/${docId}) fallback to REST:`, (err as any)?.message || err);
      }
    }

    const url = `https://firestore.googleapis.com/v1/projects/${deps.projectId}/databases/${deps.databaseId}/documents/${encodeURIComponent(collectionName)}/${encodeURIComponent(docId)}?key=${deps.apiKey}`;
    const res = await doFetch()(url);
    if (res.status === 404) return null;
    if (!res.ok) {
      throw new Error(`Firestore REST readDoc(${collectionName}/${docId}) failed: ${res.status}`);
    }
    const json = (await res.json()) as any;
    if (!json || !json.fields) return null;
    return {
      ...parseFirestoreRestFields(json.fields),
      id: docId,
    };
  }

  async function readCollection(collectionName: string): Promise<any[]> {
    const adminDb = deps.getAdminDb();
    if (adminDb) {
      try {
        const snap = await adminDb.collection(collectionName).get();
        if (!snap || !Array.isArray(snap.docs)) return [];
        return snap.docs.map((d: any) => ({
          ...(typeof d.data === 'function' ? d.data() : d.data || {}),
          id: d.id,
        }));
      } catch (err) {
        console.warn(`[QuizAssets] adminDb readCollection(${collectionName}) fallback to REST:`, (err as any)?.message || err);
      }
    }

    const docs: any[] = [];
    let pageToken: string | undefined;
    do {
      const qs = new URLSearchParams({
        key: deps.apiKey,
        pageSize: '1000',
      });
      if (pageToken) qs.set('pageToken', pageToken);
      const url = `https://firestore.googleapis.com/v1/projects/${deps.projectId}/databases/${deps.databaseId}/documents/${encodeURIComponent(collectionName)}?${qs.toString()}`;
      const res = await doFetch()(url);
      if (!res.ok) {
        if (res.status === 404) return docs;
        throw new Error(`Firestore REST readCollection(${collectionName}) failed: ${res.status}`);
      }
      const json = (await res.json()) as any;
      if (Array.isArray(json.documents)) {
        for (const item of json.documents) {
          if (item && item.fields && item.name) {
            const id = String(item.name).split('/').pop() || '';
            docs.push({
              ...parseFirestoreRestFields(item.fields),
              id,
            });
          }
        }
      }
      pageToken = json.nextPageToken;
    } while (pageToken);

    return docs;
  }

  async function getVersionManifest(forceRefresh = false): Promise<QuizVersionManifest> {
    const now = Date.now();
    if (!forceRefresh && cachedVersion && now < cachedVersion.expiresAt) {
      return cachedVersion.data;
    }

    return coalesce('version', async () => {
      if (!forceRefresh && cachedVersion && Date.now() < cachedVersion.expiresAt) {
        return cachedVersion.data;
      }
      let manifest: QuizVersionManifest = {
        curriculumVersion: 1,
        lastUpdated: new Date().toISOString(),
        bundleVersions: {},
      };
      try {
        const raw = await readDoc('metadata', 'app_version');
        if (raw) {
          manifest = {
            curriculumVersion: Number(raw.curriculumVersion) || 1,
            lastUpdated: typeof raw.lastUpdated === 'string' ? raw.lastUpdated : new Date().toISOString(),
            bundleVersions:
              raw.bundleVersions && typeof raw.bundleVersions === 'object' ? raw.bundleVersions : {},
            ...(typeof raw.contentDigest === 'string' ? { contentDigest: raw.contentDigest } : {}),
          };
        }
      } catch (err) {
        console.warn('[QuizAssets] Failed to read metadata/app_version:', (err as any)?.message || err);
        if (cachedVersion) return cachedVersion.data;
      }

      cachedVersion = {
        data: manifest,
        expiresAt: Date.now() + VERSION_TTL_MS,
      };
      return manifest;
    });
  }

  async function getCurriculumAsset(requestedVersion?: string): Promise<QuizCurriculumPayload> {
    const versionKey = requestedVersion && requestedVersion.trim() ? requestedVersion.trim() : 'latest';
    if (versionKey !== 'latest') {
      const hit = curriculumCache.get(versionKey);
      if (hit) return hit;
    }

    return coalesce(`curriculum:${versionKey}`, async () => {
      const manifest = versionKey === 'latest' ? await getVersionManifest() : null;
      const resolvedVersion =
        versionKey === 'latest' ? manifest!.curriculumVersion : Number(versionKey) || 1;
      const cacheKey = String(resolvedVersion);

      const hit = curriculumCache.get(cacheKey);
      if (hit) return hit;

      const [subjects, chapters, topics, bundles, banners, examCategories] = await Promise.all([
        readCollection('subjects').catch(() => []),
        readCollection('chapters').catch(() => []),
        readCollection('topics').catch(() => []),
        readCollection('question_bundles').catch(() => []),
        readCollection('banners').catch(() => []),
        readCollection('exam_categories').catch(() => []),
      ]);

      // Map topicId -> questionCount from question_bundles so Subjects/Chapters/Topics always have accurate counts
      const bundleCountByTopic = new Map<string, number>();
      for (const b of bundles) {
        if (!b || typeof b !== 'object') continue;
        const rawTopicId = String(b.topicId || (typeof b.id === 'string' && b.id.startsWith('topic_') ? b.id.slice(6) : b.id) || '').trim();
        if (!rawTopicId) continue;
        const qLen = Array.isArray(b.questions) ? b.questions.length : 0;
        const qCount = Math.max(qLen, Number(b.questionCount) || 0);
        if (qCount > 0) {
          bundleCountByTopic.set(rawTopicId, Math.max(bundleCountByTopic.get(rawTopicId) || 0, qCount));
        }
      }

      const enrichedTopics = topics.map((t: any) => {
        if (!t || typeof t !== 'object') return t;
        const embeddedLen = Array.isArray(t.questions) ? t.questions.length : 0;
        const bundleCount = bundleCountByTopic.get(t.id) || 0;
        const existingCount = typeof t.questionCount === 'number' ? t.questionCount : 0;
        const resolvedCount = Math.max(embeddedLen, bundleCount, existingCount);
        return resolvedCount > 0 ? { ...t, questionCount: resolvedCount } : t;
      });

      const enrichedChapters = chapters.map((ch: any) => {
        if (!ch || typeof ch !== 'object') return ch;
        const chTopics = Array.isArray(ch.topics)
          ? ch.topics.map((t: any) => {
              if (!t || typeof t !== 'object') return t;
              const embeddedLen = Array.isArray(t.questions) ? t.questions.length : 0;
              const bundleCount = bundleCountByTopic.get(t.id) || 0;
              const existingCount = typeof t.questionCount === 'number' ? t.questionCount : 0;
              const resolvedCount = Math.max(embeddedLen, bundleCount, existingCount);
              return resolvedCount > 0 ? { ...t, questionCount: resolvedCount } : t;
            })
          : ch.topics;
        return { ...ch, topics: chTopics };
      });

      const payload: QuizCurriculumPayload = {
        version: resolvedVersion,
        subjects,
        chapters: enrichedChapters,
        topics: enrichedTopics,
        banners,
        examCategories,
        generatedAt: new Date().toISOString(),
      };

      if (subjects.length > 0 || enrichedChapters.length > 0 || enrichedTopics.length > 0) {
        setBounded(curriculumCache, cacheKey, payload, MAX_VERSIONED_ENTRIES);
      }
      return payload;
    });
  }

  async function getTopicBundleAsset(
    topicId: string,
    requestedVersion?: string
  ): Promise<QuizBundlePayload | null> {
    if (!isValidFirestoreDocId(topicId)) return null;
    const primaryBundleDocId = `topic_${topicId}`;
    const vKey = requestedVersion && requestedVersion.trim() ? requestedVersion.trim() : 'latest';
    const cacheKey = `${topicId}@${vKey}`;

    if (vKey !== 'latest') {
      const hit = bundleCache.get(cacheKey);
      if (hit) return hit;
    }

    return coalesce(`bundle:${cacheKey}`, async () => {
      if (vKey !== 'latest') {
        const hit = bundleCache.get(cacheKey);
        if (hit) return hit;
      }

      let raw = await readDoc('question_bundles', primaryBundleDocId);
      if (!raw && topicId.startsWith('topic_')) {
        raw = await readDoc('question_bundles', topicId);
      }
      if (!raw) return null;

      const resolvedVersion =
        Number(raw.version) || (vKey !== 'latest' ? Number(vKey) || 1 : 1);
      const questions = Array.isArray(raw.questions) ? raw.questions : [];
      const payload: QuizBundlePayload = {
        id: raw.id || primaryBundleDocId,
        topicId: raw.topicId || topicId,
        chapterId: raw.chapterId || '',
        subjectId: raw.subjectId || '',
        questionCount: questions.length,
        updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : new Date().toISOString(),
        version: resolvedVersion,
        ...(typeof raw.contentHash === 'string' ? { contentHash: raw.contentHash } : {}),
        questions,
      };

      setBounded(bundleCache, cacheKey, payload, MAX_BUNDLE_ENTRIES);
      if (vKey === 'latest') {
        setBounded(bundleCache, `${topicId}@${resolvedVersion}`, payload, MAX_BUNDLE_ENTRIES);
      }
      return payload;
    });
  }

  async function getPyqPapersAsset(requestedVersion?: string): Promise<{
    version: number;
    papers: any[];
    generatedAt: string;
  }> {
    const versionKey = requestedVersion && requestedVersion.trim() ? requestedVersion.trim() : 'latest';
    if (versionKey !== 'latest') {
      const hit = pyqPapersCache.get(versionKey);
      if (hit) return hit;
    }

    return coalesce(`pyq:${versionKey}`, async () => {
      const manifest = versionKey === 'latest' ? await getVersionManifest() : null;
      const resolvedVersion =
        versionKey === 'latest' ? manifest!.curriculumVersion : Number(versionKey) || 1;
      const cacheKey = String(resolvedVersion);

      const hit = pyqPapersCache.get(cacheKey);
      if (hit) return hit;

      const allPapers = await readCollection('pyq_papers');
      const publishedPapers = allPapers.filter((p) => p && p.isPublished !== false);
      const payload = {
        version: resolvedVersion,
        papers: publishedPapers,
        generatedAt: new Date().toISOString(),
      };
      setBounded(pyqPapersCache, cacheKey, payload, MAX_VERSIONED_ENTRIES);
      return payload;
    });
  }

  async function getLiveTestsAsset(requestedVersion?: string): Promise<{
    version: number;
    tests: any[];
    generatedAt: string;
  }> {
    const versionKey = requestedVersion && requestedVersion.trim() ? requestedVersion.trim() : 'latest';
    if (versionKey !== 'latest') {
      const hit = liveTestsCache.get(versionKey);
      if (hit) return hit;
    }

    return coalesce(`liveTests:${versionKey}`, async () => {
      const manifest = versionKey === 'latest' ? await getVersionManifest() : null;
      const resolvedVersion =
        versionKey === 'latest' ? manifest!.curriculumVersion : Number(versionKey) || 1;
      const cacheKey = String(resolvedVersion);

      const hit = liveTestsCache.get(cacheKey);
      if (hit) return hit;

      const allTests = await readCollection('liveTests');
      const sanitizedTests = allTests
        .filter((t) => t && t.status !== 'draft')
        .map((t) => sanitizeLiveTestForPublic(t));

      const payload = {
        version: resolvedVersion,
        tests: sanitizedTests,
        generatedAt: new Date().toISOString(),
      };
      setBounded(liveTestsCache, cacheKey, payload, MAX_VERSIONED_ENTRIES);
      return payload;
    });
  }

  async function getPublicLiveTestById(
    testId: string,
    requestedVersion?: string
  ): Promise<{ status: number; test?: any; error?: string }> {
    if (!isValidFirestoreDocId(testId)) {
      return { status: 400, error: 'Invalid live test ID.' };
    }
    const cacheKey = `${testId}@${requestedVersion || 'latest'}`;
    if (requestedVersion) {
      const hit = liveTestByIdCache.get(cacheKey);
      if (hit) return { status: 200, test: hit };
    }

    const doc = await readDoc('liveTests', testId);
    if (!doc) {
      return { status: 404, error: 'Live test not found.' };
    }
    if (doc.status === 'draft') {
      return { status: 404, error: 'Live test not published.' };
    }
    const sanitized = sanitizeLiveTestForPublic(doc);
    setBounded(liveTestByIdCache, cacheKey, sanitized, 100);
    return { status: 200, test: sanitized };
  }

  function invalidateQuizAssetsCache(topicIds?: string[]): void {
    cachedVersion = null;
    curriculumCache.clear();
    pyqPapersCache.clear();
    liveTestsCache.clear();
    liveTestByIdCache.clear();

    if (Array.isArray(topicIds) && topicIds.length > 0) {
      const targets = new Set<string>();
      for (const t of topicIds) {
        targets.add(t);
        if (t.startsWith('topic_')) targets.add(t.slice(6));
      }
      for (const key of Array.from(bundleCache.keys())) {
        const [tId] = key.split('@');
        if (targets.has(tId)) {
          bundleCache.delete(key);
        }
      }
    } else {
      bundleCache.clear();
    }
  }

  return {
    getVersionManifest,
    getCurriculumAsset,
    getTopicBundleAsset,
    getPyqPapersAsset,
    getLiveTestsAsset,
    getPublicLiveTestById,
    invalidateQuizAssetsCache,
  };
}
