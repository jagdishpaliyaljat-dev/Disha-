import { Chapter, Question, Subject, Topic, UserQuestionsStore } from "../types";
import { CHAPTERS_DATA } from "../data/questions";
import { recordLocalChange } from "./syncStorage";
import { 
  sanitizeUserQuestionsStore, 
  isTestOrMockSubject, 
  isTestOrMockChapter, 
  isTestOrMockTopic, 
  isTestOrMockQuestion, 
  isTestOrMockId 
} from "./cleanSlate";
import { 
  getCachedQuestionBundle, 
  saveCachedQuestionBundle, 
  saveCachedCurriculum, 
  getCachedCurriculum 
} from "./indexedDbCache";
import { safeGetLocalStorageItem, safeSetLocalStorageItem } from "./safeStorage";
import { resolveCanonicalForeignKeys } from "./dataIntegrityEngine";
import {
  getSubjectDisplayName,
  getSubjectSecondaryName,
  getChapterDisplayName,
  getChapterSecondaryTitle,
  getTopicDisplayName,
  getTopicSecondaryTitle,
} from "./curriculumUtils";

export {
  getSubjectDisplayName,
  getSubjectSecondaryName,
  getChapterDisplayName,
  getChapterSecondaryTitle,
  getTopicDisplayName,
  getTopicSecondaryTitle,
};

const USER_QUESTIONS_KEY = "economic_survey_user_questions_v2";

export const DEFAULT_SUBJECTS: Subject[] = [];

// Base display count for chapters as defined in syllabus (Emptied for clean slate)
export const BASE_CHAPTER_COUNTS: Record<string, number> = {};

export const BASE_TOTAL_QUESTIONS = 0;

let isMemoryStoreHydrated = false;
let isIdbHydrationPending = false;

let inMemoryQuestionsStore: UserQuestionsStore = {
  customSubjects: [],
  editedSubjects: {},
  deletedSubjectIds: [],
  customQuestions: [],
  editedQuestions: {},
  deletedQuestionIds: [],
  customChapters: [],
  customTopics: [],
  cloudCacheQuestions: [],
  syncedTopicIds: [],
};

export function dispatchStoreUpdated(detail: any): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("disha2020_store_updated", { detail }));
    window.dispatchEvent(new CustomEvent("quizpro_store_updated", { detail }));
  }
}

/**
 * Restores full curriculum and question bank from IndexedDB if localStorage was empty or exceeded 5MB quota.
 * Never silently reports restoration success when IndexedDB is empty or corrupted.
 */
export async function hydrateUserQuestionsStoreFromIndexedDB(): Promise<UserQuestionsStore & { __restoredFromIdb?: boolean; __restoredQuestionCount?: number }> {
  let restored = false;
  let restoredCount = 0;
  try {
    const cached = await getCachedCurriculum();
    if (
      cached &&
      typeof cached === "object" &&
      (Array.isArray(cached.subjects) || Array.isArray(cached.chapters) || Array.isArray(cached.topics) || Array.isArray(cached.questions)) &&
      ((cached.subjects?.length || 0) > 0 || (cached.chapters?.length || 0) > 0 || (cached.topics?.length || 0) > 0 || (cached.questions?.length || 0) > 0)
    ) {
      const current = inMemoryQuestionsStore;
      const deletedSet = new Set(current.deletedQuestionIds || []);
      const nextSubs = Array.isArray(cached.subjects) && cached.subjects.length ? cached.subjects : (current.customSubjects || []);
      const nextChs = Array.isArray(cached.chapters) && cached.chapters.length ? cached.chapters : (current.customChapters || []);
      const nextTops = Array.isArray(cached.topics) && cached.topics.length ? cached.topics : (current.customTopics || []);
      const rawNextQs = (Array.isArray(cached.questions) && cached.questions.length > (current.cloudCacheQuestions?.length || 0))
        ? cached.questions
        : (current.cloudCacheQuestions || []);
      const rawNextCustomQs = (Array.isArray(cached.customQuestions) && cached.customQuestions.length > (current.customQuestions?.length || 0))
        ? cached.customQuestions
        : (current.customQuestions || []);

      const nextQs = rawNextQs.filter(q => q && q.id && !deletedSet.has(q.id));
      const nextCustomQs = rawNextCustomQs.filter(q => q && q.id && !deletedSet.has(q.id));

      const { reconciledQuestions } = resolveCanonicalForeignKeys(nextQs, nextSubs, nextChs, nextTops);

      inMemoryQuestionsStore = {
        ...current,
        customSubjects: nextSubs,
        customChapters: nextChs,
        customTopics: nextTops,
        cloudCacheQuestions: reconciledQuestions.filter(q => !deletedSet.has(q.id)),
        customQuestions: nextCustomQs,
      };
      isMemoryStoreHydrated = true;
      restored = reconciledQuestions.length > 0;
      restoredCount = reconciledQuestions.length;

      if (restored) {
        dispatchStoreUpdated(inMemoryQuestionsStore);
      }
    }

    // Check quizpro-db-v5 snapshot database if curriculum is still incomplete (< 500 questions)
    if (restoredCount < 500) {
      try {
        const { getAllRecords, SNAPSHOT_STORES } = await import("../services/snapshot/indexedDbV5");
        const v5Mcqs = await getAllRecords(SNAPSHOT_STORES.MCQS);
        const v5Subs = await getAllRecords(SNAPSHOT_STORES.SUBJECTS);
        const v5Chs = await getAllRecords(SNAPSHOT_STORES.CHAPTERS);
        const v5Tops = await getAllRecords(SNAPSHOT_STORES.TOPICS);

        if (Array.isArray(v5Mcqs) && v5Mcqs.length >= 500) {
          const current = inMemoryQuestionsStore;
          const deletedSet = new Set(current.deletedQuestionIds || []);
          const normalizedV5Mcqs = v5Mcqs.map((raw: any) => {
            const d = (raw && raw.data && typeof raw.data === "object") ? raw.data : raw;
            const qId = (raw && raw.id) || (d && d.id);
            if (!d || !qId) return null;
            return {
              ...d,
              id: qId,
              text: d.text || d.question || "",
              options: Array.isArray(d.options) ? d.options : [],
              correctIndex: typeof d.correctIndex === "number" ? d.correctIndex : (parseInt(d.correctIndex, 10) || 0),
              explanation: d.explanation || "",
              topicId: d.topicId || d.topic || "",
              chapterId: d.chapterId || "",
              subjectId: d.subjectId || "",
            };
          }).filter((q: any) => q && q.id && !deletedSet.has(q.id));

          const { reconciledQuestions } = resolveCanonicalForeignKeys(
            normalizedV5Mcqs,
            v5Subs.length ? v5Subs : (current.customSubjects || []),
            v5Chs.length ? v5Chs : (current.customChapters || []),
            v5Tops.length ? v5Tops : (current.customTopics || [])
          );

          inMemoryQuestionsStore = {
            ...current,
            customSubjects: v5Subs.length ? v5Subs : current.customSubjects,
            customChapters: v5Chs.length ? v5Chs : current.customChapters,
            customTopics: v5Tops.length ? v5Tops : current.customTopics,
            cloudCacheQuestions: reconciledQuestions,
          };
          isMemoryStoreHydrated = true;
          restored = true;
          restoredCount = reconciledQuestions.length;

          dispatchStoreUpdated(inMemoryQuestionsStore);
        }
      } catch (v5Err) {
        console.warn("[QuestionsStorage] quizpro-db-v5 read notice:", v5Err);
      }
    }

    // Hydrate directly from Supabase if configured
    if ((inMemoryQuestionsStore.customSubjects?.length || 0) === 0) {
      try {
        const { isSupabaseConfigured } = await import("../lib/supabase");
        if (isSupabaseConfigured()) {
          const { fetchSubjects, fetchChapters, fetchTopics } = await import("./supabaseSyncService");
          const [sbSubjects, sbChapters, sbTopics] = await Promise.all([
            fetchSubjects(),
            fetchChapters(),
            fetchTopics()
          ]);
          if (sbSubjects && sbSubjects.length > 0) {
            inMemoryQuestionsStore = {
              ...inMemoryQuestionsStore,
              customSubjects: sbSubjects,
              customChapters: sbChapters,
              customTopics: sbTopics
            };
            isMemoryStoreHydrated = true;
            dispatchStoreUpdated(inMemoryQuestionsStore);
          }
        }
      } catch (sbErr) {
        console.warn("[QuestionsStorage] Supabase hydration error:", sbErr);
      }
    }

    // Direct Snapshot v1 fallback if still incomplete (< 500 questions)
    if (restoredCount < 500 && typeof window !== "undefined" && typeof fetch !== "undefined") {
      try {
        const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
        const timeoutId = controller ? setTimeout(() => controller.abort(), 1500) : null;
        const snapResp = await fetch("/api/snapshots/v1/content.json", {
          signal: controller ? controller.signal : undefined,
        });
        if (timeoutId) clearTimeout(timeoutId);
        if (snapResp.ok) {
          const snap = await snapResp.json();


          if (Array.isArray(snap.mcqs) && snap.mcqs.length >= 500) {
            const current = inMemoryQuestionsStore;
            const deletedSet = new Set(current.deletedQuestionIds || []);
            const unwrappedMcqs = snap.mcqs.map((raw: any) => {
              const d = (raw && raw.data && typeof raw.data === "object") ? raw.data : raw;
              const qId = (raw && raw.id) || (d && d.id);
              if (!d || !qId) return null;
              return {
                ...d,
                id: qId,
                text: d.text || d.question || "",
                options: Array.isArray(d.options) ? d.options : [],
                correctIndex: typeof d.correctIndex === "number" ? d.correctIndex : (parseInt(d.correctIndex, 10) || 0),
                explanation: d.explanation || "",
                topicId: d.topicId || d.topic || "",
                chapterId: d.chapterId || "",
                subjectId: d.subjectId || "",
              };
            }).filter((q: any) => q && q.id && !deletedSet.has(q.id));

            const { reconciledQuestions } = resolveCanonicalForeignKeys(
              unwrappedMcqs,
              snap.subjects || current.customSubjects,
              snap.chapters || current.customChapters,
              snap.topics || current.customTopics
            );

            inMemoryQuestionsStore = {
              ...current,
              customSubjects: snap.subjects || current.customSubjects,
              customChapters: snap.chapters || current.customChapters,
              customTopics: snap.topics || current.customTopics,
              cloudCacheQuestions: reconciledQuestions,
            };
            isMemoryStoreHydrated = true;
            restored = true;
            restoredCount = reconciledQuestions.length;

            dispatchStoreUpdated(inMemoryQuestionsStore);
          }
        }
      } catch (fetchErr) {
        console.warn("[QuestionsStorage] Snapshot fetch notice:", fetchErr);
      }
    }
  } catch (err) {
    console.warn("[QuestionsStorage] IndexedDB restoration failed or corrupted:", err);
  }
  return Object.assign({}, inMemoryQuestionsStore, {
    __restoredFromIdb: restored,
    __restoredQuestionCount: restoredCount,
  });
}

