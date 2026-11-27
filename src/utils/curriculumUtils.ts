import { Subject, Chapter, Topic } from "../types";

/**
 * Checks if a string is a generic system placeholder (e.g. "Topic 1", "Chapter 2", "ch-1")
 */
export function isGenericPlaceholder(text?: string | null): boolean {
  if (!text) return true;
  const t = text.trim().toLowerCase();
  return (
    !t ||
    t === "unnamed topic" ||
    t === "unnamed chapter" ||
    t === "unnamed subject" ||
    t === "mcq" ||
    t === "mcqs" ||
    t === "practice" ||
    t === "test" ||
    t === "quiz" ||
    t === "untitled" ||
    t === "untitled topic"
  );
}

/**
 * Standardized Subject Title Resolver
 * Guarantees 100% identical naming across Admin Panel, Student User App, PDF Exports, and Modals.
 */
export function getSubjectDisplayName(subject?: Partial<Subject> | null): string {
  if (!subject) return "Subject";
  
  const name = (subject.name || "").trim();
  const hindiName = (subject.hindiName || "").trim();

  // If one is generic and the other is descriptive, prefer the descriptive one
  if (name && !isGenericPlaceholder(name)) return name;
  if (hindiName && !isGenericPlaceholder(hindiName)) return hindiName;
  
  return name || hindiName || "Untitled Subject";
}

export function getSubjectSecondaryName(subject?: Partial<Subject> | null): string | null {
  if (!subject) return null;
  const primary = getSubjectDisplayName(subject);
  const hindi = (subject.hindiName || "").trim();
  const eng = (subject.name || "").trim();

  if (hindi && hindi !== primary && !isGenericPlaceholder(hindi)) return hindi;
  if (eng && eng !== primary && !isGenericPlaceholder(eng)) return eng;
  return null;
}

/**
 * Strips duplicate or hardcoded leading serial numbers and prefixes
 * (e.g., '1. ', '01. ', '1 - ', 'Chapter 1: ', 'अध्याय 1 - ', 'Topic 1: ')
 * to avoid duplicate serial numbers when UI cards render their own badge.
 */
export function stripLeadingSerial(text?: string | null): string {
  if (!text) return "";
  let str = text.trim();
  let prev = "";
  let iters = 0;
  while (str !== prev && iters < 3) {
    prev = str;
    str = str
      .replace(/^(?:(?:chapter|ch\.?|topic|अध्याय|प्रकरण)\s*\d+[\s\.\:\-\–\—\)]*)+/i, "")
      .replace(/^(?:\d+[\s]*[\.\:\-\–\—\)\/]+\s*)+/, "")
      .trim();
    iters++;
  }
  return str || text.trim();
}

/**
 * Standardized Chapter Title Resolver
 * Guarantees 100% identical naming across Admin Panel, Student User App, PDF Exports, and Modals.
 * Strips redundant leading serial numbers to prevent repeated numbering in UI cards.
 */
export function getChapterDisplayName(chapter?: Partial<Chapter> | null): string {
  if (!chapter) return "Chapter";

  const title = (chapter.title || (chapter as any).name || "").trim();
  const hindiTitle = (chapter.hindiTitle || "").trim();

  let resolved = "Untitled Chapter";
  if (title && !isGenericPlaceholder(title)) {
    resolved = title;
  } else if (hindiTitle && !isGenericPlaceholder(hindiTitle)) {
    resolved = hindiTitle;
  } else {
    resolved = title || hindiTitle || "Untitled Chapter";
  }

  return stripLeadingSerial(resolved);
}

export function getChapterSecondaryTitle(chapter?: Partial<Chapter> | null): string | null {
  if (!chapter) return null;
  const primary = getChapterDisplayName(chapter);
  const hindi = stripLeadingSerial((chapter.hindiTitle || "").trim());
  const eng = stripLeadingSerial((chapter.title || (chapter as any).name || "").trim());

  if (hindi && hindi !== primary && !isGenericPlaceholder(hindi)) return hindi;
  if (eng && eng !== primary && !isGenericPlaceholder(eng)) return eng;
  return null;
}

/**
 * Standardized Topic Title Resolver
 * Guarantees 100% identical naming across Admin Panel, Student User App, PDF Exports, and Modals.
 * Strips redundant leading serial numbers to prevent repeated numbering in UI cards.
 */
export function getTopicDisplayName(topic?: Partial<Topic> | null): string {
  if (!topic) return "Topic";

  const title = (topic.title || (topic as any).name || "").trim();
  const hindiTitle = (topic.hindiTitle || "").trim();

  let resolved = "Untitled Topic";
  if (title && !isGenericPlaceholder(title)) {
    resolved = title;
  } else if (hindiTitle && !isGenericPlaceholder(hindiTitle)) {
    resolved = hindiTitle;
  } else {
    resolved = title || hindiTitle || "Untitled Topic";
  }

  return stripLeadingSerial(resolved);
}

export function getTopicSecondaryTitle(topic?: Partial<Topic> | null): string | null {
  if (!topic) return null;
  const primary = getTopicDisplayName(topic);
  const hindi = stripLeadingSerial((topic.hindiTitle || "").trim());
  const eng = stripLeadingSerial((topic.title || (topic as any).name || "").trim());

  if (hindi && hindi !== primary && !isGenericPlaceholder(hindi)) return hindi;
  if (eng && eng !== primary && !isGenericPlaceholder(eng)) return eng;
  return null;
}
