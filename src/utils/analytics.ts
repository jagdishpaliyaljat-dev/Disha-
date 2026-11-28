import { SITE_CONFIG } from "../config/siteConfig";
import { supabase, isSupabaseConfigured } from "../lib/supabase";
import { isNativePlatform } from "./mobileAuthService";

declare global {
  interface Window {
    dataLayer: any[];
    gtag?: (...args: any[]) => void;
  }
}

const CONSENT_STORAGE_KEY = "disha2020_analytics_consent";
const LEGACY_CONSENT_STORAGE_KEY = "quizpro_analytics_consent";
const VISITOR_ID_KEY = "disha2020_visitor_id";
const LEGACY_VISITOR_ID_KEY = "quizpro_visitor_id";
const SESSION_TRACKED_PAGES_KEY = "disha2020_session_pages";
const LEGACY_SESSION_TRACKED_PAGES_KEY = "quizpro_session_pages";
const DAILY_ANALYTICS_STORAGE_KEY = "disha2020_analytics_daily_v1";
const LEGACY_DAILY_ANALYTICS_STORAGE_KEY = "quizpro_analytics_daily_v1";

export type ConsentStatus = "granted" | "denied" | null;

/**
 * Retrieves the current analytics consent status.
 */
export function getAnalyticsConsent(): ConsentStatus {
  try {
    if (typeof window === "undefined" || !window.localStorage) return "granted";
    const val = localStorage.getItem(CONSENT_STORAGE_KEY) || localStorage.getItem(LEGACY_CONSENT_STORAGE_KEY);
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
    let id = localStorage.getItem(VISITOR_ID_KEY) || localStorage.getItem(LEGACY_VISITOR_ID_KEY);
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
 * Detect or retrieve the student's district/region (e.g. Jaipur, Sikar, Kota, Jodhpur).
 * Privacy-safe: zero personal info or IP address stored.
 */
export function getVisitorDistrict(): string {
  if (typeof window === "undefined") return "जयपुर";
  try {
    const saved = localStorage.getItem("disha_user_district") || sessionStorage.getItem("disha_detected_district");
    if (saved && saved.trim()) return saved.trim();
    return "जयपुर";
  } catch {
    return "जयपुर";
  }
}

/**
 * Lightweight, privacy-safe asynchronous detection of Rajasthan district.
 */
export async function detectAndCacheDistrict(): Promise<string> {
  if (typeof window === "undefined") return "जयपुर";
  try {
    const cached = sessionStorage.getItem("disha_detected_district");
    if (cached) return cached;

    const resp = await fetch("https://freeipapi.com/api/json", { signal: AbortSignal.timeout(2500) });
    if (resp.ok) {
      const data = await resp.json();
      const city = String(data?.cityName || "").toLowerCase();
      const region = String(data?.regionName || "").toLowerCase();

      let detected = "जयपुर";
      if (city.includes("sikar")) detected = "सीकर";
      else if (city.includes("kota")) detected = "कोटा";
      else if (city.includes("jodhpur")) detected = "जोधपुर";
      else if (city.includes("bikaner")) detected = "बीकानेर";
      else if (city.includes("ajmer")) detected = "अजमेर";
      else if (city.includes("udaipur")) detected = "उदयपुर";
      else if (city.includes("alwar")) detected = "अलवर";
      else if (city.includes("bhilwara")) detected = "भीलवाड़ा";
      else if (city.includes("nagaur")) detected = "नागौर";
      else if (city.includes("churu")) detected = "चूरू";
      else if (city.includes("jhunjhunu")) detected = "झुंझुनू";
      else if (city.includes("barmer")) detected = "बाड़मेर";
      else if (city.includes("ganganagar")) detected = "श्रीगंगानगर";
      else if (city.includes("hanumangarh")) detected = "हनुमानगढ़";
      else if (city.includes("bharatpur")) detected = "भरतपुर";
      else if (city.includes("pali")) detected = "पाली";
      else if (city.includes("dausa")) detected = "दौसा";
      else if (city.includes("tonk")) detected = "टोंक";
      else if (city.includes("delhi")) detected = "दिल्ली / अन्य राज्य";
      else if (region.includes("rajasthan") || city.includes("jaipur")) detected = "जयपुर";
      else if (data?.countryName === "India") detected = `${data.regionName || "अन्य राज्य"}`;
      else detected = "अन्य राज्य";

      sessionStorage.setItem("disha_detected_district", detected);
      return detected;
    }
  } catch {
    // Fail gracefully
  }
  return "जयपुर";
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
        platform: getAppPlatform(),
        district: getVisitorDistrict(),
        traffic_source: getTrafficSource(),
        device: getDeviceCategory(),
      });
    }

    // 2. Log throttled aggregated counter in Firestore
    await logVisitorAnalyticsToFirestore(pagePath, options?.isLoggedIn || false);
  } catch (err) {
    console.warn("Analytics trackPageView failed gracefully:", err);
  }
}

/**
 * Logs lightweight, privacy-safe counters locally for the Admin Visitors Dashboard.
 */
