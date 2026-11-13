import { ParsedQuestionDraft, Question } from "../types";
import { sanitizeSvgContent } from "./svgSanitizer";

/**
 * Helper to extract structured content like Match-the-Following, statements, or Assertion-Reason.
 */
export function extractStructuredContent(text: string): { 
  listI?: string[]; 
  listII?: string[]; 
  statements?: string[];
  assertion?: string;
  reason?: string;
} {
  const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
  const listI: string[] = [];
  const listII: string[] = [];
  const statements: string[] = [];
  let assertion: string | undefined = undefined;
  let reason: string | undefined = undefined;
  
  let currentList: "I" | "II" | "S" | null = null;
  
  for (const line of lines) {
    // Check for Assertion (A) / अभिकथन (A) and Reason (R) / कारण (R)
    const assertMatch = line.match(/^(?:अभिकथन|Assertion|कथन\s*\(?A\)?|Assertion\s*\(?A\)?|\(A\)[\:\-])[\:\-\s]*(.*)$/i);
    if (assertMatch) {
      assertion = assertMatch[1].trim();
      continue;
    }
    const reasonMatch = line.match(/^(?:कारण|Reason|कारण\s*\(?R\)?|Reason\s*\(?R\)?|\(R\)[\:\-])[\:\-\s]*(.*)$/i);
    if (reasonMatch) {
      reason = reasonMatch[1].trim();
      continue;
    }

    const lower = line.toLowerCase();
    const bothMatch = (lower.includes("list-i") && lower.includes("list-ii")) || (lower.includes("सूची-i") && lower.includes("सूची-ii"));
    
    if (bothMatch) {
      currentList = "I";
    } else if (lower.includes("सूची-i") || lower.includes("list-i")) {
      currentList = "I";
      continue;
    } else if (lower.includes("सूची-ii") || lower.includes("list-ii")) {
      currentList = "II";
      continue;
    }
    
    if (lower.includes("कथनों पर विचार") || lower.includes("consider the following statements") || lower.includes("कथन 1") || lower.includes("statement 1")) {
      currentList = "S";
    }

    const statementPrefixMatch = line.match(/^(?:कथन|Statement)\s*\(?(\d+|[IVX]+)\)?[\.\)\-\:\s]\s*(.*)$/i);
    if (statementPrefixMatch) {
      currentList = "S";
      statements.push(statementPrefixMatch[2].trim());
      continue;
    }

    const numMatch = line.match(/^(\d+|[IVX]+)[\.\)\-\:\s]\s*(.*)$/i);
    if (numMatch) {
      const label = numMatch[1].toUpperCase();
      const content = numMatch[2].trim();
      
      const isRoman = /^[IVX]+$/.test(label);
      const isLetter = /^[A-Z]$/.test(label);
      if (currentList === "I" && listI.length > 0 && (isRoman || isLetter)) {
        currentList = "II";
      }

      if (currentList === "I") {
        listI.push(content);
      } else if (currentList === "II") {
        listII.push(content);
      } else if (currentList === "S") {
        statements.push(content);
      } else if (currentList === null && statements.length > 0) {
        statements.push(content);
      } else if (currentList === null) {
        currentList = "I";
        listI.push(content);
      }
    } else {
      const letterMatch = line.match(/^([A-Fa-f])[\.\)\-\:\s]\s*(.*)$/);
      const isPrompt = /^(Which|Choose|Select|Match|Identify|उपर्युक्त|ऊपर|नीचे|सही|कथनों)/i.test(line.trim());

      if (letterMatch && currentList === "II") {
        listII.push(letterMatch[2].trim());
      } else if (isPrompt) {
        currentList = null;
      } else {
        if (currentList === "I" && listI.length > 0) {
          listI[listI.length - 1] += "\n" + line;
        } else if (currentList === "II" && listII.length > 0) {
          listII[listII.length - 1] += "\n" + line;
        } else if (currentList === "S" && statements.length > 0) {
          statements[statements.length - 1] += "\n" + line;
        }
      }
    }
  }

  return {
    listI: listI.length > 0 ? listI : undefined,
    listII: listII.length > 0 ? listII : undefined,
    statements: statements.length > 0 ? statements : undefined,
    assertion,
    reason
  };
}

// ─────────────────────────────────────────────────────────────
// MATHEMATICAL & CHEMICAL FORMULA FORMATTER
// Converts LaTeX, chemistry notation, and equation markup into clean Unicode
// E.g. \text{Fe} + \text{CuSO}_{4} \rightarrow \text{FeSO}_{4} + \text{Cu} -> Fe + CuSO₄ → FeSO₄ + Cu
// ─────────────────────────────────────────────────────────────

export function formatMathAndChemistryLatex(text: string | null | undefined): string {
  if (!text) return "";
  let s = String(text);

  // Preserve math blocks ($...$, $$...$$, \(...\), \[...\\]) so KaTeX renders LaTeX commands cleanly
  // Use ##MBKN## to avoid collision with subscript _digit replacement logic
  const mathBlocks: string[] = [];
  s = s.replace(/(\$\$[\s\S]+?\$\$|\\\[[\s\S]+?\\\]|\\\([\s\S]+?\\\)|\$[^$\n]+?\$)/g, (match) => {
    mathBlocks.push(match);
    return `##MBK${mathBlocks.length - 1}##`;
  });

  // 0. Normalize escaped backslashes (e.g. \\text -> \text, \\times -> \times)
  s = s.replace(/\\{2,}([a-zA-Z\{\}\[\]\^\_\+\-\*\/\(\)\:\;\,\.\<\>\=])/g, "\\$1");

  // 1. Reaction arrows and directions
  s = s.replace(/\\xrightarrow\s*(?:\[[^\]]*\])?\s*\{([^\}]*)\}/g, (_, over) => {
    return over.trim() ? `—(${over})→` : "→";
  });
  s = s.replace(/\\(?:longrightarrow|rightarrow|to)\b/g, "→");
  s = s.replace(/\\(?:longleftarrow|leftarrow)\b/g, "←");
  s = s.replace(/\\(?:rightleftharpoons|leftrightarrow)\b/g, "⇌");
  s = s.replace(/\\uparrow\b/g, "↑");
  s = s.replace(/\\downarrow\b/g, "↓");

  // 2. Mathematical operators & relations (outside math blocks)
  s = s.replace(/\\times\b/g, "×");
  s = s.replace(/\\div\b/g, "÷");
  s = s.replace(/\\pm\b/g, "±");
  s = s.replace(/\\mp\b/g, "∓");
  s = s.replace(/\\(?:leq|le)\b/g, "≤");
  s = s.replace(/\\(?:geq|ge)\b/g, "≥");
  s = s.replace(/\\(?:neq|ne)\b/g, "≠");
  s = s.replace(/\\approx\b/g, "≈");
  s = s.replace(/\\equiv\b/g, "≡");
  s = s.replace(/\\infty\b/g, "∞");
  s = s.replace(/\\cdot\b/g, "·");
  s = s.replace(/\\degree\b|\^\\circ\b/g, "°");

  // 3. Greek letters
  s = s.replace(/\\Delta\b/g, "Δ");
  s = s.replace(/\\alpha\b/g, "α");
  s = s.replace(/\\beta\b/g, "β");
  s = s.replace(/\\gamma\b/g, "γ");
  s = s.replace(/\\theta\b/g, "θ");
  s = s.replace(/\\lambda\b/g, "λ");
  s = s.replace(/\\mu\b/g, "μ");
  s = s.replace(/\\pi\b/g, "π");
  s = s.replace(/\\sigma\b/g, "σ");
  s = s.replace(/\\omega\b/g, "ω");
  s = s.replace(/\\Omega\b/g, "Ω");

  // 4. Fractions & Roots
  s = s.replace(/\\frac\s*\{([^\}]+)\}\s*\{([^\}]+)\}/g, "($1)/($2)");
  s = s.replace(/\\sqrt\s*\{([^\}]+)\}/g, "√($1)");

  // 5. Subscripts & Superscripts
  const subMap: Record<string, string> = {
    "0": "₀", "1": "₁", "2": "₂", "3": "₃", "4": "₄",
    "5": "₅", "6": "₆", "7": "₇", "8": "₈", "9": "₉",
    "+": "₊", "-": "₋", "=": "₌", "(": "₍", ")": "₎",
    "a": "ₐ", "e": "ₑ", "h": "ₕ", "i": "ᵢ", "j": "ⱼ",
    "k": "ₖ", "l": "ₗ", "m": "ₘ", "n": "ₙ", "o": "ₒ",
    "p": "ₚ", "r": "ᵣ", "s": "ₛ", "t": "ₜ", "u": "ᵤ",
    "v": "ᵥ", "x": "ₓ"
  };

  const supMap: Record<string, string> = {
    "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴",
    "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹",
    "+": "⁺", "-": "⁻", "=": "⁼", "(": "⁽", ")": "⁾",
    "n": "ⁿ", "i": "ⁱ"
  };

  s = s.replace(/_\{([0-9a-zA-Z\+\-\(\)]+)\}/g, (_, chars) => {
    if (chars === "(s)" || chars === "(l)" || chars === "(g)" || chars === "(aq)") return "(" + chars.slice(1, -1) + ")";
    return chars.split("").map((c: string) => subMap[c] || c).join("");
  });
  s = s.replace(/_([0-9])/g, (_, d) => subMap[d] || d);

  s = s.replace(/\^\{([0-9a-zA-Z\+\-\(\)]+)\}/g, (_, chars) => {
    return chars.split("").map((c: string) => supMap[c] || c).join("");
  });
  s = s.replace(/\^([0-9])/g, (_, d) => supMap[d] || d);

  // 6. Unwrap \text{...} or \mathrm{...} or \mathbf{...}
  s = s.replace(/\\(?:text|mathrm|mathbf|mathit)\s*\{([^\}]*)\}/g, "$1");

  // 7. Clean leftover LaTeX backslashes for spaces
  s = s.replace(/\\(?:quad|qquad|\,|\;|\:|\s)/g, " ");

  // 8. Standardize spaces around operators and arrows
  s = s.replace(/\s*([→←⇌])\s*/g, " $1 ");
  s = s.replace(/\s*([+])\s*/g, " + ");
  s = s.replace(/[ \t]{2,}/g, " ");

  // 9. Clean leftover orphaned backslashes
  s = s.replace(/\\([a-zA-Z0-9\+\-\=×÷→←⇌])/g, "$1");
  s = s.replace(/\\+\s+/g, " ");

  // Restore math blocks intact using split to prevent $1, $10 substitution issues
  s = s.split(/##MBK(\d+)##/g).map((part, i) => {
    if (i % 2 === 1) {
      return mathBlocks[+part];
    }
    return part;
  }).join('');

  return s.trim();
}

/**
 * Normalizes imported question content by removing internal parser/formatting markers.
 */
export function normalizeImportedContent(text: string | null | undefined): string {
  if (!text) return "";
  let cleaned = String(text);
  cleaned = cleaned.replace(/\[span_\w+\]\((?:start|end)_span\)/gi, "");
  cleaned = cleaned.replace(/\[span_\w+\]/gi, "");
  cleaned = cleaned.replace(/\((?:start|end)_span\)/gi, "");
  cleaned = formatMathAndChemistryLatex(cleaned);
  cleaned = cleaned.replace(/[ \t]{2,}/g, " ");
  cleaned = cleaned.replace(/[ \t]*\n[ \t]*/g, "\n");
  return cleaned.trim();
}

/**
 * Helper to clean paragraphs while preserving intentional multi-line structure.
 */
export function cleanParagraphs(text: string): string {
  if (!text) return "";
  const lines = text.split(/\r?\n/).map((l) => l.trim());
  const result: string[] = [];
  let prevEmpty = false;
  for (const line of lines) {
    if (line.length === 0) {
      if (!prevEmpty && result.length > 0) {
        result.push("");
        prevEmpty = true;
      }
    } else {
      result.push(line);
      prevEmpty = false;
    }
  }
  return result.join("\n").trim();
}

/**
 * Cleans and normalizes raw text from PDFs, Word documents, Telegram, or WhatsApp
 * to prepare it for seamless bulk MCQ parsing.
 */
