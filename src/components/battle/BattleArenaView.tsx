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
import { getCombinedSubjects } from "../../utils/questionsStorage";

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

/**
 * Formats a clean human-readable category/subject label,
 * eliminating raw database IDs like "Subj-1793126120889-Ojzu2".
 */
export function formatCategoryLabel(category?: string): string {
  if (!category || category === "all" || category === "General" || category.toLowerCase() === "all") {
    return "राजस्थान ज्ञान";
  }
  // Check if it's a raw database ID like Subj-... or ch-... or top-...
  if (/^(Subj|ch|top|q|test)-/i.test(category)) {
    try {
      const subjects = getCombinedSubjects();
      const match = subjects.find((s) => s.id === category);
      if (match && match.title) return match.title;
    } catch {
      // safe fallback
    }
    return "राजस्थान ज्ञान";
  }
  return category;
}

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
    <div className="flex flex-col h-full bg-[#F8FAFC] dark:bg-[#130E26] text-slate-900 dark:text-slate-50 select-none overflow-hidden relative">
      {/* 1. TOP BRAND HUD: Minimal Royal Glass Header */}
      <div className="bg-gradient-to-r from-[#4A154B] via-[#7045D8] to-[#5B32BF] dark:from-[#1E1238] dark:via-[#2D1B54] dark:to-[#1B1536] text-white px-3.5 sm:px-5 pt-3 pb-2.5 shadow-md border-b border-white/10 shrink-0 select-none">
        {/* Top Info Bar */}
        <div className="flex items-center justify-between gap-2 mb-2.5">
          <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
            {/* Question Counter Pill */}
            <span className="text-[11px] sm:text-xs font-black font-mono px-3 py-1 rounded-full bg-white/15 backdrop-blur-md text-white border border-white/20 shadow-xs tabular-nums uppercase tracking-wider shrink-0">
              Q {questionIndex + 1} / {totalQuestions}
            </span>

            {/* Clean Category Badge (No raw Subj- IDs!) */}
            <span className="text-[11px] font-bold text-amber-200/95 font-hindi bg-amber-400/15 backdrop-blur-md px-2.5 py-1 rounded-full border border-amber-300/30 truncate max-w-[140px] sm:max-w-xs shadow-xs">
              {formatCategoryLabel(question.category)}
            </span>
          </div>

          {/* My Live Rank Button */}
          <button
            type="button"
            onClick={() => {
              triggerHaptic("light");
              playClickSound();
              setShowAllRanks(true);
            }}
            className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-gradient-to-r from-amber-400/20 to-amber-500/30 hover:from-amber-400/30 hover:to-amber-500/40 active:scale-95 transition text-[11px] sm:text-xs font-black text-amber-300 border border-amber-300/40 shadow-xs cursor-pointer shrink-0"
            title="View Live Leaderboard"
          >
            <Trophy className="w-3.5 h-3.5 text-amber-300 shrink-0" />
            <span>Rank #{myRank}</span>
            <span className="text-amber-200/60 font-mono text-[10px]">({players.length})</span>
          </button>
        </div>

        {/* Live Mini Leaderboard Strip */}
        <div className="flex items-center gap-2 overflow-x-auto py-1 scrollbar-none no-scrollbar">
          {sortedPlayers.slice(0, 8).map((player, idx) => {
            const isMe = player.id === myPlayerId;
            const isFirst = idx === 0;
            return (
              <div
                key={player.id}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs whitespace-nowrap transition-all duration-200 border shrink-0 ${
                  isMe
                    ? "bg-amber-400 text-stone-950 border-amber-300 font-black shadow-md shadow-amber-500/20 ring-2 ring-amber-400/30"
                    : "bg-white/10 backdrop-blur-md border-white/15 text-white/95 font-semibold"
                }`}
              >
                <span className={`text-[10px] font-black font-mono ${isMe ? "text-stone-900" : isFirst ? "text-amber-300" : "text-white/60"}`}>
                  #{idx + 1}
                </span>

                <div className="relative inline-flex items-center">
                  <BattleAvatar avatar={player.avatar} name={player.name} size="sm" />
                  {player.lastAnswer?.questionIndex === questionIndex && (
                    <span
                      className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-400 rounded-full border border-stone-900 ring-1 ring-emerald-300 shadow-xs animate-pulse"
                      title="Answer locked"
                    />
                  )}
                </div>

                <span className="max-w-[70px] sm:max-w-[85px] truncate text-xs">
                  {player.name}
                </span>

                <span className={`font-mono font-black text-xs ${isMe ? "text-stone-950" : "text-amber-300"}`}>
                  {player.score}
                </span>

                {player.streak >= 2 && (
                  <span className={`flex items-center text-[10px] font-black ${isMe ? "text-orange-950" : "text-orange-400"}`}>
                    <Flame className="w-3 h-3 fill-current inline" />
                    {player.streak}
                  </span>
                )}
              </div>
            );
          })}

          {sortedPlayers.length > 8 && (
            <button
              type="button"
              onClick={() => setShowAllRanks(true)}
              className="text-[11px] font-bold text-amber-300 px-2.5 py-1 rounded-full bg-white/10 hover:bg-white/20 whitespace-nowrap border border-white/15 cursor-pointer shrink-0"
            >
              +{sortedPlayers.length - 8} more
            </button>
          )}
        </div>

        {/* Sleek Gradient Progress Bar */}
        <div className="w-full bg-black/25 dark:bg-black/40 h-1.5 rounded-full mt-2 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-amber-400 via-[#A78BFA] to-white rounded-full transition-all duration-300 shadow-[0_0_10px_rgba(245,158,11,0.5)]"
            style={{
              width: `${((questionIndex + 1) / totalQuestions) * 100}%`,
            }}
          />
        </div>
      </div>

      {/* 2. MAIN BATTLE ARENA CANVAS */}
      <div className="flex-1 overflow-y-auto px-3.5 sm:px-6 py-3 sm:py-4 flex flex-col justify-between max-w-3xl mx-auto w-full">
        <div>
          {/* Circular Countdown Timer (Refined Minimal Design) */}
          <div className="flex flex-col items-center justify-center my-1.5 sm:my-2">
            <div className="relative w-16 h-16 sm:w-18 sm:h-18 flex items-center justify-center">
              <svg className="w-full h-full transform -rotate-90 drop-shadow-sm" viewBox="0 0 64 64">
                <circle
                  cx="32"
                  cy="32"
                  r={radius}
                  className="stroke-slate-200 dark:stroke-[#241D48]"
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
              <div className="absolute inset-0 flex flex-col items-center justify-center select-none">
                <span
                  className={`text-2xl sm:text-3xl font-black font-mono transition-transform ${
                    timeRemainingSec <= 3
                      ? "scale-110 text-rose-500 dark:text-rose-400 animate-pulse font-black"
                      : "text-slate-900 dark:text-white"
                  }`}
                >
                  {timeRemainingSec}
                </span>
              </div>
            </div>

            {/* Speed Bonus Pill */}
            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-600 dark:text-amber-400 mt-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20">
              <Sparkles className="w-3 h-3 text-amber-500 fill-current" />
              <span>Faster Answer = More Points</span>
            </span>
          </div>

          {/* Premium Question Text Card */}
          <div className="bg-white dark:bg-[#1B1536] rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-sm border border-slate-200/90 dark:border-[#31275E] mt-2 relative overflow-hidden">
            {/* Subtle Brand Accent line */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#7045D8] via-[#A78BFA] to-[#7045D8] opacity-75" />
            <h3 className="text-base sm:text-lg font-bold font-hindi text-slate-900 dark:text-slate-50 leading-relaxed text-center break-words [overflow-wrap:anywhere]">
              {question.text}
            </h3>
          </div>
        </div>

        {/* 3. MCQ OPTIONS TILES (Brand Colors, Tactile Minimal Polish) */}
        <div className="space-y-2.5 sm:space-y-3 my-3">
          {question.options.map((option, idx) => {
            const isSelected = selectedOption !== null && Number(selectedOption) === Number(idx);
            const isCorrect = Number(idx) === Number(question.correctIndex);

            // Clean leading redundant option prefixes like "A. " or "(1) "
            const cleanOption = String(option || "")
              .replace(/^(?:[A-Da-d1-4][\.\)\:\-]\s*|\([A-Da-d1-4]\)\s*|[क-घ][\.\)\:\-]\s*)/, "")
              .trim() || String(option || "");

            let cardStyles = "bg-white dark:bg-[#1B1536] border-slate-200 dark:border-[#31275E] text-slate-900 dark:text-slate-100 hover:border-[#7045D8]/50 hover:bg-[#7045D8]/5 shadow-xs";
            let badgeStyles = "bg-slate-100 dark:bg-[#241D48] text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-[#31275E]";

            if (isRevealing) {
              if (isCorrect) {
                cardStyles = "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-500 ring-2 ring-emerald-500/30 text-emerald-950 dark:text-emerald-100 font-black shadow-md shadow-emerald-500/10";
                badgeStyles = "bg-emerald-600 text-white border-emerald-600 shadow-sm shadow-emerald-600/30";
              } else if (isSelected && !isCorrect) {
                cardStyles = "bg-rose-50 dark:bg-rose-950/30 border-rose-500 ring-2 ring-rose-500/20 text-rose-950 dark:text-rose-100 font-bold line-through opacity-85";
                badgeStyles = "bg-rose-600 text-white border-rose-600 shadow-sm shadow-rose-600/30";
              } else {
                cardStyles = "bg-slate-50/60 dark:bg-slate-900/40 border-slate-200/80 dark:border-slate-800 text-slate-400 dark:text-slate-500 opacity-50";
                badgeStyles = "bg-slate-100 dark:bg-slate-800 text-slate-400 border-slate-200 dark:border-slate-800";
              }
            } else if (isSelected) {
              cardStyles = "bg-[#7045D8]/10 dark:bg-[#7045D8]/20 border-2 border-[#7045D8] dark:border-[#A78BFA] ring-2 ring-[#7045D8]/25 text-[#7045D8] dark:text-[#A78BFA] font-black scale-[1.01] shadow-md shadow-[#7045D8]/15";
              badgeStyles = "bg-[#7045D8] text-white border-[#7045D8] shadow-sm shadow-[#7045D8]/30";
            }

            return (
              <button
                key={idx}
                type="button"
                disabled={hasLockedAnswer || isRevealing}
                onClick={() => {
                  playClickSound();
                  triggerHaptic("light");
                  onSelectOption(idx);
                }}
                className={`w-full min-h-[58px] sm:min-h-[64px] flex items-center justify-between p-3 sm:p-3.5 rounded-2xl border-2 transition-all duration-200 text-left cursor-pointer active:scale-[0.98] relative overflow-hidden ${cardStyles}`}
              >
                <div className="flex items-center gap-3 flex-1 min-w-0 mr-2">
                  <span className={`w-8 h-8 sm:w-9 sm:h-9 shrink-0 rounded-xl flex items-center justify-center font-mono font-black text-xs sm:text-sm transition-all ${badgeStyles}`}>
                    {OPTION_LETTERS[idx]}
                  </span>
                  <span className="font-hindi text-sm sm:text-base font-bold leading-snug break-words [overflow-wrap:anywhere] flex-1">
                    {cleanOption}
                  </span>
                </div>

                {/* Status Indicator Icon */}
                <div className="shrink-0">
                  {isRevealing ? (
                    isCorrect ? (
                      <div className="w-7 h-7 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-lg shadow-emerald-500/40 animate-bounce">
                        <CheckCircle2 className="w-4.5 h-4.5" />
                      </div>
                    ) : isSelected ? (
                      <div className="w-7 h-7 rounded-full bg-rose-500 text-white flex items-center justify-center shadow-lg shadow-rose-500/30">
                        <XCircle className="w-4.5 h-4.5" />
                      </div>
                    ) : null
                  ) : isSelected ? (
                    <span className="text-[11px] font-black text-white bg-[#7045D8] px-2.5 py-1 rounded-full shadow-sm shadow-[#7045D8]/30 animate-pulse whitespace-nowrap">
                      Locked ✓
                    </span>
                  ) : null}
                </div>
              </button>
            );
          })}
        </div>

        {/* 4. FLOATING QUICK REACTION EMOJIS */}
        <div className="flex items-center justify-center gap-2 py-1.5 px-3 rounded-full bg-white/80 dark:bg-[#1B1536]/80 backdrop-blur-md border border-slate-200 dark:border-[#31275E] shadow-sm mx-auto w-fit select-none">
          {QUICK_EMOJIS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => onSendEmoji(emoji)}
              className="w-9 h-9 flex items-center justify-center text-lg rounded-xl hover:bg-slate-100 dark:hover:bg-[#241D48] active:scale-125 transition-transform cursor-pointer"
              title={`React ${emoji}`}
            >
              {emoji}
            </button>
          ))}
        </div>
      </div>

      {/* 5. REVEAL OVERLAY FOOTER */}
      {isRevealing && (
        <div className="bg-white dark:bg-[#1B1536] border-t border-slate-200 dark:border-[#31275E] p-4 sm:p-5 shadow-2xl animate-in slide-in-from-bottom-2 duration-200 max-w-3xl mx-auto w-full rounded-t-3xl">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              {selectedOption !== null && Number(selectedOption) === Number(question.correctIndex) ? (
                <span className="flex items-center gap-1.5 text-xs sm:text-sm font-black text-emerald-800 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-950/70 px-3.5 py-1.5 rounded-full border border-emerald-300 dark:border-emerald-700 shadow-xs">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span>Great Job! Correct (+{myPlayer?.lastAnswer?.pointsEarned || 100} pts)</span>
                </span>
              ) : (
                <span className="flex items-center gap-1.5 text-xs sm:text-sm font-black text-rose-800 dark:text-rose-300 bg-rose-100 dark:bg-rose-950/70 px-3.5 py-1.5 rounded-full border border-rose-300 dark:border-rose-700 shadow-xs">
                  <XCircle className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                  <span>Incorrect (+0 pts)</span>
                </span>
              )}
            </div>

            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 font-hindi">
              अगला प्रश्न आ रहा है...
            </span>
          </div>

          {question.explanation && (
            <div className="bg-[#7045D8]/5 dark:bg-[#7045D8]/10 p-3 rounded-2xl border border-[#7045D8]/20 text-xs font-hindi font-medium text-slate-800 dark:text-slate-200 flex items-start gap-2.5 mt-2">
              <HelpCircle className="w-4 h-4 text-[#7045D8] dark:text-[#A78BFA] shrink-0 mt-0.5" />
              <span className="leading-relaxed">{question.explanation}</span>
            </div>
          )}
        </div>
      )}

      {/* 6. SLIDE-OVER MODAL FOR ALL PLAYERS' LIVE RANKING */}
      {showAllRanks && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex flex-col justify-end animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#1B1536] rounded-t-[32px] max-h-[80%] flex flex-col overflow-hidden shadow-2xl border-t border-slate-200 dark:border-[#31275E] max-w-2xl mx-auto w-full animate-in slide-in-from-bottom duration-300">
            <div className="p-4 sm:p-5 bg-gradient-to-r from-[#4A154B] via-[#7045D8] to-[#5B32BF] text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-400 text-stone-900 flex items-center justify-center font-bold shadow-sm">
                  <Trophy className="w-5 h-5 text-stone-950" />
                </div>
                <div>
                  <h3 className="text-sm font-black uppercase tracking-wider">
                    Live Leaderboard
                  </h3>
                  <p className="text-[11px] text-amber-200/80 font-bold">
                    {sortedPlayers.length} Aspirants Competing
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAllRanks(false)}
                className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 flex items-center justify-center transition-colors cursor-pointer"
                aria-label="Close leaderboard"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 sm:p-4 overflow-y-auto space-y-2 flex-1">
              {sortedPlayers.map((p, idx) => {
                const isMe = p.id === myPlayerId;
                const podiumEmoji = idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : null;

                return (
                  <div
                    key={p.id}
                    className={`flex items-center justify-between p-3 rounded-2xl border transition-all ${
                      isMe
                        ? "bg-amber-50 dark:bg-amber-950/30 border-amber-300 dark:border-amber-400/60 font-bold ring-2 ring-amber-400/30 shadow-xs"
                        : "bg-slate-50 dark:bg-[#241D48] border-slate-200 dark:border-[#31275E]"
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="w-7 text-center font-mono font-black text-xs text-slate-500 dark:text-slate-400 shrink-0">
                        {podiumEmoji || `#${idx + 1}`}
                      </span>
                      <BattleAvatar avatar={p.avatar} name={p.name} size="md" />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-50 truncate">
                            {p.name}
                          </span>
                          {isMe && (
                            <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-[#7045D8] text-white shrink-0">
                              You
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="text-right flex items-center gap-2.5 shrink-0 ml-2">
                      {p.streak >= 2 && (
                        <span className="text-[11px] text-orange-500 dark:text-orange-400 font-black flex items-center gap-0.5">
                          <Flame className="w-3.5 h-3.5 fill-current" />
                          {p.streak}
                        </span>
                      )}
                      <span className="text-sm sm:text-base font-black font-mono text-[#7045D8] dark:text-[#A78BFA]">
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
