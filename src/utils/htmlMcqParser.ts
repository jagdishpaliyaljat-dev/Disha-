import { Question } from "../types";
import { generateQuestionHash } from "../lib/mcqImport/dedupe";
import { detectQuestionType } from "./questionsParser";

export interface ParsedHtmlMCQ {
  tempId: string;
  questionNumber: number;
  questionText: string;
  options: string[];
  correctIndex: number;
  explanation?: string;
  questionType?: string;
  subject?: string;
  chapter?: string;
  topic?: string;
  table?: {
    caption?: string;
    headers?: string[];
    rows?: string[][];
  };
  matchTable?: {
    leftTitle?: string;
    rightTitle?: string;
    rows?: Array<{ left: string; right: string }>;
  };
  exam?: string;
  year?: number | string;
  examHistory?: Array<{ examName: string; year?: number | string; verified?: boolean }>;
  questionClassification?: "pyq" | "practice" | "pyq_practice";
  isPYQ?: boolean;
  hash: string;
  isValid: boolean;
  isDuplicate: boolean;
  duplicateOf?: "database" | "batch";
  errors: string[];
  warnings: string[];
  rawHtmlSnippet?: string;
}

export interface HtmlImportSummary {
  totalDetected: number;
  validCount: number;
  duplicateCount: number;
  invalidCount: number;
  warningCount: number;
}

export interface HtmlParserOptions {
  defaultSubjectId?: string;
  defaultChapterId?: string;
  defaultTopicId?: string;
  existingHashes?: Set<string>;
}

export interface HtmlGlobalMetadata {
  subject?: string;
  chapter?: string;
  topic?: string;
  paperTitle?: string;
  totalQuestions?: number;
}

/**
 * Strips script tags, styles, iframes, and dangerous attributes from an HTML string safely.
 * Returns a sandboxed DOM Document via DOMParser (never evaluates scripts).
 */
export function sanitizeAndParseHtmlDocument(rawHtml: string): Document {
  // Pre-strip script/iframe/object tags with regex as first line of defense
  const sanitized = rawHtml
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, "")
    .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, "")
    .replace(/<embed\b[^<]*(?:(?!<\/embed>)<[^<]*)*<\/embed>/gi, "")
    .replace(/<applet\b[^<]*(?:(?!<\/applet>)<[^<]*)*<\/applet>/gi, "");

  let parser: DOMParser;
  if (typeof DOMParser !== "undefined") {
    parser = new DOMParser();
  } else if (typeof window !== "undefined" && typeof window.DOMParser !== "undefined") {
    parser = new window.DOMParser();
  } else {
    throw new Error("DOMParser is not available in the current runtime environment.");
  }

  const doc: Document = parser.parseFromString(sanitized, "text/html");

  // Deep sanitize inside document
  const dangerousElements = doc.querySelectorAll("script, style, iframe, object, embed, link[rel='import']");
  dangerousElements.forEach((el) => el.remove());

  // Remove dangerous on* attributes and javascript: URIs from all nodes
  const allElements = doc.querySelectorAll("*");
  allElements.forEach((el) => {
    for (let i = el.attributes.length - 1; i >= 0; i--) {
      const attr = el.attributes[i];
      const attrName = attr.name.toLowerCase();
      const attrVal = attr.value.trim().toLowerCase();
      if (attrName.startsWith("on") || attrVal.startsWith("javascript:") || attrVal.startsWith("data:text/html")) {
        el.removeAttribute(attr.name);
      }
    }
  });

  return doc;
}

/**
 * Cleans extracted text by collapsing excessive whitespace while preserving intentional line breaks.
 */
function cleanText(text: string): string {
  if (!text) return "";
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n\s*\n/g, "\n\n")
    .trim();
}

/**
 * Extracts inner text of an element while converting <br> and block elements to line breaks.
 */
function getElementFormattedText(el: Element | null): string {
  if (!el) return "";
  const clone = el.cloneNode(true) as Element;

  // Convert <br> tags to newline text nodes
  const doc = el.ownerDocument || document;
  clone.querySelectorAll("br").forEach((br) => {
    br.replaceWith(doc.createTextNode("\n"));
  });

  // Ensure block containers have line separations
  clone.querySelectorAll("p, div, li, tr").forEach((block) => {
    block.prepend(doc.createTextNode("\n"));
  });

  return cleanText(clone.textContent || "");
}

/**
 * Strips UI chrome, exam portal headers, status badges, timers, marks,
 * and question number prefixes from question stems.
 */
