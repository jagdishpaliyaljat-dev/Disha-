import React, { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  ProgressStore,
  AppSettings,
  MCQSession,
  Question,
  Chapter,
  Topic,
  UserQuestionsStore,
  DailyStudyHistory,
  ActiveTab,
  UserProfile,
  AppBanner,
  Subject,
} from "../types";
import { loadUserProfile, isUserAdmin } from "../utils/userProfileStorage";
import { useAppFeatures } from "../utils/featureControlService";
import {
  CHAPTERS_DATA,
  ALL_QUESTIONS,
} from "../data/questions";
import {
  Menu,
  Bell,
  Settings,
  FileText,
  X,
  ChevronRight,
  BookOpen,
  FlaskConical,
  History,
  Globe,
  Newspaper,
  Brain,
  ShieldCheck,
  FileX,
  Flame,
  Zap,
  LogOut,
  Key,
  Home,
  Trophy,
  BarChart2,
  LogIn,
  Info,
  Moon,
  Sun,
  Plus,
  Compass,
  Target,
  Swords,
  User,
  HelpCircle,
  LayoutDashboard,
  RotateCcw,
  BarChart3,
  Scan,
} from "lucide-react";
import { BannerSlides } from "./BannerSlides";
import { AppLogo } from "./AppLogo";
import type { ShareData } from "./ShareModal";
import { subscribeToActiveBanners, getLocalBanners } from "../utils/bannerStorage";

const CreateTestModal = React.lazy(() => import("./CreateTestModal"));
const ShareModal = React.lazy(() => import("./ShareModal"));
const WeeklyLeaderboard = React.lazy(() => import("./WeeklyLeaderboard"));

interface HomeTabProps {
  progressStore: ProgressStore;
  settings: AppSettings;
  subjects?: Subject[];
  questions?: Question[];
  chapters?: Chapter[];
  questionsStore?: UserQuestionsStore;
  topicsMap?: Record<string, Topic>;
  chaptersMap?: Record<string, Chapter>;
  studyHistory?: DailyStudyHistory;
  userProfile?: UserProfile | null;
  unreadNotificationsCount?: number;
  banners?: AppBanner[];
  isAuthenticated?: boolean;
  onOpenLogin?: () => void;
  onOpenNotifications?: () => void;
  onOpenSearch?: () => void;
  onStartSession: (session: MCQSession) => void;
  onNavigateToChapter: (chapterId: string) => void;
  onSelectSubject?: (subjectId: string) => void;
  onShowAddSubject?: () => void;
  onNavigateTab?: (tab: ActiveTab) => void;
  onOpenPDFExport?: () => void;
  onOpenFullExam?: () => void;
  onOpenExamAnalyzer?: () => void;
  onOpenApiSettings?: () => void;
  onOpenLiveBattle?: () => void;
  onToggleDarkMode?: () => void;
  onLogout?: () => void;
}

