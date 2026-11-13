import React, { useMemo, useState } from "react";
import {
  ProgressStore,
  AppSettings,
  Subject,
  Chapter,
  Question,
  DailyStudyHistory,
  ActiveTab,
  MCQSession,
} from "../types";
import {
  TrendingUp,
  Award,
  Zap,
  Target,
  BarChart3,
  BookOpen,
  ArrowRight,
  Flame,
  CheckCircle2,
  XCircle,
  Clock,
  Layers,
  Sparkles,
  RotateCcw,
  ArrowLeft,
  Share2,
  AlertTriangle,
  ShieldCheck,
  ChevronRight,
  Brain,
  Filter,
} from "lucide-react";
import { StudyAnalyticsChart } from "./StudyAnalyticsChart";
import { getLast7DaysStudyData, loadStudyHistoryFromStorage } from "../utils/storage";
import { isDueToday, getTodayDateString } from "../utils/revision";
import ShareModal, { ShareData } from "./ShareModal";
import { triggerHaptic, playClickSound } from "../utils/audioFeedback";

interface AnalyticsTabProps {
  progressStore: ProgressStore;
  settings: AppSettings;
  subjects: Subject[];
  chapters: Chapter[];
  questions: Question[];
  studyHistory?: DailyStudyHistory;
  onStartSession?: (session: MCQSession) => void;
  onNavigateTab: (tab: ActiveTab) => void;
}

