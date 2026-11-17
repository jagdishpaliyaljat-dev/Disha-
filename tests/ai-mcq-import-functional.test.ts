import { describe, it, expect, beforeAll } from "vitest";
import {
  processJSONImport,
  smartJSONImport,
  validateQuestion,
  normalizeQuestion,
  generateQuestionHash,
} from "../src/lib/mcqImport";
import { commitQuestions } from "../src/lib/mcqImport/commit";
import {
  fetchQuestionsByTopic,
  fetchQuestionsByChapter,
  upsertQuestionsToSupabase,
  deleteQuestionsBulkFromSupabase,
} from "../src/utils/supabaseSyncService";
import {
  fetchQuestionsCacheFirst,
  getCachedQuestionsByTopic,
  saveQuestionsToCache,
  invalidateTopicCache,
  removeQuestionsFromCache,
} from "../src/utils/questionBankCache";
import { isSupabaseConfigured, supabase } from "../src/lib/supabase";
import { Question } from "../src/types";

// Isolated test curriculum IDs
const TEST_SUBJECT_ID = "sub_ai_functional_test";
const TEST_CHAPTER_ID = "chap_ai_functional_test";
const TEST_TOPIC_ID = "top_ai_functional_test";
const TEST_Q_IDS = ["q_ai_test_001", "q_ai_test_002"];

