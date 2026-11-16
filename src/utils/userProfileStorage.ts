import type { UserProfile } from "../types";

const USER_PROFILE_KEY = "economic_survey_user_profile_v1";

export const ADMIN_EMAILS = [
  "zdpaliyal@gmail.com",
  "jagdishpaliyaljat@gmail.com",
];

export const ADMIN_UIDS: string[] = [];

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

export function loadUserProfile(): UserProfile | null {
  try {
    if (typeof window === "undefined" || typeof localStorage === "undefined") {
      return inMemoryProfile;
    }
    const raw = localStorage.getItem(USER_PROFILE_KEY);
    if (!raw) {
      return inMemoryProfile;
    }
    const parsed = JSON.parse(raw);
    const profile = {
      ...DEFAULT_USER_PROFILE,
      ...parsed,
    };
    
    // Check hardcoded super admins
    const isActuallyAdmin = (profile.email && ADMIN_EMAILS.includes(profile.email.trim().toLowerCase())) || 
                            (profile.id && ADMIN_UIDS.includes(profile.id));
    
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
    (profile.email && ADMIN_EMAILS.includes(profile.email.trim().toLowerCase())) || 
    (profile.id && ADMIN_UIDS.includes(profile.id))
  );
  
  if (isActuallyAdmin) {
    profile.role = "admin";
  } else {
    profile.role = "student";
  }

  inMemoryProfile = profile;
  try {
    if (typeof window === "undefined" || typeof localStorage === "undefined") {
      return;
    }
    localStorage.setItem(USER_PROFILE_KEY, JSON.stringify(profile));
  } catch (err) {
    console.error("Failed to save user profile", err);
  }
}

export function isUserAdmin(profileOrRole?: UserProfile | string | null): boolean {
  const normalize = (s: string) => s.trim().toLowerCase();

  // 1. If passed a string (email or UID)
  if (typeof profileOrRole === "string") {
    const cleaned = normalize(profileOrRole);
    if (ADMIN_EMAILS.includes(cleaned)) return true;
    if (ADMIN_UIDS.includes(profileOrRole)) return true;
    return false;
  }

  // 2. Handle UserProfile object
  if (profileOrRole && typeof profileOrRole === "object") {
    const email = profileOrRole.email ? normalize(profileOrRole.email) : null;
    if (email && ADMIN_EMAILS.includes(email)) return true;
    if (profileOrRole.id && ADMIN_UIDS.includes(profileOrRole.id)) return true;
    return false;
  }

  // 3. Fallback: check stored local profile
  try {
    const stored = loadUserProfile();
    if (stored?.role === "admin") return true;
    if (stored?.email) {
      const email = normalize(stored.email);
      if (ADMIN_EMAILS.includes(email)) return true;
    }
    if (stored?.id && ADMIN_UIDS.includes(stored.id)) return true;
  } catch {}

  console.log("[Auth] User is not admin");
  return false;
}

export function isAdmin(profileOrRole?: UserProfile | string | null): boolean {
  return isUserAdmin(profileOrRole);
}


