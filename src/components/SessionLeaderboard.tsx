import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Trophy, Award, Medal, Users, Flame, RefreshCw, CheckCircle2, Clock, Sparkles, User, ChevronRight } from "lucide-react";
import { UserProfile } from "../types";
import { db, auth } from "../lib/firebase";
import { collection, query, where, orderBy, limit } from "firebase/firestore";
import { guardedGetDocs, guardedSetDoc } from "../utils/quotaTracker";
import { updateLeaderboardToCloud } from "../utils/firebaseSyncService";
import { isStudentTrackingAllowed } from "../utils/studentWriteBuffer";

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

  const currentUserId = userProfile?.id || auth.currentUser?.uid || `guest_${cleanTestId}`;
  const currentUserName = userProfile?.name || auth.currentUser?.displayName || "You (Aspirant)";
  const currentUserPhoto = userProfile?.photoURL || userProfile?.avatar || auth.currentUser?.photoURL || "";

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

      // 1. Save entry to Cloud ONLY for official Live Tests / PYQs when student tracking is allowed
      if (allowCloudWrite && isStudentTrackingAllowed(userProfile)) {
        try {
          await updateLeaderboardToCloud(myEntry);
        } catch (err) {
          console.warn("Cloud leaderboard sync skipped/fallback to local:", err);
        }
      }

      // Save to localStorage as instant offline fallback
      try {
        const localKey = `quizpro_lb_${cleanTestId}`;
        const existingRaw = localStorage.getItem(localKey);
        let localList: LeaderboardEntry[] = existingRaw ? JSON.parse(existingRaw) : [];
        localList = localList.filter((e) => e.userId !== currentUserId);
        localList.push(myEntry);
        localStorage.setItem(localKey, JSON.stringify(localList));
      } catch (_) {}

      // 2. Query Firestore for live leaderboard entries
      let cloudEntries: LeaderboardEntry[] = [];
      try {
        const lbRef = collection(db, "leaderboard");
        const q = query(lbRef, where("testId", "==", cleanTestId), limit(50));
        const snap = await guardedGetDocs(q, "Student", "Fetch Session Leaderboard");

        if (!snap.empty) {
          snap.forEach((docSnap) => {
            const data = docSnap.data() as any;
            cloudEntries.push({
              id: docSnap.id,
              testId: data.testId || cleanTestId,
              testTitle: data.testTitle || testTitle,
              userId: data.userId || docSnap.id,
              userName: data.userName || "Anonymous Aspirant",
              userPhoto: data.userPhoto || "",
              score: Number(data.score) || 0,
              maxScore: Number(data.maxScore) || maxScore || 10,
              accuracy: Number(data.accuracy) || 0,
              timeSpentSeconds: Number(data.timeSpentSeconds) || 60,
              submittedAt: data.submittedAt || new Date().toISOString(),
              isCurrentUser: data.userId === currentUserId,
            });
          });
        }
      } catch (err) {
        console.warn("Error fetching cloud leaderboard:", err);
      }

      // Check if user entry is in cloudEntries
      if (!cloudEntries.some((e) => e.userId === currentUserId)) {
        cloudEntries.push(myEntry);
      }

      // 3. Generate benchmark peers if fewer than 6 participants
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
        <div className="w-7 h-7 rounded-xl bg-amber-500 text-white font-black text-xs flex items-center justify-center shadow-md shadow-amber-500/30 shrink-0">
          🥇
        </div>
      );
    }
    if (rank === 2) {
      return (
        <div className="w-7 h-7 rounded-xl bg-slate-300 dark:bg-slate-700 text-slate-800 dark:text-white font-black text-xs flex items-center justify-center shadow-md shadow-slate-400/20 shrink-0">
          🥈
        </div>
      );
    }
    if (rank === 3) {
      return (
        <div className="w-7 h-7 rounded-xl bg-amber-700 dark:bg-amber-800 text-amber-100 font-black text-xs flex items-center justify-center shadow-md shadow-amber-800/20 shrink-0">
          🥉
        </div>
      );
    }
    return (
      <div className="w-7 h-7 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 font-mono font-black text-[11px] flex items-center justify-center shrink-0">
        #{rank}
      </div>
    );
  };

  return (
    <div className={`bg-white dark:bg-[#111A2E] border border-slate-200/90 dark:border-slate-800 rounded-2xl sm:rounded-3xl p-4 sm:p-5 shadow-sm space-y-4 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2 pb-1 border-b border-slate-100 dark:border-slate-800/80">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 flex items-center justify-center">
            <Trophy className="w-4 h-4 fill-amber-500/20" />
          </div>
          <div>
            <h3 className="text-xs sm:text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
              <span>Live Leaderboard</span>
              <span className="inline-flex items-center px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[9px] font-mono lowercase">
                • live
              </span>
            </h3>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              {totalParticipants} Aspirants Participated
            </p>
          </div>
        </div>

        {/* Tab Toggle */}
        <div className="flex items-center bg-slate-100 dark:bg-slate-900 p-0.5 rounded-xl border border-slate-200/60 dark:border-slate-800">
          <button
            type="button"
            onClick={() => setActiveTab("top")}
            className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
              activeTab === "top"
                ? "bg-white dark:bg-[#111A2E] text-blue-600 dark:text-blue-400 shadow-sm"
                : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            }`}
          >
            Top 10
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("standing")}
            className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
              activeTab === "standing"
                ? "bg-white dark:bg-[#111A2E] text-blue-600 dark:text-blue-400 shadow-sm"
                : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            }`}
          >
            Your Rank
          </button>
        </div>
      </div>

      {/* User's Mobile Summary Standing Card */}
      <div className="p-3 rounded-xl sm:rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-indigo-700 text-white shadow-md shadow-blue-600/15 flex items-center justify-between gap-3 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-xl -mr-10 -mt-10 pointer-events-none" />

        <div className="flex items-center gap-3 relative z-10 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-white/15 backdrop-blur-md border border-white/20 flex flex-col items-center justify-center shrink-0">
            <span className="text-[8px] font-mono uppercase tracking-widest text-blue-200 leading-none mb-0.5">Rank</span>
            <span className="text-sm font-black font-mono leading-none">#{userRank}</span>
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-black truncate max-w-[130px] sm:max-w-[180px]">{currentUserName}</span>
              <span className="px-1.5 py-0.2 rounded bg-amber-400 text-slate-900 text-[8px] font-black uppercase tracking-wider">You</span>
            </div>
            <p className="text-[10px] text-blue-100 font-bold truncate mt-0.5">
              Better than <span className="font-black text-amber-300">{percentile}%</span> of candidates
            </p>
          </div>
        </div>

        <div className="text-right relative z-10 shrink-0 font-mono">
          <span className="text-xs sm:text-sm font-black block">{currentScore} / {maxScore}</span>
          <span className="text-[9px] font-bold text-emerald-300 block">{accuracy}% Acc</span>
        </div>
      </div>

      {/* Leaderboard Table / Rows */}
      {loading ? (
        <div className="py-8 text-center space-y-2">
          <RefreshCw className="w-5 h-5 text-blue-500 animate-spin mx-auto" />
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Loading Aspirant Ranks...</p>
        </div>
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
                    ? "bg-blue-50/80 dark:bg-blue-950/30 border-blue-400 dark:border-blue-600/80 ring-2 ring-blue-500/20 shadow-sm"
                    : "bg-slate-50/60 dark:bg-slate-900/40 border-slate-100 dark:border-slate-800/80 hover:bg-slate-100/50 dark:hover:bg-slate-800/50"
                }`}
              >
                {/* Rank & User Details */}
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  {getRankBadge(rank)}

                  {/* Avatar */}
                  <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 flex items-center justify-center shrink-0 overflow-hidden">
                    {entry.userPhoto ? (
                      <img src={entry.userPhoto} alt={entry.userName} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-[11px] font-black text-slate-600 dark:text-slate-300 uppercase">
                        {entry.userName.charAt(0)}
                      </span>
                    )}
                  </div>

                  {/* Name & Time */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className={`text-xs font-black truncate ${isUser ? "text-blue-900 dark:text-blue-100" : "text-slate-800 dark:text-slate-200"}`}>
                        {entry.userName}
                      </span>
                      {isUser && (
                        <span className="px-1.5 py-0.2 rounded bg-blue-600 text-white text-[8px] font-black uppercase tracking-wider shrink-0">
                          YOU
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-[9.5px] text-slate-400 dark:text-slate-500 font-mono mt-0.5">
                      <span className="flex items-center gap-0.5">
                        <Clock className="w-2.5 h-2.5" />
                        {formatSecs(entry.timeSpentSeconds)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Score & Accuracy Badges */}
                <div className="text-right shrink-0 font-mono">
                  <div className="text-xs sm:text-sm font-black text-slate-900 dark:text-white">
                    {entry.score} <span className="text-[10px] font-normal text-slate-400">/ {entry.maxScore}</span>
                  </div>
                  <div className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400">
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
