import { db } from "../../lib/firebase";
import { doc, collection, query, where } from "firebase/firestore";
import { Question } from "../../types";
import { isUserAdmin, loadUserProfile, ADMIN_EMAILS } from "../../utils/userProfileStorage";
import { serializeTableForFirestore } from "../../utils/firebaseSyncService";
import { generateQuestionHash } from "./dedupe";
import {
  guardedWriteBatch,
  guardedSetDoc,
  guardedGetDoc,
  guardedGetDocs,
  guardedDeleteDoc,
  isQuotaExhausted,
  classifyFirestoreError,
  getEffectiveAuthUser,
} from "../../utils/quotaTracker";
import { ensureStableUniqueDocId } from "../../utils/permanentDataIntegrity";
import { computeCanonicalHash, computeQuestionContentHash } from "../../utils/contentHash";

const IMPORTED_HASH_REGISTRY_KEY = "quizpro_imported_q_hashes_v1";

export interface CommitProgress {
  currentChunk: number;
  totalChunks: number;
  committedCount: number;
  totalCount: number;
  progressText: string; // e.g. "2/5 saved"
}

export interface CommitQuestionsResult {
  success: boolean;
  committedCount: number;
  skippedCount?: number;
  failedCount: number;
  batchId?: string;
  error?: string;
  errorCode?: string; // "quota-exceeded" | "permission-denied" | "timeout" | string
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

function loadImportedHashRegistry(): Record<string, string> {
  try {
    if (typeof localStorage === "undefined") return {};
    const raw = localStorage.getItem(IMPORTED_HASH_REGISTRY_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function saveImportedHashRegistry(registry: Record<string, string>): void {
  try {
    if (typeof localStorage === "undefined") return;
    const keys = Object.keys(registry);
    // Cap size politely if needed while keeping most recent entries
    if (keys.length > 20000) {
      const trimmed: Record<string, string> = {};
      for (const k of keys.slice(keys.length - 15000)) {
        trimmed[k] = registry[k];
      }
      localStorage.setItem(IMPORTED_HASH_REGISTRY_KEY, JSON.stringify(trimmed));
      return;
    }
    localStorage.setItem(IMPORTED_HASH_REGISTRY_KEY, JSON.stringify(registry));
  } catch {}
}

/**
 * Strict timeout on any promise via Promise.race
 */
export function promiseWithTimeout<T>(
  promise: Promise<T>,
  ms = 30000,
  operationName = "Firestore operation"
): Promise<T> {
  let timer: any;
  const timeoutPromise = new Promise<T>((_, reject) => {
    timer = setTimeout(() => {
      const err: any = new Error(`Database operation timed out after ${Math.round(ms / 1000)}s [timeout]: ${operationName}`);
      err.code = "deadline-exceeded";
      reject(err);
    }, ms);
  });

  return Promise.race([
    promise.finally(() => clearTimeout(timer)),
    timeoutPromise,
  ]);
}

/**
 * Format errors into clear, standard codes and messages:
 * quota-exceeded, permission-denied, timeout
 */
export function formatFirestoreError(err: any): { message: string; code: string } {
  const errMsg = (err?.message || String(err || "")).toLowerCase();
  const errCode = (err?.code || "").toLowerCase();

  if (
    errCode.includes("resource-exhausted") ||
    errMsg.includes("quota") ||
    errMsg.includes("exhausted") ||
    errMsg.includes("quota-exceeded")
  ) {
    return {
      code: "quota-exceeded",
      message: "Database quota exceeded. Daily Firestore write quota has been reached. Please try again tomorrow or contact support."
    };
  }
  if (
    errCode.includes("permission-denied") ||
    errMsg.includes("permission") ||
    errMsg.includes("insufficient") ||
    errMsg.includes("unauthenticated") ||
    errMsg.includes("permission-denied")
  ) {
    return {
      code: "permission-denied",
      message: "Permission denied. Insufficient database permissions. Please make sure you are signed in with an authorized Google Admin account."
    };
  }
  if (
    errCode.includes("deadline-exceeded") ||
    errMsg.includes("timeout") ||
    errMsg.includes("timed out")
  ) {
    return {
      code: "timeout",
      message: "Database operation timed out after 30 seconds. Please check your internet connection and try again."
    };
  }
  return {
    code: errCode || "unknown-error",
    message: err?.message || "An unexpected error occurred during database import."
  };
}

/**
 * Recursively removes all `undefined` values from payload,
 * ensuring Firestore never rejects with "Unsupported field value: undefined".
 */
export function sanitizeFirestorePayload<T = any>(obj: T): T {
  if (obj === null || obj === undefined) {
    return null as any;
  }
  if (Array.isArray(obj)) {
    return obj
      .filter((item) => item !== undefined)
      .map((item) => sanitizeFirestorePayload(item)) as any;
  }
  if (typeof obj === "object" && !(obj instanceof Date)) {
    const cleaned: Record<string, any> = {};
    for (const [key, value] of Object.entries(obj)) {
      if (value !== undefined) {
        cleaned[key] = sanitizeFirestorePayload(value);
      }
    }
    return cleaned as T;
  }
  return obj;
}

/**
 * Commits new or content-modified questions to Firestore `mcqs` + `questions` collections
 * in safe <= 400-operation batches.
 * - Skips duplicates within the batch and identical existing questions (0 redundant writes).
 * - Uses deterministic chunk idempotency keys so retries do not duplicate commits.
 * - Writes `import_batches/{batchId}` once on completion instead of double-writing.
 * - Repacks only dirty topic bundles and triggers 1 single curriculum version bump.
 */
export const commitQuestions = async (
  questions: Question[],
  batchId: string,
  onProgress?: (progress: CommitProgress) => void,
  options?: {
    mirrorToLegacyQuestions?: boolean;
  }
): Promise<CommitQuestionsResult> => {
  console.log(`[MCQ Import] [Step: Parse] Validating and preparing ${questions?.length || 0} questions for batch "${batchId}"...`);

  if (!questions || questions.length === 0) {
    const emptyErr = "No questions provided to import.";
    console.error("[MCQ Import] [Step: Parse] Failed: No questions provided.");
    return {
      success: false,
      committedCount: 0,
      skippedCount: 0,
      failedCount: 0,
      error: emptyErr,
      errorCode: "empty-payload",
      failedQuestionIds: [],
      skippedQuestionIds: [],
      batchErrors: []
    };
  }

  // 1. Verify User Authentication & Authorization Pre-check
  const currentUser = getEffectiveAuthUser();
  const userProfile = loadUserProfile();
  const isAdminUser =
    isUserAdmin(userProfile) ||
    isUserAdmin(currentUser?.email || currentUser?.uid) ||
    Boolean(currentUser?.email && ADMIN_EMAILS.includes(currentUser.email.trim().toLowerCase()));

  if (!isAdminUser) {
    const errorMsg = "Missing or insufficient permissions. Only authorized administrators can import questions.";
    console.error("[MCQ Import] [Step: Auth] Stalled/Failed at Step [Auth]: permission-denied.");
    return {
      success: false,
      committedCount: 0,
      skippedCount: 0,
      failedCount: questions.length,
      error: errorMsg,
      errorCode: "permission-denied",
      failedQuestionIds: questions.map((q) => q.id),
      skippedQuestionIds: [],
      batchErrors: [{ chunkIndex: 0, error: errorMsg, affectedIds: questions.map((q) => q.id) }]
    };
  }

  const activeUserId = currentUser?.uid || userProfile?.id || "admin_system";
  const activeUserEmail = currentUser?.email || userProfile?.email || "jagdishpaliyaljat@gmail.com";

  // 2. Duplicate & Change Detection against batch + local store + imported hash registry
  const hashRegistry = loadImportedHashRegistry();
  const existingById = new Map<string, string>();
  const existingTextHashes = new Set<string>();

  try {
    const { loadUserQuestionsStore } = await import("../../utils/questionsStorage");
    const store = loadUserQuestionsStore();
    const allKnown = [
      ...(store.cloudCacheQuestions || []),
      ...(store.customQuestions || []),
    ];
    for (const eq of allKnown) {
      if (!eq || !eq.id) continue;
      const eqHash = (eq as any).contentHash || computeQuestionContentHash(eq);
      existingById.set(eq.id, eqHash);
      existingTextHashes.add(`${eq.topicId || ""}::${generateQuestionHash(eq as any)}`);
    }
  } catch {}

  const seenBatchIds = new Set<string>();
  const seenBatchTextHashes = new Set<string>();
  const questionsToWrite: { question: Question; docId: string; contentHash: string }[] = [];
  const skippedQuestionIds: string[] = [];

  for (const q of questions) {
    const docId = ensureStableUniqueDocId(q, q.topicId);
    q.id = docId;
    const contentHash = computeQuestionContentHash(q);
    const textHash = `${q.topicId || ""}::${generateQuestionHash(q as any)}`;

    // Intra-batch duplicate
    if (seenBatchIds.has(docId) || seenBatchTextHashes.has(textHash)) {
      skippedQuestionIds.push(docId);
      continue;
    }
    seenBatchIds.add(docId);
    seenBatchTextHashes.add(textHash);

    // Existing duplicate with identical content hash
    const knownHash = hashRegistry[docId] || existingById.get(docId);
    if (knownHash && knownHash === contentHash) {
      skippedQuestionIds.push(docId);
      continue;
    }
    // Exact duplicate text+topic already known in local store and not explicitly modifying an existing ID
    if (!knownHash && existingTextHashes.has(textHash)) {
      skippedQuestionIds.push(docId);
      continue;
    }

    questionsToWrite.push({ question: q, docId, contentHash });
  }

  if (questionsToWrite.length === 0) {
    console.log(`[MCQ Import] All ${questions.length} questions matched existing content hashes. 0 writes needed.`);
    return {
      success: true,
      committedCount: 0,
      skippedCount: skippedQuestionIds.length,
      failedCount: 0,
      batchId,
      failedQuestionIds: [],
      skippedQuestionIds,
      batchErrors: [],
    };
  }

  if (isQuotaExhausted()) {
    const quotaMsg = "Database quota exceeded. Daily write quota circuit breaker is active; import halted safely.";
    return {
      success: false,
      committedCount: 0,
      skippedCount: skippedQuestionIds.length,
      failedCount: questionsToWrite.length,
      batchId,
      error: quotaMsg,
      errorCode: "quota-exceeded",
      failedQuestionIds: questionsToWrite.map((x) => x.docId),
      skippedQuestionIds,
      batchErrors: [{ chunkIndex: 0, error: quotaMsg, affectedIds: questionsToWrite.map((x) => x.docId) }],
    };
  }

  // Commit in chunks of 200 MCQs (400 operations per batch including mirror writes)
  const BATCH_SIZE = 200;
  const totalChunks = Math.ceil(questionsToWrite.length / BATCH_SIZE);
  let committedCount = 0;
  let failedCount = 0;
  const failedQuestionIds: string[] = [];
  const batchErrors: { chunkIndex: number; error: string; affectedIds: string[] }[] = [];
  const successfulItems: { question: Question; docId: string; contentHash: string }[] = [];
  const importedAt = new Date().toISOString();

  // Sequential or bounded 2-chunk concurrency for throughput while respecting quota cutoff
  const CONCURRENCY = 2;
  let quotaTripped = false;
  for (let c = 0; c < totalChunks; c += CONCURRENCY) {
    if (quotaTripped || isQuotaExhausted()) {
      quotaTripped = true;
      for (let rem = c; rem < totalChunks; rem++) {
        const remChunk = questionsToWrite.slice(rem * BATCH_SIZE, (rem + 1) * BATCH_SIZE);
        const remIds = remChunk.map((x) => x.docId);
        failedCount += remChunk.length;
        failedQuestionIds.push(...remIds);
        batchErrors.push({
          chunkIndex: rem,
          error: "Database quota exceeded. Remaining import chunks halted to protect production quota.",
          affectedIds: remIds,
        });
      }
      break;
    }

    const chunkPromises: Promise<void>[] = [];
    for (let offset = 0; offset < CONCURRENCY && c + offset < totalChunks; offset++) {
      const chunkIdx = c + offset;
      const chunk = questionsToWrite.slice(chunkIdx * BATCH_SIZE, (chunkIdx + 1) * BATCH_SIZE);
      const chunkIds = chunk.map((x) => x.docId);
      const chunkHash = computeCanonicalHash(chunk.map((x) => `${x.docId}:${x.contentHash}`));
      const progressLabel = `${chunkIdx + 1}/${totalChunks} saved`;

      chunkPromises.push(
        (async () => {
          try {
            const batch = guardedWriteBatch(db);

            chunk.forEach(({ question: q, docId: qDocId, contentHash }) => {
              const qRef = doc(db, "mcqs", qDocId);

              let cleanImageUrl = q.imageUrl || "";
              let cleanSvg = (q as any).svgContent || "";
              if (q.image?.dataUrl) {
                cleanImageUrl = q.image.dataUrl;
                if (q.image.type === "svg" || q.image.dataUrl.includes("<svg") || q.image.dataUrl.includes("data:image/svg+xml")) {
                  cleanSvg = q.image.sanitizedSvg || cleanSvg || q.image.dataUrl;
                }
              }

              const rawPayload: any = {
                ...q,
                id: qDocId,
                contentHash,
                imageUrl: cleanImageUrl || null,
                svgContent: cleanSvg || null,
                importBatchId: batchId,
                importedAt,
                importedBy: activeUserId,
                isUserAdded: true,
                createdAt: q.createdAt || importedAt,
                updatedAt: importedAt,
              };

              if (rawPayload.table) {
                rawPayload.table = serializeTableForFirestore(rawPayload.table);
              }
              if (rawPayload.tableData) {
                rawPayload.tableData = serializeTableForFirestore(rawPayload.tableData);
              }

              const qPayload = sanitizeFirestorePayload(rawPayload);

              const jsonLength = JSON.stringify(qPayload).length;
              if (jsonLength > 850 * 1024) {
                if (qPayload.image && typeof qPayload.image === "object") {
                  qPayload.image.dataUrl = "";
                }
                if (qPayload.imageUrl && qPayload.imageUrl.length > 400 * 1024) {
                  qPayload.imageUrl = "";
                }
              }

              batch.set(qRef, qPayload, { merge: true });

              // Phase 4: Eliminated redundant mirror write to legacy 'questions' collection.
              // Saves 50% write quota on all bulk imports. Can be explicitly enabled if required for legacy compatibility:
              if (options?.mirrorToLegacyQuestions) {
                const mirrorRef = doc(db, "questions", qDocId);
                batch.set(mirrorRef, qPayload, { merge: true });
              }
            });

            await promiseWithTimeout(
              batch.commit(
                "Admin",
                `Import Chunk ${chunkIdx + 1}/${totalChunks}`,
                undefined,
                20000,
                `import_${batchId}_c${chunkIdx}_${chunkHash}`
              ),
              20000,
              `Batch Commit Chunk ${chunkIdx + 1}/${totalChunks}`
            );

            committedCount += chunk.length;
            successfulItems.push(...chunk);

            // Persist committed content hashes immediately so partial failures never re-write committed chunks
            for (const item of chunk) {
              hashRegistry[item.docId] = item.contentHash;
            }
            saveImportedHashRegistry(hashRegistry);

            if (onProgress) {
              onProgress({
                currentChunk: chunkIdx + 1,
                totalChunks,
                committedCount,
                totalCount: questionsToWrite.length,
                progressText: progressLabel,
              });
            }
          } catch (err: any) {
            const formatted = formatFirestoreError(err);
            const errInfo = classifyFirestoreError(err);
            if (errInfo.isQuotaError || formatted.code === "quota-exceeded" || isQuotaExhausted()) {
              quotaTripped = true;
            }
            console.error(`[MCQ Import] Failed at chunk ${chunkIdx + 1}/${totalChunks} [${formatted.code}]:`, formatted.message, err);
            failedCount += chunk.length;
            failedQuestionIds.push(...chunkIds);
            batchErrors.push({ chunkIndex: chunkIdx, error: formatted.message, affectedIds: chunkIds });
          }
        })()
      );
    }
    await Promise.all(chunkPromises);
  }

  const successfulDocIds = successfulItems.map((x) => x.docId);

  // Write final batch metadata record ONCE at completion (avoids redundant initial + update writes)
  if (!isQuotaExhausted() && (committedCount > 0 || !quotaTripped)) {
    try {
      const batchMetaRef = doc(db, "import_batches", batchId);
      const batchMetaPayload = sanitizeFirestorePayload({
        id: batchId,
        batchId,
        importedBy: activeUserId,
        importedByEmail: activeUserEmail,
        questionCount: questions.length,
        committedCount,
        skippedCount: skippedQuestionIds.length,
        failedCount,
        questionIds: successfulDocIds,
        successfulQuestionIds: successfulDocIds,
        failedQuestionIds,
        status: failedCount === 0 ? "completed" : committedCount > 0 ? "partial" : "failed",
        errors: batchErrors,
        createdAt: importedAt,
        updatedAt: new Date().toISOString(),
      });
      await promiseWithTimeout(
        guardedSetDoc(
          batchMetaRef,
          batchMetaPayload,
          { merge: true },
          "Admin",
          "Record Import Batch Metadata",
          undefined,
          10000,
          `import_meta_${batchId}_${committedCount}_${failedCount}`
        ),
        10000,
        "Record Import Batch Metadata"
      ).catch((err) => console.warn("[MCQ Import] Non-blocking batch metadata notice:", err));
    } catch (_) {}
  }

  const overallSuccess = committedCount > 0;
  let finalErrorMsg: string | undefined = undefined;
  let finalErrorCode: string | undefined = undefined;

  if (failedCount > 0) {
    if (batchErrors.length > 0) {
      const firstError = batchErrors[0].error;
      const parsed = formatFirestoreError(new Error(firstError));
      finalErrorMsg = `${failedCount} question(s) failed: ${parsed.message}`;
      finalErrorCode = parsed.code;
    } else {
      finalErrorMsg = `${failedCount} questions failed to import.`;
      finalErrorCode = "partial-failure";
    }
  }

  if (overallSuccess) {
    try {
      const { clearFirestoreCache } = await import("../../utils/quotaTracker");
      const { mergeQuestionsIntoStore, loadUserQuestionsStore } = await import("../../utils/questionsStorage");

      clearFirestoreCache();

      const committedQuestions = successfulItems.map((x) => ({
        ...x.question,
        contentHash: x.contentHash,
      }));

      const dirtyTopicIds = Array.from(
        new Set(committedQuestions.map((q) => q.topicId).filter(Boolean) as string[])
      );

      if (typeof window !== "undefined") {
        dirtyTopicIds.forEach((tId) => {
          try {
            localStorage.removeItem(`quizpro_mcqs_${tId}`);
          } catch (_) {}
        });
        try {
          localStorage.removeItem("quizpro_mcqs_all");
        } catch (_) {}
      }

      try {
        mergeQuestionsIntoStore(committedQuestions);
      } catch (_) {}

      // Targeted bundle repack for ONLY dirty topics + 1 single version bump (unless quota tripped)
      if (!isQuotaExhausted()) {
        try {
          const { bumpRemoteCurriculumVersion } = await import("../../utils/appVersionService");
          const { saveQuestionBundleForTopic } = await import("../../utils/questionBundleService");
          const updatedStore = loadUserQuestionsStore();
          const allLocalQs = [
            ...(updatedStore.cloudCacheQuestions || []),
            ...(updatedStore.customQuestions || []),
          ];

          for (const topicId of dirtyTopicIds) {
            if (isQuotaExhausted()) break;
            try {
              const snapshotMcqs = await guardedGetDocs(
                query(collection(db, "mcqs"), where("topicId", "==", topicId)),
                "Admin",
                `Repack Dirty Bundle [${topicId}]`,
                undefined,
                8000
              ).catch(() => null);

              const remoteTopicQs = snapshotMcqs && !snapshotMcqs.empty
                ? snapshotMcqs.docs.map((d) => ({ ...d.data(), id: d.id } as Question))
                : [];
              const localTopicQs = allLocalQs.filter((q) => q.topicId === topicId);

              const mergedTopicMap = new Map<string, Question>();
              for (const lq of localTopicQs) mergedTopicMap.set(lq.id, lq);
              for (const rq of remoteTopicQs) mergedTopicMap.set(rq.id, rq);

              if (mergedTopicMap.size > 0) {
                await saveQuestionBundleForTopic(topicId, Array.from(mergedTopicMap.values()));
              }
            } catch (_) {}
          }

          if (!isQuotaExhausted()) {
            const digest = computeCanonicalHash(
              successfulItems.map((x) => `${x.docId}:${x.contentHash}`).sort()
            );
            await bumpRemoteCurriculumVersion(dirtyTopicIds, undefined, {
              contentDigest: digest,
              reason: `import:${batchId}`,
            });
          }
        } catch (bgErr) {
          console.warn("[MCQ Import] Version bump / bundle repack notice:", bgErr);
        }
      }
    } catch (packErr) {
      console.warn("[MCQ Import] Non-blocking cache update warning:", packErr);
    }
  }

  console.log(
    `[MCQ Import] [Step: Finished] Result: ${committedCount} committed, ${skippedQuestionIds.length} skipped (unchanged), ${failedCount} failed.`
  );

  if (overallSuccess && committedCount > 0) {
    try {
      const { triggerFirebaseSavedToast } = await import("../../utils/adminToast");
      triggerFirebaseSavedToast({
        title: `${committedCount} MCQs Saved to Firebase!`,
        message: `${committedCount} प्रश्न फायरबेस डेटाबेस में सुरक्षित सेव हो गए • यूज़र्स के लिए लाइव उपलब्ध!`,
        count: committedCount,
      });
    } catch (_) {}
  }

  return {
    success: overallSuccess,
    committedCount,
    skippedCount: skippedQuestionIds.length,
    failedCount,
    batchId,
    failedQuestionIds,
    skippedQuestionIds,
    batchErrors,
    error: finalErrorMsg,
    errorCode: finalErrorCode,
  };
};

/**
 * Undoes an import batch by removing all questions with matching `importBatchId`
 * (plus batch metadata fallback IDs) from BOTH `mcqs` and mirror `questions`
 * in batches of <= 400 ops, cleaning caches/hashes, repacking affected topic bundles,
 * and bumping curriculum version once.
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
  const currentUser = getEffectiveAuthUser();
  const userProfile = loadUserProfile();
  const isAdmin =
    isUserAdmin(userProfile) ||
    isUserAdmin(currentUser?.email || currentUser?.uid) ||
    Boolean(currentUser?.email && ADMIN_EMAILS.includes(currentUser.email.trim().toLowerCase()));

  if (!currentUser || !isAdmin) {
    return {
      success: false,
      deletedCount: 0,
      deletedQuestionIds: [],
      error: "Authentication & administrator permissions required to undo import.",
      errorCode: "permission-denied",
    };
  }

  try {
    const idSet = new Set<string>();
    const affectedTopicSet = new Set<string>();

    // 1. Discover IDs via query on `mcqs` and fallback to `import_batches/{batchId}`
    const qQuery = query(collection(db, "mcqs"), where("importBatchId", "==", batchId));
    const [snapshot, metaSnap] = await Promise.all([
      promiseWithTimeout(
        guardedGetDocs(qQuery, "Admin", "Query MCQs For Undo", undefined, 30000),
        30000,
        "Query MCQs For Undo"
      ),
      guardedGetDoc(doc(db, "import_batches", batchId), "Admin", "Read Import Batch Metadata For Undo").catch(() => null),
    ]);

    snapshot.docs.forEach((docSnap) => {
      idSet.add(docSnap.id);
      const tId = (docSnap.data() as any)?.topicId;
      if (tId) affectedTopicSet.add(tId);
    });

    if (metaSnap && metaSnap.exists()) {
      const metaData = metaSnap.data() as any;
      const metaIds: string[] = [
        ...(Array.isArray(metaData?.successfulQuestionIds) ? metaData.successfulQuestionIds : []),
        ...(Array.isArray(metaData?.questionIds) ? metaData.questionIds : []),
      ];
      metaIds.forEach((id) => {
        if (id) idSet.add(id);
      });
    }

    const allTargetIds = Array.from(idSet);
    const deletedQuestionIds: string[] = [];

    // 2. Delete from BOTH `mcqs` and `questions` in chunks of 200 IDs (400 ops/batch)
    const BATCH_ID_LIMIT = 200;
    for (let i = 0; i < allTargetIds.length; i += BATCH_ID_LIMIT) {
      if (isQuotaExhausted()) break;
      const chunk = allTargetIds.slice(i, i + BATCH_ID_LIMIT);
      const batch = guardedWriteBatch(db);
      chunk.forEach((qId) => {
        batch.delete(doc(db, "mcqs", qId));
        batch.delete(doc(db, "questions", qId));
      });
      await batch.commit(
        "Admin",
        `Undo Import Batch Chunk ${Math.floor(i / BATCH_ID_LIMIT) + 1}`,
        undefined,
        30000,
        `undo_${batchId}_c${Math.floor(i / BATCH_ID_LIMIT)}`
      );
      deletedQuestionIds.push(...chunk);
    }

    // 3. Clean legacy `curriculum_questions` if any exist with this batchId
    if (!isQuotaExhausted()) {
      try {
        const legacyQuery = query(collection(db, "curriculum_questions"), where("importBatchId", "==", batchId));
        const legacySnap = await guardedGetDocs(legacyQuery, "Admin", "Query Legacy MCQs For Undo");
        for (let i = 0; i < legacySnap.docs.length; i += 400) {
          const chunk = legacySnap.docs.slice(i, i + 400);
          const legacyBatch = guardedWriteBatch(db);
          chunk.forEach((d) => legacyBatch.delete(d.ref));
          await promiseWithTimeout(
            legacyBatch.commit("Admin", "Delete Legacy Curriculum Batch", undefined, 30000, `undo_legacy_${batchId}_${i}`),
            30000,
            "Delete Legacy Curriculum Batch"
          );
        }
      } catch (_) {}
    }

    // 4. Delete batch metadata record
    if (!isQuotaExhausted()) {
      try {
        await promiseWithTimeout(
          guardedDeleteDoc(doc(db, "import_batches", batchId), "Admin", "Delete Batch Metadata"),
          30000,
          "Delete Batch Metadata"
        );
      } catch (_) {}
    }

    // 5. Clean local hash registry, localStorage caches, and local user questions store
    const hashRegistry = loadImportedHashRegistry();
    let registryDirty = false;
    deletedQuestionIds.forEach((qId) => {
      if (qId in hashRegistry) {
        delete hashRegistry[qId];
        registryDirty = true;
      }
      try {
        if (typeof localStorage !== "undefined") {
          localStorage.removeItem(`quizpro_mcq_${qId}`);
        }
      } catch {}
    });
    if (registryDirty) {
      saveImportedHashRegistry(hashRegistry);
    }

    try {
      const { loadUserQuestionsStore, saveUserQuestionsStore } = await import("../../utils/questionsStorage");
      const store = loadUserQuestionsStore();
      const delSet = new Set(deletedQuestionIds);
      const filterOut = (arr: any[]) =>
        arr.filter((q) => {
          if (q && delSet.has(q.id)) {
            if (q.topicId) affectedTopicSet.add(q.topicId);
            return false;
          }
          return true;
        });
      store.customQuestions = filterOut(store.customQuestions || []);
      store.cloudCacheQuestions = filterOut(store.cloudCacheQuestions || []);
      saveUserQuestionsStore(store);
    } catch {}

    const affectedTopicIds = Array.from(affectedTopicSet);
    affectedTopicIds.forEach((tId) => {
      try {
        if (typeof localStorage !== "undefined") {
          localStorage.removeItem(`quizpro_mcqs_${tId}`);
        }
      } catch {}
    });

    try {
      const { removeQuestionsFromCache } = await import("../../utils/questionBankCache");
      await removeQuestionsFromCache(deletedQuestionIds, affectedTopicIds).catch(() => {});
    } catch {}

    // 6. Repack or remove affected topic bundles + 1 single version bump
    if (!isQuotaExhausted() && affectedTopicIds.length > 0) {
      try {
        const { saveQuestionBundleForTopic, deleteQuestionBundleFromCloud } = await import("../../utils/questionBundleService");
        for (const tId of affectedTopicIds) {
          if (isQuotaExhausted()) break;
          const remSnap = await guardedGetDocs(
            query(collection(db, "mcqs"), where("topicId", "==", tId)),
            "Admin",
            `Check Remaining MCQs For Bundle [${tId}]`
          ).catch(() => null);
          if (remSnap && !remSnap.empty) {
            const remQs = remSnap.docs.map((d) => ({ ...d.data(), id: d.id } as Question));
            await saveQuestionBundleForTopic(tId, remQs);
          } else {
            await deleteQuestionBundleFromCloud(tId);
          }
        }
      } catch (_) {}
    }

    if (!isQuotaExhausted() && deletedQuestionIds.length > 0) {
      try {
        const { bumpRemoteCurriculumVersion } = await import("../../utils/appVersionService");
        await bumpRemoteCurriculumVersion(affectedTopicIds, undefined, { reason: `undoImport:${batchId}` });
      } catch (_) {}
    }

    console.log(`[MCQ Import] [Undo] Successfully deleted ${deletedQuestionIds.length} questions.`);
    return {
      success: true,
      deletedCount: deletedQuestionIds.length,
      deletedQuestionIds,
      affectedTopicIds,
    };
  } catch (err: any) {
    const formatted = formatFirestoreError(err);
    console.error("[MCQ Import] [Undo] Error:", err);
    return {
      success: false,
      deletedCount: 0,
      deletedQuestionIds: [],
      error: formatted.message,
      errorCode: formatted.code,
    };
  }
};