// Load user custom questions store from localStorage (with automatic IndexedDB fallback)
export function loadUserQuestionsStore(): UserQuestionsStore {
  if (isMemoryStoreHydrated) {
    if ((inMemoryQuestionsStore.cloudCacheQuestions?.length || 0) === 0 && !isIdbHydrationPending) {
      isIdbHydrationPending = true;
      hydrateUserQuestionsStoreFromIndexedDB().finally(() => {
        isIdbHydrationPending = false;
      });
    }
    return inMemoryQuestionsStore;
  }
  try {
    const raw = safeGetLocalStorageItem(USER_QUESTIONS_KEY);
    if (!raw) {
      isMemoryStoreHydrated = true;
      if (!isIdbHydrationPending) {
        isIdbHydrationPending = true;
        hydrateUserQuestionsStoreFromIndexedDB().finally(() => {
          isIdbHydrationPending = false;
        });
      }
      return inMemoryQuestionsStore;
    }
    const parsedRaw = JSON.parse(raw);
    const parsed = Array.isArray(parsedRaw) ? {} : (parsedRaw && typeof parsedRaw === "object" ? parsedRaw : {});
    const store = {
      customSubjects: Array.isArray(parsed.customSubjects) ? parsed.customSubjects : [],
      editedSubjects: parsed.editedSubjects && typeof parsed.editedSubjects === "object" ? parsed.editedSubjects : {},
      deletedSubjectIds: Array.isArray(parsed.deletedSubjectIds) ? parsed.deletedSubjectIds : [],
      customQuestions: Array.isArray(parsed.customQuestions) ? parsed.customQuestions : [],
      editedQuestions: parsed.editedQuestions && typeof parsed.editedQuestions === "object" ? parsed.editedQuestions : {},
      deletedQuestionIds: Array.isArray(parsed.deletedQuestionIds) ? parsed.deletedQuestionIds : [],
      customChapters: Array.isArray(parsed.customChapters) ? parsed.customChapters : [],
      editedChapters: parsed.editedChapters && typeof parsed.editedChapters === "object" ? parsed.editedChapters : {},
      deletedChapterIds: Array.isArray(parsed.deletedChapterIds) ? parsed.deletedChapterIds : [],
      customTopics: Array.isArray(parsed.customTopics) ? parsed.customTopics : [],
      editedTopics: parsed.editedTopics && typeof parsed.editedTopics === "object" ? parsed.editedTopics : {},
      deletedTopicIds: Array.isArray(parsed.deletedTopicIds) ? parsed.deletedTopicIds : [],
      cloudCacheQuestions: Array.isArray(parsed.cloudCacheQuestions) ? parsed.cloudCacheQuestions : [],
      syncedTopicIds: Array.isArray(parsed.syncedTopicIds) ? parsed.syncedTopicIds : [],
      syncedTopicVersions: parsed.syncedTopicVersions && typeof parsed.syncedTopicVersions === "object" ? parsed.syncedTopicVersions : {},
    };

    const { sanitized, changed } = sanitizeUserQuestionsStore(store);
    const effective = changed ? sanitized : store;

    inMemoryQuestionsStore = effective;
    isMemoryStoreHydrated = true;

    if ((effective.cloudCacheQuestions?.length || 0) === 0 && !isIdbHydrationPending) {
      isIdbHydrationPending = true;
      hydrateUserQuestionsStoreFromIndexedDB().finally(() => {
        isIdbHydrationPending = false;
      });
    }

    return effective;
  } catch (e) {
    console.error("Failed to load user questions store", e);
    return {
      ...inMemoryQuestionsStore
    };
  }
}

// Get combined subjects list
export function getCombinedSubjects(store: UserQuestionsStore = loadUserQuestionsStore()): Subject[] {
  try {
    const safeStore: Partial<UserQuestionsStore> = store || {};
    const deletedSet = new Set(safeStore.deletedSubjectIds || []);
    const editedMap = safeStore.editedSubjects || {};
    const customList = Array.isArray(safeStore.customSubjects) ? safeStore.customSubjects : [];

    const baseUpdated = (DEFAULT_SUBJECTS || [])
      .filter((s) => s && s.id && !deletedSet.has(s.id))
      .map((s) => (editedMap[s.id] ? { ...s, ...editedMap[s.id] } : s));

    const customUpdated = customList
      .filter((s) => s && s.id && !deletedSet.has(s.id) && !isTestOrMockSubject(s))
      .map((s) => (editedMap[s.id] ? { ...s, ...editedMap[s.id] } : s));

    return [...baseUpdated, ...customUpdated].filter(s => s && !isTestOrMockSubject(s));
  } catch (err) {
    console.error("[getCombinedSubjects] Fallback triggered due to error:", err);
    return [];
  }
}

// Helper to add subject
export function addSubject(store: UserQuestionsStore, subject: Subject): UserQuestionsStore {
  const current = store.customSubjects || [];
  const cleanDeleted = (store.deletedSubjectIds || []).filter(id => id !== subject.id);
  const remaining = current.filter(s => s.id !== subject.id);
  const updatedSubject: Subject = {
    ...subject,
    isUserAdded: true,
  };
  const updatedStore: UserQuestionsStore = {
    ...store,
    customSubjects: [...remaining, updatedSubject],
    deletedSubjectIds: cleanDeleted,
  };

  saveCachedCurriculum(
    updatedStore.customSubjects || [],
    updatedStore.customChapters || [],
    updatedStore.customTopics || []
  ).catch(() => {});

  return updatedStore;
}

// Helper to edit subject
export function editSubject(store: UserQuestionsStore, subject: Subject): UserQuestionsStore {
  const normName = (subject.name || "").trim();
  const normHindi = (subject.hindiName || "").trim();
  const harmonizedSubject: Subject = {
    ...subject,
    name: normName || normHindi || "Untitled Subject",
    hindiName: normHindi || normName || "Untitled Subject",
  };

  const newEdited = { ...(store.editedSubjects || {}) };
  newEdited[subject.id] = harmonizedSubject;

  // Directly update customSubjects array so local state is immediately consistent
  let found = false;
  const nextCustomSubjects = (store.customSubjects || []).map((s) => {
    if (s.id === subject.id) {
      found = true;
      return { ...s, ...harmonizedSubject };
    }
    return s;
  });
  if (!found) {
    nextCustomSubjects.push(harmonizedSubject);
  }

  const updatedStore: UserQuestionsStore = {
    ...store,
    customSubjects: nextCustomSubjects,
    editedSubjects: newEdited,
  };

  saveCachedCurriculum(
    updatedStore.customSubjects || [],
    updatedStore.customChapters || [],
    updatedStore.customTopics || []
  ).catch(() => {});

  return updatedStore;
}

// Helper to delete subject
export function deleteSubject(store: UserQuestionsStore, subjectId: string): UserQuestionsStore {
  const newDeleted = new Set(store.deletedSubjectIds || []);
  newDeleted.add(subjectId);

  const remainingSubjects = (store.customSubjects || []).filter(s => s.id !== subjectId);
  const chaptersToDelete = (store.customChapters || []).filter(c => c.subjectId === subjectId);
  const chapterIdsToDelete = new Set(chaptersToDelete.map(c => c.id));
  const remainingChapters = (store.customChapters || []).filter(c => c.subjectId !== subjectId);
  const remainingTopics = (store.customTopics || []).filter(
    t => t.subjectId !== subjectId && !chapterIdsToDelete.has(t.chapterId)
  );

  const newEditedSubjects = { ...(store.editedSubjects || {}) };
  delete newEditedSubjects[subjectId];

  const newCustomQuestions = (store.customQuestions || []).filter(
    q => q.subjectId !== subjectId && !chapterIdsToDelete.has(q.chapterId || "")
  );
  const newCloudCacheQuestions = (store.cloudCacheQuestions || []).filter(
    q => q.subjectId !== subjectId && !chapterIdsToDelete.has(q.chapterId || "")
  );

  const updatedStore: UserQuestionsStore = {
    ...store,
    customSubjects: remainingSubjects,
    customChapters: remainingChapters,
    customTopics: remainingTopics,
    customQuestions: newCustomQuestions,
    cloudCacheQuestions: newCloudCacheQuestions,
    editedSubjects: newEditedSubjects,
    deletedSubjectIds: Array.from(newDeleted),
  };

  // Sync to IndexedDB curriculum cache immediately
  saveCachedCurriculum(
    updatedStore.customSubjects || [],
    updatedStore.customChapters || [],
    updatedStore.customTopics || []
  ).catch(() => {});

  return updatedStore;
}

// Save user custom questions store to localStorage + IndexedDB
export function saveUserQuestionsStore(store: UserQuestionsStore): void {
  // CRITICAL: Always sanitize store to guarantee zero mock or test items
  const { sanitized } = sanitizeUserQuestionsStore(store);
  const cleanStore = sanitized;
  inMemoryQuestionsStore = cleanStore;
  isMemoryStoreHydrated = true;

  // Always persist full curriculum + question bank in IndexedDB (no 5MB limit)
  saveCachedCurriculum(
    cleanStore.customSubjects || [],
    cleanStore.customChapters || [],
    cleanStore.customTopics || [],
    cleanStore.cloudCacheQuestions || [],
    cleanStore.customQuestions || []
  ).catch(() => {});

  // Mirror questions to persistent localforage IndexedDB question bank
  const allCurrentQs = [...(store.customQuestions || []), ...(store.cloudCacheQuestions || [])];
  if (allCurrentQs.length > 0) {
    import("./questionBankCache").then(({ saveQuestionsToCache }) => {
      saveQuestionsToCache(allCurrentQs, { source: "user" }).catch(() => {});
    }).catch(() => {});
  }

  try {
    dispatchStoreUpdated(store);
    safeSetLocalStorageItem(
      USER_QUESTIONS_KEY,
      JSON.stringify(cleanStore),
      () => {
        const leanCache = (cleanStore.cloudCacheQuestions || []).map(q => {
          const copy: any = { ...q };
          if (copy.imageUrl && typeof copy.imageUrl === "string" && copy.imageUrl.length > 50 * 1024) {
            delete copy.imageUrl;
          }
          if (copy.image && typeof copy.image === "object" && copy.image.dataUrl && copy.image.dataUrl.length > 50 * 1024) {
            copy.image = { ...copy.image, dataUrl: "" };
          }
          return copy as Question;
        });
        return JSON.stringify({ ...cleanStore, cloudCacheQuestions: leanCache });
      }
    );
    recordLocalChange();
  } catch (e) {
    console.warn("[QuestionsStorage] Notice while persisting questions store:", e);
  }
}