export function cleanAndStandardizeBulkText(rawText: string): string {
  if (!rawText || !rawText.trim()) return "";
  let text = rawText;

  // Replace smart quotes and special dashes
  text = text.replace(/[\u201C\u201D]/g, '"').replace(/[\u2018\u2019]/g, "'");
  text = text.replace(/[\u2013\u2014]/g, "-");

  // Normalize chemical reactions and LaTeX formulas first
  text = formatMathAndChemistryLatex(text);

  // Fix merged inline options on a single line (e.g. "A. केवल 1 B. केवल 2 C. 1 और 2 D. कोई नहीं")
  // Uses replacer to avoid splitting Answer lines or table rows
  text = text.replace(/([^\n])[ \t]+(?:\(?|\[?)(?:Option\s+|Opt\s+|विकल्प\s+)?([B-D])(?:\.|\)|\]|\:)[ \t]*/g, (match, prevChar, letter, offset, full) => {
    const lineStart = full.lastIndexOf("\n", offset - 1);
    const lineEnd = full.indexOf("\n", offset);
    const fullLine = full.slice(lineStart === -1 ? 0 : lineStart + 1, lineEnd === -1 ? full.length : lineEnd);
    if (fullLine.includes("|") || /\t/.test(fullLine)) {
      return match;
    }
    const lineSoFar = full.slice(Math.max(0, lineStart), offset);
    if (/^(?:.*?\b(?:(?:Correct\s*)?Answer|Right\s*Option|उत्तर(?:माला|म्)?|सही\s*उत्तर|Ans(?:wer)?|Key|wer))\b/i.test(lineSoFar.trim())) {
      return match;
    }
    return `${prevChar}\n${letter}. `;
  });

  // Fix option lines without dots on individual lines (e.g., "A केवल 1" -> "A. केवल 1")
  // Supports English A-D, Hindi क-घ, and digits 1-4
  text = text.replace(/(?:^|\n)\s*([A-Da-dक-घ1-4])\s+(?=[^\n]+)/g, (match, letter, offset, full) => {
    // Avoid modifying Assertion or Reason lines
    const lineStart = full.lastIndexOf("\n", offset - 1);
    const prev = full.slice(Math.max(0, lineStart), offset);
    if (/अभिकथन|Assertion|कारण|Reason|कथन/i.test(prev)) {
      return match;
    }
    // Avoid modifying table rows (lines containing pipes or tabs)
    const nextLineEnd = full.indexOf("\n", offset + 1);
    const lineRest = full.slice(offset, nextLineEnd === -1 ? full.length : nextLineEnd);
    if (lineRest.includes("|") || /\t/.test(lineRest)) {
      return match;
    }
    // Avoid modifying chemical/math equations where letter is a reactant or variable (e.g. "A + B -> C" or "A → B")
    const afterMatch = lineRest.replace(/^\s*[A-Da-dक-घ1-4]\s+/, "");
    if (/^[\+\-\=\→\←\⇌\>\<]/.test(afterMatch) || /^(?:->|-->|=>)/.test(afterMatch)) {
      return match;
    }
    const prefix = match.startsWith("\n") ? "\n" : "";
    return `${prefix}${letter}. `;
  });

  // Standardize inline "Answer: " and "Explanation: "
  // Put longer matches first and use \b so "Ans" never matches "Answer" and turns it into "wer"
  text = text.replace(/(?:^|\s+)(?:Correct\s+Answer|Right\s+Option|उत्तरमाला|उत्तरम्|सही\s*उत्तर|Answer|उत्तर|Key|Ans)\b\s*[\:\-\=\)]*\s*/gi, "\nAnswer: ");
  text = text.replace(/(?:^|\s+)(?:Explanation|Solution|स्पष्टीकरण|व्याख्या|Exp)\b\s*[\:\-\=\)]*\s*/gi, "\nExplanation: ");

  // Standardize Question headers
  text = text.replace(/(?:^|\n)\s*(?:Q(?:uestion)?|प्रश्न|प्र)[\.\:\-\s]*(\d+)[\.\:\-\)]?\s*/gi, "\nQ$1. ");

  return text.trim();
}

/**
 * Strips single option prefix (e.g. "A. ", "A) ", "(A) ", "Option A: ")
 * while preserving internal references like "(A) और (R) दोनों सही हैं".
 */
export function stripOptPrefix(str: string): string {
  if (!str) return "";
  const trimmed = str.trim();
  // Preserve internal (A) references e.g. "(A) और (R) दोनों सही हैं" or "(A) is true but (R) is false"
  if (/^\([Aa]\)\s*(?:और|तथा|एवं|and|is|both|सही|गलत|true|false|&|\,|\/)/i.test(trimmed)) {
    return trimmed;
  }
  return trimmed.replace(/^(?:Option\s+|Opt\s+|विकल्प\s+)?(?:[A-Da-dक-घ1-4][\.\)\:\-]\s*|\([A-Da-dक-घ1-4]\)\s*|\b[A-Da-d1-4]\b\s+|[क-घ]\s+)/i, "").trim();
}

// Option Line Helpers (Anchored strictly to line start)
export function isOptionALine(str: string, allowDigits = false): boolean {
  const trimmed = str.trim();
  if (/^(?:(?:Q\d+[\.\:\-\s]*)?(?:अभिकथन|Assertion|कथन)\s*\(?A\)?|\(A\)[\:\-])/i.test(trimmed)) {
    return false;
  }
  // Table row check: if line contains pipe '|' or tabs with multiple cells, it is NEVER an option!
  if (trimmed.includes("|") && trimmed.split("|").filter(c => c.trim().length > 0).length >= 2) {
    return false;
  }
  if (trimmed.includes("\t") && trimmed.split("\t").filter(c => c.trim().length > 0).length >= 2) {
    return false;
  }
  // Equation check: avoid matching chemical/math reactions where letter is a reactant or variable (e.g. "A + B -> C")
  if (/^[A-Da-dक-घ1-4]\s*[\+\-\=\→\←\⇌\>\<]/.test(trimmed) || /^[A-Da-dक-घ1-4]\s*(?:->|-->|=>)/.test(trimmed)) {
    return false;
  }
  if (allowDigits) {
    return /^(?:(?:\(?|\[?)(?:Option\s+|Opt\s+|विकल्प\s+)?(?:A|a|क|1)(?:\.|\)|\]|\:|\-)?(?:\s+|$))/i.test(trimmed);
  }
  return /^(?:(?:\(?|\[?)(?:Option\s+|Opt\s+|विकल्प\s+)?(?:A|a|क)(?:\.|\)|\]|\:|\-)?(?:\s+|$))/i.test(trimmed);
}
export function isOptionBLine(str: string, allowDigits = false): boolean {
  const trimmed = str.trim();
  if (trimmed.includes("|") && trimmed.split("|").filter(c => c.trim().length > 0).length >= 2) {
    return false;
  }
  if (trimmed.includes("\t") && trimmed.split("\t").filter(c => c.trim().length > 0).length >= 2) {
    return false;
  }
  if (/^[A-Da-dक-घ1-4]\s*[\+\-\=\→\←\⇌\>\<]/.test(trimmed) || /^[A-Da-dक-घ1-4]\s*(?:->|-->|=>)/.test(trimmed)) {
    return false;
  }
  if (allowDigits) {
    return /^(?:(?:\(?|\[?)(?:Option\s+|Opt\s+|विकल्प\s+)?(?:B|b|ख|2)(?:\.|\)|\]|\:|\-)?(?:\s+|$))/i.test(trimmed);
  }
  return /^(?:(?:\(?|\[?)(?:Option\s+|Opt\s+|विकल्प\s+)?(?:B|b|ख)(?:\.|\)|\]|\:|\-)?(?:\s+|$))/i.test(trimmed);
}
export function isOptionCLine(str: string, allowDigits = false): boolean {
  const trimmed = str.trim();
  if (trimmed.includes("|") && trimmed.split("|").filter(c => c.trim().length > 0).length >= 2) {
    return false;
  }
  if (trimmed.includes("\t") && trimmed.split("\t").filter(c => c.trim().length > 0).length >= 2) {
    return false;
  }
  if (/^[A-Da-dक-घ1-4]\s*[\+\-\=\→\←\⇌\>\<]/.test(trimmed) || /^[A-Da-dक-घ1-4]\s*(?:->|-->|=>)/.test(trimmed)) {
    return false;
  }
  if (allowDigits) {
    return /^(?:(?:\(?|\[?)(?:Option\s+|Opt\s+|विकल्प\s+)?(?:C|c|ग|3)(?:\.|\)|\]|\:|\-)?(?:\s+|$))/i.test(trimmed);
  }
  return /^(?:(?:\(?|\[?)(?:Option\s+|Opt\s+|विकल्प\s+)?(?:C|c|ग)(?:\.|\)|\]|\:|\-)?(?:\s+|$))/i.test(trimmed);
}
export function isOptionDLine(str: string, allowDigits = false): boolean {
  const trimmed = str.trim();
  if (trimmed.includes("|") && trimmed.split("|").filter(c => c.trim().length > 0).length >= 2) {
    return false;
  }
  if (trimmed.includes("\t") && trimmed.split("\t").filter(c => c.trim().length > 0).length >= 2) {
    return false;
  }
  if (/^[A-Da-dक-घ1-4]\s*[\+\-\=\→\←\⇌\>\<]/.test(trimmed) || /^[A-Da-dक-घ1-4]\s*(?:->|-->|=>)/.test(trimmed)) {
    return false;
  }
  if (allowDigits) {
    return /^(?:(?:\(?|\[?)(?:Option\s+|Opt\s+|विकल्प\s+)?(?:D|d|घ|4)(?:\.|\)|\]|\:|\-)?(?:\s+|$))/i.test(trimmed);
  }
  return /^(?:(?:\(?|\[?)(?:Option\s+|Opt\s+|विकल्प\s+)?(?:D|d|घ)(?:\.|\)|\]|\:|\-)?(?:\s+|$))/i.test(trimmed);
}

/**
 * RECOVERY ENGINE: Extracts options A, B, C, D from raw text or explanation
 * if standard backward-scanning missed them or if they were swallowed into explanation.
 */
export function recoverOptionsFromRawText(fullRawText: string): {
  options: [string, string, string, string] | null;
} {
  if (!fullRawText || !fullRawText.trim()) return { options: null };

  // Strip Assertion & Reason lines so (A) from Assertion is NEVER matched as Option A!
  let text = fullRawText;
  text = text.replace(/(?:^|\n)\s*(?:Q\d+[\.\:\-\s]*)?(?:अभिकथन|Assertion|कथन\s*\(?A\)?|Assertion\s*\(?A\)?|अभिकथन\s*\(?A\)?|\(A\)[\:\-])\s*[\:\-\)]?\s*.*?(?=(?:^|\n)\s*(?:कारण|Reason|Reason\s*\(?R\)?|कारण\s*\(?R\)?|\b[A-D][\.\)\s]|Answer|Ans|Explanation|\n\n)|$)/is, "\n");
  text = text.replace(/(?:^|\n)\s*(?:कारण|Reason|कारण\s*\(?R\)?|Reason\s*\(?R\)?|\(R\)[\:\-])\s*[\:\-\)]?\s*.*?(?=(?:^|\n)\s*(?:\b[A-D][\.\)\s]|Answer|Ans|Explanation|\n\n)|$)/is, "\n");

  const optARegex = /(?:^|\n|\s)(?:\(?|\[?)(?:Option\s+|Opt\s+|विकल्प\s+)?A(?:\.|\)|\]|\:|\-|\s+)\s*(.*?)(?=(?:^|\n|\s)(?:\(?|\[?)(?:Option\s+|Opt\s+|विकल्प\s+)?B(?:\.|\)|\]|\:|\-|\s+)|$)/is;
  const optBRegex = /(?:^|\n|\s)(?:\(?|\[?)(?:Option\s+|Opt\s+|विकल्प\s+)?B(?:\.|\)|\]|\:|\-|\s+)\s*(.*?)(?=(?:^|\n|\s)(?:\(?|\[?)(?:Option\s+|Opt\s+|विकल्प\s+)?C(?:\.|\)|\]|\:|\-|\s+)|$)/is;
  const optCRegex = /(?:^|\n|\s)(?:\(?|\[?)(?:Option\s+|Opt\s+|विकल्प\s+)?C(?:\.|\)|\]|\:|\-|\s+)\s*(.*?)(?=(?:^|\n|\s)(?:\(?|\[?)(?:Option\s+|Opt\s+|विकल्प\s+)?D(?:\.|\)|\]|\:|\-|\s+)|$)/is;
  const optDRegex = /(?:^|\n|\s)(?:\(?|\[?)(?:Option\s+|Opt\s+|विकल्प\s+)?D(?:\.|\)|\]|\:|\-|\s+)\s*(.*?)(?=(?:^|\n|\s)(?:Answer|Ans|Correct|Explanation|Exp|Solution|व्याख्या|स्पष्टीकरण|Fact|Q\d+|\d+\.|$))/is;

  const matchA = text.match(optARegex);
  const matchB = text.match(optBRegex);
  const matchC = text.match(optCRegex);
  const matchD = text.match(optDRegex);

  if (matchA && matchB && matchC && matchD) {
    const optA = stripOptPrefix(matchA[1]);
    const optB = stripOptPrefix(matchB[1]);
    const optC = stripOptPrefix(matchC[1]);
    const optD = stripOptPrefix(matchD[1]);

    if (optA && optB && optC && optD) {
      return {
        options: [optA, optB, optC, optD],
      };
    }
  }

  return { options: null };
}

// ─────────────────────────────────────────────────────────────
// STEP 1: SPLIT RAW INPUT INTO INDIVIDUAL QUESTION BLOCKS
// ─────────────────────────────────────────────────────────────

export function splitIntoQuestionBlocks(rawText: string): string[] {
  if (!rawText || !rawText.trim()) return [];

  // Normalize newlines
  const normalized = rawText.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = normalized.split("\n");

  // Check if text uses explicit question headers: Q1., Question 1, प्रश्न 1, etc.
  const hasExplicitQ = lines.some((l) =>
    /^(?:Q(?:uestion)?|प्रश्न|प्र)\s*[-.:]?\s*\d+[\.\:\-\)\s]/i.test(l.trim())
  );

  const blocks: string[] = [];
  let currentBlockLines: string[] = [];
  let currentBlockHasContentOrAnswer = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    let isStart = false;
    if (hasExplicitQ) {
      if (/^(?:Q(?:uestion)?|प्रश्न|प्र)\s*[-.:]?\s*\d+[\.\:\-\)\s]/i.test(trimmed)) {
        isStart = true;
      } else if (currentBlockHasContentOrAnswer) {
        const numMatch = trimmed.match(/^(\d+)[\.\)\:\-]\s+/);
        if (numMatch) {
          isStart = true;
        }
      }
    } else {
      // Numbered question start like "1. ", "2. ", "1) ", "2) "
      const numMatch = trimmed.match(/^(\d+)[\.\)\:\-]\s+/);
      if (numMatch) {
        if (blocks.length === 0 && currentBlockLines.length === 0) {
          isStart = true;
        } else if (currentBlockHasContentOrAnswer) {
          // If we already saw options or answer/explanation in current block, next number is question boundary
          isStart = true;
        }
      }
    }

    if (isStart && currentBlockLines.length > 0) {
      const blockStr = currentBlockLines.join("\n").trim();
      if (blockStr) {
        if (!hasExplicitQ || blocks.length > 0 || currentBlockHasContentOrAnswer) {
          blocks.push(blockStr);
        }
      }
      currentBlockLines = [];
      currentBlockHasContentOrAnswer = false;
    }

    currentBlockLines.push(line);

    const isEquation = /[→←⇌↑↓]|->|-->|=>|==>/.test(trimmed) || /^[A-Da-d]\s*[\+\-\=\→\←\⇌\>\<]/.test(trimmed);
    if (!isEquation) {
      if (
        /^(?:(?:\(?|\[?)(?:Option\s+|Opt\s+|विकल्प\s+)?(?:A|a|B|b|C|c|D|d|क|ख|ग|घ)[\.\)\:\-]?\s+)/i.test(trimmed) ||
        /^(?:(?:Correct\s*)?Answer|Right\s*Option|उत्तर(?:माला|म्)?|सही\s*उत्तर|Ans(?:wer)?|Key|wer)(?:\s*[\:\-\=]|\s+)/i.test(trimmed)
      ) {
        currentBlockHasContentOrAnswer = true;
      }
    }
  }

  if (currentBlockLines.length > 0) {
    const blockStr = currentBlockLines.join("\n").trim();
    if (blockStr) blocks.push(blockStr);
  }

  // Fallback: If no blocks detected, treat the entire input as 1 block
  if (blocks.length === 0 && rawText.trim()) {
    blocks.push(rawText.trim());
  }

  return blocks;
}

