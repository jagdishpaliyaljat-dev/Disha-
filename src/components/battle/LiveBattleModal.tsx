import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
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
  getAvailableSubjectsList,
  getAvailableChaptersList,
  getAvailableTopicsList,
  RealtimeBattleManager,
} from "../../utils/realtimeBattleService";
import { loadUserProfile } from "../../utils/userProfileStorage";
import { ANIME_CHARACTERS, BattleAvatar } from "./BattleAvatar";
import {
  playClickSound,
  playCorrectSound,
  playWrongSound,
  playTickSound,
  triggerHaptic,
} from "../../utils/audioFeedback";
import {
  trackBattleRoomCreated,
  trackBattleRoomStarted,
  trackBattleRoomHeartbeat,
  trackBattleRoomEnded,
  trackBattleRoomAbandoned,
} from "../../utils/battleTracker";
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
      return profile?.name || "Player";
    } catch {
      return "Player";
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
  const [questionCount, setQuestionCount] = useState<number>(30);
  const [isCustomCountMode, setIsCustomCountMode] = useState<boolean>(false);
  const [customCountInput, setCustomCountInput] = useState<string>("30");
  const [timePerQuestionSec, setTimePerQuestionSec] = useState<number>(10);
  const [questionSource, setQuestionSource] = useState<QuestionSourceType>("curated");
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>("");
  const [selectedSubjectTitle, setSelectedSubjectTitle] = useState<string>("");
  const [selectedChapterId, setSelectedChapterId] = useState<string>("");
  const [selectedChapterTitle, setSelectedChapterTitle] = useState<string>("");
  const [selectedTopicId, setSelectedTopicId] = useState<string>("");
  const [selectedTopicTitle, setSelectedTopicTitle] = useState<string>("");
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<string[]>([]);
  const [isQuestionPickerOpen, setIsQuestionPickerOpen] = useState(false);

  // Active Game State
  const [phase, setPhase] = useState<BattlePhase>("initial");
  const [roomConfig, setRoomConfig] = useState<BattleRoomConfig>({
    roomCode: "",
    hostId: "",
    questionCount: 30,
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
  const botAnswerTimersRef = useRef<{ [botId: string]: NodeJS.Timeout }>({});
  const joinRetryTimerRef = useRef<NodeJS.Timeout | null>(null);
  const roundStartTimeRef = useRef<number>(Date.now());
  const playersRef = useRef<BattlePlayer[]>(players);
  playersRef.current = players;
  const roomConfigRef = useRef<BattleRoomConfig>(roomConfig);
  roomConfigRef.current = roomConfig;

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
            if (managerRef.current && (roomConfigRef.current.hostId === myPlayerId || isHost)) {
              const currentList = playersRef.current.some((p) => p.id === newPlayer.id)
                ? playersRef.current
                : [...playersRef.current, newPlayer];
              managerRef.current.broadcastEvent("ROOM_STATE_SYNC", {
                config: roomConfigRef.current,
                players: currentList,
              });
            }
          }
          break;
        }

        case "ROOM_STATE_SYNC": {
          const { config: syncedConfig, players: syncedPlayers } = event.payload;
          if (syncedConfig) {
            setRoomConfig(syncedConfig);
            roomConfigRef.current = syncedConfig;
            // Stop join retry interval once host responds
            if (joinRetryTimerRef.current) {
              clearInterval(joinRetryTimerRef.current);
              joinRetryTimerRef.current = null;
            }
          }
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
      if (joinRetryTimerRef.current) {
        clearInterval(joinRetryTimerRef.current);
        joinRetryTimerRef.current = null;
      }
      Object.values(botAnswerTimersRef.current).forEach((t) => clearTimeout(t));
      botAnswerTimersRef.current = {};
    };
  }, []);

  // Auto direct join when room code is present in initialRoomCode or URL query
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const urlCode = params.get("battle") || params.get("room") || params.get("quiz");
      const targetCode = (initialRoomCode || urlCode || "").trim().toUpperCase();
      if (targetCode && targetCode.length >= 4) {
        setInputRoomCode(targetCode);
        setActiveTab("join");
        if (phase === "initial") {
          handleJoinRoom(targetCode);
        }
      }
    } catch {
      // Ignore
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
      selectedSubjectId,
      selectedSubjectTitle,
      selectedChapterId,
      selectedChapterTitle,
      selectedTopicId,
      selectedTopicTitle,
      selectedQuestionIds,
      allowUnlimitedUsers: true,
      createdAt: Date.now(),
    };

    const hostPlayer: BattlePlayer = {
      id: myPlayerId,
      name: playerName.trim() || "Host",
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

    // Track active room creation in battle telemetry
    try {
      trackBattleRoomCreated({
        roomCode: code,
        config,
        hostPlayer,
      });
    } catch (e) {
      console.warn("Battle room tracking error:", e);
    }

    setPhase("lobby");
  };

  // Handle Join Room with Code (Direct auto join supported)
  const handleJoinRoom = (targetCode?: string) => {
    const code = (targetCode || inputRoomCode).toUpperCase().trim();
    if (!code || code.length < 4) {
      alert("Please enter a valid 6-digit room code.");
      return;
    }

    triggerHaptic("medium");
    playClickSound();

    const joinerPlayer: BattlePlayer = {
      id: myPlayerId,
      name: playerName.trim() || "Player",
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
      questionCount: 30,
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

    // Broadcast JOIN event immediately (queued if subscription in progress)
    manager.broadcastEvent("JOIN", { player: joinerPlayer });

    // Retry JOIN every 1200ms up to 5 times until roomConfig hostId is synced
    if (joinRetryTimerRef.current) clearInterval(joinRetryTimerRef.current);
    let attempts = 0;
    joinRetryTimerRef.current = setInterval(() => {
      attempts++;
      if (attempts >= 6 || (roomConfigRef.current && roomConfigRef.current.hostId)) {
        if (joinRetryTimerRef.current) {
          clearInterval(joinRetryTimerRef.current);
          joinRetryTimerRef.current = null;
        }
        return;
      }
      if (managerRef.current) {
        managerRef.current.broadcastEvent("JOIN", { player: joinerPlayer });
      }
    }, 1200);

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
      selectedSubjectId: roomConfig.selectedSubjectId,
      selectedChapterId: roomConfig.selectedChapterId,
      selectedTopicId: roomConfig.selectedTopicId,
      selectedQuestionIds: roomConfig.selectedQuestionIds,
    });

    setQuestions(sampledQuestions);
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
      managerRef.current.broadcastEvent("START_GAME", {
        questions: sampledQuestions,
        config: roomConfig,
      });
    }

    try {
      trackBattleRoomStarted(roomConfig.roomCode, playersRef.current);
    } catch {}

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

  // Round time up handler
  const handleRoundTimeUp = useCallback(() => {
    setIsRevealing(true);
    triggerHaptic("warning");

    const currentQ = questions[currentQuestionIndex];
    if (selectedOption === currentQ?.correctIndex) {
      playCorrectSound();
    } else {
      playWrongSound();
    }

    // Clear all pending bot timers
    Object.values(botAnswerTimersRef.current).forEach((t) => clearTimeout(t));
    botAnswerTimersRef.current = {};

    // Force-resolve any bot that hasn't recorded an answer for this question yet
    const correctIdx =
      typeof currentQ?.correctIndex === "number" ? currentQ.correctIndex : 0;
    const totalOpts = currentQ?.options?.length || 4;
    const timeLimitSec = roomConfig.timePerQuestionSec || 10;

    setPlayers((prev) =>
      prev.map((p) => {
        if (!p.isBot) return p;
        if (p.lastAnswer?.questionIndex === currentQuestionIndex) {
          return p; // Already answered
        }

        const botIsCorrect = Math.random() < 0.78;
        const botOption = botIsCorrect
          ? correctIdx
          : (correctIdx + 1 + Math.floor(Math.random() * Math.max(1, totalOpts - 1))) %
            totalOpts;

        const timeTakenMs = Math.floor(timeLimitSec * 1000 * 0.7);
        const { points, newStreak } = calculateRoundScore(
          botIsCorrect,
          timeTakenMs,
          timeLimitSec,
          p.streak
        );

        return {
          ...p,
          score: p.score + points,
          streak: newStreak,
          correctCount: p.correctCount + (botIsCorrect ? 1 : 0),
          wrongCount: p.wrongCount + (botIsCorrect ? 0 : 1),
          lastAnswer: {
            questionIndex: currentQuestionIndex,
            selectedOption: botOption,
            timeTakenMs,
            isCorrect: botIsCorrect,
            pointsEarned: points,
          },
        };
      })
    );

    // Schedule next question or podium
    if (revealTimerRef.current) clearTimeout(revealTimerRef.current);
    revealTimerRef.current = setTimeout(() => {
      if (currentQuestionIndex + 1 < questions.length) {
        setCurrentQuestionIndex((prev) => prev + 1);
      } else {
        const currentPlayers = playersRef.current;
        const sorted = [...currentPlayers].sort((a, b) => b.score - a.score);
        const winner = sorted[0] || currentPlayers[0];
        if (winner && roomConfig.roomCode) {
          try {
            trackBattleRoomEnded(roomConfig.roomCode, currentPlayers, winner, questions.length);
          } catch {}
        }
        setPhase("podium");
      }
    }, 3500);
  }, [questions, currentQuestionIndex, selectedOption, roomConfig.timePerQuestionSec, roomConfig.roomCode]);

  // Round progression and timer effect
  useEffect(() => {
    if (phase !== "question_active") return;

    setSelectedOption(null);
    setHasLockedAnswer(false);
    setIsRevealing(false);
    setTimeRemainingSec(roomConfig.timePerQuestionSec);
    roundStartTimeRef.current = Date.now();

    // Send heartbeat to live battle monitor
    try {
      trackBattleRoomHeartbeat(roomConfig.roomCode, playersRef.current);
    } catch {}

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

    // Clear any previous bot timers
    Object.values(botAnswerTimersRef.current).forEach((t) => clearTimeout(t));
    botAnswerTimersRef.current = {};

    // Simulate AI Bot answers for all bot players in match
    const currentQ = questions[currentQuestionIndex];
    const correctIdx =
      typeof currentQ?.correctIndex === "number" ? currentQ.correctIndex : 0;
    const totalOpts = currentQ?.options?.length || 4;
    const timeLimitSec = roomConfig.timePerQuestionSec || 10;

    const botPlayers = playersRef.current.filter((p) => p.isBot);

    botPlayers.forEach((botPlayer, botIdx) => {
      // Dynamic reaction time strictly bounded inside round limits:
      // 5s:  900ms - 3200ms
      // 10s: 1800ms - 6500ms
      // 15s: 2200ms - 8800ms
      const minDelay = Math.max(900, Math.floor(timeLimitSec * 1000 * 0.20));
      const maxDelay = Math.min(
        timeLimitSec * 1000 - 1200,
        Math.floor(timeLimitSec * 1000 * 0.65)
      );
      const span = Math.max(600, maxDelay - minDelay);
      const botDelay = Math.min(
        maxDelay,
        minDelay + Math.floor(Math.random() * span) + (botIdx * 300) % 700
      );

      const botIsCorrect = Math.random() < 0.78; // 78% competitive accuracy
      const botOption = botIsCorrect
        ? correctIdx
        : (correctIdx + 1 + Math.floor(Math.random() * Math.max(1, totalOpts - 1))) %
          totalOpts;

      botAnswerTimersRef.current[botPlayer.id] = setTimeout(() => {
        const { points, newStreak } = calculateRoundScore(
          botIsCorrect,
          botDelay,
          timeLimitSec,
          botPlayer.streak
        );

        setPlayers((prev) => {
          const updated = prev.map((p) =>
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
          );

          // If all players have locked answers, conclude round early
          const allAnswered = updated.every(
            (p) => p.lastAnswer?.questionIndex === currentQuestionIndex
          );
          if (allAnswered && updated.length > 1) {
            if (roundTimerRef.current) clearInterval(roundTimerRef.current);
            setTimeout(handleRoundTimeUp, 500);
          }

          return updated;
        });
      }, botDelay);
    });

    return () => {
      if (roundTimerRef.current) clearInterval(roundTimerRef.current);
      Object.values(botAnswerTimersRef.current).forEach((t) => clearTimeout(t));
      botAnswerTimersRef.current = {};
    };
  }, [phase, currentQuestionIndex, roomConfig.timePerQuestionSec, handleRoundTimeUp, questions]);

  // Option selection by local player
  const handleSelectOption = (idx: number) => {
    if (hasLockedAnswer || isRevealing) return;

    setSelectedOption(idx);
    setHasLockedAnswer(true);

    const timeTakenMs = Date.now() - roundStartTimeRef.current;
    const currentQ = questions[currentQuestionIndex];
    const isCorrect = idx === currentQ?.correctIndex;

    const myPlayer = playersRef.current.find((p) => p.id === myPlayerId);
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

    // Update self score locally & check if all players answered
    setPlayers((prev) => {
      const updated = prev.map((p) =>
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
      );

      // If all players have locked answers, conclude round early
      const allAnswered = updated.every(
        (p) => p.lastAnswer?.questionIndex === currentQuestionIndex
      );
      if (allAnswered && updated.length > 1) {
        if (roundTimerRef.current) clearInterval(roundTimerRef.current);
        setTimeout(handleRoundTimeUp, 500);
      }

      return updated;
    });

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
      selectedSubjectId: roomConfig.selectedSubjectId,
      selectedChapterId: roomConfig.selectedChapterId,
      selectedTopicId: roomConfig.selectedTopicId,
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

  const customQuestions = useMemo(() => getUserCustomQuestionsList(), []);
  const availableSubjects = useMemo(() => getAvailableSubjectsList(), []);
  const availableChapters = useMemo(
    () => getAvailableChaptersList(selectedSubjectId),
    [selectedSubjectId]
  );
  const availableTopics = useMemo(
    () => getAvailableTopicsList(selectedChapterId),
    [selectedChapterId]
  );

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
      <div className="relative w-full max-w-lg h-full sm:h-[90vh] sm:max-h-[760px] bg-[#FFFDF9] dark:bg-[#171923] sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden border border-stone-200 dark:border-[#31374A]">
        {/* Phase: Initial Screen (Create or Join) */}
        {phase === "initial" && (
          <div className="flex flex-col h-full overflow-y-auto">
            {/* Minimal Premium Dark Header */}
            <div className="bg-stone-900 text-white p-5 sm:p-6 text-center relative border-b border-stone-800">
              <button
                onClick={onClose}
                className="absolute top-4 right-4 p-2 rounded-xl bg-white/10 hover:bg-white/20 active:scale-95 transition border border-white/10"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="inline-flex items-center justify-center p-3 rounded-2xl bg-amber-500/15 text-amber-400 border border-amber-500/30 mb-2">
                <Swords className="w-6 h-6" />
              </div>

              <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-white/10 text-stone-300 text-[11px] font-semibold border border-white/10 mb-1.5">
                <Sparkles className="w-3 h-3 text-amber-400" />
                <span>Live Multiplayer Arena</span>
              </div>

              <h2 className="text-xl sm:text-2xl font-bold tracking-tight">
                Live Quiz Battle
              </h2>
              <p className="text-xs text-stone-400 max-w-xs mx-auto mt-1">
                Fast-paced real-time competition • Direct link joining supported
              </p>
            </div>

            {/* Profile Avatar & Name Card with Anime Character Selection */}
            <div className="p-4 bg-white dark:bg-[#1F2330] border-b border-stone-200 dark:border-[#31374A] space-y-3">
              <div className="flex items-center gap-3">
                <BattleAvatar
                  avatar={selectedAvatar}
                  name={playerName}
                  size="lg"
                  showBadge
                />
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-bold text-stone-600 dark:text-stone-300 flex items-center gap-1 uppercase tracking-wider">
                      <User className="w-3 h-3 text-[#800020] dark:text-amber-400" />
                      <span>Player Name</span>
                    </label>
                    <span className="text-[10px] text-stone-400 dark:text-stone-500 font-mono">
                      {playerName.length}/20
                    </span>
                  </div>
                  <input
                    type="text"
                    value={playerName}
                    onChange={(e) => setPlayerName(e.target.value)}
                    maxLength={20}
                    placeholder="Enter your name..."
                    className="w-full text-sm font-bold text-stone-800 dark:text-[#FFF9EF] bg-stone-50 dark:bg-[#252A3A] border border-stone-200 dark:border-[#31374A] rounded-xl px-3.5 py-2 focus:outline-none focus:ring-2 focus:ring-[#800020] dark:focus:ring-amber-400 transition"
                  />
                </div>
              </div>

              {/* Anime Character Selector Strip */}
              <div>
                <div className="text-[10px] font-bold text-stone-500 dark:text-stone-400 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                  <span>Choose Anime Character Avatar:</span>
                  <span className="text-[9px] text-[#800020] dark:text-amber-400 font-bold">16 Characters</span>
                </div>
                <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
                  {ANIME_CHARACTERS.map((char) => {
                    const isSelected = selectedAvatar === char.avatarUrl;
                    return (
                      <button
                        key={char.id}
                        type="button"
                        onClick={() => {
                          triggerHaptic("light");
                          setSelectedAvatar(char.avatarUrl);
                        }}
                        className={`flex-shrink-0 flex flex-col items-center p-1.5 rounded-2xl border transition-all ${
                          isSelected
                            ? "bg-amber-50 dark:bg-amber-950/40 border-[#800020] dark:border-amber-400 ring-2 ring-[#800020]/20 dark:ring-amber-400/30 scale-105 shadow-sm"
                            : "bg-stone-50 dark:bg-[#252A3A] hover:bg-stone-100 dark:hover:bg-[#2E3448] border-stone-200 dark:border-[#31374A]"
                        }`}
                      >
                        <BattleAvatar
                          avatar={char.avatarUrl}
                          name={char.name}
                          size="md"
                        />
                        <span className="text-[10px] font-bold text-stone-700 dark:text-stone-200 mt-1 max-w-[56px] truncate text-center">
                          {char.name}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Mode Switch: Host Room vs Join Room */}
            <div className="p-4 flex-1 space-y-4">
              <div className="flex bg-stone-100 dark:bg-[#252A3A] p-1 rounded-2xl border border-stone-200 dark:border-[#31374A]">
                <button
                  onClick={() => {
                    triggerHaptic("light");
                    setActiveTab("create");
                  }}
                  className={`flex-1 py-2.5 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 transition-all ${
                    activeTab === "create"
                      ? "bg-white dark:bg-[#1F2330] text-stone-900 dark:text-[#FFF9EF] shadow-sm border border-stone-200 dark:border-[#31374A]"
                      : "text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-[#FFF9EF]"
                  }`}
                >
                  <Swords className="w-4 h-4 text-[#800020] dark:text-amber-400" />
                  <span>Host Room</span>
                </button>
                <button
                  onClick={() => {
                    triggerHaptic("light");
                    setActiveTab("join");
                  }}
                  className={`flex-1 py-2.5 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 transition-all ${
                    activeTab === "join"
                      ? "bg-white dark:bg-[#1F2330] text-stone-900 dark:text-[#FFF9EF] shadow-sm border border-stone-200 dark:border-[#31374A]"
                      : "text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-[#FFF9EF]"
                  }`}
                >
                  <Users className="w-4 h-4 text-[#800020] dark:text-amber-400" />
                  <span>Join Room</span>
                </button>
              </div>

              {activeTab === "create" ? (
                <div className="space-y-4">
                  {/* Question Source Selection */}
                  <div>
                    <label className="block text-xs font-bold text-stone-700 dark:text-stone-200 mb-2 flex items-center justify-between">
                      <span>Question Source</span>
                      <span className="text-[10px] text-stone-500 dark:text-stone-400 font-semibold">
                        {questionSource === "curated" && "Curated GK Pool"}
                        {questionSource === "subject" && "Subject-Wise"}
                        {questionSource === "chapter" && "Chapter-Wise"}
                        {questionSource === "topic" && "Topic-Wise"}
                        {questionSource === "manual_pick" && "Hand-Picked"}
                        {questionSource === "custom_bank" && "Custom Bank"}
                      </span>
                    </label>

                    <div className="grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => setQuestionSource("curated")}
                        className={`p-2.5 rounded-2xl text-left border transition text-xs ${
                          questionSource === "curated"
                            ? "bg-amber-50/80 dark:bg-amber-950/40 border-[#800020] dark:border-amber-400 text-[#800020] dark:text-amber-300 font-bold shadow-xs"
                            : "bg-white dark:bg-[#1F2330] border-stone-200 dark:border-[#31374A] text-stone-700 dark:text-stone-200 hover:bg-stone-50 dark:hover:bg-[#252A3A]"
                        }`}
                      >
                        <span className="block font-bold">Curated GK</span>
                        <span className="text-[10px] text-stone-500 dark:text-stone-400 block truncate">High-Yield</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setQuestionSource("subject")}
                        className={`p-2.5 rounded-2xl text-left border transition text-xs ${
                          questionSource === "subject"
                            ? "bg-amber-50/80 dark:bg-amber-950/40 border-[#800020] dark:border-amber-400 text-[#800020] dark:text-amber-300 font-bold shadow-xs"
                            : "bg-white dark:bg-[#1F2330] border-stone-200 dark:border-[#31374A] text-stone-700 dark:text-stone-200 hover:bg-stone-50 dark:hover:bg-[#252A3A]"
                        }`}
                      >
                        <span className="block font-bold">By Subject</span>
                        <span className="text-[10px] text-stone-500 dark:text-stone-400 block truncate">Select Sub</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setQuestionSource("chapter")}
                        className={`p-2.5 rounded-2xl text-left border transition text-xs ${
                          questionSource === "chapter"
                            ? "bg-amber-50/80 dark:bg-amber-950/40 border-[#800020] dark:border-amber-400 text-[#800020] dark:text-amber-300 font-bold shadow-xs"
                            : "bg-white dark:bg-[#1F2330] border-stone-200 dark:border-[#31374A] text-stone-700 dark:text-stone-200 hover:bg-stone-50 dark:hover:bg-[#252A3A]"
                        }`}
                      >
                        <span className="block font-bold">By Chapter</span>
                        <span className="text-[10px] text-stone-500 dark:text-stone-400 block truncate">Select Chap</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setQuestionSource("topic")}
                        className={`p-2.5 rounded-2xl text-left border transition text-xs ${
                          questionSource === "topic"
                            ? "bg-amber-50/80 dark:bg-amber-950/40 border-[#800020] dark:border-amber-400 text-[#800020] dark:text-amber-300 font-bold shadow-xs"
                            : "bg-white dark:bg-[#1F2330] border-stone-200 dark:border-[#31374A] text-stone-700 dark:text-stone-200 hover:bg-stone-50 dark:hover:bg-[#252A3A]"
                        }`}
                      >
                        <span className="block font-bold">By Topic</span>
                        <span className="text-[10px] text-stone-500 dark:text-stone-400 block truncate">Specific Topic</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setQuestionSource("manual_pick");
                          setIsQuestionPickerOpen(true);
                        }}
                        className={`p-2.5 rounded-2xl text-left border transition text-xs ${
                          questionSource === "manual_pick"
                            ? "bg-amber-50/80 dark:bg-amber-950/40 border-[#800020] dark:border-amber-400 text-[#800020] dark:text-amber-300 font-bold shadow-xs"
                            : "bg-white dark:bg-[#1F2330] border-stone-200 dark:border-[#31374A] text-stone-700 dark:text-stone-200 hover:bg-stone-50 dark:hover:bg-[#252A3A]"
                        }`}
                      >
                        <span className="block font-bold">Hand-Pick</span>
                        <span className="text-[10px] text-stone-500 dark:text-stone-400 block truncate">
                          {selectedQuestionIds.length > 0 ? `${selectedQuestionIds.length} Picked` : "Select"}
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setQuestionSource("custom_bank")}
                        className={`p-2.5 rounded-2xl text-left border transition text-xs ${
                          questionSource === "custom_bank"
                            ? "bg-amber-50/80 dark:bg-amber-950/40 border-[#800020] dark:border-amber-400 text-[#800020] dark:text-amber-300 font-bold shadow-xs"
                            : "bg-white dark:bg-[#1F2330] border-stone-200 dark:border-[#31374A] text-stone-700 dark:text-stone-200 hover:bg-stone-50 dark:hover:bg-[#252A3A]"
                        }`}
                      >
                        <span className="block font-bold">Custom Bank</span>
                        <span className="text-[10px] text-stone-500 dark:text-stone-400 block truncate">
                          {customQuestions.length} Questions
                        </span>
                      </button>
                    </div>
                  </div>

                  {/* Sub-selector for Subject */}
                  {questionSource === "subject" && (
                    <div className="bg-amber-50/60 dark:bg-amber-950/30 p-3 rounded-2xl border border-amber-200/80 dark:border-amber-800/40">
                      <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                        Select Subject
                      </label>
                      <select
                        value={selectedSubjectId}
                        onChange={(e) => {
                          const s = availableSubjects.find((x) => x.id === e.target.value);
                          setSelectedSubjectId(e.target.value);
                          setSelectedSubjectTitle(s?.title || "");
                        }}
                        className="w-full text-xs font-semibold bg-white dark:bg-[#252A3A] border border-amber-300 dark:border-amber-500/50 rounded-xl p-2.5 text-stone-800 dark:text-[#FFF9EF] focus:outline-none focus:ring-2 focus:ring-[#800020] dark:focus:ring-amber-400"
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

                  {/* Sub-selector for Chapter */}
                  {questionSource === "chapter" && (
                    <div className="bg-amber-50/60 dark:bg-amber-950/30 p-3 rounded-2xl border border-amber-200/80 dark:border-amber-800/40">
                      <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                        Select Chapter
                      </label>
                      <select
                        value={selectedChapterId}
                        onChange={(e) => {
                          const ch = availableChapters.find((c) => c.id === e.target.value);
                          setSelectedChapterId(e.target.value);
                          setSelectedChapterTitle(ch?.title || "");
                        }}
                        className="w-full text-xs font-semibold bg-white dark:bg-[#252A3A] border border-amber-300 dark:border-amber-500/50 rounded-xl p-2.5 text-stone-800 dark:text-[#FFF9EF] focus:outline-none focus:ring-2 focus:ring-[#800020] dark:focus:ring-amber-400"
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

                  {/* Sub-selector for Topic */}
                  {questionSource === "topic" && (
                    <div className="bg-amber-50/60 dark:bg-amber-950/30 p-3 rounded-2xl border border-amber-200/80 dark:border-amber-800/40 space-y-2.5">
                      <div>
                        <label className="block text-[11px] font-bold text-stone-700 dark:text-stone-300 mb-1">
                          1. Filter by Chapter
                        </label>
                        <select
                          value={selectedChapterId}
                          onChange={(e) => {
                            const ch = availableChapters.find((c) => c.id === e.target.value);
                            setSelectedChapterId(e.target.value);
                            setSelectedChapterTitle(ch?.title || "");
                            setSelectedTopicId("");
                            setSelectedTopicTitle("");
                          }}
                          className="w-full text-xs font-semibold bg-white dark:bg-[#252A3A] border border-amber-300 dark:border-amber-500/50 rounded-xl p-2 text-stone-800 dark:text-[#FFF9EF] focus:outline-none focus:ring-2 focus:ring-[#800020] dark:focus:ring-amber-400"
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
                        <label className="block text-[11px] font-bold text-stone-700 dark:text-stone-300 mb-1">
                          2. Select Topic
                        </label>
                        <select
                          value={selectedTopicId}
                          onChange={(e) => {
                            const top = availableTopics.find((t) => t.id === e.target.value);
                            setSelectedTopicId(e.target.value);
                            setSelectedTopicTitle(top?.title || "");
                          }}
                          className="w-full text-xs font-semibold bg-white dark:bg-[#252A3A] border border-amber-300 dark:border-amber-500/50 rounded-xl p-2 text-stone-800 dark:text-[#FFF9EF] focus:outline-none focus:ring-2 focus:ring-[#800020] dark:focus:ring-amber-400"
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

                  {/* Category Selector if curated */}
                  {questionSource === "curated" && (
                    <div className="bg-white dark:bg-[#1F2330] p-3 rounded-2xl border border-stone-200 dark:border-[#31374A] shadow-xs">
                      <label className="block text-xs font-bold text-stone-700 dark:text-stone-200 mb-1.5">
                        Category
                      </label>
                      <select
                        value={selectedCategory}
                        onChange={(e) =>
                          setSelectedCategory(e.target.value as BattleCategory)
                        }
                        className="w-full text-sm font-semibold bg-stone-50 dark:bg-[#252A3A] border border-stone-200 dark:border-[#31374A] rounded-xl px-3 py-2 text-stone-800 dark:text-[#FFF9EF] focus:outline-none focus:ring-2 focus:ring-[#800020] dark:focus:ring-amber-400"
                      >
                        <option value="all">All Subjects (Mixed GK)</option>
                        <option value="history">Rajasthan History</option>
                        <option value="geography">Rajasthan Geography</option>
                        <option value="culture">Art & Culture</option>
                        <option value="polity">Polity & Administration</option>
                        <option value="economy">Economy & Schemes</option>
                      </select>
                    </div>
                  )}

                  {/* Time per Question: 5s, 10s, 15s */}
                  <div className="bg-white dark:bg-[#1F2330] p-3 rounded-2xl border border-stone-200 dark:border-[#31374A] shadow-xs">
                    <label className="block text-xs font-bold text-stone-700 dark:text-stone-200 mb-1.5 flex items-center justify-between">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-[#800020] dark:text-amber-400" />
                        <span>Time per Question</span>
                      </span>
                      <span className="text-[10px] text-stone-500 dark:text-stone-400 font-bold">
                        {timePerQuestionSec} seconds
                      </span>
                    </label>
                    <div className="flex gap-2">
                      {[5, 10, 15].map((sec) => (
                        <button
                          key={sec}
                          type="button"
                          onClick={() => {
                            triggerHaptic("light");
                            setTimePerQuestionSec(sec);
                          }}
                          className={`flex-1 py-2 text-xs font-bold rounded-xl border transition ${
                            timePerQuestionSec === sec
                              ? "bg-[#800020] text-white border-[#800020] shadow-xs"
                              : "bg-stone-50 dark:bg-[#252A3A] text-stone-700 dark:text-stone-200 border-stone-200 dark:border-[#31374A] hover:bg-stone-100 dark:hover:bg-[#2E3448]"
                          }`}
                        >
                          {sec}s {sec === 10 && "⚡"}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Total Questions: 30, 50, 60, or Customize */}
                  <div className="bg-white dark:bg-[#1F2330] p-3 rounded-2xl border border-stone-200 dark:border-[#31374A] shadow-xs">
                    <label className="block text-xs font-bold text-stone-700 dark:text-stone-200 mb-1.5 flex items-center justify-between">
                      <span>Total Questions</span>
                      <span className="text-[10px] font-bold text-[#800020] dark:text-amber-400">
                        {questionCount} Questions
                      </span>
                    </label>
                    <div className="space-y-2">
                      <div className="grid grid-cols-4 gap-2">
                        {[30, 50, 60].map((cnt) => (
                          <button
                            key={cnt}
                            type="button"
                            onClick={() => {
                              triggerHaptic("light");
                              setIsCustomCountMode(false);
                              setQuestionCount(cnt);
                            }}
                            className={`py-2 text-xs font-bold rounded-xl border transition ${
                              !isCustomCountMode && questionCount === cnt
                                ? "bg-[#800020] text-white border-[#800020] shadow-xs"
                                : "bg-stone-50 dark:bg-[#252A3A] text-stone-700 dark:text-stone-200 border-stone-200 dark:border-[#31374A] hover:bg-stone-100 dark:hover:bg-[#2E3448]"
                            }`}
                          >
                            {cnt}
                          </button>
                        ))}
                        <button
                          type="button"
                          onClick={() => {
                            triggerHaptic("light");
                            setIsCustomCountMode(true);
                          }}
                          className={`py-2 text-xs font-bold rounded-xl border transition ${
                            isCustomCountMode
                              ? "bg-[#800020] text-white border-[#800020] shadow-xs"
                              : "bg-stone-50 dark:bg-[#252A3A] text-stone-700 dark:text-stone-200 border-stone-200 dark:border-[#31374A] hover:bg-stone-100 dark:hover:bg-[#2E3448]"
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
                                setQuestionCount(num);
                              }
                            }}
                            placeholder="e.g. 40"
                            className="flex-1 px-3 py-2 text-xs font-bold bg-stone-50 dark:bg-[#252A3A] border border-stone-300 dark:border-[#31374A] rounded-xl text-stone-800 dark:text-[#FFF9EF] focus:outline-none focus:ring-2 focus:ring-[#800020] dark:focus:ring-amber-400"
                          />
                          <span className="text-xs text-stone-500 dark:text-stone-400 font-medium">questions</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Create Room CTA Button */}
                  <button
                    onClick={handleCreateRoom}
                    className="w-full mt-2 flex items-center justify-center gap-2 py-3.5 px-6 rounded-2xl bg-[#800020] hover:bg-[#68001a] text-white font-bold text-base shadow-sm active:scale-98 transition"
                  >
                    <span>Create Room & Get Code</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Join Room Code Input Card */}
                  <div className="bg-white dark:bg-[#1F2330] p-5 rounded-2xl border border-stone-200 dark:border-[#31374A] shadow-xs space-y-3">
                    <label className="block text-xs font-bold text-stone-700 dark:text-stone-200 text-center">
                      Enter 6-Digit Room Code
                    </label>

                    <div className="relative">
                      <input
                        type="text"
                        value={inputRoomCode}
                        onChange={(e) =>
                          setInputRoomCode(e.target.value.toUpperCase())
                        }
                        placeholder="e.g. 849201"
                        maxLength={6}
                        className="w-full text-center text-3xl font-mono font-extrabold tracking-widest text-[#800020] dark:text-amber-400 bg-stone-50 dark:bg-[#252A3A] border-2 border-stone-300 dark:border-[#31374A] rounded-2xl py-3.5 px-4 focus:outline-none focus:ring-2 focus:ring-[#800020] dark:focus:ring-amber-400 shadow-inner"
                      />

                      <button
                        type="button"
                        onClick={handlePasteCode}
                        className="mt-2.5 w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-stone-100 dark:bg-[#252A3A] hover:bg-stone-200 dark:hover:bg-[#2E3448] text-stone-700 dark:text-stone-200 text-xs font-bold transition border border-stone-200 dark:border-[#31374A] active:scale-95"
                      >
                        <ClipboardPaste className="w-4 h-4 text-[#800020] dark:text-amber-400" />
                        <span>Paste from Clipboard</span>
                      </button>
                    </div>

                    <div className="p-3 bg-amber-50/70 dark:bg-amber-950/40 rounded-xl border border-amber-200 dark:border-amber-800/40 text-center">
                      <p className="text-xs text-amber-900 dark:text-amber-200 font-medium">
                        Friends can also join directly by tapping the shared WhatsApp link!
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => handleJoinRoom()}
                    disabled={!inputRoomCode || inputRoomCode.length < 4}
                    className={`w-full flex items-center justify-center gap-2 py-3.5 px-6 rounded-2xl font-bold text-base shadow-sm active:scale-98 transition ${
                      inputRoomCode && inputRoomCode.length >= 4
                        ? "bg-[#800020] hover:bg-[#68001a] text-white shadow-sm"
                        : "bg-stone-200 dark:bg-stone-800 text-stone-400 dark:text-stone-500 cursor-not-allowed"
                    }`}
                  >
                    <span>Join Battle</span>
                    <ArrowRight className="w-4 h-4" />
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
              <span>Preparing the Arena!</span>
            </div>

            <div className="relative w-36 h-36 rounded-full border-4 border-amber-400 flex items-center justify-center shadow-[0_0_50px_rgba(245,158,11,0.5)] bg-black/40 my-6 transform animate-pulse">
              <span className="text-8xl font-black font-mono text-amber-300 drop-shadow-[0_4px_12px_rgba(0,0,0,0.8)]">
                {countdownNum}
              </span>
            </div>

            <h3 className="text-xl font-extrabold text-white">
              Get Ready!
            </h3>
            <p className="text-xs text-amber-200/90 mt-1 max-w-xs">
              ⚡ 10s per question • Faster and correct answers score more points!
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
            <div className="bg-white dark:bg-[#1F2330] rounded-2xl p-5 max-w-xs w-full text-center shadow-2xl border border-stone-200 dark:border-[#31374A]">
              <AlertCircle className="w-10 h-10 text-red-500 mx-auto mb-2" />
              <h3 className="text-base font-bold text-stone-900 dark:text-[#FFF9EF]">
                Do you want to leave the battle?
              </h3>
              <p className="text-xs text-stone-600 dark:text-stone-300 mt-1 mb-4">
                Leaving the room will forfeit your score and progress.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowExitConfirm(false)}
                  className="flex-1 py-2 text-xs font-bold text-stone-700 dark:text-stone-200 bg-stone-100 dark:bg-[#252A3A] hover:bg-stone-200 dark:hover:bg-[#2E3448] rounded-xl"
                >
                  No, Stay
                </button>
                <button
                  onClick={handleLeaveRoom}
                  className="flex-1 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl"
                >
                  Yes, Leave
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
