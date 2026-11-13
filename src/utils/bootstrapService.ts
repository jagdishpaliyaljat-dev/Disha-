import { collection, query, limit, getDocs, startAfter, orderBy } from "firebase/firestore";
import { db, isFirebaseConfigured } from "../lib/firebase";
import { guardedGetDocs } from "../utils/quotaTracker";
import { saveQuestionsToCache } from "../utils/questionBankCache";
import { loadSyncCheckpoint, saveSyncCheckpoint } from "../utils/syncCheckpointRegistry";
import { Subject, Chapter, Topic, Question } from "../types";

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
 * Executes a controlled, paginated bootstrap session to download all required student-facing content
 * (Subjects, Chapters, Topics, MCQs) from Firestore and store them in IndexedDB without mutations.
 */
export async function executeInitialBootstrap(
  onProgress?: BootstrapProgressCallback
): Promise<{ success: boolean; totalMcqs: number; error?: string }> {
  if (!isFirebaseConfigured()) {
    return { success: false, totalMcqs: 0, error: "Firebase is not configured." };
  }

  const checkpoint = await loadSyncCheckpoint();
  if (checkpoint.bootstrapCompleted) {
    return { success: true, totalMcqs: 0 };
  }

  try {
    onProgress?.({
      status: "downloading",
      datasetName: "Curriculum & Subjects",
      downloadedCount: 0,
      progressPercentage: 5,
    });

    // 1. Download Subjects, Chapters, Topics (Read-only)
    const [subsSnap, chsSnap, topsSnap] = await Promise.all([
      guardedGetDocs(collection(db, "subjects"), "Student", "Bootstrap Subjects", undefined, 30000).catch(() => null),
      guardedGetDocs(collection(db, "chapters"), "Student", "Bootstrap Chapters", undefined, 30000).catch(() => null),
      guardedGetDocs(collection(db, "topics"), "Student", "Bootstrap Topics", undefined, 30000).catch(() => null),
    ]);

    const subjects: Subject[] = subsSnap ? subsSnap.docs.map((d: any) => ({ ...d.data(), id: d.id } as Subject)) : [];
    const chapters: Chapter[] = chsSnap ? chsSnap.docs.map((d: any) => ({ ...d.data(), id: d.id } as Chapter)) : [];
    const topics: Topic[] = topsSnap ? topsSnap.docs.map((d: any) => ({ ...d.data(), id: d.id } as Topic)) : [];

    onProgress?.({
      status: "downloading",
      datasetName: "Publishing MCQs (Paginated)",
      downloadedCount: 0,
      progressPercentage: 25,
    });

    // 2. Paginated Resumable Download for Canonical 'mcqs' collection
    const PAGE_SIZE = 500;
    const allMcqs: Question[] = [];
    let lastDoc: any = null;
    let hasMore = true;
    let pageCount = 0;

    const mcqsRef = collection(db, "mcqs");

    while (hasMore && pageCount < 20) { // Safety ceiling of 20 pages (10,000 MCQs max)
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
      pageDocs.forEach((d) => {
        const data = d.data() as any;
        if (data && (data.text || data.question) && Array.isArray(data.options)) {
          allMcqs.push({
            ...data,
            id: d.id,
            topicId: data.topicId || data.topic || "",
            chapterId: data.chapterId || "",
            subjectId: data.subjectId || "",
          } as Question);
        }
      });

      lastDoc = pageDocs[pageDocs.length - 1];
      if (pageDocs.length < PAGE_SIZE) {
        hasMore = false;
      }

      onProgress?.({
        status: "downloading",
        datasetName: "Publishing MCQs (Paginated)",
        downloadedCount: allMcqs.length,
        progressPercentage: Math.min(85, 25 + pageCount * 15),
      });
    }

    onProgress?.({
      status: "validating",
      datasetName: "Validating Downloaded Content",
      downloadedCount: allMcqs.length,
      progressPercentage: 90,
    });

    // 3. Validation
    if (subjects.length === 0 && chapters.length === 0 && allMcqs.length === 0) {
      return { success: false, totalMcqs: 0, error: "Bootstrap dataset is empty." };
    }

    onProgress?.({
      status: "ready_to_activate",
      datasetName: "Activating Local IndexedDB",
      downloadedCount: allMcqs.length,
      progressPercentage: 95,
    });

    // 4. Save to IndexedDB (Activation)
    await saveQuestionsToCache(allMcqs, { source: "initial" });
    const { saveCachedCurriculum } = await import("./indexedDbCache");
    await saveCachedCurriculum(subjects, chapters, topics, allMcqs, []);

    // 5. Update Checkpoint
    checkpoint.bootstrapCompleted = true;
    checkpoint.lastSuccessfulSyncAt = Date.now();
    checkpoint.nextSyncEligibleAt = Date.now() + (24 * 60 * 60 * 1000);
    checkpoint.contentVersion = checkpoint.contentVersion + 1;
    await saveSyncCheckpoint(checkpoint);

    onProgress?.({
      status: "completed",
      datasetName: "Bootstrap Completed",
      downloadedCount: allMcqs.length,
      progressPercentage: 100,
    });

    return { success: true, totalMcqs: allMcqs.length };
  } catch (err: any) {
    const errMsg = err?.message || "Bootstrap session failed.";
    onProgress?.({
      status: "error",
      datasetName: "Bootstrap Failed",
      downloadedCount: 0,
      errorMessage: errMsg,
    });
    return { success: false, totalMcqs: 0, error: errMsg };
  }
}
