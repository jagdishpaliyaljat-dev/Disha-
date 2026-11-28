/**
 * Centralized Cashfree / payment-domain configuration.
 *
 * WHY THIS EXISTS
 * ---------------
 * Cashfree rejects `https://localhost/ is not enabled or approved` when a
 * localhost (or capacitor://) origin reaches it as a return URL / origin.
 * localhost can never be whitelisted for an approved production merchant, so
 * every URL we hand to Cashfree must be a real, public HTTPS origin.
 *
 * All such URLs are resolved here from configuration instead of being
 * hardcoded in the payment service or Edge Functions.
 *
 * SUPPORTED ENV VARS (in priority order)
 * --------------------------------------
 *   VITE_APP_URL            (recommended for this Vite app)
 *   NEXT_PUBLIC_APP_URL     (also exposed via vite.config.ts envPrefix)
 *   APP_URL / SITE_URL      (Node / SSR / Edge Function side)
 *
 *   VITE_CASHFREE_ENV / CASHFREE_ENV  -> PRODUCTION | SANDBOX (default PRODUCTION)
 *
 * If none are set we fall back to the known live domain. Local development
 * must use a public HTTPS tunnel URL via VITE_APP_URL — never localhost.
 */

const metaEnv: Record<string, string | undefined> =
  (typeof import.meta !== "undefined" && (import.meta as any).env) || {};

const nodeEnv: Record<string, string | undefined> =
  typeof process !== "undefined" && process.env ? (process.env as Record<string, string | undefined>) : {};

/** The live public app origin. Registered/whitelisted with Cashfree. */
export const DEFAULT_PUBLIC_APP_URL = "https://disha-2020.vercel.app";

function pick(...values: Array<string | undefined>): string {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function isLocalHostname(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return (
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "::1" ||
    host.endsWith(".localhost") ||
    host.startsWith("127.")
  );
}

/** Normalize any configured value to a public HTTPS origin, or "" if unusable. */
export function normalizePublicHttpsOrigin(raw: string | undefined | null): string {
  if (!raw || !raw.trim()) return "";
  try {
    const withScheme = raw.includes("://") ? raw.trim() : `https://${raw.trim()}`;
    const url = new URL(withScheme);
    if (url.protocol !== "https:") return "";
    // Never hand localhost / loopback to Cashfree — it cannot be whitelisted.
    if (isLocalHostname(url.hostname)) return "";
    return url.origin;
  } catch {
    return "";
  }
}

/** Public HTTPS origin used for Cashfree return URLs and the checkout bridge. */
export function getAppOrigin(): string {
  const configured = pick(
    metaEnv.VITE_APP_URL,
    metaEnv.NEXT_PUBLIC_APP_URL,
    metaEnv.VITE_NEXT_PUBLIC_APP_URL,
    nodeEnv.NEXT_PUBLIC_APP_URL,
    nodeEnv.APP_URL,
    nodeEnv.SITE_URL
  );
  return normalizePublicHttpsOrigin(configured) || DEFAULT_PUBLIC_APP_URL;
}

/** Cashfree environment: PRODUCTION (default) or SANDBOX/TEST. */
export function getConfiguredCashfreeEnv(): string {
  return (pick(metaEnv.VITE_CASHFREE_ENV, metaEnv.CASHFREE_ENV, nodeEnv.CASHFREE_ENV) || "PRODUCTION").toUpperCase();
}

/**
 * Map either a configured env name or the env returned by the order-creation
 * Edge Function to the SDK mode Cashfree expects.
 */
export function getCashfreeMode(environmentFromServer?: string | null): "production" | "sandbox" {
  const value = (environmentFromServer || getConfiguredCashfreeEnv()).toUpperCase();
  return value === "SANDBOX" || value === "TEST" || value === "DEV" ? "sandbox" : "production";
}

/** Return URL sent to Cashfree. Uses the literal {order_id} placeholder;
 *  the Edge Function replaces it with the authoritative order id. */
export function buildCashfreeReturnUrl(): string {
  return `${getAppOrigin()}/?order_id={order_id}`;
}

/** Public bridge page used to launch hosted checkout from the native app. */
export function getCheckoutBridgeUrl(
  paymentSessionId: string,
  orderId: string,
  mode: "production" | "sandbox"
): string {
  const url = new URL("/checkout.html", getAppOrigin());
  url.searchParams.set("session_id", paymentSessionId);
  url.searchParams.set("order_id", orderId);
  url.searchParams.set("mode", mode);
  return url.toString();
}

/**
 * Public bridge page for UPI AutoPay mandates. `subscriptionsCheckout` needs
 * the subscription session id (not a payment session id), and the subscription
 * id is required for the post-return verification fallback.
 */
export function getSubscriptionCheckoutBridgeUrl(
  subscriptionSessionId: string,
  subscriptionId: string,
  orderId: string,
  mode: "production" | "sandbox"
): string {
  const url = new URL("/checkout.html", getAppOrigin());
  url.searchParams.set("subs_session_id", subscriptionSessionId);
  url.searchParams.set("subscription_id", subscriptionId);
  url.searchParams.set("order_id", orderId);
  url.searchParams.set("autopay", "1");
  url.searchParams.set("mode", mode);
  return url.toString();
}
