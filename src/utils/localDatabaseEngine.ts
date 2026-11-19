import type { 
  Question, 
  Subject, 
  Chapter, 
  Topic, 
  PYQPaper, 
  QuestionProgress, 
  DailyStudyHistory, 
  ProgressStore,
  QuestionAttemptRecord,
  SmartTestRecord 
} from "../types";

/**
 * DISHA 20-20 - Local-First Unified IndexedDB Database Engine (v1)
 * 
 * Implements strict offline-first repositories for all learning activities and curriculum content:
 * 1. 17 IndexedDB stores with primary keys and query indexes.
 * 2. Unified Question & Curriculum Repository (Zero cloud reads during normal operation).
 * 3. Student Activity Repositories (Attempts, Wrong, Bookmarks, Test Results, Revision, Study Logs, Syllabus).
 * 4. Durable Outbox Sync Queue (Append-only, idempotent, crash-resilient).
 * 5. Sync Staging Store for atomic bootstrap and incremental updates.
 * 6. Safe Migration Engine from legacy localStorage & QuizPro into IndexedDB.
 */

export const LOCAL_DB_NAME = "disha2020-db-v1";
export const LEGACY_DB_NAME = "quizpro-db-v4";
export const LOCAL_DB_VERSION = 1;

// 17 Unified Stores
export const STORES = {
  SUBJECTS: "subjects",
  CHAPTERS: "chapters",
  TOPICS: "topics",
  MCQS: "mcqs",
  PYQS: "pyqs",
  EXAMS: "exams",
  CURRICULUM_METADATA: "curriculum_metadata",
  USER_ATTEMPTS: "user_attempts",
  WRONG_QUESTIONS: "wrong_questions",
  BOOKMARKS: "bookmarks",
  TEST_RESULTS: "test_results",
  REVISION_HISTORY: "revision_history",
  STUDY_LOGS: "study_logs",
  SYLLABUS_PROGRESS: "syllabus_progress",
  SYNC_QUEUE: "sync_queue",
  SYNC_METADATA: "sync_metadata",
  SYNC_STAGING: "sync_staging",
} as const;

export type StoreName = typeof STORES[keyof typeof STORES];

// Core Event & Record Interfaces
export interface SyncQueueEvent {
  eventId: string;
  userId: string;
  eventType: 
    | "attempt" 
    | "wrong_question" 
    | "bookmark" 
    | "test_result" 
    | "revision" 
    | "study_log" 
    | "syllabus_progress"
    | "settings"
    | "curriculum_topic";
  entityId: string;
  operation: "upsert" | "delete" | "append";
  payload: any;
  clientTimestamp: number;
  syncStatus: "pending" | "in_flight" | "synced" | "failed";
  retryCount: number;
  lastErrorCode?: string;
  lastErrorMessage?: string;
  sessionBatchId?: string;
}

export interface LocalBookmarkRecord {
  questionId: string;
  userId: string;
  bookmarked: boolean;
  createdAt: number;
  updatedAt: number;
  syncStatus: "pending" | "synced";
}

export interface LocalWrongQuestionRecord {
  questionId: string;
  userId: string;
  subjectId?: string;
  chapterId?: string;
  topicId?: string;
  wrongCount: number;
  lastWrongAt: number;
  reviewStatus: "needs_review" | "reviewed" | "mastered";
  lastSelectedOption?: number;
  correctIndex?: number;
  syncStatus: "pending" | "synced";
}

export interface LocalRevisionRecord {
  recordId: string; // `${userId}_${questionId}`
  questionId: string;
  userId: string;
  stage: number; // 0..4
  nextReviewAt: string; // YYYY-MM-DD
  lastAnsweredAt: string;
  wrongCount: number;
  status: "unattempted" | "correct" | "wrong";
  updatedAt: number;
  syncStatus: "pending" | "synced";
}

export interface LocalStudyLogRecord {
  sessionId: string;
  userId: string;
  date: string; // YYYY-MM-DD
  subjectId?: string;
  topicId?: string;
  durationMinutes: number;
  timestamp: number;
  syncStatus: "pending" | "synced";
}

export interface LocalSyllabusProgressRecord {
  entityId: string; // topicId or chapterId
  userId: string;
  type: "topic" | "chapter";
  subjectId?: string;
  chapterId?: string;
  completed: boolean;
  completedAt?: number;
  totalQuestions?: number;
  attemptedQuestions?: number;
  accuracy?: number;
  updatedAt: number;
  syncStatus: "pending" | "synced";
}

