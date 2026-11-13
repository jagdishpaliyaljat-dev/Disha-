import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";

const BACKUPS_DIR = path.resolve("/app/applet/backups");

function sha256Normalized(obj: any): string {
  if (!obj || typeof obj !== "object") return "";
  const sortedKeys = Object.keys(obj).sort();
  const norm: Record<string, any> = {};
  for (const k of sortedKeys) {
    if (k === "_backupMetadata" || k === "_checksum" || k === "backedUpAt") continue;
    norm[k] = obj[k];
  }
  const jsonStr = JSON.stringify(norm);
  return crypto.createHash("sha256").update(jsonStr).digest("hex");
}

console.log("=== DIAGNOSING BACKUP FILES LOCALLY ===");

// 1. Task 1 Backup File
const t1File = path.join(BACKUPS_DIR, "phase4_task1_test_artifact_backup.json");
if (fs.existsSync(t1File)) {
  const t1Data = JSON.parse(fs.readFileSync(t1File, "utf8"));
  console.log("\n--- File 1: phase4_task1_test_artifact_backup.json ---");
  console.log("backedUpAt:", t1Data.backedUpAt);
  console.log("documentId:", t1Data.documentId);
  console.log("inMcqs payload:", JSON.stringify(t1Data.inMcqs, null, 2));
  console.log("SHA256 (inMcqs):", sha256Normalized(t1Data.inMcqs));
} else {
  console.log("File not found:", t1File);
}

// 2. Task 2 Backup File
const t2File = path.join(BACKUPS_DIR, "phase4_task2_curriculum_and_19_questions_backup.json");
if (fs.existsSync(t2File)) {
  const t2Data = JSON.parse(fs.readFileSync(t2File, "utf8"));
  console.log("\n--- File 2: phase4_task2_curriculum_and_19_questions_backup.json ---");
  console.log("backedUpAt:", t2Data.backedUpAt);
  console.log("existingSubjectsCount:", t2Data.existingSubjectsCount);
  console.log("existingChaptersCount:", t2Data.existingChaptersCount);
  console.log("existingTopicsCount:", t2Data.existingTopicsCount);
  console.log("targetQuestionsCount:", t2Data.targetQuestionsCount);

  // Check if mcq_09438c73c6f03f6d33976f780ea87e31 is in t2Data
  let foundInT2: any = null;
  if (Array.isArray(t2Data.target19Questions)) {
    foundInT2 = t2Data.target19Questions.find((q: any) => q.id === "mcq_09438c73c6f03f6d33976f780ea87e31");
  }
  console.log("Is mcq_09438c73c6f03f6d33976f780ea87e31 in t2Data.target19Questions?:", Boolean(foundInT2));
  if (foundInT2) {
    console.log("Payload in T2:", JSON.stringify(foundInT2, null, 2));
    console.log("SHA256 in T2:", sha256Normalized(foundInT2.mcqsPayload || foundInT2));
  }
}

// 3. Inspect phase4MigrationService.ts definitions
const codePath = path.resolve("/app/applet/src/utils/phase4MigrationService.ts");
const codeContent = fs.readFileSync(codePath, "utf8");

console.log("\n--- Code Inspection: phase4MigrationService.ts ---");
console.log("Includes PHASE4_19_QUESTION_MAPPINGS length:");
const mappingsMatch = codeContent.match(/PHASE4_19_QUESTION_MAPPINGS\s*=\s*\[([\s\S]*?)\];/);
if (mappingsMatch) {
  try {
    // Parse mapping entries manually or extract IDs
    const idMatches = [...mappingsMatch[1].matchAll(/id:\s*"([^"]+)"/g)].map(m => m[1]);
    console.log("Mapped IDs count in phase4MigrationService.ts:", idMatches.length);
    console.log("Mapped IDs list:", idMatches);
  } catch (e) {
    console.log("Could not parse mappings match");
  }
}
