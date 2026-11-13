import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "../src/lib/firebase";
import { fetchMCQsByTopic } from "../src/utils/firebaseSyncService";
import { loadUserQuestionsStore, getCombinedChapters, getTopicQuestionsCount, getChapterDisplayCount, getSubjectQuestionsCount } from "../src/utils/questionsStorage";

interface TopicAuditRow {
  subjectName: string;
  subjectId: string;
  chapterTitle: string;
  chapterId: string;
  topicTitle: string;
  topicId: string;
  firestoreTopicDocCount: number;
  firestoreValidCount: number;
  fetchMCQsByTopicCount: number;
  inMemoryTopicCount: number;
  diff: number;
  notes: string;
}

async function runGlobalAudit() {
  console.log("=== QUIZPRO GLOBAL TOPIC MCQ AUDIT ===");

  const [subsSnap, chsSnap, topsSnap, allMcqsSnap] = await Promise.all([
    getDocs(collection(db, "subjects")),
    getDocs(collection(db, "chapters")),
    getDocs(collection(db, "topics")),
    getDocs(collection(db, "mcqs")),
  ]);

  const subjects = subsSnap.docs.map(d => ({ id: d.id, ...d.data() as any }));
  const chapters = chsSnap.docs.map(d => ({ id: d.id, ...d.data() as any }));
  const topics = topsSnap.docs.map(d => ({ id: d.id, ...d.data() as any }));
  const allMcqs = allMcqsSnap.docs.map(d => ({ id: d.id, ...d.data() as any }));

  console.log(`Firestore Summary:`);
  console.log(` - Subjects: ${subjects.length}`);
  console.log(` - Chapters: ${chapters.length}`);
  console.log(` - Topics: ${topics.length}`);
  console.log(` - Total MCQs: ${allMcqs.length}`);

  const subjectMap = new Map(subjects.map(s => [s.id, s]));
  const chapterMap = new Map(chapters.map(c => [c.id, c]));
  const topicMap = new Map(topics.map(t => [t.id, t]));

  // Setup full in-memory store simulating populated app state
  const fullStore = {
    customSubjects: subjects,
    customChapters: chapters,
    customTopics: topics,
    cloudCacheQuestions: allMcqs,
    customQuestions: [],
    editedSubjects: {},
    editedChapters: {},
    editedTopics: {},
    editedQuestions: {},
    deletedSubjectIds: [],
    deletedChapterIds: [],
    deletedTopicIds: [],
    deletedQuestionIds: [],
  };

  const combinedChapters = getCombinedChapters(fullStore as any);

  const auditRows: TopicAuditRow[] = [];

  for (const t of topics) {
    const ch = chapterMap.get(t.chapterId);
    const sub = ch ? subjectMap.get(ch.subjectId) : subjectMap.get(t.subjectId);

    const sName = sub ? (sub.name || sub.title || sub.hindiName) : "Unknown Subject";
    const sId = sub ? sub.id : (t.subjectId || "UNKNOWN");
    const cTitle = ch ? (ch.title || ch.hindiTitle) : "Unknown Chapter";
    const cId = ch ? ch.id : (t.chapterId || "UNKNOWN");
    const tTitle = t.title || t.hindiTitle || "Unknown Topic";

    // 1. Direct Firestore docs with where("topicId", "==", t.id)
    const mcqsRef = collection(db, "mcqs");
    const qTop = query(mcqsRef, where("topicId", "==", t.id));
    const snap = await getDocs(qTop);
    const fsDocs = snap.docs.map(d => ({ id: d.id, ...d.data() as any }));
    const fsCount = fsDocs.length;

    // Valid check
    const validFsDocs = fsDocs.filter(q => (q.text || q.question) && Array.isArray(q.options) && q.options.length >= 2);
    const validCount = validFsDocs.length;

    // 2. fetchMCQsByTopic
    let fetchCount = 0;
    try {
      const fetched = await fetchMCQsByTopic(t.id);
      fetchCount = fetched.length;
    } catch (e: any) {
      console.warn(`Error in fetchMCQsByTopic for ${t.id}:`, e?.message);
    }

    // 3. In-memory count via getCombinedChapters
    const matchedCh = combinedChapters.find(c => c.id === cId);
    const matchedTop = matchedCh?.topics.find(top => top.id === t.id);
    const inMemoryCount = matchedTop?.questions?.length || 0;

    const diff = fsCount - inMemoryCount;
    let notes = "OK";
    if (diff !== 0) {
      notes = `Mismatch of ${diff} question(s)`;
    } else if (validCount !== fsCount) {
      notes = `${fsCount - validCount} invalid format doc(s)`;
    }

    auditRows.push({
      subjectName: sName,
      subjectId: sId,
      chapterTitle: cTitle,
      chapterId: cId,
      topicTitle: tTitle,
      topicId: t.id,
      firestoreTopicDocCount: fsCount,
      firestoreValidCount: validCount,
      fetchMCQsByTopicCount: fetchCount,
      inMemoryTopicCount: inMemoryCount,
      diff,
      notes,
    });
  }

  console.log("\n=== TOPIC AUDIT RESULTS TABLE ===");
  console.table(auditRows.map(r => ({
    Subject: r.subjectName,
    Chapter: r.chapterTitle,
    Topic: r.topicTitle,
    "Topic ID": r.topicId,
    "Firestore Docs": r.firestoreTopicDocCount,
    "Valid MCQs": r.firestoreValidCount,
    "fetchMCQsByTopic": r.fetchMCQsByTopicCount,
    "In-Memory": r.inMemoryTopicCount,
    Diff: r.diff,
    Notes: r.notes,
  })));

  // Identify any orphaned questions (where topicId is not in topics collection)
  console.log("\n=== ORPHANED & UNASSIGNED QUESTIONS AUDIT ===");
  const orphanedDocs: any[] = [];
  const assignedTopicIds = new Set(topics.map(t => t.id));

  allMcqs.forEach(q => {
    const tId = q.topicId;
    if (!tId || !assignedTopicIds.has(tId)) {
      orphanedDocs.push({
        id: q.id,
        topicId: q.topicId || "UNDEFINED",
        chapterId: q.chapterId || "UNDEFINED",
        subjectId: q.subjectId || "UNDEFINED",
        hasText: Boolean(q.text || q.question),
        textPreview: (q.text || q.question || "").slice(0, 50),
      });
    }
  });

  console.log(`Total questions with unmapped topicId: ${orphanedDocs.length}`);
  orphanedDocs.forEach(d => {
    console.log(` - ID: [${d.id}] | TopicId: [${d.topicId}] | ChapterId: [${d.chapterId}] | SubjectId: [${d.subjectId}] | HasText: ${d.hasText}`);
  });

  process.exit(0);
}

runGlobalAudit().catch(e => {
  console.error("Audit failed:", e);
  process.exit(1);
});
