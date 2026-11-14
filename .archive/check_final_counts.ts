
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, query, where, getDocs } from 'firebase/firestore';
import { readFileSync } from 'fs';

// Load config
const firebaseConfig = JSON.parse(readFileSync('./firebase-applet-config.json', 'utf8'));

// Initialize Client SDK
const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

async function checkCounts() {
  console.log("--- FINAL PRODUCTION VALIDATION ---");
  
  const topics = [
    { name: "MCQ 1", id: "topic_1b890441-cad7-4e64-82db-4e9680de9f4b", expected: 320 },
    { name: "MCQ 2", id: "custom-topic-1793306683981-h86ms", expected: 71 },
    { name: "MCQ 3", id: "custom-topic-1793306697578-t3ce7", expected: 44 }
  ];

  let grandTotal = 0;

  for (const t of topics) {
    const q = query(collection(db, 'questions'), where('topicId', '==', t.id));
    const snapshot = await getDocs(q);
    
    const count = snapshot.size;
    grandTotal += count;
    
    console.log(`${t.name}: ${count} (Expected: ${t.expected}) - ${count === t.expected ? 'PASS' : 'FAIL'}`);
  }

  console.log(`Grand Total: ${grandTotal} (Expected: 435) - ${grandTotal === 435 ? 'PASS' : 'FAIL'}`);

  // Check for any remaining records in other collections
  const mcqsSnap = await getDocs(collection(db, 'mcqs'));
  console.log(`Total in 'mcqs': ${mcqsSnap.size} (Should be clean of Prajamandal)`);

  const currSnap = await getDocs(collection(db, 'curriculum_questions'));
  console.log(`Total in 'curriculum_questions': ${currSnap.size} (Should be clean of Prajamandal)`);

  process.exit(grandTotal === 435 ? 0 : 1);
}

checkCounts().catch(err => {
  console.error(err);
  process.exit(1);
});
