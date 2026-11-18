import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  X,
  Swords,
  Users,
  Sparkles,
  ArrowRight,
  Shield,
  Zap,
  Bot,
  AlertCircle,
  Clock,
} from "lucide-react";
import { CustomQuestionPickerModal } from "./CustomQuestionPickerModal";
import type {
  BattlePlayer,
  BattleQuestion,
  BattleRoomConfig,
  BattlePhase,
  BattleCategory,
  QuestionSourceType,
  FloatingEmoji,
  BattleEventMessage,
} from "./types";
import {
  generateRoomCode,
  PLAYER_AVATARS,
  BOT_OPPONENTS,
  getBattleQuestions,
  calculateRoundScore,
  getUserCustomQuestionsList,
  getAvailableChaptersList,
  RealtimeBattleManager,
} from "../../utils/realtimeBattleService";
import { loadUserProfile } from "../../utils/userProfileStorage";
import {
  playClickSound,
  playCorrectSound,
  playWrongSound,
  playTickSound,
  triggerHaptic,
} from "../../utils/audioFeedback";
import { BattleLobbyView } from "./BattleLobbyView";
import { BattleArenaView } from "./BattleArenaView";
import { BattlePodiumView } from "./BattlePodiumView";

interface LiveBattleModalProps {
  isOpen: boolean;
  initialRoomCode?: string;
  onClose: () => void;
}

