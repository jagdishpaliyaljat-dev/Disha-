import { doc, collection } from "firebase/firestore";
import { db, isFirebaseConfigured } from "../lib/firebase";
import { Question } from "../types";
import {
  guardedGetDoc,
  guardedGetDocs,
  guardedSetDoc,
  guardedDeleteDoc,
  guardedWriteBatch,
  isQuotaExhausted,
} from "./quotaTracker";
import { sanitizeData, normalizeTableFromFirestore } from "./firebaseSyncService";
import {
  saveCachedQuestionBundle,
  deleteCachedQuestionBundle,
  clearAllCachedBundles,
  getCachedQuestionBundleMetadata,
  getLocalMetadata,
} from "./indexedDbCache";
import { computeBundleContentHash, fnv1a64Hex } from "./contentHash";
import { fetchTopicBundleAssetCacheFirst } from "./quizAssetSwCache";

export interface QuestionBundle {
  id: string;
  topicId: string;
  chapterId?: string;
  subjectId?: string;
  questionCount: number;
  updatedAt: string;
  version?: number;
  contentHash?: string;
  questions: Question[];
}

export interface SaveBundleResult {
  written: boolean;
  skipped: boolean;
  contentHash: string;
  questionCount: number;
}

export interface PackAllBundlesResult {
  bundleCount: number;
  skippedCount: number;
  totalQuestionsPacked: number;
  totalQuestionsEvaluated: number;
  packedTopicIds: string[];
  skippedTopicIds: string[];
  contentDigest: string;
}

const BUNDLE_COLLECTION = "question_bundles";
const SYNCED_BUNDLE_HASHES_KEY = "quizpro_synced_bundle_hashes_v1";

// In-memory cache for bundles (TTL: 15 minutes)
const bundleMemoryCache = new Map<string, { data: Question[]; contentHash?: string; expiresAt: number }>();
const BUNDLE_CACHE_TTL = 15 * 60 * 1000;
let inMemoryBundleHashes: Record<string, string> = {};

function loadSyncedBundleHashes(): Record<string, string> {
  if (typeof localStorage === "undefined") return { ...inMemoryBundleHashes };
  try {
    const raw = localStorage.getItem(SYNCED_BUNDLE_HASHES_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        inMemoryBundleHashes = parsed;
        return { ...parsed };
      }
    }
  } catch {}
  return { ...inMemoryBundleHashes };
}

function saveSyncedBundleHashes(map: Record<string, string>): void {
  inMemoryBundleHashes = { ...map };
  if (typeof localStorage !== "undefined") {
    try {
      localStorage.setItem(SYNCED_BUNDLE_HASHES_KEY, JSON.stringify(inMemoryBundleHashes));
    } catch {}
  }
}

export function clearSyncedBundleHashes(topicId?: string): void {
  if (!topicId) {
    inMemoryBundleHashes = {};
    if (typeof localStorage !== "undefined") {
      try {
        localStorage.removeItem(SYNCED_BUNDLE_HASHES_KEY);
      } catch {}
    }
    return;
  }
  const current = loadSyncedBundleHashes();
  if (topicId in current) {
    delete current[topicId];
    saveSyncedBundleHashes(current);
  }
}

/**
 * Invalidate in-memory and IndexedDB local cache
 */
export async function invalidateBundleCache(topicId?: string): Promise<void> {
  if (topicId) {
    bundleMemoryCache.delete(`topic_${topicId}`);
    bundleMemoryCache.delete(topicId);
    clearSyncedBundleHashes(topicId);
    await deleteCachedQuestionBundle(topicId).catch(() => {});
  } else {
    bundleMemoryCache.clear();
    clearSyncedBundleHashes();
    await clearAllCachedBundles().catch(() => {});
  }
}

/**
 * Verifies topic ownership, deduplicates by ID, sorts deterministically by ID,
 * and computes canonical contentHash so identical content yields the exact same hash.
 */
