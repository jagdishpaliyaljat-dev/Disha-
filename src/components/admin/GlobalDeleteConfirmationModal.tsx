import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { AlertTriangle, Trash2, X, Loader2 } from "lucide-react";

export interface GlobalDeleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void> | void;
  title?: string;
  message?: string;
  itemCount?: number;
  isStrongWarning?: boolean;
}

export const GlobalDeleteConfirmationModal: React.FC<GlobalDeleteModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title = "Confirm Deletion",
  message,
  itemCount,
  isStrongWarning = false,
}) => {
  const [isDeleting, setIsDeleting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleConfirmClick = async () => {
    setIsDeleting(true);
    setErrorMsg(null);
    try {
      await onConfirm();
      setIsDeleting(false);
      onClose();
    } catch (err: any) {
      console.error("Deletion failed:", err);
      setErrorMsg(err?.message || "Failed to delete item. Please try again.");
      setIsDeleting(false);
    }
  };

  const defaultMessage = itemCount !== undefined && itemCount > 0
    ? `Are you sure you want to delete ${itemCount} selected record(s)? This action cannot be undone.`
    : "Are you sure you want to delete this item? This action cannot be undone.";

  return (
    <AnimatePresence mode="wait">
      {isOpen && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => {
              if (!isDeleting) onClose();
            }}
            className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            transition={{ type: "spring", damping: 25, stiffness: 350 }}
            className="relative w-full max-w-md bg-white dark:bg-[#111A2E] rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col"
          >
            {/* Header */}
            <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-xs ${
                  isStrongWarning 
                    ? "bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400" 
                    : "bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400"
                }`}>
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <h3 className="text-base font-black text-slate-900 dark:text-white tracking-tight">
                  {title}
                </h3>
              </div>
              {!isDeleting && (
                <button
                  onClick={onClose}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Body */}
            <div className="p-5 space-y-3">
              <p className="text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-300 leading-relaxed">
                {message || defaultMessage}
              </p>

              {isStrongWarning && (
                <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-rose-700 dark:text-rose-300 text-xs font-bold flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>Permanent Record Deletion: This operation is irreversible.</span>
                </div>
              )}

              {errorMsg && (
                <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-rose-700 dark:text-rose-300 text-xs font-bold">
                  ⚠️ {errorMsg}
                </div>
              )}
            </div>

            {/* Footer Buttons */}
            <div className="px-5 py-3.5 bg-slate-50 dark:bg-slate-900/80 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2.5">
              <button
                type="button"
                disabled={isDeleting}
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl bg-slate-200/80 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-black cursor-pointer transition-all disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleConfirmClick}
                className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 active:scale-95 text-white text-xs font-black shadow-md flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    <span>Delete</span>
                  </>
                )}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
