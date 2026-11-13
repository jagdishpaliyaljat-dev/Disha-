import { getLocalMetadata, setLocalMetadata, isIndexedDbSupported, getQuizProDB } from "./indexedDbCache";

export interface SyncCheckpointMetadata {
  syncMode: "strict_24h";
  bootstrapCompleted: boolean;
  schemaVersion: number;
  contentVersion: number;
  lastSuccessfulSyncAt: number | null;
  nextSyncEligibleAt: number | null;
  lastAttemptedSyncAt: number | null;
  pendingEventCount: number;
  syncStatus: "idle" | "syncing" | "locked" | "error";
  syncOwner: string | null;
  syncLockExpiresAt: number | null;
  lastSyncError: string | null;
}

const DEFAULT_CHECKPOINT: SyncCheckpointMetadata = {
  syncMode: "strict_24h",
  bootstrapCompleted: false,
  schemaVersion: 1,
  contentVersion: 0,
  lastSuccessfulSyncAt: null,
  nextSyncEligibleAt: null,
  lastAttemptedSyncAt: null,
  pendingEventCount: 0,
  syncStatus: "idle",
  syncOwner: null,
  syncLockExpiresAt: null,
  lastSyncError: null,
};

const CHECKPOINT_STORAGE_KEY = "strict_24h_sync_checkpoint_v1";
const SYNC_INTERVAL_MS = 24 * 60 * 60 * 1000; // Exactly 24 hours

let inMemoryCheckpoint: SyncCheckpointMetadata | null = null;

/**
 * Loads and validates the Sync Checkpoint Metadata from local storage / IndexedDB metadata store.
 */
export async function loadSyncCheckpoint(): Promise<SyncCheckpointMetadata> {
  if (inMemoryCheckpoint) {
    return { ...inMemoryCheckpoint };
  }

  try {
    const raw = await getLocalMetadata<SyncCheckpointMetadata>(CHECKPOINT_STORAGE_KEY);
    if (raw && typeof raw === "object" && raw.syncMode === "strict_24h") {
      inMemoryCheckpoint = {
        ...DEFAULT_CHECKPOINT,
        ...raw,
        schemaVersion: Number(raw.schemaVersion) || 1,
        contentVersion: Number(raw.contentVersion) || 0,
        lastSuccessfulSyncAt: raw.lastSuccessfulSyncAt ? Number(raw.lastSuccessfulSyncAt) : null,
        nextSyncEligibleAt: raw.nextSyncEligibleAt ? Number(raw.nextSyncEligibleAt) : null,
        lastAttemptedSyncAt: raw.lastAttemptedSyncAt ? Number(raw.lastAttemptedSyncAt) : null,
        pendingEventCount: Number(raw.pendingEventCount) || 0,
      };
      return { ...inMemoryCheckpoint };
    }
  } catch (err) {
    console.warn("[SyncCheckpoint] Error loading checkpoint, using default:", err);
  }

  inMemoryCheckpoint = { ...DEFAULT_CHECKPOINT };
  await saveSyncCheckpoint(inMemoryCheckpoint);
  return { ...inMemoryCheckpoint };
}

/**
 * Persists the Sync Checkpoint Metadata locally.
 */
export async function saveSyncCheckpoint(metadata: SyncCheckpointMetadata): Promise<void> {
  inMemoryCheckpoint = { ...metadata };
  try {
    await setLocalMetadata(CHECKPOINT_STORAGE_KEY, inMemoryCheckpoint);
  } catch (err) {
    console.warn("[SyncCheckpoint] Error saving checkpoint:", err);
  }
}

/**
 * Pure 24-Hour Eligibility Calculator function.
 * Determines whether a new full sync session is currently permitted based on the 24-hour rule.
 */
