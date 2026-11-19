import React, { useState, useEffect } from "react";
import { MapQuizQuestion } from "../types";
import { RAJASTHAN_MAP_QUIZ_QUESTIONS } from "../data/mapQuizQuestions";
import {
  Trophy,
  Flame,
  Clock,
  Sparkles,
  HelpCircle,
  CheckCircle2,
  XCircle,
  ArrowRight,
  RotateCcw,
  Zap,
  ChevronDown,
  ChevronUp,
  Award,
} from "lucide-react";
import { triggerHaptic, playClickSound } from "../../../utils/audioFeedback";
import { districtWarService } from "../../district-war/districtWarService";

interface MapQuizRunnerProps {
  onSelectTargetForMap: (districtId: string) => void;
  onQuizFeedback: (feedback: { selectedDistrictId: string; isCorrect: boolean } | null) => void;
  selectedDistrictFromMap: string | null;
  onExitQuiz: () => void;
}

export const MapQuizRunner: React.FC<MapQuizRunnerProps> = ({
  onSelectTargetForMap,
  onQuizFeedback,
  selectedDistrictFromMap,
  onExitQuiz,
}) => {
  const [questions, setQuestions] = useState<MapQuizQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [score, setScore] = useState<number>(0);
  const [streak, setStreak] = useState<number>(0);
  const [maxStreak, setMaxStreak] = useState<number>(0);
  const [timeRemainingSec, setTimeRemainingSec] = useState<number>(30);
  const [hasAnswered, setHasAnswered] = useState<boolean>(false);
  const [lastAnswerCorrect, setLastAnswerCorrect] = useState<boolean | null>(null);
  const [weakDistricts, setWeakDistricts] = useState<string[]>([]);
  const [strongDistricts, setStrongDistricts] = useState<string[]>([]);
  const [isCompleted, setIsCompleted] = useState<boolean>(false);
  const [showHint, setShowHint] = useState<boolean>(false);
  const [isMinimized, setIsMinimized] = useState<boolean>(false);

  // Initialize random 10 questions
  useEffect(() => {
    const shuffled = [...RAJASTHAN_MAP_QUIZ_QUESTIONS].sort(() => 0.5 - Math.random()).slice(0, 10);
    setQuestions(shuffled);
    setCurrentIndex(0);
    setScore(0);
    setStreak(0);
    setMaxStreak(0);
    setWeakDistricts([]);
    setStrongDistricts([]);
    setIsCompleted(false);
    setShowHint(false);
  }, []);

  // Set current target
  const currentQ = questions[currentIndex];

  useEffect(() => {
    if (currentQ) {
      onSelectTargetForMap(currentQ.targetDistrictId);
      setTimeRemainingSec(30);
      setHasAnswered(false);
      setLastAnswerCorrect(null);
      setShowHint(false);
      onQuizFeedback(null);
    }
  }, [currentIndex, currentQ]);

  // Timer countdown
  useEffect(() => {
    if (isCompleted || hasAnswered) return;

    const timer = setInterval(() => {
      setTimeRemainingSec((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          handleTimeOut();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [hasAnswered, isCompleted, currentIndex]);

  const handleTimeOut = () => {
    if (hasAnswered) return;
    triggerHaptic("error");
    setHasAnswered(true);
    setLastAnswerCorrect(false);
    setStreak(0);
    if (currentQ) {
      setWeakDistricts((prev) => Array.from(new Set([...prev, currentQ.targetDistrictName])));
      onQuizFeedback({ selectedDistrictId: currentQ.targetDistrictId, isCorrect: false });
    }
  };

  // Evaluate when student taps on map
  useEffect(() => {
    if (!selectedDistrictFromMap || hasAnswered || isCompleted || !currentQ) return;

    const isCorrect = selectedDistrictFromMap === currentQ.targetDistrictId;
    setHasAnswered(true);
    setLastAnswerCorrect(isCorrect);

    if (isCorrect) {
      triggerHaptic("success");
      const addedScore = 10 + streak * 2;
      setScore((prev) => prev + addedScore);
      setStreak((prev) => {
        const next = prev + 1;
        setMaxStreak((m) => Math.max(m, next));
        return next;
      });
      setStrongDistricts((prev) => Array.from(new Set([...prev, currentQ.targetDistrictName])));
      onQuizFeedback({ selectedDistrictId: selectedDistrictFromMap, isCorrect: true });
      districtWarService.addDistrictWarPoints(20, `Map Quiz: Identified ${currentQ.targetDistrictName} correctly`);
    } else {
      triggerHaptic("error");
      setStreak(0);
      setWeakDistricts((prev) => Array.from(new Set([...prev, currentQ.targetDistrictName])));
      onQuizFeedback({ selectedDistrictId: selectedDistrictFromMap, isCorrect: false });
    }
  }, [selectedDistrictFromMap]);

  const handleNextQuestion = () => {
    triggerHaptic("light");
    playClickSound();
    if (currentIndex + 1 >= questions.length) {
      setIsCompleted(true);
    } else {
      setCurrentIndex((prev) => prev + 1);
    }
  };

  const handleRestart = () => {
    triggerHaptic("medium");
    playClickSound();
    const shuffled = [...RAJASTHAN_MAP_QUIZ_QUESTIONS].sort(() => 0.5 - Math.random()).slice(0, 10);
    setQuestions(shuffled);
    setCurrentIndex(0);
    setScore(0);
    setStreak(0);
    setMaxStreak(0);
    setWeakDistricts([]);
    setStrongDistricts([]);
    setIsCompleted(false);
  };

  // ================= QUIZ COMPLETE REPORT =================
  if (isCompleted) {
    const accuracy = questions.length > 0 ? Math.round((strongDistricts.length / questions.length) * 100) : 0;
    return (
      <div className="p-3 sm:p-5 bg-white dark:bg-[#1E222D] rounded-2xl border border-[#C99A45]/40 shadow-xl text-center space-y-3 animate-in zoom-in-95 duration-150">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#800020] to-[#F47B20] text-white flex items-center justify-center mx-auto shadow-md">
          <Trophy className="w-6 h-6 text-[#FFF9EF] animate-bounce" />
        </div>

        <div>
          <h3 className="text-base sm:text-lg font-black text-[#800020] dark:text-[#F47B20]">
            Map Quiz Complete! 🏆
          </h3>
          <p className="text-[11px] text-[#52576A] dark:text-[#929AB0]">
            Rajasthan 41 Districts Geography Scorecard
          </p>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-3 gap-2 py-1 max-w-sm mx-auto">
          <div className="p-2 rounded-xl bg-[#FFF9EF] dark:bg-[#171923] border border-[#E8D9C0] dark:border-[#31374A]">
            <span className="text-[9px] font-bold text-[#52576A] dark:text-[#929AB0] block uppercase">Score</span>
            <span className="text-sm sm:text-base font-black text-[#800020] dark:text-[#F47B20] font-mono">{score}</span>
          </div>
          <div className="p-2 rounded-xl bg-[#FFF9EF] dark:bg-[#171923] border border-[#E8D9C0] dark:border-[#31374A]">
            <span className="text-[9px] font-bold text-[#52576A] dark:text-[#929AB0] block uppercase">Accuracy</span>
            <span className="text-sm sm:text-base font-black text-emerald-600 dark:text-emerald-400 font-mono">{accuracy}%</span>
          </div>
          <div className="p-2 rounded-xl bg-[#FFF9EF] dark:bg-[#171923] border border-[#E8D9C0] dark:border-[#31374A]">
            <span className="text-[9px] font-bold text-[#52576A] dark:text-[#929AB0] block uppercase">Streak 🔥</span>
            <span className="text-sm sm:text-base font-black text-amber-600 dark:text-amber-400 font-mono">{maxStreak}</span>
          </div>
        </div>

        {/* Weak Districts Callout */}
        {weakDistricts.length > 0 && (
          <div className="p-2 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300 text-[11px] text-left">
            <span className="font-bold">Districts to Review: </span>
            <span>{weakDistricts.join(", ")}</span>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 pt-1 max-w-sm mx-auto">
          <button
            type="button"
            onClick={handleRestart}
            className="flex-1 py-2 rounded-xl font-black text-xs bg-gradient-to-r from-[#800020] to-[#F47B20] text-white shadow-md flex items-center justify-center gap-1 active:scale-95 transition cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Play Again</span>
          </button>
          <button
            type="button"
            onClick={onExitQuiz}
            className="px-3 py-2 rounded-xl font-bold text-xs border border-[#E8D9C0] dark:border-[#31374A] hover:bg-stone-100 dark:hover:bg-stone-800 transition cursor-pointer"
          >
            View Map
          </button>
        </div>
      </div>
    );
  }

  if (!currentQ) return null;

  return (
    <div className="w-full bg-white dark:bg-[#181B26] rounded-xl sm:rounded-2xl border border-[#E8D9C0] dark:border-[#31374A] shadow-md p-2.5 sm:p-3.5 space-y-2">
      {/* ================= COMPACT STATUS BAR ================= */}
      <div className="flex items-center justify-between text-xs gap-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="px-2 py-0.5 rounded-full bg-[#800020]/10 dark:bg-[#800020]/30 text-[#800020] dark:text-[#F47B20] text-[10px] font-black">
            {currentIndex + 1} / {questions.length}
          </span>
          <span className="text-[10px] text-[#52576A] dark:text-[#929AB0] hidden xs:inline">
            • {currentQ.category === "new_formation" ? "2023 Reorganization" : currentQ.category === "geography_nature" ? "Geography & Rivers" : "Forts & Heritage"}
          </span>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {/* Streak */}
          <span className="flex items-center gap-0.5 text-amber-600 dark:text-amber-400 font-black text-[11px]">
            <Flame className="w-3.5 h-3.5 fill-current" />
            <span>{streak}</span>
          </span>

          {/* Score */}
          <span className="flex items-center gap-0.5 text-emerald-600 dark:text-emerald-400 font-black text-[11px]">
            <Trophy className="w-3.5 h-3.5" />
            <span>{score}</span>
          </span>

          {/* Timer */}
          <span
            className={`flex items-center gap-1 font-mono font-black text-[11px] px-1.5 py-0.5 rounded-md ${
              timeRemainingSec <= 5
                ? "bg-red-500 text-white animate-pulse"
                : "bg-stone-100 dark:bg-stone-800 text-[#171923] dark:text-[#FFF9EF]"
            }`}
          >
            <Clock className="w-3 h-3" />
            <span>{timeRemainingSec}s</span>
          </span>

          {/* Minimize / Expand Toggle */}
          <button
            type="button"
            onClick={() => setIsMinimized(!isMinimized)}
            className="w-6 h-6 rounded-md bg-stone-100 dark:bg-stone-800 text-stone-500 flex items-center justify-center hover:text-stone-800 dark:hover:text-stone-200 transition"
            title={isMinimized ? "Expand" : "Collapse"}
          >
            {isMinimized ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* ================= QUESTION PROMPT ================= */}
      {!isMinimized && (
        <div className="p-2 sm:p-2.5 rounded-xl bg-gradient-to-r from-[#800020]/8 via-[#F47B20]/8 to-transparent border border-[#C99A45]/30">
          <div className="flex items-center justify-between gap-1 mb-0.5">
            <span className="text-[9px] font-black uppercase tracking-wider text-[#800020] dark:text-[#F47B20] flex items-center gap-1">
              <Zap className="w-3 h-3 fill-current" />
              Tap the correct district on map
            </span>

            {/* Hint Button */}
            {!showHint && (
              <button
                type="button"
                onClick={() => setShowHint(true)}
                className="text-[10px] font-bold text-amber-600 dark:text-amber-400 hover:underline flex items-center gap-0.5"
              >
                <span>💡 Hint</span>
              </button>
            )}
          </div>

          <h4 className="font-extrabold text-xs sm:text-sm text-[#171923] dark:text-[#FFF9EF] leading-snug">
            {currentQ.prompt}
          </h4>

          {showHint && (
            <p className="text-[11px] text-amber-700 dark:text-amber-300 font-medium mt-1 bg-amber-50 dark:bg-amber-950/30 p-1.5 rounded-lg border border-amber-200 dark:border-amber-800/50">
              💡 {currentQ.hint}
            </p>
          )}
        </div>
      )}

      {/* ================= ANSWER FEEDBACK NOTIFICATION ================= */}
      {hasAnswered && (
        <div
          className={`p-2 sm:p-2.5 rounded-xl border text-xs animate-in fade-in duration-150 flex items-center justify-between gap-2 ${
            lastAnswerCorrect
              ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 text-emerald-900 dark:text-emerald-200"
              : "bg-rose-50 dark:bg-rose-950/40 border-rose-300 text-rose-900 dark:text-rose-200"
          }`}
        >
          <div className="flex items-start gap-1.5 min-w-0 flex-1">
            {lastAnswerCorrect ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            ) : (
              <XCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            )}
            <div className="min-w-0">
              <div className="font-black text-xs truncate">
                {lastAnswerCorrect ? "Spot on! Correct! 🎉" : `Incorrect! Correct was: ${currentQ.targetDistrictName}`}
              </div>
              <p className="text-[10px] opacity-85 line-clamp-1">{currentQ.explanation}</p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleNextQuestion}
            className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-[#800020] to-[#F47B20] text-white font-black text-xs shrink-0 flex items-center gap-1 shadow-md hover:brightness-110 active:scale-95 transition cursor-pointer"
          >
            <span>Next</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
};
