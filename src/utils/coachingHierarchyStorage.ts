import { 
  collection, 
  doc, 
  getDocs, 
  getDoc, 
  onSnapshot, 
  query, 
  where, 
  orderBy 
} from "firebase/firestore";
import { db, isFirebaseConfigured } from "../lib/firebase";
import { Coaching, CoachingExam, CoachingTestSeries } from "../types";
import { guardedSetDoc, guardedUpdateDoc, guardedDeleteDoc } from "./quotaTracker";

const LOCAL_KEY_COACHING = "quizpro_coaching_list";
const LOCAL_KEY_EXAMS = "quizpro_coaching_exams";
const LOCAL_KEY_SERIES = "quizpro_coaching_series";

// No hardcoded sample or demo mock data - clean production defaults
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

// Helper to safely load from local storage with demo sanitization
function loadLocalData<T extends { id?: string }>(key: string, defaultData: T[]): T[] {
  if (typeof localStorage === "undefined") return defaultData;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) {
      return defaultData;
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return defaultData;
    
    // Purge any stale demo items from local storage
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
    console.warn("Failed to save local coaching hierarchy cache:", e);
  }
}

// ──────────────────────────────────────────
// COACHINGS STORAGE API
// ──────────────────────────────────────────

export async function fetchCoachings(): Promise<Coaching[]> {
  const localList = loadLocalData<Coaching>(LOCAL_KEY_COACHING, DEFAULT_COACHINGS);

  if (!isFirebaseConfigured()) return localList;

  try {
    const snap = await getDocs(collection(db, "coaching"));
    const remoteList: Coaching[] = snap.docs
      .map((d) => ({ id: d.id, ...d.data() } as Coaching))
      .filter((c) => !DEMO_IDS.has(c.id));
    remoteList.sort((a, b) => a.order - b.order);
    saveLocalData(LOCAL_KEY_COACHING, remoteList);
    return remoteList;
  } catch (err) {
    console.warn("Error fetching coachings from Firestore, using cached local list:", err);
    return localList;
  }
}

export function subscribeToCoachings(callback: (coachings: Coaching[]) => void): () => void {
  const localList = loadLocalData<Coaching>(LOCAL_KEY_COACHING, DEFAULT_COACHINGS);
  callback(localList);

  if (!isFirebaseConfigured()) return () => {};

  return onSnapshot(
    collection(db, "coaching"),
    (snap) => {
      const list: Coaching[] = snap.docs
        .map((d) => ({ id: d.id, ...d.data() } as Coaching))
        .filter((c) => !DEMO_IDS.has(c.id));
      list.sort((a, b) => a.order - b.order);
      saveLocalData(LOCAL_KEY_COACHING, list);
      callback(list);
    },
    (err) => {
      console.warn("Coachings snapshot listener error:", err);
    }
  );
}

