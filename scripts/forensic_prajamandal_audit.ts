import { initializeApp } from "firebase/app";
import { initializeFirestore, collection, getDocs, query, where } from "firebase/firestore";
import appletConfig from "../firebase-applet-config.json";
import { normalizeQuestionText } from "../src/utils/scanMcqDuplicates";
import { generateQuestionHash } from "../src/lib/mcqImport/dedupe";

async function forensicAudit() {
  const app = initializeApp(appletConfig);
  const db = initializeFirestore(app, {}, appletConfig.firestoreDatabaseId || "(default)");
  
  const chId = "custom-ch-1793292191934-f9c1l";
  const mcqsRef = collection(db, "mcqs");
  
  // Fetch all MCQs in the Prajamandal chapter
  const snap = await getDocs(query(mcqsRef, where("chapterId", "==", chId)));
  const allMcqs = snap.docs.map(d => ({ id: d.id, ...d.data() as any }));
  
  console.log(`Total MCQs in Chapter ${chId}: ${allMcqs.length}`);
  
  // Group by topicId
  const byTopic = new Map<string, any[]>();
  allMcqs.forEach(q => {
    const tid = q.topicId || "UNDEFINED";
    if (!byTopic.has(tid)) byTopic.set(tid, []);
    byTopic.get(tid)!.push(q);
  });
  
  console.log("\nTOPIC DISTRIBUTION:");
  byTopic.forEach((list, tid) => {
    console.log(` - ${tid}: ${list.length} documents`);
  });

  // Analyze duplicates by text hash
  const textGroups = new Map<string, any[]>();
  allMcqs.forEach(q => {
    const text = (q.text || "").trim();
    const hash = generateQuestionHash({
        question: text,
        options: q.options || [],
        answer: ["A", "B", "C", "D", "E"][q.correctIndex ?? 0] || "A"
    } as any);
    
    if (!textGroups.has(hash)) textGroups.set(hash, []);
    textGroups.get(hash)!.push(q);
  });

  console.log(`\nUnique logical questions in chapter: ${textGroups.size}`);
  
  const duplicates = Array.from(textGroups.entries()).filter(([hash, list]) => list.length > 1);
  console.log(`Number of text-identical question groups: ${duplicates.length}`);
  
  // Detailed look at duplicates
  console.log("\nSTALE MOVE COPIES (DUPLICATES ACROSS TOPICS OR IDs):");
  let staleCount = 0;
  duplicates.forEach(([hash, list]) => {
    const topics = new Set(list.map(q => q.topicId));
    const ids = list.map(q => q.id);
    staleCount += list.length - 1;
    console.log(`\nQuestion: "${list[0].text?.slice(0, 50)}..."`);
    console.log(` - Hash: ${hash}`);
    console.log(` - Doc IDs: ${ids.join(", ")}`);
    console.log(` - Current Topic IDs: ${Array.from(topics).join(", ")}`);
  });
  
  console.log(`\nTotal redundant records found in Prajamandal: ${staleCount}`);

  // GLOBAL ORPHAN CHECK
  const allSnap = await getDocs(mcqsRef);
  const allGlobalMcqs = allSnap.docs.map(d => ({ id: d.id, ...d.data() as any }));
  
  const subjectsSnap = await getDocs(collection(db, "subjects"));
  const chaptersSnap = await getDocs(collection(db, "chapters"));
  const topicsSnap = await getDocs(collection(db, "topics"));
  
  const validSubjectIds = new Set(subjectsSnap.docs.map(d => d.id));
  const validChapterIds = new Set(chaptersSnap.docs.map(d => d.id));
  const validTopicIds = new Set(topicsSnap.docs.map(d => d.id));
  
  const orphans = allGlobalMcqs.filter(q => 
    !q.topicId || !validTopicIds.has(q.topicId) || 
    !q.chapterId || !validChapterIds.has(q.chapterId)
  );
  
  console.log(`\nGLOBAL ORPHANS FOUND: ${orphans.length}`);
  orphans.forEach(q => {
    console.log(` - ID: ${q.id} | Topic: ${q.topicId} | Chapter: ${q.chapterId} | Text: ${q.text?.slice(0, 50)}`);
  });

  // Recovery Plan Generation
  console.log("\n--- RECOVERY PLAN DATA ---");
  const recoveryItems = allMcqs.map(q => {
      const text = (q.text || "").trim();
      const hash = generateQuestionHash({
          question: text,
          options: q.options || [],
          answer: ["A", "B", "C", "D", "E"][q.correctIndex ?? 0] || "A"
      } as any);
      return { id: q.id, topicId: q.topicId, hash, text: text.slice(0, 100) };
  });
  
  // We will save this to a file for later processing
  // But for now, let's just identify the 44 MCQ 3 questions.
  // They are likely the ones that are "unique" but assigned to MCQ 1 topicId incorrectly.
  // OR they are duplicates where one is in MCQ 1 and one is (was) in MCQ 3.
}

forensicAudit().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
