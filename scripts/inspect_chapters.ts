import { initializeApp } from "firebase/app";
import { initializeFirestore, collection, getDocs } from "firebase/firestore";
import appletConfig from "../firebase-applet-config.json";

async function inspectChapters() {
  const app = initializeApp(appletConfig);
  const db = initializeFirestore(app, {}, appletConfig.firestoreDatabaseId || "(default)");
  const snap = await getDocs(collection(db, "chapters"));
  snap.docs.forEach(d => {
    const data = d.data();
    console.log(`Chapter: ${data.title} / ${data.hindiTitle} | ID: ${d.id}`);
  });
}

inspectChapters().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
