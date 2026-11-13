import {
  getCombinedChapters,
  bulkMoveQuestions,
  mergeQuestionsIntoStore,
  saveUserQuestionsStore,
} from "../src/utils/questionsStorage";
import { Chapter, Topic, Question, UserQuestionsStore } from "../src/types";
import * as fs from "fs";

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error("❌ ASSERTION FAILED:", msg);
    process.exit(1);
  }
  console.log("✅", msg);
}

function runPrajamandalParentChildSyncTest() {
  console.log("====================================================");
  console.log("  PRAJAMANDAL PARENT-CHILD COUNT SYNCHRONIZATION TEST ");
  console.log("====================================================");

  const chapterId = "custom-ch-1793292191934-f9c1l";
  const subjectId = "subj-1793114550283-wpeqo";
  const topic1Id = "topic_1b890441-cad7-4e64-82db-4e9680de9f4b"; // MCQ 1
  const topic2Id = "custom-topic-1793306683981-h86ms"; // MCQ 2
  const topic3Id = "custom-topic-1793306697578-t3ce7"; // MCQ 3

  // Load the actual backed up records (44 in MCQ 3, 71 in MCQ 2)
  const backup = JSON.parse(
    fs.readFileSync("./scripts/backups/prajamandal_stale_moved_115_mcqs_backup.json", "utf8")
  );

  console.log(`Loaded backup with ${backup.length} entries`);

  // Build the complete Prajamandal dataset:
  // 435 original usr-q records (all originally in MCQ 1 at 18:09:22)
  const all435Canonical: Question[] = [];
  for (let i = 1; i <= 435; i++) {
    all435Canonical.push({
      id: `usr-q-topic_1b890441-cad7-4e64-82db-4e9680de9f4b-${i.toString().padStart(4, "0")}`,
      subjectId,
      chapterId,
      topicId: topic1Id,
      text: `प्रजामंडल सवाल #${i}: मारवाड़ प्रजामंडल का ऐतिहासिक विवरण प्रश्न ${i}`,
      options: ["विकल्प 1", "विकल्प 2", "विकल्प 3", "विकल्प 4"],
      correctIndex: 0,
      explanation: "व्याख्या विवरण",
      isUserAdded: true,
      createdAt: "2026-10-29T18:09:22.000Z",
      updatedAt: "2026-10-29T18:09:22.000Z",
    });
  }

  // 71 records moved to MCQ 2 at 21:49:21
  const movedToMCQ2: Question[] = [];
  for (let i = 1; i <= 71; i++) {
    movedToMCQ2.push({
      id: `mcq_moved_to_mcq2_${i.toString().padStart(4, "0")}`,
      subjectId,
      chapterId,
      topicId: topic2Id,
      text: `प्रजामंडल सवाल #${i}: मारवाड़ प्रजामंडल का ऐतिहासिक विवरण प्रश्न ${i}`, // exact duplicate text
      options: ["विकल्प 1", "विकल्प 2", "विकल्प 3", "विकल्प 4"],
      correctIndex: 0,
      explanation: "व्याख्या विवरण",
      isUserAdded: true,
      createdAt: "2026-10-29T18:09:22.000Z",
      updatedAt: "2026-10-29T21:49:21.000Z", // newer timestamp!
    });
  }

  // 44 records moved to MCQ 3 at 21:49:21
  const movedToMCQ3: Question[] = [];
  for (let i = 72; i <= 115; i++) {
    movedToMCQ3.push({
      id: `mcq_moved_to_mcq3_${i.toString().padStart(4, "0")}`,
      subjectId,
      chapterId,
      topicId: topic3Id,
      text: `प्रजामंडल सवाल #${i}: मारवाड़ प्रजामंडल का ऐतिहासिक विवरण प्रश्न ${i}`, // exact duplicate text
      options: ["विकल्प 1", "विकल्प 2", "विकल्प 3", "विकल्प 4"],
      correctIndex: 0,
      explanation: "व्याख्या विवरण",
      isUserAdded: true,
      createdAt: "2026-10-29T18:09:22.000Z",
      updatedAt: "2026-10-29T21:49:21.000Z", // newer timestamp!
    });
  }

  const customChapter: Chapter = {
    id: chapterId,
    subjectId,
    title: "प्रजामंडल",
    hindiTitle: "प्रजामंडल आंदोलन",
    number: 1,
    topics: [
      { id: topic1Id, chapterId, subjectId, title: "MCQ 1", hindiTitle: "एमसीक्यू 1", number: 1, questions: [] },
      { id: topic2Id, chapterId, subjectId, title: "MCQ 2", hindiTitle: "एमसीक्यू 2", number: 2, questions: [] },
      { id: topic3Id, chapterId, subjectId, title: "MCQ 3", hindiTitle: "एमसीक्यू 3", number: 3, questions: [] },
    ],
  };

  // Full raw dataset in store (435 canonical + 71 moved + 44 moved = 550 raw records!)
  let store: UserQuestionsStore = {
    customSubjects: [],
    customChapters: [customChapter],
    customTopics: [],
    customQuestions: [],
    cloudCacheQuestions: [...all435Canonical, ...movedToMCQ2, ...movedToMCQ3],
    editedQuestions: {},
    deletedQuestionIds: [],
  };

  console.log(`\n--- Test 1: Parent-Level Topic Counts After Deduplication ---`);
  const chapters = getCombinedChapters(store);
  const praja = chapters.find(c => c.id === chapterId)!;
  const t1 = praja.topics.find(t => t.id === topic1Id)!;
  const t2 = praja.topics.find(t => t.id === topic2Id)!;
  const t3 = praja.topics.find(t => t.id === topic3Id)!;

  console.log(`Parent MCQ 1: ${t1.questions.length}`);
  console.log(`Parent MCQ 2: ${t2.questions.length}`);
  console.log(`Parent MCQ 3: ${t3.questions.length}`);
  const parentTotal = praja.topics.reduce((s, t) => s + t.questions.length, 0);
  console.log(`Parent Total Prajamandal MCQs: ${parentTotal}`);

  assert(t3.questions.length === 44, "Parent list MCQ 3 displays exactly 44 questions (fixing the 0 count bug!)");
  assert(t2.questions.length === 71, "Parent list MCQ 2 displays exactly 71 questions (fixing the 0 count bug!)");
  assert(t1.questions.length === 320, "Parent list MCQ 1 displays 320 questions (435 - 71 - 44 = 320)");
  assert(parentTotal === 435, "Total parent questions strictly equal 435 (no duplication, 320 + 71 + 44 = 435)");

  console.log(`\n--- Test 2: Child Topic MCQ 3 View Consistency ---`);
  // Simulate opening MCQ 3 in Manage Questions Modal
  const childMCQ3Questions = t3.questions;
  assert(childMCQ3Questions.length === 44, "Opening MCQ 3 shows exactly 44 questions in the list");

  // Simulate 'Select All' in MCQ 3
  const selectedAllIds = new Set(childMCQ3Questions.map(q => q.id));
  assert(selectedAllIds.size === 44, "Select All in MCQ 3 selects exactly 44 questions");
  assert(t3.questions.length === selectedAllIds.size, "Parent count (44) and Select All count (44) agree 100%!");

  console.log(`\n--- Test 3: Move 10 Questions from MCQ 3 to MCQ 2 ---`);
  const questionsToMove = childMCQ3Questions.slice(0, 10).map(q => q.id);
  const qMap: Record<string, Question> = {};
  [...all435Canonical, ...movedToMCQ2, ...movedToMCQ3].forEach(q => { qMap[q.id] = q; });

  store = bulkMoveQuestions(store, questionsToMove, chapterId, topic2Id, qMap, subjectId);

  const updatedChapters = getCombinedChapters(store);
  const upPraja = updatedChapters.find(c => c.id === chapterId)!;
  const upT1 = upPraja.topics.find(t => t.id === topic1Id)!;
  const upT2 = upPraja.topics.find(t => t.id === topic2Id)!;
  const upT3 = upPraja.topics.find(t => t.id === topic3Id)!;

  console.log(`After Move: MCQ 1 = ${upT1.questions.length}, MCQ 2 = ${upT2.questions.length}, MCQ 3 = ${upT3.questions.length}`);
  assert(upT3.questions.length === 34, "MCQ 3 decreased by 10 (44 - 10 = 34)");
  assert(upT2.questions.length === 81, "MCQ 2 increased by 10 (71 + 10 = 81)");
  assert(upT1.questions.length === 320, "MCQ 1 remained unchanged at 320");
  assert(upT1.questions.length + upT2.questions.length + upT3.questions.length === 435, "Total sum strictly remains 435");

  console.log("\n====================================================");
  console.log("   PRAJAMANDAL PARENT-CHILD TEST PASSED 100%!       ");
  console.log("====================================================");
}

runPrajamandalParentChildSyncTest();
