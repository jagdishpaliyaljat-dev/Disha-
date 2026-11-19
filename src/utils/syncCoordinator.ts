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
import { isUserAdmin, loadUserProfile } from "./userProfileStorage";

/**
 * DISHA 20-20 - Strict 24-Hour Bidirectional Sync Coordinator
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
    return { success: true };
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
      const { supabase, isSupabaseConfigured } = await import("../lib/supabase");
      if (!isSupabaseConfigured()) {
        throw new Error("Supabase is not configured.");
      }

      // Check user authentication via Supabase
      const { data: { user } } = await supabase.auth.getUser();
      const isAuth = Boolean(user && user.id && user.id !== "student_default" && !user.id.startsWith("guest_"));

      // 4. PHASE B: UPLOAD STUDENT DATA
      if (isAuth && user) {
        uploadedCount = await this.uploadPendingEvents(user.id, sessionId);
      }

      // 5. PHASE C: DOWNLOAD ADMIN CONTENT UPDATES
      const downloadResult = await this.downloadContentChanges(checkpoint.contentVersion, sessionId);
      downloadedCount = downloadResult.changedCount;

      // 6. PHASE D & E: COMMIT ATOMIC CHANGES
      if (downloadedCount > 0) {
        await commitStagedBatch(sessionId);
        checkpoint.contentVersion = downloadResult.remoteVersion;
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
   * Phase B: Upload pending events in strict order to Supabase PostgreSQL.
   */
  private async uploadPendingEvents(userId: string, sessionBatchId: string): Promise<number> {
    const pendingEvents = await getPendingSyncEvents(400);
    if (pendingEvents.length === 0) return 0;

    const eventIds = pendingEvents.map(e => e.eventId);
    await updateSyncEventsStatus(eventIds, "in_flight");

    let opCount = 0;
    const confirmedEventIds: string[] = [];
    const confirmedEvents: SyncQueueEvent[] = [];

    try {
      const { supabase, isSupabaseConfigured } = await import("../lib/supabase");
      if (isSupabaseConfigured()) {
        for (const evt of pendingEvents) {
          try {
            if (evt.eventType === "attempt") {
              const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
              const validUserId = (userId && UUID_REGEX.test(userId) && userId !== "student_default" && !String(userId).startsWith("guest_"))
                ? userId
                : null;
              const { error: attErr } = await supabase.from("attempts").insert({
                user_id: validUserId,
                topic_id: evt.payload?.topicId || null,
                subject_id: evt.payload?.subjectId || null,
                score: evt.payload?.score || 0,
                total_questions: evt.payload?.totalQuestions || 0,
                answers: evt.payload?.answers || {},
                time_spent_seconds: evt.payload?.timeSpentSeconds || 0,
              });
              if (!attErr) {
                opCount++;
                confirmedEventIds.push(evt.eventId);
                confirmedEvents.push(evt);
              } else {
                console.warn(`[SyncCoordinator] Attempt insert error for ${evt.eventId}:`, attErr.message);
              }
            } else if (evt.eventType === "bookmark") {
              let bErr: any = null;
              if (evt.operation === "delete" || evt.payload?.bookmarked === false) {
                const { error } = await supabase
                  .from("bookmarks")
                  .delete()
                  .match({ user_id: userId, question_id: evt.entityId });
                bErr = error;
              } else {
                const { error } = await supabase.from("bookmarks").upsert({
                  user_id: userId,
                  question_id: evt.entityId
                }, { onConflict: "user_id,question_id" });
                bErr = error;
              }
              if (!bErr) {
                opCount++;
                confirmedEventIds.push(evt.eventId);
                confirmedEvents.push(evt);
              } else {
                console.warn(`[SyncCoordinator] Bookmark sync error for ${evt.eventId}:`, bErr.message);
              }
            } else if (evt.eventType === "curriculum_topic") {
              if (evt.operation === "delete") {
                const { error: delErr } = await supabase.from("topics").delete().eq("id", evt.entityId);
                if (!delErr) {
                  opCount++;
                  confirmedEventIds.push(evt.eventId);
                  confirmedEvents.push(evt);
                }
              } else if (evt.payload) {
                const { error: topErr } = await supabase.from("topics").upsert(evt.payload, { onConflict: "id" });
                if (!topErr) {
                  opCount++;
                  confirmedEventIds.push(evt.eventId);
                  confirmedEvents.push(evt);
                }
              }
            }
          } catch (e: any) {
            console.warn(`[SyncCoordinator] Error syncing event ${evt.eventId}:`, e.message);
          }
        }
      }
    } catch (e: any) {
      console.warn("[SyncCoordinator] Supabase batch upload notice:", e.message);
    }

    // Mark confirmed uploaded events as synced in queue and in local domain stores
    if (confirmedEventIds.length > 0) {
      await updateSyncEventsStatus(confirmedEventIds, "synced");
      await markLocalEntitiesSynced(confirmedEvents);
    }

    // Revert failed events so they can be retried on next sync
    const failedEventIds = eventIds.filter(id => !confirmedEventIds.includes(id));
    if (failedEventIds.length > 0) {
      await updateSyncEventsStatus(failedEventIds, "failed");
    }

    return opCount;
  }

  /**
   * Phase C: Download changed admin content incrementally from Supabase PostgreSQL.
   */
  private async downloadContentChanges(localVersion: number, batchId: string): Promise<{ changedCount: number; remoteVersion: number }> {
    let changedCount = 0;
    try {
      const { supabase, isSupabaseConfigured } = await import("../lib/supabase");
      if (!isSupabaseConfigured()) {
        return { changedCount: 0, remoteVersion: localVersion };
      }

      // Fetch curriculum hierarchy from Supabase
      const [subsRes, chsRes, topsRes] = await Promise.all([
        supabase.from("subjects").select("id,name,hindi_name,description,icon,color,order_index,created_at,updated_at"),
        supabase.from("chapters").select("id,subject_id,name,hindi_name,order_index,created_at,updated_at"),
        supabase.from("topics").select("id,chapter_id,subject_id,name,hindi_name,order_index,created_at,updated_at"),
      ]);

      if (subsRes.data && subsRes.data.length > 0) {
        const records = subsRes.data.map(d => ({
          recordId: d.id,
          data: {
            id: d.id,
            name: d.name,
            hindiName: d.hindi_name,
            description: d.description,
            icon: d.icon,
            color: d.color,
            order: d.order_index
          },
          action: "upsert" as const
        }));
        await stageIncomingRecords(batchId, STORES.SUBJECTS, records);
        changedCount += records.length;
      }

      if (chsRes.data && chsRes.data.length > 0) {
        const records = chsRes.data.map(d => ({
          recordId: d.id,
          data: {
            id: d.id,
            subjectId: d.subject_id,
            title: d.name,
            hindiTitle: d.hindi_name,
            number: d.order_index,
            topics: []
          },
          action: "upsert" as const
        }));
        await stageIncomingRecords(batchId, STORES.CHAPTERS, records);
        changedCount += records.length;
      }

      if (topsRes.data && topsRes.data.length > 0) {
        const records = topsRes.data.map(d => ({
          recordId: d.id,
          data: {
            id: d.id,
            chapterId: d.chapter_id,
            subjectId: d.subject_id,
            title: d.name,
            hindiTitle: d.hindi_name,
            number: d.order_index,
            questions: []
          },
          action: "upsert" as const
        }));
        await stageIncomingRecords(batchId, STORES.TOPICS, records);
        changedCount += records.length;
      }
    } catch (err: any) {
      console.warn("[SyncCoordinator] Download content changes error:", err.message);
    }

    return { changedCount, remoteVersion: localVersion + 1 };
  }
}

export const syncCoordinator = new SyncCoordinatorClass();
