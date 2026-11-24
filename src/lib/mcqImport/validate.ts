import { MCQImportQuestion, ImportErrorCategory, ImportReviewCategory } from "./schema";

export interface QuestionValidationResult {
  isValid: boolean;
  needsReview: boolean;
  reviewCategory: ImportReviewCategory;
  errorCategories: ImportErrorCategory[];
  errors: string[];
  warnings: string[];
  correctIndex: number;
}

const SUPPORTED_TYPES = new Set([
  "single_correct",
  "direct",
  "standard",
  "statement_based",
  "statement",
  "multiple_statements",
  "assertion_reason",
  "match_list",
  "match_following",
  "match_column",
  "math",
  "geometry",
  "diagram_based",
  "figure_based",
  "image_based",
  "graph_based",
  "numerical",
  "sequence",
  "case_based",
  "passage",
  "passage_based",
  "image_reference",
  "table_based",
  "true_false",
  "boolean",
  "fill_blank",
  "bilingual",
  "simple",
]);

/**
 * Validates a single normalized MCQ question (Structural + Semantic Validation).
 * Never defaults missing/invalid answer to 0; returns correctIndex = -1 when missing/invalid.
 */
export interface QuestionValidationContext {
  curriculum?: {
    subjects?: { id: string; name?: string; hindiName?: string }[];
    chapters?: { id: string; subjectId?: string; title?: string; hindiTitle?: string }[];
    topics?: { id: string; chapterId?: string; subjectId?: string; title?: string; hindiTitle?: string }[];
  };
  targetSubjectId?: string;
  targetChapterId?: string;
  targetTopicId?: string;
}

