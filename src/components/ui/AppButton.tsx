import React from "react";
import { triggerHaptic } from "../../utils/audioFeedback";

export interface AppButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "gold" | "ghost" | "danger" | "icon";
  size?: "sm" | "md" | "lg";
  icon?: React.ElementType;
  iconPosition?: "left" | "right";
  loading?: boolean;
  haptic?: "light" | "medium" | "heavy" | "none";
}

export const AppButton: React.FC<AppButtonProps> = ({
  variant = "primary",
  size = "md",
  icon: Icon,
  iconPosition = "left",
  loading = false,
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
    sm: "px-2.5 py-1.5 text-xs rounded-xl gap-1.5",
    md: "px-4 py-2.5 text-xs sm:text-sm rounded-xl gap-2",
    lg: "px-5 py-3 text-sm sm:text-base rounded-2xl gap-2.5",
  }[size];

  // Variant styling matching DISHA 20-20 brand identity
  const variantClasses = {
    primary:
      "bg-[#800020] hover:bg-[#5E0017] dark:bg-[#F47B20] dark:hover:bg-[#E06A12] text-white font-extrabold shadow-sm active:scale-95 transition-all select-none cursor-pointer disabled:opacity-50 disabled:pointer-events-none",
    secondary:
      "bg-[#F7EFE2] hover:bg-[#EFE3CF] dark:bg-[#252A3A] dark:hover:bg-[#31374A] text-[#171923] dark:text-[#FFF9EF] border border-[#E8D9C0] dark:border-[#31374A] font-bold active:scale-95 transition-all select-none cursor-pointer disabled:opacity-50 disabled:pointer-events-none",
    gold:
      "bg-gradient-to-r from-[#C99A45] to-[#B38536] hover:brightness-105 text-[#171923] font-black shadow-sm active:scale-95 transition-all select-none cursor-pointer disabled:opacity-50 disabled:pointer-events-none",
    ghost:
      "bg-transparent hover:bg-[#F7EFE2] dark:hover:bg-[#252A3A] text-[#52576A] dark:text-[#CBD2E1] hover:text-[#171923] dark:hover:text-[#FFF9EF] font-bold active:scale-95 transition-all select-none cursor-pointer disabled:opacity-50 disabled:pointer-events-none",
    danger:
      "bg-rose-600 hover:bg-rose-700 text-white font-bold shadow-sm active:scale-95 transition-all select-none cursor-pointer disabled:opacity-50 disabled:pointer-events-none",
    icon:
      "p-2 w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-[#F7EFE2] hover:bg-[#EFE3CF] dark:bg-[#252A3A] dark:hover:bg-[#31374A] text-[#171923] dark:text-[#FFF9EF] border border-[#E8D9C0] dark:border-[#31374A] flex items-center justify-center active:scale-95 transition-all select-none cursor-pointer shrink-0 disabled:opacity-50 disabled:pointer-events-none",
  }[variant];

  return (
    <button
      {...props}
      disabled={disabled || loading}
      onClick={handleClick}
      className={`inline-flex items-center justify-center ${variant === "icon" ? "" : sizeClasses} ${variantClasses} ${className}`}
    >
      {loading ? (
        <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin shrink-0" />
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
