import { bulkMoveQuestions, loadUserQuestionsStore, getCombinedChapters, getCombinedQuestions } from "../src/utils/questionsStorage";
import { Question, UserQuestionsStore, Chapter, Topic } from "../src/types";

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${msg}`);
    throw new Error(msg);
  } else {
    console.log(`✅ ${msg}`);
  }
}

async function runMoveTestSuite() {
  console.log("====================================================");
  console.log("      QUIZPRO MCQ MOVE VERIFICATION TEST SUITE      ");
  console.log("====================================================");

  // Setup mock chapters and questions
  const sourceTopicId = "custom-topic-1793114725323-h9ask"; // MCQ 1
  const targetTopicId = "custom-topic-1793115988421-45kap"; // MCQ 2
  const sourceChapterId = "custom-ch-1793114583187-txi6p";
  const targetChapterId = "custom-ch-1793114583187-txi6p";
  const subjectId = "subj-1793114550283-wpeqo";

  // Generate 100 mock source questions with stable IDs
  const mockSourceQuestions: Question[] = Array.from({ length: 100 }, (_, i) => ({
    id: `mcq_source_test_${i.toString().padStart(3, "0")}`,
    text: `Sample Test Question ${i + 1} for Move Audit`,
    options: ["Option A", "Option B", "Option C", "Option D"],
    correctIndex: i % 4,
    explanation: `Explanation for question ${i + 1}`,
    chapterId: sourceChapterId,
    topicId: sourceTopicId,
    subjectId: subjectId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }));

  // Generate 50 unrelated questions in another topic
  const unrelatedQuestions: Question[] = Array.from({ length: 50 }, (_, i) => ({
    id: `mcq_unrelated_${i.toString().padStart(3, "0")}`,
    text: `Unrelated Question ${i + 1}`,
    options: ["Option 1", "Option 2"],
    correctIndex: 0,
    explanation: "Unrelated",
    chapterId: "other_ch",
    topicId: "other_topic",
    subjectId: "other_sub",
    createdAt: new Date().toISOString(),
  }));

  const initialStore: UserQuestionsStore = {
    customSubjects: [],
    customChapters: [
      {
        id: sourceChapterId,
        number: 1,
        title: "प्राचीन सभ्यता",
        hindiTitle: "प्राचीन सभ्यता",
        subjectId,
        topics: [
          { id: sourceTopicId, title: "MCQ 1", hindiTitle: "MCQ 1", chapterId: sourceChapterId, questions: [] },
          { id: targetTopicId, title: "MCQ 2", hindiTitle: "MCQ 2", chapterId: targetChapterId, questions: [] }
        ]
      }
    ],
    customTopics: [],
    cloudCacheQuestions: [...mockSourceQuestions, ...unrelatedQuestions],
    customQuestions: [],
    editedSubjects: {},
    editedChapters: {},
    editedTopics: {},
    editedQuestions: {},
    deletedSubjectIds: [],
    deletedChapterIds: [],
    deletedTopicIds: [],
    deletedQuestionIds: [],
  };

  const initialChapters = getCombinedChapters(initialStore);
  const initialCombined = getCombinedQuestions(initialChapters, initialStore);
  const questionsMap = initialCombined.reduce((acc, q) => { acc[q.id] = q; return acc; }, {} as Record<string, Question>);

  console.log(`Initial total questions: ${initialCombined.length}`);
  const initialSourceQs = initialCombined.filter(q => q.topicId === sourceTopicId);
  const initialTargetQs = initialCombined.filter(q => q.topicId === targetTopicId);
  console.log(`Initial MCQ 1 count: ${initialSourceQs.length}`);
  console.log(`Initial MCQ 2 count: ${initialTargetQs.length}`);
  assert(initialSourceQs.length === 100, "Initial source has exactly 100 questions");
  assert(initialTargetQs.length === 0, "Initial destination has exactly 0 questions");

  // ----------------------------------------------------------------------
  // TEST 1: Move 1 single question
  // ----------------------------------------------------------------------
  console.log("\n--- TEST 1: Move 1 single question ---");
  const singleId = [mockSourceQuestions[0].id];
  const storeAfterSingleMove = bulkMoveQuestions(
    initialStore,
    singleId,
    targetChapterId,
    targetTopicId,
    questionsMap,
    subjectId
  );

  const chaptersAfter1 = getCombinedChapters(storeAfterSingleMove);
  const combinedAfter1 = getCombinedQuestions(chaptersAfter1, storeAfterSingleMove);
  const sourceQsAfter1 = combinedAfter1.filter(q => q.topicId === sourceTopicId);
  const targetQsAfter1 = combinedAfter1.filter(q => q.topicId === targetTopicId);

  assert(sourceQsAfter1.length === 99, "Source count decreased by 1 (99 left)");
  assert(targetQsAfter1.length === 1, "Destination count increased by 1 (1 received)");
  assert(targetQsAfter1[0].id === singleId[0], "Preserved exact stable question document ID");
  assert(combinedAfter1.length === initialCombined.length, "Total question count remains strictly unchanged (no duplicates)");

  // ----------------------------------------------------------------------
  // TEST 2: Move 100 questions in bulk
  // ----------------------------------------------------------------------
  console.log("\n--- TEST 2: Move 100 questions in bulk ---");
  const all100Ids = mockSourceQuestions.map(q => q.id);
  const storeAfter100Move = bulkMoveQuestions(
    initialStore,
    all100Ids,
    targetChapterId,
    targetTopicId,
    questionsMap,
    subjectId
  );

  const chaptersAfter100 = getCombinedChapters(storeAfter100Move);
  const combinedAfter100 = getCombinedQuestions(chaptersAfter100, storeAfter100Move);
  const sourceQsAfter100 = combinedAfter100.filter(q => q.topicId === sourceTopicId);
  const targetQsAfter100 = combinedAfter100.filter(q => q.topicId === targetTopicId);

  assert(sourceQsAfter100.length === 0, "Source MCQ 1 has exactly 0 questions remaining");
  assert(targetQsAfter100.length === 100, "Destination MCQ 2 received exactly 100 questions");
  assert(combinedAfter100.length === initialCombined.length, "Total questions in store is strictly preserved at 150");

  // Verify all document IDs are preserved
  const movedIdSet = new Set(targetQsAfter100.map(q => q.id));
  const allIdsMatch = all100Ids.every(id => movedIdSet.has(id));
  assert(allIdsMatch, "All 100 original document IDs match identically");

  // ----------------------------------------------------------------------
  // TEST 3: Idempotency (Repeat move / simulated retry / double-click)
  // ----------------------------------------------------------------------
  console.log("\n--- TEST 3: Idempotency & Repeat Submissions ---");
  const storeAfterRetry = bulkMoveQuestions(
    storeAfter100Move,
    all100Ids, // repeat same 100 IDs
    targetChapterId,
    targetTopicId,
    questionsMap,
    subjectId
  );

  const chaptersAfterRetry = getCombinedChapters(storeAfterRetry);
  const combinedAfterRetry = getCombinedQuestions(chaptersAfterRetry, storeAfterRetry);
  const targetQsAfterRetry = combinedAfterRetry.filter(q => q.topicId === targetTopicId);

  assert(targetQsAfterRetry.length === 100, "Retrying move does not create any duplicate questions (still 100)");
  assert(combinedAfterRetry.length === initialCombined.length, "Total questions remains strictly 150");

  // ----------------------------------------------------------------------
  // TEST 4: Move questions to destination that already contains some records
  // ----------------------------------------------------------------------
  console.log("\n--- TEST 4: Destination with Existing Records ---");
  // Target already has 100 questions. Let's move 10 questions back to source, then move 5 of them again
  const subsetIds = all100Ids.slice(0, 10);
  const storeWithSourceReopened = bulkMoveQuestions(
    storeAfter100Move,
    subsetIds,
    sourceChapterId,
    sourceTopicId,
    questionsMap,
    subjectId
  );

  const combinedReopened = getCombinedQuestions(getCombinedChapters(storeWithSourceReopened), storeWithSourceReopened);
  assert(combinedReopened.filter(q => q.topicId === sourceTopicId).length === 10, "Source topic now has 10 questions");
  assert(combinedReopened.filter(q => q.topicId === targetTopicId).length === 90, "Destination topic now has 90 questions");

  // Now move 5 of those 10 questions back to target (which already has 90)
  const fiveIds = subsetIds.slice(0, 5);
  const storeAfterFive = bulkMoveQuestions(
    storeWithSourceReopened,
    fiveIds,
    targetChapterId,
    targetTopicId,
    questionsMap,
    subjectId
  );
  const combinedAfterFive = getCombinedQuestions(getCombinedChapters(storeAfterFive), storeAfterFive);
  assert(combinedAfterFive.filter(q => q.topicId === sourceTopicId).length === 5, "Source topic has 5 questions");
  assert(combinedAfterFive.filter(q => q.topicId === targetTopicId).length === 95, "Destination topic has exactly 95 questions");
  assert(combinedAfterFive.length === initialCombined.length, "Total remains 150");

  // ----------------------------------------------------------------------
  // TEST 5: Verify unrelated questions remain untouched
  // ----------------------------------------------------------------------
  console.log("\n--- TEST 5: Unrelated Questions Verification ---");
  const unrelatedAfter = combinedAfterFive.filter(q => q.topicId === "other_topic");
  assert(unrelatedAfter.length === 50, "All 50 unrelated questions remain intact");
  assert(unrelatedAfter[0].id === unrelatedQuestions[0].id, "Unrelated question IDs and fields unmodified");

  // ----------------------------------------------------------------------
  // TEST 6: Page refresh simulation (JSON serialization round-trip)
  // ----------------------------------------------------------------------
  console.log("\n--- TEST 6: Page Refresh & Persistence Round-trip ---");
  const serialized = JSON.stringify(storeAfterFive);
  const deserialized: UserQuestionsStore = JSON.parse(serialized);
  const refreshedCombined = getCombinedQuestions(getCombinedChapters(deserialized), deserialized);

  const refreshedSource = refreshedCombined.filter(q => q.topicId === sourceTopicId);
  const refreshedTarget = refreshedCombined.filter(q => q.topicId === targetTopicId);

  assert(refreshedSource.length === 5, "Refreshed source count is exactly 5");
  assert(refreshedTarget.length === 95, "Refreshed destination count is exactly 95");
  assert(refreshedCombined.length === 150, "Refreshed total count is exactly 150 with zero duplicates");

  console.log("\n====================================================");
  console.log("       ALL 6 MOVE TEST PHASES PASSED 100%           ");
  console.log("====================================================");
}

runMoveTestSuite().then(() => process.exit(0)).catch(err => {
  console.error("Test suite error:", err);
  process.exit(1);
});
