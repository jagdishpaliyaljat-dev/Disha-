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
  QrCode,
  Copy,
  ExternalLink,
  AlertTriangle,
  LogIn,
  ArrowRight,
  Clock
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { PREMIUM_PLANS, PremiumPlan, initiateCashfreePayment, getPremiumPlansList } from "../../services/payment/cashfreeService";
import { 
  getLocalPaymentGatewayConfig, 
  PaymentGatewayConfig, 
  fetchPaymentGatewayConfigFromCloud 
} from "../../services/payment/premiumConfigService";
import { 
  generateUpiDeepLink, 
  generateUpiQrUrl, 
  submitStudentUpiPayment 
} from "../../services/payment/upiPaymentService";
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
  const [paymentMethodTab, setPaymentMethodTab] = useState<"upi" | "cashfree">("upi");
  const [gatewayConfig, setGatewayConfig] = useState<PaymentGatewayConfig>(() => getLocalPaymentGatewayConfig());
  
  // UPI Form state
  const [utrNumber, setUtrNumber] = useState("");
  const [copiedUpi, setCopiedUpi] = useState(false);
  const [isUpiSubmitting, setIsUpiSubmitting] = useState(false);
  const [upiSubmittedSuccess, setUpiSubmittedSuccess] = useState(false);

  // Cashfree state
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSuccessState, setIsSuccessState] = useState(false);
  const [showComparison, setShowComparison] = useState(false);

  // Sync dynamic plans and gateway settings
  useEffect(() => {
    fetchPaymentGatewayConfigFromCloud().then(cfg => {
      setGatewayConfig(cfg);
      if (!cfg.cashfree?.enabled && cfg.upi?.enabled) {
        setPaymentMethodTab("upi");
      }
    });

    const handleConfigUpdate = (e: any) => {
      if (e.detail?.plans) {
        setPlans(e.detail.plans.filter((p: any) => p.enabled !== false));
      } else {
        setPlans(getPremiumPlansList());
      }
    };

    const handleGatewayUpdate = (e: any) => {
      if (e.detail) {
        setGatewayConfig(e.detail);
      }
    };

    if (typeof window !== "undefined") {
      window.addEventListener("disha_premium_config_updated", handleConfigUpdate);
      window.addEventListener("disha_gateway_config_updated", handleGatewayUpdate);
    }
    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("disha_premium_config_updated", handleConfigUpdate);
        window.removeEventListener("disha_gateway_config_updated", handleGatewayUpdate);
      }
    };
  }, []);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen && !isProcessing && !isUpiSubmitting) {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isProcessing, isUpiSubmitting, onClose]);

  if (!isOpen) return null;

  const isAlreadyPremium = Boolean(currentUser?.isPremium);
  const isAuth = isProfileAuthenticated(currentUser || null);
  const selectedPlan = plans.find((p) => p.id === selectedPlanId) || plans[0] || PREMIUM_PLANS[0];

  const upiId = gatewayConfig.upi?.upiId || "jagdishpaliyaljat@okhdfcbank";
  const payeeName = gatewayConfig.upi?.payeeName || "Disha PYQ Online";
  const upiDeepLink = generateUpiDeepLink(upiId, payeeName, selectedPlan.amount, selectedPlan.name);
  const upiQrUrl = generateUpiQrUrl(upiDeepLink, 240);

  const handleSelectPlan = (planId: "monthly" | "yearly" | "lifetime") => {
    if (isProcessing || isUpiSubmitting) return;
    triggerHaptic("light");
    playClickSound();
    setSelectedPlanId(planId);
    setUtrNumber("");
  };

  const handleCopyUpiId = () => {
    triggerHaptic("light");
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(upiId);
      setCopiedUpi(true);
      setTimeout(() => setCopiedUpi(false), 2500);
    }
  };

  const handleOpenUpiApp = () => {
    triggerHaptic("medium");
    window.location.href = upiDeepLink;
  };

  // Submit UPI UTR
  const handleUpiSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAuth) {
      triggerHaptic("warning");
      setErrorMessage("प्रीमियम सक्रिय करने से पहले कृपया लॉगिन करें।");
      return;
    }
    if (!utrNumber.trim() || utrNumber.trim().length < 6) {
      triggerHaptic("warning");
      setErrorMessage("कृपया 12 अंकों का सही UTR / Transaction No. दर्ज करें।");
      return;
    }

    setErrorMessage(null);
    setIsUpiSubmitting(true);
    triggerHaptic("medium");

    const res = await submitStudentUpiPayment({
      userId: currentUser!.id,
      userEmail: currentUser?.email,
      userName: currentUser?.name,
      planId: selectedPlanId,
      amount: selectedPlan.amount,
      utrNumber: utrNumber.trim(),
    });

    setIsUpiSubmitting(false);

    if (res.success) {
      triggerHaptic("success");
      if (res.isPremium) {
        setIsSuccessState(true);
        setTimeout(() => {
          onSuccess?.();
          onClose();
        }, 2500);
      } else {
        setUpiSubmittedSuccess(true);
      }
    } else {
      triggerHaptic("warning");
      setErrorMessage(res.error || "भुगतान दर्ज करने में समस्या आई।");
    }
  };

  // Cashfree Checkout
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
      // Auto-fallback suggestion
      if (result.error.includes("credential") || result.error.includes("Cashfree") || result.error.includes("500")) {
        setPaymentMethodTab("upi");
      }
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
          onClick={() => !isProcessing && !isUpiSubmitting && onClose()}
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
              disabled={isProcessing || isUpiSubmitting}
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
            ) : upiSubmittedSuccess ? (
              /* UPI Submitted for Manual Verification */
              <div className="p-6 rounded-3xl bg-gradient-to-br from-emerald-500/15 via-[#1F1938] to-emerald-500/10 border border-emerald-500/30 text-center space-y-4">
                <div className="w-14 h-14 rounded-2xl bg-emerald-500 text-black flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/30">
                  <Clock className="w-7 h-7" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-lg sm:text-xl font-black text-white">
                    आपका भुगतान UTR प्राप्त हो गया है!
                  </h3>
                  <p className="text-xs text-emerald-300 font-mono font-bold">
                    UTR: {utrNumber}
                  </p>
                </div>
                <p className="text-xs text-gray-300 max-w-md mx-auto leading-relaxed">
                  हमारी टीम आपके भुगतान का सत्यापन कर रही है। अगले <strong>5 से 15 मिनट</strong> में आपका VIP पास स्वतः सक्रिय हो जाएगा।
                </p>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs cursor-pointer shadow-lg shadow-emerald-600/30"
                >
                  ठीक है, धन्यवाद
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

                {/* C. PAYMENT METHOD TABS (UPI QR Code vs Cashfree PG) */}
                <div className="pt-2 space-y-4">
                  <div className="flex items-center justify-center gap-2 p-1 bg-[#201838] rounded-2xl border border-white/10 max-w-md mx-auto">
                    <button
                      type="button"
                      onClick={() => {
                        triggerHaptic("light");
                        setPaymentMethodTab("upi");
                      }}
                      className={`flex-1 py-2 px-3 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                        paymentMethodTab === "upi"
                          ? "bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md"
                          : "text-gray-400 hover:text-white"
                      }`}
                    >
                      <QrCode className="w-4 h-4" />
                      <span>⚡ UPI QR / Apps (100% कार्यशील)</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        triggerHaptic("light");
                        setPaymentMethodTab("cashfree");
                      }}
                      className={`flex-1 py-2 px-3 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                        paymentMethodTab === "cashfree"
                          ? "bg-gradient-to-r from-[#7045D8] to-[#855fe6] text-white shadow-md"
                          : "text-gray-400 hover:text-white"
                      }`}
                    >
                      <CreditCard className="w-4 h-4" />
                      <span>💳 कार्ड / नेटबैंकिंग</span>
                    </button>
                  </div>

                  {/* TAB 1: UPI QR CODE & DIRECT APP INTENT */}
                  {paymentMethodTab === "upi" && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.98 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="p-5 sm:p-6 rounded-3xl bg-[#1C1630] border border-emerald-500/30 space-y-5"
                    >
                      <div className="flex flex-col sm:flex-row items-center gap-6">
                        {/* Dynamic QR Code */}
                        <div className="p-3 bg-white rounded-2xl shadow-xl flex flex-col items-center justify-center shrink-0 border border-white/20">
                          <img
                            src={upiQrUrl}
                            alt="UPI QR Code"
                            className="w-40 h-40 sm:w-44 sm:h-44 object-contain rounded-lg"
                          />
                          <span className="text-[10px] font-black text-slate-800 mt-1 uppercase tracking-wider">
                            ₹{selectedPlan.amount} • स्कैन करें
                          </span>
                        </div>

                        {/* Steps & Direct App Button */}
                        <div className="flex-1 space-y-3.5 text-left w-full">
                          <div>
                            <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400">
                              आसान व सुरक्षित भुगतान
                            </span>
                            <h4 className="text-base sm:text-lg font-black text-white">
                              Google Pay, PhonePe, Paytm या BHIM से पे करें
                            </h4>
                            <p className="text-xs text-gray-300 mt-0.5">
                              QR कोड स्कैन करें या नीचे दिए बटन से सीधे अपनी UPI ऐप में खोलें:
                            </p>
                          </div>

                          {/* Direct Mobile UPI App Button */}
                          <button
                            type="button"
                            onClick={handleOpenUpiApp}
                            className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:brightness-110 active:scale-95 text-white font-black text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/30 cursor-pointer"
                          >
                            <ExternalLink className="w-4 h-4" />
                            <span>📲 सीधे UPI ऐप में खोलें (Pay ₹{selectedPlan.amount})</span>
                          </button>

                          {/* Copy UPI ID Bar */}
                          <div className="flex items-center gap-2 p-2.5 bg-black/40 rounded-xl border border-white/10 text-xs">
                            <span className="text-gray-400 font-mono text-[11px]">UPI ID:</span>
                            <strong className="text-white font-mono text-xs select-all flex-1 truncate">
                              {upiId}
                            </strong>
                            <button
                              type="button"
                              onClick={handleCopyUpiId}
                              className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-gray-200 text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                            >
                              <Copy className="w-3 h-3" />
                              <span>{copiedUpi ? "कॉपी हो गया!" : "कॉपी"}</span>
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* UTR Submission Form */}
                      <form onSubmit={handleUpiSubmit} className="pt-3 border-t border-white/10 space-y-3">
                        <div className="flex flex-col sm:flex-row items-center gap-3">
                          <div className="flex-1 w-full">
                            <label className="block text-xs font-bold text-gray-200 mb-1">
                              भुगतान के बाद 12 अंकों का UTR / Transaction ID दर्ज करें:
                            </label>
                            <input
                              type="text"
                              value={utrNumber}
                              onChange={(e) => setUtrNumber(e.target.value)}
                              placeholder="उदा. 423456789012 या UPI Ref No."
                              className="w-full px-4 py-2.5 rounded-xl bg-black/50 border border-white/20 text-white font-mono text-sm focus:outline-none focus:border-emerald-400 transition-colors"
                            />
                          </div>
                          <button
                            type="submit"
                            disabled={isUpiSubmitting}
                            className="w-full sm:w-auto mt-0 sm:mt-5 px-6 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-black font-black text-xs flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-emerald-500/30 disabled:opacity-50 shrink-0"
                          >
                            {isUpiSubmitting ? (
                              <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                <span>सत्यापित हो रहा है...</span>
                              </>
                            ) : (
                              <>
                                <CheckCircle2 className="w-4 h-4" />
                                <span>सबमिट करें व VIP अनलॉक करें</span>
                              </>
                            )}
                          </button>
                        </div>
                        <p className="text-[11px] text-gray-400">
                          ℹ️ UPI ऐप की रसीद में <strong>12 अंकों का UTR / UPI Ref No</strong> होता है। सबमिट करते ही VIP पास तुरंत सक्रिय हो जाएगा।
                        </p>
                      </form>
                    </motion.div>
                  )}

                  {/* TAB 2: CASHFREE ONLINE GATEWAY */}
                  {paymentMethodTab === "cashfree" && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.98 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="p-5 rounded-3xl bg-[#1C1630] border border-white/10 space-y-4 text-center"
                    >
                      <div className="max-w-md mx-auto space-y-2">
                        <CreditCard className="w-8 h-8 text-[#A78BFA] mx-auto" />
                        <h4 className="text-base font-black text-white">
                          Cashfree ऑनलाइन पेमेंट गेटवे
                        </h4>
                        <p className="text-xs text-gray-300">
                          क्रेडिट/डेबिट कार्ड्स, नेटबैंकिंग और वॉलेट्स द्वारा त्वरित स्वचालित भुगतान।
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={handlePay}
                        disabled={isProcessing}
                        className="px-8 py-3 rounded-2xl bg-gradient-to-r from-[#7045D8] to-[#855fe6] hover:brightness-110 active:scale-95 text-white font-black text-sm flex items-center justify-center gap-2 mx-auto cursor-pointer shadow-xl shadow-[#7045D8]/40 disabled:opacity-50"
                      >
                        {isProcessing ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>{statusMessage || "गेटवे लोड हो रहा है..."}</span>
                          </>
                        ) : (
                          <>
                            <Lock className="w-4 h-4" />
                            <span>सुरक्षित गेटवे से पे करें (₹{selectedPlan.amount})</span>
                          </>
                        )}
                      </button>
                    </motion.div>
                  )}
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
