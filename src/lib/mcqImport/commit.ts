import { Question } from "../../types";
import { isUserAdmin, loadUserProfile, ADMIN_EMAILS } from "../../utils/userProfileStorage";
import { upsertQuestionsToSupabase, deleteQuestionsBulkFromSupabase } from "../../utils/supabaseSyncService";
import { isSupabaseConfigured, supabase } from "../../lib/supabase";
import {
  loadUserQuestionsStore,
  saveUserQuestionsStore,
  mergeQuestionsIntoStore,
  bulkDeleteQuestions,
} from "../../utils/questionsStorage";
import { openLocalDatabase, idbPut, idbDelete, STORES } from "../../utils/localDatabaseEngine";

const IMPORTED_HASH_REGISTRY_KEY = "disha2020_imported_q_hashes_v1";
const LEGACY_IMPORTED_HASH_REGISTRY_KEY = "quizpro_imported_q_hashes_v1";
const IMPORT_BATCHES_STORAGE_KEY = "disha2020_import_batches_v1";
const LEGACY_IMPORT_BATCHES_STORAGE_KEY = "quizpro_import_batches_v1";

export interface CommitProgress {
  currentChunk: number;
  totalChunks: number;
  committedCount: number;
  totalCount: number;
  progressText: string;
}

export interface CommitQuestionsResult {
  success: boolean;
  committedCount: number;
  skippedCount?: number;
  failedCount: number;
  batchId?: string;
  error?: string;
  errorCode?: string;
  failedQuestionIds: string[];
  skippedQuestionIds?: string[];
  batchErrors: { chunkIndex: number; error: string; affectedIds: string[] }[];
}

export interface UndoBatchResult {
  success: boolean;
  deletedCount: number;
  deletedQuestionIds: string[];
  affectedTopicIds?: string[];
  error?: string;
  errorCode?: string;
}

export function promiseWithTimeout<T>(
  promise: Promise<T>,
  ms = 30000,
  operationName = "Database operation"
): Promise<T> {
  let timer: any;
  const timeoutPromise = new Promise<T>((_, reject) => {
    timer = setTimeout(() => {
      const err: any = new Error(
        `Database operation timed out after ${Math.round(ms / 1000)}s [timeout]: ${operationName}`
      );
      err.code = "deadline-exceeded";
      reject(err);
    }, ms);
  });

  return Promise.race([
    promise.finally(() => clearTimeout(timer)),
    timeoutPromise,
  ]);
}

export function formatFirestoreError(err: any): { message: string; code: string } {
  const code = err?.code || err?.status || "unknown";
  const message = err?.message || "An unexpected error occurred during import.";
  return { message, code: String(code) };
}

export function sanitizeFirestorePayload<T = any>(obj: T): T {
  return obj;
}

/**
 * Commits a list of questions using authoritative Supabase PostgreSQL persistence
 * and synchronizes with local IndexedDB and localStorage caches.
 */
