import { ExamPaperAnalysis, ExamMatchCategory } from "../types";

const LOCAL_ANALYSES_KEY = "remix_rajprep_exam_analyses_v1";

/**
 * Load all analyses from LocalStorage
 */
export function loadLocalAnalyses(): ExamPaperAnalysis[] {
  try {
    if (typeof window === "undefined" || !window.localStorage) return [];
    const raw = localStorage.getItem(LOCAL_ANALYSES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.error("Failed to load local exam analyses", e);
    return [];
  }
}

/**
 * Save an analysis to LocalStorage
 */
export function saveLocalAnalysis(analysis: ExamPaperAnalysis): void {
  try {
    if (typeof window === "undefined" || !window.localStorage) return;
    const list = loadLocalAnalyses();
    const idx = list.findIndex((a) => a.analysisId === analysis.analysisId);
    if (idx >= 0) {
      list[idx] = analysis;
    } else {
      list.unshift(analysis);
    }
    localStorage.setItem(LOCAL_ANALYSES_KEY, JSON.stringify(list));
  } catch (e) {
    console.error("Failed to save local exam analysis", e);
  }
}

/**
 * Delete an analysis from LocalStorage
 */
export function deleteLocalAnalysis(analysisId: string): void {
  try {
    if (typeof window === "undefined" || !window.localStorage) return;
    const list = loadLocalAnalyses().filter((a) => a.analysisId !== analysisId);
    localStorage.setItem(LOCAL_ANALYSES_KEY, JSON.stringify(list));
  } catch (e) {
    console.error("Failed to delete local exam analysis", e);
  }
}

/**
 * Save analysis (persisted locally)
 */
export async function saveExamAnalysis(analysis: ExamPaperAnalysis): Promise<void> {
  saveLocalAnalysis(analysis);
}

/**
 * Fetch all analyses for the current user
 */
export async function getAnalysesHistory(): Promise<ExamPaperAnalysis[]> {
  return loadLocalAnalyses();
}

/**
 * Update manual match review decision for a question in an analysis
 */
export async function updateQuestionMatchReview(
  analysisId: string,
  examQuestionId: string,
  newCategory: ExamMatchCategory,
  notes?: string
): Promise<ExamPaperAnalysis | null> {
  const analyses = loadLocalAnalyses();
  const targetAnalysis = analyses.find((a) => a.analysisId === analysisId);
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
