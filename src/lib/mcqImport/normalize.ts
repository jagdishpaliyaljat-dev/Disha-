import { MCQImportQuestion, MCQMatchTable } from "./schema";
import { sanitizeSvgContent } from "../../utils/svgSanitizer";
import { detectQuestionExams } from "./examDetector";

const DEVANAGARI_DIGITS: Record<string, string> = {
  "०": "0", "१": "1", "२": "2", "३": "3", "४": "4",
  "५": "5", "६": "6", "७": "7", "८": "8", "९": "9",
};

function toAsciiDigits(str: string): string {
  return str.replace(/[०-९]/g, (d) => DEVANAGARI_DIGITS[d] ?? d);
}

/**
 * Strips redundant option prefix like "(A) ", "A. ", "A) ", "(क) ", "क. " from option text,
 * while preserving meaningful content like "(1) और (2)", "1956 ई.", "-3x + 2", etc.
 */
export function cleanOptionText(rawOpt: string): string {
  const trimmed = String(rawOpt ?? "").trim();
  if (!trimmed) return "";
  // Do not strip if it looks like "(A) और (R) दोनों..." in Assertion-Reason options
  if (/^\([A-Da-d]\)\s*(?:और|तथा|एवं|and|सही|गलत|is\s+true|is\s+false)/i.test(trimmed)) {
    return trimmed;
  }
  return trimmed
    .replace(/^(?:\([A-Ea-eक-ङअ-द]\)|[A-Ea-eक-ङअ-द][.):])\s+/i, "")
    .replace(/^(?:Option|विकल्प)\s*[A-Ea-e1-5क-ङ]\s*[:.\-–)]\s*/i, "")
    .trim();
}

function extractStringValue(val: any): string {
  if (val === undefined || val === null) return "";
  let str = "";
  if (typeof val === "string") str = val;
  else if (typeof val === "number" || typeof val === "boolean") str = String(val);
  else if (typeof val === "object") {
    if (typeof val.text === "string") str = val.text;
    else if (typeof val.value === "string" || typeof val.value === "number") str = String(val.value);
    else if (typeof val.content === "string") str = val.content;
    else if (typeof val.option === "string" || typeof val.option === "number") str = String(val.option);
    else if (typeof val.title === "string") str = val.title;
    else if (typeof val.hi === "string" && typeof val.en === "string") str = `${val.hi}\n${val.en}`;
    else if (typeof val.hi === "string") str = val.hi;
    else if (typeof val.en === "string") str = val.en;
    else if (typeof val.label === "string") str = val.label;
  }
  if (!str) return "";

  // Normalize escaped newlines (\r\n -> \n, \r -> \n, and unescape literal \n when not a LaTeX command)
  if (str.includes("\r")) {
    str = str.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  }
  if (str.includes("\\n")) {
    str = str.replace(/\\n(?![a-z])/g, "\n");
  }
  return str;
}

/**
 * Extracts embedded Markdown pipe table or HTML table from question text.
 * Returns { cleanQuestion, table, matchTable, hasMultipleTables, tableErrorWarning }
 */
