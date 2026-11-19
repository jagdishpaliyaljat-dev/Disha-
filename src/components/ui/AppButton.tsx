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

  // Base sizing
  const sizeClasses = {
    sm: "px-3 py-1.5 text-xs rounded-xl gap-1.5",
    md: "px-4 py-2.5 text-xs sm:text-sm rounded-xl gap-2",
    lg: "px-5 py-3 text-sm sm:text-base rounded-2xl gap-2.5",
  }[size];

  // Variant styling matching next-level DISHA 20-20 color theory:
  // Kesariya (#F47B20) focused intentionally on primary button, paired with royal gold rim (#C99A45)
  const variantClasses = {
    primary:
      "bg-gradient-to-r from-[#F47B20] to-[#E06716] hover:brightness-105 text-white font-extrabold shadow-[0_4px_14px_rgba(244,123,32,0.32)] hover:shadow-[0_6px_20px_rgba(244,123,32,0.42)] border border-[#C99A45]/40 active:scale-95 transition-all select-none cursor-pointer disabled:opacity-50 disabled:pointer-events-none",
    secondary:
      "bg-[#F7EFE2] hover:bg-[#EFE3CF] dark:bg-[#1C2333] dark:hover:bg-[#252E42] text-[#171923] dark:text-[#FFF9EF] border border-[#E8D9C0] dark:border-[#2C374E] font-bold active:scale-95 transition-all select-none cursor-pointer disabled:opacity-50 disabled:pointer-events-none",
    gold:
      "bg-gradient-to-r from-[#C99A45] to-[#B38536] hover:brightness-105 text-[#171923] font-black shadow-sm border border-[#E2B755]/40 active:scale-95 transition-all select-none cursor-pointer disabled:opacity-50 disabled:pointer-events-none",
    ghost:
      "bg-transparent hover:bg-[#F7EFE2] dark:hover:bg-[#1C2333] text-[#52576A] dark:text-[#CBD2E1] hover:text-[#171923] dark:hover:text-[#FFF9EF] font-bold active:scale-95 transition-all select-none cursor-pointer disabled:opacity-50 disabled:pointer-events-none",
    danger:
      "bg-rose-600 hover:bg-rose-700 text-white font-bold shadow-sm active:scale-95 transition-all select-none cursor-pointer disabled:opacity-50 disabled:pointer-events-none",
    icon:
      "p-2 w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-[#F7EFE2] hover:bg-[#EFE3CF] dark:bg-[#1C2333] dark:hover:bg-[#252E42] text-[#171923] dark:text-[#FFF9EF] border border-[#E8D9C0] dark:border-[#2C374E] flex items-center justify-center active:scale-95 transition-all select-none cursor-pointer shrink-0 disabled:opacity-50 disabled:pointer-events-none",
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
