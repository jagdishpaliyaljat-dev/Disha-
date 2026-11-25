// @vitest-environment jsdom
import React from "react";
import { describe, it, expect, vi } from "vitest";
import { renderToString } from "react-dom/server";
import { ProgressStore, Question } from "../src/types";
import {
  BOOKMARK_REASON_TAGS,
  buildBookmarkTagSession,
  computeBookmarkTagCounts,
  filterBookmarkedQuestionsByTag,
  getBookmarkTagMeta,
  isValidBookmarkReasonTag,
} from "../src/utils/bookmarkTags";
import { mergeRealtimeProgressDelta } from "../src/utils/storage";
import { SmartBookmarkButton } from "../src/components/SmartBookmarkButton";

const makeQuestion = (id: string, text: string): Question => ({
  id,
  text,
  options: ["A", "B", "C", "D"],
  correctIndex: 0,
});

describe("Reason-Based Smart Bookmark Tags (कारण-आधारित स्मार्ट बुकमार्क टैग्स)", () => {
  const sampleQuestions: Question[] = [
    makeQuestion("q1", "अनुच्छेद 356 किससे संबंधित है?"),
    makeQuestion("q2", "देबारी बनाम जावर की खान में अंतर"),
    makeQuestion("q3", "हल्दीघाटी युद्ध - नहीं है पढ़ने में गलती"),
    makeQuestion("q4", "RAS Pre बार-बार पूछा जाने वाला प्रश्न"),
    makeQuestion("q5", "बिना टैग वाला बुकमार्क प्रश्न"),
    makeQuestion("q6", "अनबुकमार्क किया हुआ प्रश्न"),
  ];

  const sampleProgress: ProgressStore = {
    q1: {
      status: "correct",
      stage: 1,
      nextReviewAt: "2026-12-01",
      wrongCount: 0,
      bookmarked: true,
      bookmarkTag: "mug_up",
      lastAnsweredAt: "2026-11-25T10:00:00Z",
    },
    q2: {
      status: "wrong",
      stage: 0,
      nextReviewAt: "2026-11-26",
      wrongCount: 2,
      bookmarked: true,
      bookmarkTag: "confusing",
      lastAnsweredAt: "2026-11-25T10:01:00Z",
    },
    q3: {
      status: "wrong",
      stage: 0,
      nextReviewAt: "2026-11-26",
      wrongCount: 1,
      bookmarked: true,
      bookmarkTag: "silly_mistake",
      lastAnsweredAt: "2026-11-25T10:02:00Z",
    },
    q4: {
      status: "correct",
      stage: 2,
      nextReviewAt: "2026-12-10",
      wrongCount: 0,
      bookmarked: true,
      bookmarkTag: "high_yield",
      lastAnsweredAt: "2026-11-25T10:03:00Z",
    },
    q5: {
      status: "unattempted",
      stage: 0,
      nextReviewAt: "",
      wrongCount: 0,
      bookmarked: true,
      lastAnsweredAt: null,
    },
    q6: {
      status: "wrong",
      stage: 0,
      nextReviewAt: "2026-11-26",
      wrongCount: 1,
      bookmarked: false,
      lastAnsweredAt: "2026-11-25T10:04:00Z",
    },
  };

  describe("Tag Metadata & Validation", () => {
    it("exposes all 4 canonical reason tags with Hindi & English labels", () => {
      expect(BOOKMARK_REASON_TAGS.map((t) => t.id)).toEqual([
        "mug_up",
        "confusing",
        "silly_mistake",
        "high_yield",
      ]);
      expect(getBookmarkTagMeta("confusing")?.labelHi).toBe("कन्फ्यूजिंग पेयर");
      expect(getBookmarkTagMeta("mug_up")?.emoji).toBe("🧠");
      expect(isValidBookmarkReasonTag("high_yield")).toBe(true);
      expect(isValidBookmarkReasonTag("invalid_tag")).toBe(false);
      expect(getBookmarkTagMeta(undefined)).toBeNull();
    });
  });

  describe("Tag Counts & Filtering", () => {
    it("computes accurate counts across tagged, untagged, and total bookmarked questions", () => {
      const counts = computeBookmarkTagCounts(sampleQuestions, sampleProgress);
      expect(counts.all).toBe(5);
      expect(counts.mug_up).toBe(1);
      expect(counts.confusing).toBe(1);
      expect(counts.silly_mistake).toBe(1);
      expect(counts.high_yield).toBe(1);
      expect(counts.untagged).toBe(1);
    });

    it("filters bookmarked questions accurately by tag or untagged", () => {
      expect(filterBookmarkedQuestionsByTag(sampleQuestions, sampleProgress, "all").map((q) => q.id)).toEqual([
        "q1",
        "q2",
        "q3",
        "q4",
        "q5",
      ]);
      expect(filterBookmarkedQuestionsByTag(sampleQuestions, sampleProgress, "confusing").map((q) => q.id)).toEqual([
        "q2",
      ]);
      expect(filterBookmarkedQuestionsByTag(sampleQuestions, sampleProgress, "untagged").map((q) => q.id)).toEqual([
        "q5",
      ]);
    });
  });

  describe("Targeted Practice Session Builder", () => {
    it("builds a targeted MCQSession for a specific bookmark reason tag", () => {
      const session = buildBookmarkTagSession(sampleQuestions, sampleProgress, "confusing");
      expect(session).not.toBeNull();
      expect(session?.questionIds).toEqual(["q2"]);
      expect(session?.title).toContain("कन्फ्यूजिंग पेयर");
      expect(session?.subtitle).toContain("1 Saved Questions");
    });

    it("rotates order cleanly when startFromQuestionId is specified", () => {
      const session = buildBookmarkTagSession(sampleQuestions, sampleProgress, "all", "q3");
      expect(session?.questionIds).toEqual(["q3", "q4", "q5", "q1", "q2"]);
    });

    it("returns null when no questions match the tag filter", () => {
      const emptyProg: ProgressStore = {};
      expect(buildBookmarkTagSession(sampleQuestions, emptyProg, "mug_up")).toBeNull();
    });
  });

  describe("Realtime Storage Merge Persistence", () => {
    it("preserves and updates bookmarkTag in mergeRealtimeProgressDelta", () => {
      const current: ProgressStore = {
        q1: {
          status: "correct",
          stage: 1,
          nextReviewAt: "2026-12-01",
          wrongCount: 0,
          bookmarked: true,
          bookmarkTag: "mug_up",
          lastAnsweredAt: "2026-11-25T10:00:00Z",
          updatedAt: "2026-11-25T10:00:00Z",
        },
      };

      const incoming: ProgressStore = {
        q1: {
          status: "correct",
          stage: 1,
          nextReviewAt: "2026-12-01",
          wrongCount: 0,
          bookmarked: true,
          bookmarkTag: "high_yield",
          lastAnsweredAt: "2026-11-25T10:00:00Z",
          updatedAt: "2026-11-25T10:05:00Z",
        },
        q2: {
          status: "wrong",
          stage: 0,
          nextReviewAt: "2026-11-26",
          wrongCount: 1,
          bookmarked: true,
          bookmarkTag: "confusing",
          lastAnsweredAt: "2026-11-25T10:02:00Z",
        },
      };

      const { merged, changedCount } = mergeRealtimeProgressDelta(current, incoming);
      expect(changedCount).toBe(2);
      expect(merged.q1.bookmarkTag).toBe("high_yield");
      expect(merged.q2.bookmarkTag).toBe("confusing");
    });
  });

  describe("SmartBookmarkButton UI Rendering", () => {
    it("renders active reason emoji badge when bookmarked with a tag", () => {
      const html = renderToString(
        <SmartBookmarkButton
          questionId="q2"
          isBookmarked={true}
          currentTag="confusing"
          onToggleBookmark={vi.fn()}
        />
      );
      expect(html).toContain("⚠️");
      expect(html).toContain("Manage Bookmark Tag");
    });

    it("renders clean unbookmarked state without tag emoji", () => {
      const html = renderToString(
        <SmartBookmarkButton
          questionId="q6"
          isBookmarked={false}
          onToggleBookmark={vi.fn()}
        />
      );
      expect(html).toContain("Bookmark Question");
      expect(html).not.toContain("⚠️");
    });
  });
});
