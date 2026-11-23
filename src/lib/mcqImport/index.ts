import { MCQImportSchema, ValidatedQuestionResult } from "./schema";
import { normalizeQuestion } from "./normalize";
import { validateQuestion } from "./validate";
import { generateQuestionHash } from "./dedupe";
import { commitQuestions, undoImportBatch } from "./commit";

export * from "./schema";
export * from "./normalize";
export * from "./validate";
export * from "./dedupe";
export * from "./commit";
export * from "./smartImport";
export * from "./examDetector";

/**
 * Safely escapes unescaped control characters (literal newlines, carriage returns, tabs)
 * inside string literals to ensure valid RFC 8259 JSON compliance.
 */
export function escapeControlCharsInStrings(jsonStr: string): string {
  if (!jsonStr) return "";
  let result = "";
  let inString = false;
  let escape = false;

  for (let i = 0; i < jsonStr.length; i++) {
    const ch = jsonStr[i];
    if (escape) {
      result += ch;
      escape = false;
      continue;
    }
    if (ch === "\\") {
      result += ch;
      if (inString) escape = true;
      continue;
    }
    if (ch === "\"") {
      inString = !inString;
      result += ch;
      continue;
    }
    if (inString) {
      if (ch === "\n") {
        result += "\\n";
      } else if (ch === "\r") {
        result += "\\r";
      } else if (ch === "\t") {
        result += "\\t";
      } else {
        result += ch;
      }
    } else {
      result += ch;
    }
  }
  return result;
}

/**
 * Strips trailing commas before } or ] outside string literals.
 */
export function cleanTrailingCommas(jsonStr: string): string {
  if (!jsonStr) return "";
  let result = "";
  let inString = false;
  let escape = false;

  for (let i = 0; i < jsonStr.length; i++) {
    const ch = jsonStr[i];
    if (escape) {
      result += ch;
      escape = false;
      continue;
    }
    if (ch === "\\") {
      result += ch;
      if (inString) escape = true;
      continue;
    }
    if (ch === "\"") {
      inString = !inString;
      result += ch;
      continue;
    }
    if (!inString && ch === ",") {
      let nextIdx = i + 1;
      while (nextIdx < jsonStr.length && /\s/.test(jsonStr[nextIdx])) {
        nextIdx++;
      }
      if (nextIdx < jsonStr.length && (jsonStr[nextIdx] === "}" || jsonStr[nextIdx] === "]")) {
        continue;
      }
    }
    result += ch;
  }
  return result;
}

/**
 * Parses raw JSON string and returns detailed syntax error with line/column position if invalid.
 */
