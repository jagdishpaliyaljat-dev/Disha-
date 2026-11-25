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
      className="fixed bottom-0 left-0 right-0 z-50 bg-white/95 dark:bg-[#130E26]/95 backdrop-blur-xl border-t border-slate-200 dark:border-[#31275E] shadow-[0_-2px_12px_rgba(23,19,41,0.06)] md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      <div className="max-w-3xl mx-auto w-full flex items-center justify-around px-2 sm:px-4 min-h-[58px]">
        {items.map((item) => {
          const isActive = activeTab === item.id;
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => handleTabClick(item.id)}
              aria-current={isActive ? "page" : undefined}
              className="flex-1 min-h-[48px] flex flex-col items-center justify-center py-1 transition-all duration-150 select-none active:scale-95 cursor-pointer relative group rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7045D8]"
            >
              <div
                className={`flex items-center justify-center transition-all duration-200 px-3 py-1 rounded-xl ${
                  isActive
                    ? "bg-[#7045D8]/12 dark:bg-[#7045D8]/25 text-[#7045D8] dark:text-[#A78BFA]"
                    : "text-slate-600 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-white"
                }`}
              >
                <div className="relative">
                  <Icon
                    className="w-5 h-5 sm:w-5.5 sm:h-5.5 transition-transform duration-200"
                    strokeWidth={isActive ? 2.4 : 1.9}
                  />
                  {item.hasLiveIndicator && !isActive && (
                    <span className="absolute -top-0.5 -right-1 w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-[#171329]" />
                  )}
                </div>
              </div>
              <span
                className={`text-[11px] sm:text-xs mt-0.5 tracking-tight transition-colors duration-150 truncate max-w-full px-0.5 leading-none ${
                  isActive
                    ? "text-[#7045D8] dark:text-[#A78BFA] font-black"
                    : "text-slate-600 dark:text-slate-400 font-semibold"
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
