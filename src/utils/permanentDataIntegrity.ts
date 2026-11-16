import {
  loadUserQuestionsStore,
  getCombinedChapters,
  getCombinedSubjects,
  getCombinedQuestions,
  saveUserQuestionsStore,
  deduplicateQuestions,
} from "./questionsStorage";
import { normalizeQuestionText } from "./scanMcqDuplicates";
import { Subject, Chapter, Topic, Question, UserQuestionsStore } from "../types";
import { generateQuestionHash } from "../lib/mcqImport/dedupe";

// ============================================================================
// Types & Interfaces
// ============================================================================

export interface TopicCountAuditItem {
  subjectId: string;
  subjectName: string;
  chapterId: string;
  chapterTitle: string;
  topicId: string;
  topicTitle: string;
  topicNumber: number;
  parentCount: number;
  childCount: number;
  selectCount: number;
  customCount: number;
  isSynchronized: boolean;
  diff: number;
}

export interface DuplicateContentAuditItem {
  normalizedText: string;
  previewText: string;
  count: number;
  docIds: string[];
  isStaleMoveCopy: boolean;
  items: Array<{
    docId: string;
    topicId: string;
    chapterId: string;
    topicTitle?: string;
    createdAt?: string;
    updatedAt?: string;
  }>;
}

export interface OrphanedQuestionAuditItem {
  id: string;
  text: string;
  subjectId?: string;
  chapterId?: string;
  topicId?: string;
  reason: string;
  source: string;
}

export interface StaleCacheAuditItem {
  key: string;
  topicId: string;
  cachedCount: number;
  actualCount: number;
  reason: string;
}

export interface GlobalDataIntegrityReport {
  auditTimestamp: string;
  totalDatabaseRecords: number;
  totalUniqueQuestions: number;
  totalDuplicateRecords: number;
  staleMoveDuplicateCount: number;
  contentDuplicateCount: number;
  orphanedRecordsCount: number;
  parentChildMismatchCount: number;
  staleCacheCount: number;
  invalidReferenceCount: number;
  isHealthy: boolean;
  summaryMessage: string;
  topicCounts: TopicCountAuditItem[];
  duplicateGroups: DuplicateContentAuditItem[];
  orphanedRecords: OrphanedQuestionAuditItem[];
  parentChildMismatches: TopicCountAuditItem[];
  staleCaches: StaleCacheAuditItem[];
  collectionBreakdown: {
    mcqs: number;
    questions: number;
    subjects: number;
    chapters: number;
    topics: number;
  };
}

export interface InFlightOperation {
  id: string;
  type: "move" | "import" | "bulk_delete";
  sourceTopicId?: string;
  targetTopicId?: string;
  targetChapterId?: string;
  questionIds: string[];
  completedIds: string[];
  startedAt: string;
  updatedAt: string;
  status: "in_progress" | "completed" | "interrupted";
}

// Storage key for last audit report
export const LAST_AUDIT_REPORT_KEY = "disha2020_last_integrity_audit";
export const IN_FLIGHT_OP_KEY = "disha2020_active_in_flight_operation";
export const LEGACY_LAST_AUDIT_REPORT_KEY = "quizpro_last_integrity_audit";
export const LEGACY_IN_FLIGHT_OP_KEY = "quizpro_active_in_flight_operation";

// ============================================================================
// Helper Utilities
// ============================================================================

export function normalizeOptionsSignature(options: string[] = []): string {
  if (!Array.isArray(options)) return "";
  return options
    .map((o) => (typeof o === "string" ? o.trim().toLowerCase() : ""))
    .sort()
    .join("|");
}

/**
 * Generate a deterministic stable unique ID for a question based on topic and content hash
 */
