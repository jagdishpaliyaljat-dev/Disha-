
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';

// Load config
const config = JSON.parse(readFileSync('./firebase-applet-config.json', 'utf8'));

// Initialize Admin SDK
// Note: In AI Studio environment, we can often initialize without explicit service account for local scripts
// but if it fails, we'd need more setup. Assuming default works as per previous turns.
const app = initializeApp({
  projectId: config.projectId
});

const db = getFirestore(app);

async function checkCounts() {
  console.log("--- FINAL PRODUCTION VALIDATION ---");
  
  const topics = [
    { name: "MCQ 1", id: "topic_1b890441-cad7-4e64-82db-4e9680de9f4b", expected: 320 },
    { name: "MCQ 2", id: "custom-topic-1793306683981-h86ms", expected: 71 },
    { name: "MCQ 3", id: "custom-topic-1793306697578-t3ce7", expected: 44 }
  ];

  let grandTotal = 0;

  for (const t of topics) {
    const snapshot = await db.collection('questions')
      .where('topicId', '==', t.id)
      .get();
    
    const count = snapshot.size;
    grandTotal += count;
    
    console.log(`${t.name}: ${count} (Expected: ${t.expected}) - ${count === t.expected ? 'PASS' : 'FAIL'}`);
  }

  console.log(`Grand Total: ${grandTotal} (Expected: 435) - ${grandTotal === 435 ? 'PASS' : 'FAIL'}`);

  // Check for any remaining records in other collections
  const mcqsSnap = await db.collection('mcqs').get();
  console.log(`Remaining in 'mcqs': ${mcqsSnap.size} - ${mcqsSnap.size === 0 ? 'PASS' : 'WARN'}`);

  const currSnap = await db.collection('curriculum_questions').get();
  console.log(`Remaining in 'curriculum_questions': ${currSnap.size} - ${currSnap.size === 0 ? 'PASS' : 'WARN'}`);

  process.exit(grandTotal === 435 ? 0 : 1);
}

checkCounts().catch(err => {
  console.error(err);
  process.exit(1);
});
