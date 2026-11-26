import React from "react";
import { AppModal } from "./ui/AppModal";
import { Command, CornerDownLeft, ArrowRight, ArrowLeft, Bookmark, Search, Moon, HelpCircle } from "lucide-react";

interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const KeyboardShortcutsModal: React.FC<KeyboardShortcutsModalProps> = ({
  isOpen,
  onClose,
}) => {
  const shortcutGroups = [
    {
      title: "Global & Navigation",
      items: [
        { label: "Search Questions, Topics & PYQs", keys: ["Ctrl", "K"], orKey: "/" },
        { label: "Close Active Modal / Drawer", keys: ["Esc"] },
        { label: "Open Keyboard Shortcuts Help", keys: ["?"] },
        { label: "Go to Home / Feed", keys: ["Alt", "1"] },
        { label: "Go to Topics & Syllabus", keys: ["Alt", "2"] },
        { label: "Go to Live Tests", keys: ["Alt", "3"] },
        { label: "Go to Official PYQ Vault", keys: ["Alt", "4"] },
        { label: "Go to Mistake Bank", keys: ["Alt", "5"] },
      ],
    },
    {
      title: "During MCQ Test / Practice Session",
      items: [
        { label: "Select Option A, B, C, D", keys: ["1", "2", "3", "4"] },
        { label: "Next Question / Submit Practice", keys: ["Enter"], orKey: "→" },
        { label: "Previous Question", keys: ["←"] },
        { label: "Bookmark / Mark for Review", keys: ["F"], orKey: "M" },
      ],
    },
  ];

  return (
    <AppModal
      isOpen={isOpen}
      onClose={onClose}
      title="Keyboard Shortcuts"
      maxWidth="md"
    >
      <div className="space-y-5 py-1">
        <p className="text-xs text-slate-600 dark:text-slate-300">
          Disha PYQ supports desktop keyboard shortcuts for faster navigation and seamless test practice.
        </p>

        {shortcutGroups.map((group) => (
          <div key={group.title} className="space-y-2">
            <h4 className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              {group.title}
            </h4>
            <div className="rounded-2xl border border-slate-200 dark:border-[#31275E] bg-slate-50/60 dark:bg-[#130E26]/60 divide-y divide-slate-200 dark:divide-[#31275E] overflow-hidden">
              {group.items.map((item) => (
                <div
                  key={item.label}
                  className="flex items-center justify-between px-3.5 py-2.5 text-xs text-slate-900 dark:text-slate-100"
                >
                  <span className="font-medium pr-2">{item.label}</span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <div className="flex items-center gap-1">
                      {item.keys.map((k) => (
                        <kbd
                          key={k}
                          className="px-2 py-1 text-[11px] font-mono font-bold bg-white dark:bg-[#1E173D] border border-slate-300 dark:border-[#43357B] rounded-lg shadow-2xs text-slate-800 dark:text-slate-200"
                        >
                          {k}
                        </kbd>
                      ))}
                    </div>
                    {item.orKey && (
                      <>
                        <span className="text-[10px] text-slate-600 dark:text-slate-300">or</span>
                        <kbd className="px-2 py-1 text-[11px] font-mono font-bold bg-white dark:bg-[#1E173D] border border-slate-300 dark:border-[#43357B] rounded-lg shadow-2xs text-slate-800 dark:text-slate-200">
                          {item.orKey}
                        </kbd>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </AppModal>
  );
};
