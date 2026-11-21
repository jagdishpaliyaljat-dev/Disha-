import React, { useState } from "react";
import {
  BookOpen,
  Trophy,
  FileText,
  BarChart2,
  ShieldCheck,
  X,
  CheckCircle2,
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

interface LoginPageProps {
  onLoginSuccess: (profile: UserProfile) => void;
  onClose?: () => void;
}

export function LoginPage({ onLoginSuccess, onClose }: LoginPageProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [configNotice, setConfigNotice] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

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
        setSuccessNotice("Login successful! Syncing profile...");
        await syncProfileFromSession(session);
      }
    });

    return cleanup;
  }, [onLoginSuccess]);

  // Supabase Google Login (Native One-Tap on Android, OAuth fallback on web)
  const handleGoogleLogin = async () => {
    setIsLoading(true);
    setConfigNotice(null);
    setSuccessNotice(null);
    productionMonitor.recordUserJourney("login", "start");

    try {
      if (!isSupabaseConfigured()) {
        setConfigNotice("Supabase credentials not configured in environment.");
        return;
      }

      // 1. Try Native One-Tap first on Android / iOS
      if (isNativePlatform()) {
        setSuccessNotice("Opening Google account picker...");
        const nativeResult = await performNativeGoogleLogin();

        if (nativeResult.success && nativeResult.session) {
          setSuccessNotice("Login successful! Welcome.");
          await syncProfileFromSession(nativeResult.session);
          return;
        }

        // If user cancelled, don't fall back to browser
        if (nativeResult.error?.toLowerCase().includes("cancel")) {
          setConfigNotice("Google login was cancelled.");
          return;
        }

        console.warn("Native Google login fallback to browser:", nativeResult.error);
      }

      // 2. Standard OAuth Flow (Web or fallback)
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
        console.warn("Supabase Google OAuth error:", error.message);
        if (error.message?.toLowerCase().includes("not enabled")) {
          setConfigNotice("Google Sign-In is currently being initialized. Please try again shortly.");
        } else {
          setConfigNotice(`Authentication notice: ${error.message}`);
        }
      } else if (data?.url) {
        await openOAuthBrowser(data.url);
        return;
      }
    } catch (err: any) {
      console.warn("Login attempt error:", err);
      setConfigNotice(`Login note: ${err?.message || "Failed to initialize login."}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-[#F4F1FA] dark:bg-[#171329] text-[#171329] dark:text-[#FFFFFF] flex flex-col justify-between overflow-y-auto overflow-x-hidden selection:bg-[#7045D8] selection:text-white">
      {/* Top Bar */}
      <div className="w-full max-w-md mx-auto pt-4 px-5 flex justify-between items-center shrink-0 z-20">
        <span className="text-[11px] font-extrabold text-[#5E5873] dark:text-[#A39DBE] uppercase tracking-wider">
          Disha PYQ Account
        </span>
        {onClose && (
          <button
            onClick={onClose}
            className="min-h-[38px] px-3 py-1.5 rounded-xl bg-white dark:bg-[#201B38] border border-[#E2DCF0] dark:border-[#362E5B] text-[#171329] dark:text-[#FFFFFF] transition-all shadow-2xs cursor-pointer text-xs font-bold flex items-center gap-1"
          >
            <span>Close</span>
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Main Content */}
      <main className="w-full max-w-md mx-auto flex-1 flex flex-col items-center justify-center px-5 py-4 space-y-4">
        <AppLogo size="hero" variant="primary" showTagline={true} />

        {/* 4 Highlight Modules */}
        <div className="w-full grid grid-cols-2 gap-2">
          {[
            { icon: BookOpen, label: "PYQ Practice", sub: "Subject & Chapter" },
            { icon: Trophy, label: "Live Mock Tests", sub: "State Ranks" },
            { icon: FileText, label: "Official PYQ Vault", sub: "Authentic Papers" },
            { icon: BarChart2, label: "Smart Analytics", sub: "Weak Topics" },
          ].map((feat) => (
            <div
              key={feat.label}
              className="bg-white dark:bg-[#201B38] border border-[#E2DCF0] dark:border-[#362E5B] rounded-xl p-2.5 flex items-center gap-2 shadow-2xs"
            >
              <div className="w-8 h-8 rounded-lg bg-[#7045D8]/10 dark:bg-[#A78BFA]/15 text-[#7045D8] dark:text-[#A78BFA] flex items-center justify-center shrink-0">
                <feat.icon className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-extrabold text-[#171329] dark:text-[#FFFFFF] truncate">
                  {feat.label}
                </p>
                <p className="text-[10px] font-medium text-[#5E5873] dark:text-[#A39DBE] truncate">
                  {feat.sub}
                </p>
              </div>
            </div>
          ))}
        </div>
      </main>

      {/* Bottom Sign-In Card: Exclusively Google Sign-In */}
      <footer className="w-full max-w-md mx-auto bg-white dark:bg-[#201B38] rounded-t-3xl px-5 sm:px-6 pt-6 pb-6 shadow-[0_-10px_30px_rgba(23,19,41,0.08)] border-t border-[#E2DCF0] dark:border-[#362E5B] space-y-4 shrink-0 z-30">
        <div className="text-center space-y-1">
          <h1 className="text-lg sm:text-xl font-extrabold text-[#171329] dark:text-[#FFFFFF] tracking-tight">
            Welcome to DISHA <span className="text-[#A78BFA]">PYQ</span>
          </h1>
          <p className="text-xs text-[#5E5873] dark:text-[#D4CEE8] font-medium">
            Sign in with Google to sync bookmarks, test results &amp; PYQ progress
          </p>
        </div>

        {/* Prominent Google Sign-In Button */}
        <button
          type="button"
          onClick={handleGoogleLogin}
          disabled={isLoading}
          className="w-full py-3 px-4 bg-white dark:bg-[#262B3D] border-2 border-[#E8D9C0] dark:border-[#31374A] hover:border-[#800020] dark:hover:border-[#F47B20] hover:bg-amber-50/30 dark:hover:bg-[#2e3447] text-[#171923] dark:text-[#FFF9EF] rounded-2xl flex items-center justify-center gap-3 shadow-sm hover:shadow-md active:scale-[0.98] transition-all cursor-pointer font-bold text-sm sm:text-base disabled:opacity-60"
        >
          {isLoading ? (
            <div className="w-5 h-5 border-2 border-[#800020] dark:border-[#F47B20] border-t-transparent rounded-full animate-spin" />
          ) : (
            <>
              <span className="w-6 h-6 rounded-full bg-white flex items-center justify-center shrink-0 shadow-xs p-1">
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
          <div className="p-2.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 rounded-xl text-[11px] text-amber-800 dark:text-amber-300 leading-relaxed text-center font-hindi">
            {configNotice}
          </div>
        )}

        {successNotice && (
          <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 rounded-xl text-[11px] text-emerald-800 dark:text-emerald-300 leading-relaxed text-center font-hindi flex items-center justify-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
            <span>{successNotice}</span>
          </div>
        )}

        <div className="flex items-center justify-center gap-2 pt-0.5">
          <ShieldCheck className="w-4 h-4 text-[#15803D] dark:text-[#22C55E]" />
          <span className="text-[10px] font-medium text-[#52576A] dark:text-[#929AB0]">
            Supabase encrypted cloud sync for bookmarks &amp; mock history
          </span>
        </div>

        <p className="text-[10px] font-medium text-[#787D91] dark:text-[#929AB0] text-center leading-relaxed">
          By continuing, you agree to our{" "}
          <button
            type="button"
            onClick={() => {
              window.location.href = "/terms-of-service";
            }}
            className="text-[#800020] dark:text-[#F47B20] font-bold hover:underline cursor-pointer"
          >
            Terms of Service
          </button>{" "}
          and{" "}
          <button
            type="button"
            onClick={() => {
              window.location.href = "/privacy-policy";
            }}
            className="text-[#800020] dark:text-[#F47B20] font-bold hover:underline cursor-pointer"
          >
            Privacy Policy
          </button>
        </p>
      </footer>
    </div>
  );
}
