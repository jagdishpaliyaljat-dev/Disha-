import React, { useEffect } from "react";
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
  Eye,
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
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-6 animate-in fade-in duration-200">
      <div className="fixed inset-0 bg-[#130E26]/80 backdrop-blur-sm" onClick={onClose} />
      
      <div 
        role="dialog" 
        aria-modal="true" 
        aria-label="Disha PYQ Settings"
        className="relative w-full max-w-lg bg-[#F8FAFC] dark:bg-[#130E26] border border-slate-200 dark:border-[#31275E] rounded-t-[32px] sm:rounded-[32px] shadow-2xl overflow-hidden flex flex-col max-h-[90vh] sm:max-h-[85vh] animate-in slide-in-from-bottom duration-300"
      >
        {/* Top Heritage Accent */}
        <div className="h-1 w-full bg-gradient-to-r from-[#7045D8] via-[#7045D8] to-[#A78BFA] shrink-0" />

        {/* Header */}
        <header className="px-6 pt-5 pb-4 bg-white dark:bg-[#1B1536] border-b border-slate-200 dark:border-[#31275E] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3.5">
            <AppLogo size="sm" variant="icon" />
            <div>
              <h3 className="text-base font-black text-slate-900 dark:text-slate-50">
                Disha PYQ Settings
              </h3>
              <p className="text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                Practice & Display Preferences
              </p>
            </div>
          </div>
          <button 
            type="button"
            onClick={onClose}
            aria-label="Close settings"
            className="w-11 h-11 rounded-xl bg-slate-100 dark:bg-[#241D48] border border-slate-200 dark:border-[#31275E] flex items-center justify-center text-slate-600 dark:text-slate-300 hover:text-[#7045D8] dark:hover:text-[#A78BFA] transition-colors cursor-pointer shrink-0"
          >
            <X size={18} />
          </button>
        </header>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6 pb-6">
          
          {/* Section: Appearance */}
          <div className="space-y-2.5">
            <h4 className="text-[11px] font-black text-[#7045D8] dark:text-[#A78BFA] uppercase tracking-[0.18em] px-1">
              Appearance & Font
            </h4>
            <div className="bg-white dark:bg-[#1B1536] rounded-2xl border border-slate-200 dark:border-[#31275E] shadow-2xs divide-y divide-slate-200/60 dark:divide-[#31275E]">
              
              {/* Theme Selection: Light, Charcoal Dark, AMOLED Black */}
              <div className="p-4 space-y-3">
                <div className="flex items-center gap-3.5">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${settings.darkMode ? 'bg-[#7045D8]/15 text-[#7045D8]' : 'bg-[#7045D8]/10 text-[#7045D8]'}`}>
                    {settings.darkMode ? <Moon size={20} /> : <Sun size={20} />}
                  </div>
                  <div>
                    <span className="text-sm font-bold text-slate-900 dark:text-slate-50 block">Theme & Night Mode</span>
                    <span className="text-[11px] text-slate-600 dark:text-slate-300 font-medium uppercase tracking-tight">
                      {settings.darkMode ? (settings.amoledBlack ? "AMOLED Pitch Black (#000000)" : "Charcoal Dark Mode") : "Light Mode (Day)"}
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
                        ? 'bg-[#7045D8] text-white border-[#7045D8] shadow-sm font-black'
                        : 'bg-[#F8FAFC] dark:bg-[#130E26] text-slate-600 dark:text-slate-300 border-slate-200 dark:border-[#31275E] font-semibold'
                    }`}
                  >
                    <span className="text-[11px] block">Light</span>
                    <span className="text-[11px] opacity-75 block">Day Mode</span>
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
                        ? 'bg-[#7045D8] text-white border-[#7045D8] shadow-sm font-black'
                        : 'bg-[#F8FAFC] dark:bg-[#130E26] text-slate-600 dark:text-slate-300 border-slate-200 dark:border-[#31275E] font-semibold'
                    }`}
                  >
                    <span className="text-[11px] block">Charcoal</span>
                    <span className="text-[11px] opacity-75 block">Dark Mode</span>
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
                        ? 'bg-black text-amber-400 border-amber-500/70 shadow-sm font-black'
                        : 'bg-[#F8FAFC] dark:bg-[#130E26] text-slate-600 dark:text-slate-300 border-slate-200 dark:border-[#31275E] font-semibold'
                    }`}
                  >
                    <span className="text-[11px] block">AMOLED</span>
                    <span className="text-[11px] opacity-75 block">Pitch Black</span>
                  </button>
                </div>
              </div>

              {/* Eye-Comfort Shield (Warm Amber Tint) */}
              <div className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3.5">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${settings.eyeComfort ? 'bg-amber-500/20 text-amber-500' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>
                    <Eye size={20} />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-bold text-slate-900 dark:text-slate-50">Eye-Comfort Shield</span>
                      <span className="text-[11px] px-1.5 py-0.2 rounded font-extrabold bg-amber-500/15 text-amber-600 dark:text-amber-400">
                        Night Reading
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-600 dark:text-slate-300 font-medium block">
                      Warm amber shield — reduces blue light &amp; eye strain during night study
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

              {/* Text Size */}
              <div className="p-4 space-y-3.5">
                <div className="flex items-center gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-[#A78BFA]/15 text-amber-500 flex items-center justify-center">
                    <Type size={20} />
                  </div>
                  <div>
                    <span className="text-sm font-bold text-slate-900 dark:text-slate-50 block">Question Font Size</span>
                    <span className="text-[11px] text-slate-600 dark:text-slate-300 font-medium uppercase tracking-tight">Reading Comfort Scale</span>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {(['S', 'M', 'L'] as const).map((size) => (
                    <button
                      key={size}
                      onClick={() => updateSetting({ textSize: size })}
                      className={`py-2 rounded-xl text-[11px] font-black transition-all cursor-pointer ${
                        settings.textSize === size
                          ? 'bg-[#7045D8] dark:bg-[#7045D8] text-white shadow-sm'
                          : 'bg-[#F8FAFC] dark:bg-[#130E26] text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-[#31275E]'
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
            <h4 className="text-[11px] font-black text-[#7045D8] dark:text-[#A78BFA] uppercase tracking-[0.18em] px-1">
              Practice Controls
            </h4>
            <div className="bg-white dark:bg-[#1B1536] rounded-2xl border border-slate-200 dark:border-[#31275E] shadow-2xs divide-y divide-slate-200/60 dark:divide-[#31275E]">
              
              {/* Daily Target */}
              <div className="p-4 space-y-3.5">
                <div className="flex items-center gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-[#15803D]/10 text-[#15803D] dark:text-emerald-400 flex items-center justify-center">
                    <Target size={20} />
                  </div>
                  <div>
                    <span className="text-sm font-bold text-slate-900 dark:text-slate-50 block">Daily Goal</span>
                    <span className="text-[11px] text-slate-600 dark:text-slate-300 font-medium uppercase tracking-tight">Target MCQs Per Day</span>
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {[20, 30, 50, 100].map((count) => (
                    <button
                      key={count}
                      onClick={() => updateSetting({ dailyGoal: count })}
                      className={`py-2 rounded-xl text-[11px] font-black font-mono tabular-nums transition-all cursor-pointer ${
                        settings.dailyGoal === count
                          ? 'bg-[#7045D8] dark:bg-[#7045D8] text-white shadow-sm'
                          : 'bg-[#F8FAFC] dark:bg-[#130E26] text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-[#31275E]'
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
                  <div className="w-10 h-10 rounded-xl bg-[#7045D8]/10 dark:bg-[#7045D8]/15 text-[#7045D8] dark:text-[#A78BFA] flex items-center justify-center">
                    <Shuffle size={20} />
                  </div>
                  <div>
                    <span className="text-sm font-bold text-slate-900 dark:text-slate-50 block">Randomize Practice</span>
                    <span className="text-[11px] text-slate-600 dark:text-slate-300 font-medium uppercase tracking-tight">Shuffle Questions</span>
                  </div>
                </div>
                <button 
                  onClick={() => toggleSetting('shuffleQuestions')}
                  className={`w-12 h-6.5 rounded-full transition-all relative p-1 cursor-pointer ${settings.shuffleQuestions ? 'bg-[#7045D8] dark:bg-[#7045D8]' : 'bg-slate-200 dark:bg-[#31275E]'}`}
                >
                  <div className={`w-4.5 h-4.5 rounded-full bg-white shadow-sm transition-transform ${settings.shuffleQuestions ? 'translate-x-5.5' : 'translate-x-0'}`} />
                </button>
              </div>

              {/* Instant Explanation */}
              <div className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-[#7045D8]/15 text-[#7045D8] flex items-center justify-center">
                    <Zap size={20} />
                  </div>
                  <div>
                    <span className="text-sm font-bold text-slate-900 dark:text-slate-50 block">Instant Solutions</span>
                    <span className="text-[11px] text-slate-600 dark:text-slate-300 font-medium uppercase tracking-tight">Explanation On Tap</span>
                  </div>
                </div>
                <button 
                  onClick={() => toggleSetting('instantExplanation')}
                  className={`w-12 h-6.5 rounded-full transition-all relative p-1 cursor-pointer ${settings.instantExplanation !== false ? 'bg-[#7045D8] dark:bg-[#7045D8]' : 'bg-slate-200 dark:bg-[#31275E]'}`}
                >
                  <div className={`w-4.5 h-4.5 rounded-full bg-white shadow-sm transition-transform ${settings.instantExplanation !== false ? 'translate-x-5.5' : 'translate-x-0'}`} />
                </button>
              </div>
            </div>
          </div>

          {/* Section: Feedback */}
          <div className="space-y-2.5">
            <h4 className="text-[11px] font-black text-[#7045D8] dark:text-[#A78BFA] uppercase tracking-[0.18em] px-1">
              Audio & Haptics
            </h4>
            <div className="bg-white dark:bg-[#1B1536] rounded-2xl border border-slate-200 dark:border-[#31275E] shadow-2xs divide-y divide-slate-200/60 dark:divide-[#31275E]">
              
              {/* Sound Effects */}
              <div className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-[#7045D8]/10 dark:bg-[#7045D8]/15 text-[#7045D8] dark:text-[#A78BFA] flex items-center justify-center">
                    <Volume2 size={20} />
                  </div>
                  <div>
                    <span className="text-sm font-bold text-slate-900 dark:text-slate-50 block">Audio Chimes</span>
                    <span className="text-[11px] text-slate-600 dark:text-slate-300 font-medium uppercase tracking-tight">Audio Feedback</span>
                  </div>
                </div>
                <button 
                  onClick={() => {
                    toggleSetting('soundEffects');
                    if (!settings.soundEffects) playCorrectSound(true);
                  }}
                  className={`w-12 h-6.5 rounded-full transition-all relative p-1 cursor-pointer ${settings.soundEffects !== false ? 'bg-[#7045D8] dark:bg-[#7045D8]' : 'bg-slate-200 dark:bg-[#31275E]'}`}
                >
                  <div className={`w-4.5 h-4.5 rounded-full bg-white shadow-sm transition-transform ${settings.soundEffects !== false ? 'translate-x-5.5' : 'translate-x-0'}`} />
                </button>
              </div>

              {/* Haptics */}
              <div className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-[#A78BFA]/15 text-amber-500 flex items-center justify-center">
                    <Smartphone size={20} />
                  </div>
                  <div>
                    <span className="text-sm font-bold text-slate-900 dark:text-slate-50 block">Vibration Feedback</span>
                    <span className="text-[11px] text-slate-600 dark:text-slate-300 font-medium uppercase tracking-tight">Haptic Touch</span>
                  </div>
                </div>
                <button 
                  onClick={() => toggleSetting('hapticFeedback')}
                  className={`w-12 h-6.5 rounded-full transition-all relative p-1 cursor-pointer ${settings.hapticFeedback !== false ? 'bg-[#7045D8] dark:bg-[#7045D8]' : 'bg-slate-200 dark:bg-[#31275E]'}`}
                >
                  <div className={`w-4.5 h-4.5 rounded-full bg-white shadow-sm transition-transform ${settings.hapticFeedback !== false ? 'translate-x-5.5' : 'translate-x-0'}`} />
                </button>
              </div>
            </div>
          </div>

          {/* Section: Custom Gemini API Key */}
          <div className="space-y-2.5">
            <h4 className="text-[11px] font-black text-[#7045D8] dark:text-[#A78BFA] uppercase tracking-[0.18em] px-1">
              Smart Assistant Key
            </h4>
            <div className="bg-white dark:bg-[#1B1536] rounded-2xl border border-slate-200 dark:border-[#31275E] shadow-2xs p-4 space-y-3">
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-[#7045D8]/15 text-[#7045D8] flex items-center justify-center shrink-0">
                  <Sparkles size={20} />
                </div>
                <div>
                  <span className="text-sm font-bold text-slate-900 dark:text-slate-50 block">Personal Gemini Key (Optional)</span>
                  <span className="text-[11px] text-slate-600 dark:text-slate-300 font-medium leading-tight block">Leave blank to use the built-in Disha PYQ platform engine.</span>
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
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-[#31275E] bg-[#F8FAFC] dark:bg-[#130E26] text-slate-900 dark:text-slate-50 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-[#7045D8] dark:focus:ring-[#A78BFA]"
                />
                <div className="flex items-center justify-between pt-1">
                  <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                    {settings.geminiApiKey ? "✓ Custom API key configured." : "Using Disha PYQ default server key."}
                  </p>
                  {settings.geminiApiKey && (
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase">Use Key:</span>
                      <button 
                        onClick={() => updateSetting({ useCustomApiKey: !settings.useCustomApiKey })}
                        className={`w-8 h-4.5 rounded-full transition-all relative p-0.5 cursor-pointer ${settings.useCustomApiKey ? 'bg-[#7045D8]' : 'bg-slate-200 dark:bg-[#31275E]'}`}
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
            <p className="text-[11px] font-black text-[#7045D8] dark:text-[#A78BFA] uppercase tracking-[0.2em]">
              Disha PYQ • Previous Year Questions & Precision Learning
            </p>
          </div>
        </div>

        {/* Footer */}
        <footer className="p-4 sm:p-5 bg-white dark:bg-[#1B1536] border-t border-slate-200 dark:border-[#31275E] shrink-0">
          <button 
            onClick={onClose}
            className="w-full py-3.5 bg-[#7045D8] hover:bg-[#5B32BF] dark:bg-[#7045D8] dark:hover:bg-[#5B32BF] text-white rounded-2xl text-xs font-black uppercase tracking-widest shadow-md cursor-pointer active:scale-95 transition-transform"
          >
            Apply & Close
          </button>
        </footer>
      </div>
    </div>
  );
};
