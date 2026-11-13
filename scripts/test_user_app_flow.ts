import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs } from "firebase/firestore";
import fs from "fs";
import path from "path";
import { getCombinedChapters, getCombinedSubjects } from "../src/utils/questionsStorage";
import { UserQuestionsStore, Subject, Chapter, Topic, Question } from "../src/types";

const configPath = path.resolve(process.cwd(), "firebase-applet-config.json");
const firebaseConfig = JSON.parse(fs.readFileSync(configPath, "utf-8"));

const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

async function testUserAppFlow() {
  console.log("=== SIMULATING USER APP CURRICULUM LOADING FLOW ===");

  const [subsSnap, chsSnap, topsSnap, mcqsSnap, qsSnap] = await Promise.all([
    getDocs(collection(db, "subjects")),
    getDocs(collection(db, "chapters")),
    getDocs(collection(db, "topics")),
    getDocs(collection(db, "mcqs")),
    getDocs(collection(db, "questions")),
  ]);

  const loadedSubjects = subsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Subject));
  const loadedChapters = chsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Chapter));
  const loadedTopics = topsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Topic));

  const loadedQuestions: Question[] = [];
  mcqsSnap.docs.forEach(d => loadedQuestions.push({ id: d.id, ...d.data() } as Question));
  qsSnap.docs.forEach(d => loadedQuestions.push({ id: d.id, ...d.data() } as Question));

  console.log(`Loaded from Firestore -> Subjects: ${loadedSubjects.length}, Chapters: ${loadedChapters.length}, Topics: ${loadedTopics.length}, Questions: ${loadedQuestions.length}`);

  // Construct simulated UserQuestionsStore as built by useFirebaseSync.ts
  const simulatedStore: UserQuestionsStore = {
    customSubjects: loadedSubjects,
    customChapters: loadedChapters,
    customTopics: loadedTopics,
    cloudCacheQuestions: loadedQuestions,
    customQuestions: [],
    editedQuestions: {},
    deletedQuestionIds: [],
  };

  const combinedSubjects = getCombinedSubjects(simulatedStore);
  const combinedChapters = getCombinedChapters(simulatedStore);

  console.log(`\nCombined Subjects (${combinedSubjects.length}):`);
  combinedSubjects.forEach(s => {
    console.log(` - Subject ID: "${s.id}" | Name: "${s.name}" | Hindi: "${s.hindiName}"`);
  });

  console.log(`\nCombined Chapters (${combinedChapters.length}):`);
  combinedChapters.forEach(ch => {
    console.log(`\n Chapter ID: "${ch.id}" | SubjectID: "${ch.subjectId}" | Title: "${ch.title}" | Hindi: "${ch.hindiTitle}"`);
    console.log(`   Topics Count: ${ch.topics.length}`);
    ch.topics.forEach((t, idx) => {
      console.log(`     -> [Topic ${idx + 1}] ID: "${t.id}" | Title: "${t.title}" | Hindi: "${t.hindiTitle}" | Questions Count: ${t.questions ? t.questions.length : 0}`);
    });
  });

  process.exit(0);
}

testUserAppFlow().catch(err => {
  console.error("Test Error:", err);
  process.exit(1);
});
