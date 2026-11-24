import { supabase, isSupabaseConfigured } from "../lib/supabase";
import { triggerAdminToast } from "./adminToast";
import type { Question } from "../types";
import { safeGetSessionStorageItem, safeSetSessionStorageItem } from "./safeStorage";
import { addNotification } from "./notificationsStorage";

export type QuestionIssueType =
  | "wrong_answer"
  | "typo"
  | "incomplete_options"
  | "wrong_explanation"
  | "ambiguous"
  | "outdated"
  | "other";

export type ObjectionStatus = "pending" | "under_review" | "resolved" | "rejected" | "dismissed";

export interface ObjectionAuditEntry {
  id: string;
  timestamp: string;
  action: "submitted" | "status_change" | "question_updated" | "admin_note_added" | "notification_sent";
  actor: string;
  previousStatus?: ObjectionStatus;
  newStatus?: ObjectionStatus;
  notes?: string;
  changesSummary?: string;
}

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
  status: ObjectionStatus;
  adminNotes?: string;
  resolvedAt?: string;
  sourceExam?: string;
  optionsSnapshot?: string[];
  correctIndexSnapshot?: number;
  explanationSnapshot?: string;
  importantFactSnapshot?: string;
  subjectIdSnapshot?: string;
  chapterIdSnapshot?: string;
  topicIdSnapshot?: string;
  examSnapshot?: string;
  yearSnapshot?: string | number;
  difficultySnapshot?: "easy" | "medium" | "hard";
  auditLogs?: ObjectionAuditEntry[];
  lastUpdatedBy?: string;
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

