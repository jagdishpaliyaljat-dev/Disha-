/**
 * DISHA 20-20 - Local-First Unified IndexedDB Database Engine (v5)
 * Snapshot-Based Offline-First Primary Local Storage
 */

import { 
  SnapshotMetadataRecord, 
  TombstoneRecord, 
  QuestionMappingRecord, 
  UserActivityEvent 
} from "./types";

export const SNAPSHOT_DB_NAME = "disha2020-db-v5";
export const LEGACY_SNAPSHOT_DB_NAME = "quizpro-db-v5";
export const SNAPSHOT_DB_VERSION = 1;

export const SNAPSHOT_STORES = {
  SUBJECTS: "subjects",
  CHAPTERS: "chapters",
  TOPICS: "topics",
  MCQS: "mcqs",
  QUESTION_MAPPINGS: "question_mappings",
  PYQS: "pyqs",
  USER_PROGRESS: "user_progress",
  ATTEMPT_HISTORY: "attempt_history",
  BOOKMARKS: "bookmarks",
  WRONG_QUESTIONS: "wrong_questions",
  REVISION_HISTORY: "revision_history",
  TEST_HISTORY: "test_history",
  STUDY_SESSIONS: "study_sessions",
  PENDING_SYNC_QUEUE: "pending_sync_queue",
  SYNC_METADATA: "sync_metadata",
  SNAPSHOT_METADATA: "snapshot_metadata",
  DELETED_RECORDS: "deleted_records",
  SNAPSHOT_STAGING: "snapshot_staging"
} as const;

export type SnapshotStoreName = typeof SNAPSHOT_STORES[keyof typeof SNAPSHOT_STORES];

let dbPromise: Promise<IDBDatabase> | null = null;

export function getIndexedDb(): IDBFactory | undefined {
  if (typeof window !== "undefined" && window.indexedDB) {
    return window.indexedDB;
  }
  if (typeof globalThis !== "undefined" && (globalThis as any).indexedDB) {
    return (globalThis as any).indexedDB;
  }
  return undefined;
}

