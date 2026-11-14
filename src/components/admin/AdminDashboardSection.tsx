import * as React from "react";
import { 
  Users, 
  UserCheck, 
  Image as ImageIcon, 
  RefreshCw, 
  ShieldCheck, 
  ChevronRight,
  Sparkles,
  Activity,
  MessageSquare,
  AlertCircle,
  CheckCircle2,
  UserX,
  TrendingUp,
  Newspaper,
  LayoutDashboard,
  Layers,
  Database,
  Trophy,
  ArrowUpRight
} from "lucide-react";
import { UserProfile, AppBanner, UserQuestionsStore } from "../../types";
import { fetchRegisteredUsers, getLocalUsersDirectory } from "../../utils/userManagementStorage";
import { fetchAllBanners, getLocalBanners } from "../../utils/bannerStorage";
import { runFirebaseHealthCheck } from "../../utils/firebaseSyncService";
import { RecentActivityWidget } from "./RecentActivityWidget";
import { DatabaseStatusWidget } from "./DatabaseStatusWidget";
import { AuditLogWidget } from "./AuditLogWidget";
import { ExportDataWidget } from "./ExportDataWidget";
import { QuickActionsWidget } from "./QuickActionsWidget";
import { FirebaseStorageOverview } from "./FirebaseStorageOverview";
import { getQuotaStats } from "../../utils/syncPolicyManager";
import { getTotalDisplayCount } from "../../utils/questionsStorage";
import { auth } from "../../lib/firebase";

interface AdminDashboardSectionProps {
  onNavigateSection: (section: "dashboard" | "users" | "banners" | "curriculum" | "health" | "ai-api" | "analytics" | "news" | "messages") => void;
  onSelectUser?: (user: UserProfile) => void;
  onOpenQARunner?: () => void;
  questionsStore: UserQuestionsStore;
}

