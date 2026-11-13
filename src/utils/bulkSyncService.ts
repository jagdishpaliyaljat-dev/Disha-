import { db, isFirebaseConfigured } from "../lib/firebase";
import { collection, doc } from "firebase/firestore";
import {
  guardedWriteBatch,
  guardedGetDocs,
  guardedGetDoc,
  isQuotaExhausted,
  classifyFirestoreError,
  getEffectiveAuthUser,
} from "./quotaTracker";
import { Question, UserQuestionsStore } from "../types";
import { getCombinedSubjects, getCombinedChapters, loadUserQuestionsStore } from "./questionsStorage";
import { ensureStableUniqueDocId } from "./permanentDataIntegrity";
import {
  computeCanonicalHash,
  computeQuestionContentHash,
  fnv1a64Hex,
} from "./contentHash";
import {
  sanitizeLiveTestForPublic,
  buildAnswerKeyDocFromLiveTest,
} from "./liveTestStorage";

/**
 * QuizPro One-Click Firebase Bulk Sync Service (Phase 3 Optimized)
 * - Compares local vs remote records using deterministic canonical content hashes
 * - Detects NEW, MODIFIED, UNCHANGED, and DELETED records
 * - Skips UNCHANGED documents completely (0 wasted writes)
 * - Commits only changed/deleted documents in safe <= 400-op batches
 * - Repacks only dirty topic bundles and performs 1 single curriculum version bump
 */

export interface SyncProgressState {
  status: "idle" | "validating" | "syncing" | "success" | "partial_success" | "error";
  totalRecords: number;
  validRecords: number;
  invalidRecords: number;
  existingRecords: number;
  uploadedRecords: number;
  updatedRecords: number;
  skippedRecords: number;
  deletedRecords?: number;
  failedRecords: number;
  currentBatch: number;
  totalBatches: number;
  progressPercentage: number;
  currentStatusMessage: string;
  errorDetails: string[];
}

export interface SyncReportResult {
  success: boolean;
  status: "success" | "partial_success" | "error";
  totalImported: number;
  created: number;
  updated: number;
  unchanged: number;
  deleted: number;
  skipped: number;
  invalid: number;
  failed: number;
  contentDigest?: string;
  errorDetails: string[];
}

export function estimateFirestoreDocSize(obj: any): number {
  if (!obj) return 0;
  const str = JSON.stringify(obj);
  return Math.ceil(str.length * 1.2);
}

/**
 * Recursively removes properties with `undefined` values from an object or array.
 */
export function sanitizeForFirestore<T>(obj: T): T {
  if (obj === null || obj === undefined) {
    return obj;
  }
  if (typeof obj !== "object") {
    return obj;
  }
  if (
    obj instanceof Date ||
    (obj.constructor && obj.constructor.name !== "Object" && !Array.isArray(obj))
  ) {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj
      .map((item) => sanitizeForFirestore(item))
      .filter((item) => item !== undefined) as unknown as T;
  }
  const cleanObj: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      const sanitized = sanitizeForFirestore(value);
      if (sanitized !== undefined) {
        cleanObj[key] = sanitized;
      }
    }
  }
  return cleanObj as T;
}

