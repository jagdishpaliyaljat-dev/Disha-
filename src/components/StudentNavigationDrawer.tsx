import React from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  X,
  ChevronRight,
  BookOpen,
  Zap,
  FileText,
  RotateCcw,
  Target,
  Trophy,
  BarChart3,
  User,
  Scan,
  Key,
  Newspaper,
  Info,
  HelpCircle,
  ShieldCheck,
  Moon,
  Sun,
  LogIn,
  LogOut,
  Flame,
  LayoutDashboard,
} from "lucide-react";
import { ActiveTab, AppSettings, UserProfile } from "../types";
import { UserAvatar } from "./ui/UserAvatar";

interface StudentNavigationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  activeTab: ActiveTab;
  userProfile?: UserProfile | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  settings: AppSettings;
  attemptedCount: number;
  accuracy: number;
  correctCount: number;
  onNavigateTab: (tab: ActiveTab) => void;
  onOpenLiveBattle: () => void;
  onOpenLeaderboard: () => void;
  onOpenExamAnalyzer: () => void;
  onOpenApiSettings: () => void;
  onToggleDarkMode: () => void;
  onOpenLogin: () => void;
  onLogout: () => void;
}

export const StudentNavigationDrawer: React.FC<StudentNavigationDrawerProps> = ({
  isOpen,
  onClose,
  activeTab,
  userProfile,
  isAuthenticated,
  isAdmin,
  settings,
  attemptedCount,
  accuracy,
  correctCount,
  onNavigateTab,
  onOpenLiveBattle,
  onOpenLeaderboard,
  onOpenExamAnalyzer,
  onOpenApiSettings,
  onToggleDarkMode,
  onOpenLogin,
  onLogout,
}) => {
  const userName = !isAuthenticated ? "Guest Aspirant" : userProfile?.name || "Aspirant";

  const navigateAndClose = (fn: () => void) => {
    fn();
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex" role="dialog" aria-modal="true" aria-label="Navigation Menu">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-[2px]"
            onClick={onClose}
          />

          <motion.div
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={{ type: "spring", damping: 26, stiffness: 220 }}
            className="relative w-[85vw] max-w-[340px] bg-[#F8FAFC] dark:bg-[#130E26] h-full flex flex-col shadow-2xl z-10 overflow-hidden border-r border-slate-200 dark:border-[#31275E]"
          >
            {/* Drawer Header */}
            <div className="relative pt-[calc(20px+env(safe-area-inset-top,0px))] pb-7 px-5 bg-gradient-to-br from-[#7045D8] via-[#5B32BF] to-[#3B1D8C] text-white overflow-hidden">
              <div className="relative z-10">
                <button
                  type="button"
                  onClick={onClose}
                  className="absolute -top-1 -right-1 w-11 h-11 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center text-white transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                  aria-label="Close drawer"
                >
                  <X size={18} />
                </button>

                <div className="flex items-center gap-3.5 mt-2 pr-10">
                  <div className="w-12 h-12 rounded-full border-2 border-white/50 p-0.5 shrink-0 overflow-hidden bg-white/10">
                    <UserAvatar
                      name={userName}
                      photoURL={userProfile?.photoURL}
                      sizeClassName="w-full h-full"
                    />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-base font-extrabold truncate leading-none mb-1.5">
                      {userName}
                    </h3>
                    <div className="flex items-center gap-2 text-[11px] font-bold">
                      <span className="px-2 py-0.5 rounded-md bg-white/15 uppercase tracking-wider">
                        {isAuthenticated ? (isAdmin ? "Admin" : "Aspirant") : "Guest"}
                      </span>
                      {isAuthenticated && (
                        <span className="flex items-center gap-1 text-amber-300 bg-black/25 px-2 py-0.5 rounded-md">
                          <Flame size={11} />
                          <span>{userProfile?.streakDays || 0}D</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Stats Card */}
            <div className="mx-4 -mt-4 relative z-20 bg-white dark:bg-[#1B1536] rounded-2xl p-3 shadow-md border border-slate-200 dark:border-[#31275E] flex items-center justify-around">
              <div className="text-center">
                <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-0.5">
                  Solved
                </span>
                <span className="text-xs font-extrabold text-slate-900 dark:text-slate-50 font-mono tabular-nums">
                  {attemptedCount}
                </span>
              </div>
              <div className="w-px h-6 bg-slate-200 dark:bg-[#31275E]" />
              <div className="text-center">
                <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-0.5">
                  Accuracy
                </span>
                <span className="text-xs font-extrabold text-[#7045D8] dark:text-[#A78BFA] font-mono tabular-nums">
                  {accuracy}%
                </span>
              </div>
              <div className="w-px h-6 bg-slate-200 dark:bg-[#31275E]" />
              <div className="text-center">
                <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-0.5">
                  Correct
                </span>
                <span className="text-xs font-extrabold text-emerald-600 dark:text-emerald-400 font-mono tabular-nums">
                  {correctCount}
                </span>
              </div>
            </div>

            {/* Scrollable Navigation Links */}
            <div className="flex-1 overflow-y-auto px-3.5 py-4 space-y-5 no-scrollbar">
              {/* 1. Core Learning */}
              <div className="space-y-1">
                <h4 className="text-[11px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-[0.16em] px-2.5 mb-1.5">
                  Core Learning
                </h4>
                {[
                  { label: "Dashboard", icon: LayoutDashboard, tab: "home" as ActiveTab },
                  { label: "Subjects & Syllabus", icon: BookOpen, tab: "topics" as ActiveTab },
                  { label: "Live Tests", icon: Zap, tab: "live_tests" as ActiveTab },
                  { label: "PYQ Vault", icon: FileText, tab: "pyq_vault" as ActiveTab },
                  { label: "Mistake Bank", icon: RotateCcw, tab: "wrong" as ActiveTab },
                ].map((item) => {
                  const isCurrent = activeTab === item.tab;
                  return (
                    <button
                      key={item.label}
                      type="button"
                      onClick={() => navigateAndClose(() => onNavigateTab(item.tab))}
                      aria-current={isCurrent ? "page" : undefined}
                      className={`group w-full min-h-[44px] flex items-center gap-3 px-2.5 py-1.5 rounded-xl border transition-all duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7045D8] ${
                        isCurrent
                          ? "bg-[#7045D8]/10 dark:bg-[#7045D8]/20 border-[#7045D8]/30"
                          : "border-transparent hover:bg-white dark:hover:bg-[#1B1536] hover:border-slate-200 dark:hover:border-[#31275E]"
                      }`}
                    >
                      <div className="w-9 h-9 rounded-xl bg-[#7045D8]/10 dark:bg-[#A78BFA]/15 border border-[#7045D8]/20 dark:border-[#A78BFA]/25 text-[#7045D8] dark:text-[#A78BFA] flex items-center justify-center shrink-0">
                        <item.icon size={16} strokeWidth={1.9} />
                      </div>
                      <span
                        className={`text-xs sm:text-[13px] font-semibold tracking-tight transition-colors ${
                          isCurrent
                            ? "text-[#7045D8] dark:text-[#A78BFA] font-bold"
                            : "text-slate-900 dark:text-slate-100 group-hover:text-[#7045D8] dark:group-hover:text-[#A78BFA]"
                        }`}
                      >
                        {item.label}
                      </span>
                      <ChevronRight
                        size={14}
                        className="ml-auto text-slate-400 group-hover:text-[#7045D8] dark:group-hover:text-[#A78BFA] group-hover:translate-x-0.5 transition-all"
                      />
                    </button>
                  );
                })}
              </div>

              {/* 2. Competitive & Interactive */}
              <div className="space-y-1">
                <h4 className="text-[11px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-[0.16em] px-2.5 mb-1.5">
                  Competitive &amp; Interactive
                </h4>
                {[
                  { label: "Live Quiz Battle", icon: Target, action: onOpenLiveBattle },
                  { label: "Weekly Leaderboard", icon: Trophy, action: onOpenLeaderboard },
                ].map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => navigateAndClose(item.action)}
                    className="group w-full min-h-[44px] flex items-center gap-3 px-2.5 py-1.5 rounded-xl hover:bg-white dark:hover:bg-[#1B1536] border border-transparent hover:border-slate-200 dark:hover:border-[#31275E] transition-all duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7045D8]"
                  >
                    <div className="w-9 h-9 rounded-xl bg-amber-500/12 dark:bg-amber-500/20 border border-amber-500/25 text-amber-700 dark:text-amber-400 flex items-center justify-center shrink-0">
                      <item.icon size={16} strokeWidth={1.9} />
                    </div>
                    <span className="text-xs sm:text-[13px] font-semibold text-slate-900 dark:text-slate-100 tracking-tight group-hover:text-amber-700 dark:group-hover:text-amber-400 transition-colors">
                      {item.label}
                    </span>
                    <ChevronRight
                      size={14}
                      className="ml-auto text-slate-400 group-hover:text-amber-600 group-hover:translate-x-0.5 transition-all"
                    />
                  </button>
                ))}
              </div>

              {/* 3. Progress & Profile */}
              <div className="space-y-1">
                <h4 className="text-[11px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-[0.16em] px-2.5 mb-1.5">
                  Progress &amp; Profile
                </h4>
                {[
                  { label: "Performance Reports", icon: BarChart3, tab: "analytics" as ActiveTab },
                  { label: "My Profile", icon: User, tab: "profile" as ActiveTab },
                ].map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => navigateAndClose(() => onNavigateTab(item.tab))}
                    className="group w-full min-h-[44px] flex items-center gap-3 px-2.5 py-1.5 rounded-xl hover:bg-white dark:hover:bg-[#1B1536] border border-transparent hover:border-slate-200 dark:hover:border-[#31275E] transition-all duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7045D8]"
                  >
                    <div className="w-9 h-9 rounded-xl bg-indigo-500/10 dark:bg-indigo-500/15 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                      <item.icon size={16} strokeWidth={1.9} />
                    </div>
                    <span className="text-xs sm:text-[13px] font-semibold text-slate-900 dark:text-slate-100 tracking-tight group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                      {item.label}
                    </span>
                    <ChevronRight
                      size={14}
                      className="ml-auto text-slate-400 group-hover:text-indigo-600 group-hover:translate-x-0.5 transition-all"
                    />
                  </button>
                ))}
              </div>

              {/* 4. Resources & Support */}
              <div className="space-y-1">
                <h4 className="text-[11px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-[0.16em] px-2.5 mb-1.5">
                  Resources &amp; Tools
                </h4>
                {[
                  { label: "Paper Scanner / OMR", icon: Scan, action: onOpenExamAnalyzer },
                  { label: "AI Engine Settings", icon: Key, action: onOpenApiSettings },
                  { label: "Exam News & Guides", icon: Newspaper, tab: "news" as ActiveTab },
                  { label: "About Disha PYQ", icon: Info, tab: "about" as ActiveTab },
                  { label: "Help & Support", icon: HelpCircle, tab: "contact" as ActiveTab },
                ].map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() =>
                      navigateAndClose(() => {
                        if ("action" in item && item.action) {
                          item.action();
                        } else if ("tab" in item && item.tab) {
                          onNavigateTab(item.tab);
                        }
                      })
                    }
                    className="group w-full min-h-[44px] flex items-center gap-3 px-2.5 py-1.5 rounded-xl hover:bg-white dark:hover:bg-[#1B1536] border border-transparent hover:border-slate-200 dark:hover:border-[#31275E] transition-all duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7045D8]"
                  >
                    <div className="w-9 h-9 rounded-xl bg-teal-500/10 dark:bg-teal-500/15 border border-teal-500/20 text-teal-700 dark:text-teal-400 flex items-center justify-center shrink-0">
                      <item.icon size={16} strokeWidth={1.9} />
                    </div>
                    <span className="text-xs sm:text-[13px] font-semibold text-slate-900 dark:text-slate-100 tracking-tight group-hover:text-teal-700 dark:group-hover:text-teal-400 transition-colors">
                      {item.label}
                    </span>
                    <ChevronRight
                      size={14}
                      className="ml-auto text-slate-400 group-hover:text-teal-600 group-hover:translate-x-0.5 transition-all"
                    />
                  </button>
                ))}
              </div>

              {/* 5. Admin Management */}
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => navigateAndClose(() => onNavigateTab("admin"))}
                  className="group w-full min-h-[48px] flex items-center gap-3 p-2.5 rounded-xl bg-emerald-600/10 border border-emerald-600/25 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-600/15 transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
                >
                  <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                    <ShieldCheck size={16} strokeWidth={1.9} />
                  </div>
                  <div className="text-left">
                    <span className="text-sm font-extrabold block leading-tight">Admin Panel</span>
                    <span className="text-[11px] font-bold opacity-80 uppercase tracking-wider">
                      Content Management
                    </span>
                  </div>
                  <ChevronRight size={14} className="ml-auto opacity-70 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
                </button>
              )}
            </div>

            {/* Drawer Footer */}
            <div className="p-4 pb-[calc(16px+env(safe-area-inset-bottom,0px))] bg-white dark:bg-[#1B1536] border-t border-slate-200 dark:border-[#31275E] space-y-3">
              <button
                type="button"
                onClick={onToggleDarkMode}
                className="w-full min-h-[44px] flex items-center justify-between p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-[#241D48] transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7045D8]"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-[#130E26] text-[#7045D8] dark:text-[#A78BFA] flex items-center justify-center shadow-2xs">
                    {settings.darkMode ? <Moon size={16} /> : <Sun size={16} />}
                  </div>
                  <span className="text-xs font-bold text-slate-900 dark:text-slate-50">
                    Display Mode
                  </span>
                </div>
                <div
                  className={`w-11 h-6 rounded-full relative p-0.5 transition-colors ${
                    settings.darkMode ? "bg-[#7045D8]" : "bg-slate-300"
                  }`}
                >
                  <div
                    className={`w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${
                      settings.darkMode ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </div>
              </button>

              {!isAuthenticated ? (
                <button
                  type="button"
                  onClick={() => navigateAndClose(onOpenLogin)}
                  className="w-full min-h-[44px] py-3 rounded-xl bg-[#7045D8] hover:bg-[#5B32BF] text-white text-xs font-extrabold uppercase tracking-wider flex items-center justify-center gap-2 active:scale-95 transition-transform cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7045D8]"
                >
                  <LogIn size={15} />
                  <span>Sign in to Disha PYQ</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => navigateAndClose(onLogout)}
                  className="w-full min-h-[44px] py-3 rounded-xl bg-slate-100 dark:bg-[#241D48] border border-slate-200 dark:border-[#31275E] text-slate-900 dark:text-slate-50 text-xs font-extrabold uppercase tracking-wider flex items-center justify-center gap-2 active:scale-95 transition-transform cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7045D8]"
                >
                  <LogOut size={15} />
                  <span>Sign Out</span>
                </button>
              )}

              <div className="flex items-center justify-between px-1 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                <span>Disha PYQ</span>
                <span>Previous Year Questions</span>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
