import { Question, ExamHistoryEntry, QuestionClassification } from "../types";
import { formatMathAndChemistryLatex } from "./questionsParser";
import {
  cleanExamName,
  normalizeExamHistory,
  parseSingleExamString,
  toAsciiYear,
} from "../lib/mcqImport/examDetector";

export interface ParsedQuestionItem {
  type: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  meta?: {
    subject?: string;
    chapter?: string;
    topic?: string;
    year?: string;
    exam?: string;
    examHistory?: ExamHistoryEntry[];
    [key: string]: any;
  };
  examHistory?: ExamHistoryEntry[];
  questionClassification?: QuestionClassification;
  isPYQ?: boolean;
  confidence: number;
  // UI & Storage compatibility properties
  id: string;
  tempId: string;
  text: string;
  answer: string;
  isValid: boolean;
  errors: string[];
  difficulty: "easy" | "medium" | "hard";
  createdAt: string;
  chapterId?: string;
  topicId?: string;
  isUserAdded?: boolean;
  questionType?: string;
  statements?: string[];
  askLine?: string;
  instruction?: string;
  matchData?: { listI: string[]; listII: string[] };
  matchTable?: { leftTitle?: string; rightTitle?: string; rows: { left: string; right: string }[] };
  assertion?: string;
  reason?: string;
  passage?: string;
  tableData?: { headers: string[]; rows: string[][] };
  rawInput?: string;
  needsReview?: boolean;
  reviewReason?: string;
}

export interface ParseErrorItem {
  blockNo: number;
  reason: string;
  rawText: string;
}

export interface ParseMcqResult {
  questions: ParsedQuestionItem[];
  errors: ParseErrorItem[];
  [Symbol.iterator]?: () => Iterator<ParsedQuestionItem>;
}

// ─────────────────────────────────────────────────────────────
// 1. CONSTANTS & MARKER FAMILIES
// ─────────────────────────────────────────────────────────────

const HDIGIT: Record<string, number> = {
  '०': 0, '१': 1, '२': 2, '३': 3, '४': 4,
  '५': 5, '६': 6, '७': 7, '८': 8, '९': 9
};

export const FAMILIES_4 = [
  { keys: ['A', 'B', 'C', 'D'], bare: true },
  { keys: ['a', 'b', 'c', 'd'], bare: false },
  { keys: ['1', '2', '3', '4'], bare: false },
  { keys: ['क', 'ख', 'ग', 'घ'], bare: false },
  { keys: ['अ', 'ब', 'स', 'द'], bare: false },
  { keys: ['i', 'ii', 'iii', 'iv'], bare: false },
];

export const FAMILIES_2 = [
  { keys: ['A', 'B'], bare: false },
  { keys: ['a', 'b'], bare: false },
  { keys: ['1', '2'], bare: false },
  { keys: ['क', 'ख'], bare: false },
  { keys: ['अ', 'ब'], bare: false },
];

