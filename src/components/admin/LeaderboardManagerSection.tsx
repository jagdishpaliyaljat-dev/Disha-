import React, { useState, useEffect } from 'react';
import {
  Trophy,
  Award,
  Users,
  Search,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Download,
  Trash2,
  Calendar,
  Zap,
  TrendingUp,
} from 'lucide-react';
import {
  LeaderboardManagerService,
  LeaderboardUserEntry,
  LeaderboardStats,
} from '../../utils/leaderboardManagerService';
import { triggerAdminToast } from '../../utils/adminToast';

export const LeaderboardManagerSection: React.FC = () => {
  const currentWeek = LeaderboardManagerService.getStartOfWeekId();
  const [selectedWeek, setSelectedWeek] = useState(currentWeek);
  const [entries, setEntries] = useState<LeaderboardUserEntry[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [stats, setStats] = useState<LeaderboardStats>({
    totalParticipants: 0,
    activeThisWeek: 0,
    averagePoints: 0,
    highestPoints: 0,
    bannedUsersCount: 0,
  });

  const loadData = () => {
    const list = LeaderboardManagerService.getWeeklyLeaderboard(selectedWeek);
    setEntries(list);
    setStats(LeaderboardManagerService.computeStats(list));
  };

  useEffect(() => {
    loadData();
  }, [selectedWeek]);

  const handleToggleBan = (userId: string, currentlyBanned: boolean) => {
    LeaderboardManagerService.setBannedUser(userId, !currentlyBanned);
    triggerAdminToast(
      !currentlyBanned ? 'User banned from rankings' : 'User unbanned',
      'success'
    );
    loadData();
  };

  const handleResetLeaderboard = () => {
    if (confirm(`Are you sure you want to reset leaderboard for week ${selectedWeek}?`)) {
      LeaderboardManagerService.saveWeeklyLeaderboard([], selectedWeek);
      triggerAdminToast('Weekly leaderboard cleared', 'success');
      loadData();
    }
  };

  const handleSeedData = () => {
    LeaderboardManagerService.seedDummyLeaderboard(selectedWeek);
    triggerAdminToast('Benchmark leaderboard participants generated', 'success');
    loadData();
  };

  const filteredEntries = entries.filter(
    (e) =>
      e.userName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (e.email && e.email.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      {/* Top Banner & Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-2xl flex flex-col">
          <span className="text-xs text-slate-400 flex items-center gap-1.5 mb-1">
            <Users className="w-3.5 h-3.5 text-blue-400" /> Total Students
          </span>
          <span className="text-xl font-bold text-white">{stats.totalParticipants}</span>
          <span className="text-[11px] text-slate-500 mt-0.5">{stats.activeThisWeek} active</span>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-2xl flex flex-col">
          <span className="text-xs text-slate-400 flex items-center gap-1.5 mb-1">
            <Trophy className="w-3.5 h-3.5 text-amber-400" /> Top Score
          </span>
          <span className="text-xl font-bold text-amber-300">{stats.highestPoints} pts</span>
          <span className="text-[11px] text-slate-500 mt-0.5">Rank #1 leader</span>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-2xl flex flex-col">
          <span className="text-xs text-slate-400 flex items-center gap-1.5 mb-1">
            <TrendingUp className="w-3.5 h-3.5 text-emerald-400" /> Avg Score
          </span>
          <span className="text-xl font-bold text-emerald-300">{stats.averagePoints} pts</span>
          <span className="text-[11px] text-slate-500 mt-0.5">Cohort average</span>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-2xl flex flex-col">
          <span className="text-xs text-slate-400 flex items-center gap-1.5 mb-1">
            <ShieldAlert className="w-3.5 h-3.5 text-rose-400" /> Banned / Cheaters
          </span>
          <span className="text-xl font-bold text-rose-300">{stats.bannedUsersCount}</span>
          <span className="text-[11px] text-slate-500 mt-0.5">Excluded from rank</span>
        </div>
      </div>

      {/* Control Bar */}
      <div className="bg-slate-900/70 border border-slate-800 p-4 rounded-2xl flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        <div className="flex items-center gap-2 flex-1">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              placeholder="Search student name or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
            />
          </div>

          <div className="flex items-center gap-1.5 px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-300">
            <Calendar className="w-3.5 h-3.5 text-amber-400" />
            <span className="font-mono text-[11px]">Week: {selectedWeek}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {entries.length === 0 && (
            <button
              onClick={handleSeedData}
              className="px-3 py-2 text-xs font-semibold rounded-xl bg-[#7045D8]/20 text-blue-400 border border-blue-500/30 hover:bg-[#7045D8]/30 flex items-center gap-1.5 transition"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Seed Benchmark Cohort</span>
            </button>
          )}

          <button
            onClick={handleResetLeaderboard}
            className="px-3 py-2 text-xs font-semibold rounded-xl bg-rose-600/20 text-rose-400 border border-rose-500/30 hover:bg-rose-600/30 flex items-center gap-1.5 transition"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Reset Week</span>
          </button>
        </div>
      </div>

      {/* Table of Ranks */}
      <div className="bg-slate-900/50 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950/80 border-b border-slate-800 uppercase text-[10px] text-slate-400 tracking-wider">
              <tr>
                <th className="px-4 py-3">Rank</th>
                <th className="px-4 py-3">Student</th>
                <th className="px-4 py-3">Accuracy</th>
                <th className="px-4 py-3">Attempts / Correct</th>
                <th className="px-4 py-3">Total Points</th>
                <th className="px-4 py-3 text-right">Moderation Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredEntries.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-slate-500">
                    No leaderboard entries found for this week.
                  </td>
                </tr>
              ) : (
                filteredEntries.map((user, idx) => (
                  <tr
                    key={user.userId}
                    className={`hover:bg-slate-800/40 transition ${
                      user.isBanned ? 'opacity-40 bg-rose-950/10' : ''
                    }`}
                  >
                    <td className="px-4 py-3.5 font-bold font-mono">
                      {user.isBanned ? (
                        <span className="text-rose-400 text-[10px]">BANNED</span>
                      ) : idx === 0 ? (
                        '🥇 #1'
                      ) : idx === 1 ? (
                        '🥈 #2'
                      ) : idx === 2 ? (
                        '🥉 #3'
                      ) : (
                        `#${idx + 1}`
                      )}
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="font-semibold text-white">{user.userName}</div>
                      <div className="text-[10px] text-slate-500">{user.email || user.userId}</div>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 font-semibold text-[11px]">
                        {user.averageAccuracy}%
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-slate-400">
                      {user.totalAttempted} Qs ({user.totalCorrect} correct)
                    </td>
                    <td className="px-4 py-3.5 font-bold text-amber-400">
                      {user.totalPoints} pts
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <button
                        onClick={() => handleToggleBan(user.userId, Boolean(user.isBanned))}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition ${
                          user.isBanned
                            ? 'bg-emerald-600/20 text-emerald-400 border-emerald-500/30 hover:bg-emerald-600/30'
                            : 'bg-rose-600/20 text-rose-400 border-rose-500/30 hover:bg-rose-600/30'
                        }`}
                      >
                        {user.isBanned ? 'Unban Student' : 'Ban from Leaderboard'}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
