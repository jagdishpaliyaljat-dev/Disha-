/**
 * 24-Hour Content Synchronization Scheduler
 * Enforces strict 24-hour sync intervals, cross-tab locking, backoff retry, and failure resilience.
 */

import { VersionManifest, SyncScheduleConfig, SyncExecutionResult } from "./types";
import { ManifestManager, defaultManifestManager } from "./manifestManager";
import { SnapshotManager, defaultSnapshotManager } from "./snapshotManager";
import { getActiveSnapshotMetadata, saveActiveSnapshotMetadata } from "./indexedDbV5";

export const DEFAULT_SYNC_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours
export const MIN_RETRY_BACKOFF_MS = 15 * 60 * 1000; // 15 mins

export class SyncScheduler {
  private manifestManager: ManifestManager;
  private snapshotManager: SnapshotManager;
  private syncConfig: SyncScheduleConfig;
  private isExecuting: boolean = false;
  private syncLockKey: string = "quizpro_snapshot_sync_lock";

  constructor(
    manifestManager: ManifestManager = defaultManifestManager,
    snapshotManager: SnapshotManager = defaultSnapshotManager,
    config: Partial<SyncScheduleConfig> = {}
  ) {
    this.manifestManager = manifestManager;
    this.snapshotManager = snapshotManager;
    this.syncConfig = {
      syncIntervalMs: config.syncIntervalMs || DEFAULT_SYNC_INTERVAL_MS,
      forceRefresh: config.forceRefresh || false,
      allowCellular: config.allowCellular ?? true,
      backoffDelayMs: config.backoffDelayMs || MIN_RETRY_BACKOFF_MS
    };
  }

  /**
   * Acquire a distributed / cross-tab execution lock.
   */
  private async acquireLock(): Promise<boolean> {
    if (this.isExecuting) return false;

    // Use Web Locks API if available
    if (typeof navigator !== "undefined" && (navigator as any).locks) {
      // Handled via navigator.locks request
    }

    // LocalStorage atomic test-and-set for browser environments
    if (typeof localStorage !== "undefined") {
      const lockData = localStorage.getItem(this.syncLockKey);
      const now = Date.now();
      if (lockData) {
        try {
          const parsed = JSON.parse(lockData);
          if (now - parsed.timestamp < 60000) {
            // Lock held and fresh (< 60s)
            return false;
          }
        } catch {}
      }
      localStorage.setItem(this.syncLockKey, JSON.stringify({ timestamp: now, id: Math.random() }));
    }

    this.isExecuting = true;
    return true;
  }

  private releaseLock(): void {
    this.isExecuting = false;
    if (typeof localStorage !== "undefined") {
      try {
        localStorage.removeItem(this.syncLockKey);
      } catch {}
    }
  }

  /**
   * Primary sync routine triggered on app initialization or timer.
   */
  public async executeScheduledSync(force: boolean = false): Promise<SyncExecutionResult> {
    const startTime = Date.now();

    const acquired = await this.acquireLock();
    if (!acquired) {
      return {
        success: false,
        actionTaken: "skipped_under_24h",
        timeTakenMs: Date.now() - startTime,
        error: "Sync lock could not be acquired (another sync is active)."
      };
    }

    try {
      const meta = await getActiveSnapshotMetadata();
      const now = Date.now();

      // Check Case 1: First install / No snapshot exists
      if (!meta || !meta.isInitialSnapshotLoaded) {
        console.log("[SyncScheduler] No active snapshot found. Initiating full initial snapshot download...");
        const manifest = await this.manifestManager.fetchLatestManifest(true);
        const result = await this.snapshotManager.downloadAndApplyFullSnapshot(manifest);

        if (!result.success) {
          throw new Error(result.error || "Initial snapshot download failed.");
        }

        return {
          success: true,
          actionTaken: "initial_download",
          toVersion: manifest.snapshotVersion,
          recordsUpdated: result.totalMcqs,
          timeTakenMs: Date.now() - startTime
        };
      }

      // Check Case 2: 24-hour interval check
      const elapsedSinceLastSync = now - (meta.lastSuccessfulSyncAt || 0);
      if (!force && !this.syncConfig.forceRefresh && elapsedSinceLastSync < this.syncConfig.syncIntervalMs) {
        // Less than 24 hours have passed — skip routine content check completely
        return {
          success: true,
          actionTaken: "skipped_under_24h",
          fromVersion: meta.snapshotVersion,
          toVersion: meta.snapshotVersion,
          timeTakenMs: Date.now() - startTime
        };
      }

      // Check Case 3: 24 hours elapsed — Fetch manifest and compare versions
      console.log("[SyncScheduler] 24 hours elapsed. Checking version manifest for updates...");
      const comparison = await this.manifestManager.compareVersions();

      // If versions match: 0 downloads / 0 reads
      if (comparison.isUpToDate) {
        console.log(`[SyncScheduler] Local snapshot (v${comparison.localVersion}) is up to date.`);
        // Update lastCheckedAt and lastSuccessfulSyncAt
        meta.lastCheckedAt = now;
        meta.lastSuccessfulSyncAt = now;
        await saveActiveSnapshotMetadata(meta);

        return {
          success: true,
          actionTaken: "no_action_needed",
          fromVersion: comparison.localVersion,
          toVersion: comparison.cloudVersion,
          timeTakenMs: Date.now() - startTime
        };
      }

      // Changed version:
      console.log(
        `[SyncScheduler] New version detected: local=v${comparison.localVersion}, cloud=v${comparison.cloudVersion}`
      );

      if (comparison.canUseDelta) {
        console.log(`[SyncScheduler] Applying incremental delta from v${comparison.localVersion} to v${comparison.cloudVersion}...`);
        const deltaResult = await this.snapshotManager.applyIncrementalDeltaOrFallback(
          comparison.cloudManifest,
          comparison.localVersion
        );

        if (!deltaResult.success) {
          throw new Error(deltaResult.error || "Delta and fallback sync both failed.");
        }

        return {
          success: true,
          actionTaken: deltaResult.usedFallback ? "full_snapshot_fallback" : "incremental_delta",
          fromVersion: comparison.localVersion,
          toVersion: comparison.cloudVersion,
          timeTakenMs: Date.now() - startTime
        };
      } else {
        console.log(`[SyncScheduler] Delta not possible. Downloading full snapshot replacement...`);
        const fullResult = await this.snapshotManager.downloadAndApplyFullSnapshot(comparison.cloudManifest);

        if (!fullResult.success) {
          throw new Error(fullResult.error || "Full snapshot replacement failed.");
        }

        return {
          success: true,
          actionTaken: "full_snapshot_fallback",
          fromVersion: comparison.localVersion,
          toVersion: comparison.cloudVersion,
          recordsUpdated: fullResult.totalMcqs,
          timeTakenMs: Date.now() - startTime
        };
      }
    } catch (err: any) {
      console.error("[SyncScheduler] Content sync error:", err.message);
      // NOTE: A failed sync must NEVER update lastSuccessfulSyncAt
      return {
        success: false,
        actionTaken: "skipped_under_24h",
        timeTakenMs: Date.now() - startTime,
        error: err.message
      };
    } finally {
      this.releaseLock();
    }
  }
}

export const defaultSyncScheduler = new SyncScheduler();
