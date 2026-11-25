import React from "react";
import { ArrowLeft, Menu } from "lucide-react";
import { AppLogo } from "../AppLogo";
import { triggerHaptic } from "../../utils/audioFeedback";

export interface AppHeaderProps {
  title?: string;
  subtitle?: string;
  eyebrow?: string;
  onBack?: () => void;
  onOpenMenu?: () => void;
  showLogo?: boolean;
  actions?: React.ReactNode;
  sticky?: boolean;
  className?: string;
}

export const AppHeader: React.FC<AppHeaderProps> = ({
  title,
  subtitle,
  eyebrow,
  onBack,
  onOpenMenu,
  showLogo = false,
  actions,
  sticky = true,
  className = "",
}) => {
  return (
    <header
      className={`bg-white/95 dark:bg-[#1B1536]/95 backdrop-blur-md border-b border-slate-200 dark:border-[#31275E] select-none pt-[env(safe-area-inset-top,0px)] md:pt-0 ${
        sticky ? "sticky top-0 md:top-14 z-30" : ""
      } ${className}`}
    >
      <div className="max-w-4xl mx-auto px-3.5 sm:px-5 min-h-[60px] py-2 flex items-center justify-between gap-2.5">
        {/* Left: Menu trigger or Back button or Logo */}
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
          {onOpenMenu && (
            <button
              type="button"
              onClick={() => {
                triggerHaptic("light");
                onOpenMenu();
              }}
              className="w-11 h-11 rounded-xl bg-slate-100 dark:bg-[#241D48] hover:bg-slate-200/80 dark:hover:bg-[#31275E] flex items-center justify-center text-slate-900 dark:text-slate-50 active:scale-95 transition-all cursor-pointer border border-slate-200 dark:border-[#31275E] shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7045D8]"
              aria-label="Open menu"
            >
              <Menu className="w-5 h-5" />
            </button>
          )}

          {onBack && !onOpenMenu && (
            <button
              type="button"
              onClick={() => {
                triggerHaptic("light");
                onBack();
              }}
              className="w-11 h-11 rounded-xl bg-slate-100 dark:bg-[#241D48] hover:bg-slate-200/80 dark:hover:bg-[#31275E] flex items-center justify-center text-slate-900 dark:text-slate-50 active:scale-95 transition-all cursor-pointer border border-slate-200 dark:border-[#31275E] shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7045D8]"
              aria-label="Go back"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}

          {showLogo && (
            <div className="shrink-0 flex items-center gap-1.5 sm:gap-2">
              <AppLogo size="sm" variant="horizontal" showTagline={false} />
            </div>
          )}

          {/* Title and Eyebrow */}
          {(title || eyebrow || subtitle) && (
            <div className="min-w-0">
              {eyebrow && (
                <p className="text-[11px] font-black uppercase tracking-wider text-[#7045D8] dark:text-[#A78BFA] leading-none mb-0.5 truncate">
                  {eyebrow}
                </p>
              )}
              {title && (
                <h1 className="text-sm sm:text-base md:text-lg font-black text-slate-900 dark:text-slate-50 tracking-tight leading-tight truncate font-hindi">
                  {title}
                </h1>
              )}
              {subtitle && (
                <p className="text-[11px] sm:text-xs text-slate-600 dark:text-slate-300 font-medium leading-none mt-0.5 truncate">
                  {subtitle}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Right: Actions slot */}
        {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
      </div>
    </header>
  );
};
