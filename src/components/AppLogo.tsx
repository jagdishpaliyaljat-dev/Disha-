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
}

export const AppLogo: React.FC<AppLogoProps> = ({
  size = "md",
  variant = "horizontal",
  theme,
  textColor = "auto",
  className = "",
  showText = true,
  showTagline = false,
  showHindi = false,
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
      ? "text-[#171923]"
      : effectiveTheme === "dark"
      ? "text-[#FFF9EF]"
      : "text-[#171923] dark:text-[#FFF9EF]";

  const maroonWordClasses =
    effectiveTheme === "light"
      ? "text-[#800020]"
      : effectiveTheme === "dark"
      ? "text-[#FFF9EF]"
      : "text-[#800020] dark:text-[#FFF9EF]";

  const subClasses =
    effectiveTheme === "light"
      ? "text-[#52576A]"
      : effectiveTheme === "dark"
      ? "text-[#CBD2E1]"
      : "text-[#52576A] dark:text-[#CBD2E1]";

  const renderMark = (mode: "emblem" | "tile") => {
    return (
      <img
        src="/brand-logo.png"
        alt="DISHA 20-20 Logo"
        className="w-full h-full object-contain"
      />
    );
  };

  if (variant === "icon" || variant === "symbol" || !showText) {
    return (
      <div className={`inline-flex items-center justify-center shrink-0 select-none ${sizeMap[size]} ${className}`}>
        {renderMark(variant === "icon" ? "tile" : "emblem")}
      </div>
    );
  }

  if (variant === "primary") {
    return (
      <div className={`inline-flex flex-col items-center text-center select-none ${className}`}>
        <div className={`${sizeMap[size]} shrink-0 mb-2 shadow-sm rounded-2xl overflow-hidden`}>
          {renderMark("tile")}
        </div>
        <div className="flex items-baseline gap-1.5 leading-none shrink-0 whitespace-nowrap">
          <span
            className={`font-black tracking-tight shrink-0 whitespace-nowrap ${maroonWordClasses} ${
              size === "hero" ? "text-3xl sm:text-4xl" : size === "xl" ? "text-2xl" : "text-xl"
            }`}
          >
            DISHA
          </span>
          <span className="inline-flex items-center px-2 py-0.5 rounded-lg bg-[#F47B20] text-white font-extrabold tracking-tight text-sm sm:text-base shadow-xs shrink-0 whitespace-nowrap">
            20-20
          </span>
        </div>
        <div className={`mt-1 text-xs font-extrabold tracking-[0.14em] uppercase shrink-0 whitespace-nowrap ${titleClasses}`}>
          PREPARATION PLATFORM
        </div>
        {showTagline && (
          <p className={`text-[11px] font-medium mt-1 truncate ${subClasses}`}>
            Right Direction, Accurate Preparation
          </p>
        )}
      </div>
    );
  }

  // Horizontal lockup (default for top bars & cards)
  return (
    <div className={`inline-flex items-center gap-2.5 select-none min-w-0 shrink-0 whitespace-nowrap ${className}`}>
      <div className={`${sizeMap[size]} shrink-0 flex items-center justify-center`}>
        {renderMark("tile")}
      </div>
      <div className="flex flex-col min-w-0 shrink-0">
        <div className="flex items-center gap-1.5 leading-none shrink-0 whitespace-nowrap">
          <span
            className={`font-extrabold tracking-tight shrink-0 whitespace-nowrap ${titleClasses} ${
              size === "hero"
                ? "text-2xl"
                : size === "xl"
                ? "text-xl"
                : size === "lg"
                ? "text-lg"
                : "text-[15px] sm:text-base"
            }`}
          >
            DISHA <span className="text-[#F47B20] shrink-0 whitespace-nowrap">20-20</span>
          </span>
        </div>
        {showTagline && (
          <span className={`text-[10px] font-semibold tracking-wide truncate mt-0.5 ${subClasses}`}>
            Right Direction, Accurate Preparation
          </span>
        )}
      </div>
    </div>
  );
};
