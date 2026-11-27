import * as React from "react";
import { 
  FileCheck, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  Filter, 
  Search, 
  RefreshCw, 
  Check, 
  X, 
  Edit3, 
  Send, 
  Sparkles, 
  AlertTriangle, 
  MessageSquare, 
  BookOpen, 
  Layers, 
  Tag, 
  ArrowRight,
  ShieldCheck,
  CheckSquare,
  Square,
  GraduationCap
} from "lucide-react";
import { Question, QuestionApprovalStatus, UserProfile } from "../../types";
import { 
  fetchReviewQueueQuestions, 
  approveQuestion, 
  rejectQuestion, 
  publishQuestion, 
  bulkApproveQuestions, 
  updateQuestionUnderReview,
  getCachedReviewQuestions
} from "../../utils/questionReviewService";
import { canApproveQuestions, canPublishQuestions, isSuperAdminRole } from "../../utils/rbac";
import { loadUserProfile } from "../../utils/userProfileStorage";

interface QuestionApprovalWorkflowSectionProps {
  currentUserProfile?: UserProfile | null;
}

export const QuestionApprovalWorkflowSection: React.FC<QuestionApprovalWorkflowSectionProps> = ({
  currentUserProfile,
}) => {
  const profile = currentUserProfile || loadUserProfile();
  const canApprove = canApproveQuestions(profile);
  const canPublish = canPublishQuestions(profile);

  // Data states
  const [questions, setQuestions] = React.useState<Question[]>(() => getCachedReviewQuestions());
  const [isLoading, setIsLoading] = React.useState(false);
  const [actionLoadingId, setActionLoadingId] = React.useState<string | null>(null);

  // Filters
  const [activeTab, setActiveTab] = React.useState<QuestionApprovalStatus | "all">("pending_review");
  const [searchQuery, setSearchQuery] = React.useState("");
  const [selectedSubject, setSelectedSubject] = React.useState("all");

  // Selection for bulk actions
  const [selectedIds, setSelectedIds] = React.useState<string[]>([]);

  // Modals & Active Dialogs
  const [rejectingQuestion, setRejectingQuestion] = React.useState<Question | null>(null);
  const [rejectNotes, setRejectNotes] = React.useState("");
  const [editingQuestion, setEditingQuestion] = React.useState<Question | null>(null);

  // Notification Toast
  const [toast, setToast] = React.useState<{ message: string; type: "success" | "error" } | null>(null);

  const showToast = (message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const loadQuestions = React.useCallback(async (notify = false) => {
    setIsLoading(true);
    try {
      const list = await fetchReviewQueueQuestions();
      setQuestions(list);
      if (notify) {
        showToast("Review queue refreshed.");
      }
    } catch (err: any) {
      console.warn("Review questions fetch error:", err);
      if (notify) {
        showToast(err?.message || "Failed to fetch review queue.", "error");
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadQuestions(false);
  }, [loadQuestions]);

  // Status counts
  const counts = React.useMemo(() => {
    const pending = questions.filter(q => (q.approvalStatus || (q as any).approval_status) === "pending_review").length;
    const rejected = questions.filter(q => (q.approvalStatus || (q as any).approval_status) === "rejected" || (q.approvalStatus || (q as any).approval_status) === "needs_review").length;
    const approved = questions.filter(q => (q.approvalStatus || (q as any).approval_status) === "approved").length;
    const published = questions.filter(q => (q.approvalStatus || (q as any).approval_status) === "published" || !q.approvalStatus).length;
    const draft = questions.filter(q => (q.approvalStatus || (q as any).approval_status) === "draft").length;
    return { pending, rejected, approved, published, draft, total: questions.length };
  }, [questions]);

  // Subject list for filter
  const subjectsList = React.useMemo(() => {
    const set = new Set<string>();
    for (const q of questions) {
      if (q.subject) set.add(q.subject);
      else if (q.subjectId) set.add(q.subjectId);
    }
    return Array.from(set);
  }, [questions]);

  // Filtered Questions
  const filteredQuestions = React.useMemo(() => {
    return questions.filter((q) => {
      const status = q.approvalStatus || (q as any).approval_status || "published";
      if (activeTab !== "all") {
        if (activeTab === "rejected") {
          if (status !== "rejected" && status !== "needs_review") return false;
        } else if (status !== activeTab) {
          return false;
        }
      }
      if (selectedSubject !== "all") {
        const sub = q.subject || q.subjectId;
        if (sub !== selectedSubject) return false;
      }
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const matchText = q.text.toLowerCase().includes(query);
        const matchExp = (q.explanation || "").toLowerCase().includes(query);
        const matchTopic = (q.topic || "").toLowerCase().includes(query);
        return matchText || matchExp || matchTopic;
      }
      return true;
    });
  }, [questions, activeTab, selectedSubject, searchQuery]);

  // Toggle selection
  const handleToggleSelect = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const handleSelectAll = () => {
    if (selectedIds.length === filteredQuestions.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredQuestions.map(q => q.id));
    }
  };

  // Actions
  const handleApprove = async (questionId: string, autoPublish: boolean) => {
    setActionLoadingId(questionId);
    try {
      const updated = await approveQuestion(questionId, autoPublish);
      setQuestions(prev => prev.map(q => q.id === questionId ? updated : q));
      setSelectedIds(prev => prev.filter(id => id !== questionId));
      showToast(
        autoPublish 
          ? "Question approved and published live to students." 
          : "Question approved and marked ready for publication."
      );
    } catch (err: any) {
      showToast(err?.message || "Failed to approve question.", "error");
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleConfirmReject = async () => {
    if (!rejectingQuestion) return;
    if (!rejectNotes.trim()) {
      showToast("Please provide constructive feedback notes explaining what to fix.", "error");
      return;
    }

    setActionLoadingId(rejectingQuestion.id);
    try {
      const updated = await rejectQuestion(rejectingQuestion.id, rejectNotes);
      setQuestions(prev => prev.map(q => q.id === rejectingQuestion.id ? updated : q));
      setRejectingQuestion(null);
      setRejectNotes("");
      showToast("Question marked for revision with feedback sent to author.");
    } catch (err: any) {
      showToast(err?.message || "Failed to send revision request.", "error");
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleBulkApprove = async (autoPublish: boolean) => {
    if (selectedIds.length === 0) return;
    setIsLoading(true);
    try {
      const res = await bulkApproveQuestions(selectedIds, autoPublish);
      setQuestions(prev => prev.map(q => {
        if (selectedIds.includes(q.id)) {
          return { ...q, approvalStatus: autoPublish ? "published" : "approved" };
        }
        return q;
      }));
      setSelectedIds([]);
      showToast(`Bulk approved ${res.successCount} questions successfully.`);
    } catch (err: any) {
      showToast(err?.message || "Bulk approval failed.", "error");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast Alert */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 flex items-center gap-2.5 px-4 py-3 rounded-2xl shadow-xl border text-sm font-bold backdrop-blur-md transition-all animate-in fade-in slide-in-from-top-2 ${
          toast.type === "success" 
            ? "bg-emerald-500/90 text-white border-emerald-400" 
            : "bg-rose-500/90 text-white border-rose-400"
        }`}>
          {toast.type === "success" ? <CheckCircle2 className="w-5 h-5 shrink-0" /> : <AlertCircle className="w-5 h-5 shrink-0" />}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Header Banner */}
      <div className="bg-white dark:bg-[#111A2E] border border-slate-200/80 dark:border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-500 to-rose-600 text-white flex items-center justify-center shrink-0 shadow-xs">
              <FileCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
                <span>Question Review &amp; QA Queue</span>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300 border border-amber-200 dark:border-amber-800 font-extrabold">
                  Editorial Workflow
                </span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Review drafted MCQs from SMEs, verify explanations and exam sources, request revisions, and publish live.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => loadQuestions(true)}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-3 py-2 rounded-2xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
            <span>Refresh Queue</span>
          </button>
        </div>
      </div>

      {/* Workflow Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
        <button
          onClick={() => setActiveTab("pending_review")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-black transition-all shrink-0 cursor-pointer ${
            activeTab === "pending_review"
              ? "bg-amber-600 text-white shadow-xs"
              : "bg-white dark:bg-[#111A2E] text-slate-600 dark:text-slate-300 border border-slate-200/80 dark:border-slate-800 hover:bg-slate-50"
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
          <span>Pending Review</span>
          <span className={`px-2 py-0.2 rounded-full text-[10px] font-bold ${
            activeTab === "pending_review" ? "bg-amber-800/60 text-white" : "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
          }`}>
            {counts.pending}
          </span>
        </button>

        <button
          onClick={() => setActiveTab("rejected")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-black transition-all shrink-0 cursor-pointer ${
            activeTab === "rejected"
              ? "bg-rose-600 text-white shadow-xs"
              : "bg-white dark:bg-[#111A2E] text-slate-600 dark:text-slate-300 border border-slate-200/80 dark:border-slate-800 hover:bg-slate-50"
          }`}
        >
          <AlertTriangle className="w-3.5 h-3.5" />
          <span>Needs Revision</span>
          <span className={`px-2 py-0.2 rounded-full text-[10px] font-bold ${
            activeTab === "rejected" ? "bg-rose-800/60 text-white" : "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300"
          }`}>
            {counts.rejected}
          </span>
        </button>

        <button
          onClick={() => setActiveTab("approved")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-black transition-all shrink-0 cursor-pointer ${
            activeTab === "approved"
              ? "bg-[#7045D8] text-white shadow-xs"
              : "bg-white dark:bg-[#111A2E] text-slate-600 dark:text-slate-300 border border-slate-200/80 dark:border-slate-800 hover:bg-slate-50"
          }`}
        >
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>Approved</span>
          <span className={`px-2 py-0.2 rounded-full text-[10px] font-bold ${
            activeTab === "approved" ? "bg-blue-800/60 text-white" : "bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300"
          }`}>
            {counts.approved}
          </span>
        </button>

        <button
          onClick={() => setActiveTab("published")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-black transition-all shrink-0 cursor-pointer ${
            activeTab === "published"
              ? "bg-emerald-600 text-white shadow-xs"
              : "bg-white dark:bg-[#111A2E] text-slate-600 dark:text-slate-300 border border-slate-200/80 dark:border-slate-800 hover:bg-slate-50"
          }`}
        >
          <Check className="w-3.5 h-3.5" />
          <span>Published Live</span>
          <span className={`px-2 py-0.2 rounded-full text-[10px] font-bold ${
            activeTab === "published" ? "bg-emerald-800/60 text-white" : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
          }`}>
            {counts.published}
          </span>
        </button>

        <button
          onClick={() => setActiveTab("all")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-black transition-all shrink-0 cursor-pointer ${
            activeTab === "all"
              ? "bg-slate-800 text-white shadow-xs"
              : "bg-white dark:bg-[#111A2E] text-slate-600 dark:text-slate-300 border border-slate-200/80 dark:border-slate-800 hover:bg-slate-50"
          }`}
        >
          <span>All Questions ({counts.total})</span>
        </button>
      </div>

      {/* Filter and Bulk Actions Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white dark:bg-[#111A2E] p-3 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            onClick={handleSelectAll}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 transition-colors"
          >
            {selectedIds.length === filteredQuestions.length && filteredQuestions.length > 0 ? (
              <CheckSquare className="w-4 h-4 text-indigo-600" />
            ) : (
              <Square className="w-4 h-4 text-slate-400" />
            )}
            <span>Select All</span>
          </button>

          {selectedIds.length > 0 && canApprove && (
            <div className="flex items-center gap-1.5 animate-in fade-in">
              <button
                onClick={() => handleBulkApprove(true)}
                className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold shadow-xs transition-colors"
              >
                Bulk Publish ({selectedIds.length})
              </button>
              <button
                onClick={() => handleBulkApprove(false)}
                className="px-3 py-1.5 rounded-xl bg-[#7045D8] hover:bg-[#5B32BF] text-white text-xs font-extrabold shadow-xs transition-colors"
              >
                Bulk Approve ({selectedIds.length})
              </button>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search question text..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 rounded-xl text-xs bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:outline-hidden"
            />
          </div>

          {subjectsList.length > 0 && (
            <select
              value={selectedSubject}
              onChange={(e) => setSelectedSubject(e.target.value)}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 focus:outline-hidden"
            >
              <option value="all">All Subjects</option>
              {subjectsList.map((sub) => (
                <option key={sub} value={sub}>{sub}</option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Questions Review List */}
      <div className="space-y-4">
        {filteredQuestions.map((q) => {
          const status = q.approvalStatus || (q as any).approval_status || "published";
          const isSelected = selectedIds.includes(q.id);

          return (
            <div
              key={q.id}
              className={`bg-white dark:bg-[#111A2E] rounded-3xl border transition-all p-5 shadow-xs space-y-3 ${
                isSelected
                  ? "border-indigo-500 ring-2 ring-indigo-500/20 bg-indigo-50/10"
                  : "border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
              }`}
            >
              {/* Header: Select Checkbox + Tags + Status Badge */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <button
                    onClick={() => handleToggleSelect(q.id)}
                    className="p-1 rounded-lg text-slate-400 hover:text-indigo-600 transition-colors"
                  >
                    {isSelected ? (
                      <CheckSquare className="w-4 h-4 text-indigo-600" />
                    ) : (
                      <Square className="w-4 h-4 text-slate-400" />
                    )}
                  </button>

                  {q.subject && (
                    <span className="text-[10px] px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 font-bold border border-blue-200 dark:border-blue-800">
                      {q.subject}
                    </span>
                  )}
                  {q.chapter && (
                    <span className="text-[10px] px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium">
                      {q.chapter}
                    </span>
                  )}
                  {q.examName && (
                    <span className="text-[10px] px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 font-bold">
                      {q.examName} {q.year ? `(${q.year})` : ""}
                    </span>
                  )}
                </div>

                {/* Status Badge */}
                <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-black border flex items-center gap-1.5 shrink-0 ${
                  status === "published"
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800"
                    : status === "approved"
                    ? "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800"
                    : status === "rejected" || status === "needs_review"
                    ? "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800"
                    : "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800"
                }`}>
                  {status === "published" && <Check className="w-3.5 h-3.5" />}
                  {status === "approved" && <CheckCircle2 className="w-3.5 h-3.5" />}
                  {(status === "rejected" || status === "needs_review") && <AlertTriangle className="w-3.5 h-3.5" />}
                  {status === "pending_review" && <Clock className="w-3.5 h-3.5" />}
                  <span className="capitalize">{status.replace(/_/g, " ")}</span>
                </span>
              </div>

              {/* Question Text */}
              <div className="text-sm font-bold text-slate-900 dark:text-white leading-relaxed">
                {q.text}
              </div>

              {/* Options */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                {(q.options || []).map((opt, idx) => {
                  const isCorrect = idx === q.correctIndex;
                  return (
                    <div
                      key={idx}
                      className={`p-2.5 rounded-xl border flex items-center gap-2 ${
                        isCorrect
                          ? "bg-emerald-50/80 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200 border-emerald-300 dark:border-emerald-800 font-bold"
                          : "bg-slate-50 dark:bg-slate-900/40 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800"
                      }`}
                    >
                      <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 ${
                        isCorrect ? "bg-emerald-600 text-white" : "bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                      }`}>
                        {String.fromCharCode(65 + idx)}
                      </span>
                      <span className="truncate">{opt}</span>
                    </div>
                  );
                })}
              </div>

              {/* Explanation Preview */}
              {q.explanation && (
                <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-300">
                  <span className="font-bold text-slate-800 dark:text-slate-200 mr-1">Explanation:</span>
                  <span>{q.explanation}</span>
                </div>
              )}

              {/* Revision Notes Banner (if rejected) */}
              {q.reviewNotes && (
                <div className="p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-xs text-rose-800 dark:text-rose-300 flex items-start gap-2">
                  <MessageSquare className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Reviewer Feedback:</span> {q.reviewNotes}
                  </div>
                </div>
              )}

              {/* Bottom Actions Row */}
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="text-[10px] text-slate-400 flex items-center gap-2">
                  {q.submittedAt && (
                    <span>Submitted {new Date(q.submittedAt).toLocaleDateString()}</span>
                  )}
                  {q.reviewedAt && (
                    <span>• Reviewed {new Date(q.reviewedAt).toLocaleDateString()}</span>
                  )}
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {/* Inline Edit */}
                  <button
                    onClick={() => setEditingQuestion(q)}
                    className="px-3 py-1.5 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>Quick Edit</span>
                  </button>

                  {/* Reviewer Actions */}
                  {canApprove && (
                    <>
                      {status !== "published" && (
                        <button
                          onClick={() => handleApprove(q.id, true)}
                          disabled={actionLoadingId === q.id}
                          className="px-3 py-1.5 rounded-xl text-xs font-black bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-colors flex items-center gap-1 cursor-pointer"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Approve &amp; Publish</span>
                        </button>
                      )}

                      {status === "pending_review" && (
                        <button
                          onClick={() => handleApprove(q.id, false)}
                          disabled={actionLoadingId === q.id}
                          className="px-3 py-1.5 rounded-xl text-xs font-bold bg-[#7045D8] hover:bg-[#5B32BF] text-white shadow-xs transition-colors flex items-center gap-1 cursor-pointer"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Approve (Draft)</span>
                        </button>
                      )}

                      {status !== "rejected" && (
                        <button
                          onClick={() => {
                            setRejectingQuestion(q);
                            setRejectNotes(q.reviewNotes || "");
                          }}
                          disabled={actionLoadingId === q.id}
                          className="px-3 py-1.5 rounded-xl text-xs font-bold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors flex items-center gap-1 cursor-pointer"
                        >
                          <AlertTriangle className="w-3.5 h-3.5" />
                          <span>Request Revision</span>
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {filteredQuestions.length === 0 && (
          <div className="bg-white dark:bg-[#111A2E] rounded-3xl p-8 text-center border border-slate-200/80 dark:border-slate-800">
            <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2 opacity-50" />
            <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">Review Queue is Clear</h4>
            <p className="text-xs text-slate-500 mt-1">There are no questions matching this status filter.</p>
          </div>
        )}
      </div>

      {/* ───────────────────────────────────────────────────────── */}
      {/* DIALOG 1: Reject / Request Revision Dialog */}
      {/* ───────────────────────────────────────────────────────── */}
      {rejectingQuestion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white dark:bg-[#111A2E] rounded-3xl border border-rose-200 dark:border-rose-900/40 p-6 max-w-lg w-full shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="w-10 h-10 rounded-2xl bg-rose-500/10 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-extrabold text-base text-slate-900 dark:text-white">Request Question Revision</h3>
                <p className="text-xs text-slate-500">Provide actionable feedback to the author</p>
              </div>
            </div>

            <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-900 text-xs font-bold text-slate-700 dark:text-slate-300 line-clamp-2">
              &quot;{rejectingQuestion.text}&quot;
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Editorial Feedback &amp; Correction Notes
              </label>
              <textarea
                rows={4}
                required
                placeholder="e.g., Option 3 text has a typo, please include Hindi translation and verify source year..."
                value={rejectNotes}
                onChange={(e) => setRejectNotes(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl text-xs bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-rose-500 focus:outline-hidden"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setRejectingQuestion(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmReject}
                disabled={actionLoadingId === rejectingQuestion.id}
                className="px-4 py-2 rounded-xl text-xs font-extrabold bg-rose-600 hover:bg-rose-700 text-white shadow-xs transition-colors flex items-center gap-1.5"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Send Revision Request</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────── */}
      {/* DIALOG 2: Quick Inline Edit Dialog */}
      {/* ───────────────────────────────────────────────────────── */}
      {editingQuestion && (
        <QuickEditQuestionModal
          question={editingQuestion}
          onClose={() => setEditingQuestion(null)}
          onSuccess={(updated) => {
            setQuestions(prev => prev.map(q => q.id === updated.id ? updated : q));
            setEditingQuestion(null);
            showToast("Question updated successfully.");
          }}
        />
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────
// SUB-COMPONENT: Quick Edit Question Modal
// ─────────────────────────────────────────────────────────────
interface QuickEditQuestionModalProps {
  question: Question;
  onClose: () => void;
  onSuccess: (updated: Question) => void;
}

const QuickEditQuestionModal: React.FC<QuickEditQuestionModalProps> = ({
  question,
  onClose,
  onSuccess,
}) => {
  const [text, setText] = React.useState(question.text);
  const [options, setOptions] = React.useState<string[]>([...question.options]);
  const [correctIndex, setCorrectIndex] = React.useState(question.correctIndex);
  const [explanation, setExplanation] = React.useState(question.explanation || "");
  const [examName, setExamName] = React.useState(question.examName || "");
  const [year, setYear] = React.useState(question.year ? String(question.year) : "");
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const handleOptionChange = (index: number, val: string) => {
    const next = [...options];
    next[index] = val;
    setOptions(next);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const updated: Question = {
        ...question,
        text,
        options,
        correctIndex,
        explanation,
        examName: examName || undefined,
        year: year ? Number(year) || year : undefined,
      };
      const res = await updateQuestionUnderReview(updated);
      onSuccess(res);
    } catch (err: any) {
      console.warn("Update question error:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
      <div className="bg-white dark:bg-[#111A2E] rounded-3xl border border-slate-200 dark:border-slate-800 p-6 max-w-xl w-full shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto no-scrollbar">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Edit3 className="w-5 h-5 text-indigo-600" />
            <h3 className="font-extrabold text-base text-slate-900 dark:text-white">Quick Edit Question</h3>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Question Text</label>
            <textarea
              rows={3}
              required
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:outline-hidden"
            />
          </div>

          <div className="space-y-2">
            <label className="block font-bold text-slate-700 dark:text-slate-300">Answer Options (Select correct answer)</label>
            {options.map((opt, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCorrectIndex(idx)}
                  className={`w-7 h-7 rounded-xl font-bold flex items-center justify-center transition-colors shrink-0 ${
                    correctIndex === idx
                      ? "bg-emerald-600 text-white"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {String.fromCharCode(65 + idx)}
                </button>
                <input
                  type="text"
                  required
                  value={opt}
                  onChange={(e) => handleOptionChange(idx, e.target.value)}
                  className="flex-1 px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:outline-hidden"
                />
              </div>
            ))}
          </div>

          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Explanation</label>
            <textarea
              rows={3}
              value={explanation}
              onChange={(e) => setExplanation(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:outline-hidden"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Exam Name</label>
              <input
                type="text"
                value={examName}
                onChange={(e) => setExamName(e.target.value)}
                placeholder="e.g. UPSC CSE, RAS"
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:outline-hidden"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Year</label>
              <input
                type="text"
                value={year}
                onChange={(e) => setYear(e.target.value)}
                placeholder="e.g. 2024"
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:outline-hidden"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 rounded-xl font-extrabold bg-[#7045D8] hover:bg-[#5B32BF] text-white shadow-xs transition-colors flex items-center gap-1.5"
            >
              {isSubmitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              <span>{isSubmitting ? "Saving..." : "Save Edits"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