export const markerRe = (k: string, bare: boolean): RegExp => {
  // If k is a digit, ensure it's not followed by another digit or part of a formula/exponent
  const isDigit = /^[0-9०-९]$/.test(k);
  // Special safety for +/-: they are bullets ONLY if they look like markers, NOT if part of chemical equation or numeric value
  if (k === '+' || k === '-' || k === '−') {
    return new RegExp(`^(?:[\\s]*)(?:(?:\\(${k}\\)|${k}[.):\\-])${bare ? `|${k}\\s+(?![0-9A-Z\\[\\{])` : ''})\\s*(.*)$`, 'i');
  }
  const lookahead = isDigit ? '(?![0-9०-९])' : '';
  return new RegExp(`^(?:[*✓✔•➤\\s]*)(?:(?:\\(${k}\\)|${k}${lookahead}[.):\\-])${bare ? `|${k}${lookahead}\\s+` : ''})\\s*(.*)$`, 'i');
};

// ─────────────────────────────────────────────────────────────
// 2. NORMALIZATION & PRE-PROCESSING
// ─────────────────────────────────────────────────────────────

export function replaceHindiDigitsOutsideLatex(text: string): string {
  if (!text) return "";
  const mathRegex = /(\$\$[\s\S]+?\$\$|\\\[[\s\S]+?\\\]|\\\([\s\S]+?\\\)|(?:\$(?!\$)[^$\n]+?\$))/g;
  let lastIdx = 0;
  let match: RegExpExecArray | null;
  let res = "";

  while ((match = mathRegex.exec(text)) !== null) {
    const nonMath = text.slice(lastIdx, match.index);
    res += nonMath.replace(/[०-९]/g, d => String(HDIGIT[d]));
    res += match[0];
    lastIdx = match.index + match[0].length;
  }
  res += text.slice(lastIdx).replace(/[०-९]/g, d => String(HDIGIT[d]));
  return res;
}

/**
 * Real-time validator to detect math expressions that are not wrapped in LaTeX delimiters.
 * Returns a descriptive error message if invalid math is found, otherwise null.
 */
export function validateMathSyntax(text: string): string | null {
  if (!text) return null;

  // 1. Identify valid math blocks to ignore them
  // Matches: $$...$$, \[...\], $...$, \(...\)
  const mathBlockRegex = /(\$\$[\s\S]+?\$\$|\\\[[\s\S]+?\\\]|\\\([\s\S]+?\\\)|\$[^$\n]+?\$)/g;
  const strippedText = text.replace(mathBlockRegex, ' [VALID_MATH] ');

  // 2. Detect "naked" LaTeX commands in the non-math text
  const nakedLatexRegex = /\\(frac|sqrt|times|div|pi|theta|alpha|beta|gamma|degree|angle|triangle|le|ge|neq|approx|sum|int|lim|infty|pm|cdot|mathbf|mathrm|text)\b|\^{|\_{/;
  
  if (nakedLatexRegex.test(strippedText)) {
    return "Math syntax error: LaTeX commands like \\frac or \\sqrt must be wrapped in $ ... $ delimiters.";
  }

  // 3. Detect "naked" powers or subscripts (e.g. x^2, 10^-3)
  // We check for char^char or char_char where char is a letter or digit
  const powerRegex = /(?:\b[a-zA-Z0-9]|\))\^[-+]?[a-zA-Z0-9]/;
  const subRegex = /(?:\b[a-zA-Z0-9]|\))_\{?[a-zA-Z0-9]+\}?/;

  if (powerRegex.test(strippedText)) {
    return "Math syntax error: Superscripts like x^2 must be wrapped in $ ... $ delimiters.";
  }
  if (subRegex.test(strippedText)) {
    return "Math syntax error: Subscripts like H_2O must be wrapped in $ ... $ delimiters.";
  }

  // 4. Detect plain fractions that should be LaTeX (e.g. 3/4)
  // Only if they look like math (surrounded by numbers or common math vars)
  const plainFractionRegex = /\b\d+\/\d+\b/;
  if (plainFractionRegex.test(strippedText)) {
    // Only warn if there's other math in the text or if it's a known math type context
    // For now, let's keep it simple as requested: "plain fraction (3/4) use mat karo"
    return "Math syntax warning: Use LaTeX $\\frac{a}{b}$ instead of plain fractions like 3/4.";
  }

  return null;
}

export function normalize(t: string): string {
  if (!t) return "";
  let s = t
    .replace(/\r\n?/g, '\n')
    .replace(/[\u200b\u200c\u200d\ufeff]/g, '');
  
  s = replaceHindiDigitsOutsideLatex(s)
    .replace(/\u0441\u0435/g, 'से')
    .replace(/\u0441/g, 'c')
    .replace(/\u0435/g, 'e')
    .replace(/^[•➤▶]\s*/gm, '')
    .replace(/^\s*—?\s*(?:PAGE|Page|पृष्ठ)\s*\d+\s*—?\s*$/gim, '')
    .replace(/\s*—\s*Page\s*\d+\s*—[^\n]*/gi, '')
    .replace(/\s*Questions?\s*Generated\s*:\s*\d+[^\n]*/gi, '')
    .replace(/\s*Progress\s*:[^\n]*/gi, '')
    .replace(/\s*Type\s+NEXT[^\n]*/gi, '')
    .replace(/\s*\bPAGE\s*\d+\s*(?:COMPLETED|DONE|END)\b[^\n]*/gi, '')
    .replace(/(?:^|[\s।\n])(?:PAGE|पृष्ठ)\s*\d+\s*(?:COMPLETED|DONE|END|समाप्त)[^\n]*/gi, '')
    .replace(/^\s*(?:PAGE|पृष्ठ)\s*\d+\s*$/gim, '');

  s = formatMathAndChemistryLatex(s);
  
  // Physics safety: Ensure " (g = 10 m/s^2) " or similar given-constants are treated as part of the stem
  // if they are on a new line but look like constants.
  s = s.replace(/\n\s*(\([a-zA-Z]\s*=\s*[\d.x\^\\\{\}\s\/-]+\w*\/[\w\^]+\))/g, ' $1');
  
  return s;
}

export function extractAskLine(stem: string): { cleanStem: string; askLine?: string } {
  // Matches ask line: sentence starting with
  // "उपर्युक्त", "उपरोक्त", "निम्नलिखित में से कौन", "Which of the (above|following)"
  // Can follow "।" or newline or space, or be on same line as the last statement.
  // Ends with "?" (or ":" in some Hindi formulations).
  const askRegex = /(?:^|[\n।.]|\s{2,}|\s+)((\b(?:Which\s+of\s+the\s+(?:above|following|statements?))|(?:उपर्युक्त|उपरोक्त|निम्नलिखित\s+में\s+से\s+कौन))[\s\S]*?(?:\?|[:।\n]|$))\s*$/i;

  const match = stem.match(askRegex);
  if (match && match[1]) {
    const askCandidate = match[1].trim();
    if (
      askCandidate.endsWith('?') ||
      askCandidate.endsWith(':') ||
      /सही\s*(?:है|हैं)|सत्य|गलत|असत्य|correct|true|false|not\s+correct|उपयुक्त|चुनें|चुनिए/i.test(askCandidate)
    ) {
      const idx = stem.lastIndexOf(askCandidate);
      if (idx > 0) {
        let cleanStem = stem.substring(0, idx).trim();
        cleanStem = cleanStem.replace(/[ \t]+$/, '');
        return { cleanStem, askLine: askCandidate };
      }
    }
  }
  return { cleanStem: stem };
}

const statementMarkerRegex = /^(?:(?:कथन|Statement)\s*(?:\(?\s*([0-9]+|[IVXLCDMivxlcdm]+|[क-घa-d])\s*\)?)\s*[:.\-–]?|(?:\(?\s*([0-9]+|[IVXLCDMivxlcdm]+|[क-घa-d])\s*\)|([0-9]+|[IVXLCDMivxlcdm]+)\s*[\.:\-–]))\s*(.*)$/i;

export function extractStatements(cleanStem: string): (string[] & { askLine?: string; cleanStem?: string }) | undefined {
  if (!cleanStem) return undefined;

  const lines = cleanStem.split('\n').map(l => l.trim()).filter(Boolean);
  const rawStatements: string[] = [];
  const introLines: string[] = [];
  let foundStatement1 = false;
  let foundStatement2 = false;
  let currentStatement: string | null = null;
  let extractedAskLine: string | undefined = undefined;
  let pastBullets = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Pipe table lines (|) or Assertion/Reason lines are NOT statements
    if (line.includes('|') || /^(?:अभिकथन|Assertion|कारण|Reason|स्पष्टीकरण|\(A\)|\(R\))/i.test(line)) {
      introLines.push(line);
      continue;
    }

    // Rule 2: Bullet check ("* ", "- ", "• ", "+ " followed by space)
    // A starting negative number/equation like "-3x + 2 = 0", "-285.8 kJ/mol", "+ O2 -> 2H2O" is NOT a bullet!
    const isChemOrMathStart = /^[-+−]\s*(?:\d|[a-zA-Z]|\\[a-zA-Z]+|\().*?(=|\+|-|−|\*|\/|<|>|\\leq|\\geq|\\times|\\div|->|=>|→|⇌)/.test(line) || 
                              /^[-+−]\s*\d+(?:\.\d+)?(?:\s*[a-zA-Z\/·^]+)*(?:\s|$)/.test(line);
    const isBullet = (
      (/^\*\s+/.test(line) && !/^\*{2}/.test(line)) ||
      (/^•\s+/.test(line)) ||
      (/^[-+−]\s+/.test(line) && !isChemOrMathStart)
    );

    if (isBullet) {
      pastBullets = true;
      if (currentStatement) {
        rawStatements.push(currentStatement);
        currentStatement = null;
      }
      const bulletContent = line.replace(/^(?:\*|-|•)\s+/, '').trim();
      const nextNo = rawStatements.length + 1;
      currentStatement = `${nextNo} ${bulletContent}`;
      foundStatement1 = true;
      if (rawStatements.length >= 1) foundStatement2 = true;
      continue;
    }

    const markerMatch = line.match(statementMarkerRegex);
    const isThirdStmt = /^(?:तीसरा|3rd)\s*कथन/i.test(line);

    if (markerMatch || isThirdStmt) {
      pastBullets = true;
      if (currentStatement) {
        rawStatements.push(currentStatement);
      }
      currentStatement = isThirdStmt ? `कथन 3: ${line}` : line;
      if (!foundStatement1) {
        foundStatement1 = true;
      } else if (!foundStatement2) {
        foundStatement2 = true;
      }
    } else if (pastBullets && rawStatements.length >= 1 && !isBullet) {
      const askMatch = line.match(/^(.*?)\s*((\b(?:Which\s+of\s+the\s+(?:above|following|statements?))|(?:उपर्युक्त|उपरोक्त|निम्नलिखित\s+में\s+से\s+कौन))[\s\S]*?(?:\?|[:।\n]|$))$/i);
      if (askMatch && askMatch[2]) {
        const stmtPart = askMatch[1].trim();
        const askPart = askMatch[2].trim();
        if (stmtPart) {
          if (currentStatement) {
            currentStatement += ' ' + stmtPart;
          } else {
            const nextNo = rawStatements.length + 1;
            currentStatement = `कथन ${nextNo}: ${stmtPart}`;
          }
        }
        if (currentStatement) {
          rawStatements.push(currentStatement);
          currentStatement = null;
        }
        extractedAskLine = askPart;
      } else if (
        line.startsWith('उपर्युक्त') ||
        line.startsWith('उपरोक्त') ||
        line.startsWith('निम्नलिखित') ||
        /Which\s+of\s+the/i.test(line) ||
        /कथन\s*सही/i.test(line) ||
        line.endsWith('?') ||
        line.endsWith(':')
      ) {
        if (currentStatement) {
          rawStatements.push(currentStatement);
          currentStatement = null;
        }
        extractedAskLine = line;
      } else if (currentStatement) {
        currentStatement += ' ' + line;
      }
    } else if (foundStatement1 && foundStatement2 && !currentStatement?.endsWith('और') && !currentStatement?.endsWith(',')) {
      if (currentStatement) {
        rawStatements.push(currentStatement);
        currentStatement = null;
      }
      const nextNo = rawStatements.length + 1;
      currentStatement = `कथन ${nextNo}: ${line}`;
    } else if (currentStatement) {
      currentStatement += ' ' + line;
    } else {
      introLines.push(line);
    }
  }

  if (currentStatement) {
    rawStatements.push(currentStatement);
  }

  if (rawStatements.length >= 2) {
    const res: any = rawStatements;
    if (extractedAskLine) {
      res.askLine = extractedAskLine;
    }
    if (introLines.length > 0) {
      res.cleanStem = introLines.join('\n').trim();
    }
    return res;
  }

  return undefined;
}

export function extractMatchTable(stem: string): { leftTitle?: string; rightTitle?: string; rows: { left: string; right: string }[]; cleanStem?: string } | undefined {
  if (!stem) return undefined;
  const lines = stem.split('\n').map(l => l.trim()).filter(Boolean);

  const hasTableSeparator = lines.some(l => /^\|?[\s\-:]+\|[\s\-:]+\|?$/.test(l) || /^[-:\s|]{3,}$/.test(l));
  const pipeLines = lines.filter(l => {
    if (!l.includes('|')) return false;
    // Skip single absolute value expressions like |x| or |x - 3| < 5
    if (/^\s*\|[^|]+\|\s*(?:<|>|=|<=|>=|\+|-|\*|\/|\\le|\\ge|\\ne)?/i.test(l) && !hasTableSeparator && !/सूची|List|Column|स्तम्भ|खण्ड|Table|Chart|Graph/i.test(l)) {
      return false;
    }
    return true;
  });

  if (pipeLines.length < 2 && !hasTableSeparator) return undefined;

  let leftTitle = 'सूची-I';
  let rightTitle = 'सूची-II';
  const rows: { left: string; right: string }[] = [];
  let isFirstRow = true;

  pipeLines.forEach(line => {
    // 1. Har line se shuru aur ant ka "|" hatao (trim), phir "|" se split karo
    const cleanLine = line.replace(/^\|+/, '').replace(/\|+$/, '').trim();

    // 2. "|---|---|" jaisi separator line skip karo
    if (!cleanLine || /^[\s|\-:]+$/.test(line) || /^[-:\s]+$/.test(cleanLine)) {
      return;
    }

    const parts = cleanLine.split('|').map(p => p.trim());
    if (parts.length >= 2) {
      const p0 = parts[0];
      const p1 = parts[1];

      const isHeaderKeyword = /^(?:सूची-?|List-?|Column-?|स्तम्भ|खण्ड|Table|अभयारण्य|विषय|जिला|राज्य)\s*[I1A]?$/i.test(p0) ||
                              (/सूची|List|Column|स्तम्भ|खण्ड|अभयारण्य|विषय|जिला|राज्य/i.test(p0) && /सूची|List|Column|स्तम्भ|खण्ड|जीव|वर्ष|विवरण|वन्यजीव/i.test(p1) && !/\d+/.test(p0));

      if (isFirstRow || isHeaderKeyword) {
        if (isHeaderKeyword || !/\d+/.test(p0)) {
          leftTitle = p0;
          rightTitle = p1;
          isFirstRow = false;
          return;
        }
      }

      isFirstRow = false;

      // 3. Left cell "1. text" aur right cell "A. text" se label aur text alag karo
      const leftClean = p0.replace(/^(?:\(?\s*(?:[0-9]+|[a-dA-D1-4क-घ]|I{1,3}|IV|VI{0,3})\s*\)?[\.:\-–]?)\s*/i, '').trim();
      const rightClean = p1.replace(/^(?:\(?\s*(?:[0-9]+|[a-dA-D1-4क-घ]|i{1,3}|iv|vi{0,3}|[क-घ])\s*\)?[\.:\-–]?)\s*/i, '').trim();

      rows.push({ left: leftClean || p0, right: rightClean || p1 });
    }
  });

  if (rows.length === 0) return undefined;

  // Q ke stem me intro sentence ("... सुमेलित कीजिए ...") hamesha rahe
  // "प्रश्न:" / "Q." jaisa label hata ke uske baad ka text stem banao
  const introLines = lines
    .filter(l => !l.includes('|'))
    .map(l => l.replace(/^\s*(?:Q\.?|प्रश्न|Question|Que\.?)\s*\(?\d*[.):]?\s*/i, '').replace(/^[:.\-–]\s*/, '').trim())
    .filter(Boolean);

  let cleanStem = introLines.join('\n').trim();
  if (!cleanStem) {
    cleanStem = stem
      .split('\n')[0]
      .replace(/^\s*(?:Q\.?|प्रश्न|Question|Que\.?)\s*\(?\d*[.):]?\s*/i, '')
      .replace(/^[:.\-–]\s*/, '')
      .trim();
  }

  return { leftTitle, rightTitle, rows, cleanStem };
}

export function extractAssertionReason(stem: string): { assertion?: string; reason?: string; cleanStem?: string; askLine?: string } | undefined {
  if (!stem) return undefined;
  const lines = stem.split('\n').map(l => l.trim()).filter(Boolean);
  let assertion: string | undefined = undefined;
  let reason: string | undefined = undefined;
  const introLines: string[] = [];
  let askLine: string | undefined = undefined;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const assertMatch = line.match(/^(?:अभिकथन|Assertion|कथन\s*\(?A\)?)\s*\(?A\)?\s*[:.\-–]\s*(.+)$/i) || line.match(/^\(A\)\s*[:.\-–]\s*(.+)$/i);
    const reasonMatch = line.match(/^(?:कारण|Reason|स्पष्टीकरण|कथन\s*\(?R\)?)\s*\(?R\)?\s*[:.\-–]\s*(.+)$/i) || line.match(/^\(R\)\s*[:.\-–]\s*(.+)$/i);

    if (assertMatch) {
      assertion = assertMatch[1].trim();
    } else if (reasonMatch) {
      reason = reasonMatch[1].trim();
    } else {
      if (/उपर्युक्त|उपरोक्त|निम्नलिखित|Which\s+of\s+the|सबसे\s+उपयुक्त|चुनें/i.test(line) || line.endsWith('?')) {
        askLine = line;
      } else if (!assertion && !reason) {
        introLines.push(line);
      } else if (assertion && !reason) {
        assertion += ' ' + line;
      } else if (reason) {
        reason += ' ' + line;
      }
    }
  }

  if (assertion && reason) {
    const cleanStem = introLines.join('\n').trim() || "नीचे दो कथन दिए गए हैं, एक को अभिकथन (A) और दूसरे को कारण (R) के रूप में नामांकित किया गया है।";
    return {
      assertion,
      reason,
      cleanStem,
      askLine: askLine || "उपर्युक्त कथनों के आलोक में, सबसे उपयुक्त उत्तर चुनें :"
    };
  }

  return undefined;
}

// ─────────────────────────────────────────────────────────────
// 3. ANSWER KEY EXTRACTION
// ─────────────────────────────────────────────────────────────

export function extractAnswerKey(text: string): { body: string; key: Record<number, string> } {
  const at = text.search(/(?:answer\s*key|उत्तरमाला|उत्तर\s*कुंजी|उत्तर\s*तालिका)/i);
  if (at < 0) return { body: text, key: {} };
  const key: Record<number, string> = {};
  for (const m of text.slice(at).matchAll(/(\d+)\s*[-–:.)]\s*\(?([A-Da-d1-4क-घअ-द])\)?/g)) {
    key[+m[1]] = m[2].toUpperCase();
  }
  return { body: text.slice(0, at), key };
}

