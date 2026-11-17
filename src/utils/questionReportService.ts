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
    hi: "गलत उत्तर कुंजी (Wrong Answer Key)",
    en: "Wrong Answer Key",
    description: "दिए गए उत्तर में त्रुटि है, सही उत्तर दूसरा विकल्प है।",
  },
  typo: {
    hi: "प्रश्न में अशुद्धि / टाइपिंग एरर (Typo / Misprint)",
    en: "Typo / Misprint",
    description: "प्रश्न की भाषा, वर्तनी या टाइपिंग में मिसप्रिंटिंग है।",
  },
  incomplete_options: {
    hi: "अपूर्ण या गलत विकल्प (Incomplete / Duplicate Options)",
    en: "Incomplete / Duplicate Options",
    description: "विकल्प आधे-अधूरे हैं, गायब हैं या दो विकल्प एक जैसे हैं।",
  },
  wrong_explanation: {
    hi: "व्याख्या में त्रुटि (Inaccurate Explanation)",
    en: "Inaccurate Explanation",
    description: "प्रश्न की व्याख्या/सॉल्यूशन में तथ्य गलत या भ्रामक हैं।",
  },
  ambiguous: {
    hi: "द्वयर्थी / अस्पष्ट प्रश्न (Ambiguous Question)",
    en: "Ambiguous Question",
    description: "प्रश्न की भाषा स्पष्ट नहीं है या कई उत्तर संभव प्रतीत होते हैं।",
  },
  outdated: {
    hi: "पुराना / अप्रचलित तथ्य (Outdated Fact / Current Affairs)",
    en: "Outdated Fact",
    description: "नवीनतम आंकड़ों, नियमों या संशोधन के अनुसार तथ्य बदल चुका है।",
  },
  other: {
    hi: "अन्य आपत्ति / दावा (Other Issue)",
    en: "Other Issue",
    description: "प्रश्न में किसी अन्य प्रकार की समस्या या आपत्ति है।",
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
    const nowIso = new Date().toISOString();
    const id = "rep_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7);

    const report: QuestionReport = {
      id,
      questionId: input.questionId,
      questionText: input.questionText.trim(),
      subjectName: input.subjectName,
      chapterName: input.chapterName,
      topicName: input.topicName,
      studentName: input.studentName?.trim() || "विद्यार्थी (Aspirant)",
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
      "आपत्ति सफलतापूर्वक दर्ज की गई!",
      "आपकी रिपोर्ट सबमिट हो चुकी है। विषय विशेषज्ञ टीम इसका शीघ्र सत्यापन करेगी।",
      { category: "Question Report", itemName: `QID: ${input.questionId.slice(0, 8)}` }
    );

    // 5. Attempt graceful cloud sync to Supabase if configured (without blocking)
    if (isSupabaseConfigured()) {
      try {
        await supabase.from("question_reports").insert([
          {
            id: report.id,
            question_id: report.questionId,
            question_text: report.questionText,
            subject_name: report.subjectName,
            chapter_name: report.chapterName,
            topic_name: report.topicName,
            student_name: report.studentName,
            student_email: report.studentEmail,
            student_uid: report.studentUid,
            issue_type: report.issueType,
            student_comment: report.studentComment,
            status: "pending",
            created_at: report.reportedAt,
          },
        ]);
      } catch (cloudErr) {
        // Table may not exist yet or user is offline — local report is already saved and completely safe
        console.info("[QuestionReportService] Cloud report staging fallback active:", cloudErr);
      }
    }

    return { success: true, report };
  } catch (err: any) {
    console.error("[QuestionReportService] Submission failed:", err);
    return {
      success: false,
      report: {} as QuestionReport,
      error: err?.message || "रिपोर्ट सबमिट करने में त्रुटि हुई",
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
        await supabase
          .from("question_reports")
          .update({
            status,
            admin_notes: adminNotes,
            updated_at: new Date().toISOString(),
          })
          .eq("id", reportId);
      } catch {}
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
        await supabase.from("question_reports").delete().eq("id", reportId);
      } catch {}
    }

    return true;
  } catch (e) {
    console.error("[QuestionReportService] Error deleting report:", e);
    return false;
  }
}
