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
    let gradeLabel = "प्रारंभिक स्तर (Needs Foundation)";
    let gradeColor = "text-[#991B1B] dark:text-[#F87171]";
    let gradeBadgeBg = "bg-[#991B1B]/10 dark:bg-[#991B1B]/20 text-[#991B1B] dark:text-[#F87171] border-[#991B1B]/30";

    if (readinessScore >= 80) {
      grade = "A+";
      gradeLabel = "रैंकर्स लीग (Exam Ready)";
      gradeColor = "text-emerald-600 dark:text-emerald-400";
      gradeBadgeBg = "bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border-emerald-400 dark:border-emerald-700";
    } else if (readinessScore >= 65) {
      grade = "A";
      gradeLabel = "सशक्त स्थिति (Strong Aspirant)";
      gradeColor = "text-[#800020] dark:text-[#F47B20]";
      gradeBadgeBg = "bg-[#800020]/10 dark:bg-[#F47B20]/15 text-[#800020] dark:text-[#F47B20] border-[#800020]/30 dark:border-[#F47B20]/40";
    } else if (readinessScore >= 50) {
      grade = "B";
      gradeLabel = "संतोषजनक (Needs Polish)";
      gradeColor = "text-[#C99A45] dark:text-[#E5BC6B]";
      gradeBadgeBg = "bg-[#C99A45]/15 dark:bg-[#C99A45]/20 text-[#946B1E] dark:text-[#E5BC6B] border-[#C99A45]/40";
    } else if (readinessScore >= 35) {
      grade = "C";
      gradeLabel = "कमजोर (High Negative Risk)";
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
      let weakReason = "मजबूत पकड़ • निरंतर अभ्यास बनाए रखें";

      if (accuracy < 50 || wrong >= 3) {
        status = "critical";
        if (accuracy < 30) {
          weakReason = "गंभीर कॉन्सेप्ट गैप • थ्योरी को दोबारा पढ़ना अनिवार्य";
        } else if (wrong >= 4) {
          weakReason = "बार-बार गलत विकल्प चुनना • नेगेटिव मार्किंग का बड़ा खतरा";
        } else {
          weakReason = "कन्फ्यूजन व सिली मिस्टेक • त्वरित बूस्टर टेस्ट की जरूरत";
        }
      } else if (accuracy < 75) {
        status = "warning";
        weakReason = "औसत सटीकता • कठिन प्रश्नों पर थोड़ा संशय";
      } else {
        status = "mastered";
        weakReason = "शानदार पकड़ • 75%+ सटीकता हासिल";
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
        title: `🔴 सबसे गंभीर कमजोरी: '${topWeak.name}'`,
        desc: `इस टॉपिक में आपने ${topWeak.attempted} में से ${topWeak.wrong} प्रश्न गलत किए हैं (${topWeak.accuracy}% एक्यूरेसी). मुख्य परीक्षा में यह टॉपिक आपको सीधे कटऑफ से बाहर कर सकता है. इसे आज ही क्लियर करें!`,
        type: "alert",
      });
    } else if (baseStats.totalPracticed === 0) {
      remarks.push({
        icon: Info,
        title: "अभ्यास अभी शुरू नहीं हुआ है",
        desc: "जब आप कम से कम 20-30 प्रश्न हल करेंगे, तब AI आपकी व्यक्तिगत कमियों और नेगेटिव मार्किंग का सटीक रडार तैयार करेगा.",
        type: "tip",
      });
    } else {
      remarks.push({
        icon: ShieldCheck,
        title: "🟢 कोई गंभीर लाल निशान नहीं",
        desc: "आपने अभ्यास किए गए टॉपिक्स में 50% से अधिक एक्यूरेसी बनाए रखी है. अब कठिन व विश्लेषणात्मक प्रश्नों पर ध्यान दें.",
        type: "success",
      });
    }

    // Remark 2: Negative Marking Damage
    if (baseStats.negativeMarksLost > 0) {
      remarks.push({
        icon: TrendingDown,
        title: `⚠️ तुक्केबाजी की मार: -${baseStats.negativeMarksLost} अंक का नुकसान`,
        desc: `आपने ${baseStats.totalWrong} गलत उत्तर दिए हैं. यदि आप संशय वाले प्रश्न छोड़ देते, तो आपके ये ${baseStats.negativeMarksLost} अंक सुरक्षित रहते. 1/3 नेगेटिव मार्किंग वाली प्रतियोगी परीक्षाओं में यह 500 से 2,000 रैंक का अंतर पैदा करता है!`,
        type: "warning",
      });
    }

    // Remark 3: Forgetting Curve / Spaced Repetition
    if (baseStats.dueQuestions.length > 0) {
      remarks.push({
        icon: Brain,
        title: `🧠 भूलने की अवस्था: ${baseStats.dueQuestions.length} प्रश्न रिवीजन ड्यू`,
        desc: `एबिंगहॉस विस्मरण वक्र (Forgetting Curve) के अनुसार, जो प्रश्न आपने कुछ दिन पहले पढ़े थे, वे अब मस्तिष्क से धुंधले हो रहे हैं. आज 15 मिनट निकालकर इनका स्पैस्ड रिवीजन करें.`,
        type: "tip",
      });
    }

    // Remark 4: Action Plan
    remarks.push({
      icon: Zap,
      title: "⚡ आज का एक्शन प्लान",
      desc: "नीचे दिए 'AI कमजोरी बूस्टर टेस्ट' बटन को दबाएं. AI ने आपकी गलतियों और कमजोर अध्यायों से 20 प्रश्नों का स्पेशल सेट बनाया है. इसे 80%+ स्कोर तक ले जाएं.",
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
      title: "🔥 AI कमजोरी सुधार बूस्टर टेस्ट",
      subtitle: `शीर्ष कमजोर टॉपिक्स के ${selected.length} महत्वपूर्ण प्रश्न • 1/3 नेगेटिव मार्किंग`,
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
      title: `${item.name} — AI सुधारात्मक अभ्यास`,
      subtitle: `${item.chapterName} • 15 लक्षित प्रश्न`,
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

    const studentName = userProfile?.full_name || userProfile?.name || "अभ्यर्थी";
    const examTarget = settings?.selectedExam || "राजस्थान प्रतियोगी परीक्षा (RPSC / CET / Patwar / REET)";

    const weakText = criticalWeakList.length > 0
      ? criticalWeakList.slice(0, 3).map((w, i) => `${i + 1}. ${w.name} (${w.accuracy}% सटीकता - ${w.wrong} गलत)`).join("\n")
      : "कोई गंभीर कमजोरी नहीं • संतुलन अच्छा है";

    const reportCardText = `📋 *दिशा 20-20 — छात्र AI कमजोरी व प्रोग्रेस रिपोर्ट कार्ड*
━━━━━━━━━━━━━━━━━━
👤 अभ्यर्थी: ${studentName}
🎯 लक्ष्य: ${examTarget}
📅 दिनांक: ${todayStr}

📊 *स्कोर व परफॉर्मेंस ऑडिट:*
• परीक्षा तत्परता स्कोर: ${baseStats.readinessScore}/100 [ग्रेड: ${baseStats.grade} - ${baseStats.gradeLabel}]
• कुल हल प्रश्न: ${baseStats.totalPracticed}
• कुल सटीकता: ${baseStats.accuracy}%
• सही: ${baseStats.totalCorrect} | गलत: ${baseStats.totalWrong}
• ⚠️ नेगेटिव मार्किंग नुकसान: -${baseStats.negativeMarksLost} अंक
• 🧠 स्मृति रिवीजन ड्यू: ${baseStats.dueQuestions.length} प्रश्न

🔴 *शीर्ष कमजोर टॉपिक्स (सुधार अपेक्षित):*
${weakText}

💡 *AI गुरुजी की सीधी सलाह:*
तुक्केबाजी से बचें, कमजोर अध्यायों का 1-क्लिक बूस्टर टेस्ट दें और नेगेटिव मार्किंग रोकें!

📱 अपनी कमजोरी जांचें और बूस्टर टेस्ट दें:
https://disha2020.in
━━━━━━━━━━━━━━━━━━`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: "दिशा 20-20 छात्र AI रिपोर्ट कार्ड",
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
        <div className="absolute top-0 right-0 w-56 h-56 bg-gradient-to-bl from-[#800020]/15 via-[#F47B20]/10 to-transparent rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10 border-b border-[#E8D9C0] dark:border-[#31374A] pb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#800020] to-[#F47B20] text-white flex items-center justify-center font-black shadow-md shadow-[#800020]/20 shrink-0">
              <Award className="w-6 h-6" />
            </div>
            <div>
              <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider bg-[#800020]/10 dark:bg-[#F47B20]/15 text-[#800020] dark:text-[#F47B20] mb-1">
                <span>DISHA 20-20 AI Diagnostic Audit</span>
              </div>
              <h2 className="text-lg sm:text-xl font-black text-[#171923] dark:text-[#FFF9EF] tracking-tight">
                छात्र AI रिपोर्ट कार्ड व कमजोरी रडार
              </h2>
              <p className="text-[11px] text-[#52576A] dark:text-[#CBD2E1] font-medium">
                आपकी वास्तविक कमियों, नेगेटिव मार्किंग नुकसान और सुधार का पूर्ण विश्लेषण
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
              <span>{copiedSummary ? "कॉपी हो गया!" : "रिपोर्ट कार्ड शेयर करें"}</span>
            </button>
          </div>
        </div>

        {/* Candidate & Audit Details Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-4 relative z-10 text-[11px]">
          <div className="p-2.5 rounded-xl bg-[#FFF9EF] dark:bg-[#171923] border border-[#E8D9C0]/80 dark:border-[#31374A]">
            <span className="text-[9px] font-bold uppercase tracking-wider text-[#787D91] dark:text-[#929AB0] block mb-0.5">
              अभ्यर्थी का नाम
            </span>
            <span className="font-extrabold text-[#171923] dark:text-[#FFF9EF] truncate block">
              {userProfile?.full_name || userProfile?.name || "प्रिय अभ्यर्थी"}
            </span>
          </div>

          <div className="p-2.5 rounded-xl bg-[#FFF9EF] dark:bg-[#171923] border border-[#E8D9C0]/80 dark:border-[#31374A]">
            <span className="text-[9px] font-bold uppercase tracking-wider text-[#787D91] dark:text-[#929AB0] block mb-0.5">
              लक्ष्य परीक्षा
            </span>
            <span className="font-extrabold text-[#800020] dark:text-[#F47B20] truncate block">
              {settings?.selectedExam || "राजस्थान प्रतियोगी परीक्षा"}
            </span>
          </div>

          <div className="p-2.5 rounded-xl bg-[#FFF9EF] dark:bg-[#171923] border border-[#E8D9C0]/80 dark:border-[#31374A]">
            <span className="text-[9px] font-bold uppercase tracking-wider text-[#787D91] dark:text-[#929AB0] block mb-0.5">
              ऑडिट दिनांक
            </span>
            <span className="font-extrabold text-[#171923] dark:text-[#FFF9EF] block font-mono">
              {todayStr}
            </span>
          </div>

          <div className="p-2.5 rounded-xl bg-[#FFF9EF] dark:bg-[#171923] border border-[#E8D9C0]/80 dark:border-[#31374A]">
            <span className="text-[9px] font-bold uppercase tracking-wider text-[#787D91] dark:text-[#929AB0] block mb-0.5">
              समग्र स्थिति
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
                <span>परीक्षा तत्परता सूचकांक</span>
              </span>
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black border ${baseStats.gradeBadgeBg}`}>
                ग्रेड {baseStats.grade}
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
                कुल अभ्यास
              </span>
              <span className="text-base font-black text-[#171923] dark:text-[#FFF9EF] font-mono tabular-nums">
                {baseStats.totalPracticed} प्रश्न
              </span>
            </div>
            <div>
              <span className="text-[9px] font-bold text-[#787D91] dark:text-[#929AB0] uppercase block">
                सटीकता (Accuracy)
              </span>
              <span className="text-base font-black text-emerald-600 dark:text-emerald-400 font-mono tabular-nums">
                {baseStats.accuracy}%
              </span>
            </div>
            <div>
              <span className="text-[9px] font-bold text-[#787D91] dark:text-[#929AB0] uppercase block">
                सही उत्तर
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
                <span>नेगेटिव मार्किंग व तुक्केबाजी की मार</span>
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
                अंक कटे
              </span>
              <span className="text-xs font-bold text-[#52576A] dark:text-[#CBD2E1] ml-auto">
                ({baseStats.totalWrong} गलत प्रश्न)
              </span>
            </div>

            <div className="bg-white/95 dark:bg-[#1F2330]/95 p-3 rounded-2xl border border-[#800020]/15 dark:border-[#800020]/30 text-[11px] leading-relaxed text-[#171923] dark:text-[#FFF9EF] font-medium space-y-1">
              <p className="font-bold text-[#991B1B] dark:text-[#F87171]">
                ⚠️ कठोर वास्तविकता (Harsh Truth):
              </p>
              <p>
                {baseStats.negativeMarksLost > 0 ? (
                  <>
                    गलत उत्तरों के कारण आपके <strong className="text-[#991B1B] dark:text-[#F87171] font-black">{baseStats.negativeMarksLost} अंक</strong> कट गए. यदि आप इन प्रश्नों को छोड़ देते तो आपकी मेरिट सूची में <strong className="text-emerald-600 font-black">सैकड़ों अभ्यर्थियों से ऊपर</strong> रैंक होती!
                  </>
                ) : (
                  <>
                    शानदार! अभी तक आपके कोई नेगेटिव अंक नहीं कटे हैं. आगे भी इसी तरह सोच-समझकर सटीक उत्तर दें.
                  </>
                )}
              </p>
            </div>
          </div>

          <div className="pt-3 mt-3 border-t border-[#800020]/15 dark:border-[#800020]/30 flex items-center justify-between text-[11px]">
            <span className="text-[#52576A] dark:text-[#CBD2E1]">
              गलत प्रश्नों का तुरंत सुधार करें:
            </span>
            <button
              type="button"
              onClick={() => onNavigateTab?.("wrong")}
              className="text-xs font-extrabold text-[#800020] dark:text-[#F47B20] hover:underline flex items-center gap-1 cursor-pointer"
            >
              <span>गलत प्रश्न देखें ({baseStats.totalWrong})</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </section>

      {/* 3. AI GURU DIRECT DIAGNOSTIC REMARKS ("तेरी कमियां कहां पर है") */}
      <section className="bg-white dark:bg-[#1F2330] rounded-3xl p-5 sm:p-6 border border-[#E8D9C0] dark:border-[#31374A] shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-[#800020]/10 dark:bg-[#F47B20]/15 text-[#800020] dark:text-[#F47B20] flex items-center justify-center">
              <Brain className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs sm:text-sm font-black uppercase tracking-wider text-[#171923] dark:text-[#FFF9EF]">
                AI गुरुजी की सीधी खरी समीक्षा
              </h3>
              <p className="text-[10px] font-bold text-[#787D91] dark:text-[#929AB0] uppercase tracking-widest">
                Direct Unvarnished Diagnostic Insights
              </p>
            </div>
          </div>
          <span className="text-[10px] font-extrabold text-[#800020] dark:text-[#F47B20] px-2 py-0.5 rounded-full bg-[#800020]/10 dark:bg-[#F47B20]/15">
            बिना लाग-लपेट सच
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

      {/* 4. THE CORE WEAKNESS RADAR (कमजोरियों का रडार - EXACT TOPICS & FLAW REASONS) */}
      <section className="bg-white dark:bg-[#1F2330] rounded-3xl p-5 sm:p-6 border border-[#E8D9C0] dark:border-[#31374A] shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-xs sm:text-sm font-black uppercase tracking-wider text-[#171923] dark:text-[#FFF9EF] flex items-center gap-2">
              <Target className="w-4 h-4 text-[#800020] dark:text-[#F47B20]" />
              <span>कमजोरियों का AI रडार (Flaw & Vulnerability Radar)</span>
            </h3>
            <p className="text-[10px] font-bold text-[#787D91] dark:text-[#929AB0] uppercase tracking-widest mt-0.5">
              कहाँ-कहाँ कट रहे हैं अंक • टॉपिकवार विस्तृत रिपोर्ट
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
              रेड अलर्ट ({criticalWeakList.length})
            </button>
            <button
              onClick={() => setActiveFilter("warning")}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold transition-all cursor-pointer ${
                activeFilter === "warning"
                  ? "bg-[#C99A45] text-white shadow-xs border border-[#C99A45]/40"
                  : "text-[#52576A] dark:text-[#CBD2E1] hover:text-[#171923]"
              }`}
            >
              सुधार योग्य ({warningList.length})
            </button>
            <button
              onClick={() => setActiveFilter("mastered")}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold transition-all cursor-pointer ${
                activeFilter === "mastered"
                  ? "bg-emerald-600 text-white shadow-xs border border-emerald-600/40"
                  : "text-[#52576A] dark:text-[#CBD2E1] hover:text-[#171923]"
              }`}
            >
              मजबूत ({masteredList.length})
            </button>
            <button
              onClick={() => setActiveFilter("all")}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold transition-all cursor-pointer ${
                activeFilter === "all"
                  ? "bg-[#800020] text-white shadow-xs border border-[#C99A45]/30"
                  : "text-[#52576A] dark:text-[#CBD2E1] hover:text-[#171923]"
              }`}
            >
              सभी ({topicDiagnostics.length})
            </button>
          </div>
        </div>

        {/* Weak Topics List */}
        {displayedList.length === 0 ? (
          <div className="py-12 text-center bg-[#FFF9EF] dark:bg-[#171923] rounded-2xl border border-dashed border-[#E8D9C0] dark:border-[#31374A] p-6">
            <ShieldCheck className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
            <h4 className="text-xs font-black text-[#171923] dark:text-[#FFF9EF]">
              इस श्रेणी में कोई टॉपिक नहीं है
            </h4>
            <p className="text-[11px] text-[#52576A] dark:text-[#CBD2E1] mt-1 max-w-sm mx-auto">
              {activeFilter === "critical"
                ? "बधाई! आपके किसी भी टॉपिक में गंभीर लाल निशान नहीं है. अपनी सटीकता को इसी तरह बरकरार रखें."
                : "अधिक अभ्यास करने पर आपका AI रडार और अधिक विस्तृत डेटा प्रदर्शित करेगा."}
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
                          {isCrit ? "🔴 गंभीर कमजोरी" : isWarn ? "🟡 सुधार योग्य" : "🟢 मजबूत पकड़"}
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
                          AI निदान:
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
                            सटीकता
                          </span>
                        </div>
                        <span className="text-[10px] text-[#787D91] dark:text-[#929AB0] font-mono block">
                          {item.wrong} गलत / {item.attempted} प्रयास
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
                        <span>सुधारें</span>
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
              <span>कस्टमाइज़्ड AI सुधारात्मक ड्रिल (Targeted Remedial Test)</span>
            </div>
            <h3 className="text-xl sm:text-2xl font-black tracking-tight leading-snug">
              ⚡ मेरी कमजोरियों का AI बूस्टर टेस्ट दें
            </h3>
            <p className="text-xs sm:text-[13px] text-white/80 font-medium mt-1 leading-relaxed">
              AI ने आपकी पिछली गलतियों ({baseStats.totalWrong} गलत प्रश्न) और सबसे कमजोर अध्यायों से 20 सबसे महत्वपूर्ण प्रश्नों का स्पेशल सुधारात्मक सेट तैयार किया है. अभी टेस्ट देकर अपनी कमजोरियों को हमेशा के लिए दूर करें!
            </p>
          </div>

          <div className="shrink-0">
            <button
              type="button"
              onClick={handleStartCustomizedBoosterTest}
              className="w-full sm:w-auto h-12 sm:h-14 px-6 rounded-2xl bg-gradient-to-r from-[#F47B20] to-[#E05A10] hover:brightness-110 text-white font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-[#F47B20]/30 active:scale-95 transition-all cursor-pointer border border-amber-300/40"
            >
              <Flame className="w-5 h-5 fill-white text-white animate-pulse" />
              <span>बूस्टर टेस्ट शुरू करें (20 प्रश्न)</span>
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
              स्मृति ह्रास (Revision Due)
            </span>
            <Brain className="w-4 h-4 text-[#800020] dark:text-[#F47B20]" />
          </div>
          <div>
            <div className="flex items-baseline gap-1 font-mono">
              <span className="text-2xl font-black text-[#171923] dark:text-[#FFF9EF] tabular-nums">
                {baseStats.dueQuestions.length}
              </span>
              <span className="text-xs font-bold text-[#787D91]">प्रश्न बाकी</span>
            </div>
            <p className="text-[10px] text-[#52576A] dark:text-[#CBD2E1] font-medium mt-1">
              जिन्हें 24-48 घंटे में दोहराना जरूरी है
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              if (baseStats.dueQuestions.length > 0 && onStartSession) {
                onStartSession({
                  title: "Due Spaced Revision",
                  subtitle: `${baseStats.dueQuestions.length} प्रश्न रिवीजन`,
                  questionIds: baseStats.dueQuestions.map((q) => q.id),
                  source: "all-chapters",
                });
              } else {
                onNavigateTab?.("topics");
              }
            }}
            className="text-[11px] font-black text-[#800020] dark:text-[#F47B20] mt-3 pt-2 border-t border-[#E8D9C0]/80 dark:border-[#31374A] flex items-center justify-between hover:underline cursor-pointer"
          >
            <span>रिवीजन शुरू करें</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Metric 2: Syllabus Coverage */}
        <div className="bg-white dark:bg-[#1F2330] rounded-2xl p-4 border border-[#E8D9C0] dark:border-[#31374A] shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-black uppercase tracking-wider text-[#787D91] dark:text-[#929AB0]">
              सिलेबस कवरेज
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
              दिशा 20-20 प्रश्न बैंक का हल किया गया भाग
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigateTab?.("topics")}
            className="text-[11px] font-black text-[#800020] dark:text-[#F47B20] mt-3 pt-2 border-t border-[#E8D9C0]/80 dark:border-[#31374A] flex items-center justify-between hover:underline cursor-pointer"
          >
            <span>नए अध्याय हल करें</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Metric 3: Weak Topics Count */}
        <div className="bg-white dark:bg-[#1F2330] rounded-2xl p-4 border border-[#E8D9C0] dark:border-[#31374A] shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-black uppercase tracking-wider text-[#787D91] dark:text-[#929AB0]">
              कमजोर टॉपिक्स संख्या
            </span>
            <AlertTriangle className="w-4 h-4 text-[#991B1B] dark:text-[#F87171]" />
          </div>
          <div>
            <div className="flex items-baseline gap-1 font-mono">
              <span className="text-2xl font-black text-[#991B1B] dark:text-[#F87171] tabular-nums">
                {criticalWeakList.length}
              </span>
              <span className="text-xs font-bold text-[#787D91]">अध्यायों में सुधार बाकी</span>
            </div>
            <p className="text-[10px] text-[#52576A] dark:text-[#CBD2E1] font-medium mt-1">
              जहाँ एक्यूरेसी 50% से कम या गलतियां अधिक हैं
            </p>
          </div>
          <button
            type="button"
            onClick={() => setActiveFilter("critical")}
            className="text-[11px] font-black text-[#991B1B] dark:text-[#F87171] mt-3 pt-2 border-t border-[#E8D9C0]/80 dark:border-[#31374A] flex items-center justify-between hover:underline cursor-pointer"
          >
            <span>कमजोरियां फ़िल्टर करें</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </section>
    </div>
  );
};
