/**
 * Delta Bundle Processor
 * Applies incremental updates, tombstones, and question moves atomically.
 */

import { DeltaBundle, SnapshotMetadataRecord, TombstoneRecord, QuestionMappingRecord } from "./types";
import {
  SNAPSHOT_STORES,
  executeTx,
  getActiveSnapshotMetadata,
  saveActiveSnapshotMetadata,
  recalculateQuestionCounts
} from "./indexedDbV5";
import { verifyChecksum } from "./checksumValidator";

export interface DeltaProcessResult {
  success: boolean;
  fromVersion: number;
  toVersion: number;
  upsertedCount: number;
  deletedCount: number;
  movedCount: number;
  error?: string;
}

export class DeltaProcessor {
  /**
   * Applies an incremental delta bundle inside an atomic IndexedDB transaction.
   */
  public async applyDelta(delta: DeltaBundle): Promise<DeltaProcessResult> {
    const currentMeta = await getActiveSnapshotMetadata();
    const currentVersion = currentMeta?.snapshotVersion || 0;

    if (currentVersion !== delta.fromVersion) {
      throw new Error(
        `Delta version mismatch: local snapshot is at version ${currentVersion}, but delta requires fromVersion ${delta.fromVersion}`
      );
    }

    // Verify delta content checksum if provided
    if (delta.checksum) {
      const payloadString = JSON.stringify({
        fromVersion: delta.fromVersion,
        toVersion: delta.toVersion,
        upsertSubjects: delta.upsertSubjects || [],
        upsertChapters: delta.upsertChapters || [],
        upsertTopics: delta.upsertTopics || [],
        upsertMcqs: delta.upsertMcqs || [],
        deletedMcqIds: delta.deletedMcqIds || [],
        movedQuestions: delta.movedQuestions || []
      });
      const isValid = await verifyChecksum(payloadString, delta.checksum);
      if (!isValid) {
        throw new Error(`Delta integrity validation failed! Checksum mismatch.`);
      }
    }

    const storesToLock = [
      SNAPSHOT_STORES.SUBJECTS,
      SNAPSHOT_STORES.CHAPTERS,
      SNAPSHOT_STORES.TOPICS,
      SNAPSHOT_STORES.MCQS,
      SNAPSHOT_STORES.QUESTION_MAPPINGS,
      SNAPSHOT_STORES.DELETED_RECORDS,
      SNAPSHOT_STORES.SNAPSHOT_METADATA
    ];

    let upsertedCount = 0;
    let deletedCount = 0;
    let movedCount = 0;

    await executeTx(storesToLock, "readwrite", async (stores) => {
      const now = Date.now();

      // 1. Process Deletions (Tombstones)
      if (delta.deletedMcqIds && delta.deletedMcqIds.length > 0) {
        for (const id of delta.deletedMcqIds) {
          // Remove from mcqs and mappings
          stores[SNAPSHOT_STORES.MCQS].delete(id);
          stores[SNAPSHOT_STORES.QUESTION_MAPPINGS].delete(id);

          // Add tombstone to prevent revival
          const tombstone: TombstoneRecord = {
            id,
            entityType: "mcq",
            deletedAt: now,
            snapshotVersion: delta.toVersion,
            reason: "Delta incremental deletion"
          };
          stores[SNAPSHOT_STORES.DELETED_RECORDS].put(tombstone);
          deletedCount++;
        }
      }

      // 2. Process Moved Questions
      if (delta.movedQuestions && delta.movedQuestions.length > 0) {
        for (const move of delta.movedQuestions) {
          const { questionId, toTopicId, newChapterId, newSubjectId } = move;

          // Request existing question
          const getReq = stores[SNAPSHOT_STORES.MCQS].get(questionId);
          await new Promise<void>((resolve, reject) => {
            getReq.onsuccess = () => resolve();
            getReq.onerror = () => reject(getReq.error);
          });

          const question = getReq.result;
          if (question) {
            question.topicId = toTopicId;
            if (newChapterId) question.chapterId = newChapterId;
            if (newSubjectId) question.subjectId = newSubjectId;
            question.updatedAt = now;

            stores[SNAPSHOT_STORES.MCQS].put(question);

            // Update mapping
            const mapping: QuestionMappingRecord = {
              questionId,
              topicId: toTopicId,
              chapterId: question.chapterId || "",
              subjectId: question.subjectId || "",
              updatedAt: now,
              version: delta.toVersion
            };
            stores[SNAPSHOT_STORES.QUESTION_MAPPINGS].put(mapping);
            movedCount++;
          }
        }
      }

      // 3. Process Upserts: Subjects, Chapters, Topics
      if (delta.upsertSubjects) {
        for (const s of delta.upsertSubjects) {
          stores[SNAPSHOT_STORES.SUBJECTS].put(s);
          upsertedCount++;
        }
      }
      if (delta.upsertChapters) {
        for (const c of delta.upsertChapters) {
          stores[SNAPSHOT_STORES.CHAPTERS].put(c);
          upsertedCount++;
        }
      }
      if (delta.upsertTopics) {
        for (const t of delta.upsertTopics) {
          stores[SNAPSHOT_STORES.TOPICS].put(t);
          upsertedCount++;
        }
      }

      // 4. Process Upserts: MCQs
      if (delta.upsertMcqs) {
        for (const m of delta.upsertMcqs) {
          stores[SNAPSHOT_STORES.MCQS].put(m);

          // Update question mapping
          const mapping: QuestionMappingRecord = {
            questionId: m.id,
            topicId: m.topicId,
            chapterId: m.chapterId || "",
            subjectId: m.subjectId || "",
            updatedAt: now,
            version: delta.toVersion
          };
          stores[SNAPSHOT_STORES.QUESTION_MAPPINGS].put(mapping);
          upsertedCount++;
        }
      }

      // 5. Update Snapshot Metadata
      const updatedMeta: SnapshotMetadataRecord = {
        id: "current_active_snapshot",
        snapshotVersion: delta.toVersion,
        schemaVersion: currentMeta?.schemaVersion || 2,
        curriculumVersion: delta.toVersion,
        mcqVersion: delta.toVersion,
        installedAt: currentMeta?.installedAt || now,
        lastCheckedAt: now,
        lastSuccessfulSyncAt: now,
        checksum: delta.checksum || currentMeta?.checksum || "",
        status: "healthy",
        totalMcqs: (currentMeta?.totalMcqs || 0) + (delta.upsertMcqs?.length || 0) - deletedCount,
        isInitialSnapshotLoaded: true
      };

      stores[SNAPSHOT_STORES.SNAPSHOT_METADATA].put(updatedMeta);
    });

    // 6. Recalculate all affected topic and chapter question counts
    await recalculateQuestionCounts();

    return {
      success: true,
      fromVersion: delta.fromVersion,
      toVersion: delta.toVersion,
      upsertedCount,
      deletedCount,
      movedCount
    };
  }
}

export const defaultDeltaProcessor = new DeltaProcessor();