/**
 * Merges questions into the in-memory questions store and returns updated store.
 * Compares updatedAt timestamps so stale legacy records never overwrite newer moved records.
 */
export function mergeQuestionsIntoStore(questionsToAdd: Question[]): UserQuestionsStore {
  const currentStore = loadUserQuestionsStore();
  const existingMap = new Map<string, Question>();
  (currentStore.cloudCacheQuestions || []).forEach(q => {
    if (q && q.id) existingMap.set(q.id, q);
  });
  (currentStore.customQuestions || []).forEach(q => {
    if (q && q.id) existingMap.set(q.id, q);
  });

  questionsToAdd.forEach(q => {
    if (q && q.id) {
      const existing = existingMap.get(q.id);
      if (!existing) {
        existingMap.set(q.id, q);
      } else {
        const tExisting = new Date((existing as any).updatedAt || existing.createdAt || 0).getTime() || 0;
        const tIncoming = new Date((q as any).updatedAt || q.createdAt || 0).getTime() || 0;
        if (tIncoming >= tExisting) {
          existingMap.set(q.id, { ...existing, ...q });
        } else {
          existingMap.set(q.id, { ...q, ...existing });
        }
      }
    }
  });

  const nextCloudCache = Array.from(existingMap.values());
  const updatedStore: UserQuestionsStore = {
    ...currentStore,
    cloudCacheQuestions: nextCloudCache,
  };

  saveUserQuestionsStore(updatedStore);
  dispatchStoreUpdated(updatedStore);
  return updatedStore;
}

let lastLoggedCombinedState = "";

