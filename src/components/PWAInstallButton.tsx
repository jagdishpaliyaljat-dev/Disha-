import React, { useState } from "react";
import { usePWAInstall } from '../hooks/usePWAInstall';
import { Download, X, Smartphone, MoreVertical } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);

  // If already running as an installed PWA, hide the button
  if (isInstalled) {
    return null;
  }

  const handleInstallClick = async () => {
    if (isInstallable) {
      await install();
    } else {
      setShowGuide(true);
    }
  };

  return (
    <>
      <button
        onClick={handleInstallClick}
        className="w-9 h-9 rounded-xl bg-[#800020] hover:bg-[#5E0017] dark:bg-[#F47B20] dark:hover:bg-[#E06A12] flex items-center justify-center text-[#FFF9EF] shadow-xs transition active:scale-95 cursor-pointer shrink-0"
        title="Install DISHA 20-20 App"
        aria-label="Install DISHA 20-20 App"
      >
        <Download className="w-4 h-4" />
      </button>

      <AnimatePresence>
        {showGuide && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#171923]/65 backdrop-blur-xs p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.94 }}
              className="w-full max-w-sm rounded-3xl bg-[#FFF9EF] p-6 shadow-2xl dark:bg-[#1F2330] border border-[#E8D9C0] dark:border-[#31374A] space-y-4"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-[#800020]/10 dark:bg-[#F47B20]/15 text-[#800020] dark:text-[#F47B20] flex items-center justify-center">
                    <Smartphone className="w-5 h-5" />
                  </div>
                  <h3 className="text-base font-extrabold text-[#171923] dark:text-[#FFF9EF]">Install DISHA 20-20 App</h3>
                </div>
                <button onClick={() => setShowGuide(false)} className="text-[#52576A] hover:text-[#171923] dark:text-[#929AB0] dark:hover:text-[#FFF9EF] p-1.5 rounded-lg cursor-pointer">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-3 text-xs text-[#52576A] dark:text-[#CBD2E1] leading-relaxed">
                {isIOS ? (
                  <div className="space-y-2">
                    <p className="font-bold text-[#171923] dark:text-[#FFF9EF]">For iPhone / iPad (Safari):</p>
                    <p>1. Tap the <strong className="text-[#800020] dark:text-[#F47B20]">Share</strong> icon in the Safari toolbar at the bottom.</p>
                    <p>2. Scroll down and tap <strong className="text-[#800020] dark:text-[#F47B20]">Add to Home Screen</strong>.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="font-bold text-[#171923] dark:text-[#FFF9EF]">For Android / Chrome Browser:</p>
                    <p className="flex items-center gap-1.5">
                      1. Tap the 3-dot menu icon <span className="inline-flex items-center justify-center w-6 h-6 rounded bg-[#F7EFE2] dark:bg-[#252A3A] text-[#171923] dark:text-[#FFF9EF] font-bold"><MoreVertical className="w-4 h-4" /></span> in the top right corner of Chrome.
                    </p>
                    <p>2. Tap <strong className="text-[#800020] dark:text-[#F47B20]">Install app</strong> or <strong className="text-[#800020] dark:text-[#F47B20]">Add to Home screen</strong>.</p>
                    <p>3. Confirm to add DISHA 20-20 to your mobile home screen for quick, app-like access!</p>
                  </div>
                )}
              </div>

              <div className="pt-2">
                <button
                  onClick={() => setShowGuide(false)}
                  className="w-full rounded-xl bg-[#800020] dark:bg-[#F47B20] py-3 text-xs font-extrabold text-white hover:opacity-95 transition cursor-pointer"
                >
                  Got It
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};
