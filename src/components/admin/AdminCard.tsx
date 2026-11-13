import * as React from "react";

interface AdminCardProps {
  title?: string;
  subtitle?: string;
  icon?: React.ElementType;
  children: React.ReactNode;
  headerAction?: React.ReactNode;
  className?: string;
  noPadding?: boolean;
  variant?: "default" | "glass" | "outline";
  overflowHidden?: boolean;
}

export const AdminCard: React.FC<AdminCardProps> = ({
  title,
  subtitle,
  icon: Icon,
  children,
  headerAction,
  className = "",
  noPadding = false,
  variant = "default",
  overflowHidden = false,
}) => {
  const variantClasses = {
    default: "bg-white dark:bg-[#111A2E] border-slate-200/80 dark:border-slate-800 shadow-sm",
    glass: "bg-white/70 dark:bg-[#111A2E]/70 backdrop-blur-md border-slate-200/50 dark:border-slate-800/50 shadow-lg",
    outline: "bg-transparent border-slate-200 dark:border-slate-800 border-2 border-dashed",
  };

  return (
    <div className={`${variantClasses[variant]} border rounded-[32px] ${overflowHidden ? "overflow-hidden" : ""} ${className}`}>
      {(title || Icon || headerAction) && (
        <div className="px-6 py-5 sm:px-8 sm:py-6 flex items-center justify-between border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-4">
            {Icon && (
              <div className="w-10 h-10 rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                <Icon className="w-5 h-5" />
              </div>
            )}
            <div>
              {title && (
                <h3 className="text-base font-black text-slate-900 dark:text-white tracking-tight">
                  {title}
                </h3>
              )}
              {subtitle && (
                <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5 italic">
                  {subtitle}
                </p>
              )}
            </div>
          </div>
          {headerAction && <div>{headerAction}</div>}
        </div>
      )}
      <div className={noPadding ? "" : "p-4 sm:p-8"}>
        {children}
      </div>
    </div>
  );
};
