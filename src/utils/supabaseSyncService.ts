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
