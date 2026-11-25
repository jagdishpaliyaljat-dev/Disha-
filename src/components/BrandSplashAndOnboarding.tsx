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
            role="dialog"
            aria-modal="true"
            aria-label="Welcome to Disha PYQ"
            className="fixed inset-0 z-[115] bg-slate-950/80 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4"
          >
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 20, opacity: 0 }}
              className="w-full max-w-md bg-[#F8FAFC] dark:bg-[#130E26] text-slate-900 dark:text-slate-50 rounded-t-3xl sm:rounded-3xl border border-slate-200 dark:border-[#31275E] shadow-2xl overflow-hidden pb-[env(safe-area-inset-bottom,0px)]"
            >
              {/* Header */}
              <div className="px-5 pt-5 pb-3 flex items-center justify-between border-b border-slate-200 dark:border-[#31275E]">
                <AppLogo size="sm" variant="horizontal" showTagline={false} />
                <button
                  type="button"
                  onClick={completeOnboarding}
                  className="min-h-[44px] px-3 py-1.5 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-[#241D48] transition-colors cursor-pointer flex items-center gap-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7045D8]"
                >
                  <span>Skip</span>
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Slide Content */}
              <div className="px-6 py-6 space-y-5">
                <div className="flex items-center gap-3.5">
                  <div className="w-12 h-12 rounded-2xl bg-[#7045D8]/12 dark:bg-[#A78BFA]/15 text-[#7045D8] dark:text-[#A78BFA] flex items-center justify-center shadow-xs shrink-0 border border-[#7045D8]/25">
                    <SlideIcon className="w-6 h-6" />
                  </div>
                  <div>
                    <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#7045D8] dark:text-[#A78BFA] block">
                      {currentSlide.kicker}
                    </span>
                    <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-slate-50 leading-snug">
                      {currentSlide.title}
                    </h2>
                  </div>
                </div>

                <div className="bg-white dark:bg-[#1B1536] border border-slate-200 dark:border-[#31275E] rounded-2xl p-4 space-y-3 shadow-xs">
                  <p className="text-xs font-bold text-[#7045D8] dark:text-[#A78BFA]">
                    {currentSlide.subtitle}
                  </p>
                  <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                    {currentSlide.description}
                  </p>
                  <div className="pt-2 space-y-2 border-t border-slate-200 dark:border-[#31275E]">
                    {currentSlide.highlights.map((item) => (
                      <div
                        key={item}
                        className="flex items-center gap-2 text-xs font-semibold text-slate-900 dark:text-slate-100"
                      >
                        <CheckCircle2 className="w-4 h-4 text-[#7045D8] dark:text-[#A78BFA] shrink-0" />
                        <span>{item}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Progress Dots & Primary Button */}
                <div className="flex items-center justify-between pt-1">
                  <div className="flex items-center gap-1">
                    {ONBOARDING_SLIDES.map((s, idx) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => {
                          triggerHaptic("light");
                          setSlideIndex(idx);
                        }}
                        aria-label={`Go to step ${idx + 1}`}
                        className="min-w-[28px] min-h-[44px] flex items-center justify-center cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7045D8] rounded-lg"
                      >
                        <span
                          className={`h-2 rounded-full transition-all block ${
                            idx === slideIndex
                              ? "w-7 bg-gradient-to-r from-[#7045D8] to-[#A78BFA]"
                              : "w-2 bg-slate-300 dark:bg-[#31275E]"
                          }`}
                        />
                      </button>
                    ))}
                  </div>

                  {slideIndex < ONBOARDING_SLIDES.length - 1 ? (
                    <button
                      type="button"
                      onClick={() => {
                        triggerHaptic("light");
                        setSlideIndex((prev) => prev + 1);
                      }}
                      className="min-h-[44px] px-5 py-2.5 rounded-xl bg-[#7045D8] hover:bg-[#5B32BF] text-white text-xs font-black flex items-center gap-1.5 shadow-md shadow-[#7045D8]/25 border border-[#A78BFA]/30 active:scale-95 transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7045D8]"
                    >
                      <span>Next</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={completeOnboarding}
                      className="min-h-[44px] px-5 py-2.5 rounded-xl bg-[#7045D8] hover:bg-[#5B32BF] text-white text-xs font-black flex items-center gap-1.5 shadow-md shadow-[#7045D8]/30 border border-[#A78BFA]/30 active:scale-95 transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7045D8]"
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
