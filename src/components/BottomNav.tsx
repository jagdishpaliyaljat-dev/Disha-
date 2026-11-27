import React from "react";
import { ActiveTab } from "../types";
import { Home, BookOpen, User, Trophy, ShieldCheck } from "lucide-react";
import { triggerHaptic, playClickSound } from "../utils/audioFeedback";

import { useAppFeatures } from "../utils/featureControlService";

interface BottomNavProps {
  activeTab: ActiveTab;
  onChangeTab: (tab: ActiveTab) => void;
  wrongCount?: number;
  dueCount?: number;
  isAdmin?: boolean;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  activeTab,
  onChangeTab,
  isAdmin = false,
}) => {
  const { isEnabled } = useAppFeatures();

  const items: { id: ActiveTab; label: string; icon: any; hasLiveIndicator?: boolean }[] = [
    { id: "home" as ActiveTab, label: "Home", icon: Home },
    { id: "topics" as ActiveTab, label: "Subjects", icon: BookOpen },
  ];

  if (isEnabled("live_tests")) {
    items.push({ id: "live_tests" as ActiveTab, label: "Tests", icon: Trophy, hasLiveIndicator: true });
  }

  if (isAdmin) {
    items.push({ id: "admin" as ActiveTab, label: "Admin", icon: ShieldCheck });
  }

  items.push({ id: "profile" as ActiveTab, label: "Profile", icon: User });

  const handleTabClick = (tabId: ActiveTab) => {
    triggerHaptic("light");
    playClickSound();
    onChangeTab(tabId);
  };

  return (
    <nav
      id="bottom-navigation-bar"
      aria-label="Primary Navigation"
      className="fixed bottom-0 left-0 right-0 z-50 bg-white/90 dark:bg-[#0F0A1E]/90 backdrop-blur-2xl border-t border-slate-200/70 dark:border-white/10 shadow-[0_-4px_24px_rgba(112,69,216,0.06)] md:hidden transition-all"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      <div className="max-w-md mx-auto w-full flex items-center justify-around px-3 min-h-[64px]">
        {items.map((item) => {
          const isActive = activeTab === item.id;
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => handleTabClick(item.id)}
              aria-current={isActive ? "page" : undefined}
              className="flex-1 min-h-[52px] flex flex-col items-center justify-center py-1 transition-all duration-200 select-none active:scale-90 cursor-pointer relative group rounded-2xl focus-visible:outline-none"
            >
              <div
                className={`relative flex items-center justify-center transition-all duration-300 px-4 py-1.5 rounded-full ${
                  isActive
                    ? "bg-[#7045D8] text-white shadow-md shadow-[#7045D8]/35 scale-105"
                    : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
                }`}
              >
                <Icon
                  className="w-5 h-5 transition-transform duration-200"
                  strokeWidth={isActive ? 2.5 : 1.8}
                />
                {item.hasLiveIndicator && !isActive && (
                  <span className="absolute 1 top-1 right-2 w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-[#0F0A1E] animate-pulse" />
                )}
              </div>
              <span
                className={`text-[11px] mt-1 tracking-tight transition-all duration-200 truncate max-w-full leading-tight ${
                  isActive
                    ? "text-[#7045D8] dark:text-[#A78BFA] font-black scale-105"
                    : "text-slate-600 dark:text-slate-400 font-medium"
                }`}
              >
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
