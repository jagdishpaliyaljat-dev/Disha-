import {
  getCombinedChapters,
  bulkMoveQuestions,
} from "../src/utils/questionsStorage";
import { Chapter, Topic, Question, UserQuestionsStore } from "../src/types";

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error("❌ ASSERTION FAILED:", msg);
    process.exit(1);
  }
  console.log("✅", msg);
}

function runPrajamandalReconciliationTest() {
  console.log("====================================================");
  console.log(" PRAJAMANDAL EXACT MOVE RECONCILIATION TEST (435 Qs)");
  console.log("====================================================");

  const chapterId = "custom-ch-1793292191934-f9c1l";
  const subjectId = "subj-1793114550283-wpeqo";
  const topic1Id = "topic_1b890441-cad7-4e64-82db-4e9680de9f4b"; // MCQ 1
  const topic2Id = "custom-topic-1793306683981-h86ms"; // MCQ 2
  const topic3Id = "custom-topic-1793306697578-t3ce7"; // MCQ 3

  // 1. Create 435 canonical usr-q questions in MCQ 1
  const canonicalQuestions: Question[] = [];
  for (let i = 1; i <= 435; i++) {
    canonicalQuestions.push({
      id: `usr-q-topic_1b890441-cad7-4e64-82db-4e9680de9f4b-${i.toString().padStart(4, "0")}`,
      subjectId,
      chapterId,
      topicId: topic1Id,
      text: `प्रजामंडल सवाल #${i}: मारवाड़ प्रजामंडल का ऐतिहासिक विवरण प्रश्न ${i}`,
      options: ["विकल्प 1", "विकल्प 2", "विकल्प 3", "विकल्प 4"],
      correctIndex: 0,
      explanation: "प्रजामंडल आंदोलन ऐतिहासिक व्याख्या।",
      isUserAdded: true,
      createdAt: "2026-10-29T18:00:00.000Z",
      updatedAt: "2026-10-29T18:00:00.000Z",
    });
  }

  // 2. Add 112 duplicate mcq_ copies (mirroring the old broken saveMCQ behavior)
  const duplicateCopies: Question[] = [];
  for (let i = 1; i <= 112; i++) {
    duplicateCopies.push({
      id: `mcq_duplicate_hash_${i.toString().padStart(4, "0")}`,
      subjectId,
      chapterId,
      topicId: topic1Id,
      text: `प्रजामंडल सवाल #${i}: मारवाड़ प्रजामंडल का ऐतिहासिक विवरण प्रश्न ${i}`, // Exact duplicate text
      options: ["विकल्प 1", "विकल्प 2", "विकल्प 3", "विकल्प 4"],
      correctIndex: 0,
      explanation: "प्रजामंडल आंदोलन ऐतिहासिक व्याख्या।",
      isUserAdded: true,
      createdAt: "2026-10-29T22:00:00.000Z",
      updatedAt: "2026-10-29T22:00:00.000Z",
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

  // Initial store with all 435 canonical + 112 duplicate copies (547 total raw docs)
  let store: UserQuestionsStore = {
    customSubjects: [],
    customChapters: [customChapter],
    customTopics: [],
    customQuestions: [],
    cloudCacheQuestions: [...canonicalQuestions, ...duplicateCopies],
    editedQuestions: {},
    deletedQuestionIds: [],
  };

  // Check initial deduplication
  const initChapters = getCombinedChapters(store);
  const initPraja = initChapters.find(c => c.id === chapterId)!;
  const initT1 = initPraja.topics.find(t => t.id === topic1Id)!;
  const initT2 = initPraja.topics.find(t => t.id === topic2Id)!;
  const initT3 = initPraja.topics.find(t => t.id === topic3Id)!;

  console.log(`Initial raw records in store: ${canonicalQuestions.length + duplicateCopies.length} (435 canonical + 112 copies)`);
  console.log(`Deduplicated MCQ 1: ${initT1.questions.length}, MCQ 2: ${initT2.questions.length}, MCQ 3: ${initT3.questions.length}`);

  assert(initT1.questions.length === 435, "Initial MCQ 1 deduplicates 112 clones down to exactly 435 unique questions");
  assert(initT2.questions.length === 0, "Initial MCQ 2 has 0 questions");
  assert(initT3.questions.length === 0, "Initial MCQ 3 has 0 questions");

  // --- MOVE 1: Move 100 questions from MCQ 1 to MCQ 2 ---
  console.log("\n--- Move 1: Moving 100 questions from MCQ 1 to MCQ 2 ---");
  const first100Ids = canonicalQuestions.slice(0, 100).map(q => q.id);
  const qMap: Record<string, Question> = {};
  [...canonicalQuestions, ...duplicateCopies].forEach(q => { qMap[q.id] = q; });

  store = bulkMoveQuestions(store, first100Ids, chapterId, topic2Id, qMap, subjectId);

  let curChapters = getCombinedChapters(store);
  let curPraja = curChapters.find(c => c.id === chapterId)!;
  let t1 = curPraja.topics.find(t => t.id === topic1Id)!;
  let t2 = curPraja.topics.find(t => t.id === topic2Id)!;
  let t3 = curPraja.topics.find(t => t.id === topic3Id)!;

  console.log(`After Move 1: MCQ 1 = ${t1.questions.length}, MCQ 2 = ${t2.questions.length}, MCQ 3 = ${t3.questions.length}`);
  assert(t1.questions.length === 335, "MCQ 1 decreased from 435 to 335 (435 - 100 = 335)");
  assert(t2.questions.length === 100, "MCQ 2 received exactly 100 questions");
  assert(t3.questions.length === 0, "MCQ 3 remains 0 questions");
  assert(t1.questions.length + t2.questions.length + t3.questions.length === 435, "Total Prajamandal count strictly equals 435");

  // --- MOVE 2: Move another 100 questions from MCQ 1 to MCQ 3 ---
  console.log("\n--- Move 2: Moving another 100 questions from MCQ 1 to MCQ 3 ---");
  const next100Ids = canonicalQuestions.slice(100, 200).map(q => q.id);

  store = bulkMoveQuestions(store, next100Ids, chapterId, topic3Id, qMap, subjectId);

  curChapters = getCombinedChapters(store);
  curPraja = curChapters.find(c => c.id === chapterId)!;
  t1 = curPraja.topics.find(t => t.id === topic1Id)!;
  t2 = curPraja.topics.find(t => t.id === topic2Id)!;
  t3 = curPraja.topics.find(t => t.id === topic3Id)!;

  console.log(`After Move 2: MCQ 1 = ${t1.questions.length}, MCQ 2 = ${t2.questions.length}, MCQ 3 = ${t3.questions.length}`);
  assert(t1.questions.length === 235, "MCQ 1 has exactly 235 questions (335 - 100 = 235)");
  assert(t2.questions.length === 100, "MCQ 2 has exactly 100 questions");
  assert(t3.questions.length === 100, "MCQ 3 has exactly 100 questions");
  assert(t1.questions.length + t2.questions.length + t3.questions.length === 435, "Total Prajamandal count strictly preserved at 435!");

  // Verify no questions overlap between topics
  const t1Set = new Set(t1.questions.map(q => q.id));
  const t2Set = new Set(t2.questions.map(q => q.id));
  const t3Set = new Set(t3.questions.map(q => q.id));

  let overlapCount = 0;
  t1.questions.forEach(q => {
    if (t2Set.has(q.id) || t3Set.has(q.id)) overlapCount++;
  });
  t2.questions.forEach(q => {
    if (t3Set.has(q.id)) overlapCount++;
  });

  assert(overlapCount === 0, "Zero questions overlap between MCQ 1, MCQ 2, and MCQ 3");

  console.log("\n====================================================");
  console.log("   PRAJAMANDAL RECONCILIATION VERIFICATION PASSED!   ");
  console.log("====================================================");
}

runPrajamandalReconciliationTest();
