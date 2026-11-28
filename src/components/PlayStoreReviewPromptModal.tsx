import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Star, X, Sparkles, ExternalLink, MessageSquareHeart, CheckCircle2, Send } from "lucide-react";
import { triggerHaptic } from "../utils/audioFeedback";
import { ratingReviewService } from "../utils/ratingReviewService";

interface PlayStoreReviewPromptModalProps {
  isOpen: boolean;
  onClose: () => void;
  appPackageName?: string;
  userScorePercent?: number;
}

export const PlayStoreReviewPromptModal: React.FC<PlayStoreReviewPromptModalProps> = ({
  isOpen,
  onClose,
  appPackageName = "com.rajexam.prep",
  userScorePercent,
}) => {
  const [rating, setRating] = useState<number>(5);
  const [feedbackText, setFeedbackText] = useState<string>("");
  const [feedbackSent, setFeedbackSent] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      setRating(5);
      setFeedbackText("");
      setFeedbackSent(false);
    }
  }, [isOpen]);

  const handleOpenPlayStore = () => {
    triggerHaptic();
    ratingReviewService.markAsReviewed();

    const playStoreUrl = `market://details?id=${appPackageName}`;
    const webFallbackUrl = `https://play.google.com/store/apps/details?id=${appPackageName}`;

    try {
      window.location.href = playStoreUrl;
      setTimeout(() => {
        window.open(webFallbackUrl, "_blank");
      }, 500);
    } catch {
      window.open(webFallbackUrl, "_blank");
    }

    onClose();
  };

  const handleSendFeedback = () => {
    triggerHaptic();
    // Snooze so we do not bother user immediately
    ratingReviewService.snoozePrompt(10);
    setFeedbackSent(true);
    setTimeout(() => {
      onClose();
    }, 1500);
  };

  const handleRemindLater = () => {
    triggerHaptic();
    ratingReviewService.snoozePrompt(5);
    onClose();
  };

  if (!isOpen) return null;

  const isHighRating = rating >= 4;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[160] flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/75 backdrop-blur-xs"
          onClick={handleRemindLater}
        />

        {/* Modal Card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          className="relative w-full max-w-sm bg-white dark:bg-[#1A1435] rounded-3xl p-6 shadow-2xl border border-slate-200 dark:border-[#31275E] z-10 text-center select-none"
        >
          {/* Close / Snooze Button */}
          <button
            onClick={handleRemindLater}
            className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-[#251D4B] transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X size={18} />
          </button>

          {/* Icon Badge */}
          <div className="w-16 h-16 mx-auto mb-3.5 rounded-2xl bg-gradient-to-tr from-amber-500 via-yellow-400 to-amber-500 flex items-center justify-center text-white shadow-lg shadow-amber-500/30">
            {isHighRating ? (
              <Sparkles size={32} className="animate-pulse" />
            ) : (
              <MessageSquareHeart size={30} />
            )}
          </div>

          {/* Heading */}
          <h3 className="text-lg font-black text-slate-900 dark:text-white mb-1.5">
            {isHighRating
              ? userScorePercent
                ? `शानदार प्रदर्शन (${userScorePercent}%)!`
                : "Enjoying Disha PYQ?"
              : "हमें बेहतर बनाने में मदद करें"}
          </h3>

          <p className="text-xs text-slate-600 dark:text-slate-300 mb-5 leading-relaxed font-medium">
            {isHighRating
              ? "आपकी 5-स्टार रेटिंग राजस्थान के लाखों विद्यार्थियों तक यह फ्री PYQ व मॉक टेस्ट प्लेटफॉर्म पहुँचाने में मदद करती है!"
              : "हमें खेद है कि आपका अनुभव मनपसंद नहीं रहा। कृपया बताएं हम क्या सुधार कर सकते हैं ताकि अगली बार आपको सर्वश्रेष्ठ अनुभव मिले:"}
          </p>

          {/* Interactive 5-Star Rating Row */}
          <div className="flex justify-center items-center gap-2 mb-6">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                onClick={() => {
                  triggerHaptic();
                  setRating(star);
                }}
                className="p-1 transition-transform hover:scale-125 active:scale-95 cursor-pointer"
                title={`${star} Star`}
              >
                <Star
                  size={34}
                  className={
                    star <= rating
                      ? "text-amber-400 fill-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.6)]"
                      : "text-slate-200 dark:text-slate-700"
                  }
                />
              </button>
            ))}
          </div>

          {/* Smart Sentiment Branching */}
          {isHighRating ? (
            /* High Rating (4-5 Stars) -> Direct to Play Store */
            <div className="space-y-3">
              <button
                onClick={handleOpenPlayStore}
                className="w-full py-4 px-4 bg-gradient-to-r from-[#7045D8] via-[#5B32BF] to-[#7045D8] hover:brightness-110 text-white rounded-2xl font-black text-xs uppercase tracking-wider shadow-xl shadow-[#7045D8]/25 flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-98"
              >
                <span>Rate 5-Stars on Play Store</span>
                <ExternalLink size={16} />
              </button>

              <button
                onClick={handleRemindLater}
                className="w-full py-2 text-xs text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 font-bold transition-colors cursor-pointer"
              >
                बाद में याद दिलाएं (Remind Later)
              </button>
            </div>
          ) : feedbackSent ? (
            /* Low Rating Feedback Acknowledged */
            <div className="py-4 space-y-2 bg-emerald-50 dark:bg-emerald-950/30 rounded-2xl border border-emerald-200 dark:border-emerald-800/40 text-emerald-800 dark:text-emerald-300">
              <CheckCircle2 className="w-6 h-6 mx-auto text-emerald-500" />
              <p className="text-xs font-bold">धन्यवाद! आपका सुझाव प्राप्त हो गया है।</p>
            </div>
          ) : (
            /* Low Rating (1-3 Stars) -> Internal Feedback to Protect Play Store Score */
            <div className="space-y-3 text-left">
              <textarea
                value={feedbackText}
                onChange={(e) => setFeedbackText(e.target.value)}
                placeholder="उदा. प्रश्न में त्रुटि, ऐप स्लो होना, या कोई अन्य सुझाव..."
                rows={3}
                className="w-full p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-[#7045D8]"
              />
              <button
                onClick={handleSendFeedback}
                className="w-full py-3 px-4 bg-[#7045D8] hover:bg-[#5B32BF] text-white rounded-xl font-black text-xs flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-98"
              >
                <Send size={14} />
                <span>सुझाव सबमिट करें (Submit Feedback)</span>
              </button>
              <button
                onClick={handleRemindLater}
                className="w-full text-center py-1.5 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 font-bold cursor-pointer"
              >
                रद्द करें (Cancel)
              </button>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
