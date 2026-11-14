import * as React from "react";
import { 
  Terminal, Activity, Database, RefreshCw, Download, Trash2, Search, 
  Filter, CheckCircle2, AlertCircle, Clock, ArrowUpDown, ShieldCheck, 
  Layers, FileText, Server, Eye, ChevronDown, ChevronUp 
} from "lucide-react";
import { 
  getQuotaSummary, 
  subscribeQuota, 
  QuotaDailySummary, 
  QuotaActionLog, 
  clearFailedQuotaLogs, 
  exportUsageLogCSV 
} from "../../utils/quotaTracker";
import { AdminCard } from "./AdminCard";
import { UserProfile } from "../../types";
import { isUserAdmin } from "../../utils/userProfileStorage";

interface FirebaseAuditConsoleProps {
  userProfile: UserProfile | null;
  onNavigateBack?: () => void;
}

export const FirebaseAuditConsole: React.FC<FirebaseAuditConsoleProps> = ({ userProfile }) => {
  const isAdmin = isUserAdmin(userProfile);
  const [summary, setSummary] = React.useState<QuotaDailySummary>(() => getQuotaSummary());
  const [opFilter, setOpFilter] = React.useState<string>("all");
  const [categoryFilter, setCategoryFilter] = React.useState<string>("all");
  const [collectionFilter, setCollectionFilter] = React.useState<string>("all");
  const [searchQuery, setSearchQuery] = React.useState<string>("");
  const [selectedLog, setSelectedLog] = React.useState<QuotaActionLog | null>(null);

  React.useEffect(() => {
    const unsubscribe = subscribeQuota((updated) => {
      setSummary(updated);
    });
    return () => unsubscribe();
  }, []);

  if (!isAdmin) {
    return (
      <div className="p-8 max-w-xl mx-auto my-12 bg-white dark:bg-[#111A2E] rounded-3xl border border-rose-200 text-center shadow-lg">
        <h2 className="text-xl font-black text-rose-600">Access Denied</h2>
        <p className="text-xs text-slate-500 mt-2">Administrator privileges required to view real-time Firebase audit logs.</p>
      </div>
    );
  }

  const logs = summary.logs || [];
  const collectionsList = Array.from(new Set(logs.map(l => l.collectionName).filter(Boolean)));

  const filteredLogs = logs.filter(log => {
    if (opFilter !== "all" && log.operation !== opFilter) return false;
    if (categoryFilter !== "all" && log.category !== categoryFilter) return false;
    if (collectionFilter !== "all" && log.collectionName !== collectionFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchAction = log.actionName?.toLowerCase().includes(q);
      const matchPath = log.path?.toLowerCase().includes(q);
      const matchColl = log.collectionName?.toLowerCase().includes(q);
      const matchUser = log.userEmail?.toLowerCase().includes(q);
      if (!matchAction && !matchPath && !matchColl && !matchUser) return false;
    }
    return true;
  });

  const handleExportCSV = () => {
    const csv = exportUsageLogCSV();
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `disha2020_firebase_audit_${summary.date}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2.5 bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 rounded-2xl">
              <Terminal className="w-6 h-6" />
            </span>
            <div>
              <h1 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
                Real-Time Firebase Audit Console
                <span className="text-[10px] px-2.5 py-0.5 rounded-full font-black bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200">
                  LIVE STREAMING
                </span>
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                Track all Firestore read, write, delete operations & listeners in real-time to debug cache re-fetches and deletions.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-[#111A2E] border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-black transition-all hover:bg-slate-50 shadow-xs active:scale-95"
          >
            <Download className="w-4 h-4 text-blue-500" />
            Export CSV
          </button>
          <button
            onClick={() => clearFailedQuotaLogs()}
            className="flex items-center gap-2 px-4 py-2.5 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/40 text-rose-700 dark:text-rose-400 rounded-xl text-xs font-black transition-all hover:bg-rose-100 shadow-xs active:scale-95"
          >
            <Trash2 className="w-4 h-4" />
            Clear Logs
          </button>
        </div>
      </div>

      {/* Metrics Summary Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Total Reads Today", value: summary.reads, icon: Database, color: "text-blue-600 bg-blue-50 dark:bg-blue-950/40 border-blue-100" },
          { label: "Total Writes Today", value: summary.writes, icon: Activity, color: "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-100" },
          { label: "Total Deletes Today", value: summary.deletes, icon: Trash2, color: "text-amber-600 bg-amber-50 dark:bg-amber-950/40 border-amber-100" },
          { label: "Failed Operations", value: summary.failedReads + summary.failedWrites, icon: AlertCircle, color: "text-rose-600 bg-rose-50 dark:bg-rose-950/40 border-rose-100" },
        ].map((card) => (
          <div key={card.label} className={`p-4 rounded-2xl border ${card.color} flex flex-col justify-between shadow-xs`}>
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-widest opacity-70">{card.label}</span>
              <card.icon className="w-4 h-4 opacity-70" />
            </div>
            <div className="mt-3 text-2xl font-black tracking-tighter">
              {card.value.toLocaleString()}
            </div>
          </div>
        ))}
      </div>

      {/* Diagnostic Hint / Resurrection Tracker Helper */}
      <div className="p-5 bg-blue-50 dark:bg-blue-950/20 border border-blue-200/60 dark:border-blue-900/40 rounded-2xl flex items-start gap-4">
        <ShieldCheck className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
        <div className="space-y-1 text-xs text-blue-900 dark:text-blue-300 font-medium leading-relaxed">
          <p className="font-black uppercase tracking-wider text-[10px] text-blue-700 dark:text-blue-400">
            Resurrection Debugger & Re-fetch Tracker
          </p>
          <p>
            If documents reappear after manual deletion in Firestore, inspect the real-time log below to see which component or hook (e.g. <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded font-mono">useFirebaseSync</code>, local cache sync, or app load) triggered a write or read request for that collection path.
          </p>
        </div>
      </div>

      {/* Filters & Search */}
      <AdminCard noPadding>
        <div className="p-4 sm:p-6 border-b border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            {/* Search */}
            <div className="relative w-full sm:w-auto sm:min-w-[220px]">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search action, path, user..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 focus:outline-none focus:border-blue-500 font-medium"
              />
            </div>

            {/* Operation Filter */}
            <select
              value={opFilter}
              onChange={(e) => setOpFilter(e.target.value)}
              className="px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 font-bold text-slate-700 dark:text-slate-300"
            >
              <option value="all">All Operations</option>
              <option value="read">Read (Get / Query)</option>
              <option value="write">Write (Set / Update)</option>
              <option value="delete">Delete</option>
            </select>

            {/* Category Filter */}
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 font-bold text-slate-700 dark:text-slate-300"
            >
              <option value="all">All Categories</option>
              <option value="Admin">Admin</option>
              <option value="Student">Student</option>
              <option value="Background">Background</option>
              <option value="Health">Health</option>
            </select>

            {/* Collection Filter */}
            <select
              value={collectionFilter}
              onChange={(e) => setCollectionFilter(e.target.value)}
              className="px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 font-bold text-slate-700 dark:text-slate-300"
            >
              <option value="all">All Collections ({collectionsList.length})</option>
              {collectionsList.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <div className="text-xs font-black text-slate-400 uppercase tracking-widest">
            Showing {filteredLogs.length} of {logs.length} events
          </div>
        </div>

        {/* Logs Table */}
        <div className="overflow-x-auto">
          {filteredLogs.length === 0 ? (
            <div className="py-16 text-center space-y-2">
              <Terminal className="w-10 h-10 text-slate-300 mx-auto animate-pulse" />
              <p className="text-xs font-bold text-slate-400">No matching Firebase audit events recorded yet.</p>
              <p className="text-[10px] text-slate-400 italic">Operations will stream here live as you use the application.</p>
            </div>
          ) : (
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-800 font-black text-slate-400 uppercase tracking-widest text-[9px]">
                <tr>
                  <th className="px-5 py-3">Timestamp</th>
                  <th className="px-4 py-3">Operation</th>
                  <th className="px-4 py-3">Action / Caller</th>
                  <th className="px-4 py-3">Collection / Path</th>
                  <th className="px-4 py-3">Cost (Reads/Writes/Del)</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-5 py-3 text-right">Inspect</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                {filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors group">
                    <td className="px-5 py-3.5 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                      {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </td>

                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-widest ${
                        log.operation === "delete" ? "bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400" :
                        log.operation === "write" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400" :
                        "bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-400"
                      }`}>
                        {log.operation || "read"}
                      </span>
                    </td>

                    <td className="px-4 py-3.5">
                      <div className="font-black text-slate-900 dark:text-white truncate max-w-[200px]" title={log.actionName}>
                        {log.actionName}
                      </div>
                      <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">
                        {log.category} {log.userEmail ? `• ${log.userEmail.split('@')[0]}` : ""}
                      </div>
                    </td>

                    <td className="px-4 py-3.5 font-mono text-[11px] text-slate-600 dark:text-slate-300 max-w-[220px] truncate" title={log.path || log.collectionName}>
                      /{log.path || log.collectionName}
                    </td>

                    <td className="px-4 py-3.5 whitespace-nowrap font-mono text-[11px] text-slate-600 dark:text-slate-400">
                      {log.reads > 0 ? `${log.reads} R` : ""}
                      {log.writes > 0 ? ` ${log.writes} W` : ""}
                      {log.deletes > 0 ? ` ${log.deletes} D` : ""}
                      {log.reads === 0 && log.writes === 0 && log.deletes === 0 ? "0" : ""}
                    </td>

                    <td className="px-4 py-3.5 whitespace-nowrap">
                      {log.failed ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[9px] font-black bg-rose-100 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400">
                          <AlertCircle className="w-3 h-3" /> Failed
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[9px] font-black bg-emerald-100 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400">
                          <CheckCircle2 className="w-3 h-3" /> OK
                        </span>
                      )}
                    </td>

                    <td className="px-5 py-3.5 text-right whitespace-nowrap">
                      <button
                        onClick={() => setSelectedLog(log)}
                        className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-blue-600 hover:text-white text-slate-700 dark:text-slate-300 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
                      >
                        Inspect
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </AdminCard>

      {/* Log Detail Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white dark:bg-[#111A2E] rounded-3xl border border-slate-200 dark:border-slate-800 max-w-lg w-full p-4 sm:p-6 shadow-2xl space-y-5 sm:space-y-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
              <div>
                <h3 className="text-base font-black text-slate-900 dark:text-white">Audit Event Details</h3>
                <p className="text-[10px] text-slate-400 font-mono mt-0.5">{selectedLog.id}</p>
              </div>
              <button 
                onClick={() => setSelectedLog(null)}
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-slate-500 transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-400 font-bold">Timestamp</span>
                <span className="font-black text-slate-900 dark:text-white">{new Date(selectedLog.timestamp).toISOString()}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-400 font-bold">Action Name</span>
                <span className="font-black text-blue-600">{selectedLog.actionName}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-400 font-bold">Operation / Category</span>
                <span className="font-black text-slate-900 dark:text-white uppercase">{selectedLog.operation} • {selectedLog.category}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-400 font-bold">Collection & Path</span>
                <span className="font-mono font-black text-slate-700 dark:text-slate-300">{selectedLog.path || selectedLog.collectionName}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-400 font-bold">Reads / Writes / Deletes</span>
                <span className="font-mono font-black text-slate-900 dark:text-white">{selectedLog.reads} R, {selectedLog.writes} W, {selectedLog.deletes} D</span>
              </div>
              {selectedLog.userEmail && (
                <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-slate-400 font-bold">Triggered By User</span>
                  <span className="font-black text-slate-900 dark:text-white">{selectedLog.userEmail}</span>
                </div>
              )}
              {selectedLog.failed && (
                <div className="p-3 bg-rose-50 dark:bg-rose-950/40 rounded-xl border border-rose-200 text-rose-700 space-y-1">
                  <p className="font-black uppercase tracking-wider text-[10px]">Error Code: {selectedLog.errorCode || "Unknown"}</p>
                  <p className="text-[11px] font-mono">{selectedLog.errorMessage}</p>
                </div>
              )}
            </div>

            <button
              onClick={() => setSelectedLog(null)}
              className="w-full py-3 bg-slate-900 dark:bg-slate-800 text-white rounded-2xl text-xs font-black uppercase tracking-widest transition-all active:scale-95"
            >
              Close Details
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
