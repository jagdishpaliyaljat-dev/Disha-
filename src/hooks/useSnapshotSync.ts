/**
 * useSnapshotSync - React Hook for Snapshot-Based Synchronization Architecture
 * Clean, deterministic 24-hour snapshot synchronization.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import {
  defaultSyncScheduler,
  defaultManifestManager,
  defaultUserActivityQueue,
  getActiveSnapshotMetadata,
  migrateV4toV5,
  SyncExecutionResult
} from "../services/snapshot";

export interface SnapshotSyncState {
  isSyncing: boolean;
  syncPhase: "idle" | "checking_manifest" | "downloading" | "applying_delta" | "ready" | "error";
  snapshotVersion: number;
  lastSuccessfulSyncAt: number | null;
  pendingActivityCount: number;
  syncError: string | null;
  forceSync: () => Promise<SyncExecutionResult>;
  flushActivityQueue: () => Promise<void>;
}

export function useSnapshotSync(): SnapshotSyncState {
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncPhase, setSyncPhase] = useState<SnapshotSyncState["syncPhase"]>("idle");
  const [snapshotVersion, setSnapshotVersion] = useState<number>(0);
  const [lastSuccessfulSyncAt, setLastSuccessfulSyncAt] = useState<number | null>(null);
  const [pendingActivityCount, setPendingActivityCount] = useState<number>(0);
  const [syncError, setSyncError] = useState<string | null>(null);

  const mountedRef = useRef<boolean>(true);

  const refreshLocalState = useCallback(async () => {
    try {
      const meta = await getActiveSnapshotMetadata();
      if (meta && mountedRef.current) {
        setSnapshotVersion(meta.snapshotVersion);
        setLastSuccessfulSyncAt(meta.lastSuccessfulSyncAt);
      }
      const pending = await defaultUserActivityQueue.getPendingCount();
      if (mountedRef.current) {
        setPendingActivityCount(pending);
      }
    } catch (err: any) {
      console.warn("[useSnapshotSync] Error reading metadata:", err.message);
    }
  }, []);

  const triggerSync = useCallback(async (force: boolean = false): Promise<SyncExecutionResult> => {
    if (isSyncing) {
      return {
        success: false,
        actionTaken: "skipped_under_24h",
        timeTakenMs: 0,
        error: "Sync already in progress"
      };
    }

    setIsSyncing(true);
    setSyncPhase("checking_manifest");
    setSyncError(null);

    try {
      const result = await defaultSyncScheduler.executeScheduledSync(force);

      if (mountedRef.current) {
        if (result.success) {
          setSyncPhase("ready");
          await refreshLocalState();
        } else {
          setSyncPhase("error");
          setSyncError(result.error || "Sync encountered an error");
        }
      }

      // Also flush pending user activity outbox if online
      if (navigator.onLine) {
        await defaultUserActivityQueue.flushPendingQueue();
        if (mountedRef.current) {
          const count = await defaultUserActivityQueue.getPendingCount();
          setPendingActivityCount(count);
        }
      }

      return result;
    } catch (err: any) {
      if (mountedRef.current) {
        setSyncPhase("error");
        setSyncError(err.message);
      }
      return {
        success: false,
        actionTaken: "skipped_under_24h",
        timeTakenMs: 0,
        error: err.message
      };
    } finally {
      if (mountedRef.current) {
        setIsSyncing(false);
      }
    }
  }, [isSyncing, refreshLocalState]);

  const flushActivityQueue = useCallback(async () => {
    try {
      await defaultUserActivityQueue.flushPendingQueue();
      const count = await defaultUserActivityQueue.getPendingCount();
      if (mountedRef.current) {
        setPendingActivityCount(count);
      }
    } catch (err: any) {
      console.warn("[useSnapshotSync] Activity flush warning:", err.message);
    }
  }, []);

  // Initialization lifecycle
  useEffect(() => {
    mountedRef.current = true;

    async function init() {
      // 1. Run legacy migration from v4 if needed
      try {
        await migrateV4toV5();
      } catch (migErr: any) {
        console.warn("[useSnapshotSync] Migration check warning:", migErr.message);
      }

      // 2. Refresh local state
      await refreshLocalState();

      // 3. Execute 24-hour scheduled sync
      await triggerSync(false);
    }

    init();

    // 4. Set 24-hour sync check timer (every hour check if 24 hours have elapsed)
    const intervalTimer = setInterval(() => {
      triggerSync(false);
    }, 60 * 60 * 1000);

    // 5. Network online listener to retry sync or flush outbox
    const handleOnline = () => {
      console.log("[useSnapshotSync] Device online. Checking sync schedule...");
      triggerSync(false);
    };

    window.addEventListener("online", handleOnline);

    return () => {
      mountedRef.current = false;
      clearInterval(intervalTimer);
      window.removeEventListener("online", handleOnline);
    };
  }, [refreshLocalState, triggerSync]);

  return {
    isSyncing,
    syncPhase,
    snapshotVersion,
    lastSuccessfulSyncAt,
    pendingActivityCount,
    syncError,
    forceSync: () => triggerSync(true),
    flushActivityQueue
  };
}
