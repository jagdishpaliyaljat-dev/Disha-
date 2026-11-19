import React, { useState, useEffect, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Chapter,
  Question,
  Subject,
  ProgressStore,
  AppSettings,
  FullExamPreset,
} from "../types";
import {
  DEFAULT_EXAM_PRESETS,
  generateFullExamQuestionIds,
} from "../utils/fullExamGenerator";
import {
  X,
  Play,
  Clock,
  Award,
  AlertCircle,
  CheckCircle2,
  XCircle,
  HelpCircle,
  RotateCcw,
  Sparkles,
  ChevronRight,
  ArrowRight,
  ArrowLeft,
  Bookmark,
  Layers,
  BookOpen,
  Filter,
  Check,
  Flag,
  Grid,
  ShieldAlert,
  Sliders,
  Flame,
} from "lucide-react";
import confetti from "canvas-confetti";
import { MotionConfettiCelebration } from "./MotionConfettiCelebration";
import { recordQuestionAttempt } from "../utils/performanceStorage";
import { flushStudentWriteBuffer } from "../utils/studentWriteBuffer";
import { ParsedQuestion } from "./ParsedQuestion";
import { QuestionReportModal } from "./QuestionReportModal";
import { RichText } from "./RichText";
import {
  playCorrectSound,
  playWrongSound,
  playClickSound,
  triggerHaptic,
} from "../utils/audioFeedback";

interface FullExamModalProps {
  isOpen: boolean;
  onClose: () => void;
  allQuestions: Question[];
  chapters: Chapter[];
  subjects: Subject[];
  progressStore: ProgressStore;
  settings: AppSettings;
  onUpdateProgress: (
    questionId: string,
    isCorrect: boolean,
    selectedOption: number
  ) => void;
  onToggleBookmark: (questionId: string) => void;
  onOpenPDFExport?: (config?: {
    filterType?: "all" | "wrong" | "bookmarked";
  }) => void;
}

type ExamScreen = "config" | "instructions" | "active-exam" | "result";

interface QuestionState {
  selectedIndex: number | null;
  isMarkedForReview: boolean;
  isVisited: boolean;
  timeSpentSeconds: number;
}

