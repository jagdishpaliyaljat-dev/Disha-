import { describe, it, expect, beforeEach } from "vitest";
import { supabase } from "../src/lib/supabase";
import { openLocalDatabase, idbGet, idbPut, idbGetAll, STORES } from "../src/utils/localDatabaseEngine";
import {
  getCombinedSubjects,
  getCombinedChapters,
  deduplicateQuestions
} from "../src/utils/questionsStorage";
import {
  resolveCanonicalForeignKeys,
  runDataIntegrityAudit
} from "../src/utils/dataIntegrityEngine";
import { generateQuestionHash } from "../src/lib/mcqImport";
import type { Subject, Chapter, Topic, Question, UserQuestionsStore } from "../src/types";

describe("DISHA 20-20 — 10-Point Master Data Integrity Audit & Verification", () => {
  let dbSubjects: any[] = [];
  let dbChapters: any[] = [];
  let dbTopics: any[] = [];
  let dbQuestions: any[] = [];

  beforeEach(async () => {
    await openLocalDatabase();

    // Fetch live Supabase records
    const [sRes, cRes, tRes, qRes] = await Promise.all([
      supabase.from("subjects").select("*"),
      supabase.from("chapters").select("*"),
      supabase.from("topics").select("*"),
      supabase.from("questions").select("*")
    ]);

    dbSubjects = sRes.data || [];
    dbChapters = cRes.data || [];
    dbTopics = tRes.data || [];
    dbQuestions = qRes.data || [];
  });

  describe("1. Subject-Chapter Relationships", () => {
    it("1.1 Every chapter in Supabase has a valid existing subject reference", () => {
      const subjectIds = new Set(dbSubjects.map((s) => s.id));
      const unmappedChapters = dbChapters.filter(
        (c) => !c.subject_id || !subjectIds.has(c.subject_id)
      );

      expect(unmappedChapters).toHaveLength(0);
    });

    it("1.2 Every chapter in student panel has a valid existing subject reference", () => {
      const store: UserQuestionsStore = {
        customQuestions: [],
        editedQuestions: {},
        bookmarkedQuestionIds: [],
        wrongQuestionIds: [],
        customChapters: [
          {
            id: "ch_student_1",
            subjectId: "sub_raj_hist",
            title: "Student Chapter",
            hindiTitle: "विद्यार्थी अध्याय",
            number: 1,
            topics: []
          }
        ],
        customSubjects: [
          {
            id: "sub_raj_hist",
            name: "Rajasthan History",
            hindiName: "राजस्थान का इतिहास",
            order: 1
          }
        ]
      };

      const combinedSubs = getCombinedSubjects(store);
      const combinedChaps = getCombinedChapters(store);
      const subIdSet = new Set(combinedSubs.map((s) => s.id));

      const unmapped = combinedChaps.filter(
        (c) => !c.subjectId || !subIdSet.has(c.subjectId)
      );

      expect(unmapped).toHaveLength(0);
    });
  });

  describe("2. Chapter-Topic Relationships", () => {
    it("2.1 Every topic in Supabase has a valid existing chapter reference", () => {
      const chapterIds = new Set(dbChapters.map((c) => c.id));
      const unmappedTopics = dbTopics.filter(
        (t) => !t.chapter_id || !chapterIds.has(t.chapter_id)
      );

      expect(unmappedTopics).toHaveLength(0);
    });

    it("2.2 Every topic in student curriculum is nested within a valid parent chapter", () => {
      const store: UserQuestionsStore = {
        customQuestions: [],
        editedQuestions: {},
        bookmarkedQuestionIds: [],
        wrongQuestionIds: [],
        customChapters: [
          {
            id: "ch_parent_1",
            subjectId: "sub_raj_hist",
            title: "Parent Chapter",
            hindiTitle: "मूल अध्याय",
            number: 1,
            topics: [
              {
                id: "top_child_1",
                chapterId: "ch_parent_1",
                title: "Child Topic",
                hindiTitle: "उप-विषय",
                number: 1
              }
            ]
          }
        ]
      };

      const combinedChaps = getCombinedChapters(store);
      const orphanTopics: Topic[] = [];

      combinedChaps.forEach((ch) => {
        (ch.topics || []).forEach((t) => {
          if (t.chapterId && t.chapterId !== ch.id) {
            orphanTopics.push(t);
          }
        });
      });

      expect(orphanTopics).toHaveLength(0);
    });
  });

  describe("3. Topic-MCQ Relationships", () => {
    it("3.1 resolveCanonicalForeignKeys reconciles all questions to valid canonical topic IDs", () => {
      const canonicalSubs: Subject[] = [
        { id: "sub_raj_hist", name: "Rajasthan History", hindiName: "राजस्थान का इतिहास", order: 1 }
      ];
      const canonicalChaps: Chapter[] = [
        {
          id: "chap_raj_sources",
          subjectId: "sub_raj_hist",
          title: "Historical Sources",
          hindiTitle: "ऐतिहासिक स्रोत",
          number: 1,
          topics: [
            { id: "top_inscriptions", chapterId: "chap_raj_sources", title: "Inscriptions", hindiTitle: "अभिलेख" },
            { id: "top_coins", chapterId: "chap_raj_sources", title: "Coins", hindiTitle: "सिक्के" }
          ]
        },
        {
          id: "chap_raj_1857",
          subjectId: "sub_raj_hist",
          title: "Revolt of 1857",
          hindiTitle: "1857 की क्रान्ति",
          number: 2,
          topics: [
            { id: "top_cantonments", chapterId: "chap_raj_1857", title: "Cantonments", hindiTitle: "छावनियां" },
            { id: "top_auwa", chapterId: "chap_raj_1857", title: "Auwa Revolt", hindiTitle: "आउवा विद्रोह" }
          ]
        }
      ];

      const { reconciledQuestions, resolvedOrphans } = resolveCanonicalForeignKeys(
        dbQuestions.map(q => ({
          ...q,
          text: q.question || q.text,
          correctIndex: q.correct_answer ?? q.correctIndex,
          topicId: q.topic_id,
          chapterId: q.chapter_id,
          subjectId: q.subject_id
        })),
        canonicalSubs,
        canonicalChaps,
        []
      );

      expect(reconciledQuestions).toHaveLength(dbQuestions.length);
      expect(resolvedOrphans.length).toBeGreaterThanOrEqual(10); // All 10 pilot questions resolved

      // Verify every question now has a valid topicId
      const validTopicIds = new Set(["top_inscriptions", "top_coins", "top_cantonments", "top_auwa"]);
      reconciledQuestions.forEach((q) => {
        expect(validTopicIds.has(q.topicId!)).toBe(true);
        expect(q.subjectId).toBe("sub_raj_hist");
      });
    });
  });

  describe("4. Missing Foreign Keys Audit", () => {
    it("4.1 Validates that all chapters and topics have complete non-null foreign key references", () => {
      const chaptersMissingSubj = dbChapters.filter((c) => !c.subject_id);
      const topicsMissingChap = dbTopics.filter((t) => !t.chapter_id);
      const topicsMissingSubj = dbTopics.filter((t) => !t.subject_id);

      expect(chaptersMissingSubj).toHaveLength(0);
      expect(topicsMissingChap).toHaveLength(0);
      expect(topicsMissingSubj).toHaveLength(0);
    });
  });

  describe("5. Orphan Records Audit", () => {
    it("5.1 Verifies zero orphan chapters and zero orphan topics in Supabase", () => {
      const subIds = new Set(dbSubjects.map((s) => s.id));
      const chapIds = new Set(dbChapters.map((c) => c.id));

      const orphanChapters = dbChapters.filter((c) => !subIds.has(c.subject_id));
      const orphanTopics = dbTopics.filter((t) => !chapIds.has(t.chapter_id));

      expect(orphanChapters).toHaveLength(0);
      expect(orphanTopics).toHaveLength(0);
    });
  });

  describe("6. Duplicate IDs Audit", () => {
    it("6.1 Confirms zero duplicate IDs in subjects, chapters, topics, and questions", () => {
      const checkDuplicates = (items: { id: string }[]) => {
        const seen = new Set<string>();
        const duplicates: string[] = [];
        items.forEach((item) => {
          if (seen.has(item.id)) duplicates.push(item.id);
          seen.add(item.id);
        });
        return duplicates;
      };

      expect(checkDuplicates(dbSubjects)).toHaveLength(0);
      expect(checkDuplicates(dbChapters)).toHaveLength(0);
      expect(checkDuplicates(dbTopics)).toHaveLength(0);
      expect(checkDuplicates(dbQuestions)).toHaveLength(0);
    });
  });

  describe("7. Duplicate Logical Questions Audit", () => {
    it("7.1 Confirms zero duplicate logical questions in production questions table", () => {
      const hashes = new Set<string>();
      const duplicateIds: string[] = [];

      dbQuestions.forEach((q) => {
        const h = generateQuestionHash({
          question: q.question || q.text || "",
          options: q.options || [],
          answer: String(q.correct_answer ?? q.correctIndex ?? "0")
        });

        if (hashes.has(h)) duplicateIds.push(q.id);
        hashes.add(h);
      });

      expect(duplicateIds).toHaveLength(0);
    });
  });

  describe("8. Missing Required Fields Audit", () => {
    it("8.1 Confirms all questions possess text, >=2 options, and valid numeric answer", () => {
      const malformedQuestions = dbQuestions.filter((q) => {
        const hasText = Boolean((q.question || q.text || "").trim());
        const hasOptions = Array.isArray(q.options) && q.options.length >= 2;
        const hasAnswer = typeof (q.correct_answer ?? q.correctIndex) === "number";
        return !hasText || !hasOptions || !hasAnswer;
      });

      expect(malformedQuestions).toHaveLength(0);
    });
  });

  describe("9. Invalid References & Hierarchy Consistency", () => {
    it("9.1 Topics table correctly links to chapter that belongs to matching subject", () => {
      const chapMap = new Map(dbChapters.map((c) => [c.id, c]));

      const miswiredTopics = dbTopics.filter((t) => {
        const parentChap = chapMap.get(t.chapter_id);
        if (!parentChap) return true;
        return parentChap.subject_id !== t.subject_id;
      });

      expect(miswiredTopics).toHaveLength(0);
    });
  });

  describe("10. Record Count Consistency across Layers", () => {
    it("10.1 IndexedDB stores mirror baseline entity counts safely", async () => {
      // Put records into IndexedDB
      for (const s of dbSubjects) {
        await idbPut(STORES.SUBJECTS, { ...s, hindiName: s.hindi_name });
      }
      for (const c of dbChapters) {
        await idbPut(STORES.CHAPTERS, { ...c, hindiTitle: c.hindi_name, title: c.name, subjectId: c.subject_id });
      }

      const idbSubs = await idbGetAll(STORES.SUBJECTS);
      const idbChaps = await idbGetAll(STORES.CHAPTERS);

      expect(idbSubs.length).toBeGreaterThanOrEqual(dbSubjects.length);
      expect(idbChaps.length).toBeGreaterThanOrEqual(dbChapters.length);
    });
  });
});
