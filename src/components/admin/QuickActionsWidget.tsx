import * as React from "react";
import { Trash2, RefreshCw, Activity } from "lucide-react";
import { clearAllStorage } from "../../utils/storage";

interface QuickActionsWidgetProps {
  onRefresh: () => void;
  onHealthCheck: () => void;
  isRefreshing?: boolean;
}

export const QuickActionsWidget: React.FC<QuickActionsWidgetProps> = ({ 
  onRefresh, 
  onHealthCheck,
  isRefreshing = false 
}) => {
  const handleClearCache = () => {
    if (confirm("Are you sure you want to clear all local application data/caches? This will require a reload.")) {
      clearAllStorage();
      window.location.reload();
    }
  };

  return (
    <div className="grid grid-cols-3 gap-3">
      <button 
        onClick={handleClearCache} 
        aria-label="Purge local application cache"
        className="flex flex-col items-center gap-2 p-3 sm:p-4 rounded-2xl bg-white dark:bg-[#111A2E] border border-slate-200/80 dark:border-slate-800 hover:border-rose-300 dark:hover:border-rose-800 group transition-all cursor-pointer shadow-xs"
      >
        <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 dark:text-slate-400 group-hover:bg-rose-500 group-hover:text-white transition-colors">
          <Trash2 className="w-4.5 h-4.5 sm:w-5 sm:h-5" />
        </div>
        <span className="text-[11px] sm:text-xs font-black text-slate-500 dark:text-slate-400 group-hover:text-rose-600 dark:group-hover:text-rose-400 transition-colors">Purge Cache</span>
      </button>

      <button 
        onClick={onRefresh} 
        disabled={isRefreshing}
        aria-label="Synchronize data with cloud database"
        className="flex flex-col items-center gap-2 p-3 sm:p-4 rounded-2xl bg-white dark:bg-[#111A2E] border border-slate-200/80 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-800 group transition-all cursor-pointer shadow-xs disabled:opacity-60"
      >
        <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 dark:text-slate-400 group-hover:bg-[#7045D8] group-hover:text-white transition-colors">
          <RefreshCw className={`w-4.5 h-4.5 sm:w-5 sm:h-5 ${isRefreshing ? "animate-spin text-indigo-600" : ""}`} />
        </div>
        <span className="text-[11px] sm:text-xs font-black text-slate-500 dark:text-slate-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
          {isRefreshing ? "Syncing..." : "Sync Cloud"}
        </span>
      </button>

      <button 
        onClick={onHealthCheck} 
        aria-label="Run database health check"
        className="flex flex-col items-center gap-2 p-3 sm:p-4 rounded-2xl bg-white dark:bg-[#111A2E] border border-slate-200/80 dark:border-slate-800 hover:border-emerald-300 dark:hover:border-emerald-800 group transition-all cursor-pointer shadow-xs"
      >
        <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 dark:text-slate-400 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
          <Activity className="w-4.5 h-4.5 sm:w-5 sm:h-5" />
        </div>
        <span className="text-[11px] sm:text-xs font-black text-slate-500 dark:text-slate-400 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">Health Check</span>
      </button>
    </div>
  );
};

