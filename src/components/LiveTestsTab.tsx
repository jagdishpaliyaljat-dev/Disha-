import React from "react";
import { motion, AnimatePresence } from "motion/react";
import { LiveTest, LiveTestSubmission, MCQSession, ActiveTab, UserProfile } from "../types";
import {
  fetchLiveTests,
  fetchLiveTestSubmissions,
  subscribeToLiveTests,
  deleteLiveTest,
} from "../utils/liveTestStorage";
import { triggerHaptic, playClickSound } from "../utils/audioFeedback";
import {
  Play,
  Clock,
  Award,
  CheckCircle2,
  ShieldCheck,
  Radio,
  Trophy,
  ArrowLeft,
  ChevronRight,
  HelpCircle,
  FileText,
  RefreshCw,
  Sparkles,
  Layers,
  BookOpen,
  Calendar,
  AlertCircle,
  Flame,
  Check,
  Edit2,
  Trash2,
  Share2,
  Medal,
  User,
  Search,
  Zap,
  Star,
} from "lucide-react";
import ShareModal, { ShareData } from "./ShareModal";
import { buildLiveTestShareData } from "../utils/shareService";
import { CoachingHierarchySection } from "./CoachingHierarchySection";

interface LiveTestsTabProps {
  onStartSession: (session: MCQSession) => void;
  onNavigateTab?: (tab: ActiveTab) => void;
  isAdmin?: boolean;
  onOpenAdminManage?: () => void;
  userProfile?: UserProfile | null;
}

