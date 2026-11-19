import { ActiveTab } from "../types";

export interface ParsedNavState {
  tab: ActiveTab;
  articleSlug: string | null;
  subjectId: string | null;
  chapterId: string | null;
  topicId: string | null;
  coachingId: string | null;
  examId: string | null;
  seriesId: string | null;
  isNotFound?: boolean;
}

export const KNOWN_TABS: readonly ActiveTab[] = [
  "home",
  "topics",
  "videos",
  "pyq_vault",
  "live_tests",
  "test_series",
  "wrong",
  "profile",
  "admin",
  "notifications",
  "analytics",
  "news",
  "admin_news",
  "analyzer",
  "about",
  "privacy-policy",
  "terms-of-service",
  "contact",
  "disclaimer",
  "not_found",
] as const;

export function isKnownTab(tab: string): tab is ActiveTab {
  return (KNOWN_TABS as readonly string[]).includes(tab);
}

/**
 * Resolves any browser pathname and query parameters into a structured, validated navigation state.
 * Handles kebab-case URLs, aliases, nested parameters, and gracefully catches invalid paths (404).
 */
export function resolvePathToNavigationState(
  pathname: string = "/",
  searchParams?: URLSearchParams
): ParsedNavState {
  const cleanPath = pathname.trim().replace(/\/+$/, "") || "/";
  const params = searchParams || new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");

  let tab: ActiveTab = "home";
  let articleSlug: string | null = null;
  let coachingId: string | null = null;
  let examId: string | null = null;
  let seriesId: string | null = null;
  let isNotFound = false;

  // 1. Root & Home
  if (cleanPath === "/" || cleanPath === "/home") {
    tab = "home";
  }
  // 2. News & Article detail
  else if (cleanPath === "/news" || cleanPath.startsWith("/news/")) {
    tab = "news";
    const subParts = cleanPath.slice("/news".length).split("/").filter(Boolean);
    articleSlug = subParts[0] ? decodeURIComponent(subParts[0]) : null;
  }
  // 3. Test Series (supports /test-series, /test_series, /series)
  else if (
    cleanPath.startsWith("/test-series") ||
    cleanPath.startsWith("/test_series") ||
    cleanPath.startsWith("/series")
  ) {
    tab = "test_series";
    const parts = cleanPath.split("/").filter(Boolean);
    const coachingIdx = parts.indexOf("coaching");
    if (coachingIdx !== -1 && parts[coachingIdx + 1]) {
      coachingId = decodeURIComponent(parts[coachingIdx + 1]);
    }
    const examIdx = parts.indexOf("exam");
    if (examIdx !== -1 && parts[examIdx + 1]) {
      examId = decodeURIComponent(parts[examIdx + 1]);
    }
    const seriesIdx = parts.indexOf("series");
    // Only treat series as an ID param if it follows an earlier keyword or comes after exam
    if (seriesIdx !== -1 && parts[seriesIdx + 1] && seriesIdx !== 0) {
      seriesId = decodeURIComponent(parts[seriesIdx + 1]);
    }
  }
  // 4. Topics / Curriculum / Subjects
  else if (
    cleanPath === "/topics" ||
    cleanPath === "/subjects" ||
    cleanPath === "/chapters" ||
    cleanPath === "/study" ||
    cleanPath === "/curriculum" ||
    cleanPath.startsWith("/topics/")
  ) {
    tab = "topics";
  }
  // 4b. Videos / Classes
  else if (
    cleanPath === "/videos" ||
    cleanPath === "/classes" ||
    cleanPath === "/video-classes" ||
    cleanPath.startsWith("/videos/") ||
    cleanPath.startsWith("/classes/")
  ) {
    tab = "videos";
  }
  // 5. PYQ Vault
  else if (
    cleanPath === "/pyq-vault" ||
    cleanPath === "/pyq_vault" ||
    cleanPath === "/pyq" ||
    cleanPath === "/pyqs" ||
    cleanPath.startsWith("/pyq")
  ) {
    tab = "pyq_vault";
  }
  // 6. Live Tests & Mock Tests
  else if (
    cleanPath === "/live-tests" ||
    cleanPath === "/live_tests" ||
    cleanPath === "/tests" ||
    cleanPath === "/live" ||
    cleanPath === "/mock-tests" ||
    cleanPath.startsWith("/live-test")
  ) {
    tab = "live_tests";
  }
  // 7. Wrong Questions & Revision
  else if (
    cleanPath === "/wrong" ||
    cleanPath === "/revision" ||
    cleanPath === "/wrong-questions" ||
    cleanPath === "/wrong_questions" ||
    cleanPath === "/bookmarks"
  ) {
    tab = "wrong";
  }
  // 8. Profile & Account
  else if (cleanPath === "/profile" || cleanPath === "/account" || cleanPath === "/me") {
    tab = "profile";
  }
  // 9. Admin Panel & Sub-routes
  else if (cleanPath === "/admin" || cleanPath.startsWith("/admin/")) {
    tab = "admin";
  }
  // 10. Notifications
  else if (cleanPath === "/notifications" || cleanPath === "/alerts") {
    tab = "notifications";
  }
  // 11. Analytics & Performance
  else if (cleanPath === "/analytics" || cleanPath === "/performance" || cleanPath === "/stats") {
    tab = "analytics";
  }
  // 12. Exam Paper Analyzer
  else if (cleanPath === "/analyzer" || cleanPath === "/paper-scan" || cleanPath === "/scan") {
    tab = "analyzer";
  }
  // 13. Static / Information Pages
  else if (cleanPath === "/about" || cleanPath === "/about-us") {
    tab = "about";
  } else if (cleanPath === "/privacy-policy" || cleanPath === "/privacy") {
    tab = "privacy-policy";
  } else if (cleanPath === "/terms-of-service" || cleanPath === "/terms") {
    tab = "terms-of-service";
  } else if (cleanPath === "/contact" || cleanPath === "/contact-us") {
    tab = "contact";
  } else if (cleanPath === "/disclaimer") {
    tab = "disclaimer";
  }
  // 14. Unknown Path -> 404
  else {
    tab = "not_found";
    isNotFound = true;
  }

  return {
    tab,
    articleSlug,
    subjectId: params.get("subject") || null,
    chapterId: params.get("chapter") || null,
    topicId: params.get("topic") || null,
    coachingId,
    examId,
    seriesId,
    isNotFound,
  };
}

