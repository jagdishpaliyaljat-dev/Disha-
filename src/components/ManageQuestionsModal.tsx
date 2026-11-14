import React, { useState, useMemo, useEffect } from "react";
import { Chapter, Question, Topic } from "../types";
import {
  X,
  Search,
  Plus,
  Trash2,
  Edit3,
  ChevronRight,
  ChevronLeft,
  BookOpen,
  ArrowLeft,
  Check,
  AlertCircle,
  FolderInput,
  AlertTriangle,
  MoveRight,
  CheckSquare,
  Square,
  Sparkles,
  Layers,
  Upload,
  FileCode,
} from "lucide-react";
import {
  MoveQuestionsDialog,
  BulkDeleteConfirmDialog,
  EditQuestionDialog,
} from "./ManageQuestionsDialogs";
import { RichText } from "./RichText";
import { QuestionTable } from "./QuestionTable";
import { ManageQuestionRow } from "./ManageQuestionRow";
import { VirtualizedQuestionList } from "./VirtualizedQuestionList";
import { CardGridSkeleton } from "./admin/AdminSkeletonLoaders";
import {
  runDuplicateAudit,
  executeDuplicateMerge,
  DuplicateAuditReport,
} from "../utils/duplicateAuditService";
import {
  getChapterDisplayName,
  getChapterSecondaryTitle,
  getTopicDisplayName,
  getTopicSecondaryTitle,
} from "../utils/curriculumUtils";

// Removed unused react-window import

interface ManageQuestionsModalProps {
  chapters: Chapter[];
  onClose: () => void;
  onEditQuestion: (updatedQuestion: Question) => void;
  onDeleteQuestion: (questionId: string) => void;
  onBulkDeleteQuestions: (questionIds: string[]) => void;
  onBulkMoveQuestions: (
    questionIds: string[],
    targetChapterId: string,
    targetTopicId: string
  ) => void;
  onAddQuestions?: (chapterId?: string, topicId?: string, initialMethod?: "json" | "file" | "paste" | "manual") => void;
  onShowHTMLImport?: (chapterId?: string, topicId?: string) => void;
}

