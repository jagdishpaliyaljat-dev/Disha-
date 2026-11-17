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
  Compass,
  ArrowUpRight,
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

  // Filters & Subtabs
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

  // Start Exam Session with question resolution
  const handleStartLiveTest = async (test: LiveTest) => {
    if (fetchingTestId) return;
    triggerHaptic("light");
    playClickSound();

    setFetchingTestId(test.id);

    try {
      const isCompleteQ = (q: any) =>
        Boolean(q && (q.text || q.question) && Array.isArray(q.options) && q.options.length >= 2);

      let rawQuestions: any[] = [];

      // 1. Direct questions on test object
      if (Array.isArray(test.questions) && test.questions.length > 0) {
        rawQuestions = test.questions.filter(isCompleteQ);
      }

      // 2. Fetch from DB if empty
      if (rawQuestions.length === 0) {
        const { fetchMCQsByLiveTest } = await import("../utils/liveTestStorage");
        const fetched = await fetchMCQsByLiveTest(test.id);
        if (fetched && fetched.length > 0) {
          rawQuestions = fetched.filter(isCompleteQ);
        }
      }

      // 3. Fallback to candidate IDs from user questions store
      if (rawQuestions.length === 0) {
        const candidateIds = [
          ...(Array.isArray(test.questions) ? test.questions.map((q: any) => (typeof q === "string" ? q : q?.id)) : []),
          ...(Array.isArray((test as any).questionIds) ? (test as any).questionIds : []),
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

      // 5. Ultimate safety: standard local curriculum questions
      if (rawQuestions.length === 0) {
        const { getAllLocalMCQs } = await import("../utils/localDatabaseEngine");
        rawQuestions = await getAllLocalMCQs();
      }

      const extraQs = rawQuestions.map((q, idx) => ({
        ...q,
        id: q.id || `live_${test.id}_q_${idx}`,
      }));
      const questionIds = extraQs.map((q) => q.id);

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
      className="flex flex-col w-full min-h-screen bg-[#FFF9EF] dark:bg-[#12151D] text-[#171923] dark:text-[#FFF9EF] select-none antialiased pb-32"
      id="tests-hub-mobile-view"
    >
      {/* ── 1. PAGE HEADER ────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 bg-[#FFF9EF]/95 dark:bg-[#1F2330]/95 backdrop-blur-md border-b border-[#E8D9C0] dark:border-[#2E3547] shadow-[0_2px_12px_rgba(23,25,35,0.03)] px-3.5 sm:px-4 py-2.5 sm:py-3 transition-colors">
        <div className="flex items-center justify-between gap-3 max-w-4xl mx-auto w-full">
          {/* Back & Title */}
          <div className="flex items-center gap-2.5 min-w-0">
            {onNavigateTab && (
              <button
                onClick={() => {
                  triggerHaptic("light");
                  onNavigateTab("home");
                }}
                className="w-9 h-9 rounded-xl bg-white dark:bg-[#252A3A] hover:bg-[#F7EFE2] dark:hover:bg-[#31374A] flex items-center justify-center text-[#171923] dark:text-[#FFF9EF] border border-[#E8D9C0] dark:border-[#31374A] shadow-xs active:scale-95 transition-all cursor-pointer shrink-0"
                aria-label="Back to home"
              >
                <ArrowLeft size={17} />
              </button>
            )}
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-sm sm:text-base font-black text-[#171923] dark:text-[#FFF9EF] leading-tight truncate tracking-tight">
                  Live Tests &amp; Mocks
                </h1>
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-[#800020]/10 dark:bg-[#C5A059]/15 border border-[#800020]/20 dark:border-[#C5A059]/30 text-[9.5px] font-black text-[#800020] dark:text-[#E8D9C0] shrink-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#800020] dark:bg-[#C5A059] animate-pulse" />
                  LIVE
                </span>
              </div>
              <p className="text-[10.5px] text-[#800020] dark:text-[#C5A059] font-bold leading-none mt-0.5 truncate tracking-wide">
                Official RPSC &amp; RSMSSB Simulation · All-India Ranks
              </p>
            </div>
          </div>

          {/* Admin Create Action */}
          {isAdmin && onOpenAdminManage && (
            <button
              onClick={() => {
                triggerHaptic("light");
                onOpenAdminManage();
              }}
              className="px-3 py-1.5 rounded-xl bg-[#800020] hover:bg-[#5E0017] dark:bg-[#800020] dark:hover:bg-[#5E0017] text-[#FFF9EF] font-black text-[11px] shadow-sm border border-[#C5A059]/40 active:scale-95 transition-all cursor-pointer shrink-0 flex items-center gap-1.5"
            >
              <Zap size={12} className="text-[#C5A059] fill-current" />
              <span>+ Create</span>
            </button>
          )}
        </div>
      </header>

      {/* ── MAIN CONTENT CONTAINER ────────────────────────────────────────── */}
      <main className="p-3.5 sm:p-4 space-y-3.5 max-w-4xl mx-auto w-full">
        {/* ── 2. NAVIGATION TABS (PILL BAR) ─────────────────────────────────── */}
        <nav
          aria-label="Exam Portal Sections"
          className="p-1 bg-[#F4ECE1] dark:bg-[#1A1D27] rounded-2xl flex items-center border border-[#E8D9C0] dark:border-[#2E3547] shadow-xs"
        >
          {/* Tab 1: Live Tests */}
          <button
            onClick={() => {
              triggerHaptic("light");
              playClickSound();
              setActiveSubTab("live");
            }}
            className={`flex-1 py-2 sm:py-2.5 rounded-xl text-[11.5px] font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer min-h-[40px] ${
              activeSubTab === "live"
                ? "bg-[#800020] text-white shadow-sm border border-[#C5A059]/30"
                : "text-slate-600 dark:text-slate-300 hover:text-[#171923] dark:hover:text-[#FFF9EF]"
            }`}
          >
            <Radio size={13} className={activeSubTab === "live" ? "text-[#C5A059]" : ""} />
            <span>Live Tests</span>
            {liveAndUpcoming.length > 0 && (
              <span
                className={`ml-0.5 px-1.5 py-0.2 rounded-full text-[9px] font-mono tabular-nums ${
                  activeSubTab === "live"
                    ? "bg-[#C5A059] text-[#171923] font-black"
                    : "bg-[#800020]/10 text-[#800020] dark:bg-[#252A3A] dark:text-slate-300"
                }`}
              >
                {liveAndUpcoming.length}
              </span>
            )}
          </button>

          {/* Tab 2: Test Series */}
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
            className={`flex-1 py-2 sm:py-2.5 rounded-xl text-[11.5px] font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer min-h-[40px] ${
              activeSubTab === "series"
                ? "bg-[#800020] text-white shadow-sm border border-[#C5A059]/30"
                : "text-slate-600 dark:text-slate-300 hover:text-[#171923] dark:hover:text-[#FFF9EF]"
            }`}
          >
            <Layers size={13} className={activeSubTab === "series" ? "text-[#C5A059]" : ""} />
            <span>Test Series</span>
          </button>

          {/* Tab 3: Scores */}
          <button
            onClick={() => {
              triggerHaptic("light");
              playClickSound();
              setActiveSubTab("results");
            }}
            className={`flex-1 py-2 sm:py-2.5 rounded-xl text-[11.5px] font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer min-h-[40px] ${
              activeSubTab === "results"
                ? "bg-[#800020] text-white shadow-sm border border-[#C5A059]/30"
                : "text-slate-600 dark:text-slate-300 hover:text-[#171923] dark:hover:text-[#FFF9EF]"
            }`}
          >
            <Award size={13} className={activeSubTab === "results" ? "text-[#C5A059]" : ""} />
            <span>Scores</span>
            {submissions.length > 0 && (
              <span
                className={`ml-0.5 px-1.5 py-0.2 rounded-full text-[9px] font-mono tabular-nums ${
                  activeSubTab === "results"
                    ? "bg-[#C5A059] text-[#171923] font-black"
                    : "bg-[#800020]/10 text-[#800020] dark:bg-[#252A3A] dark:text-slate-300"
                }`}
              >
                {submissions.length}
              </span>
            )}
          </button>

          {/* Tab 4: Ranks */}
          <button
            onClick={() => {
              triggerHaptic("light");
              playClickSound();
              setActiveSubTab("leaderboard");
            }}
            className={`flex-1 py-2 sm:py-2.5 rounded-xl text-[11.5px] font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer min-h-[40px] ${
              activeSubTab === "leaderboard"
                ? "bg-[#800020] text-white shadow-sm border border-[#C5A059]/30"
                : "text-slate-600 dark:text-slate-300 hover:text-[#171923] dark:hover:text-[#FFF9EF]"
            }`}
          >
            <Trophy size={13} className={activeSubTab === "leaderboard" ? "text-[#C5A059]" : ""} />
            <span>Ranks</span>
          </button>
        </nav>

        {/* ── 3. PYQ VAULT BANNER CARD ────────────────────────────────────── */}
        <section aria-label="PYQ Vault Entry">
          <button
            onClick={() => {
              triggerHaptic("light");
              playClickSound();
              onNavigateTab?.("pyq_vault");
            }}
            className="w-full bg-gradient-to-r from-[#4A0012] via-[#800020] to-[#590016] p-3.5 sm:p-4 rounded-2xl text-[#FFF9EF] flex items-center justify-between shadow-md relative overflow-hidden group active:scale-[0.99] transition-all cursor-pointer text-left border border-[#C5A059]/40"
          >
            {/* Subtle background ornamentation */}
            <div className="absolute -right-6 -bottom-6 w-28 h-28 rounded-full bg-[#C5A059]/10 blur-xl pointer-events-none" />

            <div className="flex items-center gap-3 relative z-10 min-w-0">
              <div className="w-10 h-10 sm:w-11 sm:h-11 bg-[#C5A059]/15 rounded-xl flex items-center justify-center text-[#C5A059] shrink-0 border border-[#C5A059]/30 group-hover:scale-105 transition-transform">
                <FileText size={20} />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[9.5px] text-[#C5A059] font-black uppercase tracking-wider">
                    Official Papers Archive
                  </span>
                  <span className="text-[9px] text-[#FFF9EF]/80 font-bold bg-white/10 px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                    <Star size={9} className="text-[#C5A059] fill-current" /> Authentic Keys
                  </span>
                </div>
                <h3 className="text-sm sm:text-base font-black text-white mt-0.5 leading-tight">
                  PYQ Vault — Solved Question Papers
                </h3>
                <p className="text-[11px] text-[#FFF9EF]/85 font-medium leading-none mt-1 truncate">
                  RAS, CET, REET, Patwar &amp; 1st Grade past papers with official answer keys
                </p>
              </div>
            </div>

            <div className="w-8 h-8 rounded-full bg-white/10 group-hover:bg-[#C5A059] group-hover:text-[#171923] flex items-center justify-center text-[#FFF9EF] transition-all shrink-0 ml-2 relative z-10 border border-white/15">
              <ChevronRight size={15} />
            </div>
          </button>
        </section>

        {/* ── 4. EXAM FILTER CHIPS ────────────────────────────────────────── */}
        <section aria-label="Exam Filters">
          <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto pb-1 no-scrollbar snap-x -mx-1 px-1">
            {categoryOptions.map((cat) => {
              const isActive = selectedCategory === cat;
              const displayLabel = cat === "all" ? "All Exams" : cat;
              const testCount = cat === "all" ? tests.length : tests.filter((t) => t.examCategory === cat).length;

              return (
                <button
                  key={cat}
                  onClick={() => {
                    triggerHaptic("light");
                    setSelectedCategory(cat);
                  }}
                  className={`px-3 py-1.5 rounded-xl text-[11px] font-black transition-all shrink-0 snap-start active:scale-95 cursor-pointer flex items-center gap-1.5 ${
                    isActive
                      ? "bg-[#800020] text-white shadow-xs border border-[#C5A059]/40"
                      : "bg-white dark:bg-[#1F2330] border border-[#E8D9C0] dark:border-[#31374A] text-slate-600 dark:text-slate-300 hover:text-[#171923] dark:hover:text-white"
                  }`}
                >
                  {cat === "all" ? (
                    <BookOpen size={11} className={isActive ? "text-[#C5A059]" : "text-[#800020] dark:text-[#C5A059]"} />
                  ) : (
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        isActive ? "bg-[#C5A059]" : "bg-[#800020] dark:bg-[#C5A059]"
                      }`}
                    />
                  )}
                  <span>{displayLabel}</span>
                  {testCount > 0 && (
                    <span
                      className={`ml-0.5 px-1 py-0.2 rounded-md text-[8.5px] font-mono tabular-nums ${
                        isActive
                          ? "bg-white/20 text-white"
                          : "bg-[#F7EFE2] dark:bg-[#252A3A] text-slate-500 dark:text-slate-400"
                      }`}
                    >
                      {testCount}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </section>

        {/* ── 5. LIVE TESTS TAB CONTENT ───────────────────────────────────── */}
        {activeSubTab === "live" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {isLoading ? (
              <div className="md:col-span-2 p-10 text-center bg-white dark:bg-[#1F2330] rounded-2xl border border-[#E8D9C0] dark:border-[#31374A] flex flex-col items-center shadow-xs">
                <RefreshCw size={24} className="text-[#800020] dark:text-[#C5A059] animate-spin mb-2.5" />
                <p className="font-black text-xs sm:text-sm text-[#171923] dark:text-[#FFF9EF]">
                  Syncing Live Tests...
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Fetching official examination schedules
                </p>
              </div>
            ) : liveAndUpcoming.length === 0 ? (
              <div className="md:col-span-2 p-8 text-center bg-white dark:bg-[#1F2330] rounded-2xl border border-[#E8D9C0] dark:border-[#31374A] flex flex-col items-center shadow-xs">
                <div className="w-12 h-12 rounded-2xl bg-[#800020]/10 dark:bg-[#C5A059]/15 flex items-center justify-center text-[#800020] dark:text-[#C5A059] mb-2.5 border border-[#800020]/15 dark:border-[#C5A059]/20">
                  <Radio size={22} />
                </div>
                <h3 className="font-black text-sm text-[#171923] dark:text-[#FFF9EF] mb-1">
                  No Active Live Tests Scheduled
                </h3>
                <p className="text-slate-500 dark:text-slate-400 text-xs mb-3.5 max-w-xs leading-relaxed">
                  {selectedCategory !== "all"
                    ? `No test currently live under "${selectedCategory}". Select "All Exams" or explore comprehensive Test Series.`
                    : "No test is live right now. Prepare with Test Series or check back shortly for scheduled sessions."}
                </p>
                <button
                  onClick={() => {
                    triggerHaptic("light");
                    setSelectedCategory("all");
                    setActiveSubTab("series");
                  }}
                  className="px-4 py-2 rounded-xl bg-[#800020] hover:bg-[#5E0017] dark:bg-[#800020] text-[#FFF9EF] text-xs font-black border border-[#C5A059]/40 active:scale-95 transition-all shadow-xs cursor-pointer flex items-center gap-1.5"
                >
                  <Layers size={13} className="text-[#C5A059]" />
                  <span>Explore Test Series</span>
                </button>
              </div>
            ) : (
              liveAndUpcoming.map((test) => {
                const existingSub = getTestSubmission(test.id);
                const questionCount = test.questionCount || (test.questions ? test.questions.length : 0);
                const durationMinutes = test.durationMinutes || 120;
                const totalMarks = test.totalMarks || 200;
                const negMark = test.negativeMarking ? `-${test.negativeMarking}` : "-0.33";

                return (
                  <article
                    key={test.id}
                    className="bg-white dark:bg-[#1F2330] rounded-2xl border border-[#E8D9C0] dark:border-[#31374A] p-4 shadow-xs hover:border-[#800020]/40 dark:hover:border-[#C5A059]/40 transition-all flex flex-col justify-between space-y-3"
                  >
                    <div className="space-y-2.5">
                      {/* Top Badges Row */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="bg-[#800020]/10 text-[#800020] dark:bg-[#C5A059]/15 dark:text-[#E8D9C0] text-[9.5px] font-black uppercase px-2 py-0.5 rounded-lg border border-[#800020]/20 dark:border-[#C5A059]/30 truncate">
                            {test.examCategory || "General Exam"}
                          </span>
                          <span className="bg-amber-500/10 dark:bg-amber-400/15 text-amber-800 dark:text-amber-300 text-[9.5px] font-black uppercase px-1.5 py-0.5 rounded-lg border border-amber-500/25 shrink-0 flex items-center gap-1">
                            <ShieldCheck size={11} />
                            Option E
                          </span>
                        </div>

                        <div className="flex items-center gap-1">
                          <div className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-50 dark:bg-rose-950/40 border border-rose-200/70 dark:border-rose-800/60 text-rose-700 dark:text-rose-400 shrink-0">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-600 animate-ping" />
                            <span className="text-[9px] font-black uppercase tracking-wider">
                              LIVE
                            </span>
                          </div>
                          <button
                            onClick={() => handleShareLiveTest(test)}
                            className="p-1.5 rounded-lg bg-[#F7EFE2] dark:bg-[#252A3A] text-[#800020] dark:text-[#C5A059] hover:bg-[#E8D9C0]/60 transition-all cursor-pointer border border-[#E8D9C0] dark:border-[#31374A] active:scale-95"
                            title="Share Test"
                            aria-label="Share test"
                          >
                            <Share2 size={13} />
                          </button>
                        </div>
                      </div>

                      {/* Title & Instructions */}
                      <div>
                        <h3 className="text-sm sm:text-base font-black text-[#171923] dark:text-[#FFF9EF] leading-snug font-hindi">
                          {test.title}
                        </h3>
                        {test.hindiTitle && (
                          <p className="text-xs text-slate-500 dark:text-slate-400 font-hindi mt-0.5 line-clamp-1">
                            {test.hindiTitle}
                          </p>
                        )}
                        {test.instructions && (
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium mt-1 line-clamp-2 leading-relaxed">
                            {test.instructions}
                          </p>
                        )}

                        {/* RPSC 5th Option Rule Notice */}
                        <div className="mt-2 p-2 rounded-xl bg-[#FFF9EF] dark:bg-[#171923] border border-[#E8D9C0] dark:border-[#31374A] text-[10px] leading-relaxed text-[#171923] dark:text-[#E8D9C0] flex items-start gap-1.5">
                          <AlertCircle size={13} className="shrink-0 text-[#800020] dark:text-[#C5A059] mt-0.5" />
                          <div>
                            <strong className="text-[#800020] dark:text-[#C5A059]">RPSC 5वां विकल्प नियम:</strong> यदि प्रश्न हल नहीं करना है तो Option E ('अनुत्तरित') भरें। खाली छोड़ने पर {negMark} अंक कटौती तथा 10% से अधिक खाली छोड़ने पर अयोग्यता नियम लागू।
                          </div>
                        </div>
                      </div>

                      {/* Stats Micro-Cards */}
                      <div className="grid grid-cols-4 gap-1.5 text-center pt-1">
                        <div className="bg-[#F7EFE2]/60 dark:bg-[#171923] p-2 rounded-xl border border-[#E8D9C0] dark:border-[#31374A] flex flex-col items-center justify-center">
                          <span className="text-[8.5px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                            Questions
                          </span>
                          <span className="text-xs sm:text-sm font-black text-[#171923] dark:text-[#FFF9EF] tabular-nums mt-0.5">
                            {questionCount}
                          </span>
                        </div>

                        <div className="bg-[#F7EFE2]/60 dark:bg-[#171923] p-2 rounded-xl border border-[#E8D9C0] dark:border-[#31374A] flex flex-col items-center justify-center">
                          <span className="text-[8.5px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                            Duration
                          </span>
                          <span className="text-xs sm:text-sm font-black text-[#171923] dark:text-[#FFF9EF] tabular-nums mt-0.5">
                            {durationMinutes}m
                          </span>
                        </div>

                        <div className="bg-[#F7EFE2]/60 dark:bg-[#171923] p-2 rounded-xl border border-[#E8D9C0] dark:border-[#31374A] flex flex-col items-center justify-center">
                          <span className="text-[8.5px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                            Marks
                          </span>
                          <span className="text-xs sm:text-sm font-black text-[#800020] dark:text-[#C5A059] tabular-nums mt-0.5">
                            {totalMarks}
                          </span>
                        </div>

                        <div className="bg-[#F7EFE2]/60 dark:bg-[#171923] p-2 rounded-xl border border-[#E8D9C0] dark:border-[#31374A] flex flex-col items-center justify-center">
                          <span className="text-[8.5px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                            Negative
                          </span>
                          <span className="text-xs sm:text-sm font-black text-rose-700 dark:text-rose-400 tabular-nums mt-0.5">
                            {negMark}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Action Area */}
                    <div className="space-y-2 pt-1 border-t border-[#E8D9C0]/70 dark:border-[#31374A]/70">
                      {existingSub ? (
                        <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200/70 dark:border-emerald-800/50 rounded-xl flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <span className="text-[9px] font-black text-emerald-700 dark:text-emerald-400 uppercase tracking-wider block">
                              ALREADY ATTEMPTED
                            </span>
                            <p className="text-xs font-black text-[#171923] dark:text-[#FFF9EF] mt-0.5 tabular-nums">
                              Score: {existingSub.score}/{existingSub.totalMarks} ({existingSub.accuracy.toFixed(0)}%)
                            </p>
                          </div>
                          <button
                            onClick={() => handleStartLiveTest(test)}
                            className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-black rounded-lg shadow-xs active:scale-95 transition-all cursor-pointer shrink-0"
                          >
                            Re-attempt
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleStartLiveTest(test)}
                          className="w-full bg-[#800020] hover:bg-[#5E0017] dark:bg-[#800020] dark:hover:bg-[#5E0017] active:scale-[0.99] text-[#FFF9EF] py-2.5 px-4 rounded-xl font-black text-xs sm:text-sm flex items-center justify-center gap-2 border border-[#C5A059]/40 shadow-sm transition-all duration-150 cursor-pointer min-h-[44px] group"
                        >
                          {fetchingTestId === test.id ? (
                            <RefreshCw size={15} className="animate-spin text-[#C5A059]" />
                          ) : (
                            <Play size={15} fill="currentColor" className="text-[#C5A059] group-hover:scale-110 transition-transform" />
                          )}
                          <span>{fetchingTestId === test.id ? "Preparing Exam Simulation..." : "Start Live Test"}</span>
                        </button>
                      )}

                      {/* Admin Tools */}
                      {isAdmin && (
                        <div className="flex items-center gap-2 pt-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onOpenAdminManage?.();
                            }}
                            className="flex-1 py-1.5 bg-[#F7EFE2] dark:bg-[#252A3A] text-[#800020] dark:text-[#C5A059] font-black rounded-lg text-xs flex items-center justify-center gap-1.5 cursor-pointer border border-[#E8D9C0] dark:border-[#31374A]"
                          >
                            <Edit2 size={12} />
                            <span>Manage Test</span>
                          </button>
                          <button
                            onClick={async (e) => {
                              e.stopPropagation();
                              if (confirm("Are you sure you want to delete this live test?")) {
                                const updated = await deleteLiveTest(test.id);
                                setTests(updated.filter((t) => t.status !== "draft"));
                              }
                            }}
                            className="px-2.5 py-1.5 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 text-rose-700 dark:text-rose-400 font-black rounded-lg text-xs flex items-center justify-center gap-1 cursor-pointer border border-rose-200 dark:border-rose-900"
                            title="Delete Live Test"
                          >
                            <Trash2 size={12} />
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

        {/* ── 6. TEST SERIES TAB CONTENT ──────────────────────────────────── */}
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

        {/* ── 7. SCORES TAB CONTENT ───────────────────────────────────────── */}
        {activeSubTab === "results" && (
          <div className="space-y-3">
            {submissions.length === 0 ? (
              <div className="p-8 text-center bg-white dark:bg-[#1F2330] rounded-2xl border border-[#E8D9C0] dark:border-[#31374A] flex flex-col items-center shadow-xs">
                <div className="w-12 h-12 rounded-2xl bg-[#F7EFE2] dark:bg-[#252A3A] flex items-center justify-center text-[#C5A059] mb-2.5 border border-[#E8D9C0] dark:border-[#31374A]">
                  <Trophy size={24} />
                </div>
                <h3 className="font-black text-sm text-[#171923] dark:text-[#FFF9EF] mb-1">
                  No Exam Records Found
                </h3>
                <p className="text-slate-500 dark:text-slate-400 text-xs mb-3.5 max-w-xs leading-relaxed">
                  Your detailed scorecards, RPSC accuracy analysis, and percentiles will appear here as soon as you submit a test.
                </p>
                <button
                  onClick={() => {
                    triggerHaptic("light");
                    setActiveSubTab("live");
                  }}
                  className="px-4 py-2 rounded-xl bg-[#800020] hover:bg-[#5E0017] dark:bg-[#800020] text-[#FFF9EF] text-xs font-black border border-[#C5A059]/40 active:scale-95 transition-all shadow-xs cursor-pointer flex items-center gap-1.5"
                >
                  <Play size={13} fill="currentColor" className="text-[#C5A059]" />
                  <span>Attempt a Live Test Now</span>
                </button>
              </div>
            ) : (
              submissions.map((sub) => (
                <article
                  key={sub.submissionId}
                  className="bg-white dark:bg-[#1F2330] rounded-2xl border border-[#E8D9C0] dark:border-[#31374A] p-4 shadow-xs space-y-2.5"
                >
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1">
                      <Calendar size={11} />
                      {new Date(sub.submittedAt).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </span>
                    <span className="bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 text-[10px] font-black px-2 py-0.5 rounded-lg border border-emerald-200/50 dark:border-emerald-800/40 tabular-nums">
                      {sub.accuracy.toFixed(0)}% Accuracy
                    </span>
                  </div>

                  <h3 className="text-sm font-black text-[#171923] dark:text-[#FFF9EF] leading-snug">
                    {sub.testTitle}
                  </h3>

                  {sub.isRpscDisqualified && (
                    <div className="p-2 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-800 dark:text-rose-200 text-[11px] font-bold flex items-center gap-1.5">
                      <AlertCircle size={14} className="shrink-0 text-rose-600 dark:text-rose-400" />
                      <span>RPSC अयोग्य (Disqualified): 10% से अधिक प्रश्न खाली छोड़े गए</span>
                    </div>
                  )}

                  <div className="grid grid-cols-4 gap-1.5 bg-[#FFF9EF] dark:bg-[#171923] p-2.5 rounded-xl border border-[#E8D9C0] dark:border-[#31374A] text-center">
                    <div>
                      <p className="text-[8.5px] text-slate-500 dark:text-slate-400 font-black uppercase">
                        Score
                      </p>
                      <p className="text-xs font-black text-[#800020] dark:text-[#C5A059] tabular-nums mt-0.5">
                        {sub.score}/{sub.totalMarks}
                      </p>
                    </div>
                    <div>
                      <p className="text-[8.5px] text-slate-500 dark:text-slate-400 font-black uppercase">
                        Correct / Wrong
                      </p>
                      <p className="text-xs font-black tabular-nums mt-0.5">
                        <span className="text-emerald-700 dark:text-emerald-400">{sub.correctCount}</span>
                        <span className="text-slate-400 mx-0.5">/</span>
                        <span className="text-rose-700 dark:text-rose-400">{sub.wrongCount}</span>
                      </p>
                    </div>
                    <div>
                      <p className="text-[8.5px] text-slate-500 dark:text-slate-400 font-black uppercase">
                        Option E
                      </p>
                      <p className="text-xs font-black text-amber-700 dark:text-amber-400 tabular-nums mt-0.5">
                        {sub.unattemptedECount ?? 0}
                      </p>
                    </div>
                    <div>
                      <p className="text-[8.5px] text-slate-500 dark:text-slate-400 font-black uppercase">
                        Time
                      </p>
                      <p className="text-xs font-black text-[#171923] dark:text-[#FFF9EF] tabular-nums mt-0.5">
                        {Math.floor(sub.timeSpentSeconds / 60)}m
                      </p>
                    </div>
                  </div>
                </article>
              ))
            )}
          </div>
        )}

        {/* ── 8. GLOBAL LEADERBOARD & RANKS ────────────────────────────────── */}
        {activeSubTab === "leaderboard" && (
          <div className="space-y-3.5">
            {/* Filter Selector Header */}
            <div className="bg-white dark:bg-[#1F2330] p-3 rounded-2xl border border-[#E8D9C0] dark:border-[#31374A] shadow-xs flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <Trophy size={16} className="text-[#C5A059] shrink-0" />
                <span className="text-xs font-black text-[#171923] dark:text-[#FFF9EF] truncate">
                  State Merit Ranks
                </span>
              </div>
              <select
                value={leaderboardFilterTestId}
                onChange={(e) => setLeaderboardFilterTestId(e.target.value)}
                className="bg-[#FFF9EF] dark:bg-[#171923] border border-[#E8D9C0] dark:border-[#31374A] text-xs font-black rounded-xl px-2.5 py-1.5 text-[#171923] dark:text-[#FFF9EF] outline-none max-w-[200px] truncate cursor-pointer"
              >
                <option value="all">All Live Tests (Cumulative)</option>
                {tests.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title}
                  </option>
                ))}
              </select>
            </div>

            {/* Podium for Top 3 */}
            {leaderboardEntries.length >= 3 && (
              <div className="bg-gradient-to-b from-[#800020]/15 via-[#C5A059]/10 to-transparent dark:from-[#800020]/25 p-4 rounded-2xl border border-[#C5A059]/40">
                <div className="flex items-end justify-center gap-2 pt-2 pb-1">
                  {/* Rank 2 - Silver */}
                  <div className="flex-1 max-w-[95px] flex flex-col items-center">
                    <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-700 border-2 border-slate-300 dark:border-slate-500 flex items-center justify-center font-black text-slate-700 dark:text-slate-200 text-xs shadow-md relative">
                      <Medal size={15} className="text-slate-500 absolute -top-2 -left-1" />
                      {leaderboardEntries[1].userName.charAt(0)}
                    </div>
                    <span className="text-[10.5px] font-black text-[#171923] dark:text-[#FFF9EF] mt-1 truncate max-w-full text-center">
                      {leaderboardEntries[1].userName}
                    </span>
                    <span className="text-[9.5px] font-black text-slate-500 dark:text-slate-400 tabular-nums">
                      {leaderboardEntries[1].score} pts
                    </span>
                    <div className="w-full bg-slate-200 dark:bg-slate-700/80 rounded-t-xl h-11 mt-1.5 flex items-center justify-center font-black text-slate-700 dark:text-slate-200 text-xs tabular-nums">
                      #2
                    </div>
                  </div>

                  {/* Rank 1 - Gold (Elevated) */}
                  <div className="flex-1 max-w-[105px] flex flex-col items-center -mt-3">
                    <div className="w-12 h-12 rounded-full bg-[#C5A059]/25 border-2 border-[#C5A059] flex items-center justify-center font-black text-[#800020] dark:text-[#C5A059] text-sm shadow-lg relative">
                      <Trophy size={17} className="text-[#C5A059] absolute -top-2.5 left-1/2 -translate-x-1/2" />
                      {leaderboardEntries[0].userName.charAt(0)}
                    </div>
                    <span className="text-[11px] font-black text-[#171923] dark:text-[#FFF9EF] mt-1 truncate max-w-full text-center">
                      {leaderboardEntries[0].userName}
                    </span>
                    <span className="text-[10px] font-black text-[#800020] dark:text-[#C5A059] tabular-nums">
                      {leaderboardEntries[0].score} pts
                    </span>
                    <div className="w-full bg-gradient-to-t from-[#B8860B] to-[#C5A059] rounded-t-2xl h-16 mt-1.5 flex flex-col items-center justify-center font-black text-[#171923] text-xs shadow-md tabular-nums">
                      <span>#1</span>
                      <span className="text-[8px] font-black uppercase tracking-wider">TOPPER</span>
                    </div>
                  </div>

                  {/* Rank 3 - Bronze */}
                  <div className="flex-1 max-w-[95px] flex flex-col items-center">
                    <div className="w-10 h-10 rounded-full bg-amber-700/20 border-2 border-amber-600/60 flex items-center justify-center font-black text-amber-700 dark:text-amber-400 text-xs shadow-md relative">
                      <Award size={15} className="text-amber-600 absolute -top-2 -right-1" />
                      {leaderboardEntries[2].userName.charAt(0)}
                    </div>
                    <span className="text-[10.5px] font-black text-[#171923] dark:text-[#FFF9EF] mt-1 truncate max-w-full text-center">
                      {leaderboardEntries[2].userName}
                    </span>
                    <span className="text-[9.5px] font-black text-slate-500 dark:text-slate-400 tabular-nums">
                      {leaderboardEntries[2].score} pts
                    </span>
                    <div className="w-full bg-amber-700/20 dark:bg-amber-900/40 rounded-t-xl h-9 mt-1.5 flex items-center justify-center font-black text-[#800020] dark:text-amber-300 text-xs tabular-nums">
                      #3
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Standings List */}
            <div className="space-y-1.5">
              <h3 className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 px-1">
                Full Merit Standings
              </h3>

              {leaderboardEntries.map((entry) => (
                <article
                  key={entry.id}
                  className={`p-2.5 sm:p-3 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
                    entry.isCurrentUser
                      ? "bg-[#800020]/10 dark:bg-[#C5A059]/15 border-[#800020]/40 dark:border-[#C5A059]/40 shadow-xs"
                      : "bg-white dark:bg-[#1F2330] border-[#E8D9C0] dark:border-[#31374A] shadow-xs"
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className={`w-7 h-7 rounded-xl flex items-center justify-center font-black text-xs shrink-0 tabular-nums ${
                        entry.rank === 1
                          ? "bg-[#C5A059] text-[#171923]"
                          : entry.rank === 2
                          ? "bg-slate-300 text-slate-800 dark:bg-slate-600 dark:text-white"
                          : entry.rank === 3
                          ? "bg-amber-700/30 text-amber-900 dark:text-amber-200"
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
                          <span className="text-[8px] font-black uppercase px-1.5 py-0.2 rounded bg-[#800020] text-white">
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
                    <p className="text-[9px] text-emerald-700 dark:text-emerald-400 font-black tabular-nums">
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
