import { describe, it, expect, beforeAll } from "vitest";
import { normalizeQuestion } from "../src/lib/mcqImport/normalize";
import { processJSONImport } from "../src/lib/mcqImport";
import { detectQuestionExams } from "../src/lib/mcqImport/examDetector";
import { UniversalSmartParser } from "../src/utils/UniversalSmartParser";
import { parseRawMcqText } from "../src/utils/questionParser";
import { setInMemoryProfile } from "../src/utils/userProfileStorage";

beforeAll(() => {
  setInMemoryProfile({
    id: "admin-pyq-test",
    email: "jagdishpaliyaljat@gmail.com",
    role: "admin",
    status: "active",
    displayName: "Admin Test",
  });
});

describe("DISHA 20-20 — AI MCQ Import & PYQ Metadata Strict Rules", () => {
  it("Rule 1, 2, 5: Question without exam/year has undefined exam/year and is NOT a PYQ", () => {
    const raw = {
      type: "single_correct",
      question: "What is the capital of Rajasthan?",
      options: ["Jaipur", "Jodhpur", "Udaipur", "Kota"],
      answer: "A",
      explanation: "Jaipur is known as the Pink City and is the capital of Rajasthan.",
      subject: "Rajasthan GK",
      chapter: "Geography",
      topic: "Administrative Setup",
    };

    const normalized = normalizeQuestion(raw);

    // Strict verification:
    expect(normalized.exam).toBeUndefined();
    expect(normalized.year).toBeUndefined();
    expect(normalized.isPYQ).toBe(false);
    expect(normalized.questionClassification).toBe("practice");
    expect(normalized.examHistory).toEqual([]);
  });

  it("Rule 6: Ordinary MCQs are NEVER automatically converted to PYQ based on subject, chapter, topic, or questionType", () => {
    const types = ["single_correct", "statement_based", "assertion_reason", "match_list", "math"];
    for (const t of types) {
      const normalized = normalizeQuestion({
        type: t,
        question: `Question of type ${t}`,
        options: ["A", "B", "C", "D"],
        answer: "A",
        subject: "Rajasthan Economy",
        chapter: "Economic Survey",
        topic: "State GDP",
      });

      expect(normalized.exam).toBeUndefined();
      expect(normalized.year).toBeUndefined();
      expect(normalized.isPYQ).toBe(false);
      expect(normalized.questionClassification).toBe("practice");
    }
  });

  it("Question-Level Metadata: Preserves exam if present, keeps year undefined if missing", () => {
    const normalized = normalizeQuestion({
      type: "single_correct",
      question: "Which battle was fought in 1576?",
      options: ["Haldighati", "Tarain", "Khanwa", "Panipat"],
      answer: "A",
      exam: "RAS Pre",
      // year is omitted
    });

    expect(normalized.exam).toBe("RAS Pre");
    expect(normalized.year).toBeUndefined();
    expect(normalized.isPYQ).toBe(true);
    expect(normalized.questionClassification).toBe("pyq");
  });

  it("Question-Level Metadata: Preserves year if present, keeps exam undefined if missing", () => {
    const normalized = normalizeQuestion({
      type: "single_correct",
      question: "Sample practice question from 2023 revision sheet",
      options: ["1", "2", "3", "4"],
      answer: "A",
      year: "2023",
      // exam is omitted
    });

    expect(normalized.exam).toBeUndefined();
    expect(normalized.year).toBe("2023");
    // Without an exam name, it is an ordinary practice question with a year annotation, not an official PYQ
    expect(normalized.isPYQ).toBe(false);
    expect(normalized.questionClassification).toBe("practice");
  });

  it("Question-Level Metadata: Preserves both exam and year when both are provided", () => {
    const normalized = normalizeQuestion({
      type: "single_correct",
      question: "Question with both exam and year",
      options: ["A", "B", "C", "D"],
      answer: "B",
      exam: "CET 12th Level",
      year: "2023",
    });

    expect(normalized.exam).toBe("CET 12th Level");
    expect(normalized.year).toBe("2023");
    expect(normalized.isPYQ).toBe(true);
    expect(normalized.questionClassification).toBe("pyq");
    expect(normalized.examHistory).toHaveLength(1);
    expect(normalized.examHistory?.[0].examName).toBe("CET 12th Level");
    expect(normalized.examHistory?.[0].year).toBe(2023);
  });

  it("Rule 3 & 4: Independent metadata per question in a mixed JSON batch (No cross-question leakage)", () => {
    const jsonString = JSON.stringify({
      schemaVersion: 1,
      questions: [
        {
          type: "single_correct",
          question: "Q1 with PYQ metadata",
          options: ["1", "2", "3", "4"],
          answer: "A",
          exam: "Patwari",
          year: "2021",
        },
        {
          type: "single_correct",
          question: "Q2 pure practice question with NO exam and NO year",
          options: ["1", "2", "3", "4"],
          answer: "B",
        },
        {
          type: "single_correct",
          question: "Q3 with only exam",
          options: ["1", "2", "3", "4"],
          answer: "C",
          exam: "VDO",
        },
        {
          type: "single_correct",
          question: "Q4 with only year",
          options: ["1", "2", "3", "4"],
          answer: "D",
          year: 2022,
        },
      ],
    });

    const parsed = processJSONImport(jsonString);
    expect(parsed.success).toBe(true);
    expect(parsed.results).toHaveLength(4);

    const [q1, q2, q3, q4] = parsed.results;

    // Q1: has both
    expect(q1.exam).toBe("Patwari");
    expect(q1.year).toBe("2021");
    expect(q1.isPYQ).toBe(true);
    expect(q1.questionClassification).toBe("pyq");

    // Q2: MUST NOT inherit from Q1 or defaults!
    expect(q2.exam).toBeUndefined();
    expect(q2.year).toBeUndefined();
    expect(q2.isPYQ).toBe(false);
    expect(q2.questionClassification).toBe("practice");

    // Q3: has only exam
    expect(q3.exam).toBe("VDO");
    expect(q3.year).toBeUndefined();
    expect(q3.isPYQ).toBe(true);

    // Q4: has only year
    expect(q4.exam).toBeUndefined();
    expect(q4.year).toBe("2022");
    expect(q4.isPYQ).toBe(false);
  });

  it("Rule 3: detectQuestionExams NEVER assigns sectionMeta fallback to questions lacking exam/year", () => {
    const detectionWithoutExam = detectQuestionExams(
      { question: "Ordinary Question" },
      { exam: "Global Default Exam", year: "2024" }
    );

    expect(detectionWithoutExam.examHistory).toEqual([]);
    expect(detectionWithoutExam.isPYQ).toBe(false);
    expect(detectionWithoutExam.questionClassification).toBe("practice");
  });

  it("UniversalSmartParser.parseJSON cleanly keeps exam/year independent and undefined when missing", async () => {
    const input = JSON.stringify({
      schemaVersion: 1,
      questions: [
        {
          type: "single_correct",
          question: "Standard test question without exam",
          options: ["A", "B", "C", "D"],
          answer: "A",
        },
      ],
    });

    const drafts = await UniversalSmartParser.parse(input);
    expect(drafts).toHaveLength(1);
    expect((drafts[0] as any).exam).toBeUndefined();
    expect((drafts[0] as any).year).toBeUndefined();
    expect((drafts[0] as any).isPYQ).toBe(false);
    expect((drafts[0] as any).questionClassification).toBe("practice");
  });

  it("Text Parser (parseRawMcqText): Does NOT bleed global EXAM/YEAR headers into questions", () => {
    const rawText = `
EXAM: Global Exam Header
YEAR: 2025

Q1. First question text here
A. Option 1
B. Option 2
C. Option 3
D. Option 4
Answer: A

Q2. Second question text here
A. Option 1
B. Option 2
C. Option 3
D. Option 4
Answer: B
Exam: Specific Exam 2
Year: 2022
`;

    const { questions } = parseRawMcqText(rawText);
    expect(questions).toHaveLength(2);

    // Q1 had no question-level exam, so it must NOT inherit the global header!
    expect(questions[0].examHistory).toEqual([]);
    expect(questions[0].isPYQ).toBe(false);
    expect(questions[0].questionClassification).toBe("practice");

    // Q2 had its own specific exam, so it gets it
    expect(questions[1].examHistory).toHaveLength(1);
    expect(questions[1].examHistory[0].examName).toBe("Specific Exam 2");
    expect(questions[1].examHistory[0].year).toBe(2022);
    expect(questions[1].isPYQ).toBe(true);
    expect(questions[1].questionClassification).toBe("pyq");
  });

  it("Supabase Payload: Never sends default 'RPSC / RSMSSB' or '2024' when exam/year are missing", async () => {
    const { supabase } = await import("../src/lib/supabase");
    const { upsertQuestionsToSupabase } = await import("../src/utils/supabaseSyncService");

    let capturedRows: any[] = [];
    const origFrom = supabase.from;
    // Intercept supabase.from("questions").upsert
    supabase.from = ((table: string) => {
      if (table === "questions") {
        return {
          upsert: (rows: any[]) => {
            capturedRows = rows;
            return Promise.resolve({ error: null });
          },
        } as any;
      }
      return origFrom.call(supabase, table);
    }) as any;

    try {
      const testQs: any[] = [
        {
          id: "q-ordinary-1",
          text: "Ordinary Question without exam or year",
          options: ["A", "B", "C", "D"],
          correctIndex: 0,
          explanation: "Some explanation",
        },
        {
          id: "q-pyq-2",
          text: "Official PYQ Question",
          options: ["A", "B", "C", "D"],
          correctIndex: 1,
          explanation: "Some explanation",
          exam: "CET Senior Secondary",
          year: "2023",
        },
        {
          id: "q-exam-only-3",
          text: "Question with only exam",
          options: ["A", "B", "C", "D"],
          correctIndex: 2,
          explanation: "Some explanation",
          exam: "RAS Pre",
        },
        {
          id: "q-year-only-4",
          text: "Question with only year",
          options: ["A", "B", "C", "D"],
          correctIndex: 3,
          explanation: "Some explanation",
          year: "2022",
        },
      ];

      const res = await upsertQuestionsToSupabase(testQs);
      expect(res.success).toBe(true);
      expect(capturedRows).toHaveLength(4);

      // Row 1: ordinary -> BOTH exam and year MUST BE NULL, NEVER hardcoded defaults!
      expect(capturedRows[0].exam).toBeNull();
      expect(capturedRows[0].year).toBeNull();
      expect(capturedRows[0].exam).not.toBe("RPSC / RSMSSB");
      expect(capturedRows[0].year).not.toBe("2024");

      // Row 2: PYQ -> preserves exact exam and year
      expect(capturedRows[1].exam).toBe("CET Senior Secondary");
      expect(capturedRows[1].year).toBe("2023");

      // Row 3: exam only -> exam preserved, year IS NULL
      expect(capturedRows[2].exam).toBe("RAS Pre");
      expect(capturedRows[2].year).toBeNull();

      // Row 4: year only -> exam IS NULL, year preserved
      expect(capturedRows[3].exam).toBeNull();
      expect(capturedRows[3].year).toBe("2022");
    } finally {
      supabase.from = origFrom;
    }
  });
});
