import React, { useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  FileText,
  ShieldCheck,
  Scale,
  BookOpen,
  UserCheck,
  AlertTriangle,
  Copyright,
  MessageSquare,
  Award,
  CreditCard,
  ExternalLink,
  Server,
  HelpCircle,
  ShieldAlert,
  Gavel,
  RefreshCw,
  Mail,
  Home,
  CheckCircle2,
  Lock,
  Check,
  ChevronRight,
  Info,
} from "lucide-react";
import { AppLogo } from "./AppLogo";

interface TermsOfServicePageProps {
  onNavigateHome: () => void;
  onStartPracticing: () => void;
  onOpenAbout?: () => void;
  onOpenPrivacyPolicy?: () => void;
  onOpenContact?: () => void;
  onOpenDisclaimer?: () => void;
}

export const TermsOfServicePage: React.FC<TermsOfServicePageProps> = ({
  onNavigateHome,
  onStartPracticing,
  onOpenAbout,
  onOpenPrivacyPolicy,
  onOpenContact,
  onOpenDisclaimer,
}) => {
  const [activeSectionId, setActiveSectionId] = useState<string>("");

  const sections = [
    { id: "about-disha", num: "01", title: "About Disha PYQ", icon: BookOpen },
    { id: "eligibility", num: "02", title: "Eligibility & User Responsibilities", icon: UserCheck },
    { id: "educational-disclaimer", num: "03", title: "Educational Purpose & Disclaimer", icon: AlertTriangle },
    { id: "user-accounts", num: "04", title: "User Accounts", icon: Lock },
    { id: "acceptable-use", num: "05", title: "Acceptable Use", icon: ShieldCheck },
    { id: "intellectual-property", num: "06", title: "Intellectual Property Rights", icon: Copyright },
    { id: "user-submissions", num: "07", title: "User Content & Feedback", icon: MessageSquare },
    { id: "practice-tests", num: "08", title: "Practice Questions, Mock Tests & Scores", icon: Award },
    { id: "third-party", num: "09", title: "Third-Party Services & Links", icon: ExternalLink },
    { id: "service-availability", num: "10", title: "Service Availability & Modifications", icon: Server },
    { id: "disclaimer-warranties", num: "11", title: "Disclaimer of Warranties", icon: HelpCircle },
    { id: "limitation-liability", num: "12", title: "Limitation of Liability", icon: ShieldAlert },
    { id: "indemnification", num: "13", title: "Indemnification", icon: Scale },
    { id: "governing-law", num: "14", title: "Governing Law & Disputes", icon: Gavel },
    { id: "changes-terms", num: "15", title: "Changes to These Terms", icon: RefreshCw },
    { id: "contact-info", num: "16", title: "Contact Information", icon: Mail },
  ];

  const scrollToSection = (id: string) => {
    setActiveSectionId(id);
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <div className="min-h-full bg-[#FFF9EF] dark:bg-[#171923] text-[#171923] dark:text-[#FFF9EF] flex flex-col pb-24 select-text">
      {/* Top Header / Sticky Navigation Bar */}
      <header className="sticky top-0 z-40 bg-white/95 dark:bg-[#1F2330]/95 backdrop-blur-md border-b border-[#E8D9C0] dark:border-[#31374A] px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <button
            onClick={onNavigateHome}
            aria-label="Back to Homepage"
            className="p-2 -ml-1 rounded-xl text-[#52576A] dark:text-[#CBD2E1] hover:bg-[#F7EFE2] dark:hover:bg-[#252A3A] transition-colors active:scale-95 cursor-pointer flex items-center gap-1.5 text-xs font-bold"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Home</span>
          </button>
          <div className="h-4 w-px bg-[#E8D9C0] dark:bg-[#31374A]" />
          <div
            className="flex items-center gap-2 cursor-pointer"
            onClick={onNavigateHome}
            role="button"
            tabIndex={0}
          >
            <AppLogo size="sm" />
            <div className="flex flex-col">
              <span className="text-sm font-black text-[#171923] dark:text-[#FFF9EF] leading-tight tracking-tight">
                DISHA <span className="text-[#7045D8] dark:text-[#A78BFA]">PYQ</span>
              </span>
              <span className="text-[10px] text-[#7045D8] dark:text-[#A78BFA] font-semibold leading-none">Terms of Service</span>
            </div>
          </div>
        </div>

        <button
          onClick={onNavigateHome}
          className="w-10 h-10 rounded-2xl bg-[#F7EFE2] dark:bg-[#252A3A] text-[#52576A] dark:text-[#CBD2E1] flex items-center justify-center hover:bg-[#EFE3CF] dark:hover:bg-[#31374A] border border-[#E8D9C0] dark:border-[#31374A] transition-all active:scale-90 cursor-pointer"
          aria-label="Close"
        >
          <ChevronRight className="w-5 h-5 rotate-90" />
        </button>
      </header>

      {/* Main Content Container */}
      <main className="w-full max-w-4xl mx-auto px-4 py-6 sm:py-8 space-y-6">
        {/* Hero Section */}
        <div className="bg-white dark:bg-[#1F2330] rounded-3xl p-6 sm:p-8 border border-[#E8D9C0] dark:border-[#31374A] shadow-xs space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#800020]/10 dark:bg-[#F47B20]/15 border border-[#800020]/20 dark:border-[#F47B20]/30 rounded-full text-[11px] font-bold text-[#800020] dark:text-[#F47B20]">
              <Scale className="w-3.5 h-3.5 text-[#800020] dark:text-[#F47B20]" />
              <span>Legal Agreement &amp; User Terms</span>
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              Last Updated: <span className="font-semibold text-slate-700 dark:text-slate-200">October 26, 2026</span>
            </div>
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 dark:text-white">
              Terms of Service
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-mono">
              Official URL: https://disha2020.in/terms-of-service
            </p>
          </div>

          <div className="p-4 bg-slate-50 dark:bg-slate-900/60 rounded-2xl border border-slate-200/60 dark:border-slate-800/60 text-xs sm:text-sm text-slate-700 dark:text-slate-200 leading-relaxed space-y-2.5">
            <p>
              <strong>Welcome to Disha PYQ.</strong> These Terms of Service (&quot;Terms&quot;) govern your access to and use of the Disha PYQ website, available at{" "}
              <a href="https://disha2020.in" className="text-blue-600 dark:text-blue-400 underline font-semibold">https://disha2020.in</a>, and the educational services, multiple-choice questions, and mock test features provided through the platform.
            </p>
            <p className="font-medium text-slate-900 dark:text-slate-100">
              By accessing or using Disha PYQ, you agree to these Terms. If you do not agree, please discontinue using the platform.
            </p>
          </div>

          {/* Quick Jump / Table of Contents */}
          <div className="pt-2">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Table of Contents (16 Sections)
              </span>
              <span className="text-[11px] text-blue-600 dark:text-blue-400 font-semibold">
                Tap to jump
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {sections.map((sec) => {
                const Icon = sec.icon;
                const isSelected = activeSectionId === sec.id;
                return (
                  <button
                    key={sec.id}
                    onClick={() => scrollToSection(sec.id)}
                    className={`flex items-center gap-2.5 p-2.5 rounded-xl border text-left text-xs font-medium transition-all cursor-pointer ${
                      isSelected
                        ? "bg-blue-50 dark:bg-blue-950/40 border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300 shadow-xs"
                        : "bg-white dark:bg-slate-900/40 border-slate-200/70 dark:border-slate-800/70 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                    }`}
                  >
                    <span className="w-5 h-5 rounded-md bg-slate-100 dark:bg-slate-800 text-[10px] font-black text-slate-500 dark:text-slate-400 flex items-center justify-center shrink-0">
                      {sec.num}
                    </span>
                    <Icon className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 shrink-0" />
                    <span className="truncate flex-1">{sec.title}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Section 1: About Disha PYQ */}
        <section
          id="about-disha"
          className="bg-white dark:bg-[#111A2E] rounded-3xl p-5 sm:p-7 border border-slate-200/80 dark:border-slate-800/80 shadow-xs space-y-4 scroll-mt-20"
        >
          <div className="flex items-center gap-2.5 text-blue-600 dark:text-blue-400">
            <span className="px-2.5 py-0.5 rounded-lg bg-blue-50 dark:bg-blue-950/50 text-xs font-black">01</span>
            <BookOpen className="w-5 h-5" />
            <h2 className="text-lg sm:text-xl font-black tracking-tight text-slate-900 dark:text-white">
              1. About Disha PYQ
            </h2>
          </div>

          <div className="space-y-3 text-xs sm:text-sm text-slate-700 dark:text-slate-200 leading-relaxed">
            <p>
              Disha PYQ is an online educational platform designed to help users practice multiple-choice questions (MCQs), take available mock tests, review answers, and improve their subject knowledge.
            </p>
            <p>
              The features available to each user may depend on the current functionality of the platform.
            </p>
            <div className="p-4 rounded-2xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-800/60 text-amber-900 dark:text-amber-200">
              <div className="flex items-start gap-2.5">
                <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5 text-amber-700 dark:text-amber-400" />
                <p className="text-xs sm:text-sm">
                  <strong>Independent Platform Notice:</strong> Disha PYQ is an independent educational platform and is not affiliated with or endorsed by any government authority, examination board, or recruitment organization unless explicitly stated.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Section 2: Eligibility and User Responsibilities */}
        <section
          id="eligibility"
          className="bg-white dark:bg-[#111A2E] rounded-3xl p-5 sm:p-7 border border-slate-200/80 dark:border-slate-800/80 shadow-xs space-y-4 scroll-mt-20"
        >
          <div className="flex items-center gap-2.5 text-blue-600 dark:text-blue-400">
            <span className="px-2.5 py-0.5 rounded-lg bg-blue-50 dark:bg-blue-950/50 text-xs font-black">02</span>
            <UserCheck className="w-5 h-5" />
            <h2 className="text-lg sm:text-xl font-black tracking-tight text-slate-900 dark:text-white">
              2. Eligibility and User Responsibilities
            </h2>
          </div>

          <div className="space-y-3 text-xs sm:text-sm text-slate-700 dark:text-slate-200 leading-relaxed">
            <p className="font-semibold text-slate-900 dark:text-slate-100">
              By using Disha PYQ, you agree that:
            </p>
            <ul className="space-y-2.5 pl-1">
              {[
                "You will provide accurate information when creating an account, where registration is required.",
                "You will use the platform in compliance with applicable laws.",
                "You will keep your account credentials confidential.",
                "You will not impersonate another person or misuse another user's account.",
                "You will not use the platform for fraudulent, unlawful, or harmful activities.",
                "You will not knowingly submit false information or interfere with the proper operation of the website.",
              ].map((item, idx) => (
                <li key={idx} className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 dark:text-emerald-400 shrink-0 mt-0.5" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>

            <div className="p-3.5 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-200/60 dark:border-slate-800/60 text-xs text-slate-600 dark:text-slate-300">
              <strong>Legal Eligibility:</strong> If you are not legally eligible to agree to these Terms independently, you must use the platform with the involvement of a parent or legal guardian where required by applicable law.
            </div>
          </div>
        </section>

        {/* Section 3: Educational Purpose and Disclaimer */}
        <section
          id="educational-disclaimer"
          className="bg-white dark:bg-[#111A2E] rounded-3xl p-5 sm:p-7 border border-slate-200/80 dark:border-slate-800/80 shadow-xs space-y-4 scroll-mt-20"
        >
          <div className="flex items-center gap-2.5 text-blue-600 dark:text-blue-400">
            <span className="px-2.5 py-0.5 rounded-lg bg-blue-50 dark:bg-blue-950/50 text-xs font-black">03</span>
            <AlertTriangle className="w-5 h-5 text-amber-500" />
            <h2 className="text-lg sm:text-xl font-black tracking-tight text-slate-900 dark:text-white">
              3. Educational Purpose and Disclaimer
            </h2>
          </div>

          <div className="space-y-3 text-xs sm:text-sm text-slate-700 dark:text-slate-200 leading-relaxed">
            <p>
              Disha PYQ is intended to support learning, practice, revision, and self-assessment.
            </p>
            <p>
              Our questions, explanations, mock tests, and other educational materials are provided for informational and educational purposes.
            </p>
            <p>
              Although we aim to maintain accuracy and quality, we do not guarantee that every question, answer, explanation, or reference will always be complete, current, or error-free.
            </p>
            <div className="p-4 rounded-2xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-800/60 text-amber-900 dark:text-amber-200 space-y-2">
              <p className="font-semibold text-xs sm:text-sm">
                Independent Verification Required:
              </p>
              <p className="text-xs sm:text-sm">
                Users should independently verify important information using authoritative sources, especially when preparing for competitive examinations.
              </p>
              <p className="text-xs sm:text-sm font-bold text-amber-950 dark:text-amber-100">
                Disha PYQ does not guarantee exam qualification, selection, employment, admission, or any particular academic result.
              </p>
            </div>
          </div>
        </section>

        {/* Section 4: User Accounts */}
        <section
          id="user-accounts"
          className="bg-white dark:bg-[#111A2E] rounded-3xl p-5 sm:p-7 border border-slate-200/80 dark:border-slate-800/80 shadow-xs space-y-4 scroll-mt-20"
        >
          <div className="flex items-center gap-2.5 text-blue-600 dark:text-blue-400">
            <span className="px-2.5 py-0.5 rounded-lg bg-blue-50 dark:bg-blue-950/50 text-xs font-black">04</span>
            <Lock className="w-5 h-5" />
            <h2 className="text-lg sm:text-xl font-black tracking-tight text-slate-900 dark:text-white">
              4. User Accounts
            </h2>
          </div>

          <div className="space-y-3 text-xs sm:text-sm text-slate-700 dark:text-slate-200 leading-relaxed">
            <p>Certain features may require you to register for an account.</p>
            <p className="font-semibold text-slate-900 dark:text-slate-100">You are responsible for:</p>
            <ul className="space-y-2 pl-1">
              {[
                "Providing accurate registration information.",
                "Maintaining the security of your account.",
                "Keeping your login credentials private.",
                "Informing us of suspected unauthorized access immediately.",
                "Ensuring that activity carried out through your account complies with these Terms.",
              ].map((item, idx) => (
                <li key={idx} className="flex items-start gap-2.5">
                  <Check className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <p>
              We may restrict or suspend accounts where reasonably necessary to protect the platform, its users, or its services, subject to applicable law.
            </p>
            <p>
              If account deletion is available, users may use the designated account settings or contact our support team for assistance.
            </p>
          </div>
        </section>

        {/* Section 5: Acceptable Use */}
        <section
          id="acceptable-use"
          className="bg-white dark:bg-[#111A2E] rounded-3xl p-5 sm:p-7 border border-slate-200/80 dark:border-slate-800/80 shadow-xs space-y-4 scroll-mt-20"
        >
          <div className="flex items-center gap-2.5 text-blue-600 dark:text-blue-400">
            <span className="px-2.5 py-0.5 rounded-lg bg-blue-50 dark:bg-blue-950/50 text-xs font-black">05</span>
            <ShieldCheck className="w-5 h-5" />
            <h2 className="text-lg sm:text-xl font-black tracking-tight text-slate-900 dark:text-white">
              5. Acceptable Use
            </h2>
          </div>

          <div className="space-y-3 text-xs sm:text-sm text-slate-700 dark:text-slate-200 leading-relaxed">
            <p className="font-semibold text-slate-900 dark:text-slate-100">You agree not to:</p>
            <div className="grid grid-cols-1 gap-2.5">
              {[
                "Attempt unauthorized access to the website, server, accounts, or databases.",
                "Scrape, copy, reproduce, aggregate, or extract platform content using automated means (such as bots, spiders, or scrapers) without express written permission.",
                "Interfere with or disrupt the security, integrity, or performance of the website.",
                "Upload or transmit malware, viruses, malicious code, or disruptive technologies.",
                "Use the platform to distribute unsolicited promotional material, spam, or chain letters.",
                "Reverse engineer, decompile, or attempt to extract source code from the platform, except where permitted by applicable law.",
                "Engage in any activity that burdens or impairs website functionality or other users' enjoyment of the services.",
              ].map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200/60 dark:border-slate-800/60"
                >
                  <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Section 6: Intellectual Property Rights */}
        <section
          id="intellectual-property"
          className="bg-white dark:bg-[#111A2E] rounded-3xl p-5 sm:p-7 border border-slate-200/80 dark:border-slate-800/80 shadow-xs space-y-4 scroll-mt-20"
        >
          <div className="flex items-center gap-2.5 text-blue-600 dark:text-blue-400">
            <span className="px-2.5 py-0.5 rounded-lg bg-blue-50 dark:bg-blue-950/50 text-xs font-black">06</span>
            <Copyright className="w-5 h-5" />
            <h2 className="text-lg sm:text-xl font-black tracking-tight text-slate-900 dark:text-white">
              6. Intellectual Property Rights
            </h2>
          </div>

          <div className="space-y-3 text-xs sm:text-sm text-slate-700 dark:text-slate-200 leading-relaxed">
            <p>
              The platform, including its software, layout, user interface design, logo, branding, text, MCQ test structures, and materials, is protected by intellectual property rights owned by Disha PYQ or used under lawful authorization.
            </p>
            <p>
              Subject to your compliance with these Terms, Disha PYQ grants you a limited, non-exclusive, non-transferable, and revocable license to access and use the platform for your personal, non-commercial educational practice.
            </p>
            <div className="p-3.5 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-200/60 dark:border-slate-800/60 text-xs">
              <strong>Restrictions:</strong> Except as expressly permitted, you must not copy, reproduce, modify, distribute, sell, publish, or create derivative works from platform content without prior written permission from Disha PYQ.
            </div>
          </div>
        </section>

        {/* Section 7: User Content and Feedback */}
        <section
          id="user-submissions"
          className="bg-white dark:bg-[#111A2E] rounded-3xl p-5 sm:p-7 border border-slate-200/80 dark:border-slate-800/80 shadow-xs space-y-4 scroll-mt-20"
        >
          <div className="flex items-center gap-2.5 text-blue-600 dark:text-blue-400">
            <span className="px-2.5 py-0.5 rounded-lg bg-blue-50 dark:bg-blue-950/50 text-xs font-black">07</span>
            <MessageSquare className="w-5 h-5" />
            <h2 className="text-lg sm:text-xl font-black tracking-tight text-slate-900 dark:text-white">
              7. User Content and Feedback
            </h2>
          </div>

          <div className="space-y-3 text-xs sm:text-sm text-slate-700 dark:text-slate-200 leading-relaxed">
            <p>
              If you submit questions, corrections, feedback, suggestions, or comments to Disha PYQ, you grant us a perpetual, worldwide, non-exclusive, royalty-free license to use, adapt, publish, and implement your suggestions to improve the platform.
            </p>
            <p>
              You confirm that any content or suggestion you submit does not violate the intellectual property or legal rights of any third party.
            </p>
          </div>
        </section>

        {/* Section 8: Practice Questions, Mock Tests, and Scores */}
        <section
          id="practice-tests"
          className="bg-white dark:bg-[#111A2E] rounded-3xl p-5 sm:p-7 border border-slate-200/80 dark:border-slate-800/80 shadow-xs space-y-4 scroll-mt-20"
        >
          <div className="flex items-center gap-2.5 text-blue-600 dark:text-blue-400">
            <span className="px-2.5 py-0.5 rounded-lg bg-blue-50 dark:bg-blue-950/50 text-xs font-black">08</span>
            <Award className="w-5 h-5" />
            <h2 className="text-lg sm:text-xl font-black tracking-tight text-slate-900 dark:text-white">
              8. Practice Questions, Mock Tests, and Scores
            </h2>
          </div>

          <div className="space-y-3 text-xs sm:text-sm text-slate-700 dark:text-slate-200 leading-relaxed">
            <p>
              Practice tests, scoring metrics, test timers, wrong answer reviews, and performance reports are designed strictly for personal study and self-assessment purposes.
            </p>
            <p>
              Scoring on Disha PYQ reflects your performance on simulated practice questions and does not guarantee or determine official exam results, merit percentiles, or qualification cutoffs.
            </p>
            <p>
              We reserve the right to add, update, revise, or retire questions and test categories at any time to maintain curriculum quality and accuracy.
            </p>
          </div>
        </section>


        {/* Section 09: Third-Party Services and External Links */}
        <section
          id="third-party"
          className="bg-white dark:bg-[#111A2E] rounded-3xl p-5 sm:p-7 border border-slate-200/80 dark:border-slate-800/80 shadow-xs space-y-4 scroll-mt-20"
        >
          <div className="flex items-center gap-2.5 text-blue-600 dark:text-blue-400">
            <span className="px-2.5 py-0.5 rounded-lg bg-blue-50 dark:bg-blue-950/50 text-xs font-black">09</span>
            <ExternalLink className="w-5 h-5" />
            <h2 className="text-lg sm:text-xl font-black tracking-tight text-slate-900 dark:text-white">
              9. Third-Party Services and External Links
            </h2>
          </div>

          <div className="space-y-3 text-xs sm:text-sm text-slate-700 dark:text-slate-200 leading-relaxed">
            <p>
              Disha PYQ may contain links to external websites, third-party authentication services, or study references that are not operated or controlled by Disha PYQ.
            </p>
            <p>
              We do not endorse and are not responsible for the content, privacy policies, practices, or availability of any third-party websites or services. Accessing third-party resources is entirely at your own discretion and risk.
            </p>
          </div>
        </section>

        {/* Section 10: Service Availability, Modifications, and Termination */}
        <section
          id="service-availability"
          className="bg-white dark:bg-[#111A2E] rounded-3xl p-5 sm:p-7 border border-slate-200/80 dark:border-slate-800/80 shadow-xs space-y-4 scroll-mt-20"
        >
          <div className="flex items-center gap-2.5 text-blue-600 dark:text-blue-400">
            <span className="px-2.5 py-0.5 rounded-lg bg-blue-50 dark:bg-blue-950/50 text-xs font-black">10</span>
            <Server className="w-5 h-5" />
            <h2 className="text-lg sm:text-xl font-black tracking-tight text-slate-900 dark:text-white">
              10. Service Availability, Modifications, and Termination
            </h2>
          </div>

          <div className="space-y-3 text-xs sm:text-sm text-slate-700 dark:text-slate-200 leading-relaxed">
            <p>
              We continuously strive to maintain uninterrupted service, but we do not guarantee that the website will always be available, secure, error-free, or free of technical interruptions.
            </p>
            <p>
              We may modify, suspend, update, or discontinue features or the platform at any time, with or without notice, for maintenance, security, or platform improvements.
            </p>
            <p>
              We reserve the right to suspend or terminate user accounts or access to the platform for violations of these Terms, abusive conduct, or compliance with legal mandates.
            </p>
          </div>
        </section>

        {/* Section 11: Disclaimer of Warranties */}
        <section
          id="disclaimer-warranties"
          className="bg-white dark:bg-[#111A2E] rounded-3xl p-5 sm:p-7 border border-slate-200/80 dark:border-slate-800/80 shadow-xs space-y-4 scroll-mt-20"
        >
          <div className="flex items-center gap-2.5 text-blue-600 dark:text-blue-400">
            <span className="px-2.5 py-0.5 rounded-lg bg-blue-50 dark:bg-blue-950/50 text-xs font-black">11</span>
            <HelpCircle className="w-5 h-5" />
            <h2 className="text-lg sm:text-xl font-black tracking-tight text-slate-900 dark:text-white">
              11. Disclaimer of Warranties
            </h2>
          </div>

          <div className="space-y-3 text-xs sm:text-sm text-slate-700 dark:text-slate-200 leading-relaxed">
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800/60 space-y-2">
              <p className="font-bold text-slate-900 dark:text-white uppercase tracking-wider text-xs">
                &quot;As Is&quot; and &quot;As Available&quot; Basis:
              </p>
              <p>
                To the maximum extent permitted by applicable law, Disha PYQ and its services are provided on an &quot;AS IS&quot; and &quot;AS AVAILABLE&quot; basis without warranties of any kind, whether express, implied, statutory, or otherwise.
              </p>
              <p>
                We disclaim all warranties, including but not limited to implied warranties of merchantability, fitness for a particular purpose, and non-infringement.
              </p>
            </div>
          </div>
        </section>

        {/* Section 12: Limitation of Liability */}
        <section
          id="limitation-liability"
          className="bg-white dark:bg-[#111A2E] rounded-3xl p-5 sm:p-7 border border-slate-200/80 dark:border-slate-800/80 shadow-xs space-y-4 scroll-mt-20"
        >
          <div className="flex items-center gap-2.5 text-blue-600 dark:text-blue-400">
            <span className="px-2.5 py-0.5 rounded-lg bg-blue-50 dark:bg-blue-950/50 text-xs font-black">12</span>
            <ShieldAlert className="w-5 h-5" />
            <h2 className="text-lg sm:text-xl font-black tracking-tight text-slate-900 dark:text-white">
              12. Limitation of Liability
            </h2>
          </div>

          <div className="space-y-3 text-xs sm:text-sm text-slate-700 dark:text-slate-200 leading-relaxed">
            <p>
              To the maximum extent permitted by applicable law, Disha PYQ, its operators, affiliates, and representatives shall not be liable for any indirect, incidental, consequential, special, or exemplary damages, or any loss of profits, data, opportunities, or academic outcomes arising out of your access to or use of the platform.
            </p>
            <p>
              Where liability cannot be excluded by law, Disha PYQ&apos;s aggregate liability for all claims arising out of these Terms or use of the platform shall be limited to INR 500 / USD 10.
            </p>
          </div>
        </section>

        {/* Section 13: Indemnification */}
        <section
          id="indemnification"
          className="bg-white dark:bg-[#111A2E] rounded-3xl p-5 sm:p-7 border border-slate-200/80 dark:border-slate-800/80 shadow-xs space-y-4 scroll-mt-20"
        >
          <div className="flex items-center gap-2.5 text-blue-600 dark:text-blue-400">
            <span className="px-2.5 py-0.5 rounded-lg bg-blue-50 dark:bg-blue-950/50 text-xs font-black">13</span>
            <Scale className="w-5 h-5" />
            <h2 className="text-lg sm:text-xl font-black tracking-tight text-slate-900 dark:text-white">
              13. Indemnification
            </h2>
          </div>

          <div className="space-y-3 text-xs sm:text-sm text-slate-700 dark:text-slate-200 leading-relaxed">
            <p>
              You agree to defend, indemnify, and hold harmless Disha PYQ, its operators, and team members from and against any claims, damages, liabilities, costs, or expenses (including reasonable legal fees) arising from:
            </p>
            <ul className="space-y-2 pl-1">
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0 mt-2" />
                <span>Your violation of these Terms of Service.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0 mt-2" />
                <span>Your improper or unauthorized use of the platform.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0 mt-2" />
                <span>Your infringement of any third-party intellectual property or privacy rights.</span>
              </li>
            </ul>
          </div>
        </section>

        {/* Section 14: Governing Law and Dispute Resolution */}
        <section
          id="governing-law"
          className="bg-white dark:bg-[#111A2E] rounded-3xl p-5 sm:p-7 border border-slate-200/80 dark:border-slate-800/80 shadow-xs space-y-4 scroll-mt-20"
        >
          <div className="flex items-center gap-2.5 text-blue-600 dark:text-blue-400">
            <span className="px-2.5 py-0.5 rounded-lg bg-blue-50 dark:bg-blue-950/50 text-xs font-black">14</span>
            <Gavel className="w-5 h-5" />
            <h2 className="text-lg sm:text-xl font-black tracking-tight text-slate-900 dark:text-white">
              14. Governing Law and Dispute Resolution
            </h2>
          </div>

          <div className="space-y-3 text-xs sm:text-sm text-slate-700 dark:text-slate-200 leading-relaxed">
            <p>
              These Terms shall be governed by and interpreted in accordance with the applicable laws of India, without regard to its conflict of law provisions.
            </p>
            <p>
              Any disputes arising from or relating to these Terms or Disha PYQ services shall first be addressed through good-faith mutual discussion. If unresolved, the competent courts having jurisdiction over the platform operator shall have exclusive jurisdiction.
            </p>
          </div>
        </section>

        {/* Section 15: Changes to These Terms */}
        <section
          id="changes-terms"
          className="bg-white dark:bg-[#111A2E] rounded-3xl p-5 sm:p-7 border border-slate-200/80 dark:border-slate-800/80 shadow-xs space-y-4 scroll-mt-20"
        >
          <div className="flex items-center gap-2.5 text-blue-600 dark:text-blue-400">
            <span className="px-2.5 py-0.5 rounded-lg bg-blue-50 dark:bg-blue-950/50 text-xs font-black">15</span>
            <RefreshCw className="w-5 h-5" />
            <h2 className="text-lg sm:text-xl font-black tracking-tight text-slate-900 dark:text-white">
              15. Changes to These Terms
            </h2>
          </div>

          <div className="space-y-3 text-xs sm:text-sm text-slate-700 dark:text-slate-200 leading-relaxed">
            <p>
              Disha PYQ reserves the right to revise or update these Terms of Service at any time.
            </p>
            <p>
              When changes are made, we will update the &quot;Last Updated&quot; date at the top of this page. Your continued use of the platform after revised Terms become effective constitutes your acceptance of the updated Terms.
            </p>
            <p>
              We recommend reviewing this page periodically to stay informed about our terms and policies.
            </p>
          </div>
        </section>

        {/* Section 16: Contact Information */}
        <section
          id="contact-info"
          className="bg-white dark:bg-[#111A2E] rounded-3xl p-5 sm:p-7 border border-slate-200/80 dark:border-slate-800/80 shadow-xs space-y-4 scroll-mt-20"
        >
          <div className="flex items-center gap-2.5 text-blue-600 dark:text-blue-400">
            <span className="px-2.5 py-0.5 rounded-lg bg-blue-50 dark:bg-blue-950/50 text-xs font-black">16</span>
            <Mail className="w-5 h-5" />
            <h2 className="text-lg sm:text-xl font-black tracking-tight text-slate-900 dark:text-white">
              16. Contact Information
            </h2>
          </div>

          <div className="space-y-4 text-xs sm:text-sm text-slate-700 dark:text-slate-200 leading-relaxed">
            <p>
              If you have any questions, feedback, or concerns regarding these Terms of Service, please reach out to us:
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800/60 space-y-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Website</span>
                <div>
                  <a
                    href="https://disha2020.in"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-bold text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1"
                  >
                    <span>https://disha2020.in</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800/60 space-y-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Official Support Email</span>
                <div>
                  <a
                    href="mailto:contact@disha2020.in"
                    className="font-bold text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1"
                  >
                    <span>contact@disha2020.in</span>
                    <Mail className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400">
              For privacy-related matters, please review our{" "}
              <button
                onClick={onOpenPrivacyPolicy}
                className="text-blue-600 dark:text-blue-400 underline font-semibold cursor-pointer"
              >
                Privacy Policy
              </button>
              .
            </p>
          </div>
        </section>

        {/* Bottom CTA Card */}
        <section className="bg-gradient-to-br from-[#0B1F3A] to-[#1E3A8A] text-white rounded-3xl p-6 sm:p-8 shadow-md space-y-4 text-center">
          <div className="space-y-1.5 max-w-md mx-auto">
            <h2 className="text-lg sm:text-xl font-black tracking-tight">
              Ready to Prepare for Your Exams?
            </h2>
            <p className="text-xs sm:text-sm text-slate-200 leading-relaxed">
              Start practicing multiple-choice questions, take simulated mock tests, and review performance analytics on Disha PYQ.
            </p>
          </div>

          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              onClick={onStartPracticing}
              className="w-full sm:w-auto px-6 py-3 bg-[#FF7A00] hover:bg-[#E06C00] text-white font-extrabold text-xs sm:text-sm rounded-xl shadow-lg shadow-orange-500/30 transition-all active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
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

          <div className="pt-2 text-[11px] text-slate-300 font-mono flex items-center justify-center gap-1.5">
            <span>Website:</span>
            <a
              href="https://disha2020.in"
              target="_blank"
              rel="noopener noreferrer"
              className="text-white underline font-semibold hover:text-amber-300 inline-flex items-center gap-1"
            >
              <span>https://disha2020.in</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </section>

        {/* Trust & Legal Navigation Footer */}
        <footer className="pt-4 border-t border-slate-200/80 dark:border-slate-800/80 text-center space-y-3">
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
            <button
              onClick={onNavigateHome}
              className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-pointer"
            >
              Home
            </button>
            <span>•</span>
            <button
              onClick={onOpenAbout}
              className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-pointer"
            >
              About Us
            </button>
            <span>•</span>
            <button
              onClick={onOpenPrivacyPolicy}
              className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-pointer"
            >
              Privacy Policy
            </button>
            <span>•</span>
            <span className="text-slate-800 dark:text-slate-200 font-bold">Terms of Service</span>
            <span>•</span>
            <button
              onClick={onOpenContact}
              className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-pointer"
            >
              Contact Us
            </button>
            <span>•</span>
            <button
              onClick={onOpenDisclaimer}
              className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-pointer"
            >
              Disclaimer
            </button>
          </div>

          <p className="text-[10px] text-slate-400 dark:text-slate-500">
            © 2026 Disha PYQ. All rights reserved. Online MCQ Practice Platform.
          </p>
        </footer>
      </main>
    </div>
  );
};
