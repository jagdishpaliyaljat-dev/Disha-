import React from "react";
import { motion } from "motion/react";
import { Sparkles } from "lucide-react";

export interface FullScreenLoaderProps {
  message?: string;
  submessage?: string;
  showLogo?: boolean;
  onCancel?: () => void;
  cancelLabel?: string;
}

/**
 * Premium Minimalist Full-Screen Loader for DISHA 20-20
 * Color Theory:
 * - 60% Dominant: Deep Obsidian Slate (#0D111A) in Dark Mode / Warm Alabaster Ivory (#FAF7F2) in Light Mode
 * - 30% Structural: Royal Antique Gold (#C99A45) for refined rings, subtle borders, and delicate glows
 * - 10% Intentional Accent: Kesariya / Saffron (#F47B20) strictly for focal glow tips, active indicator, and action buttons
 */
export const FullScreenLoader: React.FC<FullScreenLoaderProps> = ({
  message = "अध्याय सामग्री लोड हो रही है...",
  submessage = "सही दिशा • सटीक तैयारी",
  showLogo = true,
  onCancel,
  cancelLabel = "वापस जाएं (Back)",
}) => {
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center p-6 select-none bg-[#FAF7F2] dark:bg-[#0D111A] text-[#171923] dark:text-[#FFF9EF] transition-colors duration-300 overflow-hidden"
    >
      {/* 1. Subtle Ambient Background Glow (Minimalist & Non-intrusive) */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {/* Soft Gold Radial Halo */}
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 sm:w-96 h-72 sm:h-96 rounded-full bg-[#C99A45]/10 dark:bg-[#C99A45]/8 blur-3xl pointer-events-none animate-pulse"
          style={{ animationDuration: "4s" }}
        />
        {/* Subtle Warm Saffron Micro-Aura (Carefully Restrained) */}
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 sm:w-64 h-48 sm:h-64 rounded-full bg-[#F47B20]/6 dark:bg-[#F47B20]/5 blur-2xl pointer-events-none"
        />
      </div>

      {/* 2. Main Central Loading Artifact */}
      <div className="relative z-10 flex flex-col items-center text-center max-w-xs sm:max-w-sm">
        {/* Dual-Ring Precision Spinner with Center Emblem */}
        <div className="relative mb-6 flex items-center justify-center">
          {/* Outer Golden Orbit Ring */}
          <motion.div
            className="w-20 h-20 sm:w-24 sm:h-24 rounded-full border border-[#C99A45]/20 dark:border-[#C99A45]/25"
            style={{ borderTopColor: "#C99A45", borderRightColor: "#F47B20" }}
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 1.8, ease: "linear" }}
          />

          {/* Inner Counter-Orbit Subtle Ring */}
          <motion.div
            className="absolute w-14 h-14 sm:w-16 sm:h-16 rounded-full border border-[#C99A45]/15 dark:border-[#C99A45]/20"
            style={{ borderBottomColor: "#C99A45", borderLeftColor: "transparent" }}
            animate={{ rotate: -360 }}
            transition={{ repeat: Infinity, duration: 2.6, ease: "linear" }}
          />

          {/* Center Brand Emblem or Icon */}
          <div className="absolute inset-0 flex items-center justify-center">
            {showLogo ? (
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-white/80 dark:bg-[#151B28]/90 backdrop-blur-md border border-[#C99A45]/30 shadow-[0_4px_16px_rgba(201,154,69,0.15)] flex items-center justify-center p-2">
                <img
                  src="/brand-logo.png"
                  alt="DISHA 20-20"
                  className="w-full h-full object-contain filter drop-shadow-xs"
                />
              </div>
            ) : (
              <div className="w-9 h-9 rounded-full bg-[#C99A45]/10 dark:bg-[#C99A45]/20 border border-[#C99A45]/40 flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-[#F47B20]" />
              </div>
            )}
          </div>
        </div>

        {/* Brand Kicker / Status */}
        <div className="flex items-center gap-2 mb-2">
          <span className="w-1.5 h-1.5 rounded-full bg-[#F47B20] animate-ping" />
          <span className="text-[11px] font-black uppercase tracking-[0.2em] text-[#C99A45]">
            DISHA 20-20
          </span>
          <span className="text-[#C99A45]/50 text-[10px]">✦</span>
          <span className="text-[10px] font-bold text-[#8A8F9E] dark:text-[#A4ABC0] tracking-wider uppercase">
            LIVE SYNC
          </span>
        </div>

        {/* Primary Message */}
        <h3 className="text-sm sm:text-base font-bold text-[#171923] dark:text-[#FFF9EF] leading-snug tracking-tight">
          {message}
        </h3>

        {/* Submessage / Tagline */}
        {submessage && (
          <p className="text-xs text-[#6F768A] dark:text-[#9AA2B8] mt-1.5 font-medium tracking-wide">
            {submessage}
          </p>
        )}

        {/* Minimal Progress Micro-Bar */}
        <div className="w-36 sm:w-44 h-1 bg-[#E8E2D8] dark:bg-[#1E2536] rounded-full overflow-hidden mt-6 relative shadow-inner">
          <motion.div
            className="absolute top-0 bottom-0 rounded-full bg-gradient-to-r from-[#C99A45] via-[#F47B20] to-[#C99A45]"
            initial={{ left: "-40%", width: "40%" }}
            animate={{ left: "100%", width: "40%" }}
            transition={{ repeat: Infinity, duration: 1.4, ease: "easeInOut" }}
          />
        </div>

        {/* Optional Back / Cancel Action Button (Kesariya used with elegance & restraint) */}
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="mt-6 px-4 py-2 rounded-xl text-xs font-bold text-[#52576A] dark:text-[#CBD2E1] hover:text-[#171923] dark:hover:text-white bg-white/60 dark:bg-[#171E2D]/80 hover:bg-white dark:hover:bg-[#1D2538] border border-[#E8D9C0] dark:border-[#2C354B] shadow-xs active:scale-95 transition-all cursor-pointer"
          >
            {cancelLabel}
          </button>
        )}
      </div>
    </div>
  );
};

