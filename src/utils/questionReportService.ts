import { supabase, isSupabaseConfigured } from "../lib/supabase";
import { triggerAdminToast } from "./adminToast";
import type { Question } from "../types";
import { safeGetSessionStorageItem, safeSetSessionStorageItem } from "./safeStorage";

export type QuestionIssueType =
  | "wrong_answer"
  | "typo"
  | "incomplete_options"
  | "wrong_explanation"
  | "ambiguous"
  | "outdated"
  | "other";

export interface QuestionReport {
  id: string;
  questionId: string;
  questionText: string;
  subjectName?: string;
  chapterName?: string;
  topicName?: string;
  studentName?: string;
  studentEmail?: string;
  studentUid?: string;
  issueType: QuestionIssueType;
  studentComment: string;
  reportedAt: string;
  status: "pending" | "resolved" | "dismissed";
  adminNotes?: string;
  resolvedAt?: string;
  sourceExam?: string;
  optionsSnapshot?: string[];
  correctIndexSnapshot?: number;
}

export const REPORTS_STORAGE_KEY = "disha2020_question_reports_v1";
export const LEGACY_REPORTS_STORAGE_KEY = "quizpro_question_reports_v1";
export const REPORTED_IDS_SESSION_KEY = "disha2020_student_reported_qids_v1";
export const REPORT_EVENT_NAME = "disha_question_reported";

export const ISSUE_TYPE_LABELS: Record<QuestionIssueType, { hi: string; en: string; description: string }> = {
  wrong_answer: {
    hi: "Wrong Answer Key",
    en: "Wrong Answer Key",
    description: "The marked correct option is incorrect; another option is the right answer.",
  },
  typo: {
    hi: "Typo / Misprint",
    en: "Typo / Misprint",
    description: "Typographical, spelling, or formatting error in question wording.",
  },
  incomplete_options: {
    hi: "Incomplete / Duplicate Options",
    en: "Incomplete / Duplicate Options",
    description: "Options are truncated, missing, or identical copies.",
  },
  wrong_explanation: {
    hi: "Inaccurate Explanation",
    en: "Inaccurate Explanation",
    description: "Explanation or solution contains incorrect or misleading facts.",
  },
  ambiguous: {
    hi: "Ambiguous Question",
    en: "Ambiguous Question",
    description: "Question phrasing is unclear or allows multiple valid answers.",
  },
  outdated: {
    hi: "Outdated Fact",
    en: "Outdated Fact",
    description: "Facts have changed according to recent data, amendments, or rules.",
  },
  other: {
    hi: "Other Issue",
    en: "Other Issue",
    description: "Other problem or objection regarding this question.",
  },
};

/**
 * Retrieve all local question reports from storage.
 */
export function getStoredReports(): QuestionReport[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(REPORTS_STORAGE_KEY) || localStorage.getItem(LEGACY_REPORTS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.warn("[QuestionReportService] Error loading local reports:", err);
    return [];
  }
}

/**
 * Save reports array into localStorage and legacy mirror.
 */
export function saveStoredReports(reports: QuestionReport[]): void {
  if (typeof window === "undefined") return;
  try {
    const serialized = JSON.stringify(reports);
    localStorage.setItem(REPORTS_STORAGE_KEY, serialized);
    localStorage.setItem(LEGACY_REPORTS_STORAGE_KEY, serialized);
  } catch (err) {
    console.warn("[QuestionReportService] Error saving reports:", err);
  }
}

/**
 * Check if the student has already reported this question in this browser session.
 */
export function hasStudentReportedQuestion(questionId: string): boolean {
  if (typeof window === "undefined" || !questionId) return false;
  try {
    const raw = safeGetSessionStorageItem(REPORTED_IDS_SESSION_KEY);
    if (raw) {
      const ids: string[] = JSON.parse(raw);
      if (ids.includes(questionId)) return true;
    }
  } catch {}

  // Also check persistent reports
  const reports = getStoredReports();
  return reports.some((r) => r.questionId === questionId && r.status === "pending");
}

/**
 * Mark question as reported in this student's session.
 */
export function markQuestionAsReported(questionId: string): void {
  if (typeof window === "undefined" || !questionId) return;
  try {
    const raw = safeGetSessionStorageItem(REPORTED_IDS_SESSION_KEY);
    const ids: string[] = raw ? JSON.parse(raw) : [];
    if (!ids.includes(questionId)) {
      ids.push(questionId);
      safeSetSessionStorageItem(REPORTED_IDS_SESSION_KEY, JSON.stringify(ids));
    }
  } catch {}
}

export interface SubmitReportInput {
  questionId: string;
  questionText: string;
  subjectName?: string;
  chapterName?: string;
  topicName?: string;
  studentName?: string;
  studentEmail?: string;
  studentUid?: string;
  issueType: QuestionIssueType;
  studentComment: string;
  sourceExam?: string;
  question?: Question;
}

