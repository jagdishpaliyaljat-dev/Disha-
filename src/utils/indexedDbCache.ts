import type { Question, Subject, Chapter, Topic } from "../types";

const DB_NAME = "disha2020_persistent_cache_v1";
const LEGACY_DB_NAME = "quizpro_persistent_cache_v1";
const DB_VERSION = 2;

// Object Store Names
const STORE_BUNDLES = "question_bundles";
const STORE_CURRICULUM = "curriculum_cache";
const STORE_METADATA = "cache_metadata";
const STORE_STUDENT_BUFFER = "student_buffer_records";
const STORE_STUDENT_OUTBOX = "student_sync_outbox";

// Default TTL: 7 days (bundles stay cached on user's device for 1 week)
const DEFAULT_BUNDLE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export interface CachedBundleRecord {
  topicId: string;
  questions: Question[];
  questionCount: number;
  updatedAt: string;
  version?: number;
  contentHash?: string;
  cachedAt: number;
}

export interface CachedCurriculumRecord {
  id: string; // 'syllabus_tree'
  subjects: Subject[];
  chapters: Chapter[];
  topics: Topic[];
  questions?: Question[];
  customQuestions?: Question[];
  cachedAt: number;
}

let dbInstance: IDBDatabase | null = null;
let dbInitPromise: Promise<IDBDatabase | null> | null = null;

/**
 * Check if IndexedDB is supported in the current environment
 */
export function isIndexedDbSupported(): boolean {
  return typeof window !== "undefined" && typeof window.indexedDB !== "undefined";
}

/**
 * Opens and initializes the DISHA 20-20 IndexedDB persistent cache
 */
export async function getDisha2020DB(): Promise<IDBDatabase | null> {
  if (!isIndexedDbSupported()) return null;
  if (dbInstance) return dbInstance;
  if (dbInitPromise) return dbInitPromise;

  dbInitPromise = new Promise((resolve) => {
    try {
      const request = window.indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Store 1: Topic Question Bundles
        if (!db.objectStoreNames.contains(STORE_BUNDLES)) {
          const bundleStore = db.createObjectStore(STORE_BUNDLES, { keyPath: "topicId" });
          bundleStore.createIndex("by_cachedAt", "cachedAt", { unique: false });
        }

        // Store 2: Syllabus / Curriculum Tree
        if (!db.objectStoreNames.contains(STORE_CURRICULUM)) {
          db.createObjectStore(STORE_CURRICULUM, { keyPath: "id" });
        }

        // Store 3: General System Metadata
        if (!db.objectStoreNames.contains(STORE_METADATA)) {
          db.createObjectStore(STORE_METADATA, { keyPath: "key" });
        }

        // Store 4: Persistent Student Write Buffer Records (Phase 2)
        if (!db.objectStoreNames.contains(STORE_STUDENT_BUFFER)) {
          db.createObjectStore(STORE_STUDENT_BUFFER, { keyPath: "key" });
        }

        // Store 5: Durable Student Sync Outbox for Crash Recovery (Phase 2)
        if (!db.objectStoreNames.contains(STORE_STUDENT_OUTBOX)) {
          const outboxStore = db.createObjectStore(STORE_STUDENT_OUTBOX, { keyPath: "opId" });
          outboxStore.createIndex("by_status", "status", { unique: false });
          outboxStore.createIndex("by_createdAt", "createdAt", { unique: false });
        }
      };

      request.onsuccess = (event: Event) => {
        dbInstance = (event.target as IDBOpenDBRequest).result;
        
        // Handle unexpected closes / version upgrades
        dbInstance.onversionchange = () => {
          dbInstance?.close();
          dbInstance = null;
          dbInitPromise = null;
        };

        // Backward compatibility migration from legacy QuizPro cache
        if (typeof window !== "undefined" && window.indexedDB && !localStorage.getItem("disha2020_cache_migrated_v1")) {
          try {
            const legReq = window.indexedDB.open(LEGACY_DB_NAME);
            legReq.onsuccess = async () => {
              const legDb = legReq.result;
              const stores = Array.from(legDb.objectStoreNames);
              for (const s of stores) {
                if (!dbInstance?.objectStoreNames.contains(s)) continue;
                try {
                  const rTx = legDb.transaction(s, "readonly");
                  const items = await new Promise<any[]>((res) => {
                    const req = rTx.objectStore(s).getAll();
                    req.onsuccess = () => res(req.result || []);
                    req.onerror = () => res([]);
                  });
                  if (items && items.length > 0 && dbInstance) {
                    const wTx = dbInstance.transaction(s, "readwrite");
                    for (const it of items) wTx.objectStore(s).put(it);
                  }
                } catch (_) {}
              }
              legDb.close();
              localStorage.setItem("disha2020_cache_migrated_v1", "true");
            };
            legReq.onerror = () => {
              localStorage.setItem("disha2020_cache_migrated_v1", "skipped");
            };
          } catch (_) {
            localStorage.setItem("disha2020_cache_migrated_v1", "failed");
          }
        }

        resolve(dbInstance);
      };

      request.onerror = (event: Event) => {
        console.warn("[IndexedDB] Failed to open DISHA 20-20 cache database:", (event.target as IDBOpenDBRequest).error);
        resolve(null);
      };
    } catch (err) {
      console.warn("[IndexedDB] Exception opening IndexedDB:", err);
      resolve(null);
    }
  });

  return dbInitPromise;
}

