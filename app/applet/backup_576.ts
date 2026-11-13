import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, query, doc, getDoc } from 'firebase/firestore';
import { readFileSync, writeFileSync } from 'fs';

const firebaseConfig = JSON.parse(readFileSync('./firebase-applet-config.json', 'utf8'));
const manifest = JSON.parse(readFileSync('./recovery_manifest.json', 'utf8'));

const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

async function createBackup() {
  console.log('Starting full 576-record backup...');
  
  const originalIds = manifest.manifest.map((m: any) => m.original_id);
  const backupData: any[] = [];
  const missingIds: string[] = [];

  const collectionsToScan = ['questions', 'mcqs'];
  
  for (const id of originalIds) {
    let found = false;
    for (const colName of collectionsToScan) {
      try {
        const docRef = doc(db, colName, id);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          backupData.push({
            id: docSnap.id,
            collection: colName,
            data: docSnap.data()
          });
          found = true;
          break;
        }
      } catch (err) {
        // Silently continue
      }
    }
    if (!found) {
      missingIds.push(id);
    }
    
    if (backupData.length % 50 === 0 && backupData.length > 0) {
      console.log(`Progress: Fetched ${backupData.length} records...`);
    }
  }

  const result = {
    timestamp: new Date().toISOString(),
    total_requested: originalIds.length,
    total_fetched: backupData.length,
    missing_count: missingIds.length,
    missing_ids: missingIds,
    records: backupData
  };

  writeFileSync('./full_production_backup_576.json', JSON.stringify(result, null, 2));
  
  console.log('--- Backup Summary ---');
  console.log(`Total Requested: ${originalIds.length}`);
  console.log(`Total Fetched: ${backupData.length}`);
  console.log(`Missing: ${missingIds.length}`);
  console.log('Backup saved to full_production_backup_576.json');

  if (backupData.length === 576) {
    console.log('SUCCESS: All 576 records backed up successfully.');
  } else {
    console.warn(`WARNING: Backup count mismatch. Expected 576, got ${backupData.length}.`);
  }
}

createBackup().catch(console.error);
