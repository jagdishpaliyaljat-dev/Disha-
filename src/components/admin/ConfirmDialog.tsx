import * as React from "react";
import { X, AlertTriangle, Trash2, Loader2 } from 'lucide-react';
import { InlineSpinner } from "../ui/LoadingScreen";

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  isDeleting?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title,
  message,
  confirmText = "Delete",
  cancelText = "Cancel",
  isDeleting = false,
  onConfirm,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[1200] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl border border-slate-100 shadow-2xl w-full max-w-sm overflow-hidden flex flex-col">
        <div className="p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-100 text-slate-900 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-tight">{title}</h3>
          </div>
          
          <p className="text-xs text-slate-500 font-medium leading-relaxed">
            {message}
          </p>
        </div>

        <div className="px-6 py-4 bg-slate-50/50 border-t border-slate-50 flex items-center gap-3">
          <button 
            onClick={onClose}
            disabled={isDeleting}
            className="flex-1 py-2 text-xs font-bold text-slate-400 hover:text-slate-900 transition-colors"
          >
            {cancelText}
          </button>
          <button 
            onClick={onConfirm}
            disabled={isDeleting}
            className="flex-1 py-2.5 bg-slate-900 text-white rounded-lg text-xs font-bold shadow-sm hover:bg-slate-800 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {isDeleting ? <InlineSpinner size="xs" /> : <Trash2 className="w-4 h-4" />}
            <span>{confirmText}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

