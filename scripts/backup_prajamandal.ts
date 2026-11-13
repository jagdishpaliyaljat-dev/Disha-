import { initializeApp } from "firebase/app";
import { initializeFirestore, collection, getDocs, query, where } from "firebase/firestore";
import * as fs from "fs";
import * as path from "path";
import appletConfig from "../firebase-applet-config.json";

async function backupPrajamandal() {
  console.log("Starting Prajamandal Backup...");
  const app = initializeApp(appletConfig);
  const db = initializeFirestore(app, {}, appletConfig.firestoreDatabaseId || "(default)");
  
  const chId = "custom-ch-1793292191934-f9c1l";
  
  // Backup mcqs
  console.log("Fetching mcqs for chapter:", chId);
  const mcqsRef = collection(db, "mcqs");
  const mcqsSnap = await getDocs(query(mcqsRef, where("chapterId", "==", chId)));
  const mcqs = mcqsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  
  // Backup questions (if any)
  console.log("Fetching questions for chapter:", chId);
  const questionsRef = collection(db, "questions");
  const questionsSnap = await getDocs(query(questionsRef, where("chapterId", "==", chId)));
  const questions = questionsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

  const backupData = {
    timestamp: new Date().toISOString(),
    chapterId: chId,
    mcqs: mcqs,
    questions: questions,
    totalRecords: mcqs.length + questions.length
  };

  const artifactDir = "/.aistudio/artifacts/brain/3bfab5fe-4412-4a74-8471-935f57b6f194";
  if (!fs.existsSync(artifactDir)) {
    fs.mkdirSync(artifactDir, { recursive: true });
  }
  const backupPath = path.join(artifactDir, "prajamandal_backup.json");
  
  fs.writeFileSync(backupPath, JSON.stringify(backupData, null, 2));
  
  console.log(`Backup completed! Saved to ${backupPath}`);
  console.log(`Total mcqs: ${mcqs.length}`);
  console.log(`Total questions: ${questions.length}`);
}

backupPrajamandal().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
