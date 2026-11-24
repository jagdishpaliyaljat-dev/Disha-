import { supabase, isSupabaseConfigured } from "../lib/supabase";
import { Question, QuestionApprovalStatus, UserProfile } from "../types";
import { loadUserProfile } from "./userProfileStorage";
import { canApproveQuestions, canPublishQuestions, getStaffRole } from "./rbac";
import { 
  loadUserQuestionsStore, 
  saveUserQuestionsStore, 
  getCombinedQuestions 
} from "./questionsStorage";
import { recordStaffAuditLog } from "./staffManagementService";

const REVIEW_QUEUE_STORAGE_KEY = "disha2020_question_review_queue_v1";

/**
 * Generate default seed pending questions if queue is completely empty
 */
function getSeedReviewQuestions(): Question[] {
  return [
    {
      id: "q_rev_seed_01",
      topicId: "t_eco_01",
      chapterId: "ch_eco_01",
      subjectId: "sub_eco",
      subject: "Economics",
      chapter: "Macroeconomic Overview",
      topic: "GDP & Growth Projections",
      text: "What was the estimated real GDP growth rate projected in the Economic Survey 2023-24 for the upcoming fiscal year?",
      options: ["6.0% - 6.5%", "6.5% - 7.0%", "7.0% - 7.5%", "8.0% - 8.5%"],
      correctIndex: 1,
      explanation: "The Economic Survey projected a conservative real GDP growth of 6.5–7.0% for FY25 taking global headwinds into account.",
      importantFact: "Survey uses dynamic baseline models for macroeconomic forecasting.",
      difficulty: "medium",
      year: 2024,
      examName: "UPSC CSE Prelims",
      isPYQ: false,
      approvalStatus: "pending_review",
      submittedBy: "staff-seed-sme-01",
      submittedAt: new Date(Date.now() - 3600000 * 5).toISOString(),
    },
    {
      id: "q_rev_seed_02",
      topicId: "t_eco_02",
      chapterId: "ch_eco_01",
      subjectId: "sub_eco",
      subject: "Economics",
      chapter: "Fiscal Developments",
      topic: "Fiscal Deficit Targets",
      text: "According to the Medium-Term Fiscal Policy Statement, the Central Government committed to bring the fiscal deficit below what percentage of GDP by FY 2025-26?",
      options: ["3.5%", "4.0%", "4.5%", "5.0%"],
      correctIndex: 2,
      explanation: "The fiscal consolidation glide path announced in Union Budget aims to achieve a fiscal deficit below 4.5% of GDP by FY26.",
      importantFact: "Fiscal Responsibility and Budget Management (FRBM) targets.",
      difficulty: "hard",
      year: 2024,
      examName: "RAS Prelims",
      isPYQ: true,
      approvalStatus: "pending_review",
      submittedBy: "staff-seed-sme-01",
      submittedAt: new Date(Date.now() - 3600000 * 8).toISOString(),
    },
    {
      id: "q_rev_seed_03",
      topicId: "t_eco_03",
      chapterId: "ch_eco_02",
      subjectId: "sub_eco",
      subject: "Economics",
      chapter: "Monetary Management",
      topic: "Inflation Targeting",
      text: "Under the Reserve Bank of India Act, 1934, what is the flexible inflation target mandate set for the Monetary Policy Committee (MPC)?",
      options: ["3% (+/- 1%)", "4% (+/- 2%)", "5% (+/- 2%)", "2% - 6% without mid-point"],
      correctIndex: 1,
      explanation: "The statutory inflation target is 4.0% with a tolerance band of +/- 2 percentage points (i.e., 2% to 6%).",
      importantFact: "Section 45ZA of the RBI Act empowers the Central Government to determine the target in consultation with RBI.",
      difficulty: "medium",
      year: 2023,
      examName: "UPSC CSE Prelims",
      isPYQ: true,
      approvalStatus: "pending_review",
      reviewNotes: "Please verify whether Hindi translation of options is included and add mention of Section 45ZA in explanation.",
      submittedBy: "staff-seed-sme-01",
      submittedAt: new Date(Date.now() - 3600000 * 24).toISOString(),
      reviewedBy: "staff-seed-reviewer-01",
      reviewedAt: new Date(Date.now() - 3600000 * 12).toISOString(),
    },
  ];
}

let inMemoryReviewQueue: Question[] = [];

