import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs } from "firebase/firestore";
import fs from "fs";
import path from "path";
import { Subject, Chapter, Topic } from "../src/types";

const configPath = path.resolve(process.cwd(), "firebase-applet-config.json");
const firebaseConfig = JSON.parse(fs.readFileSync(configPath, "utf-8"));

const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

async function runAnalysis() {
  console.log("=== FIRESTORE DATA FORENSIC ANALYSIS ===");

  const [subsSnap, chsSnap, topsSnap, mcqsSnap, qsSnap] = await Promise.all([
    getDocs(collection(db, "subjects")),
    getDocs(collection(db, "chapters")),
    getDocs(collection(db, "topics")),
    getDocs(collection(db, "mcqs")),
    getDocs(collection(db, "questions")),
  ]);

  const subjects = subsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Subject));
  const chapters = chsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Chapter));
  const topics = topsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Topic));
  const mcqs = mcqsSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));
  const questions = qsSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));

  console.log(`Totals -> Subjects: ${subjects.length}, Chapters: ${chapters.length}, Topics: ${topics.length}, MCQs: ${mcqs.length}, Questions: ${questions.length}`);

  console.log("\n--- ALL SUBJECTS ---");
  subjects.forEach(s => {
    console.log(`ID: "${s.id}" | Name: "${s.name}" | Hindi: "${s.hindiName}"`);
  });

  console.log("\n--- ALL CHAPTERS ---");
  chapters.forEach(c => {
    console.log(`ID: "${c.id}" | SubjectID: "${c.subjectId}" | Title: "${c.title}" | HindiTitle: "${c.hindiTitle}" | Topics Array Count: ${Array.isArray((c as any).topics) ? (c as any).topics.length : 0}`);
    if (Array.isArray((c as any).topics)) {
      (c as any).topics.forEach((t: any, idx: number) => {
        console.log(`   -> Topic[${idx}]: ID="${t.id}", Title="${t.title}", Hindi="${t.hindiTitle}", Number=${t.number}`);
      });
    }
  });

  console.log("\n--- ALL TOPICS COLLECTION ---");
  topics.forEach(t => {
    console.log(`ID: "${t.id}" | ChapterID: "${t.chapterId}" | SubjectID: "${t.subjectId}" | Title: "${t.title}" | HindiTitle: "${t.hindiTitle}" | Number: ${t.number}`);
  });

  console.log("\n--- MCQS / QUESTIONS SUMMARY BY TOPIC ID ---");
  const allQs = [...mcqs, ...questions];
  const byTopic = new Map<string, any[]>();
  allQs.forEach((q: any) => {
    const tId = q.topicId || "UNASSIGNED";
    if (!byTopic.has(tId)) byTopic.set(tId, []);
    byTopic.get(tId)!.push(q);
  });

  byTopic.forEach((list, tId) => {
    console.log(`TopicID: "${tId}" -> Count: ${list.length}`);
    list.slice(0, 3).forEach((q, idx) => {
      console.log(`   [${idx}] DocID: "${q.id}" | SubjectID: "${q.subjectId}" | ChapterID: "${q.chapterId}" | Text: "${(q.text || "").slice(0, 60)}..."`);
    });
  });

  // Check specifically for "राजस्थान" or "वन संपदा"
  console.log("\n--- TARGETED SEARCH FOR 'वन संपदा' AND 'राजस्थान जियोग्राफी' ---");
  const rajSubs = subjects.filter((s: any) => 
    (s.name || "").includes("राजस्थान") || (s.hindiName || "").includes("राजस्थान") || (s.name || "").toLowerCase().includes("rajasthan")
  );
  console.log("Matching Subjects:", JSON.stringify(rajSubs, null, 2));

  const vanChaps = chapters.filter((c: any) => 
    (c.title || "").includes("वन संपदा") || (c.hindiTitle || "").includes("वन संपदा") || (c.title || "").toLowerCase().includes("van")
  );
  console.log("Matching Chapters:", JSON.stringify(vanChaps, null, 2));

  const vanTopics = topics.filter((t: any) => 
    (t.title || "").includes("वन संपदा") || (t.hindiTitle || "").includes("वन संपदा")
  );
  console.log("Matching Topics in Topics collection:", JSON.stringify(vanTopics, null, 2));

  process.exit(0);
}

runAnalysis().catch(err => {
  console.error("Analysis Error:", err);
  process.exit(1);
});