export function stripQuestionPrefix(text: string): string {
  if (!text) return "";
  let clean = text.trim();

  // 1. Remove exam platform headers like "Question 1 of 25", "Q1 / 50", "Q 1 of 100", "Q. 1", "Question 1:"
  clean = clean.replace(/^(?:Question|Q\.?)\s*\d+\s*(?:of|\/)\s*\d+[:.-]?\s*/i, "");

  // 2. Remove standard question number prefixes: "Q.1", "Q1.", "1.", "1)", "(1)", "Q-1:", "Q 1:"
  clean = clean.replace(/^(?:Q(?:uestion)?\s*[\d.]*[:.-]?\s*|\(?\d+\)?\s*[:.-]\s*|\(?\d+\)\s+)/i, "");

  // 3. Remove status tags/badges: "⚪ Not Attempted", "⚪ Unanswered", "Not Attempted", "Marked for Review", etc.
  clean = clean.replace(/^(?:⚪|✅|❌|⬜|⬛|[•\s])*\s*(?:Not Attempted|Attempted|Answered|Marked for Review|Unanswered|Not Answered|अनुत्तरित)\s*/i, "");

  // 4. Remove marks tags: "Marks: 2.0", "Marks : +2.00, -0.66", "+2.00 -0.66", "Max Marks: 2.0"
  clean = clean.replace(/^(?:Max\s*)?Marks\s*[:=-]?\s*[+\-]?\d*(?:\.\d+)?(?:\s*,\s*[+\-]?\d*(?:\.\d+)?)?\s*/i, "");

  // 5. Remove section tags: "Section: Hindi", "Section - General Studies"
  clean = clean.replace(/^Section\s*[:=-]?\s*[^\n]+\n/i, "");

  // 6. Secondary clean of remaining question numbering if exposed after removing tags
  clean = clean.replace(/^(?:Question|Q\.?)\s*\d+\s*(?:of|\/)\s*\d+[:.-]?\s*/i, "");
  clean = clean.replace(/^(?:Q(?:uestion)?\s*[\d.]*[:.-]?\s*|\(?\d+\)?\s*[:.-]\s*|\(?\d+\)\s+)/i, "");

  return clean.trim();
}

/**
 * Removes option letter prefixes like "(A)", "A.", "A)", "[A]", "(1)", "1.", "1)", "(E)", "E."
 * and trailing checkmarks/crosses while preserving match-following values like "A-1, B-2, C-3".
 */
export function stripOptionPrefix(text: string): string {
  if (!text) return "";
  let trimmed = text.trim();

  // Strip trailing checkmarks or crosses like "✓", "✔", "✕", "✖"
  trimmed = trimmed.replace(/\s*[✓✔✕✖]\s*$/, "").trim();

  // Don't strip if option is a match mapping like "A-1, B-2" or "A=1"
  if (/^[A-Ea-e]\s*[-=]\s*\d/.test(trimmed)) {
    return trimmed;
  }

  return trimmed
    .replace(/^(?:\(?[a-eA-E1-5]\)?\s*[:.]\s*|\(?[a-eA-E1-5]\)\s*|[\[\(][a-eA-E1-5][\]\)]\s*)/, "")
    .trim();
}

/**
 * Maps answer strings like "A", "Option 2", "उत्तर: C", "(b)", "5" to a 0-based index.
 * Supports up to 5 options (common in Rajasthan CET, RPSC, RSSB, BPSC).
 */
export function mapAnswerToIndex(rawAnswer: string, optionsCount = 5): number {
  if (!rawAnswer) return -1;
  const clean = rawAnswer.trim().toUpperCase();

  // Pattern A: Single letter A, B, C, D, E
  const letterMatch = clean.match(/\b([A-E])\b/);
  if (letterMatch) {
    const code = letterMatch[1].charCodeAt(0) - 65; // A=0, B=1, C=2, D=3, E=4
    if (code >= 0 && code < optionsCount) return code;
  }

  // Pattern B: Number 1, 2, 3, 4, 5
  const numMatch = clean.match(/\b([1-5])\b/);
  if (numMatch) {
    const idx = parseInt(numMatch[1], 10) - 1;
    if (idx >= 0 && idx < optionsCount) return idx;
  }

  // Pattern C: Hindi numeral १, २, ३, ४, ५
  if (clean.includes("१") || clean.includes("1")) return 0;
  if (clean.includes("२") || clean.includes("2")) return 1;
  if (clean.includes("३") || clean.includes("3")) return 2;
  if (clean.includes("४") || clean.includes("4")) return 3;
  if (clean.includes("५") || clean.includes("5")) return 4;

  return -1;
}

/**
 * Extracts options from a container node (like <ul>, <ol>, .options-grid, .options, .choices, or radio inputs).
 */
