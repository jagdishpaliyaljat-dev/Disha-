import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import * as fs from 'fs';
import * as path from 'path';

const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
const firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));

const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId || undefined);

async function testDiagnosticsScan() {
  console.log("=== QUIZPRO — ADMIN READ-ONLY DIAGNOSTICS TEST ===");
  const startTime = performance.now();

  // Read-only scan across all 5 collections
  const [subjectsSnap, chaptersSnap, topicsSnap, mcqsSnap, questionsSnap] = await Promise.all([
    getDocs(collection(db, "subjects")),
    getDocs(collection(db, "chapters")),
    getDocs(collection(db, "topics")),
    getDocs(collection(db, "mcqs")),
    getDocs(collection(db, "questions")),
  ]);

  const subjectsList = subjectsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  const chaptersList = chaptersSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  const topicsList = topicsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  const mcqsList = mcqsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  const questionsList = questionsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

  const subjectsMap = new Map<string, string>();
  subjectsList.forEach(s => subjectsMap.set(s.id, (s as any).name || (s as any).title || "Untitled"));

  const chaptersMap = new Map<string, { title: string; subjectId?: string }>();
  chaptersList.forEach(c => chaptersMap.set(c.id, { title: (c as any).title || (c as any).name || "Untitled", subjectId: (c as any).subjectId }));

  const topicsMap = new Map<string, { title: string; chapterId?: string; subjectId?: string }>();
  topicsList.forEach(t => topicsMap.set(t.id, { title: (t as any).title || (t as any).name || "Untitled", chapterId: (t as any).chapterId }));

  const allUnique = new Map<string, any>();
  const dualWrite = new Set<string>();

  mcqsList.forEach(q => allUnique.set(q.id, { ...q, coll: "mcqs" }));
  questionsList.forEach(q => {
    if (allUnique.has(q.id)) {
      dualWrite.add(q.id);
    } else {
      allUnique.set(q.id, { ...q, coll: "questions" });
    }
  });

  const orphans: any[] = [];
  const mismatches: any[] = [];
  const anomalies: any[] = [];

  allUnique.forEach((q, id) => {
    const qText = q.text || q.question || "";
    if (!qText) anomalies.push({ id, issue: "missing_text" });

    if (q.topicId && !topicsMap.has(q.topicId)) {
      orphans.push({ id, issue: "missing_topic", parentId: q.topicId });
    }

    if (q.topicId && topicsMap.has(q.topicId)) {
      const parentTopic = topicsMap.get(q.topicId)!;
      if (q.topic && typeof q.topic === "string" && q.topic.trim() !== parentTopic.title.trim()) {
        mismatches.push({ id, expected: parentTopic.title, actual: q.topic });
      }
    }
  });

  const durationMs = Math.round(performance.now() - startTime);

  console.log(`Scan duration: ${durationMs}ms`);
  console.log(`Subjects: ${subjectsList.length}`);
  console.log(`Chapters: ${chaptersList.length}`);
  console.log(`Topics: ${topicsList.length}`);
  console.log(`MCQs (mcqs coll): ${mcqsList.length}`);
  console.log(`MCQs (questions coll): ${questionsList.length}`);
  console.log(`Total Physical Docs: ${mcqsList.length + questionsList.length}`);
  console.log(`Unique Logical MCQs: ${allUnique.size}`);
  console.log(`Dual-Write Overlap: ${dualWrite.size}`);
  console.log(`Orphans Detected: ${orphans.length}`);
  console.log(`Topic Title Mismatches Detected: ${mismatches.length}`);
  console.log(`Quality Anomalies Detected: ${anomalies.length}`);

  process.exit(0);
}

testDiagnosticsScan().catch(err => {
  console.error(err);
  process.exit(1);
});
