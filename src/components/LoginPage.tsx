import React, { useState } from "react";
import {
  BookOpen,
  Trophy,
  FileText,
  BarChart2,
  ShieldCheck,
  X,
  UserCheck,
  GraduationCap,
} from "lucide-react";
import { UserProfile } from "../types";
import { supabase, isSupabaseConfigured } from "../lib/supabase";
import { ADMIN_EMAILS, saveUserProfile } from "../utils/userProfileStorage";
import { AppLogo } from "./AppLogo";
import { productionMonitor } from "../utils/productionMonitoring";

interface LoginPageProps {
  onLoginSuccess: (profile: UserProfile) => void;
  onClose?: () => void;
}

export function LoginPage({ onLoginSuccess, onClose }: LoginPageProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [configNotice, setConfigNotice] = useState<string | null>(null);
  const [showStudentForm, setShowStudentForm] = useState(false);
  const [customName, setCustomName] = useState("");
  const [customEmail, setCustomEmail] = useState("");

  // Supabase Google Login
  const handleGoogleLogin = async () => {
    setIsLoading(true);
    setConfigNotice(null);
    productionMonitor.recordUserJourney("login", "start");

    try {
      if (isSupabaseConfigured()) {
        const { data, error } = await supabase.auth.signInWithOAuth({
          provider: "google",
          options: {
            redirectTo: window.location.origin,
          },
        });

        if (error) {
          console.warn("Supabase Google OAuth error:", error.message);
          if (error.message?.toLowerCase().includes("not enabled")) {
            setConfigNotice(
              "Supabase Dashboard me Google Provider abhi enable nahi hai. Aap neeche 'Sign in as Admin' ya 'Quick Student Login' se turant login kar sakte hain."
            );
          } else {
            setConfigNotice(`Authentication note: ${error.message}`);
          }
        } else if (data?.url) {
          window.location.href = data.url;
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

  // Direct Admin Login (instant access for administrator)
  const handleAdminLogin = () => {
    setIsLoading(true);
    productionMonitor.recordUserJourney("login", "success", { role: "admin" });
    const adminProfile: UserProfile = {
      id: "admin-jagdish",
      name: "Jagdish Paliyal (Admin)",
      email: "jagdishpaliyaljat@gmail.com",
      role: "admin",
      status: "active",
      createdAt: new Date().toISOString(),
    };
    saveUserProfile(adminProfile);
    onLoginSuccess(adminProfile);
  };

  // Quick Student Login
  const handleStudentLogin = (e?: React.FormEvent) => {
    e?.preventDefault();
    const name = customName.trim() || "Scholar Student";
    const email = customEmail.trim() || `student_${Math.random().toString(36).slice(2, 7)}@disha2020.in`;
    const emailLower = email.toLowerCase();
    const isAdmin = ADMIN_EMAILS.includes(emailLower);

    const profile: UserProfile = {
      id: `std_${Math.random().toString(36).slice(2, 9)}`,
      name,
      email,
      role: isAdmin ? "admin" : "student",
      status: "active",
      createdAt: new Date().toISOString(),
    };

    saveUserProfile(profile);
    productionMonitor.recordUserJourney("login", "success", { role: profile.role });
    onLoginSuccess(profile);
  };

  // Continue as Guest
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
      saveUserProfile(guestProfile);
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
      <main className="w-full max-w-md mx-auto flex-1 flex flex-col items-center justify-center px-5 py-6 space-y-6">
        <AppLogo size="hero" variant="primary" showTagline={true} />

        {/* 4 Highlight Modules */}
        <div className="w-full grid grid-cols-2 gap-2.5">
          {[
            { icon: BookOpen, label: "MCQ Practice", sub: "Chapter-wise Practice" },
            { icon: Trophy, label: "Live Mock Tests", sub: "Ranks & Time Limits" },
            { icon: FileText, label: "Official PYQ Vault", sub: "Previous Year Papers" },
            { icon: BarChart2, label: "Smart Analytics", sub: "Identify Weak Areas" },
          ].map((feat) => (
            <div
              key={feat.label}
              className="bg-white dark:bg-[#1F2330] border border-[#E8D9C0] dark:border-[#31374A] rounded-2xl p-3 flex items-center gap-2.5 shadow-2xs"
            >
              <div className="w-9 h-9 rounded-xl bg-[#800020]/10 dark:bg-[#F47B20]/15 text-[#800020] dark:text-[#F47B20] flex items-center justify-center shrink-0">
                <feat.icon className="w-4.5 h-4.5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-extrabold text-[#171923] dark:text-[#FFF9EF] truncate">
                  {feat.label}
                </p>
                <p className="text-[10.5px] font-medium text-[#52576A] dark:text-[#929AB0] truncate">
                  {feat.sub}
                </p>
              </div>
            </div>
          ))}
        </div>
      </main>

      {/* Bottom Sign-In Card */}
      <footer className="w-full max-w-md mx-auto bg-white dark:bg-[#1F2330] rounded-t-3xl px-6 pt-6 pb-7 shadow-[0_-10px_30px_rgba(23,25,35,0.06)] border-t border-[#E8D9C0] dark:border-[#31374A] space-y-3.5 shrink-0 z-30">
        <div className="text-center space-y-1">
          <h1 className="text-xl font-extrabold text-[#171923] dark:text-[#FFF9EF] tracking-tight">
            Welcome to DISHA <span className="text-[#F47B20]">20-20</span>
          </h1>
          <p className="text-xs text-[#52576A] dark:text-[#CBD2E1] font-medium">
            Sign in to save your study progress and sync across devices
          </p>
        </div>

        {/* 1. Google Continue */}
        <button
          onClick={handleGoogleLogin}
          disabled={isLoading}
          className="w-full h-12 bg-[#800020] hover:bg-[#5E0017] dark:bg-[#F47B20] dark:hover:bg-[#E06A12] text-white rounded-2xl flex items-center justify-center gap-3 shadow-xs active:scale-[0.98] transition-all cursor-pointer font-extrabold text-sm"
        >
          {isLoading ? (
            <div className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
          ) : (
            <>
              <span className="w-7 h-7 rounded-lg bg-white flex items-center justify-center shrink-0">
                <svg className="w-4 h-4" viewBox="0 0 24 24">
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

        {/* 2. Direct Admin & Student Quick Actions */}
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={handleAdminLogin}
            className="h-10 px-3 rounded-xl bg-[#F7EFE2] dark:bg-[#252A3A] hover:bg-[#EFE3CF] dark:hover:bg-[#31374A] border border-[#E8D9C0] dark:border-[#31374A] text-[#800020] dark:text-[#F47B20] text-xs font-extrabold flex items-center justify-center gap-1.5 transition-all active:scale-[0.98] cursor-pointer"
          >
            <UserCheck className="w-4 h-4 shrink-0" />
            <span>Admin Sign In</span>
          </button>

          <button
            type="button"
            onClick={() => setShowStudentForm(!showStudentForm)}
            className="h-10 px-3 rounded-xl bg-[#F7EFE2] dark:bg-[#252A3A] hover:bg-[#EFE3CF] dark:hover:bg-[#31374A] border border-[#E8D9C0] dark:border-[#31374A] text-[#171923] dark:text-[#FFF9EF] text-xs font-extrabold flex items-center justify-center gap-1.5 transition-all active:scale-[0.98] cursor-pointer"
          >
            <GraduationCap className="w-4 h-4 shrink-0" />
            <span>Student Sign In</span>
          </button>
        </div>

        {/* Student Custom Name Form (Collapsible) */}
        {showStudentForm && (
          <form onSubmit={handleStudentLogin} className="p-3 bg-[#FFF9EF] dark:bg-[#171923] rounded-xl border border-[#E8D9C0] dark:border-[#31374A] space-y-2">
            <input
              type="text"
              placeholder="Your Name (e.g. Ramesh Sharma)"
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              className="w-full h-9 px-3 text-xs rounded-lg bg-white dark:bg-[#1F2330] border border-[#E8D9C0] dark:border-[#31374A] focus:outline-hidden focus:ring-1 focus:ring-[#800020] dark:focus:ring-[#F47B20]"
            />
            <button
              type="submit"
              className="w-full h-8 bg-[#800020] dark:bg-[#F47B20] text-white text-xs font-bold rounded-lg cursor-pointer hover:opacity-90 transition-all"
            >
              Start Practicing as Student
            </button>
          </form>
        )}

        {/* 3. Continue as Guest */}
        <button
          type="button"
          onClick={handleGuestLogin}
          className="w-full py-1 text-xs font-bold text-[#52576A] hover:text-[#171923] dark:text-[#CBD2E1] dark:hover:text-[#FFF9EF] transition-colors cursor-pointer text-center"
        >
          ← Continue as Guest
        </button>

        {configNotice && (
          <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 rounded-xl text-[11px] text-amber-800 dark:text-amber-300 leading-relaxed text-center">
            {configNotice}
          </div>
        )}

        <div className="flex items-center justify-center gap-2 pt-0.5">
          <ShieldCheck className="w-4 h-4 text-[#15803D] dark:text-[#22C55E]" />
          <span className="text-[11px] font-medium text-[#52576A] dark:text-[#929AB0]">
            Supabase encrypted cloud sync for bookmarks &amp; mock history
          </span>
        </div>

        <p className="text-[10.5px] font-medium text-[#787D91] dark:text-[#929AB0] text-center leading-relaxed">
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
