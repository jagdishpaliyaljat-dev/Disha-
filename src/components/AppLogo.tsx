import React from "react";

export type LogoVariant = "primary" | "horizontal" | "symbol" | "icon";
export type LogoTheme = "auto" | "light" | "dark";

interface AppLogoProps {
  size?: "xs" | "sm" | "md" | "lg" | "xl" | "hero";
  variant?: LogoVariant;
  theme?: LogoTheme;
  /** @deprecated Prefer `theme` */
  textColor?: "dark" | "light" | "auto";
  className?: string;
  showText?: boolean;
  showTagline?: boolean;
  showHindi?: boolean;
  showIcon?: boolean;
}

export const AppLogo: React.FC<AppLogoProps> = ({
  size = "md",
  variant = "horizontal",
  theme,
  textColor = "auto",
  className = "",
  showText = true,
  showTagline = false,
  showIcon = true,
}) => {
  const effectiveTheme: LogoTheme =
    theme ??
    (textColor === "light" ? "dark" : textColor === "dark" ? "light" : "auto");

  const sizeMap = {
    xs: "w-7 h-7",
    sm: "w-8 h-8",
    md: "w-10 h-10",
    lg: "w-12 h-12",
    xl: "w-16 h-16",
    hero: "w-20 h-20 sm:w-24 sm:h-24",
  };

  const titleClasses =
    effectiveTheme === "light"
      ? "text-slate-900"
      : effectiveTheme === "dark"
      ? "text-[#FFFFFF]"
      : "text-slate-900 dark:text-[#FFFFFF]";

  const brandWordClasses =
    effectiveTheme === "light"
      ? "text-slate-900"
      : effectiveTheme === "dark"
      ? "text-[#FFFFFF]"
      : "text-slate-900 dark:text-[#FFFFFF]";

  const subClasses =
    effectiveTheme === "light"
      ? "text-[#5E5873]"
      : effectiveTheme === "dark"
      ? "text-[#A39DBE]"
      : "text-[#5E5873] dark:text-[#A39DBE]";

  const renderMark = () => {
    return (
      <img
        src="/brand-logo.png"
        alt="Disha PYQ Logo"
        className="w-full h-full object-contain filter drop-shadow-xs"
      />
    );
  };

  if (variant === "icon" || variant === "symbol" || !showText) {
    return (
      <div className={`inline-flex items-center justify-center shrink-0 select-none ${sizeMap[size]} ${className}`}>
        {renderMark()}
      </div>
    );
  }

  if (variant === "primary") {
    return (
      <div className={`inline-flex flex-col items-center text-center select-none ${className}`}>
        {showIcon && (
          <div className={`${sizeMap[size]} shrink-0 mb-2 shadow-sm rounded-2xl overflow-hidden`}>
            {renderMark()}
          </div>
        )}
        <div className="flex items-center gap-2 leading-none shrink-0 whitespace-nowrap">
          <span
            className={`font-black tracking-tight shrink-0 whitespace-nowrap ${brandWordClasses} ${
              size === "hero" ? "text-3xl sm:text-4xl" : size === "xl" ? "text-2xl" : "text-xl"
            }`}
          >
            DISHA
          </span>
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-lg bg-gradient-to-r from-[#7045D8] to-[#A78BFA] text-white font-black tracking-wide text-sm sm:text-base shadow-xs shrink-0 whitespace-nowrap">
            PYQ
          </span>
        </div>
        <div className={`mt-1.5 text-[11px] font-extrabold tracking-[0.16em] uppercase shrink-0 whitespace-nowrap ${titleClasses}`}>
          PREVIOUS YEAR QUESTIONS
        </div>
        {showTagline && (
          <p className={`text-[11px] font-medium mt-1 truncate ${subClasses}`}>
            Previous Year Questions • Precision Learning
          </p>
        )}
      </div>
    );
  }

  // Horizontal lockup (default for top bars & cards)
  return (
    <div className={`inline-flex items-center ${showIcon ? "gap-2.5" : "gap-0"} select-none min-w-0 shrink-0 whitespace-nowrap ${className}`}>
      {showIcon && (
        <div className={`${sizeMap[size]} shrink-0 flex items-center justify-center`}>
          {renderMark()}
        </div>
      )}
      <div className="flex flex-col min-w-0 shrink-0">
        <div className="flex items-center gap-1.5 leading-none shrink-0 whitespace-nowrap">
          <span
            className={`font-black tracking-tight shrink-0 whitespace-nowrap ${titleClasses} ${
              size === "hero"
                ? "text-2xl"
                : size === "xl"
                ? "text-xl"
                : size === "lg"
                ? "text-lg"
                : "text-[15px] sm:text-base"
            }`}
          >
            DISHA
          </span>
          <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-gradient-to-r from-[#7045D8] to-[#A78BFA] text-white font-black text-xs tracking-wide shadow-2xs whitespace-nowrap">
            PYQ
          </span>
        </div>
        {showTagline && (
          <span className={`text-[11px] font-semibold tracking-wide truncate mt-0.5 ${subClasses}`}>
            Previous Year Questions • Precision Learning
          </span>
        )}
      </div>
    </div>
  );
};
