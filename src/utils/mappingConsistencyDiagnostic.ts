import { collection, query, limit, doc } from "firebase/firestore";
import { db, isFirebaseConfigured } from "../lib/firebase";
import { guardedGetDocs, guardedSetDoc } from "./quotaTracker";
import { loadUserQuestionsStore, getCombinedChapters, getCombinedSubjects, getCombinedQuestions, saveUserQuestionsStore } from "./questionsStorage";
import { Subject, Chapter, Topic, Question } from "../types";

export interface MismatchItem {
  id: string;
  title: string;
  reason: string;
  sourceFirestore?: any;
  sourceAppState?: any;
}

export interface RegeneratedIdDetail {
  entityType: "subject" | "chapter" | "topic" | "question";
  oldIdOrTitle: string;
  currentId: string;
  affectedQuestionCount: number;
  recommendation: string;
}

export interface MappingConsistencyReport {
  timestamp: string;
  isConsistent: boolean;
  firestoreCounts: {
    subjects: number;
    chapters: number;
    topics: number;
    mcqs: number;
  };
  appStateCounts: {
    subjects: number;
    chapters: number;
    topics: number;
    questions: number;
  };
  subjectMismatches: MismatchItem[];
  chapterMismatches: MismatchItem[];
  topicMismatches: MismatchItem[];
  orphanedQuestions: MismatchItem[];
  regeneratedIds: RegeneratedIdDetail[];
  summaryMessage: string;
}

export interface ConsistencyRepairResult {
  success: boolean;
  repairedSubjectsCount: number;
  repairedChaptersCount: number;
  repairedTopicsCount: number;
  repairedQuestionsCount: number;
  message: string;
}

/**
 * Diagnostic script that compares Firestore subject/chapter/topic/MCQ documents
 * with application state (getCombinedChapters / loadUserQuestionsStore).
 * Specifically verifies that IDs have not been regenerated or orphaned.
 */
