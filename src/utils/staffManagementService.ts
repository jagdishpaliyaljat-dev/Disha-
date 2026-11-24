import { supabase, isSupabaseConfigured } from "../lib/supabase";
import { 
  StaffMember, 
  StaffInvitation, 
  StaffAuditLog, 
  StaffRole, 
  StaffStatus, 
  PermissionAction, 
  PermissionResource, 
  UserProfile 
} from "../types";
import { 
  ADMIN_EMAILS, 
  ADMIN_UIDS, 
  isSuperAdmin, 
  loadUserProfile 
} from "./userProfileStorage";
import { DEFAULT_ROLE_PERMISSIONS, getStaffRole } from "./rbac";
import { getLocalUsersDirectory, setLocalUsersDirectory } from "./userManagementStorage";

const STAFF_MEMBERS_STORAGE_KEY = "disha2020_staff_members_v1";
const STAFF_INVITATIONS_STORAGE_KEY = "disha2020_staff_invitations_v1";
const STAFF_AUDIT_LOGS_STORAGE_KEY = "disha2020_staff_audit_logs_v1";

/**
 * In-memory fallback caches
 */
let inMemoryStaffMembers: StaffMember[] = [];
let inMemoryInvitations: StaffInvitation[] = [];
let inMemoryAuditLogs: StaffAuditLog[] = [];

/**
 * Generate default seed staff if cache is blank
 */
function getSeedStaffMembers(): StaffMember[] {
  return [
    {
      id: "9a821db5-5257-42b2-af8a-7f9369b7937f",
      email: "jagdishpaliyaljat@gmail.com",
      name: "Jagdish Paliyal",
      displayName: "Jagdish Paliyal (Owner)",
      role: "super_admin",
      status: "active",
      permissions: DEFAULT_ROLE_PERMISSIONS.super_admin,
      assignedSubjects: ["All Subjects"],
      createdAt: "2026-01-01T00:00:00.000Z",
      lastActiveAt: new Date().toISOString(),
    },
    {
      id: "62971883-2873-4134-852d-8fe17b22c0a7",
      email: "zdpaliyal@gmail.com",
      name: "ZD Paliyal",
      displayName: "ZD Paliyal (Super Admin)",
      role: "super_admin",
      status: "active",
      permissions: DEFAULT_ROLE_PERMISSIONS.super_admin,
      assignedSubjects: ["All Subjects"],
      createdAt: "2026-01-01T00:00:00.000Z",
      lastActiveAt: new Date().toISOString(),
    },
    {
      id: "staff-seed-sme-01",
      email: "economics.sme@disha2020.in",
      name: "Dr. Ramesh Sharma",
      displayName: "Dr. Ramesh Sharma",
      role: "sme_teacher",
      status: "active",
      permissions: DEFAULT_ROLE_PERMISSIONS.sme_teacher,
      assignedSubjects: ["Economics", "Rajasthan Economy"],
      createdAt: "2026-02-10T10:00:00.000Z",
      lastActiveAt: new Date(Date.now() - 3600000 * 4).toISOString(),
    },
    {
      id: "staff-seed-reviewer-01",
      email: "reviewer.pyq@disha2020.in",
      name: "Pooja Choudhary",
      displayName: "Pooja Choudhary",
      role: "content_reviewer",
      status: "active",
      permissions: DEFAULT_ROLE_PERMISSIONS.content_reviewer,
      assignedSubjects: ["All Subjects"],
      createdAt: "2026-02-15T14:30:00.000Z",
      lastActiveAt: new Date(Date.now() - 3600000 * 2).toISOString(),
    },
    {
      id: "staff-seed-support-01",
      email: "helpdesk@disha2020.in",
      name: "Vikram Singh",
      displayName: "Vikram Singh",
      role: "support_agent",
      status: "active",
      permissions: DEFAULT_ROLE_PERMISSIONS.support_agent,
      assignedSubjects: ["Support Desk"],
      createdAt: "2026-02-20T09:00:00.000Z",
      lastActiveAt: new Date(Date.now() - 3600000 * 1).toISOString(),
    },
  ];
}

export function getCachedStaffMembers(): StaffMember[] {
  try {
    if (typeof localStorage !== "undefined") {
      const raw = localStorage.getItem(STAFF_MEMBERS_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    }
  } catch {}
  if (inMemoryStaffMembers.length > 0) return inMemoryStaffMembers;
  const seeds = getSeedStaffMembers();
  setCachedStaffMembers(seeds);
  return seeds;
}

export function setCachedStaffMembers(members: StaffMember[]): void {
  inMemoryStaffMembers = members;
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(STAFF_MEMBERS_STORAGE_KEY, JSON.stringify(members));
    }
  } catch (err) {
    console.warn("Could not cache staff members to localStorage:", err);
  }
}

