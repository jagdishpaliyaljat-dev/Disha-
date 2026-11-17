import { NewsArticle } from "../types";
import { getLocalArticles, getDeletedArticleIds } from "./articleStorage";
import { apiFetch } from "./api";

export interface SitemapUrlEntry {
  loc: string;
  lastmod?: string;
  changefreq?: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
  priority?: number;
}

export interface SitemapGenerationResult {
  success: boolean;
  xml: string;
  totalArticles: number;
  validPublishedArticles: number;
  draftsExcluded: number;
  invalidExcluded: number;
  entries: SitemapUrlEntry[];
  generatedAt: string;
  error?: string;
}

export const CANONICAL_SITE_URL = "https://disha2020.in";

/**
 * Escapes characters for strict XML compliance.
 */
export function escapeXml(unsafe: string): string {
  return (unsafe || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Formats a date string, timestamp, or Date object into standard W3C Datetime format (YYYY-MM-DD).
 */
export function formatW3CDate(dateInput?: string | number | Date): string {
  if (!dateInput) {
    return new Date().toISOString().split("T")[0];
  }
  try {
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) {
      return new Date().toISOString().split("T")[0];
    }
    return d.toISOString().split("T")[0];
  } catch {
    return new Date().toISOString().split("T")[0];
  }
}

/**
 * Checks if a slug is valid for inclusion in public sitemaps.
 */
export function isValidSlug(slug?: string): boolean {
  if (!slug || typeof slug !== "string") return false;
  const clean = slug.trim().toLowerCase();
  if (clean.length < 2) return false;
  if (clean === "undefined" || clean === "null" || clean === "default") return false;
  // Slug should match standard URL slug pattern (alphanumeric and dashes)
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(clean);
}

/**
 * Constructs XML string adhering strictly to the sitemaps.org 0.9 schema.
 */
export function buildSitemapXml(entries: SitemapUrlEntry[]): string {
  const urlNodes = entries.map((e) => {
    const loc = `    <loc>${escapeXml(e.loc)}</loc>`;
    const lastmod = e.lastmod ? `\n    <lastmod>${escapeXml(e.lastmod)}</lastmod>` : "";
    const changefreq = e.changefreq ? `\n    <changefreq>${e.changefreq}</changefreq>` : "";
    const priority = e.priority !== undefined ? `\n    <priority>${e.priority.toFixed(1)}</priority>` : "";
    return `  <url>\n${loc}${lastmod}${changefreq}${priority}\n  </url>`;
  });

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urlNodes.join("\n")}
</urlset>`;
}

/**
 * Standard core static pages with their default priorities and frequencies.
 */
export function getCoreStaticEntries(): SitemapUrlEntry[] {
  const today = formatW3CDate(new Date());
  return [
    {
      loc: `${CANONICAL_SITE_URL}/`,
      lastmod: today,
      changefreq: "daily",
      priority: 1.0,
    },
    {
      loc: `${CANONICAL_SITE_URL}/news`,
      lastmod: today,
      changefreq: "daily",
      priority: 0.9,
    },
    {
      loc: `${CANONICAL_SITE_URL}/topics`,
      lastmod: today,
      changefreq: "weekly",
      priority: 0.8,
    },
    {
      loc: `${CANONICAL_SITE_URL}/pyq_vault`,
      lastmod: today,
      changefreq: "weekly",
      priority: 0.8,
    },
    {
      loc: `${CANONICAL_SITE_URL}/live_tests`,
      lastmod: today,
      changefreq: "weekly",
      priority: 0.8,
    },
  ];
}

/**
 * Automatically queries all valid articles stored in the database,
 * strictly filters for published articles, excludes drafts, validates slugs,
 * and compiles the standard XML sitemap ready for Search Console submission.
 */
export async function generateSitemapFromDatabase(): Promise<SitemapGenerationResult> {
  const deletedIds = new Set(getDeletedArticleIds());
  let draftsExcluded = 0;
  let invalidExcluded = 0;

  const allArticles = getLocalArticles().filter((a) => !deletedIds.has(a.id));

  // Also merge with local articles if database returns fewer
  const localArticles = getLocalArticles().filter((a) => !deletedIds.has(a.id));
  const mergedMap = new Map<string, NewsArticle>();
  allArticles.forEach((a) => mergedMap.set(a.id, a));
  localArticles.forEach((a) => {
    if (!mergedMap.has(a.id)) {
      mergedMap.set(a.id, a);
    }
  });

  const totalList = Array.from(mergedMap.values());
  const validArticleEntries: SitemapUrlEntry[] = [];
  const processedSlugs = new Set<string>();

  for (const art of totalList) {
    // 1. Strictly verify status: MUST be "published"
    if (art.status !== "published") {
      draftsExcluded++;
      continue;
    }

    // 2. Determine and validate slug
    let slug = (art.slug || art.id || "").trim().toLowerCase();
    slug = slug.replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

    if (!isValidSlug(slug)) {
      invalidExcluded++;
      continue;
    }

    // Prevent duplicate entries for the same slug
    if (processedSlugs.has(slug)) {
      continue;
    }
    processedSlugs.add(slug);

    // 3. Format last modification date
    const lastModDate = formatW3CDate(art.updatedAt || art.publishedAt || art.createdAt);

    validArticleEntries.push({
      loc: `${CANONICAL_SITE_URL}/news/${encodeURI(slug)}`,
      lastmod: lastModDate,
      changefreq: "weekly",
      priority: 0.8,
    });
  }

  // Sort article entries by lastmod descending
  validArticleEntries.sort((a, b) => {
    return (b.lastmod || "").localeCompare(a.lastmod || "");
  });

  // Combine core static pages + valid article pages
  const staticEntries = getCoreStaticEntries();
  const allEntries = [...staticEntries, ...validArticleEntries];
  const xml = buildSitemapXml(allEntries);

  return {
    success: true,
    xml,
    totalArticles: totalList.length,
    validPublishedArticles: validArticleEntries.length,
    draftsExcluded,
    invalidExcluded,
    entries: allEntries,
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Calls the backend API endpoint to update the physical sitemap.xml file on the server.
 */
export async function updateSitemapFileOnServer(): Promise<{
  success: boolean;
  message: string;
  xml?: string;
  count?: number;
  draftsExcluded?: number;
}> {
  try {
    const res = await apiFetch("/api/sitemap/generate", {
      method: "POST",
    });

    if (res.ok) {
      const data = await res.json();
      return {
        success: data.success ?? true,
        message: data.message || "XML Sitemap file updated successfully on server.",
        xml: data.xml,
        count: data.count,
        draftsExcluded: data.draftsExcluded,
      };
    } else {
      const errText = await res.text();
      return {
        success: false,
        message: `Server returned HTTP ${res.status}: ${errText.slice(0, 100)}`,
      };
    }
  } catch (err: any) {
    return {
      success: false,
      message: err?.message || "Failed to contact sitemap generation API",
    };
  }
}

/**
 * Downloads the XML sitemap as a physical file on the user's computer.
 */
export function downloadSitemapXmlFile(xml: string, filename: string = "sitemap.xml"): void {
  try {
    const blob = new Blob([xml], { type: "application/xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } catch (err) {
    console.error("Failed to download sitemap XML file:", err);
  }
}

/**
 * Copies the raw sitemap XML to clipboard.
 */
export async function copySitemapToClipboard(xml: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(xml);
    return true;
  } catch (err) {
    console.warn("Clipboard write failed, fallback:", err);
    try {
      const ta = document.createElement("textarea");
      ta.value = xml;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Validates a sitemap XML string against sitemaps.org standards.
 */
export function validateSitemap(xml: string): { valid: boolean; urlCount: number; errors: string[] } {
  const errors: string[] = [];
  if (!xml || typeof xml !== "string") {
    errors.push("Sitemap is empty or invalid type");
    return { valid: false, urlCount: 0, errors };
  }

  if (!xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')) {
    errors.push("Missing standard XML declaration header");
  }

  if (!xml.includes('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">')) {
    errors.push("Missing standard sitemaps.org schema namespace in <urlset>");
  }

  const urlMatches = xml.match(/<url>[\s\S]*?<\/url>/g) || [];
  const urlCount = urlMatches.length;

  if (urlCount === 0) {
    errors.push("Sitemap contains zero <url> entries");
  }

  // Ensure each URL contains a valid <loc> tag
  for (const match of urlMatches) {
    if (!/<loc>https?:\/\/[^\s<]+<\/loc>/.test(match)) {
      errors.push("Found <url> entry missing valid <loc> tag");
      break;
    }
  }

  return {
    valid: errors.length === 0,
    urlCount,
    errors,
  };
}
