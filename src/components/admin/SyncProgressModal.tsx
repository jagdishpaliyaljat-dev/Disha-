import * as React from "react";
import { SyncProgressState } from '../../utils/bulkSyncService';
import { X, CheckCircle2, AlertTriangle, RefreshCw } from 'lucide-react';

export const SyncProgressModal: React.FC<{
  progress: SyncProgressState | null;
  onClose: () => void;
}> = ({ progress, onClose }) => {
  if (!progress) return null;

  const isFinished = progress.status === 'success' || progress.status === 'partial_success' || progress.status === 'error';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white dark:bg-[#111A2E] rounded-3xl p-6 w-full max-w-md shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4">
        <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-3">
          <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
            <RefreshCw className={`w-4 h-4 text-blue-600 ${!isFinished ? 'animate-spin' : ''}`} />
            Cloud Data Sync
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400">
            <X className="w-5 h-5"/>
          </button>
        </div>

        <div className="space-y-2">
          <div className="flex justify-between text-xs font-bold text-slate-600 dark:text-slate-300">
            <span className="truncate pr-2">{progress.currentStatusMessage}</span>
            <span>{progress.progressPercentage}%</span>
          </div>
          <div className="w-full h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
            <div 
              className={`h-full transition-all duration-300 ${
                progress.status === 'error' ? 'bg-rose-500' : progress.status === 'success' ? 'bg-emerald-500' : 'bg-blue-600'
              }`} 
              style={{ width: `${progress.progressPercentage}%` }}
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 text-center text-[10px] font-bold">
          <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-900/50">
            <p className="text-slate-400">Uploaded</p>
            <p className="text-sm font-black text-emerald-600">{progress.uploadedRecords}</p>
          </div>
          <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-900/50">
            <p className="text-slate-400">Failed</p>
            <p className="text-sm font-black text-rose-600">{progress.failedRecords}</p>
          </div>
          <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-900/50">
            <p className="text-slate-400">Total</p>
            <p className="text-sm font-black text-slate-800 dark:text-slate-200">{progress.totalRecords}</p>
          </div>
        </div>

        {progress.status === 'success' && (
          <div className="p-4 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300 rounded-2xl flex items-center gap-3 font-bold text-xs">
            <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-600"/>
            <span>All records synchronized successfully with Cloud Firestore!</span>
          </div>
        )}
        
        {(progress.status === 'error' || progress.status === 'partial_success') && (
          <div className="p-4 bg-rose-50 dark:bg-rose-950/30 text-rose-900 dark:text-rose-300 rounded-2xl space-y-2 text-xs">
            <div className="flex items-center gap-2 font-black text-rose-600">
              <AlertTriangle className="w-5 h-5 shrink-0"/>
              <span>{progress.status === 'error' ? 'Sync Encountered Issues' : 'Partial Sync Complete'}</span>
            </div>
            {progress.errorDetails && progress.errorDetails.length > 0 && (
              <ul className="list-disc pl-5 space-y-1 font-mono text-[11px] text-rose-700 dark:text-rose-400 max-h-28 overflow-y-auto">
                {progress.errorDetails.slice(0, 5).map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        {isFinished && (
          <button
            onClick={onClose}
            className="w-full py-3 bg-slate-900 dark:bg-slate-800 text-white rounded-2xl font-bold text-xs uppercase tracking-wider active:scale-95 transition-all"
          >
            Done
          </button>
        )}
      </div>
    </div>
  );
};
