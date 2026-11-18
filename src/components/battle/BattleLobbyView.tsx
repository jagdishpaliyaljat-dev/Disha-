import React, { useState } from "react";
import {
  Users,
  Copy,
  Check,
  Share2,
  Crown,
  Bot,
  Play,
  ArrowLeft,
  Sparkles,
  Flame,
  Clock,
  BookOpen,
} from "lucide-react";
import type {
  BattlePlayer,
  BattleRoomConfig,
  BattleCategory,
} from "./types";
import { getBattleShareInfo } from "../../utils/realtimeBattleService";
import { triggerHaptic, playClickSound } from "../../utils/audioFeedback";

interface BattleLobbyViewProps {
  roomConfig: BattleRoomConfig;
  players: BattlePlayer[];
  myPlayerId: string;
  isHost: boolean;
  onToggleReady: () => void;
  onStartGame: () => void;
  onAddBot: () => void;
  onUpdateConfig: (config: Partial<BattleRoomConfig>) => void;
  onSendEmoji: (emoji: string) => void;
  onLeaveRoom: () => void;
}

const CATEGORY_LABELS: Record<BattleCategory, { label: string; icon: string }> = {
  all: { label: "सभी विषय (मिश्रित)", icon: "🎯" },
  history: { label: "राजस्थान इतिहास", icon: "🏰" },
  geography: { label: "राजस्थान भूगोल", icon: "🗺️" },
  culture: { label: "कला एवं संस्कृति", icon: "🎭" },
  polity: { label: "राजव्यवस्था", icon: "🏛️" },
  economy: { label: "अर्थव्यवस्था व योजनाएं", icon: "📊" },
};

const QUICK_EMOJIS = ["🔥", "🎯", "🚀", "💡", "👏", "🏆"];