export function generateStableId(prefix: string, uniqueString: string): string {
  if (!uniqueString) return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;

  let hash = 0;
  for (let i = 0; i < uniqueString.length; i++) {
    const char = uniqueString.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return `${prefix}_${Math.abs(hash).toString(36)}`;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

interface DiffOperation {
  opKind: "create" | "update" | "delete";
  entityType: "subject" | "chapter" | "question" | "master" | "bundle" | "delete";
  collection: string;
  id: string;
  data?: any;
  topicId?: string;
}

async function fetchRemoteCollectionMap(collName: string): Promise<{ loaded: boolean; map: Map<string, any> }> {
  const map = new Map<string, any>();
  try {
    const snap = await guardedGetDocs(
      collection(db, collName),
      "Admin",
      `Bulk Sync Diff Read [${collName}]`,
      undefined,
      15000,
      true
    );
    if (snap && !snap.empty) {
      snap.docs.forEach((d) => {
        map.set(d.id, { ...d.data(), id: d.id });
      });
    }
    return { loaded: true, map };
  } catch (err) {
    console.warn(`[BulkSync] Could not fetch remote ${collName} for diff:`, err);
    return { loaded: false, map };
  }
}

/**
 * Execute one-click bulk sync with remote-vs-local deterministic hash diffing,
 * safe <= 400-op batches, idempotency keys, targeted bundle repacking,
 * and single version bump.
 */
export async function executeBulkSync(
  storeInput?: UserQuestionsStore,
  onProgress?: (state: SyncProgressState) => void
): Promise<SyncReportResult> {
  const store = storeInput || loadUserQuestionsStore();
  if (!isFirebaseConfigured()) {
    throw new Error("Firebase is not configured with active API keys.");
  }

  const currentUser = getEffectiveAuthUser();
  if (!currentUser) {
    throw new Error("Authentication Required: You must be logged in as an administrator to perform a bulk sync.");
  }

  const emailLower = (currentUser.email || "").trim().toLowerCase();
  const uid = currentUser.uid;
  const { ADMIN_EMAILS, ADMIN_UIDS } = await import("./userProfileStorage");

  const normalizedAdminEmails = ADMIN_EMAILS.map((e) => e.trim().toLowerCase());
  const isAuthorizedEmail = emailLower && normalizedAdminEmails.includes(emailLower);
  const isAuthorizedUID = uid && ADMIN_UIDS.includes(uid);

  if (!isAuthorizedEmail && !isAuthorizedUID) {
    throw new Error(
      `Unauthorized: The account ${emailLower || uid || "unknown"} does not have bulk sync permissions.`
    );
  }

  if (isQuotaExhausted()) {
    throw new Error(
      "Bulk Sync Halted: Firebase daily write quota circuit breaker is active. Your local store is safely preserved; please retry after Pacific midnight reset."
    );
  }

  const subjects = getCombinedSubjects(store);
  const chapters = getCombinedChapters(store);
  const combinedLocalQs = [
    ...(store.customQuestions || []),
    ...Object.values(store.editedQuestions || {}),
  ];

  // Merge editedQuestions overrides cleanly so each question ID appears once with latest content
  const questionCandidateMap = new Map<string, Question>();
  for (const q of combinedLocalQs) {
    if (!q) continue;
    const stableId = ensureStableUniqueDocId(q, q.topicId || "topic_general");
    questionCandidateMap.set(stableId, { ...q, id: stableId });
  }
  const allQuestions = Array.from(questionCandidateMap.values());

  let localPYQs: any[] = [];
  try {
    const { loadLocalPYQPapers } = await import("./pyqStorage");
    localPYQs = loadLocalPYQPapers() || [];
  } catch {}

  let localLiveTests: any[] = [];
  try {
    const { loadLocalLiveTests } = await import("./liveTestStorage");
    localLiveTests = loadLocalLiveTests() || [];
  } catch {}

  let localBanners: any[] = [];
  try {
    const { fetchAllBanners } = await import("./bannerStorage");
    localBanners = (await fetchAllBanners()) || [];
  } catch {}

  const totalRecords =
    subjects.length +
    chapters.length +
    allQuestions.length +
    localPYQs.length +
    localLiveTests.length +
    localBanners.length;

  const state: SyncProgressState = {
    status: "validating",
    totalRecords,
    validRecords: 0,
    invalidRecords: 0,
    existingRecords: 0,
    uploadedRecords: 0,
    updatedRecords: 0,
    skippedRecords: 0,
    deletedRecords: 0,
    failedRecords: 0,
    currentBatch: 0,
    totalBatches: 0,
    progressPercentage: 0,
    currentStatusMessage: "Comparing local records against Cloud Firestore...",
    errorDetails: [],
  };

  const report: SyncReportResult = {
    success: false,
    status: "error",
    totalImported: totalRecords,
    created: 0,
    updated: 0,
    unchanged: 0,
    deleted: 0,
    skipped: 0,
    invalid: 0,
    failed: 0,
    errorDetails: [],
  };

  const updateState = (updates: Partial<SyncProgressState>) => {
    Object.assign(state, updates);
    onProgress?.({ ...state });
  };

  updateState({});

  // Fetch remote collections for true content-hash change detection (no timestamp-only checks)
  const [
    remoteSubjectsRes,
    remoteChaptersRes,
    remoteMcqsRes,
    remotePyqsRes,
    remoteLiveTestsRes,
    remoteBannersRes,
    remoteMetaSnap,
  ] = await Promise.all([
    fetchRemoteCollectionMap("subjects"),
    fetchRemoteCollectionMap("chapters"),
    fetchRemoteCollectionMap("mcqs"),
    fetchRemoteCollectionMap("pyq_papers"),
    fetchRemoteCollectionMap("liveTests"),
    fetchRemoteCollectionMap("banners"),
    guardedGetDoc(doc(db, "metadata", "curriculum"), "Admin", "Bulk Sync Read Curriculum Meta", undefined, 10000, true).catch(
      () => null
    ),
  ]);

  const operations: DiffOperation[] = [];
  const dirtyTopicIds = new Set<string>();
  const deletedTopicIdsSet = new Set<string>(store.deletedTopicIds || []);
  const syncTimestamp = new Date().toISOString();
  const digestParts: string[] = [];

  // 1. Diff Subjects
  const seenSubjectIds = new Set<string>();
  subjects.forEach((s, idx) => {
    if (!s.name?.trim()) {
      report.invalid++;
      report.errorDetails.push(`Subject #${idx + 1}: Missing name.`);
      return;
    }
    const subId = s.id || generateStableId("subj", s.name);
    if (seenSubjectIds.has(subId)) {
      report.skipped++;
      return;
    }
    seenSubjectIds.add(subId);

    const payloadNoTs = sanitizeForFirestore({
      ...s,
      id: subId,
      name: s.name.trim(),
      hindiName: s.hindiName?.trim() || s.name.trim(),
    });
    const localHash = computeCanonicalHash(payloadNoTs);
    digestParts.push(`subj:${subId}:${localHash}`);

    const remoteDoc = remoteSubjectsRes.map.get(subId);
    if (remoteDoc) {
      const remoteHash = remoteDoc.contentHash || computeCanonicalHash(remoteDoc);
      if (remoteHash === localHash) {
        report.unchanged++;
        report.skipped++;
        return;
      }
      operations.push({
        opKind: "update",
        entityType: "subject",
        collection: "subjects",
        id: subId,
        data: { ...payloadNoTs, contentHash: localHash, updatedAt: syncTimestamp },
      });
    } else {
      operations.push({
        opKind: "create",
        entityType: "subject",
        collection: "subjects",
        id: subId,
        data: { ...payloadNoTs, contentHash: localHash, updatedAt: syncTimestamp },
      });
    }
  });

  // 2. Diff Chapters
  const seenChapterIds = new Set<string>();
  chapters.forEach((c, idx) => {
    if (!c.title?.trim()) {
      report.invalid++;
      report.errorDetails.push(`Chapter #${idx + 1}: Missing title.`);
      return;
    }
    const chapId = c.id || generateStableId("chap", c.title);
    if (seenChapterIds.has(chapId)) {
      report.skipped++;
      return;
    }
    seenChapterIds.add(chapId);

    const payloadNoTs = sanitizeForFirestore({
      ...c,
      id: chapId,
      title: c.title.trim(),
      hindiTitle: c.hindiTitle?.trim() || c.title.trim(),
      number: typeof c.number === "number" ? c.number : idx + 1,
      topics: (c.topics || []).map((t, tIdx) => ({
        id: t.id || generateStableId("top", t.title || "unnamed"),
        title: t.title || "Unnamed Topic",
        hindiTitle: t.hindiTitle || t.title || "Unnamed Topic",
        number: typeof t.number === "number" ? t.number : tIdx + 1,
        questionCount: t.questions?.length || 0,
      })),
    });
    const localHash = computeCanonicalHash(payloadNoTs);
    digestParts.push(`chap:${chapId}:${localHash}`);

    const remoteDoc = remoteChaptersRes.map.get(chapId);
    if (remoteDoc) {
      const remoteHash = remoteDoc.contentHash || computeCanonicalHash(remoteDoc);
      if (remoteHash === localHash) {
        report.unchanged++;
        report.skipped++;
        return;
      }
      operations.push({
        opKind: "update",
        entityType: "chapter",
        collection: "chapters",
        id: chapId,
        data: { ...payloadNoTs, contentHash: localHash, updatedAt: syncTimestamp },
      });
    } else {
      operations.push({
        opKind: "create",
        entityType: "chapter",
        collection: "chapters",
        id: chapId,
        data: { ...payloadNoTs, contentHash: localHash, updatedAt: syncTimestamp },
      });
    }
  });

  // 3. Diff MCQs
  const seenQuestionIds = new Set<string>();
  const syncedTopicQuestionPool = new Map<string, Question[]>();
  allQuestions.forEach((q, idx) => {
    const rawText = q.text || (q as any).question || "";
    if (!rawText.trim() || !q.options || q.options.length < 2) {
      report.invalid++;
      report.errorDetails.push(`Question #${idx + 1}: Missing text or insufficient options.`);
      return;
    }

    const qId = ensureStableUniqueDocId(q, q.topicId || "topic_general");
    if (seenQuestionIds.has(qId)) {
      report.skipped++;
      return;
    }
    seenQuestionIds.add(qId);

    const textVal = rawText.trim().substring(0, 1990);
    const optionsVal =
      Array.isArray(q.options) && q.options.length >= 2
        ? q.options.map((o) => String(o || "").substring(0, 500))
        : ["Option A", "Option B"];
    const correctIdxVal =
      typeof q.correctIndex === "number"
        ? q.correctIndex
        : typeof (q as any).correctAnswer === "number"
        ? (q as any).correctAnswer
        : 0;
    const explanationVal = (q.explanation || "No explanation provided.").substring(0, 2990);

    const qAny = q as any;
    const topicIdVal = q.topicId || "topic_general";
    const normalizedQuestion = sanitizeForFirestore({
      ...q,
      id: qId,
      topicId: topicIdVal,
      chapterId: q.chapterId || "chapter_general",
      subjectId: q.subjectId || "economics",
      text: textVal,
      options: optionsVal,
      correctIndex: correctIdxVal,
      explanation: explanationVal,
      ...(qAny.hindiText ? { hindiText: String(qAny.hindiText).substring(0, 1990) } : {}),
      ...(qAny.hindiOptions && Array.isArray(qAny.hindiOptions) ? { hindiOptions: qAny.hindiOptions } : {}),
      ...(qAny.hindiExplanation ? { hindiExplanation: String(qAny.hindiExplanation).substring(0, 2990) } : {}),
      ...(q.difficulty ? { difficulty: q.difficulty } : {}),
    });

    const tList = syncedTopicQuestionPool.get(topicIdVal) || [];
    tList.push(normalizedQuestion as Question);
    syncedTopicQuestionPool.set(topicIdVal, tList);

    const localHash = computeQuestionContentHash(normalizedQuestion);
    digestParts.push(`q:${qId}:${localHash}`);

    const remoteDoc = remoteMcqsRes.map.get(qId);
    if (remoteDoc) {
      const remoteHash = remoteDoc.contentHash || computeQuestionContentHash(remoteDoc);
      if (remoteHash === localHash) {
        report.unchanged++;
        report.skipped++;
        return;
      }
      dirtyTopicIds.add(topicIdVal);
      operations.push({
        opKind: "update",
        entityType: "question",
        collection: "mcqs",
        id: qId,
        topicId: topicIdVal,
        data: { ...normalizedQuestion, contentHash: localHash, updatedAt: syncTimestamp },
      });
    } else {
      dirtyTopicIds.add(topicIdVal);
      operations.push({
        opKind: "create",
        entityType: "question",
        collection: "mcqs",
        id: qId,
        topicId: topicIdVal,
        data: { ...normalizedQuestion, contentHash: localHash, updatedAt: syncTimestamp },
      });
    }
  });

  // 4. Diff PYQ Papers
  const seenPYQIds = new Set<string>();
  localPYQs.forEach((paper) => {
    if (paper && paper.id && paper.title) {
      if (seenPYQIds.has(paper.id)) return;
      seenPYQIds.add(paper.id);

      const paperQuestions = paper.questions || [];
      paperQuestions.forEach((q: any) => {
        const qId = q.id || generateStableId("pyq-q", `${paper.id}-${q.text}`);
        const qPayload = sanitizeForFirestore({ ...q, id: qId, paperId: paper.id });
        const qHash = computeQuestionContentHash(qPayload);
        const remoteQ = remoteMcqsRes.map.get(qId);
        if (remoteQ) {
          const rHash = remoteQ.contentHash || computeQuestionContentHash(remoteQ);
          if (rHash === qHash) {
            report.unchanged++;
            report.skipped++;
            return;
          }
          operations.push({
            opKind: "update",
            entityType: "question",
            collection: "mcqs",
            id: qId,
            data: { ...qPayload, contentHash: qHash, updatedAt: syncTimestamp },
          });
        } else {
          operations.push({
            opKind: "create",
            entityType: "question",
            collection: "mcqs",
            id: qId,
            data: { ...qPayload, contentHash: qHash, updatedAt: syncTimestamp },
          });
        }
      });

      const paperData = sanitizeForFirestore({
        ...paper,
        questions: paperQuestions.map((q: any) => ({ id: q.id })),
        questionCount: paperQuestions.length,
      });
      const pHash = computeCanonicalHash(paperData);
      digestParts.push(`pyq:${paper.id}:${pHash}`);

      const remotePaper = remotePyqsRes.map.get(paper.id);
      if (remotePaper) {
        const rHash = remotePaper.contentHash || computeCanonicalHash(remotePaper);
        if (rHash === pHash) {
          report.unchanged++;
          report.skipped++;
          return;
        }
        operations.push({
          opKind: "update",
          entityType: "master",
          collection: "pyq_papers",
          id: paper.id,
          data: { ...paperData, contentHash: pHash, updatedAt: syncTimestamp },
        });
      } else {
        operations.push({
          opKind: "create",
          entityType: "master",
          collection: "pyq_papers",
          id: paper.id,
          data: { ...paperData, contentHash: pHash, updatedAt: syncTimestamp },
        });
      }
    }
  });

  // 5. Diff Live Tests
  const seenLiveIds = new Set<string>();
  localLiveTests.forEach((test) => {
    if (test && test.id && test.title) {
      if (seenLiveIds.has(test.id)) return;
      seenLiveIds.add(test.id);

      const testQuestions = test.questions || [];
      testQuestions.forEach((q: any) => {
        const qId = q.id || generateStableId("test-q", `${test.id}-${q.text}`);
        const qPayload = sanitizeForFirestore({ ...q, id: qId, testId: test.id });
        const qHash = computeQuestionContentHash(qPayload);
        const remoteQ = remoteMcqsRes.map.get(qId);
        if (remoteQ) {
          const rHash = remoteQ.contentHash || computeQuestionContentHash(remoteQ);
          if (rHash === qHash) {
            report.unchanged++;
            report.skipped++;
            return;
          }
          operations.push({
            opKind: "update",
            entityType: "question",
            collection: "mcqs",
            id: qId,
            data: { ...qPayload, contentHash: qHash, updatedAt: syncTimestamp },
          });
        } else {
          operations.push({
            opKind: "create",
            entityType: "question",
            collection: "mcqs",
            id: qId,
            data: { ...qPayload, contentHash: qHash, updatedAt: syncTimestamp },
          });
        }
      });

      const testData = sanitizeForFirestore(sanitizeLiveTestForPublic({
        ...test,
        questions: testQuestions.map((q: any) => ({ id: q.id })),
        questionCount: testQuestions.length,
      }));
      const tHash = computeCanonicalHash(testData);
      digestParts.push(`lt:${test.id}:${tHash}`);

      const answerKeyDoc = sanitizeForFirestore(buildAnswerKeyDocFromLiveTest(test as any));
      const akHash = computeCanonicalHash(answerKeyDoc);

      const remoteTest = remoteLiveTestsRes.map.get(test.id);
      if (remoteTest) {
        const rHash = remoteTest.contentHash || computeCanonicalHash(remoteTest);
        if (rHash === tHash) {
          report.unchanged++;
          report.skipped++;
          return;
        }
        operations.push({
          opKind: "update",
          entityType: "master",
          collection: "liveTests",
          id: test.id,
          data: { ...testData, contentHash: tHash, updatedAt: syncTimestamp },
        });
      } else {
        operations.push({
          opKind: "create",
          entityType: "master",
          collection: "liveTests",
          id: test.id,
          data: { ...testData, contentHash: tHash, updatedAt: syncTimestamp },
        });
      }

      if (Object.keys(answerKeyDoc.answers || {}).length > 0) {
        operations.push({
          opKind: remoteTest ? "update" : "create",
          entityType: "master",
          collection: "liveTestAnswerKeys",
          id: test.id,
          data: { ...answerKeyDoc, contentHash: akHash, updatedAt: syncTimestamp },
        });
      }
    }
  });

  // 6. Diff Banners
  const seenBannerIds = new Set<string>();
  localBanners.forEach((banner) => {
    if (banner && banner.id && banner.title) {
      if (seenBannerIds.has(banner.id)) return;
      seenBannerIds.add(banner.id);
      const bData = sanitizeForFirestore(banner);
      const bHash = computeCanonicalHash(bData);
      digestParts.push(`ban:${banner.id}:${bHash}`);

      const remoteBan = remoteBannersRes.map.get(banner.id);
      if (remoteBan) {
        const rHash = remoteBan.contentHash || computeCanonicalHash(remoteBan);
        if (rHash === bHash) {
          report.unchanged++;
          report.skipped++;
          return;
        }
        operations.push({
          opKind: "update",
          entityType: "master",
          collection: "banners",
          id: banner.id,
          data: { ...bData, contentHash: bHash, updatedAt: syncTimestamp },
        });
      } else {
        operations.push({
          opKind: "create",
          entityType: "master",
          collection: "banners",
          id: banner.id,
          data: { ...bData, contentHash: bHash, updatedAt: syncTimestamp },
        });
      }
    }
  });

  // 7. Detect Deleted Records (explicitly deleted IDs that still exist in remote or orphaned under deleted hierarchy)
  const queueDeleteIfRemoteExists = (
    coll: string,
    id: string,
    remoteRes: { loaded: boolean; map: Map<string, any> },
    topicId?: string
  ) => {
    if (!id) return;
    if (remoteRes.loaded && !remoteRes.map.has(id)) {
      return; // Already absent remotely -> 0 wasted delete writes
    }
    if (topicId) dirtyTopicIds.add(topicId);
    digestParts.push(`del:${coll}:${id}`);
    operations.push({
      opKind: "delete",
      entityType: "delete",
      collection: coll,
      id,
    });
  };

  (store.deletedQuestionIds || []).forEach((id) => {
    const remoteQ = remoteMcqsRes.map.get(id);
    queueDeleteIfRemoteExists("mcqs", id, remoteMcqsRes, remoteQ?.topicId);
  });
  (store.deletedSubjectIds || []).forEach((id) => {
    queueDeleteIfRemoteExists("subjects", id, remoteSubjectsRes);
  });
  (store.deletedChapterIds || []).forEach((id) => {
    queueDeleteIfRemoteExists("chapters", id, remoteChaptersRes);
  });
  deletedTopicIdsSet.forEach((id) => {
    operations.push({
      opKind: "delete",
      entityType: "delete",
      collection: "topics",
      id,
    });
    operations.push({
      opKind: "delete",
      entityType: "delete",
      collection: "question_bundles",
      id: `topic_${id}`,
    });
    digestParts.push(`del:topic:${id}`);
  });

  // Also detect remote questions belonging to deleted subjects/chapters/topics or deleted locally without explicit deletedQuestionIds entry
  const deletedSubSet = new Set(store.deletedSubjectIds || []);
  const deletedChapSet = new Set(store.deletedChapterIds || []);
  if (remoteMcqsRes.loaded) {
    for (const [remoteId, rDoc] of remoteMcqsRes.map.entries()) {
      const orphanedByParent =
        (rDoc.subjectId && deletedSubSet.has(rDoc.subjectId)) ||
        (rDoc.chapterId && deletedChapSet.has(rDoc.chapterId)) ||
        (rDoc.topicId && deletedTopicIdsSet.has(rDoc.topicId));
      if (orphanedByParent && !operations.some((o) => o.collection === "mcqs" && o.id === remoteId)) {
        if (rDoc.topicId) dirtyTopicIds.add(rDoc.topicId);
        digestParts.push(`del:mcqs:${remoteId}`);
        operations.push({ opKind: "delete", entityType: "delete", collection: "mcqs", id: remoteId });
      }
    }
  }

  try {
    const { getDeletedPYQIds } = await import("./pyqStorage");
    getDeletedPYQIds().forEach((id) => queueDeleteIfRemoteExists("pyq_papers", id, remotePyqsRes));
  } catch {}

  try {
    const { getDeletedLiveTestIds } = await import("./liveTestStorage");
    getDeletedLiveTestIds().forEach((id) => {
      queueDeleteIfRemoteExists("liveTests", id, remoteLiveTestsRes);
      if (remoteLiveTestsRes.map.has(id)) {
        operations.push({
          opKind: "delete",
          entityType: "delete",
          collection: "liveTestAnswerKeys",
          id,
        });
      }
    });
  } catch {}

  try {
    const { getDeletedBannerIds } = await import("./bannerStorage");
    getDeletedBannerIds().forEach((id) => queueDeleteIfRemoteExists("banners", id, remoteBannersRes));
  } catch {}

  // 8. Metadata Document — only update if curriculum summary changed OR entity writes exist
  const masterStructure = sanitizeForFirestore({
    subjectIds: Array.from(seenSubjectIds).sort(),
    chapterIds: Array.from(seenChapterIds).sort(),
    totalQuestions: seenQuestionIds.size,
    deletedSubjectIds: (store.deletedSubjectIds || []).slice().sort(),
    deletedChapterIds: (store.deletedChapterIds || []).slice().sort(),
    deletedQuestionIds: (store.deletedQuestionIds || []).slice().sort(),
    deletedTopicIds: (store.deletedTopicIds || []).slice().sort(),
    version: "2.2.0",
  });
  const masterHash = computeCanonicalHash(masterStructure);
  const remoteMetaData = remoteMetaSnap?.exists() ? (remoteMetaSnap.data() as any) : null;
  const remoteMasterHash = remoteMetaData?.contentHash || (remoteMetaData ? computeCanonicalHash(remoteMetaData) : null);

  if (remoteMasterHash !== masterHash) {
    operations.push({
      opKind: remoteMetaData ? "update" : "create",
      entityType: "master",
      collection: "metadata",
      id: "curriculum",
      data: {
        ...masterStructure,
        contentHash: masterHash,
        lastSyncAt: syncTimestamp,
        syncUser: currentUser.email || "admin@disha2020.in",
      },
    });
  } else {
    report.unchanged++;
    report.skipped++;
  }

  const syncContentDigest = fnv1a64Hex(digestParts.sort().join("|"));
  report.contentDigest = syncContentDigest;

  // Early 0-write exit when nothing changed
  if (operations.length === 0) {
    report.success = report.invalid === 0;
    report.status = report.success ? "success" : "partial_success";
    updateState({
      status: report.status,
      validRecords: 0,
      invalidRecords: report.invalid,
      existingRecords: report.unchanged,
      skippedRecords: report.skipped,
      uploadedRecords: 0,
      updatedRecords: 0,
      deletedRecords: 0,
      failedRecords: 0,
      currentBatch: 0,
      totalBatches: 0,
      progressPercentage: 100,
      currentStatusMessage: `Cloud & local data are already in sync (${report.unchanged} unchanged records skipped, 0 writes).`,
      errorDetails: report.errorDetails,
    });
    return report;
  }

  // Deduplicate operations by (collection, id) keeping latest
  const dedupedOpsMap = new Map<string, DiffOperation>();
  for (const op of operations) {
    dedupedOpsMap.set(`${op.collection}/${op.id}`, op);
  }
  const finalOperations = Array.from(dedupedOpsMap.values());

  const validOpsCount = finalOperations.length;
  updateState({
    validRecords: validOpsCount,
    invalidRecords: report.invalid,
    existingRecords: report.unchanged,
    skippedRecords: report.skipped,
    errorDetails: report.errorDetails,
  });

  // Strict <= 400 ops batch limit (safe margin under Firestore's 500 hard ceiling)
  const BATCH_SIZE = 400;
  const totalBatches = Math.ceil(validOpsCount / BATCH_SIZE) || 1;
  updateState({ status: "syncing", totalBatches });

  let actualCreated = 0;
  let actualUpdated = 0;
  let actualDeleted = 0;
  let actualFailed = 0;
  let abortedByQuota = false;

  for (let b = 0; b < totalBatches; b++) {
    const chunk = finalOperations.slice(b * BATCH_SIZE, (b + 1) * BATCH_SIZE);
    if (chunk.length === 0) continue;

    if (abortedByQuota || isQuotaExhausted()) {
      abortedByQuota = true;
      actualFailed += chunk.length;
      if (!report.errorDetails.some((d) => d.includes("Circuit breaker"))) {
        report.errorDetails.push(
          `Batch ${b + 1}: Circuit breaker active — remaining writes halted & preserved locally.`
        );
      }
      updateState({
        uploadedRecords: actualCreated,
        updatedRecords: actualUpdated,
        deletedRecords: actualDeleted,
        failedRecords: actualFailed,
        progressPercentage: Math.round(((b + 1) / totalBatches) * 100),
      });
      continue;
    }

    updateState({
      currentBatch: b + 1,
      currentStatusMessage: `Syncing changed batch ${b + 1} of ${totalBatches} (${chunk.length} ops, ${report.unchanged} unchanged skipped)...`,
    });

    let success = false;
    let attempts = 0;
    const maxAttempts = 3;
    const chunkHash = fnv1a64Hex(chunk.map((c) => `${c.opKind}:${c.collection}/${c.id}`).join("|"));
    const batchIdempotencyKey = `bulksync_${syncContentDigest}_b${b}_${chunkHash}`;

    while (!success && attempts < maxAttempts) {
      if (isQuotaExhausted()) {
        abortedByQuota = true;
        actualFailed += chunk.length;
        report.errorDetails.push(`Batch ${b + 1} halted: Quota circuit breaker tripped.`);
        break;
      }

      attempts++;
      try {
        const batch = guardedWriteBatch(db);
        chunk.forEach((op) => {
          const docRef = doc(db, op.collection, op.id);
          if (op.opKind === "delete") {
            batch.delete(docRef);
          } else {
            batch.set(docRef, op.data, { merge: true });
          }
        });

        await batch.commit(
          "Admin",
          `Bulk Sync Diff Batch ${b + 1}/${totalBatches}`,
          undefined,
          30000,
          batchIdempotencyKey
        );
        success = true;

        chunk.forEach((op) => {
          if (op.opKind === "delete") actualDeleted++;
          else if (op.opKind === "update") actualUpdated++;
          else actualCreated++;
        });
      } catch (err: any) {
        const errInfo = classifyFirestoreError(err);
        console.error(`Sync Error (Batch ${b + 1}, Attempt ${attempts}, Code ${errInfo.code}):`, err);

        if (errInfo.isQuotaError || isQuotaExhausted()) {
          abortedByQuota = true;
          actualFailed += chunk.length;
          report.errorDetails.push(`Batch ${b + 1} quota-exhausted: ${errInfo.message}`);
          break;
        }

        if (errInfo.isTimeout || errInfo.isPermanent) {
          actualFailed += chunk.length;
          report.errorDetails.push(
            `Batch ${b + 1} ${errInfo.isTimeout ? "timed out (queued safely)" : "fatal error"}: ${errInfo.message}`
          );
          break;
        }

        if (attempts >= maxAttempts) {
          actualFailed += chunk.length;
          report.errorDetails.push(`Batch ${b + 1} failed after ${maxAttempts} attempts: ${errInfo.message}`);
        } else {
          await sleep(Math.pow(2, attempts) * 200);
        }
      }
    }

    updateState({
      uploadedRecords: actualCreated,
      updatedRecords: actualUpdated,
      deletedRecords: actualDeleted,
      failedRecords: actualFailed,
      progressPercentage: Math.round(((b + 1) / totalBatches) * 100),
    });

    await sleep(5);
  }

  const totalMutated = actualCreated + actualUpdated + actualDeleted;
  report.created = actualCreated;
  report.updated = actualUpdated;
  report.deleted = actualDeleted;
  report.failed = actualFailed;
  report.success = actualFailed === 0 && report.invalid === 0;
  report.status = report.success ? "success" : totalMutated > 0 ? "partial_success" : "error";

  // Repack ONLY dirty topics and perform ONE version bump when actual writes occurred
  const dirtyTopicsList = Array.from(dirtyTopicIds).filter((t) => !deletedTopicIdsSet.has(t));
  if (totalMutated > 0 && !abortedByQuota && !isQuotaExhausted()) {
    if (dirtyTopicsList.length > 0) {
      try {
        const { packAllQuestionsIntoTopicBundles } = await import("./questionBundleService");
        const questionsForDirtyTopics = dirtyTopicsList.flatMap(
          (tid) => syncedTopicQuestionPool.get(tid) || []
        );
        if (questionsForDirtyTopics.length > 0) {
          await packAllQuestionsIntoTopicBundles(questionsForDirtyTopics, undefined, {
            onlyTopicIds: dirtyTopicsList,
          }).catch(() => {});
        }
      } catch {}
    }

    try {
      const { bumpRemoteCurriculumVersion } = await import("./appVersionService");
      await bumpRemoteCurriculumVersion(
        dirtyTopicsList.length > 0 ? dirtyTopicsList : ["bulk_sync"],
        undefined,
        { contentDigest: syncContentDigest, reason: "bulk_sync" }
      ).catch(() => {});
    } catch {}
  }

  updateState({
    status: report.status,
    progressPercentage: 100,
    currentStatusMessage: report.success
      ? `Sync complete: ${actualCreated} created, ${actualUpdated} updated, ${actualDeleted} deleted (${report.unchanged} unchanged skipped).`
      : `Sync completed with issues: ${totalMutated} synced, ${actualFailed} failed.`,
  });

  return report;
}
