import { 
  collection, 
  doc, 
  query,
  orderBy,
  limit,
  startAfter,
  where,
  getDocs,
} from "firebase/firestore";
import {
  guardedGetDoc,
  guardedGetDocs,
  guardedSetDoc,
  guardedUpdateDoc,
  guardedDeleteDoc,
  guardedGetCountFromServer,
} from "./quotaTracker";
import { db, auth, isFirebaseConfigured } from "../lib/firebase";
import { UserProfile, AdminAuditLog } from "../types";
import { ADMIN_UIDS, ADMIN_EMAILS, isUserAdmin, loadUserProfile } from "./userProfileStorage";
import { fetchAllBanners } from "./bannerStorage";

const AUDIT_LOGS_KEY = "quizpro_admin_audit_logs_v1";

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
  const userRef = doc(db, "users", profile.id);
  const now = new Date().toISOString();
  const isAdminUID = ADMIN_UIDS.includes(profile.id) || ADMIN_EMAILS.includes((profile.email || "").trim().toLowerCase());

  try {
    // Optimization: Check local storage first to see if we already registered this session
    const lastUpdateKey = `quizpro_last_dir_reg_${profile.id}`;
    const lastUpdate = localStorage.getItem(lastUpdateKey);
    const sixHours = 6 * 60 * 60 * 1000;
    
    if (lastUpdate && (Date.now() - parseInt(lastUpdate)) < sixHours) {
      // If we updated recently, only proceed if we need to promote to admin role
      // which handles cases where a user was just granted admin rights.
      if (!isAdminUID) return;
    }

    const snap = await guardedGetDoc(userRef, "Student", "Check User Directory Doc");
    if (!snap.exists()) {
      await guardedSetDoc(
        userRef,
        {
          uid: profile.id,
          name: profile.name || "User",
          email: profile.email || "",
          photoURL: profile.photoURL || profile.avatar || "",
          role: isAdminUID ? "admin" : "student",
          status: "active",
          blocked: false,
          isTest: !!profile.isTest,
          createdAt: now,
          lastLoginAt: now,
          loginCount: 1,
        },
        undefined,
        "Student",
        "Register User Doc"
      );
      localStorage.setItem(lastUpdateKey, Date.now().toString());
    } else {
      const data = snap.data();
      const lastLoginMs = data.lastLoginAt ? new Date(data.lastLoginAt).getTime() : 0;
      
      // Only write if > 6 hours since last update OR role needs promotion
      const needsRolePromotion = isAdminUID && data.role !== "admin";
      
      if (Date.now() - lastLoginMs > sixHours || needsRolePromotion) {
        const currentLoginCount = typeof data.loginCount === "number" ? data.loginCount + 1 : 1;
        await guardedSetDoc(
          userRef,
          {
            lastLoginAt: now,
            loginCount: currentLoginCount,
            ...(needsRolePromotion ? { role: "admin" } : {})
          },
          { merge: true },
          "Student",
          "Update User Login"
        );
        localStorage.setItem(lastUpdateKey, Date.now().toString());
      }
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
    const raw = localStorage.getItem(AUDIT_LOGS_KEY);
    if (!raw) return inMemoryAuditLogsCache;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : inMemoryAuditLogsCache;
  } catch (err) {
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
  const adminId = auth.currentUser?.uid || currentAdmin?.id || "admin";
  const adminEmail = auth.currentUser?.email || currentAdmin?.email || "zdpaliyal@gmail.com";

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

  try {
    const logDoc = doc(db, "adminAuditLogs", logId);
    await guardedSetDoc(logDoc, auditEntry, undefined, "Admin", "Log Admin Action");
  } catch (err: any) {
    console.warn("Firestore audit log write skipped/offline:", err?.message || err);
  }

  return auditEntry;
}

/**
 * Fetch recent admin audit logs
 */
export async function fetchAdminAuditLogs(): Promise<AdminAuditLog[]> {
  const local = getLocalAuditLogs();
  try {
    const snap = await guardedGetDocs(collection(db, "adminAuditLogs"), "Admin", "Fetch Audit Logs");
    const remote = snap.docs.map(d => ({ ...d.data(), id: d.id })) as AdminAuditLog[];
    const map = new Map<string, AdminAuditLog>();
    for (const item of [...local, ...remote]) {
      if (item && item.id) map.set(item.id, item);
    }
    const merged = Array.from(map.values()).sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
    setLocalAuditLogs(merged);
    return merged;
  } catch (err) {
    return local;
  }
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

/**
 * Fetch registered users from Firestore users collection (limit 50, ordered by createdAt desc)
 */
export async function fetchRegisteredUsers(lastDoc?: any, pageSize = 50): Promise<{ users: UserProfile[]; lastVisible: any; hasMore: boolean }> {
  const profile = loadUserProfile();
  
  if (!isUserAdmin(profile)) {
    console.warn("[UserManagement] Unauthorized access attempt to fetch users.");
    return { users: getLocalUsersDirectory(), lastVisible: null, hasMore: false };
  }
  
  if (!isFirebaseConfigured()) {
    console.warn("[UserManagement] Firebase not configured, returning local users.");
    return { users: getLocalUsersDirectory(), lastVisible: null, hasMore: false };
  }

  try {
    const usersRef = collection(db, "users");
    // Primary query ordered by creation date with 20s timeout
    let q = query(usersRef, orderBy("createdAt", "desc"), limit(pageSize + 1));
    if (lastDoc) {
      q = query(usersRef, orderBy("createdAt", "desc"), startAfter(lastDoc), limit(pageSize + 1));
    }

    console.log("[UserManagement] Fetching users from Firestore...");
    let snap: any;
    try {
      snap = await guardedGetDocs(q, "Admin", "Fetch Registered Users Page", undefined, 20000);
    } catch (orderErr) {
      console.warn("[UserManagement] Ordered query failed/timed out, trying unordered fallback...", orderErr);
      snap = await guardedGetDocs(usersRef, "Admin", "Fetch Users No Order", undefined, 15000, true);
    }

    const docs = snap.docs;
    console.log("[UserManagement] Docs fetched:", docs.length);
    const hasMore = docs.length > pageSize;
    const pageDocs = hasMore ? docs.slice(0, pageSize) : docs;
    const lastVisible = pageDocs.length > 0 ? pageDocs[pageDocs.length - 1] : null;

    const users: UserProfile[] = pageDocs.map((docSnap: any) => mapDocToUserProfile(docSnap));
    
    if (!lastDoc) {
      setLocalUsersDirectory(users);
    }

    return { users, lastVisible, hasMore };
  } catch (err: any) {
    console.warn("[UserManagement] Firestore fetchRegisteredUsers recovered via local cache fallback:", err?.message || err);
    return { users: getLocalUsersDirectory(), lastVisible: null, hasMore: false };
  }
}

// Helper to map Firestore doc to UserProfile consistently
function mapDocToUserProfile(docSnap: any): UserProfile {
  const data = docSnap.data() as Partial<UserProfile> & { loginCount?: number };
  const id = docSnap.id;
  const email = (data.email || "").trim().toLowerCase();
  
  // Directly check for admin status based on hardcoded lists or the role field in the document itself
  const isSuperAdmin = ADMIN_UIDS.includes(id) || ADMIN_EMAILS.includes(email);
  const role = isSuperAdmin ? "admin" : (data.role || "student");

  return {
    id,
    name: data.name || email.split("@")[0] || "User",
    email,
    photoURL: data.photoURL || "",
    avatar: data.avatar || "",
    role,
    status: data.status || "active",
    blocked: data.blocked || false,
    targetExam: data.targetExam || "Competitive Exams",
    dailyGoalQuestions: data.dailyGoalQuestions || 30,
    streakDays: data.streakDays || 0,
    loginCount: data.loginCount || 1,
    createdAt: data.createdAt || new Date().toISOString(),
    lastLoginAt: data.lastLoginAt || data.createdAt || new Date().toISOString(),
  };
}

/**
 * Get accurate server counts using getCountFromServer for Admin Dashboard
 */
export async function fetchFirestoreUserCounts(): Promise<{
  totalRegistered: number;
  activeUsers: number;
  blockedUsers: number;
  adminUsers: number;
}> {
  const profile = loadUserProfile();
  if (!isUserAdmin(profile)) {
    throw new Error("Unauthorized: Only admins can view user metrics.");
  }
  try {
    const usersRef = collection(db, "users");
    const totalSnap = await guardedGetCountFromServer(usersRef, "Admin", "Count Total Users");
    const activeSnap = await guardedGetCountFromServer(query(usersRef, where("blocked", "==", false)), "Admin", "Count Active Users");
    const blockedSnap = await guardedGetCountFromServer(query(usersRef, where("blocked", "==", true)), "Admin", "Count Blocked Users");
    const adminSnap = await guardedGetCountFromServer(query(usersRef, where("role", "==", "admin")), "Admin", "Count Admin Users");

    return {
      totalRegistered: totalSnap.data().count,
      activeUsers: activeSnap.data().count,
      blockedUsers: blockedSnap.data().count,
      adminUsers: adminSnap.data().count,
    };
  } catch (err) {
    console.warn("Error fetching user counts from server:", err);
    return { totalRegistered: 0, activeUsers: 0, blockedUsers: 0, adminUsers: 0 };
  }
}

/**
 * Find suspicious profiles (no email, email ending in .local, or names like Admin User / ZD)
 */
export async function findSuspiciousProfiles(): Promise<UserProfile[]> {
  const profile = loadUserProfile();
  if (!isUserAdmin(profile)) {
    throw new Error("Unauthorized: Only admins can view user reports.");
  }
  try {
    const snap = await guardedGetDocs(collection(db, "users"), "Admin", "Find Suspicious Profiles");
    const suspicious: UserProfile[] = [];

    snap.forEach(docSnap => {
      const data = docSnap.data() as UserProfile;
      const email = (data.email || "").toLowerCase().trim();
      const name = (data.name || "").toLowerCase().trim();

      const isNoEmail = !email;
      const isLocalEmail = email.endsWith(".local");
      const isSuspiciousName = name === "admin user" || name === "zd" || name.includes("test user");

      if (isNoEmail || isLocalEmail || isSuspiciousName) {
        suspicious.push({
          ...data,
          id: docSnap.id,
        });
      }
    });

    return suspicious;
  } catch (err) {
    console.warn("Failed to find suspicious profiles:", err);
    return [];
  }
}

/**
 * Update user account status (block / unblock / status change) with try/catch & real error code
 */
export async function updateUserAccountStatus(
  userId: string, 
  newStatus: "active" | "inactive" | "blocked",
  reason?: string
): Promise<{ id: string; status: string; blocked: boolean; [key: string]: any }> {
  const currentAdmin = loadUserProfile();
  const adminEmail = auth.currentUser?.email || currentAdmin?.email;
  if (!isUserAdmin(adminEmail) && !ADMIN_UIDS.includes(auth.currentUser?.uid || "")) {
    throw new Error("Unauthorized: Only verified administrators can change account statuses.");
  }

  if (userId === auth.currentUser?.uid || userId === currentAdmin?.id) {
    throw new Error("Action Restricted: Administrators cannot deactivate or block their own account.");
  }

  const userDocRef = doc(db, "users", userId);
  const isBlocked = newStatus === "blocked";

  await guardedUpdateDoc(userDocRef, {
    status: newStatus,
    blocked: isBlocked,
    updatedAt: new Date().toISOString(),
  }, "Admin", "Update User Status");

  // Also update local test directory if present
  let localUsers = getLocalUsersDirectory();
  let updatedObj: any = { id: userId, status: newStatus, blocked: isBlocked };
  if (localUsers.length > 0) {
    localUsers = localUsers.map(u => u.id === userId ? { ...u, status: newStatus, blocked: isBlocked } : u);
    setLocalUsersDirectory(localUsers);
    updatedObj = localUsers.find(u => u.id === userId) || updatedObj;
  }

  return updatedObj;
}

/**
 * Update user role (make admin / remove admin) with confirm & self-removal prevention
 */
export async function updateUserRole(userId: string, newRole: "admin" | "student" | "user"): Promise<void> {
  const currentAdmin = loadUserProfile();
  if (userId === auth.currentUser?.uid && newRole !== "admin") {
    throw new Error("Action Restricted: Administrators cannot remove their own admin role.");
  }

  const userDocRef = doc(db, "users", userId);
  const normalizedRole = newRole === "admin" ? "admin" : "student";

  await guardedUpdateDoc(userDocRef, {
    role: normalizedRole,
    updatedAt: new Date().toISOString(),
  }, "Admin", "Update User Role");

  // Update local directory cache
  let localUsers = getLocalUsersDirectory();
  if (localUsers.length > 0) {
    localUsers = localUsers.map(u => u.id === userId ? { ...u, role: normalizedRole } : u);
    setLocalUsersDirectory(localUsers);
  }

  // Audit log entry
  try {
    const targetUser = localUsers.find(u => u.id === userId) || { id: userId, name: "User", email: "" } as any;
    await logAdminAction(
      "update_role",
      targetUser,
      `User role updated to ${normalizedRole}`
    );
  } catch (e) {
    console.warn("Audit logging for role change failed:", e);
  }
}

/**
 * Delete user profile from Firestore users collection
 */
export async function deleteUserAccountFromFirestore(userId: string, reason?: string): Promise<void> {
  if (userId === auth.currentUser?.uid) {
    throw new Error("Action Restricted: Administrators cannot delete their own active administrator account.");
  }
  await guardedDeleteDoc(doc(db, "users", userId), "Admin", "Delete User Account");
}

export const deleteUserAccount = deleteUserAccountFromFirestore;


/**
 * Fetch activity summary for user details modal
 */
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
    const attemptsSnap = await guardedGetDocs(query(collection(db, "attempts"), where("userId", "==", user.id)), "Admin", "Fetch User Attempts");
    attemptsCount = attemptsSnap.size;
    attemptsSnap.forEach(d => {
      const data = d.data();
      historyItems.push({
        id: d.id,
        type: data.type || "live_test",
        title: data.testTitle || data.title || "Exam Attempt",
        score: data.score || 0,
        totalQuestions: data.totalQuestions || 100,
        correct: data.correctCount || 0,
        wrong: data.wrongCount || 0,
        accuracy: data.accuracy || 0,
        timeSpentSeconds: data.timeSpentSeconds || 0,
        date: data.submittedAt || data.createdAt || new Date().toISOString(),
      });
    });
  } catch (err) {
    console.warn("Could not fetch user attempts history:", err);
  }

  historyItems.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const totalTests = historyItems.length;
  const liveCount = historyItems.filter(h => h.type === "live_test").length;
  const pyqCount = historyItems.filter(h => h.type === "pyq").length;
  const avgScore = totalTests > 0
    ? Math.round(historyItems.reduce((acc, h) => acc + h.score, 0) / totalTests)
    : 0;

  return {
    totalTestsAttempted: totalTests,
    totalLiveTests: liveCount,
    totalPYQs: pyqCount,
    averageScore: avgScore,
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


