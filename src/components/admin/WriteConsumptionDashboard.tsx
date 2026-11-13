import * as React from "react";
import {
  Zap,
  Database,
  RefreshCw,
  Terminal,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  GitCommitHorizontal,
  Trash2,
  Info,
} from "lucide-react";
import {
  getQuotaSummary,
  QuotaDailySummary,
  subscribeQuota,
  isQuotaExhausted,
  getPendingWrites,
  flushPendingWrites,
  PendingWriteOperation,
  SPARK_DAILY_WRITE_LIMIT,
} from "../../utils/quotaTracker";
import { getPendingVersionBumpsCount, processPendingVersionBumps } from "../../utils/appVersionService";

export const WriteConsumptionDashboard: React.FC = () => {
  const [summary, setSummary] = React.useState<QuotaDailySummary>(() => getQuotaSummary());
  const [pendingQueue, setPendingQueue] = React.useState<PendingWriteOperation[]>(() => getPendingWrites());
  const [pendingBumps, setPendingBumps] = React.useState<number>(() => getPendingVersionBumpsCount());
  const [exhausted, setExhausted] = React.useState<boolean>(() => isQuotaExhausted());
  const [flushing, setFlushing] = React.useState<boolean>(false);
  const [flushStatus, setFlushStatus] = React.useState<string | null>(null);

  const refreshAll = React.useCallback(() => {
    setSummary(getQuotaSummary());
    setPendingQueue(getPendingWrites());
    setPendingBumps(getPendingVersionBumpsCount());
    setExhausted(isQuotaExhausted());
  }, []);

  React.useEffect(() => {
    const unsub = subscribeQuota((s) => {
      setSummary({ ...s });
      setPendingQueue(getPendingWrites());
      setPendingBumps(getPendingVersionBumpsCount());
      setExhausted(isQuotaExhausted());
    });
    return () => unsub();
  }, []);

  const handleFlushPending = async () => {
    if (flushing || exhausted) return;
    setFlushing(true);
    setFlushStatus(null);
    try {
      const res = await flushPendingWrites();
      const bumpCount = await processPendingVersionBumps().catch(() => 0);
      refreshAll();
      setFlushStatus(
        res.abortedByQuota
          ? `Aborted by quota breaker: ${res.flushed + bumpCount} flushed, ${res.remaining} still preserved.`
          : `Flushed ${res.flushed + bumpCount} pending write(s), ${res.skippedAlreadyCommitted} idempotent skip(s). Remaining: ${res.remaining}.`
      );
    } catch (err: any) {
      setFlushStatus(err?.message || "Flush failed; queued operations remain preserved.");
    } finally {
      setFlushing(false);
    }
  };

  const attemptedWrites = summary.attemptedWrites ?? (summary.writes + (summary.failedWrites || 0));
  const successfulWrites = summary.successfulWrites ?? Math.max(0, (summary.writes || 0) - (summary.deletes || 0));
  const confirmedDeletes = summary.confirmedDeletes ?? summary.deletes ?? 0;
  const failedWrites = summary.failedWrites || 0;
  const pendingWrites = pendingQueue.length + pendingBumps;
  const estimatedTxOps = summary.estimatedTransactionOps || 0;

  const totalConfirmedMutations = successfulWrites + confirmedDeletes;
  const remainingRef = Math.max(0, SPARK_DAILY_WRITE_LIMIT - totalConfirmedMutations);
  const percentUsed = Math.min(100, Math.round((totalConfirmedMutations / SPARK_DAILY_WRITE_LIMIT) * 100));

  const byCollection = summary.byCollection || {};
  const collectionEntries = Object.entries(byCollection)
    .map(([col, stats]) => ({
      collection: col,
      writes: stats.writes || 0,
      reads: stats.reads || 0,
      deletes: stats.deletes || 0,
    }))
    .sort((a, b) => b.writes - a.writes);

  const topActions = summary.topActions || {};
  const actionEntries = Object.values(topActions)
    .map((act: any) => ({
      actionName: act.actionName,
      category: act.category,
      writes: act.writes || 0,
      reads: act.reads || 0,
      count: act.count || 0,
      failedCount: act.failedCount || 0,
    }))
    .sort((a, b) => b.writes - a.writes || b.failedCount - a.failedCount);

  return (
    <div className="bg-white dark:bg-slate-900 rounded-[32px] p-8 border border-slate-200/80 dark:border-slate-800 shadow-xl space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-blue-500/10 dark:bg-blue-500/20 flex items-center justify-center text-blue-600 dark:text-blue-400">
            <Zap className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
              Write Quota Telemetry (This Browser Session)
            </h3>
            <p className="text-xs text-slate-500 font-medium">
              Separated local counters for attempted, confirmed, failed, pending, delete, and transaction operations
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {pendingWrites > 0 && (
            <button
              onClick={handleFlushPending}
              disabled={flushing || exhausted}
              title={exhausted ? "Disabled while quota circuit breaker is active" : "Replay queued writes idempotently"}
              className="flex items-center gap-2 px-4 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 disabled:text-slate-600 text-white rounded-2xl font-black text-xs uppercase tracking-wider shadow-lg active:scale-95 transition-all"
            >
              <Clock className={`w-4 h-4 ${flushing ? "animate-spin" : ""}`} />
              <span>{flushing ? "Recovering..." : `Replay ${pendingWrites} Pending`}</span>
            </button>
          )}
          <button
            onClick={refreshAll}
            className="flex items-center gap-2 px-5 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black text-xs uppercase tracking-wider shadow-lg shadow-blue-600/20 active:scale-95 transition-all"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Refresh Telemetry</span>
          </button>
        </div>
      </div>

      {/* Scope Disclaimer Banner (Task 4 requirement) */}
      <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex items-start gap-3 text-xs text-slate-600 dark:text-slate-300">
        <Info className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
        <div>
          <span className="font-bold text-slate-800 dark:text-white">Browser-Local Telemetry Notice: </span>
          These counters measure guarded SDK operations initiated by this browser only ({percentUsed}% of {SPARK_DAILY_WRITE_LIMIT.toLocaleString()} Spark daily reference; ~{remainingRef.toLocaleString()} local headroom). They are not authoritative project-wide Firebase billing totals across all devices. Check Firebase Console for project-wide usage.
        </div>
      </div>

      {flushStatus && (
        <div className="p-3.5 rounded-2xl bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800 text-xs font-semibold text-indigo-800 dark:text-indigo-200">
          {flushStatus}
        </div>
      )}

      {/* 6 Separated Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="p-5 rounded-3xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 space-y-1.5">
          <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-slate-400">
            <span>Attempted Writes</span>
            <Zap className="w-3.5 h-3.5 text-slate-500" />
          </div>
          <div className="text-2xl font-black font-mono text-slate-900 dark:text-white">
            {attemptedWrites.toLocaleString()}
          </div>
          <p className="text-[11px] text-slate-500">All write/delete attempts initiated</p>
        </div>

        <div className="p-5 rounded-3xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 space-y-1.5">
          <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-slate-400">
            <span>Successful Writes</span>
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
          </div>
          <div className="text-2xl font-black font-mono text-emerald-600">
            {successfulWrites.toLocaleString()}
          </div>
          <p className="text-[11px] text-slate-500">Confirmed server set/update ops</p>
        </div>

        <div className="p-5 rounded-3xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 space-y-1.5">
          <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-slate-400">
            <span>Confirmed Deletes</span>
            <Trash2 className="w-3.5 h-3.5 text-purple-500" />
          </div>
          <div className="text-2xl font-black font-mono text-purple-600">
            {confirmedDeletes.toLocaleString()}
          </div>
          <p className="text-[11px] text-slate-500">Confirmed server delete ops (20k Spark ref)</p>
        </div>

        <div className="p-5 rounded-3xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 space-y-1.5">
          <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-slate-400">
            <span>Failed Writes</span>
            <XCircle className="w-3.5 h-3.5 text-rose-500" />
          </div>
          <div className={`text-2xl font-black font-mono ${failedWrites > 0 ? "text-rose-600" : "text-slate-900 dark:text-white"}`}>
            {failedWrites.toLocaleString()}
          </div>
          <p className="text-[11px] text-slate-500">
            {exhausted ? "Circuit breaker latched" : "Blocked, timed-out, or rejected ops"}
          </p>
        </div>

        <div className="p-5 rounded-3xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 space-y-1.5">
          <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-slate-400">
            <span>Pending Writes</span>
            <Clock className="w-3.5 h-3.5 text-amber-500" />
          </div>
          <div className={`text-2xl font-black font-mono ${pendingWrites > 0 ? "text-amber-600" : "text-slate-900 dark:text-white"}`}>
            {pendingWrites.toLocaleString()}
          </div>
          <p className="text-[11px] text-slate-500">
            {pendingQueue.length} write(s) + {pendingBumps} version bump(s) preserved
          </p>
        </div>

        <div className="p-5 rounded-3xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 space-y-1.5">
          <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-slate-400">
            <span>Est. Transaction Ops</span>
            <GitCommitHorizontal className="w-3.5 h-3.5 text-indigo-500" />
          </div>
          <div className="text-2xl font-black font-mono text-indigo-600">
            {estimatedTxOps.toLocaleString()}
          </div>
          <p className="text-[11px] text-slate-500">Reads + writes across tx attempts</p>
        </div>
      </div>

      {pendingQueue.length > 0 && (
        <div className="p-5 rounded-3xl bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/60 space-y-2">
          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-amber-700 dark:text-amber-300">
            <AlertTriangle className="w-4 h-4" />
            <span>Preserved Pending Write Queue ({pendingQueue.length})</span>
          </div>
          <div className="space-y-1.5 max-h-40 overflow-y-auto">
            {pendingQueue.slice(0, 8).map((item) => (
              <div key={item.id} className="flex items-center justify-between text-xs bg-white/80 dark:bg-slate-900/60 px-3 py-2 rounded-xl border border-amber-200/60 dark:border-amber-800/40">
                <span className="font-mono truncate max-w-[65%]">
                  [{item.type.toUpperCase()}] {item.actionName} · {item.path}
                </span>
                <span className="text-[10px] font-bold text-amber-700 dark:text-amber-300">
                  {item.opCount} op(s) · {item.lastErrorCode || "queued"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 space-y-4">
          <div className="flex items-center gap-3">
            <Database className="w-5 h-5 text-blue-600" />
            <h4 className="font-black text-xs uppercase tracking-widest text-slate-700 dark:text-slate-300">
              Confirmed Mutations Per Collection
            </h4>
          </div>
          <div className="space-y-3">
            {collectionEntries.length === 0 ? (
              <p className="text-xs text-slate-400 py-4 text-center">No confirmed writes recorded yet today.</p>
            ) : (
              collectionEntries.map((entry) => (
                <div key={entry.collection} className="flex items-center justify-between p-3 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 text-xs">
                  <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{entry.collection}</span>
                  <div className="flex items-center gap-4 font-mono">
                    <span className="text-blue-600 font-black">{entry.writes} W</span>
                    <span className="text-purple-600 font-bold">{entry.deletes} D</span>
                    <span className="text-slate-400">{entry.reads} R</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 space-y-4">
          <div className="flex items-center gap-3">
            <Terminal className="w-5 h-5 text-indigo-600" />
            <h4 className="font-black text-xs uppercase tracking-widest text-slate-700 dark:text-slate-300">
              Writes Per Function / Action
            </h4>
          </div>
          <div className="space-y-3">
            {actionEntries.length === 0 ? (
              <p className="text-xs text-slate-400 py-4 text-center">No action logs recorded yet today.</p>
            ) : (
              actionEntries.slice(0, 6).map((act, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 text-xs">
                  <div className="min-w-0 pr-3">
                    <p className="font-bold text-slate-800 dark:text-slate-200 truncate">{act.actionName}</p>
                    <span className="text-[10px] text-slate-400 uppercase font-black">
                      {act.category}{act.failedCount > 0 ? ` · ${act.failedCount} failed` : ""}
                    </span>
                  </div>
                  <span className="font-mono font-black text-indigo-600 shrink-0">{act.writes} confirmed</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
