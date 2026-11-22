import React, { useState, useEffect } from "react";
import { 
  X, 
  Crown, 
  CheckCircle2, 
  Sparkles, 
  Zap, 
  ShieldCheck, 
  Check, 
  Flame, 
  Loader2, 
  Award,
  Star,
  CheckCheck,
  CreditCard,
  Lock,
  ChevronDown,
  ChevronUp,
  HelpCircle,
  Smartphone,
  AlertTriangle,
  LogIn,
  ArrowRight,
  GraduationCap,
  BookOpen,
  Target,
  TrendingUp,
  RefreshCw,
  FileText,
  Users,
  BadgeCheck,
  Clock
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { PREMIUM_PLANS, PremiumPlan, initiateCashfreePayment, getPremiumPlansList } from "../../services/payment/cashfreeService";
import { UserProfile } from "../../types";
import { isProfileAuthenticated } from "../../utils/userProfileStorage";
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
  currentUser,
  featureTrigger = "general",
  onSuccess,
  onOpenLogin,
}) => {
  const [plans, setPlans] = useState<PremiumPlan[]>(() => getPremiumPlansList());
  const [selectedPlanId, setSelectedPlanId] = useState<string>("trial_weekly");

  // Cashfree state
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSuccessState, setIsSuccessState] = useState(false);
  const [showComparison, setShowComparison] = useState(false);
  const [activeTab, setActiveTab] = useState<"all" | "trial" | "full">("all");

  // Sync dynamic plans from Admin Panel / Supabase
  useEffect(() => {
    const handleConfigUpdate = (e: any) => {
      if (e.detail?.plans) {
        setPlans(e.detail.plans.filter((p: any) => p.enabled !== false));
      } else {
        setPlans(getPremiumPlansList());
      }
    };

    if (typeof window !== "undefined") {
      window.addEventListener("disha_premium_config_updated", handleConfigUpdate);
    }
    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("disha_premium_config_updated", handleConfigUpdate);
      }
    };
  }, []);

  // Set default plan selection if trial exists
  useEffect(() => {
    if (plans.some((p) => p.id === "trial_weekly")) {
      setSelectedPlanId("trial_weekly");
    } else if (plans.some((p) => p.id === "yearly")) {
      setSelectedPlanId("yearly");
    } else if (plans.length > 0) {
      setSelectedPlanId(plans[0].id);
    }
  }, [plans]);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen && !isProcessing) {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isProcessing, onClose]);

  if (!isOpen) return null;

  const isAlreadyPremium = Boolean(currentUser?.isPremium);
  const isAuth = isProfileAuthenticated(currentUser || null);
  const selectedPlan = plans.find((p) => p.id === selectedPlanId) || plans[0] || PREMIUM_PLANS[0];

  const handleSelectPlan = (planId: string) => {
    if (isProcessing) return;
    triggerHaptic("light");
    playClickSound();
    setSelectedPlanId(planId);
  };

  // Cashfree Checkout (Official & Exclusive)
  const handlePay = async () => {
    if (!isAuth) {
      triggerHaptic("warning");
      setErrorMessage("पेमेंट करने से पहले कृपया अपनी छात्र प्रोफाइल में लॉगिन करें।");
      onOpenLogin?.();
      return;
    }

    triggerHaptic("medium");
    playClickSound();
    setErrorMessage(null);
    setIsProcessing(true);

    const result = await initiateCashfreePayment(selectedPlanId, currentUser, (status, msg) => {
      setStatusMessage(msg || "");
    });

    if (result.isPremium) {
      setIsProcessing(false);
      triggerHaptic("success");
      setIsSuccessState(true);
      setTimeout(() => {
        onSuccess?.();
        onClose();
      }, 2500);
    } else if (result.success) {
      setStatusMessage("आधिकारिक Cashfree पेमेंट गेटवे खोला जा रहा है...");
      // Keep isProcessing true so the user is aware redirection is in progress
    } else if (result.error) {
      setIsProcessing(false);
      triggerHaptic("warning");
      setErrorMessage(result.error);
    } else {
      setIsProcessing(false);
    }
  };

  const getHeadlineForTrigger = () => {
    switch (featureTrigger) {
      case "ai_tutor":
        return {
          badge: "24x7 AI डाउट सॉल्वर • असीमित एक्सेस",
          title: "Disha AI Tutor को असीमित अनलॉक करें",
          subtitle: "राजस्थान प्रतियोगी परीक्षाओं के कठिन प्रश्नों का तत्काल हिंदी समाधान व चरणबद्ध व्याख्या पाएं",
        };
      case "mock_tests":
        return {
          badge: "RPSC व RSMSSB टेस्ट सीरीज़ • 500+ पेपर्स",
          title: "सभी मॉक टेस्ट पेपर्स व लाइव टेस्ट अनलॉक करें",
          subtitle: "राज्य-स्तरीय मेरिट रैंक, परसेंटाइल और नवीनतम परीक्षा पैटर्न पर आधारित पूर्ण अभ्यास",
        };
      case "pdf_export":
        return {
          badge: "A4 प्रिंटेबल टेस्ट पेपर्स • ऑफ़लाइन अध्ययन",
          title: "PDF टेस्ट पेपर्स व क्वेश्चन बैंक डाउनलोड करें",
          subtitle: "बिना स्क्रीन के वास्तविक परीक्षा जैसा अभ्यास करने के लिए संपूर्ण व्याख्या सहित पेपर्स प्रिंट करें",
        };
      case "live_battle":
        return {
          badge: "1v1 लाइव क्विज़ मुकाबला • रियल-टाइम लीडरबोर्ड",
          title: "1v1 लाइव क्विज़ मुकाबला रूम अनलॉक करें",
          subtitle: "साथी अभ्यर्थियों के साथ रियल-टाइम क्विज़ चैलेंज और स्पीड-एक्यूरेसी मुकाबला खेलें",
        };
      case "mistake_bank":
        return {
          badge: "स्मार्ट मिस्टेक बैंक • वैज्ञानिक रिवीज़न",
          title: "मिस्टेक बैंक व कमजोर टॉपिक रिवीज़न अनलॉक करें",
          subtitle: "जो प्रश्न गलत हुए उनका वैज्ञानिक अंतराल (Spaced Repetition) पद्धति से स्वतः रिवीज़न करें",
        };
      case "state_merit_rank":
        return {
          badge: "ऑल-राजस्थान मेरिट रैंक • लाइव परसेंटाइल",
          title: "अखिल राजस्थान रियल-टाइम मेरिट रैंक अनलॉक करें",
          subtitle: "हजारों अभ्यर्थियों के बीच अपनी सटीक रैंक, परसेंटाइल और विषयवार तुलनात्मक रिपोर्ट देखें",
        };
      default:
        return {
          badge: "दिशा 20-20 अकादमी • आधिकारिक छात्र पास",
          title: "दिशा VIP प्रीमियम पास में अपग्रेड करें",
          subtitle: "राजस्थान की सभी प्रतियोगी परीक्षाओं में सफलता सुनिश्चित करने वाला एकमात्र प्रामाणिक छात्र पास",
        };
    }
  };

  const { badge, title, subtitle } = getHeadlineForTrigger();

  const getPerDayCalculation = (planId: string, amount: number) => {
    switch (planId) {
      case "trial_weekly":
      case "weekly":
        return "⚡ सिर्फ ₹0.14 / दिन (7 दिन ट्रायल)";
      case "monthly":
        return "₹1.60 / दिन (30 दिन)";
      case "yearly":
        return "केवल ₹0.40 / दिन (₹12 / माह)";
      case "lifetime":
        return "एक बार भुगतान • आजीवन एक्सेस";
      default:
        return "";
    }
  };

  const getSavingsPercent = (amount: number, original: number) => {
    if (!original || original <= amount) return 0;
    return Math.round(((original - amount) / original) * 100);
  };

  const trialPlan = plans.find((p) => p.id === "trial_weekly" || p.id === "weekly");
  const filteredPlans = activeTab === "trial" 
    ? plans.filter((p) => p.id === "trial_weekly" || p.id === "weekly")
    : activeTab === "full"
    ? plans.filter((p) => p.id !== "trial_weekly" && p.id !== "weekly")
    : plans;

  return (
    <AnimatePresence>
      <div 
        className="fixed inset-0 z-[130] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/85 backdrop-blur-md overflow-hidden select-none"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-premium-title"
      >
        {/* Backdrop overlay */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => !isProcessing && onClose()}
          className="fixed inset-0 bg-transparent"
        />

        {/* Modal Window Container */}
        <motion.div
          initial={{ opacity: 0, y: 30, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 30, scale: 0.96 }}
          transition={{ type: "spring", damping: 26, stiffness: 320 }}
          className="relative w-full sm:max-w-3xl md:max-w-4xl lg:max-w-5xl bg-[#140F24] border-t sm:border border-[#6D28D9]/40 rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col max-h-[94dvh] sm:max-h-[90vh] overflow-hidden z-10 text-[#F4F1FA]"
          style={{
            boxShadow: "0 25px 80px -15px rgba(109, 40, 217, 0.45)",
          }}
        >
          {/* Institutional Background Atmosphere */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-48 bg-gradient-to-b from-[#6D28D9]/25 via-[#4338CA]/15 to-transparent pointer-events-none blur-3xl" />

          {/* 1. INSTITUTIONAL TOP BAR (Sticky) */}
          <div className="relative flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-white/10 bg-[#140F24]/95 backdrop-blur-md z-20 shrink-0">
            {/* Left: Educational Academy Crest & Identity */}
            <div className="flex items-center gap-3">
              <div className="relative w-11 h-11 rounded-2xl bg-gradient-to-br from-amber-400 via-amber-500 to-orange-600 flex items-center justify-center shadow-lg shadow-amber-500/25 text-slate-950 shrink-0 ring-2 ring-amber-400/30">
                <GraduationCap className="w-6 h-6 stroke-[2.2]" />
                <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 border-2 border-[#140F24] flex items-center justify-center">
                  <Check className="w-2.5 h-2.5 text-white stroke-[3]" />
                </div>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black tracking-widest uppercase text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded border border-amber-400/20">
                    DISHA ACADEMY
                  </span>
                  <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                    <BadgeCheck className="w-3 h-3" />
                    <span>RPSC / RSMSSB</span>
                  </span>
                </div>
                <h2 id="modal-premium-title" className="text-sm sm:text-base font-black text-white tracking-tight mt-0.5">
                  दिशा VIP छात्र सदस्यता (Student Pass)
                </h2>
              </div>
            </div>

            {/* Right: Close Button */}
            <button
              type="button"
              onClick={onClose}
              disabled={isProcessing}
              className="w-9 h-9 rounded-xl bg-white/5 hover:bg-white/15 active:scale-95 text-gray-300 hover:text-white flex items-center justify-center transition-all cursor-pointer disabled:opacity-30 border border-white/10"
              aria-label="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* 2. SCROLLABLE INSTITUTION CONTENT */}
          <div className="flex-1 overflow-y-auto overscroll-contain p-4 sm:p-6 space-y-6">
            
            {/* Guest User Warning Banner */}
            {!isAuth && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-3.5 sm:p-4 rounded-2xl bg-gradient-to-r from-amber-500/20 via-orange-500/15 to-amber-500/20 border border-amber-500/40 flex flex-col sm:flex-row items-center justify-between gap-3 text-left shadow-lg"
              >
                <div className="flex items-center gap-3 w-full sm:w-auto">
                  <div className="w-10 h-10 rounded-xl bg-amber-500 text-black flex items-center justify-center shrink-0 font-bold shadow-md">
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-xs sm:text-sm font-black text-amber-200">
                      कृपया पहले अपनी छात्र प्रोफाइल में लॉगिन करें
                    </h4>
                    <p className="text-[11px] text-amber-300/80 leading-snug mt-0.5">
                      VIP पास आपकी विशिष्ट छात्र आईडी पर सुरक्षित रहेगा, जिससे आप फ़ोन बदलने पर भी इसे पुनर्प्राप्त कर सकेंगे।
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenLogin?.();
                  }}
                  className="w-full sm:w-auto px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-black font-black text-xs shrink-0 flex items-center justify-center gap-1.5 cursor-pointer shadow-md active:scale-95 transition-transform"
                >
                  <LogIn className="w-3.5 h-3.5" />
                  <span>अभी छात्र लॉगिन करें</span>
                </button>
              </motion.div>
            )}

            {/* Success State Screen */}
            {isSuccessState ? (
              <div className="py-12 px-4 text-center space-y-4">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", damping: 12 }}
                  className="w-20 h-20 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center mx-auto shadow-2xl"
                >
                  <CheckCheck className="w-10 h-10 stroke-[2.5]" />
                </motion.div>
                <h3 className="text-xl sm:text-2xl font-black text-white">
                  बधाई हो! आपकी दिशा VIP सदस्यता सक्रिय हो गई है 🎉
                </h3>
                <p className="text-xs sm:text-sm text-gray-300 max-w-md mx-auto">
                  आपकी छात्र आईडी पर सभी RPSC/RSMSSB मॉक टेस्ट, Disha AI Tutor और ऑल-राजस्थान मेरिट रैंक सफलतापूर्वक अनलॉक हो चुके हैं।
                </p>
              </div>
            ) : isAlreadyPremium ? (
              /* Already Premium Banner */
              <div className="p-6 rounded-3xl bg-gradient-to-br from-[#6D28D9]/20 via-[#1C1536] to-[#4338CA]/20 border border-[#6D28D9]/40 text-center space-y-3">
                <div className="w-14 h-14 rounded-2xl bg-amber-400 text-black flex items-center justify-center mx-auto shadow-lg shadow-amber-400/30">
                  <Crown className="w-7 h-7 fill-black" />
                </div>
                <h3 className="text-lg sm:text-xl font-black text-white">
                  आप पहले से दिशा VIP सदस्य हैं!
                </h3>
                <p className="text-xs text-gray-300 max-w-md mx-auto">
                  आपकी प्रोफ़ाइल में सभी 20,000+ PYQ, असीमित AI डाउट समाधान और मॉक टेस्ट पेपर्स पूर्णतः सक्रिय हैं।
                </p>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-6 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs cursor-pointer transition-colors"
                >
                  अध्ययन जारी रखें
                </button>
              </div>
            ) : (
              <>
                {/* A. INSTITUTION HERO HEADLINE & TRUST BADGES */}
                <div className="text-center space-y-2.5">
                  <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-[#6D28D9]/20 border border-[#6D28D9]/40 text-amber-300 text-[11px] font-black tracking-wider uppercase">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    <span>{badge}</span>
                  </div>
                  <h1 className="text-xl sm:text-2xl md:text-3xl font-black text-white tracking-tight leading-snug">
                    {title}
                  </h1>
                  <p className="text-xs sm:text-sm text-gray-300 max-w-xl mx-auto leading-relaxed">
                    {subtitle}
                  </p>

                  {/* Social Proof Strip */}
                  <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-6 pt-1 text-[11px] text-gray-300 font-semibold">
                    <div className="flex items-center gap-1.5 text-amber-300">
                      <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                      <span>4.9/5 (12,400+ छात्र समीक्षाएं)</span>
                    </div>
                    <span className="text-gray-600 hidden sm:inline">•</span>
                    <div className="flex items-center gap-1.5 text-emerald-400">
                      <Users className="w-3.5 h-3.5" />
                      <span>50,000+ चयनित प्रतियोगी छात्र</span>
                    </div>
                    <span className="text-gray-600 hidden sm:inline">•</span>
                    <div className="flex items-center gap-1.5 text-indigo-300">
                      <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
                      <span>100% प्रामाणिक परीक्षा मानक</span>
                    </div>
                  </div>
                </div>

                {/* B. DEDICATED SPOTLIGHT: ₹1 AUTO-PAY 1-WEEK TRIAL CARD */}
                {trialPlan && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className={`relative rounded-3xl p-4 sm:p-5 border-2 transition-all duration-300 overflow-hidden cursor-pointer ${
                      selectedPlanId === trialPlan.id
                        ? "bg-gradient-to-br from-[#2D1B54] via-[#1F143D] to-[#120B26] border-amber-400 shadow-2xl shadow-amber-500/20 ring-2 ring-amber-400/40"
                        : "bg-gradient-to-br from-[#20153D]/80 to-[#140C29]/80 border-[#6D28D9]/40 hover:border-amber-400/60"
                    }`}
                    onClick={() => handleSelectPlan(trialPlan.id)}
                  >
                    {/* Glowing Accent Corner Tag */}
                    <div className="absolute top-0 right-0 bg-gradient-to-l from-amber-400 to-orange-500 text-black font-black text-[10px] px-4 py-1 rounded-bl-2xl shadow-md uppercase tracking-wider flex items-center gap-1">
                      <Flame className="w-3 h-3 fill-black" />
                      <span>₹1 स्पेशल ट्रायल</span>
                    </div>

                    <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pr-16 md:pr-0">
                      <div className="flex items-start sm:items-center gap-3.5">
                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-slate-950 font-black shadow-lg shadow-amber-500/30 shrink-0 text-xl">
                          ₹1
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-black text-base sm:text-lg text-white">
                              {trialPlan.name}
                            </h3>
                            <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                              ऑटो-पे सुविधा (AutoPay)
                            </span>
                          </div>
                          <p className="text-xs text-amber-200/90 font-medium mt-0.5">
                            सिर्फ़ <strong>₹1</strong> में 7 दिन के लिए संपूर्ण VIP एक्सेस प्राप्त करें।
                          </p>
                          <div className="flex flex-wrap items-center gap-3 mt-1.5 text-[11px] text-gray-300">
                            <span className="flex items-center gap-1 text-emerald-400 font-bold">
                              <CheckCircle2 className="w-3.5 h-3.5" /> 7 दिन पूर्ण VIP अनलॉक
                            </span>
                            <span className="flex items-center gap-1 text-indigo-300 font-medium">
                              <RefreshCw className="w-3.5 h-3.5" /> 7 दिन बाद स्वतः नवीनीकरण
                            </span>
                            <span className="flex items-center gap-1 text-gray-400">
                              <Clock className="w-3.5 h-3.5" /> कभी भी 1-क्लिक में रद्द करें
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Right Action Pill inside Trial Card */}
                      <div className="w-full md:w-auto shrink-0 flex items-center justify-between md:flex-col gap-2 border-t md:border-t-0 border-white/10 pt-3 md:pt-0">
                        <div className="text-left md:text-right">
                          <span className="text-xs text-gray-400 line-through mr-1.5">₹{trialPlan.originalAmount}</span>
                          <span className="text-2xl font-black text-white">₹{trialPlan.amount}</span>
                          <span className="text-[10px] text-emerald-400 block font-bold">98% की भारी छूट</span>
                        </div>
                        <button
                          type="button"
                          className={`px-4 py-2 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                            selectedPlanId === trialPlan.id
                              ? "bg-amber-400 text-black shadow-lg shadow-amber-400/30"
                              : "bg-white/10 hover:bg-white/20 text-white"
                          }`}
                        >
                          {selectedPlanId === trialPlan.id ? (
                            <>
                              <Check className="w-3.5 h-3.5 stroke-[3]" />
                              <span>चयनित</span>
                            </>
                          ) : (
                            <span>यह ट्रायल चुनें</span>
                          )}
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* C. PLAN SELECTION TABS / CARDS (All Academic Passes) */}
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs sm:text-sm font-black text-white flex items-center gap-1.5">
                      <BookOpen className="w-4 h-4 text-amber-400" />
                      <span>सभी उपलब्ध अध्ययन पास (Academic Plans)</span>
                    </h3>
                    <span className="text-[11px] text-gray-400">अपनी जरूरत के अनुसार चुनें</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 sm:gap-4 items-stretch">
                    {plans
                      .filter((p) => p.id !== "trial_weekly" && p.id !== "weekly")
                      .map((plan) => {
                        const isSelected = plan.id === selectedPlanId;
                        const savings = getSavingsPercent(plan.amount, plan.originalAmount);
                        const perDay = getPerDayCalculation(plan.id, plan.amount);

                        return (
                          <div
                            key={plan.id}
                            onClick={() => handleSelectPlan(plan.id)}
                            className={`relative rounded-2xl p-4 sm:p-5 flex flex-col justify-between transition-all duration-300 cursor-pointer border ${
                              isSelected
                                ? "bg-gradient-to-b from-[#2E1A57] via-[#201442] to-[#140D2B] border-amber-400 shadow-xl shadow-[#6D28D9]/30 scale-[1.02] ring-2 ring-amber-400/40"
                                : "bg-[#1C1536]/80 hover:bg-[#1C1536] border-white/10 hover:border-white/25"
                            }`}
                          >
                            {/* Floating Top Badge */}
                            {plan.tag && (
                              <div className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap z-10">
                                <span className={`text-[10px] font-black px-3 py-0.5 rounded-full shadow-md ${
                                  plan.isPopular
                                    ? "bg-gradient-to-r from-amber-400 via-amber-500 to-orange-500 text-black ring-2 ring-black/40"
                                    : "bg-gradient-to-r from-[#6D28D9] to-[#8B5CF6] text-white"
                                }`}>
                                  {plan.tag}
                                </span>
                              </div>
                            )}

                            <div>
                              {/* Plan Header */}
                              <div className="text-center pt-2 pb-3 border-b border-white/10">
                                <h4 className="font-black text-base text-white">
                                  {plan.name}
                                </h4>
                                <p className="text-xs text-indigo-300 font-medium mt-0.5">
                                  {plan.duration}
                                </p>

                                {/* Price */}
                                <div className="mt-2.5 flex items-baseline justify-center gap-1.5">
                                  <span className="text-xs text-gray-400 line-through">₹{plan.originalAmount}</span>
                                  <span className="text-3xl font-black text-white tracking-tight">₹{plan.amount}</span>
                                </div>

                                {/* Savings Tag */}
                                {savings > 0 && (
                                  <div className="mt-1 flex items-center justify-center">
                                    <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/15 px-2 py-0.5 rounded-full border border-emerald-500/20">
                                      {savings}% की सीधी बचत
                                    </span>
                                  </div>
                                )}

                                <p className="text-[11px] text-amber-300 font-semibold mt-1.5">
                                  {perDay}
                                </p>
                              </div>

                              {/* Features List */}
                              <div className="pt-3 space-y-1.5 text-xs text-gray-200">
                                {plan.features.map((feat, idx) => (
                                  <div key={idx} className="flex items-start gap-2">
                                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                                    <span className="leading-tight text-[11px]">{feat}</span>
                                  </div>
                                ))}
                              </div>
                            </div>

                            {/* Bottom Selection Button inside card */}
                            <div className="pt-4 mt-3 border-t border-white/10">
                              <button
                                type="button"
                                className={`w-full py-2 rounded-xl font-black text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                                  isSelected
                                    ? "bg-gradient-to-r from-amber-400 to-orange-500 text-black shadow-md shadow-amber-400/30"
                                    : "bg-white/10 hover:bg-white/15 text-gray-200"
                                }`}
                              >
                                {isSelected ? (
                                  <>
                                    <Check className="w-4 h-4 stroke-[3]" />
                                    <span>चयनित प्लान</span>
                                  </>
                                ) : (
                                  <span>यह प्लान चुनें</span>
                                )}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>

                {/* D. EDUCATIONAL CURRICULUM & FEATURE HIGHLIGHTS */}
                <div className="p-4 sm:p-5 rounded-3xl bg-gradient-to-br from-[#1E163B] via-[#17102E] to-[#120B24] border border-[#6D28D9]/30 space-y-4">
                  <div className="flex items-center gap-2 border-b border-white/10 pb-2.5">
                    <Target className="w-4 h-4 text-amber-400" />
                    <h3 className="text-xs sm:text-sm font-black text-white">
                      दिशा VIP पास में विद्यार्थियों को क्या-क्या मिलता है?
                    </h3>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    <div className="p-3 rounded-2xl bg-white/5 border border-white/5 flex items-start gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0">
                        <Sparkles className="w-4 h-4 text-amber-400" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-white">24x7 AI डाउट सॉल्वर</h4>
                        <p className="text-[10px] text-gray-300 leading-tight mt-0.5">
                          किसी भी प्रश्न का तत्काल समाधान व संपूर्ण हिंदी व्याख्या
                        </p>
                      </div>
                    </div>

                    <div className="p-3 rounded-2xl bg-white/5 border border-white/5 flex items-start gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                        <BookOpen className="w-4 h-4 text-emerald-400" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-white">500+ मॉक टेस्ट पेपर्स</h4>
                        <p className="text-[10px] text-gray-300 leading-tight mt-0.5">
                          आरपीएससी व आरएसएमएसएसबी के सभी नए व पुराने पेपर्स
                        </p>
                      </div>
                    </div>

                    <div className="p-3 rounded-2xl bg-white/5 border border-white/5 flex items-start gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
                        <Award className="w-4 h-4 text-amber-400" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-white">ऑल-राजस्थान मेरिट रैंक</h4>
                        <p className="text-[10px] text-gray-300 leading-tight mt-0.5">
                          लाखों विद्यार्थियों के बीच अपनी वास्तविक रैंक व परसेंटाइल देखें
                        </p>
                      </div>
                    </div>

                    <div className="p-3 rounded-2xl bg-white/5 border border-white/5 flex items-start gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-rose-500/20 text-rose-400 flex items-center justify-center shrink-0">
                        <TrendingUp className="w-4 h-4 text-rose-400" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-white">स्मार्ट मिस्टेक बैंक</h4>
                        <p className="text-[10px] text-gray-300 leading-tight mt-0.5">
                          गलत हुए प्रश्नों का स्वतः संकलन व वैज्ञानिक अंतराल रिवीज़न
                        </p>
                      </div>
                    </div>

                    <div className="p-3 rounded-2xl bg-white/5 border border-white/5 flex items-start gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center shrink-0">
                        <FileText className="w-4 h-4 text-purple-400" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-white">A4 प्रिंटेबल टेस्ट पेपर्स</h4>
                        <p className="text-[10px] text-gray-300 leading-tight mt-0.5">
                          ऑफ़लाइन OMR शीट पर असली परीक्षा जैसा अभ्यास करने हेतु प्रिंट
                        </p>
                      </div>
                    </div>

                    <div className="p-3 rounded-2xl bg-white/5 border border-white/5 flex items-start gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                        <ShieldCheck className="w-4 h-4 text-emerald-400" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-white">100% विज्ञापन-मुक्त</h4>
                        <p className="text-[10px] text-gray-300 leading-tight mt-0.5">
                          बिना किसी रुकावट या ऐड के पूर्ण एकाग्रता से तैयारी करें
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* E. OFFICIAL CASHFREE BANK-GRADE CHECKOUT CONTAINER */}
                <div className="space-y-3.5">
                  <div className="p-5 sm:p-6 rounded-3xl bg-gradient-to-b from-[#25184A] via-[#1A1136] to-[#120B26] border-2 border-[#6D28D9]/60 shadow-2xl space-y-4">
                    {/* Security & Cashfree Verification Header */}
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-2 border-b border-white/10 pb-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-[#6D28D9]/30 border border-[#6D28D9]/50 flex items-center justify-center text-emerald-400 shrink-0">
                          <ShieldCheck className="w-5 h-5" />
                        </div>
                        <div>
                          <h4 className="text-xs sm:text-sm font-black text-white flex items-center gap-1.5">
                            <span>Cashfree आधिकारिक पेमेंट गेटवे</span>
                            <span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                              RBI Licensed
                            </span>
                          </h4>
                          <p className="text-[10px] text-gray-400 font-medium">
                            256-Bit बैंक-ग्रेड एन्क्रिप्शन • 100% सुरक्षित एवं विश्वसनीय भुगतान
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 text-[11px] font-bold text-amber-300 bg-amber-400/10 px-2.5 py-1 rounded-full border border-amber-400/25">
                        <Zap className="w-3.5 h-3.5 text-amber-400" />
                        <span>त्वरित VIP सक्रियता</span>
                      </div>
                    </div>

                    {/* Official Gateway Checkout CTA Button */}
                    <button
                      type="button"
                      onClick={handlePay}
                      disabled={isProcessing}
                      className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-amber-400 via-amber-500 to-orange-500 hover:brightness-110 active:scale-[0.99] text-slate-950 font-black text-sm sm:text-base flex items-center justify-center gap-3 shadow-xl shadow-amber-500/30 transition-all cursor-pointer disabled:opacity-50"
                    >
                      {isProcessing ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin text-slate-950" />
                          <span>{statusMessage || "सुरक्षित पेमेंट गेटवे लोड हो रहा है..."}</span>
                        </>
                      ) : (
                        <>
                          <Lock className="w-5 h-5 text-slate-950" />
                          <span>
                            {selectedPlan.id === "trial_weekly" || selectedPlan.id === "weekly"
                              ? "₹1 में 7-दिन का VIP ट्रायल शुरू करें"
                              : `${selectedPlan.name} प्राप्त करें (₹${selectedPlan.amount})`}
                          </span>
                          <ArrowRight className="w-5 h-5 text-slate-950" />
                        </>
                      )}
                    </button>

                    {/* Supported Payment Channels */}
                    <div className="space-y-2 pt-1 text-center">
                      <div className="flex flex-wrap items-center justify-center gap-2 text-[11px] font-bold text-gray-200">
                        <span className="px-2.5 py-1 rounded-xl bg-white/5 border border-white/10">📱 PhonePe</span>
                        <span className="px-2.5 py-1 rounded-xl bg-white/5 border border-white/10">🟢 Google Pay</span>
                        <span className="px-2.5 py-1 rounded-xl bg-white/5 border border-white/10">🔵 Paytm</span>
                        <span className="px-2.5 py-1 rounded-xl bg-white/5 border border-white/10">⚡ BHIM UPI</span>
                        <span className="px-2.5 py-1 rounded-xl bg-white/5 border border-white/10">💳 डेबिट / क्रेडिट कार्ड्स</span>
                        <span className="px-2.5 py-1 rounded-xl bg-white/5 border border-white/10">🏦 नेट बैंकिंग</span>
                      </div>
                      <p className="text-[11px] text-gray-400 max-w-md mx-auto leading-relaxed">
                        बटन दबाते ही <strong>Cashfree का आधिकारिक पेमेंट पेज</strong> खुलेगा जहाँ आप अपनी पसंदीदा UPI ऐप, कार्ड्स या नेटबैंकिंग से सीधे पे कर सकते हैं।
                      </p>
                    </div>
                  </div>
                </div>

                {/* F. COLLAPSIBLE FREE VS VIP COMPARISON TABLE */}
                <div className="rounded-2xl border border-white/10 bg-[#1C1536]/60 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setShowComparison(!showComparison)}
                    className="w-full p-3.5 flex items-center justify-between text-left text-xs font-bold text-gray-200 hover:bg-white/5 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <HelpCircle className="w-4 h-4 text-[#A78BFA]" />
                      <span>मुफ़्त (Free) बनाम VIP पास में क्या अंतर है?</span>
                    </div>
                    {showComparison ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>

                  {showComparison && (
                    <motion.div 
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      className="p-3.5 pt-0 border-t border-white/10 overflow-x-auto"
                    >
                      <table className="w-full text-xs text-left">
                        <thead>
                          <tr className="border-b border-white/10 text-indigo-300">
                            <th className="py-2">सुविधा (Academic Feature)</th>
                            <th className="py-2 text-center">मुफ़्त (Free)</th>
                            <th className="py-2 text-center text-amber-400 font-black">⭐ VIP पास</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5 text-gray-300">
                          <tr>
                            <td className="py-2 font-medium">Disha AI Tutor (24x7 डाउट सॉल्वर)</td>
                            <td className="py-2 text-center text-gray-400">3 प्रश्न / दिन</td>
                            <td className="py-2 text-center text-emerald-400 font-bold">✅ असीमित (Unlimited)</td>
                          </tr>
                          <tr>
                            <td className="py-2 font-medium">RPSC / RSMSSB Mock Test सीरीज़</td>
                            <td className="py-2 text-center text-gray-400">केवल 2 डेमो टेस्ट</td>
                            <td className="py-2 text-center text-emerald-400 font-bold">✅ सभी 500+ टेस्ट पेपर्स</td>
                          </tr>
                          <tr>
                            <td className="py-2 font-medium">All-Rajasthan लाइव मेरिट रैंक</td>
                            <td className="py-2 text-center text-gray-400">❌ नहीं</td>
                            <td className="py-2 text-center text-emerald-400 font-bold">✅ राज्य-स्तरीय मेरिट रैंक</td>
                          </tr>
                          <tr>
                            <td className="py-2 font-medium">प्रिंट-योग्य A4 टेस्ट पेपर्स</td>
                            <td className="py-2 text-center text-gray-400">❌ नहीं</td>
                            <td className="py-2 text-center text-emerald-400 font-bold">✅ असीमित डाउनलोड</td>
                          </tr>
                          <tr>
                            <td className="py-2 font-medium">1v1 लाइव क्विज़ मुकाबला</td>
                            <td className="py-2 text-center text-gray-400">सीमित</td>
                            <td className="py-2 text-center text-emerald-400 font-bold">✅ असीमित रूम्स</td>
                          </tr>
                          <tr>
                            <td className="py-2 font-medium">स्मार्ट मिस्टेक बैंक रिवीज़न</td>
                            <td className="py-2 text-center text-gray-400">❌ नहीं</td>
                            <td className="py-2 text-center text-emerald-400 font-bold">✅ ऑटो-रिवीज़न</td>
                          </tr>
                          <tr>
                            <td className="py-2 font-medium">विज्ञापन-मुक्त अध्ययन</td>
                            <td className="py-2 text-center text-gray-400">विज्ञापन सहित</td>
                            <td className="py-2 text-center text-emerald-400 font-bold">✅ 100% Ad-Free</td>
                          </tr>
                        </tbody>
                      </table>
                    </motion.div>
                  )}
                </div>

                {/* G. Error Display */}
                {errorMessage && (
                  <div className="p-3 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs text-center flex items-center justify-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                    <span>{errorMessage}</span>
                  </div>
                )}

                {/* H. Student Trust Footnote */}
                <div className="pt-2 text-center space-y-1 text-gray-400 text-[11px]">
                  <p>
                    🔒 256-Bit SSL एन्क्रिप्टेड • 100% सुरक्षित भुगतान • किसी भी सहायता के लिए Disha 24x7 सपोर्ट उपलब्ध
                  </p>
                </div>
              </>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
