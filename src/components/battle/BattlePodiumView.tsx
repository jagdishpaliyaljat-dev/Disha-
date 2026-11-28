import React, { useEffect } from "react";
import confetti from "canvas-confetti";
import {
  Trophy,
  Crown,
  Medal,
  RotateCcw,
  Home,
  Share2,
  Flame,
  Clock,
  CheckCircle2,
} from "lucide-react";
import type { BattlePlayer } from "./types";
import { playVictoryFanfare, triggerHaptic, playClickSound } from "../../utils/audioFeedback";
import { BattleAvatar } from "./BattleAvatar";

interface BattlePodiumViewProps {
  players: BattlePlayer[];
  myPlayerId: string;
  totalQuestions: number;
  onRematch: () => void;
  onExit: () => void;
}

export const BattlePodiumView: React.FC<BattlePodiumViewProps> = ({
  players,
  myPlayerId,
  totalQuestions,
  onRematch,
  onExit,
}) => {
  // Sort players by score descending
  const rankedPlayers = [...players].sort((a, b) => b.score - a.score);
  const winner = rankedPlayers[0];
  const isMeWinner = winner?.id === myPlayerId;

  // Trigger celebration confetti and victory sound on mount
  useEffect(() => {
    playVictoryFanfare();
    triggerHaptic("success");

    // Confetti cannon blast
    try {
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
        colors: ["#7045D8", "#F59E0B", "#10B981", "#3B82F6", "#EC4899"],
      });

      const timer = setTimeout(() => {
        confetti({
          particleCount: 50,
          angle: 60,
          spread: 55,
          origin: { x: 0 },
          colors: ["#F59E0B", "#7045D8"],
        });
        confetti({
          particleCount: 50,
          angle: 120,
          spread: 55,
          origin: { x: 1 },
          colors: ["#F59E0B", "#7045D8"],
        });
      }, 500);

      return () => clearTimeout(timer);
    } catch {
      // Ignore confetti error
    }
  }, []);

  const handleShareResult = () => {
    triggerHaptic("medium");
    playClickSound();

    const myRank = rankedPlayers.findIndex((p) => p.id === myPlayerId) + 1;
    const myPlayer = rankedPlayers.find((p) => p.id === myPlayerId);

    const text = `🏆 *Disha PYQ Live Battle Result*\n\n` +
      `Winner: ${winner.avatar} ${winner.name} (${winner.score} pts)\n` +
      `My Rank: #${myRank} / ${rankedPlayers.length} players ${myPlayer?.avatar} (${myPlayer?.score} pts)\n` +
      `Accuracy: ${myPlayer?.correctCount || 0}/${totalQuestions} correct (10s per question ⚡)\n\n` +
      `Can you beat me? Play Live Battle now in Disha PYQ app! ⚔️`;

    const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
    window.open(whatsappUrl, "_blank", "noopener,noreferrer");
  };

  const first = rankedPlayers[0];
  const second = rankedPlayers[1];
  const third = rankedPlayers[2];

  return (
    <div className="flex flex-col h-full bg-[#F8FAFC] dark:bg-[#130E26] text-slate-900 dark:text-slate-50 select-none overflow-y-auto">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-[#4A154B] via-[#7045D8] to-[#5B32BF] dark:from-[#1E1238] dark:via-[#2D1B54] dark:to-[#1B1536] text-white pt-6 pb-5 px-4 text-center shadow-lg relative overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-48 bg-amber-400/20 rounded-full blur-2xl pointer-events-none" />

        <div className="relative inline-flex items-center justify-center p-3.5 rounded-2xl bg-gradient-to-br from-amber-400 via-amber-300 to-amber-500 text-slate-950 shadow-[0_4px_20px_rgba(245,158,11,0.5)] mb-2 ring-2 ring-amber-200/50">
          <Trophy className="w-8 h-8" />
        </div>
        <h2 className="text-xl sm:text-2xl font-extrabold tracking-wide drop-shadow-xs">
          Battle Concluded!
        </h2>
        <p className="text-xs text-amber-200/95 mt-1 max-w-xs mx-auto font-medium">
          {isMeWinner
            ? "👑 Outstanding Victory! You are the Champion of this battle!"
            : `🏆 Winner: ${winner?.name || "Player"} (${winner?.score || 0} pts)`}
        </p>
      </div>

      <div className="p-4 space-y-4 flex-1">
        {/* 3D Royal Podium Display */}
        <div className="bg-white dark:bg-[#1B1536] rounded-3xl p-4 sm:p-5 shadow-sm border border-amber-900/10 dark:border-[#31275E]">
          <div className="flex items-end justify-center gap-2 pt-8 pb-1">
            {/* 2nd Place */}
            {second && (
              <div className="flex flex-col items-center flex-1 max-w-[100px]">
                <div className="relative mb-1">
                  <BattleAvatar avatar={second.avatar} name={second.name} size="lg" />
                  <span className="absolute -top-1 -right-1 bg-stone-300 text-slate-800 text-[11px] font-extrabold rounded-full w-5 h-5 flex items-center justify-center border-2 border-white shadow">
                    2
                  </span>
                </div>
                <span className="text-xs font-extrabold text-slate-800 dark:text-stone-100 truncate w-full text-center">
                  {second.name}
                </span>
                <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                  {second.score} pts
                </span>
                <div className="w-full bg-gradient-to-t from-stone-400 to-stone-200 h-20 rounded-t-2xl mt-2 flex flex-col items-center justify-center border-t-2 border-white shadow-inner">
                  <span className="text-xl">🥈</span>
                  <span className="text-[11px] font-extrabold text-slate-700 uppercase tracking-wider">
                    2nd Place
                  </span>
                </div>
              </div>
            )}

            {/* 1st Place (Center, Champion) */}
            {first && (
              <div className="flex flex-col items-center flex-1 max-w-[125px]">
                <div className="relative mb-1">
                  <div className="absolute -top-7 left-1/2 -translate-x-1/2 text-amber-500 animate-bounce">
                    <Crown className="w-7 h-7 fill-amber-400 drop-shadow" />
                  </div>
                  <div className="p-1 rounded-full bg-amber-100 border-2 border-amber-400 inline-block shadow-md ring-2 ring-amber-300/50">
                    <BattleAvatar avatar={first.avatar} name={first.name} size="xl" showBadge />
                  </div>
                  <span className="absolute -bottom-1 -right-1 bg-amber-400 text-slate-900 text-xs font-black rounded-full w-6 h-6 flex items-center justify-center border-2 border-white shadow">
                    1
                  </span>
                </div>
                <span className="text-xs sm:text-sm font-black text-slate-900 dark:text-white truncate w-full text-center mt-1">
                  {first.name}
                </span>
                <span className="text-xs font-black text-[#7045D8] dark:text-amber-400">
                  {first.score} pts
                </span>
                <div className="w-full bg-gradient-to-t from-amber-500 via-amber-400 to-amber-300 h-28 rounded-t-2xl mt-2 flex flex-col items-center justify-center border-t-2 border-amber-200 shadow-md">
                  <span className="text-2xl drop-shadow">👑 🥇</span>
                  <span className="text-[11px] font-black text-amber-950 uppercase tracking-wider">
                    Champion 1st
                  </span>
                </div>
              </div>
            )}

            {/* 3rd Place */}
            {third && (
              <div className="flex flex-col items-center flex-1 max-w-[100px]">
                <div className="relative mb-1">
                  <BattleAvatar avatar={third.avatar} name={third.name} size="lg" />
                  <span className="absolute -top-1 -right-1 bg-amber-700 text-white text-[11px] font-extrabold rounded-full w-5 h-5 flex items-center justify-center border-2 border-white shadow">
                    3
                  </span>
                </div>
                <span className="text-xs font-extrabold text-slate-800 dark:text-stone-100 truncate w-full text-center">
                  {third.name}
                </span>
                <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                  {third.score} pts
                </span>
                <div className="w-full bg-gradient-to-t from-amber-800 to-amber-600 h-16 rounded-t-2xl mt-2 flex flex-col items-center justify-center border-t-2 border-amber-400 shadow-inner">
                  <span className="text-xl">🥉</span>
                  <span className="text-[11px] font-extrabold text-amber-100 uppercase tracking-wider">
                    3rd Place
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* User's Match Performance Highlights */}
        {(() => {
          const myPlayer = rankedPlayers.find((p) => p.id === myPlayerId);
          const myRank = rankedPlayers.findIndex((p) => p.id === myPlayerId) + 1;
          const accuracy = Math.round(
            ((myPlayer?.correctCount || 0) / totalQuestions) * 100
          );

          return (
            <div className="bg-gradient-to-r from-amber-50 via-white to-amber-50 dark:from-[#1B1536] dark:via-[#241D48] dark:to-[#1B1536] rounded-3xl p-4 border-2 border-amber-300/80 dark:border-amber-500/40 shadow-xs">
              <h3 className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-2.5 flex items-center justify-between">
                <span>Your Performance Card</span>
                <span className="text-xs font-extrabold text-[#7045D8] dark:text-amber-300 bg-amber-200/80 dark:bg-amber-950/60 px-2 py-0.5 rounded-full">
                  Rank #{myRank} / {rankedPlayers.length}
                </span>
              </h3>

              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-white dark:bg-[#1B1536] p-2.5 rounded-2xl border border-slate-200 dark:border-[#31275E] shadow-xs">
                  <span className="block text-base sm:text-lg font-black text-[#7045D8] dark:text-amber-400">
                    {myPlayer?.score || 0}
                  </span>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 font-bold uppercase">
                    Total Score
                  </span>
                </div>

                <div className="bg-white dark:bg-[#1B1536] p-2.5 rounded-2xl border border-slate-200 dark:border-[#31275E] shadow-xs">
                  <span className="block text-base sm:text-lg font-black text-emerald-700 dark:text-emerald-400">
                    {myPlayer?.correctCount || 0}/{totalQuestions}
                  </span>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 font-bold uppercase">
                    Correct ({accuracy}%)
                  </span>
                </div>

                <div className="bg-white dark:bg-[#1B1536] p-2.5 rounded-2xl border border-slate-200 dark:border-[#31275E] shadow-xs">
                  <span className="block text-base sm:text-lg font-black text-orange-600 dark:text-orange-400">
                    🔥 {myPlayer?.streak || 0}
                  </span>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 font-bold uppercase">
                    Max Streak
                  </span>
                </div>
              </div>
            </div>
          );
        })()}

        {/* Detailed Leaderboard Table */}
        <div className="bg-white dark:bg-[#1B1536] rounded-3xl p-4 shadow-sm border border-slate-200 dark:border-[#31275E]">
          <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">
            Complete Scorecard ({rankedPlayers.length} Players)
          </h3>

          <div className="space-y-2">
            {rankedPlayers.map((player, idx) => {
              const isMe = player.id === myPlayerId;
              const accuracy = Math.round(
                ((player.correctCount || 0) / totalQuestions) * 100
              );

              return (
                <div
                  key={player.id}
                  className={`flex items-center justify-between p-3 rounded-2xl border transition ${
                    isMe
                      ? "bg-amber-50/80 dark:bg-amber-950/40 border-amber-300 dark:border-amber-400/60 ring-1 ring-amber-400/50 shadow-xs"
                      : "bg-slate-50 dark:bg-[#241D48] border-slate-200 dark:border-[#31275E]"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="w-6 text-center font-black text-slate-500 dark:text-slate-400 text-sm">
                      {idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : `#${idx + 1}`}
                    </span>
                    <BattleAvatar avatar={player.avatar} name={player.name} size="md" />
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-extrabold text-sm text-slate-800 dark:text-slate-50">
                          {player.name}
                        </span>
                        {isMe && (
                          <span className="text-[11px] font-bold px-1.5 py-0.2 rounded-full bg-[#7045D8] text-white">
                            You
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        <span className="flex items-center gap-0.5 text-emerald-700 dark:text-emerald-400 font-semibold">
                          <CheckCircle2 className="w-3 h-3" />
                          {player.correctCount || 0}/{totalQuestions} ({accuracy}%)
                        </span>
                        {player.streak >= 2 && (
                          <span className="flex items-center gap-0.5 text-orange-600 dark:text-orange-400 font-semibold">
                            <Flame className="w-3 h-3 fill-current" />
                            {player.streak} streak
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-base font-black text-[#7045D8] dark:text-amber-400">
                      {player.score}
                    </span>
                    <span className="block text-[11px] text-slate-500 dark:text-slate-400 font-bold uppercase">
                      pts
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-2.5 pt-2">
          <button
            onClick={onRematch}
            className="w-full flex items-center justify-center gap-2 py-3.5 px-6 rounded-2xl bg-gradient-to-r from-[#7045D8] to-[#5B32BF] text-white font-extrabold text-sm shadow-md active:scale-98 transition border border-amber-400/40 hover:brightness-110"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Play Rematch</span>
          </button>

          <button
            onClick={handleShareResult}
            className="w-full flex items-center justify-center gap-2 py-3 px-6 rounded-2xl bg-gradient-to-r from-[#25D366] to-[#1da851] text-white font-extrabold text-sm shadow-sm active:scale-98 transition border border-emerald-400/40 hover:brightness-105"
          >
            <Share2 className="w-4 h-4" />
            <span>Share Result on WhatsApp</span>
          </button>

          <button
            onClick={onExit}
            className="w-full flex items-center justify-center gap-2 py-3 px-6 rounded-2xl bg-slate-100 dark:bg-[#241D48] hover:bg-slate-200 dark:hover:bg-[#31275E] text-slate-700 dark:text-slate-50 font-bold text-sm border border-slate-300 dark:border-[#31275E] active:scale-98 transition"
          >
            <Home className="w-4 h-4" />
            <span>Return to Home</span>
          </button>
        </div>
      </div>
    </div>
  );
};
