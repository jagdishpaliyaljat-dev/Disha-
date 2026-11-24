import { 
  StaffRole, 
  StaffStatus, 
  PermissionAction, 
  PermissionResource, 
  UserProfile 
} from "../types";
import { isSuperAdmin as isBaseSuperAdmin } from "./userProfileStorage";

export interface RoleConfig {
  id: StaffRole;
  label: string;
  shortLabel: string;
  description: string;
  badgeBg: string;
  badgeBorder: string;
  badgeText: string;
  colorName: "purple" | "blue" | "amber" | "emerald" | "slate";
}

export const ROLE_CONFIGS: Record<StaffRole, RoleConfig> = {
  super_admin: {
    id: "super_admin",
    label: "Super Admin",
    shortLabel: "Super Admin",
    description: "Complete platform control: staff account CRUD, role assignment, database explorer, API keys, and system settings.",
    badgeBg: "bg-purple-50 dark:bg-purple-950/40",
    badgeBorder: "border-purple-200 dark:border-purple-800",
    badgeText: "text-purple-700 dark:text-purple-300",
    colorName: "purple",
  },
  admin: {
    id: "admin",
    label: "System Admin",
    shortLabel: "Admin",
    description: "Platform management, content coordination, user activations, and operational monitoring.",
    badgeBg: "bg-indigo-50 dark:bg-indigo-950/40",
    badgeBorder: "border-indigo-200 dark:border-indigo-800",
    badgeText: "text-indigo-700 dark:text-indigo-300",
    colorName: "blue",
  },
  sme_teacher: {
    id: "sme_teacher",
    label: "SME / Teacher",
    shortLabel: "SME / Teacher",
    description: "Curriculum authoring, question creation, AI and bulk import. Submits drafted MCQs into the QA approval queue.",
    badgeBg: "bg-blue-50 dark:bg-blue-950/40",
    badgeBorder: "border-blue-200 dark:border-blue-800",
    badgeText: "text-blue-700 dark:text-blue-300",
    colorName: "blue",
  },
  content_reviewer: {
    id: "content_reviewer",
    label: "Content Reviewer",
    shortLabel: "Reviewer",
    description: "Quality assurance authority: review, approve, request revisions with feedback, and publish verified questions.",
    badgeBg: "bg-amber-50 dark:bg-amber-950/40",
    badgeBorder: "border-amber-200 dark:border-amber-800",
    badgeText: "text-amber-700 dark:text-amber-300",
    colorName: "amber",
  },
  support_agent: {
    id: "support_agent",
    label: "Support Agent",
    shortLabel: "Support",
    description: "Customer service & doubt desk: student feedback, question error reports, and contact message resolutions.",
    badgeBg: "bg-emerald-50 dark:bg-emerald-950/40",
    badgeBorder: "border-emerald-200 dark:border-emerald-800",
    badgeText: "text-emerald-700 dark:text-emerald-300",
    colorName: "emerald",
  },
  student: {
    id: "student",
    label: "Student Aspirant",
    shortLabel: "Student",
    description: "Aspirant test taker with access to practice questions, mock tests, and performance analytics.",
    badgeBg: "bg-slate-50 dark:bg-slate-800/50",
    badgeBorder: "border-slate-200 dark:border-slate-700",
    badgeText: "text-slate-700 dark:text-slate-300",
    colorName: "slate",
  },
  user: {
    id: "user",
    label: "Registered User",
    shortLabel: "User",
    description: "Standard registered user account.",
    badgeBg: "bg-slate-50 dark:bg-slate-800/50",
    badgeBorder: "border-slate-200 dark:border-slate-700",
    badgeText: "text-slate-700 dark:text-slate-300",
    colorName: "slate",
  },
};

export const ALL_PERMISSION_ACTIONS: PermissionAction[] = [
  "view",
  "create",
  "edit",
  "delete",
  "approve",
  "publish",
  "export",
  "manage",
];

export const ALL_PERMISSION_RESOURCES: { id: PermissionResource; label: string; description: string }[] = [
  { id: "curriculum", label: "Curriculum & Syllabus", description: "Subjects, chapters, and topic taxonomy" },
  { id: "questions", label: "Question Bank", description: "MCQs, options, explanations, and imports" },
  { id: "question_approval", label: "Review Pipeline", description: "Review queue, question approvals, and revision requests" },
  { id: "tests", label: "Exams & Mock Tests", description: "Live battles, mock tests, and PYQ vault" },
  { id: "content", label: "News & Banners", description: "Educational news feed and promotional banners" },
  { id: "users", label: "Student Directory", description: "Student accounts, status, and learning telemetry" },
  { id: "support", label: "Support & Doubts", description: "Contact messages, question reports, and bug triage" },
  { id: "staff", label: "Staff Management", description: "Staff accounts, invitations, and role assignments" },
  { id: "system_settings", label: "System Settings", description: "Feature flags, maintenance toggles, and app configurations" },
  { id: "database", label: "Supabase Cloud DB", description: "Direct data explorer, backup/restore, and database schema" },
  { id: "audit_logs", label: "Audit Logs", description: "Administrative actions, role updates, and event trails" },
  { id: "export", label: "Data Export & Reports", description: "Download CSV, JSON, and PDF merit reports" },
];

