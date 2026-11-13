import {
  isValidQuestion,
  normalizeCachedQuestion,
  deduplicateQuestionsList,
  saveQuestionsToCache,
  getCachedQuestionsByTopic,
  getAllCachedQuestions,
  fetchQuestionsCacheFirst,
  getQuestionBankCacheStats,
  clearQuestionBankCache,
  warmQuestionBankCache
} from "../src/utils/questionBankCache";

async function runCacheTests() {
  console.log("=== STARTING QUESTION BANK CACHE-FIRST VERIFICATION ===");

  // 1. Validation & Normalization
  console.log("\n[Test 1] Testing validation and normalization...");
  const validSample = {
    id: "test-q1",
    text: "Which lake in Rajasthan is known for salt production?",
    options: ["Sambhar", "Pichola", "Fateh Sagar", "Ana Sagar"],
    correctIndex: 0,
    topicId: "raj-geography",
    chapterId: "ch-geo-1",
  };
  const invalidSample = {
    id: "bad-q",
    options: ["Only one"],
  };

  if (!isValidQuestion(validSample)) throw new Error("Valid question marked invalid");
  if (isValidQuestion(invalidSample)) throw new Error("Invalid question marked valid");

  const normalized = normalizeCachedQuestion(validSample);
  if (normalized.text !== validSample.text || normalized.correctIndex !== 0) {
    throw new Error("Normalization failed");
  }
  console.log("✓ Validation and Normalization passed.");

  // 2. Clear cache to baseline
  console.log("\n[Test 2] Clearing cache to baseline...");
  await clearQuestionBankCache();
  let stats = await getQuestionBankCacheStats();
  console.log("Stats after clear:", stats);
  if (stats.totalQuestions !== 0) throw new Error("Cache not cleared properly");
  console.log("✓ Cache clear passed.");

  // 3. Save questions to cache
  console.log("\n[Test 3] Testing saveQuestionsToCache...");
  const testBatch = [
    {
      id: "q-test-1",
      text: "Capital of Rajasthan?",
      options: ["Jaipur", "Jodhpur", "Udaipur", "Bikaner"],
      correctIndex: 0,
      topicId: "topic-rajasthan-intro",
      chapterId: "chap-1",
    },
    {
      id: "q-test-2",
      text: "Keoladeo National Park is located in?",
      options: ["Bharatpur", "Alwar", "Kota", "Sawai Madhopur"],
      correctIndex: 0,
      topicId: "topic-rajasthan-intro",
      chapterId: "chap-1",
    },
    {
      id: "q-test-3",
      text: "Hawa Mahal was built by?",
      options: ["Sawai Pratap Singh", "Sawai Jai Singh", "Man Singh", "Madho Singh"],
      correctIndex: 0,
      topicId: "topic-architecture",
      chapterId: "chap-2",
    }
  ];

  await saveQuestionsToCache(testBatch as any, { source: "initial" });
  stats = await getQuestionBankCacheStats();
  console.log("Stats after saving 3 questions:", stats);
  if (stats.totalQuestions !== 3) throw new Error(`Expected 3 total questions, got ${stats.totalQuestions}`);
  if (stats.cachedTopicsCount < 2) throw new Error(`Expected at least 2 topics, got ${stats.cachedTopicsCount}`);
  console.log("✓ saveQuestionsToCache passed.");

  // 4. Test getCachedQuestionsByTopic
  console.log("\n[Test 4] Testing getCachedQuestionsByTopic...");
  const topic1Qs = await getCachedQuestionsByTopic("topic-rajasthan-intro");
  if (!topic1Qs || topic1Qs.length !== 2) {
    throw new Error(`Expected 2 questions for topic-rajasthan-intro, got ${topic1Qs?.length}`);
  }
  const topic2Qs = await getCachedQuestionsByTopic("topic-architecture");
  if (!topic2Qs || topic2Qs.length !== 1) {
    throw new Error(`Expected 1 question for topic-architecture, got ${topic2Qs?.length}`);
  }
  console.log("✓ getCachedQuestionsByTopic passed with exact counts.");

  // 5. Test Cache-First Retrieval (Offline simulation)
  console.log("\n[Test 5] Testing fetchQuestionsCacheFirst (Offline simulation)...");
  let remoteCallCount = 0;
  const mockRemoteFetcher = async (tid: string) => {
    remoteCallCount++;
    return [];
  };

  const cachedResult = await fetchQuestionsCacheFirst("topic-rajasthan-intro", {
    remoteFetcher: mockRemoteFetcher,
  });

  if (!cachedResult || cachedResult.length !== 2) {
    throw new Error(`Cache-first returned ${cachedResult?.length} questions instead of 2`);
  }
  console.log("✓ fetchQuestionsCacheFirst returned cached questions immediately.");

  // 6. Test Cache Pre-warming
  console.log("\n[Test 6] Testing warmQuestionBankCache...");
  const warmResult = await warmQuestionBankCache();
  console.log("Warmed question bank stats:", warmResult);
  if (warmResult.totalQuestions < 3) {
    throw new Error("Warming failed to retain questions");
  }
  console.log("✓ warmQuestionBankCache completed successfully.");

  console.log("\n=== ALL QUESTION BANK CACHE-FIRST TESTS PASSED ===");
}

runCacheTests().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