export function prepareVerifiedBundlePayload(
  topicId: string,
  questions: Question[],
  version?: number
): { payload: QuestionBundle; sanitizedQuestions: Question[]; contentHash: string; mismatchedCount: number } {
  const byId = new Map<string, Question>();
  let mismatchedCount = 0;

  for (const rawQ of questions || []) {
    if (!rawQ || !rawQ.id) continue;
    if (rawQ.topicId && rawQ.topicId !== topicId) {
      mismatchedCount++;
      continue;
    }
    const sanitized = { ...rawQ, topicId };
    delete (sanitized as any).pendingAttempt;
    byId.set(rawQ.id, sanitizeData(sanitized));
  }

  const sortedIds = Array.from(byId.keys()).sort();
  const sanitizedQuestions = sortedIds.map((id) => byId.get(id)!);
  const contentHash = computeBundleContentHash(topicId, sanitizedQuestions);
  const firstQ = sanitizedQuestions[0];
  const bundleId = `topic_${topicId}`;
  const now = new Date().toISOString();

  const payload: QuestionBundle = {
    id: bundleId,
    topicId,
    chapterId: firstQ?.chapterId || "",
    subjectId: firstQ?.subjectId || "",
    questionCount: sanitizedQuestions.length,
    updatedAt: now,
    version,
    contentHash,
    questions: sanitizedQuestions,
  };

  return { payload, sanitizedQuestions, contentHash, mismatchedCount };
}

/**
 * Verify bundle-to-MCQ consistency for a given topic and expected MCQ set.
 */
export function verifyBundleConsistency(
  bundle: Partial<QuestionBundle> | null | undefined,
  expectedQuestions: Question[]
): { consistent: boolean; missingIds: string[]; extraIds: string[]; mismatchedTopicIds: string[] } {
  const bundleQs = Array.isArray(bundle?.questions) ? bundle!.questions : [];
  const bundleMap = new Map(bundleQs.map((q) => [q.id, q]));
  const expectedMap = new Map(
    (expectedQuestions || []).filter((q) => q && q.id && (!q.topicId || q.topicId === bundle?.topicId)).map((q) => [q.id, q])
  );

  const missingIds: string[] = [];
  const extraIds: string[] = [];
  const mismatchedTopicIds: string[] = [];

  for (const id of expectedMap.keys()) {
    if (!bundleMap.has(id)) missingIds.push(id);
  }
  for (const [id, q] of bundleMap.entries()) {
    if (!expectedMap.has(id)) extraIds.push(id);
    if (bundle?.topicId && q.topicId && q.topicId !== bundle.topicId) {
      mismatchedTopicIds.push(id);
    }
  }

  return {
    consistent: missingIds.length === 0 && extraIds.length === 0 && mismatchedTopicIds.length === 0,
    missingIds,
    extraIds,
    mismatchedTopicIds,
  };
}

function normalizeBundleQuestions(questions: Question[]): Question[] {
  return (questions || []).map((q: any) => {
    if (!q || typeof q !== "object") return q;
    if (!q.table && !q.tableData) return q;
    const copy = { ...q };
    if (copy.table) copy.table = normalizeTableFromFirestore(copy.table);
    if (copy.tableData) copy.tableData = normalizeTableFromFirestore(copy.tableData);
    return copy;
  });
}

/**
 * Fetch MCQs for a topic using the BUCKET PATTERN + PERSISTENT INDEXEDDB & SW CACHE-FIRST CACHING.
 */
