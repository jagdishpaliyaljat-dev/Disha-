import { PYQPaper, PYQPaperAttempt, Question } from "../types";
import { db, auth } from "../lib/firebase";
import {
  collection,
  doc,
  query,
  where,
} from "firebase/firestore";
import {
  guardedSetDoc,
  guardedGetDoc,
  guardedGetDocs,
  guardedDeleteDoc,
  guardedOnSnapshot,
  guardedWriteBatch,
} from "./quotaTracker";
import { isUserAdmin, loadUserProfile } from "./userProfileStorage";
import { serializeTableForFirestore, normalizeTableFromFirestore } from "./firebaseSyncService";
import { deduplicateQuestions } from "./questionsStorage";
import { safeSetLocalStorageItem } from "./safeStorage";
import { isTestOrMockPYQ } from "./cleanSlate";
import { getLocalMetadata } from "./indexedDbCache";
import { fetchPyqPapersAssetCacheFirst, fetchQuizAssetVersion } from "./quizAssetSwCache";

const PYQ_PAPERS_STORAGE_KEY = "remix_rajprep_pyq_papers_v2";
const PYQ_ATTEMPTS_STORAGE_KEY = "remix_rajprep_pyq_attempts_v2";
const DELETED_PYQ_PAPERS_KEY = "remix_rajprep_deleted_pyq_papers_v1";

let inMemoryPYQPapers: PYQPaper[] | null = null;

// Clean production slate: zero mock PYQ papers
export const INITIAL_PYQ_PAPERS: PYQPaper[] = [];

export function loadLocalPYQPapers(): PYQPaper[] {
  if (inMemoryPYQPapers && inMemoryPYQPapers.length > 0) {
    return inMemoryPYQPapers.filter(p => !isTestOrMockPYQ(p));
  }
  try {
    const raw = typeof localStorage !== "undefined" ? localStorage.getItem(PYQ_PAPERS_STORAGE_KEY) : null;
    if (!raw) {
      inMemoryPYQPapers = INITIAL_PYQ_PAPERS;
      safeSetLocalStorageItem(PYQ_PAPERS_STORAGE_KEY, JSON.stringify(INITIAL_PYQ_PAPERS));
      return INITIAL_PYQ_PAPERS;
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      const cleanPapers = parsed.filter(p => !isTestOrMockPYQ(p));
      inMemoryPYQPapers = cleanPapers;
      return cleanPapers;
    }
    inMemoryPYQPapers = INITIAL_PYQ_PAPERS;
    return INITIAL_PYQ_PAPERS;
  } catch (e) {
    console.warn("Notice loading local PYQ papers, using defaults:", e);
    return INITIAL_PYQ_PAPERS;
  }
}

/**
 * Save all PYQ papers to Local Storage safely
 */
export function saveLocalPYQPapers(papers: PYQPaper[]): void {
  inMemoryPYQPapers = papers;
  safeSetLocalStorageItem(
    PYQ_PAPERS_STORAGE_KEY,
    JSON.stringify(papers),
    () => {
      // Lightweight fallback without bloated questions array to conserve localStorage quota
      const lightweight = (papers || []).map((p) => ({
        ...p,
        questions: (p.questions || []).map((q) => ({
          id: q.id,
          text: q.text,
          options: q.options,
          correctIndex: q.correctIndex,
        })),
      }));
      return JSON.stringify(lightweight);
    }
  );
}

export function loadLocalPYQAttempts(): PYQPaperAttempt[] {
  try {
    const raw = typeof localStorage !== "undefined" ? localStorage.getItem(PYQ_ATTEMPTS_STORAGE_KEY) : null;
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.warn("Notice loading PYQ attempts:", e);
    return [];
  }
}

export function saveLocalPYQAttempts(attempts: PYQPaperAttempt[]): void {
  safeSetLocalStorageItem(PYQ_ATTEMPTS_STORAGE_KEY, JSON.stringify(attempts));
}

export async function recordPYQAttempt(attempt: PYQPaperAttempt): Promise<void> {
  try {
    const attempts = loadLocalPYQAttempts();
    const existingIdx = attempts.findIndex(a => a.attemptId === attempt.attemptId);
    
    if (existingIdx >= 0) {
      attempts[existingIdx] = attempt;
    } else {
      attempts.unshift(attempt);
    }
    saveLocalPYQAttempts(attempts);

    // Sync to Firestore only for authenticated non-guest, non-admin-preview users
    const { isStudentTrackingAllowed } = await import("./studentWriteBuffer");
    if (isStudentTrackingAllowed()) {
      const docRef = doc(db, "pyq_attempts", attempt.attemptId);
      const { guardedSetDoc } = await import("./quotaTracker");
      await guardedSetDoc(
        docRef,
        attempt,
        { merge: true },
        "Student",
        "Record PYQ Attempt",
        undefined,
        30000,
        `pyq_att_${attempt.attemptId}`
      );
    }
  } catch (e) {
    console.warn("Notice recording PYQ attempt:", e);
  }
}

