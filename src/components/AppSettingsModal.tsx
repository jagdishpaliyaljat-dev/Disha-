import React, { useState, useEffect } from "react";
import { AppSettings, UserProfile, ActiveTab } from "../types";
import {
  X,
  Shuffle,
  Volume2,
  Smartphone,
  Moon,
  Sun,
  Type,
  Sparkles,
  Zap,
  Eye,
  Database,
  Download,
  Upload,
  User,
  Target,
  Check,
  Crown,
  ShieldCheck,
  CheckCircle2,
  SlidersHorizontal,
  ChevronDown,
  ChevronRight,
  Shield,
  FileText,
  AlertCircle,
  Mail,
  Info,
} from "lucide-react";
import {
  exportStudentBackupToFile,
  restoreStudentBackupFromJSON,
} from "../utils/studentBackupService";
import {
  playCorrectSound,
  playClickSound,
  triggerHaptic,
} from "../utils/audioFeedback";
import { AppLogo } from "./AppLogo";

export const POPULAR_TARGET_EXAMS = [
  "RPSC RAS (Prelims & Mains)",
  "RPSC Sub Inspector (SI)",
  "RSMSSB CET (Graduate / 12th)",
  "REET (Level 1 & 2)",
  "Rajasthan Patwar",
  "RPSC 1st & 2nd Grade Teacher",
  "RPSC Assistant Professor",
  "Rajasthan Police Constable",
];

export interface AppSettingsModalProps {
  settings: AppSettings;
  onUpdateSettings: (newSettings: Partial<AppSettings>) => void;
  onClose: () => void;
  userProfile?: UserProfile | null;
  onUpdateProfile?: (updated: Partial<UserProfile>) => void;
  initialTab?: "all" | "profile" | "display" | "practice" | "ai" | "backup" | "legal";
  onNavigateTab?: (tab: ActiveTab) => void;
  onOpenAbout?: () => void;
}

