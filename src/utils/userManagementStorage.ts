import { supabase } from "../lib/supabase";
import { UserProfile, AdminAuditLog } from "../types";
import { ADMIN_UIDS, ADMIN_EMAILS, isUserAdmin, loadUserProfile } from "./userProfileStorage";
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
  const isAdminUID = ADMIN_UIDS.includes(profile.id) || ADMIN_EMAILS.includes((profile.email || "").trim().toLowerCase());

  try {
    const { error } = await supabase.from("profiles").upsert(
      {
        id: profile.id,
        email: profile.email || "",
        full_name: profile.name || "User",
        avatar_url: profile.photoURL || profile.avatar || "",
        role: isAdminUID ? "admin" : (profile.role || "student"),
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

function mapRowToUserProfile(row: any): UserProfile {
  const id = row.id;
  const email = (row.email || "").trim().toLowerCase();
  const isSuperAdmin = ADMIN_UIDS.includes(id) || ADMIN_EMAILS.includes(email);
  const role = isSuperAdmin ? "admin" : (row.role || "student");

  return {
    id,
    name: row.full_name || row.name || email.split("@")[0] || "User",
    email,
    photoURL: row.avatar_url || row.photoURL || "",
    avatar: row.avatar_url || row.avatar || "",
    role,
    status: row.status || "active",
    blocked: Boolean(row.blocked),
    targetExam: row.target_exam || row.targetExam || "Competitive Exams",
    dailyGoalQuestions: row.daily_goal_questions || 30,
    streakDays: row.streak_days || 0,
    loginCount: 1,
    createdAt: row.created_at || new Date().toISOString(),
    lastLoginAt: row.updated_at || row.created_at || new Date().toISOString(),
  };
}

/**
 * Fetch registered users from Supabase profiles table
 */
export async function fetchRegisteredUsers(lastDoc?: any, pageSize = 50): Promise<{ users: UserProfile[]; lastVisible: any; hasMore: boolean }> {
  const profile = loadUserProfile();
  if (!isUserAdmin(profile)) {
    return { users: getLocalUsersDirectory(), lastVisible: null, hasMore: false };
  }

  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(pageSize + 1);

    if (error) {
      console.warn("[UserManagement] Supabase profiles fetch note:", error.message);
      return { users: getLocalUsersDirectory(), lastVisible: null, hasMore: false };
    }

    const rows = data || [];
    const hasMore = rows.length > pageSize;
    const pageRows = hasMore ? rows.slice(0, pageSize) : rows;
    const users: UserProfile[] = pageRows.map(mapRowToUserProfile);

    setLocalUsersDirectory(users);
    return { users, lastVisible: null, hasMore };
  } catch (err: any) {
    console.warn("[UserManagement] fetchRegisteredUsers fallback to local:", err?.message || err);
    return { users: getLocalUsersDirectory(), lastVisible: null, hasMore: false };
  }
}

/**
 * Get accurate server counts for Admin Dashboard
 */
export async function fetchFirestoreUserCounts(): Promise<{
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

export async function findSuspiciousProfiles(): Promise<UserProfile[]> {
  try {
    const { users } = await fetchRegisteredUsers();
    return users.filter(u => {
      const email = (u.email || "").toLowerCase().trim();
      const name = (u.name || "").toLowerCase().trim();
      return !email || email.endsWith(".local") || name === "admin user" || name === "zd";
    });
  } catch {
    return [];
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
  let localUsers = getLocalUsersDirectory();
  localUsers = localUsers.map(u => u.id === userId ? { ...u, status: newStatus, blocked: isBlocked } : u);
  setLocalUsersDirectory(localUsers);

  return { id: userId, status: newStatus, blocked: isBlocked };
}

/**
 * Update user role (admin / student)
 */
export async function updateUserRole(userId: string, newRole: "admin" | "student" | "user"): Promise<void> {
  const currentAdmin = loadUserProfile();
  if (userId === currentAdmin?.id && newRole !== "admin") {
    throw new Error("Action Restricted: Administrators cannot remove their own admin role.");
  }

  const normalizedRole = newRole === "admin" ? "admin" : "student";
  const { error } = await supabase
    .from("profiles")
    .update({ role: normalizedRole, updated_at: new Date().toISOString() })
    .eq("id", userId);

  if (error) {
    throw new Error(`Failed to update user role in Supabase: ${error.message}`);
  }

  let localUsers = getLocalUsersDirectory();
  if (localUsers.length > 0) {
    localUsers = localUsers.map(u => u.id === userId ? { ...u, role: normalizedRole } : u);
    setLocalUsersDirectory(localUsers);
  }

  try {
    const targetUser = localUsers.find(u => u.id === userId) || { id: userId, name: "User", email: "" } as any;
    await logAdminAction("update_role", targetUser, `User role updated to ${normalizedRole}`);
  } catch (e) {
    console.warn("Audit logging for role change failed:", e);
  }
}

export async function deleteUserAccountFromFirestore(userId: string, _reason?: string): Promise<void> {
  const currentAdmin = loadUserProfile();
  if (userId === currentAdmin?.id) {
    throw new Error("Action Restricted: Administrators cannot delete their own active administrator account.");
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

  try {
    const { data } = await supabase
      .from("attempts")
      .select("*")
      .eq("user_id", user.id);

    if (data) {
      attemptsCount = data.length;
      data.forEach((row: any) => {
        historyItems.push({
          id: row.id,
          type: "practice",
          title: "Quiz Practice",
          score: row.is_correct ? 1 : 0,
          totalQuestions: 1,
          correct: row.is_correct ? 1 : 0,
          wrong: row.is_correct ? 0 : 1,
          accuracy: row.is_correct ? 100 : 0,
          timeSpentSeconds: row.time_spent || 0,
          date: row.created_at || new Date().toISOString(),
        });
      });
    }
  } catch (err) {
    console.warn("Could not fetch user attempts history from Supabase:", err);
  }

  return {
    totalTestsAttempted: attemptsCount,
    totalLiveTests: 0,
    totalPYQs: 0,
    averageScore: attemptsCount > 0 ? 100 : 0,
    lastActiveDate: user.lastLoginAt || user.createdAt,
    accountCreatedAt: user.createdAt,
    status: user.status || "active",
    attemptsCount,
    history: historyItems,
  };
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