export function openSnapshotDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  const idb = getIndexedDb();
  if (!idb) {
    return Promise.reject(new Error("IndexedDB is not supported in this runtime environment."));
  }

  dbPromise = new Promise((resolve, reject) => {
    const request = idb.open(SNAPSHOT_DB_NAME, SNAPSHOT_DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = request.result;

      // 1. subjects
      if (!db.objectStoreNames.contains(SNAPSHOT_STORES.SUBJECTS)) {
        db.createObjectStore(SNAPSHOT_STORES.SUBJECTS, { keyPath: "id" });
      }

      // 2. chapters
      if (!db.objectStoreNames.contains(SNAPSHOT_STORES.CHAPTERS)) {
        const store = db.createObjectStore(SNAPSHOT_STORES.CHAPTERS, { keyPath: "id" });
        store.createIndex("subjectId", "subjectId", { unique: false });
      }

      // 3. topics
      if (!db.objectStoreNames.contains(SNAPSHOT_STORES.TOPICS)) {
        const store = db.createObjectStore(SNAPSHOT_STORES.TOPICS, { keyPath: "id" });
        store.createIndex("chapterId", "chapterId", { unique: false });
        store.createIndex("subjectId", "subjectId", { unique: false });
      }

      // 4. mcqs
      if (!db.objectStoreNames.contains(SNAPSHOT_STORES.MCQS)) {
        const store = db.createObjectStore(SNAPSHOT_STORES.MCQS, { keyPath: "id" });
        store.createIndex("topicId", "topicId", { unique: false });
        store.createIndex("chapterId", "chapterId", { unique: false });
        store.createIndex("subjectId", "subjectId", { unique: false });
      }

      // 5. question_mappings
      if (!db.objectStoreNames.contains(SNAPSHOT_STORES.QUESTION_MAPPINGS)) {
        const store = db.createObjectStore(SNAPSHOT_STORES.QUESTION_MAPPINGS, { keyPath: "questionId" });
        store.createIndex("topicId", "topicId", { unique: false });
        store.createIndex("chapterId", "chapterId", { unique: false });
        store.createIndex("subjectId", "subjectId", { unique: false });
      }

      // 6. pyqs
      if (!db.objectStoreNames.contains(SNAPSHOT_STORES.PYQS)) {
        db.createObjectStore(SNAPSHOT_STORES.PYQS, { keyPath: "id" });
      }

      // 7. user_progress
      if (!db.objectStoreNames.contains(SNAPSHOT_STORES.USER_PROGRESS)) {
        const store = db.createObjectStore(SNAPSHOT_STORES.USER_PROGRESS, { keyPath: "id" });
        store.createIndex("userId", "userId", { unique: false });
      }

      // 8. attempt_history
      if (!db.objectStoreNames.contains(SNAPSHOT_STORES.ATTEMPT_HISTORY)) {
        const store = db.createObjectStore(SNAPSHOT_STORES.ATTEMPT_HISTORY, { keyPath: "id" });
        store.createIndex("userId", "userId", { unique: false });
        store.createIndex("questionId", "questionId", { unique: false });
        store.createIndex("timestamp", "timestamp", { unique: false });
      }

      // 9. bookmarks
      if (!db.objectStoreNames.contains(SNAPSHOT_STORES.BOOKMARKS)) {
        const store = db.createObjectStore(SNAPSHOT_STORES.BOOKMARKS, { keyPath: "id" });
        store.createIndex("userId", "userId", { unique: false });
        store.createIndex("questionId", "questionId", { unique: false });
      }

      // 10. wrong_questions
      if (!db.objectStoreNames.contains(SNAPSHOT_STORES.WRONG_QUESTIONS)) {
        const store = db.createObjectStore(SNAPSHOT_STORES.WRONG_QUESTIONS, { keyPath: "id" });
        store.createIndex("userId", "userId", { unique: false });
        store.createIndex("questionId", "questionId", { unique: false });
        store.createIndex("topicId", "topicId", { unique: false });
      }

      // 11. revision_history
      if (!db.objectStoreNames.contains(SNAPSHOT_STORES.REVISION_HISTORY)) {
        const store = db.createObjectStore(SNAPSHOT_STORES.REVISION_HISTORY, { keyPath: "id" });
        store.createIndex("userId", "userId", { unique: false });
        store.createIndex("questionId", "questionId", { unique: false });
      }

      // 12. test_history
      if (!db.objectStoreNames.contains(SNAPSHOT_STORES.TEST_HISTORY)) {
        const store = db.createObjectStore(SNAPSHOT_STORES.TEST_HISTORY, { keyPath: "id" });
        store.createIndex("userId", "userId", { unique: false });
        store.createIndex("testId", "testId", { unique: false });
      }

      // 13. study_sessions
      if (!db.objectStoreNames.contains(SNAPSHOT_STORES.STUDY_SESSIONS)) {
        const store = db.createObjectStore(SNAPSHOT_STORES.STUDY_SESSIONS, { keyPath: "id" });
        store.createIndex("userId", "userId", { unique: false });
      }

      // 14. pending_sync_queue
      if (!db.objectStoreNames.contains(SNAPSHOT_STORES.PENDING_SYNC_QUEUE)) {
        const store = db.createObjectStore(SNAPSHOT_STORES.PENDING_SYNC_QUEUE, { keyPath: "eventId" });
        store.createIndex("userId", "userId", { unique: false });
        store.createIndex("syncStatus", "syncStatus", { unique: false });
        store.createIndex("clientTimestamp", "clientTimestamp", { unique: false });
      }

      // 15. sync_metadata
      if (!db.objectStoreNames.contains(SNAPSHOT_STORES.SYNC_METADATA)) {
        db.createObjectStore(SNAPSHOT_STORES.SYNC_METADATA, { keyPath: "key" });
      }

      // 16. snapshot_metadata
      if (!db.objectStoreNames.contains(SNAPSHOT_STORES.SNAPSHOT_METADATA)) {
        db.createObjectStore(SNAPSHOT_STORES.SNAPSHOT_METADATA, { keyPath: "id" });
      }

      // 17. deleted_records (tombstones)
      if (!db.objectStoreNames.contains(SNAPSHOT_STORES.DELETED_RECORDS)) {
        const store = db.createObjectStore(SNAPSHOT_STORES.DELETED_RECORDS, { keyPath: "id" });
        store.createIndex("entityType", "entityType", { unique: false });
        store.createIndex("snapshotVersion", "snapshotVersion", { unique: false });
      }

      // 18. snapshot_staging (for atomic transaction verification)
      if (!db.objectStoreNames.contains(SNAPSHOT_STORES.SNAPSHOT_STAGING)) {
        db.createObjectStore(SNAPSHOT_STORES.SNAPSHOT_STAGING, { keyPath: "key" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {
      dbPromise = null;
      reject(request.error || new Error("Failed to open snapshot IndexedDB"));
    };
  });

  return dbPromise;
}

export function closeSnapshotDb(): void {
  if (dbPromise) {
    dbPromise.then(db => db.close()).catch(() => {});
    dbPromise = null;
  }
}

// Transaction Helpers
export async function executeTx<T>(
  storeNames: SnapshotStoreName | SnapshotStoreName[],
  mode: IDBTransactionMode,
  callback: (stores: Record<SnapshotStoreName, IDBObjectStore>, tx: IDBTransaction) => Promise<T>
): Promise<T> {
  const db = await openSnapshotDb();
  const names = Array.isArray(storeNames) ? storeNames : [storeNames];
  const tx = db.transaction(names, mode);

  const storeMap = {} as Record<SnapshotStoreName, IDBObjectStore>;
  for (const name of names) {
    storeMap[name] = tx.objectStore(name);
  }

  return new Promise<T>((resolve, reject) => {
    let result: T;
    let promiseResolved = false;

    callback(storeMap, tx)
      .then((res) => {
        result = res;
        promiseResolved = true;
      })
      .catch((err) => {
        try { tx.abort(); } catch {}
        reject(err);
      });

    tx.oncomplete = () => {
      if (promiseResolved) {
        resolve(result);
      }
    };
    tx.onerror = () => reject(tx.error || new Error("Transaction failed"));
    tx.onabort = () => reject(tx.error || new Error("Transaction aborted"));
  });
}

// Basic Repository Accessors
export async function getRecord<T = any>(storeName: SnapshotStoreName, key: IDBValidKey): Promise<T | null> {
  const db = await openSnapshotDb();
  return new Promise<T | null>((resolve, reject) => {
    const tx = db.transaction([storeName], "readonly");
    const store = tx.objectStore(storeName);
    const req = store.get(key);
    req.onsuccess = () => resolve(req.result !== undefined ? req.result : null);
    req.onerror = () => reject(req.error);
  });
}

export async function getAllRecords<T = any>(storeName: SnapshotStoreName): Promise<T[]> {
  const db = await openSnapshotDb();
  return new Promise<T[]>((resolve, reject) => {
    const tx = db.transaction([storeName], "readonly");
    const store = tx.objectStore(storeName);
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

export async function putRecords<T = any>(storeName: SnapshotStoreName, items: T[]): Promise<void> {
  if (!items.length) return;
  return executeTx(storeName, "readwrite", async (stores) => {
    const store = stores[storeName];
    for (const item of items) {
      store.put(item);
    }
  });
}

export async function deleteRecords(storeName: SnapshotStoreName, keys: IDBValidKey[]): Promise<void> {
  if (!keys.length) return;
  return executeTx(storeName, "readwrite", async (stores) => {
    const store = stores[storeName];
    for (const key of keys) {
      store.delete(key);
    }
  });
}

export async function countRecords(storeName: SnapshotStoreName): Promise<number> {
  const db = await openSnapshotDb();
  return new Promise<number>((resolve, reject) => {
    const tx = db.transaction([storeName], "readonly");
    const store = tx.objectStore(storeName);
    const req = store.count();
    req.onsuccess = () => resolve(req.result || 0);
    req.onerror = () => reject(req.error);
  });
}

// Topic / Chapter Queries
export async function getMcqsByTopic(topicId: string): Promise<any[]> {
  const db = await openSnapshotDb();
  return new Promise<any[]>((resolve, reject) => {
    const tx = db.transaction([SNAPSHOT_STORES.MCQS], "readonly");
    const store = tx.objectStore(SNAPSHOT_STORES.MCQS);
    const index = store.index("topicId");
    const req = index.getAll(topicId);
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

export async function getTopicsByChapter(chapterId: string): Promise<any[]> {
  const db = await openSnapshotDb();
  return new Promise<any[]>((resolve, reject) => {
    const tx = db.transaction([SNAPSHOT_STORES.TOPICS], "readonly");
    const store = tx.objectStore(SNAPSHOT_STORES.TOPICS);
    const index = store.index("chapterId");
    const req = index.getAll(chapterId);
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

export async function getChaptersBySubject(subjectId: string): Promise<any[]> {
  const db = await openSnapshotDb();
  return new Promise<any[]>((resolve, reject) => {
    const tx = db.transaction([SNAPSHOT_STORES.CHAPTERS], "readonly");
    const store = tx.objectStore(SNAPSHOT_STORES.CHAPTERS);
    const index = store.index("subjectId");
    const req = index.getAll(subjectId);
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

// Topic & Chapter Question Count Recalculation
export async function recalculateQuestionCounts(): Promise<{
  topicsUpdated: number;
  chaptersUpdated: number;
  subjectsUpdated: number;
}> {
  return executeTx(
    [
      SNAPSHOT_STORES.SUBJECTS,
      SNAPSHOT_STORES.CHAPTERS,
      SNAPSHOT_STORES.TOPICS,
      SNAPSHOT_STORES.MCQS
    ],
    "readwrite",
    async (stores) => {
      const mcqsReq = stores[SNAPSHOT_STORES.MCQS].getAll();
      const topicsReq = stores[SNAPSHOT_STORES.TOPICS].getAll();
      const chaptersReq = stores[SNAPSHOT_STORES.CHAPTERS].getAll();
      const subjectsReq = stores[SNAPSHOT_STORES.SUBJECTS].getAll();

      await new Promise<void>((resolve) => {
        let done = 0;
        const check = () => { if (++done === 4) resolve(); };
        mcqsReq.onsuccess = check;
        topicsReq.onsuccess = check;
        chaptersReq.onsuccess = check;
        subjectsReq.onsuccess = check;
      });

      const mcqs = mcqsReq.result || [];
      const topics = topicsReq.result || [];
      const chapters = chaptersReq.result || [];
      const subjects = subjectsReq.result || [];

      // Map mcqs by topic
      const topicCountMap = new Map<string, number>();
      for (const m of mcqs) {
        const tId = m.topicId;
        if (tId) {
          topicCountMap.set(tId, (topicCountMap.get(tId) || 0) + 1);
        }
      }

      // Update topics
      let topicsUpdated = 0;
      for (const t of topics) {
        const count = topicCountMap.get(t.id) || 0;
        if (t.questionCount !== count) {
          t.questionCount = count;
          stores[SNAPSHOT_STORES.TOPICS].put(t);
          topicsUpdated++;
        }
      }

      // Map chapters count
      const chapterCountMap = new Map<string, number>();
      for (const t of topics) {
        const cId = t.chapterId;
        const count = topicCountMap.get(t.id) || 0;
        if (cId) {
          chapterCountMap.set(cId, (chapterCountMap.get(cId) || 0) + count);
        }
      }

      let chaptersUpdated = 0;
      for (const c of chapters) {
        const count = chapterCountMap.get(c.id) || 0;
        if (c.questionCount !== count) {
          c.questionCount = count;
          stores[SNAPSHOT_STORES.CHAPTERS].put(c);
          chaptersUpdated++;
        }
      }

      // Map subjects count
      const subjectCountMap = new Map<string, number>();
      for (const c of chapters) {
        const sId = c.subjectId;
        const count = chapterCountMap.get(c.id) || 0;
        if (sId) {
          subjectCountMap.set(sId, (subjectCountMap.get(sId) || 0) + count);
        }
      }

      let subjectsUpdated = 0;
      for (const s of subjects) {
        const count = subjectCountMap.get(s.id) || 0;
        if (s.questionCount !== count) {
          s.questionCount = count;
          stores[SNAPSHOT_STORES.SUBJECTS].put(s);
          subjectsUpdated++;
        }
      }

      return { topicsUpdated, chaptersUpdated, subjectsUpdated };
    }
  );
}

// Active Snapshot Metadata Access
export async function getActiveSnapshotMetadata(): Promise<SnapshotMetadataRecord | null> {
  return getRecord<SnapshotMetadataRecord>(
    SNAPSHOT_STORES.SNAPSHOT_METADATA,
    "current_active_snapshot"
  );
}

export async function saveActiveSnapshotMetadata(metadata: SnapshotMetadataRecord): Promise<void> {
  await putRecords(SNAPSHOT_STORES.SNAPSHOT_METADATA, [metadata]);
}
