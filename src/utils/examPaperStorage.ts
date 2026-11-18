import localforage from "localforage";
import { ExamPaperAnalysis, ExamMatchCategory } from "../types";

/**
 * STRICT LOCAL-ONLY STORAGE POLICY:
 * AI Exam Paper Analyses, extracted question drafts, OCR text, and matching scores
 * are 100% stored strictly on the user's local device (IndexedDB & LocalStorage).
 * Under NO circumstances is this data synced to Supabase, remote databases, or external telemetry.
 */

const LOCAL_ANALYSES_KEY = "remix_rajprep_exam_analyses_v1";

// In-memory fallback map for non-browser / SSR / Vitest runtimes
const inMemoryStore = new Map<string, ExamPaperAnalysis>();

// Custom resilient in-memory driver for SSR / Node tests / private browsing
const memoryDriver: LocalForageDriver = {
  _driver: "memoryDriver",
  _initStorage: function (this: any) {
    this._db = new Map<string, any>();
  },
  getItem: function <T>(this: any, key: string, callback?: (err: any, value: T | null) => void): Promise<T | null> {
    if (!this._db) this._db = new Map<string, any>();
    const val = this._db.has(key) ? this._db.get(key) : null;
    if (callback) callback(null, val);
    return Promise.resolve(val);
  },
  setItem: function <T>(this: any, key: string, value: T, callback?: (err: any, value: T) => void): Promise<T> {
    if (!this._db) this._db = new Map<string, any>();
    this._db.set(key, value);
    if (callback) callback(null, value);
    return Promise.resolve(value);
  },
  removeItem: function (this: any, key: string, callback?: (err: any) => void): Promise<void> {
    if (this._db) this._db.delete(key);
    if (callback) callback(null);
    return Promise.resolve();
  },
  clear: function (this: any, callback?: (err: any) => void): Promise<void> {
    if (this._db) this._db.clear();
    if (callback) callback(null);
    return Promise.resolve();
  },
  length: function (this: any, callback?: (err: any, numberOfKeys: number) => void): Promise<number> {
    const len = this._db ? this._db.size : 0;
    if (callback) callback(null, len);
    return Promise.resolve(len);
  },
  key: function (this: any, n: number, callback?: (err: any, key: string) => void): Promise<string> {
    const keys: string[] = this._db ? (Array.from(this._db.keys()) as string[]) : [];
    const k: string = keys[n] || "";
    if (callback) callback(null, k);
    return Promise.resolve(k);
  },
  keys: function (this: any, callback?: (err: any, keys: string[]) => void): Promise<string[]> {
    const keys: string[] = this._db ? (Array.from(this._db.keys()) as string[]) : [];
    if (callback) callback(null, keys);
    return Promise.resolve(keys);
  },
  iterate: function <T, U>(
    this: any,
    iterator: (value: T, key: string, iterationNumber: number) => U,
    callback?: (err: any, result: U) => void
  ): Promise<U> {
    if (!this._db) this._db = new Map<string, any>();
    let iterationNumber = 1;
    let res: any;
    for (const [key, value] of this._db.entries()) {
      res = iterator(value, key, iterationNumber++);
      if (res !== undefined) break;
    }
    if (callback) callback(null, res);
    return Promise.resolve(res);
  },
};

// Register memory driver synchronously
try {
  localforage.defineDriver(memoryDriver);
} catch (_) {}

// Dedicated LocalForage instance for persistent IndexedDB storage
// Order of priority: IndexedDB -> LocalStorage -> memoryDriver
export const examAnalysisLocalStore = localforage.createInstance({
  name: "disha_20_20",
  storeName: "exam_analyses_local_only",
  driver: [localforage.INDEXEDDB, localforage.LOCALSTORAGE, "memoryDriver"],
  description: "Strictly local storage for user exam paper analysis and matched questions",
});

/**
 * Synchronously load all analyses from LocalStorage or inMemory store (fast initial render)
 */
export function loadLocalAnalyses(): ExamPaperAnalysis[] {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      const raw = localStorage.getItem(LOCAL_ANALYSES_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    }
  } catch (e) {
    console.warn("[LocalExamStorage] LocalStorage read notice:", e);
  }

  // Fallback to in-memory store
  return Array.from(inMemoryStore.values()).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

/**
 * Save an analysis strictly to LocalStorage & IndexedDB on the user's device
 */
export function saveLocalAnalysis(analysis: ExamPaperAnalysis): void {
  try {
    inMemoryStore.set(analysis.analysisId, analysis);

    const list = loadLocalAnalyses();
    const idx = list.findIndex((a) => a.analysisId === analysis.analysisId);
    if (idx >= 0) {
      list[idx] = analysis;
    } else {
      list.unshift(analysis);
    }

    // 1. Save to LocalStorage (with safety catch for QuotaExceededError)
    if (typeof window !== "undefined" && window.localStorage) {
      try {
        localStorage.setItem(LOCAL_ANALYSES_KEY, JSON.stringify(list));
      } catch (quotaErr) {
        console.warn("[LocalExamStorage] LocalStorage quota reached, persisting to IndexedDB only:", quotaErr);
      }
    }

    // 2. Persist to IndexedDB for reliable, unlimited local device storage
    examAnalysisLocalStore.setItem(analysis.analysisId, analysis).catch((err) => {
      console.warn("[LocalExamStorage] IndexedDB save notice:", err);
    });
  } catch (e) {
    console.error("[LocalExamStorage] Failed to save local exam analysis:", e);
  }
}

