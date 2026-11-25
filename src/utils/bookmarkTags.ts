import { BookmarkReasonTag, MCQSession, ProgressStore, Question } from "../types";

export type BookmarkTagFilter = "all" | "untagged" | BookmarkReasonTag;

export interface BookmarkTagMeta {
  id: BookmarkReasonTag;
  emoji: string;
  labelHi: string;
  labelEn: string;
  shortLabel: string;
  description: string;
  badgeClass: string;
  activeButtonClass: string;
}

/**
 * Canonical reason-based bookmark tag definitions ("मैंने इसे सेव क्यों किया?")
 */
export const BOOKMARK_REASON_TAGS: BookmarkTagMeta[] = [
  {
    id: "mug_up",
    emoji: "🧠",
    labelHi: "रटना है",
    labelEn: "Mug-up Fact",
    shortLabel: "🧠 रटना है",
    description: "तिथियां, अनुच्छेद, आंकड़े व सीधा तथ्य",
    badgeClass:
      "bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800/60",
    activeButtonClass:
      "bg-indigo-600 text-white border-indigo-600 shadow-xs",
  },
  {
    id: "confusing",
    emoji: "⚠️",
    labelHi: "कन्फ्यूजिंग पेयर",
    labelEn: "Confusing Pair",
    shortLabel: "⚠️ कन्फ्यूजिंग पेयर",
    description: "दो निकटवर्ती विकल्पों में भ्रम",
    badgeClass:
      "bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800/60",
    activeButtonClass:
      "bg-amber-600 text-white border-amber-600 shadow-xs",
  },
  {
    id: "silly_mistake",
    emoji: "🔄",
    labelHi: "सिल्ली मिस्टेक",
    labelEn: "Silly Mistake",
    shortLabel: "🔄 सिल्ली मिस्टेक",
    description: "आता था, पढ़ने या जल्दबाजी में गलती हुई",
    badgeClass:
      "bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800/60",
    activeButtonClass:
      "bg-rose-600 text-white border-rose-600 shadow-xs",
  },
  {
    id: "high_yield",
    emoji: "⭐",
    labelHi: "हाई-यील्ड PYQ",
    labelEn: "High-Yield PYQ",
    shortLabel: "⭐ हाई-यील्ड PYQ",
    description: "परीक्षा में बार-बार आने वाला महत्वपूर्ण प्रश्न",
    badgeClass:
      "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/60",
    activeButtonClass:
      "bg-emerald-600 text-white border-emerald-600 shadow-xs",
  },
];

const TAG_META_MAP: Record<BookmarkReasonTag, BookmarkTagMeta> = BOOKMARK_REASON_TAGS.reduce(
  (acc, item) => {
    acc[item.id] = item;
    return acc;
  },
  {} as Record<BookmarkReasonTag, BookmarkTagMeta>
);

export function isValidBookmarkReasonTag(tag: unknown): tag is BookmarkReasonTag {
  return typeof tag === "string" && tag in TAG_META_MAP;
}

export function getBookmarkTagMeta(tag?: BookmarkReasonTag | null): BookmarkTagMeta | null {
  if (!tag || !isValidBookmarkReasonTag(tag)) return null;
  return TAG_META_MAP[tag];
}

export interface BookmarkTagCounts {
  all: number;
  untagged: number;
  mug_up: number;
  confusing: number;
  silly_mistake: number;
  high_yield: number;
}

/**
 * Counts all bookmarked questions segmented by reason tag.
 */
export function computeBookmarkTagCounts(
  bookmarkedQuestions: Question[],
  progressStore: ProgressStore
): BookmarkTagCounts {
  const counts: BookmarkTagCounts = {
    all: 0,
    untagged: 0,
    mug_up: 0,
    confusing: 0,
    silly_mistake: 0,
    high_yield: 0,
  };

  for (const q of bookmarkedQuestions) {
    const entry = progressStore[q.id];
    if (!entry?.bookmarked) continue;
    counts.all++;
    const tag = entry.bookmarkTag;
    if (tag && isValidBookmarkReasonTag(tag)) {
      counts[tag]++;
    } else {
      counts.untagged++;
    }
  }

  return counts;
}

/**
 * Filters bookmarked questions by the selected reason tag filter.
 */
export function filterBookmarkedQuestionsByTag(
  bookmarkedQuestions: Question[],
  progressStore: ProgressStore,
  filter: BookmarkTagFilter
): Question[] {
  if (filter === "all") {
    return bookmarkedQuestions.filter((q) => Boolean(progressStore[q.id]?.bookmarked));
  }
  if (filter === "untagged") {
    return bookmarkedQuestions.filter((q) => {
      const p = progressStore[q.id];
      return Boolean(p?.bookmarked && !isValidBookmarkReasonTag(p?.bookmarkTag));
    });
  }
  return bookmarkedQuestions.filter((q) => {
    const p = progressStore[q.id];
    return Boolean(p?.bookmarked && p?.bookmarkTag === filter);
  });
}

/**
 * Builds a targeted MCQSession from bookmarked questions matching a reason tag filter.
 */
export function buildBookmarkTagSession(
  bookmarkedQuestions: Question[],
  progressStore: ProgressStore,
  filter: BookmarkTagFilter,
  startFromQuestionId?: string
): MCQSession | null {
  const matched = filterBookmarkedQuestionsByTag(bookmarkedQuestions, progressStore, filter);
  if (matched.length === 0) return null;

  let ordered = [...matched];
  if (startFromQuestionId) {
    const idx = ordered.findIndex((q) => q.id === startFromQuestionId);
    if (idx > 0) {
      ordered = [...ordered.slice(idx), ...ordered.slice(0, idx)];
    }
  }

  const meta = filter !== "all" && filter !== "untagged" ? getBookmarkTagMeta(filter) : null;
  const title = meta
    ? `${meta.emoji} ${meta.labelHi} • Bookmarked Revision`
    : filter === "untagged"
    ? "Untagged Bookmarks Revision"
    : "Bookmarked Questions Revision";

  return {
    title,
    subtitle: `${ordered.length} Saved Questions${meta ? ` • ${meta.labelEn}` : ""}`,
    questionIds: ordered.map((q) => q.id),
    extraQuestions: ordered,
    source: "all-wrong",
  };
}
