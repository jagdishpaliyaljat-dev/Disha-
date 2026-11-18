import * as React from "react";
import { 
  Activity, 
  RefreshCw, 
  Database, 
  CheckCircle2, 
  ShieldCheck, 
  Layers, 
  FolderTree, 
  FileText, 
  AlertCircle,
  Clock,
  Server,
  Users,
  Award
} from "lucide-react";
import { supabase, isSupabaseConfigured } from "../../lib/supabase";
import { UserProfile } from "../../types";
import { isUserAdmin } from "../../utils/userProfileStorage";

interface DiagnosticReportProps {
  userProfile?: UserProfile | null;
}

export interface CollectionCountReport {
  collectionName: string;
  count: number | null;
  status: "success" | "error" | "loading";
  description: string;
  error?: string;
}

export const DiagnosticReport: React.FC<DiagnosticReportProps> = ({ userProfile }) => {
  const isAdmin = isUserAdmin(userProfile);

  const [loading, setLoading] = React.useState<boolean>(false);
  const [reports, setReports] = React.useState<CollectionCountReport[]>([]);
  const [lastScanTime, setLastScanTime] = React.useState<string | null>(null);
  const [scanDurationMs, setScanDurationMs] = React.useState<number | null>(null);
  const [scanError, setScanError] = React.useState<string | null>(null);

  const fetchCollectionCounts = React.useCallback(async () => {
    if (!isSupabaseConfigured()) {
      setScanError("Supabase environment variables (URL / anon key) not configured.");
      return;
    }

    setLoading(true);
    setScanError(null);
    const startTime = performance.now();

    const tablesToScan: { name: string; description: string }[] = [
      { name: "subjects", description: "Authoritative curriculum subjects" },
      { name: "chapters", description: "Subject chapter hierarchy" },
      { name: "topics", description: "Chapter micro-topics and concepts" },
      { name: "questions", description: "Primary MCQ question bank" },
      { name: "profiles", description: "Registered student and admin accounts" },
      { name: "attempts", description: "Student quiz and practice attempts" },
    ];

    try {
      const results = await Promise.all(
        tablesToScan.map(async (tbl) => {
          try {
            const { count, error } = await supabase
              .from(tbl.name)
              .select("*", { count: "exact", head: true });

            if (error) throw error;

            return {
              collectionName: tbl.name,
              count: count ?? 0,
              status: "success" as const,
              description: tbl.description,
            };
          } catch (err: any) {
            console.error(`Error getting count for Supabase table ${tbl.name}:`, err);
            return {
              collectionName: tbl.name,
              count: null,
              status: "error" as const,
              description: tbl.description,
              error: err?.message || "Failed to query row count",
            };
          }
        })
      );

      const endTime = performance.now();
      setScanDurationMs(Math.round(endTime - startTime));
      setLastScanTime(new Date().toLocaleTimeString());
      setReports(results);
    } catch (err: any) {
      setScanError(err?.message || "An unexpected error occurred while scanning Supabase PostgreSQL tables.");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    if (isAdmin) {
      fetchCollectionCounts();
    }
  }, [isAdmin, fetchCollectionCounts]);

  const totalRecords = reports
    .filter((r) => r.status === "success" && r.count !== null)
    .reduce((acc, curr) => acc + (curr.count || 0), 0);

  return (
    <div className="space-y-6">
      {/* Overview Card */}
      <div className="bg-white dark:bg-[#111A2E] rounded-3xl p-6 border border-slate-200/80 dark:border-slate-800 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-5">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <Server className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-black text-slate-900 dark:text-white">
                  Supabase Live Table Diagnostics
                </h3>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200/60">
                  SQL COUNT
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Target Database: <span className="font-mono text-slate-700 dark:text-slate-300 font-bold">eaidivceejkdqsshlraj.supabase.co</span>
              </p>
            </div>
          </div>

          <button
            onClick={fetchCollectionCounts}
            disabled={loading}
            className="px-4 py-2.5 rounded-xl bg-slate-900 dark:bg-emerald-600 hover:bg-slate-800 dark:hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-2 shadow-xs transition-all cursor-pointer active:scale-95 disabled:opacity-50 self-start sm:self-auto"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>{loading ? "Scanning Tables..." : "Run Live Diagnostic"}</span>
          </button>
        </div>

        {/* Scan Summary Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-5">
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800/80">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Stored Rows</span>
            <p className="text-2xl font-black text-slate-900 dark:text-white mt-1 tabular-nums">
              {loading ? "..." : totalRecords.toLocaleString()}
            </p>
            <p className="text-[11px] text-slate-500 mt-0.5">Across all authoritative tables</p>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800/80">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">REST Query Duration</span>
            <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1 tabular-nums">
              {scanDurationMs !== null ? `${scanDurationMs} ms` : "—"}
            </p>
            <p className="text-[11px] text-slate-500 mt-0.5">Live PostgREST round-trip</p>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800/80">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Last Diagnostic Probe</span>
            <p className="text-xl font-bold text-slate-900 dark:text-white mt-1">
              {lastScanTime || "Never"}
            </p>
            <p className="text-[11px] text-slate-500 mt-0.5">Auto-refreshed on demand</p>
          </div>
        </div>
      </div>

      {scanError && (
        <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-xs text-rose-700 dark:text-rose-300 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{scanError}</span>
        </div>
      )}

      {/* Tables Breakdown Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {reports.map((item) => (
          <div
            key={item.collectionName}
            className="p-5 rounded-3xl bg-white dark:bg-[#111A2E] border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col justify-between space-y-4 hover:border-emerald-500/40 transition-colors"
          >
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-black text-slate-900 dark:text-white">
                  public.{item.collectionName}
                </span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                  item.status === "success"
                    ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400"
                    : "bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400"
                }`}>
                  {item.status === "success" ? "Online" : "Error"}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                {item.description}
              </p>
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-baseline justify-between">
              <span className="text-[11px] text-slate-400 font-bold uppercase">Row Count</span>
              <span className="text-lg font-black text-slate-900 dark:text-white tabular-nums">
                {item.status === "loading" ? "..." : item.count !== null ? item.count.toLocaleString() : "—"}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default DiagnosticReport;
