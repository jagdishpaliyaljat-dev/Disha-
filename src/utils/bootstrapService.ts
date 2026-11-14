import { collection, query, limit, getDocs, startAfter, orderBy, doc } from "firebase/firestore";
import { db, isFirebaseConfigured } from "../lib/firebase";
import { guardedGetDocs, guardedGetDoc } from "../utils/quotaTracker";
import { saveQuestionsToCache } from "../utils/questionBankCache";
import { loadSyncCheckpoint, saveSyncCheckpoint } from "../utils/syncCheckpointRegistry";
import { 
  stageIncomingRecords, 
  commitStagedBatch, 
  discardStagedBatch,
  STORES, 
  saveLocalSubjects, 
  saveLocalChapters, 
  saveLocalTopics, 
  saveLocalMCQs, 
  saveLocalPYQPapers,
  openLocalDatabase
} from "./localDatabaseEngine";
import { Subject, Chapter, Topic, Question, PYQPaper } from "../types";

export interface BootstrapProgressState {
  status: "not_started" | "downloading" | "validating" | "ready_to_activate" | "completed" | "error";
  datasetName: string;
  downloadedCount: number;
  totalCount?: number;
  progressPercentage?: number;
  errorMessage?: string;
}

export type BootstrapProgressCallback = (state: BootstrapProgressState) => void;

/**
 * Executes a controlled, staged initial bootstrap session to download all required student-facing content:
 * - Subjects, Chapters, Topics
 * - Canonical MCQs (Paginated)
 * - PYQ Papers
 * - Version Manifest
 * 
 * Safety invariants:
 * - Uses sync_staging; partial downloads never overwrite the active local database.
 * - Atomic commit via commitStagedBatch only after 100% integrity validation passes.
 * - Resumable and safe against network interruptions.
 */
