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
      className={`p-8 sm:p-12 text-center bg-white dark:bg-[#1F2330] rounded-3xl border border-[#E8D9C0] dark:border-[#31374A] flex flex-col items-center max-w-lg mx-auto shadow-xs ${className}`}
    >
      <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-[#F7EFE2] dark:bg-[#252A3A] flex items-center justify-center text-[#800020] dark:text-[#F47B20] mb-3.5 border border-[#E8D9C0] dark:border-[#31374A] shadow-xs">
        <Icon className="w-7 h-7 sm:w-8 sm:h-8" />
      </div>
      <h3 className="font-black text-base sm:text-lg text-[#171923] dark:text-[#FFF9EF] font-hindi">
        {title}
      </h3>
      {description && (
        <p className="text-xs sm:text-sm text-[#52576A] dark:text-[#CBD2E1] mt-1 max-w-sm font-medium">
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
