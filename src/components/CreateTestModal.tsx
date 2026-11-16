import React, { useState, useMemo } from "react";
import { Chapter, Topic, Question, ProgressStore, MCQSession, PerformanceStore } from "../types";
import {
  X,
  ArrowLeft,
  BookOpen,
  Layers,
  Search,
  Sparkles,
  Play,
  ChevronRight,
  CheckCircle2,
  Sliders,
  CheckSquare,
  Square,
  Award,
  Zap,
  RotateCcw,
  Target,
} from "lucide-react";
import { loadPerformanceStore } from "../utils/performanceStorage";
import { generateIntelligentTest } from "../utils/smartTestGenerator";

interface CreateTestModalProps {
  isOpen: boolean;
  onClose: () => void;
  questions: Question[];
  chapters: Chapter[];
  progressStore: ProgressStore;
  perfStore?: PerformanceStore;
  onStartSession: (session: MCQSession) => void;
}

type TestScope = "options" | "all-chapters" | "chapter-wise" | "topic";
type SubMode = "smart" | "custom-select";

const CreateTestModal: React.FC<CreateTestModalProps> = ({
  isOpen,
  onClose,
  questions = [],
  chapters = [],
  progressStore = {},
  perfStore,
  onStartSession,
}) => {
  const [scope, setScope] = useState<TestScope>("options");
  const [subMode, setSubMode] = useState<SubMode>("smart");

  // Question Count Selection for Smart Mode
  const [selectedQuestionCount, setSelectedQuestionCount] = useState<number | "all">(25);
  const [isCustomCount, setIsCustomCount] = useState<boolean>(false);
  const [customCountInput, setCustomCountInput] = useState<string>("25");

  // Selection targets
  const [selectedChapter, setSelectedChapter] = useState<Chapter | null>(null);
  const [selectedTopic, setSelectedTopic] = useState<Topic | null>(null);

  // Manual Question Selection state
  const [manuallySelectedIds, setManuallySelectedIds] = useState<Set<string>>(new Set());
  const [questionSearchQuery, setQuestionSearchQuery] = useState("");
  const [questionFilterTag, setQuestionFilterTag] = useState<string>("all");

  // Navigation search
  const [chapterSearchQuery, setChapterSearchQuery] = useState("");
  const [topicSearchQuery, setTopicSearchQuery] = useState("");

  const effectivePerfStore = useMemo(() => {
    return perfStore || loadPerformanceStore(progressStore);
  }, [perfStore, progressStore]);

  // Reset internal state
  const handleClose = () => {
    setScope("options");
    setSubMode("smart");
    setSelectedChapter(null);
    setSelectedTopic(null);
    setSelectedQuestionCount(25);
    setIsCustomCount(false);
    setCustomCountInput("25");
    setManuallySelectedIds(new Set());
    setQuestionSearchQuery("");
    setQuestionFilterTag("all");
    setChapterSearchQuery("");
    setTopicSearchQuery("");
    onClose();
  };

  const handleSelectScope = (newScope: TestScope) => {
    setScope(newScope);
    setSubMode("smart");
    setSelectedChapter(null);
    setSelectedTopic(null);
    setIsCustomCount(false);
    setManuallySelectedIds(new Set());
    setQuestionSearchQuery("");

    if (newScope === "all-chapters") {
      const qLen = Array.isArray(questions) ? questions.length : 0;
      setSelectedQuestionCount(Math.min(25, qLen));
      setCustomCountInput(String(Math.min(25, qLen)));
    } else if (newScope === "chapter-wise") {
      setSelectedQuestionCount(20);
      setCustomCountInput("20");
    } else if (newScope === "topic") {
      setSelectedQuestionCount("all");
      setCustomCountInput("10");
    }
  };

  // Determine current active question pool for manual selection
  const activeQuestionPool = useMemo(() => {
    if (scope === "all-chapters") {
      return questions;
    }
    if (scope === "chapter-wise" && selectedChapter) {
      return (selectedChapter.topics || []).flatMap((t) => t.questions || []);
    }
    if (scope === "topic" && selectedTopic) {
      return selectedTopic.questions || [];
    }
    return [];
  }, [scope, selectedChapter, selectedTopic, questions]);

  // Filter questions for Custom Question Select view
  const filteredActiveQuestions = useMemo(() => {
    const q = questionSearchQuery.trim().toLowerCase();
    const list = activeQuestionPool.filter((item) => {
      if (q) {
        const matchText = (item.text || "").toLowerCase().includes(q);
        const matchConcept = (item.conceptName || "").toLowerCase().includes(q);
        const matchExp = (item.explanation || "").toLowerCase().includes(q);
        if (!matchText && !matchConcept && !matchExp) return false;
      }

      if (questionFilterTag !== "all") {
        const perf = effectivePerfStore ? effectivePerfStore[item.id] : undefined;
        const prog = progressStore ? progressStore[item.id] : undefined;

        if (questionFilterTag === "weak-area") {
          if (!perf || perf.lastResult !== "wrong") return false;
        } else if (questionFilterTag === "due-today") {
          if (!prog || prog.status !== "wrong") return false;
        }
      }

      return true;
    });

    // Final deduplication by ID
    const deduped = new Map<string, Question>();
    list.forEach(item => deduped.set(item.id, item));
    return Array.from(deduped.values());
  }, [activeQuestionPool, questionSearchQuery, questionFilterTag, effectivePerfStore, progressStore]);

  // Calculate effective count
  const getActiveQuestionCount = (totalAvailable: number): number => {
    if (totalAvailable <= 0) return 0;
    if (isCustomCount) {
      const parsed = parseInt(customCountInput, 10);
      if (isNaN(parsed) || parsed < 1) return 1;
      return Math.min(parsed, totalAvailable);
    }
    if (selectedQuestionCount === "all") {
      return totalAvailable;
    }
    return Math.min(selectedQuestionCount, totalAvailable);
  };

  // ──────────────────────────────────────────
  // START TEST ACTIONS
  // ──────────────────────────────────────────

  // Start with Smart Intelligent Selection
  const handleStartSmartTest = () => {
    const totalAvailable = activeQuestionPool.length;
    const targetCount = getActiveQuestionCount(totalAvailable);
    if (targetCount <= 0) return;

    let testType: "topic" | "chapter" | "all-chapters" = "all-chapters";
    let title = "All Chapters Test";
    let subtitle = `${targetCount} Questions Test`;
    let chapterId: string | undefined = undefined;
    let topicId: string | undefined = undefined;

    if (scope === "chapter-wise" && selectedChapter) {
      testType = "chapter";
      title = `${selectedChapter.title}`;
      subtitle = `Chapter ${selectedChapter.number} Test • ${targetCount} Questions`;
      chapterId = selectedChapter.id;
    } else if (scope === "topic" && selectedTopic && selectedChapter) {
      testType = "topic";
      title = `${selectedTopic.title}`;
      subtitle = `${selectedChapter.title} • Topic Test • ${targetCount} Questions`;
      chapterId = selectedChapter.id;
      topicId = selectedTopic.id;
    }

    // Call intelligent test generator behind the scenes
    const generated = generateIntelligentTest({
      type: testType,
      targetCount,
      allQuestions: questions,
      chapters,
      targetChapterId: chapterId,
      targetTopicId: topicId,
      perfStore: effectivePerfStore,
      progressStore,
    });

    onStartSession({
      title,
      subtitle,
      questionIds: generated.selectedQuestionIds,
      source: scope === "all-chapters" ? "all-chapters" : scope === "chapter-wise" ? "chapter" : "topic",
      chapterId,
      topicId,
      shuffleQuestions: true,
      isTestMode: true,
    });

    handleClose();
  };

  // Start with Manually Selected Questions
  const handleStartManualTest = () => {
    const selectedList = Array.from(manuallySelectedIds);
    if (selectedList.length === 0) return;

    let title = "Custom Selected Test";
    let subtitle = `${selectedList.length} Questions Selected`;
    let chapterId: string | undefined = undefined;
    let topicId: string | undefined = undefined;

    if (scope === "chapter-wise" && selectedChapter) {
      title = `${selectedChapter.title} (Custom)`;
      subtitle = `Chapter ${selectedChapter.number} • ${selectedList.length} Questions`;
      chapterId = selectedChapter.id;
    } else if (scope === "topic" && selectedTopic && selectedChapter) {
      title = `${selectedTopic.title} (Custom)`;
      subtitle = `${selectedChapter.title} • ${selectedList.length} Questions`;
      chapterId = selectedChapter.id;
      topicId = selectedTopic.id;
    }

    onStartSession({
      title,
      subtitle,
      questionIds: selectedList,
      source: scope === "all-chapters" ? "all-chapters" : scope === "chapter-wise" ? "chapter" : "topic",
      chapterId,
      topicId,
      shuffleQuestions: false,
      isTestMode: true,
    });

    handleClose();
  };

  // Toggle question selection
  const handleToggleQuestion = (qId: string) => {
    const next = new Set(manuallySelectedIds);
    if (next.has(qId)) next.delete(qId);
    else next.add(qId);
    setManuallySelectedIds(next);
  };

  // Select all visible / active questions
  const handleSelectAllQuestions = () => {
    const next = new Set(manuallySelectedIds);
    filteredActiveQuestions.forEach((q) => next.add(q.id));
    setManuallySelectedIds(next);
  };

  // Deselect all
  const handleDeselectAllQuestions = () => {
    setManuallySelectedIds(new Set());
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-[#171923]/70 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 overflow-y-auto overscroll-y-contain">
      <div className="bg-[#FFF9EF] dark:bg-[#171923] rounded-2xl w-full max-w-2xl max-h-[92vh] flex flex-col shadow-2xl border border-[#E8D9C0] dark:border-[#31374A] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Top Header */}
        <div className="px-5 py-3.5 border-b border-[#E8D9C0] dark:border-[#31374A] flex items-center justify-between bg-white dark:bg-[#1F2330] flex-shrink-0">
          <div className="flex items-center gap-3">
            {scope !== "options" && (
              <button
                onClick={() => {
                  if (subMode === "custom-select") {
                    setSubMode("smart");
                  } else if (selectedTopic) {
                    setSelectedTopic(null);
                  } else if (selectedChapter) {
                    setSelectedChapter(null);
                  } else {
                    setScope("options");
                  }
                }}
                className="p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:text-[#171923] dark:hover:text-[#FFF9EF] hover:bg-[#F7EFE2] dark:hover:bg-[#252A3A] transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            <div className="w-8 h-8 rounded-xl bg-[#800020] flex items-center justify-center text-[#FFF9EF] shadow-sm">
              <Sparkles className="w-4 h-4 text-[#F47B20]" />
            </div>
            <div>
              <h3 className="font-bold text-[#171923] dark:text-[#FFF9EF] text-sm sm:text-base">
                {scope === "options"
                  ? "Create Test"
                  : scope === "all-chapters"
                  ? "All Chapters Test"
                  : scope === "chapter-wise"
                  ? selectedChapter
                    ? selectedChapter.title
                    : "Chapter-wise Test"
                  : selectedTopic
                  ? selectedTopic.title
                  : "Topic-wise Test"}
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                {questions.length} Total MCQs Available
              </p>
            </div>
          </div>

          <button
            onClick={handleClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-[#171923] dark:hover:text-[#FFF9EF] hover:bg-[#F7EFE2] dark:hover:bg-[#252A3A] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto overscroll-y-contain p-3.5 sm:p-6 pb-[calc(env(safe-area-inset-bottom,16px)+36px)] sm:pb-8 space-y-4 overflow-x-hidden">
          {scope === "options" && (
            <div className="space-y-2.5">
              <div className="p-3 bg-white dark:bg-[#1F2330] border border-[#E8D9C0] dark:border-[#31374A] rounded-xl text-[11px] text-[#171923] dark:text-[#FFF9EF] flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5 text-[#800020] dark:text-[#F47B20] flex-shrink-0" />
                <span>
                  All tests support <strong>Smart Balanced Selection</strong>, <strong>Custom Question Selection</strong>, and <strong>All Questions</strong>.
                </span>
              </div>

              <button
                onClick={() => handleSelectScope("all-chapters")}
                className="w-full text-left p-3.5 rounded-xl border border-[#E8D9C0] dark:border-[#31374A] bg-white dark:bg-[#1F2330] hover:border-[#800020]/50 dark:hover:border-[#F47B20]/50 hover:shadow-md transition-all group flex items-center justify-between cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-[#800020]/10 dark:bg-[#F47B20]/15 text-[#800020] dark:text-[#F47B20] flex items-center justify-center font-bold">
                    <BookOpen className="w-4.5 h-4.5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-xs sm:text-sm text-[#171923] dark:text-[#FFF9EF] group-hover:text-[#800020] dark:group-hover:text-[#F47B20] transition-colors">
                      All Chapters Test
                    </h4>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 tabular-nums">
                      Full coverage ({questions.length} total questions)
                    </p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-[#800020] dark:group-hover:text-[#F47B20] transition-colors" />
              </button>

              <button
                onClick={() => handleSelectScope("chapter-wise")}
                className="w-full text-left p-3.5 rounded-xl border border-[#E8D9C0] dark:border-[#31374A] bg-white dark:bg-[#1F2330] hover:border-[#800020]/50 dark:hover:border-[#F47B20]/50 hover:shadow-md transition-all group flex items-center justify-between cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-[#F47B20]/15 text-[#F47B20] flex items-center justify-center font-bold">
                    <Layers className="w-4.5 h-4.5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-xs sm:text-sm text-[#171923] dark:text-[#FFF9EF] group-hover:text-[#800020] dark:group-hover:text-[#F47B20] transition-colors">
                      Chapter-wise Test
                    </h4>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                      Focus on a specific chapter
                    </p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-[#800020] dark:group-hover:text-[#F47B20] transition-colors" />
              </button>

              <button
                onClick={() => handleSelectScope("topic")}
                className="w-full text-left p-3.5 rounded-xl border border-[#E8D9C0] dark:border-[#31374A] bg-white dark:bg-[#1F2330] hover:border-[#800020]/50 dark:hover:border-[#F47B20]/50 hover:shadow-md transition-all group flex items-center justify-between cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 flex items-center justify-center font-bold">
                    <Target className="w-4.5 h-4.5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-xs sm:text-sm text-[#171923] dark:text-[#FFF9EF] group-hover:text-[#800020] dark:group-hover:text-[#F47B20] transition-colors">
                      Topic-wise Test
                    </h4>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                      Micro-targeted practice
                    </p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-[#800020] dark:group-hover:text-[#F47B20] transition-colors" />
              </button>
            </div>
          )}

          {/* ────────────────────────────────────────── */}
          {/* 2. CHAPTER PICKER (FOR CHAPTER-WISE & TOPIC) */}
          {/* ────────────────────────────────────────── */}
          {scope === "chapter-wise" && !selectedChapter && (
            <div className="space-y-3">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={chapterSearchQuery}
                  onChange={(e) => setChapterSearchQuery(e.target.value)}
                  placeholder="Search chapters..."
                  className="w-full pl-9 pr-3 py-2 bg-white dark:bg-[#1F2330] border border-[#E8D9C0] dark:border-[#31374A] rounded-xl text-xs focus:ring-2 focus:ring-[#800020]/30 dark:focus:ring-[#F47B20]/30 focus:outline-none text-[#171923] dark:text-[#FFF9EF]"
                />
              </div>

              <div className="space-y-2">
                {chapters
                  .filter((ch) =>
                    ch.title.toLowerCase().includes(chapterSearchQuery.toLowerCase()) ||
                    ch.hindiTitle.toLowerCase().includes(chapterSearchQuery.toLowerCase())
                  )
                  .map((ch) => {
                    const qCount = (ch.topics || []).flatMap((t) => t.questions || []).length;
                    return (
                      <button
                        key={ch.id}
                        onClick={() => setSelectedChapter(ch)}
                        className="w-full text-left p-3.5 rounded-xl border border-[#E8D9C0] dark:border-[#31374A] bg-white dark:bg-[#1F2330] hover:border-[#800020]/50 dark:hover:border-[#F47B20]/50 hover:shadow-sm transition-all flex items-center justify-between cursor-pointer"
                      >
                        <div>
                          <span className="text-[10px] font-bold text-[#800020] dark:text-[#C99A45] uppercase">
                            Chapter {ch.number}
                          </span>
                          <h4 className="text-xs font-bold text-[#171923] dark:text-[#FFF9EF]">
                            {ch.title}
                          </h4>
                          <span className="text-[10px] text-slate-500 font-hindi">
                            {ch.hindiTitle}
                          </span>
                        </div>
                        <span className="px-2.5 py-1 rounded-lg bg-[#F7EFE2] dark:bg-[#252A3A] text-[#171923] dark:text-slate-300 text-xs font-semibold tabular-nums">
                          {qCount} Questions
                        </span>
                      </button>
                    );
                  })}
              </div>
            </div>
          )}

          {scope === "topic" && !selectedTopic && (
            <div className="space-y-3">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={topicSearchQuery}
                  onChange={(e) => setTopicSearchQuery(e.target.value)}
                  placeholder="Search topics..."
                  className="w-full pl-9 pr-3 py-2 bg-white dark:bg-[#1F2330] border border-[#E8D9C0] dark:border-[#31374A] rounded-xl text-xs focus:ring-2 focus:ring-[#800020]/30 dark:focus:ring-[#F47B20]/30 focus:outline-none text-[#171923] dark:text-[#FFF9EF]"
                />
              </div>

              <div className="space-y-4">
                {chapters.map((ch) => {
                  const filteredTopics = (ch.topics || []).filter(
                    (t) =>
                      t.title.toLowerCase().includes(topicSearchQuery.toLowerCase()) ||
                      t.hindiTitle.toLowerCase().includes(topicSearchQuery.toLowerCase())
                  );
                  if (filteredTopics.length === 0) return null;

                  return (
                    <div key={ch.id} className="space-y-1.5">
                      <div className="text-[10px] font-bold text-[#800020] dark:text-[#C99A45] uppercase px-1">
                        Chapter {ch.number}: {ch.title}
                      </div>
                      <div className="space-y-1.5">
                        {filteredTopics.map((top, topIdx) => (
                          <button
                            key={`${top.id}-${topIdx}`}
                            onClick={() => {
                              setSelectedChapter(ch);
                              setSelectedTopic(top);
                            }}
                            className="w-full text-left p-3 rounded-xl border border-[#E8D9C0] dark:border-[#31374A] bg-white dark:bg-[#1F2330] hover:border-[#800020]/50 dark:hover:border-[#F47B20]/50 transition-all flex items-center justify-between cursor-pointer"
                          >
                            <div>
                              <h5 className="text-xs font-bold text-[#171923] dark:text-[#FFF9EF]">
                                {top.title}
                              </h5>
                              <span className="text-[10px] text-slate-500 font-hindi">
                                {top.hindiTitle}
                              </span>
                            </div>
                            <span className="text-xs font-semibold text-slate-500 tabular-nums">
                              {top.questions.length} Questions
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {(scope === "all-chapters" ||
            (scope === "chapter-wise" && selectedChapter) ||
            (scope === "topic" && selectedTopic)) && (
            <div className="space-y-5">
              {/* Mode Toggle */}
              <div className="flex rounded-xl p-1 bg-[#F7EFE2] dark:bg-[#252A3A] border border-[#E8D9C0] dark:border-[#31374A]">
                <button
                  onClick={() => setSubMode("smart")}
                  className={`flex-1 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    subMode === "smart"
                      ? "bg-white dark:bg-[#1F2330] text-[#800020] dark:text-[#F47B20] shadow-sm"
                      : "text-slate-600 dark:text-slate-400"
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  Smart Balanced Selection
                </button>
                <button
                  onClick={() => {
                    setSubMode("custom-select");
                    if (manuallySelectedIds.size === 0) {
                      const initialSet = new Set(
                        activeQuestionPool.slice(0, 15).map((q) => q.id)
                      );
                      setManuallySelectedIds(initialSet);
                    }
                  }}
                  className={`flex-1 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    subMode === "custom-select"
                      ? "bg-white dark:bg-[#1F2330] text-[#800020] dark:text-[#F47B20] shadow-sm"
                      : "text-slate-600 dark:text-slate-400"
                  }`}
                >
                  <CheckSquare className="w-3.5 h-3.5" />
                  Custom Question Select
                </button>
              </div>

              {subMode === "smart" && (
                <div className="bg-white dark:bg-[#1F2330] rounded-2xl p-5 border border-[#E8D9C0] dark:border-[#31374A] shadow-sm space-y-5">
                  <div>
                    <h4 className="text-xs font-bold text-[#171923] dark:text-[#FFF9EF] uppercase tracking-wider">
                      Select Question Count
                    </h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      Balanced mix of weak areas and revision concepts.
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {[10, 15, 20, 25, 30, 50]
                      .filter((cnt) => cnt <= activeQuestionPool.length)
                      .map((cnt) => (
                        <button
                          key={cnt}
                          onClick={() => {
                            setSelectedQuestionCount(cnt);
                            setIsCustomCount(false);
                          }}
                          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer tabular-nums ${
                            !isCustomCount && selectedQuestionCount === cnt
                              ? "bg-[#800020] dark:bg-[#F47B20] text-white shadow-sm"
                              : "bg-[#F7EFE2] dark:bg-[#252A3A] text-[#171923] dark:text-slate-300 hover:bg-[#E8D9C0]/60"
                          }`}
                        >
                          {cnt} Questions
                        </button>
                      ))}

                    <button
                      onClick={() => {
                        setSelectedQuestionCount("all");
                        setIsCustomCount(false);
                      }}
                      className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer tabular-nums ${
                        !isCustomCount && selectedQuestionCount === "all"
                          ? "bg-[#800020] dark:bg-[#F47B20] text-white shadow-sm"
                          : "bg-[#F7EFE2] dark:bg-[#252A3A] text-[#171923] dark:text-slate-300 hover:bg-[#E8D9C0]/60"
                      }`}
                    >
                      All Questions ({activeQuestionPool.length})
                    </button>

                    <button
                      onClick={() => setIsCustomCount(true)}
                      className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        isCustomCount
                          ? "bg-[#800020] dark:bg-[#F47B20] text-white shadow-sm"
                          : "bg-[#F7EFE2] dark:bg-[#252A3A] text-[#171923] dark:text-slate-300 hover:bg-[#E8D9C0]/60"
                      }`}
                    >
                      Custom Count
                    </button>
                  </div>

                  {isCustomCount && (
                    <div className="p-3 bg-[#FFF9EF] dark:bg-[#252A3A] rounded-xl border border-[#E8D9C0] dark:border-[#31374A] flex items-center gap-3">
                      <span className="text-xs font-semibold text-[#171923] dark:text-slate-300 whitespace-nowrap tabular-nums">
                        Enter count (1 - {activeQuestionPool.length}):
                      </span>
                      <input
                        type="number"
                        min={1}
                        max={activeQuestionPool.length}
                        value={customCountInput}
                        onChange={(e) => setCustomCountInput(e.target.value)}
                        className="w-24 px-3 py-1.5 bg-white dark:bg-[#171923] border border-[#E8D9C0] dark:border-[#31374A] rounded-lg text-xs font-bold text-center text-[#171923] dark:text-[#FFF9EF] tabular-nums"
                      />
                    </div>
                  )}

                  <button
                    onClick={handleStartSmartTest}
                    className="w-full py-3 bg-[#800020] hover:bg-[#5E0017] dark:bg-[#F47B20] dark:hover:bg-[#E06A12] text-white font-bold text-xs sm:text-sm rounded-xl shadow-lg shadow-[#800020]/20 dark:shadow-[#F47B20]/20 flex items-center justify-center gap-2 transition-all active:scale-98 cursor-pointer"
                  >
                    <Play className="w-4 h-4 fill-white" />
                    Start Smart Test ({getActiveQuestionCount(activeQuestionPool.length)} Questions)
                  </button>
                </div>
              )}

              {subMode === "custom-select" && (
                <div className="space-y-4">
                  <div className="bg-white dark:bg-[#1F2330] rounded-2xl p-4 border border-[#E8D9C0] dark:border-[#31374A] shadow-sm space-y-3">
                    <div className="flex flex-col sm:flex-row gap-2">
                      <div className="relative flex-1">
                        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                          type="text"
                          value={questionSearchQuery}
                          onChange={(e) => setQuestionSearchQuery(e.target.value)}
                          placeholder="Search questions or concepts..."
                          className="w-full pl-9 pr-3 py-2 bg-[#FFF9EF] dark:bg-[#252A3A] border border-[#E8D9C0] dark:border-[#31374A] rounded-xl text-xs text-[#171923] dark:text-[#FFF9EF]"
                        />
                      </div>

                      <select
                        value={questionFilterTag}
                        onChange={(e) => setQuestionFilterTag(e.target.value)}
                        className="bg-[#FFF9EF] dark:bg-[#252A3A] border border-[#E8D9C0] dark:border-[#31374A] rounded-xl text-xs px-3 py-2 text-[#171923] dark:text-slate-300"
                      >
                        <option value="all">All Tags</option>
                        <option value="weak-area">Weak Areas</option>
                        <option value="due-today">Revision Due</option>
                      </select>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-[#E8D9C0] dark:border-[#31374A] text-xs">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={handleSelectAllQuestions}
                          className="px-2.5 py-1 rounded-lg bg-[#800020]/10 dark:bg-[#F47B20]/15 text-[#800020] dark:text-[#F47B20] font-bold hover:opacity-80 cursor-pointer"
                        >
                          Select All ({filteredActiveQuestions.length})
                        </button>
                        <button
                          onClick={handleDeselectAllQuestions}
                          className="px-2.5 py-1 rounded-lg bg-[#F7EFE2] dark:bg-[#252A3A] text-slate-600 dark:text-slate-400 cursor-pointer"
                        >
                          Clear
                        </button>
                      </div>

                      <span className="font-bold text-[#800020] dark:text-[#F47B20] tabular-nums">
                        {manuallySelectedIds.size} Selected
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2.5 max-h-[420px] overflow-y-auto pr-1">
                    {filteredActiveQuestions.map((q, idx) => {
                      const isSelected = manuallySelectedIds.has(q.id);
                      const perf = effectivePerfStore[q.id];
                      const isWeak = perf && perf.lastResult === "wrong";

                      return (
                        <div
                          key={`${q.id}-${idx}`}
                          onClick={() => handleToggleQuestion(q.id)}
                          className={`p-3.5 rounded-xl border transition-all cursor-pointer shadow-xs space-y-2 ${
                            isSelected
                              ? "bg-[#800020]/5 dark:bg-[#F47B20]/10 border-[#800020] dark:border-[#F47B20]"
                              : "bg-white dark:bg-[#1F2330] border-[#E8D9C0] dark:border-[#31374A] hover:border-[#C99A45]"
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <button
                              type="button"
                              className="mt-0.5 text-[#800020] dark:text-[#F47B20] flex-shrink-0"
                            >
                              {isSelected ? (
                                <CheckSquare className="w-4 h-4 fill-[#800020] dark:fill-[#F47B20] text-white" />
                              ) : (
                                <Square className="w-4 h-4 text-slate-400" />
                              )}
                            </button>

                            <div className="flex-1 space-y-1">
                              <p className="text-xs font-medium text-[#171923] dark:text-[#FFF9EF] font-hindi leading-relaxed">
                                {q.text}
                              </p>

                              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                                {q.conceptName && (
                                  <span className="px-1.5 py-0.5 rounded bg-[#F7EFE2] dark:bg-[#252A3A] text-[#800020] dark:text-[#C99A45] text-[10px] font-semibold">
                                    {q.conceptName}
                                  </span>
                                )}
                                {isWeak && (
                                  <span className="px-1.5 py-0.5 rounded bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 text-[10px] font-bold">
                                    Weak Area
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <button
                    onClick={handleStartManualTest}
                    disabled={manuallySelectedIds.size === 0}
                    className="w-full py-3 bg-[#800020] hover:bg-[#5E0017] dark:bg-[#F47B20] dark:hover:bg-[#E06A12] text-white font-bold text-xs sm:text-sm rounded-xl shadow-lg flex items-center justify-center gap-2 transition-all active:scale-98 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  >
                    <Play className="w-4 h-4 fill-white" />
                    Start Test with Selected ({manuallySelectedIds.size} Questions)
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CreateTestModal;
