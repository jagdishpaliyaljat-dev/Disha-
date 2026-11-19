import React, { useState, useEffect, useMemo } from "react";
import {
  X,
  Search,
  AlertTriangle,
  CheckCircle2,
  Trash2,
  RefreshCw,
  Sliders,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  ShieldAlert,
  ArrowRight,
  Database,
  Filter,
  Layers,
  Sparkles,
  Info,
  Check,
} from "lucide-react";
import { Question, Chapter } from "../../types";
import {
  scanQuestionsForFuzzyDuplicates,
  DuplicateScanReport,
  FuzzyDuplicateGroup,
  calculateQuestionSimilarity,
} from "../../utils/questionSimilarity";
import { deleteQuestionFromSupabase, deleteQuestionsBulkFromSupabase } from "../../utils/supabaseSyncService";
import { loadUserQuestionsStore, getCombinedChapters, getCombinedQuestions, saveUserQuestionsStore } from "../../utils/questionsStorage";
import { triggerAdminToast } from "../../utils/adminToast";

interface DuplicateQuestionsHubModalProps {
  isOpen: boolean;
  onClose: () => void;
  chapters?: Chapter[];
  onQuestionsUpdated?: () => void;
}

export const DuplicateQuestionsHubModal: React.FC<DuplicateQuestionsHubModalProps> = ({
  isOpen,
  onClose,
  chapters = [],
  onQuestionsUpdated,
}) => {
  const [threshold, setThreshold] = useState<number>(0.90); // 90% default
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState("");
  const [scanReport, setScanReport] = useState<DuplicateScanReport | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterBand, setFilterBand] = useState<"all" | "exact" | "95plus" | "90to95">("all");
  const [expandedGroupId, setExpandedGroupId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  // Load all current questions across syllabus and local storage
  const allCurrentQuestions = useMemo(() => {
    try {
      const store = loadUserQuestionsStore();
      const currentChapters = chapters.length > 0 ? chapters : getCombinedChapters(store);
      return getCombinedQuestions(currentChapters, store);
    } catch {
      return [];
    }
  }, [chapters, isOpen]);

  // Run the fuzzy duplicate scan
  const handleRunScan = async (selectedThreshold = threshold) => {
    setIsScanning(true);
    setScanProgress("प्रश्न बैंक से डेटा लोड किया जा रहा है...");

    // Yield to let UI update
    await new Promise((r) => setTimeout(r, 60));

    try {
      const report = scanQuestionsForFuzzyDuplicates(
        allCurrentQuestions,
        selectedThreshold,
        (text, curr, total) => {
          setScanProgress(`${text} (${curr}/${total})`);
        }
      );
      setScanReport(report);
      if (report.duplicateGroupCount > 0) {
        setExpandedGroupId(report.groups[0].groupId);
      }
      triggerAdminToast(
        report.duplicateGroupCount > 0 ? "info" : "success",
        "स्कैन पूर्ण",
        `${report.totalScanned} प्रश्नों में से ${report.duplicateGroupCount} डुप्लीकेट समूह (कुल ${report.totalDuplicateCopies} प्रतियां) मिले।`
      );
    } catch (err: any) {
      console.error("Scan error:", err);
      triggerAdminToast(
        "error",
        "स्कैन विफल",
        err?.message || "डुप्लीकेट स्कैन में त्रुटि आई।"
      );
    } finally {
      setIsScanning(false);
      setScanProgress("");
    }
  };

  // Auto scan on initial open if not scanned yet
  useEffect(() => {
    if (isOpen && !scanReport && allCurrentQuestions.length > 0) {
      handleRunScan(threshold);
    }
  }, [isOpen]);

  // Delete a specific duplicate question
  const handleDeleteDuplicate = async (groupId: string, questionId: string) => {
    if (!window.confirm("क्या आप वाकई इस डुप्लीकेट प्रश्न को स्थायी रूप से हटाना चाहते हैं?")) {
      return;
    }

    setIsDeleting(questionId);
    try {
      // 1. Delete from Supabase & sync service
      await deleteQuestionFromSupabase(questionId);

      // 2. Remove locally from store
      const store = loadUserQuestionsStore();
      if (!store.deletedQuestionIds) store.deletedQuestionIds = [];
      if (!store.deletedQuestionIds.includes(questionId)) {
        store.deletedQuestionIds.push(questionId);
      }
      if (store.customQuestions) {
        store.customQuestions = store.customQuestions.filter((q) => q.id !== questionId);
      }
      saveUserQuestionsStore(store);

      // 3. Update local scan report state
      if (scanReport) {
        const updatedGroups = scanReport.groups
          .map((grp) => {
            if (grp.groupId === groupId) {
              const remainingDups = grp.duplicates.filter((d) => d.question.id !== questionId);
              return {
                ...grp,
                duplicates: remainingDups,
                count: remainingDups.length + 1,
              };
            }
            return grp;
          })
          .filter((grp) => grp.duplicates.length > 0);

        setScanReport({
          ...scanReport,
          groups: updatedGroups,
          duplicateGroupCount: updatedGroups.length,
          totalDuplicateCopies: Math.max(0, scanReport.totalDuplicateCopies - 1),
        });
      }

      triggerAdminToast(
        "delete",
        "डुप्लीकेट हटाया गया",
        `प्रश्न (ID: ${questionId}) को सफलतापूर्वक हटा दिया गया।`
      );

      if (onQuestionsUpdated) {
        onQuestionsUpdated();
      }
    } catch (err: any) {
      triggerAdminToast(
        "error",
        "डिलीट विफल",
        err?.message || "प्रश्न हटाने में त्रुटि आई।"
      );
    } finally {
      setIsDeleting(null);
    }
  };

  // 1-Click Group Clean: Keep canonical, delete all duplicates in that group
  const handleCleanGroup = async (group: FuzzyDuplicateGroup) => {
    const dupIds = group.duplicates.map((d) => d.question.id).filter(Boolean);
    if (dupIds.length === 0) return;

    if (!window.confirm(`क्या आप इस समूह की सभी ${dupIds.length} डुप्लीकेट प्रतियों को हटाकर केवल मुख्य प्रश्न रखना चाहते हैं?`)) {
      return;
    }

    setIsDeleting(group.groupId);
    try {
      await deleteQuestionsBulkFromSupabase(dupIds);

      // Update store
      const store = loadUserQuestionsStore();
      if (!store.deletedQuestionIds) store.deletedQuestionIds = [];
      dupIds.forEach((id) => {
        if (!store.deletedQuestionIds.includes(id)) {
          store.deletedQuestionIds.push(id);
        }
      });
      if (store.customQuestions) {
        store.customQuestions = store.customQuestions.filter((q) => !dupIds.includes(q.id));
      }
      saveUserQuestionsStore(store);

      // Update scan report
      if (scanReport) {
        const updatedGroups = scanReport.groups.filter((g) => g.groupId !== group.groupId);
        setScanReport({
          ...scanReport,
          groups: updatedGroups,
          duplicateGroupCount: updatedGroups.length,
          totalDuplicateCopies: Math.max(0, scanReport.totalDuplicateCopies - dupIds.length),
        });
      }

      triggerAdminToast(
        "delete",
        "समूह साफ किया गया",
        `${dupIds.length} डुप्लीकेट प्रतियां हटा दी गईं, मुख्य प्रश्न सुरक्षित रखा गया।`
      );

      if (onQuestionsUpdated) {
        onQuestionsUpdated();
      }
    } catch (err: any) {
      triggerAdminToast(
        "error",
        "त्रुटि",
        err?.message || "प्रतियां हटाने में त्रुटि आई।"
      );
    } finally {
      setIsDeleting(null);
    }
  };

  // Bulk Clean ALL Groups in the current report
  const handleBulkPurgeAll = async () => {
    if (!scanReport || scanReport.groups.length === 0) return;
    const allDupIds: string[] = [];
    scanReport.groups.forEach((g) => {
      g.duplicates.forEach((d) => {
        if (d.question.id) allDupIds.push(d.question.id);
      });
    });

    if (allDupIds.length === 0) return;

    const confirmed = window.confirm(
      `⚠️ क्या आप वाकई पूरे प्रश्न बैंक में से सभी ${allDupIds.length} डुप्लीकेट प्रतियों को हटाना चाहते हैं?\n\nप्रत्येक समूह में से केवल सबसे उत्तम (Canonical) प्रश्न सुरक्षित रहेगा और अन्य सभी प्रतियां हटा दी जाएंगी।`
    );
    if (!confirmed) return;

    setIsBulkDeleting(true);
    try {
      await deleteQuestionsBulkFromSupabase(allDupIds);

      const store = loadUserQuestionsStore();
      if (!store.deletedQuestionIds) store.deletedQuestionIds = [];
      allDupIds.forEach((id) => {
        if (!store.deletedQuestionIds.includes(id)) {
          store.deletedQuestionIds.push(id);
        }
      });
      if (store.customQuestions) {
        store.customQuestions = store.customQuestions.filter((q) => !allDupIds.includes(q.id));
      }
      saveUserQuestionsStore(store);

      setScanReport({
        ...scanReport,
        groups: [],
        duplicateGroupCount: 0,
        totalDuplicateCopies: 0,
      });

      triggerAdminToast(
        "delete",
        "सभी डुप्लीकेट साफ",
        `सफलतापूर्वक कुल ${allDupIds.length} डुप्लीकेट प्रश्नों को हटाया गया।`
      );

      if (onQuestionsUpdated) {
        onQuestionsUpdated();
      }
    } catch (err: any) {
      triggerAdminToast(
        "error",
        "बल्क डिलीट विफल",
        err?.message || "बल्क डिलीट में त्रुटि आई।"
      );
    } finally {
      setIsBulkDeleting(false);
    }
  };

  // Filter groups
  const filteredGroups = useMemo(() => {
    if (!scanReport) return [];
    let list = scanReport.groups;

    if (filterBand === "exact") {
      list = list.filter((g) => g.isExactGroup || g.highestSimilarity === 100);
    } else if (filterBand === "95plus") {
      list = list.filter((g) => g.highestSimilarity >= 95);
    } else if (filterBand === "90to95") {
      list = list.filter((g) => g.highestSimilarity >= 90 && g.highestSimilarity < 95);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (g) =>
          g.canonicalQuestion.text?.toLowerCase().includes(q) ||
          g.duplicates.some((d) => d.question.text?.toLowerCase().includes(q))
      );
    }

    return list;
  }, [scanReport, filterBand, searchQuery]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 w-full max-w-5xl h-[92vh] rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 bg-slate-50/50 dark:bg-slate-900/50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center font-black">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                  Duplicate Questions Control Center
                </h3>
                <span className="px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 text-[10px] font-black uppercase tracking-wider">
                  &ge; {Math.round(threshold * 100)}% Similarity
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                Detect, inspect, and remove repetitive & 90%+ similar MCQs with 1-click database cleanup.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Toolbar & Controls */}
        <div className="p-3 sm:p-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-3 shrink-0">
          <div className="flex flex-wrap items-center justify-between gap-2.5">
            {/* Threshold Selector */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-600 dark:text-slate-400 flex items-center gap-1">
                <Sliders className="w-3.5 h-3.5" />
                समानता थ्रेशोल्ड:
              </span>
              <div className="flex items-center p-0.5 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                {[
                  { label: "90% (मानक)", value: 0.90 },
                  { label: "95% (सख्त)", value: 0.95 },
                  { label: "100% (सटीक)", value: 0.999 },
                ].map((th) => (
                  <button
                    key={th.value}
                    onClick={() => {
                      setThreshold(th.value);
                      handleRunScan(th.value);
                    }}
                    disabled={isScanning}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      Math.abs(threshold - th.value) < 0.01
                        ? "bg-amber-500 text-white shadow-xs font-black"
                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                    }`}
                  >
                    {th.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Scan / Refresh & Bulk Actions */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleRunScan(threshold)}
                disabled={isScanning}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 dark:hover:bg-slate-700 text-white text-xs font-bold rounded-xl transition-all cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isScanning ? "animate-spin" : ""}`} />
                <span>{isScanning ? "स्कैनिंग..." : "दोबारा स्कैन करें"}</span>
              </button>

              {scanReport && scanReport.totalDuplicateCopies > 0 && (
                <button
                  onClick={handleBulkPurgeAll}
                  disabled={isBulkDeleting || isScanning}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-black rounded-xl shadow-xs transition-all cursor-pointer active:scale-95 disabled:opacity-50"
                  title="Remove all duplicate copies across all groups, retaining only the unique master question"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>
                    {isBulkDeleting
                      ? "सफाई हो रही है..."
                      : `सभी ${scanReport.totalDuplicateCopies} डुप्लीकेट हटाएं`}
                  </span>
                </button>
              )}
            </div>
          </div>

          {/* Search & Band Filters */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <div className="relative flex-1 min-w-[200px] max-w-md">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="प्रश्न में खोजें..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8.5 pr-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800/80 text-xs text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 outline-none focus:ring-2 focus:ring-amber-500/20"
              />
            </div>

            <div className="flex items-center gap-1.5 text-xs">
              <button
                onClick={() => setFilterBand("all")}
                className={`px-2.5 py-1 rounded-lg font-bold cursor-pointer ${
                  filterBand === "all"
                    ? "bg-slate-900 dark:bg-slate-700 text-white"
                    : "text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                }`}
              >
                सभी समूह ({scanReport?.duplicateGroupCount || 0})
              </button>
              <button
                onClick={() => setFilterBand("exact")}
                className={`px-2.5 py-1 rounded-lg font-bold cursor-pointer ${
                  filterBand === "exact"
                    ? "bg-rose-600 text-white"
                    : "text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                }`}
              >
                100% सटीक
              </button>
              <button
                onClick={() => setFilterBand("95plus")}
                className={`px-2.5 py-1 rounded-lg font-bold cursor-pointer ${
                  filterBand === "95plus"
                    ? "bg-amber-600 text-white"
                    : "text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                }`}
              >
                95%+ समानता
              </button>
              <button
                onClick={() => setFilterBand("90to95")}
                className={`px-2.5 py-1 rounded-lg font-bold cursor-pointer ${
                  filterBand === "90to95"
                    ? "bg-indigo-600 text-white"
                    : "text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                }`}
              >
                90-95% समानता
              </button>
            </div>
          </div>
        </div>

        {/* Body content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {/* Progress Banner */}
          {isScanning && (
            <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 flex items-center gap-3">
              <RefreshCw className="w-5 h-5 text-amber-600 animate-spin shrink-0" />
              <div>
                <p className="text-xs font-black text-amber-900 dark:text-amber-200">
                  {scanProgress || "प्रश्न बैंक स्कैन किया जा रहा है..."}
                </p>
                <p className="text-[11px] text-amber-700/80 dark:text-amber-300/80 font-medium">
                  द्विभाषी बिग्राम और टोकन समानता इंजन द्वारा 90% से ऊपर के डुप्लीकेट क्लस्टर बनाए जा रहे हैं।
                </p>
              </div>
            </div>
          )}

          {/* Stats Cards */}
          {scanReport && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 text-center">
                <span className="text-[10px] font-black uppercase text-slate-400 block">कुल जाँचे गए MCQs</span>
                <span className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white font-mono">
                  {scanReport.totalScanned}
                </span>
              </div>
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 text-center">
                <span className="text-[10px] font-black uppercase text-slate-400 block">अद्वितीय प्रश्न (Unique)</span>
                <span className="text-xl sm:text-2xl font-black text-emerald-600 dark:text-emerald-400 font-mono">
                  {scanReport.uniqueCount}
                </span>
              </div>
              <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-900/50 text-center">
                <span className="text-[10px] font-black uppercase text-amber-700 dark:text-amber-400 block">
                  डुप्लीकेट समूह (&ge;{Math.round(threshold * 100)}%)
                </span>
                <span className="text-xl sm:text-2xl font-black text-amber-600 dark:text-amber-400 font-mono">
                  {scanReport.duplicateGroupCount}
                </span>
              </div>
              <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/20 border border-rose-200/80 dark:border-rose-900/50 text-center">
                <span className="text-[10px] font-black uppercase text-rose-700 dark:text-rose-400 block">
                  अतिरिक्त डुप्लीकेट प्रतियां
                </span>
                <span className="text-xl sm:text-2xl font-black text-rose-600 dark:text-rose-400 font-mono">
                  {scanReport.totalDuplicateCopies}
                </span>
              </div>
            </div>
          )}

          {/* Duplicate Groups List */}
          {filteredGroups.length > 0 ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-amber-500" />
                  <span>पहचाने गए डुप्लीकेट समूह ({filteredGroups.length})</span>
                </h4>
                <span className="text-[11px] text-slate-400">
                  बाईं ओर मुख्य (Canonical) प्रश्न और दाईं ओर डुप्लीकेट प्रतियां
                </span>
              </div>

              {filteredGroups.map((group) => {
                const isExpanded = expandedGroupId === group.groupId;
                return (
                  <div
                    key={group.groupId}
                    className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-850/80 overflow-hidden shadow-xs"
                  >
                    {/* Group Header */}
                    <div
                      onClick={() => setExpandedGroupId(isExpanded ? null : group.groupId)}
                      className="p-4 flex items-center justify-between gap-3 bg-slate-50/70 dark:bg-slate-800/50 cursor-pointer hover:bg-slate-100/70 dark:hover:bg-slate-800 transition-colors"
                    >
                      <div className="flex-1 min-w-0 flex items-center gap-2.5">
                        <span
                          className={`px-2.5 py-1 rounded-xl text-xs font-black shrink-0 ${
                            group.highestSimilarity === 100
                              ? "bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300"
                              : group.highestSimilarity >= 95
                              ? "bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300"
                              : "bg-indigo-100 dark:bg-indigo-900/40 text-indigo-800 dark:text-indigo-300"
                          }`}
                        >
                          {group.highestSimilarity === 100
                            ? "100% सटीक मेल"
                            : `${group.highestSimilarity}% समानता`}
                        </span>

                        <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                          "{group.canonicalQuestion.text}"
                        </p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs font-bold text-slate-500">
                          {group.count} प्रतियां ({group.duplicates.length} डुप्लीकेट)
                        </span>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCleanGroup(group);
                          }}
                          disabled={isDeleting === group.groupId}
                          className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 text-rose-600 dark:text-rose-400 text-xs font-black rounded-lg border border-rose-200 dark:border-rose-900/50 flex items-center gap-1 cursor-pointer active:scale-95"
                          title="Keep master question, delete all other duplicate copies"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>डुप्लीकेट हटाएं</span>
                        </button>

                        <div className="text-slate-400 p-1">
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </div>
                      </div>
                    </div>

                    {/* Group Details (Comparison) */}
                    {isExpanded && (
                      <div className="p-4 sm:p-5 border-t border-slate-200 dark:border-slate-800 space-y-4 bg-slate-50/30 dark:bg-slate-900/20">
                        {/* Comparison Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {/* Master / Canonical Question Card */}
                          <div className="p-4 rounded-2xl bg-emerald-50/30 dark:bg-emerald-950/10 border-2 border-emerald-500/30 dark:border-emerald-500/20 space-y-3">
                            <div className="flex items-center justify-between">
                              <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300 text-[10px] font-black uppercase tracking-wider flex items-center gap-1">
                                <Check className="w-3 h-3" />
                                मुख्य प्रश्न (Master Copy)
                              </span>
                              <span className="text-[10px] font-mono text-slate-400">
                                ID: {group.canonicalQuestion.id}
                              </span>
                            </div>

                            <p className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white leading-relaxed">
                              {group.canonicalQuestion.text}
                            </p>

                            {/* Options */}
                            {group.canonicalQuestion.options && group.canonicalQuestion.options.length > 0 && (
                              <div className="space-y-1.5 pt-1">
                                <span className="text-[10px] font-black uppercase text-slate-400 block">विकल्प:</span>
                                <div className="grid grid-cols-1 gap-1">
                                  {group.canonicalQuestion.options.map((opt, oIdx) => (
                                    <div
                                      key={oIdx}
                                      className={`px-2.5 py-1 rounded-lg text-xs font-medium flex items-center gap-2 ${
                                        oIdx === group.canonicalQuestion.correctIndex
                                          ? "bg-emerald-100/80 dark:bg-emerald-900/40 text-emerald-900 dark:text-emerald-200 font-bold border border-emerald-300 dark:border-emerald-800"
                                          : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700"
                                      }`}
                                    >
                                      <span className="w-4 h-4 rounded-full bg-slate-200 dark:bg-slate-700 text-[10px] flex items-center justify-center font-bold">
                                        {String.fromCharCode(65 + oIdx)}
                                      </span>
                                      <span>{opt}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {group.canonicalQuestion.explanation && (
                              <div className="p-2.5 rounded-xl bg-white dark:bg-slate-800 text-[11px] text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                                <strong className="font-bold text-slate-900 dark:text-white block">व्याख्या:</strong>
                                {group.canonicalQuestion.explanation}
                              </div>
                            )}
                          </div>

                          {/* Duplicates Column */}
                          <div className="space-y-3">
                            <span className="text-xs font-black text-rose-600 dark:text-rose-400 uppercase tracking-wider block">
                              पहचानी गई डुप्लीकेट प्रतियां ({group.duplicates.length})
                            </span>

                            {group.duplicates.map((dup, dIdx) => (
                              <div
                                key={dup.question.id || dIdx}
                                className="p-4 rounded-2xl bg-white dark:bg-slate-850 border border-rose-200 dark:border-rose-900/50 space-y-3 relative shadow-xs"
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <div className="flex items-center gap-2">
                                    <span
                                      className={`px-2 py-0.5 rounded-md text-[10px] font-black ${
                                        dup.similarity.percentage === 100
                                          ? "bg-rose-100 dark:bg-rose-900/60 text-rose-700 dark:text-rose-300"
                                          : "bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300"
                                      }`}
                                    >
                                      {dup.similarity.percentage}% समानता
                                    </span>
                                    <span className="text-[10px] text-slate-400 font-mono">
                                      ID: {dup.question.id}
                                    </span>
                                  </div>

                                  <button
                                    onClick={() => handleDeleteDuplicate(group.groupId, dup.question.id)}
                                    disabled={isDeleting === dup.question.id}
                                    className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-black rounded-lg transition-all flex items-center gap-1 cursor-pointer active:scale-95 disabled:opacity-50"
                                    title="Delete this duplicate question permanently"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                    <span>
                                      {isDeleting === dup.question.id ? "हटाया जा रहा है..." : "डिलीट करें"}
                                    </span>
                                  </button>
                                </div>

                                <p className="text-xs sm:text-sm font-medium text-slate-800 dark:text-slate-200 leading-relaxed">
                                  {dup.question.text}
                                </p>

                                {/* Options */}
                                {dup.question.options && dup.question.options.length > 0 && (
                                  <div className="grid grid-cols-1 gap-1">
                                    {dup.question.options.map((opt, oIdx) => (
                                      <div
                                        key={oIdx}
                                        className={`px-2 py-0.5 rounded text-[11px] ${
                                          oIdx === dup.question.correctIndex
                                            ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 font-bold"
                                            : "text-slate-600 dark:text-slate-400"
                                        }`}
                                      >
                                        {String.fromCharCode(65 + oIdx)}. {opt}
                                      </div>
                                    ))}
                                  </div>
                                )}

                                <div className="text-[10px] text-slate-400 flex items-center gap-2 pt-1 border-t border-slate-100 dark:border-slate-800">
                                  <span>समानता विश्लेषण: {dup.similarity.reason}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : scanReport && !isScanning ? (
            <div className="py-12 text-center space-y-3">
              <div className="w-14 h-14 rounded-full bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <h4 className="text-sm font-black text-slate-900 dark:text-white">
                शानदार! कोई भी डुप्लीकेट प्रश्न नहीं मिला
              </h4>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                चुने गए थ्रेशोल्ड ({Math.round(threshold * 100)}% समानता) के तहत प्रश्न बैंक पूरी तरह से स्वच्छ और अद्वितीय है।
              </p>
            </div>
          ) : null}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Info className="w-4 h-4 text-amber-500" />
            <span>
              90% से ऊपर समानता वाले प्रश्नों को तुरंत पहचानें और एक-क्लिक में डाटाबेस से स्वच्छ करें।
            </span>
          </div>

          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 dark:bg-slate-700 text-white text-xs font-bold rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
          >
            बंद करें (Close)
          </button>
        </div>
      </div>
    </div>
  );
};