// Merge base CHAPTERS_DATA with user custom additions, edits, categorization moves, and deletions
export function getCombinedChapters(store: UserQuestionsStore = loadUserQuestionsStore()): Chapter[] {
  try {
    const safeStore: Partial<UserQuestionsStore> = store || {};
    const deletedSet = new Set(safeStore.deletedQuestionIds || []);
    const editedMap = safeStore.editedQuestions || {};
    const customList = Array.isArray(safeStore.customQuestions) ? safeStore.customQuestions : [];
    
    const deletedChapterSet = new Set(safeStore.deletedChapterIds || []);
    const deletedTopicSet = new Set(safeStore.deletedTopicIds || []);
    const editedChapterMap = safeStore.editedChapters || {};
    const editedTopicMap = safeStore.editedTopics || {};
    const customChaptersList = (Array.isArray(safeStore.customChapters) ? safeStore.customChapters : [])
      .filter(ch => ch && !deletedChapterSet.has(ch.id) && !isTestOrMockChapter(ch));
    const customTopicsList = (Array.isArray(safeStore.customTopics) ? safeStore.customTopics : [])
      .filter(t => t && !deletedTopicSet.has(t.id) && !isTestOrMockTopic(t));

    // All base questions
    const allBaseQuestions: Question[] = (CHAPTERS_DATA || []).flatMap((c) =>
      (c?.topics || []).flatMap((t) => (Array.isArray(t?.questions) ? t.questions : []))
    );

    // Apply edits (including topic/chapter moves) to base questions and filter deleted
    const activeBaseQuestions = allBaseQuestions
      .filter((q) => q && q.id && !deletedSet.has(q.id) && !isTestOrMockQuestion(q))
      .map((q) => (editedMap[q.id] ? { ...q, ...editedMap[q.id] } : q));

  // Apply edits to custom questions and filter deleted
  const activeCustomQuestions = customList
    .filter((q) => !deletedSet.has(q.id) && !isTestOrMockQuestion(q))
    .map((q) => (editedMap[q.id] ? { ...q, ...editedMap[q.id] } : q));

  // Include cloud cached questions
  const activeCachedQuestions = (store.cloudCacheQuestions || [])
    .filter((q) => !deletedSet.has(q.id) && !isTestOrMockQuestion(q))
    .map((q) => (editedMap[q.id] ? { ...q, ...editedMap[q.id] } : q));

  // Include any questions embedded directly inside customTopics or customChapters.topics
  const embeddedTopicQuestions: Question[] = [];
  for (const ch of customChaptersList) {
    for (const t of ch.topics || []) {
      if (Array.isArray(t?.questions)) {
        for (const q of t.questions) {
          if (q && q.id && !deletedSet.has(q.id) && !isTestOrMockQuestion(q)) {
            const enriched = {
              ...q,
              topicId: q.topicId || t.id,
              chapterId: q.chapterId || ch.id,
              subjectId: q.subjectId || t.subjectId || ch.subjectId,
            };
            embeddedTopicQuestions.push(editedMap[q.id] ? { ...enriched, ...editedMap[q.id] } : enriched);
          }
        }
      }
    }
  }
  for (const t of customTopicsList) {
    if (Array.isArray(t?.questions)) {
      for (const q of t.questions) {
        if (q && q.id && !deletedSet.has(q.id) && !isTestOrMockQuestion(q)) {
          const enriched = {
            ...q,
            topicId: q.topicId || t.id,
            chapterId: q.chapterId || t.chapterId,
            subjectId: q.subjectId || t.subjectId,
          };
          embeddedTopicQuestions.push(editedMap[q.id] ? { ...enriched, ...editedMap[q.id] } : enriched);
        }
      }
    }
  }

  const allActive = [
    ...embeddedTopicQuestions,
    ...activeBaseQuestions,
    ...activeCustomQuestions,
    ...activeCachedQuestions,
  ];

  // Deduplicate questions:
  // Step 1: Deduplicate by ID (custom/edited versions take precedence)
  const dedupedMap = new Map<string, Question>();
  allActive.forEach(q => {
    if (q && q.id) dedupedMap.set(q.id, q);
  });

  // Step 2: Deduplicate identical questions across ID formats ONLY for stale move copies:
  // e.g. an mcq_ copy created at destination by old move bug vs canonical usr-q- original at source.
  // Legitimate identical question text with different options or distinct user-imported records in the same topic are PRESERVED.
  // O(N) optimization: Bucket by chapterId and normalized text to avoid O(N^2) nested scan on large datasets.
  const docsList = Array.from(dedupedMap.values());
  const finalActiveList: Question[] = [];
  const processedDocIds = new Set<string>();

  const normalizeOpts = (options: string[] = []): string =>
    (options || []).map((o: any) => (typeof o === "string" ? o.trim().toLowerCase() : "")).sort().join("|");

  const bucketMap = new Map<string, Question[]>();
  for (let i = 0; i < docsList.length; i++) {
    const q = docsList[i];
    const text = (q.text || (q as any).question || "").trim().toLowerCase();
    const key = text || q.id;
    let b = bucketMap.get(key);
    if (!b) {
      b = [];
      bucketMap.set(key, b);
    }
    b.push(q);
  }

  bucketMap.forEach((bucket) => {
    if (bucket.length === 1) {
      finalActiveList.push(bucket[0]);
      processedDocIds.add(bucket[0].id);
      return;
    }

    for (let i = 0; i < bucket.length; i++) {
      const q1 = bucket[i];
      if (processedDocIds.has(q1.id)) continue;

      let reconciledDoc = q1;

      for (let j = i + 1; j < bucket.length; j++) {
        const q2 = bucket[j];
        if (processedDocIds.has(q2.id)) continue;

        // Verify options match (if both have options, different options mean different questions!)
        const opts1 = normalizeOpts(q1.options);
        const opts2 = normalizeOpts(q2.options);
        if (opts1 && opts2 && opts1 !== opts2) continue;

        // Check if this is a stale move copy, cross-format duplicate, or identical question
        const hasMcqAndUsrQ = (q1.id.startsWith("usr-q-") && q2.id.startsWith("mcq_")) ||
                              (q2.id.startsWith("usr-q-") && q1.id.startsWith("mcq_"));
        const isDiffTopic = Boolean(q1.topicId && q2.topicId && q1.topicId !== q2.topicId);
        const isDiffChapter = Boolean(q1.chapterId && q2.chapterId && q1.chapterId !== q2.chapterId);
        const isDuplicateRecord = q1.id !== q2.id;

        if (hasMcqAndUsrQ || isDiffTopic || isDiffChapter || isDuplicateRecord) {
          const time1 = new Date((q1 as any).updatedAt || q1.createdAt || 0).getTime();
          const time2 = new Date((q2 as any).updatedAt || q2.createdAt || 0).getTime();
          const isQ2Newer = time2 > time1 || (time2 === time1 && q2.topicId && !q1.topicId);

          const newerDoc = isQ2Newer ? q2 : q1;
          const olderDoc = isQ2Newer ? q1 : q2;

          const canonicalId = (newerDoc.id.startsWith("usr-q-") 
            ? newerDoc.id 
            : (olderDoc.id.startsWith("usr-q-") ? olderDoc.id : newerDoc.id));

          reconciledDoc = {
            ...newerDoc,
            id: canonicalId,
            topicId: newerDoc.topicId || olderDoc.topicId,
            chapterId: newerDoc.chapterId || olderDoc.chapterId,
            subjectId: newerDoc.subjectId || olderDoc.subjectId,
          };

          processedDocIds.add(q1.id);
          processedDocIds.add(q2.id);
          break;
        }
      }

      processedDocIds.add(q1.id);
      finalActiveList.push(reconciledDoc);
    }
  });

  const activeSubjectsForResolution = getCombinedSubjects(store);
  const { reconciledQuestions: finalActive } = resolveCanonicalForeignKeys(
    finalActiveList,
    activeSubjectsForResolution,
    [...(CHAPTERS_DATA || []), ...customChaptersList],
    customTopicsList
  );

  const logStateKey = `${allActive.length}-${finalActive.length}-${activeBaseQuestions.length}-${activeCustomQuestions.length}-${activeCachedQuestions.length}`;
  if (logStateKey !== lastLoggedCombinedState && (allActive.length > 0 || finalActive.length > 0)) {
    lastLoggedCombinedState = logStateKey;
    console.log(`[getCombinedChapters] Total: ${allActive.length}, Deduped: ${finalActive.length}, Base: ${activeBaseQuestions.length}, Custom: ${activeCustomQuestions.length}, Cached: ${activeCachedQuestions.length}`);
  }

  // Flexible topic matching helper
  const isQuestionInTopic = (q: Question, t: Topic, ch: Chapter): boolean => {
    if (!q || !t || !ch) return false;
    
    // 1. Direct ID match: When question has a topicId assigned, STRICT topic ID equality is required.
    // Never allow a question with an explicit topicId to match another topic.
    if (q.topicId) {
      const isMatchingTopic = q.topicId === t.id || q.topicId.toLowerCase() === t.id.toLowerCase();
      if (!isMatchingTopic) {
        return false;
      }
      return !q.chapterId || q.chapterId === ch.id || !q.subjectId || q.subjectId === ch.subjectId;
    }

    // 2. Direct Chapter + Topic match (only if topicId was empty on question and topic is default)
    if (q.chapterId && q.chapterId === ch.id && t.id.startsWith("default_")) {
      return true;
    }

    // 3. Title / Text normalization match ONLY for legacy questions that have NO topicId
    const qTopicTitle = (q as any).topicTitle || (q as any).topicName || (q as any).topic || "";
    const qHindiTitle = (q as any).hindiTopicTitle || (q as any).hindiTopicName || "";

    const tTitleNorm = (t.title || "").toLowerCase().trim();
    const tHindiNorm = (t.hindiTitle || "").toLowerCase().trim();
    const qTitleNorm = qTopicTitle.toLowerCase().trim();
    const qHindiNorm = qHindiTitle.toLowerCase().trim();

    // Strict or non-generic equality matching (never substring match short tokens like 'mcq' or 'test')
    const isExactOrStrongMatch = (a: string, b: string) => {
      if (!a || !b) return false;
      if (a === b) return true;
      // Only allow substring matching if both strings are substantial and do not end in differing digits
      if (a.length > 6 && b.length > 6 && (a.includes(b) || b.includes(a))) {
        const aNum = a.match(/\d+$/)?.[0];
        const bNum = b.match(/\d+$/)?.[0];
        if (aNum && bNum && aNum !== bNum) return false;
        return true;
      }
      return false;
    };

    if (
      isExactOrStrongMatch(qTitleNorm, tTitleNorm) ||
      isExactOrStrongMatch(qHindiNorm, tHindiNorm) ||
      isExactOrStrongMatch(qTitleNorm, tHindiNorm)
    ) {
      const qSubNorm = (q.subjectId || "").toLowerCase().replace(/[-_]/g, "");
      const chSubNorm = (ch.subjectId || "").toLowerCase().replace(/[-_]/g, "");
      if (!q.subjectId || !ch.subjectId || qSubNorm === chSubNorm) {
        return true;
      }
    }

    return false;
  };

  // Index custom topics by chapterId
  const customTopicsByChapter = new Map<string, Topic[]>();
  for (const t of (customTopicsList || [])) {
    const list = customTopicsByChapter.get(t.chapterId);
    if (list) {
      list.push(t);
    } else {
      customTopicsByChapter.set(t.chapterId, [t]);
    }
  }

  // Track claimed question IDs so unassigned ones can be salvaged into dynamic topics
  const assignedQuestionIds = new Set<string>();

  // Index questions by topicId for O(1) direct matching to avoid O(T * Q) scans
  const questionsByTopicId = new Map<string, Question[]>();
  const unassignedCandidates: Question[] = [];
  for (let i = 0; i < finalActive.length; i++) {
    const q = finalActive[i];
    if (q.topicId) {
      const k = q.topicId.toLowerCase();
      let arr = questionsByTopicId.get(k);
      if (!arr) {
        arr = [];
        questionsByTopicId.set(k, arr);
      }
      arr.push(q);
    } else {
      unassignedCandidates.push(q);
    }
  }

  const getQuestionsForTopic = (t: Topic, chapter: Chapter): Question[] => {
    const list: Question[] = [];
    const direct = questionsByTopicId.get(t.id.toLowerCase()) || [];
    for (let i = 0; i < direct.length; i++) {
      const q = direct[i];
      assignedQuestionIds.add(q.id);
      list.push(q);
    }
    for (let i = 0; i < unassignedCandidates.length; i++) {
      const q = unassignedCandidates[i];
      if (isQuestionInTopic(q, t, chapter)) {
        assignedQuestionIds.add(q.id);
        list.push(q);
      }
    }
    return list;
  };

  // Update base chapters with questions and any added custom topics
  const baseUpdatedChapters: Chapter[] = (CHAPTERS_DATA || [])
    .filter(ch => ch && !deletedChapterSet.has(ch.id))
    .map((ch) => {
      const edited = editedChapterMap[ch.id];
      const baseChapter = edited ? { ...ch, ...edited } : ch;
      const extraTopics = customTopicsByChapter.get(baseChapter.id) || [];

      // Deduplicate topics by ID
      const topicsMap = new Map<string, Topic>();
      (baseChapter.topics || []).forEach((t: Topic) => {
        if (t && t.id) topicsMap.set(t.id, t);
      });
      extraTopics.forEach((t: Topic) => {
        if (t && t.id) topicsMap.set(t.id, t);
      });

      const allChTopics = Array.from(topicsMap.values())
        .filter((t: Topic) => t && !deletedTopicSet.has(t.id))
        .map((t: Topic) => {
            const editedTopic = editedTopicMap[t.id];
            return editedTopic ? { ...t, ...editedTopic } : t;
        });

      const updatedTopics: Topic[] = allChTopics.map((t, tIdx) => {
        const topicQuestions = getQuestionsForTopic(t, baseChapter);
        const effectiveQuestionCount =
          topicQuestions.length > 0
            ? topicQuestions.length
            : typeof t.questionCount === "number" && t.questionCount > 0
            ? t.questionCount
            : 0;

        return {
          ...t,
          number: t.number || tIdx + 1,
          questions: topicQuestions,
          questionCount: effectiveQuestionCount,
        };
      });

      const chapterQuestionCount = updatedTopics.reduce(
        (sum, t) => sum + (Array.isArray(t?.questions) && t.questions.length > 0 ? t.questions.length : (t?.questionCount || 0)),
        0
      );

      return {
        ...baseChapter,
        subjectId: baseChapter.subjectId || "economics",
        topics: updatedTopics,
        questionCount: chapterQuestionCount,
      };
    });

  const fallbackSubjectId = (safeStore.customSubjects && safeStore.customSubjects.length > 0)
    ? safeStore.customSubjects[0].id
    : "economics";

  // Update custom chapters with questions
  const customUpdatedChapters: Chapter[] = customChaptersList.map((ch) => {
    const edited = editedChapterMap[ch.id];
    const customChapter = edited ? { ...ch, ...edited } : ch;
    const chSubjectId = customChapter.subjectId || fallbackSubjectId;
    
    const extraTopics = customTopicsByChapter.get(customChapter.id) || [];
    
    // Deduplicate topics by ID while preserving questionCount and embedded questions
    const topicsMap = new Map<string, Topic>();
    (customChapter.topics || []).forEach((t: Topic) => {
      if (t && t.id) topicsMap.set(t.id, t);
    });
    extraTopics.forEach((t: Topic) => {
      if (!t || !t.id) return;
      const prev = topicsMap.get(t.id);
      const mergedQuestions =
        Array.isArray(t.questions) && t.questions.length > 0
          ? t.questions
          : Array.isArray(prev?.questions)
          ? prev.questions
          : [];
      const mergedQuestionCount =
        mergedQuestions.length > 0
          ? mergedQuestions.length
          : typeof t.questionCount === "number"
          ? t.questionCount
          : typeof prev?.questionCount === "number"
          ? prev.questionCount
          : 0;
      topicsMap.set(t.id, {
        ...prev,
        ...t,
        questions: mergedQuestions,
        ...(mergedQuestionCount > 0 ? { questionCount: mergedQuestionCount } : {}),
      });
    });

    const allChTopics = Array.from(topicsMap.values())
        .filter((t: Topic) => t && !deletedTopicSet.has(t.id))
        .map((t: Topic) => {
            const editedTopic = editedTopicMap[t.id];
            return editedTopic ? { ...t, ...editedTopic } : t;
        });

    const updatedTopics: Topic[] = allChTopics.map((t, tIdx) => {
      const topicQuestions = getQuestionsForTopic(t, customChapter);
      const effectiveQuestionCount =
        topicQuestions.length > 0
          ? topicQuestions.length
          : typeof t.questionCount === "number" && t.questionCount > 0
          ? t.questionCount
          : 0;

      return {
        ...t,
        chapterId: customChapter.id,
        subjectId: chSubjectId,
        number: t.number || tIdx + 1,
        questions: topicQuestions,
        questionCount: effectiveQuestionCount,
      };
    });

    const chapterQuestionCount = updatedTopics.reduce(
      (sum, t) => sum + (Array.isArray(t?.questions) && t.questions.length > 0 ? t.questions.length : (t?.questionCount || 0)),
      0
    );

    return {
      ...customChapter,
      subjectId: chSubjectId,
      topics: updatedTopics,
      questionCount: chapterQuestionCount,
    };
  });

  // Salvage unassigned / orphaned questions to ensure 100% visibility across subjects & chapters
  const unassignedQuestions = finalActive.filter(q => !assignedQuestionIds.has(q.id));

  if (unassignedQuestions.length > 0) {
    const allCombined = [...baseUpdatedChapters, ...customUpdatedChapters];

    unassignedQuestions.forEach(q => {
      const qSubNorm = (q.subjectId || (q as any).subject || "").toLowerCase().replace(/[-_]/g, "").trim();
      const qChapId = q.chapterId;
      const qTopNorm = (q.topicId || "").toLowerCase().replace(/[-_]/g, "").trim();

      // Find matching chapter by ID, subject ID, subject name, or topic ID matching subject slug
      let targetChapter = allCombined.find(ch => ch.id === qChapId);

      if (!targetChapter && qSubNorm) {
        targetChapter = allCombined.find(
          ch => (ch.subjectId || "").toLowerCase().replace(/[-_]/g, "").trim() === qSubNorm ||
                (ch.title || "").toLowerCase().includes(qSubNorm)
        );
      }

      if (!targetChapter && qTopNorm && qTopNorm !== "gen") {
        targetChapter = allCombined.find(
          ch => (ch.subjectId || "").toLowerCase().replace(/[-_]/g, "").trim().includes(qTopNorm) ||
                (ch.title || "").toLowerCase().includes(qTopNorm)
        );
      }

      // Final fallback: attach to the first available chapter so no Admin-uploaded question is ever lost
      if (!targetChapter && allCombined.length > 0) {
        targetChapter = allCombined[0];
      }

      if (targetChapter) {
        if (!Array.isArray(targetChapter.topics)) {
          targetChapter.topics = [];
        }

        // Resolve known topic details first to prevent renaming custom topics to "General Practice"
        const knownCustomTopic =
          (customTopicsList || []).find(t => t.id === q.topicId) ||
          (safeStore.customTopics || []).find(t => t.id === q.topicId) ||
          allCombined.flatMap(c => c.topics || []).find(t => t.id === q.topicId);

        const knownEdited = q.topicId && safeStore.editedTopics ? safeStore.editedTopics[q.topicId] : undefined;

        const resolvedTitle =
          knownEdited?.title ||
          knownCustomTopic?.title ||
          (q as any).topicTitle ||
          (q as any).topicName ||
          (q as any).topic ||
          (q.topicId && q.topicId !== "gen" && q.topicId !== "chapter_general"
            ? (knownCustomTopic?.title || (q.topicId.startsWith("custom-topic-") ? "Custom Topic" : `Topic ${q.topicId}`))
            : (knownCustomTopic?.title || (targetChapter.title ? `${targetChapter.title} Practice` : "Topic Practice")));


        const resolvedHindiTitle =
          knownEdited?.hindiTitle ||
          knownCustomTopic?.hindiTitle ||
          (q as any).hindiTopicTitle ||
          (q as any).hindiTopicName ||
          resolvedTitle;

        const qTopTitle = resolvedTitle;
        const qHindiTitle = resolvedHindiTitle;

        // Find existing topic or create salvage topic
        let targetTopic = targetChapter.topics.find(
          t => t && (t.id === q.topicId || (qTopTitle && (t.title || "").toLowerCase() === qTopTitle.toLowerCase()))
        );

        if (targetTopic) {
          if (!Array.isArray(targetTopic.questions)) {
            targetTopic.questions = [];
          }
          // If the existing topic was previously defaulted to "General Practice" but has a known custom topic with a real name, restore the real name!
          if (knownCustomTopic && (targetTopic.title.includes("General Practice") || targetTopic.title.includes("सामान्य अभ्यास"))) {
            targetTopic.title = knownCustomTopic.title;
            targetTopic.hindiTitle = knownCustomTopic.hindiTitle || knownCustomTopic.title;
          }
          if (!targetTopic.questions.some(existingQ => existingQ && existingQ.id === q.id)) {
            targetTopic.questions.push(q);
          }
        } else {
          const newTopicId = (q.topicId && q.topicId !== "gen")
            ? q.topicId
            : `salvage_${targetChapter.id}_general`;
          const existingSalvage = targetChapter.topics.find(t => t && t.id === newTopicId);
          if (existingSalvage) {
            if (!Array.isArray(existingSalvage.questions)) {
              existingSalvage.questions = [];
            }
            if (knownCustomTopic && (existingSalvage.title.includes("General Practice") || existingSalvage.title.includes("सामान्य अभ्यास"))) {
              existingSalvage.title = knownCustomTopic.title;
              existingSalvage.hindiTitle = knownCustomTopic.hindiTitle || knownCustomTopic.title;
            }
            if (!existingSalvage.questions.some(existingQ => existingQ && existingQ.id === q.id)) {
              existingSalvage.questions.push(q);
            }
          } else {
            targetChapter.topics.push({
              id: newTopicId,
              chapterId: targetChapter.id,
              subjectId: targetChapter.subjectId,
              title: knownCustomTopic?.title || qTopTitle,
              hindiTitle: knownCustomTopic?.hindiTitle || qHindiTitle,
              number: targetChapter.topics.length + 1,
              questions: [q],
              isUserAdded: knownCustomTopic?.isUserAdded ?? true,
            });
          }
        }
      }
    });
  }

  const allCombinedChapters = [...baseUpdatedChapters, ...customUpdatedChapters];
  
  // Final deduplication by chapter ID (custom wins)
  const finalChaptersMap = new Map<string, Chapter>();
  allCombinedChapters.forEach(ch => {
    if (ch && ch.id) finalChaptersMap.set(ch.id, ch);
  });
  const uniqueChapters = Array.from(finalChaptersMap.values());

  // Group by subjectId and assign independent 1-based numbering per subject
  const chaptersBySubjectMap = new Map<string, Chapter[]>();
  for (const ch of uniqueChapters) {
    const sId = ch.subjectId || "economics";
    const list = chaptersBySubjectMap.get(sId) || [];
    list.push(ch);
    chaptersBySubjectMap.set(sId, list);
  }

  const resultChapters: Chapter[] = [];
  chaptersBySubjectMap.forEach((subjChapters, sId) => {
    subjChapters.sort((a, b) => (a.number || 0) - (b.number || 0) || a.id.localeCompare(b.id));
    subjChapters.forEach((ch, idx) => {
      resultChapters.push({
        ...ch,
        subjectId: sId,
        number: idx + 1,
      });
    });
  });

  return resultChapters;
  } catch (err) {
    console.error("[getCombinedChapters] Fallback triggered due to error:", err);
    return CHAPTERS_DATA || [];
  }
}

