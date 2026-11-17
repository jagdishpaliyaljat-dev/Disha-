import React, { useEffect, useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  CheckCircle2, 
  AlertTriangle, 
  Info, 
  X, 
  Database, 
  Trash2, 
  RefreshCw,
  Sparkles,
  CloudCheck
} from "lucide-react";
import { AdminToastPayload } from "../utils/adminToast";
import { playCorrectSound, playClickSound, triggerHaptic } from "../utils/audioFeedback";

export interface ToastMessage {
  id: string;
  type: "success" | "error" | "info" | "add" | "delete" | "update";
  title: string;
  message: string;
  duration?: number; // ms
  itemName?: string;
  category?: string;
  count?: number;
}

interface ToastNotificationProps {
  toasts?: ToastMessage[];
  onDismiss?: (id: string) => void;
}

export const ToastNotificationContainer: React.FC<ToastNotificationProps> = ({ 
  toasts = [], 
  onDismiss 
}) => {
  const [activeToasts, setActiveToasts] = useState<ToastMessage[]>([]);
  const seenIdsRef = useRef<Set<string>>(new Set());

  // Handle external window events from adminToast
  useEffect(() => {
    const handleAdminEvent = (e: Event) => {
      const customEvent = e as CustomEvent<AdminToastPayload>;
      if (!customEvent.detail) return;
      const detail = customEvent.detail;
      const id = "admin_toast_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6);

      // Play audio & haptic confirmation
      if (detail.type === "delete") {
        playClickSound(true);
        triggerHaptic("warning", true);
      } else if (detail.type === "add" || detail.type === "success" || detail.type === "update") {
        playCorrectSound(true);
        triggerHaptic("success", true);
      }

      setActiveToasts((prev) => [
        {
          id,
          type: detail.type,
          title: detail.title,
          message: detail.message,
          itemName: detail.itemName,
          category: detail.category,
          count: detail.count,
          duration: 4000,
        },
        ...prev.slice(0, 2), // Keep max 3 toasts visible simultaneously
      ]);
    };

    window.addEventListener("disha2020_saved", handleAdminEvent);
    window.addEventListener("disha2020_admin_toast", handleAdminEvent);
    return () => {
      window.removeEventListener("disha2020_saved", handleAdminEvent);
      window.removeEventListener("disha2020_admin_toast", handleAdminEvent);
    };
  }, []);

  // Sync prop toasts
  useEffect(() => {
    if (!toasts || toasts.length === 0) return;
    toasts.forEach((t) => {
      if (!seenIdsRef.current.has(t.id)) {
        seenIdsRef.current.add(t.id);
        setActiveToasts((prev) => {
          if (prev.some((p) => p.id === t.id)) return prev;
          if (t.type === "delete") {
            playClickSound(true);
            triggerHaptic("warning", true);
          } else if (t.type === "add" || t.type === "success" || t.type === "update") {
            playCorrectSound(true);
            triggerHaptic("success", true);
          }
          return [t, ...prev.slice(0, 2)];
        });
      }
    });
  }, [toasts]);

  const dismissToast = useCallback((id: string) => {
    setActiveToasts((prev) => prev.filter((t) => t.id !== id));
    onDismiss?.(id);
  }, [onDismiss]);

  return (
    <div 
      className="fixed top-3 sm:top-5 inset-x-0 mx-auto z-[999999] pointer-events-none flex flex-col items-center gap-2 px-3 sm:px-4 max-w-md w-full"
      role="region"
      aria-live="polite"
      aria-label="Live Status Notifications"
    >
      <AnimatePresence mode="popLayout">
        {activeToasts.map((toast) => (
          <TopMidPremiumToastItem
            key={toast.id}
            toast={toast}
            onDismiss={dismissToast}
          />
        ))}
      </AnimatePresence>
    </div>
  );
};

interface ItemProps {
  toast: ToastMessage;
  onDismiss: (id: string) => void;
}

