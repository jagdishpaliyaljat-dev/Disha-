/**
 * DISHA 20-20 — In-House Crash & Error Reporting Service
 *
 * Captures runtime crashes, React errors, unhandled rejections, and network faults.
 * Stores them directly in Supabase table `app_crash_logs`.
 *
 * Features:
 * 1. Zero-PII scrubbing (no passwords, tokens, or emails transmitted)
 * 2. In-memory deduplication (throttles duplicate crashes within 60s)
 * 3. Offline resilience (queues locally when offline and flushes upon reconnection)
 * 4. Device & platform fingerprinting (Capacitor Android, PWA, Browser)
 */

import { supabase } from '../lib/supabase';
import { safeGetLocalStorageItem, safeSetLocalStorageItem } from '../utils/safeStorage';

export type CrashCategory =
  | 'REACT_ERROR'
  | 'RUNTIME_ERROR'
  | 'UNHANDLED_PROMISE'
  | 'NETWORK_FAILURE'
  | 'DATABASE_ERROR'
  | 'AUTH_ERROR'
  | 'CUSTOM';

export type CrashSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export interface CrashReportPayload {
  error: unknown;
  category?: CrashCategory;
  severity?: CrashSeverity;
  componentName?: string;
  metadata?: Record<string, unknown>;
  userId?: string | null;
}

export interface StoredCrashLog {
  id: string;
  created_at: string;
  error_name: string;
  error_message: string;
  stack_trace?: string | null;
  component_name?: string | null;
  category: CrashCategory;
  severity: CrashSeverity;
  user_id?: string | null;
  app_version: string;
  platform: string;
  user_agent?: string | null;
  device_info?: {
    screenWidth?: number;
    screenHeight?: number;
    isOnline?: boolean;
    url?: string;
    language?: string;
  } | null;
  metadata?: Record<string, unknown> | null;
  status: 'open' | 'investigating' | 'resolved' | 'ignored';
}

const OFFLINE_QUEUE_KEY = 'disha_offline_crash_queue';
const APP_VERSION = '1.0.16';
const DEDUPE_WINDOW_MS = 60_000; // 60 seconds
const recentErrorSignatures = new Map<string, number>();

/**
 * Sanitizes messages to strip sensitive authentication tokens, secrets, or passwords.
 */
function sanitizeText(input: unknown): string {
  if (typeof input !== 'string') {
    return String(input ?? '');
  }
  return input
    .replace(/(?:password|token|secret|api[_-]?key|auth|bearer)\s*[:=]\s*['"]?[^\s'",;]+['"]?/gi, '[REDACTED]')
    .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '[REDACTED_EMAIL]')
    .replace(/bearer\s+[A-Za-z0-9\-_.]+/gi, 'Bearer [REDACTED]')
    .slice(0, 4000);
}

/**
 * Detects client runtime platform.
 */
function getPlatform(): string {
  if (typeof window === 'undefined') return 'server';
  // Capacitor Android detection
  const isCapacitor = Boolean(
    (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.()
  );
  if (isCapacitor) return 'android-native';

  // PWA / Browser detection
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
  if (isStandalone) return 'pwa-installed';

  const ua = navigator.userAgent || '';
  if (/android/i.test(ua)) return 'android-browser';
  if (/iphone|ipad|ipod/i.test(ua)) return 'ios-browser';
  return 'desktop-web';
}

/**
 * Reports a crash to Supabase. Fully asynchronous, non-blocking, and fail-safe.
 */
export async function reportCrashToSupabase(payload: CrashReportPayload): Promise<string | null> {
  try {
    const rawError = payload.error;
    const errorName = rawError instanceof Error ? rawError.name : 'ApplicationError';
    const rawMessage = rawError instanceof Error ? rawError.message : String(rawError ?? 'Unknown error occurred');
    const rawStack = rawError instanceof Error ? rawError.stack : undefined;

    // Deduplication key
    const dedupeKey = `${payload.category || 'RUNTIME_ERROR'}:${payload.componentName || ''}:${rawMessage.slice(0, 100)}`;
    const now = Date.now();
    const lastReported = recentErrorSignatures.get(dedupeKey);
    if (lastReported && now - lastReported < DEDUPE_WINDOW_MS) {
      return null; // Suppress duplicate burst
    }
    recentErrorSignatures.set(dedupeKey, now);

    // Garbage collect dedupe map
    if (recentErrorSignatures.size > 100) {
      for (const [key, timestamp] of recentErrorSignatures.entries()) {
        if (now - timestamp > DEDUPE_WINDOW_MS) {
          recentErrorSignatures.delete(key);
        }
      }
    }

    const crashId = `crash_${now}_${Math.random().toString(36).substring(2, 8)}`;
    const platform = getPlatform();

    const deviceInfo = typeof window !== 'undefined'
      ? {
          screenWidth: window.innerWidth,
          screenHeight: window.innerHeight,
          isOnline: navigator.onLine,
          url: sanitizeText(window.location.pathname + window.location.hash),
          language: navigator.language || 'en',
        }
      : null;

    const crashEntry: StoredCrashLog = {
      id: crashId,
      created_at: new Date().toISOString(),
      error_name: sanitizeText(errorName).slice(0, 200),
      error_message: sanitizeText(rawMessage).slice(0, 1000),
      stack_trace: rawStack ? sanitizeText(rawStack).slice(0, 3000) : null,
      component_name: payload.componentName ? sanitizeText(payload.componentName).slice(0, 150) : null,
      category: payload.category || 'RUNTIME_ERROR',
      severity: payload.severity || 'HIGH',
      user_id: payload.userId || null,
      app_version: APP_VERSION,
      platform,
      user_agent: typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 500) : null,
      device_info: deviceInfo,
      metadata: payload.metadata || null,
      status: 'open',
    };

    // If client is currently offline, queue locally
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      queueOfflineCrash(crashEntry);
      return crashId;
    }

    // Insert directly into Supabase table `app_crash_logs`
    const { error: dbError } = await supabase.from('app_crash_logs').insert([crashEntry]);
    if (dbError) {
      console.warn('[CrashReportingService] Could not send crash log to Supabase:', dbError.message);
      queueOfflineCrash(crashEntry);
      return null;
    }

    return crashId;
  } catch (serviceErr) {
    console.warn('[CrashReportingService] Internal capture exception:', serviceErr);
    return null;
  }
}

