import React, { useMemo, useState } from "react";
import {
  ProgressStore,
  AppSettings,
  Subject,
  Chapter,
  Topic,
  Question,
  DailyStudyHistory,
  ActiveTab,
  MCQSession,
  UserProfile,
} from "../types";
import {
  Award,
  Target,
  TrendingUp,
  BarChart3,
  BookOpen,
  ArrowRight,
  Flame,
  CheckCircle2,
  XCircle,
  RotateCcw,
  ArrowLeft,
  Share2,
  AlertTriangle,
  ShieldCheck,
  ChevronRight,
  Brain,
  Filter,
  Sparkles,
  Zap,
  LayoutDashboard,
  Layers,
  Check,
  Activity,
  Calendar,
  Clock,
} from "lucide-react";
import { getLast7DaysStudyData, loadStudyHistoryFromStorage } from "../utils/storage";
import { isDueToday, getTodayDateString } from "../utils/revision";
import ShareModal, { ShareData } from "./ShareModal";
import { triggerHaptic, playClickSound } from "../utils/audioFeedback";
import { loadUserProfile } from "../utils/userProfileStorage";
import { loadPerformanceStore } from "../utils/performanceStorage";
import {
  diagnoseStudentWeaknesses,
  createRemedialTestSession,
} from "../services/aiWeaknessPrescriptionService";

