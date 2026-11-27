import React, { useState } from "react";
import {
  BookOpen,
  Trophy,
  FileText,
  BarChart2,
  ShieldCheck,
  X,
  CheckCircle2,
  Globe,
  UserCheck,
  Mail,
  KeyRound,
  ArrowRight,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { UserProfile } from "../types";
import { supabase, isSupabaseConfigured } from "../lib/supabase";
import { AppLogo } from "./AppLogo";
import { productionMonitor } from "../utils/productionMonitoring";
import {
  isNativePlatform,
  getOAuthRedirectUrl,
  openOAuthBrowser,
  registerMobileDeepLinkListener,
  performNativeGoogleLogin,
} from "../utils/mobileAuthService";
import { createGuestUserProfile } from "../utils/guestManager";
import { triggerHaptic } from "../utils/audioFeedback";

interface LoginPageProps {
  onLoginSuccess: (profile: UserProfile) => void;
  onClose?: () => void;
  isMandatory?: boolean;
}

export function LoginPage({ onLoginSuccess, onClose, isMandatory = false }: LoginPageProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [configNotice, setConfigNotice] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  // Email OTP state
  const [showEmailLogin, setShowEmailLogin] = useState(false);
  const [emailInput, setEmailInput] = useState("");
  const [otpInput, setOtpInput] = useState("");
  const [otpSent, setOtpSent] = useState(false);

  // Helper to establish user profile from Supabase session
  const syncProfileFromSession = async (session: any) => {
    if (!session?.user) return;
    try {
      const { fetchUserProfileFromSupabase } = await import("../utils/supabaseSyncService");
      const remote = await fetchUserProfileFromSupabase(session.user.id);
      const { isSuperAdmin } = await import("../utils/userProfileStorage");
      const isSuper = isSuperAdmin(session.user.email) || isSuperAdmin(session.user.id);
      const authoritativeRole = (isSuper || remote?.role === "admin") ? "admin" : "student";

      const profile: UserProfile = {
        id: session.user.id,
        email: session.user.email || "",
        name: remote?.name || session.user.user_metadata?.full_name || session.user.user_metadata?.name || "Student",
        role: authoritativeRole,
        status: "active",
        createdAt: remote?.createdAt || session.user.created_at || new Date().toISOString(),
      };
      onLoginSuccess(profile);
    } catch {
      const profile: UserProfile = {
        id: session.user.id,
        email: session.user.email || "",
        name: session.user.user_metadata?.full_name || session.user.user_metadata?.name || "Student",
        role: "student",
        status: "active",
        createdAt: session.user.created_at || new Date().toISOString(),
      };
      onLoginSuccess(profile);
    }
  };

  // Listen for mobile deep links if Google login completes in external browser
  React.useEffect(() => {
    const cleanup = registerMobileDeepLinkListener(async (session) => {
      if (session?.user) {
        setSuccessNotice("Login successful! Welcome back.");
        await syncProfileFromSession(session);
      }
    });

    return cleanup;
  }, [onLoginSuccess]);

  // Start Browser-based Google OAuth flow directly
  const startBrowserOAuth = async () => {
    setConfigNotice(null);
    setSuccessNotice("Opening secure Google Sign-In in browser...");
    const redirectTo = getOAuthRedirectUrl();
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo,
        queryParams: {
          access_type: "offline",
          prompt: "consent",
        },
      },
    });

    if (error) {
      setSuccessNotice(null);
      console.warn("Supabase Google OAuth error:", error.message);
      if (error.message?.toLowerCase().includes("not enabled")) {
        setConfigNotice("Google Sign-In is currently initializing. Please try again or use Guest mode.");
      } else {
        setConfigNotice(`Authentication notice: ${error.message}`);
      }
    } else if (data?.url) {
      await openOAuthBrowser(data.url);
    } else {
      setSuccessNotice(null);
      setConfigNotice("Unable to open Google Sign-In URL. Please try again.");
    }
  };

  // Supabase Google Login (Native Account Picker on Android with Browser OAuth auto-fallback)
  const handleGoogleLogin = async () => {
    setIsLoading(true);
    setConfigNotice(null);
    setSuccessNotice(null);
    productionMonitor.recordUserJourney("login", "start");
    triggerHaptic("light");

    try {
      if (!isSupabaseConfigured()) {
        setConfigNotice("Supabase credentials not configured in environment.");
        return;
      }

      // 1. Try Native Account Picker first on Android / iOS
      if (isNativePlatform()) {
        setSuccessNotice("Opening Google account picker...");
        const nativeResult = await performNativeGoogleLogin();

        if (nativeResult.success && nativeResult.session) {
          setConfigNotice(null);
          setSuccessNotice("Login successful! Welcome.");
          await syncProfileFromSession(nativeResult.session);
          return;
        }

        setSuccessNotice(null);

        // If user explicitly cancelled / dismissed sheet, inform them cleanly
        if (nativeResult.cancelled) {
          setConfigNotice(
            "Google account picker was dismissed. Tap 'Continue with Google' again, use Browser Sign-In, or Continue as Guest."
          );
          return;
        }

        // If native picker failed due to system/services issue, auto-fallback to browser
        console.warn("Native Google login error, auto-falling back to browser:", nativeResult.error);
        setSuccessNotice("Switching to secure browser sign-in...");
      }

      // 2. Standard OAuth Flow (Web or automatic fallback on native failure)
      await startBrowserOAuth();
    } catch (err: any) {
      console.warn("Login attempt error:", err);
      setSuccessNotice(null);
      setConfigNotice(`Login note: ${err?.message || "Failed to initialize login."}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleBrowserGoogleLogin = async () => {
    setIsLoading(true);
    setConfigNotice(null);
    setSuccessNotice(null);
    triggerHaptic("light");
    try {
      if (!isSupabaseConfigured()) {
        setConfigNotice("Supabase credentials not configured in environment.");
        return;
      }
      await startBrowserOAuth();
    } catch (err: any) {
      setSuccessNotice(null);
      setConfigNotice(`Login note: ${err?.message || "Failed to launch browser sign-in."}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Email OTP - Send Code
  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailInput.trim() || !emailInput.includes("@")) {
      setConfigNotice("Please enter a valid email address.");
      return;
    }
    setIsLoading(true);
    setConfigNotice(null);
    setSuccessNotice(null);
    triggerHaptic("light");
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: emailInput.trim(),
        options: {
          emailRedirectTo: getOAuthRedirectUrl(),
        },
      });
      if (error) {
        setConfigNotice(error.message);
      } else {
        setOtpSent(true);
        setSuccessNotice("Login code / magic link sent to your email!");
      }
    } catch (err: any) {
      setConfigNotice(err?.message || "Failed to send login email.");
    } finally {
      setIsLoading(false);
    }
  };

  // Email OTP - Verify Code
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpInput.trim()) return;
    setIsLoading(true);
    setConfigNotice(null);
    triggerHaptic("light");
    try {
      const { data, error } = await supabase.auth.verifyOtp({
        email: emailInput.trim(),
        token: otpInput.trim(),
        type: "email",
      });
      if (error) {
        setConfigNotice(error.message);
      } else if (data?.session) {
        setSuccessNotice("OTP verified successfully!");
        await syncProfileFromSession(data.session);
      }
    } catch (err: any) {
      setConfigNotice(err?.message || "Invalid OTP code.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleContinueAsGuest = () => {
    triggerHaptic("medium");
    const guest = createGuestUserProfile();
    onLoginSuccess(guest);
  };

  return (
    <div className="fixed inset-0 z-[100] bg-[#F8FAFC] dark:bg-[#130E26] text-slate-900 dark:text-slate-50 flex flex-col justify-between overflow-y-auto overflow-x-hidden selection:bg-[#7045D8] selection:text-white pt-[env(safe-area-inset-top,0px)]">
      {/* Top Bar */}
      <div className="w-full max-w-md mx-auto pt-4 px-5 flex justify-between items-center shrink-0 z-20">
        <span className="text-[11px] font-extrabold text-[#7045D8] dark:text-[#A78BFA] uppercase tracking-wider">
          Disha PYQ Account
        </span>
        {!isMandatory && onClose && (
          <button
            type="button"
            onClick={onClose}
            className="min-h-[40px] px-3.5 py-1.5 rounded-xl bg-white dark:bg-[#1B1536] border border-slate-200 dark:border-[#31275E] text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white transition-all shadow-2xs cursor-pointer text-xs font-bold flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7045D8]"
            title="Explore as Guest"
          >
            <span>Skip / Close</span>
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Main Highlights */}
      <main className="w-full max-w-md mx-auto flex-1 flex flex-col items-center justify-center px-5 py-3 space-y-4">
        <AppLogo size="hero" variant="primary" showTagline={true} />

        {/* 4 Highlight Modules */}
        <div className="w-full grid grid-cols-2 gap-2.5">
          {[
            { icon: BookOpen, label: "PYQ Practice", sub: "Topic-Wise Sets" },
            { icon: Trophy, label: "Live Mock Tests", sub: "State Ranks" },
            { icon: FileText, label: "PYQ Vault", sub: "Authentic Papers" },
            { icon: BarChart2, label: "Smart Analytics", sub: "Weak Topics" },
          ].map((feat) => (
            <div
              key={feat.label}
              className="bg-white dark:bg-[#1B1536] border border-slate-200 dark:border-[#31275E] rounded-xl p-3 flex items-center gap-2.5 shadow-2xs"
            >
              <div className="w-8 h-8 rounded-lg bg-[#7045D8]/10 dark:bg-[#A78BFA]/15 text-[#7045D8] dark:text-[#A78BFA] flex items-center justify-center shrink-0">
                <feat.icon className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-extrabold text-slate-900 dark:text-slate-50 leading-tight">
                  {feat.label}
                </p>
                <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 leading-tight mt-0.5">
                  {feat.sub}
                </p>
              </div>
            </div>
          ))}
        </div>
      </main>

      {/* Bottom Sign-In Card */}
      <footer className="w-full max-w-md mx-auto bg-white dark:bg-[#1B1536] rounded-t-3xl sm:rounded-3xl px-5 sm:px-6 pt-5 pb-[calc(20px+env(safe-area-inset-bottom,0px))] sm:pb-6 shadow-[0_-10px_30px_rgba(23,19,41,0.08)] sm:shadow-xl border-t sm:border border-slate-200 dark:border-[#31275E] space-y-3.5 shrink-0 z-30 sm:mb-6">
        <div className="text-center space-y-1">
          <h1 className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-slate-50 tracking-tight">
            Welcome to DISHA <span className="text-[#7045D8] dark:text-[#A78BFA]">PYQ</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
            Sign in with Google to sync bookmarks, test results &amp; PYQ progress
          </p>
        </div>

        {/* Primary 1-Tap Google Sign-In Button */}
        <button
          type="button"
          onClick={handleGoogleLogin}
          disabled={isLoading}
          className="w-full min-h-[48px] py-3 px-4 bg-white dark:bg-[#241D48] border-2 border-slate-200 dark:border-[#31275E] hover:border-[#7045D8] dark:hover:border-[#A78BFA] hover:bg-slate-50 dark:hover:bg-[#31275E] text-slate-900 dark:text-slate-50 rounded-2xl flex items-center justify-center gap-3 shadow-xs hover:shadow-md active:scale-[0.98] transition-all cursor-pointer font-bold text-sm sm:text-base disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7045D8]"
        >
          {isLoading ? (
            <div className="w-5 h-5 border-2 border-[#7045D8] dark:border-[#A78BFA] border-t-transparent rounded-full animate-spin" />
          ) : (
            <>
              <span className="w-6 h-6 rounded-full bg-white flex items-center justify-center shrink-0 shadow-2xs p-1">
                <svg className="w-full h-full" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 1.2-4.53z"
                  />
                </svg>
              </span>
              <span>Continue with Google</span>
            </>
          )}
        </button>

        {/* Notices */}
        {configNotice && (
          <div className="p-2.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 rounded-xl text-xs text-amber-800 dark:text-amber-300 leading-relaxed text-center">
            {configNotice}
          </div>
        )}

        {successNotice && (
          <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 rounded-xl text-xs text-emerald-800 dark:text-emerald-300 leading-relaxed text-center flex items-center justify-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
            <span>{successNotice}</span>
          </div>
        )}

        {/* Browser Sign-In Alternative on Native */}
        {isNativePlatform() && (
          <button
            type="button"
            onClick={handleBrowserGoogleLogin}
            disabled={isLoading}
            className="w-full min-h-[42px] py-2 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-2 bg-slate-100 dark:bg-[#241D48] hover:bg-slate-200/80 dark:hover:bg-[#31275E] text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-[#31275E] transition-all cursor-pointer disabled:opacity-60"
          >
            <Globe className="w-4 h-4 text-[#7045D8] dark:text-[#A78BFA] shrink-0" />
            <span>Sign in via Browser (Alternative)</span>
          </button>
        )}

        {/* Expandable Email OTP Section */}
        <div className="pt-0.5">
          <button
            type="button"
            onClick={() => setShowEmailLogin(!showEmailLogin)}
            className="w-full flex items-center justify-center gap-1.5 text-xs font-bold text-slate-500 dark:text-slate-400 hover:text-[#7045D8] dark:hover:text-[#A78BFA] transition-colors py-1 cursor-pointer"
          >
            <Mail className="w-3.5 h-3.5" />
            <span>Sign in with Email OTP</span>
            {showEmailLogin ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>

          {showEmailLogin && (
            <div className="mt-2.5 p-3 rounded-2xl bg-slate-50 dark:bg-[#130E26] border border-slate-200 dark:border-[#31275E] space-y-2.5">
              {!otpSent ? (
                <form onSubmit={handleSendOtp} className="space-y-2">
                  <div className="relative">
                    <input
                      type="email"
                      value={emailInput}
                      onChange={(e) => setEmailInput(e.target.value)}
                      placeholder="student@example.com"
                      className="w-full px-3 py-2 rounded-xl bg-white dark:bg-[#1B1536] border border-slate-200 dark:border-[#31275E] text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#7045D8]"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full py-2 bg-[#7045D8] hover:bg-[#5B32BF] text-white rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <span>Send Login Code</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </form>
              ) : (
                <form onSubmit={handleVerifyOtp} className="space-y-2">
                  <div className="relative">
                    <input
                      type="text"
                      value={otpInput}
                      onChange={(e) => setOtpInput(e.target.value)}
                      placeholder="Enter 6-digit OTP"
                      maxLength={6}
                      className="w-full px-3 py-2 rounded-xl bg-white dark:bg-[#1B1536] border border-slate-200 dark:border-[#31275E] text-xs font-bold text-center tracking-widest text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#7045D8]"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full py-2 bg-[#7045D8] hover:bg-[#5B32BF] text-white rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <KeyRound className="w-3.5 h-3.5" />
                    <span>Verify &amp; Sign In</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setOtpSent(false)}
                    className="w-full text-center text-[11px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  >
                    Change Email
                  </button>
                </form>
              )}
            </div>
          )}
        </div>

        {/* Guest Mode Onboarding Button (Instant Access) */}
        <button
          type="button"
          onClick={handleContinueAsGuest}
          className="w-full min-h-[44px] py-2.5 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-2 bg-slate-50 dark:bg-[#241D48]/60 hover:bg-slate-100 dark:hover:bg-[#241D48] text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-[#31275E] transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7045D8]"
        >
          <UserCheck className="w-4 h-4 text-[#7045D8] dark:text-[#A78BFA] shrink-0" />
          <span>बिना लॉगिन जारी रखें (Continue as Guest)</span>
        </button>

        <div className="flex items-center justify-center gap-2 pt-0.5">
          <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
            Encrypted cloud sync for bookmarks &amp; mock history
          </span>
        </div>

        <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 text-center leading-relaxed">
          By continuing, you agree to our{" "}
          <button
            type="button"
            onClick={() => {
              if (onClose) onClose();
              window.location.href = "/terms-of-service";
            }}
            className="text-[#7045D8] dark:text-[#A78BFA] font-bold hover:underline cursor-pointer"
          >
            Terms of Service
          </button>{" "}
          and{" "}
          <button
            type="button"
            onClick={() => {
              if (onClose) onClose();
              window.location.href = "/privacy-policy";
            }}
            className="text-[#7045D8] dark:text-[#A78BFA] font-bold hover:underline cursor-pointer"
          >
            Privacy Policy
          </button>
        </p>
      </footer>
    </div>
  );
}

export default LoginPage;
