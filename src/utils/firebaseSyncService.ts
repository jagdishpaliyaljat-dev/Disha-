import { doc } from 'firebase/firestore';
import { db, auth, isFirebaseConfigured } from '../lib/firebase';
import { triggerAdminToast } from './adminToast';

export interface MCQ {
  id: string;
  text: string;
  question?: string; // Legacy support
  options: string[];
  correctIndex: number;
  correctAnswer?: number; // Legacy support
  explanation: string;
  topicId: string;
  chapterId?: string;
  subjectId?: string;
  paperId?: string;
  testId?: string;
  difficulty?: 'easy' | 'medium' | 'hard';
}

// Clean production slate: zero mock MCQs
const INITIAL_MCQS: MCQ[] = [];

/**
 * Fetch MCQs by topic.
 * Public data fetching: does NOT force an isAuthenticated check.
 * Guest users can freely fetch educational content, chapters, and MCQs.
 */
export async function fetchMCQsByTopic(topicId: string, options?: { allowRemote?: boolean }): Promise<MCQ[]> {
  // 0. Check primary local IndexedDB engine first (Strict Local-First)
  try {
    const { getLocalMCQsByTopic, getAllLocalMCQs } = await import('./localDatabaseEngine');
    const local = topicId === 'all'
      ? await getAllLocalMCQs()
      : await getLocalMCQsByTopic(topicId);
    if (local && local.length > 0) {
      return local as MCQ[];
    }
  } catch (_) {}

  // 1. Check live synced questionsStore (in-memory / IndexedDB / localStorage) first
  try {
    const { loadUserQuestionsStore, getCombinedChapters, deduplicateQuestions } = await import('./questionsStorage');
    const store = loadUserQuestionsStore();
    const chapters = getCombinedChapters(store);
    
    // Find matching topic across all chapters
    for (const ch of chapters) {
      for (const t of ch.topics) {
        if (t.id === topicId || t.id.toLowerCase() === topicId.toLowerCase()) {
          if (Array.isArray(t.questions) && t.questions.length > 0) {
            return t.questions as MCQ[];
          }
        }
      }
    }

    // Check cloudCacheQuestions and customQuestions directly
    const allStoreQs = [...(store.customQuestions || []), ...(store.cloudCacheQuestions || [])];
    const matchingTopic = allStoreQs.filter((q: any) => 
      q && (
        q.topicId === topicId || 
        (q.topicId && q.topicId.toLowerCase() === topicId.toLowerCase()) ||
        (q as any).topic === topicId ||
        q.chapterId === topicId ||
        q.subjectId === topicId
      ) && (q.text || q.question)
    );
    if (matchingTopic.length > 0) {
      return deduplicateQuestions(matchingTopic) as MCQ[];
    }
  } catch (e) {}

  // 1.5. Check persistent IndexedDB question bank cache via localforage (CACHE-FIRST)
  try {
    const { getCachedQuestionsByTopic, getAllCachedQuestions } = await import('./questionBankCache');
    const cached = topicId === 'all' 
      ? await getAllCachedQuestions() 
      : await getCachedQuestionsByTopic(topicId);
    if (cached && cached.length > 0) {
      return cached as MCQ[];
    }
  } catch (idbErr) {
    console.warn("[FirebaseSync] localforage question bank lookup:", idbErr);
  }

  // Strict 24-Hour Offline-First Policy:
  // Ordinary student-facing question retrieval NEVER queries Firestore directly.
  // Questions are downloaded only through the central 24-hour sync cycle.
  const { isUserAdmin, loadUserProfile } = await import('./userProfileStorage');
  const isAdmin = isUserAdmin(loadUserProfile());
  if (!options?.allowRemote && !isAdmin) {
    return [];
  }

  // 2. Fetch from canonical Firestore 'mcqs' collection (Admin / Authorized direct sync only)
  if (isFirebaseConfigured()) {
    try {
      const { collection, query, where, limit: firestoreLimit } = await import('firebase/firestore');
      const { guardedGetDocs } = await import('./quotaTracker');
      
      const mcqsRef = collection(db, "mcqs");

      const qMcqs = topicId === 'all' 
        ? query(mcqsRef, firestoreLimit(5000)) 
        : query(mcqsRef, where("topicId", "==", topicId));

      const snapMcqs = await guardedGetDocs(qMcqs, "Student", "Fetch MCQs by Topic", undefined, 30000).catch(() => null);

      let snapQs: any = null;
      // Only query legacy 'questions' if canonical 'mcqs' returned 0 records (bridges pre-migration legacy data)
      if (!snapMcqs || snapMcqs.empty) {
        const qsRef = collection(db, "questions");
        const qQuestions = topicId === 'all'
          ? query(qsRef, firestoreLimit(5000))
          : query(qsRef, where("topicId", "==", topicId));
        snapQs = await guardedGetDocs(qQuestions, "Student", "Legacy Questions Fallback", undefined, 30000).catch(() => null);
      }

      const { loadUserQuestionsStore, mergeQuestionsIntoStore } = await import('./questionsStorage');
      const liveStore = loadUserQuestionsStore();
      const liveStoreById = new Map<string, any>();
      (liveStore.cloudCacheQuestions || []).forEach((q: any) => {
        if (q && q.id) liveStoreById.set(q.id, q);
      });

      const mergedMap = new Map<string, any>();
      const addSnapDocs = (snap: any) => {
        if (!snap || snap.empty) return;
        snap.docs.forEach((d: any) => {
          const item = { ...d.data(), id: d.id } as any;
          if (item.table) item.table = normalizeTableFromFirestore(item.table);
          if (item.tableData) item.tableData = normalizeTableFromFirestore(item.tableData);

          // Guard against stale moved questions in 'questions' collection:
          const inStore = liveStoreById.get(d.id);
          if (inStore && topicId !== 'all') {
            const tStore = new Date(inStore.updatedAt || inStore.createdAt || 0).getTime() || 0;
            const tItem = new Date(item.updatedAt || item.createdAt || 0).getTime() || 0;
            if (tStore > tItem && inStore.topicId && inStore.topicId !== topicId) {
              return;
            }
          }

          const existing = mergedMap.get(d.id);
          if (existing) {
            const tEx = new Date(existing.updatedAt || existing.createdAt || 0).getTime() || 0;
            const tNew = new Date(item.updatedAt || item.createdAt || 0).getTime() || 0;
            mergedMap.set(d.id, tNew >= tEx ? { ...existing, ...item } : { ...item, ...existing });
          } else {
            mergedMap.set(d.id, item);
          }
        });
      };

      if (snapQs) addSnapDocs(snapQs);
      if (snapMcqs) addSnapDocs(snapMcqs);

      if (mergedMap.size > 0) {
        const mergedList = Array.from(mergedMap.values()) as MCQ[];
        try {
          mergeQuestionsIntoStore(mergedList as any);
        } catch {}
        // Persist to localforage IndexedDB question bank cache
        try {
          const { saveQuestionsToCache } = await import('./questionBankCache');
          saveQuestionsToCache(mergedList as any, { topicId, source: "firestore" }).catch(() => {});
        } catch {}
        return mergedList;
      }

      // If specific topicId query returned empty, try topic field fallback with strict limit to save quota
      if (topicId !== 'all') {
        const fallbackMcqsSnap = await guardedGetDocs(
          query(mcqsRef, where("topic", "==", topicId), firestoreLimit(100)),
          "Student",
          "Fetch MCQs Topic Name Fallback",
          undefined,
          10000
        ).catch(() => null);

        let fallbackQsSnap: any = null;
        if (!fallbackMcqsSnap || fallbackMcqsSnap.empty) {
          const qsRef = collection(db, "questions");
          fallbackQsSnap = await guardedGetDocs(
            query(qsRef, where("topic", "==", topicId), firestoreLimit(100)),
            "Student",
            "Fetch Questions Topic Name Fallback",
            undefined,
            10000
          ).catch(() => null);
        }

        const fallbackMap = new Map<string, any>();
        if (fallbackQsSnap && !fallbackQsSnap.empty) {
          fallbackQsSnap.docs.forEach((d: any) => {
            const item = { ...d.data(), id: d.id } as any;
            if (item.table) item.table = normalizeTableFromFirestore(item.table);
            if (item.tableData) item.tableData = normalizeTableFromFirestore(item.tableData);
            fallbackMap.set(d.id, item);
          });
        }
        if (fallbackMcqsSnap && !fallbackMcqsSnap.empty) {
          fallbackMcqsSnap.docs.forEach((d: any) => {
            const item = { ...d.data(), id: d.id } as any;
            if (item.table) item.table = normalizeTableFromFirestore(item.table);
            if (item.tableData) item.tableData = normalizeTableFromFirestore(item.tableData);
            fallbackMap.set(d.id, item);
          });
        }

        if (fallbackMap.size > 0) {
          const fallbackDocs = Array.from(fallbackMap.values()) as MCQ[];
          try {
            const { mergeQuestionsIntoStore } = await import('./questionsStorage');
            mergeQuestionsIntoStore(fallbackDocs as any);
          } catch {}
          try {
            const { saveQuestionsToCache } = await import('./questionBankCache');
            saveQuestionsToCache(fallbackDocs as any, { topicId, source: "firestore" }).catch(() => {});
          } catch {}
          return fallbackDocs;
        }
      }
    } catch (err) {
      console.warn("Could not fetch MCQs from Firestore (offline or quota):", err);
    }
  }

  // 3. Robust Offline fallback: check localforage question bank cache, then legacy per-topic localStorage key
  try {
    const { getCachedQuestionsByTopic, getAllCachedQuestions } = await import('./questionBankCache');
    const fallbackCached = topicId === 'all' 
      ? await getAllCachedQuestions() 
      : await getCachedQuestionsByTopic(topicId);
    if (fallbackCached && fallbackCached.length > 0) {
      return fallbackCached as MCQ[];
    }
  } catch (_) {}

  try {
    if (typeof localStorage !== 'undefined') {
      const stored = localStorage.getItem(`quizpro_mcqs_${topicId}`);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    }
  } catch (e) {}

  if (topicId === 'all') {
    return INITIAL_MCQS;
  }
  return [];
}

/**
 * Background non-blocking refresher for Firestore MCQs that updates localforage IndexedDB
 */
export async function fetchAndRefreshFirestoreMCQs(topicId: string): Promise<MCQ[] | null> {
  if (!isFirebaseConfigured() || (typeof navigator !== 'undefined' && navigator.onLine === false)) {
    return null;
  }
  try {
    const { collection, query, where, limit: firestoreLimit } = await import('firebase/firestore');
    const { guardedGetDocs } = await import('./quotaTracker');
    
    const mcqsRef = collection(db, "mcqs");
    const qMcqs = topicId === 'all' 
      ? query(mcqsRef, firestoreLimit(1000)) 
      : query(mcqsRef, where("topicId", "==", topicId));
      
    const snap = await guardedGetDocs(qMcqs, "Student", "Background Refresh Topic MCQs", undefined, 10000).catch(() => null);
    if (snap && !snap.empty) {
      const list = snap.docs.map((d: any) => ({ ...d.data(), id: d.id })) as MCQ[];
      const { saveQuestionsToCache } = await import('./questionBankCache');
      await saveQuestionsToCache(list as any, { topicId, source: "firestore" });
      const { mergeQuestionsIntoStore } = await import('./questionsStorage');
      mergeQuestionsIntoStore(list as any);
      return list;
    }
  } catch (_) {}
  return null;
}

/**
 * Increment and get website visitor view count.
 */
export async function getAndUpdateViewCountAsync(): Promise<number> {
  try {
    const visitsKey = 'quizpro_visitor_count';
    const lastVisitKey = 'quizpro_last_visit_time';
    const now = Date.now();
    
    let count = parseInt(localStorage.getItem(visitsKey) || '1240', 10);
    const lastVisit = parseInt(localStorage.getItem(lastVisitKey) || '0', 10);
    
    if (now - lastVisit > 30000) {
      count += 1;
      localStorage.setItem(visitsKey, count.toString());
      localStorage.setItem(lastVisitKey, now.toString());
    }

    if (isFirebaseConfigured()) {
      try {
        const dateStr = new Date().toISOString().split("T")[0];
        const { doc, getDoc } = await import('firebase/firestore');
        const docSnap = await getDoc(doc(db, "analytics_daily", dateStr));
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data && typeof data.totalVisits === "number") {
            const realCount = Math.max(count, data.totalVisits);
            localStorage.setItem(visitsKey, realCount.toString());
            return realCount;
          }
        }
      } catch (e) {
        console.warn("Could not fetch remote visitor count:", e);
      }
    }

    return count;
  } catch {
    return 1241;
  }
}

