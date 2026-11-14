import { 
  bulkMoveQuestions, 
  getCombinedChapters, 
  getCombinedQuestions 
} from "../src/utils/questionsStorage";
import { Question, UserQuestionsStore, Chapter, Topic } from "../src/types";

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${msg}`);
    throw new Error(msg);
  } else {
    console.log(`✅ ${msg}`);
  }
}

export async function runCheckpoint7E2E() {
  console.log("================================================================================");
  console.log("          CHECKPOINT 7: END-TO-END VERIFICATION SUITE                          ");
  console.log("================================================================================\n");

  const subjectId = "subj-1793114550283-wpeqo";
  const ch1Id = "custom-ch-1793114583187-ch1";
  const ch2Id = "custom-ch-1793114583187-ch2";

  const topic50Id = "topic-test-50";
  const topic79Id = "topic-test-79";
  const topic100Id = "topic-test-100";
  const topicZeroId = "topic-test-0";

  // 1. Create questions
  const q50: Question[] = Array.from({ length: 50 }, (_, i) => ({
    id: `usr-q-top50-${i.toString().padStart(3, "0")}`,
    text: `टॉपिक 50 प्रश्न संख्या ${i + 1}`,
    options: ["उत्तर A", "उत्तर B", "उत्तर C", "उत्तर D"],
    correctIndex: 0,
    explanation: `व्याख्या 50-${i + 1}`,
    chapterId: ch1Id,
    topicId: topic50Id,
    subjectId,
    createdAt: "2026-11-01T10:00:00.000Z",
    updatedAt: "2026-11-01T10:00:00.000Z"
  }));

  const q79: Question[] = Array.from({ length: 79 }, (_, i) => ({
    id: `usr-q-top79-${i.toString().padStart(3, "0")}`,
    text: `टॉपिक 79 प्रश्न संख्या ${i + 1}`,
    options: ["विकल्प 1", "विकल्प 2", "विकल्प 3", "विकल्प 4"],
    correctIndex: 1,
    explanation: `व्याख्या 79-${i + 1}`,
    chapterId: ch1Id,
    topicId: topic79Id,
    subjectId,
    createdAt: "2026-11-01T10:00:00.000Z",
    updatedAt: "2026-11-01T10:00:00.000Z"
  }));

  const q100: Question[] = Array.from({ length: 100 }, (_, i) => ({
    id: `usr-q-top100-${i.toString().padStart(3, "0")}`,
    text: `टॉपिक 100 प्रश्न संख्या ${i + 1}`,
    options: ["क", "ख", "ग", "घ"],
    correctIndex: 2,
    explanation: `व्याख्या 100-${i + 1}`,
    chapterId: ch2Id,
    topicId: topic100Id,
    subjectId,
    createdAt: "2026-11-01T10:00:00.000Z",
    updatedAt: "2026-11-01T10:00:00.000Z"
  }));

  let store: UserQuestionsStore = {
    customSubjects: [],
    customChapters: [
      {
        id: ch1Id,
        number: 1,
        title: "अध्याय 1",
        hindiTitle: "अध्याय 1",
        subjectId,
        topics: [
          { id: topic50Id, title: "Topic 50 Qs", hindiTitle: "Topic 50 Qs", chapterId: ch1Id, questions: [] },
          { id: topic79Id, title: "Topic 79 Qs", hindiTitle: "Topic 79 Qs", chapterId: ch1Id, questions: [] },
          { id: topicZeroId, title: "Topic Empty", hindiTitle: "Topic Empty", chapterId: ch1Id, questions: [] },
        ]
      },
      {
        id: ch2Id,
        number: 2,
        title: "अध्याय 2",
        hindiTitle: "अध्याय 2",
        subjectId,
        topics: [
          { id: topic100Id, title: "Topic 100 Qs", hindiTitle: "Topic 100 Qs", chapterId: ch2Id, questions: [] },
        ]
      }
    ],
    customTopics: [],
    cloudCacheQuestions: [...q50, ...q79, ...q100],
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

  // ---------------------------------------------------------------------------
  // SCENARIO 1: Topic with 50 questions
  // ---------------------------------------------------------------------------
  console.log("--- SCENARIO 1: Topic with 50 questions ---");
  let chapters = getCombinedChapters(store);
  let topic50Obj = chapters[0].topics?.find(t => t.id === topic50Id);
  assert(topic50Obj?.questionCount === 50, "Scenario 1: Topic 50 questionCount is exactly 50");
  assert(topic50Obj?.questions.length === 50, "Scenario 1: Topic 50 questions array has length 50");

  // ---------------------------------------------------------------------------
  // SCENARIO 2: Topic with 79 questions
  // ---------------------------------------------------------------------------
  console.log("\n--- SCENARIO 2: Topic with 79 questions ---");
  let topic79Obj = chapters[0].topics?.find(t => t.id === topic79Id);
  assert(topic79Obj?.questionCount === 79, "Scenario 2: Topic 79 questionCount is exactly 79 (not inflated to 100)");
  assert(topic79Obj?.questions.length === 79, "Scenario 2: Topic 79 questions array has length 79");

  // ---------------------------------------------------------------------------
  // SCENARIO 3: Topic with 100 questions
  // ---------------------------------------------------------------------------
  console.log("\n--- SCENARIO 3: Topic with 100 questions ---");
  let topic100Obj = chapters[1].topics?.find(t => t.id === topic100Id);
  assert(topic100Obj?.questionCount === 100, "Scenario 3: Topic 100 questionCount is exactly 100");
  assert(topic100Obj?.questions.length === 100, "Scenario 3: Topic 100 questions array has length 100");

  // ---------------------------------------------------------------------------
  // SCENARIO 4: Topic with zero questions
  // ---------------------------------------------------------------------------
  console.log("\n--- SCENARIO 4: Topic with zero questions ---");
  let topicZeroObj = chapters[0].topics?.find(t => t.id === topicZeroId);
  assert(topicZeroObj?.questionCount === 0, "Scenario 4: Empty topic questionCount is exactly 0");
  assert(topicZeroObj?.questions.length === 0, "Scenario 4: Empty topic questions array is empty");

  // ---------------------------------------------------------------------------
  // SCENARIO 5: Move 10 questions from Topic 50 to Topic Zero
  // ---------------------------------------------------------------------------
  console.log("\n--- SCENARIO 5: Move 10 questions ---");
  const tenIdsToMove = q50.slice(0, 10).map(q => q.id);
  const questionsMap = getCombinedQuestions(chapters, store).reduce((acc, q) => { acc[q.id] = q; return acc; }, {} as Record<string, Question>);

  store = bulkMoveQuestions(store, tenIdsToMove, ch1Id, topicZeroId, questionsMap, subjectId);
  chapters = getCombinedChapters(store);

  topic50Obj = chapters[0].topics?.find(t => t.id === topic50Id);
  topicZeroObj = chapters[0].topics?.find(t => t.id === topicZeroId);
  assert(topic50Obj?.questionCount === 40, "Scenario 5: Source Topic 50 now has exactly 40 questions");
  assert(topicZeroObj?.questionCount === 10, "Scenario 5: Destination Topic Zero now has exactly 10 questions");

  // ---------------------------------------------------------------------------
  // SCENARIO 6: Move questions between chapters (from Ch1/Topic 79 to Ch2/Topic 100)
  // ---------------------------------------------------------------------------
  console.log("\n--- SCENARIO 6: Move questions between chapters ---");
  const crossChapterIds = q79.slice(0, 15).map(q => q.id);
  store = bulkMoveQuestions(store, crossChapterIds, ch2Id, topic100Id, questionsMap, subjectId);
  chapters = getCombinedChapters(store);

  topic79Obj = chapters[0].topics?.find(t => t.id === topic79Id);
  topic100Obj = chapters[1].topics?.find(t => t.id === topic100Id);
  assert(topic79Obj?.questionCount === 64, "Scenario 6: Topic 79 in Ch1 reduced from 79 to 64 (79 - 15)");
  assert(topic100Obj?.questionCount === 115, "Scenario 6: Topic 100 in Ch2 increased from 100 to 115 (100 + 15)");
  assert(chapters[0].questionCount === 40 + 64 + 10, "Scenario 6: Ch1 total matches sum of topics (114)");
  assert(chapters[1].questionCount === 115, "Scenario 6: Ch2 total matches sum of topics (115)");

  // ---------------------------------------------------------------------------
  // SCENARIO 7: Move questions back to original topic
  // ---------------------------------------------------------------------------
  console.log("\n--- SCENARIO 7: Move questions back to original topic ---");
  store = bulkMoveQuestions(store, tenIdsToMove, ch1Id, topic50Id, questionsMap, subjectId);
  store = bulkMoveQuestions(store, crossChapterIds, ch1Id, topic79Id, questionsMap, subjectId);
  chapters = getCombinedChapters(store);

  topic50Obj = chapters[0].topics?.find(t => t.id === topic50Id);
  topic79Obj = chapters[0].topics?.find(t => t.id === topic79Id);
  topic100Obj = chapters[1].topics?.find(t => t.id === topic100Id);
  topicZeroObj = chapters[0].topics?.find(t => t.id === topicZeroId);

  assert(topic50Obj?.questionCount === 50, "Scenario 7: Topic 50 restored to 50");
  assert(topic79Obj?.questionCount === 79, "Scenario 7: Topic 79 restored to 79");
  assert(topic100Obj?.questionCount === 100, "Scenario 7: Topic 100 restored to 100");
  assert(topicZeroObj?.questionCount === 0, "Scenario 7: Topic Zero restored to 0");

  const totalCombined = getCombinedQuestions(chapters, store);
  assert(totalCombined.length === 229, "Scenario 7: Global total strictly preserved at 229 (50 + 79 + 100)");

  // ---------------------------------------------------------------------------
  // SCENARIO 8: Refresh after moving
  // ---------------------------------------------------------------------------
  console.log("\n--- SCENARIO 8: Refresh after moving ---");
  // Move 5 questions to Topic Zero again, then simulate page reload
  const fiveMove = q50.slice(0, 5).map(q => q.id);
  store = bulkMoveQuestions(store, fiveMove, ch1Id, topicZeroId, questionsMap, subjectId);
  const refreshedJson = JSON.stringify(store);
  const refreshedStore: UserQuestionsStore = JSON.parse(refreshedJson);
  const refreshedChapters = getCombinedChapters(refreshedStore);

  const ref50 = refreshedChapters[0].topics?.find(t => t.id === topic50Id);
  const refZero = refreshedChapters[0].topics?.find(t => t.id === topicZeroId);
  assert(ref50?.questionCount === 45, "Scenario 8: Post-refresh source count is 45");
  assert(refZero?.questionCount === 5, "Scenario 8: Post-refresh destination count is 5");

  // ---------------------------------------------------------------------------
  // SCENARIO 9: Close and reopen application
  // ---------------------------------------------------------------------------
  console.log("\n--- SCENARIO 9: Close and reopen application ---");
  // Simulate offline storage persistence and reload
  const diskState = JSON.parse(JSON.stringify(refreshedStore));
  const rehydratedChapters = getCombinedChapters(diskState);
  const rehydratedAll = getCombinedQuestions(rehydratedChapters, diskState);
  assert(rehydratedAll.length === 229, "Scenario 9: Rehydrated question count matches exactly 229");

  // ---------------------------------------------------------------------------
  // SCENARIO 10: Verify offline cache and subsequent synchronization
  // ---------------------------------------------------------------------------
  console.log("\n--- SCENARIO 10: Offline cache and synchronization ---");
  // 1. Verify moved questions exist in cloudCacheQuestions with new topicId
  const movedCloudQuestions = diskState.cloudCacheQuestions.filter((q: any) => fiveMove.includes(q.id));
  assert(movedCloudQuestions.length === 5, "Scenario 10: All 5 moved questions recorded in cloudCacheQuestions");
  assert(movedCloudQuestions.every((q: any) => q.topicId === topicZeroId), "Scenario 10: All 5 moved questions have target topicId in cloudCache");
  assert(movedCloudQuestions.every((q: any) => q.chapterId === ch1Id), "Scenario 10: All 5 moved questions have target chapterId in cloudCache");

  // 2. Verify all 5 moved questions are staged in editedQuestions ledger for remote sync
  const allEdited = fiveMove.every((id: string) => diskState.editedQuestions[id]?.topicId === topicZeroId);
  assert(allEdited, "Scenario 10: All 5 moved questions staged in editedQuestions ledger for sync");

  // 3. Test moving customQuestions explicitly
  const customQ: Question = {
    id: "usr-q-custom-sync-001",
    text: "कस्टम प्रश्न सिंक टेस्ट",
    options: ["1", "2", "3", "4"],
    correctIndex: 0,
    explanation: "कस्टम प्रश्न व्याख्या",
    chapterId: ch1Id,
    topicId: topic50Id,
    subjectId,
  };
  diskState.customQuestions = [customQ];
  const qMapWithCustom = { ...questionsMap, [customQ.id]: customQ };
  const storeAfterCustomMove = bulkMoveQuestions(diskState, [customQ.id], ch1Id, topicZeroId, qMapWithCustom, subjectId);
  assert(storeAfterCustomMove.customQuestions[0].topicId === topicZeroId, "Scenario 10: customQuestions store updated with target topicId");

  console.log("\n================================================================================");
  console.log("          ALL 10 CHECKPOINT 7 SCENARIOS PASSED 100%                             ");
  console.log("================================================================================\n");
}

runCheckpoint7E2E().catch(err => {
  console.error("Checkpoint 7 Error:", err);
  process.exit(1);
});
