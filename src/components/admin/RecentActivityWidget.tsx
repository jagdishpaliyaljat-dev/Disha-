import * as React from "react";
import { Clock, CheckCircle2, AlertCircle, Loader2, ShieldCheck, Activity, RefreshCw } from "lucide-react";
import { LoginAttempt } from "../../types";
import { supabase, isSupabaseConfigured } from "../../lib/supabase";

const STORAGE_LOGIN_LOGS_KEY = "disha2020_security_login_logs_v1";
const LEGACY_STORAGE_LOGIN_LOGS_KEY = "quizpro_security_login_logs_v1";

interface UnifiedActivityItem {
  id: string;
  type: "auth" | "attempt" | "system";
  title: string;
  subtitle: string;
  success: boolean;
  timestamp: string;
}

interface RecentActivityWidgetProps {
  refreshTrigger?: number;
}

export const RecentActivityWidget: React.FC<RecentActivityWidgetProps> = ({ refreshTrigger = 0 }) => {
  const [activities, setActivities] = React.useState<UnifiedActivityItem[]>([]);
  const [loading, setLoading] = React.useState(true);

  const loadActivities = React.useCallback(async () => {
    setLoading(true);
    const list: UnifiedActivityItem[] = [];

    // 1. Load Local Auth Logs
    try {
      if (typeof localStorage !== "undefined") {
        const stored = localStorage.getItem(STORAGE_LOGIN_LOGS_KEY) || localStorage.getItem(LEGACY_STORAGE_LOGIN_LOGS_KEY);
        if (stored) {
          const parsed: LoginAttempt[] = JSON.parse(stored);
          parsed.slice(0, 4).forEach((log) => {
            list.push({
              id: log.id,
              type: "auth",
              title: log.email || "Administrator",
              subtitle: log.success ? "Authorized Admin Session" : "Access Denied",
              success: Boolean(log.success),
              timestamp: log.timestamp || new Date().toISOString(),
            });
          });
        }
      }
    } catch {}

    // 2. Fetch Recent Attempts from Supabase if configured
    if (isSupabaseConfigured()) {
      try {
        const { data: attempts } = await supabase
          .from("attempts")
          .select("id, user_id, topic_id, score, total_questions, created_at")
          .order("created_at", { ascending: false })
          .limit(4);

        if (attempts && attempts.length > 0) {
          attempts.forEach((att: any) => {
            list.push({
              id: att.id,
              type: "attempt",
              title: `Quiz Practice Session`,
              subtitle: `Score: ${att.score ?? 0}/${att.total_questions ?? 0}`,
              success: true,
              timestamp: att.created_at || new Date().toISOString(),
            });
          });
        }
      } catch {}
    }

    // Default baseline if completely empty
    if (list.length === 0) {
      list.push({
        id: "act_baseline_admin",
        type: "auth",
        title: "jagdishpaliyaljat@gmail.com",
        subtitle: "Authorized Super Administrator",
        success: true,
        timestamp: new Date().toISOString(),
      });
    }

    // Sort by most recent timestamp descending
    list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    setActivities(list.slice(0, 5));
    setLoading(false);
  }, []);

  React.useEffect(() => {
    loadActivities();
  }, [loadActivities, refreshTrigger]);

  const formatTimestamp = (iso: string) => {
    try {
      const d = new Date(iso);
      const diffMs = Date.now() - d.getTime();
      const diffMins = Math.floor(diffMs / (60 * 1000));
      if (diffMins < 1) return "Just now";
      if (diffMins < 60) return `${diffMins}m ago`;
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return "Recent";
    }
  };

  return (
    <div className="bg-white dark:bg-[#111A2E] border border-slate-200/80 dark:border-slate-800 rounded-3xl p-4 sm:p-6 shadow-xs space-y-4">
      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-emerald-500" />
          <h3 className="text-xs font-black uppercase tracking-wider text-slate-400">Recent Activity Feed</h3>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => loadActivities()}
            disabled={loading}
            aria-label="Refresh recent activity"
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            title="Refresh activity feed"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-emerald-500" : ""}`} />
          </button>
          <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded-full">
            Live Stream
          </span>
        </div>
      </div>
      
      {loading ? (
        <div className="py-8 flex flex-col items-center justify-center gap-3">
          <Loader2 className="w-5 h-5 text-emerald-500 animate-spin" />
          <span className="text-xs font-bold text-slate-400">Fetching live activity...</span>
        </div>
      ) : activities.length === 0 ? (
        <div className="py-8 text-center">
          <p className="text-xs text-slate-400 font-bold">No recent activities recorded.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {activities.map((act) => (
            <div key={act.id} className="flex items-start gap-3 group">
              <div
                className={`mt-1.5 w-2.5 h-2.5 rounded-full shrink-0 ${
                  act.success ? "bg-emerald-500 shadow-xs shadow-emerald-500/50" : "bg-rose-500"
                }`}
              />
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate">{act.title}</p>
                <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  <span
                    className={`font-extrabold ${
                      act.success ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
                    }`}
                  >
                    {act.subtitle}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="tabular-nums font-medium text-[11px]">
                    {formatTimestamp(act.timestamp)}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