/**
 * Predefined role-to-permissions mapping
 */
export const DEFAULT_ROLE_PERMISSIONS: Record<StaffRole, Partial<Record<PermissionResource, PermissionAction[]>>> = {
  super_admin: {
    curriculum: ["view", "create", "edit", "delete", "approve", "publish", "export", "manage"],
    questions: ["view", "create", "edit", "delete", "approve", "publish", "export", "manage"],
    question_approval: ["view", "create", "edit", "delete", "approve", "publish", "export", "manage"],
    tests: ["view", "create", "edit", "delete", "approve", "publish", "export", "manage"],
    content: ["view", "create", "edit", "delete", "approve", "publish", "export", "manage"],
    users: ["view", "create", "edit", "delete", "approve", "publish", "export", "manage"],
    support: ["view", "create", "edit", "delete", "approve", "publish", "export", "manage"],
    staff: ["view", "create", "edit", "delete", "approve", "publish", "export", "manage"],
    system_settings: ["view", "create", "edit", "delete", "approve", "publish", "export", "manage"],
    database: ["view", "create", "edit", "delete", "approve", "publish", "export", "manage"],
    audit_logs: ["view", "export", "manage"],
    export: ["view", "export"],
  },
  admin: {
    curriculum: ["view", "create", "edit", "delete", "approve", "publish", "export", "manage"],
    questions: ["view", "create", "edit", "delete", "approve", "publish", "export", "manage"],
    question_approval: ["view", "edit", "approve", "publish", "manage"],
    tests: ["view", "create", "edit", "publish", "export", "manage"],
    content: ["view", "create", "edit", "delete", "publish", "manage"],
    users: ["view", "edit", "manage"],
    support: ["view", "edit", "manage"],
    staff: ["view"],
    system_settings: ["view", "edit"],
    database: ["view", "export"],
    audit_logs: ["view", "export"],
    export: ["view", "export"],
  },
  sme_teacher: {
    curriculum: ["view", "create", "edit", "export"],
    questions: ["view", "create", "edit", "export"],
    question_approval: ["view"], // can view status of their own questions
    tests: ["view", "create", "edit", "export"],
    content: ["view"],
    users: [],
    support: ["view"], // can view question error feedback for their subjects
    staff: [],
    system_settings: [],
    database: [],
    audit_logs: ["view"],
    export: ["view", "export"],
  },
  content_reviewer: {
    curriculum: ["view"],
    questions: ["view", "edit", "approve", "publish", "export"],
    question_approval: ["view", "edit", "approve", "publish", "manage"],
    tests: ["view", "approve"],
    content: ["view", "edit", "publish"],
    users: [],
    support: ["view", "edit"], // can view question error reports and correct them
    staff: [],
    system_settings: [],
    database: [],
    audit_logs: ["view"],
    export: ["view", "export"],
  },
  support_agent: {
    curriculum: ["view"],
    questions: ["view"],
    question_approval: [],
    tests: ["view"],
    content: ["view"],
    users: ["view"],
    support: ["view", "edit", "manage"],
    staff: [],
    system_settings: [],
    database: [],
    audit_logs: ["view"],
    export: [],
  },
  student: {
    curriculum: ["view"],
    questions: ["view"],
    question_approval: [],
    tests: ["view"],
    content: ["view"],
    users: [],
    support: [],
    staff: [],
    system_settings: [],
    database: [],
    audit_logs: [],
    export: [],
  },
  user: {
    curriculum: ["view"],
    questions: ["view"],
    question_approval: [],
    tests: ["view"],
    content: ["view"],
    users: [],
    support: [],
    staff: [],
    system_settings: [],
    database: [],
    audit_logs: [],
    export: [],
  },
};

/**
 * Determine the effective staff role for a user profile
 */