export function getCachedStaffInvitations(): StaffInvitation[] {
  try {
    if (typeof localStorage !== "undefined") {
      const raw = localStorage.getItem(STAFF_INVITATIONS_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    }
  } catch {}
  return inMemoryInvitations;
}

export function setCachedStaffInvitations(invites: StaffInvitation[]): void {
  inMemoryInvitations = invites;
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(STAFF_INVITATIONS_STORAGE_KEY, JSON.stringify(invites));
    }
  } catch (err) {
    console.warn("Could not cache staff invitations:", err);
  }
}

export function getCachedStaffAuditLogs(): StaffAuditLog[] {
  try {
    if (typeof localStorage !== "undefined") {
      const raw = localStorage.getItem(STAFF_AUDIT_LOGS_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    }
  } catch {}
  return inMemoryAuditLogs;
}

export function setCachedStaffAuditLogs(logs: StaffAuditLog[]): void {
  inMemoryAuditLogs = logs;
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(STAFF_AUDIT_LOGS_STORAGE_KEY, JSON.stringify(logs));
    }
  } catch (err) {
    console.warn("Could not cache staff audit logs:", err);
  }
}

/**
 * Record an audit log entry for staff operations
 */
export async function recordStaffAuditLog(entry: {
  action: string;
  resourceType: PermissionResource | string;
  resourceId?: string;
  details?: Record<string, any>;
}): Promise<StaffAuditLog> {
  const currentAdmin = loadUserProfile();
  const actorRole = getStaffRole(currentAdmin);
  const now = new Date().toISOString();

  const logRecord: StaffAuditLog = {
    id: typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `aud_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    actorId: currentAdmin?.id || "admin_system",
    actorEmail: currentAdmin?.email || "admin@disha2020.in",
    actorRole,
    action: entry.action,
    resourceType: entry.resourceType,
    resourceId: entry.resourceId,
    details: entry.details || {},
    timestamp: now,
    createdAt: now,
  };

  const logs = [logRecord, ...getCachedStaffAuditLogs()].slice(0, 200);
  setCachedStaffAuditLogs(logs);

  if (isSupabaseConfigured()) {
    try {
      await supabase.from("staff_audit_logs").insert({
        id: logRecord.id,
        actor_id: currentAdmin?.id && currentAdmin.id.length === 36 ? currentAdmin.id : null,
        actor_email: logRecord.actorEmail,
        actor_role: logRecord.actorRole,
        action: logRecord.action,
        resource_type: logRecord.resourceType,
        resource_id: logRecord.resourceId,
        details: logRecord.details,
        created_at: now,
      });
    } catch (err) {
      console.warn("Supabase staff audit log write note:", err);
    }
  }

  return logRecord;
}

/**
 * Fetch all staff members from Supabase profiles and local cache
 */
export async function fetchStaffMembers(): Promise<{
  staff: StaffMember[];
  invitations: StaffInvitation[];
}> {
  const cachedStaff = getCachedStaffMembers();
  const cachedInvites = getCachedStaffInvitations();

  if (!isSupabaseConfigured()) {
    return { staff: cachedStaff, invitations: cachedInvites };
  }

  try {
    // 1. Fetch profiles having a staff role or admin role
    const { data: profilesData, error: profError } = await supabase
      .from("profiles")
      .select("id, email, display_name, photo_url, role, staff_role, staff_status, staff_permissions, assigned_subjects, invited_by, invited_at, last_active_at, created_at, updated_at")
      .or("staff_role.in.(super_admin,admin,sme_teacher,content_reviewer,support_agent),role.eq.admin");

    let liveStaff: StaffMember[] = [];
    if (!profError && profilesData && profilesData.length > 0) {
      liveStaff = profilesData.map((row: any) => {
        const isSuper = ADMIN_EMAILS.some((e) => e.toLowerCase() === (row.email || "").toLowerCase()) ||
          ADMIN_UIDS.includes(row.id);
        const effectiveRole: StaffRole = isSuper 
          ? "super_admin" 
          : (row.staff_role || (row.role === "admin" ? "admin" : "student"));

        return {
          id: row.id,
          email: row.email || "",
          name: row.display_name || "Staff Member",
          displayName: row.display_name,
          photoURL: row.photo_url,
          avatar: row.photo_url,
          role: effectiveRole,
          status: (row.staff_status as StaffStatus) || "active",
          permissions: row.staff_permissions || DEFAULT_ROLE_PERMISSIONS[effectiveRole],
          assignedSubjects: row.assigned_subjects || ["All Subjects"],
          invitedBy: row.invited_by,
          invitedAt: row.invited_at,
          lastActiveAt: row.last_active_at || row.updated_at,
          createdAt: row.created_at || new Date().toISOString(),
          updatedAt: row.updated_at,
        };
      });
    }

    // Merge live with cache, preserving seeds if database has few
    const mergedStaffMap = new Map<string, StaffMember>();
    for (const m of cachedStaff) {
      mergedStaffMap.set(m.id, m);
    }
    for (const m of liveStaff) {
      mergedStaffMap.set(m.id, m);
    }
    const finalStaff = Array.from(mergedStaffMap.values());
    setCachedStaffMembers(finalStaff);

    // 2. Fetch active invitations
    let liveInvites: StaffInvitation[] = cachedInvites;
    const { data: invitesData, error: invError } = await supabase
      .from("staff_invitations")
      .select("*")
      .order("created_at", { ascending: false });

    if (!invError && invitesData) {
      liveInvites = invitesData.map((row: any) => ({
        id: row.id,
        email: row.email,
        role: row.role as StaffRole,
        permissions: row.permissions,
        assignedSubjects: row.assigned_subjects,
        token: row.token,
        invitedBy: row.invited_by,
        status: row.status,
        createdAt: row.created_at,
        expiresAt: row.expires_at,
      }));
      setCachedStaffInvitations(liveInvites);
    }

    return { staff: finalStaff, invitations: liveInvites };
  } catch (err) {
    console.warn("fetchStaffMembers error:", err);
    return { staff: cachedStaff, invitations: cachedInvites };
  }
}

/**
 * Invite a new staff member
 */
export async function inviteStaffMember(params: {
  email: string;
  name: string;
  role: StaffRole;
  permissions?: Partial<Record<PermissionResource, PermissionAction[]>>;
  assignedSubjects?: string[];
}): Promise<{ invitation: StaffInvitation; staffMember: StaffMember }> {
  const currentAdmin = loadUserProfile();
  const cleanEmail = params.email.trim().toLowerCase();
  const now = new Date().toISOString();
  const token = `inv_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const role = params.role || "sme_teacher";
  const permissions = params.permissions || DEFAULT_ROLE_PERMISSIONS[role];
  const assignedSubjects = params.assignedSubjects && params.assignedSubjects.length > 0 
    ? params.assignedSubjects 
    : ["All Subjects"];

  const invitation: StaffInvitation = {
    id: typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `inv_id_${Date.now()}`,
    email: cleanEmail,
    name: params.name,
    role,
    permissions,
    assignedSubjects,
    token,
    invitedBy: currentAdmin?.id || "super_admin",
    invitedByName: currentAdmin?.name || "Super Admin",
    status: "pending",
    createdAt: now,
    expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString(),
  };

  const newStaffMember: StaffMember = {
    id: typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `staff_${Date.now()}`,
    email: cleanEmail,
    name: params.name,
    displayName: params.name,
    role,
    status: "invited",
    permissions,
    assignedSubjects,
    invitedBy: currentAdmin?.id,
    invitedByName: currentAdmin?.name,
    invitedAt: now,
    createdAt: now,
  };

  // 1. Update local caches
  const staff = [newStaffMember, ...getCachedStaffMembers().filter(m => m.email.toLowerCase() !== cleanEmail)];
  setCachedStaffMembers(staff);

  const invitations = [invitation, ...getCachedStaffInvitations().filter(i => i.email.toLowerCase() !== cleanEmail)];
  setCachedStaffInvitations(invitations);

  // 2. Persist to Supabase
  if (isSupabaseConfigured()) {
    try {
      await supabase.from("staff_invitations").insert({
        id: invitation.id,
        email: cleanEmail,
        role,
        permissions,
        assigned_subjects: assignedSubjects,
        token,
        invited_by: currentAdmin?.id && currentAdmin.id.length === 36 ? currentAdmin.id : null,
        status: "pending",
        created_at: now,
        expires_at: invitation.expiresAt,
      });

      // Also check if a profile already exists for this email and elevate it
      const { data: existingProfile } = await supabase
        .from("profiles")
        .select("id")
        .ilike("email", cleanEmail)
        .maybeSingle();

      if (existingProfile?.id) {
        await supabase.from("profiles").update({
          staff_role: role,
          staff_status: "invited",
          staff_permissions: permissions,
          assigned_subjects: assignedSubjects,
          invited_by: currentAdmin?.id && currentAdmin.id.length === 36 ? currentAdmin.id : null,
          invited_at: now,
          updated_at: now,
        }).eq("id", existingProfile.id);
      }
    } catch (err) {
      console.warn("Supabase invitation sync note:", err);
    }
  }

  // 3. Record Audit Log
  await recordStaffAuditLog({
    action: "invite_staff",
    resourceType: "staff",
    resourceId: newStaffMember.id,
    details: {
      invitedEmail: cleanEmail,
      invitedName: params.name,
      assignedRole: role,
      assignedSubjects,
    },
  });

  return { invitation, staffMember: newStaffMember };
}

/**
 * Update staff member role, permissions, and assigned subjects
 */
export async function updateStaffRoleAndPermissions(
  userId: string,
  newRole: StaffRole,
  permissions?: Partial<Record<PermissionResource, PermissionAction[]>>,
  assignedSubjects?: string[]
): Promise<StaffMember> {
  const currentAdmin = loadUserProfile();
  const staff = getCachedStaffMembers();
  const target = staff.find((s) => s.id === userId);

  if (!target) {
    throw new Error(`Staff member with ID ${userId} not found.`);
  }

  if (isSuperAdmin(target) && newRole !== "super_admin") {
    throw new Error("Action Forbidden: The primary Super Admin cannot be demoted.");
  }

  const finalPermissions = permissions || DEFAULT_ROLE_PERMISSIONS[newRole];
  const finalSubjects = assignedSubjects || target.assignedSubjects || ["All Subjects"];
  const now = new Date().toISOString();

  const updated: StaffMember = {
    ...target,
    role: newRole,
    permissions: finalPermissions,
    assignedSubjects: finalSubjects,
    updatedAt: now,
  };

  const updatedList = staff.map((s) => (s.id === userId ? updated : s));
  setCachedStaffMembers(updatedList);

  // Update Supabase
  if (isSupabaseConfigured()) {
    try {
      await supabase.from("profiles").update({
        role: newRole === "super_admin" || newRole === "admin" ? "admin" : "student",
        staff_role: newRole,
        staff_permissions: finalPermissions,
        assigned_subjects: finalSubjects,
        updated_at: now,
      }).eq("id", userId);
    } catch (err) {
      console.warn("Supabase updateStaffRoleAndPermissions note:", err);
    }
  }

  // If updating current active session
  if (currentAdmin && currentAdmin.id === userId) {
    currentAdmin.role = newRole as any;
    currentAdmin.staffRole = newRole;
    currentAdmin.staffPermissions = finalPermissions;
    currentAdmin.assignedSubjects = finalSubjects;
    try {
      localStorage.setItem("economic_survey_user_profile_v1", JSON.stringify(currentAdmin));
    } catch {}
  }

  await recordStaffAuditLog({
    action: "update_staff_role",
    resourceType: "staff",
    resourceId: userId,
    details: {
      targetEmail: target.email,
      targetName: target.name,
      previousRole: target.role,
      newRole,
    },
  });

  return updated;
}

/**
 * Suspend or reactivate staff member account
 */
export async function updateStaffStatus(
  userId: string,
  newStatus: StaffStatus,
  reason?: string
): Promise<StaffMember> {
  const currentAdmin = loadUserProfile();
  if (currentAdmin?.id === userId) {
    throw new Error("Action Restricted: You cannot suspend or deactivate your own account.");
  }

  const staff = getCachedStaffMembers();
  const target = staff.find((s) => s.id === userId);
  if (!target) {
    throw new Error(`Staff member with ID ${userId} not found.`);
  }

  if (isSuperAdmin(target)) {
    throw new Error("Action Forbidden: Super Administrators cannot be suspended.");
  }

  const now = new Date().toISOString();
  const updated: StaffMember = {
    ...target,
    status: newStatus,
    updatedAt: now,
  };

  const updatedList = staff.map((s) => (s.id === userId ? updated : s));
  setCachedStaffMembers(updatedList);

  if (isSupabaseConfigured()) {
    try {
      await supabase.from("profiles").update({
        staff_status: newStatus,
        blocked: newStatus === "suspended",
        updated_at: now,
      }).eq("id", userId);
    } catch (err) {
      console.warn("Supabase updateStaffStatus note:", err);
    }
  }

  await recordStaffAuditLog({
    action: newStatus === "suspended" ? "suspend_staff" : "reactivate_staff",
    resourceType: "staff",
    resourceId: userId,
    details: {
      targetEmail: target.email,
      targetName: target.name,
      previousStatus: target.status,
      newStatus,
      reason: reason || "Administrative action",
    },
  });

  return updated;
}

/**
 * Revoke staff access and demote back to standard student aspirant
 */
export async function revokeStaffAccess(userId: string): Promise<void> {
  const currentAdmin = loadUserProfile();
  if (currentAdmin?.id === userId) {
    throw new Error("Action Restricted: You cannot remove your own staff access.");
  }

  const staff = getCachedStaffMembers();
  const target = staff.find((s) => s.id === userId);
  if (!target) return;

  if (isSuperAdmin(target)) {
    throw new Error("Action Forbidden: Super Administrator access cannot be deleted.");
  }

  const updatedList = staff.filter((s) => s.id !== userId);
  setCachedStaffMembers(updatedList);

  // Clean pending invitations if any
  const invites = getCachedStaffInvitations().filter(i => i.email.toLowerCase() !== target.email.toLowerCase());
  setCachedStaffInvitations(invites);

  if (isSupabaseConfigured()) {
    try {
      await supabase.from("profiles").update({
        role: "student",
        staff_role: "student",
        staff_status: "active",
        staff_permissions: {},
        assigned_subjects: [],
        updated_at: new Date().toISOString(),
      }).eq("id", userId);

      await supabase.from("staff_invitations").update({
        status: "revoked",
      }).ilike("email", target.email);
    } catch (err) {
      console.warn("Supabase revokeStaffAccess note:", err);
    }
  }

  await recordStaffAuditLog({
    action: "delete_staff",
    resourceType: "staff",
    resourceId: userId,
    details: {
      revokedEmail: target.email,
      revokedName: target.name,
      previousRole: target.role,
    },
  });
}

/**
 * Fetch staff audit logs with optional filtering
 */
export async function fetchStaffAuditLogs(filters?: {
  actorRole?: StaffRole;
  action?: string;
  resourceType?: string;
  search?: string;
  limit?: number;
}): Promise<StaffAuditLog[]> {
  const cachedLogs = getCachedStaffAuditLogs();

  if (!isSupabaseConfigured()) {
    return filterAuditLogsLocally(cachedLogs, filters);
  }

  try {
    let query = supabase
      .from("staff_audit_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(filters?.limit || 100);

    if (filters?.actorRole) {
      query = query.eq("actor_role", filters.actorRole);
    }
    if (filters?.action) {
      query = query.eq("action", filters.action);
    }
    if (filters?.resourceType) {
      query = query.eq("resource_type", filters.resourceType);
    }

    const { data, error } = await query;
    if (error || !data) {
      return filterAuditLogsLocally(cachedLogs, filters);
    }

    const mapped: StaffAuditLog[] = data.map((row: any) => ({
      id: row.id,
      actorId: row.actor_id || "system",
      actorEmail: row.actor_email || "system@disha2020.in",
      actorRole: (row.actor_role as StaffRole) || "admin",
      action: row.action,
      resourceType: row.resource_type,
      resourceId: row.resource_id,
      details: row.details || {},
      ipAddress: row.ip_address,
      timestamp: row.created_at,
      createdAt: row.created_at,
    }));

    setCachedStaffAuditLogs(mapped);
    return filterAuditLogsLocally(mapped, filters);
  } catch {
    return filterAuditLogsLocally(cachedLogs, filters);
  }
}

function filterAuditLogsLocally(logs: StaffAuditLog[], filters?: {
  actorRole?: StaffRole;
  action?: string;
  resourceType?: string;
  search?: string;
}): StaffAuditLog[] {
  let result = [...logs];
  if (!filters) return result;

  if (filters.actorRole) {
    result = result.filter(l => l.actorRole === filters.actorRole);
  }
  if (filters.action) {
    result = result.filter(l => l.action.toLowerCase() === filters.action?.toLowerCase());
  }
  if (filters.resourceType) {
    result = result.filter(l => l.resourceType.toLowerCase() === filters.resourceType?.toLowerCase());
  }
  if (filters.search) {
    const s = filters.search.toLowerCase().trim();
    result = result.filter(l => 
      l.actorEmail.toLowerCase().includes(s) ||
      l.action.toLowerCase().includes(s) ||
      l.resourceType.toLowerCase().includes(s) ||
      JSON.stringify(l.details || {}).toLowerCase().includes(s)
    );
  }
  return result;
}