export function parseJSONWithLocation(rawText: string): { data: any; error?: string } {
  if (!rawText || !rawText.trim()) {
    return { data: null, error: "JSON input is empty. Please paste valid JSON." };
  }

  let text = rawText.trim();
  // Strip UTF-8 BOM if present
  if (text.charCodeAt(0) === 0xFEFF) {
    text = text.slice(1);
  }

  // 1. Try direct parse first
  try {
    const data = JSON.parse(text);
    return { data };
  } catch (err: any) {
    // 2. Extract from markdown code fence anywhere in text: ```json ... ``` or ``` ... ```
    const codeFenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    if (codeFenceMatch && codeFenceMatch[1]) {
      const fenceContent = codeFenceMatch[1].trim();
      try {
        const data = JSON.parse(fenceContent);
        return { data };
      } catch (_) {
        try {
          const cleaned = cleanTrailingCommas(escapeControlCharsInStrings(fenceContent));
          const data = JSON.parse(cleaned);
          return { data };
        } catch (_) {}
      }
    }

    // 3. Try parsing with control characters escaped and trailing commas cleaned
    try {
      const escaped = escapeControlCharsInStrings(text);
      const cleaned = cleanTrailingCommas(escaped);
      const data = JSON.parse(cleaned);
      return { data };
    } catch (_) {}

    // 4. Attempt multi-block JSON extraction (handles multiple JSON objects or arrays pasted sequentially)
    const blocks = extractTopLevelJSONBlocks(text);
    if (blocks.length > 1) {
      return { data: { isMultiBlock: true, blocks } };
    } else if (blocks.length === 1) {
      return { data: blocks[0] };
    }

    // 5. Attempt extracting candidate JSON block (from first { or [ to last } or ])
    const firstBrace = text.indexOf("{");
    const firstBracket = text.indexOf("[");
    let startIdx = -1;
    if (firstBrace !== -1 && firstBracket !== -1) {
      startIdx = Math.min(firstBrace, firstBracket);
    } else if (firstBrace !== -1) {
      startIdx = firstBrace;
    } else if (firstBracket !== -1) {
      startIdx = firstBracket;
    }

    if (startIdx !== -1) {
      const lastBrace = text.lastIndexOf("}");
      const lastBracket = text.lastIndexOf("]");
      const endIdx = Math.max(lastBrace, lastBracket);
      if (endIdx > startIdx) {
        const extracted = text.substring(startIdx, endIdx + 1);
        try {
          const data = JSON.parse(extracted);
          return { data };
        } catch (_) {
          try {
            const cleaned = cleanTrailingCommas(escapeControlCharsInStrings(extracted));
            const data = JSON.parse(cleaned);
            return { data };
          } catch (_) {}
        }
      }
    }

    const msg = err.message || "Invalid JSON";
    const posMatch = msg.match(/position\s+(\d+)/i) || msg.match(/at\s+(\d+)/i);
    let line = 1;
    let col = 1;

    if (posMatch && posMatch[1]) {
      const pos = parseInt(posMatch[1], 10);
      const lines = text.slice(0, pos).split("\n");
      line = lines.length;
      col = lines[lines.length - 1].length + 1;
      return {
        data: null,
        error: `JSON Syntax Error at Line ${line}, Column ${col}: ${msg}`,
      };
    }

    return {
      data: null,
      error: `JSON Syntax Error: ${msg}`,
    };
  }
}

/**
 * Robustly parses multiple root JSON objects or arrays from a single text stream.
 * Ignores brackets inside string literals and escaped quotes.
 */
export function extractTopLevelJSONBlocks(rawText: string): any[] {
  if (!rawText || !rawText.trim()) return [];
  const text = rawText.trim();
  const blocks: any[] = [];
  let depth = 0;
  let inString = false;
  let escape = false;
  let blockStart = -1;
  let startChar: "{" | "[" | null = null;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (char === "\\") {
      if (inString) escape = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      continue;
    }
    if (!inString) {
      if ((char === "{" || char === "[") && depth === 0) {
        startChar = char;
        blockStart = i;
        depth = 1;
      } else if (depth > 0) {
        if ((startChar === "{" && char === "{") || (startChar === "[" && char === "[")) {
          depth++;
        } else if ((startChar === "{" && char === "}") || (startChar === "[" && char === "]")) {
          depth--;
          if (depth === 0) {
            const blockStr = text.substring(blockStart, i + 1);
            try {
              const parsed = JSON.parse(blockStr);
              blocks.push(parsed);
            } catch (_) {}
            startChar = null;
            blockStart = -1;
          }
        }
      }
    }
  }
  return blocks;
}

/**
 * Extracts questions list from a single parsed object or array.
 */
