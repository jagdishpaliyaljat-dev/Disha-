/**
 * Question Similarity & Fuzzy Duplicate Detection Engine
 * Optimized for bilingual (Hindi / Devanagari & English) competitive exam questions.
 * Implements Sørensen-Dice character bigram similarity + Token Jaccard + Option alignment.
 */

import { Question, ParsedQuestionDraft } from "../types";

export interface QuestionSimilarityResult {
  score: number; // 0.0 to 1.0
  percentage: number; // 0 to 100
  isDuplicate: boolean; // >= threshold (default 0.90)
  isExactMatch: boolean; // score === 1.0
  textScore: number;
  optionsScore: number;
  similarityBand: "exact" | "very_high" | "high" | "moderate" | "low";
  reason: string;
}

export interface FuzzyDuplicatePair {
  canonicalQuestion: Question | ParsedQuestionDraft;
  duplicateQuestion: Question | ParsedQuestionDraft;
  similarity: QuestionSimilarityResult;
  source: "database" | "batch";
}

export interface FuzzyDuplicateGroup {
  groupId: string;
  canonicalQuestion: Question;
  duplicates: Array<{
    question: Question;
    similarity: QuestionSimilarityResult;
  }>;
  highestSimilarity: number;
  isExactGroup: boolean;
  count: number;
}

export interface DuplicateScanReport {
  totalScanned: number;
  uniqueCount: number;
  duplicateGroupCount: number;
  totalDuplicateCopies: number;
  groups: FuzzyDuplicateGroup[];
  thresholdUsed: number;
  scanDurationMs: number;
  timestamp: string;
}

/**
 * Normalizes question text for high-accuracy comparison:
 * - Strips HTML, Markdown, LaTeX
 * - Strips leading question numbers / labels (e.g. "Q.1", "प्रश्न 1:", "1.")
 * - Strips common exam filler prefixes ("निम्न में से", "निम्नलिखित में से", "Which of the following")
 * - Normalizes Devanagari and English spaces & punctuation
 */
export function cleanQuestionText(raw: string): string {
  if (!raw) return "";
  return raw
    .toLowerCase()
    // Strip HTML tags
    .replace(/<[^>]*>/g, " ")
    // Strip LaTeX syntax markers
    .replace(/\\[a-zA-Z]+/g, " ")
    .replace(/[\$\{\}\[\]\(\)]/g, " ")
    // Strip question numbering prefixes: "Q1.", "Q. 1:", "प्रश्न 1.", "प्र. 1:", "12."
    .replace(/^(?:q(?:uestion)?\s*[\.\:\-]?\s*\d+[\.\:\)\-]|प्रश्न\s*[\.\:\-]?\s*\d+[\.\:\)\-]|प्र\s*[\.\:\-]?\s*\d+[\.\:\)\-]|\d+[\.\:\)\-])\s*/i, "")
    // Strip Hindi and English filler prefixes & starters
    .replace(/^(?:निम्न(?:लिखित)?\s*(?:कथनों\s*में\s*से|विकल्पों\s*में\s*से|प्रश्नों\s*में\s*से|में\s*से)?|इनमें\s*से|बताइए\s*कि)\s*/i, "")
    .replace(/^(?:which\s+(?:of\s+the\s+following|one\s+of\s+the\s+following)?\s*(?:statements?|options?|is|are)?|what\s+(?:is|are)|who\s+(?:was|is)|where\s+(?:is|was)|when\s+(?:was|is)|name\s+the)\s+/i, "")
    // Normalize state/region boilerplate
    .replace(/\b(?:in\s+the\s+state\s+of|in\s+state\s+of|राज्य\s*में)\b/gi, "in")
    // Keep letters, numbers, Devanagari Unicode (\u0900-\u097F)
    .replace(/[^\w\s\u0900-\u097F]/gu, " ")
    // Collapse whitespace
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Extracts character bigrams and their frequencies.
 */
function getBigrams(str: string): { bigrams: Map<string, number>; count: number } {
  const s = cleanQuestionText(str);
  const bigrams = new Map<string, number>();
  if (s.length < 2) {
    if (s.length === 1) bigrams.set(s, 1);
    return { bigrams, count: s.length };
  }
  for (let i = 0; i < s.length - 1; i++) {
    const bg = s.slice(i, i + 2);
    bigrams.set(bg, (bigrams.get(bg) || 0) + 1);
  }
  return { bigrams, count: s.length - 1 };
}