export async function fetchQuestionBundleByTopic(
  topicId: string,
  minVersion?: number,
  minUpdatedAt?: string
): Promise<Question[] | null> {
  if (!topicId) return null;

  const bundleId = `topic_${topicId}`;

  // 1. Check local in-memory RAM cache first (0 Reads!)
  const cached = bundleMemoryCache.get(bundleId);
  if (cached && Date.now() < cached.expiresAt) {
    if (!minVersion && !minUpdatedAt) return cached.data;
  }

  // 2. Check Persistent Local Caching (IndexedDB) (0 Reads!)
  try {
    const meta = await getCachedQuestionBundleMetadata(topicId);

    if (meta && meta.questions && meta.questions.length > 0) {
      const isUpToDate =
        (!minVersion || (meta.version || 0) >= minVersion) &&
        (!minUpdatedAt || (meta.updatedAt && meta.updatedAt >= minUpdatedAt));

      if (isUpToDate) {
        bundleMemoryCache.set(bundleId, {
          data: meta.questions,
          contentHash: meta.contentHash,
          expiresAt: Date.now() + BUNDLE_CACHE_TTL,
        });
        return meta.questions;
      }
    }
  } catch (err) {
    console.warn(`[IndexedDB Cache] Lookup missed or error for topic: ${topicId}`, err);
  }

  // 2.5. Check Service Worker Cache-First versioned static bundle asset (0 client Firestore reads!)
  try {
    const localMeta = !minVersion ? await getLocalMetadata<any>("curriculum_version_meta").catch(() => null) : null;
    const resolvedVersion =
      minVersion ||
      Number(localMeta?.bundleVersions?.[topicId]) ||
      Number(localMeta?.curriculumVersion) ||
      undefined;

    const swBundle = await fetchTopicBundleAssetCacheFirst(topicId, resolvedVersion).catch(() => null);
    if (swBundle && swBundle.questions && swBundle.questions.length > 0) {
      const isAssetUpToDate =
        (!minVersion || (swBundle.version || 0) >= minVersion) &&
        (!minUpdatedAt || (swBundle.updatedAt && swBundle.updatedAt >= minUpdatedAt));

      if (isAssetUpToDate) {
        const questions = normalizeBundleQuestions(swBundle.questions);
        const contentHash = swBundle.contentHash || computeBundleContentHash(topicId, questions);
        const manifest = loadSyncedBundleHashes();
        manifest[topicId] = contentHash;
        saveSyncedBundleHashes(manifest);

        bundleMemoryCache.set(bundleId, {
          data: questions,
          contentHash,
          expiresAt: Date.now() + BUNDLE_CACHE_TTL,
        });

        saveCachedQuestionBundle(topicId, questions, swBundle.updatedAt, swBundle.version, contentHash).catch(() => {});
        return questions;
      }
    }
  } catch (err) {
    console.warn(`[SW Cache] Lookup missed for topic: ${topicId}`, err);
  }

  if (!isFirebaseConfigured()) return null;

  // 3. Fallback to Cloud Firestore single bundle document (1 Read!)
  try {
    const docRef = doc(db, BUNDLE_COLLECTION, bundleId);
    const snap = await guardedGetDoc(docRef, "Student", `Fetch Bucket Bundle [${bundleId}]`);

    if (snap.exists()) {
      const data = snap.data() as QuestionBundle;
      const questions = normalizeBundleQuestions(Array.isArray(data.questions) ? data.questions : []);

      const isCloudUpToDate =
        (!minVersion || (data.version || 0) >= minVersion) &&
        (!minUpdatedAt || (data.updatedAt && data.updatedAt >= minUpdatedAt));

      if (!isCloudUpToDate) {
        return null;
      }

      const contentHash = data.contentHash || computeBundleContentHash(topicId, questions);
      const manifest = loadSyncedBundleHashes();
      manifest[topicId] = contentHash;
      saveSyncedBundleHashes(manifest);

      bundleMemoryCache.set(bundleId, {
        data: questions,
        contentHash,
        expiresAt: Date.now() + BUNDLE_CACHE_TTL,
      });

      saveCachedQuestionBundle(topicId, questions, data.updatedAt, data.version, contentHash).catch(() => {});

      return questions;
    }
  } catch (err) {
    console.warn(`[Bucket Pattern] Could not fetch bundle from cloud for topic: ${topicId}`, err);
  }

  return null;
}

/**
 * Save / Pack all questions of a topic into a single Firestore Bundle document.
 * Compares deterministic contentHash against local manifest / remote bundle and skips unchanged bundles (0 writes).
 */
