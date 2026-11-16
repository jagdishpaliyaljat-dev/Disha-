import { supabase, isSupabaseConfigured } from "../lib/supabase";
import { Subject, Chapter, Topic, Question } from "../types";
import { 
  openLocalDatabase, 
  idbGetAll, 
  idbPut, 
  idbDelete,
  STORES 
} from "./localDatabaseEngine";

/**
 * DISHA 20-20 — Supabase Sync & Curriculum Service
 * High-performance, quota-free PostgreSQL backend service with Local-First IndexedDB caching.
 * Starts 100% clean with 0 records. Only data uploaded via Admin Panel is stored.
 */

// ─────────────────────────────────────────────────────────────────────────────
// CURRICULUM SYNC (READ)
// ─────────────────────────────────────────────────────────────────────────────

export async function fetchSubjects(): Promise<Subject[]> {
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
// ADMIN OPERATIONS (WRITE / MUTATIONS)
// ─────────────────────────────────────────────────────────────────────────────

export async function saveSubjectToSupabase(subject: Subject): Promise<{ success: boolean; message: string }> {
  try {
    await openLocalDatabase();
    await idbPut(STORES.SUBJECTS, subject);

    if (!isSupabaseConfigured()) {
      return { success: true, message: `Subject '${subject.name || subject.hindiName}' saved locally!` };
    }

    const { error } = await supabase.from("subjects").upsert({
      id: subject.id,
      name: subject.name,
      hindi_name: subject.hindiName || subject.name,
      description: subject.description || "",
      icon: subject.icon || "book",
      color: subject.color || "#8B1E3F",
      order_index: subject.order || 0,
      updated_at: new Date().toISOString()
    }, { onConflict: "id" });

    if (error) throw error;
    return { success: true, message: `Subject '${subject.name || subject.hindiName}' saved to Supabase!` };
  } catch (err: any) {
    console.error("[Supabase] Failed to save subject:", err);
    return { success: false, message: err.message || "Failed to save subject to Supabase" };
  }
}

export async function deleteSubjectFromSupabase(subjectId: string): Promise<{ success: boolean; message: string }> {
  try {
    await openLocalDatabase();
    await idbDelete(STORES.SUBJECTS, subjectId);

    if (!isSupabaseConfigured()) {
      return { success: true, message: "Deleted locally" };
    }

    const { error } = await supabase.from("subjects").delete().eq("id", subjectId);
    if (error) throw error;
    return { success: true, message: "Subject deleted from Supabase" };
  } catch (err: any) {
    console.error("[Supabase] Failed to delete subject:", err);
    return { success: false, message: err.message || "Failed to delete subject from Supabase" };
  }
}

export async function saveChapterToSupabase(chapter: Chapter): Promise<{ success: boolean; message: string }> {
  try {
    await openLocalDatabase();
    await idbPut(STORES.CHAPTERS, chapter);

    if (!isSupabaseConfigured()) {
      return { success: true, message: `Chapter '${chapter.title || chapter.hindiTitle}' saved locally!` };
    }

    const { error } = await supabase.from("chapters").upsert({
      id: chapter.id,
      subject_id: chapter.subjectId,
      name: chapter.title,
      hindi_name: chapter.hindiTitle || chapter.title,
      order_index: chapter.number || 0,
      updated_at: new Date().toISOString()
    }, { onConflict: "id" });

    if (error) throw error;
    return { success: true, message: `Chapter '${chapter.title || chapter.hindiTitle}' saved to Supabase!` };
  } catch (err: any) {
    console.error("[Supabase] Failed to save chapter:", err);
    return { success: false, message: err.message || "Failed to save chapter to Supabase" };
  }
}

export async function deleteChapterFromSupabase(chapterId: string): Promise<{ success: boolean; message: string }> {
  try {
    await openLocalDatabase();
    await idbDelete(STORES.CHAPTERS, chapterId);

    if (!isSupabaseConfigured()) {
      return { success: true, message: "Deleted locally" };
    }

    const { error } = await supabase.from("chapters").delete().eq("id", chapterId);
    if (error) throw error;
    return { success: true, message: "Chapter deleted from Supabase" };
  } catch (err: any) {
    console.error("[Supabase] Failed to delete chapter:", err);
    return { success: false, message: err.message || "Failed to delete chapter from Supabase" };
  }
}

export async function saveTopicToSupabase(topic: Topic): Promise<{ success: boolean; message: string }> {
  try {
    await openLocalDatabase();
    await idbPut(STORES.TOPICS, topic);

    if (!isSupabaseConfigured()) {
      return { success: true, message: `Topic '${topic.title || topic.hindiTitle}' saved locally!` };
    }

    const { error } = await supabase.from("topics").upsert({
      id: topic.id,
      chapter_id: topic.chapterId,
      subject_id: topic.subjectId,
      name: topic.title,
      hindi_name: topic.hindiTitle || topic.title,
      order_index: topic.number || 0,
      updated_at: new Date().toISOString()
    }, { onConflict: "id" });

    if (error) throw error;
    return { success: true, message: `Topic '${topic.title || topic.hindiTitle}' saved to Supabase!` };
  } catch (err: any) {
    console.error("[Supabase] Failed to save topic:", err);
    return { success: false, message: err.message || "Failed to save topic to Supabase" };
  }
}

export async function deleteTopicFromSupabase(topicId: string): Promise<{ success: boolean; message: string }> {
  try {
    await openLocalDatabase();
    await idbDelete(STORES.TOPICS, topicId);

    if (!isSupabaseConfigured()) {
      return { success: true, message: "Deleted locally" };
    }

    const { error } = await supabase.from("topics").delete().eq("id", topicId);
    if (error) throw error;
    return { success: true, message: "Topic deleted from Supabase" };
  } catch (err: any) {
    console.error("[Supabase] Failed to delete topic:", err);
    return { success: false, message: err.message || "Failed to delete topic from Supabase" };
  }
}

export async function upsertQuestionsToSupabase(questions: Question[]): Promise<{ success: boolean; count: number; message: string }> {
  if (!questions || questions.length === 0) {
    return { success: true, count: 0, message: "No questions to save" };
  }

  try {
    await openLocalDatabase();
    for (const q of questions) {
      await idbPut(STORES.MCQS, q);
    }

    if (!isSupabaseConfigured()) {
      return { success: true, count: questions.length, message: `${questions.length} question(s) saved locally!` };
    }

    const BATCH_SIZE = 100;
    let uploadedCount = 0;

    for (let i = 0; i < questions.length; i += BATCH_SIZE) {
      const chunk = questions.slice(i, i + BATCH_SIZE);
      const rows = chunk.map(q => ({
        id: q.id,
        subject_id: q.subjectId || null,
        chapter_id: q.chapterId || null,
        topic_id: q.topicId || null,
        question: q.text,
        options: Array.isArray(q.options) ? q.options : [],
        correct_answer: typeof q.correctIndex === "number" ? q.correctIndex : 0,
        explanation: q.explanation || "",
        exam: q.exam || "RPSC / RSMSSB",
        year: String(q.year || "2024"),
        level: q.difficulty || "medium",
        verified: true,
        updated_at: new Date().toISOString()
      }));

      const { error } = await supabase.from("questions").upsert(rows, { onConflict: "id" });
      if (error) throw error;
      uploadedCount += rows.length;
    }

    return { success: true, count: uploadedCount, message: `${uploadedCount} question(s) saved to Supabase!` };
  } catch (err: any) {
    console.error("[Supabase] Failed to upsert questions:", err);
    return { success: false, count: 0, message: err.message || "Failed to save questions to Supabase" };
  }
}

export async function deleteQuestionFromSupabase(questionId: string): Promise<{ success: boolean; message: string }> {
  try {
    await openLocalDatabase();
    await idbDelete(STORES.MCQS, questionId);

    if (!isSupabaseConfigured()) {
      return { success: true, message: "Deleted locally" };
    }

    const { error } = await supabase.from("questions").delete().eq("id", questionId);
    if (error) throw error;
    return { success: true, message: "Question deleted from Supabase" };
  } catch (err: any) {
    console.error("[Supabase] Failed to delete question:", err);
    return { success: false, message: err.message || "Failed to delete question from Supabase" };
  }
}

export async function deleteQuestionsBulkFromSupabase(questionIds: string[]): Promise<{ success: boolean; count: number }> {
  try {
    await openLocalDatabase();
    for (const id of questionIds) {
      await idbDelete(STORES.MCQS, id);
    }

    if (!isSupabaseConfigured()) {
      return { success: true, count: questionIds.length };
    }

    const { error } = await supabase.from("questions").delete().in("id", questionIds);
    if (error) throw error;
    return { success: true, count: questionIds.length };
  } catch (err: any) {
    console.error("[Supabase] Failed to bulk delete questions:", err);
    return { success: false, count: 0 };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ATTEMPTS, BOOKMARKS & USER PROGRESS SYNC
// ─────────────────────────────────────────────────────────────────────────────

export async function recordStudentAttempt(attempt: {
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
    let uid = attempt.userId;
    if (!uid) {
      const { data: { user } } = await supabase.auth.getUser();
      uid = user?.id;
    }
    if (!uid || uid === "student_default" || String(uid).startsWith("guest_")) return;

    await supabase.from("attempts").insert({
      user_id: uid,
      topic_id: attempt.topicId || null,
      subject_id: attempt.subjectId || null,
      score: attempt.score,
      total_questions: attempt.totalQuestions,
      answers: attempt.answers,
      time_spent_seconds: attempt.timeSpentSeconds
    });
  } catch (e: any) {
    console.warn("[Supabase] Attempt sync error:", e.message);
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

    const { data, error } = await supabase
      .from("attempts")
      .select("*")
      .eq("user_id", uid)
      .order("created_at", { ascending: false });

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
    if (!uid || uid === "student_default" || String(uid).startsWith("guest_")) return null;

    const { data, error } = await supabase
      .from("profiles")
      .select("*")
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
  if (!uid || uid === "student_default" || String(uid).startsWith("guest_")) return false;

  try {
    const { error } = await supabase.from("profiles").upsert({
      id: uid,
      email: profile.email || null,
      display_name: profile.name || profile.displayName || "Student",
      photo_url: profile.photoURL || null,
      role: profile.role || "student",
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
    let query = supabase.from("questions").select("*");
    if (params?.exam) {
      query = query.ilike("exam", `%${params.exam}%`);
    }
    if (params?.year) {
      query = query.eq("year", params.year);
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
    let query = supabase.from("questions").select("*");
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
      .select("*", { count: "exact" });

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
