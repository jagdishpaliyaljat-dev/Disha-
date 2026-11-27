import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  CalendarClock,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Archive,
  ArchiveRestore,
  Sparkles,
  Search,
  Filter,
  ShieldAlert,
  ShieldCheck,
  Check,
  X,
  FileText,
  Download,
  Brain,
  Layers,
  History,
  Tag,
  Clock,
  ArrowRight,
  ExternalLink,
  ChevronRight,
  HelpCircle,
  Database,
} from "lucide-react";
import { Question, Chapter, UserQuestionsStore } from "../../types";
import {
  scanQuestionBankForOutdatedFacts,
  refreshQuestionWithAI,
  applyRefreshedDataToQuestion,
  tagHistoricalProvenanceBadge,
  archiveQuestionToVault,
  restoreQuestionFromVault,
  bulkArchiveQuestionsToVault,
  loadOutdatedAuditCache,
  OutdatedAuditSummary,
  QuestionOutdatedAuditResult,
  StalenessClassification,
  Suggested2024Fix,
} from "../../services/outdatedFactArchiverService";
import {
  loadUserQuestionsStore,
  getCombinedChapters,
  getCombinedQuestions,
  saveUserQuestionsStore,
} from "../../utils/questionsStorage";
import { triggerAdminToast } from "../../utils/adminToast";
import { AdminCard } from "./AdminCard";
import { RichText } from "../RichText";

interface OutdatedQuestionArchiverProps {
  questionsStore?: UserQuestionsStore;
  chapters?: Chapter[];
  onStoreUpdated?: (updatedStore: UserQuestionsStore) => void;
  className?: string;
}

