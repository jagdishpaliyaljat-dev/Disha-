import React, { useMemo, useState } from "react";
import {
  Brain,
  AlertTriangle,
  Zap,
  TrendingDown,
  ChevronRight,
  Sparkles,
  Flame,
  CheckCircle2,
  Crosshair,
  BarChart2,
  RotateCcw,
} from "lucide-react";
import { Question, Chapter, Subject, ProgressStore, MCQSession, ActiveTab } from "../types";
import { triggerHaptic, playClickSound } from "../utils/audioFeedback";

interface AIWeaknessHeatmapProps {
  questions: Question[];
  chapters: Chapter[];
  subjects: Subject[];
  progressStore: ProgressStore;
  onStartSession?: (session: MCQSession) => void;
  onNavigateTab?: (tab: ActiveTab) => void;
}

interface TopicDiagnosticItem {
  id: string;
  name: string;
  chapterName: string;
  subjectName: string;
  totalQuestions: number;
  attempted: number;
  correct: number;
  wrong: number;
  accuracy: number;
  level: "critical" | "warning" | "moderate" | "mastered" | "unattempted";
  weakQuestions: Question[];
  allQuestions: Question[];
}

export const AIWeaknessHeatmap: React.FC<AIWeaknessHeatmapProps> = ({
  questions,
  chapters,
  subjects,
  progressStore,
  onStartSession,
  onNavigateTab,
}) => {
  const [filterMode, setFilterMode] = useState<"all" | "critical" | "warning" | "mastered">("all");

  // Compute diagnostics per chapter and topic
  const diagnostics = useMemo(() => {
    const chapterMap = new Map<string, Chapter>(chapters.map((c) => [c.id, c]));
    const subjectMap = new Map<string, Subject>(subjects.map((s) => [s.id, s]));

    // Group questions by chapterId or topicId
    const topicBucket = new Map<string, { name: string; chapterName: string; subjectName: string; questions: Question[] }>();

    chapters.forEach((ch) => {
      const sub = subjectMap.get(ch.subjectId || "");
      const sName = sub ? sub.name || (sub as any).hindiName || "" : "";
      const chName = ch.title || (ch as any).hindiTitle || "";

      // Add chapter level bucket
      if (!topicBucket.has(ch.id)) {
        topicBucket.set(ch.id, {
          name: chName,
          chapterName: chName,
          subjectName: sName,
          questions: [],
        });
      }

      // Add sub-topics
      (ch.topics || []).forEach((t) => {
        if (t && t.id) {
          topicBucket.set(t.id, {
            name: t.title || (t as any).name || chName,
            chapterName: chName,
            subjectName: sName,
            questions: [],
          });
        }
      });
    });

    // Populate questions into buckets
    questions.forEach((q) => {
      if (q.topicId && topicBucket.has(q.topicId)) {
        topicBucket.get(q.topicId)!.questions.push(q);
      } else if (q.chapterId && topicBucket.has(q.chapterId)) {
        topicBucket.get(q.chapterId)!.questions.push(q);
      }
    });

    const items: TopicDiagnosticItem[] = [];

    topicBucket.forEach((val, id) => {
      if (val.questions.length === 0) return;

      let attempted = 0;
      let correct = 0;
      let wrong = 0;
      const weakQs: Question[] = [];

      val.questions.forEach((q) => {
        const p = progressStore[q.id];
        if (p && p.status !== "unattempted") {
          attempted++;
          if (p.status === "correct") correct++;
          if (p.status === "wrong") {
            wrong++;
            weakQs.push(q);
          }
        }
      });

      const totalAttempts = correct + wrong;
      const accuracy = totalAttempts > 0 ? Math.round((correct / totalAttempts) * 100) : 0;

      let level: TopicDiagnosticItem["level"] = "unattempted";
      if (attempted === 0) {
        level = "unattempted";
      } else if (accuracy < 45) {
        level = "critical";
      } else if (accuracy < 65) {
        level = "warning";
      } else if (accuracy < 85) {
        level = "moderate";
      } else {
        level = "mastered";
      }

      items.push({
        id,
        name: val.name,
        chapterName: val.chapterName,
        subjectName: val.subjectName,
        totalQuestions: val.questions.length,
        attempted,
        correct,
        wrong,
        accuracy,
        level,
        weakQuestions: weakQs,
        allQuestions: val.questions,
      });
    });

    // Sort: Critical & Warning first, then by wrong count descending
    items.sort((a, b) => {
      const order = { critical: 0, warning: 1, moderate: 2, unattempted: 3, mastered: 4 };
      if (order[a.level] !== order[b.level]) {
        return order[a.level] - order[b.level];
      }
      return b.wrong - a.wrong;
    });

    return items;
  }, [questions, chapters, subjects, progressStore]);

  // Weakest items that need immediate drill
  const criticalItems = useMemo(
    () => diagnostics.filter((d) => d.level === "critical" || d.level === "warning"),
    [diagnostics]
  );

  const filteredItems = useMemo(() => {
    if (filterMode === "critical") return diagnostics.filter((d) => d.level === "critical");
    if (filterMode === "warning") return diagnostics.filter((d) => d.level === "warning");
    if (filterMode === "mastered") return diagnostics.filter((d) => d.level === "mastered");
    return diagnostics;
  }, [diagnostics, filterMode]);

  // Start targeted drill for specific topic/chapter
  const handleStartDrill = (item: TopicDiagnosticItem) => {
    if (!onStartSession) return;
    triggerHaptic("light");
    playClickSound();

    // Prefer questions the student got wrong, backfill with rest of topic
    const drillQuestions = item.weakQuestions.length > 0 ? item.weakQuestions : item.allQuestions;
    const selected = drillQuestions.slice(0, 15);

    onStartSession({
      title: `${item.name} — AI लक्षित अभ्यास`,
      subtitle: `${item.chapterName} • 15 त्वरित प्रश्न`,
      questionIds: selected.map((q) => q.id),
      extraQuestions: selected,
      source: "custom-smart",
      testType: "topic",
      isExamSimulation: false,
    });
  };

  // Start booster session combining all critical weak areas
  const handleStartBoosterDrill = () => {
    if (!onStartSession) return;
    triggerHaptic("success");
    playClickSound();

    const pool: Question[] = [];
    criticalItems.forEach((item) => {
      pool.push(...item.weakQuestions);
    });

    const uniqueQs = Array.from(new Map(pool.map((q) => [q.id, q])).values());
    const selected = uniqueQs.slice(0, 20);

    onStartSession({
      title: "🔥 AI कमजोरी सुधार बूस्टर टेस्ट",
      subtitle: "शीर्ष कमजोर टॉपिक्स के 20 महत्वपूर्ण प्रश्न",
      questionIds: selected.map((q) => q.id),
      extraQuestions: selected,
      source: "custom-smart",
      testType: "custom_smart",
      isExamSimulation: false,
    });
  };

  const getLevelBadge = (level: TopicDiagnosticItem["level"], accuracy: number) => {
    switch (level) {
      case "critical":
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-800">
            गंभीर ({accuracy}%)
          </span>
        );
      case "warning":
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
            सुधार योग्य ({accuracy}%)
          </span>
        );
      case "moderate":
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-100 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300 border border-blue-300 dark:border-blue-800">
            मध्यम ({accuracy}%)
          </span>
        );
      case "mastered":
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
            मजबूत ({accuracy}%)
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-500">
            अप्रत्यक्ष
          </span>
        );
    }
  };

  return (
    <div className="w-full space-y-4">
      {/* 1. AI Diagnostic Overview Card */}
      <div className="p-4 sm:p-5 rounded-2xl sm:rounded-3xl bg-gradient-to-br from-[#800020]/10 via-[#FFF9EF] to-amber-500/10 dark:from-[#800020]/30 dark:via-[#1F2330] dark:to-amber-500/20 border border-[#800020]/20 dark:border-[#800020]/40 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#800020] text-white flex items-center justify-center shrink-0 shadow-md shadow-[#800020]/30">
              <Brain className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-extrabold text-[#171923] dark:text-white flex items-center gap-2">
                AI कमजोरी हीटमैप एवं विषय विश्लेषण
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-[#800020] text-white">
                  Live
                </span>
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
                आपकी अध्ययन सटीकता और गलत प्रश्नों के आधार पर डायग्नोस्टिक रिपोर्ट
              </p>
            </div>
          </div>

          {criticalItems.length > 0 && onStartSession && (
            <button
              onClick={handleStartBoosterDrill}
              className="hidden sm:inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#800020] hover:bg-[#66001a] text-white text-xs font-bold shadow-md shadow-[#800020]/20 transition-all active:scale-95 cursor-pointer shrink-0"
            >
              <Flame className="w-4 h-4 text-amber-300" />
              <span>कमजोरी बूस्टर टेस्ट (20 Qs)</span>
            </button>
          )}
        </div>

        {/* Diagnostic Stats Bar */}
        <div className="grid grid-cols-3 gap-2.5 mt-4 pt-3 border-t border-[#800020]/15 dark:border-slate-800">
          <div className="p-2.5 rounded-xl bg-white/80 dark:bg-[#252A3A]/80 border border-slate-200/60 dark:border-slate-700/60 text-center">
            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block uppercase">
              गंभीर कमजोर विषय
            </span>
            <span className="text-base sm:text-lg font-black text-rose-600 dark:text-rose-400">
              {diagnostics.filter((d) => d.level === "critical").length}
            </span>
          </div>

          <div className="p-2.5 rounded-xl bg-white/80 dark:bg-[#252A3A]/80 border border-slate-200/60 dark:border-slate-700/60 text-center">
            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block uppercase">
              सुधार योग्य विषय
            </span>
            <span className="text-base sm:text-lg font-black text-amber-600 dark:text-amber-400">
              {diagnostics.filter((d) => d.level === "warning").length}
            </span>
          </div>

          <div className="p-2.5 rounded-xl bg-white/80 dark:bg-[#252A3A]/80 border border-slate-200/60 dark:border-slate-700/60 text-center">
            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block uppercase">
              मजबूत विषय
            </span>
            <span className="text-base sm:text-lg font-black text-emerald-600 dark:text-emerald-400">
              {diagnostics.filter((d) => d.level === "mastered").length}
            </span>
          </div>
        </div>

        {/* Mobile Booster Button */}
        {criticalItems.length > 0 && onStartSession && (
          <div className="mt-3 sm:hidden">
            <button
              onClick={handleStartBoosterDrill}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[#800020] text-white text-xs font-bold shadow-md shadow-[#800020]/20 active:scale-95"
            >
              <Flame className="w-4 h-4 text-amber-300" />
              <span>कमजोरी सुधार बूस्टर टेस्ट शुरू करें</span>
            </button>
          </div>
        )}
      </div>

      {/* 2. Filter Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto py-1 text-xs">
        {[
          { id: "all", label: `सभी विषय (${diagnostics.length})` },
          { id: "critical", label: `गंभीर (<45%)` },
          { id: "warning", label: `सुधार योग्य (45-65%)` },
          { id: "mastered", label: `मजबूत (>85%)` },
        ].map((f) => (
          <button
            key={f.id}
            onClick={() => setFilterMode(f.id as any)}
            className={`px-3 py-1.5 rounded-xl font-bold transition-all shrink-0 cursor-pointer ${
              filterMode === f.id
                ? "bg-[#800020] text-white shadow-sm"
                : "bg-white dark:bg-[#1F2330] text-slate-600 dark:text-slate-300 border border-slate-200/80 dark:border-slate-800 hover:bg-slate-50"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* 3. Heatmap Matrix Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {filteredItems.length === 0 ? (
          <div className="col-span-full py-8 text-center bg-white dark:bg-[#1F2330] rounded-2xl border border-slate-200/60 dark:border-slate-800 text-slate-400">
            <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-emerald-500 opacity-80" />
            <p className="text-xs font-bold">इस श्रेणी में कोई विषय नहीं है।</p>
          </div>
        ) : (
          filteredItems.map((item) => (
            <div
              key={item.id}
              className={`p-3.5 rounded-2xl bg-white dark:bg-[#1F2330] border transition-all flex flex-col justify-between ${
                item.level === "critical"
                  ? "border-rose-300 dark:border-rose-900/60 shadow-[0_2px_10px_-2px_rgba(244,63,94,0.1)]"
                  : item.level === "warning"
                  ? "border-amber-300 dark:border-amber-900/60 shadow-[0_2px_10px_-2px_rgba(245,158,11,0.1)]"
                  : "border-slate-200/70 dark:border-slate-800"
              }`}
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <div className="min-w-0 flex-1">
                    <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 truncate block">
                      {item.subjectName} • {item.chapterName}
                    </span>
                    <h4 className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white line-clamp-1">
                      {item.name}
                    </h4>
                  </div>
                  {getLevelBadge(item.level, item.accuracy)}
                </div>

                {/* Accuracy Progress Bar */}
                <div className="mt-2">
                  <div className="flex justify-between text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                    <span>सटीकता: {item.accuracy}%</span>
                    <span>
                      {item.correct} सही / {item.wrong} गलत ({item.attempted}/{item.totalQuestions} अभ्यास)
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        item.level === "critical"
                          ? "bg-rose-500"
                          : item.level === "warning"
                          ? "bg-amber-500"
                          : item.level === "mastered"
                          ? "bg-emerald-500"
                          : "bg-blue-500"
                      }`}
                      style={{ width: `${Math.max(item.accuracy, item.attempted > 0 ? 5 : 0)}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Action Drill Button */}
              {onStartSession && (
                <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <span className="text-[10px] text-slate-400">
                    {item.weakQuestions.length > 0
                      ? `⚠️ ${item.weakQuestions.length} गलत प्रश्न उपलब्ध`
                      : "नया अभ्यास उपलब्ध"}
                  </span>
                  <button
                    onClick={() => handleStartDrill(item)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-[#800020] hover:text-white dark:bg-slate-800 dark:hover:bg-[#800020] text-slate-700 dark:text-slate-200 text-xs font-bold transition-all cursor-pointer active:scale-95"
                  >
                    <Crosshair className="w-3.5 h-3.5" />
                    <span>लक्षित अभ्यास</span>
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};
