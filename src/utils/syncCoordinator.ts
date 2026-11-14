import { doc, collection, query, where, limit } from "firebase/firestore";
import { db, auth, isFirebaseConfigured } from "../lib/firebase";
import { 
  guardedWriteBatch, 
  guardedGetDoc, 
  guardedGetDocs, 
  isQuotaExhausted 
} from "./quotaTracker";
import { 
  loadSyncCheckpoint, 
  saveSyncCheckpoint, 
  isSyncEligible, 
  acquireSyncLock, 
  releaseSyncLock, 
  SyncCheckpointMetadata 
} from "./syncCheckpointRegistry";
import { 
  getPendingSyncEvents, 
  updateSyncEventsStatus, 
  stageIncomingRecords, 
  commitStagedBatch, 
  discardStagedBatch, 
  STORES, 
  SyncQueueEvent,
  checkLocalDatabaseIntegrity,
  countLocalMCQs,
  markLocalEntitiesSynced
} from "./localDatabaseEngine";
import { executeInitialBootstrap } from "./bootstrapService";
import { isUserAdmin, loadUserProfile } from "./userProfileStorage";
import { recordLocalCurriculumVersion } from "./appVersionService";

/**
 * QuizPro - Strict 24-Hour Bidirectional Sync Coordinator
 * 
 * Rules enforced:
 * 1. Exactly one coordinated sync cycle allowed per 24 hours.
 * 2. Primary 24-hour gate uses `lastAttemptedSyncAt`. Failed attempts consume that 24h window.
 * 3. Cross-tab persistent locking.
 * 4. Bidirectional atomic session: Phase B (Upload) -> Phase C (Download) -> Phase D (Verify) -> Phase E (Commit).
 * 5. Idempotent uploads (deterministic paths and batch idempotency keys).
 * 6. Zero routine Firestore reads/writes during normal student activities.
 */

export interface SyncSessionStatus {
  state: 
    | "initial_download_required" 
    | "initial_downloading" 
    | "offline_ready" 
    | "local_first_mode" 
    | "sync_scheduled" 
    | "sync_in_progress" 
    | "sync_completed" 
    | "sync_failed" 
    | "recovery_required";
  lastSuccessfulSyncAt: number | null;
  lastAttemptedSyncAt: number | null;
  nextSyncEligibleAt: number | null;
  localContentVersion: number;
  remoteContentVersion: number | null;
  pendingEventCount: number;
  totalLocalMCQs: number;
  lastErrorMessage: string | null;
  isEligibleNow: boolean;
  eligibleRemainingTimeMs: number;
}

export type SyncStatusListener = (status: SyncSessionStatus) => void;

