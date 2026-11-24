import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Rocket, 
  ShieldAlert, 
  ArrowRight, 
  Download, 
  Sparkles, 
  CheckCircle2, 
  X,
  ExternalLink,
  Flame,
} from 'lucide-react';
import { UpdateCheckResult } from '../utils/versionUtils';

interface AppUpdateModalProps {
  updateInfo: UpdateCheckResult;
  isOpen: boolean;
  onDismiss?: () => void;
  isPreview?: boolean;
}

export const AppUpdateModal: React.FC<AppUpdateModalProps> = ({
  updateInfo,
  isOpen,
  onDismiss,
  isPreview = false,
}) => {
  if (!isOpen) return null;

  const isHardLock = updateInfo.isHardLock && !isPreview;

  const handleUpdateClick = () => {
    if (typeof window !== 'undefined') {
      const url = updateInfo.downloadUrl || 'https://github.com/jagdishpaliyaljat-dev/disha-20-20-app/releases/latest';
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6 bg-slate-950/80 backdrop-blur-md">
        {/* Animated Card Container */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          transition={{ type: 'spring', damping: 25, stiffness: 350 }}
          className="relative w-full max-w-md bg-gradient-to-b from-[#1C1628] to-[#120E1C] border border-amber-500/30 rounded-[32px] p-6 sm:p-8 shadow-2xl shadow-purple-950/50 overflow-hidden text-center"
        >
          {/* Ambient Glow */}
          <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-48 h-48 bg-amber-500/20 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 right-0 w-48 h-48 bg-purple-600/20 rounded-full blur-3xl pointer-events-none" />

          {/* Dismiss button only for soft update or preview */}
          {(!isHardLock || isPreview) && onDismiss && (
            <button
              onClick={onDismiss}
              className="absolute top-4 right-4 p-2 rounded-full bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>
          )}

          {/* Header Icon */}
          <div className="relative mx-auto mb-5 w-20 h-20 rounded-3xl bg-gradient-to-tr from-amber-500 to-purple-600 p-[2px] shadow-lg shadow-amber-500/25">
            <div className="w-full h-full bg-[#1A1426] rounded-[22px] flex items-center justify-center">
              {isHardLock ? (
                <ShieldAlert className="w-10 h-10 text-amber-400 animate-pulse" />
              ) : (
                <Rocket className="w-10 h-10 text-amber-400" />
              )}
            </div>
            {isHardLock && (
              <span className="absolute -bottom-1 -right-1 px-2 py-0.5 rounded-full bg-rose-600 text-white font-black text-[9px] uppercase tracking-wider shadow">
                REQUIRED
              </span>
            )}
          </div>

          {/* Version Chips */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs font-mono font-bold mb-3">
            <span className="text-slate-400">v{updateInfo.currentVersion}</span>
            <ArrowRight className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-amber-300 font-extrabold">v{updateInfo.latestVersion}</span>
          </div>

          {/* Title & Message */}
          <h2 className="text-xl sm:text-2xl font-black text-white font-hindi tracking-tight mb-2">
            {updateInfo.title || (isHardLock ? 'महत्वपूर्ण अपडेट आवश्यक है' : 'नया अपडेट उपलब्ध है!')}
          </h2>
          <p className="text-xs sm:text-sm text-slate-300 font-hindi leading-relaxed mb-6">
            {updateInfo.message}
          </p>

          {/* Release Notes / What's New */}
          {updateInfo.releaseNotes && updateInfo.releaseNotes.length > 0 && (
            <div className="mb-6 p-4 rounded-2xl bg-white/[0.03] border border-white/10 text-left">
              <div className="flex items-center gap-1.5 text-xs font-bold text-amber-400 uppercase tracking-wider mb-2.5">
                <Sparkles className="w-3.5 h-3.5" />
                <span>इस अपडेट में क्या नया है:</span>
              </div>
              <ul className="space-y-2">
                {updateInfo.releaseNotes.map((note, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-xs text-slate-200 font-hindi leading-snug">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span>{note}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Action CTA Buttons */}
          <div className="space-y-2.5">
            <button
              onClick={handleUpdateClick}
              className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-400 hover:to-orange-500 text-slate-950 font-black text-sm uppercase tracking-wider flex items-center justify-center gap-2.5 shadow-xl shadow-amber-500/25 active:scale-[0.98] transition-all cursor-pointer"
            >
              <Download className="w-4 h-4 stroke-[3]" />
              <span>अपडेट डाउनलोड करें (Download APK)</span>
              <ExternalLink className="w-3.5 h-3.5 opacity-70" />
            </button>

            {(!isHardLock || isPreview) && onDismiss && (
              <button
                onClick={onDismiss}
                className="w-full py-2.5 text-xs font-bold text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                बाद में याद दिलाएं (Remind Me Later)
              </button>
            )}
          </div>

          {isPreview && (
            <div className="mt-4 pt-3 border-t border-white/10 text-[11px] font-mono text-amber-400/80">
              🛠️ Admin Preview Mode Active
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default AppUpdateModal;