export function isSyncEligible(checkpoint: SyncCheckpointMetadata, now: number = Date.now()): {
  eligible: boolean;
  reason: string;
  remainingTimeMs: number;
} {
  if (!checkpoint.bootstrapCompleted) {
    return {
      eligible: true,
      reason: "Initial bootstrap not yet completed.",
      remainingTimeMs: 0,
    };
  }

  if (!checkpoint.lastSuccessfulSyncAt) {
    return {
      eligible: true,
      reason: "No prior successful sync recorded.",
      remainingTimeMs: 0,
    };
  }

  const elapsed = now - checkpoint.lastSuccessfulSyncAt;
  if (elapsed >= SYNC_INTERVAL_MS) {
    return {
      eligible: true,
      reason: "24-hour interval has elapsed since last successful sync.",
      remainingTimeMs: 0,
    };
  }

  const remaining = SYNC_INTERVAL_MS - elapsed;
  return {
    eligible: false,
    reason: `24-hour interval not yet elapsed. Remaining time: ${Math.round(remaining / 1000 / 60)} minutes.`,
    remainingTimeMs: remaining,
  };
}

/**
 * Acquires a persistent synchronization lock to prevent duplicate execution across tabs.
 */
export async function acquireSyncLock(ownerId: string, ttlMs: number = 60000): Promise<boolean> {
  const checkpoint = await loadSyncCheckpoint();
  const now = Date.now();

  // Check if existing lock is active and not expired
  if (checkpoint.syncStatus === "locked" && checkpoint.syncOwner && checkpoint.syncLockExpiresAt) {
    if (now < checkpoint.syncLockExpiresAt && checkpoint.syncOwner !== ownerId) {
      return false; // Lock held by another active owner
    }
  }

  checkpoint.syncStatus = "locked";
  checkpoint.syncOwner = ownerId;
  checkpoint.syncLockExpiresAt = now + ttlMs;
  checkpoint.lastAttemptedSyncAt = now;
  await saveSyncCheckpoint(checkpoint);
  return true;
}

/**
 * Releases the persistent synchronization lock.
 */
export async function releaseSyncLock(ownerId: string, success: boolean, errorMessage?: string): Promise<void> {
  const checkpoint = await loadSyncCheckpoint();
  const now = Date.now();

  if (checkpoint.syncOwner === ownerId || !checkpoint.syncOwner) {
    checkpoint.syncStatus = success ? "idle" : "error";
    checkpoint.syncOwner = null;
    checkpoint.syncLockExpiresAt = null;
    if (success) {
      checkpoint.lastSuccessfulSyncAt = now;
      checkpoint.nextSyncEligibleAt = now + SYNC_INTERVAL_MS;
      checkpoint.lastSyncError = null;
    } else if (errorMessage) {
      checkpoint.lastSyncError = errorMessage;
    }
    await saveSyncCheckpoint(checkpoint);
  }
}

/**
 * Updates pending activity event counter in the checkpoint metadata.
 */
export async function updatePendingEventCounter(count: number): Promise<void> {
  const checkpoint = await loadSyncCheckpoint();
  checkpoint.pendingEventCount = Math.max(0, count);
  await saveSyncCheckpoint(checkpoint);
}

/**
 * Diagnostic classification of existing Firestore listeners.
 */
export interface ListenerClassification {
  name: string;
  path: string;
  purpose: string;
  readBehavior: "realtime_listener" | "on_demand" | "cached";
  dependencies: string[];
}

export const CLASSIFIED_LISTENERS: ListenerClassification[] = [
  {
    name: "App Version Listener",
    path: "metadata/app_version",
    purpose: "Checks curriculum version and remote tree metadata for updates.",
    readBehavior: "realtime_listener",
    dependencies: ["Auth state", "App boot"],
  },
  {
    name: "User Progress Sync Listener",
    path: "users/{uid}/progress",
    purpose: "Synchronizes student question attempt progress in real-time.",
    readBehavior: "realtime_listener",
    dependencies: ["Authenticated User ID"],
  },
  {
    name: "User History Sync Listener",
    path: "users/{uid}/history",
    purpose: "Synchronizes daily correct/wrong study stats.",
    readBehavior: "realtime_listener",
    dependencies: ["Authenticated User ID"],
  },
];
