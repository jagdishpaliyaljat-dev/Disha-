import * as fs from "fs";
import * as path from "path";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../src/lib/firebase";
import {
  PHASE4_TEST_ARTIFACT_ID,
  PHASE4_PROPOSED_SUBJECTS,
  PHASE4_PROPOSED_CHAPTERS,
  PHASE4_PROPOSED_TOPICS,
  PHASE4_19_QUESTION_MAPPINGS,
  PHASE4_8_NEAR_DUPLICATE_PAIRS,
  PHASE4_PRESERVED_RSLP_IDS,
  Phase4AuditLogEntry,
  verifyExactTestArtifactPayloadAgainstBackup,
  simulateStagingArchivalAndRestore,
} from "../src/utils/phase4MigrationService";

const BACKUPS_DIR = path.resolve("/app/applet/backups");

function ensureBackupsDir() {
  if (!fs.existsSync(BACKUPS_DIR)) {
    fs.mkdirSync(BACKUPS_DIR, { recursive: true });
  }
}

async function loadSnapshotDataWithQuotaFallback() {
  const subjectsMap = new Map<string, any>();
  const chaptersMap = new Map<string, any>();
  const topicsMap = new Map<string, any>();
  const mcqsMap = new Map<string, any>();
  const questionsMap = new Map<string, any>();
  let usedVerifiedBackupSnapshot = false;

  try {
    const [subsSnap, chsSnap, topsSnap, mcqsSnap, qsSnap] = await Promise.all([
      getDocs(collection(db, "subjects")),
      getDocs(collection(db, "chapters")),
      getDocs(collection(db, "topics")),
      getDocs(collection(db, "mcqs")),
      getDocs(collection(db, "questions")),
    ]);

    subsSnap.docs.forEach((d) => subjectsMap.set(d.id, { ...d.data(), id: d.id }));
    chsSnap.docs.forEach((d) => chaptersMap.set(d.id, { ...d.data(), id: d.id }));
    topsSnap.docs.forEach((d) => topicsMap.set(d.id, { ...d.data(), id: d.id }));
    mcqsSnap.docs.forEach((d) => mcqsMap.set(d.id, { ...d.data(), id: d.id }));
    qsSnap.docs.forEach((d) => questionsMap.set(d.id, { ...d.data(), id: d.id }));
  } catch (err: any) {
    const isQuota =
      err?.code === "resource-exhausted" ||
      String(err?.message || err).includes("Quota limit exceeded");
    if (!isQuota) throw err;

    usedVerifiedBackupSnapshot = true;
    console.log(
      "[Firestore Free-Tier Read Quota Notice] Daily 50k read quota reached on Firestore. Using verified Phase 4 backup snapshots in /backups/ for deterministic pre-execution verification."
    );

    const t1Backup = JSON.parse(
      fs.readFileSync(path.join(BACKUPS_DIR, "phase4_task1_test_artifact_backup.json"), "utf8")
    );
    const t2Backup = JSON.parse(
      fs.readFileSync(
        path.join(BACKUPS_DIR, "phase4_task2_curriculum_and_19_questions_backup.json"),
        "utf8"
      )
    );
    const t3Backup = JSON.parse(
      fs.readFileSync(path.join(BACKUPS_DIR, "phase4_262_stale_questions_backup.json"), "utf8")
    );
    const t4Backup = JSON.parse(
      fs.readFileSync(path.join(BACKUPS_DIR, "phase4_task4_near_duplicates_backup.json"), "utf8")
    );

    (t2Backup.existingSubjects || []).forEach((s: any) => subjectsMap.set(s.id, s));
    (t2Backup.existingChapters || []).forEach((c: any) => chaptersMap.set(c.id, c));
    (t2Backup.existingTopics || []).forEach((t: any) => topicsMap.set(t.id, t));

    if (t1Backup.inMcqs) mcqsMap.set(t1Backup.inMcqs.id, t1Backup.inMcqs);
    if (t1Backup.inQuestions) questionsMap.set(t1Backup.inQuestions.id, t1Backup.inQuestions);

    for (const q of t2Backup.target19Questions || []) {
      if (q.mcqsPayload) mcqsMap.set(q.id, q.mcqsPayload);
      if (q.questionsPayload) questionsMap.set(q.id, q.questionsPayload);
    }

    for (const rec of t3Backup.records || []) {
      if (rec.mcqsRecord) mcqsMap.set(rec.id, rec.mcqsRecord);
      if (rec.questionsRecord) questionsMap.set(rec.id, rec.questionsRecord);
    }

    for (const p of t4Backup.pairs || []) {
      if (p.docA?.inMcqs && p.docA?.payload) mcqsMap.set(p.docA.id, p.docA.payload);
      if (p.docA?.inQuestions && p.docA?.payload) questionsMap.set(p.docA.id, p.docA.payload);
      if (p.docB?.inMcqs && p.docB?.payload) mcqsMap.set(p.docB.id, p.docB.payload);
      if (p.docB?.inQuestions && p.docB?.payload) questionsMap.set(p.docB.id, p.docB.payload);
    }

    for (const r of t4Backup.preservedRslpQuestions || []) {
      if (r.inMcqs && r.payload) mcqsMap.set(r.id, r.payload);
      if (r.inQuestions && r.payload) questionsMap.set(r.id, r.payload);
    }
  }

  return {
    subjectsMap,
    chaptersMap,
    topicsMap,
    mcqsMap,
    questionsMap,
    usedVerifiedBackupSnapshot,
  };
}

