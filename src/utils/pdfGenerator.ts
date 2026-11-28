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
export function renderParsedQuestionHTML(rawText: string, fontSize: "normal" | "large" = "normal", question?: Question): string {
  let statements: { label: string; body: string }[] = [];
  let assertion: { label: string; body: string } | undefined = undefined;
  let reason: { label: string; body: string } | undefined = undefined;
  let instruction: string | undefined = undefined;
  let matchPairs: { left: string; right: string }[] = [];
  let sequenceItems: string[] = [];
  let tableData: { headers: string[]; rows: string[][] } | undefined = undefined;
  let intro = formatMathAndChemistryLatex(rawText);

  if (question) {
    const q = question as any;
    if (Array.isArray(q.statements) && q.statements.length > 0) {
      statements = q.statements.map((s: any, idx: number) => {
        if (typeof s === "string") return { label: `${idx + 1}.`, body: s };
        return { label: s.label || `${idx + 1}.`, body: s.body || s.text || String(s) };
      });
    }
    if (q.assertion) {
      assertion = typeof q.assertion === "string" ? { label: "Assertion (A)", body: q.assertion } : q.assertion;
    }
    if (q.reason) {
      reason = typeof q.reason === "string" ? { label: "Reason (R)", body: q.reason } : q.reason;
    }
    if (q.instruction) {
      instruction = q.instruction;
    }
    if (q.sequenceItems && Array.isArray(q.sequenceItems) && q.sequenceItems.length > 0) {
      sequenceItems = q.sequenceItems.map((item: any) => typeof item === "string" ? item : (item?.text || String(item)));
    }
    if (q.tableData && q.tableData.headers) {
      tableData = q.tableData;
    }
    if (q.matchData || (q.listI && q.listII)) {
      const list1 = q.matchData?.listI || q.listI || [];
      const list2 = q.matchData?.listII || q.listII || [];
      const maxL = Math.max(list1.length, list2.length);
      for (let k = 0; k < maxL; k++) {
        matchPairs.push({ left: list1[k] || "", right: list2[k] || "" });
      }
    }
  }

  // Fallback to text parsing if structured attributes weren't present
  if (statements.length === 0 && !assertion && matchPairs.length === 0 && sequenceItems.length === 0 && !tableData) {
    const parsed = parseQuestionContent(rawText);
    intro = parsed.intro || rawText;
    statements = parsed.statements || [];
    assertion = parsed.assertion;
    reason = parsed.reason;
    instruction = parsed.instruction;
    matchPairs = parsed.matchPairs || [];
    sequenceItems = (parsed.sequenceItems || []).map((item: any) => typeof item === "string" ? item : (item?.text || String(item)));
    tableData = parsed.tableData;
  }

  let html = `<div class="q-parsed-wrapper">`;

  // Question Prompt / Intro
  if (intro) {
    html += `<div class="q-intro-text">${escapeHTML(intro)}</div>`;
  }

  // Assertion & Reason
  if (assertion || reason) {
    html += `<div class="q-assertion-reason-container">`;
    if (assertion) {
      html += `<div class="q-assertion-item"><strong>${escapeHTML(assertion.label || "Assertion (A)")}:</strong> <span>${escapeHTML(assertion.body)}</span></div>`;
    }
    if (reason) {
      html += `<div class="q-reason-item"><strong>${escapeHTML(reason.label || "Reason (R)")}:</strong> <span>${escapeHTML(reason.body)}</span></div>`;
    }
    html += `</div>`;
  }

  // Multiple Statements
  if (statements.length > 0) {
    html += `<div class="q-multiple-statements-container">`;
    statements.forEach((stmt) => {
      html += `<div class="q-statement-item"><span class="stmt-lbl">${escapeHTML(stmt.label)}</span><span class="stmt-body">${escapeHTML(stmt.body)}</span></div>`;
    });
    html += `</div>`;
  }

  // Question Instruction Prompt
  if (instruction) {
    html += `<div class="q-statement-instruction">${escapeHTML(instruction)}</div>`;
  }

  // Sequence Items
  if (sequenceItems.length > 0) {
    html += `<div class="q-sequence-container">`;
    sequenceItems.forEach((seq, idx) => {
      html += `<div class="q-seq-item"><span class="seq-lbl">${idx + 1}.</span><span>${escapeHTML(seq)}</span></div>`;
    });
    html += `</div>`;
  }

  // Match the Following
  if (matchPairs.length > 0) {
    html += `
      <div class="q-match-following-container">
        <table class="academic-match-table">
          <thead>
            <tr>
              <th>LIST-I</th>
              <th>LIST-II</th>
            </tr>
          </thead>
          <tbody>
    `;
    matchPairs.forEach((pair) => {
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
  if (tableData && Array.isArray(tableData.headers) && tableData.headers.length > 0) {
    const safeRows = Array.isArray(tableData.rows) ? tableData.rows : [];
    html += `
      <div class="q-table-container">
        <table class="academic-match-table">
          <thead>
            <tr>
              ${tableData.headers.map((h) => `<th>${escapeHTML(String(h ?? ""))}</th>`).join("")}
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

  html += `</div>`;
  return html;
}

/**
 * Accurately calculates height requirements for a single question content block in pixels.
 * Accounts for font scale, text line wrapping, option layouts, statements, assertion/reasons,
 * match tables, sequence items, and detailed explanation boxes.
 */
function estimateQuestionHeight(
  q: Question,
  isSolutionsMode: boolean,
  isCompact: boolean,
  fontSize: "normal" | "large" = "normal"
): number {
  const fontMultiplier = fontSize === "large" ? 1.18 : 1.0;
  const charsPerLine = fontSize === "large" ? 50 : 60;
  const lineHeightPx = Math.round(20 * fontMultiplier);

  let totalHeight = Math.round(35 * fontMultiplier); // Q Header + Q Number badge

  // 1. Question Text
  const text = q.text || "";
  const lines = text.split("\n").reduce((acc, line) => {
    return acc + Math.max(1, Math.ceil(line.length / charsPerLine));
  }, 0);
  totalHeight += lines * lineHeightPx;

  // 2. Structured Sub-elements
  const qAny = q as any;
  if (Array.isArray(qAny.statements) && qAny.statements.length > 0) {
    totalHeight += qAny.statements.length * Math.round(24 * fontMultiplier);
  }
  if (qAny.assertion || qAny.reason) {
    totalHeight += Math.round(48 * fontMultiplier);
  }
  if (Array.isArray(qAny.sequenceItems) && qAny.sequenceItems.length > 0) {
    totalHeight += qAny.sequenceItems.length * Math.round(22 * fontMultiplier);
  }
  if (qAny.matchData || (qAny.listI && qAny.listII)) {
    const maxL = Math.max((qAny.listI || []).length, (qAny.listII || []).length);
    totalHeight += 32 + maxL * Math.round(26 * fontMultiplier);
  }
  if (qAny.tableData && qAny.tableData.headers) {
    const rowCount = (qAny.tableData.rows || []).length;
    totalHeight += 32 + rowCount * Math.round(26 * fontMultiplier);
  }

  // 3. Options Grid
  if (q.options && q.options.length > 0) {
    const isShortOptions = q.options.every((opt) => (opt || "").length <= 25);
    if (isCompact && isShortOptions) {
      // 2x2 grid
      totalHeight += Math.round(52 * fontMultiplier);
    } else {
      // Vertical list
      q.options.forEach((opt) => {
        const optText = opt || "";
        const optLines = Math.max(1, Math.ceil(optText.length / (charsPerLine - 5)));
        totalHeight += Math.round(20 * fontMultiplier) + (optLines - 1) * Math.round(16 * fontMultiplier) + 6;
      });
    }
  }

  // 4. Explanation & Facts in Solutions Mode
  if (isSolutionsMode) {
    const expText = (q.explanation || "").trim();
    if (expText.length > 0) {
      const expLines = expText.split("\n").reduce((acc, line) => {
        return acc + Math.max(1, Math.ceil(line.length / (charsPerLine - 5)));
      }, 0);
      totalHeight += 32 + expLines * Math.round(18 * fontMultiplier); // Header + text + box padding
    } else {
      totalHeight += Math.round(32 * fontMultiplier); // Fallback message box
    }

    if (q.importantFact) {
      const factLines = Math.ceil((q.importantFact || "").length / (charsPerLine - 5));
      totalHeight += 24 + factLines * Math.round(16 * fontMultiplier);
    }
  }

  // Card padding and margin
  totalHeight += Math.round(16 * fontMultiplier);

  return Math.max(isCompact ? 120 : 150, Math.round(totalHeight));
}

/**
 * Intelligent Page Chunking:
 * Dynamically groups question blocks into A4 page containers so that:
 * 1. Complete questions (header + options + explanation) fit inside the page budget.
 * 2. Page breaks are inserted ONLY between questions (or major sections).
 * 3. Prevents orphaned question headers or cut-off explanation boxes at the bottom of pages.
 */
function chunkQuestionsIntoPages(
  questions: Question[],
  isSolutionsMode: boolean,
  isCompact: boolean,
  fontSize: "normal" | "large" = "normal"
): Question[][] {
  // 2-column book mode holds ~2x questions per A4 sheet
  const PAGE_HEIGHT_BUDGET = isCompact
    ? fontSize === "large"
      ? 1320
      : 1560
    : fontSize === "large"
    ? 800
    : 900;
  const pages: Question[][] = [];
  let currentChunk: Question[] = [];
  let currentHeight = 0;

  for (const q of questions) {
    const qHeight = estimateQuestionHeight(q, isSolutionsMode, isCompact, fontSize);

    // If adding this question exceeds current page budget, push current chunk and start a fresh page
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
  const answerKeyPagesCount = hasAnswerKey ? Math.ceil(questions.length / 50) : 0;
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
    questionPageBuckets.forEach((bucket) => {
      const pageNumberStr = `Page ${currentOverallPageNum} of ${totalDocumentPages}`;
      currentOverallPageNum++;

      const questionsMarkup = bucket
        .map((q) => {
          currentQuestionIndex++;
          const qNum = currentQuestionIndex;

          // Options Markup
          const safeOptions = Array.isArray(q.options) && q.options.length > 0
            ? q.options
            : (q && typeof (q as any).options === "string"
                ? [(q as any).options]
                : ["Option A", "Option B", "Option C", "Option D"]);

          const optionsMarkup = safeOptions
            .map((opt, oIdx) => {
              const isCorrect = oIdx === q.correctIndex;
              const letter = optionLetters[oIdx] || "A";

              if (isSolutionsMode) {
                return `
                  <div class="opt-row ${isCorrect ? "opt-row-correct" : "opt-row-default"}">
                    <span class="opt-circle-badge ${isCorrect ? "badge-green" : "badge-blue"}">${letter}</span>
                    <span class="opt-text ${isCorrect ? "font-bold" : ""}">${escapeHTML(opt || "")}</span>
                    ${isCorrect ? '<span class="correct-badge">✓ Correct</span>' : ""}
                  </div>
                `;
              }

              // Question Paper Mode (A, B, C, D badges, NO correct answer badges)
              return `
                <div class="opt-row opt-row-default">
                  <span class="opt-circle-badge badge-blue">${letter}</span>
                  <span class="opt-text">${escapeHTML(opt || "")}</span>
                </div>
              `;
            })
            .join("");

          // Explanation Box (Solutions mode only)
          let explanationMarkup = "";
          if (isSolutionsMode) {
            const expText = q.explanation && q.explanation.trim().length > 0
              ? q.explanation
              : "Detailed explanation is not available for this question.";

            explanationMarkup = `
              <div class="explanation-box">
                <div class="exp-header">
                  <span class="exp-title">💡 Detailed Explanation:</span>
                </div>
                <div class="exp-content">${escapeHTML(expText)}</div>
                ${
                  q.importantFact
                    ? `
                    <div class="fact-box">
                      <span class="fact-badge">★ Key Facts:</span>
                      <span class="fact-text">${escapeHTML(q.importantFact)}</span>
                    </div>
                  `
                    : ""
                }
              </div>
            `;
          }

          const allShortOpts = safeOptions.every((o) => String(o || "").trim().length <= 22);
          return `
            <article class="mcq-card">
              <div class="q-header">
                <span class="q-number">Q.${qNum}.</span>
              </div>
              ${renderParsedQuestionHTML(q.text, meta.fontSize, q)}
              <div class="options-grid ${allShortOpts ? "opts-two-col" : ""} ${isCompact ? "compact-grid" : ""}">
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

  // 4. ANSWER KEY PAGE
  let answerKeyPageHTML = "";
  if (hasAnswerKey) {
    const pageNumberStr = `Page ${currentOverallPageNum} of ${totalDocumentPages}`;
    currentOverallPageNum++;

    const halfCount = Math.ceil(questions.length / 2);
    let leftKeyRows = "";
    let rightKeyRows = "";

    for (let i = 0; i < halfCount; i++) {
      const qNumLeft = i + 1;
      const qLeft = questions[i];
      const ansLeft = qLeft && typeof qLeft.correctIndex === "number" ? optionLetters[qLeft.correctIndex] || "A" : "A";
      leftKeyRows += `
        <tr>
          <td class="ans-qnum">Q.${qNumLeft}</td>
          <td class="ans-letter">${ansLeft}</td>
        </tr>
      `;

      const qNumRight = i + 1 + halfCount;
      if (qNumRight <= questions.length) {
        const qRight = questions[qNumRight - 1];
        const ansRight = qRight && typeof qRight.correctIndex === "number" ? optionLetters[qRight.correctIndex] || "A" : "A";
        rightKeyRows += `
          <tr>
            <td class="ans-qnum">Q.${qNumRight}</td>
            <td class="ans-letter">${ansRight}</td>
          </tr>
        `;
      }
    }

    answerKeyPageHTML = `
      <section class="a4-page answer-key-page">
        <header class="paper-top-header">
          <div class="logo-wrapper">
            <svg viewBox="0 0 200 200" class="header-logo-svg">
              <circle cx="100" cy="95" r="52" fill="#F4F1FA" stroke="#7045D8" stroke-width="6" />
              <rect x="48" y="80" width="104" height="42" rx="12" fill="#7045D8" />
            </svg>
            <div class="header-brand-name">DISHA <span style="color:#7045D8;">PYQ</span></div>
          </div>
          <div class="header-right-title">
            <div class="hdr-main-title">OFFICIAL ANSWER KEY</div>
            <div class="hdr-sub">${escapeHTML(subjectHeaderName)} • ${escapeHTML(topicOrSubName)}</div>
          </div>
        </header>

        <main class="page-main-content">
          <div class="ans-key-two-col">
            <table class="ans-key-table">
              <thead>
                <tr><th>Q.No.</th><th>Correct Answer</th></tr>
              </thead>
              <tbody>${leftKeyRows}</tbody>
            </table>

            <table class="ans-key-table">
              <thead>
                <tr><th>Q.No.</th><th>Correct Answer</th></tr>
              </thead>
              <tbody>${rightKeyRows}</tbody>
            </table>
          </div>
        </main>

        <footer class="paper-footer">
          <span>Disha PYQ • Verified Answer Key</span>
          <span class="footer-page-num">${pageNumberStr}</span>
        </footer>
      </section>
    `;
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
      font-size: ${meta.fontSize === "large" ? "10.2pt" : "8.8pt"};
      line-height: 1.42;
      color: ${textMain};
      background-color: ${pagePreviewBg};
      padding: 20px 0;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    .a4-page {
      width: 190mm;
      height: 268mm;
      max-height: 268mm;
      box-sizing: border-box;
      background: #FFFFFF;
      margin: 0 auto 20px auto;
      padding: 8mm 10mm 8mm 10mm;
      position: relative;
      overflow: hidden;
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
        padding: 9mm 10mm;
        border: none;
        box-shadow: none;
        page-break-after: always;
        break-after: page;
      }
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
      border-bottom: 2px solid ${primaryAccent};
      padding-bottom: 8px;
      margin-bottom: 12px;
    }

    .logo-wrapper {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .header-logo-svg {
      width: 28px;
      height: 28px;
    }

    .header-brand-name {
      font-size: 15pt;
      font-weight: 900;
      color: ${primaryAccent};
    }

    .header-right-title {
      text-align: right;
    }

    .hdr-main-title {
      font-size: 10pt;
      font-weight: 900;
      color: ${primaryAccent};
      letter-spacing: 0.5px;
    }

    .hdr-sub {
      font-size: 8pt;
      font-weight: 700;
      color: ${textMuted};
    }

    .page-main-content {
      flex: 1;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .page-main-content.book-two-col {
      display: block;
      column-count: 2;
      column-gap: 6mm;
      column-rule: 1px solid ${borderMuted};
    }

    .page-main-content.book-two-col .mcq-card {
      display: inline-block;
      width: 100%;
      margin-bottom: 6px;
      padding-bottom: 6px;
    }

    /* MCQ CARD */
    .mcq-card {
      padding-bottom: 6px;
      border-bottom: 1px dashed ${borderMuted};
      break-inside: avoid;
      page-break-inside: avoid;
    }

    .mcq-card:last-child {
      border-bottom: none;
    }

    .q-header {
      margin-bottom: 4px;
      break-after: avoid;
      page-break-after: avoid;
    }

    .q-number {
      font-size: 9.2pt;
      font-weight: 900;
      color: ${primaryAccent};
    }

    .q-intro-text {
      font-weight: 700;
      color: ${textMain};
      margin-bottom: 6px;
    }

    .options-grid {
      display: flex;
      flex-direction: column;
      gap: 3px;
      margin-left: 4px;
      margin-top: 4px;
      break-inside: avoid;
      page-break-inside: avoid;
    }

    .options-grid.opts-two-col {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 3px 8px;
    }

    .opt-row {
      display: flex;
      align-items: flex-start;
      gap: 5px;
      font-size: 8.5pt;
      font-weight: 600;
      color: ${textMain};
    }

    .opt-circle-badge {
      width: 17px;
      height: 17px;
      border-radius: 50%;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: 7.5pt;
      font-weight: 900;
      flex-shrink: 0;
      margin-top: 1px;
    }

    .badge-blue {
      border: 1.5px solid ${primaryAccent};
      color: ${primaryAccent};
      background: #FFFFFF;
    }

    .badge-green {
      background: ${correctBadgeBg};
      color: #FFFFFF;
      border: 1.5px solid ${correctBadgeBg};
    }

    .badge-red {
      background: #EF4444;
      color: #FFFFFF;
      border: 1.5px solid #EF4444;
    }

    .opt-text {
      flex: 1;
    }

    .correct-badge {
      font-size: 7.5pt;
      font-weight: 800;
      color: ${correctText};
      background: ${correctLightBg};
      padding: 1px 6px;
      border-radius: 4px;
      margin-left: 6px;
    }

    .user-wrong-badge {
      font-size: 7.5pt;
      font-weight: 800;
      color: #B91C1C;
      background: #FEE2E2;
      padding: 1px 6px;
      border-radius: 4px;
      margin-left: 6px;
    }

    /* Explanation Box */
    .explanation-box {
      margin-top: 8px;
      padding: 8px 12px;
      background: ${primarySoftBg};
      border-left: 3px solid ${primaryAccent};
      border-radius: 4px;
      font-size: 8.5pt;
      color: ${textMain};
      break-inside: avoid;
      page-break-inside: avoid;
    }

    .exp-title {
      font-weight: 800;
      color: ${primaryAccent};
    }

    .fact-box {
      margin-top: 4px;
      padding: 4px 8px;
      background: #FFFBEB;
      border: 1px solid #FEF3C7;
      border-radius: 4px;
      font-size: 8pt;
      color: #92400E;
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

    /* Answer Key */
    .ans-key-two-col {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
      margin-top: 10px;
    }

    .ans-key-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 9pt;
    }

    .ans-key-table th, .ans-key-table td {
      border: 1px solid ${borderMuted};
      padding: 5px 10px;
      text-align: center;
    }

    .ans-key-table th {
      background: ${primaryAccent};
      color: #FFFFFF;
      font-weight: 900;
    }

    .ans-qnum {
      font-weight: 800;
      color: ${primaryAccent};
      background: ${primarySoftBg};
    }

    .ans-letter {
      font-weight: 900;
      color: ${primaryBright};
      font-size: 9.2pt;
    }

    /* Footer */
    .paper-footer {
      border-top: 1px solid #E8D9C0;
      padding-top: 6px;
      margin-top: 8px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 8pt;
      font-weight: 700;
      color: ${textMuted};
    }

    .footer-page-num {
      font-weight: 900;
      color: ${primaryAccent};
      background: ${primarySoftBg};
      border: 1px solid ${borderMuted};
      padding: 2px 8px;
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
