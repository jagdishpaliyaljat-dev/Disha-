import React, { useState, useRef } from "react";
import {
  ArrowLeft,
  Mail,
  Send,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  LifeBuoy,
  FileQuestion,
  Sparkles,
  ExternalLink,
  Loader2,
  MessageSquare,
  ShieldCheck,
  User,
  RefreshCw,
  Globe,
} from "lucide-react";
import { AppLogo } from "./AppLogo";
import { submitContactMessage } from "../utils/contactStorage";

interface ContactUsPageProps {
  onNavigateHome: () => void;
  onStartPracticing: () => void;
  onOpenAbout?: () => void;
  onOpenPrivacyPolicy?: () => void;
  onOpenTerms?: () => void;
  onOpenDisclaimer?: () => void;
}

type SubjectOption =
  | "General Inquiry"
  | "Technical Support"
  | "Incorrect Question Report"
  | "Feedback and Suggestions"
  | "Account Related Issue"
  | "Other";

const SUBJECT_OPTIONS: SubjectOption[] = [
  "General Inquiry",
  "Technical Support",
  "Incorrect Question Report",
  "Feedback and Suggestions",
  "Account Related Issue",
  "Other",
];

const HELP_CATEGORIES: {
  title: string;
  subject: SubjectOption;
  desc: string;
  icon: React.ComponentType<{ className?: string }>;
  iconColor: string;
  bg: string;
}[] = [
  {
    title: "General Inquiries",
    subject: "General Inquiry",
    desc: "Have questions about Disha PYQ or its available features? Send us your message.",
    icon: HelpCircle,
    iconColor: "text-[#7045D8] dark:text-[#A78BFA]",
    bg: "bg-[#7045D8]/10 dark:bg-[#7045D8]/15",
  },
  {
    title: "Technical Support",
    subject: "Technical Support",
    desc: "Experiencing a problem with login, tests, question loading, or another feature? Tell us what happened so we can investigate.",
    icon: LifeBuoy,
    iconColor: "text-amber-600 dark:text-amber-400",
    bg: "bg-amber-500/10 dark:bg-amber-500/20",
  },
  {
    title: "Report an Incorrect Question",
    subject: "Incorrect Question Report",
    desc: "Found an incorrect answer, explanation, or question? Please share the relevant subject, question details, and correct information if available.",
    icon: FileQuestion,
    iconColor: "text-[#7045D8] dark:text-[#A78BFA]",
    bg: "bg-[#7045D8]/10 dark:bg-[#7045D8]/20",
  },
  {
    title: "Suggestions and Feedback",
    subject: "Feedback and Suggestions",
    desc: "Have an idea that could improve Disha PYQ? We welcome constructive feedback and suggestions.",
    icon: Sparkles,
    iconColor: "text-emerald-600 dark:text-emerald-400",
    bg: "bg-emerald-500/10 dark:bg-emerald-500/20",
  },
];

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export const ContactUsPage: React.FC<ContactUsPageProps> = ({
  onNavigateHome,
  onStartPracticing,
  onOpenAbout,
  onOpenPrivacyPolicy,
  onOpenTerms,
  onOpenDisclaimer,
}) => {
  // Form State
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState<SubjectOption | "">("");
  const [message, setMessage] = useState("");

  // Validation States
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Submission Status
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const formContainerRef = useRef<HTMLElement | null>(null);
  const formRef = useRef<HTMLFormElement | null>(null);

  // Validate form
  const validateForm = (values: {
    fullName: string;
    email: string;
    subject: string;
    message: string;
  }) => {
    const errs: Record<string, string> = {};

    if (!values.fullName.trim()) {
      errs.fullName = "Full name is required.";
    } else if (values.fullName.trim().length < 2) {
      errs.fullName = "Please enter a valid full name.";
    }

    if (!values.email.trim()) {
      errs.email = "Email address is required.";
    } else if (!EMAIL_REGEX.test(values.email.trim())) {
      errs.email = "Please enter a valid email address (e.g., student@example.com).";
    }

    if (!values.subject) {
      errs.subject = "Please select a subject from the list.";
    }

    if (!values.message.trim()) {
      errs.message = "Message cannot be empty.";
    } else if (values.message.trim().length < 10) {
      errs.message = "Please describe your question or issue in a little more detail (at least 10 characters).";
    }

    return errs;
  };

  const handleBlur = (field: string) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
    const currentErrors = validateForm({ fullName, email, subject, message });
    setErrors(currentErrors);
  };

  const handleSelectCategory = (cat: SubjectOption) => {
    setSubject(cat);
    setTouched((prev) => ({ ...prev, subject: true }));
    const target = formContainerRef.current || formRef.current;
    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Mark all as touched
    setTouched({
      fullName: true,
      email: true,
      subject: true,
      message: true,
    });

    const currentErrors = validateForm({ fullName, email, subject, message });
    setErrors(currentErrors);

    if (Object.keys(currentErrors).length > 0) {
      return;
    }

    if (isSubmitting) return; // Prevent duplicate submission

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const result = await submitContactMessage({
        name: fullName.trim(),
        email: email.trim(),
        subject: subject,
        message: message.trim(),
      });

      if (result.success) {
        setSubmitSuccess(true);
        // Clear fields only after confirmed successful persistence
        setFullName("");
        setEmail("");
        setSubject("");
        setMessage("");
        setTouched({});
        setErrors({});
      } else {
        // Preserve entered values on failure and show the real reason
        setSubmitError(result.message);
      }
    } catch (err) {
      // Unexpected failure - preserve entered values
      setSubmitError(
        "We couldn't submit your message right now. Please try again in a moment."
      );
      if (import.meta.env.DEV) {
        console.error("Contact submission unexpected error:", err);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetFormToSubmitAnother = () => {
    setSubmitSuccess(false);
    setSubmitError(null);
  };

  return (
    <div className="min-h-full bg-[#F8FAFC] dark:bg-[#130E26] text-slate-900 dark:text-slate-50 flex flex-col pb-24 select-text">
      {/* Top Header / Sticky Navigation Bar */}
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
            <AppLogo size="sm" />
            <div className="flex flex-col">
              <span className="text-sm font-black text-slate-900 dark:text-slate-50 leading-tight tracking-tight">
                DISHA <span className="text-[#7045D8] dark:text-[#A78BFA]">PYQ</span>
              </span>
              <span className="text-[11px] font-bold text-[#7045D8] dark:text-[#A78BFA] uppercase tracking-widest">
                Support
              </span>
            </div>
          </div>
        </div>
        </div>
      </header>

      {/* Main Content Article */}
      <main className="max-w-3xl w-full mx-auto px-4 py-8 space-y-8 flex-1">
        {/* Hero Header */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#7045D8]/10 dark:bg-[#7045D8]/15 text-[#7045D8] dark:text-[#A78BFA] text-[11px] font-black uppercase tracking-wider border border-[#7045D8]/20 dark:border-[#A78BFA]/25">
            <Mail className="w-3.5 h-3.5" />
            <span>Support &amp; Assistance</span>
          </div>

          <h1 className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-slate-50 tracking-tight">
            Contact Us
          </h1>

          <p className="text-lg font-black text-[#7045D8] dark:text-[#A78BFA]">
            We're Here to Help!
          </p>

          <div className="max-w-xl mx-auto space-y-2 text-sm text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
            <p>
              Have a question, suggestion, or issue while using Disha PYQ? We'd love to hear from you.
            </p>
            <p>
              Whether you need technical assistance, want to report an incorrect question, or have
              suggestions to improve our platform, please contact us using the form below.
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold pt-1">
              Our goal is to provide a smooth and helpful learning experience for every Disha PYQ user.
            </p>
          </div>
        </div>

        {/* How Can We Help You Section */}
        <section
          aria-labelledby="help-categories-heading"
          className="space-y-3.5"
        >
          <div className="text-center sm:text-left">
            <h2
              id="help-categories-heading"
              className="text-lg font-black text-slate-900 dark:text-slate-50"
            >
              How Can We Help You?
            </h2>
            <p className="text-xs text-slate-600 dark:text-slate-300 font-medium">
              Select an area below to quickly specify your topic in the form.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {HELP_CATEGORIES.map((cat) => {
              const Icon = cat.icon;
              const isSelected = subject === cat.subject;
              return (
                <button
                  key={cat.title}
                  type="button"
                  onClick={() => handleSelectCategory(cat.subject)}
                  className={`text-left p-4 rounded-2xl border transition-all active:scale-[0.99] cursor-pointer space-y-2 flex flex-col justify-between focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7045D8] ${
                    isSelected
                      ? "ring-2 ring-[#7045D8] dark:ring-[#A78BFA] border-[#7045D8] dark:border-[#A78BFA] bg-[#7045D8]/10 dark:bg-[#7045D8]/15 shadow-sm"
                      : "bg-white dark:bg-[#1B1536] border-slate-200 dark:border-[#31275E] hover:border-[#7045D8]/50 dark:hover:border-[#A78BFA]/50 shadow-xs"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <div className={`p-2 rounded-xl shrink-0 ${cat.bg}`}>
                      <Icon className={`w-4 h-4 ${cat.iconColor}`} />
                    </div>
                    <span className="text-xs font-black text-slate-900 dark:text-slate-50 leading-tight">
                      {cat.title}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
                    {cat.desc}
                  </p>
                  <div className="pt-1 flex items-center gap-1 text-[11px] font-bold text-[#7045D8] dark:text-[#A78BFA]">
                    <span>{isSelected ? "Selected for Form" : "Select Topic"}</span>
                    <span>→</span>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* Contact Form Section */}
        <section
          ref={formContainerRef}
          aria-labelledby="contact-form-heading"
          className="bg-white dark:bg-[#1B1536] rounded-3xl border border-slate-200 dark:border-[#31275E] p-6 sm:p-8 shadow-xs space-y-6"
        >
          <div>
            <h2
              id="contact-form-heading"
              className="text-xl font-black text-slate-900 dark:text-slate-50 flex items-center gap-2 font-hindi"
            >
              <Send className="w-5 h-5 text-[#7045D8] dark:text-[#A78BFA]" />
              <span>Send Us a Message</span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-medium">
              Fill in the form below. We read every message and respond as quickly as possible.
            </p>
          </div>

          {/* Success Notification Alert */}
          {submitSuccess ? (
            <div
              role="alert"
              aria-live="polite"
              className="p-5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-100 space-y-3 animate-in fade-in duration-300"
            >
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-6 h-6 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h3 className="text-sm font-black text-emerald-800 dark:text-emerald-300">
                    Message Submitted Successfully
                  </h3>
                  <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-200 leading-relaxed">
                    Thank you for contacting Disha PYQ. Your message has been received.
                  </p>
                </div>
              </div>

              <div className="pt-2 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={handleResetFormToSubmitAnother}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 shadow-sm"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Send Another Message</span>
                </button>
                <button
                  type="button"
                  onClick={onStartPracticing}
                  className="px-4 py-2 bg-white dark:bg-slate-800 border border-emerald-300 dark:border-emerald-700 hover:bg-emerald-50 dark:hover:bg-slate-700 active:scale-95 text-emerald-800 dark:text-emerald-200 rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  <span>Continue Practicing</span>
                </button>
              </div>
            </div>
          ) : (
            <form
              ref={formRef}
              onSubmit={handleSubmit}
              noValidate
              className="space-y-5"
            >
              {/* Server / Network Error Alert */}
              {submitError && (
                <div
                  role="alert"
                  aria-live="assertive"
                  className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 text-rose-900 dark:text-rose-100 flex items-start gap-3 animate-in fade-in duration-200"
                >
                  <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                  <div className="space-y-0.5 text-xs">
                    <span className="font-black text-rose-700 dark:text-rose-300 block">
                      Submission Failed
                    </span>
                    <p className="text-rose-800 dark:text-rose-200 font-medium">
                      {submitError}
                    </p>
                  </div>
                </div>
              )}

              {/* Field 1: Full Name */}
              <div className="space-y-1.5">
                <label
                  htmlFor="contact-full-name"
                  className="text-xs font-black text-slate-700 dark:text-slate-200 flex items-center justify-between"
                >
                  <span>
                    Full Name <span className="text-rose-500">*</span>
                  </span>
                  {touched.fullName && errors.fullName && (
                    <span className="text-[11px] font-bold text-rose-500" role="alert">
                      {errors.fullName}
                    </span>
                  )}
                </label>
                <div className="relative">
                  <input
                    id="contact-full-name"
                    name="fullName"
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => {
                      setFullName(e.target.value);
                      if (errors.fullName) {
                        setErrors((prev) => ({ ...prev, fullName: "" }));
                      }
                    }}
                    onBlur={() => handleBlur("fullName")}
                    placeholder="Enter your full name"
                    aria-required="true"
                    aria-invalid={Boolean(touched.fullName && errors.fullName)}
                    disabled={isSubmitting}
                    className={`w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-[#241D48] border text-sm text-slate-900 dark:text-slate-50 placeholder:text-slate-400 focus:outline-hidden transition-all ${
                      touched.fullName && errors.fullName
                        ? "border-rose-400 dark:border-rose-500 ring-2 ring-rose-400/20"
                        : "border-slate-200 dark:border-[#31275E] focus:border-[#7045D8] dark:focus:border-[#A78BFA] focus:ring-2 focus:ring-[#7045D8]/20"
                    }`}
                  />
                  <User className="w-4 h-4 text-slate-400 absolute right-3.5 top-3.5 pointer-events-none" />
                </div>
              </div>

              {/* Field 2: Email Address */}
              <div className="space-y-1.5">
                <label
                  htmlFor="contact-email"
                  className="text-xs font-black text-slate-900 dark:text-slate-50 flex items-center justify-between"
                >
                  <span>
                    Email Address <span className="text-rose-500">*</span>
                  </span>
                  {touched.email && errors.email && (
                    <span className="text-[11px] font-bold text-rose-500" role="alert">
                      {errors.email}
                    </span>
                  )}
                </label>
                <div className="relative">
                  <input
                    id="contact-email"
                    name="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (errors.email) {
                        setErrors((prev) => ({ ...prev, email: "" }));
                      }
                    }}
                    onBlur={() => handleBlur("email")}
                    placeholder="Enter your email address"
                    aria-required="true"
                    aria-invalid={Boolean(touched.email && errors.email)}
                    disabled={isSubmitting}
                    className={`w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-[#241D48] border text-sm text-slate-900 dark:text-slate-50 placeholder:text-slate-400 focus:outline-hidden transition-all ${
                      touched.email && errors.email
                        ? "border-rose-400 dark:border-rose-500 ring-2 ring-rose-400/20"
                        : "border-slate-200 dark:border-[#31275E] focus:border-[#7045D8] dark:focus:border-[#A78BFA] focus:ring-2 focus:ring-[#7045D8]/20"
                    }`}
                  />
                  <Mail className="w-4 h-4 text-slate-400 absolute right-3.5 top-3.5 pointer-events-none" />
                </div>
              </div>

              {/* Field 3: Subject Dropdown */}
              <div className="space-y-1.5">
                <label
                  htmlFor="contact-subject"
                  className="text-xs font-black text-slate-900 dark:text-slate-50 flex items-center justify-between"
                >
                  <span>
                    Subject <span className="text-rose-500">*</span>
                  </span>
                  {touched.subject && errors.subject && (
                    <span className="text-[11px] font-bold text-rose-500" role="alert">
                      {errors.subject}
                    </span>
                  )}
                </label>
                <div className="relative">
                  <select
                    id="contact-subject"
                    name="subject"
                    required
                    value={subject}
                    onChange={(e) => {
                      setSubject(e.target.value as SubjectOption);
                      if (errors.subject) {
                        setErrors((prev) => ({ ...prev, subject: "" }));
                      }
                    }}
                    onBlur={() => handleBlur("subject")}
                    aria-required="true"
                    aria-invalid={Boolean(touched.subject && errors.subject)}
                    disabled={isSubmitting}
                    className={`w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-[#241D48] border text-sm text-slate-900 dark:text-slate-50 focus:outline-hidden transition-all appearance-none cursor-pointer ${
                      touched.subject && errors.subject
                        ? "border-rose-400 dark:border-rose-500 ring-2 ring-rose-400/20"
                        : "border-slate-200 dark:border-[#31275E] focus:border-[#7045D8] dark:focus:border-[#A78BFA] focus:ring-2 focus:ring-[#7045D8]/20"
                    }`}
                  >
                    <option value="" disabled>
                      Select a reason or topic
                    </option>
                    {SUBJECT_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                  <div className="absolute right-3.5 top-3.5 pointer-events-none text-slate-400">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
              </div>

              {/* Field 4: Message Multiline */}
              <div className="space-y-1.5">
                <label
                  htmlFor="contact-message"
                  className="text-xs font-black text-slate-900 dark:text-slate-50 flex items-center justify-between"
                >
                  <span>
                    Message <span className="text-rose-500">*</span>
                  </span>
                  {touched.message && errors.message && (
                    <span className="text-[11px] font-bold text-rose-500" role="alert">
                      {errors.message}
                    </span>
                  )}
                </label>
                <textarea
                  id="contact-message"
                  name="message"
                  rows={5}
                  required
                  value={message}
                  onChange={(e) => {
                    setMessage(e.target.value);
                    if (errors.message) {
                      setErrors((prev) => ({ ...prev, message: "" }));
                    }
                  }}
                  onBlur={() => handleBlur("message")}
                  placeholder="Describe your question or issue in detail"
                  aria-required="true"
                  aria-invalid={Boolean(touched.message && errors.message)}
                  disabled={isSubmitting}
                  className={`w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-[#241D48] border text-sm text-slate-900 dark:text-slate-50 placeholder:text-slate-400 focus:outline-hidden transition-all resize-y font-hindi ${
                    touched.message && errors.message
                      ? "border-rose-400 dark:border-rose-500 ring-2 ring-rose-400/20"
                      : "border-slate-200 dark:border-[#31275E] focus:border-[#7045D8] dark:focus:border-[#A78BFA] focus:ring-2 focus:ring-[#7045D8]/20"
                  }`}
                />
                <span className="text-[11px] text-slate-500 dark:text-slate-400 block text-right font-medium">
                  {message.length} characters
                </span>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full min-h-[46px] py-3.5 px-6 rounded-xl bg-[#7045D8] hover:bg-[#5B32BF] active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed disabled:active:scale-100 text-white font-black text-sm shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7045D8]"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Sending Message...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>Send Message</span>
                  </>
                )}
              </button>
            </form>
          )}
        </section>

        {/* Contact Information Section */}
        <section
          aria-labelledby="contact-info-heading"
          className="bg-white dark:bg-[#1B1536] rounded-3xl border border-slate-200 dark:border-[#31275E] p-6 sm:p-7 shadow-xs space-y-4"
        >
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            <h2
              id="contact-info-heading"
              className="text-base font-black text-slate-900 dark:text-white"
            >
              Disha PYQ Contact Information
            </h2>
          </div>

          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed font-medium">
            You can also connect with Disha PYQ through our official website and verified support channel:
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
            {/* Telegram Channel */}
            <a
              href="https://t.me/disha2020_official"
              target="_blank"
              rel="noopener noreferrer"
              className="p-3.5 rounded-2xl bg-slate-50 dark:bg-[#241D48] border border-slate-200 dark:border-[#31275E] hover:border-[#7045D8] dark:hover:border-[#A78BFA] transition-colors flex items-center gap-3 group"
            >
              <div className="w-9 h-9 rounded-xl bg-sky-100 dark:bg-sky-900/40 text-sky-600 dark:text-sky-300 flex items-center justify-center shrink-0">
                <Send className="w-4 h-4" />
              </div>
              <div className="min-w-0 flex-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                  Telegram Channel
                </span>
                <span className="text-xs font-black text-slate-800 dark:text-white truncate block group-hover:text-[#7045D8] dark:group-hover:text-[#A78BFA] transition-colors">
                  t.me/disha2020_official
                </span>
              </div>
              <ExternalLink className="w-3.5 h-3.5 text-slate-400 group-hover:text-[#7045D8] dark:group-hover:text-[#A78BFA] transition-colors" />
            </a>

            {/* Website Link */}
            <a
              href="https://disha2020.in"
              target="_blank"
              rel="noopener noreferrer"
              className="p-3.5 rounded-2xl bg-slate-50 dark:bg-[#241D48] border border-slate-200 dark:border-[#31275E] hover:border-[#7045D8] dark:hover:border-[#A78BFA] transition-colors flex items-center gap-3 group"
            >
              <div className="w-9 h-9 rounded-xl bg-[#7045D8]/10 dark:bg-[#7045D8]/20 text-[#7045D8] dark:text-[#A78BFA] flex items-center justify-center shrink-0">
                <Globe className="w-4 h-4" />
              </div>
              <div className="min-w-0 flex-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                  Official Website
                </span>
                <span className="text-xs font-black text-slate-800 dark:text-white truncate block group-hover:text-[#7045D8] dark:group-hover:text-[#A78BFA] transition-colors">
                  https://disha2020.in
                </span>
              </div>
              <ExternalLink className="w-3.5 h-3.5 text-slate-400 group-hover:text-[#7045D8] dark:group-hover:text-[#A78BFA] transition-colors" />
            </a>

            {/* Verified Support Email */}
            <a
              href="mailto:contact@disha2020.in"
              className="p-3.5 rounded-2xl bg-slate-50 dark:bg-[#241D48] border border-slate-200 dark:border-[#31275E] hover:border-[#7045D8] dark:hover:border-[#A78BFA] transition-colors flex items-center gap-3 group"
            >
              <div className="w-9 h-9 rounded-xl bg-[#7045D8]/10 dark:bg-[#7045D8]/20 text-[#7045D8] dark:text-[#A78BFA] flex items-center justify-center shrink-0">
                <Mail className="w-4 h-4" />
              </div>
              <div className="min-w-0 flex-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                  Support Email
                </span>
                <span className="text-xs font-black text-slate-800 dark:text-white truncate block group-hover:text-[#7045D8] dark:group-hover:text-[#A78BFA] transition-colors">
                  contact@disha2020.in
                </span>
              </div>
              <ExternalLink className="w-3.5 h-3.5 text-slate-400 group-hover:text-[#7045D8] dark:group-hover:text-[#A78BFA] transition-colors" />
            </a>
          </div>

          <div className="pt-2 text-[11px] text-slate-400 dark:text-slate-500 leading-normal">
            <p>
              Note: Disha PYQ is an independent online learning and MCQ practice platform. All technical and question queries submitted through the form or official support email are reviewed by our team.
            </p>
          </div>
        </section>

        {/* Practice Callout Banner */}
        <section className="bg-gradient-to-br from-[#7045D8] to-[#5B32BF] text-white rounded-3xl p-6 sm:p-8 text-center space-y-4 shadow-lg">
          <div className="space-y-1">
            <h3 className="text-xl sm:text-2xl font-black text-white">
              Ready to Practice MCQs?
            </h3>
            <p className="text-xs text-purple-100 max-w-md mx-auto">
              Test your knowledge with chapter-wise quizzes, official PYQ vault, and timed test simulator.
            </p>
          </div>

          <button
            type="button"
            onClick={onStartPracticing}
            className="min-h-[44px] px-6 py-2.5 bg-white hover:bg-slate-100 active:scale-95 text-[#7045D8] font-black text-xs rounded-xl shadow-md transition-all cursor-pointer inline-flex items-center gap-2"
          >
            <span>Start Practicing Now</span>
            <span>→</span>
          </button>
        </section>

        {/* Trust & Legal Navigation Footer */}
        <footer className="pt-4 border-t border-slate-200/80 dark:border-[#31275E] text-center space-y-3">
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
            <button
              type="button"
              onClick={onNavigateHome}
              className="hover:text-[#7045D8] dark:hover:text-[#A78BFA] transition-colors cursor-pointer"
            >
              Home
            </button>
            <span>•</span>
            <button
              type="button"
              onClick={onOpenAbout}
              className="hover:text-[#7045D8] dark:hover:text-[#A78BFA] transition-colors cursor-pointer"
            >
              About Us
            </button>
            <span>•</span>
            <button
              type="button"
              onClick={onOpenPrivacyPolicy}
              className="hover:text-[#7045D8] dark:hover:text-[#A78BFA] transition-colors cursor-pointer"
            >
              Privacy Policy
            </button>
            <span>•</span>
            <button
              type="button"
              onClick={onOpenTerms}
              className="hover:text-[#7045D8] dark:hover:text-[#A78BFA] transition-colors cursor-pointer"
            >
              Terms of Service
            </button>
            <span>•</span>
            <span className="text-slate-800 dark:text-slate-200 font-bold">Contact Us</span>
            <span>•</span>
            <button
              type="button"
              onClick={onOpenDisclaimer}
              className="hover:text-[#7045D8] dark:hover:text-[#A78BFA] transition-colors cursor-pointer"
            >
              Disclaimer
            </button>
          </div>

          <p className="text-[11px] text-slate-400 dark:text-slate-500">
            © 2026 Disha PYQ. All rights reserved. Online MCQ Practice Platform.
          </p>
        </footer>
      </main>
    </div>
  );
};
