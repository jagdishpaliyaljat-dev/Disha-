import { db, isFirebaseConfigured } from "../src/lib/firebase";
import { collection, query, limit } from "firebase/firestore";
import { guardedGetDocs, isQuotaExhausted } from "../src/utils/quotaTracker";
import { checkCurriculumVersionMatch } from "../src/utils/appVersionService";

async function diagnoseClientSync() {
  console.log("=== DIAGNOSING P0 CLIENT SYNC LIFECYCLE ===");

  console.log("1. Quota exhausted check:", isQuotaExhausted());
  console.log("2. Is Firebase Configured:", isFirebaseConfigured());

  console.log("3. Version Match Check:");
  const verMatch = await checkCurriculumVersionMatch();
  console.log("   - Version Match Result:", JSON.stringify(verMatch));

  console.log("4. Attempting Eager Load Queries (Same as useFirebaseSync):");
  try {
    const [subsSnap, chsSnap, topsSnap, mcqsSnap, qsSnap] = await Promise.all([
      guardedGetDocs(collection(db, "subjects"), "Background", "Eager Load Subjects", undefined, 12000, true).catch(err => ({ error: err?.message || err })),
      guardedGetDocs(collection(db, "chapters"), "Background", "Eager Load Chapters", undefined, 12000, true).catch(err => ({ error: err?.message || err })),
      guardedGetDocs(collection(db, "topics"), "Background", "Eager Load Topics", undefined, 12000, true).catch(err => ({ error: err?.message || err })),
      guardedGetDocs(collection(db, "mcqs"), "Background", "Eager Load MCQs", undefined, 12000, true).catch(err => ({ error: err?.message || err })),
      guardedGetDocs(collection(db, "questions"), "Background", "Eager Load Questions", undefined, 12000, true).catch(err => ({ error: err?.message || err })),
    ]);

    console.log("   - Subjects Snap:", (subsSnap as any)?.error ? `ERROR: ${(subsSnap as any).error}` : `Count: ${(subsSnap as any)?.docs?.length}`);
    console.log("   - Chapters Snap:", (chsSnap as any)?.error ? `ERROR: ${(chsSnap as any).error}` : `Count: ${(chsSnap as any)?.docs?.length}`);
    console.log("   - Topics Snap:", (topsSnap as any)?.error ? `ERROR: ${(topsSnap as any).error}` : `Count: ${(topsSnap as any)?.docs?.length}`);
    console.log("   - MCQs Snap:", (mcqsSnap as any)?.error ? `ERROR: ${(mcqsSnap as any).error}` : `Count: ${(mcqsSnap as any)?.docs?.length}`);
    console.log("   - Questions Snap:", (qsSnap as any)?.error ? `ERROR: ${(qsSnap as any).error}` : `Count: ${(qsSnap as any)?.docs?.length}`);

    if ((subsSnap as any)?.docs) {
      console.log("   - Subjects found:", (subsSnap as any).docs.map((d: any) => ({ id: d.id, name: d.data().name, hindiName: d.data().hindiName })));
    }
    if ((chsSnap as any)?.docs) {
      console.log("   - Chapters sample:", (chsSnap as any).docs.slice(0, 3).map((d: any) => ({ id: d.id, title: d.data().title, hindiTitle: d.data().hindiTitle })));
    }
  } catch (err: any) {
    console.error("   - Eager load Promise.all error:", err);
  }
}

diagnoseClientSync().catch(err => console.error("Fatal:", err));
