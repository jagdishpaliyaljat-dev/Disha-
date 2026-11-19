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
import { districtWarService } from "../district-war/districtWarService";

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

    // Award District War Points
    if (isMeWinner) {
      districtWarService.addDistrictWarPoints(50, "Glorious victory in 1v1 Live Battle!");
    } else {
      districtWarService.addDistrictWarPoints(20, "Participated in 1v1 Live Battle");
    }

    // Confetti cannon blast
    try {
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
        colors: ["#800020", "#F59E0B", "#10B981", "#3B82F6", "#EC4899"],
      });

      const timer = setTimeout(() => {
        confetti({
          particleCount: 50,
          angle: 60,
          spread: 55,
          origin: { x: 0 },
          colors: ["#F59E0B", "#800020"],
        });
        confetti({
          particleCount: 50,
          angle: 120,
          spread: 55,
          origin: { x: 1 },
          colors: ["#F59E0B", "#800020"],
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

    const text = `🏆 *Disha 20-20 Live Battle Result*\n\n` +
      `Winner: ${winner.avatar} ${winner.name} (${winner.score} pts)\n` +
      `My Rank: #${myRank} / ${rankedPlayers.length} players ${myPlayer?.avatar} (${myPlayer?.score} pts)\n` +
      `Accuracy: ${myPlayer?.correctCount || 0}/${totalQuestions} correct (10s per question ⚡)\n\n` +
      `Can you beat me? Play Live Battle now in Disha 20-20 app! ⚔️`;

    const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
    window.open(whatsappUrl, "_blank", "noopener,noreferrer");
  };

  const first = rankedPlayers[0];
  const second = rankedPlayers[1];
  const third = rankedPlayers[2];

  return (
    <div className="flex flex-col h-full bg-[#FFFDF9] text-stone-900 select-none overflow-y-auto">
      {/* Header Banner */}
      <div className="bg-gradient-to-b from-[#5E0017] via-[#800020] to-[#500013] text-white pt-6 pb-5 px-4 text-center shadow-lg relative overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-48 bg-amber-400/20 rounded-full blur-2xl pointer-events-none" />

        <div className="relative inline-flex items-center justify-center p-3.5 rounded-2xl bg-gradient-to-br from-amber-400 via-amber-300 to-amber-500 text-stone-950 shadow-[0_4px_20px_rgba(245,158,11,0.5)] mb-2 ring-2 ring-amber-200/50">
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
        <div className="bg-white rounded-3xl p-4 sm:p-5 shadow-sm border border-amber-900/10">
          <div className="flex items-end justify-center gap-2 pt-8 pb-1">
            {/* 2nd Place */}
            {second && (
              <div className="flex flex-col items-center flex-1 max-w-[100px]">
                <div className="relative mb-1">
                  <span className="text-3xl">{second.avatar}</span>
                  <span className="absolute -top-2 -right-2 bg-stone-300 text-stone-800 text-[10px] font-extrabold rounded-full w-5 h-5 flex items-center justify-center border-2 border-white shadow">
                    2
                  </span>
                </div>
                <span className="text-xs font-extrabold text-stone-800 truncate w-full text-center">
                  {second.name}
                </span>
                <span className="text-[11px] font-bold text-stone-500">
                  {second.score} pts
                </span>
                <div className="w-full bg-gradient-to-t from-stone-400 to-stone-200 h-20 rounded-t-2xl mt-2 flex flex-col items-center justify-center border-t-2 border-white shadow-inner">
                  <span className="text-xl">🥈</span>
                  <span className="text-[9px] font-extrabold text-stone-700 uppercase tracking-wider">
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
                  <span className="text-4xl p-2 rounded-2xl bg-amber-100 border-2 border-amber-400 inline-block shadow-md ring-2 ring-amber-300/50">
                    {first.avatar}
                  </span>
                  <span className="absolute -bottom-1 -right-1 bg-amber-400 text-stone-900 text-xs font-black rounded-full w-6 h-6 flex items-center justify-center border-2 border-white shadow">
                    1
                  </span>
                </div>
                <span className="text-xs sm:text-sm font-black text-stone-900 truncate w-full text-center mt-1">
                  {first.name}
                </span>
                <span className="text-xs font-black text-[#800020]">
                  {first.score} pts
                </span>
                <div className="w-full bg-gradient-to-t from-amber-500 via-amber-400 to-amber-300 h-28 rounded-t-2xl mt-2 flex flex-col items-center justify-center border-t-2 border-amber-200 shadow-md">
                  <span className="text-2xl drop-shadow">👑 🥇</span>
                  <span className="text-[10px] font-black text-amber-950 uppercase tracking-wider">
                    Champion 1st
                  </span>
                </div>
              </div>
            )}

            {/* 3rd Place */}
            {third && (
              <div className="flex flex-col items-center flex-1 max-w-[100px]">
                <div className="relative mb-1">
                  <span className="text-3xl">{third.avatar}</span>
                  <span className="absolute -top-2 -right-2 bg-amber-700 text-white text-[10px] font-extrabold rounded-full w-5 h-5 flex items-center justify-center border-2 border-white shadow">
                    3
                  </span>
                </div>
                <span className="text-xs font-extrabold text-stone-800 truncate w-full text-center">
                  {third.name}
                </span>
                <span className="text-[11px] font-bold text-stone-500">
                  {third.score} pts
                </span>
                <div className="w-full bg-gradient-to-t from-amber-800 to-amber-600 h-16 rounded-t-2xl mt-2 flex flex-col items-center justify-center border-t-2 border-amber-400 shadow-inner">
                  <span className="text-xl">🥉</span>
                  <span className="text-[9px] font-extrabold text-amber-100 uppercase tracking-wider">
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
            <div className="bg-gradient-to-r from-amber-50 via-white to-amber-50 rounded-3xl p-4 border-2 border-amber-300/80 shadow-xs">
              <h3 className="text-xs font-bold text-stone-600 uppercase tracking-wider mb-2.5 flex items-center justify-between">
                <span>Your Performance Card</span>
                <span className="text-xs font-extrabold text-[#800020] bg-amber-200/80 px-2 py-0.5 rounded-full">
                  Rank #{myRank} / {rankedPlayers.length}
                </span>
              </h3>

              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-white p-2.5 rounded-2xl border border-stone-200 shadow-xs">
                  <span className="block text-base sm:text-lg font-black text-[#800020]">
                    {myPlayer?.score || 0}
                  </span>
                  <span className="text-[10px] text-stone-500 font-bold uppercase">
                    Total Score
                  </span>
                </div>

                <div className="bg-white p-2.5 rounded-2xl border border-stone-200 shadow-xs">
                  <span className="block text-base sm:text-lg font-black text-emerald-700">
                    {myPlayer?.correctCount || 0}/{totalQuestions}
                  </span>
                  <span className="text-[10px] text-stone-500 font-bold uppercase">
                    Correct ({accuracy}%)
                  </span>
                </div>

                <div className="bg-white p-2.5 rounded-2xl border border-stone-200 shadow-xs">
                  <span className="block text-base sm:text-lg font-black text-orange-600">
                    🔥 {myPlayer?.streak || 0}
                  </span>
                  <span className="text-[10px] text-stone-500 font-bold uppercase">
                    Max Streak
                  </span>
                </div>
              </div>
            </div>
          );
        })()}

        {/* Detailed Leaderboard Table */}
        <div className="bg-white rounded-3xl p-4 shadow-sm border border-stone-200">
          <h3 className="text-xs font-bold text-stone-500 uppercase tracking-wider mb-3">
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
                      ? "bg-amber-50/80 border-amber-300 ring-1 ring-amber-400/50 shadow-xs"
                      : "bg-stone-50 border-stone-200"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="w-6 text-center font-black text-stone-500 text-sm">
                      {idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : `#${idx + 1}`}
                    </span>
                    <span className="text-2xl">{player.avatar}</span>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-extrabold text-sm text-stone-800">
                          {player.name}
                        </span>
                        {isMe && (
                          <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-[#800020] text-white">
                            You
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-stone-500 mt-0.5">
                        <span className="flex items-center gap-0.5 text-emerald-700 font-semibold">
                          <CheckCircle2 className="w-3 h-3" />
                          {player.correctCount || 0}/{totalQuestions} ({accuracy}%)
                        </span>
                        {player.streak >= 2 && (
                          <span className="flex items-center gap-0.5 text-orange-600 font-semibold">
                            <Flame className="w-3 h-3 fill-current" />
                            {player.streak} streak
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-base font-black text-[#800020]">
                      {player.score}
                    </span>
                    <span className="block text-[10px] text-stone-500 font-bold uppercase">
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
            className="w-full flex items-center justify-center gap-2 py-3.5 px-6 rounded-2xl bg-gradient-to-r from-[#800020] via-[#A00028] to-[#800020] text-white font-extrabold text-sm shadow-md active:scale-98 transition border border-amber-400/40 hover:brightness-110"
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
            className="w-full flex items-center justify-center gap-2 py-3 px-6 rounded-2xl bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold text-sm border border-stone-300 active:scale-98 transition"
          >
            <Home className="w-4 h-4" />
            <span>Return to Home</span>
          </button>
        </div>
      </div>
    </div>
  );
};
