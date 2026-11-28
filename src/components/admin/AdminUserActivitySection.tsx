import * as React from "react";
import {
  Users,
  TrendingUp,
  Target,
  BookOpen,
  Smartphone,
  Globe,
  RefreshCw,
  Loader2,
  Award,
  Clock,
  Search,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { AdminCard } from "./AdminCard";
import { supabase, isSupabaseConfigured } from "../../lib/supabase";

interface UserFunnelData {
  period_days: number;
  registered: number;
  logged_in: number;
  login_pct: number;
  attempted_quiz: number;
  quiz_pct: number;
  returned: number;
  return_pct: number;
}

interface FeatureAdoptionRow {
  feature_name: string;
  feature_label: string;
  unique_users: number;
  adoption_pct: number;
}

interface SubjectAnalyticsRow {
  subject: string;
  total_attempts: number;
  avg_score: number;
  weak_pct: number;
  unique_students: number;
}

interface TopActiveUserRow {
  user_id: string;
  user_email: string;
  user_name: string;
  district: string | null;
  platform: string;
  total_attempts: number;
  avg_score: number | null;
  last_active: string | null;
  total_sessions: number;
}

export const AdminUserActivitySection: React.FC = () => {
  const [days, setDays] = React.useState<number>(30);
  const [loading, setLoading] = React.useState<boolean>(true);
  const [error, setError] = React.useState<string | null>(null);
  const [searchQuery, setSearchQuery] = React.useState<string>("");

  const [funnel, setFunnel] = React.useState<UserFunnelData | null>(null);
  const [features, setFeatures] = React.useState<FeatureAdoptionRow[]>([]);
  const [subjects, setSubjects] = React.useState<SubjectAnalyticsRow[]>([]);
  const [topUsers, setTopUsers] = React.useState<TopActiveUserRow[]>([]);

  const fetchActivityData = React.useCallback(async () => {
    if (!isSupabaseConfigured()) {
      setError("Supabase configured nahi hai.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const [funnelRes, featureRes, subjectRes, usersRes] = await Promise.all([
        supabase.rpc("get_admin_user_funnel", { p_days: days }),
        supabase.rpc("get_feature_adoption", { p_days: days }),
        supabase.rpc("get_subject_analytics", { p_days: days }),
        supabase.rpc("get_top_active_users", { p_limit: 50, p_days: days }),
      ]);

      if (funnelRes.error) throw funnelRes.error;
      setFunnel(funnelRes.data as UserFunnelData);
      setFeatures((featureRes.data as FeatureAdoptionRow[]) || []);
      setSubjects((subjectRes.data as SubjectAnalyticsRow[]) || []);
      setTopUsers((usersRes.data as TopActiveUserRow[]) || []);
    } catch (err: any) {
      setError(err?.message || "User activity data load karne mein error aaya.");
    } finally {
      setLoading(false);
    }
  }, [days]);

  React.useEffect(() => {
    fetchActivityData();
  }, [fetchActivityData]);

  const filteredUsers = React.useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return topUsers;
    return topUsers.filter(
      (u) =>
        (u.user_name || "").toLowerCase().includes(q) ||
        (u.user_email || "").toLowerCase().includes(q) ||
        (u.district || "").toLowerCase().includes(q)
    );
  }, [topUsers, searchQuery]);

  const formatLastActive = (iso: string | null) => {
    if (!iso) return "Never";
    const diffMs = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diffMs / 60000);
    if (mins < 60) return `${Math.max(1, mins)}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const d = Math.floor(hrs / 24);
    return `${d}d ago`;
  };

  return (
    <div className="space-y-6">
      {/* Header & Period Filter */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
            <Users className="w-5 h-5 text-[#7045D8]" />
            <span>User Activity &amp; Conversion Funnel</span>
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Registration se quiz attempt aur retention tak ka complete breakdown
          </p>
        </div>

        <div className="flex items-center gap-2">
          {[7, 30, 90].map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDays(d)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                days === d
                  ? "bg-[#7045D8] text-white shadow-sm"
                  : "bg-white dark:bg-[#1B1536] text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-[#31275E]"
              }`}
            >
              {d}d
            </button>
          ))}
          <button
            type="button"
            onClick={fetchActivityData}
            disabled={loading}
            className="p-2 rounded-xl bg-white dark:bg-[#1B1536] border border-slate-200 dark:border-[#31275E] text-slate-600 dark:text-slate-300 hover:text-[#7045D8] cursor-pointer disabled:opacity-50"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 text-xs text-red-700 dark:text-red-300 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {loading && !funnel ? (
        <div className="py-12 flex flex-col items-center justify-center gap-2 text-slate-500">
          <Loader2 className="w-6 h-6 animate-spin text-[#7045D8]" />
          <span className="text-xs font-medium">Loading user activity...</span>
        </div>
      ) : (
        <>
          {/* 1. User Conversion Funnel */}
          {funnel && (
            <AdminCard title="User Conversion Funnel" icon={TrendingUp}>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3.5 rounded-2xl bg-[#7045D8]/10 border border-[#7045D8]/20">
                  <div className="text-[11px] font-bold text-[#7045D8] uppercase">Registered</div>
                  <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">
                    {funnel.registered}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">Last {funnel.period_days} days</div>
                </div>

                <div className="p-3.5 rounded-2xl bg-indigo-500/10 border border-indigo-500/20">
                  <div className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 uppercase">
                    Logged In
                  </div>
                  <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">
                    {funnel.logged_in}
                  </div>
                  <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold mt-0.5">
                    {funnel.login_pct}% of registered
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20">
                  <div className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 uppercase">
                    Quiz Attempted
                  </div>
                  <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">
                    {funnel.attempted_quiz}
                  </div>
                  <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold mt-0.5">
                    {funnel.quiz_pct}% of logged in
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20">
                  <div className="text-[11px] font-bold text-amber-600 dark:text-amber-400 uppercase">
                    Returned (2+ Sessions)
                  </div>
                  <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">
                    {funnel.returned}
                  </div>
                  <div className="text-[11px] text-amber-600 dark:text-amber-400 font-bold mt-0.5">
                    {funnel.return_pct}% retention
                  </div>
                </div>
              </div>
            </AdminCard>
          )}

          {/* 2. Feature Adoption & Subject Analytics */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <AdminCard title="Feature Adoption" icon={Target}>
              {features.length === 0 ? (
                <p className="text-xs text-slate-500 py-4 text-center">
                  Abhi feature events record nahi hue hain.
                </p>
              ) : (
                <div className="space-y-3">
                  {features.map((f) => (
                    <div key={f.feature_name} className="space-y-1">
                      <div className="flex justify-between text-xs font-bold">
                        <span className="text-slate-700 dark:text-slate-200">{f.feature_label}</span>
                        <span className="text-[#7045D8] dark:text-[#A78BFA]">
                          {f.unique_users} users ({f.adoption_pct}%)
                        </span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-[#241D48] overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-[#7045D8] to-[#5B32BF]"
                          style={{ width: `${Math.min(100, f.adoption_pct)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </AdminCard>

            <AdminCard title="Subject-Wise Performance" icon={BookOpen}>
              {subjects.length === 0 ? (
                <p className="text-xs text-slate-500 py-4 text-center">
                  Abhi subject-wise quiz attempts record nahi hue hain.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-[#31275E] text-slate-500">
                        <th className="py-2 font-bold">Subject</th>
                        <th className="py-2 font-bold text-right">Attempts</th>
                        <th className="py-2 font-bold text-right">Avg Score</th>
                        <th className="py-2 font-bold text-right">Weak %</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-[#241D48]">
                      {subjects.map((s) => (
                        <tr key={s.subject}>
                          <td className="py-2 font-bold text-slate-800 dark:text-slate-200">{s.subject}</td>
                          <td className="py-2 text-right text-slate-600 dark:text-slate-300">
                            {s.total_attempts}
                          </td>
                          <td className="py-2 text-right font-bold text-emerald-600 dark:text-emerald-400">
                            {s.avg_score}%
                          </td>
                          <td className="py-2 text-right font-bold text-amber-600 dark:text-amber-400">
                            {s.weak_pct}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </AdminCard>
          </div>

          {/* 3. Per-User Activity Table */}
          <AdminCard title="Top Active Users" icon={Award}>
            <div className="mb-3 relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name, email, or district..."
                className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-50 dark:bg-[#130E26] border border-slate-200 dark:border-[#31275E] text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#7045D8]"
              />
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-[#31275E] text-slate-500">
                    <th className="py-2 font-bold">Student</th>
                    <th className="py-2 font-bold">District</th>
                    <th className="py-2 font-bold">Platform</th>
                    <th className="py-2 font-bold text-right">Attempts</th>
                    <th className="py-2 font-bold text-right">Avg Score</th>
                    <th className="py-2 font-bold text-right">Last Active</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-[#241D48]">
                  {filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-6 text-center text-slate-500">
                        Koi user activity record nahi mila.
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map((u) => (
                      <tr key={u.user_id} className="hover:bg-slate-50 dark:hover:bg-[#241D48]/40">
                        <td className="py-2.5 pr-2">
                          <div className="font-bold text-slate-900 dark:text-white">{u.user_name}</div>
                          <div className="text-[10px] text-slate-500 truncate max-w-[180px]">
                            {u.user_email}
                          </div>
                        </td>
                        <td className="py-2.5 text-slate-600 dark:text-slate-300">
                          {u.district || "—"}
                        </td>
                        <td className="py-2.5">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#7045D8]/10 text-[#7045D8] dark:text-[#A78BFA]">
                            {u.platform === "android" ? (
                              <Smartphone className="w-3 h-3" />
                            ) : (
                              <Globe className="w-3 h-3" />
                            )}
                            {u.platform}
                          </span>
                        </td>
                        <td className="py-2.5 text-right font-bold text-slate-800 dark:text-slate-200">
                          {u.total_attempts}
                        </td>
                        <td className="py-2.5 text-right font-bold text-emerald-600 dark:text-emerald-400">
                          {u.avg_score !== null ? `${u.avg_score}%` : "—"}
                        </td>
                        <td className="py-2.5 text-right text-slate-500">
                          <span className="inline-flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatLastActive(u.last_active)}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </AdminCard>
        </>
      )}
    </div>
  );
};
