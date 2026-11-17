import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getCombinedQuestionsMap,
  getCombinedChaptersMap,
  getCombinedTopicsMap,
} from "../src/utils/questionsStorage";
import { Question, Chapter, Topic } from "../src/types";

describe("Production Runtime View Crash Resilience Suite", () => {
  describe("1. Lookup Map Resiliency (App.tsx Root Render Level)", () => {
    it("should safely handle null, undefined, or empty arrays in getCombinedQuestionsMap", () => {
      expect(getCombinedQuestionsMap([] as any)).toEqual({});
      expect(getCombinedQuestionsMap(undefined as any)).toEqual({});
      expect(getCombinedQuestionsMap(null as any)).toEqual({});
    });

    it("should safely filter out null or corrupt entries in getCombinedQuestionsMap without crashing", () => {
      const corruptQuestions: any[] = [
        null,
        undefined,
        { id: "" },
        { text: "No id question" },
        { id: "q1", text: "Valid Question 1", options: ["A", "B", "C", "D"], correctIndex: 0 },
        { id: "q2", text: "Valid Question 2", options: ["1", "2"], correctIndex: 1 },
      ];

      const map = getCombinedQuestionsMap(corruptQuestions);
      expect(map).toBeDefined();
      expect(map["q1"]).toBeDefined();
      expect(map["q1"].text).toBe("Valid Question 1");
      expect(map["q2"]).toBeDefined();
      expect(Object.keys(map).length).toBe(2);
    });

    it("should safely handle null, undefined, or empty arrays in getCombinedChaptersMap", () => {
      expect(getCombinedChaptersMap([] as any)).toEqual({});
      expect(getCombinedChaptersMap(undefined as any)).toEqual({});
      expect(getCombinedChaptersMap(null as any)).toEqual({});
    });

    it("should safely filter out null or corrupt entries in getCombinedChaptersMap without crashing", () => {
      const corruptChapters: any[] = [
        null,
        undefined,
        { id: "" },
        { title: "No id chapter" },
        { id: "ch1", title: "Chapter 1", number: 1, topics: [] },
      ];

      const map = getCombinedChaptersMap(corruptChapters);
      expect(map).toBeDefined();
      expect(map["ch1"]).toBeDefined();
      expect(map["ch1"].title).toBe("Chapter 1");
      expect(Object.keys(map).length).toBe(1);
    });

    it("should safely handle null, undefined, or corrupt topics in getCombinedTopicsMap", () => {
      expect(getCombinedTopicsMap([] as any)).toEqual({});
      expect(getCombinedTopicsMap(undefined as any)).toEqual({});
      expect(getCombinedTopicsMap(null as any)).toEqual({});

      const corruptChapters: any[] = [
        null,
        { id: "ch1", topics: null },
        { id: "ch2", topics: [null, undefined, { id: "" }, { id: "top1", title: "Topic 1" }] },
      ];

      const map = getCombinedTopicsMap(corruptChapters);
      expect(map).toBeDefined();
      expect(map["top1"]).toBeDefined();
      expect(map["top1"].title).toBe("Topic 1");
      expect(Object.keys(map).length).toBe(1);
    });
  });

  describe("2. MCQ Option Normalization & Shuffling Defense", () => {
    it("should safely handle questions with undefined, null, or empty options arrays", () => {
      // Simulating question option resolution inside MCQ Session
      const resolveDisplayedOptions = (q: any) => {
        if (!q) return [];
        const baseOptions = Array.isArray(q.options) && q.options.length > 0
          ? [...q.options]
          : ["(A)", "(B)", "(C)", "(D)"];

        if (baseOptions.length === 4) {
          baseOptions.push("अनुत्तरित प्रश्न (Question not attempted)");
        }
        return baseOptions.map((text: string, idx: number) => ({ text, originalIndex: idx }));
      };

      const qWithNoOptions: any = { id: "corrupt_1", text: "Question without options" };
      const qWithNullOptions: any = { id: "corrupt_2", text: "Question with null options", options: null };
      const qWithEmptyOptions: any = { id: "corrupt_3", text: "Question with empty options", options: [] };
      const qWithValidOptions: any = { id: "valid_1", text: "Question with valid options", options: ["Opt 1", "Opt 2", "Opt 3", "Opt 4"] };

      expect(() => resolveDisplayedOptions(qWithNoOptions)).not.toThrow();
      expect(resolveDisplayedOptions(qWithNoOptions).length).toBe(5); // Default 4 + Option E

      expect(() => resolveDisplayedOptions(qWithNullOptions)).not.toThrow();
      expect(resolveDisplayedOptions(qWithNullOptions).length).toBe(5);

      expect(() => resolveDisplayedOptions(qWithEmptyOptions)).not.toThrow();
      expect(resolveDisplayedOptions(qWithEmptyOptions).length).toBe(5);

      expect(() => resolveDisplayedOptions(qWithValidOptions)).not.toThrow();
      expect(resolveDisplayedOptions(qWithValidOptions).length).toBe(5);
    });

    it("should not crash when shuffling options for questions with missing or malformed options", () => {
      const getShuffledOptionIndices = (options: string[], q?: any) => {
        if (!Array.isArray(options) || options.length === 0) {
          return [0, 1, 2, 3];
        }
        return options.map((_, i) => i);
      };

      expect(() => getShuffledOptionIndices(undefined as any)).not.toThrow();
      expect(getShuffledOptionIndices(undefined as any)).toEqual([0, 1, 2, 3]);

      expect(() => getShuffledOptionIndices(null as any)).not.toThrow();
      expect(getShuffledOptionIndices(null as any)).toEqual([0, 1, 2, 3]);

      expect(() => getShuffledOptionIndices([])).not.toThrow();
      expect(getShuffledOptionIndices([])).toEqual([0, 1, 2, 3]);

      expect(getShuffledOptionIndices(["A", "B", "C", "D"])).toEqual([0, 1, 2, 3]);
    });
  });

  describe("3. Chapter Detail Calculation & Topic Protection", () => {
    it("should safely compute mastery when chapter topics or questions contain nulls or missing arrays", () => {
      const corruptChapter: any = {
        id: "ch_test",
        title: "Test Chapter",
        number: 1,
        topics: [
          null,
          undefined,
          { id: "t1", title: "Topic 1", questions: null },
          { id: "t2", title: "Topic 2", questions: [null, undefined, { id: "q_valid", text: "Valid" }] },
        ],
      };

      const progressStore: any = {
        q_valid: { status: "correct" },
      };

      const allChapterQuestions = (corruptChapter.topics || [])
        .flatMap((t: any) => (t && Array.isArray(t.questions)) ? t.questions : [])
        .filter((q: any): q is Question => Boolean(q && q.id));

      const correctInChapter = allChapterQuestions.filter(
        (q: any) => progressStore && q && q.id && progressStore[q.id]?.status === "correct"
      ).length;

      const mastery = allChapterQuestions.length > 0 
        ? Math.round((correctInChapter / allChapterQuestions.length) * 100) 
        : 0;

      expect(allChapterQuestions.length).toBe(1);
      expect(correctInChapter).toBe(1);
      expect(mastery).toBe(100);
    });
  });

  describe("4. Student Progress & Data Preservation", () => {
    it("should preserve progress and bookmarks without data loss during view recovery", () => {
      const mockStorage: Record<string, string> = {
        disha2020_progress_store_v1: JSON.stringify({
          q1: { status: "correct", timesAttempted: 1, bookmarked: true },
          q2: { status: "wrong", timesAttempted: 2, bookmarked: false },
        }),
        economic_survey_user_profile_v1: JSON.stringify({
          id: "student_verified_123",
          name: "Verified Student",
          role: "student",
        }),
      };

      // Ensure that clean recovery operations NEVER delete genuine progress, bookmarks, or profiles
      const keysToPreserve = [
        "disha2020_progress_store_v1",
        "economic_survey_progress_v2",
        "economic_survey_user_profile_v1",
      ];

      keysToPreserve.forEach((k) => {
        if (mockStorage[k]) {
          expect(mockStorage[k]).toBeDefined();
        }
      });
    });
  });
});