// Deduplicate questions by ID (last one wins)
export function deduplicateQuestions(questions: Question[]): Question[] {
  if (!questions || questions.length === 0) return [];
  const deduped = new Map<string, Question>();
  questions.forEach(q => {
    if (q && q.id) {
      deduped.set(q.id, q);
    }
  });
  return Array.from(deduped.values());
}

// Extract flat array of all combined questions (deduplicated by ID)
export function getCombinedQuestions(chapters: Chapter[], store?: UserQuestionsStore): Question[] {
  try {
    const effectiveStore = store || loadUserQuestionsStore();
    const deletedSet = new Set(effectiveStore?.deletedQuestionIds || []);
    const isCompleteQ = (q: any): boolean =>
      Boolean(
        q &&
        q.id &&
        !deletedSet.has(q.id) &&
        (q.text || q.question) &&
        Array.isArray(q.options) &&
        q.options.length >= 2
      );

    const allRaw = (Array.isArray(chapters) ? chapters : [])
      .flatMap((ch) => (Array.isArray(ch?.topics) ? ch.topics : []).flatMap((t) => (Array.isArray(t?.questions) ? t.questions : [])))
      .filter(isCompleteQ);
    
    if (effectiveStore) {
      const chapterIds = new Set((Array.isArray(chapters) ? chapters : []).map((c) => c?.id).filter(Boolean));
      const topicIds = new Set(
        (Array.isArray(chapters) ? chapters : []).flatMap((c) => (Array.isArray(c?.topics) ? c.topics : []).map((t) => t?.id)).filter(Boolean)
      );
      const subjectIds = new Set(
        (Array.isArray(chapters) ? chapters : []).map((c) => (c?.subjectId || "").toLowerCase().replace(/[-_]/g, "")).filter(Boolean)
      );
      const allStoreChaptersCount = (effectiveStore.customChapters || []).length;
      const isGlobalQuery = chapters.length >= allStoreChaptersCount && chapters.length > 0;

      const storeQuestions = [
        ...(Array.isArray(effectiveStore.customQuestions) ? effectiveStore.customQuestions : []),
        ...(Array.isArray(effectiveStore.cloudCacheQuestions) ? effectiveStore.cloudCacheQuestions : [])
      ].filter(isCompleteQ);

      const matchingStoreQuestions = storeQuestions.filter((q) => {
        if (!q) return false;
        if (isGlobalQuery) return true;
        if (q.chapterId && chapterIds.has(q.chapterId)) return true;
        if (q.topicId && topicIds.has(q.topicId)) return true;
        const qSubNorm = (q.subjectId || "").toLowerCase().replace(/[-_]/g, "");
        if (qSubNorm && subjectIds.has(qSubNorm)) return true;
        return false;
      });

      return deduplicateQuestions([...allRaw, ...matchingStoreQuestions])
        .filter(q => q && !deletedSet.has(q.id) && !isTestOrMockQuestion(q));
    }

    return deduplicateQuestions(allRaw).filter(q => q && !deletedSet.has(q.id) && !isTestOrMockQuestion(q));
  } catch (err) {
    console.error("[getCombinedQuestions] Fallback triggered due to error:", err);
    return [];
  }
}

// Build helper lookup maps
export function getCombinedQuestionsMap(questions: Question[]): Record<string, Question> {
  if (!Array.isArray(questions)) return {};
  return questions.reduce((acc, q) => {
    if (q && q.id) {
      acc[q.id] = q;
    }
    return acc;
  }, {} as Record<string, Question>);
}

export function getCombinedChaptersMap(chapters: Chapter[]): Record<string, Chapter> {
  if (!Array.isArray(chapters)) return {};
  return chapters.reduce((acc, ch) => {
    if (ch && ch.id) {
      acc[ch.id] = ch;
    }
    return acc;
  }, {} as Record<string, Chapter>);
}

export function getCombinedTopicsMap(chapters: Chapter[]): Record<string, Topic> {
  if (!Array.isArray(chapters)) return {};
  const map: Record<string, Topic> = {};
  chapters.forEach((ch) => {
    if (ch && Array.isArray(ch.topics)) {
      ch.topics.forEach((t) => {
        if (t && t.id) {
          map[t.id] = t;
        }
      });
    }
  });
  return map;
}

// Bulk delete questions helper
export function bulkDeleteQuestions(
  store: UserQuestionsStore,
  questionIds: string[]
): UserQuestionsStore {
  if (!questionIds || questionIds.length === 0) return store;
  const idsToDeleteSet = new Set(questionIds);
  const existingDeletedSet = new Set(store.deletedQuestionIds || []);
  questionIds.forEach((id) => existingDeletedSet.add(id));

  const newCustom = (store.customQuestions || []).filter(
    (q) => !idsToDeleteSet.has(q.id)
  );

  const newCloudCache = (store.cloudCacheQuestions || []).filter(
    (q) => !idsToDeleteSet.has(q.id)
  );

  const newCustomTopics = (store.customTopics || []).map((t) => ({
    ...t,
    questions: (t.questions || []).filter((q) => !idsToDeleteSet.has(q.id)),
  }));

  const newCustomChapters = (store.customChapters || []).map((ch) => ({
    ...ch,
    topics: (ch.topics || []).map((t) => ({
      ...t,
      questions: (t.questions || []).filter((q) => !idsToDeleteSet.has(q.id)),
    })),
  }));

  const newEdited = { ...(store.editedQuestions || {}) };
  questionIds.forEach((id) => {
    delete newEdited[id];
  });

  return {
    ...store,
    customQuestions: newCustom,
    cloudCacheQuestions: newCloudCache,
    customTopics: newCustomTopics,
    customChapters: newCustomChapters,
    editedQuestions: newEdited,
    deletedQuestionIds: Array.from(existingDeletedSet),
  };
}

