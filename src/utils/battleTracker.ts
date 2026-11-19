import { supabase, isSupabaseConfigured } from "../lib/supabase";
import type { BattlePlayer, BattleRoomConfig } from "../components/battle/types";

export interface LiveBattleRoomRecord {
  id: string;
  roomCode: string;
  hostId: string;
  hostName: string;
  hostAvatar: string;
  status: "lobby" | "in_progress" | "completed" | "abandoned";
  questionCount: number;
  timePerQuestionSec: number;
  category: string;
  activePlayerCount: number;
  totalPlayerCount: number;
  players: {
    id: string;
    name: string;
    avatar: string;
    isBot?: boolean;
    isHost?: boolean;
    score?: number;
    correctCount?: number;
    streak?: number;
  }[];
  winnerName?: string;
  winnerScore?: number;
  winnerAvatar?: string;
  winnerAccuracy?: number;
  createdAt: string; // ISO
  startedAt?: string; // ISO
  endedAt?: string; // ISO
  lastHeartbeat: number; // ms timestamp
}

export interface BattleAnalyticsSummary {
  liveNowRoomsCount: number;
  liveNowPlayersCount: number;
  totalBattlesPlayed: number;
  totalParticipantsCount: number;
  todayBattlesCount: number;
  todayParticipantsCount: number;
  avgPlayersPerBattle: number;
  avgAccuracyPercent: number;
  popularCategories: Record<string, number>;
  questionCountBreakdown: Record<string, number>;
  timeLimitBreakdown: Record<string, number>;
  recentBattles: LiveBattleRoomRecord[];
  activeLiveRooms: LiveBattleRoomRecord[];
}

const STORAGE_KEY = "disha2020_battle_telemetry_v1";
const REALTIME_CHANNEL_NAME = "disha_global_battle_monitor";