export function extractQuestionsFromSingleObject(obj: any): any[] {
  if (Array.isArray(obj)) return obj;
  if (!obj || typeof obj !== "object") return [];

  // 1. Primary wrapper array keys
  const primaryWrapperKeys = [
    "questions", "mcqs", "items", "questionsList", "questions_list", "mcq_list", "qList", "mcq"
  ];
  for (const k of primaryWrapperKeys) {
    if (Array.isArray(obj[k]) && obj[k].length > 0) {
      return obj[k];
    }
  }

  // 2. Check if `obj` itself is a single question object BEFORE checking ambiguous keys like `rows` or `content`
  const hasStemKey =
    obj.question !== undefined ||
    obj.text !== undefined ||
    obj.questionText !== undefined ||
    obj.question_text !== undefined ||
    obj.prompt !== undefined ||
    obj.q !== undefined ||
    obj.stem !== undefined;
  const hasOptionOrAnswerKey =
    obj.options !== undefined ||
    obj.choices !== undefined ||
    obj.alternatives !== undefined ||
    obj.optionA !== undefined ||
    obj.option_a !== undefined ||
    obj.a !== undefined ||
    obj.answer !== undefined ||
    obj.correctAnswer !== undefined ||
    obj.correctIndex !== undefined ||
    obj.matchTable !== undefined;

  if (hasStemKey && hasOptionOrAnswerKey) {
    return [obj];
  }

  // 3. Check secondary wrapper keys & nested objects (e.g., { data: { questions: [...] } } or { data: [...] })
  const secondaryKeys = ["data", "quiz", "paper", "results", "test", "list", "records", "payload", "entries", "rows", "content"];
  for (const k of secondaryKeys) {
    const val = obj[k];
    if (Array.isArray(val) && val.length > 0) {
      return val;
    }
    if (val && typeof val === "object" && !Array.isArray(val)) {
      const nested = extractQuestionsFromSingleObject(val);
      if (nested.length > 0) return nested;
    }
  }

  // 4. Fallback: check any array property whose elements look like objects
  for (const key of Object.keys(obj)) {
    if (
      !["options", "choices", "alternatives", "answers", "statements", "rows", "headers", "columns", "tags"].includes(key) &&
      Array.isArray(obj[key]) &&
      obj[key].length > 0 &&
      typeof obj[key][0] === "object"
    ) {
      return obj[key];
    }
  }

  if (hasStemKey || hasOptionOrAnswerKey || obj.title !== undefined) {
    return [obj];
  }
  return [];
}

/**
 * Standard sample JSON template generated from the official schema.
 */
