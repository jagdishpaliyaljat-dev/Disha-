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
  Trash2,
  Star,
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
  FileText,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import ShareModal, { ShareData } from "./ShareModal";
import { ApiSettingsModal } from "./ApiSettingsModal";
import { AppSettingsModal } from "./AppSettingsModal";
import { PlayStoreReviewPromptModal } from "./PlayStoreReviewPromptModal";
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
}) => {
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resetConfirmText, setResetConfirmText] = useState("");
  const [showCacheResetConfirm, setShowCacheResetConfirm] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showApiSettingsModal, setShowApiSettingsModal] = useState(false);
  const [showAboutModal, setShowAboutModal] = useState(false);
  const [showDeleteAccountModal, setShowDeleteAccountModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
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
    : (activeProfile?.name && activeProfile.name !== "Student" && activeProfile.name !== "Guest Aspirant"
        ? activeProfile.name
        : (activeProfile?.email?.split("@")[0] || "Aspirant"));
  const isAdmin = isUserAdmin(activeProfile);

  // Computed Metrics
  const progressValues = useMemo(() => Object.values(progressStore), [progressStore]);

  const attemptedCount = useMemo(() => {
    if (questions.length > 0) {
      return questions.filter((q) => progressStore[q.id] && progressStore[q.id].status !== "unattempted").length;
    }
    return progressValues.filter((p) => p.status !== "unattempted").length;
  }, [questions, progressStore, progressValues]);

  const dailyGoal = activeProfile?.dailyGoalQuestions || settings.dailyGoal || 30;

  // Level & XP System
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
      title: "Disha PYQ — Exam Preparation Platform",
      text: `Hello! I am preparing for ${activeProfile.targetExam || "Rajasthan Competitive Exams"} on Disha PYQ with authentic previous year questions and live mock tests. Join me:`,
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
    showToast("Profile updated successfully!");
  };

  return (
    <div
      className="flex flex-col h-full bg-[#F8FAFC] dark:bg-[#130E26] overflow-y-auto pb-28 md:pb-10 selection:bg-[#7045D8] selection:text-white"
      id="profile-tab"
    >
      {/* ─────────────────────────────────────────────────────────────
          1. MINIMAL STICKY APP BAR
      ───────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 md:top-14 z-30 bg-white/95 dark:bg-[#130E26]/95 backdrop-blur-md border-b border-slate-200 dark:border-[#31275E] select-none w-full max-w-full overflow-hidden transition-colors pt-[env(safe-area-inset-top,0px)] md:pt-0">
        <div className="min-h-[58px] px-4 sm:px-6 py-2 max-w-2xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
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
              className="md:hidden w-9 h-9 rounded-xl bg-slate-100 dark:bg-[#1B1536] hover:bg-slate-200 dark:hover:bg-[#241D48] border border-slate-200 dark:border-[#31275E] flex items-center justify-center text-slate-700 dark:text-slate-200 active:scale-95 transition-all cursor-pointer shrink-0"
              aria-label="Back to Home"
            >
              <ArrowLeft className="w-4.5 h-4.5" />
            </button>
            <div className="min-w-0">
              <h1 className="text-base sm:text-lg font-black tracking-tight text-slate-900 dark:text-slate-50 leading-tight truncate">
                Profile &amp; Settings
              </h1>
              <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 leading-none mt-0.5 truncate">
                Preferences, target exams &amp; storage
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {/* Eye Comfort Toggle */}
            <button
              type="button"
              onClick={() => {
                triggerHaptic("light");
                onUpdateSettings({ eyeComfort: !settings.eyeComfort });
              }}
              className={`w-9 h-9 rounded-xl border flex items-center justify-center active:scale-95 transition-all cursor-pointer shrink-0 ${
                settings.eyeComfort
                  ? "bg-amber-500/15 border-amber-500 text-amber-500"
                  : "bg-slate-100 dark:bg-[#1B1536] hover:bg-slate-200 dark:hover:bg-[#241D48] border-slate-200 dark:border-[#31275E] text-slate-600 dark:text-slate-300"
              }`}
              aria-label="Toggle Eye Comfort"
              title={settings.eyeComfort ? "Eye Comfort On" : "Eye Comfort Off"}
            >
              <Eye className="w-4 h-4" />
            </button>

            {/* Dark / Light / AMOLED Theme Toggle */}
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
              className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-[#1B1536] hover:bg-slate-200 dark:hover:bg-[#241D48] border border-slate-200 dark:border-[#31275E] flex items-center justify-center text-slate-700 dark:text-slate-200 active:scale-95 transition-all cursor-pointer shrink-0"
              aria-label="Toggle Theme"
              title="Toggle Theme"
            >
              {!settings.darkMode ? (
                <Moon className="w-4 h-4 text-[#7045D8]" />
              ) : settings.amoledBlack ? (
                <Sparkles className="w-4 h-4 text-amber-400" />
              ) : (
                <Sun className="w-4 h-4 text-amber-400" />
              )}
            </button>

            {/* Quick Practice Settings */}
            <button
              type="button"
              onClick={() => {
                triggerHaptic("light");
                setShowSettingsModal(true);
              }}
              className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-[#1B1536] hover:bg-slate-200 dark:hover:bg-[#241D48] border border-slate-200 dark:border-[#31275E] flex items-center justify-center text-[#7045D8] dark:text-[#A78BFA] active:scale-95 transition-all cursor-pointer shrink-0"
              aria-label="Practice Settings"
              title="Practice Settings"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* ─────────────────────────────────────────────────────────────
          2. MAIN CONTENT CONTAINER (MINIMALIST & CLEAN)
      ───────────────────────────────────────────────────────────── */}
      <main className="px-4 sm:px-6 pt-4 space-y-5 max-w-2xl mx-auto w-full">
        {/* HERO ASPIRANT IDENTITY CARD */}
        <section className="bg-white dark:bg-[#1B1536] p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-[#31275E] shadow-xs relative overflow-hidden">
          <div className="flex items-start gap-4">
            {/* Avatar with Disha Royal Ring */}
            <div className="relative shrink-0">
              <div className="w-16 h-16 sm:w-18 sm:h-18 rounded-2xl p-0.5 bg-gradient-to-tr from-[#7045D8] via-[#5B32BF] to-[#A78BFA] shadow-xs">
                <div className="w-full h-full rounded-[14px] overflow-hidden bg-slate-100 dark:bg-[#130E26] flex items-center justify-center">
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
                  setShowSettingsModal(true);
                }}
                className="absolute -bottom-1 -right-1 w-7 h-7 rounded-lg bg-[#7045D8] hover:bg-[#5B32BF] text-white flex items-center justify-center shadow-xs border-2 border-white dark:border-[#1B1536] active:scale-90 transition-transform cursor-pointer"
                aria-label="Edit Profile & Settings"
              >
                <Edit2 size={12} />
              </button>
            </div>

            {/* Profile Info */}
            <div className="flex-1 min-w-0 space-y-1.5">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-slate-50 tracking-tight truncate leading-tight">
                  {userName}
                </h2>
                {isAdmin ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#7045D8]/10 text-[#7045D8] dark:text-[#A78BFA] text-[10px] font-black uppercase tracking-wider border border-[#7045D8]/20">
                    <Crown size={9} className="text-amber-500" />
                    Admin
                  </span>
                ) : !isAuthenticated ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-700 dark:text-amber-400 text-[10px] font-black uppercase tracking-wider border border-amber-500/20">
                    Guest
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#7045D8]/10 text-[#7045D8] dark:text-[#A78BFA] text-[10px] font-black uppercase tracking-wider border border-[#7045D8]/20">
                    Aspirant
                  </span>
                )}
              </div>

              {activeProfile?.email && (
                <div className="flex items-center gap-1 text-[11px] font-medium text-slate-500 dark:text-slate-400 truncate">
                  <Mail size={11} className="shrink-0" />
                  <span className="truncate">{activeProfile.email}</span>
                  <CheckCircle2 size={11} className="text-emerald-500 shrink-0" />
                </div>
              )}

              {/* Target Exam Chip */}
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-50 dark:bg-[#130E26] border border-slate-200/80 dark:border-[#31275E] text-xs font-semibold text-[#7045D8] dark:text-[#A78BFA] max-w-full">
                <Target size={12} className="text-[#7045D8] shrink-0" />
                <span className="truncate">{activeProfile?.targetExam || "RPSC RAS Pre"}</span>
              </div>
            </div>
          </div>

          {/* Level & XP Mini Bar */}
          <div className="mt-4 pt-3.5 border-t border-slate-100 dark:border-[#31275E]/60">
            <div className="flex items-center justify-between text-xs font-bold text-slate-600 dark:text-slate-300 mb-1.5">
              <span className="flex items-center gap-1.5">
                <Zap size={12} className="text-amber-500" />
                Level {currentLevel} Aspirant
              </span>
              <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500">
                {remainingForNextLevel} Qs to Level {currentLevel + 1}
              </span>
            </div>
            <div className="w-full h-1.5 rounded-full bg-slate-100 dark:bg-[#130E26] overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#7045D8] to-[#A78BFA] transition-all duration-500"
                style={{ width: `${levelProgressPercent}%` }}
              />
            </div>
          </div>

          {/* Guest Mode Sign-In Banner */}
          {!isAuthenticated && (
            <div className="mt-3.5 pt-3 border-t border-slate-100 dark:border-[#31275E]/60 flex items-center justify-between gap-3">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Sign in to sync your bookmarks, streaks &amp; live ranks.
              </p>
              <button
                type="button"
                onClick={() => {
                  triggerHaptic("medium");
                  onOpenLogin?.();
                }}
                className="px-3.5 py-1.5 bg-[#7045D8] hover:bg-[#5B32BF] text-white rounded-xl text-xs font-bold shadow-xs active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
              >
                <LogIn size={13} />
                <span>Sign In</span>
              </button>
            </div>
          )}
        </section>

        {/* ADMIN PORTAL QUICK ACCESS (IF ADMIN) */}
        {isAdmin && (
          <section className="bg-gradient-to-r from-[#7045D8] to-[#5B32BF] text-white p-3.5 rounded-2xl border border-[#A78BFA]/30 shadow-xs flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
                <Crown size={18} className="text-amber-400" />
              </div>
              <div className="min-w-0">
                <h3 className="text-xs font-black uppercase tracking-wider text-white">Administrator Access</h3>
                <p className="text-[11px] text-white/80 truncate">Manage questions, exams &amp; users</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                triggerHaptic("medium");
                onNavigateTab?.("admin");
              }}
              className="px-3 py-1.5 bg-white text-[#7045D8] hover:bg-slate-100 rounded-xl text-xs font-black active:scale-95 transition-all shrink-0 cursor-pointer shadow-xs flex items-center gap-1"
            >
              <span>Admin Panel</span>
              <ChevronRight size={13} />
            </button>
          </section>
        )}

        {/* ─────────────────────────────────────────────────────────────
            3. GROUPED MINIMAL ACTION LISTS
        ───────────────────────────────────────────────────────────── */}

        {/* Group A: App Settings & Preferences */}
        <section className="space-y-1.5">
          <h3 className="text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 px-1">
            App Settings &amp; Preferences
          </h3>
          <div className="bg-white dark:bg-[#1B1536] rounded-2xl border border-slate-200 dark:border-[#31275E] shadow-xs overflow-hidden divide-y divide-slate-100 dark:divide-[#31275E]/60">
            {/* Practice Settings */}
            <button
              type="button"
              onClick={() => {
                triggerHaptic("light");
                setShowSettingsModal(true);
              }}
              className="w-full flex items-center justify-between p-3.5 hover:bg-slate-50 dark:hover:bg-[#241D48]/50 transition-colors cursor-pointer text-left group"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-[#7045D8]/10 text-[#7045D8] dark:text-[#A78BFA] flex items-center justify-center shrink-0">
                  <Settings size={17} />
                </div>
                <div className="min-w-0">
                  <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-50 block truncate">
                    Practice Preferences
                  </span>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 block truncate">
                    Display, Audio, Haptics &amp; Profile Settings
                  </span>
                </div>
              </div>
              <ChevronRight size={16} className="text-slate-400 group-hover:text-[#7045D8] transition-colors shrink-0" />
            </button>

            {/* AI Assistant Configuration */}
            <button
              type="button"
              onClick={() => {
                triggerHaptic("light");
                setShowApiSettingsModal(true);
              }}
              className="w-full flex items-center justify-between p-3.5 hover:bg-slate-50 dark:hover:bg-[#241D48]/50 transition-colors cursor-pointer text-left group"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-[#A78BFA]/15 text-[#7045D8] dark:text-[#A78BFA] flex items-center justify-center shrink-0">
                  <Sparkles size={17} />
                </div>
                <div className="min-w-0">
                  <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-50 block truncate">
                    AI Doubt Solver
                  </span>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 block truncate">
                    {settings.aiMode === "personal_keys" ? "Custom Gemini API Key" : "Default Built-in AI Model"}
                  </span>
                </div>
              </div>
              <ChevronRight size={16} className="text-slate-400 group-hover:text-[#7045D8] transition-colors shrink-0" />
            </button>
          </div>
        </section>

        {/* Group B: Community & Support */}
        <section className="space-y-1.5">
          <h3 className="text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 px-1">
            Community &amp; Sharing
          </h3>
          <div className="bg-white dark:bg-[#1B1536] rounded-2xl border border-slate-200 dark:border-[#31275E] shadow-xs overflow-hidden divide-y divide-slate-100 dark:divide-[#31275E]/60">
            {/* Rate on Google Play (ASO Trigger) */}
            <button
              type="button"
              onClick={() => {
                triggerHaptic("light");
                setShowReviewModal(true);
              }}
              className="w-full flex items-center justify-between p-3.5 hover:bg-amber-50/40 dark:hover:bg-amber-950/20 transition-colors cursor-pointer text-left group"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0">
                  <Star size={17} className="fill-amber-500" />
                </div>
                <div className="min-w-0">
                  <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-50 block truncate">
                    Rate 5 Stars on Google Play
                  </span>
                  <span className="text-[11px] text-amber-600 dark:text-amber-400 font-semibold block truncate">
                    Help other aspirants find Disha PYQ
                  </span>
                </div>
              </div>
              <ChevronRight size={16} className="text-amber-400 group-hover:text-amber-500 transition-colors shrink-0" />
            </button>

            {/* Share App */}
            <button
              type="button"
              onClick={handleShareInvite}
              className="w-full flex items-center justify-between p-3.5 hover:bg-slate-50 dark:hover:bg-[#241D48]/50 transition-colors cursor-pointer text-left group"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-[#7045D8]/10 text-[#7045D8] dark:text-[#A78BFA] flex items-center justify-center shrink-0">
                  <Share2 size={17} />
                </div>
                <div className="min-w-0">
                  <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-50 block truncate">
                    Share with Study Partners
                  </span>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 block truncate">
                    Invite friends via WhatsApp &amp; Telegram
                  </span>
                </div>
              </div>
              <ChevronRight size={16} className="text-slate-400 group-hover:text-[#7045D8] transition-colors shrink-0" />
            </button>

            {/* Telegram Channel */}
            <button
              type="button"
              onClick={() => {
                triggerHaptic("light");
                window.open("https://t.me/disha2020_official", "_blank");
              }}
              className="w-full flex items-center justify-between p-3.5 hover:bg-slate-50 dark:hover:bg-[#241D48]/50 transition-colors cursor-pointer text-left group"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-sky-500/10 text-sky-500 flex items-center justify-center shrink-0">
                  <Send size={17} />
                </div>
                <div className="min-w-0">
                  <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-50 block truncate">
                    Official Telegram Channel
                  </span>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 block truncate">
                    Daily exam alerts &amp; notes updates
                  </span>
                </div>
              </div>
              <ChevronRight size={16} className="text-slate-400 group-hover:text-[#7045D8] transition-colors shrink-0" />
            </button>
          </div>
        </section>

        {/* Group C: Legal & Transparency */}
        <section className="space-y-1.5">
          <h3 className="text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 px-1">
            Transparency &amp; Legal
          </h3>
          <div className="bg-white dark:bg-[#1B1536] rounded-2xl border border-slate-200 dark:border-[#31275E] shadow-xs overflow-hidden divide-y divide-slate-100 dark:divide-[#31275E]/60">
            {/* About Us */}
            <button
              type="button"
              onClick={() => {
                triggerHaptic("light");
                setShowAboutModal(true);
              }}
              className="w-full flex items-center justify-between p-3.5 hover:bg-slate-50 dark:hover:bg-[#241D48]/50 transition-colors cursor-pointer text-left group"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-[#7045D8]/10 text-[#7045D8] dark:text-[#A78BFA] flex items-center justify-center shrink-0">
                  <Info size={17} />
                </div>
                <div className="min-w-0">
                  <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-50 block truncate">
                    About Disha PYQ
                  </span>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 block truncate">
                    Mission, version &amp; features
                  </span>
                </div>
              </div>
              <ChevronRight size={16} className="text-slate-400 group-hover:text-[#7045D8] transition-colors shrink-0" />
            </button>

            {/* Privacy Policy */}
            <button
              type="button"
              onClick={() => {
                triggerHaptic("light");
                onNavigateTab?.("privacy-policy");
              }}
              className="w-full flex items-center justify-between p-3.5 hover:bg-slate-50 dark:hover:bg-[#241D48]/50 transition-colors cursor-pointer text-left group"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                  <Shield size={17} />
                </div>
                <div className="min-w-0">
                  <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-50 block truncate">
                    Privacy Policy
                  </span>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 block truncate">
                    Data protection &amp; Google Play compliance
                  </span>
                </div>
              </div>
              <ChevronRight size={16} className="text-slate-400 group-hover:text-[#7045D8] transition-colors shrink-0" />
            </button>

            {/* Terms of Service */}
            <button
              type="button"
              onClick={() => {
                triggerHaptic("light");
                onNavigateTab?.("terms-of-service");
              }}
              className="w-full flex items-center justify-between p-3.5 hover:bg-slate-50 dark:hover:bg-[#241D48]/50 transition-colors cursor-pointer text-left group"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-[#241D48] text-slate-600 dark:text-slate-300 flex items-center justify-center shrink-0">
                  <FileText size={17} />
                </div>
                <div className="min-w-0">
                  <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-50 block truncate">
                    Terms of Service
                  </span>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 block truncate">
                    Fair usage &amp; intellectual property
                  </span>
                </div>
              </div>
              <ChevronRight size={16} className="text-slate-400 group-hover:text-[#7045D8] transition-colors shrink-0" />
            </button>

            {/* Disclaimer */}
            <button
              type="button"
              onClick={() => {
                triggerHaptic("light");
                onNavigateTab?.("disclaimer");
              }}
              className="w-full flex items-center justify-between p-3.5 hover:bg-slate-50 dark:hover:bg-[#241D48]/50 transition-colors cursor-pointer text-left group"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                  <AlertCircle size={17} />
                </div>
                <div className="min-w-0">
                  <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-50 block truncate">
                    Government Disclaimer
                  </span>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 block truncate">
                    Independent private education platform
                  </span>
                </div>
              </div>
              <ChevronRight size={16} className="text-slate-400 group-hover:text-[#7045D8] transition-colors shrink-0" />
            </button>

            {/* Contact Us */}
            <button
              type="button"
              onClick={() => {
                triggerHaptic("light");
                onNavigateTab?.("contact");
              }}
              className="w-full flex items-center justify-between p-3.5 hover:bg-slate-50 dark:hover:bg-[#241D48]/50 transition-colors cursor-pointer text-left group"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-[#7045D8]/10 text-[#7045D8] dark:text-[#A78BFA] flex items-center justify-center shrink-0">
                  <Mail size={17} />
                </div>
                <div className="min-w-0">
                  <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-50 block truncate">
                    Help &amp; Contact Desk
                  </span>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 block truncate">
                    Support query &amp; feedback
                  </span>
                </div>
              </div>
              <ChevronRight size={16} className="text-slate-400 group-hover:text-[#7045D8] transition-colors shrink-0" />
            </button>
          </div>
        </section>

        {/* Group D: Storage & Account Zone */}
        <section className="space-y-1.5">
          <h3 className="text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 px-1">
            Data &amp; Account
          </h3>
          <div className="bg-white dark:bg-[#1B1536] rounded-2xl border border-slate-200 dark:border-[#31275E] shadow-xs overflow-hidden divide-y divide-slate-100 dark:divide-[#31275E]/60">
            {/* Clear Cache */}
            <button
              type="button"
              onClick={() => {
                triggerHaptic("light");
                setShowCacheResetConfirm(true);
              }}
              className="w-full flex items-center justify-between p-3.5 hover:bg-slate-50 dark:hover:bg-[#241D48]/50 transition-colors cursor-pointer text-left group"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-[#241D48] text-slate-700 dark:text-slate-300 flex items-center justify-center shrink-0">
                  <RefreshCw size={17} />
                </div>
                <div className="min-w-0">
                  <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-50 block truncate">
                    Clear Offline Cache
                  </span>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 block truncate">
                    Re-sync question banks &amp; solve stuck assets
                  </span>
                </div>
              </div>
              <ChevronRight size={16} className="text-slate-400 group-hover:text-[#7045D8] transition-colors shrink-0" />
            </button>

            {/* Reset Progress */}
            <button
              type="button"
              onClick={() => {
                triggerHaptic("light");
                setShowResetConfirm(true);
              }}
              className="w-full flex items-center justify-between p-3.5 hover:bg-rose-50/40 dark:hover:bg-rose-950/20 transition-colors cursor-pointer text-left group"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                  <RotateCcw size={17} />
                </div>
                <div className="min-w-0">
                  <span className="text-xs sm:text-sm font-bold text-rose-600 dark:text-rose-400 block truncate">
                    Reset Practice History
                  </span>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 block truncate">
                    Clear attempted questions &amp; accuracy stats
                  </span>
                </div>
              </div>
              <ChevronRight size={16} className="text-rose-400/80 shrink-0" />
            </button>

            {/* Logout */}
            {isAuthenticated && (
              <button
                type="button"
                onClick={() => {
                  triggerHaptic("light");
                  onLogout?.();
                }}
                className="w-full flex items-center justify-between p-3.5 hover:bg-slate-50 dark:hover:bg-[#241D48]/50 transition-colors cursor-pointer text-left group"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-[#7045D8]/10 text-[#7045D8] dark:text-[#A78BFA] flex items-center justify-center shrink-0">
                    <LogOut size={17} />
                  </div>
                  <div className="min-w-0">
                    <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-50 block truncate">
                      Sign Out
                    </span>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 block truncate">
                      Disconnect this device
                    </span>
                  </div>
                </div>
                <ChevronRight size={16} className="text-slate-400 group-hover:text-[#7045D8] transition-colors shrink-0" />
              </button>
            )}

            {/* Delete Account (Mandatory Google Play Policy) */}
            {isAuthenticated && (
              <button
                type="button"
                onClick={() => {
                  triggerHaptic("medium");
                  setShowDeleteAccountModal(true);
                  setDeleteConfirmText("");
                }}
                className="w-full flex items-center justify-between p-3.5 hover:bg-rose-50/50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer text-left group"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                    <Trash2 size={17} />
                  </div>
                  <div className="min-w-0">
                    <span className="text-xs sm:text-sm font-bold text-rose-600 dark:text-rose-400 block truncate">
                      Delete Account &amp; Data
                    </span>
                    <span className="text-[11px] text-rose-500/80 block truncate">
                      Permanently purge account &amp; learning record
                    </span>
                  </div>
                </div>
                <ChevronRight size={16} className="text-rose-400 shrink-0" />
              </button>
            )}
          </div>
        </section>

        {/* Minimal Footer */}
        <div className="text-center pt-2 pb-6 space-y-1 select-none">
          <p className="text-[11px] font-bold text-[#7045D8] dark:text-[#A78BFA] tracking-wide">
            Disha PYQ • Rajasthan Exam Specialist
          </p>
          <p className="text-[10px] text-slate-400 dark:text-slate-500">
            RPSC • RSMSSB • REET • CET • Patwar • SI
          </p>
        </div>
      </main>

      {/* ─────────────────────────────────────────────────────────────
          4. POPUPS & ACTION MODALS
      ───────────────────────────────────────────────────────────── */}

      {/* Edit Profile Modal */}
      {showEditProfileModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs"
            onClick={() => setShowEditProfileModal(false)}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            role="dialog"
            aria-modal="true"
            aria-label="Edit Profile"
            className="relative bg-white dark:bg-[#1B1536] rounded-2xl p-5 w-full max-w-sm border border-slate-200 dark:border-[#31275E] shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between pb-2.5 border-b border-slate-100 dark:border-[#31275E]">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[#7045D8]/10 text-[#7045D8] flex items-center justify-center">
                  <User size={16} />
                </div>
                <h3 className="text-sm font-black text-slate-900 dark:text-slate-50">
                  Edit Aspirant Profile
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowEditProfileModal(false)}
                className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-[#241D48] flex items-center justify-center text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveProfile} className="space-y-3.5">
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="Your Name"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#130E26] border border-slate-200 dark:border-[#31275E] text-xs font-medium text-slate-900 dark:text-slate-50 focus:outline-none focus:ring-2 focus:ring-[#7045D8]"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Target Exam
                </label>
                <input
                  type="text"
                  value={editTargetExam}
                  onChange={(e) => setEditTargetExam(e.target.value)}
                  placeholder="e.g. RPSC RAS Pre"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#130E26] border border-slate-200 dark:border-[#31275E] text-xs font-medium text-slate-900 dark:text-slate-50 focus:outline-none focus:ring-2 focus:ring-[#7045D8]"
                />

                <div className="flex flex-wrap gap-1.5 mt-2">
                  {POPULAR_TARGET_EXAMS.slice(0, 4).map((exam) => (
                    <button
                      key={exam}
                      type="button"
                      onClick={() => setEditTargetExam(exam)}
                      className={`text-[10px] font-semibold px-2 py-1 rounded-lg border transition-all cursor-pointer ${
                        editTargetExam === exam
                          ? "bg-[#7045D8] text-white border-[#7045D8]"
                          : "bg-slate-50 dark:bg-[#130E26] border-slate-200 dark:border-[#31275E] text-slate-600 dark:text-slate-300 hover:border-[#7045D8]"
                      }`}
                    >
                      {exam.split(" ")[1] || exam}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Daily Question Goal ({editDailyGoal} Qs)
                </label>
                <input
                  type="range"
                  min="10"
                  max="100"
                  step="5"
                  value={editDailyGoal}
                  onChange={(e) => setEditDailyGoal(Number(e.target.value))}
                  className="w-full accent-[#7045D8]"
                />
                <div className="flex justify-between text-[10px] text-slate-400 mt-0.5">
                  <span>10 Qs</span>
                  <span>50 Qs</span>
                  <span>100 Qs</span>
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowEditProfileModal(false)}
                  className="flex-1 py-2 rounded-xl border border-slate-200 dark:border-[#31275E] text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-[#241D48] transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 rounded-xl bg-[#7045D8] hover:bg-[#5B32BF] text-white text-xs font-bold shadow-xs active:scale-95 transition-all"
                >
                  Save Profile
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* Reset Progress Confirmation Modal */}
      {showResetConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs"
            onClick={() => setShowResetConfirm(false)}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative bg-white dark:bg-[#1B1536] rounded-2xl p-5 w-full max-w-sm border border-rose-200 dark:border-rose-900/40 shadow-2xl space-y-3.5 text-center"
          >
            <div className="w-12 h-12 rounded-xl bg-rose-500/10 text-rose-600 flex items-center justify-center mx-auto">
              <AlertCircle size={24} />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900 dark:text-slate-50">
                Reset Study Progress?
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                This will reset your question attempts, streaks, and analytics. This cannot be undone.
              </p>
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block mb-1">
                Type <span className="text-rose-600 font-bold">RESET</span> to confirm:
              </label>
              <input
                type="text"
                value={resetConfirmText}
                onChange={(e) => setResetConfirmText(e.target.value.toUpperCase())}
                placeholder="RESET"
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#130E26] border border-rose-300 dark:border-rose-800 text-center text-xs font-black text-rose-600 focus:outline-none focus:ring-2 focus:ring-rose-500"
              />
            </div>

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  setShowResetConfirm(false);
                  setResetConfirmText("");
                }}
                className="flex-1 py-2 rounded-xl border border-slate-200 dark:border-[#31275E] text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-[#241D48] transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={resetConfirmText !== "RESET"}
                onClick={() => {
                  if (resetConfirmText === "RESET") {
                    onResetProgress();
                    setShowResetConfirm(false);
                    setResetConfirmText("");
                    showToast("Study progress reset successfully");
                  }
                }}
                className="flex-1 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold shadow-xs active:scale-95 transition-all"
              >
                Confirm Reset
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Clear Cache Modal */}
      {showCacheResetConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs"
            onClick={() => setShowCacheResetConfirm(false)}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative bg-white dark:bg-[#1B1536] rounded-2xl p-5 w-full max-w-sm border border-slate-200 dark:border-[#31275E] shadow-2xl space-y-3.5 text-center"
          >
            <div className="w-12 h-12 rounded-xl bg-[#7045D8]/10 text-[#7045D8] flex items-center justify-center mx-auto">
              <RefreshCw size={24} />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900 dark:text-slate-50">
                Clear Offline Cache?
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Local cached questions will be refreshed from the server.
              </p>
            </div>
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowCacheResetConfirm(false)}
                className="flex-1 py-2 rounded-xl border border-slate-200 dark:border-[#31275E] text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-[#241D48] transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  triggerHaptic("light");
                  safeClearLocalStorage();
                  safeClearSessionStorage();
                  await clearIndexedDB().catch(() => {});
                  setShowCacheResetConfirm(false);
                  showToast("Cache purged. Refreshing...");
                  setTimeout(() => window.location.reload(), 1000);
                }}
                className="flex-1 py-2 rounded-xl bg-[#7045D8] hover:bg-[#5B32BF] text-white text-xs font-bold shadow-xs active:scale-95 transition-all"
              >
                Purge &amp; Refresh
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* About Modal */}
      {showAboutModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs"
            onClick={() => setShowAboutModal(false)}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            role="dialog"
            aria-modal="true"
            aria-label="About Disha PYQ"
            className="relative bg-white dark:bg-[#1B1536] rounded-2xl p-5 w-full max-w-sm border border-slate-200 dark:border-[#31275E] shadow-2xl space-y-3.5"
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-[#31275E]">
              <AppLogo size="sm" variant="horizontal" showTagline={true} />
              <button
                type="button"
                onClick={() => setShowAboutModal(false)}
                className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-[#241D48] flex items-center justify-center text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-2.5 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              <p>
                <strong>Disha PYQ</strong> is a high-yield previous year question practice platform designed for Rajasthan competitive exams.
              </p>

              {/* Mandatory Non-Government Disclaimer */}
              <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-700 dark:text-amber-400 font-medium">
                ⚠️ <strong>Disclaimer:</strong> Disha PYQ is an independent educational app and is not affiliated with or endorsed by RPSC, RSMSSB, or any Rajasthan government agency.
              </div>

              <div className="space-y-1.5 pt-1 text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                <div className="flex items-center gap-2">
                  <Check size={13} className="text-emerald-500 shrink-0" />
                  <span>RPSC 5th Option (Option E) Standard Compliance</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check size={13} className="text-emerald-500 shrink-0" />
                  <span>25+ Years Verified Question Bank &amp; Explanations</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check size={13} className="text-emerald-500 shrink-0" />
                  <span>AI Weakness Analysis &amp; Topic Radar</span>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowAboutModal(false)}
              className="w-full py-2 bg-[#7045D8] hover:bg-[#5B32BF] text-white rounded-xl text-xs font-bold active:scale-95 transition-all"
            >
              Close
            </button>
          </motion.div>
        </div>
      )}

      {/* Delete Account Modal (Google Play Policy Mandate) */}
      <AnimatePresence>
        {showDeleteAccountModal && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-xs"
              onClick={() => setShowDeleteAccountModal(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-sm bg-white dark:bg-[#1B1536] rounded-2xl p-5 shadow-2xl border border-rose-200 dark:border-rose-900/40 z-10 space-y-3.5"
            >
              <div className="w-12 h-12 rounded-xl bg-rose-500/10 text-rose-600 flex items-center justify-center mx-auto">
                <Trash2 size={24} />
              </div>

              <div className="text-center">
                <h3 className="text-base font-black text-slate-900 dark:text-slate-50">
                  Delete Account &amp; Data?
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                  This action is permanent and irreversible. All test attempts, bookmarked questions, and account data will be permanently wiped.
                </p>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">
                  Type <span className="text-rose-600 font-bold">DELETE</span> to confirm:
                </label>
                <input
                  type="text"
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value.toUpperCase())}
                  placeholder="DELETE"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#130E26] border border-slate-200 dark:border-[#31275E] text-slate-900 dark:text-white text-xs font-bold text-center focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowDeleteAccountModal(false)}
                  className="flex-1 py-2 rounded-xl border border-slate-200 dark:border-[#31275E] text-slate-700 dark:text-slate-300 text-xs font-bold hover:bg-slate-50 dark:hover:bg-[#241D48] transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={deleteConfirmText !== "DELETE" || isDeletingAccount}
                  onClick={async () => {
                    setIsDeletingAccount(true);
                    triggerHaptic("medium");
                    try {
                      safeClearLocalStorage();
                      safeClearSessionStorage();
                      await clearIndexedDB().catch(() => {});
                      setToastMessage("Account & data purged");
                      setShowDeleteAccountModal(false);
                      if (onLogout) onLogout();
                      setTimeout(() => {
                        window.location.reload();
                      }, 800);
                    } catch (err) {
                      setToastMessage("Failed to delete all data");
                    } finally {
                      setIsDeletingAccount(false);
                    }
                  }}
                  className="flex-1 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold shadow-xs active:scale-95 transition-all"
                >
                  {isDeletingAccount ? "Deleting..." : "Permanently Delete"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Settings Modal */}
      {showSettingsModal && (
        <AppSettingsModal
          onClose={() => setShowSettingsModal(false)}
          settings={settings}
          onUpdateSettings={onUpdateSettings}
          userProfile={activeProfile}
          onUpdateProfile={(updated) => {
            const merged = { ...activeProfile, ...updated };
            setActiveProfile(merged);
            saveUserProfile(merged);
            onUpdateProfile?.(merged);
          }}
        />
      )}

      {/* API Settings Modal */}
      {showApiSettingsModal && (
        <ApiSettingsModal
          onClose={() => setShowApiSettingsModal(false)}
          settings={settings}
          onUpdateSettings={onUpdateSettings}
        />
      )}

      {/* Share Modal */}
      {shareData && (
        <ShareModal
          isOpen={Boolean(shareData)}
          onClose={() => setShareData(null)}
          data={shareData}
        />
      )}

      {/* Play Store Review Modal (ASO Booster) */}
      <PlayStoreReviewPromptModal
        isOpen={showReviewModal}
        onClose={() => setShowReviewModal(false)}
        appPackageName="com.rajexam.prep"
      />

      {/* Toast Notification */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[150] bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-4 py-2 rounded-xl shadow-xl text-xs font-bold flex items-center gap-2"
          >
            <CheckCircle2 size={14} className="text-emerald-500" />
            <span>{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ProfileTab;
