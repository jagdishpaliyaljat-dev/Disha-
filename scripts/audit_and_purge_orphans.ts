import { initializeApp } from "firebase/app";
import { initializeFirestore, collection, getDocs, doc, deleteDoc } from "firebase/firestore";
import appletConfig from "../firebase-applet-config.json";

const firebaseConfig = {
  apiKey: appletConfig.apiKey,
  authDomain: appletConfig.authDomain,
  projectId: appletConfig.projectId,
  storageBucket: appletConfig.storageBucket,
  messagingSenderId: appletConfig.messagingSenderId,
  appId: appletConfig.appId,
};

const app = initializeApp(firebaseConfig);
const db = initializeFirestore(
  app,
  { experimentalForceLongPolling: true },
  appletConfig.firestoreDatabaseId || "(default)"
);

async function findAndPurgeAllOrphans() {
  console.log("=== SCANNING FOR ALL ORPHANED PARENT REFERENCES ===");

  // 1. Fetch all subjects
  const subSnap = await getDocs(collection(db, "subjects"));
  const subjectsMap = new Map<string, any>();
  subSnap.docs.forEach(d => subjectsMap.set(d.id, d.data()));
  console.log(`Active Subjects in DB: ${subjectsMap.size}`);
  subjectsMap.forEach((v, k) => console.log(`  Subject: [${k}] - "${v.name}"`));

  // 2. Fetch all chapters
  const chSnap = await getDocs(collection(db, "chapters"));
  const chaptersMap = new Map<string, any>();
  const orphanedChapters: { id: string; subjectId: string; title: string }[] = [];
  chSnap.docs.forEach(d => {
    const data = d.data();
    chaptersMap.set(d.id, data);
    if (data.subjectId && !subjectsMap.has(data.subjectId)) {
      orphanedChapters.push({ id: d.id, subjectId: data.subjectId, title: data.title });
    }
  });
  console.log(`\nActive Chapters in DB: ${chaptersMap.size}`);
  console.log(`Orphaned Chapters found: ${orphanedChapters.length}`);
  orphanedChapters.forEach(c => console.log(`  - Chapter ${c.id} ("${c.title}") points to missing subjectId '${c.subjectId}'`));

  // 3. Fetch all topics
  const topSnap = await getDocs(collection(db, "topics"));
  const topicsMap = new Map<string, any>();
  const orphanedTopics: { id: string; chapterId: string; subjectId: string; title: string; reason: string }[] = [];
  topSnap.docs.forEach(d => {
    const data = d.data();
    topicsMap.set(d.id, data);
    const missingCh = Boolean(data.chapterId && !chaptersMap.has(data.chapterId));
    const missingSub = Boolean(data.subjectId && !subjectsMap.has(data.subjectId));
    if (missingCh || missingSub) {
      orphanedTopics.push({
        id: d.id,
        chapterId: data.chapterId,
        subjectId: data.subjectId,
        title: data.title,
        reason: `missingCh=${missingCh} ('${data.chapterId}'), missingSub=${missingSub} ('${data.subjectId}')`
      });
    }
  });
  console.log(`\nActive Topics in DB: ${topicsMap.size}`);
  console.log(`Orphaned Topics found: ${orphanedTopics.length}`);
  orphanedTopics.forEach(t => console.log(`  - Topic ${t.id} ("${t.title}"): ${t.reason}`));

  // 4. Fetch all questions
  const qSnap = await getDocs(collection(db, "questions"));
  const orphanedQuestions: { id: string; col: string; topicId: string; chapterId: string; subjectId: string; text: string; reasons: string[] }[] = [];
  qSnap.docs.forEach(d => {
    const data = d.data();
    const reasons: string[] = [];
    if (data.topicId && !topicsMap.has(data.topicId)) {
      reasons.push(`topicId '${data.topicId}' missing`);
    }
    if (data.chapterId && !chaptersMap.has(data.chapterId)) {
      reasons.push(`chapterId '${data.chapterId}' missing`);
    }
    if (data.subjectId && !subjectsMap.has(data.subjectId)) {
      reasons.push(`subjectId '${data.subjectId}' missing`);
    }
    if (reasons.length > 0) {
      orphanedQuestions.push({
        id: d.id,
        col: "questions",
        topicId: data.topicId,
        chapterId: data.chapterId,
        subjectId: data.subjectId,
        text: (data.text || "").slice(0, 50),
        reasons
      });
    }
  });

  // 5. Fetch all mcqs
  const mcqsSnap = await getDocs(collection(db, "mcqs"));
  const orphanedMcqs: { id: string; col: string; topicId: string; chapterId: string; subjectId: string; text: string; reasons: string[] }[] = [];
  mcqsSnap.docs.forEach(d => {
    const data = d.data();
    const reasons: string[] = [];
    if (data.topicId && !topicsMap.has(data.topicId)) {
      reasons.push(`topicId '${data.topicId}' missing`);
    }
    if (data.chapterId && !chaptersMap.has(data.chapterId)) {
      reasons.push(`chapterId '${data.chapterId}' missing`);
    }
    if (data.subjectId && !subjectsMap.has(data.subjectId)) {
      reasons.push(`subjectId '${data.subjectId}' missing`);
    }
    if (reasons.length > 0) {
      orphanedMcqs.push({
        id: d.id,
        col: "mcqs",
        topicId: data.topicId,
        chapterId: data.chapterId,
        subjectId: data.subjectId,
        text: (data.text || "").slice(0, 50),
        reasons
      });
    }
  });

  console.log(`\nActive Questions in 'questions': ${qSnap.size}`);
  console.log(`Orphaned Questions in 'questions': ${orphanedQuestions.length}`);
  orphanedQuestions.slice(0, 10).forEach(q => console.log(`  - [questions/${q.id}]: ${q.reasons.join(", ")} | "${q.text}"`));
  if (orphanedQuestions.length > 10) console.log(`  ... and ${orphanedQuestions.length - 10} more`);

  console.log(`\nActive Questions in 'mcqs': ${mcqsSnap.size}`);
  console.log(`Orphaned MCQs in 'mcqs': ${orphanedMcqs.length}`);
  orphanedMcqs.slice(0, 10).forEach(q => console.log(`  - [mcqs/${q.id}]: ${q.reasons.join(", ")} | "${q.text}"`));
  if (orphanedMcqs.length > 10) console.log(`  ... and ${orphanedMcqs.length - 10} more`);

  process.exit(0);
}

findAndPurgeAllOrphans().catch(console.error);