export function getAndUpdateViewCount(): number {
  try {
    const visitsKey = 'quizpro_visitor_count';
    const lastVisitKey = 'quizpro_last_visit_time';
    const now = Date.now();
    
    let count = parseInt(localStorage.getItem(visitsKey) || '1240', 10);
    const lastVisit = parseInt(localStorage.getItem(lastVisitKey) || '0', 10);
    
    if (now - lastVisit > 30000) {
      count += 1;
      localStorage.setItem(visitsKey, count.toString());
      localStorage.setItem(lastVisitKey, now.toString());
    }
    return count;
  } catch {
    return 1241;
  }
}

export interface CloudSyncResult {
  success: boolean;
  message: string;
  isFirebase: boolean;
  error?: string;
  isQuotaExceeded?: boolean;
  deletedCount?: number;
  deletedIds?: string[];
  failedIds?: string[];
  partialFailure?: boolean;
}

const CASCADE_BATCH_LIMIT = 400; // Strictly below Firestore 500-operation writeBatch limit

function chunkArray<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}

async function commitDeleteRefsInBatches(
  refs: any[],
  actionPrefix: string,
  idemPrefix: string,
  batchSize = CASCADE_BATCH_LIMIT
): Promise<{
  deletedPaths: string[];
  failedPaths: string[];
  abortedByQuota: boolean;
  lastError?: string;
}> {
  const uniqueMap = new Map<string, any>();
  for (const r of refs) {
    if (r && r.path && !uniqueMap.has(r.path)) {
      uniqueMap.set(r.path, r);
    }
  }
  const uniqueRefs = Array.from(uniqueMap.values());
  const deletedPaths: string[] = [];
  const failedPaths: string[] = [];
  let abortedByQuota = false;
  let lastError: string | undefined;

  if (uniqueRefs.length === 0) {
    return { deletedPaths, failedPaths, abortedByQuota };
  }

  const { guardedWriteBatch, isQuotaExhausted, classifyFirestoreError } = await import('./quotaTracker');
  const chunks = chunkArray(uniqueRefs, Math.max(1, Math.min(batchSize, 450)));

  for (let idx = 0; idx < chunks.length; idx++) {
    const chunk = chunks[idx];
    if (isQuotaExhausted()) {
      abortedByQuota = true;
      failedPaths.push(...chunk.map((r) => r.path));
      lastError = "Daily Firestore write quota limit reached; remaining deletes aborted safely.";
      continue;
    }

    try {
      const batch = guardedWriteBatch(db);
      for (const r of chunk) {
        batch.delete(r);
      }
      const firstPathSlug = (chunk[0]?.path || "batch").replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 32);
      await batch.commit(
        "Admin",
        `${actionPrefix} (${idx + 1}/${chunks.length})`,
        undefined,
        30000,
        `${idemPrefix}_b${idx}_${firstPathSlug}`
      );
      deletedPaths.push(...chunk.map((r) => r.path));
    } catch (err: any) {
      const info = classifyFirestoreError(err);
      lastError = err?.message || String(err);
      failedPaths.push(...chunk.map((r) => r.path));
      if (info.isQuotaError || isQuotaExhausted()) {
        abortedByQuota = true;
      }
    }
  }

  return { deletedPaths, failedPaths, abortedByQuota, lastError };
}

async function cleanupDeletedLocalEntities(opts: {
  subjectIds?: string[];
  chapterIds?: string[];
  topicIds?: string[];
  mcqIds?: string[];
}): Promise<void> {
  const subjectIds = opts.subjectIds || [];
  const chapterIds = opts.chapterIds || [];
  const topicIds = opts.topicIds || [];
  const mcqIds = opts.mcqIds || [];

  try {
    if (typeof localStorage !== "undefined") {
      subjectIds.forEach((sId) => localStorage.removeItem(`quizpro_sub_${sId}`));
      chapterIds.forEach((cId) => localStorage.removeItem(`quizpro_chap_${cId}`));
      topicIds.forEach((tId) => {
        localStorage.removeItem(`quizpro_top_${tId}`);
        localStorage.removeItem(`quizpro_mcqs_${tId}`);
      });
      mcqIds.forEach((mId) => localStorage.removeItem(`quizpro_mcq_${mId}`));
      if (mcqIds.length > 0 || topicIds.length > 0 || chapterIds.length > 0 || subjectIds.length > 0) {
        localStorage.removeItem("quizpro_mcqs_all");
      }

      // Remove deleted questions/topics/chapters/subjects from local persistent user questions store
      try {
        const { loadUserQuestionsStore, saveUserQuestionsStore } = await import('./questionsStorage');
        const store = loadUserQuestionsStore();
        const subSet = new Set(subjectIds);
        const chapSet = new Set(chapterIds);
        const topSet = new Set(topicIds);
        const mcqSet = new Set(mcqIds);

        const keepQ = (q: any) =>
          q &&
          !mcqSet.has(q.id) &&
          !topSet.has(q.topicId) &&
          !chapSet.has(q.chapterId) &&
          !subSet.has(q.subjectId);

        let mutated = false;
        if (Array.isArray(store.customQuestions)) {
          const next = store.customQuestions.filter(keepQ);
          if (next.length !== store.customQuestions.length) {
            store.customQuestions = next;
            mutated = true;
          }
        }
        if (Array.isArray(store.cloudCacheQuestions)) {
          const next = store.cloudCacheQuestions.filter(keepQ);
          if (next.length !== store.cloudCacheQuestions.length) {
            store.cloudCacheQuestions = next;
            mutated = true;
          }
        }
        if (Array.isArray(store.deletedQuestionIds) && mcqIds.length > 0) {
          const nextDeleted = Array.from(new Set([...store.deletedQuestionIds, ...mcqIds]));
          if (nextDeleted.length !== store.deletedQuestionIds.length) {
            store.deletedQuestionIds = nextDeleted;
            mutated = true;
          }
        }
        if (mutated) {
          saveUserQuestionsStore(store);
        }
      } catch {}
    }
  } catch {}

  if (topicIds.length > 0) {
    try {
      const { invalidateBundleCache } = await import('./questionBundleService');
      await Promise.all(topicIds.map((tId) => invalidateBundleCache(tId).catch(() => {})));
    } catch {}
  }

  if (mcqIds.length > 0 || topicIds.length > 0) {
    try {
      const { removeQuestionsFromCache } = await import('./questionBankCache');
      await removeQuestionsFromCache(mcqIds, topicIds).catch(() => {});
    } catch {}
  }
}

export async function saveSubject(subject: any): Promise<CloudSyncResult> {
  try {
    localStorage.setItem(`quizpro_sub_${subject.id}`, JSON.stringify(subject));
    const { getEffectiveAuthUser, guardedSetDoc, clearFirestoreCache } = await import('./quotaTracker');
    if (isFirebaseConfigured() && getEffectiveAuthUser()) {
      const { doc } = await import('firebase/firestore');
      clearFirestoreCache();
      await guardedSetDoc(
        doc(db, "subjects", subject.id),
        subject,
        { merge: true },
        "Admin",
        "Save Subject"
      );

      try {
        const { bumpRemoteCurriculumVersion } = await import('./appVersionService');
        await bumpRemoteCurriculumVersion(undefined, undefined, { reason: `saveSubject:${subject.id}` });
      } catch (_) {}

      try {
        const { triggerAdminToast } = await import('./adminToast');
        triggerAdminToast("success", "Subject Saved to Firebase", `Subject '${subject.name || subject.hindiName}' saved to Firestore & live to users.`);
      } catch (_) {}

      return {
        success: true,
        message: `Subject '${subject.name || subject.hindiName}' saved to Firebase Firestore!`,
        isFirebase: true
      };
    }
    return {
      success: true,
      message: `Subject '${subject.name || subject.hindiName}' saved locally!`,
      isFirebase: false
    };
  } catch (err: any) {
    const msg = err?.message || String(err);
    if (err?.code === "deadline-exceeded" || err?.code === "resource-exhausted" || msg.includes("Timeout") || msg.includes("quota")) {
      console.warn("Subject cloud sync deferred (saved locally & queued):", msg);
      return {
        success: true,
        message: `Subject '${subject.name || subject.hindiName}' saved locally (cloud sync queued)!`,
        isFirebase: false
      };
    }
    console.warn("Error saving subject to cloud:", err);
    return {
      success: false,
      message: `Failed to save subject to Firebase: ${msg}`,
      isFirebase: true,
      error: msg
    };
  }
}