export interface SyncStagingItem {
  stagingId: string;
  batchId: string;
  entityType: StoreName;
  recordId: string;
  data: any;
  action: "upsert" | "delete";
  createdAt: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// DATABASE INITIALIZATION & SINGLETON CONNECTION
// ─────────────────────────────────────────────────────────────────────────────

let dbInstance: IDBDatabase | null = null;
let dbOpeningPromise: Promise<IDBDatabase | null> | null = null;

export function isIndexedDbAvailable(): boolean {
  return typeof window !== "undefined" && typeof window.indexedDB !== "undefined";
}

export async function openLocalDatabase(): Promise<IDBDatabase | null> {
  if (!isIndexedDbAvailable()) return null;
  if (dbInstance) return dbInstance;
  if (dbOpeningPromise) return dbOpeningPromise;

  dbOpeningPromise = new Promise((resolve) => {
    try {
      const request = window.indexedDB.open(LOCAL_DB_NAME, LOCAL_DB_VERSION);

      request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // 1. subjects
        if (!db.objectStoreNames.contains(STORES.SUBJECTS)) {
          const s = db.createObjectStore(STORES.SUBJECTS, { keyPath: "id" });
          s.createIndex("by_order", "order", { unique: false });
          s.createIndex("by_updatedAt", "updatedAt", { unique: false });
        }

        // 2. chapters
        if (!db.objectStoreNames.contains(STORES.CHAPTERS)) {
          const s = db.createObjectStore(STORES.CHAPTERS, { keyPath: "id" });
          s.createIndex("by_subjectId", "subjectId", { unique: false });
          s.createIndex("by_order", "order", { unique: false });
        }

        // 3. topics
        if (!db.objectStoreNames.contains(STORES.TOPICS)) {
          const s = db.createObjectStore(STORES.TOPICS, { keyPath: "id" });
          s.createIndex("by_chapterId", "chapterId", { unique: false });
          s.createIndex("by_subjectId", "subjectId", { unique: false });
        }

        // 4. mcqs
        if (!db.objectStoreNames.contains(STORES.MCQS)) {
          const s = db.createObjectStore(STORES.MCQS, { keyPath: "id" });
          s.createIndex("by_topicId", "topicId", { unique: false });
          s.createIndex("by_chapterId", "chapterId", { unique: false });
          s.createIndex("by_subjectId", "subjectId", { unique: false });
          s.createIndex("by_paperId", "paperId", { unique: false });
          s.createIndex("by_updatedAt", "updatedAt", { unique: false });
        }

        // 5. pyqs
        if (!db.objectStoreNames.contains(STORES.PYQS)) {
          const s = db.createObjectStore(STORES.PYQS, { keyPath: "id" });
          s.createIndex("by_examCategory", "examCategory", { unique: false });
          s.createIndex("by_paperYear", "paperYear", { unique: false });
        }

        // 6. exams
        if (!db.objectStoreNames.contains(STORES.EXAMS)) {
          const s = db.createObjectStore(STORES.EXAMS, { keyPath: "id" });
          s.createIndex("by_order", "order", { unique: false });
        }

        // 7. curriculum_metadata
        if (!db.objectStoreNames.contains(STORES.CURRICULUM_METADATA)) {
          db.createObjectStore(STORES.CURRICULUM_METADATA, { keyPath: "key" });
        }

        // 8. user_attempts
        if (!db.objectStoreNames.contains(STORES.USER_ATTEMPTS)) {
          const s = db.createObjectStore(STORES.USER_ATTEMPTS, { keyPath: "attemptId" });
          s.createIndex("by_questionId", "questionId", { unique: false });
          s.createIndex("by_userId", "userId", { unique: false });
          s.createIndex("by_topicId", "topicId", { unique: false });
          s.createIndex("by_timestamp", "attemptedAt", { unique: false });
          s.createIndex("by_syncStatus", "syncStatus", { unique: false });
        }

        // 9. wrong_questions
        if (!db.objectStoreNames.contains(STORES.WRONG_QUESTIONS)) {
          const s = db.createObjectStore(STORES.WRONG_QUESTIONS, { keyPath: "questionId" });
          s.createIndex("by_userId", "userId", { unique: false });
          s.createIndex("by_topicId", "topicId", { unique: false });
          s.createIndex("by_reviewStatus", "reviewStatus", { unique: false });
        }

        // 10. bookmarks
        if (!db.objectStoreNames.contains(STORES.BOOKMARKS)) {
          const s = db.createObjectStore(STORES.BOOKMARKS, { keyPath: "questionId" });
          s.createIndex("by_userId", "userId", { unique: false });
          s.createIndex("by_syncStatus", "syncStatus", { unique: false });
        }

        // 11. test_results
        if (!db.objectStoreNames.contains(STORES.TEST_RESULTS)) {
          const s = db.createObjectStore(STORES.TEST_RESULTS, { keyPath: "testId" });
          s.createIndex("by_userId", "userId", { unique: false });
          s.createIndex("by_createdAt", "createdAt", { unique: false });
        }

        // 12. revision_history
        if (!db.objectStoreNames.contains(STORES.REVISION_HISTORY)) {
          const s = db.createObjectStore(STORES.REVISION_HISTORY, { keyPath: "recordId" });
          s.createIndex("by_userId", "userId", { unique: false });
          s.createIndex("by_questionId", "questionId", { unique: false });
          s.createIndex("by_nextReviewAt", "nextReviewAt", { unique: false });
        }

        // 13. study_logs
        if (!db.objectStoreNames.contains(STORES.STUDY_LOGS)) {
          const s = db.createObjectStore(STORES.STUDY_LOGS, { keyPath: "sessionId" });
          s.createIndex("by_userId", "userId", { unique: false });
          s.createIndex("by_date", "date", { unique: false });
        }

        // 14. syllabus_progress
        if (!db.objectStoreNames.contains(STORES.SYLLABUS_PROGRESS)) {
          const s = db.createObjectStore(STORES.SYLLABUS_PROGRESS, { keyPath: "entityId" });
          s.createIndex("by_userId", "userId", { unique: false });
          s.createIndex("by_subjectId", "subjectId", { unique: false });
        }

        // 15. sync_queue
        if (!db.objectStoreNames.contains(STORES.SYNC_QUEUE)) {
          const s = db.createObjectStore(STORES.SYNC_QUEUE, { keyPath: "eventId" });
          s.createIndex("by_syncStatus", "syncStatus", { unique: false });
          s.createIndex("by_timestamp", "clientTimestamp", { unique: false });
          s.createIndex("by_userId", "userId", { unique: false });
        }

        // 16. sync_metadata
        if (!db.objectStoreNames.contains(STORES.SYNC_METADATA)) {
          db.createObjectStore(STORES.SYNC_METADATA, { keyPath: "key" });
        }

        // 17. sync_staging
        if (!db.objectStoreNames.contains(STORES.SYNC_STAGING)) {
          const s = db.createObjectStore(STORES.SYNC_STAGING, { keyPath: "stagingId" });
          s.createIndex("by_batchId", "batchId", { unique: false });
          s.createIndex("by_entityType", "entityType", { unique: false });
        }
      };

      request.onsuccess = (event: Event) => {
        dbInstance = (event.target as IDBOpenDBRequest).result;
        dbInstance.onversionchange = () => {
          dbInstance?.close();
          dbInstance = null;
          dbOpeningPromise = null;
        };
        // Migrate legacy QuizPro database if present
        migrateFromLegacyQuizProDB(dbInstance).catch(() => {});
        resolve(dbInstance);
      };

      request.onerror = (event: Event) => {
        console.warn("[LocalDB] Error opening IndexedDB:", (event.target as IDBOpenDBRequest).error);
        resolve(null);
      };
    } catch (err) {
      console.warn("[LocalDB] Exception opening IndexedDB:", err);
      resolve(null);
    }
  });