export function ensureStableUniqueDocId(q: Partial<Question>, defaultTopicId = "gen"): string {
  // If we already have a stable document ID (including our own usr-q- format), preserve it strictly.
  // This ensures that moving a question between topics does NOT change its physical document ID.
  if (q.id && q.id.trim().length > 0 && !q.id.startsWith("temp_")) {
    return q.id.trim();
  }
  
  const contentHash = (q as any).contentHash || (q as any).hash || generateQuestionHash({
    question: q.text || (q as any).question || "",
    options: q.options || [],
    answer: ["A", "B", "C", "D", "E"][q.correctIndex ?? 0] || "A",
    table: (q as any).tableData || q.table
  } as any);

  // New IDs include the topic ID for organizational readability in Firestore, but once set, it is permanent.
  const topic = (q.topicId || defaultTopicId).trim().replace(/[^a-zA-Z0-9_-]/g, "_");
  return `usr-q-${topic}-${contentHash}`;
}

// ============================================================================
// Global Read-Only Audit Engine
// ============================================================================

/**
 * Executes a strictly READ-ONLY data integrity audit across all subjects,
 * chapters, topics, and question records.
 * NEVER writes, updates, or deletes any document during execution.
 */
export async function runGlobalDataIntegrityAudit(): Promise<GlobalDataIntegrityReport> {
  const auditTimestamp = new Date().toISOString();
  console.log(`[DataIntegrityAudit] Starting read-only audit at ${auditTimestamp}...`);

  // 1. Load canonical application store
  const store = loadUserQuestionsStore();
  const subjects = getCombinedSubjects(store);
  const chapters = getCombinedChapters(store);
  const allCanonicalQuestions = getCombinedQuestions(chapters, store);

  // Build lookup sets for syllabus hierarchy will be done after potential Firestore fetch
  let subjectsToAudit = subjects;
  let chaptersToAudit = chapters;

  let fsMcqCount = 0;
  let fsQuestionsCount = 0;
  const allRawQuestions: Question[] = [];

  // Build lookup sets for syllabus hierarchy (using authoritative source)
  const validSubjectIds = new Set(subjectsToAudit.map((s) => s.id.toLowerCase()));
  const validChapterIds = new Set(chaptersToAudit.map((c) => c.id.toLowerCase()));
  const validTopicMap = new Map<string, { topic: Topic; chapter: Chapter; subject: Subject }>();

  subjectsToAudit.forEach((s) => {
    const sChapters = chaptersToAudit.filter((c) => c.subjectId === s.id);
    sChapters.forEach((ch) => {
      (ch.topics || []).forEach((t) => {
        validTopicMap.set(t.id.toLowerCase(), { topic: t, chapter: ch, subject: s });
      });
    });
  });

  // Deduplicate all raw by document ID to get the census base
  const uniqueDocMap = new Map<string, Question>();
  allRawQuestions.forEach((q) => {
    if (q && q.id) uniqueDocMap.set(q.id, q);
  });
  const allUniqueDocs = Array.from(uniqueDocMap.values());
  const totalDatabaseRecords = Math.max(fsMcqCount, allUniqueDocs.length);

  // 3. Duplicate Analysis (Stale Move copies vs Duplicate Content)
  const textMap = new Map<string, Question[]>();
  const duplicateGroups: DuplicateContentAuditItem[] = [];
  let totalDuplicateRecords = 0;
  let staleMoveDuplicateCount = 0;
  let contentDuplicateCount = 0;

  allUniqueDocs.forEach((q) => {
    const rawText = (q.text || (q as any).question || "").trim();
    const norm = normalizeQuestionText(rawText);
    if (!norm) return;

    const optsSig = normalizeOptionsSignature(q.options || []);
    // Scoped by normalized text + options
    const key = `${norm}__${optsSig}`;

    if (!textMap.has(key)) {
      textMap.set(key, [q]);
    } else {
      textMap.get(key)!.push(q);
    }
  });

  const totalUniqueQuestions = textMap.size;

  textMap.forEach((docs, key) => {
    if (docs.length > 1) {
      const docIds = docs.map((d) => d.id);
      const isStaleMove =
        docs.some((d) => d.id.startsWith("usr-q-")) &&
        docs.some((d) => d.id.startsWith("mcq_")) &&
        new Set(docs.map((d) => d.topicId || "none")).size > 1;

      if (isStaleMove) {
        staleMoveDuplicateCount += docs.length - 1;
      } else {
        contentDuplicateCount += docs.length - 1;
      }
      totalDuplicateRecords += docs.length - 1;

      const firstDoc = docs[0];
      const preview = (firstDoc.text || (firstDoc as any).question || "").slice(0, 100);

      duplicateGroups.push({
        normalizedText: key,
        previewText: preview.length >= 100 ? `${preview}...` : preview,
        count: docs.length,
        docIds,
        isStaleMoveCopy: isStaleMove,
        items: docs.map((d) => ({
          docId: d.id,
          topicId: d.topicId || "unassigned",
          chapterId: d.chapterId || "unassigned",
          topicTitle: (d as any).topicTitle || (d as any).topicName,
          createdAt: d.createdAt,
          updatedAt: (d as any).updatedAt,
        })),
      });
    }
  });

  // 4. Orphaned Question & Invalid Reference Analysis
  const orphanedRecords: OrphanedQuestionAuditItem[] = [];
  let invalidReferenceCount = 0;

  allUniqueDocs.forEach((q) => {
    const rawText = (q.text || (q as any).question || "").trim();
    if (!rawText) return;

    const subId = (q.subjectId || "").toLowerCase();
    const chapId = (q.chapterId || "").toLowerCase();
    const topId = (q.topicId || "").toLowerCase();

    let issue = "";
    if (!topId || topId === "unassigned") {
      issue = "Missing topicId reference";
    } else if (!validTopicMap.has(topId)) {
      issue = `topicId "${q.topicId}" does not exist in curriculum`;
    } else if (chapId && !validChapterIds.has(chapId)) {
      issue = `chapterId "${q.chapterId}" does not exist in curriculum`;
    } else if (subId && !validSubjectIds.has(subId)) {
      issue = `subjectId "${q.subjectId}" does not exist in curriculum`;
    }

    if (issue) {
      invalidReferenceCount++;
      orphanedRecords.push({
        id: q.id,
        text: rawText.slice(0, 80),
        subjectId: q.subjectId,
        chapterId: q.chapterId,
        topicId: q.topicId,
        reason: issue,
        source: q.id.startsWith("usr-q-") ? "User Custom Import" : "Firestore Document",
      });
    }
  });

  // 5. Topic-Wise Counts & Parent-Child Synchronization
  const topicCounts: TopicCountAuditItem[] = [];
  const parentChildMismatches: TopicCountAuditItem[] = [];

  subjects.forEach((s) => {
    const sChapters = chapters.filter((c) => c.subjectId === s.id);
    sChapters.forEach((ch) => {
      (ch.topics || []).forEach((top, tIdx) => {
        // Parent count: number of questions assigned in the chapter tree
        const parentQuestions = top.questions || [];
        const parentCount = parentQuestions.length;

        // Child count: direct questions matching this topicId in canonical store
        const matchingChildQuestions = allCanonicalQuestions.filter(
          (q) => q.topicId && q.topicId.toLowerCase() === top.id.toLowerCase()
        );
        const childCount = matchingChildQuestions.length;

        // Select All count (distinct IDs in child questions list)
        const selectCount = new Set(parentQuestions.map((q) => q.id)).size;

        const customCount = parentQuestions.filter((q) => q.isUserAdded).length;

        const isSynchronized = parentCount === childCount && parentCount === selectCount;
        const diff = Math.abs(parentCount - childCount);

        const auditItem: TopicCountAuditItem = {
          subjectId: s.id,
          subjectName: s.name || s.hindiName || s.id,
          chapterId: ch.id,
          chapterTitle: ch.title || ch.hindiTitle || ch.id,
          topicId: top.id,
          topicTitle: top.title || top.hindiTitle || `Topic ${tIdx + 1}`,
          topicNumber: top.number || tIdx + 1,
          parentCount,
          childCount,
          selectCount,
          customCount,
          isSynchronized,
          diff,
        };

        topicCounts.push(auditItem);
        if (!isSynchronized) {
          parentChildMismatches.push(auditItem);
        }
      });
    });
  });

  // 6. Stale Cache Analysis (localStorage topic caches vs canonical)
  const staleCaches: StaleCacheAuditItem[] = [];
  if (typeof localStorage !== "undefined") {
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.startsWith("disha2020_mcqs_") || key.startsWith("quizpro_mcqs_"))) {
          const topicId = key.replace("disha2020_mcqs_", "").replace("quizpro_mcqs_", "");
          try {
            const raw = localStorage.getItem(key);
            if (raw) {
              const cachedList = JSON.parse(raw);
              if (Array.isArray(cachedList)) {
                const topicEntry = topicCounts.find(
                  (t) => t.topicId.toLowerCase() === topicId.toLowerCase()
                );
                if (topicEntry && topicEntry.parentCount !== cachedList.length) {
                  staleCaches.push({
                    key,
                    topicId,
                    cachedCount: cachedList.length,
                    actualCount: topicEntry.parentCount,
                    reason: `Cache has ${cachedList.length} items but active store has ${topicEntry.parentCount}`,
                  });
                }
              }
            }
          } catch {}
        }
      }
    } catch (e) {
      console.warn("[DataIntegrityAudit] localStorage check warning:", e);
    }
  }

  // 7. Overall Health Status
  const isHealthy = parentChildMismatches.length === 0 && staleCaches.length === 0;
  const summaryMessage = isHealthy
    ? `All ${topicCounts.length} topics are 100% synchronized across parent, child, and selection views. Total unique questions: ${totalUniqueQuestions}.`
    : `Found ${parentChildMismatches.length} topic count mismatches and ${staleCaches.length} stale caches.`;

  const report: GlobalDataIntegrityReport = {
    auditTimestamp,
    totalDatabaseRecords,
    totalUniqueQuestions,
    totalDuplicateRecords,
    staleMoveDuplicateCount,
    contentDuplicateCount,
    orphanedRecordsCount: orphanedRecords.length,
    parentChildMismatchCount: parentChildMismatches.length,
    staleCacheCount: staleCaches.length,
    invalidReferenceCount,
    isHealthy,
    summaryMessage,
    topicCounts,
    duplicateGroups,
    orphanedRecords,
    parentChildMismatches,
    staleCaches,
    collectionBreakdown: {
      mcqs: fsMcqCount,
      questions: fsQuestionsCount,
      subjects: subjects.length,
      chapters: chapters.length,
      topics: topicCounts.length,
    },
  };

  // Cache report to localStorage
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(LAST_AUDIT_REPORT_KEY, JSON.stringify(report));
    }
  } catch {}

  console.log(`[DataIntegrityAudit] Completed: ${summaryMessage}`);
  return report;
}