export function getStaffRole(profile: UserProfile | null | undefined): StaffRole {
  if (!profile) return "student";
  if (isBaseSuperAdmin(profile) || profile.role === "super_admin" || profile.staffRole === "super_admin") {
    return "super_admin";
  }
  if (profile.staffRole && Object.keys(ROLE_CONFIGS).includes(profile.staffRole)) {
    return profile.staffRole;
  }
  if (profile.role && Object.keys(ROLE_CONFIGS).includes(profile.role)) {
    return profile.role as StaffRole;
  }
  return "student";
}

/**
 * Check if user is any staff role (has access to Staff/Admin portal)
 */
export function isStaffUser(profileOrRole?: UserProfile | string | null): boolean {
  if (!profileOrRole) return false;
  if (typeof profileOrRole === "string") {
    const cleaned = profileOrRole.trim().toLowerCase();
    return ["super_admin", "admin", "sme_teacher", "content_reviewer", "support_agent"].includes(cleaned) ||
      isBaseSuperAdmin(cleaned);
  }
  if (profileOrRole.status === "suspended" || profileOrRole.staffStatus === "suspended" || profileOrRole.blocked) {
    return false;
  }
  if (isBaseSuperAdmin(profileOrRole)) return true;
  const role = getStaffRole(profileOrRole);
  return ["super_admin", "admin", "sme_teacher", "content_reviewer", "support_agent"].includes(role);
}

/**
 * Check if user is Super Admin
 */
export function isSuperAdminRole(profileOrRole?: UserProfile | string | null): boolean {
  if (!profileOrRole) return false;
  if (typeof profileOrRole === "string") {
    const cleaned = profileOrRole.trim().toLowerCase();
    return cleaned === "super_admin" || isBaseSuperAdmin(cleaned);
  }
  if (isBaseSuperAdmin(profileOrRole)) return true;
  return profileOrRole.role === "super_admin" || profileOrRole.staffRole === "super_admin";
}

/**
 * Evaluate granular permission for a user
 */
export function hasPermission(
  profile: UserProfile | null | undefined,
  resource: PermissionResource,
  action: PermissionAction
): boolean {
  if (!profile) return false;
  if (profile.status === "suspended" || profile.staffStatus === "suspended" || profile.blocked) {
    return false;
  }

  // Super Admin bypasses all checks
  if (isSuperAdminRole(profile)) return true;

  // Custom user permissions override if defined
  if (profile.staffPermissions && profile.staffPermissions[resource]) {
    const actions = profile.staffPermissions[resource];
    if (Array.isArray(actions) && (actions.includes(action) || actions.includes("manage"))) {
      return true;
    }
  }

  // Default role-based permissions lookup
  const role = getStaffRole(profile);
  const rolePermissions = DEFAULT_ROLE_PERMISSIONS[role];
  if (!rolePermissions) return false;

  const allowedActions = rolePermissions[resource] || [];
  return allowedActions.includes(action) || allowedActions.includes("manage");
}

// ── Specific Capability Convenience Helpers ──

export function canManageStaff(profile: UserProfile | null | undefined): boolean {
  return hasPermission(profile, "staff", "manage") || isSuperAdminRole(profile);
}

export function canApproveQuestions(profile: UserProfile | null | undefined): boolean {
  return hasPermission(profile, "question_approval", "approve") || isSuperAdminRole(profile);
}

export function canPublishQuestions(profile: UserProfile | null | undefined): boolean {
  return hasPermission(profile, "questions", "publish") || 
         hasPermission(profile, "question_approval", "publish") || 
         isSuperAdminRole(profile);
}

export function canCreateQuestions(profile: UserProfile | null | undefined): boolean {
  return hasPermission(profile, "questions", "create") || isSuperAdminRole(profile);
}

export function canEditCurriculum(profile: UserProfile | null | undefined): boolean {
  return hasPermission(profile, "curriculum", "create") || 
         hasPermission(profile, "curriculum", "edit") || 
         isSuperAdminRole(profile);
}

export function canDeleteQuestions(profile: UserProfile | null | undefined): boolean {
  return hasPermission(profile, "questions", "delete") || isSuperAdminRole(profile);
}

export function canManageSystemSettings(profile: UserProfile | null | undefined): boolean {
  return hasPermission(profile, "system_settings", "manage") || isSuperAdminRole(profile);
}

export function canAccessDatabase(profile: UserProfile | null | undefined): boolean {
  return hasPermission(profile, "database", "view") || isSuperAdminRole(profile);
}

export function canViewSupportDesk(profile: UserProfile | null | undefined): boolean {
  return hasPermission(profile, "support", "view") || isStaffUser(profile);
}

export function canExportData(profile: UserProfile | null | undefined): boolean {
  return hasPermission(profile, "export", "export") || isSuperAdminRole(profile);
}
