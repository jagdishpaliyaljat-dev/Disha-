import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ArrowRight, BookOpen, BarChart3, Compass, Trophy, CheckCircle2, X } from "lucide-react";
import { AppLogo } from "./AppLogo";

const ONBOARDING_STORAGE_KEY = "disha_onboarding_done_v1";

interface BrandSplashAndOnboardingProps {
  /** Only trigger first-run onboarding automatically when landing on home without deep links */
  allowAutoOnboarding?: boolean;
}

const ONBOARDING_SLIDES = [
  {
    id: "direction",
    kicker: "01 · RIGHT DIRECTION",
    title: "Structured Rajasthan & Indian Exam Syllabus",
    subtitle: "Comprehensive curriculum and chapter-wise MCQ practice",
    description:
      "Master RAS, REET, Patwar, 1st Grade, CET & RPSC exams with subject-wise chapters, detailed explanations, and daily 20-20 revision sets.",
    icon: Compass,
    highlights: [
      "Subject, chapter & topic mastery tracking",
      "Clean, focused distraction-free reading mode",
    ],
  },
  {
    id: "practice",
    kicker: "02 · ACCURATE PRACTICE",
    title: "Live Mock Tests & Official PYQ Vault",
    subtitle: "Real-time mock simulations & previous year papers",
    description:
      "Simulate real exam timing with negative marking rules, attempt official previous year papers, and benchmark your All-India rank.",
    icon: Trophy,
    highlights: [
      "Real-time mock tests & coaching series",
      "Official PYQ archive with instant solutions",
    ],
  },
  {
    id: "analysis",
    kicker: "03 · SMART ANALYTICS",
    title: "Mistake Bank & Spaced Repetition",
    subtitle: "Error correction and in-depth performance analytics",
    description:
      "Every wrong answer enters your personal Mistake Bank with spaced-repetition intervals so weak topics turn into guaranteed marks.",
    icon: BarChart3,
    highlights: [
      "Day 3 → 7 → 21 → 45 → 75 revision cycle",
      "7-day accuracy trends & exam readiness score",
    ],
  },
];

