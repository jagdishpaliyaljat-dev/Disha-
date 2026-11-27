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
  Crown,
  Sparkles,
} from "lucide-react";
import { BannerSlides } from "./BannerSlides";
import { AppLogo } from "./AppLogo";
import { UserAvatar } from "./ui/UserAvatar";
import type { ShareData } from "./ShareModal";
import { subscribeToActiveBanners, getLocalBanners } from "../utils/bannerStorage";
import { showAppToast } from "../utils/adminToast";

const CreateTestModal = React.lazy(() => import("./CreateTestModal"));
const ShareModal = React.lazy(() => import("./ShareModal"));

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
  onOpenPremium?: () => void;
  onOpenMenu?: () => void;
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
  onOpenPremium,
  onStartSession,
  onSelectSubject,
  onShowAddSubject,
  onNavigateTab,
  onOpenExamAnalyzer,
  onOpenApiSettings,
  onOpenLiveBattle,
  onToggleDarkMode,
  onLogout,
  onOpenMenu,
}) => {
  const [showCreateTestModal, setShowCreateTestModal] = useState(false);
  const [shareData, setShareData] = useState<ShareData | null>(null);

  const handleOpenMenu = () => {
    if (onOpenMenu) {
      onOpenMenu();
    } else if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("disha_open_student_drawer"));
    }
  };

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
      className="flex flex-col w-full min-h-full bg-[#F8FAFC] dark:bg-[#130E26] text-slate-900 dark:text-slate-50"
      id="home-container"
    >
      {/* 1. OPTIMIZED COMPACT BRAND HEADER (Mobile: safe-area separated from inner bar) */}
      <header className="sticky top-0 z-40 bg-white/95 dark:bg-[#130E26]/95 backdrop-blur-md border-b border-slate-200 dark:border-[#31275E] select-none md:hidden w-full max-w-full overflow-hidden shadow-xs transition-colors pt-[env(safe-area-inset-top,0px)] pr-[env(safe-area-inset-right,0px)] pl-[env(safe-area-inset-left,0px)]">
        <div className="min-h-[64px] px-3.5 sm:px-5 max-w-5xl mx-auto flex items-center justify-between gap-2.5">
          {/* Left Brand Identity: Drawer Trigger + App Name (Icon removed per user request) */}
          <div className="flex items-center gap-2 min-w-0 shrink-0">
            <button
              type="button"
              onClick={handleOpenMenu}
              className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-[#241D48] hover:bg-slate-200/80 dark:hover:bg-[#31275E] flex items-center justify-center text-slate-900 dark:text-slate-50 active:scale-95 transition-all shrink-0 cursor-pointer border border-slate-200 dark:border-[#31275E] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7045D8]"
              aria-label="Open menu drawer"
            >
              <Menu className="w-5 h-5" />
            </button>
            <AppLogo size="sm" variant="horizontal" showIcon={false} showTagline={false} />
          </div>

          {/* Right Action Icons: Notification, Theme, Compact Sign In / Avatar */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={onOpenNotifications || (() => onNavigateTab?.("notifications"))}
              className="relative w-10 h-10 rounded-xl bg-slate-100 dark:bg-[#241D48] hover:bg-slate-200/80 dark:hover:bg-[#31275E] flex items-center justify-center text-slate-900 dark:text-slate-50 active:scale-95 transition-all cursor-pointer border border-slate-200 dark:border-[#31275E] shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7045D8]"
              aria-label="Notifications"
            >
              <Bell className="w-4.5 h-4.5" />
              {unreadNotificationsCount > 0 && (
                <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-[#7045D8] dark:bg-[#A78BFA] ring-2 ring-white dark:ring-[#171329]" />
              )}
            </button>

            <button
              type="button"
              onClick={onToggleDarkMode}
              className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-[#241D48] hover:bg-slate-200/80 dark:hover:bg-[#31275E] flex items-center justify-center text-slate-900 dark:text-[#A78BFA] active:scale-95 transition-all cursor-pointer border border-slate-200 dark:border-[#31275E] shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7045D8]"
              aria-label={!settings.darkMode ? "Light Mode" : !settings.amoledBlack ? "Charcoal Dark" : "AMOLED Black"}
              title={!settings.darkMode ? "Light Mode (Tap for Charcoal Dark)" : !settings.amoledBlack ? "Charcoal Dark (Tap for AMOLED Black)" : "AMOLED Black (Tap for Light)"}
            >
              {!settings.darkMode ? (
                <Moon className="w-4.5 h-4.5 text-[#7045D8]" />
              ) : settings.amoledBlack ? (
                <Sparkles className="w-4.5 h-4.5 text-amber-400" />
              ) : (
                <Sun className="w-4.5 h-4.5 text-amber-400" />
              )}
            </button>

            {!isAuthenticated ? (
              <button
                type="button"
                onClick={onOpenLogin}
                className="flex items-center gap-1.5 min-h-[40px] px-3 py-1.5 rounded-xl bg-[#7045D8] hover:bg-[#5B32BF] text-white text-xs font-black shadow-xs transition-all active:scale-95 cursor-pointer shrink-0 whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7045D8]"
                aria-label="Login to Disha PYQ"
              >
                <LogIn className="w-3.5 h-3.5 shrink-0" />
                <span>Sign In</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => onNavigateTab?.("profile")}
                className="w-10 h-10 rounded-full ring-2 ring-[#7045D8]/40 hover:ring-[#7045D8] flex items-center justify-center overflow-hidden active:scale-95 transition-all cursor-pointer bg-slate-100 dark:bg-[#241D48] shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7045D8]"
                aria-label="User Profile"
              >
                <UserAvatar
                  name={userName}
                  photoURL={currentUserProfile?.photoURL}
                  sizeClassName="w-full h-full"
                />
              </button>
            )}
          </div>
        </div>
      </header>

      {/* MAIN CONTENT CANVAS */}
      <main className="w-full max-w-5xl mx-auto px-3 sm:px-6 pt-3 sm:pt-4 space-y-3.5 sm:space-y-4 pb-28 md:pb-8 select-none">
        {/* Screen-reader and search crawler semantic H1 (visually hidden from app UI) */}
        <div className="sr-only">
          <h1 className="text-sm sm:text-base font-black text-slate-900 dark:text-slate-50 tracking-tight font-hindi flex items-center gap-2">
            <span>दिशा 20-20 — राजस्थान प्रतियोगी परीक्षाएं एवं PYQ अभ्यास</span>
          </h1>
          <p className="text-[11px] sm:text-xs text-slate-600 dark:text-slate-300 font-hindi mt-0.5">
            RPSC RAS, REET, CET, Patwar, Police SI पिछले वर्षों के प्रश्न (PYQs), व्याख्यात्मक हल एवं लाइव टेस्ट सीरीज़।
          </p>
        </div>

        {/* 2. PROMINENT BANNER CAROUSEL */}
        <BannerSlides banners={activeBanners} onNavigateTab={onNavigateTab} />

        {/* 3. TOP SUMMARY & QUICK 2x2 ACTION MATRIX (Responsive 1-col mobile, 12-col desktop) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 sm:gap-4 items-stretch">
          {/* Performance Summary Card */}
          <section className="lg:col-span-5 bg-white dark:bg-[#1B1536] rounded-2xl p-3.5 sm:p-4 border border-slate-200 dark:border-[#31275E] shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2.5 sm:mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-[#7045D8]/10 dark:bg-[#A78BFA]/15 text-[#7045D8] dark:text-[#A78BFA] flex items-center justify-center shrink-0">
                    <BarChart2 className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-slate-50 leading-tight">
                      Preparation Overview
                    </h2>
                    <p className="text-[11px] text-slate-600 dark:text-slate-300">
                      Daily practice and accuracy score
                    </p>
                  </div>
                </div>
                <span className="text-[11px] font-extrabold text-[#7045D8] dark:text-[#A78BFA] uppercase tracking-wider">
                  {accuracy >= 70 ? "Strong" : accuracy >= 40 ? "On Track" : "Building"}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="text-center p-2.5 rounded-xl bg-slate-50 dark:bg-[#130E26] border border-slate-200/80 dark:border-[#31275E]">
                  <p className="text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-0.5">
                    Attempted
                  </p>
                  <p className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-slate-50 font-mono tabular-nums">
                    {attemptedCount}
                  </p>
                </div>
                <div className="text-center p-2.5 rounded-xl bg-slate-50 dark:bg-[#130E26] border border-slate-200/80 dark:border-[#31275E]">
                  <p className="text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-0.5">
                    Accuracy
                  </p>
                  <p className="text-base sm:text-lg font-extrabold text-[#7045D8] dark:text-[#A78BFA] font-mono tabular-nums">
                    {accuracy}%
                  </p>
                </div>
                <div className="text-center p-2.5 rounded-xl bg-slate-50 dark:bg-[#130E26] border border-slate-200/80 dark:border-[#31275E]">
                  <p className="text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-0.5">
                    Correct
                  </p>
                  <p className="text-base sm:text-lg font-extrabold text-emerald-600 dark:text-emerald-400 font-mono tabular-nums">
                    {correctCount}
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* 4-Card Core Practice Grid */}
          <section className="lg:col-span-7 grid grid-cols-2 gap-2.5 sm:gap-3">
            {/* Live Mock Tests */}
            <motion.button
              type="button"
              whileTap={{ scale: 0.98 }}
              onClick={() => {
                if (!isEnabled("live_tests")) {
                  showAppToast(features.live_tests?.maintenanceMessage || "Live test feature is temporarily disabled by admin.", "info", "Temporarily Closed");
                  return;
                }
                onNavigateTab?.("live_tests");
              }}
              className={`bg-white dark:bg-[#1B1536] p-3.5 sm:p-4 rounded-2xl border shadow-xs flex flex-col justify-between min-h-[108px] sm:min-h-[118px] text-left transition-all cursor-pointer group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7045D8] ${
                isEnabled("live_tests")
                  ? "border-slate-200 dark:border-[#31275E] hover:border-[#7045D8] dark:hover:border-[#A78BFA]"
                  : "border-slate-300 dark:border-slate-800 opacity-60"
              }`}
            >
              <div className="flex items-center justify-between w-full">
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-[#7045D8]/10 dark:bg-[#7045D8]/25 text-[#7045D8] dark:text-[#A78BFA] flex items-center justify-center shrink-0">
                  <Flame className="w-4.5 h-4.5 sm:w-5 sm:h-5" />
                </div>
                <span className={`text-[11px] font-extrabold uppercase tracking-wider ${
                  isEnabled("live_tests") ? "text-emerald-600 dark:text-emerald-400" : "text-slate-400"
                }`}>
                  {isEnabled("live_tests") ? "LIVE" : "PAUSED"}
                </span>
              </div>
              <div className="mt-2 sm:mt-3">
                <h3 className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-slate-50 leading-tight">
                  Live Tests
                </h3>
                <p className="text-[11px] font-medium text-slate-600 dark:text-slate-300 mt-0.5 truncate leading-tight">
                  {isEnabled("live_tests") ? "Real-time tests & rankings" : "Temporarily Closed"}
                </p>
              </div>
            </motion.button>

            {/* PYQ Vault */}
            <motion.button
              type="button"
              whileTap={{ scale: 0.98 }}
              onClick={() => {
                if (!isEnabled("pyq_vault")) {
                  showAppToast(features.pyq_vault?.maintenanceMessage || "Previous Year Papers (PYQ) feature is temporarily disabled by admin.", "info", "Temporarily Closed");
                  return;
                }
                onNavigateTab?.("pyq_vault");
              }}
              className={`bg-white dark:bg-[#1B1536] p-3.5 sm:p-4 rounded-2xl border shadow-xs flex flex-col justify-between min-h-[108px] sm:min-h-[118px] text-left transition-all cursor-pointer group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7045D8] ${
                isEnabled("pyq_vault")
                  ? "border-slate-200 dark:border-[#31275E] hover:border-[#7045D8] dark:hover:border-[#A78BFA]"
                  : "border-slate-300 dark:border-slate-800 opacity-60"
              }`}
            >
              <div className="flex items-center justify-between w-full">
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-amber-500/12 text-amber-700 dark:text-amber-400 flex items-center justify-center shrink-0">
                  <FileText className="w-4.5 h-4.5 sm:w-5 sm:h-5" />
                </div>
                <span className={`text-[11px] font-extrabold uppercase tracking-wider ${
                  isEnabled("pyq_vault") ? "text-amber-700 dark:text-amber-400" : "text-slate-400"
                }`}>
                  {isEnabled("pyq_vault") ? "OFFICIAL" : "PAUSED"}
                </span>
              </div>
              <div className="mt-2 sm:mt-3">
                <h3 className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-slate-50 leading-tight">
                  PYQ Vault
                </h3>
                <p className="text-[11px] font-medium text-slate-600 dark:text-slate-300 mt-0.5 truncate leading-tight">
                  {isEnabled("pyq_vault") ? "Previous year papers" : "Temporarily Closed"}
                </p>
              </div>
            </motion.button>

            {/* Custom 20-20 Test */}
            <motion.button
              type="button"
              whileTap={{ scale: 0.98 }}
              onClick={() => {
                if (!isEnabled("custom_test")) {
                  showAppToast(features.custom_test?.maintenanceMessage || "Custom test feature is temporarily disabled by admin.", "info", "Temporarily Closed");
                  return;
                }
                setShowCreateTestModal(true);
              }}
              className={`bg-white dark:bg-[#1B1536] p-3.5 sm:p-4 rounded-2xl border shadow-xs flex flex-col justify-between min-h-[108px] sm:min-h-[118px] text-left transition-all cursor-pointer group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7045D8] ${
                isEnabled("custom_test")
                  ? "border-slate-200 dark:border-[#31275E] hover:border-[#7045D8] dark:hover:border-[#A78BFA]"
                  : "border-slate-300 dark:border-slate-800 opacity-60"
              }`}
            >
              <div className="flex items-center justify-between w-full">
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-[#7045D8]/10 dark:bg-[#7045D8]/20 text-[#7045D8] dark:text-[#A78BFA] flex items-center justify-center shrink-0">
                  <Compass className="w-4.5 h-4.5 sm:w-5 sm:h-5" />
                </div>
                <span className={`text-[11px] font-extrabold uppercase tracking-wider ${
                  isEnabled("custom_test") ? "text-[#7045D8] dark:text-[#A78BFA]" : "text-slate-400"
                }`}>
                  {isEnabled("custom_test") ? "PYQ SET" : "PAUSED"}
                </span>
              </div>
              <div className="mt-2 sm:mt-3">
                <h3 className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-slate-50 leading-tight">
                  Custom Test
                </h3>
                <p className="text-[11px] font-medium text-slate-600 dark:text-slate-300 mt-0.5 truncate leading-tight">
                  {isEnabled("custom_test") ? "Select subjects & count" : "Temporarily Closed"}
                </p>
              </div>
            </motion.button>

            {/* Weak Areas / Mistake Bank */}
            <motion.button
              type="button"
              whileTap={{ scale: 0.98 }}
              onClick={() => onNavigateTab?.("wrong")}
              className="bg-white dark:bg-[#1B1536] p-3.5 sm:p-4 rounded-2xl border border-slate-200 dark:border-[#31275E] hover:border-[#7045D8] dark:hover:border-[#A78BFA] shadow-xs flex flex-col justify-between min-h-[108px] sm:min-h-[118px] text-left transition-all cursor-pointer group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7045D8]"
            >
              <div className="flex items-center justify-between w-full">
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-emerald-500/12 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                  <FileX className="w-4.5 h-4.5 sm:w-5 sm:h-5" />
                </div>
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                  REVISION
                </span>
              </div>
              <div className="mt-2 sm:mt-3">
                <h3 className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-slate-50 leading-tight">
                  Mistake Bank
                </h3>
                <p className="text-[11px] font-medium text-slate-600 dark:text-slate-300 mt-0.5 truncate leading-tight">
                  Bookmarks &amp; wrong questions
                </p>
              </div>
            </motion.button>
          </section>
        </div>

        {/* 3.5 SMART PRACTICE & EXAM TOOLS */}
        <section className="space-y-2.5">
          <div className="flex items-center justify-between px-0.5">
            <h2 className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-slate-50 flex items-center gap-1.5">
              <Brain className="w-4 h-4 text-[#7045D8] dark:text-[#A78BFA]" />
              <span>Smart Practice &amp; Exam Tools</span>
            </h2>
            <span className="text-[11px] font-bold text-[#7045D8] dark:text-[#A78BFA] uppercase tracking-wider">
              Smart Lab
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {/* 1v1 Live Battle */}
            <motion.button
              type="button"
              whileTap={{ scale: 0.98 }}
              onClick={() => {
                if (!isEnabled("live_battle")) {
                  showAppToast(features.live_battle?.maintenanceMessage || "1v1 Live Quiz Battle feature is temporarily disabled by admin.", "info", "Temporarily Closed");
                  return;
                }
                onOpenLiveBattle?.();
              }}
              className={`w-full min-h-[56px] bg-white dark:bg-[#1B1536] border rounded-2xl p-3.5 shadow-xs flex items-center sm:flex-col sm:items-start justify-between text-left transition-all cursor-pointer group select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7045D8] ${
                isEnabled("live_battle")
                  ? "border-slate-200 dark:border-[#31275E] hover:border-[#7045D8] dark:hover:border-[#A78BFA]"
                  : "border-slate-300 dark:border-slate-800 opacity-60"
              }`}
            >
              <div className="flex items-center sm:flex-col sm:items-start gap-2.5 min-w-0 flex-1">
                <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center shrink-0 border ${
                  isEnabled("live_battle")
                    ? "bg-[#7045D8]/10 dark:bg-[#7045D8]/25 text-[#7045D8] dark:text-[#A78BFA] border-[#7045D8]/20"
                    : "bg-slate-200 dark:bg-slate-800 text-slate-400 border-slate-300 dark:border-slate-700"
                }`}>
                  <Swords className="w-4.5 h-4.5 sm:w-5 sm:h-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <h3 className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-slate-50 truncate">
                      1v1 Live Quiz Battle
                    </h3>
                    {!isEnabled("live_battle") && (
                      <span className="text-[11px] px-1.5 py-0.5 rounded bg-rose-100 dark:bg-rose-950 text-rose-600 font-bold">
                        Closed
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-300 truncate mt-0.5">
                    {isEnabled("live_battle") ? "Real-time match with peers" : (features.live_battle?.maintenanceMessage || "Closed for Maintenance")}
                  </p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-500 dark:text-slate-400 sm:hidden shrink-0" />
            </motion.button>

            {/* AI Weakness Radar */}
            <motion.button
              type="button"
              whileTap={{ scale: 0.98 }}
              onClick={() => onNavigateTab?.("analytics")}
              className="w-full min-h-[56px] bg-white dark:bg-[#1B1536] border border-slate-200 dark:border-[#31275E] hover:border-[#7045D8] dark:hover:border-[#A78BFA] rounded-2xl p-3.5 shadow-xs flex items-center sm:flex-col sm:items-start justify-between text-left transition-all cursor-pointer group select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7045D8]"
            >
              <div className="flex items-center sm:flex-col sm:items-start gap-2.5 min-w-0 flex-1">
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-rose-500/10 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/20 flex items-center justify-center shrink-0">
                  <Target className="w-4.5 h-4.5 sm:w-5 sm:h-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-slate-50 truncate">
                    AI Diagnosis Radar
                  </h3>
                  <p className="text-[11px] text-slate-600 dark:text-slate-300 truncate mt-0.5">
                    Identify &amp; strengthen weak topics
                  </p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-500 dark:text-slate-400 sm:hidden shrink-0" />
            </motion.button>

            {/* Paper Scanner & OMR Analyzer */}
            <motion.button
              type="button"
              whileTap={{ scale: 0.98 }}
              onClick={() => {
                if (!isEnabled("omr_scanner")) {
                  showAppToast(features.omr_scanner?.maintenanceMessage || "Paper & OMR Scanner feature is temporarily disabled by admin.", "info", "Temporarily Closed");
                  return;
                }
                onOpenExamAnalyzer?.();
              }}
              className={`w-full min-h-[56px] bg-white dark:bg-[#1B1536] border rounded-2xl p-3.5 shadow-xs flex items-center sm:flex-col sm:items-start justify-between text-left transition-all cursor-pointer group select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7045D8] ${
                isEnabled("omr_scanner")
                  ? "border-slate-200 dark:border-[#31275E] hover:border-[#7045D8] dark:hover:border-[#A78BFA]"
                  : "border-slate-300 dark:border-slate-800 opacity-60"
              }`}
            >
              <div className="flex items-center sm:flex-col sm:items-start gap-2.5 min-w-0 flex-1">
                <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center shrink-0 border ${
                  isEnabled("omr_scanner")
                    ? "bg-amber-500/12 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400 border-amber-500/25"
                    : "bg-slate-200 dark:bg-slate-800 text-slate-400 border-slate-300 dark:border-slate-700"
                }`}>
                  <Scan className="w-4.5 h-4.5 sm:w-5 sm:h-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <h3 className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-slate-50 truncate">
                      Paper &amp; OMR Scanner
                    </h3>
                    {!isEnabled("omr_scanner") && (
                      <span className="text-[11px] px-1.5 py-0.5 rounded bg-rose-100 dark:bg-rose-950 text-rose-600 font-bold">
                        Closed
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-300 truncate mt-0.5">
                    {isEnabled("omr_scanner") ? "Scan question paper or OMR sheet" : (features.omr_scanner?.maintenanceMessage || "Closed for Maintenance")}
                  </p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-500 dark:text-slate-400 sm:hidden shrink-0" />
            </motion.button>
          </div>
        </section>
      </main>

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
    </div>
  );
};
