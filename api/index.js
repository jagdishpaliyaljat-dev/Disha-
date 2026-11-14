// server.ts
import fs3 from "fs";
import path3 from "path";
import express from "express";
import { GoogleGenAI } from "@google/genai";

// src/utils/questionsParser.ts
function formatMathAndChemistryLatex(text) {
  if (!text) return "";
  let s = String(text);
  const mathBlocks = [];
  s = s.replace(/(\$\$[\s\S]+?\$\$|\\\[[\s\S]+?\\\]|\\\([\s\S]+?\\\)|\$[^$\n]+?\$)/g, (match) => {
    mathBlocks.push(match);
    return `##MBK${mathBlocks.length - 1}##`;
  });
  s = s.replace(/\\{2,}([a-zA-Z\{\}\[\]\^\_\+\-\*\/\(\)\:\;\,\.\<\>\=])/g, "\\$1");
  s = s.replace(/\\xrightarrow\s*(?:\[[^\]]*\])?\s*\{([^\}]*)\}/g, (_, over) => {
    return over.trim() ? `\u2014(${over})\u2192` : "\u2192";
  });
  s = s.replace(/\\(?:longrightarrow|rightarrow|to)\b/g, "\u2192");
  s = s.replace(/\\(?:longleftarrow|leftarrow)\b/g, "\u2190");
  s = s.replace(/\\(?:rightleftharpoons|leftrightarrow)\b/g, "\u21CC");
  s = s.replace(/\\uparrow\b/g, "\u2191");
  s = s.replace(/\\downarrow\b/g, "\u2193");
  s = s.replace(/\\times\b/g, "\xD7");
  s = s.replace(/\\div\b/g, "\xF7");
  s = s.replace(/\\pm\b/g, "\xB1");
  s = s.replace(/\\mp\b/g, "\u2213");
  s = s.replace(/\\(?:leq|le)\b/g, "\u2264");
  s = s.replace(/\\(?:geq|ge)\b/g, "\u2265");
  s = s.replace(/\\(?:neq|ne)\b/g, "\u2260");
  s = s.replace(/\\approx\b/g, "\u2248");
  s = s.replace(/\\equiv\b/g, "\u2261");
  s = s.replace(/\\infty\b/g, "\u221E");
  s = s.replace(/\\cdot\b/g, "\xB7");
  s = s.replace(/\\degree\b|\^\\circ\b/g, "\xB0");
  s = s.replace(/\\Delta\b/g, "\u0394");
  s = s.replace(/\\alpha\b/g, "\u03B1");
  s = s.replace(/\\beta\b/g, "\u03B2");
  s = s.replace(/\\gamma\b/g, "\u03B3");
  s = s.replace(/\\theta\b/g, "\u03B8");
  s = s.replace(/\\lambda\b/g, "\u03BB");
  s = s.replace(/\\mu\b/g, "\u03BC");
  s = s.replace(/\\pi\b/g, "\u03C0");
  s = s.replace(/\\sigma\b/g, "\u03C3");
  s = s.replace(/\\omega\b/g, "\u03C9");
  s = s.replace(/\\Omega\b/g, "\u03A9");
  s = s.replace(/\\frac\s*\{([^\}]+)\}\s*\{([^\}]+)\}/g, "($1)/($2)");
  s = s.replace(/\\sqrt\s*\{([^\}]+)\}/g, "\u221A($1)");
  const subMap = {
    "0": "\u2080",
    "1": "\u2081",
    "2": "\u2082",
    "3": "\u2083",
    "4": "\u2084",
    "5": "\u2085",
    "6": "\u2086",
    "7": "\u2087",
    "8": "\u2088",
    "9": "\u2089",
    "+": "\u208A",
    "-": "\u208B",
    "=": "\u208C",
    "(": "\u208D",
    ")": "\u208E",
    "a": "\u2090",
    "e": "\u2091",
    "h": "\u2095",
    "i": "\u1D62",
    "j": "\u2C7C",
    "k": "\u2096",
    "l": "\u2097",
    "m": "\u2098",
    "n": "\u2099",
    "o": "\u2092",
    "p": "\u209A",
    "r": "\u1D63",
    "s": "\u209B",
    "t": "\u209C",
    "u": "\u1D64",
    "v": "\u1D65",
    "x": "\u2093"
  };
  const supMap = {
    "0": "\u2070",
    "1": "\xB9",
    "2": "\xB2",
    "3": "\xB3",
    "4": "\u2074",
    "5": "\u2075",
    "6": "\u2076",
    "7": "\u2077",
    "8": "\u2078",
    "9": "\u2079",
    "+": "\u207A",
    "-": "\u207B",
    "=": "\u207C",
    "(": "\u207D",
    ")": "\u207E",
    "n": "\u207F",
    "i": "\u2071"
  };
  s = s.replace(/_\{([0-9a-zA-Z\+\-\(\)]+)\}/g, (_, chars) => {
    if (chars === "(s)" || chars === "(l)" || chars === "(g)" || chars === "(aq)") return "(" + chars.slice(1, -1) + ")";
    return chars.split("").map((c) => subMap[c] || c).join("");
  });
  s = s.replace(/_([0-9])/g, (_, d) => subMap[d] || d);
  s = s.replace(/\^\{([0-9a-zA-Z\+\-\(\)]+)\}/g, (_, chars) => {
    return chars.split("").map((c) => supMap[c] || c).join("");
  });
  s = s.replace(/\^([0-9])/g, (_, d) => supMap[d] || d);
  s = s.replace(/\\(?:text|mathrm|mathbf|mathit)\s*\{([^\}]*)\}/g, "$1");
  s = s.replace(/\\(?:quad|qquad|\,|\;|\:|\s)/g, " ");
  s = s.replace(/\s*([→←⇌])\s*/g, " $1 ");
  s = s.replace(/\s*([+])\s*/g, " + ");
  s = s.replace(/[ \t]{2,}/g, " ");
  s = s.replace(/\\([a-zA-Z0-9\+\-\=×÷→←⇌])/g, "$1");
  s = s.replace(/\\+\s+/g, " ");
  s = s.split(/##MBK(\d+)##/g).map((part, i) => {
    if (i % 2 === 1) {
      return mathBlocks[+part];
    }
    return part;
  }).join("");
  return s.trim();
}

// src/lib/mcqImport/examDetector.ts
var DEVANAGARI_DIGITS = {
  "\u0966": "0",
  "\u0967": "1",
  "\u0968": "2",
  "\u0969": "3",
  "\u096A": "4",
  "\u096B": "5",
  "\u096C": "6",
  "\u096D": "7",
  "\u096E": "8",
  "\u096F": "9"
};
function toAsciiYear(str) {
  if (str === void 0 || str === null) return "";
  const s = String(str).replace(/[०-९]/g, (d) => DEVANAGARI_DIGITS[d] ?? d);
  const match = s.match(/\b(19\d{2}|20\d{2})\b/);
  return match ? match[1] : s.trim();
}
function cleanExamName(name) {
  if (!name) return "";
  return name.replace(/^(?:EXAM|EXAMINATION|PAPER|परीक्षा|प्रतियोगी\s*परीक्षा)\s*[:.\-–]?\s*/i, "").replace(/\s+/g, " ").trim();
}
function normalizeExamHistory(rawList) {
  if (!Array.isArray(rawList) || rawList.length === 0) return [];
  const seen = /* @__PURE__ */ new Set();
  const normalized = [];
  for (const item of rawList) {
    if (!item) continue;
    let examName = "";
    let year;
    let verified = true;
    let shift;
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
      if (rawYear !== void 0 && rawYear !== null && String(rawYear).trim() !== "") {
        const ascii = toAsciiYear(rawYear);
        year = /^\d{4}$/.test(ascii) ? parseInt(ascii, 10) : ascii;
      }
      if (item.verified !== void 0) {
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
        ...year ? { year } : {},
        verified,
        ...shift ? { shift } : {}
      });
    }
  }
  return normalized;
}
function parseSingleExamString(str) {
  const trimmed = str.trim();
  if (!trimmed) return null;
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
        ...shift ? { shift: shift.trim() } : {}
      };
    }
  }
  const bracketMatch = ascii.match(/^\[([^\]]+)\]$/);
  if (bracketMatch) {
    return parseSingleExamString(bracketMatch[1]);
  }
  const cleaned = cleanExamName(trimmed);
  return cleaned ? { examName: cleaned, verified: true } : null;
}

