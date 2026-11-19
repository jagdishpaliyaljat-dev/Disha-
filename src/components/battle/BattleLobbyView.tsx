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
  Clock,
  BookOpen,
  Edit3,
  Search,
  Globe,
  Sliders,
  Swords,
  Layers,
  FolderOpen,
  Hash,
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
  getAvailableSubjectsList,
  getAvailableChaptersList,
  getAvailableTopicsList,
} from "../../utils/realtimeBattleService";
import { triggerHaptic, playClickSound } from "../../utils/audioFeedback";
import { CustomQuestionPickerModal } from "./CustomQuestionPickerModal";
import { BattleAvatar } from "./BattleAvatar";

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

const QUICK_EMOJIS = ["🔥", "🎯", "⚡", "💡", "👏", "🏆"];

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

  // Custom question count state
  const isPresetCount = [30, 50, 60].includes(roomConfig.questionCount);
  const [isCustomCountMode, setIsCustomCountMode] = useState(!isPresetCount);
  const [customCountInput, setCustomCountInput] = useState(String(roomConfig.questionCount || 30));

  const myPlayer = players.find((p) => p.id === myPlayerId);
  const shareInfo = getBattleShareInfo(roomConfig.roomCode, roomConfig.timePerQuestionSec || 10);

  const customQuestions = useMemo(() => getUserCustomQuestionsList(), []);
  const availableSubjects = useMemo(() => getAvailableSubjectsList(), []);
  const availableChapters = useMemo(
    () => getAvailableChaptersList(roomConfig.selectedSubjectId),
    [roomConfig.selectedSubjectId]
  );
  const availableTopics = useMemo(
    () => getAvailableTopicsList(roomConfig.selectedChapterId),
    [roomConfig.selectedChapterId]
  );

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
      {/* Top Minimal Premium Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-stone-900 text-white shadow-sm border-b border-stone-800">
        <button
          onClick={onLeaveRoom}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 active:scale-95 transition text-xs font-semibold border border-white/10"
        >
          <ArrowLeft className="w-4 h-4 text-amber-300" />
          <span>Leave</span>
        </button>

        <div className="flex items-center gap-2">
          <div className="p-1 rounded-lg bg-amber-500/20 text-amber-400">
            <Swords className="w-4 h-4" />
          </div>
          <h2 className="text-sm sm:text-base font-bold tracking-tight">
            Battle Arena Lobby
          </h2>
        </div>

        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-semibold">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping inline-block" />
          <span>{players.length} Live</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {/* Room Code & Direct Link Invite Card */}
        <div className="relative bg-white rounded-3xl p-4 sm:p-5 shadow-sm border border-stone-200 text-center">
          <div className="flex items-center justify-center gap-1.5 text-xs font-bold text-stone-500 uppercase tracking-wider mb-2">
            <Globe className="w-3.5 h-3.5 text-[#800020]" />
            <span>Open Link Battle • Anyone can join directly</span>
          </div>

          <div className="flex items-center justify-center gap-3 my-2">
            <div className="relative px-6 py-2.5 rounded-2xl bg-stone-50 border border-stone-300 shadow-inner">
              <span className="text-3xl sm:text-4xl font-black tracking-widest font-mono text-[#800020]">
                {roomConfig.roomCode}
              </span>
            </div>

            <button
              onClick={handleCopyCode}
              title="Copy Code"
              className="p-3 rounded-2xl bg-amber-50 hover:bg-amber-100 text-[#800020] active:scale-90 transition border border-amber-200 shadow-xs flex items-center justify-center"
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
              Room code copied to clipboard!
            </p>
          ) : (
            <p className="text-xs text-stone-500 my-1">
              Share this code or tap below to send the direct invite link.
            </p>
          )}

          <button
            onClick={handleWhatsAppShare}
            className="w-full mt-2.5 flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-700 text-white font-bold text-sm shadow-sm active:scale-98 transition hover:brightness-105"
          >
            <Share2 className="w-4 h-4" />
            <span>Share Direct Join Link</span>
          </button>
        </div>

        {/* Room Settings Card (Host Configurable) */}
        <div className="bg-white rounded-3xl p-4 shadow-sm border border-stone-200 space-y-4">
          <div className="flex items-center justify-between border-b border-stone-100 pb-2.5">
            <h3 className="text-xs font-bold text-stone-700 flex items-center gap-1.5 uppercase tracking-wider">
              <Sliders className="w-3.5 h-3.5 text-[#800020]" />
              <span>Battle Settings</span>
            </h3>
            {!isHost && (
              <span className="text-[10px] font-bold text-amber-800 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200">
                Host Configured
              </span>
            )}
          </div>

          {/* Question Source Selection */}
          <div>
            <label className="block text-xs font-bold text-stone-700 mb-2 flex items-center justify-between">
              <span>Question Source</span>
              <span className="text-[10px] font-semibold text-stone-500">
                {roomConfig.questionSource === "curated" && "Curated Pool"}
                {roomConfig.questionSource === "subject" && "Subject-Wise"}
                {roomConfig.questionSource === "chapter" && "Chapter-Wise"}
                {roomConfig.questionSource === "topic" && "Topic-Wise"}
                {roomConfig.questionSource === "manual_pick" && "Hand-Picked"}
                {roomConfig.questionSource === "custom_bank" && "Custom Bank"}
              </span>
            </label>

            {isHost ? (
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => onUpdateConfig({ questionSource: "curated" })}
                  className={`p-2.5 rounded-2xl text-left border transition text-xs ${
                    roomConfig.questionSource === "curated"
                      ? "bg-amber-50/80 border-[#800020] text-[#800020] font-bold shadow-xs"
                      : "bg-stone-50 border-stone-200 text-stone-700 hover:bg-stone-100"
                  }`}
                >
                  <span className="block font-bold">Curated GK</span>
                  <span className="text-[10px] text-stone-500 block truncate">High-Yield</span>
                </button>

                <button
                  type="button"
                  onClick={() => onUpdateConfig({ questionSource: "subject" })}
                  className={`p-2.5 rounded-2xl text-left border transition text-xs ${
                    roomConfig.questionSource === "subject"
                      ? "bg-amber-50/80 border-[#800020] text-[#800020] font-bold shadow-xs"
                      : "bg-stone-50 border-stone-200 text-stone-700 hover:bg-stone-100"
                  }`}
                >
                  <span className="block font-bold">By Subject</span>
                  <span className="text-[10px] text-stone-500 block truncate">Select Sub</span>
                </button>

                <button
                  type="button"
                  onClick={() => onUpdateConfig({ questionSource: "chapter" })}
                  className={`p-2.5 rounded-2xl text-left border transition text-xs ${
                    roomConfig.questionSource === "chapter"
                      ? "bg-amber-50/80 border-[#800020] text-[#800020] font-bold shadow-xs"
                      : "bg-stone-50 border-stone-200 text-stone-700 hover:bg-stone-100"
                  }`}
                >
                  <span className="block font-bold">By Chapter</span>
                  <span className="text-[10px] text-stone-500 block truncate">Select Chap</span>
                </button>

                <button
                  type="button"
                  onClick={() => onUpdateConfig({ questionSource: "topic" })}
                  className={`p-2.5 rounded-2xl text-left border transition text-xs ${
                    roomConfig.questionSource === "topic"
                      ? "bg-amber-50/80 border-[#800020] text-[#800020] font-bold shadow-xs"
                      : "bg-stone-50 border-stone-200 text-stone-700 hover:bg-stone-100"
                  }`}
                >
                  <span className="block font-bold">By Topic</span>
                  <span className="text-[10px] text-stone-500 block truncate">Specific Topic</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    onUpdateConfig({ questionSource: "manual_pick" });
                    setIsQuestionPickerOpen(true);
                  }}
                  className={`p-2.5 rounded-2xl text-left border transition text-xs ${
                    roomConfig.questionSource === "manual_pick"
                      ? "bg-amber-50/80 border-[#800020] text-[#800020] font-bold shadow-xs"
                      : "bg-stone-50 border-stone-200 text-stone-700 hover:bg-stone-100"
                  }`}
                >
                  <span className="block font-bold">Hand-Pick</span>
                  <span className="text-[10px] text-stone-500 block truncate">
                    {roomConfig.selectedQuestionIds?.length || 0} Picked
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => onUpdateConfig({ questionSource: "custom_bank" })}
                  className={`p-2.5 rounded-2xl text-left border transition text-xs ${
                    roomConfig.questionSource === "custom_bank"
                      ? "bg-amber-50/80 border-[#800020] text-[#800020] font-bold shadow-xs"
                      : "bg-stone-50 border-stone-200 text-stone-700 hover:bg-stone-100"
                  }`}
                >
                  <span className="block font-bold">Custom Bank</span>
                  <span className="text-[10px] text-stone-500 block truncate">My Questions</span>
                </button>
              </div>
            ) : (
              <div className="text-xs font-semibold text-stone-800 bg-stone-50 p-3 rounded-2xl border border-stone-200">
                {roomConfig.questionSource === "subject" &&
                  `Subject: ${roomConfig.selectedSubjectTitle || "Selected Subject"}`}
                {roomConfig.questionSource === "chapter" &&
                  `Chapter: ${roomConfig.selectedChapterTitle || "Selected Chapter"}`}
                {roomConfig.questionSource === "topic" &&
                  `Topic: ${roomConfig.selectedTopicTitle || "Selected Topic"}`}
                {roomConfig.questionSource === "manual_pick" &&
                  `${roomConfig.selectedQuestionIds?.length || 0} Questions hand-picked by host`}
                {roomConfig.questionSource === "custom_bank" && "User Custom Questions Bank"}
                {roomConfig.questionSource === "curated" && "Curated Rajasthan GK Bank"}
              </div>
            )}
          </div>

          {/* Sub-selectors for Subject / Chapter / Topic */}
          {isHost && roomConfig.questionSource === "subject" && (
            <div className="bg-amber-50/60 p-3 rounded-2xl border border-amber-200/80">
              <label className="block text-xs font-bold text-stone-700 mb-1">
                Select Subject
              </label>
              <select
                value={roomConfig.selectedSubjectId || ""}
                onChange={(e) => {
                  const s = availableSubjects.find((x) => x.id === e.target.value);
                  onUpdateConfig({
                    selectedSubjectId: e.target.value,
                    selectedSubjectTitle: s?.title || "",
                  });
                }}
                className="w-full text-xs font-semibold bg-white border border-amber-300 rounded-xl p-2.5 text-stone-800 focus:outline-none focus:ring-2 focus:ring-[#800020]"
              >
                <option value="">-- Choose Subject --</option>
                {availableSubjects.map((sub) => (
                  <option key={sub.id} value={sub.id}>
                    {sub.title} ({sub.count} Questions)
                  </option>
                ))}
              </select>
            </div>
          )}

          {isHost && roomConfig.questionSource === "chapter" && (
            <div className="bg-amber-50/60 p-3 rounded-2xl border border-amber-200/80">
              <label className="block text-xs font-bold text-stone-700 mb-1">
                Select Chapter
              </label>
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
                <option value="">-- Choose Chapter --</option>
                {availableChapters.map((ch) => (
                  <option key={ch.id} value={ch.id}>
                    {ch.title} ({ch.count} Questions)
                  </option>
                ))}
              </select>
            </div>
          )}

          {isHost && roomConfig.questionSource === "topic" && (
            <div className="bg-amber-50/60 p-3 rounded-2xl border border-amber-200/80 space-y-2.5">
              <div>
                <label className="block text-[11px] font-bold text-stone-700 mb-1">
                  1. Filter by Chapter
                </label>
                <select
                  value={roomConfig.selectedChapterId || ""}
                  onChange={(e) => {
                    const ch = availableChapters.find((c) => c.id === e.target.value);
                    onUpdateConfig({
                      selectedChapterId: e.target.value,
                      selectedChapterTitle: ch?.title || "",
                      selectedTopicId: "",
                      selectedTopicTitle: "",
                    });
                  }}
                  className="w-full text-xs font-semibold bg-white border border-amber-300 rounded-xl p-2 text-stone-800 focus:outline-none focus:ring-2 focus:ring-[#800020]"
                >
                  <option value="">-- All Chapters --</option>
                  {availableChapters.map((ch) => (
                    <option key={ch.id} value={ch.id}>
                      {ch.title}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-stone-700 mb-1">
                  2. Select Topic
                </label>
                <select
                  value={roomConfig.selectedTopicId || ""}
                  onChange={(e) => {
                    const top = availableTopics.find((t) => t.id === e.target.value);
                    onUpdateConfig({
                      selectedTopicId: e.target.value,
                      selectedTopicTitle: top?.title || "",
                    });
                  }}
                  className="w-full text-xs font-semibold bg-white border border-amber-300 rounded-xl p-2 text-stone-800 focus:outline-none focus:ring-2 focus:ring-[#800020]"
                >
                  <option value="">-- Choose Topic --</option>
                  {availableTopics.map((top) => (
                    <option key={top.id} value={top.id}>
                      {top.title} ({top.count} Questions)
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {isHost && roomConfig.questionSource === "manual_pick" && (
            <div className="bg-amber-50/60 p-3 rounded-2xl border border-amber-200/80 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-stone-800">
                  {roomConfig.selectedQuestionIds?.length || 0} questions selected
                </p>
                <p className="text-[11px] text-stone-500">Hand-picked by host</p>
              </div>
              <button
                type="button"
                onClick={() => setIsQuestionPickerOpen(true)}
                className="px-3 py-1.5 rounded-xl bg-[#800020] text-white text-xs font-bold shadow-xs active:scale-95 transition"
              >
                Modify Questions
              </button>
            </div>
          )}

          {/* Time Per Question (5s, 10s, 15s) */}
          <div className="bg-stone-50 p-3 rounded-2xl border border-stone-200">
            <label className="block text-xs font-bold text-stone-700 mb-2 flex items-center justify-between">
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-[#800020]" />
                <span>Time per Question</span>
              </span>
              <span className="text-[10px] text-stone-500">
                {roomConfig.timePerQuestionSec || 10} seconds
              </span>
            </label>
            {isHost ? (
              <div className="flex gap-2">
                {[5, 10, 15].map((sec) => (
                  <button
                    key={sec}
                    type="button"
                    onClick={() => onUpdateConfig({ timePerQuestionSec: sec })}
                    className={`flex-1 py-2 text-xs font-bold rounded-xl border transition ${
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
              <div className="text-xs font-semibold text-stone-800 bg-white px-3 py-2 rounded-xl border border-stone-200">
                {roomConfig.timePerQuestionSec || 10} seconds per question
              </div>
            )}
          </div>

          {/* Total Questions: 30, 50, 60, or Customize */}
          <div className="bg-stone-50 p-3 rounded-2xl border border-stone-200">
            <label className="block text-xs font-bold text-stone-700 mb-2 flex items-center justify-between">
              <span>Total Questions</span>
              <span className="text-[10px] font-bold text-[#800020]">
                {roomConfig.questionCount} Questions
              </span>
            </label>
            {isHost ? (
              <div className="space-y-2">
                <div className="grid grid-cols-4 gap-2">
                  {[30, 50, 60].map((cnt) => (
                    <button
                      key={cnt}
                      type="button"
                      onClick={() => {
                        setIsCustomCountMode(false);
                        onUpdateConfig({ questionCount: cnt });
                      }}
                      className={`py-2 text-xs font-bold rounded-xl border transition ${
                        !isCustomCountMode && roomConfig.questionCount === cnt
                          ? "bg-[#800020] text-white border-[#800020] shadow-xs"
                          : "bg-white text-stone-700 border-stone-200 hover:bg-stone-100"
                      }`}
                    >
                      {cnt}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setIsCustomCountMode(true)}
                    className={`py-2 text-xs font-bold rounded-xl border transition ${
                      isCustomCountMode
                        ? "bg-[#800020] text-white border-[#800020] shadow-xs"
                        : "bg-white text-stone-700 border-stone-200 hover:bg-stone-100"
                    }`}
                  >
                    Custom
                  </button>
                </div>

                {isCustomCountMode && (
                  <div className="flex items-center gap-2 pt-1 animate-in fade-in">
                    <input
                      type="number"
                      min={5}
                      max={100}
                      value={customCountInput}
                      onChange={(e) => {
                        const val = e.target.value;
                        setCustomCountInput(val);
                        const num = parseInt(val, 10);
                        if (!isNaN(num) && num >= 5 && num <= 100) {
                          onUpdateConfig({ questionCount: num });
                        }
                      }}
                      placeholder="e.g. 40"
                      className="flex-1 px-3 py-2 text-xs font-bold bg-white border border-stone-300 rounded-xl text-stone-800 focus:outline-none focus:ring-2 focus:ring-[#800020]"
                    />
                    <span className="text-xs text-stone-500 font-medium">questions</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-xs font-semibold text-stone-800 bg-white px-3 py-2 rounded-xl border border-stone-200">
                {roomConfig.questionCount} Questions
              </div>
            )}
          </div>
        </div>

        {/* Players List Card with Anime Avatars */}
        <div className="bg-white rounded-3xl p-4 shadow-sm border border-stone-200">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-bold text-stone-800 flex items-center gap-1.5 uppercase tracking-wider">
              <Users className="w-3.5 h-3.5 text-[#800020]" />
              <span>Joined Players</span>
              <span className="text-[10px] font-bold text-[#800020] bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                {players.length} Active
              </span>
            </h3>

            {isHost && (
              <button
                onClick={onAddBot}
                className="flex items-center gap-1 text-xs font-semibold px-3 py-1 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-800 active:scale-95 transition border border-stone-200"
              >
                <Bot className="w-3.5 h-3.5 text-[#800020]" />
                <span>+ Add Bot</span>
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
                      ? "bg-amber-50/60 border-amber-300 ring-1 ring-amber-300/40"
                      : "bg-stone-50 border-stone-200"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <div className="relative">
                      <BattleAvatar
                        avatar={player.avatar}
                        name={player.name}
                        size="md"
                        showBadge
                      />
                      {player.isHost && (
                        <div
                          className="absolute -top-1 -right-1 bg-amber-400 text-stone-900 rounded-full p-0.5 shadow-xs"
                          title="Host"
                        >
                          <Crown className="w-2.5 h-2.5" />
                        </div>
                      )}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-xs sm:text-sm text-stone-800 truncate">
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
                      <span className="text-[11px] font-bold text-amber-900 bg-amber-100/80 px-2.5 py-0.5 rounded-full border border-amber-200">
                        Host
                      </span>
                    ) : player.isReady || player.isBot ? (
                      <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-800 bg-emerald-100/80 px-2.5 py-0.5 rounded-full border border-emerald-200">
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
            <div className="mt-3 p-3 bg-amber-50/70 rounded-2xl border border-amber-200 text-center">
              <p className="text-xs text-amber-900 font-medium">
                Direct link is active. Friends can join with 1 click, or tap <b>+ Add Bot</b> to start practicing immediately.
              </p>
            </div>
          )}
        </div>

        {/* Quick Reactions Bar */}
        <div className="bg-white rounded-2xl p-2.5 shadow-sm border border-stone-200 flex items-center justify-between">
          <span className="text-xs font-semibold text-stone-500 flex items-center gap-1">
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
                className="w-8 h-8 flex items-center justify-center text-lg rounded-xl bg-stone-50 hover:bg-amber-100 active:scale-125 transition border border-stone-200"
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Sticky Action Footer */}
      <div className="p-4 bg-white border-t border-stone-200 shadow-md">
        {isHost ? (
          <div>
            <button
              onClick={onStartGame}
              disabled={!canStart}
              className={`w-full flex items-center justify-center gap-2 py-3.5 px-6 rounded-2xl font-bold text-base shadow-sm active:scale-98 transition ${
                canStart
                  ? "bg-[#800020] hover:bg-[#68001a] text-white shadow-[#800020]/20"
                  : "bg-stone-200 text-stone-400 cursor-not-allowed"
              }`}
            >
              <Play className="w-4 h-4 fill-current" />
              <span>Start Battle ({players.length} Players)</span>
            </button>
            {!canStart ? (
              <p className="text-center text-xs text-stone-500 mt-2">
                Need at least 1 more player or tap + Add Bot to launch.
              </p>
            ) : (
              <p className="text-center text-[11px] text-stone-500 mt-1.5">
                {roomConfig.timePerQuestionSec || 10}s per question • {roomConfig.questionCount} questions • {readyCount}/{players.length} ready
              </p>
            )}
          </div>
        ) : (
          <button
            onClick={onToggleReady}
            className={`w-full flex items-center justify-center gap-2 py-3.5 px-6 rounded-2xl font-bold text-base shadow-sm active:scale-98 transition ${
              myPlayer?.isReady
                ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                : "bg-amber-600 hover:bg-amber-700 text-white"
            }`}
          >
            {myPlayer?.isReady ? (
              <>
                <Check className="w-5 h-5" />
                <span>You are Ready</span>
              </>
            ) : (
              <span>Tap when Ready</span>
            )}
          </button>
        )}
      </div>

      {/* Question Picker Modal (if host chooses manual pick) */}
      {isQuestionPickerOpen && (
        <CustomQuestionPickerModal
          isOpen={isQuestionPickerOpen}
          selectedIds={roomConfig.selectedQuestionIds || []}
          targetCount={roomConfig.questionCount}
          onSave={(newIds) => {
            onUpdateConfig({ selectedQuestionIds: newIds });
            setIsQuestionPickerOpen(false);
          }}
          onClose={() => setIsQuestionPickerOpen(false)}
        />
      )}
    </div>
  );
};