/**
 * Computes Sørensen-Dice similarity coefficient (0.0 to 1.0) on character bigrams.
 */
export function computeBigramDiceSimilarity(str1: string, str2: string): number {
  const s1 = cleanQuestionText(str1);
  const s2 = cleanQuestionText(str2);

  if (s1 === s2 && s1.length > 0) return 1.0;
  if (s1.length < 2 || s2.length < 2) {
    return s1 === s2 ? 1.0 : 0.0;
  }

  const bg1 = getBigrams(s1);
  const bg2 = getBigrams(s2);
  let intersection = 0;

  for (const [bg, count1] of bg1.bigrams.entries()) {
    const count2 = bg2.bigrams.get(bg);
    if (count2) {
      intersection += Math.min(count1, count2);
    }
  }

  return (2.0 * intersection) / (bg1.count + bg2.count);
}

/**
 * Computes word token Jaccard similarity.
 */
export function computeTokenJaccardSimilarity(str1: string, str2: string): number {
  const s1 = cleanQuestionText(str1);
  const s2 = cleanQuestionText(str2);
  if (s1 === s2 && s1.length > 0) return 1.0;

  const tokens1 = new Set(s1.split(" ").filter((w) => w.length > 1));
  const tokens2 = new Set(s2.split(" ").filter((w) => w.length > 1));

  if (tokens1.size === 0 || tokens2.size === 0) return 0.0;

  let intersection = 0;
  tokens1.forEach((t) => {
    if (tokens2.has(t)) intersection++;
  });

  const union = tokens1.size + tokens2.size - intersection;
  return union > 0 ? intersection / union : 0.0;
}

/**
 * Computes options similarity between two option arrays (order-invariant).
 */
export function computeOptionsSimilarity(opts1?: string[], opts2?: string[]): number {
  const o1 = Array.isArray(opts1) ? opts1.map(cleanQuestionText).filter(Boolean) : [];
  const o2 = Array.isArray(opts2) ? opts2.map(cleanQuestionText).filter(Boolean) : [];

  if (o1.length === 0 && o2.length === 0) return 1.0;
  if (o1.length === 0 || o2.length === 0) return 0.5;

  let matchedPairs = 0;
  const usedIdx2 = new Set<number>();

  for (const opt1 of o1) {
    let bestMatchScore = 0;
    let bestMatchIdx = -1;

    for (let j = 0; j < o2.length; j++) {
      if (usedIdx2.has(j)) continue;
      const score = computeBigramDiceSimilarity(opt1, o2[j]);
      if (score > bestMatchScore) {
        bestMatchScore = score;
        bestMatchIdx = j;
      }
    }

    if (bestMatchScore >= 0.85 && bestMatchIdx !== -1) {
      matchedPairs++;
      usedIdx2.add(bestMatchIdx);
    }
  }

  const maxLen = Math.max(o1.length, o2.length);
  return maxLen > 0 ? matchedPairs / maxLen : 1.0;
}

/**
 * Comprehensive question similarity calculator with customizable threshold (default 90% = 0.90).
 */
