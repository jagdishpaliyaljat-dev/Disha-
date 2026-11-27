import * as React from "react";
import { 
  Users, 
  ShieldCheck, 
  Shield, 
  UserPlus, 
  Search, 
  Filter, 
  RefreshCw, 
  MoreVertical, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  Ban, 
  Trash2, 
  Edit3, 
  GraduationCap, 
  Headphones, 
  FileCheck, 
  X, 
  Sparkles, 
  Check, 
  Lock, 
  ChevronRight, 
  FileText, 
  Download, 
  ExternalLink,
  Layers,
  Calendar,
  Mail,
  User,
  Info
} from "lucide-react";
import { 
  StaffMember, 
  StaffInvitation, 
  StaffAuditLog, 
  StaffRole, 
  StaffStatus, 
  PermissionAction, 
  PermissionResource, 
  UserProfile 
} from "../../types";
import { 
  ROLE_CONFIGS, 
  ALL_PERMISSION_ACTIONS, 
  ALL_PERMISSION_RESOURCES, 
  DEFAULT_ROLE_PERMISSIONS, 
  getStaffRole, 
  isSuperAdminRole 
} from "../../utils/rbac";
import { 
  fetchStaffMembers, 
  inviteStaffMember, 
  updateStaffRoleAndPermissions, 
  updateStaffStatus, 
  revokeStaffAccess, 
  fetchStaffAuditLogs,
  getCachedStaffMembers,
  getCachedStaffInvitations,
  getCachedStaffAuditLogs
} from "../../utils/staffManagementService";
import { isSuperAdmin, loadUserProfile } from "../../utils/userProfileStorage";

interface StaffManagementSectionProps {
  currentUserProfile?: UserProfile | null;
}

