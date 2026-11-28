import { Chapter, Question, ProgressStore, Subject, PYQPaper, LiveTest } from "../types";
import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";
import { parseQuestionContent } from "../components/ParsedQuestion";
import { formatMathAndChemistryLatex } from "./questionsParser";
import {
  getSubjectDisplayName,
  getChapterDisplayName,
  getTopicDisplayName,
} from "./curriculumUtils";

export type PDFFormatCard = "question_paper" | "question_paper_omr" | "answer_key" | "detailed_solutions" | "json";

export function downloadJSON(questions: any[], filename: string) {
  const json = JSON.stringify(questions, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export type ContentSourceType =
  | "subject"
  | "chapter"
  | "topic"
  | "practice_test"
  | "mock_test"
  | "live_test"
  | "pyq"
  | "wrong_practice"
  | "wrong_review"
  | "bookmarked"
  | "question_bank"
  | "test_series";

export interface PDFExportOptions {
  contentType?: ContentSourceType;
  subjectId?: string | "all";
  chapterId?: string | "all";
  topicId?: string | "all";
  testId?: string;
  pyqId?: string;
  filterType: "all" | "wrong" | "bookmarked";
  format: PDFFormatCard;
  layout: "single" | "compact";
  fontSize: "normal" | "large";
  colorMode?: "color" | "bw";
  questionLimit?: number | "all";
  customRangeStart?: number;
  customRangeEnd?: number;
  shuffle?: boolean;
  
  // Document Toggles
  includeCoverPage: boolean;
  showPageNumbers: boolean;
  showHeaderFooter: boolean;
  includeTestInstructions: boolean;
  includeSubjectTopicNames: boolean;
  includeBlankAnswerSheet: boolean;

  // Metadata & Customization
  customTitle?: string;
  testName?: string;
  examName?: string;
  studentName?: string;
  rollNumber?: string;
  maxMarks?: number;
  durationMinutes?: number;
  instructionsText?: string;
}

export interface FilteredQuestionsResult {
  questions: Question[];
  subjectTitle: string;
  chapterTitle?: string;
  topicTitle?: string;
  testTitle?: string;
  examName?: string;
  examYear?: string;
  count: number;
  totalCandidateCount: number;
  maxMarks?: number;
  durationMinutes?: number;
  instructionsText?: string;
}

/**
 * Filter and prepare questions based on user selection criteria
 */
export function filterQuestionsForExport(
  allSubjects: Subject[],
  allChapters: Chapter[],
  progressStore: ProgressStore,
  options: PDFExportOptions,
  pyqPapers?: PYQPaper[],
  liveTests?: LiveTest[]
): FilteredQuestionsResult {
  let selectedSubjectTitle = "General Studies";
  let selectedChapterTitle: string | undefined = undefined;
  let selectedTopicTitle: string | undefined = undefined;
  let selectedTestTitle: string | undefined = options.testName || undefined;
  let selectedExamName: string | undefined = options.examName || undefined;
  let selectedExamYear: string | undefined = undefined;
  let maxMarks: number | undefined = options.maxMarks;
  let durationMinutes: number | undefined = options.durationMinutes;
  let instructionsText: string | undefined = options.instructionsText;

  let candidateQuestions: { q: Question; chapterName?: string; topicName?: string }[] = [];

  // 1. Handle PYQs
  if (options.contentType === "pyq" && options.pyqId && pyqPapers) {
    const paper = pyqPapers.find((p) => p.id === options.pyqId);
    if (paper) {
      selectedTestTitle = paper.hindiTitle || paper.title;
      selectedExamName = paper.examBoard || paper.category || "Official PYQ Exam";
      selectedExamYear = paper.paperYear;
      maxMarks = paper.totalMarks;
      durationMinutes = paper.durationMinutes;
      instructionsText = paper.hindiDescription || paper.description;
      selectedSubjectTitle = paper.category || "Previous Year Paper";

      for (const q of paper.questions) {
        candidateQuestions.push({ q });
      }
    }
  }
  // 2. Handle Live / Mock Tests
  else if ((options.contentType === "live_test" || options.contentType === "mock_test" || options.contentType === "practice_test") && options.testId && liveTests) {
    const test = liveTests.find((t) => t.id === options.testId);
    if (test) {
      selectedTestTitle = test.hindiTitle || test.title;
      selectedExamName = test.examCategory || "Practice Test Series";
      maxMarks = test.totalMarks;
      durationMinutes = test.durationMinutes;
      instructionsText = test.instructions;
      selectedSubjectTitle = test.examCategory || "Live Test";

      for (const q of test.questions) {
        candidateQuestions.push({ q });
      }
    }
  }
  // 3. Subject / Chapter / Topic / Question Bank filtering
  else {
    let filteredChapters = allChapters;
    if (options.subjectId && options.subjectId !== "all") {
      const subj = allSubjects.find((s) => s.id === options.subjectId);
      if (subj) {
        selectedSubjectTitle = getSubjectDisplayName(subj);
      }
      filteredChapters = allChapters.filter(
        (c) => !c.subjectId || c.subjectId === options.subjectId
      );
    }

    if (options.chapterId && options.chapterId !== "all") {
      const ch = allChapters.find((c) => c.id === options.chapterId);
      if (ch) {
        selectedChapterTitle = `Chapter ${ch.number}: ${getChapterDisplayName(ch)}`;
      }
      filteredChapters = filteredChapters.filter((c) => c.id === options.chapterId);
    }

    for (const ch of filteredChapters) {
      for (const top of ch.topics) {
        if (options.topicId && options.topicId !== "all" && top.id !== options.topicId) {
          continue;
        }
        if (options.topicId && options.topicId !== "all" && top.id === options.topicId) {
          selectedTopicTitle = getTopicDisplayName(top);
        }

        for (const q of top.questions) {
          candidateQuestions.push({
            q,
            chapterName: getChapterDisplayName(ch),
            topicName: getTopicDisplayName(top),
          });
        }
      }
    }
  }

  // De-duplicate questions preserving order
  const seenIds = new Set<string>();
  let uniqueQuestions: Question[] = [];

  for (const item of candidateQuestions) {
    if (seenIds.has(item.q.id)) continue;
    seenIds.add(item.q.id);

    // Filter type (wrong / bookmarked)
    const p = progressStore[item.q.id];
    if (options.filterType === "wrong" || options.contentType === "wrong_practice" || options.contentType === "wrong_review") {
      if (p?.status !== "wrong") continue;
    } else if (options.filterType === "bookmarked" || options.contentType === "bookmarked") {
      if (!p?.bookmarked) continue;
    }

    uniqueQuestions.push(item.q);
  }

  const totalCandidateCount = uniqueQuestions.length;

  // Custom range
  if (options.customRangeStart && options.customRangeEnd && options.customRangeStart > 0 && options.customRangeEnd >= options.customRangeStart) {
    const startIdx = options.customRangeStart - 1;
    const endIdx = options.customRangeEnd;
    uniqueQuestions = uniqueQuestions.slice(startIdx, endIdx);
  }
  // Standard batch limit
  else if (
    options.questionLimit &&
    options.questionLimit !== "all" &&
    Number(options.questionLimit) > 0 &&
    Number(options.questionLimit) < uniqueQuestions.length
  ) {
    uniqueQuestions = uniqueQuestions.slice(0, Number(options.questionLimit));
  }

  // Shuffle if required
  if (options.shuffle && uniqueQuestions.length > 1) {
    uniqueQuestions = [...uniqueQuestions];
    for (let i = uniqueQuestions.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [uniqueQuestions[i], uniqueQuestions[j]] = [uniqueQuestions[j], uniqueQuestions[i]];
    }
  }

  return {
    questions: uniqueQuestions,
    subjectTitle: selectedSubjectTitle,
    chapterTitle: selectedChapterTitle,
    topicTitle: selectedTopicTitle,
    testTitle: selectedTestTitle,
    examName: selectedExamName,
    examYear: selectedExamYear,
    count: uniqueQuestions.length,
    totalCandidateCount,
    maxMarks: maxMarks || Math.round(uniqueQuestions.length * 2),
    durationMinutes: durationMinutes || Math.max(15, Math.ceil(uniqueQuestions.length * 1.2)),
    instructionsText,
  };
}

/**
 * Renders parsed question content for printable HTML.
 */
export interface ParsedQuestionComponents {
  intro: string;
  examBadge?: string;
  assertion?: { label: string; body: string };
  reason?: { label: string; body: string };
  statements: { label: string; body: string }[];
  matchPairs: { left: string; right: string }[];
  leftTitle: string;
  rightTitle: string;
  instruction?: string;
  sequenceItems: string[];
  tableData?: { headers: string[]; rows: string[][] };
  imageUrl?: string;
}

export function parseExamQuestion(rawText: string, question?: Question): ParsedQuestionComponents {
  let intro = formatMathAndChemistryLatex(rawText || (question as any)?.question || "");
  let examBadge: string | undefined = undefined;
  let assertion: { label: string; body: string } | undefined = undefined;
  let reason: { label: string; body: string } | undefined = undefined;
  let statements: { label: string; body: string }[] = [];
  let matchPairs: { left: string; right: string }[] = [];
  let leftTitle = "सूची-I";
  let rightTitle = "सूची-II";
  let instruction: string | undefined = undefined;
  let sequenceItems: string[] = [];
  let tableData: { headers: string[]; rows: string[][] } | undefined = undefined;
  let imageUrl: string | undefined = question?.imageUrl || (question as any)?.image?.url || (question as any)?.image?.dataUrl;

  // 1. Extract exam reference from metadata or text
  if (question) {
    if (question.exam || question.year) {
      examBadge = [question.exam, question.year].filter(Boolean).join(" ");
    } else if (Array.isArray(question.examHistory) && question.examHistory.length > 0) {
      const first = question.examHistory[0];
      examBadge = [first.examName, first.year].filter(Boolean).join(" ");
    } else if (question.examName || question.examYear) {
      examBadge = [question.examName, question.examYear].filter(Boolean).join(" ");
    }
  }

  // Check inline exam badge if none in metadata (e.g. [RAS Pre 2021] or (RPSC 2nd Grade 2022))
  if (!examBadge) {
    const inlineBadgeMatch = intro.match(/(?:\[|\()([A-Z0-9\s\.\-–\/]+(?:Pre|Mains|Grade|Exam|Paper|REET|RAS|RPSC|CET|SI|Police|LDC|Patwar|Teacher)[\s\S]*?)(?:\]|\))/i);
    if (inlineBadgeMatch) {
      examBadge = inlineBadgeMatch[1].trim();
      intro = intro.replace(inlineBadgeMatch[0], "").trim();
    }
  }

  // 2. Structured properties from Question object
  if (question) {
    const q = question as any;
    if (Array.isArray(q.statements) && q.statements.length > 0) {
      statements = q.statements.map((s: any, idx: number) => {
        if (typeof s === "string") return { label: `(${idx + 1})`, body: s };
        return { label: s.label || `(${s.number || idx + 1})`, body: s.body || s.text || String(s) };
      });
    }
    if (q.assertion) {
      assertion = typeof q.assertion === "string"
        ? { label: "कथन (A)", body: q.assertion }
        : { label: q.assertion.label || "कथन (A)", body: q.assertion.body || String(q.assertion) };
    }
    if (q.reason) {
      reason = typeof q.reason === "string"
        ? { label: "कारण (R)", body: q.reason }
        : { label: q.reason.label || "कारण (R)", body: q.reason.body || String(q.reason) };
    }
    if (q.instruction) {
      instruction = q.instruction;
    }
    if (Array.isArray(q.sequenceItems) && q.sequenceItems.length > 0) {
      sequenceItems = q.sequenceItems.map((item: any) => (typeof item === "string" ? item : (item?.text || String(item))));
    }
    if (q.tableData && q.tableData.headers) {
      tableData = q.tableData;
    } else if (q.table && q.table.headers) {
      const safeRows = (q.table.rows || []).map((r: any) => (Array.isArray(r) ? r : (r.cells || [])));
      tableData = { headers: q.table.headers, rows: safeRows };
    }

    if (q.matchTable) {
      leftTitle = q.matchTable.leftTitle || "सूची-I";
      rightTitle = q.matchTable.rightTitle || "सूची-II";
      const pairs = q.matchTable.pairs || q.matchTable.rows || [];
      pairs.forEach((p: any) => {
        if (p) matchPairs.push({ left: p.left || p.col1 || "—", right: p.right || p.col2 || "—" });
      });
    } else if (q.matchData || (q.listI && q.listII)) {
      const list1 = q.matchData?.listI || q.listI || [];
      const list2 = q.matchData?.listII || q.listII || [];
      const maxL = Math.max(list1.length, list2.length);
      for (let k = 0; k < maxL; k++) {
        matchPairs.push({ left: list1[k] || "—", right: list2[k] || "—" });
      }
    } else if (Array.isArray(q.pairData) && q.pairData.length > 0) {
      q.pairData.forEach((p: any) => {
        if (p) matchPairs.push({ left: p.left || "—", right: p.right || "—" });
      });
    }
  }

  // 3. Fallback: Parse unparsed text if structured attributes are not set
  if (statements.length === 0 && !assertion && matchPairs.length === 0 && sequenceItems.length === 0 && !tableData) {
    // 3A. Assertion & Reason detection
    const arMatch = intro.match(
      /(?:^|\n|\s)(?:अभिकथन|कथन|Assertion)\s*\(?\s*A\s*\)?\s*[:\-–]\s*([\s\S]*?)(?:(?:\n|\s)(?:कारण|Reason)\s*\(?\s*R\s*\)?\s*[:\-–]\s*([\s\S]*))$/i
    );
    if (arMatch) {
      const introPart = intro.slice(0, arMatch.index).trim();
      const aText = arMatch[1].trim();
      const rRaw = arMatch[2].trim();

      const outroMatch = rRaw.match(/(?:\n|\s)(?:उपर्युक्त|उपरोक्त|नीचे\s+दिए|सही\s+कूट|कूट|Which\s+of|Select)[\s\S]*$/i);
      let rText = rRaw;
      if (outroMatch && outroMatch.index) {
        rText = rRaw.slice(0, outroMatch.index).trim();
        instruction = outroMatch[0].trim();
      }

      intro = introPart;
      assertion = { label: "कथन (A)", body: aText };
      reason = { label: "कारण (R)", body: rText };
    }
  }

  // 3B. Match the following detection from text
  if (matchPairs.length === 0 && !assertion) {
    let capturedIntroL1Title: string | undefined = undefined;
    let capturedIntroL2Title: string | undefined = undefined;

    const introSentenceMatch = intro.match(
      /(?:सूची|List)\s*[-–]?(?:I|1)\s*(\([^\)]+\))?\s*को\s*(?:सूची|List)\s*[-–]?(?:II|2)\s*(\([^\)]+\))?\s*से\s*सुमेलित\s*(?:कीजिए|करें)?(?:[^\n\:]*)?[\:\-\s]*/i
    );
    if (introSentenceMatch) {
      if (introSentenceMatch[1]) capturedIntroL1Title = `सूची-I ${introSentenceMatch[1].trim()}`;
      if (introSentenceMatch[2]) capturedIntroL2Title = `सूची-II ${introSentenceMatch[2].trim()}`;
    }
    const cleanWithoutIntroSentence = introSentenceMatch
      ? intro.replace(introSentenceMatch[0], "").trim()
      : intro;

    const listMatch = cleanWithoutIntroSentence.match(
      /(?:^|\n|\s)(?:सूची|List)\s*[-–]?\s*(?:I|1)\s*(\([^\)]+\))?[\:\-\s]*([\s\S]*?)(?:सूची|List)\s*[-–]?\s*(?:II|2)\s*(\([^\)]+\))?[\:\-\s]*([\s\S]*?)(?:(?:कूट|Code|नीचे|सही\s+कूट)[\s\S]*|$)/i
    );
    if (listMatch) {
      if (listMatch[1]) leftTitle = `सूची-I ${listMatch[1].trim()}`;
      else if (capturedIntroL1Title) leftTitle = capturedIntroL1Title;

      if (listMatch[3]) rightTitle = `सूची-II ${listMatch[3].trim()}`;
      else if (capturedIntroL2Title) rightTitle = capturedIntroL2Title;

      const l1Text = listMatch[2].trim();
      const l2Raw = listMatch[4].trim();

      const outroMatch = l2Raw.match(/(?:\n|\s)(?:कूट|नीचे\s+दिए|सही\s+कूट|उपर्युक्त|Code)[\s\S]*$/i);
      let l2Text = l2Raw;
      if (outroMatch && outroMatch.index) {
        l2Text = l2Raw.slice(0, outroMatch.index).trim();
        instruction = outroMatch[0].trim();
      }

      const splitItems = (t: string) => {
        const trimmed = t.trim();
        const lines = trimmed.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
        if (lines.length >= 2) {
          return lines;
        }
        return trimmed.split(/\s+(?=[(][a-dA-D1-4ivxIVX]+[)]|[A-D1-4]\.|\([1-4]\))/).map((s) => s.trim()).filter(Boolean);
      };

      const l1Items = splitItems(l1Text);
      const l2Items = splitItems(l2Text);
      const max = Math.max(l1Items.length, l2Items.length);
      for (let i = 0; i < max; i++) {
        matchPairs.push({ left: l1Items[i] || "—", right: l2Items[i] || "—" });
      }

      const l1Index = intro.indexOf("सूची-I");
      if (l1Index > 0) {
        intro = intro.slice(0, l1Index).trim();
      }
    }
  }

  // 3C. Numbered statements detection: 1. ... 2. ...
  if (statements.length === 0 && !assertion && matchPairs.length === 0) {
    const markerRegex = /(?:^|\n|\s)([1-9]\.|\([1-9]\)|\([a-d]\))\s+/g;
    const markers: { label: string; index: number; endIndex: number }[] = [];
    let match: RegExpExecArray | null;

    while ((match = markerRegex.exec(intro)) !== null) {
      markers.push({
        label: match[1],
        index: match.index + (match[0].startsWith("\n") || match[0].startsWith(" ") ? 1 : 0),
        endIndex: match.index + match[0].length,
      });
    }

    if (markers.length >= 2) {
      const introPart = intro.slice(0, markers[0].index).trim();
      const stmts: { label: string; body: string }[] = [];

      for (let i = 0; i < markers.length; i++) {
        const start = markers[i].endIndex;
        const end = i + 1 < markers.length ? markers[i + 1].index : intro.length;
        stmts.push({ label: markers[i].label, body: intro.slice(start, end).trim() });
      }

      const lastIdx = stmts.length - 1;
      const outroMatch = stmts[lastIdx].body.match(/(?:\n|\s)(?:उपर्युक्त|उपरोक्त|नीचे\s+दिए|सही\s+कूट|कूट|Which\s+of|Select)[\s\S]*$/i);
      if (outroMatch && outroMatch.index) {
        instruction = outroMatch[0].trim();
        stmts[lastIdx].body = stmts[lastIdx].body.slice(0, outroMatch.index).trim();
      }

      intro = introPart;
      statements = stmts.filter((s) => s.body.length > 0);
    }
  }

  return {
    intro,
    examBadge,
    assertion,
    reason,
    statements,
    matchPairs,
    leftTitle,
    rightTitle,
    instruction,
    sequenceItems,
    tableData,
    imageUrl,
  };
}

