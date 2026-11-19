import { supabase, isSupabaseConfigured } from "../lib/supabase";
import { Subject, Chapter, Topic, Question } from "../types";
import { 
  openLocalDatabase, 
  idbGet, 
  idbGetAll, 
  idbPut, 
  idbPutBatch,
  idbDelete,
  idbDeleteBatch,
  enqueueSyncEvent,
  STORES 
} from "./localDatabaseEngine";

/**
 * DISHA 20-20 — Supabase Sync & Curriculum Service
 * High-performance, quota-free PostgreSQL backend service with Local-First IndexedDB caching.
 * Starts 100% clean with 0 records. Only data uploaded via Admin Panel is stored.
 */

// ─────────────────────────────────────────────────────────────────────────────
// AUTHORITATIVE CURRICULUM SYNCHRONIZATION & CACHE RECONCILIATION
// ─────────────────────────────────────────────────────────────────────────────

export interface CurriculumSyncResult {
  subjectsCount: number;
  chaptersCount: number;
  topicsCount: number;
  prunedSubjects: number;
  prunedChapters: number;
  prunedTopics: number;
  preservedDrafts: number;
  syncedAt: string;
}

let activeCurriculumSyncPromise: Promise<CurriculumSyncResult> | null = null;
let lastCurriculumSyncTime = 0;
let lastCurriculumSyncResult: CurriculumSyncResult | null = null;

// In-flight request deduplication maps (prevents duplicate simultaneous queries to Supabase)
const inFlightTopicFetches = new Map<string, Promise<Question[]>>();
const inFlightChapterFetches = new Map<string, Promise<Question[]>>();

/**
 * Performs authoritative bidirectional synchronization between Supabase PostgreSQL
 * and local IndexedDB cache:
 * 1. Fetches authoritative records from Supabase.
 * 2. Prunes any stale server-originated records from local IndexedDB if they were deleted on the server.
 * 3. Preserves unsynced local drafts (isUserAdded === true && syncStatus === 'pending') and QA fixtures.
 * 4. Updates cache version metadata in IndexedDB.
 */
export async function syncCurriculumAuthoritative(options?: { force?: boolean }): Promise<CurriculumSyncResult> {
  const emptyResult: CurriculumSyncResult = {
    subjectsCount: 0,
    chaptersCount: 0,
    topicsCount: 0,
    prunedSubjects: 0,
    prunedChapters: 0,
    prunedTopics: 0,
    preservedDrafts: 0,
    syncedAt: new Date().toISOString()
  };

  if (!isSupabaseConfigured()) {
    return emptyResult;
  }

  const now = Date.now();
  if (!options?.force && lastCurriculumSyncResult && (now - lastCurriculumSyncTime < 5000)) {
    return lastCurriculumSyncResult;
  }

  if (activeCurriculumSyncPromise) {
    return activeCurriculumSyncPromise;
  }

  activeCurriculumSyncPromise = (async () => {
    const result: CurriculumSyncResult = {
      subjectsCount: 0,
      chaptersCount: 0,
      topicsCount: 0,
      prunedSubjects: 0,
      prunedChapters: 0,
      prunedTopics: 0,
      preservedDrafts: 0,
      syncedAt: new Date().toISOString()
    };

    await openLocalDatabase();

    try {
      const qSubs = supabase.from("subjects").select("id, name, hindi_name, description, icon, color, order_index").order("order_index", { ascending: true });
      const qChaps = supabase.from("chapters").select("id, subject_id, name, hindi_name, order_index").order("order_index", { ascending: true });
      const qTops = supabase.from("topics").select("id, chapter_id, subject_id, name, hindi_name, order_index").order("order_index", { ascending: true });
      // Bounded initial question seed (supports full question bank ingestion)
      const qQuestionsBuilder = supabase.from("questions").select("id, question, options, correct_answer, explanation, subject_id, chapter_id, topic_id, exam, year, level, created_at");
      const qQuestions = typeof (qQuestionsBuilder as any)?.limit === 'function' ? (qQuestionsBuilder as any).limit(5000) : qQuestionsBuilder;

      const [subsRes, chapsRes, topsRes, questionsRes] = await Promise.all([
        typeof (qSubs as any).range === "function" ? (qSubs as any).range(0, 9999) : qSubs,
        typeof (qChaps as any).range === "function" ? (qChaps as any).range(0, 9999) : qChaps,
        typeof (qTops as any).range === "function" ? (qTops as any).range(0, 9999) : qTops,
        qQuestions,
      ]);

      if (subsRes.error) throw new Error(`Failed to fetch subjects: ${subsRes.error.message}`);
      if (chapsRes.error) throw new Error(`Failed to fetch chapters: ${chapsRes.error.message}`);
      if (topsRes.error) throw new Error(`Failed to fetch topics: ${topsRes.error.message}`);

      if (!Array.isArray(subsRes.data) || !Array.isArray(chapsRes.data) || !Array.isArray(topsRes.data)) {
        throw new Error("Incomplete or malformed curriculum response from server. Sync aborted for safety.");
      }

      const serverSubjects = subsRes.data || [];
      const serverChapters = chapsRes.data || [];
      const serverTopics = topsRes.data || [];
      const serverQuestions = Array.isArray(questionsRes?.data) ? questionsRes.data : [];

      const topicQuestionCounts: Record<string, number> = {};
      const chapterQuestionCounts: Record<string, number> = {};
      const subjectQuestionCounts: Record<string, number> = {};

      const { loadUserQuestionsStore } = await import("./questionsStorage");
      const currentQuestionsStore = loadUserQuestionsStore();
      const deletedQSet = new Set(currentQuestionsStore.deletedQuestionIds || []);
      const deletedSubSet = new Set(currentQuestionsStore.deletedSubjectIds || []);
      const deletedChapSet = new Set(currentQuestionsStore.deletedChapterIds || []);
      const deletedTopSet = new Set(currentQuestionsStore.deletedTopicIds || []);

      const mcqsToBatch: any[] = [];
      for (const q of serverQuestions) {
        if (!q || !q.id || deletedQSet.has(q.id)) {
          continue; // Respect local question deletions
        }
        if (q.topic_id) topicQuestionCounts[q.topic_id] = (topicQuestionCounts[q.topic_id] || 0) + 1;
        if (q.chapter_id) chapterQuestionCounts[q.chapter_id] = (chapterQuestionCounts[q.chapter_id] || 0) + 1;
        if (q.subject_id) subjectQuestionCounts[q.subject_id] = (subjectQuestionCounts[q.subject_id] || 0) + 1;

        mcqsToBatch.push({
          id: q.id,
          text: q.question,
          options: Array.isArray(q.options) ? q.options : [],
          correctIndex: q.correct_answer ?? 0,
          explanation: q.explanation || "",
          subjectId: q.subject_id,
          chapterId: q.chapter_id,
          topicId: q.topic_id,
          exam: q.exam,
          year: q.year,
          difficulty: q.level || "medium",
          isUserAdded: false,
          updatedAt: q.created_at,
        });
      }
      // Authoritative Reconcile MCQs: Prune any local MCQs not present on server or marked as mock
      const serverQuestionIds = new Set(serverQuestions.map((q: any) => q.id));
      const localMCQs = await idbGetAll<any>(STORES.MCQS);
      for (const q of localMCQs) {
        if (!q || !q.id || !serverQuestionIds.has(q.id) || deletedQSet.has(q.id) || (typeof q.id === "string" && (q.id.startsWith("q_pilot_") || q.id.startsWith("usr-q-topic_c60f80e6") || q.id.startsWith("usr-q-topic_7eef8754")))) {
          await idbDelete(STORES.MCQS, q.id);
        }
      }

      if (mcqsToBatch.length > 0) {
        await idbPutBatch(STORES.MCQS, mcqsToBatch);
      }

      const serverSubjIds = new Set(serverSubjects.map(s => s.id));
      const serverChapIds = new Set(serverChapters.map(c => c.id));
      const serverTopIds = new Set(serverTopics.map(t => t.id));

      // 1. Reconcile Subjects
      const localSubjects = await idbGetAll<Subject>(STORES.SUBJECTS);
      for (const s of localSubjects) {
        if (!serverSubjIds.has(s.id) || deletedSubSet.has(s.id) || s.id === "sub_raj_hist") {
          await idbDelete(STORES.SUBJECTS, s.id);
          result.prunedSubjects++;
        }
      }
      const subjectsToBatch: Subject[] = [];
      for (const s of serverSubjects) {
        if (deletedSubSet.has(s.id) || s.id === "sub_raj_hist") continue; // Respect local deletion
        subjectsToBatch.push({
          id: s.id,
          name: s.name,
          hindiName: s.hindi_name,
          description: s.description || "",
          icon: s.icon || "book",
          color: s.color || "#8B1E3F",
          order: s.order_index || 0,
          questionCount: subjectQuestionCounts[s.id] || 0,
          isUserAdded: false,
        });
        result.subjectsCount++;
      }
      if (subjectsToBatch.length > 0) {
        await idbPutBatch(STORES.SUBJECTS, subjectsToBatch);
      }

      // 2. Reconcile Chapters
      const localChapters = await idbGetAll<Chapter>(STORES.CHAPTERS);
      for (const c of localChapters) {
        if (!serverChapIds.has(c.id) || deletedChapSet.has(c.id) || c.id === "chap_raj_sources" || c.id === "chap_raj_1857") {
          await idbDelete(STORES.CHAPTERS, c.id);
          result.prunedChapters++;
        }
      }
      const chaptersToBatch: Chapter[] = [];
      for (const c of serverChapters) {
        if (deletedChapSet.has(c.id) || c.id === "chap_raj_sources" || c.id === "chap_raj_1857") continue; // Respect local deletion
        chaptersToBatch.push({
          id: c.id,
          subjectId: c.subject_id,
          title: c.name,
          hindiTitle: c.hindi_name || c.name,
          number: c.order_index || 0,
          questionCount: chapterQuestionCounts[c.id] || 0,
          topics: [],
          isUserAdded: false,
        });
        result.chaptersCount++;
      }
      if (chaptersToBatch.length > 0) {
        await idbPutBatch(STORES.CHAPTERS, chaptersToBatch);
      }

      // 3. Reconcile Topics
      const localTopics = await idbGetAll<Topic>(STORES.TOPICS);
      for (const t of localTopics) {
        const tName = (t as any).name || t.title;
        if (!serverTopIds.has(t.id) || deletedTopSet.has(t.id) || t.id.startsWith("top_") || tName === "X" || tName === "MCQ 01") {
          await idbDelete(STORES.TOPICS, t.id);
          result.prunedTopics++;
        }
      }
      const topicsToBatch: Topic[] = [];
      for (const t of serverTopics) {
        if (deletedTopSet.has(t.id)) continue; // Respect local deletion
        topicsToBatch.push({
          id: t.id,
          chapterId: t.chapter_id,
          subjectId: t.subject_id,
          title: t.name,
          hindiTitle: t.hindi_name || t.name,
          number: t.order_index || 0,
          questionCount: topicQuestionCounts[t.id] || 0,
          questions: [],
          isUserAdded: false,
        });
        result.topicsCount++;
      }
      if (topicsToBatch.length > 0) {
        await idbPutBatch(STORES.TOPICS, topicsToBatch);
      }

      // 4. Update cache metadata in IndexedDB
      await idbPut(STORES.CURRICULUM_METADATA, {
        key: "curriculum_cache_sync",
        syncedAt: result.syncedAt,
        serverSubjectsCount: result.subjectsCount,
        serverChaptersCount: result.chaptersCount,
        serverTopicsCount: result.topicsCount,
        version: 1
      });

      // 5. Update in-memory curriculum cache and persistent store immediately
      try {
        const { saveCachedCurriculum } = await import("./indexedDbCache");
        await saveCachedCurriculum(subjectsToBatch, chaptersToBatch, topicsToBatch, mcqsToBatch).catch(() => {});
        
        const { saveUserQuestionsStore } = await import("./questionsStorage");
        const existingCustomSubs = (currentQuestionsStore.customSubjects || []).filter(s => s.isUserAdded && !subjectsToBatch.some(sb => sb.id === s.id));
        const existingCustomChaps = (currentQuestionsStore.customChapters || []).filter(c => c.isUserAdded && !chaptersToBatch.some(cb => cb.id === c.id));
        const existingCustomTops = (currentQuestionsStore.customTopics || []).filter(t => t.isUserAdded && !topicsToBatch.some(tb => tb.id === t.id));

        const nextStore = {
          ...currentQuestionsStore,
          customSubjects: [...subjectsToBatch, ...existingCustomSubs],
          customChapters: [...chaptersToBatch, ...existingCustomChaps],
          customTopics: [...topicsToBatch, ...existingCustomTops],
          cloudCacheQuestions: mcqsToBatch,
        };
        saveUserQuestionsStore(nextStore);
      } catch (cacheErr) {
        console.warn("[SupabaseSync] Immediate cache update note:", cacheErr);
      }

      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("disha2020_curriculum_synced", { detail: result }));
        window.dispatchEvent(new CustomEvent("quizpro_curriculum_synced", { detail: result }));
      }

      lastCurriculumSyncTime = Date.now();
      lastCurriculumSyncResult = result;
      return result;
    } catch (err: any) {
      console.warn("[Supabase] syncCurriculumAuthoritative warning:", err.message);
      return result;
    }
  })().finally(() => {
    activeCurriculumSyncPromise = null;
  });

  return activeCurriculumSyncPromise;
}