interface AnalyticsTabProps {
  progressStore: ProgressStore;
  settings: AppSettings;
  subjects: Subject[];
  chapters: Chapter[];
  questions: Question[];
  studyHistory?: DailyStudyHistory;
  userProfile?: UserProfile | null;
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
  userProfile,
  onStartSession,
  onNavigateTab,
}) => {
  const todayStr = settings.todayDate || getTodayDateString();
  const [activeTab, setActiveTab] = useState<"overview" | "weakness" | "subjects">("overview");
  const [subjectFilter, setSubjectFilter] = useState<"all" | "weak" | "strong">("all");
  const [shareData, setShareData] = useState<ShareData | null>(null);
  const [copiedShare, setCopiedShare] = useState(false);

  const currentUserProfile = userProfile || loadUserProfile();
  const studentName = currentUserProfile?.full_name || currentUserProfile?.name || "Aspirant";
  const targetExam = settings.selectedExam || "Rajasthan CET / RAS / REET Prep";

  // ─── 1. CORE STATS COMPUTATION ───────────────────────────────────────────────
  const stats = useMemo(() => {
    let totalPracticed = 0;
    let totalCorrectCount = 0;
    let totalWrongCount = 0;
    const stageCounts: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0 };
    const dueQuestions: Question[] = [];
    const wrongQuestions: Question[] = [];

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

    const negativeMarksLost = Number((totalWrongCount * 0.33).toFixed(2));
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
      negativeMarksLost,
      stageCounts,
      dueQuestions,
      wrongQuestions,
      masteredCount,
      syllabusCoverage,
      totalAvailableQuestions,
    };
  }, [questions, progressStore, todayStr]);

  // ─── 2. STREAK COMPUTATION ──────────────────────────────────────────────────
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

  // ─── 3. 7-DAY CONSISTENCY DATA ──────────────────────────────────────────────
  const last7DaysData = useMemo(() => {
    const history = studyHistory || loadStudyHistoryFromStorage();
    return getLast7DaysStudyData(history, progressStore, todayStr);
  }, [studyHistory, progressStore, todayStr]);

  // ─── 4. EXAM READINESS SCORE & TIER ─────────────────────────────────────────
  const readiness = useMemo(() => {
    const accWeight = stats.overallAccuracy * 0.55;
    const covWeight = Math.min(stats.syllabusCoverage, 100) * 0.35;
    const streakBonus = Math.min(streakDays, 7) * 1.5;
    const score = Math.min(100, Math.max(0, Math.round(accWeight + covWeight + streakBonus)));

    let tier = "Building Base";
    let grade = "B";
    let color = "text-[#7045D8] dark:text-[#A78BFA]";
    let bg = "bg-[#7045D8]/10 dark:bg-[#7045D8]/15";
    let note = "Daily practice builds consistency and eliminates negative marks.";

    if (score >= 80) {
      tier = "Ranker's Track";
      grade = "A+";
      color = "text-emerald-500 dark:text-emerald-400";
      bg = "bg-emerald-500/10 dark:bg-emerald-500/15";
      note = "Superb precision! Your accuracy and retention align with high cutoff ranks.";
    } else if (score >= 65) {
      tier = "Competitive";
      grade = "A";
      color = "text-[#7045D8] dark:text-[#A78BFA]";
      bg = "bg-[#7045D8]/10 dark:bg-[#7045D8]/15";
      note = "Solid performance. Eliminate negative marks in weak topics to crack top ranks.";
    } else if (score >= 45) {
      tier = "Steady Progress";
      grade = "B";
      color = "text-amber-500 dark:text-amber-400";
      bg = "bg-amber-500/10 dark:bg-amber-500/15";
      note = "Review mistakes daily and use spaced memory drills to boost retention.";
    } else {
      tier = "Foundation";
      grade = "C";
      color = "text-rose-500 dark:text-rose-400";
      bg = "bg-rose-500/10 dark:bg-rose-500/15";
      note = "Avoid guessing in mock drills. Focus on high-frequency previous year questions.";
    }

    return { score, tier, grade, color, bg, note };
  }, [stats, streakDays]);

  // ─── 5. SUBJECT MASTERY DATA ────────────────────────────────────────────────
  const subjectMetrics = useMemo(() => {
    return subjects.map((subj) => {
      const sId = (subj.id || "").toLowerCase();
      const sSlug = (subj.slug || "").toLowerCase();

      const subjQuestions = questions.filter((q) => {
        const qSub = (q.subjectId || "").toLowerCase();
        return qSub === sId || (sSlug && qSub === sSlug);
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
      const coverage = subjQuestions.length > 0 ? Math.round((attempted / subjQuestions.length) * 100) : 0;

      return {
        subject: subj,
        totalQuestions: subjQuestions.length,
        attempted,
        correct,
        wrong,
        accuracy,
        coverage,
        isWeak: attempted > 0 && accuracy < 60,
        isStrong: attempted >= 5 && accuracy >= 75,
      };
    });
  }, [subjects, questions, progressStore]);

  const filteredSubjects = useMemo(() => {
    if (subjectFilter === "weak") {
      return subjectMetrics.filter((s) => s.isWeak || (s.attempted > 0 && s.accuracy < 65));
    }
    if (subjectFilter === "strong") {
      return subjectMetrics.filter((s) => s.isStrong || s.accuracy >= 75);
    }
    return subjectMetrics;
  }, [subjectMetrics, subjectFilter]);

  // ─── 6. WEAK TOPICS COMPUTATION ─────────────────────────────────────────────
  const weakTopics = useMemo(() => {
    const chapterMap = new Map<string, Chapter>(chapters.map((c) => [c.id, c]));
    const subjectMap = new Map<string, Subject>(subjects.map((s) => [s.id, s]));

    const topicStats = new Map<
      string,
      {
        id: string;
        name: string;
        chapterName: string;
        subjectName: string;
        attempted: number;
        correct: number;
        wrong: number;
        questions: Question[];
      }
    >();

    questions.forEach((q) => {
      const p = progressStore[q.id];
      if (!p || p.status === "unattempted") return;

      const ch = q.chapterId ? chapterMap.get(q.chapterId) : undefined;
      const sub = q.subjectId ? subjectMap.get(q.subjectId) : undefined;
      const key = q.topicId || q.chapterId || "general";
      const name = q.topic || ch?.title || "General Section";
      const chName = ch?.title || "Chapter";
      const subName = sub?.name || "Subject";

      if (!topicStats.has(key)) {
        topicStats.set(key, {
          id: key,
          name,
          chapterName: chName,
          subjectName: subName,
          attempted: 0,
          correct: 0,
          wrong: 0,
          questions: [],
        });
      }

      const item = topicStats.get(key)!;
      item.attempted++;
      item.questions.push(q);
      if (p.status === "correct") item.correct++;
      if (p.status === "wrong") item.wrong++;
    });

    const list: Array<{
      id: string;
      name: string;
      chapterName: string;
      subjectName: string;
      attempted: number;
      correct: number;
      wrong: number;
      accuracy: number;
      questions: Question[];
    }> = [];

    topicStats.forEach((t) => {
      const total = t.correct + t.wrong;
      if (total >= 2) {
        const accuracy = Math.round((t.correct / total) * 100);
        if (accuracy < 65 || t.wrong >= 2) {
          list.push({ ...t, accuracy });
        }
      }
    });

    return list.sort((a, b) => a.accuracy - b.accuracy || b.wrong - a.wrong).slice(0, 8);
  }, [questions, progressStore, chapters, subjects]);

  // Remedial Session Launcher
  const handleStartRemedialPractice = () => {
    if (!onStartSession) return;
    triggerHaptic("success");
    playClickSound();

    const perfStore = loadPerformanceStore();
    const diagnosis = diagnoseStudentWeaknesses(questions, chapters, subjects, progressStore, perfStore);
    const session = createRemedialTestSession(diagnosis, 15);

    if (session.questionIds.length > 0) {
      onStartSession(session);
    } else if (stats.wrongQuestions.length > 0) {
      const qIds = stats.wrongQuestions.slice(0, 15).map((q) => q.id);
      onStartSession({
        title: "Disha Smart Remedial Drill",
        source: "topic",
        questionIds: qIds,
      });
    }
  };

  // Launch a specific weak topic test
  const handlePracticeWeakTopic = (topicItem: typeof weakTopics[0]) => {
    if (!onStartSession) return;
    triggerHaptic("medium");
    playClickSound();

    const qIds = topicItem.questions.slice(0, 15).map((q) => q.id);
    onStartSession({
      title: `${topicItem.name} • Remedial Session`,
      source: "topic",
      topicId: topicItem.id,
      questionIds: qIds,
    });
  };

  const handleShareReport = () => {
    triggerHaptic("light");
    setShareData({
      title: `Disha PYQ Readiness Report: ${readiness.grade} (${readiness.score}%)`,
      text: `🎯 My Exam Readiness on Disha PYQ: ${readiness.score}% (Grade ${readiness.grade} • ${readiness.tier})\n🔥 Streak: ${streakDays} Days\n📊 Accuracy: ${stats.overallAccuracy}%\nPractice verified PYQs for RPSC, CET, REET!`,
      url: window.location.origin,
    });
  };

  // SVG Radial Circle geometry
  const circleRadius = 54;
  const circumference = 2 * Math.PI * circleRadius;
  const strokeDashoffset = circumference - (readiness.score / 100) * circumference;

  return (
    <div className="min-h-full bg-[#F8FAFC] dark:bg-[#130E26] pb-28 selection:bg-[#7045D8] selection:text-white">
      {/* ─── STICKY HEADER ────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 bg-white/95 dark:bg-[#130E26]/95 backdrop-blur-md border-b border-slate-200/80 dark:border-[#31275E] transition-colors">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                triggerHaptic("light");
                onNavigateTab("home");
              }}
              className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-[#241D48] text-slate-800 dark:text-slate-200 hover:border-[#7045D8] border border-slate-200 dark:border-[#31275E] flex items-center justify-center transition-all active:scale-95 cursor-pointer shrink-0"
              aria-label="Back to Home"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <h1 className="text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-tight leading-tight">
                Study Analytics
              </h1>
              <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 truncate max-w-[200px] sm:max-w-none">
                {studentName} • {targetExam}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleShareReport}
            className="px-3.5 py-2 rounded-xl bg-[#7045D8]/10 dark:bg-[#7045D8]/20 text-[#7045D8] dark:text-[#A78BFA] hover:bg-[#7045D8] hover:text-white flex items-center gap-1.5 text-xs font-black transition-all active:scale-95 cursor-pointer border border-[#7045D8]/20 dark:border-[#A78BFA]/30"
          >
            <Share2 className="w-3.5 h-3.5" />
            <span className="hidden xs:inline">Share</span>
          </button>
        </div>

        {/* ─── MINIMALIST SEGMENTED TABS ─────────────────────────────────────────── */}
        <div className="max-w-3xl mx-auto px-4 pb-2.5">
          <div className="grid grid-cols-3 gap-1 p-1 bg-slate-100 dark:bg-[#1B1536] rounded-xl border border-slate-200/80 dark:border-[#31275E]">
            {[
              { id: "overview", label: "Overview", icon: LayoutDashboard },
              { id: "weakness", label: `Weak Topics (${weakTopics.length})`, icon: Target },
              { id: "subjects", label: "Subjects", icon: BookOpen },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    triggerHaptic("light");
                    setActiveTab(tab.id as any);
                  }}
                  className={`py-2 px-2.5 rounded-lg text-xs font-black flex items-center justify-center gap-1.5 transition-all cursor-pointer truncate ${
                    isActive
                      ? "bg-[#7045D8] text-white shadow-xs"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </header>

      {/* ─── MAIN CONTENT ───────────────────────────────────────────────────────── */}
      <main className="max-w-3xl mx-auto px-4 py-4 space-y-4">
        {/* ========================================================================= */}
        {/* TAB 1: OVERVIEW                                                           */}
        {/* ========================================================================= */}
        {activeTab === "overview" && (
          <>
            {/* 1. HERO DISHA MASTERY RADIAL CARD */}
            <div className="bg-white dark:bg-[#1B1536] border border-slate-200/80 dark:border-[#31275E] rounded-3xl p-5 sm:p-6 shadow-xs relative overflow-hidden">
              <div className="absolute top-0 right-0 w-44 h-44 bg-gradient-to-bl from-[#7045D8]/15 via-transparent to-transparent rounded-full blur-2xl pointer-events-none" />

              <div className="flex flex-col sm:flex-row items-center sm:items-start justify-between gap-6 relative z-10">
                {/* Radial Gauge */}
                <div className="relative flex items-center justify-center shrink-0">
                  <svg className="w-32 h-32 -rotate-90" viewBox="0 0 128 128">
                    {/* Background Track */}
                    <circle
                      cx="64"
                      cy="64"
                      r={circleRadius}
                      className="stroke-slate-100 dark:stroke-[#241D48]"
                      strokeWidth="9"
                      fill="none"
                    />
                    {/* Progress Fill */}
                    <circle
                      cx="64"
                      cy="64"
                      r={circleRadius}
                      stroke="#7045D8"
                      strokeWidth="9"
                      strokeDasharray={circumference}
                      strokeDashoffset={strokeDashoffset}
                      strokeLinecap="round"
                      fill="none"
                      className="transition-all duration-1000 ease-out"
                    />
                  </svg>
                  {/* Gauge Center Text */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                    <span className="text-3xl font-black text-slate-900 dark:text-white tracking-tight leading-none">
                      {readiness.score}%
                    </span>
                    <span className="text-[10px] font-extrabold uppercase tracking-widest text-[#7045D8] dark:text-[#A78BFA] mt-1">
                      Grade {readiness.grade}
                    </span>
                  </div>
                </div>

                {/* Score Details & Status */}
                <div className="flex-1 text-center sm:text-left space-y-2.5">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black border border-[#7045D8]/20 dark:border-[#A78BFA]/30 bg-[#7045D8]/10 text-[#7045D8] dark:text-[#A78BFA]">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>{readiness.tier}</span>
                  </div>
                  <h2 className="text-lg font-black text-slate-900 dark:text-white leading-snug">
                    Exam Readiness Pulse
                  </h2>
                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
                    {readiness.note}
                  </p>
                  <div className="pt-1 flex flex-wrap items-center justify-center sm:justify-start gap-4 text-xs font-bold text-slate-500 dark:text-slate-400">
                    <span>Syllabus: <strong className="text-slate-900 dark:text-white">{stats.syllabusCoverage}%</strong></span>
                    <span>•</span>
                    <span>Negative Marks Lost: <strong className="text-rose-500">-{stats.negativeMarksLost}</strong></span>
                  </div>
                </div>
              </div>

              {/* 4 Minimalist Integrated Stat Badges */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-5 mt-5 border-t border-slate-100 dark:border-[#31275E]">
                <div className="p-3 rounded-2xl bg-slate-50 dark:bg-[#241D48]/50 border border-slate-200/60 dark:border-[#31275E] text-center">
                  <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block">Overall Accuracy</span>
                  <span className="text-lg font-black text-[#7045D8] dark:text-[#A78BFA]">{stats.overallAccuracy}%</span>
                </div>
                <div className="p-3 rounded-2xl bg-slate-50 dark:bg-[#241D48]/50 border border-slate-200/60 dark:border-[#31275E] text-center">
                  <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block">Questions Solved</span>
                  <span className="text-lg font-black text-slate-900 dark:text-white">{stats.totalPracticed}</span>
                </div>
                <div className="p-3 rounded-2xl bg-slate-50 dark:bg-[#241D48]/50 border border-slate-200/60 dark:border-[#31275E] text-center">
                  <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block">Active Streak</span>
                  <span className="text-lg font-black text-amber-500 flex items-center justify-center gap-1">
                    <Flame className="w-4 h-4 fill-amber-500 text-amber-500" />
                    {streakDays}d
                  </span>
                </div>
                <div className="p-3 rounded-2xl bg-slate-50 dark:bg-[#241D48]/50 border border-slate-200/60 dark:border-[#31275E] text-center">
                  <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block">Mastered (Stage 4)</span>
                  <span className="text-lg font-black text-emerald-500">{stats.masteredCount}</span>
                </div>
              </div>
            </div>

            {/* 2. WEEKLY 7-DAY CONSISTENCY GRAPH */}
            <div className="bg-white dark:bg-[#1B1536] border border-slate-200/80 dark:border-[#31275E] rounded-3xl p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                    <Activity className="w-4 h-4 text-[#7045D8]" />
                    <span>7-Day Consistency</span>
                  </h3>
                  <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                    Daily questions answered this week
                  </p>
                </div>
                <span className="text-xs font-mono font-bold text-[#7045D8] dark:text-[#A78BFA] px-2.5 py-1 rounded-lg bg-[#7045D8]/10 dark:bg-[#7045D8]/20">
                  {last7DaysData.reduce((acc, d) => acc + d.total, 0)} Total
                </span>
              </div>

              {/* Minimalist Visual Bars */}
              <div className="grid grid-cols-7 gap-2 pt-2 items-end h-32">
                {last7DaysData.map((d, idx) => {
                  const maxCount = Math.max(...last7DaysData.map((item) => item.total), 20);
                  const heightPercent = Math.max(Math.round((d.total / maxCount) * 100), 8);
                  const isToday = d.date === todayStr;

                  return (
                    <div key={idx} className="flex flex-col items-center gap-1.5 h-full justify-end group">
                      <span className="text-[10px] font-bold text-slate-400 group-hover:text-slate-900 dark:group-hover:text-white transition-colors">
                        {d.total > 0 ? d.total : "-"}
                      </span>
                      <div className="w-full bg-slate-100 dark:bg-[#241D48] rounded-xl overflow-hidden h-20 flex items-end">
                        <div
                          style={{ height: `${heightPercent}%` }}
                          className={`w-full rounded-xl transition-all duration-500 ${
                            isToday
                              ? "bg-gradient-to-t from-[#7045D8] to-[#A78BFA] shadow-xs"
                              : d.total > 0
                              ? "bg-[#7045D8]/60 dark:bg-[#7045D8]/50 group-hover:bg-[#7045D8]"
                              : "bg-slate-200/50 dark:bg-[#31275E]/40"
                          }`}
                        />
                      </div>
                      <span
                        className={`text-[10px] font-black uppercase ${
                          isToday
                            ? "text-[#7045D8] dark:text-[#A78BFA]"
                            : "text-slate-400 dark:text-slate-500"
                        }`}
                      >
                        {d.date.slice(5)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 3. SPACED REPETITION (LEITNER 4-STAGE TRACKER) */}
            <div className="bg-white dark:bg-[#1B1536] border border-slate-200/80 dark:border-[#31275E] rounded-3xl p-5 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                    <Brain className="w-4 h-4 text-[#7045D8]" />
                    <span>Spaced Repetition Memory Stages</span>
                  </h3>
                  <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                    Scientific Leitner memory retention cycle
                  </p>
                </div>
                <span className="text-xs font-bold text-slate-500">
                  {stats.dueQuestions.length > 0 ? `${stats.dueQuestions.length} Due Today` : "All Caught Up"}
                </span>
              </div>

              <div className="grid grid-cols-4 gap-2 pt-1">
                {[
                  { stage: 1, label: "Day 1-3", count: stats.stageCounts[1] || 0, desc: "New / Reinforce" },
                  { stage: 2, label: "Day 7", count: stats.stageCounts[2] || 0, desc: "Recall Cycle" },
                  { stage: 3, label: "Day 21", count: stats.stageCounts[3] || 0, desc: "Retention" },
                  { stage: 4, label: "Day 45+", count: stats.stageCounts[4] || 0, desc: "Permanent" },
                ].map((s) => (
                  <div
                    key={s.stage}
                    className="p-2.5 rounded-2xl bg-slate-50 dark:bg-[#241D48]/40 border border-slate-200/60 dark:border-[#31275E] text-center space-y-1"
                  >
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#7045D8] dark:text-[#A78BFA] block">
                      {s.label}
                    </span>
                    <span className="text-base font-black text-slate-900 dark:text-white block">
                      {s.count}
                    </span>
                    <span className="text-[9px] text-slate-500 dark:text-slate-400 block truncate">
                      {s.desc}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* QUICK ACTION BUTTON */}
            {weakTopics.length > 0 && (
              <button
                type="button"
                onClick={handleStartRemedialPractice}
                className="w-full py-3.5 px-4 rounded-2xl bg-[#7045D8] hover:bg-[#5B32BF] text-white font-black text-sm flex items-center justify-center gap-2 shadow-md shadow-[#7045D8]/25 transition-all active:scale-[0.99] cursor-pointer"
              >
                <Zap className="w-4 h-4 text-amber-300" />
                <span>Start Smart Remedial Drill ({Math.min(stats.wrongQuestions.length || 15, 15)} Questions)</span>
                <ArrowRight className="w-4 h-4 ml-auto" />
              </button>
            )}
          </>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: WEAK TOPICS RADAR                                                  */}
        {/* ========================================================================= */}
        {activeTab === "weakness" && (
          <div className="space-y-3">
            {/* Remedial Action Card */}
            <div className="p-4 rounded-2xl bg-gradient-to-r from-[#7045D8]/10 via-[#7045D8]/5 to-transparent border border-[#7045D8]/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span className="text-xs font-black text-[#7045D8] dark:text-[#A78BFA] flex items-center gap-1.5 uppercase tracking-wide">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                  Targeted Fix Required
                </span>
                <p className="text-xs text-slate-600 dark:text-slate-300 font-medium mt-0.5">
                  We identified {weakTopics.length} topics where accuracy is below 65%.
                </p>
              </div>
              <button
                type="button"
                onClick={handleStartRemedialPractice}
                className="px-4 py-2 rounded-xl bg-[#7045D8] hover:bg-[#5B32BF] text-white text-xs font-black flex items-center gap-1.5 shrink-0 transition-all active:scale-95 cursor-pointer shadow-xs"
              >
                <Zap className="w-3.5 h-3.5 text-amber-300" />
                <span>Fix All Mistakes</span>
              </button>
            </div>

            {/* Weak Topics List */}
            {weakTopics.length === 0 ? (
              <div className="bg-white dark:bg-[#1B1536] border border-slate-200/80 dark:border-[#31275E] rounded-3xl p-8 text-center space-y-2">
                <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
                <h3 className="text-base font-black text-slate-900 dark:text-white">Zero Critical Weaknesses!</h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  Your accuracy across all tested topics is above 65%. Continue daily test series drills.
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {weakTopics.map((topic) => (
                  <div
                    key={topic.id}
                    className="p-4 rounded-2xl bg-white dark:bg-[#1B1536] border border-slate-200/80 dark:border-[#31275E] shadow-2xs hover:border-[#7045D8] transition-all flex items-center justify-between gap-3 group"
                  >
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider truncate">
                          {topic.subjectName} • {topic.chapterName}
                        </span>
                      </div>
                      <h4 className="text-xs sm:text-sm font-black text-slate-900 dark:text-white truncate">
                        {topic.name}
                      </h4>
                      <div className="flex items-center gap-3 text-xs font-bold">
                        <span className="text-rose-500">
                          {topic.accuracy}% Accuracy
                        </span>
                        <span className="text-slate-300 dark:text-slate-700">•</span>
                        <span className="text-slate-500 dark:text-slate-400">
                          {topic.wrong} Wrong / {topic.attempted} Attempted
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handlePracticeWeakTopic(topic)}
                      className="px-3.5 py-2 rounded-xl bg-[#7045D8]/10 dark:bg-[#7045D8]/20 text-[#7045D8] dark:text-[#A78BFA] hover:bg-[#7045D8] hover:text-white text-xs font-black shrink-0 transition-all active:scale-95 cursor-pointer flex items-center gap-1.5"
                    >
                      <span>Drill</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 3: SUBJECT MASTERY                                                    */}
        {/* ========================================================================= */}
        {activeTab === "subjects" && (
          <div className="space-y-3">
            {/* Filter Pills */}
            <div className="flex items-center justify-between pb-1">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                {filteredSubjects.length} Subjects Evaluated
              </span>
              <div className="flex items-center gap-1 p-0.5 rounded-lg bg-slate-100 dark:bg-[#1B1536] border border-slate-200/80 dark:border-[#31275E]">
                {(["all", "weak", "strong"] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => {
                      triggerHaptic("light");
                      setSubjectFilter(mode);
                    }}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-black uppercase tracking-wider transition-colors cursor-pointer ${
                      subjectFilter === mode
                        ? "bg-[#7045D8] text-white"
                        : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
                    }`}
                  >
                    {mode}
                  </button>
                ))}
              </div>
            </div>

            {/* Subject Cards */}
            <div className="space-y-2.5">
              {filteredSubjects.map((sub) => (
                <div
                  key={sub.subject.id}
                  className="p-4 rounded-2xl bg-white dark:bg-[#1B1536] border border-slate-200/80 dark:border-[#31275E] shadow-2xs space-y-2.5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h4 className="text-xs sm:text-sm font-black text-slate-900 dark:text-white">
                        {sub.subject.name || (sub.subject as any).hindiName}
                      </h4>
                      <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                        {sub.attempted} of {sub.totalQuestions} questions practiced ({sub.coverage}% coverage)
                      </p>
                    </div>
                    <span
                      className={`text-xs font-black px-2.5 py-1 rounded-lg ${
                        sub.accuracy >= 75
                          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                          : sub.accuracy >= 50
                          ? "bg-[#7045D8]/10 text-[#7045D8] dark:text-[#A78BFA]"
                          : "bg-rose-500/10 text-rose-600 dark:text-rose-400"
                      }`}
                    >
                      {sub.accuracy}% Accuracy
                    </span>
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full bg-slate-100 dark:bg-[#241D48] h-2 rounded-full overflow-hidden">
                    <div
                      style={{ width: `${Math.min(sub.accuracy, 100)}%` }}
                      className="bg-gradient-to-r from-[#7045D8] to-[#A78BFA] h-full rounded-full transition-all duration-500"
                    />
                  </div>

                  <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 dark:text-slate-400 pt-0.5">
                    <span className="text-emerald-600 dark:text-emerald-400">{sub.correct} Correct</span>
                    <span className="text-rose-500">{sub.wrong} Wrong</span>
                    <button
                      type="button"
                      onClick={() => onNavigateTab("topics")}
                      className="text-[#7045D8] dark:text-[#A78BFA] font-black hover:underline cursor-pointer ml-auto"
                    >
                      Practice Subject →
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Share Modal */}
      {shareData && (
        <ShareModal
          isOpen={Boolean(shareData)}
          onClose={() => setShareData(null)}
          data={shareData}
        />
      )}
    </div>
  );
};
