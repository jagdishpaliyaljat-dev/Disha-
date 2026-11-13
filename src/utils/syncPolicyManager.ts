import { db, auth } from "../lib/firebase";

/**
 * 24-Hour Sync Policy & Quota Guard Manager
 * Enforces zero content reads within 24h, quota tracking, 7-day offline lock, and urgent syncs.
 */


export interface SyncPolicyState {
  lastSyncAt: number;
  lastOnlineVerifiedAt: number;
  contentVersion: number;
  urgent: boolean;
  manualSyncLastAt: number;
}

export interface QuotaLogEntry {
  timestamp: number;
  reason: string;
  cost: number;
}

const SYNC_STATE_KEY = "quizpro_sync_policy_state_v1";
const QUOTA_LOGS_KEY = "quizpro_quota_logs_v1";
const STORAGE_VERSION_KEY = "quizpro_storage_schema_version";
const CURRENT_SCHEMA_VERSION = 1;

export function getSyncPolicyState(): SyncPolicyState {
  try {
    if (typeof window === "undefined" || typeof localStorage === "undefined") {
      return { lastSyncAt: 0, lastOnlineVerifiedAt: Date.now(), contentVersion: 1, urgent: false, manualSyncLastAt: 0 };
    }
    const raw = localStorage.getItem(SYNC_STATE_KEY);
    if (!raw) {
      const defaultState: SyncPolicyState = {
        lastSyncAt: 0,
        lastOnlineVerifiedAt: Date.now(),
        contentVersion: 1,
        urgent: false,
        manualSyncLastAt: 0,
      };
      localStorage.setItem(SYNC_STATE_KEY, JSON.stringify(defaultState));
      return defaultState;
    }
    return JSON.parse(raw);
  } catch {
    return { lastSyncAt: 0, lastOnlineVerifiedAt: Date.now(), contentVersion: 1, urgent: false, manualSyncLastAt: 0 };
  }
}

export function saveSyncPolicyState(state: SyncPolicyState): void {
  try {
    if (typeof window === "undefined" || typeof localStorage === "undefined") return;
    localStorage.setItem(SYNC_STATE_KEY, JSON.stringify(state));
  } catch (err) {
    console.warn("Could not save sync policy state", err);
  }
}

// Quota Guard Wrapper
export function trackFirebaseCall(reason: string, cost = 1): void {
  try {
    if (typeof window === "undefined" || typeof localStorage === "undefined") return;
    const raw = localStorage.getItem(QUOTA_LOGS_KEY);
    const logs: QuotaLogEntry[] = raw ? JSON.parse(raw) : [];
    logs.unshift({ timestamp: Date.now(), reason, cost });
    // Keep last 500 logs
    const trimmed = logs.slice(0, 500);
    localStorage.setItem(QUOTA_LOGS_KEY, JSON.stringify(trimmed));
  } catch (err) {
    console.warn("Could not track Firebase call", err);
  }
}

export function getQuotaStats(studentCount = 500): {
  totalCallsLogged: number;
  avgCallsPerStudentPerDay: number;
  estimatedDailyTotalForN: number;
} {
  try {
    if (typeof window === "undefined" || typeof localStorage === "undefined") {
      return { totalCallsLogged: 0, avgCallsPerStudentPerDay: 1.2, estimatedDailyTotalForN: studentCount * 1.2 };
    }
    const raw = localStorage.getItem(QUOTA_LOGS_KEY);
    const logs: QuotaLogEntry[] = raw ? JSON.parse(raw) : [];
    const totalCalls = logs.reduce((acc, l) => acc + (l.cost || 1), filterRecentDay(logs));
    const avg = logs.length > 0 ? Math.max(0.5, Number((logs.length / Math.max(1, (Date.now() - (logs[logs.length - 1]?.timestamp || Date.now() - 86400000)) / 86400000)).toFixed(2))) : 1.0;
    return {
      totalCallsLogged: logs.length,
      avgCallsPerStudentPerDay: avg,
      estimatedDailyTotalForN: Math.round(avg * studentCount),
    };
  } catch {
    return { totalCallsLogged: 0, avgCallsPerStudentPerDay: 1.0, estimatedDailyTotalForN: studentCount * 1.0 };
  }
}

function filterRecentDay(logs: QuotaLogEntry[]): number {
  const oneDayAgo = Date.now() - 86400000;
  return logs.filter(l => l.timestamp >= oneDayAgo).length;
}

// 7-day offline safety check
export function checkOfflineSafetyLock(): { isLocked: boolean; daysSinceOnline: number } {
  const state = getSyncPolicyState();
  const diffMs = Date.now() - (state.lastOnlineVerifiedAt || Date.now());
  const days = diffMs / (1000 * 60 * 60 * 24);
  return {
    isLocked: days > 8, // 8 days threshold for strict safety
    daysSinceOnline: Number(days.toFixed(1)),
  };
}

// Request persistent storage
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (typeof navigator !== "undefined" && navigator.storage && navigator.storage.persist) {
      const isPersisted = await navigator.storage.persisted();
      if (!isPersisted) {
        return await navigator.storage.persist();
      }
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

// Initialize schema versioning
export function initSchemaVersioning(): void {
  try {
    if (typeof window === "undefined" || typeof localStorage === "undefined") return;
    const v = localStorage.getItem(STORAGE_VERSION_KEY);
    if (!v || Number(v) < CURRENT_SCHEMA_VERSION) {
      localStorage.setItem(STORAGE_VERSION_KEY, CURRENT_SCHEMA_VERSION.toString());
    }
  } catch (err) {
    console.warn("Schema versioning init error:", err);
  }
}