export async function addCoaching(item: Omit<Coaching, "id" | "createdAt" | "updatedAt">): Promise<Coaching> {
  const id = `coaching_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const now = new Date().toISOString();
  const newCoaching: Coaching = {
    ...item,
    id,
    isActive: item.isActive ?? true,
    order: item.order ?? 1,
    createdAt: now,
    updatedAt: now,
  };

  // Update Local Cache
  const list = loadLocalData<Coaching>(LOCAL_KEY_COACHING, DEFAULT_COACHINGS);
  const updatedList = [...list, newCoaching].sort((a, b) => a.order - b.order);
  saveLocalData(LOCAL_KEY_COACHING, updatedList);

  // Update Firestore
  if (isFirebaseConfigured()) {
    try {
      await guardedSetDoc(doc(db, "coaching", id), newCoaching, undefined, "Admin", "Add Coaching");
    } catch (err) {
      console.error("Failed to add coaching to Firestore:", err);
    }
  }

  return newCoaching;
}

export async function updateCoaching(id: string, updates: Partial<Coaching>): Promise<void> {
  const now = new Date().toISOString();
  const list = loadLocalData<Coaching>(LOCAL_KEY_COACHING, DEFAULT_COACHINGS);
  const updatedList = list.map((c) => (c.id === id ? { ...c, ...updates, updatedAt: now } : c));
  saveLocalData(LOCAL_KEY_COACHING, updatedList);

  if (isFirebaseConfigured()) {
    try {
      await guardedUpdateDoc(doc(db, "coaching", id), { ...updates, updatedAt: now }, "Admin", "Update Coaching");
    } catch (err) {
      console.error(`Failed to update coaching ${id} in Firestore:`, err);
    }
  }
}

export async function deleteCoaching(id: string): Promise<{ success: boolean; message: string }> {
  // Dependency Check: Check if any exams exist under this coaching
  const exams = await fetchCoachingExams(id);
  if (exams.length > 0) {
    return {
      success: false,
      message: `Cannot delete coaching. It contains ${exams.length} associated exam(s). Delete associated exams first.`,
    };
  }

  const list = loadLocalData<Coaching>(LOCAL_KEY_COACHING, DEFAULT_COACHINGS);
  const updatedList = list.filter((c) => c.id !== id);
  saveLocalData(LOCAL_KEY_COACHING, updatedList);

  if (isFirebaseConfigured()) {
    try {
      await guardedDeleteDoc(doc(db, "coaching", id), "Admin", "Delete Coaching");
    } catch (err) {
      console.error(`Failed to delete coaching ${id} from Firestore:`, err);
    }
  }

  return { success: true, message: "Coaching deleted successfully." };
}

// ──────────────────────────────────────────
// COACHING EXAMS STORAGE API
// ──────────────────────────────────────────

export async function fetchCoachingExams(coachingId?: string): Promise<CoachingExam[]> {
  const localList = loadLocalData<CoachingExam>(LOCAL_KEY_EXAMS, DEFAULT_EXAMS);

  let filtered = localList;
  if (coachingId) {
    filtered = localList.filter((e) => e.coachingId === coachingId);
  }

  if (!isFirebaseConfigured()) return filtered;

  try {
    const snap = await getDocs(collection(db, "coaching_exams"));
    const remoteList: CoachingExam[] = snap.docs
      .map((d) => ({ id: d.id, ...d.data() } as CoachingExam))
      .filter((e) => !DEMO_IDS.has(e.id));
    remoteList.sort((a, b) => a.order - b.order);
    saveLocalData(LOCAL_KEY_EXAMS, remoteList);

    return coachingId ? remoteList.filter((e) => e.coachingId === coachingId) : remoteList;
  } catch (err) {
    console.warn("Error fetching coaching exams from Firestore:", err);
    return filtered;
  }
}

export function subscribeToCoachingExams(
  coachingId: string | undefined,
  callback: (exams: CoachingExam[]) => void
): () => void {
  const localList = loadLocalData<CoachingExam>(LOCAL_KEY_EXAMS, DEFAULT_EXAMS);
  const initialFiltered = coachingId ? localList.filter((e) => e.coachingId === coachingId) : localList;
  callback(initialFiltered);

  if (!isFirebaseConfigured()) return () => {};

  return onSnapshot(
    collection(db, "coaching_exams"),
    (snap) => {
      const list: CoachingExam[] = snap.docs
        .map((d) => ({ id: d.id, ...d.data() } as CoachingExam))
        .filter((e) => !DEMO_IDS.has(e.id));
      list.sort((a, b) => a.order - b.order);
      saveLocalData(LOCAL_KEY_EXAMS, list);
      callback(coachingId ? list.filter((e) => e.coachingId === coachingId) : list);
    },
    (err) => {
      console.warn("Coaching exams snapshot listener error:", err);
    }
  );
}

export async function addCoachingExam(item: Omit<CoachingExam, "id" | "createdAt" | "updatedAt">): Promise<CoachingExam> {
  const id = `exam_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const now = new Date().toISOString();
  const newExam: CoachingExam = {
    ...item,
    id,
    isActive: item.isActive ?? true,
    order: item.order ?? 1,
    createdAt: now,
    updatedAt: now,
  };

  const list = loadLocalData<CoachingExam>(LOCAL_KEY_EXAMS, DEFAULT_EXAMS);
  const updatedList = [...list, newExam].sort((a, b) => a.order - b.order);
  saveLocalData(LOCAL_KEY_EXAMS, updatedList);

  if (isFirebaseConfigured()) {
    try {
      await guardedSetDoc(doc(db, "coaching_exams", id), newExam, undefined, "Admin", "Add Coaching Exam");
    } catch (err) {
      console.error("Failed to add coaching exam to Firestore:", err);
    }
  }

  return newExam;
}

