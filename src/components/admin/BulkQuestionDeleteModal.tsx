import * as React from "react";
import {
  Trash2,
  X,
  AlertTriangle,
  Search,
  CheckSquare,
  Square,
  Filter,
  Layers,
  ChevronDown,
  BookOpen,
  ArrowRight,
  ShieldAlert,
  Loader2,
  CheckCircle2,
  RefreshCw,
  FolderMinus,
  Sparkles,
  FileSpreadsheet,
} from "lucide-react";
import { Chapter, Question, Subject, UserQuestionsStore } from "../../types";
import { getChapterDisplayName, getTopicDisplayName } from "../../utils/curriculumUtils";
import { triggerAdminToast } from "../../utils/adminToast";
import { bulkDeleteQuestions } from "../../utils/questionsStorage";

interface FlattenedMCQ {
  id: string;
  text: string;
  options: string[];
  correctIndex: number;
  explanation?: string;
  chapterId?: string;
  chapterTitle: string;
  chapterNumber?: number;
  topicId?: string;
  topicTitle: string;
  subjectId?: string;
  subjectTitle: string;
  isUserAdded?: boolean;
  isPYQ?: boolean;
}

interface BulkQuestionDeleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  subjects?: Subject[];
  chapters: Chapter[];
  questionsStore: UserQuestionsStore;
  onBulkDeleteQuestions?: (ids: string[]) => Promise<void> | void;
  onStoreUpdated?: (updatedStore: UserQuestionsStore) => void;
}

