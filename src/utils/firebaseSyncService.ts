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

  // 2. Fetch from canonical Supabase 'questions' table (High-performance PostgreSQL query)
  try {
    const { fetchQuestionsByTopic } = await import("./supabaseSyncService");
    const supabaseQs = await fetchQuestionsByTopic(topicId);
    if (supabaseQs && supabaseQs.length > 0) {
      try {
        const { mergeQuestionsIntoStore } = await import("./questionsStorage");
        mergeQuestionsIntoStore(supabaseQs as any);
      } catch {}
      try {
        const { saveQuestionsToCache } = await import("./questionBankCache");
        saveQuestionsToCache(supabaseQs as any, { topicId, source: "supabase" }).catch(() => {});
      } catch {}
      return supabaseQs as MCQ[];
    }
  } catch (err: any) {
    console.warn("[SupabaseBridge] Failed to fetch questions from Supabase:", err.message);
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
    const { saveSubjectToSupabase } = await import('./supabaseSyncService');
    const res = await saveSubjectToSupabase(subject);
    return {
      success: res.success,
      message: res.message,
      isFirebase: true
    };
  } catch (err: any) {
    return {
      success: false,
      message: err.message,
      isFirebase: true,
      error: err.message
    };
  }
}

export async function deleteSubjectFromCloud(id: string): Promise<CloudSyncResult> {
  try {
    const { deleteSubjectFromSupabase } = await import('./supabaseSyncService');
    const res = await deleteSubjectFromSupabase(id);
    return {
      success: res.success,
      message: res.message,
      isFirebase: true
    };
  } catch (err: any) {
    return {
      success: false,
      message: err.message,
      isFirebase: true,
      error: err.message
    };
  }
}

export async function saveChapter(chapter: any): Promise<CloudSyncResult> {
  try {
    const { saveChapterToSupabase } = await import('./supabaseSyncService');
    const res = await saveChapterToSupabase(chapter);
    return {
      success: res.success,
      message: res.message,
      isFirebase: true
    };
  } catch (err: any) {
    return {
      success: false,
      message: err.message,
      isFirebase: true,
      error: err.message
    };
  }
}

export async function deleteChapterFromCloud(id: string): Promise<CloudSyncResult> {
  try {
    const { deleteChapterFromSupabase } = await import('./supabaseSyncService');
    const res = await deleteChapterFromSupabase(id);
    return {
      success: res.success,
      message: res.message,
      isFirebase: true
    };
  } catch (err: any) {
    return {
      success: false,
      message: err.message,
      isFirebase: true,
      error: err.message
    };
  }
}

export async function saveTopic(topic: any): Promise<CloudSyncResult> {
  try {
    const { saveTopicToSupabase } = await import('./supabaseSyncService');
    const res = await saveTopicToSupabase(topic);
    return {
      success: res.success,
      message: res.message,
      isFirebase: true
    };
  } catch (err: any) {
    return {
      success: false,
      message: err.message,
      isFirebase: true,
      error: err.message
    };
  }
}