/**
 * Submit an objection/report on a question from the student app.
 * Saves to local persistent storage, triggers custom events for the UI & Admin desk,
 * and attempts cloud synchronization to Supabase if accessible.
 */
export async function submitQuestionReport(input: SubmitReportInput): Promise<{
  success: boolean;
  report: QuestionReport;
  error?: string;
}> {
  try {
    if (!input.questionId || !input.questionText || !input.studentComment?.trim()) {
      return {
        success: false,
        report: {} as QuestionReport,
        error: "Question ID and student comment are required.",
      };
    }

    if (input.studentComment.trim().length > 3000) {
      return {
        success: false,
        report: {} as QuestionReport,
        error: "Objection description cannot exceed 3,000 characters.",
      };
    }

    const nowIso = new Date().toISOString();
    const id = "rep_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7);

    const report: QuestionReport = {
      id,
      questionId: input.questionId,
      questionText: input.questionText.trim(),
      subjectName: input.subjectName,
      chapterName: input.chapterName,
      topicName: input.topicName,
      studentName: input.studentName?.trim() || "Aspirant",
      studentEmail: input.studentEmail?.trim() || "",
      studentUid: input.studentUid,
      issueType: input.issueType,
      studentComment: input.studentComment.trim(),
      reportedAt: nowIso,
      status: "pending",
      sourceExam: input.sourceExam || input.question?.exam || "",
      optionsSnapshot: input.question?.options ? [...input.question.options] : undefined,
      correctIndexSnapshot: input.question?.correctIndex,
    };

    // 1. Save to local storage
    const currentReports = getStoredReports();
    const updatedReports = [report, ...currentReports.filter((r) => r.id !== id)];
    saveStoredReports(updatedReports);

    // 2. Mark in student session
    markQuestionAsReported(input.questionId);

    // 3. Dispatch in-app notification event so Admin Desk and Question Cards react immediately
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent(REPORT_EVENT_NAME, {
          detail: { report, totalPending: updatedReports.filter((r) => r.status === "pending").length },
        })
      );
    }

    // 4. Trigger top-center notification
    triggerAdminToast(
      "success",
      "Objection Submitted Successfully!",
      "Your report has been submitted. The subject matter expert team will review it shortly.",
      { category: "Question Report", itemName: `QID: ${input.questionId.slice(0, 8)}` }
    );

    // 5. Attempt graceful cloud sync to Supabase if configured (without blocking)
    if (isSupabaseConfigured()) {
      try {
        const { error: repErr } = await supabase.from("question_reports").upsert([
          {
            id: report.id,
            question_id: report.questionId,
            question_text: report.questionText,
            subject_name: report.subjectName || null,
            chapter_name: report.chapterName || null,
            topic_name: report.topicName || null,
            student_name: report.studentName,
            student_email: report.studentEmail || null,
            student_uid: report.studentUid || null,
            issue_type: report.issueType,
            student_comment: report.studentComment,
            status: "pending",
            source_exam: report.sourceExam || null,
            options_snapshot: report.optionsSnapshot || null,
            correct_index_snapshot: report.correctIndexSnapshot ?? null,
            created_at: report.reportedAt,
            updated_at: report.reportedAt,
          },
        ]);
        if (repErr) {
          console.info("[QuestionReportService] Cloud report staging notice:", repErr.message);
        }
      } catch (cloudErr) {
        console.info("[QuestionReportService] Cloud report staging fallback active:", cloudErr);
      }
    }

    return { success: true, report };
  } catch (err: any) {
    console.error("[QuestionReportService] Submission failed:", err);
    return {
      success: false,
      report: {} as QuestionReport,
      error: err?.message || "Failed to submit objection report",
    };
  }
}

/**
 * Update the status of a question report (e.g. from Admin desk).
 */
export async function updateReportStatus(
  reportId: string,
  status: "pending" | "resolved" | "dismissed",
  adminNotes?: string
): Promise<boolean> {
  try {
    const current = getStoredReports();
    const target = current.find((r) => r.id === reportId);
    if (!target) return false;

    const updated = current.map((r) => {
      if (r.id === reportId) {
        return {
          ...r,
          status,
          adminNotes: adminNotes !== undefined ? adminNotes : r.adminNotes,
          resolvedAt: status === "resolved" ? new Date().toISOString() : r.resolvedAt,
        };
      }
      return r;
    });

    saveStoredReports(updated);

    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent(REPORT_EVENT_NAME, {
          detail: { reportId, status },
        })
      );
    }

    if (isSupabaseConfigured()) {
      try {
        const { error: updErr } = await supabase
          .from("question_reports")
          .update({
            status,
            admin_notes: adminNotes,
            updated_at: new Date().toISOString(),
          })
          .eq("id", reportId);

        if (updErr) {
          console.warn("[QuestionReportService] Cloud report update error:", updErr.message);
        }
      } catch (cloudErr) {
        console.warn("[QuestionReportService] Cloud update exception:", cloudErr);
      }
    }

    return true;
  } catch (e) {
    console.error("[QuestionReportService] Error updating report status:", e);
    return false;
  }
}

