import { auth, db, isFirebaseConfigured } from "../lib/firebase";
import { Attempt, UserProfile } from "../types";
import { guardedSetDoc, guardedWriteBatch } from "./quotaTracker";
import { doc } from "firebase/firestore";
import { loadUserProfile } from "./userProfileStorage";

const GUEST_ATTEMPTS_KEY = "quizpro_guest_attempts_v1";
const GUEST_PROGRESS_KEY = "quizpro_guest_progress_v1";
const GUEST_HISTORY_KEY = "quizpro_guest_history_v1";

/**
 * Check if the current active session is a Guest / Unregistered user
 */
export function isGuestSession(profile?: UserProfile | null): boolean {
  const currentProfile = profile || loadUserProfile();
  
  // 1. If Firebase Auth is not signed in
  if (!auth.currentUser) return true;

  // 2. If Firebase Auth is an anonymous user
  if (auth.currentUser.isAnonymous) return true;

  // 3. If local profile is default student without an email
  if (!currentProfile || !currentProfile.email || currentProfile.id === "student_default") {
    return true;
  }

  return false;
}

/**
 * Save Guest Attempt strictly into Local Storage (0 Cloud Writes)
 */
export function saveGuestAttemptLocally(attempt: Attempt): void {
  try {
    const raw = localStorage.getItem(GUEST_ATTEMPTS_KEY);
    const list: Attempt[] = raw ? JSON.parse(raw) : [];
    
    // Deduplicate by attemptId/id
    const attemptId = attempt.attemptId || attempt.id || `att_${Date.now()}`;
    const normalized = { ...attempt, attemptId, id: attemptId, isGuest: true };
    
    const existingIndex = list.findIndex(a => (a.attemptId || a.id) === attemptId);
    if (existingIndex >= 0) {
      list[existingIndex] = normalized;
    } else {
      list.unshift(normalized);
    }

    // Keep up to 100 most recent guest attempts locally
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
    const raw = localStorage.getItem(GUEST_ATTEMPTS_KEY);
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
    const raw = localStorage.getItem(GUEST_PROGRESS_KEY);
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
    const raw = localStorage.getItem(GUEST_PROGRESS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

/**
 * MIGRATION ENGINE:
 * When a guest registers or signs in with an account, seamlessly transfer
 * all local guest attempts and question progress to their new Cloud account in 1 batch.
 */
export async function migrateGuestDataToCloudOnAuth(userId: string): Promise<{
  migratedAttempts: number;
  migratedProgress: number;
}> {
  if (!userId || userId === "student_default" || !isFirebaseConfigured() || !auth.currentUser) {
    return { migratedAttempts: 0, migratedProgress: 0 };
  }

  const localAttempts = getGuestAttemptsLocally();
  const localProgress = getGuestProgressLocally();

  let migratedAttempts = 0;
  let migratedProgress = 0;

  // 1. Sync Guest Attempts to Cloud in Batch
  if (localAttempts.length > 0) {
    try {
      const batch = guardedWriteBatch(db);
      for (const att of localAttempts.slice(0, 50)) {
        const attId = att.attemptId || att.id || `att_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
        const docRef = doc(db, "attempts", attId);
        batch.set(docRef, { ...att, userId, isGuest: false, migratedAt: new Date().toISOString() }, { merge: true });
        migratedAttempts++;
      }
      await batch.commit("Student", "Migrate Guest Attempts To Cloud");
      
      // Clear migrated local guest attempts
      localStorage.removeItem(GUEST_ATTEMPTS_KEY);
    } catch (e) {
      console.warn("Failed to migrate guest attempts to cloud:", e);
    }
  }

  // 2. Sync Guest Question Progress to Cloud in Batch
  const progressEntries = Object.entries(localProgress);
  if (progressEntries.length > 0) {
    try {
      const batch = guardedWriteBatch(db);
      for (const [qId, prog] of progressEntries.slice(0, 100)) {
        const docRef = doc(db, "users", userId, "progress", qId);
        batch.set(docRef, prog, { merge: true });
        migratedProgress++;
      }
      await batch.commit("Student", "Migrate Guest Progress To Cloud");
      
      // Clear migrated local guest progress
      localStorage.removeItem(GUEST_PROGRESS_KEY);
    } catch (e) {
      console.warn("Failed to migrate guest progress to cloud:", e);
    }
  }

  return { migratedAttempts, migratedProgress };
}
