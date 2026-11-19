import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  ArrowRight,
  BookOpen,
  BarChart3,
  Compass,
  Trophy,
  CheckCircle2,
  X,
  Sparkles,
} from "lucide-react";
import { AppLogo } from "./AppLogo";
import { triggerHaptic } from "../utils/audioFeedback";
import {
  safeGetSessionStorageItem,
  safeSetSessionStorageItem,
  safeGetLocalStorageItem,
  safeSetLocalStorageItem,
} from "../utils/safeStorage";

const ONBOARDING_STORAGE_KEY = "disha_onboarding_done_v1";

interface BrandSplashAndOnboardingProps {
  /** Only trigger first-run onboarding automatically when landing on home without deep links */
  allowAutoOnboarding?: boolean;
}

const ONBOARDING_SLIDES = [
  {
    id: "direction",
    kicker: "01 · सही दिशा (RIGHT DIRECTION)",
    title: "राजस्थान एवं भारतीय प्रतियोगी परीक्षा पाठ्यक्रम",
    subtitle: "व्यवस्थित पाठ्यक्रम एवं अध्यायवार MCQ अभ्यास",
    description:
      "RAS, REET, पटवार, 1st Grade, CET एवं RPSC भर्ती परीक्षाओं के लिए विषयवार अध्याय, प्रामाणिक 20-20 रिवीज़न सेट्स और विस्तृत व्याख्याएं।",
    icon: Compass,
    highlights: [
      "विषय, अध्याय व टॉपिक स्तर पर सटीक प्रगति ट्रैकिंग",
      "एकाग्रता-संवर्धित विज्ञापनों से मुक्त पठन अनुभव",
    ],
  },
  {
    id: "practice",
    kicker: "02 · सटीक तैयारी (ACCURATE PRACTICE)",
    title: "लाइव मॉक टेस्ट एवं आधिकारिक PYQ वॉल्ट",
    subtitle: "वास्तविक परीक्षा सिमुलेशन व विगत वर्ष प्रश्न",
    description:
      "RPSC के नवीनतम 5-विकल्प (Option E) व 1/3 नेगेटिव मार्किंग नियमों के साथ आधिकारिक विगत वर्ष पेपर्स हल करें और अपनी राज्य रैंक जांचें।",
    icon: Trophy,
    highlights: [
      "वास्तविक परीक्षा समयबद्धता व RPSC नेगेटिव मार्किंग",
      "विगत 20 वर्षों के 10,000+ हल प्रश्न त्वरित व्याख्या सहित",
    ],
  },
  {
    id: "analysis",
    kicker: "03 · स्मार्ट विश्लेषण (SMART ANALYTICS)",
    title: "मिस्टेक बैंक एवं स्पेसड रिपीटीशन",
    subtitle: "त्रुटि निवारण व गहन प्रदर्शन विश्लेषण",
    description:
      "प्रत्येक गलत प्रश्न स्वतः आपके व्यक्तिगत मिस्टेक बैंक में दर्ज होता है, जिसे 3 → 7 → 21 → 45 दिन के वैज्ञानिक स्पेसड रिपीटीशन चक्र से पक्का किया जाता है।",
    icon: BarChart3,
    highlights: [
      "दिन 3 → 7 → 21 → 45 स्पेसड रिपीटीशन रिवीज़न चक्र",
      "7-दिवसीय एक्यूरेसी ट्रेंड्स व परीक्षा तत्परता स्कोर",
    ],
  },
];

