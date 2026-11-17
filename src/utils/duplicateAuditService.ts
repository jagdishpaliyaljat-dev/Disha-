import { Question, UserQuestionsStore } from "../types";
import { deleteQuestionFromSupabase } from "./supabaseSyncService";
import { generateQuestionHash } from "../lib/mcqImport/dedupe";
import { loadUserQuestionsStore, saveUserQuestionsStore } from "./questionsStorage";

export interface DuplicateGroup {
  hashKey: string;
  sampleQuestionText: string;
  canonicalQuestion: Question;
  duplicateQuestions: Question[];
  totalRecords: number;
  isIdentical: boolean; // exact text + options + answer match
  conflictReason?: string;
}

export interface DuplicateAuditReport {
  scannedCount: number;
  uniqueCount: number;
  duplicateGroupCount: number;
  totalDuplicateRecords: number;
  groups: DuplicateGroup[];
  analyzedAt: string;
}

export interface MergeExecutionResult {
  success: boolean;
  mergedGroupsCount: number;
  deletedQuestionIds: string[];
  retainedQuestionIds: string[];
  errors: string[];
}

/**
 * Normalizes text for robust comparison (strips excessive spacing, punctuation, case)
 */
export function normalizeTextSignature(text: string): string {
  return (text || "")
    .toLowerCase()
    .replace(/[\s\r\n\t]+/g, " ")
    .replace(/[^\w\u0900-\u097F]/gu, "")
    .trim();
}

/**
 * Normalizes options for strict equality comparison
 */
export function normalizeOptionsSignature(options: string[]): string {
  return (Array.isArray(options) ? options : [])
    .map((o) => normalizeTextSignature(o))
    .sort()
    .join("|||");
}

/**
 * Scans a list of questions to identify exact and semantic duplicate clusters
 */
export function runDuplicateAudit(questions: Question[]): DuplicateAuditReport {
  const groupsMap = new Map<string, Question[]>();

  questions.forEach((q) => {
    if (!q || (!q.text && !(q as any).question)) return;
    const qText = q.text || (q as any).question || "";
    const qOpts = Array.isArray(q.options) ? q.options : [];

    // Primary hash key derived from normalized text + options
    const textSig = normalizeTextSignature(qText);
    const optsSig = normalizeOptionsSignature(qOpts);
    const key = `${q.topicId || "any"}::${textSig}::${optsSig}`;

    const existing = groupsMap.get(key) || [];
    existing.push(q);
    groupsMap.set(key, existing);
  });

  const duplicateGroups: DuplicateGroup[] = [];
  let totalDuplicateRecords = 0;

  groupsMap.forEach((groupQuestions, key) => {
    if (groupQuestions.length > 1) {
      // Pick canonical question:
      // Priority 1: Has deterministic 'usr-q-' ID
      // Priority 2: Oldest createdAt
      // Priority 3: First in list
      const sorted = [...groupQuestions].sort((a, b) => {
        const aIsDeterministic = a.id?.startsWith("usr-q-") && !a.id.includes("batch-");
        const bIsDeterministic = b.id?.startsWith("usr-q-") && !b.id.includes("batch-");
        if (aIsDeterministic && !bIsDeterministic) return -1;
        if (!aIsDeterministic && bIsDeterministic) return 1;

        const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return aTime - bTime;
      });

      const canonical = sorted[0];
      const duplicates = sorted.slice(1);

      // Verify identical structure
      const isIdentical = duplicates.every((d) => {
        const textMatch = normalizeTextSignature(d.text) === normalizeTextSignature(canonical.text);
        const ansMatch = d.correctIndex === canonical.correctIndex;
        return textMatch && ansMatch;
      });

      duplicateGroups.push({
        hashKey: key,
        sampleQuestionText: canonical.text,
        canonicalQuestion: canonical,
        duplicateQuestions: duplicates,
        totalRecords: groupQuestions.length,
        isIdentical,
        conflictReason: isIdentical ? undefined : "Options or correct answer index differ across versions.",
      });

      totalDuplicateRecords += duplicates.length;
    }
  });

  return {
    scannedCount: questions.length,
    uniqueCount: groupsMap.size,
    duplicateGroupCount: duplicateGroups.length,
    totalDuplicateRecords,
    groups: duplicateGroups,
    analyzedAt: new Date().toISOString(),
  };
}

/**
 * Safely merges duplicate question groups:
 * Deletes redundant duplicate document IDs from Supabase and removes them from local store.
 */
export async function executeDuplicateMerge(
  groups: DuplicateGroup[],
  onProgress?: (progressText: string) => void
): Promise<MergeExecutionResult> {
  const deletedQuestionIds: string[] = [];
  const retainedQuestionIds: string[] = [];
  const errors: string[] = [];

  const identicalGroups = groups.filter((g) => g.isIdentical);

  for (let i = 0; i < identicalGroups.length; i++) {
    const group = identicalGroups[i];
    retainedQuestionIds.push(group.canonicalQuestion.id);

    if (onProgress) {
      onProgress(`Merging group ${i + 1} of ${identicalGroups.length}...`);
    }

    for (const dup of group.duplicateQuestions) {
      try {
        if (dup.id) {
          await deleteQuestionFromSupabase(dup.id);
        }
        deletedQuestionIds.push(dup.id);
      } catch (err: any) {
        console.warn(`Failed to delete duplicate MCQ ${dup.id}:`, err);
        errors.push(`Doc ${dup.id}: ${err?.message || String(err)}`);
      }
    }
  }

  // Update in-memory and localStorage store
  try {
    const store = loadUserQuestionsStore();
    const delSet = new Set(deletedQuestionIds);

    const updatedCache = (store.cloudCacheQuestions || []).filter((q) => !delSet.has(q.id));
    const updatedCustom = (store.customQuestions || []).filter((q) => !delSet.has(q.id));

    const updatedStore: UserQuestionsStore = {
      ...store,
      cloudCacheQuestions: updatedCache,
      customQuestions: updatedCustom,
      deletedQuestionIds: Array.from(new Set([...(store.deletedQuestionIds || []), ...deletedQuestionIds])),
    };

    saveUserQuestionsStore(updatedStore);
  } catch (storeErr: any) {
    console.warn("Failed to update local store after duplicate merge:", storeErr);
  }

  return {
    success: errors.length === 0,
    mergedGroupsCount: identicalGroups.length,
    deletedQuestionIds,
    retainedQuestionIds,
    errors,
  };
}
