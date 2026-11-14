import React from "react";
import { X, Sparkles, CheckCircle2, Bookmark, ShieldAlert, User, ArrowRight } from "lucide-react";

interface LoginPromptModalProps {
  isOpen: boolean;
  featureTitle?: string;
  featureDescription?: string;
  featureIcon?: "progress" | "wrong" | "profile" | "settings" | "bookmark";
  onClose: () => void;
  onLoginClick: () => void;
}

export const LoginPromptModal: React.FC<LoginPromptModalProps> = ({
  isOpen,
  featureTitle = "Login to use this feature",
  featureDescription = "Sign in to save your personal test results, track mistakes, and sync your progress across devices.",
  featureIcon = "progress",
  onClose,
  onLoginClick,
}) => {
  if (!isOpen) return null;

  const renderIcon = () => {
    switch (featureIcon) {
      case "wrong":
        return (
          <div className="w-14 h-14 rounded-2xl bg-[#800020]/10 dark:bg-[#800020]/30 text-[#800020] dark:text-[#F47B20] flex items-center justify-center shadow-xs">
            <ShieldAlert className="w-7 h-7" />
          </div>
        );
      case "profile":
        return (
          <div className="w-14 h-14 rounded-2xl bg-[#F47B20]/15 text-[#F47B20] flex items-center justify-center shadow-xs">
            <User className="w-7 h-7" />
          </div>
        );
      case "bookmark":
        return (
          <div className="w-14 h-14 rounded-2xl bg-[#C99A45]/15 text-[#C99A45] flex items-center justify-center shadow-xs">
            <Bookmark className="w-7 h-7" />
          </div>
        );
      case "progress":
      default:
        return (
          <div className="w-14 h-14 rounded-2xl bg-[#800020]/10 dark:bg-[#F47B20]/15 text-[#800020] dark:text-[#F47B20] flex items-center justify-center shadow-xs">
            <Sparkles className="w-7 h-7" />
          </div>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#171923]/65 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-[#FFF9EF] dark:bg-[#1F2330] w-full max-w-sm rounded-3xl p-6 shadow-2xl border border-[#E8D9C0] dark:border-[#31374A] space-y-5 text-center relative">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 p-2 rounded-xl text-[#52576A] hover:text-[#171923] dark:text-[#929AB0] dark:hover:text-[#FFF9EF] hover:bg-[#F7EFE2] dark:hover:bg-[#252A3A] transition-colors cursor-pointer"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex flex-col items-center pt-2 space-y-3">
          {renderIcon()}
          <div>
            <h3 className="text-lg font-extrabold text-[#171923] dark:text-[#FFF9EF] tracking-tight">
              {featureTitle}
            </h3>
            <p className="text-xs text-[#52576A] dark:text-[#CBD2E1] mt-1 leading-relaxed">
              {featureDescription}
            </p>
          </div>
        </div>

        <div className="bg-white dark:bg-[#171923] p-3.5 rounded-2xl border border-[#E8D9C0] dark:border-[#31374A] text-left space-y-2">
          {[
            "Save your test scores & revision history",
            "Bookmark difficult MCQs & revise wrong answers",
            "Keep your progress synced across phone & laptop",
          ].map((text, i) => (
            <div key={i} className="flex items-center gap-2 text-[11px] text-[#171923] dark:text-[#CBD2E1] font-medium">
              <CheckCircle2 className="w-3.5 h-3.5 text-[#15803D] dark:text-[#22C55E] shrink-0" />
              <span>{text}</span>
            </div>
          ))}
        </div>

        <div className="space-y-2 pt-1">
          <button
            onClick={() => {
              onClose();
              onLoginClick();
            }}
            className="w-full h-12 bg-[#800020] hover:bg-[#5E0017] dark:bg-[#F47B20] dark:hover:bg-[#E06A12] text-white rounded-2xl font-extrabold text-xs flex items-center justify-center gap-2 shadow-sm active:scale-95 transition-all cursor-pointer"
          >
            <span>Sign in to DISHA 20-20</span>
            <ArrowRight className="w-4 h-4" />
          </button>

          <button
            onClick={onClose}
            className="w-full py-2.5 text-xs font-semibold text-[#52576A] hover:text-[#171923] dark:text-[#929AB0] dark:hover:text-[#FFF9EF] cursor-pointer transition-colors"
          >
            Continue as Guest / Not Now
          </button>
        </div>
      </div>
    </div>
  );
};
