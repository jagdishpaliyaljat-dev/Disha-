import { 
  addSubject, 
  editSubject, 
  editTopic, 
  getCombinedSubjects, 
  getCombinedChapters, 
  deduplicateQuestions
} from "../src/utils/questionsStorage";
import { 
  getSubjectDisplayName, 
  getChapterDisplayName, 
  getTopicDisplayName 
} from "../src/utils/curriculumUtils";
import { Subject, Chapter, Topic, Question, UserQuestionsStore } from "../src/types";

export function runCurriculumIntegrityChecks(): void {
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

  // 1. Create a new Subject
  const newSubject: Subject = {
    id: "subj-test-raj-geo",
    name: "Rajasthan Geography",
    hindiName: "राजस्थान का भूगोल",
    order: 1,
  };
  let store = addSubject(initialStore, newSubject);
  const combined = getCombinedSubjects(store);
  const match = combined.find(s => s.id === "subj-test-raj-geo");
  if (!match || getSubjectDisplayName(match) !== "Rajasthan Geography") {
    throw new Error("Subject creation or display name failed");
  }

  // 2 & 3. Create Chapter and Topic
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
  const combinedCh = getCombinedChapters(store);
  const chMatch = combinedCh.find(c => c.id === "ch-van-sampada");
  if (!chMatch || getChapterDisplayName(chMatch) !== "Forest Wealth") {
    throw new Error("Chapter creation or display name failed");
  }

  const topMatch = chMatch.topics.find(t => t.id === "top-mcq-01");
  if (!topMatch || getTopicDisplayName(topMatch) !== "MCQ 01") {
    throw new Error("Topic title 'MCQ 01' was altered unexpectedly");
  }

  // 4. Rename a Topic intentionally
  const updatedTopic: Topic = {
    ...topic,
    title: "Forest Types & Conservation",
    hindiTitle: "वनों के प्रकार एवं संरक्षण",
  };
  store = editTopic(store, updatedTopic);
  const topRenamedMatch = (store.customTopics || []).find(t => t.id === "top-mcq-01");
  if (!topRenamedMatch || topRenamedMatch.id !== "top-mcq-01" || topRenamedMatch.title !== "Forest Types & Conservation") {
    throw new Error("Topic rename failed to preserve permanent ID or updated title");
  }

  // 7, 8, 9 & Van Sampada Incident Verification
  const mcq1: Question = {
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
    cloudCacheQuestions: [mcq1],
  };

  const combinedChs = getCombinedChapters(store);
  const targetCh = combinedChs.find(c => c.id === "ch-van-sampada");
  const targetTopic = targetCh?.topics.find(t => t.id === "top-mcq-01");

  if (!targetTopic || targetTopic.questions.length !== 1 || targetTopic.questions[0].id !== "usr-q-top-van-mcq1-001") {
    throw new Error("MCQs failed to associate with target topic under chapter");
  }

  // 10. Edit an MCQ without changing ID
  const updatedMcq = { ...mcq1, text: "Updated Question Text" };
  store = { ...store, editedQuestions: { [mcq1.id]: updatedMcq } };
  const allQs = getCombinedChapters(store).flatMap(c => c.topics.flatMap(t => t.questions));
  const editedMatch = allQs.find(q => q.id === "usr-q-top-van-mcq1-001");
  if (!editedMatch || editedMatch.text !== "Updated Question Text") {
    throw new Error("MCQ edit failed");
  }

  // 13, 14, 15. Deduplication
  const q1: Question = { id: "q1", topicId: "t1", chapterId: "c1", text: "Q1", options: ["A", "B"], correctIndex: 0, explanation: "E1" };
  const q2: Question = { id: "q2", topicId: "t1", chapterId: "c1", text: "Q2", options: ["A", "B"], correctIndex: 0, explanation: "E2" };
  const q1Duplicate: Question = { id: "q1", topicId: "t1", chapterId: "c1", text: "Q1", options: ["A", "B"], correctIndex: 0, explanation: "E1" };

  const deduped = deduplicateQuestions([q1, q2, q1Duplicate]);
  if (deduped.length !== 2) {
    throw new Error("Deduplication failed");
  }
}
