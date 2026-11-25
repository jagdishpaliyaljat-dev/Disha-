import React, { useState, useEffect } from "react";
import { syncCoordinator, SyncSessionStatus } from "../utils/syncCoordinator";
import { CheckCircle2, CloudOff, RefreshCw, AlertTriangle, ShieldCheck, Clock } from "lucide-react";

interface SyncStatusIndicatorProps {
  isOnline: boolean;
  isSyncing: boolean;
  lastSyncedAt: Date | null;
  isAdmin?: boolean;
}

export const SyncStatusIndicator: React.FC<SyncStatusIndicatorProps> = ({ isOnline }) => {
  const [syncStatus, setSyncStatus] = useState<SyncSessionStatus | null>(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const unsubscribe = syncCoordinator.subscribe((status) => {
      setSyncStatus(status);
    });
    return () => unsubscribe();
  }, []);

  if (!syncStatus) return null;

  const formatCountdown = (ms: number) => {
    if (ms <= 0) return "Eligible now";
    const hours = Math.floor(ms / (1000 * 60 * 60));
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  };

  const getStatusBadge = () => {
    if (!isOnline) {
      return {
        label: "Offline (Local-First)",
        color: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 border-amber-300 dark:border-amber-700/50",
        icon: <CloudOff className="w-3.5 h-3.5" />,
      };
    }

    switch (syncStatus.state) {
      case "initial_download_required":
        return {
          label: "Initial Download Needed",
          color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 border-blue-300 dark:border-blue-700/50",
          icon: <RefreshCw className="w-3.5 h-3.5 animate-spin" />,
        };
      case "sync_in_progress":
        return {
          label: "Syncing 24h Data...",
          color: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300 border-indigo-300 dark:border-indigo-700/50",
          icon: <RefreshCw className="w-3.5 h-3.5 animate-spin" />,
        };
      case "sync_failed":
        return {
          label: "Sync Window Consumed (Failed)",
          color: "bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300 border-rose-300 dark:border-rose-700/50",
          icon: <AlertTriangle className="w-3.5 h-3.5" />,
        };
      case "sync_scheduled":
        return {
          label: "24h Sync Scheduled",
          color: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700/50",
          icon: <Clock className="w-3.5 h-3.5" />,
        };
      default:
        return {
          label: "Local-First Ready",
          color: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/40",
          icon: <ShieldCheck className="w-3.5 h-3.5" />,
        };
    }
  };

  const badge = getStatusBadge();

  return (
    <div className="relative w-full flex justify-center items-center py-1 px-2.5 z-30 select-none bg-[#F8FAFC]/90 dark:bg-[#130E26]/90 border-b border-slate-200/40 dark:border-[#31275E]/40 shrink-0">
      <button
        onClick={() => setExpanded(!expanded)}
        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border shadow-2xs transition-all text-[11px] font-semibold leading-tight max-w-full ${badge.color}`}
        title="Disha PYQ Strict 24-Hour Offline-First Sync Architecture"
      >
        {badge.icon}
        <span className="whitespace-nowrap">{badge.label}</span>
      </button>

      {expanded && (
        <div 
          className="absolute top-full left-1/2 -translate-x-1/2 mt-1 w-[calc(100vw-24px)] max-w-xs rounded-xl bg-white dark:bg-[#1E2330] border border-slate-200 dark:border-[#31275E] shadow-xl p-3 text-[#2D3748] dark:text-[#E2E8F0] z-50 text-xs space-y-2 animate-in fade-in zoom-in-95 duration-100"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between border-b border-slate-200/60 dark:border-[#31275E]/60 pb-1.5">
            <span className="font-semibold text-sm">24-Hour Sync Status</span>
            <span className="text-[11px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300">
              Strict Gate
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <div>
              <span className="text-gray-500 dark:text-gray-400 block">MCQs in IndexedDB:</span>
              <span className="font-bold text-gray-800 dark:text-gray-100">{syncStatus.totalLocalMCQs}</span>
            </div>
            <div>
              <span className="text-gray-500 dark:text-gray-400 block">Local Content Ver:</span>
              <span className="font-bold text-gray-800 dark:text-gray-100">v{syncStatus.localContentVersion}</span>
            </div>
            <div>
              <span className="text-gray-500 dark:text-gray-400 block">Pending Queue:</span>
              <span className="font-bold text-gray-800 dark:text-gray-100">{syncStatus.pendingEventCount} events</span>
            </div>
            <div>
              <span className="text-gray-500 dark:text-gray-400 block">Next Regular Sync:</span>
              <span className="font-bold text-gray-800 dark:text-gray-100">{formatCountdown(syncStatus.eligibleRemainingTimeMs)}</span>
            </div>
          </div>

          <div className="border-t border-slate-200/60 dark:border-[#31275E]/60 pt-1.5 text-[11px] text-gray-500 dark:text-gray-400">
            {syncStatus.lastSuccessfulSyncAt ? (
              <span>Last sync: {new Date(syncStatus.lastSuccessfulSyncAt).toLocaleTimeString()}</span>
            ) : (
              <span>First boot completed locally.</span>
            )}
            {syncStatus.lastErrorMessage && (
              <p className="text-rose-500 mt-1 font-medium">{syncStatus.lastErrorMessage}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
