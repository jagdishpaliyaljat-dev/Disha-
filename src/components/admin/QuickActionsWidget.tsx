import * as React from "react";
import { Trash2, RefreshCw, Activity } from "lucide-react";
import { clearAllStorage } from "../../utils/storage";

interface QuickActionsWidgetProps {
  onRefresh: () => void;
  onHealthCheck: () => void;
}

export const QuickActionsWidget: React.FC<QuickActionsWidgetProps> = ({ onRefresh, onHealthCheck }) => {
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
        className="flex flex-col items-center gap-2 p-4 rounded-2xl bg-white dark:bg-[#111A2E] border border-slate-200/80 dark:border-slate-800 hover:border-rose-300 dark:hover:border-rose-800 group transition-all cursor-pointer shadow-xs"
      >
        <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 dark:text-slate-400 group-hover:bg-rose-500 group-hover:text-white transition-colors">
          <Trash2 className="w-5 h-5" />
        </div>
        <span className="text-xs font-black text-slate-500 dark:text-slate-400 group-hover:text-rose-600 dark:group-hover:text-rose-400 transition-colors">Purge Cache</span>
      </button>

      <button 
        onClick={onRefresh} 
        className="flex flex-col items-center gap-2 p-4 rounded-2xl bg-white dark:bg-[#111A2E] border border-slate-200/80 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-800 group transition-all cursor-pointer shadow-xs"
      >
        <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 dark:text-slate-400 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
          <RefreshCw className="w-5 h-5" />
        </div>
        <span className="text-xs font-black text-slate-500 dark:text-slate-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">Sync Cloud</span>
      </button>

      <button 
        onClick={onHealthCheck} 
        className="flex flex-col items-center gap-2 p-4 rounded-2xl bg-white dark:bg-[#111A2E] border border-slate-200/80 dark:border-slate-800 hover:border-emerald-300 dark:hover:border-emerald-800 group transition-all cursor-pointer shadow-xs"
      >
        <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 dark:text-slate-400 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
          <Activity className="w-5 h-5" />
        </div>
        <span className="text-xs font-black text-slate-500 dark:text-slate-400 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">Health Check</span>
      </button>
    </div>
  );
};