// ─────────────────────────────────────────────────────────────
// QUESTION INSTRUCTION / PROMPT DETECTION HELPER
// E.g., "सही कथन कौन-से हैं?", "4. सही कथन कौन-से हैं?", "उपरोक्त में से कौन-सा/से कथन सही है/हैं?",
// "Which of the statements given above is/are correct?", etc.
// ─────────────────────────────────────────────────────────────

export function isQuestionInstruction(line: string): boolean {
  if (!line || !line.trim()) return false;
  const clean = line
    .replace(/^(?:(?:Q(?:uestion)?|प्रश्न|प्र)?\s*[-.:]?\s*\d+[\.\:\-\)]?\s*)?/i, "")
    .replace(/^(?:(?:\*|\-|\•|\–|\—)\s*)?(?:(?:\d+|[IVX]+)[\.\)\:\-]|(?:\((\d+|[IVX]+)\)))\s*/i, "")
    .trim();

  if (!clean) return false;

  // Code / कूट headers
  if (/^(?:(?:सही\s*)?(?:कूट|कोड|Codes?)|नीचे\s*दिए\s*गए\s*कूट|उपर्युक्त\s*(?:का|के|से)?\s*सही\s*कूट)[\:\-\s]*$/i.test(clean)) {
    return true;
  }

  // Hindi question instruction patterns
  const hindiInstructionPatterns = [
    // सही/सत्य/असत्य/गलत कथन कौन-सा/से है/हैं?
    /(?:सही|सत्य|असत्य|गलत|सत्य\s*नहीं|सही\s*नहीं)\s*कथन\s*(?:का\s*चयन\s*(?:करें|कीजिए)|कौन[- ]*(?:सा|से|सी)\s*(?:है|हैं|\?))/i,
    // कौन-सा/से कथन सही/सत्य/असत्य/गलत है/हैं?
    /कौन[- ]*(?:सा|से|सी)\s*(?:कथन)?\s*(?:सही|सत्य|असत्य|गलत|सत्य\s*नहीं|सही\s*नहीं)\s*(?:है|हैं|\?)/i,
    // कौन-से कथन सही हैं? / कौन-सा कथन सही है?
    /कौन[- ]*(?:सा|से|सी)\s*कथन\s*(?:सही|सत्य|असत्य|गलत)\s*हैं?/i,
    // उपरोक्त / उपर्युक्त / उपयुक्त / निम्नलिखित में से कौन-सा/से कथन...
    /(?:उपर्युक्त|उपरोक्त|उपयुक्त|निम्नलिखित|इनमें)\s*(?:कथनों|कथन)?\s*(?:में\s*से)?\s*(?:भी\s*)?कौन[- ]*(?:सा|से|सी)/i,
    // उपर्युक्त कथनों में से कौन-सा/से सही है/हैं?
    /(?:उपर्युक्त|उपरोक्त|उपयुक्त|निम्नलिखित)\s*(?:कथनों|कथन)\s*(?:में\s*से)?\s*कौन/i,
    // सही उत्तर का चयन कीजिए / सही कूट चुनिए / सुमेलित कीजिए
    /(?:सही\s*उत्तर|सही\s*कूट|कूट|सुमेलित)\s*(?:का\s*चयन\s*(?:कीजिए|करें)|चुनें|बताइए|कीजिए|करें)/i,
    // नीचे दिए गए कूट का प्रयोग कर
    /(?:नीचे|ऊपर)\s*दिए\s*गए\s*कूट/i,
    // कथनों में से कौन-सा/से सही है/हैं?
    /कथनों\s*में\s*से\s*कौन[- ]*(?:सा|से|सी)/i,
  ];

  if (hindiInstructionPatterns.some((pattern) => pattern.test(clean))) {
    return true;
  }

  // English question instruction patterns
  const englishInstructionPatterns = [
    /which\s+(?:of\s+the\s+)?(?:following|above)?\s*statements?\s+is\s*[\/\(]?\s*are/i,
    /which\s+statement(?:\(s\)|s)?\s+is\s*[\/\(]?\s*are/i,
    /which\s+(?:of\s+the\s+)?(?:following|above)\s+is\s*[\/\(]?\s*are/i,
    /select\s+the\s+correct\s+(?:statement|statements|code|answer)/i,
    /choose\s+the\s+correct\s+(?:statement|statements|code|answer)/i,
    /which\s+of\s+the\s+above\s+is\s*[\/\(]?\s*are\s+(?:correct|true|false|incorrect)/i,
  ];

  if (englishInstructionPatterns.some((pattern) => pattern.test(clean))) {
    return true;
  }

  // General interrogative check: if the line contains "कौन-सा/से" or "Which" combined with statement/correct/true/false keywords
  if (
    (/(?:कौन[- ]*(?:सा|से|सी)|कथन\s*कौन|Which)/i.test(clean)) &&
    (/(?:सही|सत्य|असत्य|गलत|कथन|statements?|correct|true|false|incorrect)/i.test(clean)) &&
    (/(?:है|हैं|\?|is|are)/i.test(clean))
  ) {
    return true;
  }

  return false;
}

export function cleanInstructionText(line: string): string {
  if (!line) return "";
  let s = line.trim();
  // Strip leading numbering or bullet (e.g. "4. ", "(4) ", "- ")
  s = s.replace(/^(?:(?:Q(?:uestion)?|प्रश्न|प्र)?\s*[-.:]?\s*\d+[\.\:\-\)]?\s*)?/i, "");
  s = s.replace(/^(?:(?:\*|\-|\•|\–|\—)\s*)?(?:(?:\d+|[IVX]+)[\.\)\:\-]|(?:\((\d+|[IVX]+)\)))\s*/i, "");
  // Strip leading "कूट:" or "कोड:" or "Codes:" only when followed by delimiter
  s = s.replace(/^(?:(?:सही\s*)?(?:कूट|कोड|Codes?)\s*[\:\-])\s*/i, "");
  return s.trim();
}

// ─────────────────────────────────────────────────────────────
// STEP 2: DETECT QUESTION TYPE PER BLOCK
// Priority order:
// ─────────────────────────────────────────────────────────────
// TABLE / DATA EXTRACTION HELPER
// Preserves table headers and data rows without converting into sequence or statements
// ─────────────────────────────────────────────────────────────

export function extractTableDataFromBlock(lines: string[]): {
  hasTable: boolean;
  headers: string[];
  rows: string[][];
  tableRawLines: string[];
  nonTableLines: string[];
} {
  const isDividerLine = (l: string) => /^\|?[\s\:\-]+(?:\|[\s\:\-]+)+\|?$/.test(l.trim());
  const parseRowCells = (l: string) => {
    let t = l.trim();
    if (t.includes("|")) {
      if (t.startsWith("|")) t = t.substring(1);
      if (t.endsWith("|")) t = t.substring(0, t.length - 1);
      return t.split("|").map(c => c.trim());
    }
    if (t.includes("\t")) {
      return t.split("\t").map(c => c.trim());
    }
    return t.split(/\s{2,}/).map(c => c.trim());
  };

  const isEquationOrFormula = (l: string) => {
    return (
      /[→←⇌↑↓]|->|-->|=>|==>|\\rightarrow|\\to|\\leftarrow|\\rightleftharpoons/.test(l) ||
      /\\(?:text|frac|sqrt|times|cdot|div|pm|leq|geq|neq|approx|alpha|beta|gamma|Delta|degree)\b/.test(l) ||
      /\\text\{[^\}]+\}/.test(l) ||
      /_[0-9a-zA-Z\{]|\^[0-9a-zA-Z\{]/.test(l) ||
      /[A-Z][a-z]?[₀-₉0-9]*(?:\([A-Z][a-z]?[₀-₉0-9]*\))?\s*[\+\=]\s*[A-Z]/.test(l) ||
      /\b(?:[A-Z][a-z]?[₀-₉0-9]+)+\b/.test(l)
    );
  };

  const isPipeLine = (l: string) => {
    const trimmed = l.trim();
    if (!trimmed.includes("|")) return false;
    if (isDividerLine(trimmed)) return false;
    if (isEquationOrFormula(trimmed)) return false;
    const cells = parseRowCells(trimmed).filter(c => c.length > 0);
    return cells.length >= 2;
  };

  // 1. Try finding pipe-separated table
  let startIdx = -1;
  let endIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (isPipeLine(trimmed)) {
      if (startIdx === -1) startIdx = i;
      endIdx = i;
    } else if (isDividerLine(trimmed)) {
      if (startIdx !== -1) endIdx = i;
    } else {
      if (startIdx !== -1 && endIdx - startIdx >= 1) {
        break;
      } else {
        startIdx = -1;
        endIdx = -1;
      }
    }
  }

  if (startIdx !== -1 && endIdx - startIdx >= 1) {
    const candidateLines = lines.slice(startIdx, endIdx + 1);
    const nonDivider = candidateLines.filter(l => !isDividerLine(l.trim()) && l.trim().length > 0);
    if (nonDivider.length >= 2) {
      const rawHeaders = parseRowCells(nonDivider[0]);
      const headers = rawHeaders.map((h, i) => i === 0 ? h.replace(/^(?:(?:Q(?:uestion)?|प्रश्न|प्र)?\s*[-.:]?\s*\d+[\.\:\-\)]\s*)/i, "").trim() : h);
      const rows = nonDivider.slice(1).map(parseRowCells);
      if (headers.length >= 2 && rows.length >= 1 && rows.every(r => r.length >= 2)) {
        const tableRawLines = candidateLines;
        const nonTableLines = [...lines.slice(0, startIdx), ...lines.slice(endIdx + 1)].filter(l => Boolean(l && l.trim()));
        return {
          hasTable: true,
          headers,
          rows,
          tableRawLines,
          nonTableLines,
        };
      }
    }
  }

  // 2. Try finding tab-separated or aligned space-separated dataset
  const isTabOrSpaceDataLine = (l: string) => {
    const trimmed = l.trim();
    if (!trimmed) return false;
    if (isEquationOrFormula(trimmed)) return false;
    if (isOptionALine(trimmed) || isOptionBLine(trimmed) || isOptionCLine(trimmed) || isOptionDLine(trimmed)) return false;
    if (/^(?:Answer|उत्तर|Explanation|व्याख्या|Exp|Solution|स्पष्टीकरण)\b/i.test(trimmed)) return false;
    if (/^(?:Q\d+|प्रश्न\s*\d+|निम्नलिखित|उपर्युक्त|गद्यांश|Consider)/i.test(trimmed)) return false;
    const cells = parseRowCells(trimmed).filter(c => c.length > 0);
    return cells.length >= 2;
  };

  let tStart = -1;
  let tEnd = -1;
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (isTabOrSpaceDataLine(trimmed)) {
      if (tStart === -1) tStart = i;
      tEnd = i;
    } else {
      if (tStart !== -1 && tEnd - tStart >= 1) {
        break;
      } else {
        tStart = -1;
        tEnd = -1;
      }
    }
  }

  if (tStart !== -1 && tEnd - tStart >= 1) {
    const candidateLines = lines.slice(tStart, tEnd + 1);
    const nonDivider = candidateLines.filter(l => l.trim().length > 0);
    if (nonDivider.length >= 2) {
      const rawHeaders = parseRowCells(nonDivider[0]);
      const headers = rawHeaders.map((h, i) => i === 0 ? h.replace(/^(?:(?:Q(?:uestion)?|प्रश्न|प्र)?\s*[-.:]?\s*\d+[\.\:\-\)]\s*)/i, "").trim() : h);
      const rows = nonDivider.slice(1).map(parseRowCells);
      if (headers.length >= 2 && rows.length >= 1 && rows.every(r => r.length >= 2)) {
        const tableRawLines = candidateLines;
        const nonTableLines = [...lines.slice(0, tStart), ...lines.slice(tEnd + 1)].filter(l => Boolean(l && l.trim()));
        return {
          hasTable: true,
          headers,
          rows,
          tableRawLines,
          nonTableLines,
        };
      }
    }
  }

  return {
    hasTable: false,
    headers: [],
    rows: [],
    tableRawLines: [],
    nonTableLines: lines,
  };
}

// ─────────────────────────────────────────────────────────────
// STEP 2: DETERMINISTIC QUESTION CLASSIFIER
// Strict Priority Order & Structural Evidence:
// 1. Match the Following (List-I & List-II both present)
// 2. Assertion–Reason (both Assertion & Reason present)
// 3. Passage / Case-Based (narrative text / passage cues)
// 4. Table / Data-Based (tabular grid with headers & rows)
// 5. Sequence / Chronological (sequence keywords/permutations + items)
// 6. Statement-Based (2+ actual independent statement propositions)
// 7. Direct MCQ (default 4-option stem, including negative questions)
// 8. Unclassified (fallback)
// ─────────────────────────────────────────────────────────────