export async function deleteSubjectFromCloud(id: string): Promise<CloudSyncResult> {
  try {
    if (isFirebaseConfigured()) {
      const { doc, collection, query, where, limit } = await import('firebase/firestore');
      const { getEffectiveAuthUser, guardedGetDocs, clearFirestoreCache } = await import('./quotaTracker');
      if (!getEffectiveAuthUser()) {
        throw new Error("Authentication Required: Please log in with an authorized admin account to delete from Firebase.");
      }
      clearFirestoreCache();

      const chapterIds = new Set<string>();
      const topicIds = new Set<string>();
      const mcqIds = new Set<string>();
      const refsToDelete: any[] = [doc(db, "subjects", id)];

      // 1. Targeted query for chapters under this subject
      const chaptersSnap = await guardedGetDocs(
        query(collection(db, "chapters"), where("subjectId", "==", id)),
        "Admin",
        "Find Chapters For Subject Delete"
      ).catch(() => null);

      if (chaptersSnap && !chaptersSnap.empty) {
        for (const chDoc of chaptersSnap.docs) {
          chapterIds.add(chDoc.id);
          refsToDelete.push(doc(db, "chapters", chDoc.id));
          const embeddedTopics = (chDoc.data() as any)?.topics;
          if (Array.isArray(embeddedTopics)) {
            for (const t of embeddedTopics) {
              if (t?.id) topicIds.add(t.id);
            }
          }
        }
      }

      // 2. Targeted queries for topics (by subjectId and chunked chapterIds)
      const topicsBySubSnap = await guardedGetDocs(
        query(collection(db, "topics"), where("subjectId", "==", id)),
        "Admin",
        "Find Topics By Subject"
      ).catch(() => null);
      if (topicsBySubSnap && !topicsBySubSnap.empty) {
        topicsBySubSnap.docs.forEach((d) => topicIds.add(d.id));
      }

      for (const chChunk of chunkArray(Array.from(chapterIds), 30)) {
        const topicsByChSnap = await guardedGetDocs(
          query(collection(db, "topics"), where("chapterId", "in", chChunk)),
          "Admin",
          "Find Topics By Chapter Chunk"
        ).catch(() => null);
        if (topicsByChSnap && !topicsByChSnap.empty) {
          topicsByChSnap.docs.forEach((d) => topicIds.add(d.id));
        }
      }

      for (const tId of topicIds) {
        refsToDelete.push(doc(db, "topics", tId));
        refsToDelete.push(doc(db, "question_bundles", `topic_${tId}`));
      }

      // 3. Targeted queries for mcqs and mirror questions (by subjectId, chapterId chunks, and topicId chunks)
      const collectMcqsFromSnap = (snap: any, coll: "mcqs" | "questions") => {
        if (!snap || snap.empty) return;
        snap.docs.forEach((d: any) => {
          mcqIds.add(d.id);
          refsToDelete.push(doc(db, coll, d.id));
        });
      };

      const [mcqsBySubSnap, qsBySubSnap] = await Promise.all([
        guardedGetDocs(query(collection(db, "mcqs"), where("subjectId", "==", id)), "Admin", "Find MCQs By Subject").catch(() => null),
        guardedGetDocs(query(collection(db, "questions"), where("subjectId", "==", id)), "Admin", "Find Questions By Subject").catch(() => null),
      ]);
      collectMcqsFromSnap(mcqsBySubSnap, "mcqs");
      collectMcqsFromSnap(qsBySubSnap, "questions");

      for (const chChunk of chunkArray(Array.from(chapterIds), 30)) {
        const [mSnap, qSnap] = await Promise.all([
          guardedGetDocs(query(collection(db, "mcqs"), where("chapterId", "in", chChunk)), "Admin", "Find MCQs By Chapter Chunk").catch(() => null),
          guardedGetDocs(query(collection(db, "questions"), where("chapterId", "in", chChunk)), "Admin", "Find Questions By Chapter Chunk").catch(() => null),
        ]);
        collectMcqsFromSnap(mSnap, "mcqs");
        collectMcqsFromSnap(qSnap, "questions");
      }

      for (const tChunk of chunkArray(Array.from(topicIds), 30)) {
        const [mSnap, qSnap] = await Promise.all([
          guardedGetDocs(query(collection(db, "mcqs"), where("topicId", "in", tChunk)), "Admin", "Find MCQs By Topic Chunk").catch(() => null),
          guardedGetDocs(query(collection(db, "questions"), where("topicId", "in", tChunk)), "Admin", "Find Questions By Topic Chunk").catch(() => null),
        ]);
        collectMcqsFromSnap(mSnap, "mcqs");
        collectMcqsFromSnap(qSnap, "questions");
      }

      // Ensure mirror deletion if a question existed only in one query result
      for (const mId of mcqIds) {
        refsToDelete.push(doc(db, "mcqs", mId));
        refsToDelete.push(doc(db, "questions", mId));
      }

      // 4. Batched delete (<= 400 ops/batch)
      const batchRes = await commitDeleteRefsInBatches(
        refsToDelete,
        `Cascade Delete Subject ${id}`,
        `del_subj_${id}`
      );

      // 5. Verify child references before completion (if no batch failures)
      if (batchRes.failedPaths.length === 0) {
        const [remCh, remTop, remMcq] = await Promise.all([
          guardedGetDocs(query(collection(db, "chapters"), where("subjectId", "==", id), limit(1)), "Admin", "Verify Subject Chapters Deleted").catch(() => null),
          guardedGetDocs(query(collection(db, "topics"), where("subjectId", "==", id), limit(1)), "Admin", "Verify Subject Topics Deleted").catch(() => null),
          guardedGetDocs(query(collection(db, "mcqs"), where("subjectId", "==", id), limit(1)), "Admin", "Verify Subject MCQs Deleted").catch(() => null),
        ]);
        const orphanPaths: string[] = [];
        if (remCh && !remCh.empty) orphanPaths.push(...remCh.docs.map((d) => `chapters/${d.id}`));
        if (remTop && !remTop.empty) orphanPaths.push(...remTop.docs.map((d) => `topics/${d.id}`));
        if (remMcq && !remMcq.empty) orphanPaths.push(...remMcq.docs.map((d) => `mcqs/${d.id}`));
        if (orphanPaths.length > 0) {
          batchRes.failedPaths.push(...orphanPaths);
          batchRes.lastError = `Residual child references remain after subject delete: ${orphanPaths.join(", ")}`;
        }
      }

      await cleanupDeletedLocalEntities({
        subjectIds: [id],
        chapterIds: Array.from(chapterIds),
        topicIds: Array.from(topicIds),
        mcqIds: Array.from(mcqIds),
      });

      const deletedTopicList = Array.from(topicIds);
      if (batchRes.deletedPaths.length > 0 && !batchRes.abortedByQuota) {
        try {
          const { bumpRemoteCurriculumVersion } = await import('./appVersionService');
          await bumpRemoteCurriculumVersion(deletedTopicList, undefined, {
            reason: `deleteSubject:${id}`,
          });
        } catch (_) {}
      }

      if (batchRes.failedPaths.length > 0) {
        return {
          success: false,
          message: `Partial failure deleting subject '${id}': ${batchRes.deletedPaths.length} deleted, ${batchRes.failedPaths.length} failed.`,
          isFirebase: true,
          isQuotaExceeded: batchRes.abortedByQuota,
          partialFailure: true,
          deletedCount: batchRes.deletedPaths.length,
          deletedIds: batchRes.deletedPaths,
          failedIds: batchRes.failedPaths,
          error: batchRes.lastError || "Partial failure during cascade delete.",
        };
      }

      triggerAdminToast("delete", "Subject Deleted from Firebase", `Subject ID '${id}' and all its chapters/topics (${batchRes.deletedPaths.length} docs) removed from Firestore.`);
      return {
        success: true,
        message: `Subject and its associated chapters/topics deleted from Firebase Firestore!`,
        isFirebase: true,
        deletedCount: batchRes.deletedPaths.length,
        deletedIds: batchRes.deletedPaths,
        failedIds: [],
      };
    }

    await cleanupDeletedLocalEntities({ subjectIds: [id] });
    return {
      success: true,
      message: `Subject deleted from local storage!`,
      isFirebase: false,
      deletedCount: 1,
      deletedIds: [`subjects/${id}`],
    };
  } catch (err: any) {
    console.error("Error deleting subject from cloud:", err);
    return {
      success: false,
      message: `Failed to delete subject from Firebase: ${err?.message || String(err)}`,
      isFirebase: true,
      error: err?.message || String(err)
    };
  }
}

export async function saveChapter(chapter: any): Promise<CloudSyncResult> {
  try {
    localStorage.setItem(`quizpro_chap_${chapter.id}`, JSON.stringify(chapter));
    const { getEffectiveAuthUser, guardedSetDoc, clearFirestoreCache } = await import('./quotaTracker');
    if (isFirebaseConfigured() && getEffectiveAuthUser()) {
      const { doc } = await import('firebase/firestore');
      clearFirestoreCache();
      await guardedSetDoc(
        doc(db, "chapters", chapter.id),
        chapter,
        { merge: true },
        "Admin",
        "Save Chapter"
      );

      try {
        const { bumpRemoteCurriculumVersion } = await import('./appVersionService');
        await bumpRemoteCurriculumVersion(undefined, undefined, { reason: `saveChapter:${chapter.id}` });
      } catch (_) {}

      try {
        const { triggerAdminToast } = await import('./adminToast');
        triggerAdminToast("success", "Chapter Saved to Firebase", `Chapter '${chapter.name || chapter.title}' saved to Firestore & live to users.`);
      } catch (_) {}

      return {
        success: true,
        message: `Chapter '${chapter.name || chapter.title}' saved to Firebase Firestore!`,
        isFirebase: true
      };
    }
    return {
      success: true,
      message: `Chapter saved locally!`,
      isFirebase: false
    };
  } catch (err: any) {
    console.error("Error saving chapter to cloud:", err);
    return {
      success: false,
      message: `Failed to save chapter to Firebase: ${err?.message || String(err)}`,
      isFirebase: true,
      error: err?.message || String(err)
    };
  }
}

export async function deleteChapterFromCloud(id: string): Promise<CloudSyncResult> {
  try {
    if (isFirebaseConfigured()) {
      const { doc, collection, query, where, limit } = await import('firebase/firestore');
      const { getEffectiveAuthUser, guardedGetDoc, guardedGetDocs, clearFirestoreCache } = await import('./quotaTracker');
      if (!getEffectiveAuthUser()) {
        throw new Error("Authentication Required: Please log in with an authorized admin account to delete from Firebase.");
      }
      clearFirestoreCache();

      const topicIds = new Set<string>();
      const mcqIds = new Set<string>();
      const refsToDelete: any[] = [doc(db, "chapters", id)];

      // 1. Read chapter doc (1 read) to gather any embedded topic IDs before deletion
      const chSnap = await guardedGetDoc(doc(db, "chapters", id), "Admin", "Read Chapter For Cascade Delete").catch(() => null);
      if (chSnap && chSnap.exists()) {
        const embeddedTopics = (chSnap.data() as any)?.topics;
        if (Array.isArray(embeddedTopics)) {
          for (const t of embeddedTopics) {
            if (t?.id) topicIds.add(t.id);
          }
        }
      }

      // 2. Targeted query for topics belonging to this chapter
      const topicsSnap = await guardedGetDocs(
        query(collection(db, "topics"), where("chapterId", "==", id)),
        "Admin",
        "Find Topics By Chapter"
      ).catch(() => null);
      if (topicsSnap && !topicsSnap.empty) {
        topicsSnap.docs.forEach((d) => topicIds.add(d.id));
      }

      for (const tId of topicIds) {
        refsToDelete.push(doc(db, "topics", tId));
        refsToDelete.push(doc(db, "question_bundles", `topic_${tId}`));
      }

      // 3. Targeted queries for mcqs & mirror questions (by chapterId and chunked topicIds)
      const collectMcqRefs = (snap: any, coll: "mcqs" | "questions") => {
        if (!snap || snap.empty) return;
        snap.docs.forEach((d: any) => {
          mcqIds.add(d.id);
          refsToDelete.push(doc(db, coll, d.id));
        });
      };

      const [mcqsByChSnap, qsByChSnap] = await Promise.all([
        guardedGetDocs(query(collection(db, "mcqs"), where("chapterId", "==", id)), "Admin", "Find MCQs By Chapter").catch(() => null),
        guardedGetDocs(query(collection(db, "questions"), where("chapterId", "==", id)), "Admin", "Find Questions By Chapter").catch(() => null),
      ]);
      collectMcqRefs(mcqsByChSnap, "mcqs");
      collectMcqRefs(qsByChSnap, "questions");

      for (const tChunk of chunkArray(Array.from(topicIds), 30)) {
        const [mSnap, qSnap] = await Promise.all([
          guardedGetDocs(query(collection(db, "mcqs"), where("topicId", "in", tChunk)), "Admin", "Find MCQs By Topic Chunk").catch(() => null),
          guardedGetDocs(query(collection(db, "questions"), where("topicId", "in", tChunk)), "Admin", "Find Questions By Topic Chunk").catch(() => null),
        ]);
        collectMcqRefs(mSnap, "mcqs");
        collectMcqRefs(qSnap, "questions");
      }

      for (const mId of mcqIds) {
        refsToDelete.push(doc(db, "mcqs", mId));
        refsToDelete.push(doc(db, "questions", mId));
      }

      // 4. Batched delete (<= 400 ops/batch)
      const batchRes = await commitDeleteRefsInBatches(
        refsToDelete,
        `Cascade Delete Chapter ${id}`,
        `del_chap_${id}`
      );

      // 5. Verify child references before completion
      if (batchRes.failedPaths.length === 0) {
        const [remTop, remMcq] = await Promise.all([
          guardedGetDocs(query(collection(db, "topics"), where("chapterId", "==", id), limit(1)), "Admin", "Verify Chapter Topics Deleted").catch(() => null),
          guardedGetDocs(query(collection(db, "mcqs"), where("chapterId", "==", id), limit(1)), "Admin", "Verify Chapter MCQs Deleted").catch(() => null),
        ]);
        const orphanPaths: string[] = [];
        if (remTop && !remTop.empty) orphanPaths.push(...remTop.docs.map((d) => `topics/${d.id}`));
        if (remMcq && !remMcq.empty) orphanPaths.push(...remMcq.docs.map((d) => `mcqs/${d.id}`));
        if (orphanPaths.length > 0) {
          batchRes.failedPaths.push(...orphanPaths);
          batchRes.lastError = `Residual child references remain after chapter delete: ${orphanPaths.join(", ")}`;
        }
      }

      const deletedTopicList = Array.from(topicIds);
      await cleanupDeletedLocalEntities({
        chapterIds: [id],
        topicIds: deletedTopicList,
        mcqIds: Array.from(mcqIds),
      });

      if (batchRes.deletedPaths.length > 0 && !batchRes.abortedByQuota) {
        try {
          const { bumpRemoteCurriculumVersion } = await import('./appVersionService');
          await bumpRemoteCurriculumVersion(deletedTopicList, undefined, { reason: `deleteChapter:${id}` });
        } catch (_) {}
      }

      if (batchRes.failedPaths.length > 0) {
        return {
          success: false,
          message: `Partial failure deleting chapter '${id}': ${batchRes.deletedPaths.length} deleted, ${batchRes.failedPaths.length} failed.`,
          isFirebase: true,
          isQuotaExceeded: batchRes.abortedByQuota,
          partialFailure: true,
          deletedCount: batchRes.deletedPaths.length,
          deletedIds: batchRes.deletedPaths,
          failedIds: batchRes.failedPaths,
          error: batchRes.lastError || "Partial failure during chapter cascade delete.",
        };
      }

      triggerAdminToast("delete", "Chapter Deleted from Firebase", `Chapter ID '${id}' and its topics (${batchRes.deletedPaths.length} docs) were removed from Firestore.`);
      return {
        success: true,
        message: `Chapter and its topics deleted from Firebase Firestore!`,
        isFirebase: true,
        deletedCount: batchRes.deletedPaths.length,
        deletedIds: batchRes.deletedPaths,
        failedIds: [],
      };
    }

    await cleanupDeletedLocalEntities({ chapterIds: [id] });
    return {
      success: true,
      message: `Chapter deleted locally!`,
      isFirebase: false,
      deletedCount: 1,
      deletedIds: [`chapters/${id}`],
    };
  } catch (err: any) {
    console.error("Error deleting chapter from cloud:", err);
    return {
      success: false,
      message: `Failed to delete chapter from Firebase: ${err?.message || String(err)}`,
      isFirebase: true,
      error: err?.message || String(err)
    };
  }
}

