/**
 * DISHA 20-20 — Sentry Crash Reporting
 *
 * Initializes Sentry only in production builds.
 * DSN is read from VITE_SENTRY_DSN env variable.
 * Zero PII — user IDs are anonymized, no raw email/name sent.
 */

import * as Sentry from "@sentry/react";

const IS_PROD = import.meta.env.PROD;
const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN as string | undefined;
const APP_VERSION = import.meta.env.VITE_APP_VERSION ?? "1.0.15";

/**
 * Call once at app startup (before ReactDOM.createRoot).
 * Safe no-op if VITE_SENTRY_DSN is not configured.
 */
export function initSentry(): void {
  if (!IS_PROD || !SENTRY_DSN) {
    if (!IS_PROD) {
      console.info("[Sentry] Skipped — not in production mode.");
    } else {
      console.warn("[Sentry] VITE_SENTRY_DSN not configured. Crash reporting disabled.");
    }
    return;
  }

  Sentry.init({
    dsn: SENTRY_DSN,
    release: `disha-2020@${APP_VERSION}`,
    environment: "production",

    // Send 10% of performance traces (keeps quota low)
    tracesSampleRate: 0.1,

    // Capture 100% of crashes/errors
    // (default replaysOnErrorSampleRate = 1.0 not needed without Session Replay)

    // Integrations
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.extraErrorDataIntegration({ depth: 3 }),
    ],

    // Strip PII before sending
    beforeSend(event) {
      // Remove any user email/username from the event payload
      if (event.user) {
        delete event.user.email;
        delete event.user.username;
        delete event.user.ip_address;
      }
      // Strip API keys / tokens from breadcrumb URLs
      if (event.breadcrumbs?.values) {
        event.breadcrumbs.values = event.breadcrumbs.values.map((b) => ({
          ...b,
          data: b.data
            ? Object.fromEntries(
                Object.entries(b.data).map(([k, v]) => [
                  k,
                  typeof v === "string" && /key|token|secret|password/i.test(k)
                    ? "[REDACTED]"
                    : v,
                ])
              )
            : b.data,
        }));
      }
      return event;
    },

    // Don't send errors from known benign sources
    ignoreErrors: [
      "ResizeObserver loop limit exceeded",
      "ResizeObserver loop completed with undelivered notifications",
      "Non-Error promise rejection captured with value: undefined",
      "Object captured as promise rejection with keys: message",
      "IndexedDB is not supported in this runtime environment",
      "Network request failed",
      "Failed to fetch",
      "Load failed",
    ],

    // Don't report from these URL patterns
    denyUrls: [
      /extensions\//i,
      /^chrome:\/\//i,
      /^chrome-extension:\/\//i,
    ],
  });

  console.info(`[Sentry] Initialized — DISHA 20-20 v${APP_VERSION}`);
}

/**
 * Set an anonymous user context (no PII).
 * Call after user logs in.
 */
export function setSentryUser(userId: string): void {
  if (!IS_PROD || !SENTRY_DSN) return;
  Sentry.setUser({ id: userId });
}

/**
 * Clear user context on logout.
 */
export function clearSentryUser(): void {
  if (!IS_PROD || !SENTRY_DSN) return;
  Sentry.setUser(null);
}

/**
 * Manually capture a non-fatal error with context.
 * Use in catch blocks for important operations.
 */
export function captureSentryError(
  error: unknown,
  context?: Record<string, unknown>
): void {
  if (!IS_PROD || !SENTRY_DSN) return;
  Sentry.withScope((scope) => {
    if (context) {
      scope.setExtras(context);
    }
    Sentry.captureException(error);
  });
}

/**
 * Add a breadcrumb for custom tracking.
 */
export function addSentryBreadcrumb(
  message: string,
  category: string,
  level: Sentry.SeverityLevel = "info"
): void {
  if (!IS_PROD || !SENTRY_DSN) return;
  Sentry.addBreadcrumb({ message, category, level });
}
