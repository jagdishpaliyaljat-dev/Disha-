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
import { fetchRegisteredUsers, getLocalUsersDirectory, fetchFirestoreUserCounts } from "../../utils/userManagementStorage";
import { fetchAllBanners, getLocalBanners } from "../../utils/bannerStorage";
import { supabase, isSupabaseConfigured } from "../../lib/supabase";
import { RecentActivityWidget } from "./RecentActivityWidget";
import { DatabaseStatusWidget, DatabaseInventoryCounts } from "./DatabaseStatusWidget";
import { AuditLogWidget } from "./AuditLogWidget";
import { ExportDataWidget } from "./ExportDataWidget";
import { QuickActionsWidget } from "./QuickActionsWidget";
import { SupabaseHealthPanel } from "./SupabaseHealthPanel";
import { getTotalDisplayCount } from "../../utils/questionsStorage";

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
  const [totalUserCount, setTotalUserCount] = React.useState<number>(() => cachedUsers.length);
  const [databaseCounts, setDatabaseCounts] = React.useState<DatabaseInventoryCounts | null>(null);
  const [refreshTrigger, setRefreshTrigger] = React.useState<number>(0);
  const [loading, setLoading] = React.useState(() => cachedUsers.length === 0 && cachedBanners.length === 0);
  const [refreshing, setRefreshing] = React.useState(false);
  const [healthStatus, setHealthStatus] = React.useState<{ success: boolean; latencyMs: number; error?: string } | null>(null);
  const [isCheckingHealth, setIsCheckingHealth] = React.useState(false);
  const [healthCooldown, setHealthCooldown] = React.useState(0);

  const loadData = async (isManual = false) => {
    if (isManual) {
      setRefreshing(true);
      setRefreshTrigger((prev) => prev + 1);
    } else if (users.length === 0 && banners.length === 0) {
      setLoading(true);
    }

    try {
      const [usersRes, bannersRes, userCountsRes] = await Promise.allSettled([
        fetchRegisteredUsers(),
        fetchAllBanners(),
        fetchFirestoreUserCounts(),
      ]);
      if (usersRes.status === "fulfilled") {
        setUsers(usersRes.value.users);
      }
      if (bannersRes.status === "fulfilled") {
        setBanners(bannersRes.value);
      }
      if (userCountsRes.status === "fulfilled" && userCountsRes.value.totalRegistered > 0) {
        setTotalUserCount(userCountsRes.value.totalRegistered);
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
    const start = performance.now();
    try {
      const { error } = await supabase.from("subjects").select("id").limit(1);
      const latency = Math.round(performance.now() - start);
      setHealthStatus({ success: !error, latencyMs: latency, error: error?.message });
    } catch (err: any) {
      setHealthStatus({ success: false, latencyMs: 0, error: err.message });
    } finally {
      setIsCheckingHealth(false);
      setHealthCooldown(60);
    }
  };

  React.useEffect(() => {
    if (healthCooldown <= 0) return;
    const timer = setInterval(() => setHealthCooldown((prev) => Math.max(0, prev - 1)), 1000);
    return () => clearInterval(timer);
  }, [healthCooldown]);

  React.useEffect(() => {
    loadData();
  }, []);

  const storeQuestionCount = React.useMemo(() => getTotalDisplayCount(questionsStore), [questionsStore]);
  const effectiveQuestionCount = Math.max(storeQuestionCount, databaseCounts?.mcqs ?? 0);
  const effectiveUserCount = Math.max(users.length, totalUserCount);
  const activeBannersCount = React.useMemo(() => banners.filter(b => b.status === "active").length, [banners]);
  const recentUsers = React.useMemo(() => users.slice(0, 5), [users]);

  const quickMetricCards = [
    {
      label: "Question Bank",
      val: effectiveQuestionCount.toLocaleString(),
      desc: "Canonical MCQs available",
      icon: Database,
      action: () => onNavigateSection("curriculum"),
      tag: "Live",
    },
    {
      label: "Registered Students",
      val: effectiveUserCount.toLocaleString(),
      desc: "Directory profiles",
      icon: Users,
      action: () => onNavigateSection("users"),
      tag: "Active",
    },
    {
      label: "Target Banners",
      val: `${activeBannersCount} / ${banners.length}`,
      desc: "Engaging alerts & announcements",
      icon: ImageIcon,
      action: () => onNavigateSection("banners"),
      tag: "Active",
    },
    {
      label: "Database Node",
      val: healthStatus ? (healthStatus.success ? `${healthStatus.latencyMs}ms` : "Error") : "Supabase OK",
      desc: "Cloud PostgreSQL Engine",
      icon: Activity,
      action: () => onNavigateSection("health"),
      tag: "PostgreSQL",
    },
  ];

  return (
    <div className="space-y-6">
      {/* 4 Metric Highlights */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {quickMetricCards.map((card, idx) => {
          const Icon = card.icon;
          return (
            <div
              key={idx}
              onClick={card.action}
              className="p-4 sm:p-5 rounded-3xl bg-white dark:bg-[#111A2E] border border-slate-200/80 dark:border-slate-800 shadow-xs hover:border-emerald-500/50 hover:shadow-md transition-all cursor-pointer group"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-700 dark:text-slate-300 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                  <Icon className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                  {card.tag}
                </span>
              </div>
              <p className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tabular-nums">
                {card.val}
              </p>
              <p className="text-xs font-bold text-slate-700 dark:text-slate-300 mt-0.5">
                {card.label}
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                {card.desc}
              </p>
            </div>
          );
        })}
      </div>

      {/* Supabase Health & PostgreSQL Overview */}
      <SupabaseHealthPanel />

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
                  <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 font-medium">Latest registered students</p>
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
                        <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center font-black text-sm group-hover:bg-emerald-600 group-hover:text-white transition-colors shrink-0 uppercase">
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
                        <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-emerald-500 transition-colors" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <DatabaseStatusWidget refreshTrigger={refreshTrigger} onCountsLoaded={setDatabaseCounts} />
          <QuickActionsWidget onRefresh={() => loadData(true)} onHealthCheck={checkHealth} isRefreshing={refreshing} />
        </div>

        <div className="lg:col-span-4 space-y-6">
          <RecentActivityWidget refreshTrigger={refreshTrigger} />
          <AuditLogWidget />
          <ExportDataWidget questionsStore={questionsStore} />
          
          {/* System Info Box */}
          <div className="bg-slate-900 dark:bg-[#0B1220] rounded-3xl p-6 text-white border border-slate-800 shadow-xl relative overflow-hidden">
            <div className="absolute right-0 top-0 w-28 h-28 bg-emerald-500/20 rounded-full blur-2xl pointer-events-none" />
            <div className="relative space-y-5">
              <div className="flex items-center justify-between">
                <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center">
                  <ShieldCheck className="w-5 h-5 text-emerald-400" />
                </div>
                <span className="text-[11px] font-bold text-emerald-400">
                  Supabase Node Live
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
                  <span className="font-bold text-emerald-400">Supabase PostgreSQL</span>
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

export default AdminDashboardSection;
