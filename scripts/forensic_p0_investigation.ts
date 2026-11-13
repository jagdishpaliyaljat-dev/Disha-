import { db, firebaseConfig, isFirebaseConfigured } from "../src/lib/firebase";
import { collection, doc, getDoc, getDocs, query, limit } from "firebase/firestore";

async function runForensicAudit() {
  console.log("=== P0 INCIDENT FORENSIC DIAGNOSTIC AUDIT ===");
  console.log("1. Configuration Check:");
  console.log("   - Configured:", isFirebaseConfigured());
  console.log("   - ProjectId:", firebaseConfig.projectId);
  console.log("   - AuthDomain:", firebaseConfig.authDomain);
  console.log("   - FirestoreDatabaseId:", firebaseConfig.firestoreDatabaseId);

  const collectionsToTest = ["subjects", "chapters", "topics", "mcqs", "questions"];

  for (const colName of collectionsToTest) {
    try {
      console.log(`\n2. Querying Collection '${colName}'...`);
      const ref = collection(db, colName);
      const snap = await getDocs(query(ref, limit(20)));
      console.log(`   - Returned count: ${snap.docs.length}`);
      if (!snap.empty) {
        console.log(`   - Sample Doc ID: ${snap.docs[0].id}`);
        console.log(`   - Sample Data snippet:`, JSON.stringify(snap.docs[0].data()).substring(0, 150));
      } else {
        console.log(`   - WARNING: Collection '${colName}' returned ZERO documents.`);
      }
    } catch (err: any) {
      console.error(`   - ERROR querying '${colName}':`, err?.message || err);
    }
  }

  // Version Metadata Check
  try {
    console.log("\n3. Querying 'metadata/app_version'...");
    const verRef = doc(db, "metadata", "app_version");
    const verSnap = await getDoc(verRef);
    if (verSnap.exists()) {
      console.log("   - App Version Doc Exists! Data:", JSON.stringify(verSnap.data()));
    } else {
      console.log("   - WARNING: 'metadata/app_version' does not exist.");
    }
  } catch (err: any) {
    console.error("   - ERROR querying 'metadata/app_version':", err?.message || err);
  }

  // Chapter & MCQs Specific Verification (Phase 6)
  try {
    console.log("\n4. Phase 6 Specific Verification:");
    const chRef = doc(db, "chapters", "custom-ch-1793722070182-fh7bn");
    const chSnap = await getDoc(chRef);
    if (chSnap.exists()) {
      console.log("   - Chapter 'custom-ch-1793722070182-fh7bn' Exists! Data:", JSON.stringify(chSnap.data()).substring(0, 200));
    } else {
      console.log("   - Chapter 'custom-ch-1793722070182-fh7bn' DOES NOT EXIST via doc reference!");
    }

    // Query MCQs for topic
    const mcqQuery = query(collection(db, "mcqs"), limit(200));
    const mcqSnap = await getDocs(mcqQuery);
    console.log(`   - Total MCQs sampled from 'mcqs' collection: ${mcqSnap.docs.length}`);
    const matchingVanSampada = mcqSnap.docs.filter(d => {
      const data = d.data();
      return data.chapterId === "custom-ch-1793722070182-fh7bn" || data.chapter === "वन संपदा";
    });
    console.log(`   - 'वन संपदा' MCQs found in sample: ${matchingVanSampada.length}`);
  } catch (err: any) {
    console.error("   - ERROR in Phase 6 check:", err?.message || err);
  }
}

runForensicAudit().catch(err => console.error("Fatal:", err));
