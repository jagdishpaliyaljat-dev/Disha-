/**
 * Centralized Snapshot Manager
 * Coordinates Full Snapshots, Chunks Download, Checksum Verification, and Delta Fallback.
 */

import { VersionManifest, VersionManifestChunk, SnapshotMetadataRecord, QuestionMappingRecord } from "./types";
import { ManifestManager, defaultManifestManager } from "./manifestManager";
import { DeltaProcessor, defaultDeltaProcessor } from "./deltaProcessor";
import { verifyChecksum } from "./checksumValidator";
import {
  SNAPSHOT_STORES,
  executeTx,
  getActiveSnapshotMetadata,
  saveActiveSnapshotMetadata,
  recalculateQuestionCounts,
  countRecords
} from "./indexedDbV5";

export interface SnapshotImportProgress {
  phase: "checking" | "downloading_chunks" | "validating_checksums" | "importing" | "committing" | "completed" | "failed";
  chunksTotal: number;
  chunksCompleted: number;
  totalMcqs: number;
  error?: string;
}

export type ProgressCallback = (progress: SnapshotImportProgress) => void;

export class SnapshotManager {
  private manifestManager: ManifestManager;
  private deltaProcessor: DeltaProcessor;
  private isSyncInProgress: boolean = false;

  constructor(
    manifestManager: ManifestManager = defaultManifestManager,
    deltaProcessor: DeltaProcessor = defaultDeltaProcessor
  ) {
    this.manifestManager = manifestManager;
    this.deltaProcessor = deltaProcessor;
  }

  /**
   * Performs an initial or full replacement snapshot download and import.
   * Atomically replaces content stores only after 100% validation passes.
   */
  public async downloadAndApplyFullSnapshot(
    manifest: VersionManifest,
    onProgress?: ProgressCallback
  ): Promise<{ success: boolean; totalMcqs: number; error?: string }> {
    if (this.isSyncInProgress) {
      throw new Error("Another snapshot sync operation is already in progress.");
    }
    this.isSyncInProgress = true;

    const report = (phase: SnapshotImportProgress["phase"], completed: number, err?: string) => {
      if (onProgress) {
        onProgress({
          phase,
          chunksTotal: manifest.chunks.length,
          chunksCompleted: completed,
          totalMcqs: manifest.totalMcqs,
          error: err
        });
      }
    };

    try {
      report("downloading_chunks", 0);

      const downloadedChunksData: any[] = [];

      // 1. Download and validate each chunk
      for (let i = 0; i < manifest.chunks.length; i++) {
        const chunkMeta: VersionManifestChunk = manifest.chunks[i];
        
        let chunkRawText: string;
        try {
          const resp = await fetch(chunkMeta.url);
          if (!resp.ok) {
            throw new Error(`Failed to download chunk ${chunkMeta.chunkIndex}: HTTP ${resp.status}`);
          }
          chunkRawText = await resp.text();
        } catch (fetchErr: any) {
          throw new Error(`Network failure downloading chunk ${chunkMeta.chunkIndex}: ${fetchErr.message}`);
        }

        // Verify SHA-256 Checksum
        report("validating_checksums", i);
        const isChecksumValid = await verifyChecksum(chunkRawText, chunkMeta.checksum);
        if (!isChecksumValid) {
          throw new Error(
            `Data corruption detected in chunk ${chunkMeta.chunkIndex}! Checksum does not match manifest.`
          );
        }

        const chunkJson = JSON.parse(chunkRawText);
        downloadedChunksData.push(chunkJson);
        report("downloading_chunks", i + 1);
      }

      // 2. Validate relationships, hierarchy, and uniqueness across all chunks
      report("validating_checksums", manifest.chunks.length);
      const allSubjects: any[] = [];
      const allChapters: any[] = [];
      const allTopics: any[] = [];
      const allMcqs: any[] = [];
      const mcqIdSet = new Set<string>();

      for (const chunk of downloadedChunksData) {
        if (chunk.subjects) allSubjects.push(...chunk.subjects);
        if (chunk.chapters) allChapters.push(...chunk.chapters);
        if (chunk.topics) allTopics.push(...chunk.topics);
        if (chunk.mcqs) {
          for (const mcq of chunk.mcqs) {
            if (mcqIdSet.has(mcq.id)) {
              throw new Error(`Duplicate MCQ ID '${mcq.id}' detected in snapshot payload!`);
            }
            mcqIdSet.add(mcq.id);
            allMcqs.push(mcq);
          }
        }
      }

      // Validate relational integrity
      const subjectIdSet = new Set(allSubjects.map(s => s.id));
      const chapterIdSet = new Set(allChapters.map(c => c.id));
      const topicIdSet = new Set(allTopics.map(t => t.id));

      for (const ch of allChapters) {
        if (ch.subjectId && !subjectIdSet.has(ch.subjectId)) {
          console.warn(`[SnapshotManager] Orphaned chapter '${ch.id}' points to unknown subject '${ch.subjectId}'`);
        }
      }

      for (const tp of allTopics) {
        if (tp.chapterId && !chapterIdSet.has(tp.chapterId)) {
          console.warn(`[SnapshotManager] Orphaned topic '${tp.id}' points to unknown chapter '${tp.chapterId}'`);
        }
      }

      for (const mcq of allMcqs) {
        if (!mcq.id || !mcq.topicId) {
          throw new Error(`MCQ record missing required id or topicId: ${JSON.stringify(mcq)}`);
        }
      }

      // 3. Atomically commit into IndexedDB
      report("importing", manifest.chunks.length);
      const storesToLock = [
        SNAPSHOT_STORES.SUBJECTS,
        SNAPSHOT_STORES.CHAPTERS,
        SNAPSHOT_STORES.TOPICS,
        SNAPSHOT_STORES.MCQS,
        SNAPSHOT_STORES.QUESTION_MAPPINGS,
        SNAPSHOT_STORES.SNAPSHOT_METADATA
      ];

      await executeTx(storesToLock, "readwrite", async (stores) => {
        // Clear existing content stores
        stores[SNAPSHOT_STORES.SUBJECTS].clear();
        stores[SNAPSHOT_STORES.CHAPTERS].clear();
        stores[SNAPSHOT_STORES.TOPICS].clear();
        stores[SNAPSHOT_STORES.MCQS].clear();
        stores[SNAPSHOT_STORES.QUESTION_MAPPINGS].clear();

        const now = Date.now();

        // Put subjects
        for (const s of allSubjects) {
          stores[SNAPSHOT_STORES.SUBJECTS].put(s);
        }

        // Put chapters
        for (const c of allChapters) {
          stores[SNAPSHOT_STORES.CHAPTERS].put(c);
        }

        // Put topics
        for (const t of allTopics) {
          stores[SNAPSHOT_STORES.TOPICS].put(t);
        }

        // Put MCQs and mappings
        for (const m of allMcqs) {
          stores[SNAPSHOT_STORES.MCQS].put(m);
          const mapping: QuestionMappingRecord = {
            questionId: m.id,
            topicId: m.topicId,
            chapterId: m.chapterId || "",
            subjectId: m.subjectId || "",
            updatedAt: now,
            version: manifest.snapshotVersion
          };
          stores[SNAPSHOT_STORES.QUESTION_MAPPINGS].put(mapping);
        }

        // Save metadata
        const metadata: SnapshotMetadataRecord = {
          id: "current_active_snapshot",
          snapshotVersion: manifest.snapshotVersion,
          schemaVersion: manifest.schemaVersion,
          curriculumVersion: manifest.curriculumVersion,
          mcqVersion: manifest.mcqVersion,
          installedAt: now,
          lastCheckedAt: now,
          lastSuccessfulSyncAt: now,
          checksum: manifest.checksum,
          status: "healthy",
          totalMcqs: allMcqs.length,
          isInitialSnapshotLoaded: true
        };
        stores[SNAPSHOT_STORES.SNAPSHOT_METADATA].put(metadata);
      });

      // 4. Recalculate all hierarchy counts
      report("committing", manifest.chunks.length);
      await recalculateQuestionCounts();

      report("completed", manifest.chunks.length);
      return { success: true, totalMcqs: allMcqs.length };
    } catch (err: any) {
      report("failed", 0, err.message);
      return { success: false, totalMcqs: 0, error: err.message };
    } finally {
      this.isSyncInProgress = false;
    }
  }

