import { supabase, isSupabaseConfigured } from "../lib/supabase";
import { Subject, Chapter, Topic, Question } from "../types";
import { 
  openLocalDatabase, 
  idbGetAll, 
  idbPut, 
  STORES 
} from "./localDatabaseEngine";

/**
 * DISHA 20-20 — Supabase Sync & Curriculum Service
 * High-performance, quota-free PostgreSQL backend service with Local-First IndexedDB caching.
 */

// ─────────────────────────────────────────────────────────────────────────────
// CURRICULUM SYNC
// ─────────────────────────────────────────────────────────────────────────────

export async function fetchSubjects(): Promise<Subject[]> {
  // Check local database first for instant offline rendering
  await openLocalDatabase();
  const localSubjects = await idbGetAll<Subject>(STORES.SUBJECTS);
  if (localSubjects.length > 0) {
    if (isSupabaseConfigured()) {
      syncSubjectsInBackground().catch(() => {});
    }
    return localSubjects;
  }

  if (!isSupabaseConfigured()) {
    return localSubjects;
  }

  try {
    const { data, error } = await supabase
      .from("subjects")
      .select("*")
      .order("order_index", { ascending: true });

    if (error) throw error;
    if (data && data.length > 0) {
      const normalized: Subject[] = data.map(s => ({
        id: s.id,
        name: s.name,
        hindiName: s.hindi_name,
        description: s.description || "",
        icon: s.icon || "book",
        color: s.color || "#8B1E3F",
        order: s.order_index || 0,
      }));

      // Cache locally
      for (const s of normalized) {
        await idbPut(STORES.SUBJECTS, s);
      }
      return normalized;
    }
  } catch (err: any) {
    console.warn("[Supabase] Failed to fetch subjects:", err.message);
  }

  return localSubjects;
}

async function syncSubjectsInBackground() {
  try {
    const { data } = await supabase.from("subjects").select("*").order("order_index", { ascending: true });
    if (data) {
      for (const s of data) {
        await idbPut(STORES.SUBJECTS, {
          id: s.id,
          name: s.name,
          hindiName: s.hindi_name,
          description: s.description || "",
          icon: s.icon || "book",
          color: s.color || "#8B1E3F",
          order: s.order_index || 0,
        });
      }
    }
  } catch {}
}

export async function fetchChapters(subjectId?: string): Promise<Chapter[]> {
  await openLocalDatabase();
  const localChapters = await idbGetAll<Chapter>(STORES.CHAPTERS);
  const filtered = subjectId ? localChapters.filter(c => c.subjectId === subjectId) : localChapters;
  if (filtered.length > 0) return filtered;

  if (!isSupabaseConfigured()) return filtered;

  try {
    let query = supabase.from("chapters").select("*").order("order_index", { ascending: true });
    if (subjectId) {
      query = query.eq("subject_id", subjectId);
    }
    const { data, error } = await query;
    if (error) throw error;
    if (data) {
      const chapters: Chapter[] = data.map(c => ({
        id: c.id,
        subjectId: c.subject_id,
        title: c.name,
        hindiTitle: c.hindi_name || c.name,
        number: c.order_index || 0,
        topics: []
      }));
      for (const c of chapters) {
        await idbPut(STORES.CHAPTERS, c);
      }
      return chapters;
    }
  } catch (err: any) {
    console.warn("[Supabase] Failed to fetch chapters:", err.message);
  }

  return filtered;
}

export async function fetchTopics(chapterId?: string): Promise<Topic[]> {
  await openLocalDatabase();
  const localTopics = await idbGetAll<Topic>(STORES.TOPICS);
  const filtered = chapterId ? localTopics.filter(t => t.chapterId === chapterId) : localTopics;
  if (filtered.length > 0) return filtered;

  if (!isSupabaseConfigured()) return filtered;

  try {
    let query = supabase.from("topics").select("*").order("order_index", { ascending: true });
    if (chapterId) {
      query = query.eq("chapter_id", chapterId);
    }
    const { data, error } = await query;
    if (error) throw error;
    if (data) {
      const topics: Topic[] = data.map(t => ({
        id: t.id,
        chapterId: t.chapter_id,
        subjectId: t.subject_id,
        title: t.name,
        hindiTitle: t.hindi_name || t.name,
        number: t.order_index || 0,
        questions: []
      }));
      for (const t of topics) {
        await idbPut(STORES.TOPICS, t);
      }
      return topics;
    }
  } catch (err: any) {
    console.warn("[Supabase] Failed to fetch topics:", err.message);
  }

  return filtered;
}

// ─────────────────────────────────────────────────────────────────────────────
// QUESTION BANK (CANONICAL MCQS)
// ─────────────────────────────────────────────────────────────────────────────

export async function fetchQuestionsByTopic(topicId: string): Promise<Question[]> {
  const { getLocalMCQsByTopic } = await import("./localDatabaseEngine");
  const local = await getLocalMCQsByTopic(topicId);
  if (local.length > 0) return local;

  if (!isSupabaseConfigured()) return local;

  try {
    const { data, error } = await supabase
      .from("questions")
      .select("*")
      .eq("topic_id", topicId);

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

      // Cache into local database
      for (const q of normalized) {
        await idbPut(STORES.MCQS, q);
      }
      return normalized;
    }
  } catch (err: any) {
    console.warn("[Supabase] Failed to fetch questions:", err.message);
  }

  return local;
}

// ─────────────────────────────────────────────────────────────────────────────
// ATTEMPTS & PROGRESS SYNC
// ─────────────────────────────────────────────────────────────────────────────

export async function recordStudentAttempt(attempt: {
  topicId?: string;
  score: number;
  totalQuestions: number;
  answers: Record<string, any>;
  timeSpentSeconds: number;
}) {
  if (!isSupabaseConfigured()) return;
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return; // Guest mode

    await supabase.from("attempts").insert({
      user_id: user.id,
      topic_id: attempt.topicId,
      score: attempt.score,
      total_questions: attempt.totalQuestions,
      answers: attempt.answers,
      time_spent_seconds: attempt.timeSpentSeconds
    });
  } catch (e: any) {
    console.warn("[Supabase] Attempt sync error:", e.message);
  }
}