export async function saveTopic(topic: any): Promise<CloudSyncResult> {
  try {
    localStorage.setItem(`quizpro_top_${topic.id}`, JSON.stringify(topic));
    const { getEffectiveAuthUser, guardedSetDoc, guardedGetDoc, clearFirestoreCache } = await import('./quotaTracker');
    if (isFirebaseConfigured() && getEffectiveAuthUser()) {
      const { doc } = await import('firebase/firestore');
      clearFirestoreCache();

      // 1. Save directly to topics collection
      await guardedSetDoc(
        doc(db, "topics", topic.id),
        topic,
        { merge: true },
        "Admin",
        "Save Topic"
      );

      // 2. Also ensure parent chapter document in chapters collection has this updated topic in its topics array
      let resolvedChapterId = topic.chapterId;
      if (!resolvedChapterId) {
        try {
          const { loadUserQuestionsStore } = await import('./questionsStorage');
          const store = loadUserQuestionsStore();
          const matchingChap = (store.customChapters || []).find((c: any) =>
            Array.isArray(c.topics) && c.topics.some((t: any) => t.id === topic.id)
          );
          if (matchingChap) resolvedChapterId = matchingChap.id;
        } catch (_) {}
      }
      if (!resolvedChapterId) {
        try {
          const { collection } = await import('firebase/firestore');
          const { guardedGetDocs } = await import('./quotaTracker');
          const chapsSnap = await guardedGetDocs(collection(db, "chapters"), "Admin", "Find Chapter For Topic Update");
          if (chapsSnap && !chapsSnap.empty) {
            for (const cDoc of chapsSnap.docs) {
              const cData = cDoc.data();
              if (Array.isArray(cData.topics) && cData.topics.some((t: any) => t.id === topic.id)) {
                resolvedChapterId = cDoc.id;
                break;
              }
            }
          }
        } catch (_) {}
      }

      if (resolvedChapterId) {
        try {
          const chDocRef = doc(db, "chapters", resolvedChapterId);
          const chSnap = await guardedGetDoc(chDocRef, "Admin", "Read Chapter For Topic Save");
          if (chSnap.exists()) {
            const chData = chSnap.data();
            const currentTopics: any[] = Array.isArray(chData.topics) ? chData.topics : [];
            const idx = currentTopics.findIndex((t: any) => t.id === topic.id);
            const topicSummary = {
              id: topic.id,
              chapterId: resolvedChapterId,
              title: topic.name || topic.title || "Unnamed Topic",
              hindiTitle: topic.hindiTitle || topic.title || "Unnamed Topic",
              number: topic.number || (idx >= 0 ? currentTopics[idx].number : currentTopics.length + 1),
              questionCount: topic.questionCount || (idx >= 0 ? currentTopics[idx].questionCount : 0)
            };
            let nextTopics: any[];
            if (idx >= 0) {
              nextTopics = [...currentTopics];
              nextTopics[idx] = { ...nextTopics[idx], ...topicSummary };
            } else {
              nextTopics = [...currentTopics, topicSummary];
            }
            await guardedSetDoc(chDocRef, { ...chData, topics: nextTopics, updatedAt: new Date().toISOString() }, { merge: true }, "Admin", "Sync Chapter Topics On Save");
          }
        } catch (chErr) {
          console.warn("Could not sync topic to parent chapter:", chErr);
        }
      }

      // Clear local topic query caches
      try {
        localStorage.removeItem(`quizpro_mcqs_${topic.id}`);
        localStorage.removeItem(`quizpro_top_${topic.id}`);
      } catch (_) {}

      // 3. Bump curriculum version so connected user apps detect update
      try {
        const { bumpRemoteCurriculumVersion } = await import('./appVersionService');
        await bumpRemoteCurriculumVersion([topic.id], undefined, { reason: `saveTopic:${topic.id}` });
      } catch (_) {}

      try {
        const { triggerAdminToast } = await import('./adminToast');
        triggerAdminToast("success", "Topic Saved to Firebase", `Topic '${topic.name || topic.title}' saved to Firestore & live to users.`);
      } catch (_) {}

      return {
        success: true,
        message: `Topic '${topic.name || topic.title}' saved to Firebase Firestore!`,
        isFirebase: true
      };
    }
    return {
      success: true,
      message: `Topic saved locally!`,
      isFirebase: false
    };
  } catch (err: any) {
    console.error("Error saving topic to cloud:", err);
    return {
      success: false,
      message: `Failed to save topic to Firebase: ${err?.message || String(err)}`,
      isFirebase: true,
      error: err?.message || String(err)
    };
  }
}

export async function deleteTopicFromCloud(id: string, chapterId?: string): Promise<CloudSyncResult> {
  try {
    if (isFirebaseConfigured()) {
      const { doc, collection, query, where, limit } = await import('firebase/firestore');
      const {
        getEffectiveAuthUser,
        guardedGetDoc,
        guardedSetDoc,
        guardedGetDocs,
        clearFirestoreCache,
      } = await import('./quotaTracker');
      if (!getEffectiveAuthUser()) {
        throw new Error("Authentication Required: Please log in with an authorized admin account to delete from Firebase.");
      }
      clearFirestoreCache();

      // 1. Resolve parent chapterId without scanning the whole chapters collection when possible
      let resolvedChapterId = chapterId;
      if (!resolvedChapterId) {
        try {
          const topSnap = await guardedGetDoc(doc(db, "topics", id), "Admin", "Read Topic For Parent Chapter").catch(() => null);
          if (topSnap && topSnap.exists()) {
            resolvedChapterId = (topSnap.data() as any)?.chapterId;
          }
        } catch (_) {}
      }
      if (!resolvedChapterId) {
        try {
          const { loadUserQuestionsStore } = await import('./questionsStorage');
          const store = loadUserQuestionsStore();
          const chMatch = (store.customChapters || []).find((c: any) =>
            Array.isArray(c.topics) && c.topics.some((t: any) => t.id === id)
          );
          if (chMatch) resolvedChapterId = chMatch.id;
        } catch (_) {}
      }

      // 2. Targeted query for MCQs belonging to this topic in `mcqs` and `questions`
      const mcqIds = new Set<string>();
      const refsToDelete: any[] = [
        doc(db, "topics", id),
        doc(db, "question_bundles", `topic_${id}`),
      ];

      const [mcqsSnap, qsSnap] = await Promise.all([
        guardedGetDocs(query(collection(db, "mcqs"), where("topicId", "==", id)), "Admin", "Find MCQs By Topic").catch(() => null),
        guardedGetDocs(query(collection(db, "questions"), where("topicId", "==", id)), "Admin", "Find Questions By Topic").catch(() => null),
      ]);

      if (mcqsSnap && !mcqsSnap.empty) {
        mcqsSnap.docs.forEach((d) => {
          mcqIds.add(d.id);
          refsToDelete.push(doc(db, "mcqs", d.id));
        });
      }
      if (qsSnap && !qsSnap.empty) {
        qsSnap.docs.forEach((d) => {
          mcqIds.add(d.id);
          refsToDelete.push(doc(db, "questions", d.id));
        });
      }
      for (const mId of mcqIds) {
        refsToDelete.push(doc(db, "mcqs", mId));
        refsToDelete.push(doc(db, "questions", mId));
      }

      // 3. Remove topic reference from parent chapter ONLY if present (targeted single-doc read, no full scan)
      if (resolvedChapterId) {
        try {
          const chDocRef = doc(db, "chapters", resolvedChapterId);
          const chSnap = await guardedGetDoc(chDocRef, "Admin", "Read Chapter For Topic Delete");
          if (chSnap.exists()) {
            const chData = chSnap.data();
            const currentTopics: any[] = Array.isArray(chData.topics) ? chData.topics : [];
            const cleanedTopics = currentTopics.filter((t: any) => t.id !== id);
            if (cleanedTopics.length !== currentTopics.length) {
              await guardedSetDoc(
                chDocRef,
                { ...chData, topics: cleanedTopics, updatedAt: new Date().toISOString() },
                { merge: true },
                "Admin",
                "Update Chapter Topics On Delete"
              );
            }
          }
        } catch (e) {
          console.warn("Failed to clean topic from parent chapter:", e);
        }
      }

      // 4. Batched delete of topic, bundle, and all child MCQs (<= 400 ops/batch)
      const batchRes = await commitDeleteRefsInBatches(
        refsToDelete,
        `Cascade Delete Topic ${id}`,
        `del_top_${id}`
      );

      // 5. Verify child references before completion
      if (batchRes.failedPaths.length === 0) {
        const [remMcqs, remQs] = await Promise.all([
          guardedGetDocs(query(collection(db, "mcqs"), where("topicId", "==", id), limit(1)), "Admin", "Verify Topic MCQs Deleted").catch(() => null),
          guardedGetDocs(query(collection(db, "questions"), where("topicId", "==", id), limit(1)), "Admin", "Verify Topic Questions Deleted").catch(() => null),
        ]);
        const orphanPaths: string[] = [];
        if (remMcqs && !remMcqs.empty) orphanPaths.push(...remMcqs.docs.map((d) => `mcqs/${d.id}`));
        if (remQs && !remQs.empty) orphanPaths.push(...remQs.docs.map((d) => `questions/${d.id}`));
        if (orphanPaths.length > 0) {
          batchRes.failedPaths.push(...orphanPaths);
          batchRes.lastError = `Residual child MCQs remain after topic delete: ${orphanPaths.join(", ")}`;
        }
      }

      await cleanupDeletedLocalEntities({
        topicIds: [id],
        mcqIds: Array.from(mcqIds),
      });

      // 6. Single version bump on completion (if any docs deleted and quota not tripped)
      if (batchRes.deletedPaths.length > 0 && !batchRes.abortedByQuota) {
        try {
          const { bumpRemoteCurriculumVersion } = await import('./appVersionService');
          await bumpRemoteCurriculumVersion([id], undefined, { reason: `deleteTopic:${id}` });
        } catch (_) {}
      }

      if (batchRes.failedPaths.length > 0) {
        return {
          success: false,
          message: `Partial failure deleting topic '${id}': ${batchRes.deletedPaths.length} deleted, ${batchRes.failedPaths.length} failed.`,
          isFirebase: true,
          isQuotaExceeded: batchRes.abortedByQuota,
          partialFailure: true,
          deletedCount: batchRes.deletedPaths.length,
          deletedIds: batchRes.deletedPaths,
          failedIds: batchRes.failedPaths,
          error: batchRes.lastError || "Partial failure during topic cascade delete.",
        };
      }

      triggerAdminToast("delete", "Topic Deleted from Firebase", `Topic ID '${id}' successfully removed from Firestore (${batchRes.deletedPaths.length} docs).`);
      return {
        success: true,
        message: `Topic deleted from Firebase Firestore!`,
        isFirebase: true,
        deletedCount: batchRes.deletedPaths.length,
        deletedIds: batchRes.deletedPaths,
        failedIds: [],
      };
    }

    await cleanupDeletedLocalEntities({ topicIds: [id] });
    return {
      success: true,
      message: `Topic deleted locally!`,
      isFirebase: false,
      deletedCount: 1,
      deletedIds: [`topics/${id}`],
    };
  } catch (err: any) {
    console.error("Error deleting topic from cloud:", err);
    return {
      success: false,
      message: `Failed to delete topic from Firebase: ${err?.message || String(err)}`,
      isFirebase: true,
      error: err?.message || String(err)
    };
  }
}

export async function generateDeterministicMCQId(text: string, topicId: string): Promise<string> {
  const cleanText = (text || "").trim().toLowerCase();
  const cleanTopic = (topicId || "general").trim().toLowerCase();
  const input = `${cleanText}_${cleanTopic}`;
  if (typeof window !== "undefined" && window.crypto && window.crypto.subtle) {
    try {
      const encoder = new TextEncoder();
      const data = encoder.encode(input);
      const hashBuffer = await window.crypto.subtle.digest("SHA-256", data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
      return `mcq_${hashHex.substring(0, 32)}`;
    } catch (e) {
      // Fallback
    }
  }
  let hash = 5381;
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 33) ^ input.charCodeAt(i);
  }
  return `mcq_${(hash >>> 0).toString(16)}`;
}

