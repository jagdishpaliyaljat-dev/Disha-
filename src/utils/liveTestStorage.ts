import { LiveTest, LiveTestSubmission, Question } from "../types";
import { db, auth } from "../lib/firebase";
import {
  collection,
  doc,
  query,
  where,
  orderBy,
} from "firebase/firestore";
import {
  guardedGetDocs,
  guardedSetDoc,
  guardedDeleteDoc,
  guardedOnSnapshot,
  guardedWriteBatch,
} from "./quotaTracker";
import { serializeTableForFirestore, normalizeTableFromFirestore } from "./firebaseSyncService";
import { deduplicateQuestions } from "./questionsStorage";
import { ADMIN_UIDS, ADMIN_EMAILS } from "./userProfileStorage";
import { isUserAdmin, loadUserProfile } from "./userProfileStorage";
import { safeSetLocalStorageItem } from "./safeStorage";
import { isTestOrMockLiveTest } from "./cleanSlate";
import { getLocalMetadata } from "./indexedDbCache";
import { fetchLiveTestsAssetCacheFirst, fetchQuizAssetVersion } from "./quizAssetSwCache";

const LIVE_TESTS_STORAGE_KEY = "remix_rajprep_live_tests_v1";
const LIVE_SUBMISSIONS_STORAGE_KEY = "remix_rajprep_live_submissions_v1";
const DELETED_LIVE_TESTS_KEY = "remix_rajprep_deleted_live_tests_v1";

let inMemoryLiveTests: LiveTest[] | null = null;

// Clean production slate: zero mock live tests
export const INITIAL_LIVE_TESTS: LiveTest[] = [];

export function stripAnswerFieldsFromQuestion<T extends Record<string, any>>(q: T): T {
  if (!q || typeof q !== "object") return q;
  const {
    correctIndex: _ci,
    correctOption: _co,
    answer: _ans,
    explanation: _exp,
    solution: _sol,
    importantFact: _imp,
    correctOptionText: _cot,
    ...rest
  } = q;
  return rest as T;
}

export function sanitizeLiveTestForPublic<T extends Record<string, any>>(test: T): T {
  if (!test || typeof test !== "object") return test;
  const {
    answerKey: _ak,
    answerKeys: _aks,
    answers: _as,
    correctAnswers: _cas,
    ...rest
  } = test;
  const sanitizedQuestions = Array.isArray(rest.questions)
    ? rest.questions.map((q: any) => (q && typeof q === "object" ? stripAnswerFieldsFromQuestion(q) : q))
    : rest.questions;
  return {
    ...rest,
    questions: sanitizedQuestions,
  } as unknown as T;
}

export function buildAnswerKeyDocFromLiveTest(test: LiveTest) {
  const answers: Record<string, { correctIndex: number; explanation?: string; importantFact?: string }> = {};
  (test.questions || []).forEach((q: any, idx: number) => {
    if (q && typeof q === "object") {
      const qId = String(q.id || `live_${test.id}_q_${idx}`);
      const ci = typeof q.correctIndex === "number" && Number.isInteger(q.correctIndex) ? q.correctIndex : -1;
      if (ci >= 0) {
        answers[qId] = {
          correctIndex: ci,
          ...(q.explanation ? { explanation: String(q.explanation) } : {}),
          ...(q.importantFact ? { importantFact: String(q.importantFact) } : {}),
        };
      }
    }
  });
  return {
    testId: test.id,
    title: test.title,
    marksPerQuestion: Number(test.marksPerQuestion ?? 2),
    negativeMarking: Number(test.negativeMarking ?? 0.66),
    totalMarks: Number(test.totalMarks ?? (test.questions?.length || 0) * Number(test.marksPerQuestion ?? 2)),
    allowReattempt: (test as any).allowReattempt !== false,
    updatedAt: new Date().toISOString(),
    answers,
  };
}