async function logVisitorAnalyticsToFirestore(pagePath: string, isLoggedIn: boolean): Promise<void> {
  try {
    const dateStr = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
    const visitorId = getVisitorId();
    const sessionKey = `${dateStr}_${pagePath}_${visitorId}`;
    const alreadyTrackedInSession = typeof window !== "undefined" && window.sessionStorage?.getItem(sessionKey);

    if (!alreadyTrackedInSession) {
      if (typeof window !== "undefined" && window.sessionStorage) {
        window.sessionStorage.setItem(sessionKey, "1");
      }

      const source = getTrafficSource();
      const device = getDeviceCategory();
      const uniqueKey = `${dateStr}_unique_vis`;
      const isUnique = typeof window !== "undefined" && !window.localStorage?.getItem(uniqueKey);
      if (isUnique && typeof window !== "undefined" && window.localStorage) {
        try {
          window.localStorage.setItem(uniqueKey, "1");
        } catch {}
      }

      // 1. Record atomic visitor counter in Supabase Cloud
      if (isSupabaseConfigured()) {
        try {
          const district = getVisitorDistrict();
          Promise.resolve(
            supabase.rpc("record_site_visit", {
              p_page: pagePath,
              p_source: source,
              p_device: device,
              p_is_logged_in: isLoggedIn,
              p_is_unique: isUnique,
              p_is_download_click: false,
              p_district: district,
            })
          ).catch(() => {});
        } catch {}
      }

      // 2. Also keep local fallback cache
      try {
        const raw = localStorage.getItem(DAILY_ANALYTICS_STORAGE_KEY) || localStorage.getItem(LEGACY_DAILY_ANALYTICS_STORAGE_KEY) || "{}";
        const all = JSON.parse(raw);
        const day = all[dateStr] || {
          date: dateStr,
          totalVisits: 0,
          uniqueVisitors: 0,
          loggedInCount: 0,
          guestCount: 0,
          deviceSplit: { mobile: 0, desktop: 0 },
          trafficSources: {},
          topPages: {},
        };
        day.totalVisits = (day.totalVisits || 0) + 1;
        if (isUnique) day.uniqueVisitors = (day.uniqueVisitors || 0) + 1;
        if (isLoggedIn) day.loggedInCount = (day.loggedInCount || 0) + 1;
        else day.guestCount = (day.guestCount || 0) + 1;

        day.deviceSplit = day.deviceSplit || { mobile: 0, desktop: 0 };
        day.deviceSplit[device] = (day.deviceSplit[device] || 0) + 1;

        all[dateStr] = day;
        localStorage.setItem(DAILY_ANALYTICS_STORAGE_KEY, JSON.stringify(all));
      } catch {}
    }
  } catch (err) {
    console.warn("Analytics visitor log error:", err);
  }
}

export function getAppPlatform(): "android_app" | "web" {
  return isNativePlatform() ? "android_app" : "web";
}

/**
 * Generic custom event dispatcher with platform and district awareness.
 */
export function trackCustomEvent(
  eventName: string,
  eventParams?: Record<string, any>,
  isUserAdmin?: boolean
): void {
  if (getAnalyticsConsent() !== "granted" || isUserAdmin) return;

  try {
    const platform = getAppPlatform();
    const district = getVisitorDistrict();
    const payload = {
      platform,
      district,
      traffic_source: getTrafficSource(),
      device: getDeviceCategory(),
      ...(eventParams || {}),
    };

    if (typeof window !== "undefined" && window.gtag) {
      window.gtag("event", eventName, payload);
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

export function trackPyqPaperView(paperTitle: string, paperId?: string, isUserAdmin?: boolean): void {
  trackCustomEvent("pyq_paper_view", {
    paper_title: paperTitle,
    paper_id: paperId || paperTitle,
  }, isUserAdmin);
}

export function trackQuizStart(topicId: string, topicTitle?: string, questionCount?: number, isUserAdmin?: boolean): void {
  trackCustomEvent("quiz_start", {
    topic_id: topicId,
    topic_title: topicTitle || topicId,
    question_count: questionCount || 0,
  }, isUserAdmin);
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

export function trackAppDownloadClick(source: string, isUserAdmin?: boolean): void {
  trackCustomEvent("app_download_click", { source }, isUserAdmin);
  trackAppCtaClick(source, isUserAdmin);
}

export function trackAppCtaClick(source: string, isUserAdmin?: boolean): void {
  trackCustomEvent("app_cta_click", { source }, isUserAdmin);

  // Record APK download button click in Supabase
  if (isSupabaseConfigured()) {
    try {
      const district = getVisitorDistrict();
      Promise.resolve(
        supabase.rpc("record_site_visit", {
          p_page: "/download-apk",
          p_source: source || getTrafficSource(),
          p_device: getDeviceCategory(),
          p_is_logged_in: false,
          p_is_unique: false,
          p_is_download_click: true,
          p_district: district,
        })
      ).catch(() => {});
    } catch {}
  }
}

