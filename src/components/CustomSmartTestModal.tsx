import React, { useState, useMemo } from "react";
import {
  X,
  Sparkles,
  Zap,
  Sliders,
  BookOpen,
  Folder,
  Layers,
  HelpCircle,
  BarChart2,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
  Flame,
  ChevronRight,
  RotateCcw,
} from "lucide-react";
import { Chapter, Question, MCQSession, PerformanceStore, Subject } from "../types";
import { selectSmartTestQuestions } from "../utils/smartPriority";
import {
  getSubjectDisplayName,
  getChapterDisplayName,
  getTopicDisplayName,
} from "../utils/curriculumUtils";

interface CustomSmartTestModalProps {
  chapters: Chapter[];
  allQuestions: Question[];
  perfStore: PerformanceStore;
  subjects?: Subject[];
  onClose: () => void;
  onStartTest: (session: MCQSession) => void;
}

export const CustomSmartTestModal: React.FC<CustomSmartTestModalProps> = ({
  chapters,
  allQuestions,
  perfStore,
  subjects = [],
  onClose,
  onStartTest,
}) => {
  // Config state
  const [selectedSubject, setSelectedSubject] = useState<string>("all");
  const [selectedChapterId, setSelectedChapterId] = useState<string>("all");
  const [selectedTopicId, setSelectedTopicId] = useState<string>("all");
  const [questionCountType, setQuestionCountType] = useState<number | "custom">(20);
  const [customCount, setCustomCount] = useState<number>(25);
  const [difficulty, setDifficulty] = useState<"easy" | "medium" | "hard" | "mixed">("mixed");
  const [questionSource, setQuestionSource] = useState<"new" | "attempted" | "both">("both");
  const [smartPriorityEnabled, setSmartPriorityEnabled] = useState<boolean>(true);

  // Available topics for selected chapter
  const currentChapter = useMemo(() => {
    if (selectedChapterId === "all") return null;
    return chapters.find((c) => c.id === selectedChapterId) || null;
  }, [chapters, selectedChapterId]);

  const availableTopics = useMemo(() => {
    if (!currentChapter) return [];
    return currentChapter.topics;
  }, [currentChapter]);

  // Compute selection outcome dynamically
  const testSelectionResult = useMemo(() => {
    return selectSmartTestQuestions(allQuestions, perfStore, {
      subjectId: selectedSubject,
      chapterId: selectedChapterId,
      topicId: selectedTopicId,
      questionCount: questionCountType,
      customCount,
      difficulty,
      questionSource,
      smartPriorityEnabled,
    });
  }, [
    allQuestions,
    perfStore,
    selectedSubject,
    selectedChapterId,
    selectedTopicId,
    questionCountType,
    customCount,
    difficulty,
    questionSource,
    smartPriorityEnabled,
  ]);

  const { selectedQuestions, totalAvailable, isPoolLimited, categoryCounts } = testSelectionResult;
  const requestedCount = questionCountType === "custom" ? customCount : Number(questionCountType);

  // Count high priority questions available for learning insight badge
  const priorityQuestionsCount = categoryCounts.high + categoryCounts.medium;

  const handleCreateTest = (overrideCount?: number) => {
    let finalQuestions = selectedQuestions;
    if (overrideCount && overrideCount < selectedQuestions.length) {
      finalQuestions = selectedQuestions.slice(0, overrideCount);
    }

    if (finalQuestions.length === 0) return;

    // Determine descriptive subtitle
    let sub = "Custom Test";
    if (selectedSubject !== "all") {
      const subj = subjects.find((s) => s.id === selectedSubject);
      if (subj) sub = subj.name || subj.hindiName || "Subject Test";
    }
    if (selectedChapterId !== "all" && currentChapter) {
      sub = `Ch ${currentChapter.number}: ${currentChapter.title}`;
      if (selectedTopicId !== "all") {
        const topic = (currentChapter.topics || []).find((t) => t.id === selectedTopicId);
        if (topic) sub += ` • ${topic.title}`;
      }
    } else if (selectedSubject === "all") {
      sub = "All Chapters Comprehensive";
    }

    const testId = `smart-test-${Date.now()}`;

    const session: MCQSession = {
      title: "⭐ Custom Smart Test",
      subtitle: sub,
      questionIds: finalQuestions.map((q) => q.id),
      source: "custom-smart",
      chapterId: selectedChapterId !== "all" ? selectedChapterId : undefined,
      topicId: selectedTopicId !== "all" ? selectedTopicId : undefined,
      isTestMode: true,
      isSmartTest: true,
      smartPriorityEnabled,
      testId,
      shuffleQuestions: true,
    };

    onStartTest(session);
  };

  return (
    <div
      id="custom-smart-test-modal"
      className="fixed inset-0 z-50 bg-[#130E26]/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-200"
    >
      <div 
        role="dialog"
        aria-modal="true"
        aria-label="Custom Smart Test"
        className="bg-[#F8FAFC] dark:bg-[#130E26] border border-slate-200 dark:border-[#31275E] rounded-3xl max-w-xl w-full my-auto shadow-2xl overflow-hidden flex flex-col max-h-[92dvh]"
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-[#31275E] flex items-start justify-between bg-white dark:bg-[#1B1536] shrink-0">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#7045D8] text-white flex items-center justify-center shadow-md shadow-[#7045D8]/20 shrink-0 mt-0.5">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-slate-50 flex items-center gap-1.5">
                  <span>Custom Smart Test</span>
                  <span className="text-[11px] font-mono font-bold bg-[#7045D8]/15 text-[#7045D8] dark:text-[#A78BFA] px-2 py-0.5 rounded-md border border-[#7045D8]/30">
                    SMART PRIORITY
                  </span>
                </h2>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5 leading-snug">
                Create a personalized test tuned to your question accuracy.
              </p>
            </div>
          </div>
          <button
            id="btn-close-smart-test-modal"
            type="button"
            onClick={onClose}
            aria-label="Close smart test modal"
            className="w-11 h-11 rounded-xl bg-slate-100 dark:bg-[#241D48] border border-slate-200 dark:border-[#31275E] text-slate-500 hover:text-slate-900 dark:hover:text-white flex items-center justify-center transition-colors cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Configuration Form */}
        <div className="p-4 sm:p-5 space-y-4 sm:space-y-5 overflow-y-auto flex-1">
          {/* 1. Subject Selector */}
          <div className="space-y-1.5" id="section-subject">
            <label className="text-xs font-bold text-slate-900 dark:text-slate-50 flex items-center gap-1.5">
              <BookOpen className="w-3.5 h-3.5 text-[#7045D8] dark:text-[#A78BFA]" />
              <span>Subject</span>
            </label>
            <div className="relative">
              <select
                id="select-smart-test-subject"
                value={selectedSubject}
                onChange={(e) => setSelectedSubject(e.target.value)}
                className="w-full bg-white dark:bg-[#1B1536] border border-slate-200 dark:border-[#31275E] rounded-2xl p-3 text-xs sm:text-sm font-semibold text-slate-900 dark:text-slate-50 focus:ring-2 focus:ring-[#7045D8]/30 dark:focus:ring-[#A78BFA]/30 focus:outline-none transition-all cursor-pointer"
              >
                <option value="all">★ All Subjects Combined</option>
                {subjects.map((sub) => (
                  <option key={sub.id} value={sub.id}>
                    {getSubjectDisplayName(sub)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* 2. Chapter Selector */}
          <div className="space-y-1.5" id="section-chapter">
            <label className="text-xs font-bold text-slate-900 dark:text-slate-50 flex items-center gap-1.5">
              <Folder className="w-3.5 h-3.5 text-[#7045D8] dark:text-[#A78BFA]" />
              <span>Chapter</span>
            </label>
            <select
              id="select-smart-test-chapter"
              value={selectedChapterId}
              onChange={(e) => {
                setSelectedChapterId(e.target.value);
                setSelectedTopicId("all");
              }}
              className="w-full bg-white dark:bg-[#1B1536] border border-slate-200 dark:border-[#31275E] rounded-2xl p-3 text-xs sm:text-sm font-medium text-slate-900 dark:text-slate-50 focus:ring-2 focus:ring-[#7045D8]/30 dark:focus:ring-[#A78BFA]/30 focus:outline-none transition-all cursor-pointer"
            >
              <option value="all">All Chapters ({chapters.length} Chapters Combined)</option>
              {chapters.map((ch) => (
                <option key={ch.id} value={ch.id}>
                  Chapter {ch.number}: {getChapterDisplayName(ch)}
                </option>
              ))}
            </select>
          </div>

          {/* 3. Topic Selector (conditionally enabled or populated) */}
          {selectedChapterId !== "all" && (
            <div className="space-y-1.5 animate-in fade-in duration-150" id="section-topic">
              <label className="text-xs font-bold text-slate-900 dark:text-slate-50 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-[#7045D8]" />
                <span>Topic</span>
              </label>
              <select
                id="select-smart-test-topic"
                value={selectedTopicId}
                onChange={(e) => setSelectedTopicId(e.target.value)}
                className="w-full bg-white dark:bg-[#1B1536] border border-slate-200 dark:border-[#31275E] rounded-2xl p-3 text-xs sm:text-sm font-medium text-slate-900 dark:text-slate-50 focus:ring-2 focus:ring-[#7045D8]/30 dark:focus:ring-[#A78BFA]/30 focus:outline-none transition-all cursor-pointer"
              >
                <option value="all">All Topics in this Chapter ({availableTopics.length} Topics)</option>
                {availableTopics.map((tp, tpIdx) => (
                  <option key={`${tp.id}-${tpIdx}`} value={tp.id}>
                    {getTopicDisplayName(tp)} ({tp.questions.length} MCQs)
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* 4. Number of Questions */}
          <div className="space-y-2" id="section-question-count">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-900 dark:text-slate-50 flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-[#7045D8] dark:text-[#A78BFA]" />
                <span>Number of Questions</span>
              </label>
              <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400 font-bold tabular-nums">
                Pool Available: {totalAvailable}
              </span>
            </div>

            <div className="grid grid-cols-5 gap-1.5 sm:gap-2">
              {[10, 20, 30, 50].map((count) => (
                <button
                  key={count}
                  type="button"
                  id={`btn-count-${count}`}
                  onClick={() => setQuestionCountType(count)}
                  className={`py-2 sm:py-2.5 rounded-xl font-bold font-mono text-xs sm:text-sm transition-all cursor-pointer tabular-nums ${
                    questionCountType === count
                      ? "bg-[#7045D8] dark:bg-[#7045D8] text-white shadow-sm"
                      : "bg-white dark:bg-[#1B1536] border border-slate-200 dark:border-[#31275E] text-slate-900 dark:text-slate-300 hover:border-[#7045D8]/40"
                  }`}
                >
                  {count}
                </button>
              ))}

              <button
                type="button"
                id="btn-count-custom"
                onClick={() => setQuestionCountType("custom")}
                className={`py-2 sm:py-2.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
                  questionCountType === "custom"
                    ? "bg-[#7045D8] dark:bg-[#7045D8] text-white shadow-sm"
                    : "bg-white dark:bg-[#1B1536] border border-slate-200 dark:border-[#31275E] text-slate-900 dark:text-slate-300 hover:border-[#7045D8]/40"
                }`}
              >
                Custom
              </button>
            </div>

            {/* Inline Custom Input */}
            {questionCountType === "custom" && (
              <div className="flex items-center gap-3 p-3 rounded-2xl bg-slate-100 dark:bg-[#241D48] border border-slate-200 dark:border-[#31275E] mt-2">
                <span className="text-xs font-semibold text-[#7045D8] dark:text-[#A78BFA]">
                  Custom Question Count:
                </span>
                <input
                  id="input-custom-question-count"
                  type="number"
                  min={5}
                  max={Math.min(100, Math.max(5, totalAvailable))}
                  value={customCount}
                  onChange={(e) => setCustomCount(Math.max(5, parseInt(e.target.value) || 5))}
                  className="w-20 bg-white dark:bg-[#130E26] border border-slate-200 dark:border-[#31275E] rounded-xl px-2.5 py-1 text-xs font-mono font-bold text-center text-slate-900 dark:text-slate-50 focus:ring-2 focus:ring-[#7045D8]/30 focus:outline-none tabular-nums"
                />
                <span className="text-[11px] text-slate-600 dark:text-slate-400 tabular-nums">(5 - {totalAvailable} MCQs)</span>
              </div>
            )}
          </div>

          {/* 5. Difficulty Selection */}
          <div className="space-y-2" id="section-difficulty">
            <label className="text-xs font-bold text-slate-900 dark:text-slate-50 flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-[#7045D8]" />
              <span>Difficulty</span>
            </label>
            <div className="grid grid-cols-4 gap-1.5">
              {[
                { id: "mixed", label: "Mixed" },
                { id: "easy", label: "Easy" },
                { id: "medium", label: "Medium" },
                { id: "hard", label: "Hard" },
              ].map((diff) => (
                <button
                  key={diff.id}
                  type="button"
                  id={`btn-diff-${diff.id}`}
                  onClick={() => setDifficulty(diff.id as any)}
                  className={`py-2 px-1 rounded-xl text-xs font-bold transition-all cursor-pointer capitalize ${
                    difficulty === diff.id
                      ? "bg-[#130E26] dark:bg-[#F8FAFC] text-white dark:text-slate-900 shadow-xs"
                      : "bg-white dark:bg-[#1B1536] border border-slate-200 dark:border-[#31275E] text-slate-600 dark:text-slate-300"
                  }`}
                >
                  {diff.label}
                </button>
              ))}
            </div>
          </div>

          {/* 6. Question Source */}
          <div className="space-y-2" id="section-question-source">
            <label className="text-xs font-bold text-slate-900 dark:text-slate-50 flex items-center gap-1.5">
              <BarChart2 className="w-3.5 h-3.5 text-[#15803D] dark:text-emerald-400" />
              <span>Question Source</span>
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: "both", label: "Both (Smart Mix)", desc: "New + Attempted" },
                { id: "attempted", label: "Attempted", desc: "For Revision" },
                { id: "new", label: "New Questions", desc: "Never Seen" },
              ].map((src) => (
                <button
                  key={src.id}
                  type="button"
                  id={`btn-source-${src.id}`}
                  onClick={() => setQuestionSource(src.id as any)}
                  className={`p-2.5 rounded-2xl border text-left transition-all cursor-pointer ${
                    questionSource === src.id
                      ? "bg-[#7045D8]/10 dark:bg-[#7045D8]/15 border-[#7045D8] dark:border-[#A78BFA] text-[#7045D8] dark:text-slate-50 shadow-xs"
                      : "bg-white dark:bg-[#1B1536] border-slate-200 dark:border-[#31275E] text-slate-900 dark:text-slate-300 hover:border-[#A78BFA]"
                  }`}
                >
                  <div className="text-xs font-bold leading-tight">{src.label}</div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    {src.desc}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* 7. Smart Priority Card & Switch */}
          <div
            id="card-smart-priority"
            className="p-4 rounded-3xl bg-white dark:bg-[#1B1536] border border-[#A78BFA]/50 dark:border-[#A78BFA]/40 space-y-3"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-start gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-[#7045D8]/15 text-[#7045D8] flex items-center justify-center shrink-0 mt-0.5">
                  <Flame className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-900 dark:text-slate-50">
                      Smart Priority Engine
                    </span>
                    <span
                      id="badge-smart-priority-status"
                      className={`text-[11px] font-mono font-bold px-2 py-0.5 rounded-md ${
                        smartPriorityEnabled
                          ? "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
                          : "bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                      }`}
                    >
                      {smartPriorityEnabled ? "ENABLED" : "OFF"}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-0.5 leading-snug">
                    Prioritizes weak or slow questions automatically.
                  </p>
                </div>
              </div>

              {/* Toggle Switch */}
              <button
                type="button"
                id="toggle-smart-priority"
                role="switch"
                aria-checked={smartPriorityEnabled}
                onClick={() => setSmartPriorityEnabled(!smartPriorityEnabled)}
                className={`w-12 h-7 rounded-full transition-colors relative p-1 shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7045D8] focus-visible:ring-offset-2 cursor-pointer ${
                  smartPriorityEnabled ? "bg-[#7045D8]" : "bg-slate-300 dark:bg-slate-700"
                }`}
                title={smartPriorityEnabled ? "Disable Smart Priority" : "Enable Smart Priority"}
              >
                <div
                  className={`w-5 h-5 rounded-full bg-white shadow-xs transition-transform ${
                    smartPriorityEnabled ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>

            {/* Real-time Priority Breakdown Bar */}
            {smartPriorityEnabled && totalAvailable > 0 && (
              <div className="pt-2 border-t border-slate-200 dark:border-[#31275E] flex items-center justify-between text-[11px]">
                <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                  <span className="flex items-center gap-1 font-semibold">
                    <span className="w-2 h-2 rounded-full bg-[#7045D8] dark:bg-[#7045D8] inline-block" />
                    High/Med Priority:{" "}
                    <strong className="text-slate-900 dark:text-slate-50 font-mono tabular-nums">
                      {priorityQuestionsCount}
                    </strong>
                  </span>
                  <span className="text-slate-400">·</span>
                  <span className="flex items-center gap-1 font-semibold">
                    <span className="w-2 h-2 rounded-full bg-[#A78BFA] inline-block" />
                    New:{" "}
                    <strong className="text-slate-900 dark:text-slate-50 font-mono tabular-nums">
                      {categoryCounts.new}
                    </strong>
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* 8. Small Question Pool Warning Banner */}
          {isPoolLimited && (
            <div
              id="banner-pool-limited-warning"
              className="p-3.5 rounded-2xl bg-[#7045D8]/10 border border-[#7045D8]/30 flex items-start gap-2.5 animate-in fade-in"
            >
              <AlertCircle className="w-4 h-4 text-[#7045D8] shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <h4 className="text-xs font-bold text-slate-900 dark:text-slate-50">
                  Limited Question Pool
                </h4>
                <p className="text-[11px] text-slate-700 dark:text-slate-300 mt-0.5">
                  Only <strong>{totalAvailable} questions</strong> match your filters (requested {requestedCount}).
                </p>
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <button
                    type="button"
                    id="btn-create-limited-pool-test"
                    onClick={() => handleCreateTest(totalAvailable)}
                    className="px-3 py-1.5 rounded-xl bg-[#7045D8] hover:bg-[#5B32BF] text-white font-bold text-[11px] cursor-pointer transition-colors"
                  >
                    CREATE {totalAvailable}-QUESTION TEST
                  </button>
                  <button
                    type="button"
                    id="btn-change-filters"
                    onClick={() => {
                      setSelectedChapterId("all");
                      setSelectedTopicId("all");
                      setQuestionSource("both");
                      setDifficulty("mixed");
                    }}
                    className="px-3 py-1.5 rounded-xl bg-white dark:bg-[#130E26] border border-slate-200 dark:border-[#31275E] text-slate-900 dark:text-slate-50 text-[11px] font-semibold cursor-pointer transition-colors"
                  >
                    CHANGE FILTERS (Expand Pool)
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 sm:p-5 border-t border-slate-200 dark:border-[#31275E] bg-white dark:bg-[#1B1536] shrink-0 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-3 rounded-2xl border border-slate-200 dark:border-[#31275E] text-slate-900 dark:text-slate-300 text-xs font-bold hover:bg-slate-100 dark:hover:bg-[#241D48] transition-colors cursor-pointer"
          >
            Cancel
          </button>

          <button
            type="button"
            id="btn-create-smart-test"
            disabled={selectedQuestions.length === 0}
            onClick={() => handleCreateTest()}
            className="flex-1 py-3.5 px-4 bg-[#7045D8] hover:bg-[#5B32BF] dark:bg-[#7045D8] dark:hover:bg-[#5B32BF] active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-2xl font-bold text-xs sm:text-sm shadow-lg shadow-[#7045D8]/20 dark:shadow-[#7045D8]/20 flex items-center justify-center gap-2 transition-all cursor-pointer"
          >
            <Sparkles className="w-4 h-4 text-amber-500 dark:text-white" />
            <span>
              CREATE {Math.min(requestedCount, selectedQuestions.length)}-QUESTION SMART TEST
            </span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
