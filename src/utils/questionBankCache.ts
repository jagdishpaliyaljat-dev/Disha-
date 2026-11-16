import localforage from "localforage";
import { Question } from "../types";
import { CHAPTERS_DATA } from "../data/questions";

// Custom resilient in-memory driver for SSR / Node tests / private browsing with blocked storage
const memoryDriver: LocalForageDriver = {
  _driver: "memoryDriver",
  _initStorage: function (this: any) {
    this._db = new Map<string, any>();
  },
  getItem: function <T>(this: any, key: string, callback?: (err: any, value: T | null) => void): Promise<T | null> {
    if (!this._db) this._db = new Map<string, any>();
    const val = this._db.has(key) ? this._db.get(key) : null;
    if (callback) callback(null, val);
    return Promise.resolve(val);
  },
  setItem: function <T>(this: any, key: string, value: T, callback?: (err: any, value: T) => void): Promise<T> {
    if (!this._db) this._db = new Map<string, any>();
    this._db.set(key, value);
    if (callback) callback(null, value);
    return Promise.resolve(value);
  },
  removeItem: function (this: any, key: string, callback?: (err: any) => void): Promise<void> {
    if (this._db) this._db.delete(key);
    if (callback) callback(null);
    return Promise.resolve();
  },
  clear: function (this: any, callback?: (err: any) => void): Promise<void> {
    if (this._db) this._db.clear();
    if (callback) callback(null);
    return Promise.resolve();
  },
  length: function (this: any, callback?: (err: any, numberOfKeys: number) => void): Promise<number> {
    const len = this._db ? this._db.size : 0;
    if (callback) callback(null, len);
    return Promise.resolve(len);
  },
  key: function (this: any, n: number, callback?: (err: any, key: string) => void): Promise<string> {
    const keys: string[] = this._db ? (Array.from(this._db.keys()) as string[]) : [];
    const k: string = keys[n] || "";
    if (callback) callback(null, k);
    return Promise.resolve(k);
  },
  keys: function (this: any, callback?: (err: any, keys: string[]) => void): Promise<string[]> {
    const keys: string[] = this._db ? (Array.from(this._db.keys()) as string[]) : [];
    if (callback) callback(null, keys);
    return Promise.resolve(keys);
  },
  iterate: function <T, U>(
    this: any,
    iterator: (value: T, key: string, iterationNumber: number) => U,
    callback?: (err: any, result: U) => void
  ): Promise<U> {
    if (!this._db) this._db = new Map<string, any>();
    let iterationNumber = 1;
    let res: any;
    for (const [key, value] of this._db.entries()) {
      res = iterator(value, key, iterationNumber++);
      if (res !== undefined) break;
    }
    if (callback) callback(null, res);
    return Promise.resolve(res);
  },
};

// Register memory driver synchronously
try {
  localforage.defineDriver(memoryDriver);
} catch (_) {}

// Dedicated localforage instances for DISHA 20-20 Question Bank
// Hierarchy: IndexedDB (fastest persistent DB) -> LocalStorage (fallback) -> memoryDriver (resilient)
export const questionBankStore = localforage.createInstance({
  name: "Disha2020DB",
  storeName: "question_bank_cache",
  driver: [localforage.INDEXEDDB, localforage.LOCALSTORAGE, "memoryDriver"],
  description: "Offline-first persistent question bank cache powered by IndexedDB",
});

export const questionMetaStore = localforage.createInstance({
  name: "Disha2020DB",
  storeName: "question_bank_meta",
  driver: [localforage.INDEXEDDB, localforage.LOCALSTORAGE, "memoryDriver"],
  description: "Cache metadata, TTL timestamps, and offline synchronization indices",
});

export interface CacheMetadata {
  cachedAt: number;
  itemCount: number;
  version?: number;
  topicId?: string;
  source: "initial" | "sync" | "firestore" | "user";
}

export interface QuestionBankStats {
  totalQuestions: number;
  cachedTopicsCount: number;
  lastSyncTime: number | null;
  isOfflineReady: boolean;
  driver: string;
}

