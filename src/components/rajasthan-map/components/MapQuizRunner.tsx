import React, { useState, useEffect } from "react";
import { MapQuizQuestion, MapQuizSessionResult } from "../types";
import { RAJASTHAN_MAP_QUIZ_QUESTIONS } from "../data/mapQuizQuestions";
import { RAJASTHAN_50_DISTRICTS } from "../data/districtsData";
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
  Award,
  Zap,
} from "lucide-react";
import { triggerHaptic, playClickSound } from "../../../utils/audioFeedback";

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
  const [startTime] = useState<number>(Date.now());

  // Initialize random 10 questions
  useEffect(() => {
    const shuffled = [...RAJASTHAN_MAP_QUIZ_QUESTIONS].sort(() => 0.5 - Math.random()).slice(0, 10);
    setQuestions(shuffled);
    setCurrentIndex(0);
    setScore(0);
    setStreak(0);
    setIsCompleted(false);
  }, []);

  // Set current target
  const currentQ = questions[currentIndex];

  useEffect(() => {
    if (currentQ) {
      onSelectTargetForMap(currentQ.targetDistrictId);
      setTimeRemainingSec(30);
      setHasAnswered(false);
      setLastAnswerCorrect(null);
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
    setWeakDistricts([]);
    setStrongDistricts([]);
    setIsCompleted(false);
  };

  if (isCompleted) {
    const accuracy = Math.round((score / 150) * 100);
    return (
      <div className="p-6 bg-white dark:bg-[#1E222D] rounded-3xl border-2 border-[#C99A45]/40 shadow-2xl text-center space-y-5 animate-in zoom-in-95 duration-200">
        <div className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-[#800020] to-[#F47B20] text-white flex items-center justify-center mx-auto shadow-xl">
          <Trophy className="w-8 h-8 text-[#FFF9EF] animate-bounce" />
        </div>

        <div>
          <h3 className="text-2xl font-black text-[#800020] dark:text-[#F47B20]">मैप क्विज़ पूर्ण! 🏆</h3>
          <p className="text-xs text-stone-500 dark:text-stone-400 mt-1">राजस्थान 50 ज़िला भूगोल रिपोर्ट कार्ड</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-3 gap-3">
          <div className="p-3 bg-[#800020]/10 dark:bg-[#800020]/20 rounded-2xl border border-[#800020]/20">
            <div className="text-[10px] font-bold text-stone-500 uppercase">कुल स्कोर</div>
            <div className="text-xl font-black text-[#800020] dark:text-[#F47B20]">{score}</div>
          </div>
          <div className="p-3 bg-amber-500/10 dark:bg-amber-500/20 rounded-2xl border border-amber-500/20">
            <div className="text-[10px] font-bold text-stone-500 uppercase">अधिकतम स्ट्रीक</div>
            <div className="text-xl font-black text-amber-600 dark:text-amber-400 flex items-center justify-center gap-1">
              <Flame className="w-4 h-4 fill-current" />
              {maxStreak}
            </div>
          </div>
          <div className="p-3 bg-emerald-500/10 dark:bg-emerald-500/20 rounded-2xl border border-emerald-500/20">
            <div className="text-[10px] font-bold text-stone-500 uppercase">सटीकता</div>
            <div className="text-xl font-black text-emerald-600 dark:text-emerald-400">
              {Math.min(accuracy, 100)}%
            </div>
          </div>
        </div>

        {/* Strong & Weak Areas */}
        <div className="text-left space-y-2 text-xs">
          {strongDistricts.length > 0 && (
            <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300">
              <strong>मजबूत ज़िले:</strong> {strongDistricts.join(", ")}
            </div>
          )}
          {weakDistricts.length > 0 && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300">
              <strong>पुनः अभ्यास योग्य ज़िले:</strong> {weakDistricts.join(", ")}
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 pt-2">
          <button
            onClick={handleRestart}
            className="flex-1 py-3 rounded-xl font-black text-xs bg-gradient-to-r from-[#800020] to-[#F47B20] text-white shadow-lg flex items-center justify-center gap-1.5 active:scale-95 transition"
          >
            <RotateCcw className="w-4 h-4" />
            <span>पुनः खेलें</span>
          </button>
          <button
            onClick={onExitQuiz}
            className="px-5 py-3 rounded-xl font-bold text-xs border border-stone-300 dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-800 transition"
          >
            बाहर निकलें
          </button>
        </div>
      </div>
    );
  }

  if (!currentQ) return null;

  return (
    <div className="p-4 sm:p-5 bg-white dark:bg-[#1E222D] rounded-3xl border-2 border-[#C99A45]/40 shadow-xl space-y-3.5 animate-in fade-in">
      {/* Top Header: Progress & Score Bar */}
      <div className="flex items-center justify-between text-xs font-bold text-stone-600 dark:text-stone-300">
        <span className="px-2.5 py-1 bg-[#800020]/10 dark:bg-[#800020]/25 text-[#800020] dark:text-[#F47B20] rounded-full">
          प्रश्न {currentIndex + 1} / {questions.length}
        </span>

        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400 font-extrabold">
            <Flame className="w-4 h-4 fill-current" />
            {streak}
          </span>
          <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-extrabold">
            <Trophy className="w-4 h-4" />
            {score} अंक
          </span>
          <span
            className={`flex items-center gap-1 font-mono font-extrabold px-2 py-0.5 rounded-md ${
              timeRemainingSec <= 5 ? "bg-red-500 text-white animate-pulse" : "bg-stone-100 dark:bg-stone-800"
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            {timeRemainingSec}s
          </span>
        </div>
      </div>

      {/* Question Prompt Box */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-[#800020]/10 via-[#F47B20]/10 to-transparent border border-[#C99A45]/40">
        <div className="text-[10px] font-black uppercase tracking-wider text-[#800020] dark:text-[#F47B20] mb-1 flex items-center gap-1">
          <Zap className="w-3.5 h-3.5 fill-current" />
          नक्शे पर सही ज़िला स्पर्श करें
        </div>
        <h4 className="font-extrabold text-sm sm:text-base leading-snug text-[#171923] dark:text-[#FFF9EF]">
          {currentQ.prompt}
        </h4>
        <p className="text-xs text-stone-500 dark:text-stone-400 mt-1 italic">
          💡 संकेत: {currentQ.hint}
        </p>
      </div>

      {/* Answer Feedback Banner */}
      {hasAnswered && (
        <div
          className={`p-3.5 rounded-2xl border text-xs leading-relaxed animate-in fade-in duration-200 flex items-start gap-2.5 ${
            lastAnswerCorrect
              ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 text-emerald-900 dark:text-emerald-200"
              : "bg-rose-50 dark:bg-rose-950/40 border-rose-300 text-rose-900 dark:text-rose-200"
          }`}
        >
          {lastAnswerCorrect ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          ) : (
            <XCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          )}
          <div className="flex-1">
            <div className="font-black text-sm mb-0.5">
              {lastAnswerCorrect ? "बिल्कुल सही उत्तर! 🎉" : `गलत उत्तर! सही ज़िला: ${currentQ.targetDistrictName}`}
            </div>
            <p className="font-medium text-[11px] opacity-90">{currentQ.explanation}</p>
          </div>
          <button
            onClick={handleNextQuestion}
            className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-[#800020] to-[#F47B20] text-white font-bold text-xs shrink-0 flex items-center gap-1 shadow-md hover:brightness-110 active:scale-95 transition"
          >
            <span>अगला</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
};