export const BattleLobbyView: React.FC<BattleLobbyViewProps> = ({
  roomConfig,
  players,
  myPlayerId,
  isHost,
  onToggleReady,
  onStartGame,
  onAddBot,
  onUpdateConfig,
  onSendEmoji,
  onLeaveRoom,
}) => {
  const [copied, setCopied] = useState(false);
  const myPlayer = players.find((p) => p.id === myPlayerId);
  const shareInfo = getBattleShareInfo(roomConfig.roomCode);

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(roomConfig.roomCode);
      setCopied(true);
      triggerHaptic("light");
      playClickSound();
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  };

  const handleWhatsAppShare = () => {
    triggerHaptic("medium");
    playClickSound();
    window.open(shareInfo.whatsappUrl, "_blank", "noopener,noreferrer");
  };

  const canStart =
    isHost &&
    players.length >= 2 &&
    players.every((p) => p.isHost || p.isReady || p.isBot);

  return (
    <div className="flex flex-col h-full bg-[#FFF9EF] text-stone-900 select-none">
      {/* Top Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-[#800020] text-white shadow-md">
        <button
          onClick={onLeaveRoom}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 active:scale-95 transition text-sm font-medium"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>छोड़ें</span>
        </button>

        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-amber-300" />
          <h2 className="text-base font-bold tracking-wide">
            लाइव मुकाबला लॉबी
          </h2>
        </div>

        <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/15 text-xs font-semibold">
          <span>{players.length} खिलाड़ी</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {/* Room Code & WhatsApp Share Card */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-amber-200/70 text-center relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-400 via-[#800020] to-amber-400" />
          <p className="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-1">
            कमरा कोड (Room Code)
          </p>

          <div className="flex items-center justify-center gap-3 my-2">
            <span className="text-3xl font-extrabold tracking-widest font-mono text-[#800020] bg-amber-50 px-4 py-1.5 rounded-xl border border-amber-200 shadow-inner">
              {roomConfig.roomCode}
            </span>
            <button
              onClick={handleCopyCode}
              title="कोड कॉपी करें"
              className="p-2.5 rounded-xl bg-stone-100 hover:bg-amber-100 text-stone-700 active:scale-90 transition border border-stone-200"
            >
              {copied ? (
                <Check className="w-5 h-5 text-emerald-600" />
              ) : (
                <Copy className="w-5 h-5" />
              )}
            </button>
          </div>

          <p className="text-xs text-stone-600 mb-3">
            यह 6-अंकों का कोड अपने दोस्तों के साथ साझा करें।
          </p>

          <button
            onClick={handleWhatsAppShare}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-[#25D366] hover:bg-[#20bd5a] text-white font-bold text-sm shadow-sm active:scale-95 transition"
          >
            <Share2 className="w-4 h-4" />
            <span>व्हाट्सएप पर दोस्तों को आमंत्रित करें</span>
          </button>
        </div>

        {/* Players List Card */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-stone-200">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-stone-800 flex items-center gap-1.5">
              <span>खिलाड़ी सूची</span>
              <span className="text-xs font-normal text-stone-500">
                ({players.length})
              </span>
            </h3>

            {isHost && players.length === 1 && (
              <button
                onClick={onAddBot}
                className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg bg-amber-500 text-white hover:bg-amber-600 active:scale-95 transition shadow-xs"
              >
                <Bot className="w-3.5 h-3.5" />
                <span>+ बॉट जोड़ें</span>
              </button>
            )}
          </div>

          <div className="space-y-2.5">
            {players.map((player) => {
              const isMe = player.id === myPlayerId;
              return (
                <div
                  key={player.id}
                  className={`flex items-center justify-between p-3 rounded-xl border transition ${
                    isMe
                      ? "bg-amber-50/70 border-amber-300"
                      : "bg-stone-50 border-stone-200/80"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="relative text-2xl w-10 h-10 rounded-full bg-white shadow-xs border border-stone-200 flex items-center justify-center">
                      <span>{player.avatar}</span>
                      {player.isHost && (
                        <div
                          className="absolute -top-1.5 -right-1.5 bg-amber-400 text-stone-900 rounded-full p-0.5 shadow"
                          title="होस्ट (आयोजक)"
                        >
                          <Crown className="w-3.5 h-3.5" />
                        </div>
                      )}
                    </div>

                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-sm text-stone-800">
                          {player.name}
                        </span>
                        {isMe && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#800020] text-white">
                            आप
                          </span>
                        )}
                        {player.isBot && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-800">
                            AI
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-stone-500">
                        {player.isHost
                          ? "कक्ष आयोजक (Host)"
                          : player.isReady || player.isBot
                          ? "खेलने को तैयार"
                          : "प्रतीक्षा में..."}
                      </p>
                    </div>
                  </div>

                  <div>
                    {player.isHost ? (
                      <span className="text-xs font-bold text-amber-700 bg-amber-100 px-2.5 py-1 rounded-full">
                        होस्ट 👑
                      </span>
                    ) : player.isReady || player.isBot ? (
                      <span className="flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-100 px-2.5 py-1 rounded-full">
                        <Check className="w-3.5 h-3.5" />
                        <span>तैयार</span>
                      </span>
                    ) : (
                      <span className="text-xs font-medium text-stone-600 bg-stone-200 px-2.5 py-1 rounded-full">
                        प्रतीक्षारत
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {players.length === 1 && (
            <div className="mt-3 p-3 bg-amber-50 rounded-xl border border-amber-200/80 text-center">
              <p className="text-xs text-amber-900 font-medium">
                💡 साथी खिलाड़ी की प्रतीक्षा है। आप अभी ऊपर दिए बटन से <b>AI बॉट</b> जोड़कर तुरंत अभ्यास भी कर सकते हैं!
              </p>
            </div>
          )}
        </div>

        {/* Room Settings (Host Editable, Non-host Readonly) */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-stone-200 space-y-3">
          <h3 className="text-sm font-bold text-stone-800 flex items-center gap-1.5">
            <BookOpen className="w-4 h-4 text-[#800020]" />
            <span>मुकाबला सेटिंग्स</span>
            {!isHost && (
              <span className="text-xs font-normal text-stone-500">
                (होस्ट द्वारा निर्धारित)
              </span>
            )}
          </h3>

          {/* Category */}
          <div>
            <label className="block text-xs font-semibold text-stone-600 mb-1.5">
              विषय श्रेणी
            </label>
            {isHost ? (
              <select
                value={roomConfig.category}
                onChange={(e) =>
                  onUpdateConfig({ category: e.target.value as BattleCategory })
                }
                className="w-full text-sm font-medium bg-stone-50 border border-stone-300 rounded-xl px-3 py-2 text-stone-800 focus:outline-none focus:ring-2 focus:ring-[#800020]"
              >
                {Object.entries(CATEGORY_LABELS).map(([catKey, { label, icon }]) => (
                  <option key={catKey} value={catKey}>
                    {icon} {label}
                  </option>
                ))}
              </select>
            ) : (
              <div className="text-sm font-semibold text-stone-800 bg-stone-50 px-3 py-2 rounded-xl border border-stone-200 flex items-center gap-2">
                <span>{CATEGORY_LABELS[roomConfig.category]?.icon}</span>
                <span>{CATEGORY_LABELS[roomConfig.category]?.label}</span>
              </div>
            )}
          </div>

          {/* Question Count & Time Per Question */}
          <div className="grid grid-cols-2 gap-3 pt-1">
            <div>
              <label className="block text-xs font-semibold text-stone-600 mb-1">
                कुल प्रश्न
              </label>
              {isHost ? (
                <div className="flex gap-1.5">
                  {[5, 10, 15].map((cnt) => (
                    <button
                      key={cnt}
                      type="button"
                      onClick={() => onUpdateConfig({ questionCount: cnt })}
                      className={`flex-1 py-1.5 text-xs font-bold rounded-lg border transition ${
                        roomConfig.questionCount === cnt
                          ? "bg-[#800020] text-white border-[#800020]"
                          : "bg-stone-50 text-stone-700 border-stone-200 hover:bg-stone-100"
                      }`}
                    >
                      {cnt}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="text-sm font-bold text-stone-800 bg-stone-50 px-3 py-1.5 rounded-lg border border-stone-200">
                  {roomConfig.questionCount} प्रश्न
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-600 mb-1 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-stone-500" />
                <span>प्रति प्रश्न समय</span>
              </label>
              {isHost ? (
                <div className="flex gap-1.5">
                  {[10, 15, 20].map((sec) => (
                    <button
                      key={sec}
                      type="button"
                      onClick={() => onUpdateConfig({ timePerQuestionSec: sec })}
                      className={`flex-1 py-1.5 text-xs font-bold rounded-lg border transition ${
                        roomConfig.timePerQuestionSec === sec
                          ? "bg-[#800020] text-white border-[#800020]"
                          : "bg-stone-50 text-stone-700 border-stone-200 hover:bg-stone-100"
                      }`}
                    >
                      {sec}s
                    </button>
                  ))}
                </div>
              ) : (
                <div className="text-sm font-bold text-stone-800 bg-stone-50 px-3 py-1.5 rounded-lg border border-stone-200">
                  {roomConfig.timePerQuestionSec} सेकंड
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Floating Emoji Reactions Bar */}
        <div className="bg-white rounded-2xl p-3 shadow-sm border border-stone-200 flex items-center justify-between">
          <span className="text-xs font-bold text-stone-500 flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span>प्रतिक्रियाएं:</span>
          </span>
          <div className="flex items-center gap-1.5">
            {QUICK_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                onClick={() => {
                  triggerHaptic("light");
                  onSendEmoji(emoji);
                }}
                className="w-8 h-8 flex items-center justify-center text-lg rounded-full bg-stone-100 hover:bg-amber-100 active:scale-125 transition"
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Action Footer */}
      <div className="p-4 bg-white border-t border-stone-200 shadow-lg">
        {isHost ? (
          <div>
            <button
              onClick={onStartGame}
              disabled={!canStart}
              className={`w-full flex items-center justify-center gap-2 py-3.5 px-6 rounded-2xl font-bold text-base shadow-md active:scale-98 transition ${
                canStart
                  ? "bg-gradient-to-r from-[#800020] to-[#a31535] text-white hover:brightness-110"
                  : "bg-stone-200 text-stone-400 cursor-not-allowed"
              }`}
            >
              <Play className="w-5 h-5 fill-current" />
              <span>मुकाबला शुरू करें (Start Battle)</span>
            </button>
            {!canStart && (
              <p className="text-center text-xs text-stone-500 mt-2">
                {players.length < 2
                  ? "मुकाबला शुरू करने के लिए कम से कम 1 साथी या AI बॉट जोड़ें।"
                  : "सभी खिलाड़ियों के तैयार होने की प्रतीक्षा करें।"}
              </p>
            )}
          </div>
        ) : (
          <button
            onClick={onToggleReady}
            className={`w-full flex items-center justify-center gap-2 py-3.5 px-6 rounded-2xl font-bold text-base shadow-md active:scale-98 transition ${
              myPlayer?.isReady
                ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                : "bg-gradient-to-r from-amber-500 to-amber-600 hover:brightness-105 text-white"
            }`}
          >
            {myPlayer?.isReady ? (
              <>
                <Check className="w-5 h-5" />
                <span>तैयार हैं! (रद्द करने के लिए टैप करें)</span>
              </>
            ) : (
              <>
                <Flame className="w-5 h-5" />
                <span>मैं तैयार हूँ (I am Ready)</span>
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
};
