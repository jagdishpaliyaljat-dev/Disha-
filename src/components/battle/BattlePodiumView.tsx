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

    const text = `🏆 *दिशा 20-20 लाइव क्विज़ मुकाबला परिणाम*\n\n` +
      `विजेता: ${winner.avatar} ${winner.name} (${winner.score} अंक)\n` +
      `मेरी रैंक: #${myRank} ${myPlayer?.avatar} (${myPlayer?.score} अंक)\n` +
      `सटीकता: ${myPlayer?.correctCount || 0}/${totalQuestions} प्रश्न सही\n\n` +
      `क्या आप मुझे हरा सकते हैं? अभी दिशा 20-20 ऐप में खेलें! ⚔️`;

    const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
    window.open(whatsappUrl, "_blank", "noopener,noreferrer");
  };

  const first = rankedPlayers[0];
  const second = rankedPlayers[1];
  const third = rankedPlayers[2];

  return (
    <div className="flex flex-col h-full bg-[#FFF9EF] text-stone-900 select-none overflow-y-auto">
      {/* Header Banner */}
      <div className="bg-gradient-to-b from-[#800020] to-[#5a0016] text-white pt-6 pb-4 px-4 text-center shadow-lg relative">
        <div className="inline-flex items-center justify-center p-3 rounded-full bg-amber-400 text-stone-900 shadow-md mb-2">
          <Trophy className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-extrabold tracking-wide">
          मुकाबला संपन्न!
        </h2>
        <p className="text-xs text-amber-200 mt-1">
          {isMeWinner
            ? "🎉 बधाई हो! आप इस मुकाबले के विजेता बने हैं!"
            : `🏆 विजेता: ${winner?.name || "खिलाड़ी"}`}
        </p>
      </div>

      <div className="p-4 space-y-5 flex-1">
        {/* Podium Display */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-stone-200">
          <div className="flex items-end justify-center gap-2 pt-8 pb-2">
            {/* 2nd Place */}
            {second && (
              <div className="flex flex-col items-center flex-1 max-w-[100px]">
                <div className="relative mb-1">
                  <span className="text-2xl">{second.avatar}</span>
                  <span className="absolute -top-2 -right-2 bg-stone-300 text-stone-800 text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center border border-white">
                    2
                  </span>
                </div>
                <span className="text-xs font-bold text-stone-800 truncate w-full text-center">
                  {second.name}
                </span>
                <span className="text-xs font-semibold text-stone-500">
                  {second.score}
                </span>
                <div className="w-full bg-stone-200 h-20 rounded-t-xl mt-2 flex items-center justify-center border border-stone-300 shadow-inner">
                  <span className="text-base font-extrabold text-stone-600">
                    🥈
                  </span>
                </div>
              </div>
            )}

            {/* 1st Place (Center, Tallest) */}
            {first && (
              <div className="flex flex-col items-center flex-1 max-w-[120px]">
                <div className="relative mb-1">
                  <div className="absolute -top-6 left-1/2 transform -translate-x-1/2 text-amber-500 animate-bounce">
                    <Crown className="w-6 h-6 fill-amber-400" />
                  </div>
                  <span className="text-4xl p-2 rounded-full bg-amber-100 border-2 border-amber-400 inline-block shadow-md">
                    {first.avatar}
                  </span>
                  <span className="absolute -bottom-1 -right-1 bg-amber-400 text-stone-900 text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center border-2 border-white shadow">
                    1
                  </span>
                </div>
                <span className="text-sm font-extrabold text-stone-900 truncate w-full text-center mt-1">
                  {first.name}
                </span>
                <span className="text-xs font-bold text-[#800020]">
                  {first.score} अंक
                </span>
                <div className="w-full bg-gradient-to-t from-amber-400 to-amber-300 h-28 rounded-t-xl mt-2 flex items-center justify-center border border-amber-400 shadow-md">
                  <span className="text-2xl font-black text-amber-900">
                    👑 🥇
                  </span>
                </div>
              </div>
            )}

            {/* 3rd Place */}
            {third && (
              <div className="flex flex-col items-center flex-1 max-w-[100px]">
                <div className="relative mb-1">
                  <span className="text-2xl">{third.avatar}</span>
                  <span className="absolute -top-2 -right-2 bg-amber-700 text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center border border-white">
                    3
                  </span>
                </div>
                <span className="text-xs font-bold text-stone-800 truncate w-full text-center">
                  {third.name}
                </span>
                <span className="text-xs font-semibold text-stone-500">
                  {third.score}
                </span>
                <div className="w-full bg-amber-100 h-14 rounded-t-xl mt-2 flex items-center justify-center border border-amber-200 shadow-inner">
                  <span className="text-base font-extrabold text-amber-800">
                    🥉
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Detailed Leaderboard Table */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-stone-200">
          <h3 className="text-xs font-bold text-stone-500 uppercase tracking-wider mb-3">
            विस्तृत स्कोरकार्ड
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
                  className={`flex items-center justify-between p-3 rounded-xl border transition ${
                    isMe
                      ? "bg-amber-50/80 border-amber-300 shadow-xs"
                      : "bg-stone-50 border-stone-200"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="w-6 text-center font-bold text-stone-500 text-sm">
                      #{idx + 1}
                    </span>
                    <span className="text-2xl">{player.avatar}</span>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-sm text-stone-800">
                          {player.name}
                        </span>
                        {isMe && (
                          <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-[#800020] text-white">
                            आप
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
                            {player.streak} स्ट्रीक
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-base font-extrabold text-[#800020]">
                      {player.score}
                    </span>
                    <span className="block text-[10px] text-stone-500 font-medium">
                      अंक
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
            className="w-full flex items-center justify-center gap-2 py-3.5 px-6 rounded-2xl bg-[#800020] hover:bg-[#68001a] text-white font-bold text-sm shadow-md active:scale-98 transition"
          >
            <RotateCcw className="w-4 h-4" />
            <span>पुनः मुकाबला खेलें (Rematch)</span>
          </button>

          <button
            onClick={handleShareResult}
            className="w-full flex items-center justify-center gap-2 py-3 px-6 rounded-2xl bg-[#25D366] hover:bg-[#20bd5a] text-white font-bold text-sm shadow-sm active:scale-98 transition"
          >
            <Share2 className="w-4 h-4" />
            <span>परिणाम WhatsApp पर साझा करें</span>
          </button>

          <button
            onClick={onExit}
            className="w-full flex items-center justify-center gap-2 py-3 px-6 rounded-2xl bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold text-sm border border-stone-300 active:scale-98 transition"
          >
            <Home className="w-4 h-4" />
            <span>होम स्क्रीन पर लौटें</span>
          </button>
        </div>
      </div>
    </div>
  );
};
