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
      title: `${item.name} — AI Targeted Practice`,
      subtitle: `${item.chapterName} • 15 Quick Questions`,
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
      title: "🔥 AI Weakness Booster Test",
      subtitle: "20 Essential Questions from Top Weak Areas",
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
          <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-[#991B1B]/15 dark:bg-[#991B1B]/30 text-[#991B1B] dark:text-[#F47B20] border border-[#991B1B]/30">
            Critical ({accuracy}%)
          </span>
        );
      case "warning":
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-[#C99A45]/15 dark:bg-[#C99A45]/30 text-[#800020] dark:text-[#C99A45] border border-[#C99A45]/30">
            Needs Review ({accuracy}%)
          </span>
        );
      case "moderate":
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-[#F47B20]/15 dark:bg-[#F47B20]/30 text-[#F47B20] border border-[#F47B20]/30">
            Moderate ({accuracy}%)
          </span>
        );
      case "mastered":
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
            Mastered ({accuracy}%)
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#F7EFE2] dark:bg-[#252A3A] text-stone-500 border border-[#E8D9C0]/50 dark:border-[#31374A]/60">
            Unattempted
          </span>
        );
    }
  };

  return (
    <div className="w-full space-y-4">
      {/* 1. AI Diagnostic Overview Card */}
      <div className="p-4 sm:p-5 rounded-2xl sm:rounded-3xl bg-gradient-to-br from-[#800020]/10 via-[#FFF9EF] to-[#F47B20]/10 dark:from-[#800020]/30 dark:via-[#1F2330] dark:to-[#F47B20]/20 border border-[#800020]/25 dark:border-[#800020]/40 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#800020] text-[#FFF9EF] flex items-center justify-center shrink-0 shadow-md shadow-[#800020]/30 border border-[#C99A45]/40">
              <Brain className="w-5 h-5 text-[#C99A45]" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-extrabold text-[#171923] dark:text-[#FFF9EF] flex items-center gap-2">
                AI Weakness Heatmap & Subject Diagnostics
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-[#800020] text-[#FFF9EF] border border-[#C99A45]/30">
                  Live
                </span>
              </h3>
              <p className="text-xs text-stone-600 dark:text-stone-300 mt-0.5">
                Diagnostic report based on your accuracy and mistake patterns
              </p>
            </div>
          </div>

          {criticalItems.length > 0 && onStartSession && (
            <button
              onClick={handleStartBoosterDrill}
              className="hidden sm:inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#800020] hover:bg-[#5E0017] text-[#FFF9EF] text-xs font-bold shadow-md shadow-[#800020]/25 transition-all active:scale-95 cursor-pointer shrink-0 border border-[#C99A45]/40"
            >
              <Flame className="w-4 h-4 text-[#C99A45]" />
              <span>Weakness Booster Test (20 Qs)</span>
            </button>
          )}
        </div>

        {/* Diagnostic Stats Bar */}
        <div className="grid grid-cols-3 gap-2.5 mt-4 pt-3 border-t border-[#800020]/15 dark:border-[#31374A]">
          <div className="p-2.5 rounded-xl bg-white dark:bg-[#252A3A] border border-[#E8D9C0] dark:border-[#31374A] text-center">
            <span className="text-[10px] font-bold text-stone-500 dark:text-stone-400 block uppercase">
              Critical Topics
            </span>
            <span className="text-base sm:text-lg font-black text-[#991B1B] dark:text-[#F47B20]">
              {diagnostics.filter((d) => d.level === "critical").length}
            </span>
          </div>

          <div className="p-2.5 rounded-xl bg-white dark:bg-[#252A3A] border border-[#E8D9C0] dark:border-[#31374A] text-center">
            <span className="text-[10px] font-bold text-stone-500 dark:text-stone-400 block uppercase">
              Needs Review
            </span>
            <span className="text-base sm:text-lg font-black text-[#C99A45]">
              {diagnostics.filter((d) => d.level === "warning").length}
            </span>
          </div>

          <div className="p-2.5 rounded-xl bg-white dark:bg-[#252A3A] border border-[#E8D9C0] dark:border-[#31374A] text-center">
            <span className="text-[10px] font-bold text-stone-500 dark:text-stone-400 block uppercase">
              Mastered Topics
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
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[#800020] text-[#FFF9EF] text-xs font-bold shadow-md shadow-[#800020]/25 active:scale-95 border border-[#C99A45]/40"
            >
              <Flame className="w-4 h-4 text-[#C99A45]" />
              <span>Start Weakness Booster Test</span>
            </button>
          </div>
        )}
      </div>

      {/* 2. Filter Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto py-1 text-xs">
        {[
          { id: "all", label: `All Topics (${diagnostics.length})` },
          { id: "critical", label: `Critical (<45%)` },
          { id: "warning", label: `Needs Review (45-65%)` },
          { id: "mastered", label: `Mastered (>85%)` },
        ].map((f) => (
          <button
            key={f.id}
            onClick={() => setFilterMode(f.id as any)}
            className={`px-3 py-1.5 rounded-xl font-bold transition-all shrink-0 cursor-pointer ${
              filterMode === f.id
                ? "bg-[#800020] text-[#FFF9EF] shadow-sm shadow-[#800020]/20 border border-[#800020]"
                : "bg-white dark:bg-[#1F2330] text-[#5E0017] dark:text-[#E8D9C0] border border-[#E8D9C0] dark:border-[#31374A] hover:bg-[#F7EFE2] dark:hover:bg-[#252A3A]"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* 3. Heatmap Matrix Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {filteredItems.length === 0 ? (
          <div className="col-span-full py-8 text-center bg-white dark:bg-[#1F2330] rounded-2xl border border-[#E8D9C0] dark:border-[#31374A] text-stone-400">
            <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-emerald-500 opacity-80" />
            <p className="text-xs font-bold">No topics found in this category.</p>
          </div>
        ) : (
          filteredItems.map((item) => (
            <div
              key={item.id}
              className={`p-3.5 rounded-2xl bg-white dark:bg-[#1F2330] border transition-all flex flex-col justify-between ${
                item.level === "critical"
                  ? "border-[#991B1B]/40 dark:border-[#991B1B]/60 shadow-[0_2px_10px_-2px_rgba(153,27,27,0.15)] border-l-4 border-l-[#991B1B]"
                  : item.level === "warning"
                  ? "border-[#C99A45]/40 dark:border-[#C99A45]/60 shadow-[0_2px_10px_-2px_rgba(201,154,69,0.15)] border-l-4 border-l-[#C99A45]"
                  : "border-[#E8D9C0] dark:border-[#31374A] border-l-4 border-l-emerald-500"
              }`}
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <div className="min-w-0 flex-1">
                    <span className="text-[10px] font-bold text-stone-400 dark:text-stone-500 truncate block">
                      {item.subjectName} • {item.chapterName}
                    </span>
                    <h4 className="text-xs sm:text-sm font-extrabold text-[#171923] dark:text-[#FFF9EF] line-clamp-1">
                      {item.name}
                    </h4>
                  </div>
                  {getLevelBadge(item.level, item.accuracy)}
                </div>

                {/* Accuracy Progress Bar */}
                <div className="mt-2">
                  <div className="flex justify-between text-[11px] font-semibold text-stone-500 dark:text-stone-400 mb-1">
                    <span>Accuracy: {item.accuracy}%</span>
                    <span>
                      {item.correct} Correct / {item.wrong} Wrong ({item.attempted}/{item.totalQuestions} Attempted)
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-[#F7EFE2] dark:bg-[#252A3A] overflow-hidden border border-[#E8D9C0]/50 dark:border-[#31374A]/50">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        item.level === "critical"
                          ? "bg-[#991B1B]"
                          : item.level === "warning"
                          ? "bg-[#C99A45]"
                          : item.level === "mastered"
                          ? "bg-emerald-500"
                          : "bg-[#F47B20]"
                      }`}
                      style={{ width: `${Math.max(item.accuracy, item.attempted > 0 ? 5 : 0)}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Action Drill Button */}
              {onStartSession && (
                <div className="mt-3 pt-2.5 border-t border-[#E8D9C0]/60 dark:border-[#31374A]/80 flex items-center justify-between">
                  <span className="text-[10px] text-stone-400">
                    {item.weakQuestions.length > 0
                      ? `⚠️ ${item.weakQuestions.length} incorrect questions available`
                      : "New practice available"}
                  </span>
                  <button
                    onClick={() => handleStartDrill(item)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#F7EFE2] hover:bg-[#800020] hover:text-[#FFF9EF] dark:bg-[#252A3A] dark:hover:bg-[#800020] dark:hover:text-[#FFF9EF] text-[#800020] dark:text-[#F47B20] text-xs font-bold transition-all cursor-pointer active:scale-95 border border-[#E8D9C0] dark:border-[#31374A]"
                  >
                    <Crosshair className="w-3.5 h-3.5" />
                    <span>Targeted Drill</span>
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