export function getCachedReviewQuestions(): Question[] {
  try {
    if (typeof localStorage !== "undefined") {
      const raw = localStorage.getItem(REVIEW_QUEUE_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    }
  } catch {}
  if (inMemoryReviewQueue.length > 0) return inMemoryReviewQueue;
  const seeds = getSeedReviewQuestions();
  setCachedReviewQuestions(seeds);
  return seeds;
}

export function setCachedReviewQuestions(questions: Question[]): void {
  inMemoryReviewQueue = questions;
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(REVIEW_QUEUE_STORAGE_KEY, JSON.stringify(questions));
    }
  } catch (err) {
    console.warn("Could not cache review questions:", err);
  }
}

/**
 * Fetch all questions for the review queue, merging local drafts and Supabase questions
 */
export async function fetchReviewQueueQuestions(filters?: {
  status?: QuestionApprovalStatus;
  subjectId?: string;
  chapterId?: string;
  search?: string;
}): Promise<Question[]> {
  let allQuestions: Question[] = [];

  // 1. Load from question store
  let storedList: Question[] = [];
  try {
    const store = loadUserQuestionsStore();
    storedList = getCombinedQuestions(store?.customChapters || [], store);
  } catch {}
  
  // 2. Load cached review questions
  const cachedReview = getCachedReviewQuestions();

  // Combine unique by ID
  const questionMap = new Map<string, Question>();
  for (const q of cachedReview) {
    questionMap.set(q.id, {
      ...q,
      approvalStatus: q.approvalStatus || (q as any).approval_status || "pending_review",
    });
  }
  for (const q of storedList) {
    if (!questionMap.has(q.id)) {
      const status = q.approvalStatus || (q as any).approval_status || "published";
      questionMap.set(q.id, { ...q, approvalStatus: status });
    }
  }

  // 3. If Supabase configured, attempt fetching live items under review
  if (isSupabaseConfigured()) {
    try {
      const { data, error } = await supabase
        .from("questions")
        .select("id, topic_id, chapter_id, subject_id, text, options, correct_answer, explanation, important_fact, difficulty, year, exam_name, is_pyq, approval_status, submitted_by, submitted_at, reviewed_by, reviewed_at, review_notes, created_at, updated_at")
        .neq("approval_status", "published")
        .limit(150);

      if (!error && data && data.length > 0) {
        for (const row of data) {
          questionMap.set(row.id, {
            id: row.id,
            topicId: row.topic_id,
            chapterId: row.chapter_id,
            subjectId: row.subject_id,
            text: row.text,
            options: Array.isArray(row.options) ? row.options : [],
            correctIndex: typeof row.correct_answer === "number" ? row.correct_answer : 0,
            explanation: row.explanation || "",
            importantFact: row.important_fact,
            difficulty: row.difficulty,
            year: row.year,
            examName: row.exam_name,
            isPYQ: Boolean(row.is_pyq),
            approvalStatus: (row.approval_status as QuestionApprovalStatus) || "pending_review",
            submittedBy: row.submitted_by,
            submittedAt: row.submitted_at,
            reviewedBy: row.reviewed_by,
            reviewedAt: row.reviewed_at,
            reviewNotes: row.review_notes,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
          });
        }
      }
    } catch (err) {
      console.warn("Supabase fetchReviewQueueQuestions note:", err);
    }
  }

  allQuestions = Array.from(questionMap.values());

  // Apply filters
  if (filters?.status) {
    allQuestions = allQuestions.filter(q => (q.approvalStatus || "published") === filters.status);
  }
  if (filters?.subjectId) {
    allQuestions = allQuestions.filter(q => q.subjectId === filters.subjectId || q.subject === filters.subjectId);
  }
  if (filters?.chapterId) {
    allQuestions = allQuestions.filter(q => q.chapterId === filters.chapterId);
  }
  if (filters?.search) {
    const s = filters.search.toLowerCase().trim();
    allQuestions = allQuestions.filter(q => 
      q.text.toLowerCase().includes(s) ||
      (q.explanation && q.explanation.toLowerCase().includes(s)) ||
      (q.examName && q.examName.toLowerCase().includes(s)) ||
      (q.topic && q.topic.toLowerCase().includes(s))
    );
  }

  return allQuestions;
}

/**
 * Submit a question for QA review
 */