  /**
   * Applies an incremental delta or falls back to full snapshot if delta fails.
   */
  public async applyIncrementalDeltaOrFallback(
    manifest: VersionManifest,
    localVersion: number,
    onProgress?: ProgressCallback
  ): Promise<{ success: boolean; usedFallback: boolean; error?: string }> {
    const deltaUrl = `/api/deltas/v${localVersion}-to-v${manifest.snapshotVersion}.json`;

    try {
      const resp = await fetch(deltaUrl);
      if (!resp.ok) {
        throw new Error(`Delta not available: HTTP ${resp.status}`);
      }

      const deltaJson = await resp.json();
      const result = await this.deltaProcessor.applyDelta(deltaJson);

      if (!result.success) {
        throw new Error(result.error || "Delta application returned failure");
      }

      return { success: true, usedFallback: false };
    } catch (deltaErr: any) {
      console.warn(`[SnapshotManager] Delta application failed (${deltaErr.message}). Initiating full snapshot fallback...`);
      const fallbackResult = await this.downloadAndApplyFullSnapshot(manifest, onProgress);
      return {
        success: fallbackResult.success,
        usedFallback: true,
        error: fallbackResult.error
      };
    }
  }

  /**
   * Checks whether the local database has an active, healthy snapshot.
   */
  public async isSnapshotHealthy(): Promise<boolean> {
    const meta = await getActiveSnapshotMetadata();
    if (!meta || !meta.isInitialSnapshotLoaded || meta.status !== "healthy") {
      return false;
    }
    const mcqCount = await countRecords(SNAPSHOT_STORES.MCQS);
    return mcqCount > 0 && mcqCount === meta.totalMcqs;
  }
}

export const defaultSnapshotManager = new SnapshotManager();
