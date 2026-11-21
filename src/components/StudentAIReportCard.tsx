import React, { useMemo, useState } from "react";
import {
  Brain,
  AlertTriangle,
  ShieldCheck,
  Target,
  Zap,
  TrendingDown,
  Clock,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Share2,
  Award,
  ChevronRight,
  Sparkles,
  BookOpen,
  ArrowRight,
  Flame,
  Check,
  Copy,
  Info,
} from "lucide-react";
import {
  Question,
  Chapter,
  Subject,
  ProgressStore,
  MCQSession,
  ActiveTab,
  UserProfile,
  AppSettings,
  DailyStudyHistory,
} from "../types";
import { triggerHaptic, playClickSound } from "../utils/audioFeedback";
import { isDueToday, getTodayDateString } from "../utils/revision";
import { loadPerformanceStore } from "../utils/performanceStorage";

interface StudentAIReportCardProps {
  questions: Question[];
  chapters: Chapter[];
  subjects: Subject[];
  progressStore: ProgressStore;
  settings?: AppSettings;
  studyHistory?: DailyStudyHistory;
  userProfile?: UserProfile | null;
  onStartSession?: (session: MCQSession) => void;
  onNavigateTab?: (tab: ActiveTab) => void;
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

export const StudentAIReportCard: React.FC<StudentAIReportCardProps> = ({
  questions,
  chapters,
  subjects,
  progressStore,
  settings,
  userProfile,
  onStartSession,
  onNavigateTab,
}) => {
  const [copiedSummary, setCopiedSummary] = useState(false);
  const [activeFilter, setActiveFilter] = useState<"all" | "critical" | "warning" | "mastered">("critical");

  const todayStr = settings?.todayDate || getTodayDateString();

  // 1. Compute Base Stats
  const baseStats = useMemo(() => {
    let totalPracticed = 0;
    let totalCorrect = 0;
    let totalWrong = 0;
    let dueQuestions: Question[] = [];
    const wrongQuestionsPool: Question[] = [];

    questions.forEach((q) => {
      const p = progressStore[q.id];
      if (p && p.status !== "unattempted") {
        totalPracticed++;
        if (p.status === "correct") {
          totalCorrect++;
        } else if (p.status === "wrong") {
          totalWrong++;
          wrongQuestionsPool.push(q);
        }

        if (isDueToday(p, todayStr)) {
          dueQuestions.push(q);
        }
      }
    });

    const totalAnswered = totalCorrect + totalWrong;
    const accuracy = totalAnswered > 0 ? Math.round((totalCorrect / totalAnswered) * 100) : 0;

    // Standard 1/3 negative marking penalty calculation
    // Each wrong answer costs 0.33 marks
    const negativeMarksLost = Number((totalWrong * 0.33).toFixed(2));

    // Exam Readiness Score (0-100)
    // Formula: Accuracy (45%) + Practiced Volume/Syllabus (35%) + Mastery Factor (20%)
    const syllabusCoverage = questions.length > 0 ? Math.min(100, Math.round((totalPracticed / questions.length) * 100)) : 0;
    const readinessScore = Math.min(
      100,
      Math.max(0, Math.round(accuracy * 0.5 + Math.min(syllabusCoverage, 50) * 0.6 + (totalPracticed > 50 ? 10 : totalPracticed > 20 ? 5 : 0)))
    );

    let grade = "D";
    let gradeLabel = "Foundational Level (Needs Work)";
    let gradeColor = "text-[#991B1B] dark:text-[#F87171]";
    let gradeBadgeBg = "bg-[#991B1B]/10 dark:bg-[#991B1B]/20 text-[#991B1B] dark:text-[#F87171] border-[#991B1B]/30";

    if (readinessScore >= 80) {
      grade = "A+";
      gradeLabel = "Rankers League (Exam Ready)";
      gradeColor = "text-emerald-600 dark:text-emerald-400";
      gradeBadgeBg = "bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border-emerald-400 dark:border-emerald-700";
    } else if (readinessScore >= 65) {
      grade = "A";
      gradeLabel = "Strong Standing (Competitive)";
      gradeColor = "text-[#800020] dark:text-[#F47B20]";
      gradeBadgeBg = "bg-[#800020]/10 dark:bg-[#F47B20]/15 text-[#800020] dark:text-[#F47B20] border-[#800020]/30 dark:border-[#F47B20]/40";
    } else if (readinessScore >= 50) {
      grade = "B";
      gradeLabel = "Satisfactory (Needs Polish)";
      gradeColor = "text-[#C99A45] dark:text-[#E5BC6B]";
      gradeBadgeBg = "bg-[#C99A45]/15 dark:bg-[#C99A45]/20 text-[#946B1E] dark:text-[#E5BC6B] border-[#C99A45]/40";
    } else if (readinessScore >= 35) {
      grade = "C";
      gradeLabel = "High Risk (Heavy Negative Marks)";
      gradeColor = "text-[#EA580C] dark:text-[#FB923C]";
      gradeBadgeBg = "bg-[#EA580C]/10 dark:bg-[#EA580C]/20 text-[#EA580C] dark:text-[#FB923C] border-[#EA580C]/30";
    }

    return {
      totalPracticed,
      totalCorrect,
      totalWrong,
      accuracy,
      negativeMarksLost,
      readinessScore,
      grade,
      gradeLabel,
      gradeColor,
      gradeBadgeBg,
      dueQuestions,
      wrongQuestionsPool,
    };
  }, [questions, progressStore, todayStr]);

  // 2. Compute Weak Topics & Flaw Analysis per Chapter / Topic
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
      let weakReason = "Strong grasp • Keep up consistent practice";

      if (accuracy < 50 || wrong >= 3) {
        status = "critical";
        if (accuracy < 30) {
          weakReason = "Severe concept gap • Theory revision required";
        } else if (wrong >= 4) {
          weakReason = "Frequent incorrect guesses • High negative marking risk";
        } else {
          weakReason = "Confusion & silly mistakes • Needs quick booster test";
        }
      } else if (accuracy < 75) {
        status = "warning";
        weakReason = "Moderate accuracy • Uncertainty on harder questions";
      } else {
        status = "mastered";
        weakReason = "Excellent command • 75%+ accuracy achieved";
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

    // Sort: Critical first, then Warning, then by wrong count descending
    items.sort((a, b) => {
      const order = { critical: 0, warning: 1, mastered: 2 };
      if (order[a.status] !== order[b.status]) {
        return order[a.status] - order[b.status];
      }
      return b.wrong - a.wrong;
    });

    return items;
  }, [questions, chapters, subjects, progressStore]);

