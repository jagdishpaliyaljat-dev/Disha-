import { SITE_CONFIG } from "../config/siteConfig";
import { doc, increment } from "firebase/firestore";
import { db } from "../lib/firebase";

declare global {
  interface Window {
    dataLayer: any[];
    gtag?: (...args: any[]) => void;
  }
}

const CONSENT_STORAGE_KEY = "quizpro_analytics_consent";
const VISITOR_ID_KEY = "quizpro_visitor_id";
const SESSION_TRACKED_PAGES_KEY = "quizpro_session_pages";

export type ConsentStatus = "granted" | "denied" | null;

/**
 * Retrieves the current analytics consent status.
 */
export function getAnalyticsConsent(): ConsentStatus {
  try {
    if (typeof window === "undefined" || !window.localStorage) return "granted";
    const val = localStorage.getItem(CONSENT_STORAGE_KEY);
    if (val === "granted" || val === "denied") return val;
    return "granted";
  } catch {
    return "granted";
  }
}

/**
 * Saves analytics consent preference.
 */
export function setAnalyticsConsent(status: "granted" | "denied"): void {
  try {
    if (typeof window === "undefined" || !window.localStorage) return;
    localStorage.setItem(CONSENT_STORAGE_KEY, status);
    if (status === "granted") {
      initGA4();
    }
  } catch (err) {
    console.warn("Analytics consent save error:", err);
  }
}

/**
 * Retrieves or generates an anonymous, privacy-safe visitor ID.
 * Never includes IP address, email, name, or hardware identifier.
 */
