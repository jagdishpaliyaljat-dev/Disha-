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
            // Keep first load uncluttered when splash skipped; mark only after interaction or show gently
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
            exit={{ opacity: 0, scale: 1.02 }}
            transition={{ duration: 0.32, ease: "easeInOut" }}
            onClick={dismissSplash}
            className="fixed inset-0 z-[120] bg-gradient-to-b from-[#240009] via-[#480014] to-[#150006] text-[#FFF9EF] flex flex-col items-center justify-center p-6 select-none cursor-pointer overflow-hidden"
            role="status"
            aria-label="दिशा 20-20 लोड हो रहा है"
          >
            {/* 1. Ambient Background Lighting & Atmospheric Gradients */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              {/* Center Royal Gold / Saffron Pulse Aura */}
              <div
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 sm:w-[440px] h-80 sm:h-[440px] rounded-full bg-gradient-to-tr from-[#C99A45]/25 via-[#F47B20]/15 to-transparent blur-3xl opacity-75 animate-pulse"
                style={{ animationDuration: "3.5s" }}
              />
              {/* Top-Right Saffron Ambient Glow */}
              <div className="absolute -top-24 -right-24 w-80 h-80 rounded-full bg-[#F47B20]/20 blur-3xl" />
              {/* Bottom-Left Deep Maroon Ambient Glow */}
              <div className="absolute -bottom-24 -left-24 w-80 h-80 rounded-full bg-[#800020]/50 blur-3xl" />

              {/* Subtle Concentric Rings (Regal Heritage Compass Ring) */}
              <div className="absolute inset-0 flex items-center justify-center opacity-[0.06]">
                <div
                  className="w-[340px] h-[340px] sm:w-[460px] sm:h-[460px] rounded-full border border-[#E2B755] border-dashed animate-spin"
                  style={{ animationDuration: "60s" }}
                />
                <div className="absolute w-[260px] h-[260px] sm:w-[360px] sm:h-[360px] rounded-full border border-[#FFF9EF]" />
                <div className="absolute w-[180px] h-[180px] sm:w-[260px] sm:h-[260px] rounded-full border border-[#C99A45]/80 border-dotted" />
              </div>
            </div>

            {/* 2. Main Brand Emblem & Hierarchy Container */}
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 12 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
              className="relative z-10 flex flex-col items-center text-center max-w-sm"
            >
              {/* Outer Squircle Frame with Layered Glow & Gold Border */}
              <div className="relative mb-5 group">
                <div className="absolute -inset-1 rounded-[32px] bg-gradient-to-r from-[#C99A45] via-[#F47B20] to-[#E2B755] opacity-50 blur-md" />
                <div className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-[28px] bg-gradient-to-b from-[#FFF9EF]/18 to-[#FFF9EF]/6 backdrop-blur-2xl border border-[#C99A45]/50 shadow-[0_12px_40px_rgba(0,0,0,0.6),inset_0_1px_1px_rgba(255,255,255,0.4)] p-3.5 flex items-center justify-center">
                  <img
                    src="/brand-logo.png"
                    alt="DISHA 20-20 Logo"
                    className="w-full h-full object-contain filter drop-shadow-[0_4px_12px_rgba(0,0,0,0.45)]"
                  />
                  {/* Subtle Inner Corner Accents */}
                  <div className="absolute top-1.5 left-1.5 w-2 h-2 border-t border-l border-[#C99A45]/70 rounded-tl-xs pointer-events-none" />
                  <div className="absolute top-1.5 right-1.5 w-2 h-2 border-t border-r border-[#C99A45]/70 rounded-tr-xs pointer-events-none" />
                  <div className="absolute bottom-1.5 left-1.5 w-2 h-2 border-b border-l border-[#C99A45]/70 rounded-bl-xs pointer-events-none" />
                  <div className="absolute bottom-1.5 right-1.5 w-2 h-2 border-b border-r border-[#C99A45]/70 rounded-br-xs pointer-events-none" />
                </div>
              </div>

              {/* Brand Title: DISHA 20-20 */}
              <div className="flex items-center justify-center gap-2.5">
                <span className="text-3xl sm:text-4xl font-black tracking-tight text-[#FFF9EF] drop-shadow-md font-sans">
                  DISHA
                </span>
                <span className="px-3 py-1 rounded-xl bg-gradient-to-r from-[#F47B20] to-[#E06A12] text-white font-black text-lg sm:text-xl tracking-tight shadow-[0_4px_16px_rgba(244,123,32,0.45)] border border-[#FFB066]/50">
                  20-20
                </span>
              </div>

              {/* Hindi Brand Name & Category Badge */}
              <div className="mt-1.5 flex items-center gap-1.5 text-xs font-black text-[#E2B755] tracking-widest uppercase">
                <span>दिशा 20-20</span>
                <span className="text-[8px] opacity-70">◆</span>
                <span>भर्ती परीक्षा विशेषांक</span>
              </div>

              {/* Royal Heritage Star Divider */}
              <div className="flex items-center gap-2.5 my-3.5">
                <div className="w-12 sm:w-16 h-px bg-gradient-to-r from-transparent to-[#C99A45]/70" />
                <span className="text-[#E2B755] text-xs">✦</span>
                <div className="w-12 sm:w-16 h-px bg-gradient-to-l from-transparent to-[#C99A45]/70" />
              </div>

              {/* Official Brand Tagline (Bilingual) */}
              <p className="text-sm sm:text-base font-bold text-[#FFF9EF] tracking-wide leading-snug drop-shadow-xs">
                "सही दिशा, सटीक तैयारी"
              </p>
              <p className="text-[11px] font-semibold text-[#FFF9EF]/75 mt-0.5 tracking-wider">
                Right Direction • Accurate Preparation
              </p>

              {/* Target Exams Pill */}
              <div className="mt-4 px-3.5 py-1.5 rounded-full bg-black/35 backdrop-blur-md border border-[#C99A45]/35 shadow-xs flex items-center gap-1.5">
                <Sparkles className="w-3 h-3 text-[#F47B20] shrink-0" />
                <span className="text-[10px] sm:text-[11px] font-bold text-[#E2B755] tracking-tight">
                  RAS • REET • 1st Grade • Patwar • CET • RPSC
                </span>
              </div>
            </motion.div>

            {/* 3. Bottom Minimal Progress & Edition Bar */}
            <div className="absolute bottom-7 sm:bottom-9 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 pointer-events-none z-10">
              {/* Elegant Indeterminate Shimmer Loader */}
              <div className="w-32 sm:w-40 h-[2.5px] bg-white/12 rounded-full overflow-hidden relative shadow-inner">
                <motion.div
                  className="absolute top-0 bottom-0 rounded-full bg-gradient-to-r from-[#C99A45] via-[#F47B20] to-[#E2B755] shadow-[0_0_8px_rgba(244,123,32,0.8)]"
                  initial={{ left: "-45%", width: "45%" }}
                  animate={{ left: "100%", width: "45%" }}
                  transition={{ repeat: Infinity, duration: 1.15, ease: "easeInOut" }}
                />
              </div>

              <div className="flex items-center gap-1.5 text-[9px] font-mono text-[#FFF9EF]/55 tracking-widest uppercase">
                <span>2026 EDITION</span>
                <span>•</span>
                <span>50 DISTRICTS UPDATED</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {!showSplash && showOnboarding && (
          <motion.div
            key="disha-onboarding"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[115] bg-[#171923]/75 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4"
          >
            <motion.div
              initial={{ y: 24, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 24, opacity: 0 }}
              className="w-full max-w-md bg-[#FFF9EF] dark:bg-[#1A1D27] text-[#171923] dark:text-[#FFF9EF] rounded-t-3xl sm:rounded-3xl border border-[#E8D9C0] dark:border-[#31374A] shadow-2xl overflow-hidden"
            >
              {/* Header */}
              <div className="px-5 pt-5 pb-3 flex items-center justify-between border-b border-[#E8D9C0]/80 dark:border-[#31374A]">
                <AppLogo size="sm" variant="horizontal" showTagline={false} />
                <button
                  type="button"
                  onClick={completeOnboarding}
                  className="px-3 py-1.5 rounded-xl text-xs font-bold text-[#52576A] dark:text-[#CBD2E1] hover:bg-[#F7EFE2] dark:hover:bg-[#252A3A] transition-colors cursor-pointer flex items-center gap-1"
                >
                  <span>स्किप (Skip)</span>
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Slide Content */}
              <div className="px-6 py-6 space-y-5">
                <div className="flex items-center gap-3.5">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#800020] to-[#5E0017] dark:from-[#F47B20] dark:to-[#C85A0A] text-[#FFF9EF] flex items-center justify-center shadow-md shrink-0 border border-[#C99A45]/30">
                    <SlideIcon className="w-6 h-6" />
                  </div>
                  <div>
                    <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#F47B20] dark:text-[#C99A45] block">
                      {currentSlide.kicker}
                    </span>
                    <h2 className="text-base sm:text-lg font-black text-[#171923] dark:text-[#FFF9EF] leading-snug">
                      {currentSlide.title}
                    </h2>
                  </div>
                </div>

                <div className="bg-white dark:bg-[#12141C] border border-[#E8D9C0] dark:border-[#31374A] rounded-2xl p-4 space-y-3 shadow-xs">
                  <p className="text-xs font-bold text-[#800020] dark:text-[#F47B20]">
                    {currentSlide.subtitle}
                  </p>
                  <p className="text-xs sm:text-sm text-[#52576A] dark:text-[#CBD2E1] leading-relaxed">
                    {currentSlide.description}
                  </p>
                  <div className="pt-2 space-y-2 border-t border-[#E8D9C0]/70 dark:border-[#31374A]">
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

                {/* Progress Indicator & CTA */}
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
                            ? "w-7 bg-gradient-to-r from-[#800020] to-[#F47B20] dark:from-[#F47B20] dark:to-[#E06A12]"
                            : "w-2 bg-[#E8D9C0] dark:bg-[#31374A]"
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
                      className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#800020] to-[#5E0017] hover:brightness-110 text-white text-xs font-extrabold flex items-center gap-1.5 shadow-md active:scale-95 transition-all cursor-pointer"
                    >
                      <span>आगे बढ़ें (Next)</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={completeOnboarding}
                      className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#F47B20] to-[#E06A12] hover:brightness-110 text-white text-xs font-extrabold flex items-center gap-1.5 shadow-md active:scale-95 transition-all cursor-pointer"
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
