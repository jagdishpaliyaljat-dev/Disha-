import React from "react";
import { Chapter, ProgressStore, MCQSession } from "../types";
import { CHAPTERS_MAP, ALL_QUESTIONS } from "../data/questions";
import { isDueToday, getTodayDateString, sortQuestionsForRevision } from "../utils/revision";
import {
  ArrowLeft,
  Calendar,
  XCircle,
  Clock,
  Bookmark,
  ChevronRight,
  Play,
  CheckCircle2,
} from "lucide-react";

interface ChapterWrongDetailViewProps {
  chapterId: string;
  progressStore: ProgressStore;
  chaptersMap?: Record<string, Chapter>;
  onBack: () => void;
  onStartSession: (session: MCQSession) => void;
  onOpenPDFExport?: (config?: {
    chapterId?: string | null;
    filterType?: "all" | "wrong" | "bookmarked";
  }) => void;
}

// Chapter curriculum targets - dynamic calculations are now used

export const ChapterWrongDetailView: React.FC<ChapterWrongDetailViewProps> = ({
  chapterId,
  progressStore,
  chaptersMap,
  onBack,
  onStartSession,
  onOpenPDFExport,
}) => {
  const chapter = chaptersMap?.[chapterId] || CHAPTERS_MAP[chapterId];
  const todayStr = getTodayDateString();

  if (!chapter) {
    return (
      <div className="p-6 text-center">
        <p className="text-sm text-slate-500">Chapter not found</p>
        <button onClick={onBack} className="mt-3 text-xs text-blue-600 font-bold">
          Go Back
        </button>
      </div>
    );
  }

  const allChapterQuestions = chapter.topics.flatMap((t) => t.questions);

  // Real filtered questions
  const realWrongQuestions = allChapterQuestions.filter(
    (q) => progressStore[q.id]?.status === "wrong"
  );
  const realDueQuestions = allChapterQuestions.filter((q) =>
    isDueToday(progressStore[q.id], todayStr)
  );
  const realBookmarkedQuestions = allChapterQuestions.filter(
    (q) => progressStore[q.id]?.bookmarked
  );

  const fallback = {
    wrongCount: realWrongQuestions.length,
    dueCount: realDueQuestions.length,
    bookmarkedCount: realBookmarkedQuestions.length,
  };

  // If real questions exist in this status, prioritize them; else use chapter questions
  const getSessionQuestionIds = (type: "wrong" | "due" | "bookmark") => {
    if (type === "wrong") {
      if (realWrongQuestions.length > 0) return realWrongQuestions.map((q) => q.id);
      return allChapterQuestions.map((q) => q.id).slice(0, fallback.wrongCount);
    }
    if (type === "due") {
      if (realDueQuestions.length > 0) return realDueQuestions.map((q) => q.id);
      return allChapterQuestions.map((q) => q.id).slice(0, fallback.dueCount);
    }
    if (type === "bookmark") {
      if (realBookmarkedQuestions.length > 0)
        return realBookmarkedQuestions.map((q) => q.id);
      return allChapterQuestions.map((q) => q.id).slice(0, fallback.bookmarkedCount);
    }
    return allChapterQuestions.map((q) => q.id);
  };

  const handleStartPractice = (type: "wrong" | "due" | "bookmark" = "wrong") => {
    const ids = getSessionQuestionIds(type);
    const sorted = sortQuestionsForRevision(ids, progressStore, todayStr);

    const titleMap = {
      wrong: `${chapter.title} • Wrong Questions`,
      due: `${chapter.title} • Revision Due`,
      bookmark: `${chapter.title} • Bookmarked`,
    };

    onStartSession({
      title: titleMap[type],
      subtitle: `${sorted.length} questions`,
      questionIds: sorted,
      source: "wrong-chapter",
      chapterId: chapter.id,
    });
  };

  return (
    <div className="px-4 pt-3 space-y-3.5 pb-8" id="chapter-wrong-detail-screen">
      {/* Header */}
      <div className="flex items-center justify-between pt-1">
        <button
          id="btn-wrong-detail-back"
          onClick={onBack}
          className="w-9 h-9 rounded-full bg-white dark:bg-[#111A2E] border border-slate-200/80 dark:border-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center hover:bg-slate-50 transition-colors shadow-xs"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>

        <div className="text-center flex-1 px-3 min-w-0">
          <h1 className="text-base font-bold text-slate-900 dark:text-white truncate">
            {chapter.title}
          </h1>
          <p className="text-[11px] text-slate-400 font-medium">
            Wrong Questions
          </p>
        </div>

        <div className="w-9 h-9" />
      </div>

      {/* 3 Stat Cards in a row */}
      <div className="grid grid-cols-3 gap-2">
        {/* Wrong Q Card */}
        <div
          onClick={() => handleStartPractice("wrong")}
          className="bg-rose-50/80 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 rounded-2xl p-3 text-center shadow-xs cursor-pointer hover:border-rose-300 transition-all"
        >
          <div className="flex items-center justify-center gap-1 text-rose-600 dark:text-rose-400 mb-0.5">
            <XCircle className="w-3.5 h-3.5" />
            <span className="text-base font-black font-mono">
              {fallback.wrongCount}
            </span>
          </div>
          <span className="text-[11px] text-rose-700 dark:text-rose-300 font-medium block">
            Wrong Q
          </span>
        </div>

        {/* Due for Revision Card */}
        <div
          onClick={() => handleStartPractice("due")}
          className="bg-amber-50/80 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 rounded-2xl p-3 text-center shadow-xs cursor-pointer hover:border-amber-300 transition-all"
        >
          <div className="flex items-center justify-center gap-1 text-amber-600 dark:text-amber-400 mb-0.5">
            <Clock className="w-3.5 h-3.5" />
            <span className="text-base font-black font-mono">
              {fallback.dueCount}
            </span>
          </div>
          <span className="text-[10px] text-amber-700 dark:text-amber-300 font-medium block leading-tight">
            Due for Revision
          </span>
        </div>

        {/* Bookmarked Card */}
        <div
          onClick={() => handleStartPractice("bookmark")}
          className="bg-blue-50/80 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/60 rounded-2xl p-3 text-center shadow-xs cursor-pointer hover:border-blue-300 transition-all"
        >
          <div className="flex items-center justify-center gap-1 text-blue-600 dark:text-blue-400 mb-0.5">
            <Bookmark className="w-3.5 h-3.5 fill-current" />
            <span className="text-base font-black font-mono">
              {fallback.bookmarkedCount}
            </span>
          </div>
          <span className="text-[11px] text-blue-700 dark:text-blue-300 font-medium block">
            Bookmarked
          </span>
        </div>
      </div>

      {/* Revision Schedule (Auto) Banner */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-3xl p-4 shadow-sm">
        <div className="flex items-center gap-2 mb-1.5">
          <Calendar className="w-4 h-4 text-blue-200" />
          <span className="text-xs font-bold uppercase tracking-wider">
            Revision Schedule (Auto)
          </span>
        </div>
        <p className="text-xs font-semibold text-blue-100 font-mono tracking-tight">
          Day 3 → Day 7 → Day 21 → Day 45 → Day 75
        </p>
        <p className="text-[10px] text-blue-200/80 mt-1">
          We'll remind you automatically
        </p>
      </div>

      {/* Action Rows */}
      <div className="space-y-2.5 pt-1">
        {/* Wrong Questions Row */}
        <div
          id="row-wrong-questions"
          onClick={() => handleStartPractice("wrong")}
          className="bg-white dark:bg-[#111A2E] border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 shadow-xs hover:border-slate-300 dark:hover:border-slate-700 cursor-pointer transition-all flex items-center justify-between"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
              <XCircle className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                Wrong Questions
              </h4>
              <p className="text-[11px] text-slate-400 font-mono">
                {fallback.wrongCount} Questions
              </p>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-300 dark:text-slate-600" />
        </div>

        {/* Revision Due Row */}
        <div
          id="row-revision-due"
          onClick={() => handleStartPractice("due")}
          className="bg-white dark:bg-[#111A2E] border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 shadow-xs hover:border-slate-300 dark:hover:border-slate-700 cursor-pointer transition-all flex items-center justify-between"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-500 flex items-center justify-center shrink-0">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                Revision Due
              </h4>
              <p className="text-[11px] text-slate-400 font-mono">
                {fallback.dueCount} Questions
              </p>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-300 dark:text-slate-600" />
        </div>

        {/* Bookmarked Row */}
        <div
          id="row-bookmarked"
          onClick={() => handleStartPractice("bookmark")}
          className="bg-white dark:bg-[#111A2E] border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 shadow-xs hover:border-slate-300 dark:hover:border-slate-700 cursor-pointer transition-all flex items-center justify-between"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
              <Bookmark className="w-4 h-4 fill-current" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                Bookmarked
              </h4>
              <p className="text-[11px] text-slate-400 font-mono">
                {fallback.bookmarkedCount} Questions
              </p>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-300 dark:text-slate-600" />
        </div>
      </div>

      {/* Start Practice Bottom Primary Button (Green/Emerald button as in Screen 7) */}
      <div className="pt-2">
        <button
          id="btn-start-chapter-wrong-practice"
          onClick={() => handleStartPractice("wrong")}
          className="w-full py-3.5 px-5 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white rounded-2xl font-bold text-xs shadow-md shadow-emerald-600/20 flex items-center justify-center gap-2 transition-all"
        >
          <Play className="w-4 h-4 fill-white" />
          <span>Start Practice</span>
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
