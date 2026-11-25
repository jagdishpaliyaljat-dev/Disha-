import React, { useState } from "react";
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { WifiOff, ShieldCheck, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();
  const [dismissed, setDismissed] = useState(false);
  const [cachedCount, setCachedCount] = useState<number | null>(null);

  React.useEffect(() => {
    if (!isOnline) {
      import('../utils/questionBankCache').then(({ getQuestionBankCacheStats }) => {
        getQuestionBankCacheStats().then((stats) => {
          if (stats.totalQuestions > 0) {
            setCachedCount(stats.totalQuestions);
          }
        }).catch(() => {});
      }).catch(() => {});
    }
  }, [isOnline]);

  if (dismissed || isOnline) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        className="px-4 py-2.5 shadow-md border-b sticky top-0 z-[90] text-xs font-medium bg-[#7045D8] border-[#A78BFA]/40 text-white"
      >
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded-lg bg-[#7045D8] flex items-center justify-center shrink-0">
              <WifiOff className="w-3.5 h-3.5 text-white" />
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
              <span className="font-bold tracking-wide">
                You are Offline
              </span>
              <span className="hidden sm:inline text-white/60">·</span>
              <span className="text-white/90 flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 inline opacity-85 text-amber-500" />
                {cachedCount 
                  ? `Offline Practice Active: ${cachedCount.toLocaleString()} MCQs cached locally.`
                  : "Offline Mode active: Cached MCQs & syllabus remain available."}
              </span>
            </div>
          </div>
          <button
            onClick={() => setDismissed(true)}
            className="p-1 hover:bg-white/15 rounded-lg transition shrink-0 cursor-pointer text-white/80 hover:text-white"
            title="Dismiss notification"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
