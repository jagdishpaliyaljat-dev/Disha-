import * as fs from "fs";
import * as path from "path";
import { generateQuestionHash } from "../src/lib/mcqImport/dedupe";

async function countAjmer() {
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

  const ajmer = uniqueQuestions.filter(q => (q.text || "").toLowerCase().includes("अजमेर") || (q.text || "").toLowerCase().includes("ajmer"));
  const bharatpur = uniqueQuestions.filter(q => (q.text || "").toLowerCase().includes("भरतपुर") || (q.text || "").toLowerCase().includes("bharatpur"));
  
  console.log("Unique Questions Summary:");
  console.log(`Total: ${uniqueQuestions.length}`);
  console.log(`Ajmer (MCQ 2 heuristic): ${ajmer.length}`);
  console.log(`Bharatpur (MCQ 3 heuristic): ${bharatpur.length}`);
  console.log(`Remaining (MCQ 1 candidates): ${uniqueQuestions.length - ajmer.length - bharatpur.length}`);
}

countAjmer().catch(console.error);
