import React, { useState, useEffect, useMemo } from "react";
import {
  Coaching,
  CoachingExam,
  CoachingTestSeries,
  LiveTest,
  LiveTestSubmission,
  MCQSession,
  ActiveTab,
  UserProfile,
} from "../types";
import {
  subscribeToCoachings,
  subscribeToCoachingExams,
  subscribeToCoachingTestSeries,
} from "../utils/coachingHierarchyStorage";
import {
  subscribeToLiveTests,
  fetchLiveTestSubmissions,
} from "../utils/liveTestStorage";
import { triggerHaptic, playClickSound } from "../utils/audioFeedback";
import {
  ArrowLeft,
  Play,
  RefreshCw,
  Building2,
  Layers,
  ChevronRight,
  ShieldCheck,
  Award,
  BookOpen,
} from "lucide-react";

interface TestSeriesPageProps {
  coachingId: string | null;
  examId: string | null;
  seriesId: string | null;
  onNavigate: (coachingId?: string | null, examId?: string | null, seriesId?: string | null) => void;
  onStartSession: (session: MCQSession) => void;
  onNavigateTab?: (tab: ActiveTab) => void;
  isAdmin?: boolean;
  onOpenAdminManage?: () => void;
  userProfile?: UserProfile | null;
}

export const TestSeriesPage: React.FC<TestSeriesPageProps> = ({
  coachingId,
  examId,
  seriesId,
  onNavigate,
  onStartSession,
  onNavigateTab,
}) => {
  // Data State
  const [coachings, setCoachings] = useState<Coaching[]>([]);
  const [exams, setExams] = useState<CoachingExam[]>([]);
  const [seriesList, setSeriesList] = useState<CoachingTestSeries[]>([]);
  const [liveTests, setLiveTests] = useState<LiveTest[]>([]);
  const [submissions, setSubmissions] = useState<LiveTestSubmission[]>([]);
  const [fetchingTestId, setFetchingTestId] = useState<string | null>(null);

  // Subscriptions
  useEffect(() => {
    const unsubCoachings = subscribeToCoachings((data) => {
      const sorted = [...data]
        .filter((c) => c.isActive)
        .sort((a, b) => (a.order || 0) - (b.order || 0));
      setCoachings(sorted);
    });

    const unsubLiveTests = subscribeToLiveTests((testsData) => {
      setLiveTests(testsData.filter((t) => t.status !== "draft"));
    });

    fetchLiveTestSubmissions().then((subs) => {
      setSubmissions(subs);
    });

    return () => {
      unsubCoachings();
      unsubLiveTests();
    };
  }, []);

  useEffect(() => {
    if (coachingId) {
      const unsubExams = subscribeToCoachingExams(coachingId, (data) => {
        const sorted = [...data]
          .filter((e) => e.isActive)
          .sort((a, b) => (a.order || 0) - (b.order || 0));
        setExams(sorted);
      });
      return () => unsubExams();
    } else {
      setExams([]);
    }
  }, [coachingId]);

  useEffect(() => {
    if (coachingId && examId) {
      const unsubSeries = subscribeToCoachingTestSeries(coachingId, examId, (data) => {
        const sorted = [...data]
          .filter((s) => s.isActive)
          .sort((a, b) => (a.order || 0) - (b.order || 0));
        setSeriesList(sorted);
      });
      return () => unsubSeries();
    } else {
      setSeriesList([]);
    }
  }, [coachingId, examId]);

  // Selected Entities
  const activeCoaching = useMemo(() => {
    return coachings.find((c) => c.id === coachingId) || null;
  }, [coachings, coachingId]);

  const activeExam = useMemo(() => {
    return exams.find((e) => e.id === examId) || null;
  }, [exams, examId]);

  const activeSeries = useMemo(() => {
    return seriesList.find((s) => s.id === seriesId) || null;
  }, [seriesList, seriesId]);

  // Filtered lists in strict display order
  const orderedCoachings = useMemo(() => {
    return [...coachings].sort((a, b) => (a.order || 0) - (b.order || 0));
  }, [coachings]);

  const orderedExams = useMemo(() => {
    return exams
      .filter((e) => e.coachingId === coachingId)
      .sort((a, b) => (a.order || 0) - (b.order || 0));
  }, [exams, coachingId]);

  const orderedSeriesList = useMemo(() => {
    return seriesList
      .filter((s) => s.coachingId === coachingId && s.examId === examId)
      .sort((a, b) => (a.order || 0) - (b.order || 0));
  }, [seriesList, coachingId, examId]);

  // Tests matching active series
  const seriesTests = useMemo(() => {
    if (!activeSeries) return [];
    return liveTests.filter((t) => {
      if (activeSeries.testIds && activeSeries.testIds.length > 0) {
        return activeSeries.testIds.includes(t.id);
      }
      return (
        t.examCategory?.toLowerCase() === activeExam?.examName.toLowerCase() ||
        t.title?.toLowerCase().includes(activeExam?.examName || "") ||
        true
      );
    });
  }, [liveTests, activeSeries, activeExam]);

  // Start Live Test session
  const handleStartLiveTest = async (test: LiveTest) => {
    if (fetchingTestId) return;
    triggerHaptic("light");
    playClickSound();
    setFetchingTestId(test.id);

    try {
      const isCompleteQ = (q: any) =>
        Boolean(q && (q.text || q.question) && Array.isArray(q.options) && q.options.length >= 2);

      let rawQuestions: any[] = [];

      if (Array.isArray(test.questions) && test.questions.length > 0) {
        rawQuestions = test.questions.filter(isCompleteQ);
      }

      if (rawQuestions.length === 0) {
        const { fetchMCQsByLiveTest } = await import("../utils/liveTestStorage");
        const fetched = await fetchMCQsByLiveTest(test.id);
        if (fetched && fetched.length > 0) {
          rawQuestions = fetched.filter(isCompleteQ);
        }
      }

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

      if (rawQuestions.length === 0) {
        const { getAllLocalMCQs } = await import("../utils/localDatabaseEngine");
        rawQuestions = await getAllLocalMCQs();
      }

      const extraQs = rawQuestions.map((q, idx) => ({
        ...q,
        id: q.id || `series_${test.id}_q_${idx}`,
      }));
      const questionIds = extraQs.map((q) => q.id);

      onStartSession({
        title: test.title,
        subtitle: `${activeCoaching?.name || "Coaching"} • ${activeExam?.examName || "Test Series"}`,
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
      console.error("Failed to start test series session:", e);
    } finally {
      setFetchingTestId(null);
    }
  };

  const getTestSubmission = (testId: string) => {
    return submissions.find((s) => s.testId === testId);
  };

  // Route Navigation Helpers
  const handleGoPage1 = () => {
    triggerHaptic("light");
    onNavigate(null, null, null);
  };

  const handleGoPage2 = () => {
    triggerHaptic("light");
    onNavigate(coachingId, null, null);
  };

  const handleGoPage3 = () => {
    triggerHaptic("light");
    onNavigate(coachingId, examId, null);
  };

  return (
    <div
      className="flex flex-col w-full min-h-screen bg-[#FFF9EF] dark:bg-[#171923] text-[#171923] dark:text-[#FFF9EF] select-none pb-28"
      id="test-series-portal-view"
    >
      {/* ── LEVEL 4: TESTS VIEW ────────────────────────────────────────── */}
      {coachingId && examId && seriesId ? (
        <div className="w-full max-w-4xl mx-auto p-3.5 sm:p-4 space-y-4">
          <header className="px-4 py-3 rounded-2xl bg-white dark:bg-[#1F2330] border border-[#E8D9C0] dark:border-[#31374A] flex items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center gap-2.5 min-w-0">
              <button
                onClick={handleGoPage3}
                className="w-8 h-8 rounded-xl bg-[#F7EFE2] dark:bg-[#252A3A] hover:bg-[#E8D9C0] dark:hover:bg-[#31374A] flex items-center justify-center text-[#171923] dark:text-[#FFF9EF] border border-[#E8D9C0] dark:border-[#31374A] transition-all cursor-pointer shrink-0 active:scale-95"
                aria-label="Back to Test Series list"
              >
                <ArrowLeft size={16} />
              </button>
              <div className="min-w-0">
                <span className="text-[10px] font-bold text-stone-500 dark:text-stone-400 block truncate">
                  {activeCoaching?.name} • {activeExam?.examName}
                </span>
                <h1 className="text-sm sm:text-base font-black text-[#171923] dark:text-[#FFF9EF] truncate font-hindi">
                  {activeSeries?.seriesName || "Tests"}
                </h1>
              </div>
            </div>
            <span className="px-2.5 py-1 rounded-lg bg-[#800020]/10 dark:bg-[#C99A45]/15 text-[#800020] dark:text-[#C99A45] text-[10px] font-black shrink-0 border border-[#800020]/20 dark:border-[#C99A45]/30">
              {seriesTests.length} Tests
            </span>
          </header>

          <main className="space-y-3">
            {seriesTests.length === 0 ? (
              <div className="p-10 text-center bg-white dark:bg-[#1F2330] rounded-2xl border border-[#E8D9C0] dark:border-[#31374A] text-stone-500 dark:text-stone-400">
                <BookOpen size={28} className="mx-auto mb-2 text-stone-400 opacity-70" />
                <p className="font-bold">इस टेस्ट सीरीज में अभी कोई टेस्ट उपलब्ध नहीं है।</p>
              </div>
            ) : (
              seriesTests.map((test, index) => {
                const sub = getTestSubmission(test.id);
                const qCount = test.questionCount || (test.questions ? test.questions.length : 25);
                const duration = test.durationMinutes || 120;
                const marks = test.totalMarks || 200;
                const negMark = test.negativeMarking ? `-${test.negativeMarking}` : "-0.33";

                return (
                  <div
                    key={test.id}
                    className="p-4 rounded-2xl bg-white dark:bg-[#1F2330] border border-[#E8D9C0] dark:border-[#31374A] hover:border-[#800020]/50 dark:hover:border-[#C99A45]/50 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs"
                  >
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="w-5 h-5 rounded-md bg-[#800020]/10 dark:bg-[#C99A45]/15 text-[#800020] dark:text-[#C99A45] font-black text-xs flex items-center justify-center shrink-0">
                          {index + 1}
                        </span>
                        <span className="px-2 py-0.5 rounded-md bg-[#C99A45]/15 text-[#800020] dark:text-[#C99A45] text-[9.5px] font-black flex items-center gap-1 border border-[#C99A45]/30">
                          <ShieldCheck size={11} className="text-[#C99A45]" />
                          Option E नियम
                        </span>
                        {sub && (
                          <span className="px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 text-[9.5px] font-black border border-emerald-300 dark:border-emerald-800">
                            सम्पन्न: {sub.score}/{sub.totalMarks} ({sub.accuracy.toFixed(0)}%)
                          </span>
                        )}
                      </div>
                      <h3 className="text-sm font-extrabold text-[#171923] dark:text-[#FFF9EF] font-hindi leading-snug">
                        {test.title}
                      </h3>
                      <div className="flex items-center gap-3 text-[11px] font-bold text-stone-500 dark:text-stone-400 font-mono tabular-nums">
                        <span>{qCount} प्रश्न</span>
                        <span>•</span>
                        <span>{duration} मिनट</span>
                        <span>•</span>
                        <span>{marks} अंक</span>
                        <span>•</span>
                        <span className="text-[#991B1B] dark:text-[#F47B20]">Neg: {negMark}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => handleStartLiveTest(test)}
                        className="w-full sm:w-auto px-4 py-2 rounded-xl bg-gradient-to-r from-[#800020] via-[#5E0017] to-[#800020] hover:brightness-110 active:scale-95 text-[#FFF9EF] text-xs font-black flex items-center justify-center gap-2 border border-[#C99A45]/40 shadow-sm transition-all cursor-pointer"
                      >
                        {fetchingTestId === test.id ? (
                          <RefreshCw size={13} className="animate-spin text-[#C99A45]" />
                        ) : (
                          <Play size={13} fill="currentColor" className="text-[#C99A45]" />
                        )}
                        <span>{sub ? "पुनः अभ्यास करें" : "टेस्ट शुरू करें"}</span>
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </main>
        </div>
      ) : coachingId && examId ? (
        /* ── LEVEL 3: TEST SERIES PACKAGES ─────────────────────────────── */
        <div className="w-full max-w-4xl mx-auto p-3.5 sm:p-4 space-y-4">
          <header className="px-4 py-3 rounded-2xl bg-white dark:bg-[#1F2330] border border-[#E8D9C0] dark:border-[#31374A] flex items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center gap-2.5 min-w-0">
              <button
                onClick={handleGoPage2}
                className="w-8 h-8 rounded-xl bg-[#F7EFE2] dark:bg-[#252A3A] hover:bg-[#E8D9C0] dark:hover:bg-[#31374A] flex items-center justify-center text-[#171923] dark:text-[#FFF9EF] border border-[#E8D9C0] dark:border-[#31374A] transition-all cursor-pointer shrink-0 active:scale-95"
                aria-label="Back to Exam list"
              >
                <ArrowLeft size={16} />
              </button>
              <div className="min-w-0">
                <span className="text-[10px] font-bold text-stone-500 dark:text-stone-400 block truncate">
                  {activeCoaching?.name}
                </span>
                <h1 className="text-sm sm:text-base font-black text-[#171923] dark:text-[#FFF9EF] truncate font-hindi">
                  {activeExam?.examName || "Test Series"}
                </h1>
              </div>
            </div>
            <span className="px-2.5 py-1 rounded-lg bg-[#800020]/10 dark:bg-[#C99A45]/15 text-[#800020] dark:text-[#C99A45] text-[10px] font-black shrink-0 border border-[#800020]/20 dark:border-[#C99A45]/30">
              {orderedSeriesList.length} सीरीज़
            </span>
          </header>

          <main className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {orderedSeriesList.length === 0 ? (
              <div className="col-span-full p-8 text-center text-sm text-stone-500 dark:text-stone-400 bg-white dark:bg-[#1F2330] rounded-2xl border border-[#E8D9C0] dark:border-[#31374A]">
                <Layers size={28} className="mx-auto mb-2 text-stone-400 opacity-70" />
                <p className="font-bold">इस परीक्षा के लिए अभी कोई टेस्ट सीरीज उपलब्ध नहीं है।</p>
              </div>
            ) : (
              orderedSeriesList.map((series, index) => (
                <button
                  key={series.id}
                  onClick={() => {
                    triggerHaptic("light");
                    playClickSound();
                    onNavigate(coachingId, examId, series.id);
                  }}
                  className="p-4 rounded-2xl bg-white dark:bg-[#1F2330] border border-[#E8D9C0] dark:border-[#31374A] hover:border-[#800020]/50 dark:hover:border-[#C99A45]/50 transition-all text-left flex items-center justify-between gap-3 cursor-pointer group shadow-xs active:scale-[0.99]"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-[#800020]/10 dark:bg-[#C99A45]/15 text-[#800020] dark:text-[#C99A45] flex items-center justify-center shrink-0 border border-[#800020]/20 dark:border-[#C99A45]/30 group-hover:scale-105 transition-transform">
                      <Layers size={18} />
                    </div>
                    <div className="min-w-0">
                      <span className="text-[10px] font-bold text-stone-400 dark:text-stone-500 uppercase tracking-wider block">
                        सीरीज़ पैकेज #{index + 1}
                      </span>
                      <h3 className="text-sm font-extrabold text-[#171923] dark:text-[#FFF9EF] truncate font-hindi group-hover:text-[#800020] dark:group-hover:text-[#C99A45] transition-colors">
                        {series.seriesName}
                      </h3>
                      <p className="text-[11px] text-stone-500 dark:text-stone-400 mt-0.5 line-clamp-1">
                        {series.description || "संपूर्ण सिलेबस व विषयवार मॉक टेस्ट्स"}
                      </p>
                    </div>
                  </div>
                  <div className="w-8 h-8 rounded-lg bg-[#F7EFE2] dark:bg-[#252A3A] flex items-center justify-center text-stone-600 dark:text-stone-300 group-hover:bg-[#800020] group-hover:text-[#FFF9EF] transition-all shrink-0">
                    <ChevronRight size={16} />
                  </div>
                </button>
              ))
            )}
          </main>
        </div>
      ) : coachingId ? (
        /* ── LEVEL 2: EXAMS DIRECTORY ──────────────────────────────────── */
        <div className="w-full max-w-4xl mx-auto p-3.5 sm:p-4 space-y-4">
          <header className="px-4 py-3 rounded-2xl bg-white dark:bg-[#1F2330] border border-[#E8D9C0] dark:border-[#31374A] flex items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center gap-2.5 min-w-0">
              <button
                onClick={handleGoPage1}
                className="w-8 h-8 rounded-xl bg-[#F7EFE2] dark:bg-[#252A3A] hover:bg-[#E8D9C0] dark:hover:bg-[#31374A] flex items-center justify-center text-[#171923] dark:text-[#FFF9EF] border border-[#E8D9C0] dark:border-[#31374A] transition-all cursor-pointer shrink-0 active:scale-95"
                aria-label="Back to Coaching list"
              >
                <ArrowLeft size={16} />
              </button>
              <div className="min-w-0">
                <span className="text-[10px] font-bold text-stone-500 dark:text-stone-400 block truncate">
                  कोचिंग संस्थान
                </span>
                <h1 className="text-sm sm:text-base font-black text-[#171923] dark:text-[#FFF9EF] truncate font-hindi">
                  {activeCoaching?.name || "Exams"}
                </h1>
              </div>
            </div>
            <span className="px-2.5 py-1 rounded-lg bg-[#800020]/10 dark:bg-[#C99A45]/15 text-[#800020] dark:text-[#C99A45] text-[10px] font-black shrink-0 border border-[#800020]/20 dark:border-[#C99A45]/30">
              {orderedExams.length} Exams
            </span>
          </header>

          <main className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {orderedExams.length === 0 ? (
              <div className="col-span-full p-8 text-center text-sm text-stone-500 dark:text-stone-400 bg-white dark:bg-[#1F2330] rounded-2xl border border-[#E8D9C0] dark:border-[#31374A]">
                <Award size={28} className="mx-auto mb-2 text-stone-400 opacity-70" />
                <p className="font-bold">इस संस्थान के लिए अभी कोई परीक्षा उपलब्ध नहीं है।</p>
              </div>
            ) : (
              orderedExams.map((exam, index) => (
                <button
                  key={exam.id}
                  onClick={() => {
                    triggerHaptic("light");
                    playClickSound();
                    onNavigate(coachingId, exam.id, null);
                  }}
                  className="p-4 rounded-2xl bg-white dark:bg-[#1F2330] border border-[#E8D9C0] dark:border-[#31374A] hover:border-[#800020]/50 dark:hover:border-[#C99A45]/50 transition-all text-left flex items-center justify-between gap-3 cursor-pointer group shadow-xs active:scale-[0.99]"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-[#F47B20]/15 text-[#F47B20] flex items-center justify-center shrink-0 border border-[#F47B20]/30 group-hover:scale-105 transition-transform">
                      <Award size={18} />
                    </div>
                    <div className="min-w-0">
                      <span className="text-[10px] font-bold text-stone-400 dark:text-stone-500 uppercase tracking-wider block">
                        परीक्षा #{index + 1}
                      </span>
                      <h3 className="text-sm font-extrabold text-[#171923] dark:text-[#FFF9EF] truncate font-hindi group-hover:text-[#800020] dark:group-hover:text-[#C99A45] transition-colors">
                        {exam.examName}
                      </h3>
                      <p className="text-[11px] text-stone-500 dark:text-stone-400 mt-0.5">
                        RPSC / RSMSSB परीक्षा पैटर्न
                      </p>
                    </div>
                  </div>
                  <div className="w-8 h-8 rounded-lg bg-[#F7EFE2] dark:bg-[#252A3A] flex items-center justify-center text-stone-600 dark:text-stone-300 group-hover:bg-[#800020] group-hover:text-[#FFF9EF] transition-all shrink-0">
                    <ChevronRight size={16} />
                  </div>
                </button>
              ))
            )}
          </main>
        </div>
      ) : (
        /* ── LEVEL 1: COACHING INSTITUTES DIRECTORY ────────────────────── */
        <div className="w-full max-w-4xl mx-auto p-3.5 sm:p-4 space-y-4">
          <header className="px-4 py-3 rounded-2xl bg-white dark:bg-[#1F2330] border border-[#E8D9C0] dark:border-[#31374A] flex items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center gap-2.5 min-w-0">
              {onNavigateTab && (
                <button
                  onClick={() => {
                    triggerHaptic("light");
                    onNavigateTab("home");
                  }}
                  className="w-8 h-8 rounded-xl bg-[#F7EFE2] dark:bg-[#252A3A] hover:bg-[#E8D9C0] dark:hover:bg-[#31374A] flex items-center justify-center text-[#171923] dark:text-[#FFF9EF] border border-[#E8D9C0] dark:border-[#31374A] transition-all cursor-pointer shrink-0 active:scale-95"
                  aria-label="Back to Home"
                >
                  <ArrowLeft size={16} />
                </button>
              )}
              <div>
                <h1 className="text-sm sm:text-base font-black text-[#171923] dark:text-[#FFF9EF] leading-tight">
                  प्रतिष्ठित कोचिंग टेस्ट सीरीज
                </h1>
                <p className="text-[10px] font-bold text-stone-500 dark:text-stone-400 mt-0.5">
                  राजस्थान के शीर्ष संस्थानों द्वारा निर्मित प्रामाणिक परीक्षा टेस्ट्स
                </p>
              </div>
            </div>
            <span className="px-2.5 py-1 rounded-lg bg-[#800020]/10 dark:bg-[#C99A45]/15 text-[#800020] dark:text-[#C99A45] text-[10px] font-black shrink-0 border border-[#800020]/20 dark:border-[#C99A45]/30">
              {orderedCoachings.length} संस्थान
            </span>
          </header>

          <main className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {orderedCoachings.length === 0 ? (
              <div className="col-span-full p-8 text-center text-sm text-stone-500 dark:text-stone-400 bg-white dark:bg-[#1F2330] rounded-2xl border border-[#E8D9C0] dark:border-[#31374A]">
                <Building2 size={28} className="mx-auto mb-2 text-stone-400 opacity-70" />
                <p className="font-bold">अभी कोई कोचिंग संस्थान उपलब्ध नहीं है।</p>
              </div>
            ) : (
              orderedCoachings.map((coaching, index) => (
                <button
                  key={coaching.id}
                  onClick={() => {
                    triggerHaptic("light");
                    playClickSound();
                    onNavigate(coaching.id, null, null);
                  }}
                  className="p-4 rounded-2xl bg-white dark:bg-[#1F2330] border border-[#E8D9C0] dark:border-[#31374A] hover:border-[#800020]/50 dark:hover:border-[#C99A45]/50 transition-all text-left flex items-center justify-between gap-3 cursor-pointer group shadow-xs active:scale-[0.99]"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-11 h-11 rounded-2xl bg-[#800020] text-[#FFF9EF] flex items-center justify-center shrink-0 border border-[#C99A45]/40 shadow-xs group-hover:scale-105 transition-transform">
                      <span className="text-base font-black text-[#C99A45]">
                        {coaching.name.charAt(0)}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <span className="text-[9.5px] font-black text-[#C99A45] uppercase tracking-wider block">
                        संस्थान #{index + 1}
                      </span>
                      <h3 className="text-sm font-extrabold text-[#171923] dark:text-[#FFF9EF] truncate font-hindi group-hover:text-[#800020] dark:group-hover:text-[#C99A45] transition-colors">
                        {coaching.name}
                      </h3>
                      <p className="text-[11px] text-stone-500 dark:text-stone-400 mt-0.5 line-clamp-1">
                        {coaching.description || "सत्यापित परीक्षा टेस्ट सीरीज व मॉक पेपर्स"}
                      </p>
                    </div>
                  </div>
                  <div className="w-8 h-8 rounded-lg bg-[#F7EFE2] dark:bg-[#252A3A] flex items-center justify-center text-stone-600 dark:text-stone-300 group-hover:bg-[#800020] group-hover:text-[#FFF9EF] transition-all shrink-0">
                    <ChevronRight size={16} />
                  </div>
                </button>
              ))
            )}
          </main>
        </div>
      )}
    </div>
  );
};

export default TestSeriesPage;
