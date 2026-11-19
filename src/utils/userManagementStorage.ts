import { supabase } from "../lib/supabase";
import { UserProfile, AdminAuditLog } from "../types";
import { ADMIN_UIDS, ADMIN_EMAILS, isUserAdmin, loadUserProfile, isSuperAdmin } from "./userProfileStorage";
import { fetchAllBanners } from "./bannerStorage";

const AUDIT_LOGS_KEY = "disha2020_admin_audit_logs_v1";
const LEGACY_AUDIT_LOGS_KEY = "quizpro_admin_audit_logs_v1";

let inMemoryAuditLogsCache: AdminAuditLog[] = [];
let inMemoryUsersDirectory: UserProfile[] = [];

export function getLocalUsersDirectory(): UserProfile[] {
  return inMemoryUsersDirectory;
}

export function setLocalUsersDirectory(users: UserProfile[]): void {
  inMemoryUsersDirectory = users;
}

export async function registerUserToDirectory(profile: UserProfile): Promise<void> {
  if (!profile || !profile.id) return;
  const now = new Date().toISOString();
  const isSuper = isSuperAdmin(profile);

  // Keep in-memory cache up to date immediately
  const currentDir = getLocalUsersDirectory();
  if (!currentDir.some(u => u.id === profile.id)) {
    setLocalUsersDirectory([profile, ...currentDir]);
  }

  try {
    let finalRole = profile.role || "student";
    if (isSuper) {
      finalRole = "admin";
    } else if (finalRole !== "admin") {
      try {
        const query: any = supabase.from("profiles").select("role").eq("id", profile.id);
        const res = typeof query?.maybeSingle === "function" ? await query.maybeSingle() : await query;
        const existing = res?.data;
        if (existing?.role === "admin" || (Array.isArray(existing) && existing[0]?.role === "admin")) {
          finalRole = "admin";
        }
      } catch (_) {}
    }

    const { error } = await supabase.from("profiles").upsert(
      {
        id: profile.id,
        email: profile.email || "",
        display_name: profile.name || (profile as any).displayName || "User",
        photo_url: profile.photoURL || profile.avatar || "",
        role: finalRole,
        updated_at: now,
      },
      { onConflict: "id" }
    );
    if (error) {
      console.warn("registerUserToDirectory Supabase note:", error.message);
    }
  } catch (err) {
    console.warn("registerUserToDirectory skipped/offline:", err);
  }
}

export function getLocalAuditLogs(): AdminAuditLog[] {
  try {
    if (typeof window === "undefined" || typeof localStorage === "undefined") {
      return inMemoryAuditLogsCache;
    }
    const raw = localStorage.getItem(AUDIT_LOGS_KEY) || localStorage.getItem(LEGACY_AUDIT_LOGS_KEY);
    if (!raw) return inMemoryAuditLogsCache;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : inMemoryAuditLogsCache;
  } catch {
    return inMemoryAuditLogsCache;
  }
}

export function setLocalAuditLogs(logs: AdminAuditLog[]): void {
  inMemoryAuditLogsCache = logs;
  try {
    if (typeof window === "undefined" || typeof localStorage === "undefined") return;
    localStorage.setItem(AUDIT_LOGS_KEY, JSON.stringify(logs));
  } catch (err) {
    console.warn("Could not cache audit logs", err);
  }
}

/**
 * Record an immutable audit log entry for any admin action
 */