export function detectBlockQuestionType(block: string): {
  type: "assertion-reason" | "match-following" | "sequence" | "statement" | "table_data" | "passage" | "fill_blank" | "direct" | "unclassified";
  isNegative: boolean;
  confidence?: number;
} {
  const allLines = block.split(/\r?\n/);
  let optAIdx = -1;
  for (let i = 0; i < allLines.length; i++) {
    if (isOptionALine(allLines[i].trim())) {
      optAIdx = i;
      break;
    }
  }

  // Pre-option lines isolate the question stem, statements, table, etc. from the options
  const preOptionLines = optAIdx !== -1 ? allLines.slice(0, optAIdx) : allLines;
  const preOptionText = preOptionLines.join("\n");

  // Negative modifier check on stem only (excluding parenthetical hints like (संकेत: ...))
  const stemForNegativeCheck = preOptionText.replace(/\([^\)]*(?:संकेत|Note|नोट|Hint)[^\)]*\)/gi, "");
  const isNegative = /(?:\b(NOT|EXCEPT|INCORRECT|FALSE)\b|सिवाय|के\s*अलावा|के\s*अतिरिक्त|नहीं\s*सत्य|असत्य|गलत\s*कथन|सत्य\s*नहीं|सही\s*नहीं|सुमेलित\s*नहीं|गलत\s*युग्म|नहीं\s*है|सुमेलित\s*नहीं\s*है|कौन-सा\s*नहीं)/i.test(stemForNegativeCheck);

  // 1. Match the Following: requires explicit presence of BOTH List-I and List-II
  const hasListI = /(?:सूची\s*[-–—]?\s*I\b|List\s*[-–—]?\s*I\b)/i.test(block);
  const hasListII = /(?:सूची\s*[-–—]?\s*II\b|List\s*[-–—]?\s*II\b)/i.test(block);
  if (hasListI && hasListII) {
    return { type: "match-following", isNegative, confidence: 0.98 };
  }

  // 2. Assertion–Reason: requires BOTH Assertion (A) and Reason (R)
  const hasAssertion = /(?:अभिकथन|Assertion|कथन\s*\(?A\)?|\(A\)[\:\-])/i.test(preOptionText);
  const hasReason = /(?:कारण|Reason|कारण\s*\(?R\)?|\(R\)[\:\-])/i.test(preOptionText);
  if (hasAssertion && hasReason) {
    return { type: "assertion-reason", isNegative, confidence: 0.98 };
  }

  // 3. Passage / Case-Based: contains reading passage cues and narrative block
  const isPassageQuestion = /(?:निम्नलिखित\s*गद्यांश|गद्यांश\s*को\s*पढ़िए|गद्यांश\s*के\s*आधार|उपर्युक्त\s*गद्यांश|Read\s+the\s+(?:following\s+)?passage|Passage\s*[\:\-]|गद्यांश\s*[\:\-])/i.test(preOptionText);
  if (isPassageQuestion && preOptionLines.length >= 3) {
    return { type: "passage", isNegative, confidence: 0.95 };
  }

  // 4. Table / Data / Chart: tabular grid with headers and rows
  // Evaluated BEFORE Sequence / Chronological so tables with sequence words are never hijacked
  const tableCheck = extractTableDataFromBlock(preOptionLines.length > 1 ? preOptionLines : allLines);
  const fullTableCheck = tableCheck.hasTable ? tableCheck : extractTableDataFromBlock(allLines);
  if (fullTableCheck.hasTable) {
    return { type: "table_data", isNegative, confidence: 0.98 };
  }

  // 5. Sequence / Chronological: requires explicit sequence keywords or sequence combination options
  const hasSequenceKeywords = /(?:कालानुक्रमिक\s*(?:क्रम)?|सही\s*कालक्रम|सही\s*क्रम|कालक्रम|क्रम\s*में\s*व्यवस्थित|घटनाओं\s*का\s*क्रम|पहले\s*से\s*बाद|शुरुआत\s*से\s*अंत|आरोही\s*क्रम|अवरोही\s*क्रम|chronological\s*(?:order|sequence)?|chronology|arrange\s*(?:the\s*following\s*)?in\s*(?:the\s*)?(?:correct\s*)?(?:order|sequence)|sequence\s*order|correct\s*sequence|ordering)/i.test(preOptionText);
  const hasSequenceOptions = /(?:^|\n)\s*(?:(?:\(?|\[?)(?:Option\s+|Opt\s+|विकल्प\s+)?A[\.\)\:\-]?\s*)(?:\(?\d+\)?|[IVX]+|[a-d])\s*[-–—,>\.\s]\s*(?:\(?\d+\)?|[IVX]+|[a-d])\s*[-–—,>\.\s]\s*(?:\(?\d+\)?|[IVX]+|[a-d])/i.test(block);

  if (hasSequenceKeywords || hasSequenceOptions) {
    return { type: "sequence", isNegative, confidence: 0.95 };
  }

  // 6. Statement-Based: REQUIRES structural evidence of 2 or more distinct statement propositions
  // Single keywords like "निम्नलिखित", "कौन-सा", "सही", "गलत", "नहीं" MUST NEVER trigger statement classification!
  let explicitStmtCount = 0;
  let numberedStmtCount = 0;
  const cueFound = /(?:(?:कथनों|तथ्यों|कथनों\/तथ्यों)\s*पर\s*विचार|निम्नलिखित\s*(?:कथनों|तथ्यों|के\s*संबंध\s*में|के\s*संदर्भ\s*में)\s*[^A-D\n]*विचार|consider\s+the\s+following\s+(?:statements|facts))/i.test(preOptionText);

  for (const line of preOptionLines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (isQuestionInstruction(trimmed)) continue;

    if (/^(?:कथन|Statement)\s*\(?(\d+|[IVX]+)\)?[\:\-\.\)]\s*\S+/i.test(trimmed)) {
      explicitStmtCount++;
    } else if (/^(?:(?:\*|\-|\•)\s*)?(?:(\d+|[IVX]+)[\.\)\:\-]|(?:\((\d+|[IVX]+)\)))\s*\S+/i.test(trimmed)) {
      numberedStmtCount++;
    }
  }

  const hasStatementOptions = /(?:^|\n)\s*(?:(?:\(?|\[?)(?:Option\s+|Opt\s+|विकल्प\s+)?A[\.\)\:\-]?\s*)(?:केवल\s*\d|\d\s*और\s*\d|1,\s*2|1\s*and\s*2|Only\s*\d|Both\s*\d|न\s*तो\s*1|Neither\s*1)/i.test(block);
  const hasInstruction = preOptionLines.some(l => isQuestionInstruction(l.trim()));

  // Heuristic for unnumbered sentential statements (e.g. screenshot case)
  // Look for sentences in pre-option text that aren't instructions or cues
  const sententialStatements = preOptionText
    .split(/[:।\?\!\n]/)
    .map(s => s.trim())
    .filter(s => s.length > 10 && !isQuestionInstruction(s) && !/(?:विचार\s*कीजिए|निम्नलिखित|consider)/i.test(s));

  const isStatementQuestion =
    (explicitStmtCount >= 2) ||
    (numberedStmtCount >= 2 && (hasInstruction || hasStatementOptions || cueFound)) ||
    (cueFound && numberedStmtCount >= 2) ||
    (cueFound && sententialStatements.length >= 2);

  if (isStatementQuestion) {
    return { type: "statement", isNegative, confidence: 0.94 };
  }

  // 7. Fill-in-the-blank check: contains blanks represented by underscores or dots or explicit cue
  const hasBlanks = /(?:_{3,}|\.{4,}|\—{2,}|\–{2,}|(?:\bfill\s+in\s+the\s+blanks?\b|रिक्त\s*स्थान|खाली\s*स्थान))/i.test(preOptionText);
  if (hasBlanks) {
    return { type: "fill_blank", isNegative, confidence: 0.93 };
  }

  // 8. Direct MCQ: check if 4 lettered options exist in lines
  let hasA = false, hasB = false, hasC = false, hasD = false;
  for (const line of allLines) {
    const trimmed = line.trim();
    if (isOptionALine(trimmed)) hasA = true;
    else if (isOptionBLine(trimmed)) hasB = true;
    else if (isOptionCLine(trimmed)) hasC = true;
    else if (isOptionDLine(trimmed)) hasD = true;
  }
  if (hasA && hasB && hasC && hasD) {
    return { type: "direct", isNegative, confidence: 0.96 };
  }

  // 9. Fallback: Unclassified
  return { type: "unclassified", isNegative, confidence: 0.2 };
}

// ─────────────────────────────────────────────────────────────
// STEP 5: PREFIX-AGNOSTIC ANSWER FIELD PARSER & RESOLVER
// ─────────────────────────────────────────────────────────────

export function extractCleanAnswerValue(rawAns: string | null | undefined): string {
  if (!rawAns) return "";
  let s = String(rawAns).trim();
  
  // Prefix-agnostic match: strip Answer, Correct Answer, उत्तर, सही उत्तर, Ans, Key, wer, etc.
  s = s.replace(/^(?:(?:Correct\s*)?Answer|Right\s*Option|उत्तर(?:माला|म्)?|सही\s*उत्तर|Ans(?:wer)?|Key|wer)\s*[\:\-\=\)]*\s*/gi, "").trim();
  s = s.replace(/^[\:\-\=\s\)]+/, "").trim();

  return s;
}

export function resolveAnswerToOption(
  rawAnswerVal: string,
  options: { label: string; text: string }[] | string[]
): {
  label: string;
  index: number;
  resolved: boolean;
} {
  if (!rawAnswerVal || !rawAnswerVal.trim()) {
    return { label: "", index: -1, resolved: false };
  }

  const clean = rawAnswerVal.trim();
  const upper = clean.toUpperCase();

  // If answer contains multi-number phrase or words like "and", "both", "only", "दोनों", don't treat leading digit "1" as Option A!
  const isMultiNumberOrPhrase = /\b(?:and|both|only|तथा|और|दोनों|neither|nor|न तो)\b/i.test(clean) || (clean.match(/\b\d+\b/g) || []).length > 1;

  const labels = ["A", "B", "C", "D", "E", "F", "G", "H"];

  // 1. Direct letter or number prefix match
  const letterMatch = clean.match(/^(?:\(?|\[?)(?:Option\s+|Opt\s+|विकल्प\s+)?([A-Ha-hक-ङ1-8])(?:\.|\)|\]|\:|\-|\s+|$)/i);
  if (letterMatch && (!isMultiNumberOrPhrase || /^[A-Ha-hक-ङ]$/i.test(letterMatch[1]))) {
    const char = letterMatch[1].toUpperCase();
    if (char === "A" || char === "क" || (char === "1" && !isMultiNumberOrPhrase)) return { label: "A", index: 0, resolved: true };
    if (char === "B" || char === "ख" || (char === "2" && !isMultiNumberOrPhrase)) return { label: "B", index: 1, resolved: true };
    if (char === "C" || char === "ग" || (char === "3" && !isMultiNumberOrPhrase)) return { label: "C", index: 2, resolved: true };
    if (char === "D" || char === "घ" || (char === "4" && !isMultiNumberOrPhrase)) return { label: "D", index: 3, resolved: true };
    if (char === "E" || char === "ङ" || (char === "5" && !isMultiNumberOrPhrase)) return { label: "E", index: 4, resolved: true };
    if (char === "F" || (char === "6" && !isMultiNumberOrPhrase)) return { label: "F", index: 5, resolved: true };
    if (char === "G" || (char === "7" && !isMultiNumberOrPhrase)) return { label: "G", index: 6, resolved: true };
    if (char === "H" || (char === "8" && !isMultiNumberOrPhrase)) return { label: "H", index: 7, resolved: true };
  }

  // Standalone single letter: "A", "B", "C", "D", "E", etc.
  const standalone = clean.match(/\b([A-Ha-h])\b/);
  if (standalone) {
    const char = standalone[1].toUpperCase();
    const idx = labels.indexOf(char);
    if (idx >= 0) return { label: char, index: idx, resolved: true };
  }

  // 2. Match against actual option text
  // e.g. rawAnswer is "1 and 2 only", or "केवल 1 और 2"
  const optTexts = options.map((opt) => (typeof opt === "string" ? opt : opt.text).trim().toLowerCase());
  const cleanLower = clean.toLowerCase();

  for (let i = 0; i < optTexts.length; i++) {
    const optText = optTexts[i];
    if (!optText) continue;
    
    // Exact or substring match
    if (optText === cleanLower) {
      return { label: labels[i] || String(i + 1), index: i, resolved: true };
    }
    if (cleanLower.length >= 4 && (optText.includes(cleanLower) || cleanLower.includes(optText))) {
      return { label: labels[i] || String(i + 1), index: i, resolved: true };
    }
  }

  // 3. Digit/number combination match (e.g. "1 and 2 only", "1 and 2", "1, 2", "केवल 1", etc.)
  const digitsInAns = cleanLower.match(/\b\d+\b/g);
  if (digitsInAns && digitsInAns.length > 0) {
    const isNeither = /neither|none|न तो|कोई नहीं/i.test(cleanLower);
    const isBoth = /both|दोनों/i.test(cleanLower) || digitsInAns.length > 1;

    for (let i = 0; i < optTexts.length; i++) {
      const optText = optTexts[i];
      const digitsInOpt = optText.match(/\b\d+\b/g) || [];
      if (isNeither && /न तो|neither|none|कोई नहीं/i.test(optText)) {
        return { label: labels[i] || String(i + 1), index: i, resolved: true };
      }
      if (isBoth && (/दोनों|both/i.test(optText) || (digitsInOpt.length === digitsInAns.length && digitsInAns.every((d) => (digitsInOpt as string[]).indexOf(d) !== -1)))) {
        return { label: labels[i] || String(i + 1), index: i, resolved: true };
      }
      if (!isBoth && !isNeither && digitsInAns.length === 1 && digitsInOpt.length === 1 && digitsInAns[0] === digitsInOpt[0]) {
        return { label: labels[i] || String(i + 1), index: i, resolved: true };
      }
    }
  }

  // Could not resolve cleanly — never guess!
  return { label: "", index: -1, resolved: false };
}

export function normalizeCorrectAnswer(
  val: any,
  optionsCount = 4,
  options?: string[]
): number {
  if (val === undefined || val === null) return -1;

  if (typeof val === "number") {
    if (val >= 0 && val < optionsCount) return val;
    if (val >= 1 && val <= optionsCount) return val - 1;
    return -1;
  }

  const str = String(val).trim();
  const res = resolveAnswerToOption(str, options || ["", "", "", ""]);
  return res.resolved ? res.index : -1;
}

