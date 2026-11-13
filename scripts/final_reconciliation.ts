import { initializeApp } from "firebase/app";
import { initializeFirestore, collection, getDocs } from "firebase/firestore";
import appletConfig from "../firebase-applet-config.json";

async function finalReconciliation() {
  const app = initializeApp(appletConfig);
  const db = initializeFirestore(app, {}, appletConfig.firestoreDatabaseId || "(default)");
  const mcqsRef = collection(db, "mcqs");
  
  const snap = await getDocs(mcqsRef);
  const allMcqs = snap.docs.map(d => ({ id: d.id, ...d.data() as any }));
  
  console.log(`Total MCQs in DB: ${allMcqs.length}`);
  
  // Group by topicId
  const byTopic = new Map<string, number>();
  allMcqs.forEach(q => {
    const tid = q.topicId || "UNDEFINED";
    byTopic.set(tid, (byTopic.get(tid) || 0) + 1);
  });
  
  console.log("\nTOPIC ID DISTRIBUTION:");
  byTopic.forEach((count, tid) => {
    console.log(` - ${tid}: ${count}`);
  });

  // Specifically check for questions mentioning Prajamandal in their text
  const prajaKeywords = ["प्रजामंडल", "Prajamandal"];
  const prajaQuestions = allMcqs.filter(q => 
    prajaKeywords.some(k => q.text?.includes(k)) || 
    q.chapterId === "custom-ch-1793292191934-f9c1l"
  );
  
  console.log(`\nTotal logical Prajamandal questions: ${prajaQuestions.length}`);
  
  // Deduplicate by text to see if there are logical duplicates
  const uniqueByText = new Map<string, any>();
  prajaQuestions.forEach(q => {
    const norm = q.text?.trim().toLowerCase();
    if (norm) uniqueByText.set(norm, q);
  });
  
  console.log(`Unique Prajamandal questions by text: ${uniqueByText.size}`);
  console.log(`Redundant records in Prajamandal: ${prajaQuestions.length - uniqueByText.size}`);
}

finalReconciliation().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
