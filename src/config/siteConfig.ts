/**
 * Centralized site configuration for DISHA 20-20.
 * Single source of truth for site domain, metadata, and search console verification.
 */

export const SITE_CONFIG = {
  domain: "https://disha2020.in",
  siteName: "DISHA 20-20",
  hindiName: "DISHA 20-20",
  tagline: "Right Direction, Accurate Preparation",
  englishTagline: "Right Direction. Precision Prep.",
  googleSiteVerification: process.env.VITE_GOOGLE_SITE_VERIFICATION || "",
  gaMeasurementId: process.env.VITE_GA_MEASUREMENT_ID || "G-9B8SS6TRQK",
  telegramChannelUrl: process.env.VITE_TELEGRAM_CHANNEL_URL || "https://t.me/disha2020_official",
};

/**
 * Resolves the absolute site domain URL.
 */
export function getSiteDomain(_req?: { protocol?: string; get?: (header: string) => string | undefined }): string {
  if (typeof window !== "undefined" && window.location && (window.location.hostname.includes("localhost") || window.location.hostname.includes("127.0.0.1"))) {
    return window.location.origin;
  }
  return "https://disha2020.in";
}
