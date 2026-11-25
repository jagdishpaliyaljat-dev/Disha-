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
      className="flex flex-col w-full min-h-screen bg-[#F8FAFC] dark:bg-[#130E26] text-slate-900 dark:text-slate-50 select-none pb-28"
      id="test-series-portal-view"
    >
      {/* ── LEVEL 4: TESTS VIEW ────────────────────────────────────────── */}
      {coachingId && examId && seriesId ? (
        <div className="w-full max-w-4xl mx-auto p-3.5 sm:p-4 space-y-4">
          <header className="px-4 py-3 rounded-2xl bg-white dark:bg-[#1B1536] border border-slate-200 dark:border-[#31275E] flex items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center gap-2.5 min-w-0">
              <button
                onClick={handleGoPage3}
                className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-[#241D48] hover:bg-slate-200 dark:hover:bg-[#31275E] flex items-center justify-center text-slate-900 dark:text-slate-50 border border-slate-200 dark:border-[#31275E] transition-all cursor-pointer shrink-0 active:scale-95"
                aria-label="Back to Test Series list"
              >
                <ArrowLeft size={16} />
              </button>
              <div className="min-w-0">
                <span className="text-[11px] font-bold text-stone-500 dark:text-stone-400 block truncate">
                  {activeCoaching?.name} • {activeExam?.examName}
                </span>
                <h1 className="text-sm sm:text-base font-black text-slate-900 dark:text-slate-50 truncate font-hindi">
                  {activeSeries?.seriesName || "Tests"}
                </h1>
              </div>
            </div>
            <span className="px-2.5 py-1 rounded-lg bg-[#7045D8]/10 dark:bg-[#7045D8]/15 text-[#7045D8] dark:text-[#A78BFA] text-[11px] font-black shrink-0 border border-[#7045D8]/20 dark:border-[#A78BFA]/30">
              {seriesTests.length} Tests
            </span>
          </header>

          <main className="space-y-3">
            {seriesTests.length === 0 ? (
              <div className="p-10 text-center bg-white dark:bg-[#1B1536] rounded-2xl border border-slate-200 dark:border-[#31275E] text-stone-500 dark:text-stone-400">
                <BookOpen size={28} className="mx-auto mb-2 text-stone-400 opacity-70" />
                <p className="font-bold">No tests are available in this test series yet.</p>
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
                    className="p-4 rounded-2xl bg-white dark:bg-[#1B1536] border border-slate-200 dark:border-[#31275E] hover:border-[#7045D8]/50 dark:hover:border-[#A78BFA]/50 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs"
                  >
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="w-5 h-5 rounded-md bg-[#7045D8]/10 dark:bg-[#7045D8]/15 text-[#7045D8] dark:text-[#A78BFA] font-black text-xs flex items-center justify-center shrink-0">
                          {index + 1}
                        </span>
                        <span className="px-2 py-0.5 rounded-md bg-[#A78BFA]/15 text-[#7045D8] dark:text-[#A78BFA] text-[11px] font-black flex items-center gap-1 border border-[#A78BFA]/30">
                          <ShieldCheck size={11} className="text-amber-500" />
                          Option E Rule
                        </span>
                        {sub && (
                          <span className="px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 text-[11px] font-black border border-emerald-300 dark:border-emerald-800">
                            Completed: {sub.score}/{sub.totalMarks} ({sub.accuracy.toFixed(0)}%)
                          </span>
                        )}
                      </div>
                      <h3 className="text-sm font-extrabold text-slate-900 dark:text-slate-50 leading-snug">
                        {test.title}
                      </h3>
                      <div className="flex items-center gap-3 text-[11px] font-bold text-stone-500 dark:text-stone-400 font-mono tabular-nums">
                        <span>{qCount} Questions</span>
                        <span>•</span>
                        <span>{duration} Mins</span>
                        <span>•</span>
                        <span>{marks} Marks</span>
                        <span>•</span>
                        <span className="text-[#991B1B] dark:text-[#A78BFA]">Neg: {negMark}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => handleStartLiveTest(test)}
                        className="w-full sm:w-auto px-4 py-2 rounded-xl bg-gradient-to-r from-[#7045D8] via-[#5B32BF] to-[#7045D8] hover:brightness-110 active:scale-95 text-white text-xs font-black flex items-center justify-center gap-2 border border-[#A78BFA]/40 shadow-sm transition-all cursor-pointer"
                      >
                        {fetchingTestId === test.id ? (
                          <RefreshCw size={13} className="animate-spin text-amber-500" />
                        ) : (
                          <Play size={13} fill="currentColor" className="text-amber-500" />
                        )}
                        <span>{sub ? "Re-attempt Test" : "Start Test"}</span>
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
          <header className="px-4 py-3 rounded-2xl bg-white dark:bg-[#1B1536] border border-slate-200 dark:border-[#31275E] flex items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center gap-2.5 min-w-0">
              <button
                onClick={handleGoPage2}
                className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-[#241D48] hover:bg-slate-200 dark:hover:bg-[#31275E] flex items-center justify-center text-slate-900 dark:text-slate-50 border border-slate-200 dark:border-[#31275E] transition-all cursor-pointer shrink-0 active:scale-95"
                aria-label="Back to Exam list"
              >
                <ArrowLeft size={16} />
              </button>
              <div className="min-w-0">
                <span className="text-[11px] font-bold text-stone-500 dark:text-stone-400 block truncate">
                  {activeCoaching?.name}
                </span>
                <h1 className="text-sm sm:text-base font-black text-slate-900 dark:text-slate-50 truncate font-hindi">
                  {activeExam?.examName || "Test Series"}
                </h1>
              </div>
            </div>
            <span className="px-2.5 py-1 rounded-lg bg-[#7045D8]/10 dark:bg-[#7045D8]/15 text-[#7045D8] dark:text-[#A78BFA] text-[11px] font-black shrink-0 border border-[#7045D8]/20 dark:border-[#A78BFA]/30">
              {orderedSeriesList.length} Series
            </span>
          </header>

          <main className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {orderedSeriesList.length === 0 ? (
              <div className="col-span-full p-8 text-center text-sm text-stone-500 dark:text-stone-400 bg-white dark:bg-[#1B1536] rounded-2xl border border-slate-200 dark:border-[#31275E]">
                <Layers size={28} className="mx-auto mb-2 text-stone-400 opacity-70" />
                <p className="font-bold">No test series is currently available for this exam.</p>
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
                  className="p-4 rounded-2xl bg-white dark:bg-[#1B1536] border border-slate-200 dark:border-[#31275E] hover:border-[#7045D8]/50 dark:hover:border-[#A78BFA]/50 transition-all text-left flex items-center justify-between gap-3 cursor-pointer group shadow-xs active:scale-[0.99]"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-[#7045D8]/10 dark:bg-[#7045D8]/15 text-[#7045D8] dark:text-[#A78BFA] flex items-center justify-center shrink-0 border border-[#7045D8]/20 dark:border-[#A78BFA]/30 group-hover:scale-105 transition-transform">
                      <Layers size={18} />
                    </div>
                    <div className="min-w-0">
                      <span className="text-[11px] font-bold text-stone-400 dark:text-stone-500 uppercase tracking-wider block">
                        Series Package #{index + 1}
                      </span>
                      <h3 className="text-sm font-extrabold text-slate-900 dark:text-slate-50 truncate group-hover:text-[#7045D8] dark:group-hover:text-amber-500 transition-colors">
                        {series.seriesName}
                      </h3>
                      <p className="text-[11px] text-stone-500 dark:text-stone-400 mt-0.5 line-clamp-1">
                        {series.description || "Comprehensive syllabus and topic-wise mock tests"}
                      </p>
                    </div>
                  </div>
                  <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-[#241D48] flex items-center justify-center text-stone-600 dark:text-stone-300 group-hover:bg-[#7045D8] group-hover:text-white transition-all shrink-0">
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
          <header className="px-4 py-3 rounded-2xl bg-white dark:bg-[#1B1536] border border-slate-200 dark:border-[#31275E] flex items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center gap-2.5 min-w-0">
              <button
                onClick={handleGoPage1}
                className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-[#241D48] hover:bg-slate-200 dark:hover:bg-[#31275E] flex items-center justify-center text-slate-900 dark:text-slate-50 border border-slate-200 dark:border-[#31275E] transition-all cursor-pointer shrink-0 active:scale-95"
                aria-label="Back to Coaching list"
              >
                <ArrowLeft size={16} />
              </button>
              <div className="min-w-0">
                <span className="text-[11px] font-bold text-stone-500 dark:text-stone-400 block truncate">
                  Coaching Institutes
                </span>
                <h1 className="text-sm sm:text-base font-black text-slate-900 dark:text-slate-50 truncate">
                  {activeCoaching?.name || "Exams"}
                </h1>
              </div>
            </div>
            <span className="px-2.5 py-1 rounded-lg bg-[#7045D8]/10 dark:bg-[#7045D8]/15 text-[#7045D8] dark:text-[#A78BFA] text-[11px] font-black shrink-0 border border-[#7045D8]/20 dark:border-[#A78BFA]/30">
              {orderedExams.length} Exams
            </span>
          </header>

          <main className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {orderedExams.length === 0 ? (
              <div className="col-span-full p-8 text-center text-sm text-stone-500 dark:text-stone-400 bg-white dark:bg-[#1B1536] rounded-2xl border border-slate-200 dark:border-[#31275E]">
                <Award size={28} className="mx-auto mb-2 text-stone-400 opacity-70" />
                <p className="font-bold">No exams are currently available for this institute.</p>
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
                  className="p-4 rounded-2xl bg-white dark:bg-[#1B1536] border border-slate-200 dark:border-[#31275E] hover:border-[#7045D8]/50 dark:hover:border-[#A78BFA]/50 transition-all text-left flex items-center justify-between gap-3 cursor-pointer group shadow-xs active:scale-[0.99]"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-[#7045D8]/15 text-[#7045D8] flex items-center justify-center shrink-0 border border-[#7045D8]/30 group-hover:scale-105 transition-transform">
                      <Award size={18} />
                    </div>
                    <div className="min-w-0">
                      <span className="text-[11px] font-bold text-stone-400 dark:text-stone-500 uppercase tracking-wider block">
                        Exam #{index + 1}
                      </span>
                      <h3 className="text-sm font-extrabold text-slate-900 dark:text-slate-50 truncate group-hover:text-[#7045D8] dark:group-hover:text-amber-500 transition-colors">
                        {exam.examName}
                      </h3>
                      <p className="text-[11px] text-stone-500 dark:text-stone-400 mt-0.5">
                        Official Exam Pattern
                      </p>
                    </div>
                  </div>
                  <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-[#241D48] flex items-center justify-center text-stone-600 dark:text-stone-300 group-hover:bg-[#7045D8] group-hover:text-white transition-all shrink-0">
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
          <header className="px-4 py-3 rounded-2xl bg-white dark:bg-[#1B1536] border border-slate-200 dark:border-[#31275E] flex items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center gap-2.5 min-w-0">
              {onNavigateTab && (
                <button
                  onClick={() => {
                    triggerHaptic("light");
                    onNavigateTab("home");
                  }}
                  className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-[#241D48] hover:bg-slate-200 dark:hover:bg-[#31275E] flex items-center justify-center text-slate-900 dark:text-slate-50 border border-slate-200 dark:border-[#31275E] transition-all cursor-pointer shrink-0 active:scale-95"
                  aria-label="Back to Home"
                >
                  <ArrowLeft size={16} />
                </button>
              )}
              <div>
                <h1 className="text-sm sm:text-base font-black text-slate-900 dark:text-slate-50 leading-tight">
                  Premier Coaching Test Series
                </h1>
                <p className="text-[11px] font-bold text-stone-500 dark:text-stone-400 mt-0.5">
                  Verified mock tests crafted by leading educational institutions
                </p>
              </div>
            </div>
            <span className="px-2.5 py-1 rounded-lg bg-[#7045D8]/10 dark:bg-[#7045D8]/15 text-[#7045D8] dark:text-[#A78BFA] text-[11px] font-black shrink-0 border border-[#7045D8]/20 dark:border-[#A78BFA]/30">
              {orderedCoachings.length} Institutes
            </span>
          </header>

          <main className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {orderedCoachings.length === 0 ? (
              <div className="col-span-full p-8 text-center text-sm text-stone-500 dark:text-stone-400 bg-white dark:bg-[#1B1536] rounded-2xl border border-slate-200 dark:border-[#31275E]">
                <Building2 size={28} className="mx-auto mb-2 text-stone-400 opacity-70" />
                <p className="font-bold">No coaching institutes available currently.</p>
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
                  className="p-4 rounded-2xl bg-white dark:bg-[#1B1536] border border-slate-200 dark:border-[#31275E] hover:border-[#7045D8]/50 dark:hover:border-[#A78BFA]/50 transition-all text-left flex items-center justify-between gap-3 cursor-pointer group shadow-xs active:scale-[0.99]"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-11 h-11 rounded-2xl bg-[#7045D8] text-white flex items-center justify-center shrink-0 border border-[#A78BFA]/40 shadow-xs group-hover:scale-105 transition-transform">
                      <span className="text-base font-black text-amber-500">
                        {coaching.name.charAt(0)}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <span className="text-[11px] font-black text-amber-500 uppercase tracking-wider block">
                        Institute #{index + 1}
                      </span>
                      <h3 className="text-sm font-extrabold text-slate-900 dark:text-slate-50 truncate group-hover:text-[#7045D8] dark:group-hover:text-amber-500 transition-colors">
                        {coaching.name}
                      </h3>
                      <p className="text-[11px] text-stone-500 dark:text-stone-400 mt-0.5 line-clamp-1">
                        {coaching.description || "Verified examination test series and mock papers"}
                      </p>
                    </div>
                  </div>
                  <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-[#241D48] flex items-center justify-center text-stone-600 dark:text-stone-300 group-hover:bg-[#7045D8] group-hover:text-white transition-all shrink-0">
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
