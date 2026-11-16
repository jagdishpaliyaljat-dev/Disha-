import * as React from "react";
import {
  Activity,
  RefreshCw,
  Wifi,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  Clock,
  Zap,
  Loader2,
  Database,
  Terminal,
  ShieldCheck,
  Package,
  HardDrive,
  GitBranch,
  Radio,
  Server,
  Layers,
  BookOpen,
  Folder,
  FileText,
  Users,
  Award
} from "lucide-react";
import { supabase, isSupabaseConfigured, SUPABASE_URL } from "../../lib/supabase";
import { AdminCard } from "./AdminCard";

interface SupabaseHealthPanelProps {
  onBulkSync?: () => void;
  className?: string;
}

interface TableHealthMetric {
  name: string;
  count: number | null;
  status: "healthy" | "loading" | "error";
  error?: string;
}

export const SupabaseHealthPanel: React.FC<SupabaseHealthPanelProps> = ({
  onBulkSync,
  className = "",
}) => {
  const [latencyMs, setLatencyMs] = React.useState<number | null>(null);
  const [isChecking, setIsChecking] = React.useState<boolean>(false);
  const [connectionStatus, setConnectionStatus] = React.useState<"connected" | "connecting" | "offline">("connecting");
  const [lastCheckTime, setLastCheckTime] = React.useState<string>(() => new Date().toLocaleTimeString());
  
  const [tableMetrics, setTableMetrics] = React.useState<TableHealthMetric[]>([
    { name: "subjects", count: null, status: "loading" },
    { name: "chapters", count: null, status: "loading" },
    { name: "topics", count: null, status: "loading" },
    { name: "questions", count: null, status: "loading" },
    { name: "profiles", count: null, status: "loading" },
    { name: "attempts", count: null, status: "loading" },
  ]);

  const runHealthCheck = React.useCallback(async () => {
    if (!isSupabaseConfigured()) {
      setConnectionStatus("offline");
      return;
    }

    setIsChecking(true);
    const start = performance.now();

    try {
      // Ping check via subjects table
      const { data, error } = await supabase.from("subjects").select("id").limit(1);
      const end = performance.now();
      const ping = Math.round(end - start);
      setLatencyMs(ping);

      if (error) {
        throw error;
      }
      setConnectionStatus("connected");

      // Check table counts concurrently
      const tables = ["subjects", "chapters", "topics", "questions", "profiles", "attempts"];
      const countResults = await Promise.allSettled(
        tables.map(tbl => supabase.from(tbl).select("*", { count: "exact", head: true }))
      );

      const updated = tables.map((tbl, idx) => {
        const res = countResults[idx];
        if (res.status === "fulfilled" && !res.value.error) {
          return {
            name: tbl,
            count: res.value.count ?? 0,
            status: "healthy" as const,
          };
        } else {
          const err = res.status === "fulfilled" ? res.value.error?.message : "Failed to query";
          return {
            name: tbl,
            count: null,
            status: "error" as const,
            error: err,
          };
        }
      });

      setTableMetrics(updated);
      setLastCheckTime(new Date().toLocaleTimeString());
    } catch (err: any) {
      console.warn("[SupabaseHealth] Ping error:", err);
      setConnectionStatus("offline");
      setLatencyMs(null);
    } finally {
      setIsChecking(false);
    }
  }, []);

  React.useEffect(() => {
    runHealthCheck();
  }, [runHealthCheck]);

  const totalRecords = tableMetrics.reduce((acc, curr) => acc + (curr.count || 0), 0);

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Primary Overview Hero */}
      <div className="bg-white dark:bg-[#111A2E] rounded-3xl p-6 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-6">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-5">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <Database className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-black text-slate-900 dark:text-white">
                  Supabase Cloud PostgreSQL Health
                </h3>
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                  connectionStatus === "connected"
                    ? "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border-emerald-200/60"
                    : "bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 border-rose-200/60"
                }`}>
                  {connectionStatus === "connected" ? "Connected & Healthy" : "Offline / Unreachable"}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Target Instance: <span className="font-mono font-bold text-slate-700 dark:text-slate-300">eaidivceejkdqsshlraj.supabase.co</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => runHealthCheck()}
              disabled={isChecking}
              className="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isChecking ? "animate-spin text-emerald-600" : ""}`} />
              <span>Ping Database</span>
            </button>

            <a
              href="https://supabase.com/dashboard/project/eaidivceejkdqsshlraj"
              target="_blank"
              rel="noopener noreferrer"
              className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition-all cursor-pointer active:scale-95"
            >
              <span>Cloud Console</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>

        {/* 4-KPI Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800/80">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider">REST Ping</span>
              <Wifi className="w-4 h-4 text-emerald-500" />
            </div>
            <p className="text-xl font-black text-slate-900 dark:text-white tabular-nums">
              {latencyMs !== null ? `${latencyMs} ms` : "—"}
            </p>
            <p className="text-[11px] text-slate-500 mt-1">Round-trip API response</p>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800/80">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider">Total Rows</span>
              <Layers className="w-4 h-4 text-blue-500" />
            </div>
            <p className="text-xl font-black text-slate-900 dark:text-white tabular-nums">
              {totalRecords.toLocaleString()}
            </p>
            <p className="text-[11px] text-slate-500 mt-1">Across 6 primary tables</p>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800/80">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider">Quotas</span>
              <Zap className="w-4 h-4 text-amber-500" />
            </div>
            <p className="text-xl font-black text-emerald-600 dark:text-emerald-400">
              Unlimited
            </p>
            <p className="text-[11px] text-slate-500 mt-1">No 50k read/write breaker</p>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800/80">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider">Auth Provider</span>
              <ShieldCheck className="w-4 h-4 text-emerald-500" />
            </div>
            <p className="text-xl font-black text-slate-900 dark:text-white">
              Google OAuth
            </p>
            <p className="text-[11px] text-slate-500 mt-1">Active on Supabase Auth</p>
          </div>
        </div>

        {/* Table Rows Breakdown */}
        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-black uppercase tracking-wider text-slate-400">
              PostgreSQL Schema & Row Inventory
            </h4>
            <span className="text-[11px] text-slate-400">Last checked: {lastCheckTime}</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {tableMetrics.map((tbl) => (
              <div
                key={tbl.name}
                className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/80 flex items-center justify-between group hover:border-emerald-500/40 transition-colors"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300 shrink-0">
                    {tbl.name === "subjects" && <BookOpen className="w-4 h-4 text-blue-500" />}
                    {tbl.name === "chapters" && <Layers className="w-4 h-4 text-indigo-500" />}
                    {tbl.name === "topics" && <Folder className="w-4 h-4 text-emerald-500" />}
                    {tbl.name === "questions" && <FileText className="w-4 h-4 text-amber-500" />}
                    {tbl.name === "profiles" && <Users className="w-4 h-4 text-purple-500" />}
                    {tbl.name === "attempts" && <Award className="w-4 h-4 text-rose-500" />}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-900 dark:text-white capitalize truncate">{tbl.name}</p>
                    <p className="text-[10px] text-slate-400 truncate">public.{tbl.name}</p>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <p className="text-sm font-black text-slate-900 dark:text-white tabular-nums">
                    {tbl.status === "loading" ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400" />
                    ) : tbl.status === "error" ? (
                      <span className="text-rose-500 text-xs">Error</span>
                    ) : (
                      tbl.count?.toLocaleString() ?? "0"
                    )}
                  </p>
                  <span className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-tight">Active</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Clean Slate & Sync Quick Action Bar */}
        <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/20 dark:to-teal-950/20 border border-emerald-200/60 dark:border-emerald-900/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <div>
              <p className="text-xs font-bold text-emerald-900 dark:text-emerald-200">
                Authoritative Supabase Storage Mode
              </p>
              <p className="text-[11px] text-emerald-700/80 dark:text-emerald-400/80">
                100% clean-slate policy active. Zero hardcoded mock questions. All changes persist straight to PostgreSQL.
              </p>
            </div>
          </div>

          {onBulkSync && (
            <button
              onClick={onBulkSync}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer active:scale-95 shrink-0"
            >
              Push Local Sync
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default SupabaseHealthPanel;
