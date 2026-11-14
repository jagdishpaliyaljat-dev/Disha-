/**
 * Snapshot-Based Synchronization Architecture - Core Type Definitions
 * QuizPro / Disha 20-20 Education Application
 */

export interface VersionManifestChunk {
  chunkIndex: number;
  url: string;
  checksum: string; // SHA-256
  itemCount: number;
}

export interface VersionManifest {
  schemaVersion: number;
  snapshotVersion: number;
  previousSnapshotVersion: number;
  curriculumVersion: number;
  mcqVersion: number;
  publishedAt: string;
  snapshotUrl: string;
  checksum: string; // SHA-256 of full dataset
  status: "published" | "deprecated" | "draft";
  totalMcqs: number;
  totalSubjects: number;
  totalChapters: number;
  totalTopics: number;
  chunks: VersionManifestChunk[];
  deltaAvailableFrom?: number;
}

export interface SnapshotChunkData {
  chunkIndex: number;
  snapshotVersion: number;
  items: any[];
}

export interface DeltaBundle {
  fromVersion: number;
  toVersion: number;
  publishedAt: string;
  checksum: string;
  upsertSubjects?: any[];
  upsertChapters?: any[];
  upsertTopics?: any[];
  upsertMcqs?: any[];
  deletedMcqIds?: string[]; // Tombstones
  deletedTopicIds?: string[];
  deletedChapterIds?: string[];
  deletedSubjectIds?: string[];
  movedQuestions?: Array<{
    questionId: string;
    fromTopicId: string;
    toTopicId: string;
    newChapterId?: string;
    newSubjectId?: string;
  }>;
}

export interface SnapshotMetadataRecord {
  id: string; // e.g. "current_active_snapshot"
  snapshotVersion: number;
  schemaVersion: number;
  curriculumVersion: number;
  mcqVersion: number;
  installedAt: number;
  lastCheckedAt: number;
  lastSuccessfulSyncAt: number;
  checksum: string;
  status: "healthy" | "corrupted" | "updating";
  totalMcqs: number;
  isInitialSnapshotLoaded: boolean;
}

export interface TombstoneRecord {
  id: string;
  entityType: "mcq" | "topic" | "chapter" | "subject";
  deletedAt: number;
  snapshotVersion: number;
  reason?: string;
}

export interface QuestionMappingRecord {
  questionId: string;
  topicId: string;
  chapterId: string;
  subjectId: string;
  updatedAt: number;
  version: number;
}

export interface UserActivityEvent {
  eventId: string;
  userId: string;
  eventType:
    | "attempt"
    | "wrong_question"
    | "bookmark"
    | "test_result"
    | "revision"
    | "study_log"
    | "syllabus_progress";
  entityId: string;
  operation: "upsert" | "delete" | "append";
  payload: any;
  clientTimestamp: number;
  syncStatus: "pending" | "in_flight" | "synced" | "failed";
  retryCount: number;
  lastErrorCode?: string;
  lastErrorMessage?: string;
  sessionBatchId?: string;
}

export interface SyncScheduleConfig {
  syncIntervalMs: number; // 24 hours = 24 * 60 * 60 * 1000
  forceRefresh?: boolean;
  allowCellular?: boolean;
  backoffDelayMs?: number;
}

export interface SyncExecutionResult {
  success: boolean;
  actionTaken: "no_action_needed" | "initial_download" | "incremental_delta" | "full_snapshot_fallback" | "skipped_under_24h";
  fromVersion?: number;
  toVersion?: number;
  recordsUpdated?: number;
  recordsDeleted?: number;
  timeTakenMs: number;
  error?: string;
}
