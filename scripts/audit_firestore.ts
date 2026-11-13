import { initializeApp } from "firebase/app";
import { initializeFirestore, collection, getDocs, doc, getDoc } from "firebase/firestore";
import appletConfig from "../firebase-applet-config.json";

async function runAudit() {
  console.log("=========================================");
  console.log("       QUIZPRO FIRESTORE AUDIT REPORT    ");
  console.log("=========================================");
  console.log("Project ID:    ", appletConfig.projectId);
  console.log("Database ID:   ", appletConfig.firestoreDatabaseId);
  console.log("Auth Domain:   ", appletConfig.authDomain);
  console.log("Timestamp:     ", new Date().toISOString());
  console.log("-----------------------------------------");

  const app = initializeApp(appletConfig);
  const db = initializeFirestore(
    app,
    { experimentalForceLongPolling: true },
    appletConfig.firestoreDatabaseId || "(default)"
  );

  const collections = [
    "subjects",
    "chapters",
    "topics",
    "mcqs",
    "questions",
    "pyq_papers",
    "pyqPapers",
    "live_tests",
    "liveTests",
    "exam_categories",
    "examCategories",
    "banners",
    "articles",
    "article_categories",
    "attempts",
    "leaderboard",
    "adminAuditLogs",
    "users"
  ];

  const report: Record<string, { count: number; status: string; error?: string }> = {};

  // Test connection doc
  try {
    const testSnap = await getDoc(doc(db, "test", "connection"));
    console.log(`[Health Probe] /test/connection exists: ${testSnap.exists()}`);
  } catch (err: any) {
    console.log(`[Health Probe] /test/connection read error: ${err.message}`);
  }

  for (const col of collections) {
    try {
      const snap = await getDocs(collection(db, col));
      report[col] = { count: snap.size, status: "OK" };
      console.log(`✓ Collection '${col}': ${snap.size} documents found.`);
    } catch (err: any) {
      report[col] = { count: 0, status: "RESTRICTED / ERROR", error: err.message };
      console.log(`- Collection '${col}': (read restricted or empty - ${err.message})`);
    }
  }

  console.log("=========================================");
  console.log("AUDIT SUMMARY COMPLETE");
}

runAudit().then(() => process.exit(0)).catch(err => {
  console.error("Audit error:", err);
  process.exit(1);
});