  // Critical weak topics list
  const criticalWeakList = useMemo(() => topicDiagnostics.filter((t) => t.status === "critical"), [topicDiagnostics]);
  const warningList = useMemo(() => topicDiagnostics.filter((t) => t.status === "warning"), [topicDiagnostics]);
  const masteredList = useMemo(() => topicDiagnostics.filter((t) => t.status === "mastered"), [topicDiagnostics]);

  const displayedList = useMemo(() => {
    if (activeFilter === "critical") return criticalWeakList;
    if (activeFilter === "warning") return warningList;
    if (activeFilter === "mastered") return masteredList;
    return topicDiagnostics;
  }, [activeFilter, criticalWeakList, warningList, masteredList, topicDiagnostics]);

  // 3. AI Guru Diagnostic Remarks (Direct, candid and unvarnished)
  const aiGuruRemarks = useMemo(() => {
    const remarks: { icon: any; title: string; desc: string; type: "alert" | "warning" | "tip" | "success" }[] = [];

    // Remark 1: Top Weak Area Callout
    if (criticalWeakList.length > 0) {
      const topWeak = criticalWeakList[0];
      remarks.push({
        icon: AlertTriangle,
        title: `🔴 Critical Weakness: '${topWeak.name}'`,
        desc: `In this topic, you got ${topWeak.wrong} out of ${topWeak.attempted} questions wrong (${topWeak.accuracy}% accuracy). This could place you below the cutoff in the final exam. Review and master it today!`,
        type: "alert",
      });
    } else if (baseStats.totalPracticed === 0) {
      remarks.push({
        icon: Info,
        title: "Practice Not Started Yet",
        desc: "Solve at least 20-30 questions for AI to generate your personalized weakness radar and negative marking diagnostic.",
        type: "tip",
      });
    } else {
      remarks.push({
        icon: ShieldCheck,
        title: "🟢 No Critical Red Flags",
        desc: "You maintained above 50% accuracy across practiced topics. Focus on difficult and analytical questions next.",
        type: "success",
      });
    }

    // Remark 2: Negative Marking Damage
    if (baseStats.negativeMarksLost > 0) {
      remarks.push({
        icon: TrendingDown,
        title: `⚠️ Penalty Cost: -${baseStats.negativeMarksLost} Marks Lost`,
        desc: `You answered ${baseStats.totalWrong} questions incorrectly. Skipping uncertain questions would have preserved these ${baseStats.negativeMarksLost} marks, making a difference of hundreds of ranks in competitive exams.`,
        type: "warning",
      });
    }

    // Remark 3: Forgetting Curve / Spaced Repetition
    if (baseStats.dueQuestions.length > 0) {
      remarks.push({
        icon: Brain,
        title: `🧠 Memory Retention: ${baseStats.dueQuestions.length} Questions Due for Revision`,
        desc: `According to the Ebbinghaus Forgetting Curve, questions studied a few days ago are fading from memory. Spend 15 minutes today on spaced revision.`,
        type: "tip",
      });
    }

    // Remark 4: Action Plan
    remarks.push({
      icon: Zap,
      title: "⚡ Today's Action Plan",
      desc: "Tap the 'AI Weakness Booster Test' button below. AI has generated a focused 20-question set from your mistakes and weak chapters. Aim for 80%+ score.",
      type: "tip",
    });

    return remarks;
  }, [criticalWeakList, baseStats]);

