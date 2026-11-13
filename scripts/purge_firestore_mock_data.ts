import { initializeApp } from "firebase/app";
import { initializeFirestore, collection, getDocs, deleteDoc, doc, setDoc } from "firebase/firestore";
import appletConfig from "../firebase-applet-config.json";

const firebaseConfig = {
  apiKey: appletConfig.apiKey,
  authDomain: appletConfig.authDomain,
  projectId: appletConfig.projectId,
  storageBucket: appletConfig.storageBucket,
  messagingSenderId: appletConfig.messagingSenderId,
  appId: appletConfig.appId,
};

const app = initializeApp(firebaseConfig);
const db = initializeFirestore(
  app,
  { experimentalForceLongPolling: true },
  appletConfig.firestoreDatabaseId || "(default)"
);

async function checkAndPurge() {
  console.log("Checking Firestore database:", appletConfig.firestoreDatabaseId);
  const collectionsToCheck = [
    "pyqPapers",
    "liveTests",
    "examCategories",
    "curriculum",
    "examPaperAnalyses",
    "banners",
    "questions",
    "chapters",
    "topics",
    "subjects",
    "adminAuditLogs"
  ];

  for (const colName of collectionsToCheck) {
    try {
      const snap = await getDocs(collection(db, colName));
      console.log(`Collection [${colName}]: ${snap.size} documents found.`);
      for (const d of snap.docs) {
        console.log(`  Deleting [${colName}/${d.id}]...`);
        try {
          await deleteDoc(d.ref);
        } catch (e: any) {
          console.warn(`  Failed to delete [${colName}/${d.id}]:`, e.message);
        }
      }
    } catch (err: any) {
      console.log(`Collection [${colName}] error/rules:`, err.message);
    }
  }

  // Also check /curriculum/main if it exists
  try {
    const mainDocRef = doc(db, "curriculum", "main");
    await deleteDoc(mainDocRef);
    console.log("Deleted curriculum/main document if existed");
  } catch (err: any) {
    console.log("curriculum/main delete error:", err.message);
  }

  process.exit(0);
}

checkAndPurge().catch((e) => {
  console.error("Purge error:", e);
  process.exit(1);
});
