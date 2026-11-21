import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  reportCrashToSupabase,
  fetchCrashLogsFromSupabase,
  updateCrashLogStatus,
  deleteCrashLog,
  clearResolvedCrashLogs,
  flushOfflineCrashes,
} from '../src/services/crashReportingService';

describe('crashReportingService', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('safely handles reportCrashToSupabase with an Error object', async () => {
    const error = new Error('Test crash in component');
    const result = await reportCrashToSupabase({
      error,
      category: 'REACT_ERROR',
      severity: 'HIGH',
      componentName: 'MockComponent',
      metadata: { action: 'render' },
    });
    // In node/test environment without offline, it generates and returns an ID or null
    expect(result === null || typeof result === 'string').toBe(true);
  });

  it('throttles duplicate error bursts within deduplication window', async () => {
    const error = new Error('Burst Error 101');
    const first = await reportCrashToSupabase({
      error,
      componentName: 'BurstComponent',
    });

    const second = await reportCrashToSupabase({
      error,
      componentName: 'BurstComponent',
    });

    // Second call with same message & component should be throttled
    expect(second).toBeNull();
  });

  it('safely executes fetchCrashLogsFromSupabase without uncaught exceptions', async () => {
    const res = await fetchCrashLogsFromSupabase({ limit: 5 });
    expect(Array.isArray(res.data)).toBe(true);
  });

  it('safely executes updateCrashLogStatus', async () => {
    const ok = await updateCrashLogStatus('fake_crash_1', 'resolved');
    expect(typeof ok).toBe('boolean');
  });

  it('safely executes deleteCrashLog', async () => {
    const ok = await deleteCrashLog('fake_crash_1');
    expect(typeof ok).toBe('boolean');
  });

  it('safely executes clearResolvedCrashLogs', async () => {
    const ok = await clearResolvedCrashLogs();
    expect(typeof ok).toBe('boolean');
  });

  it('safely executes flushOfflineCrashes', async () => {
    await expect(flushOfflineCrashes()).resolves.not.toThrow();
  });
});
