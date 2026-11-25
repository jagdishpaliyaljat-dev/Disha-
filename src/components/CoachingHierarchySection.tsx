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
      <div className="w-full bg-white dark:bg-[#1B1536] rounded-2xl sm:rounded-3xl border border-slate-200 dark:border-[#31275E] overflow-hidden shadow-sm">
        {/* Breadcrumb Header */}
        <header className="px-4 py-3 border-b border-slate-200 dark:border-[#31275E] flex items-center justify-between gap-3 sticky top-0 bg-white/95 dark:bg-[#1B1536]/95 backdrop-blur-xs z-10">
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              onClick={handleBackToSeries}
              className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-[#241D48] hover:bg-slate-200 dark:hover:bg-[#31275E] flex items-center justify-center text-slate-900 dark:text-slate-50 border border-slate-200 dark:border-[#31275E] transition-all cursor-pointer shrink-0 active:scale-95"
              aria-label="Back to Test Series list"
            >
              <ArrowLeft size={16} />
            </button>
            <div className="min-w-0">
              <span className="text-[11px] font-bold text-stone-500 dark:text-stone-400 block truncate">
                {selectedCoaching.name} • {selectedExam.examName}
              </span>
              <h2 className="text-sm font-black text-slate-900 dark:text-slate-50 truncate font-hindi">
                {selectedSeries.seriesName}
              </h2>
            </div>
          </div>
          <span className="px-2.5 py-1 rounded-lg bg-[#7045D8]/10 dark:bg-[#7045D8]/15 text-[#7045D8] dark:text-[#A78BFA] text-[11px] font-black shrink-0 border border-[#7045D8]/20 dark:border-[#A78BFA]/30">
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
                  className="p-3.5 sm:p-4 rounded-2xl bg-[#F8FAFC] dark:bg-[#130E26] border border-slate-200 dark:border-[#31275E] hover:border-[#7045D8]/50 dark:hover:border-[#A78BFA]/50 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs"
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
                      onClick={() => onStartLiveTest(test)}
                      className="w-full sm:w-auto px-4 py-2 rounded-xl bg-gradient-to-r from-[#7045D8] via-[#5B32BF] to-[#7045D8] hover:brightness-110 active:scale-95 text-white text-xs font-black flex items-center justify-center gap-2 border border-[#A78BFA]/40 shadow-sm transition-all cursor-pointer"
                    >
                      <Play size={13} fill="currentColor" className="text-amber-500" />
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
      <div className="w-full bg-white dark:bg-[#1B1536] rounded-2xl sm:rounded-3xl border border-slate-200 dark:border-[#31275E] overflow-hidden shadow-sm">
        <header className="px-4 py-3 border-b border-slate-200 dark:border-[#31275E] flex items-center justify-between gap-3 sticky top-0 bg-white/95 dark:bg-[#1B1536]/95 backdrop-blur-xs z-10">
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              onClick={handleBackToExams}
              className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-[#241D48] hover:bg-slate-200 dark:hover:bg-[#31275E] flex items-center justify-center text-slate-900 dark:text-slate-50 border border-slate-200 dark:border-[#31275E] transition-all cursor-pointer shrink-0 active:scale-95"
              aria-label="Back to Exam list"
            >
              <ArrowLeft size={16} />
            </button>
            <div className="min-w-0">
              <span className="text-[11px] font-bold text-stone-500 dark:text-stone-400 block truncate">
                {selectedCoaching.name}
              </span>
              <h2 className="text-sm font-black text-slate-900 dark:text-slate-50 truncate">
                {selectedExam.examName} — Test Series Packages
              </h2>
            </div>
          </div>
          <span className="px-2.5 py-1 rounded-lg bg-[#7045D8]/10 dark:bg-[#7045D8]/15 text-[#7045D8] dark:text-[#A78BFA] text-[11px] font-black shrink-0 border border-[#7045D8]/20 dark:border-[#A78BFA]/30">
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
                className="p-3.5 sm:p-4 rounded-2xl bg-[#F8FAFC] dark:bg-[#130E26] border border-slate-200 dark:border-[#31275E] hover:border-[#7045D8]/50 dark:hover:border-[#A78BFA]/50 transition-all text-left flex items-center justify-between gap-3 cursor-pointer group shadow-xs active:scale-[0.99]"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-[#7045D8]/10 dark:bg-[#7045D8]/15 text-[#7045D8] dark:text-[#A78BFA] flex items-center justify-center shrink-0 border border-[#7045D8]/20 dark:border-[#A78BFA]/30 group-hover:scale-105 transition-transform">
                    <Layers size={18} />
                  </div>
                  <div className="min-w-0">
                    <span className="text-[11px] font-bold text-stone-400 dark:text-stone-500 uppercase tracking-wider block">
                      Package #{index + 1}
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
        </div>
      </div>
    );
  }

  // ──────────────────────────────────────────
  // LEVEL 2: EXAMS LIST FOR COACHING
  // ──────────────────────────────────────────
  if (selectedCoaching) {
    return (
      <div className="w-full bg-white dark:bg-[#1B1536] rounded-2xl sm:rounded-3xl border border-slate-200 dark:border-[#31275E] overflow-hidden shadow-sm">
        <header className="px-4 py-3 border-b border-slate-200 dark:border-[#31275E] flex items-center justify-between gap-3 sticky top-0 bg-white/95 dark:bg-[#1B1536]/95 backdrop-blur-xs z-10">
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              onClick={handleBackToCoachings}
              className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-[#241D48] hover:bg-slate-200 dark:hover:bg-[#31275E] flex items-center justify-center text-slate-900 dark:text-slate-50 border border-slate-200 dark:border-[#31275E] transition-all cursor-pointer shrink-0 active:scale-95"
              aria-label="Back to Coaching list"
            >
              <ArrowLeft size={16} />
            </button>
            <div className="min-w-0">
              <span className="text-[11px] font-bold text-stone-500 dark:text-stone-400 block truncate">
                Coaching Institutes
              </span>
              <h2 className="text-sm font-black text-slate-900 dark:text-slate-50 truncate">
                {selectedCoaching.name} — Available Exams
              </h2>
            </div>
          </div>
          <span className="px-2.5 py-1 rounded-lg bg-[#7045D8]/10 dark:bg-[#7045D8]/15 text-[#7045D8] dark:text-[#A78BFA] text-[11px] font-black shrink-0 border border-[#7045D8]/20 dark:border-[#A78BFA]/30">
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
                className="p-3.5 sm:p-4 rounded-2xl bg-[#F8FAFC] dark:bg-[#130E26] border border-slate-200 dark:border-[#31275E] hover:border-[#7045D8]/50 dark:hover:border-[#A78BFA]/50 transition-all text-left flex items-center justify-between gap-3 cursor-pointer group shadow-xs active:scale-[0.99]"
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
                      Standard Exam Pattern
                    </p>
                  </div>
                </div>
                <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-[#241D48] flex items-center justify-center text-stone-600 dark:text-stone-300 group-hover:bg-[#7045D8] group-hover:text-white transition-all shrink-0">
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
    <div className="w-full bg-white dark:bg-[#1B1536] rounded-2xl sm:rounded-3xl border border-slate-200 dark:border-[#31275E] overflow-hidden shadow-sm">
      <header className="px-4 py-3.5 border-b border-slate-200 dark:border-[#31275E] flex items-center justify-between gap-3 bg-[#F8FAFC] dark:bg-[#1B1536]">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-[#7045D8] text-white flex items-center justify-center shrink-0 border border-[#A78BFA]/30 shadow-xs">
            <Building2 size={16} className="text-amber-500" />
          </div>
          <div>
            <h2 className="text-sm font-black text-slate-900 dark:text-slate-50 leading-tight">
              Premier Coaching Test Series
            </h2>
            <p className="text-[11px] font-bold text-stone-500 dark:text-stone-400 mt-0.5">
              Verified mock tests crafted by leading educational institutions
            </p>
          </div>
        </div>
        <span className="px-2.5 py-1 rounded-lg bg-[#7045D8]/10 dark:bg-[#7045D8]/15 text-[#7045D8] dark:text-[#A78BFA] text-[11px] font-black shrink-0 border border-[#7045D8]/20 dark:border-[#A78BFA]/30">
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
              className="p-3.5 sm:p-4 rounded-2xl bg-[#F8FAFC] dark:bg-[#130E26] border border-slate-200 dark:border-[#31275E] hover:border-[#7045D8]/50 dark:hover:border-[#A78BFA]/50 transition-all text-left flex items-center justify-between gap-3 cursor-pointer group shadow-xs active:scale-[0.99]"
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
      </div>
    </div>
  );
};

export default CoachingHierarchySection;
