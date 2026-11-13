import * as React from "react";
import { 
  Activity, 
  RefreshCw, 
  Wifi, 
  AlertTriangle, 
  X, 
  Trash2, 
  Download, 
  ExternalLink, 
  Calculator,
  CheckCircle2,
  AlertCircle,
  Clock,
  Zap,
  Loader2,
  Database,
  Terminal,
  ShieldAlert,
  Package,
  HardDrive,
  GitBranch,
  Radio
} from "lucide-react";
import type { Question } from "../../types";
import {
  subscribeQuota,
  getQuotaSummary,
  QuotaDailySummary,
  getTimeUntilPacificMidnight,
  resetQuotaSummary,
  exportUsageLogCSV,
} from "../../utils/quotaTracker";
import { useFirebaseSync } from "../../hooks/useFirebaseSync";
import { isUserAdmin, loadUserProfile } from "../../utils/userProfileStorage";
import { runFirebaseHealthCheck } from "../../utils/firebaseSyncService";
import { firebaseConfig, isFirebaseConfigured } from "../../lib/firebase";
import { WriteConsumptionDashboard } from "./WriteConsumptionDashboard";
import { ReadHealthDashboard } from "./ReadHealthDashboard";
import { FirebaseStorageOverview } from "./FirebaseStorageOverview";

const STORAGE_KEY_CALIBRATION = "quizpro_calibration_result_v1";

interface CalibrationResult {
  consoleReads: number;
  consoleWrites: number;
  consoleDeletes: number;
  appReads: number;
  appWrites: number;
  appDeletes: number;
  timestamp: string;
  factorReads: number;
  factorWrites: number;
  factorDeletes: number;
  useFactor: boolean;
}

