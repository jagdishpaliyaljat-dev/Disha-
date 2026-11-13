
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, doc, getDoc, setDoc, deleteDoc } from 'firebase/firestore';
import { readFileSync, appendFileSync, writeFileSync } from 'fs';

const firebaseConfig = JSON.parse(readFileSync('./firebase-applet-config.json', 'utf8'));
const manifest = JSON.parse(readFileSync('./recovery_manifest.json', 'utf8'));

const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

const LOG_FILE = './recovery_execution.log';

function log(message: string) {
  const entry = `[${new Date().toISOString()}] ${message}\n`;
  console.log(message);
  appendFileSync(LOG_FILE, entry);
}

async function executeRecovery() {
  log('Starting recovery execution (v2 - Collection Normalization)...');

  const actions = manifest.manifest;
  let successCount = 0;
  let skipCount = 0;
  let failCount = 0;

  const allCollections = [
    'questions', 
    'mcqs', 
    'curriculum_questions', 
    'curriculum_chapters', 
    'curriculum_subjects', 
    'customQuestions'
  ];

  for (const item of actions) {
    const { original_id, canonical_id, target_topic, action, reason } = item;

    try {
      if (action === 'STAY' || action === 'MOVE') {
        // Goal: Ensure this item is in the 'questions' collection with correct topicId
        const destRef = doc(db, 'questions', canonical_id);
        const destSnap = await getDoc(destRef);
        
        if (destSnap.exists() && destSnap.data().topicId === target_topic) {
           // Already exactly where it needs to be.
           // However, if original_id !== canonical_id, we should ensure the source is gone.
           if (original_id !== canonical_id) {
              for (const col of allCollections) {
                 if (col === 'questions') continue;
                 const srcRef = doc(db, col, original_id);
                 const srcSnap = await getDoc(srcRef);
                 if (srcSnap.exists()) {
                    await deleteDoc(srcRef);
                    log(`CLEANUP: Removed duplicate source ${original_id} from ${col}.`);
                 }
              }
           }
           skipCount++;
           continue;
        }

        // Not in destination or topic mismatch. Find source.
        log(`ENSURE: ${canonical_id} should be in 'questions' (Target: ${target_topic})`);
        
        let sourceSnap: any = null;
        let colUsed = '';
        
        for (const colName of allCollections) {
           const ref = doc(db, colName, original_id);
           const snap = await getDoc(ref);
           if (snap.exists()) {
             sourceSnap = snap;
             colUsed = colName;
             break;
           }
        }

        if (!sourceSnap) {
          log(`WARN: Source record ${original_id} not found anywhere. Skipping.`);
          failCount++; // Technically a "missing" record if we expected it
          continue;
        }

        const data = sourceSnap.data();
        data.topicId = target_topic;
        data.updatedAt = new Date().toISOString();

        await setDoc(destRef, data);
        log(`SUCCESS: Synchronized ${canonical_id} in questions collection.`);

        // Delete source if it was in another collection or has a different ID
        if (colUsed !== 'questions' || original_id !== canonical_id) {
          const sourceRef = doc(db, colUsed, original_id);
          await deleteDoc(sourceRef);
          log(`DELETED: Redundant source ${original_id} from ${colUsed}.`);
        }
        successCount++;
      }

      if (action === 'DELETE') {
        log(`DELETE: ${original_id} (${reason})`);
        
        let deleted = false;
        for (const colName of allCollections) {
          const ref = doc(db, colName, original_id);
          const snap = await getDoc(ref);
          if (snap.exists()) {
            await deleteDoc(ref);
            log(`DELETED: ${original_id} from ${colName}.`);
            deleted = true;
          }
        }
        
        if (!deleted) {
          // log(`SKIP: Record ${original_id} already gone.`);
        }
        successCount++;
      }

    } catch (err: any) {
      log(`ERROR: Failed to process ${original_id}: ${err.message}`);
      failCount++;
      log('STOPPING EXECUTION to prevent data corruption.');
      break; 
    }
  }

  log('--- Final Execution Summary ---');
  log(`Processed (Moved/Deleted): ${successCount}`);
  log(`Skipped (Already Correct): ${skipCount}`);
  log(`Failed (Missing Source): ${failCount}`);
}

executeRecovery().catch(console.error);