export const BulkQuestionDeleteModal: React.FC<BulkQuestionDeleteModalProps> = ({
  isOpen,
  onClose,
  subjects = [],
  chapters = [],
  questionsStore,
  onBulkDeleteQuestions,
  onStoreUpdated,
}) => {
  // Filters
  const [selectedSubjectId, setSelectedSubjectId] = React.useState<string>("ALL");
  const [selectedChapterId, setSelectedChapterId] = React.useState<string>("ALL");
  const [selectedTopicId, setSelectedTopicId] = React.useState<string>("ALL");
  const [typeFilter, setTypeFilter] = React.useState<"all" | "custom" | "base" | "pyq">("all");
  const [searchQuery, setSearchQuery] = React.useState<string>("");
  const [customQtyInput, setCustomQtyInput] = React.useState<string>("");

  // Pagination
  const [currentPage, setCurrentPage] = React.useState<number>(1);
  const itemsPerPage = 20;

  // Selected IDs
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());

  // Safety confirmation dialog state
  const [showConfirmModal, setShowConfirmModal] = React.useState<boolean>(false);
  const [safetyCheckConfirmed, setSafetyCheckConfirmed] = React.useState<boolean>(false);
  const [isDeleting, setIsDeleting] = React.useState<boolean>(false);
  const [deleteProgressText, setDeleteProgressText] = React.useState<string>("");

  // Single delete target
  const [singleDeleteId, setSingleDeleteId] = React.useState<string | null>(null);

  // Flatten and index all questions across subjects/chapters/topics
  const allMCQs = React.useMemo(() => {
    const list: FlattenedMCQ[] = [];
    const seenIds = new Set<string>();

    for (let cIdx = 0; cIdx < chapters.length; cIdx++) {
      const ch = chapters[cIdx];
      const sub = subjects.find((s) => s.id === ch.subjectId);
      const subTitle = sub?.name || sub?.hindiName || "General Studies";
      const chTitle = getChapterDisplayName(ch);

      for (let tIdx = 0; tIdx < ch.topics.length; tIdx++) {
        const top = ch.topics[tIdx];
        const topTitle = getTopicDisplayName(top);
        const qs = top.questions || [];

        for (let qIdx = 0; qIdx < qs.length; qIdx++) {
          const q = qs[qIdx];
          if (!q || !q.id || seenIds.has(q.id)) continue;
          seenIds.add(q.id);

          const correctIdx =
            typeof q.correctIndex === "number"
              ? q.correctIndex
              : typeof (q as any).correctAnswer === "number"
              ? (q as any).correctAnswer
              : 0;

          list.push({
            id: q.id,
            text: q.text || "",
            options: Array.isArray(q.options) ? q.options : [],
            correctIndex: correctIdx,
            explanation: q.explanation || "",
            chapterId: ch.id,
            chapterTitle: chTitle,
            chapterNumber: ch.number,
            topicId: top.id,
            topicTitle: topTitle,
            subjectId: ch.subjectId,
            subjectTitle: subTitle,
            isUserAdded: Boolean(q.isUserAdded),
            isPYQ: Boolean((q as any).isPYQ),
          });
        }
      }
    }

    return list;
  }, [chapters, subjects]);

  // Available chapters based on selected subject
  const availableChapters = React.useMemo(() => {
    if (selectedSubjectId === "ALL") return chapters;
    return chapters.filter((c) => c.subjectId === selectedSubjectId);
  }, [chapters, selectedSubjectId]);

  // Available topics based on selected chapter
  const availableTopics = React.useMemo(() => {
    if (selectedChapterId === "ALL") {
      return availableChapters.flatMap((c) => c.topics || []);
    }
    const found = availableChapters.find((c) => c.id === selectedChapterId);
    return found ? found.topics || [] : [];
  }, [availableChapters, selectedChapterId]);

  // Reset dependent filters when parent dropdown changes
  const handleSubjectChange = (newSubjectId: string) => {
    setSelectedSubjectId(newSubjectId);
    setSelectedChapterId("ALL");
    setSelectedTopicId("ALL");
    setCurrentPage(1);
  };

  const handleChapterChange = (newChapterId: string) => {
    setSelectedChapterId(newChapterId);
    setSelectedTopicId("ALL");
    setCurrentPage(1);
  };

  const handleTopicChange = (newTopicId: string) => {
    setSelectedTopicId(newTopicId);
    setCurrentPage(1);
  };

  // Filtered pool of MCQs
  const filteredMCQs = React.useMemo(() => {
    let result = allMCQs;

    // Filter by Subject
    if (selectedSubjectId !== "ALL") {
      result = result.filter((q) => q.subjectId === selectedSubjectId);
    }

    // Filter by Chapter
    if (selectedChapterId !== "ALL") {
      result = result.filter((q) => q.chapterId === selectedChapterId);
    }

    // Filter by Topic
    if (selectedTopicId !== "ALL") {
      result = result.filter((q) => q.topicId === selectedTopicId);
    }

    // Filter by Type
    if (typeFilter === "custom") {
      result = result.filter((q) => q.isUserAdded);
    } else if (typeFilter === "base") {
      result = result.filter((q) => !q.isUserAdded);
    } else if (typeFilter === "pyq") {
      result = result.filter((q) => q.isPYQ);
    }

    // Filter by Search Query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (item) =>
          item.text.toLowerCase().includes(q) ||
          item.id.toLowerCase().includes(q) ||
          item.chapterTitle.toLowerCase().includes(q) ||
          item.topicTitle.toLowerCase().includes(q) ||
          item.options.some((opt) => opt.toLowerCase().includes(q)) ||
          (item.explanation && item.explanation.toLowerCase().includes(q))
      );
    }

    return result;
  }, [allMCQs, selectedSubjectId, selectedChapterId, selectedTopicId, typeFilter, searchQuery]);

  // Reset pagination when filter results change
  React.useEffect(() => {
    setCurrentPage(1);
  }, [selectedSubjectId, selectedChapterId, selectedTopicId, typeFilter, searchQuery]);

  // Pagination calculation
  const totalPages = Math.max(1, Math.ceil(filteredMCQs.length / itemsPerPage));
  const paginatedMCQs = React.useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredMCQs.slice(start, start + itemsPerPage);
  }, [filteredMCQs, currentPage, itemsPerPage]);

  // Count stats of selected MCQs
  const selectedStats = React.useMemo(() => {
    let custom = 0;
    let base = 0;
    const chaptersSet = new Set<string>();
    const topicsSet = new Set<string>();

    allMCQs.forEach((q) => {
      if (selectedIds.has(q.id)) {
        if (q.isUserAdded) custom++;
        else base++;
        if (q.chapterTitle) chaptersSet.add(q.chapterTitle);
        if (q.topicTitle) topicsSet.add(q.topicTitle);
      }
    });

    return {
      total: selectedIds.size,
      custom,
      base,
      affectedChapters: chaptersSet.size,
      affectedTopics: topicsSet.size,
      chaptersList: Array.from(chaptersSet).slice(0, 4),
    };
  }, [allMCQs, selectedIds]);

  // Selection handlers
  const handleToggleSelectOne = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectAllFiltered = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      filteredMCQs.forEach((q) => next.add(q.id));
      return next;
    });
    triggerAdminToast("add", "Questions Selected", `Selected all ${filteredMCQs.length} filtered questions.`);
  };

  const handleDeselectAll = () => {
    setSelectedIds(new Set());
    triggerAdminToast("add", "Selection Cleared", "Deselected all questions.");
  };

  const handleSelectBatch = (count: number) => {
    const unselected = filteredMCQs.filter((q) => !selectedIds.has(q.id));
    const toAdd = unselected.slice(0, count);
    if (toAdd.length === 0) {
      triggerAdminToast("add", "All Already Selected", "All filtered questions are already in selection.");
      return;
    }
    setSelectedIds((prev) => {
      const next = new Set(prev);
      toAdd.forEach((q) => next.add(q.id));
      return next;
    });
    triggerAdminToast("add", "Batch Selected", `Selected ${toAdd.length} additional question(s).`);
  };

  const handleSelectCustomQty = () => {
    const qty = parseInt(customQtyInput.trim(), 10);
    if (isNaN(qty) || qty <= 0) {
      triggerAdminToast("error", "Invalid Quantity", "Please enter a valid number greater than 0.");
      return;
    }
    handleSelectBatch(qty);
    setCustomQtyInput("");
  };

  const handleSelectCurrentPage = () => {
    const allPageSelected = paginatedMCQs.length > 0 && paginatedMCQs.every((q) => selectedIds.has(q.id));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allPageSelected) {
        paginatedMCQs.forEach((q) => next.delete(q.id));
      } else {
        paginatedMCQs.forEach((q) => next.add(q.id));
      }
      return next;
    });
  };

  // Execution: Bulk Delete
  const handleExecuteBulkDelete = async () => {
    if (selectedIds.size === 0 || isDeleting) return;

    const idsToDelete = Array.from(selectedIds);
    setIsDeleting(true);
    setDeleteProgressText(`Deleting ${idsToDelete.length} questions from local store and cloud...`);

    try {
      if (onBulkDeleteQuestions) {
        await onBulkDeleteQuestions(idsToDelete);
      } else {
        // Fallback: update questionsStore and invoke cloud sync
        if (onStoreUpdated && questionsStore) {
          const nextStore = bulkDeleteQuestions(questionsStore, idsToDelete);
          onStoreUpdated(nextStore);
        }
        const { deleteMCQsBulkFromCloud } = await import("../../utils/firebaseSyncService");
        await deleteMCQsBulkFromCloud(idsToDelete);
      }

      triggerAdminToast(
        "success",
        "Bulk Deletion Successful",
        `Permanently deleted ${idsToDelete.length} question(s) from local cache and cloud.`
      );

      setSelectedIds(new Set());
      setShowConfirmModal(false);
      setSafetyCheckConfirmed(false);
    } catch (err: any) {
      console.error("[BulkQuestionDeleteModal] Deletion error:", err);
      triggerAdminToast(
        "error",
        "Deletion Notice",
        `Completed with note: ${err?.message || "Check network/quota"}`
      );
    } finally {
      setIsDeleting(false);
      setDeleteProgressText("");
    }
  };

  // Single Item Direct Delete
  const handleSingleDelete = async (id: string) => {
    setIsDeleting(true);
    try {
      if (onBulkDeleteQuestions) {
        await onBulkDeleteQuestions([id]);
      } else {
        if (onStoreUpdated && questionsStore) {
          const nextStore = bulkDeleteQuestions(questionsStore, [id]);
          onStoreUpdated(nextStore);
        }
        const { deleteMCQsBulkFromCloud } = await import("../../utils/firebaseSyncService");
        await deleteMCQsBulkFromCloud([id]);
      }

      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });

      triggerAdminToast("success", "Question Deleted", `Question ID ${id} deleted successfully.`);
      setSingleDeleteId(null);
    } catch (err: any) {
      triggerAdminToast("error", "Delete Failed", err?.message || "Failed to delete question.");
    } finally {
      setIsDeleting(false);
    }
  };

  if (!isOpen) return null;

  const isCurrentPageFullySelected =
    paginatedMCQs.length > 0 && paginatedMCQs.every((q) => selectedIds.has(q.id));

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex flex-col justify-end sm:justify-center items-center p-0 sm:p-4 overflow-hidden animate-in fade-in duration-150">
      <div className="w-full sm:max-w-5xl bg-[#F8FAFC] dark:bg-[#0B1220] rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col h-[94vh] sm:h-[90vh] border border-slate-200 dark:border-slate-800 overflow-hidden relative">
        {/* Top Header */}
        <div className="px-4 sm:px-6 py-3.5 bg-white dark:bg-[#111A2E] border-b border-slate-200/80 dark:border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0 shadow-xs border border-rose-100 dark:border-rose-900/40">
              <Trash2 className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white truncate">
                  Bulk Delete Questions
                </h2>
                <span className="px-2 py-0.5 rounded-md bg-rose-100 dark:bg-rose-950/70 text-rose-700 dark:text-rose-300 text-[10px] font-extrabold uppercase tracking-wider">
                  बल्क डिलीट
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                Select and permanently remove questions by subject, chapter, topic, or custom filters.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-white flex items-center justify-center transition-all cursor-pointer active:scale-95 shrink-0"
              title="Close Bulk Delete"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Filter Controls Bar */}
        <div className="p-3 sm:p-4 bg-white/90 dark:bg-[#111A2E]/90 border-b border-slate-200/80 dark:border-slate-800 shrink-0 space-y-3">
          {/* Hierarchy Dropdowns: Subject -> Chapter -> Topic */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3">
            {/* Subject Selector */}
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 flex items-center justify-between">
                <span>1. Subject</span>
                <span className="font-mono text-[10px] text-slate-400">
                  {selectedSubjectId === "ALL" ? "All Subjects" : "Filtered"}
                </span>
              </label>
              <select
                value={selectedSubjectId}
                onChange={(e) => handleSubjectChange(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-500 cursor-pointer"
              >
                <option value="ALL">All Subjects ({allMCQs.length} MCQs)</option>
                {subjects.map((sub) => {
                  const subCount = allMCQs.filter((q) => q.subjectId === sub.id).length;
                  return (
                    <option key={sub.id} value={sub.id}>
                      {sub.name || sub.hindiName || "Subject"} ({subCount} MCQs)
                    </option>
                  );
                })}
              </select>
            </div>

            {/* Chapter Selector */}
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 flex items-center justify-between">
                <span>2. Chapter</span>
                <span className="font-mono text-[10px] text-slate-400">
                  {selectedChapterId === "ALL" ? "All Chapters" : "Filtered"}
                </span>
              </label>
              <select
                value={selectedChapterId}
                onChange={(e) => handleChapterChange(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-500 cursor-pointer"
              >
                <option value="ALL">All Chapters ({availableChapters.length})</option>
                {availableChapters.map((ch) => {
                  const chCount = allMCQs.filter((q) => q.chapterId === ch.id).length;
                  return (
                    <option key={ch.id} value={ch.id}>
                      {ch.number ? `${ch.number}. ` : ""}{getChapterDisplayName(ch)} ({chCount} MCQs)
                    </option>
                  );
                })}
              </select>
            </div>

            {/* Topic Selector */}
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 flex items-center justify-between">
                <span>3. Topic</span>
                <span className="font-mono text-[10px] text-slate-400">
                  {selectedTopicId === "ALL" ? "All Topics" : "Filtered"}
                </span>
              </label>
              <select
                value={selectedTopicId}
                onChange={(e) => handleTopicChange(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-500 cursor-pointer"
              >
                <option value="ALL">All Topics ({availableTopics.length})</option>
                {availableTopics.map((top, idx) => {
                  const topCount = allMCQs.filter((q) => q.topicId === top.id).length;
                  return (
                    <option key={`${top.id}-${idx}`} value={top.id}>
                      {getTopicDisplayName(top)} ({topCount} MCQs)
                    </option>
                  );
                })}
              </select>
            </div>
          </div>

          {/* Row 2: Search Box + Type Pills + Quick Select Shortcuts */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search MCQs by question text, keyword, or ID..."
                className="w-full pl-9 pr-8 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-500"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Type Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0">
              <button
                type="button"
                onClick={() => setTypeFilter("all")}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                  typeFilter === "all"
                    ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-xs"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200"
                }`}
              >
                All ({allMCQs.length})
              </button>
              <button
                type="button"
                onClick={() => setTypeFilter("custom")}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                  typeFilter === "custom"
                    ? "bg-purple-600 text-white shadow-xs"
                    : "bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 hover:bg-purple-100"
                }`}
              >
                Custom ({allMCQs.filter((q) => q.isUserAdded).length})
              </button>
              <button
                type="button"
                onClick={() => setTypeFilter("base")}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                  typeFilter === "base"
                    ? "bg-blue-600 text-white shadow-xs"
                    : "bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 hover:bg-blue-100"
                }`}
              >
                Default ({allMCQs.filter((q) => !q.isUserAdded).length})
              </button>
              <button
                type="button"
                onClick={() => setTypeFilter("pyq")}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                  typeFilter === "pyq"
                    ? "bg-amber-600 text-white shadow-xs"
                    : "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 hover:bg-amber-100"
                }`}
              >
                PYQ ({allMCQs.filter((q) => q.isPYQ).length})
              </button>
            </div>
          </div>

          {/* Row 3: Selection Quick Actions & Batch Tools */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-100 dark:border-slate-800/60">
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                type="button"
                onClick={handleSelectAllFiltered}
                className="px-2.5 py-1.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900/60 text-xs font-bold flex items-center gap-1 hover:bg-rose-100 transition-colors cursor-pointer"
              >
                <CheckSquare className="w-3.5 h-3.5 text-rose-600" />
                <span>Select All Filtered ({filteredMCQs.length})</span>
              </button>

              <div className="flex items-center gap-1">
                {[10, 25, 50, 100].map((batch) => (
                  <button
                    key={batch}
                    type="button"
                    onClick={() => handleSelectBatch(batch)}
                    className="px-2 py-1 rounded-md bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 text-[11px] font-mono font-bold transition-colors cursor-pointer"
                    title={`Select next ${batch} unselected questions`}
                  >
                    +{batch}
                  </button>
                ))}
              </div>

              {selectedIds.size > 0 && (
                <button
                  type="button"
                  onClick={handleDeselectAll}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-bold hover:bg-slate-200 transition-colors cursor-pointer"
                >
                  Deselect All
                </button>
              )}
            </div>

            {/* Custom Quantity Input */}
            <div className="flex items-center gap-1.5 shrink-0">
              <input
                type="number"
                min="1"
                placeholder="Qty..."
                value={customQtyInput}
                onChange={(e) => setCustomQtyInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSelectCustomQty();
                }}
                className="w-20 px-2 py-1 rounded-md bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-mono font-bold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-rose-500"
              />
              <button
                type="button"
                onClick={handleSelectCustomQty}
                className="px-2.5 py-1 rounded-md bg-slate-800 dark:bg-slate-700 hover:bg-slate-900 text-white text-xs font-bold transition-colors cursor-pointer"
              >
                Select
              </button>
            </div>
          </div>
        </div>

        {/* Selected Count Indicator Banner */}
        <div className="px-4 py-2 bg-slate-100/90 dark:bg-slate-900/90 border-b border-slate-200/80 dark:border-slate-800 flex items-center justify-between text-xs shrink-0">
          <div className="flex items-center gap-2">
            <button
              onClick={handleSelectCurrentPage}
              className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300 font-bold hover:text-rose-600 dark:hover:text-rose-400 transition-colors cursor-pointer"
            >
              {isCurrentPageFullySelected ? (
                <CheckSquare className="w-4 h-4 text-rose-600" />
              ) : (
                <Square className="w-4 h-4 text-slate-400" />
              )}
              <span>Page {currentPage} Items</span>
            </button>
            <span className="text-slate-300 dark:text-slate-700">|</span>
            <span className="font-semibold text-slate-600 dark:text-slate-400">
              Showing {filteredMCQs.length === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1}–
              {Math.min(currentPage * itemsPerPage, filteredMCQs.length)} of {filteredMCQs.length} MCQs
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="font-bold text-rose-600 dark:text-rose-400 font-mono">
              {selectedIds.size} Selected
            </span>
            {selectedIds.size > 0 && (
              <span className="text-[11px] text-slate-400 hidden sm:inline">
                ({selectedStats.custom} Custom, {selectedStats.base} Default)
              </span>
            )}
          </div>
        </div>

        {/* Scrollable Questions List */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-5 space-y-2.5">
          {filteredMCQs.length === 0 ? (
            <div className="py-16 text-center space-y-3 bg-white dark:bg-[#111A2E] rounded-2xl border border-slate-200/80 dark:border-slate-800 p-6">
              <BookOpen className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto" />
              <div className="space-y-1">
                <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
                  No questions match your current filter criteria
                </p>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  Try changing the subject, chapter, or search query to find questions.
                </p>
              </div>
              <button
                onClick={() => {
                  setSelectedSubjectId("ALL");
                  setSelectedChapterId("ALL");
                  setSelectedTopicId("ALL");
                  setTypeFilter("all");
                  setSearchQuery("");
                }}
                className="px-3.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold hover:bg-slate-200 transition-colors cursor-pointer"
              >
                Reset All Filters
              </button>
            </div>
          ) : (
            paginatedMCQs.map((q, idx) => {
              const isSelected = selectedIds.has(q.id);
              const globalIndex = (currentPage - 1) * itemsPerPage + idx + 1;

              return (
                <div
                  key={q.id}
                  onClick={() => handleToggleSelectOne(q.id)}
                  className={`p-3.5 sm:p-4 rounded-2xl border transition-all cursor-pointer select-none group ${
                    isSelected
                      ? "bg-rose-50/70 dark:bg-rose-950/30 border-rose-300 dark:border-rose-900/60 shadow-xs ring-1 ring-rose-400/30"
                      : "bg-white dark:bg-[#111A2E] border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 shadow-xs"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {/* Checkbox */}
                    <div className="pt-0.5 shrink-0">
                      <div className="w-6 h-6 rounded-lg flex items-center justify-center transition-colors">
                        {isSelected ? (
                          <CheckSquare className="w-5 h-5 text-rose-600 dark:text-rose-400" />
                        ) : (
                          <Square className="w-5 h-5 text-slate-300 dark:text-slate-600 group-hover:text-slate-400" />
                        )}
                      </div>
                    </div>

                    {/* Question Content */}
                    <div className="flex-1 min-w-0 space-y-2">
                      {/* Meta Badges */}
                      <div className="flex items-center gap-1.5 flex-wrap text-[10px]">
                        <span className="font-mono font-bold text-slate-400">
                          #{globalIndex}
                        </span>
                        <span className="px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-semibold truncate max-w-[140px]">
                          {q.chapterTitle}
                        </span>
                        <span className="px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-semibold truncate max-w-[140px]">
                          {q.topicTitle}
                        </span>
                        {q.isUserAdded ? (
                          <span className="px-1.5 py-0.5 rounded-md bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 font-bold">
                            Custom Added
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-500 font-bold">
                            Default
                          </span>
                        )}
                        {q.isPYQ && (
                          <span className="px-1.5 py-0.5 rounded-md bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 font-bold">
                            PYQ
                          </span>
                        )}
                      </div>

                      {/* Question Text */}
                      <p className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-slate-100 line-clamp-3 leading-relaxed">
                        {q.text}
                      </p>

                      {/* Options Preview */}
                      {q.options && q.options.length > 0 && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1 text-xs">
                          {q.options.map((opt, oIdx) => {
                            const isCorrect = oIdx === q.correctIndex;
                            return (
                              <div
                                key={oIdx}
                                className={`px-2.5 py-1 rounded-lg truncate flex items-center gap-1.5 ${
                                  isCorrect
                                    ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 font-bold"
                                    : "bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-100 dark:border-slate-800"
                                }`}
                              >
                                <span className="font-mono text-[10px] font-bold shrink-0">
                                  {["A", "B", "C", "D"][oIdx] || oIdx + 1}.
                                </span>
                                <span className="truncate">{opt}</span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Single Quick Delete Button */}
                    <div className="shrink-0 pt-0.5">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSingleDeleteId(q.id);
                        }}
                        className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-rose-100 dark:hover:bg-rose-950/60 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 flex items-center justify-center transition-colors cursor-pointer"
                        title="Delete this question"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Bottom Pagination & Sticky Bulk Action Toolbar */}
        <div className="p-3 sm:p-4 bg-white dark:bg-[#111A2E] border-t border-slate-200/80 dark:border-slate-800 shrink-0 space-y-2">
          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between text-xs">
              <button
                type="button"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 disabled:opacity-40 font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-200 cursor-pointer disabled:cursor-not-allowed"
              >
                Previous
              </button>

              <span className="font-semibold text-slate-500 dark:text-slate-400">
                Page <span className="text-slate-900 dark:text-white font-bold">{currentPage}</span> of{" "}
                <span className="text-slate-900 dark:text-white font-bold">{totalPages}</span>
              </span>

              <button
                type="button"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 disabled:opacity-40 font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-200 cursor-pointer disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          )}

          {/* Action Row */}
          <div className="flex items-center justify-between gap-3 pt-1">
            <div className="text-xs">
              <span className="font-extrabold text-slate-900 dark:text-white">
                {selectedIds.size}
              </span>{" "}
              <span className="text-slate-500 dark:text-slate-400">questions selected</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 text-xs font-bold transition-all cursor-pointer active:scale-95"
              >
                Close
              </button>

              <button
                type="button"
                disabled={selectedIds.size === 0}
                onClick={() => {
                  setSafetyCheckConfirmed(false);
                  setShowConfirmModal(true);
                }}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-700 hover:to-red-700 text-white text-xs font-black shadow-md shadow-rose-600/20 flex items-center gap-2 transition-all cursor-pointer active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none"
              >
                <Trash2 className="w-4 h-4" />
                <span>Delete Selected ({selectedIds.size})</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* MODAL: SINGLE QUESTION DELETE CONFIRMATION */}
      {singleDeleteId && (
        <div className="fixed inset-0 z-60 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#111A2E] rounded-3xl p-5 sm:p-6 w-full max-w-sm shadow-2xl border border-slate-200 dark:border-slate-800 text-center space-y-4 animate-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Delete Single Question?
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Are you sure you want to delete this question from your bank and cloud?
              </p>
            </div>
            <div className="flex gap-2">
              <button
                disabled={isDeleting}
                onClick={() => setSingleDeleteId(null)}
                className="flex-1 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold cursor-pointer hover:bg-slate-200"
              >
                Cancel
              </button>
              <button
                disabled={isDeleting}
                onClick={() => handleSingleDelete(singleDeleteId)}
                className="flex-1 py-2.5 bg-rose-600 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer hover:bg-rose-700"
              >
                {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                <span>Yes, Delete</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: SAFE DOUBLE CONFIRMATION FOR BULK DELETE */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-60 bg-black/75 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white dark:bg-[#111A2E] w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl p-5 sm:p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4 animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-200">
            {/* Header */}
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-rose-100 dark:bg-rose-950/80 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0 shadow-inner">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                  Confirm Bulk Deletion
                </h3>
                <p className="text-xs text-rose-600 dark:text-rose-400 font-semibold">
                  ⚠️ This action is irreversible
                </p>
              </div>
            </div>

            {/* Audit Breakdown Box */}
            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs space-y-2">
              <div className="flex justify-between items-center text-slate-700 dark:text-slate-300">
                <span>Total Questions to Delete:</span>
                <span className="font-mono font-black text-rose-600 dark:text-rose-400 text-sm">
                  {selectedStats.total} MCQs
                </span>
              </div>
              <div className="flex justify-between items-center text-slate-600 dark:text-slate-400 text-[11px]">
                <span>Custom User Questions:</span>
                <span className="font-mono font-bold text-purple-600 dark:text-purple-400">
                  {selectedStats.custom}
                </span>
              </div>
              <div className="flex justify-between items-center text-slate-600 dark:text-slate-400 text-[11px]">
                <span>Default Curriculum Questions:</span>
                <span className="font-mono font-bold text-slate-500">
                  {selectedStats.base}
                </span>
              </div>
              <div className="flex justify-between items-center text-slate-600 dark:text-slate-400 text-[11px]">
                <span>Affected Chapters:</span>
                <span className="font-mono font-bold text-slate-700 dark:text-slate-300">
                  {selectedStats.affectedChapters} ({selectedStats.chaptersList.join(", ")}
                  {selectedStats.affectedChapters > 4 ? "..." : ""})
                </span>
              </div>
            </div>

            {/* Safety Confirmation Checkbox */}
            <label className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={safetyCheckConfirmed}
                onChange={(e) => setSafetyCheckConfirmed(e.target.checked)}
                className="mt-0.5 rounded text-rose-600 focus:ring-rose-500"
              />
              <span className="text-[11px] font-semibold text-amber-900 dark:text-amber-200 leading-tight">
                I understand that deleting these {selectedStats.total} question(s) will permanently remove them from local storage and sync tombstone deletion to Firebase.
              </span>
            </label>

            {/* Action Buttons */}
            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setShowConfirmModal(false)}
                className="flex-1 py-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 rounded-2xl text-xs sm:text-sm font-bold transition-all cursor-pointer active:scale-95 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!safetyCheckConfirmed || isDeleting}
                onClick={handleExecuteBulkDelete}
                className="flex-1 py-3 bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-700 hover:to-red-700 text-white rounded-2xl text-xs sm:text-sm font-black shadow-lg shadow-rose-600/30 flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    <span>Confirm Delete ({selectedStats.total})</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BulkQuestionDeleteModal;