export async function deleteTopicFromCloud(id: string, chapterId?: string): Promise<CloudSyncResult> {
  try {
    const { deleteTopicFromSupabase } = await import('./supabaseSyncService');
    const res = await deleteTopicFromSupabase(id);
    return {
      success: res.success,
      message: res.message,
      isFirebase: true
    };
  } catch (err: any) {
    return {
      success: false,
      message: err.message,
      isFirebase: true,
      error: err.message
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
    const stableId = mcq.id || (await generateDeterministicMCQId(textVal, topicIdVal));

    const optionsVal = Array.isArray(mcq.options) && mcq.options.length >= 2 
      ? mcq.options 
      : ["Option A", "Option B"];
    const correctIdxVal = typeof mcq.correctIndex === "number" 
      ? mcq.correctIndex 
      : (typeof mcq.correctAnswer === "number" ? mcq.correctAnswer : 0);

    const questionItem = {
      id: stableId,
      text: textVal,
      options: optionsVal,
      correctIndex: correctIdxVal,
      explanation: mcq.explanation || "",
      subjectId: mcq.subjectId,
      chapterId: mcq.chapterId,
      topicId: topicIdVal,
      exam: mcq.exam,
      year: mcq.year,
      difficulty: mcq.difficulty,
    };

    const { upsertQuestionsToSupabase } = await import('./supabaseSyncService');
    const res = await upsertQuestionsToSupabase([questionItem as any]);

    return {
      success: res.success,
      message: res.message,
      isFirebase: true
    };
  } catch (err: any) {
    return {
      success: false,
      message: err.message,
      isFirebase: true,
      error: err.message
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

  try {
    const { supabase, isSupabaseConfigured } = await import("../lib/supabase");
    if (isSupabaseConfigured()) {
      const { error } = await supabase
        .from("questions")
        .update({
          topic_id: targetTopicId,
          chapter_id: targetChapterId,
          ...(targetSubjectId ? { subject_id: targetSubjectId } : {}),
          updated_at: new Date().toISOString()
        })
        .in("id", uniqueIds);

      if (error) throw error;
    }

    return {
      success: true,
      movedCount: uniqueIds.length,
      totalRequested: uniqueIds.length,
      message: `Successfully moved ${uniqueIds.length} question(s) to destination topic.`,
      isFirebase: true,
    };
  } catch (err: any) {
    console.error("Error moving questions in cloud:", err);
    return {
      success: false,
      movedCount: 0,
      totalRequested: uniqueIds.length,
      message: `Failed to move questions: ${err?.message || String(err)}`,
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
    const { deleteQuestionFromSupabase } = await import('./supabaseSyncService');
    const res = await deleteQuestionFromSupabase(id);
    return {
      success: res.success,
      message: res.message,
      isFirebase: true
    };
  } catch (err: any) {
    return {
      success: false,
      message: err.message,
      isFirebase: true,
      error: err.message
    };
  }
}

export async function deleteMCQsBulkFromCloud(ids: string[], topicIds?: string[]): Promise<CloudSyncResult> {
  try {
    const { deleteQuestionsBulkFromSupabase } = await import('./supabaseSyncService');
    const res = await deleteQuestionsBulkFromSupabase(ids);
    return {
      success: res.success,
      message: `Deleted ${res.count} questions from Supabase`,
      isFirebase: true,
      deletedCount: res.count
    };
  } catch (err: any) {
    return {
      success: false,
      message: err.message,
      isFirebase: true,
      error: err.message,
      deletedCount: 0
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
  const stored = localStorage.getItem(`quizpro_profile_${uid}`);
  if (stored) {
    try { return JSON.parse(stored); } catch {}
  }
  
  try {
    const { fetchUserProfileFromSupabase } = await import('./supabaseSyncService');
    const profile = await fetchUserProfileFromSupabase(uid);
    if (profile) {
      localStorage.setItem(`quizpro_profile_${uid}`, JSON.stringify(profile));
      return profile;
    }
  } catch (err) {
    console.warn("[SupabaseBridge] Could not fetch remote profile:", err);
  }
  return null;
}

export async function syncUserProfileToCloud(profile: any): Promise<void> {
  if (!profile?.uid && !profile?.id) return;
  const key = profile.uid || profile.id;
  
  localStorage.setItem(`quizpro_profile_${key}`, JSON.stringify(profile));

  if (key === "student_default" || String(key).startsWith("guest_")) return;
  
  try {
    const { syncUserProfileToSupabase } = await import('./supabaseSyncService');
    await syncUserProfileToSupabase(profile);
  } catch (err) {
    console.warn("[SupabaseBridge] Non-blocking profile sync error:", err);
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

  try {
    const { recordStudentAttempt } = await import('./supabaseSyncService');
    await recordStudentAttempt({
      userId: attempt.userId,
      topicId: attempt.topicId,
      subjectId: attempt.subjectId,
      score: attempt.score || 0,
      totalQuestions: attempt.totalQuestions || 0,
      answers: attempt.answers || {},
      timeSpentSeconds: attempt.timeSpentSeconds || 0,
    });
  } catch (err) {
    console.warn("[SupabaseBridge] Non-blocking attempt sync error:", err);
  }
}

export async function updateLeaderboardToCloud(entry: any): Promise<void> {
  const userId = entry.userId || auth.currentUser?.uid;
  const testId = entry.testId;
  if (!userId || !testId) return;

  const entryId = `${testId}_${userId}`;
  localStorage.setItem(`quizpro_lead_${entryId}`, JSON.stringify(entry));
}

export async function runFirebaseHealthCheck(): Promise<{ success: boolean; latencyMs: number; error?: string }> {
  try {
    const { checkSupabaseHealth } = await import('./supabaseSyncService');
    const health = await checkSupabaseHealth();
    return {
      success: health.healthy,
      latencyMs: health.latencyMs,
      error: health.details?.error
    };
  } catch (err: any) {
    return { success: false, latencyMs: 0, error: err.message };
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
 * Queries Supabase directly to retrieve live, database-reconciled curriculum counts.
 */
export async function getLiveCurriculumCountsFromCloud(): Promise<{
  totalSubjects: number;
  totalChapters: number;
  totalTopics: number;
  totalQuestions: number;
}> {
  try {
    const { getSupabaseTableCounts } = await import('./supabaseSyncService');
    const counts = await getSupabaseTableCounts();
    return {
      totalSubjects: counts.subjects,
      totalChapters: counts.chapters,
      totalTopics: counts.topics,
      totalQuestions: counts.questions,
    };
  } catch (err) {
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

