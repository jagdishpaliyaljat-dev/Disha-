import React from "react";
import { ActiveTab } from "../types";
import { Compass, Home, BookOpen, Trophy, Archive, User, ArrowLeft } from "lucide-react";

interface NotFoundViewProps {
  onNavigateTab: (tab: ActiveTab) => void;
  requestedPath?: string;
}

export const NotFoundView: React.FC<NotFoundViewProps> = ({
  onNavigateTab,
  requestedPath,
}) => {
  const currentPath = requestedPath || (typeof window !== "undefined" ? window.location.pathname : "");

  return (
    <div
      id="disha-not-found-screen"
      role="region"
      aria-label="404 Page Not Found"
      className="min-h-[75vh] flex flex-col items-center justify-center px-4 py-12 text-center max-w-xl mx-auto"
    >
      {/* 404 Visual Icon Badge */}
      <div className="relative mb-6">
        <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-3xl bg-[#7045D8]/10 dark:bg-[#7045D8]/15 border border-[#7045D8]/20 dark:border-[#A78BFA]/30 flex items-center justify-center text-[#7045D8] dark:text-[#A78BFA] shadow-xl shadow-[#7045D8]/5 animate-pulse">
          <Compass className="w-10 h-10 sm:w-12 sm:h-12 stroke-[1.8]" />
        </div>
        <span className="absolute -bottom-2 -right-2 px-2.5 py-0.5 rounded-full text-[11px] font-black tracking-wider uppercase bg-[#7045D8] text-white dark:bg-[#7045D8] shadow-md">
          404
        </span>
      </div>

      {/* Headlines */}
      <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-slate-50 tracking-tight">
        Page Not Found
      </h1>

      {/* Description */}
      <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 mt-3 max-w-md leading-relaxed">
        The link you followed may be broken, or the page may have been moved. 
        {currentPath && (
          <span className="block mt-1 font-mono text-[11px] text-slate-400 dark:text-slate-500 break-all">
            Requested: {currentPath}
          </span>
        )}
      </p>

      {/* Primary Actions */}
      <div className="flex flex-col sm:flex-row items-center gap-3 mt-7 w-full sm:w-auto">
        <button
          type="button"
          onClick={() => onNavigateTab("home")}
          className="w-full sm:w-auto px-6 py-3 rounded-2xl bg-[#7045D8] hover:bg-[#5B32BF] dark:bg-[#7045D8] dark:hover:bg-[#5B32BF] text-white font-bold text-sm tracking-wide shadow-lg shadow-[#7045D8]/20 active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-2"
        >
          <Home className="w-4 h-4" />
          <span>Go to Home</span>
        </button>

        {typeof window !== "undefined" && window.history.length > 1 && (
          <button
            type="button"
            onClick={() => window.history.back()}
            className="w-full sm:w-auto px-5 py-3 rounded-2xl bg-slate-100 dark:bg-[#241D48] hover:bg-slate-200 dark:hover:bg-[#31275E] border border-slate-200 dark:border-[#31275E] text-slate-900 dark:text-slate-50 font-bold text-sm active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Go Back</span>
          </button>
        )}
      </div>

      {/* Quick Navigation Directory */}
      <div className="mt-10 pt-8 border-t border-slate-200 dark:border-[#31275E] w-full">
        <p className="text-[11px] font-bold text-[#7045D8] dark:text-[#A78BFA] uppercase tracking-wider mb-4">
          Quick Links
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <button
            type="button"
            onClick={() => onNavigateTab("topics")}
            className="p-3 rounded-xl bg-white dark:bg-[#1B1536] border border-slate-200 dark:border-[#31275E] hover:border-[#7045D8] dark:hover:border-[#A78BFA] text-left transition-all active:scale-95 cursor-pointer group"
          >
            <BookOpen className="w-4 h-4 text-[#7045D8] dark:text-[#A78BFA] mb-1.5 group-hover:scale-110 transition-transform" />
            <div className="text-xs font-bold text-slate-900 dark:text-slate-50">Subjects</div>
            <div className="text-[11px] text-slate-600 dark:text-slate-400">Course Index</div>
          </button>

          <button
            type="button"
            onClick={() => onNavigateTab("live_tests")}
            className="p-3 rounded-xl bg-white dark:bg-[#1B1536] border border-slate-200 dark:border-[#31275E] hover:border-[#7045D8] dark:hover:border-[#A78BFA] text-left transition-all active:scale-95 cursor-pointer group"
          >
            <Trophy className="w-4 h-4 text-[#7045D8] dark:text-[#A78BFA] mb-1.5 group-hover:scale-110 transition-transform" />
            <div className="text-xs font-bold text-slate-900 dark:text-slate-50">Live Tests</div>
            <div className="text-[11px] text-slate-600 dark:text-slate-400">Mock Exams</div>
          </button>

          <button
            type="button"
            onClick={() => onNavigateTab("pyq_vault")}
            className="p-3 rounded-xl bg-white dark:bg-[#1B1536] border border-slate-200 dark:border-[#31275E] hover:border-[#7045D8] dark:hover:border-[#A78BFA] text-left transition-all active:scale-95 cursor-pointer group"
          >
            <Archive className="w-4 h-4 text-[#7045D8] dark:text-[#A78BFA] mb-1.5 group-hover:scale-110 transition-transform" />
            <div className="text-xs font-bold text-slate-900 dark:text-slate-50">PYQ Vault</div>
            <div className="text-[11px] text-slate-600 dark:text-slate-400">Past Papers</div>
          </button>

          <button
            type="button"
            onClick={() => onNavigateTab("profile")}
            className="p-3 rounded-xl bg-white dark:bg-[#1B1536] border border-slate-200 dark:border-[#31275E] hover:border-[#7045D8] dark:hover:border-[#A78BFA] text-left transition-all active:scale-95 cursor-pointer group"
          >
            <User className="w-4 h-4 text-[#7045D8] dark:text-[#A78BFA] mb-1.5 group-hover:scale-110 transition-transform" />
            <div className="text-xs font-bold text-slate-900 dark:text-slate-50">Profile</div>
            <div className="text-[11px] text-slate-600 dark:text-slate-400">Student Profile</div>
          </button>
        </div>
      </div>
    </div>
  );
};