/**
 * Backward compatibility alias for QuizPro
 */
export const getQuizProDB = getDisha2020DB;

/**
 * Get Question Bundle with its metadata from IndexedDB
 */
export async function getCachedQuestionBundleMetadata(topicId: string): Promise<CachedBundleRecord | null> {
  if (!topicId) return null;
  const db = await getQuizProDB();
  if (!db) return null;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_BUNDLES, "readonly");
      const store = tx.objectStore(STORE_BUNDLES);
      const request = store.get(topicId);

      request.onsuccess = () => {
        const record = request.result as CachedBundleRecord | undefined;
        resolve(record || null);
      };

      request.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

/**
 * Get Question Bundle from IndexedDB
 * Returns cached questions if valid and not expired, or null
 */
export async function getCachedQuestionBundle(topicId: string, maxAgeMs = DEFAULT_BUNDLE_TTL_MS): Promise<Question[] | null> {
  if (!topicId) return null;
  const db = await getQuizProDB();
  if (!db) return null;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_BUNDLES, "readonly");
      const store = tx.objectStore(STORE_BUNDLES);
      const request = store.get(topicId);

      request.onsuccess = () => {
        const record = request.result as CachedBundleRecord | undefined;
        if (!record || !Array.isArray(record.questions) || record.questions.length === 0) {
          resolve(null);
          return;
        }

        // Check expiration
        const age = Date.now() - (record.cachedAt || 0);
        if (age > maxAgeMs) {
          // Stale cache
          resolve(null);
          return;
        }

        resolve(record.questions);
      };

      request.onerror = () => {
        resolve(null);
      };
    } catch {
      resolve(null);
    }
  });
}

/**
 * Get all cached Question Bundles from IndexedDB (0 Firestore reads)
 */
export async function getAllCachedBundles(): Promise<CachedBundleRecord[]> {
  const db = await getQuizProDB();
  if (!db) return [];

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_BUNDLES, "readonly");
      const store = tx.objectStore(STORE_BUNDLES);
      const request = store.getAll();

      request.onsuccess = () => {
        const records = Array.isArray(request.result) ? (request.result as CachedBundleRecord[]) : [];
        resolve(records);
      };

      request.onerror = () => resolve([]);
    } catch {
      resolve([]);
    }
  });
}

/**
 * Save / Update Question Bundle into IndexedDB
 */