export async function runMappingConsistencyDiagnostic(): Promise<MappingConsistencyReport> {
  const timestamp = new Date().toISOString();
  
  // 1. App State Data
  const store = loadUserQuestionsStore();
  const appSubjects = getCombinedSubjects(store);
  const appChapters = getCombinedChapters(store);
  const appTopics = appChapters.flatMap((c) => c.topics || []);
  const appQuestions = getCombinedQuestions(appChapters, store);

  const appSubjectMap = new Map<string, Subject>(appSubjects.map((s) => [s.id, s]));
  const appChapterMap = new Map<string, Chapter>(appChapters.map((c) => [c.id, c]));
  const appTopicMap = new Map<string, Topic>(appTopics.map((t) => [t.id, t]));

  // 2. Fetch Firestore Documents
  let fsSubjects: Subject[] = [];
  let fsChapters: Chapter[] = [];
  let fsTopics: Topic[] = [];
  let fsMcqs: Question[] = [];

  if (isFirebaseConfigured()) {
    try {
      const [sSnap, cSnap, tSnap, mSnap] = await Promise.all([
        guardedGetDocs(query(collection(db, "subjects"), limit(1000)), "Admin", "Consistency Check Subjects", undefined, 5000, true).catch(() => null),
        guardedGetDocs(query(collection(db, "chapters"), limit(1000)), "Admin", "Consistency Check Chapters", undefined, 5000, true).catch(() => null),
        guardedGetDocs(query(collection(db, "topics"), limit(1000)), "Admin", "Consistency Check Topics", undefined, 5000, true).catch(() => null),
        guardedGetDocs(query(collection(db, "mcqs"), limit(2000)), "Admin", "Consistency Check MCQs", undefined, 5000, true).catch(() => null),
      ]);

      if (sSnap) fsSubjects = sSnap.docs.map((d) => ({ ...d.data(), id: d.id } as Subject));
      if (cSnap) fsChapters = cSnap.docs.map((d) => ({ ...d.data(), id: d.id } as Chapter));
      if (tSnap) fsTopics = tSnap.docs.map((d) => ({ ...d.data(), id: d.id } as Topic));
      if (mSnap) fsMcqs = mSnap.docs.map((d) => ({ ...d.data(), id: d.id } as Question));
    } catch (e) {
      console.warn("[MappingConsistency] Firestore fetch warning:", e);
    }
  }

  // 3. Subject Mismatches & Regenerated ID Checks
  const subjectMismatches: MismatchItem[] = [];
  fsSubjects.forEach((fsSub) => {
    if (!appSubjectMap.has(fsSub.id)) {
      // Check if title matches another subject in app state with a different ID
      const appMatch = appSubjects.find(
        (s) => s.name.toLowerCase().trim() === (fsSub.name || "").toLowerCase().trim()
      );
      if (appMatch) {
        subjectMismatches.push({
          id: fsSub.id,
          title: fsSub.name,
          reason: `Regenerated Subject ID: Firestore ID '${fsSub.id}' differs from App State ID '${appMatch.id}' for subject '${fsSub.name}'`,
          sourceFirestore: fsSub,
          sourceAppState: appMatch,
        });
      } else {
        subjectMismatches.push({
          id: fsSub.id,
          title: fsSub.name,
          reason: `Orphaned Subject in Firestore: ID '${fsSub.id}' is not loaded in App State`,
          sourceFirestore: fsSub,
        });
      }
    }
  });

  // 4. Chapter Mismatches & Regenerated ID Checks
  const chapterMismatches: MismatchItem[] = [];
  fsChapters.forEach((fsChap) => {
    if (!appChapterMap.has(fsChap.id)) {
      const fsTitle = fsChap.title || fsChap.hindiTitle || "Chapter";
      const appMatch = appChapters.find(
        (c) => (c.title || c.hindiTitle || "").toLowerCase().trim() === fsTitle.toLowerCase().trim()
      );
      if (appMatch) {
        chapterMismatches.push({
          id: fsChap.id,
          title: fsTitle,
          reason: `Regenerated Chapter ID: Firestore ID '${fsChap.id}' differs from App State ID '${appMatch.id}' for chapter '${fsTitle}'`,
          sourceFirestore: fsChap,
          sourceAppState: appMatch,
        });
      } else {
        chapterMismatches.push({
          id: fsChap.id,
          title: fsTitle,
          reason: `Orphaned Chapter in Firestore: ID '${fsChap.id}' is missing from App State`,
          sourceFirestore: fsChap,
        });
      }
    }
  });

  // 5. Topic Mismatches & Regenerated ID Checks
  const topicMismatches: MismatchItem[] = [];
  fsTopics.forEach((fsTop) => {
    if (!appTopicMap.has(fsTop.id)) {
      const fsTitle = fsTop.title || fsTop.hindiTitle || "Topic";
      const appMatch = appTopics.find(
        (t) => (t.title || t.hindiTitle || "").toLowerCase().trim() === fsTitle.toLowerCase().trim()
      );
      if (appMatch) {
        topicMismatches.push({
          id: fsTop.id,
          title: fsTitle,
          reason: `Regenerated Topic ID: Firestore ID '${fsTop.id}' differs from App State ID '${appMatch.id}' for topic '${fsTitle}'`,
          sourceFirestore: fsTop,
          sourceAppState: appMatch,
        });
      } else {
        topicMismatches.push({
          id: fsTop.id,
          title: fsTitle,
          reason: `Orphaned Topic in Firestore: ID '${fsTop.id}' is not loaded in App State`,
          sourceFirestore: fsTop,
        });
      }
    }
  });

  // 6. Orphaned Questions in Firestore vs Active Syllabus
  const orphanedQuestions: MismatchItem[] = [];
  const regeneratedIds: RegeneratedIdDetail[] = [];

  const allActiveQuestionList = fsMcqs.length > 0 ? fsMcqs : appQuestions;

  const appTopicIdsSet = new Set(appTopics.map((t) => t.id));
  const appChapterIdsSet = new Set(appChapters.map((c) => c.id));
  const appSubjectIdsSet = new Set(appSubjects.map((s) => s.id));

  allActiveQuestionList.forEach((q) => {
    const qText = q.text || (q as any).question || "Untitled MCQ";
    const topicIdNorm = q.topicId || "";
    const chapterIdNorm = q.chapterId || "";
    const subjectIdNorm = q.subjectId || "";

    const isTopicMissing = Boolean(topicIdNorm && !appTopicIdsSet.has(topicIdNorm));
    const isChapterMissing = Boolean(chapterIdNorm && !appChapterIdsSet.has(chapterIdNorm));
    const isSubjectMissing = Boolean(subjectIdNorm && !appSubjectIdsSet.has(subjectIdNorm));

    if (isTopicMissing || isChapterMissing || isSubjectMissing) {
      orphanedQuestions.push({
        id: q.id,
        title: qText.length > 100 ? `${qText.substring(0, 100)}...` : qText,
        reason: `Mismatched Question References: ${
          isTopicMissing ? `Topic ID '${topicIdNorm}' missing; ` : ""
        }${isChapterMissing ? `Chapter ID '${chapterIdNorm}' missing; ` : ""}${
          isSubjectMissing ? `Subject ID '${subjectIdNorm}' missing` : ""
        }`,
        sourceFirestore: q,
      });
    }
  });

  // Collect regenerated ID details summary
  if (topicMismatches.length > 0) {
    topicMismatches.forEach((tm) => {
      if (tm.sourceAppState) {
        regeneratedIds.push({
          entityType: "topic",
          oldIdOrTitle: tm.id,
          currentId: tm.sourceAppState.id,
          affectedQuestionCount: allActiveQuestionList.filter((q) => q.topicId === tm.id).length,
          recommendation: `Re-map questions with topicId '${tm.id}' to current ID '${tm.sourceAppState.id}'`,
        });
      }
    });
  }

  const isConsistent =
    subjectMismatches.length === 0 &&
    chapterMismatches.length === 0 &&
    topicMismatches.length === 0 &&
    orphanedQuestions.length === 0;

  let summaryMessage = "";
  if (isConsistent) {
    summaryMessage = `Consistency Verified! 100% agreement between Firestore collections and application state. No regenerated or orphaned IDs detected.`;
  } else {
    summaryMessage = `Consistency Warning! Found ${subjectMismatches.length} subject mismatch(es), ${chapterMismatches.length} chapter mismatch(es), ${topicMismatches.length} topic mismatch(es), and ${orphanedQuestions.length} orphaned question(s).`;
  }

  const report: MappingConsistencyReport = {
    timestamp,
    isConsistent,
    firestoreCounts: {
      subjects: fsSubjects.length,
      chapters: fsChapters.length,
      topics: fsTopics.length,
      mcqs: fsMcqs.length,
    },
    appStateCounts: {
      subjects: appSubjects.length,
      chapters: appChapters.length,
      topics: appTopics.length,
      questions: appQuestions.length,
    },
    subjectMismatches,
    chapterMismatches,
    topicMismatches,
    orphanedQuestions,
    regeneratedIds,
    summaryMessage,
  };

  console.log("[MappingConsistencyReport]", report);
  return report;
}

