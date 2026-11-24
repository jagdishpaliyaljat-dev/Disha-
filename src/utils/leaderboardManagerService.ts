/**
 * Leaderboard Management Service
 *
 * Provides capabilities for viewing, filtering, recalculating,
 * penalizing/banning cheaters, seeding, and resetting weekly & all-time leaderboards.
 */

import { supabase } from '../lib/supabase';

export interface LeaderboardUserEntry {
  userId: string;
  userName: string;
  userPhoto?: string;
  email?: string;
  weekId: string;
  totalAttempted: number;
  totalCorrect: number;
  averageAccuracy: number;
  totalPoints: number;
  streakDays: number;
  isBanned?: boolean;
  updatedAt: string;
}

export interface LeaderboardStats {
  totalParticipants: number;
  activeThisWeek: number;
  averagePoints: number;
  highestPoints: number;
  bannedUsersCount: number;
}

const BANNED_USERS_KEY = 'disha_leaderboard_banned_users_v1';

export class LeaderboardManagerService {
  public static getStartOfWeekId(date: Date = new Date()): string {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(d.setDate(diff));
    return monday.toISOString().split('T')[0];
  }

  public static getBannedUserIds(): Set<string> {
    if (typeof localStorage === 'undefined') return new Set();
    try {
      const stored = localStorage.getItem(BANNED_USERS_KEY);
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch {
      return new Set();
    }
  }

  public static setBannedUser(userId: string, ban: boolean): void {
    const banned = this.getBannedUserIds();
    if (ban) {
      banned.add(userId);
    } else {
      banned.delete(userId);
    }
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(BANNED_USERS_KEY, JSON.stringify(Array.from(banned)));
    }
  }

  public static getWeeklyLeaderboard(weekId?: string): LeaderboardUserEntry[] {
    const targetWeek = weekId || this.getStartOfWeekId();
    const banned = this.getBannedUserIds();

    let entries: LeaderboardUserEntry[] = [];
    if (typeof localStorage !== 'undefined') {
      const localKey = `disha2020_weekly_lb_${targetWeek}`;
      const raw = localStorage.getItem(localKey);
      if (raw) {
        try {
          entries = JSON.parse(raw);
        } catch {
          entries = [];
        }
      }
    }

    return entries.map((entry) => ({
      ...entry,
      isBanned: banned.has(entry.userId),
    }));
  }

  public static saveWeeklyLeaderboard(entries: LeaderboardUserEntry[], weekId?: string): void {
    const targetWeek = weekId || this.getStartOfWeekId();
    if (typeof localStorage !== 'undefined') {
      const localKey = `disha2020_weekly_lb_${targetWeek}`;
      localStorage.setItem(localKey, JSON.stringify(entries));
    }
  }

  public static computeStats(entries: LeaderboardUserEntry[]): LeaderboardStats {
    const active = entries.filter((e) => !e.isBanned);
    const totalPoints = active.reduce((acc, curr) => acc + (curr.totalPoints || 0), 0);
    const highestPoints = active.length > 0 ? Math.max(...active.map((e) => e.totalPoints || 0)) : 0;
    const avg = active.length > 0 ? Math.round(totalPoints / active.length) : 0;

    return {
      totalParticipants: entries.length,
      activeThisWeek: active.length,
      averagePoints: avg,
      highestPoints,
      bannedUsersCount: entries.filter((e) => e.isBanned).length,
    };
  }

  public static seedDummyLeaderboard(weekId?: string): LeaderboardUserEntry[] {
    const targetWeek = weekId || this.getStartOfWeekId();
    const dummyNames = [
      'Pooja Sharma', 'Rahul Verma', 'Anita Meena', 'Vikram Singh',
      'Sunil Choudhary', 'Kavita Rathore', 'Deepak Yadav', 'Priya Joshi'
    ];

    const seeded: LeaderboardUserEntry[] = dummyNames.map((name, idx) => {
      const attempted = 120 - idx * 10;
      const correct = Math.round(attempted * (0.95 - idx * 0.04));
      const accuracy = Math.round((correct / attempted) * 100);
      const points = correct * 4 + 50;

      return {
        userId: `seed-user-${idx + 1}`,
        userName: name,
        email: `${name.toLowerCase().replace(' ', '.')}@student.exam`,
        weekId: targetWeek,
        totalAttempted: attempted,
        totalCorrect: correct,
        averageAccuracy: accuracy,
        totalPoints: points,
        streakDays: Math.max(1, 15 - idx),
        isBanned: false,
        updatedAt: new Date().toISOString(),
      };
    });

    this.saveWeeklyLeaderboard(seeded, targetWeek);
    return seeded;
  }
}