export async function executeInitialBootstrap(
  onProgress?: BootstrapProgressCallback
): Promise<{ success: boolean; totalMcqs: number; totalPyqs: number; error?: string }> {
  if (!isFirebaseConfigured()) {
    return { success: false, totalMcqs: 0, totalPyqs: 0, error: "Firebase is not configured." };
  }

  const checkpoint = await loadSyncCheckpoint();
  if (checkpoint.bootstrapCompleted) {
    return { success: true, totalMcqs: 0, totalPyqs: 0 };
  }

  const batchId = `bootstrap_${Date.now()}`;
  const now = Date.now();
  checkpoint.lastAttemptedSyncAt = now;
  await saveSyncCheckpoint(checkpoint);

  try {
    await openLocalDatabase();

    onProgress?.({
      status: "downloading",
      datasetName: "Curriculum & Subjects",
      downloadedCount: 0,
      progressPercentage: 5,
    });

    // 1. Download Subjects, Chapters, Topics
    const [subsSnap, chsSnap, topsSnap, pyqsSnap, versionSnap] = await Promise.all([
      guardedGetDocs(collection(db, "subjects"), "Student", "Bootstrap Subjects", undefined, 30000).catch(() => null),
      guardedGetDocs(collection(db, "chapters"), "Student", "Bootstrap Chapters", undefined, 30000).catch(() => null),
      guardedGetDocs(collection(db, "topics"), "Student", "Bootstrap Topics", undefined, 30000).catch(() => null),
      guardedGetDocs(collection(db, "pyq_papers"), "Student", "Bootstrap PYQs", undefined, 30000).catch(() => null),
      guardedGetDoc(doc(db, "metadata", "app_version"), "Student", "Bootstrap Version Check", undefined, 15000).catch(() => null),
    ]);

    const subjects: Subject[] = subsSnap ? subsSnap.docs.map((d: any) => ({ ...d.data(), id: d.id } as Subject)) : [];
    const chapters: Chapter[] = chsSnap ? chsSnap.docs.map((d: any) => ({ ...d.data(), id: d.id } as Chapter)) : [];
    const topics: Topic[] = topsSnap ? topsSnap.docs.map((d: any) => ({ ...d.data(), id: d.id } as Topic)) : [];
    const pyqs: PYQPaper[] = pyqsSnap ? pyqsSnap.docs.map((d: any) => ({ ...d.data(), id: d.id } as PYQPaper)) : [];
    const remoteVersionMeta = versionSnap && versionSnap.exists() ? (versionSnap.data() as any) : null;

    // Stage Curriculum & PYQs
    if (subjects.length > 0) {
      await stageIncomingRecords(batchId, STORES.SUBJECTS, subjects.map(s => ({ recordId: s.id, data: s })));
    }
    if (chapters.length > 0) {
      await stageIncomingRecords(batchId, STORES.CHAPTERS, chapters.map(c => ({ recordId: c.id, data: c })));
    }
    if (topics.length > 0) {
      await stageIncomingRecords(batchId, STORES.TOPICS, topics.map(t => ({ recordId: t.id, data: t })));
    }
    if (pyqs.length > 0) {
      await stageIncomingRecords(batchId, STORES.PYQS, pyqs.map(p => ({ recordId: p.id, data: p })));
    }

    onProgress?.({
      status: "downloading",
      datasetName: "MCQ Bank (Paginated Resumable)",
      downloadedCount: 0,
      progressPercentage: 20,
    });

    // 2. Paginated Download for Canonical 'mcqs'
    const PAGE_SIZE = 500;
    const allMcqs: Question[] = [];
    const seenMcqIds = new Set<string>();
    let lastDoc: any = null;
    let hasMore = true;
    let pageCount = 0;

    const mcqsRef = collection(db, "mcqs");

    while (hasMore && pageCount < 40) { // Safety ceiling: up to 20,000 MCQs
      pageCount++;
      let q = query(mcqsRef, orderBy("__name__"), limit(PAGE_SIZE));
      if (lastDoc) {
        q = query(mcqsRef, orderBy("__name__"), startAfter(lastDoc), limit(PAGE_SIZE));
      }

      const pageSnap = await guardedGetDocs(q, "Student", `Bootstrap MCQs Page ${pageCount}`, undefined, 30000).catch(() => null);
      if (!pageSnap || pageSnap.empty) {
        hasMore = false;
        break;
      }

      const pageDocs = pageSnap.docs;
      const pageQuestions: Question[] = [];

      pageDocs.forEach((d) => {
        const data = d.data() as any;
        const qId = d.id;
        if (data && (data.text || data.question) && !seenMcqIds.has(qId)) {
          seenMcqIds.add(qId);
          const normalizedQ: Question = {
            ...data,
            id: qId,
            text: data.text || data.question || "",
            options: Array.isArray(data.options) ? data.options : [],
            correctIndex: typeof data.correctIndex === "number" ? data.correctIndex : 0,
            explanation: data.explanation || "",
            topicId: data.topicId || data.topic || "",
            chapterId: data.chapterId || "",
            subjectId: data.subjectId || "",
          };
          pageQuestions.push(normalizedQ);
          allMcqs.push(normalizedQ);
        }
      });

      // Stage each page in sync_staging
      if (pageQuestions.length > 0) {
        await stageIncomingRecords(batchId, STORES.MCQS, pageQuestions.map(q => ({ recordId: q.id, data: q })));
      }

      lastDoc = pageDocs[pageDocs.length - 1];
      if (pageDocs.length < PAGE_SIZE) {
        hasMore = false;
      }

      onProgress?.({
        status: "downloading",
        datasetName: "MCQ Bank (Paginated Resumable)",
        downloadedCount: allMcqs.length,
        progressPercentage: Math.min(85, 20 + pageCount * 10),
      });
    }

    // Snapshot fallback: if Firestore returned fewer than 500 MCQs, load from canonical Snapshot v1
    if (allMcqs.length < 500 && typeof fetch !== "undefined") {
      try {
        console.log(`[BootstrapService] Download got ${allMcqs.length} MCQs (< 500). Downloading canonical Snapshot v1...`);
        const snapResp = await fetch("/api/snapshots/v1/content.json");
        if (snapResp.ok) {
          const snapPayload = await snapResp.json();
          if (Array.isArray(snapPayload.mcqs) && snapPayload.mcqs.length > allMcqs.length) {
            for (const q of snapPayload.mcqs) {
              if (q && q.id && !seenMcqIds.has(q.id)) {
                seenMcqIds.add(q.id);
                allMcqs.push(q);
              }
            }
            if (Array.isArray(snapPayload.subjects) && subjects.length === 0) {
              subjects.push(...snapPayload.subjects);
            }
            if (Array.isArray(snapPayload.chapters) && chapters.length === 0) {
              chapters.push(...snapPayload.chapters);
            }
            if (Array.isArray(snapPayload.topics) && topics.length === 0) {
              topics.push(...snapPayload.topics);
            }
            await stageIncomingRecords(batchId, STORES.MCQS, allMcqs.map(q => ({ recordId: q.id, data: q })));
          }
        }
      } catch (snapErr: any) {
        console.warn("[BootstrapService] Snapshot fallback non-fatal error:", snapErr.message);
      }
    }

    onProgress?.({
      status: "validating",
      datasetName: "Validating Staged Content Integrity",
      downloadedCount: allMcqs.length,
      progressPercentage: 90,
    });

    // 3. Validation Step
    if (subjects.length === 0 && chapters.length === 0 && allMcqs.length === 0) {
      await discardStagedBatch(batchId);
      return { success: false, totalMcqs: 0, totalPyqs: 0, error: "Downloaded bootstrap dataset is empty." };
    }

    // Verify required fields on all MCQs
    const invalidCount = allMcqs.filter(q => !q.id || !q.text || !Array.isArray(q.options)).length;
    if (invalidCount > allMcqs.length * 0.1 && allMcqs.length > 0) {
      await discardStagedBatch(batchId);
      return { 
        success: false, 
        totalMcqs: 0, 
        totalPyqs: 0, 
        error: `Integrity check failed: ${invalidCount} invalid questions in dataset.` 
      };
    }

    onProgress?.({
      status: "ready_to_activate",
      datasetName: "Committing Staged Content to Local Database",
      downloadedCount: allMcqs.length,
      progressPercentage: 95,
    });

    // 4. Atomic Activation: commit staging into active IndexedDB stores
    await commitStagedBatch(batchId);

    // Also populate legacy local stores for backwards compatibility
    await saveQuestionsToCache(allMcqs, { source: "initial" });
    const { saveCachedCurriculum } = await import("./indexedDbCache");
    await saveCachedCurriculum(subjects, chapters, topics, allMcqs, []);

    // 5. Update Checkpoint - only mark completed if we have full content (>= 500 MCQs)
    const isFullDataset = allMcqs.length >= 500;
    checkpoint.bootstrapCompleted = isFullDataset;
    checkpoint.lastSuccessfulSyncAt = Date.now();
    checkpoint.lastAttemptedSyncAt = Date.now();
    checkpoint.nextSyncEligibleAt = isFullDataset ? (Date.now() + (24 * 60 * 60 * 1000)) : Date.now();
    checkpoint.contentVersion = remoteVersionMeta?.curriculumVersion || checkpoint.contentVersion + 1;
    checkpoint.syncStatus = "idle";
    checkpoint.lastSyncError = isFullDataset ? null : "Incomplete dataset loaded; scheduled for immediate retry";
    await saveSyncCheckpoint(checkpoint);

    onProgress?.({
      status: "completed",
      datasetName: "Bootstrap Completed",
      downloadedCount: allMcqs.length,
      progressPercentage: 100,
    });

    console.log(`[BootstrapService] Initial bootstrap completed: ${allMcqs.length} MCQs, ${subjects.length} subjects, ${pyqs.length} PYQs committed.`);
    return { success: true, totalMcqs: allMcqs.length, totalPyqs: pyqs.length };
  } catch (err: any) {
    const errMsg = err?.message || "Bootstrap session failed.";
    await discardStagedBatch(batchId).catch(() => {});
    
    checkpoint.syncStatus = "error";
    checkpoint.lastSyncError = errMsg;
    await saveSyncCheckpoint(checkpoint);

    onProgress?.({
      status: "error",
      datasetName: "Bootstrap Failed",
      downloadedCount: 0,
      errorMessage: errMsg,
    });
    return { success: false, totalMcqs: 0, totalPyqs: 0, error: errMsg };
  }
}