export async function saveQuestionBundleForTopic(
  topicId: string,
  questions: Question[],
  version?: number,
  options?: { force?: boolean; knownRemoteHash?: string; verifyAgainstRemote?: boolean }
): Promise<SaveBundleResult> {
  if (!topicId || !questions.length) {
    return { written: false, skipped: true, contentHash: "empty", questionCount: 0 };
  }

  const { payload, sanitizedQuestions, contentHash } = prepareVerifiedBundlePayload(
    topicId,
    questions,
    version
  );

  if (sanitizedQuestions.length === 0) {
    return { written: false, skipped: true, contentHash, questionCount: 0 };
  }

  const bundleId = payload.id;

  if (!isFirebaseConfigured()) {
    bundleMemoryCache.set(bundleId, {
      data: sanitizedQuestions,
      contentHash,
      expiresAt: Date.now() + BUNDLE_CACHE_TTL,
    });
    await saveCachedQuestionBundle(topicId, sanitizedQuestions, payload.updatedAt, version, contentHash).catch(() => {});
    return { written: false, skipped: true, contentHash, questionCount: sanitizedQuestions.length };
  }

  const manifest = loadSyncedBundleHashes();
  let existingHash: string | undefined = options?.knownRemoteHash || manifest[topicId];

  // If unknown locally or caller explicitly wants remote verification, inspect remote bundle doc (1 read)
  if ((!existingHash || options?.verifyAgainstRemote) && !options?.force && !isQuotaExhausted()) {
    try {
      const existingSnap = await guardedGetDoc(
        doc(db, BUNDLE_COLLECTION, bundleId),
        "Admin",
        `Check Bundle Hash [${bundleId}]`,
        undefined,
        8000,
        Boolean(options?.verifyAgainstRemote)
      );
      if (existingSnap.exists()) {
        const remote = existingSnap.data() as QuestionBundle;
        existingHash =
          remote.contentHash || computeBundleContentHash(topicId, Array.isArray(remote.questions) ? remote.questions : []);
        manifest[topicId] = existingHash;
        saveSyncedBundleHashes(manifest);
      } else {
        existingHash = undefined;
      }
    } catch {}
  }

  if (existingHash && existingHash === contentHash && !options?.force) {
    bundleMemoryCache.set(bundleId, {
      data: sanitizedQuestions,
      contentHash,
      expiresAt: Date.now() + BUNDLE_CACHE_TTL,
    });
    await saveCachedQuestionBundle(topicId, sanitizedQuestions, payload.updatedAt, version, contentHash).catch(() => {});
    return { written: false, skipped: true, contentHash, questionCount: sanitizedQuestions.length };
  }

  const docRef = doc(db, BUNDLE_COLLECTION, bundleId);
  await guardedSetDoc(
    docRef,
    payload,
    { merge: true },
    "Admin",
    `Pack Bundle [${bundleId}]`,
    undefined,
    30000,
    `bundle_${bundleId}_${contentHash}`
  );

  manifest[topicId] = contentHash;
  saveSyncedBundleHashes(manifest);

  bundleMemoryCache.set(bundleId, {
    data: sanitizedQuestions,
    contentHash,
    expiresAt: Date.now() + BUNDLE_CACHE_TTL,
  });

  await saveCachedQuestionBundle(topicId, sanitizedQuestions, payload.updatedAt, version, contentHash).catch(() => {});

  return {
    written: true,
    skipped: false,
    contentHash,
    questionCount: sanitizedQuestions.length,
  };
}

/**
 * Delete a specific bundle from Firestore AND clear RAM/IndexedDB/manifest caches.
 */
export async function deleteQuestionBundleFromCloud(topicId: string): Promise<void> {
  if (!topicId) return;
  await invalidateBundleCache(topicId);
  if (!isFirebaseConfigured()) return;
  const bundleId = `topic_${topicId}`;
  const docRef = doc(db, BUNDLE_COLLECTION, bundleId);
  await guardedDeleteDoc(docRef, "Admin", `Delete Bundle [${bundleId}]`);
}

/**
 * Admin Tool: Convert entire question bank into Topic Buckets.
 * Compares deterministic content hashes against remote bundles & local manifest so
 * unchanged topic bundles are 100% skipped (0 writes).
 */