function extractOptionsFromElement(element: Element): { options: string[]; correctIndex: number } {
  const options: string[] = [];
  let correctIndex = -1;

  // 1. Check for radio buttons or checkboxes with labels
  const inputs = element.querySelectorAll("input[type='radio'], input[type='checkbox']");
  if (inputs.length >= 1) {
    inputs.forEach((input, idx) => {
      let optText = "";
      const label = input.closest("label") || element.querySelector(`label[for="${input.id}"]`);
      if (label) {
        optText = getElementFormattedText(label);
      } else if (input.parentElement) {
        optText = getElementFormattedText(input.parentElement);
      } else {
        optText = cleanText(input.getAttribute("value") || "");
      }
      optText = stripOptionPrefix(optText);
      if (optText) {
        options.push(optText);
        const isChecked =
          (input as HTMLInputElement).checked ||
          input.hasAttribute("checked") ||
          input.getAttribute("data-correct") === "true" ||
          input.classList.contains("correct");
        if (isChecked && correctIndex === -1) {
          correctIndex = idx;
        }
      }
    });
    if (options.length >= 1) {
      return { options, correctIndex };
    }
  }

  // 2. Check for child elements with option classes (.option, .solution-option, .choice, etc.)
  const optContainers = element.querySelectorAll(
    ".options-grid .option, .solution-options-grid .solution-option, .option, .solution-option, .choice, .answer-option, .opt, [class*='option-item'], [class*='choice-item']"
  );
  if (optContainers.length >= 1) {
    optContainers.forEach((el, idx) => {
      const isCorrect =
        el.classList.contains("correct") ||
        el.classList.contains("correct-answer") ||
        el.classList.contains("active") ||
        el.getAttribute("data-correct") === "true" ||
        el.textContent?.includes("✓") ||
        el.textContent?.includes("✔");
      if (isCorrect && correctIndex === -1) {
        correctIndex = idx;
      }

      // Check if text is inside a dedicated text container (.opt-text, .choice-text)
      const textEl = el.querySelector(".opt-text, .choice-text, .text, span:not(.opt-marker)");
      let optText = "";
      if (textEl) {
        optText = cleanText(textEl.textContent || "");
      } else {
        // Clone and strip marker badge
        const clone = el.cloneNode(true) as Element;
        clone.querySelectorAll(".opt-marker, .marker, .badge").forEach((m) => m.remove());
        optText = cleanText(clone.textContent || "");
      }

      optText = stripOptionPrefix(optText);
      if (optText) {
        options.push(optText);
      }
    });
    if (options.length >= 1) {
      return { options, correctIndex };
    }
  }

  // 3. Check for <li> items in <ul> or <ol>
  const listItems = element.querySelectorAll("li");
  if (listItems.length >= 1) {
    listItems.forEach((li, idx) => {
      const isCorrect =
        li.classList.contains("correct") ||
        li.classList.contains("correct-answer") ||
        li.classList.contains("right") ||
        li.classList.contains("answer") ||
        li.getAttribute("data-correct") === "true";
      if (isCorrect && correctIndex === -1) {
        correctIndex = idx;
      }
      options.push(stripOptionPrefix(cleanText(li.textContent || "")));
    });
    if (options.length >= 1) {
      return { options, correctIndex };
    }
  }

  return { options, correctIndex };
}

/**
 * Extracts table data from a <table> element inside an MCQ.
 */
function extractTableFromElement(tableEl: HTMLTableElement | null): { caption?: string; headers?: string[]; rows?: string[][] } | undefined {
  if (!tableEl) return undefined;
  const caption = tableEl.querySelector("caption")?.textContent?.trim() || undefined;
  const headers: string[] = [];
  const rows: string[][] = [];

  const thElements = tableEl.querySelectorAll("thead th, tr th");
  thElements.forEach((th) => {
    headers.push(cleanText(th.textContent || ""));
  });

  const trElements = tableEl.querySelectorAll("tbody tr, tr");
  trElements.forEach((tr) => {
    // Skip if all children are <th>
    if (tr.querySelectorAll("td").length === 0) return;
    const rowCells: string[] = [];
    tr.querySelectorAll("td").forEach((td) => {
      rowCells.push(cleanText(td.textContent || ""));
    });
    if (rowCells.length > 0) {
      rows.push(rowCells);
    }
  });

  if (rows.length === 0 && headers.length === 0) return undefined;
  return { caption, headers: headers.length > 0 ? headers : undefined, rows };
}

/**
 * Extracts metadata (Subject, Chapter, Topic, Paper Title) from HTML <meta> tags,
 * page titles, intro banners, and test platform headers.
 */
export function extractGlobalMetadata(doc: Document): HtmlGlobalMetadata {
  let subject: string | undefined;
  let chapter: string | undefined;
  let topic: string | undefined;
  let paperTitle: string | undefined;

  // 1. Meta tags
  const metaSub = doc.querySelector("meta[name='subject'], meta[name='quiz:subject'], meta[property='subject']");
  if (metaSub) subject = metaSub.getAttribute("content")?.trim();

  const metaChap = doc.querySelector("meta[name='chapter'], meta[name='quiz:chapter'], meta[property='chapter']");
  if (metaChap) chapter = metaChap.getAttribute("content")?.trim();

  const metaTop = doc.querySelector("meta[name='topic'], meta[name='quiz:topic'], meta[property='topic']");
  if (metaTop) topic = metaTop.getAttribute("content")?.trim();

  const metaTitle = doc.querySelector("meta[name='title'], meta[name='quiz:title'], meta[property='og:title']");
  if (metaTitle) paperTitle = metaTitle.getAttribute("content")?.trim();

  // 2. Exam portal intro elements (e.g. .intro-title, .intro-date, .intro-section-name)
  const introTitleEl = doc.querySelector(".intro-title, .test-title, .paper-title, .exam-title");
  const introDateEl = doc.querySelector(".intro-date, .test-date, .paper-date");
  if (introTitleEl) {
    const mainTitle = cleanText(introTitleEl.textContent || "");
    const subTitle = introDateEl ? cleanText(introDateEl.textContent || "") : "";
    if (mainTitle && subTitle) {
      paperTitle = `${mainTitle} - ${subTitle}`;
    } else if (mainTitle) {
      paperTitle = mainTitle;
    }
  }

  // 3. Fallback to doc.title
  if (!paperTitle && doc.title) {
    paperTitle = cleanText(doc.title)
      .replace(/^[\s|•-]+|[\s|•-]+$/g, "")
      .trim();
  }

  // 4. Section name as Subject if not found
  if (!subject) {
    const secEl = doc.querySelector(".intro-section-name, .section-name, .subject-title");
    if (secEl) {
      subject = cleanText(secEl.textContent || "");
    }
  }

  const questionPages = doc.querySelectorAll(".question-page, .solution-page");
  const totalQuestions = questionPages.length > 0 ? questionPages.length : undefined;

  return { subject, chapter, topic, paperTitle, totalQuestions };
}

