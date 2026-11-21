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
} from "lucide-react";
import { AppLogo } from "./AppLogo";
import { triggerHaptic } from "../utils/audioFeedback";
import {
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
    kicker: "01 · RIGHT DIRECTION",
    title: "Competitive Examination Curriculum",
    subtitle: "Structured Syllabus & Chapter-Wise MCQ Practice",
    description:
      "Subject-wise chapters, authentic 20-20 revision question sets, and comprehensive explanations tailored for RAS, REET, Patwar, 1st Grade, CET, and state recruitment examinations.",
    icon: Compass,
    highlights: [
      "Precise progress tracking across subjects, chapters, and topics",
      "Distraction-free, focus-enhanced ad-free learning experience",
    ],
  },
  {
    id: "practice",
    kicker: "02 · ACCURATE PRACTICE",
    title: "Live Mock Tests & Official PYQ Vault",
    subtitle: "Real Exam Simulation & Past Year Question Papers",
    description:
      "Solve official past year exam papers featuring latest 5-option (Option E) format with 1/3rd negative marking rules and assess your state merit rank.",
    icon: Trophy,
    highlights: [
      "Real-time exam timing with official negative marking criteria",
      "10,000+ solved questions from the past 20 years with verified explanations",
    ],
  },
  {
    id: "analysis",
    kicker: "03 · SMART ANALYTICS",
    title: "Mistake Bank & Spaced Repetition",
    subtitle: "Error Elimination & Deep Diagnostic Performance Analytics",
    description:
      "Every incorrectly answered question is automatically saved to your personal Mistake Bank, reinforced via the scientific 3 → 7 → 21 → 45 day spaced repetition revision cycle.",
    icon: BarChart3,
    highlights: [
      "Day 3 → 7 → 21 → 45 spaced repetition mastery cycles",
      "7-day accuracy trends and comprehensive exam readiness score",
    ],
  },
];

export const BrandSplashAndOnboarding: React.FC<BrandSplashAndOnboardingProps> = () => {
  const [showOnboarding, setShowOnboarding] = useState<boolean>(false);
  const [slideIndex, setSlideIndex] = useState<number>(0);

  useEffect(() => {
    const handleReplay = () => {
      setSlideIndex(0);
      setShowOnboarding(true);
    };
    window.addEventListener("disha-replay-onboarding", handleReplay);
    return () => window.removeEventListener("disha-replay-onboarding", handleReplay);
  }, []);

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
      {/* Onboarding Dialog */}
      <AnimatePresence>
        {showOnboarding && (
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
                  <span>Skip</span>
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
                      <span>Next</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={completeOnboarding}
                      className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#F47B20] to-[#E06716] hover:brightness-105 text-white text-xs font-black flex items-center gap-1.5 shadow-[0_4px_16px_rgba(244,123,32,0.4)] border border-[#C99A45]/30 active:scale-95 transition-all cursor-pointer"
                    >
                      <BookOpen className="w-4 h-4" />
                      <span>Start Practice</span>
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
