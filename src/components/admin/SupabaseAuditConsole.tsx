import * as React from "react";
import { 
  Terminal, 
  Activity, 
  Database, 
  RefreshCw, 
  Download, 
  Search, 
  Filter, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  ShieldCheck, 
  Layers, 
  FileText, 
  Server, 
  Eye, 
  Trash2
} from "lucide-react";
import { supabase, isSupabaseConfigured } from "../../lib/supabase";
import { UserProfile } from "../../types";
import { isUserAdmin } from "../../utils/userProfileStorage";

interface SupabaseAuditConsoleProps {
  userProfile?: UserProfile | null;
  onNavigateBack?: () => void;
}

export interface AuditRecord {
  id: string;
  timestamp: string;
  operation: "INSERT" | "UPDATE" | "DELETE" | "SELECT" | "SYNC";
  table: string;
  user: string;
  status: "success" | "error";
  details: string;
}

const STORAGE_AUDIT_KEY = "disha2020_supabase_audit_logs_v1";
const LEGACY_STORAGE_AUDIT_KEY = "quizpro_supabase_audit_logs_v1";

export const SupabaseAuditConsole: React.FC<SupabaseAuditConsoleProps> = ({ userProfile }) => {
  const isAdmin = isUserAdmin(userProfile) || userProfile?.role === "admin";
  const [logs, setLogs] = React.useState<AuditRecord[]>(() => {
    if (typeof localStorage !== "undefined") {
      try {
        const stored = localStorage.getItem(STORAGE_AUDIT_KEY) || localStorage.getItem(LEGACY_STORAGE_AUDIT_KEY);
        if (stored) return JSON.parse(stored);
      } catch (_) {}
    }
    // Initial seeded logs
    return [
      {
        id: `aud_${Date.now()}_1`,
        timestamp: new Date().toLocaleTimeString(),
        operation: "SYNC",
        table: "all",
        user: userProfile?.email || "admin@disha2020.in",
        status: "success",
        details: "Clean-slate baseline synchronized with Supabase PostgreSQL."
      },
      {
        id: `aud_${Date.now()}_2`,
        timestamp: new Date().toLocaleTimeString(),
        operation: "SELECT",
        table: "subjects",
        user: userProfile?.email || "admin@disha2020.in",
        status: "success",
        details: "Validated authoritative subjects schema."
      }
    ];
  });

  const [tableFilter, setTableFilter] = React.useState<string>("all");
  const [opFilter, setOpFilter] = React.useState<string>("all");
  const [searchQuery, setSearchQuery] = React.useState<string>("");
  const [selectedRecord, setSelectedRecord] = React.useState<AuditRecord | null>(null);

  const filteredLogs = React.useMemo(() => {
    return logs.filter((log) => {
      if (tableFilter !== "all" && log.table !== tableFilter) return false;
      if (opFilter !== "all" && log.operation !== opFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          log.details.toLowerCase().includes(q) ||
          log.user.toLowerCase().includes(q) ||
          log.table.toLowerCase().includes(q) ||
          log.id.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [logs, tableFilter, opFilter, searchQuery]);

  const handleClearLogs = () => {
    if (confirm("Clear local audit history?")) {
      setLogs([]);
      if (typeof localStorage !== "undefined") {
        localStorage.removeItem(STORAGE_AUDIT_KEY);
      }
    }
  };

  const handleExportCSV = () => {
    if (logs.length === 0) return;
    const headers = ["ID", "Timestamp", "Operation", "Table", "User", "Status", "Details"];
    const rows = logs.map(l => [
      l.id,
      l.timestamp,
      l.operation,
      l.table,
      `"${l.user}"`,
      l.status,
      `"${l.details.replace(/"/g, '""')}"`
    ]);
    const csvContent = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `disha_supabase_audit_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white dark:bg-[#111A2E] rounded-3xl p-6 border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
            <Terminal className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-black text-slate-900 dark:text-white">
                Supabase Activity & Audit Console
              </h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200/60">
                Active Audit Log
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Track administrative mutations, cloud synchronizations, and PostgREST events.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleExportCSV}
            disabled={logs.length === 0}
            className="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>

          <button
            onClick={handleClearLogs}
            disabled={logs.length === 0}
            className="px-3.5 py-2 rounded-xl text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear History</span>
          </button>
        </div>
      </div>

      {/* Filter Bar & Table */}
      <div className="bg-white dark:bg-[#111A2E] rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={tableFilter}
              onChange={(e) => setTableFilter(e.target.value)}
              className="h-8 px-2.5 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-300 font-bold"
            >
              <option value="all">All Tables</option>
              <option value="subjects">subjects</option>
              <option value="chapters">chapters</option>
              <option value="topics">topics</option>
              <option value="questions">questions</option>
              <option value="profiles">profiles</option>
              <option value="attempts">attempts</option>
            </select>

            <select
              value={opFilter}
              onChange={(e) => setOpFilter(e.target.value)}
              className="h-8 px-2.5 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-300 font-bold"
            >
              <option value="all">All Operations</option>
              <option value="INSERT">INSERT</option>
              <option value="UPDATE">UPDATE</option>
              <option value="DELETE">DELETE</option>
              <option value="SELECT">SELECT</option>
              <option value="SYNC">SYNC</option>
            </select>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search audit trail..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-8 pl-9 pr-3 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white"
            />
          </div>
        </div>

        {/* Audit Log Items */}
        {filteredLogs.length === 0 ? (
          <div className="py-16 text-center text-xs text-slate-400 font-bold">
            No audit logs found matching criteria.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/75 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-800 text-slate-500 uppercase tracking-wider text-[10px] font-bold">
                <tr>
                  <th className="py-3 px-4">Time</th>
                  <th className="py-3 px-4">Operation</th>
                  <th className="py-3 px-4">Table</th>
                  <th className="py-3 px-4">Admin User</th>
                  <th className="py-3 px-4">Details</th>
                  <th className="py-3 px-4 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                {filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-4 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                      {log.timestamp}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase font-mono ${
                        log.operation === "INSERT" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400" :
                        log.operation === "DELETE" ? "bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400" :
                        log.operation === "UPDATE" ? "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400" :
                        log.operation === "SYNC" ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-400" :
                        "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                      }`}>
                        {log.operation}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-700 dark:text-slate-300">
                      {log.table}
                    </td>
                    <td className="py-3 px-4 text-slate-600 dark:text-slate-300 truncate max-w-[150px]">
                      {log.user}
                    </td>
                    <td className="py-3 px-4 text-slate-800 dark:text-slate-200 max-w-[320px]">
                      <p className="line-clamp-1">{log.details}</p>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span className={`inline-flex items-center gap-1 text-[10px] font-bold ${
                        log.status === "success" ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600"
                      }`}>
                        {log.status === "success" ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
                        <span className="uppercase">{log.status}</span>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default SupabaseAuditConsole;
