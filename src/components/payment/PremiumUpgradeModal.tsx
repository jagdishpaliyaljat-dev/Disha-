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
  Laptop
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { PREMIUM_PLANS, PremiumPlan, initiateCashfreePayment, getPremiumPlansList } from "../../services/payment/cashfreeService";
import { UserProfile } from "../../types";
import { triggerHaptic, playClickSound } from "../../utils/audioFeedback";

export interface PremiumUpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser?: UserProfile | null;
  featureTrigger?: "ai_tutor" | "mock_tests" | "profile" | "general" | "pdf_export" | "live_battle" | "mistake_bank" | "state_merit_rank";
  onSuccess?: () => void;
}

export const PremiumUpgradeModal: React.FC<PremiumUpgradeModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  featureTrigger = "general",
  onSuccess,
}) => {
  const [plans, setPlans] = useState<PremiumPlan[]>(() => getPremiumPlansList());
  const [selectedPlanId, setSelectedPlanId] = useState<"monthly" | "yearly" | "lifetime">("yearly");
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSuccessState, setIsSuccessState] = useState(false);
  const [showComparison, setShowComparison] = useState(false);

  // Sync dynamic plans when updated from Admin Panel
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
  const selectedPlan = plans.find((p) => p.id === selectedPlanId) || plans[0] || PREMIUM_PLANS[0];

  const handleSelectPlan = (planId: "monthly" | "yearly" | "lifetime") => {
    if (isProcessing) return;
    triggerHaptic("light");
    playClickSound();
    setSelectedPlanId(planId);
  };

  const handlePay = async () => {
    triggerHaptic("medium");
    playClickSound();
    setErrorMessage(null);
    setIsProcessing(true);

    const result = await initiateCashfreePayment(selectedPlanId, (status, msg) => {
      setStatusMessage(msg || "");
    });

    setIsProcessing(false);

    if (result.success) {
      triggerHaptic("success");
      setIsSuccessState(true);
      setTimeout(() => {
        onSuccess?.();
        onClose();
      }, 2500);
    } else if (result.error) {
      triggerHaptic("warning");
      setErrorMessage(result.error);
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
              <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-gradient-to-br from-amber-400 via-amber-500 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-500/25 shrink-0 transform -rotate-2">
                <Crown className="w-5 h-5 sm:w-6 sm:h-6 text-black fill-black" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-black text-white text-base sm:text-lg tracking-tight">Disha PYQ</span>
                  <span className="text-[10px] sm:text-[11px] font-black px-2 py-0.5 rounded-full bg-gradient-to-r from-amber-400 to-amber-500 text-black uppercase tracking-wider shadow-xs">
                    VIP PASS
                  </span>
                </div>
                <p className="text-[11px] sm:text-xs text-[#A78BFA] font-medium leading-none mt-0.5">
                  प्रीमियम परीक्षा तैयारी
                </p>
              </div>
            </div>

            {/* Right: Security Badge & Close Button */}
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[11px] font-semibold">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>100% सुरक्षित भुगतान</span>
              </div>

              <button
                type="button"
                onClick={onClose}
                disabled={isProcessing}
                className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 flex items-center justify-center text-gray-300 hover:text-white transition-all cursor-pointer"
                aria-label="Close modal"
              >
                <X className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
            </div>
          </div>

          {/* 2. SCROLLABLE CONTENT BODY */}
          <div className="p-4 sm:p-6 overflow-y-auto space-y-4 sm:space-y-6 flex-1 z-10 text-slate-100">
            {isSuccessState ? (
              /* Success Confirmation View */
              <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="py-12 text-center space-y-4 max-w-md mx-auto"
              >
                <div className="w-20 h-20 mx-auto rounded-full bg-emerald-500/20 border-2 border-emerald-500 flex items-center justify-center text-emerald-400 shadow-xl shadow-emerald-500/30 animate-bounce">
                  <Check className="w-10 h-10 stroke-[3]" />
                </div>
                <h3 className="text-2xl sm:text-3xl font-black text-white">बधाई हो! 🎉</h3>
                <p className="text-sm sm:text-base text-gray-200 leading-relaxed">
                  आपका <strong className="text-amber-400">Disha PYQ VIP पास</strong> सफलतापूर्वक सक्रिय कर दिया गया है। 
                  सभी Mock Tests, Test Series और Disha AI Tutor अब पूरी तरह अनलॉक हैं।
                </p>
                <div className="pt-2">
                  <span className="inline-block text-xs font-bold px-3 py-1.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    ऐप पर वापस रीडायरेक्ट हो रहे हैं...
                  </span>
                </div>
              </motion.div>
            ) : isAlreadyPremium ? (
              /* Already Active VIP View */
              <div className="py-8 text-center space-y-4 bg-white/5 rounded-3xl border border-white/10 p-6 max-w-lg mx-auto">
                <div className="w-16 h-16 mx-auto rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shadow-lg">
                  <Award className="w-8 h-8" />
                </div>
                <div>
                  <h3 className="text-xl sm:text-2xl font-black text-white">आप पहले से VIP सदस्य हैं! 👑</h3>
                  <p className="text-xs sm:text-sm text-gray-300 mt-1">
                    सक्रिय प्लान: <strong className="text-amber-400 uppercase">{currentUser.premiumPlan || "VIP"}</strong>
                  </p>
                  {currentUser.premiumUntil && (
                    <p className="text-xs text-gray-400 mt-0.5">
                      वैधता: <strong className="text-white">{new Date(currentUser.premiumUntil).toLocaleDateString("hi-IN", { day: "numeric", month: "long", year: "numeric" })}</strong> तक
                    </p>
                  )}
                </div>
                <p className="text-xs text-[#A78BFA] leading-relaxed max-w-sm mx-auto">
                  आपकी सदस्यता सक्रिय है। सभी Mock Tests, State Merit Ranking और 24x7 AI Tutor का असीमित आनंद लें।
                </p>
                <div className="pt-3">
                  <button
                    type="button"
                    onClick={onClose}
                    className="w-full sm:w-auto px-8 py-3 rounded-2xl bg-[#7045D8] hover:bg-[#5e34ca] text-white font-black text-sm shadow-lg shadow-[#7045D8]/30 transition-all cursor-pointer"
                  >
                    जारी रखें (Continue App)
                  </button>
                </div>
              </div>
            ) : (
              /* Main Upgrade Flow */
              <>
                {/* A. Hero Value Proposition */}
                <div className="text-center space-y-1.5 max-w-2xl mx-auto">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#7045D8]/20 border border-[#7045D8]/40 text-[#A78BFA] text-[11px] font-bold">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    <span>{badge}</span>
                  </div>
                  <h2 
                    id="modal-premium-title"
                    className="text-lg sm:text-2xl md:text-3xl font-black text-white tracking-tight leading-snug"
                  >
                    {title}
                  </h2>
                  <p className="text-xs sm:text-sm text-gray-300 leading-relaxed max-w-xl mx-auto">
                    {subtitle}
                  </p>
                </div>

                {/* B. Limited-Time Offer Banner */}
                <div className="p-3 sm:p-3.5 rounded-2xl bg-gradient-to-r from-amber-500/15 via-[#7045D8]/25 to-amber-500/15 border border-amber-500/30 flex items-center justify-between gap-2 shadow-xs">
                  <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
                    <span className="text-lg sm:text-xl">⚡</span>
                    <div className="min-w-0">
                      <p className="text-xs sm:text-sm font-black text-white leading-tight">
                        स्पेशल डिस्काउंट ऑफर • 70% तक की भारी बचत!
                      </p>
                      <p className="text-[10px] sm:text-[11px] text-[#A78BFA] leading-tight mt-0.5 truncate">
                        RPSC RAS, 2nd Grade, 3rd Grade, CET और सभी राजस्थान भर्ती परीक्षाओं हेतु
                      </p>
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <span className="text-[11px] sm:text-xs font-black px-2.5 py-1 rounded-lg bg-amber-400 text-black shadow-xs">
                      सीमित समय
                    </span>
                  </div>
                </div>

                {/* C. PRICING CARDS — RESPONSIVE (Stacked on Mobile, 3-Columns on Laptop) */}

                {/* MOBILE VIEW (< md) : Touch-Friendly Vertical Radio Cards */}
                <div className="block md:hidden space-y-2.5">
                  {plans.map((plan) => {
                    const isSelected = selectedPlanId === plan.id;
                    const savings = getSavingsPercent(plan.amount, plan.originalAmount);
                    const perDay = getPerDayCalculation(plan.id, plan.amount);

                    return (
                      <div
                        key={plan.id}
                        onClick={() => handleSelectPlan(plan.id)}
                        className={`relative p-3.5 rounded-2xl border cursor-pointer transition-all active:scale-[0.99] select-none ${
                          isSelected
                            ? "bg-gradient-to-r from-[#7045D8]/30 via-[#7045D8]/15 to-[#221C38] border-[#A78BFA] ring-2 ring-[#7045D8]/70 shadow-lg shadow-[#7045D8]/25"
                            : "bg-[#221C38]/80 hover:bg-[#221C38] border-white/10"
                        }`}
                      >
                        {/* Tag Badge */}
                        {plan.tag && (
                          <div className="absolute -top-2.5 left-4">
                            <span className={`text-[9.5px] font-black px-2 py-0.5 rounded-full shadow-sm ${
                              plan.isPopular 
                                ? "bg-gradient-to-r from-amber-400 to-orange-500 text-black" 
                                : "bg-gradient-to-r from-[#7045D8] to-purple-400 text-white"
                            }`}>
                              {plan.tag}
                            </span>
                          </div>
                        )}

                        <div className="flex items-center justify-between gap-3 pt-0.5">
                          {/* Left: Radio + Name & Duration */}
                          <div className="flex items-center gap-3 min-w-0">
                            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                              isSelected ? "border-amber-400 bg-amber-400" : "border-gray-500 bg-transparent"
                            }`}>
                              {isSelected && <div className="w-2 h-2 rounded-full bg-black" />}
                            </div>
                            <div className="min-w-0">
                              <h4 className="font-black text-sm text-white truncate">
                                {plan.name}
                              </h4>
                              <p className="text-[11px] text-[#A78BFA] font-medium leading-none mt-0.5">
                                {perDay}
                              </p>
                            </div>
                          </div>

                          {/* Right: Price & Savings */}
                          <div className="text-right shrink-0">
                            <div className="flex items-baseline justify-end gap-1.5">
                              <span className="text-xs text-gray-400 line-through">₹{plan.originalAmount}</span>
                              <span className="text-lg font-black text-white">₹{plan.amount}</span>
                            </div>
                            <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/15 px-1.5 py-0.5 rounded-md">
                              {savings}% OFF
                            </span>
                          </div>
                        </div>

                        {/* Selected Plan Features snippet */}
                        {isSelected && (
                          <motion.div 
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            className="mt-3 pt-2.5 border-t border-white/10 space-y-1 text-xs text-gray-200"
                          >
                            {plan.features.slice(0, 3).map((f, i) => (
                              <div key={i} className="flex items-center gap-1.5 text-[11px]">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                                <span className="truncate">{f}</span>
                              </div>
                            ))}
                          </motion.div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* LAPTOP / DESKTOP VIEW (>= md) : 3-Column Side-by-Side Cards */}
                <div className="hidden md:grid md:grid-cols-3 gap-4 lg:gap-5 items-stretch pt-2">
                  {plans.map((plan) => {
                    const isSelected = selectedPlanId === plan.id;
                    const savings = getSavingsPercent(plan.amount, plan.originalAmount);
                    const perDay = getPerDayCalculation(plan.id, plan.amount);

                    return (
                      <div
                        key={plan.id}
                        onClick={() => handleSelectPlan(plan.id)}
                        className={`relative rounded-3xl p-5 border cursor-pointer transition-all duration-300 flex flex-col justify-between select-none ${
                          plan.isPopular
                            ? isSelected
                              ? "bg-gradient-to-b from-[#7045D8]/35 via-[#221C38] to-[#171329] border-[#A78BFA] ring-2 ring-[#7045D8] shadow-2xl shadow-[#7045D8]/40 scale-[1.02]"
                              : "bg-[#221C38] border-[#7045D8]/60 hover:border-[#7045D8] shadow-lg"
                            : isSelected
                              ? "bg-gradient-to-b from-[#7045D8]/20 via-[#221C38] to-[#171329] border-[#A78BFA] ring-2 ring-[#7045D8]/50 shadow-xl"
                              : "bg-[#221C38]/70 hover:bg-[#221C38] border-white/10 hover:border-white/20"
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
                          <tr className="border-b border-white/10 text-gray-400">
                            <th className="pb-2 font-medium">फ़ीचर (Feature)</th>
                            <th className="pb-2 font-medium text-center">मुफ़्त (Free)</th>
                            <th className="pb-2 font-medium text-center text-amber-400">VIP पास 👑</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5 text-gray-200">
                          <tr>
                            <td className="py-2 font-medium">Disha AI Tutor 24x7</td>
                            <td className="py-2 text-center text-gray-400">3 प्रश्न/दिन</td>
                            <td className="py-2 text-center text-emerald-400 font-bold">असीमित (Unlimited)</td>
                          </tr>
                          <tr>
                            <td className="py-2 font-medium">RPSC / RSMSSB Mock Tests</td>
                            <td className="py-2 text-center text-gray-400">केवल 1 टेस्ट</td>
                            <td className="py-2 text-center text-emerald-400 font-bold">सभी 50+ टेस्ट पेपर्स</td>
                          </tr>
                          <tr>
                            <td className="py-2 font-medium">All-Rajasthan Live Rank</td>
                            <td className="py-2 text-center text-gray-400">❌ नहीं</td>
                            <td className="py-2 text-center text-emerald-400 font-bold">✅ रीयलटाइम लाइव रैंक</td>
                          </tr>
                          <tr>
                            <td className="py-2 font-medium">विस्तृत व्याख्या व शॉर्ट ट्रिक्स</td>
                            <td className="py-2 text-center text-gray-400">बुनियादी</td>
                            <td className="py-2 text-center text-emerald-400 font-bold">✅ सम्पूर्ण व्याख्या</td>
                          </tr>
                          <tr>
                            <td className="py-2 font-medium">मिस्टेक बैंक (गलत प्रश्नों का रिवीज़न)</td>
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

                {isProcessing && statusMessage && (
                  <div className="p-3 rounded-2xl bg-[#7045D8]/20 border border-[#7045D8]/40 text-[#A78BFA] text-xs text-center flex items-center justify-center gap-2 animate-pulse">
                    <Loader2 className="w-4 h-4 animate-spin text-[#A78BFA]" />
                    <span>{statusMessage}</span>
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
                    <span>RBI-Authorized Cashfree PG</span>
                  </div>
                  <span>•</span>
                  <div className="flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5 text-amber-400" />
                    <span>तत्काल 5 सेकंड में एक्टिवेशन</span>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* 3. STICKY BOTTOM CHECKOUT ACTION BAR */}
          {!isAlreadyPremium && !isSuccessState && (
            <div className="px-4 sm:px-6 py-3.5 sm:py-4 border-t border-white/10 bg-[#120f21] z-20 shrink-0 flex flex-col gap-2 pb-[calc(env(safe-area-inset-bottom,0px)+12px)]">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                {/* Left: Summary of Selected Plan */}
                <div className="w-full sm:w-auto text-center sm:text-left">
                  <div className="flex items-center justify-center sm:justify-start gap-2">
                    <span className="text-xs text-gray-300">चुना गया प्लान:</span>
                    <strong className="text-xs sm:text-sm font-black text-white">
                      {selectedPlan.name}
                    </strong>
                    <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/15 px-1.5 py-0.5 rounded">
                      बचत ₹{selectedPlan.originalAmount - selectedPlan.amount}
                    </span>
                  </div>
                  <p className="text-[10.5px] text-[#A78BFA] mt-0.5">
                    {selectedPlan.duration} • कोई अतिरिक्त छुपा शुल्क नहीं
                  </p>
                </div>

                {/* Right: Giant Action Button */}
                <button
                  type="button"
                  onClick={handlePay}
                  disabled={isProcessing}
                  className="w-full sm:w-auto px-8 py-3.5 rounded-2xl bg-gradient-to-r from-[#7045D8] via-[#855fe6] to-[#7045D8] hover:brightness-110 active:scale-[0.98] text-white font-black text-sm sm:text-base shadow-xl shadow-[#7045D8]/40 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 transition-all min-w-[240px]"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>प्रक्रिया जारी है...</span>
                    </>
                  ) : (
                    <>
                      <Zap className="w-5 h-5 text-amber-300 fill-amber-300 animate-bounce" />
                      <span>अभी VIP अनलॉक करें — ₹{selectedPlan.amount}</span>
                    </>
                  )}
                </button>
              </div>

              {/* Payment Methods Supported Icons / Bar */}
              <div className="flex items-center justify-center gap-3 pt-1 text-[10px] text-gray-400 border-t border-white/5">
                <span className="font-semibold text-gray-300">समर्थित:</span>
                <span className="text-gray-300 font-medium">Google Pay</span>
                <span>•</span>
                <span className="text-gray-300 font-medium">PhonePe</span>
                <span>•</span>
                <span className="text-gray-300 font-medium">Paytm</span>
                <span>•</span>
                <span className="text-gray-300 font-medium">BHIM UPI</span>
                <span>•</span>
                <span className="text-gray-300 font-medium">Cards & NetBanking</span>
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
