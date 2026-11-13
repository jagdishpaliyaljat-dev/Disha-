import React, { useMemo } from "react";
import { clearIndexedDB } from "../utils/indexedDbCache";
import {
  ProgressStore,
  AppSettings,
  Question,
  ActiveTab,
  UserProfile,
} from "../types";
import { loadUserProfile, DEFAULT_USER_PROFILE } from "../utils/userProfileStorage";
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
  BookOpen,
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
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import ShareModal, { ShareData } from "./ShareModal";
import { ApiSettingsModal } from "./ApiSettingsModal";
import { AppSettingsModal } from "./AppSettingsModal";
import { AppLogo } from "./AppLogo";

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
}

export const ProfileTab: React.FC<ProfileTabProps> = ({
  user,
  isAuthenticated = false,
  onOpenLogin,
  progressStore,
  settings,
  questions = [],
  onUpdateSettings,
  onUpdateProfile = () => {},
  onResetProgress,
  onNavigateTab,
  onLogout,
}) => {
  const [showResetConfirm, ReactUseStateReset] = React.useState(false);
  const setShowResetConfirm = ReactUseStateReset;
  const [resetConfirmText, setResetConfirmText] = React.useState("");
  const [showCacheResetConfirm, setShowCacheResetConfirm] = React.useState(false);
  const [showSettingsModal, setShowSettingsModal] = React.useState(false);
  const [showApiSettingsModal, setShowApiSettingsModal] = React.useState(false);
  const [showAboutModal, setShowAboutModal] = React.useState(false);
  const [showEditProfileModal, setShowEditProfileModal] = React.useState(false);
  const [toastMessage, setToastMessage] = React.useState<string | null>(null);
  const [shareData, setShareData] = React.useState<ShareData | null>(null);

  const [activeProfile, setActiveProfile] = React.useState<UserProfile>(user || DEFAULT_USER_PROFILE);
  
  React.useEffect(() => {
    if (user) {
      setActiveProfile(user);
    } else {
      const local = loadUserProfile();
      if (local) setActiveProfile(local);
    }
  }, [user]);

  const [editName, setEditName] = React.useState("");
  const [editTargetExam, setEditTargetExam] = React.useState("");

  React.useEffect(() => {
    if (activeProfile) {
      setEditName(activeProfile.name || "");
      setEditTargetExam(activeProfile.targetExam || "");
    }
  }, [activeProfile]);

  const userName = activeProfile?.name || "Scholar";

  const attemptedQuestions = useMemo(() => questions.filter(
    (q) => progressStore[q.id] && progressStore[q.id].status !== "unattempted"
  ), [questions, progressStore]);

  const correctCount = useMemo(() => questions.filter(
    (q) => progressStore[q.id]?.status === "correct"
  ).length, [questions, progressStore]);

  const accuracy = attemptedQuestions.length > 0 ? Math.round((correctCount / attemptedQuestions.length) * 100) : 0;

  const handleShareInvite = () => {
    triggerHaptic("light");
    setShareData({
      title: "Join me on DISHA 20-20 — Exam Prep Platform",
      text: "Hey! I'm preparing for competitive exams (RPSC, RSMSSB, REET, CET, RAS) on DISHA 20-20. Practice topic-wise MCQs, official PYQs, and daily mock tests with instant explanations!",
      url: typeof window !== "undefined" ? window.location.origin : "https://disha2020.in",
      category: "Study Group Invite",
    });
  };

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateProfile?.({
      ...activeProfile,
      name: editName,
      targetExam: editTargetExam
    });
    setShowEditProfileModal(false);
    showToast("Profile updated successfully");
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.05,
        delayChildren: 0.05
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 12 },
    show: { opacity: 1, y: 0 }
  };

  return (
    <div className="flex flex-col h-full bg-[#FFF9EF] dark:bg-[#171923] overflow-y-auto pb-20 selection:bg-[#800020] selection:text-white" id="profile-tab">
      {/* 1. PROFILE HEADER WITH DISHA 20-20 BRAND BAR & SCORECARD */}
      <header className="px-4 pt-4 pb-8 bg-white dark:bg-[#1F2330] border-b border-[#E8D9C0] dark:border-[#31374A] relative overflow-hidden shrink-0">
        {/* Heritage Top Accent Strip */}
        <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-[#800020] via-[#F47B20] to-[#C99A45]" />
        <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-bl from-[#800020]/10 via-[#F47B20]/5 to-transparent rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-20 -left-10 w-48 h-48 bg-[#C99A45]/10 rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-4xl mx-auto relative z-10">
          {/* Top Brand Identity Bar */}
          <div className="flex items-center justify-between gap-2 pb-4 mb-4 border-b border-[#E8D9C0]/70 dark:border-[#31374A]">
            <AppLogo size="sm" variant="horizontal" showTagline={true} />
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  triggerHaptic("light");
                  onUpdateSettings({ darkMode: !settings.darkMode });
                }}
                className="h-9 px-3 rounded-xl bg-[#FFF9EF] dark:bg-[#252A3A] border border-[#E8D9C0] dark:border-[#31374A] flex items-center gap-1.5 text-xs font-extrabold text-[#171923] dark:text-[#FFF9EF] hover:border-[#800020] dark:hover:border-[#F47B20] active:scale-95 transition-all cursor-pointer"
                aria-label="Toggle Theme"
              >
                {settings.darkMode ? (
                  <>
                    <Sun size={15} className="text-[#F47B20]" />
                    <span className="hidden sm:inline">Light</span>
                  </>
                ) : (
                  <>
                    <Moon size={15} className="text-[#800020]" />
                    <span className="hidden sm:inline">Dark</span>
                  </>
                )}
              </button>
              <button 
                onClick={() => {
                  triggerHaptic("light");
                  setShowSettingsModal(true);
                }}
                className="w-9 h-9 rounded-xl bg-[#F7EFE2] dark:bg-[#252A3A] border border-[#E8D9C0] dark:border-[#31374A] flex items-center justify-center text-[#800020] dark:text-[#F47B20] shadow-2xs active:scale-90 transition-all cursor-pointer"
                aria-label="App Settings"
              >
                <Settings size={18} />
              </button>
            </div>
          </div>

          <motion.div 
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col sm:flex-row items-center sm:items-start gap-4 sm:gap-5"
          >
            {/* Avatar with Royal Maroon & Saffron Heritage Ring */}
            <div className="relative shrink-0">
              <div className="w-20 h-20 sm:w-22 sm:h-22 rounded-[26px] p-1 bg-gradient-to-tr from-[#800020] via-[#F47B20] to-[#C99A45] shadow-md">
                <div className="w-full h-full rounded-[22px] border-2 border-white dark:border-[#1F2330] overflow-hidden bg-[#FFF9EF] dark:bg-[#171923]">
                  <img 
                    src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${userName}&backgroundColor=ffdfbf,ffd5dc,c0aede`} 
                    alt="Aspirant Avatar" 
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>
              <button 
                onClick={() => {
                  if (!isAuthenticated) {
                    onOpenLogin?.();
                    return;
                  }
                  triggerHaptic("light");
                  setShowEditProfileModal(true);
                }}
                className="absolute -bottom-1.5 -right-1.5 w-8 h-8 rounded-xl bg-[#800020] dark:bg-[#F47B20] text-white flex items-center justify-center shadow-md border-2 border-white dark:border-[#1F2330] active:scale-90 transition-transform cursor-pointer"
                aria-label="Edit Profile"
              >
                <Edit2 size={13} />
              </button>
            </div>
            
            {/* Aspirant Identity Details */}
            <div className="flex-1 text-center sm:text-left min-w-0">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-[#800020]/10 dark:bg-[#F47B20]/15 text-[#800020] dark:text-[#F47B20] text-[10px] font-black uppercase tracking-wider mb-1">
                <Award size={12} />
                <span>DISHA 20-20 Aspirant</span>
                <span>•</span>
                <span className="font-mono tabular-nums">LVL {Math.floor(attemptedQuestions.length / 50) + 1}</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-[#171923] dark:text-[#FFF9EF] tracking-tight truncate">
                {!isAuthenticated ? "Guest Aspirant" : userName}
              </h2>
              <p className="text-xs font-bold text-[#52576A] dark:text-[#CBD2E1] mt-0.5 truncate">
                {!isAuthenticated
                  ? "RPSC • RSMSSB • REET • CET • RAS Exam Preparation"
                  : (activeProfile?.targetExam || "Competitive Exam Aspirant")}
              </p>

              {/* Action Buttons */}
              <div className="mt-3 flex flex-wrap items-center justify-center sm:justify-start gap-2">
                {!isAuthenticated ? (
                  <button
                    onClick={onOpenLogin}
                    className="px-4 py-2 bg-[#800020] hover:bg-[#5E0017] dark:bg-[#F47B20] dark:hover:bg-[#E06A12] text-white rounded-xl text-xs font-black shadow-sm transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer"
                  >
                    <LogIn size={14} />
                    <span>Sign In to Sync</span>
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      triggerHaptic("light");
                      setShowEditProfileModal(true);
                    }}
                    className="px-3.5 py-1.5 bg-[#FFF9EF] dark:bg-[#252A3A] hover:border-[#800020] dark:hover:border-[#F47B20] text-[#171923] dark:text-[#FFF9EF] border border-[#E8D9C0] dark:border-[#31374A] rounded-xl text-xs font-extrabold transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer"
                  >
                    <Edit2 size={12} className="text-[#800020] dark:text-[#F47B20]" />
                    <span>Edit Profile</span>
                  </button>
                )}
              </div>
            </div>
          </motion.div>

          {/* 3-Column Aspirant Performance Scorecard */}
          <div className="grid grid-cols-3 gap-2.5 mt-5 pt-4 border-t border-[#E8D9C0]/70 dark:border-[#31374A]">
            <div className="bg-[#FFF9EF] dark:bg-[#171923] border border-[#E8D9C0] dark:border-[#31374A] rounded-2xl p-3 text-center">
              <div className="flex items-center justify-center gap-1 text-[#800020] dark:text-[#F47B20] mb-0.5">
                <Target size={13} />
                <span className="text-[10px] font-black uppercase tracking-wider">Attempted</span>
              </div>
              <div className="text-lg sm:text-xl font-black text-[#171923] dark:text-[#FFF9EF] font-mono tabular-nums">
                {attemptedQuestions.length}
              </div>
              <div className="text-[10px] font-semibold text-[#52576A] dark:text-[#CBD2E1]">
                Solved Questions
              </div>
            </div>

            <div className="bg-[#FFF9EF] dark:bg-[#171923] border border-[#E8D9C0] dark:border-[#31374A] rounded-2xl p-3 text-center">
              <div className="flex items-center justify-center gap-1 text-[#15803D] dark:text-emerald-400 mb-0.5">
                <CheckCircle2 size={13} />
                <span className="text-[10px] font-black uppercase tracking-wider">Correct</span>
              </div>
              <div className="text-lg sm:text-xl font-black text-[#15803D] dark:text-emerald-400 font-mono tabular-nums">
                {correctCount}
              </div>
              <div className="text-[10px] font-semibold text-[#52576A] dark:text-[#CBD2E1]">
                Correct Answers
              </div>
            </div>

            <div className="bg-[#FFF9EF] dark:bg-[#171923] border border-[#E8D9C0] dark:border-[#31374A] rounded-2xl p-3 text-center">
              <div className="flex items-center justify-center gap-1 text-[#C99A45] mb-0.5">
                <Award size={13} />
                <span className="text-[10px] font-black uppercase tracking-wider">Accuracy</span>
              </div>
              <div className="text-lg sm:text-xl font-black text-[#171923] dark:text-[#FFF9EF] font-mono tabular-nums">
                {accuracy}%
              </div>
              <div className="text-[10px] font-semibold text-[#52576A] dark:text-[#CBD2E1]">
                Accuracy Rate
              </div>
            </div>
          </div>
        </div>
      </header>

      <motion.main 
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="px-4 pt-5 space-y-5 relative z-20 max-w-4xl mx-auto w-full"
      >
        {/* 2. ASPIRANT TOOLKIT & PREFERENCES */}
        <motion.section variants={itemVariants} className="space-y-2.5">
          <h3 className="text-[11px] font-black text-[#52576A] dark:text-[#CBD2E1] uppercase tracking-[0.16em] px-1">
            Aspirant Toolkit
          </h3>
          <div className="bg-white dark:bg-[#1F2330] rounded-[24px] border border-[#E8D9C0] dark:border-[#31374A] shadow-2xs overflow-hidden divide-y divide-[#E8D9C0]/60 dark:divide-[#31374A]">
            {/* App & Practice Settings */}
            <button 
              onClick={() => {
                triggerHaptic("light");
                setShowSettingsModal(true);
              }}
              className="w-full flex items-center justify-between p-4 hover:bg-[#FFF9EF] dark:hover:bg-[#252A3A]/60 transition-colors group cursor-pointer"
            >
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-[#800020]/10 dark:bg-[#F47B20]/15 text-[#800020] dark:text-[#F47B20] flex items-center justify-center shadow-2xs">
                  <Settings size={19} />
                </div>
                <div className="text-left min-w-0 flex-1">
                  <span className="text-sm font-black text-[#171923] dark:text-[#FFF9EF] block truncate">
                    Practice & Display Settings
                  </span>
                  <span className="text-[10px] text-[#52576A] dark:text-[#CBD2E1] font-bold uppercase tracking-wider mt-0.5 block truncate tabular-nums">
                    Daily Goal: {settings.dailyGoal || 20} MCQs • Sound & Haptics
                  </span>
                </div>
              </div>
              <ChevronRight size={18} className="text-[#787D91] group-hover:text-[#800020] dark:group-hover:text-[#F47B20] transition-colors" />
            </button>

            {/* AI Settings */}
            <button 
              onClick={() => {
                triggerHaptic("light");
                setShowApiSettingsModal(true);
              }}
              className="w-full flex items-center justify-between p-4 hover:bg-[#FFF9EF] dark:hover:bg-[#252A3A]/60 transition-colors group cursor-pointer"
            >
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-[#C99A45]/15 text-[#C99A45] flex items-center justify-center shadow-2xs">
                  <Sparkles size={19} />
                </div>
                <div className="text-left min-w-0 flex-1">
                  <span className="text-sm font-black text-[#171923] dark:text-[#FFF9EF] block truncate">
                    Study Assistant Preferences
                  </span>
                  <span className="text-[10px] text-[#52576A] dark:text-[#CBD2E1] font-bold uppercase tracking-wider mt-0.5 block truncate">
                    {settings.aiMode === "personal_keys" ? "Personal Keys Active" : "DISHA 20-20 Default Active"}
                  </span>
                </div>
              </div>
              <ChevronRight size={18} className="text-[#787D91] group-hover:text-[#800020] dark:group-hover:text-[#F47B20] transition-colors" />
            </button>

            {/* Share App */}
            <button 
              onClick={handleShareInvite}
              className="w-full flex items-center justify-between p-4 hover:bg-[#FFF9EF] dark:hover:bg-[#252A3A]/60 transition-colors group cursor-pointer"
            >
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-[#F47B20]/15 text-[#F47B20] flex items-center justify-center shadow-2xs">
                  <Share2 size={19} />
                </div>
                <div className="text-left">
                  <span className="text-sm font-black text-[#171923] dark:text-[#FFF9EF] block">
                    Invite Fellow Aspirants
                  </span>
                  <span className="text-[10px] text-[#52576A] dark:text-[#CBD2E1] font-bold uppercase tracking-widest mt-0.5 block">
                    Share DISHA 20-20 on WhatsApp & Telegram
                  </span>
                </div>
              </div>
              <ChevronRight size={18} className="text-[#787D91] group-hover:text-[#800020] dark:group-hover:text-[#F47B20] transition-colors" />
            </button>
          </div>
        </motion.section>

        {/* 4. COMMUNITY & LEGAL GRID */}
        <motion.section variants={itemVariants} className="space-y-2.5">
          <h3 className="text-[10px] font-black text-[#52576A] dark:text-[#CBD2E1] uppercase tracking-[0.2em] px-1">
            Support & Platform Info
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {[
              { label: "Community", sub: "Telegram Hub", icon: Send, color: "text-[#800020] dark:text-[#F47B20]", bg: "bg-[#800020]/10 dark:bg-[#F47B20]/15", action: () => window.open("https://t.me/disha2020_official", "_blank") },
              { label: "Help Center", sub: "Contact Us", icon: Mail, color: "text-[#F47B20]", bg: "bg-[#F47B20]/15", action: () => onNavigateTab?.("contact") },
              { label: "About DISHA", sub: "Our Mission", icon: Info, color: "text-[#C99A45]", bg: "bg-[#C99A45]/15", action: () => setShowAboutModal(true) },
              { label: "Legal", sub: "Privacy & Terms", icon: Shield, color: "text-[#15803D] dark:text-emerald-400", bg: "bg-[#15803D]/10", action: () => onNavigateTab?.("privacy-policy") },
            ].map((item, i) => (
              <button
                key={i}
                onClick={item.action}
                className="bg-white dark:bg-[#1F2330] border border-[#E8D9C0] dark:border-[#31374A] p-3.5 rounded-[20px] flex flex-col items-center text-center gap-2 shadow-2xs hover:border-[#800020] dark:hover:border-[#F47B20] active:scale-95 transition-all cursor-pointer group"
              >
                <div className={`w-9 h-9 rounded-xl ${item.bg} ${item.color} flex items-center justify-center group-hover:scale-105 transition-transform shrink-0`}>
                  <item.icon size={17} />
                </div>
                <div className="min-w-0 w-full px-0.5">
                  <span className="text-[10px] font-black text-[#171923] dark:text-[#FFF9EF] block truncate uppercase tracking-wider">{item.label}</span>
                  <span className="text-[8.5px] font-bold text-[#787D91] dark:text-[#929AB0] block truncate uppercase tracking-wider">{item.sub}</span>
                </div>
              </button>
            ))}
          </div>
        </motion.section>

        {/* 5. SYSTEM ACTIONS */}
        <motion.section variants={itemVariants} className="pt-1">
          <div className="bg-[#F7EFE2] dark:bg-[#1F2330] rounded-[24px] p-2 space-y-1 border border-[#E8D9C0] dark:border-[#31374A]">
            <button 
              onClick={() => setShowResetConfirm(true)}
              className="w-full flex items-center justify-between p-3.5 hover:bg-white dark:hover:bg-[#252A3A] rounded-2xl transition-all group cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-[#DC2626]/10 text-[#DC2626] flex items-center justify-center">
                  <RotateCcw size={16} />
                </div>
                <span className="text-xs font-bold text-[#DC2626] dark:rose-400">Reset All Study Progress</span>
              </div>
              <ChevronRight size={14} className="text-[#DC2626]/60" />
            </button>

            <button 
              onClick={() => setShowCacheResetConfirm(true)}
              className="w-full flex items-center justify-between p-3.5 hover:bg-white dark:hover:bg-[#252A3A] rounded-2xl transition-all group cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-white dark:bg-[#252A3A] text-[#52576A] dark:text-[#CBD2E1] flex items-center justify-center border border-[#E8D9C0] dark:border-[#31374A]">
                  <RefreshCw size={16} />
                </div>
                <span className="text-xs font-bold text-[#52576A] dark:text-[#CBD2E1]">Clear App Cache & Sync</span>
              </div>
              <ChevronRight size={14} className="text-[#787D91]" />
            </button>

            {isAuthenticated && (
              <button 
                onClick={onLogout}
                className="w-full flex items-center justify-between p-3.5 hover:bg-white dark:hover:bg-[#252A3A] rounded-2xl transition-all group cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-[#800020] text-white flex items-center justify-center">
                    <LogOut size={16} />
                  </div>
                  <span className="text-xs font-bold text-[#171923] dark:text-[#FFF9EF]">Logout Current Session</span>
                </div>
                <ChevronRight size={14} className="text-[#787D91]" />
              </button>
            )}
          </div>
        </motion.section>

        <motion.section variants={itemVariants} className="text-center pt-2 pb-4">
          <p className="text-[10px] font-black text-[#800020] dark:text-[#C99A45] uppercase tracking-[0.22em]">
            DISHA 20-20 • दिशा 20-20 • सही दिशा, सटीक तैयारी
          </p>
        </motion.section>
      </motion.main>

      {/* MODALS */}
      
      {/* Reset Confirmation */}
      {showResetConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
          <div className="fixed inset-0 bg-[#171923]/80 backdrop-blur-sm" onClick={() => setShowResetConfirm(false)} />
          <motion.div 
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative bg-white dark:bg-[#1F2330] rounded-[32px] p-7 w-full max-w-sm border border-[#E8D9C0] dark:border-[#31374A] shadow-2xl"
          >
            <div className="w-16 h-16 rounded-2xl bg-[#DC2626]/10 text-[#DC2626] flex items-center justify-center mx-auto mb-5">
              <AlertCircle size={32} />
            </div>
            <h3 className="text-xl font-black text-[#171923] dark:text-[#FFF9EF] text-center tracking-tight">Hard Reset?</h3>
            <p className="text-[13px] text-[#52576A] dark:text-[#CBD2E1] text-center mt-2.5 leading-relaxed font-medium">
              This will permanently clear all your test attempts and statistics. This action cannot be reversed.
            </p>
            
            <div className="mt-5 space-y-2">
              <label className="text-[10px] font-black text-[#787D91] dark:text-[#929AB0] uppercase tracking-widest block text-center">Type "RESET" to confirm</label>
              <input 
                type="text"
                value={resetConfirmText}
                onChange={(e) => setResetConfirmText(e.target.value.toUpperCase())}
                placeholder="RESET"
                className="w-full px-4 py-3 rounded-xl bg-[#FFF9EF] dark:bg-[#171923] border border-[#E8D9C0] dark:border-[#31374A] text-center text-sm font-black text-[#DC2626] focus:outline-none focus:ring-2 focus:ring-[#DC2626]/25"
              />
            </div>

            <div className="grid grid-cols-2 gap-3 mt-7">
              <button 
                onClick={() => {
                  setShowResetConfirm(false);
                  setResetConfirmText("");
                }}
                className="py-3.5 rounded-2xl bg-[#F7EFE2] dark:bg-[#252A3A] border border-[#E8D9C0] dark:border-[#31374A] text-xs font-black uppercase tracking-widest text-[#52576A] dark:text-[#CBD2E1] active:scale-95 transition-transform cursor-pointer"
              >
                Cancel
              </button>
              <button 
                onClick={() => {
                  if (resetConfirmText === "RESET") {
                    onResetProgress();
                    setShowResetConfirm(false);
                    setResetConfirmText("");
                    showToast("Progress reset successfully.");
                  }
                }}
                disabled={resetConfirmText !== "RESET"}
                className={`py-3.5 rounded-2xl text-white text-xs font-black uppercase tracking-widest shadow-lg transition-all active:scale-95 ${
                  resetConfirmText === "RESET" 
                    ? "bg-[#DC2626] shadow-[#DC2626]/25 cursor-pointer" 
                    : "bg-[#E8D9C0] dark:bg-[#31374A] text-[#787D91] cursor-not-allowed shadow-none"
                }`}
              >
                Confirm
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Cache Reset Confirmation */}
      {showCacheResetConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
          <div className="fixed inset-0 bg-[#171923]/80 backdrop-blur-sm" onClick={() => setShowCacheResetConfirm(false)} />
          <motion.div 
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative bg-white dark:bg-[#1F2330] rounded-[32px] p-7 w-full max-w-sm border border-[#E8D9C0] dark:border-[#31374A] shadow-2xl"
          >
            <div className="w-16 h-16 rounded-2xl bg-[#F47B20]/15 text-[#F47B20] flex items-center justify-center mx-auto mb-5">
              <RefreshCw size={32} />
            </div>
            <h3 className="text-xl font-black text-[#171923] dark:text-[#FFF9EF] text-center tracking-tight">Purge Cache?</h3>
            <p className="text-[13px] text-[#52576A] dark:text-[#CBD2E1] text-center mt-2.5 leading-relaxed font-medium">
              This will clear local session data and force a full synchronization. You may need to sign in again.
            </p>
            <div className="grid grid-cols-2 gap-3 mt-8">
              <button 
                onClick={() => setShowCacheResetConfirm(false)}
                className="py-3.5 rounded-2xl bg-[#F7EFE2] dark:bg-[#252A3A] border border-[#E8D9C0] dark:border-[#31374A] text-xs font-black uppercase tracking-widest text-[#52576A] dark:text-[#CBD2E1] active:scale-95 transition-transform cursor-pointer"
              >
                Cancel
              </button>
              <button 
                onClick={async () => {
                  triggerHaptic("light");
                  localStorage.clear();
                  sessionStorage.clear();
                  await clearIndexedDB().catch(() => {});
                  setShowCacheResetConfirm(false);
                  showToast("System cache purged. Reloading...");
                  setTimeout(() => window.location.reload(), 1200);
                }}
                className="py-3.5 rounded-2xl bg-[#F47B20] hover:bg-[#E06A12] text-white text-xs font-black uppercase tracking-widest shadow-lg shadow-[#F47B20]/25 active:scale-95 transition-transform cursor-pointer"
              >
                Yes, Purge
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Edit Profile Modal */}
      {showEditProfileModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
          <div className="fixed inset-0 bg-[#171923]/80 backdrop-blur-sm" onClick={() => setShowEditProfileModal(false)} />
          <motion.div 
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative bg-white dark:bg-[#1F2330] rounded-[32px] p-7 w-full max-w-sm border border-[#E8D9C0] dark:border-[#31374A] shadow-2xl"
          >
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3.5">
                <div className="w-11 h-11 rounded-2xl bg-[#800020]/10 dark:bg-[#F47B20]/15 text-[#800020] dark:text-[#F47B20] flex items-center justify-center">
                  <User size={22} />
                </div>
                <div>
                  <h3 className="text-lg font-black text-[#171923] dark:text-[#FFF9EF]">Aspirant Profile</h3>
                  <p className="text-[10px] font-bold text-[#787D91] dark:text-[#929AB0] uppercase tracking-widest">Update Identity</p>
                </div>
              </div>
              <button onClick={() => setShowEditProfileModal(false)} className="w-9 h-9 rounded-full bg-[#F7EFE2] dark:bg-[#252A3A] flex items-center justify-center text-[#52576A] dark:text-[#CBD2E1] cursor-pointer">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveProfile} className="space-y-5">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-[#52576A] dark:text-[#CBD2E1] uppercase tracking-[0.18em] block ml-1">Full Name</label>
                <input 
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-4 py-3.5 rounded-2xl bg-[#FFF9EF] dark:bg-[#171923] border border-[#E8D9C0] dark:border-[#31374A] text-sm font-bold text-[#171923] dark:text-[#FFF9EF] focus:outline-none focus:ring-2 focus:ring-[#800020] dark:focus:ring-[#F47B20] transition-all"
                  placeholder="Enter your name"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-[#52576A] dark:text-[#CBD2E1] uppercase tracking-[0.18em] block ml-1">Target Exam</label>
                <input 
                  type="text"
                  required
                  value={editTargetExam}
                  onChange={(e) => setEditTargetExam(e.target.value)}
                  className="w-full px-4 py-3.5 rounded-2xl bg-[#FFF9EF] dark:bg-[#171923] border border-[#E8D9C0] dark:border-[#31374A] text-sm font-bold text-[#171923] dark:text-[#FFF9EF] focus:outline-none focus:ring-2 focus:ring-[#800020] dark:focus:ring-[#F47B20] transition-all"
                  placeholder="e.g. RPSC RAS / REET / CET / RSMSSB"
                />
              </div>

              <button 
                type="submit"
                className="w-full py-3.5 bg-[#800020] hover:bg-[#5E0017] dark:bg-[#F47B20] dark:hover:bg-[#E06A12] text-white rounded-2xl text-[11px] font-black uppercase tracking-[0.18em] shadow-lg shadow-[#800020]/20 mt-2 active:scale-95 transition-transform cursor-pointer"
              >
                Save Changes
              </button>
            </form>
          </motion.div>
        </div>
      )}

      {/* About Modal */}
      {showAboutModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
          <div className="fixed inset-0 bg-[#171923]/80 backdrop-blur-sm" onClick={() => setShowAboutModal(false)} />
          <motion.div 
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative bg-white dark:bg-[#1F2330] rounded-[32px] p-7 w-full max-w-sm border border-[#E8D9C0] dark:border-[#31374A] shadow-2xl overflow-hidden"
          >
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-6">
                <AppLogo size="sm" variant="horizontal" showTagline={true} />
                <button onClick={() => setShowAboutModal(false)} className="w-9 h-9 rounded-full bg-[#F7EFE2] dark:bg-[#252A3A] flex items-center justify-center text-[#52576A] dark:text-[#CBD2E1] cursor-pointer">
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-4 text-sm text-[#52576A] dark:text-[#CBD2E1] leading-relaxed font-medium">
                <p>DISHA 20-20 is a competitive-exam preparation platform designed to help aspirants master RPSC, RSMSSB, REET, CET, and RAS exams through topic-wise MCQs, PYQs, and spaced revision.</p>
                
                <div className="space-y-2.5 bg-[#FFF9EF] dark:bg-[#171923] p-4 rounded-2xl border border-[#E8D9C0] dark:border-[#31374A]">
                  <div className="flex items-center gap-3 text-[#800020] dark:text-[#F47B20]">
                    <div className="w-6 h-6 rounded-lg bg-[#800020]/10 dark:bg-[#F47B20]/15 flex items-center justify-center">
                      <Check size={14} className="stroke-[3]" />
                    </div>
                    <span className="text-xs font-black uppercase tracking-wider">Cloud Synced Progress</span>
                  </div>
                  <div className="flex items-center gap-3 text-[#800020] dark:text-[#F47B20]">
                    <div className="w-6 h-6 rounded-lg bg-[#800020]/10 dark:bg-[#F47B20]/15 flex items-center justify-center">
                      <Check size={14} className="stroke-[3]" />
                    </div>
                    <span className="text-xs font-black uppercase tracking-wider">Rajasthan PYQ Vault</span>
                  </div>
                  <div className="flex items-center gap-3 text-[#800020] dark:text-[#F47B20]">
                    <div className="w-6 h-6 rounded-lg bg-[#800020]/10 dark:bg-[#F47B20]/15 flex items-center justify-center">
                      <Check size={14} className="stroke-[3]" />
                    </div>
                    <span className="text-xs font-black uppercase tracking-wider">Leitner Spaced Revision</span>
                  </div>
                </div>
              </div>

              <button 
                onClick={() => setShowAboutModal(false)}
                className="w-full py-3.5 bg-[#800020] hover:bg-[#5E0017] dark:bg-[#F47B20] dark:hover:bg-[#E06A12] text-white rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] mt-6 active:scale-95 transition-transform cursor-pointer"
              >
                Return to Hub
              </button>
            </div>
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

      {shareData && (
        <ShareModal
          isOpen={!!shareData}
          onClose={() => setShareData(null)}
          data={shareData}
        />
      )}

      <AnimatePresence>
        {toastMessage && (
          <motion.div 
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[150] bg-[#800020] dark:bg-[#F47B20] text-white px-6 py-3.5 rounded-2xl shadow-2xl text-xs font-black uppercase tracking-widest border border-white/15"
          >
            {toastMessage}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ProfileTab;
