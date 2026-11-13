import React, { useState, useEffect } from "react";
import { ShieldCheck, Check, X, Lock, ExternalLink } from "lucide-react";
import { getAnalyticsConsent, setAnalyticsConsent } from "../utils/analytics";

interface AnalyticsConsentBannerProps {
  onOpenPrivacyPolicy?: () => void;
}

export const AnalyticsConsentBanner: React.FC<AnalyticsConsentBannerProps> = ({
  onOpenPrivacyPolicy,
}) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Show banner only if user hasn't made a decision yet
    const consent = getAnalyticsConsent();
    if (consent === null) {
      // Delay slightly for smooth appearance
      const timer = setTimeout(() => setIsVisible(true), 1200);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleAccept = () => {
    setAnalyticsConsent("granted");
    setIsVisible(false);
  };

  const handleDecline = () => {
    setAnalyticsConsent("denied");
    setIsVisible(false);
  };

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:max-w-md z-50 animate-in slide-in-from-bottom-5 duration-300">
      <div className="bg-white dark:bg-[#111A2E] rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-2xl p-4 sm:p-5 space-y-3">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div className="space-y-1 text-left min-w-0">
            <h4 className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-1.5">
              <span>Privacy & Anonymous Analytics</span>
              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                No PII / IP
              </span>
            </h4>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
              We use anonymous visitor analytics to understand study material usage and improve speed. No personal data, names, or IP addresses are collected.
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100 dark:border-slate-800/80">
          <button
            onClick={onOpenPrivacyPolicy}
            className="text-[10.5px] font-bold text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-1 cursor-pointer transition-colors"
          >
            <Lock className="w-3 h-3" />
            <span>Privacy Policy</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={handleDecline}
              className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs font-bold transition-all cursor-pointer"
            >
              Decline
            </button>
            <button
              onClick={handleAccept}
              className="px-4 py-1.5 rounded-xl bg-[#1E5BF0] hover:bg-blue-700 text-white text-xs font-black flex items-center gap-1.5 transition-all shadow-md active:scale-95 cursor-pointer"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Accept</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
