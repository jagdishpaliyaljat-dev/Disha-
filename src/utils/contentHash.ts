import { Question } from "../types";

/**
 * Deterministic canonical normalization and FNV-1a 64-bit hex hashing utilities
 * for Phase 3 change detection across Bulk Sync, Bundles, Imports, and Version Bumps.
 * Zero external dependencies; works identically in Browser and Node.js.
 */

export const DEFAULT_VOLATILE_FIELDS = new Set([
  "updatedAt",
  "lastSyncAt",
  "lastUpdated",
  "lastUpdatedAt",
  "cachedAt",
  "syncUser",
  "contentHash",
  "pendingAttempt",
  "importedAt",
  "importedBy",
  "importBatchId",
]);

function isFirestoreSentinel(val: any): boolean {
  return Boolean(val && typeof val === "object" && typeof val._methodName === "string");
}

export function canonicalNormalize(
  value: any,
  ignoredKeys: Set<string> = DEFAULT_VOLATILE_FIELDS
): any {
  if (value === null || value === undefined) return undefined;
  if (typeof value !== "object") return value;

  if (value instanceof Date) {
    return value.toISOString();
  }
  if (typeof value.toDate === "function") {
    try {
      return value.toDate().toISOString();
    } catch {
      return undefined;
    }
  }
  if (isFirestoreSentinel(value)) {
    return `__fv_${value._methodName}_${value._operand ?? ""}`;
  }

  if (Array.isArray(value)) {
    return value
      .map((item) => canonicalNormalize(item, ignoredKeys))
      .filter((item) => item !== undefined);
  }

  const keys = Object.keys(value)
    .filter((k) => !ignoredKeys.has(k) && value[k] !== undefined)
    .sort();

  const out: Record<string, any> = {};
  for (const k of keys) {
    const normalized = canonicalNormalize(value[k], ignoredKeys);
    if (normalized !== undefined) {
      out[k] = normalized;
    }
  }
  return out;
}

export function fnv1a64Hex(input: string): string {
  // Primary 32-bit FNV-1a
  let h1 = 0x811c9dc5;
  // Secondary salted 32-bit FNV-1a for 64-bit collision resistance
  let h2 = 0x9e3779b9;

  for (let i = 0; i < input.length; i++) {
    const c = input.charCodeAt(i);
    h1 ^= c;
    h1 = Math.imul(h1, 0x01000193);

    const cRev = input.charCodeAt(input.length - 1 - i);
    h2 ^= cRev ^ (i & 0xff);
    h2 = Math.imul(h2, 0x01000193);
  }

  return `${(h1 >>> 0).toString(16).padStart(8, "0")}${(h2 >>> 0).toString(16).padStart(8, "0")}`;
}

export function computeCanonicalHash(
  obj: any,
  extraIgnoredKeys: string[] = []
): string {
  const ignored =
    extraIgnoredKeys.length === 0
      ? DEFAULT_VOLATILE_FIELDS
      : new Set([...DEFAULT_VOLATILE_FIELDS, ...extraIgnoredKeys]);

  const normalized = canonicalNormalize(obj, ignored);
  const serialized = JSON.stringify(normalized ?? null);
  return fnv1a64Hex(serialized);
}

/**
 * Computes a deterministic content hash for a Question entity, ignoring volatile
 * timestamps and sync/import tracking metadata.
 */
export function computeQuestionContentHash(q: Partial<Question> | any): string {
  if (!q || typeof q !== "object") return "empty";

  const canonicalQuestion = {
    id: q.id || "",
    topicId: q.topicId || "",
    chapterId: q.chapterId || "",
    subjectId: q.subjectId || "",
    text: (q.text || q.question || "").trim(),
    options: Array.isArray(q.options) ? q.options.map((o: any) => String(o ?? "")) : [],
    correctIndex:
      typeof q.correctIndex === "number"
        ? q.correctIndex
        : typeof q.correctAnswer === "number"
        ? q.correctAnswer
        : 0,
    explanation: (q.explanation || "").trim(),
    hindiText: q.hindiText ? String(q.hindiText).trim() : "",
    hindiOptions: Array.isArray(q.hindiOptions) ? q.hindiOptions.map((o: any) => String(o ?? "")) : [],
    hindiExplanation: q.hindiExplanation ? String(q.hindiExplanation).trim() : "",
    difficulty: q.difficulty || "medium",
    type: q.type || "mcq",
    table: q.table || q.tableData || null,
    matchTable: q.matchTable || q.matchData || null,
    imageUrl: q.imageUrl || null,
    svgContent: q.svgContent || null,
    paperId: q.paperId || null,
    testId: q.testId || null,
    tags: Array.isArray(q.tags) ? [...q.tags].sort() : [],
  };

  return computeCanonicalHash(canonicalQuestion);
}

/**
 * Computes a deterministic content hash for a QuestionBundle by sorting
 * deduplicated questions by ID first so array ordering never creates false diffs.
 */
export function computeBundleContentHash(
  topicId: string,
  questions: Array<Partial<Question> | any>
): string {
  const deduped = new Map<string, any>();
  for (const q of questions || []) {
    if (q && q.id) {
      deduped.set(q.id, q);
    }
  }
  const sortedIds = Array.from(deduped.keys()).sort();
  const itemHashes = sortedIds.map((id) => `${id}:${computeQuestionContentHash(deduped.get(id))}`);
  return fnv1a64Hex(`bundle::${topicId}::${sortedIds.length}::${itemHashes.join("|")}`);
}
