import React, { useState, useMemo } from "react";
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
  Edit3,
  Search,
  Globe,
  Sliders,
  Swords,
  Zap,
} from "lucide-react";
import type {
  BattlePlayer,
  BattleRoomConfig,
  BattleCategory,
  QuestionSourceType,
} from "./types";
import {
  getBattleShareInfo,
  getUserCustomQuestionsList,
  getAvailableChaptersList,
} from "../../utils/realtimeBattleService";
import { triggerHaptic, playClickSound } from "../../utils/audioFeedback";
import { CustomQuestionPickerModal } from "./CustomQuestionPickerModal";

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
  all: { label: "All Subjects (Mixed)", icon: "🎯" },
  history: { label: "Rajasthan History", icon: "🏰" },
  geography: { label: "Rajasthan Geography", icon: "🗺️" },
  culture: { label: "Art & Culture", icon: "🎭" },
  polity: { label: "Polity & Governance", icon: "🏛️" },
  economy: { label: "Economy & Schemes", icon: "📊" },
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
  const [playerSearch, setPlayerSearch] = useState("");
  const [isQuestionPickerOpen, setIsQuestionPickerOpen] = useState(false);

  const myPlayer = players.find((p) => p.id === myPlayerId);
  const shareInfo = getBattleShareInfo(roomConfig.roomCode, roomConfig.timePerQuestionSec || 10);

  const customQuestions = useMemo(() => getUserCustomQuestionsList(), []);
  const availableChapters = useMemo(() => getAvailableChaptersList(), []);

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

  // Host can start whenever at least 2 players are present (or with bot)
  const canStart = isHost && players.length >= 2;

  // Filter players list if search is used
  const filteredPlayers = useMemo(() => {
    if (!playerSearch.trim()) return players;
    return players.filter((p) =>
      p.name.toLowerCase().includes(playerSearch.toLowerCase())
    );
  }, [players, playerSearch]);

  const readyCount = players.filter((p) => p.isHost || p.isReady || p.isBot).length;

  return (
    <div className="flex flex-col h-full bg-[#FFFDF9] text-stone-900 select-none overflow-hidden">
      {/* Top Royal Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-[#5E0017] via-[#800020] to-[#5E0017] text-white shadow-md border-b border-amber-400/20">
        <button
          onClick={onLeaveRoom}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 active:scale-95 transition text-xs font-bold border border-white/10"
        >
          <ArrowLeft className="w-4 h-4 text-amber-300" />
          <span>Leave Room</span>
        </button>

        <div className="flex items-center gap-2">
          <div className="p-1 rounded-lg bg-amber-400/20 text-amber-300">
            <Swords className="w-4 h-4" />
          </div>
          <h2 className="text-sm sm:text-base font-extrabold tracking-wide">
            Battle Arena Lobby
          </h2>
        </div>

        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-xs font-bold">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping inline-block" />
          <span>{players.length} Live</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {/* Room Code & WhatsApp Share Card (Royal Battle Pass Card) */}
        <div className="relative bg-gradient-to-b from-amber-50/90 via-white to-amber-50/60 rounded-3xl p-4 sm:p-5 shadow-sm border-2 border-amber-300/80 overflow-hidden text-center">
          {/* Top Gold Ribbon Sheen */}
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-amber-300 via-amber-500 to-amber-300" />

          <div className="flex items-center justify-center gap-1.5 text-xs font-extrabold text-[#800020] uppercase tracking-wider mb-2">
            <Globe className="w-3.5 h-3.5 text-amber-600" />
            <span>Unlimited friends can join (Open Link)</span>
          </div>

          <div className="flex items-center justify-center gap-3 my-2">
            <div className="relative px-5 py-2 rounded-2xl bg-white border-2 border-amber-400 shadow-md">
              <span className="text-3xl sm:text-4xl font-extrabold tracking-widest font-mono text-[#800020] drop-shadow-xs">
                {roomConfig.roomCode}
              </span>
            </div>

            <button
              onClick={handleCopyCode}
              title="Copy Code"
              className="p-3 rounded-2xl bg-amber-100 hover:bg-amber-200 text-[#800020] active:scale-90 transition border border-amber-300 shadow-xs flex items-center justify-center"
            >
              {copied ? (
                <Check className="w-5 h-5 text-emerald-600" />
              ) : (
                <Copy className="w-5 h-5" />
              )}
            </button>
          </div>

          {copied ? (
            <p className="text-center text-xs font-bold text-emerald-700 animate-in fade-in my-1">
              Room code copied to clipboard! ✓
            </p>
          ) : (
            <p className="text-xs text-stone-600 my-1">
              Anyone with this code or link can directly join your battle.
            </p>
          )}

          <button
            onClick={handleWhatsAppShare}
            className="w-full mt-2.5 flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-gradient-to-r from-[#25D366] to-[#1da851] text-white font-extrabold text-sm shadow-md shadow-emerald-500/20 active:scale-98 transition border border-emerald-400/40 hover:brightness-105"
          >
            <Share2 className="w-4 h-4" />
            <span>Share link via WhatsApp or Friends</span>
          </button>
        </div>

        {/* Room Settings (Host Editable, Non-host Readonly) */}
        <div className="bg-white rounded-3xl p-4 shadow-sm border border-stone-200/90 space-y-3.5">
          <div className="flex items-center justify-between border-b border-stone-100 pb-2.5">
            <h3 className="text-xs font-bold text-stone-800 flex items-center gap-1.5 uppercase tracking-wider">
              <Sliders className="w-3.5 h-3.5 text-[#800020]" />
              <span>Battle Rules & Settings</span>
            </h3>
            {!isHost && (
              <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200/60">
                Set by Host
              </span>
            )}
          </div>

          {/* Question Source */}
          <div>
            <label className="block text-xs font-bold text-stone-700 mb-1.5">
              Question Source
            </label>
            {isHost ? (
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => onUpdateConfig({ questionSource: "curated" })}
                  className={`p-2.5 rounded-xl text-left border transition text-xs ${
                    roomConfig.questionSource === "curated"
                      ? "bg-amber-50 border-[#800020] text-[#800020] font-bold shadow-xs"
                      : "bg-stone-50 border-stone-200 text-stone-700 hover:bg-stone-100"
                  }`}
                >
                  <span className="block font-bold">🎯 Rajasthan GK Bank</span>
                  <span className="text-[10px] text-stone-500">40+ Authentic Questions</span>
                </button>

                <button
                  type="button"
                  onClick={() => onUpdateConfig({ questionSource: "custom_bank" })}
                  className={`p-2.5 rounded-xl text-left border transition text-xs ${
                    roomConfig.questionSource === "custom_bank"
                      ? "bg-amber-50 border-[#800020] text-[#800020] font-bold shadow-xs"
                      : "bg-stone-50 border-stone-200 text-stone-700 hover:bg-stone-100"
                  }`}
                >
                  <span className="block font-bold">📝 My Custom Questions</span>
                  <span className="text-[10px] text-stone-500">
                    {customQuestions.length > 0
                      ? `${customQuestions.length} Questions Available`
                      : "Custom Questions"}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => onUpdateConfig({ questionSource: "chapter" })}
                  className={`p-2.5 rounded-xl text-left border transition text-xs ${
                    roomConfig.questionSource === "chapter"
                      ? "bg-amber-50 border-[#800020] text-[#800020] font-bold shadow-xs"
                      : "bg-stone-50 border-stone-200 text-stone-700 hover:bg-stone-100"
                  }`}
                >
                  <span className="block font-bold">📚 By Chapter</span>
                  <span className="text-[10px] text-stone-500">Specific Chapter</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    onUpdateConfig({ questionSource: "manual_pick" });
                    setIsQuestionPickerOpen(true);
                  }}
                  className={`p-2.5 rounded-xl text-left border transition text-xs ${
                    roomConfig.questionSource === "manual_pick"
                      ? "bg-amber-50 border-[#800020] text-[#800020] font-bold shadow-xs"
                      : "bg-stone-50 border-stone-200 text-stone-700 hover:bg-stone-100"
                  }`}
                >
                  <span className="block font-bold flex items-center justify-between">
                    <span>✏️ Hand-Pick</span>
                    <Edit3 className="w-3 h-3 text-[#800020]" />
                  </span>
                  <span className="text-[10px] text-stone-500">
                    {roomConfig.selectedQuestionIds?.length || 0} questions picked
                  </span>
                </button>
              </div>
            ) : (
              <div className="text-xs font-bold text-stone-800 bg-amber-50/50 p-2.5 rounded-xl border border-amber-200/80">
                {roomConfig.questionSource === "custom_bank"
                  ? "📝 From My Custom Question Bank"
                  : roomConfig.questionSource === "chapter"
                  ? `📚 Chapter: ${roomConfig.selectedChapterTitle || "Assigned Chapter"}`
                  : roomConfig.questionSource === "manual_pick"
                  ? `✏️ ${roomConfig.selectedQuestionIds?.length || 0} specific questions picked by host`
                  : "🎯 Rajasthan GK Bank (Authentic Questions)"}
              </div>
            )}
          </div>

          {/* Sub-option: Chapter selector if source is "chapter" */}
          {roomConfig.questionSource === "chapter" && isHost && (
            <div className="bg-amber-50/70 p-3 rounded-2xl border border-amber-200/80">
              <label className="block text-xs font-bold text-amber-950 mb-1">
                Select Chapter
              </label>
              {availableChapters.length > 0 ? (
                <select
                  value={roomConfig.selectedChapterId || ""}
                  onChange={(e) => {
                    const ch = availableChapters.find((c) => c.id === e.target.value);
                    onUpdateConfig({
                      selectedChapterId: e.target.value,
                      selectedChapterTitle: ch?.title || "",
                    });
                  }}
                  className="w-full text-xs font-semibold bg-white border border-amber-300 rounded-xl p-2.5 text-stone-800 focus:outline-none focus:ring-2 focus:ring-[#800020]"
                >
                  <option value="">-- Select Chapter --</option>
                  {availableChapters.map((ch) => (
                    <option key={ch.id} value={ch.id}>
                      {ch.title} ({ch.count} Questions)
                    </option>
                  ))}
                </select>
              ) : (
                <p className="text-xs text-amber-800">
                  No custom chapters found currently.
                </p>
              )}
            </div>
          )}

          {/* Sub-option: Manual Pick Button if source is "manual_pick" */}
          {roomConfig.questionSource === "manual_pick" && isHost && (
            <div className="bg-amber-50/70 p-3 rounded-2xl border border-amber-200/80 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-stone-800">
                  {roomConfig.selectedQuestionIds?.length || 0} questions selected
                </p>
                <p className="text-[11px] text-stone-600">
                  Tap button to modify
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsQuestionPickerOpen(true)}
                className="px-3 py-1.5 rounded-xl bg-[#800020] text-white text-xs font-bold shadow-xs active:scale-95 transition"
              >
                Open Question List
              </button>
            </div>
          )}

          {/* Category Selector (if Curated) */}
          {roomConfig.questionSource === "curated" && (
            <div>
              <label className="block text-xs font-semibold text-stone-600 mb-1">
                Subject Category
              </label>
              {isHost ? (
                <select
                  value={roomConfig.category}
                  onChange={(e) =>
                    onUpdateConfig({ category: e.target.value as BattleCategory })
                  }
                  className="w-full text-sm font-semibold bg-stone-50 border border-stone-300 rounded-xl px-3 py-2 text-stone-800 focus:outline-none focus:ring-2 focus:ring-[#800020]"
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
          )}

          {/* Time Per Question (Default 10s) & Question Count */}
          <div className="grid grid-cols-2 gap-3 pt-1">
            <div className="bg-stone-50 p-2.5 rounded-2xl border border-stone-200/70">
              <label className="block text-[11px] font-bold text-stone-600 mb-1 flex items-center gap-1 uppercase tracking-wider">
                <Clock className="w-3 h-3 text-[#800020]" />
                <span>Time per Question</span>
              </label>
              {isHost ? (
                <div className="flex gap-1">
                  {[10, 15, 20].map((sec) => (
                    <button
                      key={sec}
                      type="button"
                      onClick={() => onUpdateConfig({ timePerQuestionSec: sec })}
                      className={`flex-1 py-1.5 text-xs font-bold rounded-lg border transition ${
                        (roomConfig.timePerQuestionSec || 10) === sec
                          ? "bg-[#800020] text-white border-[#800020] shadow-xs"
                          : "bg-white text-stone-700 border-stone-200 hover:bg-stone-100"
                      }`}
                    >
                      {sec}s {sec === 10 && "⚡"}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="text-xs font-bold text-stone-800 bg-white px-2.5 py-1.5 rounded-lg border border-stone-200">
                  {roomConfig.timePerQuestionSec || 10} seconds (Speed Mode)
                </div>
              )}
            </div>

            <div className="bg-stone-50 p-2.5 rounded-2xl border border-stone-200/70">
              <label className="block text-[11px] font-bold text-stone-600 mb-1 uppercase tracking-wider">
                Total Questions
              </label>
              {isHost ? (
                <div className="flex gap-1">
                  {[5, 10, 15].map((cnt) => (
                    <button
                      key={cnt}
                      type="button"
                      onClick={() => onUpdateConfig({ questionCount: cnt })}
                      className={`flex-1 py-1.5 text-xs font-bold rounded-lg border transition ${
                        roomConfig.questionCount === cnt
                          ? "bg-[#800020] text-white border-[#800020] shadow-xs"
                          : "bg-white text-stone-700 border-stone-200 hover:bg-stone-100"
                      }`}
                    >
                      {cnt}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="text-xs font-bold text-stone-800 bg-white px-2.5 py-1.5 rounded-lg border border-stone-200">
                  {roomConfig.questionCount} Questions
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Players List Card (Optimized for 2 to 100+ players) */}
        <div className="bg-white rounded-3xl p-4 shadow-sm border border-stone-200/90">
          <div className="flex items-center justify-between mb-2.5">
            <h3 className="text-xs font-bold text-stone-800 flex items-center gap-1.5 uppercase tracking-wider">
              <span>Players List</span>
              <span className="text-[10px] font-bold text-[#800020] bg-amber-100 px-2 py-0.5 rounded-full">
                {players.length} Joined
              </span>
            </h3>

            {isHost && (
              <button
                onClick={onAddBot}
                className="flex items-center gap-1 text-xs font-bold px-3 py-1 rounded-xl bg-amber-500 hover:bg-amber-600 text-stone-950 active:scale-95 transition shadow-xs border border-amber-300"
              >
                <Bot className="w-3.5 h-3.5" />
                <span>+ Add AI Bot</span>
              </button>
            )}
          </div>

          {/* Search bar if many users joined */}
          {players.length > 5 && (
            <div className="relative mb-2.5">
              <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 w-3.5 h-3.5 text-stone-400" />
              <input
                type="text"
                value={playerSearch}
                onChange={(e) => setPlayerSearch(e.target.value)}
                placeholder="Search players..."
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-[#800020]"
              />
            </div>
          )}

          <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
            {filteredPlayers.map((player) => {
              const isMe = player.id === myPlayerId;
              return (
                <div
                  key={player.id}
                  className={`flex items-center justify-between p-2.5 rounded-2xl border transition ${
                    isMe
                      ? "bg-amber-50/70 border-amber-300 ring-1 ring-amber-400/40"
                      : "bg-stone-50 border-stone-200/80"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <div className="relative text-2xl w-10 h-10 rounded-2xl bg-white shadow-xs border border-stone-200 flex items-center justify-center shrink-0">
                      <span>{player.avatar}</span>
                      {player.isHost && (
                        <div
                          className="absolute -top-1.5 -right-1.5 bg-amber-400 text-stone-900 rounded-full p-0.5 shadow"
                          title="Host"
                        >
                          <Crown className="w-3 h-3" />
                        </div>
                      )}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-extrabold text-xs sm:text-sm text-stone-800 truncate">
                          {player.name}
                        </span>
                        {isMe && (
                          <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-[#800020] text-white">
                            You
                          </span>
                        )}
                        {player.isBot && (
                          <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-blue-100 text-blue-800 border border-blue-200">
                            AI
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div>
                    {player.isHost ? (
                      <span className="text-[11px] font-bold text-amber-800 bg-amber-100 px-2.5 py-0.5 rounded-full border border-amber-200">
                        Host 👑
                      </span>
                    ) : player.isReady || player.isBot ? (
                      <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-800 bg-emerald-100 px-2.5 py-0.5 rounded-full border border-emerald-200">
                        <Check className="w-3 h-3 text-emerald-700" />
                        <span>Ready</span>
                      </span>
                    ) : (
                      <span className="text-[11px] font-medium text-stone-500 bg-stone-200 px-2.5 py-0.5 rounded-full">
                        Waiting
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {players.length === 1 && (
            <div className="mt-3 p-3 bg-amber-50 rounded-2xl border border-amber-200/80 text-center">
              <p className="text-xs text-amber-900 font-medium">
                💡 Friends can join anytime via link. You can also tap <b>+ Add AI Bot</b> above to practice instantly!
              </p>
            </div>
          )}
        </div>

        {/* Floating Emoji Reactions Bar */}
        <div className="bg-white rounded-2xl p-2.5 shadow-sm border border-stone-200/80 flex items-center justify-between">
          <span className="text-xs font-bold text-stone-500 flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span>Reactions:</span>
          </span>
          <div className="flex items-center gap-1.5">
            {QUICK_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                onClick={() => {
                  triggerHaptic("light");
                  onSendEmoji(emoji);
                }}
                className="w-8 h-8 flex items-center justify-center text-lg rounded-xl bg-stone-100 hover:bg-amber-100 active:scale-125 transition"
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Sticky Action Footer */}
      <div className="p-4 bg-white border-t border-stone-200 shadow-xl">
        {isHost ? (
          <div>
            <button
              onClick={onStartGame}
              disabled={!canStart}
              className={`w-full flex items-center justify-center gap-2 py-4 px-6 rounded-2xl font-extrabold text-base shadow-lg active:scale-98 transition ${
                canStart
                  ? "bg-gradient-to-r from-[#800020] via-[#A00028] to-[#800020] text-white hover:brightness-110 shadow-[#800020]/30 border border-amber-400/40"
                  : "bg-stone-200 text-stone-400 cursor-not-allowed"
              }`}
            >
              <Play className="w-5 h-5 fill-current" />
              <span>Start Battle ({players.length} Players)</span>
            </button>
            {!canStart ? (
              <p className="text-center text-xs text-stone-500 mt-2">
                Wait for at least 1 friend to join or tap + Add AI Bot above to start the battle.
              </p>
            ) : (
              <p className="text-center text-[11px] text-stone-500 mt-1.5">
                ⚡ Time: {roomConfig.timePerQuestionSec || 10}s per question • {readyCount}/{players.length} ready
              </p>
            )}
          </div>
        ) : (
          <button
            onClick={onToggleReady}
            className={`w-full flex items-center justify-center gap-2 py-4 px-6 rounded-2xl font-extrabold text-base shadow-lg active:scale-98 transition ${
              myPlayer?.isReady
                ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/30"
                : "bg-gradient-to-r from-amber-500 to-amber-600 hover:brightness-105 text-white shadow-amber-500/30"
            }`}
          >
            {myPlayer?.isReady ? (
              <>
                <Check className="w-5 h-5" />
                <span>Ready! (Tap to cancel)</span>
              </>
            ) : (
              <>
                <Flame className="w-5 h-5" />
                <span>I am Ready</span>
              </>
            )}
          </button>
        )}
      </div>

      {/* Custom Questions Selection Modal */}
      {isQuestionPickerOpen && (
        <CustomQuestionPickerModal
          isOpen={isQuestionPickerOpen}
          selectedIds={roomConfig.selectedQuestionIds || []}
          targetCount={roomConfig.questionCount || 10}
          onSave={(ids) => {
            onUpdateConfig({ selectedQuestionIds: ids });
          }}
          onClose={() => setIsQuestionPickerOpen(false)}
        />
      )}
    </div>
  );
};