export function getSampleImportJSON(): string {
  const sample = {
    schemaVersion: 1,
    questions: [
      {
        type: "single_correct",
        question: "मानव शरीर में रक्त का pH लगभग कितना होता है?",
        options: ["6.4", "7.4", "8.4", "5.4"],
        answer: "B",
        explanation: "सामान्य मानव रक्त का pH लगभग 7.4 (हल्का क्षारीय) होता है।",
        subject: "सामान्य विज्ञान",
        chapter: "मानव शरीर",
        topic: "रक्त",
      },
      {
        type: "statement_based",
        question: "निम्नलिखित कथनों पर विचार कीजिए:\n1. प्रकाश का वेग निर्वात में सबसे अधिक होता है।\n2. ध्वनि निर्वात में चल सकती है।\n3. प्रकाश एक विद्युत-चुंबकीय तरंग है।\nउपर्युक्त में से कौन-सा/से कथन सही है/हैं?",
        options: ["केवल 1 और 2", "केवल 1 और 3", "केवल 2 और 3", "1, 2 और 3"],
        answer: "B",
        explanation: "कथन 1 और 3 सही हैं। ध्वनि को चलने के लिए माध्यम चाहिए, इसलिए कथन 2 गलत है।",
        subject: "सामान्य विज्ञान",
        chapter: "भौतिकी",
        topic: "प्रकाश और ध्वनि",
      },
      {
        type: "assertion_reason",
        question: "अभिकथन (A): आकाश नीला दिखाई देता है।\nकारण (R): वायुमंडल में नीले प्रकाश का प्रकीर्णन अधिक होता है।",
        options: [
          "A और R दोनों सही हैं और R, A की सही व्याख्या है",
          "A और R दोनों सही हैं, परन्तु R, A की सही व्याख्या नहीं है",
          "A सही है, परन्तु R गलत है",
          "A गलत है, परन्तु R सही है",
        ],
        answer: "A",
        explanation: "रेले प्रकीर्णन में छोटी तरंगदैर्ध्य (नीला) अधिक बिखरती है, इसी से आकाश नीला दिखता है।",
        subject: "सामान्य विज्ञान",
        chapter: "भौतिकी",
        topic: "प्रकाश का प्रकीर्णन",
      },
      {
        text: "निम्नलिखित को सुमेलित कीजिए :",
        questionType: "match_following",
        matchTable: {
          leftTitle: "सूची-I (युद्ध)",
          rightTitle: "सूची-II (वर्ष)",
          rows: [
            { left: "A. हल्दीघाटी का युद्ध", right: "1. 1576 ई." },
            { left: "B. खानवा का युद्ध", right: "2. 1527 ई." },
            { left: "C. तराइन का प्रथम युद्ध", right: "3. 1191 ई." },
            { left: "D. तराइन का द्वितीय युद्ध", right: "4. 1192 ई." },
          ],
        },
        options: [
          "A-1, B-2, C-3, D-4",
          "A-2, B-1, C-4, D-3",
          "A-3, B-4, C-1, D-2",
          "A-4, B-3, C-2, D-1",
        ],
        correctIndex: 0,
        explanation: "सही सुमेलन विकल्प A के अनुसार है।",
        subject: "राजस्थान इतिहास",
        chapter: "प्रमुख युद्ध",
        topic: "ऐतिहासिक युद्ध",
      },
      {
        type: "table_based",
        question: "नीचे दी गई तालिका के आधार पर बताइए कि वर्ष 2019 से 2022 तक उत्पादन में कुल प्रतिशत वृद्धि कितनी हुई?",
        table: {
          caption: "तालिका: वर्षवार उत्पादन",
          headers: ["वर्ष", "उत्पादन (टन)"],
          rows: [["2019", "120"], ["2020", "150"], ["2021", "180"], ["2022", "210"]]
        },
        options: ["50%", "60%", "75%", "90%"],
        answer: "C",
        explanation: "वृद्धि $= 210 - 120 = 90$ टन। प्रतिशत वृद्धि $= \\frac{90}{120} \\times 100 = 75$%।",
        subject: "गणित",
        chapter: "आँकड़ा व्याख्या",
        topic: "तालिका",
      },
    ],
  };

  return JSON.stringify(sample, null, 2);
}

/**
 * Full Pipeline: Parse JSON -> Normalize -> Validate -> Deduplicate
 */
