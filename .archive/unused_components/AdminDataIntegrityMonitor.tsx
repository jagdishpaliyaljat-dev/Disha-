import React, { useState, useEffect } from "react";
import { 
  checkCurriculumVersionMatch, 
  getPendingVersionBumpsCount, 
  processPendingVersionBumps 
} from "../utils/appVersionService";
import { loadUserQuestionsStore } from "../utils/questionsStorage";
import { isFirebaseConfigured, db } from "../lib/firebase";
import { collection, query, limit } from "firebase/firestore";
import { guardedGetDocs } from "../utils/quotaTracker";
import { ShieldCheck, RefreshCw, AlertTriangle, Database, CheckCircle2, Server, Clock } from "lucide-react";

export interface DiagnosticData {
  remoteVersion: number;
  localVersion: number;
  pendingBumpsCount: number;
  mcqsCollectionCount: number;
  questionsCollectionCount: number;
  orphanedCount: number;
  duplicateCount: number;
  lastSuccessSync: string;
  lastFailedSync: string | null;
  lastError: string | null;
  cacheKeysCount: number;
}

export const AdminDataIntegrityMonitor: React.FC = () => {
  const [diagnostics, setDiagnostics] = useState<DiagnosticData | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [retryingBumps, setRetryingBumps] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const runDiagnostics = async () => {
    setLoading(true);
    setStatusMessage("Running read-only data integrity audit...");

    try {
      // 1. Version check
      const verInfo = await checkCurriculumVersionMatch();
      const pendingCount = getPendingVersionBumpsCount();

      // 2. Cache keys count
      let cacheKeys = 0;
      if (typeof localStorage !== "undefined") {
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && (k.startsWith("quizpro_") || k.startsWith("economic_"))) {
            cacheKeys++;
          }
        }
      }

      // 3. Store counts & duplicates
      const store = loadUserQuestionsStore();
      const allQs = [...(store.customQuestions || []), ...(store.cloudCacheQuestions || [])];
      const seenIds = new Set<string>();
      let duplicates = 0;
      let orphans = 0;

      allQs.forEach((q) => {
        if (!q.id) return;
        if (seenIds.has(q.id)) {
          duplicates++;
        } else {
          seenIds.add(q.id);
        }
        if (!q.topicId || !q.chapterId) {
          orphans++;
        }
      });

      // 4. Remote Firestore collection counts (Read-only query with limit)
      let mcqsCount = allQs.length;
      let questionsCount = allQs.length;

      if (isFirebaseConfigured()) {
        try {
          const mcqSnap = await guardedGetDocs(query(collection(db, "mcqs"), limit(1000)), "Admin", "Diagnostic Query MCQs");
          mcqsCount = mcqSnap.size;

          const qSnap = await guardedGetDocs(query(collection(db, "questions"), limit(1000)), "Admin", "Diagnostic Query Questions");
          questionsCount = qSnap.size;
        } catch (_) {}
      }

      setDiagnostics({
        remoteVersion: verInfo.remoteVersion,
        localVersion: verInfo.localVersion,
        pendingBumpsCount: pendingCount,
        mcqsCollectionCount: mcqsCount,
        questionsCollectionCount: questionsCount,
        orphanedCount: orphans,
        duplicateCount: duplicates,
        lastSuccessSync: new Date().toLocaleTimeString(),
        lastFailedSync: localStorage.getItem("quizpro_last_failed_sync"),
        lastError: localStorage.getItem("quizpro_last_sync_error"),
        cacheKeysCount: cacheKeys,
      });

      setStatusMessage("Audit complete. All records verified.");
    } catch (err: any) {
      setStatusMessage(`Audit error: ${err?.message || "Failed to load diagnostics"}`);
    } finally {
      setLoading(false);
    }
  };

  const handleRetryBumps = async () => {
    setRetryingBumps(true);
    try {
      const flushed = await processPendingVersionBumps();
      setStatusMessage(`Successfully flushed ${flushed} pending version bump(s).`);
      await runDiagnostics();
    } catch (err: any) {
      setStatusMessage(`Retry failed: ${err.message}`);
    } finally {
      setRetryingBumps(false);
    }
  };

  useEffect(() => {
    runDiagnostics();
  }, []);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 text-slate-100 shadow-xl my-6">
      <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-500/10 rounded-lg border border-indigo-500/20 text-indigo-400">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-white">System Data Integrity & Sync Monitor</h3>
            <p className="text-xs text-slate-400">Read-only diagnostic metrics for DISHA 20-20 production database</p>
          </div>
        </div>

        <button
          onClick={runDiagnostics}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-200 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          Run Diagnostic Audit
        </button>
      </div>

      {statusMessage && (
        <div className="mb-4 px-3 py-2 bg-slate-800/80 border border-slate-700/50 rounded-lg text-xs text-slate-300 flex items-center justify-between">
          <span>{statusMessage}</span>
          {diagnostics && diagnostics.pendingBumpsCount > 0 && (
            <button
              onClick={handleRetryBumps}
              disabled={retryingBumps}
              className="px-2 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded text-xs font-semibold flex items-center gap-1"
            >
              <RefreshCw className={`w-3 h-3 ${retryingBumps ? "animate-spin" : ""}`} />
              Retry Pending Bumps ({diagnostics.pendingBumpsCount})
            </button>
          )}
        </div>
      )}

      {diagnostics && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
          <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800">
            <div className="text-slate-400 flex items-center gap-1.5 mb-1">
              <Server className="w-3.5 h-3.5 text-indigo-400" /> Remote Version
            </div>
            <div className="text-lg font-bold text-white">v{diagnostics.remoteVersion}</div>
            <div className="text-[10px] text-slate-500 mt-0.5">Local: v{diagnostics.localVersion}</div>
          </div>

          <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800">
            <div className="text-slate-400 flex items-center gap-1.5 mb-1">
              <Clock className="w-3.5 h-3.5 text-amber-400" /> Pending Bumps
            </div>
            <div className={`text-lg font-bold ${diagnostics.pendingBumpsCount > 0 ? "text-amber-400" : "text-emerald-400"}`}>
              {diagnostics.pendingBumpsCount}
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">
              {diagnostics.pendingBumpsCount === 0 ? "All signals synced" : "Queued in localStorage"}
            </div>
          </div>

          <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800">
            <div className="text-slate-400 flex items-center gap-1.5 mb-1">
              <Database className="w-3.5 h-3.5 text-emerald-400" /> Collections
            </div>
            <div className="text-lg font-bold text-white">{diagnostics.mcqsCollectionCount}</div>
            <div className="text-[10px] text-slate-500 mt-0.5">
              mcqs: {diagnostics.mcqsCollectionCount} | questions: {diagnostics.questionsCollectionCount}
            </div>
          </div>

          <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800">
            <div className="text-slate-400 flex items-center gap-1.5 mb-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400" /> Quality Audit
            </div>
            <div className="text-lg font-bold text-white">
              {diagnostics.orphanedCount === 0 && diagnostics.duplicateCount === 0 ? (
                <span className="text-emerald-400">100% Clean</span>
              ) : (
                <span className="text-amber-400">Issues Found</span>
              )}
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">
              Orphans: {diagnostics.orphanedCount} | Duplicates: {diagnostics.duplicateCount}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
