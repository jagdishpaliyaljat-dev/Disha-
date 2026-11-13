import fs from 'fs';
import path from 'path';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';

const cfgPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
const app = initializeApp(cfg);
const db = getFirestore(app, cfg.firestoreDatabaseId);

async function main() {
  const snap = await getDocs(collection(db, 'subjects'));
  console.log('=== REMAINING LIVE SUBJECTS IN FIRESTORE ===');
  snap.docs.forEach(d => {
    console.log(`- Document ID: "${d.id}" | Name: "${d.data().name || d.data().hindiName}"`);
  });
}

main().catch(console.error);