// Bulk move questions helper (categorization move)
export function bulkMoveQuestions(
  store: UserQuestionsStore,
  questionIds: string[],
  targetChapterId: string,
  targetTopicId: string,
  allCombinedQuestionsMap: Record<string, Question>,
  targetSubjectId?: string
): UserQuestionsStore {
  const idsSet = new Set(questionIds);
  // Collect normalized text of moved questions to ensure duplicate copies in cache also move
  const movedTextsSet = new Set<string>();
  questionIds.forEach((id) => {
    const q = allCombinedQuestionsMap[id];
    if (q) {
      const txt = (q.text || (q as any).question || "").trim().toLowerCase();
      if (txt) movedTextsSet.add(txt);
    }
  });

  const isTargetQuestion = (q: Question) => {
    if (idsSet.has(q.id)) return true;
    const txt = (q.text || (q as any).question || "").trim().toLowerCase();
    return txt ? movedTextsSet.has(txt) : false;
  };

  const nowIso = new Date().toISOString();

  // 1. Update custom questions directly
  const newCustom = (store.customQuestions || []).map((q) => {
    if (isTargetQuestion(q)) {
      return {
        ...q,
        chapterId: targetChapterId,
        topicId: targetTopicId,
        ...(targetSubjectId ? { subjectId: targetSubjectId } : {}),
        updatedAt: nowIso,
      };
    }
    return q;
  });

  // 2. Update cloudCacheQuestions directly for instant local responsiveness
  const newCloudCache = (store.cloudCacheQuestions || []).map((q) => {
    if (isTargetQuestion(q)) {
      return {
        ...q,
        chapterId: targetChapterId,
        topicId: targetTopicId,
        ...(targetSubjectId ? { subjectId: targetSubjectId } : {}),
        updatedAt: nowIso,
      };
    }
    return q;
  });

  // 3. Record/update in editedQuestions for any base or custom question
  const newEdited = { ...(store.editedQuestions || {}) };
  questionIds.forEach((id) => {
    const existing = newEdited[id] || allCombinedQuestionsMap[id];
    if (existing) {
      newEdited[id] = {
        ...existing,
        chapterId: targetChapterId,
        topicId: targetTopicId,
        ...(targetSubjectId ? { subjectId: targetSubjectId } : {}),
        updatedAt: nowIso,
      };
    }
  });

  // 4. Update customChapters and their embedded topics
  const movedQuestionsObjects = questionIds
    .map((id) => {
      const orig = allCombinedQuestionsMap[id];
      if (!orig) return null;
      return {
        ...orig,
        chapterId: targetChapterId,
        topicId: targetTopicId,
        ...(targetSubjectId ? { subjectId: targetSubjectId } : {}),
        updatedAt: nowIso,
      } as Question;
    })
    .filter((q): q is Question => q !== null);

  const newCustomChapters = (store.customChapters || []).map((ch) => {
    const updatedTopics = (ch.topics || []).map((t) => {
      if (t.id === targetTopicId) {
        // Destination topic: remove duplicates and append moved questions
        const remaining = (t.questions || []).filter((q) => !isTargetQuestion(q));
        const combined = [...remaining, ...movedQuestionsObjects];
        const deduped = deduplicateQuestions(combined);
        return {
          ...t,
          questions: deduped,
          questionCount: deduped.length,
        };
      } else {
        // Any other topic (including source topic): remove moved questions
        const remaining = (t.questions || []).filter((q) => !isTargetQuestion(q));
        return {
          ...t,
          questions: remaining,
          questionCount: remaining.length,
        };
      }
    });
    return {
      ...ch,
      topics: updatedTopics,
    };
  });

  // 5. Update customTopics
  const newCustomTopics = (store.customTopics || []).map((t) => {
    if (t.id === targetTopicId) {
      const remaining = (t.questions || []).filter((q) => !isTargetQuestion(q));
      const combined = [...remaining, ...movedQuestionsObjects];
      const deduped = deduplicateQuestions(combined);
      return {
        ...t,
        chapterId: targetChapterId,
        questions: deduped,
        questionCount: deduped.length,
      };
    } else {
      const remaining = (t.questions || []).filter((q) => !isTargetQuestion(q));
      return {
        ...t,
        questions: remaining,
        questionCount: remaining.length,
      };
    }
  });

  // 6. Invalidate caches asynchronously (localStorage, localforage questionBankStore, localDatabaseEngine, question_bundles)
  const sourceTopicIds = Array.from(
    new Set(questionIds.map((id) => allCombinedQuestionsMap[id]?.topicId).filter(Boolean))
  ) as string[];

  try {
    if (typeof localStorage !== "undefined") {
      localStorage.removeItem(`disha2020_mcqs_${targetTopicId}`);
      localStorage.removeItem("disha2020_mcqs_all");
      localStorage.removeItem(`quizpro_mcqs_${targetTopicId}`);
      localStorage.removeItem("quizpro_mcqs_all");
      sourceTopicIds.forEach((tId) => {
        localStorage.removeItem(`disha2020_mcqs_${tId}`);
        localStorage.removeItem(`quizpro_mcqs_${tId}`);
      });
      questionIds.forEach((id) => {
        const q = allCombinedQuestionsMap[id];
        if (q?.topicId) {
          localStorage.removeItem(`disha2020_mcqs_${q.topicId}`);
          localStorage.removeItem(`quizpro_mcqs_${q.topicId}`);
        }
      });
    }
  } catch {}

  try {
    import("./questionBankCache").then(({ removeQuestionsFromCache, saveQuestionsToCache }) => {
      removeQuestionsFromCache(questionIds, sourceTopicIds).catch(() => {});
      if (movedQuestionsObjects.length > 0) {
        saveQuestionsToCache(movedQuestionsObjects, {
          topicId: targetTopicId,
          chapterId: targetChapterId,
          subjectId: targetSubjectId,
          source: "user",
        }).catch(() => {});
      }
    }).catch(() => {});
  } catch {}

  try {
    import("./localDatabaseEngine").then(({ saveLocalMCQs }) => {
      if (movedQuestionsObjects.length > 0) {
        saveLocalMCQs(movedQuestionsObjects).catch(() => {});
      }
    }).catch(() => {});
  } catch {}

  try {
    import("./indexedDbCache").then(({ getCachedQuestionBundle, saveCachedQuestionBundle, deleteCachedQuestionBundle }) => {
      sourceTopicIds.forEach((sId) => {
        getCachedQuestionBundle(sId).then((existingBundle) => {
          if (existingBundle && existingBundle.length > 0) {
            const filtered = existingBundle.filter(
              (q) => !idsSet.has(q.id) && !movedTextsSet.has((q.text || (q as any).question || "").trim().toLowerCase())
            );
            saveCachedQuestionBundle(sId, filtered).catch(() => {});
          }
        }).catch(() => {});
      });
      deleteCachedQuestionBundle(targetTopicId).catch(() => {});
    }).catch(() => {});
  } catch {}

  return {
    ...store,
    customChapters: newCustomChapters,
    customTopics: newCustomTopics,
    customQuestions: newCustom,
    cloudCacheQuestions: newCloudCache,
    editedQuestions: newEdited,
  };
}

export interface ReconciledCurriculumTotals {
  totalSubjects: number;
  totalChapters: number;
  totalTopics: number;
  totalQuestions: number;
}

/**
 * Standardized, authoritative curriculum counting service.
 * Reconciles subject, chapter, topic, and MCQ totals directly from active merged syllabus state.
 */
export function getReconciledCurriculumCounts(store?: UserQuestionsStore): ReconciledCurriculumTotals {
  const effectiveStore = store || loadUserQuestionsStore();
  const subjects = getCombinedSubjects(effectiveStore);
  const chapters = getCombinedChapters(effectiveStore);
  const questions = getCombinedQuestions(chapters, effectiveStore);
  const topics = chapters.flatMap((c) => c.topics || []);

  return {
    totalSubjects: subjects.length,
    totalChapters: chapters.length,
    totalTopics: topics.length,
    totalQuestions: questions.length,
  };
}

/**
 * Subject-level question count helper.
 * Computes distinct, valid questions belonging to a specific subject.
 */
export function getSubjectQuestionsCount(subjectId: string, store?: UserQuestionsStore): number {
  if (!subjectId) return 0;
  const effectiveStore = store || loadUserQuestionsStore();
  const sNorm = (subjectId || "").toLowerCase().replace(/[-_]/g, "").trim();

  // Find subject definition to match by slug or alias if applicable
  const subjects = getCombinedSubjects(effectiveStore);
  const targetSubject = subjects.find(
    (s) => (s.id || "").toLowerCase().replace(/[-_]/g, "").trim() === sNorm ||
           (s.slug && (s.slug || "").toLowerCase().replace(/[-_]/g, "").trim() === sNorm)
  );
  const sSlugNorm = targetSubject?.slug ? (targetSubject.slug || "").toLowerCase().replace(/[-_]/g, "").trim() : "";

  // 1. Get chapters belonging to this subject
  const chapters = getCombinedChapters(effectiveStore);
  const subjectChapters = chapters.filter((c) => {
    const cSubNorm = (c.subjectId || "").toLowerCase().replace(/[-_]/g, "").trim();
    return cSubNorm === sNorm || (sSlugNorm && cSubNorm === sSlugNorm);
  });

  const subjectChapterIds = new Set(subjectChapters.map((c) => c.id));
  const subjectTopicIds = new Set(
    subjectChapters.flatMap((c) => (c.topics || []).map((t) => t.id))
  );

  // Also include customTopics associated with this subject
  (effectiveStore.customTopics || []).forEach((t) => {
    const tSubNorm = (t.subjectId || "").toLowerCase().replace(/[-_]/g, "").trim();
    if (
      tSubNorm === sNorm ||
      (sSlugNorm && tSubNorm === sSlugNorm) ||
      (t.chapterId && subjectChapterIds.has(t.chapterId))
    ) {
      subjectTopicIds.add(t.id);
    }
  });

  const isCompleteQ = (q: any): boolean =>
    Boolean(q && (q.text || q.question) && Array.isArray(q.options) && q.options.length >= 2);

  const deletedSet = new Set(effectiveStore.deletedQuestionIds || []);
  const questionMap = new Map<string, Question>();
  let unloadedTopicsMetadataCount = 0;

  // Questions from subject chapters/topics in canonical deduplicated hierarchy
  subjectChapters.forEach((ch) => {
    let chSum = 0;
    (ch.topics || []).forEach((top) => {
      let topValid = 0;
      (top.questions || []).forEach((q) => {
        if (q && q.id && !deletedSet.has(q.id) && isCompleteQ(q)) {
          questionMap.set(q.id, q);
          topValid++;
        }
      });
      if (topValid === 0 && typeof top.questionCount === "number" && top.questionCount > 0) {
        unloadedTopicsMetadataCount += top.questionCount;
        chSum += top.questionCount;
      } else {
        chSum += topValid;
      }
    });
    if (chSum === 0 && typeof ch.questionCount === "number" && ch.questionCount > 0) {
      unloadedTopicsMetadataCount += ch.questionCount;
    }
  });

  const computedTotal = questionMap.size + unloadedTopicsMetadataCount;
  if (computedTotal > 0) {
    return computedTotal;
  }

  if (targetSubject && typeof targetSubject.questionCount === "number" && targetSubject.questionCount > 0) {
    return targetSubject.questionCount;
  }

  return 0;
}

