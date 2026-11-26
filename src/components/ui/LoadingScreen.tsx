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
  message = "Loading chapter content...",
  submessage = "Disha PYQ • Previous Year Questions & Precision Learning",
  showLogo = true,
  onCancel,
  cancelLabel = "Go Back",
}) => {
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center p-6 select-none bg-[#F8FAFC] dark:bg-[#130E26] text-slate-900 dark:text-slate-50 transition-colors duration-300 overflow-hidden"
    >
      {/* 1. Subtle Ambient Background Glow (Minimalist & Non-intrusive) */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {/* Soft Purple Radial Halo */}
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 sm:w-96 h-72 sm:h-96 rounded-full bg-[#7045D8]/10 dark:bg-[#7045D8]/15 blur-3xl pointer-events-none animate-pulse"
          style={{ animationDuration: "4s" }}
        />
        {/* Subtle Warm Secondary Purple Micro-Aura */}
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 sm:w-64 h-48 sm:h-64 rounded-full bg-[#A78BFA]/10 dark:bg-[#A78BFA]/10 blur-2xl pointer-events-none"
        />
      </div>

      {/* 2. Main Central Loading Artifact */}
      <div className="relative z-10 flex flex-col items-center text-center max-w-xs sm:max-w-sm">
        {/* Dual-Ring Precision Spinner with Center Emblem */}
        <div className="relative mb-6 flex items-center justify-center">
          {/* Outer Purple Orbit Ring */}
          <motion.div
            className="w-20 h-20 sm:w-24 sm:h-24 rounded-full border border-[#7045D8]/20 dark:border-[#7045D8]/30"
            style={{ borderTopColor: "#7045D8", borderRightColor: "#A78BFA" }}
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 1.8, ease: "linear" }}
          />

          {/* Inner Counter-Orbit Subtle Ring */}
          <motion.div
            className="absolute w-14 h-14 sm:w-16 sm:h-16 rounded-full border border-[#A78BFA]/20 dark:border-[#A78BFA]/25"
            style={{ borderBottomColor: "#7045D8", borderLeftColor: "transparent" }}
            animate={{ rotate: -360 }}
            transition={{ repeat: Infinity, duration: 2.6, ease: "linear" }}
          />

          {/* Center Brand Emblem or Icon */}
          <div className="absolute inset-0 flex items-center justify-center">
            {showLogo ? (
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-white/90 dark:bg-[#1B1536]/90 backdrop-blur-md border border-[#7045D8]/30 shadow-[0_4px_16px_rgba(112,69,216,0.15)] flex items-center justify-center p-2">
                <img
                  src="/brand-logo.png"
                  alt="Disha PYQ"
                  className="w-full h-full object-contain filter drop-shadow-xs"
                />
              </div>
            ) : (
              <div className="w-9 h-9 rounded-full bg-[#7045D8]/10 dark:bg-[#7045D8]/20 border border-[#7045D8]/40 flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-[#A78BFA]" />
              </div>
            )}
          </div>
        </div>

        {/* Brand Kicker / Status */}
        <div className="flex items-center gap-2 mb-2">
          <span className="w-1.5 h-1.5 rounded-full bg-[#7045D8] animate-ping" />
          <span className="text-[11px] font-black uppercase tracking-[0.2em] text-[#7045D8] dark:text-[#A78BFA]">
            Disha PYQ
          </span>
          <span className="text-[#A78BFA]/50 text-[11px]">✦</span>
          <span className="text-[11px] font-bold text-[#8A8F9E] dark:text-[#A4ABC0] tracking-wider uppercase">
            LIVE SYNC
          </span>
        </div>

        {/* Primary Message */}
        <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-50 leading-snug tracking-tight">
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
            className="absolute top-0 bottom-0 rounded-full bg-gradient-to-r from-[#A78BFA] via-[#7045D8] to-[#A78BFA]"
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
            className="mt-6 px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-white/60 dark:bg-[#171E2D]/80 hover:bg-white dark:hover:bg-[#1D2538] border border-slate-200 dark:border-[#31275E] shadow-xs active:scale-95 transition-all cursor-pointer"
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
  message = "Loading content...",
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
          className={`${ringSizes} rounded-full border-[#A78BFA]/20 dark:border-[#A78BFA]/30`}
          style={{ borderTopColor: "#7045D8", borderRightColor: "#A78BFA" }}
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1.2, ease: "linear" }}
        />
        {/* Subtle Sparkle Dot in Center */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-1.5 h-1.5 rounded-full bg-[#7045D8] animate-pulse" />
        </div>
      </div>

      <p className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-50 tracking-tight">
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
        stroke="#A78BFA"
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
          <stop stopColor="#7045D8" />
          <stop offset="1" stopColor="#A78BFA" />
        </linearGradient>
      </defs>
    </svg>
  );
};

/**
 * Next-Gen Premium Shimmer Skeleton Block
 * Clean Slate base in light mode, Royal Obsidian in dark mode with Purple shimmer
 */
export const PremiumSkeleton: React.FC<{
  className?: string;
  rounded?: string;
}> = ({ className = "h-4 w-full", rounded = "rounded-xl" }) => {
  return (
    <div
      className={`relative overflow-hidden bg-slate-200/80 dark:bg-[#1E173D] ${rounded} ${className}`}
    >
      <motion.div
        className="absolute inset-0 bg-gradient-to-r from-transparent via-white/70 dark:via-[#7045D8]/20 to-transparent"
        initial={{ x: "-100%" }}
        animate={{ x: "100%" }}
        transition={{ repeat: Infinity, duration: 1.6, ease: "easeInOut" }}
      />
    </div>
  );
};

/**
 * Tab Content Skeleton Loader
 * Layout-matching skeleton for tab transitions (Home, Topics, Analytics, Live Tests, Profile)
 * Prevents Layout Shift (CLS = 0) and delivers instant perceived responsiveness.
 */
export const TabContentSkeleton: React.FC<{ className?: string }> = ({
  className = "",
}) => {
  return (
    <div
      role="status"
      aria-label="Loading content..."
      className={`max-w-5xl mx-auto px-4 py-6 space-y-6 animate-pulse select-none ${className}`}
    >
      {/* 1. Header & Quick Controls Skeleton */}
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-2">
          <div className="h-6 w-40 sm:w-56 bg-slate-200/80 dark:bg-[#241D48] rounded-xl" />
          <div className="h-3.5 w-28 sm:w-36 bg-slate-200/50 dark:bg-[#1E173D] rounded-lg" />
        </div>
        <div className="h-10 w-10 sm:w-28 bg-slate-200/80 dark:bg-[#241D48] rounded-xl" />
      </div>

      {/* 2. Top Filter / Category Pills Skeleton */}
      <div className="flex gap-2.5 overflow-x-hidden pt-1">
        <div className="h-9 w-24 bg-[#7045D8]/20 rounded-full shrink-0" />
        <div className="h-9 w-28 bg-slate-200/80 dark:bg-[#241D48] rounded-full shrink-0" />
        <div className="h-9 w-20 bg-slate-200/80 dark:bg-[#241D48] rounded-full shrink-0" />
        <div className="h-9 w-32 bg-slate-200/80 dark:bg-[#241D48] rounded-full shrink-0" />
      </div>

      {/* 3. Hero Action Card Skeleton */}
      <div className="h-36 sm:h-40 w-full bg-gradient-to-br from-slate-200/80 via-slate-200/50 to-slate-200/80 dark:from-[#241D48] dark:via-[#1B1536] dark:to-[#241D48] rounded-3xl p-5 flex flex-col justify-between border border-slate-200/60 dark:border-[#31275E]/60 shadow-xs">
        <div className="space-y-2">
          <div className="h-4 w-28 bg-slate-300/70 dark:bg-[#31275E] rounded-md" />
          <div className="h-6 w-3/4 sm:w-1/2 bg-slate-300/80 dark:bg-[#31275E] rounded-lg" />
        </div>
        <div className="flex items-center justify-between pt-2">
          <div className="h-4 w-32 bg-slate-300/70 dark:bg-[#31275E] rounded-md" />
          <div className="h-9 w-28 bg-[#7045D8]/30 rounded-xl" />
        </div>
      </div>

      {/* 4. Grid Cards Skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div
            key={i}
            className="h-28 rounded-2xl bg-white/80 dark:bg-[#1B1536] border border-slate-200/80 dark:border-[#31275E] p-4 flex items-center gap-3.5 shadow-xs"
          >
            <div className="w-12 h-12 rounded-2xl bg-slate-200/80 dark:bg-[#241D48] shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-3/4 bg-slate-200/80 dark:bg-[#241D48] rounded-md" />
              <div className="h-3 w-1/2 bg-slate-200/50 dark:bg-[#1E173D] rounded-md" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

/**
 * Question Card Skeleton Loader
 * Shimmer preview for MCQ questions and test sessions
 */
export const QuestionCardSkeleton: React.FC<{ className?: string }> = ({
  className = "",
}) => {
  return (
    <div
      role="status"
      aria-label="Loading question..."
      className={`max-w-3xl mx-auto p-4 sm:p-6 space-y-5 animate-pulse select-none ${className}`}
    >
      {/* Question Header Meta */}
      <div className="flex items-center justify-between">
        <div className="h-6 w-28 bg-[#7045D8]/20 rounded-full" />
        <div className="h-8 w-20 bg-slate-200/80 dark:bg-[#241D48] rounded-xl" />
      </div>

      {/* Question Body Text */}
      <div className="space-y-2.5 pt-2">
        <div className="h-5 w-full bg-slate-200/80 dark:bg-[#241D48] rounded-lg" />
        <div className="h-5 w-5/6 bg-slate-200/80 dark:bg-[#241D48] rounded-lg" />
        <div className="h-5 w-2/3 bg-slate-200/60 dark:bg-[#1E173D] rounded-lg" />
      </div>

      {/* 4 Option Buttons Skeleton */}
      <div className="space-y-3 pt-3">
        {[1, 2, 3, 4].map((opt) => (
          <div
            key={opt}
            className="h-14 w-full rounded-2xl bg-white dark:bg-[#1B1536] border border-slate-200 dark:border-[#31275E] p-3.5 flex items-center gap-3.5 shadow-xs"
          >
            <div className="w-8 h-8 rounded-xl bg-slate-200/80 dark:bg-[#241D48] shrink-0" />
            <div className="h-4 w-2/3 bg-slate-200/70 dark:bg-[#241D48] rounded-md" />
          </div>
        ))}
      </div>

      {/* Bottom Actions Bar */}
      <div className="flex items-center justify-between pt-4">
        <div className="h-11 w-28 bg-slate-200/80 dark:bg-[#241D48] rounded-xl" />
        <div className="h-11 w-32 bg-[#7045D8]/30 rounded-xl" />
      </div>
    </div>
  );
};