/**
 * Strategy 1: Container-based extraction.
 * Handles online test platforms (.question-page / .solution-page) and classic MCQ cards.
 */
function parseByContainerElements(doc: Document): Array<{
  questionText: string;
  options: string[];
  correctIndex: number;
  explanation?: string;
  table?: any;
  rawHtmlSnippet?: string;
}> {
  const results: Array<{
    questionText: string;
    options: string[];
    correctIndex: number;
    explanation?: string;
    table?: any;
    rawHtmlSnippet?: string;
  }> = [];

  // 1A. Check for dedicated online test pages (.question-page)
  const questionPages = doc.querySelectorAll(".question-page");
  if (questionPages.length > 0) {
    questionPages.forEach((qp, idx) => {
      const qNum = idx + 1;

      // Question Stem
      const stemEl = qp.querySelector(".question-text, .q-text, .stem");
      let stemText = "";
      if (stemEl) {
        stemText = getElementFormattedText(stemEl);
      } else {
        // Clone question page and strip headers, options, buttons
        const clone = qp.cloneNode(true) as Element;
        clone.querySelectorAll(".question-header, .q-status, .q-num, .options-grid, button, nav").forEach((el) => el.remove());
        stemText = getElementFormattedText(clone);
      }
      stemText = stripQuestionPrefix(stemText);

      // Options
      const { options, correctIndex: detectedFromOptions } = extractOptionsFromElement(qp);
      let correctIndex = detectedFromOptions;

      // Correct answer from data-correct attribute on .question-page (1-based index)
      const dataCorrect = qp.getAttribute("data-correct");
      if (dataCorrect) {
        const parsed = parseInt(dataCorrect, 10) - 1;
        if (!isNaN(parsed) && parsed >= 0 && parsed < (options.length || 5)) {
          correctIndex = parsed;
        }
      }

      // Check corresponding solution page for rich explanations and verification
      let explanation: string | undefined;
      const solPage =
        doc.querySelector(`#sol${qNum}`) ||
        doc.querySelector(`.solution-page[id="sol${qNum}"]`) ||
        doc.querySelector(`.solution-page[data-q="${qNum}"]`) ||
        doc.querySelectorAll(".solution-page")[idx];

      if (solPage) {
        // Solution options might highlight correct answer
        const correctSolOpt = solPage.querySelector(".solution-option.correct-answer");
        if (correctSolOpt) {
          const allSolOpts = Array.from(solPage.querySelectorAll(".solution-option"));
          const solIdx = allSolOpts.indexOf(correctSolOpt);
          if (solIdx !== -1) {
            correctIndex = solIdx;
          }
        }

        // Explanation text
        const expEl = solPage.querySelector(".explanation-text, .explanation-content, .explanation-box, .explanation");
        if (expEl) {
          const rawExp = getElementFormattedText(expEl);
          explanation = rawExp
            .replace(/^(?:💡\s*)*(?:Explanation|Solution|व्याख्या|हल)\s*[:=-]?\s*/i, "")
            .trim();
        }
      }

      // If explanation is inside questionPage itself
      if (!explanation) {
        const expEl = qp.querySelector(".explanation, .solution, .exp");
        if (expEl) {
          explanation = getElementFormattedText(expEl)
            .replace(/^(?:💡\s*)*(?:Explanation|Solution|व्याख्या|हल)\s*[:=-]?\s*/i, "")
            .trim();
        }
      }

      // Embedded table
      const tableEl = qp.querySelector("table");
      const table = extractTableFromElement(tableEl);

      if (stemText || options.length > 0) {
        results.push({
          questionText: stemText,
          options,
          correctIndex: correctIndex !== -1 ? correctIndex : 0,
          explanation,
          table,
          rawHtmlSnippet: qp.outerHTML.slice(0, 400),
        });
      }
    });

    if (results.length > 0) {
      return results;
    }
  }

  // 1B. Check if document only has .solution-page elements (when only solutions were saved)
  const standaloneSolutionPages = doc.querySelectorAll(".solution-page");
  if (questionPages.length === 0 && standaloneSolutionPages.length > 0) {
    standaloneSolutionPages.forEach((sp) => {
      const stemEl = sp.querySelector(".solution-question-text, .question-text, .q-text");
      let stemText = stemEl ? getElementFormattedText(stemEl) : "";
      if (!stemText) {
        const clone = sp.cloneNode(true) as Element;
        clone.querySelectorAll(".solution-question-header, .solution-options-grid, .explanation-box, button").forEach((el) => el.remove());
        stemText = getElementFormattedText(clone);
      }
      stemText = stripQuestionPrefix(stemText);

      const { options, correctIndex: detectedFromOptions } = extractOptionsFromElement(sp);
      let correctIndex = detectedFromOptions;

      const dataCorrect = sp.getAttribute("data-correct");
      if (dataCorrect && correctIndex === -1) {
        const parsed = parseInt(dataCorrect, 10) - 1;
        if (!isNaN(parsed) && parsed >= 0) correctIndex = parsed;
      }

      let explanation: string | undefined;
      const expEl = sp.querySelector(".explanation-text, .explanation-content, .explanation-box");
      if (expEl) {
        explanation = getElementFormattedText(expEl)
          .replace(/^(?:💡\s*)*(?:Explanation|Solution|व्याख्या|हल)\s*[:=-]?\s*/i, "")
          .trim();
      }

      const table = extractTableFromElement(sp.querySelector("table"));

      if (stemText || options.length > 0) {
        results.push({
          questionText: stemText,
          options,
          correctIndex: correctIndex !== -1 ? correctIndex : 0,
          explanation,
          table,
          rawHtmlSnippet: sp.outerHTML.slice(0, 400),
        });
      }
    });

    if (results.length > 0) {
      return results;
    }
  }

  // 1C. Generic MCQ Card Containers (.question, .mcq, .question-card, .question-block, etc.)
  const candidateContainers = doc.querySelectorAll(
    ".question, .mcq, .question-block, .q-item, .question-card, .question-container, .quiz-question, fieldset.question, article.question"
  );

  candidateContainers.forEach((container) => {
    // 1. Question stem
    const stemEl = container.querySelector(
      ".question-text, .q-text, .stem, .question-title, .title, legend, h3, h4, h5, p.question"
    );
    let questionText = "";
    if (stemEl) {
      questionText = getElementFormattedText(stemEl);
    } else {
      // Clone container and remove chrome, headers, options, buttons
      const clone = container.cloneNode(true) as Element;
      clone.querySelectorAll(
        ".question-header, .solution-question-header, .q-num, .q-status, .timer-container, .timer, button, nav, header, footer, .options-grid, .options, .choices, .explanation, .solution, .explanation-box"
      ).forEach((el) => el.remove());
      const firstP = clone.querySelector("p");
      if (firstP) {
        questionText = getElementFormattedText(firstP);
      } else {
        questionText = getElementFormattedText(clone);
      }
    }
    questionText = stripQuestionPrefix(questionText);

    // 2. Options
    const { options, correctIndex: detectedCorrect } = extractOptionsFromElement(container);
    let correctIndex = detectedCorrect;

    // 3. Answer block (e.g. .answer, .correct-answer, or text "Answer: C")
    const ansEl = container.querySelector(".answer, .correct-answer, .solution-answer, .ans");
    if (ansEl && correctIndex === -1) {
      correctIndex = mapAnswerToIndex(ansEl.textContent || "", options.length || 5);
    } else if (correctIndex === -1) {
      const fullText = container.textContent || "";
      const ansMatch = fullText.match(/(?:Answer|Ans|Correct\s*Option|उत्तर|सही\s*विकल्प)\s*[:=-]?\s*([A-E1-5a-e\u0967-\u096B])/i);
      if (ansMatch) {
        correctIndex = mapAnswerToIndex(ansMatch[1], options.length || 5);
      }
    }

    // 4. Explanation
    let explanation: string | undefined;
    const expEl = container.querySelector(".explanation, .solution, .rationale, .exp, .answer-explanation, .explanation-text");
    if (expEl) {
      explanation = getElementFormattedText(expEl)
        .replace(/^(?:💡\s*)*(?:Explanation|Solution|व्याख्या|हल)\s*[:=-]?\s*/i, "")
        .trim();
    } else {
      const fullText = container.textContent || "";
      const expMatch = fullText.match(/(?:Explanation|Solution|व्याख्या|हल)\s*[:=-]?\s*([\s\S]+?)(?=$|\n\s*(?:Q\d|Question|$))/i);
      if (expMatch && expMatch[1]) {
        explanation = cleanText(expMatch[1]);
      }
    }

    // 5. Embedded Table
    const tableEl = container.querySelector("table");
    const table = extractTableFromElement(tableEl);

    if (questionText || options.length > 0) {
      results.push({
        questionText: questionText || "",
        options,
        correctIndex: correctIndex !== -1 ? correctIndex : 0,
        explanation,
        table,
        rawHtmlSnippet: container.outerHTML.slice(0, 400),
      });
    }
  });

  return results;
}

