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
      "bg-white dark:bg-[#1F2330] border border-[#E8D9C0] dark:border-[#31374A] shadow-xs",
    elevated:
      "bg-white dark:bg-[#1F2330] border border-[#E8D9C0] dark:border-[#31374A] shadow-md shadow-[#171923]/5 dark:shadow-black/20",
    subtle:
      "bg-[#F7EFE2]/60 dark:bg-[#252A3A]/60 border border-[#E8D9C0]/70 dark:border-[#31374A]/70",
    interactive:
      "bg-white dark:bg-[#1F2330] border border-[#E8D9C0] dark:border-[#31374A] hover:border-[#800020]/60 dark:hover:border-[#F47B20]/60 shadow-xs hover:shadow-md transition-all active:scale-[0.99] cursor-pointer",
    heritage:
      "bg-gradient-to-br from-[#800020] via-[#5E0017] to-[#171923] text-white border border-[#C99A45]/40 shadow-lg shadow-[#800020]/20",
  }[variant];

  const hasHeader = Boolean(header || title || Icon || headerAction);

  return (
    <div
      {...props}
      className={`rounded-2xl sm:rounded-3xl overflow-hidden ${variantClasses} ${className}`}
    >
      {hasHeader && (
        <div className="px-4 py-3 sm:px-6 sm:py-4 flex items-center justify-between border-b border-[#E8D9C0]/70 dark:border-[#31374A]/70">
          {header ? (
            header
          ) : (
            <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
              {Icon && (
                <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-[#800020]/10 dark:bg-[#F47B20]/15 text-[#800020] dark:text-[#F47B20] flex items-center justify-center shrink-0">
                  <Icon className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
                </div>
              )}
              <div className="min-w-0">
                {title && (
                  <h3 className="text-sm sm:text-base font-extrabold text-[#171923] dark:text-[#FFF9EF] tracking-tight truncate leading-tight font-hindi">
                    {title}
                  </h3>
                )}
                {subtitle && (
                  <p className="text-[10px] sm:text-xs text-[#52576A] dark:text-[#CBD2E1] font-medium mt-0.5 truncate">
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
      iconBg: "bg-[#800020]/10 dark:bg-[#800020]/20 text-[#800020] dark:text-[#F47B20]",
      borderHover: "hover:border-[#800020]/50",
    },
    saffron: {
      iconBg: "bg-[#F47B20]/10 dark:bg-[#F47B20]/20 text-[#F47B20]",
      borderHover: "hover:border-[#F47B20]/50",
    },
    gold: {
      iconBg: "bg-[#C99A45]/15 dark:bg-[#C99A45]/25 text-[#C99A45]",
      borderHover: "hover:border-[#C99A45]/50",
    },
    emerald: {
      iconBg: "bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400",
      borderHover: "hover:border-emerald-500/50",
    },
    charcoal: {
      iconBg: "bg-[#171923]/10 dark:bg-[#FFF9EF]/10 text-[#171923] dark:text-[#FFF9EF]",
      borderHover: "hover:border-[#171923]/50",
    },
  }[accent];

  return (
    <div
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      className={`p-3.5 sm:p-4 rounded-2xl bg-white dark:bg-[#1F2330] border border-[#E8D9C0] dark:border-[#31374A] shadow-xs flex flex-col justify-between transition-all ${
        onClick ? `cursor-pointer active:scale-95 ${accentStyles.borderHover}` : ""
      } ${className}`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-black uppercase tracking-wider text-[#52576A] dark:text-[#CBD2E1] truncate">
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
          <span className="text-xl sm:text-2xl font-black text-[#171923] dark:text-[#FFF9EF] tracking-tight tabular-nums">
            {value}
          </span>
          {badge && (
            <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded-md bg-[#800020]/10 dark:bg-[#F47B20]/15 text-[#800020] dark:text-[#F47B20]">
              {badge}
            </span>
          )}
        </div>
        {subtitle && (
          <p className="text-[10px] text-[#787D91] dark:text-[#929AB0] mt-0.5 truncate font-medium">
            {subtitle}
          </p>
        )}
      </div>
    </div>
  );
};
