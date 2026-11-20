import React, { useState } from "react";
import {
  BookOpen,
  Trophy,
  FileText,
  BarChart2,
  ShieldCheck,
  X,
  Mail,
  Lock,
  User,
  Eye,
  EyeOff,
  ArrowRight,
  CheckCircle2,
} from "lucide-react";
import { UserProfile } from "../types";
import { supabase, isSupabaseConfigured } from "../lib/supabase";
import { AppLogo } from "./AppLogo";
import { productionMonitor } from "../utils/productionMonitoring";
import {
  getOAuthRedirectUrl,
  openOAuthBrowser,
  registerMobileDeepLinkListener,
} from "../utils/mobileAuthService";

interface LoginPageProps {
  onLoginSuccess: (profile: UserProfile) => void;
  onClose?: () => void;
}

export function LoginPage({ onLoginSuccess, onClose }: LoginPageProps) {
  const [authMode, setAuthMode] = useState<"signin" | "signup">("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [configNotice, setConfigNotice] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  // Email/Password Login & Sign Up
  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setConfigNotice(null);
    setSuccessNotice(null);

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !password) {
      setConfigNotice("कृपया अपना ईमेल और पासवर्ड दर्ज करें। (Please enter email & password)");
      return;
    }

    if (password.length < 6) {
      setConfigNotice("पासवर्ड कम से कम 6 अक्षरों का होना चाहिए। (Password must be at least 6 characters)");
      return;
    }

    setIsLoading(true);
    productionMonitor.recordUserJourney("login", "start");

    try {
      if (!isSupabaseConfigured()) {
        setConfigNotice("Supabase credentials not configured in environment.");
        setIsLoading(false);
        return;
      }

      if (authMode === "signin") {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password: password,
        });

        if (error) {
          if (error.message.toLowerCase().includes("invalid login credentials")) {
            setConfigNotice("ईमेल या पासवर्ड गलत है। यदि नया अकाउंट है तो 'नया अकाउंट बनाएं' चुनें।");
          } else {
            setConfigNotice(error.message);
          }
          setIsLoading(false);
          return;
        }

        if (data.user) {
          setSuccessNotice("लॉगिन सफल! डेटा सिंक हो रहा है...");
          const userProfile: UserProfile = {
            id: data.user.id,
            name: data.user.user_metadata?.name || cleanEmail.split("@")[0],
            email: cleanEmail,
            role: "student",
            status: "active",
            createdAt: data.user.created_at || new Date().toISOString(),
          };
          onLoginSuccess(userProfile);
          if (onClose) onClose();
        }
      } else {
        const cleanName = name.trim();
        if (!cleanName) {
          setConfigNotice("कृपया अपना नाम दर्ज करें। (Please enter your name)");
          setIsLoading(false);
          return;
        }

        const { data, error } = await supabase.auth.signUp({
          email: cleanEmail,
          password: password,
          options: {
            data: {
              name: cleanName,
            },
          },
        });

        if (error) {
          setConfigNotice(error.message);
          setIsLoading(false);
          return;
        }

        if (data.session && data.user) {
          setSuccessNotice("अकाउंट सफलतापूर्वक बन गया! लॉगिन हो रहा है...");
          const userProfile: UserProfile = {
            id: data.user.id,
            name: cleanName,
            email: cleanEmail,
            role: "student",
            status: "active",
            createdAt: data.user.created_at || new Date().toISOString(),
          };
          onLoginSuccess(userProfile);
          if (onClose) onClose();
        } else if (data.user && !data.session) {
          setSuccessNotice("अकाउंट बन गया! आपके ईमेल पर कन्फर्मेशन लिंक भेजा गया है, कृपया इनबॉक्स चेक करें।");
        }
      }
    } catch (err: any) {
      console.warn("Email auth error:", err);
      setConfigNotice(err?.message || "Authentication failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // Listen for mobile deep links if Google login completes in external browser
  React.useEffect(() => {
    const cleanup = registerMobileDeepLinkListener(async (session) => {
      if (session?.user) {
        setSuccessNotice("Login successful! Syncing profile...");
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
      }
    });

    return cleanup;
  }, [onLoginSuccess]);

  // Supabase Google Login
  const handleGoogleLogin = async () => {
    setIsLoading(true);
    setConfigNotice(null);
    setSuccessNotice(null);
    productionMonitor.recordUserJourney("login", "start");

    try {
      if (isSupabaseConfigured()) {
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
            setConfigNotice(
              "Google Sign-In is not yet configured in Supabase. You can sign in using Email & Password above."
            );
          } else {
            setConfigNotice(`Authentication notice: ${error.message}`);
          }
        } else if (data?.url) {
          await openOAuthBrowser(data.url);
          return;
        }
      } else {
        setConfigNotice("Supabase credentials not configured in environment.");
      }
    } catch (err: any) {
      console.warn("Login attempt error:", err);
      setConfigNotice(`Login note: ${err?.message || "Failed to initialize login."}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Continue as Guest (Student view)
  const handleGuestLogin = () => {
    if (onClose) {
      onClose();
    } else {
      const guestProfile: UserProfile = {
        id: "student_default",
        name: "Guest Student",
        email: "",
        role: "student",
        status: "active",
        createdAt: new Date().toISOString(),
      };
      onLoginSuccess(guestProfile);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-[#FFF9EF] dark:bg-[#171923] text-[#171923] dark:text-[#FFF9EF] flex flex-col justify-between overflow-y-auto overflow-x-hidden selection:bg-[#800020] selection:text-white">
      {/* Top Bar */}
      <div className="w-full max-w-md mx-auto pt-4 px-5 flex justify-between items-center shrink-0 z-20">
        <span className="text-[11px] font-extrabold text-[#52576A] dark:text-[#929AB0] uppercase tracking-wider">
          DISHA 20-20 Account
        </span>
        {onClose && (
          <button
            onClick={onClose}
            className="min-h-[38px] px-3 py-1.5 rounded-xl bg-white dark:bg-[#1F2330] border border-[#E8D9C0] dark:border-[#31374A] text-[#171923] dark:text-[#FFF9EF] transition-all shadow-2xs cursor-pointer text-xs font-bold flex items-center gap-1"
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
            { icon: BookOpen, label: "MCQ Practice", sub: "Chapter-wise" },
            { icon: Trophy, label: "Live Mock Tests", sub: "State Ranks" },
            { icon: FileText, label: "Official PYQ Vault", sub: "2013-2024" },
            { icon: BarChart2, label: "Smart Analytics", sub: "Weak Topics" },
          ].map((feat) => (
            <div
              key={feat.label}
              className="bg-white dark:bg-[#1F2330] border border-[#E8D9C0] dark:border-[#31374A] rounded-xl p-2.5 flex items-center gap-2 shadow-2xs"
            >
              <div className="w-8 h-8 rounded-lg bg-[#800020]/10 dark:bg-[#F47B20]/15 text-[#800020] dark:text-[#F47B20] flex items-center justify-center shrink-0">
                <feat.icon className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-extrabold text-[#171923] dark:text-[#FFF9EF] truncate">
                  {feat.label}
                </p>
                <p className="text-[10px] font-medium text-[#52576A] dark:text-[#929AB0] truncate">
                  {feat.sub}
                </p>
              </div>
            </div>
          ))}
        </div>
      </main>

      {/* Bottom Sign-In Card */}
      <footer className="w-full max-w-md mx-auto bg-white dark:bg-[#1F2330] rounded-t-3xl px-5 sm:px-6 pt-5 pb-6 shadow-[0_-10px_30px_rgba(23,25,35,0.06)] border-t border-[#E8D9C0] dark:border-[#31374A] space-y-3.5 shrink-0 z-30">
        <div className="text-center space-y-0.5">
          <h1 className="text-lg sm:text-xl font-extrabold text-[#171923] dark:text-[#FFF9EF] tracking-tight">
            Welcome to DISHA <span className="text-[#F47B20]">20-20</span>
          </h1>
          <p className="text-xs text-[#52576A] dark:text-[#CBD2E1] font-medium">
            Sign in to save study progress and sync bookmarks
          </p>
        </div>

        {/* Auth Mode Toggle Tabs */}
        <div className="flex bg-[#FAF5EB] dark:bg-[#262B3D] p-1 rounded-xl border border-[#E8D9C0] dark:border-[#31374A]">
          <button
            type="button"
            onClick={() => {
              setAuthMode("signin");
              setConfigNotice(null);
              setSuccessNotice(null);
            }}
            className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              authMode === "signin"
                ? "bg-[#800020] text-white shadow-xs"
                : "text-[#52576A] dark:text-[#929AB0] hover:text-[#171923]"
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => {
              setAuthMode("signup");
              setConfigNotice(null);
              setSuccessNotice(null);
            }}
            className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              authMode === "signup"
                ? "bg-[#800020] text-white shadow-xs"
                : "text-[#52576A] dark:text-[#929AB0] hover:text-[#171923]"
            }`}
          >
            Create Account
          </button>
        </div>

        {/* Email & Password Form */}
        <form onSubmit={handleEmailAuth} className="space-y-2.5">
          {authMode === "signup" && (
            <div className="relative">
              <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Full Name (पूरा नाम)"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={isLoading}
                className="w-full pl-9 pr-3 py-2 text-xs font-semibold bg-[#FAF5EB] dark:bg-[#262B3D] border border-[#E8D9C0] dark:border-[#31374A] rounded-xl text-[#171923] dark:text-[#FFF9EF] focus:outline-none focus:ring-1 focus:ring-[#800020]"
                required
              />
            </div>
          )}

          <div className="relative">
            <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="email"
              placeholder="Email Address (ईमेल)"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isLoading}
              className="w-full pl-9 pr-3 py-2 text-xs font-semibold bg-[#FAF5EB] dark:bg-[#262B3D] border border-[#E8D9C0] dark:border-[#31374A] rounded-xl text-[#171923] dark:text-[#FFF9EF] focus:outline-none focus:ring-1 focus:ring-[#800020]"
              required
            />
          </div>

          <div className="relative">
            <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type={showPassword ? "text" : "password"}
              placeholder="Password (पासवर्ड 6+ अक्षर)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isLoading}
              className="w-full pl-9 pr-10 py-2 text-xs font-semibold bg-[#FAF5EB] dark:bg-[#262B3D] border border-[#E8D9C0] dark:border-[#31374A] rounded-xl text-[#171923] dark:text-[#FFF9EF] focus:outline-none focus:ring-1 focus:ring-[#800020]"
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-2.5 bg-[#800020] hover:bg-[#600018] text-white font-extrabold text-xs sm:text-sm rounded-xl transition-all shadow-xs cursor-pointer flex items-center justify-center gap-1.5 active:scale-98 disabled:opacity-50"
          >
            {isLoading ? (
              <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <span>{authMode === "signin" ? "Sign In with Email" : "Create Free Account"}</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Divider */}
        <div className="flex items-center gap-2">
          <div className="flex-1 h-px bg-[#E8D9C0] dark:border-[#31374A]" />
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">OR</span>
          <div className="flex-1 h-px bg-[#E8D9C0] dark:border-[#31374A]" />
        </div>

        {/* Google Continue */}
        <button
          type="button"
          onClick={handleGoogleLogin}
          disabled={isLoading}
          className="w-full py-2 bg-white dark:bg-[#262B3D] border border-[#E8D9C0] dark:border-[#31374A] hover:bg-slate-50 dark:hover:bg-[#2e3447] text-[#171923] dark:text-[#FFF9EF] rounded-xl flex items-center justify-center gap-2.5 shadow-2xs active:scale-[0.98] transition-all cursor-pointer font-bold text-xs"
        >
          <span className="w-5 h-5 rounded bg-white flex items-center justify-center shrink-0">
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24">
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
        </button>

        {/* Continue as Guest */}
        {onClose && (
          <button
            type="button"
            onClick={handleGuestLogin}
            className="w-full py-1 text-xs font-bold text-[#52576A] hover:text-[#171923] dark:text-[#CBD2E1] dark:hover:text-[#FFF9EF] transition-colors cursor-pointer text-center"
          >
            ← Continue as Guest
          </button>
        )}

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
