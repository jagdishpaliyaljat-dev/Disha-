import React, { useState, useEffect } from "react";
import { ProgressStore, UserQuestionsStore } from "../types";

export const LAST_LOCAL_MODIFIED_KEY = "economic_survey_last_modified_timestamp";
export const LAST_CLOUD_SYNC_KEY = "economic_survey_last_cloud_sync_timestamp";
export const SYNC_STATUS_EVENT = "economic_survey_sync_status_change";

export interface SyncStatusInfo {
  isOnline: boolean;
  hasUnsyncedChanges: boolean;
  unsyncedCount: number;
  lastSyncedAt: number | null;
  lastModifiedAt: number | null;
}

/**
 * Record that a local modification (answer, question edit, etc.) occurred.
 */
export function recordLocalChange(): void {
  try {
    const now = Date.now();
    localStorage.setItem(LAST_LOCAL_MODIFIED_KEY, String(now));
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event(SYNC_STATUS_EVENT));
    }
  } catch (e) {
    console.error("Failed to record local change", e);
  }
}

/**
 * Record that a cloud sync was completed.
 */
export function recordCloudSyncSuccess(): void {
  try {
    const now = Date.now();
    localStorage.setItem(LAST_CLOUD_SYNC_KEY, String(now));
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event(SYNC_STATUS_EVENT));
    }
  } catch (e) {
    console.error("Failed to record cloud sync", e);
  }
}

/**
 * Calculate current sync & online state.
 */
export function calculateSyncStatus(): SyncStatusInfo {
  const isOnline = typeof navigator !== "undefined" ? navigator.onLine : true;

  let lastModifiedAt: number | null = null;
  let lastSyncedAt: number | null = null;

  try {
    const rawMod = localStorage.getItem(LAST_LOCAL_MODIFIED_KEY);
    if (rawMod) lastModifiedAt = Number(rawMod);

    const rawSync = localStorage.getItem(LAST_CLOUD_SYNC_KEY);
    if (rawSync) lastSyncedAt = Number(rawSync);
  } catch (e) {
    console.error("Error reading sync timestamps", e);
  }

  // Count local items: questions attempted and custom additions
  let localProgressCount = 0;
  let customItemsCount = 0;

  try {
    const rawProg = localStorage.getItem("economic_survey_progress_v2");
    if (rawProg) {
      const parsed: ProgressStore = JSON.parse(rawProg);
      localProgressCount = Object.keys(parsed).filter(
        (id) => parsed[id]?.status !== "unattempted"
      ).length;
    }

    const rawQuestions = localStorage.getItem("economic_survey_user_questions_v2");
    if (rawQuestions) {
      const parsed: UserQuestionsStore = JSON.parse(rawQuestions);
      customItemsCount =
        (parsed.customQuestions?.length || 0) +
        (parsed.customChapters?.length || 0) +
        (parsed.customTopics?.length || 0);
    }
  } catch (e) {
    console.error("Error estimating unsynced count", e);
  }

  // Also check persistent student write buffer & outbox for pending offline/unflushed writes
  let pendingBufferOps = 0;
  try {
    const rawBuf = localStorage.getItem("disha2020_student_buffer_v1") || localStorage.getItem("quizpro_student_buffer_v1");
    if (rawBuf) {
      const parsedBuf = JSON.parse(rawBuf);
      pendingBufferOps +=
        Object.keys(parsedBuf?.pendingProgress || {}).length +
        Object.keys(parsedBuf?.pendingHistory || {}).length +
        (Array.isArray(parsedBuf?.pendingAttempts) ? parsedBuf.pendingAttempts.length : 0);
    }
    const rawOutbox = localStorage.getItem("disha2020_student_outbox_v1") || localStorage.getItem("quizpro_student_outbox_v1");
    if (rawOutbox) {
      const parsedOutbox = JSON.parse(rawOutbox);
      if (Array.isArray(parsedOutbox)) {
        pendingBufferOps += parsedOutbox.filter((item: any) => item && item.status !== "committed").length;
      }
    }
  } catch (e) {
    console.error("Error reading student write buffer status", e);
  }

  const unsyncedCount = pendingBufferOps > 0 ? pendingBufferOps : localProgressCount + customItemsCount;

  // Has unsynced changes if buffered ops exist, or modified after last sync, or local data never synced
  const hasUnsyncedChanges =
    pendingBufferOps > 0 ||
    (unsyncedCount > 0 &&
      (!lastSyncedAt || (lastModifiedAt !== null && lastModifiedAt > lastSyncedAt)));

  return {
    isOnline,
    hasUnsyncedChanges,
    unsyncedCount,
    lastSyncedAt,
    lastModifiedAt,
  };
}

/**
 * React hook for live network and sync status.
 */
export function useSyncStatus(): SyncStatusInfo & {
  triggerSync: () => Promise<void>;
  isSyncing: boolean;
} {
  const [status, setStatus] = useState<SyncStatusInfo>(() => calculateSyncStatus());
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  useEffect(() => {
    const update = () => {
      setStatus(calculateSyncStatus());
    };

    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    window.addEventListener(SYNC_STATUS_EVENT, update);

    // Initial check
    update();

    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
      window.removeEventListener(SYNC_STATUS_EVENT, update);
    };
  }, []);

  const triggerSync = async () => {
    if (!status.isOnline) return;
    setIsSyncing(true);
    try {
      const { syncCoordinator } = await import("./syncCoordinator");
      const res = await syncCoordinator.startSyncSession();
      if (res.success) {
        recordCloudSyncSuccess();
      }
      setStatus(calculateSyncStatus());
    } finally {
      setIsSyncing(false);
    }
  };

  return {
    ...status,
    triggerSync,
    isSyncing,
  };
}
