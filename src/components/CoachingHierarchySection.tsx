import React, { useMemo } from "react";
import { 
  Coaching, 
  CoachingExam, 
  CoachingTestSeries, 
  LiveTest, 
  LiveTestSubmission, 
  MCQSession 
} from "../types";
import { 
  subscribeToCoachings, 
  subscribeToCoachingExams, 
  subscribeToCoachingTestSeries 
} from "../utils/coachingHierarchyStorage";
import { triggerHaptic, playClickSound } from "../utils/audioFeedback";
import { ArrowLeft, Play, RefreshCw } from "lucide-react";

interface CoachingHierarchySectionProps {
  liveTests: LiveTest[];
  submissions: LiveTestSubmission[];
  onStartLiveTest: (test: LiveTest) => void;
  onStartSession: (session: MCQSession) => void;
  isAdmin?: boolean;
  onOpenAdminManage?: () => void;
}

export const CoachingHierarchySection: React.FC<CoachingHierarchySectionProps> = ({
  liveTests,
  onStartLiveTest,
}) => {
  // Navigation State
  const [selectedCoaching, setSelectedCoaching] = React.useState<Coaching | null>(null);
  const [selectedExam, setSelectedExam] = React.useState<CoachingExam | null>(null);
  const [selectedSeries, setSelectedSeries] = React.useState<CoachingTestSeries | null>(null);

  // Data Collections
  const [coachings, setCoachings] = React.useState<Coaching[]>([]);
  const [exams, setExams] = React.useState<CoachingExam[]>([]);
  const [seriesList, setSeriesList] = React.useState<CoachingTestSeries[]>([]);

  // Subscriptions
  React.useEffect(() => {
    const unsubCoachings = subscribeToCoachings((data) => {
      const sorted = [...data]
        .filter((c) => c.isActive)
        .sort((a, b) => (a.order || 0) - (b.order || 0));
      setCoachings(sorted);
    });
    return () => unsubCoachings();
  }, []);

  React.useEffect(() => {
    if (selectedCoaching) {
      const unsubExams = subscribeToCoachingExams(selectedCoaching.id, (data) => {
        const sorted = [...data]
          .filter((e) => e.isActive)
          .sort((a, b) => (a.order || 0) - (b.order || 0));
        setExams(sorted);
      });
      return () => unsubExams();
    } else {
      setExams([]);
    }
  }, [selectedCoaching]);

  React.useEffect(() => {
    if (selectedCoaching && selectedExam) {
      const unsubSeries = subscribeToCoachingTestSeries(selectedCoaching.id, selectedExam.id, (data) => {
        const sorted = [...data]
          .filter((s) => s.isActive)
          .sort((a, b) => (a.order || 0) - (b.order || 0));
        setSeriesList(sorted);
      });
      return () => unsubSeries();
    } else {
      setSeriesList([]);
    }
  }, [selectedCoaching, selectedExam]);

  // Ordered lists
  const orderedCoachings = useMemo(() => {
    return [...coachings].sort((a, b) => (a.order || 0) - (b.order || 0));
  }, [coachings]);

  const orderedExams = useMemo(() => {
    return exams
      .filter((e) => e.coachingId === selectedCoaching?.id)
      .sort((a, b) => (a.order || 0) - (b.order || 0));
  }, [exams, selectedCoaching]);

  const orderedSeriesList = useMemo(() => {
    return seriesList
      .filter((s) => s.coachingId === selectedCoaching?.id && s.examId === selectedExam?.id)
      .sort((a, b) => (a.order || 0) - (b.order || 0));
  }, [seriesList, selectedCoaching, selectedExam]);

  // Navigation handlers
  const handleBackToCoachings = () => {
    triggerHaptic("light");
    playClickSound();
    setSelectedCoaching(null);
    setSelectedExam(null);
    setSelectedSeries(null);
  };

  const handleBackToExams = () => {
    triggerHaptic("light");
    playClickSound();
    setSelectedExam(null);
    setSelectedSeries(null);
  };

  const handleBackToSeries = () => {
    triggerHaptic("light");
    playClickSound();
    setSelectedSeries(null);
  };

  // ──────────────────────────────────────────
  // TESTS INSIDE SELECTED TEST SERIES
  // ──────────────────────────────────────────
  if (selectedCoaching && selectedExam && selectedSeries) {
    const seriesTests = liveTests.filter((t) => {
      if (selectedSeries.testIds && selectedSeries.testIds.length > 0) {
        return selectedSeries.testIds.includes(t.id);
      }
      return (
        t.examCategory?.toLowerCase() === selectedExam.examName.toLowerCase() ||
        t.title?.toLowerCase().includes(selectedExam.examName.toLowerCase()) ||
        true
      );
    });

    return (
      <div className="w-full bg-white dark:bg-[#1F2330] rounded-2xl border border-[#E8D9C0] dark:border-[#31374A] overflow-hidden min-h-[300px]">
        <header className="px-4 py-3 border-b border-[#E8D9C0] dark:border-[#31374A] flex items-center gap-3 sticky top-0 bg-white/95 dark:bg-[#1F2330]/95 backdrop-blur-xs z-10">
          <button
            onClick={handleBackToSeries}
            className="w-8 h-8 rounded-lg bg-[#F7EFE2] dark:bg-[#252A3A] flex items-center justify-center text-[#171923] dark:text-[#FFF9EF] cursor-pointer"
            aria-label="Back to Test Series list"
          >
            <ArrowLeft size={16} />
          </button>
          <h1 className="text-base font-bold text-[#171923] dark:text-[#FFF9EF] truncate font-hindi">
            {selectedSeries.seriesName}
          </h1>
        </header>

        <main className="divide-y divide-[#E8D9C0] dark:divide-[#31374A]">
          {seriesTests.length === 0 ? (
            <div className="p-6 text-center text-sm text-slate-500">
              No tests available
            </div>
          ) : (
            seriesTests.map((test, index) => (
              <button
                key={test.id}
                onClick={() => onStartLiveTest(test)}
                className="w-full px-4 py-3.5 flex items-center gap-3.5 text-left hover:bg-[#F7EFE2]/60 dark:hover:bg-[#252A3A] transition-colors cursor-pointer"
              >
                <span className="w-6 text-sm font-bold text-[#800020] dark:text-[#F47B20] tabular-nums shrink-0 text-left">
                  {index + 1}.
                </span>
                <span className="text-sm font-semibold text-[#171923] dark:text-[#FFF9EF] flex-1 truncate font-hindi">
                  {test.title}
                </span>
                <Play size={14} fill="currentColor" className="text-[#800020] dark:text-[#F47B20] shrink-0" />
              </button>
            ))
          )}
        </main>
      </div>
    );
  }

  if (selectedCoaching && selectedExam) {
    return (
      <div className="w-full bg-white dark:bg-[#1F2330] rounded-2xl border border-[#E8D9C0] dark:border-[#31374A] overflow-hidden min-h-[300px]">
        <header className="px-4 py-3 border-b border-[#E8D9C0] dark:border-[#31374A] flex items-center gap-3 sticky top-0 bg-white/95 dark:bg-[#1F2330]/95 backdrop-blur-xs z-10">
          <button
            onClick={handleBackToExams}
            className="w-8 h-8 rounded-lg bg-[#F7EFE2] dark:bg-[#252A3A] flex items-center justify-center text-[#171923] dark:text-[#FFF9EF] cursor-pointer"
            aria-label="Back to Exam list"
          >
            <ArrowLeft size={16} />
          </button>
          <h1 className="text-base font-bold text-[#171923] dark:text-[#FFF9EF] truncate font-hindi">
            {selectedExam.examName}
          </h1>
        </header>

        <main className="divide-y divide-[#E8D9C0] dark:divide-[#31374A]">
          {orderedSeriesList.length === 0 ? (
            <div className="p-6 text-center text-sm text-slate-500">
              No test series available
            </div>
          ) : (
            orderedSeriesList.map((series, index) => (
              <button
                key={series.id}
                onClick={() => {
                  triggerHaptic("light");
                  playClickSound();
                  setSelectedSeries(series);
                }}
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
    );
  }

  if (selectedCoaching) {
    return (
      <div className="w-full bg-white dark:bg-[#1F2330] rounded-2xl border border-[#E8D9C0] dark:border-[#31374A] overflow-hidden min-h-[300px]">
        <header className="px-4 py-3 border-b border-[#E8D9C0] dark:border-[#31374A] flex items-center gap-3 sticky top-0 bg-white/95 dark:bg-[#1F2330]/95 backdrop-blur-xs z-10">
          <button
            onClick={handleBackToCoachings}
            className="w-8 h-8 rounded-lg bg-[#F7EFE2] dark:bg-[#252A3A] flex items-center justify-center text-[#171923] dark:text-[#FFF9EF] cursor-pointer"
            aria-label="Back to Coaching list"
          >
            <ArrowLeft size={16} />
          </button>
          <h1 className="text-base font-bold text-[#171923] dark:text-[#FFF9EF] truncate font-hindi">
            {selectedCoaching.name}
          </h1>
        </header>

        <main className="divide-y divide-[#E8D9C0] dark:divide-[#31374A]">
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
                  setSelectedExam(exam);
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
    );
  }

  return (
    <div className="w-full bg-white dark:bg-[#1F2330] rounded-2xl border border-[#E8D9C0] dark:border-[#31374A] overflow-hidden min-h-[300px]">
      <header className="px-4 py-3 border-b border-[#E8D9C0] dark:border-[#31374A] flex items-center sticky top-0 bg-white/95 dark:bg-[#1F2330]/95 backdrop-blur-xs z-10">
        <h1 className="text-base font-bold text-[#171923] dark:text-[#FFF9EF] truncate">
          Test Series
        </h1>
      </header>

      <main className="divide-y divide-[#E8D9C0] dark:divide-[#31374A]">
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
                setSelectedCoaching(coaching);
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
  );
};

export default CoachingHierarchySection;
