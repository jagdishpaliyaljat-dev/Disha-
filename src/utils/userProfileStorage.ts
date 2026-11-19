import type { UserProfile } from "../types";
import {
  safeGetLocalStorageItem,
  safeSetLocalStorageItem,
  safeRemoveLocalStorageItem,
} from "./safeStorage";

const USER_PROFILE_KEY = "economic_survey_user_profile_v1";

export const ADMIN_EMAILS = [
  "jagdishpaliyaljat@gmail.com",
  "jagdishpaliyaljat2003@gmail.com",
  "zdpaliyal@gmail.com",
  "kamleshchoudhary96022@gmail.com",
  "disha2020prep@gmail.com",
];

export const ADMIN_UIDS: string[] = [
  "9a821db5-5257-42b2-af8a-7f9369b7937f",
  "62971883-2873-4134-852d-8fe17b22c0a7",
];

export const DEFAULT_USER_PROFILE: UserProfile = {
  id: "student_default",
  name: "Student",
  email: "",
  role: "student",
  targetExam: "Competitive Exams & General Studies",
  dailyGoalQuestions: 30,
  streakDays: 0,
  createdAt: new Date().toISOString(),
};

let inMemoryProfile: UserProfile | null = null;

export function setInMemoryProfile(profile: UserProfile | null): void {
  inMemoryProfile = profile;
}

export function isSuperAdmin(profileOrIdentifier?: UserProfile | string | null): boolean {
  if (!profileOrIdentifier) return false;
  const normalize = (s: string) => s.trim().toLowerCase();
  if (typeof profileOrIdentifier === "string") {
    const cleaned = normalize(profileOrIdentifier);
    return (
      ADMIN_EMAILS.some((e) => normalize(e) === cleaned) ||
      ADMIN_UIDS.includes(profileOrIdentifier)
    );
  }
  const email = profileOrIdentifier.email ? normalize(profileOrIdentifier.email) : "";
  if (email && ADMIN_EMAILS.some((e) => normalize(e) === email)) return true;
  if (profileOrIdentifier.id && ADMIN_UIDS.includes(profileOrIdentifier.id)) return true;
  return false;
}

export function loadUserProfile(): UserProfile | null {
  try {
    const raw = safeGetLocalStorageItem(USER_PROFILE_KEY);
    if (!raw) {
      return inMemoryProfile;
    }
    const parsed = JSON.parse(raw);
    const profile = {
      ...DEFAULT_USER_PROFILE,
      ...parsed,
    };
    
    // Check super admins or persistent admin role
    const isActuallyAdmin = Boolean(
      isSuperAdmin(profile) ||
      parsed.role === "admin"
    );
    
    if (isActuallyAdmin) {
      profile.role = "admin";
    } else {
      profile.role = "student";
    }
    
    return profile;
  } catch (err) {
    console.error("Failed to load user profile", err);
    return inMemoryProfile;
  }
}

export function saveUserProfile(profile: UserProfile): void {
  const isActuallyAdmin = Boolean(
    isSuperAdmin(profile) ||
    profile.role === "admin"
  );
  
  if (isActuallyAdmin) {
    profile.role = "admin";
  } else {
    profile.role = "student";
  }

  inMemoryProfile = profile;
  try {
    safeSetLocalStorageItem(USER_PROFILE_KEY, JSON.stringify(profile));
  } catch (err) {
    console.error("Failed to save user profile", err);
  }
}

export function clearUserProfile(): void {
  inMemoryProfile = null;
  try {
    safeRemoveLocalStorageItem(USER_PROFILE_KEY);
  } catch (err) {
    console.error("Failed to clear user profile", err);
  }
}

export function isUserAdmin(profileOrRole?: UserProfile | string | null): boolean {
  if (!profileOrRole) return false;
  const normalize = (s: string) => s.trim().toLowerCase();

  // 1. If passed a string (email or UID or "admin")
  if (typeof profileOrRole === "string") {
    const cleaned = normalize(profileOrRole);
    if (cleaned === "admin") return true;
    if (isSuperAdmin(cleaned)) return true;
    
    // Check if stored local profile matches
    try {
      const stored = loadUserProfile();
      if (stored?.role === "admin") {
        if (stored.email && normalize(stored.email) === cleaned) return true;
        if (stored.id === profileOrRole) return true;
      }
    } catch {}
    return false;
  }

  // 2. Handle UserProfile object
  if (profileOrRole && typeof profileOrRole === "object") {
    if (isSuperAdmin(profileOrRole)) return true;
    if (profileOrRole.role === "admin") return true;
    return false;
  }

  // 3. Fallback: check stored local profile
  try {
    const stored = loadUserProfile();
    if (stored && (isSuperAdmin(stored) || stored.role === "admin")) return true;
  } catch {}

  return false;
}

export function isAdmin(profileOrRole?: UserProfile | string | null): boolean {
  return isUserAdmin(profileOrRole);
}



