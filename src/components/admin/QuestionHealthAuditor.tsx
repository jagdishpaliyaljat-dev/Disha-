import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Sparkles,
  Search,
  Filter,
  ShieldAlert,
  ShieldCheck,
  Wrench,
  Check,
  X,
  FileText,
  ArrowRight,
  Download,
  Brain,
  Layers,
  Edit3,
  Trash2,
  Clock,
  ExternalLink,
  ChevronRight,
  TrendingDown,
  Zap,
  HelpCircle,
  BarChart3,
  CheckCircle,
} from "lucide-react";
import { Question, Chapter, UserQuestionsStore } from "../../types";
import {
  auditQuestionBank,
  auditQuestionHealth,
  auditQuestionWithAI,
  applyAuditFixToQuestion,
  autoFixSafeFormatting,
  loadHealthAuditCache,
  saveHealthAuditCache,
  ContentHealthSummary,
  QuestionHealthResult,
  ContentIssueType,
  ContentIssue,
  AISuggestedCorrection,
} from "../../services/contentHealthAuditorService";
import {
  loadUserQuestionsStore,
  getCombinedChapters,
  getCombinedQuestions,
  saveUserQuestionsStore,
} from "../../utils/questionsStorage";
import { loadPerformanceStore } from "../../utils/performanceStorage";
import { triggerAdminToast } from "../../utils/adminToast";
import { AdminCard } from "./AdminCard";
import { RichText } from "../RichText";

interface QuestionHealthAuditorProps {
  questionsStore?: UserQuestionsStore;
  chapters?: Chapter[];
  onStoreUpdated?: (updatedStore: UserQuestionsStore) => void;
  className?: string;
}