export function calculateQuestionSimilarity(
  q1: { text?: string; question?: string; options?: string[]; correctIndex?: number; answer?: any },
  q2: { text?: string; question?: string; options?: string[]; correctIndex?: number; answer?: any },
  threshold = 0.90
): QuestionSimilarityResult {
  const text1 = q1.text || (q1 as any).question || "";
  const text2 = q2.text || (q2 as any).question || "";

  // 1. Text Similarity (Combining Bigram Dice & Word Jaccard)
  const dice = computeBigramDiceSimilarity(text1, text2);
  const jaccard = computeTokenJaccardSimilarity(text1, text2);
  
  // In Devanagari/Hindi, compound words like 'हवा महल' vs 'हवामहल' have high bigram dice
  // but lower token jaccard. Don't let token jaccard penalize when dice is already high (>=0.88).
  const textScore = dice >= 0.88 ? Math.max(dice, dice * 0.75 + jaccard * 0.25) : dice * 0.75 + jaccard * 0.25;

  // 2. Options Similarity (Only consider if options are present in either question)
  const hasOptions = (q1.options && q1.options.length > 0) || (q2.options && q2.options.length > 0);
  const optionsScore = hasOptions ? computeOptionsSimilarity(q1.options, q2.options) : 1.0;

  // 3. Combined Final Score
  // If text is 100% identical, score is 1.0
  let combinedScore = textScore === 1.0 
    ? 1.0 
    : hasOptions 
      ? textScore * 0.85 + optionsScore * 0.15 
      : textScore;

  // Answer bonus/penalty if text is borderline (0.85 to 0.92)
  if (q1.correctIndex !== undefined && q2.correctIndex !== undefined) {
    if (q1.correctIndex === q2.correctIndex && combinedScore >= 0.88) {
      combinedScore = Math.min(1.0, combinedScore + 0.03);
    }
  }

  const score = Math.round(combinedScore * 1000) / 1000;
  const percentage = Math.round(score * 100);
  const isDuplicate = score >= threshold;
  const isExactMatch = score >= 0.999 || cleanQuestionText(text1) === cleanQuestionText(text2);

  let similarityBand: QuestionSimilarityResult["similarityBand"] = "low";
  if (isExactMatch) similarityBand = "exact";
  else if (percentage >= 95) similarityBand = "very_high";
  else if (percentage >= 90) similarityBand = "high";
  else if (percentage >= 75) similarityBand = "moderate";

  let reason = "Different Questions";
  if (isExactMatch) {
    reason = "100% Exact Question Text Match";
  } else if (percentage >= 95) {
    reason = `Critical Match (${percentage}%): Wording nearly identical with minor punctuation/typo difference`;
  } else if (percentage >= 90) {
    reason = `High Match (${percentage}%): Question semantics & options match above 90% threshold`;
  } else if (percentage >= 80) {
    reason = `Moderate Match (${percentage}%): Similar phrasing but likely separate question`;
  }

  return {
    score,
    percentage,
    isDuplicate,
    isExactMatch,
    textScore: Math.round(textScore * 100) / 100,
    optionsScore: Math.round(optionsScore * 100) / 100,
    similarityBand,
    reason,
  };
}

/**
 * Scans a full question bank and clusters duplicate questions >= threshold (default 90%).
 * Employs length and prefix blocking for lightning-fast performance across thousands of MCQs.
 */
