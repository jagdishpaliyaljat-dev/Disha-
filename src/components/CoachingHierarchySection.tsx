import React, { useMemo } from "react";
import {
  Coaching,
  CoachingExam,
  CoachingTestSeries,
  LiveTest,
  LiveTestSubmission,
  MCQSession,
} from "../types";
import {
  subscribeToCoachings,
  subscribeToCoachingExams,
  subscribeToCoachingTestSeries,
} from "../utils/coachingHierarchyStorage";
import { triggerHaptic, playClickSound } from "../utils/audioFeedback";
import {
  ArrowLeft,
  Play,
  RefreshCw,
  Building2,
  Layers,
  ChevronRight,
  ShieldCheck,
  CheckCircle2,
  Clock,
  Award,
  Sparkles,
  BookOpen,
} from "lucide-react";

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
  submissions,
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

  // Helper for test submission
  const getTestSubmission = (testId: string) => {
    return submissions.find((s) => s.testId === testId);
  };

  // ──────────────────────────────────────────
  // LEVEL 4: TESTS INSIDE SELECTED TEST SERIES
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
      <div className="w-full bg-white dark:bg-[#1F2330] rounded-2xl sm:rounded-3xl border border-[#E8D9C0] dark:border-[#31374A] overflow-hidden shadow-sm">
        {/* Breadcrumb Header */}
        <header className="px-4 py-3 border-b border-[#E8D9C0] dark:border-[#31374A] flex items-center justify-between gap-3 sticky top-0 bg-white/95 dark:bg-[#1F2330]/95 backdrop-blur-xs z-10">
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              onClick={handleBackToSeries}
              className="w-8 h-8 rounded-xl bg-[#F7EFE2] dark:bg-[#252A3A] hover:bg-[#E8D9C0] dark:hover:bg-[#31374A] flex items-center justify-center text-[#171923] dark:text-[#FFF9EF] border border-[#E8D9C0] dark:border-[#31374A] transition-all cursor-pointer shrink-0 active:scale-95"
              aria-label="Back to Test Series list"
            >
              <ArrowLeft size={16} />
            </button>
            <div className="min-w-0">
              <span className="text-[10px] font-bold text-stone-500 dark:text-stone-400 block truncate">
                {selectedCoaching.name} • {selectedExam.examName}
              </span>
              <h2 className="text-sm font-black text-[#171923] dark:text-[#FFF9EF] truncate font-hindi">
                {selectedSeries.seriesName}
              </h2>
            </div>
          </div>
          <span className="px-2.5 py-1 rounded-lg bg-[#800020]/10 dark:bg-[#C99A45]/15 text-[#800020] dark:text-[#C99A45] text-[10px] font-black shrink-0 border border-[#800020]/20 dark:border-[#C99A45]/30">
            {seriesTests.length} Tests
          </span>
        </header>

        {/* Tests List */}
        <div className="p-3 sm:p-4 space-y-3">
          {seriesTests.length === 0 ? (
            <div className="p-8 text-center text-sm text-stone-500 dark:text-stone-400">
              <BookOpen size={28} className="mx-auto mb-2 text-stone-400 opacity-70" />
              <p className="font-bold">No tests available in this series yet.</p>
              <p className="text-xs mt-1">Please check back soon.</p>
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
                  className="p-3.5 sm:p-4 rounded-2xl bg-[#FFF9EF] dark:bg-[#171923] border border-[#E8D9C0] dark:border-[#31374A] hover:border-[#800020]/50 dark:hover:border-[#C99A45]/50 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs"
                >
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="w-5 h-5 rounded-md bg-[#800020]/10 dark:bg-[#C99A45]/15 text-[#800020] dark:text-[#C99A45] font-black text-xs flex items-center justify-center shrink-0">
                        {index + 1}
                      </span>
                      <span className="px-2 py-0.5 rounded-md bg-[#C99A45]/15 text-[#800020] dark:text-[#C99A45] text-[9.5px] font-black flex items-center gap-1 border border-[#C99A45]/30">
                        <ShieldCheck size={11} className="text-[#C99A45]" />
                        Option E Rule
                      </span>
                      {sub && (
                        <span className="px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 text-[9.5px] font-black border border-emerald-300 dark:border-emerald-800">
                          Completed: {sub.score}/{sub.totalMarks} ({sub.accuracy.toFixed(0)}%)
                        </span>
                      )}
                    </div>
                    <h3 className="text-sm font-extrabold text-[#171923] dark:text-[#FFF9EF] leading-snug">
                      {test.title}
                    </h3>
                    <div className="flex items-center gap-3 text-[11px] font-bold text-stone-500 dark:text-stone-400 font-mono tabular-nums">
                      <span>{qCount} Questions</span>
                      <span>•</span>
                      <span>{duration} Mins</span>
                      <span>•</span>
                      <span>{marks} Marks</span>
                      <span>•</span>
                      <span className="text-[#991B1B] dark:text-[#F47B20]">Neg: {negMark}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => onStartLiveTest(test)}
                      className="w-full sm:w-auto px-4 py-2 rounded-xl bg-gradient-to-r from-[#800020] via-[#5E0017] to-[#800020] hover:brightness-110 active:scale-95 text-[#FFF9EF] text-xs font-black flex items-center justify-center gap-2 border border-[#C99A45]/40 shadow-sm transition-all cursor-pointer"
                    >
                      <Play size={13} fill="currentColor" className="text-[#C99A45]" />
                      <span>{sub ? "Re-attempt Test" : "Start Test"}</span>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    );
  }

  // ──────────────────────────────────────────
  // LEVEL 3: TEST SERIES LIST FOR EXAM
  // ──────────────────────────────────────────
  if (selectedCoaching && selectedExam) {
    return (
      <div className="w-full bg-white dark:bg-[#1F2330] rounded-2xl sm:rounded-3xl border border-[#E8D9C0] dark:border-[#31374A] overflow-hidden shadow-sm">
        <header className="px-4 py-3 border-b border-[#E8D9C0] dark:border-[#31374A] flex items-center justify-between gap-3 sticky top-0 bg-white/95 dark:bg-[#1F2330]/95 backdrop-blur-xs z-10">
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              onClick={handleBackToExams}
              className="w-8 h-8 rounded-xl bg-[#F7EFE2] dark:bg-[#252A3A] hover:bg-[#E8D9C0] dark:hover:bg-[#31374A] flex items-center justify-center text-[#171923] dark:text-[#FFF9EF] border border-[#E8D9C0] dark:border-[#31374A] transition-all cursor-pointer shrink-0 active:scale-95"
              aria-label="Back to Exam list"
            >
              <ArrowLeft size={16} />
            </button>
            <div className="min-w-0">
              <span className="text-[10px] font-bold text-stone-500 dark:text-stone-400 block truncate">
                {selectedCoaching.name}
              </span>
              <h2 className="text-sm font-black text-[#171923] dark:text-[#FFF9EF] truncate">
                {selectedExam.examName} — Test Series Packages
              </h2>
            </div>
          </div>
          <span className="px-2.5 py-1 rounded-lg bg-[#800020]/10 dark:bg-[#C99A45]/15 text-[#800020] dark:text-[#C99A45] text-[10px] font-black shrink-0 border border-[#800020]/20 dark:border-[#C99A45]/30">
            {orderedSeriesList.length} Series
          </span>
        </header>

        <div className="p-3 sm:p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
          {orderedSeriesList.length === 0 ? (
            <div className="col-span-full p-8 text-center text-sm text-stone-500 dark:text-stone-400">
              <Layers size={28} className="mx-auto mb-2 text-stone-400 opacity-70" />
              <p className="font-bold">No test series available for this exam yet.</p>
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
                className="p-3.5 sm:p-4 rounded-2xl bg-[#FFF9EF] dark:bg-[#171923] border border-[#E8D9C0] dark:border-[#31374A] hover:border-[#800020]/50 dark:hover:border-[#C99A45]/50 transition-all text-left flex items-center justify-between gap-3 cursor-pointer group shadow-xs active:scale-[0.99]"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-[#800020]/10 dark:bg-[#C99A45]/15 text-[#800020] dark:text-[#C99A45] flex items-center justify-center shrink-0 border border-[#800020]/20 dark:border-[#C99A45]/30 group-hover:scale-105 transition-transform">
                    <Layers size={18} />
                  </div>
                  <div className="min-w-0">
                    <span className="text-[10px] font-bold text-stone-400 dark:text-stone-500 uppercase tracking-wider block">
                      Package #{index + 1}
                    </span>
                    <h3 className="text-sm font-extrabold text-[#171923] dark:text-[#FFF9EF] truncate group-hover:text-[#800020] dark:group-hover:text-[#C99A45] transition-colors">
                      {series.seriesName}
                    </h3>
                    <p className="text-[11px] text-stone-500 dark:text-stone-400 mt-0.5 line-clamp-1">
                      {series.description || "Comprehensive syllabus and topic-wise mock tests"}
                    </p>
                  </div>
                </div>
                <div className="w-8 h-8 rounded-lg bg-[#F7EFE2] dark:bg-[#252A3A] flex items-center justify-center text-stone-600 dark:text-stone-300 group-hover:bg-[#800020] group-hover:text-[#FFF9EF] transition-all shrink-0">
                  <ChevronRight size={16} />
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    );
  }

  // ──────────────────────────────────────────
  // LEVEL 2: EXAMS LIST FOR COACHING
  // ──────────────────────────────────────────
  if (selectedCoaching) {
    return (
      <div className="w-full bg-white dark:bg-[#1F2330] rounded-2xl sm:rounded-3xl border border-[#E8D9C0] dark:border-[#31374A] overflow-hidden shadow-sm">
        <header className="px-4 py-3 border-b border-[#E8D9C0] dark:border-[#31374A] flex items-center justify-between gap-3 sticky top-0 bg-white/95 dark:bg-[#1F2330]/95 backdrop-blur-xs z-10">
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              onClick={handleBackToCoachings}
              className="w-8 h-8 rounded-xl bg-[#F7EFE2] dark:bg-[#252A3A] hover:bg-[#E8D9C0] dark:hover:bg-[#31374A] flex items-center justify-center text-[#171923] dark:text-[#FFF9EF] border border-[#E8D9C0] dark:border-[#31374A] transition-all cursor-pointer shrink-0 active:scale-95"
              aria-label="Back to Coaching list"
            >
              <ArrowLeft size={16} />
            </button>
            <div className="min-w-0">
              <span className="text-[10px] font-bold text-stone-500 dark:text-stone-400 block truncate">
                Coaching Institutes
              </span>
              <h2 className="text-sm font-black text-[#171923] dark:text-[#FFF9EF] truncate">
                {selectedCoaching.name} — Available Exams
              </h2>
            </div>
          </div>
          <span className="px-2.5 py-1 rounded-lg bg-[#800020]/10 dark:bg-[#C99A45]/15 text-[#800020] dark:text-[#C99A45] text-[10px] font-black shrink-0 border border-[#800020]/20 dark:border-[#C99A45]/30">
            {orderedExams.length} Exams
          </span>
        </header>

        <div className="p-3 sm:p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
          {orderedExams.length === 0 ? (
            <div className="col-span-full p-8 text-center text-sm text-stone-500 dark:text-stone-400">
              <Award size={28} className="mx-auto mb-2 text-stone-400 opacity-70" />
              <p className="font-bold">No exams configured for this institute yet.</p>
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
                className="p-3.5 sm:p-4 rounded-2xl bg-[#FFF9EF] dark:bg-[#171923] border border-[#E8D9C0] dark:border-[#31374A] hover:border-[#800020]/50 dark:hover:border-[#C99A45]/50 transition-all text-left flex items-center justify-between gap-3 cursor-pointer group shadow-xs active:scale-[0.99]"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-[#F47B20]/15 text-[#F47B20] flex items-center justify-center shrink-0 border border-[#F47B20]/30 group-hover:scale-105 transition-transform">
                    <Award size={18} />
                  </div>
                  <div className="min-w-0">
                    <span className="text-[10px] font-bold text-stone-400 dark:text-stone-500 uppercase tracking-wider block">
                      Exam #{index + 1}
                    </span>
                    <h3 className="text-sm font-extrabold text-[#171923] dark:text-[#FFF9EF] truncate group-hover:text-[#800020] dark:group-hover:text-[#C99A45] transition-colors">
                      {exam.examName}
                    </h3>
                    <p className="text-[11px] text-stone-500 dark:text-stone-400 mt-0.5">
                      Standard Exam Pattern
                    </p>
                  </div>
                </div>
                <div className="w-8 h-8 rounded-lg bg-[#F7EFE2] dark:bg-[#252A3A] flex items-center justify-center text-stone-600 dark:text-stone-300 group-hover:bg-[#800020] group-hover:text-[#FFF9EF] transition-all shrink-0">
                  <ChevronRight size={16} />
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    );
  }

  // ──────────────────────────────────────────
  // LEVEL 1: COACHINGS DIRECTORY
  // ──────────────────────────────────────────
  return (
    <div className="w-full bg-white dark:bg-[#1F2330] rounded-2xl sm:rounded-3xl border border-[#E8D9C0] dark:border-[#31374A] overflow-hidden shadow-sm">
      <header className="px-4 py-3.5 border-b border-[#E8D9C0] dark:border-[#31374A] flex items-center justify-between gap-3 bg-[#FFF9EF] dark:bg-[#1F2330]">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-[#800020] text-[#FFF9EF] flex items-center justify-center shrink-0 border border-[#C99A45]/30 shadow-xs">
            <Building2 size={16} className="text-[#C99A45]" />
          </div>
          <div>
            <h2 className="text-sm font-black text-[#171923] dark:text-[#FFF9EF] leading-tight">
              Premier Coaching Test Series
            </h2>
            <p className="text-[10px] font-bold text-stone-500 dark:text-stone-400 mt-0.5">
              Verified mock tests crafted by leading educational institutions
            </p>
          </div>
        </div>
        <span className="px-2.5 py-1 rounded-lg bg-[#800020]/10 dark:bg-[#C99A45]/15 text-[#800020] dark:text-[#C99A45] text-[10px] font-black shrink-0 border border-[#800020]/20 dark:border-[#C99A45]/30">
          {orderedCoachings.length} Institutes
        </span>
      </header>

      <div className="p-3 sm:p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
        {orderedCoachings.length === 0 ? (
          <div className="col-span-full p-8 text-center text-sm text-stone-500 dark:text-stone-400">
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
                setSelectedCoaching(coaching);
              }}
              className="p-3.5 sm:p-4 rounded-2xl bg-[#FFF9EF] dark:bg-[#171923] border border-[#E8D9C0] dark:border-[#31374A] hover:border-[#800020]/50 dark:hover:border-[#C99A45]/50 transition-all text-left flex items-center justify-between gap-3 cursor-pointer group shadow-xs active:scale-[0.99]"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-11 h-11 rounded-2xl bg-[#800020] text-[#FFF9EF] flex items-center justify-center shrink-0 border border-[#C99A45]/40 shadow-xs group-hover:scale-105 transition-transform">
                  <span className="text-base font-black text-[#C99A45]">
                    {coaching.name.charAt(0)}
                  </span>
                </div>
                <div className="min-w-0">
                  <span className="text-[9.5px] font-black text-[#C99A45] uppercase tracking-wider block">
                    Institute #{index + 1}
                  </span>
                  <h3 className="text-sm font-extrabold text-[#171923] dark:text-[#FFF9EF] truncate group-hover:text-[#800020] dark:group-hover:text-[#C99A45] transition-colors">
                    {coaching.name}
                  </h3>
                  <p className="text-[11px] text-stone-500 dark:text-stone-400 mt-0.5 line-clamp-1">
                    {coaching.description || "Verified examination test series and mock papers"}
                  </p>
                </div>
              </div>
              <div className="w-8 h-8 rounded-lg bg-[#F7EFE2] dark:bg-[#252A3A] flex items-center justify-center text-stone-600 dark:text-stone-300 group-hover:bg-[#800020] group-hover:text-[#FFF9EF] transition-all shrink-0">
                <ChevronRight size={16} />
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
};

export default CoachingHierarchySection;