// ─────────────────────────────────────────────────────────────
// STEP 6: CLEAN EXPLANATION EXTRACTION
// ─────────────────────────────────────────────────────────────

export function cleanExplanationText(
  rawExp: string,
  correctLabel?: string,
  correctOptText?: string
): string {
  if (!rawExp) return "";
  let exp = rawExp.trim();

  // Strip leading explanation markers
  exp = exp.replace(/^(?:Explanation|Exp|Solution|व्याख्या|स्पष्टीकरण)\s*[\:\-\=]*\s*/i, "").trim();

  // Strip leading fragments leftover from bad splitting upstream like "है B. (A) और (R)..." or "B. "
  exp = exp.replace(/^(?:है\s*)?(?:(?:Correct\s*)?Answer|Right\s*Option|उत्तर(?:माला|म्)?|Ans(?:wer)?|Key|wer)?\s*[\:\-\=\)]*\s*(?:[A-Da-d1-4][\.\)\:\-\s]+|[क-घ][\.\)\:\-]\s*|[A-Da-d]\s+)/i, "").trim();
  exp = exp.replace(/^(?:है\s*)?[A-Da-d][\.\)\:\-\s]+/i, "").trim();

  // Strip trailing section headers / test boundaries if captured at block boundary
  exp = exp.replace(/(?:\n|^)\s*(?:={3,}|-{3,}|_{3,}|\*{3,})\s*(?:\n[\s\S]*)?$/g, "").trim();
  exp = exp.replace(/(?:\n|^)\s*TEST\s*\d+[\s\S]*$/gi, "").trim();

  return exp;
}

// ─────────────────────────────────────────────────────────────
// STEP 7: DEDUPLICATION PASS ACROSS EXTRACTED FIELDS
// ─────────────────────────────────────────────────────────────

function deduplicateExtractedFields(data: {
  question: string;
  statements?: string[];
  instruction?: string;
  assertion?: string;
  reason?: string;
  sequenceItems?: string[];
  list1?: string[];
  list2?: string[];
  options: { label: string; text: string }[];
  explanation: string;
}): {
  question: string;
  statements?: string[];
  instruction?: string;
  assertion?: string;
  reason?: string;
  sequenceItems?: string[];
  options: { label: string; text: string }[];
  explanation: string;
} {
  let { question, statements, instruction, assertion, reason, sequenceItems, list1, list2, options, explanation } = data;

  const removeSpan = (source: string, target: string): string => {
    if (!target || target.length < 5) return source;
    // Escape regex characters
    const escaped = target.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return source.replace(new RegExp(escaped, "gi"), "").trim();
  };

  // Assertion and Reason win over question
  if (assertion) {
    question = removeSpan(question, assertion);
    question = question.replace(/^(?:(?:Q\d+[\.\:\-\s]*)?(?:अभिकथन|Assertion|कथन)?\s*\(?A\)?[\:\-\s]*)/gi, "").trim();
  }
  if (reason) {
    question = removeSpan(question, reason);
    question = question.replace(/^(?:(?:कारण|Reason)?\s*\(?R\)?[\:\-\s]*)/gi, "").trim();
  }

  // Statements win over question
  if (statements && statements.length > 0) {
    const cleanStmts: string[] = [];
    for (const stmt of statements) {
      if (isQuestionInstruction(stmt)) {
        if (!instruction) {
          instruction = cleanInstructionText(stmt);
        }
      } else {
        cleanStmts.push(stmt);
      }
    }
    statements = cleanStmts;

    statements.forEach((stmt, idx) => {
      question = removeSpan(question, stmt);
      question = question.replace(new RegExp(`(?:कथन|Statement)?\\s*\\(?${idx + 1}\\)?[\\:\\-\\.\\s]*`, "gi"), "").trim();
    });
  }

  // Instruction wins over question
  if (instruction) {
    question = removeSpan(question, instruction);
    question = question.replace(/(?:^|\n)\s*(?:(?:\*|\-|\•|\–|\—)\s*)?(?:(?:\d+|[IVX]+)[\.\)\:\-]|(?:\((\d+|[IVX]+)\)))\s*/gi, "\n").trim();
  }

  // Sequence items win over question
  if (sequenceItems && sequenceItems.length > 0) {
    sequenceItems.forEach((item, idx) => {
      question = removeSpan(question, item);
      question = question.replace(new RegExp(`(?:^|\\n)\\s*\\(?${idx + 1}\\)?[\\:\\-\\.\\s]*`, "gi"), "").trim();
    });
  }

  // Match lists win over question
  if (list1 && list1.length > 0) {
    list1.forEach((item) => {
      question = removeSpan(question, item);
    });
  }
  if (list2 && list2.length > 0) {
    list2.forEach((item) => {
      question = removeSpan(question, item);
    });
  }

  // Options win over question
  options.forEach((opt) => {
    if (opt.text && opt.text.length >= 6) {
      question = removeSpan(question, opt.text);
    }
  });

  // Strip code headers / trailers from question (e.g. "कूट", "सही कूट:", "Codes:")
  question = question.replace(/(?:^|\n)\s*(?:(?:सही\s*)?(?:कूट|कोड|Codes?)|नीचे\s*दिए\s*गए\s*कूट|उपर्युक्त\s*(?:का|के|से)?\s*सही\s*कूट)[\:\-\s]*$/gi, "").trim();

  // Clean trailing punctuation and residual blanks from question
  question = question.replace(/^[\s\:\-\.\,]+|[\s\:\-\.\,]+$/g, "").trim();

  // If question stem became empty because it only contained assertion/reason or statements:
  if (!question || question.length < 4) {
    if (assertion && reason) {
      question = "नीचे दिए गए अभिकथन एवं कारण पर विचार कीजिए:";
    } else if (statements && statements.length > 0) {
      question = "निम्नलिखित कथनों पर विचार कीजिए:";
    } else if (sequenceItems && sequenceItems.length > 0) {
      question = "निम्नलिखित घटनाओं/प्रावधानों को सही कालक्रम में व्यवस्थित कीजिए:";
    } else {
      question = "निम्नलिखित प्रश्न पर विचार कीजिए:";
    }
  }

  return {
    question,
    statements: statements && statements.length > 0 ? statements : undefined,
    instruction: instruction || undefined,
    assertion,
    reason,
    sequenceItems: sequenceItems && sequenceItems.length > 0 ? sequenceItems : undefined,
    options,
    explanation,
  };
}

// ─────────────────────────────────────────────────────────────
// VALIDATION ENGINE
// ─────────────────────────────────────────────────────────────