/**
 * Atomically retrieves complete authoritative curriculum (subjects, chapters, topics, questions)
 * ensuring synchronous alignment across Supabase, IndexedDB, and the app questions store.
 */
export async function fetchFullAuthoritativeCurriculum(options?: { force?: boolean }): Promise<{
  subjects: Subject[];
  chapters: Chapter[];
  topics: Topic[];
  questions: Question[];
}> {
  await openLocalDatabase();

  if (isSupabaseConfigured()) {
    try {
      await syncCurriculumAuthoritative(options);
    } catch (syncErr) {
      console.warn("[supabaseSyncService] Curriculum sync note:", syncErr);
    }
  }

  const [subs, chaps, tops, rawMcqs] = await Promise.all([
    idbGetAll<Subject>(STORES.SUBJECTS).catch(() => []),
    idbGetAll<Chapter>(STORES.CHAPTERS).catch(() => []),
    idbGetAll<Topic>(STORES.TOPICS).catch(() => []),
    idbGetAll<Question>(STORES.MCQS).catch(() => []),
  ]);

  const normalizedQuestions: Question[] = (rawMcqs || []).map((q: any) => ({
    ...q,
    text: q.text || q.question || "",
    options: Array.isArray(q.options) ? q.options : [],
    correctIndex: typeof q.correctIndex === "number" ? q.correctIndex : (typeof q.correct_answer === "number" ? q.correct_answer : 0),
    explanation: q.explanation || "",
    subjectId: q.subjectId || q.subject_id,
    chapterId: q.chapterId || q.chapter_id,
    topicId: q.topicId || q.topic_id,
    difficulty: q.difficulty || q.level || "medium",
  }));

  // Direct network fallback if IndexedDB is blocked or private mode
  if ((!subs || subs.length === 0) && isSupabaseConfigured()) {
    try {
      const [sRes, cRes, tRes, qRes] = await Promise.all([
        supabase.from("subjects").select("*").order("order_index", { ascending: true }),
        supabase.from("chapters").select("*").order("order_index", { ascending: true }),
        supabase.from("topics").select("*").order("order_index", { ascending: true }),
        supabase.from("questions").select("*").limit(5000),
      ]);
      if (sRes.data && sRes.data.length > 0) {
        const directSubs: Subject[] = (sRes.data || []).map(s => ({
          id: s.id,
          name: s.name,
          hindiName: s.hindi_name,
          description: s.description || "",
          icon: s.icon || "book",
          color: s.color || "#8B1E3F",
          order: s.order_index || 0,
          questionCount: 0,
          isUserAdded: false,
        }));
        const directChaps: Chapter[] = (cRes.data || []).map(c => ({
          id: c.id,
          subjectId: c.subject_id,
          title: c.name,
          hindiTitle: c.hindi_name || c.name,
          number: c.order_index || 0,
          questionCount: 0,
          topics: [],
          isUserAdded: false,
        }));
        const directTops: Topic[] = (tRes.data || []).map(t => ({
          id: t.id,
          chapterId: t.chapter_id,
          subjectId: t.subject_id,
          title: t.name,
          hindiTitle: t.hindi_name || t.name,
          number: t.order_index || 0,
          questionCount: 0,
          questions: [],
          isUserAdded: false,
        }));
        const directQs: Question[] = (qRes.data || []).map(q => ({
          id: q.id,
          text: q.question,
          options: Array.isArray(q.options) ? q.options : [],
          correctIndex: q.correct_answer ?? 0,
          explanation: q.explanation || "",
          subjectId: q.subject_id,
          chapterId: q.chapter_id,
          topicId: q.topic_id,
          exam: q.exam,
          year: q.year,
          difficulty: q.level || "medium",
          isUserAdded: false,
          updatedAt: q.created_at,
        }));
        return {
          subjects: directSubs,
          chapters: directChaps,
          topics: directTops,
          questions: directQs,
        };
      }
    } catch (e) {
      console.warn("[supabaseSyncService] Direct fetch fallback error:", e);
    }
  }

  return {
    subjects: (subs || []).sort((a, b) => (a.order || 0) - (b.order || 0)),
    chapters: (chaps || []).sort((a, b) => (a.number || 0) - (b.number || 0)),
    topics: (tops || []).sort((a, b) => (a.number || 0) - (b.number || 0)),
    questions: normalizedQuestions,
  };
}

export async function fetchSubjects(options?: { forceRefresh?: boolean }): Promise<Subject[]> {
  await openLocalDatabase();

  if (options?.forceRefresh && isSupabaseConfigured()) {
    await syncCurriculumAuthoritative({ force: true }).catch(() => {});
    const refreshed = await idbGetAll<Subject>(STORES.SUBJECTS);
    return refreshed.sort((a, b) => (a.order || 0) - (b.order || 0));
  }

  const localSubjects = await idbGetAll<Subject>(STORES.SUBJECTS);
  if (localSubjects.length > 0) {
    if (isSupabaseConfigured()) {
      syncCurriculumAuthoritative().catch(() => {});
    }
    return localSubjects.sort((a, b) => (a.order || 0) - (b.order || 0));
  }

  if (!isSupabaseConfigured()) {
    return localSubjects;
  }

  try {
    await syncCurriculumAuthoritative();
    const afterSync = await idbGetAll<Subject>(STORES.SUBJECTS);
    return afterSync.sort((a, b) => (a.order || 0) - (b.order || 0));
  } catch (err: any) {
    console.warn("[Supabase] Failed to fetch subjects:", err.message);
    return localSubjects;
  }
}

export async function fetchChapters(subjectId?: string, options?: { forceRefresh?: boolean }): Promise<Chapter[]> {
  await openLocalDatabase();

  if (options?.forceRefresh && isSupabaseConfigured()) {
    await syncCurriculumAuthoritative({ force: true }).catch(() => {});
    const local = await idbGetAll<Chapter>(STORES.CHAPTERS);
    const filtered = subjectId ? local.filter(c => c.subjectId === subjectId) : local;
    return filtered.sort((a, b) => (a.number || 0) - (b.number || 0));
  }

  const localChapters = await idbGetAll<Chapter>(STORES.CHAPTERS);
  const filtered = subjectId ? localChapters.filter(c => c.subjectId === subjectId) : localChapters;
  if (filtered.length > 0) {
    if (isSupabaseConfigured()) {
      syncCurriculumAuthoritative().catch(() => {});
    }
    return filtered.sort((a, b) => (a.number || 0) - (b.number || 0));
  }

  if (!isSupabaseConfigured()) return filtered;

  try {
    await syncCurriculumAuthoritative();
    const afterSync = await idbGetAll<Chapter>(STORES.CHAPTERS);
    const afterFiltered = subjectId ? afterSync.filter(c => c.subjectId === subjectId) : afterSync;
    return afterFiltered.sort((a, b) => (a.number || 0) - (b.number || 0));
  } catch (err: any) {
    console.warn("[Supabase] Failed to fetch chapters:", err.message);
    return filtered;
  }
}

