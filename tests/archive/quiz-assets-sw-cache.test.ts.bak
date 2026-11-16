import { describe, test, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import http from 'node:http';
import { createServerApp } from '../server';
import {
  STATIC_QUIZ_DATA_CACHE_NAME,
  fetchCurriculumAssetCacheFirst,
  fetchTopicBundleAssetCacheFirst,
  fetchPyqPapersAssetCacheFirst,
  fetchLiveTestsAssetCacheFirst,
  getQuizAssetCacheStats,
  invalidateQuizAssetsClientAndServer,
  __resetQuizAssetClientCacheForTests,
} from '../src/utils/quizAssetSwCache';

function createTrackedFirestore(initialData: Record<string, Record<string, any>> = {}) {
  const store: Record<string, Record<string, any>> = {};
  const readsByCollection: Record<string, number> = {};

  for (const [col, docs] of Object.entries(initialData)) {
    store[col] = {};
    for (const [id, data] of Object.entries(docs)) {
      store[col][id] = JSON.parse(JSON.stringify(data));
    }
  }

  const recordRead = (colName: string) => {
    readsByCollection[colName] = (readsByCollection[colName] || 0) + 1;
  };

  const ensureCol = (colName: string) => {
    if (!store[colName]) store[colName] = {};
    return store[colName];
  };

  const makeSnap = (id: string, data: any | undefined) => ({
    id,
    exists: data !== undefined,
    data: () => (data !== undefined ? JSON.parse(JSON.stringify(data)) : undefined),
  });

  const makeQuery = (colName: string, filters: Array<{ field: string; val: any }> = [], limitNum?: number) => ({
    where(field: string, op: string, val: any) {
      if (op !== '==') throw new Error(`Unsupported mock query op ${op}`);
      return makeQuery(colName, [...filters, { field, val }], limitNum);
    },
    limit(n: number) {
      return makeQuery(colName, filters, n);
    },
    async get() {
      recordRead(colName);
      const col = ensureCol(colName);
      let entries = Object.entries(col).filter(([, d]) =>
        filters.every((f) => d && d[f.field] === f.val)
      );
      if (typeof limitNum === 'number') {
        entries = entries.slice(0, limitNum);
      }
      const docs = entries.map(([id, d]) => makeSnap(id, d));
      return {
        empty: docs.length === 0,
        size: docs.length,
        docs,
        forEach(fn: (docSnap: any) => void) {
          docs.forEach(fn);
        },
      };
    },
  });

  return {
    _store: store,
    _reads: readsByCollection,
    resetReads() {
      for (const k of Object.keys(readsByCollection)) {
        delete readsByCollection[k];
      }
    },
    collection(colName: string) {
      return {
        ...makeQuery(colName),
        doc(docId: string) {
          return {
            id: docId,
            async get() {
              recordRead(`${colName}/${docId}`);
              const col = ensureCol(colName);
              return makeSnap(docId, col[docId]);
            },
            async set(data: any, opts?: { merge?: boolean }) {
              const col = ensureCol(colName);
              if (opts?.merge && col[docId]) {
                col[docId] = { ...col[docId], ...JSON.parse(JSON.stringify(data)) };
              } else {
                col[docId] = JSON.parse(JSON.stringify(data));
              }
            },
          };
        },
      };
    },
  };
}

function createMockCacheStorage() {
  const cacheMap = new Map<string, Map<string, { status: number; headers: Record<string, string>; body: string }>>();

  const toKey = (req: RequestInfo | URL) => {
    const raw = typeof req === 'string' ? req : req instanceof URL ? req.toString() : req.url;
    const parsed = new URL(raw, 'http://localhost');
    return parsed.pathname + parsed.search;
  };

  return {
    _raw: cacheMap,
    async open(cacheName: string) {
      if (!cacheMap.has(cacheName)) {
        cacheMap.set(cacheName, new Map());
      }
      const entries = cacheMap.get(cacheName)!;
      return {
        async match(req: RequestInfo | URL) {
          const key = toKey(req);
          const item = entries.get(key);
          if (!item) return undefined;
          return new Response(item.body, { status: item.status, headers: item.headers });
        },
        async put(req: RequestInfo | URL, res: Response) {
          const key = toKey(req);
          const body = await res.text();
          const headers: Record<string, string> = {};
          res.headers.forEach((v, k) => {
            headers[k] = v;
          });
          entries.set(key, { status: res.status, headers, body });
        },
        async keys() {
          return Array.from(entries.keys()).map((k) => new Request(`http://localhost${k}`));
        },
        async delete(req: RequestInfo | URL) {
          return entries.delete(toKey(req));
        },
      };
    },
  };
}

describe('Static Quiz Assets Server Endpoints & Service Worker Cache-First Strategy', () => {
  let server: http.Server;
  let baseUrl = '';
  let mockDb: ReturnType<typeof createTrackedFirestore>;

  const tokens: Record<string, any> = {
    'admin-token': {
      uid: 'admin_1',
      email: 'zdpaliyal@gmail.com',
      email_verified: true,
      firebase: { sign_in_provider: 'google.com' },
    },
    'student-token': {
      uid: 'student_1',
      email: 'student@example.com',
      email_verified: true,
      firebase: { sign_in_provider: 'google.com' },
    },
    'anon-token': {
      uid: 'anon_1',
      firebase: { sign_in_provider: 'anonymous' },
    },
  };

  const mockAuth = {
    async verifyIdToken(token: string) {
      const rec = tokens[token];
      if (!rec) throw new Error('Invalid token');
      return rec;
    },
  };

  beforeAll(async () => {
    mockDb = createTrackedFirestore({
      metadata: {
        app_version: {
          curriculumVersion: 7,
          lastUpdated: '2026-11-13T00:00:00.000Z',
          bundleVersions: { topic_polity: 3 },
          contentDigest: 'digest_v7',
        },
      },
      subjects: {
        sub_1: { id: 'sub_1', name: 'Indian Polity', order: 1 },
      },
      chapters: {
        chap_1: { id: 'chap_1', subjectId: 'sub_1', name: 'Constitution', order: 1 },
      },
      topics: {
        topic_polity: { id: 'topic_polity', chapterId: 'chap_1', subjectId: 'sub_1', name: 'Preamble', order: 1 },
      },
      banners: {
        ban_1: { id: 'ban_1', title: 'Mock Banner', isActive: true, order: 1 },
      },
      exam_categories: {
        cat_1: { id: 'cat_1', name: 'UPSC Prelims' },
      },
      question_bundles: {
        topic_topic_polity: {
          id: 'topic_topic_polity',
          topicId: 'topic_polity',
          chapterId: 'chap_1',
          subjectId: 'sub_1',
          version: 3,
          updatedAt: '2026-11-13T00:00:00.000Z',
          questions: [
            {
              id: 'q1',
              topicId: 'topic_polity',
              text: 'Which amendment added Socialist and Secular?',
              options: ['42nd', '44th', '52nd', '73rd'],
              correctIndex: 0,
            },
          ],
        },
      },
      pyq_papers: {
        pyq_pub: {
          id: 'pyq_pub',
          title: 'RAS Prelims 2023',
          paperYear: '2023',
          isPublished: true,
          questions: [],
        },
        pyq_draft: {
          id: 'pyq_draft',
          title: 'Unpublished Draft Paper',
          paperYear: '2025',
          isPublished: false,
          questions: [],
        },
      },
      liveTests: {
        live_pub: {
          id: 'live_pub',
          title: 'Weekly All India Live Mock',
          status: 'live',
          startTime: '2026-11-13T10:00:00.000Z',
          durationMinutes: 60,
          answerKey: { q1: 1 },
          questions: [
            {
              id: 'lt_q1',
              text: 'Capital of India?',
              options: ['Mumbai', 'New Delhi', 'Kolkata', 'Chennai'],
              correctIndex: 1,
              explanation: 'New Delhi is the capital.',
              importantFact: 'Since 1911',
            },
          ],
        },
        live_draft: {
          id: 'live_draft',
          title: 'Hidden Draft Live Test',
          status: 'draft',
          questions: [],
        },
      },
    });

    const app = await createServerApp({
      adminDb: mockDb as any,
      adminAuth: mockAuth as any,
      skipVite: true,
    });

    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const addr = server.address() as any;
        baseUrl = `http://127.0.0.1:${addr.port}`;
        resolve();
      });
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  beforeEach(() => {
    mockDb.resetReads();
    __resetQuizAssetClientCacheForTests();
  });

  test('Version endpoint caches metadata/app_version and returns bundleVersions', async () => {
    const res1 = await fetch(`${baseUrl}/api/quiz-assets/version?refresh=1`);
    expect(res1.status).toBe(200);
    const json1 = (await res1.json()) as any;
    expect(json1.success).toBe(true);
    expect(json1.curriculumVersion).toBe(7);
    expect(json1.bundleVersions).toEqual({ topic_polity: 3 });

    const readsAfterFirst = mockDb._reads['metadata/app_version'] || 0;
    expect(readsAfterFirst).toBe(1);

    // Second request without refresh hits server cache -> 0 additional Firestore reads
    const res2 = await fetch(`${baseUrl}/api/quiz-assets/version`);
    expect(res2.status).toBe(200);
    expect(mockDb._reads['metadata/app_version']).toBe(1);
  });

  test('Versioned curriculum, bundle, PYQ, and live-test endpoints emit immutable headers & coalesce reads', async () => {
    const cur1 = await fetch(`${baseUrl}/api/quiz-assets/curriculum?v=7`);
    expect(cur1.status).toBe(200);
    expect(cur1.headers.get('cache-control')).toContain('immutable');
    const curJson = (await cur1.json()) as any;
    expect(curJson.subjects).toHaveLength(1);
    expect(curJson.topics).toHaveLength(1);
    expect(curJson.banners).toHaveLength(1);

    const subjectReadsAfterFirst = mockDb._reads['subjects'] || 0;
    expect(subjectReadsAfterFirst).toBe(1);

    // Repeated call with same ?v=7 triggers 0 Firestore reads
    const cur2 = await fetch(`${baseUrl}/api/quiz-assets/curriculum?v=7`);
    expect(cur2.status).toBe(200);
    expect(mockDb._reads['subjects']).toBe(1);

    // Topic bundle
    const bun1 = await fetch(`${baseUrl}/api/quiz-assets/bundle/topic_polity?v=3`);
    expect(bun1.status).toBe(200);
    expect(bun1.headers.get('cache-control')).toContain('immutable');
    const bunJson = (await bun1.json()) as any;
    expect(bunJson.bundle.questions).toHaveLength(1);
    expect(bunJson.bundle.questions[0].id).toBe('q1');

    // Invalid / missing topic bundle handling
    const badBun = await fetch(`${baseUrl}/api/quiz-assets/bundle/bad$id?v=3`);
    expect(badBun.status).toBe(400);
    const missingBun = await fetch(`${baseUrl}/api/quiz-assets/bundle/nonexistent_topic?v=3`);
    expect(missingBun.status).toBe(404);

    // PYQ papers exclude drafts
    const pyqRes = await fetch(`${baseUrl}/api/quiz-assets/pyq-papers?v=7`);
    expect(pyqRes.status).toBe(200);
    expect(pyqRes.headers.get('cache-control')).toContain('immutable');
    const pyqJson = (await pyqRes.json()) as any;
    expect(pyqJson.papers.map((p: any) => p.id)).toEqual(['pyq_pub']);

    // Live tests exclude drafts AND strip answer keys cleanly
    const liveRes = await fetch(`${baseUrl}/api/quiz-assets/live-tests?v=7`);
    expect(liveRes.status).toBe(200);
    expect(liveRes.headers.get('cache-control')).toContain('immutable');
    const liveJson = (await liveRes.json()) as any;
    expect(liveJson.tests).toHaveLength(1);
    expect(liveJson.tests[0].id).toBe('live_pub');
    expect(liveJson.tests[0].answerKey).toBeUndefined();
    expect(liveJson.tests[0].questions[0].correctIndex).toBeUndefined();
    expect(liveJson.tests[0].questions[0].explanation).toBeUndefined();
    expect(liveJson.tests[0].questions[0].importantFact).toBeUndefined();

    // Public single live test endpoint also returns immutable + sanitized payload
    const singleLive = await fetch(`${baseUrl}/api/live-tests/live_pub?v=7`);
    expect(singleLive.status).toBe(200);
    expect(singleLive.headers.get('cache-control')).toContain('immutable');
    const singleLiveJson = (await singleLive.json()) as any;
    expect(singleLiveJson.test.questions[0].correctIndex).toBeUndefined();
  });

  test('Cache invalidation endpoint enforces verified Admin auth and clears server cache', async () => {
    const unauth = await fetch(`${baseUrl}/api/quiz-assets/invalidate`, { method: 'POST' });
    expect(unauth.status).toBe(401);

    const anon = await fetch(`${baseUrl}/api/quiz-assets/invalidate`, {
      method: 'POST',
      headers: { Authorization: 'Bearer anon-token' },
    });
    expect(anon.status).toBe(401);

    const student = await fetch(`${baseUrl}/api/quiz-assets/invalidate`, {
      method: 'POST',
      headers: { Authorization: 'Bearer student-token' },
    });
    expect(student.status).toBe(403);

    // Prime curriculum cache
    await fetch(`${baseUrl}/api/quiz-assets/curriculum?v=7`);
    const readsBefore = mockDb._reads['subjects'] || 0;

    const admin = await fetch(`${baseUrl}/api/quiz-assets/invalidate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer admin-token',
      },
      body: JSON.stringify({ topicIds: ['topic_polity'] }),
    });
    expect(admin.status).toBe(200);

    // Next fetch re-reads Firestore cleanly after invalidation
    await fetch(`${baseUrl}/api/quiz-assets/curriculum?v=7`);
    expect(mockDb._reads['subjects']).toBeGreaterThan(readsBefore);
  });

  describe('Client CacheStorage Cache-First coordinator (quizAssetSwCache)', () => {
    const originalCaches = (globalThis as any).caches;
    const originalWindow = (globalThis as any).window;
    let mockCaches: ReturnType<typeof createMockCacheStorage>;

    beforeEach(() => {
      mockCaches = createMockCacheStorage();
      (globalThis as any).caches = mockCaches;
      (globalThis as any).window = { location: { origin: baseUrl } };
    });

    afterEach(() => {
      if (originalCaches === undefined) delete (globalThis as any).caches;
      else (globalThis as any).caches = originalCaches;

      if (originalWindow === undefined) delete (globalThis as any).window;
      else (globalThis as any).window = originalWindow;
    });

    test('Repeated visits hit CacheStorage Cache-First with 0 network fetches, and version bump evicts stale cache', async () => {
      let networkCalls = 0;
      const countedFetch: typeof fetch = (input, init) => {
        networkCalls++;
        const url = typeof input === 'string' && input.startsWith('/') ? `${baseUrl}${input}` : input;
        return fetch(url as any, init);
      };

      // Visit 1: Cold cache -> 1 network fetch, populates CacheStorage
      const firstCurriculum = await fetchCurriculumAssetCacheFirst(7, { fetchImpl: countedFetch });
      expect(firstCurriculum).not.toBeNull();
      expect(firstCurriculum!.fromSwCache).toBe(false);
      expect(firstCurriculum!.subjects).toHaveLength(1);
      expect(networkCalls).toBe(1);

      // Visit 2 (repeat app visit): Warm CacheStorage -> 0 network fetches!
      const secondCurriculum = await fetchCurriculumAssetCacheFirst(7, { fetchImpl: countedFetch });
      expect(secondCurriculum).not.toBeNull();
      expect(secondCurriculum!.fromSwCache).toBe(true);
      expect(secondCurriculum!.subjects).toHaveLength(1);
      expect(networkCalls).toBe(1);

      // Topic Bundle Visit 1 -> 1 network fetch; Visit 2 -> 0 network fetches
      const bundle1 = await fetchTopicBundleAssetCacheFirst('topic_polity', 3, { fetchImpl: countedFetch });
      expect(bundle1?.questions).toHaveLength(1);
      expect(bundle1?.fromSwCache).toBe(false);
      expect(networkCalls).toBe(2);

      const bundle2 = await fetchTopicBundleAssetCacheFirst('topic_polity', 3, { fetchImpl: countedFetch });
      expect(bundle2?.questions).toHaveLength(1);
      expect(bundle2?.fromSwCache).toBe(true);
      expect(networkCalls).toBe(2);

      // PYQ Papers & Live Tests Cache-First
      const pyq1 = await fetchPyqPapersAssetCacheFirst(7, { fetchImpl: countedFetch });
      expect(pyq1?.papers).toHaveLength(1);
      expect(pyq1?.fromSwCache).toBe(false);
      const pyq2 = await fetchPyqPapersAssetCacheFirst(7, { fetchImpl: countedFetch });
      expect(pyq2?.fromSwCache).toBe(true);
      expect(networkCalls).toBe(3);

      const live1 = await fetchLiveTestsAssetCacheFirst(7, { fetchImpl: countedFetch });
      expect(live1?.tests).toHaveLength(1);
      expect(live1?.fromSwCache).toBe(false);
      const live2 = await fetchLiveTestsAssetCacheFirst(7, { fetchImpl: countedFetch });
      expect(live2?.fromSwCache).toBe(true);
      expect(networkCalls).toBe(4);

      const stats = await getQuizAssetCacheStats();
      expect(stats.supported).toBe(true);
      expect(stats.dataEntries).toBe(4);

      // Version bump to v=8 fetches new curriculum and evicts stale v=7 entry
      const v8Curriculum = await fetchCurriculumAssetCacheFirst(8, { fetchImpl: countedFetch });
      expect(v8Curriculum?.fromSwCache).toBe(false);
      expect(networkCalls).toBe(5);
      const cacheKeys = Array.from(mockCaches._raw.get(STATIC_QUIZ_DATA_CACHE_NAME)!.keys());
      expect(cacheKeys).toContain('/api/quiz-assets/curriculum?v=8');
      expect(cacheKeys).not.toContain('/api/quiz-assets/curriculum?v=7');

      // Explicit invalidation clears local CacheStorage quiz data entries
      await invalidateQuizAssetsClientAndServer();
      const postInvalidateStats = await getQuizAssetCacheStats();
      expect(postInvalidateStats.dataEntries).toBe(0);
    });
  });
});