export async function hydrateLiveTestForAdmin(test: LiveTest): Promise<LiveTest> {
  if (!test || !test.id || !isUserAdmin(loadUserProfile())) {
    return sanitizeLiveTestForPublic(test);
  }
  try {
    const { guardedGetDoc } = await import("./quotaTracker");
    const snap = await guardedGetDoc(doc(db, "liveTestAnswerKeys", test.id), "Admin", "Hydrate Live Test Answer Key");
    if (snap && snap.exists()) {
      const data = snap.data() as any;
      const answers = data?.answers || {};
      const hydratedQuestions = (test.questions || []).map((q: any) => {
        const entry = answers[q.id];
        if (!entry) return q;
        return {
          ...q,
          correctIndex: entry.correctIndex,
          ...(entry.explanation ? { explanation: entry.explanation } : {}),
          ...(entry.importantFact ? { importantFact: entry.importantFact } : {}),
        };
      });
      return {
        ...test,
        questions: hydratedQuestions,
      };
    }
  } catch (e) {
    console.warn("[LiveTest] Could not hydrate answer key for admin edit:", e);
  }
  return test;
}

export function loadLocalLiveTests(): LiveTest[] {
  if (inMemoryLiveTests && inMemoryLiveTests.length > 0) {
    return inMemoryLiveTests.filter(t => !isTestOrMockLiveTest(t));
  }
  try {
    const raw = typeof localStorage !== "undefined" ? localStorage.getItem(LIVE_TESTS_STORAGE_KEY) : null;
    if (!raw) {
      inMemoryLiveTests = INITIAL_LIVE_TESTS;
      safeSetLocalStorageItem(LIVE_TESTS_STORAGE_KEY, JSON.stringify(INITIAL_LIVE_TESTS));
      return INITIAL_LIVE_TESTS;
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      const cleanTests = parsed.filter(t => !isTestOrMockLiveTest(t));
      inMemoryLiveTests = cleanTests;
      return cleanTests;
    }
    inMemoryLiveTests = INITIAL_LIVE_TESTS;
    return INITIAL_LIVE_TESTS;
  } catch (e) {
    console.warn("Notice loading local live tests, using defaults:", e);
    return INITIAL_LIVE_TESTS;
  }
}

export function saveLocalLiveTests(tests: LiveTest[]): void {
  const admin = isUserAdmin(loadUserProfile());
  const safeTests = admin ? tests : (tests || []).map((t) => sanitizeLiveTestForPublic(t));
  inMemoryLiveTests = safeTests;
  safeSetLocalStorageItem(
    LIVE_TESTS_STORAGE_KEY,
    JSON.stringify(safeTests),
    () => {
      // Lightweight fallback without bloated questions array to save quota
      const lightweight = (safeTests || []).map((t) => ({
        ...t,
        questions: (t.questions || []).map((q) => ({
          id: q.id,
          text: q.text,
          options: q.options,
          ...(admin ? { correctIndex: q.correctIndex } : {}),
        })),
      }));
      return JSON.stringify(lightweight);
    }
  );
}

