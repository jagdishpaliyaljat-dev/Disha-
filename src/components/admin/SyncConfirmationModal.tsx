import * as React from "react";
import { X, AlertTriangle } from 'lucide-react';

export const SyncConfirmationModal: React.FC<{
  itemCount: number;
  onConfirm: () => void;
  onClose: () => void;
}> = ({ itemCount, onConfirm, onClose }) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-[#111A2E] rounded-3xl p-6 w-full max-w-sm shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-black text-slate-900 dark:text-white">Confirm Sync</h3>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded-lg"><X className="w-5 h-5"/></button>
        </div>
        
        <div className="p-4 bg-amber-50 dark:bg-amber-950/30 rounded-2xl border border-amber-200 dark:border-amber-800 space-y-2">
            <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300 font-bold">
                <AlertTriangle className="w-5 h-5"/>
                <span>Cost Preview</span>
            </div>
            <p className="text-xs text-amber-700 dark:text-amber-400">
                You are about to sync <strong className="font-black">{itemCount}</strong> document operations to Firestore. This will consume <strong className="font-black">{itemCount}</strong> write operations from your daily quota.
            </p>
        </div>

        <button 
            onClick={onConfirm}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black text-sm transition-all active:scale-95"
        >
            Proceed with Sync
        </button>
      </div>
    </div>
  );
};