export async function updateCoachingExam(id: string, updates: Partial<CoachingExam>): Promise<void> {
  const now = new Date().toISOString();
  const list = loadLocalData<CoachingExam>(LOCAL_KEY_EXAMS, DEFAULT_EXAMS);
  const updatedList = list.map((e) => (e.id === id ? { ...e, ...updates, updatedAt: now } : e));
  saveLocalData(LOCAL_KEY_EXAMS, updatedList);

  if (isFirebaseConfigured()) {
    try {
      await guardedUpdateDoc(doc(db, "coaching_exams", id), { ...updates, updatedAt: now }, "Admin", "Update Coaching Exam");
    } catch (err) {
      console.error(`Failed to update exam ${id} in Firestore:`, err);
    }
  }
}

export async function deleteCoachingExam(id: string): Promise<{ success: boolean; message: string }> {
  // Dependency Check: Check if any test series exist under this exam
  const seriesList = await fetchCoachingTestSeries(undefined, id);
  if (seriesList.length > 0) {
    return {
      success: false,
      message: `Cannot delete exam. It contains ${seriesList.length} associated test series. Delete associated test series first.`,
    };
  }

  const list = loadLocalData<CoachingExam>(LOCAL_KEY_EXAMS, DEFAULT_EXAMS);
  const updatedList = list.filter((e) => e.id !== id);
  saveLocalData(LOCAL_KEY_EXAMS, updatedList);

  if (isFirebaseConfigured()) {
    try {
      await guardedDeleteDoc(doc(db, "coaching_exams", id), "Admin", "Delete Coaching Exam");
    } catch (err) {
      console.error(`Failed to delete exam ${id} from Firestore:`, err);
    }
  }

  return { success: true, message: "Exam deleted successfully." };
}

// ──────────────────────────────────────────
// COACHING TEST SERIES STORAGE API
// ──────────────────────────────────────────

export async function fetchCoachingTestSeries(
  coachingId?: string,
  examId?: string
): Promise<CoachingTestSeries[]> {
  const localList = loadLocalData<CoachingTestSeries>(LOCAL_KEY_SERIES, DEFAULT_SERIES);

  let filtered = localList;
  if (coachingId) {
    filtered = filtered.filter((s) => s.coachingId === coachingId);
  }
  if (examId) {
    filtered = filtered.filter((s) => s.examId === examId);
  }

  if (!isFirebaseConfigured()) return filtered;

  try {
    const snap = await getDocs(collection(db, "coaching_test_series"));
    const remoteList: CoachingTestSeries[] = snap.docs
      .map((d) => ({ id: d.id, ...d.data() } as CoachingTestSeries))
      .filter((s) => !DEMO_IDS.has(s.id));
    remoteList.sort((a, b) => a.order - b.order);
    saveLocalData(LOCAL_KEY_SERIES, remoteList);

    let result = remoteList;
    if (coachingId) result = result.filter((s) => s.coachingId === coachingId);
    if (examId) result = result.filter((s) => s.examId === examId);
    return result;
  } catch (err) {
    console.warn("Error fetching test series from Firestore:", err);
    return filtered;
  }
}