export function validateDraftQuestion(draft: {
  text?: string;
  question?: string;
  type?: string;
  questionType?: string;
  options?: string[] | { label: string; text: string }[];
  correctIndex?: number;
  answer?: string;
  explanation?: string;
  assertion?: string;
  reason?: string;
  statements?: (string | { number?: number; text: string })[];
  instruction?: string;
  sequenceItems?: (string | { number?: number; text: string })[];
  table?: {
    caption?: string;
    headers: string[];
    rows: (string[] | { cells: string[] })[];
  };
  tableData?: {
    caption?: string;
    headers: string[];
    rows: (string[] | { cells: string[] })[];
  };
}): { isValid: boolean; errors: string[]; reviewReason?: string } {
  const errors: string[] = [];
  const qType = draft.type || draft.questionType || "direct";
  const stem = draft.question || draft.text || "";

  // 1. Question non-empty
  if (!stem || stem.trim().length < 4) {
    errors.push("Question stem is missing or too short.");
  }

  // 2. Type is not unclassified
  if (qType === "unclassified") {
    errors.push("Question type is unclassified. Please review raw block.");
  }

  // 3. Options validation
  const optList = draft.options || [];
  if (optList.length < 2) {
    errors.push("Question must have at least 2 options.");
  } else {
    const letters = ["A", "B", "C", "D", "E", "F", "G", "H"];
    optList.forEach((opt, idx) => {
      const txt = typeof opt === "string" ? opt : opt.text;
      if (!txt || txt.trim().length === 0) {
        errors.push(`Option ${letters[idx] || (idx + 1)} is empty.`);
      }
    });
  }

  // 4. Answer resolves to one of the options
  if (
    draft.correctIndex === undefined ||
    draft.correctIndex === null ||
    draft.correctIndex < 0 ||
    draft.correctIndex >= optList.length
  ) {
    errors.push("Answer did not match any valid option.");
  }

  // 5. Assertion-Reason specific validation
  if (qType === "assertion-reason" || qType === "assertion_reason") {
    if (!draft.assertion || draft.assertion.trim().length < 3) {
      errors.push("Assertion (A) is missing or incomplete.");
    }
    if (!draft.reason || draft.reason.trim().length < 3) {
      errors.push("Reason (R) is missing or incomplete.");
    }
  }

  // 6. Statement-based specific validation
  if (qType === "statement" || qType === "statement_based") {
    const rawStmts = draft.statements || [];
    if (rawStmts.length < 2) {
      errors.push("Statement-based question requires at least 2 distinct statements.");
    } else {
      rawStmts.forEach((s, idx) => {
        const txt = typeof s === "string" ? s : s.text;
        if (!txt || txt.trim().length === 0) {
          errors.push(`Statement ${idx + 1} is empty.`);
        }
        if (isQuestionInstruction(txt)) {
          errors.push(`Statement ${idx + 1} appears to be a question instruction rather than a statement.`);
        }
      });

      const stmtTexts = rawStmts.map((s) => (typeof s === "string" ? s : s.text).trim().toLowerCase());
      const uniqueStmts = new Set(stmtTexts);
      if (uniqueStmts.size < stmtTexts.length) {
        errors.push("Duplicate statements detected in statement list.");
      }
    }
  }

  // 7. Sequence / Chronological specific validation
  if (qType === "sequence") {
    const seqItems = draft.sequenceItems || [];
    if (seqItems.length < 2) {
      errors.push("Sequence / Chronological question requires at least 2 sequence items.");
    } else {
      seqItems.forEach((item, idx) => {
        const text = typeof item === "string" ? item : item.text;
        if (!text || text.trim().length === 0) {
          errors.push(`Sequence item ${idx + 1} is empty.`);
        }
      });

      // Verify option combinations reference valid item numbers (1..seqItems.length)
      const maxItemNum = seqItems.length;
      optList.forEach((opt, idx) => {
        const txt = typeof opt === "string" ? opt : opt.text;
        const nums = (txt.match(/\b\d+\b/g) || []).map(n => parseInt(n, 10));
        if (nums.length >= 2) {
          const invalidNums = nums.filter(n => n < 1 || n > maxItemNum);
          if (invalidNums.length > 0) {
            errors.push(`Option ${["A", "B", "C", "D"][idx]} references invalid item number(s): ${invalidNums.join(", ")} (expected 1–${maxItemNum}).`);
          }
        }
      });
    }
  }

  // 8. Table-based specific validation
  const rawTable = (draft as any).table || draft.tableData;
  if (rawTable !== undefined && rawTable !== null) {
    if (typeof rawTable !== "object" || Array.isArray(rawTable)) {
      errors.push('"table" present but not an object.');
    } else {
      const headers = rawTable.headers;
      const rows = rawTable.rows;

      if (!headers || !Array.isArray(headers) || headers.length === 0) {
        errors.push('table missing headers.');
      } else if (headers.length < 2 || headers.length > 6) {
        errors.push(`table headers must be between 2 and 6 columns (found ${headers.length}).`);
      }

      if (!rows || !Array.isArray(rows) || rows.length === 0) {
        errors.push('table missing rows.');
      } else if (rows.length > 10) {
        errors.push(`table cannot have more than 10 rows (found ${rows.length}).`);
      }

      if (
        headers &&
        Array.isArray(headers) &&
        headers.length >= 2 &&
        headers.length <= 6 &&
        rows &&
        Array.isArray(rows) &&
        rows.length >= 1 &&
        rows.length <= 10
      ) {
        const headerCount = headers.length;
        rows.forEach((row: any, rIdx: number) => {
          const rowNum = rIdx + 1;
          const cells = Array.isArray(row)
            ? row
            : (row && typeof row === "object" && Array.isArray(row.cells) ? row.cells : null);
          if (!cells) {
            errors.push(`table row ${rowNum} is invalid or missing cells.`);
          } else if (cells.length !== headerCount) {
            errors.push(`table row ${rowNum} has ${cells.length} cells but ${headerCount} headers.`);
          }
        });
      }
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    reviewReason: errors.length > 0 ? errors[0] : undefined,
  };
}

/**
 * Backward compatibility detector for existing components
 */
export function detectQuestionType(
  text: string,
  options: string[],
  answerStr: string
): string {
  const res = detectBlockQuestionType(text + "\n" + options.join("\n") + "\n" + answerStr);
  return res.type;
}

// ─────────────────────────────────────────────────────────────
// MAIN BULK TEXT PARSER
// Implements Steps 1 through 7 and strict validation
// ─────────────────────────────────────────────────────────────

export function parseTextQuestions(
  rawText: string,
  chapterId: string,
  topicId: string
): ParsedQuestionDraft[] {
  if (!rawText || !rawText.trim()) return [];

  // 1. Standardize formatting without destroying words
  const cleanedText = cleanAndStandardizeBulkText(rawText);

  // 2. Step 1: Split into individual question blocks
  const blocks = splitIntoQuestionBlocks(cleanedText);

  return blocks.map((block, idx) => {
    // 3. Step 2: Detect question type & negative tag before extracting fields
    const { type: detectedType, isNegative } = detectBlockQuestionType(block);

    // If unclassified, return early with rawFallback populated
    if (detectedType === "unclassified") {
      return {
        tempId: `draft-unclassified-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 6)}`,
        id: `draft-unclassified-${Date.now()}-${idx}`,
        chapterId,
        topicId,
        text: block,
        question: block,
        type: "unclassified",
        questionType: "unclassified",
        isNegative,
        options: ["", "", "", ""],
        parsedOptions: [
          { label: "A", text: "" },
          { label: "B", text: "" },
          { label: "C", text: "" },
          { label: "D", text: "" },
        ],
        correctIndex: -1,
        answer: "",
        explanation: "",
        difficulty: "medium",
        createdAt: new Date().toISOString(),
        isValid: false,
        errors: ["Question structure could not be classified. Please verify and format manually."],
        needsReview: true,
        reviewReason: "Unclassified question type",
        rawFallback: block,
        questionNumber: idx + 1,
      };
    }

    // Parse block lines with leading bullet and indentation normalization
    const rawBlockLines = block.split(/\r?\n/);
    interface BlockLine {
      raw: string;
      clean: string;
      isBullet: boolean;
    }
    const processedLines: BlockLine[] = [];
    for (const rawLine of rawBlockLines) {
      const trimmed = rawLine.trim();
      if (!trimmed) continue;
      const isBullet = /^[ \t]*[\*\-\•\–\—\>\·\u2022\u2023\u25E6\u2043\u2219]\s+/.test(rawLine) || /^[ \t]{2,}\S/.test(rawLine);
      const clean = trimmed.replace(/^[ \t]*[\*\-\•\–\—\>\·\u2022\u2023\u25E6\u2043\u2219]+(?:\s+|$)/, "").trim();
      processedLines.push({ raw: rawLine, clean, isBullet });
    }

    // Extract Answer, Explanation, Important Fact
    let rawAnswerCaptured = "";
    let explanationLines: string[] = [];
    let importantFact = "";
    const workingLines: BlockLine[] = [];
    let inExp = false;

    for (let i = 0; i < processedLines.length; i++) {
      const item = processedLines[i];
      const line = item.clean;

      // Prefix-agnostic answer match
      const ansMatch = line.match(/^(?:(?:Correct\s*)?Answer|Right\s*Option|उत्तर(?:माला|म्)?|सही\s*उत्तर|Ans(?:wer)?|Key|wer)\s*[\:\-\=\)]*\s*(.*)$/i);
      if (ansMatch) {
        inExp = false;
        let captured = extractCleanAnswerValue(ansMatch[1]);
        if (!captured && i + 1 < processedLines.length) {
          const nextLineClean = processedLines[i + 1].clean.trim();
          const candidate = extractCleanAnswerValue(nextLineClean);
          if (candidate && (candidate.length <= 15 || /^\(?[A-Da-d1-4]\)?/.test(candidate))) {
            captured = candidate;
            i++; // Consume the answer line
          }
        }
        rawAnswerCaptured = captured;
        continue;
      }

      // Explanation match
      const expMatch = line.match(/^(?:Explanation|Exp|Solution|व्याख्या|स्पष्टीकरण)\s*[\:\-\=\)]*\s*(.*)$/i);
      if (expMatch) {
        inExp = true;
        if (expMatch[1]) explanationLines.push(expMatch[1].trim());
        continue;
      }

      // Fact match
      const factMatch = line.match(/^(?:Important\s*Fact|Fact|मुख्य\s*तथ्य|महत्वपूर्ण\s*तथ्य)\s*[\:\-\=\)]*\s*(.*)$/i);
      if (factMatch) {
        inExp = false;
        importantFact = factMatch[1].trim();
        continue;
      }

      if (inExp) {
        explanationLines.push(line);
      } else {
        workingLines.push(item);
      }
    }

    // Step 3: Extract Assertion/Reason (or Statements or Lists) BEFORE touching options!
    // And delete them from working lines so Option A can never match Assertion (A).
    let extractedAssertion: string | undefined = undefined;
    let extractedReason: string | undefined = undefined;
    let extractedStatements: string[] = [];
    let extractedInstruction: string | undefined = undefined;
    let list1: string[] = [];
    let list2: string[] = [];
    let sequenceItems: string[] = [];
    let extractedTableData: { headers: string[]; rows: string[][] } | undefined = undefined;
    let extractedPassage: string | undefined = undefined;
    let stemLines: string[] = [];
    let candidateOptionLines: string[] = [];

    if (detectedType === "assertion-reason") {
      let assertStart = -1;
      let reasonStart = -1;
      let optionStart = -1;

      for (let i = 0; i < workingLines.length; i++) {
        const l = workingLines[i].clean;
        if (assertStart === -1 && /^(?:(?:(?:Q\d+|\d+|प्रश्न\s*\d+)[\.\:\-\s]*)?(?:अभिकथन|Assertion|कथन\s*\(?A\)?|\(A\)[\:\-]))/i.test(l)) {
          assertStart = i;
        } else if (assertStart !== -1 && reasonStart === -1 && /^(?:(?:(?:Q\d+|\d+|प्रश्न\s*\d+)[\.\:\-\s]*)?(?:कारण|Reason|कारण\s*\(?R\)?|\(R\)[\:\-]))/i.test(l)) {
          reasonStart = i;
        } else if (reasonStart !== -1 && optionStart === -1 && isOptionALine(l)) {
          optionStart = i;
        }
      }

      if (assertStart !== -1 && reasonStart !== -1) {
        if (optionStart === -1) {
          // Look for any line-start option marker
          for (let i = reasonStart + 1; i < workingLines.length; i++) {
            if (isOptionALine(workingLines[i].clean)) {
              optionStart = i;
              break;
            }
          }
          if (optionStart === -1) optionStart = workingLines.length;
        }

        stemLines = workingLines.slice(0, assertStart).map(w => w.clean);
        const rawAssert = workingLines.slice(assertStart, reasonStart).map(w => w.clean).join(" ");
        extractedAssertion = rawAssert.replace(/^(?:(?:(?:Q\d+|\d+|प्रश्न\s*\d+)[\.\:\-\s]*)?(?:अभिकथन|Assertion|कथन)?\s*\(?A\)?[\:\-\s]*)/i, "").trim();

        // Lines between reasonStart and optionStart: separate prompt/instruction lines
        const reasonLines: string[] = [];
        const promptLines: string[] = [];
        let inPrompt = false;

        for (let i = reasonStart; i < optionStart; i++) {
          const l = workingLines[i].clean;
          if (i > reasonStart && /^(?:उपर्युक्त|नीचे\s*दिए\s*गए|कूट\s*का|कूट\s*से|Select\s+the|Choose\s+the|Which\s+of)/i.test(l)) {
            inPrompt = true;
          }
          if (inPrompt) {
            promptLines.push(l);
          } else {
            reasonLines.push(l);
          }
        }

        const rawReason = reasonLines.join(" ");
        extractedReason = rawReason.replace(/^(?:(?:(?:Q\d+|\d+|प्रश्न\s*\d+)[\.\:\-\s]*)?(?:कारण|Reason)?\s*\(?R\)?[\:\-\s]*)/i, "").trim();

        if (promptLines.length > 0) {
          stemLines.push(...promptLines);
        }

        // Working options start strictly from optionStart onwards
        candidateOptionLines = workingLines.slice(optionStart).map(w => w.clean);
      } else {
        candidateOptionLines = workingLines.map(w => w.clean);
      }
    } else if (detectedType === "statement") {
      // Find option start
      let optionStart = -1;
      for (let i = 0; i < workingLines.length; i++) {
        if (isOptionALine(workingLines[i].clean)) {
          optionStart = i;
          break;
        }
      }

      const preOptionLines = optionStart !== -1 ? workingLines.slice(0, optionStart) : workingLines;
      candidateOptionLines = optionStart !== -1 ? workingLines.slice(optionStart).map(w => w.clean) : [];

      let inStatements = false;
      let foundCue = false;

      for (let i = 0; i < preOptionLines.length; i++) {
        const item = preOptionLines[i];
        const l = item.clean;
        const trimmed = l.trim();
        if (!trimmed) continue;

        // Parenthetical Hint line e.g. (संकेत: असत्य कथन को विलोपित कर सही उत्तर चुनें)
        const isHintLine = /^\s*\(?\s*(?:संकेत|Note|नोट|Hint|सूचना)\s*[\:\-]/i.test(trimmed) || /^\s*\((?:संकेत|Note|नोट|Hint)[^\)]+\)\s*$/i.test(trimmed);
        if (isHintLine) {
          stemLines.push(trimmed);
          inStatements = false;
          continue;
        }

        // CRITICAL: Check if this line is a Question Instruction BEFORE checking if it has numbers!
        // E.g. "4. सही कथन कौन-से हैं?", "सही कथन कौन-से हैं?", "उपरोक्त में से कौन-सा/से कथन सही है/हैं?"
        if (isQuestionInstruction(trimmed)) {
          extractedInstruction = cleanInstructionText(trimmed);
          inStatements = false;
          continue;
        }

        // Explicit statement prefix e.g. "कथन 1: ..."
        const stmtMatch = trimmed.match(/^(?:कथन|Statement)\s*\(?(\d+|[IVX]+)\)?[\:\-\.\)]\s*(.*)$/i);
        if (stmtMatch) {
          const body = stmtMatch[2].trim();
          if (isQuestionInstruction(body)) {
            extractedInstruction = cleanInstructionText(body);
            inStatements = false;
          } else {
            inStatements = true;
            extractedStatements.push(body);
          }
          continue;
        }

        // Numbered statement e.g. "1. ..."
        const numStmtMatch = trimmed.match(/^(?:(?:\*|\-|\•)\s*)?(?:(\d+|[IVX]+)[\.\)\:\-]|(?:\((\d+|[IVX]+)\)))\s*(.*)$/i);
        if (numStmtMatch && (inStatements || i > 0 || numStmtMatch[1] === "1" || numStmtMatch[2] === "1")) {
          const numBody = (numStmtMatch[3] || "").trim();
          if (isQuestionInstruction(numBody)) {
            extractedInstruction = cleanInstructionText(numBody);
            inStatements = false;
          } else {
            inStatements = true;
            extractedStatements.push(numBody);
          }
          continue;
        }

        // Bulleted line e.g. "* यह योजना 14 दिसम्बर..."
        if (item.isBullet) {
          const cleanStmt = trimmed.replace(/^(?:कथन|Statement)\s*\(?(\d+|[IVX]+)\)?[\:\-\.\)]\s*/i, "").trim();
          if (isQuestionInstruction(cleanStmt)) {
            extractedInstruction = cleanInstructionText(cleanStmt);
            inStatements = false;
          } else {
            inStatements = true;
            extractedStatements.push(cleanStmt);
          }
          continue;
        }

        // Cue header e.g. "निम्नलिखित कथनों/तथ्यों पर विचार कीजिए:"
        const isCueLine = /(?:विचार\s*कीजिए|consider\s+the\s+following|के\s*संबंध\s*में\s*तथ्य|के\s*संबंध\s*में\s*कथन)/i.test(trimmed);
        if (isCueLine) {
          foundCue = true;
          stemLines.push(trimmed);
          continue;
        }

        // Lines following cue or in statement run
        if (inStatements || (foundCue && i > 0)) {
          if (isQuestionInstruction(trimmed)) {
            extractedInstruction = cleanInstructionText(trimmed);
            inStatements = false;
          } else {
            inStatements = true;
            extractedStatements.push(trimmed);
          }
        } else {
          stemLines.push(trimmed);
        }
      }

      // Safety check: if last extracted statement is an instruction, pop it and set instruction
      if (extractedStatements.length > 0) {
        const lastStmt = extractedStatements[extractedStatements.length - 1];
        if (isQuestionInstruction(lastStmt)) {
          if (!extractedInstruction) {
            extractedInstruction = cleanInstructionText(lastStmt);
          }
          extractedStatements.pop();
        }
      }

      // NEW HEURISTIC: If only 1 "statement" extracted but it contains multiple sentences 
      // AND foundCue is true, split it into multiple statements
      if (extractedStatements.length === 1 && foundCue) {
        const singleStmt = extractedStatements[0];
        // Split by Hindi full stop, question mark, or newline
        const parts = singleStmt.split(/([।\?\!\n])/).map(p => p.trim()).filter(Boolean);
        if (parts.length >= 2) {
          const reconstructed: string[] = [];
          for (let i = 0; i < parts.length; i++) {
            let s = parts[i];
            if (/^[।\?\!\n]$/.test(s) && reconstructed.length > 0) {
              reconstructed[reconstructed.length - 1] += s;
            } else {
              reconstructed.push(s);
            }
          }
          
          if (reconstructed.length >= 2) {
            extractedStatements.length = 0;
            // Check if last sentence is instruction
            const lastPart = reconstructed[reconstructed.length - 1];
            if (isQuestionInstruction(lastPart)) {
              if (!extractedInstruction) extractedInstruction = cleanInstructionText(lastPart);
              extractedStatements.push(...reconstructed.slice(0, -1));
            } else {
              extractedStatements.push(...reconstructed);
            }
          }
        }
      }

      // Semantic check against interrogative endings if statements >= 2
      if (extractedStatements.length >= 2) {
        const lastIdx = extractedStatements.length - 1;
        const lastItem = extractedStatements[lastIdx];
        const isInterrogative = /(?:कौन|सत्य|सही|गलत|असत्य|उपर्युक्त|उपरोक्त|which|correct|true|false|\?)/i.test(lastItem);
        if (isInterrogative && !extractedInstruction) {
          extractedInstruction = cleanInstructionText(lastItem);
          extractedStatements.splice(lastIdx, 1);
        }
      }
    } else if (detectedType === "match-following") {
      const tableRes = extractTableDataFromBlock(workingLines.map(w => w.raw));
      if (tableRes.hasTable && tableRes.rows.length >= 1) {
        // Extracted list items from table columns
        tableRes.rows.forEach(row => {
          if (row.length >= 2) {
            list1.push(row[0].trim());
            list2.push(row[1].trim());
          }
        });

        // Determine option start
        let optionStart = -1;
        for (let i = 0; i < workingLines.length; i++) {
          if (isOptionALine(workingLines[i].clean)) {
            optionStart = i;
            break;
          }
        }

        // Stem lines are lines that are NOT part of the table and NOT part of the options
        const preOptionLines = optionStart !== -1 ? workingLines.slice(0, optionStart) : workingLines;
        preOptionLines.forEach(item => {
          const isTableLine = tableRes.tableRawLines.some(tr => tr.trim() === item.raw.trim());
          if (!isTableLine) {
            stemLines.push(item.clean);
          }
        });

        candidateOptionLines = optionStart !== -1 ? workingLines.slice(optionStart).map(w => w.clean) : [];
      } else {
        let curList: "I" | "II" | null = null;
        let optionStart = -1;

        for (let i = 0; i < workingLines.length; i++) {
          const item = workingLines[i];
          const l = item.clean;

          // Check for code header e.g. "सही कूट का चयन कीजिए:" or "कूट:" or "Codes:"
          const isCodeHeader = /^(?:सही\s*(?:सुमेल|कूट)|कूट|Codes?|Select\s+the\s+correct\s*(?:match|code))/i.test(l);
          if (isCodeHeader) {
            stemLines.push(l);
            curList = null;
            for (let j = i + 1; j < workingLines.length; j++) {
              if (isOptionALine(workingLines[j].clean)) {
                optionStart = j;
                break;
              }
            }
            break;
          }

          // Combination option start e.g. "A. a-1, b-2, c-3, d-4" or "A. 1-A, 2-B"
          // MUST NOT trigger on lowercase "a. सीसा-जस्ता" inside List-I!
          const isMatchOption = curList === "II" || curList === null ? (
            isOptionALine(l) && (
              /[0-9IVX]+[\s\-–—]+[A-Da-d]/i.test(l) ||
              /[A-Da-d][\s\-–—]+[0-9IVX]+/i.test(l) ||
              /^[A-Da-d][\.\)]\s*[a-dA-D0-9]/i.test(l)
            )
          ) : false;

          if (isMatchOption) {
            optionStart = i;
            break;
          }

          // Header lines containing both lists like "सूची-I को सूची-II से सुमेलित कीजिए:" are stem lines
          const hasList1 = /(?:सूची|list)\s*[-–—]?\s*i\b/i.test(l);
          const hasList2 = /(?:सूची|list)\s*[-–—]?\s*ii\b/i.test(l);
          if (hasList1 && hasList2) {
            stemLines.push(l);
            continue;
          }

          if (hasList2) {
            curList = "II";
            continue;
          }
          if (hasList1) {
            curList = "I";
            continue;
          }

          // Process List-I items
          if (curList === "I") {
            // List-I items can have markers like "a. ", "1. ", "(a) ", or just bulleted/plain text
            const itemMatch = l.match(/^(?:([a-zA-Z0-9IVX]+)[\.\)\:\-]\s*)(.*)$/);
            if (itemMatch) {
              const marker = itemMatch[1].toLowerCase();
              const text = itemMatch[2].trim();
              list1.push(`${marker}. ${text}`);
            } else {
              const autoMarker = String.fromCharCode(97 + list1.length);
              list1.push(`${autoMarker}. ${l}`);
            }
            continue;
          }

          // Process List-II items
          if (curList === "II") {
            // List-II items can have markers like "1. ", "a. ", "(1) ", or NO markers (just bullets or plain text)
            const itemMatch = l.match(/^(?:([a-zA-Z0-9IVX]+)[\.\)\:\-]\s*)(.*)$/);
            if (itemMatch) {
              const marker = itemMatch[1];
              const text = itemMatch[2].trim();
              list2.push(`${marker}. ${text}`);
            } else {
              // Unlabeled bullet list or plain text: auto-number by position 1, 2, 3...
              const autoNum = list2.length + 1;
              list2.push(`${autoNum}. ${l}`);
            }
            continue;
          }

          if (curList === null) {
            stemLines.push(l);
          }
        }

        if (optionStart === -1) {
          for (let i = 0; i < workingLines.length; i++) {
            if (isOptionALine(workingLines[i].clean) && (list2.length > 0 || i > 4)) {
              optionStart = i;
              break;
            }
          }
        }

        candidateOptionLines = optionStart !== -1 ? workingLines.slice(optionStart).map(w => w.clean) : [];
      }
    } else if (detectedType === "sequence") {
      // Sequence extraction
      let optAIndex = -1;
      for (let i = 0; i < workingLines.length; i++) {
        if (isOptionALine(workingLines[i].clean)) {
          optAIndex = i;
          break;
        }
      }

      const preOptionLines = optAIndex !== -1 ? workingLines.slice(0, optAIndex) : workingLines;
      candidateOptionLines = optAIndex !== -1 ? workingLines.slice(optAIndex).map(w => w.clean) : [];

      // Filter out code / instruction trailer lines from preOptionLines (e.g., "कूट", "सही कूट:", "Code:", "Codes:")
      const isCodeHeader = (s: string) => /^(?:(?:सही\s*)?(?:कूट|कोड|Codes?)|नीचे\s*दिए\s*गए\s*(?:कूट|कोड).*|उपर्युक्त\s*(?:का|के|से)?\s*सही\s*कूट.*)[\:\-\s]*$/i.test(s.trim());

      const cleanedPreLines: { raw: string; clean: string }[] = [];
      for (const item of preOptionLines) {
        const l = item.clean.trim();
        if (!l) continue;
        if (isCodeHeader(l)) continue;
        cleanedPreLines.push(item);
      }

      // If line 0 is the sequence question/instruction stem (e.g. "निम्नलिखित घटनाओं का सही कालानुक्रमिक क्रम क्या है?"),
      // put it in stemLines so it is never treated as a sequence item!
      const isSequencePrompt = (s: string) => /(?:कालानुक्रमिक|सही\s*कालक्रम|सही\s*क्रम|कालक्रम|क्रम\s*में\s*व्यवस्थित|घटनाओं\s*का\s*क्रम|पहले\s*से\s*बाद|chronological|arrange.*order|sequence)/i.test(s);

      let seqContentLines = [...cleanedPreLines];
      if (seqContentLines.length > 0 && isSequencePrompt(seqContentLines[0].clean)) {
        stemLines.push(seqContentLines[0].clean);
        seqContentLines = seqContentLines.slice(1);
      }

      // Check for numbered markers: "1. ", "(1) ", "I. ", "1 - ", etc.
      const explicitNumMatches = seqContentLines.map(p => {
        const m = p.clean.match(/^(?:(?:\*|\-|\•)\s*)?(?:(\d+|[IVX]+)[\.\)\:\-]|(?:\((\d+|[IVX]+)\)))\s*(.*)$/i);
        return m ? { num: m[1] || m[2], text: (m[3] || "").trim() } : null;
      });

      const explicitCount = explicitNumMatches.filter(Boolean).length;

      if (explicitCount >= 2) {
        // Items have explicit numbers (e.g. 1. Event A, 2. Event B)
        const firstSeqIdx = seqContentLines.findIndex((_, idx) => explicitNumMatches[idx] !== null);
        for (let i = 0; i < firstSeqIdx; i++) {
          stemLines.push(seqContentLines[i].clean);
        }
        for (let i = firstSeqIdx; i < seqContentLines.length; i++) {
          const match = explicitNumMatches[i];
          const lineText = seqContentLines[i].clean.trim();
          if (match) {
            sequenceItems.push(match.text);
          } else if (isQuestionInstruction(lineText) || isCodeHeader(lineText)) {
            extractedInstruction = cleanInstructionText(lineText);
          } else if (sequenceItems.length > 0) {
            sequenceItems[sequenceItems.length - 1] += " " + lineText;
          } else {
            stemLines.push(lineText);
          }
        }
      } else {
        // Check for bulleted lines: "* ...", "- ...", "• ..."
        const bulletMatches = seqContentLines.map(p => {
          const m = p.clean.match(/^(?:[\*\-\•\u2022\u2023\u25E6\u2043\u2219]|\([a-z]\)|[a-z][\.\)])\s+(.*)$/i);
          return m ? m[1].trim() : null;
        });
        const bulletCount = bulletMatches.filter(Boolean).length;

        if (bulletCount >= 2) {
          const firstBulletIdx = seqContentLines.findIndex((_, idx) => bulletMatches[idx] !== null);
          for (let i = 0; i < firstBulletIdx; i++) {
            stemLines.push(seqContentLines[i].clean);
          }
          for (let i = firstBulletIdx; i < seqContentLines.length; i++) {
            const bText = bulletMatches[i];
            if (bText) {
              sequenceItems.push(bText);
            } else if (sequenceItems.length > 0 && !isCodeHeader(seqContentLines[i].clean)) {
              sequenceItems[sequenceItems.length - 1] += " " + seqContentLines[i].clean;
            } else if (!isCodeHeader(seqContentLines[i].clean)) {
              stemLines.push(seqContentLines[i].clean);
            }
          }
        } else {
          // Unnumbered plain items: Line 0 is question stem, subsequent lines are sequence items
          if (seqContentLines.length >= 2) {
            stemLines.push(seqContentLines[0].clean);
            for (let i = 1; i < seqContentLines.length; i++) {
              const text = seqContentLines[i].clean.trim();
              if (text && !isCodeHeader(text)) {
                sequenceItems.push(text);
              }
            }
          } else if (seqContentLines.length === 1) {
            stemLines.push(seqContentLines[0].clean);
          }
        }
      }
    } else if (detectedType === "table_data") {
      const tableRes = extractTableDataFromBlock(workingLines.map(w => w.clean));
      if (tableRes.hasTable) {
        extractedTableData = {
          headers: tableRes.headers,
          rows: tableRes.rows,
        };
        const outsideLines = tableRes.nonTableLines;
        let optAIndex = -1;
        for (let i = 0; i < outsideLines.length; i++) {
          if (isOptionALine(outsideLines[i])) {
            optAIndex = i;
            break;
          }
        }
        if (optAIndex !== -1) {
          stemLines = outsideLines.slice(0, optAIndex);
          candidateOptionLines = outsideLines.slice(optAIndex);
        } else {
          stemLines = outsideLines;
          candidateOptionLines = [];
        }
      } else {
        let optAIndex = -1;
        for (let i = 0; i < workingLines.length; i++) {
          if (isOptionALine(workingLines[i].clean)) {
            optAIndex = i;
            break;
          }
        }
        const preOption = optAIndex !== -1 ? workingLines.slice(0, optAIndex) : workingLines;
        candidateOptionLines = optAIndex !== -1 ? workingLines.slice(optAIndex).map(w => w.clean) : [];
        stemLines = preOption.map(w => w.clean);
      }
    } else if (detectedType === "passage") {
      let optAIndex = -1;
      for (let i = 0; i < workingLines.length; i++) {
        if (isOptionALine(workingLines[i].clean)) {
          optAIndex = i;
          break;
        }
      }

      const preOption = optAIndex !== -1 ? workingLines.slice(0, optAIndex) : workingLines;
      candidateOptionLines = optAIndex !== -1 ? workingLines.slice(optAIndex).map(w => w.clean) : [];
      const nonBlankPre = preOption.map(w => w.clean.trim()).filter(Boolean);

      // Question stem is usually the last line asking the question
      let stemIdx = -1;
      for (let i = nonBlankPre.length - 1; i >= 0; i--) {
        if (/(?:गद्यांश\s*के\s*आधार|उपर्युक्त\s*गद्यांश|कौन-सा|कथन\s*सबसे|सही\s*है|Which|Select|Choose|\?)/i.test(nonBlankPre[i])) {
          stemIdx = i;
          break;
        }
      }
      if (stemIdx === -1 && nonBlankPre.length > 1) {
        stemIdx = nonBlankPre.length - 1;
      }

      if (stemIdx !== -1) {
        stemLines.push(nonBlankPre[stemIdx]);
        const passageLines = nonBlankPre.slice(0, stemIdx).filter(l => !/^(?:(?:Q\d+|\d+|प्रश्न\s*\d+)[\.\:\-\s]*)?(?:निम्नलिखित\s*गद्यांश|गद्यांश\s*को\s*पढ़िए|Read\s+the\s+following\s+passage)/i.test(l.trim()));
        extractedPassage = passageLines.join("\n\n").trim();
      } else {
        stemLines.push(...nonBlankPre);
      }
    } else {
      // Direct MCQ
      let optAIndex = -1;
      for (let i = 0; i < workingLines.length; i++) {
        if (isOptionALine(workingLines[i].clean)) {
          optAIndex = i;
          break;
        }
      }

      if (optAIndex !== -1) {
        stemLines = workingLines.slice(0, optAIndex).map(w => w.clean);
        candidateOptionLines = workingLines.slice(optAIndex).map(w => w.clean);
      } else {
        stemLines = workingLines.map(w => w.clean);
        candidateOptionLines = [];
      }
    }

    // Step 4: Extract options from line-start markers in candidateOptionLines
    let optAIdx = -1;
    let optBIdx = -1;
    let optCIdx = -1;
    let optDIdx = -1;

    for (let i = candidateOptionLines.length - 1; i >= 0; i--) {
      const line = candidateOptionLines[i];
      if (optDIdx === -1 && isOptionDLine(line)) {
        optDIdx = i;
      } else if (optDIdx !== -1 && optCIdx === -1 && isOptionCLine(line)) {
        optCIdx = i;
      } else if (optCIdx !== -1 && optBIdx === -1 && isOptionBLine(line)) {
        optBIdx = i;
      } else if (optBIdx !== -1 && optAIdx === -1 && isOptionALine(line)) {
        optAIdx = i;
        break;
      }
    }

    let optA = "";
    let optB = "";
    let optC = "";
    let optD = "";

    if (optAIdx !== -1) {
      const endA = optBIdx !== -1 ? optBIdx : candidateOptionLines.length;
      optA = [stripOptPrefix(candidateOptionLines[optAIdx]), ...candidateOptionLines.slice(optAIdx + 1, endA)].join("\n").trim();

      if (optBIdx !== -1) {
        const endB = optCIdx !== -1 ? optCIdx : candidateOptionLines.length;
        optB = [stripOptPrefix(candidateOptionLines[optBIdx]), ...candidateOptionLines.slice(optBIdx + 1, endB)].join("\n").trim();
      }
      if (optCIdx !== -1) {
        const endC = optDIdx !== -1 ? optDIdx : candidateOptionLines.length;
        optC = [stripOptPrefix(candidateOptionLines[optCIdx]), ...candidateOptionLines.slice(optCIdx + 1, endC)].join("\n").trim();
      }
      if (optDIdx !== -1) {
        optD = [stripOptPrefix(candidateOptionLines[optDIdx]), ...candidateOptionLines.slice(optDIdx + 1)].join("\n").trim();
      }
    }

    // Options recovery engine if any option is empty
    let rawExplanation = explanationLines.join("\n").trim();
    if (!optA || !optB || !optC || !optD) {
      const recoveredFromCandidate = recoverOptionsFromRawText(candidateOptionLines.join("\n"));
      const recoveredFromExp = recoverOptionsFromRawText(rawExplanation);
      const recoveredFromBlock = recoverOptionsFromRawText(block);
      const recovered = recoveredFromCandidate.options ? recoveredFromCandidate : (recoveredFromExp.options ? recoveredFromExp : recoveredFromBlock);

      if (recovered.options) {
        if (!optA) optA = recovered.options[0];
        if (!optB) optB = recovered.options[1];
        if (!optC) optC = recovered.options[2];
        if (!optD) optD = recovered.options[3];
      }
    }

    const optionsList: { label: string; text: string }[] = [
      { label: "A", text: optA },
      { label: "B", text: optB },
      { label: "C", text: optC },
      { label: "D", text: optD },
    ];

    // Step 5: Answer field resolution without fixed-length slicing
    const resolvedAns = resolveAnswerToOption(rawAnswerCaptured, optionsList);
    const resolvedLabel = resolvedAns.resolved ? resolvedAns.label : "";
    const correctIndex = resolvedAns.resolved ? resolvedAns.index : -1;

    // Step 6: Clean explanation separately, once
    const correctOptText = correctIndex >= 0 ? optionsList[correctIndex]?.text : undefined;
    const cleanExplanation = cleanExplanationText(rawExplanation, resolvedLabel, correctOptText);

    // Initial question stem construction
    let rawQuestionStem = stemLines.join("\n").trim();
    // Strip leading Q number from stem: "Q1. ", "प्रश्न 1. ", "1. " (requires explicit delimiter so years like 2023 are preserved)
    const qNumMatch = rawQuestionStem.match(/^(?:(?:Q(?:uestion)?|प्रश्न|प्र)\s*[-.:]?\s*(\d+)[\.\:\-\)]?\s*|(?:\((\d+)\)|(\d{1,3})[\.\:\-\)])\s*)/i);
    const qNum = qNumMatch ? parseInt(qNumMatch[1] || qNumMatch[2] || qNumMatch[3], 10) : undefined;
    if (qNumMatch) {
      rawQuestionStem = rawQuestionStem.replace(/^(?:(?:Q(?:uestion)?|प्रश्न|प्र)\s*[-.:]?\s*\d+[\.\:\-\)]?\s*|(?:\(\d+\)|\d{1,3}[\.\:\-\)])\s*)/i, "").trim();
    }

    // Step 7: Deduplication pass across all fields
    const deduplicated = deduplicateExtractedFields({
      question: rawQuestionStem,
      statements: extractedStatements.length > 0 ? extractedStatements : undefined,
      instruction: extractedInstruction,
      assertion: extractedAssertion,
      reason: extractedReason,
      sequenceItems: sequenceItems.length > 0 ? sequenceItems : undefined,
      list1: list1.length > 0 ? list1 : undefined,
      list2: list2.length > 0 ? list2 : undefined,
      options: optionsList,
      explanation: cleanExplanation,
    });

    // Validation pass
    const finalSeqItems = deduplicated.sequenceItems || (sequenceItems.length > 0 ? sequenceItems : undefined);
    const finalInstruction = deduplicated.instruction || (extractedInstruction ? cleanInstructionText(extractedInstruction) : undefined);
    const validation = validateDraftQuestion({
      question: deduplicated.question,
      text: deduplicated.question,
      type: detectedType,
      options: deduplicated.options,
      correctIndex,
      answer: resolvedLabel,
      assertion: deduplicated.assertion,
      reason: deduplicated.reason,
      statements: deduplicated.statements,
      instruction: finalInstruction,
      sequenceItems: finalSeqItems,
      tableData: extractedTableData,
    });

    const parsedDraft: ParsedQuestionDraft = {
      tempId: `draft-text-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 6)}`,
      id: `draft-text-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 8)}`,
      chapterId,
      topicId,
      text: formatMathAndChemistryLatex(deduplicated.question),
      question: formatMathAndChemistryLatex(deduplicated.question),
      type: detectedType,
      questionType: detectedType,
      isNegative,
      rawInput: block,
      options: [
        formatMathAndChemistryLatex(deduplicated.options[0].text),
        formatMathAndChemistryLatex(deduplicated.options[1].text),
        formatMathAndChemistryLatex(deduplicated.options[2].text),
        formatMathAndChemistryLatex(deduplicated.options[3].text),
      ],
      parsedOptions: deduplicated.options.map((o) => ({
        ...o,
        text: formatMathAndChemistryLatex(o.text),
      })),
      correctIndex,
      answer: resolvedLabel,
      rawAnswerStr: rawAnswerCaptured,
      explanation: formatMathAndChemistryLatex(deduplicated.explanation),
      importantFact: importantFact ? formatMathAndChemistryLatex(importantFact) : undefined,
      difficulty: "medium",
      createdAt: new Date().toISOString(),
      isValid: validation.isValid,
      errors: validation.errors,
      needsReview: !validation.isValid,
      reviewReason: validation.reviewReason,
      questionNumber: qNum || idx + 1,
      assertion: deduplicated.assertion,
      reason: deduplicated.reason,
      statements: deduplicated.statements,
      instruction: finalInstruction,
      list1: list1.length > 0 ? list1 : undefined,
      list2: list2.length > 0 ? list2 : undefined,
      matchData: list1.length > 0 || list2.length > 0 ? { listI: list1, listII: list2 } : undefined,
      sequenceItems: finalSeqItems,
      tableData: extractedTableData,
      passage: extractedPassage,
    };

    return parsedDraft;
  });
}