export function getDeletedPYQIds(): string[] {
  try {
    const raw = typeof localStorage !== "undefined" ? localStorage.getItem(DELETED_PYQ_PAPERS_KEY) : null;
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function addDeletedPYQId(id: string): void {
  try {
    const list = getDeletedPYQIds();
    if (!list.includes(id)) {
      list.push(id);
      safeSetLocalStorageItem(DELETED_PYQ_PAPERS_KEY, JSON.stringify(list));
    }
  } catch (e) {
    console.warn("Failed to record deleted PYQ ID", e);
  }
}

export function clearDeletedPYQIds(): void {
  try {
    localStorage.removeItem(DELETED_PYQ_PAPERS_KEY);
  } catch {}
}

/**
 * Save or Update a single PYQ paper (Admin tool)
 */
export async function savePYQPaper(paper: PYQPaper): Promise<PYQPaper[]> {
  const current = loadLocalPYQPapers();
  const idx = current.findIndex((p) => p.id === paper.id);
  
  const dedupedQuestions = deduplicateQuestions(paper.questions || []);
  const updatedPaper: PYQPaper = {
    ...paper,
    questions: dedupedQuestions,
    questionCount: dedupedQuestions.length,
    updatedAt: new Date().toISOString(),
    createdAt: idx >= 0 && current[idx].createdAt ? current[idx].createdAt : (paper.createdAt || new Date().toISOString()),
  };

  let updatedList: PYQPaper[];
  if (idx >= 0) {
    updatedList = [...current];
    updatedList[idx] = updatedPaper;
  } else {
    updatedList = [updatedPaper, ...current];
  }

  saveLocalPYQPapers(updatedList);

  try {
    const firestorePaper = { ...updatedPaper };
    const paperQuestions = Array.isArray(firestorePaper.questions) ? firestorePaper.questions : [];
    
    // Serialize any complex table data inside questions
    firestorePaper.questions = paperQuestions.map((q: any) => {
      const qObj = { ...q };
      if (qObj.table) qObj.table = serializeTableForFirestore(qObj.table);
      if (qObj.tableData) qObj.tableData = serializeTableForFirestore(qObj.tableData);
      return qObj;
    });

    const docRef = doc(db, "pyq_papers", paper.id);
    const cat = isUserAdmin(loadUserProfile()) ? "Admin" : "Student";
    const { guardedSetDoc } = await import("./quotaTracker");
    await guardedSetDoc(docRef, firestorePaper, { merge: true }, cat, "Save PYQ Paper");

    try {
      const { triggerFirebaseSavedToast } = await import("./adminToast");
      triggerFirebaseSavedToast({
        title: "PYQ Paper Saved to Firebase!",
        message: `पेपर "${paper.title || paper.hindiTitle || "PYQ"}" डेटाबेस में सुरक्षित सेव हो गया • यूज़र्स को लाइव दिखने लगा!`,
        itemName: paper.title,
      });
    } catch (_) {}
  } catch (err) {
    console.warn("Firestore sync for PYQ paper skipped/offline:", err);
    throw err;
  }

  return updatedList;
}

/**
 * Delete a PYQ paper by ID
 */
export async function deletePYQPaper(paperId: string): Promise<PYQPaper[]> {
  const current = loadLocalPYQPapers();
  const updatedList = current.filter((p) => p.id !== paperId);
  saveLocalPYQPapers(updatedList);
  addDeletedPYQId(paperId);

  try {
    console.log(`[Firestore Trace] deletePYQPaper: Deleting paper ${paperId}`, {
      operationId: `delete-pyq-${Date.now()}`,
      function: "deletePYQPaper",
      collection: "pyq_papers",
      path: `pyq_papers/${paperId}`,
      userId: auth.currentUser?.uid,
      userEmail: auth.currentUser?.email,
      timestamp: new Date().toISOString()
    });
    const docRef = doc(db, "pyq_papers", paperId);
    const cat = isUserAdmin(loadUserProfile()) ? "Admin" : "Student";
    await guardedDeleteDoc(docRef, cat, "Delete PYQ Paper");
  } catch (err: any) {
    console.error(`[Firestore Error] deletePYQPaper failed for ${paperId}:`, err);
    throw err;
  }

  return updatedList;
}

/**
 * Fetch all PYQ papers with Cloud sync and deletion filtering
 */
export async function fetchPYQPapers(): Promise<PYQPaper[]> {
  const localList = loadLocalPYQPapers();
  const deletedIds = new Set(getDeletedPYQIds());

  let cloudList: PYQPaper[] = [];
  try {
    const cat = isUserAdmin(loadUserProfile()) ? "Admin" : "Student";
    const querySnap = await guardedGetDocs(collection(db, "pyq_papers"), cat, "Fetch PYQ Papers");
    querySnap.forEach((docSnap) => {
      const data = docSnap.data() as PYQPaper;
      if (data && data.id && !deletedIds.has(data.id)) {
        if (Array.isArray(data.questions)) {
          data.questions = data.questions.map((q: any) => {
            const qObj = { ...q };
            if (qObj.table) qObj.table = normalizeTableFromFirestore(qObj.table);
            if (qObj.tableData) qObj.tableData = normalizeTableFromFirestore(qObj.tableData);
            return qObj;
          });
        }
        cloudList.push(data);
      }
    });
  } catch (err) {
    console.warn("Firestore PYQ fetch failed, using local:", err);
  }

  const map = new Map<string, PYQPaper>();
  for (const item of cloudList) {
    if (!deletedIds.has(item.id)) {
      map.set(item.id, item);
    }
  }
  for (const item of localList) {
    if (!deletedIds.has(item.id)) {
      map.set(item.id, item);
    }
  }

  const merged = Array.from(map.values()).filter((p) => !deletedIds.has(p.id));
  saveLocalPYQPapers(merged);
  return merged;
}

function normalizePyqPaperTables(paper: PYQPaper): PYQPaper {
  if (!paper || !Array.isArray(paper.questions)) return paper;
  return {
    ...paper,
    questions: paper.questions.map((q: any) => {
      if (!q || typeof q !== "object") return q;
      const qObj = { ...q };
      if (qObj.table) qObj.table = normalizeTableFromFirestore(qObj.table);
      if (qObj.tableData) qObj.tableData = normalizeTableFromFirestore(qObj.tableData);
      return qObj;
    }),
  };
}

/**
 * Listener / Cache-First loader for Published PYQ Papers (User side).
 * Admins retain real-time Firestore snapshots; Students use SW Cache-First versioned static assets.
 */
export function subscribeToPublishedPYQPapers(
  callback: (papers: PYQPaper[]) => void
): () => void {
  // 1. Immediately emit local cached papers
  const deletedIds = new Set(getDeletedPYQIds());
  const initial = loadLocalPYQPapers().filter(
    (p) => !deletedIds.has(p.id) && p.isPublished !== false
  );
  callback(initial);

  const isAdmin = isUserAdmin(loadUserProfile());

  // 2. Real-time Firestore snapshot listener for Admins ONLY
  if (isAdmin) {
    try {
      const q = collection(db, "pyq_papers");
      return guardedOnSnapshot(
        q,
        "Admin",
        "PYQ Papers Listener",
        (snapshot) => {
          const cloud = snapshot.docs
            .map((docSnap: any) => normalizePyqPaperTables({ ...docSnap.data(), id: docSnap.id } as PYQPaper))
            .filter((p: PYQPaper) => !deletedIds.has(p.id) && p.isPublished !== false)
            .sort((a: PYQPaper, b: PYQPaper) => (parseInt(b.paperYear || "0", 10) || 0) - (parseInt(a.paperYear || "0", 10) || 0));

          saveLocalPYQPapers(cloud);
          callback(cloud);
        },
        (err) => {
          console.warn("[Firestore] PYQ papers listener notice:", err.message);
        }
      );
    } catch (err) {
      console.warn("Could not set up PYQ papers listener:", err);
      return () => {};
    }
  }

  // 3. Service Worker Cache-First asset fetch for regular Students (0 Firestore reads on repeat visits)
  let cancelled = false;
  (async () => {
    try {
      const localMeta = await getLocalMetadata<any>("curriculum_version_meta").catch(() => null);
      let version = Number(localMeta?.curriculumVersion || 0);
      if (!version) {
        const verManifest = await fetchQuizAssetVersion().catch(() => null);
        version = Number(verManifest?.curriculumVersion || 0);
      }

      if (version > 0) {
        const swRes = await fetchPyqPapersAssetCacheFirst(version).catch(() => null);
        if (!cancelled && swRes) {
          const papers = (swRes.papers || [])
            .map((p) => normalizePyqPaperTables(p))
            .filter((p: PYQPaper) => !deletedIds.has(p.id) && p.isPublished !== false)
            .sort((a: PYQPaper, b: PYQPaper) => (parseInt(b.paperYear || "0", 10) || 0) - (parseInt(a.paperYear || "0", 10) || 0));

          saveLocalPYQPapers(papers);
          callback(papers);
          return;
        }
      }
    } catch {}

    if (cancelled) return;

    // Fallback one-shot Firestore fetch if static asset endpoint was unavailable
    try {
      const snap = await guardedGetDocs(collection(db, "pyq_papers"), "Student", "Fetch PYQ Papers One-Shot");
      if (cancelled) return;
      const cloud = snap.docs
        .map((docSnap: any) => normalizePyqPaperTables({ ...docSnap.data(), id: docSnap.id } as PYQPaper))
        .filter((p: PYQPaper) => !deletedIds.has(p.id) && p.isPublished !== false)
        .sort((a: PYQPaper, b: PYQPaper) => (parseInt(b.paperYear || "0", 10) || 0) - (parseInt(a.paperYear || "0", 10) || 0));

      saveLocalPYQPapers(cloud);
      callback(cloud);
    } catch (err) {
      console.warn("Could not fetch published PYQ papers:", err);
    }
  })();

  return () => {
    cancelled = true;
  };
}
