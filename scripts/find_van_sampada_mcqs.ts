import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, query, where } from "firebase/firestore";
import fs from "fs";
import path from "path";

const configPath = path.resolve(process.cwd(), "firebase-applet-config.json");
const firebaseConfig = JSON.parse(fs.readFileSync(configPath, "utf-8"));

const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

async function findVanSampadaMCQs() {
  console.log("=== TARGETED MCQS SEARCH FOR VAN SAMPADA ===");

  const [mcqsSnap, qsSnap] = await Promise.all([
    getDocs(collection(db, "mcqs")),
    getDocs(collection(db, "questions")),
  ]);

  const allDocs = [
    ...mcqsSnap.docs.map(d => ({ coll: "mcqs", id: d.id, ...d.data() })),
    ...qsSnap.docs.map(d => ({ coll: "questions", id: d.id, ...d.data() })),
  ];

  console.log(`Total documents scanned across mcqs & questions: ${allDocs.length}`);

  // Search by chapterId or topicId or text content matching "वन" or "वृक्ष" or "वनस्पत" or "संरक्षित" or "सागवान"
  const matches = allDocs.filter((d: any) => {
    const txt = (d.text || d.question || "").toLowerCase();
    const exp = (d.explanation || "").toLowerCase();
    const cId = (d.chapterId || "").toLowerCase();
    const tId = (d.topicId || "").toLowerCase();
    const sId = (d.subjectId || "").toLowerCase();

    return (
      cId === "custom-ch-1793722070182-fh7bn" ||
      tId === "custom-topic-1793722084250-m1dzz" ||
      tId === "custom-topic-1793725013547-ocf2l" ||
      txt.includes("वन") ||
      txt.includes("वृक्ष") ||
      txt.includes("सागवान") ||
      txt.includes("खेजड़ी") ||
      txt.includes("धोकड़ा") ||
      txt.includes("वनस्पति")
    );
  });

  console.log(`Found ${matches.length} matching MCQs:`);
  matches.forEach((m: any, idx: number) => {
    console.log(`\n[${idx + 1}] Coll: "${m.coll}" | DocID: "${m.id}"`);
    console.log(`     subjectId: "${m.subjectId}" | chapterId: "${m.chapterId}" | topicId: "${m.topicId}"`);
    console.log(`     text: "${(m.text || "").slice(0, 80)}..."`);
  });

  process.exit(0);
}

findVanSampadaMCQs().catch(err => {
  console.error("Error:", err);
  process.exit(1);
});
