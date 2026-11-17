import * as React from "react";
import { Database, BookOpen, Layers, Target, HelpCircle, FileText, Loader2, RefreshCw, CheckCircle2, AlertTriangle } from "lucide-react";
import { supabase, isSupabaseConfigured } from "../../lib/supabase";
import { openLocalDatabase, idbGetAll, STORES } from "../../utils/localDatabaseEngine";
import { getReconciledCurriculumCounts } from "../../utils/questionsStorage";
import { loadLocalPYQPapers } from "../../utils/pyqStorage";

export interface DatabaseInventoryCounts {
  subjects: number | null;
  chapters: number | null;
  topics: number | null;
  mcqs: number | null;
  pyqs: number | null;
}

interface DatabaseStatusWidgetProps {
  refreshTrigger?: number;
  onCountsLoaded?: (counts: DatabaseInventoryCounts) => void;
}

export const DatabaseStatusWidget: React.FC<DatabaseStatusWidgetProps> = ({
  refreshTrigger = 0,
  onCountsLoaded,
}) => {
  const [counts, setCounts] = React.useState<DatabaseInventoryCounts>({
    subjects: null,
    chapters: null,
    topics: null,
    mcqs: null,
    pyqs: null,
  });
  const [loading, setLoading] = React.useState(true);
  const [source, setSource] = React.useState<"live" | "cached" | "error">("live");

  const fetchCounts = React.useCallback(async () => {
    setLoading(true);
    let resolvedCounts: DatabaseInventoryCounts | null = null;
    let resolvedSource: "live" | "cached" | "error" = "live";

    try {
      if (isSupabaseConfigured()) {
        const [subRes, chapRes, topRes, qRes, pyqRes] = await Promise.allSettled([
          supabase.from("subjects").select("*", { count: "exact", head: true }),
          supabase.from("chapters").select("*", { count: "exact", head: true }),
          supabase.from("topics").select("*", { count: "exact", head: true }),
          supabase.from("questions").select("*", { count: "exact", head: true }),
          supabase.from("questions").select("*", { count: "exact", head: true }).not("year", "is", null),
        ]);

        const getCount = (res: PromiseSettledResult<any>) => {
          if (res.status === "fulfilled" && !res.value.error && typeof res.value.count === "number") {
            return res.value.count;
          }
          return null;
        };

        const sCount = getCount(subRes);
        const cCount = getCount(chapRes);
        const tCount = getCount(topRes);
        const qCount = getCount(qRes);
        let pCount = getCount(pyqRes);

        // Also check if any dedicated local PYQ papers have additional archived questions
        try {
          const localPapers = loadLocalPYQPapers();
          const localPaperQuestions = localPapers.reduce((sum, p) => sum + (p.questions?.length || 0), 0);
          if (localPaperQuestions > (pCount || 0)) {
            pCount = localPaperQuestions;
          }
        } catch {}

        if (sCount !== null || cCount !== null || tCount !== null || qCount !== null) {
          resolvedCounts = {
            subjects: sCount ?? 0,
            chapters: cCount ?? 0,
            topics: tCount ?? 0,
            mcqs: qCount ?? 0,
            pyqs: pCount ?? 0,
          };
          resolvedSource = "live";
        }
      }

      // Fallback to local storage & IndexedDB if cloud was unconfigured or failed
      if (!resolvedCounts) {
        resolvedSource = "cached";
        const reconciled = getReconciledCurriculumCounts();
        let pyqCount = 0;
        try {
          const localPapers = loadLocalPYQPapers();
          pyqCount = localPapers.reduce((sum, p) => sum + (p.questions?.length || 0), 0);
        } catch {}

        try {
          await openLocalDatabase();
          const [localSubs, localChaps, localTops, localQ] = await Promise.all([
            idbGetAll(STORES.SUBJECTS),
            idbGetAll(STORES.CHAPTERS),
            idbGetAll(STORES.TOPICS),
            idbGetAll(STORES.MCQS),
          ]);

          resolvedCounts = {
            subjects: localSubs.length || reconciled.totalSubjects,
            chapters: localChaps.length || reconciled.totalChapters,
            topics: localTops.length || reconciled.totalTopics,
            mcqs: localQ.length || reconciled.totalQuestions,
            pyqs: pyqCount,
          };
        } catch {
          resolvedCounts = {
            subjects: reconciled.totalSubjects,
            chapters: reconciled.totalChapters,
            topics: reconciled.totalTopics,
            mcqs: reconciled.totalQuestions,
            pyqs: pyqCount,
          };
        }
      }
    } catch (error) {
      console.warn("Notice while fetching Supabase database counts:", error);
      resolvedSource = "error";
      const reconciled = getReconciledCurriculumCounts();
      resolvedCounts = {
        subjects: reconciled.totalSubjects,
        chapters: reconciled.totalChapters,
        topics: reconciled.totalTopics,
        mcqs: reconciled.totalQuestions,
        pyqs: 0,
      };
    } finally {
      if (resolvedCounts) {
        setCounts(resolvedCounts);
        setSource(resolvedSource);
        onCountsLoaded?.(resolvedCounts);
      }
      setLoading(false);
    }
  }, [onCountsLoaded]);

  React.useEffect(() => {
    fetchCounts();
  }, [fetchCounts, refreshTrigger]);

  const stats = [
    { label: "Subjects", value: counts.subjects, icon: BookOpen, color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-50 dark:bg-blue-950/50" },
    { label: "Chapters", value: counts.chapters, icon: Layers, color: "text-indigo-600 dark:text-indigo-400", bg: "bg-indigo-50 dark:bg-indigo-950/50" },
    { label: "Topics", value: counts.topics, icon: Target, color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-950/50" },
    { label: "MCQs", value: counts.mcqs, icon: HelpCircle, color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-50 dark:bg-amber-950/50" },
    { label: "PYQs", value: counts.pyqs, icon: FileText, color: "text-purple-600 dark:text-purple-400", bg: "bg-purple-50 dark:bg-purple-950/50", colSpan: "col-span-2 sm:col-span-1" },
  ];

  return (
    <div className="bg-white dark:bg-[#111A2E] border border-slate-200/80 dark:border-slate-800 rounded-3xl p-4 sm:p-6 shadow-xs space-y-4">
      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <Database className="w-4 h-4 text-emerald-500" />
          <h3 className="text-xs font-black uppercase tracking-wider text-slate-400">Database Inventory Counts</h3>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchCounts()}
            disabled={loading}
            aria-label="Refresh database inventory counts"
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            title="Refresh database counts"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-emerald-500" : ""}`} />
          </button>
          <span
            className={`text-[10px] font-bold px-2 py-0.5 rounded-full inline-flex items-center gap-1 ${
              source === "live"
                ? "text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50"
                : source === "cached"
                ? "text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/50"
                : "text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/50"
            }`}
          >
            {source === "live" ? (
              <>
                <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                <span>PostgreSQL Live</span>
              </>
            ) : source === "cached" ? (
              <>
                <Database className="w-3 h-3 text-amber-500" />
                <span>Local Cache Active</span>
              </>
            ) : (
              <>
                <AlertTriangle className="w-3 h-3 text-rose-500" />
                <span>Connection Notice</span>
              </>
            )}
          </span>
        </div>
      </div>
      
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div
              key={stat.label}
              className={`p-3.5 sm:p-4 rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 group hover:bg-slate-100/60 dark:hover:bg-slate-800/60 transition-colors ${
                stat.colSpan || ""
              }`}
            >
              <div className={`w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center mb-2 ${stat.bg}`}>
                <Icon className={`w-4 h-4 sm:w-4.5 sm:h-4.5 ${stat.color}`} />
              </div>
              <div>
                <p className="text-base sm:text-lg font-black text-slate-900 dark:text-white tabular-nums">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin text-slate-400" /> : stat.value?.toLocaleString() ?? "0"}
                </p>
                <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider mt-0.5">{stat.label}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