// ─────────────────────────────────────────────────────────────
// 4. BLOCK SPLITTING
// ─────────────────────────────────────────────────────────────

interface SplitBlockResult extends Array<string[]> {
  meta?: { subject?: string; exam?: string; year?: string; chapter?: string; topic?: string; [key: string]: any };
}

export function splitBlocks(body: string): SplitBlockResult {
  const lines = body.split('\n');
  const qPref = /^\s*(?:Q\.?|प्रश्न|Question|Que\.?)\s*(?:\(?(\d+)[.):]?|[:\-–])\s*/i;
  const hasQPref = lines.some(l => qPref.test(l));

  const blocks: SplitBlockResult = [] as any;
  blocks.meta = {};
  let cur: string[] | null = null, last = 0;
  let activePassage: string | null = null;
  const passageIntroRe = /^\s*(?:गद्यांश|पद्यांश|passage|directions?|निर्देश|read the following)/i;

  const bufferBeforeFirstQ: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    const trimmed = l.trim();
    if (!trimmed) {
      if (cur) cur.push(l);
      continue;
    }

    if (/^SUBJECT\s*:/i.test(trimmed)) {
      if (cur) cur.push(trimmed);
      else blocks.meta.subject = trimmed.replace(/^SUBJECT\s*:/i, '').trim();
      continue;
    }
    if (/^EXAM\s*:/i.test(trimmed)) {
      if (cur) cur.push(trimmed);
      else blocks.meta.exam = trimmed.replace(/^EXAM\s*:/i, '').trim();
      continue;
    }
    if (/^YEAR\s*:/i.test(trimmed)) {
      if (cur) cur.push(trimmed);
      else blocks.meta.year = trimmed.replace(/^YEAR\s*:/i, '').trim();
      continue;
    }
    if (/^CHAPTER\s*:/i.test(trimmed)) {
      if (cur) cur.push(trimmed);
      else blocks.meta.chapter = trimmed.replace(/^CHAPTER\s*:/i, '').trim();
      continue;
    }
    if (/^TOPIC\s*:/i.test(trimmed)) {
      if (cur) cur.push(trimmed);
      else blocks.meta.topic = trimmed.replace(/^TOPIC\s*:/i, '').trim();
      continue;
    }

    // Check if a new passage is starting
    if (passageIntroRe.test(trimmed)) {
      const pLines: string[] = [trimmed];
      i++;
      while (i < lines.length && !qPref.test(lines[i]) && !/^\s*(\d+)[.)]\s+/.test(lines[i])) {
        if (lines[i].trim()) pLines.push(lines[i].trim());
        i++;
      }
      activePassage = pLines.join('\n');
      i--; // adjust so loop sees next line
      continue;
    }

    const isPipeLine = trimmed.includes('|');
    const m = (!isPipeLine && hasQPref) 
      ? trimmed.match(qPref) 
      : (!isPipeLine ? (trimmed.match(qPref) || trimmed.match(/^\s*(\d+)[.)]\s+/)) : null);

    if (m) {
      const qNum = m[1] ? +m[1] : (last + 1);
      const startLines = activePassage ? [activePassage, trimmed] : [trimmed];
      cur = startLines;
      blocks.push(cur);
      last = qNum;
    } else if (cur) {
      cur.push(trimmed);
    } else {
      bufferBeforeFirstQ.push(trimmed);
    }
  }

  // If no blocks formed, treat all lines as single question block
  if (blocks.length === 0 && lines.some(l => l.trim().length > 0)) {
    const filtered = lines.filter(l => l.trim().length > 0);
    blocks.push(filtered);
  } else if (blocks.length > 0 && bufferBeforeFirstQ.length > 0) {
    // Check if buffer before first Q was a passage
    const beforeText = bufferBeforeFirstQ.join('\n');
    if (passageIntroRe.test(beforeText)) {
      blocks[0].unshift(beforeText);
    }
  }

  return blocks;
}

