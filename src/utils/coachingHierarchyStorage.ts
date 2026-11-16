import { Coaching, CoachingExam, CoachingTestSeries } from "../types";

const LOCAL_KEY_COACHING = "disha2020_coaching_list";
const LEGACY_LOCAL_KEY_COACHING = "quizpro_coaching_list";
const LOCAL_KEY_EXAMS = "disha2020_coaching_exams";
const LEGACY_LOCAL_KEY_EXAMS = "quizpro_coaching_exams";
const LOCAL_KEY_SERIES = "disha2020_coaching_series";
const LEGACY_LOCAL_KEY_SERIES = "quizpro_coaching_series";

const DEFAULT_COACHINGS: Coaching[] = [];
const DEFAULT_EXAMS: CoachingExam[] = [];
const DEFAULT_SERIES: CoachingTestSeries[] = [];

const DEMO_IDS = new Set([
  "coaching_utkarsh",
  "coaching_springboard",
  "coaching_subhash_charan",
  "exam_ras_pre",
  "exam_rsmssb_cet",
  "exam_ras_mains_gk",
  "exam_rajasthan_gk_special",
  "series_ras_pre_2026",
  "series_cet_level_1",
  "series_springboard_ras_mains",
  "series_subhash_gk_3000",
]);

function loadLocalData<T extends { id?: string }>(key: string, defaultData: T[]): T[] {
  if (typeof localStorage === "undefined") return defaultData;
  try {
    const legacyKey = key.replace("disha2020_", "quizpro_");
    const raw = localStorage.getItem(key) || localStorage.getItem(legacyKey);
    if (!raw) {
      return defaultData;
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return defaultData;
    
    const cleaned = parsed.filter((item) => !item.id || !DEMO_IDS.has(item.id));
    if (cleaned.length !== parsed.length) {
      localStorage.setItem(key, JSON.stringify(cleaned));
    }
    return cleaned;
  } catch {
    return defaultData;
  }
}

function saveLocalData<T>(key: string, data: T[]): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (e) {
    console.error(`Failed to save to local storage: ${key}`, e);
  }
}

export async function fetchCoachings(): Promise<Coaching[]> {
  return loadLocalData<Coaching>(LOCAL_KEY_COACHING, DEFAULT_COACHINGS);
}

export function subscribeToCoachings(callback: (coachings: Coaching[]) => void): () => void {
  const data = loadLocalData<Coaching>(LOCAL_KEY_COACHING, DEFAULT_COACHINGS);
  callback(data);
  return () => {};
}

export async function addCoaching(item: Omit<Coaching, "id" | "createdAt" | "updatedAt">): Promise<Coaching> {
  const current = loadLocalData<Coaching>(LOCAL_KEY_COACHING, DEFAULT_COACHINGS);
  const now = new Date().toISOString();
  const id = `coaching_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const newCoaching: Coaching = {
    ...item,
    id,
    createdAt: now,
    updatedAt: now,
  };

  current.push(newCoaching);
  saveLocalData(LOCAL_KEY_COACHING, current);
  return newCoaching;
}

export async function updateCoaching(id: string, updates: Partial<Coaching>): Promise<void> {
  const current = loadLocalData<Coaching>(LOCAL_KEY_COACHING, DEFAULT_COACHINGS);
  const index = current.findIndex((c) => c.id === id);
  if (index === -1) return;

  const now = new Date().toISOString();
  current[index] = { ...current[index], ...updates, updatedAt: now };
  saveLocalData(LOCAL_KEY_COACHING, current);
}

export async function deleteCoaching(id: string): Promise<{ success: boolean; message: string }> {
  const current = loadLocalData<Coaching>(LOCAL_KEY_COACHING, DEFAULT_COACHINGS);
  const updated = current.filter((c) => c.id !== id);
  saveLocalData(LOCAL_KEY_COACHING, updated);

  const exams = loadLocalData<CoachingExam>(LOCAL_KEY_EXAMS, DEFAULT_EXAMS);
  const filteredExams = exams.filter((e) => e.coachingId !== id);
  saveLocalData(LOCAL_KEY_EXAMS, filteredExams);

  const series = loadLocalData<CoachingTestSeries>(LOCAL_KEY_SERIES, DEFAULT_SERIES);
  const filteredSeries = series.filter((s) => s.coachingId !== id);
  saveLocalData(LOCAL_KEY_SERIES, filteredSeries);

  return { success: true, message: "Coaching deleted successfully" };
}

export async function fetchCoachingExams(coachingId?: string): Promise<CoachingExam[]> {
  const all = loadLocalData<CoachingExam>(LOCAL_KEY_EXAMS, DEFAULT_EXAMS);
  if (coachingId) {
    return all.filter((e) => e.coachingId === coachingId);
  }
  return all;
}

export function subscribeToCoachingExams(
  coachingId: string | undefined,
  callback: (exams: CoachingExam[]) => void
): () => void {
  const all = loadLocalData<CoachingExam>(LOCAL_KEY_EXAMS, DEFAULT_EXAMS);
  const filtered = coachingId ? all.filter((e) => e.coachingId === coachingId) : all;
  callback(filtered);
  return () => {};
}

export async function addCoachingExam(item: Omit<CoachingExam, "id" | "createdAt" | "updatedAt">): Promise<CoachingExam> {
  const current = loadLocalData<CoachingExam>(LOCAL_KEY_EXAMS, DEFAULT_EXAMS);
  const now = new Date().toISOString();
  const id = `exam_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const newExam: CoachingExam = {
    ...item,
    id,
    createdAt: now,
    updatedAt: now,
  };

  current.push(newExam);
  saveLocalData(LOCAL_KEY_EXAMS, current);
  return newExam;
}

