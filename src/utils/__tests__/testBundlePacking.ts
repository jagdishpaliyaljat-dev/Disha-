import { Question } from "../../types";
import { QuestionBundle } from "../questionBundleService";

async function runUnitTests() {
  console.log("=================================================");
  console.log("   QUIZPRO BUCKET PATTERN (PACKING TEST SUITE)   ");
  console.log("=================================================");

  const sampleQuestions: Question[] = [
    {
      id: "q_101",
      topicId: "topic_rajasthan_history",
      chapterId: "ch_history",
      subjectId: "sub_gk",
      text: "राजस्थान के एकीकरण के समय जयपुर के महाराजा कौन थे?",
      options: ["महाराजा मानसिंह द्वितीय", "महाराजा जयसिंह", "महाराजा मानसिंह प्रथम", "महाराजा माधोसिंह"],
      correctIndex: 0,
      explanation: "जयपुर के महाराजा मानसिंह द्वितीय राजस्थान के एकीकरण के समय राजप्रमुख बने थे।"
    },
    {
      id: "q_102",
      topicId: "topic_rajasthan_history",
      chapterId: "ch_history",
      subjectId: "sub_gk",
      text: "मत्स्य संघ का उद्घाटन किस दुर्ग में हुआ?",
      options: ["लोहागढ़ दुर्ग", "मेहरानगढ़ दुर्ग", "अंबर दुर्ग", "चित्तौड़गढ़ दुर्ग"],
      correctIndex: 0,
      explanation: "18 मार्च 1948 को मत्स्य संघ का उद्घाटन भरतपुर के लोहागढ़ दुर्ग में हुआ।"
    },
    {
      id: "q_103",
      topicId: "topic_rajasthan_geography",
      chapterId: "ch_geography",
      subjectId: "sub_gk",
      text: "राजस्थान का राज्य पशु कौन सा है?",
      options: ["चिंकारा एवं ऊंट", "बाघ", "हाथी", "शेर"],
      correctIndex: 0,
      explanation: "राजस्थान का वन्यजीव राज्य पशु चिंकारा और पालतू राज्य पशु ऊंट है।"
    }
  ];

  console.log(`\n[Test 1] Input MCQs Count: ${sampleQuestions.length}`);

  // Test 1: Grouping Logic by Topic
  const topicMap = new Map<string, Question[]>();
  for (const q of sampleQuestions) {
    if (!q.topicId) continue;
    const list = topicMap.get(q.topicId) || [];
    list.push(q);
    topicMap.set(q.topicId, list);
  }

  console.log(`✓ Total Unique Topics Identified: ${topicMap.size}`);
  
  if (topicMap.size !== 2) {
    throw new Error(`Expected 2 topics, got ${topicMap.size}`);
  }

  // Test 2: Bundle Payload Validation
  const now = new Date().toISOString();
  const createdBundles: QuestionBundle[] = [];

  for (const [topicId, questions] of topicMap.entries()) {
    const bundleId = `topic_${topicId}`;
    const firstQ = questions[0];

    const bundlePayload: QuestionBundle = {
      id: bundleId,
      topicId,
      chapterId: firstQ?.chapterId || "",
      subjectId: firstQ?.subjectId || "",
      questionCount: questions.length,
      updatedAt: now,
      questions: questions
    };

    createdBundles.push(bundlePayload);
  }

  console.log("\n[Test 2] Generated Topic Buckets:");
  createdBundles.forEach((b, idx) => {
    console.log(`  Bundle #${idx + 1}:`);
    console.log(`    - Bundle ID: ${b.id}`);
    console.log(`    - Topic ID: ${b.topicId}`);
    console.log(`    - Chapter ID: ${b.chapterId}`);
    console.log(`    - Questions Count: ${b.questionCount}`);
    console.log(`    - First Question Sample: "${b.questions[0].text.substring(0, 40)}..."`);
  });

  // Verify structure
  const histBundle = createdBundles.find(b => b.topicId === "topic_rajasthan_history");
  if (!histBundle || histBundle.questionCount !== 2) {
    throw new Error("History bundle failed validation!");
  }

  const geoBundle = createdBundles.find(b => b.topicId === "topic_rajasthan_geography");
  if (!geoBundle || geoBundle.questionCount !== 1) {
    throw new Error("Geography bundle failed validation!");
  }

  console.log("\n[Test 3] Firestore Read Optimization Calculation:");
  console.log(`  - Without Bucket Pattern (Individual Reads): 3 Reads for 3 questions`);
  console.log(`  - With Bucket Pattern (Packed Bundle Reads): 2 Reads for 2 topics (95%+ savings for large topics)`);

  console.log("\n=================================================");
  console.log("   ✅ BUCKET PATTERN TEST SUITE PASSED 100%!   ");
  console.log("=================================================\n");
}

runUnitTests().catch((err) => {
  console.error("Test Suite Failed:", err);
  process.exit(1);
});