// ─────────────────────────────────────────────────────────────
// 5. BOTTOM-UP OPTIONS EXTRACTION
// ─────────────────────────────────────────────────────────────

export interface ExtractedOptionsResult {
  opts: string[];
  stemEnd: number;
  family: any;
  stemTail?: string;
  hintIndex?: number;
}

export function extractOptions(lines: string[], endIdx: number): ExtractedOptionsResult | null {
  // 1. Check 4-option families first
  for (const f of FAMILIES_4) {
    let i = endIdx, ok = true;
    const opts: string[] = [];
    let hintIndex = -1;

    for (let kIdx = f.keys.length - 1; kIdx >= 0; kIdx--) {
      const k = f.keys[kIdx];
      const re = markerRe(k, f.bare);
      const buf: string[] = [];
      let gap = 0, found = false;

      while (i >= 0 && gap <= 3) {
        const line = lines[i];
        const m = line.match(re);
        if (m) {
          if (/\*\*|✓|✔/.test(line)) {
            hintIndex = kIdx;
          }
          buf.unshift(m[1]);
          i--;
          found = true;
          break;
        }
        buf.unshift(line);
        i--;
        gap++;
      }

      if (!found) {
        ok = false;
        break;
      }
      opts.unshift(buf.join(' ').trim());
    }

    if (ok) return { opts, stemEnd: i, family: f, hintIndex };
  }

  // 2. Check inline options on a single line (e.g. (a) x (b) y (c) z (d) w or A. x B. y C. z D. w)
  for (let idx = endIdx; idx >= Math.max(0, endIdx - 2); idx--) {
    const last = lines[idx] || '';

    // Check parenthesized inline: (a) x (b) y (c) z (d) w
    const partsParen = last.split(/\s*\(([a-dA-D1-4क-घ])\)\s*/);
    if (partsParen.length >= 9) {
      return {
        opts: [partsParen[2], partsParen[4], partsParen[6], partsParen[8]],
        stemEnd: idx - 1,
        family: FAMILIES_4[1],
        stemTail: partsParen[0] ? '\n' + partsParen[0] : '',
        hintIndex: -1
      };
    }

    // Check dotted inline: A. x B. y C. z D. w or A) x B) y C) z D) w
    const partsDot = last.split(/(?:^|\s+)([A-Da-d1-4क-घ])[\.\:\)\-]\s+/);
    if (partsDot.length >= 9) {
      return {
        opts: [partsDot[2], partsDot[4], partsDot[6], partsDot[8]],
        stemEnd: idx - 1,
        family: FAMILIES_4[0],
        stemTail: partsDot[0] ? '\n' + partsDot[0] : '',
        hintIndex: -1
      };
    }
  }

  // 3. Check 2-option families (e.g. True/False or A, B)
  for (const f of FAMILIES_2) {
    let i = endIdx, ok = true;
    const opts: string[] = [];
    let hintIndex = -1;

    for (let kIdx = f.keys.length - 1; kIdx >= 0; kIdx--) {
      const k = f.keys[kIdx];
      const re = markerRe(k, f.bare);
      const buf: string[] = [];
      let gap = 0, found = false;

      while (i >= 0 && gap <= 3) {
        const line = lines[i];
        const m = line.match(re);
        if (m) {
          if (/\*\*|✓|✔/.test(line)) {
            hintIndex = kIdx;
          }
          buf.unshift(m[1]);
          i--;
          found = true;
          break;
        }
        buf.unshift(line);
        i--;
        gap++;
      }

      if (!found) {
        ok = false;
        break;
      }
      opts.unshift(buf.join(' ').trim());
    }

    if (ok) return { opts, stemEnd: i, family: f, hintIndex };
  }

  return null;
}

// ─────────────────────────────────────────────────────────────
// 6. ANSWER PARSING
// ─────────────────────────────────────────────────────────────

export function parseAnswer(line: string, opts: string[]): number {
  const t = line.replace(/^(answer|ans|correct|उत्तर|सही\s*उत्तर|right\s*option)\s*[:\-–]?\s*/i, '').trim();

  // 1. Pehle letter nikalo: e.g. "(a) 1-B, 2-A, 3-D, 4-C", "(b)", "A", "option 1", "(1)", "क"
  const m = t.match(/^(?:option\s*)?\(?([A-Da-d1-4क-घअ-द])\)?(?:\s*[\.:\-–]|\s+|$)/i);
  if (m) {
    const all = 'ABCD' + 'abcd' + '1234' + 'कखगघ' + 'अबसद';
    const idx = all.indexOf(m[1]) % 4;
    if (idx >= 0) return idx;
  }

  // 2. Na mile to option text se match karo (normalize karke):
  const norm = (s: string) => s.toLowerCase().replace(/[\s\p{P}\p{S}]/gu, '');
  const targetNorm = norm(t);

  if (targetNorm.length > 0) {
    const byText = opts.findIndex(o => {
      const oNorm = norm(o);
      return oNorm === targetNorm || (oNorm.length >= 3 && targetNorm.includes(oNorm)) || (targetNorm.length >= 3 && oNorm.includes(targetNorm));
    });
    if (byText >= 0) return byText;
  }

  return -1;
}

