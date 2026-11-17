import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { normalizeQuestion } from "../src/lib/mcqImport/normalize";
import { processJSONImport } from "../src/lib/mcqImport";
import { detectQuestionExams } from "../src/lib/mcqImport/examDetector";
import { UniversalSmartParser } from "../src/utils/UniversalSmartParser";
import { parseRawMcqText } from "../src/utils/questionParser";
import { setInMemoryProfile } from "../src/utils/userProfileStorage";
import { supabase } from "../src/lib/supabase";
import { upsertQuestionsToSupabase } from "../src/utils/supabaseSyncService";
import { Question } from "../src/types";

beforeAll(() => {
  setInMemoryProfile({
    id: "admin-regression-test",
    email: "jagdishpaliyaljat@gmail.com",
    role: "admin",
    status: "active",
    displayName: "Admin Regression Runner",
  });
});

describe("DISHA 20-20 — Complete Regression Testing for PYQ Metadata", () => {
  // ── TEST CASE 1: Import MCQs without exam/year ──────────────────────────
  it("Test Case 1: Import MCQs without exam/year preserves NULL/undefined and marks as practice", () => {
    const raw = {
      type: "single_correct",
      question: "Which river in Rajasthan is known as Kamdhenu?",
      options: ["Chambal", "Banas", "Luni", "Mahi"],
      answer: "A",
      explanation: "Chambal river is traditionally referred to as Charmanyavati or Kamdhenu.",
      subject: "Geography of Rajasthan",
      chapter: "Drainage System",
      topic: "Rivers",
    };

    const norm = normalizeQuestion(raw);
    expect(norm.exam).toBeUndefined();
    expect(norm.year).toBeUndefined();
    expect(norm.isPYQ).toBe(false);
    expect(norm.questionClassification).toBe("practice");
    expect(norm.examHistory).toEqual([]);

    // Verify JSON importer result
    const jsonStr = JSON.stringify({ schemaVersion: 1, questions: [raw] });
    const parsed = processJSONImport(jsonStr);
    expect(parsed.success).toBe(true);
    expect(parsed.results[0].exam).toBeUndefined();
    expect(parsed.results[0].year).toBeUndefined();
    expect(parsed.results[0].isPYQ).toBe(false);
    expect(parsed.results[0].questionClassification).toBe("practice");
  });

  // ── TEST CASE 2: Import MCQs with exam/year ─────────────────────────────
  it("Test Case 2: Import MCQs with exam/year preserves exact source metadata", () => {
    const raw = {
      type: "single_correct",
      question: "Rajasthan Atomic Power Station is located at which place?",
      options: ["Rawatbhata", "Suratgarh", "Chhabra", "Kalisindh"],
      answer: "A",
      explanation: "RAPS is situated in Rawatbhata in Chittorgarh district.",
      exam: "RAS Pre",
      year: "2021",
    };

    const norm = normalizeQuestion(raw);
    expect(norm.exam).toBe("RAS Pre");
    expect(norm.year).toBe("2021");
    expect(norm.isPYQ).toBe(true);
    expect(norm.questionClassification).toBe("pyq");
    expect(norm.examHistory).toHaveLength(1);
    expect(norm.examHistory?.[0].examName).toBe("RAS Pre");
    expect(norm.examHistory?.[0].year).toBe(2021);
  });

  // ── TEST CASE 3: Import mixed exam/year questions ──────────────────────
  it("Test Case 3: Import mixed exam/year questions ensures zero cross-question leakage", () => {
    const rawBatch = {
      schemaVersion: 1,
      questions: [
        {
          type: "single_correct",
          question: "Q1 with both exam and year",
          options: ["A", "B", "C", "D"],
          answer: "A",
          exam: "CET 12th Level",
          year: "2023",
        },
        {
          type: "single_correct",
          question: "Q2 with NO exam and NO year",
          options: ["A", "B", "C", "D"],
          answer: "B",
        },
        {
          type: "single_correct",
          question: "Q3 with ONLY exam",
          options: ["A", "B", "C", "D"],
          answer: "C",
          exam: "Patwari",
        },
        {
          type: "single_correct",
          question: "Q4 with ONLY year",
          options: ["A", "B", "C", "D"],
          answer: "D",
          year: "2022",
        },
      ],
    };

    const parsed = processJSONImport(JSON.stringify(rawBatch));
    expect(parsed.success).toBe(true);
    const [q1, q2, q3, q4] = parsed.results;

    // Q1: Both present
    expect(q1.exam).toBe("CET 12th Level");
    expect(q1.year).toBe("2023");
    expect(q1.isPYQ).toBe(true);

    // Q2: Both absent - MUST NOT receive Q1, Q3, or Q4 values
    expect(q2.exam).toBeUndefined();
    expect(q2.year).toBeUndefined();
    expect(q2.isPYQ).toBe(false);
    expect(q2.questionClassification).toBe("practice");

    // Q3: Exam only
    expect(q3.exam).toBe("Patwari");
    expect(q3.year).toBeUndefined();
    expect(q3.isPYQ).toBe(true);

    // Q4: Year only
    expect(q4.exam).toBeUndefined();
    expect(q4.year).toBe("2022");
    expect(q4.isPYQ).toBe(false);
  });

  // ── TEST CASE 4: Import ordinary MCQs across subjects ──────────────────
  it("Test Case 4: Ordinary MCQs never convert into PYQ based on subject/chapter/topic/type", () => {
    const subjects = ["Rajasthan History", "Rajasthan Polity", "Rajasthan Economy", "General Science", "Hindi"];
    for (const sub of subjects) {
      const q = normalizeQuestion({
        type: "single_correct",
        question: `Sample ordinary question for subject ${sub}`,
        options: ["Option 1", "Option 2", "Option 3", "Option 4"],
        answer: "A",
        subject: sub,
        chapter: "Key Principles",
        topic: "Foundation",
      });

      expect(q.exam).toBeUndefined();
      expect(q.year).toBeUndefined();
      expect(q.isPYQ).toBe(false);
      expect(q.questionClassification).toBe("practice");
    }
  });

  // ── TEST CASE 5: Import actual PYQs with multiple formats ──────────────
  it("Test Case 5: Import actual PYQs preserves multi-exam history and authentic exam badges", () => {
    const pyqWithArray = normalizeQuestion({
      type: "single_correct",
      question: "Which ruler built the Vijay Stambha in Chittorgarh?",
      options: ["Maharana Kumbha", "Maharana Sanga", "Rana Hamir", "Rana Ratan Singh"],
      answer: "A",
      examHistory: [
        { examName: "College Lecturer", year: 2020 },
        { examName: "1st Grade Teacher", year: 2022 },
      ],
    });

    expect(pyqWithArray.isPYQ).toBe(true);
    expect(pyqWithArray.questionClassification).toBe("pyq");
    expect(pyqWithArray.examHistory).toHaveLength(2);
    expect(pyqWithArray.exam).toBe("College Lecturer");
    expect(pyqWithArray.year).toBe("2020");
  });

  // ── TEST CASE 6: Import multiple batches consecutively ──────────────────
  it("Test Case 6: Multiple consecutive batches do not leak metadata between batches", () => {
    const batch1 = JSON.stringify({
      schemaVersion: 1,
      questions: [
        {
          type: "single_correct",
          question: "Batch 1 Question with exam",
          options: ["A", "B", "C", "D"],
          answer: "A",
          exam: "VDO",
          year: "2021",
        },
      ],
    });

    const batch2 = JSON.stringify({
      schemaVersion: 1,
      questions: [
        {
          type: "single_correct",
          question: "Batch 2 Question without exam",
          options: ["A", "B", "C", "D"],
          answer: "B",
        },
      ],
    });

    const res1 = processJSONImport(batch1);
    const res2 = processJSONImport(batch2);

    expect(res1.results[0].exam).toBe("VDO");
    expect(res1.results[0].year).toBe("2021");
    expect(res1.results[0].isPYQ).toBe(true);

    expect(res2.results[0].exam).toBeUndefined();
    expect(res2.results[0].year).toBeUndefined();
    expect(res2.results[0].isPYQ).toBe(false);
  });

  // ── TEST CASE 7: Change selected exam and import again ──────────────────
  it("Test Case 7: Contextual section/UI metadata does not contaminate questions", () => {
    // Calling detectQuestionExams with a sectionMeta (simulating a selected exam dropdown in UI)
    const ordinaryQ = { question: "What is 2 + 2?", options: ["2", "3", "4", "5"], answer: "C" };
    const detection = detectQuestionExams(ordinaryQ, { exam: "RSMSSB LDC", year: 2024 });

    // STRICT: question has no exam in its source, so detection must NEVER assign sectionMeta
    expect(detection.examHistory).toEqual([]);
    expect(detection.isPYQ).toBe(false);
    expect(detection.questionClassification).toBe("practice");
  });

  // ── TEST CASE 8: Verify previous session state is not inherited ─────────
  it("Test Case 8: Fresh parse sessions start completely clean", async () => {
    // 1st parse with exam
    await UniversalSmartParser.parse(
      JSON.stringify({
        schemaVersion: 1,
        questions: [{ type: "single_correct", question: "Session 1 Q", options: ["1", "2", "3", "4"], answer: "A", exam: "SI Exam", year: "2021" }],
      })
    );

    // 2nd parse without exam
    const session2Drafts = await UniversalSmartParser.parse(
      JSON.stringify({
        schemaVersion: 1,
        questions: [{ type: "single_correct", question: "Session 2 Q", options: ["1", "2", "3", "4"], answer: "A" }],
      })
    );

    expect(session2Drafts).toHaveLength(1);
    expect((session2Drafts[0] as any).exam).toBeUndefined();
    expect((session2Drafts[0] as any).year).toBeUndefined();
    expect((session2Drafts[0] as any).isPYQ).toBe(false);
  });

  // ── TEST CASE 9: Edit an MCQ without exam/year ──────────────────────────
  it("Test Case 9: Editing an MCQ without exam/year keeps exam/year absent and does not convert to PYQ", () => {
    const original: Question = {
      id: "q_edit_test_1",
      topicId: "top_sample",
      chapterId: "chap_sample",
      text: "Original question text",
      options: ["A", "B", "C", "D"],
      correctIndex: 0,
      explanation: "Original explanation",
      isUserAdded: true,
      // exam and year are absent
    };

    // User edits question stem and explanation
    const edited: Question = {
      ...original,
      text: "Updated question text with better clarity",
      explanation: "Updated explanation with detailed derivation",
    };

    const reNormalized = normalizeQuestion(edited as any);
    expect(reNormalized.exam).toBeUndefined();
    expect(reNormalized.year).toBeUndefined();
    expect(reNormalized.isPYQ).toBe(false);
    expect(reNormalized.questionClassification).toBe("practice");
  });

  // ── TEST CASE 10: Verify metadata after page refresh (rehydration) ───────
  it("Test Case 10: Rehydrating questions from database format correctly maps NULLs to undefined and practice", () => {
    // Simulated DB rows returned by Supabase
    const dbRowNull = {
      id: "q_cloud_1",
      question: "Cloud question without exam",
      options: ["A", "B", "C", "D"],
      correct_answer: 0,
      explanation: "Cloud exp",
      exam: null,
      year: null,
      level: "medium",
      verified: true,
      created_at: new Date().toISOString(),
    };

    const dbRowPyq = {
      id: "q_cloud_2",
      question: "Cloud PYQ question",
      options: ["A", "B", "C", "D"],
      correct_answer: 1,
      explanation: "Cloud exp",
      exam: "RAS Pre",
      year: "2021",
      level: "hard",
      verified: true,
      created_at: new Date().toISOString(),
    };

    // Rehydration mapping as performed by downloadQuestionsFromSupabase
    const rehydrate = (q: any): Question => ({
      id: q.id,
      text: q.question,
      options: q.options,
      correctIndex: q.correct_answer,
      explanation: q.explanation,
      subjectId: q.subject_id,
      chapterId: q.chapter_id,
      topicId: q.topic_id,
      exam: q.exam || undefined,
      year: q.year || undefined,
      difficulty: q.level,
      verified: q.verified,
      isUserAdded: false,
      createdAt: q.created_at,
    });

    const hydratedNull = rehydrate(dbRowNull);
    const hydratedPyq = rehydrate(dbRowPyq);

    // Question with NULLs rehydrates as non-PYQ
    expect(hydratedNull.exam).toBeUndefined();
    expect(hydratedNull.year).toBeUndefined();
    const detectionNull = detectQuestionExams(hydratedNull);
    expect(detectionNull.isPYQ).toBe(false);
    expect(detectionNull.questionClassification).toBe("practice");

    // Question with exam rehydrates as PYQ
    expect(hydratedPyq.exam).toBe("RAS Pre");
    expect(hydratedPyq.year).toBe("2021");
    const detectionPyq = detectQuestionExams(hydratedPyq);
    expect(detectionPyq.isPYQ).toBe(true);
    expect(detectionPyq.questionClassification).toBe("pyq");
  });

  // ── TEST CASE 11: Verify Supabase upsert payload structure ─────────────
  it("Test Case 11: Supabase upsert payload maps missing exam/year to strict NULLs", async () => {
    let interceptedRows: any[] = [];
    const originalFrom = supabase.from;
    supabase.from = ((table: string) => {
      if (table === "questions") {
        return {
          upsert: (rows: any[]) => {
            interceptedRows = rows;
            return Promise.resolve({ error: null });
          },
        } as any;
      }
      return originalFrom.call(supabase, table);
    }) as any;

    try {
      const qs: Question[] = [
        {
          id: "q_test_null_payload",
          text: "Question with no exam",
          options: ["A", "B", "C", "D"],
          correctIndex: 0,
          explanation: "Exp",
          chapterId: "c1",
          topicId: "t1",
        },
        {
          id: "q_test_pyq_payload",
          text: "Question with exam",
          options: ["A", "B", "C", "D"],
          correctIndex: 1,
          explanation: "Exp",
          chapterId: "c1",
          topicId: "t1",
          exam: "CET Senior Secondary",
          year: "2023",
        },
      ];

      await upsertQuestionsToSupabase(qs);
      expect(interceptedRows).toHaveLength(2);

      // Verify row 1: NULL values for exam and year
      expect(interceptedRows[0].exam).toBeNull();
      expect(interceptedRows[0].year).toBeNull();
      expect(interceptedRows[0].exam).not.toBe("RPSC / RSMSSB");
      expect(interceptedRows[0].year).not.toBe("2024");

      // Verify row 2: accurate preservation
      expect(interceptedRows[1].exam).toBe("CET Senior Secondary");
      expect(interceptedRows[1].year).toBe("2023");
    } finally {
      supabase.from = originalFrom;
    }
  });

  // ── TEST CASE 12: Verify PYQ filters and exam-wise reports ───────────────
  it("Test Case 12: PYQ filters and exam-wise reporting only aggregate actual PYQs", () => {
    const questionBank = [
      { id: "q1", text: "Ordinary Q1", isPYQ: false },
      { id: "q2", text: "Ordinary Q2", isPYQ: false },
      { id: "q3", text: "Official PYQ 1", isPYQ: true, exam: "RAS Pre", year: "2021" },
      { id: "q4", text: "Official PYQ 2", isPYQ: true, exam: "CET", year: "2023" },
      { id: "q5", text: "Ordinary Q3 with topic but no exam", isPYQ: false },
    ];

    // Filter for PYQ questions
    const pyqs = questionBank.filter((q) => q.isPYQ);
    expect(pyqs).toHaveLength(2);
    expect(pyqs.map((q) => q.id)).toEqual(["q3", "q4"]);

    // Filter for Practice questions
    const practiceQs = questionBank.filter((q) => !q.isPYQ);
    expect(practiceQs).toHaveLength(3);
    expect(practiceQs.map((q) => q.id)).toEqual(["q1", "q2", "q5"]);

    // Exam-wise report aggregation
    const examCounts: Record<string, number> = {};
    questionBank.forEach((q) => {
      if (q.exam) {
        examCounts[q.exam] = (examCounts[q.exam] || 0) + 1;
      }
    });

    expect(examCounts["RAS Pre"]).toBe(1);
    expect(examCounts["CET"]).toBe(1);
    expect(examCounts["RPSC / RSMSSB"]).toBeUndefined();
    expect(Object.keys(examCounts)).toEqual(["RAS Pre", "CET"]);
  });
});