export const BrandSplashAndOnboarding: React.FC<BrandSplashAndOnboardingProps> = ({
  allowAutoOnboarding = true,
}) => {
  const [showSplash, setShowSplash] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    try {
      if (safeGetSessionStorageItem("disha_splash_seen_v1") === "1") return false;
      if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return false;
      return true;
    } catch {
      return false;
    }
  });

  const [showOnboarding, setShowOnboarding] = useState<boolean>(false);
  const [slideIndex, setSlideIndex] = useState<number>(0);

  useEffect(() => {
    if (!showSplash) {
      if (allowAutoOnboarding) {
        try {
          const done = safeGetLocalStorageItem(ONBOARDING_STORAGE_KEY);
          if (!done) {
            // Keep first load uncluttered when splash skipped
          }
        } catch {}
      }
      return;
    }

    const timer = window.setTimeout(() => {
      try {
        safeSetSessionStorageItem("disha_splash_seen_v1", "1");
      } catch {}
      setShowSplash(false);
      if (allowAutoOnboarding) {
        try {
          if (!safeGetLocalStorageItem(ONBOARDING_STORAGE_KEY)) {
            setShowOnboarding(true);
          }
        } catch {}
      }
    }, 1350);

    return () => window.clearTimeout(timer);
  }, [showSplash, allowAutoOnboarding]);

  useEffect(() => {
    const handleReplay = () => {
      setSlideIndex(0);
      setShowOnboarding(true);
    };
    window.addEventListener("disha-replay-onboarding", handleReplay);
    return () => window.removeEventListener("disha-replay-onboarding", handleReplay);
  }, []);

  const dismissSplash = () => {
    try {
      triggerHaptic("light");
      safeSetSessionStorageItem("disha_splash_seen_v1", "1");
    } catch {}
    setShowSplash(false);
  };

  const completeOnboarding = () => {
    try {
      triggerHaptic("light");
      safeSetLocalStorageItem(ONBOARDING_STORAGE_KEY, "1");
    } catch {}
    setShowOnboarding(false);
  };

  const currentSlide = ONBOARDING_SLIDES[slideIndex] || ONBOARDING_SLIDES[0];
  const SlideIcon = currentSlide.icon;

  return (
    <>
      <AnimatePresence>
        {showSplash && (
          <motion.div
            key="disha-splash"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 0.99 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            onClick={dismissSplash}
            className="fixed inset-0 z-[120] bg-[#0A0D15] text-[#FFF9EF] flex flex-col items-center justify-center p-6 select-none cursor-pointer overflow-hidden"
            role="status"
            aria-label="दिशा 20-20 लोड हो रहा है"
          >
            {/* 1. Next-Level Minimalist Ambient Lighting (Color Theory 60-30-10) */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              {/* Subtle Gold Ambient Center Glow (Royal Elegance) */}
              <div
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 sm:w-[480px] h-80 sm:h-[480px] rounded-full bg-[#C99A45]/12 blur-3xl opacity-80 animate-pulse pointer-events-none"
                style={{ animationDuration: "4s" }}
              />
              {/* Restrained Kesariya / Saffron Micro-Aura in Upper Right (Strategic Accent) */}
              <div className="absolute -top-20 -right-20 w-72 h-72 rounded-full bg-[#F47B20]/10 blur-3xl pointer-events-none" />
              {/* Subtle Deep Velvet Warmth at Base */}
              <div className="absolute -bottom-24 -left-20 w-80 h-80 rounded-full bg-[#C99A45]/8 blur-3xl pointer-events-none" />

              {/* Ultra-Fine Minimal Geometric Compass Rings */}
              <div className="absolute inset-0 flex items-center justify-center opacity-[0.04] pointer-events-none">
                <div
                  className="w-[360px] h-[360px] sm:w-[480px] sm:h-[480px] rounded-full border border-[#C99A45] animate-spin"
                  style={{ animationDuration: "90s" }}
                />
                <div className="absolute w-[240px] h-[240px] sm:w-[320px] sm:h-[320px] rounded-full border border-[#FFF9EF]" />
              </div>
            </div>

            {/* 2. Main Luxury Brand Emblem Container */}
            <motion.div
              initial={{ scale: 0.94, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
              className="relative z-10 flex flex-col items-center text-center max-w-sm"
            >
              {/* Emblem Squircle Frame with Crisp Gold Accent Border */}
              <div className="relative mb-6">
                <div className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-3xl bg-gradient-to-b from-white/10 to-white/5 backdrop-blur-2xl border border-[#C99A45]/40 shadow-[0_12px_40px_rgba(0,0,0,0.6),inset_0_1px_1px_rgba(255,255,255,0.25)] p-3.5 flex items-center justify-center">
                  <img
                    src="/brand-logo.png"
                    alt="DISHA 20-20 Logo"
                    className="w-full h-full object-contain filter drop-shadow-[0_4px_12px_rgba(0,0,0,0.5)]"
                  />
                  {/* Delicate Micro-Accents in Corners */}
                  <div className="absolute top-2 left-2 w-1.5 h-1.5 rounded-full bg-[#C99A45]/70" />
                  <div className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-[#F47B20]/70" />
                </div>
              </div>

              {/* Brand Typography: DISHA 20-20 */}
              <div className="flex items-center justify-center gap-2.5">
                <span className="text-3xl sm:text-4xl font-black tracking-tight text-[#FFF9EF] drop-shadow-md font-sans">
                  DISHA
                </span>
                <span className="px-3 py-0.5 rounded-xl bg-gradient-to-r from-[#F47B20] to-[#E06716] text-white font-black text-lg sm:text-xl tracking-tight shadow-[0_4px_16px_rgba(244,123,32,0.4)] border border-[#C99A45]/40">
                  20-20
                </span>
              </div>

              {/* Hindi Brand Name & Category Badge */}
              <div className="mt-2 flex items-center gap-2 text-xs font-black text-[#C99A45] tracking-[0.2em] uppercase">
                <span>दिशा 20-20</span>
                <span className="text-[7px] opacity-60">◆</span>
                <span className="text-[#FFF9EF]/90">भर्ती परीक्षा विशेषांक</span>
              </div>

              {/* Minimalist Divider */}
              <div className="flex items-center gap-3 my-3">
                <div className="w-10 sm:w-14 h-px bg-gradient-to-r from-transparent to-[#C99A45]/50" />
                <span className="text-[#C99A45] text-[10px]">✦</span>
                <div className="w-10 sm:w-14 h-px bg-gradient-to-l from-transparent to-[#C99A45]/50" />
              </div>

              {/* Official Bilingual Tagline */}
              <p className="text-sm sm:text-base font-bold text-[#FFF9EF] tracking-wide leading-snug">
                "सही दिशा, सटीक तैयारी"
              </p>
              <p className="text-[11px] font-medium text-[#C99A45]/90 mt-0.5 tracking-wider">
                Right Direction • Accurate Preparation
              </p>

              {/* Target Exams Pill */}
              <div className="mt-4 px-3.5 py-1 rounded-full bg-white/5 backdrop-blur-md border border-[#C99A45]/25 shadow-xs flex items-center gap-1.5">
                <Sparkles className="w-3 h-3 text-[#F47B20] shrink-0" />
                <span className="text-[10px] sm:text-[11px] font-bold text-[#C99A45] tracking-tight">
                  RAS • REET • 1st Grade • Patwar • CET • RPSC
                </span>
              </div>
            </motion.div>

            {/* 3. Bottom Minimalist Progress Bar & Version Notice */}
            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2.5 pointer-events-none z-10">
              {/* Ultra-Thin High-Precision Shimmer Loader */}
              <div className="w-36 sm:w-44 h-[2px] bg-white/10 rounded-full overflow-hidden relative shadow-inner">
                <motion.div
                  className="absolute top-0 bottom-0 rounded-full bg-gradient-to-r from-[#C99A45] via-[#F47B20] to-[#C99A45] shadow-[0_0_10px_rgba(244,123,32,0.8)]"
                  initial={{ left: "-45%", width: "45%" }}
                  animate={{ left: "100%", width: "45%" }}
                  transition={{ repeat: Infinity, duration: 1.15, ease: "easeInOut" }}
                />
              </div>

              <div className="flex items-center gap-2 text-[9px] font-mono text-[#FFF9EF]/45 tracking-[0.2em] uppercase">
                <span>2026 EDITION</span>
                <span>•</span>
                <span>50 DISTRICTS UPDATED</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Onboarding Dialog */}
      <AnimatePresence>
        {!showSplash && showOnboarding && (
          <motion.div
            key="disha-onboarding"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[115] bg-[#0A0D15]/80 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4"
          >
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 20, opacity: 0 }}
              className="w-full max-w-md bg-[#FFFDF9] dark:bg-[#111622] text-[#171923] dark:text-[#FFF9EF] rounded-t-3xl sm:rounded-3xl border border-[#E8D9C0] dark:border-[#263045] shadow-2xl overflow-hidden"
            >
              {/* Header */}
              <div className="px-5 pt-5 pb-3 flex items-center justify-between border-b border-[#E8D9C0]/70 dark:border-[#263045]">
                <AppLogo size="sm" variant="horizontal" showTagline={false} />
                <button
                  type="button"
                  onClick={completeOnboarding}
                  className="px-3 py-1.5 rounded-xl text-xs font-bold text-[#52576A] dark:text-[#CBD2E1] hover:bg-[#F7EFE2] dark:hover:bg-[#1D2538] transition-colors cursor-pointer flex items-center gap-1"
                >
                  <span>स्किप (Skip)</span>
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Slide Content */}
              <div className="px-6 py-6 space-y-5">
                <div className="flex items-center gap-3.5">
                  <div className="w-12 h-12 rounded-2xl bg-[#C99A45]/15 dark:bg-[#C99A45]/20 text-[#C99A45] flex items-center justify-center shadow-xs shrink-0 border border-[#C99A45]/30">
                    <SlideIcon className="w-6 h-6 text-[#C99A45]" />
                  </div>
                  <div>
                    <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#C99A45] block">
                      {currentSlide.kicker}
                    </span>
                    <h2 className="text-base sm:text-lg font-black text-[#171923] dark:text-[#FFF9EF] leading-snug">
                      {currentSlide.title}
                    </h2>
                  </div>
                </div>

                <div className="bg-white dark:bg-[#0D111A] border border-[#E8D9C0] dark:border-[#263045] rounded-2xl p-4 space-y-3 shadow-xs">
                  <p className="text-xs font-bold text-[#C99A45]">
                    {currentSlide.subtitle}
                  </p>
                  <p className="text-xs sm:text-sm text-[#52576A] dark:text-[#CBD2E1] leading-relaxed">
                    {currentSlide.description}
                  </p>
                  <div className="pt-2 space-y-2 border-t border-[#E8D9C0]/70 dark:border-[#263045]">
                    {currentSlide.highlights.map((item) => (
                      <div
                        key={item}
                        className="flex items-center gap-2 text-xs font-semibold text-[#171923] dark:text-[#FFF9EF]"
                      >
                        <CheckCircle2 className="w-4 h-4 text-[#F47B20] shrink-0" />
                        <span>{item}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Progress Dots & Saffron Primary Button */}
                <div className="flex items-center justify-between pt-1">
                  <div className="flex items-center gap-1.5">
                    {ONBOARDING_SLIDES.map((s, idx) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => {
                          triggerHaptic("light");
                          setSlideIndex(idx);
                        }}
                        aria-label={`Go to step ${idx + 1}`}
                        className={`h-2 rounded-full transition-all cursor-pointer ${
                          idx === slideIndex
                            ? "w-7 bg-gradient-to-r from-[#C99A45] to-[#F47B20]"
                            : "w-2 bg-[#E8D9C0] dark:bg-[#263045]"
                        }`}
                      />
                    ))}
                  </div>

                  {slideIndex < ONBOARDING_SLIDES.length - 1 ? (
                    <button
                      type="button"
                      onClick={() => {
                        triggerHaptic("light");
                        setSlideIndex((prev) => prev + 1);
                      }}
                      className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#F47B20] to-[#E06716] hover:brightness-105 text-white text-xs font-black flex items-center gap-1.5 shadow-[0_4px_14px_rgba(244,123,32,0.35)] border border-[#C99A45]/30 active:scale-95 transition-all cursor-pointer"
                    >
                      <span>आगे बढ़ें (Next)</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={completeOnboarding}
                      className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#F47B20] to-[#E06716] hover:brightness-105 text-white text-xs font-black flex items-center gap-1.5 shadow-[0_4px_16px_rgba(244,123,32,0.4)] border border-[#C99A45]/30 active:scale-95 transition-all cursor-pointer"
                    >
                      <BookOpen className="w-4 h-4" />
                      <span>अभ्यास शुरू करें</span>
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