/**
 * Strategy 2: Table-based extraction (where questions are presented in rows of a table)
 */
function parseByTableRows(doc: Document): Array<{
  questionText: string;
  options: string[];
  correctIndex: number;
  explanation?: string;
}> {
  const results: Array<{
    questionText: string;
    options: string[];
    correctIndex: number;
    explanation?: string;
  }> = [];

  const tables = doc.querySelectorAll("table");
  tables.forEach((table) => {
    const rows = table.querySelectorAll("tr");
    if (rows.length < 2) return;

    // Check header row for column mapping
    const headerCells = Array.from(rows[0].querySelectorAll("th, td")).map((c) =>
      cleanText(c.textContent || "").toLowerCase()
    );

    const qIdx = headerCells.findIndex((h) => h.includes("question") || h.includes("प्रश्न"));
    const optAIdx = headerCells.findIndex((h) => h.includes("option a") || h === "a" || h.includes("विकल्प a"));
    const optBIdx = headerCells.findIndex((h) => h.includes("option b") || h === "b" || h.includes("विकल्प b"));
    const optCIdx = headerCells.findIndex((h) => h.includes("option c") || h === "c" || h.includes("विकल्प c"));
    const optDIdx = headerCells.findIndex((h) => h.includes("option d") || h === "d" || h.includes("विकल्प d"));
    const optEIdx = headerCells.findIndex((h) => h.includes("option e") || h === "e" || h.includes("विकल्प e"));
    const ansIdx = headerCells.findIndex((h) => h.includes("answer") || h.includes("ans") || h.includes("उत्तर") || h.includes("correct"));
    const expIdx = headerCells.findIndex((h) => h.includes("explanation") || h.includes("solution") || h.includes("व्याख्या"));

    if (qIdx !== -1 && optAIdx !== -1 && optBIdx !== -1) {
      for (let i = 1; i < rows.length; i++) {
        const cells = rows[i].querySelectorAll("td");
        if (cells.length <= Math.max(qIdx, optAIdx, optBIdx)) continue;

        const qText = stripQuestionPrefix(getElementFormattedText(cells[qIdx]));
        const options: string[] = [];
        if (cells[optAIdx]) options.push(stripOptionPrefix(cleanText(cells[optAIdx].textContent || "")));
        if (cells[optBIdx]) options.push(stripOptionPrefix(cleanText(cells[optBIdx].textContent || "")));
        if (optCIdx !== -1 && cells[optCIdx]) options.push(stripOptionPrefix(cleanText(cells[optCIdx].textContent || "")));
        if (optDIdx !== -1 && cells[optDIdx]) options.push(stripOptionPrefix(cleanText(cells[optDIdx].textContent || "")));
        if (optEIdx !== -1 && cells[optEIdx]) options.push(stripOptionPrefix(cleanText(cells[optEIdx].textContent || "")));

        let correctIndex = 0;
        if (ansIdx !== -1 && cells[ansIdx]) {
          const mapped = mapAnswerToIndex(cells[ansIdx].textContent || "", options.length);
          if (mapped !== -1) correctIndex = mapped;
        }

        let explanation: string | undefined;
        if (expIdx !== -1 && cells[expIdx]) {
          explanation = getElementFormattedText(cells[expIdx]);
        }

        if (qText && options.length >= 2) {
          results.push({ questionText: qText, options, correctIndex, explanation });
        }
      }
    }
  });

  return results;
}