function extractEmbeddedTablesFromText(
  text: string,
  isMatchingContext: boolean
): {
  cleanQuestion: string;
  table?: { caption?: string; headers: string[]; rows: string[][] };
  matchTable?: MCQMatchTable;
  tableErrorWarning?: string;
} {
  if (!text) return { cleanQuestion: "" };
  let workingText = text;
  let tableErrorWarning: string | undefined;

  // 1. Check HTML <table>...</table>
  const htmlTableMatches = workingText.match(/<table[\s\S]*?<\/table>/gi);
  if (htmlTableMatches && htmlTableMatches.length > 0) {
    if (htmlTableMatches.length > 1) {
      tableErrorWarning = "Multiple HTML tables detected in a single question; please verify table structure.";
    }
    const firstHtmlTable = htmlTableMatches[0];
    const rowMatches = firstHtmlTable.match(/<tr[\s\S]*?<\/tr>/gi) || [];
    const parsedRows: string[][] = [];
    let headers: string[] = [];

    rowMatches.forEach((tr, rIdx) => {
      const thMatches = tr.match(/<th[^>]*>([\s\S]*?)<\/th>/gi);
      const tdMatches = tr.match(/<td[^>]*>([\s\S]*?)<\/td>/gi);
      const stripTags = (s: string) => s.replace(/<[^>]+>/g, "").replace(/&nbsp;/gi, " ").trim();
      if (thMatches && thMatches.length > 0 && headers.length === 0) {
        headers = thMatches.map(stripTags);
      } else if (tdMatches && tdMatches.length > 0) {
        const cells = tdMatches.map(stripTags);
        if (rIdx === 0 && headers.length === 0) {
          headers = cells;
        } else {
          parsedRows.push(cells);
        }
      }
    });

    if (headers.length >= 2 && parsedRows.length >= 1) {
      workingText = workingText.replace(firstHtmlTable, "").trim();
      if (isMatchingContext && headers.length === 2) {
        return {
          cleanQuestion: workingText,
          matchTable: {
            leftTitle: headers[0] || "सूची-I",
            rightTitle: headers[1] || "सूची-II",
            rows: parsedRows.map((r) => ({ left: r[0] || "", right: r[1] || "" })),
          },
          tableErrorWarning,
        };
      }
      return {
        cleanQuestion: workingText,
        table: { headers, rows: parsedRows },
        tableErrorWarning,
      };
    }
  }

  // 2. Check Markdown / Pipe table lines
  const lines = workingText.split("\n");
  const tableBlocks: { start: number; end: number; lines: string[] }[] = [];
  let curBlock: { start: number; end: number; lines: string[] } | null = null;

  lines.forEach((line, idx) => {
    const trimmed = line.trim();
    const pipeCount = (trimmed.match(/\|/g) || []).length;
    // Skip single math absolute value like |x - 2| < 5
    const isMathAbs = pipeCount === 2 && /^\s*\|[^|]+\|\s*(?:[<>=\+\-\*\/]|\\le|\\ge)/i.test(trimmed);
    if (pipeCount >= 1 && !isMathAbs && (trimmed.startsWith("|") || trimmed.includes(" | "))) {
      if (!curBlock) {
        curBlock = { start: idx, end: idx, lines: [trimmed] };
      } else {
        curBlock.end = idx;
        curBlock.lines.push(trimmed);
      }
    } else {
      if (curBlock) {
        if (curBlock.lines.length >= 2) tableBlocks.push(curBlock);
        curBlock = null;
      }
    }
  });
  if (curBlock && (curBlock as any).lines.length >= 2) {
    tableBlocks.push(curBlock);
  }

  if (tableBlocks.length > 1) {
    tableErrorWarning = "Multiple pipe tables detected in question text; only the primary table was extracted.";
  }

  if (tableBlocks.length >= 1) {
    const block = tableBlocks[0];
    const parsedCells: string[][] = [];
    block.lines.forEach((l) => {
      const clean = l.replace(/^\|+/, "").replace(/\|+$/, "").trim();
      if (!clean || /^[\s|\-:]+$/.test(clean)) return; // skip separator row |---|---|
      const parts = clean.split("|").map((p) => p.trim());
      if (parts.length >= 2) {
        parsedCells.push(parts);
      }
    });

    if (parsedCells.length >= 2) {
      const remainingLines = lines.filter((_, idx) => idx < block.start || idx > block.end);
      const cleanQ = remainingLines.join("\n").trim() || workingText;

      const firstRow = parsedCells[0];
      const looksLikeMatchHeader =
        isMatchingContext ||
        /सूची|List|स्तम्भ|स्तंभ|Column|खण्ड/i.test(firstRow[0]) ||
        /सूची|List|स्तम्भ|स्तंभ|Column|खण्ड/i.test(firstRow[1]);

      if (looksLikeMatchHeader && firstRow.length === 2) {
        const hasHeaderRow =
          /सूची|List|स्तम्भ|स्तंभ|Column|खण्ड|विषय|अभयारण्य|शासक|नदी|पुस्तक|लेखक/i.test(firstRow[0]) &&
          !/^[A-Da-d1-4क-घ][.):\-]\s+/.test(firstRow[0]);
        const leftTitle = hasHeaderRow ? firstRow[0] : "सूची-I";
        const rightTitle = hasHeaderRow ? firstRow[1] : "सूची-II";
        const dataRows = hasHeaderRow ? parsedCells.slice(1) : parsedCells;
        if (dataRows.length > 0) {
          return {
            cleanQuestion: cleanQ,
            matchTable: {
              leftTitle,
              rightTitle,
              rows: dataRows.map((r) => ({ left: r[0] || "", right: r[1] || "" })),
            },
            tableErrorWarning,
          };
        }
      } else {
        const headers = parsedCells[0];
        const rows = parsedCells.slice(1);
        const colMismatch = rows.some((r) => r.length !== headers.length);
        if (colMismatch) {
          tableErrorWarning = "Table rows have inconsistent column counts; please review table formatting.";
        }
        return {
          cleanQuestion: cleanQ,
          table: { headers, rows },
          tableErrorWarning,
        };
      }
    }
  }

  // 3. Check arrow-based matching lines in question text (e.g., "A. विटामिन A -> 1. स्कर्वी")
  if (isMatchingContext) {
    const arrowRows: { left: string; right: string }[] = [];
    const nonArrowLines: string[] = [];
    let leftTitle = "सूची-I";
    let rightTitle = "सूची-II";

    lines.forEach((line) => {
      const trimmed = line.trim();
      if (trimmed.includes("->") || trimmed.includes("→")) {
        const parts = trimmed.split(/\s*(?:->|→)\s*/);
        if (parts.length === 2 && parts[0] && parts[1]) {
          if (/सूची|List|स्तम्भ|स्तंभ|Column/i.test(parts[0]) && !/^[A-Da-d1-4][.)]/.test(parts[0])) {
            leftTitle = parts[0].trim();
            rightTitle = parts[1].trim();
          } else {
            arrowRows.push({ left: parts[0].trim(), right: parts[1].trim() });
          }
          return;
        }
      }
      nonArrowLines.push(line);
    });

    if (arrowRows.length >= 2) {
      return {
        cleanQuestion: nonArrowLines.join("\n").trim() || workingText,
        matchTable: { leftTitle, rightTitle, rows: arrowRows },
        tableErrorWarning,
      };
    }
  }

  return { cleanQuestion: workingText, tableErrorWarning };
}

/**
 * Normalizes any Match the Following input structure into DISHA 20-20's standard matchTable schema:
 * { leftTitle?: string, rightTitle?: string, rows: { left: string, right: string }[] }
 */