export const QuestionHealthAuditor: React.FC<QuestionHealthAuditorProps> = ({
  questionsStore: propsStore,
  chapters: propsChapters,
  onStoreUpdated,
  className = "",
}) => {
  // Store & chapters resolution
  const [localStore, setLocalStore] = useState<UserQuestionsStore>(() => propsStore || loadUserQuestionsStore());
  const chapters = useMemo(() => propsChapters || getCombinedChapters(localStore), [propsChapters, localStore]);

  // All combined active questions
  const allQuestions = useMemo(() => {
    return getCombinedQuestions(chapters, localStore);
  }, [chapters, localStore]);

  // Auditor summary & scan state
  const [summary, setSummary] = useState<ContentHealthSummary | null>(() => loadHealthAuditCache());
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);

  // Active view filters
  const [activeTab, setActiveTab] = useState<"overview" | "issues" | "anomalies">("overview");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRatingFilter, setSelectedRatingFilter] = useState<"all" | "critical" | "needs_review" | "good" | "optimal">("all");
  const [selectedIssueFilter, setSelectedIssueFilter] = useState<"all" | ContentIssueType>("all");
  const [selectedChapterFilter, setSelectedChapterFilter] = useState<string>("all");

  // AI Review & Approval Modal state
  const [activeReviewItem, setActiveReviewItem] = useState<QuestionHealthResult | null>(null);
  const [isAILoading, setIsAILoading] = useState(false);
  const [aiCorrection, setAiCorrection] = useState<AISuggestedCorrection | null>(null);
  const [editForm, setEditForm] = useState<{
    correctIndex: number;
    explanation: string;
    options: string[];
    text: string;
  } | null>(null);
  const [isApplyingFix, setIsApplyingFix] = useState(false);

  // Auto-Fix state
  const [isAutoFixing, setIsAutoFixing] = useState(false);

  // Run or refresh full audit
  const runFullAudit = useCallback(async () => {
    setIsScanning(true);
    setScanProgress(10);

    try {
      // Yield thread briefly for smooth UI progress
      await new Promise((r) => setTimeout(r, 60));
      setScanProgress(45);

      const perfStore = loadPerformanceStore();
      const freshSummary = auditQuestionBank(allQuestions, perfStore);
      setScanProgress(90);

      await new Promise((r) => setTimeout(r, 60));
      setSummary(freshSummary);
      setScanProgress(100);

      triggerAdminToast({
        type: "success",
        title: "Audit Complete",
        message: `Audited ${allQuestions.length} questions. Bank Health Score: ${freshSummary.averageHealthScore}/100.`,
      });
    } catch (err: any) {
      console.error("Health audit failed:", err);
      triggerAdminToast({
        type: "error",
        title: "Audit Error",
        message: err?.message || "Failed to audit questions.",
      });
    } finally {
      setIsScanning(false);
      setScanProgress(0);
    }
  }, [allQuestions]);

  // Initial audit if no cache exists
  useEffect(() => {
    if (!summary && allQuestions.length > 0) {
      runFullAudit();
    }
  }, [summary, allQuestions.length, runFullAudit]);

  // Safe mechanical batch auto-fix for formatting & LaTeX
  const handleAutoFixSafeFormatting = () => {
    if (!summary) return;
    setIsAutoFixing(true);

    try {
      const { updatedStore, fixedCount, fixedQuestionIds } = autoFixSafeFormatting(allQuestions, localStore);
      if (fixedCount > 0) {
        saveUserQuestionsStore(updatedStore);
        setLocalStore(updatedStore);
        onStoreUpdated?.(updatedStore);

        triggerAdminToast({
          type: "success",
          title: "Auto-Fix Applied",
          message: `Successfully repaired unclosed LaTeX delimiters and formatting across ${fixedCount} questions.`,
        });

        // Re-audit with updated store
        const freshSummary = auditQuestionBank(getCombinedQuestions(chapters, updatedStore), loadPerformanceStore());
        setSummary(freshSummary);
      } else {
        triggerAdminToast({
          type: "info",
          title: "Clean Formatting",
          message: "No mechanical LaTeX or spacing anomalies detected.",
        });
      }
    } catch (err: any) {
      console.error("Auto-fix failed:", err);
      triggerAdminToast({
        type: "error",
        title: "Auto-Fix Failed",
        message: err?.message || "Could not complete mechanical auto-fix.",
      });
    } finally {
      setIsAutoFixing(false);
    }
  };

  // Open question review drawer & trigger AI audit
  const handleOpenReview = async (item: QuestionHealthResult) => {
    setActiveReviewItem(item);
    setIsAILoading(true);

    // If item already had a pre-computed heuristic correction, preload it
    if (item.aiCorrection) {
      setAiCorrection(item.aiCorrection);
      setEditForm({
        correctIndex: item.aiCorrection.suggestedCorrectIndex ?? item.question.correctIndex ?? 0,
        explanation: item.aiCorrection.suggestedExplanation || item.question.explanation || "",
        options: item.aiCorrection.suggestedOptions || [...(item.question.options || [])],
        text: item.aiCorrection.suggestedText || item.question.text || "",
      });
    } else {
      setEditForm({
        correctIndex: item.question.correctIndex ?? 0,
        explanation: item.question.explanation || "",
        options: [...(item.question.options || [])],
        text: item.question.text || "",
      });
    }

    try {
      const correction = await auditQuestionWithAI(item.question, item.issues);
      setAiCorrection(correction);
      setEditForm({
        correctIndex: correction.suggestedCorrectIndex ?? item.question.correctIndex ?? 0,
        explanation: correction.suggestedExplanation || item.question.explanation || "",
        options: correction.suggestedOptions || [...(item.question.options || [])],
        text: correction.suggestedText || item.question.text || "",
      });
    } catch (err) {
      console.error("AI review audit failed:", err);
    } finally {
      setIsAILoading(false);
    }
  };

  // Accept and apply suggested correction
  const handleApplyFix = async () => {
    if (!activeReviewItem || !editForm) return;
    setIsApplyingFix(true);

    try {
      const finalCorrection: AISuggestedCorrection = {
        suggestedCorrectIndex: editForm.correctIndex,
        suggestedExplanation: editForm.explanation,
        suggestedOptions: editForm.options,
        suggestedText: editForm.text,
        confidence: aiCorrection?.confidence || 0.95,
        reasoning: aiCorrection?.reasoning || "Correction approved by reviewer.",
        source: aiCorrection?.source || "ai",
      };

      const { updatedStore, updatedQuestion } = await applyAuditFixToQuestion(
        activeReviewItem.questionId,
        finalCorrection,
        localStore
      );

      saveUserQuestionsStore(updatedStore);
      setLocalStore(updatedStore);
      onStoreUpdated?.(updatedStore);

      triggerAdminToast({
        type: "success",
        title: "Correction Applied Live",
        message: `Updated Question ${updatedQuestion.id}. Health score raised to 98.`,
      });

      // Update in local summary
      if (summary) {
        const updatedQuestions = summary.questions.map((q) => {
          if (q.questionId === activeReviewItem.questionId) {
            return auditQuestionHealth(updatedQuestion, loadPerformanceStore());
          }
          return q;
        });
        const freshSummary = {
          ...summary,
          questions: updatedQuestions,
          criticalCount: updatedQuestions.filter((q) => q.rating === "critical").length,
          needsReviewCount: updatedQuestions.filter((q) => q.rating === "needs_review").length,
          goodCount: updatedQuestions.filter((q) => q.rating === "good").length,
          healthyCount: updatedQuestions.filter((q) => q.rating === "optimal").length,
        };
        setSummary(freshSummary);
        saveHealthAuditCache(freshSummary);
      }

      setActiveReviewItem(null);
      setAiCorrection(null);
      setEditForm(null);
    } catch (err: any) {
      console.error("Apply fix error:", err);
      triggerAdminToast({
        type: "error",
        title: "Update Failed",
        message: err?.message || "Could not apply correction to repository.",
      });
    } finally {
      setIsApplyingFix(false);
    }
  };

  // Export audit report
  const handleExportReport = () => {
    if (!summary) return;
    const reportData = {
      generatedAt: new Date().toISOString(),
      bankHealthScore: summary.averageHealthScore,
      totalAudited: summary.totalAudited,
      counts: {
        healthy: summary.healthyCount,
        good: summary.goodCount,
        needsReview: summary.needsReviewCount,
        critical: summary.criticalCount,
        performanceAnomalies: summary.performanceAnomalyCount,
      },
      issueBreakdown: summary.issueCounts,
      criticalQuestions: summary.questions
        .filter((q) => q.rating === "critical" || q.issues.length > 0)
        .map((q) => ({
          id: q.questionId,
          score: q.score,
          rating: q.rating,
          text: q.question.text,
          correctIndex: q.question.correctIndex,
          issues: q.issues.map((i) => `[${i.severity.toUpperCase()}] ${i.message}`),
          performance: q.performanceMetrics,
        })),
    };

    const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `disha-question-health-report-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    triggerAdminToast({
      type: "success",
      title: "Report Exported",
      message: "Health audit report downloaded as JSON.",
    });
  };

  // Filtered list of questions
  const filteredQuestions = useMemo(() => {
    if (!summary) return [];

    return summary.questions.filter((item) => {
      // 1. Rating filter
      if (selectedRatingFilter !== "all" && item.rating !== selectedRatingFilter) {
        return false;
      }

      // 2. Tab filter
      if (activeTab === "issues" && item.issues.length === 0) {
        return false;
      }
      if (activeTab === "anomalies" && (!item.performanceMetrics || item.performanceMetrics.anomalies.length === 0)) {
        return false;
      }

      // 3. Issue type filter
      if (selectedIssueFilter !== "all") {
        if (!item.issues.some((i) => i.type === selectedIssueFilter)) {
          return false;
        }
      }

      // 4. Chapter filter
      if (selectedChapterFilter !== "all") {
        if (item.question.chapterId !== selectedChapterFilter && item.question.chapter !== selectedChapterFilter) {
          return false;
        }
      }

      // 5. Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const text = (item.question.text || item.question.question || "").toLowerCase();
        const id = (item.question.id || "").toLowerCase();
        const exp = (item.question.explanation || "").toLowerCase();
        if (!text.includes(q) && !id.includes(q) && !exp.includes(q)) {
          return false;
        }
      }

      return true;
    });
  }, [summary, selectedRatingFilter, activeTab, selectedIssueFilter, selectedChapterFilter, searchQuery]);

  // Overall Health Score Color Helper
  const getScoreColor = (score: number) => {
    if (score >= 90) return { bg: "bg-emerald-500", text: "text-emerald-600 dark:text-emerald-400", border: "border-emerald-500" };
    if (score >= 75) return { bg: "bg-teal-500", text: "text-teal-600 dark:text-teal-400", border: "border-teal-500" };
    if (score >= 50) return { bg: "bg-amber-500", text: "text-amber-600 dark:text-amber-400", border: "border-amber-500" };
    return { bg: "bg-rose-500", text: "text-rose-600 dark:text-rose-400", border: "border-rose-500" };
  };

  const overallColor = summary ? getScoreColor(summary.averageHealthScore) : { bg: "bg-slate-500", text: "text-slate-500", border: "border-slate-500" };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* 1. Header & Summary Hero Banner */}
      <AdminCard
        title="AI Content Health & Question Error Auditor"
        subtitle="Automated question scanner, AI answer-key auditor, and student performance anomaly detector."
        icon={Activity}
        headerAction={
          <div className="flex items-center gap-2">
            <button
              onClick={handleAutoFixSafeFormatting}
              disabled={isAutoFixing || isScanning}
              className="px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-amber-500 dark:hover:border-amber-500 text-slate-800 dark:text-slate-200 text-xs font-bold rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              title="Automatically repairs unclosed LaTeX delimiters and trailing whitespaces"
            >
              <Wrench className={`w-3.5 h-3.5 text-amber-500 ${isAutoFixing ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">Auto-Fix LaTeX</span>
            </button>

            <button
              onClick={handleExportReport}
              disabled={!summary}
              className="px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-blue-500 dark:hover:border-blue-500 text-slate-800 dark:text-slate-200 text-xs font-bold rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              title="Export Full Health Audit Report as JSON"
            >
              <Download className="w-3.5 h-3.5 text-blue-500" />
              <span className="hidden sm:inline">Export Report</span>
            </button>

            <button
              onClick={runFullAudit}
              disabled={isScanning}
              className="px-4 py-1.5 bg-gradient-to-r from-[#800020] to-[#F47B20] text-white text-xs font-black rounded-xl shadow-md transition-all flex items-center gap-1.5 cursor-pointer active:scale-95 disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isScanning ? "animate-spin" : ""}`} />
              <span>{isScanning ? "Scanning Bank..." : "Run Full Scan"}</span>
            </button>
          </div>
        }
      >
        {/* Progress Bar during scan */}
        {isScanning && (
          <div className="mb-4">
            <div className="flex items-center justify-between text-xs font-bold mb-1 text-slate-500">
              <span>Scanning MCQ bank, testing LaTeX, checking answer keys & anomalies...</span>
              <span>{scanProgress}%</span>
            </div>
            <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
              <div
                className="bg-gradient-to-r from-[#800020] to-[#F47B20] h-2 rounded-full transition-all duration-300"
                style={{ width: `${scanProgress}%` }}
              />
            </div>
          </div>
        )}

        {/* Metric Badges Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 pt-1">
          {/* Main Bank Health Score */}
          <div className="col-span-2 sm:col-span-1 p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 flex items-center gap-3">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-xl text-white shadow-md ${overallColor.bg}`}>
              {summary ? summary.averageHealthScore : "--"}
            </div>
            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Bank Health</p>
              <p className={`text-sm font-black ${overallColor.text}`}>
                {summary
                  ? summary.averageHealthScore >= 90
                    ? "Optimal (उत्कृष्ट)"
                    : summary.averageHealthScore >= 75
                    ? "Good (अच्छा)"
                    : summary.averageHealthScore >= 50
                    ? "Needs Review"
                    : "Critical (सुधार अपेक्षित)"
                  : "Not Scanned"}
              </p>
            </div>
          </div>

          {/* Total Questions Scanned */}
          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Total MCQs</p>
              <Layers className="w-4 h-4 text-slate-400" />
            </div>
            <p className="text-xl font-black text-slate-900 dark:text-white mt-1">
              {summary ? summary.totalAudited : allQuestions.length}
            </p>
            <p className="text-[10px] text-slate-500 font-medium">In active repository</p>
          </div>

          {/* Critical Issues */}
          <div
            onClick={() => {
              setActiveTab("issues");
              setSelectedRatingFilter("critical");
            }}
            className="p-3.5 rounded-2xl bg-rose-50/50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/50 cursor-pointer hover:border-rose-400 transition-colors"
          >
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-extrabold uppercase tracking-wider text-rose-600 dark:text-rose-400">Critical Issues</p>
              <ShieldAlert className="w-4 h-4 text-rose-500" />
            </div>
            <p className="text-xl font-black text-rose-600 dark:text-rose-400 mt-1">
              {summary ? summary.criticalCount : 0}
            </p>
            <p className="text-[10px] text-rose-500 font-medium">Wrong keys / duplicates</p>
          </div>

          {/* Needs Review */}
          <div
            onClick={() => {
              setActiveTab("issues");
              setSelectedRatingFilter("needs_review");
            }}
            className="p-3.5 rounded-2xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50 cursor-pointer hover:border-amber-400 transition-colors"
          >
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-extrabold uppercase tracking-wider text-amber-600 dark:text-amber-400">Warnings</p>
              <AlertTriangle className="w-4 h-4 text-amber-500" />
            </div>
            <p className="text-xl font-black text-amber-600 dark:text-amber-400 mt-1">
              {summary ? summary.needsReviewCount : 0}
            </p>
            <p className="text-[10px] text-amber-500 font-medium">Shallow explanations</p>
          </div>

          {/* Performance Anomalies */}
          <div
            onClick={() => {
              setActiveTab("anomalies");
              setSelectedRatingFilter("all");
            }}
            className="p-3.5 rounded-2xl bg-purple-50/50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-900/50 cursor-pointer hover:border-purple-400 transition-colors"
          >
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-extrabold uppercase tracking-wider text-purple-600 dark:text-purple-400">Anomalies</p>
              <Zap className="w-4 h-4 text-purple-500" />
            </div>
            <p className="text-xl font-black text-purple-600 dark:text-purple-400 mt-1">
              {summary ? summary.performanceAnomalyCount : 0}
            </p>
            <p className="text-[10px] text-purple-500 font-medium">Extreme failure / fast-wrong</p>
          </div>

          {/* Optimal MCQs */}
          <div
            onClick={() => {
              setActiveTab("overview");
              setSelectedRatingFilter("optimal");
            }}
            className="p-3.5 rounded-2xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/50 cursor-pointer hover:border-emerald-400 transition-colors"
          >
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Optimal (90-100)</p>
              <ShieldCheck className="w-4 h-4 text-emerald-500" />
            </div>
            <p className="text-xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
              {summary ? summary.healthyCount : 0}
            </p>
            <p className="text-[10px] text-emerald-500 font-medium">Verified & clean</p>
          </div>
        </div>
      </AdminCard>

      {/* 2. Controls Toolbar & Category Filters */}
      <div className="bg-white dark:bg-[#1F2330] p-4 rounded-2xl sm:rounded-3xl border border-[#E8D9C0] dark:border-[#31374A] shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Sub-tab view buttons */}
          <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
            <button
              onClick={() => {
                setActiveTab("overview");
                setSelectedRatingFilter("all");
              }}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                activeTab === "overview"
                  ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs"
                  : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              All Questions ({summary?.totalAudited || 0})
            </button>
            <button
              onClick={() => {
                setActiveTab("issues");
                setSelectedRatingFilter("critical");
              }}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === "issues"
                  ? "bg-rose-500 text-white shadow-xs"
                  : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Issues Queue ({(summary?.criticalCount || 0) + (summary?.needsReviewCount || 0)})</span>
            </button>
            <button
              onClick={() => {
                setActiveTab("anomalies");
                setSelectedRatingFilter("all");
              }}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === "anomalies"
                  ? "bg-purple-600 text-white shadow-xs"
                  : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <Zap className="w-3.5 h-3.5" />
              <span>Performance Anomalies ({summary?.performanceAnomalyCount || 0})</span>
            </button>
          </div>

          {/* Search bar */}
          <div className="relative flex-1 max-w-sm">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search question text, formula, or ID..."
              className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-hidden focus:border-[#800020] dark:focus:border-[#F47B20]"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Filter dropdowns row */}
        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-100 dark:border-slate-800 text-xs">
          {/* Specific Issue Type Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-bold text-slate-400">Issue:</span>
            <select
              value={selectedIssueFilter}
              onChange={(e) => setSelectedIssueFilter(e.target.value as any)}
              className="px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl font-medium text-slate-700 dark:text-slate-200 text-xs focus:outline-hidden"
            >
              <option value="all">All Issues</option>
              <option value="answer_key_contradiction">Answer Key Contradiction</option>
              <option value="duplicate_options">Duplicate Options</option>
              <option value="broken_latex">Broken LaTeX / KaTeX</option>
              <option value="missing_field">Missing Mandatory Fields</option>
              <option value="missing_explanation">Missing Explanation</option>
              <option value="shallow_explanation">Shallow Explanation</option>
              <option value="broken_image">Missing / Broken Image</option>
              <option value="performance_extreme_failure">Extreme Failure (&lt;15%)</option>
              <option value="performance_fast_wrong">Fast-Wrong Trap (&lt;5s)</option>
              <option value="performance_slow_confusion">Slow Recall (&gt;85s)</option>
            </select>
          </div>

          {/* Rating Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-bold text-slate-400">Rating:</span>
            <select
              value={selectedRatingFilter}
              onChange={(e) => setSelectedRatingFilter(e.target.value as any)}
              className="px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl font-medium text-slate-700 dark:text-slate-200 text-xs focus:outline-hidden"
            >
              <option value="all">All Ratings (0-100)</option>
              <option value="critical">Critical (&lt;50)</option>
              <option value="needs_review">Needs Review (50-74)</option>
              <option value="good">Good (75-89)</option>
              <option value="optimal">Optimal (90-100)</option>
            </select>
          </div>

          {/* Chapter Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-bold text-slate-400">Chapter:</span>
            <select
              value={selectedChapterFilter}
              onChange={(e) => setSelectedChapterFilter(e.target.value)}
              className="px-2.5 py-1.5 max-w-[200px] truncate bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl font-medium text-slate-700 dark:text-slate-200 text-xs focus:outline-hidden"
            >
              <option value="all">All Chapters</option>
              {chapters.map((ch) => (
                <option key={ch.id} value={ch.id}>
                  {ch.title || (ch as any).name}
                </option>
              ))}
            </select>
          </div>

          {/* Clear Filters Reset */}
          {(selectedIssueFilter !== "all" || selectedRatingFilter !== "all" || selectedChapterFilter !== "all" || searchQuery) && (
            <button
              onClick={() => {
                setSelectedIssueFilter("all");
                setSelectedRatingFilter("all");
                setSelectedChapterFilter("all");
                setSearchQuery("");
              }}
              className="ml-auto text-[11px] font-bold text-[#800020] dark:text-[#F47B20] hover:underline cursor-pointer"
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* 3. Question Cards Feed */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <p className="text-xs font-bold text-slate-500">
            Showing <span className="text-slate-900 dark:text-white font-black">{filteredQuestions.length}</span> question{filteredQuestions.length === 1 ? "" : "s"}
          </p>
          {summary && (
            <p className="text-[10px] text-slate-400">
              Last audited: {new Date(summary.lastAuditedAt).toLocaleTimeString()}
            </p>
          )}
        </div>

        {filteredQuestions.length === 0 ? (
          <div className="p-12 text-center bg-white dark:bg-[#1F2330] rounded-3xl border border-dashed border-slate-300 dark:border-slate-700 space-y-3">
            <ShieldCheck className="w-10 h-10 text-emerald-500 mx-auto" />
            <h4 className="text-base font-black text-slate-900 dark:text-white">No Issues Found for Selected Filter</h4>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              All questions matching your filter criteria meet high pedagogical, formatting, and answer key accuracy standards.
            </p>
            <button
              onClick={() => {
                setSelectedIssueFilter("all");
                setSelectedRatingFilter("all");
                setSelectedChapterFilter("all");
                setSearchQuery("");
              }}
              className="px-4 py-2 bg-slate-900 dark:bg-slate-700 text-white text-xs font-bold rounded-xl cursor-pointer"
            >
              Clear All Filters
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredQuestions.map((item) => {
              const q = item.question;
              const scoreColor = getScoreColor(item.score);
              const correctIdx = q.correctIndex ?? 0;

              return (
                <div
                  key={item.questionId}
                  className={`p-4 sm:p-5 bg-white dark:bg-[#1F2330] border rounded-2xl sm:rounded-3xl shadow-xs transition-all ${
                    item.rating === "critical"
                      ? "border-rose-300 dark:border-rose-900/60"
                      : item.rating === "needs_review"
                      ? "border-amber-300 dark:border-amber-900/60"
                      : "border-slate-200 dark:border-slate-800"
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    {/* Left: Score Badge + Metadata */}
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      {/* Health Score Pill */}
                      <div
                        className={`w-12 h-12 rounded-2xl flex flex-col items-center justify-center font-black text-white shrink-0 shadow-sm ${scoreColor.bg}`}
                        title={`Question Health Score: ${item.score}/100`}
                      >
                        <span className="text-sm leading-none">{item.score}</span>
                        <span className="text-[8px] uppercase tracking-tighter opacity-80 mt-0.5">Score</span>
                      </div>

                      {/* Content Overview */}
                      <div className="space-y-1.5 flex-1 min-w-0">
                        {/* Tags Bar */}
                        <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                          <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-md font-mono font-bold">
                            #{q.id}
                          </span>
                          {q.chapter && (
                            <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-md font-medium truncate max-w-[180px]">
                              {q.chapter}
                            </span>
                          )}
                          {q.examName && (
                            <span className="px-2 py-0.5 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 rounded-md font-bold">
                              {q.examName} {q.year ? `(${q.year})` : ""}
                            </span>
                          )}
                          {/* Performance Telemetry Badge */}
                          {item.performanceMetrics && (
                            <span className="px-2 py-0.5 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 rounded-md font-bold flex items-center gap-1">
                              <BarChart3 className="w-3 h-3" />
                              <span>
                                {item.performanceMetrics.attemptCount} tries • {item.performanceMetrics.accuracy}% acc • {item.performanceMetrics.averageTimeSeconds}s
                              </span>
                            </span>
                          )}
                        </div>

                        {/* Question Text with KaTeX RichText */}
                        <div className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white leading-relaxed">
                          <RichText text={q.text || q.question || ""} />
                        </div>

                        {/* Options preview with duplicate & correct answer markers */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1">
                          {(q.options || []).map((opt, optIdx) => {
                            const isCorrect = optIdx === correctIdx;
                            const isDuplicate = item.issues.some(
                              (iss) => iss.type === "duplicate_options" && iss.message.includes(`Option ${String.fromCharCode(65 + optIdx)}`)
                            );

                            return (
                              <div
                                key={optIdx}
                                className={`px-2.5 py-1.5 rounded-xl text-xs flex items-center gap-2 border transition-all ${
                                  isCorrect
                                    ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 font-bold"
                                    : isDuplicate
                                    ? "bg-rose-50 dark:bg-rose-950/30 border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-200"
                                    : "bg-slate-50/50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300"
                                }`}
                              >
                                <span className={`w-5 h-5 rounded-md flex items-center justify-center font-black text-[10px] shrink-0 ${
                                  isCorrect ? "bg-emerald-600 text-white" : "bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                                }`}>
                                  {String.fromCharCode(65 + optIdx)}
                                </span>
                                <div className="truncate flex-1">
                                  <RichText text={opt} inline />
                                </div>
                                {isCorrect && <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />}
                                {isDuplicate && (
                                  <span className="text-[9px] font-black uppercase text-rose-600 px-1 py-0.5 bg-rose-100 rounded-sm shrink-0">
                                    Duplicate
                                  </span>
                                )}
                              </div>
                            );
                          })}
                        </div>

                        {/* Explanation snippet if present */}
                        {q.explanation && (
                          <div className="p-2 bg-slate-50 dark:bg-slate-900/40 rounded-xl border border-slate-100 dark:border-slate-800/60 text-xs text-slate-600 dark:text-slate-400 space-y-0.5">
                            <span className="text-[10px] font-extrabold uppercase tracking-wide text-slate-400 block">Current Explanation:</span>
                            <div className="line-clamp-2">
                              <RichText text={q.explanation} />
                            </div>
                          </div>
                        )}

                        {/* Issues Pill Tags */}
                        {item.issues.length > 0 && (
                          <div className="flex flex-wrap items-center gap-1.5 pt-1">
                            {item.issues.map((issue) => (
                              <div
                                key={issue.id}
                                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1.5 border ${
                                  issue.severity === "critical"
                                    ? "bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-900/60 text-rose-700 dark:text-rose-300"
                                    : issue.severity === "warning"
                                    ? "bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-900/60 text-amber-700 dark:text-amber-300"
                                    : "bg-blue-50 dark:bg-blue-950/40 border-blue-300 dark:border-blue-900/60 text-blue-700 dark:text-blue-300"
                                }`}
                              >
                                {issue.severity === "critical" ? (
                                  <ShieldAlert className="w-3 h-3 text-rose-500 shrink-0" />
                                ) : issue.severity === "warning" ? (
                                  <AlertTriangle className="w-3 h-3 text-amber-500 shrink-0" />
                                ) : (
                                  <HelpCircle className="w-3 h-3 text-blue-500 shrink-0" />
                                )}
                                <span>{issue.message}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Right: Action Buttons */}
                    <div className="flex sm:flex-col items-center gap-2 shrink-0 self-end sm:self-start pt-2 sm:pt-0">
                      <button
                        onClick={() => handleOpenReview(item)}
                        className="px-3.5 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                        <span>AI Review & Fix</span>
                      </button>

                      {item.aiCorrection && (
                        <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-md">
                          Suggestion Ready
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 4. Side-by-Side AI Review & Approval Modal / Drawer */}
      {activeReviewItem && editForm && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white dark:bg-[#1A1F2C] w-full max-w-4xl rounded-3xl border border-[#E8D9C0] dark:border-[#31374A] shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
            {/* Modal Header */}
            <div className="px-5 py-4 bg-gradient-to-r from-[#800020] to-[#F47B20] text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Brain className="w-5 h-5 text-amber-300" />
                <div>
                  <h3 className="text-sm sm:text-base font-black">AI Answer-Key & Explanation Auditor</h3>
                  <p className="text-[11px] text-amber-100 font-medium">
                    Side-by-side verification: Compare current question with AI suggested corrections
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setActiveReviewItem(null);
                  setAiCorrection(null);
                  setEditForm(null);
                }}
                className="p-1.5 rounded-xl hover:bg-white/20 transition-colors text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 sm:p-6 overflow-y-auto space-y-5 flex-1">
              {isAILoading && (
                <div className="p-3.5 bg-indigo-50 dark:bg-indigo-950/40 rounded-2xl border border-indigo-200 dark:border-indigo-800 flex items-center gap-3">
                  <Sparkles className="w-4 h-4 text-indigo-600 animate-spin" />
                  <span className="text-xs font-bold text-indigo-700 dark:text-indigo-300">
                    AI Auditor analyzing question against academic reference sources & KaTeX grammar...
                  </span>
                </div>
              )}

              {/* Side-by-Side Comparison Container */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Left Column: Current Question */}
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
                    <span className="text-xs font-black uppercase tracking-wider text-slate-500">
                      Current Repository Question
                    </span>
                    <span className="text-xs font-black px-2 py-0.5 rounded-md bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                      Score: {activeReviewItem.score}/100
                    </span>
                  </div>

                  {/* Current Text */}
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Question Stem:</span>
                    <div className="text-xs font-bold text-slate-900 dark:text-white leading-relaxed">
                      <RichText text={activeReviewItem.question.text || activeReviewItem.question.question || ""} />
                    </div>
                  </div>

                  {/* Current Options */}
                  <div className="space-y-1.5">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Current Options:</span>
                    {(activeReviewItem.question.options || []).map((opt, i) => {
                      const isMarked = i === activeReviewItem.question.correctIndex;
                      return (
                        <div
                          key={i}
                          className={`p-2 rounded-xl text-xs flex items-center gap-2 border ${
                            isMarked
                              ? "bg-amber-100/60 dark:bg-amber-950/30 border-amber-300 dark:border-amber-800 font-bold"
                              : "bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700"
                          }`}
                        >
                          <span className={`w-5 h-5 rounded-md flex items-center justify-center font-bold text-[10px] shrink-0 ${
                            isMarked ? "bg-amber-600 text-white" : "bg-slate-100 dark:bg-slate-700 text-slate-600"
                          }`}>
                            {String.fromCharCode(65 + i)}
                          </span>
                          <span className="truncate flex-1">
                            <RichText text={opt} inline />
                          </span>
                          {isMarked && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 bg-amber-500 text-white rounded-md">
                              Marked
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Current Explanation */}
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Current Explanation:</span>
                    <div className="p-2.5 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-300">
                      <RichText text={activeReviewItem.question.explanation || "(No explanation present)"} />
                    </div>
                  </div>

                  {/* Identified Issues */}
                  {activeReviewItem.issues.length > 0 && (
                    <div className="space-y-1 pt-1">
                      <span className="text-[10px] font-bold text-rose-500 uppercase">Detected Issues:</span>
                      <div className="space-y-1">
                        {activeReviewItem.issues.map((iss) => (
                          <div key={iss.id} className="p-2 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 rounded-xl text-xs text-rose-700 dark:text-rose-300 font-medium">
                            {iss.message}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Right Column: AI Suggestion & Editable Fix Form */}
                <div className="p-4 rounded-2xl bg-indigo-50/40 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-900/60 space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-indigo-200 dark:border-indigo-900/60">
                    <div className="flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                      <span className="text-xs font-black uppercase tracking-wider text-indigo-700 dark:text-indigo-300">
                        AI Recommended Correction
                      </span>
                    </div>
                    {aiCorrection && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300">
                        {Math.round(aiCorrection.confidence * 100)}% Confidence ({aiCorrection.source === "ai" ? "Gemini / AI" : "Heuristic Rule"})
                      </span>
                    )}
                  </div>

                  {/* AI Reasoning Notice */}
                  {aiCorrection && (
                    <div className="p-2.5 bg-white dark:bg-slate-800 rounded-xl border border-indigo-100 dark:border-indigo-900 text-xs space-y-1">
                      <span className="text-[10px] font-extrabold uppercase text-indigo-600 dark:text-indigo-400 block">
                        Auditor Rationale:
                      </span>
                      <p className="text-slate-700 dark:text-slate-300 leading-relaxed font-medium">
                        {aiCorrection.reasoning}
                      </p>
                    </div>
                  )}

                  {/* Editable Correct Answer Selection */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-500 uppercase flex items-center justify-between">
                      <span>Verified Correct Option:</span>
                      <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                        Option {String.fromCharCode(65 + editForm.correctIndex)} selected
                      </span>
                    </label>
                    <div className="grid grid-cols-4 gap-2">
                      {[0, 1, 2, 3].map((optIdx) => (
                        <button
                          key={optIdx}
                          type="button"
                          onClick={() => setEditForm((prev) => prev ? { ...prev, correctIndex: optIdx } : null)}
                          className={`py-2 rounded-xl text-xs font-black transition-all cursor-pointer border ${
                            editForm.correctIndex === optIdx
                              ? "bg-emerald-600 text-white border-emerald-600 shadow-md scale-102"
                              : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-emerald-400"
                          }`}
                        >
                          Option {String.fromCharCode(65 + optIdx)}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Editable Options */}
                  <div className="space-y-1.5">
                    <span className="text-[10px] font-bold text-slate-500 uppercase">Corrected Options:</span>
                    {editForm.options.map((optText, oIdx) => (
                      <div key={oIdx} className="flex items-center gap-1.5">
                        <span className={`w-6 h-6 rounded-md flex items-center justify-center font-bold text-xs shrink-0 ${
                          editForm.correctIndex === oIdx
                            ? "bg-emerald-600 text-white"
                            : "bg-slate-200 dark:bg-slate-700 text-slate-600"
                        }`}>
                          {String.fromCharCode(65 + oIdx)}
                        </span>
                        <input
                          type="text"
                          value={optText}
                          onChange={(e) => {
                            const val = e.target.value;
                            setEditForm((prev) => {
                              if (!prev) return null;
                              const nextOpts = [...prev.options];
                              nextOpts[oIdx] = val;
                              return { ...prev, options: nextOpts };
                            });
                          }}
                          className="flex-1 px-3 py-1.5 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-hidden focus:border-indigo-500"
                        />
                      </div>
                    ))}
                  </div>

                  {/* Editable Enhanced Explanation */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase block">
                      Enhanced Bilingual Solution & Explanation:
                    </label>
                    <textarea
                      rows={5}
                      value={editForm.explanation}
                      onChange={(e) => setEditForm((prev) => prev ? { ...prev, explanation: e.target.value } : null)}
                      placeholder="Comprehensive explanation with LaTeX formulas..."
                      className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-hidden focus:border-indigo-500 font-sans leading-relaxed"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer Controls */}
            <div className="px-5 py-3.5 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
              <button
                onClick={() => {
                  setActiveReviewItem(null);
                  setAiCorrection(null);
                  setEditForm(null);
                }}
                className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer"
              >
                Dismiss / Close
              </button>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleApplyFix}
                  disabled={isApplyingFix}
                  className="px-5 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs font-black rounded-xl shadow-md transition-all flex items-center gap-1.5 cursor-pointer active:scale-95 disabled:opacity-50"
                >
                  <CheckCircle className="w-4 h-4" />
                  <span>{isApplyingFix ? "Applying Fix..." : "Accept & Apply Fix to Bank (Live)"}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default QuestionHealthAuditor;
