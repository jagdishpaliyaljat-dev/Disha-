import { ExamHistoryEntry, QuestionClassification } from "./schema";

const DEVANAGARI_DIGITS: Record<string, string> = {
  "०": "0", "१": "1", "२": "2", "३": "3", "४": "4",
  "५": "5", "६": "6", "७": "7", "८": "8", "९": "9",
};

export function toAsciiYear(str: string | number | undefined | null): string {
  if (str === undefined || str === null) return "";
  const s = String(str).replace(/[०-९]/g, (d) => DEVANAGARI_DIGITS[d] ?? d);
  const match = s.match(/\b(19\d{2}|20\d{2})\b/);
  return match ? match[1] : s.trim();
}

export function cleanExamName(name: string): string {
  if (!name) return "";
  return name
    .replace(/^(?:EXAM|EXAMINATION|PAPER|परीक्षा|प्रतियोगी\s*परीक्षा)\s*[:.\-–]?\s*/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

export interface ExamDetectionResult {
  examHistory: ExamHistoryEntry[];
  questionClassification: QuestionClassification;
  isPYQ: boolean;
  cleanText: string;
}

/**
 * Normalizes an array of raw exam entries, deduplicating them by (normalized examName + year).
 */
export function normalizeExamHistory(rawList: any[]): ExamHistoryEntry[] {
  if (!Array.isArray(rawList) || rawList.length === 0) return [];

  const seen = new Set<string>();
  const normalized: ExamHistoryEntry[] = [];

  for (const item of rawList) {
    if (!item) continue;
    let examName = "";
    let year: string | number | undefined;
    let verified = true;
    let shift: string | undefined;

    if (typeof item === "string") {
      const parsed = parseSingleExamString(item);
      if (parsed) {
        examName = parsed.examName;
        year = parsed.year;
        verified = parsed.verified ?? true;
        shift = parsed.shift;
      } else {
        examName = cleanExamName(item);
      }
    } else if (typeof item === "object") {
      examName = cleanExamName(
        String(item.examName || item.exam || item.name || item.title || item.examination || "")
      );
      const rawYear = item.year ?? item.examYear ?? item.paperYear;
      if (rawYear !== undefined && rawYear !== null && String(rawYear).trim() !== "") {
        const ascii = toAsciiYear(rawYear);
        year = /^\d{4}$/.test(ascii) ? parseInt(ascii, 10) : ascii;
      }
      if (item.verified !== undefined) {
        verified = Boolean(item.verified);
      }
      if (item.shift) shift = String(item.shift).trim();
    }

    if (!examName) continue;

    const dedupKey = `${examName.toLowerCase().replace(/\s+/g, "")}__${year || ""}`;
    if (!seen.has(dedupKey)) {
      seen.add(dedupKey);
      normalized.push({
        examName,
        ...(year ? { year } : {}),
        verified,
        ...(shift ? { shift } : {}),
      });
    }
  }

  return normalized;
}

/**
 * Parses a string like "CET 12th Level – 2023" or "Patwari 2021 (Shift 1)"
 */
export function parseSingleExamString(str: string): ExamHistoryEntry | null {
  const trimmed = str.trim();
  if (!trimmed) return null;

  // Pattern: "Exam Name [–-:] Year (Shift)"
  const ascii = trimmed.replace(/[०-९]/g, (d) => DEVANAGARI_DIGITS[d] ?? d);
  const match = ascii.match(/^(.+?)(?:[\s,–\-:]+)(\b(?:19\d{2}|20\d{2})\b)(?:\s*(?:\(([^)]+)\)|shift\s*(\d+)))?$/i);
  if (match) {
    const rawName = cleanExamName(match[1]);
    const yr = parseInt(match[2], 10);
    const shift = match[3] || match[4];
    if (rawName) {
      return {
        examName: rawName,
        year: yr,
        verified: true,
        ...(shift ? { shift: shift.trim() } : {}),
      };
    }
  }

  // Bracket format: "[CET 12th Level 2023]"
  const bracketMatch = ascii.match(/^\[([^\]]+)\]$/);
  if (bracketMatch) {
    return parseSingleExamString(bracketMatch[1]);
  }

  const cleaned = cleanExamName(trimmed);
  return cleaned ? { examName: cleaned, verified: true } : null;
}

/**
 * Extracts multiple Exam & Year pairs from raw text lines.
 * Examples supported:
 *
 * Exam: CET 12th Level
 * Year: 2023
 * Exam: Patwari
 * Year: 2021
 *
 * or
 *
 * [CET 12th Level – 2023]
 * [SSC CGL 2022]
 *
 * or
 *
 * परीक्षा: ग्राम विकास अधिकारी (VDO) 2021
 */
