import { doc, increment } from "firebase/firestore";
import { db, isFirebaseConfigured } from "../lib/firebase";
import {
  guardedGetDoc,
  guardedSetDoc,
  guardedRunTransaction,
  clearFirestoreCache,
  isQuotaExhausted,
  classifyFirestoreError,
} from "./quotaTracker";
import { getLocalMetadata, setLocalMetadata } from "./indexedDbCache";
import { fetchQuizAssetVersion, invalidateQuizAssetsClientAndServer } from "./quizAssetSwCache";

export interface AppVersionMetadata {
  curriculumVersion: number;
  lastUpdated: string;
  bundleVersions?: Record<string, number>;
  announcement?: string;
  minSupportedAppVersion?: string;
  contentDigest?: string;
}

export interface PendingVersionBump {
  id: string;
  timestamp: string;
  topicIds: string[];
  announcement?: string;
  contentDigest?: string;
  retryCount: number;
}

export interface BumpVersionOptions {
  contentDigest?: string;
  force?: boolean;
  reason?: string;
}

const METADATA_DOC_ID = "app_version";
const LOCAL_META_KEY = "curriculum_version_meta";
const PENDING_BUMPS_KEY = "quizpro_pending_version_bumps";
const LAST_DIGEST_KEY = "quizpro_last_version_digest_v1";

let inMemoryPendingBumps: PendingVersionBump[] = [];
let inMemoryLastDigest: string | null = null;
let versionBumpLock: Promise<any> = Promise.resolve();

function getLastBumpedDigest(): string | null {
  if (inMemoryLastDigest) return inMemoryLastDigest;
  if (typeof localStorage !== "undefined") {
    try {
      const val = localStorage.getItem(LAST_DIGEST_KEY);
      if (val) {
        inMemoryLastDigest = val;
        return val;
      }
    } catch {}
  }
  return null;
}

function setLastBumpedDigest(digest?: string | null): void {
  inMemoryLastDigest = digest || null;
  if (typeof localStorage !== "undefined") {
    try {
      if (digest) localStorage.setItem(LAST_DIGEST_KEY, digest);
      else localStorage.removeItem(LAST_DIGEST_KEY);
    } catch {}
  }
}

export function __resetVersionServiceCacheForTests(): void {
  inMemoryPendingBumps = [];
  inMemoryLastDigest = null;
  versionBumpLock = Promise.resolve();
  if (typeof localStorage !== "undefined") {
    try {
      localStorage.removeItem(PENDING_BUMPS_KEY);
      localStorage.removeItem(LAST_DIGEST_KEY);
    } catch {}
  }
}

/**
 * Get pending version bumps queue from localStorage or memory fallback
 */
export function getPendingVersionBumps(): PendingVersionBump[] {
  if (typeof localStorage === "undefined") return inMemoryPendingBumps;
  try {
    const raw = localStorage.getItem(PENDING_BUMPS_KEY);
    return raw ? JSON.parse(raw) : inMemoryPendingBumps;
  } catch (_) {
    return inMemoryPendingBumps;
  }
}

/**
 * Get count of pending version bumps for diagnostic monitor
 */
export function getPendingVersionBumpsCount(): number {
  return getPendingVersionBumps().length;
}

/**
 * Save pending version bumps queue to localStorage and memory fallback
 */
export function savePendingVersionBumps(queue: PendingVersionBump[]): void {
  inMemoryPendingBumps = queue;
  if (typeof localStorage === "undefined") return;
  try {
    if (queue.length === 0) {
      localStorage.removeItem(PENDING_BUMPS_KEY);
    } else {
      localStorage.setItem(PENDING_BUMPS_KEY, JSON.stringify(queue));
    }
  } catch (_) {}
}

/**
 * Clear pending version bumps queue
 */
export function clearPendingVersionBumps(): void {
  savePendingVersionBumps([]);
}

/**
 * Enqueue a version bump into durable pending queue, coalescing multiple
 * queued bumps into a single logical bump entry so recovery costs 1 write instead of N.
 */