export function renderParsedQuestionHTML(
  rawText: string,
  fontSize: "normal" | "large" = "normal",
  question?: Question,
  qNum?: number
): string {
  const parsed = parseExamQuestion(rawText, question);
  let html = `<div class="q-parsed-wrapper">`;

  // Question Prompt / Intro (with Inline Question Number & Exam Badge)
  html += `
    <div class="q-text-block">
      ${typeof qNum === "number" ? `<span class="q-num-inline">${qNum}.</span>` : ""}
      <span class="q-text-inline">${escapeHTML(parsed.intro)}</span>
      ${parsed.examBadge ? `<span class="exam-tag">[${escapeHTML(parsed.examBadge)}]</span>` : ""}
    </div>
  `;

  // Assertion & Reason (कथन एवं कारण)
  if (parsed.assertion || parsed.reason) {
    html += `<div class="book-ar-box">`;
    if (parsed.assertion) {
      html += `<div class="ar-line"><span class="ar-tag">${escapeHTML(parsed.assertion.label)}:</span> <span class="ar-content">${escapeHTML(parsed.assertion.body)}</span></div>`;
    }
    if (parsed.reason) {
      html += `<div class="ar-line"><span class="ar-tag">${escapeHTML(parsed.reason.label)}:</span> <span class="ar-content">${escapeHTML(parsed.reason.body)}</span></div>`;
    }
    html += `</div>`;
  }

  // Multiple Statements (कथन 1, 2, 3)
  if (parsed.statements.length > 0) {
    html += `<div class="book-statements-box">`;
    parsed.statements.forEach((stmt) => {
      html += `<div class="stmt-item"><span class="stmt-tag">${escapeHTML(stmt.label)}</span> <span class="stmt-content">${escapeHTML(stmt.body)}</span></div>`;
    });
    html += `</div>`;
  }

  // Match the Following (सुमेलित कीजिए - Academic 2-Column Table)
  if (parsed.matchPairs.length > 0) {
    html += `
      <div class="book-match-container">
        <table class="book-match-table">
          <thead>
            <tr>
              <th>${escapeHTML(parsed.leftTitle)}</th>
              <th>${escapeHTML(parsed.rightTitle)}</th>
            </tr>
          </thead>
          <tbody>
    `;
    parsed.matchPairs.forEach((pair) => {
      html += `
        <tr>
          <td>${escapeHTML(pair.left || "—")}</td>
          <td>${escapeHTML(pair.right || "—")}</td>
        </tr>
      `;
    });
    html += `
          </tbody>
        </table>
      </div>
    `;
  }

  // Data Table
  if (parsed.tableData && Array.isArray(parsed.tableData.headers) && parsed.tableData.headers.length > 0) {
    const safeRows = Array.isArray(parsed.tableData.rows) ? parsed.tableData.rows : [];
    html += `
      <div class="book-table-container">
        <table class="book-match-table">
          <thead>
            <tr>
              ${parsed.tableData.headers.map((h) => `<th>${escapeHTML(String(h ?? ""))}</th>`).join("")}
            </tr>
          </thead>
          <tbody>
            ${safeRows.map((row) => {
              const safeCells = Array.isArray(row) ? row : [];
              return `
                <tr>
                  ${safeCells.map((cell) => `<td>${escapeHTML(String(cell ?? ""))}</td>`).join("")}
                </tr>
              `;
            }).join("")}
          </tbody>
        </table>
      </div>
    `;
  }

  // Instruction / Outro Prompt
  if (parsed.instruction) {
    html += `<div class="book-instruction">${escapeHTML(parsed.instruction)}</div>`;
  }

  // Sequence Items
  if (parsed.sequenceItems.length > 0) {
    html += `<div class="book-statements-box">`;
    parsed.sequenceItems.forEach((seq, idx) => {
      html += `<div class="stmt-item"><span class="stmt-tag">(${idx + 1})</span> <span class="stmt-content">${escapeHTML(seq)}</span></div>`;
    });
    html += `</div>`;
  }

  // Diagram / Image
  if (parsed.imageUrl) {
    html += `<div class="q-diagram-wrap"><img src="${escapeHTML(parsed.imageUrl)}" alt="Diagram" class="q-diagram-img" /></div>`;
  }

  html += `</div>`;
  return html;
}