// src/utils/questionParser.ts
var HDIGIT = {
  "\u0966": 0,
  "\u0967": 1,
  "\u0968": 2,
  "\u0969": 3,
  "\u096A": 4,
  "\u096B": 5,
  "\u096C": 6,
  "\u096D": 7,
  "\u096E": 8,
  "\u096F": 9
};
var FAMILIES_4 = [
  { keys: ["A", "B", "C", "D"], bare: true },
  { keys: ["a", "b", "c", "d"], bare: false },
  { keys: ["1", "2", "3", "4"], bare: false },
  { keys: ["\u0915", "\u0916", "\u0917", "\u0918"], bare: false },
  { keys: ["\u0905", "\u092C", "\u0938", "\u0926"], bare: false },
  { keys: ["i", "ii", "iii", "iv"], bare: false }
];
var FAMILIES_2 = [
  { keys: ["A", "B"], bare: false },
  { keys: ["a", "b"], bare: false },
  { keys: ["1", "2"], bare: false },
  { keys: ["\u0915", "\u0916"], bare: false },
  { keys: ["\u0905", "\u092C"], bare: false }
];
var markerRe = (k, bare) => {
  const isDigit = /^[0-9०-९]$/.test(k);
  if (k === "+" || k === "-" || k === "\u2212") {
    return new RegExp(`^(?:[\\s]*)(?:(?:\\(${k}\\)|${k}[.):\\-])${bare ? `|${k}\\s+(?![0-9A-Z\\[\\{])` : ""})\\s*(.*)$`, "i");
  }
  const lookahead = isDigit ? "(?![0-9\u0966-\u096F])" : "";
  return new RegExp(`^(?:[*\u2713\u2714\u2022\u27A4\\s]*)(?:(?:\\(${k}\\)|${k}${lookahead}[.):\\-])${bare ? `|${k}${lookahead}\\s+` : ""})\\s*(.*)$`, "i");
};
function replaceHindiDigitsOutsideLatex(text) {
  if (!text) return "";
  const mathRegex = /(\$\$[\s\S]+?\$\$|\\\[[\s\S]+?\\\]|\\\([\s\S]+?\\\)|(?:\$(?!\$)[^$\n]+?\$))/g;
  let lastIdx = 0;
  let match;
  let res = "";
  while ((match = mathRegex.exec(text)) !== null) {
    const nonMath = text.slice(lastIdx, match.index);
    res += nonMath.replace(/[०-९]/g, (d) => String(HDIGIT[d]));
    res += match[0];
    lastIdx = match.index + match[0].length;
  }
  res += text.slice(lastIdx).replace(/[०-९]/g, (d) => String(HDIGIT[d]));
  return res;
}
function normalize(t) {
  if (!t) return "";
  let s = t.replace(/\r\n?/g, "\n").replace(/[\u200b\u200c\u200d\ufeff]/g, "");
  s = replaceHindiDigitsOutsideLatex(s).replace(/\u0441\u0435/g, "\u0938\u0947").replace(/\u0441/g, "c").replace(/\u0435/g, "e").replace(/^[•➤▶]\s*/gm, "").replace(/^\s*—?\s*(?:PAGE|Page|पृष्ठ)\s*\d+\s*—?\s*$/gim, "").replace(/\s*—\s*Page\s*\d+\s*—[^\n]*/gi, "").replace(/\s*Questions?\s*Generated\s*:\s*\d+[^\n]*/gi, "").replace(/\s*Progress\s*:[^\n]*/gi, "").replace(/\s*Type\s+NEXT[^\n]*/gi, "").replace(/\s*\bPAGE\s*\d+\s*(?:COMPLETED|DONE|END)\b[^\n]*/gi, "").replace(/(?:^|[\s।\n])(?:PAGE|पृष्ठ)\s*\d+\s*(?:COMPLETED|DONE|END|समाप्त)[^\n]*/gi, "").replace(/^\s*(?:PAGE|पृष्ठ)\s*\d+\s*$/gim, "");
  s = formatMathAndChemistryLatex(s);
  s = s.replace(/\n\s*(\([a-zA-Z]\s*=\s*[\d.x\^\\\{\}\s\/-]+\w*\/[\w\^]+\))/g, " $1");
  return s;
}
function extractAskLine(stem) {
  const askRegex = /(?:^|[\n।.]|\s{2,}|\s+)((\b(?:Which\s+of\s+the\s+(?:above|following|statements?))|(?:उपर्युक्त|उपरोक्त|निम्नलिखित\s+में\s+से\s+कौन))[\s\S]*?(?:\?|[:।\n]|$))\s*$/i;
  const match = stem.match(askRegex);
  if (match && match[1]) {
    const askCandidate = match[1].trim();
    if (askCandidate.endsWith("?") || askCandidate.endsWith(":") || /सही\s*(?:है|हैं)|सत्य|गलत|असत्य|correct|true|false|not\s+correct|उपयुक्त|चुनें|चुनिए/i.test(askCandidate)) {
      const idx = stem.lastIndexOf(askCandidate);
      if (idx > 0) {
        let cleanStem = stem.substring(0, idx).trim();
        cleanStem = cleanStem.replace(/[ \t]+$/, "");
        return { cleanStem, askLine: askCandidate };
      }
    }
  }
  return { cleanStem: stem };
}
var statementMarkerRegex = /^(?:(?:कथन|Statement)\s*(?:\(?\s*([0-9]+|[IVXLCDMivxlcdm]+|[क-घa-d])\s*\)?)\s*[:.\-–]?|(?:\(?\s*([0-9]+|[IVXLCDMivxlcdm]+|[क-घa-d])\s*\)|([0-9]+|[IVXLCDMivxlcdm]+)\s*[\.:\-–]))\s*(.*)$/i;
function extractStatements(cleanStem) {
  if (!cleanStem) return void 0;
  const lines = cleanStem.split("\n").map((l) => l.trim()).filter(Boolean);
  const rawStatements = [];
  const introLines = [];
  let foundStatement1 = false;
  let foundStatement2 = false;
  let currentStatement = null;
  let extractedAskLine = void 0;
  let pastBullets = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.includes("|") || /^(?:अभिकथन|Assertion|कारण|Reason|स्पष्टीकरण|\(A\)|\(R\))/i.test(line)) {
      introLines.push(line);
      continue;
    }
    const isChemOrMathStart = /^[-+−]\s*(?:\d|[a-zA-Z]|\\[a-zA-Z]+|\().*?(=|\+|-|−|\*|\/|<|>|\\leq|\\geq|\\times|\\div|->|=>|→|⇌)/.test(line) || /^[-+−]\s*\d+(?:\.\d+)?(?:\s*[a-zA-Z\/·^]+)*(?:\s|$)/.test(line);
    const isBullet = /^\*\s+/.test(line) && !/^\*{2}/.test(line) || /^•\s+/.test(line) || /^[-+−]\s+/.test(line) && !isChemOrMathStart;
    if (isBullet) {
      pastBullets = true;
      if (currentStatement) {
        rawStatements.push(currentStatement);
        currentStatement = null;
      }
      const bulletContent = line.replace(/^(?:\*|-|•)\s+/, "").trim();
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
      currentStatement = isThirdStmt ? `\u0915\u0925\u0928 3: ${line}` : line;
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
            currentStatement += " " + stmtPart;
          } else {
            const nextNo = rawStatements.length + 1;
            currentStatement = `\u0915\u0925\u0928 ${nextNo}: ${stmtPart}`;
          }
        }
        if (currentStatement) {
          rawStatements.push(currentStatement);
          currentStatement = null;
        }
        extractedAskLine = askPart;
      } else if (line.startsWith("\u0909\u092A\u0930\u094D\u092F\u0941\u0915\u094D\u0924") || line.startsWith("\u0909\u092A\u0930\u094B\u0915\u094D\u0924") || line.startsWith("\u0928\u093F\u092E\u094D\u0928\u0932\u093F\u0916\u093F\u0924") || /Which\s+of\s+the/i.test(line) || /कथन\s*सही/i.test(line) || line.endsWith("?") || line.endsWith(":")) {
        if (currentStatement) {
          rawStatements.push(currentStatement);
          currentStatement = null;
        }
        extractedAskLine = line;
      } else if (currentStatement) {
        currentStatement += " " + line;
      }
    } else if (foundStatement1 && foundStatement2 && !currentStatement?.endsWith("\u0914\u0930") && !currentStatement?.endsWith(",")) {
      if (currentStatement) {
        rawStatements.push(currentStatement);
        currentStatement = null;
      }
      const nextNo = rawStatements.length + 1;
      currentStatement = `\u0915\u0925\u0928 ${nextNo}: ${line}`;
    } else if (currentStatement) {
      currentStatement += " " + line;
    } else {
      introLines.push(line);
    }
  }
  if (currentStatement) {
    rawStatements.push(currentStatement);
  }
  if (rawStatements.length >= 2) {
    const res = rawStatements;
    if (extractedAskLine) {
      res.askLine = extractedAskLine;
    }
    if (introLines.length > 0) {
      res.cleanStem = introLines.join("\n").trim();
    }
    return res;
  }
  return void 0;
}
function extractMatchTable(stem) {
  if (!stem) return void 0;
  const lines = stem.split("\n").map((l) => l.trim()).filter(Boolean);
  const hasTableSeparator = lines.some((l) => /^\|?[\s\-:]+\|[\s\-:]+\|?$/.test(l) || /^[-:\s|]{3,}$/.test(l));
  const pipeLines = lines.filter((l) => {
    if (!l.includes("|")) return false;
    if (/^\s*\|[^|]+\|\s*(?:<|>|=|<=|>=|\+|-|\*|\/|\\le|\\ge|\\ne)?/i.test(l) && !hasTableSeparator && !/सूची|List|Column|स्तम्भ|खण्ड|Table|Chart|Graph/i.test(l)) {
      return false;
    }
    return true;
  });
  if (pipeLines.length < 2 && !hasTableSeparator) return void 0;
  let leftTitle = "\u0938\u0942\u091A\u0940-I";
  let rightTitle = "\u0938\u0942\u091A\u0940-II";
  const rows = [];
  let isFirstRow = true;
  pipeLines.forEach((line) => {
    const cleanLine = line.replace(/^\|+/, "").replace(/\|+$/, "").trim();
    if (!cleanLine || /^[\s|\-:]+$/.test(line) || /^[-:\s]+$/.test(cleanLine)) {
      return;
    }
    const parts = cleanLine.split("|").map((p) => p.trim());
    if (parts.length >= 2) {
      const p0 = parts[0];
      const p1 = parts[1];
      const isHeaderKeyword = /^(?:सूची-?|List-?|Column-?|स्तम्भ|खण्ड|Table|अभयारण्य|विषय|जिला|राज्य)\s*[I1A]?$/i.test(p0) || /सूची|List|Column|स्तम्भ|खण्ड|अभयारण्य|विषय|जिला|राज्य/i.test(p0) && /सूची|List|Column|स्तम्भ|खण्ड|जीव|वर्ष|विवरण|वन्यजीव/i.test(p1) && !/\d+/.test(p0);
      if (isFirstRow || isHeaderKeyword) {
        if (isHeaderKeyword || !/\d+/.test(p0)) {
          leftTitle = p0;
          rightTitle = p1;
          isFirstRow = false;
          return;
        }
      }
      isFirstRow = false;
      const leftClean = p0.replace(/^(?:\(?\s*(?:[0-9]+|[a-dA-D1-4क-घ]|I{1,3}|IV|VI{0,3})\s*\)?[\.:\-–]?)\s*/i, "").trim();
      const rightClean = p1.replace(/^(?:\(?\s*(?:[0-9]+|[a-dA-D1-4क-घ]|i{1,3}|iv|vi{0,3}|[क-घ])\s*\)?[\.:\-–]?)\s*/i, "").trim();
      rows.push({ left: leftClean || p0, right: rightClean || p1 });
    }
  });
  if (rows.length === 0) return void 0;
  const introLines = lines.filter((l) => !l.includes("|")).map((l) => l.replace(/^\s*(?:Q\.?|प्रश्न|Question|Que\.?)\s*\(?\d*[.):]?\s*/i, "").replace(/^[:.\-–]\s*/, "").trim()).filter(Boolean);
  let cleanStem = introLines.join("\n").trim();
  if (!cleanStem) {
    cleanStem = stem.split("\n")[0].replace(/^\s*(?:Q\.?|प्रश्न|Question|Que\.?)\s*\(?\d*[.):]?\s*/i, "").replace(/^[:.\-–]\s*/, "").trim();
  }
  return { leftTitle, rightTitle, rows, cleanStem };
}
function extractAssertionReason(stem) {
  if (!stem) return void 0;
  const lines = stem.split("\n").map((l) => l.trim()).filter(Boolean);
  let assertion = void 0;
  let reason = void 0;
  const introLines = [];
  let askLine = void 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const assertMatch = line.match(/^(?:अभिकथन|Assertion|कथन\s*\(?A\)?)\s*\(?A\)?\s*[:.\-–]\s*(.+)$/i) || line.match(/^\(A\)\s*[:.\-–]\s*(.+)$/i);
    const reasonMatch = line.match(/^(?:कारण|Reason|स्पष्टीकरण|कथन\s*\(?R\)?)\s*\(?R\)?\s*[:.\-–]\s*(.+)$/i) || line.match(/^\(R\)\s*[:.\-–]\s*(.+)$/i);
    if (assertMatch) {
      assertion = assertMatch[1].trim();
    } else if (reasonMatch) {
      reason = reasonMatch[1].trim();
    } else {
      if (/उपर्युक्त|उपरोक्त|निम्नलिखित|Which\s+of\s+the|सबसे\s+उपयुक्त|चुनें/i.test(line) || line.endsWith("?")) {
        askLine = line;
      } else if (!assertion && !reason) {
        introLines.push(line);
      } else if (assertion && !reason) {
        assertion += " " + line;
      } else if (reason) {
        reason += " " + line;
      }
    }
  }
  if (assertion && reason) {
    const cleanStem = introLines.join("\n").trim() || "\u0928\u0940\u091A\u0947 \u0926\u094B \u0915\u0925\u0928 \u0926\u093F\u090F \u0917\u090F \u0939\u0948\u0902, \u090F\u0915 \u0915\u094B \u0905\u092D\u093F\u0915\u0925\u0928 (A) \u0914\u0930 \u0926\u0942\u0938\u0930\u0947 \u0915\u094B \u0915\u093E\u0930\u0923 (R) \u0915\u0947 \u0930\u0942\u092A \u092E\u0947\u0902 \u0928\u093E\u092E\u093E\u0902\u0915\u093F\u0924 \u0915\u093F\u092F\u093E \u0917\u092F\u093E \u0939\u0948\u0964";
    return {
      assertion,
      reason,
      cleanStem,
      askLine: askLine || "\u0909\u092A\u0930\u094D\u092F\u0941\u0915\u094D\u0924 \u0915\u0925\u0928\u094B\u0902 \u0915\u0947 \u0906\u0932\u094B\u0915 \u092E\u0947\u0902, \u0938\u092C\u0938\u0947 \u0909\u092A\u092F\u0941\u0915\u094D\u0924 \u0909\u0924\u094D\u0924\u0930 \u091A\u0941\u0928\u0947\u0902 :"
    };
  }
  return void 0;
}
function extractAnswerKey(text) {
  const at = text.search(/(?:answer\s*key|उत्तरमाला|उत्तर\s*कुंजी|उत्तर\s*तालिका)/i);
  if (at < 0) return { body: text, key: {} };
  const key = {};
  for (const m of text.slice(at).matchAll(/(\d+)\s*[-–:.)]\s*\(?([A-Da-d1-4क-घअ-द])\)?/g)) {
    key[+m[1]] = m[2].toUpperCase();
  }
  return { body: text.slice(0, at), key };
}
function splitBlocks(body) {
  const lines = body.split("\n");
  const qPref = /^\s*(?:Q\.?|प्रश्न|Question|Que\.?)\s*(?:\(?(\d+)[.):]?|[:\-–])\s*/i;
  const hasQPref = lines.some((l) => qPref.test(l));
  const blocks = [];
  blocks.meta = {};
  let cur = null, last = 0;
  let activePassage = null;
  const passageIntroRe = /^\s*(?:गद्यांश|पद्यांश|passage|directions?|निर्देश|read the following)/i;
  const bufferBeforeFirstQ = [];
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    const trimmed = l.trim();
    if (!trimmed) {
      if (cur) cur.push(l);
      continue;
    }
    if (/^SUBJECT\s*:/i.test(trimmed)) {
      if (cur) cur.push(trimmed);
      else blocks.meta.subject = trimmed.replace(/^SUBJECT\s*:/i, "").trim();
      continue;
    }
    if (/^EXAM\s*:/i.test(trimmed)) {
      if (cur) cur.push(trimmed);
      else blocks.meta.exam = trimmed.replace(/^EXAM\s*:/i, "").trim();
      continue;
    }
    if (/^YEAR\s*:/i.test(trimmed)) {
      if (cur) cur.push(trimmed);
      else blocks.meta.year = trimmed.replace(/^YEAR\s*:/i, "").trim();
      continue;
    }
    if (/^CHAPTER\s*:/i.test(trimmed)) {
      if (cur) cur.push(trimmed);
      else blocks.meta.chapter = trimmed.replace(/^CHAPTER\s*:/i, "").trim();
      continue;
    }
    if (/^TOPIC\s*:/i.test(trimmed)) {
      if (cur) cur.push(trimmed);
      else blocks.meta.topic = trimmed.replace(/^TOPIC\s*:/i, "").trim();
      continue;
    }
    if (passageIntroRe.test(trimmed)) {
      const pLines = [trimmed];
      i++;
      while (i < lines.length && !qPref.test(lines[i]) && !/^\s*(\d+)[.)]\s+/.test(lines[i])) {
        if (lines[i].trim()) pLines.push(lines[i].trim());
        i++;
      }
      activePassage = pLines.join("\n");
      i--;
      continue;
    }
    const isPipeLine = trimmed.includes("|");
    const m = !isPipeLine && hasQPref ? trimmed.match(qPref) : !isPipeLine ? trimmed.match(qPref) || trimmed.match(/^\s*(\d+)[.)]\s+/) : null;
    if (m) {
      const qNum = m[1] ? +m[1] : last + 1;
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
  if (blocks.length === 0 && lines.some((l) => l.trim().length > 0)) {
    const filtered = lines.filter((l) => l.trim().length > 0);
    blocks.push(filtered);
  } else if (blocks.length > 0 && bufferBeforeFirstQ.length > 0) {
    const beforeText = bufferBeforeFirstQ.join("\n");
    if (passageIntroRe.test(beforeText)) {
      blocks[0].unshift(beforeText);
    }
  }
  return blocks;
}
function extractOptions(lines, endIdx) {
  for (const f of FAMILIES_4) {
    let i = endIdx, ok = true;
    const opts = [];
    let hintIndex = -1;
    for (let kIdx = f.keys.length - 1; kIdx >= 0; kIdx--) {
      const k = f.keys[kIdx];
      const re = markerRe(k, f.bare);
      const buf = [];
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
      opts.unshift(buf.join(" ").trim());
    }
    if (ok) return { opts, stemEnd: i, family: f, hintIndex };
  }
  for (let idx = endIdx; idx >= Math.max(0, endIdx - 2); idx--) {
    const last = lines[idx] || "";
    const partsParen = last.split(/\s*\(([a-dA-D1-4क-घ])\)\s*/);
    if (partsParen.length >= 9) {
      return {
        opts: [partsParen[2], partsParen[4], partsParen[6], partsParen[8]],
        stemEnd: idx - 1,
        family: FAMILIES_4[1],
        stemTail: partsParen[0] ? "\n" + partsParen[0] : "",
        hintIndex: -1
      };
    }
    const partsDot = last.split(/(?:^|\s+)([A-Da-d1-4क-घ])[\.\:\)\-]\s+/);
    if (partsDot.length >= 9) {
      return {
        opts: [partsDot[2], partsDot[4], partsDot[6], partsDot[8]],
        stemEnd: idx - 1,
        family: FAMILIES_4[0],
        stemTail: partsDot[0] ? "\n" + partsDot[0] : "",
        hintIndex: -1
      };
    }
  }
  for (const f of FAMILIES_2) {
    let i = endIdx, ok = true;
    const opts = [];
    let hintIndex = -1;
    for (let kIdx = f.keys.length - 1; kIdx >= 0; kIdx--) {
      const k = f.keys[kIdx];
      const re = markerRe(k, f.bare);
      const buf = [];
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
      opts.unshift(buf.join(" ").trim());
    }
    if (ok) return { opts, stemEnd: i, family: f, hintIndex };
  }
  return null;
}
function parseAnswer(line, opts) {
  const t = line.replace(/^(answer|ans|correct|उत्तर|सही\s*उत्तर|right\s*option)\s*[:\-–]?\s*/i, "").trim();
  const m = t.match(/^(?:option\s*)?\(?([A-Da-d1-4क-घअ-द])\)?(?:\s*[\.:\-–]|\s+|$)/i);
  if (m) {
    const all = "ABCDabcd1234\u0915\u0916\u0917\u0918\u0905\u092C\u0938\u0926";
    const idx = all.indexOf(m[1]) % 4;
    if (idx >= 0) return idx;
  }
  const norm = (s) => s.toLowerCase().replace(/[\s\p{P}\p{S}]/gu, "");
  const targetNorm = norm(t);
  if (targetNorm.length > 0) {
    const byText = opts.findIndex((o) => {
      const oNorm = norm(o);
      return oNorm === targetNorm || oNorm.length >= 3 && targetNorm.includes(oNorm) || targetNorm.length >= 3 && oNorm.includes(targetNorm);
    });
    if (byText >= 0) return byText;
  }
  return -1;
}
function detectMathMeta(stem, options, explanation, matchTable) {
  const combined = `${stem}
${options.join(" ")}
${explanation}`;
  let detectedChemTopic;
  let detectedPhysTopic;
  const chemKeywords = [
    ["atomic_structure", /atomic|proton|neutron|isotope|electron|configuration|orbital|quantum|nucleus|permanu|नाभिक|इलेक्ट्रॉन|प्रोटॉन|न्यूट्रॉन|समस्थानिक|विन्यास|कक्षक|थॉमसन|रदरफोर्ड|बोर|आइसोटोप|Mg\^2\+|आवेश|परमाणु/i],
    ["periodic_table", /periodic table|halogen|noble gas|alkali|metalloid|mendeleev|modern periodic|आवर्त सारणी|हैलोजन|अक्रिय गैस|क्षार धातु|क्षारीय मृदा|उपधातु|परमाणु त्रिज्या|आयनन विभव/i],
    ["chemical_bonding", /valence|covalent|ionic|bonding|molecule|octet|resonance|hybridization|electrostati|संयोजकता|आबंध|आयनिक|सहसंयोजक|अष्टक|अनुनाद|संकरण|हीरक|ग्रेफाइट|बंधन|कुचालक/i],
    ["states_of_matter", /ideal gas|boyle's|charles|dalton|gas law|द्रव्य की अवस्थाएं|अवस्था|आदर्श गैस|पृष्ठ तनाव|वाष्प दाब/i],
    ["thermodynamics", /enthalpy|entropy|gibbs|isothermal|adiabatic|thermochem|ऊष्मागतिकी|एन्थैल्पी|एन्ट्रॉपी|ऊष्माक्षेपी|ऊष्माशोषी|ऊष्मा/i],
    ["equilibrium_ph", /equilibrium|le chatelier|buffer|pH\b|indicator|NaOH|HCl|H2SO4|HNO3|titration|साम्यावस्था|pH मान|अम्ल|क्षार|लवण|सूचक|बफर|सांद्रण|तनु/i],
    ["solutions_electrochemistry", /molarity|molality|normality|solubility|osmotic|raoult|electrolysis|faraday|galvanic|anode|cathode|मोलरता|मोललता|विलेयता|परासरण|विद्युत अपघटन|एनोड|कैथोड/i],
    ["kinetics", /catalyst|activation energy|rate law|zero order|first order|उत्प्रेरक|सक्रियण ऊर्जा|अभिक्रिया की दर/i],
    ["metals_nonmetals", /oxidation|reduction|redox|rusting|corrosion|reactivity series|displacement|ऑक्सीकरण|अपचयन|रेडॉक्स|क्षरण|जंग|संक्षारण|विस्थापन/i],
    ["metallurgy", /metallurgy|ore|gangue|flux|calcination|roasting|अयस्क|धातुकी|निक्षालन|भर्जन|सिनेबार|हेमाटाइट|बॉक्साइट/i],
    ["polymers_biomolecules", /polymer|monomer|nylon|teflon|cellulose|protein|carbohydrate|vitamin|enzyme|बहुलक|प्रोटीन|कार्बोहाइड्रेट|विटामिन|एंजाइम|सेल्युलोज/i],
    ["organic_hydrocarbons", /organic|alkane|alkene|alkyne|hydrocarbon|isomer|benzene|methane|ethane|आईयूपीएसी|IUPAC|कार्बनिक|समावयवता|मेथेन|एथेन|ब्यूटेन|एथीन|मिथेन/i],
    ["everyday_chemistry", /soap|detergent|fertilizer|alloy|brass|bronze|steel|cement|glass|साबुन|अपमार्जक|उर्वरक|मिश्रधातु|पीतल|कांसा|स्टील/i],
    ["environmental_chemistry", /pollution|greenhouse|ozone|global warming|smog|acid rain|पर्यावरण|ओजोन|प्रदूषण/i],
    ["mole_concept_stoichiometry", /mole|stoichiometry|molecular weight|molar mass|balancing|मोल संकल्पना|तत्वानुपाती|आणविक भार|संतुलन|मोलों/i],
    ["important_compounds", /compound|baking soda|washing soda|bleaching powder|plaster of paris|यौगिक|रासायनिक सूत्र|सूत्र|सोडा|क्लोराइड/i]
  ];
  const physKeywords = [
    ["modern_physics", /photoelectric|half-life|radioactivity|atomic nucleus|photon|bohr model|x-ray|आधुनिक भौतिकी|रेडियोधर्मी|नाभिकीय|प्रकाश विद्युत|फोटॉन|अर्द्ध आयु/i],
    ["electricity", /electricity|resistance|ohm|voltage|current|circuit|capacitor|resistor|kirchhoff|ammeter|voltmeter|विद्युत|धारा|प्रतिरोध|ओम|विभवांतर|परिपथ/i],
    ["magnetism_emi", /magnetism|magnetic field|flux|induction|solenoid|चुंबकत्व|चुंबकीय|प्रेरण|कुंडली/i],
    ["optics", /optics|lens|mirror|refraction|reflection|prism|telescope|microscope|focal|प्रकाशिकी|लेंस|दर्पण|अपवर्तन|परावर्तन|प्रिज्म|फोकस/i],
    ["waves_sound", /waves|sound|frequency|amplitude|wavelength|doppler|echo|तरंग|ध्वनि|आवृत्ति|आयाम|तरंगदैर्ध्य/i],
    ["units_dimensions", /dimensions|SI unit|scalar|vector|measurement|मात्रक|इकाई|विमा|विमीय|अदिश|सदिश/i],
    ["gravitation", /gravitation|gravity|kepler|universal law|गुरुत्वाकर्षण|गुरुत्व|केपलर/i],
    ["rotation_shm", /moment of inertia|SHM|pendulum|torque|angular momentum|centripetal|घूर्णन|जड़त्व आघूर्ण|सरल आवर्त गति|बलाघूर्ण/i],
    ["heat_thermodynamics", /thermodynamics|entropy|conduction|convection|radiation|latent heat|specific heat|ऊष्मागतिकी|चालन|संवहन|विकरण|विशिष्ट ऊष्मा/i],
    ["properties_of_matter", /density|viscosity|pressure|surface tension|elasticity|bernoulli|pascal|घनत्व|श्यानता|दाब|प्रत्यास्थता/i],
    ["work_energy_power", /\b(?:kinetic energy|potential energy|joule|watt)\b|\bpower\b(?!house)|\bwork\b(?!\s+(?:in|and|done|days|together))/i],
    ["laws_of_motion", /laws of motion|friction|inertia|newton|force|momentum|impulse|गति के नियम|घर्षण|जड़त्व|बल|संवेग/i],
    ["kinematics", /kinematics|velocity|acceleration|displacement|projectile|वेग|त्वरण|विस्थापन|प्रक्षेप्य|दूरी|चाल/i],
    ["instruments_scientists", /vernier|screw gauge|telescope|galvanometer|scientist|newton|einstein|raman|उपकरण|वैज्ञानिक/i],
    ["everyday_applications", /rainbow|mirage|scattering|blue sky|twinkling|इंद्रधनुष|मरीचिका|प्रकीर्णन/i]
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
  const elementPart = "(?:H[ef]?|L[ia]|B[er]?|C[alno]?|N[aeio]?|O[gs]?|F[er]?|Ne|Na|Mg|Al|Si|P[bort]?|S[bceimnr]?|Cl|Ar|K[r]?|Ca|Sc|Ti|V|Cr|Mn|Fe|Co|Ni|Cu|Zn|G[ade]|A[srtu]|Se|Br|Kr|R[bdefghu]|S[bnr]|Y[b]?|Zr|N[bd]|Mo|Tc|Ru|Rh|Pd|Ag|Cd|In|Sn|Sb|Te|I[r]?|Xe|Cs|Ba|L[aru]|Ce|Pr|Nd|Pm|Sm|Eu|Gd|Tb|Dy|Ho|Er|Tm|Lu|Hf|Ta|W|Os|Pt|Au|Hg|Tl|Bi|Po|At|Rn|Fr|Ra|Ac|Th|Pa|U|Np|Pu|Am|Cm|Bk|Cf|Es|Fm|Md|No|Rf|Db|Sg|Bh|Hs|Mt|Ds|Rg|Cn|Nh|Fl|Mc|Lv|Ts|Og)";
  const formulaMarkers = "[0-9\u2080-\u2089\\(\\)\\[\\]\\+\\-\\^\\{\\}\u207A\u207B]";
  const fullFormulaRe = new RegExp(`(?:^|\\s|[ \\.\\(\\[])(?:${formulaMarkers}*${elementPart}${formulaMarkers}*)+`, "g");
  const formulaMatches = combined.match(fullFormulaRe) || [];
  const hasFormulaStructural = formulaMatches.some((m) => {
    const clean = m.trim().replace(/[ \.\(\)\[\]]/g, "");
    if (clean.length <= 1) return false;
    if (/^(?:HCF|LCM|BODMAS|AP|GP|HP|STP|NTP|SI|UV|IR|NMR|pH|TIR|DNA|RNA|ATP|ADP|NOT|YES|MCQ|PDF|JEE|NEET|radius|diameter|force|speed|energy|work|mass|time|power|angle|circle|gravity|density|volume|area|mean|mode|median|ratio|percentage|interest|profit|loss|mixture|equation|root|cube|square|sin|cos|tan|theta|alpha|beta|gamma)$/i.test(clean)) return false;
    const cleanForElements = clean.replace(/[0-9₀-₉\+\-\^\{\}⁺⁻]/g, "");
    if (cleanForElements.length === 1 && !/^(?:CO|NO|SO|HI|KI|HF|NaCl|NaOH|HCl|KOH|NH3|CH4|H2O|CaO|MgO|LiF|KCl|CO2|SO2|NO2|H2S|PH3|AsH3|CFC)$/i.test(clean)) {
      return false;
    }
    const elementMatches = cleanForElements.match(new RegExp(elementPart, "g")) || [];
    if (!elementMatches || elementMatches.join("") !== cleanForElements) return false;
    const hasLowercase = /[a-z]/.test(clean);
    const hasDigit = /[0-9₀-₉]/.test(m);
    const hasBracket = /[\(\)\[\]]/.test(m);
    const hasCharge = /[\+\-⁺⁻\^]/.test(m);
    const isCommonUppercase = /^(?:CO|NO|SO|HI|KI|HF|NaCl|NaOH|HCl|KOH|NH3|CH4|H2O|CaO|MgO|LiF|KCl|CO2|SO2|NO2|H2S|PH3|AsH3|CFC)$/i.test(clean);
    if (elementMatches.length >= 2 && !hasLowercase && !hasDigit && !hasBracket && !hasCharge && !isCommonUppercase) {
      if (elementMatches.length >= 3) return false;
    }
    return hasLowercase || hasDigit && elementMatches.length >= 2 || hasBracket || hasCharge || isCommonUppercase;
  });
  const hasFormulaExplicit = /\\ce\{|->|=>|<=>|⇌|→|\rightleftharpoons|\\Delta\s*H|K_[cp]|pH\b|\d+[spdf]\^?\d+|\([slg](?:aq)?\)/.test(combined);
  const hasFormula = hasFormulaStructural || hasFormulaExplicit;
  const hasUnits = /(?:\b|\d|\}|\\mathrm\{|\\text\{)\s*(m|s|kg|N|J|W|Pa|Hz|V|A|Ω|C|F|T|H|K|mol|cd|rad|sr|eV|cal|atm|L|m\/s|m\/s²|kg·m|N\/m²|W\/m²|kg\/m³|J\/kg·K|Å|μ|µ|V\s*[:：]\s*I|V:I|km\/h|°C|MeV|cm³|g\/cm³|mol\/L|kJ\/mol|g\/mol)(?:\s|$|\)|\]|\})/.test(combined);
  const hasLatexDelim = /\$|\\\(|\\\[/.test(combined);
  const hasLatexCmd = /\\[a-zA-Z]+/.test(combined);
  const hasUnicodeMath = /[√π×÷½¼°∠△≤≥≠∞²³θ⇌→]/.test(combined);
  const hasMathExpr = /(?:^|\s)[a-z]\s*\^\s*\d+|sqrt\(|\b\d+\s*[\+\-\*\/\%\=]\s*\d+|\b\d+\s*:\s*\d+/i.test(combined);
  const mathKeywords = /percentage|profit|loss|interest|time.*work|speed|distance|mixture|quadratic|equation|triangle|circle|surface area|volume|sin|cos|tan|mean|median|mode|probability|permutation|combination|venn|data interpretation|bar chart|pie chart|histogram|statistics|arithmetic|geometry|mensuration|trigonometry|प्रतिशत|लाभ|हानि|ब्याज|समय.*कार्य|दूरी|मिश्रण|सरलीकरण|द्विघात|समीकरण|त्रिभुज|वृत्त|क्षेत्रफल|आयतन|त्रिकोणमिति|माध्य|प्रायिकता|व्यवस्थ|क्रम|संचय/i;
  const isNegative = /(?:नहीं|गलत|सही नहीं|असत्य)|\b(NOT|incorrect|FALSE|wrong)\b/i.test(`${stem}
${options.join(" ")}`);
  let mathType;
  const isMatchList = /सूची-?\s*I[\s\S]*सूची-?\s*II|List-?\s*I[\s\S]*List-?\s*II|Match\s+List|Match\s+the\s+following/i.test(combined);
  const isPipeTableValid = Boolean(matchTable && matchTable.rows && matchTable.rows.length > 0);
  if (isPipeTableValid && !isMatchList || /data interpretation|bar chart|pie chart|line graph|histogram|table data|आंकड़ा|आंकड़े|बार चार्ट|पाई चार्ट|डेटा व्याख्या/i.test(combined)) mathType = "data_interpretation";
  else if (/permutation|combination|arrangement|selection|क्रमचय|संचय|व्यवस्थ|\\binom|n!|\^\d+[PC]_\d+/i.test(combined)) mathType = "permutation_combination";
  else if (/probability|likely|dice|coins?|cards?|drawing a|प्रायिकता|संभावना|पासा|सिक्का|ताश/i.test(combined)) mathType = "probability";
  else if (/statistics|mean|median|mode|variance|standard deviation|सांख्यिकी|माध्य|माध्यिका|बहुलक/i.test(combined)) mathType = "statistics";
  else if (/sets?\b|venn diagram|intersection|union|subset|समुच्चय आरेख|वेन आरेख|प्रतिच्छेदन|\\cap|\\cup|\\subset/i.test(combined)) mathType = "sets_venn";
  else if (/trigonometr|height.*distance|त्रिकोणमिति|\\theta|\\sin|\\cos|\\tan|sin\s|cos\s|tan\s|cot\s|sec\theta|cosec\s/i.test(combined)) mathType = "trigonometry";
  else if (/mensuration|surface area|volume|perimeter|cube|cuboid|cylinder|cone|sphere|hemisphere|क्षेत्रफल|आयतन|परिमाप|बेलन|शंकु|गोला|घन/i.test(combined)) mathType = "mensuration";
  else if (/geometry|triangle|circle|polygon|quadrilateral|parallel|perpendicular|angle|tangent|chord|radius|diameter|coordinate|ज्यामिति|त्रिभुज|वृत्त|कोण|त्रिज्या|व्यास|समकोण|कर्ण|रेखा|बिंदु|\\angle|\\triangle|∠|△/i.test(combined)) mathType = "geometry";
  else if (/algebra|quadratic|polynomial|inequality|discriminant|roots of|बीजगणित|द्विघात|बहुपद|समीकरण|असमिका|असमानता|\\le|\\ge|\|x.*\||x\s*[\+\-]\s*y/i.test(combined)) mathType = "algebra";
  else if (/time and work|pipes? and cistern|man-days|work together|complete a work|can do a work|finish.*together|days.*together|समय और कार्य|पाइप और टंकी|कार्य और समय/i.test(combined)) mathType = "time_work";
  else if (/\bby car\b|time and distance|\btrain\b|\bstream\b|\bboat\b|relative speed|दूरी\b|रेलगाड़ी|नाव|धारा|औसत चाल|km\/h|m\/s/i.test(combined)) mathType = "time_speed_distance";
  else if (/mixture|alligation|purity|dilution|मिश्रण|घोल|दूध और पानी/i.test(combined)) mathType = "mixture";
  else if (/number series|missing term|missing number|next number|संख्या श्रृंखला|लुप्त पद/i.test(combined) || /^\s*(?:\d+[\s,]+){3,}\?/m.test(combined)) mathType = "number_series";
  else if (/number system|\bHCF\b|\bLCM\b|divisibility|remainder|prime number|संख्या पद्धति|म\.स\.|ल\.स\.|विभाज्य/i.test(combined)) mathType = "number_system";
  else if (/percentage|profit|loss|simple interest|compound interest|SI and CI|ratio|proportion|average|ages\b|partnership|प्रतिशत|लाभ|हानि|अनुपात|औसत|आयु\b|\\%|%|p\.a\./i.test(combined)) mathType = "arithmetic";
  else if (/simplification|BODMAS|surds|indices|square root|cube root|सरलीकरण|वर्गमूल|घातांक|\\sqrt|\\frac/i.test(combined) || /\d+\s*[\*\+\-\/]\s*\d+\s*[\*\+\-\/]\s*\d+/.test(combined)) mathType = "simplification";
  else if (hasFormula || detectedChemTopic) {
    mathType = "chemistry";
  } else if (detectedPhysTopic) {
    mathType = "physics";
  } else if (hasLatexDelim || hasLatexCmd || hasUnicodeMath || hasMathExpr || hasUnits || mathKeywords.test(combined)) {
    mathType = "arithmetic";
  }
  if (!mathType) return { hasMath: false };
  return {
    hasMath: true,
    mathType,
    physicsTopic: mathType === "physics" ? detectedPhysTopic : void 0,
    chemTopic: mathType === "chemistry" ? detectedChemTopic || "important_compounds" : void 0,
    hasUnits,
    hasFormula,
    isNegative
  };
}
function detectType(stem, cleanOpts, matchTable, has2PlusStatements) {
  const isMatchList = /सूची-?\s*I[\s\S]*सूची-?\s*II|List-?\s*I[\s\S]*List-?\s*II|Match\s+List|Match\s+the\s+following/i.test(stem);
  const hasMatchStructure = Boolean(matchTable && matchTable.rows && matchTable.rows.length > 0 && isMatchList) || /सुमेलित\s*कीजिए|स्तम्भ\s*[A-Z1-2]|खण्ड\s*[A-Z1-2]|Match\s+the\s+following/i.test(stem) || cleanOpts.some((o) => /[A-Da-d1-4][\-–][1-4A-Da-dक-घ]/.test(o) || /\([a-d]\)\s*[-–]\s*\([i|v|x]+\)/i.test(o));
  const hasAssertion = /(?:Assertion\s*\(?A\)?|अभिकथन|कथन\s*\(?A\)?|\(A\))/i.test(stem) && /(?:Reason\s*\(?R\)?|कारण|स्पष्टीकरण|कथन\s*\(?R\)?|\(R\))/i.test(stem);
  const hasStatements = has2PlusStatements || (/^\s*\(?(a|b|c|d|i|ii|1|2|I|II)\)/im.test(stem) || /^\s*(?:कथन\s*)?\(?[I123]\)?[.:]/im.test(stem) || /कथन\s*\(?[I1]/i.test(stem) || /कथन सही हैं|उपर्युक्त कथनों|statements? given above/i.test(stem) || cleanOpts.some((o) => /(?:(?:only|केवल|both|दोनों)\s*(?:I{1,3}|IV|VI{0,3}|[1-4]|कथन|statement))|(?:(?:I{1,3}|IV|VI{0,3}|[1-4])\s*(?:and|तथा|और)\s*(?:I{1,3}|IV|VI{0,3}|[1-4]))/i.test(o)));
  const hasFillBlank = /_{3,}|\.{4,}/.test(stem);
  const strippedOpts = cleanOpts.map((o) => o.replace(/^(?:[A-Da-d1-4कखगघअबतथ]\.?|\([A-Da-d1-4कखगघअबतथ]\))\s*/, "").trim());
  const isTrueFalse = cleanOpts.length === 2 && strippedOpts.some((o) => /^(सत्य|असत्य|true|false|सही|गलत)$/i.test(o));
  const hasPassage = /(?:^|[\s\n])(?:गद्यांश|पद्यांश|passage|directions?|निर्देश)(?:\s*[:\-–\n]|$)/i.test(stem);
  const hasImageRef = /\[image.*?\]|\[चित्र.*?\]|\[diagram.*?\]/i.test(stem);
  const lines = stem.split("\n").map((l) => l.trim()).filter(Boolean);
  const hasFullHindiLine = lines.some((l) => /^[\u0900-\u097F\s\d.,!?"'()\-:;]+$/.test(l) && /[\u0900-\u097F]{5,}/.test(l));
  const hasFullEnglishLine = lines.some((l) => /^[a-zA-Z\s\d.,!?"'()\-:;]+$/.test(l) && /[a-zA-Z]{5,}/.test(l) && l.replace(/[^a-zA-Z]/g, "").length > 5);
  const hasHindiChars = /[\u0900-\u097F]{3,}/.test(stem);
  const hasEnglishChars = /[a-zA-Z]{3,}/.test(stem);
  const hasSlashSep = stem.includes("/") || cleanOpts.some((o) => o.includes("/"));
  const isBilingual = (hasFullHindiLine && hasFullEnglishLine || hasHindiChars && hasEnglishChars && hasSlashSep || /[\u0900-\u097F]{5,}[\s\S]*\/[\s\S]*[a-zA-Z]{5,}/.test(stem)) && !/^\s*\([A-Z][a-z]?\d*\)\s*$/m.test(stem) && !/^\s*\(.*[0-9].*\)\s*$/m.test(stem);
  if (hasMatchStructure || isMatchList) return "match_following";
  if (hasAssertion) return "assertion_reason";
  if (hasStatements) return "statement_based";
  if (hasFillBlank) return "fill_blank";
  if (isTrueFalse) return "true_false";
  if (hasPassage) return "passage_based";
  if (hasImageRef) return "image_reference";
  if (isBilingual) return "bilingual";
  return "simple";
}
function parseRawMcqText(raw, chapterId = "general", topicId = "general") {
  if (!raw || !raw.trim()) {
    return { questions: [], errors: [] };
  }
  const { body, key } = extractAnswerKey(normalize(raw));
  const blocks = splitBlocks(body);
  const questions = [];
  const errors = [];
  blocks.forEach((b, n) => {
    const rawBlockLines = b.map((l) => l.trim()).filter(Boolean);
    if (rawBlockLines.length === 0) return;
    const blockExams = [];
    let pendingExam = null;
    let blockSubject;
    let blockChapter;
    let blockTopic;
    const lines = [];
    for (const l of rawBlockLines) {
      if (/^SUBJECT\s*[:.\-–]/i.test(l)) {
        blockSubject = l.replace(/^SUBJECT\s*[:.\-–]\s*/i, "").trim();
      } else if (/^CHAPTER\s*[:.\-–]/i.test(l)) {
        blockChapter = l.replace(/^CHAPTER\s*[:.\-–]\s*/i, "").trim();
      } else if (/^TOPIC\s*[:.\-–]/i.test(l)) {
        blockTopic = l.replace(/^TOPIC\s*[:.\-–]\s*/i, "").trim();
      } else if (/^(?:EXAM|EXAMINATION|PAPER|परीक्षा|प्रतियोगी\s*परीक्षा)\s*[:.\-–]/i.test(l)) {
        if (pendingExam) {
          blockExams.push({ examName: pendingExam, verified: true });
        }
        const val = l.replace(/^(?:EXAM|EXAMINATION|PAPER|परीक्षा|प्रतियोगी\s*परीक्षा)\s*[:.\-–]\s*/i, "").trim();
        const single = parseSingleExamString(val);
        if (single && single.year) {
          blockExams.push(single);
          pendingExam = null;
        } else {
          pendingExam = cleanExamName(val);
        }
      } else if (/^(?:YEAR|EXAM_YEAR|SESSION|वर्ष|सत्र)\s*[:.\-–]/i.test(l)) {
        const val = l.replace(/^(?:YEAR|EXAM_YEAR|SESSION|वर्ष|सत्र)\s*[:.\-–]\s*/i, "").trim();
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
    let ansIdx = lines.findIndex((l) => /^(answer|ans|correct|उत्तर|सही\s*उत्तर|right\s*option)\s*[:\-–]?/i.test(l));
    const hasAns = ansIdx >= 0;
    const expIdx = lines.findIndex((l) => /^(explanation|exp|solution|व्याख्या|स्पष्टीकरण)\s*[:\-–]/i.test(l));
    let ansText = hasAns ? lines[ansIdx] : "";
    if (hasAns && ansIdx + 1 < lines.length && expIdx !== ansIdx + 1) {
      const strippedCur = ansText.replace(/^(answer|ans|correct|उत्तर|सही\s*उत्तर|right\s*option)\s*[:\-–]?/i, "").trim();
      if (strippedCur.length === 0 || strippedCur === ":") {
        ansText += " " + lines[ansIdx + 1];
      }
    }
    const optEnd = hasAns ? ansIdx - 1 : lines.length - 1;
    let explanation = "";
    if (expIdx >= 0) {
      const expLines = [];
      for (let i = expIdx; i < lines.length; i++) {
        const l = lines[i];
        if (i > expIdx && /^\s*(?:Q\.?|प्रश्न|Question|Que\.?)\s*\(?\d+[.):]?/i.test(l)) {
          break;
        }
        expLines.push(l);
      }
      explanation = expLines.join(" ").replace(/^(?:explanation|exp|solution|व्याख्या|स्पष्टीकरण)\s*[:\-–]\s*/i, "").trim();
      explanation = explanation.replace(/\s*Questions?\s*Generated\s*:\s*\d+[^\n]*/gi, "").replace(/\s*Progress\s*:[^\n]*/gi, "").replace(/\s*Type\s+NEXT[^\n]*/gi, "").replace(/\s*\bPAGE\s*\d+\s*(?:COMPLETED|DONE|END)\b[^\n]*/gi, "").replace(/(?:^|[\s।\n])(?:PAGE|पृष्ठ)\s*\d+\s*(?:COMPLETED|DONE|END|समाप्त)[^\n]*/gi, "").replace(/^\s*(?:PAGE|पृष्ठ)\s*\d+\s*$/gim, "").trim();
    }
    const end = expIdx >= 0 && expIdx - 1 < optEnd ? expIdx - 1 : optEnd;
    let res = extractOptions(lines, end);
    const combinedInitialText = lines.slice(0, end + 1).join("\n");
    const isAssertionReason = /(?:Assertion\s*\(?A\)?|अभिकथन|कथन\s*\(?A\)?|\(A\))/i.test(combinedInitialText) && /(?:Reason\s*\(?R\)?|कारण|स्पष्टीकरण|कथन\s*\(?R\)?|\(R\))/i.test(combinedInitialText);
    if (!res && isAssertionReason) {
      const isHindi = /[\u0900-\u097F]/.test(combinedInitialText);
      const autoOpts = isHindi ? [
        "(A) \u0914\u0930 (R) \u0926\u094B\u0928\u094B\u0902 \u0938\u0939\u0940 \u0939\u0948\u0902 \u0914\u0930 (R), (A) \u0915\u0940 \u0938\u0939\u0940 \u0935\u094D\u092F\u093E\u0916\u094D\u092F\u093E \u0939\u0948\u0964",
        "(A) \u0914\u0930 (R) \u0926\u094B\u0928\u094B\u0902 \u0938\u0939\u0940 \u0939\u0948\u0902 \u0932\u0947\u0915\u093F\u0928 (R), (A) \u0915\u0940 \u0938\u0939\u0940 \u0935\u094D\u092F\u093E\u0916\u094D\u092F\u093E \u0928\u0939\u0940\u0902 \u0939\u0948\u0964",
        "(A) \u0938\u0939\u0940 \u0939\u0948 \u0932\u0947\u0915\u093F\u0928 (R) \u0917\u0932\u0924 \u0939\u0948\u0964",
        "(A) \u0917\u0932\u0924 \u0939\u0948 \u0932\u0947\u0915\u093F\u0928 (R) \u0938\u0939\u0940 \u0939\u0948\u0964"
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
        stemTail: ""
      };
    }
    if (!res) {
      const fallbackStem = lines.slice(0, end + 1).join("\n").replace(/^\s*(?:Q\.?|प्रश्न|Question)?\s*\(?\d+[.):]?\s*/i, "").trim();
      errors.push({
        blockNo: qNo,
        reason: "Options nahi mile",
        rawText: lines.join("\n")
      });
      if (fallbackStem.length > 0) {
        const timestamp2 = Date.now();
        questions.push({
          id: `parsed-q-${timestamp2}-${qNo}-${Math.random().toString(36).substring(2, 6)}`,
          tempId: `draft-text-${timestamp2}-${qNo}-${Math.random().toString(36).substring(2, 8)}`,
          type: "single_correct",
          questionType: "single_correct",
          question: fallbackStem,
          text: fallbackStem,
          options: [],
          correctIndex: -1,
          answer: "",
          explanation,
          confidence: 0.25,
          isValid: false,
          errors: ["Options missing (at least 2 options required)"],
          difficulty: "medium",
          createdAt: (/* @__PURE__ */ new Date()).toISOString(),
          chapterId,
          topicId,
          isUserAdded: true,
          rawInput: lines.join("\n"),
          needsReview: true,
          reviewReason: "Options missing (at least 2 options required)"
        });
      }
      return;
    }
    let stem = lines.slice(0, res.stemEnd + 1).join("\n").replace(/^\s*(?:Q\.?|प्रश्न|Question|Que\.?)\s*(?:\(?\d+[.):]?|[:\-–])\s*/i, "") + (res.stemTail ?? "");
    stem = stem.trim();
    const { cleanStem, askLine: askLineFromHelper } = extractAskLine(stem);
    const extractedStatements = extractStatements(cleanStem);
    let finalAskLine = askLineFromHelper || extractedStatements?.askLine;
    let finalCleanStem = extractedStatements?.cleanStem || (askLineFromHelper ? cleanStem : finalAskLine && stem.lastIndexOf(finalAskLine) > 0 ? stem.substring(0, stem.lastIndexOf(finalAskLine)).trim() : cleanStem);
    finalCleanStem = finalCleanStem.trim();
    const has2PlusStatements = Array.isArray(extractedStatements) && extractedStatements.length >= 2;
    const matchTable = extractMatchTable(stem);
    if (matchTable?.cleanStem) {
      finalCleanStem = matchTable.cleanStem;
    }
    let ci = hasAns ? parseAnswer(ansText, res.opts) : -1;
    if (ci < 0 && key[qNo]) {
      const all = "ABCDabcd1234\u0915\u0916\u0917\u0918\u0905\u092C\u0938\u0926";
      const idx = all.indexOf(key[qNo]) % 4;
      if (idx >= 0) ci = idx;
    }
    if (ci < 0 && res.hintIndex !== void 0 && res.hintIndex >= 0) {
      ci = res.hintIndex;
    }
    if (ci < 0) {
      ci = res.opts.findIndex((o) => /✓|✔|\*\*/.test(o));
    }
    const cleanOpts = res.opts.map((o) => o.replace(/[*✓✔]/g, "").trim());
    const assertionReason = extractAssertionReason(stem);
    if (assertionReason) {
      if (assertionReason.cleanStem) finalCleanStem = assertionReason.cleanStem;
      if (assertionReason.askLine) finalAskLine = assertionReason.askLine;
    }
    const baseType = detectType(stem, cleanOpts, matchTable, has2PlusStatements);
    const type = assertionReason ? "assertion_reason" : matchTable ? "match_following" : baseType;
    const checks = [
      stem.length > 5,
      cleanOpts.every(Boolean),
      ci >= 0,
      new Set(cleanOpts).size === cleanOpts.length
    ];
    const confidence = parseFloat((checks.filter(Boolean).length / checks.length).toFixed(2));
    const blockErrors = [];
    if (!stem) blockErrors.push("Question text is empty");
    if (cleanOpts.length < 2) blockErrors.push("Fewer than 2 options found");
    if (ci < 0) {
      blockErrors.push("Correct answer is missing");
      errors.push({ blockNo: qNo, reason: "Answer nahi mila", rawText: lines.join("\n") });
    }
    const isValid = blockErrors.length === 0;
    const timestamp = Date.now();
    const ansLetter = ci >= 0 ? ["A", "B", "C", "D", "E"][ci] || "" : "";
    const questionItem = {
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
      matchData: matchTable ? { listI: matchTable.rows.map((r) => r.left), listII: matchTable.rows.map((r) => r.right) } : void 0,
      options: cleanOpts.length === 2 ? [cleanOpts[0], cleanOpts[1]] : [cleanOpts[0] || "", cleanOpts[1] || "", cleanOpts[2] || "", cleanOpts[3] || ""],
      correctIndex: ci >= 0 ? ci : -1,
      answer: ansLetter,
      explanation,
      examHistory: normalizeExamHistory(
        blockExams.length > 0 ? blockExams : blocks.meta?.exam ? [{ examName: blocks.meta.exam, year: blocks.meta.year, verified: true }] : []
      ),
      questionClassification: blockExams.length > 0 || blocks.meta?.exam ? "pyq" : "practice",
      isPYQ: blockExams.length > 0 || Boolean(blocks.meta?.exam),
      meta: (() => {
        const mathMeta = detectMathMeta(finalCleanStem, cleanOpts, explanation, matchTable);
        const resolvedHistory = normalizeExamHistory(
          blockExams.length > 0 ? blockExams : blocks.meta?.exam ? [{ examName: blocks.meta.exam, year: blocks.meta.year, verified: true }] : []
        );
        return {
          ...blocks.meta || {},
          ...blockSubject ? { subject: blockSubject } : {},
          ...blockChapter ? { chapter: blockChapter } : {},
          ...blockTopic ? { topic: blockTopic } : {},
          ...resolvedHistory.length > 0 ? { exam: resolvedHistory[0].examName, year: String(resolvedHistory[0].year || "") } : {},
          examHistory: resolvedHistory,
          hasMath: mathMeta.hasMath,
          ...mathMeta.mathType ? { mathType: mathMeta.mathType } : {},
          ...mathMeta.physicsTopic ? { physicsTopic: mathMeta.physicsTopic } : {},
          ...mathMeta.chemTopic ? { chemTopic: mathMeta.chemTopic } : {},
          ...mathMeta.hasUnits !== void 0 ? { hasUnits: mathMeta.hasUnits } : {},
          ...mathMeta.hasFormula !== void 0 ? { hasFormula: mathMeta.hasFormula } : {},
          ...mathMeta.isNegative !== void 0 ? { isNegative: mathMeta.isNegative } : {}
        };
      })(),
      confidence,
      isValid,
      errors: blockErrors,
      difficulty: "medium",
      createdAt: (/* @__PURE__ */ new Date()).toISOString(),
      chapterId,
      topicId,
      isUserAdded: true,
      rawInput: lines.join("\n"),
      needsReview: !isValid || confidence < 0.75
    };
    questions.push(questionItem);
  });
  return { questions, errors };
}

// server.ts
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";

// src/server/cryptoVault.ts
import crypto from "crypto";
var PREFIX = "v1:";
var envEncryptionKey = (process.env.AI_CONFIG_ENCRYPTION_KEY || "").trim();
var encryptionKeyMode = envEncryptionKey.length >= 16 ? "env" : "ephemeral";
var AES_KEY = encryptionKeyMode === "env" ? crypto.createHash("sha256").update(envEncryptionKey, "utf8").digest() : crypto.randomBytes(32);
function encryptSecret(plaintext) {
  const clean = (plaintext || "").trim();
  if (!clean) return "";
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", AES_KEY, iv);
  const encrypted = Buffer.concat([cipher.update(clean, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString("base64")}:${tag.toString("base64")}:${encrypted.toString("base64")}`;
}
function decryptSecret(ciphertext) {
  if (!ciphertext || typeof ciphertext !== "string" || !ciphertext.startsWith(PREFIX)) {
    return "";
  }
  try {
    const parts = ciphertext.slice(PREFIX.length).split(":");
    if (parts.length !== 3) return "";
    const [ivB64, tagB64, dataB64] = parts;
    const iv = Buffer.from(ivB64, "base64");
    const tag = Buffer.from(tagB64, "base64");
    const encrypted = Buffer.from(dataB64, "base64");
    if (iv.length !== 12 || tag.length !== 16) return "";
    const decipher = crypto.createDecipheriv("aes-256-gcm", AES_KEY, iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    return decrypted.toString("utf8");
  } catch {
    return "";
  }
}
function redactSensitiveText(input) {
  const msg = input instanceof Error ? input.message : String(input || "");
  return msg.replace(/AIza[0-9A-Za-z\-_]{20,}/g, "[REDACTED_API_KEY]").replace(/sk-(?:proj-|ant-)?[0-9A-Za-z\-_]{16,}/g, "[REDACTED_API_KEY]").replace(/gsk_[0-9A-Za-z\-_]{16,}/g, "[REDACTED_API_KEY]").replace(/Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi, "Bearer [REDACTED_TOKEN]");
}

// src/server/rateLimiter.ts
var SlidingWindowRateLimiter = class {
  constructor(maxBuckets = 5e3) {
    this.buckets = /* @__PURE__ */ new Map();
    this.maxBuckets = maxBuckets;
  }
  check(key, config) {
    const now = Date.now();
    const cutoff = now - config.windowMs;
    if (this.buckets.size > this.maxBuckets) {
      for (const [k, entry] of this.buckets.entries()) {
        if (entry.timestamps.length === 0 || entry.timestamps[entry.timestamps.length - 1] < cutoff) {
          this.buckets.delete(k);
        }
      }
    }
    const existing = this.buckets.get(key) || { timestamps: [] };
    existing.timestamps = existing.timestamps.filter((ts) => ts > cutoff);
    if (existing.timestamps.length >= config.maxRequests) {
      const oldest = existing.timestamps[0] || now;
      const retryAfterMs = Math.max(1e3, config.windowMs - (now - oldest));
      this.buckets.set(key, existing);
      return {
        allowed: false,
        remaining: 0,
        retryAfterSeconds: Math.ceil(retryAfterMs / 1e3)
      };
    }
    existing.timestamps.push(now);
    this.buckets.set(key, existing);
    return {
      allowed: true,
      remaining: Math.max(0, config.maxRequests - existing.timestamps.length),
      retryAfterSeconds: 0
    };
  }
  reset() {
    this.buckets.clear();
  }
};

// src/server/authMiddleware.ts
var AUTHORIZED_ADMIN_EMAILS = [
  "zdpaliyal@gmail.com",
  "jagdishpaliyaljat@gmail.com"
];
function extractBearerToken(req) {
  const authHeader = req.headers.authorization;
  if (typeof authHeader !== "string") return null;
  const match = authHeader.match(/^Bearer\s+(\S+)$/i);
  if (!match || !match[1]) return null;
  const token = match[1].trim();
  return token.length > 0 ? token : null;
}
async function verifyAuthenticatedRequest(req, deps, options = {}) {
  const token = extractBearerToken(req);
  if (!token) {
    return {
      ok: false,
      status: 401,
      error: "Unauthorized: Missing Bearer authentication token."
    };
  }
  if (!deps.adminAuth) {
    return {
      ok: false,
      status: 503,
      error: "Authentication verification service is unavailable."
    };
  }
  let decoded;
  try {
    decoded = await deps.adminAuth.verifyIdToken(token, true);
  } catch {
    return {
      ok: false,
      status: 401,
      error: "Unauthorized: Invalid, expired, or revoked authentication token."
    };
  }
  if (!decoded || typeof decoded.uid !== "string" || !decoded.uid) {
    return {
      ok: false,
      status: 401,
      error: "Unauthorized: Malformed authentication payload."
    };
  }
  const signInProvider = String(decoded.firebase?.sign_in_provider || "");
  if (signInProvider === "anonymous") {
    return {
      ok: false,
      status: 401,
      error: "Unauthorized: Anonymous guest sessions are not permitted."
    };
  }
  const email = typeof decoded.email === "string" ? decoded.email.trim().toLowerCase() : "";
  const emailVerified = decoded.email_verified === true;
  if (options.requireAdmin && !deps.adminDb) {
    return {
      ok: false,
      status: 503,
      error: "Authorization database is unavailable."
    };
  }
  let userDocExists = false;
  let userDoc;
  if (deps.adminDb) {
    try {
      const snap = await deps.adminDb.collection("users").doc(decoded.uid).get();
      if (snap.exists) {
        userDocExists = true;
        userDoc = snap.data() || {};
      }
    } catch {
      return {
        ok: false,
        status: 503,
        error: "Failed to verify account status."
      };
    }
  }
  const isBlocked = Boolean(
    userDoc && (userDoc.blocked === true || userDoc.status === "blocked")
  );
  if (isBlocked) {
    return {
      ok: false,
      status: 403,
      error: "Forbidden: Account is blocked."
    };
  }
  const isRevokedAdmin = Boolean(userDoc && userDoc.revokedAdmin === true);
  const isAllowlistedEmailAdmin = emailVerified && Boolean(email) && AUTHORIZED_ADMIN_EMAILS.includes(email) && !isRevokedAdmin;
  const hasCustomAdminClaim = (decoded.admin === true || decoded.role === "admin") && !isRevokedAdmin && (!userDocExists || userDoc?.role === "admin");
  const isServerApprovedAdminDoc = userDocExists && userDoc?.role === "admin" && !isRevokedAdmin;
  const isAdmin = Boolean(
    isAllowlistedEmailAdmin || hasCustomAdminClaim || isServerApprovedAdminDoc
  );
  if (options.requireAdmin && !isAdmin) {
    return {
      ok: false,
      status: 403,
      error: "Forbidden: Verified administrator privileges required."
    };
  }
  return {
    ok: true,
    user: {
      uid: decoded.uid,
      email,
      emailVerified,
      signInProvider,
      claims: decoded,
      isAdmin,
      userDocExists,
      userDoc
    }
  };
}
function createRequireAuthenticatedUser(getDeps) {
  return async (req, res, next) => {
    const result = await verifyAuthenticatedRequest(req, getDeps(), { requireAdmin: false });
    if (result.ok) {
      req.authUser = result.user;
      return next();
    }
    return res.status(result.status).json({ success: false, error: result.error });
  };
}
function createRequireVerifiedAdmin(getDeps) {
  return async (req, res, next) => {
    const result = await verifyAuthenticatedRequest(req, getDeps(), { requireAdmin: true });
    if (result.ok) {
      req.authUser = result.user;
      return next();
    }
    return res.status(result.status).json({ success: false, error: result.error });
  };
}

// src/server/liveTestService.ts
var SAFE_ID_REGEX = /^[a-zA-Z0-9_.-]{1,128}$/;
function isValidFirestoreDocId(id) {
  return typeof id === "string" && SAFE_ID_REGEX.test(id) && id !== "." && id !== "..";
}
function stripAnswerFieldsFromQuestion(q) {
  if (!q || typeof q !== "object") return q;
  const {
    correctIndex: _ci,
    correctOption: _co,
    answer: _ans,
    explanation: _exp,
    solution: _sol,
    importantFact: _imp,
    correctOptionText: _cot,
    ...publicFields
  } = q;
  return publicFields;
}
function sanitizeLiveTestForPublic(test) {
  if (!test || typeof test !== "object") return test;
  const {
    answerKey: _ak,
    answerKeys: _aks,
    answers: _as,
    correctAnswers: _cas,
    ...rest
  } = test;
  const sanitizedQuestions = Array.isArray(rest.questions) ? rest.questions.map(
    (q) => typeof q === "object" && q !== null ? stripAnswerFieldsFromQuestion(q) : q
  ) : rest.questions;
  return {
    ...rest,
    questions: sanitizedQuestions
  };
}
function buildAnswerKeyFromTest(test) {
  const answers = {};
  const qs = Array.isArray(test.questions) ? test.questions : [];
  qs.forEach((q, idx) => {
    if (q && typeof q === "object") {
      const qId = String(q.id || `live_${test.id}_q_${idx}`);
      const ci = typeof q.correctIndex === "number" && Number.isInteger(q.correctIndex) ? q.correctIndex : -1;
      if (ci >= 0) {
        answers[qId] = {
          correctIndex: ci,
          ...q.explanation ? { explanation: String(q.explanation) } : {},
          ...q.importantFact ? { importantFact: String(q.importantFact) } : {}
        };
      }
    }
  });
  return {
    testId: String(test.id || ""),
    title: String(test.title || ""),
    marksPerQuestion: Number(test.marksPerQuestion ?? 2),
    negativeMarking: Number(test.negativeMarking ?? 0.66),
    totalMarks: Number(test.totalMarks ?? qs.length * Number(test.marksPerQuestion ?? 2)),
    allowReattempt: test.allowReattempt !== false,
    updatedAt: (/* @__PURE__ */ new Date()).toISOString(),
    answers
  };
}
async function gradeAndSubmitLiveTest(params) {
  const { testId, authUser, body, adminDb } = params;
  if (!isValidFirestoreDocId(testId)) {
    return {
      status: 400,
      body: { success: false, error: "Invalid live test ID." }
    };
  }
  if (!adminDb) {
    return {
      status: 503,
      body: { success: false, error: "Database service unavailable for grading." }
    };
  }
  if (!body || typeof body !== "object" || !body.answers || typeof body.answers !== "object" || Array.isArray(body.answers)) {
    return {
      status: 400,
      body: { success: false, error: "Invalid submission payload: answers map is required." }
    };
  }
  const rawTime = Number(body.timeSpentSeconds ?? 0);
  if (!Number.isFinite(rawTime) || rawTime < 0 || rawTime > 86400) {
    return {
      status: 400,
      body: { success: false, error: "Invalid timeSpentSeconds value." }
    };
  }
  const submittedAnswers = body.answers;
  const answerEntries = Object.entries(submittedAnswers);
  if (answerEntries.length > 500) {
    return {
      status: 400,
      body: { success: false, error: "Too many answer entries in submission." }
    };
  }
  for (const [qId, selected] of answerEntries) {
    if (!qId || typeof qId !== "string" || qId.length > 128) {
      return {
        status: 400,
        body: { success: false, error: "Invalid question ID in answers map." }
      };
    }
    if (selected !== null && selected !== void 0) {
      if (typeof selected !== "number" || !Number.isInteger(selected) || selected < -1 || selected > 11) {
        return {
          status: 400,
          body: { success: false, error: `Invalid answer index for question ${qId}.` }
        };
      }
    }
  }
  const requestedSubId = typeof body.submissionId === "string" && body.submissionId.trim() ? body.submissionId.trim() : `sub_${authUser.uid}_${testId}_${Date.now()}`;
  if (!isValidFirestoreDocId(requestedSubId)) {
    return {
      status: 400,
      body: { success: false, error: "Invalid submissionId format." }
    };
  }
  const [testSnap, keySnap] = await Promise.all([
    adminDb.collection("liveTests").doc(testId).get(),
    adminDb.collection("liveTestAnswerKeys").doc(testId).get()
  ]);
  if (!testSnap.exists && !keySnap.exists) {
    return {
      status: 404,
      body: { success: false, error: "Live test not found." }
    };
  }
  const testData = testSnap.exists ? testSnap.data() || {} : {};
  const keyDoc = keySnap.exists ? keySnap.data() || {} : {};
  if (testData.status === "draft" && !authUser.isAdmin) {
    return {
      status: 403,
      body: { success: false, error: "This live test is not published." }
    };
  }
  let answerKeyMap = {};
  if (keyDoc.answers && typeof keyDoc.answers === "object") {
    answerKeyMap = keyDoc.answers;
  } else {
    const legacyKey = buildAnswerKeyFromTest({ ...testData, id: testId });
    answerKeyMap = legacyKey.answers;
  }
  const questionIds = Array.from(
    /* @__PURE__ */ new Set([
      ...Object.keys(answerKeyMap),
      ...Array.isArray(testData.questions) ? testData.questions.map(
        (q, idx) => typeof q === "string" ? q : String(q?.id || `live_${testId}_q_${idx}`)
      ) : []
    ])
  );
  if (Object.keys(answerKeyMap).length === 0) {
    return {
      status: 422,
      body: { success: false, error: "Server answer key is not configured for this live test." }
    };
  }
  const existingSubSnap = await adminDb.collection("liveTestSubmissions").doc(requestedSubId).get();
  if (existingSubSnap.exists) {
    return {
      status: 409,
      body: { success: false, error: "Duplicate submission ID." }
    };
  }
  const allowReattempt = testData.allowReattempt !== void 0 ? testData.allowReattempt !== false : keyDoc.allowReattempt !== false;
  if (!allowReattempt) {
    const priorSnap = await adminDb.collection("liveTestSubmissions").where("userId", "==", authUser.uid).where("testId", "==", testId).limit(1).get();
    if (priorSnap && !priorSnap.empty) {
      return {
        status: 409,
        body: {
          success: false,
          error: "Duplicate submission: you have already submitted this live test and reattempts are disabled."
        }
      };
    }
  }
  const validQuestionSet = new Set(questionIds);
  for (const [qId] of answerEntries) {
    if (!validQuestionSet.has(qId)) {
      return {
        status: 400,
        body: { success: false, error: `Unknown question ID '${qId}' for live test '${testId}'.` }
      };
    }
  }
  const marksPerQ = Number(testData.marksPerQuestion ?? keyDoc.marksPerQuestion ?? 2);
  const negMarksPerQ = Number(testData.negativeMarking ?? keyDoc.negativeMarking ?? 0.66);
  const totalQuestionCount = Math.max(questionIds.length, Number(testData.questionCount || 0));
  const totalMarks = Number(testData.totalMarks ?? keyDoc.totalMarks ?? totalQuestionCount * marksPerQ);
  let correctCount = 0;
  let wrongCount = 0;
  let unattemptedECount = 0;
  let completelyBlankCount = 0;
  const questionResults = {};
  for (const qId of questionIds) {
    const keyEntry = answerKeyMap[qId];
    if (!keyEntry) continue;
    const rawSel = submittedAnswers[qId];
    if (rawSel === 4) {
      unattemptedECount++;
      questionResults[qId] = {
        selectedIndex: 4,
        correctIndex: keyEntry.correctIndex,
        isCorrect: false,
        isUnattemptedE: true,
        ...keyEntry.explanation ? { explanation: keyEntry.explanation } : {},
        ...keyEntry.importantFact ? { importantFact: keyEntry.importantFact } : {}
      };
    } else if (typeof rawSel === "number" && Number.isInteger(rawSel) && rawSel >= 0 && rawSel <= 3) {
      const isCorrect = rawSel === keyEntry.correctIndex;
      if (isCorrect) correctCount++;
      else wrongCount++;
      questionResults[qId] = {
        selectedIndex: rawSel,
        correctIndex: keyEntry.correctIndex,
        isCorrect,
        ...keyEntry.explanation ? { explanation: keyEntry.explanation } : {},
        ...keyEntry.importantFact ? { importantFact: keyEntry.importantFact } : {}
      };
    } else {
      completelyBlankCount++;
      questionResults[qId] = {
        selectedIndex: -1,
        correctIndex: keyEntry.correctIndex,
        isCorrect: false,
        isCompletelyBlank: true,
        ...keyEntry.explanation ? { explanation: keyEntry.explanation } : {},
        ...keyEntry.importantFact ? { importantFact: keyEntry.importantFact } : {}
      };
    }
  }
  const attemptedCount = correctCount + wrongCount;
  const unattemptedCount = unattemptedECount + completelyBlankCount;
  const blankPenalty = completelyBlankCount * (marksPerQ / 3);
  const rawScore = correctCount * marksPerQ - wrongCount * negMarksPerQ - blankPenalty;
  const finalScore = Math.max(0, Number(rawScore.toFixed(2)));
  const accuracy = attemptedCount > 0 ? Math.round(correctCount / attemptedCount * 100) : 0;
  const isRpscDisqualified = totalQuestionCount > 0 && completelyBlankCount > totalQuestionCount * 0.1;
  const safeUserName = typeof body.userName === "string" && body.userName.trim() ? body.userName.trim().slice(0, 80) : String(authUser.userDoc?.displayName || authUser.userDoc?.name || "Aspirant").slice(0, 80);
  const submission = {
    submissionId: requestedSubId,
    userId: authUser.uid,
    userName: safeUserName,
    userEmail: authUser.email || "",
    testId,
    testTitle: String(testData.title || keyDoc.title || testId),
    score: finalScore,
    totalMarks,
    correctCount,
    wrongCount,
    unattemptedCount,
    unattemptedECount,
    completelyBlankCount,
    blankPenalty: Number(blankPenalty.toFixed(2)),
    isRpscDisqualified,
    accuracy,
    timeSpentSeconds: Math.round(rawTime),
    submittedAt: (/* @__PURE__ */ new Date()).toISOString(),
    gradedServerSide: true
  };
  await adminDb.collection("liveTestSubmissions").doc(requestedSubId).create(submission);
  return {
    status: 200,
    body: {
      success: true,
      submission,
      results: questionResults
    }
  };
}

// src/server/quizAssetsService.ts
function parseFirestoreRestValue(val) {
  if (!val || typeof val !== "object") return val;
  if ("nullValue" in val) return null;
  if ("booleanValue" in val) return Boolean(val.booleanValue);
  if ("integerValue" in val) return Number(val.integerValue);
  if ("doubleValue" in val) return Number(val.doubleValue);
  if ("timestampValue" in val) return val.timestampValue;
  if ("stringValue" in val) return val.stringValue;
  if ("arrayValue" in val) {
    const items = Array.isArray(val.arrayValue?.values) ? val.arrayValue.values : [];
    return items.map((item) => parseFirestoreRestValue(item));
  }
  if ("mapValue" in val) {
    return parseFirestoreRestFields(val.mapValue?.fields || {});
  }
  return val;
}
function parseFirestoreRestFields(fields) {
  const result = {};
  if (!fields || typeof fields !== "object") return result;
  for (const [key, val] of Object.entries(fields)) {
    result[key] = parseFirestoreRestValue(val);
  }
  return result;
}
function createQuizAssetsService(deps) {
  const VERSION_TTL_MS = 60 * 1e3;
  const MAX_VERSIONED_ENTRIES = 6;
  const MAX_BUNDLE_ENTRIES = 250;
  let cachedVersion = null;
  const curriculumCache = /* @__PURE__ */ new Map();
  const bundleCache = /* @__PURE__ */ new Map();
  const pyqPapersCache = /* @__PURE__ */ new Map();
  const liveTestsCache = /* @__PURE__ */ new Map();
  const liveTestByIdCache = /* @__PURE__ */ new Map();
  const inFlight = /* @__PURE__ */ new Map();
  const doFetch = () => deps.fetchImpl || fetch;
  function setBounded(map, key, val, maxSize) {
    if (map.has(key)) map.delete(key);
    map.set(key, val);
    while (map.size > maxSize) {
      const oldest = map.keys().next().value;
      if (oldest === void 0) break;
      map.delete(oldest);
    }
  }
  function coalesce(key, fn) {
    const existing = inFlight.get(key);
    if (existing) return existing;
    const promise = fn().finally(() => {
      inFlight.delete(key);
    });
    inFlight.set(key, promise);
    return promise;
  }
  async function readDoc(collectionName, docId) {
    const adminDb = deps.getAdminDb();
    if (adminDb) {
      try {
        const snap = await adminDb.collection(collectionName).doc(docId).get();
        if (!snap || !snap.exists) return null;
        return { ...snap.data() || {}, id: snap.id || docId };
      } catch (err) {
        console.warn(`[QuizAssets] adminDb readDoc(${collectionName}/${docId}) fallback to REST:`, err?.message || err);
      }
    }
    const url = `https://firestore.googleapis.com/v1/projects/${deps.projectId}/databases/${deps.databaseId}/documents/${encodeURIComponent(collectionName)}/${encodeURIComponent(docId)}?key=${deps.apiKey}`;
    const res = await doFetch()(url);
    if (res.status === 404) return null;
    if (!res.ok) {
      throw new Error(`Firestore REST readDoc(${collectionName}/${docId}) failed: ${res.status}`);
    }
    const json = await res.json();
    if (!json || !json.fields) return null;
    return {
      ...parseFirestoreRestFields(json.fields),
      id: docId
    };
  }
  async function readCollection(collectionName) {
    const adminDb = deps.getAdminDb();
    if (adminDb) {
      try {
        const snap = await adminDb.collection(collectionName).get();
        if (!snap || !Array.isArray(snap.docs)) return [];
        return snap.docs.map((d) => ({
          ...typeof d.data === "function" ? d.data() : d.data || {},
          id: d.id
        }));
      } catch (err) {
        console.warn(`[QuizAssets] adminDb readCollection(${collectionName}) fallback to REST:`, err?.message || err);
      }
    }
    const docs = [];
    let pageToken;
    do {
      const qs = new URLSearchParams({
        key: deps.apiKey,
        pageSize: "1000"
      });
      if (pageToken) qs.set("pageToken", pageToken);
      const url = `https://firestore.googleapis.com/v1/projects/${deps.projectId}/databases/${deps.databaseId}/documents/${encodeURIComponent(collectionName)}?${qs.toString()}`;
      const res = await doFetch()(url);
      if (!res.ok) {
        if (res.status === 404) return docs;
        throw new Error(`Firestore REST readCollection(${collectionName}) failed: ${res.status}`);
      }
      const json = await res.json();
      if (Array.isArray(json.documents)) {
        for (const item of json.documents) {
          if (item && item.fields && item.name) {
            const id = String(item.name).split("/").pop() || "";
            docs.push({
              ...parseFirestoreRestFields(item.fields),
              id
            });
          }
        }
      }
      pageToken = json.nextPageToken;
    } while (pageToken);
    return docs;
  }
  async function getVersionManifest(forceRefresh = false) {
    const now = Date.now();
    if (!forceRefresh && cachedVersion && now < cachedVersion.expiresAt) {
      return cachedVersion.data;
    }
    return coalesce("version", async () => {
      if (!forceRefresh && cachedVersion && Date.now() < cachedVersion.expiresAt) {
        return cachedVersion.data;
      }
      let manifest = {
        curriculumVersion: 1,
        lastUpdated: (/* @__PURE__ */ new Date()).toISOString(),
        bundleVersions: {}
      };
      try {
        const raw = await readDoc("metadata", "app_version");
        if (raw) {
          manifest = {
            curriculumVersion: Number(raw.curriculumVersion) || 1,
            lastUpdated: typeof raw.lastUpdated === "string" ? raw.lastUpdated : (/* @__PURE__ */ new Date()).toISOString(),
            bundleVersions: raw.bundleVersions && typeof raw.bundleVersions === "object" ? raw.bundleVersions : {},
            ...typeof raw.contentDigest === "string" ? { contentDigest: raw.contentDigest } : {}
          };
        }
      } catch (err) {
        console.warn("[QuizAssets] Failed to read metadata/app_version:", err?.message || err);
        if (cachedVersion) return cachedVersion.data;
      }
      cachedVersion = {
        data: manifest,
        expiresAt: Date.now() + VERSION_TTL_MS
      };
      return manifest;
    });
  }
  async function getCurriculumAsset(requestedVersion) {
    const versionKey = requestedVersion && requestedVersion.trim() ? requestedVersion.trim() : "latest";
    if (versionKey !== "latest") {
      const hit = curriculumCache.get(versionKey);
      if (hit) return hit;
    }
    return coalesce(`curriculum:${versionKey}`, async () => {
      const manifest = versionKey === "latest" ? await getVersionManifest() : null;
      const resolvedVersion = versionKey === "latest" ? manifest.curriculumVersion : Number(versionKey) || 1;
      const cacheKey = String(resolvedVersion);
      const hit = curriculumCache.get(cacheKey);
      if (hit) return hit;
      const [subjects, chapters, topics, bundles, banners, examCategories] = await Promise.all([
        readCollection("subjects").catch(() => []),
        readCollection("chapters").catch(() => []),
        readCollection("topics").catch(() => []),
        readCollection("question_bundles").catch(() => []),
        readCollection("banners").catch(() => []),
        readCollection("exam_categories").catch(() => [])
      ]);
      const bundleCountByTopic = /* @__PURE__ */ new Map();
      for (const b of bundles) {
        if (!b || typeof b !== "object") continue;
        const rawTopicId = String(b.topicId || (typeof b.id === "string" && b.id.startsWith("topic_") ? b.id.slice(6) : b.id) || "").trim();
        if (!rawTopicId) continue;
        const qLen = Array.isArray(b.questions) ? b.questions.length : 0;
        const qCount = qLen > 0 ? qLen : Number(b.questionCount) || 0;
        if (qCount > 0) {
          bundleCountByTopic.set(rawTopicId, qCount);
        }
      }
      const enrichedTopics = topics.map((t) => {
        if (!t || typeof t !== "object") return t;
        const embeddedLen = Array.isArray(t.questions) ? t.questions.length : 0;
        const bundleCount = bundleCountByTopic.get(t.id) || 0;
        const existingCount = typeof t.questionCount === "number" ? t.questionCount : 0;
        const resolvedCount = embeddedLen > 0 ? embeddedLen : bundleCount > 0 ? bundleCount : existingCount;
        return resolvedCount > 0 ? { ...t, questionCount: resolvedCount } : t;
      });
      const enrichedChapters = chapters.map((ch) => {
        if (!ch || typeof ch !== "object") return ch;
        const chTopics = Array.isArray(ch.topics) ? ch.topics.map((t) => {
          if (!t || typeof t !== "object") return t;
          const embeddedLen = Array.isArray(t.questions) ? t.questions.length : 0;
          const bundleCount = bundleCountByTopic.get(t.id) || 0;
          const existingCount = typeof t.questionCount === "number" ? t.questionCount : 0;
          const resolvedCount = embeddedLen > 0 ? embeddedLen : bundleCount > 0 ? bundleCount : existingCount;
          return resolvedCount > 0 ? { ...t, questionCount: resolvedCount } : t;
        }) : ch.topics;
        return { ...ch, topics: chTopics };
      });
      const payload = {
        version: resolvedVersion,
        subjects,
        chapters: enrichedChapters,
        topics: enrichedTopics,
        banners,
        examCategories,
        generatedAt: (/* @__PURE__ */ new Date()).toISOString()
      };
      if (subjects.length > 0 || enrichedChapters.length > 0 || enrichedTopics.length > 0) {
        setBounded(curriculumCache, cacheKey, payload, MAX_VERSIONED_ENTRIES);
      }
      return payload;
    });
  }
  async function getTopicBundleAsset(topicId, requestedVersion) {
    if (!isValidFirestoreDocId(topicId)) return null;
    const primaryBundleDocId = `topic_${topicId}`;
    const vKey = requestedVersion && requestedVersion.trim() ? requestedVersion.trim() : "latest";
    const cacheKey = `${topicId}@${vKey}`;
    if (vKey !== "latest") {
      const hit = bundleCache.get(cacheKey);
      if (hit) return hit;
    }
    return coalesce(`bundle:${cacheKey}`, async () => {
      if (vKey !== "latest") {
        const hit = bundleCache.get(cacheKey);
        if (hit) return hit;
      }
      let raw = await readDoc("question_bundles", primaryBundleDocId);
      if (!raw && topicId.startsWith("topic_")) {
        raw = await readDoc("question_bundles", topicId);
      }
      if (!raw) return null;
      const resolvedVersion = Number(raw.version) || (vKey !== "latest" ? Number(vKey) || 1 : 1);
      const questions = Array.isArray(raw.questions) ? raw.questions : [];
      const payload = {
        id: raw.id || primaryBundleDocId,
        topicId: raw.topicId || topicId,
        chapterId: raw.chapterId || "",
        subjectId: raw.subjectId || "",
        questionCount: questions.length,
        updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : (/* @__PURE__ */ new Date()).toISOString(),
        version: resolvedVersion,
        ...typeof raw.contentHash === "string" ? { contentHash: raw.contentHash } : {},
        questions
      };
      setBounded(bundleCache, cacheKey, payload, MAX_BUNDLE_ENTRIES);
      if (vKey === "latest") {
        setBounded(bundleCache, `${topicId}@${resolvedVersion}`, payload, MAX_BUNDLE_ENTRIES);
      }
      return payload;
    });
  }
  async function getPyqPapersAsset(requestedVersion) {
    const versionKey = requestedVersion && requestedVersion.trim() ? requestedVersion.trim() : "latest";
    if (versionKey !== "latest") {
      const hit = pyqPapersCache.get(versionKey);
      if (hit) return hit;
    }
    return coalesce(`pyq:${versionKey}`, async () => {
      const manifest = versionKey === "latest" ? await getVersionManifest() : null;
      const resolvedVersion = versionKey === "latest" ? manifest.curriculumVersion : Number(versionKey) || 1;
      const cacheKey = String(resolvedVersion);
      const hit = pyqPapersCache.get(cacheKey);
      if (hit) return hit;
      const allPapers = await readCollection("pyq_papers");
      const publishedPapers = allPapers.filter((p) => p && p.isPublished !== false);
      const payload = {
        version: resolvedVersion,
        papers: publishedPapers,
        generatedAt: (/* @__PURE__ */ new Date()).toISOString()
      };
      setBounded(pyqPapersCache, cacheKey, payload, MAX_VERSIONED_ENTRIES);
      return payload;
    });
  }
  async function getLiveTestsAsset(requestedVersion) {
    const versionKey = requestedVersion && requestedVersion.trim() ? requestedVersion.trim() : "latest";
    if (versionKey !== "latest") {
      const hit = liveTestsCache.get(versionKey);
      if (hit) return hit;
    }
    return coalesce(`liveTests:${versionKey}`, async () => {
      const manifest = versionKey === "latest" ? await getVersionManifest() : null;
      const resolvedVersion = versionKey === "latest" ? manifest.curriculumVersion : Number(versionKey) || 1;
      const cacheKey = String(resolvedVersion);
      const hit = liveTestsCache.get(cacheKey);
      if (hit) return hit;
      const allTests = await readCollection("liveTests");
      const sanitizedTests = allTests.filter((t) => t && t.status !== "draft").map((t) => sanitizeLiveTestForPublic(t));
      const payload = {
        version: resolvedVersion,
        tests: sanitizedTests,
        generatedAt: (/* @__PURE__ */ new Date()).toISOString()
      };
      setBounded(liveTestsCache, cacheKey, payload, MAX_VERSIONED_ENTRIES);
      return payload;
    });
  }
  async function getPublicLiveTestById(testId, requestedVersion) {
    if (!isValidFirestoreDocId(testId)) {
      return { status: 400, error: "Invalid live test ID." };
    }
    const cacheKey = `${testId}@${requestedVersion || "latest"}`;
    if (requestedVersion) {
      const hit = liveTestByIdCache.get(cacheKey);
      if (hit) return { status: 200, test: hit };
    }
    const doc = await readDoc("liveTests", testId);
    if (!doc) {
      return { status: 404, error: "Live test not found." };
    }
    if (doc.status === "draft") {
      return { status: 404, error: "Live test not published." };
    }
    const sanitized = sanitizeLiveTestForPublic(doc);
    setBounded(liveTestByIdCache, cacheKey, sanitized, 100);
    return { status: 200, test: sanitized };
  }
  function invalidateQuizAssetsCache(topicIds) {
    cachedVersion = null;
    curriculumCache.clear();
    pyqPapersCache.clear();
    liveTestsCache.clear();
    liveTestByIdCache.clear();
    if (Array.isArray(topicIds) && topicIds.length > 0) {
      const targets = /* @__PURE__ */ new Set();
      for (const t of topicIds) {
        targets.add(t);
        if (t.startsWith("topic_")) targets.add(t.slice(6));
      }
      for (const key of Array.from(bundleCache.keys())) {
        const [tId] = key.split("@");
        if (targets.has(tId)) {
          bundleCache.delete(key);
        }
      }
    } else {
      bundleCache.clear();
    }
  }
  return {
    getVersionManifest,
    getCurriculumAsset,
    getTopicBundleAsset,
    getPyqPapersAsset,
    getLiveTestsAsset,
    getPublicLiveTestById,
    invalidateQuizAssetsCache
  };
}

// src/server/backupEngine.ts
import fs from "fs";
import path from "path";

// src/server/zipEngine.ts
import zlib from "zlib";
import crypto2 from "crypto";
var CRC32_TABLE = new Int32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let k = 0; k < 8; k++) {
    c = c & 1 ? 3988292384 ^ c >>> 1 : c >>> 1;
  }
  CRC32_TABLE[i] = c;
}
function computeCrc32(buf) {
  let crc = -1;
  for (let i = 0; i < buf.length; i++) {
    crc = crc >>> 8 ^ CRC32_TABLE[(crc ^ buf[i]) & 255];
  }
  return (crc ^ -1) >>> 0;
}
function computeSha256(data) {
  const buf = Buffer.isBuffer(data) ? data : Buffer.from(data, "utf8");
  return crypto2.createHash("sha256").update(buf).digest("hex");
}
function toDosDateTime(d = /* @__PURE__ */ new Date()) {
  const dosTime = (d.getHours() & 31) << 11 | (d.getMinutes() & 63) << 5 | Math.floor(d.getSeconds() / 2) & 31;
  const year = Math.max(1980, d.getFullYear());
  const dosDate = (year - 1980 & 127) << 9 | (d.getMonth() + 1 & 15) << 5 | d.getDate() & 31;
  return { dosTime, dosDate };
}
function createZipBuffer(entries) {
  const localHeaders = [];
  const centralHeaders = [];
  let currentOffset = 0;
  for (const entry of entries) {
    const normalizedName = entry.name.replace(/\\/g, "/").replace(/^\/+/, "");
    const nameBuf = Buffer.from(normalizedName, "utf8");
    const dataBuf = Buffer.isBuffer(entry.data) ? entry.data : Buffer.from(entry.data, "utf8");
    const uncompressedSize = dataBuf.length;
    const crc = computeCrc32(dataBuf);
    let compressedBuf;
    let compressionMethod = 8;
    try {
      compressedBuf = zlib.deflateRawSync(dataBuf);
      if (compressedBuf.length >= uncompressedSize) {
        compressedBuf = dataBuf;
        compressionMethod = 0;
      }
    } catch {
      compressedBuf = dataBuf;
      compressionMethod = 0;
    }
    const compressedSize = compressedBuf.length;
    const { dosTime, dosDate } = toDosDateTime(entry.modifiedTime);
    const localHeader = Buffer.alloc(30 + nameBuf.length);
    localHeader.writeUInt32LE(67324752, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(2048, 6);
    localHeader.writeUInt16LE(compressionMethod, 8);
    localHeader.writeUInt16LE(dosTime, 10);
    localHeader.writeUInt16LE(dosDate, 12);
    localHeader.writeUInt32LE(crc, 14);
    localHeader.writeUInt32LE(compressedSize, 18);
    localHeader.writeUInt32LE(uncompressedSize, 22);
    localHeader.writeUInt16LE(nameBuf.length, 26);
    localHeader.writeUInt16LE(0, 28);
    nameBuf.copy(localHeader, 30);
    localHeaders.push(localHeader, compressedBuf);
    const centralHeader = Buffer.alloc(46 + nameBuf.length);
    centralHeader.writeUInt32LE(33639248, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(2048, 8);
    centralHeader.writeUInt16LE(compressionMethod, 10);
    centralHeader.writeUInt16LE(dosTime, 12);
    centralHeader.writeUInt16LE(dosDate, 14);
    centralHeader.writeUInt32LE(crc, 16);
    centralHeader.writeUInt32LE(compressedSize, 20);
    centralHeader.writeUInt32LE(uncompressedSize, 24);
    centralHeader.writeUInt16LE(nameBuf.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE(2175008768, 38);
    centralHeader.writeUInt32LE(currentOffset, 42);
    nameBuf.copy(centralHeader, 46);
    centralHeaders.push(centralHeader);
    currentOffset += localHeader.length + compressedBuf.length;
  }
  const centralDirOffset = currentOffset;
  const centralDirSize = centralHeaders.reduce((sum, h) => sum + h.length, 0);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(101010256, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(centralDirSize, 12);
  eocd.writeUInt32LE(centralDirOffset, 16);
  eocd.writeUInt16LE(0, 20);
  return Buffer.concat([...localHeaders, ...centralHeaders, eocd]);
}
function readZipBuffer(buf) {
  if (!buf || buf.length < 22) {
    throw new Error("Invalid archive buffer: file is too small to be a valid ZIP archive.");
  }
  let eocdOffset = -1;
  const maxScan = Math.min(buf.length, 65557);
  for (let i = buf.length - 22; i >= buf.length - maxScan; i--) {
    if (buf.readUInt32LE(i) === 101010256) {
      eocdOffset = i;
      break;
    }
  }
  if (eocdOffset === -1) {
    throw new Error("Corrupted or invalid ZIP archive: End of Central Directory record not found.");
  }
  const totalEntries = buf.readUInt16LE(eocdOffset + 10);
  const cdOffset = buf.readUInt32LE(eocdOffset + 16);
  if (cdOffset > buf.length) {
    throw new Error("Corrupted ZIP archive: Central Directory offset out of range.");
  }
  const extractedFiles = [];
  const seenNames = /* @__PURE__ */ new Set();
  let curr = cdOffset;
  for (let i = 0; i < totalEntries; i++) {
    if (curr + 46 > buf.length) {
      throw new Error(`Corrupted ZIP archive: Truncated Central Directory header at entry ${i}.`);
    }
    const cdSig = buf.readUInt32LE(curr);
    if (cdSig !== 33639248) {
      throw new Error(`Corrupted ZIP archive: Expected Central Directory signature 0x02014B50 at ${curr}, got 0x${cdSig.toString(16)}.`);
    }
    const compression = buf.readUInt16LE(curr + 10);
    const expectedCrc = buf.readUInt32LE(curr + 16);
    const compressedSize = buf.readUInt32LE(curr + 20);
    const uncompressedSize = buf.readUInt32LE(curr + 24);
    const nameLen = buf.readUInt16LE(curr + 28);
    const extraLen = buf.readUInt16LE(curr + 30);
    const commentLen = buf.readUInt16LE(curr + 32);
    const localHeaderOffset = buf.readUInt32LE(curr + 42);
    const name = buf.toString("utf8", curr + 46, curr + 46 + nameLen);
    curr += 46 + nameLen + extraLen + commentLen;
    if (name.includes("..") || name.startsWith("/") || name.startsWith("\\")) {
      throw new Error(`Security Violation: Illegal path traversal detected in ZIP entry: "${name}"`);
    }
    if (name.endsWith("/")) {
      continue;
    }
    if (seenNames.has(name)) {
      throw new Error(`Security Violation: Duplicate archive entry path detected in ZIP: "${name}"`);
    }
    seenNames.add(name);
    if (localHeaderOffset + 30 > buf.length) {
      throw new Error(`Corrupted ZIP archive: Truncated Local Header for file "${name}".`);
    }
    const localSig = buf.readUInt32LE(localHeaderOffset);
    if (localSig !== 67324752) {
      throw new Error(`Corrupted ZIP archive: Invalid Local File Header for file "${name}".`);
    }
    const localNameLen = buf.readUInt16LE(localHeaderOffset + 26);
    const localExtraLen = buf.readUInt16LE(localHeaderOffset + 28);
    const dataStart = localHeaderOffset + 30 + localNameLen + localExtraLen;
    const rawData = buf.subarray(dataStart, dataStart + compressedSize);
    let uncompressedData;
    if (compression === 0) {
      uncompressedData = rawData;
    } else if (compression === 8) {
      try {
        uncompressedData = zlib.inflateRawSync(rawData);
      } catch (err) {
        throw new Error(`Corrupted ZIP archive: Failed to decompress "${name}" via Deflate: ${err.message}`);
      }
    } else {
      throw new Error(`Unsupported ZIP compression method ${compression} for file "${name}".`);
    }
    const actualCrc = computeCrc32(uncompressedData);
    if (actualCrc !== expectedCrc) {
      throw new Error(`CRC32 Checksum Mismatch for file "${name}": expected ${expectedCrc}, computed ${actualCrc}.`);
    }
    extractedFiles.push({
      name,
      data: uncompressedData,
      uncompressedSize: uncompressedData.length
    });
  }
  return extractedFiles;
}
function generateIntegrityManifest(entries) {
  const manifest = {};
  for (const entry of entries) {
    manifest[entry.name] = computeSha256(entry.data);
  }
  return manifest;
}
function verifyZipIntegrity(files, integrityManifest) {
  const mismatchedFiles = [];
  const missingFiles = [];
  let verifiedFiles = 0;
  const fileMap = /* @__PURE__ */ new Map();
  for (const f of files) {
    fileMap.set(f.name, f.data);
  }
  for (const [filePath, expectedSha] of Object.entries(integrityManifest)) {
    const fileBuf = fileMap.get(filePath);
    if (!fileBuf) {
      missingFiles.push(filePath);
      continue;
    }
    const actualSha = computeSha256(fileBuf);
    if (actualSha !== expectedSha) {
      mismatchedFiles.push(filePath);
    } else {
      verifiedFiles++;
    }
  }
  const valid = missingFiles.length === 0 && mismatchedFiles.length === 0;
  return {
    valid,
    totalFiles: Object.keys(integrityManifest).length,
    verifiedFiles,
    mismatchedFiles,
    missingFiles
  };
}

// src/server/typedSerialization.ts
function isSerializedTypeMarker(val) {
  return val !== null && typeof val === "object" && typeof val.__type__ === "string" && ["Timestamp", "GeoPoint", "DocumentReference", "Bytes"].includes(val.__type__);
}
function serializeFirestoreValue(val) {
  if (val === null || val === void 0) {
    return null;
  }
  if (isSerializedTypeMarker(val)) {
    return val;
  }
  if (val instanceof Date) {
    return {
      __type__: "Timestamp",
      seconds: Math.floor(val.getTime() / 1e3),
      nanoseconds: val.getTime() % 1e3 * 1e6,
      iso: val.toISOString()
    };
  }
  if (typeof val === "object" && typeof val.toDate === "function" && typeof val.seconds === "number") {
    const d = val.toDate();
    return {
      __type__: "Timestamp",
      seconds: val.seconds,
      nanoseconds: typeof val.nanoseconds === "number" ? val.nanoseconds : 0,
      iso: d.toISOString()
    };
  }
  if (typeof val === "object" && typeof val._seconds === "number" && typeof val._nanoseconds === "number") {
    const d = new Date(val._seconds * 1e3 + Math.floor(val._nanoseconds / 1e6));
    return {
      __type__: "Timestamp",
      seconds: val._seconds,
      nanoseconds: val._nanoseconds,
      iso: d.toISOString()
    };
  }
  if (typeof val === "object" && (typeof val.latitude === "number" || typeof val._latitude === "number") && (typeof val.longitude === "number" || typeof val._longitude === "number")) {
    return {
      __type__: "GeoPoint",
      latitude: typeof val.latitude === "number" ? val.latitude : val._latitude,
      longitude: typeof val.longitude === "number" ? val.longitude : val._longitude
    };
  }
  if (typeof val === "object" && typeof val.path === "string" && (typeof val.id === "string" || typeof val.parent === "object")) {
    return {
      __type__: "DocumentReference",
      path: val.path
    };
  }
  if (Buffer.isBuffer(val)) {
    return {
      __type__: "Bytes",
      base64: val.toString("base64")
    };
  }
  if (val instanceof Uint8Array) {
    return {
      __type__: "Bytes",
      base64: Buffer.from(val).toString("base64")
    };
  }
  if (Array.isArray(val)) {
    return val.map((item) => serializeFirestoreValue(item));
  }
  if (typeof val === "object") {
    const serializedObj = {};
    for (const [key, propVal] of Object.entries(val)) {
      if (typeof propVal === "function" || propVal === void 0) continue;
      serializedObj[key] = serializeFirestoreValue(propVal);
    }
    return serializedObj;
  }
  return val;
}
function deserializeFirestoreValue(val, firestoreConstructors) {
  if (val === null || val === void 0) {
    return null;
  }
  if (isSerializedTypeMarker(val)) {
    switch (val.__type__) {
      case "Timestamp": {
        const ms = val.seconds * 1e3 + Math.floor((val.nanoseconds || 0) / 1e6);
        if (firestoreConstructors?.Timestamp?.fromMillis) {
          return firestoreConstructors.Timestamp.fromMillis(ms);
        }
        return new Date(ms);
      }
      case "GeoPoint": {
        if (firestoreConstructors?.GeoPoint) {
          return new firestoreConstructors.GeoPoint(val.latitude, val.longitude);
        }
        return { latitude: val.latitude, longitude: val.longitude };
      }
      case "DocumentReference": {
        return {
          __type__: "DocumentReference",
          path: val.path
        };
      }
      case "Bytes": {
        return Buffer.from(val.base64, "base64");
      }
    }
  }
  if (Array.isArray(val)) {
    return val.map((item) => deserializeFirestoreValue(item, firestoreConstructors));
  }
  if (typeof val === "object") {
    const deserializedObj = {};
    for (const [key, propVal] of Object.entries(val)) {
      deserializedObj[key] = deserializeFirestoreValue(propVal, firestoreConstructors);
    }
    return deserializedObj;
  }
  return val;
}
function areDocumentsIdentical(docA, docB) {
  if (docA === docB) return true;
  if (!docA || !docB) return false;
  return JSON.stringify(serializeFirestoreValue(docA)) === JSON.stringify(serializeFirestoreValue(docB));
}

// src/server/backupEngine.ts
var VERIFIED_QUIZPRO_COLLECTIONS = [
  "subjects",
  "chapters",
  "topics",
  "mcqs",
  "questions",
  "question_bundles",
  "archived_mcqs",
  "import_batches",
  "customQuestions",
  "curriculum_subjects",
  "curriculum_chapters",
  "curriculum_questions",
  "curriculum",
  "pyq_papers",
  "pyqPapers",
  "live_tests",
  "liveTests",
  "live-tests",
  "tests",
  "liveTestAnswerKeys",
  "exam_categories",
  "examCategories",
  "coaching",
  "coaching_exams",
  "coaching_test_series",
  "banners",
  "articles",
  "article_categories",
  "link_rules",
  "metadata",
  "settings",
  "appSettings",
  "notifications",
  "broadcast_notifications",
  "premiumPlans",
  "payment_orders",
  "payment_events",
  "user_subscriptions",
  "paymentSubmissions",
  "subscriptions",
  "scanUsage",
  "attempts",
  "pyq_attempts",
  "leaderboard",
  "user_stats_weekly",
  "liveTestSubmissions",
  "examPaperAnalyses",
  "_health",
  "adminAuditLogs",
  "login_attempts",
  "ai_api_configs",
  "usage_daily",
  "analytics_daily",
  "contact_messages",
  "content_changelog",
  "test",
  "users"
];
var SUBCOLLECTION_DEFINITIONS = [
  { parentCollection: "users", subcollectionName: "progress" },
  { parentCollection: "users", subcollectionName: "history" },
  { parentCollection: "users", subcollectionName: "attempts" },
  { parentCollection: "users", subcollectionName: "wrong_questions" },
  { parentCollection: "users", subcollectionName: "bookmarks" },
  { parentCollection: "users", subcollectionName: "test_results" },
  { parentCollection: "users", subcollectionName: "revision_history" },
  { parentCollection: "users", subcollectionName: "study_logs" },
  { parentCollection: "users", subcollectionName: "syllabus_progress" },
  { parentCollection: "users", subcollectionName: "sync_metadata" },
  { parentCollection: "users", subcollectionName: "featureUsage" },
  { parentCollection: "articles", subcollectionName: "blocks" },
  { parentCollection: "examPaperAnalyses", subcollectionName: "questions" },
  { parentCollection: "usage_daily", subcollectionName: "devices" }
];
var BACKUP_DIR = path.resolve(process.cwd(), "backups");
var RESTORE_LOCK_FILE = path.join(BACKUP_DIR, ".restore_active.lock");
if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}
var activeJobs = /* @__PURE__ */ new Map();
function getActiveJob(jobId) {
  return activeJobs.get(jobId);
}
function acquireRestoreLock(jobId, performedBy) {
  if (fs.existsSync(RESTORE_LOCK_FILE)) {
    try {
      const lockData = JSON.parse(fs.readFileSync(RESTORE_LOCK_FILE, "utf8"));
      if (Date.now() - new Date(lockData.lockedAt).getTime() < 30 * 60 * 1e3) {
        return false;
      }
    } catch {
    }
  }
  const lockPayload = {
    jobId,
    performedBy,
    lockedAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  fs.writeFileSync(RESTORE_LOCK_FILE, JSON.stringify(lockPayload, null, 2), "utf8");
  return true;
}
function releaseRestoreLock(jobId) {
  try {
    if (fs.existsSync(RESTORE_LOCK_FILE)) {
      const lockData = JSON.parse(fs.readFileSync(RESTORE_LOCK_FILE, "utf8"));
      if (lockData.jobId === jobId) {
        fs.unlinkSync(RESTORE_LOCK_FILE);
      }
    }
  } catch {
  }
}
function getRestoreCheckpoint(jobId) {
  const safeJobId = path.basename(jobId);
  const cpPath = path.join(BACKUP_DIR, `.restore_checkpoint_${safeJobId}.json`);
  if (fs.existsSync(cpPath)) {
    try {
      return JSON.parse(fs.readFileSync(cpPath, "utf8"));
    } catch {
    }
  }
  return null;
}
function updateRestoreCheckpoint(cp) {
  const safeJobId = path.basename(cp.jobId);
  const cpPath = path.join(BACKUP_DIR, `.restore_checkpoint_${safeJobId}.json`);
  cp.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
  fs.writeFileSync(cpPath, JSON.stringify(cp, null, 2), "utf8");
}
function createFirestoreDriver(adminDb, projectId, databaseId, apiKey, adminBearerToken) {
  if (adminDb && typeof adminDb.collection === "function") {
    return {
      async getCollectionDocs(collectionName) {
        try {
          const snap = await adminDb.collection(collectionName).get();
          return snap.docs.map((d) => ({
            id: d.id,
            data: d.data()
          }));
        } catch (err) {
          throw err;
        }
      },
      async getSubcollectionDocs(parentCollection, parentId, subcollectionName) {
        const snap = await adminDb.collection(parentCollection).doc(parentId).collection(subcollectionName).get();
        return snap.docs.map((d) => ({
          id: d.id,
          data: d.data()
        }));
      },
      async setDoc(docPath, data, merge = false) {
        const parts = docPath.split("/");
        let ref = adminDb;
        for (let i = 0; i < parts.length; i += 2) {
          ref = ref.collection(parts[i]).doc(parts[i + 1]);
        }
        await ref.set(data, { merge });
      },
      async docExists(docPath) {
        const parts = docPath.split("/");
        let ref = adminDb;
        for (let i = 0; i < parts.length; i += 2) {
          ref = ref.collection(parts[i]).doc(parts[i + 1]);
        }
        const snap = await ref.get();
        return { exists: snap.exists, data: snap.exists ? snap.data() : void 0 };
      }
    };
  }
  const baseUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${databaseId}/documents`;
  const getHeaders = () => {
    const headers = {
      "Content-Type": "application/json"
    };
    if (adminBearerToken) {
      headers["Authorization"] = `Bearer ${adminBearerToken}`;
    }
    return headers;
  };
  const decodeRestValue = (val) => {
    if (!val || typeof val !== "object") return val;
    if ("stringValue" in val) return val.stringValue;
    if ("booleanValue" in val) return val.booleanValue;
    if ("integerValue" in val) return parseInt(val.integerValue, 10);
    if ("doubleValue" in val) return parseFloat(val.doubleValue);
    if ("timestampValue" in val) return new Date(val.timestampValue);
    if ("nullValue" in val) return null;
    if ("referenceValue" in val) return { __type__: "DocumentReference", path: val.referenceValue };
    if ("geoPointValue" in val) return { __type__: "GeoPoint", latitude: val.geoPointValue.latitude, longitude: val.geoPointValue.longitude };
    if ("bytesValue" in val) return { __type__: "Bytes", base64: val.bytesValue };
    if ("arrayValue" in val) {
      return (val.arrayValue.values || []).map(decodeRestValue);
    }
    if ("mapValue" in val) {
      const res = {};
      const fields = val.mapValue.fields || {};
      for (const [k, v] of Object.entries(fields)) {
        res[k] = decodeRestValue(v);
      }
      return res;
    }
    return val;
  };
  const encodeRestValue = (val) => {
    if (val === null || val === void 0) return { nullValue: null };
    if (typeof val === "boolean") return { booleanValue: val };
    if (typeof val === "number") {
      return Number.isInteger(val) ? { integerValue: String(val) } : { doubleValue: val };
    }
    if (typeof val === "string") return { stringValue: val };
    if (val instanceof Date) return { timestampValue: val.toISOString() };
    if (val && typeof val === "object" && val.__type__ === "Timestamp") {
      return { timestampValue: val.iso || new Date(val.seconds * 1e3).toISOString() };
    }
    if (val && typeof val === "object" && val.__type__ === "GeoPoint") {
      return { geoPointValue: { latitude: val.latitude, longitude: val.longitude } };
    }
    if (val && typeof val === "object" && val.__type__ === "Bytes") {
      return { bytesValue: val.base64 };
    }
    if (Array.isArray(val)) {
      return { arrayValue: { values: val.map(encodeRestValue) } };
    }
    if (typeof val === "object") {
      const fields = {};
      for (const [k, v] of Object.entries(val)) {
        if (typeof v !== "function" && v !== void 0) {
          fields[k] = encodeRestValue(v);
        }
      }
      return { mapValue: { fields } };
    }
    return { stringValue: String(val) };
  };
  return {
    async getCollectionDocs(collectionName) {
      let pageToken = "";
      const allDocs = [];
      do {
        let url = `${baseUrl}/${collectionName}?pageSize=300&key=${apiKey}`;
        if (pageToken) {
          url += `&pageToken=${encodeURIComponent(pageToken)}`;
        }
        const res = await fetch(url, { headers: getHeaders() });
        if (!res.ok) {
          if (res.status === 404) return [];
          throw new Error(`REST Firestore Read Error [${res.status}]: ${await res.text()}`);
        }
        const data = await res.json();
        const docs = data.documents || [];
        for (const d of docs) {
          const id = d.name.split("/").pop();
          const docData = {};
          for (const [k, v] of Object.entries(d.fields || {})) {
            docData[k] = decodeRestValue(v);
          }
          allDocs.push({ id, data: docData });
        }
        pageToken = data.nextPageToken || "";
      } while (pageToken);
      return allDocs;
    },
    async getSubcollectionDocs(parentCollection, parentId, subcollectionName) {
      let pageToken = "";
      const allDocs = [];
      do {
        let url = `${baseUrl}/${parentCollection}/${parentId}/${subcollectionName}?pageSize=300&key=${apiKey}`;
        if (pageToken) {
          url += `&pageToken=${encodeURIComponent(pageToken)}`;
        }
        const res = await fetch(url, { headers: getHeaders() });
        if (!res.ok) {
          if (res.status === 404) return [];
          return [];
        }
        const data = await res.json();
        const docs = data.documents || [];
        for (const d of docs) {
          const id = d.name.split("/").pop();
          const docData = {};
          for (const [k, v] of Object.entries(d.fields || {})) {
            docData[k] = decodeRestValue(v);
          }
          allDocs.push({ id, data: docData });
        }
        pageToken = data.nextPageToken || "";
      } while (pageToken);
      return allDocs;
    },
    async setDoc(docPath, data, _merge = false) {
      const url = `${baseUrl}/${docPath}?key=${apiKey}`;
      const fields = {};
      for (const [k, v] of Object.entries(data)) {
        if (typeof v !== "function" && v !== void 0) {
          fields[k] = encodeRestValue(v);
        }
      }
      const res = await fetch(url, {
        method: "PATCH",
        headers: getHeaders(),
        body: JSON.stringify({ fields })
      });
      if (!res.ok) {
        throw new Error(`REST Firestore Write Error [${res.status}]: ${await res.text()}`);
      }
    },
    async docExists(docPath) {
      const url = `${baseUrl}/${docPath}?key=${apiKey}`;
      const res = await fetch(url, { headers: getHeaders() });
      if (res.status === 404) return { exists: false };
      if (!res.ok) return { exists: false };
      const d = await res.json();
      const docData = {};
      for (const [k, v] of Object.entries(d.fields || {})) {
        docData[k] = decodeRestValue(v);
      }
      return { exists: true, data: docData };
    }
  };
}
async function executeExportJob(jobId, options, serverContext) {
  const job = {
    jobId,
    type: "export",
    status: "running",
    phase: "Initializing Export Job",
    progressPercent: 5,
    totalCollections: 0,
    completedCollections: 0,
    totalDocuments: 0,
    exportedDocuments: 0,
    restoredDocuments: 0,
    skippedDocuments: 0,
    overwrittenDocuments: 0,
    failedDocuments: 0,
    storageFilesExported: 0,
    storageFilesRestored: 0,
    warnings: [],
    errors: [],
    startedAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  activeJobs.set(jobId, job);
  const targetCollections = options.scope === "selective" && options.selectedCollections && options.selectedCollections.length > 0 ? options.selectedCollections : VERIFIED_QUIZPRO_COLLECTIONS;
  job.totalCollections = targetCollections.length;
  try {
    const driver = createFirestoreDriver(
      serverContext.adminDb,
      serverContext.projectId,
      serverContext.databaseId,
      serverContext.apiKey,
      options.adminBearerToken
    );
    const zipEntries = [];
    const collectionInventory = {};
    const subcollectionInventory = {};
    job.phase = "Exporting Firestore Collections";
    for (let i = 0; i < targetCollections.length; i++) {
      const colName = targetCollections[i];
      job.phase = `Exporting Collection: ${colName} (${i + 1}/${targetCollections.length})`;
      job.progressPercent = Math.round(10 + i / targetCollections.length * 50);
      try {
        const docs = await driver.getCollectionDocs(colName);
        collectionInventory[colName] = docs.length;
        job.exportedDocuments += docs.length;
        job.totalDocuments += docs.length;
        const serializedDocs = docs.map((d) => ({
          id: d.id,
          data: serializeFirestoreValue(d.data)
        }));
        zipEntries.push({
          name: `firestore/collections/${colName}.json`,
          data: JSON.stringify(serializedDocs, null, 2)
        });
        const subcolDefs = SUBCOLLECTION_DEFINITIONS.filter((s) => s.parentCollection === colName);
        for (const subDef of subcolDefs) {
          const subcolDocs = [];
          for (const parentDoc of docs) {
            try {
              const subDocs = await driver.getSubcollectionDocs(colName, parentDoc.id, subDef.subcollectionName);
              for (const sub of subDocs) {
                subcolDocs.push({
                  id: sub.id,
                  parentId: parentDoc.id,
                  data: serializeFirestoreValue(sub.data)
                });
              }
            } catch {
            }
          }
          if (subcolDocs.length > 0) {
            const subKey = `${colName}__${subDef.subcollectionName}`;
            subcollectionInventory[subKey] = subcolDocs.length;
            job.exportedDocuments += subcolDocs.length;
            job.totalDocuments += subcolDocs.length;
            zipEntries.push({
              name: `firestore/subcollections/${subKey}.json`,
              data: JSON.stringify(subcolDocs, null, 2)
            });
          }
        }
        job.completedCollections++;
      } catch (colErr) {
        job.warnings.push(`Collection '${colName}' export warning: ${colErr.message}`);
        collectionInventory[colName] = 0;
        zipEntries.push({
          name: `firestore/collections/${colName}.json`,
          data: JSON.stringify([], null, 2)
        });
      }
    }
    job.phase = "Exporting Firebase Storage Assets";
    job.progressPercent = 65;
    const bucketName = "gen-lang-client-0811306192.firebasestorage.app";
    let storageStatus = "unprovisioned";
    const storageFiles = [];
    if (options.exportStorage !== false) {
      try {
        const storageUrl = `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o?key=${serverContext.apiKey}`;
        const sRes = await fetch(storageUrl);
        if (sRes.ok) {
          const sData = await sRes.json();
          const items = sData.items || [];
          if (items.length === 0) {
            storageStatus = "empty";
          } else {
            storageStatus = "connected";
            for (const item of items) {
              try {
                const downloadUrl = `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodeURIComponent(item.name)}?alt=media&key=${serverContext.apiKey}`;
                const fileRes = await fetch(downloadUrl);
                if (fileRes.ok) {
                  const fileBuffer = Buffer.from(await fileRes.arrayBuffer());
                  const sha = computeSha256(fileBuffer);
                  storageFiles.push({
                    path: item.name,
                    contentType: item.contentType || "application/octet-stream",
                    sizeBytes: fileBuffer.length,
                    sha256: sha
                  });
                  zipEntries.push({
                    name: `storage/files/${item.name}`,
                    data: fileBuffer
                  });
                  job.storageFilesExported++;
                }
              } catch (fErr) {
                job.warnings.push(`Failed to download storage file '${item.name}': ${fErr.message}`);
              }
            }
          }
        } else if (sRes.status === 404) {
          storageStatus = "unprovisioned";
        }
      } catch (sErr) {
        storageStatus = "unprovisioned";
        job.warnings.push(`Storage check bypassed: ${sErr.message}`);
      }
    }
    zipEntries.push({
      name: "storage/manifest.json",
      data: JSON.stringify(
        {
          bucketName,
          status: storageStatus,
          fileCount: storageFiles.length,
          files: storageFiles
        },
        null,
        2
      )
    });
    job.phase = "Packaging Application Configurations & Blueprint";
    job.progressPercent = 75;
    let blueprintJson = {};
    const blueprintPath = path.resolve(process.cwd(), "firebase-blueprint.json");
    if (fs.existsSync(blueprintPath)) {
      try {
        blueprintJson = JSON.parse(fs.readFileSync(blueprintPath, "utf8"));
      } catch {
      }
    }
    let packageJson = {};
    const packagePath = path.resolve(process.cwd(), "package.json");
    if (fs.existsSync(packagePath)) {
      try {
        packageJson = JSON.parse(fs.readFileSync(packagePath, "utf8"));
      } catch {
      }
    }
    zipEntries.push({
      name: "application/blueprint_schema.json",
      data: JSON.stringify(blueprintJson, null, 2)
    });
    zipEntries.push({
      name: "application/app_metadata.json",
      data: JSON.stringify(
        {
          name: packageJson.name || "quizpro-exam-prep",
          version: packageJson.version || "2.0.0",
          exportedAt: (/* @__PURE__ */ new Date()).toISOString(),
          nodeVersion: process.version
        },
        null,
        2
      )
    });
    job.phase = "Packaging Infrastructure Rules";
    job.progressPercent = 85;
    const rulesPath = path.resolve(process.cwd(), "firestore.rules");
    if (fs.existsSync(rulesPath)) {
      zipEntries.push({
        name: "infrastructure/firestore.rules",
        data: fs.readFileSync(rulesPath, "utf8")
      });
    }
    zipEntries.push({
      name: "infrastructure/firebase_config_public.json",
      data: JSON.stringify(
        {
          projectId: serverContext.projectId,
          firestoreDatabaseId: serverContext.databaseId,
          storageBucket: bucketName,
          authDomain: `${serverContext.projectId}.firebaseapp.com`
        },
        null,
        2
      )
    });
    job.phase = "Generating Checksums & Integrity Manifest";
    job.progressPercent = 90;
    const fileChecksums = generateIntegrityManifest(zipEntries);
    zipEntries.push({
      name: "reports/integrity_manifest.json",
      data: JSON.stringify(fileChecksums, null, 2)
    });
    const backupManifest = {
      backupFormatVersion: "2.0.0",
      appName: "QUIZPRO / DISHA 20-20",
      appVersion: packageJson.version || "2.0.0",
      sourceProjectId: serverContext.projectId,
      sourceDatabaseId: serverContext.databaseId,
      exportTimestamp: (/* @__PURE__ */ new Date()).toISOString(),
      exportStatus: job.warnings.length > 0 ? "COMPLETE_WITH_WARNINGS" : "COMPLETE",
      scope: options.scope,
      selectedCollections: options.selectedCollections,
      totalCollections: targetCollections.length,
      totalDocuments: job.totalDocuments,
      collectionInventory,
      subcollectionInventory,
      storage: {
        status: storageStatus,
        fileCount: storageFiles.length,
        totalSizeBytes: storageFiles.reduce((acc, f) => acc + f.sizeBytes, 0),
        files: storageFiles
      },
      application: {
        name: "QUIZPRO / DISHA 20-20",
        version: packageJson.version || "2.0.0",
        curriculumSummary: {
          subjectsCount: collectionInventory["subjects"] || 0,
          chaptersCount: collectionInventory["chapters"] || 0,
          topicsCount: collectionInventory["topics"] || 0,
          mcqsCount: (collectionInventory["mcqs"] || 0) + (collectionInventory["questions"] || 0)
        }
      },
      infrastructure: {
        firestoreRulesVersion: "2",
        hasIndexes: false
      },
      fileChecksums,
      warnings: job.warnings,
      failedExportItems: job.errors
    };
    zipEntries.unshift({
      name: "backup_manifest.json",
      data: JSON.stringify(backupManifest, null, 2)
    });
    job.phase = "Compiling ZIP Container";
    job.progressPercent = 95;
    const zipBuffer = createZipBuffer(zipEntries);
    const dateStr = (/* @__PURE__ */ new Date()).toISOString().replace(/[:.]/g, "-");
    const backupFilename = `QUIZPRO_BACKUP_${serverContext.projectId}_${dateStr}.zip`;
    const backupFilePath = path.join(BACKUP_DIR, backupFilename);
    fs.writeFileSync(backupFilePath, zipBuffer);
    job.backupId = backupFilename;
    job.backupFilename = backupFilename;
    job.fileSizeBytes = zipBuffer.length;
    job.downloadUrl = `/api/admin/backup/download/${backupFilename}`;
    job.progressPercent = 100;
    job.phase = "Backup Successfully Created & Verified";
    job.status = job.warnings.length > 0 ? "completed_with_warnings" : "completed";
    job.completedAt = (/* @__PURE__ */ new Date()).toISOString();
    return job;
  } catch (fatalErr) {
    job.status = "failed";
    job.phase = "Export Failed";
    job.errors.push(fatalErr.message || String(fatalErr));
    return job;
  }
}
async function generateRestorePreview(backupBuffer, filename, serverContext, adminBearerToken) {
  let files;
  try {
    files = readZipBuffer(backupBuffer);
  } catch (err) {
    throw new Error(`Failed to read ZIP archive: ${err.message}`);
  }
  const manifestFile = files.find((f) => f.name === "backup_manifest.json");
  if (!manifestFile) {
    throw new Error('Invalid backup archive: "backup_manifest.json" was not found inside the ZIP.');
  }
  let manifest;
  try {
    manifest = JSON.parse(manifestFile.data.toString("utf8"));
  } catch (err) {
    throw new Error(`Malformed backup manifest JSON: ${err.message}`);
  }
  let integrityVerified = true;
  let missingFilesCount = 0;
  let corruptedFilesCount = 0;
  const integrityFile = files.find((f) => f.name === "reports/integrity_manifest.json");
  if (integrityFile) {
    try {
      const integrityMap = JSON.parse(integrityFile.data.toString("utf8"));
      const checkResult = verifyZipIntegrity(files, integrityMap);
      integrityVerified = checkResult.valid;
      missingFilesCount = checkResult.missingFiles.length;
      corruptedFilesCount = checkResult.mismatchedFiles.length;
    } catch {
      integrityVerified = false;
    }
  }
  const driver = createFirestoreDriver(
    serverContext.adminDb,
    serverContext.projectId,
    serverContext.databaseId,
    serverContext.apiKey,
    adminBearerToken
  );
  const collectionSummary = [];
  const compatibilityWarnings = [];
  if (manifest.sourceProjectId !== serverContext.projectId) {
    compatibilityWarnings.push(
      `Cross-Project Migration: Backup source (${manifest.sourceProjectId}) differs from destination project (${serverContext.projectId}).`
    );
  }
  for (const [colName, backupCount] of Object.entries(manifest.collectionInventory || {})) {
    let destCount = 0;
    let conflicts = 0;
    try {
      const destDocs = await driver.getCollectionDocs(colName);
      destCount = destDocs.length;
      const colFile = files.find((f) => f.name === `firestore/collections/${colName}.json`);
      if (colFile) {
        const backupDocs = JSON.parse(colFile.data.toString("utf8"));
        const destDocMap = new Map(destDocs.map((d) => [d.id, d.data]));
        for (const bDoc of backupDocs) {
          if (destDocMap.has(bDoc.id)) {
            const destData = destDocMap.get(bDoc.id);
            if (!areDocumentsIdentical(bDoc.data, destData)) {
              conflicts++;
            }
          }
        }
      }
    } catch {
      destCount = 0;
    }
    const missingCount = Math.max(0, backupCount - (destCount - conflicts));
    const status = destCount === 0 ? "destination_empty" : conflicts > 0 ? "conflicts_detected" : "matching";
    collectionSummary.push({
      name: colName,
      backupDocCount: backupCount,
      destinationDocCount: destCount,
      conflictingDocsCount: conflicts,
      missingDocsCount: missingCount,
      status
    });
  }
  const supportedRestoreModes = [
    {
      mode: "RESTORE_MISSING_DOCUMENTS",
      label: "Restore Missing Documents",
      description: "Creates only documents that do not already exist in the database. Never overwrites existing data.",
      safe: true
    },
    {
      mode: "OVERWRITE_EXISTING_DOCUMENTS",
      label: "Overwrite Existing Documents",
      description: "Updates matching documents with backup values and creates missing documents. Requires explicit confirmation.",
      safe: false
    },
    {
      mode: "RESTORE_INTO_EMPTY_PROJECT",
      label: "Restore Into Empty Project",
      description: "Clean restoration into an empty project. Verifies destination is empty before writing.",
      safe: true
    },
    {
      mode: "SELECTIVE_RESTORE",
      label: "Selective Restore",
      description: "Restore only selected collections or syllabus branches.",
      safe: true
    },
    {
      mode: "MIGRATION_RESTORE",
      label: "Cross-Project Migration Restore",
      description: "Migrate data from another Firebase project while preserving all IDs and parent-child relationships.",
      safe: false
    }
  ];
  return {
    valid: missingFilesCount === 0 && corruptedFilesCount === 0,
    backupId: filename,
    backupFilename: filename,
    appName: manifest.appName,
    sourceProjectId: manifest.sourceProjectId,
    sourceDatabaseId: manifest.sourceDatabaseId,
    destinationProjectId: serverContext.projectId,
    destinationDatabaseId: serverContext.databaseId,
    exportTimestamp: manifest.exportTimestamp,
    backupVersion: manifest.backupFormatVersion,
    totalCollections: manifest.totalCollections,
    totalDocuments: manifest.totalDocuments,
    storageFileCount: manifest.storage?.fileCount || 0,
    totalBackupSizeBytes: backupBuffer.length,
    integrityVerified,
    missingFilesCount,
    corruptedFilesCount,
    collectionSummary,
    compatibilityWarnings,
    supportedRestoreModes
  };
}
async function executeRestoreJob(jobId, request, backupBuffer, adminUser, serverContext, adminBearerToken) {
  const job = {
    jobId,
    type: "restore",
    status: "running",
    phase: "Validating Restore Authorization & Lock",
    progressPercent: 2,
    totalCollections: 0,
    completedCollections: 0,
    totalDocuments: 0,
    exportedDocuments: 0,
    restoredDocuments: 0,
    skippedDocuments: 0,
    overwrittenDocuments: 0,
    failedDocuments: 0,
    storageFilesExported: 0,
    storageFilesRestored: 0,
    warnings: [],
    errors: [],
    startedAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  activeJobs.set(jobId, job);
  if (!acquireRestoreLock(jobId, adminUser.email)) {
    job.status = "failed";
    job.phase = "Restore Lock Error";
    job.errors.push("A restore operation is currently in progress. Simultaneous restore sessions are blocked.");
    return job;
  }
  try {
    const expectedPhrase = `CONFIRM_RESTORE_${request.restoreMode}`;
    if (request.confirmationPhrase.trim() !== expectedPhrase && request.confirmationPhrase.trim() !== "CONFIRM") {
      throw new Error(`Invalid confirmation phrase. Expected "${expectedPhrase}".`);
    }
    job.phase = "Extracting & Verifying Archive";
    job.progressPercent = 5;
    const files = readZipBuffer(backupBuffer);
    const manifestFile = files.find((f) => f.name === "backup_manifest.json");
    if (!manifestFile) {
      throw new Error("backup_manifest.json is missing in the archive.");
    }
    const manifest = JSON.parse(manifestFile.data.toString("utf8"));
    const integrityFile = files.find((f) => f.name === "reports/integrity_manifest.json");
    if (integrityFile) {
      try {
        const integrityMap = JSON.parse(integrityFile.data.toString("utf8"));
        const checkResult = verifyZipIntegrity(files, integrityMap);
        if (!checkResult.valid) {
          throw new Error(
            `Integrity verification failed: Backup archive has ${checkResult.missingFiles.length} missing and ${checkResult.mismatchedFiles.length} corrupted files. Aborting restore.`
          );
        }
      } catch (err) {
        throw new Error(`Backup integrity check failed: ${err.message}. Aborting restore.`);
      }
    }
    const driver = createFirestoreDriver(
      serverContext.adminDb,
      serverContext.projectId,
      serverContext.databaseId,
      serverContext.apiKey,
      adminBearerToken
    );
    const targetCollections = request.restoreMode === "SELECTIVE_RESTORE" && request.selectedCollections && request.selectedCollections.length > 0 ? request.selectedCollections : Object.keys(manifest.collectionInventory || {});
    job.totalCollections = targetCollections.length;
    job.phase = "Generating Mandatory Pre-Restore Safety Snapshot";
    job.progressPercent = 10;
    let preRestoreFilename = "";
    try {
      const preRestoreSnapshot = {};
      let totalPreRestoreDocs = 0;
      for (const col of targetCollections) {
        try {
          const docs = await driver.getCollectionDocs(col);
          preRestoreSnapshot[col] = docs;
          totalPreRestoreDocs += docs.length;
        } catch {
          preRestoreSnapshot[col] = [];
        }
      }
      preRestoreFilename = `PRE_RESTORE_SAFETY_${Date.now()}.json`;
      const snapshotPath = path.join(BACKUP_DIR, preRestoreFilename);
      const snapshotContent = JSON.stringify(preRestoreSnapshot, null, 2);
      fs.writeFileSync(snapshotPath, snapshotContent, "utf8");
      const readBack = fs.readFileSync(snapshotPath, "utf8");
      const parsedSnapshot = JSON.parse(readBack);
      const readBackDocCount = Object.values(parsedSnapshot).reduce(
        (acc, arr) => acc + (Array.isArray(arr) ? arr.length : 0),
        0
      );
      if (readBackDocCount !== totalPreRestoreDocs) {
        throw new Error(
          `Safety snapshot verification failed: disk record count (${readBackDocCount}) does not match source count (${totalPreRestoreDocs}).`
        );
      }
      job.warnings.push(`Pre-restore safety snapshot verified and archived to ${preRestoreFilename} (${readBackDocCount} docs).`);
    } catch (snapErr) {
      throw new Error(`Pre-restore safety snapshot failed: ${snapErr.message}. Aborting restore to protect production data.`);
    }
    const checkpoint = {
      jobId,
      backupId: request.backupId,
      status: "running",
      startedAt: (/* @__PURE__ */ new Date()).toISOString(),
      updatedAt: (/* @__PURE__ */ new Date()).toISOString(),
      completedBatches: 0,
      processedDocPaths: [],
      failedDocPaths: [],
      lastProcessedCollection: "",
      lastProcessedBatchIndex: 0,
      preRestoreSnapshotFile: preRestoreFilename
    };
    updateRestoreCheckpoint(checkpoint);
    const BATCH_SIZE = 250;
    const BATCH_PAUSE_MS = 100;
    for (let cIdx = 0; cIdx < targetCollections.length; cIdx++) {
      const colName = targetCollections[cIdx];
      job.phase = `Restoring Collection: ${colName} (${cIdx + 1}/${targetCollections.length})`;
      job.progressPercent = Math.round(15 + cIdx / targetCollections.length * 70);
      const colFile = files.find((f) => f.name === `firestore/collections/${colName}.json`);
      if (!colFile) continue;
      const backupDocs = JSON.parse(colFile.data.toString("utf8"));
      job.totalDocuments += backupDocs.length;
      for (let dIdx = 0; dIdx < backupDocs.length; dIdx += BATCH_SIZE) {
        const chunk = backupDocs.slice(dIdx, dIdx + BATCH_SIZE);
        for (const docItem of chunk) {
          const docPath = `${colName}/${docItem.id}`;
          const deserializedData = deserializeFirestoreValue(docItem.data);
          try {
            const { exists, data: currentData } = await driver.docExists(docPath);
            if (request.restoreMode === "RESTORE_INTO_EMPTY_PROJECT") {
              if (exists) {
                job.skippedDocuments++;
                job.warnings.push(`RESTORE_INTO_EMPTY_PROJECT: Document ${docPath} already exists; skipped.`);
              } else {
                await driver.setDoc(docPath, deserializedData, false);
                job.restoredDocuments++;
                checkpoint.processedDocPaths.push(docPath);
              }
              continue;
            }
            if (request.restoreMode === "RESTORE_MISSING_DOCUMENTS") {
              if (exists) {
                job.skippedDocuments++;
                continue;
              }
              await driver.setDoc(docPath, deserializedData, false);
              job.restoredDocuments++;
              checkpoint.processedDocPaths.push(docPath);
              continue;
            }
            if (request.restoreMode === "OVERWRITE_EXISTING_DOCUMENTS" || request.restoreMode === "MIGRATION_RESTORE") {
              if (exists) {
                if (areDocumentsIdentical(deserializedData, currentData)) {
                  job.skippedDocuments++;
                  continue;
                }
                await driver.setDoc(docPath, deserializedData, true);
                job.overwrittenDocuments++;
                checkpoint.processedDocPaths.push(docPath);
              } else {
                await driver.setDoc(docPath, deserializedData, false);
                job.restoredDocuments++;
                checkpoint.processedDocPaths.push(docPath);
              }
              continue;
            }
            if (request.restoreMode === "SELECTIVE_RESTORE") {
              await driver.setDoc(docPath, deserializedData, true);
              job.restoredDocuments++;
              checkpoint.processedDocPaths.push(docPath);
            }
          } catch (writeErr) {
            job.failedDocuments++;
            job.errors.push(`Failed writing ${docPath}: ${writeErr.message}`);
            checkpoint.failedDocPaths.push({
              path: docPath,
              error: writeErr.message,
              timestamp: (/* @__PURE__ */ new Date()).toISOString()
            });
          }
        }
        checkpoint.completedBatches++;
        checkpoint.lastProcessedCollection = colName;
        checkpoint.lastProcessedBatchIndex = dIdx;
        updateRestoreCheckpoint(checkpoint);
        await new Promise((r) => setTimeout(r, BATCH_PAUSE_MS));
      }
      const subcolDefs = SUBCOLLECTION_DEFINITIONS.filter((s) => s.parentCollection === colName);
      for (const subDef of subcolDefs) {
        const subKey = `${colName}__${subDef.subcollectionName}`;
        const subFile = files.find((f) => f.name === `firestore/subcollections/${subKey}.json`);
        if (!subFile) continue;
        const subDocs = JSON.parse(subFile.data.toString("utf8"));
        for (const sDoc of subDocs) {
          const subDocPath = `${colName}/${sDoc.parentId}/${subDef.subcollectionName}/${sDoc.id}`;
          try {
            const deserializedData = deserializeFirestoreValue(sDoc.data);
            await driver.setDoc(subDocPath, deserializedData, true);
            job.restoredDocuments++;
            checkpoint.processedDocPaths.push(subDocPath);
          } catch (sErr) {
            job.failedDocuments++;
            job.errors.push(`Failed writing subcollection ${subDocPath}: ${sErr.message}`);
            checkpoint.failedDocPaths.push({
              path: subDocPath,
              error: sErr.message,
              timestamp: (/* @__PURE__ */ new Date()).toISOString()
            });
          }
        }
        updateRestoreCheckpoint(checkpoint);
      }
      job.completedCollections++;
    }
    try {
      const auditEntry = {
        action: "DISASTER_RECOVERY_RESTORE",
        performedBy: adminUser.email,
        timestamp: (/* @__PURE__ */ new Date()).toISOString(),
        backupId: request.backupId,
        restoreMode: request.restoreMode,
        restoredCount: job.restoredDocuments,
        overwrittenCount: job.overwrittenDocuments,
        skippedCount: job.skippedDocuments,
        failedCount: job.failedDocuments
      };
      await driver.setDoc(`adminAuditLogs/restore_${jobId}`, auditEntry, false);
    } catch {
    }
    job.progressPercent = 100;
    job.phase = "Restoration Completed Successfully";
    const hasOperationalWarnings = job.warnings.some(
      (w) => !w.startsWith("Pre-restore safety snapshot")
    );
    job.status = job.errors.length > 0 || hasOperationalWarnings ? "completed_with_warnings" : "completed";
    job.completedAt = (/* @__PURE__ */ new Date()).toISOString();
    checkpoint.status = job.status;
    updateRestoreCheckpoint(checkpoint);
    return job;
  } catch (fatalErr) {
    job.status = "failed";
    job.phase = "Restoration Aborted";
    job.errors.push(fatalErr.message || String(fatalErr));
    const activeCp = getRestoreCheckpoint(jobId);
    if (activeCp) {
      activeCp.status = "failed";
      updateRestoreCheckpoint(activeCp);
    }
    return job;
  } finally {
    releaseRestoreLock(jobId);
  }
}
function listStoredBackups() {
  if (!fs.existsSync(BACKUP_DIR)) return [];
  const files = fs.readdirSync(BACKUP_DIR).filter((f) => f.endsWith(".zip"));
  const results = [];
  for (const filename of files) {
    const fullPath = path.join(BACKUP_DIR, filename);
    const stat = fs.statSync(fullPath);
    let manifestData = {};
    let integrityVerified = false;
    try {
      const zipBuf = fs.readFileSync(fullPath);
      const extracted = readZipBuffer(zipBuf);
      const mFile = extracted.find((f) => f.name === "backup_manifest.json");
      if (mFile) {
        manifestData = JSON.parse(mFile.data.toString("utf8"));
      }
      integrityVerified = true;
    } catch {
      integrityVerified = false;
    }
    results.push({
      backupId: filename,
      filename,
      fileSizeBytes: stat.size,
      createdAt: manifestData.exportTimestamp || stat.mtime.toISOString(),
      sourceProjectId: manifestData.sourceProjectId || "unknown",
      totalCollections: manifestData.totalCollections || 0,
      totalDocuments: manifestData.totalDocuments || 0,
      exportStatus: manifestData.exportStatus || "UNKNOWN",
      integrityVerified
    });
  }
  return results.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}
function deleteStoredBackup(backupId) {
  const safeFilename = path.basename(backupId);
  const targetPath = path.join(BACKUP_DIR, safeFilename);
  if (fs.existsSync(targetPath)) {
    fs.unlinkSync(targetPath);
    return true;
  }
  return false;
}
function getStoredBackupBuffer(backupId) {
  const safeFilename = path.basename(backupId);
  const targetPath = path.join(BACKUP_DIR, safeFilename);
  if (!fs.existsSync(targetPath)) {
    throw new Error(`Backup archive "${backupId}" was not found.`);
  }
  return fs.readFileSync(targetPath);
}

// src/server/snapshotPublishingService.ts
import fs2 from "fs";
import path2 from "path";
import crypto3 from "crypto";
var SnapshotPublishingService = class {
  constructor(baseDir) {
    this.baseDir = baseDir || path2.join(process.cwd(), "education-content");
    this.ensureDirectories();
  }
  ensureDirectories() {
    const dirs = [
      this.baseDir,
      path2.join(this.baseDir, "manifests"),
      path2.join(this.baseDir, "snapshots"),
      path2.join(this.baseDir, "deltas"),
      path2.join(this.baseDir, "checksums")
    ];
    for (const d of dirs) {
      if (!fs2.existsSync(d)) {
        fs2.mkdirSync(d, { recursive: true });
      }
    }
  }
  /**
   * Helper to compute SHA-256 checksum of raw string or buffer.
   */
  computeSha256(content) {
    return crypto3.createHash("sha256").update(content).digest("hex");
  }
  /**
   * Get the current active version manifest.
   */
  getCurrentManifest() {
    const manifestPath = path2.join(this.baseDir, "manifests", "current.json");
    if (!fs2.existsSync(manifestPath)) {
      return null;
    }
    return JSON.parse(fs2.readFileSync(manifestPath, "utf-8"));
  }
  /**
   * Generates and publishes an initial or new snapshot version from verified production data.
   */
  async publishNewSnapshot(options = {}) {
    const chunkSize = options.chunkSize || 200;
    const backupPath = options.sourceBackupFile || path2.join(process.cwd(), "backups", "phase2_verified_production_backup.json");
    if (!fs2.existsSync(backupPath)) {
      throw new Error(`Source backup file not found at: ${backupPath}`);
    }
    const backupData = JSON.parse(fs2.readFileSync(backupPath, "utf-8"));
    const mcqs = backupData.mcqs || [];
    const subjects = backupData.subjects || [];
    const chapters = backupData.chapters || [];
    const topics = backupData.topics || [];
    const existingManifest = this.getCurrentManifest();
    const newVersion = existingManifest ? existingManifest.snapshotVersion + 1 : 1;
    const previousVersion = existingManifest ? existingManifest.snapshotVersion : 0;
    const versionDir = path2.join(this.baseDir, "snapshots", `v${newVersion}`);
    if (!fs2.existsSync(versionDir)) {
      fs2.mkdirSync(versionDir, { recursive: true });
    }
    const chunks = [];
    const totalChunks = Math.ceil(mcqs.length / chunkSize) || 1;
    for (let i = 0; i < totalChunks; i++) {
      const sliceStart = i * chunkSize;
      const sliceEnd = sliceStart + chunkSize;
      const chunkMcqs = mcqs.slice(sliceStart, sliceEnd);
      const chunkData = {
        chunkIndex: i,
        snapshotVersion: newVersion,
        mcqs: chunkMcqs
      };
      if (i === 0) {
        chunkData.subjects = subjects;
        chunkData.chapters = chapters;
        chunkData.topics = topics;
      }
      const chunkString = JSON.stringify(chunkData);
      const chunkChecksum = this.computeSha256(chunkString);
      const chunkFileName = `chunk-${i}.json`;
      const chunkFilePath = path2.join(versionDir, chunkFileName);
      fs2.writeFileSync(chunkFilePath, chunkString, "utf-8");
      chunks.push({
        chunkIndex: i,
        url: `/api/snapshots/v${newVersion}/${chunkFileName}`,
        checksum: chunkChecksum,
        itemCount: chunkMcqs.length
      });
    }
    const fullSnapshotPayload = {
      schemaVersion: 2,
      snapshotVersion: newVersion,
      publishedAt: (/* @__PURE__ */ new Date()).toISOString(),
      subjects,
      chapters,
      topics,
      mcqs
    };
    const fullSnapshotString = JSON.stringify(fullSnapshotPayload);
    const fullChecksum = this.computeSha256(fullSnapshotString);
    fs2.writeFileSync(path2.join(versionDir, "content.json"), fullSnapshotString, "utf-8");
    fs2.writeFileSync(
      path2.join(this.baseDir, "checksums", `v${newVersion}.json`),
      JSON.stringify({ snapshotVersion: newVersion, checksum: fullChecksum, chunks }, null, 2),
      "utf-8"
    );
    const manifest = {
      schemaVersion: 2,
      snapshotVersion: newVersion,
      previousSnapshotVersion: previousVersion,
      curriculumVersion: options.curriculumVersion || newVersion,
      mcqVersion: options.mcqVersion || newVersion,
      publishedAt: (/* @__PURE__ */ new Date()).toISOString(),
      snapshotUrl: `/api/snapshots/v${newVersion}/content.json`,
      checksum: fullChecksum,
      status: "published",
      totalMcqs: mcqs.length,
      totalSubjects: subjects.length,
      totalChapters: chapters.length,
      totalTopics: topics.length,
      chunks,
      deltaAvailableFrom: previousVersion > 0 ? previousVersion : void 0
    };
    const manifestPath = path2.join(this.baseDir, "manifests", "current.json");
    const tempManifestPath = path2.join(this.baseDir, "manifests", `current.tmp.${Date.now()}.json`);
    fs2.writeFileSync(tempManifestPath, JSON.stringify(manifest, null, 2), "utf-8");
    fs2.renameSync(tempManifestPath, manifestPath);
    console.log(`[SnapshotPublishingService] Successfully published Snapshot v${newVersion} (${mcqs.length} MCQs, ${chunks.length} chunks)`);
    return manifest;
  }
  /**
   * Generates and publishes an incremental delta bundle between two versions.
   */
  async publishDelta(fromVersion, toVersion, delta) {
    const deltaPayload = {
      fromVersion,
      toVersion,
      publishedAt: (/* @__PURE__ */ new Date()).toISOString(),
      ...delta
    };
    const payloadString = JSON.stringify({
      fromVersion: deltaPayload.fromVersion,
      toVersion: deltaPayload.toVersion,
      upsertSubjects: deltaPayload.upsertSubjects || [],
      upsertChapters: deltaPayload.upsertChapters || [],
      upsertTopics: deltaPayload.upsertTopics || [],
      upsertMcqs: deltaPayload.upsertMcqs || [],
      deletedMcqIds: deltaPayload.deletedMcqIds || [],
      movedQuestions: deltaPayload.movedQuestions || []
    });
    const checksum = this.computeSha256(payloadString);
    deltaPayload.checksum = checksum;
    const deltaFileName = `v${fromVersion}-to-v${toVersion}.json`;
    const deltaFilePath = path2.join(this.baseDir, "deltas", deltaFileName);
    fs2.writeFileSync(deltaFilePath, JSON.stringify(deltaPayload, null, 2), "utf-8");
    console.log(`[SnapshotPublishingService] Published delta bundle: ${deltaFileName} (checksum: ${checksum.substring(0, 8)}...)`);
    return deltaPayload;
  }
  /**
   * Retrieve file buffer/stream for snapshot delivery.
   */
  getSnapshotFile(version, filename) {
    const sanitizedVersion = version.replace(/[^a-zA-Z0-9_-]/g, "");
    const sanitizedFilename = filename.replace(/[^a-zA-Z0-9_.-]/g, "");
    const filePath = path2.join(this.baseDir, "snapshots", sanitizedVersion, sanitizedFilename);
    return {
      filePath,
      exists: fs2.existsSync(filePath)
    };
  }
  /**
   * Retrieve delta bundle file.
   */
  getDeltaFile(filename) {
    const sanitizedFilename = filename.replace(/[^a-zA-Z0-9_.-]/g, "");
    const filePath = path2.join(this.baseDir, "deltas", sanitizedFilename);
    return {
      filePath,
      exists: fs2.existsSync(filePath)
    };
  }
};
var defaultSnapshotPublishingService = new SnapshotPublishingService();

// server.ts
var currentFilename = typeof __filename !== "undefined" ? __filename : "";
var currentDirname = typeof __dirname !== "undefined" ? __dirname : currentFilename ? path3.dirname(currentFilename) : process.cwd();
var FIREBASE_PROJECT_ID = "gen-lang-client-0811306192";
var FIRESTORE_DATABASE_ID = "ai-studio-quizproshopx-3bfab5fe-4412-4a74-8471-935f57b6f194";
var FIREBASE_API_KEY = "AIzaSyDSJtdRRNMSYnt4960wCkuyE14Yxgt_am4";
var defaultAdminApp = null;
var defaultAdminDb = null;
var defaultAdminAuth = null;
try {
  const appName = "quizpro-admin";
  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  let appConfig = { projectId: FIREBASE_PROJECT_ID };
  if (serviceAccountJson) {
    try {
      const serviceAccount = JSON.parse(serviceAccountJson);
      appConfig = { credential: cert(serviceAccount), projectId: FIREBASE_PROJECT_ID };
      console.log("[Firebase Admin] Using Service Account credentials (Vercel production mode)");
    } catch (parseErr) {
      console.error("[Firebase Admin] Failed to parse FIREBASE_SERVICE_ACCOUNT_JSON \u2014 falling back to default credentials");
    }
  } else {
    console.log("[Firebase Admin] No Service Account JSON found \u2014 using Application Default Credentials (local dev mode)");
  }
  defaultAdminApp = getApps().find((a) => a.name === appName) || initializeApp(appConfig, appName);
  try {
    defaultAdminDb = getFirestore(defaultAdminApp, FIRESTORE_DATABASE_ID);
  } catch (e) {
    console.error("[Firebase Admin] Named database access failed (fail-closed, no fallback):", redactSensitiveText(e));
    defaultAdminDb = null;
  }
  defaultAdminAuth = getAuth(defaultAdminApp);
} catch (err) {
  console.warn("[Firebase Admin Initialization Notice]:", redactSensitiveText(err));
}
var activeViteInstance = null;
var ALLOWED_PROVIDERS = /* @__PURE__ */ new Set(["gemini", "groq", "openai", "claude"]);
var SAFE_MODEL_REGEX = /^[a-zA-Z0-9._:/-]{1,100}$/;
var ALLOWED_UPLOAD_MIME_TYPES = /* @__PURE__ */ new Set(["image/jpeg", "image/jpg", "image/png", "image/webp", "application/pdf"]);
function createServerApp(deps = {}) {
  const adminDb = deps.adminDb !== void 0 ? deps.adminDb : defaultAdminDb;
  const adminAuth = deps.adminAuth !== void 0 ? deps.adminAuth : defaultAdminAuth;
  const getVite = () => deps.getViteInstance ? deps.getViteInstance() : activeViteInstance;
  const app2 = express();
  const isProd = process.env.NODE_ENV === "production" || !!process.env.VERCEL || process.env.npm_lifecycle_event === "start";
  const distPath = path3.join(process.cwd(), "dist");
  const rateLimiter = new SlidingWindowRateLimiter();
  const requireAuthenticatedUser = createRequireAuthenticatedUser(() => ({ adminAuth, adminDb }));
  const requireVerifiedAdmin = createRequireVerifiedAdmin(() => ({ adminAuth, adminDb }));
  let aiConfigsStore = [];
  let rotationPolicy = "priority_failover";
  const sanitizeConfigForClient = (c) => {
    const { encryptedApiKey, ...safe } = c;
    return {
      ...safe,
      apiKey: encryptedApiKey ? "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022" : "",
      hasKey: Boolean(encryptedApiKey)
    };
  };
  app2.use(express.json({
    limit: "15mb",
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    }
  }));
  app2.use(express.urlencoded({ extended: true, limit: "15mb" }));
  const getGeminiClient = (req, authUser) => {
    const headerKey = req ? req.headers["x-ai-api-key"] || req.headers["x-gemini-api-key"] : void 0;
    let apiKey = headerKey && headerKey.trim() || "";
    if ((!apiKey || apiKey.length < 15) && authUser?.uid) {
      apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || "";
      if ((!apiKey || apiKey.length < 15) && aiConfigsStore.length > 0) {
        const geminiCfg = aiConfigsStore.find((c) => (c.provider === "gemini" || !c.provider) && c.enabled && c.encryptedApiKey);
        if (geminiCfg && geminiCfg.encryptedApiKey) {
          const decrypted = decryptSecret(geminiCfg.encryptedApiKey);
          if (decrypted && decrypted.length >= 15) {
            apiKey = decrypted;
          }
        }
      }
    }
    if (!apiKey || apiKey === "YOUR_API_KEY" || apiKey.length < 15) return null;
    if (deps.geminiClientFactory) {
      return deps.geminiClientFactory(apiKey);
    }
    return new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build"
        }
      }
    });
  };
  const generateWithFallback = async (ai, prompt, systemInstruction) => {
    const modelsToTry = ["gemini-1.5-flash", "gemini-1.5-pro", "gemini-2.0-flash"];
    let lastError = null;
    for (const modelName of modelsToTry) {
      try {
        const contents = typeof prompt === "string" ? [{ role: "user", parts: [{ text: prompt }] }] : prompt;
        const generationConfig = { responseMimeType: "application/json" };
        const options = {
          model: modelName,
          contents,
          generationConfig
        };
        if (systemInstruction) {
          options.systemInstruction = { role: "system", parts: [{ text: systemInstruction }] };
        }
        const response = await ai.models.generateContent(options);
        if (response && response.text) {
          return response.text;
        }
      } catch (err) {
        const errStr = redactSensitiveText(err);
        if (errStr.includes("401") || errStr.includes("UNAUTHENTICATED") || errStr.includes("API key not valid")) {
          throw new Error("Gemini API Key is unauthenticated or invalid.");
        }
        console.warn(`Model ${modelName} failed, trying next fallback:`, errStr);
        lastError = err;
      }
    }
    throw lastError || new Error("All Gemini AI models failed");
  };
  function extractJsonFromResponse(text) {
    if (!text) return null;
    try {
      return JSON.parse(text);
    } catch (e) {
      try {
        const cleaned = text.replace(/```(?:json)?/g, "").replace(/```/g, "").trim();
        return JSON.parse(cleaned);
      } catch (e2) {
        const jsonMatch = text.match(/(\[[\s\S]*\]|\{[\s\S]*\})/);
        if (jsonMatch) {
          try {
            return JSON.parse(jsonMatch[0]);
          } catch (e3) {
            console.error("[extractJson] Failed regex parse:", e3);
          }
        }
        throw new Error("Failed to parse JSON from AI response.");
      }
    }
  }
  app2.get("/api/health", (_req, res) => {
    res.json({
      status: "ok",
      service: "disha-2020",
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      firebaseAdmin: Boolean(adminDb),
      snapshotVersion: defaultSnapshotPublishingService.getCurrentManifest()?.snapshotVersion || "v1"
    });
  });
  app2.get("/api/pronounce-en-gb", async (req, res) => {
    const word = String(req.query.word || "").trim();
    if (!word || word.length > 100 || !/^[a-zA-Z\s'-]+$/.test(word)) {
      return res.status(400).send("Invalid vocabulary word parameter");
    }
    try {
      const ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&tl=en-GB&client=tw-ob&q=${encodeURIComponent(word)}`;
      const response = await fetch(ttsUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
        }
      });
      if (!response.ok) {
        return res.status(502).send("Failed to fetch British TTS stream");
      }
      const buffer = await response.arrayBuffer();
      res.setHeader("Content-Type", "audio/mpeg");
      res.setHeader("Cache-Control", "public, max-age=604800, immutable");
      res.send(Buffer.from(buffer));
    } catch (err) {
      console.warn("[Pronounce en-GB Proxy Error]:", err?.message || err);
      res.status(500).send("Pronunciation service error");
    }
  });
  app2.post("/api/contact", async (req, res) => {
    try {
      const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress || "unknown";
      const rlKey = `contact:${Array.isArray(ip) ? ip[0] : String(ip).split(",")[0].trim()}`;
      const rl = rateLimiter.check(rlKey, { windowMs: 10 * 60 * 1e3, maxRequests: 10 });
      if (!rl.allowed) {
        return res.status(429).json({
          success: false,
          error: "Too Many Requests",
          message: "Too many messages sent. Please wait a few minutes before submitting again."
        });
      }
      const { name, email, subject, message } = req.body || {};
      const trimmedName = String(name || "").trim().slice(0, 100);
      const trimmedEmail = String(email || "").trim().slice(0, 150);
      const trimmedSubject = String(subject || "").trim().slice(0, 150);
      const trimmedMessage = String(message || "").trim().slice(0, 5e3);
      if (!trimmedName || trimmedName.length < 2) {
        return res.status(400).json({ success: false, message: "Valid name is required (at least 2 characters)." });
      }
      if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(trimmedEmail)) {
        return res.status(400).json({ success: false, message: "Valid email address is required." });
      }
      if (!trimmedSubject) {
        return res.status(400).json({ success: false, message: "Subject is required." });
      }
      if (!trimmedMessage || trimmedMessage.length < 10) {
        return res.status(400).json({ success: false, message: "Message must be at least 10 characters." });
      }
      const now = /* @__PURE__ */ new Date();
      const messageDoc = {
        name: trimmedName,
        email: trimmedEmail,
        subject: trimmedSubject,
        message: trimmedMessage,
        status: "new",
        statusText: "New",
        createdAt: now,
        createdIso: now.toISOString()
      };
      if (defaultAdminDb) {
        try {
          const docRef = defaultAdminDb.collection("contact_messages").doc();
          await docRef.set(messageDoc);
          console.log(`[Contact API] Message recorded in Firestore doc: ${docRef.id}`);
        } catch (dbErr) {
          console.warn("[Contact API] Failed to write message to Firestore, proceeding with acknowledgment:", dbErr?.message || dbErr);
        }
      } else {
        console.warn("[Contact API] Firestore defaultAdminDb not initialized, message acknowledged in memory.");
      }
      return res.status(200).json({
        success: true,
        message: "Thank you for contacting DISHA 20-20! Your message has been received."
      });
    } catch (err) {
      console.error("[Contact API Error]:", err);
      return res.status(500).json({
        success: false,
        message: "Failed to process contact message. Please try again later."
      });
    }
  });
  app2.post("/api/exam-paper/extract", requireAuthenticatedUser, async (req, res) => {
    try {
      const authUser = req.authUser;
      const rl = rateLimiter.check(`ai-extract:${authUser.uid}`, {
        windowMs: 6e4,
        maxRequests: authUser.isAdmin ? 60 : 12
      });
      if (!rl.allowed) {
        return res.status(429).json({
          success: false,
          questions: [],
          error: `Rate limit exceeded. Please retry in ${rl.retryAfterSeconds}s.`
        });
      }
      const { files, rawText } = req.body || {};
      if (rawText !== void 0 && (typeof rawText !== "string" || rawText.length > 8e4)) {
        return res.status(400).json({
          success: false,
          questions: [],
          error: "Invalid rawText payload or maximum length (80,000 chars) exceeded."
        });
      }
      if (files !== void 0) {
        if (!Array.isArray(files) || files.length > 5) {
          return res.status(400).json({
            success: false,
            questions: [],
            error: "Invalid files payload (maximum 5 pages per request)."
          });
        }
        for (const f of files) {
          if (!f || typeof f !== "object" || f.base64Data && (typeof f.base64Data !== "string" || f.base64Data.length > 12e6)) {
            return res.status(400).json({
              success: false,
              questions: [],
              error: "Invalid or oversized file payload."
            });
          }
          if (f.mimeType && !ALLOWED_UPLOAD_MIME_TYPES.has(String(f.mimeType).toLowerCase())) {
            return res.status(400).json({
              success: false,
              questions: [],
              error: "Unsupported file MIME type."
            });
          }
        }
      }
      const ai = getGeminiClient(req, authUser);
      let questions = [];
      if (rawText && typeof rawText === "string" && rawText.trim().length > 10) {
        if (ai) {
          try {
            const textPrompt = `You are DISHA 20-20's specialized competitive exam parser.
Extract all Multiple Choice Questions (MCQs) from this text with complete accuracy.
Preserve Hindi and English text, formulas, statements, and numbers.
Extract all options (A, B, C, D or 1, 2, 3, 4).
If a correct option or answer is indicated, include it as "answer" (e.g. "A", "B", "1") and "correctIndex" (0-based integer, or -1 if not indicated).
If an explanation is present, include it as "explanation".

Text to extract:
${rawText}

Return ONLY a JSON array of question objects with fields:
originalQuestionNumber (number),
originalText (string),
extractedOptions (array of strings),
questionType (string: standard | statement_based | match_following | assertion_reason),
answer (string, optional),
correctIndex (number, optional),
explanation (string, optional)`;
            const resText = await generateWithFallback(ai, textPrompt);
            const parsed = extractJsonFromResponse(resText);
            const qList = Array.isArray(parsed) ? parsed : parsed.questions || parsed.mcqs || [];
            qList.forEach((q, idx) => {
              questions.push({
                tempId: `draft-text-ai-${Date.now()}-${idx + 1}`,
                originalQuestionNumber: q.originalQuestionNumber || idx + 1,
                sourcePageNumber: 1,
                originalText: q.originalText || q.question || q.text || "",
                extractedOptions: Array.isArray(q.extractedOptions) && q.extractedOptions.length >= 2 ? q.extractedOptions : Array.isArray(q.options) && q.options.length >= 2 ? q.options : ["Option A", "Option B", "Option C", "Option D"],
                ocrStatus: "high",
                ocrConfidence: 0.98,
                questionType: q.questionType || "standard",
                isFlaggedForReview: false,
                answer: q.answer || "",
                correctIndex: typeof q.correctIndex === "number" ? q.correctIndex : -1,
                explanation: q.explanation || ""
              });
            });
          } catch (textAiErr) {
            console.warn("AI text extraction notice in /api/exam-paper/extract:", redactSensitiveText(textAiErr));
          }
        }
        if (questions.length === 0) {
          try {
            const localRes = parseRawMcqText(rawText);
            if (localRes.questions && localRes.questions.length > 0) {
              localRes.questions.forEach((q, idx) => {
                questions.push({
                  tempId: `draft-text-local-${Date.now()}-${idx + 1}`,
                  originalQuestionNumber: idx + 1,
                  sourcePageNumber: 1,
                  originalText: q.question || q.text || "",
                  extractedOptions: q.options && q.options.length >= 2 ? q.options : ["Option A", "Option B", "Option C", "Option D"],
                  ocrStatus: "high",
                  ocrConfidence: q.confidence || 0.95,
                  questionType: q.type || "standard",
                  isFlaggedForReview: !q.isValid,
                  answer: q.answer || "",
                  correctIndex: typeof q.correctIndex === "number" ? q.correctIndex : -1,
                  explanation: q.explanation || ""
                });
              });
            }
          } catch (localParseErr) {
            console.warn("Local parse fallback notice:", redactSensitiveText(localParseErr));
          }
        }
      }
      if (Array.isArray(files) && files.length > 0) {
        if (!ai) {
          return res.status(200).json({
            questions: [],
            success: false,
            error: "Google Gemini API key is missing or invalid. Please configure your key in Settings > AI API Settings to scan exam paper images.",
            requiresApiKey: true
          });
        }
        for (const file of files) {
          if (!file.base64Data) continue;
          const cleanBase64 = file.base64Data.replace(/^data:[^;]+;base64,/, "").trim();
          if (!cleanBase64) continue;
          const mimeType = file.mimeType && file.mimeType.includes("/") ? file.mimeType : file.name?.toLowerCase().endsWith(".pdf") ? "application/pdf" : "image/jpeg";
          try {
            const prompt = [
              {
                inlineData: {
                  mimeType,
                  data: cleanBase64
                }
              },
              {
                text: `You are an expert OCR and Exam Paper extraction system specialized in competitive exam papers (such as RAS, UPSC, REET, Patwar, Police, SSC, State PSC).
Transcribe all Multiple Choice Questions (MCQs) visible in this exam paper page.
Requirements:
1. Transcribe both Hindi and English accurately, preserving original wording, equations, formulas, and numbers.
2. Extract the question number into "originalQuestionNumber" (e.g. 1, 2, 3...).
3. Extract the full question stem into "originalText".
4. Extract all 4 (or 5) options exactly as printed into "extractedOptions" (array of strings, e.g. ["A. ...", "B. ...", "C. ...", "D. ..."] or plain text).
5. If an answer key, circle, tick, or correct option is marked, extract it into "answer" (e.g. "A", "1", etc.) and "correctIndex" (0, 1, 2, 3).
6. Classify "questionType" as "standard", "statement_based", "match_following", or "assertion_reason".

Return ONLY a JSON array of objects:
[
  {
    "originalQuestionNumber": 1,
    "originalText": "Question stem text in Hindi/English",
    "extractedOptions": ["Option 1", "Option 2", "Option 3", "Option 4"],
    "questionType": "standard",
    "answer": "A",
    "correctIndex": 0
  }
]`
              }
            ];
            const resText = await generateWithFallback(ai, prompt);
            const parsed = extractJsonFromResponse(resText);
            const qList = Array.isArray(parsed) ? parsed : parsed.questions || parsed.mcqs || [];
            qList.forEach((q, idx) => {
              questions.push({
                tempId: `draft-server-${Date.now()}-${file.pageNumber || 1}-${idx + 1}`,
                originalQuestionNumber: q.originalQuestionNumber || questions.length + 1,
                sourcePageNumber: file.pageNumber || 1,
                originalText: q.originalText || q.question || "",
                extractedOptions: Array.isArray(q.extractedOptions) && q.extractedOptions.length >= 2 ? q.extractedOptions : Array.isArray(q.options) && q.options.length >= 2 ? q.options : ["Option A", "Option B", "Option C", "Option D"],
                ocrStatus: "high",
                ocrConfidence: 0.95,
                questionType: q.questionType || "standard",
                isFlaggedForReview: false,
                answer: q.answer || "",
                correctIndex: typeof q.correctIndex === "number" ? q.correctIndex : -1,
                explanation: q.explanation || ""
              });
            });
          } catch (visionErr) {
            console.warn("Gemini Vision OCR single file notice:", visionErr?.message || visionErr);
          }
        }
      }
      if (questions.length === 0) {
        return res.json({
          questions: [],
          success: true,
          warning: "No readable questions detected from the document/image. Please ensure the paper is clear, right-side-up, and legible."
        });
      }
      res.json({ questions, success: true });
    } catch (err) {
      console.warn("Notice in /api/exam-paper/extract:", redactSensitiveText(err));
      res.status(500).json({ questions: [], success: false, error: redactSensitiveText(err) || "Extraction failed" });
    }
  });
  app2.post("/api/admin/news/ai-write", requireVerifiedAdmin, async (req, res) => {
    try {
      const authUser = req.authUser;
      const { topic, examTarget, language, category } = req.body || {};
      if (!topic || typeof topic !== "string" || topic.trim().length > 1e3) {
        return res.status(400).json({ success: false, error: "Valid topic string (<= 1000 chars) is required." });
      }
      const ai = getGeminiClient(req, authUser);
      if (!ai) {
        return res.status(200).json({ success: false, error: "Gemini API key is missing or invalid. Please configure your key in AI API Settings." });
      }
      const prompt = `Write a comprehensive, professional educational news article or exam guide.
Target Topic: ${topic}
Target Exam: ${examTarget || "RPSC & Competitive Exams"}
Language: ${language || "Both Hindi and English"}
Category: ${category || "Current Affairs"}

Return ONLY valid JSON with keys:
{
  "title": "English Title",
  "hindiTitle": "Hindi Title",
  "subtitle": "Subtitle",
  "slug": "kebab-case-slug",
  "category": "${category || "Current Affairs"}",
  "language": "Both",
  "excerpt": "Short 2-sentence summary",
  "content": "Full article markdown content",
  "authorName": "DISHA 20-20 Editorial Team",
  "authorBio": "Senior Exam Analyst",
  "status": "published",
  "tags": ["Exam", "Study Guide"],
  "seoTitle": "SEO optimized title under 60 chars",
  "seoDescription": "Meta description under 150 chars",
  "focusKeyword": "main keyword",
  "faqs": [{"question": "FAQ 1?", "answer": "Answer 1"}]
}`;
      const resText = await generateWithFallback(ai, prompt);
      const article = extractJsonFromResponse(resText);
      article.id = `art_${Date.now()}`;
      article.publishedAt = (/* @__PURE__ */ new Date()).toISOString();
      article.createdAt = (/* @__PURE__ */ new Date()).toISOString();
      article.views = 0;
      res.json({ success: true, article });
    } catch (err) {
      console.warn("Notice in /api/admin/news/ai-write:", redactSensitiveText(err));
      res.status(200).json({ success: false, error: redactSensitiveText(err) || "AI generation failed" });
    }
  });
  app2.post("/api/admin/news/ai-assist", requireVerifiedAdmin, async (req, res) => {
    try {
      const authUser = req.authUser;
      const { title, text } = req.body || {};
      if (!title || typeof title !== "string" || title.length > 500) {
        return res.status(400).json({ success: false, error: "Valid article title is required." });
      }
      if (text && (typeof text !== "string" || text.length > 2e4)) {
        return res.status(400).json({ success: false, error: "Article text exceeds maximum allowed length." });
      }
      const ai = getGeminiClient(req, authUser);
      if (!ai) {
        return res.status(200).json({ success: false, error: "Gemini API key is missing or invalid" });
      }
      const prompt = `Optimize SEO fields for article with title: "${title}" and excerpt: "${text || ""}".
Return ONLY JSON with keys:
{
  "seoTitle": "Catchy SEO Title (50-60 chars)",
  "seoDescription": "Compelling Meta Description (120-150 chars)",
  "focusKeyword": "Primary Keyword",
  "suggestedSlug": "clean-seo-slug",
  "tags": ["tag1", "tag2", "tag3"]
}`;
      const resText = await generateWithFallback(ai, prompt);
      const result = extractJsonFromResponse(resText);
      res.json({ success: true, result });
    } catch (err) {
      console.error("Error in /api/admin/news/ai-assist:", redactSensitiveText(err));
      res.status(500).json({ success: false, error: redactSensitiveText(err) || "AI SEO optimization failed" });
    }
  });
  app2.get("/api/admin/firebase-info", requireVerifiedAdmin, (_req, res) => {
    res.json({
      success: true,
      projectId: FIREBASE_PROJECT_ID,
      databaseId: FIRESTORE_DATABASE_ID,
      region: "asia-east1",
      status: adminDb ? "connected" : "initialization_failed",
      encryptionKeyMode
    });
  });
  let cachedMetrics = null;
  let cachedMetricsTimestamp = 0;
  const METRICS_CACHE_TTL_MS = 60 * 1e3;
  app2.get("/api/admin/firebase-storage-metrics", requireVerifiedAdmin, async (req, res) => {
    const forceRefresh = req.query.force === "true";
    const now = Date.now();
    if (!forceRefresh && cachedMetrics && now - cachedMetricsTimestamp < METRICS_CACHE_TTL_MS) {
      return res.json({
        ...cachedMetrics,
        fromCache: true,
        cacheAgeMs: now - cachedMetricsTimestamp
      });
    }
    try {
      const collectionsToMeasure = [
        "mcqs",
        "questions",
        "subjects",
        "chapters",
        "topics",
        "articles",
        "users",
        "liveTests",
        "pyq_papers",
        "import_batches"
      ];
      const collectionCounts = {};
      let totalDocuments = 0;
      await Promise.allSettled(
        collectionsToMeasure.map(async (col) => {
          try {
            const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/${FIRESTORE_DATABASE_ID}/documents:runAggregationQuery?key=${FIREBASE_API_KEY}`;
            const queryRes = await fetch(url, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                structuredAggregationQuery: {
                  structuredQuery: { from: [{ collectionId: col }] },
                  aggregations: [{ alias: "count", count: {} }]
                }
              })
            });
            if (queryRes.ok) {
              const data = await queryRes.json();
              const countVal = data?.[0]?.result?.aggregateFields?.count?.integerValue;
              const count = countVal ? parseInt(countVal, 10) : 0;
              collectionCounts[col] = count;
              totalDocuments += count;
            } else {
              collectionCounts[col] = 0;
            }
          } catch (_) {
            collectionCounts[col] = 0;
          }
        })
      );
      const estimatedBytesPerDoc = 1250;
      const firestoreSizeEstimatedBytes = totalDocuments * estimatedBytesPerDoc;
      const firestoreSizeMb = Number((firestoreSizeEstimatedBytes / (1024 * 1024)).toFixed(2));
      const bucketName = "gen-lang-client-0811306192.firebasestorage.app";
      let storageStatus = "unprovisioned";
      let storageUsedBytes = 0;
      let storageFileCount = 0;
      let storageCapacityBytes = null;
      let storageRemainingBytes = null;
      let storageConsumptionPercent = 0;
      try {
        const storageUrl = `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o?key=${FIREBASE_API_KEY}`;
        const sRes = await fetch(storageUrl);
        if (sRes.ok) {
          const sData = await sRes.json();
          storageStatus = "connected";
          const items = sData?.items || [];
          storageFileCount = items.length;
          storageCapacityBytes = 5 * 1024 * 1024 * 1024;
          storageUsedBytes = items.reduce((acc, item) => acc + (parseInt(item.size, 10) || 0), 0);
          storageRemainingBytes = Math.max(0, storageCapacityBytes - storageUsedBytes);
          storageConsumptionPercent = Number((storageUsedBytes / storageCapacityBytes * 100).toFixed(2));
        } else if (sRes.status === 404) {
          storageStatus = "unprovisioned";
        }
      } catch (_) {
        storageStatus = "error";
      }
      const metricsResult = {
        success: true,
        projectId: FIREBASE_PROJECT_ID,
        databaseId: FIRESTORE_DATABASE_ID,
        region: "asia-east1",
        storage: {
          bucketName,
          status: storageStatus,
          isProvisioned: storageStatus === "connected",
          capacityBytes: storageCapacityBytes,
          capacityText: storageCapacityBytes ? "5.0 GB (Spark Plan)" : "Quota not applicable",
          usedBytes: storageUsedBytes,
          usedMb: Number((storageUsedBytes / (1024 * 1024)).toFixed(2)),
          remainingBytes: storageRemainingBytes,
          remainingMb: storageRemainingBytes ? Number((storageRemainingBytes / (1024 * 1024)).toFixed(2)) : null,
          remainingText: storageRemainingBytes !== null ? `${(storageRemainingBytes / (1024 * 1024 * 1024)).toFixed(2)} GB` : "Quota not applicable",
          consumptionPercent: storageConsumptionPercent,
          fileCount: storageFileCount
        },
        firestore: {
          databaseSizeMb: firestoreSizeMb,
          databaseSizeBytes: firestoreSizeEstimatedBytes,
          totalDocumentCount: totalDocuments,
          collections: collectionCounts,
          capacityText: "Quota not applicable (Serverless pay-as-you-go)",
          freeTierStorageLimit: "1.0 GB Free Tier (Stored Data)",
          freeTierDailyLimits: {
            reads: 5e4,
            writes: 2e4,
            deletes: 2e4
          }
        },
        timestamp: (/* @__PURE__ */ new Date()).toISOString(),
        lastUpdatedTime: (/* @__PURE__ */ new Date()).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
      };
      cachedMetrics = metricsResult;
      cachedMetricsTimestamp = now;
      res.json(metricsResult);
    } catch (err) {
      console.error("[API Firebase Storage Metrics Error]:", err);
      res.status(500).json({
        success: false,
        error: err?.message || "Failed to retrieve Firebase storage metrics"
      });
    }
  });
  app2.get("/api/admin/backup/collections", requireVerifiedAdmin, (_req, res) => {
    res.json({
      success: true,
      collections: VERIFIED_QUIZPRO_COLLECTIONS,
      totalCount: VERIFIED_QUIZPRO_COLLECTIONS.length
    });
  });
  app2.post("/api/admin/backup/export", requireVerifiedAdmin, async (req, res) => {
    try {
      const { scope = "full", selectedCollections = [], exportStorage = true } = req.body || {};
      const jobId = `export_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const adminBearerToken = (req.headers.authorization || "").replace(/^Bearer\s+/i, "").trim();
      executeExportJob(
        jobId,
        {
          scope: scope === "selective" ? "selective" : "full",
          selectedCollections: Array.isArray(selectedCollections) ? selectedCollections : void 0,
          exportStorage: Boolean(exportStorage),
          adminBearerToken
        },
        {
          adminDb,
          projectId: FIREBASE_PROJECT_ID,
          databaseId: FIRESTORE_DATABASE_ID,
          apiKey: FIREBASE_API_KEY
        }
      ).catch((jobErr) => {
        console.error(`[Backup Export Fatal Error] Job ${jobId}:`, jobErr);
      });
      res.json({
        success: true,
        jobId,
        message: "Backup export job initiated successfully."
      });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message || "Failed to initiate backup export." });
    }
  });
  app2.get("/api/admin/backup/jobs/:jobId", requireVerifiedAdmin, (req, res) => {
    const job = getActiveJob(req.params.jobId);
    if (!job) {
      return res.status(404).json({ success: false, error: "Job not found or expired." });
    }
    res.json({ success: true, job });
  });
  app2.get("/api/admin/backup/history", requireVerifiedAdmin, (_req, res) => {
    try {
      const backups = listStoredBackups();
      res.json({ success: true, backups });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message || "Failed to list backup history." });
    }
  });
  app2.delete("/api/admin/backup/history/:backupId", requireVerifiedAdmin, (req, res) => {
    try {
      const deleted = deleteStoredBackup(req.params.backupId);
      if (!deleted) {
        return res.status(404).json({ success: false, error: "Backup archive not found." });
      }
      res.json({ success: true, message: "Backup archive deleted from local storage." });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message || "Failed to delete backup archive." });
    }
  });
  app2.get("/api/admin/backup/download/:backupId", requireVerifiedAdmin, (req, res) => {
    try {
      const buffer = getStoredBackupBuffer(req.params.backupId);
      const safeFilename = path3.basename(req.params.backupId);
      res.setHeader("Content-Type", "application/zip");
      res.setHeader("Content-Disposition", `attachment; filename="${safeFilename}"`);
      res.setHeader("Content-Length", buffer.length);
      res.send(buffer);
    } catch (err) {
      res.status(404).json({ success: false, error: err.message || "Backup file not found." });
    }
  });
  app2.post("/api/admin/backup/upload-validate", requireVerifiedAdmin, async (req, res) => {
    try {
      const { zipBase64, filename = "uploaded_backup.zip" } = req.body || {};
      if (!zipBase64 || typeof zipBase64 !== "string") {
        return res.status(400).json({ success: false, error: "Missing zipBase64 file payload." });
      }
      const zipBuffer = Buffer.from(zipBase64, "base64");
      if (zipBuffer.length === 0) {
        return res.status(400).json({ success: false, error: "Empty file payload received." });
      }
      const adminBearerToken = (req.headers.authorization || "").replace(/^Bearer\s+/i, "").trim();
      const preview = await generateRestorePreview(
        zipBuffer,
        filename,
        {
          adminDb,
          projectId: FIREBASE_PROJECT_ID,
          databaseId: FIRESTORE_DATABASE_ID,
          apiKey: FIREBASE_API_KEY
        },
        adminBearerToken
      );
      const stageFilename = `STAGED_${Date.now()}_${path3.basename(filename)}`;
      const stagePath = path3.join(path3.resolve(process.cwd(), "backups"), stageFilename);
      fs3.writeFileSync(stagePath, zipBuffer);
      preview.backupId = stageFilename;
      res.json({ success: true, preview });
    } catch (err) {
      console.error("[Upload Validate Error]:", err);
      res.status(400).json({ success: false, error: err.message || "Archive validation failed." });
    }
  });
  app2.post("/api/admin/backup/restore", requireVerifiedAdmin, async (req, res) => {
    try {
      const { backupId, restoreMode, confirmationPhrase, selectedCollections, skipStorage } = req.body || {};
      if (!backupId || !restoreMode || !confirmationPhrase) {
        return res.status(400).json({
          success: false,
          error: "Missing required parameters: backupId, restoreMode, confirmationPhrase."
        });
      }
      const buffer = getStoredBackupBuffer(backupId);
      const jobId = `restore_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const adminBearerToken = (req.headers.authorization || "").replace(/^Bearer\s+/i, "").trim();
      executeRestoreJob(
        jobId,
        {
          backupId,
          restoreMode,
          confirmationPhrase,
          selectedCollections,
          skipStorage
        },
        buffer,
        { uid: req.authUser.uid, email: req.authUser.email },
        {
          adminDb,
          projectId: FIREBASE_PROJECT_ID,
          databaseId: FIRESTORE_DATABASE_ID,
          apiKey: FIREBASE_API_KEY
        },
        adminBearerToken
      ).catch((rErr) => {
        console.error(`[Backup Restore Fatal Error] Job ${jobId}:`, rErr);
      });
      res.json({
        success: true,
        jobId,
        message: "Disaster recovery restore job initiated."
      });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message || "Failed to start restore job." });
    }
  });
  app2.get("/api/admin/ai-rotation/status", requireVerifiedAdmin, (_req, res) => {
    res.json({
      success: true,
      activeProvider: "Gemini AI Studio (Native)",
      policy: rotationPolicy,
      quotaHealth: "100%",
      isHealthy: true,
      encryptionKeyMode
    });
  });
  app2.post("/api/admin/ai-rotation/policy", requireVerifiedAdmin, (req, res) => {
    const { policy } = req.body || {};
    if (policy !== "priority_failover" && policy !== "round_robin") {
      return res.status(400).json({ success: false, error: "Invalid rotation policy." });
    }
    rotationPolicy = policy;
    res.json({ success: true, policy: rotationPolicy, message: "Rotation policy updated" });
  });
  app2.get("/api/admin/ai-configs", requireVerifiedAdmin, (_req, res) => {
    res.json({ success: true, configs: aiConfigsStore.map(sanitizeConfigForClient) });
  });
  app2.post("/api/admin/ai-configs", requireVerifiedAdmin, (req, res) => {
    try {
      const { name, provider = "gemini", model, apiKey, enabled, priority } = req.body || {};
      if (!ALLOWED_PROVIDERS.has(String(provider))) {
        return res.status(400).json({ success: false, error: "Unsupported AI provider." });
      }
      const targetModel = model || (provider === "gemini" ? "gemini-2.5-flash" : provider === "groq" ? "llama-3.3-70b-versatile" : "gpt-4o-mini");
      if (!SAFE_MODEL_REGEX.test(String(targetModel))) {
        return res.status(400).json({ success: false, error: "Invalid model identifier." });
      }
      const id = `config_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const newConfig = {
        id,
        name: String(name || `${provider} Key`).slice(0, 100),
        provider: String(provider),
        model: String(targetModel),
        apiKey: apiKey ? "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022" : "",
        encryptedApiKey: apiKey && typeof apiKey === "string" && !apiKey.includes("\u2022\u2022\u2022\u2022") ? encryptSecret(apiKey) : "",
        enabled: enabled ?? true,
        priority: typeof priority === "number" ? priority : aiConfigsStore.length + 1,
        status: "available",
        createdAt: (/* @__PURE__ */ new Date()).toISOString(),
        updatedAt: (/* @__PURE__ */ new Date()).toISOString()
      };
      aiConfigsStore.push(newConfig);
      res.json({ success: true, id, config: sanitizeConfigForClient(newConfig) });
    } catch (err) {
      res.status(500).json({ success: false, error: redactSensitiveText(err) || "Failed to save AI config" });
    }
  });
  app2.put("/api/admin/ai-configs/:id", requireVerifiedAdmin, (req, res) => {
    try {
      const id = String(req.params.id || "");
      if (!isValidFirestoreDocId(id)) {
        return res.status(400).json({ success: false, error: "Invalid config ID." });
      }
      const { name, provider, model, apiKey, enabled, priority } = req.body || {};
      if (provider !== void 0 && !ALLOWED_PROVIDERS.has(String(provider))) {
        return res.status(400).json({ success: false, error: "Unsupported AI provider." });
      }
      if (model !== void 0 && !SAFE_MODEL_REGEX.test(String(model))) {
        return res.status(400).json({ success: false, error: "Invalid model identifier." });
      }
      const existingIdx = aiConfigsStore.findIndex((c) => c.id === id);
      if (existingIdx === -1) {
        const prov = String(provider || "gemini");
        const newConfig = {
          id,
          name: String(name || `${prov} Key`).slice(0, 100),
          provider: prov,
          model: String(model || (prov === "gemini" ? "gemini-2.5-flash" : prov === "groq" ? "llama-3.3-70b-versatile" : "gpt-4o-mini")),
          apiKey: apiKey ? "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022" : "",
          encryptedApiKey: apiKey && typeof apiKey === "string" && !apiKey.includes("\u2022\u2022\u2022\u2022") ? encryptSecret(apiKey) : "",
          enabled: enabled ?? true,
          priority: typeof priority === "number" ? priority : 1,
          status: "available",
          updatedAt: (/* @__PURE__ */ new Date()).toISOString()
        };
        aiConfigsStore.push(newConfig);
        return res.json({ success: true, id, config: sanitizeConfigForClient(newConfig) });
      }
      const updatedEncryptedKey = apiKey && typeof apiKey === "string" && !apiKey.includes("\u2022\u2022\u2022\u2022") ? encryptSecret(apiKey) : aiConfigsStore[existingIdx].encryptedApiKey;
      aiConfigsStore[existingIdx] = {
        ...aiConfigsStore[existingIdx],
        name: name ? String(name).slice(0, 100) : aiConfigsStore[existingIdx].name,
        provider: provider ? String(provider) : aiConfigsStore[existingIdx].provider,
        model: model ? String(model) : aiConfigsStore[existingIdx].model,
        encryptedApiKey: updatedEncryptedKey,
        enabled: enabled ?? aiConfigsStore[existingIdx].enabled,
        priority: priority ?? aiConfigsStore[existingIdx].priority,
        updatedAt: (/* @__PURE__ */ new Date()).toISOString()
      };
      res.json({ success: true, id, config: sanitizeConfigForClient(aiConfigsStore[existingIdx]) });
    } catch (err) {
      res.status(500).json({ success: false, error: redactSensitiveText(err) || "Failed to update AI config" });
    }
  });
  app2.put("/api/admin/ai-configs/:id/toggle", requireVerifiedAdmin, (req, res) => {
    const id = String(req.params.id || "");
    const { enabled } = req.body || {};
    const cfg = aiConfigsStore.find((c) => c.id === id);
    if (!cfg) {
      return res.status(404).json({ success: false, error: "AI config not found." });
    }
    cfg.enabled = Boolean(enabled);
    cfg.status = cfg.enabled ? "available" : "disabled";
    res.json({ success: true, id, enabled: cfg.enabled });
  });
  app2.post("/api/admin/ai-configs/:id/reset", requireVerifiedAdmin, (req, res) => {
    const id = String(req.params.id || "");
    const cfg = aiConfigsStore.find((c) => c.id === id);
    if (!cfg) {
      return res.status(404).json({ success: false, error: "AI config not found." });
    }
    cfg.status = "available";
    cfg.consecutiveErrors = 0;
    cfg.remainingCooldownSec = 0;
    res.json({ success: true, id, status: "available" });
  });
  app2.delete("/api/admin/ai-configs/:id", requireVerifiedAdmin, (req, res) => {
    const id = String(req.params.id || "");
    aiConfigsStore = aiConfigsStore.filter((c) => c.id !== id);
    res.json({ success: true, id, message: "AI config deleted" });
  });
  app2.post("/api/admin/ai-configs/sync", requireVerifiedAdmin, (req, res) => {
    try {
      const { configs } = req.body || {};
      if (Array.isArray(configs)) {
        configs.slice(0, 50).forEach((incoming) => {
          if (!incoming || !isValidFirestoreDocId(incoming.id)) return;
          const idx = aiConfigsStore.findIndex((c) => c.id === incoming.id);
          const encryptedKey = incoming.apiKey && typeof incoming.apiKey === "string" && !incoming.apiKey.includes("\u2022\u2022\u2022\u2022") ? encryptSecret(incoming.apiKey) : idx !== -1 ? aiConfigsStore[idx].encryptedApiKey : "";
          const entry = {
            id: incoming.id,
            name: String(incoming.name || "AI Key").slice(0, 100),
            provider: ALLOWED_PROVIDERS.has(String(incoming.provider)) ? String(incoming.provider) : "gemini",
            model: SAFE_MODEL_REGEX.test(String(incoming.model || "")) ? String(incoming.model) : "gemini-2.5-flash",
            enabled: incoming.enabled ?? true,
            priority: typeof incoming.priority === "number" ? incoming.priority : 1,
            status: incoming.status || "available",
            encryptedApiKey: encryptedKey,
            apiKey: "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022",
            updatedAt: (/* @__PURE__ */ new Date()).toISOString()
          };
          if (idx === -1) {
            aiConfigsStore.push(entry);
          } else {
            aiConfigsStore[idx] = { ...aiConfigsStore[idx], ...entry };
          }
        });
      }
      res.json({ success: true, message: "AI configs synced", count: aiConfigsStore.length });
    } catch (err) {
      res.status(400).json({ success: false, error: redactSensitiveText(err) || "Failed to sync AI configs" });
    }
  });
  app2.post("/api/admin/ai-configs/reorder", requireVerifiedAdmin, (req, res) => {
    const { priorities } = req.body || {};
    if (priorities && typeof priorities === "object") {
      aiConfigsStore = aiConfigsStore.map((cfg) => ({
        ...cfg,
        priority: typeof priorities[cfg.id] === "number" ? priorities[cfg.id] : cfg.priority
      }));
    }
    res.json({ success: true, message: "AI configs reordered" });
  });
  app2.post("/api/ai/test-key", requireVerifiedAdmin, async (req, res) => {
    try {
      const authUser = req.authUser;
      const rl = rateLimiter.check(`ai-test:${authUser.uid}`, { windowMs: 6e4, maxRequests: 30 });
      if (!rl.allowed) {
        return res.status(429).json({ success: false, message: `Rate limit exceeded. Retry in ${rl.retryAfterSeconds}s.` });
      }
      let { apiKey, configId, provider = "gemini", model } = req.body || {};
      if (!ALLOWED_PROVIDERS.has(String(provider))) {
        return res.status(400).json({ success: false, message: `Unsupported provider: ${String(provider)}` });
      }
      if (model && !SAFE_MODEL_REGEX.test(String(model))) {
        return res.status(400).json({ success: false, message: "Invalid model identifier." });
      }
      if (configId && (!apiKey || String(apiKey).includes("\u2022\u2022\u2022\u2022"))) {
        if (!isValidFirestoreDocId(configId)) {
          return res.status(400).json({ success: false, message: "Invalid configId format." });
        }
        const foundConfig = aiConfigsStore.find((c) => c.id === configId);
        if (!foundConfig) {
          return res.status(404).json({ success: false, message: "Referenced AI configuration was not found on server." });
        }
        if (foundConfig.encryptedApiKey) {
          apiKey = decryptSecret(foundConfig.encryptedApiKey);
        }
        if (foundConfig.provider) provider = foundConfig.provider;
        if (foundConfig.model) model = foundConfig.model;
      }
      const keyToUse = apiKey && typeof apiKey === "string" && !apiKey.includes("\u2022\u2022\u2022\u2022") ? apiKey.trim() : process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || "";
      if (!keyToUse) {
        return res.status(400).json({ success: false, message: "No valid API key provided or found in server configuration." });
      }
      const startTime = Date.now();
      if (provider === "gemini") {
        const targetModel = model && model !== "default" && model !== "custom" && model !== "gemini-1.5-flash" ? model : "gemini-1.5-flash";
        const ai = deps.geminiClientFactory ? deps.geminiClientFactory(keyToUse) : new GoogleGenAI({ apiKey: keyToUse });
        const fallbackModels = Array.from(/* @__PURE__ */ new Set([targetModel, "gemini-1.5-flash", "gemini-1.5-pro", "gemini-2.0-flash"]));
        let testRes = null;
        let lastErr = null;
        for (const mName of fallbackModels) {
          try {
            testRes = await ai.models.generateContent({
              model: mName,
              contents: [{ text: "Ping test. Reply with OK" }],
              config: { maxOutputTokens: 10, temperature: 0 }
            });
            if (testRes && (testRes.text || testRes.candidates)) {
              break;
            }
          } catch (fErr) {
            console.warn(`[test-key] Gemini model ${mName} test notice:`, redactSensitiveText(fErr));
            lastErr = fErr;
          }
        }
        const latencyMs = Date.now() - startTime;
        if (testRes && (testRes.text || testRes.candidates)) {
          return res.json({
            success: true,
            message: `Google Gemini API key verified successfully! (${latencyMs}ms)`,
            latencyMs
          });
        }
        if (lastErr) throw lastErr;
        return res.json({ success: false, message: "Gemini check produced empty response." });
      } else if (provider === "groq") {
        const targetModel = model && model !== "default" && model !== "custom" && model !== "qwen/qwen3.8-27b" ? model : "llama-3.3-70b-versatile";
        const groqResp = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${keyToUse}`
          },
          body: JSON.stringify({
            model: targetModel,
            messages: [{ role: "user", content: "Ping test. Reply with OK" }],
            max_tokens: 10,
            temperature: 0
          })
        });
        const latencyMs = Date.now() - startTime;
        if (groqResp.ok) {
          return res.json({ success: true, message: `Groq LPU API Key verified successfully! (${latencyMs}ms)`, latencyMs });
        } else {
          const errJson = await groqResp.json().catch(() => ({}));
          return res.json({ success: false, message: redactSensitiveText(errJson?.error?.message) || `Groq HTTP ${groqResp.status}` });
        }
      } else if (provider === "openai") {
        const targetModel = model && model !== "default" && model !== "custom" ? model : "gpt-4o-mini";
        const oaiResp = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${keyToUse}`
          },
          body: JSON.stringify({
            model: targetModel,
            messages: [{ role: "user", content: "Ping test. Reply with OK" }],
            max_tokens: 10,
            temperature: 0
          })
        });
        const latencyMs = Date.now() - startTime;
        if (oaiResp.ok) {
          return res.json({ success: true, message: `OpenAI API Key verified successfully! (${latencyMs}ms)`, latencyMs });
        } else {
          const errJson = await oaiResp.json().catch(() => ({}));
          return res.json({ success: false, message: redactSensitiveText(errJson?.error?.message) || `OpenAI HTTP ${oaiResp.status}` });
        }
      } else if (provider === "claude") {
        const targetModel = model && model !== "default" && model !== "custom" ? model : "claude-3-5-haiku-20241022";
        const claudeResp = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": keyToUse,
            "anthropic-version": "2023-06-01"
          },
          body: JSON.stringify({
            model: targetModel,
            max_tokens: 10,
            messages: [{ role: "user", content: "Ping test. Reply with OK" }]
          })
        });
        const latencyMs = Date.now() - startTime;
        if (claudeResp.ok) {
          return res.json({ success: true, message: `Claude API Key verified successfully! (${latencyMs}ms)`, latencyMs });
        } else {
          const errJson = await claudeResp.json().catch(() => ({}));
          return res.json({ success: false, message: redactSensitiveText(errJson?.error?.message) || `Claude HTTP ${claudeResp.status}` });
        }
      }
      return res.json({ success: false, message: `Unsupported provider: ${provider}` });
    } catch (err) {
      console.error("[test-key] Error testing key:", redactSensitiveText(err));
      res.status(500).json({ success: false, message: redactSensitiveText(err) || "API Key validation failed" });
    }
  });
  app2.post("/api/ai/ai-mcq-import", requireVerifiedAdmin, async (req, res) => {
    try {
      const authUser = req.authUser;
      const { prompt: userPrompt, subject, chapter, topic, jsonContent } = req.body || {};
      const serialized = JSON.stringify(jsonContent || userPrompt || "");
      if (serialized.length > 6e4) {
        return res.status(400).json({ success: false, error: "Payload size limit exceeded.", questions: [] });
      }
      const ai = getGeminiClient(req, authUser);
      if (!ai) {
        return res.status(400).json({ success: false, error: "Gemini API key missing or invalid. Please configure your key in AI API Settings." });
      }
      const prompt = `Generate 5 high-quality Multiple Choice Questions (MCQs) for competitive exam prep.
Subject: ${String(subject || "General Knowledge").slice(0, 120)}
Chapter: ${String(chapter || "General").slice(0, 120)}
Topic: ${String(topic || "General").slice(0, 120)}
Custom Requirements: ${String(userPrompt || jsonContent?.rawText || "Standard RPSC/NCERT pattern").slice(0, 1e4)}

Return ONLY a JSON array of objects with fields:
[
  {
    "text": "Question text in English & Hindi",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "correctIndex": 0,
    "explanation": "Detailed explanation in English & Hindi",
    "importantFact": "Key fact to remember",
    "difficulty": "medium"
  }
]`;
      const resText = await generateWithFallback(ai, prompt);
      const questions = extractJsonFromResponse(resText);
      res.json({ success: true, questions });
    } catch (err) {
      console.warn("Notice in /api/ai/ai-mcq-import:", redactSensitiveText(err));
      res.status(200).json({ success: false, error: redactSensitiveText(err) || "MCQ generation failed", questions: [] });
    }
  });
  app2.post("/api/ai/format-mcq", requireAuthenticatedUser, async (req, res) => {
    try {
      const authUser = req.authUser;
      const rl = rateLimiter.check(`ai-format:${authUser.uid}`, {
        windowMs: 6e4,
        maxRequests: authUser.isAdmin ? 60 : 12
      });
      if (!rl.allowed) {
        return res.status(429).json({
          success: false,
          questions: [],
          formatted: null,
          error: `Rate limit exceeded. Retry in ${rl.retryAfterSeconds}s.`
        });
      }
      const { mode, rawQuestions, text } = req.body || {};
      if (text !== void 0 && (typeof text !== "string" || text.length > 8e4)) {
        return res.status(400).json({ success: false, error: "Text payload exceeds 80,000 characters." });
      }
      if (rawQuestions !== void 0 && (!Array.isArray(rawQuestions) || rawQuestions.length > 100)) {
        return res.status(400).json({ success: false, error: "rawQuestions must be an array of at most 100 items." });
      }
      const ai = getGeminiClient(req, authUser);
      if (!ai) {
        return res.json({ success: true, questions: [], formatted: null, isFallback: true, warning: "API key missing or not provided" });
      }
      const systemRules = `You are DISHA 20-20's Universal MCQ Recognition, Parsing, Classification & JSON Mapping Engine.
STRICT ANTI-HALLUCINATION RULES:
1. NEVER invent, guess, or fabricate a correct answer if it is not explicitly present in the source input. If the answer is missing, set "correctIndex": -1 and "answer": "".
2. NEVER invent fake options (like "Option A", "Option B") if options are missing in the source input.
3. NEVER alter historical dates, years, numbers, formulas, or Hindi/English factual text.
4. Preserve Hindi, English, and mixed Unicode text accurately. Wrap mathematical formulas in $...$ LaTeX.
5. Classify "questionType" accurately as one of: "single_correct", "statement_based", "assertion_reason", "match_following", "table_based", "math", or "unsupported".
6. For "match_following" questions, include "matchTable": { "leftTitle": "\u0938\u0942\u091A\u0940-I", "rightTitle": "\u0938\u0942\u091A\u0940-II", "rows": [{ "left": "...", "right": "..." }] }.
7. For "table_based" questions, include "table": { "caption": "...", "headers": ["..."], "rows": [["..."]] }.
8. Do NOT invent subject, chapter, or topic if not present in the source.
9. MULTI-EXAM RECOGNITION & STRICT ANTI-FABRICATION:
   - Identify and extract ALL competitive examination names and years mentioned for the question into an array "examHistory": [ { "examName": "...", "year": 2023, "verified": true } ].
   - A question may have appeared in MULTIPLE exams (e.g. CET 12th Level 2023, SSC CGL 2022, Patwari 2021). Extract all of them.
   - CRITICAL: Never claim that a question appeared in a particular examination without direct supporting evidence in the text. Never invent an exam name or year.
   - If exam history is present, set "questionClassification": "pyq" and "isPYQ": true.
   - If no exam is mentioned, set "questionClassification": "practice", "isPYQ": false, and "examHistory": []. Do not add fake PYQ labels.`;
      let prompt = "";
      if (mode === "recover_json" && Array.isArray(rawQuestions)) {
        prompt = `Recover and normalize these malformed or incomplete question objects into DISHA 20-20's structured MCQ schema without inventing missing answers, options, or exam history.
Input raw questions:
${JSON.stringify(rawQuestions, null, 2)}

Return ONLY a JSON object with key "questions":
{
  "questions": [
    {
      "question": "Clear question text in original Hindi/English with LaTeX ($...$)",
      "text": "Clear question text",
      "options": ["...", "...", "...", "..."],
      "answer": "A" (or "" if not present in input),
      "correctIndex": 0 (0-based index, or -1 if not present in input),
      "explanation": "Explanation from input, or empty string if not present",
      "type": "single_correct | statement_based | assertion_reason | match_following | table_based | math | unsupported",
      "questionType": "single_correct | statement_based | assertion_reason | match_following | table_based | math | unsupported",
      "matchTable": { "leftTitle": "\u0938\u0942\u091A\u0940-I", "rightTitle": "\u0938\u0942\u091A\u0940-II", "rows": [{ "left": "A. ...", "right": "1. ..." }] } (only if match_following),
      "table": { "headers": ["..."], "rows": [["..."]] } (only if table_based),
      "examHistory": [ { "examName": "CET 12th Level", "year": 2023, "verified": true } ] (only if present in input),
      "questionClassification": "pyq | practice | pyq_practice",
      "isPYQ": true / false,
      "needsReview": false,
      "reviewReason": ""
    }
  ]
}`;
      } else {
        prompt = `Parse and map the following text into DISHA 20-20's structured Multiple Choice Questions (MCQs) without inventing missing answers, options, or exams:
${text || ""}

Return ONLY a JSON object with key "questions":
{
  "questions": [
    {
      "text": "Question text in original Hindi/English",
      "question": "Question text in original Hindi/English",
      "options": ["...", "...", "...", "..."],
      "correctIndex": 0 (0-based index, or -1 if answer is not given in text),
      "answer": "A" (or "" if answer is not given in text),
      "explanation": "Explanation if present in text, otherwise empty string",
      "type": "single_correct | statement_based | assertion_reason | match_following | table_based | math | unsupported",
      "questionType": "single_correct | statement_based | assertion_reason | match_following | table_based | math | unsupported",
      "matchTable": { "leftTitle": "\u0938\u0942\u091A\u0940-I", "rightTitle": "\u0938\u0942\u091A\u0940-II", "rows": [{ "left": "A. ...", "right": "1. ..." }] } (only if match_following),
      "table": { "headers": ["..."], "rows": [["..."]] } (only if table_based),
      "examHistory": [ { "examName": "CET 12th Level", "year": 2023, "verified": true } ],
      "questionClassification": "pyq | practice | pyq_practice",
      "isPYQ": true / false
    }
  ]
}`;
      }
      try {
        const resText = await generateWithFallback(ai, prompt, systemRules);
        const parsed = extractJsonFromResponse(resText);
        const questionsList = Array.isArray(parsed) ? parsed : parsed.questions || parsed.mcqs || [];
        return res.json({ success: true, questions: questionsList, formatted: questionsList[0] || null });
      } catch (aiErr) {
        console.warn("AI generation in /api/ai/format-mcq encountered unauthenticated/quota issue, returning fallback:", aiErr?.message || aiErr);
        return res.json({ success: true, questions: [], formatted: null, isFallback: true, warning: aiErr?.message || "AI API Key unauthenticated" });
      }
    } catch (err) {
      console.error("Error in /api/ai/format-mcq:", err);
      res.json({ success: true, questions: [], formatted: null, isFallback: true, error: err?.message || "Formatting failed" });
    }
  });
  app2.post("/api/exam-paper/match", requireAuthenticatedUser, async (req, res) => {
    try {
      const rl = rateLimiter.check(`exam-match:${req.authUser.uid}`, { windowMs: 6e4, maxRequests: 20 });
      if (!rl.allowed) {
        return res.status(429).json({ success: false, error: `Rate limit exceeded. Retry in ${rl.retryAfterSeconds}s.` });
      }
      res.json({ success: true, matches: [] });
    } catch (err) {
      res.status(500).json({ error: redactSensitiveText(err) || "Match failed" });
    }
  });
  const quizAssets = createQuizAssetsService({
    getAdminDb: () => adminDb,
    projectId: FIREBASE_PROJECT_ID,
    databaseId: FIRESTORE_DATABASE_ID,
    apiKey: FIREBASE_API_KEY
  });
  const applyVersionedAssetCacheHeaders = (res, vParam) => {
    const hasVersion = typeof vParam === "string" && /^[a-zA-Z0-9._-]{1,64}$/.test(vParam.trim());
    if (hasVersion) {
      res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    } else {
      res.setHeader("Cache-Control", "public, max-age=60, s-maxage=300, stale-while-revalidate=600");
    }
  };
  app2.get("/api/quiz-assets/version", async (req, res) => {
    try {
      const force = req.query.refresh === "1" || req.query.refresh === "true";
      const manifest = await quizAssets.getVersionManifest(force);
      res.setHeader("Cache-Control", "public, max-age=30, stale-while-revalidate=120");
      return res.json({ success: true, ...manifest });
    } catch (err) {
      return res.status(500).json({ success: false, error: redactSensitiveText(err) || "Failed to load quiz version" });
    }
  });
  app2.get("/api/quiz-assets/curriculum", async (req, res) => {
    try {
      const v = typeof req.query.v === "string" ? req.query.v.trim() : void 0;
      const payload = await quizAssets.getCurriculumAsset(v);
      applyVersionedAssetCacheHeaders(res, v);
      return res.json({ success: true, ...payload });
    } catch (err) {
      return res.status(500).json({ success: false, error: redactSensitiveText(err) || "Failed to load quiz curriculum" });
    }
  });
  app2.get("/api/quiz-assets/bundle/:topicId", async (req, res) => {
    try {
      const topicId = String(req.params.topicId || "").trim();
      if (!isValidFirestoreDocId(topicId)) {
        return res.status(400).json({ success: false, error: "Invalid topic ID." });
      }
      const v = typeof req.query.v === "string" ? req.query.v.trim() : void 0;
      const bundle = await quizAssets.getTopicBundleAsset(topicId, v);
      if (!bundle) {
        return res.status(404).json({ success: false, error: "Question bundle not found." });
      }
      applyVersionedAssetCacheHeaders(res, v);
      return res.json({ success: true, bundle });
    } catch (err) {
      return res.status(500).json({ success: false, error: redactSensitiveText(err) || "Failed to load topic bundle" });
    }
  });
  app2.get("/api/quiz-assets/pyq-papers", async (req, res) => {
    try {
      const v = typeof req.query.v === "string" ? req.query.v.trim() : void 0;
      const payload = await quizAssets.getPyqPapersAsset(v);
      applyVersionedAssetCacheHeaders(res, v);
      return res.json({ success: true, ...payload });
    } catch (err) {
      return res.status(500).json({ success: false, error: redactSensitiveText(err) || "Failed to load PYQ papers" });
    }
  });
  app2.get("/api/quiz-assets/live-tests", async (req, res) => {
    try {
      const v = typeof req.query.v === "string" ? req.query.v.trim() : void 0;
      const payload = await quizAssets.getLiveTestsAsset(v);
      applyVersionedAssetCacheHeaders(res, v);
      return res.json({ success: true, ...payload });
    } catch (err) {
      return res.status(500).json({ success: false, error: redactSensitiveText(err) || "Failed to load live tests" });
    }
  });
  app2.post("/api/quiz-assets/invalidate", requireVerifiedAdmin, (req, res) => {
    const topicIds = Array.isArray(req.body?.topicIds) ? req.body.topicIds.filter((id) => typeof id === "string" && id.length > 0).slice(0, 200) : void 0;
    quizAssets.invalidateQuizAssetsCache(topicIds);
    return res.json({ success: true, invalidatedTopics: topicIds || "all" });
  });
  app2.get("/api/manifests/current.json", (_req, res) => {
    try {
      const manifest = defaultSnapshotPublishingService.getCurrentManifest();
      if (!manifest) {
        return res.status(404).json({ success: false, error: "No active snapshot manifest found" });
      }
      res.setHeader("Content-Type", "application/json");
      res.setHeader("Cache-Control", "public, max-age=60, s-maxage=60");
      return res.json(manifest);
    } catch (err) {
      return res.status(500).json({ success: false, error: redactSensitiveText(err) });
    }
  });
  app2.get("/api/snapshots/:version/:filename", (req, res) => {
    try {
      const version = String(req.params.version || "");
      const filename = String(req.params.filename || "");
      const { filePath, exists } = defaultSnapshotPublishingService.getSnapshotFile(version, filename);
      if (!exists) {
        return res.status(404).json({ success: false, error: "Snapshot file not found" });
      }
      res.setHeader("Content-Type", "application/json");
      res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      return res.sendFile(filePath);
    } catch (err) {
      return res.status(500).json({ success: false, error: redactSensitiveText(err) });
    }
  });
  app2.get("/api/deltas/:filename", (req, res) => {
    try {
      const filename = String(req.params.filename || "");
      const { filePath, exists } = defaultSnapshotPublishingService.getDeltaFile(filename);
      if (!exists) {
        return res.status(404).json({ success: false, error: "Delta bundle not found" });
      }
      res.setHeader("Content-Type", "application/json");
      res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      return res.sendFile(filePath);
    } catch (err) {
      return res.status(500).json({ success: false, error: redactSensitiveText(err) });
    }
  });
  app2.post("/api/admin/snapshots/publish", requireVerifiedAdmin, async (req, res) => {
    try {
      const options = req.body || {};
      const manifest = await defaultSnapshotPublishingService.publishNewSnapshot(options);
      return res.json({ success: true, manifest });
    } catch (err) {
      return res.status(500).json({ success: false, error: redactSensitiveText(err) });
    }
  });
  app2.get("/api/live-tests/:testId", async (req, res) => {
    try {
      const testId = String(req.params.testId || "");
      const v = typeof req.query.v === "string" ? req.query.v.trim() : void 0;
      if (!isValidFirestoreDocId(testId)) {
        return res.status(400).json({ success: false, error: "Invalid live test ID." });
      }
      if (!adminDb) {
        const fallback = await quizAssets.getPublicLiveTestById(testId, v);
        if (fallback.status !== 200 || !fallback.test) {
          return res.status(fallback.status === 404 ? 404 : 503).json({
            success: false,
            error: fallback.error || "Database unavailable."
          });
        }
        applyVersionedAssetCacheHeaders(res, v);
        return res.json({ success: true, test: fallback.test });
      }
      const result = await quizAssets.getPublicLiveTestById(testId, v);
      if (result.status !== 200 || !result.test) {
        return res.status(result.status).json({ success: false, error: result.error });
      }
      applyVersionedAssetCacheHeaders(res, v);
      return res.json({ success: true, test: result.test });
    } catch (err) {
      return res.status(500).json({ success: false, error: redactSensitiveText(err) || "Failed to load live test" });
    }
  });
  app2.post("/api/live-tests/:testId/submit", requireAuthenticatedUser, async (req, res) => {
    try {
      const authUser = req.authUser;
      const rl = rateLimiter.check(`live-submit:${authUser.uid}`, { windowMs: 6e4, maxRequests: 10 });
      if (!rl.allowed) {
        return res.status(429).json({ success: false, error: `Too many submission attempts. Retry in ${rl.retryAfterSeconds}s.` });
      }
      const result = await gradeAndSubmitLiveTest({
        testId: String(req.params.testId || ""),
        authUser,
        body: req.body,
        adminDb
      });
      return res.status(result.status).json(result.body);
    } catch (err) {
      console.error("[Live Test Submit Error]:", redactSensitiveText(err));
      return res.status(500).json({ success: false, error: redactSensitiveText(err) || "Live test grading failed." });
    }
  });
  function parseFirestoreFields(fields) {
    const result = {};
    for (const [key, val] of Object.entries(fields)) {
      if ("stringValue" in val) result[key] = val.stringValue;
      else if ("booleanValue" in val) result[key] = val.booleanValue;
      else if ("integerValue" in val) result[key] = Number(val.integerValue);
      else if ("doubleValue" in val) result[key] = Number(val.doubleValue);
      else if ("timestampValue" in val) result[key] = val.timestampValue;
      else if ("arrayValue" in val) {
        result[key] = (val.arrayValue.values || []).map((item) => {
          if ("stringValue" in item) return item.stringValue;
          if ("mapValue" in item) return parseFirestoreFields(item.mapValue.fields || {});
          return item;
        });
      } else if ("mapValue" in val) {
        result[key] = parseFirestoreFields(val.mapValue.fields || {});
      }
    }
    return result;
  }
  async function getPublishedArticlesServer() {
    try {
      const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/${FIRESTORE_DATABASE_ID}/documents:runQuery?key=${FIREBASE_API_KEY}`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          structuredQuery: {
            from: [{ collectionId: "articles" }],
            where: {
              fieldFilter: {
                field: { fieldPath: "status" },
                op: "EQUAL",
                value: { stringValue: "published" }
              }
            },
            orderBy: [
              {
                field: { fieldPath: "publishedAt" },
                direction: "DESCENDING"
              }
            ],
            limit: 300
          }
        })
      });
      if (!res.ok) {
        console.warn("Firestore runQuery HTTP error:", res.status, await res.text());
        return [];
      }
      const data = await res.json();
      const articles = [];
      if (Array.isArray(data)) {
        for (const item of data) {
          if (item.document?.fields) {
            const parsed = parseFirestoreFields(item.document.fields);
            const id = item.document.name.split("/").pop() || "";
            articles.push({
              id,
              title: parsed.title || "",
              hindiTitle: parsed.hindiTitle,
              slug: parsed.slug || id,
              excerpt: parsed.excerpt || "",
              content: parsed.content || "",
              seoTitle: parsed.seoTitle,
              seoDescription: parsed.seoDescription,
              coverImageUrl: parsed.coverImageUrl,
              authorName: parsed.authorName,
              category: parsed.category,
              publishedAt: parsed.publishedAt,
              updatedAt: parsed.updatedAt,
              status: parsed.status || "published"
            });
          }
        }
      }
      return articles;
    } catch (err) {
      console.error("getPublishedArticlesServer error:", err);
      return [];
    }
  }
  async function getArticleBySlugServer(slug) {
    if (!slug) return null;
    const cleanSlug = slug.trim().toLowerCase();
    try {
      const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/${FIRESTORE_DATABASE_ID}/documents:runQuery?key=${FIREBASE_API_KEY}`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          structuredQuery: {
            from: [{ collectionId: "articles" }],
            where: {
              compositeFilter: {
                op: "AND",
                filters: [
                  {
                    fieldFilter: {
                      field: { fieldPath: "slug" },
                      op: "EQUAL",
                      value: { stringValue: cleanSlug }
                    }
                  },
                  {
                    fieldFilter: {
                      field: { fieldPath: "status" },
                      op: "EQUAL",
                      value: { stringValue: "published" }
                    }
                  }
                ]
              }
            },
            limit: 1
          }
        })
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data[0]?.document?.fields) {
          const parsed = parseFirestoreFields(data[0].document.fields);
          const id = data[0].document.name.split("/").pop() || "";
          return {
            id,
            title: parsed.title || "",
            hindiTitle: parsed.hindiTitle,
            slug: parsed.slug || id,
            excerpt: parsed.excerpt || "",
            content: parsed.content || "",
            seoTitle: parsed.seoTitle,
            seoDescription: parsed.seoDescription,
            coverImageUrl: parsed.coverImageUrl,
            authorName: parsed.authorName,
            category: parsed.category,
            publishedAt: parsed.publishedAt,
            updatedAt: parsed.updatedAt,
            status: parsed.status || "published"
          };
        }
      }
      const docUrl = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/${FIRESTORE_DATABASE_ID}/documents/articles/${cleanSlug}?key=${FIREBASE_API_KEY}`;
      const docRes = await fetch(docUrl);
      if (docRes.ok) {
        const docData = await docRes.json();
        if (docData?.fields) {
          const parsed = parseFirestoreFields(docData.fields);
          if (parsed.status === "published") {
            return {
              id: cleanSlug,
              title: parsed.title || "",
              hindiTitle: parsed.hindiTitle,
              slug: parsed.slug || cleanSlug,
              excerpt: parsed.excerpt || "",
              content: parsed.content || "",
              seoTitle: parsed.seoTitle,
              seoDescription: parsed.seoDescription,
              coverImageUrl: parsed.coverImageUrl,
              authorName: parsed.authorName,
              category: parsed.category,
              publishedAt: parsed.publishedAt,
              updatedAt: parsed.updatedAt,
              status: parsed.status || "published"
            };
          }
        }
      }
    } catch (err) {
      console.warn("getArticleBySlugServer error:", err);
    }
    return null;
  }
  function getIndexHtml() {
    if (!isProd) {
      const devPath = path3.join(process.cwd(), "index.html");
      if (fs3.existsSync(devPath)) return fs3.readFileSync(devPath, "utf-8");
    }
    const candidatePaths = [
      path3.join(distPath, "index.html"),
      path3.join(process.cwd(), "dist", "index.html"),
      path3.join(currentDirname, "index.html"),
      path3.join(currentDirname, "dist", "index.html"),
      path3.join(currentDirname, "..", "dist", "index.html"),
      path3.join(process.cwd(), "index.html")
    ];
    for (const p of candidatePaths) {
      if (fs3.existsSync(p)) {
        try {
          const content = fs3.readFileSync(p, "utf-8");
          if (content && content.includes('<div id="root">')) return content;
        } catch {
        }
      }
    }
    return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>DISHA 20-20 (\u0926\u093F\u0936\u093E 20-20) \u2014 Master Competitive Exams with Mock Tests &amp; PYQs</title>
    <meta name="description" content="Prepare for Rajasthan Competitive Exams with 1,500+ MCQs, official PYQs, and bilingual explanations on DISHA 20-20." />
    <link rel="canonical" href="https://disha2020.in" />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>`;
  }
  function injectVitePreamble(html, _url) {
    if (isProd) return html;
    if (html.includes("__vite_plugin_react_preamble_installed__")) return html;
    const flagScript = "<script>window.__vite_plugin_react_preamble_installed__ = true;</script>";
    if (html.includes("<head>")) {
      return html.replace("<head>", `<head>${flagScript}`);
    }
    return flagScript + html;
  }
  function escapeHtml(str) {
    return (str || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
  function injectArticleMeta(baseHtml, art) {
    const title = art.seoTitle ? `${art.seoTitle} | DISHA 20-20` : `${art.title} | DISHA 20-20`;
    const desc = art.seoDescription || art.excerpt || art.title;
    const canonicalUrl = `https://disha2020.in/news/${encodeURI(art.slug)}`;
    const coverImage = art.coverImageUrl || "https://disha2020.in/og-preview.png";
    const publishedDate = art.publishedAt || (/* @__PURE__ */ new Date()).toISOString();
    const modifiedDate = art.updatedAt || art.publishedAt || publishedDate;
    const authorName = art.authorName || "DISHA 20-20 Editorial Team";
    const jsonLd = {
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "NewsArticle",
          "@id": `${canonicalUrl}#article`,
          "isPartOf": {
            "@type": "WebSite",
            "@id": "https://disha2020.in/#website",
            "name": "DISHA 20-20",
            "url": "https://disha2020.in"
          },
          "headline": art.title,
          "name": art.title,
          "description": desc,
          "url": canonicalUrl,
          "mainEntityOfPage": canonicalUrl,
          "datePublished": publishedDate,
          "dateModified": modifiedDate,
          "image": [coverImage],
          "author": {
            "@type": "Person",
            "name": authorName
          },
          "publisher": {
            "@type": "Organization",
            "name": "DISHA 20-20",
            "url": "https://disha2020.in",
            "logo": {
              "@type": "ImageObject",
              "url": "https://disha2020.in/logo.png"
            }
          }
        },
        {
          "@type": "BreadcrumbList",
          "@id": `${canonicalUrl}#breadcrumb`,
          "itemListElement": [
            {
              "@type": "ListItem",
              "position": 1,
              "name": "Home",
              "item": "https://disha2020.in/"
            },
            {
              "@type": "ListItem",
              "position": 2,
              "name": art.category || "News",
              "item": "https://disha2020.in/news"
            },
            {
              "@type": "ListItem",
              "position": 3,
              "name": art.title,
              "item": canonicalUrl
            }
          ]
        }
      ]
    };
    const jsonLdScript = `
    <script type="application/ld+json" id="article-schema">
${JSON.stringify(jsonLd, null, 2)}
    </script>
`;
    const prerenderedArticleHtml = `
  <div id="root">
    <main class="min-h-screen bg-[#F4F7FC] text-[#17233D] py-10 px-4">
      <article class="max-w-4xl mx-auto bg-white rounded-3xl p-6 sm:p-10 shadow-sm border border-slate-200">
        <nav aria-label="Breadcrumb" class="text-xs text-slate-500 mb-4 flex items-center gap-1.5">
          <a href="/" class="hover:underline">Home</a> &gt; 
          <a href="/news" class="hover:underline">${escapeHtml(art.category || "News")}</a> &gt; 
          <span class="text-slate-700 font-medium">${escapeHtml(art.title)}</span>
        </nav>
        <header class="mb-6">
          <h1 class="text-2xl sm:text-3xl font-black text-slate-900 leading-tight mb-3">${escapeHtml(art.title)}</h1>
          ${art.hindiTitle ? `<p class="text-lg text-slate-600 font-medium mb-3">${escapeHtml(art.hindiTitle)}</p>` : ""}
          <div class="flex items-center gap-3 text-xs text-slate-500">
            <span>By <strong>${escapeHtml(authorName)}</strong></span>
            <span>\u2022</span>
            <time datetime="${escapeHtml(publishedDate)}">${escapeHtml(new Date(publishedDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }))}</time>
          </div>
        </header>
        ${art.coverImageUrl ? `<div class="mb-6"><img src="${escapeHtml(art.coverImageUrl)}" alt="${escapeHtml(art.title)}" class="w-full max-h-96 object-cover rounded-2xl" /></div>` : ""}
        ${art.excerpt ? `<div class="text-base text-slate-700 font-normal leading-relaxed mb-6 bg-slate-50 p-4 rounded-xl border border-slate-100">${escapeHtml(art.excerpt)}</div>` : ""}
      </article>
    </main>
  </div>`;
    let html = baseHtml;
    if (/<title>.*?<\/title>/i.test(html)) {
      html = html.replace(/<title>.*?<\/title>/i, `<title>${escapeHtml(title)}</title>`);
    } else {
      html = html.replace("</head>", `  <title>${escapeHtml(title)}</title>
</head>`);
    }
    if (/<meta\s+name="description"\s+content=".*?"\s*\/?>/i.test(html)) {
      html = html.replace(/<meta\s+name="description"\s+content=".*?"\s*\/?>/i, `<meta name="description" content="${escapeHtml(desc)}" />`);
    } else {
      html = html.replace("</head>", `  <meta name="description" content="${escapeHtml(desc)}" />
</head>`);
    }
    if (/<link\s+rel="canonical"\s+href=".*?"\s*\/?>/i.test(html)) {
      html = html.replace(/<link\s+rel="canonical"\s+href=".*?"\s*\/?>/i, `<link rel="canonical" href="${canonicalUrl}" />`);
    } else {
      html = html.replace("</head>", `  <link rel="canonical" href="${canonicalUrl}" />
</head>`);
    }
    if (/<meta\s+property="og:url"\s+content=".*?"\s*\/?>/i.test(html)) {
      html = html.replace(/<meta\s+property="og:url"\s+content=".*?"\s*\/?>/i, `<meta property="og:url" content="${canonicalUrl}" />`);
    } else {
      html = html.replace("</head>", `  <meta property="og:url" content="${canonicalUrl}" />
</head>`);
    }
    if (/<meta\s+property="og:title"\s+content=".*?"\s*\/?>/i.test(html)) {
      html = html.replace(/<meta\s+property="og:title"\s+content=".*?"\s*\/?>/i, `<meta property="og:title" content="${escapeHtml(title)}" />`);
    }
    if (/<meta\s+property="og:description"\s+content=".*?"\s*\/?>/i.test(html)) {
      html = html.replace(/<meta\s+property="og:description"\s+content=".*?"\s*\/?>/i, `<meta property="og:description" content="${escapeHtml(desc)}" />`);
    }
    if (/<meta\s+property="og:image"\s+content=".*?"\s*\/?>/i.test(html)) {
      html = html.replace(/<meta\s+property="og:image"\s+content=".*?"\s*\/?>/i, `<meta property="og:image" content="${escapeHtml(coverImage)}" />`);
    } else {
      html = html.replace("</head>", `  <meta property="og:image" content="${escapeHtml(coverImage)}" />
</head>`);
    }
    if (/<meta\s+name="twitter:title"\s+content=".*?"\s*\/?>/i.test(html)) {
      html = html.replace(/<meta\s+name="twitter:title"\s+content=".*?"\s*\/?>/i, `<meta name="twitter:title" content="${escapeHtml(title)}" />`);
    }
    if (/<meta\s+name="twitter:description"\s+content=".*?"\s*\/?>/i.test(html)) {
      html = html.replace(/<meta\s+name="twitter:description"\s+content=".*?"\s*\/?>/i, `<meta name="twitter:description" content="${escapeHtml(desc)}" />`);
    }
    if (/<meta\s+name="twitter:url"\s+content=".*?"\s*\/?>/i.test(html)) {
      html = html.replace(/<meta\s+name="twitter:url"\s+content=".*?"\s*\/?>/i, `<meta name="twitter:url" content="${canonicalUrl}" />`);
    } else {
      html = html.replace("</head>", `  <meta name="twitter:url" content="${canonicalUrl}" />
</head>`);
    }
    if (/<meta\s+name="twitter:image"\s+content=".*?"\s*\/?>/i.test(html)) {
      html = html.replace(/<meta\s+name="twitter:image"\s+content=".*?"\s*\/?>/i, `<meta name="twitter:image" content="${escapeHtml(coverImage)}" />`);
    } else {
      html = html.replace("</head>", `  <meta name="twitter:image" content="${escapeHtml(coverImage)}" />
</head>`);
    }
    html = html.replace("</head>", `${jsonLdScript}</head>`);
    if (html.includes('<div id="root"></div>')) {
      html = html.replace('<div id="root"></div>', prerenderedArticleHtml);
    }
    return html;
  }
  function injectNewsListingMeta(baseHtml) {
    const title = "Latest Exam News, Syllabus Breakdown & Analysis | DISHA 20-20";
    const desc = "Stay updated with Rajasthan competitive exam notifications, CET, REET, RPSC RAS syllabus breakdown, study strategies, and exam preparation news on DISHA 20-20.";
    const canonicalUrl = "https://disha2020.in/news";
    let html = baseHtml;
    html = html.replace(/<title>.*?<\/title>/i, `<title>${title}</title>`);
    html = html.replace(/<meta\s+name="description"\s+content=".*?"\s*\/?>/i, `<meta name="description" content="${desc}" />`);
    html = html.replace(/<link\s+rel="canonical"\s+href=".*?"\s*\/?>/i, `<link rel="canonical" href="${canonicalUrl}" />`);
    html = html.replace(/<meta\s+property="og:url"\s+content=".*?"\s*\/?>/i, `<meta property="og:url" content="${canonicalUrl}" />`);
    html = html.replace(/<meta\s+property="og:title"\s+content=".*?"\s*\/?>/i, `<meta property="og:title" content="${title}" />`);
    html = html.replace(/<meta\s+property="og:description"\s+content=".*?"\s*\/?>/i, `<meta property="og:description" content="${desc}" />`);
    return html;
  }
  function renderArticleNotFoundHtml(baseHtml, slug) {
    let html = baseHtml;
    html = html.replace(/<title>.*?<\/title>/i, `<title>Article Not Found | DISHA 20-20</title>`);
    html = html.replace(/<meta\s+name="description"\s+content=".*?"\s*\/?>/i, `<meta name="description" content="The requested article does not exist or has been removed." />`);
    html = html.replace(/<link\s+rel="canonical"\s+href=".*?"\s*\/?>/i, `<link rel="canonical" href="https://disha2020.in/news" />`);
    html = html.replace("</head>", `  <meta name="robots" content="noindex, follow" />
</head>`);
    const notFoundHtml = `
  <div id="root">
    <main class="min-h-screen bg-[#FFF9EF] text-[#171923] flex items-center justify-center p-6 text-center font-sans">
      <div class="max-w-md w-full bg-white rounded-3xl p-8 border border-[#E8D9C0] shadow-md">
        <h1 class="text-3xl font-black text-[#800020] mb-2">404</h1>
        <h2 class="text-xl font-bold text-[#171923] mb-3">Article Not Found</h2>
        <p class="text-sm text-[#52576A] mb-6">The article "${escapeHtml(slug)}" could not be found or may have been unlisted.</p>
        <a href="/news" class="inline-block px-6 py-3 bg-[#800020] text-white font-bold rounded-2xl text-sm shadow-md hover:bg-[#5E0017] transition-colors">\u2190 Back to News Directory</a>
      </div>
    </main>
  </div>`;
    if (html.includes('<div id="root"></div>')) {
      html = html.replace('<div id="root"></div>', notFoundHtml);
    }
    return html;
  }
  app2.get("/robots.txt", (_req, res) => {
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.send("User-agent: *\nAllow: /\nSitemap: https://disha2020.in/sitemap.xml\n");
  });
  async function generateAndSaveSitemapServer() {
    const articles = await getPublishedArticlesServer();
    const nowIsoDate = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
    const validArticles = articles.filter((a) => {
      const isPub = (a.status || "published") === "published";
      const cleanSlug = (a.slug || a.id || "").trim().toLowerCase();
      return isPub && cleanSlug.length >= 2 && cleanSlug !== "undefined" && cleanSlug !== "null";
    });
    const articleUrlsXml = validArticles.map((art) => {
      const lastMod = (art.updatedAt || art.publishedAt || nowIsoDate).split("T")[0];
      return `  <url>
    <loc>https://disha2020.in/news/${encodeURI(art.slug)}</loc>
    <lastmod>${lastMod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`;
    }).join("\n");
    const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://disha2020.in/</loc>
    <lastmod>${nowIsoDate}</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>https://disha2020.in/news</loc>
    <lastmod>${nowIsoDate}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.9</priority>
  </url>
  <url>
    <loc>https://disha2020.in/topics</loc>
    <lastmod>${nowIsoDate}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>https://disha2020.in/pyq_vault</loc>
    <lastmod>${nowIsoDate}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>https://disha2020.in/live_tests</loc>
    <lastmod>${nowIsoDate}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>
${articleUrlsXml}
</urlset>`;
    try {
      const pubDir = path3.join(process.cwd(), "public");
      if (!fs3.existsSync(pubDir)) fs3.mkdirSync(pubDir, { recursive: true });
      fs3.writeFileSync(path3.join(pubDir, "sitemap.xml"), sitemap, "utf-8");
    } catch (e) {
      console.warn("Notice: Could not write public/sitemap.xml:", e);
    }
    try {
      const dDir = path3.join(process.cwd(), "dist");
      if (fs3.existsSync(dDir)) {
        fs3.writeFileSync(path3.join(dDir, "sitemap.xml"), sitemap, "utf-8");
      }
    } catch (e) {
      console.warn("Notice: Could not write dist/sitemap.xml:", e);
    }
    return {
      success: true,
      xml: sitemap,
      count: validArticles.length,
      draftsExcluded: Math.max(0, articles.length - validArticles.length),
      urls: validArticles.map((a) => `https://disha2020.in/news/${encodeURI(a.slug)}`),
      generatedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
  }
  app2.get("/sitemap.xml", async (_req, res) => {
    try {
      const result = await generateAndSaveSitemapServer();
      res.setHeader("Content-Type", "application/xml; charset=utf-8");
      res.setHeader("Cache-Control", "public, max-age=60, s-maxage=300, stale-while-revalidate=600");
      return res.send(result.xml);
    } catch (err) {
      console.error("Sitemap error:", err);
      try {
        const fallbackPath = path3.join(process.cwd(), "public", "sitemap.xml");
        if (fs3.existsSync(fallbackPath)) {
          const fallbackXml = fs3.readFileSync(fallbackPath, "utf-8");
          res.setHeader("Content-Type", "application/xml; charset=utf-8");
          return res.send(fallbackXml);
        }
      } catch {
      }
      res.status(500).send("Error generating sitemap");
    }
  });
  app2.post(["/api/sitemap/generate", "/api/sitemap/update"], requireVerifiedAdmin, async (_req, res) => {
    try {
      const result = await generateAndSaveSitemapServer();
      res.json({
        success: true,
        message: "XML Sitemap generated and saved successfully.",
        count: result.count,
        draftsExcluded: result.draftsExcluded,
        urls: result.urls,
        generatedAt: result.generatedAt,
        sitemapUrl: "https://disha2020.in/sitemap.xml",
        xml: result.xml
      });
    } catch (err) {
      console.error("API sitemap generation error:", redactSensitiveText(err));
      res.status(500).json({ success: false, error: redactSensitiveText(err) || "Failed to generate sitemap" });
    }
  });
  app2.get("/api/sitemap/status", async (_req, res) => {
    try {
      const sitemapPath = path3.join(process.cwd(), "public", "sitemap.xml");
      const exists = fs3.existsSync(sitemapPath);
      let stats = null;
      let urlCount = 0;
      if (exists) {
        stats = fs3.statSync(sitemapPath);
        const content = fs3.readFileSync(sitemapPath, "utf-8");
        urlCount = (content.match(/<url>/g) || []).length;
      }
      res.json({
        success: true,
        sitemapUrl: "https://disha2020.in/sitemap.xml",
        exists,
        lastModified: stats?.mtime?.toISOString() || null,
        urlCount,
        status: "ready_for_search_console"
      });
    } catch (err) {
      res.status(500).json({ success: false, error: err?.message });
    }
  });
  app2.get("/news", async (req, res, next) => {
    try {
      const vite = getVite();
      let html = getIndexHtml();
      if (!isProd && vite) {
        html = await vite.transformIndexHtml(req.url, html);
        html = injectVitePreamble(html, req.url);
      }
      const enrichedHtml = injectNewsListingMeta(html);
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      if (isProd) {
        res.setHeader("Cache-Control", "public, max-age=60, s-maxage=300, stale-while-revalidate=600");
      } else {
        res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
      }
      return res.status(200).send(enrichedHtml);
    } catch (err) {
      console.warn("Error handling /news:", err);
      return next();
    }
  });
  app2.get("/news/:slug", async (req, res, next) => {
    const slug = (req.params.slug || req.query.slug || "").trim();
    if (!slug || slug === "undefined") return next();
    try {
      const vite = getVite();
      const art = await getArticleBySlugServer(slug);
      let html = getIndexHtml();
      if (art && art.status === "published") {
        if (!isProd && vite) {
          html = await vite.transformIndexHtml(req.url, html);
          html = injectVitePreamble(html, req.url);
        }
        const enrichedHtml = injectArticleMeta(html, art);
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        if (isProd) {
          res.setHeader("Cache-Control", "public, max-age=120, s-maxage=600, stale-while-revalidate=1200");
        } else {
          res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
        }
        return res.status(200).send(enrichedHtml);
      } else {
        if (!isProd && vite) {
          html = await vite.transformIndexHtml(req.url, html);
          html = injectVitePreamble(html, req.url);
        }
        const notFoundHtml = renderArticleNotFoundHtml(html, slug);
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        res.setHeader("Cache-Control", "public, max-age=30");
        return res.status(404).send(notFoundHtml);
      }
    } catch (err) {
      console.warn("SEO Injection error for slug:", slug, err);
      return next();
    }
  });
  app2.get("/", async (req, res, next) => {
    if (isProd) return next();
    try {
      const vite = getVite();
      let html = getIndexHtml();
      if (vite) {
        html = await vite.transformIndexHtml(req.url, html);
        html = injectVitePreamble(html, req.url);
      }
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
      res.send(html);
    } catch (e) {
      next(e);
    }
  });
  if (isProd) {
    if (fs3.existsSync(distPath)) {
      app2.use(express.static(distPath, {
        setHeaders: (res, filePath) => {
          const base = path3.basename(filePath);
          if (base === "sw.js" || base === "registerSW.js" || base === "manifest.webmanifest") {
            res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
          }
        }
      }));
    }
    app2.get("*", (_req, res) => {
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
      res.setHeader("Pragma", "no-cache");
      res.setHeader("Expires", "0");
      res.send(getIndexHtml());
    });
  }
  return app2;
}
var app = createServerApp();
var isProdEnv = process.env.NODE_ENV === "production" || !!process.env.VERCEL || process.env.npm_lifecycle_event === "start";
var distPathRoot = path3.join(process.cwd(), "dist");
async function startServer() {
  const PORT = Number(process.env.PORT) || 3e3;
  if (!isProdEnv) {
    const { createServer: createViteServer } = await import("vite");
    activeViteInstance = await createViteServer({
      server: { middlewareMode: true, hmr: true },
      appType: "spa"
    });
    app.use((req, res, next) => {
      if (req.url.startsWith("/src/") || req.url.includes("/node_modules/.vite/")) {
        delete req.headers["if-none-match"];
        delete req.headers["if-modified-since"];
        res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
        res.setHeader("Pragma", "no-cache");
        res.setHeader("Expires", "0");
      }
      next();
    });
    app.use(activeViteInstance.middlewares);
    app.get("*", async (req, res, next) => {
      if (req.url.startsWith("/api/") || req.url.includes(".")) return next();
      try {
        const indexPath = path3.join(process.cwd(), "index.html");
        let html = fs3.existsSync(indexPath) ? fs3.readFileSync(indexPath, "utf-8") : "";
        html = await activeViteInstance.transformIndexHtml(req.url, html);
        if (!html.includes("__vite_plugin_react_preamble_installed__") && html.includes("<head>")) {
          html = html.replace("<head>", "<head><script>window.__vite_plugin_react_preamble_installed__ = true;</script>");
        }
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
        res.send(html);
      } catch (e) {
        next(e);
      }
    });
  } else if (fs3.existsSync(distPathRoot)) {
    app.use(express.static(distPathRoot));
  }
  if (!process.env.VERCEL && !process.env.NOW_REGION) {
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  }
}
if (!process.env.VERCEL && !process.env.NOW_REGION && !process.env.LAMBDA_TASK_ROOT && !process.env.VITEST && process.env.NODE_ENV !== "test") {
  startServer();
}
var server_default = app;

// src/server/vercelHandler.ts
async function handler(req, res) {
  return new Promise((resolve) => {
    res.on("finish", () => resolve());
    res.on("close", () => resolve());
    try {
      const originalPath = req.headers["x-vercel-original-url"] || req.headers["x-forwarded-url"] || req.headers["x-original-url"] || req.url || "/";
      req.url = originalPath;
      server_default(req, res);
    } catch (err) {
      console.error("[Vercel Serverless Handler Error]", err);
      if (!res.headersSent) {
        res.statusCode = 500;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({
          error: "Internal Server Error",
          message: err?.message || "An unexpected error occurred on the server."
        }));
      }
      resolve();
    }
  });
}
export {
  handler as default
};
