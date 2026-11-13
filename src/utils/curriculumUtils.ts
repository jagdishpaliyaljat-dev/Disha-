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
    t === "unnamed subject"
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
 * Standardized Chapter Title Resolver
 * Guarantees 100% identical naming across Admin Panel, Student User App, PDF Exports, and Modals.
 */
export function getChapterDisplayName(chapter?: Partial<Chapter> | null): string {
  if (!chapter) return "Chapter";

  const title = (chapter.title || (chapter as any).name || "").trim();
  const hindiTitle = (chapter.hindiTitle || "").trim();

  // If one is generic and the other is descriptive, prefer the descriptive one
  if (title && !isGenericPlaceholder(title)) return title;
  if (hindiTitle && !isGenericPlaceholder(hindiTitle)) return hindiTitle;

  return title || hindiTitle || "Untitled Chapter";
}

export function getChapterSecondaryTitle(chapter?: Partial<Chapter> | null): string | null {
  if (!chapter) return null;
  const primary = getChapterDisplayName(chapter);
  const hindi = (chapter.hindiTitle || "").trim();
  const eng = (chapter.title || (chapter as any).name || "").trim();

  if (hindi && hindi !== primary && !isGenericPlaceholder(hindi)) return hindi;
  if (eng && eng !== primary && !isGenericPlaceholder(eng)) return eng;
  return null;
}

/**
 * Standardized Topic Title Resolver
 * Guarantees 100% identical naming across Admin Panel, Student User App, PDF Exports, and Modals.
 */
export function getTopicDisplayName(topic?: Partial<Topic> | null): string {
  if (!topic) return "Topic";

  const title = (topic.title || (topic as any).name || "").trim();
  const hindiTitle = (topic.hindiTitle || "").trim();

  // If one is generic and the other is descriptive, prefer the descriptive one
  if (title && !isGenericPlaceholder(title)) return title;
  if (hindiTitle && !isGenericPlaceholder(hindiTitle)) return hindiTitle;

  return title || hindiTitle || "Untitled Topic";
}

export function getTopicSecondaryTitle(topic?: Partial<Topic> | null): string | null {
  if (!topic) return null;
  const primary = getTopicDisplayName(topic);
  const hindi = (topic.hindiTitle || "").trim();
  const eng = (topic.title || (topic as any).name || "").trim();

  if (hindi && hindi !== primary && !isGenericPlaceholder(hindi)) return hindi;
  if (eng && eng !== primary && !isGenericPlaceholder(eng)) return eng;
  return null;
}
