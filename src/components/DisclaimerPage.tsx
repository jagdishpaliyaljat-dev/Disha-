import React from "react";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Award,
  Building2,
  HelpCircle,
  Clock,
  ExternalLink,
  ShieldCheck,
  Server,
  AlertTriangle,
  Lock,
  RefreshCw,
  Mail,
  Globe,
  AlertCircle,
  ChevronRight,
} from "lucide-react";
import { AppLogo } from "./AppLogo";

interface DisclaimerPageProps {
  onNavigateHome: () => void;
  onStartPracticing: () => void;
  onOpenAbout?: () => void;
  onOpenPrivacyPolicy?: () => void;
  onOpenTerms?: () => void;
  onOpenContact?: () => void;
}

export const DisclaimerPage: React.FC<DisclaimerPageProps> = ({
  onNavigateHome,
  onStartPracticing,
  onOpenAbout,
  onOpenPrivacyPolicy,
  onOpenTerms,
  onOpenContact,
}) => {
  const sections = [
    { id: "educational-purpose", num: "01", title: "Educational Purpose Only", icon: BookOpen },
    { id: "accuracy-information", num: "02", title: "Accuracy of Information", icon: CheckCircle2 },
    { id: "no-results-guarantee", num: "03", title: "No Guarantee of Results", icon: Award },
    { id: "no-government-affiliation", num: "04", title: "No Government Affiliation", icon: Building2 },
    { id: "questions-explanations", num: "05", title: "Practice Questions & Explanations", icon: HelpCircle },
    { id: "time-sensitive-info", num: "06", title: "Current Affairs & Time-Sensitive Info", icon: Clock },
    { id: "external-links", num: "07", title: "External Links & Third Parties", icon: ExternalLink },
    { id: "intellectual-property", num: "08", title: "Intellectual Property & Ownership", icon: ShieldCheck },
    { id: "website-availability", num: "09", title: "Website Availability & Tech Support", icon: Server },
    { id: "limitation-responsibility", num: "10", title: "Limitation of Responsibility", icon: AlertTriangle },
    { id: "privacy-data", num: "11", title: "Personal Information & Privacy", icon: Lock },
    { id: "changes-disclaimer", num: "12", title: "Changes to This Disclaimer", icon: RefreshCw },
    { id: "contact-us", num: "13", title: "Contact Us", icon: Mail },
  ];

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <div className="min-h-full bg-[#F8FAFC] dark:bg-[#130E26] text-slate-900 dark:text-slate-50 flex flex-col pb-24 select-text">
      {/* Sticky Header Bar */}
      <header className="sticky top-0 z-40 bg-white/95 dark:bg-[#1B1536]/95 backdrop-blur-md border-b border-slate-200 dark:border-[#31275E] px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <button
            onClick={onNavigateHome}
            aria-label="Back to Homepage"
            className="p-2 -ml-1 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#241D48] transition-colors active:scale-95 cursor-pointer flex items-center gap-1.5 text-xs font-bold"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Home</span>
          </button>
          <div className="h-4 w-px bg-slate-200 dark:bg-[#31275E]" />
          <div
            className="flex items-center gap-2 cursor-pointer"
            onClick={onNavigateHome}
            role="button"
            tabIndex={0}
          >
            <AppLogo size="sm" />
            <div className="flex flex-col">
              <span className="text-sm font-black text-slate-900 dark:text-slate-50 leading-tight tracking-tight">
                DISHA <span className="text-[#7045D8] dark:text-[#A78BFA]">PYQ</span>
              </span>
              <span className="text-[11px] text-[#7045D8] dark:text-[#A78BFA] font-semibold leading-none">Disclaimer</span>
            </div>
          </div>
        </div>

        <button
          onClick={onNavigateHome}
          className="w-10 h-10 rounded-2xl bg-slate-100 dark:bg-[#241D48] text-slate-600 dark:text-slate-300 flex items-center justify-center hover:bg-slate-200 dark:hover:bg-[#31275E] border border-slate-200 dark:border-[#31275E] transition-all active:scale-90 cursor-pointer"
          aria-label="Close"
        >
          <ChevronRight className="w-5 h-5 rotate-90" />
        </button>
      </header>

      {/* Main Content Article */}
      <main className="max-w-4xl w-full mx-auto px-4 py-8 space-y-8 flex-1">
        {/* Page Hero Header */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#7045D8]/10 dark:bg-[#7045D8]/15 text-[#7045D8] dark:text-[#A78BFA] text-[11px] font-black uppercase tracking-wider border border-[#7045D8]/20 dark:border-[#A78BFA]/30">
            <AlertCircle className="w-3.5 h-3.5" />
            <span>Educational &amp; Legal Disclaimer</span>
          </div>

          <h1 className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-slate-50 tracking-tight">
            Disclaimer
          </h1>

          <p className="text-xs font-bold text-slate-500 dark:text-slate-400">
            Last Updated: October 26, 2026
          </p>

          <div className="max-w-2xl mx-auto space-y-4 text-sm text-slate-600 dark:text-slate-300 leading-relaxed font-medium pt-2">
            <div className="p-4 rounded-[28px] bg-white dark:bg-[#1B1536] border-2 border-dashed border-slate-200 dark:border-[#31275E] text-left space-y-2">
              <span className="text-[11px] font-black uppercase tracking-widest text-[#7045D8] block">Quick Summary</span>
              <p className="text-xs font-bold leading-normal">
                Disha PYQ is an independent platform for educational practice and MCQ revision. We are NOT a government entity. All content is for self-study purposes only.
              </p>
            </div>
            <p>
              Welcome to Disha PYQ. The information and educational materials available on{" "}
              <a
                href="https://disha2020.in"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#7045D8] hover:underline font-bold"
              >
                https://disha2020.in
              </a>{" "}
              are provided for general educational and informational purposes.
            </p>
          </div>
        </div>

        {/* Quick Table of Contents Jump Nav */}
        <div className="bg-white dark:bg-[#1B1536] rounded-3xl border border-slate-200/90 dark:border-[#31275E] p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-[#31275E] pb-3">
            <span className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-1.5">
              <BookOpen className="w-4 h-4 text-[#7045D8]" />
              <span>Table of Contents</span>
            </span>
            <span className="text-[11px] font-bold text-slate-400">13 Sections</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 pt-1">
            {sections.map((sec) => {
              const Icon = sec.icon;
              return (
                <button
                  key={sec.id}
                  onClick={() => scrollToSection(sec.id)}
                  className="flex items-center gap-2 p-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/60 text-left transition-colors group cursor-pointer"
                >
                  <span className="text-[11px] font-black text-slate-400 dark:text-slate-500 w-5 shrink-0">
                    {sec.num}
                  </span>
                  <Icon className="w-3.5 h-3.5 text-[#7045D8] dark:text-[#A78BFA] shrink-0 group-hover:scale-110 transition-transform" />
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-200 group-hover:text-[#7045D8] transition-colors line-clamp-1">
                    {sec.title}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Legal Disclaimer Sections */}
        <div className="space-y-6">
          {/* 1. Educational Purpose Only */}
          <section
            id="educational-purpose"
            className="bg-white dark:bg-[#1B1536] rounded-3xl border border-slate-200/90 dark:border-[#31275E] p-6 shadow-sm space-y-4"
          >
            <div className="flex items-center gap-3 border-b border-slate-100 dark:border-[#31275E] pb-3">
              <div className="w-9 h-9 rounded-2xl bg-violet-100/80 dark:bg-violet-950/60 text-[#7045D8] dark:text-[#A78BFA] flex items-center justify-center font-black text-sm shrink-0">
                01
              </div>
              <div>
                <h2 className="text-lg font-black text-slate-900 dark:text-white">
                  1. Educational Purpose Only
                </h2>
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Self-Study & Revision Assistance
                </span>
              </div>
            </div>

            <div className="space-y-3 text-sm text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
              <p>
                Disha PYQ is an independent educational practice platform designed to help users improve their knowledge through multiple-choice questions (MCQs), practice tests, revision activities, and other available learning resources.
              </p>
              <p>
                The content provided on Disha PYQ is intended to support self-study and examination preparation.
              </p>
              <p>
                Disha PYQ does not replace official examination notifications, prescribed syllabi, authoritative publications, professional guidance, or other official information sources.
              </p>
              <p className="p-3 bg-amber-50 dark:bg-amber-950/30 rounded-2xl border border-amber-200/60 dark:border-amber-800/50 text-amber-900 dark:text-amber-200 text-xs font-semibold">
                Note: Users should independently verify important information before relying on it for official or examination purposes.
              </p>
            </div>
          </section>

          {/* 2. Accuracy of Information */}
          <section
            id="accuracy-information"
            className="bg-white dark:bg-[#1B1536] rounded-3xl border border-slate-200/90 dark:border-[#31275E] p-6 shadow-sm space-y-4"
          >
            <div className="flex items-center gap-3 border-b border-slate-100 dark:border-[#31275E] pb-3">
              <div className="w-9 h-9 rounded-2xl bg-emerald-100/80 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-black text-sm shrink-0">
                02
              </div>
              <div>
                <h2 className="text-lg font-black text-slate-900 dark:text-white">
                  2. Accuracy of Information
                </h2>
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Content Quality & Correction Reporting
                </span>
              </div>
            </div>

            <div className="space-y-3 text-sm text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
              <p>
                We aim to provide useful, clear, and accurate questions, answers, explanations, and educational resources.
              </p>
              <p>
                However, despite reasonable efforts, some content may contain errors, omissions, outdated information, or differences in interpretation.
              </p>
              <p>
                We do not guarantee that all information available on the platform is complete, accurate, current, or suitable for every user's needs.
              </p>

              <div className="pt-2 p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-[#31275E] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <span className="text-xs font-black text-slate-800 dark:text-slate-100 block">
                    Found an incorrect question or explanation?
                  </span>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 block">
                    Report it to our editorial team for quick review and updates.
                  </span>
                </div>
                <button
                  onClick={onOpenContact}
                  className="px-4 py-2 bg-[#7045D8] hover:bg-[#5B32BF] active:scale-95 text-white text-xs font-bold rounded-xl transition-all shrink-0 cursor-pointer flex items-center gap-1.5"
                >
                  <Mail className="w-3.5 h-3.5" />
                  <span>Report Error on Contact Us</span>
                </button>
              </div>
            </div>
          </section>

          {/* 3. No Guarantee of Examination Results */}
          <section
            id="no-results-guarantee"
            className="bg-white dark:bg-[#1B1536] rounded-3xl border border-slate-200/90 dark:border-[#31275E] p-6 shadow-sm space-y-4"
          >
            <div className="flex items-center gap-3 border-b border-slate-100 dark:border-[#31275E] pb-3">
              <div className="w-9 h-9 rounded-2xl bg-amber-100/80 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center font-black text-sm shrink-0">
                03
              </div>
              <div>
                <h2 className="text-lg font-black text-slate-900 dark:text-white">
                  3. No Guarantee of Examination Results
                </h2>
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Supplementary Practice Disclaimer
                </span>
              </div>
            </div>

            <div className="space-y-3 text-sm text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
              <p>
                Disha PYQ provides tools and resources to support learning and practice.
              </p>
              <p>
                Your examination results depend on various factors, including your preparation, understanding, practice, examination conditions, and applicable selection criteria.
              </p>
              
              <div className="p-4 rounded-2xl bg-rose-50/70 dark:bg-rose-950/30 border border-rose-200/60 dark:border-rose-900/40 space-y-2">
                <span className="text-xs font-black text-rose-800 dark:text-rose-300 block">
                  We do not guarantee:
                </span>
                <ul className="list-disc list-inside space-y-1 text-xs text-rose-700 dark:text-rose-200 font-semibold">
                  <li>Passing any competitive examination.</li>
                  <li>Qualification for any recruitment process.</li>
                  <li>Admission to any educational institution.</li>
                  <li>Selection for any job or position.</li>
                  <li>Any particular score, rank, or result.</li>
                </ul>
              </div>

              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                Use Disha PYQ as a supplementary learning resource and prepare according to the official syllabus and examination requirements.
              </p>
            </div>
          </section>

          {/* 4. No Government Affiliation */}
          <section
            id="no-government-affiliation"
            className="bg-white dark:bg-[#1B1536] rounded-3xl border border-slate-200/90 dark:border-[#31275E] p-6 shadow-sm space-y-4"
          >
            <div className="flex items-center gap-3 border-b border-slate-100 dark:border-[#31275E] pb-3">
              <div className="w-9 h-9 rounded-2xl bg-purple-100/80 dark:bg-purple-950/60 text-[#7045D8] dark:text-[#A78BFA] flex items-center justify-center font-black text-sm shrink-0">
                04
              </div>
              <div>
                <h2 className="text-lg font-black text-slate-900 dark:text-white">
                  4. No Government Affiliation
                </h2>
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Independent Platform Status
                </span>
              </div>
            </div>

            <div className="space-y-3 text-sm text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
              <p className="font-bold text-slate-800 dark:text-slate-100">
                Disha PYQ is an independent educational platform.
              </p>
              <p>
                Unless explicitly stated and verifiably established, Disha PYQ is not affiliated with, sponsored by, or endorsed by any government department, public service commission, examination board, recruitment agency, or other official authority.
              </p>
              <p>
                References to examinations, organizations, recruitment processes, or educational institutions are provided strictly for identification and educational purposes.
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                Users should consult the relevant official websites for authoritative notifications, application dates, eligibility criteria, examination schedules, syllabi, answer keys, and official results.
              </p>
            </div>
          </section>

          {/* 5. Practice Questions and Answer Explanations */}
          <section
            id="questions-explanations"
            className="bg-white dark:bg-[#1B1536] rounded-3xl border border-slate-200/90 dark:border-[#31275E] p-6 shadow-sm space-y-4"
          >
            <div className="flex items-center gap-3 border-b border-slate-100 dark:border-[#31275E] pb-3">
              <div className="w-9 h-9 rounded-2xl bg-purple-100/80 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center font-black text-sm shrink-0">
                05
              </div>
              <div>
                <h2 className="text-lg font-black text-slate-900 dark:text-white">
                  5. Practice Questions and Answer Explanations
                </h2>
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Self-Assessment Material Scope
                </span>
              </div>
            </div>

            <div className="space-y-3 text-sm text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
              <p>
                MCQs, answer keys, explanations, mock tests, and practice exercises available on Disha PYQ are intended to help users assess their knowledge.
              </p>
              <p>
                Practice questions may not represent the exact format, difficulty level, question distribution, or content of an actual examination.
              </p>
              <p>
                Unless explicitly verified, questions must not be interpreted as official examination questions or guaranteed predictions of future examinations.
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                Users are encouraged to review explanations and consult reliable reference materials when clarification is needed.
              </p>
            </div>
          </section>

          {/* 6. Current Affairs and Time-Sensitive Information */}
          <section
            id="time-sensitive-info"
            className="bg-white dark:bg-[#1B1536] rounded-3xl border border-slate-200/90 dark:border-[#31275E] p-6 shadow-sm space-y-4"
          >
            <div className="flex items-center gap-3 border-b border-slate-100 dark:border-[#31275E] pb-3">
              <div className="w-9 h-9 rounded-2xl bg-cyan-100/80 dark:bg-cyan-950/60 text-cyan-600 dark:text-cyan-400 flex items-center justify-center font-black text-sm shrink-0">
                06
              </div>
              <div>
                <h2 className="text-lg font-black text-slate-900 dark:text-white">
                  6. Current Affairs and Time-Sensitive Information
                </h2>
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Dynamic Content Updates
                </span>
              </div>
            </div>

            <div className="space-y-3 text-sm text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
              <p>
                Some educational topics, including current affairs, government schemes, policies, statistics, and institutional information, may change over time.
              </p>
              <p>
                Although we may update relevant content when appropriate, we cannot guarantee that every item reflects the latest official position at all times.
              </p>
              <p className="text-xs font-semibold text-[#7045D8] dark:text-[#A78BFA]">
                Always verify time-sensitive information through authoritative and up-to-date sources before relying on it for an examination or other important decision.
              </p>
            </div>
          </section>

          {/* 7. External Links and Third-Party Content */}
          <section
            id="external-links"
            className="bg-white dark:bg-[#1B1536] rounded-3xl border border-slate-200/90 dark:border-[#31275E] p-6 shadow-sm space-y-4"
          >
            <div className="flex items-center gap-3 border-b border-slate-100 dark:border-[#31275E] pb-3">
              <div className="w-9 h-9 rounded-2xl bg-sky-100/80 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400 flex items-center justify-center font-black text-sm shrink-0">
                07
              </div>
              <div>
                <h2 className="text-lg font-black text-slate-900 dark:text-white">
                  7. External Links and Third-Party Content
                </h2>
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Outbound Resources Policy
                </span>
              </div>
            </div>

            <div className="space-y-3 text-sm text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
              <p>
                Disha PYQ may contain links to external websites, resources, or services for additional information.
              </p>
              <p>
                These external resources are operated by third parties and may be governed by their own policies and terms.
              </p>
              <p>
                We do not control all external content and do not guarantee its accuracy, availability, completeness, or suitability.
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                The inclusion of an external link does not necessarily imply endorsement or affiliation. Users access third-party websites at their own discretion.
              </p>
            </div>
          </section>

          {/* 8. Intellectual Property and Content Ownership */}
          <section
            id="intellectual-property"
            className="bg-white dark:bg-[#1B1536] rounded-3xl border border-slate-200/90 dark:border-[#31275E] p-6 shadow-sm space-y-4"
          >
            <div className="flex items-center gap-3 border-b border-slate-100 dark:border-[#31275E] pb-3">
              <div className="w-9 h-9 rounded-2xl bg-teal-100/80 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400 flex items-center justify-center font-black text-sm shrink-0">
                08
              </div>
              <div>
                <h2 className="text-lg font-black text-slate-900 dark:text-white">
                  8. Intellectual Property and Content Ownership
                </h2>
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Trademarks & Copyright Notice
                </span>
              </div>
            </div>

            <div className="space-y-3 text-sm text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
              <p>
                Disha PYQ's original branding, software, design, and original educational materials may be protected by applicable intellectual property laws.
              </p>
              <p>
                Third-party names, trademarks, logos, publications, and other materials belong to their respective owners.
              </p>
              <p>
                Any use of third-party material on the platform is subject to applicable legal requirements and the relevant rights of its owners.
              </p>
              <p>
                If you believe that material on Disha PYQ infringes your intellectual property rights, please contact us with sufficient information to identify the material and explain your concern. We will review legitimate reports and take appropriate action where warranted.
              </p>
            </div>
          </section>

          {/* 9. Website Availability and Technical Issues */}
          <section
            id="website-availability"
            className="bg-white dark:bg-[#1B1536] rounded-3xl border border-slate-200/90 dark:border-[#31275E] p-6 shadow-sm space-y-4"
          >
            <div className="flex items-center gap-3 border-b border-slate-100 dark:border-[#31275E] pb-3">
              <div className="w-9 h-9 rounded-2xl bg-[#7045D8]/10 text-[#7045D8] dark:text-[#A78BFA] flex items-center justify-center font-black text-sm shrink-0">
                09
              </div>
              <div>
                <h2 className="text-lg font-black text-slate-900 dark:text-white">
                  9. Website Availability and Technical Issues
                </h2>
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Service Uptime & Maintenance
                </span>
              </div>
            </div>

            <div className="space-y-3 text-sm text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
              <p>
                We aim to provide a reliable and accessible learning platform. However, we cannot guarantee uninterrupted or error-free access.
              </p>
              <p>
                Disha PYQ may occasionally experience maintenance, service interruptions, technical errors, connectivity problems, or other disruptions.
              </p>
              <p>
                Features, content, and services may change as the platform develops.
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                To the extent permitted by applicable law, we are not responsible for losses arising from interruptions or technical issues that are outside our reasonable control. Nothing in this section excludes liability that cannot legally be excluded.
              </p>
            </div>
          </section>

          {/* 10. Limitation of Responsibility */}
          <section
            id="limitation-responsibility"
            className="bg-white dark:bg-[#1B1536] rounded-3xl border border-slate-200/90 dark:border-[#31275E] p-6 shadow-sm space-y-4"
          >
            <div className="flex items-center gap-3 border-b border-slate-100 dark:border-[#31275E] pb-3">
              <div className="w-9 h-9 rounded-2xl bg-orange-100/80 dark:bg-orange-950/60 text-orange-600 dark:text-orange-400 flex items-center justify-center font-black text-sm shrink-0">
                10
              </div>
              <div>
                <h2 className="text-lg font-black text-slate-900 dark:text-white">
                  10. Limitation of Responsibility
                </h2>
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Legal Disclaimer Scope
                </span>
              </div>
            </div>

            <div className="space-y-3 text-sm text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
              <p>
                Disha PYQ and its operators are not responsible for decisions made solely on the basis of information obtained from the platform without appropriate verification.
              </p>
              <p>
                Users are responsible for evaluating the suitability of educational materials for their individual learning requirements.
              </p>
              <p>
                To the extent permitted by applicable law, Disha PYQ disclaims responsibility for losses arising from reliance on inaccurate, incomplete, or outdated educational information.
              </p>
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                Nothing in this Disclaimer excludes or limits any rights, warranties, or liabilities that cannot lawfully be excluded or limited under applicable law.
              </p>
            </div>
          </section>

          {/* 11. Personal Information and Privacy */}
          <section
            id="privacy-data"
            className="bg-white dark:bg-[#1B1536] rounded-3xl border border-slate-200/90 dark:border-[#31275E] p-6 shadow-sm space-y-4"
          >
            <div className="flex items-center gap-3 border-b border-slate-100 dark:border-[#31275E] pb-3">
              <div className="w-9 h-9 rounded-2xl bg-emerald-100/80 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-black text-sm shrink-0">
                11
              </div>
              <div>
                <h2 className="text-lg font-black text-slate-900 dark:text-white">
                  11. Personal Information and Privacy
                </h2>
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Data Governance Cross-Reference
                </span>
              </div>
            </div>

            <div className="space-y-3 text-sm text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
              <p>
                The collection and use of personal information through Disha PYQ are described in our Privacy Policy.
              </p>
              <p>
                Please review our Privacy Policy for information about data collection, storage, use, security, and applicable privacy rights.
              </p>

              <div className="pt-2">
                <button
                  onClick={onOpenPrivacyPolicy}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-bold rounded-xl transition-all cursor-pointer inline-flex items-center gap-1.5"
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span>Read Privacy Policy</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </section>

          {/* 12. Changes to This Disclaimer */}
          <section
            id="changes-disclaimer"
            className="bg-white dark:bg-[#1B1536] rounded-3xl border border-slate-200/90 dark:border-[#31275E] p-6 shadow-sm space-y-4"
          >
            <div className="flex items-center gap-3 border-b border-slate-100 dark:border-[#31275E] pb-3">
              <div className="w-9 h-9 rounded-2xl bg-violet-100/80 dark:bg-violet-950/60 text-[#7045D8] dark:text-[#A78BFA] flex items-center justify-center font-black text-sm shrink-0">
                12
              </div>
              <div>
                <h2 className="text-lg font-black text-slate-900 dark:text-white">
                  12. Changes to This Disclaimer
                </h2>
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Periodic Policy Revisions
                </span>
              </div>
            </div>

            <div className="space-y-3 text-sm text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
              <p>
                We may update this Disclaimer to reflect changes to our services, educational resources, website features, or legal obligations.
              </p>
              <p>
                Any revised version will be published on this page with an updated "Last Updated" date.
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold">
                We encourage users to review this page periodically to stay informed about our platform policies.
              </p>
            </div>
          </section>

          {/* 13. Contact Us */}
          <section
            id="contact-us"
            className="bg-white dark:bg-[#1B1536] rounded-3xl border border-slate-200/90 dark:border-[#31275E] p-6 shadow-sm space-y-4"
          >
            <div className="flex items-center gap-3 border-b border-slate-100 dark:border-[#31275E] pb-3">
              <div className="w-9 h-9 rounded-2xl bg-purple-100/80 dark:bg-purple-950/60 text-[#7045D8] dark:text-[#A78BFA] flex items-center justify-center font-black text-sm shrink-0">
                13
              </div>
              <div>
                <h2 className="text-lg font-black text-slate-900 dark:text-white">
                  13. Contact Us
                </h2>
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Official Communication Channel
                </span>
              </div>
            </div>

            <div className="space-y-4 text-sm text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
              <p>
                If you have questions about this Disclaimer, notice an error in our educational content, or wish to report a concern, please contact us through our official Contact Us page.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <a
                  href="https://disha2020.in"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-[#31275E] hover:border-[#7045D8] transition-colors flex items-center gap-3 group"
                >
                  <div className="w-9 h-9 rounded-xl bg-violet-100 dark:bg-violet-900/40 text-[#7045D8] dark:text-[#A78BFA] flex items-center justify-center shrink-0">
                    <Globe className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                      Website
                    </span>
                    <span className="text-xs font-black text-slate-800 dark:text-white truncate block group-hover:text-[#7045D8] transition-colors">
                      https://disha2020.in
                    </span>
                  </div>
                </a>

                <button
                  onClick={onOpenContact}
                  className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-[#31275E] hover:border-[#7045D8] transition-colors flex items-center gap-3 group text-left cursor-pointer"
                >
                  <div className="w-9 h-9 rounded-xl bg-violet-100 dark:bg-violet-900/40 text-[#7045D8] dark:text-[#A78BFA] flex items-center justify-center shrink-0">
                    <Mail className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                      Official Contact Page
                    </span>
                    <span className="text-xs font-black text-slate-800 dark:text-white truncate block group-hover:text-[#7045D8] transition-colors">
                      https://disha2020.in/contact
                    </span>
                  </div>
                </button>
              </div>

              <p className="text-xs text-slate-400 dark:text-slate-500 font-medium">
                Please use only the contact details officially published on the website.
              </p>
            </div>
          </section>
        </div>

        {/* Practice Callout Banner */}
        <section className="bg-gradient-to-br from-[#1B1536] via-[#2A1E5C] to-[#5B32BF] text-white rounded-3xl p-6 sm:p-8 text-center space-y-4 shadow-lg">
          <div className="space-y-1">
            <h3 className="text-xl sm:text-2xl font-black text-white">
              Ready to Practice MCQs?
            </h3>
            <p className="text-xs text-violet-200 max-w-md mx-auto">
              Test your knowledge with chapter-wise quizzes, official PYQ vault, and timed test simulator.
            </p>
          </div>

          <button
            onClick={onStartPracticing}
            className="px-6 py-2.5 bg-[#ff7a00] hover:bg-[#e06c00] active:scale-95 text-white font-black text-xs rounded-xl shadow-md transition-all cursor-pointer inline-flex items-center gap-2"
          >
            <span>Start Practicing Now</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </section>

        {/* Navigation Footer */}
        <footer className="pt-4 border-t border-slate-200/80 dark:border-[#31275E]/80 text-center space-y-3">
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
            <button
              onClick={onNavigateHome}
              className="hover:text-[#7045D8] dark:hover:text-[#A78BFA] transition-colors cursor-pointer"
            >
              Home
            </button>
            <span>•</span>
            <button
              onClick={onOpenAbout}
              className="hover:text-[#7045D8] dark:hover:text-[#A78BFA] transition-colors cursor-pointer"
            >
              About Us
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
              Terms of Service
            </button>
            <span>•</span>
            <button
              onClick={onOpenContact}
              className="hover:text-[#7045D8] dark:hover:text-[#A78BFA] transition-colors cursor-pointer"
            >
              Contact Us
            </button>
            <span>•</span>
            <span className="text-slate-800 dark:text-slate-200 font-bold">Disclaimer</span>
          </div>

          <p className="text-[11px] text-slate-400 dark:text-slate-500">
            © 2026 Disha PYQ. All rights reserved. Online MCQ Practice Platform.
          </p>
        </footer>
      </main>
    </div>
  );
};
