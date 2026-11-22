import React from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Trophy,
  LogIn,
  X,
  Sparkles,
  BookmarkCheck,
  TrendingUp,
  ShieldCheck,
  CheckCircle2,
  ArrowRight
} from "lucide-react";
import { triggerHaptic, playClickSound } from "../utils/audioFeedback";

export interface GuestLoginPromptModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLogin: () => void;
  testTitle?: string;
  scoreSummary?: {
    correct: number;
    total: number;
    accuracy?: number;
  };
}

export const GuestLoginPromptModal: React.FC<GuestLoginPromptModalProps> = ({
  isOpen,
  onClose,
  onLogin,
  testTitle,
  scoreSummary,
}) => {
  if (!isOpen) return null;

  const handleLoginClick = () => {
    triggerHaptic("medium");
    playClickSound();
    onClose();
    onLogin();
  };

  const handleDismissClick = () => {
    triggerHaptic("light");
    onClose();
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={handleDismissClick}
          className="fixed inset-0 bg-black/65 backdrop-blur-sm transition-opacity"
        />

        {/* Modal Dialog */}
        <motion.div
          initial={{ opacity: 0, scale: 0.92, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.92, y: 20 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className="relative w-full max-w-md bg-[#FFF9EF] dark:bg-[#1E2330] rounded-3xl p-5 sm:p-6 border border-[#E8D9C0] dark:border-[#31374A] shadow-2xl text-[#171923] dark:text-[#FFF9EF] z-10 overflow-hidden"
          role="dialog"
          aria-modal="true"
        >
          {/* Top Decorative Glow */}
          <div className="absolute top-0 right-0 -mr-16 -mt-16 w-44 h-44 rounded-full bg-gradient-to-br from-[#F47B20]/25 to-[#800020]/20 blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 -ml-16 -mb-16 w-44 h-44 rounded-full bg-gradient-to-tr from-amber-400/20 to-transparent blur-3xl pointer-events-none" />

          {/* Close / Skip button */}
          <button
            type="button"
            onClick={handleDismissClick}
            className="absolute top-3.5 right-3.5 p-2 rounded-xl text-[#52576A] dark:text-[#929AB0] hover:bg-[#F0E6D2] dark:hover:bg-[#2A3042] transition-colors cursor-pointer"
            aria-label="Skip for now"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="relative z-10 flex flex-col items-center text-center">
            {/* Achievement Trophy Icon */}
            <div className="relative mb-3.5">
              <div className="w-16 h-16 sm:w-18 sm:h-18 rounded-2xl bg-gradient-to-br from-amber-400 to-[#F47B20] text-white flex items-center justify-center shadow-lg shadow-[#F47B20]/30 transform -rotate-3 hover:rotate-0 transition-transform">
                <Trophy className="w-8 h-8 sm:w-9 sm:h-9" />
              </div>
              <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-[#800020] text-amber-300 border-2 border-white dark:border-[#1E2330] flex items-center justify-center">
                <Sparkles className="w-3.5 h-3.5" />
              </div>
            </div>

            {/* Title & Badge */}
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider bg-[#F47B20]/15 text-[#C85A0A] dark:text-[#F47B20] border border-[#F47B20]/25 mb-2">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>अभ्यास संपन्न • Test Complete</span>
            </div>

            <h3 className="text-lg sm:text-xl font-black text-[#171923] dark:text-[#FFF9EF] leading-snug">
              शानदार प्रयास! अपना स्कोर सुरक्षित करें
            </h3>

            {/* Test Title / Score Summary */}
            {scoreSummary ? (
              <div className="mt-2 px-3 py-1.5 rounded-xl bg-white/80 dark:bg-[#171923]/80 border border-[#E8D9C0] dark:border-[#31374A] flex items-center gap-2 text-xs font-bold text-[#800020] dark:text-amber-400">
                <span>स्कोर: {scoreSummary.correct} / {scoreSummary.total} सही</span>
                {scoreSummary.accuracy !== undefined && (
                  <>
                    <span className="text-slate-300 dark:text-slate-600">•</span>
                    <span>{scoreSummary.accuracy}% सटीकता</span>
                  </>
                )}
              </div>
            ) : testTitle ? (
              <p className="text-xs font-semibold text-[#52576A] dark:text-[#929AB0] mt-1 truncate max-w-full">
                {testTitle}
              </p>
            ) : null}

            <p className="text-xs text-[#52576A] dark:text-[#CBD2E1] mt-2.5 leading-relaxed max-w-sm">
              आप वर्तमान में <span className="font-bold text-[#800020] dark:text-[#F47B20]">अतिथि (Guest)</span> के रूप में अभ्यास कर रहे हैं। अपना टेस्ट इतिहास, राज्य स्तरीय रैंक और गलत उत्तर हमेशा के लिए सुरक्षित करने हेतु लॉगिन करें।
            </p>

            {/* 3 Key Benefits */}
            <div className="w-full mt-4 space-y-2.5 text-left bg-white/70 dark:bg-[#171923]/60 rounded-2xl p-3.5 border border-[#E8D9C0] dark:border-[#31374A]/80">
              <div className="flex items-start gap-2.5">
                <div className="w-6 h-6 rounded-lg bg-amber-500/15 text-amber-700 dark:text-amber-400 flex items-center justify-center shrink-0 mt-0.5">
                  <TrendingUp className="w-3.5 h-3.5" />
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="text-[12px] font-bold text-[#171923] dark:text-white leading-tight">
                    ऑल-राजस्थान मेरिट व लाइव रैंक
                  </h4>
                  <p className="text-[10.5px] text-[#52576A] dark:text-[#929AB0] leading-tight mt-0.5">
                    सैकड़ों अभ्यर्थियों के बीच अपनी राज्यस्तरीय स्थिति जानें।
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <div className="w-6 h-6 rounded-lg bg-[#800020]/15 text-[#800020] dark:text-[#F47B20] flex items-center justify-center shrink-0 mt-0.5">
                  <BookmarkCheck className="w-3.5 h-3.5" />
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="text-[12px] font-bold text-[#171923] dark:text-white leading-tight">
                    मिस्टेक बैंक (गलत प्रश्नों का ऑटो-रिवीज़न)
                  </h4>
                  <p className="text-[10.5px] text-[#52576A] dark:text-[#929AB0] leading-tight mt-0.5">
                    गलत प्रश्नों को बाद में दोबारा हल करने हेतु सेव रखें।
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <div className="w-6 h-6 rounded-lg bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                  <ShieldCheck className="w-3.5 h-3.5" />
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="text-[12px] font-bold text-[#171923] dark:text-white leading-tight">
                    सुरक्षित क्लाउड सिंक
                  </h4>
                  <p className="text-[10.5px] text-[#52576A] dark:text-[#929AB0] leading-tight mt-0.5">
                    फ़ोन बदलने या ऐप अपडेट पर आपकी तैयारी कभी नष्ट नहीं होगी।
                  </p>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="w-full mt-4 space-y-2">
              <button
                type="button"
                onClick={handleLoginClick}
                className="w-full py-3 px-4 rounded-2xl bg-gradient-to-r from-[#800020] to-[#B31942] hover:brightness-110 active:scale-98 text-white text-xs sm:text-sm font-black flex items-center justify-center gap-2 shadow-md shadow-[#800020]/25 transition-all cursor-pointer"
              >
                <LogIn className="w-4 h-4" />
                <span>लॉगिन करें / मुफ़्त खाता बनाएं</span>
                <ArrowRight className="w-4 h-4 ml-0.5" />
              </button>

              <button
                type="button"
                onClick={handleDismissClick}
                className="w-full py-2.5 px-3 rounded-xl bg-transparent hover:bg-black/5 dark:hover:bg-white/5 text-[#52576A] dark:text-[#929AB0] text-xs font-bold transition-all cursor-pointer"
              >
                परिणाम देखें (बाद में लॉगिन करेंगे)
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