const CalibrationSection: React.FC<{
  summary: QuotaDailySummary;
  result: CalibrationResult | null;
  setResult: (r: CalibrationResult | null) => void;
}> = ({ summary, result, setResult }) => {
  const [consoleReads, setConsoleReads] = React.useState("");
  const [consoleWrites, setConsoleWrites] = React.useState("");
  const [consoleDeletes, setConsoleDeletes] = React.useState("");
  const [validationError, setValidationError] = React.useState("");

  const handleCompare = () => {
    const r = Number(consoleReads);
    const w = Number(consoleWrites);
    const d = Number(consoleDeletes);
    if (isNaN(r) || isNaN(w) || isNaN(d) || r < 0 || w < 0 || d < 0) {
      setValidationError("Please enter valid positive numbers.");
      return;
    }
    setValidationError("");
    const newResult: CalibrationResult = {
      consoleReads: r,
      consoleWrites: w,
      consoleDeletes: d,
      appReads: summary.reads,
      appWrites: summary.writes,
      appDeletes: summary.deletes,
      timestamp: new Date().toLocaleString(),
      factorReads: summary.reads > 0 ? r / summary.reads : 1,
      factorWrites: summary.writes > 0 ? w / summary.writes : 1,
      factorDeletes: summary.deletes > 0 ? d / summary.deletes : 1,
      useFactor: true,
    };
    setResult(newResult);
    localStorage.setItem(STORAGE_KEY_CALIBRATION, JSON.stringify(newResult));
  };

  const handleClear = () => {
    setResult(null);
    setConsoleReads("");
    setConsoleWrites("");
    setConsoleDeletes("");
    localStorage.removeItem(STORAGE_KEY_CALIBRATION);
  };

  return (
    <div className="bg-slate-50 p-5 rounded-xl border border-slate-100 space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200/60 pb-4">
        <div className="flex items-center gap-2.5">
          <Terminal className="w-4 h-4 text-indigo-600" />
          <h4 className="font-bold text-[11px] uppercase tracking-wider text-slate-500">Node Calibration</h4>
        </div>
        <button
          onClick={() => window.open(`https://console.firebase.google.com/project/${firebaseConfig.projectId}/firestore/usage`, "_blank")}
          className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-indigo-600 hover:text-indigo-700 transition-colors"
        >
          <span>Cloud Console</span>
          <ExternalLink className="w-3.5 h-3.5" />
        </button>
      </div>

      {!result ? (
        <div className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { label: "Cloud Reads", state: consoleReads, set: setConsoleReads },
              { label: "Cloud Writes", state: consoleWrites, set: setConsoleWrites },
              { label: "Cloud Deletes", state: consoleDeletes, set: setConsoleDeletes }
            ].map((f) => (
              <div key={f.label} className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-0.5">{f.label}</label>
                <input
                  type="number"
                  placeholder="0"
                  value={f.state}
                  onChange={(e) => f.set(e.target.value)}
                  className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-lg text-sm font-mono font-bold focus:ring-2 focus:ring-indigo-500/10 transition-all"
                />
              </div>
            ))}
          </div>
          {validationError && <p className="text-[10px] font-bold text-rose-600 uppercase tracking-tight">{validationError}</p>}
          <button onClick={handleCompare} className="w-full py-3 bg-slate-900 text-white rounded-lg font-bold text-[11px] uppercase tracking-widest shadow-sm active:scale-[0.98] transition-all">Synchronize Bias</button>
        </div>
      ) : (
        <div className="space-y-5">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[11px]">
              <thead>
                <tr className="text-slate-400 uppercase font-bold tracking-widest border-b border-slate-100">
                  <th className="pb-2 px-1">Operation</th>
                  <th className="pb-2 px-1">Local Node</th>
                  <th className="pb-2 px-1">Cloud State</th>
                  <th className="pb-2 px-1 text-right">Multiplier</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100/50">
                {[
                  { label: "Reads", local: result.appReads, cloud: result.consoleReads, factor: result.factorReads },
                  { label: "Writes", local: result.appWrites, cloud: result.consoleWrites, factor: result.factorWrites },
                  { label: "Deletes", local: result.appDeletes, cloud: result.consoleDeletes, factor: result.factorDeletes }
                ].map(row => (
                  <tr key={row.label} className="text-slate-900 font-mono">
                    <td className="py-3 font-bold uppercase text-slate-500">{row.label}</td>
                    <td className="py-3 tabular-nums">{row.local.toLocaleString()}</td>
                    <td className="py-3 tabular-nums">{row.cloud.toLocaleString()}</td>
                    <td className="py-3 text-right font-bold text-indigo-600 tabular-nums">{row.factor.toFixed(2)}x</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex justify-between items-center pt-3 border-t border-slate-200/40">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">Last Sync: {result.timestamp}</div>
            <button onClick={handleClear} className="text-[10px] font-bold text-rose-600 uppercase tracking-widest hover:text-rose-700">Reset Calibration</button>
          </div>
        </div>
      )}
    </div>
  );
};

export const FirebaseQuotaHealthPanel: React.FC<{ onBulkSync: () => void }> = ({ onBulkSync }) => {
  const isAdmin = isUserAdmin(loadUserProfile());
  const [summary, setSummary] = React.useState<QuotaDailySummary>(getQuotaSummary());
  const [resetTimeText, setResetTimeText] = React.useState<string>(() => getTimeUntilPacificMidnight().text);
  const [showFailedModal, setShowFailedModal] = React.useState(false);
  const [showResetConfirm, setShowResetConfirm] = React.useState(false);
  const { isOnline, isSyncing, lastSyncedAt, loadUserData } = useFirebaseSync(true, null);
  const [isTesting, setIsTesting] = React.useState(false);
  const [testResult, setTestResult] = React.useState<{ success: boolean; latencyMs: number; error?: string } | null>(null);
  const [result, setResult] = React.useState<CalibrationResult | null>(() => {
    const raw = localStorage.getItem(STORAGE_KEY_CALIBRATION);
    return raw ? JSON.parse(raw) : null;
  });

  React.useEffect(() => {
    const unsub = subscribeQuota(u => setSummary({...u}));
    const interval = setInterval(() => setResetTimeText(getTimeUntilPacificMidnight().text), 30000);
    return () => { unsub(); clearInterval(interval); };
  }, []);

  if (!isAdmin) return null;

  const handleReset = () => {
    resetQuotaSummary();
    setSummary(getQuotaSummary());
    setShowResetConfirm(false);
  };

  const handleTestConnection = async () => {
    if (isTesting) return;
    setIsTesting(true);
    try {
      const res = await runFirebaseHealthCheck();
      setTestResult(res);
    } catch (e: any) {
      setTestResult({ success: false, latencyMs: 0, error: e.message || "Network Error" });
    } finally {
      setIsTesting(false);
    }
  };

  const READ_LIMIT = 50000;
  const WRITE_LIMIT = 20000;
  const DELETE_LIMIT = 20000;
  const failedCount = (summary.logs || []).filter(l => l.failed).length;
  const [telemetryTab, setTelemetryTab] = React.useState<"reads" | "writes" | "both">("both");

  const [packing, setPacking] = React.useState(false);
  const [packStatus, setPackStatus] = React.useState<string | null>(null);
  const [preCaching, setPreCaching] = React.useState(false);
  const [bumpingVersion, setBumpingVersion] = React.useState(false);
  const [versionInfo, setVersionInfo] = React.useState<{
    remoteVersion: number;
    localVersion: number;
    lastUpdated: string | null;
  } | null>(null);
  const [idbStats, setIdbStats] = React.useState<{
    supported: boolean;
    bundleCount: number;
    totalQuestions: number;
    estimatedSizeKb: number;
    hasCurriculum: boolean;
    lastCachedAt: string | null;
  } | null>(null);

  const refreshIdbStats = async () => {
    try {
      const { getIndexedDbUsageStats } = await import("../../utils/indexedDbCache");
      const stats = await getIndexedDbUsageStats();
      setIdbStats(stats);
    } catch {}
  };

  const refreshVersionInfo = async () => {
    try {
      const { checkCurriculumVersionMatch } = await import("../../utils/appVersionService");
      const check = await checkCurriculumVersionMatch();
      setVersionInfo({
        remoteVersion: check.remoteVersion,
        localVersion: check.localVersion,
        lastUpdated: check.remoteMetadata?.lastUpdated || null
      });
    } catch {}
  };

  React.useEffect(() => {
    refreshIdbStats();
    refreshVersionInfo();
  }, []);

  const handleBumpVersion = async () => {
    setBumpingVersion(true);
    try {
      const { bumpRemoteCurriculumVersion } = await import("../../utils/appVersionService");
      const newVer = await bumpRemoteCurriculumVersion();
      await refreshVersionInfo();
      setPackStatus(`Versioning Check Active: Curriculum bumped to v${newVer}! All user apps will sync with exactly 1 Read.`);
    } catch (e: any) {
      setPackStatus(`Failed to bump version: ${e?.message || e}`);
    } finally {
      setBumpingVersion(false);
    }
  };

  const handlePackBundles = async () => {
    setPacking(true);
    setPackStatus(null);
    try {
      const { loadUserQuestionsStore, getCombinedChapters } = await import("../../utils/questionsStorage");
      const { packAllQuestionsIntoTopicBundles } = await import("../../utils/questionBundleService");
      const { bumpRemoteCurriculumVersion } = await import("../../utils/appVersionService");
      const store = loadUserQuestionsStore();
      const chapters = getCombinedChapters(store);
      const allQuestions = chapters.flatMap(c => (c.topics || []).flatMap(t => t.questions || []));
      
      // Deduplicate by ID
      const uniqueMap = new Map<string, any>();
      allQuestions.forEach(q => {
        if (q && q.id && q.topicId) {
          uniqueMap.set(q.id, q);
        }
      });
      let combined = Array.from(uniqueMap.values());

      // If local store is empty, fetch MCQs directly from Firestore
      if (combined.length === 0 && isFirebaseConfigured()) {
        const { guardedGetDocs } = await import("../../utils/quotaTracker");
        const { collection } = await import("firebase/firestore");
        const { db } = await import("../../lib/firebase");
        const snap = await guardedGetDocs(collection(db, "mcqs"), "Admin", "Fetch MCQs for Packing").catch(() => null);
        if (snap && !snap.empty) {
          snap.docs.forEach(docSnap => {
            const q = { ...docSnap.data(), id: docSnap.id } as Question;
            if (q && q.id && q.topicId) {
              uniqueMap.set(q.id, q);
            }
          });
          combined = Array.from(uniqueMap.values());
        }
      }
      
      if (combined.length === 0) {
        setPackStatus("No questions found to pack. Create or import questions first!");
        return;
      }

      const res = await packAllQuestionsIntoTopicBundles(combined);
      let statusMsg = "";
      if (res.bundleCount > 0) {
        const newVer = await bumpRemoteCurriculumVersion(res.packedTopicIds, undefined, {
          contentDigest: res.contentDigest,
          reason: "bundle_pack",
        }).catch(() => 1);
        statusMsg = `Bucket Pattern + Versioning Active: Packed ${res.totalQuestionsPacked} questions across ${res.bundleCount} changed topic bundle(s) (${res.skippedCount} unchanged skipped). Published as v${newVer}.`;
      } else {
        statusMsg = `All ${res.skippedCount} topic bundle(s) are already up-to-date — 0 Firestore writes needed!`;
      }
      await refreshIdbStats();
      await refreshVersionInfo();
      setPackStatus(statusMsg);
    } catch (e: any) {
      setPackStatus(`Failed to pack bundles: ${e?.message || e}`);
    } finally {
      setPacking(false);
    }
  };

  const handlePreCacheAll = async () => {
    setPreCaching(true);
    setPackStatus(null);
    try {
      const { loadUserQuestionsStore, getCombinedChapters } = await import("../../utils/questionsStorage");
      const { saveCachedQuestionBundle } = await import("../../utils/indexedDbCache");
      const store = loadUserQuestionsStore();
      const chapters = getCombinedChapters(store);
      let cachedTopics = 0;
      let cachedQuestions = 0;
      for (const ch of chapters) {
        for (const top of ch.topics || []) {
          if (top.questions && top.questions.length > 0) {
            await saveCachedQuestionBundle(top.id, top.questions);
            cachedTopics++;
            cachedQuestions += top.questions.length;
          }
        }
      }
      await refreshIdbStats();
      setPackStatus(`Persistent Local Caching Success: ${cachedQuestions} questions across ${cachedTopics} topics stored directly in IndexedDB. 100% 0-Read offline study ready!`);
    } catch (e: any) {
      setPackStatus(`Pre-cache failed: ${e?.message || e}`);
    } finally {
      setPreCaching(false);
    }
  };

  const handleClearIdb = async () => {
    try {
      const { clearAllCachedBundles } = await import("../../utils/indexedDbCache");
      await clearAllCachedBundles();
      await refreshIdbStats();
      setPackStatus("IndexedDB local persistent cache purged successfully.");
    } catch (e: any) {
      setPackStatus(`Failed to clear IndexedDB: ${e?.message || e}`);
    }
  };

  return (
    <div className="space-y-6 pb-12 animate-in fade-in slide-in-from-bottom-2 duration-500">
      {/* 1. Refined Header */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 sm:p-8 relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              <Database className="w-3.5 h-3.5" />
              <span>Infrastructure Health</span>
            </div>
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">System Monitor</h2>
            <p className="text-sm text-slate-500 font-medium max-w-lg leading-relaxed">
              Monitor real-time operations, track daily quotas, and manage data synchronization integrity.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={handleTestConnection} 
              disabled={isTesting} 
              className="h-10 w-10 flex items-center justify-center bg-white border border-slate-200 text-slate-400 hover:text-rose-600 hover:bg-slate-50 rounded-lg transition-all shadow-sm disabled:opacity-50"
            >
              <Activity className={`w-4 h-4 ${isTesting ? "animate-spin text-rose-500" : ""}`} />
            </button>
            <button 
              onClick={() => loadUserData()} 
              disabled={isSyncing || !isOnline} 
              className="h-10 px-4 bg-indigo-600 text-white rounded-lg font-bold text-xs uppercase tracking-wider transition-all active:scale-[0.98] shadow-sm shadow-indigo-100 flex items-center gap-2 disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? "animate-spin" : ""}`} />
              <span>Sync Node</span>
            </button>
          </div>
        </div>
      </div>

      {/* Firebase Storage Overview Card */}
      <FirebaseStorageOverview />

      {/* Telemetry View Selector */}
      <div className="inline-flex p-1 bg-slate-100 rounded-lg border border-slate-200">
        {[
          { id: "both", label: "All Activity" },
          { id: "reads", label: "Reads & Cache" },
          { id: "writes", label: "Writes & Quota" }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setTelemetryTab(tab.id as any)}
            className={`px-4 py-2 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all ${
              telemetryTab === tab.id
                ? "bg-white text-indigo-600 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {(telemetryTab === "both" || telemetryTab === "reads") && <ReadHealthDashboard />}
      {(telemetryTab === "both" || telemetryTab === "writes") && <WriteConsumptionDashboard />}

      {testResult && (
        <div className={`p-5 rounded-2xl border-2 flex items-center justify-between gap-4 animate-in zoom-in-95 duration-300 ${testResult.success ? "bg-emerald-500/5 border-emerald-500/20 text-emerald-900 dark:text-emerald-400" : "bg-rose-500/5 border-rose-500/20 text-rose-900 dark:text-rose-400"}`}>
          <div className="flex items-center gap-3">
            {testResult.success ? <CheckCircle2 className="w-5 h-5 text-emerald-600"/> : <AlertCircle className="w-5 h-5 text-rose-600"/>}
            <span className="text-sm font-bold uppercase tracking-tight">{testResult.success ? `Link Stable • ${testResult.latencyMs}ms` : `Link Failed • ${testResult.error}`}</span>
          </div>
          <button onClick={() => setTestResult(null)} className="p-1 hover:bg-black/5 rounded-full"><X className="w-4 h-4" /></button>
        </div>
      )}

      {packStatus && (
        <div className="p-5 rounded-2xl bg-gradient-to-r from-blue-500/10 via-indigo-500/10 to-purple-500/10 border border-blue-500/30 flex items-center justify-between gap-4 animate-in zoom-in-95">
          <div className="flex items-center gap-3">
            <Package className="w-5 h-5 text-blue-600" />
            <span className="text-xs font-bold text-slate-900 dark:text-white">{packStatus}</span>
          </div>
          <button onClick={() => setPackStatus(null)} className="text-xs font-bold text-blue-600 underline cursor-pointer">Dismiss</button>
        </div>
      )}

      {/* 2. Quota Monitoring Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { label: "Document Reads", used: summary.reads || 0, limit: READ_LIMIT, color: "bg-blue-600" },
          { label: "Document Writes", used: summary.writes || 0, limit: WRITE_LIMIT, color: "bg-emerald-600" },
          { label: "Document Deletes", used: summary.deletes || 0, limit: DELETE_LIMIT, color: "bg-indigo-600" }
        ].map(q => (
          <div key={q.label} className="bg-white rounded-xl border border-slate-200 p-6 space-y-4 shadow-sm">
            <div className="flex justify-between items-center">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{q.label}</p>
              <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                q.used/q.limit > 0.8 ? "bg-rose-50 text-rose-600 border border-rose-100" : "bg-indigo-50 text-indigo-600 border border-indigo-100"
              }`}>
                {Math.round((q.used/q.limit)*100)}% Capacity
              </span>
            </div>
            <div>
              <p className="text-3xl font-bold text-slate-900 tabular-nums leading-none">
                {q.used.toLocaleString()}
              </p>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-1">/ {q.limit/1000}k Limit</p>
            </div>
            <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div 
                className={`h-full transition-all duration-1000 ${q.color}`} 
                style={{ width: `${Math.min(100, (q.used/q.limit)*100)}%` }} 
              />
            </div>
          </div>
        ))}
      </div>

      {/* 3. Integration & Maintenance Area */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 space-y-6">
          <div className="bg-white rounded-xl border border-slate-200 p-6 sm:p-8 space-y-8 shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-50 pb-6">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center">
                  <Zap className="w-4.5 h-4.5 text-indigo-600" />
                </div>
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-widest">Registry Synchronization</h3>
              </div>
              <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-slate-50 border border-slate-100">
                <div className={`w-1.5 h-1.5 rounded-full ${isOnline ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" : "bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.5)]"}`} />
                <span className="text-[9px] font-bold uppercase text-slate-500">{isOnline ? "Node Active" : "Node Offline"}</span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                { label: "Heartbeat", value: isSyncing ? "Syncing..." : "Idle" },
                { label: "Handshake", value: lastSyncedAt ? lastSyncedAt.toLocaleTimeString() : "Pending" },
                { label: "Cycle Reset", value: `In ${resetTimeText}` }
              ].map((stat, i) => (
                <div key={i} className="p-4 rounded-lg bg-slate-50 border border-slate-100">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">{stat.label}</p>
                  <p className="text-xs font-bold text-slate-900 uppercase">{stat.value}</p>
                </div>
              ))}
            </div>

            {failedCount > 0 && (
              <div className="p-4 bg-rose-50 border border-rose-100 rounded-lg flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <ShieldAlert className="w-5 h-5 text-rose-600" />
                  <p className="text-[11px] font-bold text-rose-900 uppercase tracking-tight">{failedCount} FailURES detected</p>
                </div>
                <button onClick={() => setShowFailedModal(true)} className="h-8 px-4 bg-rose-600 text-white rounded-lg text-[10px] font-bold uppercase tracking-wider shadow-sm">Inspect</button>
              </div>
            )}

            <CalibrationSection summary={summary} result={result} setResult={setResult} />

            {/* Feature Optimization Cards */}
            <div className="grid grid-cols-1 gap-6">
              {/* IndexedDB Card */}
              <div className="bg-slate-50 p-5 rounded-xl border border-slate-100 space-y-5">
                <div className="flex items-center justify-between border-b border-slate-200/60 pb-4">
                  <div className="flex items-center gap-2.5">
                    <HardDrive className="w-4 h-4 text-emerald-600" />
                    <div>
                      <h4 className="font-bold text-[11px] uppercase tracking-wider text-slate-800">Persistent Local Caching</h4>
                      <p className="text-[9px] text-slate-500 font-bold uppercase tracking-tight">Zero-Read Offline Engine</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-emerald-50 border border-emerald-100 text-emerald-600">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-[9px] font-bold uppercase tracking-wider">Active</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { label: "Topic Bundles", value: `${idbStats?.bundleCount ?? 0} Topics` },
                    { label: "Local MCQs", value: idbStats?.totalQuestions ?? 0 },
                    { label: "IDB Storage", value: `${idbStats?.estimatedSizeKb ?? 0} KB` },
                    { label: "Status", value: idbStats?.hasCurriculum ? "Cached" : "Ready", color: "text-emerald-600" }
                  ].map((stat, i) => (
                    <div key={i} className="p-3 rounded-lg bg-white border border-slate-200/60">
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">{stat.label}</p>
                      <p className={`text-[13px] font-bold tabular-nums ${stat.color || "text-slate-900"}`}>{stat.value}</p>
                    </div>
                  ))}
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={handlePreCacheAll}
                    disabled={preCaching}
                    className="flex-1 h-10 bg-emerald-600 text-white rounded-lg font-bold text-[10px] uppercase tracking-wider shadow-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-all disabled:opacity-50"
                  >
                    {preCaching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <HardDrive className="w-3.5 h-3.5" />}
                    <span>Pre-Cache Topics</span>
                  </button>
                  <button
                    onClick={handleClearIdb}
                    className="h-10 px-4 bg-white border border-slate-200 text-slate-600 rounded-lg font-bold text-[10px] uppercase tracking-wider hover:bg-slate-50 transition-all"
                  >
                    Clear IDB
                  </button>
                </div>
              </div>

              {/* Versioning Card */}
              <div className="bg-slate-50 p-5 rounded-xl border border-slate-100 space-y-5">
                <div className="flex items-center justify-between border-b border-slate-200/60 pb-4">
                  <div className="flex items-center gap-2.5">
                    <GitBranch className="w-4 h-4 text-indigo-600" />
                    <div>
                      <h4 className="font-bold text-[11px] uppercase tracking-wider text-slate-800">Versioning Control</h4>
                      <p className="text-[9px] text-slate-500 font-bold uppercase tracking-tight">1-Read Freshness Sync</p>
                    </div>
                  </div>
                  <div className="px-2 py-1 rounded bg-indigo-50 border border-indigo-100 text-indigo-600 text-[9px] font-bold uppercase">v{versionInfo?.remoteVersion ?? 1} Remote</div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { label: "Remote", value: `v${versionInfo?.remoteVersion ?? 1}` },
                    { label: "Local", value: `v${versionInfo?.localVersion ?? 1}` },
                    { label: "Sync Cost", value: "1 Read", color: "text-emerald-600" },
                    { label: "Health", value: (versionInfo?.localVersion ?? 0) >= (versionInfo?.remoteVersion ?? 1) ? "Fresh" : "Update", color: "text-emerald-600" }
                  ].map((stat, i) => (
                    <div key={i} className="p-3 rounded-lg bg-white border border-slate-200/60">
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">{stat.label}</p>
                      <p className={`text-[13px] font-bold tabular-nums ${stat.color || "text-slate-900"}`}>{stat.value}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Guest & Sockets Cards (Simplified) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-amber-50/50 p-4 rounded-xl border border-amber-100 space-y-3">
                  <div className="flex items-center gap-2 text-amber-700">
                    <ShieldAlert className="w-4 h-4" />
                    <h4 className="font-bold text-[10px] uppercase tracking-widest">Guest Protection</h4>
                  </div>
                  <p className="text-[10px] text-amber-800/70 font-medium">Unregistered users practice locally with 0 Cloud Writes. Automatic sync triggers on login.</p>
                </div>
                <div className="bg-sky-50/50 p-4 rounded-xl border border-sky-100 space-y-3">
                  <div className="flex items-center gap-2 text-sky-700">
                    <Radio className="w-4 h-4" />
                    <h4 className="font-bold text-[10px] uppercase tracking-widest">Socket Discipline</h4>
                  </div>
                  <p className="text-[10px] text-sky-800/70 font-medium">Real-time listeners restricted to Admins. Students use 1-Read version checks to save quota.</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Sidebar: Actions */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-white rounded-xl border border-slate-200 p-6 sm:p-8 space-y-6 shadow-sm">
            <div className="flex items-center gap-3 border-b border-slate-50 pb-6">
              <div className="w-8 h-8 rounded-lg bg-purple-50 flex items-center justify-center">
                <Clock className="w-4.5 h-4.5 text-purple-600" />
              </div>
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-widest">Maintenance</h3>
            </div>
            
            <div className="space-y-3">
              <button 
                onClick={handlePackBundles} 
                disabled={packing}
                className="w-full h-12 bg-slate-900 text-white rounded-lg font-bold text-[10px] uppercase tracking-widest shadow-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-all disabled:opacity-50"
              >
                {packing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Package className="w-3.5 h-3.5" />}
                <span>Pack Bucket Bundles</span>
              </button>

              <button
                onClick={handleBumpVersion}
                disabled={bumpingVersion}
                className="w-full h-12 bg-white border border-slate-200 text-slate-900 rounded-lg font-bold text-[10px] uppercase tracking-widest shadow-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-all disabled:opacity-50"
              >
                {bumpingVersion ? <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-600" /> : <GitBranch className="w-3.5 h-3.5 text-indigo-600" />}
                <span>Broadcast New v{ (versionInfo?.remoteVersion ?? 1) + 1 }</span>
              </button>

              <button onClick={onBulkSync} className="w-full h-12 bg-white border border-slate-200 text-amber-600 rounded-lg font-bold text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-slate-50 transition-colors">
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Bulk Sync Store</span>
              </button>

              <button onClick={() => { const csv = exportUsageLogCSV(); const blob = new Blob([csv], { type: "text/csv" }); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = `usage_audit_${summary.date}.csv`; a.click(); }} className="w-full h-12 bg-white border border-slate-200 text-slate-600 rounded-lg font-bold text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-slate-50 transition-colors">
                <Download className="w-3.5 h-3.5" />
                <span>Export Audit</span>
              </button>
            </div>

            <div className="pt-6 border-t border-slate-50">
              <button onClick={() => setShowResetConfirm(true)} className="w-full h-12 bg-rose-50 text-rose-600 rounded-lg font-bold text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-rose-100 transition-colors">
                <Trash2 className="w-3.5 h-3.5" />
                <span>Purge Registry</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showResetConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white rounded-xl w-full max-w-sm p-8 space-y-6 shadow-2xl border border-slate-100 text-center">
            <div className="w-16 h-16 bg-rose-50 rounded-lg flex items-center justify-center mx-auto text-rose-600 shadow-sm">
              <Trash2 className="w-8 h-8" />
            </div>
            <div className="space-y-1.5">
              <h3 className="text-xl font-bold text-slate-900 tracking-tight">Purge Logs?</h3>
              <p className="text-sm text-slate-500 font-medium">This will permanently erase all local operation telemetry logs for {summary.date}.</p>
            </div>
            <div className="flex flex-col gap-2.5">
              <button onClick={handleReset} className="w-full h-12 bg-rose-600 text-white rounded-lg font-bold text-[10px] uppercase tracking-widest shadow-lg shadow-rose-100 transition-all active:scale-[0.98]">Confirm Purge</button>
              <button onClick={() => setShowResetConfirm(false)} className="w-full h-12 bg-white border border-slate-200 text-slate-600 rounded-lg font-bold text-[10px] uppercase tracking-widest hover:bg-slate-50 transition-all">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Failed Logs Modal */}
      {showFailedModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white rounded-xl w-full max-w-2xl p-6 sm:p-8 space-y-6 shadow-2xl border border-slate-100">
            <div className="flex justify-between items-center border-b border-slate-50 pb-4">
              <div className="flex items-center gap-3 text-rose-600">
                <AlertTriangle className="w-5 h-5" />
                <h3 className="text-lg font-bold uppercase tracking-tight">Critical Incidents</h3>
              </div>
              <button onClick={() => setShowFailedModal(false)} className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-400"><X className="w-5 h-5" /></button>
            </div>

            <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
              {(summary.logs || []).filter(l => l.failed).map(log => (
                <div key={log.id} className="p-4 bg-slate-50 rounded-lg border border-slate-100 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-[9px] font-bold uppercase tracking-widest text-rose-600 bg-rose-50 border border-rose-100 px-2 py-0.5 rounded">{log.errorCode}</span>
                    <span className="text-[10px] font-mono text-slate-400 font-medium">{log.timestamp}</span>
                  </div>
                  <p className="text-[13px] font-bold text-slate-700 font-mono truncate">{log.path}</p>
                  {log.errorMessage && <p className="text-[11px] text-rose-500 font-medium italic">"{log.errorMessage}"</p>}
                </div>
              ))}
              {(summary.logs || []).filter(l => l.failed).length === 0 && (
                <div className="py-20 text-center text-[11px] font-bold uppercase tracking-widest text-slate-300">No Critical Failures Found</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
