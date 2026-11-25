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
            className="fixed inset-0 bg-[#130E26]/60 dark:bg-black/80 backdrop-blur-sm"
          />

          {/* Modal Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            role="dialog"
            aria-modal="true"
            className={`relative w-full ${maxWidthClasses} bg-[#F8FAFC] dark:bg-[#130E26] rounded-3xl sm:rounded-[28px] border border-slate-200 dark:border-[#31275E] shadow-2xl overflow-hidden flex flex-col max-h-[90vh] z-10 ${className}`}
          >
            {/* Modal Header */}
            {(title || Icon) && (
              <div className="px-5 py-4 sm:px-6 sm:py-4.5 bg-white/95 dark:bg-[#1B1536]/95 backdrop-blur-md border-b border-slate-200 dark:border-[#31275E] flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3 min-w-0">
                  {Icon && (
                    <div className="w-10 h-10 rounded-xl bg-[#7045D8]/10 dark:bg-[#A78BFA]/15 text-[#7045D8] dark:text-[#A78BFA] flex items-center justify-center shrink-0">
                      <Icon className="w-5 h-5" />
                    </div>
                  )}
                  <div className="min-w-0">
                    {title && (
                      <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-slate-50 tracking-tight truncate font-hindi">
                        {title}
                      </h3>
                    )}
                    {subtitle && (
                      <p className="text-xs text-slate-600 dark:text-slate-300 font-medium truncate mt-0.5">
                        {subtitle}
                      </p>
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleClose}
                  className="w-11 h-11 rounded-xl bg-slate-100 dark:bg-[#241D48] hover:bg-slate-200 dark:hover:bg-[#31275E] text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-[#31275E] flex items-center justify-center active:scale-95 transition-all cursor-pointer shrink-0 ml-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7045D8]"
                  aria-label="Close modal"
                >
                  <X className="w-4.5 h-4.5" />
                </button>
              </div>
            )}

            {/* Modal Body */}
            <div className="p-4 sm:p-6 overflow-y-auto flex-1">{children}</div>

            {/* Modal Footer */}
            {footer && (
              <div className="px-5 py-3.5 sm:px-6 sm:py-4 bg-white/95 dark:bg-[#1B1536]/95 border-t border-slate-200 dark:border-[#31275E] flex items-center justify-end gap-2.5 shrink-0 pb-[calc(14px+env(safe-area-inset-bottom,0px))]">
                {footer}
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