export const AdminDashboardSection: React.FC<AdminDashboardSectionProps> = ({
  onNavigateSection,
  onSelectUser,
  onOpenQARunner,
  questionsStore,
}) => {
  const cachedUsers = getLocalUsersDirectory();
  const cachedBanners = getLocalBanners();
  const [users, setUsers] = React.useState<UserProfile[]>(() => cachedUsers);
  const [banners, setBanners] = React.useState<AppBanner[]>(() => cachedBanners);
  const [loading, setLoading] = React.useState(() => cachedUsers.length === 0 && cachedBanners.length === 0);
  const [refreshing, setRefreshing] = React.useState(false);
  const [healthStatus, setHealthStatus] = React.useState<{ success: boolean; latencyMs: number; error?: string } | null>(null);
  const [isCheckingHealth, setIsCheckingHealth] = React.useState(false);
  const [healthCooldown, setHealthCooldown] = React.useState(0);

  const loadData = async (isManual = false) => {
    if (!auth.currentUser) return;
    if (isManual) {
      setRefreshing(true);
    } else if (users.length === 0 && banners.length === 0) {
      setLoading(true);
    }

    try {
      const [usersRes, bannersRes] = await Promise.allSettled([
        fetchRegisteredUsers(),
        fetchAllBanners(),
      ]);
      if (usersRes.status === "fulfilled") {
        setUsers(usersRes.value.users);
      }
      if (bannersRes.status === "fulfilled") {
        setBanners(bannersRes.value);
      }
    } catch (err) {
      console.warn("Failed to load dashboard metrics", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const checkHealth = async () => {
    if (healthCooldown > 0 || isCheckingHealth) return;
    setIsCheckingHealth(true);
    const result = await runFirebaseHealthCheck();
    setHealthStatus(result);
    setIsCheckingHealth(false);
    setHealthCooldown(60);
  };

  React.useEffect(() => {
    if (healthCooldown <= 0) return;
    const timer = setInterval(() => setHealthCooldown((prev) => Math.max(0, prev - 1)), 1000);
    return () => clearInterval(timer);
  }, [healthCooldown]);

  React.useEffect(() => {
    loadData();
  }, []);

  const totalRegisteredUsers = users.length;
  const totalActiveUsers = users.filter((u) => u.status !== "inactive" && u.status !== "blocked").length;
  const totalBlockedUsers = users.filter((u) => u.status === "blocked").length;
  const totalAdmins = users.filter((u) => u.role === "admin").length;
  const totalBanners = banners.length;
  const activeBanners = banners.filter((b) => b.isActive).length;
  const recentUsers = users.slice(0, 5);

  const quota = getQuotaStats(totalRegisteredUsers);

  return (
    <div className="space-y-5 sm:space-y-6 pb-12 animate-in fade-in duration-300 max-w-full overflow-x-hidden">
      
      {/* SaaS Dashboard Header */}
      <div className="p-4 sm:p-8 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-3xl border border-slate-800 shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-96 bg-indigo-500/10 blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-5 sm:gap-6">
          <div className="space-y-1.5 sm:space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold text-indigo-300 uppercase tracking-widest">
              <LayoutDashboard className="w-4 h-4 text-indigo-400" />
              <span>Admin Control Center</span>
            </div>
            <h1 className="text-xl sm:text-3xl font-black tracking-tight text-white">
              Welcome back, {auth.currentUser?.displayName?.split(" ")[0] || "Admin"}
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 max-w-xl leading-relaxed">
              Real-time oversight for student activity, curriculum question stores, and cloud database stability.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:gap-3 shrink-0">
            <button
              onClick={checkHealth}
              disabled={isCheckingHealth || healthCooldown > 0}
              className="h-10 sm:h-11 px-3.5 sm:px-4 bg-white/10 hover:bg-white/20 text-white rounded-2xl text-xs font-bold flex items-center gap-2 transition-all border border-white/10 backdrop-blur-md cursor-pointer disabled:opacity-50 active:scale-95"
            >
              <ShieldCheck className={`w-4 h-4 ${isCheckingHealth ? "animate-spin text-amber-400" : "text-emerald-400"}`} />
              <span>{isCheckingHealth ? "Checking..." : healthCooldown > 0 ? `${healthCooldown}s` : "Health Probe"}</span>
            </button>

            <button
              onClick={() => loadData(true)}
              disabled={refreshing || loading}
              className="h-10 sm:h-11 px-4 sm:px-5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl text-xs font-extrabold flex items-center gap-2 transition-all shadow-lg shadow-indigo-600/30 cursor-pointer active:scale-95"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
              <span>Sync Cloud Data</span>
            </button>
          </div>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {[
          { 
            label: "Total Students", 
            value: totalRegisteredUsers, 
            sub: `${totalActiveUsers} Active · ${totalAdmins} Admins`, 
            icon: Users, 
            color: "text-blue-600 dark:text-blue-400", 
            bg: "bg-blue-50 dark:bg-blue-950/50" 
          },
          { 
            label: "Live Banners", 
            value: activeBanners, 
            sub: `${totalBanners} Total Configured`, 
            icon: ImageIcon, 
            color: "text-emerald-600 dark:text-emerald-400", 
            bg: "bg-emerald-50 dark:bg-emerald-950/50" 
          },
          { 
            label: "Question Bank", 
            value: getTotalDisplayCount(questionsStore), 
            sub: "Curated & Verified MCQs", 
            icon: Database, 
            color: "text-purple-600 dark:text-purple-400", 
            bg: "bg-purple-50 dark:bg-purple-950/50" 
          },
          { 
            label: "Estimated Daily Reads", 
            value: quota.estimatedDailyTotalForN, 
            sub: "Daily Quota Estimate", 
            icon: Activity, 
            color: "text-amber-600 dark:text-amber-400", 
            bg: "bg-amber-50 dark:bg-amber-950/50" 
          }
        ].map((stat, i) => (
          <div 
            key={i} 
            className="bg-white dark:bg-[#111A2E] p-3.5 sm:p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs hover:border-indigo-500/50 transition-all space-y-2 sm:space-y-3"
          >
            <div className="flex items-center justify-between">
              <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center ${stat.bg}`}>
                <stat.icon className={`w-4 h-4 sm:w-5 sm:h-5 ${stat.color}`} />
              </div>
              <span className="text-[10px] sm:text-[11px] font-bold text-slate-400 uppercase tracking-wider truncate">{stat.label}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-xl sm:text-3xl font-black text-slate-900 dark:text-white tabular-nums">{stat.value.toLocaleString()}</span>
              <span className="text-[11px] sm:text-xs font-medium text-slate-500 dark:text-slate-400 mt-0.5 truncate">{stat.sub}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Health Status Probe Alert */}
      {healthStatus && (
        <div className={`p-4 rounded-2xl border flex items-center justify-between gap-3 transition-all ${
          healthStatus.success 
            ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200" 
            : "bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800 text-rose-900 dark:text-rose-200"
        }`}>
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
              healthStatus.success ? "bg-emerald-200/60 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300" : "bg-rose-200/60 dark:bg-rose-900/60 text-rose-700 dark:text-rose-300"
            }`}>
              {healthStatus.success ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-wider">{healthStatus.success ? "Firestore Cluster Operational" : "Service Alert"}</p>
              <p className="text-xs font-medium opacity-90 mt-0.5">
                {healthStatus.success ? `Response latency: ${healthStatus.latencyMs}ms. Database connection healthy.` : healthStatus.error || "Connection check failed."}
              </p>
            </div>
          </div>
          <button onClick={() => setHealthStatus(null)} className="p-2 hover:bg-black/5 dark:hover:bg-white/10 rounded-xl transition-colors cursor-pointer">
            <UserX className="w-4 h-4 rotate-45 text-slate-400" />
          </button>
        </div>
      )}

      {/* Quick Action Navigation Tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 sm:gap-3">
        {[
          { label: "Syllabus Tree", icon: Layers, nav: "curriculum", desc: "Manage Subjects & Topics" },
          { label: "Students", icon: Users, nav: "users", desc: "Manage User Profiles" },
          { label: "Articles & News", icon: Newspaper, nav: "news", desc: "Publish Portal Feed" },
          { label: "Inquiries", icon: MessageSquare, nav: "messages", desc: "Review Student Support" },
          { label: "System Health", icon: ShieldCheck, nav: "health", desc: "Firebase Health Diagnostics" }
        ].map((card) => (
          <button
            key={card.label}
            onClick={() => onNavigateSection(card.nav as any)}
            className="group p-3 sm:p-4 bg-white dark:bg-[#111A2E] rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs hover:border-indigo-500/50 hover:shadow-md transition-all text-left active:scale-95 cursor-pointer"
          >
            <div className="flex items-center justify-between mb-2.5">
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                <card.icon className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
              </div>
              <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-indigo-500 transition-colors" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{card.label}</p>
              <p className="text-[10px] sm:text-[11px] text-slate-500 dark:text-slate-400 font-medium mt-0.5 truncate">{card.desc}</p>
            </div>
          </button>
        ))}
      </div>

      {/* Firebase Resource Monitoring Dashboard Card */}
      <FirebaseStorageOverview />

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6">
        
        <div className="lg:col-span-8 space-y-5 sm:space-y-6">
          {/* Recent Student Directory Card */}
          <div className="bg-white dark:bg-[#111A2E] rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden">
            <div className="px-4 sm:px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-white tracking-tight">Recent Student Enrolments</h3>
                  <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 font-medium">Latest registered users in Firestore</p>
                </div>
              </div>
              <button 
                onClick={() => onNavigateSection("users")}
                className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0"
              >
                Directory
              </button>
            </div>
            
            <div className="p-3">
              {loading ? (
                <div className="py-12 text-center text-xs font-bold text-slate-400 animate-pulse">Synchronizing student directory...</div>
              ) : recentUsers.length === 0 ? (
                <div className="py-12 text-center text-xs font-bold text-slate-400">No recent student records found.</div>
              ) : (
                <div className="space-y-1">
                  {recentUsers.map((user) => (
                    <div
                      key={user.id}
                      onClick={() => onSelectUser?.(user)}
                      className="group flex items-center justify-between p-3.5 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-all cursor-pointer"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center font-black text-sm group-hover:bg-indigo-600 group-hover:text-white transition-colors shrink-0 uppercase">
                          {user.name?.slice(0, 1) || "U"}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate">{user.name || "Unknown Student"}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{user.email || "No email address"}</p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                          {user.role === 'admin' ? 'Admin Role' : user.status === 'blocked' ? 'Blocked' : 'Active Account'}
                        </span>
                        <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-indigo-500 transition-colors" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <DatabaseStatusWidget />
          <QuickActionsWidget onRefresh={() => loadData(true)} onHealthCheck={checkHealth} />
        </div>

        <div className="lg:col-span-4 space-y-6">
          <RecentActivityWidget />
          <AuditLogWidget />
          <ExportDataWidget questionsStore={questionsStore} />
          
          {/* System Info Box */}
          <div className="bg-slate-900 dark:bg-[#0B1220] rounded-3xl p-6 text-white border border-slate-800 shadow-xl relative overflow-hidden">
            <div className="absolute right-0 top-0 w-28 h-28 bg-indigo-500/20 rounded-full blur-2xl pointer-events-none" />
            <div className="relative space-y-5">
              <div className="flex items-center justify-between">
                <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center">
                  <ShieldCheck className="w-5 h-5 text-emerald-400" />
                </div>
                <span className="text-[11px] font-bold text-emerald-400">
                  Production Node Live
                </span>
              </div>
              
              <div>
                <h4 className="text-lg font-black font-display">DISHA 20-20 Admin Engine</h4>
                <p className="text-xs text-slate-400 font-medium">Enterprise Management Platform</p>
              </div>

              <div className="space-y-2 pt-2 border-t border-white/10 text-xs">
                <div className="flex items-center justify-between py-1">
                  <span className="text-slate-400 font-medium">Frontend Framework</span>
                  <span className="font-bold text-white">React 19 + Vite</span>
                </div>
                <div className="flex items-center justify-between py-1">
                  <span className="text-slate-400 font-medium">Cloud Database</span>
                  <span className="font-bold text-emerald-400">Firestore Connected</span>
                </div>
              </div>

              <button 
                onClick={onOpenQARunner}
                className="w-full py-3 bg-white text-slate-950 hover:bg-slate-100 rounded-2xl text-xs font-black uppercase tracking-wider transition-all active:scale-[0.98] shadow-lg shadow-black/20 cursor-pointer"
              >
                Open Debug Console
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
