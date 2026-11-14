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
    default: "bg-white dark:bg-[#1F2330] border-[#E8D9C0] dark:border-[#31374A] shadow-xs",
    glass: "bg-white/80 dark:bg-[#1F2330]/80 backdrop-blur-md border-[#E8D9C0]/70 dark:border-[#31374A]/70 shadow-md",
    outline: "bg-transparent border-[#E8D9C0] dark:border-[#31374A] border-2 border-dashed",
  };

  return (
    <div className={`${variantClasses[variant]} border rounded-2xl sm:rounded-3xl ${overflowHidden ? "overflow-hidden" : ""} ${className}`}>
      {(title || Icon || headerAction) && (
        <div className="px-5 py-4 sm:px-6 sm:py-4.5 flex items-center justify-between border-b border-[#E8D9C0]/70 dark:border-[#31374A]/70">
          <div className="flex items-center gap-3.5">
            {Icon && (
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-[#800020]/10 dark:bg-[#F47B20]/15 text-[#800020] dark:text-[#F47B20] flex items-center justify-center shrink-0">
                <Icon className="w-4.5 h-4.5 sm:w-5 sm:h-5" />
              </div>
            )}
            <div>
              {title && (
                <h3 className="text-sm sm:text-base font-black text-[#171923] dark:text-[#FFF9EF] tracking-tight font-hindi">
                  {title}
                </h3>
              )}
              {subtitle && (
                <p className="text-[10px] sm:text-xs text-[#52576A] dark:text-[#CBD2E1] font-medium mt-0.5">
                  {subtitle}
                </p>
              )}
            </div>
          </div>
          {headerAction && <div>{headerAction}</div>}
        </div>
      )}
      <div className={noPadding ? "" : "p-4 sm:p-6"}>
        {children}
      </div>
    </div>
  );
};