export async function saveMCQ(mcq: any): Promise<CloudSyncResult> {
  try {
    const textVal = mcq.text || mcq.question || "Untitled Question";
    const topicIdVal = mcq.topicId || "topic_general";
    // CRITICAL: Preserve stable document ID if question already has one
    const stableId = mcq.id || (await generateDeterministicMCQId(textVal, topicIdVal));
    
    const enrichedMcq = {
      ...mcq,
      id: stableId,
      topicId: topicIdVal,
    };

    if (typeof localStorage !== "undefined") {
      try {
        localStorage.setItem(`quizpro_mcq_${stableId}`, JSON.stringify(enrichedMcq));
      } catch (_) {}
    }
    if (isFirebaseConfigured()) {
      const { doc } = await import('firebase/firestore');
      const { getEffectiveAuthUser, guardedSetDoc, clearFirestoreCache } = await import('./quotaTracker');
      if (!getEffectiveAuthUser()) {
        throw new Error("Authentication Required: Please log in with an authorized admin account to save to the cloud.");
      }
      clearFirestoreCache();
      // Ensure all required fields for Firestore security rules (isValidMCQ)
      const optionsVal = Array.isArray(enrichedMcq.options) && enrichedMcq.options.length >= 2 
        ? enrichedMcq.options 
        : ["Option A", "Option B"];
      const correctIdxVal = typeof enrichedMcq.correctIndex === "number" 
        ? enrichedMcq.correctIndex 
        : (typeof enrichedMcq.correctAnswer === "number" ? enrichedMcq.correctAnswer : 0);
      const explanationVal = enrichedMcq.explanation || "No explanation provided.";

      const firestoreMcq = {
        id: stableId,
        topicId: topicIdVal,
        chapterId: enrichedMcq.chapterId || "chapter_general",
        subjectId: enrichedMcq.subjectId || "economics",
        text: textVal,
        options: optionsVal,
        correctIndex: correctIdxVal,
        explanation: explanationVal,
        ...(enrichedMcq.hindiText ? { hindiText: enrichedMcq.hindiText } : {}),
        ...(enrichedMcq.hindiOptions ? { hindiOptions: enrichedMcq.hindiOptions } : {}),
        ...(enrichedMcq.hindiExplanation ? { hindiExplanation: enrichedMcq.hindiExplanation } : {}),
        ...(enrichedMcq.difficulty ? { difficulty: enrichedMcq.difficulty } : {}),
        ...(enrichedMcq.isTest !== undefined ? { isTest: enrichedMcq.isTest } : {}),
        ...(enrichedMcq.isUserAdded !== undefined ? { isUserAdded: enrichedMcq.isUserAdded } : {}),
        ...(enrichedMcq.createdAt ? { createdAt: enrichedMcq.createdAt } : {}),
        ...(enrichedMcq.paperId ? { paperId: enrichedMcq.paperId } : {}),
        ...(enrichedMcq.testId ? { testId: enrichedMcq.testId } : {}),
        updatedAt: new Date().toISOString()
      };

      await guardedSetDoc(
        doc(db, "mcqs", stableId),
        firestoreMcq,
        { merge: true },
        "Admin",
        "Save MCQ"
      );

      // Phase 4: Eliminated redundant mirror write to legacy 'questions' collection.
      // Canonical question data is stored exclusively in 'mcqs'.

      // Invalidate topic MCQ query cache
      try {
        localStorage.removeItem(`quizpro_mcqs_${topicIdVal}`);
        localStorage.removeItem("quizpro_mcqs_all");
      } catch (_) {}

      // Bump curriculum version in Firestore so all user devices receive updated question
      try {
        const { bumpRemoteCurriculumVersion } = await import('./appVersionService');
        await bumpRemoteCurriculumVersion([topicIdVal]);
      } catch (_) {}

      triggerAdminToast("success", "Question Updated in Firebase", `Question '${stableId}' saved to Firestore & synced to user apps.`);

      return {
        success: true,
        message: `Question saved to Firebase Firestore & synced to user apps!`,
        isFirebase: true
      };
    }
    return {
      success: true,
      message: `Question saved locally!`,
      isFirebase: false
    };
  } catch (err: any) {
    console.error("Error saving MCQ to cloud:", err);
    return {
      success: false,
      message: `Failed to save question to Firebase: ${err?.message || String(err)}`,
      isFirebase: true,
      error: err?.message || String(err)
    };
  }
}

export interface MoveMCQsResult {
  success: boolean;
  movedCount: number;
  totalRequested: number;
  message: string;
  isFirebase: boolean;
  failedIds?: string[];
  error?: string;
}

/**
 * Executes a true, atomic, idempotent MOVE operation for MCQs.
 * Updates the existing documents in-place without generating new IDs or leaving orphan copies.
 */
export async function moveMCQsInCloud(
  questionIds: string[],
  targetChapterId: string,
  targetTopicId: string,
  targetSubjectId?: string,
  questionsMap?: Record<string, any>
): Promise<MoveMCQsResult> {
  const uniqueIds = Array.from(new Set(questionIds.filter(Boolean)));
  if (uniqueIds.length === 0) {
    return {
      success: true,
      movedCount: 0,
      totalRequested: 0,
      message: "No questions selected to move.",
      isFirebase: false,
    };
  }

  // 1. Update localStorage cache for each moved question
  try {
    for (const id of uniqueIds) {
      const localKey = `quizpro_mcq_${id}`;
      const itemStr = localStorage.getItem(localKey);
      if (itemStr) {
        try {
          const item = JSON.parse(itemStr);
          item.topicId = targetTopicId;
          item.chapterId = targetChapterId;
          if (targetSubjectId) item.subjectId = targetSubjectId;
          item.updatedAt = new Date().toISOString();
          localStorage.setItem(localKey, JSON.stringify(item));
        } catch {
          // ignore parsing error on individual local cache
        }
      }
    }
    // Invalidate cached query results for destination and source topics
    try {
      localStorage.removeItem(`quizpro_mcqs_${targetTopicId}`);
      for (const id of uniqueIds) {
        const existing = questionsMap?.[id];
        if (existing?.topicId) localStorage.removeItem(`quizpro_mcqs_${existing.topicId}`);
      }
    } catch {}
  } catch (e) {
    console.warn("Could not update local storage cache during move:", e);
  }

  // 2. If Firebase is not configured or user is not an authenticated admin, return local success
  const { getEffectiveAuthUser } = await import("./quotaTracker");
  if (!isFirebaseConfigured() || !getEffectiveAuthUser()) {
    return {
      success: true,
      movedCount: uniqueIds.length,
      totalRequested: uniqueIds.length,
      message: `${uniqueIds.length} question(s) moved in local store.`,
      isFirebase: false,
    };
  }

  // 3. Batched Firestore Update (preserves stable document IDs, avoids creating copies)
  try {
    const { doc } = await import("firebase/firestore");
    const { guardedWriteBatch } = await import("./quotaTracker");

    const BATCH_SIZE = 100;
    for (let i = 0; i < uniqueIds.length; i += BATCH_SIZE) {
      const chunk = uniqueIds.slice(i, i + BATCH_SIZE);
      const batch = guardedWriteBatch(db);

      for (const id of chunk) {
        const docRef = doc(db, "mcqs", id);
        const updatePayload: Record<string, any> = {
          topicId: targetTopicId,
          chapterId: targetChapterId,
          updatedAt: new Date().toISOString(),
        };
        if (targetSubjectId) {
          updatePayload.subjectId = targetSubjectId;
        }

        const existing = questionsMap?.[id];
        if (existing) {
          if (existing.text || existing.question) {
            updatePayload.text = existing.text || existing.question;
          }
          if (Array.isArray(existing.options) && existing.options.length >= 2) {
            updatePayload.options = existing.options;
          }
          if (typeof existing.correctIndex === "number") {
            updatePayload.correctIndex = existing.correctIndex;
          }
          if (existing.explanation) {
            updatePayload.explanation = existing.explanation;
          }
          if (existing.hindiText) updatePayload.hindiText = existing.hindiText;
          if (existing.hindiOptions) updatePayload.hindiOptions = existing.hindiOptions;
          if (existing.hindiExplanation) updatePayload.hindiExplanation = existing.hindiExplanation;
          if (existing.difficulty) updatePayload.difficulty = existing.difficulty;
        }

        batch.set(docRef, updatePayload, { merge: true });
      }

      await batch.commit("Admin", "Move MCQs Batch", "ManageQuestions");
    }

    triggerAdminToast(
      "success",
      "Questions Moved in Cloud",
      `Successfully moved ${uniqueIds.length} question(s) to destination topic without duplicating.`
    );

    return {
      success: true,
      movedCount: uniqueIds.length,
      totalRequested: uniqueIds.length,
      message: `${uniqueIds.length} question(s) successfully moved in Firestore.`,
      isFirebase: true,
    };
  } catch (err: any) {
    console.error("Error moving questions in cloud:", err);
    return {
      success: false,
      movedCount: 0,
      totalRequested: uniqueIds.length,
      message: `Failed to move questions in Firebase: ${err?.message || String(err)}`,
      isFirebase: true,
      error: err?.message || String(err),
    };
  }
}

/**
 * Safely removes stale source documents left behind from previous broken moves.
 */
export async function purgeStaleMovedRecords(): Promise<{ success: boolean; deletedCount: number; message: string }> {
  const { getEffectiveAuthUser, guardedWriteBatch, guardedGetDocs } = await import("./quotaTracker");
  if (!isFirebaseConfigured() || !getEffectiveAuthUser()) {
    return { success: false, deletedCount: 0, message: "Authentication required to purge stale records." };
  }
  try {
    const { collection, doc } = await import("firebase/firestore");

    const snap = await guardedGetDocs(collection(db, "mcqs"), "Admin", "Scan MCQs For Stale Moved Records");
    const docs = snap.docs.map(d => ({ id: d.id, ...d.data() as any }));

    const t1Docs = docs.filter(d => d.topicId === "topic_1b890441-cad7-4e64-82db-4e9680de9f4b");
    const t2Docs = docs.filter(d => d.topicId === "custom-topic-1793306683981-h86ms");
    const t3Docs = docs.filter(d => d.topicId === "custom-topic-1793306697578-t3ce7");

    const t1ByNorm = new Map(t1Docs.map(d => [((d.text || d.question || "").trim().toLowerCase()), d]));

    const staleIds: string[] = [];
    t2Docs.forEach(d2 => {
      const norm = (d2.text || d2.question || "").trim().toLowerCase();
      const d1 = t1ByNorm.get(norm);
      if (d1) staleIds.push(d1.id);
    });

    t3Docs.forEach(d3 => {
      const norm = (d3.text || d3.question || "").trim().toLowerCase();
      const d1 = t1ByNorm.get(norm);
      if (d1) staleIds.push(d1.id);
    });

    if (staleIds.length === 0) {
      return { success: true, deletedCount: 0, message: "Zero stale moved records found." };
    }

    const uniqueStaleIds = Array.from(new Set(staleIds));
    const BATCH_SIZE = 100;
    for (let i = 0; i < uniqueStaleIds.length; i += BATCH_SIZE) {
      const chunk = uniqueStaleIds.slice(i, i + BATCH_SIZE);
      const batch = guardedWriteBatch(db);
      chunk.forEach(id => {
        batch.delete(doc(db, "mcqs", id));
      });
      await batch.commit("Admin", "Purge Stale Moved Records", "Diagnostic");
    }

    return {
      success: true,
      deletedCount: uniqueStaleIds.length,
      message: `Successfully pruned ${uniqueStaleIds.length} stale moved records from source topic.`,
    };
  } catch (err: any) {
    return { success: false, deletedCount: 0, message: err?.message || String(err) };
  }
}

