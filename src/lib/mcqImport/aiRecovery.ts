import { ValidatedQuestionResult } from "./schema";
import { normalizeQuestion } from "./normalize";
import { validateQuestion } from "./validate";
import { generateQuestionHash } from "./dedupe";
import { apiFetch } from "../../utils/api";

export interface AIRecoveryProgress {
  phase: "identifying" | "recovering" | "revalidating" | "complete" | "failed";
  completed: number;
  total: number;
  currentBatch: number;
  totalBatches: number;
  message: string;
}

export interface AIRecoveryOptions {
  batchSize?: number;
  onProgress?: (progress: AIRecoveryProgress) => void;
  signal?: AbortSignal;
}

/**
 * Checks whether an invalid raw question has unparsed structural content that AI can help separate
 * (e.g., options embedded in stem, or broken match/table structure),
 * while avoiding AI calls when the question is simply missing an answer or is an unsupported type.
 */
function isRecoverableCandidate(rawQ: any, initialRes?: ValidatedQuestionResult): boolean {
  if (!rawQ || typeof rawQ !== "object") return false;
  if (initialRes?.reviewCategory === "unsupported") return false;

  // If question stem and 2..5 non-empty options are already parsed, and the only issue is a missing/invalid answer,
  // do NOT call AI to guess/hallucinate an answer!
  const hasCleanStem = Boolean(initialRes?.question && initialRes.question.trim().length > 3);
  const hasCleanOptions =
    Array.isArray(initialRes?.options) &&
    initialRes.options.length >= 2 &&
    initialRes.options.length <= 5 &&
    initialRes.options.every((o) => String(o ?? "").trim().length > 0);
  const onlyMissingAnswer =
    hasCleanStem &&
    hasCleanOptions &&
    initialRes?.correctIndex === -1 &&
    !initialRes?.tableErrorWarning &&
    !initialRes?.matchingErrorWarning;

  if (onlyMissingAnswer) {
    return false;
  }

  const hasStem = !!(
    rawQ.question || rawQ.text || rawQ.prompt || rawQ.title || rawQ.q ||
    rawQ.stem || rawQ.content || rawQ.body || rawQ.questionText
  );
  const hasOpts = !!(
    (Array.isArray(rawQ.options) && rawQ.options.length > 0) ||
    (Array.isArray(rawQ.choices) && rawQ.choices.length > 0) ||
    rawQ.optionA || rawQ.option_a || rawQ.a ||
    (rawQ.options && typeof rawQ.options === "object" && Object.keys(rawQ.options).length > 0)
  );
  return hasStem || hasOpts;
}

function hasAnyAnswerHintInRaw(rawQ: any): boolean {
  if (!rawQ || typeof rawQ !== "object") return false;
  const directAns =
    rawQ.answer ??
    rawQ.correctAnswer ??
    rawQ.correct_answer ??
    rawQ.correct_option ??
    rawQ.correctOption ??
    rawQ.correctIndex ??
    rawQ.correct_index ??
    rawQ.correct_option_index ??
    rawQ.ans ??
    rawQ.correct ??
    rawQ.key;
  if (directAns !== undefined && directAns !== null && String(directAns).trim() !== "") {
    return true;
  }
  const textBlob = JSON.stringify(rawQ);
  return /(?:answer|ans|उत्तर|सही\s*विकल्प|correct|✓|✔)/i.test(textBlob);
}

/**
 * Verifies that protected mathematical expressions or statements from original were preserved.
 */
function verifyProtectedContent(original: any, recovered: any): { isLost: boolean; reason?: string } {
  const origText = String(original?.question || original?.text || "");
  const recText = String(recovered?.question || recovered?.text || "");

  // Check LaTeX formulas ($...$)
  const origMathMatches = origText.match(/\$[^$]+\$/g) || [];
  if (origMathMatches.length > 0) {
    const recMathMatches = recText.match(/\$[^$]+\$/g) || [];
    if (recMathMatches.length === 0) {
      return { isLost: true, reason: "LaTeX math expressions were stripped during formatting" };
    }
  }

  // Check text length sanity
  if (origText.trim().length > 30 && recText.trim().length < 5) {
    return { isLost: true, reason: "Question stem was unexpectedly truncated" };
  }

  return { isLost: false };
}

/**
 * Recovers unresolved questions in small batches via Gemini API,
 * revalidates them through deterministic validation, and preserves original question order.
 */
