import { ExamPaperAnalysis, ExamQuestionMatch, ExamMatchCategory } from "../types";
import { db, auth } from "../lib/firebase";
import {
  collection,
  doc,
  query,
  where,
} from "firebase/firestore";
import {
  guardedSetDoc,
  guardedGetDocs,
} from "./quotaTracker";

const LOCAL_ANALYSES_KEY = "remix_rajprep_exam_analyses_v1";

/**
 * Load all analyses from LocalStorage
 */
export function loadLocalAnalyses(): ExamPaperAnalysis[] {
  try {
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
    const list = loadLocalAnalyses().filter((a) => a.analysisId !== analysisId);
    localStorage.setItem(LOCAL_ANALYSES_KEY, JSON.stringify(list));
  } catch (e) {
    console.error("Failed to delete local exam analysis", e);
  }
}

/**
 * Save analysis to Firebase Firestore (and LocalStorage)
 */
export async function saveExamAnalysis(analysis: ExamPaperAnalysis): Promise<void> {
  // Always update local cache first
  saveLocalAnalysis(analysis);

  // If user is logged in and Firestore is initialized, sync to cloud
  const user = auth.currentUser;
  if (!user) return;

  try {
    const analysisRef = doc(db, "examPaperAnalyses", analysis.analysisId);

    // Save parent doc (without deep question array to keep doc light)
    const summaryDoc = {
      analysisId: analysis.analysisId,
      userId: user.uid,
      examId: analysis.examId,
      examName: analysis.examName,
      paperYear: analysis.paperYear,
      paperDate: analysis.paperDate,
      paperName: analysis.paperName,
      shiftCode: analysis.shiftCode || "",
      status: analysis.status,
      totalPages: analysis.totalPages,
      detectedQuestionCount: analysis.detectedQuestionCount,
      analyzedQuestionCount: analysis.analyzedQuestionCount,
      exactMatchCount: analysis.exactMatchCount,
      nearExactMatchCount: analysis.nearExactMatchCount,
      similarMatchCount: analysis.similarMatchCount,
      conceptMatchCount: analysis.conceptMatchCount,
      unmatchedCount: analysis.unmatchedCount,
      needsReviewCount: analysis.needsReviewCount,
      createdAt: analysis.createdAt,
      completedAt: analysis.completedAt || new Date().toISOString(),
      schemaVersion: analysis.schemaVersion || 1,
    };

    await guardedSetDoc(analysisRef, summaryDoc, { merge: true }, "Student", "Save Exam Analysis Summary");

    // Save questions into subcollection
    const questionsCollection = collection(analysisRef, "questions");
    for (const q of analysis.questions) {
      const qDocRef = doc(questionsCollection, q.examQuestionId);
      await guardedSetDoc(
        qDocRef,
        {
          examQuestionId: q.examQuestionId,
          originalQuestionNumber: String(q.originalQuestionNumber),
          sourcePageNumber: q.sourcePageNumber,
          originalText: q.originalText,
          normalizedText: q.normalizedText,
          extractedOptions: q.extractedOptions || [],
          ocrStatus: q.ocrStatus,
          reviewStatus: q.reviewStatus,
          primaryMatchCategory: q.primaryMatchCategory,
          bestMatchQuestionId: q.bestMatchQuestionId || "",
          matchExplanation: q.matchExplanation || "",
          matchScore: q.matchScore || 0,
          processingStatus: q.processingStatus,
          meaningfulDifferences: q.meaningfulDifferences || [],
          userFeedback: q.userFeedback || null,
        },
        undefined,
        "Student",
        "Save Exam Analysis Question"
      );
    }
  } catch (error) {
    console.warn("Firestore sync for exam analysis skipped or failed, local copy preserved:", error);
  }
}

/**
 * Fetch all analyses for the current user (local + cloud merge)
 */
export async function getAnalysesHistory(): Promise<ExamPaperAnalysis[]> {
  const localList = loadLocalAnalyses();

  const user = auth.currentUser;
  if (!user) return localList;

  try {
    const q = query(
      collection(db, "examPaperAnalyses"),
      where("userId", "==", user.uid)
    );
    const snap = await guardedGetDocs(q, "Student", "Fetch Exam Analyses History");

    const cloudSummaries: ExamPaperAnalysis[] = [];
    for (const d of snap.docs) {
      const data = d.data() as any;
      // If we already have the full analysis in local cache, use the local questions
      const localMatch = localList.find((l) => l.analysisId === data.analysisId);
      if (localMatch) {
        cloudSummaries.push(localMatch);
      } else {
        cloudSummaries.push({
          ...data,
          questions: [],
        });
      }
    }

    // Merge by analysisId
    const mergedMap = new Map<string, ExamPaperAnalysis>();
    for (const item of [...localList, ...cloudSummaries]) {
      mergedMap.set(item.analysisId, item);
    }

    return Array.from(mergedMap.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  } catch (e) {
    console.warn("Could not query Firestore history, returning local list:", e);
    return localList;
  }
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

  // Recalculate summary metrics
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

  // Sync to firestore if logged in
  const user = auth.currentUser;
  if (user) {
    try {
      const qDocRef = doc(db, "examPaperAnalyses", analysisId, "questions", examQuestionId);
      await guardedSetDoc(
        qDocRef,
        {
          primaryMatchCategory: newCategory,
          reviewStatus: "confirmed",
          processingStatus: "completed",
          userFeedback: targetQ.userFeedback,
        },
        { merge: true },
        "Student",
        "Update Question Review Status"
      );
    } catch (e) {
      console.warn("Firestore update for question review skipped:", e);
    }
  }

  return targetAnalysis;
}
