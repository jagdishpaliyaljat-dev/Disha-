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
import { CHAPTERS_DATA, ALL_QUESTIONS } from "../data/questions";
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
  Map,
  Swords,
  Crown,
  Sparkles,
} from "lucide-react";
import { BannerSlides } from "./BannerSlides";
import type { ShareData } from "./ShareModal";
import { subscribeToActiveBanners, getLocalBanners } from "../utils/bannerStorage";
import { districtWarService } from "./district-war/districtWarService";
import { DistrictWarScore, UserDistrictAffiliation } from "./district-war/types";
import { triggerHaptic, playClickSound } from "../utils/audioFeedback";

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
  onOpenRajasthanMap?: () => void;
  onOpenLiveBattle?: () => void;
  onOpenDistrictWar?: () => void;
  onToggleDarkMode?: () => void;
  onLogout?: () => void;
}

export const HomeTab: React.FC<HomeTabProps> = ({
  progressStore,
  settings,
  questions = ALL_QUESTIONS,
  chapters = CHAPTERS_DATA,
  userProfile,
  unreadNotificationsCount = 0,
  banners,
  isAuthenticated = false,
  onOpenLogin,
  onOpenNotifications,
  onStartSession,
  onNavigateTab,
  onOpenApiSettings,
  onOpenRajasthanMap,
  onOpenLiveBattle,
  onOpenDistrictWar,
  onToggleDarkMode,
  onLogout,
}) => {
  const [showCreateTestModal, setShowCreateTestModal] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [shareData, setShareData] = useState<ShareData | null>(null);

  // District War Dynamic State
  const [warTopDistricts, setWarTopDistricts] = useState<DistrictWarScore[]>([]);
  const [userWarAffiliation, setUserWarAffiliation] = useState<UserDistrictAffiliation | null>(null);

  const loadWarInfo = () => {
    try {
      setWarTopDistricts(districtWarService.getTopThree("total"));
      setUserWarAffiliation(districtWarService.getUserContribution());
    } catch {}
  };

  useEffect(() => {
    loadWarInfo();
    const handleUpdate = () => loadWarInfo();
    window.addEventListener("disha:district-war-updated", handleUpdate);
    return () => window.removeEventListener("disha:district-war-updated", handleUpdate);
  }, []);

  const userDistrictRank = useMemo(() => {
    if (!userWarAffiliation) return null;
    return districtWarService.getDistrictRank(userWarAffiliation.districtId, "total");
  }, [userWarAffiliation, warTopDistricts]);

  // Banners
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

  // Progress calculations
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
  const userName = currentUserProfile?.name || "विद्यार्थी";
  const isAdmin = isUserAdmin(currentUserProfile);

  return (
    <div
      className="flex flex-col w-full min-h-full bg-[#FFFDF9] dark:bg-[#0F121C] text-[#171923] dark:text-[#FFF9EF] transition-colors duration-200"
      id="home-container"
    >
      {/* ========================================================
          1. STICKY 52px COMPACT PROPORTIONAL HEADER
         ======================================================== */}
      <header className="px-3 sm:px-6 h-[52px] bg-[#FFFDF9]/95 dark:bg-[#0F121C]/95 backdrop-blur-md border-b border-[#E8D9C0]/70 dark:border-stone-800/80 sticky top-0 z-40 select-none w-full flex items-center justify-between">
        {/* Left Brand Identity: Drawer Trigger + Non-wrapping Logo */}
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            onClick={() => {
              triggerHaptic("light");
              playClickSound();
              setIsMenuOpen(true);
            }}
            className="w-9 h-9 rounded-xl bg-stone-100 dark:bg-stone-800/80 hover:bg-stone-200 dark:hover:bg-stone-700 flex items-center justify-center text-[#171923] dark:text-[#FFF9EF] active:scale-95 transition-all cursor-pointer border border-[#E8D9C0]/60 dark:border-stone-700/60"
            aria-label="Open menu drawer"
          >
            <Menu className="w-4.5 h-4.5" />
          </button>
          <div className="flex items-center gap-1.5 whitespace-nowrap select-none">
            <span className="text-[17px] font-black tracking-wider text-[#800020] dark:text-[#F47B20] uppercase font-serif">
              DISHA
            </span>
            <span className="inline-flex items-center justify-center px-1.5 py-0.5 rounded-md bg-gradient-to-r from-[#F47B20] to-[#E06A12] text-white font-black text-[11px] tracking-tight shadow-xs leading-none">
              20-20
            </span>
          </div>
        </div>

        {/* Right Action Bar: Streak Flame + Notification + Dark Mode + Profile */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {isAuthenticated && (
            <div
              className="flex items-center gap-1 px-2 py-1 rounded-lg bg-orange-500/10 dark:bg-orange-500/20 text-[#F47B20] border border-[#F47B20]/30 text-xs font-black"
              title="Daily Study Streak"
            >
              <Flame className="w-3.5 h-3.5 fill-[#F47B20]" />
              <span>{currentUserProfile?.streakDays || 1}D</span>
            </div>
          )}

          <button
            onClick={() => {
              triggerHaptic("light");
              playClickSound();
              onOpenNotifications ? onOpenNotifications() : onNavigateTab?.("notifications");
            }}
            className="relative w-9 h-9 rounded-xl bg-stone-100 dark:bg-stone-800/80 hover:bg-stone-200 dark:hover:bg-stone-700 flex items-center justify-center text-[#171923] dark:text-[#FFF9EF] active:scale-95 transition-all cursor-pointer border border-[#E8D9C0]/60 dark:border-stone-700/60"
            aria-label="Notifications"
          >
            <Bell className="w-4 h-4" />
            {unreadNotificationsCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#F47B20] ring-2 ring-[#FFFDF9] dark:ring-[#0F121C]" />
            )}
          </button>

          <button
            onClick={() => {
              triggerHaptic("light");
              playClickSound();
              onToggleDarkMode?.();
            }}
            className="w-9 h-9 rounded-xl bg-stone-100 dark:bg-stone-800/80 hover:bg-stone-200 dark:hover:bg-stone-700 flex items-center justify-center text-[#171923] dark:text-[#C99A45] active:scale-95 transition-all cursor-pointer border border-[#E8D9C0]/60 dark:border-stone-700/60"
            aria-label={settings.darkMode ? "Switch to Day Mode" : "Switch to Night Mode"}
          >
            {settings.darkMode ? (
              <Sun className="w-4 h-4 text-[#F47B20]" />
            ) : (
              <Moon className="w-4 h-4 text-[#800020]" />
            )}
          </button>

          {!isAuthenticated ? (
            <button
              onClick={() => {
                triggerHaptic("medium");
                playClickSound();
                onOpenLogin?.();
              }}
              className="flex items-center gap-1.5 h-9 px-3 rounded-xl bg-[#800020] hover:bg-[#5E0017] dark:bg-[#F47B20] dark:hover:bg-[#E06A12] text-white text-xs font-black shadow-xs active:scale-95 transition-all cursor-pointer whitespace-nowrap"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>लॉगिन</span>
            </button>
          ) : (
            <button
              onClick={() => {
                triggerHaptic("light");
                playClickSound();
                onNavigateTab?.("profile");
              }}
              className="w-9 h-9 rounded-full ring-2 ring-[#C99A45]/70 hover:ring-[#800020] dark:hover:ring-[#F47B20] flex items-center justify-center overflow-hidden active:scale-95 transition-all cursor-pointer bg-stone-100 dark:bg-stone-800 shrink-0"
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
      </header>

      {/* ========================================================
          MAIN PROPORTIONAL CANVAS (8pt Spatial Grid)
         ======================================================== */}
      <main className="w-full max-w-4xl mx-auto px-3 sm:px-6 pt-3 sm:pt-4 space-y-3 sm:space-y-4 pb-24 select-none">
        
        {/* LAYER 1: ASPIRANT GREETING & DISTRICT PULSE HERO STRIP */}
        <section className="bg-white dark:bg-[#171B26] border border-[#E8D9C0]/80 dark:border-stone-800/90 rounded-2xl p-3 sm:p-3.5 shadow-xs flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-[#800020]/10 dark:bg-[#F47B20]/15 text-[#800020] dark:text-[#F47B20] flex items-center justify-center shrink-0 font-bold text-sm">
              👑
            </div>
            <div className="min-w-0">
              <h1 className="text-sm sm:text-base font-extrabold text-[#171923] dark:text-[#FFF9EF] truncate leading-tight">
                जय राजस्थान, <span className="text-[#800020] dark:text-[#F47B20]">{userName}</span>!
              </h1>
              <p className="text-[11px] text-stone-500 dark:text-stone-400 font-medium truncate mt-0.5">
                आज का 20-20 लक्ष्य पूरा करें • 50 ज़िलों में अपनी धाक जमाएं
              </p>
            </div>
          </div>

          <div className="shrink-0">
            {userWarAffiliation ? (
              <button
                onClick={() => {
                  triggerHaptic("medium");
                  playClickSound();
                  onOpenDistrictWar?.();
                }}
                className="px-2.5 sm:px-3 py-1.5 rounded-xl bg-[#800020]/10 dark:bg-[#800020]/30 hover:bg-[#800020]/15 border border-[#800020]/30 dark:border-[#C99A45]/40 text-[#800020] dark:text-amber-300 flex items-center gap-1.5 text-xs font-black active:scale-95 transition-all cursor-pointer"
              >
                <span>🛡️ {userWarAffiliation.districtNameHindi} सेना</span>
                <span className="px-1.5 py-0.2 rounded-md bg-[#800020] text-white text-[10px] font-bold">
                  #{userDistrictRank || "—"}
                </span>
              </button>
            ) : (
              <button
                onClick={() => {
                  triggerHaptic("medium");
                  playClickSound();
                  onOpenDistrictWar?.();
                }}
                className="px-2.5 sm:px-3 py-1.5 rounded-xl bg-gradient-to-r from-[#F47B20] to-[#E06A12] text-white flex items-center gap-1 text-xs font-black shadow-xs active:scale-95 transition-all cursor-pointer animate-pulse"
              >
                <Swords className="w-3.5 h-3.5" />
                <span>ज़िला सेना चुनें</span>
                <span className="px-1 py-0.2 bg-white/20 rounded text-[9px]">+50</span>
              </button>
            )}
          </div>
        </section>

        {/* LAYER 2: DUAL MARQUEE SHOWCASE (Proportional 2-Column Bento - 2:1 Aspect Ratio) */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-2.5 sm:gap-3 items-stretch">
          
          {/* CARD A: ⚔️ राजस्थान 50 ज़िला महासंग्राम (Live District War) */}
          <div
            onClick={() => {
              triggerHaptic("medium");
              playClickSound();
              onOpenDistrictWar?.();
            }}
            className="w-full bg-gradient-to-br from-[#800020] via-[#5C0318] to-[#991B1B] text-white border border-[#C99A45]/40 rounded-2xl p-3.5 relative overflow-hidden shadow-xs cursor-pointer active:scale-[0.98] transition-all flex flex-col justify-between min-h-[96px] group"
          >
            {/* Ambient Lighting */}
            <div className="absolute top-0 right-0 w-36 h-36 bg-amber-400/20 rounded-full blur-xl pointer-events-none" />

            <div className="flex items-center justify-between w-full relative z-10">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-white/15 border border-white/20 text-amber-300 flex items-center justify-center shrink-0">
                  <Swords className="w-4.5 h-4.5 text-amber-300" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <h2 className="text-xs sm:text-sm font-black tracking-tight text-white truncate">
                      राजस्थान 50 ज़िला महासंग्राम
                    </h2>
                  </div>
                  <p className="text-[10.5px] text-amber-200/90 font-medium truncate mt-0.5">
                    {userWarAffiliation ? (
                      <span>आपकी सेना: <b>{userWarAffiliation.districtNameHindi}</b> (रैंक #{userDistrictRank})</span>
                    ) : (
                      <span>50 ज़िलों के छात्र अपने ज़िले के लिए लड़ रहे हैं</span>
                    )}
                  </p>
                </div>
              </div>

              <span className="px-1.5 py-0.5 rounded-md bg-red-500 text-white text-[9px] font-black uppercase tracking-wider flex items-center gap-1 shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-white inline-block animate-ping" />
                LIVE WAR
              </span>
            </div>

            <div className="flex items-center justify-between pt-2.5 mt-2 border-t border-white/15 relative z-10 text-[11px]">
              <span className="text-amber-100 font-bold truncate">
                🥇 #1 {warTopDistricts[0]?.nameHindi || "सीकर"} • 🥈 #2 {warTopDistricts[1]?.nameHindi || "जोधपुर"} • 🥉 #3 {warTopDistricts[2]?.nameHindi || "जयपुर"}
              </span>
              <span className="text-amber-300 font-extrabold flex items-center gap-0.5 shrink-0 pl-1 group-hover:translate-x-0.5 transition-transform">
                वॉर रूम <ChevronRight className="w-3.5 h-3.5" />
              </span>
            </div>
          </div>

          {/* CARD B: 🗺️ राजस्थान नया 50-ज़िला नक्शा (Atlas & 3D Map Quiz) */}
          <div
            onClick={() => {
              triggerHaptic("medium");
              playClickSound();
              onOpenRajasthanMap?.();
            }}
            className="w-full bg-gradient-to-br from-[#1E293B] via-[#0F172A] to-[#800020] text-white border border-[#C99A45]/40 rounded-2xl p-3.5 relative overflow-hidden shadow-xs cursor-pointer active:scale-[0.98] transition-all flex flex-col justify-between min-h-[96px] group"
          >
            {/* Ambient Lighting */}
            <div className="absolute top-0 right-0 w-36 h-36 bg-emerald-400/15 rounded-full blur-xl pointer-events-none" />

            <div className="flex items-center justify-between w-full relative z-10">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-white/15 border border-white/20 text-emerald-300 flex items-center justify-center shrink-0">
                  <Map className="w-4.5 h-4.5 text-emerald-300" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <h2 className="text-xs sm:text-sm font-black tracking-tight text-white truncate">
                      राजस्थान नया नक्शा व 3D क्विज़
                    </h2>
                  </div>
                  <p className="text-[10.5px] text-stone-300 font-medium truncate mt-0.5">
                    50 ज़िला दर्शन • 10 संभाग • 2026 नया भूगोल बदलाव
                  </p>
                </div>
              </div>

              <span className="px-1.5 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 text-[9px] font-black uppercase tracking-wider shrink-0">
                नया भूगोल 2026
              </span>
            </div>

            <div className="flex items-center justify-between pt-2.5 mt-2 border-t border-white/15 relative z-10 text-[11px]">
              <span className="text-stone-300 font-bold truncate">
                🎯 इंटरएक्टिव नक्शा क्विज़ व ज़िला दर्शन
              </span>
              <span className="text-emerald-300 font-extrabold flex items-center gap-0.5 shrink-0 pl-1 group-hover:translate-x-0.5 transition-transform">
                नक्शा खोलें <ChevronRight className="w-3.5 h-3.5" />
              </span>
            </div>
          </div>
        </section>

        {/* LAYER 3: 4-CORE PRACTICE MATRIX (Uniform 1:1 Symmetrical Bento Grid) */}
        <section className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-2.5">
          {/* Pillar 1: ⚔️ 1v1 Live Quiz Battle */}
          <button
            onClick={() => {
              triggerHaptic("medium");
              playClickSound();
              onOpenLiveBattle?.();
            }}
            className="bg-white dark:bg-[#171B26] p-3 rounded-2xl border border-[#E8D9C0]/80 dark:border-stone-800 hover:border-[#800020] dark:hover:border-[#F47B20] shadow-xs flex flex-col justify-between min-h-[92px] text-left transition-all active:scale-[0.97] cursor-pointer group"
          >
            <div className="flex items-center justify-between w-full">
              <div className="w-8.5 h-8.5 rounded-xl bg-purple-500/10 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
                <Swords className="w-4 h-4" />
              </div>
              <span className="text-[9px] font-black uppercase tracking-wider text-purple-600 dark:text-purple-400 bg-purple-500/10 px-1.5 py-0.2 rounded-md">
                ⚡ LIVE
              </span>
            </div>
            <div className="mt-2">
              <h3 className="text-xs sm:text-sm font-extrabold text-[#171923] dark:text-[#FFF9EF] leading-tight group-hover:text-[#800020] dark:group-hover:text-[#F47B20] transition-colors">
                1v1 बैटल
              </h3>
              <p className="text-[10px] text-stone-500 dark:text-stone-400 font-medium truncate mt-0.5">
                दोस्तों संग मुकाबला
              </p>
            </div>
          </button>

          {/* Pillar 2: 🔥 Live Mock Tests */}
          <button
            onClick={() => {
              triggerHaptic("medium");
              playClickSound();
              onNavigateTab?.("live_tests");
            }}
            className="bg-white dark:bg-[#171B26] p-3 rounded-2xl border border-[#E8D9C0]/80 dark:border-stone-800 hover:border-[#800020] dark:hover:border-[#F47B20] shadow-xs flex flex-col justify-between min-h-[92px] text-left transition-all active:scale-[0.97] cursor-pointer group"
          >
            <div className="flex items-center justify-between w-full">
              <div className="w-8.5 h-8.5 rounded-xl bg-orange-500/10 dark:bg-orange-500/20 text-[#F47B20] flex items-center justify-center shrink-0">
                <Flame className="w-4 h-4" />
              </div>
              <span className="text-[9px] font-black uppercase tracking-wider text-[#F47B20] bg-orange-500/10 px-1.5 py-0.2 rounded-md">
                🏆 RANK
              </span>
            </div>
            <div className="mt-2">
              <h3 className="text-xs sm:text-sm font-extrabold text-[#171923] dark:text-[#FFF9EF] leading-tight group-hover:text-[#800020] dark:group-hover:text-[#F47B20] transition-colors">
                लाइव टेस्ट
              </h3>
              <p className="text-[10px] text-stone-500 dark:text-stone-400 font-medium truncate mt-0.5">
                ऑल राजस्थान रैंक
              </p>
            </div>
          </button>

          {/* Pillar 3: 📚 PYQ Vault */}
          <button
            onClick={() => {
              triggerHaptic("medium");
              playClickSound();
              onNavigateTab?.("pyq_vault");
            }}
            className="bg-white dark:bg-[#171B26] p-3 rounded-2xl border border-[#E8D9C0]/80 dark:border-stone-800 hover:border-[#800020] dark:hover:border-[#F47B20] shadow-xs flex flex-col justify-between min-h-[92px] text-left transition-all active:scale-[0.97] cursor-pointer group"
          >
            <div className="flex items-center justify-between w-full">
              <div className="w-8.5 h-8.5 rounded-xl bg-amber-500/10 dark:bg-amber-500/20 text-[#946B1E] dark:text-amber-400 flex items-center justify-center shrink-0">
                <FileText className="w-4 h-4" />
              </div>
              <span className="text-[9px] font-black uppercase tracking-wider text-[#946B1E] dark:text-amber-400 bg-amber-500/10 px-1.5 py-0.2 rounded-md">
                20-20
              </span>
            </div>
            <div className="mt-2">
              <h3 className="text-xs sm:text-sm font-extrabold text-[#171923] dark:text-[#FFF9EF] leading-tight group-hover:text-[#800020] dark:group-hover:text-[#F47B20] transition-colors">
                PYQ वॉल्ट
              </h3>
              <p className="text-[10px] text-stone-500 dark:text-stone-400 font-medium truncate mt-0.5">
                गत वर्ष प्रश्न पत्र
              </p>
            </div>
          </button>

          {/* Pillar 4: 🎯 AI Mistake Bank */}
          <button
            onClick={() => {
              triggerHaptic("medium");
              playClickSound();
              onNavigateTab?.("wrong");
            }}
            className="bg-white dark:bg-[#171B26] p-3 rounded-2xl border border-[#E8D9C0]/80 dark:border-stone-800 hover:border-[#800020] dark:hover:border-[#F47B20] shadow-xs flex flex-col justify-between min-h-[92px] text-left transition-all active:scale-[0.97] cursor-pointer group"
          >
            <div className="flex items-center justify-between w-full">
              <div className="w-8.5 h-8.5 rounded-xl bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                <Target className="w-4 h-4" />
              </div>
              <span className="text-[9px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.2 rounded-md">
                AI FIX
              </span>
            </div>
            <div className="mt-2">
              <h3 className="text-xs sm:text-sm font-extrabold text-[#171923] dark:text-[#FFF9EF] leading-tight group-hover:text-[#800020] dark:group-hover:text-[#F47B20] transition-colors">
                मिस्टेक बैंक
              </h3>
              <p className="text-[10px] text-stone-500 dark:text-stone-400 font-medium truncate mt-0.5">
                गलत प्रश्न रिवीज़न
              </p>
            </div>
          </button>
        </section>

        {/* LAYER 4: AI RADAR & SMART STUDY ADVISOR STRIP */}
        <section>
          <div
            onClick={() => {
              triggerHaptic("medium");
              playClickSound();
              onNavigateTab?.("analytics");
            }}
            className="w-full bg-gradient-to-r from-white via-[#FFF9EF] to-white dark:from-[#171B26] dark:via-[#1F2330] dark:to-[#171B26] border border-[#C99A45]/40 dark:border-amber-400/30 rounded-2xl p-3 sm:p-3.5 flex items-center justify-between shadow-xs cursor-pointer active:scale-[0.99] transition-all group"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#800020] to-[#F47B20] text-white flex items-center justify-center shrink-0 shadow-xs">
                <Target className="w-4.5 h-4.5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs sm:text-sm font-extrabold text-[#171923] dark:text-[#FFF9EF] truncate">
                    छात्र AI रिपोर्ट कार्ड व कमजोरी रडार
                  </span>
                  <span className="px-1.5 py-0.2 rounded-md bg-[#F47B20] text-white text-[9px] font-black uppercase">
                    AI Insights
                  </span>
                </div>
                <p className="text-[10.5px] text-stone-500 dark:text-stone-400 font-medium truncate mt-0.5">
                  नेगेटिव मार्किंग एनालिसिस, कमजोरी विषय व 1-क्लिक बूस्टर टेस्ट
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1 text-[#800020] dark:text-amber-300 text-xs font-black shrink-0 pl-2 group-hover:translate-x-0.5 transition-transform">
              <span className="hidden sm:inline">रिपोर्ट देखें</span>
              <ChevronRight className="w-4 h-4" />
            </div>
          </div>
        </section>

        {/* LAYER 5: PROPORTIONAL PREPARATION METRICS & 20-20 CUSTOM TEST */}
        <section className="bg-white dark:bg-[#171B26] rounded-2xl p-3 sm:p-4 border border-[#E8D9C0]/80 dark:border-stone-800 shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Metrics 3-Pack */}
          <div className="grid grid-cols-3 gap-2 flex-1">
            <div className="text-center p-2 rounded-xl bg-stone-50 dark:bg-stone-800/50 border border-stone-200/50 dark:border-stone-700/50">
              <span className="text-[9.5px] font-bold text-stone-500 dark:text-stone-400 uppercase tracking-wider block mb-0.5">
                कुल हल
              </span>
              <span className="text-base sm:text-lg font-black text-[#171923] dark:text-[#FFF9EF] font-mono tabular-nums">
                {attemptedCount}
              </span>
            </div>
            <div className="text-center p-2 rounded-xl bg-stone-50 dark:bg-stone-800/50 border border-stone-200/50 dark:border-stone-700/50">
              <span className="text-[9.5px] font-bold text-stone-500 dark:text-stone-400 uppercase tracking-wider block mb-0.5">
                एक्यूरेसी
              </span>
              <span className="text-base sm:text-lg font-black text-[#800020] dark:text-[#F47B20] font-mono tabular-nums">
                {accuracy}%
              </span>
            </div>
            <div className="text-center p-2 rounded-xl bg-stone-50 dark:bg-stone-800/50 border border-stone-200/50 dark:border-stone-700/50">
              <span className="text-[9.5px] font-bold text-stone-500 dark:text-stone-400 uppercase tracking-wider block mb-0.5">
                सही उत्तर
              </span>
              <span className="text-base sm:text-lg font-black text-[#15803D] dark:text-[#22C55E] font-mono tabular-nums">
                {correctCount}
              </span>
            </div>
          </div>

          {/* Quick Custom Test CTA */}
          <button
            onClick={() => {
              triggerHaptic("medium");
              playClickSound();
              setShowCreateTestModal(true);
            }}
            className="sm:w-auto py-2.5 px-4 rounded-xl bg-[#800020]/10 dark:bg-[#F47B20]/15 hover:bg-[#800020]/20 dark:hover:bg-[#F47B20]/25 border border-[#800020]/25 dark:border-[#F47B20]/30 text-[#800020] dark:text-[#F47B20] text-xs font-black flex items-center justify-center gap-1.5 active:scale-95 transition-all cursor-pointer whitespace-nowrap"
          >
            <Compass className="w-4 h-4" />
            <span>🎯 20-20 कस्टम टेस्ट बनाएं</span>
          </button>
        </section>

        {/* LAYER 6: SLIM BANNER CAROUSEL */}
        <section>
          <BannerSlides banners={activeBanners} onNavigateTab={onNavigateTab} />
        </section>

        {/* LAYER 7: COMPACT AI ENGINE SETUP CARD */}
        <section>
          <button
            type="button"
            onClick={() => {
              triggerHaptic("light");
              playClickSound();
              onOpenApiSettings?.();
            }}
            aria-label="Open AI API Key Settings"
            className="w-full bg-white dark:bg-[#171B26] hover:bg-stone-50 dark:hover:bg-stone-800/50 border border-[#E8D9C0]/80 dark:border-stone-800 rounded-2xl p-3 shadow-xs flex items-center justify-between text-left transition-all cursor-pointer"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-[#946B1E] dark:text-amber-400 flex items-center justify-center shrink-0">
                <Key className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <h4 className="text-xs font-extrabold text-[#171923] dark:text-[#FFF9EF] truncate">
                  AI इंजन सेटिंग्स ({settings.aiMode === "personal_keys" ? "Personal Keys" : "Platform AI"})
                </h4>
                <p className="text-[10px] text-stone-500 dark:text-stone-400 truncate mt-0.5">
                  Gemini API और व्यक्तिगत कीज़ कॉन्फ़िगर करें
                </p>
              </div>
            </div>
            <div className="w-7 h-7 rounded-lg bg-stone-100 dark:bg-stone-800 flex items-center justify-center text-stone-500 dark:text-stone-400 shrink-0">
              <Settings className="w-3.5 h-3.5" />
            </div>
          </button>
        </section>

      </main>

      {/* ========================================================
          SIDEBAR / NAVIGATION DRAWER
         ======================================================== */}
      <AnimatePresence>
        {isMenuOpen && (
          <div className="fixed inset-0 z-[100] flex">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-[#171923]/70 backdrop-blur-xs cursor-pointer"
              onClick={() => setIsMenuOpen(false)}
            />

            <motion.div
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", damping: 26, stiffness: 220 }}
              className="relative w-[85vw] max-w-[340px] bg-[#FFFDF9] dark:bg-[#0F121C] h-full flex flex-col shadow-2xl z-10 overflow-hidden border-r border-[#E8D9C0]/80 dark:border-stone-800"
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
                            <span>{currentUserProfile?.streakDays || 1}D</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Quick Stats Card in Drawer */}
              <div className="mx-4 -mt-4 relative z-20 bg-white dark:bg-[#171B26] rounded-2xl p-3 shadow-md border border-[#E8D9C0]/80 dark:border-stone-800 flex items-center justify-around">
                <div className="text-center">
                  <span className="text-[9px] font-bold text-stone-500 dark:text-stone-400 uppercase tracking-wider block mb-0.5">
                    कुल हल
                  </span>
                  <span className="text-xs font-extrabold text-[#171923] dark:text-[#FFF9EF] font-mono tabular-nums">
                    {attemptedCount}
                  </span>
                </div>
                <div className="w-px h-6 bg-stone-200 dark:bg-stone-800" />
                <div className="text-center">
                  <span className="text-[9px] font-bold text-stone-500 dark:text-stone-400 uppercase tracking-wider block mb-0.5">
                    एक्यूरेसी
                  </span>
                  <span className="text-xs font-extrabold text-[#800020] dark:text-[#F47B20] font-mono tabular-nums">
                    {accuracy}%
                  </span>
                </div>
                <div className="w-px h-6 bg-stone-200 dark:bg-stone-800" />
                <div className="text-center">
                  <span className="text-[9px] font-bold text-stone-500 dark:text-stone-400 uppercase tracking-wider block mb-0.5">
                    सही उत्तर
                  </span>
                  <span className="text-xs font-extrabold text-[#15803D] dark:text-[#22C55E] font-mono tabular-nums">
                    {correctCount}
                  </span>
                </div>
              </div>

              {/* Scrollable Navigation Links */}
              <div className="flex-1 overflow-y-auto px-4 py-5 space-y-5 no-scrollbar">
                <div className="space-y-1">
                  <h4 className="text-[10px] font-extrabold text-stone-400 uppercase tracking-[0.2em] px-2 mb-2">
                    Learning Hub
                  </h4>
                  {[
                    { label: "डैशबोर्ड", icon: Home, tab: "home" },
                    { label: "⚔️ राजस्थान 50 ज़िला महासंग्राम", icon: Swords, action: () => onOpenDistrictWar?.() },
                    { label: "🗺️ राजस्थान 50 ज़िला नक्शा व क्विज़", icon: Map, action: () => onOpenRajasthanMap?.() },
                    { label: "⚔️ 1v1 लाइव क्विज़ मुकाबला", icon: Swords, action: () => onOpenLiveBattle?.() },
                    { label: "विषय व सिलेबस", icon: BookOpen, tab: "topics" },
                    { label: "साप्ताहिक लीडरबोर्ड", icon: Trophy, action: () => setShowLeaderboard(true) },
                    { label: "लाइव मॉक टेस्ट", icon: Zap, tab: "live_tests" },
                    { label: "PYQ वॉल्ट (गत वर्ष पेपर)", icon: FileText, tab: "pyq_vault" },
                  ].map((item) => (
                    <button
                      key={item.label}
                      onClick={() => {
                        triggerHaptic("light");
                        playClickSound();
                        if (item.action) {
                          item.action();
                        } else if (item.tab) {
                          onNavigateTab?.(item.tab as ActiveTab);
                        }
                        setIsMenuOpen(false);
                      }}
                      className="w-full min-h-[44px] flex items-center gap-3 p-2 rounded-xl hover:bg-stone-100 dark:hover:bg-stone-800/60 transition-colors group cursor-pointer"
                    >
                      <div className="w-8.5 h-8.5 rounded-xl bg-[#800020]/10 dark:bg-[#F47B20]/15 text-[#800020] dark:text-[#F47B20] flex items-center justify-center shrink-0">
                        <item.icon size={16} />
                      </div>
                      <span className="text-sm font-bold text-[#171923] dark:text-[#FFF9EF]">
                        {item.label}
                      </span>
                      <ChevronRight
                        size={14}
                        className="ml-auto text-stone-400 group-hover:translate-x-0.5 transition-transform"
                      />
                    </button>
                  ))}
                </div>

                <div className="space-y-1">
                  <h4 className="text-[10px] font-extrabold text-stone-400 uppercase tracking-[0.2em] px-2 mb-2">
                    Prep &amp; Updates
                  </h4>
                  {[
                    { label: "AI परफॉर्मेंस रिपोर्ट", icon: BarChart2, tab: "analytics" },
                    { label: "परीक्षा समाचार व गाइड्स", icon: Newspaper, tab: "news" },
                    { label: "दिशा 20-20 परिचय", icon: Info, tab: "about" },
                    { label: "हेल्प व सपोर्ट", icon: Info, tab: "contact" },
                  ].map((item) => (
                    <button
                      key={item.label}
                      onClick={() => {
                        triggerHaptic("light");
                        playClickSound();
                        onNavigateTab?.(item.tab as ActiveTab);
                        setIsMenuOpen(false);
                      }}
                      className="w-full min-h-[44px] flex items-center gap-3 p-2 rounded-xl hover:bg-stone-100 dark:hover:bg-stone-800/60 transition-colors group cursor-pointer"
                    >
                      <div className="w-8.5 h-8.5 rounded-xl bg-amber-500/10 text-[#946B1E] dark:text-amber-400 flex items-center justify-center shrink-0">
                        <item.icon size={16} />
                      </div>
                      <span className="text-sm font-bold text-[#171923] dark:text-[#FFF9EF]">
                        {item.label}
                      </span>
                      <ChevronRight
                        size={14}
                        className="ml-auto text-stone-400 group-hover:translate-x-0.5 transition-transform"
                      />
                    </button>
                  ))}
                </div>

                {isAdmin && (
                  <button
                    onClick={() => {
                      triggerHaptic("medium");
                      playClickSound();
                      onNavigateTab?.("admin");
                      setIsMenuOpen(false);
                    }}
                    className="w-full flex items-center gap-3 p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-700 dark:text-emerald-400 transition-all cursor-pointer"
                  >
                    <div className="w-8.5 h-8.5 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
                      <ShieldCheck size={16} />
                    </div>
                    <div className="text-left">
                      <span className="text-sm font-extrabold block">एडमिन पैनल</span>
                      <span className="text-[10px] font-bold opacity-80 uppercase tracking-wider">
                        Content Management
                      </span>
                    </div>
                    <ChevronRight size={14} className="ml-auto" />
                  </button>
                )}
              </div>

              {/* Drawer Footer */}
              <div className="p-4 bg-stone-100 dark:bg-[#171B26] border-t border-stone-200 dark:border-stone-800 space-y-3">
                <button
                  onClick={() => {
                    triggerHaptic("light");
                    playClickSound();
                    onToggleDarkMode?.();
                  }}
                  className="w-full flex items-center justify-between p-2 rounded-xl hover:bg-white dark:hover:bg-stone-800 transition-all cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-white dark:bg-[#0F121C] text-[#800020] dark:text-[#F47B20] flex items-center justify-center shadow-2xs">
                      {settings.darkMode ? <Moon size={15} /> : <Sun size={15} />}
                    </div>
                    <span className="text-xs font-bold text-[#171923] dark:text-[#FFF9EF]">
                      डिस्प्ले मोड
                    </span>
                  </div>
                  <div
                    className={`w-10 h-5 rounded-full relative p-0.5 transition-colors ${
                      settings.darkMode ? "bg-[#F47B20]" : "bg-stone-300"
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
                      triggerHaptic("medium");
                      playClickSound();
                      onOpenLogin?.();
                      setIsMenuOpen(false);
                    }}
                    className="w-full py-3 rounded-xl bg-[#800020] dark:bg-[#F47B20] text-white text-xs font-extrabold uppercase tracking-wider flex items-center justify-center gap-2 active:scale-95 transition-transform cursor-pointer"
                  >
                    <LogIn size={15} />
                    <span>दिशा 20-20 में लॉगिन करें</span>
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      triggerHaptic("medium");
                      playClickSound();
                      onLogout?.();
                      setIsMenuOpen(false);
                    }}
                    className="w-full py-3 rounded-xl bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-[#171923] dark:text-[#FFF9EF] text-xs font-extrabold uppercase tracking-wider flex items-center justify-center gap-2 active:scale-95 transition-transform cursor-pointer"
                  >
                    <LogOut size={15} />
                    <span>लॉग आउट</span>
                  </button>
                )}

                <div className="flex items-center justify-between px-1 text-[10px] font-bold text-stone-500 dark:text-stone-400">
                  <span>DISHA 20-20</span>
                  <span>सही दिशा, सटीक तैयारी</span>
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
              className="fixed inset-0 bg-[#0F121C]/75 backdrop-blur-xs cursor-pointer"
              onClick={() => setShowLeaderboard(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 12 }}
              className="relative w-full max-w-xl bg-[#FFFDF9] dark:bg-[#171B26] rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] border border-[#E8D9C0] dark:border-stone-800"
            >
              <div className="px-6 pt-5 pb-4 border-b border-[#E8D9C0] dark:border-stone-800 flex items-center justify-between bg-[#FFFDF9] dark:bg-[#171B26] sticky top-0 z-10">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                    <Trophy size={20} />
                  </div>
                  <div>
                    <h3 className="text-base font-extrabold text-[#171923] dark:text-[#FFF9EF]">
                      साप्ताहिक लीडरबोर्ड
                    </h3>
                    <p className="text-[10.5px] font-bold text-stone-500 dark:text-stone-400 uppercase tracking-wider">
                      DISHA 20-20 Top Aspirants
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowLeaderboard(false)}
                  className="w-10 h-10 rounded-full bg-stone-100 dark:bg-stone-800 flex items-center justify-center text-stone-500 hover:text-stone-800 dark:text-stone-400 transition-colors cursor-pointer"
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

              <div className="p-4 border-t border-[#E8D9C0] dark:border-stone-800 bg-white dark:bg-[#0F121C]">
                <button
                  onClick={() => setShowLeaderboard(false)}
                  className="w-full py-3.5 bg-[#800020] dark:bg-[#F47B20] text-white rounded-xl text-xs font-extrabold uppercase tracking-wider active:scale-95 transition-transform cursor-pointer"
                >
                  डैशबोर्ड पर लौटें
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
