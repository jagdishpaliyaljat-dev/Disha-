import * as fs from "fs";
import * as path from "path";

interface RawQuestion {
  id: string;
  collection?: string;
  text?: string;
  question?: string;
  options?: string[];
  correctIndex?: number;
  explanation?: string;
  topicId?: string;
  chapterId?: string;
  subjectId?: string;
  updatedAt?: string;
  createdAt?: string;
  sourceFile: string;
}

export function runForensicAudit() {
  console.log("================================================================================");
  console.log("       DISHA 20-20: PHASE 1 COMPLETE QUESTION INTEGRITY FORENSIC AUDIT          ");
  console.log("================================================================================\n");

  const curriculumBackup = JSON.parse(
    fs.readFileSync("backups/phase4_task2_curriculum_and_19_questions_backup.json", "utf8")
  );
  const prod576 = JSON.parse(fs.readFileSync("full_production_backup_576.json", "utf8"));
  const prajamandal = JSON.parse(fs.readFileSync("prajamandal_backup.json", "utf8"));
  const stale262 = JSON.parse(fs.readFileSync("backups/phase4_262_stale_questions_backup.json", "utf8"));
  const nearDupes = JSON.parse(fs.readFileSync("backups/phase4_task4_near_duplicates_backup.json", "utf8"));

  const subjects = curriculumBackup.existingSubjects || [];
  const chapters = curriculumBackup.existingChapters || [];
  const topics = curriculumBackup.existingTopics || [];

  const topicMap = new Map<string, any>();
  topics.forEach((t: any) => topicMap.set(t.id, t));

  const chapterMap = new Map<string, any>();
  chapters.forEach((c: any) => chapterMap.set(c.id, c));

  const subjectMap = new Map<string, any>();
  subjects.forEach((s: any) => subjectMap.set(s.id, s));

  console.log(`[Curriculum Topology] Subjects: ${subjects.length} | Chapters: ${chapters.length} | Topics: ${topics.length}`);

  // Collect all raw documents across backups
  const allRawDocs: RawQuestion[] = [];

  // 1. prod576
  (prod576.records || []).forEach((r: any) => {
    const d = r.data || {};
    allRawDocs.push({
      id: r.id || d.id,
      collection: r.collection || "mcqs",
      text: d.text || d.question || "",
      options: d.options || [],
      correctIndex: d.correctIndex,
      explanation: d.explanation || "",
      topicId: d.topicId,
      chapterId: d.chapterId,
      subjectId: d.subjectId,
      updatedAt: d.updatedAt,
      createdAt: d.createdAt,
      sourceFile: "full_production_backup_576.json",
    });
  });

  // 2. prajamandal
  (prajamandal.mcqs || []).forEach((d: any) => {
    allRawDocs.push({
      id: d.id,
      collection: "mcqs",
      text: d.text || d.question || "",
      options: d.options || [],
      correctIndex: d.correctIndex,
      explanation: d.explanation || "",
      topicId: d.topicId,
      chapterId: d.chapterId,
      subjectId: d.subjectId,
      updatedAt: d.updatedAt,
      createdAt: d.createdAt,
      sourceFile: "prajamandal_backup.json",
    });
  });

  // 3. stale262
  (stale262.records || []).forEach((rec: any) => {
    if (rec.mcqsRecord) {
      allRawDocs.push({
        id: rec.id,
        collection: "mcqs",
        text: rec.mcqsRecord.text || rec.mcqsRecord.question || "",
        options: rec.mcqsRecord.options || [],
        correctIndex: rec.mcqsRecord.correctIndex,
        explanation: rec.mcqsRecord.explanation || "",
        topicId: rec.mcqsRecord.topicId,
        chapterId: rec.mcqsRecord.chapterId,
        subjectId: rec.mcqsRecord.subjectId,
        updatedAt: rec.mcqsRecord.updatedAt,
        createdAt: rec.mcqsRecord.createdAt,
        sourceFile: "phase4_262_stale_questions_backup.json:mcqs",
      });
    }
    if (rec.questionsRecord) {
      allRawDocs.push({
        id: rec.id,
        collection: "questions",
        text: rec.questionsRecord.text || rec.questionsRecord.question || "",
        options: rec.questionsRecord.options || [],
        correctIndex: rec.questionsRecord.correctIndex,
        explanation: rec.questionsRecord.explanation || "",
        topicId: rec.questionsRecord.topicId,
        chapterId: rec.questionsRecord.chapterId,
        subjectId: rec.questionsRecord.subjectId,
        updatedAt: rec.questionsRecord.updatedAt,
        createdAt: rec.questionsRecord.createdAt,
        sourceFile: "phase4_262_stale_questions_backup.json:questions",
      });
    }
  });

  // 4. task2 target 19 questions
  (curriculumBackup.target19Questions || []).forEach((q: any) => {
    if (q.mcqsPayload) {
      allRawDocs.push({
        id: q.id,
        collection: "mcqs",
        text: q.mcqsPayload.text || q.mcqsPayload.question || "",
        options: q.mcqsPayload.options || [],
        correctIndex: q.mcqsPayload.correctIndex,
        explanation: q.mcqsPayload.explanation || "",
        topicId: q.mcqsPayload.topicId,
        chapterId: q.mcqsPayload.chapterId,
        subjectId: q.mcqsPayload.subjectId,
        updatedAt: q.mcqsPayload.updatedAt,
        createdAt: q.mcqsPayload.createdAt,
        sourceFile: "phase4_task2_backup.json:mcqs",
      });
    }
    if (q.questionsPayload) {
      allRawDocs.push({
        id: q.id,
        collection: "questions",
        text: q.questionsPayload.text || q.questionsPayload.question || "",
        options: q.questionsPayload.options || [],
        correctIndex: q.questionsPayload.correctIndex,
        explanation: q.questionsPayload.explanation || "",
        topicId: q.questionsPayload.topicId,
        chapterId: q.questionsPayload.chapterId,
        subjectId: q.questionsPayload.subjectId,
        updatedAt: q.questionsPayload.updatedAt,
        createdAt: q.questionsPayload.createdAt,
        sourceFile: "phase4_task2_backup.json:questions",
      });
    }
  });

  console.log(`[Total Physical Document Snapshots Loaded]: ${allRawDocs.length}`);

  // Deduplicate physical documents by (id + collection)
  const uniqueDocMap = new Map<string, RawQuestion>();
  allRawDocs.forEach((d) => {
    const key = `${d.collection || "mcqs"}::${d.id}`;
    const existing = uniqueDocMap.get(key);
    if (!existing) {
      uniqueDocMap.set(key, d);
    } else {
      // Pick newer updatedAt
      const t1 = new Date(existing.updatedAt || existing.createdAt || 0).getTime();
      const t2 = new Date(d.updatedAt || d.createdAt || 0).getTime();
      if (t2 > t1) {
        uniqueDocMap.set(key, d);
      }
    }
  });

  const physicalDocs = Array.from(uniqueDocMap.values());
  console.log(`[Unique Physical Documents (id + collection)]: ${physicalDocs.length}`);

  // Unique document IDs regardless of collection
  const uniqueDocIdMap = new Map<string, RawQuestion[]>();
  physicalDocs.forEach((d) => {
    const arr = uniqueDocIdMap.get(d.id) || [];
    arr.push(d);
    uniqueDocIdMap.set(d.id, arr);
  });
  console.log(`[Unique Question Document IDs]: ${uniqueDocIdMap.size}`);

  // Group by logical question (normalized text + sorted options)
  const normalizeOpts = (options: string[] = []): string =>
    (options || []).map((o: any) => (typeof o === "string" ? o.trim().toLowerCase() : "")).sort().join("|");

  const logicalQuestionMap = new Map<string, RawQuestion[]>();
  physicalDocs.forEach((d) => {
    const txt = (d.text || "").trim().toLowerCase();
    const opts = normalizeOpts(d.options);
    const logicalKey = `${txt}:::${opts}`;
    const arr = logicalQuestionMap.get(logicalKey) || [];
    arr.push(d);
    logicalQuestionMap.set(logicalKey, arr);
  });
  console.log(`[Unique Logical Questions (Text + Options)]: ${logicalQuestionMap.size}`);

  // Analyze topic mappings
  const validTopicQuestions: RawQuestion[] = [];
  const invalidTopicQuestions: RawQuestion[] = [];
  const orphanedQuestions: RawQuestion[] = [];
  const multiMappedLogicalQuestions: { logicalKey: string; docs: RawQuestion[]; topics: string[] }[] = [];

  logicalQuestionMap.forEach((docs, logicalKey) => {
    const distinctTopics = Array.from(new Set(docs.map((d) => d.topicId).filter(Boolean))) as string[];
    if (distinctTopics.length > 1) {
      multiMappedLogicalQuestions.push({ logicalKey, docs, topics: distinctTopics });
    }
  });

  physicalDocs.forEach((d) => {
    if (!d.topicId) {
      orphanedQuestions.push(d);
    } else if (topicMap.has(d.topicId)) {
      validTopicQuestions.push(d);
    } else {
      invalidTopicQuestions.push(d);
    }
  });

  console.log(`[Questions with Valid Topic Mappings]: ${validTopicQuestions.length}`);
  console.log(`[Questions with Invalid / Outdated Topic Mappings]: ${invalidTopicQuestions.length}`);
  console.log(`[Orphaned Questions (No Topic ID)]: ${orphanedQuestions.length}`);
  console.log(`[Logical Questions Appearing Across Multiple Topics]: ${multiMappedLogicalQuestions.length}`);

  // TOPIC COUNT RECONCILIATION TABLE
  console.log("\n================================================================================");
  console.log("                     TOPIC-WISE COUNT RECONCILIATION TABLE                      ");
  console.log("================================================================================\n");

  const topicStats = new Map<
    string,
    {
      topic: any;
      physicalCount: number;
      uniqueIdCount: number;
      uniqueLogicalCount: number;
      displayedCount: number;
      discrepancy: number;
    }
  >();

  // Initialize for all 57 topics
  topics.forEach((t: any) => {
    topicStats.set(t.id, {
      topic: t,
      physicalCount: 0,
      uniqueIdCount: 0,
      uniqueLogicalCount: 0,
      displayedCount: typeof t.questionCount === "number" ? t.questionCount : 0,
      discrepancy: 0,
    });
  });

  // Count per topic using physical docs
  const docsByTopic = new Map<string, RawQuestion[]>();
  physicalDocs.forEach((d) => {
    if (!d.topicId) return;
    const arr = docsByTopic.get(d.topicId) || [];
    arr.push(d);
    docsByTopic.set(d.topicId, arr);
  });

  docsByTopic.forEach((docs, topicId) => {
    let stat = topicStats.get(topicId);
    if (!stat) {
      // Unmapped / orphaned topic not in the 57 curriculum topics!
      stat = {
        topic: { id: topicId, title: `[UNLISTED] ${topicId}`, chapterId: "UNKNOWN" },
        physicalCount: 0,
        uniqueIdCount: 0,
        uniqueLogicalCount: 0,
        displayedCount: 0,
        discrepancy: 0,
      };
      topicStats.set(topicId, stat);
    }

    stat.physicalCount = docs.length;
    stat.uniqueIdCount = new Set(docs.map((d) => d.id)).size;

    const uniqueLogical = new Set(
      docs.map((d) => `${(d.text || "").trim().toLowerCase()}:::${normalizeOpts(d.options)}`)
    ).size;
    stat.uniqueLogicalCount = uniqueLogical;
    stat.discrepancy = stat.displayedCount - stat.uniqueLogicalCount;
  });

  console.log(
    `| ${"Topic Title".padEnd(30)} | ${"Topic ID".padEnd(38)} | ${"Phys Docs".padStart(9)} | ${"Unique IDs".padStart(10)} | ${"Unique MCQs".padStart(11)} | ${"UI Count".padStart(8)} | ${"Diff".padStart(6)} |`
  );
  console.log(
    `|${"-".repeat(32)}|${"-".repeat(40)}|${"-".repeat(11)}|${"-".repeat(12)}|${"-".repeat(13)}|${"-".repeat(10)}|${"-".repeat(8)}|`
  );

  let totalPhys = 0;
  let totalUniqueIds = 0;
  let totalUniqueLogical = 0;
  let totalUI = 0;
  let mismatchCount = 0;

  Array.from(topicStats.values())
    .sort((a, b) => (b.uniqueLogicalCount || 0) - (a.uniqueLogicalCount || 0))
    .forEach((s) => {
      const t = s.topic;
      const title = (t.title || t.hindiTitle || t.id).slice(0, 30);
      const diffStr = s.discrepancy > 0 ? `+${s.discrepancy}` : `${s.discrepancy}`;

      totalPhys += s.physicalCount;
      totalUniqueIds += s.uniqueIdCount;
      totalUniqueLogical += s.uniqueLogicalCount;
      totalUI += s.displayedCount;
      if (s.discrepancy !== 0) mismatchCount++;

      console.log(
        `| ${title.padEnd(30)} | ${t.id.padEnd(38)} | ${String(s.physicalCount).padStart(9)} | ${String(s.uniqueIdCount).padStart(10)} | ${String(s.uniqueLogicalCount).padStart(11)} | ${String(s.displayedCount).padStart(8)} | ${diffStr.padStart(6)} |`
      );
    });

  console.log(
    `|${"-".repeat(32)}|${"-".repeat(40)}|${"-".repeat(11)}|${"-".repeat(12)}|${"-".repeat(13)}|${"-".repeat(10)}|${"-".repeat(8)}|`
  );
  console.log(
    `| ${"TOTALS".padEnd(30)} | ${String(topicStats.size + " topics").padEnd(38)} | ${String(totalPhys).padStart(9)} | ${String(totalUniqueIds).padStart(10)} | ${String(totalUniqueLogical).padStart(11)} | ${String(totalUI).padStart(8)} | ${String(totalUI - totalUniqueLogical).padStart(6)} |`
  );
  console.log(`\nTotal topics with count mismatch: ${mismatchCount} / ${topicStats.size}`);

  // Detailed Analysis of Cross-Topic Duplicates
  if (multiMappedLogicalQuestions.length > 0) {
    console.log("\n================================================================================");
    console.log("       CROSS-TOPIC DUPLICATE QUESTIONS (MOVED BUT LEFT IN SOURCE)               ");
    console.log("================================================================================\n");
    multiMappedLogicalQuestions.forEach((item, idx) => {
      console.log(`[${idx + 1}] Question: "${item.docs[0].text?.slice(0, 60)}..."`);
      console.log(`    Appears in topics: [ ${item.topics.join(", ")} ]`);
      item.docs.forEach((d) => {
        console.log(`       - Doc ID: ${d.id} | Collection: ${d.collection} | Topic: ${d.topicId} | Updated: ${d.updatedAt} | Source: ${d.sourceFile}`);
      });
    });
  }

  // Orphaned Questions Analysis
  if (orphanedQuestions.length > 0) {
    console.log("\n================================================================================");
    console.log("                   ORPHANED QUESTIONS (NO TOPIC ID)                             ");
    console.log("================================================================================\n");
    orphanedQuestions.forEach((q, idx) => {
      console.log(`[${idx + 1}] ID: ${q.id} | Subject: ${q.subjectId} | Chapter: ${q.chapterId} | Text: "${q.text?.slice(0, 50)}..."`);
    });
  }

  // Invalid Topic ID Questions Analysis
  if (invalidTopicQuestions.length > 0) {
    console.log("\n================================================================================");
    console.log("         QUESTIONS WITH INVALID / OBSOLETE TOPIC IDS                            ");
    console.log("================================================================================\n");
    invalidTopicQuestions.forEach((q, idx) => {
      console.log(`[${idx + 1}] ID: ${q.id} | Invalid Topic ID: ${q.topicId} | Chapter: ${q.chapterId} | Text: "${q.text?.slice(0, 50)}..."`);
    });
  }
}

runForensicAudit();
