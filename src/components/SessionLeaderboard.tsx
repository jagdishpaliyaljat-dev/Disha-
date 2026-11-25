import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Trophy, Award, Medal, Users, Flame, RefreshCw, CheckCircle2, Clock, Sparkles, User, ChevronRight } from "lucide-react";
import { UserProfile } from "../types";
import { ContentLoader } from "./ui/LoadingScreen";

export interface LeaderboardEntry {
  id: string;
  testId: string;
  testTitle?: string;
  userId: string;
  userName: string;
  userPhoto?: string;
  score: number;
  maxScore: number;
  accuracy: number; // percentage e.g. 90
  timeSpentSeconds: number;
  submittedAt: string;
  isCurrentUser?: boolean;
}

interface SessionLeaderboardProps {
  testId: string;
  testTitle: string;
  currentScore: number; // e.g. totalCorrect
  maxScore: number; // e.g. questions.length
  accuracy: number; // e.g. sessionAccuracy
  timeSpentSeconds: number;
  userProfile?: UserProfile | null;
  allowCloudWrite?: boolean;
  className?: string;
}

export const SessionLeaderboard: React.FC<SessionLeaderboardProps> = ({
  testId,
  testTitle,
  currentScore,
  maxScore,
  accuracy,
  timeSpentSeconds,
  userProfile,
  allowCloudWrite = false,
  className = "",
}) => {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"top" | "standing">("top");

  const cleanTestId = (testId || testTitle || "general_practice")
    .toString()
    .replace(/[^a-zA-Z0-9_-]/g, "_")
    .toLowerCase();

  const currentUserId = userProfile?.id || `guest_${cleanTestId}`;
  const currentUserName = userProfile?.name || "You (Aspirant)";
  const currentUserPhoto = userProfile?.photoURL || userProfile?.avatar || "";

  useEffect(() => {
    let isMounted = true;

    async function syncAndFetchLeaderboard() {
      setLoading(true);

      const myEntry: LeaderboardEntry = {
        id: `${cleanTestId}_${currentUserId}`,
        testId: cleanTestId,
        testTitle,
        userId: currentUserId,
        userName: currentUserName,
        userPhoto: currentUserPhoto,
        score: currentScore,
        maxScore,
        accuracy,
        timeSpentSeconds,
        submittedAt: new Date().toISOString(),
        isCurrentUser: true,
      };

      // Save to localStorage as instant offline storage
      let cloudEntries: LeaderboardEntry[] = [];
      try {
        const localKey = `disha2020_lb_${cleanTestId}`;
        const legacyKey = `quizpro_lb_${cleanTestId}`;
        const existingRaw = localStorage.getItem(localKey) || localStorage.getItem(legacyKey);
        let localList: LeaderboardEntry[] = existingRaw ? JSON.parse(existingRaw) : [];
        localList = localList.filter((e) => e.userId !== currentUserId);
        localList.push(myEntry);
        localStorage.setItem(localKey, JSON.stringify(localList));
        cloudEntries = [...localList];
      } catch (_) {}

      // Check if user entry is in cloudEntries
      if (!cloudEntries.some((e) => e.userId === currentUserId)) {
        cloudEntries.push(myEntry);
      }

      // Sort by score DESC, then timeSpentSeconds ASC
      cloudEntries.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return a.timeSpentSeconds - b.timeSpentSeconds;
      });

      if (isMounted) {
        setEntries(cloudEntries);
        setLoading(false);
      }
    }

    syncAndFetchLeaderboard();

    return () => {
      isMounted = false;
    };
  }, [cleanTestId, currentScore, maxScore, accuracy, timeSpentSeconds, currentUserId, currentUserName, allowCloudWrite]);

  // Calculate User Rank & Percentile
  const userRankIndex = entries.findIndex((e) => e.userId === currentUserId || e.isCurrentUser);
  const userRank = userRankIndex !== -1 ? userRankIndex + 1 : 1;
  const totalParticipants = entries.length;
  const percentile = totalParticipants > 1 ? Math.max(1, Math.round(((totalParticipants - userRank) / totalParticipants) * 100)) : 100;

  const topTen = entries.slice(0, 10);

  // Standing View window (2 above, user, 2 below)
  let standingList: LeaderboardEntry[] = [];
  if (userRankIndex !== -1) {
    const startIdx = Math.max(0, userRankIndex - 2);
    const endIdx = Math.min(entries.length, userRankIndex + 3);
    standingList = entries.slice(startIdx, endIdx);
  } else {
    standingList = topTen.slice(0, 5);
  }

  const displayedList = activeTab === "top" ? topTen : standingList;

  const formatSecs = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    if (m === 0) return `${s}s`;
    return `${m}m ${s}s`;
  };

  const getRankBadge = (rank: number) => {
    if (rank === 1) {
      return (
        <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-[#E5B842] via-[#A78BFA] to-[#997324] text-white font-black text-xs flex items-center justify-center shadow-xs shadow-[#A78BFA]/30 shrink-0 border border-[#F4C542]/50">
          🥇
        </div>
      );
    }
    if (rank === 2) {
      return (
        <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-[#E2E8F0] via-[#CBD5E1] to-[#94A3B8] text-slate-800 font-black text-xs flex items-center justify-center shadow-xs shrink-0 border border-slate-300">
          🥈
        </div>
      );
    }
    if (rank === 3) {
      return (
        <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-[#D97706] to-[#92400E] text-white font-black text-xs flex items-center justify-center shadow-xs shrink-0 border border-amber-600/50">
          🥉
        </div>
      );
    }
    return (
      <div className="w-7 h-7 rounded-xl bg-slate-100 dark:bg-[#241D48] border border-slate-200 dark:border-[#31275E] text-slate-600 dark:text-slate-300 font-mono font-black text-[11px] flex items-center justify-center shrink-0">
        #{rank}
      </div>
    );
  };

  return (
    <div className={`bg-white dark:bg-[#1B1536] border border-slate-200 dark:border-[#31275E] rounded-2xl sm:rounded-3xl p-4 sm:p-5 shadow-xs space-y-4 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-slate-200/60 dark:border-[#31275E]">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-[#A78BFA]/15 text-amber-500 border border-[#A78BFA]/30 flex items-center justify-center shadow-xs">
            <Trophy className="w-4 h-4 fill-amber-500/20" />
          </div>
          <div>
            <h3 className="text-xs sm:text-sm font-black text-slate-900 dark:text-slate-50 uppercase tracking-wider flex items-center gap-1.5">
              <span>Live Leaderboard</span>
              <span className="inline-flex items-center px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 text-[11px] font-mono font-bold lowercase">
                • live
              </span>
            </h3>
            <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">
              {totalParticipants} Aspirants Participated
            </p>
          </div>
        </div>

        {/* Tab Toggle */}
        <div className="flex items-center bg-slate-100 dark:bg-[#241D48] p-0.5 rounded-xl border border-slate-200 dark:border-[#31275E]">
          <button
            type="button"
            onClick={() => setActiveTab("top")}
            className={`px-3 py-1 rounded-lg text-[11px] font-black uppercase tracking-wider transition-all cursor-pointer ${
              activeTab === "top"
                ? "bg-[#7045D8] text-white shadow-xs"
                : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            Top 10
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("standing")}
            className={`px-3 py-1 rounded-lg text-[11px] font-black uppercase tracking-wider transition-all cursor-pointer ${
              activeTab === "standing"
                ? "bg-[#7045D8] text-white shadow-xs"
                : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            Your Rank
          </button>
        </div>
      </div>

      {/* User's Mobile Summary Standing Card (Strict Burgundy + Gold Royal Palette) */}
      <div className="p-3 sm:p-3.5 rounded-xl sm:rounded-2xl bg-gradient-to-r from-[#7045D8] via-[#5B32BF] to-[#520014] text-white shadow-sm border border-[#A78BFA]/35 flex items-center justify-between gap-3 relative overflow-hidden">
        {/* Subtle decorative gold shimmer background */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-[#A78BFA]/15 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none" />

        <div className="flex items-center gap-3 relative z-10 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur-md border border-[#A78BFA]/40 flex flex-col items-center justify-center shrink-0">
            <span className="text-[11px] font-mono uppercase tracking-widest text-slate-200 leading-none mb-0.5">Rank</span>
            <span className="text-sm font-black font-mono leading-none text-white">#{userRank}</span>
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-black truncate max-w-[130px] sm:max-w-[180px] text-white">{currentUserName}</span>
              <span className="px-1.5 py-0.2 rounded bg-[#A78BFA] text-slate-900 text-[11px] font-black uppercase tracking-wider">You</span>
            </div>
            <p className="text-[11px] text-slate-100 font-medium truncate mt-0.5">
              Better than <span className="font-black text-[#F4C542]">{percentile}%</span> of candidates
            </p>
          </div>
        </div>

        <div className="text-right relative z-10 shrink-0 font-mono">
          <span className="text-xs sm:text-sm font-black text-white block">{currentScore} / {maxScore}</span>
          <span className="text-[11px] font-bold text-emerald-300 block">{accuracy}% Acc</span>
        </div>
      </div>

      {/* Leaderboard Table / Rows */}
      {loading ? (
        <ContentLoader
          message="Loading Candidate Rankings..."
          submessage="Disha PYQ • Precise Merit Calculation in Progress"
          minHeight="min-h-[160px]"
          size="sm"
        />
      ) : (
        <div className="space-y-1.5">
          {displayedList.map((entry) => {
            const rank = entries.findIndex((e) => e.id === entry.id) + 1;
            const isUser = entry.isCurrentUser || entry.userId === currentUserId;

            return (
              <div
                key={entry.id}
                className={`p-2.5 sm:p-3 rounded-xl border flex items-center justify-between gap-2.5 transition-all ${
                  isUser
                    ? "bg-[#7045D8]/6 dark:bg-[#7045D8]/20 border-2 border-[#7045D8] dark:border-[#A78BFA]/80 shadow-xs ring-1 ring-[#7045D8]/20"
                    : "bg-[#FAF5ED]/50 dark:bg-[#241D48]/40 border-slate-200/70 dark:border-[#31275E]/70 hover:bg-[#FAF5ED] dark:hover:bg-[#241D48]"
                }`}
              >
                {/* Rank & User Details */}
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  {getRankBadge(rank)}

                  {/* Avatar */}
                  <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-[#241D48] border border-slate-200 dark:border-[#31275E] flex items-center justify-center shrink-0 overflow-hidden">
                    {entry.userPhoto ? (
                      <img src={entry.userPhoto} alt={entry.userName} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-[11px] font-black text-[#7045D8] dark:text-[#A78BFA] uppercase">
                        {entry.userName.charAt(0)}
                      </span>
                    )}
                  </div>

                  {/* Name & Time */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className={`text-xs font-black truncate ${isUser ? "text-[#7045D8] dark:text-slate-50" : "text-slate-900 dark:text-slate-50"}`}>
                        {entry.userName}
                      </span>
                      {isUser && (
                        <span className="px-1.5 py-0.2 rounded bg-[#7045D8] text-white text-[11px] font-black uppercase tracking-wider shrink-0">
                          YOU
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400 font-mono mt-0.5">
                      <span className="flex items-center gap-0.5">
                        <Clock className="w-2.5 h-2.5" />
                        {formatSecs(entry.timeSpentSeconds)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Score & Accuracy Badges */}
                <div className="text-right shrink-0 font-mono">
                  <div className="text-xs sm:text-sm font-black text-slate-900 dark:text-slate-50">
                    {entry.score} <span className="text-[11px] font-normal text-slate-500 dark:text-slate-400">/ {entry.maxScore}</span>
                  </div>
                  <div className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400">
                    {entry.accuracy}%
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
