import { describe, it, expect, beforeEach } from "vitest";
import {
  upsertQuestionsToSupabase,
  deleteQuestionFromSupabase,
  deleteQuestionsBulkFromSupabase
} from "../src/utils/supabaseSyncService";
import {
  bulkDeleteQuestions,
  bulkMoveQuestions,
  editQuestionInStore,
  getCombinedQuestionsMap
} from "../src/utils/questionsStorage";
import { generateQuestionHash } from "../src/lib/mcqImport";
import { openLocalDatabase, idbGet, STORES } from "../src/utils/localDatabaseEngine";
import type { Question, UserQuestionsStore } from "../src/types";

describe("DISHA 2020 — Admin MCQ Management Functional Audit & Verification Suite", () => {
  let mockStore: UserQuestionsStore;

  beforeEach(async () => {
    await openLocalDatabase();
    mockStore = {
      customQuestions: [
        {
          id: "q_mcq_test_01",
          subjectId: "sub_raj_hist",
          chapterId: "ch_raj_hist_01",
          topicId: "top_raj_hist_01",
          text: "राजस्थान में कालीबंगा किस जिले में स्थित है?",
          options: ["हनुमानगढ़", "गंगानगर", "बीकानेर", "चूरू"],
          correctIndex: 0,
          explanation: "कालीबंगा हनुमानगढ़ जिले में घग्घर नदी के किनारे स्थित है।",
          exam: "RAS Pre",
          year: "2021",
          difficulty: "easy",
          isUserAdded: true
        }
      ],
      editedQuestions: {},
      bookmarkedQuestionIds: [],
      wrongQuestionIds: [],
      customChapters: [],
      customTopics: [],
      customSubjects: [],
      deletedQuestionIds: []
    };
  });

  describe("1. MCQ Creation, Upsert & Batching", () => {
    it("1.1 Saves single MCQ to local database and syncs structure", async () => {
      const qId = `q_test_${Date.now()}_single`;
      const singleQ: Question = {
        id: qId,
        subjectId: "sub_raj_hist",
        chapterId: "ch_raj_hist_01",
        topicId: "top_raj_hist_01",
        text: "बिजोलिया किसान आंदोलन के प्रणेता कौन थे?",
        options: ["विजय सिंह पथिक", "साधु सीताराम दास", "माणिक्य लाल वर्मा", "जमनालाल बजाज"],
        correctIndex: 1,
        explanation: "बिजोलिया आंदोलन के प्रारंभिक प्रणेता साधु सीताराम दास थे।",
        exam: "RPSC 2nd Grade",
        year: "2022",
        difficulty: "medium",
        isUserAdded: true
      };

      const res = await upsertQuestionsToSupabase([singleQ]);
      expect(res.success).toBe(true);
      expect(res.count).toBe(1);

      const inDb = await idbGet<Question>(STORES.MCQS, qId);
      expect(inDb).toBeDefined();
      expect(inDb?.id).toBe(qId);
      expect(inDb?.text).toBe(singleQ.text);
      expect(inDb?.options).toEqual(singleQ.options);
      expect(inDb?.correctIndex).toBe(1);

      // Clean up
      await deleteQuestionFromSupabase(qId);
    });

    it("1.2 Supports batch upsert of multiple MCQs (10 items)", async () => {
      const batch: Question[] = Array.from({ length: 10 }, (_, i) => ({
        id: `draft-q-batch-${Date.now()}-${i}`,
        subjectId: "sub_raj_hist",
        chapterId: "ch_raj_hist_01",
        topicId: "top_raj_hist_01",
        text: `Batch MCQ Question ${i + 1}: राजस्थान की प्राचीन सभ्यता`,
        options: ["विकल्प A", "विकल्प B", "विकल्प C", "विकल्प D"],
        correctIndex: i % 4,
        explanation: `Explanation for question ${i + 1}`,
        exam: "RPSC",
        year: "2023",
        difficulty: "medium",
        isUserAdded: true
      }));

      const res = await upsertQuestionsToSupabase(batch);
      expect(res.success).toBe(true);
      expect(res.count).toBe(10);

      const firstInDb = await idbGet<Question>(STORES.MCQS, batch[0].id);
      expect(firstInDb).toBeDefined();
      expect(firstInDb?.id).toBe(batch[0].id);

      // Clean up
      await deleteQuestionsBulkFromSupabase(batch.map((q) => q.id));
    });
  });

  describe("2. Diverse Question Types Representation", () => {
    it("2.1 Correctly formats assertion-reason type questions", async () => {
      const arQId = `draft-q-ar-${Date.now()}`;
      const arQuestion: Question = {
        id: arQId,
        subjectId: "sub_raj_hist",
        chapterId: "ch_raj_hist_01",
        topicId: "top_raj_hist_01",
        questionType: "assertion_reason",
        text: "कथन (A): खानवा के युद्ध में राणा सांगा पराजित हुए। कारण (R): बाबर के पास तोपखाना और तुलुगमा युद्ध नीति थी।",
        assertion: "खानवा के युद्ध में राणा सांगा पराजित हुए।",
        reason: "बाबर के पास तोपखाना और तुलुगमा युद्ध नीति थी।",
        options: [
          "(A) और (R) दोनों सही हैं तथा (R), (A) की सही व्याख्या है।",
          "(A) और (R) दोनों सही हैं लेकिन (R), (A) की सही व्याख्या नहीं है।",
          "(A) सही है लेकिन (R) गलत है।",
          "(A) गलत है लेकिन (R) सही है।"
        ],
        correctIndex: 0,
        explanation: "1527 में खानवा के युद्ध में बाबर की आधुनिक युद्ध तकनीक से सांगा की पराजय हुई।",
        isUserAdded: true
      };

      const res = await upsertQuestionsToSupabase([arQuestion]);
      expect(res.success).toBe(true);

      const inDb = await idbGet<Question>(STORES.MCQS, arQId);
      expect(inDb).toBeDefined();
      expect(inDb?.questionType).toBe("assertion_reason");
      expect(inDb?.assertion).toBeDefined();
      expect(inDb?.reason).toBeDefined();

      await deleteQuestionFromSupabase(arQId);
    });

    it("2.2 Correctly formats match_table type questions", async () => {
      const mtQId = `draft-q-mt-${Date.now()}`;
      const mtQuestion: Question = {
        id: mtQId,
        subjectId: "sub_raj_hist",
        chapterId: "ch_raj_hist_01",
        topicId: "top_raj_hist_01",
        questionType: "match_table",
        text: "सूची-I को सूची-II से सुमेलित कीजिए:",
        matchTable: {
          leftTitle: "सभ्यता",
          rightTitle: "जिला",
          pairs: [
            { left: "कालीबंगा", right: "हनुमानगढ़" },
            { left: "आहाड़", right: "उदयपुर" },
            { left: "गणेश्वर", right: "सीकर (नीम का थाना)" },
            { left: "बैराठ", right: "जयपुर (कोटपूतली)" }
          ]
        },
        options: ["A-1, B-2, C-3, D-4", "A-2, B-1, C-4, D-3", "A-3, B-4, C-1, D-2", "A-4, B-3, C-2, D-1"],
        correctIndex: 0,
        explanation: "सभी पुरातात्विक स्थल सही सुमेलित हैं।",
        isUserAdded: true
      };

      const res = await upsertQuestionsToSupabase([mtQuestion]);
      expect(res.success).toBe(true);

      const inDb = await idbGet<Question>(STORES.MCQS, mtQId);
      expect(inDb).toBeDefined();
      expect(inDb?.questionType).toBe("match_table");
      expect(inDb?.matchTable?.pairs).toHaveLength(4);

      await deleteQuestionFromSupabase(mtQId);
    });
  });

  describe("3. MCQ Editing in Store & Persistence", () => {
    it("3.1 editQuestionInStore updates properties and sets updatedAt timestamp", () => {
      const existingQ = mockStore.customQuestions[0];
      const updatedQ: Question = {
        ...existingQ,
        text: "राजस्थान में कालीबंगा किस जिले में स्थित है? (संशोधित प्रश्न)",
        difficulty: "hard",
        explanation: "कालीबंगा की खोज 1952 में अमलानंद घोष ने की थी।"
      };

      const nextStore = editQuestionInStore(mockStore, updatedQ);
      const editedRecord = nextStore.editedQuestions?.[existingQ.id];

      expect(editedRecord).toBeDefined();
      expect(editedRecord?.text).toBe(updatedQ.text);
      expect(editedRecord?.difficulty).toBe("hard");
      expect(editedRecord?.updatedAt).toBeDefined();
    });
  });

  describe("4. MCQ Deletion & Bulk Move Actions", () => {
    it("4.1 bulkDeleteQuestions removes question from customQuestions and records in deletedQuestionIds", () => {
      const qId = "q_mcq_test_01";
      const nextStore = bulkDeleteQuestions(mockStore, [qId]);

      expect(nextStore.customQuestions?.find((q) => q.id === qId)).toBeUndefined();
      expect(nextStore.deletedQuestionIds).toContain(qId);
    });

    it("4.2 bulkMoveQuestions migrates target questions to new chapter and topic", () => {
      const qId = "q_mcq_test_01";
      const qMap = { [qId]: mockStore.customQuestions[0] };
      const nextStore = bulkMoveQuestions(
        mockStore,
        [qId],
        "ch_target_chapter",
        "top_target_topic",
        qMap,
        "sub_target_subject"
      );

      const movedQ = nextStore.customQuestions?.find((q) => q.id === qId);
      expect(movedQ?.chapterId).toBe("ch_target_chapter");
      expect(movedQ?.topicId).toBe("top_target_topic");
      expect(movedQ?.subjectId).toBe("sub_target_subject");
    });
  });

  describe("5. MCQ Hashing & Duplicate Detection", () => {
    it("5.1 Generates deterministic hash across identical question content", () => {
      const hash1 = generateQuestionHash({
        question: "राजस्थान का राज्य पुष्प क्या है?",
        options: ["रोहिड़ा", "गुलाब", "कमल", "सूरजमुखी"],
        answer: "A"
      });

      const hash2 = generateQuestionHash({
        question: "  राजस्थान का राज्य पुष्प क्या है?  ",
        options: ["रोहिड़ा", "गुलाब", "कमल", "सूरजमुखी"],
        answer: "A"
      });

      expect(hash1).toBe(hash2);
      expect(typeof hash1).toBe("string");
      expect(hash1.length).toBeGreaterThan(0);
    });

    it("5.2 Generates different hash for differing question texts", () => {
      const hash1 = generateQuestionHash({
        question: "राजस्थान का राज्य पुष्प क्या है?",
        options: ["रोहिड़ा", "गुलाब", "कमल", "सूरजमुखी"],
        answer: "A"
      });

      const hash2 = generateQuestionHash({
        question: "राजस्थान का राज्य पक्षी क्या है?",
        options: ["गोडावण", "मोर", "तोता", "कबूतर"],
        answer: "A"
      });

      expect(hash1).not.toBe(hash2);
    });
  });

  describe("6. Production Data Preservation & Non-Interference", () => {
    it("6.1 Production pilot questions (q_pilot_001 to q_pilot_010) are NEVER deleted or modified", async () => {
      // In Supabase, the 10 pilot questions must remain verified
      const { supabase } = await import("../src/lib/supabase");
      const { data, error } = await supabase.from("questions").select("id").like("id", "q_pilot_%");

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data?.length).toBe(10);
    });
  });
});