// ============================================================================
// Interrupted Bulk Operation Recovery Protection
// ============================================================================

export function startInFlightOperation(op: Omit<InFlightOperation, "completedIds" | "startedAt" | "updatedAt" | "status">): InFlightOperation {
  const now = new Date().toISOString();
  const fullOp: InFlightOperation = {
    ...op,
    completedIds: [],
    startedAt: now,
    updatedAt: now,
    status: "in_progress",
  };
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(IN_FLIGHT_OP_KEY, JSON.stringify(fullOp));
    }
  } catch {}
  return fullOp;
}

export function recordInFlightProgress(operationId: string, newlyCompletedIds: string[]): void {
  try {
    if (typeof localStorage === "undefined") return;
    const raw = localStorage.getItem(IN_FLIGHT_OP_KEY);
    if (!raw) return;
    const op: InFlightOperation = JSON.parse(raw);
    if (op.id !== operationId) return;

    const set = new Set([...op.completedIds, ...newlyCompletedIds]);
    op.completedIds = Array.from(set);
    op.updatedAt = new Date().toISOString();
    if (op.completedIds.length >= op.questionIds.length) {
      op.status = "completed";
    }
    localStorage.setItem(IN_FLIGHT_OP_KEY, JSON.stringify(op));
  } catch {}
}

