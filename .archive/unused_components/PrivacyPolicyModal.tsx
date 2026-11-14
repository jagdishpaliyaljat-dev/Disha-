import React, { useState, useEffect } from "react";
import { ShieldCheck, X, Lock, Check, ToggleLeft, ToggleRight, EyeOff } from "lucide-react";
import { getAnalyticsConsent, setAnalyticsConsent, ConsentStatus } from "../utils/analytics";

interface PrivacyPolicyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PrivacyPolicyModal: React.FC<PrivacyPolicyModalProps> = ({ isOpen, onClose }) => {
  const [consent, setConsent] = useState<ConsentStatus>(() => getAnalyticsConsent());

  useEffect(() => {
    if (isOpen) {
      setConsent(getAnalyticsConsent());
    }
  }, [isOpen]);

  const handleToggleConsent = () => {
    const nextStatus = consent === "granted" ? "denied" : "granted";
    setAnalyticsConsent(nextStatus);
    setConsent(nextStatus);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white dark:bg-[#111A2E] w-full max-w-xl rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6 space-y-5 my-auto max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900 dark:text-white">
                Privacy Policy & Visitor Data
              </h3>
              <p className="text-xs text-slate-400">
                DISHA 20-20 Privacy & Analytics Safeguards
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-4 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
          <div className="p-3.5 rounded-2xl bg-blue-50/60 dark:bg-slate-900 border border-blue-100 dark:border-slate-800 space-y-2">
            <h4 className="font-extrabold text-blue-900 dark:text-blue-300 flex items-center gap-1.5 uppercase tracking-wider text-[10px]">
              <ShieldCheck className="w-4 h-4 text-blue-600" />
              <span>Zero Personal Identification Policy</span>
            </h4>
            <p>
              DISHA 20-20 is built for students preparing for RPSC, RAS, and RSMSSB competitive exams. We respect student privacy. We never store IP addresses, personal identification, or contact info in our analytics metrics.
            </p>
          </div>

          <div className="space-y-2">
            <h5 className="font-bold text-slate-900 dark:text-white text-xs uppercase tracking-wider">
              1. What Data We Collect (When Opted In)
            </h5>
            <ul className="list-disc pl-5 space-y-1 text-slate-500 dark:text-slate-400">
              <li>Anonymous page views and route transitions (e.g., Home, News, Topics).</li>
              <li>Traffic acquisition sources (Google, Telegram, WhatsApp link tags).</li>
              <li>Device category split (Mobile vs Desktop) to optimize screen layouts.</li>
              <li>Anonymous, random visitor ID stored in your local browser storage.</li>
            </ul>
          </div>

          <div className="space-y-2">
            <h5 className="font-bold text-slate-900 dark:text-white text-xs uppercase tracking-wider">
              2. What We Never Collect
            </h5>
            <ul className="list-disc pl-5 space-y-1 text-slate-500 dark:text-slate-400">
              <li>No IP address logging or geolocation tracking.</li>
              <li>No personal credentials, names, emails, or phone numbers in event tags.</li>
              <li>No tracking across external third-party advertising networks.</li>
            </ul>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-4">
            <div>
              <div className="font-extrabold text-slate-900 dark:text-white">
                Analytics Tracking Status
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {consent === "granted" ? "Tracking enabled (Anonymous)" : "Tracking disabled"}
              </p>
            </div>

            <button
              onClick={handleToggleConsent}
              className={`px-4 py-2 rounded-xl text-xs font-black flex items-center gap-2 transition-all cursor-pointer ${
                consent === "granted"
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30"
                  : "bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
              }`}
            >
              {consent === "granted" ? (
                <>
                  <ToggleRight className="w-5 h-5 text-emerald-600" />
                  <span>Enabled</span>
                </>
              ) : (
                <>
                  <ToggleLeft className="w-5 h-5 text-slate-400" />
                  <span>Disabled</span>
                </>
              )}
            </button>
          </div>
        </div>

        <div className="flex items-center justify-end pt-2 border-t border-slate-100 dark:border-slate-800">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-[#1E5BF0] hover:bg-blue-700 text-white rounded-xl text-xs font-black transition-all shadow-md active:scale-95 cursor-pointer"
          >
            Close Privacy Policy
          </button>
        </div>
      </div>
    </div>
  );
};