export const OutdatedQuestionArchiver: React.FC<OutdatedQuestionArchiverProps> = ({
  questionsStore: propsStore,
  chapters: propsChapters,
  onStoreUpdated,
  className = "",
}) => {
  // Store & chapters resolution
  const [localStore, setLocalStore] = useState<UserQuestionsStore>(() => propsStore || loadUserQuestionsStore());
  const chapters = useMemo(() => propsChapters || getCombinedChapters(localStore), [propsChapters, localStore]);

  // All combined active questions + archived questions
  const allQuestions = useMemo(() => {
    const active = getCombinedQuestions(chapters, localStore);
    const archived = localStore.archivedQuestions || [];
    const activeIds = new Set(active.map((q) => q.id));
    const combined = [...active];
    archived.forEach((aq) => {
      if (!activeIds.has(aq.id)) {
        combined.push(aq);
      }
    });
    return combined;
  }, [chapters, localStore]);

  // Staleness Summary & Scan State
  const [summary, setSummary] = useState<OutdatedAuditSummary | null>(() => loadOutdatedAuditCache());
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);

  // Active View Filter State
  const [activeTab, setActiveTab] = useState<"flagged" | "critical" | "historical" | "vault">("flagged");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStalenessFilter, setSelectedStalenessFilter] = useState<"all" | StalenessClassification>("all");
  const [selectedChapterFilter, setSelectedChapterFilter] = useState<string>("all");

  // Side-by-side AI 2024-25 Refresher Modal state
  const [activeRefreshItem, setActiveRefreshItem] = useState<QuestionOutdatedAuditResult | null>(null);
  const [isAILoading, setIsAILoading] = useState(false);
  const [suggestedFix, setSuggestedFix] = useState<Suggested2024Fix | null>(null);
  const [editForm, setEditForm] = useState<{
    text: string;
    options: string[];
    correctIndex: number;
    explanation: string;
    sourceCitation: string;
  } | null>(null);
  const [isApplyingFix, setIsApplyingFix] = useState(false);

  // Run full staleness scan
  const runStalenessScan = useCallback(async () => {
    setIsScanning(true);
    setScanProgress(15);

    try {
      await new Promise((r) => setTimeout(r, 60));
      setScanProgress(50);

      const freshSummary = scanQuestionBankForOutdatedFacts(allQuestions, localStore);
      setScanProgress(90);

      await new Promise((r) => setTimeout(r, 60));
      setSummary(freshSummary);
      setScanProgress(100);

      triggerAdminToast({
        type: "success",
        title: "Scan Complete",
        message: `Audited ${allQuestions.length} MCQs. Found ${freshSummary.criticalSupersededCount} superseded facts and ${freshSummary.needsRefreshCount} questions needing 2024-25 update.`,
      });
    } catch (err: any) {
      console.error("Staleness scan failed:", err);
      triggerAdminToast({
        type: "error",
        title: "Scan Failed",
        message: err?.message || "Failed to scan questions.",
      });
    } finally {
      setIsScanning(false);
      setScanProgress(0);
    }
  }, [allQuestions, localStore]);

  // Initial scan if cache absent
  useEffect(() => {
    if (!summary && allQuestions.length > 0) {
      runStalenessScan();
    }
  }, [summary, allQuestions.length, runStalenessScan]);

  // 1-Click AI 2024-25 Data Refresh Trigger
  const handleOpenRefresher = async (item: QuestionOutdatedAuditResult) => {
    setActiveRefreshItem(item);
    setIsAILoading(true);

    // If pre-computed heuristic fix existed, seed it immediately
    if (item.suggested2024Fix) {
      setSuggestedFix(item.suggested2024Fix);
      setEditForm({
        text: item.suggested2024Fix.updatedText,
        options: item.suggested2024Fix.updatedOptions,
        correctIndex: item.suggested2024Fix.updatedCorrectIndex,
        explanation: item.suggested2024Fix.updatedExplanation,
        sourceCitation: item.suggested2024Fix.sourceCitation,
      });
    } else {
      setEditForm({
        text: item.question.text || item.question.question || "",
        options: [...(item.question.options || [])],
        correctIndex: item.question.correctIndex ?? 0,
        explanation: item.question.explanation || "",
        sourceCitation: "Economic Survey & Union/Rajasthan Budget 2024-25",
      });
    }

    try {
      const fix = await refreshQuestionWithAI(item.question, item.indicators);
      setSuggestedFix(fix);
      setEditForm({
        text: fix.updatedText,
        options: fix.updatedOptions,
        correctIndex: fix.updatedCorrectIndex,
        explanation: fix.updatedExplanation,
        sourceCitation: fix.sourceCitation,
      });
    } catch (err) {
      console.error("AI 2024-25 refresh error:", err);
    } finally {
      setIsAILoading(false);
    }
  };

  // Commit refreshed 2024-25 question to store
  const handleApplyRefreshedQuestion = async () => {
    if (!activeRefreshItem || !editForm) return;
    setIsApplyingFix(true);

    try {
      const finalFix: Suggested2024Fix = {
        updatedText: editForm.text,
        updatedOptions: editForm.options,
        updatedCorrectIndex: editForm.correctIndex,
        updatedExplanation: editForm.explanation,
        sourceCitation: editForm.sourceCitation,
        confidence: suggestedFix?.confidence || 0.95,
      };

      const { nextStore, updatedQuestion } = await applyRefreshedDataToQuestion(
        localStore,
        activeRefreshItem.questionId,
        finalFix
      );

      saveUserQuestionsStore(nextStore);
      setLocalStore(nextStore);
      onStoreUpdated?.(nextStore);

      triggerAdminToast({
        type: "success",
        title: "2024-25 Data Refreshed Live",
        message: `Updated Question ${updatedQuestion.id} with latest official 2024-25 data.`,
      });

      // Update in summary
      if (summary) {
        const updatedResults = summary.results.map((r) => {
          if (r.questionId === activeRefreshItem.questionId) {
            return {
              ...r,
              question: updatedQuestion,
              classification: "evergreen" as StalenessClassification,
              riskScore: 0,
              refreshedToYear: "2024-25",
            };
          }
          return r;
        });
        const freshSummary = {
          ...summary,
          results: updatedResults,
          criticalSupersededCount: updatedResults.filter((r) => r.classification === "critical_superseded").length,
          needsRefreshCount: updatedResults.filter((r) => r.classification === "needs_refresh").length,
        };
        setSummary(freshSummary);
      }

      setActiveRefreshItem(null);
      setSuggestedFix(null);
      setEditForm(null);
    } catch (err: any) {
      console.error("Apply refresh failed:", err);
      triggerAdminToast({
        type: "error",
        title: "Update Failed",
        message: err?.message || "Could not save refreshed question.",
      });
    } finally {
      setIsApplyingFix(false);
    }
  };

  // 1-Click Action: Tag as Historical PYQ Provenance
  const handleTagHistoricalPYQ = async (item: QuestionOutdatedAuditResult) => {
    try {
      const { nextStore, updatedQuestion } = await tagHistoricalProvenanceBadge(
        localStore,
        item.questionId,
        item.detectedYear
      );

      saveUserQuestionsStore(nextStore);
      setLocalStore(nextStore);
      onStoreUpdated?.(nextStore);

      triggerAdminToast({
        type: "success",
        title: "Historical Provenance Tagged",
        message: `Tagged Question ${updatedQuestion.id} with past exam context.`,
      });

      if (summary) {
        const updatedResults = summary.results.map((r) =>
          r.questionId === item.questionId
            ? { ...r, question: updatedQuestion, hasProvenanceBadge: true, riskScore: 10 }
            : r
        );
        setSummary({ ...summary, results: updatedResults });
      }
    } catch (err: any) {
      triggerAdminToast({
        type: "error",
        title: "Tagging Failed",
        message: err?.message || "Could not tag question.",
      });
    }
  };

  // 1-Click Action: Move Outdated Question to Vault
  const handleArchiveQuestion = async (item: QuestionOutdatedAuditResult) => {
    try {
      const { nextStore, archivedQuestion } = await archiveQuestionToVault(
        localStore,
        item.questionId,
        item.indicators[0]?.explanation || "Outdated statistics superseded by 2024-25 data"
      );

      saveUserQuestionsStore(nextStore);
      setLocalStore(nextStore);
      onStoreUpdated?.(nextStore);

      triggerAdminToast({
        type: "success",
        title: "Moved to Archive Vault",
        message: `Question ${archivedQuestion.id} safely archived. Active practice sets remain 100% current.`,
      });

      if (summary) {
        const updatedResults = summary.results.map((r) =>
          r.questionId === item.questionId ? { ...r, isArchived: true } : r
        );
        setSummary({
          ...summary,
          archivedCount: summary.archivedCount + 1,
          results: updatedResults,
        });
      }
    } catch (err: any) {
      triggerAdminToast({
        type: "error",
        title: "Archive Failed",
        message: err?.message || "Could not archive question.",
      });
    }
  };

  // 1-Click Action: Restore Question from Vault
  const handleRestoreQuestion = async (item: QuestionOutdatedAuditResult) => {
    try {
      const { nextStore, restoredQuestion } = await restoreQuestionFromVault(
        localStore,
        item.questionId
      );

      saveUserQuestionsStore(nextStore);
      setLocalStore(nextStore);
      onStoreUpdated?.(nextStore);

      triggerAdminToast({
        type: "success",
        title: "Restored to Active Bank",
        message: `Question ${restoredQuestion.id} restored to active practice repository.`,
      });

      if (summary) {
        const updatedResults = summary.results.map((r) =>
          r.questionId === item.questionId ? { ...r, isArchived: false } : r
        );
        setSummary({
          ...summary,
          archivedCount: Math.max(0, summary.archivedCount - 1),
          results: updatedResults,
        });
      }
    } catch (err: any) {
      triggerAdminToast({
        type: "error",
        title: "Restore Failed",
        message: err?.message || "Could not restore question.",
      });
    }
  };

  // Bulk Archive Action
  const handleBulkArchiveCritical = async () => {
    if (!summary) return;
    const criticalIds = summary.results
      .filter((r) => r.classification === "critical_superseded" && !r.isArchived)
      .map((r) => r.questionId);

    if (criticalIds.length === 0) {
      triggerAdminToast({
        type: "info",
        title: "No Critical Outdated Questions",
        message: "No unarchived critical superseded questions found.",
      });
      return;
    }

    try {
      const { nextStore, archivedCount } = await bulkArchiveQuestionsToVault(
        localStore,
        criticalIds
      );
      saveUserQuestionsStore(nextStore);
      setLocalStore(nextStore);
      onStoreUpdated?.(nextStore);

      triggerAdminToast({
        type: "success",
        title: "Bulk Archive Complete",
        message: `Safely moved ${archivedCount} outdated questions to Historical Vault.`,
      });

      // Refresh scan
      runStalenessScan();
    } catch (err: any) {
      triggerAdminToast({
        type: "error",
        title: "Bulk Archive Failed",
        message: err?.message || "Could not complete bulk archive.",
      });
    }
  };

  // Export Expiry Report
  const handleExportReport = () => {
    if (!summary) return;
    const reportData = {
      generatedAt: new Date().toISOString(),
      totalScanned: summary.totalScanned,
      counts: {
        criticalSuperseded: summary.criticalSupersededCount,
        needsRefresh: summary.needsRefreshCount,
        historicalPYQ: summary.historicalPyqCount,
        archivedInVault: summary.archivedCount,
        evergreen: summary.evergreenCount,
      },
      flaggedQuestions: summary.results
        .filter((r) => r.classification !== "evergreen" || r.isArchived)
        .map((r) => ({
          id: r.questionId,
          classification: r.classification,
          riskScore: r.riskScore,
          detectedYear: r.detectedYear,
          isArchived: r.isArchived,
          hasProvenanceBadge: r.hasProvenanceBadge,
          refreshedToYear: r.refreshedToYear,
          text: r.question.text,
          indicators: r.indicators.map((i) => `[${i.category}] ${i.explanation}`),
        })),
    };

    const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `disha-outdated-facts-report-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    triggerAdminToast({
      type: "success",
      title: "Report Exported",
      message: "Outdated fact audit report downloaded as JSON.",
    });
  };

  // Filtered Questions List
  const filteredQuestions = useMemo(() => {
    if (!summary) return [];

    return summary.results.filter((item) => {
      // 1. Tab view filter
      if (activeTab === "critical" && (item.classification !== "critical_superseded" || item.isArchived)) {
        return false;
      }
      if (activeTab === "historical" && item.classification !== "historical_pyq") {
        return false;
      }
      if (activeTab === "vault" && !item.isArchived) {
        return false;
      }
      if (activeTab === "flagged" && (item.classification === "evergreen" && !item.isArchived)) {
        return false;
      }

      // 2. Staleness filter
      if (selectedStalenessFilter !== "all" && item.classification !== selectedStalenessFilter) {
        return false;
      }

      // 3. Chapter filter
      if (selectedChapterFilter !== "all") {
        if (item.question.chapterId !== selectedChapterFilter && item.question.chapter !== selectedChapterFilter) {
          return false;
        }
      }

      // 4. Search query
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
  }, [summary, activeTab, selectedStalenessFilter, selectedChapterFilter, searchQuery]);

  return (
    <div className={`space-y-6 ${className}`}>
      {/* 1. Header Hero Card */}
      <AdminCard
        title="Outdated Data & Fact Expiry Controller (आउटडेटेड व पुराने प्रश्नों का ऑटो-आर्काइवर)"
        subtitle="Detects past fiscal years, obsolete budget targets & superseded economic facts. 1-click AI 2024-25 refresh, historical PYQ provenance tagging, and zero-data-loss archive vault."
        icon={CalendarClock}
        headerAction={
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleBulkArchiveCritical}
              disabled={!summary || summary.criticalSupersededCount === 0}
              className="px-3 py-1.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 hover:border-rose-500 text-rose-700 dark:text-rose-300 text-xs font-bold rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              title="Safely moves all critical superseded questions to Archive Vault"
            >
              <Archive className="w-3.5 h-3.5 text-rose-500" />
              <span className="hidden sm:inline">Bulk Archive Outdated</span>
            </button>

            <button
              onClick={handleExportReport}
              disabled={!summary}
              className="px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-blue-500 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5 text-blue-500" />
              <span className="hidden sm:inline">Export Audit</span>
            </button>

            <button
              onClick={runStalenessScan}
              disabled={isScanning}
              className="px-4 py-1.5 bg-gradient-to-r from-amber-600 via-orange-600 to-[#800020] text-white text-xs font-black rounded-xl shadow-md transition-all flex items-center gap-1.5 cursor-pointer active:scale-95 disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isScanning ? "animate-spin" : ""}`} />
              <span>{isScanning ? "Scanning Dates..." : "Scan Bank for Outdated Facts"}</span>
            </button>
          </div>
        }
      >
        {/* Progress bar during scan */}
        {isScanning && (
          <div className="mb-4">
            <div className="flex items-center justify-between text-xs font-bold mb-1 text-slate-500">
              <span>Scanning economic survey years, policy rates & district figures...</span>
              <span>{scanProgress}%</span>
            </div>
            <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
              <div
                className="bg-gradient-to-r from-amber-600 to-[#800020] h-2 rounded-full transition-all duration-300"
                style={{ width: `${scanProgress}%` }}
              />
            </div>
          </div>
        )}

        {/* Top Metric Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 pt-1">
          {/* Total Audited */}
          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Total Scanned</p>
              <Database className="w-4 h-4 text-slate-400" />
            </div>
            <p className="text-xl font-black text-slate-900 dark:text-white mt-1">
              {summary ? summary.totalScanned : allQuestions.length}
            </p>
            <p className="text-[10px] text-slate-500 font-medium">Full MCQ repository</p>
          </div>

          {/* Critical Superseded */}
          <div
            onClick={() => {
              setActiveTab("critical");
              setSelectedStalenessFilter("critical_superseded");
            }}
            className="p-3.5 rounded-2xl bg-rose-50/50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/50 cursor-pointer hover:border-rose-400 transition-colors"
          >
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-extrabold uppercase tracking-wider text-rose-600 dark:text-rose-400">
                Superseded Facts
              </p>
              <ShieldAlert className="w-4 h-4 text-rose-500" />
            </div>
            <p className="text-xl font-black text-rose-600 dark:text-rose-400 mt-1">
              {summary ? summary.criticalSupersededCount : 0}
            </p>
            <p className="text-[10px] text-rose-500 font-medium">Old rates / wrong answers</p>
          </div>

          {/* Needs 2024-25 Refresh */}
          <div
            onClick={() => {
              setActiveTab("flagged");
              setSelectedStalenessFilter("needs_refresh");
            }}
            className="p-3.5 rounded-2xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50 cursor-pointer hover:border-amber-400 transition-colors"
          >
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-extrabold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                Needs 2024-25
              </p>
              <CalendarClock className="w-4 h-4 text-amber-500" />
            </div>
            <p className="text-xl font-black text-amber-600 dark:text-amber-400 mt-1">
              {summary ? summary.needsRefreshCount : 0}
            </p>
            <p className="text-[10px] text-amber-500 font-medium">Update to latest budget</p>
          </div>

          {/* Historical PYQs */}
          <div
            onClick={() => {
              setActiveTab("historical");
              setSelectedStalenessFilter("historical_pyq");
            }}
            className="p-3.5 rounded-2xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/50 cursor-pointer hover:border-blue-400 transition-colors"
          >
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-extrabold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                Historical PYQs
              </p>
              <History className="w-4 h-4 text-blue-500" />
            </div>
            <p className="text-xl font-black text-blue-600 dark:text-blue-400 mt-1">
              {summary ? summary.historicalPyqCount : 0}
            </p>
            <p className="text-[10px] text-blue-500 font-medium">Past exam provenance</p>
          </div>

          {/* Archived in Vault */}
          <div
            onClick={() => {
              setActiveTab("vault");
              setSelectedStalenessFilter("all");
            }}
            className="p-3.5 rounded-2xl bg-purple-50/50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-900/50 cursor-pointer hover:border-purple-400 transition-colors"
          >
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-extrabold uppercase tracking-wider text-purple-600 dark:text-purple-400">
                Archive Vault
              </p>
              <Archive className="w-4 h-4 text-purple-500" />
            </div>
            <p className="text-xl font-black text-purple-600 dark:text-purple-400 mt-1">
              {summary ? summary.archivedCount : localStore.archivedQuestions?.length || 0}
            </p>
            <p className="text-[10px] text-purple-500 font-medium">Preserved without loss</p>
          </div>

          {/* Evergreen Static GK */}
          <div
            onClick={() => {
              setActiveTab("flagged");
              setSelectedStalenessFilter("evergreen");
            }}
            className="p-3.5 rounded-2xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/50 cursor-pointer hover:border-emerald-400 transition-colors"
          >
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                Evergreen Static
              </p>
              <ShieldCheck className="w-4 h-4 text-emerald-500" />
            </div>
            <p className="text-xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
              {summary ? summary.evergreenCount : 0}
            </p>
            <p className="text-[10px] text-emerald-500 font-medium">Timeless concepts</p>
          </div>
        </div>
      </AdminCard>

      {/* 2. Controls & Filter Bar */}
      <div className="bg-white dark:bg-[#1F2330] p-4 rounded-2xl sm:rounded-3xl border border-[#E8D9C0] dark:border-[#31374A] shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Subtabs */}
          <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-800 rounded-xl overflow-x-auto no-scrollbar">
            <button
              onClick={() => {
                setActiveTab("flagged");
                setSelectedStalenessFilter("all");
              }}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all whitespace-nowrap cursor-pointer ${
                activeTab === "flagged"
                  ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs"
                  : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              All Outdated Flags ({(summary?.criticalSupersededCount || 0) + (summary?.needsRefreshCount || 0) + (summary?.historicalPyqCount || 0)})
            </button>

            <button
              onClick={() => {
                setActiveTab("critical");
                setSelectedStalenessFilter("critical_superseded");
              }}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                activeTab === "critical"
                  ? "bg-rose-500 text-white shadow-xs"
                  : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>Critical Superseded ({summary?.criticalSupersededCount || 0})</span>
            </button>

            <button
              onClick={() => {
                setActiveTab("historical");
                setSelectedStalenessFilter("historical_pyq");
              }}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                activeTab === "historical"
                  ? "bg-[#7045D8] text-white shadow-xs"
                  : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <History className="w-3.5 h-3.5" />
              <span>Historical PYQ Provenance ({summary?.historicalPyqCount || 0})</span>
            </button>

            <button
              onClick={() => {
                setActiveTab("vault");
                setSelectedStalenessFilter("all");
              }}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                activeTab === "vault"
                  ? "bg-purple-600 text-white shadow-xs"
                  : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <Archive className="w-3.5 h-3.5" />
              <span>Archive Vault ({summary?.archivedCount || 0})</span>
            </button>
          </div>

          {/* Search Input */}
          <div className="relative flex-1 max-w-sm">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search year, GDP, Repo rate, question..."
              className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-hidden focus:border-amber-600"
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

        {/* Filter Dropdowns */}
        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-100 dark:border-slate-800 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-bold text-slate-400">Category:</span>
            <select
              value={selectedStalenessFilter}
              onChange={(e) => setSelectedStalenessFilter(e.target.value as any)}
              className="px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl font-medium text-slate-700 dark:text-slate-200 text-xs focus:outline-hidden"
            >
              <option value="all">All Categories</option>
              <option value="critical_superseded">Critical Superseded (पुराने आंकड़े)</option>
              <option value="needs_refresh">Needs 2024-25 Refresh</option>
              <option value="historical_pyq">Historical PYQ Provenance</option>
              <option value="evergreen">Evergreen Static GK</option>
            </select>
          </div>

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

          {(selectedStalenessFilter !== "all" || selectedChapterFilter !== "all" || searchQuery) && (
            <button
              onClick={() => {
                setSelectedStalenessFilter("all");
                setSelectedChapterFilter("all");
                setSearchQuery("");
              }}
              className="ml-auto text-[11px] font-bold text-amber-600 dark:text-amber-400 hover:underline cursor-pointer"
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* 3. Question Feed */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <p className="text-xs font-bold text-slate-500">
            Showing <span className="text-slate-900 dark:text-white font-black">{filteredQuestions.length}</span> question{filteredQuestions.length === 1 ? "" : "s"}
          </p>
          {summary && (
            <p className="text-[10px] text-slate-400">
              Audit scan: {new Date(summary.lastScannedAt).toLocaleTimeString()}
            </p>
          )}
        </div>

        {filteredQuestions.length === 0 ? (
          <div className="p-12 text-center bg-white dark:bg-[#1F2330] rounded-3xl border border-dashed border-slate-300 dark:border-slate-700 space-y-3">
            <ShieldCheck className="w-10 h-10 text-emerald-500 mx-auto" />
            <h4 className="text-base font-black text-slate-900 dark:text-white">No Outdated Facts in Current View</h4>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              All questions matching your filter criteria are either up-to-date with 2024-25 data or appropriately tagged with historical exam context.
            </p>
            <button
              onClick={() => {
                setSelectedStalenessFilter("all");
                setSelectedChapterFilter("all");
                setSearchQuery("");
              }}
              className="px-4 py-2 bg-slate-900 dark:bg-slate-700 text-white text-xs font-bold rounded-xl cursor-pointer"
            >
              Reset View
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredQuestions.map((item) => {
              const q = item.question;
              const correctIdx = q.correctIndex ?? 0;

              return (
                <div
                  key={item.questionId}
                  className={`p-4 sm:p-5 bg-white dark:bg-[#1F2330] border rounded-2xl sm:rounded-3xl shadow-xs transition-all ${
                    item.isArchived
                      ? "border-purple-300 dark:border-purple-900/60 bg-purple-50/10 dark:bg-purple-950/10"
                      : item.classification === "critical_superseded"
                      ? "border-rose-300 dark:border-rose-900/60 bg-rose-50/10 dark:bg-rose-950/10"
                      : item.classification === "needs_refresh"
                      ? "border-amber-300 dark:border-amber-900/60 bg-amber-50/10 dark:bg-amber-950/10"
                      : "border-slate-200 dark:border-slate-800"
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    {/* Left: Metadata & Question Text */}
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      {/* Classification Badge Pill */}
                      <div
                        className={`w-11 h-11 rounded-2xl flex flex-col items-center justify-center font-black text-white shrink-0 shadow-sm ${
                          item.isArchived
                            ? "bg-purple-600"
                            : item.classification === "critical_superseded"
                            ? "bg-rose-600"
                            : item.classification === "needs_refresh"
                            ? "bg-amber-600"
                            : item.classification === "historical_pyq"
                            ? "bg-[#7045D8]"
                            : "bg-emerald-600"
                        }`}
                      >
                        {item.isArchived ? (
                          <Archive className="w-5 h-5 text-white" />
                        ) : item.classification === "critical_superseded" ? (
                          <ShieldAlert className="w-5 h-5 text-white" />
                        ) : item.classification === "needs_refresh" ? (
                          <CalendarClock className="w-5 h-5 text-white" />
                        ) : (
                          <History className="w-5 h-5 text-white" />
                        )}
                      </div>

                      {/* Main Details */}
                      <div className="space-y-1.5 flex-1 min-w-0">
                        {/* Tags Bar */}
                        <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                          <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-md font-mono font-bold">
                            #{q.id}
                          </span>

                          {item.detectedYear && (
                            <span className="px-2 py-0.5 bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 rounded-md font-bold">
                              Year: {item.detectedYear}
                            </span>
                          )}

                          {q.refreshedToYear && (
                            <span className="px-2 py-0.5 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 rounded-md font-bold flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" />
                              <span>Refreshed: {q.refreshedToYear}</span>
                            </span>
                          )}

                          {item.hasProvenanceBadge && (
                            <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 rounded-md font-bold">
                              Historical Provenance Tagged
                            </span>
                          )}

                          {item.isArchived && (
                            <span className="px-2 py-0.5 bg-purple-100 dark:bg-purple-950/60 text-purple-800 dark:text-purple-300 rounded-md font-bold">
                              In Archive Vault
                            </span>
                          )}
                        </div>

                        {/* Question Text */}
                        <div className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white leading-relaxed">
                          <RichText text={q.text || q.question || ""} />
                        </div>

                        {/* Options preview */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1">
                          {(q.options || []).map((opt, optIdx) => {
                            const isCorrect = optIdx === correctIdx;
                            return (
                              <div
                                key={optIdx}
                                className={`px-2.5 py-1.5 rounded-xl text-xs flex items-center gap-2 border ${
                                  isCorrect
                                    ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 font-bold"
                                    : "bg-slate-50/50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300"
                                }`}
                              >
                                <span className={`w-5 h-5 rounded-md flex items-center justify-center font-bold text-[10px] shrink-0 ${
                                  isCorrect ? "bg-emerald-600 text-white" : "bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                                }`}>
                                  {String.fromCharCode(65 + optIdx)}
                                </span>
                                <span className="truncate flex-1">
                                  <RichText text={opt} inline />
                                </span>
                                {isCorrect && <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />}
                              </div>
                            );
                          })}
                        </div>

                        {/* Identified Obsolete Indicators */}
                        {item.indicators.length > 0 && (
                          <div className="space-y-1 pt-1">
                            {item.indicators.map((ind, iIdx) => (
                              <div
                                key={iIdx}
                                className="p-2 bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 rounded-xl text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2"
                              >
                                <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                                <div>
                                  <span className="font-bold">[{ind.matchedText}]: </span>
                                  <span>{ind.explanation}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Right: Action Buttons */}
                    <div className="flex sm:flex-col items-center gap-2 shrink-0 self-end sm:self-start pt-2 sm:pt-0">
                      {/* AI 2024-25 Refresh Button */}
                      <button
                        onClick={() => handleOpenRefresher(item)}
                        className="px-3.5 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                        <span>AI 2024-25 Refresh</span>
                      </button>

                      {/* Tag Historical PYQ Provenance */}
                      {!item.hasProvenanceBadge && !item.isArchived && (
                        <button
                          onClick={() => handleTagHistoricalPYQ(item)}
                          className="px-3 py-1.5 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 hover:border-blue-500 text-blue-700 dark:text-blue-300 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
                        >
                          <Tag className="w-3.5 h-3.5" />
                          <span>Tag Historical PYQ</span>
                        </button>
                      )}

                      {/* Archive to Vault / Restore Button */}
                      {item.isArchived ? (
                        <button
                          onClick={() => handleRestoreQuestion(item)}
                          className="px-3 py-1.5 bg-purple-100 dark:bg-purple-950/60 border border-purple-300 dark:border-purple-800 hover:border-purple-600 text-purple-800 dark:text-purple-300 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
                        >
                          <ArchiveRestore className="w-3.5 h-3.5" />
                          <span>Restore from Vault</span>
                        </button>
                      ) : (
                        <button
                          onClick={() => handleArchiveQuestion(item)}
                          className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-slate-200 dark:border-slate-700 hover:border-rose-300 text-slate-700 hover:text-rose-700 dark:text-slate-300 dark:hover:text-rose-300 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
                          title="Moves question out of active practice tests into the safe archive vault"
                        >
                          <Archive className="w-3.5 h-3.5" />
                          <span>Archive to Vault</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 4. Side-by-Side AI 2024-25 Refresher Drawer / Modal */}
      {activeRefreshItem && editForm && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white dark:bg-[#1A1F2C] w-full max-w-4xl rounded-3xl border border-[#E8D9C0] dark:border-[#31374A] shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
            {/* Modal Header */}
            <div className="px-5 py-4 bg-gradient-to-r from-emerald-700 via-teal-700 to-[#800020] text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Brain className="w-5 h-5 text-amber-300" />
                <div>
                  <h3 className="text-sm sm:text-base font-black">AI 2024-25 Data Refresher Engine</h3>
                  <p className="text-[11px] text-emerald-100 font-medium">
                    Updates superseded economic survey & budget stats to official 2024-25 benchmarks
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setActiveRefreshItem(null);
                  setSuggestedFix(null);
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
                    Querying Economic Survey 2024-25, Union Budget & Rajasthan official gazettes...
                  </span>
                </div>
              )}

              {/* Side-by-Side Comparison Container */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Left Column: Outdated Question */}
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
                    <span className="text-xs font-black uppercase tracking-wider text-slate-500">
                      Original Outdated Question
                    </span>
                    <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300">
                      Year: {activeRefreshItem.detectedYear || "Old Data"}
                    </span>
                  </div>

                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Question Stem:</span>
                    <div className="text-xs font-bold text-slate-900 dark:text-white leading-relaxed">
                      <RichText text={activeRefreshItem.question.text || activeRefreshItem.question.question || ""} />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Original Options:</span>
                    {(activeRefreshItem.question.options || []).map((opt, i) => {
                      const isMarked = i === activeRefreshItem.question.correctIndex;
                      return (
                        <div
                          key={i}
                          className={`p-2 rounded-xl text-xs flex items-center gap-2 border ${
                            isMarked
                              ? "bg-amber-100/60 dark:bg-amber-950/30 border-amber-300 dark:border-amber-800 font-bold"
                              : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700"
                          }`}
                        >
                          <span className="w-5 h-5 rounded-md bg-slate-200 dark:bg-slate-700 flex items-center justify-center font-bold text-[10px]">
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

                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Original Explanation:</span>
                    <div className="p-2.5 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-300">
                      <RichText text={activeRefreshItem.question.explanation || "(None)"} />
                    </div>
                  </div>
                </div>

                {/* Right Column: Refreshed 2024-25 Question (Editable) */}
                <div className="p-4 rounded-2xl bg-emerald-50/40 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/60 space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-emerald-200 dark:border-emerald-900/60">
                    <div className="flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                      <span className="text-xs font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                        Refreshed 2024-25 Data
                      </span>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300">
                      Target: FY 2024-25
                    </span>
                  </div>

                  {/* Editable Question Text */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase block">
                      Updated Question Statement:
                    </label>
                    <textarea
                      rows={2}
                      value={editForm.text}
                      onChange={(e) => setEditForm((prev) => prev ? { ...prev, text: e.target.value } : null)}
                      className="w-full px-3 py-1.5 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-hidden focus:border-emerald-500 font-sans"
                    />
                  </div>

                  {/* Verified Correct Option Selector */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-500 uppercase flex items-center justify-between">
                      <span>2024-25 Correct Option:</span>
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
                          className={`py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer border ${
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

                  {/* Updated Options */}
                  <div className="space-y-1.5">
                    <span className="text-[10px] font-bold text-slate-500 uppercase">Updated 2024-25 Options:</span>
                    {editForm.options.map((optText, oIdx) => (
                      <div key={oIdx} className="flex items-center gap-1.5">
                        <span className={`w-6 h-6 rounded-md flex items-center justify-center font-bold text-xs shrink-0 ${
                          editForm.correctIndex === oIdx ? "bg-emerald-600 text-white" : "bg-slate-200 dark:bg-slate-700 text-slate-600"
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
                              const next = [...prev.options];
                              next[oIdx] = val;
                              return { ...prev, options: next };
                            });
                          }}
                          className="flex-1 px-3 py-1.5 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-hidden focus:border-emerald-500"
                        />
                      </div>
                    ))}
                  </div>

                  {/* Updated Explanation */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase block">
                      Updated Explanation & Official Source Citation:
                    </label>
                    <textarea
                      rows={3}
                      value={editForm.explanation}
                      onChange={(e) => setEditForm((prev) => prev ? { ...prev, explanation: e.target.value } : null)}
                      className="w-full px-3 py-1.5 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-hidden focus:border-emerald-500 font-sans"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer Controls */}
            <div className="px-5 py-3.5 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
              <button
                onClick={() => {
                  setActiveRefreshItem(null);
                  setSuggestedFix(null);
                  setEditForm(null);
                }}
                className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer"
              >
                Cancel / Dismiss
              </button>

              <button
                onClick={handleApplyRefreshedQuestion}
                disabled={isApplyingFix}
                className="px-5 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs font-black rounded-xl shadow-md transition-all flex items-center gap-1.5 cursor-pointer active:scale-95 disabled:opacity-50"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{isApplyingFix ? "Saving 2024-25 Data..." : "Accept & Apply 2024-25 Refresh (Live)"}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OutdatedQuestionArchiver;
