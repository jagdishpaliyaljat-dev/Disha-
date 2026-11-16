import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { CloudCheck, CheckCircle2, Sparkles, Check, Database } from "lucide-react";
import { FirebaseSavedEventPayload } from "../utils/adminToast";

interface BannerState extends FirebaseSavedEventPayload {
  id: number;
}

/**
 * Ultra-Premium Top-Center (Top-Mid) Pill Popup for Firebase/Database Saves
 * Appears when any item is added or saved from Admin Panel.
 * Communicates clearly that data is securely stored in Firebase & Database and live to users.
 * Automatically auto-dismisses after 1.8 seconds (satisfies 1-2 Sec only requirement).
 */
export const FirebaseSavedBanner: React.FC = () => {
  const [current, setCurrent] = useState<BannerState | null>(null);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;

    const handleSavedEvent = (e: Event) => {
      const customEvent = e as CustomEvent<FirebaseSavedEventPayload>;
      const detail = customEvent.detail || {};

      if (timer) clearTimeout(timer);

      setCurrent({
        id: Date.now(),
        title: detail.title || "Saved Securely to Supabase Database!",
        message:
          detail.message ||
          "Data successfully persisted to Supabase PostgreSQL and immediately live for users.",
        itemName: detail.itemName,
        category: detail.category,
        count: detail.count,
      });

      // 1.8 Seconds auto-dismissal (Strict 1-2 sec requirement)
      timer = setTimeout(() => {
        setCurrent(null);
      }, 1800);
    };

    window.addEventListener("quizpro_firebase_saved", handleSavedEvent);

    return () => {
      if (timer) clearTimeout(timer);
      window.removeEventListener("quizpro_firebase_saved", handleSavedEvent);
    };
  }, []);

  return (
    <div
      aria-live="assertive"
      className="fixed top-3 sm:top-5 left-1/2 -translate-x-1/2 z-[9999999] pointer-events-none flex flex-col items-center w-full max-w-md px-3 sm:px-4"
    >
      <AnimatePresence mode="wait">
        {current && (
          <motion.div
            key={current.id}
            initial={{ opacity: 0, y: -24, scale: 0.92, filter: "blur(6px)" }}
            animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: -16, scale: 0.94, filter: "blur(4px)" }}
            transition={{ type: "spring", stiffness: 420, damping: 28, mass: 0.8 }}
            className="pointer-events-auto w-auto max-w-full rounded-2xl p-1 bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-500 shadow-[0_12px_40px_-8px_rgba(16,185,129,0.55),0_4px_16px_rgba(0,0,0,0.3)]"
          >
            <div className="flex items-center gap-2.5 sm:gap-3 px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-[14px] bg-slate-950/95 backdrop-blur-xl border border-emerald-500/30 text-white">
              {/* Glowing animated Cloud / Check badge */}
              <div className="relative shrink-0 flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-600 text-slate-950 shadow-md shadow-emerald-500/40">
                <CloudCheck className="w-5 h-5 sm:w-5.5 sm:h-5.5 stroke-[2.4]" />
                <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-80" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-300" />
                </span>
              </div>

              {/* Text Information */}
              <div className="flex flex-col min-w-0 pr-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[11px] sm:text-xs font-black tracking-tight text-white flex items-center gap-1">
                    <span>{current.title}</span>
                    <Sparkles className="w-3 h-3 text-emerald-400 fill-emerald-400" />
                  </span>
                  <span className="px-1.5 py-0.2 rounded-md bg-emerald-500/20 text-emerald-300 font-mono text-[9px] font-black uppercase tracking-wider border border-emerald-400/30">
                    LIVE NOW
                  </span>
                </div>

                <p className="text-[10px] sm:text-[11px] font-medium text-slate-300 leading-tight truncate max-w-[280px] sm:max-w-xs mt-0.5 font-hindi">
                  {current.message}
                </p>
              </div>

              {/* Verified Mini Pill */}
              <div className="hidden sm:flex items-center gap-1 shrink-0 px-2 py-1 rounded-lg bg-emerald-950/70 border border-emerald-500/40 text-[10px] font-bold text-emerald-300">
                <Database className="w-3 h-3 text-emerald-400" />
                <span>Saved</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