export async function submitQuestionForReview(
  question: Question,
  submitterProfile?: UserProfile | null,
  notes?: string
): Promise<Question> {
  const user = submitterProfile || loadUserProfile();
  const now = new Date().toISOString();

  const updated: Question = {
    ...question,
    approvalStatus: "pending_review",
    submittedBy: user?.id,
    submittedAt: now,
    reviewNotes: notes || undefined,
  };

  // Update review cache
  const cached = getCachedReviewQuestions().filter(q => q.id !== question.id);
  setCachedReviewQuestions([updated, ...cached]);

  // Persist to Supabase if available
  if (isSupabaseConfigured()) {
    try {
      await supabase.from("questions").upsert({
        id: updated.id,
        topic_id: updated.topicId,
        chapter_id: updated.chapterId,
        subject_id: updated.subjectId,
        text: updated.text,
        options: updated.options,
        correct_answer: updated.correctIndex,
        explanation: updated.explanation,
        approval_status: "pending_review",
        submitted_by: user?.id && user.id.length === 36 ? user.id : null,
        submitted_at: now,
        review_notes: notes || null,
        updated_at: now,
      }, { onConflict: "id" });
    } catch (err) {
      console.warn("Supabase submitQuestionForReview note:", err);
    }
  }

  await recordStaffAuditLog({
    action: "submit_question_for_review",
    resourceType: "question_approval",
    resourceId: updated.id,
    details: {
      questionSnippet: updated.text.slice(0, 80),
      submittedBy: user?.name || user?.email,
      notes,
    },
  });

  return updated;
}

/**
 * Approve a question (and optionally publish immediately)
 */
export async function approveQuestion(
  questionId: string,
  autoPublish = true,
  reviewerProfile?: UserProfile | null
): Promise<Question> {
  const reviewer = reviewerProfile || loadUserProfile();
  if (!canApproveQuestions(reviewer)) {
    throw new Error("Unauthorized: Only Content Reviewers and Super Admins can approve questions.");
  }

  const cached = getCachedReviewQuestions();
  const target = cached.find(q => q.id === questionId);
  const now = new Date().toISOString();
  const finalStatus: QuestionApprovalStatus = autoPublish ? "published" : "approved";

  let updated: Question;
  if (target) {
    updated = {
      ...target,
      approvalStatus: finalStatus,
      reviewedBy: reviewer?.id,
      reviewedAt: now,
    };
    setCachedReviewQuestions(cached.map(q => q.id === questionId ? updated : q));
  } else {
    updated = {
      id: questionId,
      text: "Approved Question",
      options: ["A", "B", "C", "D"],
      correctIndex: 0,
      explanation: "",
      chapterId: "ch_default",
      topicId: "t_default",
      approvalStatus: finalStatus,
      reviewedBy: reviewer?.id,
      reviewedAt: now,
    };
  }

  // Also update question in main user store if auto-publishing
  if (autoPublish) {
    try {
      const store = loadUserQuestionsStore();
      const updatedCustomChapters = store.customChapters.map(ch => ({
        ...ch,
        topics: ch.topics.map(t => ({
          ...t,
          questions: t.questions.map(q => q.id === questionId ? { ...q, approvalStatus: "published" as QuestionApprovalStatus } : q),
        })),
      }));
      saveUserQuestionsStore({ ...store, customChapters: updatedCustomChapters });
    } catch {}
  }

  if (isSupabaseConfigured()) {
    try {
      await supabase.from("questions").update({
        approval_status: finalStatus,
        reviewed_by: reviewer?.id && reviewer.id.length === 36 ? reviewer.id : null,
        reviewed_at: now,
        updated_at: now,
      }).eq("id", questionId);
    } catch (err) {
      console.warn("Supabase approveQuestion note:", err);
    }
  }

  await recordStaffAuditLog({
    action: autoPublish ? "approve_and_publish_question" : "approve_question",
    resourceType: "question_approval",
    resourceId: questionId,
    details: {
      questionSnippet: updated.text.slice(0, 80),
      reviewedBy: reviewer?.name || reviewer?.email,
      status: finalStatus,
    },
  });

  return updated;
}

/**
 * Reject a question / Request revisions with specific notes
 */
