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
  Laptop,
  AlertTriangle,
  LogIn,
  ArrowRight
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
  const [selectedPlanId, setSelectedPlanId] = useState<"monthly" | "yearly" | "lifetime">("yearly");

  // Cashfree exclusive state
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSuccessState, setIsSuccessState] = useState(false);
  const [showComparison, setShowComparison] = useState(false);

  // Sync dynamic plans from Admin Panel
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

  const handleSelectPlan = (planId: "monthly" | "yearly" | "lifetime") => {
    if (isProcessing) return;
    triggerHaptic("light");
    playClickSound();
    setSelectedPlanId(planId);
  };

  // Cashfree Checkout (Official & Exclusive)
  const handlePay = async () => {
    if (!isAuth) {
      triggerHaptic("warning");
      setErrorMessage("पेमेंट करने से पहले कृपया अपनी प्रोफाइल में लॉगिन करें।");
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
          badge: "Disha AI Tutor • असीमित उपयोग",
          title: "Disha AI Tutor को अनलिमिटेड अनलॉक करें",
          subtitle: "24x7 कठिन प्रश्नों का तुरंत हल, संपूर्ण व्याख्या और शंका समाधान पाएं",
        };
      case "mock_tests":
        return {
          badge: "RPSC & RSMSSB Mock Tests • सम्पूर्ण एक्सेस",
          title: "सभी टेस्ट पेपर्स व लाइव टेस्ट सीरीज़ अनलॉक करें",
          subtitle: "राज्य-स्तरीय मेरिट रैंक, परसेंटाइल और पिछले वर्षों के पेपर्स का विस्तृत हल",
        };
      case "pdf_export":
        return {
          badge: "PDF Test Papers • प्रिंट-योग्य एक्सपोर्ट",
          title: "PDF टेस्ट पेपर्स व क्वेश्चन बैंक डाउनलोड अनलॉक करें",
          subtitle: "बिना इंटरनेट ऑफ़लाइन पढ़ाई के लिए A4 फॉर्मेट में संपूर्ण व्याख्या सहित टेस्ट पेपर्स प्रिंट करें",
        };
      case "live_battle":
        return {
          badge: "1v1 Quiz Battle • लाइव मुकाबला",
          title: "1v1 लाइव क्विज़ मुकाबला रूम अनलॉक करें",
          subtitle: "साथी अभ्यर्थियों के साथ रियल-टाइम क्विज़ चैलेंज और लीडरबोर्ड मुकाबला खेलें",
        };
      case "mistake_bank":
        return {
          badge: "स्मार्ट मिस्टेक बैंक • ऑटो रिवीज़न",
          title: "मिस्टेक बैंक व कमजोर टॉपिक रिवीज़न अनलॉक करें",
          subtitle: "परीक्षा में जो प्रश्न गलत हुए उनका वैज्ञानिक अंतराल (Spaced Repetition) रिवीज़न करें",
        };
      case "state_merit_rank":
        return {
          badge: "All-Rajasthan Merit Rank • लाइव परसेंटाइल",
          title: "अखिल राजस्थान रियल-टाइम मेरिट रैंक अनलॉक करें",
          subtitle: "हजारों अभ्यर्थियों के बीच अपनी सटीक रैंक, परसेंटाइल और विषयवार तुलनात्मक रिपोर्ट देखें",
        };
      default:
        return {
          badge: "Disha PYQ VIP Pass • सर्वोत्तम तैयारी",
          title: "Disha PYQ VIP प्रीमियम पास में अपग्रेड करें",
          subtitle: "राजस्थान की सभी प्रतियोगी परीक्षाओं में सफलता सुनिश्चित करने वाला एकमात्र पास",
        };
    }
  };

  const { badge, title, subtitle } = getHeadlineForTrigger();

  const getPerDayCalculation = (planId: string, amount: number) => {
    switch (planId) {
      case "monthly":
        return "₹1.60 / दिन";
      case "yearly":
        return "केवल ₹12 / माह (₹0.40 / दिन)";
      case "lifetime":
        return "एक बार भुगतान • आजीवन एक्सेस";
      default:
        return "";
    }
  };

  const getSavingsPercent = (amount: number, original: number) => {
    return Math.round(((original - amount) / original) * 100);
  };

  return (
    <AnimatePresence>
      <div 
        className="fixed inset-0 z-[130] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/85 backdrop-blur-md overflow-hidden select-none"
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
          className="relative w-full sm:max-w-3xl md:max-w-4xl lg:max-w-5xl bg-[#171329] border-t sm:border border-[#7045D8]/40 rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col max-h-[92dvh] sm:max-h-[88vh] overflow-hidden z-10 text-[#F4F1FA]"
          style={{
            boxShadow: "0 25px 70px -15px rgba(112, 69, 216, 0.45)",
          }}
        >
          {/* Ambient Purple & Gold Radial Glow */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-36 bg-gradient-to-b from-[#7045D8]/30 via-[#7045D8]/10 to-transparent pointer-events-none blur-2xl" />

          {/* 1. TOP HEADER (Sticky) */}
          <div className="relative flex items-center justify-between px-4 sm:px-6 py-3.5 sm:py-4 border-b border-white/10 bg-[#171329]/95 backdrop-blur-md z-20 shrink-0">
            {/* Left: Brand + VIP Badge */}
            <div className="flex items-center gap-2.5 sm:gap-3">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-400 via-amber-500 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/30 text-black shrink-0">
                <Crown className="w-5 h-5 fill-black" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 id="modal-premium-title" className="text-sm sm:text-base font-black text-white tracking-tight">
                    Disha VIP Pass
                  </h2>
                  <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-gradient-to-r from-amber-400 to-orange-500 text-black">
                    PRO
                  </span>
                </div>
                <p className="text-[11px] text-[#A78BFA] font-medium hidden sm:block">
                  राजस्थान प्रतियोगी परीक्षाओं के लिए सर्वश्रेष्ठ डिजिटल साथी
                </p>
              </div>
            </div>

            {/* Right: Close Button */}
            <button
              type="button"
              onClick={onClose}
              disabled={isProcessing}
              className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 active:scale-95 text-gray-300 hover:text-white flex items-center justify-center transition-all cursor-pointer disabled:opacity-30"
              aria-label="Close premium modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* 2. SCROLLABLE CONTENT BODY */}
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
                      आप अभी अतिथि (Guest) मोड में हैं!
                    </h4>
                    <p className="text-[11px] text-amber-300/80 leading-snug mt-0.5">
                      प्रीमियम पास खरीदने से पहले लॉगिन करें, ताकि आपका VIP पास हमेशा आपकी आईडी पर सुरक्षित रहे।
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
                  <span>अभी लॉगिन करें</span>
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
                  बधाई हो! आपका Disha VIP सक्रिय हो गया है
                </h3>
                <p className="text-xs sm:text-sm text-gray-300 max-w-md mx-auto">
                  आपके सभी टेस्ट पेपर्स, Disha AI Tutor और ऑल-राजस्थान मेरिट रैंक सफलतापूर्वक अनलॉक हो चुके हैं।
                </p>
              </div>
            ) : isAlreadyPremium ? (
              /* Already Premium Banner */
              <div className="p-6 rounded-3xl bg-gradient-to-br from-[#7045D8]/20 via-[#1F1938] to-[#7045D8]/10 border border-[#7045D8]/40 text-center space-y-3">
                <div className="w-14 h-14 rounded-2xl bg-amber-400 text-black flex items-center justify-center mx-auto shadow-lg shadow-amber-400/30">
                  <Crown className="w-7 h-7 fill-black" />
                </div>
                <h3 className="text-lg sm:text-xl font-black text-white">
                  आप पहले से Disha VIP सदस्य हैं!
                </h3>
                <p className="text-xs text-gray-300 max-w-md mx-auto">
                  आपकी प्रोफाइल में सभी प्रीमियम सुविधाएं और असीमित टेस्ट पेपर्स सक्रिय हैं।
                </p>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-6 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs cursor-pointer transition-colors"
                >
                  बंद करें
                </button>
              </div>
            ) : (
              <>
                {/* A. Hero Trigger Headline */}
                <div className="text-center space-y-2">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#7045D8]/20 border border-[#7045D8]/40 text-[#A78BFA] text-[10px] font-black tracking-wider uppercase">
                    <Sparkles className="w-3 h-3 text-amber-400" />
                    <span>{badge}</span>
                  </div>
                  <h1 className="text-xl sm:text-2xl md:text-3xl font-black text-white tracking-tight leading-tight">
                    {title}
                  </h1>
                  <p className="text-xs sm:text-sm text-gray-300 max-w-xl mx-auto leading-relaxed">
                    {subtitle}
                  </p>
                </div>

                {/* B. Plan Selector Cards (Monthly, Yearly, Lifetime) */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 sm:gap-4 items-stretch pt-2">
                  {plans.map((plan) => {
                    const isSelected = plan.id === selectedPlanId;
                    const savings = getSavingsPercent(plan.amount, plan.originalAmount);
                    const perDay = getPerDayCalculation(plan.id, plan.amount);

                    return (
                      <div
                        key={plan.id}
                        onClick={() => handleSelectPlan(plan.id)}
                        className={`relative rounded-2xl p-4 sm:p-5 flex flex-col justify-between transition-all duration-300 cursor-pointer border ${
                          isSelected
                            ? "bg-gradient-to-b from-[#251b47] to-[#1a1433] border-[#7045D8] shadow-xl shadow-[#7045D8]/30 scale-[1.02] ring-2 ring-[#7045D8]/50"
                            : "bg-[#1E1833]/70 hover:bg-[#1E1833] border-white/10 hover:border-white/20"
                        }`}
                      >
                        {/* Floating Top Badge */}
                        {plan.tag && (
                          <div className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap z-10">
                            <span className={`text-[10px] font-black px-3 py-1 rounded-full shadow-md ${
                              plan.isPopular
                                ? "bg-gradient-to-r from-amber-400 via-orange-500 to-amber-500 text-black ring-2 ring-black/40"
                                : "bg-gradient-to-r from-[#7045D8] to-[#A78BFA] text-white"
                            }`}>
                              {plan.tag}
                            </span>
                          </div>
                        )}

                        <div>
                          {/* Plan Header */}
                          <div className="text-center pt-2 pb-3 border-b border-white/10">
                            <h3 className="font-black text-base lg:text-lg text-white">
                              {plan.name}
                            </h3>
                            <p className="text-xs text-[#A78BFA] font-medium mt-0.5">
                              {plan.duration}
                            </p>

                            {/* Price */}
                            <div className="mt-3 flex items-baseline justify-center gap-1.5">
                              <span className="text-xs text-gray-400 line-through">₹{plan.originalAmount}</span>
                              <span className="text-3xl lg:text-4xl font-black text-white tracking-tight">₹{plan.amount}</span>
                            </div>

                            {/* Savings Tag */}
                            <div className="mt-1.5 flex items-center justify-center gap-1.5">
                              <span className="text-[11px] font-bold text-emerald-400 bg-emerald-500/15 px-2 py-0.5 rounded-full border border-emerald-500/20">
                                {savings}% की सीधी बचत
                              </span>
                            </div>

                            <p className="text-[11px] text-gray-300 font-semibold mt-2">
                              {perDay}
                            </p>
                          </div>

                          {/* Features List */}
                          <div className="pt-4 space-y-2 text-xs text-gray-200">
                            {plan.features.map((feat, idx) => (
                              <div key={idx} className="flex items-start gap-2">
                                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                                <span className="leading-tight">{feat}</span>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Bottom Selection Button inside card */}
                        <div className="pt-5 mt-4 border-t border-white/10">
                          <button
                            type="button"
                            className={`w-full py-2.5 rounded-xl font-black text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                              isSelected
                                ? "bg-gradient-to-r from-[#7045D8] to-[#A78BFA] text-white shadow-md shadow-[#7045D8]/40"
                                : "bg-white/10 hover:bg-white/15 text-gray-200"
                            }`}
                          >
                            {isSelected ? (
                              <>
                                <Check className="w-4 h-4 stroke-[3]" />
                                <span>यह प्लान चुना गया</span>
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

                {/* C. OFFICIAL CASHFREE PAYMENT GATEWAY (Primary Checkout) */}
                <div className="pt-2 space-y-3.5">
                  <div className="p-5 sm:p-6 rounded-3xl bg-gradient-to-b from-[#22183e] via-[#1a1433] to-[#140f28] border border-[#7045D8]/50 shadow-2xl space-y-4">
                    {/* Trust & Official Gateway Badges */}
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-2 border-b border-white/10 pb-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-[#7045D8]/30 border border-[#7045D8]/50 flex items-center justify-center text-[#A78BFA] shrink-0">
                          <ShieldCheck className="w-5 h-5 text-emerald-400" />
                        </div>
                        <div>
                          <h4 className="text-xs sm:text-sm font-black text-white flex items-center gap-1.5">
                            <span>Cashfree आधिकारिक पेमेंट गेटवे</span>
                            <span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                              Verified
                            </span>
                          </h4>
                          <p className="text-[10px] text-gray-400 font-medium">
                            256-Bit बैंक-ग्रेड एन्क्रिप्शन • 100% सुरक्षित भुगतान
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 text-[11px] font-bold text-amber-300 bg-amber-400/10 px-2.5 py-1 rounded-full border border-amber-400/25">
                        <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                        <span>त्वरित VIP एक्टिवेशन</span>
                      </div>
                    </div>

                    {/* Official Gateway Checkout CTA Button */}
                    <button
                      type="button"
                      onClick={handlePay}
                      disabled={isProcessing}
                      className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-[#7045D8] via-[#855fe6] to-[#A78BFA] hover:brightness-110 active:scale-[0.99] text-white font-black text-sm sm:text-base flex items-center justify-center gap-3 shadow-xl shadow-[#7045D8]/40 transition-all cursor-pointer disabled:opacity-50"
                    >
                      {isProcessing ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin" />
                          <span>{statusMessage || "ऑफिशियल पेमेंट गेटवे लोड हो रहा है..."}</span>
                        </>
                      ) : (
                        <>
                          <Lock className="w-5 h-5" />
                          <span>आधिकारिक पेमेंट गेटवे से भुगतान करें (₹{selectedPlan.amount})</span>
                          <ArrowRight className="w-5 h-5" />
                        </>
                      )}
                    </button>

                    {/* Supported Payment Options Badges */}
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

                {/* D. Collapsible Free vs VIP Comparison Table */}
                <div className="rounded-2xl border border-white/10 bg-[#221C38]/60 overflow-hidden">
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
                          <tr className="border-b border-white/10 text-[#A78BFA]">
                            <th className="py-2">सुविधा (Feature)</th>
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
                            <td className="py-2 text-center text-emerald-400 font-bold">✅ सभी 100+ पेपर्स</td>
                          </tr>
                          <tr>
                            <td className="py-2 font-medium">All-Rajasthan लाइव मेरिट रैंक</td>
                            <td className="py-2 text-center text-gray-400">❌ नहीं</td>
                            <td className="py-2 text-center text-emerald-400 font-bold">✅ राज्य-स्तरीय रैंक</td>
                          </tr>
                          <tr>
                            <td className="py-2 font-medium">प्रिंट-योग्य PDF टेस्ट पेपर एक्सपोर्ट</td>
                            <td className="py-2 text-center text-gray-400">❌ नहीं</td>
                            <td className="py-2 text-center text-emerald-400 font-bold">✅ असीमित A4 डाउनलोड</td>
                          </tr>
                          <tr>
                            <td className="py-2 font-medium">1v1 लाइव क्विज़ मुकाबला</td>
                            <td className="py-2 text-center text-gray-400">सीमित</td>
                            <td className="py-2 text-center text-emerald-400 font-bold">✅ असीमित रूम्स</td>
                          </tr>
                          <tr>
                            <td className="py-2 font-medium">स्मार्ट मिस्टेक बैंक (गलतियों का रिवीज़न)</td>
                            <td className="py-2 text-center text-gray-400">❌ नहीं</td>
                            <td className="py-2 text-center text-emerald-400 font-bold">✅ ऑटो-रिवीज़न</td>
                          </tr>
                          <tr>
                            <td className="py-2 font-medium">विज्ञापन-मुक्त अनुभव</td>
                            <td className="py-2 text-center text-gray-400">सीमित</td>
                            <td className="py-2 text-center text-emerald-400 font-bold">✅ 100% Ad-Free</td>
                          </tr>
                        </tbody>
                      </table>
                    </motion.div>
                  )}
                </div>

                {/* E. Error / Status Display */}
                {errorMessage && (
                  <div className="p-3 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs text-center flex items-center justify-center gap-2">
                    <span>{errorMessage}</span>
                  </div>
                )}

                {/* F. Trust & Social Proof Badges */}
                <div className="pt-1 flex flex-wrap items-center justify-center gap-4 text-gray-300 text-[11px]">
                  <div className="flex items-center gap-1.5">
                    <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                    <span>4.9★ (12,000+ अभ्यर्थी)</span>
                  </div>
                  <span>•</span>
                  <div className="flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                    <span>100% सुरक्षित UPI व PG</span>
                  </div>
                  <span>•</span>
                  <div className="flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5 text-amber-400" />
                    <span>त्वरित एक्टिवेशन</span>
                  </div>
                </div>
              </>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