export async function saveCachedQuestionBundle(
  topicId: string, 
  questions: Question[], 
  updatedAt?: string,
  version?: number,
  contentHash?: string
): Promise<void> {
  if (!topicId || !questions || !questions.length) return;
  const db = await getQuizProDB();
  if (!db) return;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_BUNDLES, "readwrite");
      const store = tx.objectStore(STORE_BUNDLES);
      
      const record: CachedBundleRecord = {
        topicId,
        questions,
        questionCount: questions.length,
        updatedAt: updatedAt || new Date().toISOString(),
        version: version,
        contentHash,
        cachedAt: Date.now()
      };

      store.put(record);

      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve(); // graceful non-fatal
    } catch {
      resolve();
    }
  });
}

/**
 * Delete a specific Question Bundle from IndexedDB
 */
export async function deleteCachedQuestionBundle(topicId: string): Promise<void> {
  if (!topicId) return;
  const db = await getQuizProDB();
  if (!db) return;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_BUNDLES, "readwrite");
      tx.objectStore(STORE_BUNDLES).delete(topicId);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

/**
 * Clear all Question Bundles from IndexedDB
 */
export async function clearAllCachedBundles(): Promise<void> {
  const db = await getQuizProDB();
  if (!db) return;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction([STORE_BUNDLES, STORE_CURRICULUM], "readwrite");
      tx.objectStore(STORE_BUNDLES).clear();
      tx.objectStore(STORE_CURRICULUM).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

/**
 * Get Cached Curriculum (Subjects, Chapters, Topics)
 */
export async function getCachedCurriculum(maxAgeMs = DEFAULT_BUNDLE_TTL_MS): Promise<CachedCurriculumRecord | null> {
  const db = await getQuizProDB();
  if (!db) return null;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_CURRICULUM, "readonly");
      const request = tx.objectStore(STORE_CURRICULUM).get("syllabus_tree");

      request.onsuccess = () => {
        const record = request.result as CachedCurriculumRecord | undefined;
        if (
          !record ||
          typeof record !== "object" ||
          !Array.isArray(record.subjects) ||
          !Array.isArray(record.chapters) ||
          !Array.isArray(record.topics) ||
          (record.questions !== undefined && !Array.isArray(record.questions))
        ) {
          resolve(null);
          return;
        }

        const age = Date.now() - (record.cachedAt || 0);
        if (age > maxAgeMs) {
          resolve(null);
          return;
        }

        resolve(record);
      };

      request.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

/**
 * Save Cached Curriculum (and full MCQ bank) into IndexedDB
 */
export async function saveCachedCurriculum(
  subjects: Subject[], 
  chapters: Chapter[], 
  topics: Topic[],
  questions?: Question[],
  customQuestions?: Question[]
): Promise<void> {
  const db = await getQuizProDB();
  if (!db) return;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_CURRICULUM, "readwrite");
      const store = tx.objectStore(STORE_CURRICULUM);
      const getReq = store.get("syllabus_tree");
      getReq.onsuccess = () => {
        const existing = getReq.result as CachedCurriculumRecord | undefined;
        const record: CachedCurriculumRecord = {
          id: "syllabus_tree",
          subjects: subjects || existing?.subjects || [],
          chapters: chapters || existing?.chapters || [],
          topics: topics || existing?.topics || [],
          questions: questions !== undefined ? questions : (existing?.questions || []),
          customQuestions: customQuestions !== undefined ? customQuestions : (existing?.customQuestions || []),
          cachedAt: Date.now()
        };
        store.put(record);
      };
      getReq.onerror = () => {
        const record: CachedCurriculumRecord = {
          id: "syllabus_tree",
          subjects: subjects || [],
          chapters: chapters || [],
          topics: topics || [],
          questions: questions || [],
          customQuestions: customQuestions || [],
          cachedAt: Date.now()
        };
        store.put(record);
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

/**
 * Get IndexedDB Cache Statistics (Number of bundles, total questions, estimated KB)
 */
export async function getIndexedDbUsageStats(): Promise<{
  supported: boolean;
  bundleCount: number;
  totalQuestions: number;
  estimatedSizeKb: number;
  hasCurriculum: boolean;
  lastCachedAt: string | null;
}> {
  if (!isIndexedDbSupported()) {
    return {
      supported: false,
      bundleCount: 0,
      totalQuestions: 0,
      estimatedSizeKb: 0,
      hasCurriculum: false,
      lastCachedAt: null
    };
  }

  const db = await getQuizProDB();
  if (!db) {
    return {
      supported: false,
      bundleCount: 0,
      totalQuestions: 0,
      estimatedSizeKb: 0,
      hasCurriculum: false,
      lastCachedAt: null
    };
  }

  return new Promise((resolve) => {
    try {
      const tx = db.transaction([STORE_BUNDLES, STORE_CURRICULUM], "readonly");
      const bundleStore = tx.objectStore(STORE_BUNDLES);
      const curriculumStore = tx.objectStore(STORE_CURRICULUM);

      let bundleCount = 0;
      const seenQuestionIds = new Set<string>();
      let bundleQuestionsFallback = 0;
      let approxBytes = 0;
      let latestCachedAt = 0;

      const cursorReq = bundleStore.openCursor();
      cursorReq.onsuccess = (e) => {
        const cursor = (e.target as IDBRequest).result as IDBCursorWithValue | null;
        if (cursor) {
          bundleCount++;
          const val = cursor.value as CachedBundleRecord;
          if (val) {
            if (Array.isArray(val.questions)) {
              val.questions.forEach((q) => {
                if (q && q.id) seenQuestionIds.add(q.id);
              });
            } else {
              bundleQuestionsFallback += val.questionCount || 0;
            }
            if (val.cachedAt > latestCachedAt) latestCachedAt = val.cachedAt;
            approxBytes += JSON.stringify(val).length * 2;
          }
          cursor.continue();
        } else {
          // Check curriculum (syllabus_tree)
          const curReq = curriculumStore.get("syllabus_tree");
          curReq.onsuccess = () => {
            const curRec = curReq.result as CachedCurriculumRecord | undefined;
            const hasCurriculum = Boolean(curRec);
            if (curRec) {
              if (Array.isArray(curRec.questions)) {
                curRec.questions.forEach((q) => {
                  if (q && q.id) seenQuestionIds.add(q.id);
                });
              }
              if (Array.isArray(curRec.customQuestions)) {
                curRec.customQuestions.forEach((q) => {
                  if (q && q.id) seenQuestionIds.add(q.id);
                });
              }
              if (curRec.cachedAt && curRec.cachedAt > latestCachedAt) {
                latestCachedAt = curRec.cachedAt;
              }
              approxBytes += JSON.stringify(curRec).length * 2;
            }
            const totalQuestions = Math.max(seenQuestionIds.size, bundleQuestionsFallback);
            resolve({
              supported: true,
              bundleCount,
              totalQuestions,
              estimatedSizeKb: Math.round(approxBytes / 1024),
              hasCurriculum,
              lastCachedAt: latestCachedAt > 0 ? new Date(latestCachedAt).toLocaleTimeString() : null
            });
          };
          curReq.onerror = () => {
            resolve({
              supported: true,
              bundleCount,
              totalQuestions: Math.max(seenQuestionIds.size, bundleQuestionsFallback),
              estimatedSizeKb: Math.round(approxBytes / 1024),
              hasCurriculum: false,
              lastCachedAt: latestCachedAt > 0 ? new Date(latestCachedAt).toLocaleTimeString() : null
            });
          };
        }
      };

      cursorReq.onerror = () => {
        resolve({
          supported: true,
          bundleCount: 0,
          totalQuestions: 0,
          estimatedSizeKb: 0,
          hasCurriculum: false,
          lastCachedAt: null
        });
      };
    } catch {
      resolve({
        supported: true,
        bundleCount: 0,
        totalQuestions: 0,
        estimatedSizeKb: 0,
        hasCurriculum: false,
        lastCachedAt: null
      });
    }
  });
}

/**
 * Get item from IndexedDB metadata store
 */
export async function getLocalMetadata<T = any>(key: string): Promise<T | null> {
  const db = await getQuizProDB();
  if (!db) {
    if (typeof localStorage !== "undefined") {
      const v = localStorage.getItem(`quizpro_meta_${key}`);
      try {
        return v ? JSON.parse(v) : null;
      } catch {
        return null;
      }
    }
    return null;
  }

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_METADATA, "readonly");
      const req = tx.objectStore(STORE_METADATA).get(key);
      req.onsuccess = () => {
        const res = req.result;
        resolve(res ? res.value : null);
      };
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

/**
 * Save item into IndexedDB metadata store
 */
export async function setLocalMetadata(key: string, value: any): Promise<void> {
  if (typeof localStorage !== "undefined") {
    try {
      localStorage.setItem(`quizpro_meta_${key}`, JSON.stringify(value));
    } catch {}
  }

  const db = await getQuizProDB();
  if (!db) return;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_METADATA, "readwrite");
      tx.objectStore(STORE_METADATA).put({ key, value, updatedAt: Date.now() });
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}
/**
 * Clears all QuizPro IndexedDB caches
 */
export async function clearIndexedDB(): Promise<void> {
  if (!isIndexedDbSupported()) return;
  try {
    const request = window.indexedDB.deleteDatabase(DB_NAME);
    request.onsuccess = () => {
      console.log("[IndexedDB] Cache cleared successfully.");
      dbInstance = null;
      dbInitPromise = null;
    };
    request.onerror = (e) => console.error("[IndexedDB] Error clearing cache:", e);
  } catch (err) {
    console.error("[IndexedDB] Exception clearing cache:", err);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PHASE 2: PERSISTENT STUDENT BUFFER & SYNC OUTBOX INDEXEDDB HELPERS
// ─────────────────────────────────────────────────────────────────────────────

export async function idbGetStudentBufferRecord<T = any>(key: string): Promise<T | null> {
  const db = await getQuizProDB();
  if (!db) return null;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_STUDENT_BUFFER, "readonly");
      const req = tx.objectStore(STORE_STUDENT_BUFFER).get(key);
      req.onsuccess = () => {
        const res = req.result;
        resolve(res ? (res.value as T) : null);
      };
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function idbSetStudentBufferRecord<T = any>(key: string, value: T): Promise<void> {
  const db = await getQuizProDB();
  if (!db) return;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_STUDENT_BUFFER, "readwrite");
      tx.objectStore(STORE_STUDENT_BUFFER).put({ key, value, updatedAt: Date.now() });
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

export async function idbPutOutboxItem<T = any>(item: T): Promise<void> {
  const db = await getQuizProDB();
  if (!db) return;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_STUDENT_OUTBOX, "readwrite");
      tx.objectStore(STORE_STUDENT_OUTBOX).put(item);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

export async function idbGetAllOutboxItems<T = any>(): Promise<T[]> {
  const db = await getQuizProDB();
  if (!db) return [];

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_STUDENT_OUTBOX, "readonly");
      const req = tx.objectStore(STORE_STUDENT_OUTBOX).getAll();
      req.onsuccess = () => {
        resolve(Array.isArray(req.result) ? (req.result as T[]) : []);
      };
      req.onerror = () => resolve([]);
    } catch {
      resolve([]);
    }
  });
}

export async function idbDeleteOutboxItem(opId: string): Promise<void> {
  const db = await getQuizProDB();
  if (!db) return;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_STUDENT_OUTBOX, "readwrite");
      tx.objectStore(STORE_STUDENT_OUTBOX).delete(opId);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

export async function idbClearStudentBufferStores(): Promise<void> {
  const db = await getQuizProDB();
  if (!db) return;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction([STORE_STUDENT_BUFFER, STORE_STUDENT_OUTBOX], "readwrite");
      tx.objectStore(STORE_STUDENT_BUFFER).clear();
      tx.objectStore(STORE_STUDENT_OUTBOX).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

