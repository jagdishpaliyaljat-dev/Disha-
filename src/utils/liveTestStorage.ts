import { LiveTest, LiveTestSubmission, Question } from "../types";
import { serializeTable, normalizeTable } from "./tableUtils";
import { deduplicateQuestions } from "./questionsStorage";
import { isUserAdmin, loadUserProfile } from "./userProfileStorage";
import { safeSetLocalStorageItem } from "./safeStorage";

const LIVE_TESTS_STORAGE_KEY = "remix_rajprep_live_tests_v1";
const LIVE_SUBMISSIONS_STORAGE_KEY = "remix_rajprep_live_submissions_v1";
const DELETED_LIVE_TESTS_KEY = "remix_rajprep_deleted_live_tests_v1";

let inMemoryLiveTests: LiveTest[] | null = null;

export const INITIAL_LIVE_TESTS: LiveTest[] = [];

export function stripAnswerFieldsFromQuestion<T extends Record<string, any>>(q: T): T {
  if (!q || typeof q !== "object") return q;
  const {
    correctIndex: _ci,
    correctOption: _co,
    answer: _ans,
    explanation: _exp,
    importantFact: _imp,
    ...safeQ
  } = q;
  return safeQ as T;
}

export function sanitizeLiveTestForPublic(test: LiveTest): LiveTest {
  if (!test) return test;
  return {
    ...test,
    questions: Array.isArray(test.questions)
      ? test.questions.map((q) => stripAnswerFieldsFromQuestion(q))
      : [],
  };
}

export function getDeletedLiveTestIds(): string[] {
  try {
    const raw = localStorage.getItem(DELETED_LIVE_TESTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function addDeletedLiveTestId(id: string): void {
  try {
    const ids = getDeletedLiveTestIds();
    if (!ids.includes(id)) {
      ids.push(id);
      localStorage.setItem(DELETED_LIVE_TESTS_KEY, JSON.stringify(ids));
    }
  } catch {}
}

export function loadLocalLiveTests(): LiveTest[] {
  try {
    if (typeof window === "undefined" || !window.localStorage) {
      return inMemoryLiveTests || INITIAL_LIVE_TESTS;
    }
    const raw = localStorage.getItem(LIVE_TESTS_STORAGE_KEY);
    if (!raw) {
      inMemoryLiveTests = INITIAL_LIVE_TESTS;
      return INITIAL_LIVE_TESTS;
    }
    const parsed = JSON.parse(raw);
    const result = Array.isArray(parsed) ? parsed : INITIAL_LIVE_TESTS;
    inMemoryLiveTests = result;
    return result;
  } catch (e) {
    console.error("Error loading local live tests:", e);
    return INITIAL_LIVE_TESTS;
  }
}

export function saveLocalLiveTests(tests: LiveTest[]): void {
  inMemoryLiveTests = tests;
  safeSetLocalStorageItem(LIVE_TESTS_STORAGE_KEY, JSON.stringify(tests));
}

export async function hydrateLiveTestForAdmin(test: LiveTest): Promise<LiveTest> {
  if (!test || !test.id) return test;
  const admin = isUserAdmin(loadUserProfile());
  return admin ? test : sanitizeLiveTestForPublic(test);
}

export async function fetchLiveTests(): Promise<LiveTest[]> {
  const admin = isUserAdmin(loadUserProfile());
  const deletedIds = new Set(getDeletedLiveTestIds());
  const local = loadLocalLiveTests()
    .filter((t) => !deletedIds.has(t.id))
    .map((t) => (admin ? t : sanitizeLiveTestForPublic(t)));
  return local;
}

export async function saveLiveTest(test: Partial<LiveTest> & { id: string; title: string }): Promise<LiveTest[]> {
  const current = loadLocalLiveTests();
  const idx = current.findIndex((t) => t.id === test.id);
  const questions = Array.isArray(test.questions) ? deduplicateQuestions(test.questions) : [];

  const updatedTest: LiveTest = {
    ...current[idx],
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
  return newList;
}

export async function deleteLiveTest(testId: string): Promise<LiveTest[]> {
  const current = loadLocalLiveTests();
  const newList = current.filter((t) => t.id !== testId);
  saveLocalLiveTests(newList);
  addDeletedLiveTestId(testId);
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
  return loadLocalLiveSubmissions().filter((s) => !testId || s.testId === testId);
}

export function subscribeToLiveTests(
  callback: (tests: LiveTest[]) => void
): () => void {
  const deletedIds = new Set(getDeletedLiveTestIds());
  const admin = isUserAdmin(loadUserProfile());
  const initial = loadLocalLiveTests()
    .filter((t) => !deletedIds.has(t.id))
    .map((t) => (admin ? t : sanitizeLiveTestForPublic(t)));
  callback(initial);
  return () => {};
}

export async function submitLiveTestSubmission(submission: LiveTestSubmission): Promise<void> {
  const local = loadLocalLiveSubmissions();
  const existingIdx = local.findIndex(
    (s) => s.submissionId === submission.submissionId || (s.testId === submission.testId && s.userId === submission.userId)
  );
  if (existingIdx >= 0) {
    local[existingIdx] = submission;
  } else {
    local.unshift(submission);
  }
  saveLocalLiveSubmissions(local);
}

export async function fetchMCQsByLiveTest(testId: string): Promise<any[]> {
  const localTests = loadLocalLiveTests();
  const found = localTests.find((t) => t.id === testId);
  if (found && Array.isArray(found.questions) && found.questions.length > 0) {
    const admin = isUserAdmin(loadUserProfile());
    return admin ? found.questions : found.questions.map(stripAnswerFieldsFromQuestion);
  }
  return [];
}
