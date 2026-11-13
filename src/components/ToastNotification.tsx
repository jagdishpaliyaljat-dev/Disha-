import React, { useEffect } from "react";
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, AlertTriangle, Info, X, CloudCheck, CloudOff } from 'lucide-react';

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info';
  title: string;
  message: string;
  duration?: number; // ms
}

interface ToastNotificationProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export const ToastNotificationContainer: React.FC<ToastNotificationProps> = ({ toasts, onDismiss }) => {
  return null;
};

const ToastItem: React.FC<{ toast: ToastMessage; onDismiss: (id: string) => void }> = ({ toast, onDismiss }) => {
  const duration = toast.duration || (toast.type === 'error' ? 6000 : 4000);

  useEffect(() => {
    const timer = setTimeout(() => {
      onDismiss(toast.id);
    }, duration);
    return () => clearTimeout(timer);
  }, [toast.id, duration, onDismiss]);

  const isSuccess = toast.type === 'success';
  const isError = toast.type === 'error';

  return (
    <motion.div
      initial={{ opacity: 0, y: -20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -20, scale: 0.95 }}
      transition={{ type: 'spring', damping: 25, stiffness: 350 }}
      className={`pointer-events-auto w-full p-4 rounded-2xl shadow-2xl border flex items-start gap-3 backdrop-blur-md relative overflow-hidden ${
        isSuccess
          ? 'bg-emerald-950/90 text-emerald-100 border-emerald-500/40 shadow-emerald-950/50'
          : isError
          ? 'bg-rose-950/90 text-rose-100 border-rose-500/40 shadow-rose-950/50'
          : 'bg-slate-900/90 text-slate-100 border-blue-500/40 shadow-slate-950/50'
      }`}
    >
      {/* Icon */}
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
        isSuccess ? 'bg-emerald-500/20 text-emerald-400' : isError ? 'bg-rose-500/20 text-rose-400' : 'bg-blue-500/20 text-blue-400'
      }`}>
        {isSuccess ? (
          <CloudCheck className="w-5 h-5 animate-pulse" />
        ) : isError ? (
          <AlertTriangle className="w-5 h-5" />
        ) : (
          <Info className="w-5 h-5" />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 pr-2">
        <h4 className="text-sm font-black tracking-tight leading-snug">
          {toast.title}
        </h4>
        <p className="text-xs font-medium text-slate-300 mt-0.5 leading-relaxed break-words">
          {toast.message}
        </p>
      </div>

      {/* Dismiss button */}
      <button
        onClick={() => onDismiss(toast.id)}
        className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors shrink-0 cursor-pointer"
        aria-label="Close notification"
      >
        <X className="w-4 h-4" />
      </button>

      {/* Progress bar animation */}
      <motion.div
        initial={{ width: '100%' }}
        animate={{ width: '0%' }}
        transition={{ duration: duration / 1000, ease: 'linear' }}
        className={`absolute bottom-0 left-0 h-1 ${
          isSuccess ? 'bg-emerald-400' : isError ? 'bg-rose-500' : 'bg-blue-400'
        }`}
      />
    </motion.div>
  );
};