// ─────────────────────────────────────────────────────────────
// JSON & CSV PARSERS
// ─────────────────────────────────────────────────────────────

export function parseJSONQuestions(
  jsonString: string,
  chapterId: string,
  topicId: string
): ParsedQuestionDraft[] {
  try {
    const raw = JSON.parse(jsonString);
    const items = Array.isArray(raw) ? raw : (raw.questions || raw.mcqs || raw.items || []);

    const answerLabels = ["A", "B", "C", "D", "E", "F", "G", "H"];

    return items.map((item: any, idx: number) => {
      let qText = String(item.question || item.text || item.title || "").trim();
      let rawImg = item.image || item.diagram || item.figure || item.imageUrl;
      let imgDesc = "";
      if (rawImg) {
        if (typeof rawImg === "object" && rawImg !== null) {
          imgDesc = String(rawImg.alt || rawImg.description || rawImg.text || rawImg.url || rawImg.caption || rawImg.svg || "").trim();
          if (rawImg.svg) {
            rawImg = {
              ...rawImg,
              svg: sanitizeSvgContent(rawImg.svg),
            };
          }
        } else if (typeof rawImg === "string" && rawImg.includes("<svg")) {
          rawImg = { type: "svg", svg: sanitizeSvgContent(rawImg) };
          imgDesc = "Diagram";
        } else {
          imgDesc = String(rawImg).trim();
        }
      }
      if (imgDesc && !qText.includes("[diagram:") && !qText.includes("[image:") && !qText.includes("[चित्र:")) {
        qText = `${qText}\n\n[diagram: ${imgDesc}]`;
      }
      const text = qText;
      
      let rawOptions: string[] = [];
      if (Array.isArray(item.options)) {
        rawOptions = item.options.map((o: any) => String(o !== undefined && o !== null ? o : ""));
      } else if (item.options && typeof item.options === "object") {
        rawOptions = Object.keys(item.options).map((k) => String(item.options[k] || ""));
      } else {
        const opts = [
          item.optionA || item.option1 || "",
          item.optionB || item.option2 || "",
          item.optionC || item.option3 || "",
          item.optionD || item.option4 || "",
          item.optionE || item.option5 || "",
        ].filter(Boolean);
        rawOptions = opts;
      }

      if (rawOptions.length === 0) {
        rawOptions = ["", "", "", ""];
      }

      const options = rawOptions;
      const rawAnsStr = String(item.answer !== undefined ? item.answer : (item.correctAnswer !== undefined ? item.correctAnswer : (item.correctIndex !== undefined ? item.correctIndex : "")));
      const resolved = resolveAnswerToOption(rawAnsStr, options);
      const correctIndex = resolved.resolved ? resolved.index : normalizeCorrectAnswer(rawAnsStr, options.length, options);
      const answer = resolved.resolved ? resolved.label : (correctIndex >= 0 ? answerLabels[correctIndex] || String(correctIndex + 1) : "");

      const detected = detectBlockQuestionType(text + "\n" + options.join("\n"));
      const qType = item.type || item.questionType || detected.type;

      const parsedOptions = options.map((optText, i) => ({
        label: answerLabels[i] || String(i + 1),
        text: optText,
      }));

      const rawTable = item.table || item.tableData;
      let table: { caption?: string; headers: string[]; rows: string[][] } | undefined = undefined;
      if (rawTable && typeof rawTable === "object" && !Array.isArray(rawTable)) {
        const headers = Array.isArray(rawTable.headers) ? rawTable.headers.map((h: any) => String(h ?? "")) : [];
        let rows: string[][] = [];
        if (Array.isArray(rawTable.rows)) {
          rows = rawTable.rows.map((r: any) => {
            if (Array.isArray(r)) {
              return r.map((c: any) => String(c ?? ""));
            } else if (r && typeof r === "object" && Array.isArray(r.cells)) {
              return r.cells.map((c: any) => String(c ?? ""));
            }
            return [];
          });
        }
        table = {
          caption: rawTable.caption !== undefined && rawTable.caption !== null ? String(rawTable.caption) : undefined,
          headers,
          rows,
        };
      }

      const validation = validateDraftQuestion({
        text,
        question: text,
        type: qType,
        options,
        correctIndex,
        answer,
        assertion: item.assertion,
        reason: item.reason,
        statements: item.statements,
        instruction: item.instruction,
        sequenceItems: item.sequenceItems,
        table: rawTable,
        tableData: rawTable,
      } as any);

      const imageUrl = typeof rawImg === "string" && !rawImg.includes("<svg") ? rawImg : (rawImg && typeof rawImg === "object" && !rawImg.svg ? rawImg.url || rawImg.dataUrl : undefined);

      return {
        tempId: `draft-json-${Date.now()}-${idx}`,
        id: `draft-json-${Date.now()}-${idx}`,
        chapterId,
        topicId,
        text,
        question: text,
        type: qType,
        questionType: qType,
        isNegative: detected.isNegative,
        options,
        parsedOptions,
        correctIndex,
        answer,
        explanation: item.explanation || "",
        importantFact: item.importantFact || "",
        difficulty: item.difficulty || "medium",
        createdAt: new Date().toISOString(),
        isValid: validation.isValid,
        errors: validation.errors,
        needsReview: !validation.isValid,
        reviewReason: validation.reviewReason,
        assertion: item.assertion,
        reason: item.reason,
        statements: item.statements,
        instruction: item.instruction,
        sequenceItems: item.sequenceItems,
        matchData: item.matchData,
        table,
        tableData: table,
        image: rawImg,
        imageUrl,
        subject: item.subject ? String(item.subject) : undefined,
        chapter: item.chapter ? String(item.chapter) : undefined,
        topic: item.topic ? String(item.topic) : undefined,
        year: item.year ? String(item.year) : undefined,
        exam: item.exam ? String(item.exam) : undefined,
      };
    });
  } catch (e) {
    throw new Error("Invalid JSON format. Please check your syntax.");
  }
}

