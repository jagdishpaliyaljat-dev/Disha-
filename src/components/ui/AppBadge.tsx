import React from "react";

export interface AppBadgeProps {
  variant?: "brand" | "saffron" | "gold" | "live" | "success" | "neutral" | "danger";
  size?: "sm" | "md";
  pulse?: boolean;
  children: React.ReactNode;
  className?: string;
}

export const AppBadge: React.FC<AppBadgeProps> = ({
  variant = "brand",
  size = "md",
  pulse = false,
  children,
  className = "",
}) => {
  const sizeClasses = {
    sm: "px-2 py-0.5 text-[9.5px]",
    md: "px-2.5 py-1 text-[11px]",
  }[size];

  const variantClasses = {
    brand:
      "bg-[#800020]/10 dark:bg-[#800020]/20 text-[#800020] dark:text-[#F47B20] border border-[#800020]/20 dark:border-[#800020]/30",
    saffron:
      "bg-[#F47B20]/10 dark:bg-[#F47B20]/20 text-[#F47B20] border border-[#F47B20]/25 dark:border-[#F47B20]/35",
    gold:
      "bg-[#C99A45]/15 dark:bg-[#C99A45]/25 text-[#9E7324] dark:text-[#E8BD68] border border-[#C99A45]/30",
    live:
      "bg-[#F47B20] text-white shadow-xs font-black",
    success:
      "bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/25",
    neutral:
      "bg-[#F7EFE2] dark:bg-[#252A3A] text-[#52576A] dark:text-[#CBD2E1] border border-[#E8D9C0] dark:border-[#31374A]",
    danger:
      "bg-rose-500/10 dark:bg-rose-500/20 text-rose-700 dark:text-rose-300 border border-rose-500/25",
  }[variant];

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-bold uppercase tracking-wider rounded-lg sm:rounded-xl select-none leading-none ${sizeClasses} ${variantClasses} ${className}`}
    >
      {pulse && (
        <span className="w-1.5 h-1.5 rounded-full bg-current animate-ping shrink-0" />
      )}
      {children}
    </span>
  );
};
