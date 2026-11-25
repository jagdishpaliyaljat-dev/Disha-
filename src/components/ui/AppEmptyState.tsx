import React from "react";
import { AppButton } from "./AppButton";

export interface AppEmptyStateProps {
  icon: React.ElementType;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

export const AppEmptyState: React.FC<AppEmptyStateProps> = ({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
  className = "",
}) => {
  return (
    <div
      className={`p-8 sm:p-12 text-center bg-white dark:bg-[#1B1536] rounded-3xl border border-slate-200 dark:border-[#31275E] flex flex-col items-center max-w-lg mx-auto shadow-xs ${className}`}
    >
      <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-[#7045D8]/10 dark:bg-[#A78BFA]/15 flex items-center justify-center text-[#7045D8] dark:text-[#A78BFA] mb-3.5 border border-[#7045D8]/20 dark:border-[#A78BFA]/30 shadow-xs">
        <Icon className="w-7 h-7 sm:w-8 sm:h-8" />
      </div>
      <h3 className="font-black text-base sm:text-lg text-slate-900 dark:text-slate-50 font-hindi">
        {title}
      </h3>
      {description && (
        <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 mt-1 max-w-sm font-medium">
          {description}
        </p>
      )}
      {actionLabel && onAction && (
        <div className="mt-5">
          <AppButton variant="primary" size="md" onClick={onAction}>
            {actionLabel}
          </AppButton>
        </div>
      )}
    </div>
  );
};
