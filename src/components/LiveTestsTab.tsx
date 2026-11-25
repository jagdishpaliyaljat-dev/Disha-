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
  HelpCircle,
  RefreshCw,
  Layers,
  Calendar,
  AlertCircle,
  Check,
  Edit2,
  Trash2,
  Share2,
  Medal,
  Zap,
  Crown,
  Lock,
} from "lucide-react";
import ShareModal, { ShareData } from "./ShareModal";
import { buildLiveTestShareData } from "../utils/shareService";
import { CoachingHierarchySection } from "./CoachingHierarchySection";
import { isFeatureVipLocked } from "../services/payment/premiumConfigService";

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

  // Subtabs & State
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

  // Live and Upcoming Tests — also exclude tests whose endTime has already passed (BUG-08)
  const liveAndUpcoming = React.useMemo(() => {
    const now = Date.now();
    return tests.filter((t) => {
      if (t.status !== "live" && t.status !== "upcoming") return false;
      // If the test has an endTime and it's already past, exclude it
      if (t.endTime && new Date(t.endTime).getTime() <= now) return false;
      return true;
    });
  }, [tests]);

  // Check if test was attempted
  const getTestSubmission = (testId: string) => {
    return submissions.find((s) => s.testId === testId);
  };

  // Derive Global Leaderboard Entries (Purely authentic submissions, zero mock benchmarks)
  const leaderboardEntries = React.useMemo(() => {
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

    realEntries.sort((a, b) => b.score - a.score || a.timeSpentSeconds - b.timeSpentSeconds);

    return realEntries.map((entry, index) => ({
      ...entry,
      rank: index + 1,
    }));
  }, [submissions, leaderboardFilterTestId, userProfile?.id]);

  // Start Exam Session with question resolution
  const handleStartLiveTest = async (test: LiveTest) => {
    if (fetchingTestId) return;

    // Check if mock test is VIP locked
    const testIndex = tests.findIndex((t) => t.id === test.id);
    if (isFeatureVipLocked("mock_tests", userProfile, { testIndex: testIndex >= 0 ? testIndex : 0 })) {
      triggerHaptic("warning");
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("disha_open_premium_modal", {
            detail: {
              trigger: "mock_tests",
              title: "VIP Mock Test Locked",
              message: "This live mock test is reserved for VIP Pass members. Upgrade now to unlock all tests & state merit ranking!",
            },
          })
        );
      }
      return;
    }

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
      className="flex flex-col w-full min-h-screen bg-[#F8FAFC] dark:bg-[#130E26] text-slate-900 dark:text-slate-50 select-none antialiased pb-32"
      id="tests-hub-mobile-view"
    >
      <header className="sticky top-0 md:top-14 z-30 bg-white/95 dark:bg-[#130E26]/95 backdrop-blur-md border-b border-slate-200 dark:border-[#31275E] shadow-xs transition-colors pt-[env(safe-area-inset-top,0px)] md:pt-0">
        <div className="px-3.5 sm:px-4 py-2.5 min-h-[60px] flex items-center justify-between gap-3 max-w-4xl mx-auto w-full">
          {/* Back & Title */}
          <div className="flex items-center gap-2.5 min-w-0">
            {onNavigateTab && (
              <button
                type="button"
                onClick={() => {
                  triggerHaptic("light");
                  onNavigateTab("home");
                }}
                className="md:hidden w-11 h-11 rounded-xl bg-slate-100 dark:bg-[#241D48] hover:bg-slate-200/80 dark:hover:bg-[#31275E] flex items-center justify-center text-slate-900 dark:text-slate-50 border border-slate-200 dark:border-[#31275E] shadow-xs active:scale-95 transition-all cursor-pointer shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7045D8]"
                aria-label="Back to home"
              >
                <ArrowLeft size={18} />
              </button>
            )}
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-sm sm:text-base font-black text-slate-900 dark:text-slate-50 leading-tight truncate tracking-tight">
                  Live Tests &amp; Test Series
                </h1>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-500/10 dark:bg-rose-500/15 border border-rose-500/25 text-[11px] font-black text-rose-600 dark:text-rose-400 shrink-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-600 animate-pulse" />
                  LIVE
                </span>
              </div>
              <p className="text-[11px] text-[#7045D8] dark:text-[#A78BFA] font-bold leading-none mt-1 truncate tracking-wide">
                Official RPSC &amp; RSMSSB Simulation · All-Rajasthan Merit
              </p>
            </div>
          </div>

          {/* Admin Create Action */}
          {isAdmin && onOpenAdminManage && (
            <button
              type="button"
              onClick={() => {
                triggerHaptic("light");
                onOpenAdminManage();
              }}
              className="min-h-[44px] px-3.5 py-2 rounded-xl bg-[#7045D8] hover:bg-[#5B32BF] text-white font-black text-xs shadow-sm active:scale-95 transition-all cursor-pointer shrink-0 flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7045D8]"
            >
              <Zap size={13} className="fill-current" />
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
          className="p-1 bg-slate-100 dark:bg-[#241D48] rounded-2xl flex items-center border border-slate-200 dark:border-[#31275E] shadow-xs"
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
                ? "bg-[#7045D8] text-white shadow-sm border border-[#A78BFA]/40"
                : "text-stone-600 dark:text-stone-300 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <Radio size={13} className={activeSubTab === "live" ? "text-amber-500" : ""} />
            <span>Live Tests</span>
            {liveAndUpcoming.length > 0 && (
              <span
                className={`ml-0.5 px-1.5 py-0.2 rounded-full text-[11px] font-mono tabular-nums ${
                  activeSubTab === "live"
                    ? "bg-[#A78BFA] text-slate-900 font-black"
                    : "bg-[#7045D8]/10 text-[#7045D8] dark:bg-[#1B1536] dark:text-[#A78BFA]"
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
                ? "bg-[#7045D8] text-white shadow-sm border border-[#A78BFA]/40"
                : "text-stone-600 dark:text-stone-300 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <Layers size={13} className={activeSubTab === "series" ? "text-amber-500" : ""} />
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
                ? "bg-[#7045D8] text-white shadow-sm border border-[#A78BFA]/40"
                : "text-stone-600 dark:text-stone-300 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <Award size={13} className={activeSubTab === "results" ? "text-amber-500" : ""} />
            <span>Scores</span>
            {submissions.length > 0 && (
              <span
                className={`ml-0.5 px-1.5 py-0.2 rounded-full text-[11px] font-mono tabular-nums ${
                  activeSubTab === "results"
                    ? "bg-[#A78BFA] text-slate-900 font-black"
                    : "bg-[#7045D8]/10 text-[#7045D8] dark:bg-[#1B1536] dark:text-[#A78BFA]"
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
                ? "bg-[#7045D8] text-white shadow-sm border border-[#A78BFA]/40"
                : "text-stone-600 dark:text-stone-300 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <Trophy size={13} className={activeSubTab === "leaderboard" ? "text-amber-500" : ""} />
            <span>Ranks</span>
          </button>
        </nav>

        {/* ── 3. LIVE TESTS TAB CONTENT ───────────────────────────────────── */}
        {activeSubTab === "live" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {isLoading ? (
              <div className="md:col-span-2 p-10 text-center bg-white dark:bg-[#1B1536] rounded-2xl border border-slate-200 dark:border-[#31275E] flex flex-col items-center shadow-xs">
                <RefreshCw size={24} className="text-[#7045D8] dark:text-[#C5A059] animate-spin mb-2.5" />
                <p className="font-black text-xs sm:text-sm text-slate-900 dark:text-slate-50">
                  Syncing Live Tests...
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Fetching official examination schedules
                </p>
              </div>
            ) : liveAndUpcoming.length === 0 ? (
              <div className="md:col-span-2 p-8 text-center bg-white dark:bg-[#1B1536] rounded-2xl border border-slate-200 dark:border-[#31275E] flex flex-col items-center shadow-xs">
                <div className="w-12 h-12 rounded-2xl bg-[#7045D8]/10 dark:bg-[#7045D8]/15 flex items-center justify-center text-[#7045D8] dark:text-[#A78BFA] mb-2.5 border border-[#7045D8]/15 dark:border-[#A78BFA]/30">
                  <Radio size={22} />
                </div>
                <h3 className="font-black text-sm text-slate-900 dark:text-slate-50 mb-1">
                  No Active Live Tests Scheduled
                </h3>
                <p className="text-stone-500 dark:text-stone-400 text-xs mb-3.5 max-w-xs leading-relaxed">
                  No live test is currently scheduled. Prepare with comprehensive Test Series or check back shortly for upcoming official sessions.
                </p>
                <button
                  onClick={() => {
                    triggerHaptic("light");
                    setActiveSubTab("series");
                  }}
                  className="px-4 py-2 rounded-xl bg-[#7045D8] hover:bg-[#5B32BF] dark:bg-[#7045D8] text-white text-xs font-black border border-[#A78BFA]/40 active:scale-95 transition-all shadow-xs cursor-pointer flex items-center gap-1.5"
                >
                  <Layers size={13} className="text-amber-500" />
                  <span>Explore Test Series</span>
                </button>
              </div>
            ) : (
              liveAndUpcoming.map((test, index) => {
                const existingSub = getTestSubmission(test.id);
                const questionCount = test.questionCount || (test.questions ? test.questions.length : 0);
                const durationMinutes = test.durationMinutes || 120;
                const totalMarks = test.totalMarks || 200;
                const negMark = test.negativeMarking ? `-${test.negativeMarking}` : "-0.33";
                const isTestLocked = isFeatureVipLocked("mock_tests", userProfile, { testIndex: index });

                return (
                  <article
                    key={test.id}
                    className="bg-white dark:bg-[#1B1536] rounded-2xl border border-slate-200 dark:border-[#31275E] p-4 shadow-xs hover:border-[#7045D8]/50 dark:hover:border-[#A78BFA]/50 transition-all flex flex-col justify-between space-y-3"
                  >
                    <div className="space-y-2.5">
                      {/* Top Badges Row */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="bg-[#7045D8]/10 text-[#7045D8] dark:bg-[#7045D8]/15 dark:text-[#A78BFA] text-[11px] font-black uppercase px-2 py-0.5 rounded-lg border border-[#7045D8]/25 dark:border-[#A78BFA]/35 truncate">
                            {test.examCategory || "General Exam"}
                          </span>
                          <span className="bg-[#A78BFA]/15 text-[#7045D8] dark:text-[#A78BFA] text-[11px] font-black uppercase px-1.5 py-0.5 rounded-lg border border-[#A78BFA]/30 shrink-0 flex items-center gap-1">
                            <ShieldCheck size={11} className="text-amber-500" />
                            Option E
                          </span>
                        </div>

                        <div className="flex items-center gap-1">
                          {isTestLocked ? (
                            <div className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/15 dark:bg-amber-500/25 border border-amber-500/40 text-amber-700 dark:text-amber-400 shrink-0">
                              <Lock size={10} className="text-amber-600 dark:text-amber-400" />
                              <span className="text-[11px] font-black uppercase tracking-wider">
                                VIP PASS
                              </span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/10 dark:bg-emerald-500/20 border border-emerald-500/30 text-emerald-700 dark:text-emerald-400 shrink-0">
                              <span className="text-[11px] font-black uppercase tracking-wider">
                                FREE DEMO
                              </span>
                            </div>
                          )}

                          <div className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#991B1B]/10 dark:bg-[#991B1B]/25 border border-[#991B1B]/30 text-[#991B1B] dark:text-[#A78BFA] shrink-0">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#991B1B] animate-ping" />
                            <span className="text-[11px] font-black uppercase tracking-wider">
                              LIVE
                            </span>
                          </div>
                          <button
                            onClick={() => handleShareLiveTest(test)}
                            className="p-1.5 rounded-lg bg-slate-100 dark:bg-[#241D48] text-[#7045D8] dark:text-[#A78BFA] hover:bg-slate-200/60 transition-all cursor-pointer border border-slate-200 dark:border-[#31275E] active:scale-95"
                            title="Share Test"
                            aria-label="Share test"
                          >
                            <Share2 size={13} />
                          </button>
                        </div>
                      </div>

                      {/* Title & Instructions */}
                      <div>
                        <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-slate-50 leading-snug font-hindi">
                          {test.title}
                        </h3>
                        {test.hindiTitle && (
                          <p className="text-xs text-stone-500 dark:text-stone-400 font-hindi mt-0.5 line-clamp-1">
                            {test.hindiTitle}
                          </p>
                        )}
                        {test.instructions && (
                          <p className="text-[11px] text-stone-500 dark:text-stone-400 font-medium mt-1 line-clamp-2 leading-relaxed">
                            {test.instructions}
                          </p>
                        )}

                        {/* RPSC 5th Option Rule Notice */}
                        <div className="mt-2 p-2 rounded-xl bg-[#F8FAFC] dark:bg-[#130E26] border border-slate-200 dark:border-[#31275E] text-[11px] leading-relaxed text-slate-900 dark:text-slate-200 flex items-start gap-1.5">
                          <AlertCircle size={13} className="shrink-0 text-[#7045D8] dark:text-[#A78BFA] mt-0.5" />
                          <div>
                            <strong className="text-[#7045D8] dark:text-[#A78BFA]">RPSC Option E Rule:</strong> If you do not wish to attempt a question, select Option E ('Unattempted'). Leaving it blank deducts {negMark} marks, and leaving &gt;10% blank results in disqualification.
                          </div>
                        </div>
                      </div>

                      {/* Stats Micro-Cards */}
                      <div className="grid grid-cols-4 gap-1.5 text-center pt-1">
                        <div className="bg-slate-100/60 dark:bg-[#130E26] p-2 rounded-xl border border-slate-200 dark:border-[#31275E] flex flex-col items-center justify-center">
                          <span className="text-[11px] font-black text-stone-500 dark:text-stone-400 uppercase tracking-wider">
                            Questions
                          </span>
                          <span className="text-xs sm:text-sm font-black text-slate-900 dark:text-slate-50 tabular-nums mt-0.5">
                            {questionCount}
                          </span>
                        </div>

                        <div className="bg-slate-100/60 dark:bg-[#130E26] p-2 rounded-xl border border-slate-200 dark:border-[#31275E] flex flex-col items-center justify-center">
                          <span className="text-[11px] font-black text-stone-500 dark:text-stone-400 uppercase tracking-wider">
                            Duration
                          </span>
                          <span className="text-xs sm:text-sm font-black text-slate-900 dark:text-slate-50 tabular-nums mt-0.5">
                            {durationMinutes}m
                          </span>
                        </div>

                        <div className="bg-slate-100/60 dark:bg-[#130E26] p-2 rounded-xl border border-slate-200 dark:border-[#31275E] flex flex-col items-center justify-center">
                          <span className="text-[11px] font-black text-stone-500 dark:text-stone-400 uppercase tracking-wider">
                            Marks
                          </span>
                          <span className="text-xs sm:text-sm font-black text-[#7045D8] dark:text-[#A78BFA] tabular-nums mt-0.5">
                            {totalMarks}
                          </span>
                        </div>

                        <div className="bg-slate-100/60 dark:bg-[#130E26] p-2 rounded-xl border border-slate-200 dark:border-[#31275E] flex flex-col items-center justify-center">
                          <span className="text-[11px] font-black text-stone-500 dark:text-stone-400 uppercase tracking-wider">
                            Negative
                          </span>
                          <span className="text-xs sm:text-sm font-black text-[#991B1B] dark:text-[#A78BFA] tabular-nums mt-0.5">
                            {negMark}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Action Area */}
                    <div className="space-y-2 pt-1 border-t border-slate-200/70 dark:border-[#31275E]/70">
                      {existingSub ? (
                        <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200/70 dark:border-emerald-800/50 rounded-xl flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <span className="text-[11px] font-black text-emerald-700 dark:text-emerald-400 uppercase tracking-wider block">
                              ALREADY ATTEMPTED
                            </span>
                            <p className="text-xs font-black text-slate-900 dark:text-slate-50 mt-0.5 tabular-nums">
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
                      ) : isTestLocked ? (
                        <button
                          onClick={() => {
                            triggerHaptic("medium");
                            if (typeof window !== "undefined") {
                              window.dispatchEvent(
                                new CustomEvent("disha_open_premium_modal", {
                                  detail: {
                                    trigger: "mock_tests",
                                    title: "VIP Mock Test Locked",
                                    message: "This test is reserved for VIP Pass members. Upgrade now to unlock all full-length tests!",
                                  },
                                })
                              );
                            }
                          }}
                          className="w-full bg-gradient-to-r from-amber-600 via-amber-500 to-amber-600 hover:brightness-110 active:scale-[0.99] text-white py-2.5 px-4 rounded-xl font-black text-xs sm:text-sm flex items-center justify-center gap-2 border border-amber-300 shadow-md shadow-amber-600/20 transition-all duration-150 cursor-pointer min-h-[44px]"
                        >
                          <Lock size={15} />
                          <span>Unlock with VIP Pass</span>
                          <Crown size={14} className="text-amber-200" />
                        </button>
                      ) : (
                        <button
                          onClick={() => handleStartLiveTest(test)}
                          className="w-full bg-gradient-to-r from-[#7045D8] via-[#5B32BF] to-[#7045D8] hover:brightness-110 active:scale-[0.99] text-white py-2.5 px-4 rounded-xl font-black text-xs sm:text-sm flex items-center justify-center gap-2 border border-[#A78BFA]/40 shadow-md shadow-[#7045D8]/25 transition-all duration-150 cursor-pointer min-h-[44px] group"
                        >
                          {fetchingTestId === test.id ? (
                            <RefreshCw size={15} className="animate-spin text-amber-500" />
                          ) : (
                            <Play size={15} fill="currentColor" className="text-amber-500 group-hover:scale-110 transition-transform" />
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
                            className="flex-1 py-1.5 bg-slate-100 dark:bg-[#241D48] text-[#7045D8] dark:text-[#A78BFA] font-black rounded-lg text-xs flex items-center justify-center gap-1.5 cursor-pointer border border-slate-200 dark:border-[#31275E]"
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
                            className="px-2.5 py-1.5 bg-[#991B1B]/10 dark:bg-[#991B1B]/20 hover:bg-[#991B1B]/20 text-[#991B1B] dark:text-[#A78BFA] font-black rounded-lg text-xs flex items-center justify-center gap-1 cursor-pointer border border-[#991B1B]/30"
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

        {/* ── 4. TEST SERIES TAB CONTENT ──────────────────────────────────── */}
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

        {/* ── 5. SCORES TAB CONTENT ───────────────────────────────────────── */}
        {activeSubTab === "results" && (
          <div className="space-y-3">
            {submissions.length === 0 ? (
              <div className="p-8 text-center bg-white dark:bg-[#1B1536] rounded-2xl border border-slate-200 dark:border-[#31275E] flex flex-col items-center shadow-xs">
                <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-[#241D48] flex items-center justify-center text-amber-500 mb-2.5 border border-slate-200 dark:border-[#31275E]">
                  <Trophy size={24} />
                </div>
                <h3 className="font-black text-sm text-slate-900 dark:text-slate-50 mb-1">
                  No Exam Records Found
                </h3>
                <p className="text-stone-500 dark:text-stone-400 text-xs mb-3.5 max-w-xs leading-relaxed">
                  Your detailed scorecards, RPSC accuracy analysis, and percentiles will appear here as soon as you submit a test.
                </p>
                <button
                  onClick={() => {
                    triggerHaptic("light");
                    setActiveSubTab("live");
                  }}
                  className="px-4 py-2 rounded-xl bg-[#7045D8] hover:bg-[#5B32BF] dark:bg-[#7045D8] text-white text-xs font-black border border-[#A78BFA]/40 active:scale-95 transition-all shadow-xs cursor-pointer flex items-center gap-1.5"
                >
                  <Play size={13} fill="currentColor" className="text-amber-500" />
                  <span>Attempt a Live Test Now</span>
                </button>
              </div>
            ) : (
              submissions.map((sub) => (
                <article
                  key={sub.submissionId}
                  className="bg-white dark:bg-[#1B1536] rounded-2xl border border-slate-200 dark:border-[#31275E] p-4 shadow-xs space-y-2.5"
                >
                  <div className="flex justify-between items-center">
                    <span className="text-[11px] font-black text-stone-500 dark:text-stone-400 uppercase tracking-wider flex items-center gap-1">
                      <Calendar size={11} />
                      {new Date(sub.submittedAt).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </span>
                    <span className="bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 text-[11px] font-black px-2 py-0.5 rounded-lg border border-emerald-200/50 dark:border-emerald-800/40 tabular-nums">
                      {sub.accuracy.toFixed(0)}% Accuracy
                    </span>
                  </div>

                  <h3 className="text-sm font-black text-slate-900 dark:text-slate-50 leading-snug">
                    {sub.testTitle}
                  </h3>

                  {sub.isRpscDisqualified && (
                    <div className="p-2 rounded-xl bg-[#991B1B]/10 border border-[#991B1B]/30 text-[#991B1B] dark:text-[#A78BFA] text-[11px] font-bold flex items-center gap-1.5">
                      <AlertCircle size={14} className="shrink-0 text-[#991B1B] dark:text-[#A78BFA]" />
                      <span>RPSC Disqualified: More than 10% questions left blank</span>
                    </div>
                  )}

                  <div className="grid grid-cols-4 gap-1.5 bg-[#F8FAFC] dark:bg-[#130E26] p-2.5 rounded-xl border border-slate-200 dark:border-[#31275E] text-center">
                    <div>
                      <p className="text-[11px] text-stone-500 dark:text-stone-400 font-black uppercase">
                        Score
                      </p>
                      <p className="text-xs font-black text-[#7045D8] dark:text-[#A78BFA] tabular-nums mt-0.5">
                        {sub.score}/{sub.totalMarks}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] text-stone-500 dark:text-stone-400 font-black uppercase">
                        Correct / Wrong
                      </p>
                      <p className="text-xs font-black tabular-nums mt-0.5">
                        <span className="text-emerald-700 dark:text-emerald-400">{sub.correctCount}</span>
                        <span className="text-stone-400 mx-0.5">/</span>
                        <span className="text-[#991B1B] dark:text-[#A78BFA]">{sub.wrongCount}</span>
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] text-stone-500 dark:text-stone-400 font-black uppercase">
                        Option E
                      </p>
                      <p className="text-xs font-black text-amber-500 tabular-nums mt-0.5">
                        {sub.unattemptedECount ?? 0}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] text-stone-500 dark:text-stone-400 font-black uppercase">
                        Time
                      </p>
                      <p className="text-xs font-black text-slate-900 dark:text-slate-50 tabular-nums mt-0.5">
                        {Math.floor(sub.timeSpentSeconds / 60)}m
                      </p>
                    </div>
                  </div>
                </article>
              ))
            )}
          </div>
        )}

        {/* ── 6. GLOBAL LEADERBOARD & RANKS ────────────────────────────────── */}
        {activeSubTab === "leaderboard" && (
          <div className="space-y-3.5">
            {/* Filter Selector Header */}
            <div className="bg-white dark:bg-[#1B1536] p-3 rounded-2xl border border-slate-200 dark:border-[#31275E] shadow-xs flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <Trophy size={16} className="text-amber-500 shrink-0" />
                <span className="text-xs font-black text-slate-900 dark:text-slate-50 truncate">
                  State Merit Ranks
                </span>
              </div>
              <select
                value={leaderboardFilterTestId}
                onChange={(e) => setLeaderboardFilterTestId(e.target.value)}
                aria-label="Filter leaderboard by live test"
                className="min-h-[40px] bg-slate-100 dark:bg-[#130E26] border border-slate-200 dark:border-[#31275E] text-xs font-black rounded-xl px-3 py-1.5 text-slate-900 dark:text-slate-50 focus:outline-none focus:ring-2 focus:ring-[#7045D8] max-w-[200px] truncate cursor-pointer"
              >
                <option value="all">All Live Tests (Cumulative)</option>
                {tests.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title}
                  </option>
                ))}
              </select>
            </div>

            {/* Empty State vs Standings */}
            {leaderboardEntries.length === 0 ? (
              <div className="p-8 text-center bg-white dark:bg-[#1B1536] rounded-2xl border border-slate-200 dark:border-[#31275E] flex flex-col items-center shadow-xs">
                <div className="w-12 h-12 rounded-2xl bg-[#7045D8]/10 dark:bg-[#7045D8]/15 flex items-center justify-center text-[#7045D8] dark:text-[#A78BFA] mb-2.5 border border-[#7045D8]/15 dark:border-[#A78BFA]/30">
                  <Trophy size={22} />
                </div>
                <h3 className="font-black text-sm text-slate-900 dark:text-slate-50 mb-1">
                  No Test Attempts Yet
                </h3>
                <p className="text-stone-500 dark:text-stone-400 text-xs max-w-xs leading-relaxed">
                  Attempt a live test to establish your verified score and view official state-wide merit rankings.
                </p>
              </div>
            ) : (
              <>
                {/* Podium for Top 3 */}
                {leaderboardEntries.length >= 3 && (
                  <div className="bg-gradient-to-b from-[#7045D8]/15 via-[#A78BFA]/10 to-transparent dark:from-[#7045D8]/30 p-4 rounded-2xl border border-[#A78BFA]/40 shadow-sm">
                    <div className="flex items-end justify-center gap-2 pt-2 pb-1">
                      {/* Rank 2 - Silver */}
                      <div className="flex-1 max-w-[95px] flex flex-col items-center">
                        <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-700 border-2 border-slate-300 dark:border-slate-500 flex items-center justify-center font-black text-slate-700 dark:text-slate-200 text-xs shadow-md relative">
                          <Medal size={15} className="text-slate-500 absolute -top-2 -left-1" />
                          {leaderboardEntries[1].userName.charAt(0)}
                        </div>
                        <span className="text-[11px] font-black text-slate-900 dark:text-slate-50 mt-1 truncate max-w-full text-center">
                          {leaderboardEntries[1].userName}
                        </span>
                        <span className="text-[11px] font-black text-stone-500 dark:text-stone-400 tabular-nums">
                          {leaderboardEntries[1].score} pts
                        </span>
                        <div className="w-full bg-slate-200 dark:bg-slate-700/80 rounded-t-xl h-11 mt-1.5 flex items-center justify-center font-black text-slate-700 dark:text-slate-200 text-xs tabular-nums">
                          #2
                        </div>
                      </div>

                      {/* Rank 1 - Gold (Elevated) */}
                      <div className="flex-1 max-w-[105px] flex flex-col items-center -mt-3">
                        <div className="w-12 h-12 rounded-full bg-[#A78BFA]/25 border-2 border-[#A78BFA] flex items-center justify-center font-black text-[#7045D8] dark:text-[#A78BFA] text-sm shadow-lg relative">
                          <Trophy size={17} className="text-amber-500 absolute -top-2.5 left-1/2 -translate-x-1/2" />
                          {leaderboardEntries[0].userName.charAt(0)}
                        </div>
                        <span className="text-[11px] font-black text-slate-900 dark:text-slate-50 mt-1 truncate max-w-full text-center">
                          {leaderboardEntries[0].userName}
                        </span>
                        <span className="text-[11px] font-black text-[#7045D8] dark:text-[#A78BFA] tabular-nums">
                          {leaderboardEntries[0].score} pts
                        </span>
                        <div className="w-full bg-gradient-to-t from-[#B8860B] to-[#A78BFA] rounded-t-2xl h-16 mt-1.5 flex flex-col items-center justify-center font-black text-slate-900 text-xs shadow-md tabular-nums">
                          <span>#1</span>
                          <span className="text-[11px] font-black uppercase tracking-wider">TOPPER</span>
                        </div>
                      </div>

                      {/* Rank 3 - Bronze */}
                      <div className="flex-1 max-w-[95px] flex flex-col items-center">
                        <div className="w-10 h-10 rounded-full bg-amber-700/20 border-2 border-amber-600/60 flex items-center justify-center font-black text-amber-700 dark:text-amber-400 text-xs shadow-md relative">
                          <Award size={15} className="text-amber-600 absolute -top-2 -right-1" />
                          {leaderboardEntries[2].userName.charAt(0)}
                        </div>
                        <span className="text-[11px] font-black text-slate-900 dark:text-slate-50 mt-1 truncate max-w-full text-center">
                          {leaderboardEntries[2].userName}
                        </span>
                        <span className="text-[11px] font-black text-stone-500 dark:text-stone-400 tabular-nums">
                          {leaderboardEntries[2].score} pts
                        </span>
                        <div className="w-full bg-amber-700/20 dark:bg-amber-900/40 rounded-t-xl h-9 mt-1.5 flex items-center justify-center font-black text-[#7045D8] dark:text-amber-300 text-xs tabular-nums">
                          #3
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Standings List */}
                <div className="space-y-1.5">
                  <h3 className="text-[11px] font-black uppercase tracking-wider text-stone-500 dark:text-stone-400 px-1">
                    Full Merit Standings
                  </h3>

                  {isFeatureVipLocked("state_merit_rank", userProfile) ? (
                    <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-amber-500/10 via-amber-600/5 to-transparent border border-amber-500/30 text-center space-y-3">
                      <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 mx-auto flex items-center justify-center">
                        <Lock size={18} />
                      </div>
                      <div>
                        <h4 className="text-sm font-black text-slate-900 dark:text-slate-50">
                          All-Rajasthan Realtime Merit Rank
                        </h4>
                        <p className="text-xs text-stone-500 dark:text-stone-400 mt-1 max-w-sm mx-auto">
                          हजारों अभ्यर्थियों के बीच आपकी सटीक राज्यस्तरीय रैंक और परसेंटाइल केवल VIP Pass में उपलब्ध है।
                        </p>
                      </div>
                      <button
                        onClick={() => {
                          triggerHaptic("medium");
                          if (typeof window !== "undefined") {
                            window.dispatchEvent(
                              new CustomEvent("disha_open_premium_modal", {
                                detail: {
                                  trigger: "state_merit_rank",
                                  title: "Unlock Rajasthan Merit Rank",
                                  message: "See your exact position, percentile and performance breakdown with Disha VIP Pass!",
                                },
                              })
                            );
                          }
                        }}
                        className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 text-white font-black text-xs shadow-md shadow-amber-600/25 active:scale-95 transition-all inline-flex items-center gap-1.5 cursor-pointer"
                      >
                        <Lock size={13} />
                        <span>Unlock Complete Merit Standings</span>
                        <Crown size={13} className="text-amber-200" />
                      </button>
                    </div>
                  ) : (
                    leaderboardEntries.map((entry) => (
                      <article
                        key={entry.id}
                        className={`p-2.5 sm:p-3 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
                          entry.isCurrentUser
                            ? "bg-[#7045D8]/10 dark:bg-[#7045D8]/25 border-[#7045D8]/50 dark:border-[#A78BFA]/50 shadow-xs"
                            : "bg-white dark:bg-[#1B1536] border-slate-200 dark:border-[#31275E] shadow-xs"
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div
                            className={`w-7 h-7 rounded-xl flex items-center justify-center font-black text-xs shrink-0 tabular-nums ${
                              entry.rank === 1
                                ? "bg-[#A78BFA] text-slate-900"
                                : entry.rank === 2
                                ? "bg-slate-300 text-slate-800 dark:bg-slate-600 dark:text-white"
                                : entry.rank === 3
                                ? "bg-amber-700/30 text-amber-900 dark:text-amber-200"
                                : "bg-slate-100 dark:bg-[#241D48] text-stone-600 dark:text-stone-300"
                            }`}
                          >
                            #{entry.rank}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <p className="text-xs font-black text-slate-900 dark:text-slate-50 truncate">
                                {entry.userName}
                              </p>
                              {entry.isCurrentUser && (
                                <span className="text-[11px] font-black uppercase px-1.5 py-0.2 rounded bg-[#7045D8] text-white border border-[#A78BFA]/30">
                                  YOU
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-stone-500 dark:text-stone-400 truncate">
                              {entry.testTitle}
                            </p>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <p className="text-xs font-black text-slate-900 dark:text-slate-50 tabular-nums">
                            {entry.score} pts
                          </p>
                          <p className="text-[11px] text-emerald-700 dark:text-emerald-400 font-black tabular-nums">
                            {entry.accuracy}% Acc
                          </p>
                        </div>
                      </article>
                    ))
                  )}
                </div>
              </>
            )}
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
