import * as React from "react";
import {
  AlertCircle,
  CheckCircle2,
  XCircle,
  Search,
  Filter,
  RefreshCw,
  Clock,
  User,
  BookOpen,
  Edit3,
  Check,
  ChevronDown,
  Trash2,
  ExternalLink,
  MessageSquare,
  Plus,
  Minus,
  Save,
  Bell,
  History,
  ShieldCheck,
  HelpCircle,
  Sparkles,
  ArrowRight,
  Send,
  Loader2,
} from "lucide-react";
import { Question, Subject, Chapter, UserQuestionsStore } from "../../types";
import {
  QuestionReport,
  ObjectionStatus,
  ObjectionAuditEntry,
  getStoredReports,
  fetchAllQuestionReports,
  subscribeToQuestionReports,
  saveStoredReports,
  updateReportStatus,
  deleteReport,
  fetchAuthoritativeQuestion,
  notifyStudentOnObjectionAction,
  ISSUE_TYPE_LABELS,
  STATUS_LABELS,
  REPORT_EVENT_NAME,
} from "../../utils/questionReportService";
import {
  editQuestionInStore,
  saveUserQuestionsStore,
  loadUserQuestionsStore,
  getCombinedQuestions,
} from "../../utils/questionsStorage";
import { triggerAdminToast, triggerDatabaseSavedToast } from "../../utils/adminToast";
import { loadUserProfile } from "../../utils/userProfileStorage";

export type { QuestionReport };

interface QuestionReportDeskProps {
  questions?: Question[];
  subjects?: Subject[];
  chapters?: Chapter[];
  questionsStore?: UserQuestionsStore;
  onUpdateQuestion?: (updatedQuestion: Question) => void;
  onStoreUpdated?: (updatedStore: UserQuestionsStore) => void;
}