/**
 * Accurately calculates realistic height requirements for a single question content block in pixels.
 * Accounts for 2-column book density, multi-tier options (1-line inline, 2x2 grid, or vertical),
 * assertion-reasons, match tables, and compact explanation boxes.
 */
function estimateQuestionHeight(
  q: Question,
  isSolutionsMode: boolean,
  isCompact: boolean,
  fontSize: "normal" | "large" = "normal"
): number {
  const fontMultiplier = fontSize === "large" ? 1.15 : 1.0;
  const charsPerLine = isCompact ? 38 : 65;
  const linePx = Math.round(15 * fontMultiplier);

  // 1. Question Text
  const text = q.text || (q as any).question || "";
  const linesCount = text.split("\n").reduce((acc, line) => {
    return acc + Math.max(1, Math.ceil(line.length / charsPerLine));
  }, 0);
  let totalHeight = linesCount * linePx;

  // 2. Structured Sub-elements
  const qAny = q as any;
  if (qAny.assertion || qAny.reason) {
    totalHeight += Math.round(30 * fontMultiplier);
  }
  if (Array.isArray(qAny.statements) && qAny.statements.length > 0) {
    totalHeight += qAny.statements.length * Math.round(16 * fontMultiplier);
  }
  if (qAny.matchTable || qAny.matchData || qAny.pairData) {
    const pairCount = (qAny.matchTable?.pairs || qAny.matchTable?.rows || qAny.matchData?.listI || []).length || 4;
    totalHeight += Math.round((16 + pairCount * 14) * fontMultiplier);
  }
  if (qAny.tableData && qAny.tableData.headers) {
    const rowCount = (qAny.tableData.rows || []).length;
    totalHeight += Math.round((16 + rowCount * 14) * fontMultiplier);
  }

  // 3. Multi-tier Options Grid
  const safeOptions = Array.isArray(q.options) && q.options.length > 0 ? q.options : [];
  if (safeOptions.length > 0) {
    const maxOptLen = Math.max(...safeOptions.map((o) => String(o || "").trim().length));
    if (safeOptions.length === 4 && maxOptLen <= 18) {
      // Tier 1: 1 single row (4-cols inline)
      totalHeight += Math.round(17 * fontMultiplier);
    } else if (maxOptLen <= 36) {
      // Tier 2: 2x2 grid (2 rows)
      totalHeight += Math.round(34 * fontMultiplier);
    } else {
      // Tier 3: Vertical list
      totalHeight += safeOptions.length * Math.round(17 * fontMultiplier);
    }
  }

  // 4. Solutions Mode: Compact Inline Answer & Explanation
  if (isSolutionsMode) {
    const expText = (q.explanation || "").trim();
    if (expText.length > 0) {
      const expLines = Math.ceil(expText.length / (charsPerLine - 4));
      totalHeight += Math.round((16 + expLines * 13) * fontMultiplier);
    } else {
      totalHeight += Math.round(18 * fontMultiplier);
    }
    if (q.importantFact) {
      totalHeight += Math.round(16 * fontMultiplier);
    }
  }

  // Margin and bottom divider
  totalHeight += 6;

  // Ultra-compact minimum height (35px for compact book mode, 45px for single col)
  return Math.max(isCompact ? 35 : 45, Math.round(totalHeight));
}