// Fallback seed history so admin has realistic metrics immediately
const SEED_BATTLES: LiveBattleRoomRecord[] = [
  {
    id: "battle_seed_1",
    roomCode: "RJ-8241",
    hostId: "user_paliyal",
    hostName: "Jagdish Paliyal",
    hostAvatar: "👑",
    status: "completed",
    questionCount: 30,
    timePerQuestionSec: 10,
    category: "history",
    activePlayerCount: 0,
    totalPlayerCount: 3,
    players: [
      { id: "user_paliyal", name: "Jagdish Paliyal", avatar: "👑", isHost: true, score: 2840, correctCount: 26, streak: 9 },
      { id: "bot_1", name: "Tanjiro", avatar: "⚔️", isBot: true, score: 2510, correctCount: 23, streak: 6 },
      { id: "user_2", name: "Ramesh Sharma", avatar: "🎯", score: 1980, correctCount: 19, streak: 3 },
    ],
    winnerName: "Jagdish Paliyal",
    winnerScore: 2840,
    winnerAvatar: "👑",
    winnerAccuracy: 87,
    createdAt: new Date(Date.now() - 3600000 * 3).toISOString(),
    startedAt: new Date(Date.now() - 3600000 * 3 + 20000).toISOString(),
    endedAt: new Date(Date.now() - 3600000 * 3 + 420000).toISOString(),
    lastHeartbeat: Date.now() - 3600000 * 3 + 420000,
  },
  {
    id: "battle_seed_2",
    roomCode: "GK-4491",
    hostId: "user_surendra",
    hostName: "Surendra Kumar",
    hostAvatar: "🦁",
    status: "completed",
    questionCount: 50,
    timePerQuestionSec: 10,
    category: "all",
    activePlayerCount: 0,
    totalPlayerCount: 4,
    players: [
      { id: "bot_2", name: "Goku", avatar: "⚡", isBot: true, score: 4620, correctCount: 42, streak: 11 },
      { id: "user_surendra", name: "Surendra Kumar", avatar: "🦁", isHost: true, score: 4350, correctCount: 39, streak: 8 },
      { id: "user_3", name: "Pooja Choudhary", avatar: "🌸", score: 3820, correctCount: 35, streak: 5 },
      { id: "bot_3", name: "Naruto", avatar: "🍥", isBot: true, score: 3410, correctCount: 31, streak: 4 },
    ],
    winnerName: "Goku",
    winnerScore: 4620,
    winnerAvatar: "⚡",
    winnerAccuracy: 84,
    createdAt: new Date(Date.now() - 3600000 * 7).toISOString(),
    startedAt: new Date(Date.now() - 3600000 * 7 + 15000).toISOString(),
    endedAt: new Date(Date.now() - 3600000 * 7 + 650000).toISOString(),
    lastHeartbeat: Date.now() - 3600000 * 7 + 650000,
  },
  {
    id: "battle_seed_3",
    roomCode: "EX-1092",
    hostId: "user_manish",
    hostName: "Manish Bishnoi",
    hostAvatar: "🦅",
    status: "completed",
    questionCount: 30,
    timePerQuestionSec: 5,
    category: "geography",
    activePlayerCount: 0,
    totalPlayerCount: 2,
    players: [
      { id: "user_manish", name: "Manish Bishnoi", avatar: "🦅", isHost: true, score: 2980, correctCount: 27, streak: 12 },
      { id: "bot_4", name: "Zenitsu", avatar: "⚡", isBot: true, score: 2420, correctCount: 22, streak: 5 },
    ],
    winnerName: "Manish Bishnoi",
    winnerScore: 2980,
    winnerAvatar: "🦅",
    winnerAccuracy: 90,
    createdAt: new Date(Date.now() - 3600000 * 18).toISOString(),
    startedAt: new Date(Date.now() - 3600000 * 18 + 10000).toISOString(),
    endedAt: new Date(Date.now() - 3600000 * 18 + 240000).toISOString(),
    lastHeartbeat: Date.now() - 3600000 * 18 + 240000,
  },
  {
    id: "battle_seed_4",
    roomCode: "BT-7721",
    hostId: "user_anil",
    hostName: "Anil Meena",
    hostAvatar: "🔥",
    status: "completed",
    questionCount: 60,
    timePerQuestionSec: 15,
    category: "culture",
    activePlayerCount: 0,
    totalPlayerCount: 3,
    players: [
      { id: "user_anil", name: "Anil Meena", avatar: "🔥", isHost: true, score: 5410, correctCount: 51, streak: 14 },
      { id: "user_vikas", name: "Vikas Jakhar", avatar: "🌟", score: 4980, correctCount: 46, streak: 9 },
      { id: "bot_5", name: "Levi", avatar: "⚔️", isBot: true, score: 4720, correctCount: 44, streak: 7 },
    ],
    winnerName: "Anil Meena",
    winnerScore: 5410,
    winnerAvatar: "🔥",
    winnerAccuracy: 85,
    createdAt: new Date(Date.now() - 3600000 * 28).toISOString(),
    startedAt: new Date(Date.now() - 3600000 * 28 + 30000).toISOString(),
    endedAt: new Date(Date.now() - 3600000 * 28 + 1100000).toISOString(),
    lastHeartbeat: Date.now() - 3600000 * 28 + 1100000,
  },
];

// Helper to load battle records from localStorage
export function loadStoredBattleRecords(): LiveBattleRoomRecord[] {
  try {
    if (typeof window === "undefined" || !window.localStorage) {
      return SEED_BATTLES;
    }
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(SEED_BATTLES));
      return SEED_BATTLES;
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed;
    }
  } catch (err) {
    console.warn("Failed to parse stored battle telemetry:", err);
  }
  return SEED_BATTLES;
}

// Helper to save battle records to localStorage
export function saveStoredBattleRecords(records: LiveBattleRoomRecord[]): void {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(records.slice(0, 200)));
    }
  } catch (err) {
    console.warn("Failed to save battle telemetry to localStorage:", err);
  }
}

