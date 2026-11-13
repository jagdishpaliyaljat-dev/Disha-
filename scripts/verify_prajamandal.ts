import { initializeApp } from "firebase/app";
import { initializeFirestore, collection, query, where, getDocs } from "firebase/firestore";
import appletConfig from "../firebase-applet-config.json";

async function verifyPrajamandal() {
  const app = initializeApp(appletConfig);
  const db = initializeFirestore(app, {}, appletConfig.firestoreDatabaseId || "(default)");
  
  const topicsSnap = await getDocs(collection(db, "topics"));
  const topics = topicsSnap.docs.map(d => ({ id: d.id, ...d.data() as any }));
  
  console.log("Searching for all MCQ topics...");
  const mcqsRef = collection(db, "mcqs");
  
  for (const t of topics) {
    if (t.title?.includes("MCQ") || t.hindiTitle?.includes("MCQ")) {
      const q = query(mcqsRef, where("topicId", "==", t.id));
      const snap = await getDocs(q);
      const docs = snap.docs.map(d => d.data());
      const total = docs.length;
      const custom = docs.filter(d => d.isUserAdded).length;
      const base = total - custom;
      console.log(`Topic: ${t.title} (${t.id}) | Chapter: ${t.chapterId} | Total: ${total} | Base: ${base} | Custom: ${custom}`);
    }
  }
}

verifyPrajamandal().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
