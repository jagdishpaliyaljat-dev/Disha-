/**
 * Sample / Demo Data Loader for Testing Purpose
 * Populates local cache and provides demo data triggers for DISHA 20-20.
 */

import { supabase, isSupabaseConfigured } from "../lib/supabase";
import { saveUserQuestionsStore, loadUserQuestionsStore } from "./questionsStorage";

export async function reloadAppCurriculumFromCloud(): Promise<{ success: boolean; count: number; error?: string }> {
  try {
    if (!isSupabaseConfigured()) {
      return { success: false, count: 0, error: "Supabase is not configured." };
    }

    const { fetchFullAuthoritativeCurriculum } = await import("./supabaseSyncService");
    const curriculum = await fetchFullAuthoritativeCurriculum({ force: true });
    
    const existingStore = loadUserQuestionsStore();
    const nextStore = {
      ...existingStore,
      customSubjects: curriculum.subjects || [],
      customChapters: curriculum.chapters || [],
      customTopics: curriculum.topics || [],
      cloudCacheQuestions: curriculum.questions || [],
    };
    saveUserQuestionsStore(nextStore);

    return {
      success: true,
      count: (curriculum.questions || []).length,
    };
  } catch (err: any) {
    console.error("[sampleDataLoader] Error reloading curriculum:", err);
    return { success: false, count: 0, error: err?.message || String(err) };
  }
}
