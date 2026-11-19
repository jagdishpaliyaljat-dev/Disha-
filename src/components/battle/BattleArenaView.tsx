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
import { BattleAvatar } from "./BattleAvatar";

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
    <div className="flex flex-col h-full bg-[#FFFDF9] dark:bg-[#171923] text-stone-900 dark:text-[#FFF9EF] select-none overflow-hidden relative">
      {/* Top Royal HUD */}
      <div className="bg-gradient-to-r from-[#5E0017] via-[#800020] to-[#5E0017] text-white px-4 pt-3 pb-2 shadow-md border-b border-amber-400/20">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-extrabold px-2.5 py-0.5 rounded-full bg-amber-400/20 text-amber-300 border border-amber-300/30">
              Question {questionIndex + 1} / {totalQuestions}
            </span>
            {question.category && (
              <span className="text-[11px] font-semibold text-amber-100/80 capitalize bg-white/10 px-2 py-0.5 rounded-full">
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
            className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/15 hover:bg-white/25 active:scale-95 transition text-xs font-bold text-amber-300 border border-amber-300/40 shadow-xs"
          >
            <Trophy className="w-3.5 h-3.5 text-amber-300" />
            <span>My Rank: #{myRank}</span>
            <span className="text-white/60">({players.length})</span>
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
                    ? "bg-amber-400/25 border-amber-300 font-extrabold shadow-xs"
                    : "bg-white/10 border-white/10 font-medium"
                }`}
              >
                <span className="text-[10px] text-amber-300 font-bold">
                  #{idx + 1}
                </span>
                <div className="relative inline-flex items-center">
                  <BattleAvatar avatar={player.avatar} name={player.name} size="sm" />
                  {player.lastAnswer?.questionIndex === questionIndex && (
                    <span
                      className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-400 rounded-full border border-stone-900 ring-1 ring-emerald-300 shadow-xs"
                      title="Answer locked"
                    />
                  )}
                </div>
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
              +{sortedPlayers.length - 8} more
            </button>
          )}
        </div>

        {/* Progress Bar with Amber Glow */}
        <div className="w-full bg-black/30 h-1.5 rounded-full mt-2 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-amber-400 to-amber-300 transition-all duration-300 shadow-[0_0_8px_rgba(245,158,11,0.6)]"
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
          <div className="flex flex-col items-center justify-center my-1">
            <div className="relative w-16 h-16 flex items-center justify-center">
              <svg className="w-full h-full transform -rotate-90 drop-shadow-sm">
                <circle
                  cx="32"
                  cy="32"
                  r={radius}
                  className="stroke-stone-200 dark:stroke-stone-700"
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
                      : "text-stone-800 dark:text-[#FFF9EF]"
                  }`}
                >
                  {timeRemainingSec}
                </span>
              </div>
            </div>

            <span className="text-[10px] font-bold text-stone-500 dark:text-stone-400 mt-1 flex items-center gap-1">
              <span>⚡ Faster Answer = More Points</span>
            </span>
          </div>

          {/* Question Text Card */}
          <div className="bg-white dark:bg-[#1F2330] rounded-3xl p-4 sm:p-5 shadow-sm border border-amber-900/10 dark:border-[#31374A] mt-2">
            <h3 className="text-base sm:text-lg font-bold text-stone-800 dark:text-[#FFF9EF] leading-relaxed text-center">
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
              "bg-white dark:bg-[#1F2330] border-stone-200/90 dark:border-[#31374A] text-stone-800 dark:text-[#FFF9EF] hover:border-amber-400 shadow-xs";
            let badgeStyle = "bg-stone-100 dark:bg-[#252A3A] text-stone-700 dark:text-stone-300 border border-stone-200 dark:border-[#31374A]";

            if (isRevealing) {
              if (isCorrect) {
                buttonStyle =
                  "bg-gradient-to-r from-emerald-50 to-emerald-100/60 dark:from-emerald-950/40 dark:to-emerald-900/40 border-2 border-emerald-500 text-emerald-950 dark:text-emerald-200 ring-2 ring-emerald-400 font-extrabold shadow-md";
                badgeStyle = "bg-emerald-600 text-white border-emerald-600";
              } else if (isSelected && !isCorrect) {
                buttonStyle =
                  "bg-red-50 dark:bg-red-950/40 border-2 border-red-500 text-red-950 dark:text-red-200 ring-1 ring-red-300 line-through opacity-85";
                badgeStyle = "bg-red-600 text-white border-red-600";
              } else {
                buttonStyle = "bg-stone-50 dark:bg-stone-900/40 border-stone-200 dark:border-stone-800 text-stone-400 dark:text-stone-500 opacity-60";
              }
            } else if (isSelected) {
              buttonStyle =
                "bg-amber-50/90 dark:bg-amber-950/40 border-2 border-[#800020] dark:border-amber-400 text-[#800020] dark:text-amber-300 ring-2 ring-amber-400 font-extrabold shadow-md";
              badgeStyle = "bg-[#800020] dark:bg-amber-500 text-white dark:text-stone-950 border-[#800020] dark:border-amber-500";
            }

            return (
              <button
                key={idx}
                type="button"
                disabled={hasLockedAnswer || isRevealing}
                onClick={() => onSelectOption(idx)}
                className={`w-full flex items-center justify-between p-3.5 sm:p-4 rounded-2xl border-2 transition-all active:scale-98 text-left ${buttonStyle}`}
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`w-8 h-8 flex-shrink-0 rounded-xl flex items-center justify-center font-bold text-xs ${badgeStyle}`}
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
                    <span className="text-[11px] font-bold text-[#800020] dark:text-amber-300 bg-amber-200/90 dark:bg-amber-950/60 px-2.5 py-0.5 rounded-full border border-amber-300 dark:border-amber-600">
                      Locked ✓
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
              className="w-9 h-9 flex items-center justify-center text-lg rounded-2xl bg-white dark:bg-[#1F2330] shadow-xs border border-stone-200 dark:border-[#31374A] hover:bg-amber-50 dark:hover:bg-[#252A3A] active:scale-125 transition"
            >
              {emoji}
            </button>
          ))}
        </div>
      </div>

      {/* Reveal Overlay Footer */}
      {isRevealing && (
        <div className="bg-white dark:bg-[#1F2330] border-t border-stone-200 dark:border-[#31374A] p-4 shadow-xl animate-in slide-in-from-bottom-2 duration-200">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              {selectedOption === question.correctIndex ? (
                <span className="flex items-center gap-1 text-sm font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-950/60 px-3 py-1 rounded-full border border-emerald-200 dark:border-emerald-800">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Great Job! Correct (+{myPlayer?.lastAnswer?.pointsEarned || 100})</span>
                </span>
              ) : (
                <span className="flex items-center gap-1 text-sm font-bold text-red-700 dark:text-red-300 bg-red-100 dark:bg-red-950/60 px-3 py-1 rounded-full border border-red-200 dark:border-red-800">
                  <XCircle className="w-4 h-4" />
                  <span>Incorrect (+0 pts)</span>
                </span>
              )}
            </div>

            <span className="text-xs font-semibold text-stone-500 dark:text-stone-400">
              Next question incoming...
            </span>
          </div>

          {question.explanation && (
            <div className="bg-amber-50/60 dark:bg-amber-950/40 p-2.5 rounded-2xl border border-amber-200/70 dark:border-amber-800/50 text-xs text-stone-700 dark:text-stone-200 flex items-start gap-2">
              <HelpCircle className="w-4 h-4 text-[#800020] dark:text-amber-400 flex-shrink-0 mt-0.5" />
              <span>{question.explanation}</span>
            </div>
          )}
        </div>
      )}

      {/* Slide-over Modal for All Players' Live Ranking */}
      {showAllRanks && (
        <div className="absolute inset-0 z-40 bg-black/60 backdrop-blur-xs flex flex-col justify-end">
          <div className="bg-white dark:bg-[#1F2330] rounded-t-3xl max-h-[75%] flex flex-col overflow-hidden shadow-2xl border-t border-stone-200 dark:border-[#31374A]">
            <div className="p-4 bg-gradient-to-r from-[#5E0017] via-[#800020] to-[#5E0017] text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Trophy className="w-5 h-5 text-amber-300" />
                <h3 className="text-sm font-bold">
                  Live Leaderboard ({sortedPlayers.length} Players)
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
                    className={`flex items-center justify-between p-2.5 rounded-2xl border transition ${
                      isMe
                        ? "bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-400/60 font-bold ring-1 ring-amber-400/40"
                        : "bg-stone-50 dark:bg-[#252A3A] border-stone-200 dark:border-[#31374A]"
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="w-6 text-center text-xs font-bold text-stone-500 dark:text-stone-400">
                        #{idx + 1}
                      </span>
                      <BattleAvatar avatar={p.avatar} name={p.name} size="md" />
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-stone-800 dark:text-[#FFF9EF]">
                            {p.name}
                          </span>
                          {isMe && (
                            <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-[#800020] text-white">
                              You
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="text-right flex items-center gap-2">
                      {p.streak >= 2 && (
                        <span className="text-[10px] text-orange-500 dark:text-orange-400 font-bold flex items-center gap-0.5">
                          <Flame className="w-3 h-3 fill-current" />
                          {p.streak}
                        </span>
                      )}
                      <span className="text-sm font-black text-[#800020] dark:text-amber-400">
                        {p.score} pts
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