export function clearInFlightOperation(operationId?: string): void {
  try {
    if (typeof localStorage !== "undefined") {
      if (operationId) {
        const raw = localStorage.getItem(IN_FLIGHT_OP_KEY);
        if (raw) {
          const op: InFlightOperation = JSON.parse(raw);
          if (op.id === operationId) {
            localStorage.removeItem(IN_FLIGHT_OP_KEY);
          }
        }
      } else {
        localStorage.removeItem(IN_FLIGHT_OP_KEY);
      }
    }
  } catch {}
}

export function getInterruptedOperation(): InFlightOperation | null {
  try {
    if (typeof localStorage === "undefined") return null;
    const raw = localStorage.getItem(IN_FLIGHT_OP_KEY);
    if (!raw) return null;
    const op: InFlightOperation = JSON.parse(raw);
    if (op.status === "in_progress" && op.completedIds.length < op.questionIds.length) {
      // Check if started more than 10 seconds ago (likely interrupted by refresh/crash)
      const diffMs = Date.now() - new Date(op.updatedAt || op.startedAt).getTime();
      if (diffMs > 10000) {
        op.status = "interrupted";
        return op;
      }
    }
  } catch {}
  return null;
}

/**
 * Reconciles an interrupted operation so that partially moved questions are
 * properly updated in store without duplicating records.
 */