export const STATUS_LABELS: Record<ObjectionStatus, { hi: string; en: string; color: string; badgeBg: string }> = {
  pending: {
    hi: "लंबित (Pending)",
    en: "Pending",
    color: "text-amber-600 dark:text-amber-400",
    badgeBg: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
  },
  under_review: {
    hi: "समीक्षाधीन (Under Review)",
    en: "Under Review",
    color: "text-blue-600 dark:text-blue-400",
    badgeBg: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
  },
  resolved: {
    hi: "समाधान हुआ (Resolved)",
    en: "Resolved",
    color: "text-emerald-600 dark:text-emerald-400",
    badgeBg: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
  },
  rejected: {
    hi: "अस्वीकृत (Rejected)",
    en: "Rejected",
    color: "text-rose-600 dark:text-rose-400",
    badgeBg: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20",
  },
  dismissed: {
    hi: "अस्वीकृत (Rejected)",
    en: "Rejected",
    color: "text-slate-500 dark:text-slate-400",
    badgeBg: "bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20",
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
    const q = input.question;

    const initialAuditEntry: ObjectionAuditEntry = {
      id: `log_${Date.now()}_init`,
      timestamp: nowIso,
      action: "submitted",
      actor: input.studentName?.trim() || "Student",
      newStatus: "pending",
      notes: `Report submitted for: ${ISSUE_TYPE_LABELS[input.issueType]?.en || input.issueType}. "${input.studentComment.slice(0, 100)}"`,
    };

    const report: QuestionReport = {
      id,
      questionId: input.questionId,
      questionText: input.questionText.trim(),
      subjectName: input.subjectName || q?.subjectId,
      chapterName: input.chapterName || q?.chapterId,
      topicName: input.topicName || q?.topicId,
      studentName: input.studentName?.trim() || "Aspirant",
      studentEmail: input.studentEmail?.trim() || "",
      studentUid: input.studentUid,
      issueType: input.issueType,
      studentComment: input.studentComment.trim(),
      reportedAt: nowIso,
      status: "pending",
      sourceExam: input.sourceExam || q?.exam || "",
      optionsSnapshot: q?.options ? [...q.options] : undefined,
      correctIndexSnapshot: q?.correctIndex,
      explanationSnapshot: q?.explanation,
      importantFactSnapshot: q?.importantFact,
      subjectIdSnapshot: q?.subjectId,
      chapterIdSnapshot: q?.chapterId,
      topicIdSnapshot: q?.topicId,
      examSnapshot: q?.exam,
      yearSnapshot: q?.year,
      difficultySnapshot: q?.difficulty,
      auditLogs: [initialAuditEntry],
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
        const baseRow: any = {
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
        };

        const { error: repErr } = await supabase.from("question_reports").upsert([
          {
            ...baseRow,
            audit_logs: report.auditLogs ? JSON.stringify(report.auditLogs) : null,
          },
        ]);
        if (repErr) {
          if (repErr.message.includes("audit_logs") || repErr.message.includes("schema cache")) {
            await supabase.from("question_reports").upsert([baseRow]).catch(() => {});
          } else {
            console.info("[QuestionReportService] Cloud report staging notice:", repErr.message);
          }
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
 * Send in-app notification to the reporting student regarding their objection status.
 */
export async function notifyStudentOnObjectionAction(params: {
  report: QuestionReport;
  status: ObjectionStatus;
  adminNotes?: string;
  updatedQuestion?: Question;
}): Promise<void> {
  const { report, status, adminNotes } = params;
  const isResolved = status === "resolved";
  const isUnderReview = status === "under_review";
  const isRejected = status === "rejected" || status === "dismissed";

  let title = "Objection Status Update";
  let hindiTitle = "आपत्ति स्थिति अपडेट";
  let message = `Your objection for question ID "${report.questionId.slice(0, 8)}" has been updated to ${status}.`;
  let hindiMessage = `आपके द्वारा प्रश्न ID "${report.questionId.slice(0, 8)}" पर दर्ज आपत्ति की स्थिति अपडेट कर दी गई है।`;

  if (isResolved) {
    title = "✅ Objection Resolved & Question Updated";
    hindiTitle = "✅ प्रश्न आपत्ति स्वीकृत एवं संशोधित";
    message = `Your reported objection has been accepted. The question bank has been updated with verified answers and explanations.${adminNotes ? ` Admin note: ${adminNotes}` : ""}`;
    hindiMessage = `आपके द्वारा उठाई गई आपत्ति को सही पाया गया तथा प्रश्न बैंक में आधिकारिक उत्तर व व्याख्या संशोधित कर दी गई है।${adminNotes ? ` व्यवस्थापक नोट: ${adminNotes}` : ""}`;
  } else if (isUnderReview) {
    title = "🔍 Objection Under Subject Expert Review";
    hindiTitle = "🔍 आपकी आपत्ति विषय विशेषज्ञों द्वारा समीक्षाधीन";
    message = `Your reported question has been flagged and is currently being audited by our subject expert panel.${adminNotes ? ` Admin note: ${adminNotes}` : ""}`;
    hindiMessage = `आपके द्वारा रिपोर्ट किए गए प्रश्न को जांच हेतु स्वीकार कर लिया गया है। वर्तमान में विषय विशेषज्ञ इसकी प्रामाणिक स्रोतों से समीक्षा कर रहे हैं।${adminNotes ? ` नोट: ${adminNotes}` : ""}`;
  } else if (isRejected) {
    title = "ℹ️ Objection Review Concluded";
    hindiTitle = "ℹ️ आपत्ति समीक्षा पूर्ण (आधिकारिक उत्तर यथावत)";
    message = `After cross-checking with official exam answer keys and textbooks, the existing question was confirmed to be valid.${adminNotes ? ` Note: ${adminNotes}` : ""}`;
    hindiMessage = `आधिकारिक बोर्ड उत्तर कुंजी तथा मानक संदर्भ पुस्तकों से मिलान के उपरांत प्रश्न एवं विकल्प मान्य पाए गए।${adminNotes ? ` नोट: ${adminNotes}` : ""}`;
  }

  // 1. Local student notification
  addNotification({
    title,
    hindiTitle,
    message,
    hindiMessage,
    category: "study",
    priority: isResolved ? "high" : "normal",
    actionType: "open_tab",
    actionData: {
      tab: "notifications",
      sessionTitle: "Question Doubt Desk",
    },
  });

  // 2. Cloud broadcast notification if Supabase connected
  if (isSupabaseConfigured()) {
    try {
      await supabase.from("broadcast_notifications").insert({
        id: `notif_obj_${report.id}_${Date.now()}`,
        title,
        hindi_title: hindiTitle,
        message,
        hindi_message: hindiMessage,
        category: "study",
        priority: isResolved ? "high" : "normal",
        target_exam: report.sourceExam || "all",
        action_type: "open_tab",
        action_payload: { reportId: report.id, questionId: report.questionId },
        sent_by: "Doubt Desk Admin",
        created_at: new Date().toISOString(),
        is_active: true,
      });
    } catch (cloudErr) {
      console.info("[QuestionReportService] Notice on student broadcast staging:", cloudErr);
    }
  }
}

/**
 * Update the status of a question report with comprehensive audit log tracking.
 */
export async function updateReportStatus(
  reportId: string,
  status: ObjectionStatus,
  adminNotes?: string,
  options?: {
    actor?: string;
    auditAction?: ObjectionAuditEntry["action"];
    changesSummary?: string;
    notifyStudent?: boolean;
    updatedQuestion?: Question;
  }
): Promise<boolean> {
  try {
    const current = getStoredReports();
    const target = current.find((r) => r.id === reportId);
    if (!target) return false;

    const nowIso = new Date().toISOString();
    const actor = options?.actor || "Admin Desk";
    const auditAction = options?.auditAction || "status_change";

    const auditEntry: ObjectionAuditEntry = {
      id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      timestamp: nowIso,
      action: auditAction,
      actor,
      previousStatus: target.status,
      newStatus: status,
      notes: adminNotes !== undefined ? adminNotes : target.adminNotes,
      changesSummary: options?.changesSummary,
    };

    const existingLogs = target.auditLogs && Array.isArray(target.auditLogs) ? target.auditLogs : [];
    const updatedAuditLogs = [...existingLogs, auditEntry];

    const updated = current.map((r) => {
      if (r.id === reportId) {
        return {
          ...r,
          status,
          adminNotes: adminNotes !== undefined ? adminNotes : r.adminNotes,
          resolvedAt: status === "resolved" ? nowIso : r.resolvedAt,
          auditLogs: updatedAuditLogs,
          lastUpdatedBy: actor,
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

    // Automatically send notification to the student if status changed or requested
    if (options?.notifyStudent !== false && status !== "pending") {
      try {
        await notifyStudentOnObjectionAction({
          report: target,
          status,
          adminNotes,
          updatedQuestion: options?.updatedQuestion,
        });
      } catch (err) {
        console.warn("[QuestionReportService] Notification dispatch warning:", err);
      }
    }

    if (isSupabaseConfigured()) {
      try {
        const cloudStatus = status === "rejected" ? "dismissed" : status;
        const { error: updErr } = await supabase
          .from("question_reports")
          .update({
            status: cloudStatus,
            admin_notes: adminNotes,
            updated_at: nowIso,
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
          status: row.status === "dismissed" ? "rejected" : (row.status as ObjectionStatus),
          adminNotes: row.admin_notes,
          reportedAt: row.created_at,
          resolvedAt: row.resolved_at,
          auditLogs: Array.isArray(row.audit_logs)
            ? row.audit_logs
            : typeof row.audit_logs === "string"
            ? JSON.parse(row.audit_logs)
            : undefined,
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
        const cloudReports: QuestionReport[] = data.map((row: any) => {
          let parsedAudit: ObjectionAuditEntry[] | undefined;
          if (Array.isArray(row.audit_logs)) {
            parsedAudit = row.audit_logs;
          } else if (typeof row.audit_logs === "string") {
            try {
              parsedAudit = JSON.parse(row.audit_logs);
            } catch {}
          }

          return {
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
            status: row.status === "dismissed" ? "rejected" : (row.status as ObjectionStatus),
            adminNotes: row.admin_notes || undefined,
            reportedAt: row.created_at,
            resolvedAt: row.resolved_at || undefined,
            sourceExam: row.source_exam || undefined,
            optionsSnapshot: row.options_snapshot || undefined,
            correctIndexSnapshot:
              row.correct_index_snapshot !== null && row.correct_index_snapshot !== undefined
                ? Number(row.correct_index_snapshot)
                : undefined,
            auditLogs: parsedAudit,
          };
        });

        const local = getStoredReports();
        const cloudMap = new Map(cloudReports.map((r) => [r.id, r]));

        // Merge keeping local audit logs if newer or cloud lacks them
        const merged = [
          ...cloudReports.map((c) => {
            const l = local.find((loc) => loc.id === c.id);
            if (l && l.auditLogs && (!c.auditLogs || l.auditLogs.length > c.auditLogs.length)) {
              return { ...c, auditLogs: l.auditLogs };
            }
            return c;
          }),
          ...local.filter((r) => !cloudMap.has(r.id)),
        ].sort((a, b) => new Date(b.reportedAt).getTime() - new Date(a.reportedAt).getTime());

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
 * Fetch authoritative question data from all active storage engines.
 * NO DUMMY DATA. Searches passed array, user questions store, localStorage caches,
 * bundled syllabus, IndexedDB, and Supabase cloud.
 */
export async function fetchAuthoritativeQuestion(
  questionId: string,
  reportFallback?: Partial<QuestionReport>,
  passedQuestions: Question[] = []
): Promise<Question> {
  if (!questionId) {
    return {
      id: "unknown",
      text: reportFallback?.questionText || "",
      options: ["", "", "", "", "अनुत्तरित प्रश्न"],
      correctIndex: 0,
      explanation: "",
      chapterId: "",
      topicId: "",
    };
  }

  // 1. Check passed array
  const inPassed = passedQuestions.find((q) => q.id === questionId);
  if (inPassed && Array.isArray(inPassed.options) && inPassed.options.length >= 2) {
    return inPassed;
  }

  // 2. Check in-memory / local storage user questions store
  try {
    const { loadUserQuestionsStore } = await import("./questionsStorage");
    const store = loadUserQuestionsStore();
    if (store.editedQuestions && store.editedQuestions[questionId]) {
      return store.editedQuestions[questionId];
    }
    const inCustom = (store.customQuestions || []).find((q) => q.id === questionId);
    if (inCustom && Array.isArray(inCustom.options) && inCustom.options.length >= 2) {
      return inCustom;
    }

    const inCloudCache = (store.cloudCacheQuestions || []).find((q) => q.id === questionId);
    if (inCloudCache && Array.isArray(inCloudCache.options) && inCloudCache.options.length >= 2) {
      return inCloudCache;
    }

    for (const ch of store.customChapters || []) {
      for (const top of ch.topics || []) {
        const inTop = (top.questions || []).find((q) => q.id === questionId);
        if (inTop && Array.isArray(inTop.options) && inTop.options.length >= 2) {
          return inTop;
        }
      }
    }
  } catch (_) {}

  // 3. Check individual MCQ local storage cache
  try {
    const cachedRaw =
      localStorage.getItem(`disha2020_mcq_${questionId}`) ||
      localStorage.getItem(`quizpro_mcq_${questionId}`);
    if (cachedRaw) {
      const parsed = JSON.parse(cachedRaw);
      if (parsed && Array.isArray(parsed.options) && parsed.options.length >= 2) {
        return parsed;
      }
    }
  } catch (_) {}

  // 4. Check CHAPTERS_DATA bundled database
  try {
    const { CHAPTERS_DATA } = await import("../data/questions");
    for (const ch of CHAPTERS_DATA || []) {
      for (const top of ch.topics || []) {
        const inData = (top.questions || []).find((q) => q.id === questionId);
        if (inData && Array.isArray(inData.options) && inData.options.length >= 2) {
          return inData;
        }
      }
    }
  } catch (_) {}

  // 5. Check IndexedDB
  try {
    const { openLocalDatabase, idbGet, STORES } = await import("./localDatabaseEngine");
    await openLocalDatabase();
    const idbQ = await idbGet(STORES.MCQS, questionId);
    if (idbQ && Array.isArray(idbQ.options) && idbQ.options.length >= 2) {
      return idbQ;
    }
  } catch (_) {}

  // 6. Check Supabase questions table
  if (isSupabaseConfigured()) {
    try {
      const { data, error } = await supabase
        .from("questions")
        .select("*")
        .eq("id", questionId)
        .maybeSingle();

      if (!error && data) {
        const qText = data.question || data.text || "";
        const qOpts = Array.isArray(data.options) ? data.options : [];
        const qAns =
          typeof data.correct_answer === "number"
            ? data.correct_answer
            : typeof data.correctIndex === "number"
            ? data.correctIndex
            : 0;
        return {
          id: data.id,
          text: qText,
          options: qOpts.length >= 2 ? qOpts : ["", "", "", "", "अनुत्तरित प्रश्न"],
          correctIndex: qAns,
          explanation: data.explanation || "",
          importantFact: data.important_fact || data.importantFact || undefined,
          subjectId: data.subject_id || data.subjectId || undefined,
          chapterId: data.chapter_id || data.chapterId || undefined,
          topicId: data.topic_id || data.topicId || undefined,
          difficulty: data.level || data.difficulty || "medium",
          exam: data.exam || undefined,
          year: data.year || undefined,
          createdAt: data.created_at,
          updatedAt: data.updated_at,
        };
      }
    } catch (_) {}
  }

  // 7. Check fallback snapshot from QuestionReport
  if (
    reportFallback?.optionsSnapshot &&
    Array.isArray(reportFallback.optionsSnapshot) &&
    reportFallback.optionsSnapshot.length >= 2
  ) {
    return {
      id: questionId,
      text: reportFallback.questionText || "",
      options: [...reportFallback.optionsSnapshot],
      correctIndex: reportFallback.correctIndexSnapshot ?? 0,
      explanation: reportFallback.explanationSnapshot || "",
      importantFact: reportFallback.importantFactSnapshot || "",
      subjectId: reportFallback.subjectIdSnapshot || "",
      chapterId: reportFallback.chapterIdSnapshot || "",
      topicId: reportFallback.topicIdSnapshot || "",
      exam: reportFallback.examSnapshot || reportFallback.sourceExam || "",
      year: reportFallback.yearSnapshot || "",
      difficulty: reportFallback.difficultySnapshot || "medium",
    };
  }

  // 8. Default clean template (never dummy strings)
  return {
    id: questionId,
    text: reportFallback?.questionText || "",
    options: ["", "", "", "", "अनुत्तरित प्रश्न"],
    correctIndex: 0,
    explanation: "",
    importantFact: "",
    chapterId: "",
    topicId: "",
  };
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


