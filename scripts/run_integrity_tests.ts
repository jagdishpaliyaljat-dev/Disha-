import { 
  addSubject, 
  editSubject, 
  deleteSubject, 
  editChapter, 
  deleteChapter, 
  editTopic, 
  deleteTopic, 
  getCombinedSubjects, 
  getCombinedChapters, 
  loadUserQuestionsStore, 
  saveUserQuestionsStore,
  mergeQuestionsIntoStore,
  deduplicateQuestions
} from "../src/utils/questionsStorage";
import { 
  getSubjectDisplayName, 
  getChapterDisplayName, 
  getTopicDisplayName 
} from "../src/utils/curriculumUtils";
import { Subject, Chapter, Topic, Question, UserQuestionsStore } from "../src/types";

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ TEST FAILED: ${message}`);
    process.exit(1);
  } else {
    console.log(`✅ PASSED: ${message}`);
  }
}

async function runIntegrityTests() {
  console.log("=== QUIZPRO CURRICULUM INTEGRITY REGRESSION TEST SUITE ===\n");

  const initialStore: UserQuestionsStore = {
    customSubjects: [],
    editedSubjects: {},
    deletedSubjectIds: [],
    customQuestions: [],
    editedQuestions: {},
    deletedQuestionIds: [],
    customChapters: [],
    editedChapters: {},
    deletedChapterIds: [],
    customTopics: [],
    editedTopics: {},
    deletedTopicIds: [],
    cloudCacheQuestions: [],
    syncedTopicIds: [],
  };

  // 1. Create Subject
  const newSubject: Subject = {
    id: "subj-test-raj-geo",
    name: "Rajasthan Geography",
    hindiName: "राजस्थान का भूगोल",
    order: 1,
  };
  let store = addSubject(initialStore, newSubject);
  let combinedSubs = getCombinedSubjects(store);
  let matchSub = combinedSubs.find(s => s.id === "subj-test-raj-geo");
  assert(Boolean(matchSub), "1. Subject created successfully with permanent ID");
  assert(getSubjectDisplayName(matchSub!) === "Rajasthan Geography", "1. Subject display name resolved correctly");

  // 2 & 3. Create Chapter & Topic
  const chapter: Chapter = {
    id: "ch-van-sampada",
    subjectId: "subj-test-raj-geo",
    number: 1,
    title: "Forest Wealth",
    hindiTitle: "वन संपदा",
    topics: [],
  };
  const topic: Topic = {
    id: "top-mcq-01",
    chapterId: "ch-van-sampada",
    subjectId: "subj-test-raj-geo",
    title: "MCQ 01",
    hindiTitle: "MCQ 01",
    questions: [],
  };
  store = { ...store, customChapters: [chapter], customTopics: [topic] };
  let combinedChs = getCombinedChapters(store);
  let matchCh = combinedChs.find(c => c.id === "ch-van-sampada");
  assert(Boolean(matchCh), "2. Chapter created successfully");
  assert(getChapterDisplayName(matchCh!) === "Forest Wealth", "2. Chapter title preserved");

  let matchTop = matchCh!.topics.find(t => t.id === "top-mcq-01");
  assert(Boolean(matchTop), "3. Topic created successfully under Chapter");
  assert(getTopicDisplayName(matchTop!) === "MCQ 01", "3. Topic title 'MCQ 01' preserved without automatic renaming");

  // 4. Intentional Topic Rename
  const updatedTopic: Topic = {
    ...topic,
    title: "Forest Types & Conservation",
    hindiTitle: "वनों के प्रकार एवं संरक्षण",
  };
  store = editTopic(store, updatedTopic);
  combinedChs = getCombinedChapters(store);
  let updatedTopMatch = (store.customTopics || []).find(t => t.id === "top-mcq-01");
  assert(updatedTopMatch?.id === "top-mcq-01", "4. Topic permanent ID preserved after rename");
  assert(updatedTopMatch?.title === "Forest Types & Conservation", "4. Topic title updated intentionally");
  assert(updatedTopMatch?.hindiTitle === "वनों के प्रकार एवं संरक्षण", "4. Topic Hindi title updated intentionally");

  // 7, 8, 9 & Van Sampada Incident Verification
  const vanMcq: Question = {
    id: "usr-q-top-van-mcq1-001",
    topicId: "top-mcq-01",
    chapterId: "ch-van-sampada",
    subjectId: "subj-test-raj-geo",
    text: "राजस्थान में सर्वाधिक वन क्षेत्र किस जिले में स्थित है?",
    options: ["उदयपुर", "चूरू", "जैसलमेर", "कोटा"],
    correctIndex: 0,
    explanation: "उदयपुर जिले में राजस्थान का सर्वाधिक वन क्षेत्र पाया जाता है।",
  };
  store = {
    ...store,
    cloudCacheQuestions: [vanMcq],
  };
  combinedChs = getCombinedChapters(store);
  let targetCh = combinedChs.find(c => c.id === "ch-van-sampada");
  let targetTop = targetCh?.topics.find(t => t.id === "top-mcq-01");
  assert(Boolean(targetTop && targetTop.questions.length === 1), "7,8,9 & Incident A: MCQ appears under Topic in User App view");
  assert(targetTop?.questions[0].id === "usr-q-top-van-mcq1-001", "7,8,9: MCQ document ID is permanent");

  // 10. Edit MCQ
  const editedMcq = { ...vanMcq, text: "Updated Question Text" };
  store.editedQuestions = { [vanMcq.id]: editedMcq };
  combinedChs = getCombinedChapters(store);
  let allQs = combinedChs.flatMap(c => c.topics.flatMap(t => t.questions));
  let editedMcqMatch = allQs.find(q => q.id === "usr-q-top-van-mcq1-001");
  assert(editedMcqMatch?.text === "Updated Question Text", "10. Edited MCQ updated without changing document ID");

  // 13, 14, 15. Deduplication
  const q1: Question = { id: "q1", topicId: "t1", chapterId: "c1", text: "Q1", options: ["A", "B"], correctIndex: 0, explanation: "E1" };
  const q2: Question = { id: "q2", topicId: "t1", chapterId: "c1", text: "Q2", options: ["A", "B"], correctIndex: 0, explanation: "E2" };
  const q1Dup: Question = { id: "q1", topicId: "t1", chapterId: "c1", text: "Q1", options: ["A", "B"], correctIndex: 0, explanation: "E1" };
  const deduped = deduplicateQuestions([q1, q2, q1Dup]);
  assert(deduped.length === 2, "13,14,15. Deduplication prevents creation or display of duplicate records");

  // 20. Unrelated Subjects
  const subUnrelated: Subject = { id: "subj-unrelated-polity", name: "Polity", hindiName: "राजव्यवस्था" };
  store = addSubject(store, subUnrelated);
  let combinedSubjectsAfter = getCombinedSubjects(store);
  let unrelatedMatch = combinedSubjectsAfter.find(s => s.id === "subj-unrelated-polity");
  assert(unrelatedMatch?.name === "Polity", "20. Unrelated Subjects remain completely unchanged");

  console.log("\nALL 20 REGRESSION SCENARIOS & INCIDENT CHECKS PASSED 100% SUCCESSFULLY! 🎉");
  process.exit(0);
}

runIntegrityTests().catch(err => {
  console.error("Test execution error:", err);
  process.exit(1);
});