/**
 * Delete a report permanently.
 */
export async function deleteReport(reportId: string): Promise<boolean> {
  try {
    const current = getStoredReports();
    const filtered = current.filter((r) => r.id !== reportId);
    saveStoredReports(filtered);

    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent(REPORT_EVENT_NAME, {
          detail: { reportId, deleted: true },
        })
      );
    }

    if (isSupabaseConfigured()) {
      try {
        const { error: delErr } = await supabase.from("question_reports").delete().eq("id", reportId);
        if (delErr) {
          console.warn("[QuestionReportService] Cloud report delete error:", delErr.message);
        }
      } catch (cloudErr) {
        console.warn("[QuestionReportService] Cloud delete exception:", cloudErr);
      }
    }

    return true;
  } catch (e) {
    console.error("[QuestionReportService] Error deleting report:", e);
    return false;
  }
}

/**
 * Fetch reports submitted by a specific student.
 * Pulls from Supabase if configured, falling back to local storage.
 */
export async function fetchStudentReports(studentUid?: string): Promise<QuestionReport[]> {
  if (isSupabaseConfigured() && studentUid) {
    try {
      const { data, error } = await supabase
        .from("question_reports")
        .select("*")
        .eq("student_uid", studentUid)
        .order("created_at", { ascending: false });
      if (!error && Array.isArray(data)) {
        return data.map((row: any) => ({
          id: row.id,
          questionId: row.question_id,
          questionText: row.question_text,
          subjectName: row.subject_name,
          chapterName: row.chapter_name,
          topicName: row.topic_name,
          studentName: row.student_name,
          studentEmail: row.student_email,
          studentUid: row.student_uid,
          issueType: row.issue_type,
          studentComment: row.student_comment,
          status: row.status,
          adminNotes: row.admin_notes,
          reportedAt: row.created_at,
          resolvedAt: row.resolved_at,
        }));
      }
    } catch (e) {
      console.warn("[QuestionReportService] Cloud fetch reports warning:", e);
    }
  }
  return getStoredReports();
}

/**
 * Fetch all question reports for the Admin Doubt Desk.
 * Synchronizes with Supabase cloud table and merges with local storage.
 */
export async function fetchAllQuestionReports(): Promise<QuestionReport[]> {
  if (isSupabaseConfigured()) {
    try {
      const { data, error } = await supabase
        .from("question_reports")
        .select("*")
        .order("created_at", { ascending: false });

      if (!error && Array.isArray(data)) {
        const cloudReports: QuestionReport[] = data.map((row: any) => ({
          id: row.id,
          questionId: row.question_id,
          questionText: row.question_text,
          subjectName: row.subject_name || undefined,
          chapterName: row.chapter_name || undefined,
          topicName: row.topic_name || undefined,
          studentName: row.student_name,
          studentEmail: row.student_email || undefined,
          studentUid: row.student_uid || undefined,
          issueType: row.issue_type,
          studentComment: row.student_comment,
          status: row.status,
          adminNotes: row.admin_notes || undefined,
          reportedAt: row.created_at,
          resolvedAt: row.resolved_at || undefined,
          sourceExam: row.source_exam || undefined,
          optionsSnapshot: row.options_snapshot || undefined,
          correctIndexSnapshot: row.correct_index_snapshot !== null && row.correct_index_snapshot !== undefined ? Number(row.correct_index_snapshot) : undefined,
        }));

        const local = getStoredReports();
        const cloudIds = new Set(cloudReports.map((r) => r.id));
        const localOnly = local.filter((r) => !cloudIds.has(r.id));
        const merged = [...cloudReports, ...localOnly].sort(
          (a, b) => new Date(b.reportedAt).getTime() - new Date(a.reportedAt).getTime()
        );

        saveStoredReports(merged);
        return merged;
      }
    } catch (err) {
      console.warn("[QuestionReportService] Cloud fetch all reports note:", err);
    }
  }

  return getStoredReports();
}

/**
 * Subscribes to Realtime question reports updates.
 */
export function subscribeToQuestionReports(callback: (reports: QuestionReport[]) => void): () => void {
  // Emit initial local reports immediately
  callback(getStoredReports());

  // Fetch fresh reports from Supabase
  fetchAllQuestionReports().then(callback).catch(() => {});

  let channel: any = null;
  if (isSupabaseConfigured()) {
    try {
      channel = supabase
        .channel("public:question_reports_changes")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "question_reports" },
          () => {
            fetchAllQuestionReports().then(callback).catch(() => {});
          }
        )
        .subscribe();
    } catch (err) {
      console.warn("[QuestionReportService] Realtime subscription error:", err);
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