export function subscribeToCoachingTestSeries(
  coachingId: string | undefined,
  examId: string | undefined,
  callback: (seriesList: CoachingTestSeries[]) => void
): () => void {
  const localList = loadLocalData<CoachingTestSeries>(LOCAL_KEY_SERIES, DEFAULT_SERIES);
  let initial = localList;
  if (coachingId) initial = initial.filter((s) => s.coachingId === coachingId);
  if (examId) initial = initial.filter((s) => s.examId === examId);
  callback(initial);

  if (!isFirebaseConfigured()) return () => {};

  return onSnapshot(
    collection(db, "coaching_test_series"),
    (snap) => {
      const list: CoachingTestSeries[] = snap.docs
        .map((d) => ({ id: d.id, ...d.data() } as CoachingTestSeries))
        .filter((s) => !DEMO_IDS.has(s.id));
      list.sort((a, b) => a.order - b.order);
      saveLocalData(LOCAL_KEY_SERIES, list);

      let result = list;
      if (coachingId) result = result.filter((s) => s.coachingId === coachingId);
      if (examId) result = result.filter((s) => s.examId === examId);
      callback(result);
    },
    (err) => {
      console.warn("Test series snapshot listener error:", err);
    }
  );
}

export async function addCoachingTestSeries(
  item: Omit<CoachingTestSeries, "id" | "createdAt" | "updatedAt">
): Promise<CoachingTestSeries> {
  const id = `series_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const now = new Date().toISOString();
  const newSeries: CoachingTestSeries = {
    ...item,
    id,
    isActive: item.isActive ?? true,
    order: item.order ?? 1,
    createdAt: now,
    updatedAt: now,
  };

  const list = loadLocalData<CoachingTestSeries>(LOCAL_KEY_SERIES, DEFAULT_SERIES);
  const updatedList = [...list, newSeries].sort((a, b) => a.order - b.order);
  saveLocalData(LOCAL_KEY_SERIES, updatedList);

  if (isFirebaseConfigured()) {
    try {
      await guardedSetDoc(doc(db, "coaching_test_series", id), newSeries, undefined, "Admin", "Add Coaching Test Series");
    } catch (err) {
      console.error("Failed to add test series to Firestore:", err);
    }
  }

  return newSeries;
}

export async function updateCoachingTestSeries(
  id: string,
  updates: Partial<CoachingTestSeries>
): Promise<void> {
  const now = new Date().toISOString();
  const list = loadLocalData<CoachingTestSeries>(LOCAL_KEY_SERIES, DEFAULT_SERIES);
  const updatedList = list.map((s) => (s.id === id ? { ...s, ...updates, updatedAt: now } : s));
  saveLocalData(LOCAL_KEY_SERIES, updatedList);

  if (isFirebaseConfigured()) {
    try {
      await guardedUpdateDoc(doc(db, "coaching_test_series", id), { ...updates, updatedAt: now }, "Admin", "Update Coaching Test Series");
    } catch (err) {
      console.error(`Failed to update test series ${id} in Firestore:`, err);
    }
  }
}

export async function deleteCoachingTestSeries(id: string): Promise<{ success: boolean; message: string }> {
  const list = loadLocalData<CoachingTestSeries>(LOCAL_KEY_SERIES, DEFAULT_SERIES);
  const updatedList = list.filter((s) => s.id !== id);
  saveLocalData(LOCAL_KEY_SERIES, updatedList);

  if (isFirebaseConfigured()) {
    try {
      await guardedDeleteDoc(doc(db, "coaching_test_series", id), "Admin", "Delete Coaching Test Series");
    } catch (err) {
      console.error(`Failed to delete test series ${id} from Firestore:`, err);
    }
  }

  return { success: true, message: "Test series deleted successfully." };
}
