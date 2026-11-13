import { parseJSONWithLocation, extractQuestionsFromSingleObject } from "./index";
import { normalizeQuestion } from "./normalize";
import { validateQuestion } from "./validate";
import { generateQuestionHash } from "./dedupe";
import { ValidatedQuestionResult } from "./schema";
import { recoverQuestionsWithAI, AIRecoveryOptions } from "./aiRecovery";

export interface SmartImportSummary {
  total: number;
  valid: number;
  recoveredByAI: number;
  needsReview: number;
  errors: number;
  duplicates: number;
  unsupported?: number;
}

export interface SmartImportResult {
  success: boolean;
  parseError?: string;
  results: ValidatedQuestionResult[];
  summary: SmartImportSummary;
  aiRecoveryRequired: boolean;
  recoveredCount: number;
}

/**
 * Smart JSON Import Pipeline:
 * Step 1: Deterministic Multi-Block JSON parse
 * Step 2: Deterministic Normalization & Validation (0 AI calls if valid)
 * Step 3: Identify Unresolved Questions
 * Step 4: Small-Batch AI Recovery with content preservation guards
 * Step 5: Deterministic Revalidation and Deduplication (Preserves 100% original question order)
 */
export async function smartJSONImport(
  jsonString: string,
  existingHashes: Set<string> = new Set(),
  options: AIRecoveryOptions = {}
): Promise<SmartImportResult> {
  // Step 1: Multi-block aware JSON parsing
  const { data, error } = parseJSONWithLocation(jsonString);
  if (error || !data) {
    return {
      success: false,
      parseError: error,
      results: [],
      summary: { total: 0, valid: 0, recoveredByAI: 0, needsReview: 0, errors: 0, duplicates: 0 },
      aiRecoveryRequired: false,
      recoveredCount: 0,
    };
  }

  // Extract raw questions
  let rawList: any[] = [];
  if (data?.isMultiBlock && Array.isArray(data.blocks)) {
    rawList = data.blocks.flatMap((b: any) => extractQuestionsFromSingleObject(b));
  } else {
    rawList = extractQuestionsFromSingleObject(data);
  }

  if (rawList.length === 0) {
    return {
      success: false,
      parseError: "No questions detected in JSON. Ensure your JSON contains a \"questions\": [ ... ] list or question objects.",
      results: [],
      summary: { total: 0, valid: 0, recoveredByAI: 0, needsReview: 0, errors: 0, duplicates: 0 },
      aiRecoveryRequired: false,
      recoveredCount: 0,
    };
  }

  // Step 2: Deterministic Validation Pass across all items
  let initialInvalidCount = 0;
  const seenBatchHashes = new Set<string>();

  const initialResults: ValidatedQuestionResult[] = rawList.map((rawQ, idx) => {
    const qNum = idx + 1;
    const normalized = normalizeQuestion(rawQ);
    const validation = validateQuestion(normalized, qNum);
    const hash = generateQuestionHash(normalized);
    const isDbDupe = existingHashes.has(hash);
    const isBatchDupe = !isDbDupe && Boolean(normalized.question?.trim()) && seenBatchHashes.has(hash);
    if (normalized.question?.trim()) {
      seenBatchHashes.add(hash);
    }
    const isDupe = isDbDupe || isBatchDupe;
    const duplicateOf = isDbDupe ? "database" : isBatchDupe ? "batch" : undefined;

    const errorCategories = [...(validation.errorCategories || [])];
    if (isDupe && !errorCategories.includes("Possible Duplicate")) {
      errorCategories.push("Possible Duplicate");
    }

    const reviewCategory =
      validation.reviewCategory === "unsupported" || validation.reviewCategory === "invalid"
        ? validation.reviewCategory
        : isDupe
        ? "duplicate"
        : validation.reviewCategory;

    const tempId = `draft_${qNum}_${hash ? hash.slice(0, 10) : idx}_${Date.now()}`;

    if (!validation.isValid) {
      initialInvalidCount++;
    }

    return {
      ...normalized,
      tempId,
      questionNumber: qNum,
      isValid: validation.isValid,
      reviewCategory,
      errorCategories,
      errors: validation.errors,
      warnings: validation.warnings,
      correctIndex: validation.correctIndex,
      hash,
      isDuplicate: isDupe,
      duplicateOf,
      originalQuestion: rawQ,
      rawInput: rawQ?.rawInput !== undefined ? rawQ.rawInput : rawQ,
      recoveredByAI: false,
      needsReview: validation.needsReview || isDupe,
      reviewReason: !validation.isValid
        ? validation.errors.join("; ")
        : isDupe
        ? "Duplicate question detected"
        : validation.warnings.length > 0
        ? validation.warnings.join("; ")
        : undefined,
    };
  });

  // If 100% valid deterministically -> Return immediately with 0 AI latency!
  if (initialInvalidCount === 0) {
    const validCount = initialResults.length;
    const dupeCount = initialResults.filter((r) => r.isDuplicate).length;
    const reviewCount = initialResults.filter((r) => r.needsReview).length;

    return {
      success: true,
      results: initialResults,
      summary: {
        total: initialResults.length,
        valid: validCount,
        recoveredByAI: 0,
        needsReview: reviewCount,
        errors: 0,
        duplicates: dupeCount,
      },
      aiRecoveryRequired: false,
      recoveredCount: 0,
    };
  }

  // Step 3 & 4: AI Recovery for structurally unparsed questions
  const { results: finalResults, recoveredCount, manualReviewCount } = await recoverQuestionsWithAI(
    rawList,
    initialResults,
    existingHashes,
    options
  );

  const finalValid = finalResults.filter((r) => r.isValid).length;
  const finalErrors = finalResults.filter((r) => !r.isValid).length;
  const finalDupes = finalResults.filter((r) => r.isDuplicate).length;

  return {
    success: true,
    results: finalResults,
    summary: {
      total: finalResults.length,
      valid: finalValid,
      recoveredByAI: recoveredCount,
      needsReview: manualReviewCount,
      errors: finalErrors,
      duplicates: finalDupes,
    },
    aiRecoveryRequired: recoveredCount > 0,
    recoveredCount,
  };
}

