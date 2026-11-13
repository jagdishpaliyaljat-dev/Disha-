import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getCountFromServer } from 'firebase/firestore';
import * as fs from 'fs';
import * as path from 'path';

const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
const firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));

const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId || undefined);

async function testGetCount() {
  console.log("=== QUIZPRO — FIRESTORE getCountFromServer TEST ===");
  const collections = ["subjects", "chapters", "topics", "mcqs", "questions"];

  for (const colName of collections) {
    const collRef = collection(db, colName);
    const snap = await getCountFromServer(collRef);
    console.log(` Collection '${colName}': ${snap.data().count} documents`);
  }

  process.exit(0);
}

testGetCount().catch(err => {
  console.error("getCountFromServer Error:", err);
  process.exit(1);
});