/**
 * Chapter-level question count helper.
 * Strictly derives from unified getCombinedChapters hierarchy to ensure parent-child consistency.
 */
export function getChapterDisplayCount(chapterId: string, store?: UserQuestionsStore): number {
  if (!chapterId) return 0;
  const effectiveStore = store || loadUserQuestionsStore();
  const chapters = getCombinedChapters(effectiveStore);
  const chapter = chapters.find((ch) => ch.id === chapterId);
  if (!chapter) return 0;

  const isCompleteQ = (q: any): boolean =>
    Boolean(q && (q.text || q.question) && Array.isArray(q.options) && q.options.length >= 2);
  const deletedSet = new Set(effectiveStore.deletedQuestionIds || []);

  const questionMap = new Map<string, Question>();
  let unloadedMetadataCount = 0;
  (chapter.topics || []).forEach((top) => {
    let topValid = 0;
    (top.questions || []).forEach((q) => {
      if (q && q.id && !deletedSet.has(q.id) && isCompleteQ(q)) {
        questionMap.set(q.id, q);
        topValid++;
      }
    });
    if (topValid === 0 && typeof top.questionCount === "number" && top.questionCount > 0) {
      unloadedMetadataCount += top.questionCount;
    }
  });

  const total = questionMap.size + unloadedMetadataCount;
  if (total > 0) return total;
  return typeof chapter.questionCount === "number" && chapter.questionCount > 0 ? chapter.questionCount : 0;
}

/**
 * Topic-level question count helper.
 * Strictly derives from unified getCombinedChapters hierarchy to ensure parent-child consistency.
 */
export function getTopicQuestionsCount(topicId: string, store?: UserQuestionsStore): number {
  if (!topicId) return 0;
  const effectiveStore = store || loadUserQuestionsStore();
  const chapters = getCombinedChapters(effectiveStore);
  const isCompleteQ = (q: any): boolean =>
    Boolean(q && (q.text || q.question) && Array.isArray(q.options) && q.options.length >= 2);
  const deletedSet = new Set(effectiveStore.deletedQuestionIds || []);

  for (const ch of chapters) {
    const topic = ch.topics.find((t) => t.id === topicId);
    if (topic) {
      const validLen = Array.isArray(topic.questions)
        ? topic.questions.filter((q) => !deletedSet.has(q.id) && isCompleteQ(q)).length
        : 0;
      if (validLen > 0) return validLen;
      if (typeof topic.questionCount === "number" && topic.questionCount > 0) {
        return topic.questionCount;
      }
    }
  }

  // Fallback to checking store directly if not in chapter topics
  const allStoreCandidates = [
    ...(effectiveStore.customQuestions || []),
    ...(effectiveStore.cloudCacheQuestions || []),
  ];
  const matching = allStoreCandidates.filter(
    (q) => q && q.topicId === topicId && !deletedSet.has(q.id) && isCompleteQ(q)
  );
  return deduplicateQuestions(matching).length;
}

/**
 * Calculate dynamic total questions count directly from reconciled syllabus.
 */
export function getTotalDisplayCount(store?: UserQuestionsStore): number {
  return getReconciledCurriculumCounts(store).totalQuestions;
}

// Helper to add chapter
export function addChapter(store: UserQuestionsStore, chapter: Chapter): UserQuestionsStore {
  const normTitle = (chapter.title || (chapter as any).name || "").trim();
  const normHindi = (chapter.hindiTitle || normTitle).trim();
  const harmonizedChapter: Chapter = {
    ...chapter,
    title: normTitle || normHindi || "Untitled Chapter",
    hindiTitle: normHindi || normTitle || "Untitled Chapter",
    isUserAdded: true,
  };

  const cleanDeleted = (store.deletedChapterIds || []).filter(id => id !== chapter.id);
  const remaining = (store.customChapters || []).filter(c => c.id !== chapter.id);

  const updatedStore: UserQuestionsStore = {
    ...store,
    customChapters: [...remaining, harmonizedChapter],
    deletedChapterIds: cleanDeleted,
  };

  saveCachedCurriculum(
    updatedStore.customSubjects || [],
    updatedStore.customChapters || [],
    updatedStore.customTopics || []
  ).catch(() => {});

  return updatedStore;
}

// Helper to mark chapter for deletion
export function deleteChapter(store: UserQuestionsStore, chapterId: string): UserQuestionsStore {
  const newDeleted = new Set(store.deletedChapterIds || []);
  newDeleted.add(chapterId);

  const remainingChapters = (store.customChapters || []).filter(c => c.id !== chapterId);
  const remainingTopics = (store.customTopics || []).filter(t => t.chapterId !== chapterId);

  const newEditedChapters = { ...(store.editedChapters || {}) };
  delete newEditedChapters[chapterId];

  const newCustomQuestions = (store.customQuestions || []).filter(q => q.chapterId !== chapterId);
  const newCloudCacheQuestions = (store.cloudCacheQuestions || []).filter(q => q.chapterId !== chapterId);

  const updatedStore: UserQuestionsStore = {
    ...store,
    customChapters: remainingChapters,
    customTopics: remainingTopics,
    customQuestions: newCustomQuestions,
    cloudCacheQuestions: newCloudCacheQuestions,
    editedChapters: newEditedChapters,
    deletedChapterIds: Array.from(newDeleted),
  };

  saveCachedCurriculum(
    updatedStore.customSubjects || [],
    updatedStore.customChapters || [],
    updatedStore.customTopics || []
  ).catch(() => {});

  return updatedStore;
}

// Helper to edit chapter
export function editChapter(store: UserQuestionsStore, chapter: Chapter): UserQuestionsStore {
  const normTitle = (chapter.title || (chapter as any).name || "").trim();
  const normHindi = (chapter.hindiTitle || "").trim();
  const harmonizedChapter: Chapter = {
    ...chapter,
    title: normTitle || normHindi || "Untitled Chapter",
    hindiTitle: normHindi || normTitle || "Untitled Chapter",
  };

  const newEdited = { ...(store.editedChapters || {}) };
  newEdited[chapter.id] = harmonizedChapter;

  let found = false;
  const nextCustomChapters = (store.customChapters || []).map((c) => {
    if (c.id === chapter.id) {
      found = true;
      return { ...c, ...harmonizedChapter };
    }
    return c;
  });
  if (!found) {
    nextCustomChapters.push(harmonizedChapter);
  }

  const updatedStore: UserQuestionsStore = {
    ...store,
    customChapters: nextCustomChapters,
    editedChapters: newEdited,
  };

  saveCachedCurriculum(
    updatedStore.customSubjects || [],
    updatedStore.customChapters || [],
    updatedStore.customTopics || []
  ).catch(() => {});

  return updatedStore;
}

// Helper to mark topic for deletion
export function deleteTopic(store: UserQuestionsStore, topicId: string): UserQuestionsStore {
  const newDeleted = new Set(store.deletedTopicIds || []);
  newDeleted.add(topicId);

  const remainingTopics = (store.customTopics || []).filter(t => t.id !== topicId);

  // Also clean the topic from within each custom chapter's topics array
  const updatedChapters = (store.customChapters || []).map(ch => ({
    ...ch,
    topics: (ch.topics || []).filter(t => t.id !== topicId)
  }));

  const newEditedTopics = { ...(store.editedTopics || {}) };
  delete newEditedTopics[topicId];

  const newCustomQuestions = (store.customQuestions || []).filter(q => q.topicId !== topicId);
  const newCloudCacheQuestions = (store.cloudCacheQuestions || []).filter(q => q.topicId !== topicId);

  const updatedStore: UserQuestionsStore = {
    ...store,
    customChapters: updatedChapters,
    customTopics: remainingTopics,
    customQuestions: newCustomQuestions,
    cloudCacheQuestions: newCloudCacheQuestions,
    editedTopics: newEditedTopics,
    deletedTopicIds: Array.from(newDeleted),
  };

  saveCachedCurriculum(
    updatedStore.customSubjects || [],
    updatedStore.customChapters || [],
    updatedStore.customTopics || []
  ).catch(() => {});

  return updatedStore;
}

// Helper to add topic
export function addTopic(
  store: UserQuestionsStore, 
  topic: Topic, 
  chapterId?: string
): UserQuestionsStore {
  const targetChapterId = chapterId || topic.chapterId;
  const normTitle = (topic.title || (topic as any).name || "").trim();
  const normHindi = (topic.hindiTitle || (topic as any).hindi_name || normTitle).trim();

  // Find parent chapter to resolve subjectId and ordering
  const combinedChaps = getCombinedChapters(store);
  const parentChapter = combinedChaps.find(c => c.id === targetChapterId) ||
                        (store.customChapters || []).find(c => c.id === targetChapterId);

  const resolvedSubjectId = topic.subjectId || parentChapter?.subjectId || "economics";
  const existingTopicsInChapter = parentChapter?.topics || [];
  const assignedNumber = topic.number || (existingTopicsInChapter.length + 1);

  const harmonizedTopic: Topic = {
    ...topic,
    id: topic.id,
    chapterId: targetChapterId,
    subjectId: resolvedSubjectId,
    title: normTitle || "Untitled Topic",
    hindiTitle: normHindi || normTitle || "Untitled Topic",
    number: assignedNumber,
    isUserAdded: true,
    questions: Array.isArray(topic.questions) ? topic.questions : [],
  };

  // Clean from deletedTopicIds if present
  const cleanDeleted = (store.deletedTopicIds || []).filter(id => id !== topic.id);

  // Clean from editedTopics if present
  const newEdited = { ...(store.editedTopics || {}) };
  delete newEdited[topic.id];

  // Update customTopics list
  const currentCustomTopics = (store.customTopics || []).filter(t => t.id !== topic.id);
  const nextCustomTopics = [...currentCustomTopics, harmonizedTopic];

  // Update customChapters:
  let chapterFoundInCustom = false;
  let nextCustomChapters = (store.customChapters || []).map(ch => {
    if (ch.id === targetChapterId) {
      chapterFoundInCustom = true;
      const filteredTopics = (ch.topics || []).filter(t => t.id !== topic.id);
      return {
        ...ch,
        topics: [...filteredTopics, harmonizedTopic],
      };
    }
    return ch;
  });

  if (!chapterFoundInCustom && parentChapter) {
    const filteredTopics = (parentChapter.topics || []).filter(t => t.id !== topic.id);
    const newCustomChapter: Chapter = {
      ...parentChapter,
      topics: [...filteredTopics, harmonizedTopic],
      isUserAdded: true,
    };
    nextCustomChapters.push(newCustomChapter);
  }

  const updatedStore: UserQuestionsStore = {
    ...store,
    customChapters: nextCustomChapters,
    customTopics: nextCustomTopics,
    deletedTopicIds: cleanDeleted,
    editedTopics: newEdited,
  };

  saveCachedCurriculum(
    updatedStore.customSubjects || [],
    updatedStore.customChapters || [],
    updatedStore.customTopics || []
  ).catch(() => {});

  return updatedStore;
}

