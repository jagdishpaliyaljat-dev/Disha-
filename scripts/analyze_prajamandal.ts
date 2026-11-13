import * as fs from "fs";
import * as path from "path";
import { generateQuestionHash } from "../src/lib/mcqImport/dedupe";

async function analyzeTimestamps() {
  const backupPath = "./prajamandal_backup.json";
  const backup = JSON.parse(fs.readFileSync(backupPath, "utf-8"));
  const allRecords = backup.mcqs;
  
  const textGroups = new Map<string, any[]>();
  allRecords.forEach((q: any) => {
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
    return list.find(q => q.id.startsWith("usr-q-")) || list[0];
  });

  // Sort by updatedAt or id if no updatedAt
  uniqueQuestions.sort((a, b) => {
    const ua = a.updatedAt || a.createdAt || "";
    const ub = b.updatedAt || b.createdAt || "";
    return ua.localeCompare(ub);
  });

  console.log("Analyzing unique questions sorted by timestamp:");
  const batchSize = 50;
  for (let i = 0; i < uniqueQuestions.length; i += batchSize) {
     const batch = uniqueQuestions.slice(i, i + batchSize);
     console.log(`Batch ${i} - ${i + batch.length - 1}: ${batch[0].updatedAt || 'N/A'}`);
  }

  // Count by topicId
  const topicCounts = new Map<string, number>();
  allRecords.forEach((q: any) => {
    topicCounts.set(q.topicId, (topicCounts.get(q.topicId) || 0) + 1);
  });
  console.log("\nPhysical Topic Counts:");
  topicCounts.forEach((count, tid) => console.log(` - ${tid}: ${count}`));
}

analyzeTimestamps().catch(console.error);