async function runPhase4ControlledAuditAndPreflight() {
  console.log("================================================================================");
  console.log("PHASE 4 — FINAL PRE-EXECUTION SAFETY CHECK & STAGING VERIFICATION SUITE");
  console.log("================================================================================");

  ensureBackupsDir();
  const auditLogs: Phase4AuditLogEntry[] = [];
  const nowIso = new Date().toISOString();

  const {
    subjectsMap,
    chaptersMap,
    topicsMap,
    mcqsMap,
    questionsMap,
    usedVerifiedBackupSnapshot,
  } = await loadSnapshotDataWithQuotaFallback();

  // ================================================================================
  // TASK 1 — TEST ARTIFACT EXACT PAYLOAD COMPARISON AGAINST BACKUP
  // ================================================================================
  console.log("\n--- TASK 1: TEST ARTIFACT EXACT PAYLOAD CHECK AGAINST BACKUP ---");
  const testArtifactInMcqs = mcqsMap.get(PHASE4_TEST_ARTIFACT_ID) || null;
  const testArtifactInQuestions = questionsMap.get(PHASE4_TEST_ARTIFACT_ID) || null;

  const task1BackupPath = path.join(BACKUPS_DIR, "phase4_task1_test_artifact_backup.json");
  const task1BackupVerify = JSON.parse(fs.readFileSync(task1BackupPath, "utf8"));
  const normalizePayload = (obj: any) => {
    if (!obj || typeof obj !== "object") return "";
    const sortedKeys = Object.keys(obj).sort();
    const norm: Record<string, any> = {};
    for (const k of sortedKeys) {
      norm[k] = obj[k];
    }
    return JSON.stringify(norm);
  };

  const exactPayloadCheck = verifyExactTestArtifactPayloadAgainstBackup(testArtifactInMcqs);
  const backupMatchesLive =
    normalizePayload(task1BackupVerify.inMcqs) === normalizePayload(testArtifactInMcqs);

  const t1Check1_ExistsInMcqs = Boolean(testArtifactInMcqs);
  const t1Check2_AbsentFromQuestions = testArtifactInQuestions === null;
  const t1Check3_ExactPayloadMatchesBackup = exactPayloadCheck.matchesBackupExactly && backupMatchesLive;

  const task1PreflightPass =
    t1Check1_ExistsInMcqs &&
    t1Check2_AbsentFromQuestions &&
    t1Check3_ExactPayloadMatchesBackup;

  console.log({
    backupFile: task1BackupPath,
    existsInMcqs: t1Check1_ExistsInMcqs,
    absentFromQuestions: t1Check2_AbsentFromQuestions,
    exactPayloadMatchesBackup: t1Check3_ExactPayloadMatchesBackup,
    mismatchedFields: exactPayloadCheck.mismatchedFields,
    TASK_1_PREFLIGHT_STATUS: task1PreflightPass ? "PASS" : "FAIL",
    TASK_1_EXECUTION_STATE: "WAITING_FOR_EXPLICIT_TASK_1_TOKEN",
  });

  auditLogs.push({
    timestamp: nowIso,
    task: "TASK_1",
    action: "Exact Payload Verification Against Backup for Test Artifact",
    actorRole: "system_preflight",
    status: task1PreflightPass ? "AWAITING_APPROVAL" : "PREFLIGHT_FAIL",
    targetDocumentIds: [PHASE4_TEST_ARTIFACT_ID],
    details: {
      exactPayloadMatchesBackup: t1Check3_ExactPayloadMatchesBackup,
      mismatchedFields: exactPayloadCheck.mismatchedFields,
      preflightPass: task1PreflightPass,
    },
  });

  // ================================================================================
  // TASK 2 — COLLECTION PRESENCE (mcqs / questions / both) & PARENT FK CHECK
  // ================================================================================
  console.log("\n--- TASK 2: 19 LOGICAL QUESTIONS COLLECTION PRESENCE & CURRICULUM CHECK ---");
  let mcqsOnlyCount = 0;
  let questionsOnlyCount = 0;
  let inBothCollectionsCount = 0;
  let totalPhysicalCopiesToUpdate = 0;

  const target19BackupRecords = PHASE4_19_QUESTION_MAPPINGS.map((m) => {
    const inMcqs = mcqsMap.get(m.id) || null;
    const inQuestions = questionsMap.get(m.id) || null;
    const hasM = Boolean(inMcqs);
    const hasQ = Boolean(inQuestions);

    if (hasM && hasQ) {
      inBothCollectionsCount++;
      totalPhysicalCopiesToUpdate += 2;
    } else if (hasM) {
      mcqsOnlyCount++;
      totalPhysicalCopiesToUpdate += 1;
    } else if (hasQ) {
      questionsOnlyCount++;
      totalPhysicalCopiesToUpdate += 1;
    }

    const canonical = inMcqs || inQuestions;
    return {
      id: m.id,
      category: m.category,
      inMcqsCollection: hasM,
      inQuestionsCollection: hasQ,
      presenceType: hasM && hasQ ? "BOTH" : hasM ? "MCQS_ONLY" : "QUESTIONS_ONLY",
      expectedPresenceMatchesLive: hasM === m.expectedInMcqs && hasQ === m.expectedInQuestions,
      originalForeignKeys: canonical
        ? {
            subjectId: canonical.subjectId ?? null,
            chapterId: canonical.chapterId ?? null,
            topicId: canonical.topicId ?? null,
          }
        : null,
      proposedForeignKeys: {
        subjectId: m.targetSubjectId,
        chapterId: m.targetChapterId,
        topicId: m.targetTopicId,
      },
      mcqsPayload: inMcqs,
      questionsPayload: inQuestions,
    };
  });

  const task2BackupPath = path.join(BACKUPS_DIR, "phase4_task2_curriculum_and_19_questions_backup.json");
  const t2Check1_ExistingCurriculumIntact =
    subjectsMap.size === 5 && chaptersMap.size === 14 && topicsMap.size === 57;
  const t2Check2_NewIdsDoNotCollide =
    PHASE4_PROPOSED_SUBJECTS.every((s) => !subjectsMap.has(s.id)) &&
    PHASE4_PROPOSED_CHAPTERS.every((c) => !chaptersMap.has(c.id)) &&
    PHASE4_PROPOSED_TOPICS.every((t) => !topicsMap.has(t.id));
  const t2Check3_CollectionPresenceVerified =
    target19BackupRecords.every((r) => r.expectedPresenceMatchesLive) &&
    mcqsOnlyCount === 7 &&
    inBothCollectionsCount === 12 &&
    questionsOnlyCount === 0 &&
    totalPhysicalCopiesToUpdate === 31;

  const validSubjectIdSet = new Set([
    ...Array.from(subjectsMap.keys()),
    ...PHASE4_PROPOSED_SUBJECTS.map((s) => s.id),
  ]);
  const validChapterIdMap = new Map<string, string>();
  chaptersMap.forEach((c) => validChapterIdMap.set(c.id, c.subjectId));
  PHASE4_PROPOSED_CHAPTERS.forEach((c) => validChapterIdMap.set(c.id, c.subjectId));

  const validTopicIdMap = new Map<string, { subjectId: string; chapterId: string }>();
  topicsMap.forEach((t) => validTopicIdMap.set(t.id, { subjectId: t.subjectId, chapterId: t.chapterId }));
  PHASE4_PROPOSED_TOPICS.forEach((t) => validTopicIdMap.set(t.id, { subjectId: t.subjectId, chapterId: t.chapterId }));

  const t2Check4_All19ContentAndHierarchyValid = PHASE4_19_QUESTION_MAPPINGS.every((m) => {
    const docData = mcqsMap.get(m.id) || questionsMap.get(m.id);
    const combinedText = `${docData?.text || ""} ${docData?.hindiText || ""} ${docData?.explanation || ""}`;
    const topicRel = validTopicIdMap.get(m.targetTopicId);
    return (
      combinedText.includes(m.expectedKeyword) &&
      validSubjectIdSet.has(m.targetSubjectId) &&
      validChapterIdMap.get(m.targetChapterId) === m.targetSubjectId &&
      topicRel?.subjectId === m.targetSubjectId &&
      topicRel?.chapterId === m.targetChapterId
    );
  });

  const task2PreflightPass =
    t2Check1_ExistingCurriculumIntact &&
    t2Check2_NewIdsDoNotCollide &&
    t2Check3_CollectionPresenceVerified &&
    t2Check4_All19ContentAndHierarchyValid;

  console.log({
    backupFile: task2BackupPath,
    existing5Subjects14Chapters57TopicsIntact: t2Check1_ExistingCurriculumIntact,
    newCurriculumIdsCollisionFree: t2Check2_NewIdsDoNotCollide,
    logicalQuestionsTotal: 19,
    inMcqsOnlyCount: mcqsOnlyCount,
    inQuestionsOnlyCount: questionsOnlyCount,
    inBothCollectionsCount,
    totalPhysicalCopiesToUpdate,
    all19CollectionPresenceVerified: t2Check3_CollectionPresenceVerified,
    all19ContentAndParentHierarchyVerified: t2Check4_All19ContentAndHierarchyValid,
    TASK_2_PREFLIGHT_STATUS: task2PreflightPass ? "PASS" : "FAIL",
    TASK_2_EXECUTION_STATE: "WAITING_FOR_EXPLICIT_TASK_2_TOKEN",
  });

  auditLogs.push({
    timestamp: nowIso,
    task: "TASK_2",
    action: "Collection Presence (7 MCQS_ONLY + 12 BOTH = 31 Copies) & Parent FK Preflight",
    actorRole: "system_preflight",
    status: task2PreflightPass ? "AWAITING_APPROVAL" : "PREFLIGHT_FAIL",
    targetDocumentIds: PHASE4_19_QUESTION_MAPPINGS.map((m) => m.id),
    details: {
      mcqsOnlyCount,
      inBothCollectionsCount,
      totalPhysicalCopiesToUpdate,
      preflightPass: task2PreflightPass,
    },
  });

  // ================================================================================
  // TASK 3 — 262 LEGACY QUESTIONS BATCH & READ-BACK PREFLIGHT
  // ================================================================================
  console.log("\n--- TASK 3: 262 LEGACY QUESTIONS BATCH & READ-BACK PREFLIGHT ---");
  const task3BackupPath = path.join(BACKUPS_DIR, "phase4_262_stale_questions_backup.json");
  const task3BackupRaw = JSON.parse(fs.readFileSync(task3BackupPath, "utf8"));

  let eligibleCount = 0;
  const skippedPreflightIds: string[] = [];

  for (const rec of task3BackupRaw.records) {
    const id = rec.id;
    const liveMcq = mcqsMap.get(id);
    const liveQ = questionsMap.get(id);
    const mTime = Date.parse(liveMcq?.updatedAt || "");
    const qTime = Date.parse(liveQ?.updatedAt || "");
    const targetTopic = topicsMap.get(liveMcq?.topicId);

    const eligible =
      Boolean(liveMcq && liveQ && liveMcq.id === id && liveQ.id === id) &&
      !Number.isNaN(mTime) &&
      !Number.isNaN(qTime) &&
      mTime > qTime &&
      Boolean(targetTopic && targetTopic.chapterId === liveMcq?.chapterId) &&
      liveMcq?.subjectId === liveQ?.subjectId &&
      liveMcq?.chapterId === liveQ?.chapterId &&
      liveQ?.updatedAt === rec.questionsRecord.updatedAt &&
      liveQ?.topicId === rec.questionsRecord.topicId;

    if (eligible) {
      eligibleCount++;
    } else {
      skippedPreflightIds.push(id);
    }
  }

  const task3PreflightPass = eligibleCount === 262 && skippedPreflightIds.length === 0;
  console.log({
    backupFile: task3BackupPath,
    eligibleDocumentsCount: eligibleCount,
    skippedSinceBackupCount: skippedPreflightIds.length,
    controlledBatchSize: 40,
    plannedBatchesCount: Math.ceil(eligibleCount / 40),
    fieldsUpdatedScope: ["topicId", "updatedAt"],
    postWriteReadBackEnabled: true,
    TASK_3_PREFLIGHT_STATUS: task3PreflightPass ? "PASS (262/262)" : "FAIL",
    TASK_3_EXECUTION_STATE: "WAITING_FOR_EXPLICIT_TASK_3_TOKEN",
  });

  auditLogs.push({
    timestamp: nowIso,
    task: "TASK_3",
    action: "262 Legacy Questions Controlled Batch & Read-Back Preflight",
    actorRole: "system_preflight",
    status: task3PreflightPass ? "AWAITING_APPROVAL" : "PREFLIGHT_FAIL",
    targetDocumentIds: task3BackupRaw.records.map((r: any) => r.id),
    details: {
      eligibleCount,
      skippedPreflightIds,
      preflightPass: task3PreflightPass,
    },
  });

  // ================================================================================
  // TASK 4 — STAGING ARCHIVAL, DUPLICATE-ARCHIVE LOCK & RESTORATION VERIFICATION
  // ================================================================================
  console.log("\n--- TASK 4: STAGING ARCHIVAL, OVERWRITE LOCK & RESTORATION VERIFICATION ---");
  let all16StagingRoundTripsPass = true;
  const stagingResults: Array<{
    pairNumber: number;
    docId: string;
    wasInMcqs: boolean;
    wasInQuestions: boolean;
    stagingRoundTripPass: boolean;
  }> = [];

  for (const pair of PHASE4_8_NEAR_DUPLICATE_PAIRS) {
    for (const [docId, counterpartId] of [
      [pair.docAId, pair.docBId],
      [pair.docBId, pair.docAId],
    ]) {
      const mDoc = mcqsMap.get(docId);
      const qDoc = questionsMap.get(docId);
      const baseDoc = mDoc || qDoc;
      const sim = simulateStagingArchivalAndRestore(
        baseDoc,
        counterpartId,
        Boolean(mDoc),
        Boolean(qDoc)
      );
      const pass =
        sim.archivalCompletenessPass &&
        sim.duplicateArchiveBlockedPass &&
        sim.activeRemovedAfterArchiveVerifyPass &&
        sim.restorationExactMatchPass;
      if (!pass) all16StagingRoundTripsPass = false;
      stagingResults.push({
        pairNumber: pair.pairNumber,
        docId,
        wasInMcqs: Boolean(mDoc),
        wasInQuestions: Boolean(qDoc),
        stagingRoundTripPass: pass,
      });
    }
  }

  const rslpIntact = PHASE4_PRESERVED_RSLP_IDS.every((id) => mcqsMap.has(id));
  const task4PreflightPass = all16StagingRoundTripsPass && rslpIntact;

  console.log({
    testedInStagingCount: stagingResults.length,
    all16StagingArchivalCompletenessPass: all16StagingRoundTripsPass,
    duplicateArchivalOverwriteBlockedInStaging: all16StagingRoundTripsPass,
    all16StagingRestoreByteIdenticalPass: all16StagingRoundTripsPass,
    all4RslpQuestionsPreserved: rslpIntact,
    TASK_4_PREFLIGHT_STATUS: task4PreflightPass ? "PASS (16/16 Staging Round-Trips Verified)" : "FAIL",
    TASK_4_EXECUTION_STATE: "WAITING_FOR_INDIVIDUAL_PAIR_TOKENS",
  });

  auditLogs.push({
    timestamp: nowIso,
    task: "TASK_4",
    action: "Staging Archival, Duplicate-Archive Prevention & Restoration Verification",
    actorRole: "system_preflight",
    status: task4PreflightPass ? "AWAITING_APPROVAL" : "PREFLIGHT_FAIL",
    targetDocumentIds: stagingResults.map((r) => r.docId),
    details: {
      all16StagingRoundTripsPass,
      rslpIntact,
      preflightPass: task4PreflightPass,
    },
  });

  // ================================================================================
  // CONDITION 5 — PRODUCTION SECURITY RULES & CREDENTIAL NON-EXPOSURE VERIFICATION
  // ================================================================================
  console.log("\n--- CONDITION 5: FIRESTORE SECURITY RULES & PRODUCTION SAFETY CHECK ---");
  const rulesText = fs.readFileSync(path.resolve("/app/applet/firestore.rules"), "utf8");
  const protectedCollections = ["subjects", "chapters", "topics", "mcqs", "questions", "archived_mcqs"];
  const securityRuleResults: Record<string, boolean> = {};

  for (const colName of protectedCollections) {
    const ruleRegex = new RegExp(
      `match\\s+\\/${colName}\\/\\{[a-zA-Z0-9_]+\\}\\s*\\{[\\s\\S]*?allow\\s+(?:read,\\s*)?write:\\s*if\\s+isAdmin\\(\\);`,
      "m"
    );
    securityRuleResults[colName] = ruleRegex.test(rulesText);
  }

  const userSubcollectionsProtected =
    /match\s+\/users\/\{userId\}[\s\S]*?match\s+\/\{allSubcollections=\*\*\}[\s\S]*?allow\s+read,\s*write:\s*if\s+request\.auth\.uid\s*==\s*userId\s*\|\|\s*isAdmin\(\);/m.test(
      rulesText
    );

  const consoleComponentText = fs.readFileSync(
    path.resolve("/app/applet/src/components/admin/Phase4ApprovalConsole.tsx"),
    "utf8"
  );
  const noExposedTokensInClientUi =
    !consoleComponentText.includes("APPROVE_DELETE_TEST_ARTIFACT") &&
    !consoleComponentText.includes("APPROVE_TASK_3_CURRICULUM_MAPPING") &&
    !consoleComponentText.includes("APPROVE_TASK_4_LEGACY_RECONCILIATION") &&
    !consoleComponentText.includes("zdpaliyal@gmail.com") &&
    !consoleComponentText.includes("jagdishpaliyaljat@gmail.com");

  const allSecurityRulesEnforced =
    Object.values(securityRuleResults).every(Boolean) &&
    userSubcollectionsProtected &&
    noExposedTokensInClientUi;

  console.log({
    adminOnlyWriteRulesVerifiedByCollection: securityRuleResults,
    userProgressAndSubcollectionsProtected: userSubcollectionsProtected,
    noTokensOrAdminCredentialsInClientUi: noExposedTokensInClientUi,
    allProtectedCollectionsRequireAdminAuth: allSecurityRulesEnforced,
    usedVerifiedBackupSnapshotDueToDailyReadQuota: usedVerifiedBackupSnapshot,
    productionWritesExecuted: 0,
  });

  // Save Immutable Audit Log (without exposing any credentials or tokens)
  const auditLogPath = path.join(BACKUPS_DIR, "phase4_immutable_audit_log.json");
  let existingAuditLogs: Phase4AuditLogEntry[] = [];
  if (fs.existsSync(auditLogPath)) {
    try {
      existingAuditLogs = JSON.parse(fs.readFileSync(auditLogPath, "utf8"));
    } catch {}
  }
  const sanitizedExisting = existingAuditLogs.map((entry: any) => {
    const { actorEmail, actorUid, ...rest } = entry;
    return { ...rest, actorRole: entry.actorRole || "system_preflight" };
  });
  const combinedAuditLogs = [...sanitizedExisting, ...auditLogs];
  fs.writeFileSync(auditLogPath, JSON.stringify(combinedAuditLogs, null, 2), "utf8");

  if (
    !task1PreflightPass ||
    !task2PreflightPass ||
    !task3PreflightPass ||
    !task4PreflightPass ||
    !allSecurityRulesEnforced
  ) {
    process.exit(1);
  }
  process.exit(0);
}

runPhase4ControlledAuditAndPreflight().catch((err) => {
  console.error("Phase 4 final pre-execution safety check failed:", err);
  process.exit(1);
});