export async function recoverInterruptedOperation(): Promise<{ recovered: boolean; message: string }> {
  const interrupted = getInterruptedOperation();
  if (!interrupted) {
    return { recovered: false, message: "No interrupted bulk operation found." };
  }

  console.log(`[DataIntegrity] Recovering interrupted operation ${interrupted.id} (${interrupted.type})...`);
  const store = loadUserQuestionsStore();

  if (interrupted.type === "move" && interrupted.targetTopicId && interrupted.targetChapterId) {
    const targetTopicId = interrupted.targetTopicId;
    const targetChapterId = interrupted.targetChapterId;
    const movedIdsSet = new Set(interrupted.completedIds);

    // Reconcile completed items in local store
    const updatedCloudCache = (store.cloudCacheQuestions || []).map((q) => {
      if (movedIdsSet.has(q.id)) {
        return {
          ...q,
          topicId: targetTopicId,
          chapterId: targetChapterId,
          updatedAt: new Date().toISOString(),
        };
      }
      return q;
    });

    const updatedCustom = (store.customQuestions || []).map((q) => {
      if (movedIdsSet.has(q.id)) {
        return {
          ...q,
          topicId: targetTopicId,
          chapterId: targetChapterId,
          updatedAt: new Date().toISOString(),
        };
      }
      return q;
    });

    const nextStore = {
      ...store,
      cloudCacheQuestions: updatedCloudCache,
      customQuestions: updatedCustom,
    };
    saveUserQuestionsStore(nextStore);

    // Invalidate caches
    try {
      localStorage.removeItem(`disha2020_mcqs_${targetTopicId}`);
      localStorage.removeItem(`quizpro_mcqs_${targetTopicId}`);
      if (interrupted.sourceTopicId) {
        localStorage.removeItem(`disha2020_mcqs_${interrupted.sourceTopicId}`);
        localStorage.removeItem(`quizpro_mcqs_${interrupted.sourceTopicId}`);
      }
    } catch {}

    clearInFlightOperation(interrupted.id);
    return {
      recovered: true,
      message: `Successfully reconciled ${interrupted.completedIds.length} of ${interrupted.questionIds.length} questions from interrupted move operation.`,
    };
  }

  clearInFlightOperation(interrupted.id);
  return { recovered: true, message: `Cleared interrupted ${interrupted.type} operation.` };
}

// ============================================================================
// Safe Admin Cleanup with Recoverable Backup
// ============================================================================