export async function packAllQuestionsIntoTopicBundles(
  allQuestions: Question[],
  onProgress?: (packedTopics: number, totalTopics: number) => void,
  options?: { force?: boolean; onlyTopicIds?: string[]; skipRemoteDiffRead?: boolean }
): Promise<PackAllBundlesResult> {
  if (!isFirebaseConfigured() || !allQuestions.length) {
    return {
      bundleCount: 0,
      skippedCount: 0,
      totalQuestionsPacked: 0,
      totalQuestionsEvaluated: 0,
      packedTopicIds: [],
      skippedTopicIds: [],
      contentDigest: "empty",
    };
  }

  const onlySet = options?.onlyTopicIds ? new Set(options.onlyTopicIds.filter(Boolean)) : null;

  // 1. Group verified questions by topicId
  const topicMap = new Map<string, Question[]>();
  for (const q of allQuestions) {
    if (!q || !q.id || !q.topicId) continue;
    if (onlySet && !onlySet.has(q.topicId)) continue;
    const list = topicMap.get(q.topicId) || [];
    list.push(q);
    topicMap.set(q.topicId, list);
  }

  const totalTopics = topicMap.size;
  if (totalTopics === 0) {
    return {
      bundleCount: 0,
      skippedCount: 0,
      totalQuestionsPacked: 0,
      totalQuestionsEvaluated: 0,
      packedTopicIds: [],
      skippedTopicIds: [],
      contentDigest: "empty",
    };
  }

  // 2. Fetch existing remote bundle hashes in ONE collection snapshot so unchanged bundles are detected accurately
  const manifest = loadSyncedBundleHashes();
  const remoteHashes = new Map<string, string>();
  if (!options?.skipRemoteDiffRead && !options?.force && !isQuotaExhausted()) {
    try {
      const snap = await guardedGetDocs(
        collection(db, BUNDLE_COLLECTION),
        "Admin",
        "Diff Existing Question Bundles",
        undefined,
        15000,
        true
      );
      if (snap && !snap.empty) {
        snap.docs.forEach((d) => {
          const data = d.data() as QuestionBundle;
          const tId = data.topicId || d.id.replace(/^topic_/, "");
          const h =
            data.contentHash ||
            computeBundleContentHash(tId, Array.isArray(data.questions) ? data.questions : []);
          remoteHashes.set(tId, h);
          manifest[tId] = h;
        });
        saveSyncedBundleHashes(manifest);
      }
    } catch (err) {
      console.warn("[BundleDiff] Falling back to local bundle hash manifest:", err);
    }
  }

  // 3. Classify dirty vs unchanged topic bundles
  const dirtyPayloads: Array<{
    topicId: string;
    payload: QuestionBundle;
    sanitizedQuestions: Question[];
    contentHash: string;
  }> = [];
  const skippedTopicIds: string[] = [];
  const allHashesForDigest: string[] = [];
  let totalQuestionsEvaluated = 0;

  for (const [topicId, questions] of topicMap.entries()) {
    const prepared = prepareVerifiedBundlePayload(topicId, questions);
    if (prepared.sanitizedQuestions.length === 0) continue;

    totalQuestionsEvaluated += prepared.sanitizedQuestions.length;
    allHashesForDigest.push(`${topicId}:${prepared.contentHash}`);

    const knownHash = remoteHashes.has(topicId)
      ? remoteHashes.get(topicId)
      : options?.skipRemoteDiffRead
      ? manifest[topicId]
      : undefined;

    if (!options?.force && knownHash && knownHash === prepared.contentHash) {
      skippedTopicIds.push(topicId);
      bundleMemoryCache.set(prepared.payload.id, {
        data: prepared.sanitizedQuestions,
        contentHash: prepared.contentHash,
        expiresAt: Date.now() + BUNDLE_CACHE_TTL,
      });
      await saveCachedQuestionBundle(
        topicId,
        prepared.sanitizedQuestions,
        prepared.payload.updatedAt,
        undefined,
        prepared.contentHash
      ).catch(() => {});
      continue;
    }

    dirtyPayloads.push({
      topicId,
      payload: prepared.payload,
      sanitizedQuestions: prepared.sanitizedQuestions,
      contentHash: prepared.contentHash,
    });
  }

  // 4. Batch-commit ONLY dirty bundles in chunks of 20
  let packedCount = 0;
  let totalQuestionsPacked = 0;
  const packedTopicIds: string[] = [];
  const BATCH_SIZE = 20;

  for (let i = 0; i < dirtyPayloads.length; i += BATCH_SIZE) {
    if (isQuotaExhausted()) break;
    const chunk = dirtyPayloads.slice(i, i + BATCH_SIZE);
    const batch = guardedWriteBatch(db);

    for (const item of chunk) {
      const docRef = doc(db, BUNDLE_COLLECTION, item.payload.id);
      batch.set(docRef, item.payload, { merge: true });
      totalQuestionsPacked += item.sanitizedQuestions.length;
    }

    const chunkKey = `pack_bundles_${fnv1a64Hex(chunk.map((c) => `${c.topicId}:${c.contentHash}`).join("|"))}`;
    await batch.commit("Admin", "Pack Changed Topic Question Bundles", undefined, 30000, chunkKey);

    for (const item of chunk) {
      manifest[item.topicId] = item.contentHash;
      packedTopicIds.push(item.topicId);
      bundleMemoryCache.set(item.payload.id, {
        data: item.sanitizedQuestions,
        contentHash: item.contentHash,
        expiresAt: Date.now() + BUNDLE_CACHE_TTL,
      });
      await saveCachedQuestionBundle(
        item.topicId,
        item.sanitizedQuestions,
        item.payload.updatedAt,
        undefined,
        item.contentHash
      ).catch(() => {});
    }
    saveSyncedBundleHashes(manifest);

    packedCount += chunk.length;
    if (onProgress) {
      onProgress(packedCount + skippedTopicIds.length, totalTopics);
    }
  }

  if (dirtyPayloads.length === 0 && onProgress) {
    onProgress(totalTopics, totalTopics);
  }

  const contentDigest = fnv1a64Hex(allHashesForDigest.sort().join("|"));

  return {
    bundleCount: packedCount,
    skippedCount: skippedTopicIds.length,
    totalQuestionsPacked,
    totalQuestionsEvaluated,
    packedTopicIds,
    skippedTopicIds,
    contentDigest,
  };
}