export const AppSettingsModal: React.FC<AppSettingsModalProps> = ({
  settings,
  onUpdateSettings,
  onClose,
  userProfile,
  onUpdateProfile,
  initialTab = "all",
  onNavigateTab,
  onOpenAbout,
}) => {
  const [activeTab, setActiveTab] = useState<"all" | "profile" | "display" | "practice" | "ai" | "backup" | "legal">(initialTab);
  const [backupNotice, setBackupNotice] = useState<string | null>(null);
  const [isLegalExpanded, setIsLegalExpanded] = useState(initialTab === "legal");

  // Profile Edit State
  const [nameInput, setNameInput] = useState(userProfile?.name || "");
  const [targetExamInput, setTargetExamInput] = useState(userProfile?.targetExam || "RPSC RAS (Prelims & Mains)");
  const [profileSavedNotice, setProfileSavedNotice] = useState(false);

  useEffect(() => {
    if (activeTab === "legal") {
      setIsLegalExpanded(true);
    }
  }, [activeTab]);

  useEffect(() => {
    if (userProfile?.name) setNameInput(userProfile.name);
    if (userProfile?.targetExam) setTargetExamInput(userProfile.targetExam);
  }, [userProfile]);

  const toggleSetting = (key: keyof AppSettings) => {
    const newVal = !settings[key];
    onUpdateSettings({ [key]: newVal });
    playClickSound(settings.soundEffects !== false);
    triggerHaptic("light", settings.hapticFeedback !== false);
  };

  const updateSetting = (newPartial: Partial<AppSettings>) => {
    onUpdateSettings(newPartial);
    playClickSound(settings.soundEffects !== false);
    triggerHaptic("light", settings.hapticFeedback !== false);
  };

  const handleSaveProfile = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!nameInput.trim()) return;

    if (onUpdateProfile) {
      onUpdateProfile({
        name: nameInput.trim(),
        targetExam: targetExamInput.trim(),
      });
    }

    triggerHaptic("medium", settings.hapticFeedback !== false);
    setProfileSavedNotice(true);
    setTimeout(() => setProfileSavedNotice(false), 2500);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
      <div className="fixed inset-0 bg-[#0F0B1E]/80 backdrop-blur-sm" onClick={onClose} />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Disha PYQ Settings"
        className="relative w-full max-w-xl bg-[#F8FAFC] dark:bg-[#130E26] border border-slate-200 dark:border-[#31275E] rounded-t-[32px] sm:rounded-[32px] shadow-2xl overflow-hidden flex flex-col max-h-[92vh] sm:max-h-[88vh] animate-in slide-in-from-bottom duration-300"
      >
        {/* Top Heritage Accent */}
        <div className="h-1.5 w-full bg-gradient-to-r from-[#7045D8] via-[#8B5CF6] to-[#A78BFA] shrink-0" />

        {/* Header */}
        <header className="px-5 sm:px-6 pt-5 pb-4 bg-white dark:bg-[#1B1536] border-b border-slate-200 dark:border-[#31275E] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <AppLogo size="sm" variant="icon" />
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-slate-50 tracking-tight">
                  Disha PYQ Settings
                </h3>
                <span className="px-2 py-0.5 rounded-full bg-[#7045D8]/10 text-[#7045D8] dark:text-[#A78BFA] text-[10px] font-black uppercase tracking-wider">
                  Preferences
                </span>
              </div>
              <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 mt-0.5">
                प्रोफ़ाइल, अभ्यास व ऐप नियंत्रण
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close settings"
            className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-[#241D48] border border-slate-200 dark:border-[#31275E] flex items-center justify-center text-slate-600 dark:text-slate-300 hover:text-[#7045D8] dark:hover:text-[#A78BFA] transition-colors cursor-pointer shrink-0 active:scale-95"
          >
            <X size={18} />
          </button>
        </header>

        {/* Quick Filter Navigation Tabs */}
        <div className="px-4 sm:px-6 py-2.5 bg-slate-100/70 dark:bg-[#171329] border-b border-slate-200 dark:border-[#31275E] flex items-center gap-1.5 overflow-x-auto scrollbar-none shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab("all")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
              activeTab === "all"
                ? "bg-[#7045D8] text-white shadow-xs"
                : "bg-white dark:bg-[#1B1536] text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-[#31275E] hover:border-[#7045D8]"
            }`}
          >
            All Settings
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("profile")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === "profile"
                ? "bg-[#7045D8] text-white shadow-xs"
                : "bg-white dark:bg-[#1B1536] text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-[#31275E] hover:border-[#7045D8]"
            }`}
          >
            <User size={13} />
            <span>Profile &amp; Exam</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("display")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === "display"
                ? "bg-[#7045D8] text-white shadow-xs"
                : "bg-white dark:bg-[#1B1536] text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-[#31275E] hover:border-[#7045D8]"
            }`}
          >
            <Moon size={13} />
            <span>Display &amp; Night</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("practice")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === "practice"
                ? "bg-[#7045D8] text-white shadow-xs"
                : "bg-white dark:bg-[#1B1536] text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-[#31275E] hover:border-[#7045D8]"
            }`}
          >
            <Zap size={13} />
            <span>Practice</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("ai")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === "ai"
                ? "bg-[#7045D8] text-white shadow-xs"
                : "bg-white dark:bg-[#1B1536] text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-[#31275E] hover:border-[#7045D8]"
            }`}
          >
            <Sparkles size={13} />
            <span>AI Tutor</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("backup")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === "backup"
                ? "bg-[#7045D8] text-white shadow-xs"
                : "bg-white dark:bg-[#1B1536] text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-[#31275E] hover:border-[#7045D8]"
            }`}
          >
            <Database size={13} />
            <span>Backup</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("legal")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === "legal"
                ? "bg-[#7045D8] text-white shadow-xs"
                : "bg-white dark:bg-[#1B1536] text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-[#31275E] hover:border-[#7045D8]"
            }`}
          >
            <ShieldCheck size={13} />
            <span>Legal &amp; Policy</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-5 space-y-6 pb-6">

          {/* ─────────────────────────────────────────────────────────────
              SECTION 1: PROFILE & TARGET EXAM
          ───────────────────────────────────────────────────────────── */}
          {(activeTab === "all" || activeTab === "profile") && (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between px-1">
                <h4 className="text-[11px] font-black text-[#7045D8] dark:text-[#A78BFA] uppercase tracking-[0.18em] flex items-center gap-1.5">
                  <User size={13} />
                  <span>Profile &amp; Target Exam (प्रोफ़ाइल व परीक्षा लक्ष्य)</span>
                </h4>
                {profileSavedNotice && (
                  <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1 animate-in fade-in">
                    <CheckCircle2 size={12} />
                    <span>Saved!</span>
                  </span>
                )}
              </div>

              <div className="bg-white dark:bg-[#1B1536] rounded-2xl border border-slate-200 dark:border-[#31275E] shadow-2xs p-4 sm:p-5 space-y-4">
                {/* Account Header Badge */}
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-[#31275E]/60">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#7045D8] to-[#A78BFA] text-white flex items-center justify-center font-black text-sm shrink-0 shadow-2xs">
                      {nameInput.trim() ? nameInput.trim().charAt(0).toUpperCase() : "A"}
                    </div>
                    <div className="min-w-0">
                      <span className="text-xs font-black text-slate-900 dark:text-slate-100 truncate block">
                        {nameInput || "Aspirant"}
                      </span>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400 truncate block">
                        {userProfile?.email || "Guest Mode (Local)"}
                      </span>
                    </div>
                  </div>

                  <div className="shrink-0">
                    {userProfile?.role === "admin" ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#7045D8]/10 text-[#7045D8] dark:text-[#A78BFA] text-[10px] font-black uppercase tracking-wider border border-[#7045D8]/20">
                        <Crown size={11} className="text-amber-500" />
                        <span>Admin</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-[10px] font-black uppercase tracking-wider border border-emerald-500/20">
                        <ShieldCheck size={11} />
                        <span>Active Aspirant</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Name Input */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-200 block">
                    Full Name (आपका नाम)
                  </label>
                  <input
                    type="text"
                    value={nameInput}
                    onChange={(e) => setNameInput(e.target.value)}
                    placeholder="Enter your name"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-[#31275E] bg-slate-50 dark:bg-[#130E26] text-slate-900 dark:text-slate-50 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#7045D8] dark:focus:ring-[#A78BFA]"
                  />
                </div>

                {/* Target Exam */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-200 block">
                      Target Exam (मुख्य लक्ष्य परीक्षा)
                    </label>
                    <span className="text-[10px] font-bold text-[#7045D8] dark:text-[#A78BFA]">
                      {targetExamInput}
                    </span>
                  </div>

                  {/* Popular Exam Chips */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                    {POPULAR_TARGET_EXAMS.map((exam) => {
                      const isSelected = targetExamInput === exam;
                      return (
                        <button
                          key={exam}
                          type="button"
                          onClick={() => {
                            setTargetExamInput(exam);
                            triggerHaptic("light");
                          }}
                          className={`p-2 rounded-xl text-left border transition-all cursor-pointer ${
                            isSelected
                              ? "bg-[#7045D8] text-white border-[#7045D8] shadow-xs"
                              : "bg-slate-50 dark:bg-[#130E26] border-slate-200 dark:border-[#31275E] text-slate-700 dark:text-slate-300 hover:border-[#7045D8]"
                          }`}
                        >
                          <span className="text-[11px] font-bold block truncate leading-tight">
                            {exam.split(" (")[0] || exam}
                          </span>
                          <span className={`text-[9px] block truncate opacity-75 mt-0.5 ${isSelected ? "text-white" : "text-slate-400"}`}>
                            {exam.includes("(") ? exam.match(/\((.*?)\)/)?.[1] || "Rajasthan" : "Rajasthan"}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Custom Exam Input */}
                  <div className="pt-1">
                    <input
                      type="text"
                      value={targetExamInput}
                      onChange={(e) => setTargetExamInput(e.target.value)}
                      placeholder="Or enter custom exam name (e.g. RSSB VDO, Junior Accountant)"
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-[#31275E] bg-slate-50 dark:bg-[#130E26] text-slate-900 dark:text-slate-50 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#7045D8]"
                    />
                  </div>
                </div>

                {/* Save Profile Button */}
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={() => handleSaveProfile()}
                    className="w-full py-2.5 px-4 rounded-xl bg-[#7045D8] hover:bg-[#5B32BF] text-white text-xs font-bold flex items-center justify-center gap-2 shadow-xs cursor-pointer active:scale-98 transition-all"
                  >
                    <Check size={14} />
                    <span>Save Profile Details (प्रोफ़ाइल अपडेट करें)</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ─────────────────────────────────────────────────────────────
              SECTION 2: DISPLAY, THEME & EYE COMFORT
          ───────────────────────────────────────────────────────────── */}
          {(activeTab === "all" || activeTab === "display") && (
            <div className="space-y-2.5">
              <h4 className="text-[11px] font-black text-[#7045D8] dark:text-[#A78BFA] uppercase tracking-[0.18em] px-1 flex items-center gap-1.5">
                <Moon size={13} />
                <span>Display &amp; Night Comfort (थीम व डिस्प्ले)</span>
              </h4>

              <div className="bg-white dark:bg-[#1B1536] rounded-2xl border border-slate-200 dark:border-[#31275E] shadow-2xs divide-y divide-slate-200/60 dark:divide-[#31275E]">
                {/* 3-Way Theme Switcher */}
                <div className="p-4 space-y-3">
                  <div className="flex items-center gap-3.5">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${settings.darkMode ? 'bg-[#7045D8]/15 text-[#7045D8]' : 'bg-[#7045D8]/10 text-[#7045D8]'}`}>
                      {settings.darkMode ? <Moon size={20} /> : <Sun size={20} />}
                    </div>
                    <div>
                      <span className="text-sm font-bold text-slate-900 dark:text-slate-50 block">Theme &amp; Night Mode</span>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                        {settings.darkMode ? (settings.amoledBlack ? "AMOLED Pitch Black (बैटरी बचत मोड)" : "Charcoal Dark Mode") : "Light Mode (Day)"}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        triggerHaptic("light");
                        playClickSound();
                        updateSetting({ darkMode: false, amoledBlack: false });
                      }}
                      className={`py-2 px-1 rounded-xl text-center transition-all cursor-pointer border ${
                        !settings.darkMode
                          ? 'bg-[#7045D8] text-white border-[#7045D8] shadow-xs font-black'
                          : 'bg-[#F8FAFC] dark:bg-[#130E26] text-slate-600 dark:text-slate-300 border-slate-200 dark:border-[#31275E] font-semibold'
                      }`}
                    >
                      <span className="text-xs block">☀️ Light</span>
                      <span className="text-[10px] opacity-75 block">Day Mode</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        triggerHaptic("light");
                        playClickSound();
                        updateSetting({ darkMode: true, amoledBlack: false });
                      }}
                      className={`py-2 px-1 rounded-xl text-center transition-all cursor-pointer border ${
                        settings.darkMode && !settings.amoledBlack
                          ? 'bg-[#7045D8] text-white border-[#7045D8] shadow-xs font-black'
                          : 'bg-[#F8FAFC] dark:bg-[#130E26] text-slate-600 dark:text-slate-300 border-slate-200 dark:border-[#31275E] font-semibold'
                      }`}
                    >
                      <span className="text-xs block">🌙 Charcoal</span>
                      <span className="text-[10px] opacity-75 block">Dark Mode</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        triggerHaptic("light");
                        playClickSound();
                        updateSetting({ darkMode: true, amoledBlack: true });
                      }}
                      className={`py-2 px-1 rounded-xl text-center transition-all cursor-pointer border relative overflow-hidden ${
                        settings.darkMode && settings.amoledBlack
                          ? 'bg-black text-amber-400 border-amber-500/70 shadow-xs font-black'
                          : 'bg-[#F8FAFC] dark:bg-[#130E26] text-slate-600 dark:text-slate-300 border-slate-200 dark:border-[#31275E] font-semibold'
                      }`}
                    >
                      <span className="text-xs block">⬛ AMOLED</span>
                      <span className="text-[10px] opacity-75 block">Pitch Black</span>
                    </button>
                  </div>
                </div>

                {/* Eye-Comfort Shield */}
                <div className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3.5">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${settings.eyeComfort ? 'bg-amber-500/20 text-amber-500' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>
                      <Eye size={20} />
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-bold text-slate-900 dark:text-slate-50">Eye-Comfort Shield (नेत्र सुरक्षा)</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded font-extrabold bg-amber-500/15 text-amber-600 dark:text-amber-400">
                          Warm Amber
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium block">
                        रात में पढ़ने पर नीली रोशनी कम करता है और आँखों की थकान बचाता है।
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleSetting('eyeComfort')}
                    aria-label="Toggle Eye Comfort Shield"
                    className={`w-12 h-6.5 rounded-full transition-all relative p-1 cursor-pointer shrink-0 ml-2 ${settings.eyeComfort ? 'bg-amber-500' : 'bg-slate-200 dark:bg-[#31275E]'}`}
                  >
                    <div className={`w-4.5 h-4.5 rounded-full bg-white shadow-sm transition-transform ${settings.eyeComfort ? 'translate-x-5.5' : 'translate-x-0'}`} />
                  </button>
                </div>

                {/* Font Size */}
                <div className="p-4 space-y-3">
                  <div className="flex items-center gap-3.5">
                    <div className="w-10 h-10 rounded-xl bg-[#A78BFA]/15 text-[#7045D8] dark:text-[#A78BFA] flex items-center justify-center shrink-0">
                      <Type size={20} />
                    </div>
                    <div>
                      <span className="text-sm font-bold text-slate-900 dark:text-slate-50 block">Question Font Size (फ़ॉन्ट आकार)</span>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">प्रश्न व विकल्पों के पढ़ने का आकार</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {(['S', 'M', 'L'] as const).map((size) => (
                      <button
                        key={size}
                        onClick={() => updateSetting({ textSize: size })}
                        className={`py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                          settings.textSize === size
                            ? 'bg-[#7045D8] text-white shadow-xs'
                            : 'bg-slate-50 dark:bg-[#130E26] text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-[#31275E]'
                        }`}
                      >
                        {size === 'S' ? 'छोटा (Small)' : size === 'M' ? 'मध्यम (Medium)' : 'बड़ा (Large)'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ─────────────────────────────────────────────────────────────
              SECTION 3: PRACTICE & QUIZ CONTROLS (WITHOUT DAILY TARGET)
          ───────────────────────────────────────────────────────────── */}
          {(activeTab === "all" || activeTab === "practice") && (
            <div className="space-y-2.5">
              <h4 className="text-[11px] font-black text-[#7045D8] dark:text-[#A78BFA] uppercase tracking-[0.18em] px-1 flex items-center gap-1.5">
                <Zap size={13} />
                <span>Practice Controls (अभ्यास व प्रश्न नियंत्रण)</span>
              </h4>

              <div className="bg-white dark:bg-[#1B1536] rounded-2xl border border-slate-200 dark:border-[#31275E] shadow-2xs divide-y divide-slate-200/60 dark:divide-[#31275E]">
                {/* Randomize Practice */}
                <div className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3.5">
                    <div className="w-10 h-10 rounded-xl bg-[#7045D8]/10 text-[#7045D8] dark:text-[#A78BFA] flex items-center justify-center shrink-0">
                      <Shuffle size={20} />
                    </div>
                    <div>
                      <span className="text-sm font-bold text-slate-900 dark:text-slate-50 block">Randomize Questions (प्रश्न शफ़ल)</span>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                        अभ्यास में प्रश्नों का क्रम स्वतः बदलें
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleSetting('shuffleQuestions')}
                    className={`w-12 h-6.5 rounded-full transition-all relative p-1 cursor-pointer shrink-0 ml-2 ${settings.shuffleQuestions ? 'bg-[#7045D8]' : 'bg-slate-200 dark:bg-[#31275E]'}`}
                  >
                    <div className={`w-4.5 h-4.5 rounded-full bg-white shadow-sm transition-transform ${settings.shuffleQuestions ? 'translate-x-5.5' : 'translate-x-0'}`} />
                  </button>
                </div>

                {/* Instant Explanation */}
                <div className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3.5">
                    <div className="w-10 h-10 rounded-xl bg-[#7045D8]/15 text-[#7045D8] flex items-center justify-center shrink-0">
                      <Zap size={20} />
                    </div>
                    <div>
                      <span className="text-sm font-bold text-slate-900 dark:text-slate-50 block">Instant Solutions (तुरंत व्याख्या)</span>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                        उत्तर चुनते ही विस्तृत व्याख्या दिखाएँ
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleSetting('instantExplanation')}
                    className={`w-12 h-6.5 rounded-full transition-all relative p-1 cursor-pointer shrink-0 ml-2 ${settings.instantExplanation !== false ? 'bg-[#7045D8]' : 'bg-slate-200 dark:bg-[#31275E]'}`}
                  >
                    <div className={`w-4.5 h-4.5 rounded-full bg-white shadow-sm transition-transform ${settings.instantExplanation !== false ? 'translate-x-5.5' : 'translate-x-0'}`} />
                  </button>
                </div>

                {/* Sound Effects */}
                <div className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3.5">
                    <div className="w-10 h-10 rounded-xl bg-[#7045D8]/10 text-[#7045D8] dark:text-[#A78BFA] flex items-center justify-center shrink-0">
                      <Volume2 size={20} />
                    </div>
                    <div>
                      <span className="text-sm font-bold text-slate-900 dark:text-slate-50 block">Audio Chimes (ध्वनि प्रभाव)</span>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                        सही व गलत उत्तर पर ऑडियो संकेत
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      toggleSetting('soundEffects');
                      if (!settings.soundEffects) playCorrectSound(true);
                    }}
                    className={`w-12 h-6.5 rounded-full transition-all relative p-1 cursor-pointer shrink-0 ml-2 ${settings.soundEffects !== false ? 'bg-[#7045D8]' : 'bg-slate-200 dark:bg-[#31275E]'}`}
                  >
                    <div className={`w-4.5 h-4.5 rounded-full bg-white shadow-sm transition-transform ${settings.soundEffects !== false ? 'translate-x-5.5' : 'translate-x-0'}`} />
                  </button>
                </div>

                {/* Haptics */}
                <div className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3.5">
                    <div className="w-10 h-10 rounded-xl bg-[#A78BFA]/15 text-[#7045D8] dark:text-[#A78BFA] flex items-center justify-center shrink-0">
                      <Smartphone size={20} />
                    </div>
                    <div>
                      <span className="text-sm font-bold text-slate-900 dark:text-slate-50 block">Haptic Touch (वाइब्रेशन फ़ीडबैक)</span>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                        विकल्प टैप पर हल्का कंपन अनुभव
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleSetting('hapticFeedback')}
                    className={`w-12 h-6.5 rounded-full transition-all relative p-1 cursor-pointer shrink-0 ml-2 ${settings.hapticFeedback !== false ? 'bg-[#7045D8]' : 'bg-slate-200 dark:bg-[#31275E]'}`}
                  >
                    <div className={`w-4.5 h-4.5 rounded-full bg-white shadow-sm transition-transform ${settings.hapticFeedback !== false ? 'translate-x-5.5' : 'translate-x-0'}`} />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ─────────────────────────────────────────────────────────────
              SECTION 4: AI ASSISTANT CONFIGURATION
          ───────────────────────────────────────────────────────────── */}
          {(activeTab === "all" || activeTab === "ai") && (
            <div className="space-y-2.5">
              <h4 className="text-[11px] font-black text-[#7045D8] dark:text-[#A78BFA] uppercase tracking-[0.18em] px-1 flex items-center gap-1.5">
                <Sparkles size={13} />
                <span>AI Tutor &amp; Engine (दिशा AI डाउट सॉल्वर)</span>
              </h4>

              <div className="bg-white dark:bg-[#1B1536] rounded-2xl border border-slate-200 dark:border-[#31275E] shadow-2xs p-4 sm:p-5 space-y-3.5">
                <div className="flex items-center gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-[#7045D8]/15 text-[#7045D8] flex items-center justify-center shrink-0">
                    <Sparkles size={20} />
                  </div>
                  <div>
                    <span className="text-sm font-bold text-slate-900 dark:text-slate-50 block">
                      AI Engine Mode
                    </span>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium leading-tight block">
                      Disha AI का इन-बिल्ट सर्वर इंजन या अपनी पर्सनल Gemini Key
                    </span>
                  </div>
                </div>

                <div className="space-y-2 pt-1">
                  <input
                    type="password"
                    placeholder="Paste Gemini API Key (AIzaSy...)"
                    value={settings.geminiApiKey || ""}
                    onChange={(e) => {
                      const val = e.target.value;
                      updateSetting({
                        geminiApiKey: val,
                        useCustomApiKey: val.trim().length > 0,
                      });
                    }}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-[#31275E] bg-slate-50 dark:bg-[#130E26] text-slate-900 dark:text-slate-50 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-[#7045D8]"
                  />
                  <div className="flex items-center justify-between pt-1">
                    <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                      {settings.geminiApiKey ? "✓ Custom Gemini key active" : "Using Disha PYQ Default Engine"}
                    </p>
                    {settings.geminiApiKey && (
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300">Use Custom:</span>
                        <button
                          type="button"
                          onClick={() => updateSetting({ useCustomApiKey: !settings.useCustomApiKey })}
                          className={`w-9 h-5 rounded-full transition-all relative p-0.5 cursor-pointer ${settings.useCustomApiKey ? 'bg-[#7045D8]' : 'bg-slate-200 dark:bg-[#31275E]'}`}
                        >
                          <div className={`w-4 h-4 rounded-full bg-white shadow-xs transition-transform ${settings.useCustomApiKey ? 'translate-x-4' : 'translate-x-0'}`} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ─────────────────────────────────────────────────────────────
              SECTION 5: DATA BACKUP & RESTORE
          ───────────────────────────────────────────────────────────── */}
          {(activeTab === "all" || activeTab === "backup") && (
            <div className="space-y-2.5">
              <h4 className="text-[11px] font-black text-[#7045D8] dark:text-[#A78BFA] uppercase tracking-[0.18em] px-1 flex items-center gap-1.5">
                <Database size={13} />
                <span>Data Backup &amp; Sync (डेटा बैकअप व सुरक्षा)</span>
              </h4>

              <div className="bg-white dark:bg-[#1B1536] rounded-2xl border border-slate-200 dark:border-[#31275E] shadow-2xs p-4 sm:p-5 space-y-3.5">
                <div className="flex items-center gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                    <Database size={20} />
                  </div>
                  <div>
                    <span className="text-sm font-bold text-slate-900 dark:text-slate-50 block">Offline Data Backup (ऑफ़लाइन बैकअप)</span>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium leading-tight block">
                      अपने बुकमार्क, नोट्स और टेस्ट इतिहास को सुरक्षित JSON फ़ाइल में सेव करें।
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic("light");
                      exportStudentBackupToFile();
                    }}
                    className="py-2.5 px-3 rounded-xl bg-[#7045D8] hover:bg-[#5B32BF] text-white text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xs active:scale-98"
                  >
                    <Download size={15} />
                    <span>Download Backup (Export)</span>
                  </button>

                  <label className="py-2.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-[#241D48] dark:hover:bg-[#31275E] text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-[#31275E] text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-98">
                    <Upload size={15} />
                    <span>Restore Backup (Import)</span>
                    <input
                      type="file"
                      accept=".json"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const reader = new FileReader();
                        reader.onload = (event) => {
                          const content = event.target?.result as string;
                          if (content) {
                            const res = restoreStudentBackupFromJSON(content);
                            setBackupNotice(res.message);
                            triggerHaptic("medium");
                          }
                        };
                        reader.readAsText(file);
                      }}
                    />
                  </label>
                </div>

                {backupNotice && (
                  <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 text-center pt-1 font-hindi">
                    {backupNotice}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* ─────────────────────────────────────────────────────────────
              SECTION 6: TRANSPARENCY & LEGAL (पारदर्शिता व नीतियां)
          ───────────────────────────────────────────────────────────── */}
          {(activeTab === "all" || activeTab === "legal") && (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between px-1">
                <h4 className="text-[11px] font-black text-[#7045D8] dark:text-[#A78BFA] uppercase tracking-[0.18em] flex items-center gap-1.5">
                  <ShieldCheck size={13} />
                  <span>Transparency &amp; Legal (पारदर्शिता व नीतियां)</span>
                </h4>
              </div>

              <div className="bg-white dark:bg-[#1B1536] rounded-2xl border border-slate-200 dark:border-[#31275E] shadow-2xs overflow-hidden transition-all duration-200">
                {/* Main Transparency & Legal Button */}
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic("light");
                    setIsLegalExpanded((prev) => !prev);
                  }}
                  aria-expanded={isLegalExpanded}
                  className="w-full flex items-center justify-between p-4 hover:bg-slate-50 dark:hover:bg-[#241D48]/50 transition-colors cursor-pointer text-left group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                      <ShieldCheck size={20} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-slate-900 dark:text-slate-50 block truncate">
                          Transparency &amp; Legal
                        </span>
                        <span className="px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 text-[10px] font-black uppercase tracking-wider">
                          5 Sub-buttons
                        </span>
                      </div>
                      <span className="text-xs text-slate-500 dark:text-slate-400 block truncate mt-0.5">
                        Privacy Policy, Terms, Disclaimer &amp; Help Desk
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 text-slate-400 group-hover:text-[#7045D8] transition-colors ml-2">
                    <ChevronDown
                      size={18}
                      className={`transition-transform duration-200 ${
                        isLegalExpanded ? "rotate-180 text-[#7045D8]" : ""
                      }`}
                    />
                  </div>
                </button>

                {/* Sub-buttons Container */}
                {isLegalExpanded && (
                  <div className="border-t border-slate-100 dark:border-[#31275E]/60 bg-slate-50/60 dark:bg-[#140F2D]/50 divide-y divide-slate-100 dark:divide-[#31275E]/40">
                    {/* Sub-button 1: About Disha PYQ */}
                    <button
                      type="button"
                      onClick={() => {
                        triggerHaptic("light");
                        onClose();
                        if (onOpenAbout) onOpenAbout();
                        else if (onNavigateTab) onNavigateTab("about" as ActiveTab);
                      }}
                      className="w-full flex items-center justify-between p-3.5 pl-6 hover:bg-white dark:hover:bg-[#241D48]/80 transition-colors cursor-pointer text-left group"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-[#7045D8]/10 text-[#7045D8] dark:text-[#A78BFA] flex items-center justify-center shrink-0">
                          <Info size={16} />
                        </div>
                        <div className="min-w-0">
                          <span className="text-xs font-bold text-slate-800 dark:text-slate-100 block truncate">
                            About Disha PYQ
                          </span>
                          <span className="text-[10px] text-slate-500 dark:text-slate-400 block truncate">
                            Mission, version &amp; key features
                          </span>
                        </div>
                      </div>
                      <ChevronRight size={15} className="text-slate-400 group-hover:text-[#7045D8] transition-colors shrink-0" />
                    </button>

                    {/* Sub-button 2: Privacy Policy */}
                    <button
                      type="button"
                      onClick={() => {
                        triggerHaptic("light");
                        onClose();
                        onNavigateTab?.("privacy-policy");
                      }}
                      className="w-full flex items-center justify-between p-3.5 pl-6 hover:bg-white dark:hover:bg-[#241D48]/80 transition-colors cursor-pointer text-left group"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                          <Shield size={16} />
                        </div>
                        <div className="min-w-0">
                          <span className="text-xs font-bold text-slate-800 dark:text-slate-100 block truncate">
                            Privacy Policy
                          </span>
                          <span className="text-[10px] text-slate-500 dark:text-slate-400 block truncate">
                            Data protection &amp; Google Play compliance
                          </span>
                        </div>
                      </div>
                      <ChevronRight size={15} className="text-slate-400 group-hover:text-emerald-500 transition-colors shrink-0" />
                    </button>

                    {/* Sub-button 3: Terms of Service */}
                    <button
                      type="button"
                      onClick={() => {
                        triggerHaptic("light");
                        onClose();
                        onNavigateTab?.("terms-of-service");
                      }}
                      className="w-full flex items-center justify-between p-3.5 pl-6 hover:bg-white dark:hover:bg-[#241D48]/80 transition-colors cursor-pointer text-left group"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-slate-200 dark:bg-[#241D48] text-slate-700 dark:text-slate-300 flex items-center justify-center shrink-0">
                          <FileText size={16} />
                        </div>
                        <div className="min-w-0">
                          <span className="text-xs font-bold text-slate-800 dark:text-slate-100 block truncate">
                            Terms of Service
                          </span>
                          <span className="text-[10px] text-slate-500 dark:text-slate-400 block truncate">
                            Fair usage &amp; intellectual property
                          </span>
                        </div>
                      </div>
                      <ChevronRight size={15} className="text-slate-400 group-hover:text-slate-600 transition-colors shrink-0" />
                    </button>

                    {/* Sub-button 4: Government Disclaimer */}
                    <button
                      type="button"
                      onClick={() => {
                        triggerHaptic("light");
                        onClose();
                        onNavigateTab?.("disclaimer");
                      }}
                      className="w-full flex items-center justify-between p-3.5 pl-6 hover:bg-white dark:hover:bg-[#241D48]/80 transition-colors cursor-pointer text-left group"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                          <AlertCircle size={16} />
                        </div>
                        <div className="min-w-0">
                          <span className="text-xs font-bold text-slate-800 dark:text-slate-100 block truncate">
                            Government Disclaimer
                          </span>
                          <span className="text-[10px] text-slate-500 dark:text-slate-400 block truncate">
                            Independent private education platform
                          </span>
                        </div>
                      </div>
                      <ChevronRight size={15} className="text-slate-400 group-hover:text-amber-500 transition-colors shrink-0" />
                    </button>

                    {/* Sub-button 5: Help & Contact Desk */}
                    <button
                      type="button"
                      onClick={() => {
                        triggerHaptic("light");
                        onClose();
                        onNavigateTab?.("contact");
                      }}
                      className="w-full flex items-center justify-between p-3.5 pl-6 hover:bg-white dark:hover:bg-[#241D48]/80 transition-colors cursor-pointer text-left group"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-[#7045D8]/10 text-[#7045D8] dark:text-[#A78BFA] flex items-center justify-center shrink-0">
                          <Mail size={16} />
                        </div>
                        <div className="min-w-0">
                          <span className="text-xs font-bold text-slate-800 dark:text-slate-100 block truncate">
                            Help &amp; Contact Desk
                          </span>
                          <span className="text-[10px] text-slate-500 dark:text-slate-400 block truncate">
                            Support query &amp; student assistance
                          </span>
                        </div>
                      </div>
                      <ChevronRight size={15} className="text-slate-400 group-hover:text-[#7045D8] transition-colors shrink-0" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="text-center pt-2 pb-1">
            <p className="text-[11px] font-black text-[#7045D8] dark:text-[#A78BFA] uppercase tracking-[0.2em]">
              Disha PYQ • Rajasthan Exam Preparation Platform
            </p>
          </div>
        </div>

        {/* Footer */}
        <footer className="p-4 sm:p-5 bg-white dark:bg-[#1B1536] border-t border-slate-200 dark:border-[#31275E] shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-3.5 bg-gradient-to-r from-[#7045D8] to-[#5B32BF] hover:opacity-95 text-white rounded-2xl text-xs font-black uppercase tracking-widest shadow-md cursor-pointer active:scale-98 transition-all"
          >
            लागू करें व बंद करें (Apply &amp; Close)
          </button>
        </footer>
      </div>
    </div>
  );
};
