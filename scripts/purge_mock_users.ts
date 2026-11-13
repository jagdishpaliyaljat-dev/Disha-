import { initializeApp } from "firebase/app";
import { initializeFirestore, collection, getDocs, deleteDoc, doc } from "firebase/firestore";
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

async function checkUsers() {
  const usersSnap = await getDocs(collection(db, "users"));
  console.log(`Users collection has: ${usersSnap.size} documents.`);
  for (const u of usersSnap.docs) {
    console.log(`User: ${u.id}`);
    const subcols = ["progress", "history", "pyqAttempts", "liveTestAttempts"];
    for (const sc of subcols) {
      const snap = await getDocs(collection(db, "users", u.id, sc));
      console.log(`  Subcol [${sc}]: ${snap.size} docs`);
      for (const sd of snap.docs) {
        console.log(`    Deleting user subdoc ${sc}/${sd.id}`);
        await deleteDoc(sd.ref);
      }
    }
    // If it's a seed user
    if (u.id.startsWith("admin_") || u.id.startsWith("user_")) {
      console.log(`  Deleting seed user: ${u.id}`);
      await deleteDoc(u.ref);
    }
  }
  process.exit(0);
}

checkUsers().catch((e) => {
  console.error(e);
  process.exit(1);
});