/**
 * Saves crash report to local storage queue if Supabase request fails or device is offline.
 */
function queueOfflineCrash(entry: StoredCrashLog): void {
  try {
    const raw = safeGetLocalStorageItem(OFFLINE_QUEUE_KEY);
    const queue: StoredCrashLog[] = raw ? JSON.parse(raw) : [];
    queue.push(entry);
    // Keep max 20 offline crashes
    if (queue.length > 20) {
      queue.shift();
    }
    safeSetLocalStorageItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
  } catch {}
}

/**
 * Flushes pending offline crash logs once device reconnects.
 */
export async function flushOfflineCrashes(): Promise<void> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return;
  try {
    const raw = safeGetLocalStorageItem(OFFLINE_QUEUE_KEY);
    if (!raw) return;
    const queue: StoredCrashLog[] = JSON.parse(raw);
    if (!Array.isArray(queue) || queue.length === 0) return;

    const { error } = await supabase.from('app_crash_logs').insert(queue);
    if (!error) {
      safeSetLocalStorageItem(OFFLINE_QUEUE_KEY, JSON.stringify([]));
    }
  } catch {}
}

// Automatically listen for online reconnect to flush queued crashes
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    flushOfflineCrashes().catch(() => {});
  });
}

/**
 * Admin Panel Query API: Fetch real-time crash reports from Supabase.
 */
export async function fetchCrashLogsFromSupabase(options?: {
  limit?: number;
  severity?: CrashSeverity | 'ALL';
  status?: 'open' | 'investigating' | 'resolved' | 'ignored' | 'ALL';
}): Promise<{ data: StoredCrashLog[]; error: string | null }> {
  try {
    let query = supabase
      .from('app_crash_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(options?.limit || 50);

    if (options?.severity && options.severity !== 'ALL') {
      query = query.eq('severity', options.severity);
    }
    if (options?.status && options.status !== 'ALL') {
      query = query.eq('status', options.status);
    }

    const { data, error } = await query;
    if (error) {
      return { data: [], error: error.message };
    }
    return { data: (data as StoredCrashLog[]) || [], error: null };
  } catch (err: any) {
    return { data: [], error: err?.message || 'Failed to fetch crash logs' };
  }
}

/**
 * Admin Action: Update status of a crash log (e.g., mark as 'resolved').
 */
export async function updateCrashLogStatus(
  crashId: string,
  newStatus: 'open' | 'investigating' | 'resolved' | 'ignored'
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('app_crash_logs')
      .update({ status: newStatus })
      .eq('id', crashId);
    return !error;
  } catch {
    return false;
  }
}

/**
 * Admin Action: Delete a single crash log.
 */
export async function deleteCrashLog(crashId: string): Promise<boolean> {
  try {
    const { error } = await supabase.from('app_crash_logs').delete().eq('id', crashId);
    return !error;
  } catch {
    return false;
  }
}

/**
 * Admin Action: Clear all resolved crash logs.
 */
export async function clearResolvedCrashLogs(): Promise<boolean> {
  try {
    const { error } = await supabase.from('app_crash_logs').delete().eq('status', 'resolved');
    return !error;
  } catch {
    return false;
  }
}