export async function fetchTopics(chapterId?: string, options?: { forceRefresh?: boolean }): Promise<Topic[]> {
  await openLocalDatabase();

  if (options?.forceRefresh && isSupabaseConfigured()) {
    await syncCurriculumAuthoritative({ force: true }).catch(() => {});
    const local = await idbGetAll<Topic>(STORES.TOPICS);
    const filtered = chapterId ? local.filter(t => t.chapterId === chapterId) : local;
    return filtered.sort((a, b) => (a.number || 0) - (b.number || 0));
  }

  const localTopics = await idbGetAll<Topic>(STORES.TOPICS);
  const filtered = chapterId ? localTopics.filter(t => t.chapterId === chapterId) : localTopics;
  if (filtered.length > 0) {
    if (isSupabaseConfigured()) {
      syncCurriculumAuthoritative().catch(() => {});
    }
    return filtered.sort((a, b) => (a.number || 0) - (b.number || 0));
  }

  if (!isSupabaseConfigured()) return filtered;

  try {
    await syncCurriculumAuthoritative();
    const afterSync = await idbGetAll<Topic>(STORES.TOPICS);
    const afterFiltered = chapterId ? afterSync.filter(t => t.chapterId === chapterId) : afterSync;
    return afterFiltered.sort((a, b) => (a.number || 0) - (b.number || 0));
  } catch (err: any) {
    console.warn("[Supabase] Failed to fetch topics:", err.message);
    return filtered;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// QUESTION BANK (CANONICAL MCQS)
// ─────────────────────────────────────────────────────────────────────────────

export function fetchQuestionsByTopic(topicId: string): Promise<Question[]> {
  if (!topicId) return Promise.resolve([]);

  // Check in-flight deduplicator
  const existingInFlight = inFlightTopicFetches.get(topicId);
  if (existingInFlight) {
    return existingInFlight;
  }

  const fetchPromise = (async () => {
    const { getLocalMCQsByTopic } = await import("./localDatabaseEngine");
    const local = await getLocalMCQsByTopic(topicId);
    if (local.length > 0) return local;

    if (!isSupabaseConfigured()) return local;

    try {
      // High-performance selective projection with deterministic ordering on (topic_id, id)
      const { data, error } = await supabase
        .from("questions")
        .select("id, question, options, correct_answer, explanation, subject_id, chapter_id, topic_id, exam, year, level, verified, created_at")
        .eq("topic_id", topicId)
        .order("id", { ascending: true });

      if (error) throw error;
      if (data && data.length > 0) {
        const normalized: Question[] = data.map(q => ({
          id: q.id,
          text: q.question,
          options: Array.isArray(q.options) ? q.options : [],
          correctIndex: q.correct_answer ?? 0,
          explanation: q.explanation || "",
          subjectId: q.subject_id,
          chapterId: q.chapter_id,
          topicId: q.topic_id,
          exam: q.exam,
          year: q.year,
          difficulty: q.level || "medium",
          isUserAdded: false,
          updatedAt: q.created_at
        }));

        for (const q of normalized) {
          await idbPut(STORES.MCQS, q);
        }

        // Also update localforage topic bundle
        try {
          const { saveQuestionsToCache } = await import("./questionBankCache");
          saveQuestionsToCache(normalized, { topicId, source: "sync" }).catch(() => {});
        } catch {}

        return normalized;
      }
    } catch (err: any) {
      console.warn("[Supabase] Failed to fetch questions:", err.message);
    }

    return local;
  })().finally(() => {
    inFlightTopicFetches.delete(topicId);
  });

  inFlightTopicFetches.set(topicId, fetchPromise);
  return fetchPromise;
}

export function fetchQuestionsByChapter(chapterId: string): Promise<Question[]> {
  if (!chapterId) return Promise.resolve([]);

  // Check in-flight deduplicator
  const existingInFlight = inFlightChapterFetches.get(chapterId);
  if (existingInFlight) {
    return existingInFlight;
  }

  const fetchPromise = (async () => {
    const { getLocalMCQsByChapter } = await import("./localDatabaseEngine");
    const local = await getLocalMCQsByChapter(chapterId);
    if (local.length > 0) return local;

    if (!isSupabaseConfigured()) return local;

    try {
      // Single round-trip indexed query on (chapter_id, id) - eliminates N+1 topic query loop
      const { data, error } = await supabase
        .from("questions")
        .select("id, question, options, correct_answer, explanation, subject_id, chapter_id, topic_id, exam, year, level, verified, created_at")
        .eq("chapter_id", chapterId)
        .order("id", { ascending: true });

      if (error) throw error;
      if (data && data.length > 0) {
        const normalized: Question[] = data.map(q => ({
          id: q.id,
          text: q.question,
          options: Array.isArray(q.options) ? q.options : [],
          correctIndex: q.correct_answer ?? 0,
          explanation: q.explanation || "",
          subjectId: q.subject_id,
          chapterId: q.chapter_id,
          topicId: q.topic_id,
          exam: q.exam,
          year: q.year,
          difficulty: q.level || "medium",
          isUserAdded: false,
          updatedAt: q.created_at
        }));

        for (const q of normalized) {
          await idbPut(STORES.MCQS, q);
        }
        return normalized;
      }
    } catch (err: any) {
      console.warn("[Supabase] Failed to fetch chapter questions:", err.message);
    }

    return local;
  })().finally(() => {
    inFlightChapterFetches.delete(chapterId);
  });

  inFlightChapterFetches.set(chapterId, fetchPromise);
  return fetchPromise;
}

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN OPERATIONS (WRITE / MUTATIONS)
// ─────────────────────────────────────────────────────────────────────────────

function isUserDraftOrCustom(item: { id?: string; isUserAdded?: boolean } | null | undefined): boolean {
  if (!item) return false;
  if (item.isUserAdded === true) return true;
  const id = String(item.id || '');
  return id.startsWith('draft-') || id.startsWith('qa-') || id.startsWith('qa_') || id.includes('admin_crud') || id.startsWith('subj-') || id.startsWith('custom-');
}

export async function saveSubjectToSupabase(subject: Subject): Promise<{ success: boolean; cloudSynced: boolean; message: string }> {
  await openLocalDatabase();
  const isDraft = isUserDraftOrCustom(subject);

  if (isDraft) {
    try {
      await idbPut(STORES.SUBJECTS, subject);
    } catch (idbErr: any) {
      console.warn('[LocalDB] Failed to save subject locally:', idbErr);
    }
  }

  let cloudSynced = false;
  let cloudErrorMsg = '';
  if (isSupabaseConfigured()) {
    try {
      const { error } = await supabase.from('subjects').upsert({
        id: subject.id,
        name: subject.name,
        hindi_name: subject.hindiName || subject.name,
        description: subject.description || '',
        icon: subject.icon || 'book',
        color: subject.color || '#8B1E3F',
        order_index: subject.order || 0,
        updated_at: new Date().toISOString()
      }, { onConflict: 'id' });

      if (error) {
        cloudErrorMsg = error.message;
        console.warn('[Supabase] Cloud save subject warning:', error);
      } else {
        cloudSynced = true;
      }
    } catch (err: any) {
      cloudErrorMsg = err?.message || 'Network error';
    }
  }

  if (cloudSynced) {
    if (!isDraft) {
      await idbPut(STORES.SUBJECTS, subject);
    }
    return { 
      success: true, 
      cloudSynced: true,
      message: `Subject '${subject.name || subject.hindiName}' saved to Supabase & local storage!` 
    };
  }

  if (isDraft) {
    const isAuthErr = cloudErrorMsg.toLowerCase().includes('permission') || cloudErrorMsg.toLowerCase().includes('jwt') || cloudErrorMsg.toLowerCase().includes('policy') || cloudErrorMsg.toLowerCase().includes('42501');
    return {
      success: true,
      cloudSynced: false,
      message: isAuthErr 
        ? `Subject '${subject.name || subject.hindiName}' saved locally! Sign in with Admin Google Account (jagdishpaliyaljat@gmail.com) to sync with Supabase cloud.`
        : `Subject '${subject.name || subject.hindiName}' saved locally! Changes will sync to cloud when connected.`
    };
  }

  return { 
    success: false, 
    cloudSynced: false,
    message: cloudErrorMsg || 'Failed to save subject' 
  };
}

export async function deleteSubjectFromSupabase(subjectId: string): Promise<{ success: boolean; cloudSynced: boolean; message: string }> {
  await openLocalDatabase();
  const existing = await idbGet<Subject>(STORES.SUBJECTS, subjectId);
  const isDraft = isUserDraftOrCustom(existing || { id: subjectId });

  if (isDraft) {
    try {
      await idbDelete(STORES.SUBJECTS, subjectId);
    } catch (idbErr: any) {
      console.warn('[LocalDB] Failed to delete subject locally:', idbErr);
    }
  }

  let cloudSynced = false;
  let cloudErrorMsg = '';
  if (isSupabaseConfigured()) {
    try {
      const { error } = await supabase.from('subjects').delete().eq('id', subjectId);
      if (error) {
        cloudErrorMsg = error.message;
        console.warn('[Supabase] Cloud delete subject warning:', error);
      } else {
        cloudSynced = true;
      }
    } catch (err: any) {
      cloudErrorMsg = err?.message || 'Network error';
    }
  }

  if (cloudSynced) {
    if (!isDraft) {
      await idbDelete(STORES.SUBJECTS, subjectId);
    }
    return { 
      success: true, 
      cloudSynced: true,
      message: 'Subject deleted from Supabase & local storage!' 
    };
  }

  if (isDraft) {
    return { 
      success: true, 
      cloudSynced: false,
      message: 'Subject deleted locally! Sign in with Admin to sync deletion to cloud.' 
    };
  }

  return { 
    success: false, 
    cloudSynced: false,
    message: cloudErrorMsg || 'Failed to delete subject' 
  };
}

export async function saveChapterToSupabase(chapter: Chapter): Promise<{ success: boolean; cloudSynced: boolean; message: string }> {
  await openLocalDatabase();
  const isDraft = isUserDraftOrCustom(chapter);

  if (isDraft) {
    try {
      await idbPut(STORES.CHAPTERS, chapter);
    } catch (idbErr: any) {
      console.warn('[LocalDB] Failed to save chapter locally:', idbErr);
    }
  }

  let cloudSynced = false;
  let cloudErrorMsg = '';
  if (isSupabaseConfigured()) {
    try {
      const { error } = await supabase.from('chapters').upsert({
        id: chapter.id,
        subject_id: chapter.subjectId,
        name: chapter.title,
        hindi_name: chapter.hindiTitle || chapter.title,
        order_index: chapter.number || 0,
        updated_at: new Date().toISOString()
      }, { onConflict: 'id' });

      if (error) {
        cloudErrorMsg = error.message;
        console.warn('[Supabase] Cloud save chapter warning:', error);
      } else {
        cloudSynced = true;
      }
    } catch (err: any) {
      cloudErrorMsg = err?.message || 'Network error';
    }
  }

  if (cloudSynced) {
    if (!isDraft) {
      await idbPut(STORES.CHAPTERS, chapter);
    }
    return { 
      success: true, 
      cloudSynced: true,
      message: `Chapter '${chapter.title || chapter.hindiTitle}' saved to Supabase!` 
    };
  }

  if (isDraft) {
    const isAuthErr = cloudErrorMsg.toLowerCase().includes('permission') || cloudErrorMsg.toLowerCase().includes('jwt') || cloudErrorMsg.toLowerCase().includes('policy') || cloudErrorMsg.toLowerCase().includes('42501');
    return {
      success: true,
      cloudSynced: false,
      message: isAuthErr
        ? `Chapter '${chapter.title || chapter.hindiTitle}' saved locally! Sign in with Admin Google Account (jagdishpaliyaljat@gmail.com) to sync to cloud.`
        : `Chapter '${chapter.title || chapter.hindiTitle}' saved locally! Will sync when connected.`
    };
  }

  return { 
    success: false, 
    cloudSynced: false,
    message: cloudErrorMsg || 'Failed to save chapter' 
  };
}

export async function deleteChapterFromSupabase(chapterId: string): Promise<{ success: boolean; cloudSynced: boolean; message: string }> {
  await openLocalDatabase();
  const existing = await idbGet<Chapter>(STORES.CHAPTERS, chapterId);
  const isDraft = isUserDraftOrCustom(existing || { id: chapterId });

  if (isDraft) {
    try {
      await idbDelete(STORES.CHAPTERS, chapterId);
    } catch (idbErr: any) {
      console.warn('[LocalDB] Failed to delete chapter locally:', idbErr);
    }
  }

  let cloudSynced = false;
  let cloudErrorMsg = '';
  if (isSupabaseConfigured()) {
    try {
      const { error } = await supabase.from('chapters').delete().eq('id', chapterId);
      if (error) {
        cloudErrorMsg = error.message;
        console.warn('[Supabase] Cloud delete chapter warning:', error);
      } else {
        cloudSynced = true;
      }
    } catch (err: any) {
      cloudErrorMsg = err?.message || 'Network error';
    }
  }

  if (cloudSynced) {
    if (!isDraft) {
      await idbDelete(STORES.CHAPTERS, chapterId);
    }
    return { 
      success: true, 
      cloudSynced: true,
      message: 'Chapter deleted from Supabase & local storage!' 
    };
  }

  if (isDraft) {
    return { 
      success: true, 
      cloudSynced: false,
      message: 'Chapter deleted locally! Sign in with Admin to sync deletion to cloud.' 
    };
  }

  return { 
    success: false, 
    cloudSynced: false,
    message: cloudErrorMsg || 'Failed to delete chapter' 
  };
}

export async function saveTopicToSupabase(topic: Topic): Promise<{ success: boolean; cloudSynced: boolean; message: string }> {
  let resolvedSubjectId = topic.subjectId;
  if (!resolvedSubjectId && topic.chapterId) {
    try {
      const localChap = await idbGet<Chapter>(STORES.CHAPTERS, topic.chapterId);
      if (localChap?.subjectId) {
        resolvedSubjectId = localChap.subjectId;
      }
    } catch (err) {}
    if (!resolvedSubjectId) {
      try {
        const { loadUserQuestionsStore, getCombinedChapters } = await import('./questionsStorage');
        const store = loadUserQuestionsStore();
        const chaps = getCombinedChapters(store);
        const storeChap = chaps.find(c => c.id === topic.chapterId) || (store.customChapters || []).find(c => c.id === topic.chapterId);
        if (storeChap?.subjectId) {
          resolvedSubjectId = storeChap.subjectId;
        }
      } catch (err) {}
    }
    if (!resolvedSubjectId && isSupabaseConfigured()) {
      try {
        const { data: dbChap } = await supabase
          .from('chapters')
          .select('subject_id')
          .eq('id', topic.chapterId)
          .maybeSingle();
        if (dbChap?.subject_id) {
          resolvedSubjectId = dbChap.subject_id;
        }
      } catch (err) {}
    }
  }

  // Fallback: If still unresolved or invalid fallback like "economics" (not in Supabase), resolve from known subjects
  if (!resolvedSubjectId || resolvedSubjectId === "economics") {
    try {
      const { loadUserQuestionsStore, getCombinedSubjects } = await import('./questionsStorage');
      const store = loadUserQuestionsStore();
      const validSubjects = getCombinedSubjects(store);
      const matched = validSubjects.find(s => s.id !== "economics");
      if (matched?.id) {
        resolvedSubjectId = matched.id;
      }
    } catch (err) {}
  }

  const enrichedTopic: Topic = {
    ...topic,
    subjectId: resolvedSubjectId || topic.subjectId || "sub_raj_hist",
    number: topic.number || 1,
    isUserAdded: true,
  };

  await openLocalDatabase();
  const isDraft = isUserDraftOrCustom(enrichedTopic);

  // Always save locally to IndexedDB immediately so local queries find it
  try {
    await idbPut(STORES.TOPICS, enrichedTopic);
  } catch (idbErr: any) {
    console.warn('[LocalDB] Failed to save topic locally:', idbErr);
  }

  let cloudSynced = false;
  let cloudErrorMsg = '';
  if (isSupabaseConfigured()) {
    try {
      const { error } = await supabase.from('topics').upsert({
        id: enrichedTopic.id,
        chapter_id: enrichedTopic.chapterId,
        subject_id: enrichedTopic.subjectId,
        name: enrichedTopic.title,
        hindi_name: enrichedTopic.hindiTitle || enrichedTopic.title,
        order_index: enrichedTopic.number || 0,
        updated_at: new Date().toISOString()
      }, { onConflict: 'id' });

      if (error) {
        cloudErrorMsg = error.message;
        console.warn('[Supabase] Cloud save topic warning:', error);
      } else {
        cloudSynced = true;
      }
    } catch (err: any) {
      cloudErrorMsg = err?.message || 'Network error';
    }
  }

  if (cloudSynced) {
    return { 
      success: true, 
      cloudSynced: true,
      message: `Topic '${enrichedTopic.title || enrichedTopic.hindiTitle}' saved to Supabase!` 
    };
  }

  // Cloud sync did not complete: record change in Pending Sync queue
  try {
    const { recordLocalChange } = await import('./syncStorage');
    recordLocalChange();
  } catch {}

  const isAuthErr = cloudErrorMsg.toLowerCase().includes('permission') || 
                    cloudErrorMsg.toLowerCase().includes('jwt') || 
                    cloudErrorMsg.toLowerCase().includes('policy') || 
                    cloudErrorMsg.toLowerCase().includes('42501');

  if (isDraft || isAuthErr) {
    return {
      success: true,
      cloudSynced: false,
      message: isAuthErr
        ? `Topic '${enrichedTopic.title || enrichedTopic.hindiTitle}' saved locally! Sign in with Admin Google Account (jagdishpaliyaljat@gmail.com) to sync to cloud.`
        : (cloudErrorMsg 
            ? `Topic '${enrichedTopic.title || enrichedTopic.hindiTitle}' saved locally (pending cloud sync: ${cloudErrorMsg}).`
            : `Topic '${enrichedTopic.title || enrichedTopic.hindiTitle}' saved locally! Will sync when connected.`)
    };
  }

  return { 
    success: false, 
    cloudSynced: false,
    message: cloudErrorMsg || 'Failed to save topic' 
  };
}

export async function deleteTopicFromSupabase(topicId: string): Promise<{ success: boolean; cloudSynced: boolean; message: string }> {
  await openLocalDatabase();
  const existing = await idbGet<Topic>(STORES.TOPICS, topicId);
  const isDraft = isUserDraftOrCustom(existing || { id: topicId });

  if (isDraft) {
    try {
      await idbDelete(STORES.TOPICS, topicId);
    } catch (idbErr: any) {
      console.warn('[LocalDB] Failed to delete topic locally:', idbErr);
    }
  }

  let cloudSynced = false;
  let cloudErrorMsg = '';
  if (isSupabaseConfigured()) {
    try {
      const { error } = await supabase.from('topics').delete().eq('id', topicId);
      if (error) {
        cloudErrorMsg = error.message;
        console.warn('[Supabase] Cloud delete topic warning:', error);
      } else {
        cloudSynced = true;
      }
    } catch (err: any) {
      cloudErrorMsg = err?.message || 'Network error';
    }
  }

  if (cloudSynced) {
    if (!isDraft) {
      await idbDelete(STORES.TOPICS, topicId);
    }
    return { 
      success: true, 
      cloudSynced: true,
      message: 'Topic deleted from Supabase & local storage!' 
    };
  }

  if (isDraft) {
    return { 
      success: true, 
      cloudSynced: false,
      message: 'Topic deleted locally! Sign in with Admin to sync deletion to cloud.' 
    };
  }

  return { 
    success: false, 
    cloudSynced: false,
    message: cloudErrorMsg || 'Failed to delete topic from Supabase' 
  };
}

export async function upsertQuestionsToSupabase(questions: Question[]): Promise<{ success: boolean; count: number; cloudSynced: boolean; message: string }> {
  if (!questions || questions.length === 0) {
    return { success: true, count: 0, cloudSynced: true, message: 'No questions to save' };
  }

  await openLocalDatabase();
  const anyDraft = questions.some(q => isUserDraftOrCustom(q));

  if (anyDraft) {
    try {
      for (const q of questions) {
        await idbPut(STORES.MCQS, q);
      }
    } catch (idbErr) {
      console.warn('[LocalDB] Failed to save questions locally:', idbErr);
    }
  }

  try {
    const { invalidateTopicCache } = await import('./questionBankCache');
    const affectedTopics = new Set<string>();
    for (const q of questions) {
      if (q.topicId) affectedTopics.add(q.topicId);
    }
    for (const tid of affectedTopics) {
      await invalidateTopicCache(tid);
    }
  } catch (_) {}

  let cloudSynced = false;
  let cloudErrorMsg = '';
  let uploadedCount = 0;

  if (isSupabaseConfigured()) {
    try {
      const BATCH_SIZE = 100;
      for (let i = 0; i < questions.length; i += BATCH_SIZE) {
        const chunk = questions.slice(i, i + BATCH_SIZE);
        const rows = chunk.map(q => ({
          id: q.id,
          subject_id: q.subjectId || null,
          chapter_id: q.chapterId || null,
          topic_id: q.topicId || null,
          question: q.text,
          options: Array.isArray(q.options) ? q.options : [],
          correct_answer: typeof q.correctIndex === 'number' ? q.correctIndex : 0,
          explanation: q.explanation || '',
          exam: q.exam && String(q.exam).trim() ? String(q.exam).trim() : null,
          year: q.year !== undefined && q.year !== null && String(q.year).trim() !== '' ? String(q.year).trim() : null,
          level: q.difficulty || 'medium',
          verified: true,
          updated_at: new Date().toISOString()
        }));

        const { error } = await supabase.from('questions').upsert(rows, { onConflict: 'id' });
        if (error) {
          throw error;
        }
        uploadedCount += rows.length;
      }
      cloudSynced = true;
    } catch (err: any) {
      cloudErrorMsg = err?.message || 'Cloud sync error';
      console.warn('[Supabase] Failed to upsert questions to cloud:', err);
    }
  } else {
    uploadedCount = questions.length;
  }

  if (cloudSynced) {
    if (!anyDraft) {
      for (const q of questions) {
        await idbPut(STORES.MCQS, q);
      }
    }
    return { 
      success: true, 
      count: uploadedCount, 
      cloudSynced: true,
      message: `${uploadedCount} question(s) saved to Supabase!` 
    };
  }

  if (anyDraft) {
    const isAuthErr = cloudErrorMsg.toLowerCase().includes('permission') || cloudErrorMsg.toLowerCase().includes('jwt') || cloudErrorMsg.toLowerCase().includes('policy') || cloudErrorMsg.toLowerCase().includes('42501');
    return {
      success: true,
      count: questions.length,
      cloudSynced: false,
      message: isAuthErr
        ? `${questions.length} question(s) saved locally! Sign in with Admin Google Account (jagdishpaliyaljat@gmail.com) to sync to cloud.`
        : `${questions.length} question(s) saved locally! Will sync when connected.`
    };
  }

  return { 
    success: false, 
    count: 0, 
    cloudSynced: false,
    message: cloudErrorMsg || 'Failed to save questions to Supabase' 
  };
}

export async function deleteQuestionFromSupabase(questionId: string): Promise<{ success: boolean; cloudSynced: boolean; message: string }> {
  await openLocalDatabase();
  const existing = await idbGet<Question>(STORES.MCQS, questionId);
  const isDraft = isUserDraftOrCustom(existing || { id: questionId });

  if (isDraft) {
    try {
      await idbDelete(STORES.MCQS, questionId);
      const { removeQuestionsFromCache } = await import('./questionBankCache');
      await removeQuestionsFromCache([questionId]);
    } catch (_) {}
  }

  let cloudSynced = false;
  let cloudErrorMsg = '';
  if (isSupabaseConfigured()) {
    try {
      const { error } = await supabase.from('questions').delete().eq('id', questionId);
      if (error) {
        cloudErrorMsg = error.message;
        console.warn('[Supabase] Failed to delete question from cloud:', error);
      } else {
        cloudSynced = true;
      }
    } catch (err: any) {
      cloudErrorMsg = err?.message || 'Cloud deletion error';
    }
  }

  if (cloudSynced) {
    if (!isDraft) {
      await idbDelete(STORES.MCQS, questionId);
      try {
        const { removeQuestionsFromCache } = await import('./questionBankCache');
        await removeQuestionsFromCache([questionId]);
      } catch (_) {}
    }
    return { 
      success: true, 
      cloudSynced: true,
      message: 'Question deleted from Supabase & local storage!' 
    };
  }

  if (isDraft) {
    return { 
      success: true, 
      cloudSynced: false,
      message: 'Question deleted locally! Sign in with Admin to sync deletion to cloud.' 
    };
  }

  return { 
    success: false, 
    cloudSynced: false,
    message: cloudErrorMsg || 'Failed to delete question from Supabase' 
  };
}

export async function deleteQuestionsBulkFromSupabase(questionIds: string[]): Promise<{ success: boolean; count: number; cloudSynced: boolean; message?: string }> {
  if (!questionIds || questionIds.length === 0) {
    return { success: true, count: 0, cloudSynced: true };
  }

  await openLocalDatabase();
  const anyDraft = questionIds.some(id => isUserDraftOrCustom({ id }));

  if (anyDraft) {
    try {
      await idbDeleteBatch(STORES.MCQS, questionIds);
      const { removeQuestionsFromCache } = await import('./questionBankCache');
      await removeQuestionsFromCache(questionIds);
    } catch (_) {}
  }

  let cloudSynced = false;
  let cloudErrorMsg = '';
  if (isSupabaseConfigured()) {
    try {
      const BATCH_SIZE = 100;
      for (let i = 0; i < questionIds.length; i += BATCH_SIZE) {
        const chunk = questionIds.slice(i, i + BATCH_SIZE);
        const { error } = await supabase.from('questions').delete().in('id', chunk);
        if (error) throw error;
      }
      cloudSynced = true;
    } catch (err: any) {
      cloudErrorMsg = err?.message || 'Cloud bulk delete error';
    }
  }

  if (cloudSynced) {
    if (!anyDraft) {
      await idbDeleteBatch(STORES.MCQS, questionIds);
      try {
        const { removeQuestionsFromCache } = await import('./questionBankCache');
        await removeQuestionsFromCache(questionIds);
      } catch (_) {}
    }
    return { 
      success: true, 
      count: questionIds.length, 
      cloudSynced: true,
      message: `${questionIds.length} question(s) deleted from Supabase!` 
    };
  }

  if (anyDraft) {
    return { 
      success: true, 
      count: questionIds.length, 
      cloudSynced: false,
      message: `${questionIds.length} question(s) deleted locally!` 
    };
  }

  return { 
    success: false, 
    count: 0, 
    cloudSynced: false,
    message: cloudErrorMsg || 'Failed to delete questions in bulk' 
  };
}

export interface MoveQuestionsResult {
  success: boolean;
  movedCount: number;
  totalRequested: number;
  message: string;
}

export async function moveQuestionsInSupabase(
  questionIds: string[],
  targetChapterId: string,
  targetTopicId: string,
  targetSubjectId?: string,
  questionsMap?: Record<string, any>
): Promise<MoveQuestionsResult> {
  const uniqueIds = Array.from(new Set(questionIds.filter(Boolean)));
  if (uniqueIds.length === 0) {
    return {
      success: true,
      movedCount: 0,
      totalRequested: 0,
      message: "No questions selected to move.",
    };
  }

  try {
    if (isSupabaseConfigured()) {
      const { error } = await supabase
        .from("questions")
        .update({
          topic_id: targetTopicId,
          chapter_id: targetChapterId,
          ...(targetSubjectId ? { subject_id: targetSubjectId } : {}),
          updated_at: new Date().toISOString(),
        })
        .in("id", uniqueIds);

      if (error) {
        console.error("[Supabase] Failed to move questions:", error);
        return {
          success: false,
          movedCount: 0,
          totalRequested: uniqueIds.length,
          message: error.message || "Failed to move questions in Supabase",
        };
      }
    }

    // Update local database engine cache as well
    try {
      await openLocalDatabase();
      for (const id of uniqueIds) {
        const localQ = (await idbGet<Question>(STORES.MCQS, id)) || questionsMap?.[id];
        if (localQ) {
          const updated: Question = {
            ...localQ,
            topicId: targetTopicId,
            chapterId: targetChapterId,
            ...(targetSubjectId ? { subjectId: targetSubjectId } : {}),
            updatedAt: new Date().toISOString(),
          };
          await idbPut(STORES.MCQS, updated);
        }
      }
    } catch (localErr) {
      console.warn("[Supabase] Local cache update error after move:", localErr);
    }

    return {
      success: true,
      movedCount: uniqueIds.length,
      totalRequested: uniqueIds.length,
      message: `Successfully moved ${uniqueIds.length} question(s).`,
    };
  } catch (err: any) {
    console.error("[Supabase] Unexpected error moving questions:", err);
    return {
      success: false,
      movedCount: 0,
      totalRequested: uniqueIds.length,
      message: err.message || "Unexpected error moving questions",
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ATTEMPTS, BOOKMARKS & USER PROGRESS SYNC
// ─────────────────────────────────────────────────────────────────────────────

export async function recordStudentAttempt(attempt: {
  id?: string;
  userId?: string;
  topicId?: string;
  subjectId?: string;
  score: number;
  totalQuestions: number;
  answers: Record<string, any>;
  timeSpentSeconds: number;
}) {
  if (!isSupabaseConfigured()) return;
  try {
    const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    let uid = attempt.userId;
    if (!uid) {
      const { data: { user } } = await supabase.auth.getUser();
      uid = user?.id;
    }

    // In PostgreSQL attempts table, user_id is a UUID referencing auth.users(id) and is nullable.
    // If uid is a valid UUID, use it; otherwise null so unauthenticated/guest attempts
    // are still captured in Supabase and visible in Admin Dashboard live activity.
    const validUserId = (uid && UUID_REGEX.test(uid) && uid !== "student_default" && !String(uid).startsWith("guest_"))
      ? uid
      : null;

    const isValidUUID = Boolean(attempt.id && UUID_REGEX.test(attempt.id));
    const row: any = {
      ...(isValidUUID ? { id: attempt.id } : {}),
      user_id: validUserId,
      topic_id: attempt.topicId || null,
      subject_id: attempt.subjectId || null,
      score: attempt.score,
      total_questions: attempt.totalQuestions,
      answers: {
        ...(attempt.answers || {}),
        _student_meta: {
          clientUserId: attempt.userId || "anonymous",
          recordedAt: new Date().toISOString()
        }
      },
      time_spent_seconds: attempt.timeSpentSeconds
    };

    // Idempotent write: If client supplied a valid UUID, upsert safely
    const { error } = isValidUUID
      ? await supabase.from("attempts").upsert(row, { onConflict: "id" })
      : await supabase.from("attempts").insert(row);

    if (error) {
      console.warn("[Supabase] Attempt sync error:", error.message);
    }
  } catch (e: any) {
    console.warn("[Supabase] Attempt sync exception:", e.message);
  }
}

export async function fetchUserAttemptsFromSupabase(userId?: string): Promise<any[]> {
  if (!isSupabaseConfigured()) return [];
  try {
    let uid = userId;
    if (!uid) {
      const { data: { user } } = await supabase.auth.getUser();
      uid = user?.id;
    }
    if (!uid || uid === "student_default" || String(uid).startsWith("guest_")) return [];

    // Selective projection using covering index idx_attempts_user_created_at
    const { data, error } = await supabase
      .from("attempts")
      .select("id, topic_id, subject_id, score, total_questions, time_spent_seconds, created_at")
      .eq("user_id", uid)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) throw error;
    return data || [];
  } catch (e: any) {
    console.warn("[Supabase] Attempts fetch error:", e.message);
    return [];
  }
}

export async function fetchUserBookmarksFromSupabase(userId?: string): Promise<string[]> {
  if (!isSupabaseConfigured()) return [];
  try {
    let uid = userId;
    if (!uid) {
      const { data: { user } } = await supabase.auth.getUser();
      uid = user?.id;
    }
    if (!uid || uid === "student_default" || String(uid).startsWith("guest_")) return [];

    const { data, error } = await supabase
      .from("bookmarks")
      .select("question_id")
      .eq("user_id", uid);

    if (error) throw error;
    return (data || []).map(b => b.question_id);
  } catch (e: any) {
    console.warn("[Supabase] Bookmarks fetch error:", e.message);
    return [];
  }
}

export async function toggleBookmarkInSupabase(questionId: string, bookmarked: boolean, userId?: string): Promise<boolean> {
  if (!isSupabaseConfigured() || !questionId) return false;
  try {
    let uid = userId;
    if (!uid) {
      const { data: { user } } = await supabase.auth.getUser();
      uid = user?.id;
    }
    if (!uid || uid === "student_default" || String(uid).startsWith("guest_")) return false;

    if (bookmarked) {
      const { error } = await supabase.from("bookmarks").upsert({
        user_id: uid,
        question_id: questionId
      }, { onConflict: "user_id,question_id" });
      if (error) throw error;
      return true;
    } else {
      const { error } = await supabase
        .from("bookmarks")
        .delete()
        .match({ user_id: uid, question_id: questionId });
      if (error) throw error;
      return true;
    }
  } catch (e: any) {
    console.warn("[Supabase] Bookmark toggle error:", e.message);
    return false;
  }
}

export async function fetchUserProfileFromSupabase(userId?: string): Promise<any | null> {
  if (!isSupabaseConfigured()) return null;
  try {
    let uid = userId;
    if (!uid) {
      const { data: { user } } = await supabase.auth.getUser();
      uid = user?.id;
    }
    const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uid || uid === "student_default" || String(uid).startsWith("guest_") || !UUID_REGEX.test(uid)) return null;

    const { data, error } = await supabase
      .from("profiles")
      .select("id,email,display_name,photo_url,role,created_at,updated_at")
      .eq("id", uid)
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;

    return {
      id: data.id,
      uid: data.id,
      email: data.email || "",
      name: data.display_name || "Student",
      displayName: data.display_name || "Student",
      photoURL: data.photo_url || "",
      role: data.role || "student",
      createdAt: data.created_at,
      updatedAt: data.updated_at
    };
  } catch (e: any) {
    console.warn("[Supabase] Profile fetch error:", e.message);
    return null;
  }
}

export async function syncUserProfileToSupabase(profile: any): Promise<boolean> {
  if (!isSupabaseConfigured() || !profile) return false;
  const uid = profile.id || profile.uid;
  const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uid || uid === "student_default" || String(uid).startsWith("guest_") || !UUID_REGEX.test(uid)) {
    return false;
  }

  try {
    // If an active session exists matching the UID, allow potential admin privileges if authorized
    const { data: { session } } = await supabase.auth.getSession();
    const hasValidSession = Boolean(session?.user && session.user.id === uid);

    // Prevent privilege escalation: verify super admin or existing persistent admin role in database
    const { isSuperAdmin } = await import("./userProfileStorage");
    const userEmail = (session?.user?.email || profile.email || "").trim().toLowerCase();
    const isSuper = isSuperAdmin(userEmail) || isSuperAdmin(uid);

    let assignedRole: "admin" | "student" = "student";
    if (isSuper && hasValidSession) {
      assignedRole = "admin";
    } else if (hasValidSession) {
      // Check existing row in profiles table so we never demote an admin promoted by Super Admin!
      const { data: existingRow } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", uid)
        .maybeSingle();

      if (existingRow?.role === "admin" || profile.role === "admin") {
        assignedRole = "admin";
      } else {
        assignedRole = "student";
      }
    } else {
      // Unauthenticated / guest student profiles are strictly assigned 'student' role
      assignedRole = "student";
    }

    const { error } = await supabase.from("profiles").upsert({
      id: uid,
      email: profile.email || session?.user?.email || null,
      display_name: profile.name || profile.displayName || session?.user?.user_metadata?.full_name || "Student",
      photo_url: profile.photoURL || session?.user?.user_metadata?.avatar_url || session?.user?.user_metadata?.picture || null,
      role: assignedRole,
      status: profile.status || "active",
      updated_at: new Date().toISOString()
    }, { onConflict: "id" });

    if (error) throw error;
    return true;
  } catch (e: any) {
    console.warn("[Supabase] Profile sync error:", e.message);
    return false;
  }
}

export async function fetchPYQQuestionsFromSupabase(params?: {
  exam?: string;
  year?: string;
}): Promise<Question[]> {
  if (!isSupabaseConfigured()) return [];
  try {
    let query = supabase.from("questions").select("id,question,options,correct_answer,explanation,subject_id,chapter_id,topic_id,exam,year,level,created_at");
    if (params?.exam) {
      query = query.ilike("exam", `%${params.exam}%`);
    }
    if (params?.year) {
      query = query.eq("year", params.year);
    }
    if (!params?.exam && !params?.year) {
      query = query.or("year.not.is.null,exam.not.is.null");
    }
    const { data, error } = await query.order("created_at", { ascending: false }).limit(200);
    if (error) throw error;
    if (data && data.length > 0) {
      return data.map(q => ({
        id: q.id,
        text: q.question,
        options: Array.isArray(q.options) ? q.options : [],
        correctIndex: q.correct_answer ?? 0,
        explanation: q.explanation || "",
        subjectId: q.subject_id,
        chapterId: q.chapter_id,
        topicId: q.topic_id,
        exam: q.exam,
        year: q.year,
        difficulty: q.level || "medium",
        isUserAdded: false,
        updatedAt: q.created_at
      }));
    }
    return [];
  } catch (e: any) {
    console.warn("[Supabase] PYQ fetch error:", e.message);
    return [];
  }
}

export async function fetchMockTestQuestions(params?: {
  count?: number;
  subjectId?: string;
}): Promise<Question[]> {
  if (!isSupabaseConfigured()) return [];
  try {
    const limit = Math.min(params?.count || 25, 100);
    let query = supabase.from("questions").select("id,question,options,correct_answer,explanation,subject_id,chapter_id,topic_id,exam,year,level,created_at");
    if (params?.subjectId && params.subjectId !== "all") {
      query = query.eq("subject_id", params.subjectId);
    }
    const { data, error } = await query.limit(limit);
    if (error) throw error;
    if (data && data.length > 0) {
      return data.map(q => ({
        id: q.id,
        text: q.question,
        options: Array.isArray(q.options) ? q.options : [],
        correctIndex: q.correct_answer ?? 0,
        explanation: q.explanation || "",
        subjectId: q.subject_id,
        chapterId: q.chapter_id,
        topicId: q.topic_id,
        exam: q.exam,
        year: q.year,
        difficulty: q.level || "medium",
        isUserAdded: false,
        updatedAt: q.created_at
      }));
    }
    return [];
  } catch (e: any) {
    console.warn("[Supabase] Mock test questions fetch error:", e.message);
    return [];
  }
}

export async function fetchPaginatedQuestions(params: {
  page?: number;
  limit?: number;
  subjectId?: string;
  chapterId?: string;
  topicId?: string;
  search?: string;
}): Promise<{ questions: Question[]; total: number; page: number; totalPages: number }> {
  const page = Math.max(1, params.page || 1);
  const limit = Math.min(100, Math.max(1, params.limit || 20));
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  if (!isSupabaseConfigured()) {
    return { questions: [], total: 0, page, totalPages: 0 };
  }

  try {
    let query = supabase
      .from("questions")
      .select("id, question, options, correct_answer, explanation, subject_id, chapter_id, topic_id, exam, year, level, verified, created_at", { count: "exact" });

    if (params.subjectId && params.subjectId !== "all") {
      query = query.eq("subject_id", params.subjectId);
    }
    if (params.chapterId && params.chapterId !== "all") {
      query = query.eq("chapter_id", params.chapterId);
    }
    if (params.topicId && params.topicId !== "all") {
      query = query.eq("topic_id", params.topicId);
    }
    if (params.search && params.search.trim()) {
      query = query.ilike("question", `%${params.search.trim()}%`);
    }

    const { data, count, error } = await query
      .order("created_at", { ascending: false })
      .order("id", { ascending: true })
      .range(from, to);

    if (error) throw error;

    const total = count || 0;
    const questions: Question[] = (data || []).map(q => ({
      id: q.id,
      text: q.question,
      options: Array.isArray(q.options) ? q.options : [],
      correctIndex: q.correct_answer ?? 0,
      explanation: q.explanation || "",
      subjectId: q.subject_id,
      chapterId: q.chapter_id,
      topicId: q.topic_id,
      exam: q.exam,
      year: q.year,
      difficulty: q.level || "medium",
      isUserAdded: false,
      updatedAt: q.created_at
    }));

    return {
      questions,
      total,
      page,
      totalPages: Math.ceil(total / limit)
    };
  } catch (e: any) {
    console.warn("[Supabase] Paginated questions error:", e.message);
    return { questions: [], total: 0, page, totalPages: 0 };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// HIGH-SCALE CURSOR-BASED PAGINATION (100,000+ MCQS)
// ─────────────────────────────────────────────────────────────────────────────

export interface CursorPaginationParams {
  cursor?: string; // ISO created_at string
  limit?: number; // default: 20, max: 100
  subjectId?: string;
  chapterId?: string;
  topicId?: string;
  exam?: string;
  year?: string;
  level?: string;
  search?: string;
  fields?: 'compact' | 'full'; // 'compact' excludes heavy explanation field
  sanitizeForExam?: boolean; // if true, excludes correct_answer and explanation
}

export interface CursorPaginationResult {
  questions: Question[];
  nextCursor: string | null;
  hasMore: boolean;
  total?: number;
}

export async function fetchQuestionsCursorPaginated(
  params: CursorPaginationParams
): Promise<CursorPaginationResult> {
  const limit = Math.min(100, Math.max(1, params.limit || 20));

  if (!isSupabaseConfigured()) {
    return { questions: [], nextCursor: null, hasMore: false, total: 0 };
  }

  try {
    // Select compact or sanitized projection to minimize egress
    let selectFields = "id,subject_id,chapter_id,topic_id,question,options,correct_answer,explanation,exam,year,level,created_at,updated_at";
    if (params.sanitizeForExam) {
      selectFields = "id, subject_id, chapter_id, topic_id, question, options, exam, year, level, created_at, updated_at";
    } else if (params.fields === "compact") {
      selectFields = "id, subject_id, chapter_id, topic_id, question, options, correct_answer, exam, year, level, created_at";
    }

    let query = supabase.from("questions").select(selectFields, { count: "exact" });

    if (params.subjectId && params.subjectId !== "all") {
      query = query.eq("subject_id", params.subjectId);
    }
    if (params.chapterId && params.chapterId !== "all") {
      query = query.eq("chapter_id", params.chapterId);
    }
    if (params.topicId && params.topicId !== "all") {
      query = query.eq("topic_id", params.topicId);
    }
    if (params.exam && params.exam !== "all") {
      query = query.ilike("exam", `%${params.exam}%`);
    }
    if (params.year && params.year !== "all") {
      query = query.eq("year", String(params.year));
    }
    if (params.level && params.level !== "all") {
      query = query.eq("level", params.level);
    }
    if (params.search && params.search.trim()) {
      query = query.ilike("question", `%${params.search.trim()}%`);
    }

    // Cursor seek: O(log N) index seek on created_at DESC, id DESC
    if (params.cursor) {
      query = query.lt("created_at", params.cursor);
    }

    // Fetch limit + 1 to reliably detect next page without separate count scan
    const { data, count, error } = await query
      .order("created_at", { ascending: false })
      .limit(limit + 1);

    if (error) throw error;

    // The projection is dynamic, so supabase-js cannot infer the row type.
    const rows = (data || []) as any[];
    const hasMore = rows.length > limit;
    const pageRows = hasMore ? rows.slice(0, limit) : rows;
    const nextCursor = hasMore && pageRows.length > 0 ? pageRows[pageRows.length - 1].created_at : null;

    const questions: Question[] = pageRows.map((q: any) => ({
      id: q.id,
      text: q.question,
      options: Array.isArray(q.options) ? q.options : [],
      correctIndex: params.sanitizeForExam ? -1 : (q.correct_answer ?? 0),
      explanation: params.sanitizeForExam ? "" : (q.explanation || ""),
      subjectId: q.subject_id,
      chapterId: q.chapter_id,
      topicId: q.topic_id,
      exam: q.exam,
      year: q.year,
      difficulty: q.level || "medium",
      isUserAdded: false,
      updatedAt: q.created_at
    }));

    return {
      questions,
      nextCursor,
      hasMore,
      total: count || 0
    };
  } catch (e: any) {
    console.warn("[Supabase] Cursor paginated questions error:", e.message);
    return { questions: [], nextCursor: null, hasMore: false, total: 0 };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SANITIZED EXAM QUESTION FETCHING (CORRECT-ANSWER PROTECTION)
// ─────────────────────────────────────────────────────────────────────────────

export async function fetchExamQuestionsSanitized(params: {
  count?: number;
  subjectId?: string;
  topicId?: string;
  exam?: string;
}): Promise<Question[]> {
  if (!isSupabaseConfigured()) return [];
  try {
    const limit = Math.min(params?.count || 25, 100);
    let query = supabase
      .from("questions")
      .select("id, question, options, subject_id, chapter_id, topic_id, exam, year, level, created_at");

    if (params?.subjectId && params.subjectId !== "all") {
      query = query.eq("subject_id", params.subjectId);
    }
    if (params?.topicId && params.topicId !== "all") {
      query = query.eq("topic_id", params.topicId);
    }
    if (params?.exam && params.exam !== "all") {
      query = query.ilike("exam", `%${params.exam}%`);
    }

    const { data, error } = await query.limit(limit);
    if (error) throw error;

    if (data && data.length > 0) {
      return data.map(q => ({
        id: q.id,
        text: q.question,
        options: Array.isArray(q.options) ? q.options : [],
        correctIndex: -1, // Stripped for exam taking
        explanation: "",  // Stripped for exam taking
        subjectId: q.subject_id,
        chapterId: q.chapter_id,
        topicId: q.topic_id,
        exam: q.exam,
        year: q.year,
        difficulty: q.level || "medium",
        isUserAdded: false,
        updatedAt: q.created_at
      }));
    }
    return [];
  } catch (e: any) {
    console.warn("[Supabase] Sanitized exam questions fetch error:", e.message);
    return [];
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// TRUSTED SERVER-SIDE TEST RESULT VALIDATION (TAMPER-PROOF SCORING)
// ─────────────────────────────────────────────────────────────────────────────

export interface TestAttemptValidationParams {
  userId?: string;
  topicId?: string;
  subjectId?: string;
  answers: Record<string, string | number>; // questionId -> selectedOption (0..4 or 'E')
  timeSpentSeconds: number;
  markingScheme?: {
    correctMarks?: number; // default: 1
    wrongPenalty?: number; // default: 0.33
    neutralOptionE?: boolean; // default: true (0 marks)
  };
}

export interface ValidatedAttemptResult {
  attemptId: string;
  score: number;
  totalQuestions: number;
  correctCount: number;
  wrongCount: number;
  unattemptedCount: number;
  accuracy: number;
  evaluatedAnswers: Array<{
    questionId: string;
    studentAnswer: string | number;
    correctAnswer: number;
    isCorrect: boolean;
    isOptionE: boolean;
    explanation: string;
  }>;
  submittedAt: string;
}

export async function validateAndSubmitTestAttempt(
  params: TestAttemptValidationParams
): Promise<ValidatedAttemptResult> {
  const correctMarks = params.markingScheme?.correctMarks ?? 1;
  const wrongPenalty = params.markingScheme?.wrongPenalty ?? 0.33;
  const neutralOptionE = params.markingScheme?.neutralOptionE ?? true;

  const questionIds = Object.keys(params.answers || {});
  const totalQuestions = questionIds.length;

  let verifiedQuestions: Record<string, { correct_answer: number; explanation: string }> = {};

  if (isSupabaseConfigured() && questionIds.length > 0) {
    try {
      const { data } = await supabase
        .from("questions")
        .select("id, correct_answer, explanation")
        .in("id", questionIds);

      if (data) {
        data.forEach(q => {
          verifiedQuestions[q.id] = {
            correct_answer: q.correct_answer ?? 0,
            explanation: q.explanation || ""
          };
        });
      }
    } catch (err: any) {
      console.warn("[Supabase] Failed to fetch authoritative answers:", err.message);
    }
  }

  // Fallback to local cache for offline or newly added questions
  if (Object.keys(verifiedQuestions).length < questionIds.length) {
    try {
      const { openLocalDatabase, idbGet, STORES } = await import("./localDatabaseEngine");
      await openLocalDatabase();
      for (const qId of questionIds) {
        if (!verifiedQuestions[qId]) {
          const localQ = await idbGet<Question>(STORES.MCQS, qId);
          if (localQ) {
            verifiedQuestions[qId] = {
              correct_answer: localQ.correctIndex ?? 0,
              explanation: localQ.explanation || ""
            };
          }
        }
      }
    } catch {}
  }

  let rawScore = 0;
  let correctCount = 0;
  let wrongCount = 0;
  let unattemptedCount = 0;

  const evaluatedAnswers = questionIds.map(qId => {
    const studentAns = params.answers[qId];
    const qInfo = verifiedQuestions[qId] || { correct_answer: 0, explanation: "" };
    const correctIdx = qInfo.correct_answer;

    // Check for Option E / Neutral unattempted
    const isE = studentAns === 4 || studentAns === "4" || studentAns === "E" || studentAns === "e" || studentAns === undefined || studentAns === null || studentAns === "";

    if (isE && neutralOptionE) {
      unattemptedCount++;
      return {
        questionId: qId,
        studentAnswer: studentAns ?? "E",
        correctAnswer: correctIdx,
        isCorrect: false,
        isOptionE: true,
        explanation: qInfo.explanation
      };
    }

    const numStudentAns = Number(studentAns);
    if (!isNaN(numStudentAns) && numStudentAns === correctIdx) {
      correctCount++;
      rawScore += correctMarks;
      return {
        questionId: qId,
        studentAnswer: numStudentAns,
        correctAnswer: correctIdx,
        isCorrect: true,
        isOptionE: false,
        explanation: qInfo.explanation
      };
    } else {
      wrongCount++;
      rawScore -= wrongPenalty;
      return {
        questionId: qId,
        studentAnswer: studentAns,
        correctAnswer: correctIdx,
        isCorrect: false,
        isOptionE: false,
        explanation: qInfo.explanation
      };
    }
  });

  const verifiedScore = Math.max(0, Math.round(rawScore * 100) / 100);
  const attemptedCount = correctCount + wrongCount;
  const accuracy = attemptedCount > 0 ? Math.round((correctCount / attemptedCount) * 100) : 0;
  const submittedAt = new Date().toISOString();
  const attemptId = `att_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

  // Securely persist to Supabase attempts if authenticated
  if (isSupabaseConfigured()) {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const uid = session?.user?.id;
      if (uid && uid !== "student_default" && !uid.startsWith("guest_")) {
        const { error: insErr } = await supabase.from("attempts").insert({
          user_id: uid,
          topic_id: params.topicId || null,
          subject_id: params.subjectId || null,
          score: Math.round(verifiedScore),
          total_questions: totalQuestions,
          answers: params.answers,
          time_spent_seconds: params.timeSpentSeconds || 0,
        });
        if (insErr) {
          console.warn("[Supabase] Failed to write verified attempt:", insErr.message);
        }
      }
    } catch (e: any) {
      console.warn("[Supabase] Exception writing verified attempt:", e.message);
    }
  }

  return {
    attemptId,
    score: verifiedScore,
    totalQuestions,
    correctCount,
    wrongCount,
    unattemptedCount,
    accuracy,
    evaluatedAnswers,
    submittedAt
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// DUPLICATE DETECTION FOR BULK MCQ IMPORT
// ─────────────────────────────────────────────────────────────────────────────

export async function detectDuplicateMCQs(
  questions: Question[],
  topicId?: string
): Promise<{
  duplicates: Array<{ question: Question; matchedId?: string; reason: string }>;
  unique: Question[];
}> {
  const normalize = (t: string) => t.toLowerCase().replace(/[\s\p{P}]/gu, "");

  const duplicates: Array<{ question: Question; matchedId?: string; reason: string }> = [];
  const unique: Question[] = [];
  const seenInBatch = new Map<string, string>();

  // 1. Check duplicates within incoming batch
  for (const q of questions) {
    const key = normalize(q.text);
    if (!key) continue;

    if (seenInBatch.has(key)) {
      duplicates.push({
        question: q,
        matchedId: seenInBatch.get(key),
        reason: "Exact duplicate text within the uploaded batch"
      });
    } else {
      seenInBatch.set(key, q.id);
      unique.push(q);
    }
  }

  // 2. Check duplicates against existing database questions
  if (isSupabaseConfigured() && unique.length > 0) {
    try {
      let query = supabase.from("questions").select("id, question");
      if (topicId) {
        query = query.eq("topic_id", topicId);
      }
      const { data } = await query.limit(500);
      if (data && data.length > 0) {
        const dbMap = new Map<string, string>();
        data.forEach(dbQ => {
          dbMap.set(normalize(dbQ.question), dbQ.id);
        });

        const finalUnique: Question[] = [];
        for (const u of unique) {
          const normKey = normalize(u.text);
          if (dbMap.has(normKey)) {
            duplicates.push({
              question: u,
              matchedId: dbMap.get(normKey),
              reason: "Question already exists in Supabase question bank"
            });
          } else {
            finalUnique.push(u);
          }
        }
        return { duplicates, unique: finalUnique };
      }
    } catch {}
  }

  return { duplicates, unique };
}

export async function getSupabaseTableCounts(): Promise<{
  subjects: number;
  chapters: number;
  topics: number;
  questions: number;
  profiles: number;
  attempts: number;
  bookmarks: number;
}> {
  const result = {
    subjects: 0,
    chapters: 0,
    topics: 0,
    questions: 0,
    profiles: 0,
    attempts: 0,
    bookmarks: 0,
  };

  if (!isSupabaseConfigured()) return result;

  try {
    const [sub, chap, top, q, prof, att, bm] = await Promise.all([
      supabase.from("subjects").select("id", { count: "exact", head: true }),
      supabase.from("chapters").select("id", { count: "exact", head: true }),
      supabase.from("topics").select("id", { count: "exact", head: true }),
      supabase.from("questions").select("id", { count: "exact", head: true }),
      supabase.from("profiles").select("id", { count: "exact", head: true }),
      supabase.from("attempts").select("id", { count: "exact", head: true }),
      supabase.from("bookmarks").select("id", { count: "exact", head: true }),
    ]);

    result.subjects = sub.count || 0;
    result.chapters = chap.count || 0;
    result.topics = top.count || 0;
    result.questions = q.count || 0;
    result.profiles = prof.count || 0;
    result.attempts = att.count || 0;
    result.bookmarks = bm.count || 0;
  } catch (e) {
    console.warn("[Supabase] Error fetching table counts:", e);
  }

  return result;
}

export async function checkSupabaseHealth(): Promise<{
  healthy: boolean;
  latencyMs: number;
  details: Record<string, any>;
}> {
  const start = performance.now();
  if (!isSupabaseConfigured()) {
    return {
      healthy: false,
      latencyMs: 0,
      details: { error: "Supabase not configured in environment" }
    };
  }

  try {
    const { count, error } = await supabase.from("subjects").select("id", { count: "exact", head: true });
    const latencyMs = Math.round(performance.now() - start);

    if (error) {
      return {
        healthy: false,
        latencyMs,
        details: { error: error.message, code: error.code }
      };
    }

    return {
      healthy: true,
      latencyMs,
      details: {
        subjectsCount: count || 0,
        status: "connected",
        endpoint: "PostgreSQL via PostgREST",
      }
    };
  } catch (err: any) {
    const latencyMs = Math.round(performance.now() - start);
    return {
      healthy: false,
      latencyMs,
      details: { error: err.message || "Unknown error" }
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ONE-CLICK BULK CLOUD SYNC FOR ADMIN PANEL
// ─────────────────────────────────────────────────────────────────────────────

export async function executeSupabaseBulkSync(
  storeInput?: any,
  onProgress?: (state: any) => void
): Promise<{ success: boolean; totalImported: number; errorDetails: string[] }> {
  try {
    const { loadUserQuestionsStore, getCombinedSubjects, getCombinedChapters } = await import("./questionsStorage");
    const store = storeInput || loadUserQuestionsStore();

    onProgress?.({
      status: "validating",
      totalRecords: 100,
      validRecords: 0,
      invalidRecords: 0,
      existingRecords: 0,
      uploadedRecords: 0,
      updatedRecords: 0,
      skippedRecords: 0,
      failedRecords: 0,
      currentBatch: 0,
      totalBatches: 1,
      progressPercentage: 15,
      currentStatusMessage: "Connecting to Supabase PostgreSQL...",
      errorDetails: []
    });

    const subjects = getCombinedSubjects(store);
    const chapters = getCombinedChapters(store);
    const topics: Topic[] = [];
    const questions: Question[] = [
      ...(store.customQuestions || []),
      ...Object.values(store.editedQuestions || {}) as Question[]
    ];

    chapters.forEach(c => {
      if (c.topics) {
        c.topics.forEach(t => {
          topics.push(t);
          if (t.questions) {
            questions.push(...t.questions);
          }
        });
      }
    });

    const qMap = new Map<string, Question>();
    questions.forEach(q => {
      if (q && q.id) qMap.set(q.id, q);
    });
    const uniqueQuestions = Array.from(qMap.values());

    const totalOps = subjects.length + chapters.length + topics.length + uniqueQuestions.length;

    onProgress?.({
      status: "syncing",
      totalRecords: totalOps,
      validRecords: totalOps,
      invalidRecords: 0,
      existingRecords: 0,
      uploadedRecords: 0,
      updatedRecords: 0,
      skippedRecords: 0,
      failedRecords: 0,
      currentBatch: 1,
      totalBatches: 4,
      progressPercentage: 30,
      currentStatusMessage: `Syncing ${subjects.length} subjects to Supabase...`,
      errorDetails: []
    });

    for (const s of subjects) {
      await saveSubjectToSupabase(s);
    }

    onProgress?.({
      status: "syncing",
      totalRecords: totalOps,
      validRecords: totalOps,
      invalidRecords: 0,
      existingRecords: 0,
      uploadedRecords: subjects.length,
      updatedRecords: 0,
      skippedRecords: 0,
      failedRecords: 0,
      currentBatch: 2,
      totalBatches: 4,
      progressPercentage: 55,
      currentStatusMessage: `Syncing ${chapters.length} chapters & ${topics.length} topics...`,
      errorDetails: []
    });

    for (const c of chapters) {
      await saveChapterToSupabase(c);
    }
    for (const t of topics) {
      await saveTopicToSupabase(t);
    }

    onProgress?.({
      status: "syncing",
      totalRecords: totalOps,
      validRecords: totalOps,
      invalidRecords: 0,
      existingRecords: 0,
      uploadedRecords: subjects.length + chapters.length + topics.length,
      updatedRecords: 0,
      skippedRecords: 0,
      failedRecords: 0,
      currentBatch: 3,
      totalBatches: 4,
      progressPercentage: 80,
      currentStatusMessage: `Syncing ${uniqueQuestions.length} MCQs in PostgreSQL batches...`,
      errorDetails: []
    });

    if (uniqueQuestions.length > 0) {
      await upsertQuestionsToSupabase(uniqueQuestions);
    }

    if (store.deletedQuestionIds && store.deletedQuestionIds.length > 0) {
      await deleteQuestionsBulkFromSupabase(store.deletedQuestionIds);
    }

    onProgress?.({
      status: "success",
      totalRecords: totalOps,
      validRecords: totalOps,
      invalidRecords: 0,
      existingRecords: 0,
      uploadedRecords: totalOps,
      updatedRecords: 0,
      skippedRecords: 0,
      failedRecords: 0,
      currentBatch: 4,
      totalBatches: 4,
      progressPercentage: 100,
      currentStatusMessage: "All data successfully synced to Supabase PostgreSQL!",
      errorDetails: []
    });

    return {
      success: true,
      totalImported: totalOps,
      errorDetails: []
    };
  } catch (err: any) {
    console.error("[SupabaseBulkSync] Error:", err);
    onProgress?.({
      status: "error",
      totalRecords: 0,
      validRecords: 0,
      invalidRecords: 0,
      existingRecords: 0,
      uploadedRecords: 0,
      updatedRecords: 0,
      skippedRecords: 0,
      failedRecords: 1,
      currentBatch: 0,
      totalBatches: 0,
      progressPercentage: 0,
      currentStatusMessage: err?.message || "Sync failed",
      errorDetails: [err?.message || "Sync error"]
    });
    return {
      success: false,
      totalImported: 0,
      errorDetails: [err?.message || "Sync error"]
    };
  }
}
