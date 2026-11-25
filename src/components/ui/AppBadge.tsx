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
    sm: "px-2 py-0.5 text-[11px]",
    md: "px-2.5 py-1 text-[11px]",
  }[size];

  const variantClasses = {
    brand:
      "bg-[#7045D8]/10 dark:bg-[#7045D8]/20 text-[#7045D8] dark:text-[#A78BFA] border border-[#7045D8]/20 dark:border-[#A78BFA]/30",
    saffron:
      "bg-[#7045D8]/10 dark:bg-[#7045D8]/20 text-[#7045D8] border border-[#7045D8]/25 dark:border-[#A78BFA]/35",
    gold:
      "bg-[#A78BFA]/15 dark:bg-[#7045D8]/25 text-amber-500 dark:text-[#A78BFA] border border-[#A78BFA]/30",
    live:
      "bg-[#7045D8] text-white shadow-xs font-black",
    success:
      "bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/25",
    neutral:
      "bg-slate-100 dark:bg-[#241D48] text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-[#31275E]",
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
