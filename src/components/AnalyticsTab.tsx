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
  TrendingDown,
  Info,
  Check,
  Copy,
  LayoutDashboard,
  Layers,
} from "lucide-react";
import { StudyAnalyticsChart } from "./StudyAnalyticsChart";
import { getLast7DaysStudyData, loadStudyHistoryFromStorage } from "../utils/storage";
import { isDueToday, getTodayDateString } from "../utils/revision";
import ShareModal, { ShareData } from "./ShareModal";
import { triggerHaptic, playClickSound } from "../utils/audioFeedback";
import { loadUserProfile } from "../utils/userProfileStorage";

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

interface WeakTopicItem {
  id: string;
  name: string;
  chapterName: string;
  subjectName: string;
  attempted: number;
  correct: number;
  wrong: number;
  accuracy: number;
  status: "critical" | "warning" | "mastered";
  weakReason: string;
  wrongQuestions: Question[];
  allQuestions: Question[];
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
  const [shareData, setShareData] = useState<ShareData | null>(null);
  const [copiedShare, setCopiedShare] = useState(false);

  // Clean Navigation Tabs for mobile users:
  // "overview" | "weakness" | "subjects" | "trends" | "all"
  const [activeSection, setActiveSection] = useState<"overview" | "weakness" | "subjects" | "trends" | "all">("overview");

  // Filter for Subject Mastery
  const [subjectFilter, setSubjectFilter] = useState<"all" | "weak" | "strong">("all");

  // Filter for Weakness Radar Topics
  const [radarFilter, setRadarFilter] = useState<"critical" | "warning" | "mastered" | "all">("critical");

  const currentUserProfile = userProfile || loadUserProfile();
  const studentName = currentUserProfile?.full_name || currentUserProfile?.name || "Aspirant";
  const targetExam = settings.selectedExam || "Rajasthan Competitive Exam (RPSC / CET / Patwar / REET)";