export const AnalyticsTab: React.FC<AnalyticsTabProps> = ({
  progressStore,
  settings,
  subjects,
  chapters,
  questions,
  studyHistory,
  onStartSession,
  onNavigateTab,
}) => {
  const todayStr = settings.todayDate || getTodayDateString();
  const [shareData, setShareData] = useState<ShareData | null>(null);
  const [subjectFilter, setSubjectFilter] = useState<"all" | "weak" | "strong">("all");

  // 7-day study analytics data
  const last7DaysData = useMemo(() => {
    const history = studyHistory || loadStudyHistoryFromStorage();
    return getLast7DaysStudyData(history, progressStore, todayStr);
  }, [studyHistory, progressStore, todayStr]);

  // Overall statistics calculation
  const stats = useMemo(() => {
    let totalPracticed = 0;
    let totalCorrectCount = 0;
    let totalWrongCount = 0;
    let stageCounts: { [key: number]: number } = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0 };
    let dueQuestions: Question[] = [];
    let wrongQuestions: Question[] = [];

    questions.forEach((q) => {
      const p = progressStore[q.id];
      if (p && p.status !== "unattempted") {
        totalPracticed++;
        if (p.status === "correct") {
          totalCorrectCount++;
        } else if (p.status === "wrong") {
          totalWrongCount++;
          wrongQuestions.push(q);
        }

        const stage = Math.min(Math.max(p.stage || 0, 0), 4);
        stageCounts[stage] = (stageCounts[stage] || 0) + 1;

        if (isDueToday(p, todayStr)) {
          dueQuestions.push(q);
        }
      }
    });

    const totalAnswerAttempts = totalCorrectCount + totalWrongCount;
    const overallAccuracy =
      totalAnswerAttempts > 0
        ? Math.round((totalCorrectCount / totalAnswerAttempts) * 100)
        : 0;

    // Stage 3 & 4 (21+ days interval) considered strongly retained/mastered
    const masteredCount = (stageCounts[3] || 0) + (stageCounts[4] || 0);

    const totalAvailableQuestions = questions.length;
    const syllabusCoverage =
      totalAvailableQuestions > 0
        ? Math.round((totalPracticed / totalAvailableQuestions) * 100)
        : 0;

    return {
      totalPracticed,
      totalCorrectCount,
      totalWrongCount,
      totalAnswerAttempts,
      overallAccuracy,
      stageCounts,
      dueQuestions,
      wrongQuestions,
      masteredCount,
      syllabusCoverage,
      totalAvailableQuestions,
    };
  }, [questions, progressStore, todayStr]);

  // Compute consecutive study streak from history
  const streakDays = useMemo(() => {
    const history = studyHistory || loadStudyHistoryFromStorage();
    if (!history) return 1;
    let streak = 0;
    const checkDate = new Date();
    const todayHasActivity = (history[todayStr]?.correct || 0) + (history[todayStr]?.wrong || 0) > 0;
    if (!todayHasActivity) {
      checkDate.setDate(checkDate.getDate() - 1);
    }
    for (let i = 0; i < 30; i++) {
      const dStr = checkDate.toISOString().split("T")[0];
      const entry = history[dStr];
      if (entry && entry.correct + entry.wrong > 0) {
        streak++;
        checkDate.setDate(checkDate.getDate() - 1);
      } else {
        break;
      }
    }
    return Math.max(streak, todayHasActivity ? 1 : 1);
  }, [studyHistory, todayStr]);

  // Subject-wise performance metrics
  const subjectMetrics = useMemo(() => {
    const chapterToSubjectMap = new Map<string, string>();
    const topicToSubjectMap = new Map<string, string>();

    chapters.forEach((ch) => {
      const sId = ch.subjectId || "";
      if (sId) {
        chapterToSubjectMap.set(ch.id, sId);
        (ch.topics || []).forEach((t) => {
          if (t && t.id) topicToSubjectMap.set(t.id, sId);
        });
      }
    });

    return subjects.map((subj) => {
      const sNorm = (subj.id || "").toLowerCase().replace(/[-_]/g, "").trim();
      const sSlugNorm = subj.slug ? (subj.slug || "").toLowerCase().replace(/[-_]/g, "").trim() : "";

      const subjQuestions = questions.filter((q) => {
        if (!q || !q.id) return false;
        const qSubNorm = (q.subjectId || "").toLowerCase().replace(/[-_]/g, "").trim();
        if (qSubNorm && (qSubNorm === sNorm || (sSlugNorm && qSubNorm === sSlugNorm))) return true;

        const mappedChSubj = q.chapterId ? chapterToSubjectMap.get(q.chapterId) : undefined;
        if (mappedChSubj) {
          const mNorm = mappedChSubj.toLowerCase().replace(/[-_]/g, "").trim();
          if (mNorm === sNorm || (sSlugNorm && mNorm === sSlugNorm)) return true;
        }

        const mappedTopSubj = q.topicId ? topicToSubjectMap.get(q.topicId) : undefined;
        if (mappedTopSubj) {
          const mNorm = mappedTopSubj.toLowerCase().replace(/[-_]/g, "").trim();
          if (mNorm === sNorm || (sSlugNorm && mNorm === sSlugNorm)) return true;
        }

        return false;
      });

      let attempted = 0;
      let correct = 0;
      let wrong = 0;

      subjQuestions.forEach((q) => {
        const p = progressStore[q.id];
        if (p && p.status !== "unattempted") {
          attempted++;
          if (p.status === "correct") correct++;
          if (p.status === "wrong") wrong++;
        }
      });

      const totalAttempts = correct + wrong;
      const accuracy = totalAttempts > 0 ? Math.round((correct / totalAttempts) * 100) : 0;
      const coverage =
        subjQuestions.length > 0
          ? Math.round((attempted / subjQuestions.length) * 100)
          : 0;

      return {
        subject: subj,
        totalQuestions: subjQuestions.length,
        attempted,
        correct,
        wrong,
        accuracy,
        coverage,
        questions: subjQuestions,
        isWeak: attempted > 0 && accuracy < 60,
        isStrong: attempted >= 5 && accuracy >= 75,
      };
    });
  }, [subjects, chapters, questions, progressStore]);

  // Filtered subjects based on selection
  const filteredSubjects = useMemo(() => {
    if (subjectFilter === "weak") {
      return subjectMetrics.filter((s) => s.isWeak || (s.attempted > 0 && s.accuracy < 70));
    }
    if (subjectFilter === "strong") {
      return subjectMetrics.filter((s) => s.isStrong || s.accuracy >= 75);
    }
    return subjectMetrics;
  }, [subjectMetrics, subjectFilter]);

  // Exam Readiness Calculation
  const readiness = useMemo(() => {
    const accWeight = stats.overallAccuracy * 0.6;
    const covWeight = Math.min(stats.syllabusCoverage, 100) * 0.3;
    const streakBonus = Math.min(streakDays, 7) * 1.4;
    const score = Math.min(100, Math.round(accWeight + covWeight + streakBonus));

    let tier = "Foundation";
    let tierHindi = "Early Foundation";
    let color = "text-[#800020] dark:text-[#F47B20]";
    let bg = "bg-[#800020]/10 dark:bg-[#F47B20]/15";
    let border = "border-[#800020]/20 dark:border-[#F47B20]/25";
    let note = "Keep practicing regularly to build speed and accuracy.";

    if (score >= 80) {
      tier = "Exam Ready";
      tierHindi = "Grade A+ Performance";
      color = "text-emerald-600 dark:text-emerald-400";
      bg = "bg-emerald-500/10 dark:bg-emerald-500/20";
      border = "border-emerald-500/30";
      note = "Superb! Your accuracy and retention are at competitive exam rank level.";
    } else if (score >= 60) {
      tier = "Competitive";
      tierHindi = "Strong Rank Track";
      color = "text-[#800020] dark:text-[#F47B20]";
      bg = "bg-[#800020]/10 dark:bg-[#F47B20]/15";
      border = "border-[#800020]/30 dark:border-[#F47B20]/30";
      note = "Great going! Focus on weaker topics to push your score above 80%.";
    } else if (score >= 40) {
      tier = "Developing";
      tierHindi = "Steadily Improving";
      color = "text-[#C99A45]";
      bg = "bg-[#C99A45]/15";
      border = "border-[#C99A45]/30";
      note = "Review mistakes and take regular chapter tests to boost retention.";
    }

    return { score, tier, tierHindi, color, bg, border, note };
  }, [stats, streakDays]);

  const leitnerStagesInfo = [
    { stage: 0, interval: "1-3 Days", label: "Learning", color: "bg-rose-500", text: "text-rose-500" },
    { stage: 1, interval: "7 Days", label: "Reviewing", color: "bg-[#F47B20]", text: "text-[#F47B20]" },
    { stage: 2, interval: "21 Days", label: "Reinforcing", color: "bg-[#C99A45]", text: "text-[#C99A45]" },
    { stage: 3, interval: "45 Days", label: "Retaining", color: "bg-[#800020]", text: "text-[#800020]" },
    { stage: 4, interval: "75+ Days", label: "Mastered", color: "bg-emerald-500", text: "text-emerald-500" },
  ];

  const handleShareReport = () => {
    triggerHaptic("light");
    playClickSound();
    const title = `📊 My DISHA 20-20 Exam Readiness Report: ${readiness.score}% (${readiness.tier})`;
    const text = `🎯 Accuracy: ${stats.overallAccuracy}%\n📚 Practiced: ${stats.totalPracticed} Qs\n🔥 Streak: ${streakDays} Days\n🧠 Mastered: ${stats.masteredCount} Qs\n\nTrack your Rajasthan competitive exam performance on DISHA 20-20:`;
    setShareData({
      title,
      text,
      url: typeof window !== "undefined" ? window.location.origin : "https://disha2020.in",
      category: "Performance Report",
    });
  };

  const handleStartSubjectPractice = (metric: typeof subjectMetrics[0]) => {
    triggerHaptic("light");
    playClickSound();
    if (onStartSession && metric.questions.length > 0) {
      onStartSession({
        title: `${metric.subject.name || metric.subject.hindiName || "Subject"} Practice`,
        subtitle: `${metric.questions.length} Questions • Target Practice`,
        questionIds: metric.questions.map((q) => q.id),
        source: "all-chapters",
      });
    } else {
      onNavigateTab("topics");
    }
  };

  return (
    <div
      id="analytics-tab-container"
      className="min-h-full bg-[#FFF9EF] dark:bg-[#171923] pb-28 overflow-y-auto selection:bg-[#800020] selection:text-white"
    >
      {/* 1. TOP APP BAR */}
      <header className="sticky top-0 z-30 bg-white/95 dark:bg-[#1F2330]/95 backdrop-blur-md border-b border-[#E8D9C0] dark:border-[#31374A] px-4 py-3">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => {
                triggerHaptic("light");
                onNavigateTab("home");
              }}
              className="w-10 h-10 rounded-2xl bg-[#F7EFE2] dark:bg-[#252A3A] text-[#171923] dark:text-[#FFF9EF] hover:border-[#800020] border border-[#E8D9C0] dark:border-[#31374A] flex items-center justify-center transition-all active:scale-90 cursor-pointer shrink-0"
              aria-label="Back to Home"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="min-w-0">
              <h1 className="text-base sm:text-lg font-black text-[#171923] dark:text-[#FFF9EF] tracking-tight leading-none truncate">
                Performance Report
              </h1>
              <p className="text-[10px] font-bold text-[#52576A] dark:text-[#CBD2E1] uppercase tracking-widest mt-1 truncate">
                Performance Report & Analytics • DISHA 20-20
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleShareReport}
              className="h-10 px-3 sm:px-3.5 rounded-2xl bg-[#800020]/10 dark:bg-[#F47B20]/15 text-[#800020] dark:text-[#F47B20] hover:bg-[#800020] hover:text-white dark:hover:bg-[#F47B20] dark:hover:text-white flex items-center gap-1.5 text-xs font-black transition-all active:scale-95 cursor-pointer border border-[#800020]/20 dark:border-[#F47B20]/30"
              aria-label="Share Report"
            >
              <Share2 className="w-4 h-4" />
              <span className="hidden xs:inline">Share</span>
            </button>
          </div>
        </div>
      </header>

      <main className="p-4 sm:p-5 max-w-4xl mx-auto w-full space-y-4 sm:space-y-5">
        {/* 2. HERO EXAM READINESS SCORECARD */}
        <section className="bg-white dark:bg-[#1F2330] border border-[#E8D9C0] dark:border-[#31374A] rounded-3xl p-5 shadow-2xs relative overflow-hidden">
          {/* Subtle Accent Glow */}
          <div className="absolute top-0 right-0 w-44 h-44 bg-gradient-to-bl from-[#800020]/10 via-[#F47B20]/5 to-transparent rounded-full blur-2xl pointer-events-none" />

          <div className="flex items-start justify-between gap-4 relative z-10">
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider bg-[#F7EFE2] dark:bg-[#252A3A] text-[#800020] dark:text-[#F47B20] border border-[#E8D9C0] dark:border-[#31374A] mb-2">
                <Target className="w-3 h-3 text-[#800020] dark:text-[#F47B20]" />
                <span>Aspirant Exam Readiness</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-black text-[#171923] dark:text-[#FFF9EF] tracking-tight flex items-baseline gap-1.5 tabular-nums">
                <span>{readiness.score}</span>
                <span className="text-sm font-extrabold text-[#787D91] dark:text-[#929AB0]">/ 100</span>
              </h2>
              <div className="flex items-center gap-2 mt-1">
                <span className={`text-xs font-black ${readiness.color}`}>
                  {readiness.tier}
                </span>
                <span className="text-[#E8D9C0] dark:text-[#31374A]" aria-hidden="true">•</span>
                <span className="text-xs font-bold text-[#52576A] dark:text-[#CBD2E1]">
                  {readiness.tierHindi}
                </span>
              </div>
            </div>

            {/* Circular Ring Gauge */}
            <div className="relative w-18 h-18 sm:w-20 sm:h-20 shrink-0 flex items-center justify-center">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                <path
                  className="text-[#F7EFE2] dark:text-[#252A3A]"
                  strokeWidth="3.5"
                  stroke="currentColor"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
                <path
                  className={
                    readiness.score >= 80
                      ? "text-emerald-500"
                      : readiness.score >= 60
                      ? "text-[#800020] dark:text-[#F47B20]"
                      : "text-[#C99A45]"
                  }
                  strokeDasharray={`${readiness.score}, 100`}
                  strokeLinecap="round"
                  strokeWidth="3.5"
                  stroke="currentColor"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <Award className={`w-5 h-5 sm:w-6 sm:h-6 ${readiness.color}`} />
              </div>
            </div>
          </div>

          <p className="text-[11px] text-[#52576A] dark:text-[#CBD2E1] font-medium mt-3 pt-3 border-t border-[#E8D9C0] dark:border-[#31374A] relative z-10">
            {readiness.note}
          </p>

          {/* 4 Essential KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-4 relative z-10">
            <div className="bg-[#FFF9EF] dark:bg-[#171923] rounded-2xl p-3 border border-[#E8D9C0] dark:border-[#31374A] text-center">
              <span className="text-[9px] font-black uppercase tracking-wider text-[#787D91] dark:text-[#929AB0] block mb-0.5">
                Accuracy
              </span>
              <span className="text-lg font-black text-emerald-600 dark:text-emerald-400 font-mono tabular-nums">
                {stats.overallAccuracy}%
              </span>
              <span className="text-[9px] font-bold text-[#787D91] dark:text-[#929AB0] block mt-0.5">
                Precision Score
              </span>
            </div>

            <div className="bg-[#FFF9EF] dark:bg-[#171923] rounded-2xl p-3 border border-[#E8D9C0] dark:border-[#31374A] text-center">
              <span className="text-[9px] font-black uppercase tracking-wider text-[#787D91] dark:text-[#929AB0] block mb-0.5">
                Practiced
              </span>
              <span className="text-lg font-black text-[#171923] dark:text-[#FFF9EF] font-mono tabular-nums">
                {stats.totalPracticed}
              </span>
              <span className="text-[9px] font-bold text-[#787D91] dark:text-[#929AB0] block mt-0.5">
                Total Solved
              </span>
            </div>

            <div className="bg-[#FFF9EF] dark:bg-[#171923] rounded-2xl p-3 border border-[#E8D9C0] dark:border-[#31374A] text-center">
              <span className="text-[9px] font-black uppercase tracking-wider text-[#787D91] dark:text-[#929AB0] block mb-0.5">
                Mastered
              </span>
              <span className="text-lg font-black text-[#800020] dark:text-[#F47B20] font-mono tabular-nums">
                {stats.masteredCount}
              </span>
              <span className="text-[9px] font-bold text-[#787D91] dark:text-[#929AB0] block mt-0.5">
                Retention Qs
              </span>
            </div>

            <div className="bg-[#FFF9EF] dark:bg-[#171923] rounded-2xl p-3 border border-[#E8D9C0] dark:border-[#31374A] text-center">
              <span className="text-[9px] font-black uppercase tracking-wider text-[#787D91] dark:text-[#929AB0] block mb-0.5">
                Mistakes
              </span>
              <span className="text-lg font-black text-rose-600 dark:text-rose-400 font-mono tabular-nums">
                {stats.wrongQuestions.length}
              </span>
              <span className="text-[9px] font-bold text-[#787D91] dark:text-[#929AB0] block mt-0.5">
                To Revise
              </span>
            </div>
          </div>
        </section>

        {/* 3. HIGH PRIORITY ACTIONS ("What Should I Do Today?") */}
        <section className="space-y-2.5">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-xs font-black uppercase tracking-[0.15em] text-[#171923] dark:text-[#FFF9EF] flex items-center gap-1.5">
              <Zap className="w-4 h-4 text-[#F47B20] fill-[#F47B20]" />
              <span>Recommended Actions (Today's Goal)</span>
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {/* Action 1: Fix Mistakes */}
            <button
              type="button"
              onClick={() => {
                triggerHaptic("light");
                playClickSound();
                onNavigateTab("wrong");
              }}
              className="bg-white dark:bg-[#1F2330] border border-[#E8D9C0] dark:border-[#31374A] hover:border-rose-400 dark:hover:border-rose-700/80 p-3.5 rounded-2xl flex items-center justify-between text-left transition-all active:scale-[0.98] cursor-pointer group shadow-2xs"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                  <RotateCcw className="w-5 h-5 group-hover:-rotate-45 transition-transform" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <h4 className="text-xs font-black text-[#171923] dark:text-[#FFF9EF] truncate">
                      Review Mistakes
                    </h4>
                    <span className="px-1.5 py-0.2 rounded-md bg-rose-100 dark:bg-rose-900/50 text-rose-600 dark:text-rose-300 font-mono text-[9px] font-black tabular-nums">
                      {stats.wrongQuestions.length}
                    </span>
                  </div>
                  <p className="text-[10px] text-[#52576A] dark:text-[#CBD2E1] truncate mt-0.5">
                    Revise weak questions
                  </p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-[#787D91] group-hover:translate-x-1 transition-transform shrink-0" />
            </button>

            {/* Action 2: Due Spaced Revision */}
            <button
              type="button"
              onClick={() => {
                triggerHaptic("light");
                playClickSound();
                if (stats.dueQuestions.length > 0 && onStartSession) {
                  onStartSession({
                    title: "Due Revision Session",
                    subtitle: `${stats.dueQuestions.length} Spaced Repetition Qs Due`,
                    questionIds: stats.dueQuestions.map((q) => q.id),
                    source: "all-chapters",
                  });
                } else {
                  onNavigateTab("topics");
                }
              }}
              className="bg-white dark:bg-[#1F2330] border border-[#E8D9C0] dark:border-[#31374A] hover:border-[#800020] dark:hover:border-[#F47B20] p-3.5 rounded-2xl flex items-center justify-between text-left transition-all active:scale-[0.98] cursor-pointer group shadow-2xs"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-[#800020]/10 dark:bg-[#F47B20]/15 text-[#800020] dark:text-[#F47B20] flex items-center justify-center shrink-0">
                  <Brain className="w-5 h-5 group-hover:scale-110 transition-transform" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <h4 className="text-xs font-black text-[#171923] dark:text-[#FFF9EF] truncate">
                      Spaced Memory
                    </h4>
                    <span className="px-1.5 py-0.2 rounded-md bg-[#800020]/10 dark:bg-[#F47B20]/15 text-[#800020] dark:text-[#F47B20] font-mono text-[9px] font-black tabular-nums">
                      {stats.dueQuestions.length} Due
                    </span>
                  </div>
                  <p className="text-[10px] text-[#52576A] dark:text-[#CBD2E1] truncate mt-0.5">
                    Spaced repetition practice
                  </p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-[#787D91] group-hover:translate-x-1 transition-transform shrink-0" />
            </button>
          </div>
        </section>

        {/* 4. SUBJECT MASTERY & WEAK AREAS BREAKDOWN */}
        <section className="bg-white dark:bg-[#1F2330] border border-[#E8D9C0] dark:border-[#31374A] rounded-3xl p-5 shadow-2xs space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <h3 className="text-xs font-black uppercase tracking-wider text-[#171923] dark:text-[#FFF9EF] flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-[#800020] dark:text-[#F47B20]" />
                <span>Subject Mastery</span>
              </h3>
              <p className="text-[10px] font-bold text-[#787D91] dark:text-[#929AB0] uppercase tracking-widest mt-0.5">
                Strengths & Needs Attention
              </p>
            </div>

            {/* Filter Chips */}
            <div className="flex items-center gap-1 bg-[#F7EFE2] dark:bg-[#252A3A] p-1 rounded-xl border border-[#E8D9C0] dark:border-[#31374A]">
              {[
                { id: "all", label: "All" },
                { id: "weak", label: "Weak Focus" },
                { id: "strong", label: "Strong" },
              ].map((f) => (
                <button
                  key={f.id}
                  onClick={() => {
                    triggerHaptic("light");
                    setSubjectFilter(f.id as any);
                  }}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-black transition-all cursor-pointer ${
                    subjectFilter === f.id
                      ? "bg-[#800020] dark:bg-[#F47B20] text-white shadow-2xs"
                      : "text-[#52576A] dark:text-[#CBD2E1] hover:text-[#171923] dark:hover:text-white"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
            {filteredSubjects.length === 0 ? (
              <div className="md:col-span-2 py-6 text-center text-[#787D91] dark:text-[#929AB0] text-xs font-medium">
                No subjects matching this filter. Start practicing to see data!
              </div>
            ) : (
              filteredSubjects.map((metric) => {
                const isAccHigh = metric.accuracy >= 75;
                const isAccMed = metric.accuracy >= 50 && metric.accuracy < 75;

                const badgeBg = isAccHigh
                  ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800"
                  : isAccMed
                  ? "bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800"
                  : "bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-800";

                const barColor = isAccHigh
                  ? "bg-emerald-500"
                  : isAccMed
                  ? "bg-[#F47B20]"
                  : "bg-rose-500";

                return (
                  <div
                    key={metric.subject.id}
                    className="p-3.5 rounded-2xl bg-[#FFF9EF] dark:bg-[#171923] border border-[#E8D9C0] dark:border-[#31374A] space-y-2.5"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className="text-xs sm:text-sm font-black text-[#171923] dark:text-[#FFF9EF] truncate">
                            {metric.subject.name || metric.subject.hindiName}
                          </h4>
                          {metric.isWeak && (
                            <span className="px-1.5 py-0.5 rounded-md text-[8.5px] font-black uppercase bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 shrink-0">
                              Focus Area
                            </span>
                          )}
                          {metric.isStrong && (
                            <span className="px-1.5 py-0.5 rounded-md text-[8.5px] font-black uppercase bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shrink-0">
                              Mastered
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-[#52576A] dark:text-[#CBD2E1] mt-0.5 tabular-nums">
                          {metric.attempted} / {metric.totalQuestions} questions solved • Coverage: {metric.coverage}%
                        </p>
                      </div>

                      <div className="text-right shrink-0">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-lg text-xs font-black font-mono tabular-nums border ${badgeBg}`}
                        >
                          {metric.accuracy}%
                        </span>
                        <span className="text-[9px] font-bold text-[#787D91] dark:text-[#929AB0] block mt-0.5 uppercase tracking-wider">
                          Accuracy
                        </span>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="h-2 w-full bg-[#E8D9C0]/60 dark:bg-[#252A3A] rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-700 ${barColor}`}
                        style={{ width: `${Math.max(4, metric.accuracy)}%` }}
                      />
                    </div>

                    {/* Direct Action Button */}
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[10px] font-bold text-[#787D91] dark:text-[#929AB0] tabular-nums">
                        {metric.correct} Correct • {metric.wrong} Wrong
                      </span>
                      <button
                        type="button"
                        onClick={() => handleStartSubjectPractice(metric)}
                        className="px-3 py-1.5 rounded-xl bg-white dark:bg-[#1F2330] hover:bg-[#800020] hover:text-white dark:hover:bg-[#F47B20] dark:hover:text-white text-[#800020] dark:text-[#F47B20] font-black text-[11px] border border-[#E8D9C0] dark:border-[#31374A] transition-all active:scale-95 cursor-pointer flex items-center gap-1 shadow-2xs"
                      >
                        <span>Practice Subject</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>

        {/* 5. 7-DAY STUDY CONSISTENCY & STREAK */}
        <section className="bg-white dark:bg-[#1F2330] border border-[#E8D9C0] dark:border-[#31374A] rounded-3xl p-5 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-[#F47B20]/15 text-[#F47B20] flex items-center justify-center">
                <Flame className="w-5 h-5 fill-[#F47B20]" />
              </div>
              <div>
                <h3 className="text-xs font-black uppercase tracking-wider text-[#171923] dark:text-[#FFF9EF]">
                  Study Consistency
                </h3>
                <p className="text-[10px] font-bold text-[#787D91] dark:text-[#929AB0] font-mono tabular-nums">
                  {streakDays} Day Active Streak
                </p>
              </div>
            </div>
            <div className="px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider bg-[#800020]/10 dark:bg-[#F47B20]/15 text-[#800020] dark:text-[#F47B20] font-mono">
              Last 7 Days
            </div>
          </div>

          <div className="relative h-44 sm:h-48 pt-2">
            <StudyAnalyticsChart data={last7DaysData} isDarkMode={settings.darkMode} />
          </div>
        </section>

        {/* 6. SPACING REPETITION / LEITNER MEMORY TRACKER */}
        <section className="bg-white dark:bg-[#1F2330] border border-[#E8D9C0] dark:border-[#31374A] rounded-3xl p-5 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xs font-black uppercase tracking-wider text-[#171923] dark:text-[#FFF9EF] flex items-center gap-2">
                <Brain className="w-4 h-4 text-[#800020] dark:text-[#F47B20]" />
                <span>Memory Retention Stages</span>
              </h3>
              <p className="text-[10px] font-bold text-[#787D91] dark:text-[#929AB0] uppercase tracking-widest mt-0.5">
                Scientific Spaced Repetition (Leitner 5-Stage System)
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
            {leitnerStagesInfo.map((box) => {
              const count = stats.stageCounts[box.stage] || 0;
              const pct = stats.totalPracticed > 0 ? Math.round((count / stats.totalPracticed) * 100) : 0;
              return (
                <div
                  key={box.stage}
                  className="p-3 rounded-2xl bg-[#FFF9EF] dark:bg-[#171923] border border-[#E8D9C0] dark:border-[#31374A] flex flex-col justify-between"
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[9px] font-black uppercase tracking-wider text-[#787D91] dark:text-[#929AB0] font-mono tabular-nums">
                      Stage {box.stage}
                    </span>
                    <div className={`w-2 h-2 rounded-full ${box.color}`} />
                  </div>
                  <div>
                    <span className="text-lg font-black text-[#171923] dark:text-[#FFF9EF] font-mono tabular-nums block">
                      {count}
                    </span>
                    <span className="text-[9px] font-bold text-[#52576A] dark:text-[#CBD2E1] block truncate">
                      {box.label}
                    </span>
                    <span className="text-[8.5px] font-medium text-[#787D91] dark:text-[#929AB0] block mt-0.5 font-mono tabular-nums">
                      {box.interval} • {pct}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* 7. QUICK REVISION TEST BANNER (Bottom Action) */}
        <div className="pt-1">
          <button
            type="button"
            onClick={() => {
              triggerHaptic("light");
              playClickSound();
              onNavigateTab("topics");
            }}
            className="w-full h-13 rounded-2xl bg-gradient-to-r from-[#800020] via-[#5E0017] to-[#171923] text-white font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-[#800020]/20 border border-[#C99A45]/30 active:scale-95 transition-all cursor-pointer"
          >
            <Sparkles className="w-4 h-4 text-[#F47B20]" />
            <span>Practice Next Topic & Boost Score</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </main>

      {/* Share Modal */}
      {shareData && (
        <ShareModal
          isOpen={!!shareData}
          onClose={() => setShareData(null)}
          data={shareData}
        />
      )}
    </div>
  );
};
