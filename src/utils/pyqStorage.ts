import { PYQPaper, PYQPaperAttempt } from "../types";
import { safeSetLocalStorageItem } from "./safeStorage";
import { isTestOrMockPYQ } from "./cleanSlate";
import { supabase, isSupabaseConfigured } from "../lib/supabase";

const PYQ_PAPERS_STORAGE_KEY = "remix_rajprep_pyq_papers_v2";
const PYQ_ATTEMPTS_STORAGE_KEY = "remix_rajprep_pyq_attempts_v2";
const DELETED_PYQ_PAPERS_KEY = "remix_rajprep_deleted_pyq_papers_v1";

let inMemoryPYQPapers: PYQPaper[] | null = null;

export const INITIAL_PYQ_PAPERS: PYQPaper[] = [];

export function mapRowToPYQPaper(r: any): PYQPaper {
  return {
    id: r.id,
    title: r.title || "",
    hindiTitle: r.hindi_title || "",
    examBoard: r.exam_board || "RPSC",
    paperYear: r.paper_year || "",
    examDate: r.exam_date || undefined,
    category: r.category || "",
    description: r.description || "",
    hindiDescription: r.hindi_description || undefined,
    durationMinutes: Number(r.duration_minutes) || 180,
    totalMarks: Number(r.total_marks) || 200,
    marksPerQuestion: Number(r.marks_per_question) || 2,
    negativeMarking: Number(r.negative_marking) || 0.33,
    questionCount: Number(r.question_count) || (Array.isArray(r.questions) ? r.questions.length : 0),
    questions: Array.isArray(r.questions) ? r.questions : [],
    pdfUrl: r.pdf_url || undefined,
    officialKeyReleased: Boolean(r.official_key_released),
    isPublished: r.is_published !== false,
    attemptStats: r.attempt_stats || undefined,
    createdAt: r.created_at || new Date().toISOString(),
    updatedAt: r.updated_at || undefined,
  };
}

