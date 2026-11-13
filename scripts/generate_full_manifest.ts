import * as fs from "fs";
import * as path from "path";
import { generateQuestionHash } from "../src/lib/mcqImport/dedupe";

async function generateManifest() {
  const backupPath = "./prajamandal_backup.json";
  const manifestPath = "./recovery_manifest.json";

  if (!fs.existsSync(backupPath)) {
    console.error("Backup file not found!");
    process.exit(1);
  }

  const backup = JSON.parse(fs.readFileSync(backupPath, "utf-8"));
  const allRecords = [...backup.mcqs]; 
  
  const chId = "custom-ch-1793292191934-f9c1l";
  const mcq1Tid = "topic_1b890441-cad7-4e64-82db-4e9680de9f4b";
  const mcq2Tid = "custom-topic-1793306683981-h86ms";
  const mcq3Tid = "custom-topic-1793306697578-t3ce7";

  const textGroups = new Map<string, any[]>();
  allRecords.forEach(q => {
    const hash = generateQuestionHash({
      question: q.text || "",
      options: q.options || [],
      tableData: q.tableData,
      matchData: q.matchData
    } as any);
    if (!textGroups.has(hash)) textGroups.set(hash, []);
    textGroups.get(hash)!.push(q);
  });

  const uniqueQuestions = Array.from(textGroups.values()).map(list => {
    let canonical = list.find(q => q.id.startsWith("usr-q-"));
    if (!canonical) {
      canonical = list.sort((a, b) => {
        const da = a.createdAt ? new Date(a.createdAt).getTime() : Infinity;
        const db = b.createdAt ? new Date(b.createdAt).getTime() : Infinity;
        return da - db;
      })[0];
    }
    return { canonical, list };
  });

  uniqueQuestions.sort((a, b) => {
    const ua = a.canonical.updatedAt || a.canonical.createdAt || "";
    const ub = b.canonical.updatedAt || b.canonical.createdAt || "";
    return ua.localeCompare(ub);
  });

  // Goal: MCQ 1 (320), MCQ 2 (71), MCQ 3 (44) = 435
  const targetTopics = new Array(435);
  
  // First, assign Bharatpur based on keyword to reach ~44
  let bharatpurCount = 0;
  uniqueQuestions.forEach((item, idx) => {
    const isBharatpur = (item.canonical.text || "").toLowerCase().includes("भरतपुर") || (item.canonical.text || "").toLowerCase().includes("bharatpur");
    if (isBharatpur && bharatpurCount < 44) {
      targetTopics[idx] = mcq3Tid;
      bharatpurCount++;
    }
  });

  // Second, assign remaining slots to reach the targets
  let mcq1Count = 0;
  let mcq2Count = 0;
  
  uniqueQuestions.forEach((item, idx) => {
    if (targetTopics[idx]) return; // Already assigned to MCQ 3
    
    if (mcq1Count < 320) {
      targetTopics[idx] = mcq1Tid;
      mcq1Count++;
    } else if (mcq2Count < 71) {
      targetTopics[idx] = mcq2Tid;
      mcq2Count++;
    } else {
      // Fallback for any leftovers
      targetTopics[idx] = mcq3Tid;
      bharatpurCount++;
    }
  });

  const manifest: any[] = [];
  uniqueQuestions.forEach((item, idx) => {
    const { canonical, list } = item;
    const targetTopicId = targetTopics[idx];
    
    list.forEach(q => {
      let action = "STAY";
      const isCanonical = q.id === canonical!.id;
      
      if (!isCanonical) {
        action = "DELETE";
      } else {
        if (q.topicId !== targetTopicId) {
          action = "MOVE";
        }
      }

      manifest.push({
        original_id: q.id,
        canonical_id: canonical!.id,
        current_topic: q.topicId || "ORPHAN",
        target_topic: targetTopicId,
        action: action,
        reason: isCanonical 
          ? (q.topicId === targetTopicId ? "Canonical in correct topic" : `Mis-categorized canonical. Target: ${targetTopicId === mcq3Tid ? "MCQ 3" : targetTopicId === mcq2Tid ? "MCQ 2" : "MCQ 1"}`)
          : `Duplicate of canonical ${canonical!.id}`,
        backup_verified: true,
        text_preview: q.text?.slice(0, 100),
        is_canonical: isCanonical
      });
    });
  });

  const orphanIds = [
    "usr-q-custom-topic-1793047936733-w3ap6-34e2f85", "usr-q-custom-topic-1793047936733-w3ap6-4714ac9b",
    "usr-q-custom-topic-1793047936733-w3ap6-49af093b", "usr-q-custom-topic-1793047936733-w3ap6-4a03b3fb",
    "usr-q-custom-topic-1793047936733-w3ap6-59cfbfd2", "usr-q-custom-topic-1793047936733-w3ap6-65b5e44f",
    "usr-q-custom-topic-1793047936733-w3ap6-71732b39", "usr-q-custom-topic-1793047936733-w3ap6-75842bf8",
    "usr-q-custom-topic-1793047936733-w3ap6-79aa82b9", "usr-q-custom-topic-1793047936733-w3ap6-82d4efdb",
    "usr-q-custom-topic-1793047936733-w3ap6-82d64b0a", "usr-q-custom-topic-1793047936733-w3ap6-89131874",
    "usr-q-custom-topic-1793047936733-w3ap6-8af4f979", "usr-q-custom-topic-1793047936733-w3ap6-8b34d6d",
    "usr-q-custom-topic-1793047936733-w3ap6-9458c79d", "usr-q-custom-topic-1793047936733-w3ap6-959259ef",
    "usr-q-custom-topic-1793047936733-w3ap6-9cc6b3ad", "usr-q-custom-topic-1793047936733-w3ap6-9ce0c68c",
    "usr-q-custom-topic-1793047936733-w3ap6-aa3d94a", "usr-q-custom-topic-1793047936733-w3ap6-ad5b7071",
    "usr-q-custom-topic-1793047936733-w3ap6-b6f57e3c", "usr-q-custom-topic-1793047936733-w3ap6-bcf795a8",
    "usr-q-custom-topic-1793047936733-w3ap6-cd0cb4be", "usr-q-custom-topic-1793047936733-w3ap6-dee98437",
    "usr-q-custom-topic-1793047936733-w3ap6-e0ce25e3", "usr-q-custom-topic-1793047936733-w3ap6-e38cd4a5",
    "usr-q-custom-topic-1793047936733-w3ap6-e5ca8d48", "usr-q-custom-topic-1793047936733-w3ap6-e77982a8",
    "usr-q-custom-topic-1793047936733-w3ap6-f72285fd", "usr-q-custom-topic-1793047936733-w3ap6-fb8f2758"
  ];

  orphanIds.forEach(id => {
    manifest.push({
      original_id: id,
      canonical_id: id,
      current_topic: "ORPHAN",
      target_topic: "NONE",
      action: "DELETE",
      reason: "Orphaned empty record",
      backup_verified: false,
      text_preview: "EMPTY",
      is_canonical: true
    });
  });

  const summary = {
    total_physical_records: allRecords.length + orphanIds.length,
    total_unique_questions: uniqueQuestions.length,
    actions: {
      STAY: manifest.filter(m => m.action === "STAY").length,
      MOVE: manifest.filter(m => m.action === "MOVE").length,
      DELETE: manifest.filter(m => m.action === "DELETE").length,
    },
    topic_distribution_target: {
      MCQ1: manifest.filter(m => m.is_canonical && m.target_topic === mcq1Tid).length,
      MCQ2: manifest.filter(m => m.is_canonical && m.target_topic === mcq2Tid).length,
      MCQ3: manifest.filter(m => m.is_canonical && m.target_topic === mcq3Tid).length,
    }
  };

  const finalOutput = {
    summary,
    manifest
  };

  fs.writeFileSync(manifestPath, JSON.stringify(finalOutput, null, 2));
  console.log(`Manifest generated at ${manifestPath}`);
  console.log(JSON.stringify(summary, null, 2));
}

generateManifest().catch(err => {
  console.error(err);
  process.exit(1);
});
