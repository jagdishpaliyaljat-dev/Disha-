import * as React from "react";
import { Clock, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { collection, query, orderBy, limit } from "firebase/firestore";
import { guardedOnSnapshot } from "../../utils/quotaTracker";
import { db, auth } from "../../lib/firebase";
import { LoginAttempt } from "../../types";
import { AdminCard } from "./AdminCard";

export const RecentActivityWidget: React.FC = () => {
  const [logs, setLogs] = React.useState<LoginAttempt[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (!auth.currentUser) return;
    const q = query(collection(db, "login_attempts"), orderBy("timestamp", "desc"), limit(5));
    const unsubscribe = guardedOnSnapshot(q, "Admin", "Recent Activity Listener", (snapshot) => {
      const logsData = snapshot.docs.map((doc: any) => ({
        ...doc.data(),
        id: doc.id,
      })) as LoginAttempt[];
      setLogs(logsData);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return (
    <div className="bg-white dark:bg-[#111A2E] border border-slate-200/80 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-4">
      <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
        <Clock className="w-4 h-4 text-slate-400" />
        <h3 className="text-xs font-black uppercase tracking-wider text-slate-400">Security Access Log</h3>
      </div>
      
      {loading ? (
        <div className="py-8 flex flex-col items-center justify-center gap-3">
          <Loader2 className="w-5 h-5 text-indigo-500 animate-spin" />
          <span className="text-xs font-bold text-slate-400">Polling security activity...</span>
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
                    {log.success ? "Authorized" : "Access Denied"}
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