export async function recoverQuestionsWithAI(
  rawList: any[],
  initialResults: ValidatedQuestionResult[],
  existingHashes: Set<string>,
  options: AIRecoveryOptions = {}
): Promise<{
  results: ValidatedQuestionResult[];
  recoveredCount: number;
  manualReviewCount: number;
}> {
  const batchSize = Math.max(1, Math.min(options.batchSize || 3, 10));
  const signal = options.signal;

  // 1. Identify indices of unresolved questions
  const unresolvedIndices: number[] = [];
  initialResults.forEach((res, idx) => {
    if (!res.isValid || (res.errors && res.errors.length > 0)) {
      unresolvedIndices.push(idx);
    }
  });

  if (unresolvedIndices.length === 0) {
    options.onProgress?.({
      phase: "complete",
      completed: 0,
      total: 0,
      currentBatch: 0,
      totalBatches: 0,
      message: "All questions are valid deterministically. No AI recovery required.",
    });
    return {
      results: initialResults,
      recoveredCount: 0,
      manualReviewCount: initialResults.filter((r) => r.needsReview || (r.warnings && r.warnings.length > 0)).length,
    };
  }

  // Filter only structurally recoverable candidates
  const eligibleIndices = unresolvedIndices.filter((idx) => isRecoverableCandidate(rawList[idx], initialResults[idx]));

  if (eligibleIndices.length === 0) {
    return {
      results: initialResults,
      recoveredCount: 0,
      manualReviewCount: initialResults.filter((r) => r.needsReview || !r.isValid).length,
    };
  }

  const totalBatches = Math.ceil(eligibleIndices.length / batchSize);
  let processedCount = 0;
  let recoveredCount = 0;

  // Clone initial results to preserve exact original indices
  const finalResults = [...initialResults];

  // Process in small batches
  for (let batchIdx = 0; batchIdx < totalBatches; batchIdx++) {
    if (signal?.aborted) {
      break;
    }

    const start = batchIdx * batchSize;
    const batchIndices = eligibleIndices.slice(start, start + batchSize);
    const batchRawItems = batchIndices.map((idx) => rawList[idx]);

    options.onProgress?.({
      phase: "recovering",
      completed: processedCount,
      total: eligibleIndices.length,
      currentBatch: batchIdx + 1,
      totalBatches,
      message: `Recovering questions ${processedCount + 1}-${Math.min(processedCount + batchIndices.length, eligibleIndices.length)} of ${eligibleIndices.length} with AI...`,
    });

    try {
      const response = await apiFetch("/api/ai/format-mcq", {
        method: "POST",
        body: JSON.stringify({
          mode: "recover_json",
          rawQuestions: batchRawItems,
          text: JSON.stringify(batchRawItems, null, 2),
        }),
      });

      if (!response.ok) {
        throw new Error(`AI recovery API returned status ${response.status}`);
      }

      const data = await response.json();
      const aiQuestions: any[] = Array.isArray(data?.questions)
        ? data.questions
        : data?.formatted
        ? [data.formatted]
        : [];

      // Revalidate and place each recovered question back into its exact original position
      batchIndices.forEach((origIdx, itemOffset) => {
        const rawOriginal = rawList[origIdx];
        const aiItem = aiQuestions[itemOffset];
        const qNum = origIdx + 1;

        if (aiItem && typeof aiItem === "object") {
          const protectionCheck = verifyProtectedContent(rawOriginal, aiItem);
          const hadAnswerInSource = hasAnyAnswerHintInRaw(rawOriginal);

          // Anti-hallucination guard: never let AI invent an answer if the source had none
          const safeAiItem = {
            ...aiItem,
            answer: hadAnswerInSource ? aiItem.answer : "",
            correctIndex: hadAnswerInSource ? aiItem.correctIndex : -1,
            subject: rawOriginal.subject ?? rawOriginal.subjectName,
            chapter: rawOriginal.chapter ?? rawOriginal.chapterName,
            topic: rawOriginal.topic ?? rawOriginal.topicName,
            table: aiItem.table || rawOriginal.table,
            matchTable: aiItem.matchTable || rawOriginal.matchTable,
            rawInput: rawOriginal,
          };

          const normalized = normalizeQuestion(safeAiItem);
          const validation = validateQuestion(normalized, qNum);

          if (protectionCheck.isLost) {
            validation.isValid = false;
            validation.errors.push(`Content integrity warning: ${protectionCheck.reason}`);
          }

          const hash = generateQuestionHash(normalized);
          const isDupe = existingHashes.has(hash);
          const needsReview = !validation.isValid || validation.needsReview || !!aiItem.needsReview || isDupe;
          const reviewReason =
            aiItem.reviewReason ||
            (!validation.isValid ? validation.errors.join("; ") : isDupe ? "Duplicate question detected" : undefined);

          if (validation.isValid) {
            recoveredCount++;
          }

          finalResults[origIdx] = {
            ...normalized,
            tempId: initialResults[origIdx].tempId || `draft_${qNum}_${Date.now()}`,
            questionNumber: qNum,
            isValid: validation.isValid,
            reviewCategory: isDupe && validation.isValid ? "duplicate" : validation.reviewCategory,
            errorCategories: validation.errorCategories,
            errors: validation.errors,
            warnings: validation.warnings,
            hash,
            isDuplicate: isDupe,
            correctIndex: validation.correctIndex,
            recoveredByAI: true,
            originalQuestion: rawOriginal,
            rawInput: rawOriginal,
            needsReview,
            reviewReason,
          };
        } else {
          finalResults[origIdx] = {
            ...initialResults[origIdx],
            recoveredByAI: false,
            originalQuestion: rawOriginal,
            rawInput: rawOriginal,
            needsReview: true,
            reviewReason: initialResults[origIdx].reviewReason || "AI recovery could not parse this question",
          };
        }
      });
    } catch (batchErr: any) {
      console.warn(`[AIRecovery] Batch ${batchIdx + 1} recovery encountered error:`, batchErr?.message || batchErr);
      batchIndices.forEach((origIdx) => {
        finalResults[origIdx] = {
          ...initialResults[origIdx],
          recoveredByAI: false,
          originalQuestion: rawList[origIdx],
          rawInput: rawList[origIdx],
          needsReview: true,
          reviewReason: initialResults[origIdx].reviewReason || `Recovery network error: ${batchErr?.message || "Timeout"}`,
        };
      });
    }

    processedCount += batchIndices.length;
  }

  options.onProgress?.({
    phase: "complete",
    completed: eligibleIndices.length,
    total: eligibleIndices.length,
    currentBatch: totalBatches,
    totalBatches,
    message: `AI recovery complete: ${recoveredCount} questions recovered.`,
  });

  const manualReviewCount = finalResults.filter(
    (r) => r.needsReview || (r.warnings && r.warnings.length > 0) || !r.isValid
  ).length;

  return {
    results: finalResults,
    recoveredCount,
    manualReviewCount,
  };
}

