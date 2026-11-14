import React from "react";
import { motion, AnimatePresence } from "motion/react";
import { X } from "lucide-react";
import { triggerHaptic } from "../../utils/audioFeedback";

export interface AppModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  icon?: React.ElementType;
  maxWidth?: "sm" | "md" | "lg" | "xl" | "2xl" | "3xl" | "full";
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}

export const AppModal: React.FC<AppModalProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  icon: Icon,
  maxWidth = "lg",
  children,
  footer,
  className = "",
}) => {
  const maxWidthClasses = {
    sm: "max-w-sm",
    md: "max-w-md",
    lg: "max-w-lg",
    xl: "max-w-xl",
    "2xl": "max-w-2xl",
    "3xl": "max-w-3xl",
    full: "max-w-5xl",
  }[maxWidth];

  const handleClose = () => {
    triggerHaptic("light");
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            className="fixed inset-0 bg-[#171923]/60 dark:bg-black/80 backdrop-blur-sm"
          />

          {/* Modal Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className={`relative w-full ${maxWidthClasses} bg-[#FFF9EF] dark:bg-[#171923] rounded-3xl sm:rounded-[28px] border border-[#E8D9C0] dark:border-[#31374A] shadow-2xl overflow-hidden flex flex-col max-h-[90vh] z-10 ${className}`}
          >
            {/* Modal Header */}
            {(title || Icon) && (
              <div className="px-5 py-4 sm:px-6 sm:py-4.5 bg-white/95 dark:bg-[#1F2330]/95 backdrop-blur-md border-b border-[#E8D9C0] dark:border-[#31374A] flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3 min-w-0">
                  {Icon && (
                    <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-[#800020]/10 dark:bg-[#F47B20]/15 text-[#800020] dark:text-[#F47B20] flex items-center justify-center shrink-0">
                      <Icon className="w-4.5 h-4.5 sm:w-5 sm:h-5" />
                    </div>
                  )}
                  <div className="min-w-0">
                    {title && (
                      <h3 className="text-base sm:text-lg font-black text-[#171923] dark:text-[#FFF9EF] tracking-tight truncate font-hindi">
                        {title}
                      </h3>
                    )}
                    {subtitle && (
                      <p className="text-[11px] sm:text-xs text-[#52576A] dark:text-[#CBD2E1] font-medium truncate mt-0.5">
                        {subtitle}
                      </p>
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleClose}
                  className="w-9 h-9 rounded-xl bg-[#F7EFE2] dark:bg-[#252A3A] hover:bg-[#EFE3CF] dark:hover:bg-[#31374A] text-[#171923] dark:text-[#FFF9EF] border border-[#E8D9C0] dark:border-[#31374A] flex items-center justify-center active:scale-95 transition-all cursor-pointer shrink-0 ml-2"
                  aria-label="Close modal"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Modal Body */}
            <div className="p-4 sm:p-6 overflow-y-auto flex-1">{children}</div>

            {/* Modal Footer */}
            {footer && (
              <div className="px-5 py-3.5 sm:px-6 sm:py-4 bg-white/95 dark:bg-[#1F2330]/95 border-t border-[#E8D9C0] dark:border-[#31374A] flex items-center justify-end gap-2.5 shrink-0">
                {footer}
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