export const StaffManagementSection: React.FC<StaffManagementSectionProps> = ({
  currentUserProfile,
}) => {
  const currentProfile = currentUserProfile || loadUserProfile();
  const isViewerSuper = isSuperAdmin(currentProfile) || isSuperAdminRole(currentProfile);

  // Data states
  const [staffList, setStaffList] = React.useState<StaffMember[]>(() => getCachedStaffMembers());
  const [invitations, setInvitations] = React.useState<StaffInvitation[]>(() => getCachedStaffInvitations());
  const [auditLogs, setAuditLogs] = React.useState<StaffAuditLog[]>(() => getCachedStaffAuditLogs());
  const [isLoading, setIsLoading] = React.useState(false);
  const [actionLoadingId, setActionLoadingId] = React.useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = React.useState("");
  const [roleFilter, setRoleFilter] = React.useState<string>("all");
  const [statusFilter, setStatusFilter] = React.useState<string>("all");
  const [activeViewTab, setActiveViewTab] = React.useState<"staff" | "matrix" | "audit">("staff");

  // Modals
  const [showInviteModal, setShowInviteModal] = React.useState(false);
  const [editingStaffMember, setEditingStaffMember] = React.useState<StaffMember | null>(null);
  const [suspendingStaffMember, setSuspendingStaffMember] = React.useState<StaffMember | null>(null);
  const [suspendReason, setSuspendReason] = React.useState("");
  const [deletingStaffMember, setDeletingStaffMember] = React.useState<StaffMember | null>(null);
  const [selectedAuditLog, setSelectedAuditLog] = React.useState<StaffAuditLog | null>(null);

  // Feedback notifications
  const [toast, setToast] = React.useState<{ type: "success" | "error"; message: string } | null>(null);

  const showToast = (message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // Load staff data
  const loadData = React.useCallback(async (notify = false) => {
    setIsLoading(true);
    try {
      const res = await fetchStaffMembers();
      setStaffList(res.staff);
      setInvitations(res.invitations);
      const logs = await fetchStaffAuditLogs();
      setAuditLogs(logs);
      if (notify) {
        showToast("Staff directory refreshed successfully.");
      }
    } catch (err: any) {
      console.warn("Staff data load error:", err);
      if (notify) {
        showToast(err?.message || "Failed to refresh staff records.", "error");
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadData(false);
  }, [loadData]);

  // Statistics calculation
  const stats = React.useMemo(() => {
    const total = staffList.length;
    const superAdmins = staffList.filter(s => s.role === "super_admin").length;
    const smes = staffList.filter(s => s.role === "sme_teacher").length;
    const reviewers = staffList.filter(s => s.role === "content_reviewer").length;
    const support = staffList.filter(s => s.role === "support_agent").length;
    const suspended = staffList.filter(s => s.status === "suspended").length;
    const pendingInvites = invitations.filter(i => i.status === "pending").length;
    return { total, superAdmins, smes, reviewers, support, suspended, pendingInvites };
  }, [staffList, invitations]);

  // Filtered staff list
  const filteredStaff = React.useMemo(() => {
    return staffList.filter((m) => {
      if (roleFilter !== "all" && m.role !== roleFilter) return false;
      if (statusFilter !== "all" && m.status !== statusFilter) return false;
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const matchName = m.name.toLowerCase().includes(query);
        const matchEmail = m.email.toLowerCase().includes(query);
        const matchRole = (ROLE_CONFIGS[m.role]?.label || "").toLowerCase().includes(query);
        const matchSubjects = (m.assignedSubjects || []).some(s => s.toLowerCase().includes(query));
        return matchName || matchEmail || matchRole || matchSubjects;
      }
      return true;
    });
  }, [staffList, roleFilter, statusFilter, searchQuery]);

  // Handle account suspension toggle
  const handleToggleSuspend = async () => {
    if (!suspendingStaffMember) return;
    const target = suspendingStaffMember;
    const newStatus: StaffStatus = target.status === "suspended" ? "active" : "suspended";
    setActionLoadingId(target.id);
    try {
      const updated = await updateStaffStatus(target.id, newStatus, suspendReason);
      setStaffList(prev => prev.map(s => s.id === target.id ? updated : s));
      showToast(
        newStatus === "suspended"
          ? `Staff account "${target.name}" has been suspended.`
          : `Staff account "${target.name}" has been re-activated.`
      );
      setSuspendingStaffMember(null);
      setSuspendReason("");
    } catch (err: any) {
      showToast(err?.message || "Failed to update staff status.", "error");
    } finally {
      setActionLoadingId(null);
    }
  };

  // Handle staff removal
  const handleRevokeStaff = async () => {
    if (!deletingStaffMember) return;
    const target = deletingStaffMember;
    setActionLoadingId(target.id);
    try {
      await revokeStaffAccess(target.id);
      setStaffList(prev => prev.filter(s => s.id !== target.id));
      showToast(`Access revoked for "${target.name}". Demoted to student role.`);
      setDeletingStaffMember(null);
    } catch (err: any) {
      showToast(err?.message || "Failed to revoke staff access.", "error");
    } finally {
      setActionLoadingId(null);
    }
  };

  // Export staff directory to CSV
  const handleExportStaffCSV = () => {
    try {
      const headers = ["ID", "Name", "Email", "Role", "Status", "Assigned Subjects", "Joined Date"];
      const rows = staffList.map(m => [
        m.id,
        `"${m.name.replace(/"/g, '""')}"`,
        `"${m.email}"`,
        m.role,
        m.status,
        `"${(m.assignedSubjects || []).join(", ").replace(/"/g, '""')}"`,
        m.createdAt,
      ]);
      const csvContent = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `disha2020_staff_directory_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showToast("Staff directory exported successfully.");
    } catch {
      showToast("Failed to export staff CSV.", "error");
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 flex items-center gap-2.5 px-4 py-3 rounded-2xl shadow-xl border text-sm font-bold backdrop-blur-md transition-all animate-in fade-in slide-in-from-top-2 ${
          toast.type === "success" 
            ? "bg-emerald-500/90 text-white border-emerald-400" 
            : "bg-rose-500/90 text-white border-rose-400"
        }`}>
          {toast.type === "success" ? <CheckCircle2 className="w-5 h-5 shrink-0" /> : <AlertCircle className="w-5 h-5 shrink-0" />}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Header Banner */}
      <div className="bg-white dark:bg-[#111A2E] border border-slate-200/80 dark:border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center shrink-0 shadow-xs">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
                <span>Staff Management &amp; Role-Based Access</span>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 font-extrabold">
                  Enterprise RBAC
                </span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Predefined roles, granular capabilities, staff onboarding invitations, and live audit telemetry.
              </p>
            </div>
          </div>
        </div>

        {/* View Tabs & Actions */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="p-1 bg-slate-100 dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700 flex items-center">
            <button
              onClick={() => setActiveViewTab("staff")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                activeViewTab === "staff"
                  ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs"
                  : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              Staff Directory ({staffList.length})
            </button>
            <button
              onClick={() => setActiveViewTab("matrix")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                activeViewTab === "matrix"
                  ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs"
                  : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              Permissions Matrix
            </button>
            <button
              onClick={() => setActiveViewTab("audit")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                activeViewTab === "audit"
                  ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs"
                  : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              Audit Trail ({auditLogs.length})
            </button>
          </div>

          <button
            onClick={() => loadData(true)}
            disabled={isLoading}
            className="p-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            title="Refresh Staff Directory"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
          </button>

          {isViewerSuper && (
            <button
              onClick={() => setShowInviteModal(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-extrabold text-xs shadow-xs transition-all hover:shadow-md cursor-pointer"
            >
              <UserPlus className="w-4 h-4" />
              <span>Invite Staff Member</span>
            </button>
          )}
        </div>
      </div>

      {/* KPI Statistic Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-white dark:bg-[#111A2E] p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">Total Staff</span>
            <Users className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="text-xl font-black text-slate-900 dark:text-white mt-1.5">{stats.total}</div>
        </div>

        <div className="bg-white dark:bg-[#111A2E] p-3.5 rounded-2xl border border-purple-200/60 dark:border-purple-900/30 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-purple-600 dark:text-purple-400">Super Admins</span>
            <Shield className="w-4 h-4 text-purple-500" />
          </div>
          <div className="text-xl font-black text-purple-700 dark:text-purple-300 mt-1.5">{stats.superAdmins}</div>
        </div>

        <div className="bg-white dark:bg-[#111A2E] p-3.5 rounded-2xl border border-blue-200/60 dark:border-blue-900/30 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-blue-600 dark:text-blue-400">SME / Teachers</span>
            <GraduationCap className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-xl font-black text-blue-700 dark:text-blue-300 mt-1.5">{stats.smes}</div>
        </div>

        <div className="bg-white dark:bg-[#111A2E] p-3.5 rounded-2xl border border-amber-200/60 dark:border-amber-900/30 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400">Reviewers</span>
            <FileCheck className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-xl font-black text-amber-700 dark:text-amber-300 mt-1.5">{stats.reviewers}</div>
        </div>

        <div className="bg-white dark:bg-[#111A2E] p-3.5 rounded-2xl border border-emerald-200/60 dark:border-emerald-900/30 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">Support Desk</span>
            <Headphones className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-xl font-black text-emerald-700 dark:text-emerald-300 mt-1.5">{stats.support}</div>
        </div>

        <div className="bg-white dark:bg-[#111A2E] p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">Pending / Susp.</span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-xl font-black text-slate-900 dark:text-white mt-1.5">
            {stats.pendingInvites + stats.suspended}
          </div>
        </div>
      </div>

      {/* TAB 1: Staff Directory View */}
      {activeViewTab === "staff" && (
        <div className="space-y-4">
          {/* Search & Filters */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white dark:bg-[#111A2E] p-3 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search by name, email, or subject..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto no-scrollbar">
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="px-3 py-2 rounded-xl text-xs font-semibold bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 focus:outline-hidden"
              >
                <option value="all">All Roles</option>
                <option value="super_admin">Super Admin</option>
                <option value="sme_teacher">SME / Teacher</option>
                <option value="content_reviewer">Content Reviewer</option>
                <option value="support_agent">Support Agent</option>
              </select>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 rounded-xl text-xs font-semibold bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 focus:outline-hidden"
              >
                <option value="all">All Statuses</option>
                <option value="active">Active</option>
                <option value="suspended">Suspended</option>
                <option value="invited">Pending Invite</option>
              </select>

              <button
                onClick={handleExportStaffCSV}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition-colors shrink-0"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export CSV</span>
              </button>
            </div>
          </div>

          {/* Staff Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredStaff.map((member) => {
              const roleConfig = ROLE_CONFIGS[member.role] || ROLE_CONFIGS.student;
              const isSuper = member.role === "super_admin";
              const isCurrentSessionUser = currentProfile?.id === member.id;

              return (
                <div
                  key={member.id}
                  className={`bg-white dark:bg-[#111A2E] rounded-3xl border transition-all duration-200 p-5 shadow-xs flex flex-col justify-between ${
                    member.status === "suspended"
                      ? "border-rose-300/80 dark:border-rose-900/40 bg-rose-50/20"
                      : "border-slate-200/80 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-800"
                  }`}
                >
                  <div>
                    {/* Top row: Avatar + Name + Status */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center font-bold text-base shadow-xs shrink-0 overflow-hidden">
                          {member.photoURL ? (
                            <img src={member.photoURL} alt={member.name} className="w-full h-full object-cover" />
                          ) : (
                            member.name.charAt(0).toUpperCase()
                          )}
                        </div>
                        <div className="min-w-0">
                          <h3 className="font-extrabold text-sm text-slate-900 dark:text-white truncate flex items-center gap-1.5">
                            <span>{member.name}</span>
                            {isSuper && <Shield className="w-3.5 h-3.5 text-purple-600 shrink-0" />}
                          </h3>
                          <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">{member.email}</p>
                        </div>
                      </div>

                      {/* Status Badge */}
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold flex items-center gap-1 border shrink-0 ${
                        member.status === "active"
                          ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800"
                          : member.status === "suspended"
                          ? "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border-rose-200 dark:border-rose-800"
                          : "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border-amber-200 dark:border-amber-800"
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${
                          member.status === "active" ? "bg-emerald-500 animate-pulse" : member.status === "suspended" ? "bg-rose-500" : "bg-amber-500"
                        }`} />
                        {member.status === "active" ? "Active" : member.status === "suspended" ? "Suspended" : "Invited"}
                      </span>
                    </div>

                    {/* Role Tag & Description */}
                    <div className="mt-3.5 space-y-2">
                      <div className="flex items-center gap-2">
                        <span className={`px-2.5 py-1 rounded-xl text-xs font-black border flex items-center gap-1.5 ${roleConfig.badgeBg} ${roleConfig.badgeBorder} ${roleConfig.badgeText}`}>
                          {member.role === "super_admin" && <Shield className="w-3.5 h-3.5" />}
                          {member.role === "sme_teacher" && <GraduationCap className="w-3.5 h-3.5" />}
                          {member.role === "content_reviewer" && <FileCheck className="w-3.5 h-3.5" />}
                          {member.role === "support_agent" && <Headphones className="w-3.5 h-3.5" />}
                          <span>{roleConfig.label}</span>
                        </span>
                      </div>

                      <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2">
                        {roleConfig.description}
                      </p>
                    </div>

                    {/* Assigned Subjects */}
                    <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800/80">
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                        Assigned Domains &amp; Subjects
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {(member.assignedSubjects && member.assignedSubjects.length > 0 ? member.assignedSubjects : ["All Curriculum"]).map((sub, idx) => (
                          <span
                            key={idx}
                            className="text-[10px] px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium"
                          >
                            {sub}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Card Bottom Actions */}
                  <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between gap-2">
                    <span className="text-[10px] text-slate-400 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {member.lastActiveAt ? `Active ${new Date(member.lastActiveAt).toLocaleDateString()}` : "Active recently"}
                    </span>

                    {/* Action buttons (Super Admin only, or restricted for self) */}
                    {isViewerSuper && !isSuper && (
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => setEditingStaffMember(member)}
                          className="px-2.5 py-1 rounded-xl text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition-colors flex items-center gap-1 cursor-pointer"
                        >
                          <Edit3 className="w-3 h-3" />
                          <span>Edit</span>
                        </button>

                        <button
                          onClick={() => {
                            setSuspendingStaffMember(member);
                            setSuspendReason("");
                          }}
                          disabled={actionLoadingId === member.id || isCurrentSessionUser}
                          className={`px-2.5 py-1 rounded-xl text-xs font-bold transition-colors flex items-center gap-1 cursor-pointer ${
                            member.status === "suspended"
                              ? "text-emerald-600 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/40"
                              : "text-amber-600 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-950/40"
                          }`}
                        >
                          <Ban className="w-3 h-3" />
                          <span>{member.status === "suspended" ? "Unsuspend" : "Suspend"}</span>
                        </button>

                        <button
                          onClick={() => setDeletingStaffMember(member)}
                          disabled={actionLoadingId === member.id || isCurrentSessionUser}
                          className="p-1 rounded-xl text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                          title="Revoke Staff Access"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {filteredStaff.length === 0 && (
            <div className="bg-white dark:bg-[#111A2E] rounded-3xl p-8 text-center border border-slate-200/80 dark:border-slate-800">
              <Users className="w-10 h-10 text-slate-400 mx-auto mb-2 opacity-40" />
              <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">No staff members found</h4>
              <p className="text-xs text-slate-500 mt-1">Try adjusting your search query or role filter.</p>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: Permissions Matrix View */}
      {activeViewTab === "matrix" && (
        <div className="bg-white dark:bg-[#111A2E] rounded-3xl border border-slate-200/80 dark:border-slate-800 p-5 sm:p-6 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
            <div>
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                Role-Based Capability Matrix (RBAC)
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Exact permissions enforced by the server and client application across system resources.
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
              <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                <Check className="w-3.5 h-3.5" /> Allowed
              </span>
              <span>•</span>
              <span className="flex items-center gap-1 text-slate-400">
                <X className="w-3.5 h-3.5" /> Denied
              </span>
            </div>
          </div>

          <div className="overflow-x-auto no-scrollbar">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] font-black uppercase text-slate-400 tracking-wider">
                  <th className="py-3 px-3">Resource / Module</th>
                  <th className="py-3 px-3 text-center text-purple-600 dark:text-purple-400">Super Admin</th>
                  <th className="py-3 px-3 text-center text-blue-600 dark:text-blue-400">SME / Teacher</th>
                  <th className="py-3 px-3 text-center text-amber-600 dark:text-amber-400">Content Reviewer</th>
                  <th className="py-3 px-3 text-center text-emerald-600 dark:text-emerald-400">Support Agent</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                {ALL_PERMISSION_RESOURCES.map((resource) => {
                  const superPerms = DEFAULT_ROLE_PERMISSIONS.super_admin[resource.id] || [];
                  const smePerms = DEFAULT_ROLE_PERMISSIONS.sme_teacher[resource.id] || [];
                  const reviewerPerms = DEFAULT_ROLE_PERMISSIONS.content_reviewer[resource.id] || [];
                  const supportPerms = DEFAULT_ROLE_PERMISSIONS.support_agent[resource.id] || [];

                  return (
                    <tr key={resource.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30">
                      <td className="py-3 px-3 font-bold text-slate-900 dark:text-white">
                        <div>{resource.label}</div>
                        <div className="text-[10px] font-normal text-slate-400">{resource.description}</div>
                      </td>

                      {/* Super Admin */}
                      <td className="py-3 px-3 text-center">
                        <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-lg bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 font-extrabold text-[10px]">
                          Full Access
                        </span>
                      </td>

                      {/* SME / Teacher */}
                      <td className="py-3 px-3 text-center">
                        {smePerms.length > 0 ? (
                          <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-lg bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 font-semibold text-[10px]">
                            {smePerms.join(", ")}
                          </span>
                        ) : (
                          <span className="text-slate-300 dark:text-slate-600 font-mono">—</span>
                        )}
                      </td>

                      {/* Content Reviewer */}
                      <td className="py-3 px-3 text-center">
                        {reviewerPerms.length > 0 ? (
                          <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-lg bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 font-semibold text-[10px]">
                            {reviewerPerms.join(", ")}
                          </span>
                        ) : (
                          <span className="text-slate-300 dark:text-slate-600 font-mono">—</span>
                        )}
                      </td>

                      {/* Support Agent */}
                      <td className="py-3 px-3 text-center">
                        {supportPerms.length > 0 ? (
                          <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-lg bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 font-semibold text-[10px]">
                            {supportPerms.join(", ")}
                          </span>
                        ) : (
                          <span className="text-slate-300 dark:text-slate-600 font-mono">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: Audit Logs View */}
      {activeViewTab === "audit" && (
        <div className="bg-white dark:bg-[#111A2E] rounded-3xl border border-slate-200/80 dark:border-slate-800 p-5 sm:p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <div>
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white">Staff Audit Trail</h3>
              <p className="text-xs text-slate-500 mt-0.5">Immutable record of role changes, staff invitations, and review decisions.</p>
            </div>
            <span className="text-xs font-bold text-slate-400">Total Events: {auditLogs.length}</span>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
            {auditLogs.map((log) => (
              <div 
                key={log.id} 
                onClick={() => setSelectedAuditLog(log)}
                className="py-3 flex items-start justify-between gap-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/40 px-2 rounded-xl transition-colors"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-xs text-slate-900 dark:text-white font-mono">
                      {log.action.replace(/_/g, " ").toUpperCase()}
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-semibold">
                      {log.resourceType}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Actor: <span className="font-semibold text-slate-700 dark:text-slate-300">{log.actorEmail}</span> ({log.actorRole})
                  </p>
                </div>

                <div className="text-right shrink-0">
                  <span className="text-[10px] text-slate-400 font-mono block">
                    {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </span>
                  <span className="text-[10px] text-slate-400 block">
                    {new Date(log.timestamp).toLocaleDateString()}
                  </span>
                </div>
              </div>
            ))}

            {auditLogs.length === 0 && (
              <div className="py-8 text-center text-xs text-slate-400">
                No staff audit events recorded yet.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────── */}
      {/* MODAL 1: Invite Staff Member Modal */}
      {/* ───────────────────────────────────────────────────────── */}
      {showInviteModal && (
        <InviteStaffModal
          onClose={() => setShowInviteModal(false)}
          onSuccess={(newStaff) => {
            setStaffList(prev => [newStaff, ...prev]);
            setShowInviteModal(false);
            showToast(`Invitation sent to "${newStaff.email}" with role "${ROLE_CONFIGS[newStaff.role]?.label}".`);
          }}
        />
      )}

      {/* ───────────────────────────────────────────────────────── */}
      {/* MODAL 2: Edit Staff Role & Permissions Modal */}
      {/* ───────────────────────────────────────────────────────── */}
      {editingStaffMember && (
        <EditStaffModal
          member={editingStaffMember}
          onClose={() => setEditingStaffMember(null)}
          onSuccess={(updated) => {
            setStaffList(prev => prev.map(s => s.id === updated.id ? updated : s));
            setEditingStaffMember(null);
            showToast(`Role and permissions updated for "${updated.name}".`);
          }}
        />
      )}

      {/* ───────────────────────────────────────────────────────── */}
      {/* MODAL 3: Suspend Confirmation Dialog */}
      {/* ───────────────────────────────────────────────────────── */}
      {suspendingStaffMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white dark:bg-[#111A2E] rounded-3xl border border-slate-200 dark:border-slate-800 p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-amber-600 dark:text-amber-400">
              <div className="w-10 h-10 rounded-2xl bg-amber-500/10 flex items-center justify-center shrink-0">
                <Ban className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-extrabold text-base text-slate-900 dark:text-white">
                  {suspendingStaffMember.status === "suspended" ? "Re-activate Staff Account" : "Suspend Staff Account"}
                </h3>
                <p className="text-xs text-slate-500">{suspendingStaffMember.name} ({suspendingStaffMember.email})</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300">
              {suspendingStaffMember.status === "suspended"
                ? "This will restore the staff member's administrative capabilities immediately."
                : "Suspended staff members will lose immediate access to administrative portals, curriculum authoring, and review tools."}
            </p>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                Reason for action (recorded in audit log)
              </label>
              <input
                type="text"
                placeholder="e.g., Extended sabbatical, security audit, change in role..."
                value={suspendReason}
                onChange={(e) => setSuspendReason(e.target.value)}
                className="w-full px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:outline-hidden"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setSuspendingStaffMember(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleToggleSuspend}
                disabled={actionLoadingId === suspendingStaffMember.id}
                className={`px-4 py-2 rounded-xl text-xs font-extrabold text-white shadow-xs transition-colors ${
                  suspendingStaffMember.status === "suspended"
                    ? "bg-emerald-600 hover:bg-emerald-700"
                    : "bg-rose-600 hover:bg-rose-700"
                }`}
              >
                {actionLoadingId === suspendingStaffMember.id ? "Processing..." : suspendingStaffMember.status === "suspended" ? "Confirm Unsuspend" : "Confirm Suspension"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────── */}
      {/* MODAL 4: Revoke Confirmation Dialog */}
      {/* ───────────────────────────────────────────────────────── */}
      {deletingStaffMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white dark:bg-[#111A2E] rounded-3xl border border-rose-200 dark:border-rose-900/40 p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="w-10 h-10 rounded-2xl bg-rose-500/10 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-extrabold text-base text-slate-900 dark:text-white">Revoke Staff Access</h3>
                <p className="text-xs text-slate-500">{deletingStaffMember.name} ({deletingStaffMember.email})</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300">
              Are you sure you want to permanently revoke this staff member&apos;s credentials? Their account will be converted to a regular student aspirant.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setDeletingStaffMember(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleRevokeStaff}
                disabled={actionLoadingId === deletingStaffMember.id}
                className="px-4 py-2 rounded-xl text-xs font-extrabold bg-rose-600 hover:bg-rose-700 text-white shadow-xs transition-colors"
              >
                {actionLoadingId === deletingStaffMember.id ? "Revoking..." : "Revoke Access"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────── */}
      {/* MODAL 5: Audit Log Detail Modal */}
      {/* ───────────────────────────────────────────────────────── */}
      {selectedAuditLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white dark:bg-[#111A2E] rounded-3xl border border-slate-200 dark:border-slate-800 p-6 max-w-lg w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-indigo-500" />
                <h3 className="font-extrabold text-base text-slate-900 dark:text-white">Audit Event Details</h3>
              </div>
              <button
                onClick={() => setSelectedAuditLog(null)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800/80">
                <span className="text-slate-400 font-bold">Action</span>
                <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">{selectedAuditLog.action}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800/80">
                <span className="text-slate-400 font-bold">Actor Email</span>
                <span className="font-semibold">{selectedAuditLog.actorEmail}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800/80">
                <span className="text-slate-400 font-bold">Actor Role</span>
                <span className="font-semibold">{selectedAuditLog.actorRole}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800/80">
                <span className="text-slate-400 font-bold">Timestamp</span>
                <span className="font-mono">{new Date(selectedAuditLog.timestamp).toLocaleString()}</span>
              </div>
            </div>

            <div>
              <span className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Payload Details</span>
              <pre className="p-3 rounded-2xl bg-slate-900 text-emerald-400 text-[11px] font-mono overflow-x-auto max-h-48">
                {JSON.stringify(selectedAuditLog.details || {}, null, 2)}
              </pre>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setSelectedAuditLog(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-white transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────
// SUB-COMPONENT: Invite Staff Member Modal
// ─────────────────────────────────────────────────────────────
interface InviteStaffModalProps {
  onClose: () => void;
  onSuccess: (newStaff: StaffMember) => void;
}

const InviteStaffModal: React.FC<InviteStaffModalProps> = ({ onClose, onSuccess }) => {
  const [email, setEmail] = React.useState("");
  const [name, setName] = React.useState("");
  const [role, setRole] = React.useState<StaffRole>("sme_teacher");
  const [subjectsText, setSubjectsText] = React.useState("Economics, General Studies");
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const cleanEmail = email.trim().toLowerCase();
    const cleanName = name.trim();
    if (!cleanEmail || !cleanEmail.includes("@")) {
      setErrorMsg("Please enter a valid email address.");
      return;
    }
    if (!cleanName) {
      setErrorMsg("Please enter the staff member's full name.");
      return;
    }

    const assignedSubjects = subjectsText
      .split(",")
      .map(s => s.trim())
      .filter(Boolean);

    setIsSubmitting(true);
    try {
      const res = await inviteStaffMember({
        email: cleanEmail,
        name: cleanName,
        role,
        assignedSubjects: assignedSubjects.length > 0 ? assignedSubjects : ["All Subjects"],
      });
      onSuccess(res.staffMember);
    } catch (err: any) {
      setErrorMsg(err?.message || "Failed to issue staff invitation.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
      <div className="bg-white dark:bg-[#111A2E] rounded-3xl border border-slate-200 dark:border-slate-800 p-6 max-w-lg w-full shadow-2xl space-y-5">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-slate-900 dark:text-white">Invite New Staff Member</h3>
              <p className="text-xs text-slate-500">Assign role credentials and subject ownership</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {errorMsg && (
          <div className="p-3 rounded-2xl bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200 dark:border-rose-800 text-xs font-semibold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Full Name</label>
            <input
              type="text"
              required
              placeholder="e.g. Dr. Rajesh Kumar"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Email Address</label>
            <input
              type="email"
              required
              placeholder="staff@disha2020.in"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5">Assign Role</label>
            <div className="grid grid-cols-2 gap-2">
              {(["sme_teacher", "content_reviewer", "support_agent", "super_admin"] as StaffRole[]).map((r) => {
                const cfg = ROLE_CONFIGS[r];
                const isSelected = role === r;
                return (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRole(r)}
                    className={`p-3 rounded-2xl border text-left transition-all ${
                      isSelected
                        ? "border-[#7045D8] bg-indigo-50/60 dark:bg-indigo-950/40 text-indigo-950 dark:text-white shadow-xs"
                        : "border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40 text-slate-700 dark:text-slate-300"
                    }`}
                  >
                    <div className="font-extrabold flex items-center justify-between">
                      <span>{cfg.label}</span>
                      {isSelected && <CheckCircle2 className="w-4 h-4 text-indigo-600" />}
                    </div>
                    <div className="text-[10px] text-slate-500 mt-1 line-clamp-2">{cfg.description}</div>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
              Assigned Subjects &amp; Scope (comma-separated)
            </label>
            <input
              type="text"
              placeholder="e.g. Economics, Rajasthan Economy, Polity"
              value={subjectsText}
              onChange={(e) => setSubjectsText(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2.5 rounded-xl font-extrabold bg-[#7045D8] hover:bg-[#5B32BF] text-white shadow-xs transition-colors flex items-center gap-2"
            >
              {isSubmitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
              <span>{isSubmitting ? "Inviting..." : "Send Invitation"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────
// SUB-COMPONENT: Edit Staff Role & Permissions Modal
// ─────────────────────────────────────────────────────────────
interface EditStaffModalProps {
  member: StaffMember;
  onClose: () => void;
  onSuccess: (updated: StaffMember) => void;
}

const EditStaffModal: React.FC<EditStaffModalProps> = ({ member, onClose, onSuccess }) => {
  const [role, setRole] = React.useState<StaffRole>(member.role);
  const [subjectsText, setSubjectsText] = React.useState((member.assignedSubjects || []).join(", "));
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMsg(null);

    const assignedSubjects = subjectsText
      .split(",")
      .map(s => s.trim())
      .filter(Boolean);

    try {
      const updated = await updateStaffRoleAndPermissions(
        member.id,
        role,
        DEFAULT_ROLE_PERMISSIONS[role],
        assignedSubjects.length > 0 ? assignedSubjects : ["All Subjects"]
      );
      onSuccess(updated);
    } catch (err: any) {
      setErrorMsg(err?.message || "Failed to update staff credentials.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
      <div className="bg-white dark:bg-[#111A2E] rounded-3xl border border-slate-200 dark:border-slate-800 p-6 max-w-lg w-full shadow-2xl space-y-5">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <div>
            <h3 className="font-extrabold text-base text-slate-900 dark:text-white">Edit Staff Member</h3>
            <p className="text-xs text-slate-500">{member.name} ({member.email})</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {errorMsg && (
          <div className="p-3 rounded-2xl bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200 dark:border-rose-800 text-xs font-semibold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5">Select Role</label>
            <div className="grid grid-cols-2 gap-2">
              {(["sme_teacher", "content_reviewer", "support_agent", "super_admin"] as StaffRole[]).map((r) => {
                const cfg = ROLE_CONFIGS[r];
                const isSelected = role === r;
                return (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRole(r)}
                    className={`p-3 rounded-2xl border text-left transition-all ${
                      isSelected
                        ? "border-[#7045D8] bg-indigo-50/60 dark:bg-indigo-950/40 text-indigo-950 dark:text-white shadow-xs"
                        : "border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40 text-slate-700 dark:text-slate-300"
                    }`}
                  >
                    <div className="font-extrabold flex items-center justify-between">
                      <span>{cfg.label}</span>
                      {isSelected && <CheckCircle2 className="w-4 h-4 text-indigo-600" />}
                    </div>
                    <div className="text-[10px] text-slate-500 mt-1 line-clamp-2">{cfg.description}</div>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
              Assigned Subjects &amp; Scope (comma-separated)
            </label>
            <input
              type="text"
              placeholder="e.g. Economics, Rajasthan Economy, Polity"
              value={subjectsText}
              onChange={(e) => setSubjectsText(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2.5 rounded-xl font-extrabold bg-[#7045D8] hover:bg-[#5B32BF] text-white shadow-xs transition-colors flex items-center gap-2"
            >
              {isSubmitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              <span>{isSubmitting ? "Saving..." : "Save Changes"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
