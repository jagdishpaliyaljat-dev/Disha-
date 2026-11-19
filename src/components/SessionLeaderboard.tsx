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

// Realistic Aspirant Benchmarks for competitive feel
const BENCHMARK_ASPIRANTS = [
  { name: "Priya Sharma", photo: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100", scoreOffset: 0, timeOffset: -12 },
  { name: "Aditya Verma", photo: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100", scoreOffset: -1, timeOffset: 5 },
  { name: "Rohan Kumar", photo: "", scoreOffset: -1, timeOffset: 14 },
  { name: "Sneha Patel", photo: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100", scoreOffset: -2, timeOffset: -5 },
  { name: "Ankit Raj", photo: "", scoreOffset: -2, timeOffset: 8 },
  { name: "Vikram Meena", photo: "", scoreOffset: -3, timeOffset: -20 },
  { name: "Divya Choudhary", photo: "", scoreOffset: -3, timeOffset: 3 },
  { name: "Sandeep Yadav", photo: "", scoreOffset: -4, timeOffset: 10 },
];

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

      // Generate benchmark peers if fewer than 6 participants
      if (cloudEntries.length < 6) {
        BENCHMARK_ASPIRANTS.forEach((b, idx) => {
          const fakeUserId = `bm_usr_${idx}_${cleanTestId}`;
          if (!cloudEntries.some((e) => e.userId === fakeUserId)) {
            const calculatedScore = Math.max(0, Math.min(maxScore, currentScore + b.scoreOffset));
            const calculatedAccuracy = maxScore > 0 ? Math.round((calculatedScore / maxScore) * 100) : 75;
            const calculatedTime = Math.max(15, timeSpentSeconds + b.timeOffset);

            cloudEntries.push({
              id: fakeUserId,
              testId: cleanTestId,
              testTitle,
              userId: fakeUserId,
              userName: b.name,
              userPhoto: b.photo,
              score: calculatedScore,
              maxScore,
              accuracy: calculatedAccuracy,
              timeSpentSeconds: calculatedTime,
              submittedAt: new Date(Date.now() - (idx + 1) * 3600000).toISOString(),
              isCurrentUser: false,
            });
          }
        });
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
        <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-[#E5B842] via-[#C99A45] to-[#997324] text-white font-black text-xs flex items-center justify-center shadow-xs shadow-[#C99A45]/30 shrink-0 border border-[#F4C542]/50">
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
      <div className="w-7 h-7 rounded-xl bg-[#F7EFE2] dark:bg-[#252A3A] border border-[#E8D9C0] dark:border-[#31374A] text-[#52576A] dark:text-[#CBD2E1] font-mono font-black text-[11px] flex items-center justify-center shrink-0">
        #{rank}
      </div>
    );
  };

  return (
    <div className={`bg-white dark:bg-[#1F2330] border border-[#E8D9C0] dark:border-[#31374A] rounded-2xl sm:rounded-3xl p-4 sm:p-5 shadow-xs space-y-4 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-[#E8D9C0]/60 dark:border-[#31374A]">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-[#C99A45]/15 text-[#C99A45] border border-[#C99A45]/30 flex items-center justify-center shadow-xs">
            <Trophy className="w-4 h-4 fill-[#C99A45]/20" />
          </div>
          <div>
            <h3 className="text-xs sm:text-sm font-black text-[#171923] dark:text-[#FFF9EF] uppercase tracking-wider flex items-center gap-1.5">
              <span>Live Leaderboard</span>
              <span className="inline-flex items-center px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 text-[9px] font-mono font-bold lowercase">
                • live
              </span>
            </h3>
            <p className="text-[10px] font-bold text-[#787D91] dark:text-[#929AB0] uppercase tracking-widest">
              {totalParticipants} Aspirants Participated
            </p>
          </div>
        </div>

        {/* Tab Toggle */}
        <div className="flex items-center bg-[#F7EFE2] dark:bg-[#252A3A] p-0.5 rounded-xl border border-[#E8D9C0] dark:border-[#31374A]">
          <button
            type="button"
            onClick={() => setActiveTab("top")}
            className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
              activeTab === "top"
                ? "bg-[#800020] text-white shadow-xs"
                : "text-[#52576A] dark:text-[#CBD2E1] hover:text-[#171923] dark:hover:text-[#FFF9EF]"
            }`}
          >
            Top 10
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("standing")}
            className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
              activeTab === "standing"
                ? "bg-[#800020] text-white shadow-xs"
                : "text-[#52576A] dark:text-[#CBD2E1] hover:text-[#171923] dark:hover:text-[#FFF9EF]"
            }`}
          >
            Your Rank
          </button>
        </div>
      </div>

      {/* User's Mobile Summary Standing Card (Strict Burgundy + Gold Royal Palette) */}
      <div className="p-3 sm:p-3.5 rounded-xl sm:rounded-2xl bg-gradient-to-r from-[#800020] via-[#660019] to-[#520014] text-white shadow-sm border border-[#C99A45]/35 flex items-center justify-between gap-3 relative overflow-hidden">
        {/* Subtle decorative gold shimmer background */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-[#C99A45]/15 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none" />

        <div className="flex items-center gap-3 relative z-10 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur-md border border-[#C99A45]/40 flex flex-col items-center justify-center shrink-0">
            <span className="text-[8px] font-mono uppercase tracking-widest text-[#E8D9C0] leading-none mb-0.5">Rank</span>
            <span className="text-sm font-black font-mono leading-none text-white">#{userRank}</span>
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-black truncate max-w-[130px] sm:max-w-[180px] text-white">{currentUserName}</span>
              <span className="px-1.5 py-0.2 rounded bg-[#C99A45] text-[#171923] text-[8px] font-black uppercase tracking-wider">You</span>
            </div>
            <p className="text-[10px] text-[#F7EFE2] font-medium truncate mt-0.5">
              Better than <span className="font-black text-[#F4C542]">{percentile}%</span> of candidates
            </p>
          </div>
        </div>

        <div className="text-right relative z-10 shrink-0 font-mono">
          <span className="text-xs sm:text-sm font-black text-white block">{currentScore} / {maxScore}</span>
          <span className="text-[9.5px] font-bold text-emerald-300 block">{accuracy}% Acc</span>
        </div>
      </div>

      {/* Leaderboard Table / Rows */}
      {loading ? (
        <ContentLoader
          message="अभ्यर्थी रैंकिंग लोड हो रही है..."
          submessage="DISHA 20-20 • सटीक मेरिट गणना जारी"
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
                    ? "bg-[#800020]/6 dark:bg-[#800020]/20 border-2 border-[#800020] dark:border-[#C99A45]/80 shadow-xs ring-1 ring-[#800020]/20"
                    : "bg-[#FAF5ED]/50 dark:bg-[#252A3A]/40 border-[#E8D9C0]/70 dark:border-[#31374A]/70 hover:bg-[#FAF5ED] dark:hover:bg-[#252A3A]"
                }`}
              >
                {/* Rank & User Details */}
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  {getRankBadge(rank)}

                  {/* Avatar */}
                  <div className="w-8 h-8 rounded-full bg-[#F7EFE2] dark:bg-[#252A3A] border border-[#E8D9C0] dark:border-[#31374A] flex items-center justify-center shrink-0 overflow-hidden">
                    {entry.userPhoto ? (
                      <img src={entry.userPhoto} alt={entry.userName} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-[11px] font-black text-[#800020] dark:text-[#C99A45] uppercase">
                        {entry.userName.charAt(0)}
                      </span>
                    )}
                  </div>

                  {/* Name & Time */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className={`text-xs font-black truncate ${isUser ? "text-[#800020] dark:text-[#FFF9EF]" : "text-[#171923] dark:text-[#FFF9EF]"}`}>
                        {entry.userName}
                      </span>
                      {isUser && (
                        <span className="px-1.5 py-0.2 rounded bg-[#800020] text-white text-[8px] font-black uppercase tracking-wider shrink-0">
                          YOU
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-[9.5px] text-[#787D91] dark:text-[#929AB0] font-mono mt-0.5">
                      <span className="flex items-center gap-0.5">
                        <Clock className="w-2.5 h-2.5" />
                        {formatSecs(entry.timeSpentSeconds)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Score & Accuracy Badges */}
                <div className="text-right shrink-0 font-mono">
                  <div className="text-xs sm:text-sm font-black text-[#171923] dark:text-[#FFF9EF]">
                    {entry.score} <span className="text-[10px] font-normal text-[#787D91] dark:text-[#929AB0]">/ {entry.maxScore}</span>
                  </div>
                  <div className="text-[9px] font-bold text-emerald-700 dark:text-emerald-400">
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
