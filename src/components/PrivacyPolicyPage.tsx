import React from "react";
import {
  ArrowLeft,
  ArrowRight,
  ShieldCheck,
  Lock,
  Eye,
  FileText,
  Database,
  Share2,
  ExternalLink,
  Clock,
  UserCheck,
  Baby,
  GraduationCap,
  RefreshCw,
  Mail,
  Home,
  CheckCircle2,
  HelpCircle,
  ChevronRight,
} from "lucide-react";
import { AppLogo } from "./AppLogo";

interface PrivacyPolicyPageProps {
  onNavigateHome: () => void;
  onStartPracticing: () => void;
  onOpenAbout?: () => void;
  onOpenTerms?: () => void;
  onOpenContact?: () => void;
  onOpenDisclaimer?: () => void;
}

export const PrivacyPolicyPage: React.FC<PrivacyPolicyPageProps> = ({
  onNavigateHome,
  onStartPracticing,
  onOpenAbout,
  onOpenTerms,
  onOpenContact,
  onOpenDisclaimer,
}) => {
  const sections = [
    { id: "info-collect", num: "01", title: "Information We Collect", icon: Database },
    { id: "how-we-use", num: "02", title: "How We Use Your Information", icon: FileText },
    { id: "account-auth", num: "03", title: "Account & Authentication", icon: UserCheck },
    { id: "cookies-storage", num: "04", title: "Cookies & Similar Technologies", icon: Eye },
    { id: "storage-security", num: "05", title: "Data Storage & Security", icon: Lock },
    { id: "sharing-disclosure", num: "06", title: "Sharing & Disclosure", icon: Share2 },
    { id: "third-party", num: "07", title: "Third-Party Links & Services", icon: ExternalLink },
    { id: "retention", num: "08", title: "Data Retention", icon: Clock },
    { id: "privacy-rights", num: "09", title: "Your Privacy Rights & Choices", icon: ShieldCheck },
    { id: "children-privacy", num: "10", title: "Children's Privacy", icon: Baby },
    { id: "educational-data", num: "11", title: "Educational & Performance Data", icon: GraduationCap },
    { id: "changes-policy", num: "12", title: "Changes to This Privacy Policy", icon: RefreshCw },
    { id: "contact-us", num: "13", title: "Contact Us", icon: Mail },
  ];

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <div className="min-h-full bg-[#F6F8FC] dark:bg-[#0B1220] text-slate-800 dark:text-slate-100 flex flex-col pb-24 select-text">
      {/* Top Header / Sticky Navigation Bar */}
      <header className="sticky top-0 z-40 bg-white/95 dark:bg-[#111927]/95 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800/80 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <button
            onClick={onNavigateHome}
            aria-label="Back to Homepage"
            className="p-2 -ml-1 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors active:scale-95 cursor-pointer flex items-center gap-1.5 text-xs font-bold"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Home</span>
          </button>
          <div className="h-4 w-px bg-slate-200 dark:bg-slate-800" />
          <div
            className="flex items-center gap-2 cursor-pointer"
            onClick={onNavigateHome}
            role="button"
            tabIndex={0}
          >
            <AppLogo size="sm" />
            <div className="flex flex-col">
              <span className="text-sm font-black text-slate-900 dark:text-white leading-tight tracking-tight">
                DISHA <span className="text-[#F47B20]">20-20</span>
              </span>
              <span className="text-[10px] text-slate-400 font-semibold leading-none">Privacy Policy</span>
            </div>
          </div>
        </div>

        <button
          onClick={onNavigateHome}
          className="w-10 h-10 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-500 flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-700 transition-all active:scale-90 cursor-pointer"
          aria-label="Close"
        >
          <ChevronRight className="w-5 h-5 rotate-90" />
        </button>
      </header>

      {/* Main Content Area */}
      <main className="max-w-3xl mx-auto w-full px-4 pt-6 space-y-6">
        {/* Hero & Document Metadata Card */}
        <section className="bg-white dark:bg-[#111A2E] rounded-3xl p-5 sm:p-7 border border-slate-200/80 dark:border-slate-800/80 shadow-xs space-y-4">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-950/50 border border-blue-200/70 dark:border-blue-800/60 text-[#1E5BF0] dark:text-blue-400 text-[11px] font-black uppercase tracking-wider">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Legal & Privacy</span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight leading-snug">
            Privacy Policy
          </h1>

          {/* Clean unboxed metadata with typographic separators */}
          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400 pb-1">
            <span>Last Updated: October 26, 2026</span>
            <span aria-hidden="true">·</span>
            <span>https://disha2020.in/privacy-policy</span>
            <span aria-hidden="true">·</span>
            <span>Online MCQ Practice & Exam Prep</span>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/70 dark:border-slate-800 space-y-2.5">
            <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-200 leading-relaxed font-medium">
              Welcome to DISHA 20-20. We respect your privacy and are committed to protecting your personal information. This Privacy Policy explains how DISHA 20-20 collects, uses, stores, and protects information when you access or use our website and services.
            </p>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              By using DISHA 20-20, you acknowledge that you have read this Privacy Policy.
            </p>
          </div>

          {/* Quick Table of Contents for Fast Navigation */}
          <div className="pt-2">
            <h2 className="text-xs font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2.5">
              Table of Contents
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-xs">
              {sections.map((sec) => (
                <button
                  key={sec.id}
                  onClick={() => scrollToSection(sec.id)}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl text-left font-semibold text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50/50 dark:hover:bg-slate-800/60 transition-colors cursor-pointer"
                >
                  <span className="text-[11px] font-mono text-slate-400 dark:text-slate-500 w-5 shrink-0">
                    {sec.num}.
                  </span>
                  <span className="truncate">{sec.title}</span>
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Section 1: Information We Collect */}
        <section
          id="info-collect"
          className="bg-white dark:bg-[#111A2E] rounded-3xl p-5 sm:p-7 border border-slate-200/80 dark:border-slate-800/80 shadow-xs space-y-4 scroll-mt-20"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[11px] font-mono font-bold text-slate-400 dark:text-slate-500">Section 01</span>
              <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                1. Information We Collect
              </h2>
            </div>
          </div>

          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
            Depending on how you use DISHA 20-20 and which features are available, we may collect the following categories of information:
          </p>

          <div className="space-y-3.5 pt-1">
            {/* Subsection A */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/70 dark:border-slate-800 space-y-2">
              <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span className="w-5 h-5 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400 text-xs font-mono font-black flex items-center justify-center">A</span>
                Personal Information
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-300">
                Information you voluntarily provide when creating an account, contacting us, or using our services, such as:
              </p>
              <ul className="text-xs text-slate-600 dark:text-slate-300 space-y-1.5 pl-5 list-disc">
                <li>Name</li>
                <li>Email address</li>
                <li>Account details</li>
                <li>Other information you choose to provide</li>
              </ul>
            </div>

            {/* Subsection B */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/70 dark:border-slate-800 space-y-2">
              <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span className="w-5 h-5 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400 text-xs font-mono font-black flex items-center justify-center">B</span>
                Study and Activity Information
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-300">
                To provide and improve our educational services, we may process information such as:
              </p>
              <ul className="text-xs text-slate-600 dark:text-slate-300 space-y-1.5 pl-5 list-disc">
                <li>MCQ answers and test attempts</li>
                <li>Test scores and performance records</li>
                <li>Subjects and topics practiced</li>
                <li>Wrong answers and revision activity</li>
                <li>Learning progress and related usage information</li>
              </ul>
            </div>

            {/* Subsection C */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/70 dark:border-slate-800 space-y-2">
              <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span className="w-5 h-5 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400 text-xs font-mono font-black flex items-center justify-center">C</span>
                Technical Information
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-300">
                When you access our website, certain technical information may be collected, depending on our hosting, security, and analytics configuration. This may include:
              </p>
              <ul className="text-xs text-slate-600 dark:text-slate-300 space-y-1.5 pl-5 list-disc">
                <li>IP address</li>
                <li>Browser type and version</li>
                <li>Device and operating system information</li>
                <li>Pages visited and interaction data</li>
                <li>Access dates and times</li>
              </ul>
            </div>
          </div>

          <p className="text-xs text-slate-500 dark:text-slate-400 italic pt-1 border-t border-slate-100 dark:border-slate-800">
            We collect only the information reasonably necessary for the purposes described in this policy, subject to applicable law.
          </p>
        </section>

        {/* Section 2: How We Use Your Information */}
        <section
          id="how-we-use"
          className="bg-white dark:bg-[#111A2E] rounded-3xl p-5 sm:p-7 border border-slate-200/80 dark:border-slate-800/80 shadow-xs space-y-4 scroll-mt-20"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[11px] font-mono font-bold text-slate-400 dark:text-slate-500">Section 02</span>
              <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                2. How We Use Your Information
              </h2>
            </div>
          </div>

          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
            We may use collected information to:
          </p>

          <div className="grid grid-cols-1 gap-2 pt-1">
            {[
              "Create and manage user accounts.",
              "Provide MCQ practice, mock tests, and other available educational features.",
              "Save test attempts, scores, and learning progress.",
              "Display performance reports and revision information.",
              "Maintain website functionality and security.",
              "Troubleshoot errors and improve user experience.",
              "Respond to questions, support requests, and feedback.",
              "Detect fraud, abuse, and unauthorized access.",
              "Comply with applicable legal obligations.",
            ].map((item, idx) => (
              <div
                key={idx}
                className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-50/80 dark:bg-slate-900/40 border border-slate-200/60 dark:border-slate-800/60 text-xs sm:text-sm text-slate-700 dark:text-slate-200"
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                <span>{item}</span>
              </div>
            ))}
          </div>

          <p className="text-xs text-slate-500 dark:text-slate-400 italic pt-1 border-t border-slate-100 dark:border-slate-800">
            We will not use personal information for purposes that are incompatible with this policy unless permitted or required by applicable law.
          </p>
        </section>

        {/* Section 3: Account Information and Authentication */}
        <section
          id="account-auth"
          className="bg-white dark:bg-[#111A2E] rounded-3xl p-5 sm:p-7 border border-slate-200/80 dark:border-slate-800/80 shadow-xs space-y-4 scroll-mt-20"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
              <UserCheck className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[11px] font-mono font-bold text-slate-400 dark:text-slate-500">Section 03</span>
              <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                3. Account Information and Authentication
              </h2>
            </div>
          </div>

          <div className="space-y-3 text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
            <p>
              If DISHA 20-20 offers account registration or login, we may process the information needed to authenticate users and maintain their accounts.
            </p>
            <p>
              If third-party authentication services are enabled, those services may process information according to their own privacy policies.
            </p>
            <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200/70 dark:border-amber-800/60 text-amber-900 dark:text-amber-200 text-xs font-medium">
              Please keep your login credentials confidential and notify us immediately if you suspect unauthorized access to your account.
            </div>
          </div>
        </section>

        {/* Section 4: Cookies and Similar Technologies */}
        <section
          id="cookies-storage"
          className="bg-white dark:bg-[#111A2E] rounded-3xl p-5 sm:p-7 border border-slate-200/80 dark:border-slate-800/80 shadow-xs space-y-4 scroll-mt-20"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-teal-500/10 text-teal-600 dark:text-teal-400 flex items-center justify-center shrink-0">
              <Eye className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[11px] font-mono font-bold text-slate-400 dark:text-slate-500">Section 04</span>
              <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                4. Cookies and Similar Technologies
              </h2>
            </div>
          </div>

          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
            DISHA 20-20 and its service providers may use cookies, local storage, or similar technologies where necessary to:
          </p>

          <ul className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 space-y-1.5 pl-5 list-disc">
            <li>Maintain login sessions.</li>
            <li>Remember preferences (such as dark mode and text size).</li>
            <li>Support essential website functionality.</li>
            <li>Improve website performance.</li>
            <li>Measure usage, where analytics are enabled.</li>
          </ul>

          <p className="text-xs text-slate-500 dark:text-slate-400 pt-1">
            You can manage or disable cookies through your browser settings. However, disabling cookies may affect certain features of the website.
          </p>
        </section>

        {/* Section 5: Data Storage and Security */}
        <section
          id="storage-security"
          className="bg-white dark:bg-[#111A2E] rounded-3xl p-5 sm:p-7 border border-slate-200/80 dark:border-slate-800/80 shadow-xs space-y-4 scroll-mt-20"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[11px] font-mono font-bold text-slate-400 dark:text-slate-500">Section 05</span>
              <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                5. Data Storage and Security
              </h2>
            </div>
          </div>

          <div className="space-y-3 text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
            <p>
              We take reasonable technical, administrative, and organizational measures to safeguard your information against unauthorized access, loss, misuse, or alteration.
            </p>
            <p>
              While we implement security measures designed to protect your data, no method of transmission over the internet or electronic storage is completely secure. We cannot guarantee absolute security.
            </p>
          </div>
        </section>

        {/* Section 6: Sharing and Disclosure of Information */}
        <section
          id="sharing-disclosure"
          className="bg-white dark:bg-[#111A2E] rounded-3xl p-5 sm:p-7 border border-slate-200/80 dark:border-slate-800/80 shadow-xs space-y-4 scroll-mt-20"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
              <Share2 className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[11px] font-mono font-bold text-slate-400 dark:text-slate-500">Section 06</span>
              <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                6. Sharing and Disclosure of Information
              </h2>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/70 dark:border-emerald-800/60 text-emerald-900 dark:text-emerald-200 text-xs sm:text-sm font-bold flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>DISHA 20-20 does not sell your personal information.</span>
          </div>

          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
            We may disclose information only in the following circumstances:
          </p>

          <div className="space-y-2.5 pt-1">
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/70 dark:border-slate-800 text-xs sm:text-sm space-y-1">
              <strong className="text-slate-900 dark:text-white">Service Providers:</strong>
              <p className="text-slate-600 dark:text-slate-300">
                With trusted third-party providers who assist in operating our website, hosting, authentication, analytics, or support, subject to appropriate privacy and security standards.
              </p>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/70 dark:border-slate-800 text-xs sm:text-sm space-y-1">
              <strong className="text-slate-900 dark:text-white">Legal Compliance:</strong>
              <p className="text-slate-600 dark:text-slate-300">
                When required by law, regulation, court order, or governmental authority.
              </p>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/70 dark:border-slate-800 text-xs sm:text-sm space-y-1">
              <strong className="text-slate-900 dark:text-white">Protection of Rights:</strong>
              <p className="text-slate-600 dark:text-slate-300">
                To enforce our policies, protect user safety, investigate suspected fraud or abuse, or protect the rights and property of DISHA 20-20.
              </p>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/70 dark:border-slate-800 text-xs sm:text-sm space-y-1">
              <strong className="text-slate-900 dark:text-white">Business Changes:</strong>
              <p className="text-slate-600 dark:text-slate-300">
                In connection with a merger, reorganization, or transfer of website operations, where permitted by law.
              </p>
            </div>
          </div>
        </section>

        {/* Section 7: Third-Party Links and Services */}
        <section
          id="third-party"
          className="bg-white dark:bg-[#111A2E] rounded-3xl p-5 sm:p-7 border border-slate-200/80 dark:border-slate-800/80 shadow-xs space-y-4 scroll-mt-20"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400 flex items-center justify-center shrink-0">
              <ExternalLink className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[11px] font-mono font-bold text-slate-400 dark:text-slate-500">Section 07</span>
              <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                7. Third-Party Links and Services
              </h2>
            </div>
          </div>

          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
            Our website may include links to third-party websites or services. We are not responsible for the privacy practices, content, or policies of third parties. We encourage you to review their privacy policies before providing any personal information.
          </p>
        </section>

        {/* Section 8: Data Retention */}
        <section
          id="retention"
          className="bg-white dark:bg-[#111A2E] rounded-3xl p-5 sm:p-7 border border-slate-200/80 dark:border-slate-800/80 shadow-xs space-y-4 scroll-mt-20"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-orange-500/10 text-orange-600 dark:text-orange-400 flex items-center justify-center shrink-0">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[11px] font-mono font-bold text-slate-400 dark:text-slate-500">Section 08</span>
              <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                8. Data Retention
              </h2>
            </div>
          </div>

          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
            We retain personal information and study activity data for as long as necessary to:
          </p>

          <ul className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 space-y-1.5 pl-5 list-disc">
            <li>Provide our services.</li>
            <li>Maintain learning progress and accounts.</li>
            <li>Resolve disputes.</li>
            <li>Comply with legal obligations.</li>
          </ul>

          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed pt-1">
            If you request account deletion or no longer use our services, we may delete or anonymize your information, subject to applicable legal requirements.
          </p>
        </section>

        {/* Section 9: Your Privacy Rights and Choices */}
        <section
          id="privacy-rights"
          className="bg-white dark:bg-[#111A2E] rounded-3xl p-5 sm:p-7 border border-slate-200/80 dark:border-slate-800/80 shadow-xs space-y-4 scroll-mt-20"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[11px] font-mono font-bold text-slate-400 dark:text-slate-500">Section 09</span>
              <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                9. Your Privacy Rights and Choices
              </h2>
            </div>
          </div>

          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
            Depending on your jurisdiction and applicable privacy laws, you may have rights regarding your personal information, including the right to:
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
            {[
              "Access the personal information we hold about you.",
              "Request correction of inaccurate information.",
              "Request deletion of your personal data.",
              "Withdraw consent where processing is based on consent.",
              "Opt out of non-essential communications.",
            ].map((right, idx) => (
              <div
                key={idx}
                className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800/60 text-xs text-slate-700 dark:text-slate-200 flex items-start gap-2"
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-blue-500 shrink-0 mt-0.5" />
                <span>{right}</span>
              </div>
            ))}
          </div>

          <p className="text-xs text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-100 dark:border-slate-800">
            To submit a privacy-related request, contact us using the details below. We may need to verify your identity before processing your request.
          </p>
        </section>

        {/* Section 10: Children's Privacy */}
        <section
          id="children-privacy"
          className="bg-white dark:bg-[#111A2E] rounded-3xl p-5 sm:p-7 border border-slate-200/80 dark:border-slate-800/80 shadow-xs space-y-4 scroll-mt-20"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-pink-500/10 text-pink-600 dark:text-pink-400 flex items-center justify-center shrink-0">
              <Baby className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[11px] font-mono font-bold text-slate-400 dark:text-slate-500">Section 10</span>
              <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                10. Children's Privacy
              </h2>
            </div>
          </div>

          <div className="space-y-3 text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
            <p>
              DISHA 20-20 is designed for general student use, including individuals preparing for competitive examinations. We do not knowingly collect personal information directly from children under 13 (or the applicable minimum age in your jurisdiction) without required parental consent.
            </p>
            <p>
              If you believe a child has provided personal information without appropriate consent, please contact us so we can take suitable action.
            </p>
          </div>
        </section>

        {/* Section 11: Educational and Performance Data */}
        <section
          id="educational-data"
          className="bg-white dark:bg-[#111A2E] rounded-3xl p-5 sm:p-7 border border-slate-200/80 dark:border-slate-800/80 shadow-xs space-y-4 scroll-mt-20"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
              <GraduationCap className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[11px] font-mono font-bold text-slate-400 dark:text-slate-500">Section 11</span>
              <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                11. Educational and Performance Data
              </h2>
            </div>
          </div>

          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
            Study records, mock test attempts, scores, and practice analytics are used solely to provide educational features, help users track their preparation, and improve the platform. We do not use individual student practice answers to build public profiles without permission.
          </p>
        </section>

        {/* Section 12: Changes to This Privacy Policy */}
        <section
          id="changes-policy"
          className="bg-white dark:bg-[#111A2E] rounded-3xl p-5 sm:p-7 border border-slate-200/80 dark:border-slate-800/80 shadow-xs space-y-4 scroll-mt-20"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-violet-500/10 text-violet-600 dark:text-violet-400 flex items-center justify-center shrink-0">
              <RefreshCw className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[11px] font-mono font-bold text-slate-400 dark:text-slate-500">Section 12</span>
              <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                12. Changes to This Privacy Policy
              </h2>
            </div>
          </div>

          <div className="space-y-3 text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
            <p>
              We may update this Privacy Policy from time to time to reflect changes in our services, technologies, or legal obligations.
            </p>
            <p>
              Any updates will be posted on this page with an updated "Last Updated" date. We encourage you to review this Privacy Policy periodically.
            </p>
          </div>
        </section>

        {/* Section 13: Contact Us */}
        <section
          id="contact-us"
          className="bg-white dark:bg-[#111A2E] rounded-3xl p-5 sm:p-7 border border-slate-200/80 dark:border-slate-800/80 shadow-xs space-y-4 scroll-mt-20"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
              <Mail className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[11px] font-mono font-bold text-slate-400 dark:text-slate-500">Section 13</span>
              <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                13. Contact Us
              </h2>
            </div>
          </div>

          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
            If you have any questions, concerns, or requests regarding this Privacy Policy or your personal information, please contact us:
          </p>

          <div className="p-4 sm:p-5 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/70 dark:border-slate-800 space-y-2.5 text-xs sm:text-sm">
            <div className="font-bold text-slate-900 dark:text-white text-sm">DISHA 20-20</div>
            <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
              <span className="text-slate-400 w-24 shrink-0 font-medium">Website:</span>
              <a
                href="https://disha2020.in"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 dark:text-blue-400 underline font-semibold hover:text-blue-700"
              >
                https://disha2020.in
              </a>
            </div>
            <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
              <span className="text-slate-400 w-24 shrink-0 font-medium">Email:</span>
              <a
                href="mailto:contact@disha2020.in"
                className="text-blue-600 dark:text-blue-400 underline font-semibold hover:text-blue-700"
              >
                contact@disha2020.in
              </a>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 text-slate-600 dark:text-slate-300">
              <span className="text-slate-400 w-24 shrink-0 font-medium">Alternative:</span>
              <a
                href="mailto:jagdishpaliyaljat2003@gmail.com"
                className="text-blue-600 dark:text-blue-400 underline font-semibold hover:text-blue-700 font-mono text-xs break-all"
              >
                jagdishpaliyaljat2003@gmail.com
              </a>
            </div>
            <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300 pt-1 border-t border-slate-200/60 dark:border-slate-800">
              <span className="text-slate-400 w-24 shrink-0 font-medium">Platform:</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200">
                Online MCQ Practice and Exam Preparation
              </span>
            </div>
          </div>

          <p className="text-xs text-slate-500 dark:text-slate-400 italic pt-1">
            By using DISHA 20-20, you agree to the terms described in this Privacy Policy.
          </p>
        </section>

        {/* CTA & Quick Jump Section */}
        <section className="bg-gradient-to-br from-[#071B49] via-[#0D2869] to-[#1E3A8A] rounded-3xl p-6 sm:p-8 text-white text-center space-y-4 shadow-xl">
          <h3 className="text-lg sm:text-xl font-black text-white">
            Ready to Practice?
          </h3>
          <p className="text-xs sm:text-sm text-slate-200 max-w-md mx-auto leading-relaxed">
            Master multiple-choice questions with verified explanations, exam-standard test simulators, and personalized progress analysis.
          </p>
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              onClick={onStartPracticing}
              className="w-full sm:w-auto px-6 py-3 bg-[#FF7A00] hover:bg-[#E66E00] text-white font-bold text-xs sm:text-sm rounded-xl shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
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

        {/* Trust & Legal Navigation Links */}
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
            <span className="text-slate-800 dark:text-slate-200 font-bold">Privacy Policy</span>
            <span>•</span>
            <button
              onClick={onOpenTerms}
              className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-pointer"
            >
              Terms & Conditions
            </button>
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
            © 2026 DISHA 20-20. All rights reserved. Online MCQ Practice Platform.
          </p>
        </footer>
      </main>
    </div>
  );
};
