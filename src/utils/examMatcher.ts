import {
  ExamMatchCategory,
  ExamQuestionMatch,
  ExtractedQuestionDraft,
  Question,
} from "../types";

/**
 * Converts Hindi digits (०-९) to Western digits (0-9)
 */
export function convertHindiNumerals(text: string): string {
  const devanagariDigits = ["०", "१", "२", "३", "४", "५", "६", "७", "८", "९"];
  let res = text;
  for (let i = 0; i < 10; i++) {
    res = res.replace(new RegExp(devanagariDigits[i], "g"), String(i));
  }
  return res;
}

/**
 * Safe, meaning-preserving normalization for text comparison:
 * - Converts Hindi numerals to standard digits
 * - Normalizes Unicode quotes, dashes, whitespace
 * - Strips leading question number labels (e.g. "Q. 1", "प्र. 1.", "1.")
 * - Case-folds English words
 * - Retains critical dates, numbers, negations, and names intact.
 */
export function normalizeQuestionText(text: string): string {
  if (!text) return "";
  let s = text.trim();

  // Strip leading Question number prefix (e.g., "Q. 1.", "Q1:", "प्र. 2:", "1.")
  s = s.replace(/^(?:(?:Q|Question|प्रश्न|प्र)\.?\s*\d+[\.\:\-\)]|\b\d+[\.\)\:\-]\s*)/i, "");

  // Convert Hindi numerals to western digits
  s = convertHindiNumerals(s);

  // Normalize quotes and dashes
  s = s
    .replace(/[\u201C\u201D\u0022]/g, '"')
    .replace(/[\u2018\u2019\u0027]/g, "'")
    .replace(/[\u2013\u2014\u2212]/g, "-")
    .replace(/\s+/g, " ");

  // Remove trailing and leading punctuation but leave inside tokens
  s = s.replace(/^[,\.\:\;\?\s]+|[,\.\:\;\?\s]+$/g, "");

  return s.trim().toLowerCase();
}

/**
 * Extracts key dates, numbers, negations and semantic anchor tokens
 */
export function extractCrucialEntities(text: string) {
  const normalized = normalizeQuestionText(text);

  // Detect years (e.g. 2011, 2021, 2023-24, 2022-2023)
  const yearMatches = normalized.match(/\b(19\d{2}|20\d{2}(?:-\d{2,4})?)\b/g) || [];

  // Detect other key numbers / percentages
  const numberMatches = normalized.match(/\b\d+(?:\.\d+)?%?\b/g) || [];

  // Detect negations
  const isNegative =
    /\b(not|incorrect|false|except|never|wrong)\b/i.test(normalized) ||
    /(नहीं|असत्य|गलत|अपवाद|सुमेलित नहीं|कथन गलत)/.test(text);

  // Stop words for Hindi & English to isolate core nouns / concepts
  const stopWords = new Set([
    "the", "is", "at", "which", "on", "a", "an", "and", "or", "in", "of", "to", "for", "with",
    "का", "के", "की", "में", "से", "पर", "को", "है", "हैं", "था", "थी", "थे", "और", "या", "तथा",
    "एवं", "द्वारा", "निम्नलिखित", "निम्न", "कौन", "सा", "सी", "से", "क्या", "बताइए", "चयन", "करें", "कीजिए",
    "which", "what", "how", "when", "where", "following", "correct", "statement", "true"
  ]);

  const rawTokens = normalized
    .replace(/[^\w\s\u0900-\u097F]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1 && !stopWords.has(t));

  return {
    years: Array.from(new Set(yearMatches)),
    numbers: Array.from(new Set(numberMatches)),
    isNegative,
    tokens: new Set(rawTokens),
    tokenList: rawTokens,
  };
}

/**
 * Calculate Jaccard similarity between two token sets
 */
