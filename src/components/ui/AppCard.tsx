import React from "react";

export interface AppCardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "elevated" | "subtle" | "interactive" | "heritage";
  noPadding?: boolean;
  header?: React.ReactNode;
  headerAction?: React.ReactNode;
  title?: string;
  subtitle?: string;
  icon?: React.ElementType;
}

export const AppCard: React.FC<AppCardProps> = ({
  variant = "default",
  noPadding = false,
  header,
  headerAction,
  title,
  subtitle,
  icon: Icon,
  children,
  className = "",
  ...props
}) => {
  const variantClasses = {
    default:
      "bg-white dark:bg-[#1B1536] border border-slate-200 dark:border-[#31275E] shadow-xs",
    elevated:
      "bg-white dark:bg-[#1B1536] border border-slate-200 dark:border-[#31275E] shadow-md shadow-slate-900/5 dark:shadow-black/25",
    subtle:
      "bg-slate-100/80 dark:bg-[#241D48]/70 border border-slate-200/80 dark:border-[#31275E]/80",
    interactive:
      "bg-white dark:bg-[#1B1536] border border-slate-200 dark:border-[#31275E] hover:border-[#7045D8]/60 dark:hover:border-[#A78BFA]/60 shadow-xs hover:shadow-md transition-all active:scale-[0.99] cursor-pointer",
    heritage:
      "bg-gradient-to-br from-[#7045D8] via-[#5B32BF] to-[#130E26] text-white border border-[#A78BFA]/40 shadow-lg shadow-[#7045D8]/20",
  }[variant];

  const hasHeader = Boolean(header || title || Icon || headerAction);

  return (
    <div
      {...props}
      className={`rounded-2xl sm:rounded-3xl overflow-hidden ${variantClasses} ${className}`}
    >
      {hasHeader && (
        <div className="px-4 py-3 sm:px-6 sm:py-4 flex items-center justify-between border-b border-slate-200/80 dark:border-[#31275E]">
          {header ? (
            header
          ) : (
            <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
              {Icon && (
                <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-[#7045D8]/10 dark:bg-[#A78BFA]/15 text-[#7045D8] dark:text-[#A78BFA] flex items-center justify-center shrink-0">
                  <Icon className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
                </div>
              )}
              <div className="min-w-0">
                {title && (
                  <h3 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-slate-50 tracking-tight truncate leading-tight font-hindi">
                    {title}
                  </h3>
                )}
                {subtitle && (
                  <p className="text-[11px] sm:text-xs text-slate-600 dark:text-slate-300 font-medium mt-0.5 truncate">
                    {subtitle}
                  </p>
                )}
              </div>
            </div>
          )}
          {headerAction && <div className="shrink-0">{headerAction}</div>}
        </div>
      )}
      <div className={noPadding ? "" : "p-3.5 sm:p-5"}>{children}</div>
    </div>
  );
};

export interface AppStatCardProps {
  label: string;
  value: string | number;
  subtitle?: string;
  icon?: React.ElementType;
  badge?: string;
  accent?: "brand" | "saffron" | "gold" | "emerald" | "charcoal";
  onClick?: () => void;
  className?: string;
}

export const AppStatCard: React.FC<AppStatCardProps> = ({
  label,
  value,
  subtitle,
  icon: Icon,
  badge,
  accent = "brand",
  onClick,
  className = "",
}) => {
  const accentStyles = {
    brand: {
      iconBg: "bg-[#7045D8]/10 dark:bg-[#7045D8]/25 text-[#7045D8] dark:text-[#A78BFA]",
      borderHover: "hover:border-[#7045D8]/50",
    },
    saffron: {
      iconBg: "bg-amber-500/12 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400",
      borderHover: "hover:border-amber-500/50",
    },
    gold: {
      iconBg: "bg-amber-500/15 dark:bg-amber-500/25 text-amber-600 dark:text-amber-400",
      borderHover: "hover:border-amber-500/50",
    },
    emerald: {
      iconBg: "bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400",
      borderHover: "hover:border-emerald-500/50",
    },
    charcoal: {
      iconBg: "bg-slate-900/10 dark:bg-slate-100/10 text-slate-900 dark:text-slate-100",
      borderHover: "hover:border-slate-500/50",
    },
  }[accent];

  return (
    <div
      onClick={onClick}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      className={`p-3.5 sm:p-4 rounded-2xl bg-white dark:bg-[#1B1536] border border-slate-200 dark:border-[#31275E] shadow-xs flex flex-col justify-between transition-all ${
        onClick ? `cursor-pointer active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7045D8] ${accentStyles.borderHover}` : ""
      } ${className}`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-300 truncate">
          {label}
        </span>
        {Icon && (
          <div className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 ${accentStyles.iconBg}`}>
            <Icon className="w-3.5 h-3.5" />
          </div>
        )}
      </div>

      <div className="mt-2">
        <div className="flex items-baseline gap-2">
          <span className="text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-50 tracking-tight tabular-nums">
            {value}
          </span>
          {badge && (
            <span className="text-[11px] font-extrabold px-1.5 py-0.5 rounded-md bg-[#7045D8]/10 dark:bg-[#A78BFA]/15 text-[#7045D8] dark:text-[#A78BFA]">
              {badge}
            </span>
          )}
        </div>
        {subtitle && (
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 truncate font-medium">
            {subtitle}
          </p>
        )}
      </div>
    </div>
  );
};