  // 1. Overall Statistics Calculation
  const stats = useMemo(() => {
    let totalPracticed = 0;
    let totalCorrectCount = 0;
    let totalWrongCount = 0;
    const stageCounts: { [key: number]: number } = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0 };
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

    // 1/3rd Negative Marking Penalty
    const negativeMarksLost = Number((totalWrongCount * 0.33).toFixed(2));

    // Leitner Stage 3 & 4 (21+ days retention) considered Mastered
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

  // 2. Compute Consecutive Study Streak
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

  // 3. 7-Day Study Chart Data
  const last7DaysData = useMemo(() => {
    const history = studyHistory || loadStudyHistoryFromStorage();
    return getLast7DaysStudyData(history, progressStore, todayStr);
  }, [studyHistory, progressStore, todayStr]);

  // 4. Exam Readiness Index & Grade
  const readiness = useMemo(() => {
    const accWeight = stats.overallAccuracy * 0.5;
    const covWeight = Math.min(stats.syllabusCoverage, 100) * 0.35;
    const streakBonus = Math.min(streakDays, 7) * 2.1;
    const score = Math.min(100, Math.max(0, Math.round(accWeight + covWeight + streakBonus)));

    let tier = "Foundation";
    let tierHindi = "Early Foundation Track";
    let grade = "D";
    let color = "text-[#800020] dark:text-[#F47B20]";
    let bg = "bg-[#800020]/10 dark:bg-[#F47B20]/15";
    let border = "border-[#800020]/20 dark:border-[#F47B20]/25";
    let note = "Daily practice will quickly build your speed and stop negative marks.";

    if (score >= 80) {
      tier = "Ranker's League";
      tierHindi = "Grade A+ • Top Rank Track";
      grade = "A+";
      color = "text-emerald-600 dark:text-emerald-400";
      bg = "bg-emerald-500/10 dark:bg-emerald-500/20";
      border = "border-emerald-500/30";
      note = "Exceptional precision! Your accuracy and retention align with high cutoff ranks.";
    } else if (score >= 65) {
      tier = "Competitive";
      tierHindi = "Grade A • Strong Standing";
      grade = "A";
      color = "text-[#800020] dark:text-[#F47B20]";
      bg = "bg-[#800020]/10 dark:bg-[#F47B20]/15";
      border = "border-[#800020]/30 dark:border-[#F47B20]/30";
      note = "Solid performance. Eliminate negative guessing in weak topics to crack the top 100.";
    } else if (score >= 45) {
      tier = "Developing";
      tierHindi = "Grade B • Steady Progress";
      grade = "B";
      color = "text-[#C99A45] dark:text-[#E5BC6B]";
      bg = "bg-[#C99A45]/15";
      border = "border-[#C99A45]/30";
      note = "Review mistakes daily and use spaced memory tests to retain difficult concepts.";
    } else if (score >= 30) {
      tier = "Needs Polish";
      tierHindi = "Grade C • High Negative Risk";
      grade = "C";
      color = "text-rose-600 dark:text-rose-400";
      bg = "bg-rose-500/10 dark:bg-rose-500/20";
      border = "border-rose-500/30";
      note = "High negative marks bleed your score. Skip doubtful questions in mock drills.";
    }

    return { score, tier, tierHindi, grade, color, bg, border, note };
  }, [stats, streakDays]);

  // 5. Subject-Wise Metrics
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

  const filteredSubjects = useMemo(() => {
    if (subjectFilter === "weak") {
      return subjectMetrics.filter((s) => s.isWeak || (s.attempted > 0 && s.accuracy < 70));
    }
    if (subjectFilter === "strong") {
      return subjectMetrics.filter((s) => s.isStrong || s.accuracy >= 75);
    }
    return subjectMetrics;
  }, [subjectMetrics, subjectFilter]);

  // 6. Topic-Level Weakness Radar & Diagnostic Matrix
  const topicDiagnostics = useMemo(() => {
    const chapterMap = new Map<string, Chapter>(chapters.map((c) => [c.id, c]));
    const subjectMap = new Map<string, Subject>(subjects.map((s) => [s.id, s]));

    const bucket = new Map<string, { name: string; chapterName: string; subjectName: string; questions: Question[] }>();

    chapters.forEach((ch) => {
      const sub = subjectMap.get(ch.subjectId || "");
      const sName = sub ? sub.name || (sub as any).hindiName || "" : "";
      const chName = ch.title || (ch as any).hindiTitle || "";

      if (!bucket.has(ch.id)) {
        bucket.set(ch.id, {
          name: chName,
          chapterName: chName,
          subjectName: sName,
          questions: [],
        });
      }

      (ch.topics || []).forEach((t) => {
        if (t && t.id) {
          bucket.set(t.id, {
            name: t.title || (t as any).name || chName,
            chapterName: chName,
            subjectName: sName,
            questions: [],
          });
        }
      });
    });

    questions.forEach((q) => {
      if (q.topicId && bucket.has(q.topicId)) {
        bucket.get(q.topicId)!.questions.push(q);
      } else if (q.chapterId && bucket.has(q.chapterId)) {
        bucket.get(q.chapterId)!.questions.push(q);
      }
    });

    const items: WeakTopicItem[] = [];

    bucket.forEach((val, id) => {
      if (val.questions.length === 0) return;

      let attempted = 0;
      let correct = 0;
      let wrong = 0;
      const wrongQs: Question[] = [];

      val.questions.forEach((q) => {
        const p = progressStore[q.id];
        if (p && p.status !== "unattempted") {
          attempted++;
          if (p.status === "correct") correct++;
          if (p.status === "wrong") {
            wrong++;
            wrongQs.push(q);
          }
        }
      });

      if (attempted === 0) return;

      const totalAttempts = correct + wrong;
      const accuracy = totalAttempts > 0 ? Math.round((correct / totalAttempts) * 100) : 0;

      let status: WeakTopicItem["status"] = "mastered";
      let weakReason = "Strong grasp • Keep maintaining consistency";

      if (accuracy < 50 || wrong >= 3) {
        status = "critical";
        if (accuracy < 30) {
          weakReason = "Severe concept gap • Core revision required";
        } else if (wrong >= 4) {
          weakReason = "Frequent guessing mistakes • Heavy negative marking penalty";
        } else {
          weakReason = "Confusion & silly errors • High yield booster drill needed";
        }
      } else if (accuracy < 75) {
        status = "warning";
        weakReason = "Moderate accuracy • Uncertainty on deeper PYQ questions";
      } else {
        status = "mastered";
        weakReason = "High accuracy • Strong concept retention (75%+ score)";
      }

      items.push({
        id,
        name: val.name,
        chapterName: val.chapterName,
        subjectName: val.subjectName,
        attempted,
        correct,
        wrong,
        accuracy,
        status,
        weakReason,
        wrongQuestions: wrongQs,
        allQuestions: val.questions,
      });
    });

    items.sort((a, b) => {
      const order = { critical: 0, warning: 1, mastered: 2 };
      if (order[a.status] !== order[b.status]) {
        return order[a.status] - order[b.status];
      }
      return b.wrong - a.wrong;
    });

    return items;
  }, [questions, chapters, subjects, progressStore]);

  const criticalWeakList = useMemo(() => topicDiagnostics.filter((t) => t.status === "critical"), [topicDiagnostics]);
  const warningList = useMemo(() => topicDiagnostics.filter((t) => t.status === "warning"), [topicDiagnostics]);
  const masteredList = useMemo(() => topicDiagnostics.filter((t) => t.status === "mastered"), [topicDiagnostics]);

  const displayedRadarList = useMemo(() => {
    if (radarFilter === "critical") return criticalWeakList;
    if (radarFilter === "warning") return warningList;
    if (radarFilter === "mastered") return masteredList;
    return topicDiagnostics;
  }, [radarFilter, criticalWeakList, warningList, masteredList, topicDiagnostics]);

  // 7. Leitner Spaced Repetition 5-Stage System Info
  const leitnerStagesInfo = [
    { stage: 0, interval: "1-3 Days", label: "Learning", color: "bg-[#991B1B]", text: "text-[#991B1B]" },
    { stage: 1, interval: "7 Days", label: "Reviewing", color: "bg-[#F47B20]", text: "text-[#F47B20]" },
    { stage: 2, interval: "21 Days", label: "Reinforcing", color: "bg-[#C99A45]", text: "text-[#C99A45]" },
    { stage: 3, interval: "45 Days", label: "Retaining", color: "bg-[#800020]", text: "text-[#800020]" },
    { stage: 4, interval: "75+ Days", label: "Mastered", color: "bg-emerald-500", text: "text-emerald-500" },
  ];

  // 8. 1-Click AI Weakness Booster Test Trigger
  const handleStartBoosterTest = () => {
    if (!onStartSession) return;
    triggerHaptic("success");
    playClickSound();

    const poolMap = new Map<string, Question>();
    stats.wrongQuestions.forEach((q) => poolMap.set(q.id, q));

    criticalWeakList.forEach((t) => {
      t.allQuestions.forEach((q) => {
        if (!poolMap.has(q.id)) poolMap.set(q.id, q);
      });
    });

    if (poolMap.size < 20) {
      warningList.forEach((t) => {
        t.allQuestions.forEach((q) => {
          if (!poolMap.has(q.id)) poolMap.set(q.id, q);
        });
      });
    }

    if (poolMap.size < 20) {
      questions.forEach((q) => {
        if (!poolMap.has(q.id)) poolMap.set(q.id, q);
      });
    }

    const selected = Array.from(poolMap.values()).slice(0, 20);

    onStartSession({
      title: "🔥 AI Weakness Booster Test",
      subtitle: `${selected.length} Curated Questions from Top Weak Areas • 1/3rd Negative Marking`,
      questionIds: selected.map((q) => q.id),
      extraQuestions: selected,
      source: "custom-smart",
      testType: "custom_smart",
      isExamSimulation: false,
    });
  };

  // 9. Start Topic Drill
  const handleStartTopicDrill = (item: WeakTopicItem) => {
    if (!onStartSession) return;
    triggerHaptic("light");
    playClickSound();

    const selected = (item.wrongQuestions.length > 0 ? item.wrongQuestions : item.allQuestions).slice(0, 15);

    onStartSession({
      title: `${item.name} — AI Remedial Practice`,
      subtitle: `${item.chapterName} • 15 Targeted Questions`,
      questionIds: selected.map((q) => q.id),
      extraQuestions: selected,
      source: "custom-smart",
      testType: "topic",
      isExamSimulation: false,
    });
  };

  // 10. Start Subject Practice
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

  // 11. Share Performance Report (Native Web Share & Clipboard)
  const handleShareReport = async () => {
    triggerHaptic("light");
    playClickSound();

    const topWeakText =
      criticalWeakList.length > 0
        ? criticalWeakList.slice(0, 3).map((w, i) => `${i + 1}. ${w.name} (${w.accuracy}% Acc)`).join(", ")
        : "None (Consistent balance)";

    const reportText = `📊 *DISHA 20-20 Performance Report & Analytics*
━━━━━━━━━━━━━━━━━━
👤 Aspirant: ${studentName}
🎯 Target Exam: ${targetExam}
📅 Date: ${todayStr}

🏆 *Exam Readiness Score:* ${readiness.score}/100 [${readiness.tier}]
🎯 Overall Accuracy: ${stats.overallAccuracy}%
📚 Total Practiced: ${stats.totalPracticed} Qs (Coverage: ${stats.syllabusCoverage}%)
🧠 Mastered in Memory: ${stats.masteredCount} Qs
⚠️ Negative Penalty: -${stats.negativeMarksLost} Marks (${stats.totalWrongCount} Mistakes)
🔥 Study Streak: ${streakDays} Days

🔴 Priority Focus: ${topWeakText}

📱 Test your preparation on DISHA 20-20:
https://disha2020.in
━━━━━━━━━━━━━━━━━━`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: `DISHA 20-20 Performance Report: ${readiness.score}% (${readiness.tier})`,
          text: reportText,
        });
        return;
      } catch (err) {
        // Fallback to clipboard
      }
    }

    try {
      await navigator.clipboard.writeText(reportText);
      setCopiedShare(true);
      setTimeout(() => setCopiedShare(false), 2500);
    } catch {
      // Fallback
    }

    setShareData({
      title: `DISHA 20-20 Performance Report: ${readiness.score}%`,
      text: reportText,
      url: typeof window !== "undefined" ? window.location.origin : "https://disha2020.in",
      category: "Performance Report",
    });
  };

  return (
    <div
      id="analytics-tab-container"
      className="min-h-full bg-[#FFF9EF] dark:bg-[#171923] pb-32 overflow-y-auto selection:bg-[#800020] selection:text-white"
    >
      {/* 1. STICKY TOP APP BAR */}
      <header className="sticky top-0 z-30 bg-[#FFF9EF]/95 dark:bg-[#171923]/95 backdrop-blur-md border-b border-[#E8D9C0] dark:border-[#31374A] px-3.5 sm:px-4 pt-[env(safe-area-inset-top,0px)] py-2.5 shadow-xs transition-colors">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => {
                triggerHaptic("light");
                onNavigateTab("home");
              }}
              className="w-10 h-10 rounded-2xl bg-white dark:bg-[#1F2330] text-[#171923] dark:text-[#FFF9EF] hover:border-[#800020] border border-[#E8D9C0] dark:border-[#31374A] flex items-center justify-center transition-all active:scale-90 cursor-pointer shrink-0 shadow-2xs"
              aria-label="Back to Home"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="min-w-0">
              <h1 className="text-base sm:text-lg font-black text-[#171923] dark:text-[#FFF9EF] tracking-tight leading-tight truncate">
                Performance Report
              </h1>
              <p className="text-[10px] font-bold text-[#787D91] dark:text-[#929AB0] tracking-wide truncate">
                Performance Report & Analytics • DISHA 20-20
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleShareReport}
              className="h-10 px-3.5 rounded-2xl bg-[#800020]/10 dark:bg-[#F47B20]/15 text-[#800020] dark:text-[#F47B20] hover:bg-[#800020] hover:text-white dark:hover:bg-[#F47B20] dark:hover:text-white flex items-center gap-1.5 text-xs font-black transition-all active:scale-95 cursor-pointer border border-[#800020]/20 dark:border-[#F47B20]/30 shadow-2xs"
              aria-label="Share Report"
            >
              {copiedShare ? <Check className="w-4 h-4 text-emerald-600" /> : <Share2 className="w-4 h-4" />}
              <span className="hidden xs:inline">{copiedShare ? "Copied!" : "Share"}</span>
            </button>
          </div>
        </div>
      </header>

      <main className="p-4 sm:p-5 max-w-4xl mx-auto w-full space-y-4 sm:space-y-5">
        {/* 2. SEGMENTED ARRANGEMENT NAVIGATION BAR (Clean, Touch-Friendly, Horizontal) */}
        <div className="w-full overflow-x-auto no-scrollbar py-1">
          <div className="flex items-center gap-1.5 p-1 bg-[#F7EFE2] dark:bg-[#1F2330] rounded-2xl border border-[#E8D9C0] dark:border-[#31374A] min-w-max mx-auto">
            {[
              { id: "overview", label: "Overview", icon: LayoutDashboard },
              { id: "weakness", label: `Weakness Radar (${criticalWeakList.length})`, icon: Target },
              { id: "subjects", label: "Subject Mastery", icon: BookOpen },
              { id: "trends", label: "Retention & Trends", icon: TrendingUp },
              { id: "all", label: "All Sections", icon: Layers },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeSection === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    triggerHaptic("light");
                    setActiveSection(tab.id as any);
                  }}
                  className={`px-3.5 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
                    isActive
                      ? "bg-[#800020] text-white shadow-xs"
                      : "text-[#52576A] dark:text-[#CBD2E1] hover:text-[#171923] dark:hover:text-white"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5 shrink-0" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 3. EXECUTIVE HERO SCORECARD (Visible on Overview & All) */}
        {(activeSection === "overview" || activeSection === "all") && (
          <section className="bg-white dark:bg-[#1F2330] border border-[#E8D9C0] dark:border-[#31374A] rounded-3xl p-5 shadow-2xs relative overflow-hidden space-y-4">
            {/* Ambient Background Accent */}
            <div className="absolute top-0 right-0 w-48 h-48 bg-gradient-to-bl from-[#800020]/10 via-[#F47B20]/5 to-transparent rounded-full blur-2xl pointer-events-none" />

            {/* Candidate Metadata Bar */}
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[#E8D9C0]/80 dark:border-[#31374A] text-[11px] relative z-10">
              <div className="flex items-center gap-2 min-w-0">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                <span className="font-extrabold text-[#171923] dark:text-[#FFF9EF] truncate">
                  {studentName}
                </span>
                <span className="text-[#787D91] dark:text-[#929AB0] hidden xs:inline">•</span>
                <span className="text-[#52576A] dark:text-[#CBD2E1] truncate hidden xs:inline">
                  {targetExam}
                </span>
              </div>
              <div className="text-[10px] font-mono font-bold text-[#787D91] dark:text-[#929AB0]">
                Audit: {todayStr}
              </div>
            </div>

            {/* Readiness Index & Ring Gauge */}
            <div className="flex items-start justify-between gap-4 relative z-10">
              <div className="min-w-0 flex-1">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-wider bg-[#F7EFE2] dark:bg-[#252A3A] text-[#800020] dark:text-[#F47B20] border border-[#E8D9C0] dark:border-[#31374A] mb-2">
                  <Target className="w-3 h-3" />
                  <span>Exam Readiness Index</span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl sm:text-4xl font-black text-[#171923] dark:text-[#FFF9EF] tracking-tight font-mono tabular-nums">
                    {readiness.score}
                  </span>
                  <span className="text-sm font-extrabold text-[#787D91] dark:text-[#929AB0]">/ 100</span>
                  <span className={`px-2 py-0.5 rounded-md text-[10px] font-black border ml-1 ${readiness.bg} ${readiness.color} ${readiness.border}`}>
                    Grade {readiness.grade}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`text-xs font-black ${readiness.color}`}>
                    {readiness.tier}
                  </span>
                  <span className="text-[#E8D9C0] dark:text-[#31374A]">•</span>
                  <span className="text-xs font-bold text-[#52576A] dark:text-[#CBD2E1]">
                    {readiness.tierHindi}
                  </span>
                </div>
              </div>

              {/* Circular Gauge */}
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
                        : readiness.score >= 65
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

            {/* Note */}
            <p className="text-[11px] text-[#52576A] dark:text-[#CBD2E1] font-medium pt-2 border-t border-[#E8D9C0]/80 dark:border-[#31374A] relative z-10">
              {readiness.note}
            </p>

            {/* 4 Essential Mobile KPI Cards (2x2 Grid) */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1 relative z-10">
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
                  {stats.syllabusCoverage}% of Syllabus
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
                  Stage 3 & 4 Retention
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

            {/* Negative Marking Damage Alert Box */}
            <div className="p-3.5 rounded-2xl bg-rose-500/10 dark:bg-rose-500/15 border border-rose-500/25 dark:border-rose-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs relative z-10">
              <div className="flex items-start gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-rose-500/20 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0 mt-0.5">
                  <TrendingDown className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-black text-rose-600 dark:text-rose-400">
                      1/3rd Negative Marking Penalty:
                    </span>
                    <span className="font-mono font-black text-rose-600 dark:text-rose-400 tabular-nums">
                      -{stats.negativeMarksLost} Marks Lost
                    </span>
                  </div>
                  <p className="text-[11px] text-[#52576A] dark:text-[#CBD2E1] mt-0.5 leading-snug">
                    {stats.negativeMarksLost > 0 ? (
                      <>
                        You got {stats.totalWrongCount} questions wrong. Leaving uncertain guesses blank preserves these marks, boosting your rank by hundreds of spots!
                      </>
                    ) : (
                      <>
                        Zero negative marking bleed! Keep up your disciplined question selection.
                      </>
                    )}
                  </p>
                </div>
              </div>

              {stats.wrongQuestions.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic("light");
                    playClickSound();
                    onNavigateTab("wrong");
                  }}
                  className="px-3 py-1.5 rounded-xl bg-white dark:bg-[#1F2330] text-rose-600 dark:text-rose-400 border border-rose-500/30 hover:bg-rose-600 hover:text-white dark:hover:bg-rose-600 dark:hover:text-white font-black text-[11px] transition-all active:scale-95 cursor-pointer shrink-0 self-start sm:self-auto flex items-center gap-1 shadow-2xs"
                >
                  <span>Review {stats.wrongQuestions.length} Mistakes</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </section>
        )}

        {/* 4. 1-CLICK REMEDIAL & HIGH PRIORITY ACTIONS (Visible on Overview & All) */}
        {(activeSection === "overview" || activeSection === "all") && (
          <section className="space-y-2.5">
            <div className="flex items-center justify-between px-1">
              <h3 className="text-xs font-black uppercase tracking-wider text-[#171923] dark:text-[#FFF9EF] flex items-center gap-1.5">
                <Zap className="w-4 h-4 text-[#F47B20] fill-[#F47B20]" />
                <span>Today's Priority Boosters</span>
              </h3>
            </div>

            {/* Hero AI Weakness Booster Test Card */}
            <div className="bg-gradient-to-r from-[#800020] via-[#5E0017] to-[#171923] rounded-3xl p-4 sm:p-5 text-white shadow-lg shadow-[#800020]/20 border border-[#C99A45]/30 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-48 h-48 bg-gradient-to-bl from-[#F47B20]/25 to-transparent rounded-full blur-2xl pointer-events-none" />

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
                <div className="max-w-lg">
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-wider bg-white/15 text-white border border-white/20 mb-2">
                    <Sparkles className="w-3.5 h-3.5 text-[#F47B20]" />
                    <span>Targeted Remedial Drill</span>
                  </div>
                  <h4 className="text-base sm:text-lg font-black tracking-tight leading-snug">
                    ⚡ Start AI Weakness Booster Test (20 Qs)
                  </h4>
                  <p className="text-xs text-white/80 font-medium mt-1 leading-relaxed">
                    AI has hand-picked 20 high-yield questions from your incorrect answers ({stats.wrongQuestions.length} wrong) and top weak chapters. Score 80%+ to eliminate weak spots!
                  </p>
                </div>

                <div className="shrink-0">
                  <button
                    type="button"
                    onClick={handleStartBoosterTest}
                    className="w-full sm:w-auto h-12 px-5 rounded-2xl bg-gradient-to-r from-[#F47B20] to-[#E05A10] hover:brightness-110 text-white font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-md shadow-[#F47B20]/30 active:scale-95 transition-all cursor-pointer border border-amber-300/40"
                  >
                    <Flame className="w-4 h-4 fill-white text-white animate-pulse" />
                    <span>Start Booster Test</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Quick 2-Grid Secondary Actions */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {/* Due Spaced Revision */}
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
                        Spaced Memory Revision
                      </h4>
                      <span className="px-1.5 py-0.2 rounded-md bg-[#800020]/10 dark:bg-[#F47B20]/15 text-[#800020] dark:text-[#F47B20] font-mono text-[9px] font-black tabular-nums">
                        {stats.dueQuestions.length} Due
                      </span>
                    </div>
                    <p className="text-[10px] text-[#52576A] dark:text-[#CBD2E1] truncate mt-0.5">
                      Ebbinghaus forgetting curve review
                    </p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-[#787D91] group-hover:translate-x-1 transition-transform shrink-0" />
              </button>

              {/* Browse All Chapters */}
              <button
                type="button"
                onClick={() => {
                  triggerHaptic("light");
                  playClickSound();
                  onNavigateTab("topics");
                }}
                className="bg-white dark:bg-[#1F2330] border border-[#E8D9C0] dark:border-[#31374A] hover:border-[#800020] dark:hover:border-[#F47B20] p-3.5 rounded-2xl flex items-center justify-between text-left transition-all active:scale-[0.98] cursor-pointer group shadow-2xs"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-[#F7EFE2] dark:bg-[#252A3A] text-[#171923] dark:text-[#FFF9EF] flex items-center justify-center shrink-0">
                    <BookOpen className="w-5 h-5 group-hover:scale-110 transition-transform" />
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-xs font-black text-[#171923] dark:text-[#FFF9EF] truncate">
                      Practice New Chapters
                    </h4>
                    <p className="text-[10px] text-[#52576A] dark:text-[#CBD2E1] truncate mt-0.5">
                      Explore PYQ vault & subject tests
                    </p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-[#787D91] group-hover:translate-x-1 transition-transform shrink-0" />
              </button>
            </div>
          </section>
        )}

        {/* 5. AI WEAKNESS RADAR & FLAW MATRIX (Visible on Weakness & All) */}
        {(activeSection === "weakness" || activeSection === "all") && (
          <section className="bg-white dark:bg-[#1F2330] border border-[#E8D9C0] dark:border-[#31374A] rounded-3xl p-5 shadow-2xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-xs sm:text-sm font-black uppercase tracking-wider text-[#171923] dark:text-[#FFF9EF] flex items-center gap-2">
                  <Target className="w-4 h-4 text-[#800020] dark:text-[#F47B20]" />
                  <span>AI Weakness Radar & Flaw Matrix</span>
                </h3>
                <p className="text-[10px] font-bold text-[#787D91] dark:text-[#929AB0] uppercase tracking-widest mt-0.5">
                  Pinpoint topics where negative marks and concept confusion occur
                </p>
              </div>

              {/* Filter Pills */}
              <div className="flex items-center gap-1 bg-[#F7EFE2] dark:bg-[#252A3A] p-1 rounded-xl border border-[#E8D9C0] dark:border-[#31374A] self-start sm:self-auto overflow-x-auto no-scrollbar">
                {[
                  { id: "critical", label: `Red Alert (${criticalWeakList.length})`, color: "bg-rose-600 text-white" },
                  { id: "warning", label: `Review (${warningList.length})`, color: "bg-[#C99A45] text-white" },
                  { id: "mastered", label: `Mastered (${masteredList.length})`, color: "bg-emerald-600 text-white" },
                  { id: "all", label: `All (${topicDiagnostics.length})`, color: "bg-[#800020] text-white" },
                ].map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => {
                      triggerHaptic("light");
                      setRadarFilter(f.id as any);
                    }}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold transition-all cursor-pointer whitespace-nowrap ${
                      radarFilter === f.id
                        ? `${f.color} shadow-xs`
                        : "text-[#52576A] dark:text-[#CBD2E1] hover:text-[#171923] dark:hover:text-white"
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {/* List of Diagnostic Topics */}
            {displayedRadarList.length === 0 ? (
              <div className="py-10 text-center bg-[#FFF9EF] dark:bg-[#171923] rounded-2xl border border-dashed border-[#E8D9C0] dark:border-[#31374A] p-5">
                <ShieldCheck className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
                <h4 className="text-xs font-black text-[#171923] dark:text-[#FFF9EF]">
                  No Topics in this Category
                </h4>
                <p className="text-[11px] text-[#52576A] dark:text-[#CBD2E1] mt-1 max-w-sm mx-auto">
                  {radarFilter === "critical"
                    ? "Great news! No critical red flags detected. Maintain your strong practice."
                    : "Practice questions across more chapters to see detailed topic diagnostics."}
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {displayedRadarList.map((item) => {
                  const isCrit = item.status === "critical";
                  const isWarn = item.status === "warning";

                  return (
                    <div
                      key={item.id}
                      className={`p-3.5 sm:p-4 rounded-2xl transition-all ${
                        isCrit
                          ? "bg-white dark:bg-[#1F2330] border-l-4 border-l-rose-600 border-t border-r border-b border-[#E8D9C0] dark:border-[#31374A] shadow-2xs"
                          : isWarn
                          ? "bg-white dark:bg-[#1F2330] border-l-4 border-l-[#C99A45] border-t border-r border-b border-[#E8D9C0] dark:border-[#31374A] shadow-2xs"
                          : "bg-white dark:bg-[#1F2330] border-l-4 border-l-emerald-500 border-t border-r border-b border-[#E8D9C0] dark:border-[#31374A] shadow-2xs"
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase border ${
                                isCrit
                                  ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30"
                                  : isWarn
                                  ? "bg-[#C99A45]/15 text-[#946B1E] dark:text-[#E5BC6B] border-[#C99A45]/30"
                                  : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                              }`}
                            >
                              {isCrit ? "🔴 Critical Red Alert" : isWarn ? "🟡 Needs Review" : "🟢 Mastered"}
                            </span>
                            <span className="text-[10px] text-[#787D91] dark:text-[#929AB0] font-bold">
                              {item.chapterName}
                            </span>
                          </div>

                          <h4 className="text-xs sm:text-sm font-extrabold text-[#171923] dark:text-[#FFF9EF] truncate">
                            {item.name}
                          </h4>

                          <p className="text-[11px] text-[#52576A] dark:text-[#CBD2E1] font-medium mt-0.5 flex items-center gap-1.5 flex-wrap">
                            <span className={`font-bold ${isCrit ? "text-rose-600 dark:text-rose-400" : isWarn ? "text-[#C99A45]" : "text-emerald-600"}`}>
                              Diagnostic:
                            </span>
                            <span>{item.weakReason}</span>
                          </p>
                        </div>

                        {/* Accuracy & 1-Tap Improve Button */}
                        <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
                          <div className="text-right">
                            <div className="flex items-baseline justify-end gap-1 font-mono">
                              <span
                                className={`text-base font-black tabular-nums ${
                                  isCrit
                                    ? "text-rose-600 dark:text-rose-400"
                                    : isWarn
                                    ? "text-[#C99A45] dark:text-[#E5BC6B]"
                                    : "text-emerald-600 dark:text-emerald-400"
                                }`}
                              >
                                {item.accuracy}%
                              </span>
                              <span className="text-[9px] font-bold text-[#787D91]">
                                Acc
                              </span>
                            </div>
                            <span className="text-[10px] text-[#787D91] dark:text-[#929AB0] font-mono block">
                              {item.wrong} Wrong / {item.attempted} Solved
                            </span>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleStartTopicDrill(item)}
                            className={`h-8 px-3 rounded-xl text-xs font-black flex items-center gap-1 active:scale-95 transition-all cursor-pointer ${
                              isCrit
                                ? "bg-rose-600 hover:bg-rose-700 text-white shadow-xs"
                                : "bg-[#800020] hover:bg-[#5E0017] text-white shadow-xs"
                            }`}
                          >
                            <Zap className="w-3.5 h-3.5" />
                            <span>Improve</span>
                          </button>
                        </div>
                      </div>

                      {/* Accuracy Bar */}
                      <div className="w-full h-1.5 rounded-full bg-[#E8D9C0]/60 dark:bg-[#31374A] overflow-hidden mt-2.5">
                        <div
                          className={`h-full rounded-full ${
                            isCrit ? "bg-rose-600" : isWarn ? "bg-[#C99A45]" : "bg-emerald-500"
                          }`}
                          style={{ width: `${Math.max(4, item.accuracy)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {/* 6. SUBJECT MASTERY & PROGRESS (Visible on Subjects & All) */}
        {(activeSection === "subjects" || activeSection === "all") && (
          <section className="bg-white dark:bg-[#1F2330] border border-[#E8D9C0] dark:border-[#31374A] rounded-3xl p-5 shadow-2xs space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <h3 className="text-xs sm:text-sm font-black uppercase tracking-wider text-[#171923] dark:text-[#FFF9EF] flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-[#800020] dark:text-[#F47B20]" />
                  <span>Subject Mastery Meters</span>
                </h3>
                <p className="text-[10px] font-bold text-[#787D91] dark:text-[#929AB0] uppercase tracking-widest mt-0.5">
                  Subject-wise precision, question coverage & direct practice
                </p>
              </div>

              {/* Filter Chips */}
              <div className="flex items-center gap-1 bg-[#F7EFE2] dark:bg-[#252A3A] p-1 rounded-xl border border-[#E8D9C0] dark:border-[#31374A]">
                {[
                  { id: "all", label: "All Subjects" },
                  { id: "weak", label: "Needs Focus" },
                  { id: "strong", label: "Mastered" },
                ].map((f) => (
                  <button
                    key={f.id}
                    type="button"
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
                <div className="md:col-span-2 py-8 text-center text-[#787D91] dark:text-[#929AB0] text-xs font-medium bg-[#FFF9EF] dark:bg-[#171923] rounded-2xl border border-dashed border-[#E8D9C0] dark:border-[#31374A] p-4">
                  No subjects match this filter. Practice questions to view statistics.
                </div>
              ) : (
                filteredSubjects.map((metric) => {
                  const isAccHigh = metric.accuracy >= 75;
                  const isAccMed = metric.accuracy >= 50 && metric.accuracy < 75;

                  const badgeBg = isAccHigh
                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                    : isAccMed
                    ? "bg-[#F47B20]/15 text-[#F47B20] border-[#F47B20]/30"
                    : "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30";

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

                      {/* Correct / Wrong Count & Direct Practice Button */}
                      <div className="flex items-center justify-between pt-1">
                        <span className="text-[10px] font-bold text-[#787D91] dark:text-[#929AB0] tabular-nums">
                          {metric.correct} Correct • {metric.wrong} Wrong
                        </span>
                        <button
                          type="button"
                          onClick={() => handleStartSubjectPractice(metric)}
                          className="px-3 py-1.5 rounded-xl bg-white dark:bg-[#1F2330] hover:bg-[#800020] hover:text-white dark:hover:bg-[#F47B20] dark:hover:text-white text-[#800020] dark:text-[#F47B20] font-black text-[11px] border border-[#E8D9C0] dark:border-[#31374A] transition-all active:scale-95 cursor-pointer flex items-center gap-1 shadow-2xs"
                        >
                          <span>Practice</span>
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </section>
        )}

        {/* 7. RETENTION, 7-DAY CONSISTENCY & LEITNER MEMORY (Visible on Trends & All) */}
        {(activeSection === "trends" || activeSection === "all") && (
          <div className="space-y-4">
            {/* 7-Day Consistency Chart */}
            <section className="bg-white dark:bg-[#1F2330] border border-[#E8D9C0] dark:border-[#31374A] rounded-3xl p-5 shadow-2xs space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-[#F47B20]/15 text-[#F47B20] flex items-center justify-center">
                    <Flame className="w-5 h-5 fill-[#F47B20]" />
                  </div>
                  <div>
                    <h3 className="text-xs sm:text-sm font-black uppercase tracking-wider text-[#171923] dark:text-[#FFF9EF]">
                      Study Consistency & Habit
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

            {/* Leitner 5-Stage Spaced Repetition Memory Tracker */}
            <section className="bg-white dark:bg-[#1F2330] border border-[#E8D9C0] dark:border-[#31374A] rounded-3xl p-5 shadow-2xs space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs sm:text-sm font-black uppercase tracking-wider text-[#171923] dark:text-[#FFF9EF] flex items-center gap-2">
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
          </div>
        )}

        {/* 8. BOTTOM PRACTICE BANNER */}
        <div className="pt-2">
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
