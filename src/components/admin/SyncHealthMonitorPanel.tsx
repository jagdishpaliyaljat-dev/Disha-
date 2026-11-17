import * as React from "react";
import { 
  Activity, RefreshCw, CheckCircle2, AlertCircle, Database, ShieldCheck, 
  Trash2, Download, Search, Zap, Layers, FileText, Cpu, Check, AlertTriangle
} from "lucide-react";
import { AdminCard } from "./AdminCard";
import { UserQuestionsStore, UserProfile } from "../../types";
import { getTotalDisplayCount, getCombinedChapters, getCombinedQuestions } from "../../utils/questionsStorage";
import { loadLocalPYQPapers, saveLocalPYQPapers } from "../../utils/pyqStorage";
import { loadLocalLiveTests, saveLocalLiveTests } from "../../utils/liveTestStorage";

interface SyncHealthMonitorPanelProps {
  questionsStore: UserQuestionsStore;
  onStoreUpdated?: (updatedStore: UserQuestionsStore) => void;
  userProfile: UserProfile | null;
}

export const SyncHealthMonitorPanel: React.FC<SyncHealthMonitorPanelProps> = ({
  questionsStore,
  onStoreUpdated,
  userProfile
}) => {
  const [isScanning, setIsScanning] = React.useState(false);
  const [scanResult, setScanResult] = React.useState<{
    totalLocalQuestions: number;
    pyqPapersCount: number;
    pyqOrphans: number;
    liveTestsCount: number;
    liveTestOrphans: number;
    duplicateCount: number;
    lastChecked: string;
  } | null>(null);

  const [notification, setNotification] = React.useState<string | null>(null);

  const runHealthScan = () => {
    setIsScanning(true);
    setTimeout(() => {
      const allChapters = getCombinedChapters(questionsStore);
      const allQuestions = getCombinedQuestions(allChapters);
      const validQuestionIds = new Set(allQuestions.map(q => q.id));

      let pyqPapers = [];
      let pyqOrphanCount = 0;
      try {
        pyqPapers = loadLocalPYQPapers();
        pyqPapers.forEach(paper => {
          if (paper.questions) {
            paper.questions.forEach(q => {
              if (q.id && !validQuestionIds.has(q.id)) {
                pyqOrphanCount++;
              }
            });
          }
        });
      } catch {}

      let liveTests = [];
      let liveOrphanCount = 0;
      try {
        liveTests = loadLocalLiveTests();
        liveTests.forEach(test => {
          if (test.questions) {
            test.questions.forEach(q => {
              if (q.id && !validQuestionIds.has(q.id)) {
                liveOrphanCount++;
              }
            });
          }
        });
      } catch {}

      // Count duplicate texts in questions
      const textMap = new Map<string, number>();
      let dupes = 0;
      allQuestions.forEach(q => {
        const key = (q.text || "").trim().toLowerCase();
        if (key) {
          const count = textMap.get(key) || 0;
          if (count > 0) dupes++;
          textMap.set(key, count + 1);
        }
      });

      setScanResult({
        totalLocalQuestions: allQuestions.length,
        pyqPapersCount: pyqPapers.length,
        pyqOrphans: pyqOrphanCount,
        liveTestsCount: liveTests.length,
        liveTestOrphans: liveOrphanCount,
        duplicateCount: dupes,
        lastChecked: new Date().toLocaleTimeString()
      });
      setIsScanning(false);
      setNotification("Sync Health scan completed successfully.");
      setTimeout(() => setNotification(null), 4000);
    }, 600);
  };

  React.useEffect(() => {
    runHealthScan();
  }, [questionsStore]);

  const handlePurgeOrphans = () => {
    try {
      const allChapters = getCombinedChapters(questionsStore);
      const allQuestions = getCombinedQuestions(allChapters);
      const validIds = new Set(allQuestions.map(q => q.id));

      let pyqPapers = loadLocalPYQPapers();
      let cleanedPyq = false;
      pyqPapers = pyqPapers.map(paper => {
        if (!paper.questions) return paper;
        const filtered = paper.questions.filter(q => !q.id || validIds.has(q.id));
        if (filtered.length !== paper.questions.length) cleanedPyq = true;
        return { ...paper, questions: filtered };
      });
      if (cleanedPyq) saveLocalPYQPapers(pyqPapers);

      let liveTests = loadLocalLiveTests();
      let cleanedLive = false;
      liveTests = liveTests.map(test => {
        if (!test.questions) return test;
        const filtered = test.questions.filter(q => !q.id || validIds.has(q.id));
        if (filtered.length !== test.questions.length) cleanedLive = true;
        return { ...test, questions: filtered };
      });
      if (cleanedLive) saveLocalLiveTests(liveTests);

      runHealthScan();
      setNotification("Orphaned question references purged successfully.");
      setTimeout(() => setNotification(null), 4000);
    } catch (err: any) {
      setNotification(`Failed to purge orphans: ${err.message}`);
      setTimeout(() => setNotification(null), 4000);
    }
  };

  const handleExportReport = () => {
    const report = {
      timestamp: new Date().toISOString(),
      user: userProfile?.email || "guest",
      scanResult,
      storeStats: {
        customSubjects: questionsStore.customSubjects?.length || 0,
        customChapters: questionsStore.customChapters?.length || 0,
        customTopics: questionsStore.customTopics?.length || 0,
        customQuestionsCount: Object.keys(questionsStore.customQuestions || {}).length,
        deletedCount: questionsStore.deletedQuestionIds?.length || 0
      }
    };
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `disha2020_sync_health_report_${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const isHealthy = scanResult && scanResult.pyqOrphans === 0 && scanResult.liveTestOrphans === 0 && scanResult.duplicateCount === 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 sm:p-8 bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 rounded-[32px] text-white shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="space-y-2 relative z-10">
          <div className="flex items-center gap-2">
            <span className="p-2 bg-blue-500/20 text-blue-400 rounded-xl">
              <Activity className="w-6 h-6" />
            </span>
            <h1 className="text-2xl font-black tracking-tight">Sync & Data Health Monitor</h1>
          </div>
          <p className="text-xs text-slate-300 max-w-xl font-medium">
            Real-time consistency inspector for LocalStorage, IndexedDB, and Supabase Cloud PostgreSQL. Detects orphaned question references, cache desyncs, and duplicate entries.
          </p>
        </div>
        <div className="flex items-center gap-3 relative z-10">
          <button
            onClick={runHealthScan}
            disabled={isScanning}
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black shadow-lg transition-all disabled:opacity-50 active:scale-95 cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${isScanning ? "animate-spin" : ""}`} />
            <span>{isScanning ? "Scanning..." : "Re-Scan Health"}</span>
          </button>
          <button
            onClick={handleExportReport}
            className="flex items-center gap-2 px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white border border-white/10 rounded-xl text-xs font-black transition-all active:scale-95 cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>Export Report</span>
          </button>
        </div>
      </div>

      {notification && (
        <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 text-emerald-800 dark:text-emerald-300 rounded-2xl text-xs font-bold flex items-center gap-3 animate-fade-in">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{notification}</span>
        </div>
      )}

      {/* Overall Status Banner */}
      <div className={`p-6 rounded-3xl border flex flex-col md:flex-row items-start md:items-center justify-between gap-4 ${
        isHealthy 
          ? "bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/50" 
          : "bg-amber-50/50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/50"
      }`}>
        <div className="flex items-center gap-4">
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${
            isHealthy ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/30" : "bg-amber-500 text-white shadow-lg shadow-amber-500/30"
          }`}>
            {isHealthy ? <CheckCircle2 className="w-6 h-6" /> : <AlertTriangle className="w-6 h-6" />}
          </div>
          <div>
            <h2 className="text-base font-black text-slate-900 dark:text-white">
              {isHealthy ? "System Fully Synchronized & Healthy" : "Sync Discrepancies Detected"}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {isHealthy 
                ? "No orphaned question IDs or critical cache mismatches found." 
                : "Some PYQ or live test papers reference deleted question IDs. Use purge tool below."}
            </p>
          </div>
        </div>
        {scanResult && (
          <div className="text-right">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Last Checked</span>
            <p className="text-xs font-black text-slate-700 dark:text-slate-300">{scanResult.lastChecked}</p>
          </div>
        )}
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-6 bg-white dark:bg-[#111A2E] rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-black uppercase tracking-wider">Local Questions</span>
            <Database className="w-4 h-4 text-blue-500" />
          </div>
          <p className="text-2xl font-black text-slate-900 dark:text-white">
            {scanResult ? scanResult.totalLocalQuestions : "..."}
          </p>
          <p className="text-[10px] font-medium text-slate-500">Active in curriculum database</p>
        </div>

        <div className="p-6 bg-white dark:bg-[#111A2E] rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-black uppercase tracking-wider">PYQ Orphans</span>
            <Layers className="w-4 h-4 text-purple-500" />
          </div>
          <p className={`text-2xl font-black ${scanResult && scanResult.pyqOrphans > 0 ? "text-amber-600" : "text-emerald-600"}`}>
            {scanResult ? scanResult.pyqOrphans : "..."}
          </p>
          <p className="text-[10px] font-medium text-slate-500">PYQ questions missing base record</p>
        </div>

        <div className="p-6 bg-white dark:bg-[#111A2E] rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-black uppercase tracking-wider">Live Test Orphans</span>
            <Zap className="w-4 h-4 text-rose-500" />
          </div>
          <p className={`text-2xl font-black ${scanResult && scanResult.liveTestOrphans > 0 ? "text-amber-600" : "text-emerald-600"}`}>
            {scanResult ? scanResult.liveTestOrphans : "..."}
          </p>
          <p className="text-[10px] font-medium text-slate-500">Live mock test missing base record</p>
        </div>

        <div className="p-6 bg-white dark:bg-[#111A2E] rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-black uppercase tracking-wider">Potential Duplicates</span>
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
          </div>
          <p className={`text-2xl font-black ${scanResult && scanResult.duplicateCount > 0 ? "text-amber-600" : "text-emerald-600"}`}>
            {scanResult ? scanResult.duplicateCount : "..."}
          </p>
          <p className="text-[10px] font-medium text-slate-500">Identical question text matches</p>
        </div>
      </div>

      {/* Action Toolbox */}
      <div className="p-6 sm:p-8 bg-white dark:bg-[#111A2E] rounded-[32px] border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-6">
        <div>
          <h2 className="text-base font-black text-slate-900 dark:text-white">Sync Repair & Cache Maintenance</h2>
          <p className="text-xs text-slate-500 mt-1">
            Execute targeted repairs to resolve desyncs between client cache and server database.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800 flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-black text-slate-900 dark:text-white">Purge Orphaned References</p>
              <p className="text-xs text-slate-500 mt-0.5">Remove references to deleted question IDs from PYQ papers and Live Tests.</p>
            </div>
            <button
              onClick={handlePurgeOrphans}
              disabled={!scanResult || (scanResult.pyqOrphans === 0 && scanResult.liveTestOrphans === 0)}
              className="px-4 py-2.5 bg-amber-600 hover:bg-amber-700 disabled:opacity-40 text-white rounded-xl text-xs font-black shrink-0 transition-all active:scale-95 cursor-pointer shadow-sm"
            >
              Purge Orphans
            </button>
          </div>

          <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800 flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-black text-slate-900 dark:text-white">Clear Local Client Cache</p>
              <p className="text-xs text-slate-500 mt-0.5">Force reload questions store from Supabase by wiping stale localStorage cache.</p>
            </div>
            <button
              onClick={() => {
                if (window.confirm("Are you sure you want to clear local cache and re-sync from Supabase?")) {
                  localStorage.removeItem("economic_survey_user_questions_v2");
                  window.location.reload();
                }
              }}
              className="px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black shrink-0 transition-all active:scale-95 cursor-pointer shadow-sm"
            >
              Clear Cache
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