  return dbOpeningPromise;
}

/**
 * Backward-compatible migration bridge:
 * Migrates existing data from legacy quizpro-db-v4 into disha2020-db-v1
 */
async function migrateFromLegacyQuizProDB(targetDb: IDBDatabase): Promise<void> {
  if (typeof window === "undefined" || !window.indexedDB) return;
  if (localStorage.getItem("disha2020_idb_migrated_v4")) return;

  try {
    const legacyReq = window.indexedDB.open(LEGACY_DB_NAME);
    legacyReq.onerror = () => {
      localStorage.setItem("disha2020_idb_migrated_v4", "skipped");
    };
    legacyReq.onsuccess = async () => {
      const legacyDb = legacyReq.result;
      const storeNames = Array.from(legacyDb.objectStoreNames);
      if (storeNames.length === 0) {
        legacyDb.close();
        localStorage.setItem("disha2020_idb_migrated_v4", "true");
        return;
      }

      console.info(`[LocalDB] Migrating ${storeNames.length} stores from ${LEGACY_DB_NAME} to ${LOCAL_DB_NAME}...`);
      for (const storeName of storeNames) {
        if (!targetDb.objectStoreNames.contains(storeName)) continue;
        try {
          const readTx = legacyDb.transaction(storeName, "readonly");
          const readStore = readTx.objectStore(storeName);
          const allItems = await new Promise<any[]>((res) => {
            const getReq = readStore.getAll();
            getReq.onsuccess = () => res(getReq.result || []);
            getReq.onerror = () => res([]);
          });

          if (allItems && allItems.length > 0) {
            const writeTx = targetDb.transaction(storeName, "readwrite");
            const writeStore = writeTx.objectStore(storeName);
            for (const item of allItems) {
              writeStore.put(item);
            }
          }
        } catch (_) {}
      }
      legacyDb.close();
      localStorage.setItem("disha2020_idb_migrated_v4", "true");
      console.info(`[LocalDB] Legacy migration from ${LEGACY_DB_NAME} completed successfully.`);
    };
  } catch (_) {
    localStorage.setItem("disha2020_idb_migrated_v4", "failed");
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// GENERIC INDEXEDDB TRANSACTION HELPERS (WITH IN-MEMORY FALLBACK)
// ─────────────────────────────────────────────────────────────────────────────

const memoryStores: Record<string, Map<any, any>> = {};

function getMemoryStore(storeName: string): Map<any, any> {
  if (!memoryStores[storeName]) {
    memoryStores[storeName] = new Map();
  }
  return memoryStores[storeName];
}

function extractKey(val: any): any {
  if (!val || typeof val !== "object") return undefined;
  return val.id ?? val.key ?? val.eventId ?? val.sessionId ?? val.entityId ?? val.examId;
}

export async function idbGet<T = any>(storeName: StoreName, key: IDBValidKey): Promise<T | null> {
  const db = await openLocalDatabase();
  if (!db) {
    const memVal = getMemoryStore(storeName).get(key);
    return memVal ? (memVal as T) : null;
  }

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(storeName, "readonly");
      const req = tx.objectStore(storeName).get(key);
      req.onsuccess = () => resolve(req.result ? (req.result as T) : null);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function idbGetAll<T = any>(storeName: StoreName, query?: IDBValidKey | IDBKeyRange, count?: number): Promise<T[]> {
  const db = await openLocalDatabase();
  if (!db) {
    const list = Array.from(getMemoryStore(storeName).values()) as T[];
    return typeof count === "number" ? list.slice(0, count) : list;
  }

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(storeName, "readonly");
      const req = tx.objectStore(storeName).getAll(query, count);
      req.onsuccess = () => resolve(Array.isArray(req.result) ? (req.result as T[]) : []);
      req.onerror = () => resolve([]);
    } catch {
      resolve([]);
    }
  });
}