export const commitQuestions = async (
  questions: Question[],
  batchId: string,
  onProgress?: (progress: CommitProgress) => void,
  options?: {
    mirrorToLegacyQuestions?: boolean;
  }
): Promise<CommitQuestionsResult> => {
  console.log(`[MCQ Import] Committing ${questions?.length || 0} questions for batch "${batchId}"...`);

  if (!questions || questions.length === 0) {
    return {
      success: false,
      committedCount: 0,
      skippedCount: 0,
      failedCount: 0,
      error: "No questions provided to import.",
      errorCode: "empty-payload",
      failedQuestionIds: [],
      skippedQuestionIds: [],
      batchErrors: [],
    };
  }

  // 1. Authorization Check
  const userProfile = loadUserProfile();
  const isAdmin =
    isUserAdmin(userProfile) ||
    Boolean(userProfile?.email && ADMIN_EMAILS.includes(userProfile.email.trim().toLowerCase()));

  if (!isAdmin) {
    return {
      success: false,
      committedCount: 0,
      skippedCount: 0,
      failedCount: questions.length,
      error: "Missing or insufficient permissions. Only authorized administrators can import questions.",
      errorCode: "permission-denied",
      failedQuestionIds: questions.map((q) => q.id),
      skippedQuestionIds: [],
      batchErrors: [{ chunkIndex: 0, error: "Permission denied", affectedIds: questions.map((q) => q.id) }],
    };
  }

  // 2. Persist to Supabase if configured
  try {
    if (isSupabaseConfigured()) {
      const sbRes = await upsertQuestionsToSupabase(questions);
      if (!sbRes.success || !sbRes.cloudSynced) {
        throw new Error(sbRes.message || "Database write failed: Supabase did not confirm synchronization.");
      }

      // 2b. Authoritatively verify actual insertion in Supabase database
      const sampleIds = questions.slice(0, 10).map((q) => q.id);
      const { data: verifiedRows, error: verifyErr } = await supabase
        .from("questions")
        .select("id")
        .in("id", sampleIds);

      if (verifyErr) {
        throw new Error(`Supabase verification query failed: ${verifyErr.message}`);
      }
      if (!verifiedRows || verifiedRows.length === 0) {
        throw new Error("Supabase verification failed: inserted questions not found in database.");
      }
    }
  } catch (err: any) {
    console.error("[MCQ Import] Supabase upsert error:", err);
    return {
      success: false,
      committedCount: 0,
      skippedCount: 0,
      failedCount: questions.length,
      error: err?.message || "Database write failed",
      errorCode: err?.code || "db-error",
      failedQuestionIds: questions.map((q) => q.id),
      skippedQuestionIds: [],
      batchErrors: [{ chunkIndex: 0, error: err?.message || "Database error", affectedIds: questions.map((q) => q.id) }],
    };
  }

  // 3. Update Local Storage & IndexedDB Store
  try {
    mergeQuestionsIntoStore(questions);
    await openLocalDatabase();
    for (const q of questions) {
      await idbPut(STORES.MCQS, q);
    }
  } catch (localErr) {
    console.warn("[MCQ Import] Local cache update warning:", localErr);
  }

  // 4. Record batch in localStorage for undo tracking
  try {
    const batchesRaw = localStorage.getItem(IMPORT_BATCHES_STORAGE_KEY) || localStorage.getItem(LEGACY_IMPORT_BATCHES_STORAGE_KEY) || "{}";
    const batches = JSON.parse(batchesRaw);
    batches[batchId] = {
      id: batchId,
      questionIds: questions.map((q) => q.id),
      topicIds: Array.from(new Set(questions.map((q) => q.topicId).filter(Boolean))),
      count: questions.length,
      committedAt: new Date().toISOString(),
    };
    localStorage.setItem(IMPORT_BATCHES_STORAGE_KEY, JSON.stringify(batches));
  } catch {}

  if (onProgress) {
    onProgress({
      currentChunk: 1,
      totalChunks: 1,
      committedCount: questions.length,
      totalCount: questions.length,
      progressText: `${questions.length}/${questions.length} saved`,
    });
  }

  return {
    success: true,
    committedCount: questions.length,
    skippedCount: 0,
    failedCount: 0,
    batchId,
    failedQuestionIds: [],
    skippedQuestionIds: [],
    batchErrors: [],
  };
};

/**
 * Undoes an imported batch by deleting its questions from Supabase and local caches.
 */
export const undoImportBatch = async (batchId: string): Promise<UndoBatchResult> => {
  if (!batchId) {
    return {
      success: false,
      deletedCount: 0,
      deletedQuestionIds: [],
      error: "No batch ID specified.",
      errorCode: "missing-batch-id",
    };
  }

  console.log(`[MCQ Import] [Undo] Undoing batch ${batchId}...`);
  const userProfile = loadUserProfile();
  const isAdmin =
    isUserAdmin(userProfile) ||
    Boolean(userProfile?.email && ADMIN_EMAILS.includes(userProfile.email.trim().toLowerCase()));

  if (!isAdmin) {
    return {
      success: false,
      deletedCount: 0,
      deletedQuestionIds: [],
      error: "Authentication & administrator permissions required to undo import.",
      errorCode: "permission-denied",
    };
  }

  try {
    let questionIds: string[] = [];
    let affectedTopicIds: string[] = [];

    // 1. Try local batch tracking
    try {
      const batchesRaw = localStorage.getItem(IMPORT_BATCHES_STORAGE_KEY) || localStorage.getItem(LEGACY_IMPORT_BATCHES_STORAGE_KEY) || "{}";
      const batches = JSON.parse(batchesRaw);
      if (batches[batchId]) {
        questionIds = batches[batchId].questionIds || [];
        affectedTopicIds = batches[batchId].topicIds || [];
      }
    } catch {}

    // 2. If questionIds found, delete from Supabase
    if (questionIds.length > 0 && isSupabaseConfigured()) {
      await deleteQuestionsBulkFromSupabase(questionIds);
    }

    // 3. Delete from local cache
    if (questionIds.length > 0) {
      const store = loadUserQuestionsStore();
      const updatedStore = bulkDeleteQuestions(store, questionIds);
      saveUserQuestionsStore(updatedStore);

      await openLocalDatabase();
      for (const id of questionIds) {
        await idbDelete(STORES.MCQS, id);
      }
    }

    return {
      success: true,
      deletedCount: questionIds.length,
      deletedQuestionIds: questionIds,
      affectedTopicIds,
    };
  } catch (err: any) {
    console.error("[MCQ Import] [Undo] Error undoing batch:", err);
    return {
      success: false,
      deletedCount: 0,
      deletedQuestionIds: [],
      error: err?.message || "Failed to undo batch",
      errorCode: err?.code || "undo-failed",
    };
  }
};