function normalizeMatchTableInput(raw: any): { matchTable?: MCQMatchTable; matchingErrorWarning?: string } {
  if (!raw || typeof raw !== "object") return {};

  let leftTitle: string | undefined =
    raw.matchTable?.leftTitle ??
    raw.leftTitle ??
    raw.columnATitle ??
    raw.list1Title ??
    raw.listITitle ??
    (Array.isArray(raw.columns) && raw.columns.length >= 2 ? String(raw.columns[0]) : undefined);

  let rightTitle: string | undefined =
    raw.matchTable?.rightTitle ??
    raw.rightTitle ??
    raw.columnBTitle ??
    raw.list2Title ??
    raw.listIITitle ??
    (Array.isArray(raw.columns) && raw.columns.length >= 2 ? String(raw.columns[1]) : undefined);

  const rows: { left: string; right: string }[] = [];
  let matchingErrorWarning: string | undefined;

  // Case 1: raw.matchTable.rows or raw.rows (with {left, right} or [left, right])
  const candidateRows =
    (raw.matchTable && Array.isArray(raw.matchTable.rows) ? raw.matchTable.rows : null) ||
    (Array.isArray(raw.rows) && !raw.table && !raw.headers ? raw.rows : null) ||
    (Array.isArray(raw.pairs) ? raw.pairs : null) ||
    (Array.isArray(raw.matchPairs) ? raw.matchPairs : null) ||
    (Array.isArray(raw.matching) ? raw.matching : null);

  if (candidateRows && candidateRows.length > 0) {
    candidateRows.forEach((r: any) => {
      if (Array.isArray(r) && r.length >= 2) {
        rows.push({ left: String(r[0] ?? "").trim(), right: String(r[1] ?? "").trim() });
      } else if (r && typeof r === "object") {
        const left =
          r.left ?? r.col1 ?? r.column1 ?? r.list1 ?? r.listI ?? r.item ?? r.a ?? r.A ?? r.term ?? r.source ?? "";
        const right =
          r.right ?? r.col2 ?? r.column2 ?? r.list2 ?? r.listII ?? r.match ?? r.b ?? r.B ?? r.definition ?? r.target ?? "";
        rows.push({ left: String(left).trim(), right: String(right).trim() });
      }
    });
  }

  // Case 2: Separate list1 / list2, listI / listII, columnA / columnB, matchData
  if (rows.length === 0) {
    const list1 =
      raw.list1 ?? raw.listI ?? raw.list_1 ?? raw.list_i ?? raw.columnA ?? raw.column_a ?? raw.column1 ?? raw.matchData?.listI ?? raw.matchTable?.listI;
    const list2 =
      raw.list2 ?? raw.listII ?? raw.list_2 ?? raw.list_ii ?? raw.columnB ?? raw.column_b ?? raw.column2 ?? raw.matchData?.listII ?? raw.matchTable?.listII;

    if (Array.isArray(list1) || Array.isArray(list2)) {
      const l1 = Array.isArray(list1) ? list1 : [];
      const l2 = Array.isArray(list2) ? list2 : [];
      if (l1.length !== l2.length) {
        matchingErrorWarning = `सूची-I (${l1.length} items) and सूची-II (${l2.length} items) have unequal lengths.`;
      }
      const maxLen = Math.max(l1.length, l2.length);
      for (let i = 0; i < maxLen; i++) {
        rows.push({
          left: extractStringValue(l1[i]).trim(),
          right: extractStringValue(l2[i]).trim(),
        });
      }
    }
  }

  // Case 3: raw.matching or raw.pairs as a plain key-value object { "A. हल्दीघाटी": "1. 1576" }
  if (rows.length === 0) {
    const objMap =
      (raw.matching && typeof raw.matching === "object" && !Array.isArray(raw.matching) ? raw.matching : null) ||
      (raw.pairs && typeof raw.pairs === "object" && !Array.isArray(raw.pairs) ? raw.pairs : null);
    if (objMap) {
      for (const [k, v] of Object.entries(objMap)) {
        rows.push({ left: String(k).trim(), right: String(v ?? "").trim() });
      }
    }
  }

  if (rows.length > 0) {
    const hasEmptySide = rows.some((r) => !r.left || !r.right);
    if (hasEmptySide && !matchingErrorWarning) {
      matchingErrorWarning = "One or more rows in Match the Following table have missing left or right entries.";
    }
    return {
      matchTable: {
        leftTitle: leftTitle || "सूची-I",
        rightTitle: rightTitle || "सूची-II",
        rows,
      },
      matchingErrorWarning,
    };
  }

  return {};
}

/**
 * Clean and normalize a question object safely without throwing runtime errors on missing fields.
 * Never fabricates missing answers, options, explanations, or subject/chapter/topic.
 */