export function processJSONImport(
  jsonString: string,
  existingHashes: Set<string> = new Set(),
  options?: {
    curriculum?: {
      subjects?: any[];
      chapters?: any[];
      topics?: any[];
    };
    maxBatchSize?: number;
  }
): {
  success: boolean;
  parseError?: string;
  results: ValidatedQuestionResult[];
  summary: {
    total: number;
    valid: number;
    warnings: number;
    errors: number;
    duplicates: number;
  };
} {
  const { data, error } = parseJSONWithLocation(jsonString);
  if (error || !data) {
    return {
      success: false,
      parseError: error,
      results: [],
      summary: { total: 0, valid: 0, warnings: 0, errors: 0, duplicates: 0 },
    };
  }

  // 1. Validate schemaVersion if present on root object
  if (data && typeof data === "object" && !Array.isArray(data)) {
    if (data.schemaVersion !== undefined) {
      const vNum = Number(data.schemaVersion);
      if (isNaN(vNum) || vNum !== 1) {
        return {
          success: false,
          parseError: `Unsupported schemaVersion: expected 1, found ${data.schemaVersion}.`,
          results: [],
          summary: { total: 0, valid: 0, warnings: 0, errors: 0, duplicates: 0 },
        };
      }
    }

    // 2. Validate questions array if explicitly provided
    if (data.questions !== undefined) {
      if (!Array.isArray(data.questions)) {
        return {
          success: false,
          parseError: "'questions' must be an array of questions.",
          results: [],
          summary: { total: 0, valid: 0, warnings: 0, errors: 0, duplicates: 0 },
        };
      }
      if (data.questions.length === 0) {
        return {
          success: false,
          parseError: "No questions detected in JSON. Please ensure your JSON contains questions or an array of question objects.",
          results: [],
          summary: { total: 0, valid: 0, warnings: 0, errors: 0, duplicates: 0 },
        };
      }
    }
  }

  // Extract raw questions list with maximum flexibility for any JSON layout or multi-block streams
  let rawList: any[] = [];
  if (data?.isMultiBlock && Array.isArray(data.blocks)) {
    rawList = data.blocks.flatMap((b: any) => extractQuestionsFromSingleObject(b));
  } else {
    rawList = extractQuestionsFromSingleObject(data);
  }

  if (rawList.length === 0) {
    return {
      success: false,
      parseError: "No questions detected in JSON. Please ensure your JSON contains questions or an array of question objects.",
      results: [],
      summary: { total: 0, valid: 0, warnings: 0, errors: 0, duplicates: 0 },
    };
  }

  // Maximum questions per batch limit guard: only enforced if caller explicitly specified a positive limit
  if (options?.maxBatchSize !== undefined && options.maxBatchSize > 0 && rawList.length > options.maxBatchSize) {
    const limit = options.maxBatchSize;
    return {
      success: false,
      parseError: `Batch size exceeded: Maximum ${limit} questions allowed per import batch (found ${rawList.length}). Please split your questions into batches of ${limit} or fewer.`,
      results: [],
      summary: { total: rawList.length, valid: 0, warnings: 0, errors: rawList.length, duplicates: 0 },
    };
  }

  let validCount = 0;
  let warnCount = 0;
  let errCount = 0;
  let dupeCount = 0;
  const seenBatchHashes = new Set<string>();

  const results: ValidatedQuestionResult[] = rawList.map((rawQ, idx) => {
    const qNum = idx + 1;
    const rawKeysObj = rawQ && typeof rawQ === "object" ? Object.keys(rawQ) : [];
    const hasRawTable = rawKeysObj.includes("table") || rawKeysObj.includes("tableData") || rawKeysObj.includes("matchTable");
    const rawKeysStr = hasRawTable ? rawKeysObj.join(", ") : `${rawKeysObj.join(", ")}, NO TABLE KEY`;

    const normalized = normalizeQuestion(rawQ);
    const normKeysObj = Object.keys(normalized);
    const hasNormTable = normKeysObj.includes("table") || normKeysObj.includes("tableData") || normKeysObj.includes("matchTable");
    const normKeysStr = hasNormTable ? normKeysObj.join(", ") : `${normKeysObj.join(", ")}, NO TABLE KEY`;

    const validation = validateQuestion(normalized, qNum, { curriculum: options?.curriculum });
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
    const validObj: ValidatedQuestionResult = {
      ...normalized,
      tempId,
      questionNumber: qNum,
      isValid: validation.isValid,
      needsReview: validation.needsReview || isDupe,
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
    };

    const validKeysObj = Object.keys(validObj);
    const hasValidTable = validKeysObj.includes("table") || validKeysObj.includes("tableData") || validKeysObj.includes("matchTable");
    const validKeysStr = hasValidTable ? validKeysObj.join(", ") : `${validKeysObj.join(", ")}, NO TABLE KEY`;

    if (validation.isValid) {
      validCount++;
    } else {
      errCount++;
    }

    if (validation.warnings.length > 0 || validation.needsReview) {
      warnCount++;
    }

    if (isDupe) {
      dupeCount++;
    }

    return {
      ...validObj,
      rawKeys: rawKeysStr,
      normKeys: normKeysStr,
      validKeys: validKeysStr,
      debugKeys: {
        raw: rawKeysStr,
        norm: normKeysStr,
        valid: validKeysStr,
      },
    } as any;
  });

  return {
    success: true,
    results,
    summary: {
      total: results.length,
      valid: validCount,
      warnings: warnCount,
      errors: errCount,
      duplicates: dupeCount,
    },
  };
}