export interface ContentLoaderProps {
  message?: string;
  submessage?: string;
  minHeight?: string;
  className?: string;
  size?: "sm" | "md" | "lg";
}

/**
 * Premium In-Page Section / Tab Content Loader
 * Ideal for Suspense fallbacks, tab transitions, and async data fetches
 */
export const ContentLoader: React.FC<ContentLoaderProps> = ({
  message = "सामग्री लोड हो रही है...",
  submessage,
  minHeight = "min-h-[260px]",
  className = "",
  size = "md",
}) => {
  const iconSizes = {
    sm: "w-8 h-8",
    md: "w-12 h-12",
    lg: "w-16 h-16",
  }[size];

  const ringSizes = {
    sm: "w-8 h-8 border-[1.5px]",
    md: "w-12 h-12 border-2",
    lg: "w-16 h-16 border-2",
  }[size];

  return (
    <div
      role="status"
      className={`flex flex-col items-center justify-center p-6 text-center ${minHeight} ${className}`}
    >
      <div className="relative mb-3.5 flex items-center justify-center">
        {/* Rotating Dual-Color Ring */}
        <motion.div
          className={`${ringSizes} rounded-full border-[#C99A45]/20 dark:border-[#C99A45]/30`}
          style={{ borderTopColor: "#C99A45", borderRightColor: "#F47B20" }}
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1.2, ease: "linear" }}
        />
        {/* Subtle Sparkle Dot in Center */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-1.5 h-1.5 rounded-full bg-[#F47B20] animate-pulse" />
        </div>
      </div>

      <p className="text-xs sm:text-sm font-bold text-[#171923] dark:text-[#FFF9EF] tracking-tight">
        {message}
      </p>

      {submessage && (
        <p className="text-[11px] text-[#6F768A] dark:text-[#9AA2B8] mt-1 font-medium">
          {submessage}
        </p>
      )}
    </div>
  );
};

export interface InlineSpinnerProps {
  size?: "xs" | "sm" | "md" | "lg";
  className?: string;
}

/**
 * Ultra-Clean Precision Inline SVG Spinner
 * Featuring Antique Gold track (#C99A45) and Saffron accent sweep (#F47B20)
 */
export const InlineSpinner: React.FC<InlineSpinnerProps> = ({
  size = "sm",
  className = "",
}) => {
  const sizePx = {
    xs: 14,
    sm: 18,
    md: 24,
    lg: 32,
  }[size];

  return (
    <svg
      width={sizePx}
      height={sizePx}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`animate-spin shrink-0 ${className}`}
      aria-hidden="true"
    >
      <circle
        cx="12"
        cy="12"
        r="9.5"
        stroke="#C99A45"
        strokeWidth="2.5"
        strokeOpacity="0.25"
      />
      <path
        d="M12 2.5C17.2467 2.5 21.5 6.75329 21.5 12C21.5 13.5683 21.1189 15.0475 20.4497 16.3475"
        stroke="url(#spinner-kesariya-grad)"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <defs>
        <linearGradient
          id="spinner-kesariya-grad"
          x1="12"
          y1="2.5"
          x2="21.5"
          y2="16.5"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#F47B20" />
          <stop offset="1" stopColor="#C99A45" />
        </linearGradient>
      </defs>
    </svg>
  );
};

/**
 * Next-Gen Premium Shimmer Skeleton Block
 * Warm ivory base in light mode, obsidian slate in dark mode with gold warmth
 */
export const PremiumSkeleton: React.FC<{
  className?: string;
  rounded?: string;
}> = ({ className = "h-4 w-full", rounded = "rounded-xl" }) => {
  return (
    <div
      className={`relative overflow-hidden bg-[#F0EAE1] dark:bg-[#181F2F] ${rounded} ${className}`}
    >
      <motion.div
        className="absolute inset-0 bg-gradient-to-r from-transparent via-[#FFF9EF]/60 dark:via-[#C99A45]/10 to-transparent"
        initial={{ x: "-100%" }}
        animate={{ x: "100%" }}
        transition={{ repeat: Infinity, duration: 1.6, ease: "easeInOut" }}
      />
    </div>
  );
};