// Helper to edit topic
export function editTopic(store: UserQuestionsStore, topic: Topic): UserQuestionsStore {
  const normTitle = (topic.title || (topic as any).name || "").trim();
  const normHindi = (topic.hindiTitle || "").trim();
  const harmonizedTopic: Topic = {
    ...topic,
    title: normTitle || normHindi || "Untitled Topic",
    hindiTitle: normHindi || normTitle || "Untitled Topic",
  };

  const newEdited = { ...(store.editedTopics || {}) };
  newEdited[topic.id] = harmonizedTopic;

  let found = false;
  const nextCustomTopics = (store.customTopics || []).map((t) => {
    if (t.id === topic.id) {
      found = true;
      return { ...t, ...harmonizedTopic };
    }
    return t;
  });
  if (!found) {
    nextCustomTopics.push(harmonizedTopic);
  }

  // Also update topic inside each customChapter's topics array
  const updatedChapters = (store.customChapters || []).map((ch) => {
    if (ch.topics && ch.topics.some((t) => t.id === topic.id)) {
      return {
        ...ch,
        topics: ch.topics.map((t) => (t.id === topic.id ? { ...t, ...harmonizedTopic } : t)),
      };
    }
    return ch;
  });

  const updatedStore: UserQuestionsStore = {
    ...store,
    customChapters: updatedChapters,
    customTopics: nextCustomTopics,
    editedTopics: newEdited,
  };

  saveCachedCurriculum(
    updatedStore.customSubjects || [],
    updatedStore.customChapters || [],
    updatedStore.customTopics || []
  ).catch(() => {});

  return updatedStore;
}

// Helper to edit question in store
export function editQuestionInStore(store: UserQuestionsStore, updatedQuestion: Question): UserQuestionsStore {
  const nowIso = new Date().toISOString();
  const qWithTimestamp: Question = {
    ...updatedQuestion,
    updatedAt: nowIso,
  };

  const newEdited = {
    ...(store.editedQuestions || {}),
    [updatedQuestion.id]: qWithTimestamp,
  };

  // 1. Update in cloudCacheQuestions
  let foundInCache = false;
  const nextCloudCache = (store.cloudCacheQuestions || []).map((q) => {
    if (q.id === updatedQuestion.id) {
      foundInCache = true;
      return { ...q, ...qWithTimestamp };
    }
    return q;
  });
  if (!foundInCache) {
    nextCloudCache.push(qWithTimestamp);
  }

  // 2. Update in customQuestions
  const nextCustom = (store.customQuestions || []).map((q) => {
    if (q.id === updatedQuestion.id) {
      return { ...q, ...qWithTimestamp };
    }
    return q;
  });

  // 3. Update in customChapters topics
  const nextChapters = (store.customChapters || []).map((ch) => ({
    ...ch,
    topics: (ch.topics || []).map((top) => ({
      ...top,
      questions: (top.questions || []).map((q) => (q.id === updatedQuestion.id ? { ...q, ...qWithTimestamp } : q)),
    })),
  }));

  // Invalidate individual topic cache
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.removeItem(`disha2020_mcqs_${updatedQuestion.topicId}`);
      localStorage.removeItem("disha2020_mcqs_all");
      localStorage.setItem(`disha2020_mcq_${updatedQuestion.id}`, JSON.stringify(qWithTimestamp));
      localStorage.removeItem(`quizpro_mcqs_${updatedQuestion.topicId}`);
      localStorage.removeItem("quizpro_mcqs_all");
      localStorage.setItem(`quizpro_mcq_${updatedQuestion.id}`, JSON.stringify(qWithTimestamp));
    }
  } catch {}

  const updatedStore: UserQuestionsStore = {
    ...store,
    cloudCacheQuestions: nextCloudCache,
    customQuestions: nextCustom,
    customChapters: nextChapters,
    editedQuestions: newEdited,
  };

  return updatedStore;
}

/* ============================================================================
 * PARTIAL HYDRATION & ON-DEMAND FETCHING ARCHITECTURE
 * ============================================================================
 */

export interface EssentialSyllabusMetadata {
  subjectIds: string[];
  chapterIds: string[];
  topicIds: string[];
  customSubjects: Subject[];
  customChapters: Chapter[];
  customTopics: Topic[];
  deletedSubjectIds: string[];
  deletedChapterIds: string[];
  deletedTopicIds: string[];
  deletedQuestionIds: string[];
  totalQuestionStubsCount: number;
}

/**
 * Partial Hydration: Loads ONLY essential syllabus structure (Subject, Chapter, Topic IDs and custom items)
 * from localStorage at startup without parsing or holding heavy question texts, options, or explanations.
 */
export function loadEssentialSyllabusMetadata(): EssentialSyllabusMetadata {
  const store = loadUserQuestionsStore();
  const subjects = getCombinedSubjects(store);
  const chapters = getCombinedChapters(store);

  const subjectIds = subjects.map((s) => s.id);
  const chapterIds = chapters.map((c) => c.id);
  const topicIds = chapters.flatMap((c) => (c.topics || []).map((t) => t.id));

  const totalQuestionStubsCount = 
    (store.customQuestions?.length || 0) + 
    (store.cloudCacheQuestions?.length || 0);

  return {
    subjectIds,
    chapterIds,
    topicIds,
    customSubjects: store.customSubjects || [],
    customChapters: store.customChapters || [],
    customTopics: store.customTopics || [],
    deletedSubjectIds: store.deletedSubjectIds || [],
    deletedChapterIds: store.deletedChapterIds || [],
    deletedTopicIds: store.deletedTopicIds || [],
    deletedQuestionIds: store.deletedQuestionIds || [],
    totalQuestionStubsCount,
  };
}

/**
 * Asynchronously fetches and hydrates full question details for a specific topic on-demand.
 * Checks IndexedDB bundle cache first, falling back to Supabase if needed.
 */
export async function fetchTopicQuestionsOnDemand(topicId: string): Promise<Question[]> {
  if (!topicId) return [];

  // 1. Check in-memory store
  const store = loadUserQuestionsStore();
  const deletedSet = new Set(store.deletedQuestionIds || []);
  const inMemory = [...(store.customQuestions || []), ...(store.cloudCacheQuestions || [])].filter(
    (q) => q && q.topicId === topicId && !deletedSet.has(q.id) && (q.text || (q as any).question)
  );

  if (inMemory.length > 0) {
    return deduplicateQuestions(inMemory);
  }

  // 2. Check localforage IndexedDB question bank cache (<10ms, offline-ready)
  try {
    const { getCachedQuestionsByTopic } = await import("./questionBankCache");
    const idbCached = await getCachedQuestionsByTopic(topicId);
    if (idbCached && idbCached.length > 0) {
      mergeQuestionsIntoStore(idbCached);
      return idbCached;
    }
  } catch (e) {
    console.warn("localforage IndexedDB topic question fetch fallback:", e);
  }

  // 3. Check legacy IndexedDB topic bundle cache (<15ms)
  try {
    const cached = await getCachedQuestionBundle(topicId);
    if (cached && cached.length > 0) {
      mergeQuestionsIntoStore(cached);
      return cached;
    }
  } catch (e) {
    console.warn("IndexedDB topic question fetch fallback:", e);
  }

  // 4. Check Supabase (quota-free PostgreSQL)
  try {
    const { isSupabaseConfigured } = await import("../lib/supabase");
    if (isSupabaseConfigured()) {
      const { fetchQuestionsByTopic } = await import("./supabaseSyncService");
      const supabaseQs = await fetchQuestionsByTopic(topicId);
      if (supabaseQs && supabaseQs.length > 0) {
        mergeQuestionsIntoStore(supabaseQs);
        saveCachedQuestionBundle(topicId, supabaseQs).catch(() => {});
        return supabaseQs;
      }
    }
  } catch (e) {
    console.warn("Supabase topic question fetch fallback:", e);
  }

  return [];
}

/**
 * Asynchronously fetches and hydrates full question details for all topics within a chapter on-demand.
 * High-performance: Fetches all questions for the chapter in a single indexed query, eliminating N+1 topic query loops.
 */
export async function fetchChapterQuestionsOnDemand(chapterId: string): Promise<Question[]> {
  if (!chapterId) return [];

  // 1. First attempt high-speed single-query indexed fetch from Supabase/IDB
  try {
    const { fetchQuestionsByChapter } = await import("./supabaseSyncService");
    const chapterQs = await fetchQuestionsByChapter(chapterId);
    if (chapterQs && chapterQs.length > 0) {
      return deduplicateQuestions(chapterQs);
    }
  } catch (e) {
    console.warn("[questionsStorage] fetchQuestionsByChapter fallback to topics:", e);
  }

  // 2. Fallback to topic-by-topic aggregation if chapter query returns empty
  const store = loadUserQuestionsStore();
  const chapters = getCombinedChapters(store);
  const targetChapter = chapters.find((ch) => ch.id === chapterId);
  if (!targetChapter) return [];

  const topicIds = (targetChapter.topics || []).map((t) => t.id);
  const results = await Promise.all(topicIds.map((tid) => fetchTopicQuestionsOnDemand(tid)));
  const allQs = results.flat();
  return deduplicateQuestions(allQs);
}