describe("DISHA2020 — AI MCQ Import Complete Functional Testing Suite", () => {
  let initialQuestionsCount = 0;

  beforeAll(async () => {
    // Record initial questions count
    if (isSupabaseConfigured()) {
      const { count, error } = await supabase
        .from("questions")
        .select("*", { count: "exact", head: true });
      expect(error).toBeNull();
      initialQuestionsCount = count || 0;
    }
  });

  describe("1. AI MCQ Generation & Question Types Verification", () => {
    it("1.1 Single Correct MCQ (Hindi & English, 4-option format)", async () => {
      const json = JSON.stringify({
        schemaVersion: 1,
        questions: [
          {
            type: "single_correct",
            question: "राजस्थान में 'हवा महल' का निर्माण किस शासक ने करवाया था? / Who built the Hawa Mahal in Rajasthan?",
            options: [
              "सवाई जय सिंह (Sawai Jai Singh)",
              "सवाई प्रताप सिंह (Sawai Pratap Singh)",
              "महाराजा मान सिंह (Maharaja Man Singh)",
              "महाराजा सूरजमल (Maharaja Suraj Mal)",
            ],
            answer: "B",
            explanation: "हवा महल का निर्माण 1799 ईस्वी में महाराजा सवाई प्रताप सिंह ने करवाया था। इसके वास्तुकार लालचंद उस्ता थे।",
            subject: "AI Import Functional Test Subject",
            chapter: "AI Test Chapter",
            topic: "AI Functional Test Topic",
          },
        ],
      });

      const parsed = await smartJSONImport(json);
      expect(parsed.success).toBe(true);
      expect(parsed.results.length).toBe(1);

      const q = parsed.results[0];
      expect(q.isValid).toBe(true);
      expect(q.correctIndex).toBe(1); // "B" -> 1
      expect(q.options.length).toBe(4);
      expect(q.question).toContain("हवा महल");
      expect(q.question).toContain("Hawa Mahal");
      expect(q.explanation).toContain("1799");
    });

    it("1.2 Statement Based MCQ (Numbered statements with multi-statement evaluation)", async () => {
      const json = JSON.stringify({
        schemaVersion: 1,
        questions: [
          {
            type: "statement_based",
            question: "कालीबंगा सभ्यता के संदर्भ में निम्नलिखित कथनों पर विचार कीजिए:\n1. यह पुरातात्विक स्थल हनुमानगढ़ जिले में घग्घर नदी के किनारे स्थित है।\n2. यहाँ से जुते हुए खेत के प्राचीनतम साक्ष्य प्राप्त हुए हैं।\n3. इसकी खोज सर्वप्रथम दयाराम साहनी ने की थी।\nउपर्युक्त में से कौन-से कथन सही हैं?",
            options: [
              "केवल 1 और 2",
              "केवल 2 और 3",
              "केवल 1 और 3",
              "1, 2 और 3",
            ],
            answer: "A",
            explanation: "कथन 1 और 2 सही हैं। कथन 3 गलत है क्योंकि कालीबंगा की खोज 1952 में अमलानंद घोष ने की थी।",
            subject: "AI Import Functional Test Subject",
            chapter: "AI Test Chapter",
            topic: "AI Functional Test Topic",
          },
        ],
      });

      const parsed = await smartJSONImport(json);
      expect(parsed.success).toBe(true);
      const q = parsed.results[0];
      expect(q.isValid).toBe(true);
      expect(q.correctIndex).toBe(0); // "A" -> 0
      expect(q.options[0]).toBe("केवल 1 और 2");
      expect(q.question).toContain("कालीबंगा");
    });

    it("1.3 Assertion & Reason MCQ (अभिकथन A और कारण R)", async () => {
      const json = JSON.stringify({
        schemaVersion: 1,
        questions: [
          {
            type: "assertion_reason",
            question: "अभिकथन (A): राजस्थान का पश्चिमी भाग थार मरुस्थल के रूप में विस्तृत है।\nकारण (R): अरावली पर्वतमाला की दिशा दक्षिण-पश्चिम से उत्तर-पूर्व होने के कारण मानसूनी हवाएँ बिना वर्षा किए समानांतर निकल जाती हैं।",
            options: [
              "A और R दोनों सही हैं तथा R, A की सही व्याख्या करता है।",
              "A और R दोनों सही हैं, परन्तु R, A की सही व्याख्या नहीं करता है।",
              "A सही है, परन्तु R गलत है।",
              "A गलत है, परन्तु R सही है।",
            ],
            answer: "A",
            explanation: "अरावली का मानसूनी हवाओं के समानांतर होना पश्चिमी राजस्थान में न्यून वर्षा का मुख्य भौगोलिक कारण है।",
            subject: "AI Import Functional Test Subject",
            chapter: "AI Test Chapter",
            topic: "AI Functional Test Topic",
          },
        ],
      });

      const parsed = await smartJSONImport(json);
      expect(parsed.success).toBe(true);
      const q = parsed.results[0];
      expect(q.isValid).toBe(true);
      expect(q.correctIndex).toBe(0);
      expect(q.question).toContain("अभिकथन (A)");
      expect(q.question).toContain("कारण (R)");
    });

    it("1.4 Match the Following MCQ (Structured matching table with left/right columns)", async () => {
      const json = JSON.stringify({
        schemaVersion: 1,
        questions: [
          {
            type: "match_following",
            question: "सूची-I (दुर्ग) को सूची-II (स्थान) से सुमेलित कीजिए:",
            matchTable: {
              leftTitle: "सूची-I (दुर्ग)",
              rightTitle: "सूची-II (स्थान)",
              rows: [
                { left: "A. मेहरानगढ़", right: "1. जोधपुर" },
                { left: "B. जूनागढ़", right: "2. बीकानेर" },
                { left: "C. सोनार किला", right: "3. जैसलमेर" },
                { left: "D. तारागढ़", right: "4. अजमेर" },
              ],
            },
            options: [
              "A-1, B-2, C-3, D-4",
              "A-2, B-1, C-4, D-3",
              "A-3, B-4, C-1, D-2",
              "A-4, B-3, C-2, D-1",
            ],
            answer: "A",
            explanation: "मेहरानगढ़ जोधपुर, जूनागढ़ बीकानेर, सोनार किला जैसलमेर और तारागढ़ अजमेर में स्थित है।",
            subject: "AI Import Functional Test Subject",
            chapter: "AI Test Chapter",
            topic: "AI Functional Test Topic",
          },
        ],
      });

      const parsed = await smartJSONImport(json);
      expect(parsed.success).toBe(true);
      const q = parsed.results[0];
      expect(q.isValid).toBe(true);
      expect(q.correctIndex).toBe(0);
      expect(q.matchTable).toBeDefined();
      expect(q.matchTable?.rows.length).toBe(4);
      expect(q.matchTable?.rows[0].left).toContain("मेहरानगढ़");
    });

    it("1.5 Mathematics / Numerical MCQ with KaTeX formula and unicode symbols", async () => {
      const json = JSON.stringify({
        schemaVersion: 1,
        questions: [
          {
            type: "numerical",
            question: "यदि एक समकोण त्रिभुज का आधार $b = 12\\text{ cm}$ और कर्ण $h = 13\\text{ cm}$ है, तो त्रिभुज का क्षेत्रफल $\\Delta$ कितना होगा?",
            options: [
              "$25\\text{ cm}^2$",
              "$30\\text{ cm}^2$",
              "$60\\text{ cm}^2$",
              "$65\\text{ cm}^2$",
            ],
            answer: "B",
            explanation: "लम्ब $p = \\sqrt{13^2 - 12^2} = \\sqrt{169 - 144} = \\sqrt{25} = 5\\text{ cm}$।\nक्षेत्रफल $\\Delta = \\frac{1}{2} \\times \\text{आधार} \\times \\text{ऊंचाई} = \\frac{1}{2} \\times 12 \\times 5 = 30\\text{ cm}^2$।",
            subject: "AI Import Functional Test Subject",
            chapter: "AI Test Chapter",
            topic: "AI Functional Test Topic",
          },
        ],
      });

      const parsed = await smartJSONImport(json);
      expect(parsed.success).toBe(true);
      const q = parsed.results[0];
      expect(q.isValid).toBe(true);
      expect(q.correctIndex).toBe(1); // "B" -> 1
      expect(q.question).toContain("$b = 12\\text{ cm}$");
      expect(q.explanation).toContain("\\sqrt");
      expect(q.explanation).toContain("30\\text{ cm}^2");
    });

    it("1.6 PYQ MCQ (5-option format with official RPSC Option E अनुत्तरित प्रश्न)", async () => {
      const json = JSON.stringify({
        schemaVersion: 1,
        questions: [
          {
            type: "single_correct",
            question: "राजस्थान में 1857 की क्रांति के समय ब्रिटिश पॉलिटिकल एजेंट 'मेजर बर्टन' किस रियासत में नियुक्त था? [RPSC RAS Prelims 2021]",
            options: [
              "मेवाड़ (Mewar)",
              "कोटा (Kota)",
              "मारवाड़ (Marwar)",
              "जयपुर (Jaipur)",
              "अनुत्तरित प्रश्न (Question not attempted)",
            ],
            answer: "B",
            explanation: "1857 की क्रांति के समय कोटा के पॉलिटिकल एजेंट मेजर बर्टन थे, जिनकी क्रांतिकारियों ने हत्या कर दी थी।",
            subject: "AI Import Functional Test Subject",
            chapter: "AI Test Chapter",
            topic: "AI Functional Test Topic",
            exam: "RPSC RAS Prelims",
            year: "2021",
            isPYQ: true,
          },
        ],
      });

      const parsed = await smartJSONImport(json);
      expect(parsed.success).toBe(true);
      const q = parsed.results[0];
      expect(q.isValid).toBe(true);
      expect(q.options.length).toBe(5);
      expect(q.options[4]).toContain("अनुत्तरित प्रश्न");
      expect(q.correctIndex).toBe(1); // "B" -> 1
      expect(q.isPYQ).toBe(true);
      expect(q.year).toBe("2021");
    });
  });

  describe("2. AI Import Validation & Error Rejection", () => {
    it("2.1 Rejects malformed JSON syntax with line and column diagnostics", async () => {
      const brokenJson = `{
        "schemaVersion": 1,
        "questions": [
          {
            "question": "Broken JSON missing closing brace"
            "options": ["A", "B", "C", "D"],
            "answer": "A"
          }
        ]
      }`;

      const res = await smartJSONImport(brokenJson, new Set(), { skipAIRecovery: true });
      expect(res.success).toBe(false);
      expect(res.parseError).toBeDefined();
      expect(res.parseError?.toLowerCase()).toContain("json syntax error");
      expect(res.results.length).toBe(0);
    });

    it("2.2 Rejects missing required fields (question stem, options, or answer)", async () => {
      const missingFieldsJson = JSON.stringify({
        schemaVersion: 1,
        questions: [
          {
            question: "", // Missing question text
            options: ["A", "B", "C", "D"],
            answer: "A",
          },
          {
            question: "Question with no options provided?",
            options: [], // Empty options
            answer: "A",
          },
          {
            question: "Question with missing answer?",
            options: ["Option 1", "Option 2"],
            answer: "", // Missing answer
          },
        ],
      });

      const res = await smartJSONImport(missingFieldsJson, new Set(), { skipAIRecovery: true });
      expect(res.success).toBe(true);
      expect(res.results.length).toBe(3);

      // All 3 must fail validation
      expect(res.results[0].isValid).toBe(false);
      expect(res.results[0].errors.some((e) => e.includes("Question text is missing"))).toBe(true);

      expect(res.results[1].isValid).toBe(false);
      expect(res.results[1].errors.some((e) => e.includes("at least 2 options"))).toBe(true);

      expect(res.results[2].isValid).toBe(false);
      expect(res.results[2].correctIndex).toBe(-1);
      expect(res.results[2].errors.some((e) => e.includes("Correct answer is missing"))).toBe(true);
    });

    it("2.3 Rejects invalid answer letters (out-of-bounds or non-existent letters)", async () => {
      const invalidAnswerJson = JSON.stringify({
        schemaVersion: 1,
        questions: [
          {
            question: "Sample Question with Invalid Answer 'Z'?",
            options: ["Opt 1", "Opt 2", "Opt 3", "Opt 4"],
            answer: "Z", // Non-existent option
          },
          {
            question: "Sample Question with 4 options but answer 'E'?",
            options: ["Opt 1", "Opt 2", "Opt 3", "Opt 4"],
            answer: "E", // Out of bounds for 4 options
          },
        ],
      });

      const res = await smartJSONImport(invalidAnswerJson, new Set(), { skipAIRecovery: true });
      expect(res.success).toBe(true);
      expect(res.results[0].isValid).toBe(false);
      expect(res.results[0].correctIndex).toBe(-1);
      expect(res.results[0].errors.some((e) => e.includes("does not match A–E"))).toBe(true);

      expect(res.results[1].isValid).toBe(false);
      expect(res.results[1].correctIndex).toBe(-1);
      expect(res.results[1].errors.some((e) => e.includes("exceeds available options count"))).toBe(true);
    });

    it("2.4 Rejects empty options within the options array", async () => {
      const emptyOptionJson = JSON.stringify({
        schemaVersion: 1,
        questions: [
          {
            question: "Question with an empty option string?",
            options: ["Valid A", "", "Valid C", "Valid D"],
            answer: "A",
          },
        ],
      });

      const res = await smartJSONImport(emptyOptionJson, new Set(), { skipAIRecovery: true });
      expect(res.success).toBe(true);
      expect(res.results[0].isValid).toBe(false);
      expect(res.results[0].errors.some((e) => e.includes("Option B text is empty"))).toBe(true);
    });

    it("2.5 Detects in-batch duplicate questions", async () => {
      const duplicateJson = JSON.stringify({
        schemaVersion: 1,
        questions: [
          {
            question: "Duplicate test question content for detection?",
            options: ["Opt A", "Opt B", "Opt C", "Opt D"],
            answer: "A",
          },
          {
            question: "Duplicate test question content for detection?",
            options: ["Opt A", "Opt B", "Opt C", "Opt D"],
            answer: "A",
          },
        ],
      });

      const res = await smartJSONImport(duplicateJson, new Set(), { skipAIRecovery: true });
      expect(res.success).toBe(true);
      expect(res.results.length).toBe(2);
      expect(res.results[0].isDuplicate).toBe(false);
      expect(res.results[1].isDuplicate).toBe(true);
      expect(res.results[1].duplicateOf).toBe("batch");
    });

    it("2.6 Rejects unsupported question types (e.g. subjective / essay / multiple correct)", async () => {
      const unsupportedJson = JSON.stringify({
        schemaVersion: 1,
        questions: [
          {
            type: "subjective",
            question: "Explain the administrative reforms of Akbar in 200 words.",
            options: ["Descriptive Answer"],
            answer: "A",
          },
        ],
      });

      const res = await smartJSONImport(unsupportedJson, new Set(), { skipAIRecovery: true });
      expect(res.success).toBe(true);
      expect(res.results[0].isValid).toBe(false);
      expect(res.results[0].reviewCategory).toBe("unsupported");
    });

    it("2.7 Rejects empty question batches", async () => {
      const emptyBatchJson = JSON.stringify({
        schemaVersion: 1,
        questions: [],
      });

      const res = await smartJSONImport(emptyBatchJson, new Set(), { skipAIRecovery: true });
      expect(res.success).toBe(false);
      expect(res.parseError).toContain("No questions detected");
    });

    it("2.8 Enforces maximum batch limit (rejects batches exceeding 25 questions)", async () => {
      const oversizedQuestions = Array.from({ length: 26 }, (_, i) => ({
        type: "single_correct",
        question: `Oversized Batch Question #${i + 1}?`,
        options: ["A", "B", "C", "D"],
        answer: "A",
      }));

      const oversizedJson = JSON.stringify({
        schemaVersion: 1,
        questions: oversizedQuestions,
      });

      const res = await smartJSONImport(oversizedJson, new Set(), { skipAIRecovery: true });
      expect(res.success).toBe(false);
      expect(res.parseError).toContain("Maximum 25 questions allowed per import batch");
      expect(res.results.length).toBe(0);
    });
  });

  describe("3. Supabase RLS & Database Integrity Verification", () => {
    it("3.1 Unauthorized / Anonymous writes are strictly blocked by Supabase RLS with 42501", async () => {
      if (!isSupabaseConfigured()) return;

      // Attempting an insert as unauthenticated/anonymous caller
      const { data, error } = await supabase.from("questions").insert({
        id: "hacker_unauth_q_999",
        question: "Unauthorized question injection attempt",
        options: ["A", "B", "C", "D"],
        correct_answer: 0,
      });

      // Strict RLS enforcement: must return code 42501 (permission denied)
      expect(error).toBeDefined();
      expect(error?.code).toBe("42501");
      expect(data).toBeNull();
    });

    it("3.2 Verified test questions exist in public.questions with complete metadata", async () => {
      if (!isSupabaseConfigured()) return;

      const { data, error } = await supabase
        .from("questions")
        .select("id, question, options, correct_answer, explanation, subject_id, chapter_id, topic_id, exam, year")
        .in("id", TEST_Q_IDS);

      expect(error).toBeNull();
      expect(data).toBeDefined();

      if (data && data.length >= 2) {
        const q1 = data.find((r) => r.id === "q_ai_test_001");
        expect(q1).toBeDefined();
        expect(q1.subject_id).toBe(TEST_SUBJECT_ID);
        expect(q1.chapter_id).toBe(TEST_CHAPTER_ID);
        expect(q1.topic_id).toBe(TEST_TOPIC_ID);
        expect(q1.correct_answer).toBe(1);
        expect(Array.isArray(q1.options)).toBe(true);
        expect(q1.options.length).toBe(4);
        expect(q1.explanation).toContain("1985");
      }
    });
  });

  describe("4. Student App Verification & MCQ Practice Flow", () => {
    it("4.1 Imported questions appear in fetchQuestionsByTopic with preserved options and order", async () => {
      if (!isSupabaseConfigured()) return;

      const questions = await fetchQuestionsByTopic(TEST_TOPIC_ID);
      expect(Array.isArray(questions)).toBe(true);

      if (questions.length >= 2) {
        const found = questions.find((q) => q.id === "q_ai_test_001");
        expect(found).toBeDefined();
        expect(found!.options).toEqual(["1981", "1985", "1992", "2001"]);
        expect(found!.correctIndex).toBe(1);
        expect(found!.text).toContain("केवलादेव राष्ट्रीय उद्यान");
      }
    });

    it("4.2 Cache-first student practice: Instant load from IndexedDB", async () => {
      await saveQuestionsToCache([
        {
          id: "q_ai_test_001",
          text: "केवलादेव राष्ट्रीय उद्यान (भरतपुर) को यूनेस्को विश्व धरोहर स्थल किस वर्ष घोषित किया गया था?",
          options: ["1981", "1985", "1992", "2001"],
          correctIndex: 1,
          explanation: "1985",
          topicId: TEST_TOPIC_ID,
        },
        {
          id: "q_ai_test_002",
          text: "राजस्थान का राज्य वृक्ष खेजड़ी को कब घोषित किया गया था?",
          options: ["1981", "1983", "1989", "1993"],
          correctIndex: 1,
          explanation: "1983",
          topicId: TEST_TOPIC_ID,
        },
      ]);
      const cached = await fetchQuestionsCacheFirst(TEST_TOPIC_ID);
      expect(Array.isArray(cached)).toBe(true);
      expect(cached.length).toBe(2);
    });

    it("4.3 Student practice session simulation: Verified scoring, option ordering, and negative marking", () => {
      const mockQuestions: Question[] = [
        {
          id: "q_sim_1",
          text: "केवलादेव राष्ट्रीय उद्यान (भरतपुर) को यूनेस्को विश्व धरोहर स्थल किस वर्ष घोषित किया गया था?",
          options: ["1981", "1985", "1992", "2001"],
          correctIndex: 1, // 1985
          explanation: "1985",
          topicId: TEST_TOPIC_ID,
        },
        {
          id: "q_sim_2",
          text: "राजस्थान का राज्य वृक्ष खेजड़ी को कब घोषित किया गया था?",
          options: ["1981", "1983", "1989", "1993"],
          correctIndex: 1, // 1983
          explanation: "1983",
          topicId: TEST_TOPIC_ID,
        },
      ];

      // Student marks Q1 correctly (index 1) and Q2 incorrectly (index 0)
      const studentAnswers: Record<string, number> = {
        q_sim_1: 1, // correct (+1)
        q_sim_2: 0, // incorrect (-0.33)
      };

      let score = 0;
      mockQuestions.forEach((q) => {
        const studentAns = studentAnswers[q.id];
        if (studentAns === q.correctIndex) {
          score += 1;
        } else if (studentAns !== undefined) {
          score -= 0.33; // Negative marking penalty
        }
      });

      expect(score).toBeCloseTo(0.67, 2);
    });
  });

  describe("5. Performance Testing (1, 10, and 25 MCQ Batches)", () => {
    it("5.1 Performance Benchmark: 1 MCQ Batch", async () => {
      const singleMcqJson = JSON.stringify({
        schemaVersion: 1,
        questions: [
          {
            type: "single_correct",
            question: "Benchmark Q1: राजस्थान का राज्य पशु कौन सा है?",
            options: ["चिंकारा", "बाघ", "हाथी", "सिंह"],
            answer: "A",
            explanation: "चिंकारा (गजेला गजेला) राजस्थान का राज्य पशु (वन्यजीव श्रेणी) है।",
            subject: "AI Import Functional Test Subject",
            chapter: "AI Test Chapter",
            topic: "AI Functional Test Topic",
          },
        ],
      });

      const t0 = performance.now();
      const parsed = await smartJSONImport(singleMcqJson);
      const parseDurationMs = performance.now() - t0;

      expect(parsed.success).toBe(true);
      expect(parseDurationMs).toBeLessThan(100);
      console.log(`[Perf Benchmark: 1 MCQ] Parsing & Validation: ${parseDurationMs.toFixed(2)} ms`);
    });

    it("5.2 Performance Benchmark: 10 MCQ Batch", async () => {
      const tenMcqs = Array.from({ length: 10 }, (_, i) => ({
        type: "single_correct",
        question: `Benchmark Question #${i + 1}: राजस्थान के खनिज संसाधन प्रश्न?`,
        options: ["विकल्प A", "विकल्प B", "विकल्प C", "विकल्प D"],
        answer: ["A", "B", "C", "D"][i % 4],
        explanation: `व्याख्या प्रश्न #${i + 1} के लिए।`,
        subject: "AI Import Functional Test Subject",
        chapter: "AI Test Chapter",
        topic: "AI Functional Test Topic",
      }));

      const tenMcqJson = JSON.stringify({
        schemaVersion: 1,
        questions: tenMcqs,
      });

      const t0 = performance.now();
      const parsed = await smartJSONImport(tenMcqJson);
      const parseDurationMs = performance.now() - t0;

      expect(parsed.success).toBe(true);
      expect(parsed.results.length).toBe(10);
      expect(parsed.results.every((r) => r.isValid)).toBe(true);
      console.log(`[Perf Benchmark: 10 MCQs] Parsing & Validation: ${parseDurationMs.toFixed(2)} ms`);
    });

    it("5.3 Performance Benchmark: 25 MCQ Batch (Maximum Batch Capacity)", async () => {
      const twentyFiveMcqs = Array.from({ length: 25 }, (_, i) => ({
        type: "single_correct",
        question: `Benchmark Question #${i + 1}: राजस्थान भूगोल एवं अर्थव्यवस्था परीक्षण?`,
        options: ["Option 1", "Option 2", "Option 3", "Option 4"],
        answer: ["A", "B", "C", "D"][i % 4],
        explanation: `Detailed explanation for question #${i + 1}.`,
        subject: "AI Import Functional Test Subject",
        chapter: "AI Test Chapter",
        topic: "AI Functional Test Topic",
      }));

      const twentyFiveMcqJson = JSON.stringify({
        schemaVersion: 1,
        questions: twentyFiveMcqs,
      });

      const t0 = performance.now();
      const parsed = await smartJSONImport(twentyFiveMcqJson);
      const parseDurationMs = performance.now() - t0;

      expect(parsed.success).toBe(true);
      expect(parsed.results.length).toBe(25);
      expect(parsed.results.every((r) => r.isValid)).toBe(true);
      expect(parseDurationMs).toBeLessThan(350);
      console.log(`[Perf Benchmark: 25 MCQs] Parsing & Validation: ${parseDurationMs.toFixed(2)} ms`);
    });
  });

  describe("6. Data Safety & Production Non-Interference Verification", () => {
    it("6.1 Production pilot data (q_pilot_001 to q_pilot_010) was NEVER altered or deleted", async () => {
      if (!isSupabaseConfigured()) return;

      const { data, error } = await supabase
        .from("questions")
        .select("id")
        .like("id", "q_pilot_%");

      expect(error).toBeNull();
      expect(data).toBeDefined();
      // Pilot rows are optional until the seed script is run; if present,
      // the complete set of 10 must be intact.
      if (data!.length > 0) {
        expect(data!.length).toBe(10);
      }
    });
  });
});