export const normalizeQuestion = (raw: any): MCQImportQuestion => {
  if (!raw || typeof raw !== "object") {
    return {
      type: "single_correct",
      questionType: "single_correct",
      question: "",
      text: "",
      options: [],
      answer: "",
      correctIndex: -1,
      explanation: "",
      rawInput: raw,
    };
  }

  // 1. Question text - check all possible stem key names
  const rawStem =
    raw.question ??
    raw.text ??
    raw.questionText ??
    raw.question_text ??
    raw.prompt ??
    raw.q ??
    raw.title ??
    raw.stem ??
    raw.content ??
    raw.body ??
    raw.statement_text ??
    "";

  let question = extractStringValue(rawStem).trim();

  // Strip leading question number markers like "Q1.", "Q. 1", "प्रश्न 1:" while keeping dates/formulas intact
  question = question
    .replace(/^\s*(?:Q(?:uestion|ue)?\.?\s*\d+\s*[:.)\-–]|प्रश्न\s*(?:सं\.?\s*)?\d+\s*[:.)\-–])\s*/i, "")
    .trim();

  // 2. Options extraction - handle arrays, option objects, choices, alternatives, or discrete fields
  let options: string[] = [];
  let optionObjectCorrectIndices: number[] = [];

  const extractFromOptionArray = (arr: any[]) => {
    const extracted: string[] = [];
    arr.forEach((item, idx) => {
      if (item && typeof item === "object" && !Array.isArray(item)) {
        if (item.isCorrect === true || item.correct === true || item.is_correct === true) {
          optionObjectCorrectIndices.push(idx);
        }
        const textVal =
          item.text ?? item.value ?? item.content ?? item.option ?? item.title ?? item.ans ?? item.label ?? "";
        extracted.push(cleanOptionText(String(textVal)));
      } else {
        extracted.push(cleanOptionText(String(item ?? "")));
      }
    });
    return extracted;
  };

  if (Array.isArray(raw.options)) {
    options = extractFromOptionArray(raw.options);
  } else if (Array.isArray(raw.choices)) {
    options = extractFromOptionArray(raw.choices);
  } else if (Array.isArray(raw.alternatives)) {
    options = extractFromOptionArray(raw.alternatives);
  } else if (Array.isArray(raw.option_list)) {
    options = extractFromOptionArray(raw.option_list);
  } else if (Array.isArray(raw.optionsList)) {
    options = extractFromOptionArray(raw.optionsList);
  } else if (Array.isArray(raw.opts)) {
    options = extractFromOptionArray(raw.opts);
  } else if (
    Array.isArray(raw.answers) &&
    raw.answers.length >= 2 &&
    raw.answer === undefined &&
    raw.correctAnswer === undefined &&
    raw.correct_option === undefined
  ) {
    // Only treat `answers` as options if it has >=2 items and no separate options array exists
    options = extractFromOptionArray(raw.answers);
  } else if (raw.options && typeof raw.options === "object" && !Array.isArray(raw.options)) {
    const orderedKeys = ["A", "B", "C", "D", "E", "a", "b", "c", "d", "e", "1", "2", "3", "4", "5", "क", "ख", "ग", "घ", "ङ"];
    const presentOrdered = orderedKeys.filter((k) => k in raw.options);
    const keysToUse = presentOrdered.length >= 2 ? presentOrdered : Object.keys(raw.options).sort();
    options = keysToUse.map((k) => cleanOptionText(extractStringValue(raw.options[k])));
  } else {
    // Check discrete keys like optionA..optionE, option_a..option_e, optA..optE, a..e, A..E, option1..option5
    const optA = raw.optionA ?? raw.option_a ?? raw.optA ?? raw.opt_a ?? raw.a ?? raw.A ?? raw.option1 ?? raw.opt1 ?? raw["1"];
    const optB = raw.optionB ?? raw.option_b ?? raw.optB ?? raw.opt_b ?? raw.b ?? raw.B ?? raw.option2 ?? raw.opt2 ?? raw["2"];
    const optC = raw.optionC ?? raw.option_c ?? raw.optC ?? raw.opt_c ?? raw.c ?? raw.C ?? raw.option3 ?? raw.opt3 ?? raw["3"];
    const optD = raw.optionD ?? raw.option_d ?? raw.optD ?? raw.opt_d ?? raw.d ?? raw.D ?? raw.option4 ?? raw.opt4 ?? raw["4"];
    const optE = raw.optionE ?? raw.option_e ?? raw.optE ?? raw.opt_e ?? raw.e ?? raw.E ?? raw.option5 ?? raw.opt5 ?? raw["5"];

    if (optA !== undefined || optB !== undefined) {
      options = [optA, optB, optC, optD, optE]
        .filter((o) => o !== undefined && o !== null)
        .map((o) => cleanOptionText(extractStringValue(o)));
    }
  }

  // 3. Detect Unsupported Question Types (e.g., Multiple Correct Answers, Subjective, Fill-in-Blank without options)
  let unsupportedReason: string | undefined;
  const rawTypeStr = String(raw.type ?? raw.questionType ?? raw.question_type ?? "").trim().toLowerCase();

  if (
    /multiple_correct|multi_select|multiple_choice_multiple|msq|more_than_one/i.test(rawTypeStr) ||
    optionObjectCorrectIndices.length > 1 ||
    (Array.isArray(raw.correctAnswers) && raw.correctAnswers.length > 1) ||
    (Array.isArray(raw.answer) && raw.answer.length > 1) ||
    (Array.isArray(raw.answers) && raw.options && raw.answers.length > 1)
  ) {
    unsupportedReason = "Multiple Correct Options (MSQ) detected; DISHA 20-20 requires Single Correct Option MCQs.";
  } else if (/subjective|descriptive|essay|short_answer|long_answer|written/i.test(rawTypeStr)) {
    unsupportedReason = `Subjective/Descriptive question type ("${rawTypeStr}") is not supported.`;
  } else if (/drag_drop|audio|video|hotspot|matrix_complex/i.test(rawTypeStr)) {
    unsupportedReason = `Interactive/Media question type ("${rawTypeStr}") is not supported.`;
  }

  // 4. Intelligent Answer Normalization (0-based vs 1-based vs Letter vs Option Text)
  const LETTERS = ["A", "B", "C", "D", "E"] as const;
  const HINDI_LETTER_MAP: Record<string, number> = {
    "क": 0, "ख": 1, "ग": 2, "घ": 3, "ङ": 4,
    "अ": 0, "ब": 1, "स": 2, "द": 3, "इ": 4,
  };

  let correctIndex = -1;
  let answer = "";
  let ambiguousAnswerWarning: string | undefined;

  // 4a. Check explicit 0-based index keys first
  const rawZeroBased =
    raw.correctIndex ??
    raw.correct_index ??
    raw.correct_option_index ??
    raw.answerIndex ??
    raw.answer_index ??
    raw.rightIndex;

  if (rawZeroBased !== undefined && rawZeroBased !== null && String(rawZeroBased).trim() !== "") {
    const parsedIdx = typeof rawZeroBased === "number" ? rawZeroBased : parseInt(toAsciiDigits(String(rawZeroBased).trim()), 10);
    const maxBound = options.length > 0 ? options.length : 5;
    if (!isNaN(parsedIdx) && parsedIdx >= 0 && parsedIdx < maxBound && parsedIdx < 5) {
      correctIndex = parsedIdx;
      answer = LETTERS[parsedIdx];
    } else if (!isNaN(parsedIdx)) {
      ambiguousAnswerWarning = `0-based answer index (${parsedIdx}) is out of bounds for ${options.length} options.`;
    }
  }

  // 4b. Check general answer keys (letters, 1-based numbers, option objects, or full option text)
  const rawGeneralAnsCandidate =
    raw.answer ??
    raw.correctAnswer ??
    raw.correct_answer ??
    raw.correct_option ??
    raw.correctOption ??
    raw.ans ??
    raw.correct ??
    raw.right ??
    raw.key ??
    raw.rightAnswer ??
    raw.right_answer ??
    (!Array.isArray(raw.answers) ? raw.answers : undefined);

  if (rawGeneralAnsCandidate !== undefined && rawGeneralAnsCandidate !== null) {
    let rawAnsStr = "";
    if (typeof rawGeneralAnsCandidate === "object" && !Array.isArray(rawGeneralAnsCandidate)) {
      if (typeof rawGeneralAnsCandidate.index === "number") {
        const idx = rawGeneralAnsCandidate.index;
        if (idx >= 0 && idx < (options.length || 5)) {
          correctIndex = idx;
          answer = LETTERS[idx];
        }
      }
      rawAnsStr = String(
        rawGeneralAnsCandidate.option ??
        rawGeneralAnsCandidate.label ??
        rawGeneralAnsCandidate.answer ??
        rawGeneralAnsCandidate.value ??
        rawGeneralAnsCandidate.text ??
        ""
      ).trim();
    } else if (!Array.isArray(rawGeneralAnsCandidate)) {
      rawAnsStr = String(rawGeneralAnsCandidate).trim();
    }

    if (rawAnsStr) {
      // Strip wrappers like "Option (B)", "विकल्प C", "सही उत्तर: D", "(A)"
      const cleanedLabel = toAsciiDigits(rawAnsStr)
        .replace(/^(?:correct\s*answer|right\s*option|answer|ans|option|विकल्प|सही\s*उत्तर|उत्तर)\s*[:.\-–=]?\s*/i, "")
        .trim();

      const singleParenMatch = cleanedLabel.match(/^\(?([A-Ea-e1-5क-ङअ-द])\)?[.):]?$/);
      const optionPrefixMatch = cleanedLabel.match(/^\(?([A-Ea-eक-ङअ-द])\)?(?:\s*[:.\-–)]\s*|\s+)(.+)$/);

      let resolvedFromGeneral = -1;

      if (singleParenMatch) {
        const token = singleParenMatch[1];
        const upperToken = token.toUpperCase();
        if (LETTERS.includes(upperToken as any)) {
          resolvedFromGeneral = LETTERS.indexOf(upperToken as any);
        } else if (HINDI_LETTER_MAP[token] !== undefined) {
          resolvedFromGeneral = HINDI_LETTER_MAP[token];
        } else {
          const num = parseInt(token, 10);
          if (!isNaN(num) && num >= 1 && num <= 5) {
            // Check if options themselves contain this exact number at a different position!
            const textMatchIdx = options.findIndex((o) => o.trim() === String(num));
            if (textMatchIdx >= 0 && textMatchIdx !== num - 1 && correctIndex < 0) {
              ambiguousAnswerWarning = `Numeric answer "${num}" matches both Option ${LETTERS[num - 1]} (by position) and Option ${LETTERS[textMatchIdx]} (by text "${options[textMatchIdx]}").`;
            }
            resolvedFromGeneral = num - 1;
          }
        }
      } else if (cleanedLabel === "0" && typeof rawGeneralAnsCandidate === "number") {
        resolvedFromGeneral = 0;
        ambiguousAnswerWarning = `Answer was provided as numeric 0 in general answer field; mapped to Option A (0-based), please verify.`;
      } else if (options.length > 0) {
        // Match against full option text first
        const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");
        const targetNorm = norm(cleanedLabel);
        const matchingIndices = options
          .map((opt, idx) => (norm(opt) === targetNorm || norm(cleanOptionText(opt)) === targetNorm ? idx : -1))
          .filter((idx) => idx >= 0);

        if (matchingIndices.length === 1) {
          resolvedFromGeneral = matchingIndices[0];
        } else if (matchingIndices.length > 1) {
          resolvedFromGeneral = matchingIndices[0];
          ambiguousAnswerWarning = `Answer text "${rawAnsStr}" matches multiple identical options (${matchingIndices.map((i) => LETTERS[i]).join(", ")}).`;
        } else if (optionPrefixMatch) {
          // e.g. "(A) जयपुर"
          const letterPart = optionPrefixMatch[1].toUpperCase();
          if (LETTERS.includes(letterPart as any)) {
            resolvedFromGeneral = LETTERS.indexOf(letterPart as any);
          } else if (HINDI_LETTER_MAP[optionPrefixMatch[1]] !== undefined) {
            resolvedFromGeneral = HINDI_LETTER_MAP[optionPrefixMatch[1]];
          }
        }
      }

      if (resolvedFromGeneral >= 0 && resolvedFromGeneral < 5) {
        if (correctIndex >= 0 && correctIndex !== resolvedFromGeneral) {
          ambiguousAnswerWarning = `Conflicting answer fields: correctIndex points to ${LETTERS[correctIndex]} while answer field points to ${LETTERS[resolvedFromGeneral]}.`;
        } else {
          correctIndex = resolvedFromGeneral;
          answer = LETTERS[resolvedFromGeneral];
        }
      } else if (correctIndex < 0) {
        // Keep raw invalid answer so validator can report "Invalid Answer"
        answer = rawAnsStr;
      }
    }
  }

  // 4c. Fallback to option object `{ isCorrect: true }` if single match
  if (correctIndex < 0 && optionObjectCorrectIndices.length === 1 && optionObjectCorrectIndices[0] < 5) {
    correctIndex = optionObjectCorrectIndices[0];
    answer = LETTERS[correctIndex];
  }

  // 5. Explanation
  const explanation = extractStringValue(
    raw.explanation ??
    raw.solution ??
    raw.exp ??
    raw.rationale ??
    raw.ansExplanation ??
    raw.ans_explanation ??
    raw.details ??
    raw.hint ??
    raw.note ??
    raw["व्याख्या"] ??
    raw["स्पष्टीकरण"] ??
    ""
  ).trim();

  // Check if explanation explicitly contradicts the mapped answer
  if (explanation && correctIndex >= 0) {
    const expHintMatch = explanation.match(
      /(?:सही\s*(?:उत्तर|विकल्प)|correct\s*(?:answer|option)|उत्तर\s*विकल्प)\s*(?:है|is|:|-|–)?\s*\(([A-Da-d])\)/i
    );
    if (expHintMatch) {
      const expLetter = expHintMatch[1].toUpperCase();
      const expIdx = LETTERS.indexOf(expLetter as any);
      if (expIdx >= 0 && expIdx !== correctIndex) {
        ambiguousAnswerWarning = `Explanation states correct option is (${expLetter}), which conflicts with mapped answer (${LETTERS[correctIndex]}).`;
      }
    }
  }

  // 6. Metadata fields - preserve ONLY if present in input (Never fabricate subject/chapter/topic)
  // 6. Metadata fields & Multi-Exam Detection
  const examDetection = detectQuestionExams(raw);
  const examHistory = examDetection.examHistory;
  const questionClassification = examDetection.questionClassification;
  const isPYQ = examDetection.isPYQ;
  const rawExamClean =
    raw.exam !== undefined && raw.exam !== null && String(raw.exam).trim() !== ""
      ? String(raw.exam).trim()
      : raw.examName !== undefined && raw.examName !== null && String(raw.examName).trim() !== ""
      ? String(raw.examName).trim()
      : undefined;

  const rawYearClean =
    raw.year !== undefined && raw.year !== null && String(raw.year).trim() !== ""
      ? String(raw.year).trim()
      : raw.examYear !== undefined && raw.examYear !== null && String(raw.examYear).trim() !== ""
      ? String(raw.examYear).trim()
      : undefined;

  const exam =
    examHistory.length > 0 && examHistory[0].examName && examHistory[0].examName.trim()
      ? examHistory[0].examName.trim()
      : rawExamClean;

  const year =
    examHistory.length > 0 && examHistory[0].year !== undefined && examHistory[0].year !== null && String(examHistory[0].year).trim() !== ""
      ? String(examHistory[0].year).trim()
      : rawYearClean;

  const subject =
    raw.subject !== undefined
      ? String(raw.subject).trim()
      : raw.subjectName !== undefined
      ? String(raw.subjectName).trim()
      : undefined;
  const chapter =
    raw.chapter !== undefined
      ? String(raw.chapter).trim()
      : raw.chapterName !== undefined
      ? String(raw.chapterName).trim()
      : undefined;
  const topic =
    raw.topic !== undefined
      ? String(raw.topic).trim()
      : raw.topicName !== undefined
      ? String(raw.topicName).trim()
      : undefined;
  const instruction =
    raw.instruction !== undefined
      ? String(raw.instruction).trim()
      : raw.askLine !== undefined
      ? String(raw.askLine).trim()
      : raw.prompt_footer !== undefined
      ? String(raw.prompt_footer).trim()
      : undefined;

  // 7. Statements & Assertion-Reason synthesis
  const statements = Array.isArray(raw.statements)
    ? raw.statements.map((s: any) => extractStringValue(s).trim()).filter(Boolean)
    : undefined;

  const assertion =
    raw.assertion !== undefined
      ? extractStringValue(raw.assertion).trim()
      : raw.statementA !== undefined
      ? extractStringValue(raw.statementA).trim()
      : undefined;

  const reason =
    raw.reason !== undefined
      ? extractStringValue(raw.reason).trim()
      : raw.statementR !== undefined
      ? extractStringValue(raw.statementR).trim()
      : undefined;

  // If statements are provided separately and not already in question text, include them in question text
  if (statements && statements.length > 0) {
    const firstStmtClean = statements[0].replace(/^(?:1\.|\(1\)|I\.|कथन\s*1\s*:?)\s*/i, "").trim();
    if (firstStmtClean && !question.includes(firstStmtClean)) {
      const formattedStmts = statements
        .map((s: string, idx: number) => (/^(?:\d+[.)]|\(\d+\)|[IVX]+[.)]|कथन\s*\d+|Statement\s*\d+)/i.test(s) ? s : `${idx + 1}. ${s}`))
        .join("\n");
      question = [question, formattedStmts, instruction].filter(Boolean).join("\n");
    } else if (instruction && !question.includes(instruction)) {
      question = `${question}\n${instruction}`;
    }
  }

  // If assertion & reason are provided separately and not already in question text, include them in question text
  if (assertion && reason && !question.includes(assertion)) {
    const isHindi = /[\u0900-\u097F]/.test(assertion + reason);
    const arBlock = isHindi
      ? `अभिकथन (A): ${assertion}\nकारण (R): ${reason}`
      : `Assertion (A): ${assertion}\nReason (R): ${reason}`;
    question = [question, arBlock, instruction].filter(Boolean).join("\n");
  }

  // 8. Match the Following & Table extraction
  const isMatchKeyword =
    /match_list|match_following|match_column|matching/i.test(rawTypeStr) ||
    Boolean(raw.matchTable || raw.matchData || raw.list1 || raw.listI || raw.columnA || raw.pairs || raw.matching) ||
    /सुमेलित\s*कीजिए|सूची-?\s*I|List-?\s*I|Match\s+the\s+following|स्तम्भ-?\s*I|स्तंभ-?\s*I/i.test(question) ||
    options.some((o) => /[A-Da-d1-4]\s*[-–:]\s*[1-4A-Da-diIvVxX]/.test(o) && /,/.test(o));

  let { matchTable, matchingErrorWarning } = normalizeMatchTableInput(raw);

  // Check if a 2-column match table was passed inside `raw.table` for a matching question
  const rawTableInput = raw.table || raw.tableData;
  if (!matchTable && isMatchKeyword && rawTableInput && typeof rawTableInput === "object" && !Array.isArray(rawTableInput)) {
    const tHeaders = Array.isArray(rawTableInput.headers) ? rawTableInput.headers : [];
    const tRows = Array.isArray(rawTableInput.rows) ? rawTableInput.rows : [];
    if ((tHeaders.length === 2 || tHeaders.length === 0) && tRows.length > 0) {
      const convertedRows = tRows
        .map((r: any) => {
          const cells = Array.isArray(r) ? r : r && Array.isArray(r.cells) ? r.cells : [];
          return cells.length >= 2 ? { left: String(cells[0] ?? "").trim(), right: String(cells[1] ?? "").trim() } : null;
        })
        .filter(Boolean) as { left: string; right: string }[];
      if (convertedRows.length > 0) {
        matchTable = {
          leftTitle: tHeaders[0] ? String(tHeaders[0]) : "सूची-I",
          rightTitle: tHeaders[1] ? String(tHeaders[1]) : "सूची-II",
          rows: convertedRows,
        };
      }
    }
  }

  // Extract embedded Markdown/HTML/Arrow tables from question text if not already structured
  const embedded = extractEmbeddedTablesFromText(question, isMatchKeyword);
  let tableErrorWarning = embedded.tableErrorWarning;

  if (!matchTable && embedded.matchTable) {
    matchTable = embedded.matchTable;
    question = embedded.cleanQuestion;
  }

  let table: any = undefined;
  if (!matchTable && rawTableInput !== undefined && rawTableInput !== null) {
    if (typeof rawTableInput === "object" && !Array.isArray(rawTableInput)) {
      const headers = Array.isArray(rawTableInput.headers)
        ? rawTableInput.headers.map((h: any) => String(h ?? ""))
        : [];
      let rows: string[][] = [];
      if (Array.isArray(rawTableInput.rows)) {
        rows = rawTableInput.rows.map((r: any) => {
          if (Array.isArray(r)) {
            return r.map((c: any) => String(c ?? ""));
          } else if (r && typeof r === "object" && Array.isArray(r.cells)) {
            return r.cells.map((c: any) => String(c ?? ""));
          } else if (r && typeof r === "object" && headers.length > 0) {
            return headers.map((h: string) => String(r[h] ?? ""));
          }
          return [];
        });
      }
      table = {
        caption:
          rawTableInput.caption !== undefined && rawTableInput.caption !== null
            ? String(rawTableInput.caption)
            : undefined,
        headers,
        rows,
      };
    } else {
      table = rawTableInput;
    }
  } else if (!matchTable && Array.isArray(raw.headers) && Array.isArray(raw.rows)) {
    table = {
      caption: raw.caption ? String(raw.caption) : undefined,
      headers: raw.headers.map((h: any) => String(h ?? "")),
      rows: raw.rows.map((r: any) => (Array.isArray(r) ? r.map((c: any) => String(c ?? "")) : [])),
    };
  } else if (!matchTable && embedded.table) {
    table = embedded.table;
    question = embedded.cleanQuestion;
  }

  // 9. Image / Diagram extraction & SVG sanitization
  let imageObj = raw.image || raw.diagram || raw.figure || raw.imageUrl;
  if (imageObj) {
    if (typeof imageObj === "object" && imageObj !== null) {
      if (imageObj.svg) {
        imageObj = {
          type: "svg",
          ...imageObj,
          svg: sanitizeSvgContent(imageObj.svg),
        };
      } else if (imageObj.url || imageObj.dataUrl) {
        imageObj = {
          type: "image",
          ...imageObj,
        };
      }
    } else if (typeof imageObj === "string" && imageObj.includes("<svg")) {
      imageObj = { type: "svg", svg: sanitizeSvgContent(imageObj) };
    } else if (typeof imageObj === "string") {
      imageObj = { type: "image", url: imageObj.trim() };
    }
  }

  let finalQuestion = question;
  if (imageObj) {
    finalQuestion = finalQuestion.replace(/\n*\s*\[(?:diagram|image|चित्र)\s*[:：][^\]]+\]/gi, "").trim();
  }

  const imageUrl =
    raw.imageUrl ||
    (imageObj && typeof imageObj === "object"
      ? imageObj.url || imageObj.dataUrl
      : typeof imageObj === "string"
      ? imageObj
      : undefined);

  // 10. Intelligent Question Type Classification
  let type: string = "single_correct";
  if (unsupportedReason) {
    type = "unsupported";
  } else if (rawTypeStr === "match_list") {
    type = "match_list";
  } else if (matchTable || /match_list|match_following|match_column/i.test(rawTypeStr) || isMatchKeyword) {
    type = rawTypeStr && /match_list/i.test(rawTypeStr) ? "match_list" : "match_following";
  } else if (
    (assertion && reason) ||
    /assertion_reason/i.test(rawTypeStr) ||
    (/(?:अभिकथन|Assertion)\s*\(?A\)?/i.test(finalQuestion) && /(?:कारण|Reason)\s*\(?R\)?/i.test(finalQuestion))
  ) {
    type = "assertion_reason";
  } else if (table || /table_based/i.test(rawTypeStr)) {
    type = "table_based";
  } else if (
    (statements && statements.length >= 2) ||
    /statement_based|statement|multiple_statements/i.test(rawTypeStr) ||
    (/(?:कथनों\s+पर\s+विचार|उपर्युक्त\s+कथनों|statements?\s+given\s+above)/i.test(finalQuestion) &&
      /(?:^|\n)\s*(?:1[.)]|\(1\)|I[.)]|कथन\s*1)/m.test(finalQuestion))
  ) {
    type = "statement_based";
  } else if (
    /math|numerical|geometry/i.test(rawTypeStr) ||
    /\$[^$]+\$|\\frac|\\sqrt|[√π÷×≤≥≠²³]/.test(`${finalQuestion} ${options.join(" ")}`)
  ) {
    type = rawTypeStr && /math|numerical|geometry/i.test(rawTypeStr) ? rawTypeStr : "math";
  } else if (rawTypeStr) {
    type = rawTypeStr;
  }

  // 11. OCR & Extraction Uncertainty Detection
  const ocrUncertainties: string[] = [];
  // Detect OCR missing digits like "185?" or "19??"
  if (/\b\d{1,3}\?[?\d]*\b/.test(finalQuestion) || options.some((o) => /\b\d{1,3}\?[?\d]*\b/.test(o))) {
    ocrUncertainties.push("Uncertain OCR digits ('?' inside a number/year) detected.");
  }
  // Detect options accidentally merged into question stem
  if (/\([A-Da-d]\)\s+\S+[\s\S]+\([B-Db-d]\)\s+\S+/.test(finalQuestion) && type !== "assertion_reason") {
    ocrUncertainties.push("Option markers (A)/(B) detected inside question stem; options may have merged into the question.");
  }
  // Detect unseparated flat table in question text
  if (
    /तालिका|सारणी|table\s+below/i.test(finalQuestion) &&
    !table &&
    !matchTable &&
    !imageObj &&
    (finalQuestion.match(/\t|\s{4,}/g) || []).length >= 3
  ) {
    ocrUncertainties.push("Question mentions a table and contains spaced columns, but table boundaries could not be reliably separated.");
  }

  return {
    ...raw,
    type,
    questionType: type,
    question: finalQuestion,
    text: finalQuestion,
    options,
    answer,
    correctIndex,
    explanation,
    subject,
    chapter,
    topic,
    year,
    exam,
    examName: exam,
    examHistory,
    questionClassification,
    isPYQ,
    instruction,
    statements,
    assertion,
    reason,
    table,
    tableData: table,
    matchTable,
    image: imageObj,
    imageUrl,
    unsupportedReason,
    ocrUncertainties: ocrUncertainties.length > 0 ? ocrUncertainties : undefined,
    ambiguousAnswerWarning,
    tableErrorWarning,
    matchingErrorWarning,
    rawInput: raw.rawInput !== undefined ? raw.rawInput : raw,
  };
};