export const QuestionReportDesk: React.FC<QuestionReportDeskProps> = ({
  questions = [],
  subjects = [],
  chapters = [],
  questionsStore,
  onUpdateQuestion,
  onStoreUpdated,
}) => {
  const [reports, setReports] = React.useState<QuestionReport[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [filterStatus, setFilterStatus] = React.useState<"all" | ObjectionStatus>("all");
  const [searchTerm, setSearchTerm] = React.useState("");
  const [filterIssueType, setFilterIssueType] = React.useState<string>("all");

  // Full Question Editor Modal State
  const [editingReport, setEditingReport] = React.useState<QuestionReport | null>(null);
  const [isLoadingQuestion, setIsLoadingQuestion] = React.useState(false);

  // Editable question fields
  const [qText, setQText] = React.useState<string>("");
  const [qOptions, setQOptions] = React.useState<string[]>(["", "", "", ""]);
  const [qCorrectIndex, setQCorrectIndex] = React.useState<number>(0);
  const [qExplanation, setQExplanation] = React.useState<string>("");
  const [qImportantFacts, setQImportantFacts] = React.useState<string>("");
  const [qSubjectId, setQSubjectId] = React.useState<string>("");
  const [qChapterId, setQChapterId] = React.useState<string>("");
  const [qTopicId, setQTopicId] = React.useState<string>("");
  const [qDifficulty, setQDifficulty] = React.useState<"easy" | "medium" | "hard">("medium");

  // Objection resolution state
  const [targetStatus, setTargetStatus] = React.useState<ObjectionStatus>("resolved");
  const [adminNotes, setAdminNotes] = React.useState<string>("");
  const [notifyStudent, setNotifyStudent] = React.useState<boolean>(true);
  const [isSaving, setIsSaving] = React.useState<boolean>(false);
  const [originalQuestion, setOriginalQuestion] = React.useState<Question | null>(null);

  // Reject / Dismiss note dialog state
  const [quickActionReport, setQuickActionReport] = React.useState<{
    report: QuestionReport;
    action: "under_review" | "rejected" | "dismissed";
  } | null>(null);
  const [quickActionNote, setQuickActionNote] = React.useState<string>("");
  const [isQuickActionProcessing, setIsQuickActionProcessing] = React.useState<boolean>(false);

  // Load reports from Supabase Cloud with Realtime listener
  const fetchReports = async () => {
    setLoading(true);
    try {
      const loaded = await fetchAllQuestionReports();
      setReports(loaded);
    } catch (e) {
      console.warn("Using local report buffer", e);
      setReports(getStoredReports());
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    fetchReports();
    const unsubscribe = subscribeToQuestionReports((freshReports) => {
      setReports(freshReports);
      setLoading(false);
    });

    const handleReportLiveEvent = () => {
      fetchReports();
    };

    window.addEventListener(REPORT_EVENT_NAME, handleReportLiveEvent);
    return () => {
      unsubscribe();
      window.removeEventListener(REPORT_EVENT_NAME, handleReportLiveEvent);
    };
  }, []);

  // Quick Status Transition (e.g. Mark Under Review, Reject, Dismiss)
  const handleExecuteQuickAction = async () => {
    if (!quickActionReport) return;
    const { report, action } = quickActionReport;
    setIsQuickActionProcessing(true);

    try {
      const adminEmail = loadUserProfile()?.email || "Admin";
      await updateReportStatus(report.id, action, quickActionNote.trim() || undefined, {
        adminEmail,
        studentUid: report.studentUid,
        studentEmail: report.studentEmail,
        questionId: report.questionId,
        questionText: report.questionText,
      });

      // Update in local state
      setReports((prev) =>
        prev.map((r) =>
          r.id === report.id
            ? {
                ...r,
                status: action,
                adminNotes: quickActionNote.trim() || r.adminNotes,
              }
            : r
        )
      );

      triggerAdminToast(
        action === "under_review"
          ? "आपत्ति की समीक्षा शुरू की गई (Under Review)"
          : action === "rejected"
          ? "आपत्ति अस्वीकार कर दी गई (Rejected)"
          : "आपत्ति खारिज कर दी गई (Dismissed)",
        "info"
      );

      setQuickActionReport(null);
      setQuickActionNote("");
    } catch (err: any) {
      triggerAdminToast(`कार्यवाही असफल: ${err?.message || "अज्ञात"}`, "error");
    } finally {
      setIsQuickActionProcessing(false);
    }
  };

  const handleDeleteReport = async (reportId: string) => {
    if (!confirm("क्या आप वाकई इस आपत्ति रिकॉर्ड को हटाना चाहते हैं?")) return;
    await deleteReport(reportId);
    setReports((prev) => prev.filter((r) => r.id !== reportId));
    triggerAdminToast("आपत्ति रिकॉर्ड हटा दिया गया।", "info");
  };

  // Open Full Question Editor with Real Question Data Binding
  const handleOpenEditor = async (report: QuestionReport) => {
    setEditingReport(report);
    setIsLoadingQuestion(true);
    setTargetStatus(report.status === "pending" || report.status === "under_review" ? "resolved" : report.status);
    setAdminNotes(report.adminNotes || "");
    setNotifyStudent(true);

    try {
      // 1. Fetch real authoritative question
      const targetQ = await fetchAuthoritativeQuestion(report.questionId, report, questions);

      setOriginalQuestion(targetQ);
      setQText(targetQ.text || report.questionText || "");
      const loadedOpts =
        Array.isArray(targetQ.options) && targetQ.options.length >= 2
          ? [...targetQ.options]
          : Array.isArray(report.optionsSnapshot) && report.optionsSnapshot.length >= 2
          ? [...report.optionsSnapshot]
          : ["विकल्प A", "विकल्प B", "विकल्प C", "विकल्प D"];

      setQOptions(loadedOpts);
      setQCorrectIndex(
        typeof targetQ.correctIndex === "number" && targetQ.correctIndex >= 0 && targetQ.correctIndex < loadedOpts.length
          ? targetQ.correctIndex
          : typeof report.correctIndexSnapshot === "number"
          ? report.correctIndexSnapshot
          : 0
      );
      setQExplanation(targetQ.explanation || report.explanationSnapshot || "");
      setQImportantFacts(targetQ.importantFacts || report.importantFactSnapshot || "");
      setQSubjectId(targetQ.subjectId || report.subjectIdSnapshot || "");
      setQChapterId(targetQ.chapterId || report.chapterIdSnapshot || "");
      setQTopicId(targetQ.topicId || report.topicIdSnapshot || "");
      setQDifficulty(targetQ.difficulty || report.difficultySnapshot || "medium");
    } catch (err: any) {
      triggerAdminToast("प्रश्न लोड करने में त्रुटि", "error");
    } finally {
      setIsLoadingQuestion(false);
    }
  };

  // Option operations
  const handleOptionChange = (index: number, val: string) => {
    setQOptions((prev) => {
      const next = [...prev];
      next[index] = val;
      return next;
    });
  };

  const handleAddOption = () => {
    if (qOptions.length >= 6) return;
    setQOptions((prev) => [...prev, `विकल्प ${String.fromCharCode(65 + prev.length)}`]);
  };

  const handleRemoveOption = (index: number) => {
    if (qOptions.length <= 2) return;
    setQOptions((prev) => prev.filter((_, idx) => idx !== index));
    if (qCorrectIndex >= index && qCorrectIndex > 0) {
      setQCorrectIndex((prev) => prev - 1);
    }
  };

  // Save changes & synchronize with cloud + local store
  const handleSaveQuestionAndResolve = async () => {
    if (!editingReport) return;
    if (!qText.trim()) {
      alert("कृपया प्रश्न का विवरण दर्ज करें।");
      return;
    }
    if (qOptions.some((opt) => !opt.trim())) {
      alert("कोई भी विकल्प खाली नहीं होना चाहिए।");
      return;
    }

    setIsSaving(true);
    try {
      const nowIso = new Date().toISOString();
      const adminEmail = loadUserProfile()?.email || "Super Admin";

      const updatedQuestion: Question = {
        ...(originalQuestion || { id: editingReport.questionId }),
        id: editingReport.questionId,
        text: qText.trim(),
        options: qOptions.map((o) => o.trim()),
        correctIndex: qCorrectIndex,
        explanation: qExplanation.trim(),
        importantFacts: qImportantFacts.trim(),
        subjectId: qSubjectId || undefined,
        chapterId: qChapterId || undefined,
        topicId: qTopicId || undefined,
        difficulty: qDifficulty,
        updatedAt: nowIso,
        updated_at: nowIso,
      };

      // 1. Update in authoritative store
      const currentStore = questionsStore || loadUserQuestionsStore();
      const updatedStore = editQuestionInStore(currentStore, updatedQuestion);
      saveUserQuestionsStore(updatedStore);

      if (onStoreUpdated) {
        onStoreUpdated(updatedStore);
      }
      if (onUpdateQuestion) {
        onUpdateQuestion(updatedQuestion);
      }

      // 2. Update report status and add audit entry
      await updateReportStatus(editingReport.id, targetStatus, adminNotes.trim() || undefined, {
        adminEmail,
        studentUid: editingReport.studentUid,
        studentEmail: editingReport.studentEmail,
        questionId: editingReport.questionId,
        questionText: qText.trim(),
      });

      // 3. Notify student if checked
      if (notifyStudent && editingReport.studentUid) {
        await notifyStudentOnObjectionAction({
          studentUid: editingReport.studentUid,
          questionId: editingReport.questionId,
          action: targetStatus,
          adminNotes: adminNotes.trim(),
        });
      }

      // 4. Update local state
      setReports((prev) =>
        prev.map((r) =>
          r.id === editingReport.id
            ? {
                ...r,
                status: targetStatus,
                adminNotes: adminNotes.trim() || r.adminNotes,
                resolvedAt: targetStatus === "resolved" ? nowIso : r.resolvedAt,
              }
            : r
        )
      );

      triggerAdminToast("प्रश्न सफलतापूर्वक अपडेट व आपत्ति का समाधान हो गया!", "success");
      setEditingReport(null);
      setOriginalQuestion(null);
    } catch (err: any) {
      triggerAdminToast(`सुरक्षित करने में त्रुटि: ${err?.message || "अज्ञात"}`, "error");
    } finally {
      setIsSaving(false);
    }
  };

  // Filtered reports
  const filteredReports = React.useMemo(() => {
    return reports.filter((r) => {
      if (filterStatus !== "all" && r.status !== filterStatus) return false;
      if (filterIssueType !== "all" && r.issueType !== filterIssueType) return false;
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase().trim();
        return (
          (r.questionText && r.questionText.toLowerCase().includes(term)) ||
          (r.studentComment && r.studentComment.toLowerCase().includes(term)) ||
          (r.studentName && r.studentName.toLowerCase().includes(term)) ||
          (r.questionId && r.questionId.toLowerCase().includes(term))
        );
      }
      return true;
    });
  }, [reports, filterStatus, filterIssueType, searchTerm]);

  const pendingCount = reports.filter((r) => r.status === "pending").length;
  const underReviewCount = reports.filter((r) => r.status === "under_review").length;
  const resolvedCount = reports.filter((r) => r.status === "resolved").length;

  return (
    <div className="space-y-4">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-amber-500/5 border border-amber-500/20 rounded-3xl p-4 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3 sm:gap-4">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
            <AlertCircle className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                Student Objection & Question Correction Desk
              </h3>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-amber-500 text-white">
                {pendingCount} लंबित (Pending)
              </span>
              {underReviewCount > 0 && (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-blue-500 text-white">
                  {underReviewCount} समीक्षाधीन
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-xl">
              छात्रों द्वारा रिपोर्ट की गई आपत्तियों की समीक्षा करें, वास्तविक प्रश्न बैंक में सीधे सुधार करें और छात्र को समाधान की सूचना भेजें।
            </p>
          </div>
        </div>

        <button
          onClick={fetchReports}
          className="px-3.5 py-2 rounded-xl text-xs font-bold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2 self-start sm:self-auto cursor-pointer transition-colors shadow-xs"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          <span>रिफ्रेश आपत्तियां</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-white dark:bg-[#111A2E] p-3 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="प्रश्न, आईडी, छात्र का नाम या टिप्पणी खोजें..."
            className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-xl text-xs font-medium text-slate-800 dark:text-slate-200 focus:outline-hidden focus:ring-2 focus:ring-amber-500"
          />
        </div>

        {/* Issue type filter */}
        <div className="flex items-center gap-2">
          <select
            value={filterIssueType}
            onChange={(e) => setFilterIssueType(e.target.value)}
            className="px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 focus:outline-hidden focus:ring-2 focus:ring-amber-500 cursor-pointer"
          >
            <option value="all">सभी समस्या प्रकार</option>
            {Object.entries(ISSUE_TYPE_LABELS).map(([key, val]) => (
              <option key={key} value={key}>
                {val.hi} ({val.en})
              </option>
            ))}
          </select>

          {/* Status tabs */}
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-900 p-1 rounded-xl">
            {(["all", "pending", "under_review", "resolved", "rejected"] as const).map((st) => (
              <button
                key={st}
                onClick={() => setFilterStatus(st)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold capitalize transition-all cursor-pointer ${
                  filterStatus === st
                    ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs"
                    : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                }`}
              >
                {st === "all"
                  ? "सभी"
                  : st === "pending"
                  ? "लंबित"
                  : st === "under_review"
                  ? "रिव्यू"
                  : st === "resolved"
                  ? "समाधान"
                  : "अस्वीकार"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* List of Reports */}
      {filteredReports.length === 0 ? (
        <div className="bg-white dark:bg-[#111A2E] rounded-3xl border border-slate-200/80 dark:border-slate-800 p-12 text-center text-slate-400">
          <CheckCircle2 className="w-12 h-12 mx-auto text-emerald-500 mb-2 opacity-60" />
          <h4 className="text-base font-bold text-slate-700 dark:text-slate-300">
            कोई आपत्ति नहीं मिली
          </h4>
          <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
            {filterStatus === "pending"
              ? "बहुत बढ़िया! वर्तमान में सभी छात्र आपत्तियां सुलझाई जा चुकी हैं।"
              : "वर्तमान फ़िल्टर के अनुसार कोई आपत्ति रिकॉर्ड मौजूद नहीं है।"}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredReports.map((report) => {
            const isPending = report.status === "pending";
            const isUnderReview = report.status === "under_review";
            const isResolved = report.status === "resolved";
            const isRejected = report.status === "rejected";

            return (
              <div
                key={report.id}
                className={`bg-white dark:bg-[#111A2E] rounded-2xl border p-4 sm:p-5 transition-all shadow-xs ${
                  isPending
                    ? "border-amber-300 dark:border-amber-900/60 hover:border-amber-500"
                    : isUnderReview
                    ? "border-blue-300 dark:border-blue-900/60"
                    : "border-slate-200/80 dark:border-slate-800"
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-2 flex-wrap text-xs">
                    <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300">
                      #{report.questionId}
                    </span>

                    <span
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider ${
                        report.issueType === "wrong_answer"
                          ? "bg-rose-500/10 text-rose-600 border border-rose-500/20"
                          : report.issueType === "typo"
                          ? "bg-amber-500/10 text-amber-600 border border-amber-500/20"
                          : report.issueType === "incomplete_options"
                          ? "bg-purple-500/10 text-purple-600 border border-purple-500/20"
                          : report.issueType === "wrong_explanation"
                          ? "bg-indigo-500/10 text-indigo-600 border border-indigo-500/20"
                          : "bg-blue-500/10 text-blue-600 border border-blue-500/20"
                      }`}
                    >
                      {ISSUE_TYPE_LABELS[report.issueType]?.hi || report.issueType.replace("_", " ")}
                    </span>

                    <span
                      className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                        isPending
                          ? "bg-amber-500/20 text-amber-600 dark:text-amber-400"
                          : isUnderReview
                          ? "bg-blue-500/20 text-blue-600 dark:text-blue-400"
                          : isResolved
                          ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                          : "bg-rose-500/20 text-rose-600 dark:text-rose-400"
                      }`}
                    >
                      {isPending
                        ? "लंबित (Pending)"
                        : isUnderReview
                        ? "समीक्षाधीन (Under Review)"
                        : isResolved
                        ? "समाधान हो गया (Resolved)"
                        : "अस्वीकार (Rejected)"}
                    </span>

                    {report.subjectName && (
                      <span className="text-slate-500 font-bold flex items-center gap-1">
                        <BookOpen className="w-3 h-3" /> {report.subjectName}
                      </span>
                    )}

                    <span className="text-slate-400 flex items-center gap-1 text-[11px]">
                      <Clock className="w-3 h-3" />{" "}
                      {new Date(report.reportedAt).toLocaleDateString("hi-IN", {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>

                  {/* Actions Bar */}
                  <div className="flex items-center gap-2 self-end sm:self-auto">
                    {/* Full Question Editor Button */}
                    <button
                      onClick={() => handleOpenEditor(report)}
                      className="px-3 py-1.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition-all cursor-pointer active:scale-95"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>पूर्ण संपादक व सुधार (Edit Question)</span>
                    </button>

                    {/* Quick status actions */}
                    {isPending && (
                      <button
                        onClick={() =>
                          setQuickActionReport({
                            report,
                            action: "under_review",
                          })
                        }
                        className="px-2.5 py-1.5 bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 hover:bg-blue-100 rounded-xl text-xs font-semibold cursor-pointer"
                        title="समीक्षाधीन मार्क करें"
                      >
                        रिव्यू मार्क करें
                      </button>
                    )}

                    {!isResolved && !isRejected && (
                      <button
                        onClick={() =>
                          setQuickActionReport({
                            report,
                            action: "rejected",
                          })
                        }
                        className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer"
                        title="आपत्ति अस्वीकार करें"
                      >
                        <XCircle className="w-4 h-4" />
                      </button>
                    )}

                    <button
                      onClick={() => handleDeleteReport(report.id)}
                      className="p-1.5 text-slate-300 hover:text-rose-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer"
                      title="आपत्ति रिकॉर्ड हटाएं"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Question Text */}
                <div className="mt-3">
                  <p className="text-xs font-bold text-slate-900 dark:text-white line-clamp-2">
                    प्रश्न: {report.questionText}
                  </p>
                </div>

                {/* Student Comment Box */}
                <div className="mt-3 bg-amber-500/5 dark:bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 flex items-start gap-2.5">
                  <MessageSquare className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                  <div className="text-xs flex-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-amber-900 dark:text-amber-200">
                        {report.studentName || "छात्र"} की टिप्पणी:
                      </span>
                      {report.studentEmail && (
                        <span className="text-[11px] text-slate-500">
                          {report.studentEmail}
                        </span>
                      )}
                    </div>
                    <p className="text-slate-700 dark:text-slate-300 mt-0.5 font-medium">
                      "{report.studentComment}"
                    </p>

                    {/* Admin resolution notes preview */}
                    {report.adminNotes && (
                      <div className="mt-2 pt-2 border-t border-amber-500/20 text-xs">
                        <span className="font-bold text-slate-600 dark:text-slate-400">
                          एडमिन टिप्पणी / समाधान विवरण:
                        </span>
                        <p className="text-emerald-700 dark:text-emerald-400 mt-0.5">
                          {report.adminNotes}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Full Question Editor Modal */}
      {editingReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/80 backdrop-blur-md animate-in fade-in">
          <div className="bg-white dark:bg-[#0B1220] w-full max-w-4xl max-h-[92vh] rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
                  <Edit3 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                    <span>Full Question Editor & Objection Resolution</span>
                    <span className="font-mono text-xs px-2 py-0.5 rounded bg-amber-500/10 text-amber-500 border border-amber-500/20">
                      #{editingReport.questionId}
                    </span>
                  </h3>
                  <p className="text-xs text-slate-500">
                    प्रश्न विवरण, सभी विकल्प, सही उत्तर, व्याख्या और महत्वपूर्ण तथ्य संशोधित करें।
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setEditingReport(null);
                  setOriginalQuestion(null);
                }}
                className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg cursor-pointer"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content Form */}
            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {isLoadingQuestion ? (
                <div className="py-16 text-center text-slate-400 flex flex-col items-center justify-center">
                  <Loader2 className="w-8 h-8 animate-spin text-amber-500 mb-2" />
                  <p className="text-xs font-bold">
                    डेटाबेस और प्रश्न बैंक से मूल प्रश्न लोड हो रहा है...
                  </p>
                </div>
              ) : (
                <>
                  {/* Student reported issue box */}
                  <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4">
                    <div className="flex items-center justify-between text-xs font-bold text-amber-900 dark:text-amber-200 mb-1">
                      <span>छात्र की आपत्ति ({editingReport.studentName || "Student"}):</span>
                      <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-amber-500/20">
                        {ISSUE_TYPE_LABELS[editingReport.issueType]?.hi}
                      </span>
                    </div>
                    <p className="text-xs text-amber-950 dark:text-amber-100 font-medium">
                      "{editingReport.studentComment}"
                    </p>
                  </div>

                  {/* Question Text */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                      प्रश्न विवरण (Question Text) *
                    </label>
                    <textarea
                      value={qText}
                      onChange={(e) => setQText(e.target.value)}
                      rows={3}
                      className="w-full p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-xl text-xs font-bold text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                      placeholder="प्रश्न का पाठ दर्ज करें..."
                    />
                  </div>

                  {/* Options Editor */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                        विकल्प (Options) - सही उत्तर का चयन करें *
                      </label>
                      {qOptions.length < 6 && (
                        <button
                          type="button"
                          onClick={handleAddOption}
                          className="px-2.5 py-1 text-xs font-bold text-amber-600 hover:text-amber-700 dark:text-amber-400 flex items-center gap-1 cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>विकल्प जोड़ें</span>
                        </button>
                      )}
                    </div>

                    <div className="space-y-2">
                      {qOptions.map((opt, idx) => {
                        const isCorrect = qCorrectIndex === idx;
                        return (
                          <div
                            key={idx}
                            className={`flex items-center gap-2 p-2 rounded-xl border transition-all ${
                              isCorrect
                                ? "border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20"
                                : "border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40"
                            }`}
                          >
                            <label className="flex items-center gap-2 cursor-pointer pl-1">
                              <input
                                type="radio"
                                name="correctOptionIdx"
                                checked={isCorrect}
                                onChange={() => setQCorrectIndex(idx)}
                                className="w-4 h-4 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                              />
                              <span
                                className={`w-6 h-6 rounded-lg text-xs font-black flex items-center justify-center ${
                                  isCorrect
                                    ? "bg-emerald-600 text-white"
                                    : "bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300"
                                }`}
                              >
                                {String.fromCharCode(65 + idx)}
                              </span>
                            </label>

                            <input
                              type="text"
                              value={opt}
                              onChange={(e) => handleOptionChange(idx, e.target.value)}
                              placeholder={`विकल्प ${String.fromCharCode(65 + idx)} दर्ज करें...`}
                              className="flex-1 px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-medium text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
                            />

                            {qOptions.length > 2 && (
                              <button
                                type="button"
                                onClick={() => handleRemoveOption(idx)}
                                className="p-1.5 text-slate-400 hover:text-rose-500 cursor-pointer rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                                title="विकल्प हटाएं"
                              >
                                <Minus className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Explanation and Important Facts */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                        विस्तृत व्याख्या (Explanation)
                      </label>
                      <textarea
                        value={qExplanation}
                        onChange={(e) => setQExplanation(e.target.value)}
                        rows={3}
                        className="w-full p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-xl text-xs font-medium text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                        placeholder="विस्तृत समाधान व व्याख्या दर्ज करें..."
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                        महत्वपूर्ण तथ्य (Important Facts)
                      </label>
                      <textarea
                        value={qImportantFacts}
                        onChange={(e) => setQImportantFacts(e.target.value)}
                        rows={3}
                        className="w-full p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-xl text-xs font-medium text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                        placeholder="परीक्षा उपयोगी स्मरणीय तथ्य..."
                      />
                    </div>
                  </div>

                  {/* Hierarchy and Difficulty */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">
                        विषय (Subject)
                      </label>
                      <select
                        value={qSubjectId}
                        onChange={(e) => setQSubjectId(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-800 dark:text-slate-200"
                      >
                        <option value="">(अपरिवर्तित रखें)</option>
                        {subjects.map((sub) => (
                          <option key={sub.id} value={sub.id}>
                            {sub.title || sub.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">
                        अध्याय (Chapter)
                      </label>
                      <select
                        value={qChapterId}
                        onChange={(e) => setQChapterId(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-800 dark:text-slate-200"
                      >
                        <option value="">(अपरिवर्तित रखें)</option>
                        {chapters.map((ch) => (
                          <option key={ch.id} value={ch.id}>
                            {ch.title || ch.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">
                        कठिनाई (Difficulty)
                      </label>
                      <select
                        value={qDifficulty}
                        onChange={(e) => setQDifficulty(e.target.value as any)}
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-800 dark:text-slate-200"
                      >
                        <option value="easy">सरल (Easy)</option>
                        <option value="medium">मध्यम (Medium)</option>
                        <option value="hard">कठिन (Hard)</option>
                      </select>
                    </div>
                  </div>

                  {/* Resolution & Notification Controls */}
                  <div className="bg-slate-50 dark:bg-slate-900/70 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                          आपत्ति की अंतिम स्थिति (Final Objection Status) *
                        </label>
                        <p className="text-[11px] text-slate-500">
                          सुधार सेव होने के बाद आपत्ति किस स्थिति में चिन्हित हो
                        </p>
                      </div>

                      <div className="flex items-center gap-1.5">
                        {(["resolved", "under_review", "rejected"] as const).map((st) => (
                          <button
                            key={st}
                            type="button"
                            onClick={() => setTargetStatus(st)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                              targetStatus === st
                                ? st === "resolved"
                                  ? "bg-emerald-600 text-white shadow-xs"
                                  : st === "under_review"
                                  ? "bg-blue-600 text-white shadow-xs"
                                  : "bg-rose-600 text-white shadow-xs"
                                : "bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400"
                            }`}
                          >
                            {st === "resolved"
                              ? "समाधान (Resolved)"
                              : st === "under_review"
                              ? "समीक्षाधीन"
                              : "अस्वीकार"}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                        एडमिन रिज़ॉल्यूशन टिप्पणी (Admin Notes / Feedback to Student)
                      </label>
                      <input
                        type="text"
                        value={adminNotes}
                        onChange={(e) => setAdminNotes(e.target.value)}
                        placeholder="उदा. प्रश्न का उत्तर संशोधित कर दिया गया है। आपत्ति दर्ज कराने हेतु धन्यवाद।"
                        className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                      />
                    </div>

                    <label className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer pt-1">
                      <input
                        type="checkbox"
                        checked={notifyStudent}
                        onChange={(e) => setNotifyStudent(e.target.checked)}
                        className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500 cursor-pointer"
                      />
                      <Bell className="w-3.5 h-3.5 text-amber-500" />
                      <span>छात्र को इन-ऐप नोटिफिकेशन भेजें (Send Notification to Reporter)</span>
                    </label>
                  </div>
                </>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  setEditingReport(null);
                  setOriginalQuestion(null);
                }}
                className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 cursor-pointer"
              >
                रद्द करें (Cancel)
              </button>

              <button
                type="button"
                onClick={handleSaveQuestionAndResolve}
                disabled={isSaving || isLoadingQuestion}
                className="px-6 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl text-xs font-bold shadow-md flex items-center gap-2 cursor-pointer active:scale-95 disabled:opacity-50"
              >
                {isSaving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                <span>प्रश्न अपडेट करें व आपत्ति का समाधान करें (Save & Resolve)</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Action Note Dialog (e.g. Reject / Mark Under Review) */}
      {quickActionReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-[#0B1220] max-w-md w-full rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-4 shadow-2xl">
            <div className="flex items-start gap-3">
              <div
                className={`p-2.5 rounded-xl ${
                  quickActionReport.action === "under_review"
                    ? "bg-blue-500/10 text-blue-500"
                    : "bg-rose-500/10 text-rose-500"
                }`}
              >
                <AlertCircle className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                  {quickActionReport.action === "under_review"
                    ? "समीक्षाधीन मार्क करें (Mark Under Review)"
                    : "आपत्ति अस्वीकार करें (Reject Objection)"}
                </h4>
                <p className="text-xs text-slate-500">
                  {quickActionReport.action === "under_review"
                    ? "क्या आप इस आपत्ति को आंतरिक समीक्षा हेतु चिन्हित करना चाहते हैं?"
                    : "यदि प्रश्न और उत्तर कुंजी सही है, तो अस्वीकार करने का कारण दर्ज करें:"}
                </p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">
                टिप्पणी / कारण (वैकल्पिक)
              </label>
              <textarea
                value={quickActionNote}
                onChange={(e) => setQuickActionNote(e.target.value)}
                rows={2}
                placeholder="उदा. NCERT पुस्तक के अनुसार प्रश्न व उत्तर कुंजी पूरी तरह सही है।"
                className="w-full p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-1 focus:ring-amber-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setQuickActionReport(null)}
                className="px-3.5 py-1.5 text-xs font-semibold text-slate-500 hover:text-slate-700 cursor-pointer"
              >
                रद्द करें
              </button>
              <button
                type="button"
                onClick={handleExecuteQuickAction}
                disabled={isQuickActionProcessing}
                className={`px-4 py-2 text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer ${
                  quickActionReport.action === "under_review"
                    ? "bg-blue-600 hover:bg-blue-700"
                    : "bg-rose-600 hover:bg-rose-700"
                }`}
              >
                {isQuickActionProcessing && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>पुष्टि करें</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default QuestionReportDesk;