export function parseCSVQuestions(
  csvString: string,
  chapterId: string,
  topicId: string
): ParsedQuestionDraft[] {
  const lines = csvString.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];

  return lines.slice(1).map((line, idx) => {
    const parts = line.split(",").map((p) => p.trim().replace(/^"|"$/g, ""));
    const text = formatMathAndChemistryLatex(parts[0] || "");
    const options: [string, string, string, string] = [
      formatMathAndChemistryLatex(parts[1] || ""),
      formatMathAndChemistryLatex(parts[2] || ""),
      formatMathAndChemistryLatex(parts[3] || ""),
      formatMathAndChemistryLatex(parts[4] || ""),
    ];
    const rawAns = parts[5] || "";
    const resolved = resolveAnswerToOption(rawAns, options);
    const correctIndex = resolved.resolved ? resolved.index : normalizeCorrectAnswer(rawAns, 4, options);
    const answer = resolved.resolved ? resolved.label : (correctIndex >= 0 ? ["A", "B", "C", "D"][correctIndex] : "");

    const detected = detectBlockQuestionType(text + "\n" + options.join("\n"));
    const qType = detected.type;

    const validation = validateDraftQuestion({
      text,
      question: text,
      type: qType,
      options,
      correctIndex,
      answer,
    });

    return {
      tempId: `draft-csv-${Date.now()}-${idx}`,
      id: `draft-csv-${Date.now()}-${idx}`,
      chapterId,
      topicId,
      text,
      question: text,
      type: qType,
      questionType: qType,
      isNegative: detected.isNegative,
      options,
      parsedOptions: [
        { label: "A", text: options[0] },
        { label: "B", text: options[1] },
        { label: "C", text: options[2] },
        { label: "D", text: options[3] },
      ],
      correctIndex,
      answer,
      explanation: parts[6] || "",
      difficulty: "medium",
      createdAt: new Date().toISOString(),
      isValid: validation.isValid,
      errors: validation.errors,
      needsReview: !validation.isValid,
      reviewReason: validation.reviewReason,
    };
  });
}

export function formatQuestionStructure(text: string): string {
  return text;
}