export async function deleteMCQFromCloud(id: string, topicId?: string): Promise<CloudSyncResult> {
  try {
    localStorage.removeItem(`quizpro_mcq_${id}`);
    if (topicId) {
      localStorage.removeItem(`quizpro_mcqs_${topicId}`);
    }
    localStorage.removeItem("quizpro_mcqs_all");
    import("./questionBankCache").then(({ removeQuestionsFromCache }) => {
      removeQuestionsFromCache([id], topicId ? [topicId] : undefined).catch(() => {});
    }).catch(() => {});

    if (isFirebaseConfigured()) {
      const { doc } = await import('firebase/firestore');
      const { guardedDeleteDoc, clearFirestoreCache } = await import('./quotaTracker');
      clearFirestoreCache();
      await guardedDeleteDoc(doc(db, "mcqs", id), "Admin", "Delete MCQ");
      // Phase 4: Eliminated redundant fallback delete to 'questions' collection.

      try {
        const { bumpRemoteCurriculumVersion } = await import('./appVersionService');
        await bumpRemoteCurriculumVersion(topicId ? [topicId] : undefined);
      } catch (_) {}

      triggerAdminToast("delete", "Question Deleted from Firebase", `MCQ ID '${id}' successfully removed from Firestore.`);
      return {
        success: true,
        message: `Question deleted from Firebase Firestore!`,
        isFirebase: true
      };
    }
    return {
      success: true,
      message: `Question deleted locally!`,
      isFirebase: false
    };
  } catch (err: any) {
    const isQuotaErr = 
      err?.message?.includes("Daily write quota limit reached") ||
      err?.code === "resource-exhausted" ||
      err?.message?.includes("quota") ||
      err?.message?.includes("Quota");

    if (isQuotaErr) {
      console.warn(`[deleteMCQFromCloud] Cloud deletion deferred for MCQ '${id}' (Firestore daily write quota reached). Local deletion is preserved.`);
      return {
        success: true,
        message: "Question deleted locally. Cloud deletion will sync when daily quota resets.",
        isFirebase: false,
        isQuotaExceeded: true
      };
    }

    console.warn("Notice deleting MCQ from cloud:", err);
    return {
      success: false,
      message: `Failed to delete question from Firebase: ${err?.message || String(err)}`,
      isFirebase: true,
      error: err?.message || String(err)
    };
  }
}

/**
 * Bulk deletes questions from Firestore using writeBatch to drastically reduce write consumption.
 * Bumps the remote curriculum version once at the end instead of on every question.
 */
export async function deleteMCQsBulkFromCloud(ids: string[], topicIds?: string[]): Promise<CloudSyncResult> {
  if (!ids || ids.length === 0) {
    return { success: true, message: "No questions to delete.", isFirebase: false, deletedCount: 0 };
  }

  // 1. Clean localStorage & IndexedDB caches
  try {
    for (const id of ids) {
      localStorage.removeItem(`quizpro_mcq_${id}`);
    }
    if (topicIds && topicIds.length > 0) {
      for (const tId of topicIds) {
        localStorage.removeItem(`quizpro_mcqs_${tId}`);
      }
    }
    localStorage.removeItem("quizpro_mcqs_all");
    import("./questionBankCache").then(({ removeQuestionsFromCache }) => {
      removeQuestionsFromCache(ids, topicIds).catch(() => {});
    }).catch(() => {});
  } catch {}

  if (!isFirebaseConfigured()) {
    return {
      success: true,
      message: `${ids.length} questions deleted locally.`,
      isFirebase: false,
      deletedCount: ids.length,
    };
  }

  try {
    const { doc } = await import('firebase/firestore');
    const { guardedWriteBatch, clearFirestoreCache } = await import('./quotaTracker');
    clearFirestoreCache();

    const CHUNK_SIZE = 200; // 200 mcqs + 200 questions = 400 ops max per batch
    let deletedCount = 0;

    for (let i = 0; i < ids.length; i += CHUNK_SIZE) {
      const chunk = ids.slice(i, i + CHUNK_SIZE);
      const batch = guardedWriteBatch(db);

      for (const id of chunk) {
        batch.delete(doc(db, "mcqs", id));
        batch.delete(doc(db, "questions", id));
      }

      await batch.commit("Admin", "Bulk Delete MCQs", "AdminQuestions");
      deletedCount += chunk.length;
    }

    try {
      const { bumpRemoteCurriculumVersion } = await import('./appVersionService');
      const uniqueTopicIds = topicIds ? Array.from(new Set(topicIds.filter(Boolean))) : undefined;
      await bumpRemoteCurriculumVersion(uniqueTopicIds);
    } catch (_) {}

    triggerAdminToast("delete", "Questions Deleted from Firebase", `${deletedCount} MCQs removed from Firestore.`);

    return {
      success: true,
      message: `${deletedCount} questions deleted from Firestore!`,
      isFirebase: true,
      deletedCount,
    };
  } catch (err: any) {
    const isQuotaErr = 
      err?.message?.includes("Daily write quota limit reached") ||
      err?.code === "resource-exhausted" ||
      err?.message?.includes("quota") ||
      err?.message?.includes("Quota");

    if (isQuotaErr) {
      console.warn(`[deleteMCQsBulkFromCloud] Cloud deletion deferred for ${ids.length} MCQs (Firestore daily write quota reached). Local deletions are preserved.`);
      return {
        success: true,
        message: `${ids.length} questions deleted locally. Cloud sync will finalize when daily quota resets.`,
        isFirebase: false,
        isQuotaExceeded: true,
        deletedCount: ids.length,
      };
    }

    console.warn("Notice deleting MCQs in bulk from cloud:", err);
    return {
      success: false,
      message: `Failed to delete some questions from Firebase: ${err?.message || String(err)}`,
      isFirebase: true,
      error: err?.message || String(err),
      deletedCount: 0,
    };
  }
}

export async function savePYQPaper(paper: any): Promise<CloudSyncResult> {
  try {
    localStorage.setItem(`quizpro_pyq_${paper.id}`, JSON.stringify(paper));
    if (isFirebaseConfigured()) {
      const { doc } = await import('firebase/firestore');
      const { guardedSetDoc } = await import('./quotaTracker');
      await guardedSetDoc(
        doc(db, "pyq_papers", paper.id),
        paper,
        { merge: true },
        "Admin",
        "Save PYQ Paper"
      );
      return {
        success: true,
        message: `PYQ Paper '${paper.title || paper.name}' saved to Firebase Firestore!`,
        isFirebase: true
      };
    }
    return {
      success: true,
      message: `PYQ Paper saved locally!`,
      isFirebase: false
    };
  } catch (err: any) {
    return {
      success: false,
      message: `Failed to save PYQ Paper to Firebase: ${err?.message || String(err)}`,
      isFirebase: true,
      error: err?.message || String(err)
    };
  }
}

export async function deletePYQPaperFromCloud(id: string): Promise<CloudSyncResult> {
  try {
    localStorage.removeItem(`quizpro_pyq_${id}`);
    if (isFirebaseConfigured()) {
      const { doc } = await import('firebase/firestore');
      const { guardedDeleteDoc } = await import('./quotaTracker');
      await guardedDeleteDoc(doc(db, "pyq_papers", id), "Admin", "Delete PYQ Paper");
      triggerAdminToast("delete", "PYQ Paper Deleted from Firebase", `PYQ Paper '${id}' deleted from Firestore.`);
      return {
        success: true,
        message: `PYQ Paper deleted from Firebase!`,
        isFirebase: true
      };
    }
    return { success: true, message: `PYQ Paper deleted!`, isFirebase: false };
  } catch (err: any) {
    return { success: false, message: `Failed to delete PYQ Paper: ${err?.message || String(err)}`, isFirebase: true, error: err?.message };
  }
}

export async function saveLiveTest(test: any): Promise<CloudSyncResult> {
  try {
    const { sanitizeLiveTestForPublic, buildAnswerKeyDocFromLiveTest } = await import('./liveTestStorage');
    const sanitizedTest = sanitizeLiveTestForPublic(test);
    localStorage.setItem(`quizpro_test_${test.id}`, JSON.stringify(sanitizedTest));
    if (isFirebaseConfigured()) {
      const { doc } = await import('firebase/firestore');
      const { guardedSetDoc } = await import('./quotaTracker');
      await guardedSetDoc(
        doc(db, "liveTests", test.id),
        sanitizedTest,
        undefined,
        "Admin",
        "Save Live Test"
      );
      const answerKeyDoc = buildAnswerKeyDocFromLiveTest(test);
      if (Object.keys(answerKeyDoc.answers).length > 0) {
        await guardedSetDoc(
          doc(db, "liveTestAnswerKeys", test.id),
          answerKeyDoc,
          undefined,
          "Admin",
          "Save Live Test Answer Key"
        );
      }
      return {
        success: true,
        message: `Live Test '${test.title}' saved to Firebase Firestore!`,
        isFirebase: true
      };
    }
    return { success: true, message: `Live Test saved locally!`, isFirebase: false };
  } catch (err: any) {
    return { success: false, message: `Failed to save Live Test: ${err?.message || String(err)}`, isFirebase: true, error: err?.message };
  }
}

export async function deleteLiveTestFromCloud(id: string): Promise<CloudSyncResult> {
  try {
    localStorage.removeItem(`quizpro_test_${id}`);
    if (isFirebaseConfigured()) {
      const { doc } = await import('firebase/firestore');
      const { guardedDeleteDoc } = await import('./quotaTracker');
      await guardedDeleteDoc(doc(db, "liveTests", id), "Admin", "Delete Live Test");
      await guardedDeleteDoc(doc(db, "liveTestAnswerKeys", id), "Admin", "Delete Live Test Answer Key").catch(() => {});
      triggerAdminToast("delete", "Live Test Deleted from Firebase", `Live Test '${id}' deleted from Firestore.`);
      return { success: true, message: `Live Test deleted from Firebase!`, isFirebase: true };
    }
    return { success: true, message: `Live Test deleted!`, isFirebase: false };
  } catch (err: any) {
    return { success: false, message: `Failed to delete Live Test: ${err?.message || String(err)}`, isFirebase: true, error: err?.message };
  }
}

export async function saveBanner(banner: any): Promise<CloudSyncResult> {
  try {
    localStorage.setItem(`quizpro_banner_${banner.id}`, JSON.stringify(banner));
    if (isFirebaseConfigured()) {
      const { doc } = await import('firebase/firestore');
      const { guardedSetDoc } = await import('./quotaTracker');
      await guardedSetDoc(
        doc(db, "banners", banner.id),
        banner,
        { merge: true },
        "Admin",
        "Save Banner"
      );
      return { success: true, message: `Banner saved to Firebase!`, isFirebase: true };
    }
    return { success: true, message: `Banner saved locally!`, isFirebase: false };
  } catch (err: any) {
    return { success: false, message: `Failed to save Banner: ${err?.message || String(err)}`, isFirebase: true, error: err?.message };
  }
}

export async function deleteBannerFromCloud(id: string): Promise<CloudSyncResult> {
  try {
    localStorage.removeItem(`quizpro_banner_${id}`);
    if (isFirebaseConfigured()) {
      const { doc } = await import('firebase/firestore');
      const { guardedDeleteDoc } = await import('./quotaTracker');
      await guardedDeleteDoc(doc(db, "banners", id), "Admin", "Delete Banner");
      triggerAdminToast("delete", "Banner Deleted from Firebase", `Banner ID '${id}' deleted from Firestore.`);
      return { success: true, message: `Banner deleted from Firebase!`, isFirebase: true };
    }
    return { success: true, message: `Banner deleted!`, isFirebase: false };
  } catch (err: any) {
    return { success: false, message: `Failed to delete Banner: ${err?.message || String(err)}`, isFirebase: true, error: err?.message };
  }
}

export async function fetchUserProfileFromCloud(uid: string): Promise<any | null> {
  // Check local cache first
  const stored = localStorage.getItem(`quizpro_profile_${uid}`);
  if (stored) return JSON.parse(stored);
  
  // Try remote fetch if online and configured
  if (isFirebaseConfigured()) {
    try {
      const { doc } = await import('firebase/firestore');
      const { guardedGetDoc } = await import('./quotaTracker');
      const snap = await guardedGetDoc(doc(db, "users", uid), "Student", "Fetch Profile");
      if (snap.exists()) {
        const data = snap.data();
        localStorage.setItem(`quizpro_profile_${uid}`, JSON.stringify(data));
        return data;
      }
    } catch (err) {
      console.warn("Could not fetch remote profile:", err);
    }
  }
  return null;
}

