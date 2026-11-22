import React, { useState } from "react";
import { 
  X, 
  Crown, 
  CheckCircle2, 
  Sparkles, 
  Zap, 
  ShieldCheck, 
  Lock, 
  Check, 
  Flame, 
  Loader2, 
  HelpCircle,
  Award
} from "lucide-react";
import { PREMIUM_PLANS, PremiumPlan, initiateCashfreePayment } from "../../services/payment/cashfreeService";
import { UserProfile } from "../../types";

interface PremiumUpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser?: UserProfile | null;
  featureTrigger?: "ai_tutor" | "mock_tests" | "profile" | "general";
  onSuccess?: () => void;
}

export const PremiumUpgradeModal: React.FC<PremiumUpgradeModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  featureTrigger = "general",
  onSuccess,
}) => {
  const [selectedPlanId, setSelectedPlanId] = useState<"monthly" | "yearly" | "lifetime">("yearly");
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSuccessState, setIsSuccessState] = useState(false);

  if (!isOpen) return null;

  const isAlreadyPremium = Boolean(currentUser?.isPremium);
  const selectedPlan = PREMIUM_PLANS.find((p) => p.id === selectedPlanId) || PREMIUM_PLANS[1];

  const handlePay = async () => {
    setErrorMessage(null);
    setIsProcessing(true);

    const result = await initiateCashfreePayment(selectedPlanId, (status, msg) => {
      setStatusMessage(msg || "");
    });

    setIsProcessing(false);

    if (result.success) {
      setIsSuccessState(true);
      setTimeout(() => {
        onSuccess?.();
        onClose();
      }, 2500);
    } else if (result.error) {
      setErrorMessage(result.error);
    }
  };

  const getHeadlineForTrigger = () => {
    switch (featureTrigger) {
      case "ai_tutor":
        return {
          title: "Disha AI Tutor अनलिमिटेड अनलॉक करें",
          subtitle: "24x7 तत्काल समाधान, शंका निवारण और गहन परीक्षा तैयारी",
        };
      case "mock_tests":
        return {
          title: "सभी RPSC & RSMSSB Mock Tests अनलॉक करें",
          subtitle: "असीमित टेस्ट सीरीज़, मेरिट रैंकिंग और पूर्ण समाधान",
        };
      default:
        return {
          title: "Disha PYQ VIP प्रीमियम में अपग्रेड करें",
          subtitle: "राजस्थान प्रतियोगी परीक्षाओं में शत-प्रतिशत सफलता की दिशा",
        };
    }
  };

  const { title, subtitle } = getHeadlineForTrigger();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div 
        className="relative w-full max-w-lg bg-[#171329] border border-[#7045D8]/40 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
        style={{
          boxShadow: "0 20px 60px -15px rgba(112, 69, 216, 0.35)",
        }}
      >
        {/* Glow Header Accent */}
        <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-[#7045D8]/30 via-[#7045D8]/10 to-transparent pointer-events-none" />

        {/* Top Header Bar */}
        <div className="relative flex items-center justify-between p-4 sm:p-5 border-b border-white/10 z-10">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-md shadow-amber-500/20">
              <Crown className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold text-white text-base tracking-wide">Disha PYQ</span>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-gradient-to-r from-amber-400 to-amber-600 text-black uppercase tracking-wider">
                  VIP
                </span>
              </div>
              <p className="text-xs text-[#A78BFA]">प्रीमियम एक्सेस पास</p>
            </div>
          </div>

          <button
            onClick={onClose}
            disabled={isProcessing}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-gray-300 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-5 text-white z-10 flex-1">
          {isSuccessState ? (
            <div className="py-10 text-center space-y-4">
              <div className="w-20 h-20 mx-auto rounded-full bg-emerald-500/20 border-2 border-emerald-500 flex items-center justify-center text-emerald-400 animate-bounce">
                <Check className="w-10 h-10 stroke-[3]" />
              </div>
              <h3 className="text-2xl font-black text-white">बधाई हो! 🎉</h3>
              <p className="text-sm text-gray-300 max-w-sm mx-auto">
                आपका <strong>Disha PYQ VIP प्रीमियम</strong> सफलतापूर्वक सक्रिय कर दिया गया है। सभी टेस्ट और AI Tutor अब पूरी तरह अनलॉक हैं।
              </p>
            </div>
          ) : isAlreadyPremium ? (
            <div className="py-6 text-center space-y-4 bg-white/5 rounded-2xl border border-white/10 p-5">
              <div className="w-16 h-16 mx-auto rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
                <Award className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold text-white">आप पहले से प्रीमियम VIP सदस्य हैं</h3>
              <p className="text-xs text-gray-300">
                सक्रिय प्लान: <strong className="text-amber-400 capitalize">{currentUser.premiumPlan || "Active VIP"}</strong>
                {currentUser.premiumUntil && (
                  <span className="block mt-1 text-gray-400">
                    वैधता: {new Date(currentUser.premiumUntil).toLocaleDateString("hi-IN", { day: "numeric", month: "long", year: "numeric" })}
                  </span>
                )}
              </p>
              <div className="pt-2">
                <button
                  onClick={onClose}
                  className="w-full py-3 rounded-xl bg-[#7045D8] text-white font-bold hover:bg-[#5b34be] transition-colors"
                >
                  ऐप जारी रखें
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Headline */}
              <div className="text-center space-y-1">
                <h2 className="text-lg sm:text-xl font-black text-white">{title}</h2>
                <p className="text-xs text-gray-300 leading-relaxed">{subtitle}</p>
              </div>

              {/* Pricing Cards Selector */}
              <div className="grid grid-cols-3 gap-2 sm:gap-2.5">
                {PREMIUM_PLANS.map((plan) => {
                  const isSelected = selectedPlanId === plan.id;
                  return (
                    <div
                      key={plan.id}
                      onClick={() => !isProcessing && setSelectedPlanId(plan.id)}
                      className={`relative p-3 rounded-2xl border cursor-pointer transition-all duration-200 flex flex-col justify-between text-center select-none ${
                        isSelected
                          ? "bg-gradient-to-b from-[#7045D8]/40 to-[#7045D8]/10 border-[#A78BFA] ring-2 ring-[#7045D8]/60 shadow-lg shadow-[#7045D8]/25"
                          : "bg-white/5 border-white/10 hover:border-white/20 hover:bg-white/[0.08]"
                      }`}
                    >
                      {/* Popular / Best Value Badge */}
                      {plan.tag && (
                        <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 whitespace-nowrap">
                          <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full shadow-sm ${
                            plan.isPopular 
                              ? "bg-gradient-to-r from-amber-400 to-orange-500 text-black" 
                              : "bg-gradient-to-r from-purple-400 to-indigo-500 text-white"
                          }`}>
                            {plan.tag}
                          </span>
                        </div>
                      )}

                      <div className="pt-1">
                        <span className="text-[11px] font-medium text-gray-300 block line-clamp-1">{plan.name}</span>
                        <div className="mt-1 flex items-baseline justify-center gap-1">
                          <span className="text-lg sm:text-xl font-black text-white">₹{plan.amount}</span>
                        </div>
                        <span className="text-[10px] text-gray-400 line-through">₹{plan.originalAmount}</span>
                      </div>

                      <div className="mt-2 pt-2 border-t border-white/10 text-[10px] text-[#A78BFA] font-medium">
                        {plan.duration}
                      </div>

                      {isSelected && (
                        <div className="absolute -bottom-1.5 -right-1.5 w-5 h-5 rounded-full bg-[#7045D8] border border-white flex items-center justify-center text-white">
                          <Check className="w-3 h-3 stroke-[3]" />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Selected Plan Benefits */}
              <div className="bg-white/5 rounded-2xl p-4 border border-white/10 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-gray-200 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    {selectedPlan.name} के विशेष लाभ:
                  </span>
                  <span className="text-[11px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                    {Math.round(((selectedPlan.originalAmount - selectedPlan.amount) / selectedPlan.originalAmount) * 100)}% छूट
                  </span>
                </div>

                <div className="space-y-1.5 pt-1">
                  {selectedPlan.features.map((feat, idx) => (
                    <div key={idx} className="flex items-start gap-2 text-xs text-gray-200">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 mt-0.5 shrink-0" />
                      <span>{feat}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Error Message */}
              {errorMessage && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs text-center flex items-center justify-center gap-2">
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Status Notice */}
              {isProcessing && statusMessage && (
                <div className="p-2.5 rounded-xl bg-[#7045D8]/20 border border-[#7045D8]/40 text-[#A78BFA] text-xs text-center flex items-center justify-center gap-2 animate-pulse">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-[#A78BFA]" />
                  <span>{statusMessage}</span>
                </div>
              )}

              {/* Trust & Payment Logos */}
              <div className="pt-1 flex items-center justify-center gap-3 text-gray-400 text-[10px]">
                <div className="flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Cashfree Verified PG</span>
                </div>
                <span>•</span>
                <span>UPI (GPay / PhonePe / Paytm)</span>
                <span>•</span>
                <span>100% सुरक्षित</span>
              </div>
            </>
          )}
        </div>

        {/* Footer Checkout Action */}
        {!isAlreadyPremium && !isSuccessState && (
          <div className="p-4 sm:p-5 border-t border-white/10 bg-[#120f21] z-10 flex flex-col gap-2">
            <button
              onClick={handlePay}
              disabled={isProcessing}
              className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-[#7045D8] via-[#855fe6] to-[#7045D8] hover:from-[#5e34ca] hover:to-[#5e34ca] text-white font-extrabold text-sm sm:text-base shadow-lg shadow-[#7045D8]/30 hover:shadow-[#7045D8]/50 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>प्रक्रिया चल रही है...</span>
                </>
              ) : (
                <>
                  <Zap className="w-5 h-5 text-amber-300 fill-amber-300" />
                  <span>अभी अनलॉक करें — केवल ₹{selectedPlan.amount}</span>
                </>
              )}
            </button>
            <p className="text-[10px] text-center text-gray-400">
              सुरक्षित 256-बिट एन्क्रिप्शन द्वारा संचालित। तत्काल सक्रियता।
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
