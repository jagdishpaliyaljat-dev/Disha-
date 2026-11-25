import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Trophy, 
  Award, 
  Medal, 
  Users, 
  Flame, 
  RefreshCw, 
  CheckCircle2, 
  Clock, 
  Sparkles, 
  User, 
  ChevronRight,
  TrendingUp,
  Target,
  Zap,
  Calendar
} from "lucide-react";
import { UserProfile } from "../types";
import { ContentLoader } from "./ui/LoadingScreen";
import { UserAvatar } from "./ui/UserAvatar";

function getStartOfWeekId(): string {
  const d = new Date();
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d.setDate(diff));
  return monday.toISOString().split("T")[0];
}

export interface WeeklyLeaderboardEntry {
  userId: string;
  userName: string;
  userPhoto?: string;
  weekId: string;
  totalAttempted: number;
  totalCorrect: number;
  averageAccuracy: number;
  totalPoints: number;
  updatedAt: string;
}

interface WeeklyLeaderboardProps {
  userProfile?: UserProfile | null;
  className?: string;
}

export const WeeklyLeaderboard: React.FC<WeeklyLeaderboardProps> = ({
  userProfile,
  className = "",
}) => {
  const [entries, setEntries] = useState<WeeklyLeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const currentWeekId = getStartOfWeekId();
  const currentUserId = userProfile?.id;

  useEffect(() => {
    let isMounted = true;

    async function fetchLeaderboard() {
      setLoading(true);
      try {
        const localKey = `disha2020_weekly_lb_${currentWeekId}`;
        const legacyKey = `quizpro_weekly_lb_${currentWeekId}`;
        const raw = localStorage.getItem(localKey) || localStorage.getItem(legacyKey);
        const localEntries: WeeklyLeaderboardEntry[] = raw ? JSON.parse(raw) : [];

        if (isMounted) {
          setEntries(localEntries);
          setLoading(false);
        }
      } catch (err) {
        console.error("Error fetching weekly leaderboard:", err);
        if (isMounted) setLoading(false);
      }
    }

    fetchLeaderboard();
    return () => { isMounted = false; };
  }, [currentWeekId]);

  const userRankIndex = entries.findIndex((e) => e.userId === currentUserId);
  const userRank = userRankIndex !== -1 ? userRankIndex + 1 : null;

  const getRankBadge = (rank: number) => {
    if (rank === 1) return <span className="text-xl">🥇</span>;
    if (rank === 2) return <span className="text-xl">🥈</span>;
    if (rank === 3) return <span className="text-xl">🥉</span>;
    return <span className="text-xs font-black text-slate-400 font-mono">#{rank}</span>;
  };

  return (
    <div className={`bg-white dark:bg-[#1B1536] border border-slate-200 dark:border-[#31275E] rounded-3xl overflow-hidden shadow-sm ${className}`}>
      {/* Header */}
      <div className="px-4 py-2.5 border-b border-slate-100 dark:border-[#31275E] flex items-center justify-between bg-slate-50/50 dark:bg-[#241D48]/50">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
            <Trophy size={16} className="fill-amber-500/20" />
          </div>
          <div>
            <h3 className="text-[13px] font-black text-slate-900 dark:text-white uppercase tracking-wider">Weekly Leaderboard</h3>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
              <Calendar size={10} />
              <span>Week: {currentWeekId}</span>
            </p>
          </div>
        </div>
        <div className="bg-[#7045D8]/10 text-[#7045D8] dark:text-[#A78BFA] px-2.5 py-0.5 rounded-lg text-[11px] font-black uppercase tracking-wider border border-[#7045D8]/20">
          Rankings
        </div>
      </div>

      {/* User's Current Standing (If ranked) */}
      {userRank && (
        <div className="mx-3 mt-3 p-3 rounded-2xl bg-gradient-to-r from-[#7045D8] to-[#5B32BF] text-white shadow-lg shadow-[#7045D8]/20 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-white/20 backdrop-blur-md flex flex-col items-center justify-center border border-white/30">
              <span className="text-[11px] font-black uppercase leading-none mb-0.5">Rank</span>
              <span className="text-xs font-black font-mono leading-none">#{userRank}</span>
            </div>
            <div>
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="text-xs font-black truncate max-w-[120px]">{userProfile?.name || "You"}</span>
                <span className="px-1.5 py-0.5 rounded bg-amber-400 text-slate-900 text-[11px] font-black uppercase shrink-0">Champion</span>
              </div>
              <p className="text-[11px] text-purple-100 font-bold mt-0.5">Keep pushing to reach #1!</p>
            </div>
          </div>
          <div className="text-right font-mono">
            <span className="text-xs font-black block">{entries[userRankIndex].totalPoints} pts</span>
            <span className="text-[11px] font-bold text-emerald-300 block">{entries[userRankIndex].averageAccuracy}% Acc</span>
          </div>
        </div>
      )}

      {/* Main List */}
      <div className="p-3 space-y-1.5">
        {loading ? (
          <ContentLoader
            message="Updating Rankings..."
            submessage="Statewide Competitive Ranking Sync in Progress"
            minHeight="min-h-[160px]"
            size="sm"
          />
        ) : entries.length === 0 ? (
          <div className="py-8 text-center space-y-2 bg-slate-50 dark:bg-[#241D48]/40 rounded-2xl border border-dashed border-slate-200 dark:border-[#31275E]">
            <Users className="w-6 h-6 text-slate-300 mx-auto" />
            <p className="text-xs font-bold text-slate-400">No attempts this week yet.</p>
            <p className="text-[11px] text-slate-500 font-medium">Start practicing to secure the top rank!</p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {entries.map((entry, idx) => {
              const rank = idx + 1;
              const isUser = entry.userId === currentUserId;

              return (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  key={entry.userId}
                  className={`p-2.5 rounded-2xl border flex items-center justify-between gap-2.5 transition-all ${
                    isUser
                      ? "bg-[#7045D8]/10 dark:bg-[#7045D8]/20 border-[#7045D8] shadow-sm ring-1 ring-[#7045D8]/20"
                      : "bg-white dark:bg-[#241D48] border-slate-100 dark:border-[#31275E]"
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <div className="w-7 h-7 flex items-center justify-center shrink-0">
                      {rank === 1 ? <span className="text-lg">🥇</span> : 
                       rank === 2 ? <span className="text-lg">🥈</span> : 
                       rank === 3 ? <span className="text-lg">🥉</span> : 
                       <span className="text-[11px] font-black text-slate-400 font-mono">#{rank}</span>}
                    </div>
                    
                    {/* User Avatar */}
                    <div className="w-8 h-8 rounded-full border-2 border-white dark:border-[#31275E] overflow-hidden shrink-0 shadow-sm">
                      <UserAvatar
                        name={entry.userName}
                        photoURL={entry.userPhoto}
                        sizeClassName="w-full h-full"
                      />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1">
                        <span className={`text-xs font-black truncate ${isUser ? "text-[#7045D8] dark:text-[#A78BFA]" : "text-slate-800 dark:text-white"}`}>
                          {entry.userName}
                        </span>
                        {rank <= 3 && <Sparkles size={10} className="text-amber-500 fill-amber-500" />}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[11px] font-bold text-slate-400 dark:text-slate-400 uppercase tracking-wider">
                          {entry.totalAttempted} Qs Attempted
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div className="text-xs font-black text-slate-900 dark:text-white font-mono">
                      {entry.totalPoints} <span className="text-[11px] font-bold text-slate-400">PTS</span>
                    </div>
                    <div className={`text-[11px] font-bold font-mono ${
                      entry.averageAccuracy >= 80 ? "text-emerald-500" : 
                      entry.averageAccuracy >= 60 ? "text-[#7045D8] dark:text-[#A78BFA]" : 
                      "text-amber-500"
                    }`}>
                      {entry.averageAccuracy}% <span className="text-[11px] uppercase">Acc</span>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer Info */}
      <div className="px-4 py-2.5 bg-slate-50 dark:bg-[#241D48]/40 border-t border-slate-100 dark:border-[#31275E] flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-[11px] font-black text-slate-400 uppercase tracking-widest">
          <Zap size={11} className="text-amber-500 fill-amber-500" />
          <span>Practice daily to earn points</span>
        </div>
        <button 
          type="button"
          onClick={() => window.location.reload()}
          className="text-[#7045D8] dark:text-[#A78BFA] text-[11px] font-black uppercase tracking-widest hover:underline flex items-center gap-1 cursor-pointer"
        >
          <RefreshCw size={11} />
          Refresh
        </button>
      </div>
    </div>
  );
};

export default WeeklyLeaderboard;
