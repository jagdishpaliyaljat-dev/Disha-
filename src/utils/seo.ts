import { SITE_CONFIG } from "../config/siteConfig";

/**
 * Dynamic SEO, Open Graph & Schema.org JSON-LD manager for DISHA 20-20.
 * Dynamically updates <head> tags (document.title, meta tags, canonical link,
 * hreflang, google-site-verification, og:*, twitter:*, and JSON-LD structured data).
 */


export interface SEOMetadata {
  title: string;
  description: string;
  canonicalUrl: string;
  ogType?: "website" | "article";
  ogImage?: string;
  robots?: string;
  jsonLd?: object | object[];
  hasHindiAlternate?: boolean;
  articleData?: {
    publishedTime?: string;
    modifiedTime?: string;
    author?: string;
    section?: string;
    tags?: string[];
  };
}

export function updateDocumentHead(meta: SEOMetadata): void {
  if (typeof document === "undefined") return;

  // 1. Update Document Title
  document.title = meta.title;

  // Helper to set or create <meta>
  const setMeta = (attr: "name" | "property", key: string, content: string | undefined | null) => {
    let el = document.querySelector(`meta[${attr}="${key}"]`) as HTMLMetaElement | null;
    if (!content) {
      if (el) el.remove();
      return;
    }
    if (!el) {
      el = document.createElement("meta");
      el.setAttribute(attr, key);
      document.head.appendChild(el);
    }
    el.setAttribute("content", content);
  };

  // Helper to set or create <link>
  const setLink = (rel: string, href: string | undefined | null, hreflang?: string) => {
    const selector = hreflang ? `link[rel="${rel}"][hreflang="${hreflang}"]` : `link[rel="${rel}"]:not([hreflang])`;
    let el = document.querySelector(selector) as HTMLLinkElement | null;
    if (!href) {
      if (el) el.remove();
      return;
    }
    if (!el) {
      el = document.createElement("link");
      el.setAttribute("rel", rel);
      if (hreflang) el.setAttribute("hreflang", hreflang);
      document.head.appendChild(el);
    }
    el.setAttribute("href", href);
  };

  // 2. Standard Search Engine Meta Tags
  setMeta("name", "description", meta.description);
  setMeta(
    "name",
    "robots",
    meta.robots || "index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1"
  );

  // 3. Google Site Verification
  if (SITE_CONFIG.googleSiteVerification) {
    setMeta("name", "google-site-verification", SITE_CONFIG.googleSiteVerification);
  }

  // 4. Canonical URL & hreflang
  setLink("canonical", meta.canonicalUrl);
  
  if (meta.hasHindiAlternate || meta.canonicalUrl.includes("/news/") || meta.canonicalUrl.includes("/topics/")) {
    setLink("alternate", meta.canonicalUrl, "en");
    setLink("alternate", `${meta.canonicalUrl}?lang=hi`, "hi");
    setLink("alternate", meta.canonicalUrl, "x-default");
  } else {
    setLink("alternate", null, "en");
    setLink("alternate", null, "hi");
    setLink("alternate", null, "x-default");
  }

  // 5. OpenGraph Social Sharing Card Tags
  const isLocal = typeof window !== "undefined" && (window.location.hostname.includes("localhost") || window.location.hostname.includes("127.0.0.1"));
  const origin = isLocal && typeof window !== "undefined" ? window.location.origin : SITE_CONFIG.domain;
  const ogImg = meta.ogImage || `${origin}/logo.svg`;

  setMeta("property", "og:title", meta.title);
  setMeta("property", "og:description", meta.description);
  setMeta("property", "og:url", meta.canonicalUrl);
  setMeta("property", "og:type", meta.ogType || "website");
  setMeta("property", "og:site_name", SITE_CONFIG.siteName);
  setMeta("property", "og:image", ogImg);
  setMeta("property", "og:image:alt", meta.title);

  // 6. Article-Specific OpenGraph Metadata
  if (meta.ogType === "article" && meta.articleData) {
    setMeta("property", "article:published_time", meta.articleData.publishedTime);
    setMeta("property", "article:modified_time", meta.articleData.modifiedTime);
    setMeta("property", "article:author", meta.articleData.author || "DISHA 20-20 Editorial Team");
    setMeta("property", "article:section", meta.articleData.section || "Education");
    if (meta.articleData.tags && meta.articleData.tags.length > 0) {
      setMeta("property", "article:tag", meta.articleData.tags.join(", "));
    }
  } else {
    setMeta("property", "article:published_time", null);
    setMeta("property", "article:modified_time", null);
    setMeta("property", "article:author", null);
    setMeta("property", "article:section", null);
    setMeta("property", "article:tag", null);
  }

  // 7. Twitter Card Tags
  setMeta("name", "twitter:card", "summary_large_image");
  setMeta("name", "twitter:title", meta.title);
  setMeta("name", "twitter:description", meta.description);
  setMeta("name", "twitter:image", ogImg);
  setMeta("name", "twitter:image:alt", meta.title);

  // 8. Schema.org JSON-LD Structured Data
  if (meta.jsonLd) {
    let script = document.getElementById("disha-dynamic-jsonld") as HTMLScriptElement | null;
    if (!script) {
      script = document.createElement("script");
      script.id = "disha-dynamic-jsonld";
      script.type = "application/ld+json";
      document.head.appendChild(script);
    }
    script.textContent = JSON.stringify(meta.jsonLd);
  }
}

/**
 * Builds standard BreadcrumbList JSON-LD object for Google Search.
 */
export function buildBreadcrumbJsonLd(items: { name: string; url: string }[]): object {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": items.map((item, index) => ({
      "@type": "ListItem",
      "position": index + 1,
      "name": item.name,
      "item": item.url,
    })),
  };
}