export const HomeTab: React.FC<HomeTabProps> = ({
  progressStore,
  settings,
  subjects: propSubjects,
  questions = ALL_QUESTIONS,
  chapters = CHAPTERS_DATA,
  questionsStore,
  userProfile,
  unreadNotificationsCount = 0,
  banners,
  isAuthenticated = false,
  onOpenLogin,
  onOpenNotifications,
  onOpenSearch,
  onStartSession,
  onSelectSubject,
  onShowAddSubject,
  onNavigateTab,
  onOpenExamAnalyzer,
  onOpenApiSettings,
  onOpenLiveBattle,
  onToggleDarkMode,
  onLogout,
}) => {
  const [showCreateTestModal, setShowCreateTestModal] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [shareData, setShareData] = useState<ShareData | null>(null);

  const [activeBanners, setActiveBanners] = useState<AppBanner[]>(() => {
    if (banners && banners.length > 0) return banners;
    try {
      return getLocalBanners()
        .filter((b) => b.isActive)
        .sort((a, b) => (a.order || 0) - (b.order || 0));
    } catch {
      return [];
    }
  });

  const externalBannersKey = banners ? banners.map((b) => b.id).join(",") : "";

  useEffect(() => {
    if (banners && banners.length > 0) {
      setActiveBanners(banners);
      return;
    }
    const unsubscribe = subscribeToActiveBanners((updated) => {
      const next = updated || [];
      setActiveBanners((prev) => {
        if (
          prev.length === next.length &&
          prev.every(
            (b, i) =>
              b.id === next[i]?.id &&
              b.imageUrl === next[i]?.imageUrl &&
              b.title === next[i]?.title &&
              b.isActive === next[i]?.isActive
          )
        ) {
          return prev;
        }
        return next;
      });
    });
    return () => unsubscribe();
  }, [externalBannersKey]);

  const { attemptedCount, correctCount, accuracy } = useMemo(() => {
    let attempted = 0;
    let correct = 0;
    const qList = Array.isArray(questions) ? questions : [];
    for (let i = 0; i < qList.length; i++) {
      const q = qList[i];
      if (!q || !q.id) continue;
      const p = progressStore ? progressStore[q.id] : undefined;
      if (p && p.status !== "unattempted") {
        attempted++;
        if (p.status === "correct") {
          correct++;
        }
      }
    }
    return {
      attemptedCount: attempted,
      correctCount: correct,
      accuracy: attempted > 0 ? Math.round((correct / attempted) * 100) : 0,
    };
  }, [questions, progressStore]);

  const currentUserProfile = userProfile || loadUserProfile();
  const userName = !isAuthenticated ? "Guest Aspirant" : (currentUserProfile?.name || "Aspirant");
  const isAdmin = isUserAdmin(currentUserProfile);
  const { features, isEnabled } = useAppFeatures();

  return (
    <div
      className="flex flex-col w-full min-h-full bg-[#FFF9EF] dark:bg-[#171923] text-[#171923] dark:text-[#FFF9EF]"
      id="home-container"
    >
      {/* 1. OPTIMIZED COMPACT BRAND HEADER (Mobile: 68-72dp excluding status bar inset) */}
      <header className="sticky top-0 z-40 bg-[#FFF9EF]/95 dark:bg-[#171923]/95 backdrop-blur-md border-b border-[#E8D9C0] dark:border-[#31374A] select-none md:hidden w-full max-w-full overflow-hidden shadow-xs transition-colors pt-[env(safe-area-inset-top,0px)]">
        <div className="h-[68px] sm:h-[72px] px-3 sm:px-5 max-w-5xl mx-auto flex items-center justify-between gap-2">
          {/* Left Brand Identity: Drawer Trigger + Non-wrapping Logo */}
          <div className="flex items-center gap-2 sm:gap-2.5 min-w-0 shrink-0">
            <button
              onClick={() => setIsMenuOpen(true)}
              className="w-10 h-10 rounded-xl bg-[#F7EFE2] dark:bg-[#252A3A] hover:bg-[#EFE3CF] dark:hover:bg-[#31374A] flex items-center justify-center text-[#171923] dark:text-[#FFF9EF] active:scale-95 transition-all shrink-0 cursor-pointer border border-[#E8D9C0] dark:border-[#31374A]"
              aria-label="Open menu drawer"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 whitespace-nowrap select-none">
              <span className="text-base sm:text-lg font-black tracking-wider text-[#171923] dark:text-[#FFF9EF] uppercase font-serif whitespace-nowrap shrink-0">
                DISHA
              </span>
              <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-lg bg-gradient-to-r from-[#F47B20] to-[#E06A12] text-white font-black text-xs tracking-tight shadow-xs whitespace-nowrap shrink-0 leading-none">
                20-20
              </span>
            </div>
          </div>

          {/* Right Action Icons: Notification, Theme, Compact Sign In / Avatar */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={onOpenNotifications || (() => onNavigateTab?.("notifications"))}
              className="relative w-10 h-10 rounded-xl bg-[#F7EFE2] dark:bg-[#252A3A] hover:bg-[#EFE3CF] dark:hover:bg-[#31374A] flex items-center justify-center text-[#171923] dark:text-[#FFF9EF] active:scale-95 transition-all cursor-pointer border border-[#E8D9C0] dark:border-[#31374A] shrink-0"
              aria-label="Notifications"
            >
              <Bell className="w-4.5 h-4.5" />
              {unreadNotificationsCount > 0 && (
                <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-[#F47B20] ring-2 ring-[#FFF9EF] dark:ring-[#171923]" />
              )}
            </button>

            <button
              onClick={onToggleDarkMode}
              className="w-10 h-10 rounded-xl bg-[#F7EFE2] dark:bg-[#252A3A] hover:bg-[#EFE3CF] dark:hover:bg-[#31374A] flex items-center justify-center text-[#171923] dark:text-[#C99A45] active:scale-95 transition-all cursor-pointer border border-[#E8D9C0] dark:border-[#31374A] shrink-0"
              aria-label={settings.darkMode ? "Switch to Day Mode" : "Switch to Night Mode"}
              title={settings.darkMode ? "Day Mode" : "Night Mode"}
            >
              {settings.darkMode ? (
                <Sun className="w-4.5 h-4.5 text-[#F47B20]" />
              ) : (
                <Moon className="w-4.5 h-4.5 text-[#800020]" />
              )}
            </button>

            {!isAuthenticated ? (
              <button
                onClick={onOpenLogin}
                className="flex items-center gap-1.5 h-10 px-3 rounded-xl bg-[#800020] hover:bg-[#5E0017] dark:bg-[#F47B20] dark:hover:bg-[#E06A12] text-white text-xs font-black shadow-xs transition-all active:scale-95 cursor-pointer shrink-0 whitespace-nowrap"
                aria-label="Login to DISHA 20-20"
              >
                <LogIn className="w-3.5 h-3.5 shrink-0" />
                <span>Sign In</span>
              </button>
            ) : (
              <button
                onClick={() => onNavigateTab?.("profile")}
                className="w-10 h-10 rounded-full ring-2 ring-[#C99A45]/60 hover:ring-[#800020] dark:hover:ring-[#F47B20] flex items-center justify-center overflow-hidden active:scale-95 transition-all cursor-pointer bg-[#F7EFE2] dark:bg-[#252A3A] shrink-0"
                aria-label="User Profile"
              >
                <img
                  src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${userName}`}
                  alt="Avatar"
                  className="w-full h-full object-cover"
                />
              </button>
            )}
          </div>
        </div>
      </header>

      {/* MAIN CONTENT CANVAS */}
      <main className="w-full max-w-5xl mx-auto px-2.5 sm:px-6 pt-2 sm:pt-3 space-y-3 sm:space-y-4 pb-24 select-none">
        {/* 2. PROMINENT BANNER CAROUSEL */}
        <BannerSlides banners={activeBanners} onNavigateTab={onNavigateTab} />

        {/* 3. TOP SUMMARY & QUICK 2x2 ACTION MATRIX (Responsive 1-col mobile, 12-col desktop) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 sm:gap-4 items-stretch">
          {/* Performance Summary Card */}
          <section className="lg:col-span-5 bg-white dark:bg-[#1F2330] rounded-xl sm:rounded-2xl p-3 sm:p-4 border border-[#E8D9C0] dark:border-[#31374A] shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2.5 sm:mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-7.5 h-7.5 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl bg-[#800020]/10 dark:bg-[#F47B20]/15 text-[#800020] dark:text-[#F47B20] flex items-center justify-center shrink-0">
                    <BarChart2 className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-xs sm:text-sm font-extrabold text-[#171923] dark:text-[#FFF9EF] leading-tight">
                      Preparation Overview
                    </h2>
                    <p className="text-[10px] sm:text-[10.5px] text-[#52576A] dark:text-[#CBD2E1]">
                      Daily practice and accuracy score
                    </p>
                  </div>
                </div>
                <span className="text-[10px] sm:text-[11px] font-extrabold text-[#800020] dark:text-[#F47B20] uppercase tracking-wider">
                  {accuracy >= 70 ? "● Strong" : accuracy >= 40 ? "● On Track" : "● Building"}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
                <div className="text-center p-2 sm:p-2.5 rounded-lg sm:rounded-xl bg-[#FFF9EF] dark:bg-[#171923] border border-[#E8D9C0]/80 dark:border-[#31374A]">
                  <p className="text-[9px] sm:text-[10px] font-bold text-[#52576A] dark:text-[#929AB0] uppercase tracking-wider mb-0.5">
                    Attempted
                  </p>
                  <p className="text-base sm:text-lg font-extrabold text-[#171923] dark:text-[#FFF9EF] font-mono tabular-nums">
                    {attemptedCount}
                  </p>
                </div>
                <div className="text-center p-2 sm:p-2.5 rounded-lg sm:rounded-xl bg-[#FFF9EF] dark:bg-[#171923] border border-[#E8D9C0]/80 dark:border-[#31374A]">
                  <p className="text-[9px] sm:text-[10px] font-bold text-[#52576A] dark:text-[#929AB0] uppercase tracking-wider mb-0.5">
                    Accuracy
                  </p>
                  <p className="text-base sm:text-lg font-extrabold text-[#800020] dark:text-[#F47B20] font-mono tabular-nums">
                    {accuracy}%
                  </p>
                </div>
                <div className="text-center p-2 sm:p-2.5 rounded-lg sm:rounded-xl bg-[#FFF9EF] dark:bg-[#171923] border border-[#E8D9C0]/80 dark:border-[#31374A]">
                  <p className="text-[9px] sm:text-[10px] font-bold text-[#52576A] dark:text-[#929AB0] uppercase tracking-wider mb-0.5">
                    Correct
                  </p>
                  <p className="text-base sm:text-lg font-extrabold text-[#15803D] dark:text-[#22C55E] font-mono tabular-nums">
                    {correctCount}
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-2.5 sm:mt-3 pt-2 sm:pt-2.5 border-t border-[#E8D9C0]/80 dark:border-[#31374A]">
              <button
                onClick={() => onNavigateTab?.("analytics")}
                className="w-full min-h-[32px] sm:min-h-[36px] text-center text-[11px] sm:text-xs font-extrabold text-[#800020] dark:text-[#F47B20] hover:opacity-80 flex items-center justify-center gap-1 active:scale-95 transition-all cursor-pointer"
              >
                <span>View AI Diagnostic Report</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </section>

          {/* 4-Card Core Practice Grid */}
          <section className="lg:col-span-7 grid grid-cols-2 gap-2 sm:gap-3">
            {/* Live Mock Tests */}
            <motion.button
              whileTap={{ scale: 0.98 }}
              onClick={() => {
                if (!isEnabled("live_tests")) {
                  alert(features.live_tests?.maintenanceMessage || "Live test feature is temporarily disabled by admin.");
                  return;
                }
                onNavigateTab?.("live_tests");
              }}
              className={`bg-white dark:bg-[#1F2330] p-3 sm:p-4 rounded-xl sm:rounded-2xl border shadow-xs flex flex-col justify-between min-h-[104px] sm:min-h-[116px] text-left transition-all cursor-pointer group ${
                isEnabled("live_tests")
                  ? "border-[#E8D9C0] dark:border-[#31374A] hover:border-[#800020] dark:hover:border-[#F47B20]"
                  : "border-slate-300 dark:border-slate-800 opacity-60"
              }`}
            >
              <div className="flex items-center justify-between w-full">
                <div className="w-8.5 h-8.5 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-[#800020]/10 dark:bg-[#800020]/30 text-[#800020] dark:text-[#F47B20] flex items-center justify-center shrink-0">
                  <Flame className="w-4.5 h-4.5 sm:w-5 sm:h-5" />
                </div>
                <span className={`text-[9px] sm:text-[10px] font-extrabold uppercase tracking-wider ${
                  isEnabled("live_tests") ? "text-[#F47B20]" : "text-slate-400"
                }`}>
                  {isEnabled("live_tests") ? "● LIVE" : "PAUSED"}
                </span>
              </div>
              <div className="mt-2 sm:mt-3">
                <h3 className="text-xs sm:text-sm font-extrabold text-[#171923] dark:text-[#FFF9EF] leading-tight">
                  Live Tests
                </h3>
                <p className="text-[10px] sm:text-[11px] font-medium text-[#52576A] dark:text-[#929AB0] mt-0.5 truncate leading-tight">
                  {isEnabled("live_tests") ? "Real-time tests & rankings" : "Temporarily Closed (Maintenance)"}
                </p>
              </div>
            </motion.button>

            {/* PYQ Vault */}
            <motion.button
              whileTap={{ scale: 0.98 }}
              onClick={() => {
                if (!isEnabled("pyq_vault")) {
                  alert(features.pyq_vault?.maintenanceMessage || "Previous Year Papers (PYQ) feature is temporarily disabled by admin.");
                  return;
                }
                onNavigateTab?.("pyq_vault");
              }}
              className={`bg-white dark:bg-[#1F2330] p-3 sm:p-4 rounded-xl sm:rounded-2xl border shadow-xs flex flex-col justify-between min-h-[104px] sm:min-h-[116px] text-left transition-all cursor-pointer group ${
                isEnabled("pyq_vault")
                  ? "border-[#E8D9C0] dark:border-[#31374A] hover:border-[#800020] dark:hover:border-[#F47B20]"
                  : "border-slate-300 dark:border-slate-800 opacity-60"
              }`}
            >
              <div className="flex items-center justify-between w-full">
                <div className="w-8.5 h-8.5 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-[#C99A45]/15 text-[#946B1E] dark:text-[#E5BC6B] flex items-center justify-center shrink-0">
                  <FileText className="w-4.5 h-4.5 sm:w-5 sm:h-5" />
                </div>
                <span className={`text-[9px] sm:text-[10px] font-extrabold uppercase tracking-wider ${
                  isEnabled("pyq_vault") ? "text-[#946B1E] dark:text-[#C99A45]" : "text-slate-400"
                }`}>
                  {isEnabled("pyq_vault") ? "OFFICIAL" : "PAUSED"}
                </span>
              </div>
              <div className="mt-2 sm:mt-3">
                <h3 className="text-xs sm:text-sm font-extrabold text-[#171923] dark:text-[#FFF9EF] leading-tight">
                  PYQ Vault
                </h3>
                <p className="text-[10px] sm:text-[11px] font-medium text-[#52576A] dark:text-[#929AB0] mt-0.5 truncate leading-tight">
                  {isEnabled("pyq_vault") ? "Previous year papers" : "Temporarily Closed"}
                </p>
              </div>
            </motion.button>

            {/* Custom 20-20 Test */}
            <motion.button
              whileTap={{ scale: 0.98 }}
              onClick={() => {
                if (!isEnabled("custom_test")) {
                  alert(features.custom_test?.maintenanceMessage || "Custom test feature is temporarily disabled by admin.");
                  return;
                }
                setShowCreateTestModal(true);
              }}
              className={`bg-white dark:bg-[#1F2330] p-3 sm:p-4 rounded-xl sm:rounded-2xl border shadow-xs flex flex-col justify-between min-h-[104px] sm:min-h-[116px] text-left transition-all cursor-pointer group ${
                isEnabled("custom_test")
                  ? "border-[#E8D9C0] dark:border-[#31374A] hover:border-[#800020] dark:hover:border-[#F47B20]"
                  : "border-slate-300 dark:border-slate-800 opacity-60"
              }`}
            >
              <div className="flex items-center justify-between w-full">
                <div className="w-8.5 h-8.5 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-[#F47B20]/12 text-[#C85A0A] dark:text-[#F47B20] flex items-center justify-center shrink-0">
                  <Compass className="w-4.5 h-4.5 sm:w-5 sm:h-5" />
                </div>
                <span className={`text-[9px] sm:text-[10px] font-extrabold uppercase tracking-wider ${
                  isEnabled("custom_test") ? "text-[#C85A0A] dark:text-[#F47B20]" : "text-slate-400"
                }`}>
                  {isEnabled("custom_test") ? "20-20 SET" : "PAUSED"}
                </span>
              </div>
              <div className="mt-2 sm:mt-3">
                <h3 className="text-xs sm:text-sm font-extrabold text-[#171923] dark:text-[#FFF9EF] leading-tight">
                  Custom Test
                </h3>
                <p className="text-[10px] sm:text-[11px] font-medium text-[#52576A] dark:text-[#929AB0] mt-0.5 truncate leading-tight">
                  {isEnabled("custom_test") ? "Select subjects & count" : "Temporarily Closed"}
                </p>
              </div>
            </motion.button>

            {/* Weak Areas / Mistake Bank */}
            <motion.button
              whileTap={{ scale: 0.98 }}
              onClick={() => onNavigateTab?.("wrong")}
              className="bg-white dark:bg-[#1F2330] p-3 sm:p-4 rounded-xl sm:rounded-2xl border border-[#E8D9C0] dark:border-[#31374A] hover:border-[#800020] dark:hover:border-[#F47B20] shadow-xs flex flex-col justify-between min-h-[104px] sm:min-h-[116px] text-left transition-all cursor-pointer group"
            >
              <div className="flex items-center justify-between w-full">
                <div className="w-8.5 h-8.5 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-[#15803D]/10 dark:bg-[#22C55E]/15 text-[#15803D] dark:text-[#22C55E] flex items-center justify-center shrink-0">
                  <FileX className="w-4.5 h-4.5 sm:w-5 sm:h-5" />
                </div>
                <span className="text-[9px] sm:text-[10px] font-extrabold uppercase tracking-wider text-[#15803D] dark:text-[#22C55E]">
                  REVISION
                </span>
              </div>
              <div className="mt-2 sm:mt-3">
                <h3 className="text-xs sm:text-sm font-extrabold text-[#171923] dark:text-[#FFF9EF] leading-tight">
                  Mistake Bank
                </h3>
                <p className="text-[10px] sm:text-[11px] font-medium text-[#52576A] dark:text-[#929AB0] mt-0.5 truncate leading-tight">
                  Bookmarks &amp; wrong questions
                </p>
              </div>
            </motion.button>
          </section>
        </div>

        {/* 3.5 SMART PRACTICE & EXAM TOOLS */}
        <section className="space-y-2.5">
          <div className="flex items-center justify-between px-0.5">
            <h2 className="text-xs sm:text-sm font-extrabold text-[#171923] dark:text-[#FFF9EF] flex items-center gap-1.5">
              <Brain className="w-4 h-4 text-[#800020] dark:text-[#F47B20]" />
              <span>Smart Practice &amp; Exam Tools</span>
            </h2>
            <span className="text-[10px] font-bold text-[#C85A0A] dark:text-[#F47B20] uppercase tracking-wider">
              Smart Lab
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-2.5">
            {/* 1v1 Live Battle */}
            <motion.button
              type="button"
              whileTap={{ scale: 0.98 }}
              onClick={() => {
                if (!isEnabled("live_battle")) {
                  alert(features.live_battle?.maintenanceMessage || "1v1 Live Quiz Battle feature is temporarily disabled by admin.");
                  return;
                }
                onOpenLiveBattle?.();
              }}
              className={`w-full bg-white dark:bg-[#1F2330] border rounded-xl sm:rounded-2xl p-3 sm:p-3.5 shadow-xs flex items-center sm:flex-col sm:items-start justify-between text-left transition-all cursor-pointer group select-none ${
                isEnabled("live_battle")
                  ? "border-[#E8D9C0] dark:border-[#31374A] hover:border-[#F47B20]"
                  : "border-slate-300 dark:border-slate-800 opacity-60"
              }`}
            >
              <div className="flex items-center sm:flex-col sm:items-start gap-2.5 min-w-0 flex-1">
                <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center shrink-0 border ${
                  isEnabled("live_battle")
                    ? "bg-[#F47B20]/10 dark:bg-[#F47B20]/25 text-[#C85A0A] dark:text-[#F47B20] border-[#F47B20]/20"
                    : "bg-slate-200 dark:bg-slate-800 text-slate-400 border-slate-300 dark:border-slate-700"
                }`}>
                  <Swords className="w-4.5 h-4.5 sm:w-5 sm:h-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <h3 className="text-xs sm:text-[13px] font-extrabold text-[#171923] dark:text-[#FFF9EF] truncate">
                      1v1 Live Quiz Battle
                    </h3>
                    {!isEnabled("live_battle") && (
                      <span className="text-[9px] px-1.5 py-0.2 rounded bg-rose-100 dark:bg-rose-950 text-rose-600 font-bold">
                        Temporarily Closed
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] sm:text-[10.5px] text-[#52576A] dark:text-[#929AB0] truncate mt-0.5">
                    {isEnabled("live_battle") ? "Real-time match with peers" : (features.live_battle?.maintenanceMessage || "Closed for Maintenance")}
                  </p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-[#52576A] dark:text-[#929AB0] sm:hidden shrink-0" />
            </motion.button>

            {/* AI Weakness Radar */}
            <motion.button
              type="button"
              whileTap={{ scale: 0.98 }}
              onClick={() => onNavigateTab?.("analytics")}
              className="w-full bg-white dark:bg-[#1F2330] border border-[#E8D9C0] dark:border-[#31374A] hover:border-[#800020] rounded-xl sm:rounded-2xl p-3 sm:p-3.5 shadow-xs flex items-center sm:flex-col sm:items-start justify-between text-left transition-all cursor-pointer group select-none"
            >
              <div className="flex items-center sm:flex-col sm:items-start gap-2.5 min-w-0 flex-1">
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-[#800020]/10 dark:bg-[#800020]/25 text-[#800020] dark:text-[#F47B20] border border-[#800020]/20 flex items-center justify-center shrink-0">
                  <Target className="w-4.5 h-4.5 sm:w-5 sm:h-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-xs sm:text-[13px] font-extrabold text-[#171923] dark:text-[#FFF9EF] truncate">
                    AI Diagnosis Radar
                  </h3>
                  <p className="text-[10px] sm:text-[10.5px] text-[#52576A] dark:text-[#929AB0] truncate mt-0.5">
                    Identify &amp; strengthen weak topics
                  </p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-[#52576A] dark:text-[#929AB0] sm:hidden shrink-0" />
            </motion.button>

            {/* Paper Scanner & OMR Analyzer */}
            <motion.button
              type="button"
              whileTap={{ scale: 0.98 }}
              onClick={() => {
                if (!isEnabled("omr_scanner")) {
                  alert(features.omr_scanner?.maintenanceMessage || "Paper & OMR Scanner feature is temporarily disabled by admin.");
                  return;
                }
                onOpenExamAnalyzer?.();
              }}
              className={`w-full bg-white dark:bg-[#1F2330] border rounded-xl sm:rounded-2xl p-3 sm:p-3.5 shadow-xs flex items-center sm:flex-col sm:items-start justify-between text-left transition-all cursor-pointer group select-none ${
                isEnabled("omr_scanner")
                  ? "border-[#E8D9C0] dark:border-[#31374A] hover:border-[#C99A45]"
                  : "border-slate-300 dark:border-slate-800 opacity-60"
              }`}
            >
              <div className="flex items-center sm:flex-col sm:items-start gap-2.5 min-w-0 flex-1">
                <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center shrink-0 border ${
                  isEnabled("omr_scanner")
                    ? "bg-[#C99A45]/15 dark:bg-[#C99A45]/25 text-[#946B1E] dark:text-[#E5BC6B] border-[#C99A45]/25"
                    : "bg-slate-200 dark:bg-slate-800 text-slate-400 border-slate-300 dark:border-slate-700"
                }`}>
                  <Scan className="w-4.5 h-4.5 sm:w-5 sm:h-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <h3 className="text-xs sm:text-[13px] font-extrabold text-[#171923] dark:text-[#FFF9EF] truncate">
                      Paper &amp; OMR Scanner
                    </h3>
                    {!isEnabled("omr_scanner") && (
                      <span className="text-[9px] px-1.5 py-0.2 rounded bg-rose-100 dark:bg-rose-950 text-rose-600 font-bold">
                        Temporarily Closed
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] sm:text-[10.5px] text-[#52576A] dark:text-[#929AB0] truncate mt-0.5">
                    {isEnabled("omr_scanner") ? "Scan question paper or OMR sheet" : (features.omr_scanner?.maintenanceMessage || "Closed for Maintenance")}
                  </p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-[#52576A] dark:text-[#929AB0] sm:hidden shrink-0" />
            </motion.button>
          </div>
        </section>
      </main>

      {/* SIDEBAR / NAVIGATION DRAWER */}
      <AnimatePresence>
        {isMenuOpen && (
          <div className="fixed inset-0 z-[100] flex">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-[#171923]/55 backdrop-blur-[2px]"
              onClick={() => setIsMenuOpen(false)}
            />

            <motion.div
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", damping: 26, stiffness: 220 }}
              className="relative w-[85vw] max-w-[340px] bg-[#FFF9EF] dark:bg-[#171923] h-full flex flex-col shadow-2xl z-10 overflow-hidden border-r border-[#E8D9C0] dark:border-[#31374A]"
            >
              {/* Drawer Header */}
              <div className="relative pt-5 pb-7 px-5 bg-[#800020] text-[#FFF9EF] overflow-hidden">
                <div className="relative z-10">
                  <button
                    onClick={() => setIsMenuOpen(false)}
                    className="absolute -top-1 -right-1 w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors cursor-pointer"
                    aria-label="Close drawer"
                  >
                    <X size={18} />
                  </button>

                  <div className="flex items-center gap-3.5 mt-2">
                    <div className="w-12 h-12 rounded-full border-2 border-[#C99A45]/70 p-0.5 shrink-0">
                      <div className="w-full h-full rounded-full overflow-hidden bg-white/15">
                        <img
                          src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${userName}`}
                          alt="User"
                          className="w-full h-full object-cover"
                        />
                      </div>
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-base font-extrabold truncate leading-none mb-1.5">
                        {userName}
                      </h3>
                      <div className="flex items-center gap-2 text-[10px] font-bold">
                        <span className="px-2 py-0.5 rounded-md bg-white/15 uppercase tracking-wider">
                          {isAuthenticated ? (isAdmin ? "Admin" : "Aspirant") : "Guest"}
                        </span>
                        {isAuthenticated && (
                          <span className="flex items-center gap-1 text-[#F47B20] bg-black/20 px-2 py-0.5 rounded-md">
                            <Flame size={10} />
                            <span>{currentUserProfile?.streakDays || 0}D</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Quick Stats Card */}
              <div className="mx-4 -mt-4 relative z-20 bg-white dark:bg-[#1F2330] rounded-2xl p-3 shadow-md border border-[#E8D9C0] dark:border-[#31374A] flex items-center justify-around">
                <div className="text-center">
                  <span className="text-[9px] font-bold text-[#787D91] dark:text-[#929AB0] uppercase tracking-wider block mb-0.5">
                    Solved
                  </span>
                  <span className="text-xs font-extrabold text-[#171923] dark:text-[#FFF9EF] font-mono tabular-nums">
                    {attemptedCount}
                  </span>
                </div>
                <div className="w-px h-6 bg-[#E8D9C0] dark:bg-[#31374A]" />
                <div className="text-center">
                  <span className="text-[9px] font-bold text-[#787D91] dark:text-[#929AB0] uppercase tracking-wider block mb-0.5">
                    Accuracy
                  </span>
                  <span className="text-xs font-extrabold text-[#800020] dark:text-[#F47B20] font-mono tabular-nums">
                    {accuracy}%
                  </span>
                </div>
                <div className="w-px h-6 bg-[#E8D9C0] dark:bg-[#31374A]" />
                <div className="text-center">
                  <span className="text-[9px] font-bold text-[#787D91] dark:text-[#929AB0] uppercase tracking-wider block mb-0.5">
                    Correct
                  </span>
                  <span className="text-xs font-extrabold text-[#15803D] dark:text-[#22C55E] font-mono tabular-nums">
                    {correctCount}
                  </span>
                </div>
              </div>

              {/* Scrollable Navigation Links */}
              <div className="flex-1 overflow-y-auto px-3.5 py-4 space-y-5 no-scrollbar">
                {/* 1. Core Learning */}
                <div className="space-y-1">
                  <h4 className="text-[10px] font-extrabold text-[#787D91] dark:text-[#929AB0] uppercase tracking-[0.18em] px-2.5 mb-1.5">
                    Core Learning
                  </h4>
                  {[
                    { label: "Dashboard", icon: LayoutDashboard, tab: "home" },
                    { label: "Subjects & Syllabus", icon: BookOpen, tab: "topics" },
                    { label: "Live Tests", icon: Zap, tab: "live_tests" },
                    { label: "PYQ Vault", icon: FileText, tab: "pyq_vault" },
                    { label: "Mistake Bank", icon: RotateCcw, tab: "wrong" },
                  ].map((item) => (
                    <button
                      key={item.label}
                      onClick={() => {
                        onNavigateTab?.(item.tab as ActiveTab);
                        setIsMenuOpen(false);
                      }}
                      className="group w-full min-h-[42px] flex items-center gap-3 px-2.5 py-1.5 rounded-xl hover:bg-white/90 dark:hover:bg-[#1F2330] border border-transparent hover:border-[#E8D9C0]/70 dark:hover:border-[#31374A] hover:shadow-[0_1px_4px_rgba(0,0,0,0.02)] transition-all duration-150 cursor-pointer"
                    >
                      <div className="w-8.5 h-8.5 rounded-[10px] bg-[#800020]/[0.08] dark:bg-[#F47B20]/15 border border-[#800020]/15 dark:border-[#F47B20]/25 text-[#800020] dark:text-[#F47B20] flex items-center justify-center shrink-0 shadow-[0_1px_2px_rgba(0,0,0,0.02)] dark:shadow-none group-hover:scale-105 transition-transform duration-150">
                        <item.icon size={16} strokeWidth={1.8} />
                      </div>
                      <span className="text-[13px] font-semibold text-[#171923] dark:text-[#FFF9EF] tracking-tight group-hover:text-[#800020] dark:group-hover:text-[#F47B20] transition-colors">
                        {item.label}
                      </span>
                      <ChevronRight
                        size={13}
                        strokeWidth={2}
                        className="ml-auto text-[#929AB0]/50 dark:text-[#787D91]/60 group-hover:text-[#800020] dark:group-hover:text-[#F47B20] group-hover:translate-x-0.5 transition-all duration-150"
                      />
                    </button>
                  ))}
                </div>

                {/* 2. Competitive & Interactive */}
                <div className="space-y-1">
                  <h4 className="text-[10px] font-extrabold text-[#787D91] dark:text-[#929AB0] uppercase tracking-[0.18em] px-2.5 mb-1.5">
                    Competitive &amp; Interactive
                  </h4>
                  {[
                    { label: "Live Quiz Battle", icon: Target, action: () => onOpenLiveBattle?.() },
                    { label: "Weekly Leaderboard", icon: Trophy, action: () => setShowLeaderboard(true) },
                  ].map((item) => (
                    <button
                      key={item.label}
                      onClick={() => {
                        if (item.action) {
                          item.action();
                        }
                        setIsMenuOpen(false);
                      }}
                      className="group w-full min-h-[42px] flex items-center gap-3 px-2.5 py-1.5 rounded-xl hover:bg-white/90 dark:hover:bg-[#1F2330] border border-transparent hover:border-[#E8D9C0]/70 dark:hover:border-[#31374A] hover:shadow-[0_1px_4px_rgba(0,0,0,0.02)] transition-all duration-150 cursor-pointer"
                    >
                      <div className="w-8.5 h-8.5 rounded-[10px] bg-[#C99A45]/[0.12] dark:bg-[#C99A45]/20 border border-[#C99A45]/25 dark:border-[#C99A45]/30 text-[#9E6E18] dark:text-[#E5BC6B] flex items-center justify-center shrink-0 shadow-[0_1px_2px_rgba(0,0,0,0.02)] dark:shadow-none group-hover:scale-105 transition-transform duration-150">
                        <item.icon size={16} strokeWidth={1.8} />
                      </div>
                      <span className="text-[13px] font-semibold text-[#171923] dark:text-[#FFF9EF] tracking-tight group-hover:text-[#9E6E18] dark:group-hover:text-[#E5BC6B] transition-colors">
                        {item.label}
                      </span>
                      <ChevronRight
                        size={13}
                        strokeWidth={2}
                        className="ml-auto text-[#929AB0]/50 dark:text-[#787D91]/60 group-hover:text-[#9E6E18] dark:group-hover:text-[#E5BC6B] group-hover:translate-x-0.5 transition-all duration-150"
                      />
                    </button>
                  ))}
                </div>

                {/* 3. Progress & Profile */}
                <div className="space-y-1">
                  <h4 className="text-[10px] font-extrabold text-[#787D91] dark:text-[#929AB0] uppercase tracking-[0.18em] px-2.5 mb-1.5">
                    Progress &amp; Profile
                  </h4>
                  {[
                    { label: "Performance Reports", icon: BarChart3, tab: "analytics" },
                    { label: "My Profile", icon: User, tab: "profile" },
                  ].map((item) => (
                    <button
                      key={item.label}
                      onClick={() => {
                        onNavigateTab?.(item.tab as ActiveTab);
                        setIsMenuOpen(false);
                      }}
                      className="group w-full min-h-[42px] flex items-center gap-3 px-2.5 py-1.5 rounded-xl hover:bg-white/90 dark:hover:bg-[#1F2330] border border-transparent hover:border-[#E8D9C0]/70 dark:hover:border-[#31374A] hover:shadow-[0_1px_4px_rgba(0,0,0,0.02)] transition-all duration-150 cursor-pointer"
                    >
                      <div className="w-8.5 h-8.5 rounded-[10px] bg-[#2563EB]/[0.08] dark:bg-[#3B82F6]/15 border border-[#2563EB]/15 dark:border-[#3B82F6]/25 text-[#2563EB] dark:text-[#60A5FA] flex items-center justify-center shrink-0 shadow-[0_1px_2px_rgba(0,0,0,0.02)] dark:shadow-none group-hover:scale-105 transition-transform duration-150">
                        <item.icon size={16} strokeWidth={1.8} />
                      </div>
                      <span className="text-[13px] font-semibold text-[#171923] dark:text-[#FFF9EF] tracking-tight group-hover:text-[#2563EB] dark:group-hover:text-[#60A5FA] transition-colors">
                        {item.label}
                      </span>
                      <ChevronRight
                        size={13}
                        strokeWidth={2}
                        className="ml-auto text-[#929AB0]/50 dark:text-[#787D91]/60 group-hover:text-[#2563EB] dark:group-hover:text-[#60A5FA] group-hover:translate-x-0.5 transition-all duration-150"
                      />
                    </button>
                  ))}
                </div>

                {/* 4. Resources & Support */}
                <div className="space-y-1">
                  <h4 className="text-[10px] font-extrabold text-[#787D91] dark:text-[#929AB0] uppercase tracking-[0.18em] px-2.5 mb-1.5">
                    Resources &amp; Tools
                  </h4>
                  {[
                    { label: "Paper Scanner / OMR", icon: Scan, action: () => onOpenExamAnalyzer?.() },
                    { label: "AI Engine Settings", icon: Key, action: () => onOpenApiSettings?.() },
                    { label: "Exam News & Guides", icon: Newspaper, tab: "news" },
                    { label: "About DISHA 20-20", icon: Info, tab: "about" },
                    { label: "Help & Support", icon: HelpCircle, tab: "contact" },
                  ].map((item) => (
                    <button
                      key={item.label}
                      onClick={() => {
                        if (item.action) {
                          item.action();
                        } else if (item.tab) {
                          onNavigateTab?.(item.tab as ActiveTab);
                        }
                        setIsMenuOpen(false);
                      }}
                      className="group w-full min-h-[42px] flex items-center gap-3 px-2.5 py-1.5 rounded-xl hover:bg-white/90 dark:hover:bg-[#1F2330] border border-transparent hover:border-[#E8D9C0]/70 dark:hover:border-[#31374A] hover:shadow-[0_1px_4px_rgba(0,0,0,0.02)] transition-all duration-150 cursor-pointer"
                    >
                      <div className="w-8.5 h-8.5 rounded-[10px] bg-[#0D9488]/[0.08] dark:bg-[#14B8A6]/15 border border-[#0D9488]/15 dark:border-[#14B8A6]/25 text-[#0F766E] dark:text-[#2DD4BF] flex items-center justify-center shrink-0 shadow-[0_1px_2px_rgba(0,0,0,0.02)] dark:shadow-none group-hover:scale-105 transition-transform duration-150">
                        <item.icon size={16} strokeWidth={1.8} />
                      </div>
                      <span className="text-[13px] font-semibold text-[#171923] dark:text-[#FFF9EF] tracking-tight group-hover:text-[#0F766E] dark:group-hover:text-[#2DD4BF] transition-colors">
                        {item.label}
                      </span>
                      <ChevronRight
                        size={13}
                        strokeWidth={2}
                        className="ml-auto text-[#929AB0]/50 dark:text-[#787D91]/60 group-hover:text-[#0F766E] dark:group-hover:text-[#2DD4BF] group-hover:translate-x-0.5 transition-all duration-150"
                      />
                    </button>
                  ))}
                </div>

                {/* 5. Admin Management */}
                {isAdmin && (
                  <button
                    onClick={() => {
                      onNavigateTab?.("admin");
                      setIsMenuOpen(false);
                    }}
                    className="group w-full flex items-center gap-3 p-2.5 rounded-xl bg-[#15803D]/10 dark:bg-[#22C55E]/10 border border-[#15803D]/25 text-[#15803D] dark:text-[#22C55E] hover:bg-[#15803D]/15 transition-all cursor-pointer"
                  >
                    <div className="w-8.5 h-8.5 rounded-[10px] bg-[#15803D] text-white flex items-center justify-center shrink-0 shadow-xs group-hover:scale-105 transition-transform duration-150">
                      <ShieldCheck size={16} strokeWidth={1.8} />
                    </div>
                    <div className="text-left">
                      <span className="text-sm font-extrabold block leading-tight">Admin Panel</span>
                      <span className="text-[10px] font-bold opacity-80 uppercase tracking-wider">
                        Content Management
                      </span>
                    </div>
                    <ChevronRight size={13} strokeWidth={2} className="ml-auto opacity-70 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all duration-150" />
                  </button>
                )}
              </div>

              {/* Drawer Footer */}
              <div className="p-4 bg-[#F7EFE2] dark:bg-[#1F2330] border-t border-[#E8D9C0] dark:border-[#31374A] space-y-3">
                <button
                  onClick={() => onToggleDarkMode?.()}
                  className="w-full flex items-center justify-between p-2 rounded-xl hover:bg-white dark:hover:bg-[#252A3A] transition-all cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-white dark:bg-[#171923] text-[#800020] dark:text-[#F47B20] flex items-center justify-center shadow-2xs">
                      {settings.darkMode ? <Moon size={15} /> : <Sun size={15} />}
                    </div>
                    <span className="text-xs font-bold text-[#171923] dark:text-[#FFF9EF]">
                      Display Mode
                    </span>
                  </div>
                  <div
                    className={`w-10 h-5 rounded-full relative p-0.5 transition-colors ${
                      settings.darkMode ? "bg-[#F47B20]" : "bg-[#D5C3A5]"
                    }`}
                  >
                    <div
                      className={`w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${
                        settings.darkMode ? "translate-x-5" : "translate-x-0"
                      }`}
                    />
                  </div>
                </button>

                {!isAuthenticated ? (
                  <button
                    onClick={() => {
                      onOpenLogin?.();
                      setIsMenuOpen(false);
                    }}
                    className="w-full py-3 rounded-xl bg-[#800020] dark:bg-[#F47B20] text-white text-xs font-extrabold uppercase tracking-wider flex items-center justify-center gap-2 active:scale-95 transition-transform cursor-pointer"
                  >
                    <LogIn size={15} />
                    <span>Sign in to DISHA 20-20</span>
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      onLogout?.();
                      setIsMenuOpen(false);
                    }}
                    className="w-full py-3 rounded-xl bg-white dark:bg-[#252A3A] border border-[#E8D9C0] dark:border-[#31374A] text-[#171923] dark:text-[#FFF9EF] text-xs font-extrabold uppercase tracking-wider flex items-center justify-center gap-2 active:scale-95 transition-transform cursor-pointer"
                  >
                    <LogOut size={15} />
                    <span>Sign Out</span>
                  </button>
                )}

                <div className="flex items-center justify-between px-1 text-[10px] font-bold text-[#52576A] dark:text-[#929AB0]">
                  <span>DISHA 20-20</span>
                  <span>Right Direction, Accurate Preparation</span>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <React.Suspense fallback={null}>
        {showCreateTestModal && (
          <CreateTestModal
            isOpen={showCreateTestModal}
            onClose={() => setShowCreateTestModal(false)}
            questions={questions}
            chapters={chapters}
            progressStore={progressStore}
            onStartSession={onStartSession}
          />
        )}

        {shareData && (
          <ShareModal
            isOpen={!!shareData}
            onClose={() => setShareData(null)}
            data={shareData}
          />
        )}
      </React.Suspense>

      {/* FULL WEEKLY LEADERBOARD MODAL */}
      <AnimatePresence>
        {showLeaderboard && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 sm:p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-[#171923]/75 backdrop-blur-xs"
              onClick={() => setShowLeaderboard(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 12 }}
              className="relative w-full max-w-xl bg-[#FFF9EF] dark:bg-[#1F2330] rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] border border-[#E8D9C0] dark:border-[#31374A]"
            >
              <div className="px-6 pt-5 pb-4 border-b border-[#E8D9C0] dark:border-[#31374A] flex items-center justify-between bg-[#FFF9EF] dark:bg-[#1F2330] sticky top-0 z-10">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#C99A45]/15 text-[#946B1E] dark:text-[#E5BC6B] flex items-center justify-center">
                    <Trophy size={20} />
                  </div>
                  <div>
                    <h3 className="text-base font-extrabold text-[#171923] dark:text-[#FFF9EF]">
                      Weekly Rankings
                    </h3>
                    <p className="text-[10.5px] font-bold text-[#52576A] dark:text-[#929AB0] uppercase tracking-wider">
                      DISHA 20-20 Top Aspirants
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowLeaderboard(false)}
                  className="w-10 h-10 rounded-full bg-[#F7EFE2] dark:bg-[#252A3A] flex items-center justify-center text-[#52576A] hover:text-[#171923] dark:text-[#CBD2E1] transition-colors cursor-pointer"
                  aria-label="Close leaderboard"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 sm:p-6">
                <React.Suspense
                  fallback={
                    <div className="py-12 flex justify-center">
                      <div className="w-6 h-6 border-2 border-[#800020] dark:border-[#F47B20] border-t-transparent rounded-full animate-spin" />
                    </div>
                  }
                >
                  <WeeklyLeaderboard
                    userProfile={currentUserProfile}
                    className="border-none shadow-none bg-transparent"
                  />
                </React.Suspense>
              </div>

              <div className="p-4 border-t border-[#E8D9C0] dark:border-[#31374A] bg-white dark:bg-[#171923]">
                <button
                  onClick={() => setShowLeaderboard(false)}
                  className="w-full py-3.5 bg-[#800020] dark:bg-[#F47B20] text-white rounded-xl text-xs font-extrabold uppercase tracking-wider active:scale-95 transition-transform cursor-pointer"
                >
                  Return to Dashboard
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