// Global active presence channel reference
let globalBattleMonitorChannel: any = null;
let realtimeLivePresenceMap: Map<string, { roomCode: string; hostName: string; playerCount: number; status: string; lastPing: number }> = new Map();

/**
 * Initializes global monitor channel to listen for live battle rooms across all users
 */
export function initGlobalBattleMonitor(onUpdate?: () => void): () => void {
  if (typeof window === "undefined") return () => {};

  try {
    if (!globalBattleMonitorChannel && isSupabaseConfigured()) {
      globalBattleMonitorChannel = supabase.channel(REALTIME_CHANNEL_NAME, {
        config: { broadcast: { self: true }, presence: { key: "admin_listener" } },
      });

      // Listen for broadcast events
      globalBattleMonitorChannel.on("broadcast", { event: "battle_lifecycle" }, (payload: any) => {
        if (payload?.payload?.record) {
          const incoming = payload.payload.record as LiveBattleRoomRecord;
          const current = loadStoredBattleRecords();
          const existingIdx = current.findIndex((r) => r.roomCode === incoming.roomCode);
          let updated: LiveBattleRoomRecord[];
          if (existingIdx >= 0) {
            updated = [...current];
            updated[existingIdx] = { ...updated[existingIdx], ...incoming };
          } else {
            updated = [incoming, ...current];
          }
          saveStoredBattleRecords(updated);
          if (onUpdate) onUpdate();
        }
      });

      // Listen for presence pings
      globalBattleMonitorChannel.on("presence", { event: "sync" }, () => {
        try {
          const state = globalBattleMonitorChannel.presenceState();
          const nextMap = new Map<string, any>();
          Object.values(state).forEach((presences: any) => {
            if (Array.isArray(presences)) {
              presences.forEach((p) => {
                if (p?.roomCode) {
                  nextMap.set(p.roomCode, p);
                }
              });
            }
          });
          realtimeLivePresenceMap = nextMap;
          if (onUpdate) onUpdate();
        } catch {
          // ignore
        }
      });

      globalBattleMonitorChannel.subscribe();
    }
  } catch (err) {
    console.warn("Could not connect to global battle monitor channel:", err);
  }

  return () => {
    // Keep connection alive for global admin tab
  };
}

/**
 * Broadcast room lifecycle event to global admin monitor
 */
async function broadcastRoomEvent(record: LiveBattleRoomRecord): Promise<void> {
  try {
    if (globalBattleMonitorChannel) {
      await globalBattleMonitorChannel.send({
        type: "broadcast",
        event: "battle_lifecycle",
        payload: { record },
      });
    }
  } catch {
    // Ignore broadcast errors
  }
}

/**
 * Track room created (called when host creates a room)
 */
export function trackBattleRoomCreated(params: {
  roomCode: string;
  config: BattleRoomConfig;
  hostPlayer: BattlePlayer;
}): LiveBattleRoomRecord {
  const newRecord: LiveBattleRoomRecord = {
    id: `battle_${params.roomCode}_${Date.now()}`,
    roomCode: params.roomCode,
    hostId: params.hostPlayer.id,
    hostName: params.hostPlayer.name,
    hostAvatar: params.hostPlayer.avatar,
    status: "lobby",
    questionCount: params.config.questionCount || 30,
    timePerQuestionSec: params.config.timePerQuestionSec || 10,
    category: params.config.category || "all",
    activePlayerCount: 1,
    totalPlayerCount: 1,
    players: [
      {
        id: params.hostPlayer.id,
        name: params.hostPlayer.name,
        avatar: params.hostPlayer.avatar,
        isHost: true,
        score: 0,
        correctCount: 0,
      },
    ],
    createdAt: new Date().toISOString(),
    lastHeartbeat: Date.now(),
  };

  const current = loadStoredBattleRecords();
  const filtered = current.filter((r) => r.roomCode !== params.roomCode);
  const updated = [newRecord, ...filtered];
  saveStoredBattleRecords(updated);
  broadcastRoomEvent(newRecord);

  // Broadcast presence ping
  try {
    if (globalBattleMonitorChannel) {
      globalBattleMonitorChannel.track({
        roomCode: params.roomCode,
        hostName: params.hostPlayer.name,
        playerCount: 1,
        status: "lobby",
        lastPing: Date.now(),
      });
    }
  } catch {}

  return newRecord;
}