export function extractExamsFromText(text: string): {
  exams: ExamHistoryEntry[];
  cleanText: string;
} {
  if (!text) return { exams: [], cleanText: "" };

  const lines = text.split("\n");
  const remainingLines: string[] = [];
  const extracted: ExamHistoryEntry[] = [];

  let pendingExamName: string | null = null;
  let pendingExamLineIdx: number | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Check for "Exam: ..." / "परीक्षा: ..."
    const examMatch = trimmed.match(/^(?:EXAM|EXAMINATION|PAPER|परीक्षा|प्रतियोगी\s*परीक्षा)\s*[:.\-–]\s*(.+)$/i);
    const yearMatch = trimmed.match(/^(?:YEAR|EXAM_YEAR|SESSION|वर्ष|सत्र)\s*[:.\-–]\s*(.+)$/i);

    if (examMatch) {
      if (pendingExamName) {
        // Previous exam didn't have a Year: line, store it now
        extracted.push({ examName: pendingExamName, verified: true });
      }
      const rawVal = examMatch[1].trim();
      const inlineParsed = parseSingleExamString(rawVal);
      if (inlineParsed && inlineParsed.year) {
        extracted.push(inlineParsed);
        pendingExamName = null;
      } else {
        pendingExamName = cleanExamName(rawVal);
      }
      continue; // Skip line from remaining text
    }

    if (yearMatch && pendingExamName) {
      const yrStr = toAsciiYear(yearMatch[1]);
      const yrNum = /^\d{4}$/.test(yrStr) ? parseInt(yrStr, 10) : yrStr;
      extracted.push({
        examName: pendingExamName,
        year: yrNum,
        verified: true,
      });
      pendingExamName = null;
      continue; // Skip line from remaining text
    }

    // Bracketed exam line e.g. "[CET 12th Level - 2023]" or "(RAS Pre 2021)"
    const bracketMatch = trimmed.match(/^[\[(]([A-Za-z\u0900-\u097F0-9\s.,–\-]+(?:\b(?:19\d{2}|20\d{2})\b)[^\])]*)[\])]$/);
    if (bracketMatch && !/^[A-Ea-e1-5क-ङ][.)]/.test(trimmed)) {
      const parsed = parseSingleExamString(bracketMatch[1]);
      if (parsed) {
        extracted.push(parsed);
        continue;
      }
    }

    remainingLines.push(line);
  }

  // If there was a trailing pending exam without year
  if (pendingExamName) {
    extracted.push({ examName: pendingExamName, verified: true });
  }

  return {
    exams: normalizeExamHistory(extracted),
    cleanText: remainingLines.join("\n").trim(),
  };
}

/**
 * Universal Exam Detector for an MCQ object.
 * Inspects all possible locations:
 * 1. raw.examHistory (array)
 * 2. raw.exam / raw.year
 * 3. Text lines in question stem or explanation
 * 4. Parent / section level batch metadata
 */
export function detectQuestionExams(
  raw: any,
  sectionMeta?: { exam?: string; year?: string | number }
): ExamDetectionResult {
  const combinedEntries: ExamHistoryEntry[] = [];

  // 1. Direct examHistory array
  if (Array.isArray(raw?.examHistory)) {
    combinedEntries.push(...normalizeExamHistory(raw.examHistory));
  }
  if (Array.isArray(raw?.exams)) {
    combinedEntries.push(...normalizeExamHistory(raw.exams));
  }
  if (Array.isArray(raw?.exam_history)) {
    combinedEntries.push(...normalizeExamHistory(raw.exam_history));
  }

  // 2. Legacy single fields on the question
  const directExam = raw?.exam || raw?.examName || raw?.exam_name || raw?.examination;
  const directYear = raw?.year || raw?.examYear || raw?.exam_year || raw?.paperYear;
  if (directExam && typeof directExam === "string" && directExam.trim()) {
    const yrStr = directYear !== undefined ? toAsciiYear(directYear) : undefined;
    const yrNum = yrStr && /^\d{4}$/.test(yrStr) ? parseInt(yrStr, 10) : yrStr;
    combinedEntries.push({
      examName: cleanExamName(directExam),
      ...(yrNum ? { year: yrNum } : {}),
      verified: true,
    });
  }

  // 3. Extract any embedded Exam: / Year: lines from question text or rawInput
  const textToScan = typeof raw?.question === "string" ? raw.question : (typeof raw?.text === "string" ? raw.text : "");
  const { exams: textExams, cleanText } = extractExamsFromText(textToScan);
  if (textExams.length > 0) {
    combinedEntries.push(...textExams);
  }

  // Check explanation for trailing Exam / Year blocks
  let cleanExplanation = typeof raw?.explanation === "string" ? raw.explanation : "";
  if (cleanExplanation) {
    const { exams: expExams, cleanText: expCleaned } = extractExamsFromText(cleanExplanation);
    if (expExams.length > 0) {
      combinedEntries.push(...expExams);
      cleanExplanation = expCleaned;
    }
  }

  // 4. Fallback to section/batch metadata only if no question-level exam exists
  if (combinedEntries.length === 0 && sectionMeta?.exam && typeof sectionMeta.exam === "string" && sectionMeta.exam.trim()) {
    const yrStr = sectionMeta.year !== undefined ? toAsciiYear(sectionMeta.year) : undefined;
    const yrNum = yrStr && /^\d{4}$/.test(yrStr) ? parseInt(yrStr, 10) : yrStr;
    combinedEntries.push({
      examName: cleanExamName(sectionMeta.exam),
      ...(yrNum ? { year: yrNum } : {}),
      verified: true,
      source: "section_metadata",
    });
  }

  const finalHistory = normalizeExamHistory(combinedEntries);
  const isPYQ = finalHistory.some((e) => e.verified !== false) || Boolean(raw?.isPYQ);

  let questionClassification: QuestionClassification = "practice";
  if (raw?.questionClassification) {
    questionClassification = raw.questionClassification;
  } else if (isPYQ) {
    questionClassification = "pyq";
  }

  return {
    examHistory: finalHistory,
    questionClassification,
    isPYQ,
    cleanText: cleanText || textToScan,
  };
}

/**
 * Merges two exam history arrays without duplicating any exams, preserving all verified entries.
 */
export function mergeExamHistories(
  existing: ExamHistoryEntry[] = [],
  incoming: ExamHistoryEntry[] = []
): ExamHistoryEntry[] {
  return normalizeExamHistory([...existing, ...incoming]);
}
