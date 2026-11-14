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
  Server
} from "lucide-react";
import { collection, getCountFromServer } from "firebase/firestore";
import { db, isFirebaseConfigured } from "../../lib/firebase";
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
  const isAdmin = isUserAdmin(userProfile) || userProfile?.role === "admin";

  const [loading, setLoading] = React.useState<boolean>(false);
  const [reports, setReports] = React.useState<CollectionCountReport[]>([]);
  const [lastScanTime, setLastScanTime] = React.useState<string | null>(null);
  const [scanDurationMs, setScanDurationMs] = React.useState<number | null>(null);
  const [scanError, setScanError] = React.useState<string | null>(null);

  const fetchCollectionCounts = React.useCallback(async () => {
    if (!isFirebaseConfigured()) {
      setScanError("Firebase is not configured in this environment.");
      return;
    }

    setLoading(true);
    setScanError(null);
    const startTime = performance.now();

    const collectionsToScan: { name: string; description: string }[] = [
      { name: "subjects", description: "Top-level curriculum subjects" },
      { name: "chapters", description: "Subject chapter groupings" },
      { name: "topics", description: "Chapter micro-topics and sub-modules" },
      { name: "mcqs", description: "Primary question bank collection" },
      { name: "questions", description: "Secondary legacy / dual-write collection" },
    ];

    try {
      const results = await Promise.all(
        collectionsToScan.map(async (col) => {
          try {
            const collRef = collection(db, col.name);
            const snapshot = await getCountFromServer(collRef);
            return {
              collectionName: col.name,
              count: snapshot.data().count,
              status: "success" as const,
              description: col.description,
            };
          } catch (err: any) {
            console.error(`Error getting count for collection ${col.name}:`, err);
            return {
              collectionName: col.name,
              count: null,
              status: "error" as const,
              description: col.description,
              error: err?.message || "Failed to fetch count",
            };
          }
        })
      );

      const endTime = performance.now();
      setScanDurationMs(Math.round(endTime - startTime));
      setLastScanTime(new Date().toLocaleTimeString());
      setReports(results);
    } catch (err: any) {
      setScanError(err?.message || "An unexpected error occurred while scanning Firestore.");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    if (isAdmin) {
      fetchCollectionCounts();
    }
  }, [isAdmin, fetchCollectionCounts]);

  if (!isAdmin) {
    return (
      <div className="p-8 bg-rose-50 dark:bg-rose-950/20 rounded-3xl border border-rose-200 dark:border-rose-800 text-center space-y-3">
        <ShieldCheck className="w-12 h-12 text-rose-500 mx-auto" />
        <h2 className="text-lg font-black text-rose-900 dark:text-rose-200">Admin Access Required</h2>
        <p className="text-xs text-rose-700 dark:text-rose-300 font-medium max-w-md mx-auto">
          The Diagnostic Report panel is strictly restricted to authorized Administrators.
        </p>
      </div>
    );
  }

  const mcqsCount = reports.find((r) => r.collectionName === "mcqs")?.count || 0;
  const questionsCount = reports.find((r) => r.collectionName === "questions")?.count || 0;
  const totalPhysicalDocs = mcqsCount + questionsCount;

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white dark:bg-[#111A2E] p-5 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
            <Activity className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-black text-slate-900 dark:text-white">Firestore Diagnostics & Count Report</h2>
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-black uppercase tracking-wider border border-emerald-500/20">
                getCountFromServer
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
              Read-only server-side document counts across core curriculum and question bank collections.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 self-end md:self-auto">
          {lastScanTime && (
            <div className="text-right hidden sm:block">
              <span className="text-[10px] font-bold text-slate-400 block">Last Scanned</span>
              <span className="text-xs font-mono font-bold text-slate-700 dark:text-slate-300">{lastScanTime} ({scanDurationMs}ms)</span>
            </div>
          )}

          <button
            onClick={fetchCollectionCounts}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-sm transition-all flex items-center gap-2 disabled:opacity-50 cursor-pointer active:scale-95"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            <span>{loading ? "Counting..." : "Run Diagnostic Scan"}</span>
          </button>
        </div>
      </div>

      {scanError && (
        <div className="p-4 bg-rose-50 dark:bg-rose-950/20 rounded-2xl border border-rose-200 dark:border-rose-800 flex items-center gap-3 text-xs text-rose-700 dark:text-rose-300 font-medium">
          <AlertCircle className="w-5 h-5 text-rose-500 shrink-0" />
          <span>{scanError}</span>
        </div>
      )}

      {/* Grid Display */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {reports.map((item) => {
          let icon = Database;
          if (item.collectionName === "subjects") icon = Layers;
          if (item.collectionName === "chapters") icon = FolderTree;
          if (item.collectionName === "topics") icon = FileText;
          if (item.collectionName === "mcqs") icon = Server;
          if (item.collectionName === "questions") icon = CheckCircle2;

          const IconComponent = icon;

          return (
            <div
              key={item.collectionName}
              className="p-5 bg-white dark:bg-[#111A2E] rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-3 relative overflow-hidden group hover:border-blue-500/50 transition-all"
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-black uppercase tracking-wider text-slate-400 font-mono">
                  {item.collectionName}
                </span>
                <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center">
                  <IconComponent className="w-4 h-4" />
                </div>
              </div>

              <div>
                <div className="text-2xl font-black text-slate-900 dark:text-white font-mono">
                  {loading ? (
                    <span className="text-slate-300 dark:text-slate-600 animate-pulse">...</span>
                  ) : item.status === "error" ? (
                    <span className="text-rose-500 text-sm">Error</span>
                  ) : (
                    item.count?.toLocaleString() || "0"
                  )}
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium mt-1">
                  {item.description}
                </p>
              </div>

              <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[10px]">
                <span className="font-bold text-slate-400">Status</span>
                {item.status === "success" ? (
                  <span className="font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Online
                  </span>
                ) : (
                  <span className="font-bold text-rose-500 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" /> Offline
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Simple Table Listing Counts */}
      <div className="bg-white dark:bg-[#111A2E] rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
        <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
              <Database className="w-4 h-4 text-blue-500" />
              <span>Collection Count Breakdown Table</span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
              Exact server document count obtained via getCountFromServer API
            </p>
          </div>

          <span className="text-xs font-mono font-bold text-slate-500 bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-full">
            Total Combined MCQ Docs: {totalPhysicalDocs.toLocaleString()}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-400 dark:text-slate-500 uppercase font-mono text-[10px] tracking-wider border-b border-slate-100 dark:border-slate-800">
              <tr>
                <th className="px-6 py-3.5 font-black">Collection Name</th>
                <th className="px-6 py-3.5 font-black">Description</th>
                <th className="px-6 py-3.5 font-black text-right">Document Count</th>
                <th className="px-6 py-3.5 font-black text-center">Server Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 font-medium text-slate-700 dark:text-slate-300">
              {reports.map((row) => (
                <tr key={row.collectionName} className="hover:bg-slate-50/80 dark:hover:bg-slate-900/30 transition-colors">
                  <td className="px-6 py-4 font-mono font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                    <span>{row.collectionName}</span>
                  </td>
                  <td className="px-6 py-4 text-slate-500 dark:text-slate-400">
                    {row.description}
                  </td>
                  <td className="px-6 py-4 font-mono font-black text-slate-900 dark:text-white text-right text-sm">
                    {loading ? (
                      <span className="text-slate-300 animate-pulse">...</span>
                    ) : row.status === "error" ? (
                      <span className="text-rose-500">Error</span>
                    ) : (
                      row.count?.toLocaleString() || "0"
                    )}
                  </td>
                  <td className="px-6 py-4 text-center">
                    {row.status === "success" ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold uppercase">
                        <CheckCircle2 className="w-3 h-3" /> Valid
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-500/10 text-rose-600 text-[10px] font-bold uppercase">
                        <AlertCircle className="w-3 h-3" /> Error
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default DiagnosticReport;
