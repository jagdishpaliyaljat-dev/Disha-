import { processJSONImport, parseJSONWithLocation } from "../src/lib/mcqImport/index";
import { smartJSONImport } from "../src/lib/mcqImport/smartImport";

async function runTests() {
  console.log("=================================================");
  console.log("STARTING TEST SUITE: AI-Assisted Smart Import");
  console.log("=================================================\n");

  let allPassed = true;

  // -------------------------------------------------------------------------
  // Test 1: Fully valid JSON containing all five currently supported question types (0 AI calls)
  // -------------------------------------------------------------------------
  const valid5Sample = {
    schemaVersion: 1,
    questions: [
      {
        type: "single_correct",
        question: "What is the capital of Rajasthan?\nLine 2: Pink City.",
        options: ["Jaipur", "Jodhpur", "Udaipur", "Kota"],
        answer: "A",
        explanation: "Jaipur is the capital.",
      },
      {
        type: "statement_based",
        question: "Consider statements:\n1. Aravalli is old fold mountain.\n2. Guru Shikhar is highest peak.",
        options: ["Only 1", "Only 2", "Both 1 and 2", "Neither 1 nor 2"],
        answer: "C",
        explanation: "Both statements are correct.",
      },
      {
        type: "assertion_reason",
        question: "Assertion (A): Sun rises in east.\nReason (R): Earth rotates west to east.",
        options: [
          "Both (A) and (R) are true and (R) is correct explanation",
          "Both true but (R) is not correct explanation",
          "(A) is true, (R) is false",
          "(A) is false, (R) is true"
        ],
        answer: "A",
        explanation: "Earth rotation causes sunrise in east.",
      },
      {
        type: "match_list",
        question: "Match List-I with List-II:\nA. Sariska -> 1. Alwar\nB. Keoladeo -> 2. Bharatpur",
        options: ["A-1, B-2", "A-2, B-1", "A-1, B-1", "A-2, B-2"],
        answer: "A",
        explanation: "Matches correctly.",
      },
      {
        type: "math",
        question: "Solve $2x - 2 = 10$. Find $x$.",
        options: ["$x = 4$", "$x = 5$", "$x = 6$", "$x = 8$"],
        answer: "C",
        explanation: "$2x = 12 \\implies x = 6$.",
      }
    ]
  };

  const t1 = await smartJSONImport(JSON.stringify(valid5Sample), new Set());
  const t1Pass = t1.success && t1.summary.valid === 5 && t1.summary.recoveredByAI === 0 && !t1.aiRecoveryRequired;
  console.log(`[TEST 1] 5 Standard Types Valid Import (No AI calls): ${t1Pass ? "PASS" : "FAIL"}`);
  if (!t1Pass) allPassed = false;

  // -------------------------------------------------------------------------
  // Test 2: Large input benchmark (1,000 valid questions) -> 0 AI calls, instant execution!
  // -------------------------------------------------------------------------
  const startT2 = Date.now();
  const largeQuestions = Array.from({ length: 1000 }, (_, i) => ({
    type: "single_correct",
    question: `Benchmark Question ${i + 1}: What is $X_{${i}}$ in standard sample?`,
    options: [`Opt A ${i}`, `Opt B ${i}`, `Opt C ${i}`, `Opt D ${i}`],
    answer: ["A", "B", "C", "D"][i % 4],
    explanation: `Explanation for ${i + 1}`,
  }));
  const largePayload = { schemaVersion: 1, questions: largeQuestions };
  const t2 = await smartJSONImport(JSON.stringify(largePayload), new Set());
  const elapsedT2 = Date.now() - startT2;
  const t2Pass = t2.success && t2.summary.valid === 1000 && t2.summary.recoveredByAI === 0 && elapsedT2 < 1000;
  console.log(`[TEST 2] 1,000 Questions Bulk Pass (0 AI calls, ${elapsedT2}ms): ${t2Pass ? "PASS" : "FAIL"}`);
  if (!t2Pass) allPassed = false;

  // -------------------------------------------------------------------------
  // Test 3: Multiple JSON blocks pasted sequentially
  // -------------------------------------------------------------------------
  const multiBlockPayload = `
  {
    "schemaVersion": 1,
    "questions": [
      {
        "type": "single_correct",
        "question": "Block 1 Question: National animal of India?",
        "options": ["Tiger", "Lion", "Elephant", "Peacock"],
        "answer": "A",
        "explanation": "Tiger is the national animal."
      }
    ]
  }
  {
    "schemaVersion": 1,
    "questions": [
      {
        "type": "single_correct",
        "question": "Block 2 Question: National bird of India?",
        "options": ["Peacock", "Parrot", "Eagle", "Sparrow"],
        "answer": "A",
        "explanation": "Peacock is national bird."
      }
    ]
  }
  `;
  const t3 = await smartJSONImport(multiBlockPayload, new Set());
  const t3Pass = t3.success && t3.summary.valid === 2 && t3.results[0].question.includes("Block 1") && t3.results[1].question.includes("Block 2");
  console.log(`[TEST 3] Multi-Block JSON Parsing: ${t3Pass ? "PASS" : "FAIL"}`);
  if (!t3Pass) allPassed = false;

  // -------------------------------------------------------------------------
  // Test 4: Mixed valid + malformed/alternative questions with AI recovery
  // -------------------------------------------------------------------------
  const mixedPayload = {
    schemaVersion: 1,
    questions: [
      {
        type: "single_correct",
        question: "Valid Q1: What is 2 + 2?",
        options: ["3", "4", "5", "6"],
        answer: "B",
        explanation: "2+2=4"
      },
      {
        // Malformed: irregular type, 0-index answer, choices instead of options
        type: "mcq_custom",
        prompt: "Recoverable Q2: Who is the first Prime Minister of India?",
        choices: ["Jawaharlal Nehru", "Sardar Patel", "Mahatma Gandhi", "Dr. B.R. Ambedkar"],
        correct_index: 0,
        solution: "Pandit Jawaharlal Nehru."
      }
    ]
  };

  console.log("\n[TEST 4] Testing AI Recovery for mixed valid + problematic question (sending only Q2 to AI)...");
  const t4 = await smartJSONImport(JSON.stringify(mixedPayload), new Set(), {
    batchSize: 2,
    onProgress: (p) => console.log(`   [Progress] ${p.phase}: ${p.message}`)
  });
  const t4Pass = t4.success && t4.summary.total === 2 && t4.results[0].isValid && t4.results[1].isValid;
  console.log(`[TEST 4] Mixed Input AI Recovery: ${t4Pass ? "PASS" : "FAIL"}`);
  console.log(`   Q1 Valid: ${t4.results[0].isValid}, RecoveredByAI: ${t4.results[0].recoveredByAI}`);
  console.log(`   Q2 Valid: ${t4.results[1].isValid}, RecoveredByAI: ${t4.results[1].recoveredByAI}, Type: ${t4.results[1].type}, Ans: ${t4.results[1].answer}`);
  if (!t4Pass) allPassed = false;

  // -------------------------------------------------------------------------
  // Test 5: Original Question Order Preservation
  // -------------------------------------------------------------------------
  const orderPass = t4.results[0].question.includes("2 + 2") && t4.results[1].question.includes("Prime Minister");
  console.log(`[TEST 5] Original Question Order Preservation: ${orderPass ? "PASS" : "FAIL"}`);
  if (!orderPass) allPassed = false;

  console.log("\n=================================================");
  console.log(`TEST SUITE FINISHED. ALL PASS: ${allPassed ? "YES" : "NO"}`);
  console.log("=================================================");
}

