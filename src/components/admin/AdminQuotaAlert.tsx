import * as React from "react";
import { AlertTriangle, Flame, ShieldAlert, ZapOff, Clock, ExternalLink, RefreshCw, Layers, CheckCircle2 } from "lucide-react";
import {
  isQuotaExhausted,
  getQuotaSummary,
  getTimeUntilPacificMidnight,
  QuotaDailySummary,
  subscribeQuota,
  getPendingWritesCount,
  flushPendingWrites,
} from "../../utils/quotaTracker";
import { getPendingVersionBumpsCount, processPendingVersionBumps } from "../../utils/appVersionService";

export const AdminQuotaAlert: React.FC = () => {
  const [summary, setSummary] = React.useState<QuotaDailySummary>(() => getQuotaSummary());
  const [exhausted, setExhausted] = React.useState<boolean>(() => isQuotaExhausted());
  const [pendingOps, setPendingOps] = React.useState<number>(() => getPendingWritesCount() + getPendingVersionBumpsCount());
  const [flushing, setFlushing] = React.useState(false);
  const [flushNotice, setFlushNotice] = React.useState<string | null>(null);

  React.useEffect(() => {
    const syncState = (s: QuotaDailySummary) => {
      setSummary(s);
      setExhausted(isQuotaExhausted());
      setPendingOps((s.pendingWrites || getPendingWritesCount()) + getPendingVersionBumpsCount());
    };
    const unsub = subscribeQuota(syncState);
    const interval = setInterval(() => {
      syncState(getQuotaSummary());
    }, 15000);
    return () => {
      unsub();
      clearInterval(interval);
    };
  }, []);

  const handleFlushPending = async () => {
    if (flushing || isQuotaExhausted()) return;
    setFlushing(true);
    setFlushNotice(null);
    try {
      const writeRes = await flushPendingWrites();
      const bumpFlushed = await processPendingVersionBumps().catch(() => 0);
      const totalFlushed = writeRes.flushed + bumpFlushed;
      const totalRemaining = getPendingWritesCount() + getPendingVersionBumpsCount();
      setPendingOps(totalRemaining);
      setExhausted(isQuotaExhausted());
      setFlushNotice(
        writeRes.abortedByQuota
          ? `Paused: ${totalFlushed} recovered, ${totalRemaining} remaining (quota breaker tripped).`
          : `Recovered ${totalFlushed} queued operation(s); ${totalRemaining} remaining.`
      );
    } catch (err: any) {
      setFlushNotice(err?.message || "Recovery attempt interrupted; queued items preserved.");
    } finally {
      setFlushing(false);
    }
  };

  const timeRemaining = getTimeUntilPacificMidnight().text;
  const confirmedMutations = (summary.successfulWrites || 0) + (summary.confirmedDeletes ?? summary.deletes ?? 0);
  const writePercentage = Math.min(100, (confirmedMutations / 20000) * 100);
  const isHighUsage = confirmedMutations > 16000;

  if (!exhausted && !isHighUsage && pendingOps === 0) return null;

  const tone = exhausted
    ? {
        box: "bg-rose-50 dark:bg-rose-950/20 border-rose-500/30",
        icon: "bg-rose-500 text-white shadow-lg shadow-rose-500/20",
        title: "text-rose-600 dark:text-rose-400",
        heading: "Quota Circuit Breaker Active — Writes Halted",
        body: "Daily Firestore write quota protection has tripped. All non-essential writes—including Admin & metadata updates—are paused to preserve existing production data. Queued operations are preserved safely on this device.",
      }
    : pendingOps > 0 && !isHighUsage
    ? {
        box: "bg-indigo-50 dark:bg-indigo-950/20 border-indigo-500/30",
        icon: "bg-indigo-600 text-white shadow-lg shadow-indigo-600/20",
        title: "text-indigo-700 dark:text-indigo-300",
        heading: "Pending Operations Ready for Safe Recovery",
        body: "Quota protection previously preserved write operations locally while offline or quota-limited. You can replay them safely now without duplicates.",
      }
    : {
        box: "bg-amber-50 dark:bg-amber-950/20 border-amber-500/30",
        icon: "bg-amber-500 text-white shadow-lg shadow-amber-500/20",
        title: "text-amber-600 dark:text-amber-400",
        heading: "High Device Write Activity Warning",
        body: "This browser has recorded >80% of the 20,000 daily Spark write reference. Pause bulk imports or non-essential syncs to avoid hitting project quota.",
      };

  return (
    <div className={`mb-6 p-4 rounded-3xl border-2 shadow-2xl animate-in zoom-in-95 duration-300 ${tone.box}`}>
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${tone.icon}`}>
            {exhausted ? <ZapOff className="w-6 h-6" /> : pendingOps > 0 && !isHighUsage ? <Layers className="w-6 h-6" /> : <AlertTriangle className="w-6 h-6" />}
          </div>
          <div>
            <h3 className={`text-sm font-black uppercase tracking-tight ${tone.title}`}>
              {tone.heading}
            </h3>
            <p className="text-xs font-medium text-slate-600 dark:text-slate-300 mt-1 max-w-2xl">
              {tone.body}
            </p>
            {flushNotice && (
              <p className="text-xs font-bold text-indigo-700 dark:text-indigo-300 mt-2 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                <span>{flushNotice}</span>
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto flex-wrap">
          <div className="flex flex-col items-end gap-1">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1">
              <Clock className="w-3 h-3" /> Reset in {timeRemaining} (PST)
            </span>
            <div className="flex items-center gap-4 mt-1">
              <div className="flex flex-col items-end">
                <span className="text-[10px] font-bold text-slate-500">
                  Browser Confirmed ({Math.round(writePercentage)}%)
                </span>
                <div className="w-24 h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full mt-0.5 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-1000 ${exhausted ? "bg-rose-500" : "bg-amber-500"}`}
                    style={{ width: `${writePercentage}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {!exhausted && pendingOps > 0 && (
            <button
              onClick={handleFlushPending}
              disabled={flushing}
              className="px-4 py-2.5 rounded-xl text-xs font-black flex items-center gap-2 transition-all active:scale-95 shadow-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${flushing ? "animate-spin" : ""}`} />
              <span>{flushing ? "Recovering..." : `Recover ${pendingOps} Queued`}</span>
            </button>
          )}

          <a
            href="https://console.firebase.google.com/project/gen-lang-client-0811306192/firestore/usage"
            target="_blank"
            rel="noopener noreferrer"
            className={`px-4 py-2.5 rounded-xl text-xs font-black flex items-center gap-2 transition-all active:scale-95 shadow-lg ${
              exhausted
                ? "bg-rose-600 text-white hover:bg-rose-700 shadow-rose-600/20"
                : "bg-amber-600 text-white hover:bg-amber-700 shadow-amber-600/20"
            }`}
          >
            <ShieldAlert className="w-4 h-4" />
            <span>Firebase Usage Console</span>
            <ExternalLink className="w-3 h-3 opacity-60" />
          </a>
        </div>
      </div>

      {(exhausted || pendingOps > 0) && (
        <div className="mt-4 pt-4 border-t border-rose-500/10 flex flex-wrap gap-3">
          {exhausted && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-rose-500/10 text-rose-700 dark:text-rose-300 text-[10px] font-bold border border-rose-500/20">
              <Flame className="w-3.5 h-3.5" />
              <span>Circuit Breaker Latched (Admin & Metadata Protected)</span>
            </div>
          )}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-500/10 text-slate-700 dark:text-slate-300 text-[10px] font-bold border border-slate-500/20">
            <Layers className="w-3.5 h-3.5" />
            <span>Pending Preserved Operations: {pendingOps.toLocaleString()}</span>
          </div>
          {exhausted && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-500/10 text-slate-600 dark:text-slate-300 text-[10px] font-bold border border-slate-500/20">
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Firestore Write Network Paused</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
