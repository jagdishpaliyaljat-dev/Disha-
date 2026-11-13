import { initializeApp } from "firebase/app";
import { initializeFirestore, collection, query, where, getDocs } from "firebase/firestore";
import appletConfig from "../firebase-applet-config.json";

async function inspectPrajamandalTopics() {
  const app = initializeApp(appletConfig);
  const db = initializeFirestore(app, {}, appletConfig.firestoreDatabaseId || "(default)");
  
  const chId = "custom-ch-1793292191934-f9c1l";
  const topicsSnap = await getDocs(query(collection(db, "topics"), where("chapterId", "==", chId)));
  const topics = topicsSnap.docs.map(d => ({ id: d.id, ...d.data() as any }));
  
  console.log(`Topics in Chapter ${chId}:`);
  topics.forEach(t => {
    console.log(` - ID: ${t.id} | Title: ${t.title} | Hindi: ${t.hindiTitle}`);
  });
}

inspectPrajamandalTopics().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
