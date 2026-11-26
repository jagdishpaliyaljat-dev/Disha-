import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Star, Heart, X, Sparkles, ExternalLink } from "lucide-react";
import { triggerHaptic } from "../utils/audioFeedback";

interface PlayStoreReviewPromptModalProps {
  isOpen: boolean;
  onClose: () => void;
  appPackageName?: string;
}

export const PlayStoreReviewPromptModal: React.FC<PlayStoreReviewPromptModalProps> = ({
  isOpen,
  onClose,
  appPackageName = "com.disha2020.examprep",
}) => {
  const [rating, setRating] = useState<number>(5);
  const [hasRated, setHasRated] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      setRating(5);
      setHasRated(false);
    }
  }, [isOpen]);

  const handleOpenPlayStore = () => {
    triggerHaptic();
    const playStoreUrl = `market://details?id=${appPackageName}`;
    const webFallbackUrl = `https://play.google.com/store/apps/details?id=${appPackageName}`;

    // Mark as reviewed in localStorage to prevent spamming
    try {
      localStorage.setItem("disha_playstore_reviewed", "true");
    } catch (e) {
      // ignore
    }

    // Try market protocol, then web fallback
    window.location.href = playStoreUrl;
    setTimeout(() => {
      window.open(webFallbackUrl, "_blank");
    }, 500);

    onClose();
  };

  const handleRemindLater = () => {
    triggerHaptic();
    try {
      // Remind after 3 days
      const remindDate = Date.now() + 3 * 24 * 60 * 60 * 1000;
      localStorage.setItem("disha_review_prompt_snooze", remindDate.toString());
    } catch (e) {
      // ignore
    }
    onClose();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
        <div
          className="fixed inset-0 bg-black/75 backdrop-blur-xs"
          onClick={handleRemindLater}
        />
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          className="relative w-full max-w-sm bg-white dark:bg-[#1A1435] rounded-3xl p-6 shadow-2xl border border-slate-200 dark:border-[#31275E] z-10 text-center"
        >
          {/* Close button */}
          <button
            onClick={handleRemindLater}
            className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-[#251D4B] transition-colors"
          >
            <X size={18} />
          </button>

          {/* Icon Badge */}
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-300 flex items-center justify-center text-white shadow-lg shadow-amber-500/30">
            <Sparkles size={32} className="animate-pulse" />
          </div>

          <h3 className="text-lg font-black text-slate-900 dark:text-white mb-1.5">
            Enjoying Disha PYQ?
          </h3>
          <p className="text-xs text-slate-600 dark:text-slate-300 mb-5 leading-relaxed">
            आपकी 5-स्टार रेटिंग राजस्थान के लाखों विद्यार्थियों तक यह फ्री PYQ प्लेटफ़ॉर्म पहुँचाने में मदद करती है!
          </p>

          {/* Interactive 5-star rating */}
          <div className="flex justify-center gap-2 mb-6">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                onClick={() => {
                  triggerHaptic();
                  setRating(star);
                  setHasRated(true);
                }}
                className="p-1 transition-transform hover:scale-125 active:scale-95 cursor-pointer"
              >
                <Star
                  size={32}
                  className={
                    star <= rating
                      ? "text-amber-400 fill-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.6)]"
                      : "text-slate-300 dark:text-slate-600"
                  }
                />
              </button>
            ))}
          </div>

          {/* Action Button */}
          <button
            onClick={handleOpenPlayStore}
            className="w-full py-3.5 px-4 bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-600 hover:to-orange-600 text-white rounded-2xl font-black text-sm shadow-xl shadow-amber-500/25 flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-98"
          >
            <span>Rate 5-Stars on Play Store</span>
            <ExternalLink size={16} />
          </button>

          <button
            onClick={handleRemindLater}
            className="mt-3 text-xs text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 font-bold transition-colors"
          >
            Remind me later
          </button>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
