import * as fs from "fs";
import * as path from "path";
import { generateQuestionHash } from "../src/lib/mcqImport/dedupe";

async function deepInspect() {
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

  uniqueQuestions.sort((a, b) => {
    const ua = a.updatedAt || a.createdAt || "";
    const ub = b.updatedAt || b.createdAt || "";
    return ua.localeCompare(ub);
  });

  const nonBharatpur = uniqueQuestions.filter(q => !((q.text || "").toLowerCase().includes("भरतपुर") || (q.text || "").toLowerCase().includes("bharatpur")));
  
  console.log("Non-Bharatpur unique questions count:", nonBharatpur.length);

  // Print every 50th question to see the flow
  for (let i = 0; i < nonBharatpur.length; i += 50) {
    console.log(`\n--- Index ${i} ---`);
    nonBharatpur.slice(i, i + 5).forEach(q => console.log(` - ${q.text?.slice(0, 100)}`));
  }
}

deepInspect().catch(console.error);
