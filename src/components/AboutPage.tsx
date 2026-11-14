import React from "react";
import {
  ArrowLeft,
  CheckCircle2,
  Trophy,
  TrendingUp,
  RotateCcw,
  BookOpen,
  Zap,
  Target,
  Eye,
  ShieldAlert,
  ArrowRight,
  ExternalLink,
  Sparkles,
  Home,
  Check,
  HeartHandshake,
} from "lucide-react";
import { AppLogo } from "./AppLogo";

interface AboutPageProps {
  onNavigateHome: () => void;
  onStartPracticing: () => void;
  onOpenPrivacyPolicy?: () => void;
  onOpenTerms?: () => void;
  onOpenContact?: () => void;
  onOpenDisclaimer?: () => void;
}

export const AboutPage: React.FC<AboutPageProps> = ({
  onNavigateHome,
  onStartPracticing,
  onOpenPrivacyPolicy,
  onOpenTerms,
  onOpenContact,
  onOpenDisclaimer,
}) => {
  const offerings = [
    {
      title: "MCQ Practice",
      description: "Practice multiple-choice questions across various subjects and topics.",
      icon: CheckCircle2,
      color: "text-[#800020] dark:text-[#F47B20]",
      bg: "bg-[#800020]/10 dark:bg-[#F47B20]/15",
      border: "border-[#800020]/20 dark:border-[#F47B20]/25",
    },
    {
      title: "Mock Tests",
      description: "Test your knowledge and improve your exam readiness.",
      icon: Trophy,
      color: "text-[#F47B20]",
      bg: "bg-[#F47B20]/10 dark:bg-[#F47B20]/15",
      border: "border-[#F47B20]/25",
    },
    {
      title: "Performance Analysis",
      description: "Understand your performance and identify areas for improvement.",
      icon: TrendingUp,
      color: "text-[#C99A45]",
      bg: "bg-[#C99A45]/15 dark:bg-[#C99A45]/25",
      border: "border-[#C99A45]/30",
    },
    {
      title: "Wrong Question Practice",
      description: "Revisit incorrectly answered questions to strengthen your understanding.",
      icon: RotateCcw,
      color: "text-[#800020] dark:text-[#F47B20]",
      bg: "bg-[#800020]/10 dark:bg-[#800020]/20",
      border: "border-[#800020]/25",
    },
    {
      title: "Topic-Wise Learning",
      description: "Organize your practice by subject, chapter, and topic wherever supported.",
      icon: BookOpen,
      color: "text-[#800020] dark:text-[#C99A45]",
      bg: "bg-[#800020]/10 dark:bg-[#C99A45]/15",
      border: "border-[#800020]/20 dark:border-[#C99A45]/25",
    },
    {
      title: "Continuous Improvement",
      description: "Develop a consistent study routine through regular practice and revision.",
      icon: Zap,
      color: "text-[#F47B20]",
      bg: "bg-[#F47B20]/10 dark:bg-[#F47B20]/15",
      border: "border-[#F47B20]/25",
    },
  ];

  const whyChoosePoints = [
    "Simple and user-friendly interface.",
    "Convenient access across supported devices.",
    "Organized MCQ practice experience.",
    "Focus on learning, revision, and self-assessment.",
    "Designed to support consistent preparation habits.",
  ];

  return (
    <div className="min-h-full bg-[#FFF9EF] dark:bg-[#171923] text-[#171923] dark:text-[#FFF9EF] flex flex-col pb-24 select-text">
      {/* Top Header / Navigation Bar */}
      <header className="sticky top-0 z-40 bg-white/95 dark:bg-[#1F2330]/95 backdrop-blur-md border-b border-[#E8D9C0] dark:border-[#31374A] px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <button
            onClick={onNavigateHome}
            aria-label="Back to Homepage"
            className="p-2 -ml-1 rounded-xl text-[#52576A] dark:text-[#CBD2E1] hover:bg-[#FFF9EF] dark:hover:bg-[#252A3A] transition-colors active:scale-95 cursor-pointer flex items-center gap-1.5 text-xs font-bold"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Home</span>
          </button>
          <div className="h-4 w-px bg-[#E8D9C0] dark:bg-[#31374A]" />
          <div className="flex items-center gap-2 cursor-pointer" onClick={onNavigateHome} role="button" tabIndex={0}>
            <AppLogo size="sm" variant="horizontal" showTagline={true} />
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-2xl mx-auto w-full px-4 pt-6 space-y-6">
        {/* 1. Hero & Welcome Section */}
        <section className="bg-white dark:bg-[#1F2330] rounded-3xl p-5 sm:p-7 border border-[#E8D9C0] dark:border-[#31374A] shadow-2xs space-y-4">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-[#800020]/10 dark:bg-[#F47B20]/15 border border-[#800020]/20 dark:border-[#F47B20]/30 text-[#800020] dark:text-[#F47B20] text-[11px] font-black uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5" />
            <span>About DISHA 20-20</span>
          </div>

          <h1 className="text-xl sm:text-2xl font-black text-[#171923] dark:text-[#FFF9EF] tracking-tight leading-snug">
            Welcome to DISHA 20-20 — Right Direction, Accurate Preparation!
          </h1>

          <p className="text-xs sm:text-sm text-[#52576A] dark:text-[#CBD2E1] leading-relaxed font-normal">
            DISHA 20-20 is a dedicated competitive-exam learning and MCQ practice platform designed to help Rajasthan and Indian exam aspirants master RPSC, RSMSSB, REET, CET, RAS, and other competitive examinations.
          </p>

          <p className="text-xs sm:text-sm text-[#52576A] dark:text-[#CBD2E1] leading-relaxed font-normal">
            Our goal is to make exam preparation structured, accessible, and effective through topic-wise practice, official PYQs, and spaced revision.
          </p>

          <div className="pt-2 flex flex-wrap gap-2.5">
            <button
              onClick={onStartPracticing}
              className="px-5 py-2.5 bg-[#800020] hover:bg-[#5E0017] dark:bg-[#F47B20] dark:hover:bg-[#E06A12] text-white font-bold text-xs rounded-xl shadow-sm transition-all active:scale-95 flex items-center gap-2 cursor-pointer"
            >
              <span>Start Practicing</span>
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              onClick={onNavigateHome}
              className="px-4 py-2.5 bg-[#F7EFE2] hover:bg-[#E8D9C0] dark:bg-[#252A3A] dark:hover:bg-[#31374A] text-[#171923] dark:text-[#FFF9EF] font-bold text-xs rounded-xl transition-all active:scale-95 flex items-center gap-2 cursor-pointer"
            >
              <Home className="w-4 h-4" />
              <span>Explore Homepage</span>
            </button>
          </div>
        </section>

        {/* 2. Our Mission */}
        <section className="bg-[#F7EFE2] dark:bg-[#1F2330] rounded-3xl p-5 sm:p-6 border border-[#E8D9C0] dark:border-[#31374A] shadow-2xs space-y-2.5">
          <div className="flex items-center gap-2 text-[#800020] dark:text-[#F47B20]">
            <Target className="w-5 h-5" />
            <h2 className="text-base sm:text-lg font-black tracking-tight text-[#171923] dark:text-[#FFF9EF]">
              Our Mission
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-[#52576A] dark:text-[#CBD2E1] leading-relaxed">
            Our mission is to make quality bilingual practice resources accessible to every aspirant and help them build exam confidence through consistent practice, self-assessment, and continuous improvement.
          </p>
        </section>

        {/* 3. What We Offer */}
        <section className="space-y-3.5">
          <div className="px-1">
            <h2 className="text-base sm:text-lg font-black text-[#171923] dark:text-[#FFF9EF] tracking-tight">
              What We Offer
            </h2>
            <p className="text-xs text-[#52576A] dark:text-[#CBD2E1] mt-0.5">
              Available features and study modules on the DISHA 20-20 platform:
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {offerings.map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.title}
                  className="bg-white dark:bg-[#1F2330] rounded-2xl p-4 border border-[#E8D9C0] dark:border-[#31374A] shadow-2xs flex items-start gap-3 hover:border-[#800020] dark:hover:border-[#F47B20] transition-colors"
                >
                  <div className={`p-2 rounded-xl shrink-0 ${item.bg} ${item.color} ${item.border} border`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-xs font-black text-[#171923] dark:text-[#FFF9EF]">
                      {item.title}
                    </h3>
                    <p className="text-[11px] text-[#52576A] dark:text-[#CBD2E1] leading-snug">
                      {item.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* 4. Our Vision */}
        <section className="bg-white dark:bg-[#1F2330] rounded-3xl p-5 sm:p-6 border border-[#E8D9C0] dark:border-[#31374A] shadow-2xs space-y-2.5">
          <div className="flex items-center gap-2 text-[#F47B20]">
            <Eye className="w-5 h-5" />
            <h2 className="text-base sm:text-lg font-black tracking-tight text-[#171923] dark:text-[#FFF9EF]">
              Our Vision
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-[#52576A] dark:text-[#CBD2E1] leading-relaxed">
            We envision a learning platform where students can practice smarter, track their progress, identify knowledge gaps, and approach their examinations with greater confidence.
          </p>
        </section>

        {/* 5. Why Choose DISHA 20-20? */}
        <section className="bg-white dark:bg-[#1F2330] rounded-3xl p-5 sm:p-6 border border-[#E8D9C0] dark:border-[#31374A] shadow-2xs space-y-3.5">
          <div className="flex items-center gap-2 text-[#15803D] dark:text-emerald-400">
            <CheckCircle2 className="w-5 h-5" />
            <h2 className="text-base sm:text-lg font-black tracking-tight text-[#171923] dark:text-[#FFF9EF]">
              Why Choose DISHA 20-20?
            </h2>
          </div>

          <ul className="space-y-2.5 pt-1">
            {whyChoosePoints.map((point) => (
              <li key={point} className="flex items-start gap-2.5 text-xs sm:text-sm text-[#52576A] dark:text-[#CBD2E1]">
                <span className="p-1 rounded-full bg-[#15803D]/10 text-[#15803D] dark:text-emerald-400 shrink-0 mt-0.5">
                  <Check className="w-3 h-3 stroke-[3]" />
                </span>
                <span className="leading-relaxed">{point}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* 6. Our Commitment */}
        <section className="bg-white dark:bg-[#1F2330] rounded-3xl p-5 sm:p-6 border border-[#E8D9C0] dark:border-[#31374A] shadow-2xs space-y-2.5">
          <div className="flex items-center gap-2 text-[#800020] dark:text-[#F47B20]">
            <HeartHandshake className="w-5 h-5" />
            <h2 className="text-base sm:text-lg font-black tracking-tight text-[#171923] dark:text-[#FFF9EF]">
              Our Commitment
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-[#52576A] dark:text-[#CBD2E1] leading-relaxed">
            At DISHA 20-20, we aim to provide a reliable and accessible learning experience. We continuously strive to improve our platform, usability, and learning resources to better support our users.
          </p>
        </section>

        {/* 7. Important Disclaimer */}
        <section className="bg-[#FFF9EF] dark:bg-[#1F2330] rounded-3xl p-5 sm:p-6 border border-[#C99A45]/50 shadow-2xs space-y-2.5">
          <div className="flex items-center gap-2 text-[#C99A45]">
            <ShieldAlert className="w-5 h-5 shrink-0" />
            <h2 className="text-sm sm:text-base font-black tracking-tight text-[#171923] dark:text-[#FFF9EF]">
              Important Disclaimer
            </h2>
          </div>
          <p className="text-[11px] sm:text-xs text-[#52576A] dark:text-[#CBD2E1] leading-relaxed">
            DISHA 20-20 is an independent educational practice platform. Unless explicitly stated, it is not affiliated with or endorsed by any government authority, examination board, or recruitment organization. Users should verify official examination notifications, syllabi, and rules through the relevant official sources.
          </p>
        </section>

        {/* 8. Get Started with DISHA 20-20 (Bottom CTA) */}
        <section className="bg-gradient-to-br from-[#800020] to-[#520014] text-white rounded-3xl p-6 sm:p-8 shadow-md space-y-4 text-center">
          <div className="space-y-1.5 max-w-md mx-auto">
            <h2 className="text-lg sm:text-xl font-black tracking-tight">
              Get Started with DISHA 20-20
            </h2>
            <p className="text-xs sm:text-sm text-[#FFF9EF]/90 leading-relaxed">
              Make every practice session count. Explore DISHA 20-20 and take the next step toward your competitive exam goals.
            </p>
          </div>

          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              onClick={onStartPracticing}
              className="w-full sm:w-auto px-6 py-3 bg-[#F47B20] hover:bg-[#E06A12] text-white font-extrabold text-xs sm:text-sm rounded-xl shadow-md transition-all active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>Start Practicing</span>
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              onClick={onNavigateHome}
              className="w-full sm:w-auto px-5 py-3 bg-white/10 hover:bg-white/20 text-white font-bold text-xs sm:text-sm rounded-xl transition-all active:scale-95 flex items-center justify-center gap-2 cursor-pointer border border-white/20"
            >
              <Home className="w-4 h-4" />
              <span>Back to Home</span>
            </button>
          </div>
        </section>

        {/* 9. Trust & Legal Navigation Links */}
        <section className="pt-4 border-t border-[#E8D9C0] dark:border-[#31374A] text-center space-y-3">
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs font-semibold text-[#52576A] dark:text-[#CBD2E1]">
            <button
              onClick={onNavigateHome}
              className="hover:text-[#800020] dark:hover:text-[#F47B20] transition-colors cursor-pointer"
            >
              Home
            </button>
            <span>•</span>
            <button
              onClick={onOpenPrivacyPolicy}
              className="hover:text-[#800020] dark:hover:text-[#F47B20] transition-colors cursor-pointer"
            >
              Privacy Policy
            </button>
            <span>•</span>
            <button
              onClick={onOpenTerms}
              className="hover:text-[#800020] dark:hover:text-[#F47B20] transition-colors cursor-pointer"
            >
              Terms & Conditions
            </button>
            <span>•</span>
            <button
              onClick={onOpenContact}
              className="hover:text-[#800020] dark:hover:text-[#F47B20] transition-colors cursor-pointer"
            >
              Contact Us
            </button>
            <span>•</span>
            <button
              onClick={onOpenDisclaimer}
              className="hover:text-[#800020] dark:hover:text-[#F47B20] transition-colors cursor-pointer"
            >
              Disclaimer
            </button>
          </div>

          <p className="text-[10px] text-[#787D91] dark:text-[#929AB0]">
            © 2026 DISHA 20-20. All rights reserved. Competitive Exam Preparation Platform.
          </p>
        </section>
      </main>
    </div>
  );
};