/**
 * Intelligent Page Chunking:
 * Dynamically groups question blocks into A4 page containers so that:
 * 1. Complete questions fit inside the page budget.
 * 2. Page breaks occur only between questions.
 * 3. 2-column mode packs 20-30 questions per page to minimize printing costs.
 */
export function chunkQuestionsIntoPages(
  questions: Question[],
  isSolutionsMode: boolean,
  isCompact: boolean,
  fontSize: "normal" | "large" = "normal"
): Question[][] {
  // Column height in A4 (297mm @ 96dpi = 1123px - ~118px overhead) = ~1005px.
  // In 2-column book mode, total usable height across both columns is ~2010px.
  const PAGE_HEIGHT_BUDGET = isCompact
    ? fontSize === "large"
      ? 1820
      : 2020
    : fontSize === "large"
    ? 900
    : 1000;

  const pages: Question[][] = [];
  let currentChunk: Question[] = [];
  let currentHeight = 0;

  for (const q of questions) {
    const qHeight = estimateQuestionHeight(q, isSolutionsMode, isCompact, fontSize);

    // If adding this question exceeds current page budget, start a fresh page
    if (currentChunk.length > 0 && currentHeight + qHeight > PAGE_HEIGHT_BUDGET) {
      pages.push(currentChunk);
      currentChunk = [q];
      currentHeight = qHeight;
    } else {
      currentChunk.push(q);
      currentHeight += qHeight;
    }
  }

  if (currentChunk.length > 0) {
    pages.push(currentChunk);
  }

  return pages;
}

/**
 * Generate Complete Printable HTML matching DISHA 20-20 brand guidelines & A4 page boundaries
 */
