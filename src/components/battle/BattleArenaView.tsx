import React, { useState } from "react";
import {
  Timer,
  Flame,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Sparkles,
  Trophy,
  Users,
  X,
} from "lucide-react";
import type { BattlePlayer, BattleQuestion } from "./types";
import { triggerHaptic, playClickSound } from "../../utils/audioFeedback";

interface BattleArenaViewProps {
  question: BattleQuestion;
  questionIndex: number;
  totalQuestions: number;
  timeRemainingSec: number;
  maxTimeSec: number;
  players: BattlePlayer[];
  myPlayerId: string;
  selectedOption: number | null;
  hasLockedAnswer: boolean;
  isRevealing: boolean;
  onSelectOption: (optionIndex: number) => void;
  onSendEmoji: (emoji: string) => void;
}

const OPTION_LETTERS = ["A", "B", "C", "D"];
const QUICK_EMOJIS = ["🔥", "🎯", "⚡", "👏", "🤯"];

export const BattleArenaView: React.FC<BattleArenaViewProps> = ({
  question,
  questionIndex,
  totalQuestions,
  timeRemainingSec,
  maxTimeSec,
  players,
  myPlayerId,
  selectedOption,
  hasLockedAnswer,
  isRevealing,
  onSelectOption,
  onSendEmoji,
}) => {
  const [showAllRanks, setShowAllRanks] = useState(false);
  const myPlayer = players.find((p) => p.id === myPlayerId);

  // Sorted players by score for live ranking
  const sortedPlayers = [...players].sort((a, b) => b.score - a.score);
  const myRank = sortedPlayers.findIndex((p) => p.id === myPlayerId) + 1;

  // Timer calculation
  const timeFraction = Math.max(0, Math.min(1, timeRemainingSec / maxTimeSec));
  const radius = 26;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - timeFraction * circumference;

  let timerColor = "#10B981"; // Emerald
  if (timeRemainingSec <= 3) {
    timerColor = "#EF4444"; // Red
  } else if (timeRemainingSec <= 6) {
    timerColor = "#F59E0B"; // Amber
  }

  return (
    <div className="flex flex-col h-full bg-[#FFF9EF] text-stone-900 select-none overflow-hidden relative">
      {/* Top HUD: Progress & Live Scoreboard */}
      <div className="bg-[#800020] text-white px-4 pt-3 pb-2 shadow-md">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-white/20 text-amber-300">
              प्रश्न {questionIndex + 1} / {totalQuestions}
            </span>
            {question.category && (
              <span className="text-[11px] font-semibold text-stone-200 capitalize">
                {question.category}
              </span>
            )}
          </div>

          <button
            onClick={() => {
              triggerHaptic("light");
              playClickSound();
              setShowAllRanks(true);
            }}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/15 hover:bg-white/25 active:scale-95 transition text-xs font-bold text-amber-300 border border-amber-300/30"
          >
            <Trophy className="w-3.5 h-3.5" />
            <span>मेरी रैंक: #{myRank}</span>
            <span className="text-white/70">({players.length})</span>
          </button>
        </div>

        {/* Live Mini Leaderboard Strip */}
        <div className="flex items-center gap-2 overflow-x-auto py-1 scrollbar-none">
          {sortedPlayers.slice(0, 8).map((player, idx) => {
            const isMe = player.id === myPlayerId;
            return (
              <div
                key={player.id}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs whitespace-nowrap transition border ${
                  isMe
                    ? "bg-white/25 border-amber-300 font-bold"
                    : "bg-white/10 border-white/10 font-medium"
                }`}
              >
                <span className="text-[10px] text-amber-300 font-bold">
                  #{idx + 1}
                </span>
                <span className="text-sm">{player.avatar}</span>
                <span className="max-w-[70px] truncate text-xs">
                  {player.name}
                </span>
                <span className="text-amber-200 font-bold ml-1">
                  {player.score}
                </span>
                {player.streak >= 2 && (
                  <span className="flex items-center text-[10px] text-orange-400 font-bold">
                    <Flame className="w-3 h-3 fill-current inline" />
                    {player.streak}
                  </span>
                )}
              </div>
            );
          })}

          {sortedPlayers.length > 8 && (
            <button
              onClick={() => setShowAllRanks(true)}
              className="text-xs font-bold text-amber-300 px-2 py-1 rounded-lg bg-white/10 hover:bg-white/20 whitespace-nowrap"
            >
              +{sortedPlayers.length - 8} और
            </button>
          )}
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-black/20 h-1 rounded-full mt-2 overflow-hidden">
          <div
            className="h-full bg-amber-400 transition-all duration-300"
            style={{
              width: `${((questionIndex + 1) / totalQuestions) * 100}%`,
            }}
          />
        </div>
      </div>

      {/* Main Arena Area */}
      <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col justify-between">
        {/* Timer & Question Box */}
        <div>
          {/* Circular Countdown Timer (10 Seconds Fast Reflex) */}
          <div className="flex justify-center my-1">
            <div className="relative w-16 h-16 flex items-center justify-center">
              <svg className="w-full h-full transform -rotate-90">
                <circle
                  cx="32"
                  cy="32"
                  r={radius}
                  className="stroke-stone-200"
                  strokeWidth="4"
                  fill="transparent"
                />
                <circle
                  cx="32"
                  cy="32"
                  r={radius}
                  stroke={timerColor}
                  strokeWidth="4"
                  fill="transparent"
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeDashoffset}
                  strokeLinecap="round"
                  className="transition-all duration-300"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span
                  className={`text-xl font-extrabold font-mono transition-transform ${
                    timeRemainingSec <= 3
                      ? "scale-125 text-red-600 animate-pulse font-black"
                      : "text-stone-800"
                  }`}
                >
                  {timeRemainingSec}
                </span>
              </div>
            </div>
          </div>

          {/* Question Text */}
          <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-sm border border-stone-200 mt-2">
            <h3 className="text-base sm:text-lg font-bold text-stone-800 leading-relaxed text-center">
              {question.text}
            </h3>
          </div>
        </div>

        {/* Options Grid */}
        <div className="space-y-2.5 my-3">
          {question.options.map((option, idx) => {
            const isSelected = selectedOption === idx;
            const isCorrect = idx === question.correctIndex;

            let buttonStyle =
              "bg-white border-stone-200 text-stone-800 hover:border-amber-400";
            let badgeStyle = "bg-stone-100 text-stone-700";

            if (isRevealing) {
              if (isCorrect) {
                buttonStyle =
                  "bg-emerald-50 border-emerald-500 text-emerald-950 ring-2 ring-emerald-400 font-bold";
                badgeStyle = "bg-emerald-600 text-white";
              } else if (isSelected && !isCorrect) {
                buttonStyle =
                  "bg-red-50 border-red-500 text-red-950 ring-1 ring-red-300 line-through opacity-85";
                badgeStyle = "bg-red-600 text-white";
              } else {
                buttonStyle = "bg-stone-50 border-stone-200 text-stone-400 opacity-60";
              }
            } else if (isSelected) {
              buttonStyle =
                "bg-amber-50 border-[#800020] text-[#800020] ring-2 ring-amber-400 font-bold shadow-md";
              badgeStyle = "bg-[#800020] text-white";
            }

            return (
              <button
                key={idx}
                type="button"
                disabled={hasLockedAnswer || isRevealing}
                onClick={() => onSelectOption(idx)}
                className={`w-full flex items-center justify-between p-3.5 rounded-xl border-2 transition-all active:scale-98 text-left ${buttonStyle}`}
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`w-7 h-7 flex-shrink-0 rounded-lg flex items-center justify-center font-bold text-xs ${badgeStyle}`}
                  >
                    {OPTION_LETTERS[idx]}
                  </span>
                  <span className="text-sm font-semibold">{option}</span>
                </div>

                {/* Status Indicator Icon */}
                <div>
                  {isRevealing ? (
                    isCorrect ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    ) : isSelected ? (
                      <XCircle className="w-5 h-5 text-red-500" />
                    ) : null
                  ) : isSelected ? (
                    <span className="text-[11px] font-bold text-[#800020] bg-amber-200/80 px-2 py-0.5 rounded-full">
                      लॉक किया गया ✓
                    </span>
                  ) : null}
                </div>
              </button>
            );
          })}
        </div>

        {/* Floating Quick Reaction Emojis during arena */}
        <div className="flex items-center justify-center gap-2 py-1">
          {QUICK_EMOJIS.map((emoji) => (
            <button
              key={emoji}
              onClick={() => onSendEmoji(emoji)}
              className="w-9 h-9 flex items-center justify-center text-lg rounded-full bg-white shadow-xs border border-stone-200 hover:bg-amber-50 active:scale-125 transition"
            >
              {emoji}
            </button>
          ))}
        </div>
      </div>

      {/* Reveal Overlay Footer */}
      {isRevealing && (
        <div className="bg-white border-t border-stone-200 p-4 shadow-xl animate-in slide-in-from-bottom-2 duration-200">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              {selectedOption === question.correctIndex ? (
                <span className="flex items-center gap-1 text-sm font-bold text-emerald-700 bg-emerald-100 px-2.5 py-0.5 rounded-full">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>शाबाश! सही उत्तर (+{myPlayer?.lastAnswer?.pointsEarned || 100})</span>
                </span>
              ) : (
                <span className="flex items-center gap-1 text-sm font-bold text-red-700 bg-red-100 px-2.5 py-0.5 rounded-full">
                  <XCircle className="w-4 h-4" />
                  <span>गलत उत्तर (+0 अंक)</span>
                </span>
              )}
            </div>

            <span className="text-xs font-semibold text-stone-500">
              अगला प्रश्न आ रहा है...
            </span>
          </div>

          {question.explanation && (
            <div className="bg-stone-50 p-2.5 rounded-xl border border-stone-200 text-xs text-stone-700 flex items-start gap-2">
              <HelpCircle className="w-4 h-4 text-stone-500 flex-shrink-0 mt-0.5" />
              <span>{question.explanation}</span>
            </div>
          )}
        </div>
      )}

      {/* Slide-over Modal for All Players' Live Ranking */}
      {showAllRanks && (
        <div className="absolute inset-0 z-40 bg-black/60 backdrop-blur-xs flex flex-col justify-end">
          <div className="bg-white rounded-t-3xl max-h-[75%] flex flex-col overflow-hidden shadow-2xl border-t border-stone-200">
            <div className="p-4 bg-[#800020] text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Trophy className="w-5 h-5 text-amber-300" />
                <h3 className="text-sm font-bold">
                  लाइव लीडरबोर्ड ({sortedPlayers.length} खिलाड़ी)
                </h3>
              </div>
              <button
                onClick={() => setShowAllRanks(false)}
                className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 active:scale-95"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 overflow-y-auto space-y-2 flex-1">
              {sortedPlayers.map((p, idx) => {
                const isMe = p.id === myPlayerId;
                return (
                  <div
                    key={p.id}
                    className={`flex items-center justify-between p-2.5 rounded-xl border ${
                      isMe
                        ? "bg-amber-50 border-amber-300 font-bold"
                        : "bg-stone-50 border-stone-200"
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="w-6 text-center text-xs font-bold text-stone-500">
                        #{idx + 1}
                      </span>
                      <span className="text-xl">{p.avatar}</span>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-stone-800">
                            {p.name}
                          </span>
                          {isMe && (
                            <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-[#800020] text-white">
                              आप
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="text-right flex items-center gap-2">
                      {p.streak >= 2 && (
                        <span className="text-[10px] text-orange-500 font-bold flex items-center gap-0.5">
                          <Flame className="w-3 h-3 fill-current" />
                          {p.streak}
                        </span>
                      )}
                      <span className="text-sm font-black text-[#800020]">
                        {p.score} अंक
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
