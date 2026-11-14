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
      className={`px-3 sm:px-5 py-2.5 bg-white/95 dark:bg-[#1F2330]/95 backdrop-blur-md border-b border-[#E8D9C0] dark:border-[#31374A] select-none ${
        sticky ? "sticky top-0 z-40" : ""
      } ${className}`}
    >
      <div className="max-w-4xl mx-auto flex items-center justify-between gap-2.5">
        {/* Left: Menu trigger or Back button or Logo */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          {onOpenMenu && (
            <button
              type="button"
              onClick={() => {
                triggerHaptic("light");
                onOpenMenu();
              }}
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-[#F7EFE2] dark:bg-[#252A3A] hover:bg-[#EFE3CF] dark:hover:bg-[#31374A] flex items-center justify-center text-[#171923] dark:text-[#FFF9EF] active:scale-95 transition-all cursor-pointer border border-[#E8D9C0] dark:border-[#31374A] shrink-0"
              aria-label="Open menu"
            >
              <Menu className="w-4.5 h-4.5 sm:w-5 sm:h-5" />
            </button>
          )}

          {onBack && !onOpenMenu && (
            <button
              type="button"
              onClick={() => {
                triggerHaptic("light");
                onBack();
              }}
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-[#F7EFE2] dark:bg-[#252A3A] hover:bg-[#EFE3CF] dark:hover:bg-[#31374A] flex items-center justify-center text-[#171923] dark:text-[#FFF9EF] active:scale-95 transition-all cursor-pointer border border-[#E8D9C0] dark:border-[#31374A] shrink-0"
              aria-label="Go back"
            >
              <ArrowLeft className="w-4.5 h-4.5" />
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
                <p className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-[#800020] dark:text-[#F47B20] leading-none mb-0.5 truncate">
                  {eyebrow}
                </p>
              )}
              {title && (
                <h1 className="text-sm sm:text-base md:text-lg font-black text-[#171923] dark:text-[#FFF9EF] tracking-tight leading-tight truncate font-hindi">
                  {title}
                </h1>
              )}
              {subtitle && (
                <p className="text-[10px] sm:text-xs text-[#52576A] dark:text-[#CBD2E1] font-medium leading-none mt-0.5 truncate">
                  {subtitle}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Right: Actions slot */}
        {actions && <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">{actions}</div>}
      </div>
    </header>
  );
};