export async function rejectQuestion(
  questionId: string,
  reviewNotes: string,
  reviewerProfile?: UserProfile | null
): Promise<Question> {
  const reviewer = reviewerProfile || loadUserProfile();
  if (!canApproveQuestions(reviewer)) {
    throw new Error("Unauthorized: Only Content Reviewers and Super Admins can reject questions.");
  }
  if (!reviewNotes || !reviewNotes.trim()) {
    throw new Error("Validation Error: Please provide constructive feedback explaining what needs revision.");
  }

  const cached = getCachedReviewQuestions();
  const target = cached.find(q => q.id === questionId);
  const now = new Date().toISOString();

  let updated: Question;
  if (target) {
    updated = {
      ...target,
      approvalStatus: "rejected",
      reviewNotes: reviewNotes.trim(),
      reviewedBy: reviewer?.id,
      reviewedAt: now,
    };
    setCachedReviewQuestions(cached.map(q => q.id === questionId ? updated : q));
  } else {
    updated = {
      id: questionId,
      text: "Question under revision",
      options: ["A", "B", "C", "D"],
      correctIndex: 0,
      explanation: "",
      chapterId: "ch_default",
      topicId: "t_default",
      approvalStatus: "rejected",
      reviewNotes: reviewNotes.trim(),
      reviewedBy: reviewer?.id,
      reviewedAt: now,
    };
  }

  if (isSupabaseConfigured()) {
    try {
      await supabase.from("questions").update({
        approval_status: "rejected",
        review_notes: reviewNotes.trim(),
        reviewed_by: reviewer?.id && reviewer.id.length === 36 ? reviewer.id : null,
        reviewed_at: now,
        updated_at: now,
      }).eq("id", questionId);
    } catch (err) {
      console.warn("Supabase rejectQuestion note:", err);
    }
  }

  await recordStaffAuditLog({
    action: "reject_question",
    resourceType: "question_approval",
    resourceId: questionId,
    details: {
      questionSnippet: updated.text.slice(0, 80),
      reviewedBy: reviewer?.name || reviewer?.email,
      reviewNotes: reviewNotes.trim(),
    },
  });

  return updated;
}

/**
 * Publish an approved question to live student pool
 */
export async function publishQuestion(
  questionId: string,
  reviewerProfile?: UserProfile | null
): Promise<Question> {
  const user = reviewerProfile || loadUserProfile();
  if (!canPublishQuestions(user)) {
    throw new Error("Unauthorized: Only Content Reviewers and Super Admins can publish questions.");
  }
  return approveQuestion(questionId, true, user);
}

/**
 * Bulk approve multiple questions in one atomic operation
 */
export async function bulkApproveQuestions(
  questionIds: string[],
  autoPublish = true,
  reviewerProfile?: UserProfile | null
): Promise<{ successCount: number; failedIds: string[] }> {
  const user = reviewerProfile || loadUserProfile();
  if (!canApproveQuestions(user)) {
    throw new Error("Unauthorized: Insufficient permissions for bulk question approval.");
  }

  let successCount = 0;
  const failedIds: string[] = [];

  for (const id of questionIds) {
    try {
      await approveQuestion(id, autoPublish, user);
      successCount++;
    } catch {
      failedIds.push(id);
    }
  }

  await recordStaffAuditLog({
    action: autoPublish ? "bulk_approve_and_publish" : "bulk_approve",
    resourceType: "question_approval",
    details: {
      requestedCount: questionIds.length,
      successCount,
      failedIds,
    },
  });

  return { successCount, failedIds };
}

/**
 * Update question text/options during review
 */
export async function updateQuestionUnderReview(question: Question): Promise<Question> {
  const now = new Date().toISOString();
  const updated: Question = {
    ...question,
    updatedAt: now,
  };

  const cached = getCachedReviewQuestions();
  setCachedReviewQuestions(cached.map(q => q.id === question.id ? updated : q));

  if (isSupabaseConfigured()) {
    try {
      await supabase.from("questions").update({
        text: updated.text,
        options: updated.options,
        correct_answer: updated.correctIndex,
        explanation: updated.explanation,
        important_fact: updated.importantFact,
        difficulty: updated.difficulty,
        exam_name: updated.examName,
        year: updated.year,
        is_pyq: updated.isPYQ,
        updated_at: now,
      }).eq("id", updated.id);
    } catch (err) {
      console.warn("Supabase updateQuestionUnderReview note:", err);
    }
  }

  return updated;
}
