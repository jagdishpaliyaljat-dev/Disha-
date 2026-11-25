import React, { useMemo, useState, useEffect } from "react";
import { clearIndexedDB } from "../utils/indexedDbCache";
import { safeClearLocalStorage, safeClearSessionStorage } from "../utils/safeStorage";
import {
  ProgressStore,
  AppSettings,
  Question,
  ActiveTab,
  UserProfile,
} from "../types";
import { loadUserProfile, DEFAULT_USER_PROFILE, saveUserProfile, isUserAdmin } from "../utils/userProfileStorage";
import { triggerHaptic } from "../utils/audioFeedback";
import {
  User,
  Settings,
  RotateCcw,
  Info,
  ChevronRight,
  Mail,
  Send,
  Check,
  X,
  Edit2,
  AlertCircle,
  LogOut,
  LogIn,
  Share2,
  RefreshCw,
  Shield,
  Sparkles,
  Sun,
  Moon,
  Target,
  CheckCircle2,
  Award,
  Zap,
  Crown,
  ArrowLeft,
  Eye,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import ShareModal, { ShareData } from "./ShareModal";
import { ApiSettingsModal } from "./ApiSettingsModal";
import { AppSettingsModal } from "./AppSettingsModal";
import { AppLogo } from "./AppLogo";
import { UserAvatar } from "./ui/UserAvatar";

interface ProfileTabProps {
  user?: UserProfile | null;
  isAuthenticated?: boolean;
  onOpenLogin?: () => void;
  progressStore: ProgressStore;
  settings: AppSettings;
  questions?: Question[];
  onUpdateSettings: (newSettings: Partial<AppSettings>) => void;
  onUpdateProfile?: (profile: UserProfile) => void;
  onResetProgress: () => void;
  onNavigateTab?: (tab: ActiveTab) => void;
  onLogout?: () => void;
  onOpenPremium?: () => void;
}

const POPULAR_TARGET_EXAMS = [
  "RPSC RAS (Prelims & Mains)",
  "RPSC Sub Inspector (SI)",
  "RSMSSB CET (Graduate / 12th)",
  "REET (Level 1 & 2)",
  "Rajasthan Patwar",
  "RPSC 1st & 2nd Grade Teacher",
  "RPSC Assistant Professor",
  "Rajasthan Police Constable",
];

export const ProfileTab: React.FC<ProfileTabProps> = ({
  user,
  isAuthenticated = false,
  onOpenLogin,
  progressStore = {},
  settings,
  questions = [],
  onUpdateSettings,
  onUpdateProfile = () => {},
  onResetProgress,
  onNavigateTab,
  onLogout,
  onOpenPremium,
}) => {
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resetConfirmText, setResetConfirmText] = useState("");
  const [showCacheResetConfirm, setShowCacheResetConfirm] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showApiSettingsModal, setShowApiSettingsModal] = useState(false);
  const [showAboutModal, setShowAboutModal] = useState(false);
  const [showEditProfileModal, setShowEditProfileModal] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [shareData, setShareData] = useState<ShareData | null>(null);

  const [activeProfile, setActiveProfile] = useState<UserProfile>(user || DEFAULT_USER_PROFILE);

  useEffect(() => {
    if (user) {
      setActiveProfile(user);
    } else {
      const local = loadUserProfile();
      if (local) setActiveProfile(local);
    }
  }, [user]);

  const [editName, setEditName] = useState("");
  const [editTargetExam, setEditTargetExam] = useState("");
  const [editDailyGoal, setEditDailyGoal] = useState<number>(30);

  useEffect(() => {
    if (activeProfile) {
      setEditName(activeProfile.name || "");
      setEditTargetExam(activeProfile.targetExam || "RPSC RAS Pre");
      setEditDailyGoal(activeProfile.dailyGoalQuestions || settings.dailyGoal || 30);
    }
  }, [activeProfile, settings.dailyGoal]);

  const userName = !isAuthenticated 
    ? "Guest Aspirant" 
    : (activeProfile?.name && activeProfile.name !== "Student" && activeProfile.name !== "Guest Aspirant" ? activeProfile.name : (activeProfile?.email?.split('@')[0] || "Aspirant"));
  const isAdmin = isUserAdmin(activeProfile);

  // ─────────────────────────────────────────────────────────────
  // ANALYTICS & COMPUTED METRICS
  // ─────────────────────────────────────────────────────────────
  const progressValues = useMemo(() => Object.values(progressStore), [progressStore]);

  const attemptedCount = useMemo(() => {
    if (questions.length > 0) {
      return questions.filter((q) => progressStore[q.id] && progressStore[q.id].status !== "unattempted").length;
    }
    return progressValues.filter((p) => p.status !== "unattempted").length;
  }, [questions, progressStore, progressValues]);

  const dailyGoal = activeProfile?.dailyGoalQuestions || settings.dailyGoal || 30;

  // Level & XP System (Gamification)
  const currentLevel = Math.max(1, Math.floor(attemptedCount / 25) + 1);
  const questionsInCurrentLevel = attemptedCount % 25;
  const remainingForNextLevel = 25 - questionsInCurrentLevel;
  const levelProgressPercent = Math.min(100, Math.round((questionsInCurrentLevel / 25) * 100));

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  const handleShareInvite = () => {
    triggerHaptic("light");
    setShareData({
      title: "Disha PYQ — Competitive Exam Preparation & Previous Year Questions",
      text: `Hello! I am preparing for ${activeProfile.targetExam || "Rajasthan & National Competitive Exams"} on Disha PYQ. It features authentic PYQs, chapter-wise practice, and live mock tests with Option E. Join now:`,
      url: typeof window !== "undefined" ? window.location.origin : "https://disha2020.in",
      category: "Study Group Invite",
    });
  };

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    const updated: UserProfile = {
      ...activeProfile,
      name: editName.trim() || "Aspirant",
      targetExam: editTargetExam.trim() || "RPSC RAS Pre",
      dailyGoalQuestions: Number(editDailyGoal) || 30,
    };
    setActiveProfile(updated);
    saveUserProfile(updated);
    onUpdateProfile?.(updated);
    onUpdateSettings({ dailyGoal: Number(editDailyGoal) || 30 });
    setShowEditProfileModal(false);
    showToast("Profile successfully updated!");
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.05,
        delayChildren: 0.05,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 12 },
    show: { opacity: 1, y: 0 },
  };

  return (
    <div
      className="flex flex-col h-full bg-[#F8FAFC] dark:bg-[#130E26] overflow-y-auto pb-28 md:pb-8 selection:bg-[#7045D8] selection:text-white"
      id="profile-tab"
    >
      {/* 1. COMPACT STICKY PROFILE HEADER */}
      <header className="sticky top-0 md:top-14 z-30 bg-white/95 dark:bg-[#130E26]/95 backdrop-blur-md border-b border-slate-200 dark:border-[#31275E] select-none w-full max-w-full overflow-hidden shadow-xs transition-colors pt-[env(safe-area-inset-top,0px)] md:pt-0">
        <div className="min-h-[64px] px-3.5 sm:px-5 py-2 max-w-4xl mx-auto flex items-center justify-between gap-2">
          {/* Left: Back Navigation + Title */}
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <button
              type="button"
              onClick={() => {
                triggerHaptic("light");
                if (typeof onNavigateTab === "function") {
                  onNavigateTab("home");
                } else if (typeof window !== "undefined" && window.history.length > 1) {
                  window.history.back();
                }
              }}
              className="md:hidden w-11 h-11 rounded-xl bg-slate-100 dark:bg-[#241D48] hover:bg-slate-200/80 dark:hover:bg-[#31275E] border border-slate-200 dark:border-[#31275E] flex items-center justify-center text-slate-900 dark:text-slate-50 active:scale-95 transition-all cursor-pointer shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7045D8]"
              aria-label="Back to Home"
              title="Back"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="min-w-0">
              <h1 className="text-base sm:text-lg font-black tracking-tight text-slate-900 dark:text-slate-50 leading-tight truncate">
                Profile &amp; Settings
              </h1>
              <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-none mt-0.5 truncate">
                Account information and preferences
              </p>
            </div>
          </div>

          {/* Right: Eye Comfort + Theme Toggle + Settings Modal Button */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <button
              type="button"
              onClick={() => {
                triggerHaptic("light");
                onUpdateSettings({ eyeComfort: !settings.eyeComfort });
              }}
              className={`w-11 h-11 rounded-xl border flex items-center justify-center active:scale-95 transition-all cursor-pointer shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7045D8] ${
                settings.eyeComfort
                  ? "bg-amber-500/20 border-amber-500 text-amber-500 shadow-xs"
                  : "bg-slate-100 dark:bg-[#241D48] hover:bg-slate-200/80 dark:hover:bg-[#31275E] border-slate-200 dark:border-[#31275E] text-slate-600 dark:text-slate-300"
              }`}
              aria-label="Toggle Eye Comfort"
              title={settings.eyeComfort ? "Eye Comfort On (Tap to Turn Off)" : "Eye Comfort Off (Tap to Turn On)"}
            >
              <Eye className="w-4.5 h-4.5" />
            </button>
            <button
              type="button"
              onClick={() => {
                triggerHaptic("light");
                if (!settings.darkMode) {
                  onUpdateSettings({ darkMode: true, amoledBlack: false });
                } else if (!settings.amoledBlack) {
                  onUpdateSettings({ darkMode: true, amoledBlack: true });
                } else {
                  onUpdateSettings({ darkMode: false, amoledBlack: false });
                }
              }}
              className="w-11 h-11 rounded-xl bg-slate-100 dark:bg-[#241D48] hover:bg-slate-200/80 dark:hover:bg-[#31275E] border border-slate-200 dark:border-[#31275E] flex items-center justify-center text-slate-900 dark:text-[#A78BFA] active:scale-95 transition-all cursor-pointer shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7045D8]"
              aria-label="Toggle Theme"
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
            <button
              type="button"
              onClick={() => {
                triggerHaptic("light");
                setShowSettingsModal(true);
              }}
              className="w-11 h-11 rounded-xl bg-slate-100 dark:bg-[#241D48] hover:bg-slate-200/80 dark:hover:bg-[#31275E] border border-slate-200 dark:border-[#31275E] flex items-center justify-center text-[#7045D8] dark:text-[#A78BFA] active:scale-95 transition-all cursor-pointer shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7045D8]"
              aria-label="App Settings"
              title="App Settings"
            >
              <Settings className="w-4.5 h-4.5" />
            </button>
          </div>
        </div>
      </header>

      {/* ─────────────────────────────────────────────────────────────
          2. MAIN PROFILE BODY & SETTINGS
      ───────────────────────────────────────────────────────────── */}
      <motion.main
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="px-3 sm:px-6 pt-3 space-y-4 max-w-4xl mx-auto w-full"
      >
        {/* Aspirant Hero Card (20% More Compact) */}
        <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col sm:flex-row items-center sm:items-start gap-3 sm:gap-4.5 bg-gradient-to-b from-[#F8FAFC] to-white dark:from-[#130E26] dark:to-[#1B1536] p-3 sm:p-4 rounded-2xl border border-slate-200 dark:border-[#31275E] shadow-xs relative overflow-hidden"
          >
            {/* Royal Corner Accent */}
            <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-bl from-[#A78BFA]/15 to-transparent rounded-bl-full pointer-events-none" />

            {/* Avatar with Triple-Hue Royal Ring */}
            <div className="relative shrink-0">
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl p-0.5 sm:p-1 bg-gradient-to-tr from-[#7045D8] via-[#7045D8] to-[#A78BFA] shadow-sm">
                <div className="w-full h-full rounded-[14px] sm:rounded-[18px] border border-white dark:border-[#1B1536] overflow-hidden bg-[#F8FAFC] dark:bg-[#130E26] flex items-center justify-center">
                  <UserAvatar
                    name={userName}
                    photoURL={activeProfile?.photoURL}
                    sizeClassName="w-full h-full"
                  />
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (!isAuthenticated) {
                    onOpenLogin?.();
                    return;
                  }
                  triggerHaptic("light");
                  setShowEditProfileModal(true);
                }}
                className="absolute -bottom-1.5 -right-1.5 w-9 h-9 rounded-xl bg-[#7045D8] hover:bg-[#5B32BF] text-white flex items-center justify-center shadow-sm border-2 border-white dark:border-[#1B1536] active:scale-90 transition-transform cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7045D8]"
                aria-label="Edit Profile"
                title="Edit Profile"
              >
                <Edit2 size={14} />
              </button>
            </div>

            {/* Aspirant Details */}
            <div className="flex-1 text-center sm:text-left min-w-0 space-y-1.5">
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-1.5">
                {isAdmin ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gradient-to-r from-[#A78BFA]/20 to-[#A78BFA]/30 text-[#7045D8] dark:text-[#A78BFA] border border-[#A78BFA]/40 text-[11px] font-black uppercase tracking-wider">
                    <Crown size={10} className="text-amber-500" />
                    <span>Admin</span>
                  </span>
                ) : !isAuthenticated ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20 text-[11px] font-black uppercase tracking-wider">
                    <Award size={10} />
                    <span>Guest Mode</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#7045D8]/10 dark:bg-[#7045D8]/15 text-[#7045D8] dark:text-[#A78BFA] border border-[#7045D8]/20 dark:border-[#A78BFA]/30 text-[11px] font-black uppercase tracking-wider">
                    <Award size={10} />
                    <span>Aspirant</span>
                  </span>
                )}
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-[#241D48] text-slate-700 dark:text-slate-200 text-[11px] font-black border border-slate-200 dark:border-[#31275E]">
                  <Zap size={9} className="text-amber-500" />
                  <span>LVL {currentLevel}</span>
                </span>
              </div>

              <div>
                <h2 className="text-base sm:text-xl font-black text-slate-900 dark:text-slate-50 tracking-tight truncate leading-tight">
                  {userName}
                </h2>
                {activeProfile?.email && (
                  <div className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 dark:text-slate-200/70 mt-0.5">
                    <Mail size={10} />
                    <span className="truncate">{activeProfile.email}</span>
                    <CheckCircle2 size={10} className="text-emerald-500 shrink-0" />
                  </div>
                )}
              </div>

              {/* Target Exam Badge */}
              <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-white dark:bg-[#241D48] border border-slate-200 dark:border-[#31275E] text-[11px] font-black text-[#7045D8] dark:text-[#A78BFA] shadow-2xs">
                <Target size={11} className="text-[#7045D8]" />
                <span className="truncate">{activeProfile?.targetExam || "RPSC RAS Pre & Competitive Exams"}</span>
              </div>

              {/* Level & XP Progress Bar */}
              <div className="pt-0.5 max-w-xs mx-auto sm:mx-0">
                <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 dark:text-slate-200/80 mb-0.5">
                  <span>Level {currentLevel}</span>
                  <span className="font-mono">{remainingForNextLevel} Qs to Next Level</span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-slate-200/60 dark:bg-[#31275E] overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-[#7045D8] via-[#7045D8] to-[#A78BFA] transition-all duration-500"
                    style={{ width: `${levelProgressPercent}%` }}
                  />
                </div>
              </div>

              {/* CTA Buttons */}
              <div className="pt-0.5 flex flex-wrap items-center justify-center sm:justify-start gap-1.5">
                {!isAuthenticated ? (
                  <button
                    onClick={onOpenLogin}
                    className="px-3.5 py-1.5 bg-gradient-to-r from-[#7045D8] via-[#5B32BF] to-[#7045D8] hover:opacity-95 text-white rounded-lg sm:rounded-xl text-[11px] font-black shadow-sm border border-[#A78BFA]/30 transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer"
                  >
                    <LogIn size={11} />
                    <span>Sign In</span>
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      triggerHaptic("light");
                      setShowEditProfileModal(true);
                    }}
                    className="px-3 py-1 bg-[#F8FAFC] dark:bg-[#241D48] hover:border-[#7045D8] dark:hover:border-[#A78BFA] text-slate-900 dark:text-slate-50 border border-slate-200 dark:border-[#31275E] rounded-lg sm:rounded-xl text-[11px] font-black transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer shadow-2xs"
                  >
                    <Edit2 size={11} className="text-[#7045D8] dark:text-[#A78BFA]" />
                    <span>Edit Profile</span>
                  </button>
                )}
              </div>
            </div>
          </motion.div>


        {!isAuthenticated && (
          <motion.div
            variants={itemVariants}
            className="p-4 rounded-2xl bg-gradient-to-r from-[#F8FAFC] via-white to-slate-100 dark:from-[#241D48] dark:to-[#1B1536] border-2 border-[#7045D8]/30 dark:border-[#A78BFA]/40 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#7045D8]/10 dark:bg-[#7045D8]/20 flex items-center justify-center text-[#7045D8] dark:text-[#A78BFA] shrink-0">
                <LogIn size={20} />
              </div>
              <div>
                <h3 className="font-black text-sm text-slate-900 dark:text-slate-50">
                  You are in Guest Mode
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-200/80 mt-0.5">
                  Sign in with your Google account to synchronize your exam progress, scores, and bookmarks.
                </p>
              </div>
            </div>
            <button
              onClick={() => {
                triggerHaptic("medium");
                onOpenLogin?.();
              }}
              className="w-full sm:w-auto px-4 py-2 bg-gradient-to-r from-[#7045D8] to-[#5B32BF] hover:opacity-95 text-white rounded-xl text-xs font-black shadow-sm active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer shrink-0"
            >
              <LogIn size={13} />
              <span>Sign In</span>
            </button>
          </motion.div>
        )}
        {isAdmin && (
          <motion.div
            variants={itemVariants}
            className="p-4 rounded-3xl bg-gradient-to-r from-[#7045D8] via-[#5B32BF] to-[#7045D8] text-white shadow-md border border-[#A78BFA]/40 flex items-center justify-between gap-3"
          >
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="w-11 h-11 rounded-2xl bg-[#A78BFA]/20 flex items-center justify-center text-amber-500 shrink-0 border border-[#A78BFA]/40 shadow-inner">
                <Crown size={22} className="text-amber-500" />
              </div>
              <div className="min-w-0">
                <div className="font-black text-sm sm:text-base flex items-center gap-2 flex-wrap text-white">
                  <span>Administrator Portal Active</span>
                  <span className="text-[11px] bg-[#A78BFA] text-slate-900 px-2 py-0.5 rounded-full font-black tracking-wider uppercase">
                    Admin Access
                  </span>
                </div>
                <p className="text-xs text-white/80 truncate mt-0.5">
                  Manage curriculum, question banks, and live tests
                </p>
              </div>
            </div>
            <button
              onClick={() => {
                triggerHaptic("medium");
                onNavigateTab?.("admin");
              }}
              className="px-4 py-2 bg-[#A78BFA] hover:bg-[#d4a853] active:scale-95 text-slate-900 text-xs font-black rounded-xl transition-all shrink-0 cursor-pointer shadow-md flex items-center gap-1.5"
            >
              <span>Admin Panel</span>
              <ChevronRight size={14} />
            </button>
          </motion.div>
        )}
        {/* ─────────────────────────────────────────────────────────────
            A. ASPIRANT TOOLKIT & PREFERENCES
        ───────────────────────────────────────────────────────────── */}
        <motion.section variants={itemVariants} className="space-y-2.5">
          <h3 className="text-xs font-black text-slate-600 dark:text-slate-200 uppercase tracking-wider px-1">
            Preferences
          </h3>
          <div className="bg-white dark:bg-[#1B1536] rounded-3xl border border-slate-200 dark:border-[#31275E] shadow-xs overflow-hidden divide-y divide-slate-200/60 dark:divide-[#31275E]">
            {/* App & Practice Settings */}
            <button
              onClick={() => {
                triggerHaptic("light");
                setShowSettingsModal(true);
              }}
              className="w-full flex items-center justify-between p-4 hover:bg-[#F8FAFC] dark:hover:bg-[#241D48]/60 transition-colors group cursor-pointer text-left"
            >
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-2xl bg-[#7045D8]/10 dark:bg-[#7045D8]/15 text-[#7045D8] dark:text-[#A78BFA] flex items-center justify-center shrink-0 shadow-2xs">
                  <Settings size={19} />
                </div>
                <div className="min-w-0 flex-1">
                  <span className="text-sm font-black text-slate-900 dark:text-slate-50 block truncate">
                    Practice Settings
                  </span>
                  <span className="text-[11px] text-slate-500 dark:text-slate-300 font-bold block truncate">
                    Daily goal: {dailyGoal} Qs • Sound &amp; Timer
                  </span>
                </div>
              </div>
              <ChevronRight size={18} className="text-slate-400 group-hover:text-[#7045D8] dark:group-hover:text-amber-500 transition-colors" />
            </button>

            {/* AI Assistant Preferences */}
            <button
              onClick={() => {
                triggerHaptic("light");
                setShowApiSettingsModal(true);
              }}
              className="w-full flex items-center justify-between p-4 hover:bg-[#F8FAFC] dark:hover:bg-[#241D48]/60 transition-colors group cursor-pointer text-left"
            >
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-2xl bg-[#A78BFA]/20 text-[#7045D8] dark:text-[#A78BFA] flex items-center justify-center shrink-0 shadow-2xs">
                  <Sparkles size={19} />
                </div>
                <div className="min-w-0 flex-1">
                  <span className="text-sm font-black text-slate-900 dark:text-slate-50 block truncate">
                    AI Assistant
                  </span>
                  <span className="text-[11px] text-slate-500 dark:text-slate-300 font-bold block truncate">
                    {settings.aiMode === "personal_keys" ? "Personal Gemini Key" : "Default AI Model"}
                  </span>
                </div>
              </div>
              <ChevronRight size={18} className="text-slate-400 group-hover:text-[#7045D8] dark:group-hover:text-amber-500 transition-colors" />
            </button>

            {/* Share App */}
            <button
              onClick={handleShareInvite}
              className="w-full flex items-center justify-between p-4 hover:bg-[#F8FAFC] dark:hover:bg-[#241D48]/60 transition-colors group cursor-pointer text-left"
            >
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-2xl bg-[#7045D8]/15 text-[#7045D8] flex items-center justify-center shrink-0 shadow-2xs">
                  <Share2 size={19} />
                </div>
                <div className="min-w-0 flex-1">
                  <span className="text-sm font-black text-slate-900 dark:text-slate-50 block truncate">
                    Share App
                  </span>
                  <span className="text-[11px] text-slate-500 dark:text-slate-300 font-bold block truncate">
                    Invite friends on WhatsApp &amp; Telegram
                  </span>
                </div>
              </div>
              <ChevronRight size={18} className="text-slate-400 group-hover:text-[#7045D8] dark:group-hover:text-amber-500 transition-colors" />
            </button>
          </div>
        </motion.section>

        {/* ─────────────────────────────────────────────────────────────
            5. COMMUNITY, HELP & LEGAL GRID
        ───────────────────────────────────────────────────────────── */}
        <motion.section variants={itemVariants} className="space-y-2.5">
          <h3 className="text-xs font-black text-slate-600 dark:text-slate-200 uppercase tracking-wider px-1">
            Support &amp; Info
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {[
              {
                label: "Telegram",
                sub: "Community",
                icon: Send,
                color: "text-[#7045D8] dark:text-[#A78BFA]",
                bg: "bg-[#7045D8]/10 dark:bg-[#7045D8]/15",
                action: () => window.open("https://t.me/disha2020_official", "_blank"),
              },
              {
                label: "Support",
                sub: "Help Desk",
                icon: Mail,
                color: "text-[#7045D8]",
                bg: "bg-[#7045D8]/15",
                action: () => onNavigateTab?.("contact"),
              },
              {
                label: "About",
                sub: "Version & Info",
                icon: Info,
                color: "text-amber-500",
                bg: "bg-[#A78BFA]/15",
                action: () => setShowAboutModal(true),
              },
              {
                label: "Privacy",
                sub: "Terms & Policy",
                icon: Shield,
                color: "text-emerald-600 dark:text-emerald-400",
                bg: "bg-emerald-500/10",
                action: () => onNavigateTab?.("privacy-policy"),
              },
            ].map((item, i) => (
              <button
                key={i}
                onClick={item.action}
                className="bg-white dark:bg-[#1B1536] border border-slate-200 dark:border-[#31275E] p-3.5 rounded-2xl flex flex-col items-center text-center gap-2 shadow-2xs hover:border-[#7045D8] dark:hover:border-[#A78BFA] active:scale-95 transition-all cursor-pointer group"
              >
                <div
                  className={`w-10 h-10 rounded-xl ${item.bg} ${item.color} flex items-center justify-center group-hover:scale-105 transition-transform shrink-0`}
                >
                  <item.icon size={18} />
                </div>
                <div className="min-w-0 w-full px-0.5">
                  <span className="text-[11px] font-black text-slate-900 dark:text-slate-50 block truncate">
                    {item.label}
                  </span>
                  <span className="text-[11px] font-bold text-slate-500 dark:text-slate-300 block truncate">
                    {item.sub}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </motion.section>

        {/* ─────────────────────────────────────────────────────────────
            6. SYSTEM DATA & STORAGE ACTIONS
        ───────────────────────────────────────────────────────────── */}
        <motion.section variants={itemVariants} className="pt-1">
          <div className="bg-slate-100 dark:bg-[#1B1536] rounded-3xl p-2 space-y-1.5 border border-slate-200 dark:border-[#31275E]">
            {/* Reset Progress */}
            <button
              onClick={() => setShowResetConfirm(true)}
              className="w-full flex items-center justify-between p-3.5 hover:bg-white dark:hover:bg-[#241D48] rounded-2xl transition-all group cursor-pointer text-left"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                  <RotateCcw size={16} />
                </div>
                <div>
                  <span className="text-xs font-black text-rose-600 dark:text-rose-400 block">
                    Reset Progress
                  </span>
                  <span className="text-[11px] text-slate-500 dark:text-slate-300 block">
                    Clear practice history &amp; stats
                  </span>
                </div>
              </div>
              <ChevronRight size={14} className="text-rose-400/80" />
            </button>

            {/* Clear Cache */}
            <button
              onClick={() => setShowCacheResetConfirm(true)}
              className="w-full flex items-center justify-between p-3.5 hover:bg-white dark:hover:bg-[#241D48] rounded-2xl transition-all group cursor-pointer text-left"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-white dark:bg-[#241D48] text-slate-700 dark:text-slate-50 flex items-center justify-center border border-slate-200 dark:border-[#31275E] shrink-0">
                  <RefreshCw size={16} />
                </div>
                <div>
                  <span className="text-xs font-black text-slate-900 dark:text-slate-50 block">
                    Clear Cache
                  </span>
                  <span className="text-[11px] text-slate-500 dark:text-slate-300 block">
                    Refresh offline data &amp; re-sync
                  </span>
                </div>
              </div>
              <ChevronRight size={14} className="text-slate-400" />
            </button>

            {/* Logout */}
            {isAuthenticated && (
              <button
                onClick={onLogout}
                className="w-full flex items-center justify-between p-3.5 hover:bg-white dark:hover:bg-[#241D48] rounded-2xl transition-all group cursor-pointer text-left"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-[#7045D8] text-white flex items-center justify-center shrink-0">
                    <LogOut size={16} />
                  </div>
                  <div>
                    <span className="text-xs font-black text-[#7045D8] dark:text-rose-400 block">
                      Log Out
                    </span>
                    <span className="text-[11px] text-slate-500 dark:text-slate-300 block">
                      Sign out from this device
                    </span>
                  </div>
                </div>
                <ChevronRight size={14} className="text-slate-400" />
              </button>
            )}
          </div>
        </motion.section>

        {/* Footer Brand Banner */}
        <motion.section variants={itemVariants} className="text-center pt-2 pb-6 space-y-1">
          <p className="text-[11px] font-black text-[#7045D8] dark:text-[#A78BFA] uppercase tracking-widest">
            Disha PYQ • Previous Year Questions & Precision Learning
          </p>
          <p className="text-[11px] font-bold text-slate-400 dark:text-slate-500">
            RPSC • RSMSSB • REET • CET • RAS • Competitive Exam Specialist
          </p>
        </motion.section>
      </motion.main>

      {/* ─────────────────────────────────────────────────────────────
          7. MODALS
      ───────────────────────────────────────────────────────────── */}

      {/* Edit Profile Modal */}
      {showEditProfileModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-black/75 backdrop-blur-xs"
            onClick={() => setShowEditProfileModal(false)}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative bg-white dark:bg-[#1B1536] rounded-3xl p-6 w-full max-w-md border border-slate-200 dark:border-[#A78BFA]/30 shadow-2xl space-y-5"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-[#31275E]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-[#7045D8]/10 dark:bg-[#7045D8]/15 text-[#7045D8] dark:text-[#A78BFA] flex items-center justify-center">
                  <User size={20} />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-slate-50">
                    Edit Profile
                  </h3>
                  <p className="text-[11px] font-bold text-slate-500 dark:text-slate-300 uppercase tracking-wider">
                    Target exam &amp; daily goal
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowEditProfileModal(false)}
                className="w-8 h-8 rounded-full bg-slate-100 dark:bg-[#241D48] flex items-center justify-center text-slate-600 dark:text-slate-50 hover:bg-slate-200 cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveProfile} className="space-y-4">
              {/* Full Name */}
              <div className="space-y-1">
                <label className="text-[11px] font-black text-slate-700 dark:text-slate-200 uppercase tracking-wider block">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-[#F8FAFC] dark:bg-[#130E26] border border-slate-200 dark:border-[#31275E] text-sm font-bold text-slate-900 dark:text-slate-50 focus:outline-none focus:ring-2 focus:ring-[#7045D8] dark:focus:ring-[#A78BFA]"
                  placeholder="Enter your name"
                />
              </div>

              {/* Target Exam */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-black text-slate-700 dark:text-slate-200 uppercase tracking-wider block">
                  Target Exam *
                </label>
                <input
                  type="text"
                  required
                  value={editTargetExam}
                  onChange={(e) => setEditTargetExam(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-[#F8FAFC] dark:bg-[#130E26] border border-slate-200 dark:border-[#31275E] text-sm font-bold text-slate-900 dark:text-slate-50 focus:outline-none focus:ring-2 focus:ring-[#7045D8] dark:focus:ring-[#A78BFA]"
                  placeholder="e.g. RPSC RAS Pre / CET / SI"
                />

                {/* Popular Exam Chips */}
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {POPULAR_TARGET_EXAMS.map((exam) => (
                    <button
                      type="button"
                      key={exam}
                      onClick={() => setEditTargetExam(exam)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-black transition-all cursor-pointer ${
                        editTargetExam === exam
                          ? "bg-[#7045D8] dark:bg-[#7045D8] text-white dark:text-slate-950 shadow-2xs"
                          : "bg-slate-100 dark:bg-[#241D48] text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-[#31275E]"
                      }`}
                    >
                      {exam}
                    </button>
                  ))}
                </div>
              </div>

              {/* Daily Goal Question Selector */}
              <div className="space-y-1.5 pt-1">
                <label className="text-[11px] font-black text-slate-700 dark:text-slate-200 uppercase tracking-wider block">
                  Daily Question Goal
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {[20, 30, 50, 100].map((goal) => (
                    <button
                      type="button"
                      key={goal}
                      onClick={() => setEditDailyGoal(goal)}
                      className={`py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                        editDailyGoal === goal
                          ? "bg-gradient-to-r from-[#7045D8] to-[#5B32BF] dark:from-[#A78BFA] dark:to-[#B88934] text-white dark:text-slate-950 shadow-xs"
                          : "bg-slate-100 dark:bg-[#241D48] text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-[#31275E]"
                      }`}
                    >
                      {goal} Qs
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-2 flex items-center gap-2">
                <button
                  type="submit"
                  className="flex-1 py-3 bg-gradient-to-r from-[#7045D8] via-[#5B32BF] to-[#7045D8] hover:opacity-95 text-white rounded-xl text-xs font-black shadow-md border border-[#A78BFA]/30 cursor-pointer active:scale-95 transition-all"
                >
                  Save Changes
                </button>
                <button
                  type="button"
                  onClick={() => setShowEditProfileModal(false)}
                  className="px-4 py-3 bg-slate-100 dark:bg-[#241D48] text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* Reset Confirmation Modal */}
      {showResetConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-black/75 backdrop-blur-xs"
            onClick={() => setShowResetConfirm(false)}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative bg-white dark:bg-[#1B1536] rounded-3xl p-6 w-full max-w-sm border border-rose-200 dark:border-rose-900/50 shadow-2xl space-y-4"
          >
            <div className="w-14 h-14 rounded-2xl bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto">
              <AlertCircle size={28} />
            </div>
            <h3 className="text-lg font-black text-slate-900 dark:text-slate-50 text-center tracking-tight">
              Reset Study Progress?
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-300 text-center leading-relaxed">
              This will permanently delete all your practiced questions, scores, and analytics. This action cannot be undone.
            </p>

            <div className="space-y-1.5">
              <label className="text-[11px] font-black text-slate-600 dark:text-slate-200 uppercase tracking-widest block text-center">
                Type &quot;RESET&quot; to confirm
              </label>
              <input
                type="text"
                value={resetConfirmText}
                onChange={(e) => setResetConfirmText(e.target.value.toUpperCase())}
                placeholder="RESET"
                className="w-full px-4 py-2.5 rounded-xl bg-[#F8FAFC] dark:bg-[#130E26] border border-rose-300 dark:border-rose-800 text-center text-sm font-black text-rose-600 focus:outline-none focus:ring-2 focus:ring-rose-500/30"
              />
            </div>

            <div className="grid grid-cols-2 gap-2.5 pt-2">
              <button
                onClick={() => {
                  setShowResetConfirm(false);
                  setResetConfirmText("");
                }}
                className="py-2.5 rounded-xl bg-slate-100 dark:bg-[#241D48] border border-slate-200 dark:border-[#31275E] text-xs font-black text-slate-700 dark:text-slate-300 active:scale-95 transition-transform cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (resetConfirmText === "RESET") {
                    onResetProgress();
                    setShowResetConfirm(false);
                    setResetConfirmText("");
                    showToast("Study progress successfully reset.");
                  }
                }}
                disabled={resetConfirmText !== "RESET"}
                className={`py-2.5 rounded-xl text-white text-xs font-black shadow-md transition-all active:scale-95 ${
                  resetConfirmText === "RESET"
                    ? "bg-rose-600 hover:bg-rose-700 cursor-pointer shadow-rose-600/30"
                    : "bg-slate-300 dark:bg-slate-700 text-slate-500 cursor-not-allowed shadow-none"
                }`}
              >
                Yes, Reset
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Cache Purge Modal */}
      {showCacheResetConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-black/75 backdrop-blur-xs"
            onClick={() => setShowCacheResetConfirm(false)}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative bg-white dark:bg-[#1B1536] rounded-3xl p-6 w-full max-w-sm border border-slate-200 dark:border-[#31275E] shadow-2xl space-y-4"
          >
            <div className="w-14 h-14 rounded-2xl bg-[#7045D8]/15 text-[#7045D8] flex items-center justify-center mx-auto">
              <RefreshCw size={28} />
            </div>
            <h3 className="text-lg font-black text-slate-900 dark:text-slate-50 text-center tracking-tight">
              Purge Cache &amp; Re-sync?
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-300 text-center leading-relaxed font-medium">
              This will clear local cache and re-download the latest questions and data from cloud.
            </p>
            <div className="grid grid-cols-2 gap-2.5 pt-2">
              <button
                onClick={() => setShowCacheResetConfirm(false)}
                className="py-2.5 rounded-xl bg-slate-100 dark:bg-[#241D48] border border-slate-200 dark:border-[#31275E] text-xs font-black text-slate-700 dark:text-slate-300 active:scale-95 transition-transform cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  triggerHaptic("light");
                  safeClearLocalStorage();
                  safeClearSessionStorage();
                  await clearIndexedDB().catch(() => {});
                  setShowCacheResetConfirm(false);
                  showToast("System cache cleared. Reloading...");
                  setTimeout(() => window.location.reload(), 1200);
                }}
                className="py-2.5 rounded-xl bg-gradient-to-r from-[#7045D8] to-[#E06A14] text-white text-xs font-black shadow-md shadow-[#7045D8]/25 active:scale-95 transition-transform cursor-pointer"
              >
                Yes, Refresh
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* About Modal */}
      {showAboutModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-black/75 backdrop-blur-xs"
            onClick={() => setShowAboutModal(false)}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative bg-white dark:bg-[#1B1536] rounded-3xl p-6 w-full max-w-sm border border-slate-200 dark:border-[#A78BFA]/30 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-[#31275E]">
              <AppLogo size="sm" variant="horizontal" showTagline={true} />
              <button
                onClick={() => setShowAboutModal(false)}
                className="w-8 h-8 rounded-full bg-slate-100 dark:bg-[#241D48] flex items-center justify-center text-slate-600 dark:text-slate-50 cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              <p>
                <strong>Disha PYQ</strong> is a dedicated smart preparation and previous year questions practice platform for all competitive exams (RPSC RAS, SI, REET, CET, Patwar, etc.).
              </p>

              <div className="space-y-2 bg-[#F8FAFC] dark:bg-[#130E26] p-3.5 rounded-2xl border border-slate-200 dark:border-[#31275E]">
                <div className="flex items-center gap-2.5 text-[#7045D8] dark:text-[#A78BFA]">
                  <Check size={14} className="stroke-[3] text-emerald-600" />
                  <span className="text-xs font-black">RPSC Option E (5th Option) Compliance</span>
                </div>
                <div className="flex items-center gap-2.5 text-[#7045D8] dark:text-[#A78BFA]">
                  <Check size={14} className="stroke-[3] text-emerald-600" />
                  <span className="text-xs font-black">Rajasthan PYQ Vault (Past 25 Years)</span>
                </div>
                <div className="flex items-center gap-2.5 text-[#7045D8] dark:text-[#A78BFA]">
                  <Check size={14} className="stroke-[3] text-emerald-600" />
                  <span className="text-xs font-black">AI Weakness Radar &amp; Customized Practice</span>
                </div>
                <div className="flex items-center gap-2.5 text-[#7045D8] dark:text-[#A78BFA]">
                  <Check size={14} className="stroke-[3] text-emerald-600" />
                  <span className="text-xs font-black">All-Rajasthan Live Mock Tests &amp; Merit Ranks</span>
                </div>
              </div>
            </div>

            <button
              onClick={() => setShowAboutModal(false)}
              className="w-full py-3 bg-gradient-to-r from-[#7045D8] via-[#5B32BF] to-[#7045D8] text-white rounded-xl text-xs font-black shadow-md border border-[#A78BFA]/30 cursor-pointer active:scale-95 transition-all"
            >
              Close
            </button>
          </motion.div>
        </div>
      )}

      {/* Settings Modal */}
      {showSettingsModal && (
        <AppSettingsModal
          settings={settings}
          onUpdateSettings={onUpdateSettings}
          onClose={() => setShowSettingsModal(false)}
        />
      )}

      {/* API Settings Modal */}
      {showApiSettingsModal && (
        <ApiSettingsModal
          settings={settings}
          onUpdateSettings={onUpdateSettings}
          onClose={() => setShowApiSettingsModal(false)}
        />
      )}

      {/* Share Modal */}
      {shareData && (
        <ShareModal
          isOpen={!!shareData}
          onClose={() => setShareData(null)}
          data={shareData}
        />
      )}

      {/* Toast Notification */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[150] bg-gradient-to-r from-[#7045D8] to-[#5B32BF] text-white px-5 py-3 rounded-2xl shadow-2xl text-xs font-black tracking-wide border border-[#A78BFA]/40 flex items-center gap-2"
          >
            <CheckCircle2 size={15} className="text-amber-500" />
            <span>{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ProfileTab;