export function mapPYQPaperToRow(p: PYQPaper): any {
  return {
    id: p.id,
    title: p.title || "",
    hindi_title: p.hindiTitle || "",
    exam_board: p.examBoard || "RPSC",
    paper_year: p.paperYear || "",
    exam_date: p.examDate || null,
    category: p.category || "",
    description: p.description || "",
    hindi_description: p.hindiDescription || null,
    duration_minutes: p.durationMinutes || 180,
    total_marks: p.totalMarks || 200,
    marks_per_question: p.marksPerQuestion || 2,
    negative_marking: p.negativeMarking ?? 0.33,
    question_count: (p.questions || []).length,
    questions: p.questions || [],
    pdf_url: p.pdfUrl || null,
    official_key_released: Boolean(p.officialKeyReleased),
    is_published: p.isPublished !== false,
    attempt_stats: p.attemptStats || null,
    created_at: p.createdAt || new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

export function loadLocalPYQPapers(): PYQPaper[] {
  if (inMemoryPYQPapers && inMemoryPYQPapers.length > 0) {
    return inMemoryPYQPapers.filter((p) => !isTestOrMockPYQ(p));
  }
  try {
    const raw = typeof localStorage !== "undefined" ? localStorage.getItem(PYQ_PAPERS_STORAGE_KEY) : null;
    if (!raw) {
      inMemoryPYQPapers = INITIAL_PYQ_PAPERS;
      safeSetLocalStorageItem(PYQ_PAPERS_STORAGE_KEY, JSON.stringify(INITIAL_PYQ_PAPERS));
      return INITIAL_PYQ_PAPERS;
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      const cleanPapers = parsed.filter((p) => !isTestOrMockPYQ(p));
      inMemoryPYQPapers = cleanPapers;
      return cleanPapers;
    }
    inMemoryPYQPapers = INITIAL_PYQ_PAPERS;
    return INITIAL_PYQ_PAPERS;
  } catch (e) {
    console.warn("Notice loading local PYQ papers, using defaults:", e);
    return INITIAL_PYQ_PAPERS;
  }
}

export function saveLocalPYQPapers(papers: PYQPaper[]): void {
  inMemoryPYQPapers = papers;
  safeSetLocalStorageItem(
    PYQ_PAPERS_STORAGE_KEY,
    JSON.stringify(papers),
    () => {
      const lightweight = (papers || []).map((p) => ({
        ...p,
        questions: (p.questions || []).map((q) => ({
          id: q.id,
          text: q.text,
          options: q.options,
          correctIndex: q.correctIndex,
        })),
      }));
      return JSON.stringify(lightweight);
    }
  );
}

export function loadLocalPYQAttempts(): PYQPaperAttempt[] {
  try {
    const raw = typeof localStorage !== "undefined" ? localStorage.getItem(PYQ_ATTEMPTS_STORAGE_KEY) : null;
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.warn("Notice loading PYQ attempts:", e);
    return [];
  }
}

export function saveLocalPYQAttempts(attempts: PYQPaperAttempt[]): void {
  safeSetLocalStorageItem(PYQ_ATTEMPTS_STORAGE_KEY, JSON.stringify(attempts));
}

export async function recordPYQAttempt(attempt: PYQPaperAttempt): Promise<void> {
  try {
    const attempts = loadLocalPYQAttempts();
    const existingIdx = attempts.findIndex((a) => a.attemptId === attempt.attemptId);

    if (existingIdx >= 0) {
      attempts[existingIdx] = attempt;
    } else {
      attempts.unshift(attempt);
    }
    saveLocalPYQAttempts(attempts);
  } catch (e) {
    console.warn("Notice recording PYQ attempt:", e);
  }
}

export function getDeletedPYQIds(): string[] {
  try {
    const raw = typeof localStorage !== "undefined" ? localStorage.getItem(DELETED_PYQ_PAPERS_KEY) : null;
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function addDeletedPYQId(id: string): void {
  try {
    const ids = getDeletedPYQIds();
    if (!ids.includes(id)) {
      ids.push(id);
      safeSetLocalStorageItem(DELETED_PYQ_PAPERS_KEY, JSON.stringify(ids));
    }
  } catch {}
}

/** Clears the local tombstones after a full cloud sync/restore. */
export function clearDeletedPYQIds(): void {
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.removeItem(DELETED_PYQ_PAPERS_KEY);
    }
  } catch {}
}

export async function savePYQPaper(paper: Partial<PYQPaper> & { id: string }): Promise<PYQPaper[]> {
  const current = loadLocalPYQPapers();
  const idx = current.findIndex((p) => p.id === paper.id);

  const updatedPaper: PYQPaper = {
    ...current[idx],
    ...paper,
    updatedAt: new Date().toISOString(),
    createdAt: idx >= 0 && current[idx]?.createdAt ? current[idx].createdAt : (paper.createdAt || new Date().toISOString()),
  };

  let updatedList: PYQPaper[];
  if (idx >= 0) {
    updatedList = [...current];
    updatedList[idx] = updatedPaper;
  } else {
    updatedList = [updatedPaper, ...current];
  }

  saveLocalPYQPapers(updatedList);

  if (isSupabaseConfigured()) {
    try {
      const row = mapPYQPaperToRow(updatedPaper);
      const { error } = await supabase.from("pyq_papers").upsert(row);
      if (error) {
        console.warn("[PYQStorage] Cloud upsert warning:", error.message);
      }
    } catch (cloudErr) {
      console.warn("[PYQStorage] Cloud save exception:", cloudErr);
    }
  }

  return updatedList;
}

export async function deletePYQPaper(paperId: string): Promise<PYQPaper[]> {
  const current = loadLocalPYQPapers();
  const updatedList = current.filter((p) => p.id !== paperId);
  saveLocalPYQPapers(updatedList);
  addDeletedPYQId(paperId);

  if (isSupabaseConfigured()) {
    try {
      const { error } = await supabase.from("pyq_papers").delete().eq("id", paperId);
      if (error) {
        console.warn("[PYQStorage] Cloud delete warning:", error.message);
      }
    } catch (cloudErr) {
      console.warn("[PYQStorage] Cloud delete exception:", cloudErr);
    }
  }

  return updatedList;
}

export async function fetchPYQPapers(): Promise<PYQPaper[]> {
  const localList = loadLocalPYQPapers();
  const deletedIds = new Set(getDeletedPYQIds());

  if (isSupabaseConfigured()) {
    try {
      const { data, error } = await supabase
        .from("pyq_papers")
        .select("*")
        .order("paper_year", { ascending: false });

      if (!error && Array.isArray(data)) {
        const cloudPapers = data.map(mapRowToPYQPaper).filter((p) => !deletedIds.has(p.id));
        if (cloudPapers.length > 0 || data.length === 0) {
          saveLocalPYQPapers(cloudPapers);
          return cloudPapers;
        }
      }
    } catch (err) {
      console.warn("[PYQStorage] Error fetching PYQ papers from cloud:", err);
    }
  }

  return localList.filter((p) => !deletedIds.has(p.id));
}

export function subscribeToPublishedPYQPapers(
  callback: (papers: PYQPaper[]) => void
): () => void {
  const deletedIds = new Set(getDeletedPYQIds());
  const initial = loadLocalPYQPapers()
    .filter((p) => !deletedIds.has(p.id) && p.isPublished !== false)
    .sort((a, b) => (parseInt(b.paperYear || "0", 10) || 0) - (parseInt(a.paperYear || "0", 10) || 0));
  callback(initial);

  // Fetch fresh from cloud asynchronously
  fetchPYQPapers()
    .then((fresh) => {
      const published = fresh
        .filter((p) => p.isPublished !== false)
        .sort((a, b) => (parseInt(b.paperYear || "0", 10) || 0) - (parseInt(a.paperYear || "0", 10) || 0));
      callback(published);
    })
    .catch(() => {});

  let channel: any = null;
  if (isSupabaseConfigured()) {
    try {
      channel = supabase
        .channel("public:pyq_papers_changes")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "pyq_papers" },
          () => {
            fetchPYQPapers().then((fresh) => {
              const published = fresh
                .filter((p) => p.isPublished !== false)
                .sort((a, b) => (parseInt(b.paperYear || "0", 10) || 0) - (parseInt(a.paperYear || "0", 10) || 0));
              callback(published);
            }).catch(() => {});
          }
        )
        .subscribe();
    } catch (err) {
      console.warn("[PYQStorage] Realtime subscription error:", err);
    }
  }

  return () => {
    if (channel) {
      try {
        supabase.removeChannel(channel);
      } catch (_) {}
    }
  };
}

export async function fetchMCQsByPYQPaper(paperId: string): Promise<any[]> {
  const localPapers = loadLocalPYQPapers();
  const found = localPapers.find((p) => p.id === paperId);
  if (found && Array.isArray(found.questions) && found.questions.length > 0) {
    return found.questions;
  }

  if (isSupabaseConfigured()) {
    try {
      const { data, error } = await supabase
        .from("pyq_papers")
        .select("questions")
        .eq("id", paperId)
        .single();

      if (!error && data && Array.isArray(data.questions)) {
        return data.questions;
      }
    } catch (err) {
      console.warn("[PYQStorage] Error fetching MCQs for paper:", err);
    }
  }

  return [];
}
