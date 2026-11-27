/**
 * Streak and Micro-Delight Manager for MCQ Practice Sessions
 * Provides combo streak multiplier calculations, badge styling,
 * audio/haptic celebration triggers, and option ripple/glow styles.
 */

export interface StreakBadgeInfo {
  tier: "flame" | "lightning" | "crown";
  icon: string;
  label: string;
  subLabel: string;
  gradientClass: string;
  borderClass: string;
  shadowClass: string;
}

export interface OptionDelightParams {
  isSubmitted: boolean;
  isCorrectOption: boolean;
  isSelected: boolean;
  isTestMode: boolean;
  isUnattemptedOption?: boolean; // Option E
}

export interface OptionDelightStyles {
  cardClass: string;
  labelClass: string;
  textClass: string;
  hasRippleGlow: boolean;
  animationType: "correct-bounce" | "revealed" | "wrong-shake" | "selected-neutral" | "unattempted-neutral" | "default";
}

/**
 * Calculates the next streak count based on user's attempt result.
 */
export function calculateNextStreak(
  currentStreak: number,
  isCorrect: boolean,
  isUnattempted: boolean = false
): number {
  if (isUnattempted || !isCorrect) {
    return 0;
  }
  return (currentStreak || 0) + 1;
}

/**
 * Returns streak badge data and styling according to current streak tier.
 * Returns null if streak is below minimum threshold (3).
 */
export function getStreakBadgeTier(streak: number): StreakBadgeInfo | null {
  if (!streak || streak < 3) {
    return null;
  }

  if (streak >= 10) {
    return {
      tier: "crown",
      icon: "👑",
      label: `${streak} IN A ROW!`,
      subLabel: "अजेय महारथी!",
      gradientClass: "from-amber-500 via-rose-500 to-purple-600",
      borderClass: "border-amber-300 dark:border-amber-400",
      shadowClass: "shadow-amber-500/30",
    };
  }

  if (streak >= 5) {
    return {
      tier: "lightning",
      icon: "⚡",
      label: `${streak}x SUPER STREAK!`,
      subLabel: "शानदार तैयारी!",
      gradientClass: "from-violet-600 via-indigo-600 to-blue-500",
      borderClass: "border-violet-300 dark:border-violet-400",
      shadowClass: "shadow-violet-500/30",
    };
  }

  // Tier 3-4
  return {
    tier: "flame",
    icon: "🔥",
    label: `${streak} IN A ROW!`,
    subLabel: "लगातार सही!",
    gradientClass: "from-amber-500 to-orange-500",
    borderClass: "border-amber-300 dark:border-amber-400",
    shadowClass: "shadow-orange-500/25",
  };
}

/**
 * Checks if a streak transition hits a major celebration milestone (3, 5, 10, 15, 20...).
 */
export function shouldTriggerStreakCelebration(prevStreak: number, nextStreak: number): boolean {
  if (nextStreak <= prevStreak) return false;
  const milestones = [3, 5, 10, 15, 20, 25, 30, 40, 50];
  return milestones.includes(nextStreak);
}

/**
 * Computes aesthetic CSS styling and animation identifiers for MCQ options,
 * including emerald ripple glow, ring highlights, and feedback animations.
 */
export function getOptionMicroDelightStyles({
  isSubmitted,
  isCorrectOption,
  isSelected,
  isTestMode,
  isUnattemptedOption = false,
}: OptionDelightParams): OptionDelightStyles {
  // Test Mode (Strict Exam): neutral selection without revealing right or wrong
  if (isTestMode) {
    if (isSelected) {
      if (isUnattemptedOption) {
        return {
          cardClass: "bg-amber-600 border-amber-600 shadow-lg shadow-amber-600/20 scale-[1.02]",
          labelClass: "bg-white/20 text-white",
          textClass: "text-white font-black",
          hasRippleGlow: false,
          animationType: "selected-neutral",
        };
      }
      return {
        cardClass: "bg-blue-600 border-blue-600 shadow-lg shadow-blue-600/20 scale-[1.02]",
        labelClass: "bg-white/20 text-white",
        textClass: "text-white font-black",
        hasRippleGlow: false,
        animationType: "selected-neutral",
      };
    }
    return {
      cardClass: "bg-white dark:bg-[#1B1536] border-slate-200 dark:border-[#31275E] hover:border-slate-300 dark:hover:border-slate-700",
      labelClass: "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400",
      textClass: "text-slate-900 dark:text-white font-bold",
      hasRippleGlow: false,
      animationType: "default",
    };
  }

  // Practice Mode Submitted State
  if (isSubmitted) {
    if (isCorrectOption) {
      return {
        cardClass: "bg-emerald-50 dark:bg-emerald-950/25 border-emerald-500 ring-2 ring-emerald-500/30 ring-offset-1 dark:ring-offset-slate-900 shadow-md shadow-emerald-500/15 relative overflow-hidden",
        labelClass: "bg-emerald-600 text-white shadow-sm shadow-emerald-600/30",
        textClass: "text-emerald-950 dark:text-emerald-100 font-black",
        hasRippleGlow: true,
        animationType: isSelected ? "correct-bounce" : "revealed",
      };
    }

    if (isSelected && isUnattemptedOption) {
      return {
        cardClass: "bg-amber-50 dark:bg-amber-950/20 border-amber-500 shadow-sm shadow-amber-500/10",
        labelClass: "bg-amber-600 text-white",
        textClass: "text-amber-900 dark:text-amber-50 font-bold",
        hasRippleGlow: false,
        animationType: "unattempted-neutral",
      };
    }

    if (isSelected && !isCorrectOption) {
      return {
        cardClass: "bg-rose-50 dark:bg-rose-950/20 border-rose-500 ring-2 ring-rose-500/20 shadow-sm shadow-rose-500/10",
        labelClass: "bg-rose-600 text-white shadow-sm shadow-rose-600/30",
        textClass: "text-rose-950 dark:text-rose-100 font-black",
        hasRippleGlow: false,
        animationType: "wrong-shake",
      };
    }

    // Unselected options after submission
    return {
      cardClass: "bg-slate-50/50 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800 opacity-60",
      labelClass: "bg-slate-100 dark:bg-slate-800 text-slate-400",
      textClass: "text-slate-500 dark:text-slate-400 font-bold",
      hasRippleGlow: false,
      animationType: "default",
    };
  }

  // Practice Mode Unsubmitted State
  if (isSelected) {
    return {
      cardClass: "bg-[#7045D8]/10 border-[#7045D8] ring-2 ring-[#7045D8]/20 shadow-md shadow-[#7045D8]/10",
      labelClass: "bg-[#7045D8] text-white",
      textClass: "text-[#7045D8] dark:text-[#A78BFA] font-black",
      hasRippleGlow: false,
      animationType: "selected-neutral",
    };
  }

  return {
    cardClass: "bg-white dark:bg-[#1B1536] border-slate-200 dark:border-[#31275E] hover:border-[#7045D8]/40 dark:hover:border-[#7045D8]/40 transition-all",
    labelClass: "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400",
    textClass: "text-slate-900 dark:text-white font-bold",
    hasRippleGlow: false,
    animationType: "default",
  };
}