export const LiveBattleModal: React.FC<LiveBattleModalProps> = ({
  isOpen,
  initialRoomCode = "",
  onClose,
}) => {
  // Initial screen tab
  const [activeTab, setActiveTab] = useState<"create" | "join">(
    initialRoomCode ? "join" : "create"
  );

  // Player Profile State
  const [playerName, setPlayerName] = useState<string>(() => {
    try {
      const profile = loadUserProfile();
      return profile?.name || "अभ्यर्थी";
    } catch {
      return "अभ्यर्थी";
    }
  });
  const [selectedAvatar, setSelectedAvatar] = useState<string>(() => {
    return PLAYER_AVATARS[Math.floor(Math.random() * PLAYER_AVATARS.length)];
  });
  const [myPlayerId] = useState<string>(() => {
    return "player_" + Math.random().toString(36).substring(2, 9);
  });

  // Room config state
  const [inputRoomCode, setInputRoomCode] = useState<string>(initialRoomCode);
  const [selectedCategory, setSelectedCategory] = useState<BattleCategory>("all");
  const [questionCount, setQuestionCount] = useState<number>(10);
  const [timePerQuestionSec, setTimePerQuestionSec] = useState<number>(10);
  const [questionSource, setQuestionSource] = useState<QuestionSourceType>("curated");
  const [selectedChapterId, setSelectedChapterId] = useState<string>("");
  const [selectedChapterTitle, setSelectedChapterTitle] = useState<string>("");
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<string[]>([]);
  const [isQuestionPickerOpen, setIsQuestionPickerOpen] = useState(false);

  // Active Game State
  const [phase, setPhase] = useState<BattlePhase>("initial");
  const [roomConfig, setRoomConfig] = useState<BattleRoomConfig>({
    roomCode: "",
    hostId: "",
    questionCount: 10,
    timePerQuestionSec: 10,
    category: "all",
    questionSource: "curated",
    allowUnlimitedUsers: true,
    createdAt: Date.now(),
  });
  const [players, setPlayers] = useState<BattlePlayer[]>([]);
  const [questions, setQuestions] = useState<BattleQuestion[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState<number>(0);
  const [timeRemainingSec, setTimeRemainingSec] = useState<number>(10);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [hasLockedAnswer, setHasLockedAnswer] = useState<boolean>(false);
  const [isRevealing, setIsRevealing] = useState<boolean>(false);
  const [countdownNum, setCountdownNum] = useState<number>(3);
  const [floatingEmojis, setFloatingEmojis] = useState<FloatingEmoji[]>([]);
  const [showExitConfirm, setShowExitConfirm] = useState<boolean>(false);

  const managerRef = useRef<RealtimeBattleManager | null>(null);
  const roundTimerRef = useRef<NodeJS.Timeout | null>(null);
  const revealTimerRef = useRef<NodeJS.Timeout | null>(null);
  const botAnswerTimerRef = useRef<NodeJS.Timeout | null>(null);
  const roundStartTimeRef = useRef<number>(Date.now());

  const isHost = roomConfig.hostId === myPlayerId;

  // Handle incoming broadcast events
  const handleIncomingEvent = useCallback(
    (event: BattleEventMessage) => {
      if (!event || !event.type) return;

      switch (event.type) {
        case "JOIN": {
          const newPlayer = event.payload?.player as BattlePlayer;
          if (newPlayer) {
            setPlayers((prev) => {
              if (prev.some((p) => p.id === newPlayer.id)) return prev;
              return [...prev, newPlayer];
            });
            // If I am the host, broadcast ROOM_STATE_SYNC so new players who join via link receive settings
            if (managerRef.current) {
              managerRef.current.broadcastEvent("ROOM_STATE_SYNC", {
                config: roomConfig,
                players: [...players, newPlayer],
              });
            }
          }
          break;
        }

        case "ROOM_STATE_SYNC": {
          const { config: syncedConfig, players: syncedPlayers } = event.payload;
          if (syncedConfig) setRoomConfig(syncedConfig);
          if (Array.isArray(syncedPlayers)) {
            setPlayers((prev) => {
              const map = new Map<string, BattlePlayer>();
              syncedPlayers.forEach((p) => map.set(p.id, p));
              prev.forEach((p) => map.set(p.id, { ...(map.get(p.id) || {}), ...p }));
              return Array.from(map.values());
            });
          }
          break;
        }

        case "READY_TOGGLE": {
          const { playerId, isReady } = event.payload;
          setPlayers((prev) =>
            prev.map((p) => (p.id === playerId ? { ...p, isReady } : p))
          );
          break;
        }

        case "START_GAME": {
          const { questions: battleQuestions, config } = event.payload;
          if (Array.isArray(battleQuestions) && battleQuestions.length > 0) {
            setQuestions(battleQuestions);
            if (config) setRoomConfig(config);
            setPhase("countdown");
            setCountdownNum(3);
          }
          break;
        }

        case "ANSWER_SUBMIT": {
          const { playerId, optionIndex, pointsEarned, isCorrect, streak } =
            event.payload;
          setPlayers((prev) =>
            prev.map((p) => {
              if (p.id === playerId) {
                return {
                  ...p,
                  score: p.score + pointsEarned,
                  streak,
                  correctCount: p.correctCount + (isCorrect ? 1 : 0),
                  wrongCount: p.wrongCount + (isCorrect ? 0 : 1),
                  lastAnswer: {
                    questionIndex: currentQuestionIndex,
                    selectedOption: optionIndex,
                    timeTakenMs: 0,
                    isCorrect,
                    pointsEarned,
                  },
                };
              }
              return p;
            })
          );
          break;
        }

        case "REACTION": {
          const { emoji, fromPlayerName } = event.payload;
          const newEmoji: FloatingEmoji = {
            id: Math.random().toString(),
            emoji,
            fromPlayerName,
            timestamp: Date.now(),
          };
          setFloatingEmojis((prev) => [...prev, newEmoji]);
          setTimeout(() => {
            setFloatingEmojis((prev) => prev.filter((e) => e.id !== newEmoji.id));
          }, 2500);
          break;
        }

        case "REMATCH": {
          const { questions: newQuestions } = event.payload;
          setQuestions(newQuestions || []);
          setCurrentQuestionIndex(0);
          setPlayers((prev) =>
            prev.map((p) => ({
              ...p,
              score: 0,
              streak: 0,
              correctCount: 0,
              wrongCount: 0,
              lastAnswer: null,
            }))
          );
          setPhase("countdown");
          setCountdownNum(3);
          break;
        }

        case "PLAYER_LEAVE": {
          const { playerId } = event.payload;
          setPlayers((prev) => prev.filter((p) => p.id !== playerId));
          break;
        }

        default:
          break;
      }
    },
    [currentQuestionIndex]
  );

  // Sync presence callback
  const handlePresenceUpdate = useCallback(
    (presentPlayers: BattlePlayer[]) => {
      setPlayers((prev) => {
        const merged = [...prev];
        presentPlayers.forEach((p) => {
          const idx = merged.findIndex((m) => m.id === p.id);
          if (idx >= 0) {
            merged[idx] = { ...merged[idx], ...p };
          } else {
            merged.push(p);
          }
        });
        return merged;
      });
    },
    []
  );

  // Cleanup on unmount or close
  useEffect(() => {
    return () => {
      if (managerRef.current) {
        managerRef.current.disconnect();
        managerRef.current = null;
      }
      if (roundTimerRef.current) clearInterval(roundTimerRef.current);
      if (revealTimerRef.current) clearTimeout(revealTimerRef.current);
      if (botAnswerTimerRef.current) clearTimeout(botAnswerTimerRef.current);
    };
  }, []);

  // Update input code if initialRoomCode changes
  useEffect(() => {
    if (initialRoomCode) {
      setInputRoomCode(initialRoomCode.toUpperCase().trim());
      setActiveTab("join");
    }
  }, [initialRoomCode]);

  // Handle Create Room
  const handleCreateRoom = () => {
    triggerHaptic("medium");
    playClickSound();

    const code = generateRoomCode();
    const config: BattleRoomConfig = {
      roomCode: code,
      hostId: myPlayerId,
      questionCount,
      timePerQuestionSec: timePerQuestionSec || 10,
      category: selectedCategory,
      questionSource,
      selectedChapterId,
      selectedChapterTitle,
      selectedQuestionIds,
      allowUnlimitedUsers: true,
      createdAt: Date.now(),
    };

    const hostPlayer: BattlePlayer = {
      id: myPlayerId,
      name: playerName.trim() || "आयोजक",
      avatar: selectedAvatar,
      isHost: true,
      isReady: true,
      score: 0,
      streak: 0,
      correctCount: 0,
      wrongCount: 0,
      avgResponseTimeMs: 0,
    };

    setRoomConfig(config);
    setPlayers([hostPlayer]);

    // Connect to Realtime
    const manager = new RealtimeBattleManager(
      code,
      hostPlayer,
      handleIncomingEvent,
      handlePresenceUpdate
    );
    manager.connect();
    managerRef.current = manager;

    setPhase("lobby");
  };

  // Handle Join Room with Code
  const handleJoinRoom = () => {
    const code = inputRoomCode.toUpperCase().trim();
    if (!code || code.length < 4) {
      alert("कृपया मान्य 6-अंकों का कमरा कोड दर्ज करें।");
      return;
    }

    triggerHaptic("medium");
    playClickSound();

    const joinerPlayer: BattlePlayer = {
      id: myPlayerId,
      name: playerName.trim() || "खिलाड़ी",
      avatar: selectedAvatar,
      isHost: false,
      isReady: false,
      score: 0,
      streak: 0,
      correctCount: 0,
      wrongCount: 0,
      avgResponseTimeMs: 0,
    };

    const initialConfig: BattleRoomConfig = {
      roomCode: code,
      hostId: "",
      questionCount: 10,
      timePerQuestionSec: 10,
      category: "all",
      questionSource: "curated",
      allowUnlimitedUsers: true,
      createdAt: Date.now(),
    };

    setRoomConfig(initialConfig);
    setPlayers([joinerPlayer]);

    // Connect to Realtime & announce self
    const manager = new RealtimeBattleManager(
      code,
      joinerPlayer,
      handleIncomingEvent,
      handlePresenceUpdate
    );
    manager.connect();
    managerRef.current = manager;

    setTimeout(() => {
      manager.broadcastEvent("JOIN", { player: joinerPlayer });
    }, 500);

    setPhase("lobby");
  };

  // Add simulated AI Bot Opponent (for immediate solo testing)
  const handleAddBot = () => {
    triggerHaptic("light");
    playClickSound();

    const randomBot =
      BOT_OPPONENTS[Math.floor(Math.random() * BOT_OPPONENTS.length)];
    const botPlayer: BattlePlayer = {
      ...randomBot,
      id: "bot_" + Math.random().toString(36).substring(2, 7),
    };

    setPlayers((prev) => [...prev, botPlayer]);
  };

  // Toggle Ready State for non-host
  const handleToggleReady = () => {
    triggerHaptic("light");
    playClickSound();

    const myPlayer = players.find((p) => p.id === myPlayerId);
    const newReady = !myPlayer?.isReady;

    setPlayers((prev) =>
      prev.map((p) => (p.id === myPlayerId ? { ...p, isReady: newReady } : p))
    );

    if (managerRef.current) {
      managerRef.current.broadcastEvent("READY_TOGGLE", {
        playerId: myPlayerId,
        isReady: newReady,
      });
    }
  };

  // Update room settings (host only)
  const handleUpdateConfig = (newConfig: Partial<BattleRoomConfig>) => {
    setRoomConfig((prev) => ({ ...prev, ...newConfig }));
  };

  // Host starts game
  const handleStartGame = () => {
    triggerHaptic("medium");
    playClickSound();

    const sampledQuestions = getBattleQuestions({
      category: roomConfig.category,
      count: roomConfig.questionCount,
      questionSource: roomConfig.questionSource,
      selectedChapterId: roomConfig.selectedChapterId,
      selectedQuestionIds: roomConfig.selectedQuestionIds,
    });

    setQuestions(sampledQuestions);

    if (managerRef.current) {
      managerRef.current.broadcastEvent("START_GAME", {
        questions: sampledQuestions,
        config: roomConfig,
      });
    }

    setPhase("countdown");
    setCountdownNum(3);
  };

  // Countdown timer effect
  useEffect(() => {
    if (phase !== "countdown") return;

    playTickSound();
    triggerHaptic("light");

    if (countdownNum > 1) {
      const timer = setTimeout(() => {
        setCountdownNum((prev) => prev - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else {
      const timer = setTimeout(() => {
        setPhase("question_active");
        setCurrentQuestionIndex(0);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [phase, countdownNum]);

  // Round progression and timer effect
  useEffect(() => {
    if (phase !== "question_active") return;

    setSelectedOption(null);
    setHasLockedAnswer(false);
    setIsRevealing(false);
    setTimeRemainingSec(roomConfig.timePerQuestionSec);
    roundStartTimeRef.current = Date.now();

    // Start round clock
    if (roundTimerRef.current) clearInterval(roundTimerRef.current);

    roundTimerRef.current = setInterval(() => {
      setTimeRemainingSec((prev) => {
        if (prev <= 4 && prev > 1) {
          playTickSound();
          triggerHaptic("light");
        }
        if (prev <= 1) {
          if (roundTimerRef.current) clearInterval(roundTimerRef.current);
          handleRoundTimeUp();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    // Simulate AI Bot answer if bot is in match
    const botPlayer = players.find((p) => p.isBot);
    if (botPlayer) {
      const currentQ = questions[currentQuestionIndex];
      const botDelay = Math.floor(Math.random() * 4000) + 3000; // 3-7s delay
      const botIsCorrect = Math.random() < 0.75; // 75% accuracy
      const botOption = botIsCorrect
        ? currentQ.correctIndex
        : (currentQ.correctIndex + 1) % currentQ.options.length;

      if (botAnswerTimerRef.current) clearTimeout(botAnswerTimerRef.current);
      botAnswerTimerRef.current = setTimeout(() => {
        const { points, newStreak } = calculateRoundScore(
          botIsCorrect,
          botDelay,
          roomConfig.timePerQuestionSec,
          botPlayer.streak
        );

        setPlayers((prev) =>
          prev.map((p) =>
            p.id === botPlayer.id
              ? {
                  ...p,
                  score: p.score + points,
                  streak: newStreak,
                  correctCount: p.correctCount + (botIsCorrect ? 1 : 0),
                  wrongCount: p.wrongCount + (botIsCorrect ? 0 : 1),
                  lastAnswer: {
                    questionIndex: currentQuestionIndex,
                    selectedOption: botOption,
                    timeTakenMs: botDelay,
                    isCorrect: botIsCorrect,
                    pointsEarned: points,
                  },
                }
              : p
          )
        );
      }, botDelay);
    }

    return () => {
      if (roundTimerRef.current) clearInterval(roundTimerRef.current);
      if (botAnswerTimerRef.current) clearTimeout(botAnswerTimerRef.current);
    };
  }, [phase, currentQuestionIndex]);

  // Round time up handler
  const handleRoundTimeUp = () => {
    setIsRevealing(true);
    triggerHaptic("warning");

    const currentQ = questions[currentQuestionIndex];
    if (selectedOption === currentQ?.correctIndex) {
      playCorrectSound();
    } else {
      playWrongSound();
    }

    // Schedule next question or podium
    if (revealTimerRef.current) clearTimeout(revealTimerRef.current);
    revealTimerRef.current = setTimeout(() => {
      if (currentQuestionIndex + 1 < questions.length) {
        setCurrentQuestionIndex((prev) => prev + 1);
      } else {
        setPhase("podium");
      }
    }, 3500);
  };

  // Option selection by local player
  const handleSelectOption = (idx: number) => {
    if (hasLockedAnswer || isRevealing) return;

    setSelectedOption(idx);
    setHasLockedAnswer(true);

    const timeTakenMs = Date.now() - roundStartTimeRef.current;
    const currentQ = questions[currentQuestionIndex];
    const isCorrect = idx === currentQ.correctIndex;

    const myPlayer = players.find((p) => p.id === myPlayerId);
    const { points, newStreak } = calculateRoundScore(
      isCorrect,
      timeTakenMs,
      roomConfig.timePerQuestionSec,
      myPlayer?.streak || 0
    );

    if (isCorrect) {
      triggerHaptic("success");
      playClickSound();
    } else {
      triggerHaptic("light");
      playClickSound();
    }

    // Update self score locally
    setPlayers((prev) =>
      prev.map((p) =>
        p.id === myPlayerId
          ? {
              ...p,
              score: p.score + points,
              streak: newStreak,
              correctCount: p.correctCount + (isCorrect ? 1 : 0),
              wrongCount: p.wrongCount + (isCorrect ? 0 : 1),
              lastAnswer: {
                questionIndex: currentQuestionIndex,
                selectedOption: idx,
                timeTakenMs,
                isCorrect,
                pointsEarned: points,
              },
            }
          : p
      )
    );

    // Broadcast answer to room
    if (managerRef.current) {
      managerRef.current.broadcastEvent("ANSWER_SUBMIT", {
        playerId: myPlayerId,
        optionIndex: idx,
        pointsEarned: points,
        isCorrect,
        streak: newStreak,
      });
    }

    // If all players have locked answers, conclude round early
    const otherPlayers = players.filter((p) => p.id !== myPlayerId);
    const allOthersAnswered = otherPlayers.every(
      (p) => p.lastAnswer?.questionIndex === currentQuestionIndex
    );
    if (allOthersAnswered && otherPlayers.length > 0) {
      if (roundTimerRef.current) clearInterval(roundTimerRef.current);
      setTimeout(handleRoundTimeUp, 500);
    }
  };

  // Send Floating Emoji reaction
  const handleSendEmoji = (emoji: string) => {
    const newEmoji: FloatingEmoji = {
      id: Math.random().toString(),
      emoji,
      fromPlayerName: playerName,
      timestamp: Date.now(),
    };
    setFloatingEmojis((prev) => [...prev, newEmoji]);
    setTimeout(() => {
      setFloatingEmojis((prev) => prev.filter((e) => e.id !== newEmoji.id));
    }, 2500);

    if (managerRef.current) {
      managerRef.current.broadcastEvent("REACTION", {
        emoji,
        fromPlayerName: playerName,
      });
    }
  };

  // Rematch action from Podium
  const handleRematch = () => {
    triggerHaptic("medium");
    playClickSound();

    const newQuestions = getBattleQuestions({
      category: roomConfig.category,
      count: roomConfig.questionCount,
      questionSource: roomConfig.questionSource,
      selectedChapterId: roomConfig.selectedChapterId,
      selectedQuestionIds: roomConfig.selectedQuestionIds,
    });

    setQuestions(newQuestions);
    setCurrentQuestionIndex(0);
    setPlayers((prev) =>
      prev.map((p) => ({
        ...p,
        score: 0,
        streak: 0,
        correctCount: 0,
        wrongCount: 0,
        lastAnswer: null,
      }))
    );

    if (managerRef.current) {
      managerRef.current.broadcastEvent("REMATCH", {
        questions: newQuestions,
      });
    }

    setPhase("countdown");
    setCountdownNum(3);
  };

  // Leave room safely
  const handleLeaveRoom = () => {
    if (managerRef.current) {
      managerRef.current.broadcastEvent("PLAYER_LEAVE", {
        playerId: myPlayerId,
      });
      managerRef.current.disconnect();
      managerRef.current = null;
    }
    setPhase("initial");
    setShowExitConfirm(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-0 sm:p-4">
      {/* Floating Emojis Canvas Overlay */}
      <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
        {floatingEmojis.map((e) => (
          <div
            key={e.id}
            className="absolute bottom-16 left-1/2 transform -translate-x-1/2 flex items-center gap-1.5 animate-bounce text-3xl drop-shadow-lg"
            style={{
              animation: "floatUp 2.4s ease-out forwards",
            }}
          >
            <span>{e.emoji}</span>
            <span className="text-xs font-bold text-white bg-black/60 px-2 py-0.5 rounded-full">
              {e.fromPlayerName}
            </span>
          </div>
        ))}
      </div>

      <style>{`
        @keyframes floatUp {
          0% { transform: translate(-50%, 0) scale(0.8); opacity: 1; }
          100% { transform: translate(-50%, -350px) scale(1.3); opacity: 0; }
        }
      `}</style>

      {/* Main Container */}
      <div className="relative w-full max-w-lg h-full sm:h-[90vh] sm:max-h-[760px] bg-[#FFF9EF] sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden border border-amber-900/20">
        {/* Phase: Initial Screen (Create or Join) */}
        {phase === "initial" && (
          <div className="flex flex-col h-full overflow-y-auto">
            {/* Header */}
            <div className="bg-gradient-to-r from-[#800020] to-[#5c0017] text-white p-5 text-center relative shadow-md">
              <button
                onClick={onClose}
                className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 transition"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="inline-flex p-3 rounded-2xl bg-amber-400 text-stone-900 shadow-md mb-2">
                <Swords className="w-7 h-7" />
              </div>

              <h2 className="text-xl font-extrabold tracking-wide">
                1v1 व ग्रुप क्विज़ मुकाबला
              </h2>
              <p className="text-xs text-amber-200 mt-1">
                दोस्तों को लाइव चुनौती दें और राजस्थान GK में रैंक पाएं!
              </p>
            </div>

            {/* Profile Avatar & Name Section */}
            <div className="p-4 bg-white border-b border-stone-200">
              <div className="flex items-center gap-3">
                <div className="relative text-3xl p-2 rounded-2xl bg-amber-50 border border-amber-200">
                  <span>{selectedAvatar}</span>
                </div>
                <div className="flex-1">
                  <label className="block text-[11px] font-bold text-stone-500 uppercase">
                    आपका नाम (Your Name)
                  </label>
                  <input
                    type="text"
                    value={playerName}
                    onChange={(e) => setPlayerName(e.target.value)}
                    maxLength={20}
                    placeholder="अपना नाम दर्ज करें"
                    className="w-full text-sm font-bold text-stone-800 bg-stone-50 border border-stone-300 rounded-xl px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#800020]"
                  />
                </div>
              </div>

              {/* Avatar Selector Strip */}
              <div className="flex items-center gap-2 overflow-x-auto pt-3 pb-1 scrollbar-none">
                {PLAYER_AVATARS.map((av) => (
                  <button
                    key={av}
                    onClick={() => {
                      triggerHaptic("light");
                      setSelectedAvatar(av);
                    }}
                    className={`w-9 h-9 flex-shrink-0 flex items-center justify-center text-lg rounded-xl transition ${
                      selectedAvatar === av
                        ? "bg-[#800020] shadow-md scale-110"
                        : "bg-stone-100 hover:bg-stone-200"
                    }`}
                  >
                    {av}
                  </button>
                ))}
              </div>
            </div>

            {/* Mode Switch Tabs */}
            <div className="p-4 flex-1 space-y-4">
              <div className="flex bg-stone-200 p-1 rounded-2xl">
                <button
                  onClick={() => {
                    triggerHaptic("light");
                    setActiveTab("create");
                  }}
                  className={`flex-1 py-2 rounded-xl text-xs font-bold transition ${
                    activeTab === "create"
                      ? "bg-white text-[#800020] shadow-sm"
                      : "text-stone-600 hover:text-stone-900"
                  }`}
                >
                  ⚔️ नया कमरा बनाएं (Host)
                </button>
                <button
                  onClick={() => {
                    triggerHaptic("light");
                    setActiveTab("join");
                  }}
                  className={`flex-1 py-2 rounded-xl text-xs font-bold transition ${
                    activeTab === "join"
                      ? "bg-white text-[#800020] shadow-sm"
                      : "text-stone-600 hover:text-stone-900"
                  }`}
                >
                  🔑 कोड से जुड़ें (Join)
                </button>
              </div>

              {activeTab === "create" ? (
                <div className="space-y-3.5">
                  {/* Question Source Selector */}
                  <div>
                    <label className="block text-xs font-bold text-stone-700 mb-1.5">
                      प्रश्न चयन का प्रकार (Question Source)
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setQuestionSource("curated")}
                        className={`p-2 rounded-xl text-left border transition text-xs ${
                          questionSource === "curated"
                            ? "bg-amber-50 border-[#800020] text-[#800020] font-bold shadow-xs"
                            : "bg-white border-stone-200 text-stone-700 hover:bg-stone-50"
                        }`}
                      >
                        <span className="block font-bold">🎯 राजस्थान GK बैंक</span>
                        <span className="text-[10px] text-stone-500">तैयार प्रश्न</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setQuestionSource("custom_bank")}
                        className={`p-2 rounded-xl text-left border transition text-xs ${
                          questionSource === "custom_bank"
                            ? "bg-amber-50 border-[#800020] text-[#800020] font-bold shadow-xs"
                            : "bg-white border-stone-200 text-stone-700 hover:bg-stone-50"
                        }`}
                      >
                        <span className="block font-bold">📝 मेरे कस्टम प्रश्न</span>
                        <span className="text-[10px] text-stone-500">ऐप में जोड़े प्रश्न</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setQuestionSource("chapter")}
                        className={`p-2 rounded-xl text-left border transition text-xs ${
                          questionSource === "chapter"
                            ? "bg-amber-50 border-[#800020] text-[#800020] font-bold shadow-xs"
                            : "bg-white border-stone-200 text-stone-700 hover:bg-stone-50"
                        }`}
                      >
                        <span className="block font-bold">📚 अध्याय अनुसार</span>
                        <span className="text-[10px] text-stone-500">चयनित अध्याय</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setQuestionSource("manual_pick");
                          setIsQuestionPickerOpen(true);
                        }}
                        className={`p-2 rounded-xl text-left border transition text-xs ${
                          questionSource === "manual_pick"
                            ? "bg-amber-50 border-[#800020] text-[#800020] font-bold shadow-xs"
                            : "bg-white border-stone-200 text-stone-700 hover:bg-stone-50"
                        }`}
                      >
                        <span className="block font-bold flex items-center justify-between">
                          <span>✏️ खुद चुनें</span>
                          <span className="text-[10px] text-[#800020]">
                            {selectedQuestionIds.length > 0 ? `${selectedQuestionIds.length} चुने` : "चुनें"}
                          </span>
                        </span>
                        <span className="text-[10px] text-stone-500">हाथ से चुने प्रश्न</span>
                      </button>
                    </div>
                  </div>

                  {/* Category Selector if curated */}
                  {questionSource === "curated" && (
                    <div>
                      <label className="block text-xs font-bold text-stone-700 mb-1.5">
                        विषय श्रेणी
                      </label>
                      <select
                        value={selectedCategory}
                        onChange={(e) =>
                          setSelectedCategory(e.target.value as BattleCategory)
                        }
                        className="w-full text-sm font-semibold bg-white border border-stone-300 rounded-xl px-3 py-2 text-stone-800 focus:outline-none focus:ring-2 focus:ring-[#800020]"
                      >
                        <option value="all">🎯 सभी विषय (मिश्रित GK)</option>
                        <option value="history">🏰 राजस्थान इतिहास</option>
                        <option value="geography">🗺️ राजस्थान भूगोल</option>
                        <option value="culture">🎭 कला एवं संस्कृति</option>
                        <option value="polity">🏛️ राजव्यवस्था व प्रशासन</option>
                        <option value="economy">📊 अर्थव्यवस्था व योजनाएं</option>
                      </select>
                    </div>
                  )}

                  {/* Question Count & Time */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-stone-700 mb-1">
                        कुल प्रश्न
                      </label>
                      <div className="flex gap-1.5">
                        {[5, 10, 15].map((cnt) => (
                          <button
                            key={cnt}
                            type="button"
                            onClick={() => setQuestionCount(cnt)}
                            className={`flex-1 py-2 text-xs font-bold rounded-xl border transition ${
                              questionCount === cnt
                                ? "bg-[#800020] text-white border-[#800020]"
                                : "bg-white text-stone-700 border-stone-300"
                            }`}
                          >
                            {cnt}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-stone-700 mb-1 flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-[#800020]" />
                        <span>प्रति प्रश्न समय</span>
                      </label>
                      <div className="flex gap-1.5">
                        {[10, 15, 20].map((sec) => (
                          <button
                            key={sec}
                            type="button"
                            onClick={() => setTimePerQuestionSec(sec)}
                            className={`flex-1 py-2 text-xs font-bold rounded-xl border transition ${
                              timePerQuestionSec === sec
                                ? "bg-[#800020] text-white border-[#800020] shadow-xs"
                                : "bg-white text-stone-700 border-stone-300"
                            }`}
                          >
                            {sec}s {sec === 10 && "⚡"}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={handleCreateRoom}
                    className="w-full mt-4 flex items-center justify-center gap-2 py-3.5 px-6 rounded-2xl bg-gradient-to-r from-[#800020] to-[#990026] text-white font-bold text-base shadow-lg hover:brightness-110 active:scale-98 transition"
                  >
                    <span>कमरा बनाएं और कोड पाएं</span>
                    <ArrowRight className="w-5 h-5" />
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-stone-700 mb-1.5">
                      कमरा कोड दर्ज करें (6-अंकों का कोड)
                    </label>
                    <input
                      type="text"
                      value={inputRoomCode}
                      onChange={(e) =>
                        setInputRoomCode(e.target.value.toUpperCase())
                      }
                      placeholder="उदा. 849201"
                      maxLength={6}
                      className="w-full text-center text-2xl font-mono font-extrabold tracking-widest text-[#800020] bg-white border-2 border-amber-300 rounded-2xl p-3 focus:outline-none focus:ring-2 focus:ring-[#800020]"
                    />
                  </div>

                  <button
                    onClick={handleJoinRoom}
                    disabled={!inputRoomCode || inputRoomCode.length < 4}
                    className={`w-full flex items-center justify-center gap-2 py-3.5 px-6 rounded-2xl font-bold text-base shadow-lg active:scale-98 transition ${
                      inputRoomCode && inputRoomCode.length >= 4
                        ? "bg-[#800020] text-white hover:bg-[#68001a]"
                        : "bg-stone-300 text-stone-500 cursor-not-allowed"
                    }`}
                  >
                    <span>कमरे में शामिल हों (Join)</span>
                    <ArrowRight className="w-5 h-5" />
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Phase: Lobby */}
        {phase === "lobby" && (
          <BattleLobbyView
            roomConfig={roomConfig}
            players={players}
            myPlayerId={myPlayerId}
            isHost={isHost}
            onToggleReady={handleToggleReady}
            onStartGame={handleStartGame}
            onAddBot={handleAddBot}
            onUpdateConfig={handleUpdateConfig}
            onSendEmoji={handleSendEmoji}
            onLeaveRoom={() => setShowExitConfirm(true)}
          />
        )}

        {/* Phase: 3-2-1 Countdown */}
        {phase === "countdown" && (
          <div className="flex-1 flex flex-col items-center justify-center bg-gradient-to-b from-[#800020] to-[#4a0012] text-white p-6 text-center select-none">
            <div className="mb-4 text-amber-300 flex items-center gap-2 text-sm font-bold uppercase tracking-wider">
              <Zap className="w-4 h-4 fill-current" />
              <span>मुकाबला शुरू हो रहा है!</span>
            </div>

            <div className="w-32 h-32 rounded-full border-4 border-amber-400/80 flex items-center justify-center shadow-2xl bg-black/20 my-4 transform animate-pulse">
              <span className="text-7xl font-black font-mono text-amber-300 drop-shadow-md">
                {countdownNum}
              </span>
            </div>

            <p className="text-base font-bold text-stone-200 mt-2">
              तैयार हो जाएं! पहला प्रश्न आ रहा है...
            </p>
          </div>
        )}

        {/* Phase: Question Arena */}
        {phase === "question_active" && questions[currentQuestionIndex] && (
          <BattleArenaView
            question={questions[currentQuestionIndex]}
            questionIndex={currentQuestionIndex}
            totalQuestions={questions.length}
            timeRemainingSec={timeRemainingSec}
            maxTimeSec={roomConfig.timePerQuestionSec}
            players={players}
            myPlayerId={myPlayerId}
            selectedOption={selectedOption}
            hasLockedAnswer={hasLockedAnswer}
            isRevealing={isRevealing}
            onSelectOption={handleSelectOption}
            onSendEmoji={handleSendEmoji}
          />
        )}

        {/* Phase: Podium */}
        {phase === "podium" && (
          <BattlePodiumView
            players={players}
            myPlayerId={myPlayerId}
            totalQuestions={questions.length}
            onRematch={handleRematch}
            onExit={onClose}
          />
        )}

        {/* Safety Exit Confirmation Modal */}
        {showExitConfirm && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
            <div className="bg-white rounded-2xl p-5 max-w-xs w-full text-center shadow-2xl border border-stone-200">
              <AlertCircle className="w-10 h-10 text-red-500 mx-auto mb-2" />
              <h3 className="text-base font-bold text-stone-900">
                क्या आप मुकाबला छोड़ना चाहते हैं?
              </h3>
              <p className="text-xs text-stone-600 mt-1 mb-4">
                कमरा छोड़ने पर आपका स्कोर और प्रगति समाप्त हो जाएगी।
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowExitConfirm(false)}
                  className="flex-1 py-2 text-xs font-bold text-stone-700 bg-stone-100 hover:bg-stone-200 rounded-xl"
                >
                  नहीं, खेलें
                </button>
                <button
                  onClick={handleLeaveRoom}
                  className="flex-1 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl"
                >
                  हाँ, छोड़ें
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Custom Questions Selection Modal for Host */}
        {isQuestionPickerOpen && (
          <CustomQuestionPickerModal
            isOpen={isQuestionPickerOpen}
            selectedIds={selectedQuestionIds}
            targetCount={questionCount}
            onSave={(ids) => {
              setSelectedQuestionIds(ids);
            }}
            onClose={() => setIsQuestionPickerOpen(false)}
          />
        )}
      </div>
    </div>
  );
};