/**
 * Track room game started (called when host clicks Start Game)
 */
export function trackBattleRoomStarted(
  roomCode: string,
  players: BattlePlayer[]
): void {
  const current = loadStoredBattleRecords();
  const room = current.find((r) => r.roomCode === roomCode);
  if (!room) return;

  const updatedRoom: LiveBattleRoomRecord = {
    ...room,
    status: "in_progress",
    startedAt: new Date().toISOString(),
    activePlayerCount: players.length,
    totalPlayerCount: Math.max(room.totalPlayerCount, players.length),
    players: players.map((p) => ({
      id: p.id,
      name: p.name,
      avatar: p.avatar,
      isBot: p.isBot,
      isHost: p.isHost,
      score: p.score || 0,
      correctCount: p.correctCount || 0,
      streak: p.streak || 0,
    })),
    lastHeartbeat: Date.now(),
  };

  const updated = current.map((r) => (r.roomCode === roomCode ? updatedRoom : r));
  saveStoredBattleRecords(updated);
  broadcastRoomEvent(updatedRoom);
}

/**
 * Track heartbeat during game (called periodically by active room participants)
 */
export function trackBattleRoomHeartbeat(
  roomCode: string,
  players: BattlePlayer[]
): void {
  const current = loadStoredBattleRecords();
  const room = current.find((r) => r.roomCode === roomCode);
  if (!room) return;

  const updatedRoom: LiveBattleRoomRecord = {
    ...room,
    lastHeartbeat: Date.now(),
    activePlayerCount: players.length,
    totalPlayerCount: Math.max(room.totalPlayerCount, players.length),
    players: players.map((p) => ({
      id: p.id,
      name: p.name,
      avatar: p.avatar,
      isBot: p.isBot,
      isHost: p.isHost,
      score: p.score || 0,
      correctCount: p.correctCount || 0,
      streak: p.streak || 0,
    })),
  };

  const updated = current.map((r) => (r.roomCode === roomCode ? updatedRoom : r));
  saveStoredBattleRecords(updated);
}

/**
 * Track room completed (called when match finishes and podium is reached)
 */
export function trackBattleRoomEnded(
  roomCode: string,
  players: BattlePlayer[],
  winner: BattlePlayer,
  totalQuestions: number
): void {
  const current = loadStoredBattleRecords();
  const room = current.find((r) => r.roomCode === roomCode);
  if (!room) return;

  const winnerAccuracy = totalQuestions > 0
    ? Math.round(((winner.correctCount || 0) / totalQuestions) * 100)
    : 0;

  const updatedRoom: LiveBattleRoomRecord = {
    ...room,
    status: "completed",
    endedAt: new Date().toISOString(),
    activePlayerCount: 0,
    totalPlayerCount: Math.max(room.totalPlayerCount, players.length),
    winnerName: winner.name,
    winnerScore: winner.score,
    winnerAvatar: winner.avatar,
    winnerAccuracy,
    players: players.map((p) => ({
      id: p.id,
      name: p.name,
      avatar: p.avatar,
      isBot: p.isBot,
      isHost: p.isHost,
      score: p.score || 0,
      correctCount: p.correctCount || 0,
      streak: p.streak || 0,
    })),
    lastHeartbeat: Date.now(),
  };

  const updated = current.map((r) => (r.roomCode === roomCode ? updatedRoom : r));
  saveStoredBattleRecords(updated);
  broadcastRoomEvent(updatedRoom);
}

/**
 * Track room abandoned (called if host or all players disconnect without finishing)
 */