export function enqueuePendingVersionBump(
  topicIds: string[],
  announcement?: string,
  contentDigest?: string
): PendingVersionBump {
  const queue = getPendingVersionBumps();
  const normalizedTopicIds = Array.from(new Set((topicIds || []).filter(Boolean)));

  if (queue.length > 0) {
    const existing = queue[0];
    const mergedTopics = Array.from(new Set([...(existing.topicIds || []), ...normalizedTopicIds]));
    const coalesced: PendingVersionBump = {
      ...existing,
      timestamp: new Date().toISOString(),
      topicIds: mergedTopics,
      announcement: announcement !== undefined ? announcement : existing.announcement,
      contentDigest: contentDigest || existing.contentDigest,
    };
    savePendingVersionBumps([coalesced]);
    return coalesced;
  }

  const bump: PendingVersionBump = {
    id: `bump-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
    timestamp: new Date().toISOString(),
    topicIds: normalizedTopicIds,
    announcement,
    contentDigest,
    retryCount: 0,
  };
  savePendingVersionBumps([bump]);
  return bump;
}

/**
 * Execute an atomic version bump inside a Firestore transaction to prevent concurrent overwrites.
 */
async function executeAtomicVersionBump(
  topicIds: string[],
  announcement: string | undefined,
  options: BumpVersionOptions | undefined
): Promise<{ version: number; skipped: boolean; bundleVersions: Record<string, number>; contentDigest?: string }> {
  const docRef = doc(db, "metadata", METADATA_DOC_ID);
  const now = new Date().toISOString();
  const uniqueTopics = Array.from(new Set((topicIds || []).filter(Boolean)));

  return guardedRunTransaction(
    db,
    async (tx) => {
      const snap = await tx.get(docRef);
      let newVersion = 2;
      let bundleVersions: Record<string, number> = {};
      let nextAnnouncement = announcement || "";

      if (snap.exists()) {
        const current = snap.data() as AppVersionMetadata;
        if (
          options?.contentDigest &&
          !options?.force &&
          current.contentDigest &&
          current.contentDigest === options.contentDigest
        ) {
          setLastBumpedDigest(options.contentDigest);
          return {
            version: current.curriculumVersion || 1,
            skipped: true,
            bundleVersions: { ...(current.bundleVersions || {}) },
            contentDigest: current.contentDigest,
          };
        }

        newVersion = (current.curriculumVersion || 1) + 1;
        bundleVersions = { ...(current.bundleVersions || {}) };
        nextAnnouncement = announcement !== undefined ? announcement : current.announcement || "";
      }

      uniqueTopics.forEach((id) => {
        bundleVersions[id] = (bundleVersions[id] || 0) + 1;
      });

      const payload: AppVersionMetadata = {
        curriculumVersion: newVersion,
        lastUpdated: now,
        bundleVersions,
        announcement: nextAnnouncement,
        ...(options?.contentDigest ? { contentDigest: options.contentDigest } : {}),
      };

      tx.set(docRef, payload, { merge: true });

      return {
        version: newVersion,
        skipped: false,
        bundleVersions,
        contentDigest: options?.contentDigest,
      };
    },
    "Admin",
    options?.reason ? `Bump Version (${options.reason})` : "Atomic Curriculum Version Bump"
  );
}

/**
 * Process and flush any pending version bumps stored in localStorage.
 * Coalesces all queued pending bumps into 1 single atomic transaction.
 */
export async function processPendingVersionBumps(): Promise<number> {
  const queue = getPendingVersionBumps();
  if (queue.length === 0 || !isFirebaseConfigured()) return 0;

  if (isQuotaExhausted()) {
    console.warn("[Version Recovery] Quota circuit breaker active; preserving pending version bumps in queue.");
    return 0;
  }

  // Coalesce all pending bumps into 1 logical workflow bump
  const allTopics = Array.from(new Set(queue.flatMap((q) => q.topicIds || [])));
  const latestAnnouncement = [...queue].reverse().find((q) => q.announcement !== undefined)?.announcement;
  const latestDigest = [...queue].reverse().find((q) => q.contentDigest)?.contentDigest;

  try {
    const res = await executeAtomicVersionBump(allTopics, latestAnnouncement, {
      contentDigest: latestDigest,
      force: true,
      reason: "flush_pending",
    });

    if (res.contentDigest) {
      setLastBumpedDigest(res.contentDigest);
    }

    await recordLocalCurriculumVersion({
      curriculumVersion: res.version,
      lastUpdated: new Date().toISOString(),
      bundleVersions: res.bundleVersions,
      ...(res.contentDigest ? { contentDigest: res.contentDigest } : {}),
    });

    savePendingVersionBumps([]);
    return queue.length;
  } catch (err: any) {
    const info = classifyFirestoreError(err);
    if (info.isQuotaError || isQuotaExhausted()) {
      // Preserve safely in queue without burning retries
      return 0;
    }
    if (info.isPermanent) {
      console.error("[Version Recovery] Permanent error flushing version bump:", info.message);
      savePendingVersionBumps([]);
      return 0;
    }

    const updatedQueue = queue.map((item) => ({
      ...item,
      retryCount: (item.retryCount || 0) + 1,
    }));
    savePendingVersionBumps(updatedQueue);
    return 0;
  }
}

/**
 * Perform a 1-READ Versioning Check:
 * Reads ONE single document from Firestore (`metadata/app_version`) to check if any curriculum
 * or question bundles have changed.
 */
export async function checkCurriculumVersionMatch(options?: { allowRemote?: boolean }): Promise<{
  isUpToDate: boolean;
  remoteVersion: number;
  localVersion: number;
  remoteMetadata: AppVersionMetadata | null;
}> {
  const { isUserAdmin, loadUserProfile } = await import("./userProfileStorage");
  const isAdmin = isUserAdmin(loadUserProfile());

  // Strict 24-Hour Offline-First Policy:
  // For students, routine version check is strictly local.
  // Remote version check happens only inside central SyncCoordinator during scheduled 24h sync.
  if (!options?.allowRemote && !isAdmin) {
    const local = await getLocalMetadata<AppVersionMetadata>(LOCAL_META_KEY);
    return {
      isUpToDate: true,
      remoteVersion: local?.curriculumVersion || 1,
      localVersion: local?.curriculumVersion || 1,
      remoteMetadata: local || null,
    };
  }

  if (isQuotaExhausted() || !isFirebaseConfigured()) {
    const local = await getLocalMetadata<AppVersionMetadata>(LOCAL_META_KEY);
    return {
      isUpToDate: true,
      remoteVersion: local?.curriculumVersion || 1,
      localVersion: local?.curriculumVersion || 1,
      remoteMetadata: local || null,
    };
  }

  try {
    if (typeof localStorage !== "undefined" && getPendingVersionBumpsCount() > 0) {
      const { isUserAdmin, loadUserProfile } = await import("./userProfileStorage");
      if (isUserAdmin(loadUserProfile())) {
        await processPendingVersionBumps();
      }
    }
  } catch (_) {}

  try {
    // 0. Prefer lightweight server-cached version endpoint (1 shared server read/60s instead of 1 per user visit)
    const swVersion = await fetchQuizAssetVersion().catch(() => null);
    if (swVersion && typeof swVersion.curriculumVersion === "number") {
      const remoteData: AppVersionMetadata = {
        curriculumVersion: swVersion.curriculumVersion || 1,
        lastUpdated: swVersion.lastUpdated,
        bundleVersions: swVersion.bundleVersions || {},
        ...(swVersion.contentDigest ? { contentDigest: swVersion.contentDigest } : {}),
      };
      if (remoteData.contentDigest) {
        setLastBumpedDigest(remoteData.contentDigest);
      }
      const localMeta = await getLocalMetadata<AppVersionMetadata>(LOCAL_META_KEY);
      const localVersion = localMeta?.curriculumVersion || 0;
      const isUpToDate = localVersion >= remoteData.curriculumVersion && localVersion > 0;
      return {
        isUpToDate,
        remoteVersion: remoteData.curriculumVersion,
        localVersion,
        remoteMetadata: remoteData,
      };
    }

    const docRef = doc(db, "metadata", METADATA_DOC_ID);
    const snap = await guardedGetDoc(docRef, "Student", "Versioning Check (1-Read Sync)");

    let remoteData: AppVersionMetadata;

    if (!snap.exists()) {
      remoteData = {
        curriculumVersion: 1,
        lastUpdated: new Date().toISOString(),
        bundleVersions: {},
        announcement: "",
      };
      if (!isQuotaExhausted()) {
        try {
          await guardedSetDoc(docRef, remoteData, { merge: true }, "Admin", "Initialize App Version");
        } catch {}
      }
    } else {
      remoteData = snap.data() as AppVersionMetadata;
    }

    const remoteVersion = remoteData.curriculumVersion || 1;
    if (remoteData.contentDigest) {
      setLastBumpedDigest(remoteData.contentDigest);
    }

    const localMeta = await getLocalMetadata<AppVersionMetadata>(LOCAL_META_KEY);
    const localVersion = localMeta?.curriculumVersion || 0;

    const isUpToDate = localVersion >= remoteVersion && localVersion > 0;

    return {
      isUpToDate,
      remoteVersion,
      localVersion,
      remoteMetadata: remoteData,
    };
  } catch (err) {
    console.warn("[Versioning Check] Could not check remote version, falling back to local cache:", err);
    const localMeta = await getLocalMetadata<AppVersionMetadata>(LOCAL_META_KEY);
    return {
      isUpToDate: true,
      remoteVersion: localMeta?.curriculumVersion || 1,
      localVersion: localMeta?.curriculumVersion || 1,
      remoteMetadata: localMeta || null,
    };
  }
}

/**
 * Record the newly synced version into local IndexedDB
 */
export async function recordLocalCurriculumVersion(metadata: AppVersionMetadata): Promise<void> {
  await setLocalMetadata(LOCAL_META_KEY, metadata);
}

/**
 * Admin Action: Increment the curriculum version in Firestore.
 * - Serializes concurrent calls in-process AND executes inside a Firestore transaction
 *   so concurrent bumps NEVER overwrite each other.
 * - Skips redundant bumps when `options.contentDigest` matches the last bumped digest.
 * - Respects quota circuit breaker: queues locally without resetting quota flags.
 */
export async function bumpRemoteCurriculumVersion(
  updatedTopicIds?: string | string[],
  announcement?: string,
  options?: BumpVersionOptions
): Promise<number> {
  const runSerialized = async (): Promise<number> => {
    clearFirestoreCache();
    if (!isFirebaseConfigured()) return 1;

    const topicIds = Array.from(
      new Set(
        (Array.isArray(updatedTopicIds)
          ? updatedTopicIds
          : updatedTopicIds
          ? [updatedTopicIds]
          : []
        ).filter(Boolean)
      )
    );

    // Skip unchanged digest locally with 0 Firestore reads/writes
    if (options?.contentDigest && !options?.force && getPendingVersionBumpsCount() === 0) {
      const lastDigest = getLastBumpedDigest();
      if (lastDigest && lastDigest === options.contentDigest) {
        const localMeta = await getLocalMetadata<AppVersionMetadata>(LOCAL_META_KEY);
        return localMeta?.curriculumVersion || 1;
      }
    }

    // Strict circuit breaker check BEFORE queueing or calling Firestore
    if (isQuotaExhausted()) {
      enqueuePendingVersionBump(topicIds, announcement, options?.contentDigest);
      console.warn("[Quota Circuit Breaker] bumpRemoteCurriculumVersion queued locally; quota exhausted.");
      const localMeta = await getLocalMetadata<AppVersionMetadata>(LOCAL_META_KEY);
      return localMeta?.curriculumVersion || 1;
    }

    // Enqueue durably pre-commit so network interruption never drops the bump
    const pendingBump = enqueuePendingVersionBump(topicIds, announcement, options?.contentDigest);

    try {
      const pendingMergedTopics = Array.from(
        new Set([...(pendingBump.topicIds || []), ...topicIds])
      );
      const res = await executeAtomicVersionBump(
        pendingMergedTopics,
        announcement !== undefined ? announcement : pendingBump.announcement,
        options
      );

      // Success! Clear queue and record digest/local metadata
      clearPendingVersionBumps();
      if (res.contentDigest || options?.contentDigest) {
        setLastBumpedDigest(res.contentDigest || options?.contentDigest);
      }

      await recordLocalCurriculumVersion({
        curriculumVersion: res.version,
        lastUpdated: new Date().toISOString(),
        bundleVersions: res.bundleVersions,
        ...(res.contentDigest ? { contentDigest: res.contentDigest } : {}),
      });

      if (!res.skipped) {
        invalidateQuizAssetsClientAndServer(pendingMergedTopics).catch(() => {});
      }

      return res.version;
    } catch (err) {
      console.warn("[Versioning] Atomic bump failed, bump remains coalesced in pending queue:", err);
      const localMeta = await getLocalMetadata<AppVersionMetadata>(LOCAL_META_KEY);
      return localMeta?.curriculumVersion || 1;
    }
  };

  // Chain onto single-flight mutex lock so concurrent callers run sequentially cleanly
  const next = versionBumpLock.then(runSerialized, runSerialized);
  versionBumpLock = next.catch(() => 1);
  return next;
}