/**
 * Strategy 3: Text Flow Parsing (handles raw paragraphs <p>Q1. ... <p>(A)... (B)... Ans: ...</p>)
 */
function parseByTextFlow(doc: Document): Array<{
  questionText: string;
  options: string[];
  correctIndex: number;
  explanation?: string;
}> {
  const results: Array<{
    questionText: string;
    options: string[];
    correctIndex: number;
    explanation?: string;
  }> = [];

  // Clone body and remove non-content portal chrome (header, sidebar, introPage, footer, buttons)
  if (!doc.body) return results;
  const clone = doc.body.cloneNode(true) as Element;
  clone.querySelectorAll(
    "#introPage, #sidebar, #header, #footer, nav, header, footer, button, .timer-container, script, style"
  ).forEach((el) => el.remove());

  const bodyText = getElementFormattedText(clone);
  if (!bodyText) return results;

  // Split text by common question delimiters: "Q1.", "Q 1.", "1.", "Question 1:"
  const rawBlocks = bodyText.split(/(?=(?:^|\n)\s*(?:Q(?:uestion)?\s*\d+[:.-]?|\d+\s*[:.-]))/i);

  rawBlocks.forEach((block) => {
    const trimmed = block.trim();
    if (!trimmed || trimmed.length < 15) return;

    // Check if block contains options: (A)... (B)... or 1)... 2)...
    const optRegex = /(?:^|\n|\s+)(?:\(([A-E1-5])\)|([A-E1-5])[\.\)])\s+([^\n(]+)/gi;
    const options: string[] = [];
    let match: RegExpExecArray | null;
    let firstOptIdx = -1;

    while ((match = optRegex.exec(trimmed)) !== null) {
      if (firstOptIdx === -1) firstOptIdx = match.index;
      options.push(stripOptionPrefix(cleanText(match[3] || "")));
    }

    if (options.length >= 2 && firstOptIdx > 0) {
      const qText = stripQuestionPrefix(cleanText(trimmed.slice(0, firstOptIdx)));

      // Look for answer in remainder
      let correctIndex = 0;
      const ansMatch = trimmed.match(/(?:Answer|Ans|उत्तर|Correct\s*Option)\s*[:=-]?\s*([A-E1-5a-e\u0967-\u096B])/i);
      if (ansMatch) {
        const mapped = mapAnswerToIndex(ansMatch[1], options.length);
        if (mapped !== -1) correctIndex = mapped;
      }

      // Look for explanation
      let explanation: string | undefined;
      const expMatch = trimmed.match(/(?:Explanation|Solution|व्याख्या|हल)\s*[:=-]?\s*([\s\S]+?)(?=$|\n\s*(?:Q\d|\d+\.))/i);
      if (expMatch && expMatch[1]) {
        explanation = cleanText(expMatch[1]);
      }

      if (qText) {
        results.push({ questionText: qText, options, correctIndex, explanation });
      }
    }
  });

  return results;
}