export function detectMathMeta(
  stem: string,
  options: string[],
  explanation: string,
  matchTable?: any
): { hasMath: boolean; mathType?: string; physicsTopic?: string; chemTopic?: string; hasUnits?: boolean; hasFormula?: boolean; isNegative?: boolean } {
  const combined = `${stem}\n${options.join(' ')}\n${explanation}`;

  // 1. Identification of potential topics
  let detectedChemTopic: string | undefined;
  let detectedPhysTopic: string | undefined;

  const chemKeywords: [string, RegExp][] = [
    ['atomic_structure', /atomic|proton|neutron|isotope|electron|configuration|orbital|quantum|nucleus|permanu|नाभिक|इलेक्ट्रॉन|प्रोटॉन|न्यूट्रॉन|समस्थानिक|विन्यास|कक्षक|थॉमसन|रदरफोर्ड|बोर|आइसोटोप|Mg\^2\+|आवेश|परमाणु/i],
    ['periodic_table', /periodic table|halogen|noble gas|alkali|metalloid|mendeleev|modern periodic|आवर्त सारणी|हैलोजन|अक्रिय गैस|क्षार धातु|क्षारीय मृदा|उपधातु|परमाणु त्रिज्या|आयनन विभव/i],
    ['chemical_bonding', /valence|covalent|ionic|bonding|molecule|octet|resonance|hybridization|electrostati|संयोजकता|आबंध|आयनिक|सहसंयोजक|अष्टक|अनुनाद|संकरण|हीरक|ग्रेफाइट|बंधन|कुचालक/i],
    ['states_of_matter', /ideal gas|boyle's|charles|dalton|gas law|द्रव्य की अवस्थाएं|अवस्था|आदर्श गैस|पृष्ठ तनाव|वाष्प दाब/i],
    ['thermodynamics', /enthalpy|entropy|gibbs|isothermal|adiabatic|thermochem|ऊष्मागतिकी|एन्थैल्पी|एन्ट्रॉपी|ऊष्माक्षेपी|ऊष्माशोषी|ऊष्मा/i],
    ['equilibrium_ph', /equilibrium|le chatelier|buffer|pH\b|indicator|NaOH|HCl|H2SO4|HNO3|titration|साम्यावस्था|pH मान|अम्ल|क्षार|लवण|सूचक|बफर|सांद्रण|तनु/i],
    ['solutions_electrochemistry', /molarity|molality|normality|solubility|osmotic|raoult|electrolysis|faraday|galvanic|anode|cathode|मोलरता|मोललता|विलेयता|परासरण|विद्युत अपघटन|एनोड|कैथोड/i],
    ['kinetics', /catalyst|activation energy|rate law|zero order|first order|उत्प्रेरक|सक्रियण ऊर्जा|अभिक्रिया की दर/i],
    ['metals_nonmetals', /oxidation|reduction|redox|rusting|corrosion|reactivity series|displacement|ऑक्सीकरण|अपचयन|रेडॉक्स|क्षरण|जंग|संक्षारण|विस्थापन/i],
    ['metallurgy', /metallurgy|ore|gangue|flux|calcination|roasting|अयस्क|धातुकी|निक्षालन|भर्जन|सिनेबार|हेमाटाइट|बॉक्साइट/i],
    ['polymers_biomolecules', /polymer|monomer|nylon|teflon|cellulose|protein|carbohydrate|vitamin|enzyme|बहुलक|प्रोटीन|कार्बोहाइड्रेट|विटामिन|एंजाइम|सेल्युलोज/i],
    ['organic_hydrocarbons', /organic|alkane|alkene|alkyne|hydrocarbon|isomer|benzene|methane|ethane|आईयूपीएसी|IUPAC|कार्बनिक|समावयवता|मेथेन|एथेन|ब्यूटेन|एथीन|मिथेन/i],
    ['everyday_chemistry', /soap|detergent|fertilizer|alloy|brass|bronze|steel|cement|glass|साबुन|अपमार्जक|उर्वरक|मिश्रधातु|पीतल|कांसा|स्टील/i],
    ['environmental_chemistry', /pollution|greenhouse|ozone|global warming|smog|acid rain|पर्यावरण|ओजोन|प्रदूषण/i],
    ['mole_concept_stoichiometry', /mole|stoichiometry|molecular weight|molar mass|balancing|मोल संकल्पना|तत्वानुपाती|आणविक भार|संतुलन|मोलों/i],
    ['important_compounds', /compound|baking soda|washing soda|bleaching powder|plaster of paris|यौगिक|रासायनिक सूत्र|सूत्र|सोडा|क्लोराइड/i]
  ];

  const physKeywords: [string, RegExp][] = [
    ['modern_physics', /photoelectric|half-life|radioactivity|atomic nucleus|photon|bohr model|x-ray|आधुनिक भौतिकी|रेडियोधर्मी|नाभिकीय|प्रकाश विद्युत|फोटॉन|अर्द्ध आयु/i],
    ['electricity', /electricity|resistance|ohm|voltage|current|circuit|capacitor|resistor|kirchhoff|ammeter|voltmeter|विद्युत|धारा|प्रतिरोध|ओम|विभवांतर|परिपथ/i],
    ['magnetism_emi', /magnetism|magnetic field|flux|induction|solenoid|चुंबकत्व|चुंबकीय|प्रेरण|कुंडली/i],
    ['optics', /optics|lens|mirror|refraction|reflection|prism|telescope|microscope|focal|प्रकाशिकी|लेंस|दर्पण|अपवर्तन|परावर्तन|प्रिज्म|फोकस/i],
    ['waves_sound', /waves|sound|frequency|amplitude|wavelength|doppler|echo|तरंग|ध्वनि|आवृत्ति|आयाम|तरंगदैर्ध्य/i],
    ['units_dimensions', /dimensions|SI unit|scalar|vector|measurement|मात्रक|इकाई|विमा|विमीय|अदिश|सदिश/i],
    ['gravitation', /gravitation|gravity|kepler|universal law|गुरुत्वाकर्षण|गुरुत्व|केपलर/i],
    ['rotation_shm', /moment of inertia|SHM|pendulum|torque|angular momentum|centripetal|घूर्णन|जड़त्व आघूर्ण|सरल आवर्त गति|बलाघूर्ण/i],
    ['heat_thermodynamics', /thermodynamics|entropy|conduction|convection|radiation|latent heat|specific heat|ऊष्मागतिकी|चालन|संवहन|विकरण|विशिष्ट ऊष्मा/i],
    ['properties_of_matter', /density|viscosity|pressure|surface tension|elasticity|bernoulli|pascal|घनत्व|श्यानता|दाब|प्रत्यास्थता/i],
    ['work_energy_power', /\b(?:kinetic energy|potential energy|joule|watt)\b|\bpower\b(?!house)|\bwork\b(?!\s+(?:in|and|done|days|together))/i],
    ['laws_of_motion', /laws of motion|friction|inertia|newton|force|momentum|impulse|गति के नियम|घर्षण|जड़त्व|बल|संवेग/i],
    ['kinematics', /kinematics|velocity|acceleration|displacement|projectile|वेग|त्वरण|विस्थापन|प्रक्षेप्य|दूरी|चाल/i],
    ['instruments_scientists', /vernier|screw gauge|telescope|galvanometer|scientist|newton|einstein|raman|उपकरण|वैज्ञानिक/i],
    ['everyday_applications', /rainbow|mirage|scattering|blue sky|twinkling|इंद्रधनुष|मरीचिका|प्रकीर्णन/i]
  ];

  for (const [topic, regex] of chemKeywords) {
    if (regex.test(combined)) {
      detectedChemTopic = topic;
      break;
    }
  }
  for (const [topic, regex] of physKeywords) {
    if (regex.test(combined)) {
      detectedPhysTopic = topic;
      break;
    }
  }

  // 2. Formula & Units Detection
  const elementPart = '(?:H[ef]?|L[ia]|B[er]?|C[alno]?|N[aeio]?|O[gs]?|F[er]?|Ne|Na|Mg|Al|Si|P[bort]?|S[bceimnr]?|Cl|Ar|K[r]?|Ca|Sc|Ti|V|Cr|Mn|Fe|Co|Ni|Cu|Zn|G[ade]|A[srtu]|Se|Br|Kr|R[bdefghu]|S[bnr]|Y[b]?|Zr|N[bd]|Mo|Tc|Ru|Rh|Pd|Ag|Cd|In|Sn|Sb|Te|I[r]?|Xe|Cs|Ba|L[aru]|Ce|Pr|Nd|Pm|Sm|Eu|Gd|Tb|Dy|Ho|Er|Tm|Lu|Hf|Ta|W|Os|Pt|Au|Hg|Tl|Bi|Po|At|Rn|Fr|Ra|Ac|Th|Pa|U|Np|Pu|Am|Cm|Bk|Cf|Es|Fm|Md|No|Rf|Db|Sg|Bh|Hs|Mt|Ds|Rg|Cn|Nh|Fl|Mc|Lv|Ts|Og)';
  const formulaMarkers = '[0-9₀-₉\\(\\)\\[\\]\\+\\-\\^\\{\\}⁺⁻]';
  const fullFormulaRe = new RegExp(`(?:^|\\s|[ \\.\\(\\[])(?:${formulaMarkers}*${elementPart}${formulaMarkers}*)+`, 'g');
  const formulaMatches = combined.match(fullFormulaRe) || [];

  const hasFormulaStructural = formulaMatches.some(m => {
    const clean = m.trim().replace(/[ \.\(\)\[\]]/g, '');
    if (clean.length <= 1) return false;
    if (/^(?:HCF|LCM|BODMAS|AP|GP|HP|STP|NTP|SI|UV|IR|NMR|pH|TIR|DNA|RNA|ATP|ADP|NOT|YES|MCQ|PDF|JEE|NEET|radius|diameter|force|speed|energy|work|mass|time|power|angle|circle|gravity|density|volume|area|mean|mode|median|ratio|percentage|interest|profit|loss|mixture|equation|root|cube|square|sin|cos|tan|theta|alpha|beta|gamma)$/i.test(clean)) return false;
    
    // Ignore single letter element matches like C or A followed by numbers unless it is a recognized chemical formula
    const cleanForElements = clean.replace(/[0-9₀-₉\+\-\^\{\}⁺⁻]/g, '');
    if (cleanForElements.length === 1 && !/^(?:CO|NO|SO|HI|KI|HF|NaCl|NaOH|HCl|KOH|NH3|CH4|H2O|CaO|MgO|LiF|KCl|CO2|SO2|NO2|H2S|PH3|AsH3|CFC)$/i.test(clean)) {
      return false;
    }

    const elementMatches = cleanForElements.match(new RegExp(elementPart, 'g')) || [];
    if (!elementMatches || elementMatches.join('') !== cleanForElements) return false;
    
    const hasLowercase = /[a-z]/.test(clean);
    const hasDigit = /[0-9₀-₉]/.test(m);
    const hasBracket = /[\(\)\[\]]/.test(m);
    const hasCharge = /[\+\-⁺⁻\^]/.test(m);
    const isCommonUppercase = /^(?:CO|NO|SO|HI|KI|HF|NaCl|NaOH|HCl|KOH|NH3|CH4|H2O|CaO|MgO|LiF|KCl|CO2|SO2|NO2|H2S|PH3|AsH3|CFC)$/i.test(clean);
    
    if (elementMatches.length >= 2 && !hasLowercase && !hasDigit && !hasBracket && !hasCharge && !isCommonUppercase) {
       if (elementMatches.length >= 3) return false; 
    }
    return hasLowercase || (hasDigit && elementMatches.length >= 2) || hasBracket || hasCharge || isCommonUppercase;
  });

  const hasFormulaExplicit = /\\ce\{|->|=>|<=>|⇌|→|\rightleftharpoons|\\Delta\s*H|K_[cp]|pH\b|\d+[spdf]\^?\d+|\([slg](?:aq)?\)/.test(combined);
  const hasFormula = hasFormulaStructural || hasFormulaExplicit;
  const hasUnits = /(?:\b|\d|\}|\\mathrm\{|\\text\{)\s*(m|s|kg|N|J|W|Pa|Hz|V|A|Ω|C|F|T|H|K|mol|cd|rad|sr|eV|cal|atm|L|m\/s|m\/s²|kg·m|N\/m²|W\/m²|kg\/m³|J\/kg·K|Å|μ|µ|V\s*[:：]\s*I|V:I|km\/h|°C|MeV|cm³|g\/cm³|mol\/L|kJ\/mol|g\/mol)(?:\s|$|\)|\]|\})/.test(combined);

  // 3. Classification
  const hasLatexDelim = /\$|\\\(|\\\[/.test(combined);
  const hasLatexCmd = /\\[a-zA-Z]+/.test(combined);
  const hasUnicodeMath = /[√π×÷½¼°∠△≤≥≠∞²³θ⇌→]/.test(combined);
  const hasMathExpr = /(?:^|\s)[a-z]\s*\^\s*\d+|sqrt\(|\b\d+\s*[\+\-\*\/\%\=]\s*\d+|\b\d+\s*:\s*\d+/i.test(combined);
  const mathKeywords = /percentage|profit|loss|interest|time.*work|speed|distance|mixture|quadratic|equation|triangle|circle|surface area|volume|sin|cos|tan|mean|median|mode|probability|permutation|combination|venn|data interpretation|bar chart|pie chart|histogram|statistics|arithmetic|geometry|mensuration|trigonometry|प्रतिशत|लाभ|हानि|ब्याज|समय.*कार्य|दूरी|मिश्रण|सरलीकरण|द्विघात|समीकरण|त्रिभुज|वृत्त|क्षेत्रफल|आयतन|त्रिकोणमिति|माध्य|प्रायिकता|व्यवस्थ|क्रम|संचय/i;

  const isNegative = /(?:नहीं|गलत|सही नहीं|असत्य)|\b(NOT|incorrect|FALSE|wrong)\b/i.test(`${stem}\n${options.join(' ')}`);

  let mathType: string | undefined;

  // PRIORITY: Specific Math Topics > Chemistry/Physics Fallbacks
  const isMatchList = /सूची-?\s*I[\s\S]*सूची-?\s*II|List-?\s*I[\s\S]*List-?\s*II|Match\s+List|Match\s+the\s+following/i.test(combined);
  const isPipeTableValid = Boolean(matchTable && matchTable.rows && matchTable.rows.length > 0);

  if ((isPipeTableValid && !isMatchList) || /data interpretation|bar chart|pie chart|line graph|histogram|table data|आंकड़ा|आंकड़े|बार चार्ट|पाई चार्ट|डेटा व्याख्या/i.test(combined)) mathType = 'data_interpretation';
  else if (/permutation|combination|arrangement|selection|क्रमचय|संचय|व्यवस्थ|\\binom|n!|\^\d+[PC]_\d+/i.test(combined)) mathType = 'permutation_combination';
  else if (/probability|likely|dice|coins?|cards?|drawing a|प्रायिकता|संभावना|पासा|सिक्का|ताश/i.test(combined)) mathType = 'probability';
  else if (/statistics|mean|median|mode|variance|standard deviation|सांख्यिकी|माध्य|माध्यिका|बहुलक/i.test(combined)) mathType = 'statistics';
  else if (/sets?\b|venn diagram|intersection|union|subset|समुच्चय आरेख|वेन आरेख|प्रतिच्छेदन|\\cap|\\cup|\\subset/i.test(combined)) mathType = 'sets_venn';
  else if (/trigonometr|height.*distance|त्रिकोणमिति|\\theta|\\sin|\\cos|\\tan|sin\s|cos\s|tan\s|cot\s|sec\theta|cosec\s/i.test(combined)) mathType = 'trigonometry';
  else if (/mensuration|surface area|volume|perimeter|cube|cuboid|cylinder|cone|sphere|hemisphere|क्षेत्रफल|आयतन|परिमाप|बेलन|शंकु|गोला|घन/i.test(combined)) mathType = 'mensuration';
  else if (/geometry|triangle|circle|polygon|quadrilateral|parallel|perpendicular|angle|tangent|chord|radius|diameter|coordinate|ज्यामिति|त्रिभुज|वृत्त|कोण|त्रिज्या|व्यास|समकोण|कर्ण|रेखा|बिंदु|\\angle|\\triangle|∠|△/i.test(combined)) mathType = 'geometry';
  else if (/algebra|quadratic|polynomial|inequality|discriminant|roots of|बीजगणित|द्विघात|बहुपद|समीकरण|असमिका|असमानता|\\le|\\ge|\|x.*\||x\s*[\+\-]\s*y/i.test(combined)) mathType = 'algebra';
  else if (/time and work|pipes? and cistern|man-days|work together|complete a work|can do a work|finish.*together|days.*together|समय और कार्य|पाइप और टंकी|कार्य और समय/i.test(combined)) mathType = 'time_work';
  else if (/\bby car\b|time and distance|\btrain\b|\bstream\b|\bboat\b|relative speed|दूरी\b|रेलगाड़ी|नाव|धारा|औसत चाल|km\/h|m\/s/i.test(combined)) mathType = 'time_speed_distance';
  else if (/mixture|alligation|purity|dilution|मिश्रण|घोल|दूध और पानी/i.test(combined)) mathType = 'mixture';
  else if (/number series|missing term|missing number|next number|संख्या श्रृंखला|लुप्त पद/i.test(combined) || /^\s*(?:\d+[\s,]+){3,}\?/m.test(combined)) mathType = 'number_series';
  else if (/number system|\bHCF\b|\bLCM\b|divisibility|remainder|prime number|संख्या पद्धति|म\.स\.|ल\.स\.|विभाज्य/i.test(combined)) mathType = 'number_system';
  else if (/percentage|profit|loss|simple interest|compound interest|SI and CI|ratio|proportion|average|ages\b|partnership|प्रतिशत|लाभ|हानि|अनुपात|औसत|आयु\b|\\%|%|p\.a\./i.test(combined)) mathType = 'arithmetic';
  else if (/simplification|BODMAS|surds|indices|square root|cube root|सरलीकरण|वर्गमूल|घातांक|\\sqrt|\\frac/i.test(combined) || /\d+\s*[\*\+\-\/]\s*\d+\s*[\*\+\-\/]\s*\d+/.test(combined)) mathType = 'simplification';
  else if (hasFormula || detectedChemTopic) {
    mathType = 'chemistry';
  } else if (detectedPhysTopic) {
    mathType = 'physics';
  } else if (hasLatexDelim || hasLatexCmd || hasUnicodeMath || hasMathExpr || hasUnits || mathKeywords.test(combined)) {
    mathType = 'arithmetic';
  }

  if (!mathType) return { hasMath: false };

  return { 
    hasMath: true, 
    mathType, 
    physicsTopic: mathType === 'physics' ? detectedPhysTopic : undefined, 
    chemTopic: mathType === 'chemistry' ? (detectedChemTopic || 'important_compounds') : undefined, 
    hasUnits, 
    hasFormula, 
    isNegative 
  };
}


export function detectType(
  stem: string,
  cleanOpts: string[],
  matchTable: any,
  has2PlusStatements: boolean
): string {
  const isMatchList = /सूची-?\s*I[\s\S]*सूची-?\s*II|List-?\s*I[\s\S]*List-?\s*II|Match\s+List|Match\s+the\s+following/i.test(stem);
  const hasMatchStructure = Boolean(matchTable && matchTable.rows && matchTable.rows.length > 0 && isMatchList) ||
    /सुमेलित\s*कीजिए|स्तम्भ\s*[A-Z1-2]|खण्ड\s*[A-Z1-2]|Match\s+the\s+following/i.test(stem) ||
    cleanOpts.some(o => /[A-Da-d1-4][\-–][1-4A-Da-dक-घ]/.test(o) || /\([a-d]\)\s*[-–]\s*\([i|v|x]+\)/i.test(o));

  const hasAssertion = /(?:Assertion\s*\(?A\)?|अभिकथन|कथन\s*\(?A\)?|\(A\))/i.test(stem) &&
    /(?:Reason\s*\(?R\)?|कारण|स्पष्टीकरण|कथन\s*\(?R\)?|\(R\))/i.test(stem);

  const hasStatements = has2PlusStatements || (
    /^\s*\(?(a|b|c|d|i|ii|1|2|I|II)\)/im.test(stem) ||
    /^\s*(?:कथन\s*)?\(?[I123]\)?[.:]/im.test(stem) ||
    /कथन\s*\(?[I1]/i.test(stem) ||
    /कथन सही हैं|उपर्युक्त कथनों|statements? given above/i.test(stem) ||
    cleanOpts.some(o => /(?:(?:only|केवल|both|दोनों)\s*(?:I{1,3}|IV|VI{0,3}|[1-4]|कथन|statement))|(?:(?:I{1,3}|IV|VI{0,3}|[1-4])\s*(?:and|तथा|और)\s*(?:I{1,3}|IV|VI{0,3}|[1-4]))/i.test(o))
  );

  const hasFillBlank = /_{3,}|\.{4,}/.test(stem);
  const strippedOpts = cleanOpts.map(o => o.replace(/^(?:[A-Da-d1-4कखगघअबतथ]\.?|\([A-Da-d1-4कखगघअबतथ]\))\s*/, '').trim());
  const isTrueFalse = cleanOpts.length === 2 && strippedOpts.some(o => /^(सत्य|असत्य|true|false|सही|गलत)$/i.test(o));
  const hasPassage = /(?:^|[\s\n])(?:गद्यांश|पद्यांश|passage|directions?|निर्देश)(?:\s*[:\-–\n]|$)/i.test(stem);
  const hasImageRef = /\[image.*?\]|\[चित्र.*?\]|\[diagram.*?\]/i.test(stem);

  const lines = stem.split('\n').map(l => l.trim()).filter(Boolean);
  const hasFullHindiLine = lines.some(l => /^[\u0900-\u097F\s\d.,!?"'()\-:;]+$/.test(l) && /[\u0900-\u097F]{5,}/.test(l));
  const hasFullEnglishLine = lines.some(l => /^[a-zA-Z\s\d.,!?"'()\-:;]+$/.test(l) && /[a-zA-Z]{5,}/.test(l) && l.replace(/[^a-zA-Z]/g, '').length > 5);

  const hasHindiChars = /[\u0900-\u097F]{3,}/.test(stem);
  const hasEnglishChars = /[a-zA-Z]{3,}/.test(stem);
  const hasSlashSep = stem.includes('/') || cleanOpts.some(o => o.includes('/'));

  const isBilingual = (
    ((hasFullHindiLine && hasFullEnglishLine) || (hasHindiChars && hasEnglishChars && hasSlashSep) || /[\u0900-\u097F]{5,}[\s\S]*\/[\s\S]*[a-zA-Z]{5,}/.test(stem)) && 
    !/^\s*\([A-Z][a-z]?\d*\)\s*$/m.test(stem) && 
    !/^\s*\(.*[0-9].*\)\s*$/m.test(stem)
  );

  if (hasMatchStructure || isMatchList) return 'match_following';
  if (hasAssertion) return 'assertion_reason';
  if (hasStatements) return 'statement_based';
  if (hasFillBlank) return 'fill_blank';
  if (isTrueFalse) return 'true_false';
  if (hasPassage) return 'passage_based';
  if (hasImageRef) return 'image_reference';
  if (isBilingual) return 'bilingual';
  return 'simple';
}



// ─────────────────────────────────────────────────────────────
// 7. MAIN PRODUCTION-GRADE PARSER
// ─────────────────────────────────────────────────────────────

export function parseRawMcqText(
  raw: string,
  chapterId: string = "general",
  topicId: string = "general"
): ParseMcqResult {
  if (!raw || !raw.trim()) {
    return { questions: [], errors: [] };
  }

  const { body, key } = extractAnswerKey(normalize(raw));
  const blocks = splitBlocks(body);
  const questions: ParsedQuestionItem[] = [];
  const errors: ParseErrorItem[] = [];

  blocks.forEach((b, n) => {
    const rawBlockLines = b.map(l => l.trim()).filter(Boolean);
    if (rawBlockLines.length === 0) return;

    // Separate question content lines from metadata lines (Subject:, Chapter:, Topic:, Exam:, Year:)
    const blockExams: ExamHistoryEntry[] = [];
    let pendingExam: string | null = null;
    let blockSubject: string | undefined;
    let blockChapter: string | undefined;
    let blockTopic: string | undefined;

    const lines: string[] = [];

    for (const l of rawBlockLines) {
      if (/^SUBJECT\s*[:.\-–]/i.test(l)) {
        blockSubject = l.replace(/^SUBJECT\s*[:.\-–]\s*/i, '').trim();
      } else if (/^CHAPTER\s*[:.\-–]/i.test(l)) {
        blockChapter = l.replace(/^CHAPTER\s*[:.\-–]\s*/i, '').trim();
      } else if (/^TOPIC\s*[:.\-–]/i.test(l)) {
        blockTopic = l.replace(/^TOPIC\s*[:.\-–]\s*/i, '').trim();
      } else if (/^(?:EXAM|EXAMINATION|PAPER|परीक्षा|प्रतियोगी\s*परीक्षा)\s*[:.\-–]/i.test(l)) {
        if (pendingExam) {
          blockExams.push({ examName: pendingExam, verified: true });
        }
        const val = l.replace(/^(?:EXAM|EXAMINATION|PAPER|परीक्षा|प्रतियोगी\s*परीक्षा)\s*[:.\-–]\s*/i, '').trim();
        const single = parseSingleExamString(val);
        if (single && single.year) {
          blockExams.push(single);
          pendingExam = null;
        } else {
          pendingExam = cleanExamName(val);
        }
      } else if (/^(?:YEAR|EXAM_YEAR|SESSION|वर्ष|सत्र)\s*[:.\-–]/i.test(l)) {
        const val = l.replace(/^(?:YEAR|EXAM_YEAR|SESSION|वर्ष|सत्र)\s*[:.\-–]\s*/i, '').trim();
        const yr = toAsciiYear(val);
        const yrNum = /^\d{4}$/.test(yr) ? parseInt(yr, 10) : yr;
        if (pendingExam) {
          blockExams.push({ examName: pendingExam, year: yrNum, verified: true });
          pendingExam = null;
        } else if (blockExams.length > 0 && !blockExams[blockExams.length - 1].year) {
          blockExams[blockExams.length - 1].year = yrNum;
        }
      } else {
        lines.push(l);
      }
    }
    if (pendingExam) {
      blockExams.push({ examName: pendingExam, verified: true });
    }

    if (lines.length === 0) return;

    const qNo = +(lines[0].match(/(\d+)/)?.[1] ?? n + 1);

    // Locate Answer line (can extend to next line if answer content is on next line)
    let ansIdx = lines.findIndex(l => /^(answer|ans|correct|उत्तर|सही\s*उत्तर|right\s*option)\s*[:\-–]?/i.test(l));
    const hasAns = ansIdx >= 0;
    const expIdx = lines.findIndex(l => /^(explanation|exp|solution|व्याख्या|स्पष्टीकरण)\s*[:\-–]/i.test(l));

    let ansText = hasAns ? lines[ansIdx] : '';
    if (hasAns && ansIdx + 1 < lines.length && expIdx !== ansIdx + 1) {
      const strippedCur = ansText.replace(/^(answer|ans|correct|उत्तर|सही\s*उत्तर|right\s*option)\s*[:\-–]?/i, '').trim();
      if (strippedCur.length === 0 || strippedCur === ':') {
        ansText += ' ' + lines[ansIdx + 1];
      }
    }

    const optEnd = hasAns ? ansIdx - 1 : lines.length - 1;

    // Locate Explanation line (typically after Answer)
    let explanation = '';
    if (expIdx >= 0) {
      const expLines: string[] = [];
      for (let i = expIdx; i < lines.length; i++) {
        const l = lines[i];
        if (i > expIdx && /^\s*(?:Q\.?|प्रश्न|Question|Que\.?)\s*\(?\d+[.):]?/i.test(l)) {
          break;
        }
        expLines.push(l);
      }
      explanation = expLines.join(' ').replace(/^(?:explanation|exp|solution|व्याख्या|स्पष्टीकरण)\s*[:\-–]\s*/i, '').trim();
      explanation = explanation
        .replace(/\s*Questions?\s*Generated\s*:\s*\d+[^\n]*/gi, '')
        .replace(/\s*Progress\s*:[^\n]*/gi, '')
        .replace(/\s*Type\s+NEXT[^\n]*/gi, '')
        .replace(/\s*\bPAGE\s*\d+\s*(?:COMPLETED|DONE|END)\b[^\n]*/gi, '')
        .replace(/(?:^|[\s।\n])(?:PAGE|पृष्ठ)\s*\d+\s*(?:COMPLETED|DONE|END|समाप्त)[^\n]*/gi, '')
        .replace(/^\s*(?:PAGE|पृष्ठ)\s*\d+\s*$/gim, '')
        .trim();
    }
    const end = expIdx >= 0 && expIdx - 1 < optEnd ? expIdx - 1 : optEnd;

    // Extract options from the bottom upward
    let res = extractOptions(lines, end);

    // Check if this is Assertion-Reason with auto-options fallback
    const combinedInitialText = lines.slice(0, end + 1).join('\n');
    const isAssertionReason = /(?:Assertion\s*\(?A\)?|अभिकथन|कथन\s*\(?A\)?|\(A\))/i.test(combinedInitialText) &&
                              /(?:Reason\s*\(?R\)?|कारण|स्पष्टीकरण|कथन\s*\(?R\)?|\(R\))/i.test(combinedInitialText);

    if (!res && isAssertionReason) {
      const isHindi = /[\u0900-\u097F]/.test(combinedInitialText);
      const autoOpts = isHindi ? [
        "(A) और (R) दोनों सही हैं और (R), (A) की सही व्याख्या है।",
        "(A) और (R) दोनों सही हैं लेकिन (R), (A) की सही व्याख्या नहीं है।",
        "(A) सही है लेकिन (R) गलत है।",
        "(A) गलत है लेकिन (R) सही है।"
      ] : [
        "Both Assertion (A) and Reason (R) are true and Reason (R) is the correct explanation of Assertion (A)",
        "Both Assertion (A) and Reason (R) are true but Reason (R) is not the correct explanation of Assertion (A)",
        "Assertion (A) is true but Reason (R) is false",
        "Assertion (A) is false but Reason (R) is true"
      ];
      res = {
        opts: autoOpts,
        stemEnd: end,
        family: FAMILIES_4[0],
        hintIndex: -1,
        stemTail: ''
      };
    }

    if (!res) {
      const fallbackStem = lines
        .slice(0, end + 1)
        .join('\n')
        .replace(/^\s*(?:Q\.?|प्रश्न|Question)?\s*\(?\d+[.):]?\s*/i, '')
        .trim();
      errors.push({
        blockNo: qNo,
        reason: 'Options nahi mile',
        rawText: lines.join('\n')
      });
      if (fallbackStem.length > 0) {
        const timestamp = Date.now();
        questions.push({
          id: `parsed-q-${timestamp}-${qNo}-${Math.random().toString(36).substring(2, 6)}`,
          tempId: `draft-text-${timestamp}-${qNo}-${Math.random().toString(36).substring(2, 8)}`,
          type: 'single_correct',
          questionType: 'single_correct',
          question: fallbackStem,
          text: fallbackStem,
          options: [],
          correctIndex: -1,
          answer: '',
          explanation,
          confidence: 0.25,
          isValid: false,
          errors: ['Options missing (at least 2 options required)'],
          difficulty: 'medium',
          createdAt: new Date().toISOString(),
          chapterId,
          topicId,
          isUserAdded: true,
          rawInput: lines.join('\n'),
          needsReview: true,
          reviewReason: 'Options missing (at least 2 options required)'
        });
      }
      return;
    }

    let stem = lines.slice(0, res.stemEnd + 1).join('\n')
      .replace(/^\s*(?:Q\.?|प्रश्न|Question|Que\.?)\s*(?:\(?\d+[.):]?|[:\-–])\s*/i, '') + (res.stemTail ?? '');
    stem = stem.trim();

    // Extract statements and ask line from stem
    const { cleanStem, askLine: askLineFromHelper } = extractAskLine(stem);
    const extractedStatements = extractStatements(cleanStem);
    let finalAskLine = askLineFromHelper || (extractedStatements as any)?.askLine;
    let finalCleanStem = (extractedStatements as any)?.cleanStem || (
      askLineFromHelper ? cleanStem : (
        finalAskLine && stem.lastIndexOf(finalAskLine) > 0 ? stem.substring(0, stem.lastIndexOf(finalAskLine)).trim() : cleanStem
      )
    );
    finalCleanStem = finalCleanStem.trim();

    const has2PlusStatements = Array.isArray(extractedStatements) && extractedStatements.length >= 2;

    // Extract matchTable from stem if pipe-table exists
    const matchTable = extractMatchTable(stem);
    if (matchTable?.cleanStem) {
      finalCleanStem = matchTable.cleanStem;
    }

    // Answer priority: Answer line > answer key > ✓/bold hint
    let ci = hasAns ? parseAnswer(ansText, res.opts) : -1;
    if (ci < 0 && key[qNo]) {
      const all = 'ABCD' + 'abcd' + '1234' + 'कखगघ' + 'अबसद';
      const idx = all.indexOf(key[qNo]) % 4;
      if (idx >= 0) ci = idx;
    }
    if (ci < 0 && res.hintIndex !== undefined && res.hintIndex >= 0) {
      ci = res.hintIndex;
    }
    if (ci < 0) {
      ci = res.opts.findIndex(o => /✓|✔|\*\*/.test(o));
    }

    const cleanOpts = res.opts.map(o => o.replace(/[*✓✔]/g, '').trim());

    const assertionReason = extractAssertionReason(stem);
    if (assertionReason) {
      if (assertionReason.cleanStem) finalCleanStem = assertionReason.cleanStem;
      if (assertionReason.askLine) finalAskLine = assertionReason.askLine;
    }

    const baseType = detectType(stem, cleanOpts, matchTable, has2PlusStatements);
    const type = assertionReason ? 'assertion_reason' : (matchTable ? 'match_following' : baseType);

    const checks = [
      stem.length > 5,
      cleanOpts.every(Boolean),
      ci >= 0,
      new Set(cleanOpts).size === cleanOpts.length
    ];
    const confidence = parseFloat((checks.filter(Boolean).length / checks.length).toFixed(2));

    const blockErrors: string[] = [];
    if (!stem) blockErrors.push("Question text is empty");
    if (cleanOpts.length < 2) blockErrors.push("Fewer than 2 options found");
    if (ci < 0) {
      blockErrors.push("Correct answer is missing");
      errors.push({ blockNo: qNo, reason: 'Answer nahi mila', rawText: lines.join('\n') });
    }

    const isValid = blockErrors.length === 0;
    const timestamp = Date.now();
    const ansLetter = ci >= 0 ? ["A", "B", "C", "D", "E"][ci] || "" : "";

    const questionItem: ParsedQuestionItem = {
      id: `parsed-q-${timestamp}-${qNo}-${Math.random().toString(36).substring(2, 6)}`,
      tempId: `draft-text-${timestamp}-${qNo}-${Math.random().toString(36).substring(2, 8)}`,
      type,
      questionType: type,
      assertion: assertionReason?.assertion,
      reason: assertionReason?.reason,
      question: finalCleanStem,
      text: finalCleanStem,
      statements: extractedStatements,
      askLine: finalAskLine,
      instruction: finalAskLine,
      matchTable,
      matchData: matchTable ? { listI: matchTable.rows.map(r => r.left), listII: matchTable.rows.map(r => r.right) } : undefined,
      options: cleanOpts.length === 2 ? [cleanOpts[0], cleanOpts[1]] : [cleanOpts[0] || "", cleanOpts[1] || "", cleanOpts[2] || "", cleanOpts[3] || ""],
      correctIndex: ci >= 0 ? ci : -1,
      answer: ansLetter,
      explanation,
      examHistory: normalizeExamHistory(
        blockExams.length > 0
          ? blockExams
          : (blocks.meta?.exam ? [{ examName: blocks.meta.exam, year: blocks.meta.year, verified: true }] : [])
      ),
      questionClassification: (blockExams.length > 0 || blocks.meta?.exam) ? "pyq" : "practice",
      isPYQ: (blockExams.length > 0 || Boolean(blocks.meta?.exam)),
      meta: (() => {
        const mathMeta = detectMathMeta(finalCleanStem, cleanOpts, explanation, matchTable);
        const resolvedHistory = normalizeExamHistory(
          blockExams.length > 0
            ? blockExams
            : (blocks.meta?.exam ? [{ examName: blocks.meta.exam, year: blocks.meta.year, verified: true }] : [])
        );
        return {
          ...(blocks.meta || {}),
          ...(blockSubject ? { subject: blockSubject } : {}),
          ...(blockChapter ? { chapter: blockChapter } : {}),
          ...(blockTopic ? { topic: blockTopic } : {}),
          ...(resolvedHistory.length > 0 ? { exam: resolvedHistory[0].examName, year: String(resolvedHistory[0].year || '') } : {}),
          examHistory: resolvedHistory,
          hasMath: mathMeta.hasMath,
          ...(mathMeta.mathType ? { mathType: mathMeta.mathType } : {}),
          ...(mathMeta.physicsTopic ? { physicsTopic: mathMeta.physicsTopic } : {}),
          ...(mathMeta.chemTopic ? { chemTopic: mathMeta.chemTopic } : {}),
          ...(mathMeta.hasUnits !== undefined ? { hasUnits: mathMeta.hasUnits } : {}),
          ...(mathMeta.hasFormula !== undefined ? { hasFormula: mathMeta.hasFormula } : {}),
          ...(mathMeta.isNegative !== undefined ? { isNegative: mathMeta.isNegative } : {})
        };
      })(),
      confidence,
      isValid,
      errors: blockErrors,
      difficulty: "medium",
      createdAt: new Date().toISOString(),
      chapterId,
      topicId,
      isUserAdded: true,
      rawInput: lines.join('\n'),
      needsReview: !isValid || confidence < 0.75
    };

    questions.push(questionItem);
  });

  return { questions, errors };
}