  // 4. Start 1-Click Customized AI Booster Test
  const handleStartCustomizedBoosterTest = () => {
    if (!onStartSession) return;
    triggerHaptic("success");
    playClickSound();

    // Pool questions:
    // Priority 1: Wrong questions from progressStore
    // Priority 2: Unattempted/weak questions from critical weak topics
    const poolMap = new Map<string, Question>();

    // Add wrong questions first
    baseStats.wrongQuestionsPool.forEach((q) => poolMap.set(q.id, q));

    // Add questions from critical topics
    criticalWeakList.forEach((t) => {
      t.allQuestions.forEach((q) => {
        if (!poolMap.has(q.id)) {
          poolMap.set(q.id, q);
        }
      });
    });

    // If pool still < 20, backfill from warning topics or general questions
    if (poolMap.size < 20) {
      warningList.forEach((t) => {
        t.allQuestions.forEach((q) => {
          if (!poolMap.has(q.id)) {
            poolMap.set(q.id, q);
          }
        });
      });
    }

    if (poolMap.size < 20) {
      questions.forEach((q) => {
        if (!poolMap.has(q.id)) {
          poolMap.set(q.id, q);
        }
      });
    }

    const selected = Array.from(poolMap.values()).slice(0, 20);

    onStartSession({
      title: "🔥 AI Weakness Booster Test",
      subtitle: `${selected.length} High-Yield Questions from Top Weak Areas • 1/3 Negative Marking`,
      questionIds: selected.map((q) => q.id),
      extraQuestions: selected,
      source: "custom-smart",
      testType: "custom_smart",
      isExamSimulation: false,
    });
  };

  // Start specific topic drill
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

