import { describe, it, expect, beforeEach } from 'vitest';
import { appConfigService, DEFAULT_APP_CONFIG } from '../src/utils/appConfigService';
import { LeaderboardManagerService } from '../src/utils/leaderboardManagerService';

describe('AppConfigService & Maintenance Mode', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('correctly reports maintenance active when enabled for regular users', () => {
    appConfigService.updateConfig({
      maintenance: {
        ...DEFAULT_APP_CONFIG.maintenance,
        enabled: true,
        allowedEmails: ['admin@disha.app'],
        allowAdminBypass: true,
      },
    });

    // Regular student is blocked
    expect(appConfigService.isMaintenanceActive('student@example.com')).toBe(true);

    // Whitelisted admin bypasses maintenance
    expect(appConfigService.isMaintenanceActive('admin@disha.app')).toBe(false);
  });

  it('allows access when maintenance is disabled', () => {
    appConfigService.updateConfig({
      maintenance: {
        ...DEFAULT_APP_CONFIG.maintenance,
        enabled: false,
      },
    });

    expect(appConfigService.isMaintenanceActive('student@example.com')).toBe(false);
  });
});

describe('LeaderboardManagerService', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('generates consistent Monday start-of-week IDs', () => {
    const mondayId = LeaderboardManagerService.getStartOfWeekId(new Date('2026-11-24T12:00:00Z'));
    expect(mondayId).toBe('2026-11-23');
  });

  it('seeds benchmark cohort and accurately computes stats', () => {
    const seeded = LeaderboardManagerService.seedDummyLeaderboard('2026-11-23');
    expect(seeded.length).toBeGreaterThan(0);

    const stats = LeaderboardManagerService.computeStats(seeded);
    expect(stats.totalParticipants).toBe(seeded.length);
    expect(stats.highestPoints).toBeGreaterThan(0);
    expect(stats.averagePoints).toBeGreaterThan(0);
  });

  it('moderates cheaters by banning and unbanning users', () => {
    LeaderboardManagerService.setBannedUser('cheater-123', true);
    let banned = LeaderboardManagerService.getBannedUserIds();
    expect(banned.has('cheater-123')).toBe(true);

    LeaderboardManagerService.setBannedUser('cheater-123', false);
    banned = LeaderboardManagerService.getBannedUserIds();
    expect(banned.has('cheater-123')).toBe(false);
  });
});