export const FullExamModal: React.FC<FullExamModalProps> = ({
  isOpen,
  onClose,
  allQuestions,
  chapters,
  subjects,
  progressStore,
  settings,
  onUpdateProgress,
  onToggleBookmark,
  onOpenPDFExport,
}) => {
  // Screen state
  const [screen, setScreen] = useState<ExamScreen>("config");

  // Selected Preset or Custom
  const [selectedPresetId, setSelectedPresetId] = useState<string>("full-standard-100");
  const [isCustomMode, setIsCustomMode] = useState<boolean>(false);

  // Custom params
  const [customQuestionCount, setCustomQuestionCount] = useState<number>(50);
  const [customDurationMinutes, setCustomDurationMinutes] = useState<number>(60);
  const [customNegativeMarking, setCustomNegativeMarking] = useState<number>(0.33);

  // Active Exam Run State
  const [activeQuestionIds, setActiveQuestionIds] = useState<string[]>([]);
  const [currentIdx, setCurrentIdx] = useState<number>(0);
  const [questionStates, setQuestionStates] = useState<Record<string, QuestionState>>({});
  const [remainingSeconds, setRemainingSeconds] = useState<number>(120 * 60);
  const [totalExamDurationMinutes, setTotalExamDurationMinutes] = useState<number>(120);
  const [negativeMarkValue, setNegativeMarkValue] = useState<number>(0.33);

  // UI Modals inside exam
  const [showPaletteDrawer, setShowPaletteDrawer] = useState<boolean>(false);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState<boolean>(false);
  const [showTimeUpAlert, setShowTimeUpAlert] = useState<boolean>(false);
  const [exitWarningModal, setExitWarningModal] = useState<boolean>(false);

  // Result screen filters
  const [resultFilter, setResultFilter] = useState<"all" | "correct" | "wrong" | "skipped" | "review">("all");
  const [showPerfectCelebration, setShowPerfectCelebration] = useState<boolean>(false);
  const [showReportModal, setShowReportModal] = useState<boolean>(false);
  const [reportingQuestion, setReportingQuestion] = useState<Question | null>(null);

  // Timer Ref
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const questionStartTimeRef = useRef<number>(Date.now());

  // Questions Map lookup
  const questionsMap = useMemo(() => {
    return new Map(allQuestions.map((q) => [q.id, q]));
  }, [allQuestions]);

  const chaptersMap = useMemo(() => {
    return new Map(chapters.map((c) => [c.id, c]));
  }, [chapters]);

  // Active Preset definition
  const activePreset = useMemo(() => {
    return DEFAULT_EXAM_PRESETS.find((p) => p.id === selectedPresetId) || DEFAULT_EXAM_PRESETS[0];
  }, [selectedPresetId]);

  // Target count & duration
  const targetQuestionCount = isCustomMode
    ? customQuestionCount
    : Math.min(activePreset.questionCount, allQuestions.length);

  const targetDurationMinutes = isCustomMode
    ? customDurationMinutes
    : activePreset.durationMinutes;

  const targetNegativeMarking = isCustomMode
    ? customNegativeMarking
    : activePreset.negativeMarking;

  // Cleanup on close
  useEffect(() => {
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, []);

  // Countdown Timer Hook
  useEffect(() => {
    if (screen !== "active-exam") {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      return;
    }

    timerIntervalRef.current = setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
          handleTimeExpired();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, [screen]);

  // Per-question timer start tracking
  useEffect(() => {
    if (screen === "active-exam") {
      questionStartTimeRef.current = Date.now();
      // Mark visited
      const currentQId = activeQuestionIds[currentIdx];
      if (currentQId) {
        setQuestionStates((prev) => ({
          ...prev,
          [currentQId]: {
            selectedIndex: prev[currentQId]?.selectedIndex ?? null,
            isMarkedForReview: prev[currentQId]?.isMarkedForReview ?? false,
            isVisited: true,
            timeSpentSeconds: prev[currentQId]?.timeSpentSeconds ?? 0,
          },
        }));
      }
    }
  }, [currentIdx, screen, activeQuestionIds]);

  // Format Time display: always HH:MM:SS format
  const formatCountdown = (totalSecs: number) => {
    const safeSecs = Math.max(0, Math.floor(Number(totalSecs) || 0));
    const hours = Math.floor(safeSecs / 3600);
    const mins = Math.floor((safeSecs % 3600) / 60);
    const secs = safeSecs % 60;
    return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };

  // Start Exam generator
  const handleStartExam = () => {
    const { selectedQuestionIds } = generateFullExamQuestionIds({
      allQuestions,
      chapters,
      targetCount: targetQuestionCount,
    });

    if (selectedQuestionIds.length === 0) return;

    setActiveQuestionIds(selectedQuestionIds);
    setTotalExamDurationMinutes(targetDurationMinutes);
    setRemainingSeconds(targetDurationMinutes * 60);
    setNegativeMarkValue(targetNegativeMarking);
    setCurrentIdx(0);

    // Initial state map
    const initialMap: Record<string, QuestionState> = {};
    selectedQuestionIds.forEach((id, index) => {
      initialMap[id] = {
        selectedIndex: null,
        isMarkedForReview: false,
        isVisited: index === 0,
        timeSpentSeconds: 0,
      };
    });
    setQuestionStates(initialMap);

    playClickSound(settings.soundEffects !== false);
    setScreen("active-exam");
  };

  // Option selection
  const handleSelectOption = (optionIndex: number) => {
    const currentQId = activeQuestionIds[currentIdx];
    if (!currentQId) return;

    playClickSound(settings.soundEffects !== false);
    triggerHaptic("light", settings.hapticFeedback !== false);

    setQuestionStates((prev) => ({
      ...prev,
      [currentQId]: {
        ...prev[currentQId],
        selectedIndex: optionIndex,
        isVisited: true,
      },
    }));
  };

  // Clear current selection
  const handleClearSelection = () => {
    const currentQId = activeQuestionIds[currentIdx];
    if (!currentQId) return;

    setQuestionStates((prev) => ({
      ...prev,
      [currentQId]: {
        ...prev[currentQId],
        selectedIndex: null,
      },
    }));
  };

  // Toggle Mark for Review
  const handleToggleReview = () => {
    const currentQId = activeQuestionIds[currentIdx];
    if (!currentQId) return;

    setQuestionStates((prev) => ({
      ...prev,
      [currentQId]: {
        ...prev[currentQId],
        isMarkedForReview: !prev[currentQId]?.isMarkedForReview,
      },
    }));
  };

  // Navigate Next
  const handleSaveAndNext = () => {
    if (currentIdx < activeQuestionIds.length - 1) {
      setCurrentIdx((prev) => prev + 1);
    } else {
      // Last question - show submit confirm
      setShowSubmitConfirm(true);
    }
  };

  // Navigate Previous
  const handlePrevious = () => {
    if (currentIdx > 0) {
      setCurrentIdx((prev) => prev - 1);
    }
  };

  // Time expired handler
  const handleTimeExpired = () => {
    setShowTimeUpAlert(true);
    setTimeout(() => {
      setShowTimeUpAlert(false);
      handleFinalSubmit();
    }, 2500);
  };

  // Final Exam Submission and Score calculation
  const handleFinalSubmit = () => {
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);

    // Update global progress store & performance recording (deferred buffer -> single flush)
    let recordedAny = false;
    activeQuestionIds.forEach((qId) => {
      const q = questionsMap.get(qId);
      const state = questionStates[qId];
      if (q && state && state.selectedIndex !== null) {
        recordedAny = true;
        const isCorrect = state.selectedIndex === q.correctIndex;
        onUpdateProgress(qId, isCorrect, state.selectedIndex);
        recordQuestionAttempt(
          {
            questionId: qId,
            chapterId: q.chapterId,
            topicId: q.topicId,
            timeTakenSeconds: Math.max(5, state.timeSpentSeconds || 25),
            isCorrect,
            selectedOption: String(state.selectedIndex),
            correctOption: String(q.correctIndex),
          },
          { deferFlush: true }
        );
      }
    });

    if (recordedAny) {
      const totalElapsedSecs = Math.max(1, totalExamDurationMinutes * 60 - remainingSeconds);
      flushStudentWriteBuffer({
        trigger: "test_submission",
        sessionMeta: {
          testId: selectedPresetId,
          testTitle: isCustomMode
            ? `Custom Mock (${activeQuestionIds.length} Qs)`
            : activePreset.title,
          testType: "full_exam",
          timeSpentSeconds: totalElapsedSecs,
        },
      }).catch(() => {});
    }

    setShowSubmitConfirm(false);
    setShowPaletteDrawer(false);
    setScreen("result");
    window.scrollTo({ top: 0, behavior: "smooth" });

    // Check if 100% accuracy was achieved in this full exam
    const isPerfect =
      activeQuestionIds.length > 0 &&
      activeQuestionIds.every((qId) => {
        const q = questionsMap.get(qId);
        const state = questionStates[qId];
        return q && state && state.selectedIndex === q.correctIndex;
      });

    if (isPerfect) {
      setShowPerfectCelebration(true);
    }

    try {
      confetti({
        particleCount: 70,
        spread: 80,
        origin: { y: 0.6 },
      });
    } catch (e) {
      // safe fail
    }
  };

  // Active question details
  const currentQuestionId = activeQuestionIds[currentIdx];
  const currentQuestion = currentQuestionId ? questionsMap.get(currentQuestionId) : null;
  const currentChapter = currentQuestion?.chapterId ? chaptersMap.get(currentQuestion?.chapterId) : null;
  const currentState = currentQuestionId ? questionStates[currentQuestionId] : null;

  // Palette counts
  const paletteCounts = useMemo(() => {
    let answered = 0;
    let notAnswered = 0;
    let markedReview = 0;
    let answeredAndMarked = 0;
    let notVisited = 0;

    activeQuestionIds.forEach((id) => {
      const st = questionStates[id];
      if (!st || !st.isVisited) {
        notVisited++;
      } else if (st.selectedIndex !== null && st.isMarkedForReview) {
        answeredAndMarked++;
        answered++;
      } else if (st.selectedIndex !== null) {
        answered++;
      } else if (st.isMarkedForReview) {
        markedReview++;
      } else {
        notAnswered++;
      }
    });

    return { answered, notAnswered, markedReview, answeredAndMarked, notVisited };
  }, [activeQuestionIds, questionStates]);

  // Results calculation
  const examResults = useMemo(() => {
    let correctCount = 0;
    let wrongCount = 0;
    let skippedCount = 0;

    const breakdownByChapter: Record<
      string,
      { name: string; total: number; correct: number; wrong: number; skipped: number }
    > = {};

    activeQuestionIds.forEach((qId) => {
      const q = questionsMap.get(qId);
      const state = questionStates[qId];
      const chName = q?.chapterId && chaptersMap.get(q.chapterId)
        ? chaptersMap.get(q.chapterId)!.title
        : "General";

      if (!breakdownByChapter[chName]) {
        breakdownByChapter[chName] = {
          name: chName,
          total: 0,
          correct: 0,
          wrong: 0,
          skipped: 0,
        };
      }
      breakdownByChapter[chName].total++;

      if (!state || state.selectedIndex === null) {
        skippedCount++;
        breakdownByChapter[chName].skipped++;
      } else if (q && state.selectedIndex === q.correctIndex) {
        correctCount++;
        breakdownByChapter[chName].correct++;
      } else {
        wrongCount++;
        breakdownByChapter[chName].wrong++;
      }
    });

    const marksGained = correctCount * 1;
    const marksDeducted = wrongCount * negativeMarkValue;
    const netMarks = Math.max(0, marksGained - marksDeducted);
    const totalMaxMarks = activeQuestionIds.length * 1;
    const percentage = totalMaxMarks > 0 ? (netMarks / totalMaxMarks) * 100 : 0;
    const accuracy =
      correctCount + wrongCount > 0
        ? (correctCount / (correctCount + wrongCount)) * 100
        : 0;

    const totalSecondsSpent = totalExamDurationMinutes * 60 - remainingSeconds;

    return {
      totalQuestions: activeQuestionIds.length,
      correctCount,
      wrongCount,
      skippedCount,
      marksGained,
      marksDeducted,
      netMarks: Number(netMarks.toFixed(2)),
      totalMaxMarks,
      percentage: Number(percentage.toFixed(1)),
      accuracy: Number(accuracy.toFixed(1)),
      totalSecondsSpent,
      breakdownByChapter,
    };
  }, [
    activeQuestionIds,
    questionStates,
    questionsMap,
    chaptersMap,
    negativeMarkValue,
    totalExamDurationMinutes,
    remainingSeconds,
  ]);

  if (!isOpen) return null;

  // ─────────────────────────────────────────────────────────────
  // 1. PRE-EXAM CONFIGURATION & SELECTION SCREEN
  // ─────────────────────────────────────────────────────────────
  if (screen === "config") {
    return (
      <div
        id="full-exam-modal-container"
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto animate-in fade-in duration-200"
      >
        <div className="w-full max-w-xl bg-white dark:bg-[#111A2E] rounded-[24px] border border-slate-200/80 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
          {/* Header - Sleek */}
          <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0 bg-white dark:bg-[#111A2E] sticky top-0 z-10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-lg shadow-blue-500/20">
                <Award className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-black text-slate-900 dark:text-white leading-none">
                  Exam Center
                </h2>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">
                  Full Length Mock Simulation
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="w-9 h-9 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-500 flex items-center justify-center active:scale-90 transition-transform cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body Content - Scrollable */}
          <div className="flex-1 overflow-y-auto p-5 space-y-6">
            {/* Mode Selector - Modern Tabs */}
            <div className="flex p-1.5 bg-slate-100 dark:bg-slate-800/60 rounded-2xl">
              <button
                type="button"
                onClick={() => setIsCustomMode(false)}
                className={`flex-1 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                  !isCustomMode
                    ? "bg-white dark:bg-[#111A2E] text-blue-600 dark:text-blue-400 shadow-md"
                    : "text-slate-500 hover:text-slate-700 dark:text-slate-400"
                }`}
              >
                Exam Presets
              </button>
              <button
                type="button"
                onClick={() => setIsCustomMode(true)}
                className={`flex-1 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                  isCustomMode
                    ? "bg-white dark:bg-[#111A2E] text-blue-600 dark:text-blue-400 shadow-md"
                    : "text-slate-500 hover:text-slate-700 dark:text-slate-400"
                }`}
              >
                Custom Setup
              </button>
            </div>

            {/* 1. Presets List - Card style */}
            {!isCustomMode ? (
              <div className="space-y-3">
                {DEFAULT_EXAM_PRESETS.map((preset) => {
                  const isSelected = selectedPresetId === preset.id;
                  return (
                    <button
                      key={preset.id}
                      onClick={() => setSelectedPresetId(preset.id)}
                      className={`w-full p-4 rounded-[24px] border-2 text-left transition-all cursor-pointer flex items-center gap-4 relative overflow-hidden ${
                        isSelected
                          ? "bg-blue-50 dark:bg-blue-900/10 border-blue-600 shadow-lg shadow-blue-500/5"
                          : "bg-white dark:bg-slate-800/40 border-slate-100 dark:border-slate-800"
                      }`}
                    >
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 font-black text-sm ${
                        isSelected ? "bg-blue-600 text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-500"
                      }`}>
                        {preset.questionCount}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-black text-slate-900 dark:text-white truncate">
                          {preset.hindiTitle}
                        </h3>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="text-[10px] font-black text-slate-400 uppercase">{preset.durationMinutes} Mins</span>
                          <span className="w-1 h-1 rounded-full bg-slate-300" />
                          <span className="text-[10px] font-black text-rose-500 uppercase">-{preset.negativeMarking} Neg</span>
                        </div>
                      </div>
                      {isSelected && (
                        <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center">
                          <Check className="w-3.5 h-3.5 stroke-[4]" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            ) : (
              /* 2. Custom Exam Controls - Simplified */
              <div className="space-y-5 bg-slate-50 dark:bg-slate-900/30 p-5 rounded-[28px] border border-slate-100 dark:border-slate-800">
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3 block">Question Count</label>
                  <div className="grid grid-cols-4 gap-2">
                    {[30, 50, 80, 100].map((cnt) => (
                      <button
                        key={cnt}
                        onClick={() => setCustomQuestionCount(cnt)}
                        className={`py-3 rounded-xl text-xs font-black border-2 transition-all ${
                          customQuestionCount === cnt ? "bg-blue-600 border-blue-600 text-white shadow-md" : "bg-white dark:bg-slate-800 border-transparent text-slate-600 dark:text-slate-400"
                        }`}
                      >
                        {cnt}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3 block">Duration (Mins)</label>
                  <div className="grid grid-cols-4 gap-2">
                    {[30, 60, 90, 120].map((mins) => (
                      <button
                        key={mins}
                        onClick={() => setCustomDurationMinutes(mins)}
                        className={`py-3 rounded-xl text-xs font-black border-2 transition-all ${
                          customDurationMinutes === mins ? "bg-amber-500 border-amber-500 text-white shadow-md" : "bg-white dark:bg-slate-800 border-transparent text-slate-600 dark:text-slate-400"
                        }`}
                      >
                        {mins}m
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer - Sticky */}
          <div className="p-5 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-[#111A2E] flex flex-col gap-3">
            <button
              id="btn-start-full-exam"
              onClick={handleStartExam}
              className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-[20px] font-black text-sm flex items-center justify-center gap-2 shadow-xl shadow-blue-500/25 active:scale-95 transition-all cursor-pointer"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>START EXAMINATION</span>
            </button>
            <p className="text-center text-[10px] font-bold text-slate-400 uppercase tracking-tighter">
              By starting, you agree to follow the exam rules.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────
  // 2. ACTIVE CBT EXAM SIMULATION INTERFACE
  // ─────────────────────────────────────────────────────────────
  if (screen === "active-exam") {
    const isTimeUrgent = remainingSeconds <= 300; // < 5 mins left
    const qState = currentQuestionId ? questionStates[currentQuestionId] : null;

    return (
      <div
        id="full-exam-active-viewport"
        className="fixed inset-0 z-50 bg-[#F8FAFC] dark:bg-[#0B1220] flex flex-col w-full h-[100dvh] overflow-hidden select-none font-sans"
      >
        {/* Top Control Bar - Sleek & Mobile Optimized */}
        <header className="h-14 sm:h-16 px-3 sm:px-6 bg-white dark:bg-[#111A2E] border-b border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-2 shrink-0 shadow-sm sticky top-0 z-30">
          {/* Left: Progress Info */}
          <div className="flex items-center gap-2 min-w-0">
            <div className="hidden sm:flex w-9 h-9 rounded-xl bg-blue-600 text-white items-center justify-center shrink-0 font-bold text-xs shadow-xs">
              CBT
            </div>
            <div className="min-w-0">
              <p className="text-[10px] sm:text-[11px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest leading-none mb-1">
                Question
              </p>
              <p className="text-xs sm:text-sm font-black text-slate-900 dark:text-white font-mono leading-none">
                {currentIdx + 1} / {activeQuestionIds.length}
              </p>
            </div>
          </div>

          {/* Center: Live Countdown Timer - Prominent on Mobile */}
          <div className="absolute left-1/2 -translate-x-1/2 flex items-center">
            <div
              className={`px-3 sm:px-5 py-1.5 rounded-2xl border flex items-center gap-1.5 font-mono font-black text-sm sm:text-lg tracking-tighter shadow-xs transition-all duration-300 ${
                isTimeUrgent
                  ? "bg-rose-50 dark:bg-rose-950/60 border-rose-300 dark:border-rose-800 text-rose-600 dark:text-rose-400 animate-pulse scale-105"
                  : "bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100"
              }`}
            >
              <Clock className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${isTimeUrgent ? "text-rose-600 animate-spin" : "text-amber-500"}`} />
              <span>{formatCountdown(remainingSeconds)}</span>
            </div>
          </div>

          {/* Right Actions: Palette Drawer & Submit */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            <button
              id="btn-toggle-omr-palette"
              onClick={() => setShowPaletteDrawer(true)}
              className="h-9 px-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200/50 dark:border-slate-700/50 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shrink-0 active:scale-95"
            >
              <Grid className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <span className="hidden sm:inline">OMR</span>
            </button>

            <button
              id="btn-submit-exam"
              onClick={() => setShowSubmitConfirm(true)}
              className="h-9 px-3 sm:px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black flex items-center gap-1 shadow-md shadow-emerald-500/20 active:scale-95 transition-all cursor-pointer shrink-0"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span className="hidden sm:inline">Finish</span>
              <span className="inline sm:hidden">End</span>
            </button>
          </div>
        </header>

        {/* Dynamic Progress Indicator */}
        <div className="w-full h-1 bg-slate-100 dark:bg-slate-800/80 shrink-0">
          <div
            className="h-full bg-blue-600 dark:bg-blue-500 transition-all duration-300 ease-out"
            style={{ width: `${((currentIdx + 1) / activeQuestionIds.length) * 100}%` }}
          />
        </div>

        {/* SWIPEABLE QUESTION NAVIGATION BAR */}
        <div className="w-full bg-white dark:bg-[#111A2E] border-b border-slate-200/80 dark:border-slate-800/80 py-2 px-3 shrink-0 z-20 shadow-2xs">
          <div className="flex items-center justify-between gap-2 mb-1 px-1">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 font-mono flex items-center gap-1">
              <span>OMR Navigation</span>
              <span className="text-blue-600 dark:text-blue-400 font-bold">({currentIdx + 1}/{activeQuestionIds.length})</span>
            </span>
            <div className="flex items-center gap-2 text-[9px] font-bold text-slate-400 font-mono">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-blue-600 inline-block" /> Active
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" /> Done
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-purple-500 inline-block" /> Review
              </span>
            </div>
          </div>

          <div 
            className="flex items-center gap-2 overflow-x-auto scrollbar-hide py-1 px-0.5 scroll-smooth select-none w-full max-w-full touch-pan-x"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none', WebkitOverflowScrolling: 'touch' }}
          >
            {activeQuestionIds.map((qId, idx) => {
              const st = questionStates[qId];
              const isCurrent = idx === currentIdx;

              let bgClass = "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700/80";
              if (isCurrent) {
                bgClass = "bg-blue-600 border-blue-600 text-white font-black ring-2 ring-blue-500/30 scale-105 shadow-md shadow-blue-600/20";
              } else if (st?.selectedIndex !== null && st?.isMarkedForReview) {
                bgClass = "bg-purple-600 border-purple-600 text-white font-bold ring-2 ring-emerald-400";
              } else if (st?.selectedIndex !== null) {
                bgClass = "bg-emerald-600 border-emerald-600 text-white font-bold";
              } else if (st?.isMarkedForReview) {
                bgClass = "bg-purple-600 border-purple-600 text-white font-bold";
              } else if (st?.isVisited) {
                bgClass = "bg-rose-500 border-rose-500 text-white font-bold";
              }

              return (
                <button
                  key={qId}
                  ref={(el) => {
                    if (isCurrent && el) {
                      el.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
                    }
                  }}
                  onClick={() => setCurrentIdx(idx)}
                  className={`shrink-0 min-w-[38px] h-[36px] px-2.5 rounded-xl border-2 text-xs font-mono font-black flex items-center justify-center transition-all cursor-pointer relative active:scale-90 ${bgClass}`}
                  title={`Question ${idx + 1}`}
                >
                  {idx + 1}
                </button>
              );
            })}
          </div>
        </div>

        {/* Question Area Container */}
        <div className="flex-1 flex overflow-hidden relative">
          {/* Main Question Panel */}
          <main className="flex-1 overflow-y-auto p-4 sm:p-6 flex flex-col justify-between max-w-4xl mx-auto w-full">
            {currentQuestion ? (
              <div className="space-y-5">
                {/* Meta row: Subject, Chapter & Marking Scheme */}
                <div className="flex items-center justify-between flex-wrap gap-2.5 pb-3 border-b border-slate-200/50 dark:border-slate-800/80">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs tracking-wide font-black text-blue-600 dark:text-blue-400 bg-blue-50/80 dark:bg-blue-950/40 border border-blue-100/40 dark:border-blue-900/40 px-3 py-1 rounded-xl">
                      {currentChapter?.title || "Syllabus Question"}
                    </span>
                    {qState?.isMarkedForReview && (
                      <span className="text-[10px] font-extrabold bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 border border-purple-200/50 dark:border-purple-800/50 px-2.5 py-1 rounded-xl flex items-center gap-1 animate-pulse">
                        <Flag className="w-3.5 h-3.5 fill-current" />
                        <span>Marked for Review</span>
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 text-xs font-mono font-bold">
                    <span className="text-emerald-600 dark:text-emerald-400 bg-emerald-50/60 dark:bg-emerald-950/30 px-2.5 py-1 rounded-xl">
                      +1.00 Marks
                    </span>
                    <span className="text-rose-600 dark:text-rose-400 bg-rose-50/60 dark:bg-rose-950/30 px-2.5 py-1 rounded-xl">
                      -{negativeMarkValue} Negative
                    </span>
                  </div>
                </div>

                {/* Question Statement Card - Compact Refinement */}
                <div className="bg-white dark:bg-[#111A2E]/50 border border-slate-200/50 dark:border-slate-800/50 shadow-sm rounded-[24px] p-[0.96rem] sm:p-[1.34rem] relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-1 h-full bg-blue-600" />
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-0.5 rounded-lg bg-blue-600 text-white font-mono font-black text-[10px] uppercase tracking-tighter">
                        Question {currentIdx + 1}
                      </span>
                    </div>
                    <div className="text-[14.5px] sm:text-[17.1px] font-bold text-slate-900 dark:text-white leading-snug">
                      <ParsedQuestion text={currentQuestion.text} fontSizeClass="text-[14.5px] sm:text-[17.1px]" question={currentQuestion} />
                    </div>
                  </div>
                </div>

                {/* 4 Options Grid - Compact Refinement */}
                <div className="grid grid-cols-1 gap-2.5 pt-1.5">
                  {currentQuestion.options.map((optionText, optIdx) => {
                    const isSelected = qState?.selectedIndex === optIdx;
                    const optionLetter = ["A", "B", "C", "D"][optIdx];

                    return (
                      <button
                        key={`${currentQuestion.id}-opt-${optIdx}`}
                        onClick={() => handleSelectOption(optIdx)}
                        className={`group w-full p-[0.77rem] sm:p-[0.96rem] rounded-[20px] border-2 text-left transition-all duration-200 flex items-center gap-3 select-none relative overflow-hidden active:scale-[0.98] ${
                          isSelected
                            ? "bg-blue-50 dark:bg-blue-900/20 border-blue-600 dark:border-blue-500 shadow-md shadow-blue-500/10"
                            : "bg-white dark:bg-[#111A2E] border-slate-100 dark:border-slate-800 hover:border-blue-200 dark:hover:border-blue-800"
                        }`}
                      >
                        <div
                          className={`w-[1.91rem] h-[1.91rem] sm:w-[2.1rem] sm:h-[2.1rem] rounded-xl font-black font-mono text-xs sm:text-sm flex items-center justify-center shrink-0 transition-all duration-300 ${
                            isSelected
                              ? "bg-blue-600 text-white shadow-lg shadow-blue-500/30"
                              : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 group-hover:bg-blue-100 dark:group-hover:bg-blue-900/30 group-hover:text-blue-600 transition-colors"
                          }`}
                        >
                          {optionLetter}
                        </div>

                        <RichText text={optionText} className={`text-[0.86rem] sm:text-[0.96rem] leading-snug flex-1 min-w-0 break-words [overflow-wrap:anywhere] transition-all ${
                          isSelected
                            ? "font-black text-blue-900 dark:text-white"
                            : "font-bold text-slate-700 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-white"
                        }`} />

                        {isSelected && (
                          <div className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-sm animate-in zoom-in duration-200">
                            <Check className="w-3 h-3 stroke-[4]" />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="p-8 text-center text-slate-500">
                No questions loaded
              </div>
            )}

            {/* Bottom Navigation - Fixed/Sticky on Mobile */}
            <div className="sticky bottom-0 left-0 right-0 py-4 bg-[#F8FAFC]/95 dark:bg-[#0B1220]/95 backdrop-blur-sm border-t border-slate-200/50 dark:border-slate-800/50 mt-auto flex items-center justify-between gap-3 shrink-0 z-20">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handlePrevious}
                  disabled={currentIdx === 0}
                  className="h-12 w-12 sm:w-auto sm:px-5 bg-white dark:bg-[#111A2E] border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 rounded-2xl disabled:opacity-30 flex items-center justify-center gap-2 font-black transition-all active:scale-95 disabled:cursor-not-allowed shadow-sm"
                >
                  <ArrowLeft className="w-5 h-5" />
                  <span className="hidden sm:inline text-xs">Prev</span>
                </button>

                <button
                  type="button"
                  onClick={handleToggleReview}
                  className={`h-12 w-12 sm:w-auto sm:px-5 rounded-2xl flex items-center justify-center gap-2 border-2 transition-all active:scale-95 shadow-sm ${
                    qState?.isMarkedForReview
                      ? "bg-purple-600 border-purple-600 text-white"
                      : "bg-white dark:bg-[#111A2E] border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400"
                  }`}
                >
                  <Flag className={`w-5 h-5 ${qState?.isMarkedForReview ? "fill-current" : ""}`} />
                  <span className="hidden sm:inline text-xs font-black">Review</span>
                </button>
                
                <button
                  type="button"
                  onClick={handleClearSelection}
                  disabled={qState?.selectedIndex === null}
                  className="h-12 w-12 sm:w-auto sm:px-5 bg-white dark:bg-[#111A2E] border border-slate-200 dark:border-slate-800 text-rose-500 rounded-2xl disabled:opacity-30 flex items-center justify-center gap-2 transition-all active:scale-95 shadow-sm"
                >
                  <RotateCcw className="w-5 h-5" />
                  <span className="hidden sm:inline text-xs font-black">Clear</span>
                </button>
              </div>

              <button
                type="button"
                onClick={handleSaveAndNext}
                className="h-12 flex-1 sm:flex-none sm:px-8 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-blue-500/25 active:scale-95 transition-all"
              >
                <span>{currentIdx === activeQuestionIds.length - 1 ? "Submit Exam" : "Next Question"}</span>
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          </main>
        </div>

        {/* ── QUESTION PALETTE SLIDE-OVER DRAWER (OMR SHEET) ── */}
        {showPaletteDrawer && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-2xs flex justify-end animate-in fade-in duration-150">
            <div className="w-full max-w-sm sm:max-w-md bg-white dark:bg-[#111A2E] h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-200 border-l border-slate-200 dark:border-slate-800">
              {/* Drawer Header */}
              <div className="p-4 border-b border-slate-200/80 dark:border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Grid className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">
                    Question Palette
                  </h3>
                </div>
                <button
                  onClick={() => setShowPaletteDrawer(false)}
                  className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 flex items-center justify-center hover:bg-slate-200"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Status Legend */}
              <div className="p-3 bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200/60 dark:border-slate-800 grid grid-cols-2 gap-2 text-[11px] font-bold">
                <div className="flex items-center gap-1.5">
                  <span className="w-3.5 h-3.5 rounded-full bg-emerald-500 shrink-0" />
                  <span>Answered: {paletteCounts.answered}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3.5 h-3.5 rounded-full bg-rose-500 shrink-0" />
                  <span>Not Answered: {paletteCounts.notAnswered}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3.5 h-3.5 rounded-full bg-purple-500 shrink-0" />
                  <span>Marked Review: {paletteCounts.markedReview}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3.5 h-3.5 rounded-full bg-slate-300 dark:bg-slate-600 shrink-0" />
                  <span>Not Visited: {paletteCounts.notVisited}</span>
                </div>
              </div>

              {/* Palette Grid */}
              <div className="flex-1 overflow-y-auto p-4">
                <div className="grid grid-cols-5 sm:grid-cols-6 gap-2">
                  {activeQuestionIds.map((qId, idx) => {
                    const st = questionStates[qId];
                    const isCurrent = idx === currentIdx;

                    let bgClass = "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400";
                    if (st?.selectedIndex !== null && st?.isMarkedForReview) {
                      bgClass = "bg-purple-600 text-white ring-2 ring-emerald-400";
                    } else if (st?.selectedIndex !== null) {
                      bgClass = "bg-emerald-600 text-white";
                    } else if (st?.isMarkedForReview) {
                      bgClass = "bg-purple-600 text-white";
                    } else if (st?.isVisited) {
                      bgClass = "bg-rose-500 text-white";
                    }

                    return (
                      <button
                        key={qId}
                        onClick={() => {
                          setCurrentIdx(idx);
                          setShowPaletteDrawer(false);
                        }}
                        className={`h-10 rounded-xl font-mono text-xs font-bold flex items-center justify-center transition-all cursor-pointer ${bgClass} ${
                          isCurrent ? "ring-3 ring-blue-500 ring-offset-2 scale-105" : ""
                        }`}
                      >
                        {idx + 1}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Drawer Footer */}
              <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60">
                <button
                  onClick={() => {
                    setShowPaletteDrawer(false);
                    setShowSubmitConfirm(true);
                  }}
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-md shadow-emerald-500/20 cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Submit Test</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── SUBMISSION CONFIRMATION MODAL ── */}
        {showSubmitConfirm && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-2xs flex items-center justify-center p-4 animate-in fade-in duration-150">
            <div className="w-full max-w-md bg-white dark:bg-[#111A2E] rounded-3xl p-5 border border-slate-200 dark:border-slate-800 shadow-2xl space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-100 dark:bg-amber-950/60 text-amber-600 flex items-center justify-center">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-slate-900 dark:text-white">
                    Are you sure you want to submit the exam?
                  </h3>
                  <p className="text-xs text-slate-500">
                    You will not be able to change your answers after submission.
                  </p>
                </div>
              </div>

              {/* Summary Stats Table */}
              <div className="bg-slate-50 dark:bg-slate-900/40 p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-800 space-y-2 text-xs">
                <div className="flex justify-between items-center text-slate-600 dark:text-slate-400">
                  <span>Total Questions:</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white">
                    {activeQuestionIds.length}
                  </span>
                </div>
                <div className="flex justify-between items-center text-emerald-600 font-bold">
                  <span>Answered:</span>
                  <span className="font-mono">{paletteCounts.answered}</span>
                </div>
                <div className="flex justify-between items-center text-rose-600 font-bold">
                  <span>Not Answered:</span>
                  <span className="font-mono">{paletteCounts.notAnswered + paletteCounts.notVisited}</span>
                </div>
                <div className="flex justify-between items-center text-purple-600 font-bold">
                  <span>Marked for Review:</span>
                  <span className="font-mono">{paletteCounts.markedReview + paletteCounts.answeredAndMarked}</span>
                </div>
                <div className="flex justify-between items-center text-amber-600 font-bold pt-1 border-t border-slate-200 dark:border-slate-800">
                  <span>Time Remaining:</span>
                  <span className="font-mono">{formatCountdown(remainingSeconds)}</span>
                </div>
              </div>

              <div className="flex items-center gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => setShowSubmitConfirm(false)}
                  className="flex-1 py-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  Resume Exam
                </button>
                <button
                  type="button"
                  id="btn-confirm-final-submit"
                  onClick={handleFinalSubmit}
                  className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-emerald-500/20 cursor-pointer"
                >
                  Yes, Submit Test
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── TIME UP AUTO-SUBMIT ALERT ── */}
        {showTimeUpAlert && (
          <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="w-full max-w-sm bg-white dark:bg-[#111A2E] rounded-3xl p-6 text-center space-y-3 shadow-2xl">
              <div className="w-14 h-14 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto animate-bounce">
                <Clock className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-black text-slate-900 dark:text-white">
                Time's Up!
              </h3>
              <p className="text-xs text-slate-500">
                Your allotted time has expired. Submitting test automatically...
              </p>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────
  // 3. EXAM REPORT CARD & IN-DEPTH SOLUTIONS VIEW
  // ─────────────────────────────────────────────────────────────
  const {
    totalQuestions,
    correctCount,
    wrongCount,
    skippedCount,
    marksGained,
    marksDeducted,
    netMarks,
    totalMaxMarks,
    percentage,
    accuracy,
    totalSecondsSpent,
    breakdownByChapter,
  } = examResults;

  // Filtered review questions
  const filteredReviewQuestions = activeQuestionIds.filter((qId) => {
    const q = questionsMap.get(qId);
    const st = questionStates[qId];
    if (resultFilter === "all") return true;
    if (resultFilter === "correct") {
      return st?.selectedIndex !== null && q && st.selectedIndex === q.correctIndex;
    }
    if (resultFilter === "wrong") {
      return st?.selectedIndex !== null && q && st.selectedIndex !== q.correctIndex;
    }
    if (resultFilter === "skipped") {
      return !st || st.selectedIndex === null;
    }
    if (resultFilter === "review") {
      return Boolean(st?.isMarkedForReview);
    }
    return true;
  });

  const isPerfectScore =
    totalQuestions > 0 &&
    correctCount === totalQuestions &&
    wrongCount === 0 &&
    skippedCount === 0;

  return (
    <>
      <motion.div
      initial={{ opacity: 0, scale: 0.96, y: 24, filter: "blur(8px)" }}
      animate={{ opacity: 1, scale: 1, y: 0, filter: "blur(0px)" }}
      exit={{ opacity: 0, scale: 0.96, y: -20, filter: "blur(8px)" }}
      transition={{ duration: 0.48, ease: [0.16, 1, 0.3, 1] }}
      id="full-exam-result-viewport"
      className="fixed inset-0 z-50 bg-[#F8FAFC] dark:bg-[#0B1220] flex flex-col w-full h-[100dvh] overflow-y-auto"
    >
      {/* Framer-Motion Confetti Animation for 100% Accuracy Perfect Score */}
      {showPerfectCelebration && (
        <MotionConfettiCelebration
          isOpen={showPerfectCelebration}
          onClose={() => setShowPerfectCelebration(false)}
          totalQuestions={totalQuestions}
          sessionTitle="Full Exam Simulation"
          accuracy={100}
          soundEnabled={settings.soundEffects !== false}
          hapticEnabled={settings.hapticFeedback !== false}
        />
      )}

      {/* Result Header */}
      <header className="h-14 sm:h-16 px-4 sm:px-6 bg-white dark:bg-[#111A2E] border-b border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-3 shrink-0 sticky top-0 z-20 shadow-xs">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-xs">
            <Award className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white">
              Mock Test Scorecard
            </h2>
            <p className="text-[11px] text-slate-500">
              {totalQuestions} Questions • Real Negative Marking Analysis
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-900 flex items-center justify-center cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Result Body Content */}
      <div className="flex-1 max-w-4xl mx-auto w-full p-4 sm:p-6 space-y-6">
        {/* Top Hero Score Card - Optimized */}
        <div className="relative overflow-hidden rounded-[32px] bg-slate-900 text-white p-6 sm:p-8 shadow-2xl border border-white/10">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-900/40 via-transparent to-purple-900/40" />
          <div className="relative z-10 flex flex-col items-center text-center gap-6">
            <div className="space-y-1">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] bg-blue-600 text-white px-3 py-1.5 rounded-full shadow-lg">
                Scorecard
              </span>
              <h1 className="text-5xl sm:text-6xl font-black font-mono tracking-tighter mt-4 text-white">
                {netMarks}
              </h1>
              <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">
                Out of {totalMaxMarks} Marks
              </p>
            </div>

            {/* Percentage & Accuracy circles or stats */}
            <div className="grid grid-cols-3 gap-6 w-full max-w-sm pt-4 border-t border-white/10">
              <div className="space-y-1">
                <p className="text-xl font-black font-mono text-emerald-400">{percentage}%</p>
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-tighter">Score</p>
              </div>
              <div className="space-y-1">
                <p className="text-xl font-black font-mono text-blue-400">{accuracy}%</p>
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-tighter">Accuracy</p>
              </div>
              <div className="space-y-1">
                <p className="text-xl font-black font-mono text-amber-400">
                  {Math.floor(totalSecondsSpent / 60)}m
                </p>
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-tighter">Time</p>
              </div>
            </div>
          </div>
        </div>

        {/* 100% Accuracy Celebratory Highlight Card */}
        {isPerfectScore && (
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.25 }}
            className="p-4 rounded-3xl bg-gradient-to-r from-amber-500/15 via-yellow-400/20 to-amber-500/15 border border-amber-400/50 flex items-center justify-between gap-3 text-left shadow-sm"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-amber-500 to-yellow-400 text-white flex items-center justify-center shadow-md shadow-amber-500/30 shrink-0">
                <Sparkles className="w-6 h-6 fill-white" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-black uppercase tracking-wider text-amber-700 dark:text-amber-300 font-mono">
                    100% Accuracy • Perfect Exam Score!
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-amber-400/30 text-[9px] font-black text-amber-900 dark:text-amber-200 uppercase">
                    Flawless
                  </span>
                </div>
                <p className="text-xs text-slate-700 dark:text-slate-300 font-semibold truncate">
                  Outstanding performance! You answered all questions with 100% accuracy.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowPerfectCelebration(true)}
              className="px-4 py-2.5 rounded-2xl bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-600 hover:to-yellow-500 text-slate-950 font-black text-xs flex items-center gap-1.5 shadow-md shadow-amber-500/25 active:scale-95 transition-all cursor-pointer shrink-0"
            >
              <span>Replay</span>
              <span>🎉</span>
            </button>
          </motion.div>
        )}

        {/* 4 Score Metrics Bento Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3.5 rounded-2xl bg-white dark:bg-[#111A2E] border border-slate-200/60 dark:border-slate-800 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between gap-1">
              <span className="text-xs font-bold text-slate-500 truncate">Correct Answers</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
            </div>
            <div className="mt-2.5">
              <div className="text-xl sm:text-2xl font-black font-mono text-emerald-600 dark:text-emerald-400">
                +{correctCount}
              </div>
              <span className="text-[10px] text-slate-400 font-bold block mt-0.5">
                +{marksGained} Marks
              </span>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-white dark:bg-[#111A2E] border border-slate-200/60 dark:border-slate-800 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between gap-1">
              <span className="text-xs font-bold text-slate-500 truncate">Incorrect</span>
              <XCircle className="w-4 h-4 text-rose-500 shrink-0" />
            </div>
            <div className="mt-2.5">
              <div className="text-xl sm:text-2xl font-black font-mono text-rose-600 dark:text-rose-400">
                -{wrongCount}
              </div>
              <span className="text-[10px] text-rose-500 font-bold block mt-0.5">
                -{marksDeducted.toFixed(2)} Marks
              </span>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-white dark:bg-[#111A2E] border border-slate-200/60 dark:border-slate-800 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between gap-1">
              <span className="text-xs font-bold text-slate-500 truncate">Skipped</span>
              <HelpCircle className="w-4 h-4 text-amber-500 shrink-0" />
            </div>
            <div className="mt-2.5">
              <div className="text-xl sm:text-2xl font-black font-mono text-amber-600 dark:text-amber-400">
                {skippedCount}
              </div>
              <span className="text-[10px] text-slate-400 font-bold block mt-0.5">
                0 Penalty
              </span>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-white dark:bg-[#111A2E] border border-slate-200/60 dark:border-slate-800 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between gap-1">
              <span className="text-xs font-bold text-slate-500 truncate">Total Questions</span>
              <Award className="w-4 h-4 text-blue-500 shrink-0" />
            </div>
            <div className="mt-2.5">
              <div className="text-xl sm:text-2xl font-black font-mono text-slate-800 dark:text-slate-200">
                {totalQuestions}
              </div>
              <span className="text-[10px] text-slate-400 font-bold block mt-0.5">
                100% Target
              </span>
            </div>
          </div>
        </div>

        {/* Chapter-wise Breakdown */}
        {Object.keys(breakdownByChapter).length > 1 && (
          <div className="bg-white dark:bg-[#111A2E] border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Subject-wise Analysis
            </h3>
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {Object.values(breakdownByChapter).map((item) => (
                <div key={item.name} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                  <div className="min-w-0">
                    <span className="font-bold text-slate-900 dark:text-white truncate block">
                      {item.name}
                    </span>
                    <span className="text-[11px] text-slate-400">
                      {item.total} Qs • Correct: {item.correct} | Wrong: {item.wrong}
                    </span>
                  </div>
                  <div className="text-right shrink-0 font-mono font-bold">
                    <span className="text-blue-600 dark:text-blue-400">
                      {Math.max(0, item.correct - item.wrong * negativeMarkValue).toFixed(2)} Marks
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Detailed Solutions & Review */}
        <div className="space-y-4 pt-2">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
              Detailed Solutions & Explanations
            </h3>

            {/* Filter Tabs */}
            <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl text-xs font-bold overflow-x-auto">
              <button
                type="button"
                onClick={() => setResultFilter("all")}
                className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                  resultFilter === "all" ? "bg-white dark:bg-slate-700 text-blue-600 shadow-2xs" : "text-slate-500"
                }`}
              >
                All ({totalQuestions})
              </button>
              <button
                type="button"
                onClick={() => setResultFilter("wrong")}
                className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                  resultFilter === "wrong" ? "bg-white dark:bg-slate-700 text-rose-600 shadow-2xs" : "text-slate-500"
                }`}
              >
                Wrong ({wrongCount})
              </button>
              <button
                type="button"
                onClick={() => setResultFilter("correct")}
                className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                  resultFilter === "correct" ? "bg-white dark:bg-slate-700 text-emerald-600 shadow-2xs" : "text-slate-500"
                }`}
              >
                Correct ({correctCount})
              </button>
              <button
                type="button"
                onClick={() => setResultFilter("skipped")}
                className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                  resultFilter === "skipped" ? "bg-white dark:bg-slate-700 text-amber-600 shadow-2xs" : "text-slate-500"
                }`}
              >
                Skipped ({skippedCount})
              </button>
            </div>
          </div>

          {/* Solutions List */}
          <div className="space-y-3">
            {filteredReviewQuestions.map((qId, idx) => {
              const q = questionsMap.get(qId);
              const st = questionStates[qId];
              if (!q) return null;

              const isAnswered = st && st.selectedIndex !== null;
              const isCorrect = isAnswered && st.selectedIndex === q.correctIndex;
              const isBookmarked = Boolean(progressStore[qId]?.bookmarked);

              return (
                <div
                  key={qId}
                  className={`p-4 rounded-2xl border transition-all ${
                    !isAnswered
                      ? "bg-slate-50/70 dark:bg-slate-900/30 border-slate-200 dark:border-slate-800"
                      : isCorrect
                      ? "bg-emerald-50/30 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/50"
                      : "bg-rose-50/30 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/50"
                  }`}
                >
                  {/* Top tags */}
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-xs text-slate-500">
                        Q.{activeQuestionIds.indexOf(qId) + 1}
                      </span>
                      {!isAnswered ? (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-900/60 dark:text-amber-300">
                          Not Attempted
                        </span>
                      ) : isCorrect ? (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> Correct (+1.0)
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-rose-100 text-rose-700 dark:bg-rose-900/60 dark:text-rose-300 flex items-center gap-1">
                          <XCircle className="w-3 h-3" /> Incorrect (-{negativeMarkValue})
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          playClickSound();
                          setReportingQuestion(q);
                          setShowReportModal(true);
                        }}
                        className="p-1.5 rounded-lg text-amber-600 hover:text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950/30 transition-colors cursor-pointer"
                        title="Report Question / Raise Objection"
                        aria-label="Report Question"
                      >
                        <Flag className="w-4 h-4" />
                      </button>

                      <button
                        type="button"
                        onClick={() => onToggleBookmark(qId)}
                        className="p-1 rounded text-slate-400 hover:text-amber-500 transition-colors cursor-pointer"
                        title="Bookmark Question"
                      >
                        <Bookmark className={`w-4 h-4 ${isBookmarked ? "text-amber-500 fill-amber-500" : ""}`} />
                      </button>
                    </div>
                  </div>

                  {/* Question Text */}
                  <div className="text-sm font-bold text-slate-900 dark:text-white leading-relaxed mb-3">
                    <ParsedQuestion text={q.text} fontSizeClass="text-sm" question={q} />
                  </div>

                  {/* Options Display */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs mb-3">
                    {q.options.map((optText, oIdx) => {
                      const isCorrectOpt = oIdx === q.correctIndex;
                      const isUserChoice = isAnswered && st.selectedIndex === oIdx;

                      let optClass = "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300";
                      if (isCorrectOpt) {
                        optClass = "bg-emerald-100 dark:bg-emerald-950/60 border-emerald-400 text-emerald-800 dark:text-emerald-200 font-bold";
                      } else if (isUserChoice && !isCorrect) {
                        optClass = "bg-rose-100 dark:bg-rose-950/60 border-rose-400 text-rose-800 dark:text-rose-200 font-bold";
                      }

                      return (
                        <div
                          key={oIdx}
                          className={`p-2.5 rounded-xl border flex items-center gap-2 ${optClass}`}
                        >
                          <span className="font-mono font-bold shrink-0">
                            {["A", "B", "C", "D"][oIdx]}.
                          </span>
                          <RichText text={optText} className="flex-1 min-w-0 break-words [overflow-wrap:anywhere]" />
                          {isCorrectOpt && <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />}
                          {isUserChoice && !isCorrect && <X className="w-3.5 h-3.5 text-rose-600 shrink-0" />}
                        </div>
                      );
                    })}
                  </div>

                  {/* Explanation */}
                  {q.explanation && (
                    <div className="bg-blue-50/60 dark:bg-blue-950/40 p-3 rounded-xl border border-blue-100 dark:border-blue-900/40 text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                      <span className="font-bold text-blue-700 dark:text-blue-400 block mb-1">
                        💡 Detailed Explanation:
                      </span>
                      <RichText text={q.explanation} enablePronunciation={true} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Retake & Home buttons */}
        <div className="pt-4 pb-12 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => {
              setScreen("config");
            }}
            className="px-5 py-3 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 text-xs font-bold flex items-center gap-2 shadow-xs cursor-pointer hover:bg-slate-50"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Retake Test</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="px-6 py-3 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-blue-500/25 cursor-pointer active:scale-95"
          >
            <span>Back to Home</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </motion.div>
    <QuestionReportModal
      isOpen={showReportModal}
      onClose={() => {
        setShowReportModal(false);
        setReportingQuestion(null);
      }}
      question={reportingQuestion}
    />
  </>
  );
};