export async function idbPut<T = any>(storeName: StoreName, value: T): Promise<void> {
  const db = await openLocalDatabase();
  if (!db) {
    const k = extractKey(value);
    if (k !== undefined) {
      getMemoryStore(storeName).set(k, value);
    }
    return;
  }

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(storeName, "readwrite");
      tx.objectStore(storeName).put(value);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

export async function idbPutBatch<T = any>(storeName: StoreName, values: T[]): Promise<void> {
  if (!values || values.length === 0) return;
  const db = await openLocalDatabase();
  if (!db) {
    const store = getMemoryStore(storeName);
    for (const val of values) {
      const k = extractKey(val);
      if (k !== undefined) {
        store.set(k, val);
      }
    }
    return;
  }

  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction(storeName, "readwrite");
      const store = tx.objectStore(storeName);
      for (const val of values) {
        store.put(val);
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    } catch (err) {
      reject(err);
    }
  });
}

export async function idbDelete(storeName: StoreName, key: IDBValidKey): Promise<void> {
  const db = await openLocalDatabase();
  if (!db) {
    getMemoryStore(storeName).delete(key);
    return;
  }

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(storeName, "readwrite");
      tx.objectStore(storeName).delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

export async function idbDeleteBatch(storeName: StoreName, keys: IDBValidKey[]): Promise<void> {
  if (!keys || keys.length === 0) return;
  const db = await openLocalDatabase();
  if (!db) {
    const mem = getMemoryStore(storeName);
    for (const key of keys) {
      mem.delete(key);
    }
    return;
  }

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(storeName, "readwrite");
      const store = tx.objectStore(storeName);
      for (const key of keys) {
        store.delete(key);
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

export async function idbClear(storeName: StoreName): Promise<void> {
  const db = await openLocalDatabase();
  if (!db) {
    getMemoryStore(storeName).clear();
    return;
  }

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(storeName, "readwrite");
      tx.objectStore(storeName).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

export async function idbCount(storeName: StoreName): Promise<number> {
  const db = await openLocalDatabase();
  if (!db) {
    return getMemoryStore(storeName).size;
  }

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(storeName, "readonly");
      const req = tx.objectStore(storeName).count();
      req.onsuccess = () => resolve(req.result || 0);
      req.onerror = () => resolve(0);
    } catch {
      resolve(0);
    }
  });
}

export async function idbGetByIndex<T = any>(
  storeName: StoreName, 
  indexName: string, 
  key: IDBValidKey | IDBKeyRange
): Promise<T[]> {
  const db = await openLocalDatabase();
  if (!db) return [];

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(storeName, "readonly");
      const index = tx.objectStore(storeName).index(indexName);
      const req = index.getAll(key);
      req.onsuccess = () => resolve(Array.isArray(req.result) ? (req.result as T[]) : []);
      req.onerror = () => resolve([]);
    } catch {
      resolve([]);
    }
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// UNIFIED QUESTION & CURRICULUM REPOSITORY (LOCAL-FIRST)
// ─────────────────────────────────────────────────────────────────────────────

export async function getLocalMCQById(questionId: string): Promise<Question | null> {
  return idbGet<Question>(STORES.MCQS, questionId);
}

export async function getLocalMCQsByTopic(topicId: string): Promise<Question[]> {
  const direct = await idbGetByIndex<Question>(STORES.MCQS, "by_topicId", topicId);
  if (direct.length > 0) return direct;

  // Fallback: Check lowercase or normalized ID
  const all = await idbGetAll<Question>(STORES.MCQS);
  const tIdLower = (topicId || "").toLowerCase();
  return all.filter(q => 
    (q.topicId && q.topicId.toLowerCase() === tIdLower) ||
    ((q as any).topic && String((q as any).topic).toLowerCase() === tIdLower)
  );
}

export async function getLocalMCQsByChapter(chapterId: string): Promise<Question[]> {
  const direct = await idbGetByIndex<Question>(STORES.MCQS, "by_chapterId", chapterId);
  if (direct.length > 0) return direct;

  const all = await idbGetAll<Question>(STORES.MCQS);
  const chLower = (chapterId || "").toLowerCase();
  return all.filter(q => q.chapterId && q.chapterId.toLowerCase() === chLower);
}

export async function getLocalMCQsByPaper(paperId: string): Promise<Question[]> {
  return idbGetByIndex<Question>(STORES.MCQS, "by_paperId", paperId);
}

export async function getAllLocalMCQs(): Promise<Question[]> {
  return idbGetAll<Question>(STORES.MCQS);
}

export async function saveLocalMCQs(mcqs: Question[]): Promise<void> {
  const valid = (mcqs || []).filter(q => q && q.id && (q.text || (q as any).question));
  await idbPutBatch(STORES.MCQS, valid);
}

export async function countLocalMCQs(): Promise<number> {
  return idbCount(STORES.MCQS);
}

export async function deleteLocalMCQs(questionIds: string[]): Promise<void> {
  if (!questionIds || questionIds.length === 0) return;
  const db = await openLocalDatabase();
  if (!db) return;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORES.MCQS, "readwrite");
      const store = tx.objectStore(STORES.MCQS);
      for (const id of questionIds) {
        store.delete(id);
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

// Curriculum Entities
export async function getLocalSubjects(): Promise<Subject[]> {
  const list = await idbGetAll<Subject>(STORES.SUBJECTS);
  return list.sort((a, b) => (a.order || 0) - (b.order || 0));
}

export async function saveLocalSubjects(subjects: Subject[]): Promise<void> {
  await idbPutBatch(STORES.SUBJECTS, subjects);
}

export async function getLocalChapters(subjectId?: string): Promise<Chapter[]> {
  if (subjectId) {
    return idbGetByIndex<Chapter>(STORES.CHAPTERS, "by_subjectId", subjectId);
  }
  const list = await idbGetAll<Chapter>(STORES.CHAPTERS);
  return list.sort((a, b) => (a.number || 0) - (b.number || 0));
}

export async function saveLocalChapters(chapters: Chapter[]): Promise<void> {
  await idbPutBatch(STORES.CHAPTERS, chapters);
}

export async function getLocalTopics(chapterId?: string): Promise<Topic[]> {
  if (chapterId) {
    return idbGetByIndex<Topic>(STORES.TOPICS, "by_chapterId", chapterId);
  }
  return idbGetAll<Topic>(STORES.TOPICS);
}

export async function saveLocalTopics(topics: Topic[]): Promise<void> {
  await idbPutBatch(STORES.TOPICS, topics);
}

export async function getLocalPYQPapers(): Promise<PYQPaper[]> {
  const papers = await idbGetAll<PYQPaper>(STORES.PYQS);
  return papers.sort((a, b) => (parseInt(b.paperYear || "0", 10) || 0) - (parseInt(a.paperYear || "0", 10) || 0));
}

export async function saveLocalPYQPapers(papers: PYQPaper[]): Promise<void> {
  await idbPutBatch(STORES.PYQS, papers);
}

// ─────────────────────────────────────────────────────────────────────────────
// STUDENT ACTIVITY REPOSITORIES (LOCAL-FIRST WRITES)
// ─────────────────────────────────────────────────────────────────────────────

// Question Attempts
export async function recordLocalAttempt(attempt: QuestionAttemptRecord, userId: string): Promise<void> {
  const record = {
    ...attempt,
    userId,
    syncStatus: "pending" as const,
  };
  await idbPut(STORES.USER_ATTEMPTS, record);

  // Queue for durable offline-first sync
  await enqueueSyncEvent({
    userId,
    eventType: "attempt",
    entityId: attempt.attemptId,
    operation: "append",
    payload: record,
  });

  // Real-time telemetry: push to Supabase attempts table immediately if online
  if (typeof navigator === "undefined" || navigator.onLine) {
    import("./supabaseSyncService").then(({ recordStudentAttempt }) => {
      recordStudentAttempt({
        userId,
        score: attempt.isCorrect ? 1 : 0,
        totalQuestions: 1,
        answers: {
          [attempt.questionId]: {
            selectedOption: attempt.selectedOption,
            isCorrect: attempt.isCorrect,
            timeSpentSeconds: attempt.timeTakenSeconds || 0,
          },
        },
        timeSpentSeconds: attempt.timeTakenSeconds || 0,
      }).catch(() => {});
    }).catch(() => {});
  }
}

export async function getLocalAttempts(userId?: string): Promise<QuestionAttemptRecord[]> {
  if (userId) {
    return idbGetByIndex<QuestionAttemptRecord>(STORES.USER_ATTEMPTS, "by_userId", userId);
  }
  return idbGetAll<QuestionAttemptRecord>(STORES.USER_ATTEMPTS);
}

// Bookmarks
export async function setLocalBookmark(questionId: string, bookmarked: boolean, userId: string): Promise<void> {
  const now = Date.now();
  const existing = await idbGet<LocalBookmarkRecord>(STORES.BOOKMARKS, questionId);
  const record: LocalBookmarkRecord = {
    questionId,
    userId,
    bookmarked,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
    syncStatus: "pending",
  };
  await idbPut(STORES.BOOKMARKS, record);

  await enqueueSyncEvent({
    userId,
    eventType: "bookmark",
    entityId: questionId,
    operation: "upsert",
    payload: record,
  });
}

export async function isLocalBookmarked(questionId: string): Promise<boolean> {
  const res = await idbGet<LocalBookmarkRecord>(STORES.BOOKMARKS, questionId);
  return Boolean(res?.bookmarked);
}

export async function getAllLocalBookmarks(userId?: string): Promise<LocalBookmarkRecord[]> {
  const list = userId 
    ? await idbGetByIndex<LocalBookmarkRecord>(STORES.BOOKMARKS, "by_userId", userId)
    : await idbGetAll<LocalBookmarkRecord>(STORES.BOOKMARKS);
  return list.filter(b => b.bookmarked);
}

// Wrong Questions
export async function recordLocalWrongQuestion(record: LocalWrongQuestionRecord): Promise<void> {
  const existing = await idbGet<LocalWrongQuestionRecord>(STORES.WRONG_QUESTIONS, record.questionId);
  const consolidated: LocalWrongQuestionRecord = {
    ...record,
    wrongCount: existing ? (existing.wrongCount || 0) + 1 : (record.wrongCount || 1),
    lastWrongAt: Date.now(),
    reviewStatus: "needs_review",
    syncStatus: "pending",
  };
  await idbPut(STORES.WRONG_QUESTIONS, consolidated);

  await enqueueSyncEvent({
    userId: consolidated.userId,
    eventType: "wrong_question",
    entityId: consolidated.questionId,
    operation: "upsert",
    payload: consolidated,
  });
}

export async function removeLocalWrongQuestion(questionId: string, userId: string): Promise<void> {
  const existing = await idbGet<LocalWrongQuestionRecord>(STORES.WRONG_QUESTIONS, questionId);
  if (existing) {
    const updated: LocalWrongQuestionRecord = {
      ...existing,
      reviewStatus: "mastered",
      syncStatus: "pending",
    };
    await idbPut(STORES.WRONG_QUESTIONS, updated);
    await enqueueSyncEvent({
      userId,
      eventType: "wrong_question",
      entityId: questionId,
      operation: "upsert",
      payload: updated,
    });
  }
}

export async function getLocalWrongQuestions(userId?: string): Promise<LocalWrongQuestionRecord[]> {
  if (userId) {
    return idbGetByIndex<LocalWrongQuestionRecord>(STORES.WRONG_QUESTIONS, "by_userId", userId);
  }
  return idbGetAll<LocalWrongQuestionRecord>(STORES.WRONG_QUESTIONS);
}

// Test Results
export async function saveLocalTestResult(testResult: SmartTestRecord, userId: string): Promise<void> {
  const record = {
    ...testResult,
    userId,
    syncStatus: "pending" as const,
  };
  await idbPut(STORES.TEST_RESULTS, record);

  await enqueueSyncEvent({
    userId,
    eventType: "test_result",
    entityId: testResult.testId,
    operation: "append",
    payload: record,
  });
}

export async function getLocalTestResults(userId?: string): Promise<SmartTestRecord[]> {
  if (userId) {
    return idbGetByIndex<SmartTestRecord>(STORES.TEST_RESULTS, "by_userId", userId);
  }
  return idbGetAll<SmartTestRecord>(STORES.TEST_RESULTS);
}

// Revision History
export async function saveLocalRevisionRecord(record: LocalRevisionRecord): Promise<void> {
  const recordId = record.recordId || `${record.userId}_${record.questionId}`;
  const completeRecord: LocalRevisionRecord = { ...record, recordId };
  await idbPut(STORES.REVISION_HISTORY, completeRecord);

  await enqueueSyncEvent({
    userId: completeRecord.userId,
    eventType: "revision",
    entityId: recordId,
    operation: "upsert",
    payload: completeRecord,
  });
}


export async function getLocalRevisionHistory(userId?: string): Promise<LocalRevisionRecord[]> {
  if (userId) {
    return idbGetByIndex<LocalRevisionRecord>(STORES.REVISION_HISTORY, "by_userId", userId);
  }
  return idbGetAll<LocalRevisionRecord>(STORES.REVISION_HISTORY);
}

// Study Logs
export async function recordLocalStudySession(log: LocalStudyLogRecord): Promise<void> {
  await idbPut(STORES.STUDY_LOGS, log);

  await enqueueSyncEvent({
    userId: log.userId,
    eventType: "study_log",
    entityId: log.sessionId,
    operation: "append",
    payload: log,
  });
}

export async function getLocalStudyLogs(userId?: string): Promise<LocalStudyLogRecord[]> {
  if (userId) {
    return idbGetByIndex<LocalStudyLogRecord>(STORES.STUDY_LOGS, "by_userId", userId);
  }
  return idbGetAll<LocalStudyLogRecord>(STORES.STUDY_LOGS);
}

// Syllabus Progress
export async function setLocalSyllabusProgress(prog: LocalSyllabusProgressRecord): Promise<void> {
  await idbPut(STORES.SYLLABUS_PROGRESS, prog);

  await enqueueSyncEvent({
    userId: prog.userId,
    eventType: "syllabus_progress",
    entityId: prog.entityId,
    operation: "upsert",
    payload: prog,
  });
}

export async function getLocalSyllabusProgress(userId?: string): Promise<LocalSyllabusProgressRecord[]> {
  if (userId) {
    return idbGetByIndex<LocalSyllabusProgressRecord>(STORES.SYLLABUS_PROGRESS, "by_userId", userId);
  }
  return idbGetAll<LocalSyllabusProgressRecord>(STORES.SYLLABUS_PROGRESS);
}

// ─────────────────────────────────────────────────────────────────────────────
// DURABLE SYNC QUEUE REPOSITORY
// ─────────────────────────────────────────────────────────────────────────────

export async function enqueueSyncEvent(
  params: Omit<SyncQueueEvent, "eventId" | "clientTimestamp" | "syncStatus" | "retryCount">
): Promise<string> {
  const now = Date.now();
  const rand = Math.random().toString(36).substring(2, 9);
  const rawEntityId = String(params.entityId || "ent");
  const eventId = `evt_${now}_${rand}_${rawEntityId.substring(0, 16)}`;

  const event: SyncQueueEvent = {
    ...params,
    eventId,
    clientTimestamp: now,
    syncStatus: "pending",
    retryCount: 0,
  };

  await idbPut(STORES.SYNC_QUEUE, event);
  return eventId;
}

export async function getPendingSyncEvents(limitCount = 500): Promise<SyncQueueEvent[]> {
  const [pending, failed] = await Promise.all([
    idbGetByIndex<SyncQueueEvent>(STORES.SYNC_QUEUE, "by_syncStatus", "pending").catch(() => []),
    idbGetByIndex<SyncQueueEvent>(STORES.SYNC_QUEUE, "by_syncStatus", "failed").catch(() => []),
  ]);
  // Retry failed events up to 5 times
  const retryableFailed = failed.filter(e => (e.retryCount || 0) < 5);
  const combined = [...pending, ...retryableFailed];
  return combined.sort((a, b) => a.clientTimestamp - b.clientTimestamp).slice(0, limitCount);
}

export async function updateSyncEventsStatus(
  eventIds: string[], 
  status: "in_flight" | "synced" | "failed",
  errorMsg?: string
): Promise<void> {
  if (!eventIds || eventIds.length === 0) return;
  const db = await openLocalDatabase();
  if (!db) return;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORES.SYNC_QUEUE, "readwrite");
      const store = tx.objectStore(STORES.SYNC_QUEUE);
      for (const id of eventIds) {
        const req = store.get(id);
        req.onsuccess = () => {
          const item = req.result as SyncQueueEvent | undefined;
          if (item) {
            item.syncStatus = status;
            if (status === "failed") {
              item.retryCount = (item.retryCount || 0) + 1;
              item.lastErrorMessage = errorMsg;
            }
            store.put(item);
          }
        };
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

export async function getPendingSyncQueueCount(): Promise<number> {
  const pending = await idbGetByIndex<SyncQueueEvent>(STORES.SYNC_QUEUE, "by_syncStatus", "pending");
  return pending.length;
}

export async function markLocalEntitiesSynced(events: SyncQueueEvent[]): Promise<void> {
  if (!events || events.length === 0) return;
  for (const evt of events) {
    try {
      switch (evt.eventType) {
        case "attempt": {
          const rec = await idbGet<QuestionAttemptRecord & { syncStatus?: string }>(STORES.USER_ATTEMPTS, evt.entityId);
          if (rec) {
            rec.syncStatus = "synced";
            await idbPut(STORES.USER_ATTEMPTS, rec);
          }
          break;
        }
        case "wrong_question": {
          const rec = await idbGet<LocalWrongQuestionRecord>(STORES.WRONG_QUESTIONS, evt.entityId);
          if (rec) {
            rec.syncStatus = "synced";
            await idbPut(STORES.WRONG_QUESTIONS, rec);
          }
          break;
        }
        case "test_result": {
          const rec = await idbGet<SmartTestRecord & { syncStatus?: string }>(STORES.TEST_RESULTS, evt.entityId);
          if (rec) {
            rec.syncStatus = "synced";
            await idbPut(STORES.TEST_RESULTS, rec);
          }
          break;
        }
        case "bookmark": {
          const rec = await idbGet<LocalBookmarkRecord>(STORES.BOOKMARKS, evt.entityId);
          if (rec) {
            rec.syncStatus = "synced";
            await idbPut(STORES.BOOKMARKS, rec);
          }
          break;
        }
        case "revision": {
          const rec = await idbGet<LocalRevisionRecord>(STORES.REVISION_HISTORY, evt.entityId);
          if (rec) {
            rec.syncStatus = "synced";
            await idbPut(STORES.REVISION_HISTORY, rec);
          }
          break;
        }
        case "study_log": {
          const rec = await idbGet<LocalStudyLogRecord>(STORES.STUDY_LOGS, evt.entityId);
          if (rec) {
            rec.syncStatus = "synced";
            await idbPut(STORES.STUDY_LOGS, rec);
          }
          break;
        }
        case "syllabus_progress": {
          const rec = await idbGet<LocalSyllabusProgressRecord>(STORES.SYLLABUS_PROGRESS, evt.entityId);
          if (rec) {
            rec.syncStatus = "synced";
            await idbPut(STORES.SYLLABUS_PROGRESS, rec);
          }
          break;
        }
      }
    } catch (_) {}
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ATOMIC SYNC STAGING BUFFER & COMMIT
// ─────────────────────────────────────────────────────────────────────────────

export async function stageIncomingRecords(
  batchId: string, 
  entityType: StoreName, 
  records: Array<{ recordId: string; data: any; action?: "upsert" | "delete" }>
): Promise<void> {
  const now = Date.now();
  const stagingItems: SyncStagingItem[] = records.map((r, idx) => ({
    stagingId: `${batchId}_${entityType}_${r.recordId}_${idx}`,
    batchId,
    entityType,
    recordId: r.recordId,
    data: r.data,
    action: r.action || "upsert",
    createdAt: now,
  }));

  await idbPutBatch(STORES.SYNC_STAGING, stagingItems);
}

export async function commitStagedBatch(batchId: string): Promise<{ committedCount: number }> {
  const staged = await idbGetByIndex<SyncStagingItem>(STORES.SYNC_STAGING, "by_batchId", batchId);
  if (staged.length === 0) return { committedCount: 0 };

  const db = await openLocalDatabase();
  if (!db) return { committedCount: 0 };

  // Group by destination store
  const byStore = new Map<StoreName, SyncStagingItem[]>();
  for (const item of staged) {
    const list = byStore.get(item.entityType) || [];
    list.push(item);
    byStore.set(item.entityType, list);
  }

  const involvedStores = Array.from(byStore.keys());
  involvedStores.push(STORES.SYNC_STAGING);

  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction(involvedStores, "readwrite");
      
      for (const [storeName, items] of byStore.entries()) {
        const destStore = tx.objectStore(storeName);
        for (const item of items) {
          if (item.action === "delete") {
            destStore.delete(item.recordId);
          } else {
            destStore.put(item.data);
          }
        }
      }

      // Clear staged items for this batch
      const stagingStore = tx.objectStore(STORES.SYNC_STAGING);
      for (const item of staged) {
        stagingStore.delete(item.stagingId);
      }

      tx.oncomplete = () => resolve({ committedCount: staged.length });
      tx.onerror = () => reject(tx.error);
    } catch (err) {
      reject(err);
    }
  });
}

export async function discardStagedBatch(batchId: string): Promise<void> {
  const staged = await idbGetByIndex<SyncStagingItem>(STORES.SYNC_STAGING, "by_batchId", batchId);
  if (staged.length === 0) return;

  const db = await openLocalDatabase();
  if (!db) return;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORES.SYNC_STAGING, "readwrite");
      const store = tx.objectStore(STORES.SYNC_STAGING);
      for (const item of staged) {
        store.delete(item.stagingId);
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// SAFE MIGRATION ENGINE (LOCALSTORAGE -> INDEXEDDB)
// ─────────────────────────────────────────────────────────────────────────────

export async function migrateLegacyLocalStorageToIndexedDB(userId = "guest"): Promise<{
  migrated: boolean;
  mcqCount: number;
  attemptCount: number;
  bookmarkCount: number;
}> {
  const meta = await idbGet<{ migrated: boolean }>(STORES.CURRICULUM_METADATA, "localStorage_migrated_v4");
  if (meta?.migrated) {
    const mcqCount = await countLocalMCQs();
    return { migrated: false, mcqCount, attemptCount: 0, bookmarkCount: 0 };
  }

  let mcqCount = 0;
  let attemptCount = 0;
  let bookmarkCount = 0;

  try {
    if (typeof localStorage === "undefined") {
      return { migrated: false, mcqCount: 0, attemptCount: 0, bookmarkCount: 0 };
    }

    // 1. Migrate Questions & Curriculum from UserQuestionsStore
    const rawUserQs = localStorage.getItem("economic_survey_user_questions_v2");
    if (rawUserQs) {
      const parsed = JSON.parse(rawUserQs);
      const allQs: Question[] = [
        ...(Array.isArray(parsed.customQuestions) ? parsed.customQuestions : []),
        ...(Array.isArray(parsed.cloudCacheQuestions) ? parsed.cloudCacheQuestions : []),
      ];
      if (allQs.length > 0) {
        await saveLocalMCQs(allQs);
        mcqCount = allQs.length;
      }
      if (Array.isArray(parsed.customSubjects) && parsed.customSubjects.length > 0) {
        await saveLocalSubjects(parsed.customSubjects);
      }
      if (Array.isArray(parsed.customChapters) && parsed.customChapters.length > 0) {
        await saveLocalChapters(parsed.customChapters);
      }
      if (Array.isArray(parsed.customTopics) && parsed.customTopics.length > 0) {
        await saveLocalTopics(parsed.customTopics);
      }
    }

    // 2. Migrate Progress & Bookmarks
    const rawProg = localStorage.getItem("economic_survey_progress_v2");
    if (rawProg) {
      const parsedProg: ProgressStore = JSON.parse(rawProg);
      const now = Date.now();
      for (const [qId, prog] of Object.entries(parsedProg)) {
        if (prog.bookmarked) {
          await setLocalBookmark(qId, true, userId);
          bookmarkCount++;
        }
        if (prog.status === "wrong") {
          await idbPut(STORES.WRONG_QUESTIONS, {
            questionId: qId,
            userId,
            wrongCount: prog.wrongCount || 1,
            lastWrongAt: prog.lastAnsweredAt ? new Date(prog.lastAnsweredAt).getTime() : now,
            reviewStatus: "needs_review",
            syncStatus: "pending",
          } as LocalWrongQuestionRecord);
        }
        if (prog.stage !== undefined) {
          await idbPut(STORES.REVISION_HISTORY, {
            recordId: `${userId}_${qId}`,
            questionId: qId,
            userId,
            stage: prog.stage,
            nextReviewAt: prog.nextReviewAt || "",
            lastAnsweredAt: prog.lastAnsweredAt || "",
            wrongCount: prog.wrongCount || 0,
            status: prog.status,
            updatedAt: now,
            syncStatus: "pending",
          } as LocalRevisionRecord);
        }
      }
    }

    // 3. Migrate PYQs
    const rawPyq = localStorage.getItem("remix_rajprep_pyq_papers_v2");
    if (rawPyq) {
      const papers: PYQPaper[] = JSON.parse(rawPyq);
      if (Array.isArray(papers) && papers.length > 0) {
        await saveLocalPYQPapers(papers);
      }
    }

    // Stamp migration complete
    await idbPut(STORES.CURRICULUM_METADATA, {
      key: "localStorage_migrated_v4",
      migrated: true,
      migratedAt: Date.now(),
      mcqCount,
      bookmarkCount,
    });

    console.log(`[LocalDB Engine] Successfully migrated ${mcqCount} questions and ${bookmarkCount} bookmarks from localStorage to IndexedDB.`);
    return { migrated: true, mcqCount, attemptCount, bookmarkCount };
  } catch (err) {
    console.warn("[LocalDB Engine] Notice during localStorage migration:", err);
    return { migrated: false, mcqCount, attemptCount, bookmarkCount };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// DATA INTEGRITY DIAGNOSTIC
// ─────────────────────────────────────────────────────────────────────────────

export async function checkLocalDatabaseIntegrity(): Promise<{
  healthy: boolean;
  totalMCQs: number;
  totalSubjects: number;
  totalChapters: number;
  totalTopics: number;
  totalPYQs: number;
  totalBookmarks: number;
  pendingSyncCount: number;
  missingTopicReferences: number;
}> {
  const [mcqs, subjects, chapters, topics, pyqs, bookmarks, pendingCount] = await Promise.all([
    getAllLocalMCQs(),
    getLocalSubjects(),
    getLocalChapters(),
    getLocalTopics(),
    getLocalPYQPapers(),
    getAllLocalBookmarks(),
    getPendingSyncQueueCount(),
  ]);

  const topicIdSet = new Set(topics.map(t => t.id));
  let missingTopicReferences = 0;

  for (const q of mcqs) {
    if (q.topicId && !topicIdSet.has(q.topicId)) {
      missingTopicReferences++;
    }
  }

  const healthy = mcqs.length > 0 && subjects.length > 0;

  return {
    healthy,
    totalMCQs: mcqs.length,
    totalSubjects: subjects.length,
    totalChapters: chapters.length,
    totalTopics: topics.length,
    totalPYQs: pyqs.length,
    totalBookmarks: bookmarks.length,
    pendingSyncCount: pendingCount,
    missingTopicReferences,
  };
}
