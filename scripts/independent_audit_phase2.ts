import fs from "fs";
import path from "path";
import { isTestOrMockQuestion, isTestOrMockId, isTestOrMockText } from "../src/utils/cleanSlate";
import { CHAPTERS_DATA } from "../src/data/questions";
import { Question } from "../src/types";

export function runAudit() {
  console.log("================================================================================");
  console.log("     DISHA 20-20: PHASE 2 INDEPENDENT PRODUCTION VERIFICATION & AUDIT          ");
  console.log("================================================================================\n");

  // Load all available backups and snapshots
  const prod576 = JSON.parse(fs.readFileSync("full_production_backup_576.json", "utf8"));
  const prajamandal = JSON.parse(fs.readFileSync("prajamandal_backup.json", "utf8"));
  const stale262 = JSON.parse(fs.readFileSync("backups/phase4_262_stale_questions_backup.json", "utf8"));
  const task2Backup = JSON.parse(fs.readFileSync("backups/phase4_task2_curriculum_and_19_questions_backup.json", "utf8"));
  const nearDupes = JSON.parse(fs.readFileSync("backups/phase4_task4_near_duplicates_backup.json", "utf8"));
  const phase2Backup = JSON.parse(fs.readFileSync("backups/phase2_verified_production_backup.json", "utf8"));

  const prajamandalList = prajamandal.mcqs || prajamandal.questions || [];
  const task2List = task2Backup.target19Questions || task2Backup.existingQuestions || [];
  const nearDupesList = (nearDupes.pairs || []).flatMap((p: any) => [p.docA?.payload || p.docA, p.docB?.payload || p.docB]).filter(Boolean);

  console.log("--- 1. SNAPSHOT CATALOGING (MARK: UNVERIFIED AGAINST LIVE FIREBASE) ---");
  console.log(`- full_production_backup_576.json: ${prod576.records?.length || 0} records`);
  console.log(`- prajamandal_backup.json: ${prajamandalList.length} records`);
  console.log(`- phase4_262_stale_questions_backup.json: ${stale262.records?.length || 0} records`);
  console.log(`- phase4_task2_curriculum_and_19_questions_backup.json: ${task2List.length} questions`);
  console.log(`- phase4_task4_near_duplicates_backup.json: ${nearDupesList.length} records`);
  console.log(`- phase2_verified_production_backup.json: ${(phase2Backup.mcqs || phase2Backup.records || []).length} records`);

  // Index all unique documents across all historical snapshots
  const allHistoricalDocs = new Map<string, any>();
  const idOccurrences = new Map<string, string[]>();

  function register(doc: any, source: string) {
    const id = doc.id || doc.data?.id;
    if (!id) return;
    const data = doc.data ? { id, ...doc.data } : doc;
    allHistoricalDocs.set(id, data);
    const list = idOccurrences.get(id) || [];
    list.push(source);
    idOccurrences.set(id, list);
  }

  (prod576.records || []).forEach((r: any) => register(r, "prod576"));
  prajamandalList.forEach((r: any) => register(r, "prajamandal"));
  (stale262.records || []).forEach((r: any) => register(r, "stale262"));
  task2List.forEach((r: any) => register(r, "task2_19qs"));
  nearDupesList.forEach((r: any) => register(r, "nearDupes"));
  (phase2Backup.mcqs || phase2Backup.records || []).forEach((r: any) => register(r, "phase2Backup"));

  console.log(`\nTotal unique physical document IDs across all available snapshots: ${allHistoricalDocs.size}`);

  // ---------------------------------------------------------------------------
  // CHECKPOINT 5: DATA LOSS INVESTIGATION
  // ---------------------------------------------------------------------------
  console.log("\n--- 2. CHECKPOINT 5: DATA LOSS INVESTIGATION (cleanSlate & Deletion Audit) ---");
  const flaggedByCleanSlate: any[] = [];
  for (const [id, q] of allHistoricalDocs.entries()) {
    if (isTestOrMockQuestion(q)) {
      flaggedByCleanSlate.push({
        id,
        text: (q.text || q.question || "").slice(0, 60),
        topicId: q.topicId,
        chapterId: q.chapterId,
        subjectId: q.subjectId,
      });
    }
  }

  console.log(`Questions in historical snapshots flagged by isTestOrMockQuestion(): ${flaggedByCleanSlate.length}`);
  if (flaggedByCleanSlate.length > 0) {
    console.log("Flagged Questions Detail:", JSON.stringify(flaggedByCleanSlate, null, 2));
  } else {
    console.log("✅ Zero production questions from historical backups are matched or purged by cleanSlate!");
  }

  // Check base curriculum questions in CHAPTERS_DATA
  let baseTotal = 0;
  let baseFlagged = 0;
  for (const ch of CHAPTERS_DATA || []) {
    for (const t of ch.topics || []) {
      for (const q of t.questions || []) {
        baseTotal++;
        if (isTestOrMockQuestion(q)) baseFlagged++;
      }
    }
  }
  console.log(`Base CHAPTERS_DATA questions: ${baseTotal}, Flagged by cleanSlate: ${baseFlagged}`);

  // Check if any question in prod576 is missing in phase2Backup
  const phase2Ids = new Set((phase2Backup.mcqs || phase2Backup.records || []).map((r: any) => r.id || r.data?.id));
  const missingFromPhase2: string[] = [];
  for (const [id] of allHistoricalDocs.entries()) {
    // Only check prod576
    const sources = idOccurrences.get(id) || [];
    if (sources.includes("prod576") && !phase2Ids.has(id)) {
      missingFromPhase2.push(id);
    }
  }
  console.log(`Missing question IDs from prod576 in phase2Backup: ${missingFromPhase2.length}`);

  // ---------------------------------------------------------------------------
  // CHECKPOINT 6: DUPLICATE RECONCILIATION AUDIT (111 STALE MOVE PAIRS)
  // ---------------------------------------------------------------------------
  console.log("\n--- 3. CHECKPOINT 6: DUPLICATE RECONCILIATION AUDIT ---");
  const normalizeOpts = (options: string[] = []): string =>
    (options || []).map((o: any) => (typeof o === "string" ? o.trim().toLowerCase() : "")).sort().join("|");

  // Bucket by exact text
  const textBuckets = new Map<string, any[]>();
  for (const [id, q] of allHistoricalDocs.entries()) {
    const rawText = (q.text || q.question || "").trim().toLowerCase();
    if (!rawText) continue;
    let b = textBuckets.get(rawText);
    if (!b) {
      b = [];
      textBuckets.set(rawText, b);
    }
    b.push(q);
  }

  interface DuplicatePairAnalysis {
    canonicalId: string;
    staleId: string;
    text: string;
    optsMatch: boolean;
    answersMatch: boolean;
    canonicalTopic: string;
    staleTopic: string;
    canonicalTime: string;
    staleTime: string;
    pairType: string;
  }

  const verifiedDuplicatePairs: DuplicatePairAnalysis[] = [];
  const ambiguousPairs: any[] = [];

  textBuckets.forEach((bucket, text) => {
    if (bucket.length <= 1) return;

    for (let i = 0; i < bucket.length; i++) {
      const q1 = bucket[i];
      for (let j = i + 1; j < bucket.length; j++) {
        const q2 = bucket[j];
        if (q1.id === q2.id) continue;

        const opts1 = normalizeOpts(q1.options);
        const opts2 = normalizeOpts(q2.options);
        const optsMatch = opts1 === opts2;
        const ans1 = q1.correctIndex ?? q1.correctAnswer;
        const ans2 = q2.correctIndex ?? q2.correctAnswer;
        const ansMatch = ans1 === ans2;

        if (!optsMatch) {
          // Different options with same text is a legitimate variant, NOT a stale duplicate!
          ambiguousPairs.push({
            reason: "SAME_TEXT_DIFFERENT_OPTIONS",
            id1: q1.id,
            id2: q2.id,
            text: text.slice(0, 60),
            opts1: q1.options,
            opts2: q2.options,
          });
          continue;
        }

        // Compare timestamps
        const time1 = new Date(q1.updatedAt || q1.createdAt || 0).getTime();
        const time2 = new Date(q2.updatedAt || q2.createdAt || 0).getTime();
        const isQ2Newer = time2 > time1 || (time2 === time1 && q2.topicId && !q1.topicId);

        const newerDoc = isQ2Newer ? q2 : q1;
        const olderDoc = isQ2Newer ? q1 : q2;

        // Determine canonical ID: prefer usr-q- over mcq_
        const canonicalId = newerDoc.id.startsWith("usr-q-")
          ? newerDoc.id
          : (olderDoc.id.startsWith("usr-q-") ? olderDoc.id : newerDoc.id);
        const staleId = canonicalId === newerDoc.id ? olderDoc.id : newerDoc.id;

        const pairType = (q1.id.startsWith("usr-q-") && q2.id.startsWith("mcq_")) ||
                         (q2.id.startsWith("usr-q-") && q1.id.startsWith("mcq_"))
          ? "USR_Q_VS_MCQ_STALE_COPY"
          : (q1.topicId !== q2.topicId ? "CROSS_TOPIC_STALE_MOVE" : "SAME_TOPIC_IDENTICAL_DUPE");

        verifiedDuplicatePairs.push({
          canonicalId,
          staleId,
          text: text.slice(0, 60),
          optsMatch,
          answersMatch: ansMatch,
          canonicalTopic: newerDoc.topicId,
          staleTopic: olderDoc.topicId,
          canonicalTime: newerDoc.updatedAt || newerDoc.createdAt,
          staleTime: olderDoc.updatedAt || olderDoc.createdAt,
          pairType,
        });
      }
    }
  });

  console.log(`Total verified duplicate pairs (exact text + exact options): ${verifiedDuplicatePairs.length}`);
  console.log(`Pairs with same text but different options (preserved variants): ${ambiguousPairs.length}`);

  const pairTypeBreakdown = verifiedDuplicatePairs.reduce((acc: any, p) => {
    acc[p.pairType] = (acc[p.pairType] || 0) + 1;
    return acc;
  }, {});
  console.log("Duplicate Pair Type Breakdown:", pairTypeBreakdown);

  console.log("\nSample Verified Duplicate Pairs (First 5):");
  verifiedDuplicatePairs.slice(0, 5).forEach((p, idx) => {
    console.log(`  [Pair ${idx + 1}] Type: ${p.pairType}`);
    console.log(`    Canonical ID : ${p.canonicalId} (Topic: ${p.canonicalTopic}, Time: ${p.canonicalTime})`);
    console.log(`    Stale ID     : ${p.staleId} (Topic: ${p.staleTopic}, Time: ${p.staleTime})`);
    console.log(`    Text         : "${p.text}..."`);
    console.log(`    Options Match: ${p.optsMatch} | Answer Match: ${p.answersMatch}`);
  });

  // ---------------------------------------------------------------------------
  // CHECKPOINT 4: TOPIC-WISE QUESTION COUNTS CALCULATION
  // ---------------------------------------------------------------------------
  console.log("\n--- 4. CHECKPOINT 4: INDEPENDENT TOPIC COUNT CALCULATION ---");
  // Calculate unique logical questions per topic using canonical resolution
  const topicCountsPhysical = new Map<string, number>();
  const topicCountsUnique = new Map<string, Set<string>>();

  // Using the resolved canonical active list
  for (const [id, q] of allHistoricalDocs.entries()) {
    if (!q.topicId) continue;
    topicCountsPhysical.set(q.topicId, (topicCountsPhysical.get(q.topicId) || 0) + 1);
  }

  // Canonical deduplicated docs
  const canonicalDocsList = Array.from(allHistoricalDocs.values());
  const dedupedDocsMap = new Map<string, any>();
  canonicalDocsList.forEach(q => dedupedDocsMap.set(q.id, q));

  // Run the exact deduplication logic
  const bucketMap = new Map<string, any[]>();
  for (const q of dedupedDocsMap.values()) {
    const text = (q.text || q.question || "").trim().toLowerCase();
    const key = text || q.id;
    let b = bucketMap.get(key);
    if (!b) {
      b = [];
      bucketMap.set(key, b);
    }
    b.push(q);
  }

  const finalReconciledMap = new Map<string, any>();
  const processed = new Set<string>();

  bucketMap.forEach((bucket) => {
    if (bucket.length === 1) {
      finalReconciledMap.set(bucket[0].id, bucket[0]);
      processed.add(bucket[0].id);
      return;
    }
    for (let i = 0; i < bucket.length; i++) {
      const q1 = bucket[i];
      if (processed.has(q1.id)) continue;
      let reconciledDoc = q1;
      for (let j = i + 1; j < bucket.length; j++) {
        const q2 = bucket[j];
        if (processed.has(q2.id)) continue;
        const opts1 = normalizeOpts(q1.options);
        const opts2 = normalizeOpts(q2.options);
        if (opts1 && opts2 && opts1 !== opts2) continue;

        const time1 = new Date(q1.updatedAt || q1.createdAt || 0).getTime();
        const time2 = new Date(q2.updatedAt || q2.createdAt || 0).getTime();
        const isQ2Newer = time2 > time1 || (time2 === time1 && q2.topicId && !q1.topicId);
        const newerDoc = isQ2Newer ? q2 : q1;
        const olderDoc = isQ2Newer ? q1 : q2;
        const canonicalId = newerDoc.id.startsWith("usr-q-") ? newerDoc.id : (olderDoc.id.startsWith("usr-q-") ? olderDoc.id : newerDoc.id);

        reconciledDoc = {
          ...newerDoc,
          id: canonicalId,
          topicId: newerDoc.topicId || olderDoc.topicId,
          chapterId: newerDoc.chapterId || olderDoc.chapterId,
          subjectId: newerDoc.subjectId || olderDoc.subjectId,
        };
        processed.add(q1.id);
        processed.add(q2.id);
        break;
      }
      processed.add(q1.id);
      finalReconciledMap.set(reconciledDoc.id, reconciledDoc);
    }
  });

  const topicCountsReconciled = new Map<string, number>();
  for (const q of finalReconciledMap.values()) {
    if (q.topicId) {
      topicCountsReconciled.set(q.topicId, (topicCountsReconciled.get(q.topicId) || 0) + 1);
    }
  }

  console.log("\nTop Reconciled Topics Comparison (Physical vs Deduplicated):");
  const allTopicIds = Array.from(new Set([...topicCountsPhysical.keys(), ...topicCountsReconciled.keys()]));
  allTopicIds.sort((a, b) => (topicCountsPhysical.get(b) || 0) - (topicCountsPhysical.get(a) || 0));

  for (const tId of allTopicIds.slice(0, 10)) {
    const phys = topicCountsPhysical.get(tId) || 0;
    const recon = topicCountsReconciled.get(tId) || 0;
    const diff = recon - phys;
    console.log(`  Topic: ${tId} | Physical: ${phys} | Reconciled: ${recon} | Difference: ${diff}`);
  }
}

runAudit();