export async function syncUserProfileToCloud(profile: any): Promise<void> {
  if (!profile?.uid && !profile?.id) return;
  const key = profile.uid || profile.id;
  
  // Always update local cache
  localStorage.setItem(`quizpro_profile_${key}`, JSON.stringify(profile));

  // Do not sync guest/default profiles or admin preview mode to Firestore
  if (key === "student_default" || String(key).startsWith("guest_")) return;
  const { isStudentTrackingAllowed } = await import('./studentWriteBuffer');
  if (!isStudentTrackingAllowed(profile)) return;
  
  // Trigger Firestore sync if configured
  if (isFirebaseConfigured()) {
    try {
      const { registerUserToDirectory } = await import('./userManagementStorage');
      await registerUserToDirectory({
        ...profile,
        id: key // Normalize ID field for the registration helper
      });
    } catch (err) {
      console.warn("Non-blocking profile sync error:", err);
    }
  }
}

export async function logLoginAttempt(...args: any[]): Promise<void> {
  console.log('Login attempt logged', args);
}

export function getStartOfWeekId(): string {
  const now = new Date();
  const day = now.getDay();
  const diff = now.getDate() - day + (day === 0 ? -6 : 1); // Monday
  const monday = new Date(now.setDate(diff));
  return monday.toISOString().split('T')[0];
}

async function updateWeeklyStatsInCloud(attempt: any): Promise<void> {
  if (!isFirebaseConfigured()) return;
  const userId = attempt.userId || auth.currentUser?.uid;
  if (!userId || String(userId).startsWith("guest_") || userId === "student_default") return;

  try {
    const { commitWeeklyStatsDeltaIdempotent, getCurrentWeekId, isStudentTrackingAllowed } = await import('./studentWriteBuffer');
    if (!attempt?.isTest && !isStudentTrackingAllowed()) {
      return;
    }

    const weekId = getCurrentWeekId();
    const qCount = attempt.questionCount || attempt.totalQuestions || ((attempt.correctCount || 0) + (attempt.wrongCount || 0)) || 1;
    const correctCount = attempt.correctCount ?? (attempt.isCorrect ? 1 : 0);
    const opId = attempt.attemptId || attempt.id || `att_weekly_${userId}_${Date.now()}`;

    await commitWeeklyStatsDeltaIdempotent(
      {
        userId,
        weekId,
        userName: attempt.userName || auth.currentUser?.displayName || "Aspirant",
        userPhoto: attempt.userPhoto || auth.currentUser?.photoURL || "",
        attemptedDelta: qCount,
        correctDelta: correctCount,
        pointsDelta: correctCount * 10,
      },
      opId,
      "Direct Attempt Weekly Stats"
    );
  } catch (err) {
    console.warn("Failed to update weekly stats:", err);
  }
}

