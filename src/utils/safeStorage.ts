/**
 * Safe LocalStorage Wrapper with Automatic Quota Reclaim and Fallbacks
 * DISHA 20-20 Unified Storage Engine
 * Prevents QuotaExceededError crashes when caching large datasets.
 */

const TRANSIENT_KEY_PREFIXES = [
  "disha2020_bulk_mcqs",
  "disha2020_mcqs_",
  "disha2020_mcq_",
  "disha2020_last_safety_backup",
  "disha2020_pyq_attempt_",
  "disha2020_attempt_",
  // Legacy QuizPro prefixes for backward compatibility pruning
  "quizpro_bulk_mcqs",
  "quizpro_mcqs_",
  "quizpro_mcq_",
  "quizpro_last_safety_backup",
  "quizpro_pyq_attempt_",
  "quizpro_attempt_",
];

// In-memory fallback storage for environments where sessionStorage or localStorage is blocked or restricted (Instagram, Facebook webviews)
const inMemorySessionMap = new Map<string, string>();
const inMemoryLocalMap = new Map<string, string>();

/**
 * Safely reads a value from localStorage with optional backward-compatible fallback key.
 * If the legacy key is found and modern key is missing, automatically migrates value forward.
 */
export function safeGetLocalStorageItem(key: string, legacyKey?: string): string | null {
  if (typeof window === "undefined") {
    return inMemoryLocalMap.get(key) ?? (legacyKey ? inMemoryLocalMap.get(legacyKey) ?? null : null);
  }
  try {
    const ls = window.localStorage;
    if (ls) {
      const val = ls.getItem(key);
      if (val !== null) return val;
      if (legacyKey) {
        const legacyVal = ls.getItem(legacyKey);
        if (legacyVal !== null) {
          try {
            ls.setItem(key, legacyVal);
          } catch (_) {}
          return legacyVal;
        }
      }
    }
  } catch (_) {
    // Restricted or sandboxed environment
  }
  return inMemoryLocalMap.get(key) ?? (legacyKey ? inMemoryLocalMap.get(legacyKey) ?? null : null);
}

/**
 * Attempts to clear temporary / disposable cached items from localStorage
 * to free up space for critical application records.
 */
export function pruneTransientLocalStorage(): number {
  if (typeof window === "undefined") return 0;
  let freedCount = 0;
  try {
    const ls = window.localStorage;
    if (!ls) return 0;
    const keysToRemove: string[] = [];
    for (let i = 0; i < ls.length; i++) {
      const key = ls.key(i);
      if (key && TRANSIENT_KEY_PREFIXES.some((prefix) => key.startsWith(prefix))) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((k) => {
      try {
        ls.removeItem(k);
        freedCount++;
      } catch (_) {}
    });
    if (freedCount > 0) {
      console.info(`[SafeStorage] Pruned ${freedCount} transient cache entries to free localStorage quota.`);
    }
  } catch (e) {
    console.warn("[SafeStorage] Notice during cache pruning:", e);
  }
  return freedCount;
}

/**
 * Safely writes a key-value pair to localStorage.
 * If quota is exceeded, it prunes transient cache entries and retries.
 * If a lightweight fallback is provided (e.g. metadata-only without big arrays), it tries that.
 * Never throws an unhandled QuotaExceededError or SecurityError.
 */
export function safeSetLocalStorageItem(
  key: string,
  value: string,
  getLightweightFallback?: () => string
): boolean {
  inMemoryLocalMap.set(key, value);
  if (typeof window === "undefined") return true;

  try {
    const ls = window.localStorage;
    if (!ls) return true;
    ls.setItem(key, value);
    return true;
  } catch (err: any) {
    const isQuota =
      err?.name === "QuotaExceededError" ||
      err?.code === 22 ||
      err?.code === 1014 ||
      err?.number === -2147024882 ||
      (typeof err?.message === "string" && err.message.toLowerCase().includes("quota"));

    if (!isQuota) {
      // In-app webview blocked storage or security error; safely saved in inMemoryLocalMap
      return true;
    }

    // Attempt 1: Prune transient items and retry writing original value
    try {
      pruneTransientLocalStorage();
      const ls = window.localStorage;
      if (ls) {
        ls.setItem(key, value);
        return true;
      }
    } catch (_) {}

    // Attempt 2: If a lightweight fallback generator was provided, try saving that
    if (getLightweightFallback) {
      try {
        const fallbackValue = getLightweightFallback();
        const ls = window.localStorage;
        if (ls) {
          ls.setItem(key, fallbackValue);
          console.info(`[SafeStorage] Saved lightweight fallback for "${key}" under storage constraints.`);
          return true;
        }
      } catch (_) {}
    }

    return true;
  }
}

/**
 * Safely removes a key from localStorage without throwing.
 */
export function safeRemoveLocalStorageItem(key: string): boolean {
  inMemoryLocalMap.delete(key);
  if (typeof window === "undefined") return true;
  try {
    const ls = window.localStorage;
    if (ls) {
      ls.removeItem(key);
      return true;
    }
  } catch (_) {}
  return true;
}

/**
 * Safely reads a value from sessionStorage.
 * Never throws SecurityError / DOMException in restricted WebViews (Instagram, Facebook, etc.).
 * Falls back to in-memory map if sessionStorage is unavailable or blocked.
 */
export function safeGetSessionStorageItem(key: string): string | null {
  if (typeof window === "undefined") {
    return inMemorySessionMap.get(key) ?? null;
  }
  try {
    if (window.sessionStorage) {
      const val = window.sessionStorage.getItem(key);
      if (val !== null) return val;
    }
  } catch (_) {
    // Restricted or sandboxed environment
  }
  return inMemorySessionMap.get(key) ?? null;
}

/**
 * Safely writes a key-value pair to sessionStorage.
 * Never throws SecurityError / QuotaExceededError in restricted WebViews.
 * Mirrors to in-memory fallback for high resilience.
 */
export function safeSetSessionStorageItem(key: string, value: string): boolean {
  inMemorySessionMap.set(key, value);
  if (typeof window === "undefined") return true;
  try {
    if (window.sessionStorage) {
      window.sessionStorage.setItem(key, value);
      return true;
    }
  } catch (_) {
    // Stored in memory fallback
  }
  return true;
}

/**
 * Safely removes an item from sessionStorage without throwing.
 */
export function safeRemoveSessionStorageItem(key: string): boolean {
  inMemorySessionMap.delete(key);
  if (typeof window === "undefined") return true;
  try {
    if (window.sessionStorage) {
      window.sessionStorage.removeItem(key);
      return true;
    }
  } catch (_) {}
  return true;
}

/**
 * Safely clears all items from sessionStorage and in-memory session map.
 */
export function safeClearSessionStorage(): void {
  inMemorySessionMap.clear();
  if (typeof window === "undefined") return;
  try {
    if (window.sessionStorage) {
      window.sessionStorage.clear();
    }
  } catch (_) {}
}

/**
 * Safely clears all items from localStorage and in-memory local map.
 */
export function safeClearLocalStorage(): void {
  inMemoryLocalMap.clear();
  if (typeof window === "undefined") return;
  try {
    if (window.localStorage) {
      window.localStorage.clear();
    }
  } catch (_) {}
}