export async function updateCoachingExam(id: string, updates: Partial<CoachingExam>): Promise<void> {
  const current = loadLocalData<CoachingExam>(LOCAL_KEY_EXAMS, DEFAULT_EXAMS);
  const index = current.findIndex((e) => e.id === id);
  if (index === -1) return;

  const now = new Date().toISOString();
  current[index] = { ...current[index], ...updates, updatedAt: now };
  saveLocalData(LOCAL_KEY_EXAMS, current);
}

export async function deleteCoachingExam(id: string): Promise<{ success: boolean; message: string }> {
  const current = loadLocalData<CoachingExam>(LOCAL_KEY_EXAMS, DEFAULT_EXAMS);
  const updated = current.filter((e) => e.id !== id);
  saveLocalData(LOCAL_KEY_EXAMS, updated);

  const series = loadLocalData<CoachingTestSeries>(LOCAL_KEY_SERIES, DEFAULT_SERIES);
  const filteredSeries = series.filter((s) => s.examId !== id);
  saveLocalData(LOCAL_KEY_SERIES, filteredSeries);

  return { success: true, message: "Exam category deleted successfully" };
}

export async function fetchCoachingTestSeries(
  coachingId?: string,
  examId?: string
): Promise<CoachingTestSeries[]> {
  let all = loadLocalData<CoachingTestSeries>(LOCAL_KEY_SERIES, DEFAULT_SERIES);
  if (coachingId) {
    all = all.filter((s) => s.coachingId === coachingId);
  }
  if (examId) {
    all = all.filter((s) => s.examId === examId);
  }
  return all;
}

export function subscribeToCoachingTestSeries(
  coachingId: string | undefined,
  examId: string | undefined,
  callback: (series: CoachingTestSeries[]) => void
): () => void {
  let all = loadLocalData<CoachingTestSeries>(LOCAL_KEY_SERIES, DEFAULT_SERIES);
  if (coachingId) all = all.filter((s) => s.coachingId === coachingId);
  if (examId) all = all.filter((s) => s.examId === examId);
  callback(all);
  return () => {};
}

export async function addCoachingTestSeries(
  item: Omit<CoachingTestSeries, "id" | "createdAt" | "updatedAt">
): Promise<CoachingTestSeries> {
  const current = loadLocalData<CoachingTestSeries>(LOCAL_KEY_SERIES, DEFAULT_SERIES);
  const now = new Date().toISOString();
  const id = `series_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const newSeries: CoachingTestSeries = {
    ...item,
    id,
    createdAt: now,
    updatedAt: now,
  };

  current.push(newSeries);
  saveLocalData(LOCAL_KEY_SERIES, current);
  return newSeries;
}

export async function updateCoachingTestSeries(
  id: string,
  updates: Partial<CoachingTestSeries>
): Promise<void> {
  const current = loadLocalData<CoachingTestSeries>(LOCAL_KEY_SERIES, DEFAULT_SERIES);
  const index = current.findIndex((s) => s.id === id);
  if (index === -1) return;

  const now = new Date().toISOString();
  current[index] = { ...current[index], ...updates, updatedAt: now };
  saveLocalData(LOCAL_KEY_SERIES, current);
}

export async function deleteCoachingTestSeries(id: string): Promise<{ success: boolean; message: string }> {
  const current = loadLocalData<CoachingTestSeries>(LOCAL_KEY_SERIES, DEFAULT_SERIES);
  const updated = current.filter((s) => s.id !== id);
  saveLocalData(LOCAL_KEY_SERIES, updated);
  return { success: true, message: "Test series deleted successfully" };
}