export async function recordAttemptToCloud(attempt: any): Promise<void> {
  const attemptId = attempt.id || attempt.attemptId || `att_${Date.now()}`;
  localStorage.setItem(`quizpro_attempt_${attemptId}`, JSON.stringify(attempt));

  const { isStudentTrackingAllowed } = await import('./studentWriteBuffer');
  if (!attempt?.isTest && !isStudentTrackingAllowed()) {
    return;
  }

  const userId = attempt.userId || auth.currentUser?.uid;
  if (isFirebaseConfigured() && userId && !String(userId).startsWith("guest_") && userId !== "student_default") {
    try {
      const { doc } = await import('firebase/firestore');
      const { guardedSetDoc } = await import('./quotaTracker');
      
      const firestoreAttempt = {
        ...attempt,
        id: attemptId,
        attemptId,
        userId,
        submittedAt: attempt.submittedAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await guardedSetDoc(
        doc(db, "attempts", attemptId),
        firestoreAttempt,
        { merge: true },
        attempt?.isTest ? "QA" : "Student",
        "Record Attempt",
        undefined,
        30000,
        `attempt_${attemptId}`
      );

      await updateWeeklyStatsInCloud(firestoreAttempt).catch(() => {});
    } catch (err) {
      console.warn("Non-blocking attempt sync error:", err);
    }
  }
}

export async function updateLeaderboardToCloud(entry: any): Promise<void> {
  const userId = entry.userId || auth.currentUser?.uid;
  const testId = entry.testId;
  if (!userId || !testId) return;

  const entryId = `${testId}_${userId}`;
  localStorage.setItem(`quizpro_lead_${entryId}`, JSON.stringify(entry));

  // Block guest / anonymous / admin-preview writes from polluting Firestore leaderboard
  if (String(userId).startsWith("guest_") || userId === "student_default" || userId === "guest_user") {
    return;
  }
  const { isStudentTrackingAllowed } = await import('./studentWriteBuffer');
  if (!entry?.isTest && !isStudentTrackingAllowed()) {
    return;
  }

  if (isFirebaseConfigured()) {
    try {
      const { doc } = await import('firebase/firestore');
      const { guardedSetDoc } = await import('./quotaTracker');
      
      await guardedSetDoc(
        doc(db, "leaderboard", entryId),
        {
          ...entry,
          userId,
          updatedAt: new Date().toISOString()
        },
        { merge: true },
        entry?.isTest ? "QA" : "Student",
        "Update Leaderboard"
      );
    } catch (err) {
      console.warn("Non-blocking leaderboard sync error:", err);
    }
  }
}

export async function runFirebaseHealthCheck(): Promise<{ success: boolean; latencyMs: number; error?: string }> {
  const startTime = Date.now();
  try {
    if (!isFirebaseConfigured()) {
      return { success: false, latencyMs: 0, error: "Firebase configuration is missing." };
    }
    const { guardedGetDoc } = await import('./quotaTracker');
    await guardedGetDoc(doc(db, "test", "connection"), "Health", "Health Check Ping", undefined, 10000, true);
    const latencyMs = Date.now() - startTime;
    return { success: true, latencyMs };
  } catch (err: any) {
    const latencyMs = Date.now() - startTime;
    const msg = err?.message || String(err);
    if (err?.code === "not-found" || msg.includes("not found")) {
      return { success: true, latencyMs };
    }
    return { success: false, latencyMs, error: msg };
  }
}

export function normalizeTableFromFirestore(data: any): any {
  if (!data || typeof data !== "object") return data;

  // If table has rowsJson, parse it back to 2D string[][]
  if (typeof data.rowsJson === "string") {
    try {
      const parsedRows = JSON.parse(data.rowsJson);
      return {
        caption: data.caption || undefined,
        headers: Array.isArray(data.headers) ? data.headers : [],
        rows: Array.isArray(parsedRows) ? parsedRows : [],
      };
    } catch {
      // ignore
    }
  }

  // If rows is stored as array of objects { cells: [...] }
  if (Array.isArray(data.rows)) {
    const rows = data.rows.map((r: any) => {
      if (Array.isArray(r)) return r;
      if (r && typeof r === "object" && Array.isArray(r.cells)) return r.cells;
      return [];
    });
    return {
      caption: data.caption || undefined,
      headers: Array.isArray(data.headers) ? data.headers : [],
      rows,
    };
  }

  return data;
}

export function serializeTableForFirestore(data: any): any {
  if (!data || typeof data !== "object") return null;

  // Extract caption and headers
  const caption = data.caption ? String(data.caption) : null;
  const headers = Array.isArray(data.headers) ? data.headers.map((h: any) => String(h ?? "")) : [];

  // Extract 2D rows into clean strings
  let rowsArray: string[][] = [];
  if (Array.isArray(data.rows)) {
    rowsArray = data.rows.map((r: any) => {
      if (Array.isArray(r)) return r.map((c: any) => String(c ?? ""));
      if (r && typeof r === "object" && Array.isArray(r.cells)) return r.cells.map((c: any) => String(c ?? ""));
      return [];
    });
  } else if (typeof data.rowsJson === "string") {
    try {
      rowsArray = JSON.parse(data.rowsJson);
    } catch {
      rowsArray = [];
    }
  }

  // To prevent any possible nested array error in Firestore ("Nested arrays are not supported"),
  // rows are serialized as a stringified JSON string and raw 2D array rows are omitted.
  return {
    caption,
    headers,
    rowsJson: JSON.stringify(rowsArray),
    _serialized: true,
  };
}

/**
 * Deep recursive sanitizer that removes undefined values and prevents nested arrays
 * from reaching Firestore setDoc/updateDoc calls.
 */
export function sanitizeFirestorePayload<T = any>(obj: T): T {
  if (obj === null || obj === undefined) {
    return null as any;
  }
  if (Array.isArray(obj)) {
    return obj
      .filter((item) => item !== undefined)
      .map((item) => {
        if (Array.isArray(item)) {
          // Flatten / serialize nested array item so Firestore never rejects it
          return JSON.stringify(item);
        }
        return sanitizeFirestorePayload(item);
      }) as any;
  }
  if (typeof obj === "object") {
    // Preserve Firestore FieldValue sentinels (increment, serverTimestamp, arrayUnion, deleteField)
    // and non-plain objects (Date, Timestamp, GeoPoint, DocumentReference, etc.)
    const isFirestoreSentinel =
      (obj as any)._methodName !== undefined ||
      typeof (obj as any).isEqual === "function" ||
      obj instanceof Date ||
      (obj.constructor && obj.constructor !== Object);

    if (isFirestoreSentinel) {
      return obj;
    }

    const cleaned: Record<string, any> = {};
    for (const [key, value] of Object.entries(obj)) {
      if (value === undefined) continue;

      if ((key === "table" || key === "tableData") && value && typeof value === "object") {
        cleaned[key] = serializeTableForFirestore(value);
      } else if (Array.isArray(value)) {
        cleaned[key] = value
          .filter((item) => item !== undefined)
          .map((item) => {
            if (Array.isArray(item)) {
              return JSON.stringify(item);
            }
            return sanitizeFirestorePayload(item);
          });
      } else {
        cleaned[key] = sanitizeFirestorePayload(value);
      }
    }
    return cleaned as T;
  }
  return obj;
}

export function sanitizeData(data: any): any {
  return sanitizeFirestorePayload(data);
}

export async function saveMCQsBulk(mcqs: any[]): Promise<void> {
  localStorage.setItem('quizpro_bulk_mcqs', JSON.stringify(mcqs));
}

export async function loadFromCloudWithCache(key: string): Promise<any> {
  const item = localStorage.getItem(key);
  return item ? JSON.parse(item) : null;
}

/**
 * Verification test helper for guest vs authenticated behavior
 */
export async function runGuestAccessTest(): Promise<{ success: boolean; message: string }> {
  try {
    const guestMcqs = await fetchMCQsByTopic('computer-science');
    const guestCanRead = Array.isArray(guestMcqs) && guestMcqs.length > 0;
    const views = getAndUpdateViewCount();

    if (guestCanRead && views > 0) {
      return {
        success: true,
        message: `Guest access verified successfully! Fetched ${guestMcqs.length} MCQs without login. View count: ${views}. Private profiles remain protected.`
      };
    } else {
      return {
        success: false,
        message: 'Guest access test failed: MCQs could not be fetched publicly.'
      };
    }
  } catch (err: any) {
    return {
      success: false,
      message: `Test error: ${err.message}`
    };
  }
}

const isValidQuestionData = (q: any) =>
  Boolean(q && (q.text || q.question) && Array.isArray(q.options) && q.options.length >= 2);

/**
 * Fetch MCQs for a specific Live Test.
 */
export async function fetchMCQsByLiveTest(testId: string): Promise<any[]> {
  const { stripAnswerFieldsFromQuestion } = await import('./liveTestStorage');
  const { isUserAdmin, loadUserProfile } = await import('./userProfileStorage');
  const admin = isUserAdmin(loadUserProfile());
  const sanitizeList = (list: any[]) => (admin ? list : list.map((q) => stripAnswerFieldsFromQuestion(q)));

  // 1. Try local live tests cache
  try {
    const localTests = JSON.parse(localStorage.getItem("remix_rajprep_live_tests_v1") || "[]");
    const found = localTests.find((t: any) => t.id === testId);
    if (found && Array.isArray(found.questions) && found.questions.length > 0) {
      const valid = found.questions.filter(isValidQuestionData);
      if (valid.length > 0) return sanitizeList(valid);
    }
  } catch (e) {}

  // 2. Check local user questions store (cloudCacheQuestions / customQuestions)
  try {
    const customStore = JSON.parse(localStorage.getItem("economic_survey_user_questions_v2") || "{}");
    const allStoreQs = [...(customStore.customQuestions || []), ...(customStore.cloudCacheQuestions || [])];
    const matchingTest = allStoreQs.filter((q: any) => (q.testId === testId || q.liveTestId === testId) && isValidQuestionData(q));
    if (matchingTest.length > 0) {
      return sanitizeList(matchingTest);
    }
  } catch (e) {}

  // 3. Try Firestore (Admin only)
  if (isFirebaseConfigured() && admin) {
    try {
      const { doc } = await import('firebase/firestore');
      const { guardedGetDoc } = await import('./quotaTracker');
      const docSnap = await guardedGetDoc(doc(db, "liveTests", testId), admin ? "Admin" : "Student", "Fetch Live Test Doc");
      if (docSnap.exists()) {
        const data = docSnap.data() as any;
        if (Array.isArray(data.questions) && data.questions.length > 0) {
          const valid = data.questions.filter(isValidQuestionData);
          if (valid.length > 0) return sanitizeList(valid);

          // If questions are IDs, resolve them from local store
          const candidateIds = data.questions.map((q: any) => typeof q === "string" ? q : q?.id).filter(Boolean);
          if (candidateIds.length > 0) {
            const customStore = JSON.parse(localStorage.getItem("economic_survey_user_questions_v2") || "{}");
            const allStoreQs = [...(customStore.customQuestions || []), ...(customStore.cloudCacheQuestions || [])];
            const qMap = new Map(allStoreQs.map(q => [q.id, q]));
            const resolved = candidateIds.map((id: string) => qMap.get(id)).filter(isValidQuestionData);
            if (resolved.length > 0) return sanitizeList(resolved);
          }
        }
      }
    } catch (err) {
      console.warn("Could not fetch live test doc from Firestore:", err);
    }

    try {
      const { collection, query, where } = await import('firebase/firestore');
      const { guardedGetDocs } = await import('./quotaTracker');
      const q = query(collection(db, "mcqs"), where("testId", "==", testId));
      const snap = await guardedGetDocs(q, admin ? "Admin" : "Student", "Fetch MCQs by Test");
      if (!snap.empty) {
        const valid = snap.docs.map(d => ({ ...d.data(), id: d.id })).filter(isValidQuestionData);
        if (valid.length > 0) return sanitizeList(valid);
      }

      // Also check liveTestId
      const q2 = query(collection(db, "mcqs"), where("liveTestId", "==", testId));
      const snap2 = await guardedGetDocs(q2, admin ? "Admin" : "Student", "Fetch MCQs by LiveTestId");
      if (!snap2.empty) {
        const valid = snap2.docs.map(d => ({ ...d.data(), id: d.id })).filter(isValidQuestionData);
        if (valid.length > 0) return sanitizeList(valid);
      }
    } catch (err) {
      console.warn("Could not fetch MCQs for live test:", err);
    }
  }

  // 4. Fallback to curriculum cache questions
  try {
    const customStore = JSON.parse(localStorage.getItem("economic_survey_user_questions_v2") || "{}");
    const allStoreQs = [...(customStore.customQuestions || []), ...(customStore.cloudCacheQuestions || [])].filter(isValidQuestionData);
    if (allStoreQs.length > 0) {
      return sanitizeList(allStoreQs.slice(0, 25));
    }
  } catch (e) {}

  return sanitizeList(INITIAL_MCQS);
}

/**
 * Fetch MCQs for a specific PYQ Paper.
 */
export async function fetchMCQsByPYQPaper(paperId: string): Promise<any[]> {
  const { isUserAdmin, loadUserProfile } = await import('./userProfileStorage');
  const admin = isUserAdmin(loadUserProfile());

  // 0. Check localDatabaseEngine for paper MCQs
  try {
    const { getLocalMCQsByPaper } = await import('./localDatabaseEngine');
    const localPaperQs = await getLocalMCQsByPaper(paperId);
    if (localPaperQs && localPaperQs.length > 0) return localPaperQs;
  } catch (e) {}

  try {
    const localPapers = JSON.parse(localStorage.getItem("remix_rajprep_pyq_papers_v2") || "[]");
    const found = localPapers.find((p: any) => p.id === paperId);
    if (found && Array.isArray(found.questions) && found.questions.length > 0) {
      const valid = found.questions.filter(isValidQuestionData);
      if (valid.length > 0) return valid;
    }
  } catch (e) {}

  try {
    const customStore = JSON.parse(localStorage.getItem("economic_survey_user_questions_v2") || "{}");
    const allStoreQs = [...(customStore.customQuestions || []), ...(customStore.cloudCacheQuestions || [])];
    const matchingPaper = allStoreQs.filter((q: any) => (q.paperId === paperId || q.pyqPaperId === paperId) && isValidQuestionData(q));
    if (matchingPaper.length > 0) {
      return matchingPaper;
    }
  } catch (e) {}

  // 3. Try Firestore (Admin only)
  if (isFirebaseConfigured() && admin) {
    try {
      const { doc } = await import('firebase/firestore');
      const { guardedGetDoc } = await import('./quotaTracker');
      const docSnap = await guardedGetDoc(doc(db, "pyq_papers", paperId), "Student", "Fetch PYQ Paper Doc");
      if (docSnap.exists()) {
        const data = docSnap.data() as any;
        if (Array.isArray(data.questions) && data.questions.length > 0) {
          const valid = data.questions.filter(isValidQuestionData);
          if (valid.length > 0) return valid;

          const candidateIds = data.questions.map((q: any) => typeof q === "string" ? q : q?.id).filter(Boolean);
          if (candidateIds.length > 0) {
            const customStore = JSON.parse(localStorage.getItem("economic_survey_user_questions_v2") || "{}");
            const allStoreQs = [...(customStore.customQuestions || []), ...(customStore.cloudCacheQuestions || [])];
            const qMap = new Map(allStoreQs.map(q => [q.id, q]));
            const resolved = candidateIds.map((id: string) => qMap.get(id)).filter(isValidQuestionData);
            if (resolved.length === candidateIds.length && resolved.length > 0) return resolved;

            // Fetch any missing candidate IDs from Firestore mcqs collection
            const missingIds = candidateIds.filter((id: string) => !qMap.has(id));
            if (missingIds.length > 0) {
              const fetchPromises = missingIds.map(async (id: string) => {
                try {
                  const s = await guardedGetDoc(doc(db, "mcqs", id), "Student", "Fetch PYQ MCQ by ID");
                  if (s.exists()) {
                    return { ...s.data(), id: s.id };
                  }
                } catch {}
                return null;
              });
              const fetchedDocs = (await Promise.all(fetchPromises)).filter(isValidQuestionData);
              const combined = [...resolved, ...fetchedDocs];
              if (combined.length > 0) return combined;
            }
          }
        }
      }
    } catch (err) {
      console.warn("Could not fetch PYQ paper doc from Firestore:", err);
    }

    try {
      const { collection, query, where } = await import('firebase/firestore');
      const { guardedGetDocs } = await import('./quotaTracker');
      const q = query(collection(db, "mcqs"), where("paperId", "==", paperId));
      const snap = await guardedGetDocs(q, "Student", "Fetch MCQs by Paper");
      if (!snap.empty) {
        const valid = snap.docs.map(d => ({ ...d.data(), id: d.id })).filter(isValidQuestionData);
        if (valid.length > 0) return valid;
      }
    } catch (err) {
      console.warn("Could not fetch MCQs for PYQ paper:", err);
    }
  }

  try {
    const customStore = JSON.parse(localStorage.getItem("economic_survey_user_questions_v2") || "{}");
    const allStoreQs = [...(customStore.customQuestions || []), ...(customStore.cloudCacheQuestions || [])].filter(isValidQuestionData);
    if (allStoreQs.length > 0) {
      return allStoreQs.slice(0, 25);
    }
  } catch (e) {}

  return INITIAL_MCQS;
}

/**
 * Queries Firestore directly to retrieve live, database-reconciled curriculum counts.
 */
export async function getLiveCurriculumCountsFromCloud(): Promise<{
  totalSubjects: number;
  totalChapters: number;
  totalTopics: number;
  totalQuestions: number;
}> {
  if (!isFirebaseConfigured()) {
    const { getReconciledCurriculumCounts } = await import('./questionsStorage');
    return getReconciledCurriculumCounts();
  }

  try {
    const { collection } = await import('firebase/firestore');
    const { guardedGetCountFromServer } = await import('./quotaTracker');

    const [sSnap, cSnap, tSnap, mSnap] = await Promise.all([
      guardedGetCountFromServer(collection(db, "subjects"), "Admin", "Count Subjects").catch(() => null),
      guardedGetCountFromServer(collection(db, "chapters"), "Admin", "Count Chapters").catch(() => null),
      guardedGetCountFromServer(collection(db, "topics"), "Admin", "Count Topics").catch(() => null),
      guardedGetCountFromServer(collection(db, "mcqs"), "Admin", "Count MCQs").catch(() => null),
    ]);

    return {
      totalSubjects: sSnap ? sSnap.data().count : 0,
      totalChapters: cSnap ? cSnap.data().count : 0,
      totalTopics: tSnap ? tSnap.data().count : 0,
      totalQuestions: mSnap ? mSnap.data().count : 0,
    };
  } catch (err) {
    console.warn("Could not fetch live cloud curriculum counts:", err);
    const { getReconciledCurriculumCounts } = await import('./questionsStorage');
    return getReconciledCurriculumCounts();
  }
}

/**
 * Scans Firestore collections and permanently purges test/mock records
 * using safe <= 400 batched deletes while strictly preserving real production data.
 */
export async function purgeAllTestAndMockCloudData(): Promise<{
  success: boolean;
  totalDeleted: number;
  failedCount: number;
  breakdown: Record<string, number>;
}> {
  if (!isFirebaseConfigured()) {
    return { success: true, totalDeleted: 0, failedCount: 0, breakdown: {} };
  }

  const { collection, doc } = await import('firebase/firestore');
  const { guardedGetDocs, isQuotaExhausted } = await import('./quotaTracker');
  const { isTestOrMockId, isTestOrMockText } = await import('./cleanSlate');

  const collectionsToClean = [
    "subjects",
    "chapters",
    "topics",
    "mcqs",
    "questions",
    "question_bundles",
    "liveTests",
    "live_tests",
    "pyq_papers",
    "exam_categories",
    "examCategories",
    "banners",
    "import_batches",
    "_health"
  ];

  let totalDeleted = 0;
  let failedCount = 0;
  const breakdown: Record<string, number> = {};
  const affectedTopicIds: string[] = [];

  for (const collName of collectionsToClean) {
    if (isQuotaExhausted()) break;
    try {
      const snap = await guardedGetDocs(collection(db, collName), "Admin", `Scan ${collName} for Test Records`);
      if (!snap || snap.empty) continue;

      const refsToDelete: any[] = [];
      for (const d of snap.docs) {
        const data = d.data() as any;
        const id = d.id;
        const isTest =
          isTestOrMockId(id) ||
          data?.isTest === true ||
          data?.is_test === true ||
          data?.isMock === true ||
          id === "live_test_ras_pre_2026_01" ||
          id === "live_test_cet_grad_2026_01" ||
          id === "pyq_ras_pre_2023" ||
          id === "pyq_eoro_2023" ||
          id === "pyq_cet_grad_2023" ||
          id === "subj_general_hindi" ||
          id === "subj_raj_polity" ||
          id === "subj-1794149966275-03yvv" ||
          id === "custom-ch-1794149979635-03auk" ||
          id === "custom-topic-1794149994193-jxf0o" ||
          id === "top_hindi_samas" ||
          id === "top_raj_polity_core" ||
          (data?.name && (data.name === "RAJASTHAN" || isTestOrMockText(data.name))) ||
          (data?.title && isTestOrMockText(data.title)) ||
          (data?.text && isTestOrMockText(data.text));

        if (isTest) {
          refsToDelete.push(doc(db, collName, id));
          if (collName === "topics") affectedTopicIds.push(id);
          if (collName === "question_bundles" && id.startsWith("topic_")) {
            affectedTopicIds.push(id.slice("topic_".length));
          }
        }
      }

      if (refsToDelete.length > 0) {
        const batchRes = await commitDeleteRefsInBatches(
          refsToDelete,
          `Purge Test Records (${collName})`,
          `purge_${collName}`
        );
        if (batchRes.deletedPaths.length > 0) {
          breakdown[collName] = batchRes.deletedPaths.length;
          totalDeleted += batchRes.deletedPaths.length;
        }
        failedCount += batchRes.failedPaths.length;
      }
    } catch (e) {
      console.warn(`Error scanning collection ${collName} for test data:`, e);
    }
  }

  if (affectedTopicIds.length > 0) {
    await cleanupDeletedLocalEntities({ topicIds: Array.from(new Set(affectedTopicIds)) });
  }

  return {
    success: failedCount === 0,
    totalDeleted,
    failedCount,
    breakdown,
  };
}