export function getVisitorId(): string {
  try {
    if (typeof window === "undefined" || !window.localStorage) return "anon_guest";
    let id = localStorage.getItem(VISITOR_ID_KEY);
    if (!id) {
      id = `v_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      localStorage.setItem(VISITOR_ID_KEY, id);
    }
    return id;
  } catch {
    return "anon_guest";
  }
}

let isGA4Injected = false;

/**
 * Asynchronously loads and initializes Google Analytics 4 (gtag.js)
 * using the measurement ID from SITE_CONFIG.gaMeasurementId.
 */
export function initGA4(): void {
  if (typeof window === "undefined" || isGA4Injected) return;
  
  const measurementId = SITE_CONFIG.gaMeasurementId;
  if (!measurementId) return;

  try {
    // Inject script tag asynchronously
    const script = document.createElement("script");
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
    document.head.appendChild(script);

    window.dataLayer = window.dataLayer || [];
    window.gtag = function () {
      window.dataLayer.push(arguments);
    };

    window.gtag("js", new Date());
    window.gtag("config", measurementId, {
      send_page_view: false, // We manually send page_view on SPA route change
      anonymize_ip: true,
    });

    isGA4Injected = true;
  } catch (err) {
    console.warn("Failed to initialize GA4:", err);
  }
}

/**
 * Parse traffic source from UTM query parameters or document referrer.
 */
export function getTrafficSource(): string {
  if (typeof window === "undefined") return "direct";
  try {
    const params = new URLSearchParams(window.location.search);
    const utmSource = params.get("utm_source")?.toLowerCase();

    if (utmSource) {
      if (utmSource.includes("telegram") || utmSource === "tg") return "telegram";
      if (utmSource.includes("whatsapp") || utmSource === "wa") return "whatsapp";
      if (utmSource.includes("google")) return "google";
      if (utmSource.includes("youtube")) return "youtube";
      return utmSource;
    }

    const ref = document.referrer?.toLowerCase() || "";
    if (ref.includes("t.me") || ref.includes("telegram")) return "telegram";
    if (ref.includes("whatsapp") || ref.includes("api.whatsapp")) return "whatsapp";
    if (ref.includes("google.com") || ref.includes("google.co.in")) return "google";
    if (ref.includes("youtube.com")) return "youtube";
    if (ref && !ref.includes(window.location.hostname)) return "other";

    return "direct";
  } catch {
    return "direct";
  }
}

/**
 * Detect device category (mobile vs desktop).
 */
export function getDeviceCategory(): "mobile" | "desktop" {
  if (typeof window === "undefined") return "desktop";
  try {
    const ua = navigator.userAgent || "";
    const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
    const isSmallScreen = window.innerWidth <= 768;
    return isMobileUA || isSmallScreen ? "mobile" : "desktop";
  } catch {
    return "desktop";
  }
}

/**
 * Track page view on route change for SPA.
 * Excludes /admin/* paths and admin users.
 */
export async function trackPageView(
  pagePath: string,
  pageTitle: string,
  options?: { isUserAdmin?: boolean; isLoggedIn?: boolean }
): Promise<void> {
  // Check consent
  if (getAnalyticsConsent() !== "granted") return;

  // Exclude admin users and admin routes
  if (options?.isUserAdmin || pagePath.startsWith("/admin")) {
    return;
  }

  try {
    // 1. Fire GA4 page_view event
    if (typeof window !== "undefined" && window.gtag) {
      window.gtag("event", "page_view", {
        page_path: pagePath,
        page_title: pageTitle,
        page_location: window.location.href,
      });
    }

    // 2. Log throttled aggregated counter in Firestore
    await logVisitorAnalyticsToFirestore(pagePath, options?.isLoggedIn || false);
  } catch (err) {
    console.warn("Analytics trackPageView failed gracefully:", err);
  }
}

/**
 * Logs lightweight, privacy-safe counters in Firestore for the Admin Visitors Dashboard.
 * Throttles writes using setDoc with increment() and local session tracking.
 */
async function logVisitorAnalyticsToFirestore(pagePath: string, isLoggedIn: boolean): Promise<void> {
  try {
    const dateStr = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
    const docRef = doc(db, "analytics_daily", dateStr);

    const source = getTrafficSource();
    const device = getDeviceCategory();
    const visitorId = getVisitorId();

    // Sanitize path for Firestore key (e.g. replace slashes for topPages map key)
    const sanitizedPathKey = pagePath.replace(/\//g, "_") || "_home";

    // Track if this page has already been logged in current window session
    const sessionKey = `${dateStr}_${pagePath}_${visitorId}`;
    const alreadyTrackedInSession = typeof window !== "undefined" && window.sessionStorage?.getItem(sessionKey);

    if (!alreadyTrackedInSession) {
      const payload: Record<string, any> = {
        date: dateStr,
        totalVisits: increment(1),
        updatedAt: new Date().toISOString(),
        uniqueVisitors: increment(1),
      };

      if (isLoggedIn) {
        payload.loggedInCount = increment(1);
      } else {
        payload.guestCount = increment(1);
      }

      if (device === "mobile") {
        payload["deviceSplit.mobile"] = increment(1);
      } else {
        payload["deviceSplit.desktop"] = increment(1);
      }

      payload[`trafficSources.${source}`] = increment(1);
      payload[`topPages.${sanitizedPathKey}`] = increment(1);

      if (typeof window !== "undefined" && window.sessionStorage) {
        window.sessionStorage.setItem(sessionKey, "1");
      }
      
      // Write to Firestore using merge - ONLY if first time in session
      const { guardedSetDoc } = await import("./quotaTracker");
      await guardedSetDoc(docRef, payload, { merge: true }, "Background", "Log Visitor Analytics");
    }
  } catch (err) {
    // Silent fail - analytics must never break app execution
    console.warn("Firestore visitor log write error:", err);
  }
}

/**
 * Generic custom event dispatcher.
 */
export function trackCustomEvent(
  eventName: string,
  eventParams?: Record<string, any>,
  isUserAdmin?: boolean
): void {
  if (getAnalyticsConsent() !== "granted" || isUserAdmin) return;

  try {
    if (typeof window !== "undefined" && window.gtag) {
      window.gtag("event", eventName, eventParams || {});
    }
  } catch (err) {
    console.warn(`Custom event ${eventName} error:`, err);
  }
}

// ──────────────────────────────────────────
// CUSTOM EVENT LOGGERS
// ──────────────────────────────────────────

export function trackArticleView(articleSlug: string, language: string = "en", isUserAdmin?: boolean): void {
  trackCustomEvent("article_view", { article_slug: articleSlug, language }, isUserAdmin);
}

export function trackTopicView(topicSlug: string, isUserAdmin?: boolean): void {
  trackCustomEvent("topic_view", { topic_slug: topicSlug }, isUserAdmin);
}

export function trackQuizStart(topicId: string, topicTitle?: string, questionCount?: number, isUserAdmin?: boolean): void {
  trackCustomEvent("quiz_start", { topic_id: topicId, topic_title: topicTitle || topicId, question_count: questionCount || 0 }, isUserAdmin);
}

export function trackQuizComplete(
  topicId: string,
  topicTitle: string,
  score: number,
  totalQuestions: number,
  accuracy: number,
  isUserAdmin?: boolean
): void {
  trackCustomEvent("quiz_complete", {
    topic_id: topicId,
    topic_title: topicTitle,
    score,
    total_questions: totalQuestions,
    accuracy_percent: Math.round(accuracy),
  }, isUserAdmin);
}

export function trackLogin(method: string = "google", isUserAdmin?: boolean): void {
  trackCustomEvent("login", { method }, isUserAdmin);
}

export function trackSignup(method: string = "google", isUserAdmin?: boolean): void {
  trackCustomEvent("signup", { method }, isUserAdmin);
}

export function trackSearch(searchTerm: string, isUserAdmin?: boolean): void {
  if (!searchTerm.trim()) return;
  trackCustomEvent("search", { search_term: searchTerm.trim() }, isUserAdmin);
}

export function trackShareClick(articleSlug: string, platform: string, isUserAdmin?: boolean): void {
  trackCustomEvent("share_click", { article_slug: articleSlug, platform }, isUserAdmin);
}

export function trackAppCtaClick(source: string, isUserAdmin?: boolean): void {
  trackCustomEvent("app_cta_click", { source }, isUserAdmin);
}
