import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs } from "firebase/firestore";
import fs from "fs";
import path from "path";

const configPath = path.resolve(process.cwd(), "firebase-applet-config.json");
const firebaseConfig = JSON.parse(fs.readFileSync(configPath, "utf-8"));

const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

async function runInvestigation() {
  console.log("=== QUIZPRO READ-ONLY FORENSIC INVESTIGATION ===");
  console.log("Timestamp:", new Date().toISOString());
  console.log("Target Database:", firebaseConfig.firestoreDatabaseId);

  // 1. Fetch Subjects
  const subjectsSnap = await getDocs(collection(db, "subjects"));
  const subjects = subjectsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  console.log(`\n--- SUBJECTS (${subjects.length}) ---`);
  subjects.forEach(s => console.log(JSON.stringify(s, null, 2)));

  // 2. Fetch Chapters
  const chaptersSnap = await getDocs(collection(db, "chapters"));
  const chapters = chaptersSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  console.log(`\n--- CHAPTERS (${chapters.length}) ---`);
  chapters.forEach(c => console.log(JSON.stringify(c, null, 2)));

  // 3. Fetch Topics
  const topicsSnap = await getDocs(collection(db, "topics"));
  const topics = topicsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  console.log(`\n--- TOPICS (${topics.length}) ---`);
  topics.forEach(t => console.log(JSON.stringify(t, null, 2)));

  // 4. Fetch MCQs
  const mcqsSnap = await getDocs(collection(db, "mcqs"));
  const mcqs = mcqsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  console.log(`\n--- MCQS (${mcqs.length}) ---`);
  mcqs.forEach(m => console.log(JSON.stringify(m, null, 2)));

  // 5. Fetch Questions
  const questionsSnap = await getDocs(collection(db, "questions"));
  const questions = questionsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  console.log(`\n--- QUESTIONS (${questions.length}) ---`);
  questions.forEach(q => console.log(JSON.stringify(q, null, 2)));

  // 6. Fetch Metadata
  const metaSnap = await getDocs(collection(db, "metadata"));
  const metadata = metaSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  console.log(`\n--- METADATA (${metadata.length}) ---`);
  metadata.forEach(m => console.log(JSON.stringify(m, null, 2)));

  console.log("\n=== INVESTIGATION COMPLETE ===");
  process.exit(0);
}

runInvestigation().catch(err => {
  console.error("Investigation error:", err);
  process.exit(1);
});