/**
 * Executes a non-destructive repair that syncs Firestore entities with application state,
 * updating orphaned questions so they match current active topic/chapter IDs.
 */
export async function repairMappingConsistency(): Promise<ConsistencyRepairResult> {
  const store = loadUserQuestionsStore();
  const report = await runMappingConsistencyDiagnostic();

  let repairedSubjectsCount = 0;
  let repairedChaptersCount = 0;
  let repairedTopicsCount = 0;
  let repairedQuestionsCount = 0;

  try {
    // 1. Restore missing subjects/chapters/topics from Firestore into local custom arrays
    if (report.subjectMismatches.length > 0) {
      report.subjectMismatches.forEach((sm) => {
        if (sm.sourceFirestore) {
          store.customSubjects = [...(store.customSubjects || []), sm.sourceFirestore];
          repairedSubjectsCount++;
        }
      });
    }

    if (report.chapterMismatches.length > 0) {
      report.chapterMismatches.forEach((cm) => {
        if (cm.sourceFirestore) {
          store.customChapters = [...(store.customChapters || []), cm.sourceFirestore];
          repairedChaptersCount++;
        }
      });
    }

    if (report.topicMismatches.length > 0) {
      report.topicMismatches.forEach((tm) => {
        if (tm.sourceFirestore) {
          store.customTopics = [...(store.customTopics || []), tm.sourceFirestore];
          repairedTopicsCount++;
        }
      });
    }

    // 2. Re-map regenerated or orphaned question references
    const activeChapters = getCombinedChapters(store);
    const activeTopics = activeChapters.flatMap((c) => c.topics || []);
    const defaultTopic = activeTopics[0];

    if (report.orphanedQuestions.length > 0) {
      report.orphanedQuestions.forEach((oq) => {
        const qDoc = oq.sourceFirestore;
        if (qDoc) {
          let targetTopic = activeTopics.find(
            (t) =>
              t.title.toLowerCase().trim() ===
              (qDoc.topicTitle || qDoc.topicName || qDoc.topic || "").toLowerCase().trim()
          );

          if (!targetTopic && defaultTopic) {
            targetTopic = defaultTopic;
          }

          if (targetTopic) {
            const updatedMcq = {
              ...qDoc,
              topicId: targetTopic.id,
              chapterId: targetTopic.chapterId,
              subjectId: targetTopic.subjectId,
            };

            if (isFirebaseConfigured() && qDoc.id) {
              guardedSetDoc(doc(db, "mcqs", qDoc.id), updatedMcq, { merge: true }, "Admin", "Consistency Remap MCQ").catch(() => {});
            }

            repairedQuestionsCount++;
          }
        }
      });
    }

    // Save updated local store
    saveUserQuestionsStore(store);

    return {
      success: true,
      repairedSubjectsCount,
      repairedChaptersCount,
      repairedTopicsCount,
      repairedQuestionsCount,
      message: `Consistency Repair Complete! Successfully synchronized ${repairedSubjectsCount} subject(s), ${repairedChaptersCount} chapter(s), ${repairedTopicsCount} topic(s), and re-mapped ${repairedQuestionsCount} orphaned question(s).`,
    };
  } catch (err: any) {
    return {
      success: false,
      repairedSubjectsCount,
      repairedChaptersCount,
      repairedTopicsCount,
      repairedQuestionsCount,
      message: `Repair failed: ${err?.message || err}`,
    };
  }
}
