import { PYQPaper, PYQPaperAttempt, Question } from "../types";
import { isUserAdmin, loadUserProfile } from "./userProfileStorage";
import { serializeTable, normalizeTable } from "./tableUtils";
import { safeSetLocalStorageItem } from "./safeStorage";
import { isTestOrMockPYQ } from "./cleanSlate";

const PYQ_PAPERS_STORAGE_KEY = "remix_rajprep_pyq_papers_v2";
const PYQ_ATTEMPTS_STORAGE_KEY = "remix_rajprep_pyq_attempts_v2";
const DELETED_PYQ_PAPERS_KEY = "remix_rajprep_deleted_pyq_papers_v1";

let inMemoryPYQPapers: PYQPaper[] | null = null;

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

export function saveLocalPYQPapers(papers: PYQPaper[]): void {
  inMemoryPYQPapers = papers;
  safeSetLocalStorageItem(
    PYQ_PAPERS_STORAGE_KEY,
    JSON.stringify(papers),
    () => {
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

export function addDeletedPYQId(id: string): void {
  try {
    const ids = getDeletedPYQIds();
    if (!ids.includes(id)) {
      ids.push(id);
      safeSetLocalStorageItem(DELETED_PYQ_PAPERS_KEY, JSON.stringify(ids));
    }
  } catch {}
}

export async function savePYQPaper(paper: Partial<PYQPaper> & { id: string }): Promise<PYQPaper[]> {
  const current = loadLocalPYQPapers();
  const idx = current.findIndex((p) => p.id === paper.id);

  const updatedPaper: PYQPaper = {
    ...current[idx],
    ...paper,
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
  return updatedList;
}

export async function deletePYQPaper(paperId: string): Promise<PYQPaper[]> {
  const current = loadLocalPYQPapers();
  const updatedList = current.filter((p) => p.id !== paperId);
  saveLocalPYQPapers(updatedList);
  addDeletedPYQId(paperId);
  return updatedList;
}

export async function fetchPYQPapers(): Promise<PYQPaper[]> {
  const localList = loadLocalPYQPapers();
  const deletedIds = new Set(getDeletedPYQIds());
  return localList.filter((p) => !deletedIds.has(p.id));
}

export function subscribeToPublishedPYQPapers(
  callback: (papers: PYQPaper[]) => void
): () => void {
  const deletedIds = new Set(getDeletedPYQIds());
  const initial = loadLocalPYQPapers()
    .filter((p) => !deletedIds.has(p.id) && p.isPublished !== false)
    .sort((a, b) => (parseInt(b.paperYear || "0", 10) || 0) - (parseInt(a.paperYear || "0", 10) || 0));
  callback(initial);
  return () => {};
}

export async function fetchMCQsByPYQPaper(paperId: string): Promise<any[]> {
  const localPapers = loadLocalPYQPapers();
  const found = localPapers.find((p) => p.id === paperId);
  if (found && Array.isArray(found.questions) && found.questions.length > 0) {
    return found.questions;
  }
  return [];
}
