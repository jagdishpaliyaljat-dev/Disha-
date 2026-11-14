import React from "react";
import { ActiveTab } from "../types";
import { Home, BookOpen, User, Scan, Trophy, ShieldCheck } from "lucide-react";
import { triggerHaptic, playClickSound } from "../utils/audioFeedback";

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
  const items = [
    { id: "home" as ActiveTab, label: "Home", icon: Home },
    { id: "topics" as ActiveTab, label: "Subjects", icon: BookOpen },
    { id: "analyzer" as ActiveTab, label: "Paper Scan", icon: Scan },
    { id: "live_tests" as ActiveTab, label: "Tests", icon: Trophy, hasLiveIndicator: true },
  ];

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
      className="fixed bottom-0 left-0 right-0 z-50 bg-[#FFF9EF]/95 dark:bg-[#171923]/95 backdrop-blur-xl border-t border-[#E8D9C0] dark:border-[#31374A] shadow-[0_-2px_12px_rgba(23,25,35,0.05)] md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      <div className="max-w-3xl mx-auto w-full flex items-center justify-around px-1 sm:px-2 h-[54px] sm:h-[58px]">
        {items.map((item) => {
          const isActive = activeTab === item.id;
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => handleTabClick(item.id)}
              aria-current={isActive ? "page" : undefined}
              className="flex-1 min-h-[42px] sm:min-h-[44px] flex flex-col items-center justify-center py-1 transition-all duration-150 select-none active:scale-95 cursor-pointer relative group"
            >
              <div
                className={`flex items-center justify-center transition-all duration-200 px-1.5 sm:px-3 py-0.5 sm:py-1 rounded-lg sm:rounded-xl ${
                  isActive
                    ? "bg-[#800020]/10 dark:bg-[#F47B20]/15 text-[#800020] dark:text-[#F47B20]"
                    : "text-[#52576A] dark:text-[#929AB0] group-hover:text-[#171923] dark:group-hover:text-[#FFF9EF]"
                }`}
              >
                <div className="relative">
                  <Icon
                    className="w-4.5 h-4.5 sm:w-5 sm:h-5 transition-transform duration-200"
                    strokeWidth={isActive ? 2.4 : 1.9}
                  />
                  {item.hasLiveIndicator && !isActive && (
                    <span className="absolute -top-0.5 -right-1 w-2 h-2 rounded-full bg-[#F47B20] ring-2 ring-[#FFF9EF] dark:ring-[#171923]" />
                  )}
                </div>
              </div>
              <span
                className={`text-[9.5px] sm:text-[10.5px] mt-0.5 tracking-tight transition-colors duration-150 truncate max-w-full px-0.5 leading-none ${
                  isActive
                    ? "text-[#800020] dark:text-[#F47B20] font-extrabold"
                    : "text-[#52576A] dark:text-[#929AB0] font-medium"
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
