import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc, collection, getDocs } from 'firebase/firestore';
import * as fs from 'fs';
import * as path from 'path';

const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
const firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));

const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId || undefined);

async function inspectFields() {
  const docRef = doc(db, 'mcqs', 'usr-q-custom-topic-1793722084250-m1dzz-13c0941c');
  const snap = await getDoc(docRef);
  if (snap.exists()) {
    console.log("MCQ Document Data keys:", Object.keys(snap.data()));
    console.log("MCQ Document Data:", JSON.stringify(snap.data(), null, 2));
  } else {
    // Check questions collection
    const snap2 = await getDoc(doc(db, 'questions', 'usr-q-custom-topic-1793722084250-m1dzz-13c0941c'));
    console.log("Questions Document Data:", JSON.stringify(snap2.data(), null, 2));
  }
  process.exit(0);
}

inspectFields().catch(console.error);