/**
 * Main HTML MCQ Parser entry point.
 * Extracts, sanitizes, validates, and computes hashes for all MCQs in the provided HTML.
 */
export function parseHtmlMCQs(
  rawHtml: string,
  options: HtmlParserOptions = {}
): {
  questions: ParsedHtmlMCQ[];
  summary: HtmlImportSummary;
  globalMetadata: HtmlGlobalMetadata;
} {
  if (!rawHtml || !rawHtml.trim()) {
    return {
      questions: [],
      summary: { totalDetected: 0, validCount: 0, duplicateCount: 0, invalidCount: 0, warningCount: 0 },
      globalMetadata: {},
    };
  }

  const doc = sanitizeAndParseHtmlDocument(rawHtml);
  const globalMetadata = extractGlobalMetadata(doc);

  // Run extraction strategies in cascade: Container -> Table -> TextFlow
  let candidates = parseByContainerElements(doc);

  if (candidates.length === 0) {
    candidates = parseByTableRows(doc);
  }

  if (candidates.length === 0) {
    candidates = parseByTextFlow(doc);
  }

  const existingHashes = options.existingHashes || new Set<string>();
  const seenBatchHashes = new Set<string>();

  let validCount = 0;
  let dupeCount = 0;
  let invalidCount = 0;
  let warningCount = 0;

  const questions: ParsedHtmlMCQ[] = candidates.map((item, idx) => {
    const qNum = idx + 1;
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validation
    if (!item.questionText || item.questionText.trim().length < 3) {
      errors.push("Question statement is missing or too short.");
    }

    if (!Array.isArray(item.options) || item.options.length < 2) {
      errors.push("Question must contain at least 2 options.");
    } else {
      const emptyOpts = item.options.filter((opt) => !opt || opt.trim().length === 0);
      if (emptyOpts.length > 0) {
        warnings.push(`${emptyOpts.length} option(s) are empty.`);
      }
    }

    if (item.correctIndex < 0 || item.correctIndex >= (item.options?.length || 5)) {
      warnings.push(`Answer index (${item.correctIndex + 1}) is out of bounds. Defaulting to Option 1.`);
    }

    const ansLabel =
      item.options && item.options[item.correctIndex]
        ? item.options[item.correctIndex]
        : String(item.correctIndex + 1);
    const qType = detectQuestionType(item.questionText, item.options || [], ansLabel);

    // Deterministic hash calculation
    const hash = generateQuestionHash({
      question: item.questionText,
      options: item.options,
      table: item.table,
    } as any);

    const isDbDupe = existingHashes.has(hash);
    const isBatchDupe = !isDbDupe && Boolean(item.questionText?.trim()) && seenBatchHashes.has(hash);
    if (item.questionText?.trim()) {
      seenBatchHashes.add(hash);
    }

    const isDuplicate = isDbDupe || isBatchDupe;
    const duplicateOf = isDbDupe ? "database" : isBatchDupe ? "batch" : undefined;

    if (isDuplicate) {
      warnings.push(isDbDupe ? "Duplicate question found in Question Bank." : "Duplicate question found within this HTML batch.");
      dupeCount++;
    }

    const isValid = errors.length === 0;
    if (isValid) {
      validCount++;
    } else {
      invalidCount++;
    }

    if (warnings.length > 0) {
      warningCount++;
    }

    const tempId = `html_q_${qNum}_${hash ? hash.slice(0, 8) : idx}_${Date.now()}`;

    return {
      tempId,
      questionNumber: qNum,
      questionText: item.questionText,
      options: item.options,
      correctIndex: Math.max(0, Math.min(item.correctIndex, (item.options?.length || 1) - 1)),
      explanation: item.explanation,
      questionType: qType,
      subject: globalMetadata.subject || options.defaultSubjectId,
      chapter: globalMetadata.chapter || options.defaultChapterId,
      topic: globalMetadata.topic || options.defaultTopicId,
      table: item.table,
      hash,
      isValid,
      isDuplicate,
      duplicateOf,
      errors,
      warnings,
      rawHtmlSnippet: item.rawHtmlSnippet,
    };
  });

  return {
    questions,
    summary: {
      totalDetected: questions.length,
      validCount,
      duplicateCount: dupeCount,
      invalidCount,
      warningCount,
    },
    globalMetadata,
  };
}

