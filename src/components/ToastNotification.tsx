import React, { useEffect, useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  CheckCircle2, 
  AlertTriangle, 
  Info, 
  X, 
  Trash2
} from "lucide-react";
import { AdminToastPayload } from "../utils/adminToast";
import { playCorrectSound, playClickSound, triggerHaptic } from "../utils/audioFeedback";

export interface ToastMessage {
  id: string;
  type: "success" | "error" | "info" | "add" | "delete" | "update";
  title: string;
  message?: string;
  duration?: number; // ms
  itemName?: string;
  category?: string;
  count?: number;
}

interface ToastNotificationProps {
  toasts?: ToastMessage[];
  onDismiss?: (id: string) => void;
}

/**
 * Compact, Non-Obstructive Notification Toast Manager
 * - Max 1 active toast at a time (FIFO Queue)
 * - Auto-dismiss: 2s (success/add/update/delete/info), 4s (error)
 * - Compact Height: 48–56px
 * - Width: 90–94% on mobile
 * - Zero blockage of forms, buttons, chapter lists, topic lists
 * - Lightweight deduplication to prevent duplicate toasts for the same operation
 */
export const ToastNotificationContainer: React.FC<ToastNotificationProps> = ({ 
  toasts = [], 
  onDismiss 
}) => {
  const [currentToast, setCurrentToast] = useState<ToastMessage | null>(null);
  const queueRef = useRef<ToastMessage[]>([]);
  const recentFingerprintsRef = useRef<Map<string, number>>(new Map());
  const seenIdsRef = useRef<Set<string>>(new Set());

  // Dismiss current toast and dequeue next
  const dismissCurrentToast = useCallback((id: string) => {
    setCurrentToast((curr) => {
      if (curr && curr.id === id) {
        // Pop next toast from queue if available
        const next = queueRef.current.shift() || null;
        return next;
      }
      return curr;
    });
    onDismiss?.(id);
  }, [onDismiss]);

  // Enqueue new toast with deduplication
  const enqueueToast = useCallback((toast: ToastMessage) => {
    // Generate fingerprint for deduplication
    const textKey = (toast.title || toast.message || "").trim();
    const fingerprint = `${toast.type}_${textKey}_${toast.itemName || ""}`;
    const now = Date.now();
    const lastTimestamp = recentFingerprintsRef.current.get(fingerprint);

    // Suppress duplicates emitted within 1800ms
    if (lastTimestamp && now - lastTimestamp < 1800) {
      return;
    }
    recentFingerprintsRef.current.set(fingerprint, now);

    // Cleanup old fingerprint entries
    if (recentFingerprintsRef.current.size > 25) {
      recentFingerprintsRef.current.forEach((time, key) => {
        if (now - time > 4000) recentFingerprintsRef.current.delete(key);
      });
    }

    // Audio & haptic feedback
    if (toast.type === "delete") {
      playClickSound(true);
      triggerHaptic("warning", true);
    } else if (toast.type === "add" || toast.type === "success" || toast.type === "update") {
      playCorrectSound(true);
      triggerHaptic("success", true);
    }

    setCurrentToast((curr) => {
      if (curr === null) {
        return toast;
      } else {
        // If already showing a toast, queue this one (max 4 queued items)
        if (queueRef.current.length < 4) {
          queueRef.current.push(toast);
        }
        return curr;
      }
    });
  }, []);

  // Listen to external window events from adminToast & Supabase operations
  useEffect(() => {
    const handleAdminEvent = (e: Event) => {
      const customEvent = e as CustomEvent<AdminToastPayload>;
      if (!customEvent.detail) return;
      const detail = customEvent.detail;
      const id = "admin_toast_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6);

      // Auto-dismiss: 2s for success/actions, 4s for errors
      const duration = detail.type === "error" ? 4000 : 2000;

      enqueueToast({
        id,
        type: detail.type,
        title: detail.title,
        message: detail.message,
        itemName: detail.itemName,
        category: detail.category,
        count: detail.count,
        duration,
      });
    };

    window.addEventListener("disha2020_saved", handleAdminEvent);
    window.addEventListener("disha2020_admin_toast", handleAdminEvent);
    return () => {
      window.removeEventListener("disha2020_saved", handleAdminEvent);
      window.removeEventListener("disha2020_admin_toast", handleAdminEvent);
    };
  }, [enqueueToast]);

  // Sync prop toasts
  useEffect(() => {
    if (!toasts || toasts.length === 0) return;
    toasts.forEach((t) => {
      if (!seenIdsRef.current.has(t.id)) {
        if (seenIdsRef.current.size > 200) {
          const oldest = Array.from(seenIdsRef.current).slice(0, 100);
          oldest.forEach((id) => seenIdsRef.current.delete(id));
        }
        seenIdsRef.current.add(t.id);
        const duration = t.duration || (t.type === "error" ? 4000 : 2000);
        enqueueToast({ ...t, duration });
      }
    });
  }, [toasts, enqueueToast]);

  return (
    <div 
      className="fixed top-2 sm:top-3 inset-x-0 mx-auto z-[999999] pointer-events-none flex justify-center px-3"
      role="region"
      aria-live="polite"
      aria-label="Status Notifications"
    >
      <AnimatePresence mode="wait">
        {currentToast && (
          <CompactToastItem
            key={currentToast.id}
            toast={currentToast}
            onDismiss={dismissCurrentToast}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

interface ItemProps {
  toast: ToastMessage;
  onDismiss: (id: string) => void;
}

/**
 * Compact Toast Item:
 * - Height: 48–56px
 * - Width: 90–94% of mobile screen (w-[92%] sm:w-auto sm:min-w-[320px] sm:max-w-md)
 * - Icon: 18–20px
 * - Font: 12–13px
 * - Border radius: 12px
 * - Padding: 10px
 * - No oversized badges, no bloat, zero obstruction of working areas
 */
const CompactToastItem: React.FC<ItemProps> = ({ toast, onDismiss }) => {
  // Required: Auto-dismiss 2s for success/info/delete/add/update, 4s for error
  const duration = toast.duration || (toast.type === "error" ? 4000 : 2000);

  useEffect(() => {
    const timer = setTimeout(() => {
      onDismiss(toast.id);
    }, duration);
    return () => clearTimeout(timer);
  }, [toast.id, duration, onDismiss]);

  const isDelete = toast.type === "delete";
  const isError = toast.type === "error";
  const isInfo = toast.type === "info";

  // Construct concise display text (Title + optional highlight)
  const displayText = toast.itemName 
    ? `${toast.title}: ${toast.itemName}` 
    : toast.title || toast.message || "Operation completed";

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -18, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -12, scale: 0.96 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className={`pointer-events-auto w-[92%] sm:w-auto sm:min-w-[320px] sm:max-w-md min-h-[48px] max-h-[58px] rounded-[12px] p-[10px] shadow-lg backdrop-blur-md border flex items-center justify-between gap-2.5 transition-all select-none ${
        isDelete
          ? "bg-[#1f0b11]/95 text-white border-rose-500/40 shadow-rose-950/30"
          : isError
          ? "bg-[#240b0b]/95 text-white border-red-500/40 shadow-red-950/30"
          : isInfo
          ? "bg-[#0b1329]/95 text-white border-[#7045D8]/40 shadow-violet-950/30"
          : "bg-[#082015]/95 text-white border-emerald-500/40 shadow-emerald-950/30"
      }`}
    >
      {/* Left Icon (18–20px) */}
      <div className="shrink-0 flex items-center justify-center">
        {isDelete ? (
          <Trash2 className="w-[18px] h-[18px] text-rose-400" />
        ) : isError ? (
          <AlertTriangle className="w-[18px] h-[18px] text-red-400" />
        ) : isInfo ? (
          <Info className="w-[18px] h-[18px] text-[#A78BFA]" />
        ) : (
          <CheckCircle2 className="w-[18px] h-[18px] text-emerald-400" />
        )}
      </div>

      {/* Concise Notification Text (12–13px, max 2 lines, no oversized descriptions) */}
      <div className="flex-1 min-w-0 pr-1">
        <p className="text-[12px] sm:text-[13px] font-semibold text-white leading-tight truncate sm:whitespace-normal line-clamp-2">
          {displayText}
        </p>
      </div>

      {/* Small Close Button */}
      <button
        onClick={() => onDismiss(toast.id)}
        className="p-1 -mr-0.5 rounded-lg text-white/60 hover:text-white hover:bg-white/10 active:scale-95 transition-all shrink-0 cursor-pointer"
        aria-label="Close notification"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </motion.div>
  );
};