export function generateDisha2020PDFHTML(
  questions: Question[],
  meta: {
    subjectTitle: string;
    chapterTitle?: string;
    topicTitle?: string;
    testTitle?: string;
    examName?: string;
    examYear?: string;
    filterType: "all" | "wrong" | "bookmarked";
    format: PDFFormatCard;
    layout: "single" | "compact";
    fontSize: "normal" | "large";
    colorMode?: "color" | "bw";
    includeCoverPage: boolean;
    showPageNumbers: boolean;
    showHeaderFooter: boolean;
    includeTestInstructions: boolean;
    includeSubjectTopicNames: boolean;
    includeBlankAnswerSheet: boolean;
    customTitle?: string;
    studentName?: string;
    rollNumber?: string;
    maxMarks?: number;
    durationMinutes?: number;
    instructionsText?: string;
    progressStore?: ProgressStore;
  }
): string {
  const subjectHeaderName = meta.subjectTitle || "GENERAL STUDIES";
  const topicOrSubName = meta.topicTitle || meta.chapterTitle || "Practice Question Paper";
  const documentHeaderTitle = meta.customTitle || meta.testTitle || "Disha PYQ • PRACTICE PAPER";
  const totalMarks = meta.maxMarks || (questions.length * 2);
  const durationMins = meta.durationMinutes || 60;
  const optionLetters = ["A", "B", "C", "D"];

  const isSolutionsMode = meta.format === "detailed_solutions";
  const isCompact = meta.layout === "compact";
  const isBW = meta.colorMode === "bw";

  // Theme tokens: Royal Violet Color Mode vs High-Contrast Black & White Print Mode
  const primaryAccent = isBW ? "#000000" : "#5B32BF";
  const primaryBright = isBW ? "#111111" : "#7045D8";
  const primarySoftBg = isBW ? "#F1F5F9" : "#F3EFFE";
  const borderMain = isBW ? "#000000" : "#CBD5E1";
  const borderMuted = isBW ? "#64748B" : "#E2E8F0";
  const textMain = isBW ? "#000000" : "#0F172A";
  const textMuted = isBW ? "#334155" : "#475569";
  const correctBadgeBg = isBW ? "#000000" : "#16A34A";
  const correctText = isBW ? "#000000" : "#15803D";
  const correctLightBg = isBW ? "#E2E8F0" : "#DCFCE7";
  const pagePreviewBg = isBW ? "#E2E8F0" : "#F1F5F9";

  // Chunk questions into page buckets using fontSize parameter
  const questionPageBuckets = meta.format !== "answer_key"
    ? chunkQuestionsIntoPages(questions, isSolutionsMode, isCompact, meta.fontSize)
    : [];

  const hasCover = meta.includeCoverPage;
  const hasOMR = meta.format === "question_paper_omr" || meta.includeBlankAnswerSheet;
  const hasAnswerKey = meta.format === "answer_key";

  const questionPagesCount = questionPageBuckets.length;
  const answerKeyPagesCount = hasAnswerKey ? Math.ceil(questions.length / 100) : 0;
  const omrPagesCount = hasOMR ? 1 : 0;

  const totalDocumentPages =
    (hasCover ? 1 : 0) +
    (hasAnswerKey ? answerKeyPagesCount : questionPagesCount + omrPagesCount);

  let currentOverallPageNum = 1;

  // 1. COVER PAGE HTML
  let coverPageHTML = "";
  if (hasCover) {
    const coverPageNumberStr = `Page ${currentOverallPageNum} of ${totalDocumentPages}`;
    currentOverallPageNum++;

    coverPageHTML = `
      <section class="a4-page cover-page">
        <!-- Top Header -->
        <div class="cover-top-header">
          <div class="dot-grid-pattern">
            <svg width="44" height="32" viewBox="0 0 44 32">
              <circle cx="6" cy="6" r="2.5" fill="#E3DEF2"/>
              <circle cx="18" cy="6" r="2.5" fill="#E3DEF2"/>
              <circle cx="30" cy="6" r="2.5" fill="#E3DEF2"/>
              <circle cx="6" cy="18" r="2.5" fill="#7045D8"/>
              <circle cx="18" cy="18" r="2.5" fill="#7045D8"/>
              <circle cx="30" cy="18" r="2.5" fill="#7045D8"/>
            </svg>
          </div>

          <div class="cover-logo-center">
            <div class="cover-logo-icon">
              <svg viewBox="0 0 200 200" class="logo-svg">
                <circle cx="100" cy="95" r="52" fill="#F4F1FA" stroke="#7045D8" stroke-width="5" />
                <rect x="48" y="80" width="104" height="42" rx="12" fill="#7045D8" />
                <text x="100" y="108" text-anchor="middle" fill="#FFFFFF" font-size="22" font-weight="900" font-family="Plus Jakarta Sans, sans-serif">PYQ</text>
              </svg>
            </div>
            <div class="cover-brand-name">DISHA <span style="color:#7045D8;">PYQ</span></div>
          </div>

          <div class="cover-top-stack">
            <span>Previous Year Questions</span>
            <span>Precision Learning</span>
            <span>Disha PYQ</span>
          </div>
        </div>

        <!-- Title Banner -->
        <div class="cover-hero-title-box">
          <div class="cover-tag-badge">OFFICIAL PRACTICE WORKBOOK</div>
          <h1 class="cover-main-title">${escapeHTML(documentHeaderTitle)}</h1>
          <div class="cover-subtitle-pill">${escapeHTML(subjectHeaderName)} • ${escapeHTML(topicOrSubName)}</div>
        </div>

        <!-- 3 Stat Cards -->
        <div class="cover-stats-row">
          <div class="cover-stat-card">
            <div class="stat-icon blue-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
            </div>
            <div class="stat-num">${questions.length}</div>
            <div class="stat-lbl">TOTAL QUESTIONS</div>
          </div>

          <div class="cover-stat-card">
            <div class="stat-icon blue-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            </div>
            <div class="stat-num">${durationMins}</div>
            <div class="stat-lbl">TIME (MINUTES)</div>
          </div>

          <div class="cover-stat-card">
            <div class="stat-icon orange-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2z"/></svg>
            </div>
            <div class="stat-num">${totalMarks}</div>
            <div class="stat-lbl">MAXIMUM MARKS</div>
          </div>
        </div>

        <!-- Instructions Card -->
        <div class="cover-instructions-box">
          <div class="cover-inst-header">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="${primaryAccent}" stroke-width="2.5"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
            <span>Important Exam Instructions</span>
          </div>
          <ol class="cover-inst-list">
            <li>Each question has four options, with only one correct answer.</li>
            <li>All questions carry equal marks. Read each question carefully before answering.</li>
            <li>Answer key and explanations are provided at the end of the test sheet.</li>
            <li>Maintain strict time discipline and self-evaluate your accuracy rate.</li>
            <li>Consistent revision and deliberate practice are key to achieving a top score.</li>
          </ol>
        </div>

        <!-- Student Personalization Box (If present) -->
        ${
          meta.studentName || meta.rollNumber
            ? `
            <div class="candidate-info-strip">
              <div><strong>Candidate Name:</strong> ${escapeHTML(meta.studentName || "____________________")}</div>
              <div><strong>Roll Number:</strong> ${escapeHTML(meta.rollNumber || "____________________")}</div>
            </div>
          `
            : ""
        }

        <!-- Cover Footer Wave & Tagline -->
        <div class="cover-footer-waves-container">
          <svg class="cover-wave-svg" viewBox="0 0 500 110" preserveAspectRatio="none">
            <path d="M0,110 L500,110 L500,50 C380,90 280,20 0,60 Z" fill="${isBW ? "#E2E8F0" : "#C4B5FD"}" />
            <path d="M0,110 L500,110 L500,65 C350,95 250,35 0,75 Z" fill="${isBW ? "#94A3B8" : "#8B5CF6"}" />
            <path d="M0,110 L500,110 L500,75 C320,100 220,45 0,85 Z" fill="${primaryBright}" />
            <path d="M0,110 L500,110 L500,85 C300,105 180,60 0,95 Z" fill="${primaryAccent}" />
          </svg>
          <div class="cover-footer-content-row">
            <div class="cover-foot-tag">${escapeHTML(meta.instructionsText || "Disha PYQ • Previous Year Questions & Precision Learning")}</div>
            <div class="cover-foot-num">${coverPageNumberStr}</div>
          </div>
        </div>
      </section>
    `;
  }

  // 2. QUESTION PAGES HTML
  let questionPagesHTML = "";
  let currentQuestionIndex = 0;

  if (meta.format !== "answer_key") {
    questionPageBuckets.forEach((bucket, bIdx) => {
      const pageNumberStr = `Page ${currentOverallPageNum} of ${totalDocumentPages}`;
      currentOverallPageNum++;

      const questionsMarkup = bucket
        .map((q) => {
          currentQuestionIndex++;
          const qNum = currentQuestionIndex;

          // Options Markup with Multi-tier Book Layout
          const safeOptions = Array.isArray(q.options) && q.options.length > 0
            ? q.options
            : (q && typeof (q as any).options === "string"
                ? [(q as any).options]
                : ["Option A", "Option B", "Option C", "Option D"]);

          // Tier 1: 4 options and all <= 18 chars -> opts-inline-four (1 row)
          // Tier 2: all <= 38 chars -> opts-two-by-two (2 rows)
          // Tier 3: opts-vertical
          const maxOptLen = Math.max(...safeOptions.map((o) => String(o || "").trim().length));
          const optionLayoutClass =
            safeOptions.length === 4 && maxOptLen <= 18
              ? "opts-inline-four"
              : maxOptLen <= 38
              ? "opts-two-by-two"
              : "opts-vertical";

          const optionsMarkup = safeOptions
            .map((opt, oIdx) => {
              const isCorrect = oIdx === q.correctIndex;
              const letter = optionLetters[oIdx] || "A";
              const isSolutionHighlighted = isSolutionsMode && isCorrect;

              return `
                <div class="opt-item ${isSolutionHighlighted ? "opt-item-correct" : ""}">
                  <span class="opt-lbl">(${letter})</span>
                  <span class="opt-txt">${escapeHTML(opt || "")}</span>
                </div>
              `;
            })
            .join("");

          // Explanation Box (Solutions mode only - Ultra-Compact Academic Style)
          let explanationMarkup = "";
          if (isSolutionsMode) {
            const expText = q.explanation && q.explanation.trim().length > 0
              ? q.explanation
              : "";
            const correctLetter = typeof q.correctIndex === "number" ? optionLetters[q.correctIndex] || "A" : "A";

            explanationMarkup = `
              <div class="book-exp-box">
                <div class="exp-ans-line">
                  <span class="exp-ans-tag">[उत्तर: (${correctLetter})]</span>
                  <span class="exp-body">${escapeHTML(expText || "उत्तर की विस्तृत व्याख्या उपलब्ध नहीं है।")}</span>
                </div>
                ${
                  q.importantFact
                    ? `
                    <div class="exp-fact-line">
                      <span class="fact-tag">★ मुख्य तथ्य:</span>
                      <span class="fact-body">${escapeHTML(q.importantFact)}</span>
                    </div>
                  `
                    : ""
                }
              </div>
            `;
          }

          return `
            <article class="mcq-card">
              ${renderParsedQuestionHTML(q.text, meta.fontSize, q, qNum)}
              <div class="${optionLayoutClass}">
                ${optionsMarkup}
              </div>
              ${explanationMarkup}
            </article>
          `;
        })
        .join("");

      questionPagesHTML += `
        <section class="a4-page question-page">
          <header class="paper-top-header">
            <div class="logo-wrapper">
              <svg viewBox="0 0 200 200" class="header-logo-svg">
                <circle cx="100" cy="95" r="52" fill="${primarySoftBg}" stroke="${primaryAccent}" stroke-width="8" />
                <rect x="48" y="80" width="104" height="42" rx="12" fill="${primaryAccent}" />
                <text x="100" y="108" text-anchor="middle" fill="#FFFFFF" font-size="22" font-weight="900" font-family="Plus Jakarta Sans, sans-serif">PYQ</text>
              </svg>
              <div class="header-brand-name">DISHA <span style="color:${primaryBright};">PYQ</span></div>
            </div>
            <div class="header-right-title">
              <div class="hdr-main-title">${escapeHTML(documentHeaderTitle)}</div>
              <div class="hdr-sub">${escapeHTML(subjectHeaderName)} • ${escapeHTML(topicOrSubName)}</div>
            </div>
          </header>

          ${
            !hasCover && bIdx === 0
              ? `
            <div class="first-page-exam-strip">
              <div class="exam-strip-title">${escapeHTML(documentHeaderTitle)}</div>
              <div class="exam-strip-details">
                <span><strong>विषय:</strong> ${escapeHTML(subjectHeaderName)}</span>
                ${topicOrSubName ? `<span><strong>अध्याय/टॉपिक:</strong> ${escapeHTML(topicOrSubName)}</span>` : ""}
                <span><strong>कुल प्रश्न:</strong> ${questions.length}</span>
                <span><strong>समय:</strong> ${durationMins} मिनट</span>
                <span><strong>पूर्णांक:</strong> ${totalMarks}</span>
              </div>
            </div>
          `
              : ""
          }

          <main class="page-main-content ${isCompact ? "book-two-col" : ""}">
            ${questionsMarkup}
          </main>

          <footer class="paper-footer">
            <span>${escapeHTML(meta.instructionsText || "Disha PYQ • Previous Year Questions & Precision Learning")}</span>
            <span class="footer-page-num">${pageNumberStr}</span>
          </footer>
        </section>
      `;
    });
  }

  // 3. BLANK ANSWER SHEET (OMR) PAGE
  let omrPageHTML = "";
  if (hasOMR) {
    const pageNumberStr = `Page ${currentOverallPageNum} of ${totalDocumentPages}`;
    currentOverallPageNum++;

    const halfCount = Math.ceil(questions.length / 2);
    let leftRowsHTML = "";
    let rightRowsHTML = "";

    for (let i = 0; i < halfCount; i++) {
      const qNumLeft = i + 1;
      leftRowsHTML += `
        <tr>
          <td class="omr-qnum">Q${qNumLeft}</td>
          <td><span class="omr-circle">○</span></td>
          <td><span class="omr-circle">○</span></td>
          <td><span class="omr-circle">○</span></td>
          <td><span class="omr-circle">○</span></td>
        </tr>
      `;

      const qNumRight = i + 1 + halfCount;
      if (qNumRight <= questions.length) {
        rightRowsHTML += `
          <tr>
            <td class="omr-qnum">Q${qNumRight}</td>
            <td><span class="omr-circle">○</span></td>
            <td><span class="omr-circle">○</span></td>
            <td><span class="omr-circle">○</span></td>
            <td><span class="omr-circle">○</span></td>
          </tr>
        `;
      }
    }

    omrPageHTML = `
      <section class="a4-page omr-page">
        <header class="paper-top-header">
          <div class="logo-wrapper">
            <svg viewBox="0 0 200 200" class="header-logo-svg">
              <circle cx="100" cy="95" r="52" fill="#F4F1FA" stroke="#7045D8" stroke-width="6" />
              <rect x="48" y="80" width="104" height="42" rx="12" fill="#7045D8" />
            </svg>
            <div class="header-brand-name">DISHA <span style="color:#7045D8;">PYQ</span></div>
          </div>
          <div class="header-right-title">
            <div class="hdr-main-title">RESPONSE SHEET (OMR)</div>
            <div class="hdr-sub">${escapeHTML(subjectHeaderName)} • PRACTICE TEST</div>
          </div>
        </header>

        <div class="omr-fields-card">
          <div class="omr-field-row">
            <div><strong>Candidate Name:</strong> ____________________________</div>
            <div><strong>Roll No:</strong> _______________</div>
          </div>
          <div class="omr-field-row" style="margin-top:6px;">
            <div><strong>Date:</strong> _______________</div>
            <div><strong>Subject:</strong> ${escapeHTML(subjectHeaderName)}</div>
          </div>
        </div>

        <div class="omr-grid-two-col">
          <table class="omr-table">
            <thead>
              <tr><th>Q.No.</th><th>A</th><th>B</th><th>C</th><th>D</th></tr>
            </thead>
            <tbody>${leftRowsHTML}</tbody>
          </table>

          <table class="omr-table">
            <thead>
              <tr><th>Q.No.</th><th>A</th><th>B</th><th>C</th><th>D</th></tr>
            </thead>
            <tbody>${rightRowsHTML}</tbody>
          </table>
        </div>

        <footer class="paper-footer">
          <span>Disha PYQ • Official Response Sheet</span>
          <span class="footer-page-num">${pageNumberStr}</span>
        </footer>
      </section>
    `;
  }

  // 4. ANSWER KEY PAGE (5-Column Ultra-Dense Book Grid - up to 100 Qs per page)
  let answerKeyPageHTML = "";
  if (hasAnswerKey) {
    const questionsPerKeyPage = 100;
    const keyPagesCount = Math.ceil(questions.length / questionsPerKeyPage);

    for (let pIdx = 0; pIdx < keyPagesCount; pIdx++) {
      const pageNumberStr = `Page ${currentOverallPageNum} of ${totalDocumentPages}`;
      currentOverallPageNum++;

      const pageQuestions = questions.slice(pIdx * questionsPerKeyPage, (pIdx + 1) * questionsPerKeyPage);
      const totalInPage = pageQuestions.length;
      const numCols = Math.min(5, Math.max(2, Math.ceil(totalInPage / 20)));
      const rowsPerCol = Math.ceil(totalInPage / numCols);

      let colsHTML = "";
      for (let c = 0; c < numCols; c++) {
        const colStart = c * rowsPerCol;
        const colEnd = Math.min(colStart + rowsPerCol, totalInPage);
        if (colStart >= totalInPage) break;

        let rowsHTML = "";
        for (let r = colStart; r < colEnd; r++) {
          const actualQIndex = pIdx * questionsPerKeyPage + r;
          const qObj = questions[actualQIndex];
          const ansLetter = qObj && typeof qObj.correctIndex === "number" ? optionLetters[qObj.correctIndex] || "—" : "—";
          rowsHTML += `
            <tr>
              <td class="ans-qnum">${actualQIndex + 1}</td>
              <td class="ans-val">${ansLetter}</td>
            </tr>
          `;
        }

        colsHTML += `
          <div class="ans-key-col">
            <table class="ans-col-table">
              <thead>
                <tr><th>प्र.सं.</th><th>उत्तर</th></tr>
              </thead>
              <tbody>
                ${rowsHTML}
              </tbody>
            </table>
          </div>
        `;
      }

      answerKeyPageHTML += `
        <section class="a4-page answer-key-page">
          <header class="paper-top-header">
            <div class="logo-wrapper">
              <svg viewBox="0 0 200 200" class="header-logo-svg">
                <circle cx="100" cy="95" r="52" fill="${primarySoftBg}" stroke="${primaryAccent}" stroke-width="6" />
                <rect x="48" y="80" width="104" height="42" rx="12" fill="${primaryAccent}" />
              </svg>
              <div class="header-brand-name">DISHA <span style="color:${primaryBright};">PYQ</span></div>
            </div>
            <div class="header-right-title">
              <div class="hdr-main-title">OFFICIAL ANSWER KEY (उत्तरमाला)</div>
              <div class="hdr-sub">${escapeHTML(subjectHeaderName)} • ${escapeHTML(topicOrSubName)}</div>
            </div>
          </header>

          <main class="page-main-content">
            <div class="ans-key-grid-5" style="grid-template-columns: repeat(${numCols}, 1fr);">
              ${colsHTML}
            </div>
          </main>

          <footer class="paper-footer">
            <span>Disha PYQ • Verified Answer Key</span>
            <span class="footer-page-num">${pageNumberStr}</span>
          </footer>
        </section>
      `;
    }
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${escapeHTML(documentHeaderTitle)} - Disha PYQ PDF</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;600;700;800;900&family=Noto+Sans+Devanagari:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    *, *::before, *::after {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    @page {
      size: A4 portrait;
      margin: 0;
    }

    body {
      font-family: 'Noto Sans Devanagari', 'Plus Jakarta Sans', system-ui, sans-serif;
      font-size: ${meta.fontSize === "large" ? "9.8pt" : "8.6pt"};
      line-height: 1.38;
      color: ${textMain};
      background-color: ${pagePreviewBg};
      padding: 12px 0;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    .a4-page {
      width: 190mm;
      min-height: 268mm;
      height: auto;
      box-sizing: border-box;
      background: #FFFFFF;
      margin: 0 auto 14px auto;
      padding: 7mm 8mm;
      position: relative;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      border: 1px solid ${borderMuted};
      box-shadow: 0 4px 12px rgba(23, 25, 35, 0.08);
      page-break-after: always;
      break-after: page;
    }

    @media print {
      body {
        background: #FFFFFF;
        padding: 0;
      }
      .a4-page {
        margin: 0;
        width: 210mm;
        height: 297mm;
        max-height: 297mm;
        padding: 7mm 8mm;
        border: none;
        box-shadow: none;
        page-break-after: always;
        break-after: page;
      }
    }

    /* First Page Exam Strip (When Cover Page is disabled) */
    .first-page-exam-strip {
      border: 1.5px solid ${primaryAccent};
      background: ${primarySoftBg};
      border-radius: 6px;
      padding: 4px 8px;
      margin-bottom: 6px;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .exam-strip-title {
      font-size: 10.5pt;
      font-weight: 900;
      color: ${primaryAccent};
      text-align: center;
      letter-spacing: -0.3px;
    }

    .exam-strip-details {
      display: flex;
      justify-content: space-around;
      flex-wrap: wrap;
      gap: 2px 10px;
      font-size: 7.6pt;
      color: ${textMain};
      font-weight: 600;
      border-top: 0.5px solid ${borderMuted};
      padding-top: 2px;
    }

    /* COVER PAGE STYLES */
    .cover-top-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .cover-logo-center {
      display: flex;
      flex-direction: column;
      align-items: center;
    }

    .cover-logo-icon {
      width: 70px;
      height: 70px;
    }

    .logo-svg {
      width: 100%;
      height: 100%;
    }

    .cover-brand-name {
      font-size: 24pt;
      font-weight: 900;
      color: ${primaryAccent};
      letter-spacing: -0.5px;
      line-height: 1;
      margin-top: 2px;
    }

    .cover-top-stack {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      font-size: 7pt;
      font-weight: 900;
      color: ${textMuted};
      letter-spacing: 1.5px;
      line-height: 1.3;
    }

    .cover-hero-title-box {
      text-align: center;
      margin: 16px 0 10px 0;
    }

    .cover-tag-badge {
      display: inline-block;
      font-size: 7.5pt;
      font-weight: 900;
      color: ${primaryAccent};
      background: ${primarySoftBg};
      border: 1px solid ${primaryAccent};
      padding: 4px 14px;
      border-radius: 999px;
      letter-spacing: 1px;
      margin-bottom: 8px;
    }

    .cover-main-title {
      font-size: 26pt;
      font-weight: 900;
      color: ${primaryAccent};
      letter-spacing: -0.5px;
      line-height: 1.15;
    }

    .cover-subtitle-pill {
      display: inline-block;
      font-size: 11pt;
      font-weight: 800;
      color: ${textMain};
      background: ${primarySoftBg};
      padding: 6px 18px;
      border-radius: 999px;
      border: 1px solid ${borderMuted};
      margin-top: 10px;
    }

    /* Stats Cards */
    .cover-stats-row {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 12px;
      margin: 12px 0;
    }

    .cover-stat-card {
      background: #FFFFFF;
      border: 1.5px solid ${borderMuted};
      border-radius: 12px;
      padding: 12px 8px;
      text-align: center;
    }

    .blue-icon { color: ${primaryAccent}; }
    .orange-icon { color: ${primaryBright}; }

    .stat-num {
      font-size: 22pt;
      font-weight: 900;
      color: ${primaryAccent};
      line-height: 1.1;
      margin-top: 2px;
    }

    .stat-lbl {
      font-size: 7.5pt;
      font-weight: 800;
      color: ${textMuted};
      letter-spacing: 0.5px;
      margin-top: 2px;
    }

    /* Instructions Box */
    .cover-instructions-box {
      background: ${primarySoftBg};
      border: 1px solid ${borderMuted};
      border-radius: 12px;
      padding: 12px 16px;
      margin: 8px 0;
    }

    .cover-inst-header {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 9.5pt;
      font-weight: 900;
      color: ${primaryAccent};
      margin-bottom: 6px;
    }

    .cover-inst-list {
      padding-left: 18px;
      display: flex;
      flex-direction: column;
      gap: 4px;
      font-size: 8.5pt;
      color: ${textMain};
      font-weight: 600;
    }

    .candidate-info-strip {
      display: flex;
      justify-content: space-between;
      background: ${primarySoftBg};
      border: 1px solid ${primaryAccent};
      padding: 8px 14px;
      border-radius: 8px;
      font-size: 8.5pt;
      color: ${primaryAccent};
      margin-top: 6px;
    }

    /* Wave Container */
    .cover-footer-waves-container {
      position: relative;
      margin-left: -12mm;
      margin-right: -12mm;
      margin-bottom: -10mm;
      height: 80px;
    }

    .cover-wave-svg {
      width: 100%;
      height: 100%;
      display: block;
    }

    .cover-footer-content-row {
      position: absolute;
      bottom: 12px;
      left: 16px;
      right: 16px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      color: #FFFFFF;
      font-size: 8.5pt;
      font-weight: 800;
    }

    .cover-foot-tag { color: #FFFFFF; }
    .cover-foot-num {
      background: rgba(255, 255, 255, 0.2);
      padding: 2px 10px;
      border-radius: 999px;
    }

    /* QUESTION PAGE STYLES */
    .paper-top-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1.5px solid ${primaryAccent};
      padding-bottom: 4px;
      margin-bottom: 6px;
    }

    .logo-wrapper {
      display: flex;
      align-items: center;
      gap: 5px;
    }

    .header-logo-svg {
      width: 22px;
      height: 22px;
    }

    .header-brand-name {
      font-size: 13pt;
      font-weight: 900;
      color: ${primaryAccent};
    }

    .header-right-title {
      text-align: right;
    }

    .hdr-main-title {
      font-size: 9pt;
      font-weight: 900;
      color: ${primaryAccent};
      letter-spacing: 0.3px;
    }

    .hdr-sub {
      font-size: 7.5pt;
      font-weight: 700;
      color: ${textMuted};
    }

    .page-main-content {
      flex: 1;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .page-main-content.book-two-col {
      display: block;
      column-count: 2;
      column-gap: 5mm;
      column-rule: 1px solid ${borderMuted};
    }

    .page-main-content.book-two-col .mcq-card {
      display: inline-block;
      width: 100%;
      margin-bottom: 5px;
      padding-bottom: 5px;
    }

    /* MCQ CARD */
    .mcq-card {
      padding-bottom: 5px;
      border-bottom: 0.5px dashed ${borderMuted};
      break-inside: avoid;
      page-break-inside: avoid;
    }

    .mcq-card:last-child {
      border-bottom: none;
    }

    .q-text-block {
      font-size: ${meta.fontSize === "large" ? "9.8pt" : "8.6pt"};
      font-weight: 700;
      line-height: 1.38;
      color: ${textMain};
      margin-bottom: 3px;
      text-align: justify;
    }

    .q-num-inline {
      font-weight: 900;
      color: ${primaryAccent};
      margin-right: 4px;
      font-size: ${meta.fontSize === "large" ? "10pt" : "8.8pt"};
    }

    .q-text-inline {
      font-weight: 700;
    }

    .exam-tag {
      display: inline-block;
      font-size: 6.8pt;
      font-weight: 800;
      color: ${isBW ? "#000000" : "#5B32BF"};
      background: ${primarySoftBg};
      border: 0.5px solid ${borderMuted};
      padding: 0px 4px;
      border-radius: 3px;
      margin-left: 4px;
      vertical-align: middle;
      white-space: nowrap;
    }

    /* Assertion & Reason (कथन एवं कारण) */
    .book-ar-box {
      background: ${isBW ? "#FAFAFA" : "#FBF9FE"};
      border-left: 2.5px solid ${primaryAccent};
      border-radius: 3px;
      padding: 3px 6px;
      margin: 3px 0 4px 0;
      font-size: ${meta.fontSize === "large" ? "9pt" : "8pt"};
      line-height: 1.35;
    }

    .ar-line {
      margin-bottom: 2px;
    }

    .ar-line:last-child {
      margin-bottom: 0;
    }

    .ar-tag {
      font-weight: 900;
      color: ${primaryAccent};
    }

    .ar-content {
      color: ${textMain};
      font-weight: 600;
    }

    /* Multiple Statements (कथन 1, 2, 3) */
    .book-statements-box {
      margin: 3px 0 4px 2px;
      font-size: ${meta.fontSize === "large" ? "9pt" : "8pt"};
      line-height: 1.35;
    }

    .stmt-item {
      margin-bottom: 2px;
    }

    .stmt-tag {
      font-weight: 800;
      color: ${primaryAccent};
    }

    .stmt-content {
      color: ${textMain};
      font-weight: 600;
    }

    /* Match the Following Table (सुमेलित कीजिए) */
    .book-match-container {
      margin: 3px 0 4px 0;
    }

    .book-match-table {
      width: 100%;
      border-collapse: collapse;
      font-size: ${meta.fontSize === "large" ? "8.8pt" : "7.8pt"};
      line-height: 1.3;
    }

    .book-match-table th, .book-match-table td {
      border: 0.5px solid ${borderMuted};
      padding: 2px 5px;
      vertical-align: middle;
    }

    .book-match-table th {
      background: ${primarySoftBg};
      color: ${primaryAccent};
      font-weight: 800;
      text-align: center;
      font-size: 7.5pt;
    }

    .book-match-table td {
      color: ${textMain};
      font-weight: 600;
    }

    .book-instruction {
      font-size: 7.8pt;
      font-weight: 800;
      color: ${primaryAccent};
      margin: 3px 0 2px 0;
    }

    .q-diagram-wrap {
      text-align: center;
      margin: 4px 0;
    }

    .q-diagram-img {
      max-width: 100%;
      max-height: 140px;
      object-fit: contain;
    }

    /* Multi-Tier Options Layout */
    .opts-inline-four {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 2px 4px;
      margin: 3px 0 2px 0;
      font-size: ${meta.fontSize === "large" ? "9pt" : "8pt"};
    }

    .opts-two-by-two {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 2px 6px;
      margin: 3px 0 2px 0;
      font-size: ${meta.fontSize === "large" ? "9pt" : "8pt"};
    }

    .opts-vertical {
      display: flex;
      flex-direction: column;
      gap: 2px;
      margin: 3px 0 2px 0;
      font-size: ${meta.fontSize === "large" ? "9pt" : "8pt"};
    }

    .opt-item {
      display: flex;
      align-items: baseline;
      gap: 3px;
      color: ${textMain};
      font-weight: 600;
      line-height: 1.3;
    }

    .opt-lbl {
      font-weight: 800;
      color: ${primaryAccent};
      flex-shrink: 0;
      font-size: 0.95em;
    }

    .opt-txt {
      word-break: break-word;
    }

    .opt-item-correct {
      color: ${correctText};
      font-weight: 800;
    }

    .opt-item-correct .opt-lbl {
      color: ${correctText};
    }

    /* Solutions Mode Book-Style Explanation Box */
    .book-exp-box {
      margin-top: 3px;
      padding: 3px 6px;
      background: ${primarySoftBg};
      border-left: 2px solid ${primaryAccent};
      border-radius: 3px;
      font-size: ${meta.fontSize === "large" ? "8.6pt" : "7.6pt"};
      line-height: 1.32;
      color: ${textMain};
    }

    .exp-ans-line {
      font-weight: 600;
    }

    .exp-ans-tag {
      font-weight: 900;
      color: ${correctText};
      margin-right: 3px;
    }

    .exp-fact-line {
      margin-top: 2px;
      color: ${isBW ? "#000000" : "#92400E"};
      font-weight: 600;
    }

    .fact-tag {
      font-weight: 800;
      color: ${isBW ? "#000000" : "#B45309"};
    }

    /* OMR Sheet */
    .omr-fields-card {
      background: ${primarySoftBg};
      border: 1px solid ${borderMuted};
      border-radius: 8px;
      padding: 10px 14px;
      margin-bottom: 12px;
      font-size: 9pt;
      font-weight: 600;
      color: ${primaryAccent};
    }

    .omr-field-row {
      display: flex;
      justify-content: space-between;
    }

    .omr-grid-two-col {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
    }

    .omr-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 8.5pt;
    }

    .omr-table th, .omr-table td {
      border: 1px solid ${borderMuted};
      padding: 4px 6px;
      text-align: center;
    }

    .omr-table th {
      background: ${primaryAccent};
      color: #FFFFFF;
      font-weight: 800;
    }

    .omr-qnum {
      font-weight: 800;
      color: ${primaryAccent};
      background: ${primarySoftBg};
      width: 45px;
    }

    .omr-circle {
      font-size: 11pt;
      color: ${textMuted};
    }

    /* Answer Key 5-Column Grid */
    .ans-key-grid-5 {
      display: grid;
      gap: 6px;
      margin-top: 6px;
    }

    .ans-key-col {
      flex: 1;
    }

    .ans-col-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 7.8pt;
    }

    .ans-col-table th, .ans-col-table td {
      border: 0.5px solid ${borderMuted};
      padding: 2px 4px;
      text-align: center;
    }

    .ans-col-table th {
      background: ${primaryAccent};
      color: #FFFFFF;
      font-weight: 800;
      font-size: 7.2pt;
    }

    .ans-col-table .ans-qnum {
      background: ${primarySoftBg};
      font-weight: 700;
      color: ${textMain};
      width: 48%;
    }

    .ans-col-table .ans-val {
      font-weight: 900;
      color: ${primaryBright};
      width: 52%;
    }

    /* Footer */
    .paper-footer {
      border-top: 0.5px solid ${borderMuted};
      padding-top: 4px;
      margin-top: 6px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 7.5pt;
      font-weight: 700;
      color: ${textMuted};
    }

    .footer-page-num {
      font-weight: 900;
      color: ${primaryAccent};
      background: ${primarySoftBg};
      border: 0.5px solid ${borderMuted};
      padding: 1px 6px;
      border-radius: 999px;
    }
  </style>
</head>
<body>
  ${coverPageHTML}
  ${questionPagesHTML}
  ${omrPageHTML}
  ${answerKeyPageHTML}
</body>
</html>`;
}

// Backward-compatibility alias
export const generateQuizProPDFHTML = generateDisha2020PDFHTML;

/**
 * Interface for tracking PDF generation progress
 */
export interface PDFGenerationProgress {
  stage: "preparing" | "rendering" | "saving" | "done" | "error";
  percent: number;
  message: string;
}

/**
 * Directly generates and downloads a pristine PDF binary in browser by capturing each .a4-page block cleanly.
 */
export async function generateAndDownloadPDF(
  htmlContent: string,
  filename: string,
  onProgress?: (progress: PDFGenerationProgress) => void
): Promise<boolean> {
  onProgress?.({
    stage: "preparing",
    percent: 10,
    message: "Preparing document...",
  });

  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.left = "-9999px";
  iframe.style.top = "0";
  iframe.style.width = "794px";
  iframe.style.height = "1123px";
  iframe.style.border = "none";
  iframe.style.visibility = "hidden";
  document.body.appendChild(iframe);

  try {
    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!doc) throw new Error("Frame document not accessible");

    doc.open();
    doc.write(htmlContent);
    doc.close();

    onProgress?.({
      stage: "preparing",
      percent: 25,
      message: "Loading typography...",
    });

    // Wait for fonts & DOM readiness
    await new Promise((resolve) => setTimeout(resolve, 400));
    try {
      if (doc.fonts) {
        await doc.fonts.ready;
      }
    } catch (e) {}

    const pageElements = Array.from(doc.querySelectorAll(".a4-page"));
    
    if (pageElements.length === 0) {
      throw new Error("No .a4-page blocks found in generated document.");
    }

    onProgress?.({
      stage: "rendering",
      percent: 40,
      message: "Rendering high-resolution A4 pages...",
    });

    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
      compress: true,
    });

    const pdfWidth = 210;
    const pdfHeight = 297;

    for (let i = 0; i < pageElements.length; i++) {
      const pageEl = pageElements[i] as HTMLElement;

      const canvas = await html2canvas(pageEl, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: "#ffffff",
        windowWidth: 794,
      });

      const imgData = canvas.toDataURL("image/jpeg", 0.95);

      if (i > 0) {
        pdf.addPage("a4", "portrait");
      }

      pdf.addImage(
        imgData,
        "JPEG",
        0,
        0,
        pdfWidth,
        pdfHeight,
        undefined,
        "FAST"
      );

      const percent = Math.min(95, 40 + Math.floor(((i + 1) / pageElements.length) * 55));
      onProgress?.({
        stage: "saving",
        percent,
        message: `Assembling page ${i + 1} of ${pageElements.length}...`,
      });
    }

    const cleanFilename = filename.toLowerCase().endsWith(".pdf")
      ? filename
      : `${filename}.pdf`;

    pdf.save(cleanFilename);

    onProgress?.({
      stage: "done",
      percent: 100,
      message: "✓ PDF downloaded successfully!",
    });

    return true;
  } catch (error) {
    console.error("PDF generation error:", error);
    onProgress?.({
      stage: "error",
      percent: 100,
      message: "Error generating PDF. Please try 'Open in New Tab'.",
    });
    return false;
  } finally {
    try {
      if (iframe.parentNode) {
        iframe.parentNode.removeChild(iframe);
      }
    } catch (e) {}
  }
}

export function openQuestionBankInNewTab(htmlContent: string): void {
  const blob = new Blob([htmlContent], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const win = window.open(url, "_blank");
  if (!win) {
    const a = document.createElement("a");
    a.href = url;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
    }, 1500);
  }
}

export function printQuestionBankHTML(htmlContent: string): void {
  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "none";
  iframe.style.zIndex = "-9999";
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (!doc) {
    openQuestionBankInNewTab(htmlContent);
    return;
  }

  doc.open();
  doc.write(htmlContent);
  doc.close();

  setTimeout(() => {
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } catch (e) {
      console.error("Print error, opening in new tab fallback:", e);
      openQuestionBankInNewTab(htmlContent);
    }
    setTimeout(() => {
      try {
        document.body.removeChild(iframe);
      } catch (e) {}
    }, 4000);
  }, 400);
}

export async function exportQuestionsToPDF(config: {
  title: string;
  subtitle?: string;
  questions: Question[];
  includeExplanations?: boolean;
  filterType?: "all" | "wrong" | "bookmarked";
}): Promise<void> {
  const safeQuestions = (config.questions || []).filter(Boolean).map((q: any, idx: number) => ({
    ...q,
    id: q.id || `q_${idx + 1}`,
    text: q.text || q.question || `Question ${idx + 1}`,
    options: Array.isArray(q.options) && q.options.length > 0
      ? q.options
      : ["(A) Option 1", "(B) Option 2", "(C) Option 3", "(D) Option 4"],
    correctIndex: typeof q.correctIndex === "number" ? q.correctIndex : 0,
    explanation: q.explanation || "",
  }));

  const html = generateDisha2020PDFHTML(safeQuestions, {
    subjectTitle: config.title || "Disha PYQ Practice Paper",
    chapterTitle: config.subtitle || "",
    filterType: config.filterType || "all",
    format: config.includeExplanations ? "detailed_solutions" : "question_paper",
    layout: "single",
    fontSize: "normal",
    includeCoverPage: true,
    showPageNumbers: true,
    showHeaderFooter: true,
    includeTestInstructions: true,
    includeSubjectTopicNames: true,
    includeBlankAnswerSheet: false,
    customTitle: config.title,
  });

  await generateAndDownloadPDF(
    html,
    `DISHA_20_20_${(config.title || "Paper").replace(/[^a-zA-Z0-9_-]/g, "_")}_Paper.pdf`
  );
}

export function downloadQuestionBankHTML(htmlContent: string, filename: string): void {
  const blob = new Blob([htmlContent], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".html") ? filename : `${filename}.html`;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 300);
}

function escapeHTML(str: string): string {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