export const BrandSplashAndOnboarding: React.FC<BrandSplashAndOnboardingProps> = ({
  allowAutoOnboarding = true,
}) => {
  const [showSplash, setShowSplash] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    try {
      if (sessionStorage.getItem("disha_splash_seen_v1") === "1") return false;
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
          const done = localStorage.getItem(ONBOARDING_STORAGE_KEY);
          if (!done) {
            // Keep first load uncluttered when splash skipped; mark only after interaction or show gently
          }
        } catch {}
      }
      return;
    }

    const timer = window.setTimeout(() => {
      try {
        sessionStorage.setItem("disha_splash_seen_v1", "1");
      } catch {}
      setShowSplash(false);
      if (allowAutoOnboarding) {
        try {
          if (!localStorage.getItem(ONBOARDING_STORAGE_KEY)) {
            setShowOnboarding(true);
          }
        } catch {}
      }
    }, 850);

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
      sessionStorage.setItem("disha_splash_seen_v1", "1");
    } catch {}
    setShowSplash(false);
  };

  const completeOnboarding = () => {
    try {
      localStorage.setItem(ONBOARDING_STORAGE_KEY, "1");
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
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            onClick={dismissSplash}
            className="fixed inset-0 z-[120] bg-[#800020] text-[#FFF9EF] flex flex-col items-center justify-center p-6 select-none cursor-pointer"
            role="status"
            aria-label="Loading DISHA 20-20"
          >
            <motion.div
              initial={{ scale: 0.94, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.28 }}
              className="flex flex-col items-center text-center"
            >
              <div className="w-20 h-20 rounded-3xl bg-[#FFF9EF]/10 border border-[#C99A45]/45 p-2 shadow-xl mb-4 flex items-center justify-center">
                <AppLogo size="xl" variant="icon" showText={false} />
              </div>

              <div className="flex items-center gap-2">
                <span className="text-3xl sm:text-4xl font-black tracking-tight text-[#FFF9EF]">
                  DISHA
                </span>
                <span className="px-2.5 py-0.5 rounded-lg bg-[#F47B20] text-white font-extrabold text-lg tracking-tight shadow-sm">
                  20-20
                </span>
              </div>

              <p className="mt-2 text-xs font-extrabold tracking-[0.22em] uppercase text-[#FFF9EF]/85">
                EXAM PREPARATION PLATFORM
              </p>

              <div className="w-24 h-px bg-[#C99A45]/50 my-3" />

              <p className="text-xs font-semibold text-[#FFF9EF]/80">
                Right Direction, Accurate Preparation
              </p>
            </motion.div>
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
              className="w-full max-w-md bg-[#FFF9EF] dark:bg-[#1F2330] text-[#171923] dark:text-[#FFF9EF] rounded-t-3xl sm:rounded-3xl border border-[#E8D9C0] dark:border-[#31374A] shadow-2xl overflow-hidden"
            >
              {/* Header */}
              <div className="px-5 pt-5 pb-3 flex items-center justify-between border-b border-[#E8D9C0]/80 dark:border-[#31374A]">
                <AppLogo size="sm" variant="horizontal" showTagline={false} />
                <button
                  type="button"
                  onClick={completeOnboarding}
                  className="px-3 py-1.5 rounded-xl text-xs font-bold text-[#52576A] dark:text-[#CBD2E1] hover:bg-[#F7EFE2] dark:hover:bg-[#252A3A] transition-colors cursor-pointer flex items-center gap-1"
                >
                  <span>Skip</span>
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Slide Content */}
              <div className="px-6 py-6 space-y-5">
                <div className="flex items-center gap-3.5">
                  <div className="w-12 h-12 rounded-2xl bg-[#800020] dark:bg-[#F47B20] text-[#FFF9EF] flex items-center justify-center shadow-sm shrink-0">
                    <SlideIcon className="w-6 h-6" />
                  </div>
                  <div>
                    <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#F47B20] dark:text-[#C99A45] block">
                      {currentSlide.kicker}
                    </span>
                    <h2 className="text-lg font-extrabold text-[#171923] dark:text-[#FFF9EF] leading-snug">
                      {currentSlide.title}
                    </h2>
                  </div>
                </div>

                <div className="bg-white dark:bg-[#171923] border border-[#E8D9C0] dark:border-[#31374A] rounded-2xl p-4 space-y-3">
                  <p className="text-xs font-bold text-[#800020] dark:text-[#F47B20]">
                    {currentSlide.subtitle}
                  </p>
                  <p className="text-xs sm:text-sm text-[#52576A] dark:text-[#CBD2E1] leading-relaxed">
                    {currentSlide.description}
                  </p>
                  <div className="pt-1 space-y-2 border-t border-[#E8D9C0]/70 dark:border-[#31374A]">
                    {currentSlide.highlights.map((item) => (
                      <div key={item} className="flex items-center gap-2 text-xs font-semibold text-[#171923] dark:text-[#FFF9EF]">
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
                        onClick={() => setSlideIndex(idx)}
                        aria-label={`Go to step ${idx + 1}`}
                        className={`h-2 rounded-full transition-all cursor-pointer ${
                          idx === slideIndex
                            ? "w-6 bg-[#800020] dark:bg-[#F47B20]"
                            : "w-2 bg-[#E8D9C0] dark:bg-[#31374A]"
                        }`}
                      />
                    ))}
                  </div>

                  {slideIndex < ONBOARDING_SLIDES.length - 1 ? (
                    <button
                      type="button"
                      onClick={() => setSlideIndex((prev) => prev + 1)}
                      className="px-5 py-2.5 rounded-xl bg-[#800020] hover:bg-[#5E0017] dark:bg-[#F47B20] dark:hover:bg-[#E06A12] text-white text-xs font-extrabold flex items-center gap-1.5 shadow-sm active:scale-95 transition-all cursor-pointer"
                    >
                      <span>Next</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={completeOnboarding}
                      className="px-5 py-2.5 rounded-xl bg-[#F47B20] hover:bg-[#E06A12] text-white text-xs font-extrabold flex items-center gap-1.5 shadow-sm active:scale-95 transition-all cursor-pointer"
                    >
                      <BookOpen className="w-4 h-4" />
                      <span>Start Practicing</span>
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