  // 5. Share Report Card Text to Clipboard or Native Share
  const handleShareReportCard = async () => {
    triggerHaptic("light");
    playClickSound();

    const studentName = userProfile?.full_name || userProfile?.name || "Aspirant";
    const examTarget = settings?.selectedExam || "Rajasthan Competitive Exam (RPSC / CET / Patwar / REET)";

    const weakText = criticalWeakList.length > 0
      ? criticalWeakList.slice(0, 3).map((w, i) => `${i + 1}. ${w.name} (${w.accuracy}% Accuracy - ${w.wrong} Wrong)`).join("\n")
      : "No critical weaknesses • Good balance";

    const reportCardText = `📋 *Disha PYQ — Student AI Diagnostic & Progress Report Card*
━━━━━━━━━━━━━━━━━━
👤 Aspirant: ${studentName}
🎯 Target Exam: ${examTarget}
📅 Date: ${todayStr}

📊 *Score & Performance Audit:*
• Exam Readiness Score: ${baseStats.readinessScore}/100 [Grade: ${baseStats.grade} - ${baseStats.gradeLabel}]
• Total Practiced Questions: ${baseStats.totalPracticed}
• Overall Accuracy: ${baseStats.accuracy}%
• Correct: ${baseStats.totalCorrect} | Incorrect: ${baseStats.totalWrong}
• ⚠️ Negative Marking Lost: -${baseStats.negativeMarksLost} marks
• 🧠 Memory Revision Due: ${baseStats.dueQuestions.length} questions

🔴 *Top Weak Topics (Review Needed):*
${weakText}

💡 *AI Mentor Advice:*
Avoid guessing, take the 1-click weakness booster test, and stop negative marking!

📱 Check your weakness radar and start booster test:
https://disha2020.in
━━━━━━━━━━━━━━━━━━`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: "Disha PYQ Student AI Report Card",
          text: reportCardText,
        });
        return;
      } catch (e) {
        // Fallback to clipboard
      }
    }

    try {
      await navigator.clipboard.writeText(reportCardText);
      setCopiedSummary(true);
      setTimeout(() => setCopiedSummary(false), 3000);
    } catch {
      // Ignored
    }
  };

  return (
    <div className="space-y-4 sm:space-y-5 text-left">
      {/* 1. REPORT CARD OFFICIAL HEADER */}
      <section className="bg-white dark:bg-[#1F2330] rounded-3xl p-5 sm:p-6 border border-[#E8D9C0] dark:border-[#31374A] shadow-xs relative overflow-hidden">
        {/* Glow */}
        <div className="absolute top-0 right-0 w-56 h-56 bg-gradient-to-bl from-[#7045D8]/15 via-[#A78BFA]/10 to-transparent rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10 border-b border-[#E8D9C0] dark:border-[#31374A] pb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#7045D8] to-[#A78BFA] text-white flex items-center justify-center font-black shadow-md shadow-[#7045D8]/20 shrink-0">
              <Award className="w-6 h-6" />
            </div>
            <div>
              <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider bg-[#7045D8]/10 dark:bg-[#A78BFA]/15 text-[#7045D8] dark:text-[#A78BFA] mb-1">
                <span>Disha PYQ AI Diagnostic Audit</span>
              </div>
              <h2 className="text-lg sm:text-xl font-black text-[#171923] dark:text-[#FFF9EF] tracking-tight">
                Student AI Report Card & Weakness Radar
              </h2>
              <p className="text-[11px] text-[#52576A] dark:text-[#CBD2E1] font-medium">
                Comprehensive diagnostic of your knowledge gaps, negative marks, and improvement areas
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button
              type="button"
              onClick={handleShareReportCard}
              className="h-9 px-3.5 rounded-xl bg-[#800020]/10 dark:bg-[#F47B20]/15 text-[#800020] dark:text-[#F47B20] hover:bg-[#800020] hover:text-white dark:hover:bg-[#F47B20] dark:hover:text-white flex items-center gap-1.5 text-xs font-black transition-all active:scale-95 cursor-pointer border border-[#800020]/20 dark:border-[#F47B20]/30"
            >
              {copiedSummary ? <Check className="w-4 h-4 text-emerald-600" /> : <Share2 className="w-4 h-4" />}
              <span>{copiedSummary ? "Copied!" : "Share Report Card"}</span>
            </button>
          </div>
        </div>

        {/* Candidate & Audit Details Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-4 relative z-10 text-[11px]">
          <div className="p-2.5 rounded-xl bg-[#FFF9EF] dark:bg-[#171923] border border-[#E8D9C0]/80 dark:border-[#31374A]">
            <span className="text-[9px] font-bold uppercase tracking-wider text-[#787D91] dark:text-[#929AB0] block mb-0.5">
              Candidate Name
            </span>
            <span className="font-extrabold text-[#171923] dark:text-[#FFF9EF] truncate block">
              {userProfile?.full_name || userProfile?.name || "Student"}
            </span>
          </div>

          <div className="p-2.5 rounded-xl bg-[#FFF9EF] dark:bg-[#171923] border border-[#E8D9C0]/80 dark:border-[#31374A]">
            <span className="text-[9px] font-bold uppercase tracking-wider text-[#787D91] dark:text-[#929AB0] block mb-0.5">
              Target Exam
            </span>
            <span className="font-extrabold text-[#800020] dark:text-[#F47B20] truncate block">
              {settings?.selectedExam || "Rajasthan Competitive Exam"}
            </span>
          </div>

          <div className="p-2.5 rounded-xl bg-[#FFF9EF] dark:bg-[#171923] border border-[#E8D9C0]/80 dark:border-[#31374A]">
            <span className="text-[9px] font-bold uppercase tracking-wider text-[#787D91] dark:text-[#929AB0] block mb-0.5">
              Audit Date
            </span>
            <span className="font-extrabold text-[#171923] dark:text-[#FFF9EF] block font-mono">
              {todayStr}
            </span>
          </div>

          <div className="p-2.5 rounded-xl bg-[#FFF9EF] dark:bg-[#171923] border border-[#E8D9C0]/80 dark:border-[#31374A]">
            <span className="text-[9px] font-bold uppercase tracking-wider text-[#787D91] dark:text-[#929AB0] block mb-0.5">
              Overall Standing
            </span>
            <span className={`font-black truncate block ${baseStats.gradeColor}`}>
              {baseStats.grade} • {baseStats.gradeLabel}
            </span>
          </div>
        </div>
      </section>

      {/* 2. HERO: EXAM READINESS & NEGATIVE MARKING DAMAGE METER */}
      <section className="grid grid-cols-1 md:grid-cols-12 gap-3.5 sm:gap-4">
        {/* Score & Readiness Gauge */}
        <div className="md:col-span-6 bg-white dark:bg-[#1F2330] rounded-3xl p-5 border border-[#E8D9C0] dark:border-[#31374A] shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-wider bg-[#F7EFE2] dark:bg-[#252A3A] text-[#800020] dark:text-[#F47B20]">
                <Target className="w-3.5 h-3.5 text-[#800020] dark:text-[#F47B20]" />
                <span>Exam Readiness Index</span>
              </span>
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black border ${baseStats.gradeBadgeBg}`}>
                Grade {baseStats.grade}
              </span>
            </div>

            <div className="flex items-baseline gap-2 mb-2">
              <span className="text-4xl sm:text-5xl font-black text-[#171923] dark:text-[#FFF9EF] font-mono tabular-nums tracking-tight">
                {baseStats.readinessScore}
              </span>
              <span className="text-lg font-bold text-[#787D91] dark:text-[#929AB0]">/ 100</span>
              <span className={`text-xs font-black ml-auto ${baseStats.gradeColor}`}>
                {baseStats.gradeLabel}
              </span>
            </div>

            {/* Progress Bar */}
            <div className="w-full h-3 rounded-full bg-[#F7EFE2] dark:bg-[#252A3A] overflow-hidden p-0.5 border border-[#E8D9C0] dark:border-[#31374A]">
              <div
                className={`h-full rounded-full transition-all duration-700 ${
                  baseStats.readinessScore >= 80
                    ? "bg-emerald-500"
                    : baseStats.readinessScore >= 65
                    ? "bg-[#800020] dark:bg-[#F47B20]"
                    : baseStats.readinessScore >= 50
                    ? "bg-[#C99A45]"
                    : "bg-[#991B1B]"
                }`}
                style={{ width: `${Math.max(5, baseStats.readinessScore)}%` }}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 pt-4 mt-4 border-t border-[#E8D9C0] dark:border-[#31374A] text-center">
            <div>
              <span className="text-[9px] font-bold text-[#787D91] dark:text-[#929AB0] uppercase block">
                Total Practiced
              </span>
              <span className="text-base font-black text-[#171923] dark:text-[#FFF9EF] font-mono tabular-nums">
                {baseStats.totalPracticed} Qs
              </span>
            </div>
            <div>
              <span className="text-[9px] font-bold text-[#787D91] dark:text-[#929AB0] uppercase block">
                Accuracy
              </span>
              <span className="text-base font-black text-emerald-600 dark:text-emerald-400 font-mono tabular-nums">
                {baseStats.accuracy}%
              </span>
            </div>
            <div>
              <span className="text-[9px] font-bold text-[#787D91] dark:text-[#929AB0] uppercase block">
                Correct Answers
              </span>
              <span className="text-base font-black text-[#800020] dark:text-[#F47B20] font-mono tabular-nums">
                {baseStats.totalCorrect}
              </span>
            </div>
          </div>
        </div>

        {/* Negative Marking & Mistake Bleed Card */}
        <div className="md:col-span-6 bg-gradient-to-br from-[#800020]/10 via-[#FFF9EF] to-[#F47B20]/10 dark:from-[#800020]/25 dark:via-[#1F2330] dark:to-[#F47B20]/15 rounded-3xl p-5 border border-[#800020]/25 dark:border-[#800020]/40 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-wider bg-[#991B1B]/15 dark:bg-[#991B1B]/30 text-[#991B1B] dark:text-[#FCA5A5] border border-[#991B1B]/20">
                <AlertTriangle className="w-3.5 h-3.5 text-[#991B1B] dark:text-[#FCA5A5]" />
                <span>Negative Marking Penalty</span>
              </span>
              <span className="text-[10px] font-black text-[#991B1B] dark:text-[#F87171]">
                1/3rd Negative Penalty
              </span>
            </div>

            <div className="flex items-baseline gap-2 mb-1.5">
              <span className="text-3xl sm:text-4xl font-black text-[#991B1B] dark:text-[#F87171] font-mono tabular-nums tracking-tight">
                -{baseStats.negativeMarksLost}
              </span>
              <span className="text-sm font-extrabold text-[#991B1B] dark:text-[#F87171]">
                Marks Lost
              </span>
              <span className="text-xs font-bold text-[#52576A] dark:text-[#CBD2E1] ml-auto">
                ({baseStats.totalWrong} Incorrect Questions)
              </span>
            </div>

            <div className="bg-white/95 dark:bg-[#1F2330]/95 p-3 rounded-2xl border border-[#800020]/15 dark:border-[#800020]/30 text-[11px] leading-relaxed text-[#171923] dark:text-[#FFF9EF] font-medium space-y-1">
              <p className="font-bold text-[#991B1B] dark:text-[#F87171]">
                ⚠️ Harsh Truth:
              </p>
              <p>
                {baseStats.negativeMarksLost > 0 ? (
                  <>
                    Incorrect guesses cost you <strong className="text-[#991B1B] dark:text-[#F87171] font-black">-{baseStats.negativeMarksLost} marks</strong>. Leaving these blank would have placed your rank <strong className="text-emerald-600 font-black">hundreds of spots higher</strong> on the merit list!
                  </>
                ) : (
                  <>
                    Outstanding! No negative marks lost so far. Continue practicing with precision and discipline.
                  </>
                )}
              </p>
            </div>
          </div>

          <div className="pt-3 mt-3 border-t border-[#800020]/15 dark:border-[#800020]/30 flex items-center justify-between text-[11px]">
            <span className="text-[#52576A] dark:text-[#CBD2E1]">
              Review and fix incorrect questions immediately:
            </span>
            <button
              type="button"
              onClick={() => onNavigateTab?.("wrong")}
              className="text-xs font-extrabold text-[#800020] dark:text-[#F47B20] hover:underline flex items-center gap-1 cursor-pointer"
            >
              <span>Review Incorrect Questions ({baseStats.totalWrong})</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </section>

      {/* 3. AI GURU DIRECT DIAGNOSTIC REMARKS ("Unvarnished Diagnostic Insights") */}
      <section className="bg-white dark:bg-[#1F2330] rounded-3xl p-5 sm:p-6 border border-[#E8D9C0] dark:border-[#31374A] shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-[#800020]/10 dark:bg-[#F47B20]/15 text-[#800020] dark:text-[#F47B20] flex items-center justify-center">
              <Brain className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs sm:text-sm font-black uppercase tracking-wider text-[#171923] dark:text-[#FFF9EF]">
                AI Mentor Candid Review
              </h3>
              <p className="text-[10px] font-bold text-[#787D91] dark:text-[#929AB0] uppercase tracking-widest">
                Direct Unvarnished Diagnostic Insights
              </p>
            </div>
          </div>
          <span className="text-[10px] font-extrabold text-[#800020] dark:text-[#F47B20] px-2 py-0.5 rounded-full bg-[#800020]/10 dark:bg-[#F47B20]/15">
            Unvarnished Truth
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {aiGuruRemarks.map((remark, idx) => {
            const Icon = remark.icon;
            const bgClass =
              remark.type === "alert"
                ? "bg-[#991B1B]/5 dark:bg-[#991B1B]/15 border-[#991B1B]/25 dark:border-[#991B1B]/40"
                : remark.type === "warning"
                ? "bg-[#C99A45]/10 dark:bg-[#C99A45]/15 border-[#C99A45]/30 dark:border-[#C99A45]/40"
                : remark.type === "success"
                ? "bg-emerald-500/10 dark:bg-emerald-950/20 border-emerald-500/30 dark:border-emerald-800"
                : "bg-[#FFF9EF] dark:bg-[#171923] border-[#E8D9C0] dark:border-[#31374A]";

            return (
              <div
                key={idx}
                className={`p-3.5 sm:p-4 rounded-2xl border transition-all ${bgClass}`}
              >
                <div className="flex items-start gap-2.5">
                  <div className="p-1.5 rounded-lg bg-white dark:bg-[#1F2330] shadow-xs shrink-0 mt-0.5 border border-[#E8D9C0]/60 dark:border-[#31374A]">
                    <Icon className="w-4 h-4 text-[#800020] dark:text-[#F47B20]" />
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-[#171923] dark:text-[#FFF9EF] mb-1">
                      {remark.title}
                    </h4>
                    <p className="text-[11px] leading-relaxed text-[#52576A] dark:text-[#CBD2E1] font-medium">
                      {remark.desc}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* 4. THE CORE WEAKNESS RADAR (EXACT TOPICS & FLAW REASONS) */}
      <section className="bg-white dark:bg-[#1F2330] rounded-3xl p-5 sm:p-6 border border-[#E8D9C0] dark:border-[#31374A] shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-xs sm:text-sm font-black uppercase tracking-wider text-[#171923] dark:text-[#FFF9EF] flex items-center gap-2">
              <Target className="w-4 h-4 text-[#800020] dark:text-[#F47B20]" />
              <span>AI Weakness Radar (Flaw & Vulnerability Matrix)</span>
            </h3>
            <p className="text-[10px] font-bold text-[#787D91] dark:text-[#929AB0] uppercase tracking-widest mt-0.5">
              Where marks are lost • Detailed topic-by-topic diagnostic
            </p>
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1 bg-[#F7EFE2] dark:bg-[#252A3A] p-1 rounded-xl border border-[#E8D9C0] dark:border-[#31374A] self-start sm:self-auto">
            <button
              onClick={() => setActiveFilter("critical")}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold transition-all cursor-pointer ${
                activeFilter === "critical"
                  ? "bg-[#991B1B] text-white shadow-xs border border-[#991B1B]/40"
                  : "text-[#52576A] dark:text-[#CBD2E1] hover:text-[#171923]"
              }`}
            >
              Red Alert ({criticalWeakList.length})
            </button>
            <button
              onClick={() => setActiveFilter("warning")}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold transition-all cursor-pointer ${
                activeFilter === "warning"
                  ? "bg-[#C99A45] text-white shadow-xs border border-[#C99A45]/40"
                  : "text-[#52576A] dark:text-[#CBD2E1] hover:text-[#171923]"
              }`}
            >
              Needs Review ({warningList.length})
            </button>
            <button
              onClick={() => setActiveFilter("mastered")}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold transition-all cursor-pointer ${
                activeFilter === "mastered"
                  ? "bg-emerald-600 text-white shadow-xs border border-emerald-600/40"
                  : "text-[#52576A] dark:text-[#CBD2E1] hover:text-[#171923]"
              }`}
            >
              Mastered ({masteredList.length})
            </button>
            <button
              onClick={() => setActiveFilter("all")}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold transition-all cursor-pointer ${
                activeFilter === "all"
                  ? "bg-[#800020] text-white shadow-xs border border-[#C99A45]/30"
                  : "text-[#52576A] dark:text-[#CBD2E1] hover:text-[#171923]"
              }`}
            >
              All Topics ({topicDiagnostics.length})
            </button>
          </div>
        </div>

        {/* Weak Topics List */}
        {displayedList.length === 0 ? (
          <div className="py-12 text-center bg-[#FFF9EF] dark:bg-[#171923] rounded-2xl border border-dashed border-[#E8D9C0] dark:border-[#31374A] p-6">
            <ShieldCheck className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
            <h4 className="text-xs font-black text-[#171923] dark:text-[#FFF9EF]">
              No topics found in this category
            </h4>
            <p className="text-[11px] text-[#52576A] dark:text-[#CBD2E1] mt-1 max-w-sm mx-auto">
              {activeFilter === "critical"
                ? "Congratulations! No critical red flags detected. Maintain your consistency."
                : "Practice more questions to populate your diagnostic radar."}
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {displayedList.map((item) => {
              const isCrit = item.status === "critical";
              const isWarn = item.status === "warning";

              return (
                <div
                  key={item.id}
                  className={`p-3.5 sm:p-4 rounded-2xl transition-all ${
                    isCrit
                      ? "bg-white dark:bg-[#1F2330] border-l-4 border-l-[#991B1B] border-t border-r border-b border-[#E8D9C0] dark:border-[#31374A] shadow-2xs hover:border-[#991B1B]/60"
                      : isWarn
                      ? "bg-white dark:bg-[#1F2330] border-l-4 border-l-[#C99A45] border-t border-r border-b border-[#E8D9C0] dark:border-[#31374A] shadow-2xs hover:border-[#C99A45]/60"
                      : "bg-white dark:bg-[#1F2330] border-l-4 border-l-emerald-500 border-t border-r border-b border-[#E8D9C0] dark:border-[#31374A] shadow-2xs hover:border-emerald-500/60"
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase border ${
                            isCrit
                              ? "bg-[#991B1B]/10 dark:bg-[#991B1B]/20 text-[#991B1B] dark:text-[#FCA5A5] border-[#991B1B]/30"
                              : isWarn
                              ? "bg-[#C99A45]/15 dark:bg-[#C99A45]/20 text-[#946B1E] dark:text-[#E5BC6B] border-[#C99A45]/30"
                              : "bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border-emerald-300"
                          }`}
                        >
                          {isCrit ? "🔴 Critical Weakness" : isWarn ? "🟡 Needs Review" : "🟢 Mastered"}
                        </span>
                        <span className="text-[10px] text-[#787D91] dark:text-[#929AB0] font-bold">
                          {item.chapterName}
                        </span>
                      </div>

                      <h4 className="text-xs sm:text-sm font-extrabold text-[#171923] dark:text-[#FFF9EF] truncate">
                        {item.name}
                      </h4>

                      <p className="text-[11px] text-[#52576A] dark:text-[#CBD2E1] font-medium mt-0.5 flex items-center gap-1.5">
                        <span className={`font-bold ${isCrit ? "text-[#991B1B] dark:text-[#F87171]" : isWarn ? "text-[#C99A45]" : "text-emerald-600"}`}>
                          AI Diagnosis:
                        </span>
                        <span>{item.weakReason}</span>
                      </p>
                    </div>

                    {/* Stats & Mini Drill Button */}
                    <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
                      <div className="text-right">
                        <div className="flex items-baseline justify-end gap-1 font-mono">
                          <span
                            className={`text-base font-black tabular-nums ${
                              isCrit
                                ? "text-[#991B1B] dark:text-[#F87171]"
                                : isWarn
                                ? "text-[#C99A45] dark:text-[#E5BC6B]"
                                : "text-emerald-600 dark:text-emerald-400"
                            }`}
                          >
                            {item.accuracy}%
                          </span>
                          <span className="text-[9px] font-bold text-[#787D91]">
                            Accuracy
                          </span>
                        </div>
                        <span className="text-[10px] text-[#787D91] dark:text-[#929AB0] font-mono block">
                          {item.wrong} Wrong / {item.attempted} Attempted
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleStartTopicDrill(item)}
                        className={`h-8 px-3 rounded-xl text-xs font-black flex items-center gap-1 active:scale-95 transition-all cursor-pointer ${
                          isCrit
                            ? "bg-[#991B1B] hover:bg-[#7F1D1D] text-white shadow-xs border border-[#991B1B]/30"
                            : "bg-[#800020] hover:bg-[#5E0017] text-white shadow-xs border border-[#C99A45]/30"
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
                        isCrit ? "bg-[#991B1B]" : isWarn ? "bg-[#C99A45]" : "bg-emerald-500"
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

      {/* 5. 1-CLICK CUSTOMIZED BOOSTER TEST (THE BIG ACTION) */}
      <section className="bg-gradient-to-r from-[#800020] via-[#5E0017] to-[#171923] rounded-3xl p-5 sm:p-6 text-white shadow-xl shadow-[#800020]/25 relative overflow-hidden">
        {/* Glow */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-bl from-[#F47B20]/30 to-transparent rounded-full blur-2xl pointer-events-none" />

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5 relative z-10">
          <div className="max-w-xl">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-wider bg-white/15 text-[#FFF9EF] border border-white/20 mb-2">
              <Sparkles className="w-3.5 h-3.5 text-[#F47B20]" />
              <span>Targeted Remedial Test</span>
            </div>
            <h3 className="text-xl sm:text-2xl font-black tracking-tight leading-snug">
              ⚡ Take My AI Weakness Booster Test
            </h3>
            <p className="text-xs sm:text-[13px] text-white/80 font-medium mt-1 leading-relaxed">
              AI has curated a 20-question remedial test based on your previous mistakes ({baseStats.totalWrong} wrong questions) and weakest chapters. Take the test now to eliminate your weak spots!
            </p>
          </div>

          <div className="shrink-0">
            <button
              type="button"
              onClick={handleStartCustomizedBoosterTest}
              className="w-full sm:w-auto h-12 sm:h-14 px-6 rounded-2xl bg-gradient-to-r from-[#F47B20] to-[#E05A10] hover:brightness-110 text-white font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-[#F47B20]/30 active:scale-95 transition-all cursor-pointer border border-amber-300/40"
            >
              <Flame className="w-5 h-5 fill-white text-white animate-pulse" />
              <span>Start Booster Test (20 Qs)</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </section>

      {/* 6. ADDITIONAL PROGRESS METRICS: SPEED, SPACING & RETENTION */}
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Metric 1: Spaced Retention Due */}
        <div className="bg-white dark:bg-[#1F2330] rounded-2xl p-4 border border-[#E8D9C0] dark:border-[#31374A] shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-black uppercase tracking-wider text-[#787D91] dark:text-[#929AB0]">
              Revision Due (Memory Curve)
            </span>
            <Brain className="w-4 h-4 text-[#800020] dark:text-[#F47B20]" />
          </div>
          <div>
            <div className="flex items-baseline gap-1 font-mono">
              <span className="text-2xl font-black text-[#171923] dark:text-[#FFF9EF] tabular-nums">
                {baseStats.dueQuestions.length}
              </span>
              <span className="text-xs font-bold text-[#787D91]">Questions Remaining</span>
            </div>
            <p className="text-[10px] text-[#52576A] dark:text-[#CBD2E1] font-medium mt-1">
              Essential to review within 24-48 hours
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              if (baseStats.dueQuestions.length > 0 && onStartSession) {
                onStartSession({
                  title: "Due Spaced Revision",
                  subtitle: `${baseStats.dueQuestions.length} Questions Revision`,
                  questionIds: baseStats.dueQuestions.map((q) => q.id),
                  source: "all-chapters",
                });
              } else {
                onNavigateTab?.("topics");
              }
            }}
            className="text-[11px] font-black text-[#800020] dark:text-[#F47B20] mt-3 pt-2 border-t border-[#E8D9C0]/80 dark:border-[#31374A] flex items-center justify-between hover:underline cursor-pointer"
          >
            <span>Start Revision</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Metric 2: Syllabus Coverage */}
        <div className="bg-white dark:bg-[#1F2330] rounded-2xl p-4 border border-[#E8D9C0] dark:border-[#31374A] shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-black uppercase tracking-wider text-[#787D91] dark:text-[#929AB0]">
              Syllabus Coverage
            </span>
            <BookOpen className="w-4 h-4 text-[#800020] dark:text-[#F47B20]" />
          </div>
          <div>
            <div className="flex items-baseline gap-1 font-mono">
              <span className="text-2xl font-black text-[#171923] dark:text-[#FFF9EF] tabular-nums">
                {questions.length > 0 ? Math.round((baseStats.totalPracticed / questions.length) * 100) : 0}%
              </span>
              <span className="text-xs font-bold text-[#787D91]">
                ({baseStats.totalPracticed}/{questions.length})
              </span>
            </div>
            <p className="text-[10px] text-[#52576A] dark:text-[#CBD2E1] font-medium mt-1">
              Portion of Disha PYQ question bank completed
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigateTab?.("topics")}
            className="text-[11px] font-black text-[#800020] dark:text-[#F47B20] mt-3 pt-2 border-t border-[#E8D9C0]/80 dark:border-[#31374A] flex items-center justify-between hover:underline cursor-pointer"
          >
            <span>Practice New Chapters</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Metric 3: Weak Topics Count */}
        <div className="bg-white dark:bg-[#1F2330] rounded-2xl p-4 border border-[#E8D9C0] dark:border-[#31374A] shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-black uppercase tracking-wider text-[#787D91] dark:text-[#929AB0]">
              Weak Topics Count
            </span>
            <AlertTriangle className="w-4 h-4 text-[#991B1B] dark:text-[#F87171]" />
          </div>
          <div>
            <div className="flex items-baseline gap-1 font-mono">
              <span className="text-2xl font-black text-[#991B1B] dark:text-[#F87171] tabular-nums">
                {criticalWeakList.length}
              </span>
              <span className="text-xs font-bold text-[#787D91]">Chapters Needing Attention</span>
            </div>
            <p className="text-[10px] text-[#52576A] dark:text-[#CBD2E1] font-medium mt-1">
              Where accuracy is under 50% or mistakes are frequent
            </p>
          </div>
          <button
            type="button"
            onClick={() => setActiveFilter("critical")}
            className="text-[11px] font-black text-[#991B1B] dark:text-[#F87171] mt-3 pt-2 border-t border-[#E8D9C0]/80 dark:border-[#31374A] flex items-center justify-between hover:underline cursor-pointer"
          >
            <span>Filter Weaknesses</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </section>
    </div>
  );
};
