import { initializeApp } from "firebase/app";
import { initializeFirestore, collection, query, where, getDocs } from "firebase/firestore";
import appletConfig from "../firebase-applet-config.json";

async function findTargetQuestions() {
  const app = initializeApp(appletConfig);
  const db = initializeFirestore(app, {}, appletConfig.firestoreDatabaseId || "(default)");
  const mcqsRef = collection(db, "mcqs");
  
  // Search for the specific question in the screenshot
  const snap = await getDocs(mcqsRef);
  const docs = snap.docs.map(d => ({ id: d.id, ...d.data() as any }));
  
  const targetText = "किशनसिंह";
  const matches = docs.filter(d => d.text && d.text.includes(targetText));
  
  console.log(`Found ${matches.length} matches for "${targetText}"`);
  matches.forEach(m => {
    console.log(` - ID: ${m.id} | TopicId: ${m.topicId} | ChapterId: ${m.chapterId} | isUserAdded: ${m.isUserAdded}`);
  });

  if (matches.length > 0) {
    const tId = matches[0].topicId;
    const sameTopic = docs.filter(d => d.topicId === tId);
    console.log(`\nTotal questions in the SAME topic (${tId}): ${sameTopic.length}`);
    console.log(`Base: ${sameTopic.filter(d => !d.isUserAdded).length} | Custom: ${sameTopic.filter(d => d.isUserAdded).length}`);
  }
}

findTargetQuestions().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
