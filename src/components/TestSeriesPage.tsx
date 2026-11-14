import React, { useState, useEffect, useMemo } from "react";
import { 
  Coaching, 
  CoachingExam, 
  CoachingTestSeries, 
  LiveTest, 
  LiveTestSubmission, 
  MCQSession,
  ActiveTab,
  UserProfile
} from "../types";
import { 
  subscribeToCoachings, 
  subscribeToCoachingExams, 
  subscribeToCoachingTestSeries 
} from "../utils/coachingHierarchyStorage";
import { 
  subscribeToLiveTests, 
  fetchLiveTestSubmissions 
} from "../utils/liveTestStorage";
import { triggerHaptic, playClickSound } from "../utils/audioFeedback";
import { ArrowLeft, Play, RefreshCw } from "lucide-react";

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
  const [fetchingTestId, setFetchingTestId] = useState<string | null>(null);

  // Subscriptions
  useEffect(() => {
    const unsubCoachings = subscribeToCoachings((data) => {
      // Sort by order ascending
      const sorted = [...data]
        .filter((c) => c.isActive)
        .sort((a, b) => (a.order || 0) - (b.order || 0));
      setCoachings(sorted);
    });

    const unsubLiveTests = subscribeToLiveTests((testsData) => {
      setLiveTests(testsData.filter((t) => t.status !== "draft"));
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

  // Start Existing Test
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
        const { fetchMCQsByLiveTest } = await import("../utils/firebaseSyncService");
        const fetched = await fetchMCQsByLiveTest(test.id);
        if (fetched && fetched.length > 0) {
          rawQuestions = fetched.filter(isCompleteQ);
        }
      }

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
        id: q.id || `series_${test.id}_q_${idx}`
      }));
      const questionIds = extraQs.map(q => q.id);

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

  // Dedicated Route Navigation Helpers
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

  // Active tests matching the selected series
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

  // Page 3 Test Click -> If single test, start test; if seriesTests open test launcher
  const handleTestSeriesClick = (series: CoachingTestSeries) => {
    triggerHaptic("light");
    playClickSound();
    onNavigate(coachingId, examId, series.id);
  };

  return (
    <div
      className="flex flex-col w-full min-h-screen bg-[#FFF9EF] dark:bg-[#171923] text-[#171923] dark:text-[#FFF9EF] select-none pb-24"
      id="test-series-minimal-view"
    >
      {coachingId && examId && seriesId ? (
        <div className="w-full max-w-3xl mx-auto">
          <header className="px-4 py-3 border-b border-[#E8D9C0] dark:border-[#31374A] flex items-center gap-3 sticky top-0 bg-white/95 dark:bg-[#1F2330]/95 backdrop-blur-xs z-10">
            <button
              onClick={handleGoPage3}
              className="w-9 h-9 rounded-xl bg-[#F7EFE2] dark:bg-[#252A3A] flex items-center justify-center text-[#171923] dark:text-[#FFF9EF] cursor-pointer"
              aria-label="Back to Test Series list"
            >
              <ArrowLeft size={18} />
            </button>
            <h1 className="text-base font-bold text-[#171923] dark:text-[#FFF9EF] truncate font-hindi">
              {activeSeries?.seriesName || "Tests"}
            </h1>
          </header>

          <main className="divide-y divide-[#E8D9C0] dark:divide-[#31374A] bg-white dark:bg-[#1F2330] sm:mt-4 sm:rounded-2xl sm:border sm:border-[#E8D9C0] dark:sm:border-[#31374A] overflow-hidden">
            {seriesTests.length === 0 ? (
              <div className="p-6 text-center text-sm text-slate-500">
                No tests available
              </div>
            ) : (
              seriesTests.map((test, index) => (
                <button
                  key={test.id}
                  onClick={() => handleStartLiveTest(test)}
                  className="w-full px-4 py-3.5 flex items-center gap-3.5 text-left hover:bg-[#F7EFE2]/60 dark:hover:bg-[#252A3A] transition-colors cursor-pointer"
                >
                  <span className="w-6 text-sm font-bold text-[#800020] dark:text-[#F47B20] tabular-nums shrink-0 text-left">
                    {index + 1}.
                  </span>
                  <span className="text-sm font-semibold text-[#171923] dark:text-[#FFF9EF] flex-1 truncate font-hindi">
                    {test.title}
                  </span>
                  {fetchingTestId === test.id ? (
                    <RefreshCw size={15} className="animate-spin text-[#800020] dark:text-[#F47B20] shrink-0" />
                  ) : (
                    <Play size={14} fill="currentColor" className="text-[#800020] dark:text-[#F47B20] shrink-0" />
                  )}
                </button>
              ))
            )}
          </main>
        </div>
      ) : coachingId && examId ? (
        <div className="w-full max-w-3xl mx-auto">
          <header className="px-4 py-3 border-b border-[#E8D9C0] dark:border-[#31374A] flex items-center gap-3 sticky top-0 bg-white/95 dark:bg-[#1F2330]/95 backdrop-blur-xs z-10">
            <button
              onClick={handleGoPage2}
              className="w-9 h-9 rounded-xl bg-[#F7EFE2] dark:bg-[#252A3A] flex items-center justify-center text-[#171923] dark:text-[#FFF9EF] cursor-pointer"
              aria-label="Back to Exam list"
            >
              <ArrowLeft size={18} />
            </button>
            <h1 className="text-base font-bold text-[#171923] dark:text-[#FFF9EF] truncate font-hindi">
              {activeExam?.examName || "Test Series"}
            </h1>
          </header>

          <main className="divide-y divide-[#E8D9C0] dark:divide-[#31374A] bg-white dark:bg-[#1F2330] sm:mt-4 sm:rounded-2xl sm:border sm:border-[#E8D9C0] dark:sm:border-[#31374A] overflow-hidden">
            {orderedSeriesList.length === 0 ? (
              <div className="p-6 text-center text-sm text-slate-500">
                No test series available
              </div>
            ) : (
              orderedSeriesList.map((series, index) => (
                <button
                  key={series.id}
                  onClick={() => handleTestSeriesClick(series)}
                  className="w-full px-4 py-3.5 flex items-center gap-3.5 text-left hover:bg-[#F7EFE2]/60 dark:hover:bg-[#252A3A] transition-colors cursor-pointer"
                >
                  <span className="w-6 text-sm font-bold text-[#800020] dark:text-[#F47B20] tabular-nums shrink-0 text-left">
                    {index + 1}.
                  </span>
                  <span className="text-sm font-semibold text-[#171923] dark:text-[#FFF9EF] flex-1 truncate font-hindi">
                    {series.seriesName}
                  </span>
                </button>
              ))
            )}
          </main>
        </div>
      ) : coachingId ? (
        <div className="w-full max-w-3xl mx-auto">
          <header className="px-4 py-3 border-b border-[#E8D9C0] dark:border-[#31374A] flex items-center gap-3 sticky top-0 bg-white/95 dark:bg-[#1F2330]/95 backdrop-blur-xs z-10">
            <button
              onClick={handleGoPage1}
              className="w-9 h-9 rounded-xl bg-[#F7EFE2] dark:bg-[#252A3A] flex items-center justify-center text-[#171923] dark:text-[#FFF9EF] cursor-pointer"
              aria-label="Back to Coaching list"
            >
              <ArrowLeft size={18} />
            </button>
            <h1 className="text-base font-bold text-[#171923] dark:text-[#FFF9EF] truncate font-hindi">
              {activeCoaching?.name || "Exams"}
            </h1>
          </header>

          <main className="divide-y divide-[#E8D9C0] dark:divide-[#31374A] bg-white dark:bg-[#1F2330] sm:mt-4 sm:rounded-2xl sm:border sm:border-[#E8D9C0] dark:sm:border-[#31374A] overflow-hidden">
            {orderedExams.length === 0 ? (
              <div className="p-6 text-center text-sm text-slate-500">
                No exams available
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
                  className="w-full px-4 py-3.5 flex items-center gap-3.5 text-left hover:bg-[#F7EFE2]/60 dark:hover:bg-[#252A3A] transition-colors cursor-pointer"
                >
                  <span className="w-6 text-sm font-bold text-[#800020] dark:text-[#F47B20] tabular-nums shrink-0 text-left">
                    {index + 1}.
                  </span>
                  <span className="text-sm font-semibold text-[#171923] dark:text-[#FFF9EF] flex-1 truncate font-hindi">
                    {exam.examName}
                  </span>
                </button>
              ))
            )}
          </main>
        </div>
      ) : (
        <div className="w-full max-w-3xl mx-auto">
          <header className="px-4 py-3 border-b border-[#E8D9C0] dark:border-[#31374A] flex items-center gap-3 sticky top-0 bg-white/95 dark:bg-[#1F2330]/95 backdrop-blur-xs z-10">
            {onNavigateTab && (
              <button
                onClick={() => {
                  triggerHaptic("light");
                  onNavigateTab("home");
                }}
                className="w-9 h-9 rounded-xl bg-[#F7EFE2] dark:bg-[#252A3A] flex items-center justify-center text-[#171923] dark:text-[#FFF9EF] cursor-pointer"
                aria-label="Back to Home"
              >
                <ArrowLeft size={18} />
              </button>
            )}
            <h1 className="text-base font-bold text-[#171923] dark:text-[#FFF9EF] truncate">
              Test Series
            </h1>
          </header>

          <main className="divide-y divide-[#E8D9C0] dark:divide-[#31374A] bg-white dark:bg-[#1F2330] sm:mt-4 sm:rounded-2xl sm:border sm:border-[#E8D9C0] dark:sm:border-[#31374A] overflow-hidden">
            {orderedCoachings.length === 0 ? (
              <div className="p-6 text-center text-sm text-slate-500">
                No coaching institutes available
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
                  className="w-full px-4 py-3.5 flex items-center gap-3.5 text-left hover:bg-[#F7EFE2]/60 dark:hover:bg-[#252A3A] transition-colors cursor-pointer"
                >
                  <span className="w-6 text-sm font-bold text-[#800020] dark:text-[#F47B20] tabular-nums shrink-0 text-left">
                    {index + 1}.
                  </span>
                  <span className="text-sm font-semibold text-[#171923] dark:text-[#FFF9EF] flex-1 truncate font-hindi">
                    {coaching.name}
                  </span>
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
