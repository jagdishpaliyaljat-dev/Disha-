import React from "react";
import { AppSettings } from "../types";
import {
  X,
  Shuffle,
  Volume2,
  Target,
  Smartphone,
  Moon,
  Sun,
  Type,
  Sparkles,
  Zap,
} from "lucide-react";
import {
  playCorrectSound,
  playClickSound,
  triggerHaptic,
} from "../utils/audioFeedback";
import { AppLogo } from "./AppLogo";

interface AppSettingsModalProps {
  settings: AppSettings;
  onUpdateSettings: (newSettings: Partial<AppSettings>) => void;
  onClose: () => void;
}

export const AppSettingsModal: React.FC<AppSettingsModalProps> = ({
  settings,
  onUpdateSettings,
  onClose,
}) => {
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

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-6 animate-in fade-in duration-200">
      <div className="fixed inset-0 bg-[#171923]/80 backdrop-blur-sm" onClick={onClose} />
      
      <div className="relative w-full max-w-lg bg-[#FFF9EF] dark:bg-[#171923] border border-[#E8D9C0] dark:border-[#31374A] rounded-t-[32px] sm:rounded-[32px] shadow-2xl overflow-hidden flex flex-col max-h-[90vh] sm:max-h-[85vh] animate-in slide-in-from-bottom duration-300">
        {/* Top Heritage Accent */}
        <div className="h-1 w-full bg-gradient-to-r from-[#800020] via-[#F47B20] to-[#C99A45] shrink-0" />

        {/* Header */}
        <header className="px-6 pt-5 pb-4 bg-white dark:bg-[#1F2330] border-b border-[#E8D9C0] dark:border-[#31374A] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3.5">
            <AppLogo size="sm" variant="icon" />
            <div>
              <h3 className="text-base font-black text-[#171923] dark:text-[#FFF9EF]">
                Disha PYQ Settings
              </h3>
              <p className="text-[10px] font-bold text-[#52576A] dark:text-[#CBD2E1] uppercase tracking-wider">
                Practice & Display Preferences
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-[#F7EFE2] dark:bg-[#252A3A] border border-[#E8D9C0] dark:border-[#31374A] flex items-center justify-center text-[#52576A] dark:text-[#CBD2E1] hover:text-[#800020] dark:hover:text-[#F47B20] transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </header>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6 pb-6">
          
          {/* Section: Appearance */}
          <div className="space-y-2.5">
            <h4 className="text-[10px] font-black text-[#800020] dark:text-[#F47B20] uppercase tracking-[0.18em] px-1">
              Appearance & Font
            </h4>
            <div className="bg-white dark:bg-[#1F2330] rounded-2xl border border-[#E8D9C0] dark:border-[#31374A] shadow-2xs divide-y divide-[#E8D9C0]/60 dark:divide-[#31374A]">
              
              {/* Dark Mode */}
              <div className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3.5">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${settings.darkMode ? 'bg-[#F47B20]/15 text-[#F47B20]' : 'bg-[#800020]/10 text-[#800020]'}`}>
                    {settings.darkMode ? <Moon size={20} /> : <Sun size={20} />}
                  </div>
                  <div>
                    <span className="text-sm font-bold text-[#171923] dark:text-[#FFF9EF] block">Dark Mode</span>
                    <span className="text-[10px] text-[#52576A] dark:text-[#CBD2E1] font-medium uppercase tracking-tight">Deep Charcoal Night Surface</span>
                  </div>
                </div>
                <button 
                  onClick={() => toggleSetting('darkMode')}
                  className={`w-12 h-6.5 rounded-full transition-all relative p-1 cursor-pointer ${settings.darkMode ? 'bg-[#F47B20]' : 'bg-[#E8D9C0] dark:bg-[#31374A]'}`}
                >
                  <div className={`w-4.5 h-4.5 rounded-full bg-white shadow-sm transition-transform ${settings.darkMode ? 'translate-x-5.5' : 'translate-x-0'}`} />
                </button>
              </div>

              {/* Text Size */}
              <div className="p-4 space-y-3.5">
                <div className="flex items-center gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-[#C99A45]/15 text-[#C99A45] flex items-center justify-center">
                    <Type size={20} />
                  </div>
                  <div>
                    <span className="text-sm font-bold text-[#171923] dark:text-[#FFF9EF] block">Question Font Size</span>
                    <span className="text-[10px] text-[#52576A] dark:text-[#CBD2E1] font-medium uppercase tracking-tight">Reading Comfort Scale</span>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {(['S', 'M', 'L'] as const).map((size) => (
                    <button
                      key={size}
                      onClick={() => updateSetting({ textSize: size })}
                      className={`py-2 rounded-xl text-[11px] font-black transition-all cursor-pointer ${
                        settings.textSize === size
                          ? 'bg-[#800020] dark:bg-[#F47B20] text-white shadow-sm'
                          : 'bg-[#FFF9EF] dark:bg-[#171923] text-[#52576A] dark:text-[#CBD2E1] border border-[#E8D9C0] dark:border-[#31374A]'
                      }`}
                    >
                      {size === 'S' ? 'Small' : size === 'M' ? 'Medium (Default)' : 'Large'}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Section: Practice Mode */}
          <div className="space-y-2.5">
            <h4 className="text-[10px] font-black text-[#800020] dark:text-[#F47B20] uppercase tracking-[0.18em] px-1">
              Practice Controls
            </h4>
            <div className="bg-white dark:bg-[#1F2330] rounded-2xl border border-[#E8D9C0] dark:border-[#31374A] shadow-2xs divide-y divide-[#E8D9C0]/60 dark:divide-[#31374A]">
              
              {/* Daily Target */}
              <div className="p-4 space-y-3.5">
                <div className="flex items-center gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-[#15803D]/10 text-[#15803D] dark:text-emerald-400 flex items-center justify-center">
                    <Target size={20} />
                  </div>
                  <div>
                    <span className="text-sm font-bold text-[#171923] dark:text-[#FFF9EF] block">Daily Goal</span>
                    <span className="text-[10px] text-[#52576A] dark:text-[#CBD2E1] font-medium uppercase tracking-tight">Target MCQs Per Day</span>
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {[20, 30, 50, 100].map((count) => (
                    <button
                      key={count}
                      onClick={() => updateSetting({ dailyGoal: count })}
                      className={`py-2 rounded-xl text-[11px] font-black font-mono tabular-nums transition-all cursor-pointer ${
                        settings.dailyGoal === count
                          ? 'bg-[#800020] dark:bg-[#F47B20] text-white shadow-sm'
                          : 'bg-[#FFF9EF] dark:bg-[#171923] text-[#52576A] dark:text-[#CBD2E1] border border-[#E8D9C0] dark:border-[#31374A]'
                      }`}
                    >
                      {count}
                    </button>
                  ))}
                </div>
              </div>

              {/* Randomize Practice */}
              <div className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-[#800020]/10 dark:bg-[#F47B20]/15 text-[#800020] dark:text-[#F47B20] flex items-center justify-center">
                    <Shuffle size={20} />
                  </div>
                  <div>
                    <span className="text-sm font-bold text-[#171923] dark:text-[#FFF9EF] block">Randomize Practice</span>
                    <span className="text-[10px] text-[#52576A] dark:text-[#CBD2E1] font-medium uppercase tracking-tight">Shuffle Questions</span>
                  </div>
                </div>
                <button 
                  onClick={() => toggleSetting('shuffleQuestions')}
                  className={`w-12 h-6.5 rounded-full transition-all relative p-1 cursor-pointer ${settings.shuffleQuestions ? 'bg-[#800020] dark:bg-[#F47B20]' : 'bg-[#E8D9C0] dark:bg-[#31374A]'}`}
                >
                  <div className={`w-4.5 h-4.5 rounded-full bg-white shadow-sm transition-transform ${settings.shuffleQuestions ? 'translate-x-5.5' : 'translate-x-0'}`} />
                </button>
              </div>

              {/* Instant Explanation */}
              <div className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-[#F47B20]/15 text-[#F47B20] flex items-center justify-center">
                    <Zap size={20} />
                  </div>
                  <div>
                    <span className="text-sm font-bold text-[#171923] dark:text-[#FFF9EF] block">Instant Solutions</span>
                    <span className="text-[10px] text-[#52576A] dark:text-[#CBD2E1] font-medium uppercase tracking-tight">Explanation On Tap</span>
                  </div>
                </div>
                <button 
                  onClick={() => toggleSetting('instantExplanation')}
                  className={`w-12 h-6.5 rounded-full transition-all relative p-1 cursor-pointer ${settings.instantExplanation !== false ? 'bg-[#800020] dark:bg-[#F47B20]' : 'bg-[#E8D9C0] dark:bg-[#31374A]'}`}
                >
                  <div className={`w-4.5 h-4.5 rounded-full bg-white shadow-sm transition-transform ${settings.instantExplanation !== false ? 'translate-x-5.5' : 'translate-x-0'}`} />
                </button>
              </div>
            </div>
          </div>

          {/* Section: Feedback */}
          <div className="space-y-2.5">
            <h4 className="text-[10px] font-black text-[#800020] dark:text-[#F47B20] uppercase tracking-[0.18em] px-1">
              Audio & Haptics
            </h4>
            <div className="bg-white dark:bg-[#1F2330] rounded-2xl border border-[#E8D9C0] dark:border-[#31374A] shadow-2xs divide-y divide-[#E8D9C0]/60 dark:divide-[#31374A]">
              
              {/* Sound Effects */}
              <div className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-[#800020]/10 dark:bg-[#F47B20]/15 text-[#800020] dark:text-[#F47B20] flex items-center justify-center">
                    <Volume2 size={20} />
                  </div>
                  <div>
                    <span className="text-sm font-bold text-[#171923] dark:text-[#FFF9EF] block">Audio Chimes</span>
                    <span className="text-[10px] text-[#52576A] dark:text-[#CBD2E1] font-medium uppercase tracking-tight">Audio Feedback</span>
                  </div>
                </div>
                <button 
                  onClick={() => {
                    toggleSetting('soundEffects');
                    if (!settings.soundEffects) playCorrectSound(true);
                  }}
                  className={`w-12 h-6.5 rounded-full transition-all relative p-1 cursor-pointer ${settings.soundEffects !== false ? 'bg-[#800020] dark:bg-[#F47B20]' : 'bg-[#E8D9C0] dark:bg-[#31374A]'}`}
                >
                  <div className={`w-4.5 h-4.5 rounded-full bg-white shadow-sm transition-transform ${settings.soundEffects !== false ? 'translate-x-5.5' : 'translate-x-0'}`} />
                </button>
              </div>

              {/* Haptics */}
              <div className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-[#C99A45]/15 text-[#C99A45] flex items-center justify-center">
                    <Smartphone size={20} />
                  </div>
                  <div>
                    <span className="text-sm font-bold text-[#171923] dark:text-[#FFF9EF] block">Vibration Feedback</span>
                    <span className="text-[10px] text-[#52576A] dark:text-[#CBD2E1] font-medium uppercase tracking-tight">Haptic Touch</span>
                  </div>
                </div>
                <button 
                  onClick={() => toggleSetting('hapticFeedback')}
                  className={`w-12 h-6.5 rounded-full transition-all relative p-1 cursor-pointer ${settings.hapticFeedback !== false ? 'bg-[#800020] dark:bg-[#F47B20]' : 'bg-[#E8D9C0] dark:bg-[#31374A]'}`}
                >
                  <div className={`w-4.5 h-4.5 rounded-full bg-white shadow-sm transition-transform ${settings.hapticFeedback !== false ? 'translate-x-5.5' : 'translate-x-0'}`} />
                </button>
              </div>
            </div>
          </div>

          {/* Section: Custom Gemini API Key */}
          <div className="space-y-2.5">
            <h4 className="text-[10px] font-black text-[#800020] dark:text-[#F47B20] uppercase tracking-[0.18em] px-1">
              Smart Assistant Key
            </h4>
            <div className="bg-white dark:bg-[#1F2330] rounded-2xl border border-[#E8D9C0] dark:border-[#31374A] shadow-2xs p-4 space-y-3">
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-[#F47B20]/15 text-[#F47B20] flex items-center justify-center shrink-0">
                  <Sparkles size={20} />
                </div>
                <div>
                  <span className="text-sm font-bold text-[#171923] dark:text-[#FFF9EF] block">Personal Gemini Key (Optional)</span>
                  <span className="text-[10px] text-[#52576A] dark:text-[#CBD2E1] font-medium leading-tight block">Leave blank to use the built-in Disha PYQ platform engine.</span>
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
                      useCustomApiKey: val.trim().length > 0
                    });
                  }}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#E8D9C0] dark:border-[#31374A] bg-[#FFF9EF] dark:bg-[#171923] text-[#171923] dark:text-[#FFF9EF] text-xs font-mono focus:outline-none focus:ring-2 focus:ring-[#7045D8] dark:focus:ring-[#A78BFA]"
                />
                <div className="flex items-center justify-between pt-1">
                  <p className="text-[10px] font-bold text-[#787D91] dark:text-[#929AB0]">
                    {settings.geminiApiKey ? "✓ Custom API key configured." : "Using Disha PYQ default server key."}
                  </p>
                  {settings.geminiApiKey && (
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] font-bold text-[#52576A] dark:text-[#CBD2E1] uppercase">Use Key:</span>
                      <button 
                        onClick={() => updateSetting({ useCustomApiKey: !settings.useCustomApiKey })}
                        className={`w-8 h-4.5 rounded-full transition-all relative p-0.5 cursor-pointer ${settings.useCustomApiKey ? 'bg-[#7045D8]' : 'bg-[#E8D9C0] dark:bg-[#31374A]'}`}
                      >
                        <div className={`w-3.5 h-3.5 rounded-full bg-white shadow-xs transition-transform ${settings.useCustomApiKey ? 'translate-x-3.5' : 'translate-x-0'}`} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
          
          <div className="text-center pb-2">
            <p className="text-[10px] font-black text-[#7045D8] dark:text-[#A78BFA] uppercase tracking-[0.2em]">
              Disha PYQ • Previous Year Questions & Precision Learning
            </p>
          </div>
        </div>

        {/* Footer */}
        <footer className="p-4 sm:p-5 bg-white dark:bg-[#1F2330] border-t border-[#E8D9C0] dark:border-[#31374A] shrink-0">
          <button 
            onClick={onClose}
            className="w-full py-3.5 bg-[#800020] hover:bg-[#5E0017] dark:bg-[#F47B20] dark:hover:bg-[#E06A12] text-white rounded-2xl text-xs font-black uppercase tracking-widest shadow-md cursor-pointer active:scale-95 transition-transform"
          >
            Apply & Close
          </button>
        </footer>
      </div>
    </div>
  );
};
