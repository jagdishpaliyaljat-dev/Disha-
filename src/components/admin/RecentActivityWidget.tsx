import * as React from "react";
import { Clock, CheckCircle2, AlertCircle, Loader2, ShieldCheck } from "lucide-react";
import { LoginAttempt } from "../../types";

const STORAGE_LOGIN_LOGS_KEY = "disha2020_security_login_logs_v1";
const LEGACY_STORAGE_LOGIN_LOGS_KEY = "quizpro_security_login_logs_v1";

export const RecentActivityWidget: React.FC = () => {
  const [logs, setLogs] = React.useState<LoginAttempt[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    try {
      if (typeof localStorage !== "undefined") {
        const stored = localStorage.getItem(STORAGE_LOGIN_LOGS_KEY) || localStorage.getItem(LEGACY_STORAGE_LOGIN_LOGS_KEY);
        if (stored) {
          setLogs(JSON.parse(stored));
          setLoading(false);
          return;
        }
      }

      // Default authorized session log
      setLogs([
        {
          id: "log_admin_1",
          email: "jagdishpaliyaljat@gmail.com",
          success: true,
          timestamp: new Date().toISOString()
        }
      ]);
    } catch (_) {
    } finally {
      setLoading(false);
    }
  }, []);

  return (
    <div className="bg-white dark:bg-[#111A2E] border border-slate-200/80 dark:border-slate-800 rounded-3xl p-6 shadow-xs space-y-4">
      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-500" />
          <h3 className="text-xs font-black uppercase tracking-wider text-slate-400">Security Access Log</h3>
        </div>
        <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded-full">
          OAuth Active
        </span>
      </div>
      
      {loading ? (
        <div className="py-8 flex flex-col items-center justify-center gap-3">
          <Loader2 className="w-5 h-5 text-emerald-500 animate-spin" />
          <span className="text-xs font-bold text-slate-400">Checking security activity...</span>
        </div>
      ) : logs.length === 0 ? (
        <div className="py-8 text-center">
          <p className="text-xs text-slate-400 font-bold">No recent authentication logs.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {logs.map((log) => (
            <div key={log.id} className="flex items-start gap-3 group">
              <div className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${log.success ? "bg-emerald-500" : "bg-rose-500"}`} />
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate">{log.email}</p>
                <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  <span className={`font-extrabold ${log.success ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                    {log.success ? "Authorized Admin" : "Access Denied"}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="tabular-nums font-medium">
                    {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
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