/**
 * Sample template HTML for users to copy or test with.
 */
export function getSampleHtmlMCQs(): string {
  return `<!DOCTYPE html>
<html lang="hi">
<head>
  <meta charset="UTF-8">
  <title>Rajasthan Competitive Exam Practice Paper</title>
  <meta name="subject" content="राजस्थान का इतिहास, कला एवं संस्कृति">
  <meta name="chapter" content="राजस्थान का एकीकरण">
  <meta name="topic" content="एकीकरण के चरण">
</head>
<body>
  <h1>DISHA 20-20 (दिशा 20-20) HTML Import MCQ Sample Paper</h1>

  <!-- Question 1: Standard Direct MCQ -->
  <div class="question" data-correct="true">
    <h3 class="question-title">1. राजस्थान के एकीकरण के प्रथम चरण 'मत्स्य संघ' का उद्घाटन कब किया गया था?</h3>
    <ul class="options">
      <li>18 मार्च, 1948</li>
      <li>25 मार्च, 1948</li>
      <li>18 अप्रैल, 1948</li>
      <li>30 मार्च, 1949</li>
    </ul>
    <div class="answer">उत्तर: (A) 18 मार्च, 1948</div>
    <div class="explanation">मत्स्य संघ का उद्घाटन 18 मार्च 1948 को एन.वी. गाडगिल द्वारा भरतपुर के किले में किया गया था। इसमें अलवर, भरतपुर, धौलपुर एवं करौली रियासतें शामिल थीं।</div>
  </div>

  <!-- Question 2: Statement-Based MCQ with Radio Input structure -->
  <div class="question-container">
    <p class="question-text">
      2. राजस्थान के एकीकरण के संदर्भ में निम्नलिखित कथनों पर विचार कीजिए:<br>
      1. मत्स्य संघ की राजधानी अलवर को बनाया गया था।<br>
      2. पूर्व राजस्थान संघ की राजधानी कोटा थी।<br>
      उपर्युक्त कथनों में से कौन-सा/से कथन सही है/हैं?
    </p>
    <div class="options-group">
      <label><input type="radio" name="q2" value="0"> केवल 1</label><br>
      <label><input type="radio" name="q2" value="1"> केवल 2</label><br>
      <label><input type="radio" name="q2" value="2" checked data-correct="true"> 1 और 2 दोनों</label><br>
      <label><input type="radio" name="q2" value="3"> न तो 1 और न ही 2</label>
    </div>
    <div class="solution">
      <strong>व्याख्या:</strong> दोनों कथन सही हैं। मत्स्य संघ की राजधानी अलवर तथा द्वितीय चरण (पूर्व राजस्थान) की राजधानी कोटा थी जिनके राजप्रमुख कोटा महाराव भीमसिंह थे।
    </div>
  </div>

  <!-- Question 3: Match the Following / Table MCQ -->
  <div class="question-block">
    <h4>3. निम्नलिखित दुर्गों एवं उनके निर्माताओं को सुमेलित कीजिए :</h4>
    <table border="1" class="match-table">
      <thead>
        <tr><th>दुर्ग</th><th>निर्माता शासक</th></tr>
      </thead>
      <tbody>
        <tr><td>A. मेहरानगढ़ दुर्ग</td><td>1. राव जोधा</td></tr>
        <tr><td>B. जूनागढ़ दुर्ग</td><td>2. महाराजा रायसिंह</td></tr>
        <tr><td>C. सिवाना दुर्ग</td><td>3. वीर नारायण पंवार</td></tr>
        <tr><td>D. कुंभलगढ़ दुर्ग</td><td>4. महाराणा कुंभा</td></tr>
      </tbody>
    </table>
    <ol class="choices">
      <li>A-1, B-2, C-3, D-4</li>
      <li>A-2, B-1, C-4, D-3</li>
      <li>A-3, B-4, C-1, D-2</li>
      <li>A-4, B-3, C-2, D-1</li>
    </ol>
    <div class="ans">Answer: A</div>
    <div class="explanation">मेहरानगढ़ दुर्ग (जोधपुर) का निर्माण 1459 ई. में राव जोधा ने, जूनागढ़ (बीकानेर) का निर्माण रायसिंह ने तथा कुंभलगढ़ का निर्माण कुंभा ने करवाया था।</div>
  </div>

</body>
</html>`;
}
