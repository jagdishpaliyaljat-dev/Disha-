import { initializeApp } from "firebase/app";
import { initializeFirestore, collection, getDocs } from "firebase/firestore";
import appletConfig from "../firebase-applet-config.json";

async function diagnoseOrphanedMCQs() {
  const app = initializeApp(appletConfig);
  const db = initializeFirestore(app, {}, appletConfig.firestoreDatabaseId || "(default)");
  const mcqsRef = collection(db, "mcqs");
  
  const snap = await getDocs(mcqsRef);
  const docs = snap.docs.map(d => ({ id: d.id, ...d.data() as any }));
  
  console.log(`Analyzing ${docs.length} MCQs...`);
  
  const targetTitle = "MCQ 3";
  const targetId = "custom-topic-1793306697578-t3ce7";
  
  const matchesByTitle = docs.filter(d => 
    (d.topicTitle && d.topicTitle.includes(targetTitle)) || 
    (d.topicName && d.topicName.includes(targetTitle)) ||
    (d.topic && typeof d.topic === "string" && d.topic.includes(targetTitle))
  );
  
  console.log(`Found ${matchesByTitle.length} docs matching title "${targetTitle}"`);
  
  const groupsByTopicId = new Map<string, any[]>();
  matchesByTitle.forEach(m => {
    const list = groupsByTopicId.get(m.topicId || "UNDEFINED") || [];
    list.push(m);
    groupsByTopicId.set(m.topicId || "UNDEFINED", list);
  });
  
  console.log("\nGroups by Topic ID:");
  groupsByTopicId.forEach((list, tid) => {
    console.log(` - Topic ID: ${tid} | Count: ${list.length}`);
    if (list.length > 0) {
      console.log(`   Sample Chapter ID: ${list[0].chapterId}`);
      console.log(`   Sample Subject ID: ${list[0].subjectId}`);
    }
  });

  // Check specifically for Prajamandal chapter
  const prajaChapterId = "custom-ch-1793292191934-f9c1l";
  const prajaDocs = docs.filter(d => d.chapterId === prajaChapterId);
  console.log(`\nTotal docs in Prajamandal Chapter: ${prajaDocs.length}`);
  
  const prajaByTopicId = new Map<string, any[]>();
  prajaDocs.forEach(d => {
    const list = prajaByTopicId.get(d.topicId || "UNDEFINED") || [];
    list.push(d);
    prajaByTopicId.set(d.topicId || "UNDEFINED", list);
  });
  
  console.log("Prajamandal docs by Topic ID:");
  prajaByTopicId.forEach((list, tid) => {
    console.log(` - Topic ID: ${tid} | Count: ${list.length}`);
  });
}

diagnoseOrphanedMCQs().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
