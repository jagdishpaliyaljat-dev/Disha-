import { initializeApp } from "firebase/app";
import { initializeFirestore, collection, getDocs, query, where } from "firebase/firestore";
import appletConfig from "../firebase-applet-config.json";
import { generateQuestionHash } from "../src/lib/mcqImport/dedupe";

async function generateRecoveryReport() {
  const app = initializeApp(appletConfig);
  const db = initializeFirestore(app, {}, appletConfig.firestoreDatabaseId || "(default)");
  
  const chId = "custom-ch-1793292191934-f9c1l";
  const mcqsRef = collection(db, "mcqs");
  
  const snap = await getDocs(query(mcqsRef, where("chapterId", "==", chId)));
  const allMcqs = snap.docs.map(d => ({ id: d.id, ...d.data() as any }));
  
  const mcq1Tid = "topic_1b890441-cad7-4e64-82db-4e9680de9f4b";
  const mcq2Tid = "custom-topic-1793306683981-h86ms";
  const mcq3Tid = "custom-topic-1793306697578-t3ce7";

  const textGroups = new Map<string, any[]>();
  allMcqs.forEach(q => {
    const hash = generateQuestionHash({
        question: q.text || "",
        options: q.options || [],
        answer: ["A", "B", "C", "D", "E"][q.correctIndex ?? 0] || "A"
    } as any);
    if (!textGroups.has(hash)) textGroups.set(hash, []);
    textGroups.get(hash)!.push(q);
  });

  const recoveryActions: any[] = [];
  const staleIds: string[] = [];
  
  // Categorization Logic (Heuristic based on content)
  textGroups.forEach((list, hash) => {
    const canonical = list.find(q => q.id.startsWith("usr-q-")) || list[0];
    
    // Add duplicates to stale list
    list.forEach(q => {
        if (q.id !== canonical.id) {
            staleIds.push(q.id);
        }
    });

    // Determine correct topic for canonical
    let targetTopicId = canonical.topicId;
    const text = (canonical.text || "").toLowerCase();
    
    // Heuristic for MCQ 3 (Bharatpur questions)
    if (text.includes("भरतपुर") || text.includes("bharatpur")) {
        targetTopicId = mcq3Tid;
    }
    
    if (targetTopicId !== canonical.topicId) {
        recoveryActions.push({
            id: canonical.id,
            currentTopic: canonical.topicId,
            targetTopic: targetTopicId,
            text: canonical.text?.slice(0, 50)
        });
    }
  });

  console.log("FINAL RECOVERY REPORT - READY FOR EXECUTION");
  console.log("==========================================");
  console.log(`\n1. RECORDS TO MOVE TO MCQ 3 (Restoration): ${recoveryActions.filter(a => a.targetTopic === mcq3Tid).length}`);
  recoveryActions.filter(a => a.targetTopic === mcq3Tid).forEach(a => {
      console.log(` - ${a.id} -> ${a.targetTopic} | ${a.text}`);
  });

  console.log(`\n2. STALE MOVE COPIES TO DELETE (Deduplication): ${staleIds.length}`);
  console.log(` IDs: ${staleIds.slice(0, 10).join(", ")}...`);

  console.log("\n3. TOTAL UNIQUE LOGICAL QUESTIONS PRESERVED: " + textGroups.size);
  console.log("==========================================");
}

generateRecoveryReport().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