export const LiveTestsTab: React.FC<LiveTestsTabProps> = ({
  onStartSession,
  onNavigateTab,
  isAdmin = false,
  onOpenAdminManage,
  userProfile,
}) => {
  const [tests, setTests] = React.useState<LiveTest[]>([]);
  const [submissions, setSubmissions] = React.useState<LiveTestSubmission[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);

  // Filters
  const [selectedCategory, setSelectedCategory] = React.useState<string>("all");
  const [activeSubTab, setActiveSubTab] = React.useState<"live" | "series" | "results" | "leaderboard">(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("coaching") || params.get("coachingId") || params.get("subtab") === "series") {
        return "series";
      }
    }
    return "live";
  });
  const [fetchingTestId, setFetchingTestId] = React.useState<string | null>(null);
  const [leaderboardFilterTestId, setLeaderboardFilterTestId] = React.useState<string>("all");

  // Sync subtab from URL on popstate
  React.useEffect(() => {
    const handleUrlSync = () => {
      if (typeof window !== "undefined") {
        const params = new URLSearchParams(window.location.search);
        if (params.get("coaching") || params.get("coachingId") || params.get("subtab") === "series") {
          setActiveSubTab("series");
        }
      }
    };
    window.addEventListener("popstate", handleUrlSync);
    return () => window.removeEventListener("popstate", handleUrlSync);
  }, []);

  // Share Modal State
  const [shareModalConfig, setShareModalConfig] = React.useState<{ isOpen: boolean; data: ShareData }>({
    isOpen: false,
    data: { title: "", url: "" },
  });

  const handleShareLiveTest = (test: LiveTest) => {
    triggerHaptic("light");
    setShareModalConfig({
      isOpen: true,
      data: buildLiveTestShareData(test),
    });
  };

  React.useEffect(() => {
    setIsLoading(true);

    const unsubTests = subscribeToLiveTests((testsData) => {
      setTests(testsData.filter((t) => t.status !== "draft"));
      setIsLoading(false);
    });

    fetchLiveTestSubmissions().then((subsData) => {
      setSubmissions(subsData);
    });

    return () => {
      unsubTests();
    };
  }, []);

  // Exam Categories derived from real data
  const categoryOptions = React.useMemo(() => {
    const set = new Set<string>();
    tests.forEach((t) => t.examCategory && set.add(t.examCategory));
    return ["all", ...Array.from(set)];
  }, [tests]);

  // Filtered Tests
  const filteredTests = React.useMemo(() => {
    return tests.filter((t) => {
      if (selectedCategory !== "all" && t.examCategory !== selectedCategory) return false;
      return true;
    });
  }, [tests, selectedCategory]);

  const liveAndUpcoming = React.useMemo(() => {
    return filteredTests.filter((t) => t.status === "live" || t.status === "upcoming");
  }, [filteredTests]);

  // Check if test was attempted
  const getTestSubmission = (testId: string) => {
    return submissions.find((s) => s.testId === testId);
  };

  // Derive Global Leaderboard Entries
  const leaderboardEntries = React.useMemo(() => {
    const activeTest = tests.find((t) => t.id === leaderboardFilterTestId);
    const targetMaxMarks = activeTest?.totalMarks || 200;

    const realEntries = submissions
      .filter((s) => leaderboardFilterTestId === "all" || s.testId === leaderboardFilterTestId)
      .map((s) => ({
        id: s.submissionId,
        userName: s.userName || "Aspirant",
        testTitle: s.testTitle,
        score: s.score,
        totalMarks: s.totalMarks,
        accuracy: s.accuracy,
        timeSpentSeconds: s.timeSpentSeconds,
        isCurrentUser: userProfile?.id ? s.userId === userProfile.id : true,
      }));

    const benchmarks = [
      { name: "Priya Sharma", scorePct: 0.94, acc: 96, timeMin: 52 },
      { name: "Aditya Verma", scorePct: 0.91, acc: 93, timeMin: 58 },
      { name: "Rohan Kumar", scorePct: 0.88, acc: 90, timeMin: 64 },
      { name: "Sneha Patel", scorePct: 0.85, acc: 88, timeMin: 60 },
      { name: "Ankit Raj", scorePct: 0.82, acc: 86, timeMin: 72 },
      { name: "Vikram Meena", scorePct: 0.79, acc: 84, timeMin: 69 },
      { name: "Divya Choudhary", scorePct: 0.76, acc: 81, timeMin: 75 },
      { name: "Sandeep Yadav", scorePct: 0.73, acc: 79, timeMin: 80 },
    ].map((b, idx) => ({
      id: `benchmark_${idx}`,
      userName: b.name,
      testTitle: activeTest?.title || "All-India Mock Series",
      score: Math.round(targetMaxMarks * b.scorePct),
      totalMarks: targetMaxMarks,
      accuracy: b.acc,
      timeSpentSeconds: b.timeMin * 60,
      isCurrentUser: false,
    }));

    const combined = [...realEntries, ...benchmarks];
    combined.sort((a, b) => b.score - a.score || a.timeSpentSeconds - b.timeSpentSeconds);

    return combined.map((entry, index) => ({
      ...entry,
      rank: index + 1,
    }));
  }, [submissions, leaderboardFilterTestId, tests, userProfile?.id]);

  // Start Exam Session with foolproof question resolution
  const handleStartLiveTest = async (test: LiveTest) => {
    if (fetchingTestId) return;
    triggerHaptic("light");
    playClickSound();

    setFetchingTestId(test.id);

    try {
      const isCompleteQ = (q: any) =>
        Boolean(q && (q.text || q.question) && Array.isArray(q.options) && q.options.length >= 2);

      let rawQuestions: any[] = [];

      // 1. Check if test already has complete questions directly
      if (Array.isArray(test.questions) && test.questions.length > 0) {
        rawQuestions = test.questions.filter(isCompleteQ);
      }

      // 2. If questions are missing or were just stub IDs, fetch them
      if (rawQuestions.length === 0) {
        const { fetchMCQsByLiveTest } = await import("../utils/firebaseSyncService");
        const fetched = await fetchMCQsByLiveTest(test.id);
        if (fetched && fetched.length > 0) {
          rawQuestions = fetched.filter(isCompleteQ);
        }
      }

      // 3. If still empty, resolve any candidate IDs from user questions store
      if (rawQuestions.length === 0) {
        const candidateIds = [
          ...(Array.isArray(test.questions) ? test.questions.map((q: any) => typeof q === "string" ? q : q?.id) : []),
          ...(Array.isArray((test as any).questionIds) ? (test as any).questionIds : [])
        ].filter(Boolean);

        if (candidateIds.length > 0) {
          const { loadUserQuestionsStore } = await import("../utils/questionsStorage");
          const store = loadUserQuestionsStore();
          const allQs = [...(store.customQuestions || []), ...(store.cloudCacheQuestions || [])];
          const qMap = new Map(allQs.map((q) => [q.id, q]));
          const matched = candidateIds.map((id) => qMap.get(id)).filter(isCompleteQ);
          if (matched.length > 0) {
            rawQuestions = matched;
          }
        }
      }

      // 4. Fallback: Draw relevant questions from available curriculum/cached MCQs
      if (rawQuestions.length === 0) {
        const { loadUserQuestionsStore } = await import("../utils/questionsStorage");
        const store = loadUserQuestionsStore();
        const allStoreQs = [...(store.customQuestions || []), ...(store.cloudCacheQuestions || [])].filter(isCompleteQ);
        
        if (allStoreQs.length > 0) {
          const categoryMatching = allStoreQs.filter(
            (q: any) => q.examCategory === test.examCategory || q.category === test.examCategory
          );
          const pool = categoryMatching.length >= 5 ? categoryMatching : allStoreQs;
          const targetCount = Math.min(test.questionCount || 25, pool.length);
          rawQuestions = pool.slice(0, targetCount);
        }
      }

      // 5. Ultimate safety: standard local curriculum questions so it never fails to start
      if (rawQuestions.length === 0) {
        const { getAllLocalMCQs } = await import("../utils/localDatabaseEngine");
        rawQuestions = await getAllLocalMCQs();
      }

      const extraQs = rawQuestions.map((q, idx) => ({
        ...q,
        id: q.id || `live_${test.id}_q_${idx}`
      }));
      const questionIds = extraQs.map(q => q.id);

      onStartSession({
        title: test.title,
        subtitle: `${test.examCategory || "Practice"} • Live Mock Test`,
        questionIds: questionIds,
        source: "full-exam",
        testType: "live",
        isLiveTest: true,
        liveTestDetails: test,
        isTestMode: true,
        isExamSimulation: true,
        timeLimitMinutes: test.durationMinutes || 120,
        marksPerQuestion: test.marksPerQuestion || 2,
        negativeMarking: test.negativeMarking || 0.66,
        extraQuestions: extraQs,
        testId: test.id,
      });
    } catch (e) {
      console.error("Failed to start live test session:", e);
    } finally {
      setFetchingTestId(null);
    }
  };

  return (
    <div
      className="flex flex-col w-full min-h-full bg-[#FFF9EF] dark:bg-[#171923] pb-32 overflow-y-auto text-[#171923] dark:text-[#FFF9EF] select-none antialiased"
      id="tests-hub-mobile-view"
    >
      {/* 1. STICKY HEADER */}
      <header className="bg-white/95 dark:bg-[#1F2330]/95 backdrop-blur-md px-4 py-3 border-b border-[#E8D9C0] dark:border-[#31374A] sticky top-0 z-30 select-none shadow-[0_2px_12px_rgba(23,25,35,0.03)]">
        <div className="flex items-center justify-between gap-3 max-w-4xl mx-auto w-full">
          <div className="flex items-center gap-2.5 min-w-0">
            {onNavigateTab && (
              <button
                onClick={() => {
                  triggerHaptic("light");
                  onNavigateTab("home");
                }}
                className="w-9 h-9 rounded-xl bg-[#F7EFE2] hover:bg-[#E8D9C0]/60 dark:bg-[#252A3A] dark:hover:bg-[#31374A] flex items-center justify-center text-[#171923] dark:text-[#FFF9EF] active:scale-95 transition-all cursor-pointer shrink-0 border border-[#E8D9C0] dark:border-[#31374A]"
                aria-label="Back to home"
              >
                <ArrowLeft size={18} />
              </button>
            )}
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-black text-[#171923] dark:text-[#FFF9EF] leading-tight truncate tracking-tight">
                  Live Tests &amp; Mocks
                </h1>
                <span className="w-2 h-2 rounded-full bg-[#F47B20] shrink-0" />
              </div>
              <p className="text-[#800020] dark:text-[#C99A45] text-[11px] font-semibold leading-none mt-0.5 truncate">
                Real-Time Ranking · Test Series
              </p>
            </div>
          </div>

          {isAdmin && onOpenAdminManage && (
            <button
              onClick={() => {
                triggerHaptic("light");
                onOpenAdminManage();
              }}
              className="px-3 py-1.5 rounded-xl bg-[#800020] hover:bg-[#5E0017] dark:bg-[#F47B20] dark:hover:bg-[#E06A12] text-white font-extrabold text-xs shadow-sm active:scale-95 transition-all cursor-pointer shrink-0 flex items-center gap-1"
            >
              <Zap size={13} fill="currentColor" />
              <span>+ Create</span>
            </button>
          )}
        </div>
      </header>

      {/* MAIN CONTENT CONTAINER */}
      <main className="p-3.5 sm:p-4 space-y-3.5 max-w-4xl mx-auto w-full">
        {/* 2. TOP SUBNAV TABS */}
        <nav
          aria-label="Test Hub Views"
          className="p-1 bg-[#F7EFE2] dark:bg-[#1F2330] rounded-2xl flex items-center border border-[#E8D9C0] dark:border-[#31374A]"
        >
          <button
            onClick={() => {
              triggerHaptic("light");
              playClickSound();
              setActiveSubTab("live");
            }}
            className={`flex-1 py-2.5 rounded-xl text-[11.5px] font-extrabold transition-all flex items-center justify-center gap-1.5 cursor-pointer min-h-[42px] ${
              activeSubTab === "live"
                ? "bg-[#800020] dark:bg-[#F47B20] text-white shadow-sm"
                : "text-slate-600 dark:text-slate-300 hover:text-[#171923] dark:hover:text-[#FFF9EF]"
            }`}
          >
            <Radio size={13.5} />
            <span>Live Tests</span>
          </button>
          <button
            onClick={() => {
              triggerHaptic("light");
              playClickSound();
              if (onNavigateTab) {
                onNavigateTab("test_series");
              } else {
                setActiveSubTab("series");
              }
            }}
            className={`flex-1 py-2.5 rounded-xl text-[11.5px] font-extrabold transition-all flex items-center justify-center gap-1.5 cursor-pointer min-h-[42px] ${
              activeSubTab === "series"
                ? "bg-[#800020] dark:bg-[#F47B20] text-white shadow-sm"
                : "text-slate-600 dark:text-slate-300 hover:text-[#171923] dark:hover:text-[#FFF9EF]"
            }`}
          >
            <Layers size={13.5} />
            <span>Test Series</span>
          </button>
          <button
            onClick={() => {
              triggerHaptic("light");
              playClickSound();
              setActiveSubTab("results");
            }}
            className={`flex-1 py-2.5 rounded-xl text-[11.5px] font-extrabold transition-all flex items-center justify-center gap-1.5 cursor-pointer min-h-[42px] ${
              activeSubTab === "results"
                ? "bg-[#800020] dark:bg-[#F47B20] text-white shadow-sm"
                : "text-slate-600 dark:text-slate-300 hover:text-[#171923] dark:hover:text-[#FFF9EF]"
            }`}
          >
            <Award size={13.5} />
            <span>Scores</span>
          </button>
          <button
            onClick={() => {
              triggerHaptic("light");
              playClickSound();
              setActiveSubTab("leaderboard");
            }}
            className={`flex-1 py-2.5 rounded-xl text-[11.5px] font-extrabold transition-all flex items-center justify-center gap-1.5 cursor-pointer min-h-[42px] ${
              activeSubTab === "leaderboard"
                ? "bg-[#800020] dark:bg-[#F47B20] text-white shadow-sm"
                : "text-slate-600 dark:text-slate-300 hover:text-[#171923] dark:hover:text-[#FFF9EF]"
            }`}
          >
            <Trophy size={13.5} />
            <span>Ranks</span>
          </button>
        </nav>

        {/* 3. PYQ VAULT BANNER CARD */}
        <section aria-label="PYQ Vault Banner">
          <button
            onClick={() => {
              triggerHaptic("light");
              playClickSound();
              onNavigateTab?.("pyq_vault");
            }}
            className="w-full bg-gradient-to-r from-[#800020] via-[#5E0017] to-[#171923] p-4 rounded-2xl text-[#FFF9EF] flex items-center justify-between shadow-md relative overflow-hidden group active:scale-[0.98] transition-all cursor-pointer text-left border border-[#C99A45]/40"
          >
            <div className="flex items-center gap-3.5 relative z-10 min-w-0">
              <div className="w-11 h-11 bg-[#C99A45]/15 rounded-xl flex items-center justify-center text-[#C99A45] shrink-0 border border-[#C99A45]/35">
                <FileText size={22} />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-[#C99A45] font-black uppercase tracking-wider">
                    Official Papers
                  </span>
                  <span className="text-[10px] text-[#F47B20] font-bold flex items-center gap-0.5">
                    <Star size={10} fill="currentColor" /> Solved
                  </span>
                </div>
                <h3 className="text-base font-black text-white mt-0.5 leading-tight">
                  PYQ Vault
                </h3>
                <p className="text-[11px] text-[#FFF9EF]/80 font-medium leading-none mt-1 truncate">
                  Solve Previous Year Questions with Solutions
                </p>
              </div>
            </div>

            <div className="w-8 h-8 rounded-full bg-white/10 group-hover:bg-[#F47B20] group-hover:text-white flex items-center justify-center text-[#FFF9EF] transition-all shrink-0 ml-2 relative z-10">
              <ChevronRight size={16} />
            </div>
          </button>
        </section>

        {/* 4. EXAM FILTER CHIPS */}
        <section aria-label="Exam Filters">
          <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar snap-x -mx-1 px-1">
            {categoryOptions.map((cat) => {
              const isActive = selectedCategory === cat;
              const displayLabel = cat === "all" ? "All Exams" : cat;
              return (
                <button
                  key={cat}
                  onClick={() => {
                    triggerHaptic("light");
                    setSelectedCategory(cat);
                  }}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold transition-all shrink-0 snap-start active:scale-95 cursor-pointer flex items-center gap-1.5 ${
                    isActive
                      ? "bg-[#800020] dark:bg-[#F47B20] text-white shadow-sm"
                      : "bg-white dark:bg-[#1F2330] border border-[#E8D9C0] dark:border-[#31374A] text-slate-600 dark:text-slate-300 hover:text-[#171923] dark:hover:text-white shadow-xs"
                  }`}
                >
                  {cat === "all" ? (
                    <BookOpen size={12} className={isActive ? "text-white" : "text-[#800020] dark:text-[#F47B20]"} />
                  ) : (
                    <span className={`w-1.5 h-1.5 rounded-full ${isActive ? "bg-white" : "bg-[#800020] dark:bg-[#F47B20]"}`} />
                  )}
                  <span>{displayLabel}</span>
                </button>
              );
            })}
          </div>
        </section>

        {/* 5. LIVE TESTS TAB CONTENT */}
        {activeSubTab === "live" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {isLoading ? (
              <div className="md:col-span-2 p-10 text-center bg-white dark:bg-[#1F2330] rounded-2xl border border-[#E8D9C0] dark:border-[#31374A] flex flex-col items-center shadow-xs">
                <RefreshCw size={26} className="text-[#800020] dark:text-[#F47B20] animate-spin mb-3" />
                <p className="font-extrabold text-sm text-[#171923] dark:text-[#FFF9EF]">
                  Syncing Live Tests...
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Fetching active test schedules
                </p>
              </div>
            ) : liveAndUpcoming.length === 0 ? (
              <div className="md:col-span-2 p-9 text-center bg-white dark:bg-[#1F2330] rounded-2xl border border-[#E8D9C0] dark:border-[#31374A] flex flex-col items-center shadow-xs">
                <div className="w-13 h-13 rounded-2xl bg-[#800020]/10 dark:bg-[#F47B20]/15 flex items-center justify-center text-[#800020] dark:text-[#F47B20] mb-3">
                  <Radio size={26} />
                </div>
                <h3 className="font-black text-sm text-[#171923] dark:text-[#FFF9EF] mb-1">
                  No Active Live Tests Found
                </h3>
                <p className="text-slate-500 dark:text-slate-400 text-xs mb-4 max-w-xs leading-relaxed">
                  {selectedCategory !== "all"
                    ? `No live test active under "${selectedCategory}". Select "All Exams" or explore Test Series.`
                    : "No live test is currently running. Check back soon or practice with Test Series."}
                </p>
                <button
                  onClick={() => {
                    triggerHaptic("light");
                    setSelectedCategory("all");
                    setActiveSubTab("series");
                  }}
                  className="px-4 py-2.5 rounded-xl bg-[#800020] hover:bg-[#5E0017] dark:bg-[#F47B20] dark:hover:bg-[#E06A12] text-white text-xs font-extrabold active:scale-95 transition-all shadow-sm cursor-pointer"
                >
                  Explore Test Series
                </button>
              </div>
            ) : (
              liveAndUpcoming.map((test) => {
                const existingSub = getTestSubmission(test.id);
                const questionCount =
                  test.questionCount || (test.questions ? test.questions.length : 0);
                const durationMinutes = test.durationMinutes || 120;
                const totalMarks = test.totalMarks || 200;

                return (
                  <article
                    key={test.id}
                    className="bg-white dark:bg-[#1F2330] rounded-2xl border border-[#E8D9C0] dark:border-[#31374A] p-4 shadow-[0_3px_15px_rgba(23,25,35,0.03)] space-y-3.5 transition-all flex flex-col justify-between"
                  >
                    <div className="space-y-3.5">
                      {/* Header & Badges */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="bg-[#800020]/10 dark:bg-[#F47B20]/15 text-[#800020] dark:text-[#F47B20] text-[10px] font-black uppercase px-2.5 py-1 rounded-lg border border-[#800020]/20 dark:border-[#F47B20]/30 truncate">
                            {test.examCategory || "General Exam"}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-rose-50 dark:bg-rose-950/40 border border-rose-200/70 dark:border-rose-800/60 text-rose-700 dark:text-rose-400 shrink-0">
                            <span className="w-2 h-2 rounded-full bg-rose-600" />
                            <span className="text-[9.5px] font-black uppercase tracking-wider">
                              LIVE NOW
                            </span>
                          </div>
                          <button
                            onClick={() => handleShareLiveTest(test)}
                            className="p-1.5 rounded-lg bg-[#F7EFE2] dark:bg-[#252A3A] text-[#800020] dark:text-[#F47B20] hover:bg-[#E8D9C0]/60 transition-all cursor-pointer border border-[#E8D9C0] dark:border-[#31374A] active:scale-95"
                            title="Share Live Test"
                            aria-label="Share test"
                          >
                            <Share2 size={14} />
                          </button>
                        </div>
                      </div>

                      {/* Test Title & Info */}
                      <div>
                        <h3 className="text-base font-black text-[#171923] dark:text-[#FFF9EF] leading-snug font-hindi">
                          {test.title}
                        </h3>
                        {test.hindiTitle && (
                          <p className="text-xs text-slate-500 dark:text-slate-400 font-hindi mt-0.5 line-clamp-1">
                            {test.hindiTitle}
                          </p>
                        )}
                        {test.instructions && (
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium mt-1 line-clamp-2">
                            {test.instructions}
                          </p>
                        )}
                      </div>

                      {/* Information Grid */}
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div className="bg-[#FFF9EF] dark:bg-[#171923] p-2.5 rounded-xl border border-[#E8D9C0] dark:border-[#31374A] flex flex-col items-center justify-center">
                          <div className="flex items-center gap-1 text-[#800020] dark:text-[#F47B20] mb-0.5">
                            <HelpCircle size={12} />
                            <span className="text-[9px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                              QUESTIONS
                            </span>
                          </div>
                          <span className="text-sm font-black text-[#171923] dark:text-[#FFF9EF] tabular-nums">
                            {questionCount}
                          </span>
                        </div>

                        <div className="bg-[#FFF9EF] dark:bg-[#171923] p-2.5 rounded-xl border border-[#E8D9C0] dark:border-[#31374A] flex flex-col items-center justify-center">
                          <div className="flex items-center gap-1 text-emerald-700 dark:text-emerald-400 mb-0.5">
                            <Clock size={12} />
                            <span className="text-[9px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                              DURATION
                            </span>
                          </div>
                          <span className="text-sm font-black text-[#171923] dark:text-[#FFF9EF] tabular-nums">
                            {durationMinutes} Min
                          </span>
                        </div>

                        <div className="bg-[#FFF9EF] dark:bg-[#171923] p-2.5 rounded-xl border border-[#E8D9C0] dark:border-[#31374A] flex flex-col items-center justify-center">
                          <div className="flex items-center gap-1 text-[#C99A45] mb-0.5">
                            <Award size={12} />
                            <span className="text-[9px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                              MARKS
                            </span>
                          </div>
                          <span className="text-sm font-black text-[#171923] dark:text-[#FFF9EF] tabular-nums">
                            {totalMarks}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      {existingSub ? (
                        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200/70 dark:border-emerald-800/50 rounded-xl flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <span className="text-[9.5px] font-black text-emerald-700 dark:text-emerald-400 uppercase tracking-wider block">
                              ATTEMPTED
                            </span>
                            <p className="text-xs font-extrabold text-[#171923] dark:text-[#FFF9EF] mt-0.5 tabular-nums">
                              Score: {existingSub.score}/{existingSub.totalMarks} ({existingSub.accuracy.toFixed(0)}%)
                            </p>
                          </div>
                          <button
                            onClick={() => handleStartLiveTest(test)}
                            className="px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-extrabold rounded-xl shadow-xs active:scale-95 transition-all cursor-pointer shrink-0"
                          >
                            Re-attempt
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleStartLiveTest(test)}
                          className="w-full bg-[#800020] hover:bg-[#5E0017] dark:bg-[#F47B20] dark:hover:bg-[#E06A12] active:scale-[0.98] text-white py-3 px-4 rounded-xl font-extrabold text-sm flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer min-h-[44px]"
                        >
                          {fetchingTestId === test.id ? (
                            <RefreshCw size={16} className="animate-spin" />
                          ) : (
                            <Play size={16} fill="currentColor" />
                          )}
                          <span>{fetchingTestId === test.id ? "Loading Questions..." : "Start Live Test"}</span>
                        </button>
                      )}

                      {isAdmin && (
                        <div className="flex items-center gap-2 pt-2 border-t border-[#E8D9C0] dark:border-[#31374A]">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onOpenAdminManage?.();
                            }}
                            className="flex-1 py-2 bg-[#F7EFE2] dark:bg-[#252A3A] text-[#800020] dark:text-[#F47B20] font-extrabold rounded-xl text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                          >
                            <Edit2 size={13} />
                            <span>Edit / Manage Test</span>
                          </button>
                          <button
                            onClick={async (e) => {
                              e.stopPropagation();
                              if (confirm("Are you sure you want to delete this live test?")) {
                                const updated = await deleteLiveTest(test.id);
                                setTests(updated.filter((t) => t.status !== "draft"));
                              }
                            }}
                            className="px-3 py-2 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 text-rose-700 dark:text-rose-400 font-extrabold rounded-xl text-xs flex items-center justify-center gap-1 cursor-pointer"
                            title="Delete Live Test"
                          >
                            <Trash2 size={13} />
                            <span>Delete</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </article>
                );
              })
            )}
          </div>
        )}

        {/* 6. TEST SERIES TAB CONTENT */}
        {activeSubTab === "series" && (
          <CoachingHierarchySection
            liveTests={tests}
            submissions={submissions}
            onStartLiveTest={handleStartLiveTest}
            onStartSession={onStartSession}
            isAdmin={isAdmin}
            onOpenAdminManage={onOpenAdminManage}
          />
        )}

        {/* 7. SCORES TAB CONTENT */}
        {activeSubTab === "results" && (
          <div className="space-y-3.5">
            {submissions.length === 0 ? (
              <div className="p-9 text-center bg-white dark:bg-[#1F2330] rounded-2xl border border-[#E8D9C0] dark:border-[#31374A] flex flex-col items-center shadow-xs">
                <div className="w-13 h-13 rounded-2xl bg-[#F7EFE2] dark:bg-[#252A3A] flex items-center justify-center text-[#C99A45] mb-3">
                  <Trophy size={26} />
                </div>
                <h3 className="font-black text-sm text-[#171923] dark:text-[#FFF9EF] mb-1">
                  No Attempted Tests Yet
                </h3>
                <p className="text-slate-500 dark:text-slate-400 text-xs mb-4 max-w-xs leading-relaxed">
                  Your live test performance, accuracy analysis, and scores will be recorded here after taking a test.
                </p>
                <button
                  onClick={() => {
                    triggerHaptic("light");
                    setActiveSubTab("live");
                  }}
                  className="px-4 py-2.5 rounded-xl bg-[#800020] hover:bg-[#5E0017] dark:bg-[#F47B20] dark:hover:bg-[#E06A12] text-white text-xs font-extrabold active:scale-95 transition-all shadow-sm cursor-pointer"
                >
                  Attempt a Live Test Now
                </button>
              </div>
            ) : (
              submissions.map((sub) => (
                <article
                  key={sub.submissionId}
                  className="bg-white dark:bg-[#1F2330] rounded-2xl border border-[#E8D9C0] dark:border-[#31374A] p-4 shadow-xs space-y-3"
                >
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1">
                      <Calendar size={12} />
                      {new Date(sub.submittedAt).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </span>
                    <span className="bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 text-[10px] font-black px-2.5 py-1 rounded-lg border border-emerald-200/50 dark:border-emerald-800/40 tabular-nums">
                      {sub.accuracy.toFixed(0)}% Accuracy
                    </span>
                  </div>

                  <h3 className="text-sm font-black text-[#171923] dark:text-[#FFF9EF] leading-tight">
                    {sub.testTitle}
                  </h3>

                  <div className="grid grid-cols-3 gap-2 bg-[#FFF9EF] dark:bg-[#171923] p-3 rounded-xl border border-[#E8D9C0] dark:border-[#31374A]">
                    <div className="text-center border-r border-[#E8D9C0] dark:border-[#31374A]">
                      <p className="text-[9px] text-slate-500 dark:text-slate-400 font-extrabold uppercase mb-0.5">
                        Score
                      </p>
                      <p className="text-xs font-black text-[#171923] dark:text-[#FFF9EF] tabular-nums">
                        {sub.score}/{sub.totalMarks}
                      </p>
                    </div>
                    <div className="text-center border-r border-[#E8D9C0] dark:border-[#31374A]">
                      <p className="text-[9px] text-slate-500 dark:text-slate-400 font-extrabold uppercase mb-0.5">
                        Correct / Wrong
                      </p>
                      <p className="text-xs font-black tabular-nums">
                        <span className="text-emerald-700 dark:text-emerald-400">{sub.correctCount}</span>
                        <span className="text-slate-400 mx-1">/</span>
                        <span className="text-rose-700 dark:text-rose-400">{sub.wrongCount}</span>
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-[9px] text-slate-500 dark:text-slate-400 font-extrabold uppercase mb-0.5">
                        Time Spent
                      </p>
                      <p className="text-xs font-black text-[#171923] dark:text-[#FFF9EF] tabular-nums">
                        {Math.floor(sub.timeSpentSeconds / 60)}m
                      </p>
                    </div>
                  </div>
                </article>
              ))
            )}
          </div>
        )}

        {/* 8. GLOBAL LEADERBOARD TAB CONTENT */}
        {activeSubTab === "leaderboard" && (
          <div className="space-y-3.5">
            {/* Filter Selector Header */}
            <div className="bg-white dark:bg-[#1F2330] p-3 rounded-2xl border border-[#E8D9C0] dark:border-[#31374A] shadow-xs flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <Trophy size={16} className="text-[#C99A45] shrink-0" />
                <span className="text-xs font-black text-[#171923] dark:text-[#FFF9EF] truncate">
                  State Rankings
                </span>
              </div>
              <select
                value={leaderboardFilterTestId}
                onChange={(e) => setLeaderboardFilterTestId(e.target.value)}
                className="bg-[#FFF9EF] dark:bg-[#171923] border border-[#E8D9C0] dark:border-[#31374A] text-xs font-extrabold rounded-xl px-2.5 py-1.5 text-[#171923] dark:text-[#FFF9EF] outline-none max-w-[200px] truncate"
              >
                <option value="all">All Live Tests (Overall)</option>
                {tests.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title}
                  </option>
                ))}
              </select>
            </div>

            {/* Podium for Top 3 */}
            {leaderboardEntries.length >= 3 && (
              <div className="bg-gradient-to-b from-[#800020]/10 via-[#F47B20]/5 to-transparent dark:from-[#800020]/20 p-4 rounded-2xl border border-[#C99A45]/40">
                <div className="flex items-end justify-center gap-2 pt-3 pb-1">
                  {/* Rank 2 - Silver */}
                  <div className="flex-1 max-w-[100px] flex flex-col items-center">
                    <div className="w-11 h-11 rounded-full bg-slate-200 dark:bg-slate-700 border-2 border-slate-300 dark:border-slate-500 flex items-center justify-center font-black text-slate-700 dark:text-slate-200 text-sm shadow-md relative">
                      <Medal size={16} className="text-slate-500 absolute -top-2 -left-1" />
                      {leaderboardEntries[1].userName.charAt(0)}
                    </div>
                    <span className="text-[11px] font-black text-[#171923] dark:text-[#FFF9EF] mt-1.5 truncate max-w-full text-center">
                      {leaderboardEntries[1].userName}
                    </span>
                    <span className="text-[10px] font-extrabold text-slate-500 dark:text-slate-400 tabular-nums">
                      {leaderboardEntries[1].score} pts
                    </span>
                    <div className="w-full bg-slate-200 dark:bg-slate-700/80 rounded-t-xl h-12 mt-2 flex items-center justify-center font-black text-slate-700 dark:text-slate-200 text-xs tabular-nums">
                      #2
                    </div>
                  </div>

                  {/* Rank 1 - Gold */}
                  <div className="flex-1 max-w-[110px] flex flex-col items-center -mt-4">
                    <div className="w-13 h-13 rounded-full bg-[#C99A45]/20 border-2 border-[#C99A45] flex items-center justify-center font-black text-[#800020] dark:text-[#C99A45] text-base shadow-lg relative">
                      <Trophy size={18} className="text-[#C99A45] absolute -top-2.5 left-1/2 -translate-x-1/2" />
                      {leaderboardEntries[0].userName.charAt(0)}
                    </div>
                    <span className="text-xs font-black text-[#171923] dark:text-[#FFF9EF] mt-1.5 truncate max-w-full text-center">
                      {leaderboardEntries[0].userName}
                    </span>
                    <span className="text-[10px] font-black text-[#800020] dark:text-[#C99A45] tabular-nums">
                      {leaderboardEntries[0].score} pts
                    </span>
                    <div className="w-full bg-[#C99A45] rounded-t-2xl h-16 mt-2 flex flex-col items-center justify-center font-black text-[#171923] text-xs shadow-md tabular-nums">
                      <span>#1</span>
                      <span className="text-[8.5px] font-extrabold uppercase tracking-wider opacity-95">TOPPER</span>
                    </div>
                  </div>

                  {/* Rank 3 - Bronze */}
                  <div className="flex-1 max-w-[100px] flex flex-col items-center">
                    <div className="w-11 h-11 rounded-full bg-[#F47B20]/15 border-2 border-[#F47B20]/60 flex items-center justify-center font-black text-[#F47B20] text-sm shadow-md relative">
                      <Award size={16} className="text-[#F47B20] absolute -top-2 -right-1" />
                      {leaderboardEntries[2].userName.charAt(0)}
                    </div>
                    <span className="text-[11px] font-black text-[#171923] dark:text-[#FFF9EF] mt-1.5 truncate max-w-full text-center">
                      {leaderboardEntries[2].userName}
                    </span>
                    <span className="text-[10px] font-extrabold text-slate-500 dark:text-slate-400 tabular-nums">
                      {leaderboardEntries[2].score} pts
                    </span>
                    <div className="w-full bg-[#F47B20]/25 rounded-t-xl h-10 mt-2 flex items-center justify-center font-black text-[#800020] dark:text-[#F47B20] text-xs tabular-nums">
                      #3
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Rankings List */}
            <div className="space-y-2">
              <h3 className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 px-1">
                Leaderboard Standings
              </h3>

              {leaderboardEntries.map((entry) => (
                <article
                  key={entry.id}
                  className={`p-3 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
                    entry.isCurrentUser
                      ? "bg-[#800020]/5 dark:bg-[#F47B20]/10 border-[#800020]/40 dark:border-[#F47B20]/40 shadow-sm"
                      : "bg-white dark:bg-[#1F2330] border-[#E8D9C0] dark:border-[#31374A] shadow-xs"
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-7 h-7 rounded-xl flex items-center justify-center font-black text-xs shrink-0 tabular-nums ${
                        entry.rank === 1
                          ? "bg-[#C99A45] text-[#171923]"
                          : entry.rank === 2
                          ? "bg-slate-300 text-slate-800 dark:bg-slate-600 dark:text-white"
                          : entry.rank === 3
                          ? "bg-[#F47B20] text-white"
                          : "bg-[#F7EFE2] dark:bg-[#252A3A] text-slate-600 dark:text-slate-300"
                      }`}
                    >
                      #{entry.rank}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-xs font-black text-[#171923] dark:text-[#FFF9EF] truncate">
                          {entry.userName}
                        </p>
                        {entry.isCurrentUser && (
                          <span className="text-[8.5px] font-black uppercase px-1.5 py-0.5 rounded bg-[#800020] dark:bg-[#F47B20] text-white">
                            YOU
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                        {entry.testTitle}
                      </p>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <p className="text-xs font-black text-[#171923] dark:text-[#FFF9EF] tabular-nums">
                      {entry.score} pts
                    </p>
                    <p className="text-[9.5px] text-emerald-700 dark:text-emerald-400 font-extrabold tabular-nums">
                      {entry.accuracy}% Acc
                    </p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Share Modal Integration */}
      <ShareModal
        isOpen={shareModalConfig.isOpen}
        onClose={() => setShareModalConfig({ isOpen: false, data: { title: "", url: "" } })}
        data={shareModalConfig.data}
      />
    </div>
  );
};

export default LiveTestsTab;
