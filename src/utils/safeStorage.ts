/**
 * Safe LocalStorage Wrapper with Automatic Quota Reclaim and Fallbacks
 * Prevents QuotaExceededError crashes when caching large datasets.
 */

const TRANSIENT_KEY_PREFIXES = [
  "quizpro_bulk_mcqs",
  "quizpro_mcqs_",
  "quizpro_mcq_",
  "quizpro_last_safety_backup",
  "quizpro_pyq_attempt_",
  "quizpro_attempt_",
];

/**
 * Attempts to clear temporary / disposable cached items from localStorage
 * to free up space for critical application records.
 */
export function pruneTransientLocalStorage(): number {
  if (typeof window === "undefined" || !window.localStorage) return 0;
  let freedCount = 0;
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && TRANSIENT_KEY_PREFIXES.some((prefix) => key.startsWith(prefix))) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((k) => {
      try {
        localStorage.removeItem(k);
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
 * Never throws an unhandled QuotaExceededError.
 */
export function safeSetLocalStorageItem(
  key: string,
  value: string,
  getLightweightFallback?: () => string
): boolean {
  if (typeof window === "undefined" || !window.localStorage) return false;

  try {
    localStorage.setItem(key, value);
    return true;
  } catch (err: any) {
    const isQuota =
      err?.name === "QuotaExceededError" ||
      err?.code === 22 ||
      err?.code === 1014 ||
      err?.number === -2147024882 ||
      (typeof err?.message === "string" && err.message.toLowerCase().includes("quota"));

    if (!isQuota) {
      console.warn(`[SafeStorage] Failed to write key "${key}":`, err?.message || err);
      return false;
    }

    // Attempt 1: Prune transient items and retry writing original value
    try {
      pruneTransientLocalStorage();
      localStorage.setItem(key, value);
      return true;
    } catch (_) {}

    // Attempt 2: If a lightweight fallback generator was provided, try saving that
    if (getLightweightFallback) {
      try {
        const fallbackValue = getLightweightFallback();
        localStorage.setItem(key, fallbackValue);
        console.info(`[SafeStorage] Saved lightweight fallback for "${key}" under storage constraints.`);
        return true;
      } catch (_) {}
    }

    // Gracefully handle storage exhaustion without throwing uncaught errors
    console.warn(`[SafeStorage] LocalStorage quota reached. Operating seamlessly with memory cache for "${key}".`);
    return false;
  }
}
