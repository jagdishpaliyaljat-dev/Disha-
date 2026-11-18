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
  ClipboardPaste,
  User,
  Copy,
  Check,
  Crown,
  BookOpen,
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

  // Quick Paste Code from Clipboard
  const handlePasteCode = async () => {
    try {
      if (navigator?.clipboard?.readText) {
        const text = await navigator.clipboard.readText();
        if (text) {
          const match = text.match(/[A-Za-z0-9]{4,6}/);
          if (match) {
            setInputRoomCode(match[0].toUpperCase());
            triggerHaptic("light");
            playClickSound();
          }
        }
      }
    } catch {
      // Clipboard read blocked
    }
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
            {/* Royal Header */}
            <div className="bg-gradient-to-b from-[#5E0017] via-[#800020] to-[#6A001A] text-white p-5 sm:p-6 text-center relative shadow-lg overflow-hidden">
              {/* Subtle Ambient Radial Glow */}
              <div className="absolute -top-12 left-1/2 -translate-x-1/2 w-48 h-48 bg-amber-400/20 rounded-full blur-2xl pointer-events-none" />

              <button
                onClick={onClose}
                className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 transition border border-white/10"
                title="बंद करें"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="relative inline-flex items-center justify-center p-3.5 rounded-2xl bg-gradient-to-br from-amber-400 via-amber-300 to-amber-500 text-stone-950 shadow-[0_4px_20px_rgba(245,158,11,0.4)] mb-2.5 ring-2 ring-amber-200/50">
                <Swords className="w-7 h-7" />
              </div>

              <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-amber-400/20 text-amber-200 text-[11px] font-bold border border-amber-300/30 mb-1.5">
                <Sparkles className="w-3 h-3 text-amber-300" />
                <span>लाइव मल्टीप्लेयर मुकाबला</span>
              </div>

              <h2 className="text-xl sm:text-2xl font-extrabold tracking-wide drop-shadow-sm">
                राजस्थान GK रणभूमि
              </h2>
              <p className="text-xs text-amber-100/90 max-w-xs mx-auto mt-1">
                मित्रों के साथ 1v1 या ग्रुप में खेलें • 10s में तेज उत्तर देकर शीर्ष रैंक पाएं!
              </p>
            </div>

            {/* Profile Avatar & Name Card */}
            <div className="p-4 bg-white/95 border-b border-amber-900/10 shadow-xs">
              <div className="flex items-center gap-3">
                <div className="relative w-13 h-13 rounded-2xl bg-gradient-to-tr from-amber-400 to-amber-200 p-0.5 shadow-md flex items-center justify-center shrink-0 ring-2 ring-amber-300/60">
                  <span className="text-3xl">{selectedAvatar}</span>
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-bold text-stone-600 flex items-center gap-1 uppercase tracking-wider">
                      <User className="w-3 h-3 text-[#800020]" />
                      <span>आपका नाम</span>
                    </label>
                    <span className="text-[10px] text-stone-400 font-mono">
                      {playerName.length}/20
                    </span>
                  </div>
                  <input
                    type="text"
                    value={playerName}
                    onChange={(e) => setPlayerName(e.target.value)}
                    maxLength={20}
                    placeholder="अपना नाम दर्ज करें..."
                    className="w-full text-sm font-bold text-stone-800 bg-[#FFFDF9] border border-amber-300/70 rounded-xl px-3.5 py-2 focus:outline-none focus:ring-2 focus:ring-[#800020] focus:border-transparent transition shadow-inner"
                  />
                </div>
              </div>

              {/* Avatar Selector Strip */}
              <div className="mt-3">
                <div className="text-[10px] font-bold text-stone-500 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                  <span>अवतार चुनें:</span>
                </div>
                <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
                  {PLAYER_AVATARS.map((av) => {
                    const isSelected = selectedAvatar === av;
                    return (
                      <button
                        key={av}
                        onClick={() => {
                          triggerHaptic("light");
                          setSelectedAvatar(av);
                        }}
                        className={`w-10 h-10 flex-shrink-0 flex items-center justify-center text-xl rounded-xl transition-all ${
                          isSelected
                            ? "bg-gradient-to-br from-[#800020] to-[#5c0017] text-white shadow-md scale-110 ring-2 ring-amber-400"
                            : "bg-stone-100 hover:bg-amber-50 active:scale-95 border border-stone-200"
                        }`}
                      >
                        {av}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Mode Switch Segmented Control */}
            <div className="p-4 flex-1 space-y-4">
              <div className="flex bg-stone-200/80 p-1.5 rounded-2xl border border-stone-300/60 shadow-inner">
                <button
                  onClick={() => {
                    triggerHaptic("light");
                    setActiveTab("create");
                  }}
                  className={`flex-1 py-2.5 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 transition-all ${
                    activeTab === "create"
                      ? "bg-gradient-to-r from-[#800020] to-[#6A001A] text-white shadow-md"
                      : "text-stone-600 hover:text-stone-900"
                  }`}
                >
                  <Swords className="w-4 h-4 text-amber-300" />
                  <span>नया कमरा बनाएं (Host)</span>
                </button>
                <button
                  onClick={() => {
                    triggerHaptic("light");
                    setActiveTab("join");
                  }}
                  className={`flex-1 py-2.5 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 transition-all ${
                    activeTab === "join"
                      ? "bg-gradient-to-r from-[#800020] to-[#6A001A] text-white shadow-md"
                      : "text-stone-600 hover:text-stone-900"
                  }`}
                >
                  <Users className="w-4 h-4 text-amber-300" />
                  <span>कोड से जुड़ें (Join)</span>
                </button>
              </div>

              {activeTab === "create" ? (
                <div className="space-y-4">
                  {/* Question Source Selector (4 Premium Cards) */}
                  <div>
                    <label className="block text-xs font-bold text-stone-700 mb-2 flex items-center justify-between">
                      <span>प्रश्न चयन का प्रकार (Question Source)</span>
                      <span className="text-[10px] text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full font-bold">
                        {questionSource === "curated" && "🎯 अनुशंसित"}
                        {questionSource === "custom_bank" && "📝 स्व-निर्मित"}
                        {questionSource === "chapter" && "📚 अध्याय-वार"}
                        {questionSource === "manual_pick" && "✏️ हाथ से चुना"}
                      </span>
                    </label>

                    <div className="grid grid-cols-2 gap-2.5">
                      <button
                        type="button"
                        onClick={() => setQuestionSource("curated")}
                        className={`p-3 rounded-2xl text-left border-2 transition-all active:scale-98 ${
                          questionSource === "curated"
                            ? "bg-amber-50/80 border-[#800020] shadow-sm ring-1 ring-[#800020]/20"
                            : "bg-white border-stone-200/80 text-stone-700 hover:bg-stone-50"
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-lg">🎯</span>
                          <span className="text-xs font-extrabold text-stone-900">
                            राजस्थान GK बैंक
                          </span>
                        </div>
                        <p className="text-[10px] text-stone-500">
                          40+ प्रामाणिक परीक्षा स्तरीय प्रश्न
                        </p>
                      </button>

                      <button
                        type="button"
                        onClick={() => setQuestionSource("custom_bank")}
                        className={`p-3 rounded-2xl text-left border-2 transition-all active:scale-98 ${
                          questionSource === "custom_bank"
                            ? "bg-amber-50/80 border-[#800020] shadow-sm ring-1 ring-[#800020]/20"
                            : "bg-white border-stone-200/80 text-stone-700 hover:bg-stone-50"
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-lg">📝</span>
                          <span className="text-xs font-extrabold text-stone-900">
                            कस्टम प्रश्न
                          </span>
                        </div>
                        <p className="text-[10px] text-stone-500">
                          ऐप में आपके जोड़े गए प्रश्न
                        </p>
                      </button>

                      <button
                        type="button"
                        onClick={() => setQuestionSource("chapter")}
                        className={`p-3 rounded-2xl text-left border-2 transition-all active:scale-98 ${
                          questionSource === "chapter"
                            ? "bg-amber-50/80 border-[#800020] shadow-sm ring-1 ring-[#800020]/20"
                            : "bg-white border-stone-200/80 text-stone-700 hover:bg-stone-50"
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-lg">📚</span>
                          <span className="text-xs font-extrabold text-stone-900">
                            अध्याय अनुसार
                          </span>
                        </div>
                        <p className="text-[10px] text-stone-500">
                          विशिष्ट विषय/अध्याय के प्रश्न
                        </p>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setQuestionSource("manual_pick");
                          setIsQuestionPickerOpen(true);
                        }}
                        className={`p-3 rounded-2xl text-left border-2 transition-all active:scale-98 ${
                          questionSource === "manual_pick"
                            ? "bg-amber-50/80 border-[#800020] shadow-sm ring-1 ring-[#800020]/20"
                            : "bg-white border-stone-200/80 text-stone-700 hover:bg-stone-50"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <span className="text-lg">✏️</span>
                            <span className="text-xs font-extrabold text-stone-900">
                              खुद चुनें
                            </span>
                          </div>
                          <span className="text-[10px] font-bold text-[#800020] bg-amber-100 px-1.5 py-0.5 rounded-full">
                            {selectedQuestionIds.length > 0
                              ? `${selectedQuestionIds.length} चुने`
                              : "चुनें"}
                          </span>
                        </div>
                        <p className="text-[10px] text-stone-500">
                          हाथ से एक-एक प्रश्न चुनें
                        </p>
                      </button>
                    </div>
                  </div>

                  {/* Category Selector if curated */}
                  {questionSource === "curated" && (
                    <div className="bg-white p-3 rounded-2xl border border-stone-200 shadow-xs">
                      <label className="block text-xs font-bold text-stone-700 mb-1.5">
                        विषय श्रेणी (Category)
                      </label>
                      <select
                        value={selectedCategory}
                        onChange={(e) =>
                          setSelectedCategory(e.target.value as BattleCategory)
                        }
                        className="w-full text-sm font-semibold bg-stone-50 border border-stone-300 rounded-xl px-3 py-2.5 text-stone-800 focus:outline-none focus:ring-2 focus:ring-[#800020]"
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

                  {/* Question Count & Time Options */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-white p-3 rounded-2xl border border-stone-200 shadow-xs">
                      <label className="block text-xs font-bold text-stone-700 mb-1.5">
                        कुल प्रश्न
                      </label>
                      <div className="flex gap-1.5">
                        {[5, 10, 15].map((cnt) => (
                          <button
                            key={cnt}
                            type="button"
                            onClick={() => {
                              triggerHaptic("light");
                              setQuestionCount(cnt);
                            }}
                            className={`flex-1 py-2 text-xs font-bold rounded-xl border-2 transition ${
                              questionCount === cnt
                                ? "bg-[#800020] text-white border-[#800020] shadow-sm"
                                : "bg-stone-50 text-stone-700 border-stone-200 hover:bg-stone-100"
                            }`}
                          >
                            {cnt}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="bg-white p-3 rounded-2xl border border-stone-200 shadow-xs">
                      <label className="block text-xs font-bold text-stone-700 mb-1.5 flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-[#800020]" />
                        <span>प्रति प्रश्न समय</span>
                      </label>
                      <div className="flex gap-1.5">
                        {[10, 15, 20].map((sec) => (
                          <button
                            key={sec}
                            type="button"
                            onClick={() => {
                              triggerHaptic("light");
                              setTimePerQuestionSec(sec);
                            }}
                            className={`flex-1 py-2 text-xs font-bold rounded-xl border-2 transition ${
                              timePerQuestionSec === sec
                                ? "bg-[#800020] text-white border-[#800020] shadow-sm"
                                : "bg-stone-50 text-stone-700 border-stone-200 hover:bg-stone-100"
                            }`}
                          >
                            {sec}s {sec === 10 && "⚡"}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Create Room CTA Button */}
                  <button
                    onClick={handleCreateRoom}
                    className="w-full mt-2 flex items-center justify-center gap-2 py-4 px-6 rounded-2xl bg-gradient-to-r from-[#800020] via-[#A00028] to-[#800020] text-white font-extrabold text-base shadow-lg shadow-[#800020]/30 hover:brightness-110 active:scale-98 transition border border-amber-400/40"
                  >
                    <span>कमरा बनाएं और कोड पाएं</span>
                    <ArrowRight className="w-5 h-5" />
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Join Room Code Input Card */}
                  <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-xs space-y-3">
                    <label className="block text-xs font-bold text-stone-700 text-center">
                      6-अंकों का कमरा कोड दर्ज करें (Enter Room Code)
                    </label>

                    <div className="relative">
                      <input
                        type="text"
                        value={inputRoomCode}
                        onChange={(e) =>
                          setInputRoomCode(e.target.value.toUpperCase())
                        }
                        placeholder="उदा. 849201"
                        maxLength={6}
                        className="w-full text-center text-3xl font-mono font-extrabold tracking-widest text-[#800020] bg-amber-50/50 border-2 border-amber-300 rounded-2xl py-3.5 px-4 focus:outline-none focus:ring-2 focus:ring-[#800020] shadow-inner"
                      />

                      <button
                        type="button"
                        onClick={handlePasteCode}
                        className="mt-2.5 w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-stone-100 hover:bg-amber-100 text-stone-700 text-xs font-bold transition border border-stone-200 active:scale-95"
                      >
                        <ClipboardPaste className="w-4 h-4 text-[#800020]" />
                        <span>क्लिपबोर्ड से पेस्ट करें (Paste Code)</span>
                      </button>
                    </div>

                    <div className="p-3 bg-amber-50 rounded-xl border border-amber-200/70 text-center">
                      <p className="text-xs text-amber-900 font-medium">
                        💡 <b>टिप:</b> मित्र द्वारा WhatsApp पर भेजे गए लिंक पर टैप करके भी आप सीधे कमरे में शामिल हो सकते हैं!
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={handleJoinRoom}
                    disabled={!inputRoomCode || inputRoomCode.length < 4}
                    className={`w-full flex items-center justify-center gap-2 py-4 px-6 rounded-2xl font-extrabold text-base shadow-lg active:scale-98 transition ${
                      inputRoomCode && inputRoomCode.length >= 4
                        ? "bg-gradient-to-r from-[#800020] to-[#6A001A] text-white hover:brightness-110 shadow-[#800020]/30 border border-amber-400/40"
                        : "bg-stone-200 text-stone-400 cursor-not-allowed"
                    }`}
                  >
                    <span>कमरे में शामिल हों (Join Battle)</span>
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

        {/* Phase: 3-2-1 Countdown (Stadium Experience) */}
        {phase === "countdown" && (
          <div className="flex-1 flex flex-col items-center justify-center bg-gradient-to-b from-[#5E0017] via-[#800020] to-[#3A000E] text-white p-6 text-center select-none relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-40 bg-radial from-amber-400/20 to-transparent pointer-events-none" />

            <div className="mb-4 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-400/20 text-amber-300 text-xs font-bold uppercase tracking-wider border border-amber-300/30">
              <Zap className="w-4 h-4 fill-current animate-bounce" />
              <span>रणभूमि तैयार हो रही है!</span>
            </div>

            <div className="relative w-36 h-36 rounded-full border-4 border-amber-400 flex items-center justify-center shadow-[0_0_50px_rgba(245,158,11,0.5)] bg-black/40 my-6 transform animate-pulse">
              <span className="text-8xl font-black font-mono text-amber-300 drop-shadow-[0_4px_12px_rgba(0,0,0,0.8)]">
                {countdownNum}
              </span>
            </div>

            <h3 className="text-xl font-extrabold text-white">
              तैयार हो जाएं!
            </h3>
            <p className="text-xs text-amber-200/90 mt-1 max-w-xs">
              ⚡ प्रति प्रश्न 10 सेकंड समय • तेज और सही उत्तर पर अधिक अंक मिलेंगे!
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