export function calculateTokenJaccard(tokensA: Set<string>, tokensB: Set<string>): number {
  if (tokensA.size === 0 && tokensB.size === 0) return 1.0;
  if (tokensA.size === 0 || tokensB.size === 0) return 0.0;

  let intersection = 0;
  for (const t of tokensA) {
    if (tokensB.has(t)) intersection++;
  }
  const union = tokensA.size + tokensB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

/**
 * Levenshtein Distance for normalized character similarity
 */
export function calculateLevenshteinSimilarity(s1: string, s2: string): number {
  if (s1 === s2) return 1.0;
  if (!s1.length || !s2.length) return 0.0;

  const longer = s1.length > s2.length ? s1 : s2;
  const shorter = s1.length > s2.length ? s2 : s1;

  if (longer.length === 0) return 1.0;

  // Use limited matrix to keep fast
  const maxLen = 350;
  const a = longer.slice(0, maxLen);
  const b = shorter.slice(0, maxLen);

  const costs = new Array(b.length + 1);
  for (let j = 0; j <= b.length; j++) costs[j] = j;

  for (let i = 1; i <= a.length; i++) {
    costs[0] = i;
    let nw = i - 1;
    for (let j = 1; j <= b.length; j++) {
      const cj = Math.min(
        1 + Math.min(costs[j], costs[j - 1]),
        a[i - 1] === b[j - 1] ? nw : nw + 1
      );
      nw = costs[j];
      costs[j] = cj;
    }
  }

  const distance = costs[b.length];
  return Math.max(0, (longer.length - distance) / longer.length);
}

/**
 * Deterministic multi-stage comparison with strict precedence
 */
export function compareQuestionsDeterministic(
  examText: string,
  qbText: string,
  examOptions: string[] = [],
  qbOptions: string[] = []
): {
  category: ExamMatchCategory;
  score: number;
  differences: string[];
  explanation: string;
} {
  const normExam = normalizeQuestionText(examText);
  const normQb = normalizeQuestionText(qbText);

  const examEnt = extractCrucialEntities(examText);
  const qbEnt = extractCrucialEntities(qbText);

  const differences: string[] = [];

  // Check 1: Negation mismatch (e.g., "Which is true" vs "Which is NOT true")
  if (examEnt.isNegative !== qbEnt.isNegative) {
    differences.push(
      examEnt.isNegative
        ? "Exam question is a negative inquiry (NOT/नहीं/गलत), while Question Bank question is positive."
        : "Question Bank question is a negative inquiry (NOT/नहीं/गलत), while Exam question is positive."
    );
  }

  // Check 2: Year mismatch (e.g., 2021-22 vs 2023-24)
  const differentYears = examEnt.years.filter((y) => !qbEnt.years.includes(y));
  const missingYears = qbEnt.years.filter((y) => !examEnt.years.includes(y));
  if (differentYears.length > 0 || missingYears.length > 0) {
    differences.push(
      `Different reference years/dates: Exam (${examEnt.years.join(", ") || "none"}) vs Question Bank (${qbEnt.years.join(", ") || "none"}).`
    );
  }

  // Check 3: Crucial Numbers mismatch (e.g. rate 11.04% vs 14.8%)
  const examOnlyNums = examEnt.numbers.filter(
    (n) => !qbEnt.numbers.includes(n) && !examEnt.years.includes(n)
  );
  const qbOnlyNums = qbEnt.numbers.filter(
    (n) => !examEnt.numbers.includes(n) && !qbEnt.years.includes(n)
  );
  if (examOnlyNums.length > 0 && qbOnlyNums.length > 0) {
    differences.push(
      `Different numerical values or statistics tested: [${examOnlyNums.slice(0, 2).join(", ")}] vs [${qbOnlyNums.slice(0, 2).join(", ")}].`
    );
  }

  // Check 4: Check string equivalence & Options overlap
  const levSim = calculateLevenshteinSimilarity(normExam, normQb);
  const jaccardSim = calculateTokenJaccard(examEnt.tokens, qbEnt.tokens);

  // Check 5: Answer options comparison (when available)
  let optionOverlapCount = 0;
  if (Array.isArray(examOptions) && Array.isArray(qbOptions) && examOptions.length > 0 && qbOptions.length > 0) {
    const normExamOpts = examOptions.map(normalizeQuestionText).filter(Boolean);
    const normQbOpts = qbOptions.map(normalizeQuestionText).filter(Boolean);
    for (const opt of normExamOpts) {
      if (normQbOpts.includes(opt)) {
        optionOverlapCount++;
      }
    }
  }

  // Exact Match: Identical normalized string without meaningful differences
  if (normExam === normQb && differences.length === 0) {
    return {
      category: "exact",
      score: 100,
      differences: [],
      explanation: "शब्द-दर-शब्द पूर्ण मेल (Exact Match): प्रश्न का मूल स्वरूप और वाक्य-विन्यास पूर्णतः समान है।",
    };
  }

  // Near-Exact Match: Slight punctuation, word-order or trivial filler variation, but identical facts/entities/answer
  if (differences.length === 0 && (levSim >= 0.88 || (jaccardSim >= 0.80 && levSim >= 0.75))) {
    return {
      category: "near_exact",
      score: Math.round(Math.max(levSim, jaccardSim) * 100),
      differences: ["Minor phrasing or formatting variation; tested fact and entity remain identical."],
      explanation: "समीपस्थ मेल (Near-Exact Match): केवल शब्दों या विराम-चिह्नों का मामूली अंतर है, परीक्षित तथ्य और उत्तर पूर्णतः समान हैं।",
    };
  }

  // Similar Question: Same fact or equivalent problem structure, but differences exist
  // Cannot be similar if crucial negations or reference dates differ!
  if (differences.length === 0 && (jaccardSim >= 0.55 || levSim >= 0.65 || (jaccardSim >= 0.40 && optionOverlapCount >= 3))) {
    return {
      category: "similar",
      score: Math.round(Math.max(levSim, jaccardSim) * 90),
      differences: ["Different wording or question framing used for the same factual query."],
      explanation: "समान प्रश्न (Similar Question): वाक्य संरचना भिन्न है, किंतु दोनों समान तथ्य या अवधारणा का परीक्षण करते हैं।",
    };
  }

  // Concept-Related Question:
  // Either they have differences in dates/negation/aspect, but share substantial domain keywords or option choices
  // or they refer to the same scheme/act/institution (e.g. GSDP, Constitution, FRBM, PM-KUSUM)
  const hasSubstantialConceptMatch =
    jaccardSim >= 0.28 ||
    levSim >= 0.42 ||
    optionOverlapCount >= 2 ||
    (jaccardSim >= 0.18 && optionOverlapCount >= 1) ||
    (jaccardSim >= 0.18 && (normExam.includes("संविधान") && normQb.includes("संविधान") || normExam.includes("gsdp") && normQb.includes("gsdp")));

  if (hasSubstantialConceptMatch) {
    const reasonParts = [];
    if (differences.length > 0) reasonParts.push(differences.join(" "));
    reasonParts.push("Both questions test related dimensions of the same subject topic/concept.");

    return {
      category: "concept_related",
      score: Math.round(Math.max(30, Math.min(80, Math.max(jaccardSim * 100, optionOverlapCount * 25)))),
      differences: differences.length > 0 ? differences : ["Tests a different dimension, year, or application of the same core concept."],
      explanation: `संबद्ध अवधारणा (Related Concept): दोनों प्रश्न समान विषय/अवधारणा से संबंधित हैं, किंतु भिन्न पहलू या आंकड़ों की जांच करते हैं। ${differences.length > 0 ? `(${differences[0]})` : ""}`,
    };
  }

  // Unmatched
  return {
    category: "unmatched",
    score: Math.round(jaccardSim * 100),
    differences: differences.length > 0 ? differences : ["No relevant question found in Question Bank."],
    explanation: "कोई विश्वसनीय मेल नहीं (No Reliable Match): यह प्रश्न प्रश्न-बैंक के उपलब्ध प्रश्नों से मेल नहीं खाता।",
  };
}

/**
 * Searches Question Bank to find top candidate matches for an extracted exam question
 */
export function matchQuestionAgainstBank(
  examDraft: ExtractedQuestionDraft,
  questionBank: Question[]
): ExamQuestionMatch {
  if (!questionBank || questionBank.length === 0) {
    return {
      examQuestionId: examDraft.tempId,
      originalQuestionNumber: examDraft.originalQuestionNumber,
      sourcePageNumber: examDraft.sourcePageNumber,
      originalText: examDraft.originalText,
      normalizedText: normalizeQuestionText(examDraft.originalText),
      extractedOptions: examDraft.extractedOptions || [],
      ocrStatus: examDraft.ocrStatus,
      reviewStatus: "pending",
      primaryMatchCategory: "unmatched",
      matchScore: 0,
      matchExplanation: "प्रश्न बैंक रिक्त है या कोई प्रश्न उपलब्ध नहीं है।",
      meaningfulDifferences: [],
      processingStatus: "completed",
    };
  }

  type Candidate = {
    question: Question;
    category: ExamMatchCategory;
    score: number;
    differences: string[];
    explanation: string;
  };

  const candidates: Candidate[] = [];

  for (const qbQuestion of questionBank) {
    const qText = qbQuestion.text || (qbQuestion as any).question || "";
    const qOptions = qbQuestion.options || [];
    const res = compareQuestionsDeterministic(
      examDraft.originalText,
      qText,
      examDraft.extractedOptions,
      qOptions
    );

    if (res.category !== "unmatched" || res.score >= 20) {
      candidates.push({
        question: qbQuestion,
        category: res.category,
        score: res.score,
        differences: res.differences,
        explanation: res.explanation,
      });
    }
  }

  // Sort candidates by category precedence and then by score
  const categoryRank: Record<ExamMatchCategory, number> = {
    exact: 5,
    near_exact: 4,
    similar: 3,
    concept_related: 2,
    unmatched: 1,
  };

  candidates.sort((a, b) => {
    const rankDiff = categoryRank[b.category] - categoryRank[a.category];
    if (rankDiff !== 0) return rankDiff;
    return b.score - a.score;
  });

  const best = candidates[0];

  if (!best || best.category === "unmatched") {
    return {
      examQuestionId: examDraft.tempId,
      originalQuestionNumber: examDraft.originalQuestionNumber,
      sourcePageNumber: examDraft.sourcePageNumber,
      originalText: examDraft.originalText,
      normalizedText: normalizeQuestionText(examDraft.originalText),
      extractedOptions: examDraft.extractedOptions || [],
      ocrStatus: examDraft.ocrStatus,
      reviewStatus: "pending",
      primaryMatchCategory: "unmatched",
      matchScore: best ? best.score : 0,
      matchExplanation: "प्रश्न-बैंक में इस प्रश्न के लिए कोई विश्वसनीय मेल नहीं मिला।",
      meaningfulDifferences: [],
      processingStatus: "completed",
    };
  }

  // Build alternatives (max 3)
  const alternatives = candidates.slice(1, 4).map((c) => ({
    questionId: c.question.id,
    category: c.category,
    score: c.score,
    explanation: c.explanation,
    questionText: c.question.text || (c.question as any).question || "",
  }));

  const isAmbiguous =
    alternatives.length > 0 &&
    Math.abs(best.score - alternatives[0].score) <= 5 &&
    best.category !== "exact";

  return {
    examQuestionId: examDraft.tempId,
    originalQuestionNumber: examDraft.originalQuestionNumber,
    sourcePageNumber: examDraft.sourcePageNumber,
    originalText: examDraft.originalText,
    normalizedText: normalizeQuestionText(examDraft.originalText),
    extractedOptions: examDraft.extractedOptions || [],
    ocrStatus: examDraft.ocrStatus,
    reviewStatus: isAmbiguous ? "pending" : "pending",
    primaryMatchCategory: best.category,
    bestMatchQuestionId: best.question.id,
    bestMatchQuestion: {
      id: best.question.id,
      text: best.question.text || (best.question as any).question || "",
      options: best.question.options || [],
      correctIndex: best.question.correctIndex ?? (best.question as any).correctOptionIndex ?? 0,
      explanation: best.question.explanation || "",
      subjectId: best.question.subjectId,
      chapterId: best.question.chapterId,
      topicId: best.question.topicId,
      conceptName: best.question.conceptName,
      difficulty: best.question.difficulty,
    },
    alternativeMatches: alternatives,
    matchScore: best.score,
    matchExplanation: best.explanation,
    meaningfulDifferences: best.differences,
    processingStatus: isAmbiguous ? "needs_review" : "completed",
  };
}

/**
 * Calculates mutually exclusive counts and coverage percentages:
 * Exact Coverage = (Exact / Total) * 100
 * Near-Exact Coverage = ((Exact + Near-Exact) / Total) * 100
 * Related Coverage = ((Exact + Near-Exact + Similar + Concept) / Total) * 100
 */
export function calculateCoverageMetrics(questions: ExamQuestionMatch[]) {
  const total = questions.length;
  if (total === 0) {
    return {
      total: 0,
      exact: 0,
      nearExact: 0,
      similar: 0,
      concept: 0,
      unmatched: 0,
      needsReview: 0,
      exactCoverage: 0,
      nearExactCoverage: 0,
      relatedCoverage: 0,
    };
  }

  let exact = 0;
  let nearExact = 0;
  let similar = 0;
  let concept = 0;
  let unmatched = 0;
  let needsReview = 0;

  for (const q of questions) {
    if (q.processingStatus === "needs_review" || q.reviewStatus === "pending" && q.primaryMatchCategory === "unmatched") {
      // counted as unmatched unless confirmed
    }

    if (q.primaryMatchCategory === "exact") exact++;
    else if (q.primaryMatchCategory === "near_exact") nearExact++;
    else if (q.primaryMatchCategory === "similar") similar++;
    else if (q.primaryMatchCategory === "concept_related") concept++;
    else unmatched++;

    if (q.processingStatus === "needs_review") needsReview++;
  }

  const exactCoverage = Math.round((exact / total) * 1000) / 10;
  const nearExactCoverage = Math.round(((exact + nearExact) / total) * 1000) / 10;
  const relatedCoverage =
    Math.round(((exact + nearExact + similar + concept) / total) * 1000) / 10;

  return {
    total,
    exact,
    nearExact,
    similar,
    concept,
    unmatched,
    needsReview,
    exactCoverage,
    nearExactCoverage,
    relatedCoverage,
  };
}