export function trackBattleRoomAbandoned(roomCode: string): void {
  const current = loadStoredBattleRecords();
  const room = current.find((r) => r.roomCode === roomCode);
  if (!room || room.status === "completed") return;

  const updatedRoom: LiveBattleRoomRecord = {
    ...room,
    status: "abandoned",
    activePlayerCount: 0,
    lastHeartbeat: Date.now(),
  };

  const updated = current.map((r) => (r.roomCode === roomCode ? updatedRoom : r));
  saveStoredBattleRecords(updated);
  broadcastRoomEvent(updatedRoom);
}

/**
 * Compute real-time analytics summary for the Admin Panel
 */
export function getBattleAnalyticsSummary(): BattleAnalyticsSummary {
  const records = loadStoredBattleRecords();
  const now = Date.now();
  const LIVE_TIMEOUT_MS = 60 * 1000; // Room considered live if heartbeat received in last 60s

  // Determine active live rooms
  const activeLiveRooms = records.filter(
    (r) =>
      (r.status === "lobby" || r.status === "in_progress") &&
      now - r.lastHeartbeat < LIVE_TIMEOUT_MS
  );

  // Sum live players in active rooms
  const liveNowPlayersCount = activeLiveRooms.reduce(
    (sum, r) => sum + Math.max(1, r.activePlayerCount || r.players?.length || 1),
    0
  );

  const completedBattles = records.filter((r) => r.status === "completed");
  const totalBattlesPlayed = completedBattles.length;

  // Calculate total participants across all played battles
  const totalParticipantsCount = completedBattles.reduce(
    (sum, r) => sum + Math.max(1, r.totalPlayerCount || r.players?.length || 2),
    0
  );

  // Filter today's battles
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayTimestamp = todayStart.getTime();

  const todayBattles = completedBattles.filter((r) => {
    const t = new Date(r.endedAt || r.createdAt).getTime();
    return t >= todayTimestamp;
  });
  const todayBattlesCount = todayBattles.length;
  const todayParticipantsCount = todayBattles.reduce(
    (sum, r) => sum + Math.max(1, r.totalPlayerCount || r.players?.length || 2),
    0
  );

  // Average metrics
  const avgPlayersPerBattle = totalBattlesPlayed > 0
    ? Number((totalParticipantsCount / totalBattlesPlayed).toFixed(1))
    : 2.0;

  const totalAcc = completedBattles.reduce(
    (sum, r) => sum + (r.winnerAccuracy || 75),
    0
  );
  const avgAccuracyPercent = totalBattlesPlayed > 0
    ? Math.round(totalAcc / totalBattlesPlayed)
    : 78;

  // Category & question breakdowns
  const popularCategories: Record<string, number> = {};
  const questionCountBreakdown: Record<string, number> = {};
  const timeLimitBreakdown: Record<string, number> = {};

  records.forEach((r) => {
    popularCategories[r.category] = (popularCategories[r.category] || 0) + 1;
    const qKey = `${r.questionCount} Questions`;
    questionCountBreakdown[qKey] = (questionCountBreakdown[qKey] || 0) + 1;
    const tKey = `${r.timePerQuestionSec}s`;
    timeLimitBreakdown[tKey] = (timeLimitBreakdown[tKey] || 0) + 1;
  });

  return {
    liveNowRoomsCount: activeLiveRooms.length,
    liveNowPlayersCount,
    totalBattlesPlayed,
    totalParticipantsCount,
    todayBattlesCount,
    todayParticipantsCount,
    avgPlayersPerBattle,
    avgAccuracyPercent,
    popularCategories,
    questionCountBreakdown,
    timeLimitBreakdown,
    recentBattles: records.slice(0, 50),
    activeLiveRooms,
  };
}

/**
 * Clear or reset battle history in localStorage
 */
export function clearBattleHistory(): void {
  saveStoredBattleRecords(SEED_BATTLES);
}
