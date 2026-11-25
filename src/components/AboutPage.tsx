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
      color: "text-[#7045D8] dark:text-[#A78BFA]",
      bg: "bg-[#7045D8]/10 dark:bg-[#7045D8]/15",
      border: "border-[#7045D8]/20 dark:border-[#A78BFA]/25",
    },
    {
      title: "Mock Tests",
      description: "Test your knowledge and improve your exam readiness.",
      icon: Trophy,
      color: "text-amber-600 dark:text-amber-400",
      bg: "bg-amber-500/10 dark:bg-amber-500/15",
      border: "border-amber-500/25",
    },
    {
      title: "Performance Analysis",
      description: "Understand your performance and identify areas for improvement.",
      icon: TrendingUp,
      color: "text-emerald-600 dark:text-emerald-400",
      bg: "bg-emerald-500/10 dark:bg-emerald-500/20",
      border: "border-emerald-500/25",
    },
    {
      title: "Wrong Question Practice",
      description: "Revisit incorrectly answered questions to strengthen your understanding.",
      icon: RotateCcw,
      color: "text-[#7045D8] dark:text-[#A78BFA]",
      bg: "bg-[#7045D8]/10 dark:bg-[#7045D8]/20",
      border: "border-[#7045D8]/25",
    },
    {
      title: "Topic-Wise Learning",
      description: "Organize your practice by subject, chapter, and topic wherever supported.",
      icon: BookOpen,
      color: "text-[#7045D8] dark:text-[#A78BFA]",
      bg: "bg-[#7045D8]/10 dark:bg-[#A78BFA]/15",
      border: "border-[#7045D8]/20 dark:border-[#A78BFA]/25",
    },
    {
      title: "Continuous Improvement",
      description: "Develop a consistent study routine through regular practice and revision.",
      icon: Zap,
      color: "text-amber-600 dark:text-amber-400",
      bg: "bg-amber-500/10 dark:bg-amber-500/15",
      border: "border-amber-500/25",
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
    <div className="min-h-full bg-[#F8FAFC] dark:bg-[#130E26] text-slate-900 dark:text-slate-50 flex flex-col pb-24 select-text">
      {/* Top Header / Navigation Bar */}
      <header className="sticky top-0 z-40 bg-white/95 dark:bg-[#130E26]/95 backdrop-blur-md border-b border-slate-200 dark:border-[#31275E] pt-[env(safe-area-inset-top,0px)]">
        <div className="px-4 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={onNavigateHome}
            aria-label="Back to Homepage"
            className="min-h-[44px] px-3 -ml-1 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#241D48] transition-colors active:scale-95 cursor-pointer flex items-center gap-1.5 text-xs font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7045D8]"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Home</span>
          </button>
          <div className="h-4 w-px bg-slate-200 dark:bg-[#31275E]" />
          <div
            className="flex items-center gap-2 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7045D8] rounded-xl px-1"
            onClick={onNavigateHome}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onNavigateHome();
              }
            }}
            role="button"
            tabIndex={0}
            aria-label="Disha PYQ Home"
          >
            <AppLogo size="sm" variant="horizontal" showTagline={true} />
          </div>
        </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-2xl mx-auto w-full px-4 pt-6 space-y-6">
        {/* 1. Hero & Welcome Section */}
        <section className="bg-white dark:bg-[#1B1536] rounded-3xl p-5 sm:p-7 border border-slate-200 dark:border-[#31275E] shadow-2xs space-y-4">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-[#7045D8]/10 dark:bg-[#7045D8]/20 border border-[#7045D8]/20 dark:border-[#A78BFA]/30 text-[#7045D8] dark:text-[#A78BFA] text-[11px] font-black uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5" />
            <span>About Disha PYQ</span>
          </div>

          <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-50 tracking-tight leading-snug">
            Welcome to Disha PYQ — Previous Year Questions &amp; Precision Learning!
          </h1>

          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed font-normal">
            Disha PYQ is a dedicated competitive-exam learning and previous year question practice platform designed to help Rajasthan and national exam aspirants master RPSC, RSMSSB, REET, CET, RAS, and other competitive examinations.
          </p>

          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed font-normal">
            Our goal is to make exam preparation structured, accessible, and highly effective through authentic topic-wise PYQs, simulated mock tests, and instant AI analytics.
          </p>

          <div className="pt-2 flex flex-wrap gap-2.5">
            <button
              type="button"
              onClick={onStartPracticing}
              className="min-h-[44px] px-5 py-2.5 bg-[#7045D8] hover:bg-[#5B32BF] text-white font-bold text-xs rounded-xl shadow-sm transition-all active:scale-95 flex items-center gap-2 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7045D8]"
            >
              <span>Start Practicing</span>
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onNavigateHome}
              className="min-h-[44px] px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-[#241D48] dark:hover:bg-[#31275E] text-slate-900 dark:text-slate-50 font-bold text-xs rounded-xl transition-all active:scale-95 flex items-center gap-2 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7045D8]"
            >
              <Home className="w-4 h-4" />
              <span>Explore Homepage</span>
            </button>
          </div>
        </section>

        {/* 2. Our Mission */}
        <section className="bg-slate-100 dark:bg-[#1B1536] rounded-3xl p-5 sm:p-6 border border-slate-200 dark:border-[#31275E] shadow-2xs space-y-2.5">
          <div className="flex items-center gap-2 text-[#7045D8] dark:text-[#A78BFA]">
            <Target className="w-5 h-5" />
            <h2 className="text-base sm:text-lg font-black tracking-tight text-slate-900 dark:text-slate-50">
              Our Mission
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
            Our mission is to make quality bilingual practice resources accessible to every aspirant and help them build exam confidence through consistent practice, self-assessment, and continuous improvement.
          </p>
        </section>

        {/* 3. What We Offer */}
        <section className="space-y-3.5">
          <div className="px-1">
            <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-slate-50 tracking-tight">
              What We Offer
            </h2>
            <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
              Available features and study modules on the Disha PYQ platform:
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {offerings.map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.title}
                  className="bg-white dark:bg-[#1B1536] rounded-2xl p-4 border border-slate-200 dark:border-[#31275E] shadow-2xs flex items-start gap-3 hover:border-[#7045D8] dark:hover:border-[#A78BFA] transition-colors"
                >
                  <div className={`p-2 rounded-xl shrink-0 ${item.bg} ${item.color} ${item.border} border`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-xs font-black text-slate-900 dark:text-slate-50">
                      {item.title}
                    </h3>
                    <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-snug">
                      {item.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* 4. Our Vision */}
        <section className="bg-white dark:bg-[#1B1536] rounded-3xl p-5 sm:p-6 border border-slate-200 dark:border-[#31275E] shadow-2xs space-y-2.5">
          <div className="flex items-center gap-2 text-[#7045D8] dark:text-[#A78BFA]">
            <Eye className="w-5 h-5" />
            <h2 className="text-base sm:text-lg font-black tracking-tight text-slate-900 dark:text-slate-50">
              Our Vision
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
            We envision a learning platform where students can practice authentic previous year questions, track progress, identify weak areas, and master their examinations with speed and precision.
          </p>
        </section>

        {/* 5. Why Choose Disha PYQ? */}
        <section className="bg-white dark:bg-[#1B1536] rounded-3xl p-5 sm:p-6 border border-slate-200 dark:border-[#31275E] shadow-2xs space-y-3.5">
          <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="w-5 h-5" />
            <h2 className="text-base sm:text-lg font-black tracking-tight text-slate-900 dark:text-slate-50">
              Why Choose Disha PYQ?
            </h2>
          </div>

          <ul className="space-y-2.5 pt-1">
            {whyChoosePoints.map((point) => (
              <li key={point} className="flex items-start gap-2.5 text-xs sm:text-sm text-slate-600 dark:text-slate-300">
                <span className="p-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5">
                  <Check className="w-3 h-3 stroke-[3]" />
                </span>
                <span className="leading-relaxed">{point}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* 6. Our Commitment */}
        <section className="bg-white dark:bg-[#1B1536] rounded-3xl p-5 sm:p-6 border border-slate-200 dark:border-[#31275E] shadow-2xs space-y-2.5">
          <div className="flex items-center gap-2 text-[#7045D8] dark:text-[#A78BFA]">
            <HeartHandshake className="w-5 h-5" />
            <h2 className="text-base sm:text-lg font-black tracking-tight text-slate-900 dark:text-slate-50">
              Our Commitment
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
            At Disha PYQ, we aim to provide an authentic, high-speed, and accessible learning experience. We continuously update our question repository with verified answer keys, detailed explanations, and performance metrics.
          </p>
        </section>

        {/* 7. Important Disclaimer */}
        <section className="bg-slate-100 dark:bg-[#1B1536] rounded-3xl p-5 sm:p-6 border border-[#7045D8]/25 dark:border-[#A78BFA]/25 shadow-2xs space-y-2.5">
          <div className="flex items-center gap-2 text-[#7045D8] dark:text-[#A78BFA]">
            <ShieldAlert className="w-5 h-5 shrink-0" />
            <h2 className="text-sm sm:text-base font-black tracking-tight text-slate-900 dark:text-slate-50">
              Important Disclaimer
            </h2>
          </div>
          <p className="text-[11px] sm:text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
            Disha PYQ is an independent educational practice platform. Unless explicitly stated, it is not affiliated with or endorsed by any government authority, examination board, or recruitment organization. Users should verify official examination notifications, syllabi, and rules through the relevant official sources.
          </p>
        </section>

        {/* 8. Get Started with Disha PYQ (Bottom CTA) */}
        <section className="bg-gradient-to-br from-[#7045D8] to-[#5B32BF] text-white rounded-3xl p-6 sm:p-8 shadow-md space-y-4 text-center">
          <div className="space-y-1.5 max-w-md mx-auto">
            <h2 className="text-lg sm:text-xl font-black tracking-tight">
              Get Started with Disha PYQ
            </h2>
            <p className="text-xs sm:text-sm text-white/90 leading-relaxed">
              Make every practice session count. Explore Disha PYQ and take the next step toward your competitive exam goals.
            </p>
          </div>

          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              type="button"
              onClick={onStartPracticing}
              className="w-full sm:w-auto min-h-[44px] px-6 py-3 bg-white text-[#7045D8] hover:bg-slate-100 font-extrabold text-xs sm:text-sm rounded-xl shadow-md transition-all active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>Start Practicing</span>
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onNavigateHome}
              className="w-full sm:w-auto min-h-[44px] px-5 py-3 bg-white/10 hover:bg-white/20 text-white font-bold text-xs sm:text-sm rounded-xl transition-all active:scale-95 flex items-center justify-center gap-2 cursor-pointer border border-white/20"
            >
              <Home className="w-4 h-4" />
              <span>Back to Home</span>
            </button>
          </div>
        </section>

        {/* 9. Trust & Legal Navigation Links */}
        <section className="pt-4 border-t border-slate-200 dark:border-[#31275E] text-center space-y-3">
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs font-semibold text-slate-600 dark:text-slate-300">
            <button
              onClick={onNavigateHome}
              className="hover:text-[#7045D8] dark:hover:text-[#A78BFA] transition-colors cursor-pointer"
            >
              Home
            </button>
            <span>•</span>
            <button
              onClick={onOpenPrivacyPolicy}
              className="hover:text-[#7045D8] dark:hover:text-[#A78BFA] transition-colors cursor-pointer"
            >
              Privacy Policy
            </button>
            <span>•</span>
            <button
              onClick={onOpenTerms}
              className="hover:text-[#7045D8] dark:hover:text-[#A78BFA] transition-colors cursor-pointer"
            >
              Terms & Conditions
            </button>
            <span>•</span>
            <button
              onClick={onOpenContact}
              className="hover:text-[#7045D8] dark:hover:text-[#A78BFA] transition-colors cursor-pointer"
            >
              Contact Us
            </button>
            <span>•</span>
            <button
              onClick={onOpenDisclaimer}
              className="hover:text-[#7045D8] dark:hover:text-[#A78BFA] transition-colors cursor-pointer"
            >
              Disclaimer
            </button>
          </div>

          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            © 2026 Disha PYQ. All rights reserved. Competitive Exam Preparation Platform.
          </p>
        </section>
      </main>
    </div>
  );
};