/**
 * Delete an analysis from the user's local device
 */
export function deleteLocalAnalysis(analysisId: string): void {
  try {
    inMemoryStore.delete(analysisId);

    if (typeof window !== "undefined" && window.localStorage) {
      const list = loadLocalAnalyses().filter((a) => a.analysisId !== analysisId);
      localStorage.setItem(LOCAL_ANALYSES_KEY, JSON.stringify(list));
    }
    examAnalysisLocalStore.removeItem(analysisId).catch((err) => {
      console.warn("[LocalExamStorage] IndexedDB remove notice:", err);
    });
  } catch (e) {
    console.error("[LocalExamStorage] Failed to delete local exam analysis:", e);
  }
}

/**
 * Clear ALL exam paper analyses from the user's local device
 */
export async function clearAllLocalAnalyses(): Promise<void> {
  try {
    inMemoryStore.clear();

    if (typeof window !== "undefined" && window.localStorage) {
      localStorage.removeItem(LOCAL_ANALYSES_KEY);
    }
    await examAnalysisLocalStore.clear();
  } catch (e) {
    console.error("[LocalExamStorage] Failed to clear local exam analyses:", e);
  }
}

/**
 * Save analysis (persisted locally on device only)
 */
export async function saveExamAnalysis(analysis: ExamPaperAnalysis): Promise<void> {
  saveLocalAnalysis(analysis);
}

/**
 * Fetch all analyses from the user's local device
 */
export async function getAnalysesHistory(): Promise<ExamPaperAnalysis[]> {
  try {
    // Check IndexedDB / localforage first for complete historical records
    const keys = await examAnalysisLocalStore.keys();
    if (keys && keys.length > 0) {
      const items: ExamPaperAnalysis[] = [];
      for (const k of keys) {
        const item = await examAnalysisLocalStore.getItem<ExamPaperAnalysis>(k);
        if (item) items.push(item);
      }
      // Sort newest first
      items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      return items;
    }
  } catch (err) {
    console.warn("[LocalExamStorage] IndexedDB read fallback to localStorage:", err);
  }

  // Fallback to LocalStorage or inMemoryStore
  return loadLocalAnalyses();
}

/**
 * Update manual match review decision for a question in an analysis (local only)
 */
export async function updateQuestionMatchReview(
  analysisId: string,
  examQuestionId: string,
  newCategory: ExamMatchCategory,
  notes?: string
): Promise<ExamPaperAnalysis | null> {
  let targetAnalysis: ExamPaperAnalysis | null = null;

  try {
    targetAnalysis = await examAnalysisLocalStore.getItem<ExamPaperAnalysis>(analysisId);
  } catch {
    // ignore
  }

  if (!targetAnalysis) {
    const analyses = loadLocalAnalyses();
    targetAnalysis = analyses.find((a) => a.analysisId === analysisId) || null;
  }

  if (!targetAnalysis) return null;

  const qIdx = targetAnalysis.questions.findIndex((q) => q.examQuestionId === examQuestionId);
  if (qIdx === -1) return null;

  const targetQ = targetAnalysis.questions[qIdx];
  targetQ.primaryMatchCategory = newCategory;
  targetQ.reviewStatus = "confirmed";
  targetQ.processingStatus = "completed";
  targetQ.userFeedback = {
    reviewedCategory: newCategory,
    notes: notes || "Manually reviewed by user",
    reviewedAt: new Date().toISOString(),
  };

  let exact = 0;
  let nearExact = 0;
  let similar = 0;
  let concept = 0;
  let unmatched = 0;
  let needsReview = 0;

  for (const q of targetAnalysis.questions) {
    if (q.primaryMatchCategory === "exact") exact++;
    else if (q.primaryMatchCategory === "near_exact") nearExact++;
    else if (q.primaryMatchCategory === "similar") similar++;
    else if (q.primaryMatchCategory === "concept_related") concept++;
    else unmatched++;

    if (q.processingStatus === "needs_review") needsReview++;
  }

  targetAnalysis.exactMatchCount = exact;
  targetAnalysis.nearExactMatchCount = nearExact;
  targetAnalysis.similarMatchCount = similar;
  targetAnalysis.conceptMatchCount = concept;
  targetAnalysis.unmatchedCount = unmatched;
  targetAnalysis.needsReviewCount = needsReview;

  saveLocalAnalysis(targetAnalysis);
  return targetAnalysis;
}
