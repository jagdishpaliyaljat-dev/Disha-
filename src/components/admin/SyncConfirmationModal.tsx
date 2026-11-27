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
        
        <div className="p-4 bg-blue-50 dark:bg-blue-950/30 rounded-2xl border border-blue-200 dark:border-blue-800 space-y-2">
            <div className="flex items-center gap-2 text-blue-800 dark:text-blue-300 font-bold">
                <AlertTriangle className="w-5 h-5"/>
                <span>Cloud Sync Confirmation</span>
            </div>
            <p className="text-xs text-blue-700 dark:text-blue-400">
                You are about to synchronize <strong className="font-black">{itemCount}</strong> records to Supabase PostgreSQL cloud database.
            </p>
        </div>

        <button 
            onClick={onConfirm}
            className="w-full py-3 bg-[#7045D8] hover:bg-[#5B32BF] text-white rounded-2xl font-black text-sm transition-all active:scale-95"
        >
            Proceed with Sync
        </button>
      </div>
    </div>
  );
};
