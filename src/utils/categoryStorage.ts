import { ExamCategory } from "../types";

const CATEGORIES_STORAGE_KEY = "remix_rajprep_exam_categories_v1";

export const INITIAL_CATEGORIES: ExamCategory[] = [];

export function loadLocalCategories(): ExamCategory[] {
  try {
    const raw = localStorage.getItem(CATEGORIES_STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(CATEGORIES_STORAGE_KEY, JSON.stringify(INITIAL_CATEGORIES));
      return INITIAL_CATEGORIES;
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed;
    }
    return INITIAL_CATEGORIES;
  } catch (e) {
    console.error("Error loading local categories:", e);
    return INITIAL_CATEGORIES;
  }
}

export function saveLocalCategories(categories: ExamCategory[]): void {
  try {
    localStorage.setItem(CATEGORIES_STORAGE_KEY, JSON.stringify(categories));
  } catch (e) {
    console.error("Error saving local categories:", e);
  }
}

export async function fetchExamCategories(): Promise<ExamCategory[]> {
  const local = loadLocalCategories();
  return local.sort((a, b) => (a.order || 0) - (b.order || 0));
}

export async function saveExamCategory(category: ExamCategory): Promise<ExamCategory[]> {
  const current = loadLocalCategories();
  const idx = current.findIndex((c) => c.id === category.id);

  let newList: ExamCategory[];
  if (idx >= 0) {
    newList = [...current];
    newList[idx] = category;
  } else {
    newList = [...current, category];
  }

  saveLocalCategories(newList);
  return newList.sort((a, b) => (a.order || 0) - (b.order || 0));
}

export async function deleteExamCategory(categoryId: string): Promise<ExamCategory[]> {
  const current = loadLocalCategories();
  const newList = current.filter((c) => c.id !== categoryId);
  saveLocalCategories(newList);
  return newList.sort((a, b) => (a.order || 0) - (b.order || 0));
}

export function subscribeToExamCategories(
  callback: (categories: ExamCategory[]) => void
): () => void {
  const initial = loadLocalCategories();
  callback(initial.sort((a, b) => (a.order || 0) - (b.order || 0)));
  return () => {};
}