// In-memory hot cache for instant zero-ms access during rapid navigation
const hotMemoryTopicCache = new Map<string, { questions: Question[]; timestamp: number }>();
let isCacheWarming = false;
let isCacheWarmed = false;

const HOT_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes hot memory TTL

/**
 * Validates whether a record conforms to a playable MCQ question
 */
export function isValidQuestion(q: any): q is Question {
  return Boolean(
    q &&
    typeof q === "object" &&
    (q.text || q.question) &&
    Array.isArray(q.options) &&
    q.options.length >= 2
  );
}

/**
 * Normalize question object to ensure standard field types
 */
export function normalizeCachedQuestion(q: any): Question {
  const text = (q.text || q.question || "Untitled Question").trim();
  const options = Array.isArray(q.options) && q.options.length >= 2 ? q.options : ["Option A", "Option B"];
  const correctIndex = typeof q.correctIndex === "number"
    ? q.correctIndex
    : (typeof q.correctAnswer === "number" ? q.correctAnswer : 0);

  return {
    id: q.id || `q_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    text,
    options,
    correctIndex,
    explanation: q.explanation || "",
    topicId: q.topicId || (q.topic ? String(q.topic) : "general"),
    chapterId: q.chapterId || "",
    subjectId: q.subjectId || "",
    difficulty: q.difficulty || "medium",
    ...(q.hindiText ? { hindiText: q.hindiText } : {}),
    ...(q.hindiOptions ? { hindiOptions: q.hindiOptions } : {}),
    ...(q.hindiExplanation ? { hindiExplanation: q.hindiExplanation } : {}),
    ...(q.imageUrl ? { imageUrl: q.imageUrl } : {}),
    ...(q.image ? { image: q.image } : {}),
    ...(q.table ? { table: q.table } : {}),
    ...(q.tableData ? { tableData: q.tableData } : {}),
    ...(q.paperId ? { paperId: q.paperId } : {}),
    ...(q.testId ? { testId: q.testId } : {}),
    ...(q.examCategory ? { examCategory: q.examCategory } : {}),
    ...(q.examYear ? { examYear: q.examYear } : {}),
    ...(q.updatedAt ? { updatedAt: q.updatedAt } : {}),
    ...(q.createdAt ? { createdAt: q.createdAt } : {}),
  };
}

/**
 * Deduplicate questions by ID (last one or higher updatedAt wins)
 */
export function deduplicateQuestionsList(questions: Question[]): Question[] {
  if (!Array.isArray(questions) || questions.length === 0) return [];
  const map = new Map<string, Question>();
  for (const q of questions) {
    if (!isValidQuestion(q)) continue;
    const norm = normalizeCachedQuestion(q);
    const existing = map.get(norm.id);
    if (!existing) {
      map.set(norm.id, norm);
    } else {
      const t1 = new Date((existing as any).updatedAt || existing.createdAt || 0).getTime() || 0;
      const t2 = new Date((norm as any).updatedAt || norm.createdAt || 0).getTime() || 0;
      map.set(norm.id, t2 >= t1 ? { ...existing, ...norm } : { ...norm, ...existing });
    }
  }
  return Array.from(map.values());
}

/**
 * Save questions into IndexedDB via localforage.
 * Saves both to the topic bundle and maintains the global question index.
 */
export async function saveQuestionsToCache(
  questions: Question[],
  context?: { topicId?: string; chapterId?: string; subjectId?: string; source?: "initial" | "sync" | "firestore" | "user" }
): Promise<void> {
  if (!Array.isArray(questions) || questions.length === 0) return;

  const validQuestions = deduplicateQuestionsList(questions);
  if (validQuestions.length === 0) return;

  try {
    const now = Date.now();
    const source = context?.source || "sync";

    // 1. Group questions by topicId
    const byTopic = new Map<string, Question[]>();
    for (const q of validQuestions) {
      const tid = q.topicId || context?.topicId || "general";
      const list = byTopic.get(tid) || [];
      list.push(q);
      byTopic.set(tid, list);
    }

    // If context specifies a topicId, ensure that topic bundle is also tracked
    if (context?.topicId && !byTopic.has(context.topicId)) {
      byTopic.set(context.topicId, validQuestions);
    }

    // 2. Persist topic bundles into localforage
    for (const [tid, topicQs] of byTopic.entries()) {
      const topicKey = `topic:${tid}`;
      const existing = (await questionBankStore.getItem<Question[]>(topicKey)) || [];
      const merged = deduplicateQuestionsList([...existing, ...topicQs]);
      await questionBankStore.setItem(topicKey, merged);

      // Update hot memory cache
      hotMemoryTopicCache.set(tid, { questions: merged, timestamp: now });
      hotMemoryTopicCache.set(tid.toLowerCase(), { questions: merged, timestamp: now });

      // Record metadata
      await questionMetaStore.setItem(`meta:${topicKey}`, {
        cachedAt: now,
        itemCount: merged.length,
        topicId: tid,
        source,
      } as CacheMetadata);
    }

    // 3. Update global question bank bundle
    const globalKey = "bank:all_questions";
    const existingGlobal = (await questionBankStore.getItem<Question[]>(globalKey)) || [];
    const mergedGlobal = deduplicateQuestionsList([...existingGlobal, ...validQuestions]);
    await questionBankStore.setItem(globalKey, mergedGlobal);

    // Save global metadata
    await questionMetaStore.setItem(`meta:${globalKey}`, {
      cachedAt: now,
      itemCount: mergedGlobal.length,
      source,
    } as CacheMetadata);

    // Track list of all cached topic IDs
    const existingTopicKeys = (await questionMetaStore.getItem<string[]>("index:topic_keys")) || [];
    const updatedTopicKeys = Array.from(new Set([...existingTopicKeys, ...Array.from(byTopic.keys())]));
    await questionMetaStore.setItem("index:topic_keys", updatedTopicKeys);

  } catch (err) {
    console.warn("[QuestionBankCache] Error saving questions to localforage:", err);
  }
}

/**
 * Get cached questions for a topic directly from IndexedDB via localforage.
 * Fast path: checks hot RAM cache first (<1ms), then IndexedDB (<15ms).
 */
export async function getCachedQuestionsByTopic(topicId: string): Promise<Question[] | null> {
  if (!topicId) return null;

  // 1. Hot RAM check
  const hot = hotMemoryTopicCache.get(topicId) || hotMemoryTopicCache.get(topicId.toLowerCase());
  if (hot && Date.now() - hot.timestamp < HOT_CACHE_TTL_MS && hot.questions.length > 0) {
    return hot.questions;
  }

  // 2. IndexedDB check via localforage
  try {
    const topicKey = `topic:${topicId}`;
    let cached = await questionBankStore.getItem<Question[]>(topicKey);

    // Case-insensitive fallback lookup if exact key was empty
    if (!cached || cached.length === 0) {
      const topicKeys = (await questionMetaStore.getItem<string[]>("index:topic_keys")) || [];
      const matchingKey = topicKeys.find((k) => k.toLowerCase() === topicId.toLowerCase());
      if (matchingKey) {
        cached = await questionBankStore.getItem<Question[]>(`topic:${matchingKey}`);
      }
    }

    // If topic bundle wasn't directly found, check global question bank
    if (!cached || cached.length === 0) {
      const allQuestions = await questionBankStore.getItem<Question[]>("bank:all_questions");
      if (Array.isArray(allQuestions) && allQuestions.length > 0) {
        const tIdLower = topicId.toLowerCase();
        const matching = allQuestions.filter((q) => {
          if (!q) return false;
          if (q.topicId && q.topicId.toLowerCase() === tIdLower) return true;
          if ((q as any).topic && String((q as any).topic).toLowerCase() === tIdLower) return true;
          if (q.chapterId && q.chapterId.toLowerCase() === tIdLower) return true;
          return false;
        });
        if (matching.length > 0) {
          cached = deduplicateQuestionsList(matching);
          // Cache this topic key for future direct hits
          await questionBankStore.setItem(topicKey, cached);
        }
      }
    }

    if (cached && Array.isArray(cached) && cached.length > 0) {
      const valid = deduplicateQuestionsList(cached);
      hotMemoryTopicCache.set(topicId, { questions: valid, timestamp: Date.now() });
      hotMemoryTopicCache.set(topicId.toLowerCase(), { questions: valid, timestamp: Date.now() });
      return valid;
    }
  } catch (err) {
    console.warn(`[QuestionBankCache] IndexedDB error querying topic ${topicId}:`, err);
  }

  return null;
}

/**
 * Get all cached questions stored in IndexedDB via localforage
 */
export async function getAllCachedQuestions(): Promise<Question[]> {
  try {
    // 1. Direct global bundle
    const globalList = await questionBankStore.getItem<Question[]>("bank:all_questions");
    if (Array.isArray(globalList) && globalList.length > 0) {
      return deduplicateQuestionsList(globalList);
    }

    // 2. Aggregate across all topic bundles
    const topicKeys = (await questionMetaStore.getItem<string[]>("index:topic_keys")) || [];
    const aggregated: Question[] = [];
    for (const key of topicKeys) {
      const qs = await questionBankStore.getItem<Question[]>(`topic:${key}`);
      if (Array.isArray(qs) && qs.length > 0) {
        aggregated.push(...qs);
      }
    }

    if (aggregated.length > 0) {
      const deduped = deduplicateQuestionsList(aggregated);
      // Save global bundle for faster future queries
      await questionBankStore.setItem("bank:all_questions", deduped);
      return deduped;
    }
  } catch (err) {
    console.warn("[QuestionBankCache] Error getting all cached questions:", err);
  }

  return [];
}

/**
 * Cache-First Question Retrieval Strategy:
 * 1. Read from IndexedDB via localforage (returns immediately for offline MCQ practice).
 * 2. If cached questions exist:
 *    - Return them immediately to guarantee 0-second start times & uninterrupted offline learning.
 *    - In the background, trigger non-blocking revalidation if online (stale-while-revalidate).
 * 3. If cache is empty (cache miss):
 *    - Fall back to remote fetch (Supabase sync).
 *    - On remote success, populate localforage IndexedDB and return fresh questions.
 *    - On remote failure (offline or quota limit), fall back to seed questions safely.
 */
export async function fetchQuestionsCacheFirst(
  topicId: string,
  options?: {
    forceRefresh?: boolean;
    remoteFetcher?: (topicId: string) => Promise<Question[]>;
    fallbackToAll?: boolean;
  }
): Promise<Question[]> {
  if (!topicId) return [];

  // Special handling for 'all'
  if (topicId === "all") {
    const cachedAll = await getAllCachedQuestions();
    if (cachedAll.length > 0 && !options?.forceRefresh) {
      // Revalidate in background if online
      if (typeof navigator !== "undefined" && navigator.onLine && options?.remoteFetcher) {
        options.remoteFetcher("all").then((remoteQs) => {
          if (Array.isArray(remoteQs) && remoteQs.length > 0) {
            saveQuestionsToCache(remoteQs, { topicId: "all", source: "firestore" }).catch(() => {});
          }
        }).catch(() => {});
      }
      return cachedAll;
    }
  }

  // Step 1: Check IndexedDB Cache First (unless explicitly forcing refresh)
  if (!options?.forceRefresh) {
    const cached = await getCachedQuestionsByTopic(topicId);
    if (cached && cached.length > 0) {
      // Revalidate in background if online without blocking student practice
      if (typeof navigator !== "undefined" && navigator.onLine && options?.remoteFetcher) {
        options.remoteFetcher(topicId).then((remoteQs) => {
          if (Array.isArray(remoteQs) && remoteQs.length > 0) {
            saveQuestionsToCache(remoteQs, { topicId, source: "firestore" }).catch(() => {});
          }
        }).catch(() => {});
      }
      return cached;
    }
  }

  // Step 2: Cache Miss (or Force Refresh) — Attempt remote fetch if fetcher provided or via supabaseSyncService
  try {
    let remoteQuestions: Question[] = [];
    if (options?.remoteFetcher) {
      remoteQuestions = await options.remoteFetcher(topicId);
    } else {
      const { fetchQuestionsByTopic } = await import("./supabaseSyncService");
      const fetched = await fetchQuestionsByTopic(topicId);
      if (Array.isArray(fetched) && fetched.length > 0) {
        remoteQuestions = fetched.map(normalizeCachedQuestion);
      }
    }

    if (remoteQuestions.length > 0) {
      const valid = deduplicateQuestionsList(remoteQuestions);
      // Persist in localforage IndexedDB for future offline practice sessions
      saveQuestionsToCache(valid, { topicId, source: "supabase" }).catch(() => {});
      return valid;
    }
  } catch (remoteErr) {
    console.warn(`[QuestionBankCache] Remote fetch failed for topic ${topicId} (offline or quota):`, remoteErr);
  }

  // Step 3: Remote failed or empty — Check in-memory store and seed curriculum
  try {
    const { loadUserQuestionsStore } = await import("./questionsStorage");
    const store = loadUserQuestionsStore();
    const allStoreQs = [...(store.customQuestions || []), ...(store.cloudCacheQuestions || [])];
    const tIdLower = topicId.toLowerCase();

    const matchedInStore = allStoreQs.filter((q) => {
      if (!isValidQuestion(q)) return false;
      if (topicId === "all") return true;
      if (q.topicId && q.topicId.toLowerCase() === tIdLower) return true;
      if ((q as any).topic && String((q as any).topic).toLowerCase() === tIdLower) return true;
      if (q.chapterId && q.chapterId.toLowerCase() === tIdLower) return true;
      return false;
    });

    if (matchedInStore.length > 0) {
      const valid = deduplicateQuestionsList(matchedInStore);
      saveQuestionsToCache(valid, { topicId, source: "user" }).catch(() => {});
      return valid;
    }
  } catch (storeErr) {
    console.warn("[QuestionBankCache] Store lookup fallback error:", storeErr);
  }

  // Step 4: Check CHAPTERS_DATA base dataset
  try {
    const baseQuestions = CHAPTERS_DATA.flatMap((c) =>
      c.topics.flatMap((t) => {
        if (topicId === "all" || t.id.toLowerCase() === topicId.toLowerCase()) {
          return t.questions || [];
        }
        return [];
      })
    );

    if (baseQuestions.length > 0) {
      const valid = deduplicateQuestionsList(baseQuestions);
      saveQuestionsToCache(valid, { topicId, source: "initial" }).catch(() => {});
      return valid;
    }
  } catch (_) {}

  // Step 5: Final fallback to cached questions from any topic if allowed
  if (options?.fallbackToAll) {
    const all = await getAllCachedQuestions();
    if (all.length > 0) {
      return all.slice(0, 30);
    }
  }

  return [];
}

/**
 * Pre-warms the question bank cache on app startup.
 * Seeds IndexedDB with existing questions from CHAPTERS_DATA, in-memory store,
 * and legacy caches so offline practice is immediately functional.
 */
export async function warmQuestionBankCache(): Promise<{ totalQuestions: number; topicCount: number }> {
  if (isCacheWarming || isCacheWarmed) {
    const stats = await getQuestionBankCacheStats();
    return { totalQuestions: stats.totalQuestions, topicCount: stats.cachedTopicsCount };
  }

  isCacheWarming = true;

  try {
    const collected: Question[] = [];

    // 1. Gather all questions from CHAPTERS_DATA
    try {
      CHAPTERS_DATA.forEach((ch) => {
        (ch.topics || []).forEach((top) => {
          (top.questions || []).forEach((q) => {
            if (isValidQuestion(q)) {
              collected.push({
                ...q,
                topicId: q.topicId || top.id,
                chapterId: q.chapterId || ch.id,
                subjectId: q.subjectId || ch.subjectId || "economics",
              });
            }
          });
        });
      });
    } catch (_) {}

    // 2. Gather from in-memory userQuestionsStore
    try {
      const { loadUserQuestionsStore } = await import("./questionsStorage");
      const store = loadUserQuestionsStore();
      if (Array.isArray(store.customQuestions)) {
        collected.push(...store.customQuestions.filter(isValidQuestion));
      }
      if (Array.isArray(store.cloudCacheQuestions)) {
        collected.push(...store.cloudCacheQuestions.filter(isValidQuestion));
      }
    } catch (_) {}

    // 3. Gather from legacy IndexedDB cache if available
    try {
      const { getCachedCurriculum } = await import("./indexedDbCache");
      const cur = await getCachedCurriculum();
      if (cur) {
        if (Array.isArray(cur.questions)) collected.push(...cur.questions.filter(isValidQuestion));
        if (Array.isArray(cur.customQuestions)) collected.push(...cur.customQuestions.filter(isValidQuestion));
      }
    } catch (_) {}

    if (collected.length > 0) {
      const deduped = deduplicateQuestionsList(collected);
      await saveQuestionsToCache(deduped, { source: "initial" });
      console.log(`[QuestionBankCache] Pre-warmed IndexedDB cache with ${deduped.length} MCQs via localforage.`);
    }

    isCacheWarmed = true;
    const stats = await getQuestionBankCacheStats();
    return { totalQuestions: stats.totalQuestions, topicCount: stats.cachedTopicsCount };
  } catch (err) {
    console.warn("[QuestionBankCache] Pre-warming encountered error:", err);
    return { totalQuestions: 0, topicCount: 0 };
  } finally {
    isCacheWarming = false;
  }
}

/**
 * Returns diagnostic statistics about the localforage IndexedDB question bank
 */
export async function getQuestionBankCacheStats(): Promise<QuestionBankStats> {
  try {
    const all = await questionBankStore.getItem<Question[]>("bank:all_questions");
    const topicKeys = (await questionMetaStore.getItem<string[]>("index:topic_keys")) || [];
    const meta = await questionMetaStore.getItem<CacheMetadata>("meta:bank:all_questions");

    const totalQuestions = Array.isArray(all) ? all.length : 0;
    const cachedTopicsCount = topicKeys.length;
    const driver = questionBankStore.driver();

    return {
      totalQuestions,
      cachedTopicsCount,
      lastSyncTime: meta?.cachedAt || null,
      isOfflineReady: totalQuestions > 0,
      driver: driver || "unknown",
    };
  } catch {
    return {
      totalQuestions: 0,
      cachedTopicsCount: 0,
      lastSyncTime: null,
      isOfflineReady: false,
      driver: "error",
    };
  }
}

/**
 * Clears in-memory hot topic cache
 */
export function clearHotMemoryCache(): void {
  hotMemoryTopicCache.clear();
  isCacheWarmed = false;
}

/**
 * Removes deleted questions from hotMemoryTopicCache and IndexedDB localforage store
 */
export async function removeQuestionsFromCache(questionIds: string[], topicIds?: string[]): Promise<void> {
  if (!questionIds || questionIds.length === 0) return;
  const deleteSet = new Set(questionIds);

  // 1. Immediately purge in-memory hot cache
  hotMemoryTopicCache.clear();
  isCacheWarmed = false;

  // 2. Remove from IndexedDB questionBankStore
  try {
    const keys = await questionBankStore.keys();
    for (const key of keys) {
      const stored = await questionBankStore.getItem<Question[] | any>(key);
      if (Array.isArray(stored)) {
        const filtered = stored.filter(q => q && q.id && !deleteSet.has(q.id));
        if (filtered.length !== stored.length) {
          if (filtered.length === 0) {
            await questionBankStore.removeItem(key);
          } else {
            await questionBankStore.setItem(key, filtered);
          }
        }
      }
    }
  } catch (err) {
    console.warn("[QuestionBankCache] Notice removing questions from localforage cache:", err);
  }
}

/**
 * Clears question bank cache without affecting user progress, bookmarks, or tests
 */
export async function clearQuestionBankCache(): Promise<void> {
  hotMemoryTopicCache.clear();
  isCacheWarmed = false;
  await questionBankStore.clear();
  await questionMetaStore.clear();
  console.log("[QuestionBankCache] Question bank IndexedDB cache cleared.");
}
