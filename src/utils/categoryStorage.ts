import { ExamCategory } from "../types";
import { db, auth } from "../lib/firebase";
import {
  collection,
  doc,
  query,
  where,
} from "firebase/firestore";
import {
  guardedGetDocs,
  guardedSetDoc,
  guardedDeleteDoc,
  guardedOnSnapshot,
} from "./quotaTracker";

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
  if (!auth.currentUser) return local.sort((a, b) => (a.order || 0) - (b.order || 0));

  try {
    const snap = await guardedGetDocs(collection(db, "examCategories"), "Student", "Fetch Exam Categories");
    if (snap.empty) {
      // Seed Firestore with initial categories
      for (const cat of local) {
        await guardedSetDoc(doc(db, "examCategories", cat.id), cat, { merge: true }, "Admin", "Seed Exam Category");
      }
      return local.sort((a, b) => (a.order || 0) - (b.order || 0));
    }

    const cloud: ExamCategory[] = [];
    snap.forEach((docSnap) => {
      cloud.push(docSnap.data() as ExamCategory);
    });

    const map = new Map<string, ExamCategory>();
    for (const item of [...local, ...cloud]) {
      map.set(item.id, item);
    }

    const merged = Array.from(map.values()).sort((a, b) => (a.order || 0) - (b.order || 0));
    saveLocalCategories(merged);
    return merged;
  } catch (e) {
    console.warn("Firestore examCategories query skipped or failed:", e);
    return local.sort((a, b) => (a.order || 0) - (b.order || 0));
  }
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

  if (auth.currentUser) {
    try {
      await guardedSetDoc(doc(db, "examCategories", category.id), category, { merge: true }, "Admin", "Save Exam Category");
    } catch (err) {
      console.warn("Firestore save for category skipped/offline:", err);
      throw err;
    }
  }

  return newList.sort((a, b) => (a.order || 0) - (b.order || 0));
}

export async function deleteExamCategory(categoryId: string): Promise<ExamCategory[]> {
  try {
    const liveTestsSnap1 = await guardedGetDocs(
      query(collection(db, "live_tests"), where("examCategory", "==", categoryId)),
      "Admin",
      "Check Category Usage in LiveTests",
      undefined,
      12000,
      true
    );
    const liveTestsSnap2 = await guardedGetDocs(
      query(collection(db, "liveTests"), where("examCategory", "==", categoryId)),
      "Admin",
      "Check Category Usage in LiveTests2",
      undefined,
      12000,
      true
    );
    const pyqSnap = await guardedGetDocs(
      query(collection(db, "pyq_papers"), where("category", "==", categoryId)),
      "Admin",
      "Check Category Usage in PYQ",
      undefined,
      12000,
      true
    );
    const subjectsSnap = await guardedGetDocs(
      query(collection(db, "subjects"), where("category", "==", categoryId)),
      "Admin",
      "Check Category Usage in Subjects",
      undefined,
      12000,
      true
    );
    const mcqsSnap = await guardedGetDocs(
      query(collection(db, "mcqs"), where("category", "==", categoryId)),
      "Admin",
      "Check Category Usage in MCQs",
      undefined,
      12000,
      true
    );

    if (!liveTestsSnap1.empty || !liveTestsSnap2.empty || !pyqSnap.empty || !subjectsSnap.empty || !mcqsSnap.empty) {
      throw new Error("CATEGORY_IN_USE: Cannot delete category because it is currently assigned to active exams, PYQ papers, subjects or questions.");
    }
  } catch (err: any) {
    if (err.message && err.message.includes("CATEGORY_IN_USE")) {
      throw err;
    }
  }

  const current = loadLocalCategories();
  const newList = current.filter((c) => c.id !== categoryId);
  saveLocalCategories(newList);

  if (auth.currentUser) {
    try {
      await guardedDeleteDoc(doc(db, "examCategories", categoryId), "Admin", "Delete Exam Category");
      try {
        await guardedDeleteDoc(doc(db, "exam_categories", categoryId), "Admin", "Delete Exam Category Alt");
      } catch (_) {}
    } catch (err) {
      console.warn("Firestore delete for category skipped/offline:", err);
      throw err;
    }
  }

  return newList.sort((a, b) => (a.order || 0) - (b.order || 0));
}

/**
 * Real-time listener for Exam Categories (User side)
 */
export function subscribeToExamCategories(
  callback: (categories: ExamCategory[]) => void
): () => void {
  const initial = loadLocalCategories();
  callback(initial.sort((a, b) => (a.order || 0) - (b.order || 0)));

  try {
    const q = collection(db, "examCategories");
    return guardedOnSnapshot(
      q,
      "Student",
      "Categories Listener",
      (snapshot) => {
        const cloud: ExamCategory[] = [];
        snapshot.forEach((docSnap: any) => {
          cloud.push({ ...docSnap.data(), id: docSnap.id } as ExamCategory);
        });

        const sorted = cloud.sort((a, b) => (a.order || 0) - (b.order || 0));
        saveLocalCategories(sorted);
        callback(sorted);
      },
      (error) => {
        console.warn("Categories subscription error:", error);
      }
    );
  } catch (e) {
    console.warn("Category subscription fallback to local:", e);
    return () => {};
  }
}