runTests().catch(err => {
  console.error("Test execution failed:", err);
  process.exit(1);
});

async function testActualAIRecoveryTrigger() {
  console.log("\n[TEST 6] Testing actual AI invocation for a question with broken options structure...");
  // Question with options as an unexpected object structure and type "reasoning_assertion"
  const brokenPayload = {
    schemaVersion: 1,
    questions: [
      {
        type: "assertion_and_reason_hindi",
        question: "अभिकथन (A): पारे का उपयोग थर्मामीटर में किया जाता है।\nकारण (R): पारा ऊष्मा का अच्छा चालक है और कांच से नहीं चिपकता।",
        options: [
          "A और R दोनों सही हैं और R, A की सही व्याख्या है",
          "A और R दोनों सही हैं लेकिन R सही व्याख्या नहीं है"
          // Only 2 options provided! Fails deterministic validation (requires 4 options)
        ],
        answer: "A",
        explanation: "पारे के विशेष गुणों के कारण इसका उपयोग थर्मामीटर में होता है।"
      }
    ]
  };

  const t6 = await smartJSONImport(JSON.stringify(brokenPayload), new Set(), {
    batchSize: 2,
    onProgress: (p) => console.log(`   [AI Recovery Progress] ${p.phase}: ${p.message}`)
  });

  console.log(`[TEST 6 Result] aiRecoveryRequired: ${t6.aiRecoveryRequired}`);
  console.log(`   Recovered count: ${t6.recoveredCount}`);
  console.log(`   Total: ${t6.summary.total}, Valid: ${t6.summary.valid}`);
  if (t6.results[0]) {
    console.log(`   Recovered question type: ${t6.results[0].type}`);
    console.log(`   Recovered options count: ${t6.results[0].options.length}`);
    console.log(`   Recovered by AI: ${t6.results[0].recoveredByAI}`);
  }
}

testActualAIRecoveryTrigger().catch(console.error);

async function testDirectAIRecoveryCall() {
  console.log("\n[TEST 7] Testing AI Recovery when answer is missing or options are corrupted...");
  const invalidQuestion = {
    schemaVersion: 1,
    questions: [
      {
        question: "अभिकथन (A): प्रकाश की गति निर्वात में अधिकतम होती है।\nकारण (R): निर्वात में कोई अवरोधक माध्यम नहीं होता।",
        options: [
          "A और R दोनों सही हैं तथा R, A की सही व्याख्या है",
          "A और R दोनों सही हैं लेकिन R, A की सही व्याख्या नहीं है",
          "A सही है परन्तु R गलत है",
          "A गलत है परन्तु R सही है"
        ],
        // answer is missing! Deterministic validation fails!
        answer: "",
        explanation: "निर्वात में प्रकाश 3x10^8 m/s से चलता है।"
      }
    ]
  };

  const t7 = await smartJSONImport(JSON.stringify(invalidQuestion), new Set(), {
    batchSize: 2,
    onProgress: (p) => console.log(`   [AI Recovery Progress] ${p.phase}: ${p.message}`)
  });

  console.log(`[TEST 7 Result] aiRecoveryRequired: ${t7.aiRecoveryRequired}`);
  console.log(`   Valid count: ${t7.summary.valid}`);
  console.log(`   Recovered by AI: ${t7.summary.recoveredByAI}`);
  console.log(`   Final Question Valid: ${t7.results[0]?.isValid}`);
  console.log(`   Recovered Answer: ${t7.results[0]?.answer}`);
}

testDirectAIRecoveryCall().catch(console.error);
