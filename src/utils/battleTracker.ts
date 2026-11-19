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

// Clean-slate production policy: Zero hardcoded mock battle records
const SEED_BATTLES: LiveBattleRoomRecord[] = [];

// Helper to load battle records from localStorage
export function loadStoredBattleRecords(): LiveBattleRoomRecord[] {
  try {
    if (typeof window === "undefined" || !window.localStorage) {
      return [];
    }
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.filter((r) => !r.id.startsWith("battle_seed_"));
    }
  } catch (err) {
    console.warn("Failed to parse stored battle telemetry:", err);
  }
  return [];
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
 * Asynchronously persist battle room state to Supabase Cloud
 */
async function syncBattleRecordToCloud(record: LiveBattleRoomRecord): Promise<void> {
  if (!isSupabaseConfigured()) return;
  try {
    await supabase.from("battle_telemetry").upsert({
      id: record.id,
      room_code: record.roomCode,
      host_id: record.hostId,
      host_name: record.hostName,
      host_avatar: record.hostAvatar,
      status: record.status,
      question_count: record.questionCount,
      time_per_question_sec: record.timePerQuestionSec,
      category: record.category,
      active_player_count: record.activePlayerCount,
      total_player_count: record.totalPlayerCount,
      players: record.players,
      winner_name: record.winnerName || null,
      winner_score: record.winnerScore || null,
      winner_avatar: record.winnerAvatar || null,
      winner_accuracy: record.winnerAccuracy || null,
      created_at: record.createdAt,
      started_at: record.startedAt || null,
      ended_at: record.endedAt || null,
      last_heartbeat: record.lastHeartbeat || Date.now(),
      updated_at: new Date().toISOString(),
    });
  } catch (err) {
    console.warn("Failed to sync battle room to Supabase:", err);
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
  syncBattleRecordToCloud(newRecord);

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
  syncBattleRecordToCloud(updatedRoom);
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
  syncBattleRecordToCloud(updatedRoom);
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
  syncBattleRecordToCloud(updatedRoom);
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
  syncBattleRecordToCloud(updatedRoom);
}

/**
 * Compute real-time analytics summary from records array
 */
export function computeBattleSummaryFromRecords(records: LiveBattleRoomRecord[]): BattleAnalyticsSummary {
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
 * Compute real-time analytics summary from localStorage
 */
export function getBattleAnalyticsSummary(): BattleAnalyticsSummary {
  const records = loadStoredBattleRecords();
  return computeBattleSummaryFromRecords(records);
}

/**
 * Fetch live battle analytics directly from Supabase Cloud table
 */
export async function fetchLiveBattleAnalyticsSummary(): Promise<BattleAnalyticsSummary> {
  if (isSupabaseConfigured()) {
    try {
      const { data, error } = await supabase
        .from("battle_telemetry")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);

      if (!error && Array.isArray(data)) {
        const cloudRecords: LiveBattleRoomRecord[] = data.map((r: any) => ({
          id: r.id,
          roomCode: r.room_code,
          hostId: r.host_id || "",
          hostName: r.host_name || "Host",
          hostAvatar: r.host_avatar || "👑",
          status: r.status || "completed",
          questionCount: r.question_count || 30,
          timePerQuestionSec: r.time_per_question_sec || 10,
          category: r.category || "all",
          activePlayerCount: r.active_player_count || 0,
          totalPlayerCount: r.total_player_count || (Array.isArray(r.players) ? r.players.length : 1),
          players: Array.isArray(r.players) ? r.players : [],
          winnerName: r.winner_name || undefined,
          winnerScore: r.winner_score || undefined,
          winnerAvatar: r.winner_avatar || undefined,
          winnerAccuracy: r.winner_accuracy || undefined,
          createdAt: r.created_at || new Date().toISOString(),
          startedAt: r.started_at || undefined,
          endedAt: r.ended_at || undefined,
          lastHeartbeat: typeof r.last_heartbeat === "number" ? r.last_heartbeat : (r.created_at ? new Date(r.created_at).getTime() : Date.now()),
        }));

        const localRecords = loadStoredBattleRecords();
        const mergedMap = new Map<string, LiveBattleRoomRecord>();
        localRecords.forEach((lr) => mergedMap.set(lr.id, lr));
        cloudRecords.forEach((cr) => mergedMap.set(cr.id, cr));

        const allRecords = Array.from(mergedMap.values())
          .filter((r) => !r.id.startsWith("battle_seed_"))
          .sort(
            (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );
        saveStoredBattleRecords(allRecords);
        return computeBattleSummaryFromRecords(allRecords);
      }
    } catch (err) {
      console.warn("fetchLiveBattleAnalyticsSummary error, fallback to local:", err);
    }
  }
  return getBattleAnalyticsSummary();
}

/**
 * Clear or reset battle history in localStorage
 */
export function clearBattleHistory(): void {
  saveStoredBattleRecords([]);
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  } catch {}
}
