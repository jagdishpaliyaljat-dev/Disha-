import { initializeApp } from "firebase/app";
import { initializeFirestore, collection, getDocs, query, where } from "firebase/firestore";
import appletConfig from "../firebase-applet-config.json";

async function findOrphans() {
  const app = initializeApp(appletConfig);
  const db = initializeFirestore(app, {}, appletConfig.firestoreDatabaseId || "(default)");
  
  const mcqsRef = collection(db, "mcqs");
  const allSnap = await getDocs(mcqsRef);
  const allMcqs = allSnap.docs.map(d => ({ id: d.id, ...d.data() as any }));
  
  const orphans = allMcqs.filter(q => !q.topicId || !q.chapterId);
  console.log(`Found ${orphans.length} orphans in the entire database.`);
  orphans.forEach(o => {
    console.log(` - ID: ${o.id} | Topic: ${o.topicId} | Chapter: ${o.chapterId} | Text: ${o.text?.slice(0, 50)}`);
  });
}

findOrphans().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