const TopMidPremiumToastItem: React.FC<ItemProps> = ({ toast, onDismiss }) => {
  const duration = toast.duration || (toast.type === "error" ? 6000 : 4200);

  useEffect(() => {
    const timer = setTimeout(() => {
      onDismiss(toast.id);
    }, duration);
    return () => clearTimeout(timer);
  }, [toast.id, duration, onDismiss]);

  const isDelete = toast.type === "delete";
  const isError = toast.type === "error";
  const isInfo = toast.type === "info";
  const isLiveSuccess = !isDelete && !isError && !isInfo;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -25, scale: 0.92, filter: "blur(4px)" }}
      animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
      exit={{ opacity: 0, y: -20, scale: 0.94, filter: "blur(4px)" }}
      transition={{ type: "spring", damping: 26, stiffness: 380 }}
      className={`pointer-events-auto w-full rounded-2xl sm:rounded-3xl p-3.5 sm:p-4 shadow-2xl border backdrop-blur-2xl relative overflow-hidden transition-all select-none ${
        isDelete
          ? "bg-gradient-to-r from-[#200b0f]/95 via-[#160a14]/95 to-[#0b0f19]/95 text-white border-rose-500/40 ring-1 ring-rose-500/30 shadow-[0_12px_36px_rgba(244,63,94,0.3)]"
          : isError
          ? "bg-gradient-to-r from-[#280808]/95 via-[#180a0a]/95 to-[#0b0f19]/95 text-white border-red-500/50 ring-1 ring-red-500/35 shadow-[0_12px_36px_rgba(239,68,68,0.35)]"
          : isInfo
          ? "bg-gradient-to-r from-[#0b142e]/95 via-[#0e172a]/95 to-[#080d1a]/95 text-white border-indigo-500/40 ring-1 ring-indigo-500/30 shadow-[0_12px_36px_rgba(99,102,241,0.25)]"
          : "bg-gradient-to-r from-[#062015]/95 via-[#0b1926]/95 to-[#08121f]/95 text-white border-emerald-500/40 ring-1 ring-emerald-500/30 shadow-[0_12px_36px_rgba(16,185,129,0.3)]"
      }`}
    >
      {/* Top Meta Live Badge */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          {isDelete ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-500/15 border border-rose-500/30 text-rose-300">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-400 inline-block animate-pulse" />
              <span>Supabase Live Sync • Deleted</span>
            </span>
          ) : isError ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-red-500/15 border border-red-500/30 text-red-300">
              <span className="w-1.5 h-1.5 rounded-full bg-red-400 inline-block" />
              <span>Cloud Sync Notice</span>
            </span>
          ) : isInfo ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-indigo-500/15 border border-indigo-500/30 text-indigo-300">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 inline-block" />
              <span>Supabase Operations</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/15 border border-emerald-500/30 text-emerald-300">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400"></span>
              </span>
              <span>Supabase Live • Live in User App</span>
            </span>
          )}

          {toast.category && (
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-1">
              • {toast.category}
            </span>
          )}
        </div>

        {/* Dismiss Button */}
        <button
          onClick={() => onDismiss(toast.id)}
          className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors shrink-0 cursor-pointer"
          aria-label="Close notification"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Main Content Body */}
      <div className="flex items-start gap-3">
        {/* Left Status Icon */}
        <div
          className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl flex items-center justify-center shrink-0 border ${
            isDelete
              ? "bg-rose-500/20 text-rose-300 border-rose-500/30"
              : isError
              ? "bg-red-500/20 text-red-300 border-red-500/30"
              : isInfo
              ? "bg-indigo-500/20 text-indigo-300 border-indigo-500/30"
              : "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
          }`}
        >
          {isDelete ? (
            <Trash2 className="w-5 h-5" />
          ) : isError ? (
            <AlertTriangle className="w-5 h-5" />
          ) : isInfo ? (
            <Info className="w-5 h-5" />
          ) : (
            <CheckCircle2 className="w-5 h-5" />
          )}
        </div>

        {/* Title and Message */}
        <div className="flex-1 min-w-0 pr-1">
          <h4 className="text-xs sm:text-sm font-black tracking-tight leading-snug text-white flex items-center gap-1.5">
            <span>{toast.title}</span>
            {isLiveSuccess && <Sparkles className="w-3.5 h-3.5 text-amber-300 shrink-0 inline" />}
          </h4>
          <p className="text-[11px] sm:text-xs font-medium text-slate-300 mt-0.5 leading-relaxed break-words">
            {toast.message}
          </p>
        </div>
      </div>

      {/* Bottom Live Guarantee Sub-line */}
      <div className="mt-2.5 pt-2 border-t border-white/10 flex items-center justify-between text-[10px] sm:text-[11px] font-bold">
        <div className="flex items-center gap-1.5">
          {isDelete ? (
            <span className="text-rose-300 flex items-center gap-1">
              <span>✓</span>
              <span>यूजर ऐप से तुरंत रिमूव्ड (Live Sync)</span>
            </span>
          ) : isError ? (
            <span className="text-red-300 flex items-center gap-1">
              <span>!</span>
              <span>कृपया कनेक्शन की जांच करें</span>
            </span>
          ) : (
            <span className="text-emerald-300 flex items-center gap-1">
              <span>✓</span>
              <span>यूजर ऐप में तुरंत लाइव उपलब्ध (Live Sync)</span>
            </span>
          )}
        </div>
        <div className="text-slate-400 font-mono text-[9px] uppercase tracking-wider flex items-center gap-1">
          <Database className="w-2.5 h-2.5 text-emerald-400" />
          <span>PostgreSQL</span>
        </div>
      </div>

      {/* Bottom Progress Countdown Bar */}
      <motion.div
        initial={{ width: "100%" }}
        animate={{ width: "0%" }}
        transition={{ duration: duration / 1000, ease: "linear" }}
        className={`absolute bottom-0 left-0 h-0.5 ${
          isDelete
            ? "bg-rose-400"
            : isError
            ? "bg-red-400"
            : isInfo
            ? "bg-indigo-400"
            : "bg-emerald-400"
        }`}
      />
    </motion.div>
  );
};