export async function logAdminAction(
  action: AdminAuditLog["action"],
  targetUser: UserProfile,
  reason?: string,
  details?: Record<string, any>
): Promise<AdminAuditLog> {
  const currentAdmin = loadUserProfile();
  const adminId = currentAdmin?.id || "admin";
  const adminEmail = currentAdmin?.email || "zdpaliyal@gmail.com";

  const logId = `audit_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const now = new Date().toISOString();

  const auditEntry: AdminAuditLog = {
    id: logId,
    adminId,
    adminEmail,
    action,
    targetUserId: targetUser.id,
    targetUserEmail: targetUser.email || "",
    targetUserName: targetUser.name || "User",
    reason: reason || "",
    timestamp: now,
    details: details || {},
  };

  const currentLogs = getLocalAuditLogs();
  setLocalAuditLogs([auditEntry, ...currentLogs]);
  return auditEntry;
}

/**
 * Fetch recent admin audit logs
 */
export async function fetchAdminAuditLogs(): Promise<AdminAuditLog[]> {
  return getLocalAuditLogs();
}

export type UserTestHistoryItem = {
  id: string;
  type: string;
  title: string;
  score: number;
  totalQuestions: number;
  correct: number;
  wrong: number;
  accuracy: number;
  timeSpentSeconds: number;
  date: string;
};

export type UserActivitySummary = {
  totalTestsAttempted: number;
  totalLiveTests: number;
  totalPYQs: number;
  averageScore: number;
  lastActiveDate: string;
  accountCreatedAt: string;
  status: string;
  attemptsCount: number;
  history: UserTestHistoryItem[];
};

export function mapRowToUserProfile(row: any): UserProfile {
  const id = row.id;
  const email = (row.email || "").trim().toLowerCase();
  const isSuperAdmin = ADMIN_UIDS.includes(id) || ADMIN_EMAILS.includes(email);
  const role = isSuperAdmin ? "admin" : (row.role || "student");

  return {
    id,
    name: row.display_name || row.full_name || row.name || email.split("@")[0] || "User",
    email,
    photoURL: row.photo_url || row.avatar_url || row.photoURL || "",
    avatar: row.photo_url || row.avatar_url || row.avatar || "",
    role,
    status: row.status || "active",
    blocked: Boolean(row.blocked),
    targetExam: row.target_exam || row.targetExam || "Competitive Exams",
    dailyGoalQuestions: row.daily_goal_questions || 30,
    streakDays: row.streak_days || 0,
    loginCount: 1,
    createdAt: row.created_at || new Date().toISOString(),
    lastLoginAt: row.last_sign_in_at || row.last_login_at || row.updated_at || row.created_at || new Date().toISOString(),
  };
}

/**
 * Fetch registered users from Supabase profiles table.
 *
 * `lastDoc` is an opaque offset cursor (number or `{ offset }`) returned as
 * `lastVisible` by the previous page. Keeping an explicit offset avoids the
 * classic "load more returns page 1 again" bug.
 */
export async function fetchRegisteredUsers(lastDoc?: any, pageSize = 50): Promise<{ users: UserProfile[]; lastVisible: any; hasMore: boolean }> {
  const safePageSize = Math.max(1, Math.floor(pageSize));
  const offset = typeof lastDoc === "number"
    ? Math.max(0, lastDoc)
    : Math.max(0, Number(lastDoc?.offset) || 0);

  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("id,email,display_name,photo_url,role,status,blocked,target_exam,daily_goal_questions,streak_days,created_at,updated_at")
      .order("created_at", { ascending: false })
      .range(offset, offset + safePageSize);

    if (error) {
      console.warn("[UserManagement] Supabase profiles fetch note:", error.message);
      return { users: getLocalUsersDirectory(), lastVisible: null, hasMore: false };
    }

    const rows = data || [];
    const hasMore = rows.length > safePageSize;
    const pageRows = hasMore ? rows.slice(0, safePageSize) : rows;
    const users: UserProfile[] = pageRows.map(mapRowToUserProfile);

    // Only page 1 replaces the directory; later pages extend it so the
    // in-memory list stays usable when the admin closes the panel.
    setLocalUsersDirectory(offset > 0 ? [...getLocalUsersDirectory(), ...users] : users);
    return {
      users,
      lastVisible: hasMore ? offset + safePageSize : null,
      hasMore,
    };
  } catch (err: any) {
    console.warn("[UserManagement] fetchRegisteredUsers fallback to local:", err?.message || err);
    return { users: getLocalUsersDirectory(), lastVisible: null, hasMore: false };
  }
}

/**
 * Get accurate server counts for Admin Dashboard from Supabase profiles table
 */
export async function fetchRegisteredUserCounts(): Promise<{
  totalRegistered: number;
  activeUsers: number;
  blockedUsers: number;
  adminUsers: number;
}> {
  try {
    const { count: totalCount, error } = await supabase
      .from("profiles")
      .select("*", { count: "exact", head: true });

    if (error) {
      return { totalRegistered: 0, activeUsers: 0, blockedUsers: 0, adminUsers: 0 };
    }

    const { count: adminCount } = await supabase
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .eq("role", "admin");

    const total = totalCount || 0;
    const admins = adminCount || 0;

    return {
      totalRegistered: total,
      activeUsers: total,
      blockedUsers: 0,
      adminUsers: admins,
    };
  } catch {
    return { totalRegistered: 0, activeUsers: 0, blockedUsers: 0, adminUsers: 0 };
  }
}

export const fetchFirestoreUserCounts = fetchRegisteredUserCounts;

export async function findSuspiciousProfiles(): Promise<UserProfile[]> {
  const localDir = getLocalUsersDirectory();
  try {
    const { users } = await fetchRegisteredUsers();
    const combined = [...localDir];
    for (const u of users) {
      if (!combined.some(x => x.id === u.id)) {
        combined.push(u);
      }
    }
    return combined.filter(u => {
      const email = (u.email || "").toLowerCase().trim();
      const name = (u.name || "").toLowerCase().trim();
      return !email || email.endsWith(".local") || name === "admin user" || name === "zd";
    });
  } catch {
    return localDir.filter(u => {
      const email = (u.email || "").toLowerCase().trim();
      const name = (u.name || "").toLowerCase().trim();
      return !email || email.endsWith(".local") || name === "admin user" || name === "zd";
    });
  }
}

/**
 * Update user account status
 */
export async function updateUserAccountStatus(
  userId: string,
  newStatus: "active" | "inactive" | "blocked",
  _reason?: string
): Promise<{ id: string; status: string; blocked: boolean; [key: string]: any }> {
  const currentAdmin = loadUserProfile();
  if (!isUserAdmin(currentAdmin)) {
    throw new Error("Unauthorized: Only verified administrators can change account statuses.");
  }

  if (userId === currentAdmin?.id) {
    throw new Error("Action Restricted: Administrators cannot deactivate or block their own account.");
  }

  const isBlocked = newStatus === "blocked";

  try {
    const { error } = await supabase
      .from("profiles")
      .update({ status: newStatus, blocked: isBlocked, updated_at: new Date().toISOString() })
      .eq("id", userId);
    if (error) {
      console.warn("Failed to persist status to Supabase:", error.message);
    }
  } catch (e) {
    console.warn("Status update network error:", e);
  }

  let localUsers = getLocalUsersDirectory();
  localUsers = localUsers.map(u => u.id === userId ? { ...u, status: newStatus, blocked: isBlocked } : u);
  setLocalUsersDirectory(localUsers);

  return { id: userId, status: newStatus, blocked: isBlocked };
}

/**
 * Update user role (admin / student).
 * Security Rule: Strictly restricted to Super Administrators.
 */
export async function updateUserRole(userId: string, newRole: "admin" | "student" | "user"): Promise<void> {
  const currentAdmin = loadUserProfile();
  if (!isSuperAdmin(currentAdmin)) {
    throw new Error("Unauthorized: केवल मुख्य प्रशासक (Super Admin) ही एडमिन बना या हटा सकते हैं (Unauthorized: Only super admins can update roles)।");
  }

  // Prevent demoting a Super Admin
  if (isSuperAdmin(userId) && newRole !== "admin") {
    throw new Error("निषिद्ध: मुख्य Super Admin को डिमोट नहीं किया जा सकता।");
  }

  if ((userId === currentAdmin?.id || userId === "admin1") && newRole !== "admin") {
    throw new Error("Action Restricted: Administrators cannot demote their own account (निषिद्ध: आप स्वयं अपने एडमिन अधिकार नहीं हटा सकते)।");
  }

  const normalizedRole = newRole === "admin" ? "admin" : "student";

  // 1. Try secure Supabase RPC which updates both public.profiles and auth.users metadata
  let rpcSuccess = false;
  try {
    const { data, error } = await supabase.rpc("promote_user_to_admin", {
      target_user_id: userId,
      target_role: normalizedRole,
    });
    if (!error && data?.success) {
      rpcSuccess = true;
    }
  } catch (rpcErr) {
    console.warn("RPC promote_user_to_admin call exception:", rpcErr);
  }

  // 2. Direct table update fallback if RPC didn't execute
  if (!rpcSuccess) {
    const { error } = await supabase
      .from("profiles")
      .update({ role: normalizedRole, updated_at: new Date().toISOString() })
      .eq("id", userId);

    if (error) {
      throw new Error(`Supabase में यूज़र रोल अपडेट विफल: ${error.message}`);
    }
  }

  // 3. Update local directory cache so UI updates immediately
  let localUsers = getLocalUsersDirectory();
  if (localUsers.length > 0) {
    localUsers = localUsers.map((u) => (u.id === userId ? { ...u, role: normalizedRole } : u));
    setLocalUsersDirectory(localUsers);
  }

  try {
    const targetUser = localUsers.find((u) => u.id === userId) || ({ id: userId, name: "User", email: "" } as any);
    await logAdminAction("update_role", targetUser, `यूज़र रोल को ${normalizedRole === "admin" ? "Admin" : "Student"} में अपडेट किया गया`);
  } catch (e) {
    console.warn("Audit logging for role change failed:", e);
  }
}

/**
 * Promote user by exact email directly (Super Admin only)
 */
export async function promoteUserByEmail(email: string): Promise<UserProfile> {
  const currentAdmin = loadUserProfile();
  if (!isSuperAdmin(currentAdmin)) {
    throw new Error("अनधिकृत: केवल मुख्य प्रशासक (Super Admin) ही नए एडमिन बना सकते हैं।");
  }
  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail || !cleanEmail.includes("@")) {
    throw new Error("कृपया एक मान्य ईमेल पता दर्ज करें।");
  }

  // Check if target is already in local directory
  const localMatch = getLocalUsersDirectory().find(
    (u) => (u.email || "").trim().toLowerCase() === cleanEmail
  );

  let targetUserId = localMatch?.id;

  // Search Supabase profiles table
  if (!targetUserId) {
    const { data, error } = await supabase
      .from("profiles")
      .select("id,email,display_name,role")
      .ilike("email", cleanEmail)
      .maybeSingle();

    if (error) {
      throw new Error(`डेटाबेस त्रुटि: ${error.message}`);
    }
    if (!data) {
      throw new Error(`ईमेल "${cleanEmail}" वाला कोई छात्र नहीं मिला। पहले उस यूज़र को ऐप में एक बार लॉगिन करना होगा।`);
    }
    targetUserId = data.id;
  }

  await updateUserRole(targetUserId, "admin");

  // Fetch updated user
  const updatedUser: UserProfile = localMatch
    ? { ...localMatch, role: "admin" }
    : {
        id: targetUserId,
        email: cleanEmail,
        name: cleanEmail.split("@")[0],
        role: "admin",
        status: "active",
        createdAt: new Date().toISOString(),
      };

  return updatedUser;
}

export async function deleteUserAccountFromFirestore(userId: string, _reason?: string): Promise<void> {
  const currentAdmin = loadUserProfile();
  if (userId === currentAdmin?.id || userId === "admin1") {
    throw new Error("Action Restricted: Administrators cannot delete their own active administrator account (निषिद्ध: आप स्वयं अपना एडमिन खाता नहीं हटा सकते)।");
  }

  const { error } = await supabase.from("profiles").delete().eq("id", userId);
  if (error) {
    console.warn("Failed to delete user from Supabase:", error.message);
  }

  let localUsers = getLocalUsersDirectory().filter(u => u.id !== userId);
  setLocalUsersDirectory(localUsers);
}

export const deleteUserAccount = deleteUserAccountFromFirestore;

export async function fetchUserActivityData(user: UserProfile): Promise<{
  totalTestsAttempted: number;
  totalLiveTests: number;
  totalPYQs: number;
  averageScore: number;
  lastActiveDate: string;
  accountCreatedAt: string;
  status: string;
  attemptsCount: number;
  history: any[];
}> {
  let attemptsCount = 0;
  const historyItems: any[] = [];

  let totalScoreSum = 0;
  try {
    const { data, error } = await supabase
      .from("attempts")
      .select("id,topic_id,subject_id,score,total_questions,time_spent_seconds,created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(100);

    if (!error && data) {
      attemptsCount = data.length;
      data.forEach((row: any) => {
        const totalQ = Math.max(1, row.total_questions || 1);
        const sc = typeof row.score === "number" ? Math.max(0, row.score) : 0;
        totalScoreSum += sc;
        const accuracy = Math.min(100, Math.round((sc / totalQ) * 100));

        historyItems.push({
          id: row.id,
          type: "practice_attempt",
          title: row.topic_id || "Practice Quiz",
          score: sc,
          totalQuestions: totalQ,
          correct: sc,
          wrong: Math.max(0, totalQ - sc),
          accuracy,
          timeSpentSeconds: row.time_spent_seconds || 0,
          date: row.created_at || new Date().toISOString(),
        });
      });
    }

    // Also fetch user's live test submissions
    let liveTestCount = 0;
    try {
      const { data: liveData } = await supabase
        .from("live_test_submissions")
        .select("submission_id,test_title,score,total_marks,accuracy,time_spent_seconds,submitted_at")
        .eq("user_id", user.id)
        .order("submitted_at", { ascending: false })
        .limit(50);

      if (Array.isArray(liveData) && liveData.length > 0) {
        liveTestCount = liveData.length;
        liveData.forEach((row: any) => {
          historyItems.push({
            id: row.submission_id,
            type: "live_test",
            title: row.test_title || "Live Mock Test",
            score: Number(row.score) || 0,
            totalQuestions: Math.round(Number(row.total_marks) || 100),
            correct: Math.round(Number(row.score) || 0),
            wrong: 0,
            accuracy: Math.round(Number(row.accuracy) || 0),
            timeSpentSeconds: row.time_spent_seconds || 0,
            date: row.submitted_at || new Date().toISOString(),
          });
        });
      }
    } catch {
      // ignore
    }

    const totalAllAttempts = attemptsCount + liveTestCount;
    const avgScore = totalAllAttempts > 0 ? Math.round(totalScoreSum / Math.max(1, attemptsCount)) : 0;

    return {
      totalTestsAttempted: totalAllAttempts,
      totalLiveTests: liveTestCount,
      totalPYQs: 0,
      averageScore: avgScore,
      lastActiveDate: user.lastLoginAt || user.createdAt,
      accountCreatedAt: user.createdAt,
      status: user.status || "active",
      attemptsCount: totalAllAttempts,
      history: historyItems,
    };
  } catch (err) {
    console.warn("Could not fetch user attempts history from Supabase:", err);
    return {
      totalTestsAttempted: 0,
      totalLiveTests: 0,
      totalPYQs: 0,
      averageScore: 0,
      lastActiveDate: user.lastLoginAt || user.createdAt,
      accountCreatedAt: user.createdAt,
      status: user.status || "active",
      attemptsCount: 0,
      history: [],
    };
  }
}

export async function getAdminDashboardMetrics(): Promise<{
  totalRegisteredUsers: number;
  totalActiveUsers: number;
  totalBanners: number;
  activeBanners: number;
  recentUsers: UserProfile[];
}> {
  const counts = await fetchFirestoreUserCounts();
  const banners = await fetchAllBanners();
  const { users } = await fetchRegisteredUsers(undefined, 5);

  return {
    totalRegisteredUsers: counts.totalRegistered,
    totalActiveUsers: counts.activeUsers,
    totalBanners: banners.length,
    activeBanners: banners.filter(b => b.isActive).length,
    recentUsers: users,
  };
}