export function getDeletedLiveTestIds(): string[] {
  try {
    const raw = typeof localStorage !== "undefined" ? localStorage.getItem(DELETED_LIVE_TESTS_KEY) : null;
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function addDeletedLiveTestId(id: string): void {
  try {
    const list = getDeletedLiveTestIds();
    if (!list.includes(id)) {
      list.push(id);
      safeSetLocalStorageItem(DELETED_LIVE_TESTS_KEY, JSON.stringify(list));
    }
  } catch (e) {
    console.warn("Failed to record deleted live test ID", e);
  }
}

export function clearDeletedLiveTestIds(): void {
  try {
    localStorage.removeItem(DELETED_LIVE_TESTS_KEY);
  } catch {}
}

/**
 * Fetch All Live Tests (Local + Cloud with deletion filtering)
 */
export async function fetchLiveTests(): Promise<LiveTest[]> {
  const admin = isUserAdmin(loadUserProfile());
  const local = loadLocalLiveTests().map((t) => (admin ? t : sanitizeLiveTestForPublic(t)));
  const deletedIds = new Set(getDeletedLiveTestIds());

  let cloud: LiveTest[] = [];
  try {
    const snap = await guardedGetDocs(collection(db, "liveTests"), admin ? "Admin" : "Student", "Fetch Live Tests");
    snap.forEach((docSnap) => {
      const data = docSnap.data() as LiveTest;
      if (data && data.id && !deletedIds.has(data.id)) {
        if (Array.isArray(data.questions)) {
          data.questions = data.questions.map((q: any) => {
            const qObj = { ...q };
            if (qObj.table) qObj.table = normalizeTableFromFirestore(qObj.table);
            if (qObj.tableData) qObj.tableData = normalizeTableFromFirestore(qObj.tableData);
            return admin ? qObj : stripAnswerFieldsFromQuestion(qObj);
          });
        }
        cloud.push(admin ? data : sanitizeLiveTestForPublic(data));
      }
    });
  } catch (e) {
    console.warn("Firestore liveTests query skipped or failed:", e);
  }

  const map = new Map<string, LiveTest>();
  for (const item of cloud) {
    if (!deletedIds.has(item.id)) {
      map.set(item.id, item);
    }
  }
  for (const item of local) {
    if (!deletedIds.has(item.id)) {
      const cloudExisting = map.get(item.id);
      if (cloudExisting && admin && Array.isArray(item.questions)) {
        // Keep admin local answer keys if cloud public doc was sanitized
        const localQMap = new Map(item.questions.map((q) => [q.id, q]));
        const hydrated = (cloudExisting.questions || []).map((q) => {
          const lq = localQMap.get(q.id);
          return lq && typeof lq.correctIndex === "number" ? { ...q, correctIndex: lq.correctIndex, explanation: q.explanation ?? lq.explanation } : q;
        });
        map.set(item.id, { ...cloudExisting, questions: hydrated });
      } else if (!cloudExisting) {
        map.set(item.id, item);
      }
    }
  }

  const merged = Array.from(map.values()).filter((t) => !deletedIds.has(t.id));
  saveLocalLiveTests(merged);
  return merged;
}

/**
 * Save / Update a Live Test
 * Writes sanitized public questions to `liveTests/{id}` (no correctIndex/answer/explanation)
 * and stores authoritative answer keys in `liveTestAnswerKeys/{id}` (Admin-only).
 */
export async function saveLiveTest(test: LiveTest): Promise<LiveTest[]> {
  const current = loadLocalLiveTests();
  const idx = current.findIndex((t) => t.id === test.id);

  const questions = deduplicateQuestions(test.questions || []);
  const updatedTest: LiveTest = {
    ...test,
    questions,
    updatedAt: new Date().toISOString(),
    questionCount: questions.length,
    createdAt: idx >= 0 && current[idx].createdAt ? current[idx].createdAt : (test.createdAt || new Date().toISOString()),
  };

  let newList: LiveTest[];
  if (idx >= 0) {
    newList = [...current];
    newList[idx] = updatedTest;
  } else {
    newList = [updatedTest, ...current];
  }

  saveLocalLiveTests(newList);

  try {
    const serializedQuestions = (updatedTest.questions || []).map((q: any) => {
      const qObj = { ...q };
      if (qObj.table) qObj.table = serializeTableForFirestore(qObj.table);
      if (qObj.tableData) qObj.tableData = serializeTableForFirestore(qObj.tableData);
      return qObj;
    });

    const publicDoc = sanitizeLiveTestForPublic({
      ...updatedTest,
      questions: serializedQuestions,
    });

    const docRef = doc(db, "liveTests", updatedTest.id);
    const cat = isUserAdmin(loadUserProfile()) ? "Admin" : "Student";
    const { guardedSetDoc } = await import("./quotaTracker");
    // Overwrite completely (no merge) so any legacy leaked answer fields are purged
    await guardedSetDoc(docRef, publicDoc, undefined, cat, "Save Live Test");

    if (cat === "Admin") {
      const answerKeyDoc = buildAnswerKeyDocFromLiveTest(updatedTest);
      await guardedSetDoc(
        doc(db, "liveTestAnswerKeys", updatedTest.id),
        answerKeyDoc,
        undefined,
        "Admin",
        "Save Live Test Answer Key"
      );
    }

    try {
      const { triggerFirebaseSavedToast } = await import("./adminToast");
      triggerFirebaseSavedToast({
        title: "Live Test Saved to Firebase!",
        message: `लाइव टेस्ट "${updatedTest.title}" डेटाबेस में सुरक्षित सेव हो गया • यूज़र्स को तुरंत लाइव दिखने लगा!`,
        itemName: updatedTest.title,
      });
    } catch (_) {}
  } catch (err) {
    console.warn("Firestore save for live test skipped/offline:", err);
    throw err;
  }

  return newList;
}

/**
 * Delete a Live Test (and its private liveTestAnswerKeys document)
 */
export async function deleteLiveTest(testId: string): Promise<LiveTest[]> {
  const current = loadLocalLiveTests();
  const newList = current.filter((t) => t.id !== testId);
  saveLocalLiveTests(newList);
  addDeletedLiveTestId(testId);

  try {
    console.log(`[Firestore Trace] deleteLiveTest: Deleting test ${testId}`, {
      operationId: `delete-test-${Date.now()}`,
      function: "deleteLiveTest",
      collection: "liveTests",
      path: `liveTests/${testId}`,
      userId: auth.currentUser?.uid,
      userEmail: auth.currentUser?.email,
      timestamp: new Date().toISOString()
    });
    await guardedDeleteDoc(doc(db, "liveTests", testId), "Admin", "Delete Live Test");
    await guardedDeleteDoc(doc(db, "liveTestAnswerKeys", testId), "Admin", "Delete Live Test Answer Key").catch(() => {});
  } catch (err: any) {
    console.error(`[Firestore Error] deleteLiveTest failed for ${testId}:`, err);
    throw err;
  }

  return newList;
}

export function loadLocalLiveSubmissions(): LiveTestSubmission[] {
  try {
    const raw = localStorage.getItem(LIVE_SUBMISSIONS_STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (e) {
    console.error("Error loading local live submissions:", e);
    return [];
  }
}

export function saveLocalLiveSubmissions(subs: LiveTestSubmission[]): void {
  safeSetLocalStorageItem(LIVE_SUBMISSIONS_STORAGE_KEY, JSON.stringify(subs));
}

export async function fetchLiveTestSubmissions(testId?: string): Promise<LiveTestSubmission[]> {
  const local = loadLocalLiveSubmissions().filter(s => !testId || s.testId === testId);
  try {
    const user = auth.currentUser;
    if (!user) return local;

    const isAdminUser = ADMIN_UIDS.includes(user.uid) || (user.email && ADMIN_EMAILS.includes(user.email.trim().toLowerCase()));
    
    let q;
    if (isAdminUser) {
      q = collection(db, "liveTestSubmissions");
    } else {
      q = query(collection(db, "liveTestSubmissions"), where("userId", "==", user.uid));
    }

    const snap = await guardedGetDocs(q, isAdminUser ? "Admin" : "Student", "Fetch Live Test Submissions");
    const cloud: LiveTestSubmission[] = [];
    snap.forEach((docSnap) => {
      const data = docSnap.data() as LiveTestSubmission;
      if (data && (!testId || data.testId === testId)) {
        cloud.push(data);
      }
    });
    const map = new Map<string, LiveTestSubmission>();
    for (const item of [...cloud, ...local]) {
      if (item && item.submissionId) {
        map.set(item.submissionId, item);
      }
    }
    return Array.from(map.values());
  } catch (e) {
    return local;
  }
}

/**
 * Real-time listener for Live Tests (User side)
 */
export function subscribeToLiveTests(
  callback: (tests: LiveTest[]) => void
): () => void {
  const deletedIds = new Set(getDeletedLiveTestIds());
  const initial = loadLocalLiveTests().filter((t) => !deletedIds.has(t.id));
  callback(initial);

  const user = auth.currentUser;
  const isAdminUser = Boolean(user && (ADMIN_UIDS.includes(user.uid) || (user.email && ADMIN_EMAILS.includes(user.email.trim().toLowerCase()))));

  if (isAdminUser) {
    try {
      const q = collection(db, "liveTests");
      return guardedOnSnapshot(
        q,
        "Admin",
        "Live Tests Listener",
        (snapshot) => {
          const cloud = snapshot.docs
            .map((docSnap: any) => ({ ...docSnap.data(), id: docSnap.id } as LiveTest))
            .filter((t: LiveTest) => !deletedIds.has(t.id))
            .sort((a: LiveTest, b: LiveTest) => new Date(b.startTime || 0).getTime() - new Date(a.startTime || 0).getTime());

          saveLocalLiveTests(cloud);
          callback(cloud);
        },
        (err, unsubscribe) => {
          console.warn("[Firestore] Live tests listener notice:", err.message);
          if (err.code === "permission-denied") {
            unsubscribe();
          }
        }
      );
    } catch (err) {
      console.warn("Could not set up live tests listener:", err);
      return () => {};
    }
  } else {
    // Cache-First static quiz asset fetch for regular students (strictly sanitized, 0 Firestore reads on repeat visits)
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
          const swRes = await fetchLiveTestsAssetCacheFirst(version).catch(() => null);
          if (!cancelled && swRes) {
            const cloud = (swRes.tests || [])
              .map((t) => sanitizeLiveTestForPublic(t))
              .filter((t: LiveTest) => !deletedIds.has(t.id))
              .sort((a: LiveTest, b: LiveTest) => new Date(b.startTime || 0).getTime() - new Date(a.startTime || 0).getTime());

            saveLocalLiveTests(cloud);
            callback(cloud);
            return;
          }
        }
      } catch {}

      if (cancelled) return;

      // Fallback one-shot fetch for regular students (sanitized)
      guardedGetDocs(collection(db, "liveTests"), "Student", "Fetch Live Tests One-Shot")
        .then((snapshot) => {
          if (cancelled) return;
          const cloud = snapshot.docs
            .map((docSnap: any) => sanitizeLiveTestForPublic({ ...docSnap.data(), id: docSnap.id } as LiveTest))
            .filter((t: LiveTest) => !deletedIds.has(t.id))
            .sort((a: LiveTest, b: LiveTest) => new Date(b.startTime || 0).getTime() - new Date(a.startTime || 0).getTime());

          saveLocalLiveTests(cloud);
          callback(cloud);
        })
        .catch((err) => {
          console.warn("Live tests one-shot fetch skipped:", err);
        });
    })();

    return () => {
      cancelled = true;
    };
  }
}

/**
 * Submit / Save Live Test Submission to Firestore and LocalStorage
 */
export async function submitLiveTestSubmission(submission: LiveTestSubmission): Promise<void> {
  const local = loadLocalLiveSubmissions();
  const existingIdx = local.findIndex(s => s.submissionId === submission.submissionId || (s.testId === submission.testId && s.userId === submission.userId));
  if (existingIdx >= 0) {
    local[existingIdx] = submission;
  } else {
    local.unshift(submission);
  }
  saveLocalLiveSubmissions(local);

  try {
    const { isStudentTrackingAllowed } = await import("./studentWriteBuffer");
    if (!isStudentTrackingAllowed()) {
      return;
    }
    const docRef = doc(db, "liveTestSubmissions", submission.submissionId);
    const { guardedSetDoc } = await import("./quotaTracker");
    await guardedSetDoc(
      docRef,
      submission,
      { merge: true },
      "Student",
      "Submit Live Test Score",
      undefined,
      30000,
      `live_sub_${submission.submissionId}`
    );
  } catch (err) {
    console.warn("Firestore liveTestSubmission sync skipped/offline:", err);
  }
}

