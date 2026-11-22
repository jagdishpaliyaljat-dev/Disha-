import React, { useEffect } from "react";
import { 
  X, 
  Sparkles, 
  CheckCircle2, 
  GraduationCap, 
  BookOpen, 
  Target, 
  TrendingUp, 
  FileText, 
  Users, 
  ArrowRight,
  ShieldCheck
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { UserProfile } from "../../types";
import { triggerHaptic, playClickSound } from "../../utils/audioFeedback";

export interface PremiumUpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser?: UserProfile | null;
  featureTrigger?: "ai_tutor" | "mock_tests" | "profile" | "general" | "pdf_export" | "live_battle" | "mistake_bank" | "state_merit_rank";
  onSuccess?: () => void;
  onOpenLogin?: () => void;
}

export const PremiumUpgradeModal: React.FC<PremiumUpgradeModalProps> = ({
  isOpen,
  onClose,
}) => {
  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleDismiss = () => {
    triggerHaptic("light");
    playClickSound();
    onClose();
  };

  const unlockedFeatures = [
    {
      icon: <GraduationCap className="w-5 h-5 text-emerald-500 shrink-0" />,
      title: "Disha AI Tutor 24×7",
      desc: "कठिन प्रश्नों का तत्काल समाधान और विस्तृत व्याख्या, असीमित उपयोग।",
    },
    {
      icon: <Target className="w-5 h-5 text-emerald-500 shrink-0" />,
      title: "सभी Mock Tests & Test Series",
      desc: "RPSC & RSMSSB के सभी आगामी व पिछले वर्षों के टेस्ट पेपर्स पूर्णतः अनलॉक।",
    },
    {
      icon: <TrendingUp className="w-5 h-5 text-emerald-500 shrink-0" />,
      title: "State-Level Merit Ranking",
      desc: "पूरे राजस्थान के हजारों अभ्यर्थियों के बीच अपनी वास्तविक रैंक और परसेंटाइल देखें।",
    },
    {
      icon: <BookOpen className="w-5 h-5 text-emerald-500 shrink-0" />,
      title: "मिस्टेक बैंक व रिवीजन वॉल्ट",
      desc: "गलत हुए प्रश्नों का ऑटो-रिवीजन और स्पेस रिपीटिशन बिना किसी रोकटोक।",
    },
    {
      icon: <FileText className="w-5 h-5 text-emerald-500 shrink-0" />,
      title: "PDF टेस्ट पेपर एक्सपोर्ट",
      desc: "प्रिंट-योग्य प्रश्न-पत्र और व्याख्या शीट कभी भी निःशुल्क डाउनलोड करें।",
    },
    {
      icon: <Users className="w-5 h-5 text-emerald-500 shrink-0" />,
      title: "1v1 लाइव बैटल मोड",
      desc: "मित्रों और सहपाठियों के साथ रियल-टाइम क्विज़ मुकाबला असीमित खेलें।",
    },
  ];

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.2 }}
          className="relative w-full max-w-lg bg-white dark:bg-[#171329] rounded-3xl border border-emerald-500/30 dark:border-emerald-500/40 shadow-2xl overflow-hidden"
        >
          {/* Header Banner */}
          <div className="relative p-6 bg-gradient-to-br from-emerald-600 via-teal-600 to-[#7045D8] text-white overflow-hidden">
            <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-white/10 rounded-full blur-2xl pointer-events-none" />

            <button
              onClick={handleDismiss}
              className="absolute top-4 right-4 p-2 rounded-full bg-black/20 hover:bg-black/30 text-white transition-all cursor-pointer"
              aria-label="Close"
            >
              <X size={18} />
            </button>

            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 backdrop-blur-md text-[11px] font-black uppercase tracking-wider mb-3">
              <Sparkles size={13} className="text-amber-300" />
              <span>100% निःशुल्क शिक्षा पहल</span>
            </div>

            <h2 className="text-xl sm:text-2xl font-black leading-tight">
              दिशा PYQ सभी छात्रों के लिए आजीवन मुफ़्त है!
            </h2>
            <p className="text-xs sm:text-sm text-emerald-50 mt-1.5 font-medium leading-relaxed">
              कोई सब्सक्रिप्शन नहीं, कोई पेवॉल नहीं। राजस्थान के हर परीक्षार्थी को गुणवत्तापूर्ण तैयारी का पूरा अधिकार है।
            </p>
          </div>

          {/* Features List */}
          <div className="p-5 sm:p-6 space-y-3 max-h-[50vh] overflow-y-auto">
            <div className="flex items-center gap-2 mb-2 text-xs font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
              <ShieldCheck size={16} />
              <span>सभी सुविधाएं पूर्णतः अनलॉक हैं:</span>
            </div>

            {unlockedFeatures.map((feat, idx) => (
              <div
                key={idx}
                className="flex items-start gap-3 p-3 rounded-2xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200/50 dark:border-emerald-800/30"
              >
                <div className="p-2 rounded-xl bg-white dark:bg-[#1e1b38] shadow-xs">
                  {feat.icon}
                </div>
                <div>
                  <h4 className="text-xs sm:text-sm font-extrabold text-slate-800 dark:text-white flex items-center gap-1.5">
                    {feat.title}
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 inline" />
                  </h4>
                  <p className="text-[11px] sm:text-xs text-slate-600 dark:text-slate-300 mt-0.5">
                    {feat.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Bottom Action */}
          <div className="p-4 sm:p-5 bg-slate-50 dark:bg-[#130f24] border-t border-slate-200 dark:border-stone-800 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="text-center sm:text-left">
              <div className="text-xs font-black text-emerald-600 dark:text-emerald-400">
                ₹0 • आजीवन मुफ़्त
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400">
                कोई शुल्क या रिन्यूअल नहीं लगेगा
              </div>
            </div>

            <button
              onClick={handleDismiss}
              className="w-full sm:w-auto px-6 py-3 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-extrabold text-xs sm:text-sm shadow-lg shadow-emerald-600/30 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>अभ्यास शुरू करें</span>
              <ArrowRight size={16} />
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default PremiumUpgradeModal;