/**
 * Builds the canonical, SEO-friendly browser URL for the given navigation state.
 * Preserves Admin subpaths/queries and produces clean kebab-case URLs.
 */
export function buildCanonicalPath(
  tab: ActiveTab,
  slug: string | null,
  subjectId: string | null,
  chapterId: string | null,
  topicId: string | null,
  coachingId: string | null,
  examId: string | null,
  seriesId: string | null,
  hasSession: boolean
): string {
  // 1. Home
  if (tab === "home") return "/";

  // 2. 404
  if (tab === "not_found") {
    return typeof window !== "undefined" ? window.location.pathname : "/404";
  }

  // 3. Admin subpaths and queries preservation
  if (tab === "admin") {
    if (typeof window !== "undefined" && window.location.pathname.startsWith("/admin")) {
      return window.location.pathname + window.location.search;
    }
    return "/admin";
  }

  // 4. News with optional article slug
  if (tab === "news") {
    return slug ? `/news/${encodeURIComponent(slug)}` : "/news";
  }

  // 5. Test Series nested hierarchy
  if (tab === "test_series") {
    let pathStr = "/test-series";
    if (coachingId) {
      pathStr += `/coaching/${encodeURIComponent(coachingId)}`;
      if (examId) {
        pathStr += `/exam/${encodeURIComponent(examId)}`;
        if (seriesId) {
          pathStr += `/series/${encodeURIComponent(seriesId)}`;
        }
      }
    }
    if (hasSession) {
      pathStr += "?session=1";
    }
    return pathStr;
  }

  // 6. Topics with query parameters
  if (tab === "topics" || tab === "videos") {
    const params = new URLSearchParams();
    if (subjectId) params.set("subject", subjectId);
    if (chapterId) params.set("chapter", chapterId);
    if (topicId) params.set("topic", topicId);
    if (hasSession) params.set("session", "1");
    const qs = params.toString();
    return `/${tab}${qs ? `?${qs}` : ""}`;
  }

  // 7. Other standard tabs (convert underscore to kebab-case for canonical URLs)
  const canonicalName = tab === "pyq_vault" ? "pyq-vault" : tab === "live_tests" ? "live-tests" : tab;
  const params = new URLSearchParams();
  if (hasSession) {
    params.set("session", "1");
  }
  const qs = params.toString();
  return `/${canonicalName}${qs ? `?${qs}` : ""}`;
}
