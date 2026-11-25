import React from "react";
import { triggerHaptic } from "../../utils/audioFeedback";
import { InlineSpinner } from "./LoadingScreen";

export interface AppButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "gold" | "ghost" | "danger" | "icon";
  size?: "sm" | "md" | "lg";
  icon?: React.ElementType;
  iconPosition?: "left" | "right";
  loading?: boolean;
  loadingText?: string;
  haptic?: "light" | "medium" | "heavy" | "none";
}

export const AppButton: React.FC<AppButtonProps> = ({
  variant = "primary",
  size = "md",
  icon: Icon,
  iconPosition = "left",
  loading = false,
  loadingText,
  haptic = "light",
  children,
  className = "",
  disabled,
  onClick,
  ...props
}) => {
  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (disabled || loading) return;
    if (haptic !== "none") {
      triggerHaptic(haptic as any);
    }
    onClick?.(e);
  };

  // Base sizing (minimum 44px touch targets)
  const sizeClasses = {
    sm: "min-h-[38px] px-3 py-1.5 text-xs rounded-xl gap-1.5",
    md: "min-h-[44px] px-4 py-2.5 text-xs sm:text-sm rounded-xl gap-2",
    lg: "min-h-[48px] px-5 py-3 text-sm sm:text-base rounded-2xl gap-2.5",
  }[size];

  // Unified Royal Purple + Clean Slate Design System
  const variantClasses = {
    primary:
      "bg-[#7045D8] hover:bg-[#5B32BF] text-white font-extrabold shadow-sm shadow-[#7045D8]/25 border border-[#A78BFA]/35 active:scale-95 transition-all select-none cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7045D8] disabled:opacity-50 disabled:pointer-events-none",
    secondary:
      "bg-slate-100 hover:bg-slate-200/80 dark:bg-[#241D48] dark:hover:bg-[#31275E] text-slate-900 dark:text-slate-50 border border-slate-200 dark:border-[#31275E] font-bold active:scale-95 transition-all select-none cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7045D8] disabled:opacity-50 disabled:pointer-events-none",
    gold:
      "bg-amber-500 hover:bg-amber-600 text-slate-950 font-black shadow-sm border border-amber-400/50 active:scale-95 transition-all select-none cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 disabled:opacity-50 disabled:pointer-events-none",
    ghost:
      "bg-transparent hover:bg-slate-100 dark:hover:bg-[#241D48] text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white font-bold active:scale-95 transition-all select-none cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7045D8] disabled:opacity-50 disabled:pointer-events-none",
    danger:
      "bg-rose-600 hover:bg-rose-700 text-white font-bold shadow-sm active:scale-95 transition-all select-none cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 disabled:opacity-50 disabled:pointer-events-none",
    icon:
      "p-2 w-11 h-11 rounded-xl bg-slate-100 hover:bg-slate-200/80 dark:bg-[#241D48] dark:hover:bg-[#31275E] text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-[#31275E] flex items-center justify-center active:scale-95 transition-all select-none cursor-pointer shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7045D8] disabled:opacity-50 disabled:pointer-events-none",
  }[variant];

  return (
    <button
      {...props}
      disabled={disabled || loading}
      onClick={handleClick}
      className={`inline-flex items-center justify-center ${variant === "icon" ? "" : sizeClasses} ${variantClasses} ${className}`}
    >
      {loading ? (
        <span className="inline-flex items-center gap-1.5">
          <InlineSpinner size={size === "lg" ? "md" : "xs"} />
          {loadingText ? <span>{loadingText}</span> : children ? <span className="opacity-80">{children}</span> : null}
        </span>
      ) : (
        <>
          {Icon && iconPosition === "left" && <Icon className="w-4 h-4 shrink-0" />}
          {children}
          {Icon && iconPosition === "right" && <Icon className="w-4 h-4 shrink-0" />}
        </>
      )}
    </button>
  );
};
