import { supabase } from "../lib/supabase";
import { Attempt, UserProfile } from "../types";
import { loadUserProfile } from "./userProfileStorage";

const GUEST_ATTEMPTS_KEY = "disha2020_guest_attempts_v1";
const LEGACY_GUEST_ATTEMPTS_KEY = "quizpro_guest_attempts_v1";
const GUEST_PROGRESS_KEY = "disha2020_guest_progress_v1";
const LEGACY_GUEST_PROGRESS_KEY = "quizpro_guest_progress_v1";

/**
 * Check if the current active session is a Guest / Unregistered user
 */
export function isGuestSession(profile?: UserProfile | null): boolean {
  const currentProfile = profile || loadUserProfile();
  
  if (!currentProfile || !currentProfile.email || currentProfile.id === "student_default" || currentProfile.id === "guest") {
    return true;
  }

  return false;
}

/**
 * Save Guest Attempt strictly into Local Storage (0 Cloud Writes)
 */
export function saveGuestAttemptLocally(attempt: Attempt): void {
  try {
    const raw = localStorage.getItem(GUEST_ATTEMPTS_KEY) || localStorage.getItem(LEGACY_GUEST_ATTEMPTS_KEY);
    const list: Attempt[] = raw ? JSON.parse(raw) : [];
    
    const attemptId = attempt.attemptId || attempt.id || `att_${Date.now()}`;
    const normalized = { ...attempt, attemptId, id: attemptId, isGuest: true };
    
    const existingIndex = list.findIndex(a => (a.attemptId || a.id) === attemptId);
    if (existingIndex >= 0) {
      list[existingIndex] = normalized;
    } else {
      list.unshift(normalized);
    }

    const trimmed = list.slice(0, 100);
    localStorage.setItem(GUEST_ATTEMPTS_KEY, JSON.stringify(trimmed));
  } catch (err) {
    console.error("Failed to save guest attempt locally:", err);
  }
}

/**
 * Get all Guest Attempts stored locally
 */
export function getGuestAttemptsLocally(): Attempt[] {
  try {
    const raw = localStorage.getItem(GUEST_ATTEMPTS_KEY) || localStorage.getItem(LEGACY_GUEST_ATTEMPTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/**
 * Save Guest Progress (question stats) locally
 */
export function saveGuestProgressLocally(questionId: string, progress: any): void {
  try {
    const raw = localStorage.getItem(GUEST_PROGRESS_KEY) || localStorage.getItem(LEGACY_GUEST_PROGRESS_KEY);
    const store: Record<string, any> = raw ? JSON.parse(raw) : {};
    store[questionId] = { ...progress, updatedAt: new Date().toISOString() };
    localStorage.setItem(GUEST_PROGRESS_KEY, JSON.stringify(store));
  } catch (err) {
    console.error("Failed to save guest progress locally:", err);
  }
}

/**
 * Get Guest Progress stored locally
 */
export function getGuestProgressLocally(): Record<string, any> {
  try {
    const raw = localStorage.getItem(GUEST_PROGRESS_KEY) || localStorage.getItem(LEGACY_GUEST_PROGRESS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

/**
 * MIGRATION ENGINE:
 * When a guest registers or signs in with an account, seamlessly transfer
 * all local guest attempts to Supabase.
 */
export async function migrateGuestDataToCloudOnAuth(userId: string): Promise<{
  migratedAttempts: number;
  migratedProgress: number;
}> {
  if (!userId || userId === "student_default" || userId === "guest") {
    return { migratedAttempts: 0, migratedProgress: 0 };
  }

  const localAttempts = getGuestAttemptsLocally();
  const localProgress = getGuestProgressLocally();

  let migratedAttempts = 0;
  let migratedProgress = 0;

  if (localAttempts.length > 0) {
    try {
      const rows = localAttempts.slice(0, 50).map((att: any) => ({
        user_id: userId,
        question_id: att.questionId ?? att.question_id ?? null,
        selected_option: att.selectedOption ?? att.selected_option ?? null,
        is_correct: att.isCorrect ?? att.is_correct ?? false,
        time_spent: att.timeSpentSeconds || 0,
        created_at: att.timestamp || att.attemptedAt || new Date().toISOString(),
      })).filter((row) => Boolean(row.question_id));

      const { error } = await supabase.from("attempts").insert(rows);
      if (!error) {
        migratedAttempts = rows.length;
        localStorage.removeItem(GUEST_ATTEMPTS_KEY);
        localStorage.removeItem(LEGACY_GUEST_ATTEMPTS_KEY);
      }
    } catch (e) {
      console.warn("Failed to migrate guest attempts to Supabase:", e);
    }
  }

  if (Object.keys(localProgress).length > 0) {
    migratedProgress = Object.keys(localProgress).length;
    localStorage.removeItem(GUEST_PROGRESS_KEY);
    localStorage.removeItem(LEGACY_GUEST_PROGRESS_KEY);
  }

  return { migratedAttempts, migratedProgress };
}