class SyncCoordinatorClass {
  private activeOwnerId: string = `tab_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  private listeners: Set<SyncStatusListener> = new Set();
  private isExecuting = false;

  constructor() {
    if (typeof window !== "undefined") {
      // Periodic local status refresh without network calls
      window.addEventListener("online", () => this.notifyListeners());
      window.addEventListener("focus", () => this.notifyListeners());
    }
  }

  public subscribe(listener: SyncStatusListener): () => void {
    this.listeners.add(listener);
    this.getSyncStatus().then(s => listener(s));
    return () => {
      this.listeners.delete(listener);
    };
  }

  private async notifyListeners(): Promise<void> {
    const s = await this.getSyncStatus();
    this.listeners.forEach(fn => {
      try { fn(s); } catch {}
    });
  }

  /**
   * Initializes sync metadata and verifies local database readiness on app startup.
   */
  public async initializeSync(): Promise<SyncSessionStatus> {
    const checkpoint = await loadSyncCheckpoint();
    const totalMCQs = await countLocalMCQs();

    // Check if initial bootstrap is required OR if question bank is incomplete (< 500 MCQs)
    if ((!checkpoint.bootstrapCompleted || totalMCQs < 500) && isFirebaseConfigured()) {
      if (typeof navigator !== "undefined" && navigator.onLine) {
        // Trigger initial bootstrap or recovery automatically on startup to restore missing questions
        await this.startBootstrapSession();
      }
    }

    return this.getSyncStatus();
  }

  /**
   * Returns complete diagnostic sync status for UI and scheduling guards.
   */
  public async getSyncStatus(): Promise<SyncSessionStatus> {
    const checkpoint = await loadSyncCheckpoint();
    const totalLocalMCQs = await countLocalMCQs();
    const eligibility = isSyncEligible(checkpoint, Date.now(), totalLocalMCQs);

    let state: SyncSessionStatus["state"] = "local_first_mode";

    if (!checkpoint.bootstrapCompleted || totalLocalMCQs < 500) {
      state = "initial_download_required";
    } else if (checkpoint.syncStatus === "syncing" || this.isExecuting) {
      state = "sync_in_progress";
    } else if (checkpoint.syncStatus === "error") {
      state = "sync_failed";
    } else if (eligibility.eligible && checkpoint.pendingEventCount > 0) {
      state = "sync_scheduled";
    } else {
      state = "offline_ready";
    }

    return {
      state,
      lastSuccessfulSyncAt: checkpoint.lastSuccessfulSyncAt,
      lastAttemptedSyncAt: checkpoint.lastAttemptedSyncAt,
      nextSyncEligibleAt: checkpoint.nextSyncEligibleAt,
      localContentVersion: checkpoint.contentVersion,
      remoteContentVersion: null,
      pendingEventCount: checkpoint.pendingEventCount,
      totalLocalMCQs,
      lastErrorMessage: checkpoint.lastSyncError,
      isEligibleNow: eligibility.eligible,
      eligibleRemainingTimeMs: eligibility.remainingTimeMs,
    };
  }

  /**
   * Starts Initial Bootstrap session if needed.
   */
  public async startBootstrapSession(): Promise<{ success: boolean; error?: string }> {
    if (this.isExecuting) return { success: false, error: "Sync already in progress." };
    this.isExecuting = true;
    await this.notifyListeners();

    try {
      const res = await executeInitialBootstrap();
      return res;
    } finally {
      this.isExecuting = false;
      await this.notifyListeners();
    }
  }

  /**
   * Primary entry point for a regular synchronization cycle.
   * STRICT 24-HOUR ENFORCED: Rejects immediately if not eligible.
   */
  public async startSyncSession(): Promise<{
    success: boolean;
    uploadedEvents: number;
    downloadedChanges: number;
    error?: string;
  }> {
    if (this.isExecuting) {
      return { success: false, uploadedEvents: 0, downloadedChanges: 0, error: "Sync already executing." };
    }

    const checkpoint = await loadSyncCheckpoint();

    // 1. PHASE A: PRE-SYNC VALIDATION
    if (!checkpoint.bootstrapCompleted) {
      const bootRes = await this.startBootstrapSession();
      return { 
        success: bootRes.success, 
        uploadedEvents: 0, 
        downloadedChanges: 0, 
        error: bootRes.error 
      };
    }

    // 2. Strict 24-hour eligibility gate (Admin always bypasses)
    const isAdmin = isUserAdmin(loadUserProfile());
    const totalLocalMCQs = await countLocalMCQs();
    const eligibility = isSyncEligible(checkpoint, Date.now(), totalLocalMCQs);
    if (!isAdmin && !eligibility.eligible) {
      console.log(`[SyncCoordinator] Sync rejected by 24-hour gate: ${eligibility.reason}`);
      return {
        success: false,
        uploadedEvents: 0,
        downloadedChanges: 0,
        error: `Sync not eligible: ${eligibility.reason}`,
      };
    }

    // 3. Acquire persistent cross-tab lock
    const lockAcquired = await acquireSyncLock(this.activeOwnerId, 90000); // 90s TTL
    if (!lockAcquired) {
      return {
        success: false,
        uploadedEvents: 0,
        downloadedChanges: 0,
        error: "Sync lock is held by another browser tab.",
      };
    }

    this.isExecuting = true;
    const now = Date.now();
    checkpoint.lastAttemptedSyncAt = now;
    checkpoint.syncStatus = "syncing";
    await saveSyncCheckpoint(checkpoint);
    await this.notifyListeners();

    const sessionId = `sync_${now}_${Math.random().toString(36).substring(2, 7)}`;
    let uploadedCount = 0;
    let downloadedCount = 0;

    try {
      if (!isFirebaseConfigured() || isQuotaExhausted()) {
        throw new Error(isQuotaExhausted() ? "Daily Firebase quota exhausted." : "Firebase not configured.");
      }

      // Check user authentication
      const user = auth.currentUser;
      const isAuth = user && !user.isAnonymous;

      // 4. PHASE B: UPLOAD STUDENT DATA
      if (isAuth) {
        uploadedCount = await this.uploadPendingEvents(user.uid, sessionId);
      }

      // 5. PHASE C: DOWNLOAD ADMIN CONTENT UPDATES
      const downloadResult = await this.downloadContentChanges(checkpoint.contentVersion, sessionId);
      downloadedCount = downloadResult.changedCount;

      // 6. PHASE D & E: COMMIT ATOMIC CHANGES
      if (downloadedCount > 0) {
        await commitStagedBatch(sessionId);
        checkpoint.contentVersion = downloadResult.remoteVersion;
        await recordLocalCurriculumVersion({
          curriculumVersion: downloadResult.remoteVersion,
          lastUpdated: new Date().toISOString(),
          bundleVersions: {},
        }).catch(() => {});
      }

      // 7. PHASE F: SYNC COMPLETION
      checkpoint.lastSuccessfulSyncAt = Date.now();
      checkpoint.nextSyncEligibleAt = Date.now() + (24 * 60 * 60 * 1000);
      checkpoint.syncStatus = "idle";
      checkpoint.lastSyncError = null;
      await saveSyncCheckpoint(checkpoint);
      await releaseSyncLock(this.activeOwnerId, true);

      console.log(`[SyncCoordinator] 24h sync completed successfully: ${uploadedCount} events uploaded, ${downloadedCount} changes applied.`);
      return { success: true, uploadedEvents: uploadedCount, downloadedChanges: downloadedCount };
    } catch (err: any) {
      const errMsg = err?.message || "Sync session failed.";
      console.warn("[SyncCoordinator] Sync session error:", errMsg);
      
      // Preserve staging data and release lock
      await discardStagedBatch(sessionId).catch(() => {});
      checkpoint.syncStatus = "error";
      checkpoint.lastSyncError = errMsg;
      await saveSyncCheckpoint(checkpoint);
      await releaseSyncLock(this.activeOwnerId, false, errMsg);

      return { success: false, uploadedEvents: uploadedCount, downloadedChanges: 0, error: errMsg };
    } finally {
      this.isExecuting = false;
      await this.notifyListeners();
    }
  }

  /**
   * Phase B: Upload pending events in strict order with <= 400 chunked WriteBatches.
   */
  private async uploadPendingEvents(userId: string, sessionBatchId: string): Promise<number> {
    const pendingEvents = await getPendingSyncEvents(400);
    if (pendingEvents.length === 0) return 0;

    const eventIds = pendingEvents.map(e => e.eventId);
    await updateSyncEventsStatus(eventIds, "in_flight");

    const batch = guardedWriteBatch(db);
    let opCount = 0;

    for (const evt of pendingEvents) {
      const pathSegments = this.resolveFirestorePath(userId, evt);
      if (!pathSegments) continue;

      const docRef = doc(db, pathSegments[0], ...pathSegments.slice(1));
      if (evt.eventType === "attempt") {
        // Firestore rules enforce create-only semantics for student attempts:
        // allow create: if incoming().get('userId', '') == request.auth.uid; allow update, delete: if isAdmin();
        // Pure set without merge: true avoids update interpretation
        batch.set(docRef, { ...evt.payload, lastSyncedAt: Date.now() });
      } else if (evt.operation === "delete") {
        batch.delete(docRef);
      } else {
        batch.set(docRef, { ...evt.payload, lastSyncedAt: Date.now() }, { merge: true });
      }
      opCount++;
    }

    if (opCount > 0) {
      await batch.commit(
        "Student",
        "24h Coordinated Progress Upload",
        `Batch ${sessionBatchId}`,
        30000,
        `upload_${sessionBatchId}`
      );
    }

    // Mark confirmed uploaded events as synced in queue and in local domain stores
    await updateSyncEventsStatus(eventIds, "synced");
    await markLocalEntitiesSynced(pendingEvents);
    return opCount;
  }

  private resolveFirestorePath(userId: string, evt: SyncQueueEvent): string[] | null {
    switch (evt.eventType) {
      case "attempt":
        return ["attempts", evt.entityId];
      case "bookmark":
        return ["users", userId, "bookmarks", evt.entityId];
      case "wrong_question":
        return ["users", userId, "wrong_questions", evt.entityId];
      case "test_result":
        return ["users", userId, "test_results", evt.entityId];
      case "revision":
        return ["users", userId, "revision_history", evt.entityId];
      case "study_log":
        return ["users", userId, "study_logs", evt.entityId];
      case "syllabus_progress":
        return ["users", userId, "syllabus_progress", evt.entityId];
      case "settings":
        return ["users", userId];
      default:
        return null;
    }
  }

  /**
   * Phase C: Download changed admin content incrementally (hierarchy, MCQs, tombstones).
   */
  private async downloadContentChanges(localVersion: number, batchId: string): Promise<{ changedCount: number; remoteVersion: number }> {
    const versionSnap = await guardedGetDoc(
      doc(db, "metadata", "app_version"), 
      "Student", 
      "24h Check Curriculum Version", 
      undefined, 
      15000
    ).catch(() => null);

    if (!versionSnap || !versionSnap.exists()) return { changedCount: 0, remoteVersion: localVersion };
    const remoteData = versionSnap.data() as any;
    const remoteVersion = Number(remoteData?.curriculumVersion || 1);

    if (remoteVersion <= localVersion) {
      // Content already up to date - 0 extra collection reads
      return { changedCount: 0, remoteVersion: localVersion };
    }

    let changedCount = 0;

    // 1. Fetch updated curriculum hierarchy (subjects, chapters, topics)
    const [subsSnap, chsSnap, topsSnap] = await Promise.all([
      guardedGetDocs(collection(db, "subjects"), "Student", "24h Download Subjects", undefined, 30000).catch(() => null),
      guardedGetDocs(collection(db, "chapters"), "Student", "24h Download Chapters", undefined, 30000).catch(() => null),
      guardedGetDocs(collection(db, "topics"), "Student", "24h Download Topics", undefined, 30000).catch(() => null),
    ]);

    if (subsSnap && !subsSnap.empty) {
      const records = subsSnap.docs.map(d => ({ recordId: d.id, data: { ...d.data(), id: d.id }, action: "upsert" as const }));
      await stageIncomingRecords(batchId, STORES.SUBJECTS, records);
      changedCount += records.length;
    }
    if (chsSnap && !chsSnap.empty) {
      const records = chsSnap.docs.map(d => ({ recordId: d.id, data: { ...d.data(), id: d.id }, action: "upsert" as const }));
      await stageIncomingRecords(batchId, STORES.CHAPTERS, records);
      changedCount += records.length;
    }
    if (topsSnap && !topsSnap.empty) {
      const records = topsSnap.docs.map(d => ({ recordId: d.id, data: { ...d.data(), id: d.id }, action: "upsert" as const }));
      await stageIncomingRecords(batchId, STORES.TOPICS, records);
      changedCount += records.length;
    }

    // 2. Fetch incremental Question updates & tombstones
    try {
      const changelogRef = collection(db, "content_changelog");
      const qChangelog = query(changelogRef, where("version", ">", localVersion));
      const changelogSnap = await guardedGetDocs(qChangelog, "Student", "24h Download Changelog", undefined, 30000).catch(() => null);

      if (changelogSnap && !changelogSnap.empty) {
        const mcqUpdates: Array<{ recordId: string; data: any; action: "upsert" | "delete" }> = [];
        for (const chDoc of changelogSnap.docs) {
          const item = chDoc.data() as any;
          const entityType = item.entityType || item.collection || "mcqs";
          if (entityType === "mcqs" || entityType === "questions") {
            const isDelete = item.action === "delete" || item.op === "delete" || item.isDeleted === true;
            mcqUpdates.push({
              recordId: item.entityId || item.docId || chDoc.id,
              data: isDelete ? null : (item.data || { ...item, id: item.entityId || chDoc.id }),
              action: isDelete ? "delete" : "upsert",
            });
          }
        }
        if (mcqUpdates.length > 0) {
          await stageIncomingRecords(batchId, STORES.MCQS, mcqUpdates);
          changedCount += mcqUpdates.length;
        }
      } else {
        const mcqsRef = collection(db, "mcqs");
        const qMcqs = query(mcqsRef, where("version", ">", localVersion));
        const mcqSnap = await guardedGetDocs(qMcqs, "Student", "24h Incremental MCQs", undefined, 30000).catch(() => null);

        if (mcqSnap && !mcqSnap.empty) {
          const mcqRecords = mcqSnap.docs.map(d => {
            const data = d.data() as any;
            const isDelete = data.deleted === true || data.isDeleted === true;
            return {
              recordId: d.id,
              data: isDelete ? null : { ...data, id: d.id },
              action: (isDelete ? "delete" : "upsert") as "upsert" | "delete",
            };
          });
          await stageIncomingRecords(batchId, STORES.MCQS, mcqRecords);
          changedCount += mcqRecords.length;
        }
      }
    } catch (mcqErr) {
      console.warn("[SyncCoordinator] Incremental MCQ sync lookup notice:", mcqErr);
    }

    return { changedCount, remoteVersion };
  }
}

export const syncCoordinator = new SyncCoordinatorClass();