export const ManageQuestionsModal: React.FC<ManageQuestionsModalProps> = ({
  chapters,
  onClose,
  onEditQuestion,
  onDeleteQuestion,
  onBulkDeleteQuestions,
  onBulkMoveQuestions,
  onAddQuestions,
  onShowHTMLImport,
}) => {
  // Navigation view: null = Chapter/Topic list; or active selected topic IDs
  const [selectedTopic, setSelectedTopic] = useState<{
    chapterId: string;
    topicId: string;
  } | null>(null);

  // Derive active chapter and active topic dynamically from live chapters prop
  const activeChapter = useMemo(() => {
    if (!selectedTopic) return null;
    return chapters.find((c) => c.id === selectedTopic.chapterId) || null;
  }, [chapters, selectedTopic]);

  const activeTopic = useMemo(() => {
    if (!activeChapter || !selectedTopic) return null;
    return activeChapter.topics.find((t) => t.id === selectedTopic.topicId) || null;
  }, [activeChapter, selectedTopic]);

  // Search & filter
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery.trim());
    }, 180);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const [filterType, setFilterType] = useState<"all" | "custom" | "base">("all");

  // Multi-selection state for bulk operations
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<Set<string>>(new Set());

  // Custom Quantity Selection State
  const [customQuantity, setCustomQuantity] = useState<string>("");
  const [quantityError, setQuantityError] = useState<string | null>(null);

  // Scroll container ref for virtualized list
  const [modalScrollContainer, setModalScrollContainer] = useState<HTMLDivElement | null>(null);

  // Modals state
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [singleDeletingQuestionId, setSingleDeletingQuestionId] = useState<string | null>(null);
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [showBulkMoveModal, setShowBulkMoveModal] = useState(false);
  const [isBulkMoving, setIsBulkMoving] = useState(false);

  // Local notification banner
  const [bannerMessage, setBannerMessage] = useState<string | null>(null);

  const showNotification = (msg: string) => {
    setBannerMessage(msg);
    setTimeout(() => {
      setBannerMessage(null);
    }, 3500);
  };

  // Switch topic handler
  const handleSelectTopic = (chapter: Chapter, topic: Topic) => {
    setSelectedTopic({ chapterId: chapter.id, topicId: topic.id });
    setSelectedQuestionIds(new Set());
    setSearchQuery("");
    setFilterType("all");
    setCustomQuantity("");
    setQuantityError(null);
  };

  // Back to topics view
  const handleBackToTopics = () => {
    setSelectedTopic(null);
    setSelectedQuestionIds(new Set());
    setSearchQuery("");
    setFilterType("all");
    setCustomQuantity("");
    setQuantityError(null);
  };

  // Keyboard accessibility: Escape key navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (editingQuestion) {
          setEditingQuestion(null);
        } else if (showBulkMoveModal) {
          setShowBulkMoveModal(false);
        } else if (showBulkDeleteModal) {
          setShowBulkDeleteModal(false);
        } else if (singleDeletingQuestionId) {
          setSingleDeletingQuestionId(null);
        } else if (selectedTopic) {
          handleBackToTopics();
        } else {
          onClose();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    editingQuestion,
    showBulkMoveModal,
    showBulkDeleteModal,
    singleDeletingQuestionId,
    selectedTopic,
    onClose,
  ]);

  const [topicFetchedQuestions, setTopicFetchedQuestions] = useState<Question[] | null>(null);
  const [isLoadingTopicQuestions, setIsLoadingTopicQuestions] = useState(false);

  useEffect(() => {
    let isMounted = true;
    if (selectedTopic && (!activeTopic?.questions || activeTopic.questions.length === 0)) {
      setIsLoadingTopicQuestions(true);
      import("../utils/firebaseSyncService").then(({ fetchMCQsByTopic }) => {
        fetchMCQsByTopic(selectedTopic.topicId).then((qs) => {
          if (isMounted) {
            setTopicFetchedQuestions((qs as any[]) || []);
            setIsLoadingTopicQuestions(false);
          }
        }).catch(() => {
          if (isMounted) setIsLoadingTopicQuestions(false);
        });
      });
    } else {
      setTopicFetchedQuestions(null);
      setIsLoadingTopicQuestions(false);
    }
    return () => { isMounted = false; };
  }, [selectedTopic, activeTopic?.questions]);

  // 1. Authoritative base questions for the active topic
  const baseTopicQuestions = useMemo(() => {
    if (!activeTopic) return [];
    const mainList = (activeTopic.questions && activeTopic.questions.length > 0)
      ? activeTopic.questions
      : (topicFetchedQuestions || []);
    
    // Deduplicate base list to ensure counts are accurate
    const deduped = new Map<string, Question>();
    mainList.forEach(q => deduped.set(q.id, q));
    return Array.from(deduped.values());
  }, [activeTopic, topicFetchedQuestions]);

  // 2. Filtered version of the topic questions
  const filteredTopicQuestions = useMemo(() => {
    let list = baseTopicQuestions;

    if (filterType === "custom") {
      list = list.filter((q) => q.isUserAdded);
    } else if (filterType === "base") {
      list = list.filter((q) => !q.isUserAdded);
    }

    if (debouncedSearchQuery) {
      const q = debouncedSearchQuery.toLowerCase();
      list = list.filter(
        (item) =>
          (item.text && item.text.toLowerCase().includes(q)) ||
          (item.options && item.options.some((opt) => opt.toLowerCase().includes(q))) ||
          (item.explanation && item.explanation.toLowerCase().includes(q))
      );
    }

    return list;
  }, [baseTopicQuestions, filterType, debouncedSearchQuery]);

  // 3. Global search results (for root view) - only run when debounced query is at least 2 chars
  const globalMatchingQuestions = useMemo(() => {
    if (selectedTopic || !debouncedSearchQuery || debouncedSearchQuery.length < 2) return [];
    const q = debouncedSearchQuery.toLowerCase();
    const matches: { question: Question; chapter: Chapter; topic: Topic }[] = [];

    for (let cIdx = 0; cIdx < chapters.length; cIdx++) {
      const ch = chapters[cIdx];
      for (let tIdx = 0; tIdx < ch.topics.length; tIdx++) {
        const top = ch.topics[tIdx];
        if (!top.questions) continue;
        for (let qIdx = 0; qIdx < top.questions.length; qIdx++) {
          const item = top.questions[qIdx];
          if (filterType === "custom" && !item.isUserAdded) continue;
          if (filterType === "base" && item.isUserAdded) continue;

          if (
            (item.text && item.text.toLowerCase().includes(q)) ||
            (item.options && item.options.some((opt) => opt.toLowerCase().includes(q))) ||
            (item.explanation && item.explanation.toLowerCase().includes(q))
          ) {
            matches.push({ question: item, chapter: ch, topic: top });
          }
        }
      }
    }

    return matches;
  }, [selectedTopic, debouncedSearchQuery, filterType, chapters]);

  // 4. Final active list for display and selection
  const activeQuestionsList = useMemo(() => {
    return selectedTopic
      ? filteredTopicQuestions
      : globalMatchingQuestions.map((m) => m.question);
  }, [selectedTopic, filteredTopicQuestions, globalMatchingQuestions]);

  // Reset page to 1 on topic, search, or filter changes
  useEffect(() => {
  }, [selectedTopic, searchQuery, filterType]);

  const totalMcqCount = activeQuestionsList.length;
  const mcqTotalPages = 1;
  const safeMcqPage = 1;
  const mcqStartIndex = 0;
  const mcqEndIndex = totalMcqCount;

  const paginatedQuestions = activeQuestionsList;


  // Select questions by custom quantity (e.g., 20, 50, 100, 200, 507)

  // Select questions by custom quantity (e.g., 20, 50, 100, 200, 507)
  const handleSelectCustomQuantity = (overrideQty?: number) => {
    const rawVal = overrideQty !== undefined ? overrideQty : parseInt(customQuantity.trim(), 10);

    if (isNaN(rawVal) || rawVal <= 0) {
      setQuantityError("Please enter a valid positive quantity of questions (e.g., 20, 50, 100, 200, 507).");
      return;
    }

    const targetPool = (selectedTopic || debouncedSearchQuery) ? activeQuestionsList : allAppQuestions;
    const availableCount = targetPool.length;
    if (availableCount === 0) {
      setQuantityError("No eligible questions available matching your current filter/view.");
      return;
    }

    setQuantityError(null);

    if (rawVal > availableCount) {
      const next = new Set<string>();
      targetPool.forEach((q) => next.add(q.id));
      setSelectedQuestionIds(next);
      showNotification(`Requested ${rawVal} questions, but only ${availableCount} available. Selected all ${availableCount} available question(s).`);
    } else {
      const next = new Set<string>();
      targetPool.slice(0, rawVal).forEach((q) => next.add(q.id));
      setSelectedQuestionIds(next);
      showNotification(`Selected exactly ${rawVal} question(s) for bulk move/delete.`);
    }
  };

  // Toggle single question selection
  const handleToggleSelectQuestion = (id: string) => {
    setSelectedQuestionIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Pre-index all questions across chapters to prevent redundant flatMap scans
  const allAppQuestions = useMemo(() => {
    const list: Question[] = [];
    for (let cIdx = 0; cIdx < chapters.length; cIdx++) {
      const ch = chapters[cIdx];
      for (let tIdx = 0; tIdx < ch.topics.length; tIdx++) {
        const top = ch.topics[tIdx];
        if (!top.questions) continue;
        for (let qIdx = 0; qIdx < top.questions.length; qIdx++) {
          list.push(top.questions[qIdx]);
        }
      }
    }
    return list;
  }, [chapters]);

  const allAppQuestionsMap = useMemo(() => {
    const map = new Map<string, Question>();
    for (let i = 0; i < allAppQuestions.length; i++) {
      const q = allAppQuestions[i];
      map.set(q.id, q);
    }
    return map;
  }, [allAppQuestions]);

  // Duplicate Audit State & Handlers
  const [auditReport, setAuditReport] = useState<DuplicateAuditReport | null>(null);
  const [showAuditModal, setShowAuditModal] = useState(false);
  const [isMergingDuplicates, setIsMergingDuplicates] = useState(false);
  const [auditMergeProgress, setAuditMergeProgress] = useState<string | null>(null);

  const handleRunDuplicateAudit = () => {
    const report = runDuplicateAudit(allAppQuestions);
    setAuditReport(report);
    setShowAuditModal(true);
  };

  const handleConfirmMergeDuplicates = async () => {
    if (!auditReport || auditReport.duplicateGroupCount === 0 || isMergingDuplicates) return;
    try {
      setIsMergingDuplicates(true);
      setAuditMergeProgress("Merging duplicate records in Firestore...");
      const result = await executeDuplicateMerge(auditReport.groups, (progressText) => {
        setAuditMergeProgress(progressText);
      });
      if (result.success) {
        showNotification(`Successfully merged ${result.mergedGroupsCount} duplicate group(s) and removed ${result.deletedQuestionIds.length} redundant document(s)!`);
        setShowAuditModal(false);
        setAuditReport(null);
      } else {
        showNotification(`Partial merge: ${result.deletedQuestionIds.length} deleted, ${result.errors.length} failed.`);
      }
    } catch (err: any) {
      showNotification(`Failed to merge duplicates: ${err?.message || err}`);
    } finally {
      setIsMergingDuplicates(false);
      setAuditMergeProgress(null);
    }
  };

  const isAllAppSelected = allAppQuestions.length > 0 && allAppQuestions.every(q => selectedQuestionIds.has(q.id));

  const isAllVisibleSelected =
    activeQuestionsList.length > 0 &&
    activeQuestionsList.every((q) => selectedQuestionIds.has(q.id));

  const handleToggleSelectAll = () => {
    if (selectedTopic || searchQuery.trim()) {
      // Logic for filtered view (already exists but refined)
      if (isAllVisibleSelected) {
        setSelectedQuestionIds((prev) => {
          const next = new Set(prev);
          activeQuestionsList.forEach((q) => next.delete(q.id));
          return next;
        });
      } else {
        setSelectedQuestionIds((prev) => {
          const next = new Set(prev);
          activeQuestionsList.forEach((q) => next.add(q.id));
          return next;
        });
      }
    } else {
      // Logic for root view: Select/Deselect everything in the app
      if (isAllAppSelected) {
        setSelectedQuestionIds(new Set());
      } else {
        const next = new Set<string>();
        allAppQuestions.forEach(q => next.add(q.id));
        setSelectedQuestionIds(next);
      }
    }
  };

  // Select entire chapter
  const handleToggleChapterSelect = (chapter: Chapter, e: React.MouseEvent) => {
    e.stopPropagation();
    const chapterQuestionIds = chapter.topics.flatMap(t => (t.questions || []).map(q => q.id));
    const isChapterFullySelected = chapterQuestionIds.length > 0 && chapterQuestionIds.every(id => selectedQuestionIds.has(id));

    setSelectedQuestionIds(prev => {
      const next = new Set(prev);
      if (isChapterFullySelected) {
        chapterQuestionIds.forEach(id => next.delete(id));
      } else {
        chapterQuestionIds.forEach(id => next.add(id));
      }
      return next;
    });
  };

  // Select entire topic
  const handleToggleTopicSelect = (topic: Topic, e: React.MouseEvent) => {
    e.stopPropagation();
    const topicQuestionIds = (topic.questions || []).map(q => q.id);
    const isTopicFullySelected = topicQuestionIds.length > 0 && topicQuestionIds.every(id => selectedQuestionIds.has(id));

    setSelectedQuestionIds(prev => {
      const next = new Set(prev);
      if (isTopicFullySelected) {
        topicQuestionIds.forEach(id => next.delete(id));
      } else {
        topicQuestionIds.forEach(id => next.add(id));
      }
      return next;
    });
  };

  // Counts of selected questions for confirmation dialogs - O(1) map lookups instead of re-flattening all chapters
  const selectedQuestionsObjects = useMemo(() => {
    if (selectedQuestionIds.size === 0) return [];
    const list: Question[] = [];
    selectedQuestionIds.forEach((id) => {
      const q = allAppQuestionsMap.get(id);
      if (q) list.push(q);
    });
    return list;
  }, [allAppQuestionsMap, selectedQuestionIds]);

  const customSelectedCount = selectedQuestionsObjects.filter((q) => q.isUserAdded).length;
  const baseSelectedCount = selectedQuestionsObjects.length - customSelectedCount;

  // Execute Bulk Delete
  const handleConfirmBulkDelete = () => {
    const ids = Array.from(selectedQuestionIds);
    if (ids.length === 0) return;

    if (onBulkDeleteQuestions) {
      onBulkDeleteQuestions(ids);
    } else {
      ids.forEach((id) => onDeleteQuestion(id));
    }

    showNotification(`Deleted ${ids.length} question(s) successfully.`);
    setSelectedQuestionIds(new Set());
    setShowBulkDeleteModal(false);
  };

  // Execute Bulk Move safely and idempotently
  const handleConfirmBulkMove = async (targetChapterId: string, targetTopicId: string) => {
    if (isBulkMoving) return;
    const ids = Array.from(selectedQuestionIds);
    if (ids.length === 0) return;

    if (selectedTopic && selectedTopic.chapterId === targetChapterId && selectedTopic.topicId === targetTopicId) {
      showNotification("Selected questions are already in this topic.");
      return;
    }

    setIsBulkMoving(true);
    try {
      if (onBulkMoveQuestions) {
        await onBulkMoveQuestions(ids, targetChapterId, targetTopicId);
      } else {
        // Fallback: update each question individually
        selectedQuestionsObjects.forEach((q) => {
          onEditQuestion({
            ...q,
            chapterId: targetChapterId,
            topicId: targetTopicId,
          });
        });
      }

      const targetChapter = chapters.find((c) => c.id === targetChapterId);
      const targetTopic = targetChapter?.topics.find((t) => t.id === targetTopicId);

      showNotification(
        `Moved ${ids.length} question(s) to "${targetTopic?.title || "selected topic"}".`
      );
      setSelectedQuestionIds(new Set());
      setShowBulkMoveModal(false);
    } catch (err: any) {
      console.error("Move questions error:", err);
      showNotification(`Failed to move questions: ${err?.message || err}`);
    } finally {
      setIsBulkMoving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#171923]/75 backdrop-blur-xs flex flex-col items-center justify-end sm:justify-center p-0 sm:p-4 overflow-y-auto">
      <div
        id="manage-questions-modal-card"
        className="w-full sm:max-w-2xl bg-[#FFF9EF] dark:bg-[#171923] border-t sm:border border-[#E8D9C0] dark:border-[#31374A] rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col h-[94vh] sm:h-auto sm:max-h-[90vh] relative animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-200"
      >
        {/* Heritage accent strip */}
        <div className="h-1 w-full bg-gradient-to-r from-[#800020] via-[#F47B20] to-[#C99A45] shrink-0" />
        {/* Top Header */}
        <div className="px-4 sm:px-6 pt-4 pb-3.5 bg-white dark:bg-[#1F2330] border-b border-[#E8D9C0] dark:border-[#31374A] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            {selectedTopic && (
              <button
                onClick={handleBackToTopics}
                className="w-9 h-9 rounded-full bg-[#F7EFE2] dark:bg-[#252A3A] border border-[#E8D9C0] dark:border-[#31374A] text-[#52576A] dark:text-[#CBD2E1] hover:text-[#800020] dark:hover:text-[#F47B20] flex items-center justify-center active:scale-95 transition-all shrink-0 cursor-pointer"
                title="Back to Topics"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-black text-[#171923] dark:text-[#FFF9EF] flex items-center gap-2 truncate">
                <span>Manage Questions</span>
              </h2>
              <p className="text-xs text-[#52576A] dark:text-[#CBD2E1] mt-0.5 truncate max-w-[280px] sm:max-w-[420px]">
                {activeChapter && activeTopic
                  ? `${getChapterDisplayName(activeChapter)} › ${getTopicDisplayName(activeTopic)}`
                  : "Browse chapters, edit MCQs & reorganize syllabus"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleRunDuplicateAudit}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#C99A45]/15 border border-[#C99A45]/30 text-[#800020] dark:text-[#C99A45] font-black text-[11px] uppercase tracking-wider transition-all hover:bg-[#C99A45]/25 active:scale-95 shrink-0 cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Audit Duplicates
            </button>
            <button
              id="btn-close-manage-questions"
              onClick={onClose}
              className="w-9 h-9 rounded-full bg-[#F7EFE2] dark:bg-[#252A3A] border border-[#E8D9C0] dark:border-[#31374A] text-[#52576A] dark:text-[#CBD2E1] hover:text-[#800020] dark:hover:text-[#F47B20] flex items-center justify-center transition-colors active:scale-95 shrink-0 ml-2 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* In-modal Banner Notification */}
        {bannerMessage && (
          <div className="px-4 py-2.5 bg-emerald-50 dark:bg-emerald-950/70 border-b border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-xs font-semibold flex items-center gap-2 animate-in fade-in duration-200 shrink-0">
            <Check className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="flex-1">{bannerMessage}</span>
          </div>
        )}

        {/* Scrollable Content */}
        <div ref={setModalScrollContainer} className="p-3 sm:p-5 overflow-y-auto flex-1 space-y-4">
          {!selectedTopic && searchQuery.trim() === "" ? (
            /* VIEW 1: CHAPTER & TOPIC HIERARCHY */
            <div className="space-y-3">
              {/* Search bar for quick global question lookup */}
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search questions across all chapters & topics..."
                  className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-white dark:bg-[#111A2E] border border-slate-200 dark:border-slate-800 text-xs sm:text-sm text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-xs"
                />
              </div>

              {/* Bulk Custom Quantity Selection Panel (VIEW 1) */}
              <div className="bg-white dark:bg-[#111A2E] p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-2">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                    <label className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      Select Quantity (Move or Bulk Delete)
                    </label>
                  </div>
                  <span className="text-[11px] font-mono font-bold text-slate-400">
                    Available: {allAppQuestions.length} MCQs
                  </span>
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <div className="relative flex-1">
                    <input
                      type="number"
                      min="1"
                      value={customQuantity}
                      onChange={(e) => {
                        setCustomQuantity(e.target.value);
                        setQuantityError(null);
                      }}
                      placeholder="Enter quantity (e.g., 20, 50, 100, 200, 507)"
                      className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-mono font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div className="flex items-center gap-1 overflow-x-auto no-scrollbar shrink-0">
                    {[20, 50, 100, 200, 507].map((qty) => (
                      <button
                        key={qty}
                        type="button"
                        onClick={() => {
                          setCustomQuantity(String(qty));
                          setQuantityError(null);
                          handleSelectCustomQuantity(qty);
                        }}
                        className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-blue-50 dark:bg-slate-800 dark:hover:bg-blue-950/60 text-slate-700 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 text-[11px] font-mono font-bold border border-slate-200/60 dark:border-slate-700/60 transition-colors cursor-pointer"
                      >
                        {qty}
                      </button>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={() => handleSelectCustomQuantity()}
                    className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-xs cursor-pointer active:scale-95 shrink-0"
                  >
                    <CheckSquare className="w-3.5 h-3.5" />
                    <span>Select Questions</span>
                  </button>
                </div>

                {quantityError && (
                  <div className="p-2 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-[11px] font-semibold flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{quantityError}</span>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between px-1">
                <button
                  type="button"
                  onClick={handleToggleSelectAll}
                  className="flex items-center gap-2 text-[11px] uppercase tracking-wider font-bold text-slate-400 hover:text-blue-600 transition-colors cursor-pointer"
                >
                  {isAllAppSelected ? (
                    <CheckSquare className="w-3.5 h-3.5 text-blue-600" />
                  ) : (
                    <Square className="w-3.5 h-3.5" />
                  )}
                  <span>Select All Chapters</span>
                </button>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono font-bold">
                  {chapters.reduce(
                    (s, c) => s + (c.topics || []).reduce((ts, t) => ts + (t.questions?.length || 0), 0),
                    0
                  )}{" "}
                  Total MCQs
                </span>
              </div>

              <div className="space-y-3">
                {chapters.map((chapter, idx) => {
                  const totalChapterQ = (chapter.topics || []).reduce(
                    (sum, t) => sum + (t.questions?.length || 0),
                    0
                  );
                  const customInChapter = (chapter.topics || []).reduce(
                    (sum, t) => sum + (t.questions || []).filter((q) => q.isUserAdded).length,
                    0
                  );

                  const chapterQs = (chapter.topics || []).flatMap(t => t.questions || []);

                  return (
                    <div
                      key={chapter.id}
                      className="bg-white dark:bg-[#111A2E] border border-slate-200/80 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs"
                    >
                      {/* Chapter Header */}
                      <div className="px-4 py-3 bg-slate-50/80 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <button
                            onClick={(e) => handleToggleChapterSelect(chapter, e)}
                            className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white dark:hover:bg-slate-700 transition-colors cursor-pointer"
                          >
                            {chapterQs.length > 0 && chapterQs.every(q => selectedQuestionIds.has(q.id)) ? (
                              <CheckSquare className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                            ) : (
                              <Square className="w-4 h-4 text-slate-400" />
                            )}
                          </button>
                          <span className="w-7 h-7 rounded-xl bg-blue-50 dark:bg-blue-950/80 text-blue-600 dark:text-blue-400 text-xs font-mono font-bold flex items-center justify-center shrink-0">
                            {idx + 1}
                          </span>
                          <div className="min-w-0">
                            <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate">
                              {getChapterDisplayName(chapter)}
                            </h3>
                            {getChapterSecondaryTitle(chapter) && (
                              <span className="text-[11px] text-slate-400 font-hindi block truncate">
                                {getChapterSecondaryTitle(chapter)}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {customInChapter > 0 && (
                            <span className="text-[10px] font-bold text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/50 px-2 py-0.5 rounded-md border border-purple-200/50 dark:border-purple-800/50">
                              {customInChapter} custom
                            </span>
                          )}
                          <span className="text-xs font-mono font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-lg">
                            {totalChapterQ} Qs
                          </span>
                        </div>
                      </div>

                      {/* Topic rows inside Chapter */}
                      <div className="divide-y divide-slate-100 dark:divide-slate-800/60">
                        {(chapter.topics || []).map((topic, tIdx) => {
                          const topicQs = topic.questions || [];
                          const customCount = topicQs.filter(
                            (q) => q.isUserAdded
                          ).length;

                          return (
                            <div key={`${topic.id}-${tIdx}`} className="flex items-center group">
                              <div className="pl-4">
                                <button
                                  onClick={(e) => handleToggleTopicSelect(topic, e)}
                                  className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                                >
                                  {topicQs.length > 0 && topicQs.every(q => selectedQuestionIds.has(q.id)) ? (
                                    <CheckSquare className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                                  ) : (
                                    <Square className="w-4 h-4 text-slate-400" />
                                  )}
                                </button>
                              </div>
                              <button
                                onClick={() => handleSelectTopic(chapter, topic)}
                                className="flex-1 px-4 py-3.5 text-left hover:bg-slate-50/90 dark:hover:bg-slate-800/60 active:bg-slate-100 dark:active:bg-slate-800 flex items-center justify-between transition-colors cursor-pointer"
                              >
                                <div className="flex-1 pr-3 min-w-0">
                                <span className="text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-200 block group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors truncate">
                                  {getTopicDisplayName(topic)}
                                </span>
                                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                  {getTopicSecondaryTitle(topic) && (
                                    <span className="text-[11px] text-slate-400 font-hindi truncate">
                                      {getTopicSecondaryTitle(topic)}
                                    </span>
                                  )}
                                  {customCount > 0 && (
                                    <span className="text-[9px] font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-1.5 py-0.2 rounded-md">
                                      {customCount} custom
                                    </span>
                                  )}
                                </div>
                              </div>

                              <div className="flex items-center gap-2 shrink-0">
                                <span className="font-mono text-xs font-bold text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800/80 px-2 py-1 rounded-lg">
                                  {topicQs.length} Q
                                </span>
                                <ChevronRight className="w-4 h-4 text-slate-300 dark:text-slate-600 group-hover:text-blue-500 group-hover:translate-x-0.5 transition-all" />
                              </div>
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
            </div>
          ) : (
            /* VIEW 2: QUESTIONS LIST (Topic Specific or Global Search Results) */
            <div className="space-y-3.5">
              {/* Search & Filter Bar */}
              <div className="space-y-2.5">
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={
                      selectedTopic
                        ? "Search in this topic..."
                        : "Search all questions..."
                    }
                    className="w-full pl-10 pr-9 py-2.5 rounded-2xl bg-white dark:bg-[#111A2E] border border-slate-200 dark:border-slate-800 text-xs sm:text-sm text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-xs"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery("")}
                      className="w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-800 absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 flex items-center justify-center"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Filter Pills with Horizontal Swipe */}
                <div className="flex items-center gap-2 overflow-x-auto pb-1 touch-pan-x no-scrollbar">
                  <button
                    onClick={() => setFilterType("all")}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all shrink-0 cursor-pointer ${
                      filterType === "all"
                        ? "bg-blue-600 text-white shadow-xs"
                        : "bg-white dark:bg-[#111A2E] border border-slate-200/80 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50"
                    }`}
                  >
                    All ({selectedTopic ? baseTopicQuestions.length : allAppQuestions.length})
                  </button>
                  <button
                    onClick={() => setFilterType("custom")}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all shrink-0 cursor-pointer ${
                      filterType === "custom"
                        ? "bg-blue-600 text-white shadow-xs"
                        : "bg-white dark:bg-[#111A2E] border border-slate-200/80 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50"
                    }`}
                  >
                    Custom Added (
                    {selectedTopic 
                      ? baseTopicQuestions.filter(q => q.isUserAdded).length 
                      : allAppQuestions.filter(q => q.isUserAdded).length}
                    )
                  </button>
                  <button
                    onClick={() => setFilterType("base")}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all shrink-0 cursor-pointer ${
                      filterType === "base"
                        ? "bg-blue-600 text-white shadow-xs"
                        : "bg-white dark:bg-[#111A2E] border border-slate-200/80 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50"
                    }`}
                  >
                    Default (
                    {selectedTopic 
                      ? baseTopicQuestions.filter(q => !q.isUserAdded).length 
                      : allAppQuestions.filter(q => !q.isUserAdded).length}
                    )
                  </button>
                </div>
              </div>

              {/* Bulk Custom Quantity Selection Panel (VIEW 2) */}
              <div className="bg-white dark:bg-[#111A2E] p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-2">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                    <label className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      Select Quantity (Move or Bulk Delete)
                    </label>
                  </div>
                  <span className="text-[11px] font-mono font-bold text-slate-400">
                    Filtered MCQs: {activeQuestionsList.length}
                  </span>
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <div className="relative flex-1">
                    <input
                      type="number"
                      min="1"
                      value={customQuantity}
                      onChange={(e) => {
                        setCustomQuantity(e.target.value);
                        setQuantityError(null);
                      }}
                      placeholder="Enter quantity (e.g., 20, 50, 100, 200, 507)"
                      className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-mono font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div className="flex items-center gap-1 overflow-x-auto no-scrollbar shrink-0">
                    {[20, 50, 100, 200, 507].map((qty) => (
                      <button
                        key={qty}
                        type="button"
                        onClick={() => {
                          setCustomQuantity(String(qty));
                          setQuantityError(null);
                          handleSelectCustomQuantity(qty);
                        }}
                        className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-blue-50 dark:bg-slate-800 dark:hover:bg-blue-950/60 text-slate-700 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 text-[11px] font-mono font-bold border border-slate-200/60 dark:border-slate-700/60 transition-colors cursor-pointer"
                      >
                        {qty}
                      </button>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={() => handleSelectCustomQuantity()}
                    className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-xs cursor-pointer active:scale-95 shrink-0"
                  >
                    <CheckSquare className="w-3.5 h-3.5" />
                    <span>Select Questions</span>
                  </button>
                </div>

                {quantityError && (
                  <div className="p-2 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-[11px] font-semibold flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{quantityError}</span>
                  </div>
                )}
              </div>

              {/* Multi-Selection Control Toolbar */}
              <div className="flex items-center justify-between px-3.5 py-2.5 bg-slate-100 dark:bg-slate-800/70 rounded-2xl text-xs border border-slate-200/60 dark:border-slate-700/50">
                <button
                  type="button"
                  onClick={handleToggleSelectAll}
                  className="flex items-center gap-2 text-slate-700 dark:text-slate-200 font-semibold hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-pointer"
                >
                  {isAllVisibleSelected ? (
                    <CheckSquare className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  ) : (
                    <Square className="w-4 h-4 text-slate-400" />
                  )}
                  <span>
                    {selectedQuestionIds.size > 0
                      ? `${selectedQuestionIds.size} of ${activeQuestionsList.length} selected`
                      : `Select All (${activeQuestionsList.length})`}
                  </span>
                </button>

                <div className="flex items-center gap-2 flex-wrap">
                  {selectedQuestionIds.size > 0 ? (
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => setShowBulkMoveModal(true)}
                        className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center gap-1 cursor-pointer active:scale-95"
                        title="Move selected questions to another topic"
                      >
                        <FolderInput className="w-3.5 h-3.5" />
                        <span>Move ({selectedQuestionIds.size})</span>
                      </button>
                      <button
                        onClick={() => setShowBulkDeleteModal(true)}
                        className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs flex items-center gap-1 cursor-pointer active:scale-95"
                        title="Delete selected questions"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Delete ({selectedQuestionIds.size})</span>
                      </button>
                      <button
                        onClick={() => setSelectedQuestionIds(new Set())}
                        className="px-2 py-1 text-xs font-bold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer ml-1"
                      >
                        Deselect
                      </button>
                    </div>
                  ) : (
                    selectedTopic && onAddQuestions && (
                      <div className="flex items-center gap-2.5">
                        <button
                          onClick={() => onAddQuestions(selectedTopic.chapterId, selectedTopic.topicId, "manual")}
                          className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Add MCQ</span>
                        </button>
                        <button
                          onClick={() => onAddQuestions(selectedTopic.chapterId, selectedTopic.topicId, "paste")}
                          className="text-xs font-bold text-purple-600 dark:text-purple-400 hover:underline flex items-center gap-1 cursor-pointer"
                        >
                          <Upload className="w-3.5 h-3.5" />
                          <span>Add MCQ Import</span>
                        </button>
                        {onShowHTMLImport && (
                          <button
                            onClick={() => onShowHTMLImport(selectedTopic.chapterId, selectedTopic.topicId)}
                            className="text-xs font-bold text-orange-600 dark:text-orange-400 hover:underline flex items-center gap-1 cursor-pointer"
                            title="Import MCQs from HTML file or source code"
                          >
                            <FileCode className="w-3.5 h-3.5" />
                            <span>HTML Import MCQ</span>
                          </button>
                        )}
                      </div>
                    )
                  )}
                </div>
              </div>

              {/* Top MCQ Pagination Bar */}
              {/* Removed Pagination Bar */}

              {/* Questions List */}
              {isLoadingTopicQuestions ? (
                <div className="py-4">
                  <CardGridSkeleton count={4} cols={1} />
                </div>
              ) : activeQuestionsList.length === 0 ? (
                <div className="p-8 text-center bg-white dark:bg-[#111A2E] rounded-2xl border border-slate-200/80 dark:border-slate-800 space-y-2">
                  <BookOpen className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto" />
                  <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                    No questions found matching your criteria.
                  </p>
                </div>
              ) : (
                <div className="pb-24">
                  <VirtualizedQuestionList
                    questions={activeQuestionsList}
                    selectedQuestionIds={selectedQuestionIds}
                    singleDeletingQuestionId={singleDeletingQuestionId}
                    handleToggleSelectQuestion={handleToggleSelectQuestion}
                    setSingleDeletingQuestionId={setSingleDeletingQuestionId}
                    setEditingQuestion={setEditingQuestion}
                    setSelectedQuestionIds={setSelectedQuestionIds}
                    setShowBulkMoveModal={setShowBulkMoveModal}
                    showNotification={showNotification}
                    onDeleteQuestion={onDeleteQuestion}
                    scrollElement={modalScrollContainer}
                  />
                </div>
              )}
            </div>
          )}
        </div>

        {/* STICKY FLOATING BULK ACTION BAR (When items are selected) */}
        {selectedQuestionIds.size > 0 && (
          <div className="absolute bottom-20 sm:bottom-18 inset-x-3 sm:inset-x-6 z-30 bg-slate-900/95 dark:bg-black/95 backdrop-blur-md text-white px-4 py-3 rounded-2xl shadow-2xl flex items-center justify-between border border-slate-700/60 animate-in fade-in slide-in-from-bottom-2 duration-150">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-blue-500 text-white text-xs font-bold flex items-center justify-center">
                {selectedQuestionIds.size}
              </span>
              <span className="text-xs font-semibold text-slate-200">Selected</span>
            </div>

            <div className="flex items-center gap-2">
              {/* Move Button */}
              <button
                id="btn-bulk-move-questions"
                onClick={() => setShowBulkMoveModal(true)}
                className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center gap-1.5 transition-colors shadow-sm cursor-pointer active:scale-95"
                title="Move selected questions to another topic"
              >
                <FolderInput className="w-4 h-4" />
                <span>Move</span>
              </button>

              {/* Delete Button */}
              <button
                id="btn-bulk-delete-questions"
                onClick={() => setShowBulkDeleteModal(true)}
                className="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold flex items-center gap-1.5 transition-colors shadow-sm cursor-pointer active:scale-95"
                title="Delete selected questions"
              >
                <Trash2 className="w-4 h-4" />
                <span>Delete</span>
              </button>

              {/* Clear Selection */}
              <button
                onClick={() => setSelectedQuestionIds(new Set())}
                className="w-8 h-8 rounded-xl bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
                title="Clear selection"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Modal Bottom Footer */}
        <div className="p-3 sm:p-4 bg-white dark:bg-[#111A2E] border-t border-slate-200/80 dark:border-slate-800 flex items-center justify-between shrink-0">
          <button
            onClick={onClose}
            className="w-full py-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-2xl text-xs sm:text-sm font-bold transition-colors active:scale-95 cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>

      {/* MODAL 1: BULK MOVE CATEGORIZATION DIALOG */}
      {showBulkMoveModal && (
        <MoveQuestionsDialog
          questionCount={selectedQuestionIds.size}
          currentChapterTitle={activeChapter?.title}
          currentTopicTitle={activeTopic?.title}
          currentChapterId={activeChapter?.id}
          currentTopicId={activeTopic?.id}
          chapters={chapters}
          isMoving={isBulkMoving}
          onConfirmMove={handleConfirmBulkMove}
          onCancel={() => {
            if (!isBulkMoving) setShowBulkMoveModal(false);
          }}
        />
      )}

      {/* MODAL 2: BULK DELETE CONFIRMATION DIALOG */}
      {showBulkDeleteModal && (
        <BulkDeleteConfirmDialog
          questionCount={selectedQuestionIds.size}
          customCount={customSelectedCount}
          baseCount={baseSelectedCount}
          onConfirmDelete={handleConfirmBulkDelete}
          onCancel={() => setShowBulkDeleteModal(false)}
        />
      )}

      {/* MODAL 3: EDIT QUESTION DIALOG */}
      {editingQuestion && (
        <EditQuestionDialog
          question={editingQuestion}
          onSave={(updated) => {
            onEditQuestion(updated);
            setTopicFetchedQuestions((prev) =>
              prev ? prev.map((q) => (q.id === updated.id ? updated : q)) : null
            );
            setEditingQuestion(null);
            showNotification("Question updated successfully!");
          }}
          onCancel={() => setEditingQuestion(null)}
        />
      )}
      {/* MODAL 4: DUPLICATE AUDIT DIALOG */}
      {showAuditModal && auditReport && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#111A2E] w-full max-w-lg rounded-3xl p-6 space-y-4 shadow-2xl">
            <h3 className="text-lg font-black text-slate-900 dark:text-white">Duplicate Audit Report</h3>
            <p className="text-sm text-slate-500">Found {auditReport.duplicateGroupCount} groups of duplicate questions ({auditReport.totalDuplicateRecords} total redundant records).</p>
            
            <div className="max-h-[300px] overflow-y-auto space-y-2">
              {auditReport.groups.map((group, idx) => (
                <div key={idx} className="p-3 bg-slate-50 dark:bg-slate-900 rounded-xl text-xs border border-slate-200 dark:border-slate-800">
                  <p className="font-bold truncate">{group.sampleQuestionText}</p>
                  <p className="text-[10px] text-slate-500">Group Size: {group.totalRecords}</p>
                </div>
              ))}
            </div>

            <div className="flex gap-2 pt-4">
              <button 
                onClick={() => setShowAuditModal(false)}
                className="flex-1 py-3 bg-slate-200 dark:bg-slate-800 rounded-xl font-bold text-xs cursor-pointer"
              >Cancel</button>
              <button 
                onClick={handleConfirmMergeDuplicates}
                disabled={isMergingDuplicates}
                className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-bold text-xs cursor-pointer"
              >
                {isMergingDuplicates ? auditMergeProgress : "Merge Duplicates"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
