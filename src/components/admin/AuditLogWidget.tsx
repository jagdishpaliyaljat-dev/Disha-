import * as React from "react";
import { Terminal, Clock } from "lucide-react";
import { collection, query, orderBy } from "firebase/firestore";
import { guardedOnSnapshot } from "../../utils/quotaTracker";
import { db, auth } from "../../lib/firebase";
import { AdminAuditLog } from "../../types";
import { AdminCard } from "./AdminCard";

export const AuditLogWidget: React.FC = () => {
  const [logs, setLogs] = React.useState<AdminAuditLog[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (!auth.currentUser) return;
    const q = query(collection(db, "adminAuditLogs"), orderBy("timestamp", "desc"));
    const unsubscribe = guardedOnSnapshot(q, "Admin", "Audit Log Listener", (snapshot) => {
      const logsData = snapshot.docs.map((doc: any) => ({
        ...doc.data(),
        id: doc.id,
      })) as AdminAuditLog[];
      setLogs(logsData);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const todayStr = new Date().toISOString().slice(0, 10);
  const todayCount = logs.filter(log => log.timestamp.startsWith(todayStr)).length;

  return (
    <div className="bg-white dark:bg-[#111A2E] border border-slate-200/80 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-4">
      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-slate-400" />
          <h3 className="text-xs font-black uppercase tracking-wider text-slate-400">Audit Registry</h3>
        </div>
        {todayCount > 0 && (
          <span className="text-xs font-bold text-slate-700 dark:text-slate-300 tabular-nums">
            {todayCount} Operations Today
          </span>
        )}
      </div>
      
      {loading ? (
        <div className="py-8 flex flex-col items-center justify-center gap-3">
          <Clock className="w-5 h-5 text-indigo-500 animate-spin" />
          <span className="text-xs font-bold text-slate-400">Polling registry logs...</span>
        </div>
      ) : logs.length === 0 ? (
        <div className="py-8 text-center">
          <p className="text-xs text-slate-400 font-bold">Empty audit log registry.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {logs.slice(0, 5).map((log) => (
            <div key={log.id} className="flex items-start justify-between gap-4 group">
              <div className="min-w-0">
                <p className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate">{log.action}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  by {log.adminEmail?.split('@')[0]}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-xs font-bold text-slate-900 dark:text-white tabular-nums">
                  {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
                <p className="text-[11px] text-slate-400 font-medium tabular-nums">
                  {new Date(log.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                </p>
              </div>
            </div>
          ))}
          
          {logs.length > 5 && (
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 text-center">
              <span className="text-xs font-medium text-slate-400">Showing 5 of {logs.length} logs</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