export const validateQuestion = (
  q: MCQImportQuestion,
  questionNumber: number = 1,
  context?: QuestionValidationContext
): QuestionValidationResult => {
  const errors: string[] = [];
  const warnings: string[] = [];
  const categorySet = new Set<ImportErrorCategory>();
  let needsReview = false;

  const addCategory = (cat: ImportErrorCategory) => categorySet.add(cat);

  // 0. Check Unsupported Question Type first
  if (q.unsupportedReason || (q.type && q.type.toLowerCase() === "unsupported")) {
    addCategory("Unsupported Question Type");
    errors.push(
      `Q${questionNumber}: ${q.unsupportedReason || `Question type "${q.type}" is not supported.`}`
    );
  } else if (q.type && !SUPPORTED_TYPES.has(q.type.toLowerCase())) {
    addCategory("Unsupported Question Type");
    addCategory("Review Required");
    warnings.push(`Q${questionNumber}: Question type "${q.type}" is non-standard; please review before importing.`);
    needsReview = true;
  }

  // 1. Question text validation (Structural + Semantic)
  if (!q.question || q.question.trim().length === 0) {
    addCategory("Missing Field");
    errors.push(`Q${questionNumber}: Question text is missing.`);
  } else {
    const trimmedQ = q.question.trim();
    if (trimmedQ.length < 3) {
      addCategory("Review Required");
      warnings.push(`Q${questionNumber}: Question text is unusually short ("${trimmedQ}").`);
      needsReview = true;
    }

    const textLower = trimmedQ.toLowerCase();
    const keywords = ["तालिका", "सारणी", "चित्र", "ग्राफ", "आलेख", "table", "figure", "diagram", "graph", "chart"];
    const hasKeyword = keywords.some((kw) => textLower.includes(kw));
    if (hasKeyword) {
      const hasStructuredTable = !!(q.table || (q as any).tableData || q.matchTable);
      const hasImageOrDiagram = !!(
        (q as any).image ||
        (q as any).imageUrl ||
        (q as any).diagram ||
        q.question.includes("[diagram:") ||
        q.question.includes("[image:") ||
        q.question.includes("[चित्र:")
      );
      const newlinesCount = (q.question.match(/\n/g) || []).length;
      const hasArrow = q.question.includes("->");
      if (!hasStructuredTable && !hasImageOrDiagram && newlinesCount < 2 && !hasArrow) {
        addCategory("Review Required");
        warnings.push(`Q${questionNumber}: Question refers to a table/figure; ensure diagram or table data is attached.`);
        needsReview = true;
      }
    }
  }

  // 2. Options validation (Structural + Semantic)
  if (!Array.isArray(q.options) || q.options.length < 2) {
    addCategory("Missing Field");
    errors.push(`Q${questionNumber}: Must have at least 2 options (found ${q.options?.length || 0}).`);
  } else if (q.options.length > 5) {
    addCategory("Invalid Option Mapping");
    errors.push(`Q${questionNumber}: Cannot have more than 5 options (found ${q.options.length}).`);
  } else {
    // Check for empty options
    const emptyIndices = q.options
      .map((opt, i) => (String(opt ?? "").trim().length === 0 ? ["A", "B", "C", "D", "E"][i] : null))
      .filter(Boolean);
    if (emptyIndices.length > 0) {
      addCategory("Missing Field");
      errors.push(`Q${questionNumber}: Option ${emptyIndices.join(", ")} text is empty.`);
    }

    // Check for duplicate option texts
    const seen = new Set<string>();
    const dupes = new Set<string>();
    q.options.forEach((opt) => {
      const lower = String(opt ?? "").trim().toLowerCase();
      if (lower.length > 0) {
        if (seen.has(lower)) {
          dupes.add(String(opt).trim());
        }
        seen.add(lower);
      }
    });
    if (dupes.size > 0) {
      addCategory("Invalid Option Mapping");
      addCategory("Review Required");
      errors.push(`Q${questionNumber}: Duplicate option text detected: "${Array.from(dupes).join('", "')}".`);
      needsReview = true;
    }

    // Check if an option is identical to the question stem
    if (q.question && q.question.trim().length > 0) {
      const qNorm = q.question.trim().toLowerCase();
      const sameAsQ = q.options.some((opt) => String(opt ?? "").trim().toLowerCase() === qNorm);
      if (sameAsQ) {
        addCategory("Invalid Option Mapping");
        addCategory("Review Required");
        warnings.push(`Q${questionNumber}: One of the options is identical to the question stem.`);
        needsReview = true;
      }
    }
  }

  // 3. Answer resolution (NEVER fabricate or default missing answer to 0)
  const letterMap: Record<string, number> = { A: 0, B: 1, C: 2, D: 3, E: 4 };
  let correctIndex = typeof q.correctIndex === "number" && q.correctIndex >= 0 ? q.correctIndex : -1;

  if ((!q.answer || q.answer.trim().length === 0) && correctIndex < 0) {
    addCategory("Missing Field");
    addCategory("Invalid Answer");
    errors.push(`Q${questionNumber}: Correct answer is missing. Please select the correct option.`);
  } else if (q.answer && q.answer.trim().length > 0) {
    const upperAns = q.answer.trim().toUpperCase();
    if (letterMap[upperAns] !== undefined) {
      correctIndex = letterMap[upperAns];
      if (Array.isArray(q.options) && q.options.length >= 2 && correctIndex >= q.options.length) {
        addCategory("Invalid Answer");
        errors.push(
          `Q${questionNumber}: Answer Option ${upperAns} exceeds available options count (${q.options.length}).`
        );
        correctIndex = -1;
      }
    } else if (Array.isArray(q.options) && q.options.length > 0) {
      const matchedIdx = q.options.findIndex(
        (o) => String(o ?? "").trim().toLowerCase() === q.answer.trim().toLowerCase()
      );
      if (matchedIdx >= 0) {
        correctIndex = matchedIdx;
      } else {
        addCategory("Invalid Answer");
        errors.push(`Q${questionNumber}: Answer "${q.answer}" does not match A–E or any option text.`);
        correctIndex = -1;
      }
    } else {
      addCategory("Invalid Answer");
      errors.push(`Q${questionNumber}: Answer "${q.answer}" must be A, B, C, D, or E.`);
      correctIndex = -1;
    }
  } else if (correctIndex >= 0 && Array.isArray(q.options) && q.options.length >= 2 && correctIndex >= q.options.length) {
    addCategory("Invalid Answer");
    errors.push(
      `Q${questionNumber}: Correct index (${correctIndex}) exceeds available options count (${q.options.length}).`
    );
    correctIndex = -1;
  }

  // Check ambiguous answer warnings from normalizer
  if (q.ambiguousAnswerWarning) {
    addCategory("Invalid Option Mapping");
    addCategory("Review Required");
    warnings.push(`Q${questionNumber}: ${q.ambiguousAnswerWarning}`);
    needsReview = true;
  }

  // 4. Semantic Validation for Special Question Types
  const qTypeLower = (q.type || q.questionType || "single_correct").toLowerCase();

  // 4a. Assertion-Reason validation
  if (qTypeLower === "assertion_reason") {
    const hasARFields = Boolean(q.assertion && q.reason);
    const hasARInText =
      /(?:अभिकथन|Assertion|कथन\s*\(?A\)?)/i.test(q.question || "") &&
      /(?:कारण|Reason|कथन\s*\(?R\)?)/i.test(q.question || "");
    if (!hasARFields && !hasARInText) {
      addCategory("Missing Field");
      addCategory("Review Required");
      warnings.push(`Q${questionNumber}: Marked as Assertion-Reason, but Assertion (A) or Reason (R) could not be clearly separated.`);
      needsReview = true;
    }
  }

  // 4b. Statement-Based validation
  if (qTypeLower === "statement_based" || qTypeLower === "statement" || qTypeLower === "multiple_statements") {
    const hasStmtsArray = Array.isArray(q.statements) && q.statements.length >= 2;
    const hasStmtsInText = /(?:^|\n)\s*(?:1[.)]|\(1\)|I[.)]|कथन\s*1|Statement\s*1)/im.test(q.question || "");
    if (!hasStmtsArray && !hasStmtsInText) {
      addCategory("Review Required");
      warnings.push(`Q${questionNumber}: Marked as Statement-Based, but numbered statements were not clearly detected.`);
      needsReview = true;
    }
  }

  // 4c. Match the Following validation
  if (qTypeLower === "match_following" || qTypeLower === "match_list" || qTypeLower === "match_column" || q.matchTable) {
    if (q.matchingErrorWarning) {
      addCategory("Matching Mapping Error");
      addCategory("Review Required");
      warnings.push(`Q${questionNumber}: ${q.matchingErrorWarning}`);
      needsReview = true;
    }
    if (!q.matchTable || !Array.isArray(q.matchTable.rows) || q.matchTable.rows.length < 2) {
      addCategory("Matching Mapping Error");
      addCategory("Review Required");
      warnings.push(
        `Q${questionNumber}: Match the Following question does not have a structured matchTable (at least 2 rows expected).`
      );
      needsReview = true;
    } else {
      const emptyRowIdx = q.matchTable.rows.findIndex(
        (r) => !r || !String(r.left ?? "").trim() || !String(r.right ?? "").trim()
      );
      if (emptyRowIdx >= 0) {
        addCategory("Matching Mapping Error");
        errors.push(`Q${questionNumber}: Match table row ${emptyRowIdx + 1} has an empty left or right entry.`);
      }
    }
  }

  // 5. LaTeX Balance Warning
  if (q.question) {
    const dollarCount = (q.question.match(/\$/g) || []).length;
    if (dollarCount % 2 !== 0) {
      addCategory("Review Required");
      warnings.push(`Q${questionNumber}: Question text has unbalanced LaTeX '$' symbols.`);
      needsReview = true;
    }
  }

  // 6. OCR Uncertainty warnings
  if (Array.isArray(q.ocrUncertainties) && q.ocrUncertainties.length > 0) {
    addCategory("OCR Uncertainty");
    addCategory("Review Required");
    q.ocrUncertainties.forEach((msg) => {
      warnings.push(`Q${questionNumber}: [OCR/Text Review] ${msg}`);
    });
    needsReview = true;
  }

  // 7. Image / SVG validation
  if (q.image && typeof q.image === "object") {
    if (q.image.type === "svg" || q.image.svg) {
      const svgStr = String(q.image.svg || "").trim();
      if (!svgStr || !svgStr.toLowerCase().includes("<svg") || !svgStr.toLowerCase().includes("</svg>")) {
        addCategory("Critical Error");
        errors.push(`Q${questionNumber}: Image/SVG object has invalid or incomplete SVG markup.`);
      }
    }
  }

  // 8. Table validation
  if (q.tableErrorWarning) {
    addCategory("Table Parsing Error");
    addCategory("Review Required");
    warnings.push(`Q${questionNumber}: ${q.tableErrorWarning}`);
    needsReview = true;
  }

  const rawTable = q.table || (q as any).tableData;
  if (rawTable !== undefined && rawTable !== null) {
    if (typeof rawTable !== "object" || Array.isArray(rawTable)) {
      addCategory("Table Parsing Error");
      errors.push(`Q${questionNumber}: "table" present but not an object.`);
    } else {
      const headers = rawTable.headers;
      const rows = rawTable.rows;

      if (!headers || !Array.isArray(headers) || headers.length === 0) {
        addCategory("Table Parsing Error");
        errors.push(`Q${questionNumber}: table missing headers.`);
      } else if (headers.length < 2 || headers.length > 8) {
        addCategory("Table Parsing Error");
        errors.push(`Q${questionNumber}: table headers must be between 2 and 8 columns (found ${headers.length}).`);
      }

      if (!rows || !Array.isArray(rows) || rows.length === 0) {
        addCategory("Table Parsing Error");
        errors.push(`Q${questionNumber}: table missing rows.`);
      } else if (rows.length > 20) {
        addCategory("Table Parsing Error");
        warnings.push(`Q${questionNumber}: table has ${rows.length} rows; please verify rendering.`);
        needsReview = true;
      }

      if (
        headers &&
        Array.isArray(headers) &&
        headers.length >= 2 &&
        headers.length <= 8 &&
        rows &&
        Array.isArray(rows) &&
        rows.length >= 1
      ) {
        const headerCount = headers.length;
        rows.forEach((row: any, rIdx: number) => {
          const rowNum = rIdx + 1;
          const cells = Array.isArray(row)
            ? row
            : row && typeof row === "object" && Array.isArray(row.cells)
            ? row.cells
            : null;
          if (!cells) {
            addCategory("Table Parsing Error");
            errors.push(`Q${questionNumber}: table row ${rowNum} is invalid or missing cells.`);
          } else if (cells.length !== headerCount) {
            addCategory("Table Parsing Error");
            errors.push(`Q${questionNumber}: table row ${rowNum} has ${cells.length} cells but ${headerCount} headers.`);
          }
        });
      }
    }
  }

  // 9. Explanation warning (non-blocking)
  if (!q.explanation || q.explanation.trim().length === 0) {
    warnings.push(`Q${questionNumber}: Explanation is empty (optional).`);
  }

  // 10. Exam History & Classification validation
  if (Array.isArray(q.examHistory) && q.examHistory.length > 0) {
    q.examHistory.forEach((item, eIdx) => {
      if (!item.examName || !String(item.examName).trim()) {
        errors.push(`Q${questionNumber}: Exam entry #${eIdx + 1} has an empty exam name.`);
      }
      if (item.year !== undefined && item.year !== null) {
        const yrNum = typeof item.year === "number" ? item.year : parseInt(String(item.year), 10);
        if (isNaN(yrNum) || yrNum < 1950 || yrNum > 2035) {
          warnings.push(`Q${questionNumber}: Exam "${item.examName}" has unusual year "${item.year}".`);
        }
      }
      if (item.verified === false) {
        warnings.push(`Q${questionNumber}: Exam "${item.examName}" is marked as unverified; please review.`);
        needsReview = true;
      }
    });
  }

  // 11. Subject, Chapter, Topic Validation
  const hasExplicitTarget = Boolean(
    (context?.targetTopicId && context.targetTopicId.trim()) ||
    (context?.targetChapterId && context.targetChapterId.trim()) ||
    (context?.targetSubjectId && context.targetSubjectId.trim() && context.targetSubjectId !== "all") ||
    ((q as any).topicId && String((q as any).topicId).trim()) ||
    ((q as any).chapterId && String((q as any).chapterId).trim()) ||
    ((q as any).subjectId && String((q as any).subjectId).trim())
  );

  // If a target topic or chapter has been explicitly selected in the UI or set on the question,
  // do not penalize or spam warnings for raw text metadata discrepancies.
  if (context?.curriculum && !hasExplicitTarget) {
    const { subjects = [], chapters = [], topics = [] } = context.curriculum;
    if (q.subject && String(q.subject).trim() && subjects.length > 0) {
      const sLower = String(q.subject).trim().toLowerCase();
      const matched = subjects.some(
        (s) => (s.id && s.id.toLowerCase() === sLower) || (s.name && s.name.toLowerCase() === sLower) || (s.hindiName && s.hindiName.toLowerCase() === sLower)
      );
      if (!matched) {
        warnings.push(`Q${questionNumber}: Subject "${q.subject}" could not be mapped to any existing subject in curriculum.`);
      }
    }

    if (q.chapter && String(q.chapter).trim() && chapters.length > 0) {
      const cLower = String(q.chapter).trim().toLowerCase();
      const matched = chapters.some(
        (c) => (c.id && c.id.toLowerCase() === cLower) || (c.title && c.title.toLowerCase() === cLower) || (c.hindiTitle && c.hindiTitle.toLowerCase() === cLower)
      );
      if (!matched) {
        warnings.push(`Q${questionNumber}: Chapter "${q.chapter}" could not be mapped to any existing chapter in curriculum.`);
      }
    }

    if (q.topic && String(q.topic).trim() && topics.length > 0) {
      const tLower = String(q.topic).trim().toLowerCase();
      const matched = topics.some(
        (t) => (t.id && t.id.toLowerCase() === tLower) || (t.title && t.title.toLowerCase() === tLower) || (t.hindiTitle && t.hindiTitle.toLowerCase() === tLower)
      );
      if (!matched) {
        warnings.push(`Q${questionNumber}: Topic "${q.topic}" could not be mapped to any existing topic in curriculum.`);
      }
    }
  }

  const isValid = errors.length === 0 && correctIndex >= 0;

  let reviewCategory: ImportReviewCategory = "ready";
  if (categorySet.has("Unsupported Question Type") && !isValid) {
    reviewCategory = "unsupported";
  } else if (!isValid) {
    reviewCategory = "invalid";
  } else if (needsReview) {
    reviewCategory = "needs_review";
  }

  return {
    isValid,
    needsReview: !isValid || needsReview,
    reviewCategory,
    errorCategories: Array.from(categorySet),
    errors,
    warnings,
    correctIndex: isValid || correctIndex >= 0 ? correctIndex : -1,
  };
};