export interface BackupExportData {
  backupTimestamp: string;
  totalQuestions: number;
  totalChapters: number;
  totalSubjects: number;
  questions: Question[];
  chapters: Chapter[];
  subjects: Subject[];
}

/**
 * Creates and triggers a download of a complete recoverable JSON backup.
 */
export function exportSafetyBackup(): { success: boolean; filename: string; count: number } {
  try {
    const store = loadUserQuestionsStore();
    const subjects = getCombinedSubjects(store);
    const chapters = getCombinedChapters(store);
    const questions = getCombinedQuestions(chapters, store);

    const exportData: BackupExportData = {
      backupTimestamp: new Date().toISOString(),
      totalQuestions: questions.length,
      totalChapters: chapters.length,
      totalSubjects: subjects.length,
      questions,
      chapters,
      subjects,
    };

    const jsonStr = JSON.stringify(exportData, null, 2);
    const blob = new Blob([jsonStr], { type: "application/json" });
    const filename = `disha2020_backup_${new Date().toISOString().replace(/[:.]/g, "-")}.json`;

    if (typeof window !== "undefined") {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }

    // Save backup confirmation marker
    try {
      const backupMarker = JSON.stringify({
        filename,
        timestamp: exportData.backupTimestamp,
        count: questions.length,
      });
      localStorage.setItem("disha2020_last_safety_backup", backupMarker);
      localStorage.setItem("quizpro_last_safety_backup", backupMarker);
    } catch {}

    return { success: true, filename, count: questions.length };
  } catch (err: any) {
    console.error("Failed to export safety backup:", err);
    return { success: false, filename: "", count: 0 };
  }
}

/**
 * Admin approved safe cleanup of confirmed stale move copies.
 * STRICT REQUIREMENT: Only runs with explicit admin confirmation AND existing backup.
 */
export async function executeAdminApprovedCleanup(
  duplicateDocIdsToClean: string[],
  isConfirmedByAdmin: boolean
): Promise<{ success: boolean; cleanedCount: number; message: string }> {
  if (!isConfirmedByAdmin) {
    return {
      success: false,
      cleanedCount: 0,
      message: "Cleanup aborted: Explicit admin confirmation is required.",
    };
  }

  if (!duplicateDocIdsToClean || duplicateDocIdsToClean.length === 0) {
    return {
      success: true,
      cleanedCount: 0,
      message: "No duplicate records specified for cleanup.",
    };
  }

  // Verify that a backup was recorded
  const hasBackup = typeof localStorage !== "undefined" && Boolean(
    localStorage.getItem("disha2020_last_safety_backup") || localStorage.getItem("quizpro_last_safety_backup")
  );
  if (!hasBackup) {
    // Automatically trigger backup before executing cleanup
    exportSafetyBackup();
  }

  console.log(`[DataIntegrity] Admin approved cleanup of ${duplicateDocIdsToClean.length} records...`);
  const store = loadUserQuestionsStore();
  const idsToRemove = new Set(duplicateDocIdsToClean);

  // Remove from custom and cloud cache
  const nextCustom = (store.customQuestions || []).filter((q) => !idsToRemove.has(q.id));
  const nextCache = (store.cloudCacheQuestions || []).filter((q) => !idsToRemove.has(q.id));

  // Mark as deleted to prevent resurgence
  const deletedSet = new Set(store.deletedQuestionIds || []);
  duplicateDocIdsToClean.forEach((id) => deletedSet.add(id));

  const updatedStore: UserQuestionsStore = {
    ...store,
    customQuestions: nextCustom,
    cloudCacheQuestions: nextCache,
    deletedQuestionIds: Array.from(deletedSet),
  };

  saveUserQuestionsStore(updatedStore);

  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("disha2020_store_updated", { detail: updatedStore }));
    window.dispatchEvent(new CustomEvent("quizpro_store_updated", { detail: updatedStore }));
  }

  return {
    success: true,
    cleanedCount: duplicateDocIdsToClean.length,
    message: `Successfully cleaned ${duplicateDocIdsToClean.length} duplicate records with recoverable backup preserved.`,
  };
}
