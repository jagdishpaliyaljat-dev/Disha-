import * as React from "react";
import { 
  Users, 
  Search, 
  X, 
  CheckCircle2, 
  AlertCircle, 
  UserCheck, 
  Ban, 
  Trash2,
  RefreshCw, 
  ShieldCheck, 
  Shield, 
  Activity,
  ChevronRight,
  ChevronLeft,
  Loader2,
  Clock,
  LayoutGrid,
  Filter,
  User,
  UserX,
  Crown,
  ShieldAlert,
  Lock,
  Mail
} from "lucide-react";
import { UserProfile } from "../../types";
import { 
  fetchRegisteredUsers, 
  updateUserAccountStatus, 
  deleteUserAccount, 
  updateUserRole,
  promoteUserByEmail,
  fetchUserActivityData, 
  UserActivitySummary 
} from "../../utils/userManagementStorage";
import { isSuperAdmin, loadUserProfile } from "../../utils/userProfileStorage";
import { CardGridSkeleton } from "./AdminSkeletonLoaders";

interface AdminUserManagementSectionProps {
  initialSelectedUser?: UserProfile | null;
  onClearInitialUser?: () => void;
}

const UserDetailView: React.FC<{
  user: UserProfile;
  activity: UserActivitySummary | null;
  loading: boolean;
  actionLoading: string | null;
  isViewerSuperAdmin: boolean;
  onClose: () => void;
  onUpdateStatus: (user: UserProfile, status: "active" | "inactive" | "blocked") => void;
  onUpdateRole: (user: UserProfile, role: "admin" | "student") => void;
  onDelete: (user: UserProfile) => void;
}> = ({ 
  user, 
  activity, 
  loading, 
  actionLoading, 
  isViewerSuperAdmin,
  onClose, 
  onUpdateStatus, 
  onUpdateRole, 
  onDelete 
}) => {
  const [showDeleteConfirm, setShowDeleteConfirm] = React.useState(false);
  const isTargetSuper = isSuperAdmin(user);

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-300">
      <div className="bg-white w-full max-w-2xl rounded-xl shadow-2xl border border-slate-200 p-6 sm:p-8 space-y-6 max-h-[90vh] overflow-y-auto relative">
        <button 
          onClick={onClose} 
          className="absolute top-4 right-4 p-2 rounded-lg hover:bg-slate-100 transition-colors text-slate-400"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Profile Header */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-5">
          <div className="w-20 h-20 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold text-2xl shadow-md">
            {user.name?.slice(0, 1).toUpperCase() || "S"}
          </div>
          <div className="space-y-1">
            <h2 className="text-xl font-bold text-slate-900 leading-tight">
              {user.name || "Anonymous Student"}
            </h2>
            <div className="flex flex-wrap items-center gap-2">
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-tight border ${
                user.status === 'blocked' ? 'bg-rose-50 text-rose-600 border-rose-100' : 'bg-emerald-50 text-emerald-600 border-emerald-100'
              }`}>
                {user.status || 'Active'}
              </span>
              {isTargetSuper ? (
                <span className="px-2.5 py-0.5 rounded text-[10px] font-black uppercase tracking-tight bg-amber-100 text-amber-800 border border-amber-300 flex items-center gap-1">
                  <Crown className="w-3 h-3 text-amber-600" /> Super Admin
                </span>
              ) : user.role === 'admin' ? (
                <span className="px-2.5 py-0.5 rounded text-[10px] font-black uppercase tracking-tight bg-indigo-100 text-indigo-700 border border-indigo-200 flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3 text-indigo-600" /> Admin
                </span>
              ) : (
                <span className="px-2.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-tight bg-slate-100 text-slate-600 border border-slate-200">
                  Student
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 font-medium">{user.email || "No email bound"}</p>
          </div>
        </div>

        {/* Activity Stats */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-slate-50 p-4 rounded-lg border border-slate-100">
            <div className="flex items-center gap-2 mb-1">
              <Activity className="w-3.5 h-3.5 text-indigo-600" />
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Attempts</p>
            </div>
            <p className="text-2xl font-bold text-slate-900 tabular-nums">
              {loading ? "..." : activity?.totalTestsAttempted || 0}
            </p>
          </div>
          <div className="bg-slate-50 p-4 rounded-lg border border-slate-100">
            <div className="flex items-center gap-2 mb-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Avg Efficiency</p>
            </div>
            <p className="text-2xl font-bold text-slate-900 tabular-nums">
              {loading ? "..." : (activity?.averageScore?.toFixed(1) || 0)}%
            </p>
          </div>
        </div>

        {/* Session History */}
        <div className="space-y-3">
          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
            <Clock className="w-3.5 h-3.5" />
            Recent Activity
          </h4>
          <div className="max-h-52 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
            {loading ? (
              <div className="py-8 text-center text-xs font-medium text-slate-400 animate-pulse">Synchronizing history...</div>
            ) : activity && activity.history.length > 0 ? (
              activity.history.map(item => (
                <div key={item.id} className="p-3 bg-white border border-slate-100 rounded-lg flex items-center justify-between hover:bg-slate-50 transition-colors">
                  <div className="space-y-0.5">
                    <p className="text-[13px] font-bold text-slate-900">{item.title}</p>
                    <p className="text-[10px] text-slate-500 font-medium">{new Date(item.date).toLocaleDateString()} • {item.correct}C / {item.wrong}W</p>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-bold text-indigo-600 tabular-nums">{item.score}%</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="py-8 text-center text-xs font-medium text-slate-400 italic">No learning data found.</div>
            )}
          </div>
        </div>

        {/* Management Actions */}
        <div className="pt-6 border-t border-slate-100 space-y-4">
          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Administrative Control</h4>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button 
              disabled={Boolean(actionLoading)}
              onClick={() => onUpdateStatus(user, user.status === 'blocked' ? 'active' : 'blocked')} 
              className={`w-full py-3 rounded-lg font-bold text-[11px] uppercase tracking-wider transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm border ${
                user.status === 'blocked' ? 'bg-emerald-600 text-white border-emerald-500' : 'bg-slate-900 text-white border-slate-800'
              }`}
            >
              {actionLoading === 'status' ? <RefreshCw className="w-3.5 h-3.5 animate-spin"/> : user.status === 'blocked' ? <UserCheck className="w-3.5 h-3.5"/> : <Ban className="w-3.5 h-3.5"/>}
              {user.status === 'blocked' ? 'Restore Account' : 'Suspend Access'}
            </button>

            {isTargetSuper ? (
              <button
                disabled
                className="w-full py-3 bg-amber-50 text-amber-800 border border-amber-200 rounded-lg font-bold text-[11px] uppercase tracking-wider flex items-center justify-center gap-2 cursor-not-allowed"
                title="मुख्य Super Admin को डिमोट नहीं किया जा सकता"
              >
                <Crown className="w-3.5 h-3.5 text-amber-600" />
                <span>Super Admin (सुरक्षित)</span>
              </button>
            ) : !isViewerSuperAdmin ? (
              <button
                disabled
                className="w-full py-3 bg-slate-100 text-slate-400 border border-slate-200 rounded-lg font-bold text-[11px] uppercase tracking-wider flex items-center justify-center gap-2 cursor-not-allowed"
                title="केवल मुख्य Super Admin ही एडमिन प्रमोट या डिमोट कर सकते हैं"
              >
                <Lock className="w-3.5 h-3.5 text-slate-400" />
                <span>केवल Super Admin को अधिकार</span>
              </button>
            ) : (
              <button 
                disabled={Boolean(actionLoading)}
                onClick={() => onUpdateRole(user, user.role === 'admin' ? 'student' : 'admin')} 
                className={`w-full py-3 rounded-lg font-bold text-[11px] uppercase tracking-wider transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm border cursor-pointer ${
                  user.role === 'admin'
                    ? 'bg-rose-50 text-rose-700 hover:bg-rose-100 border-rose-200'
                    : 'bg-indigo-600 text-white hover:bg-indigo-700 border-indigo-500'
                }`}
              >
                {actionLoading === 'role' ? <RefreshCw className="w-3.5 h-3.5 animate-spin"/> : <ShieldCheck className="w-3.5 h-3.5"/>}
                {user.role === 'admin' ? 'Revoke Admin Privileges' : 'Promote to Full Admin'}
              </button>
            )}
          </div>

          <div className="pt-2">
            {!showDeleteConfirm ? (
              <button 
                onClick={() => setShowDeleteConfirm(true)} 
                className="w-full py-3 text-rose-600 hover:bg-rose-50 rounded-lg font-bold text-[11px] uppercase tracking-widest transition-all flex items-center justify-center gap-2"
              >
                <Trash2 className="w-3.5 h-3.5"/>
                Delete Student Profile
              </button>
            ) : (
              <div className="p-5 bg-rose-50 rounded-lg border border-rose-100 space-y-3 animate-in slide-in-from-top-2">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600" />
                  <p className="text-[11px] font-bold text-rose-900 uppercase tracking-tight">Confirm Permanent Deletion?</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setShowDeleteConfirm(false)} className="flex-1 py-2.5 bg-white border border-rose-200 rounded-lg font-bold text-[11px] text-slate-600">Cancel</button>
                  <button onClick={() => onDelete(user)} className="flex-1 py-2.5 bg-rose-600 text-white rounded-lg font-bold text-[11px] uppercase tracking-widest">Confirm Delete</button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export const AdminUserManagementSection: React.FC<AdminUserManagementSectionProps> = ({
  initialSelectedUser,
  onClearInitialUser,
}) => {
  const [users, setUsers] = React.useState<UserProfile[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<"all" | "active" | "inactive" | "blocked" | "admin">("all");
  
  const [selectedUser, setSelectedUser] = React.useState<UserProfile | null>(initialSelectedUser || null);
  const [userActivity, setUserActivity] = React.useState<UserActivitySummary | null>(null);
  const [loadingActivity, setLoadingActivity] = React.useState(false);
  const [actionLoading, setActionLoading] = React.useState<string | null>(null);
  const [notification, setNotification] = React.useState<{ type: "success" | "error"; message: string } | null>(null);

  // Super Admin security check
  const currentLoggedInAdmin = React.useMemo(() => loadUserProfile(), []);
  const currentUserIsSuperAdmin = React.useMemo(() => isSuperAdmin(currentLoggedInAdmin), [currentLoggedInAdmin]);

  // Promote by Email state (Super Admin only)
  const [showPromoteEmailModal, setShowPromoteEmailModal] = React.useState(false);
  const [emailToPromote, setEmailToPromote] = React.useState("");
  const [isPromotingEmail, setIsPromotingEmail] = React.useState(false);

  // Cursor-based cloud data fetching & pagination state
  const [lastDocSnap, setLastDocSnap] = React.useState<any>(null);
  const [hasMoreCloudUsers, setHasMoreCloudUsers] = React.useState<boolean>(false);
  const [loadingMoreCloud, setLoadingMoreCloud] = React.useState<boolean>(false);

  // Client-side pagination state for list rendering
  const [userPage, setUserPage] = React.useState<number>(1);
  const [userPageSize, setUserPageSize] = React.useState<number>(12);

  // Reset pagination state on search or status filter change
  React.useEffect(() => {
    setUserPage(1);
  }, [searchQuery, statusFilter]);

  React.useEffect(() => {
    if (initialSelectedUser) handleOpenUserDetails(initialSelectedUser);
  }, [initialSelectedUser]);

  const loadUsers = async (isManual = false) => {
    if (isManual) setRefreshing(true);
    else setLoading(true);
    try {
      const data = await fetchRegisteredUsers(undefined, 50);
      setUsers(data.users);
      setLastDocSnap(data.lastVisible);
      setHasMoreCloudUsers(data.hasMore);
      setUserPage(1);
    } catch (err) {
      console.warn("Directory sync failed", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleLoadMoreCloudUsers = async () => {
    if (!lastDocSnap || loadingMoreCloud) return;
    setLoadingMoreCloud(true);
    try {
      const data = await fetchRegisteredUsers(lastDocSnap, 50);
      setUsers((prev) => {
        const existingIds = new Set(prev.map((u) => u.id));
        const newUsers = data.users.filter((u) => !existingIds.has(u.id));
        return [...prev, ...newUsers];
      });
      setLastDocSnap(data.lastVisible);
      setHasMoreCloudUsers(data.hasMore);
    } catch (err) {
      console.warn("Failed to load more users from Cloud:", err);
    } finally {
      setLoadingMoreCloud(false);
    }
  };

  React.useEffect(() => {
    loadUsers();
  }, []);

  // Listen for browser popstate so pressing Android Back button closes User Details
  React.useEffect(() => {
    const handleUserPopState = () => {
      if (typeof window !== "undefined") {
        const s = new URLSearchParams(window.location.search);
        if (!s.get("userId")) {
          setSelectedUser(null);
          onClearInitialUser?.();
        }
      }
    };
    window.addEventListener("popstate", handleUserPopState);
    return () => window.removeEventListener("popstate", handleUserPopState);
  }, [onClearInitialUser]);

  const handleOpenUserDetails = async (user: UserProfile) => {
    setSelectedUser(user);
    if (typeof window !== "undefined") {
      const currentUrl = window.location.pathname + window.location.search;
      const targetUrl = `/admin?section=users&userId=${encodeURIComponent(user.id)}`;
      if (currentUrl !== targetUrl) {
        window.history.pushState({ userId: user.id }, "", targetUrl);
      }
    }
    setLoadingActivity(true);
    setUserActivity(null);
    try {
      const act = await fetchUserActivityData(user);
      setUserActivity(act);
    } catch (err) {
      console.warn("Activity sync failed", err);
    } finally {
      setLoadingActivity(false);
    }
  };

  // Support direct deep link & refresh with userId
  React.useEffect(() => {
    if (users.length > 0 && typeof window !== "undefined" && !selectedUser) {
      const s = new URLSearchParams(window.location.search);
      const uid = s.get("userId");
      if (uid) {
        const found = users.find((u) => u.id === uid);
        if (found) {
          handleOpenUserDetails(found);
        }
      }
    }
  }, [users]);
  
  const handleUpdateStatus = async (user: UserProfile, status: "active" | "inactive" | "blocked") => {
    setActionLoading("status");
    try {
      await updateUserAccountStatus(user.id, status);
      setUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, status } : u)));
      setSelectedUser((prev) => (prev ? { ...prev, status } : null));
      setNotification({ type: "success", message: "User status updated." });
    } catch (err) {
      setNotification({ type: "error", message: "Update failed." });
    } finally {
      setActionLoading(null);
      setTimeout(() => setNotification(null), 3000);
    }
  };

  const handleUpdateRole = async (user: UserProfile, role: "admin" | "student") => {
    if (!currentUserIsSuperAdmin) {
      setNotification({
        type: "error",
        message: "अनधिकृत: केवल मुख्य प्रशासक (Super Admin) ही एडमिन बना या हटा सकते हैं।",
      });
      return;
    }
    if (isSuperAdmin(user) && role !== "admin") {
      setNotification({
        type: "error",
        message: "निषिद्ध: मुख्य Super Admin को डिमोट नहीं किया जा सकता।",
      });
      return;
    }
    setActionLoading("role");
    try {
      await updateUserRole(user.id, role);
      setUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, role } : u)));
      setSelectedUser((prev) => (prev ? { ...prev, role } : null));
      setNotification({ 
        type: "success", 
        message: role === "admin" 
          ? `यूज़र "${user.name || user.email}" को सफलतापूर्वक Admin बना दिया गया!` 
          : `"${user.name || user.email}" के Admin अधिकार सफलतापूर्वक हटा दिए गए।`
      });
      window.dispatchEvent(new CustomEvent("disha2020-user-tier-updated"));
      window.dispatchEvent(new CustomEvent("quizpro-user-tier-updated"));
    } catch (err: any) {
      setNotification({ type: "error", message: err?.message || "Role update failed." });
    } finally {
      setActionLoading(null);
      setTimeout(() => setNotification(null), 4000);
    }
  };

  const handlePromoteByEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUserIsSuperAdmin) {
      setNotification({
        type: "error",
        message: "अनधिकृत: केवल मुख्य प्रशासक (Super Admin) ही नए एडमिन बना सकते हैं।",
      });
      return;
    }
    const clean = emailToPromote.trim().toLowerCase();
    if (!clean || !clean.includes("@")) {
      setNotification({ type: "error", message: "कृपया एक मान्य ईमेल पता दर्ज करें।" });
      return;
    }
    setIsPromotingEmail(true);
    try {
      const updatedUser = await promoteUserByEmail(clean);
      setUsers((prev) => {
        const exists = prev.some((u) => u.id === updatedUser.id);
        if (exists) {
          return prev.map((u) => (u.id === updatedUser.id ? { ...u, role: "admin" } : u));
        }
        return [updatedUser, ...prev];
      });
      setNotification({
        type: "success",
        message: `ईमेल "${clean}" को सफलतापूर्वक Admin बना दिया गया! अब वह एडमिन के रूप में लॉगिन व कार्य कर सकेगा।`,
      });
      setEmailToPromote("");
      setShowPromoteEmailModal(false);
      window.dispatchEvent(new CustomEvent("disha2020-user-tier-updated"));
    } catch (err: any) {
      setNotification({
        type: "error",
        message: err?.message || "एडमिन प्रमोट करने में त्रुटि आई।",
      });
    } finally {
      setIsPromotingEmail(false);
    }
  };

  const handleDelete = async (user: UserProfile) => {
    setActionLoading("delete");
    try {
      await deleteUserAccount(user.id);
      setUsers((prev) => prev.filter((u) => u.id !== user.id));
      setSelectedUser(null);
      onClearInitialUser?.();
      setNotification({ type: "success", message: "Account deleted." });
    } catch (err) {
      setNotification({ type: "error", message: "Deletion failed." });
    } finally {
      setActionLoading(null);
      setTimeout(() => setNotification(null), 3000);
    }
  };

  const filteredUsers = React.useMemo(() => {
    return users.filter((u) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch = !q || u.name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q);
      if (!matchesSearch) return false;
      if (statusFilter === "active") return u.status !== "inactive" && u.status !== "blocked";
      if (statusFilter === "inactive") return u.status === "inactive";
      if (statusFilter === "blocked") return u.status === "blocked";
      if (statusFilter === "admin") return u.role === "admin";
      return true;
    });
  }, [users, searchQuery, statusFilter]);

  const totalUserCount = filteredUsers.length;
  const userTotalPages = Math.max(1, Math.ceil(totalUserCount / userPageSize));
  const safeUserPage = Math.min(userPage, userTotalPages);
  const userStartIndex = (safeUserPage - 1) * userPageSize;
  const userEndIndex = Math.min(totalUserCount, userStartIndex + userPageSize);

  const paginatedUsers = React.useMemo(() => {
    return filteredUsers.slice(userStartIndex, userEndIndex);
  }, [filteredUsers, userStartIndex, userEndIndex]);

  const renderUserPaginationBar = () => {
    if (totalUserCount === 0) return null;
    return (
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 bg-white border border-slate-200 rounded-xl shadow-xs">
        <div className="flex items-center gap-3 text-xs font-semibold text-slate-600">
          <span>
            Showing <strong className="text-slate-900 font-mono">{userStartIndex + 1}</strong>–<strong className="text-slate-900 font-mono">{userEndIndex}</strong> of <strong className="text-slate-900 font-mono">{totalUserCount}</strong> loaded students
          </span>
          <div className="flex items-center gap-1.5 ml-2 border-l border-slate-200 pl-3">
            <span className="text-[11px] text-slate-400 uppercase tracking-wider font-bold">Per page:</span>
            <select
              value={userPageSize}
              onChange={(e) => {
                setUserPageSize(Number(e.target.value));
                setUserPage(1);
              }}
              className="bg-slate-50 border border-slate-200 text-xs font-mono font-bold text-slate-900 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
            >
              <option value={12}>12</option>
              <option value={24}>24</option>
              <option value={48}>48</option>
              <option value={100}>100</option>
            </select>
          </div>
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto max-w-full no-scrollbar">
          <button
            onClick={() => setUserPage(1)}
            disabled={safeUserPage <= 1}
            className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-30 cursor-pointer"
            title="First Page"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() => setUserPage((p) => Math.max(1, p - 1))}
            disabled={safeUserPage <= 1}
            className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-50 disabled:opacity-30 cursor-pointer flex items-center gap-1"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            <span>Prev</span>
          </button>

          <span className="px-3 py-1 rounded-lg bg-indigo-50 border border-indigo-100 text-indigo-700 font-mono font-bold text-xs">
            {safeUserPage} / {userTotalPages}
          </span>

          <button
            onClick={() => setUserPage((p) => Math.min(userTotalPages, p + 1))}
            disabled={safeUserPage >= userTotalPages}
            className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-50 disabled:opacity-30 cursor-pointer flex items-center gap-1"
          >
            <span>Next</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>

          {hasMoreCloudUsers && (
            <button
              onClick={handleLoadMoreCloudUsers}
              disabled={loadingMoreCloud}
              className="ml-2 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold text-xs flex items-center gap-1.5 transition-all shadow-xs cursor-pointer active:scale-95 disabled:opacity-50 shrink-0"
            >
              {loadingMoreCloud ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
              <span>Load More Cloud</span>
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 pb-12 animate-in fade-in slide-in-from-bottom-2 duration-500">
      {/* 1. Refined Header */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 sm:p-8 relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-end justify-between gap-5 sm:gap-6">
          <div className="space-y-1.5 sm:space-y-2">
            <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              <Users className="w-3.5 h-3.5" />
              <span>Identity Directory</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">Student Management</h2>
            <p className="text-xs sm:text-sm text-slate-500 font-medium max-w-lg leading-relaxed">
              Manage user access, audit learning progress, and maintain educational integrity.
            </p>
          </div>
          <div className="flex items-center gap-2.5 flex-wrap self-start md:self-auto">
            {currentUserIsSuperAdmin && (
              <button 
                onClick={() => setShowPromoteEmailModal(true)} 
                className="flex items-center justify-center gap-2 px-4 sm:px-5 py-2.5 sm:py-3 bg-gradient-to-r from-amber-500 to-indigo-600 hover:from-amber-600 hover:to-indigo-700 text-white rounded-lg font-bold text-xs uppercase tracking-wider transition-all active:scale-[0.98] shadow-sm cursor-pointer"
                title="छात्र को सीधे ईमेल द्वारा Admin प्रमोट करें"
              >
                <Crown className="w-4 h-4 text-amber-200" />
                <span>प्रमोट Admin (ईमेल)</span>
              </button>
            )}
            <button 
              onClick={() => loadUsers(true)} 
              disabled={refreshing || loading} 
              className="flex items-center justify-center gap-2 px-4 sm:px-5 py-2.5 sm:py-3 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-lg font-bold text-xs uppercase tracking-wider transition-all active:scale-[0.98] shadow-sm cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin text-indigo-600" : "text-slate-400"}`} /> 
              <span>{refreshing ? "Syncing..." : "Sync Directory"}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Compact Toast */}
      {notification && (
        <div className={`p-4 rounded-xl border flex items-center justify-between gap-4 animate-in zoom-in-95 duration-200 ${
          notification.type === 'success' ? 'bg-emerald-50 border-emerald-100 text-emerald-900' : 'bg-rose-50 border-rose-100 text-rose-900'
        }`}>
          <div className="flex items-center gap-3">
            {notification.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-600"/> : <AlertCircle className="w-4 h-4 text-rose-600"/>}
            <span className="text-xs font-bold">{notification.message}</span>
          </div>
          <button onClick={() => setNotification(null)} className="p-1 hover:bg-black/5 rounded-lg"><X className="w-4 h-4 text-slate-400" /></button>
        </div>
      )}

      {/* 2. Directory Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Stats Column */}
        <div className="lg:col-span-3 grid grid-cols-2 lg:grid-cols-1 gap-3">
          {[
            { label: "Total Students", value: users.length, icon: Users, color: "text-blue-600", bg: "bg-blue-50" },
            { label: "Active Now", value: users.filter(u => u.status !== 'blocked').length, icon: UserCheck, color: "text-emerald-600", bg: "bg-emerald-50" },
            { label: "Admins", value: users.filter(u => u.role === 'admin').length, icon: Shield, color: "text-indigo-600", bg: "bg-indigo-50" },
            { label: "Suspended", value: users.filter(u => u.status === 'blocked').length, icon: Ban, color: "text-rose-600", bg: "bg-rose-50" }
          ].map((stat, i) => (
            <div key={i} className="p-5 bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col">
              <div className={`w-9 h-9 rounded-lg ${stat.bg} ${stat.color} flex items-center justify-center mb-4`}>
                <stat.icon className="w-4.5 h-4.5" />
              </div>
              <span className="text-2xl font-bold text-slate-900 tabular-nums leading-none">{loading ? "..." : stat.value}</span>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-2">{stat.label}</span>
            </div>
          ))}
        </div>

        {/* Directory Column */}
        <div className="lg:col-span-9 space-y-5">
          {/* Search & Filter Bar */}
          <div className="sticky top-14 sm:top-16 z-20 bg-white border border-slate-200 rounded-xl p-2 shadow-sm flex flex-col gap-2">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
              <input 
                type="text" 
                value={searchQuery} 
                onChange={(e) => setSearchQuery(e.target.value)} 
                placeholder="Search students..." 
                className="w-full pl-11 pr-10 py-3 bg-slate-50 border-none rounded-lg text-sm font-semibold text-slate-900 placeholder:text-slate-400 focus:ring-1 focus:ring-indigo-500/20" 
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <div className="flex gap-1 overflow-x-auto p-1 no-scrollbar">
              {["all", "active", "inactive", "blocked", "admin"].map((f) => (
                <button 
                  key={f} 
                  onClick={() => setStatusFilter(f as any)} 
                  className={`px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all shrink-0 ${
                    statusFilter === f ? "bg-indigo-600 text-white shadow-sm" : "text-slate-500 hover:bg-slate-100"
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          {/* Top User Pagination Bar */}
          {renderUserPaginationBar()}

          {/* User Cards Grid */}
          {loading ? (
            <CardGridSkeleton count={4} cols={2} />
          ) : filteredUsers.length === 0 ? (
            <div className="py-20 text-center space-y-4 bg-slate-50 rounded-xl border border-dashed border-slate-200 p-6">
              <UserX className="w-10 h-10 text-slate-300 mx-auto" />
              <p className="text-sm font-bold text-slate-500">No students found matching your criteria</p>
              <button onClick={() => {setSearchQuery(""); setStatusFilter("all");}} className="px-5 py-2 bg-slate-900 text-white rounded-lg font-bold text-[10px] uppercase tracking-widest active:scale-95">Reset Filters</button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {paginatedUsers.map((user: UserProfile) => (
                <div 
                  key={user.id} 
                  onClick={() => handleOpenUserDetails(user)}
                  className="group bg-white border border-slate-200 rounded-xl p-5 shadow-sm hover:border-indigo-500/30 hover:shadow-md transition-all cursor-pointer relative active:scale-[0.99]"
                >
                  <div className="flex items-center gap-4 mb-5">
                    <div className="w-12 h-12 rounded-lg bg-slate-50 text-slate-400 flex items-center justify-center font-bold text-lg group-hover:bg-indigo-600 group-hover:text-white transition-all shrink-0 uppercase">
                      {user.name?.slice(0, 1) || "?"}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4 className="text-[15px] font-bold text-slate-900 group-hover:text-indigo-600 transition-colors truncate">{user.name || "Unknown Student"}</h4>
                      <p className="text-[11px] text-slate-500 font-medium truncate">{user.email || "No email linked"}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between pt-4 border-t border-slate-50 gap-2">
                    <div className="flex gap-1.5 flex-wrap">
                      <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-tight border ${
                        user.status === 'blocked' ? 'bg-rose-50 text-rose-600 border-rose-100' : 'bg-emerald-50 text-emerald-600 border-emerald-100'
                      }`}>
                        {user.status || 'Active'}
                      </span>
                      {isSuperAdmin(user) ? (
                        <span className="px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-tight bg-amber-100 text-amber-800 border border-amber-300 flex items-center gap-1">
                          <Crown className="w-2.5 h-2.5 text-amber-600" /> Super Admin
                        </span>
                      ) : user.role === 'admin' ? (
                        <span className="px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-tight bg-indigo-100 text-indigo-700 border border-indigo-200 flex items-center gap-1">
                          <ShieldCheck className="w-2.5 h-2.5 text-indigo-600" /> Admin
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-tight bg-slate-100 text-slate-600 border border-slate-200">
                          Student
                        </span>
                      )}
                    </div>
                    
                    {isSuperAdmin(user) ? (
                      <span className="px-2 py-1 rounded text-[9px] font-bold text-amber-700 bg-amber-50 border border-amber-200 flex items-center gap-1 shrink-0">
                        <Crown className="w-3 h-3 text-amber-600" /> Super Admin
                      </span>
                    ) : !currentUserIsSuperAdmin ? (
                      <span className="px-2 py-1 rounded text-[9px] font-bold text-slate-400 bg-slate-50 border border-slate-200 flex items-center gap-1 shrink-0" title="केवल Super Admin को अधिकार है">
                        <Lock className="w-3 h-3 text-slate-400" /> Protected
                      </span>
                    ) : (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleUpdateRole(user, user.role === 'admin' ? 'student' : 'admin');
                        }}
                        className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all flex items-center gap-1 shrink-0 cursor-pointer ${
                          user.role === 'admin'
                            ? 'bg-rose-50 text-rose-600 hover:bg-rose-100 border border-rose-200'
                            : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100 border border-indigo-200'
                        }`}
                        title={user.role === 'admin' ? 'Admin अधिकार हटाएं' : 'Admin प्रमोट करें'}
                      >
                        <ShieldCheck className="w-3 h-3" />
                        <span>{user.role === 'admin' ? 'Demote' : 'Promote'}</span>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Bottom User Pagination Bar */}
          {renderUserPaginationBar()}
        </div>
      </div>

      {/* Promote Admin by Email Modal (Super Admin only) */}
      {showPromoteEmailModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2 text-indigo-600">
                <Crown className="w-5 h-5 text-amber-500" />
                <h3 className="text-base font-black text-slate-900">नया Admin प्रमोट करें</h3>
              </div>
              <button
                onClick={() => setShowPromoteEmailModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handlePromoteByEmail} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  छात्र का ईमेल पता (Email Address)
                </label>
                <input
                  type="email"
                  required
                  placeholder="e.g. student@gmail.com"
                  value={emailToPromote}
                  onChange={(e) => setEmailToPromote(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                />
              </div>

              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs leading-relaxed space-y-1">
                <p className="font-bold flex items-center gap-1.5">
                  <ShieldAlert className="w-3.5 h-3.5 text-amber-600" />
                  सुरक्षा एवं अधिकार नियम:
                </p>
                <ul className="list-disc pl-4 space-y-0.5 text-[11px] text-amber-800">
                  <li>केवल <strong>Super Admin</strong> ही नए एडमिन बना या हटा सकते हैं।</li>
                  <li>सामान्य एडमिन किसी अन्य यूज़र को प्रमोट या डिमोट नहीं कर सकते।</li>
                  <li>प्रमोट होने के बाद वह यूज़र तुरंत एडमिन पैनल में लॉगिन व कार्य कर सकेगा।</li>
                </ul>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowPromoteEmailModal(false)}
                  className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  रद्द करें
                </button>
                <button
                  type="submit"
                  disabled={isPromotingEmail || !emailToPromote.trim()}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm cursor-pointer"
                >
                  {isPromotingEmail ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>प्रमोट हो रहा है...</span>
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="w-3.5 h-3.5" />
                      <span>Admin बनाएं</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* User Detail Modal */}
      {selectedUser && (
        <UserDetailView 
          user={selectedUser} 
          activity={userActivity} 
          loading={loadingActivity} 
          actionLoading={actionLoading}
          isViewerSuperAdmin={currentUserIsSuperAdmin}
          onClose={() => {
            if (typeof window !== "undefined" && window.history.length > 1 && window.location.search.includes("userId")) {
              window.history.back();
            } else {
              setSelectedUser(null);
              onClearInitialUser?.();
            }
          }} 
          onUpdateStatus={handleUpdateStatus}
          onUpdateRole={handleUpdateRole}
          onDelete={handleDelete}
        />
      )}
    </div>
  );
};