export function scanQuestionsForFuzzyDuplicates(
  questions: Question[],
  threshold = 0.90,
  onProgress?: (progressText: string, current: number, total: number) => void
): DuplicateScanReport {
  const startTime = Date.now();
  const validQuestions = (questions || []).filter((q) => Boolean(q && (q.text || (q as any).question)));
  const totalScanned = validQuestions.length;

  // Pre-clean and prepare metadata
  const prepared = validQuestions.map((q) => {
    const raw = q.text || (q as any).question || "";
    const cleaned = cleanQuestionText(raw);
    const bg = getBigrams(cleaned);
    return {
      rawQuestion: q,
      cleaned,
      len: cleaned.length,
      bigrams: bg.bigrams,
      bigramCount: bg.count,
      assignedGroupId: null as string | null,
    };
  });

  // Sort by text length for efficient window comparison
  prepared.sort((a, b) => a.len - b.len);

  const groups: FuzzyDuplicateGroup[] = [];
  let groupCounter = 1;

  for (let i = 0; i < prepared.length; i++) {
    const p1 = prepared[i];
    if (p1.assignedGroupId) continue;

    if (onProgress && i % 200 === 0) {
      onProgress(`Scanning questions for >=${Math.round(threshold * 100)}% duplicates...`, i, prepared.length);
    }

    const matchedItems: Array<{
      question: Question;
      similarity: QuestionSimilarityResult;
    }> = [];

    // Compare with neighboring candidates whose length difference is within allowable bound
    // If length difference > 35%, similarity cannot exceed 90%
    for (let j = i + 1; j < prepared.length; j++) {
      const p2 = prepared[j];
      if (p2.assignedGroupId) continue;

      if (p2.len > p1.len * 1.45 && p2.len - p1.len > 25) {
        // Can break early since array is sorted by length
        break;
      }

      // Fast bigram overlap check
      let intersection = 0;
      for (const [bg, count1] of p1.bigrams.entries()) {
        const count2 = p2.bigrams.get(bg);
        if (count2) intersection += Math.min(count1, count2);
      }
      const dice = (2.0 * intersection) / (p1.bigramCount + p2.bigramCount || 1);

      // If text bigram dice >= (threshold - 0.05), run full similarity check
      if (dice >= threshold - 0.08) {
        const sim = calculateQuestionSimilarity(p1.rawQuestion, p2.rawQuestion, threshold);
        if (sim.isDuplicate) {
          p2.assignedGroupId = `grp-${groupCounter}`;
          matchedItems.push({
            question: p2.rawQuestion,
            similarity: sim,
          });
        }
      }
    }

    if (matchedItems.length > 0) {
      p1.assignedGroupId = `grp-${groupCounter}`;
      const highestSimilarity = Math.max(...matchedItems.map((m) => m.similarity.percentage));
      const isExactGroup = matchedItems.every((m) => m.similarity.isExactMatch);

      // Determine the best canonical question:
      // Priority 1: Has stable ID format (e.g. 'usr-q-')
      // Priority 2: Has complete explanation
      // Priority 3: Earliest createdAt
      const allCandidates = [p1.rawQuestion, ...matchedItems.map((m) => m.question)];
      allCandidates.sort((a, b) => {
        const aHasExpl = (a.explanation || "").length > 10 ? 1 : 0;
        const bHasExpl = (b.explanation || "").length > 10 ? 1 : 0;
        if (aHasExpl !== bHasExpl) return bHasExpl - aHasExpl;

        const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return aTime - bTime;
      });

      const canonical = allCandidates[0];
      const duplicates = allCandidates.slice(1).map((dupQ) => {
        const sim = calculateQuestionSimilarity(canonical, dupQ, threshold);
        return { question: dupQ, similarity: sim };
      });

      groups.push({
        groupId: `group-${groupCounter++}`,
        canonicalQuestion: canonical,
        duplicates,
        highestSimilarity,
        isExactGroup,
        count: allCandidates.length,
      });
    }
  }

  // Sort groups by highest similarity descending
  groups.sort((a, b) => b.highestSimilarity - a.highestSimilarity);

  const totalDuplicateCopies = groups.reduce((acc, g) => acc + g.duplicates.length, 0);
  const uniqueCount = totalScanned - totalDuplicateCopies;

  return {
    totalScanned,
    uniqueCount,
    duplicateGroupCount: groups.length,
    totalDuplicateCopies,
    groups,
    thresholdUsed: threshold,
    scanDurationMs: Date.now() - startTime,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Checks a batch of incoming draft questions against:
 * 1. The existing question bank (Supabase / local store)
 * 2. Other questions in the incoming batch itself
 * Returns a map of tempId -> highest similarity match.
 */
export function checkBatchForFuzzyDuplicates(
  drafts: ParsedQuestionDraft[],
  existingQuestions: Question[],
  threshold = 0.90
): Map<string, { matchedWith: Question | ParsedQuestionDraft; similarity: QuestionSimilarityResult; isBatchInternal: boolean }> {
  const result = new Map<
    string,
    { matchedWith: Question | ParsedQuestionDraft; similarity: QuestionSimilarityResult; isBatchInternal: boolean }
  >();

  // 1. Check against existing bank
  for (const draft of drafts) {
    const draftText = draft.text || "";
    if (!draftText) continue;

    let bestExistingMatch: Question | null = null;
    let bestSim: QuestionSimilarityResult | null = null;

    for (const ex of existingQuestions) {
      const exText = ex.text || (ex as any).question || "";
      if (Math.abs(draftText.length - exText.length) > Math.max(draftText.length, exText.length) * 0.4) {
        continue;
      }
      const sim = calculateQuestionSimilarity(draft, ex, threshold);
      if (sim.isDuplicate && (!bestSim || sim.score > bestSim.score)) {
        bestSim = sim;
        bestExistingMatch = ex;
        if (sim.isExactMatch) break; // Maximum match found
      }
    }

    if (bestExistingMatch && bestSim) {
      result.set(draft.tempId, {
        matchedWith: bestExistingMatch,
        similarity: bestSim,
        isBatchInternal: false,
      });
    }
  }

  // 2. Check internal batch duplicates (within the pasted/uploaded text itself)
  for (let i = 0; i < drafts.length; i++) {
    const d1 = drafts[i];
    if (result.has(d1.tempId)) continue; // Already flagged with existing DB

    for (let j = i + 1; j < drafts.length; j++) {
      const d2 = drafts[j];
      const sim = calculateQuestionSimilarity(d1, d2, threshold);
      if (sim.isDuplicate) {
        // Flag the second one as an internal batch duplicate
        if (!result.has(d2.tempId)) {
          result.set(d2.tempId, {
            matchedWith: d1,
            similarity: sim,
            isBatchInternal: true,
          });
        }
      }
    }
  }

  return result;
}
