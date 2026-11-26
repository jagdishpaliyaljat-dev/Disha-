import { SITE_CONFIG } from "../config/siteConfig";

export interface SEOOptions {
  title: string;
  description: string;
  canonicalUrl?: string;
  ogImage?: string;
  ogType?: "website" | "article";
  publishedAt?: string;
  modifiedAt?: string;
  authorName?: string;
  category?: string;
  keywords?: string[];
  noindex?: boolean;
  lang?: string;
  jsonLdSchemas?: object[];
}

export function getCanonicalOrigin(): string {
  if (
    typeof window !== "undefined" &&
    window.location &&
    (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1")
  ) {
    return window.location.origin;
  }
  return SITE_CONFIG.domain;
}

export function updateSEOHead(options: SEOOptions) {
  if (typeof window === "undefined" || typeof document === "undefined") return;

  const origin = getCanonicalOrigin();
  const currentPath = window.location.pathname || "/";
  const fullUrl = options.canonicalUrl || `${origin}${currentPath === "/" ? "/" : currentPath}`;

  // 1. Page Title & Language
  document.title = options.title;
  const lang = options.lang || "hi";
  document.documentElement.setAttribute("lang", lang);
  document.documentElement.setAttribute("xml:lang", lang);

  // Helper to set/update or remove meta tag
  const setMeta = (attrName: string, attrVal: string, content: string | undefined | null) => {
    let element = document.querySelector(`meta[${attrName}="${attrVal}"]`);
    if (!content) {
      if (element) element.remove();
      return;
    }
    if (!element) {
      element = document.createElement("meta");
      element.setAttribute(attrName, attrVal);
      document.head.appendChild(element);
    }
    element.setAttribute("content", content);
  };

  // Helper to set/update link tag
  const setLink = (relVal: string, hrefVal: string | undefined | null, extraAttrs?: Record<string, string>) => {
    let selector = `link[rel="${relVal}"]`;
    if (extraAttrs) {
      const extraStr = Object.entries(extraAttrs)
        .map(([k, v]) => `[${k}="${v}"]`)
        .join("");
      selector += extraStr;
    } else {
      selector += ":not([hreflang])";
    }
    let element = document.querySelector(selector);
    if (!hrefVal) {
      if (element) element.remove();
      return;
    }
    if (!element) {
      element = document.createElement("link");
      element.setAttribute("rel", relVal);
      if (extraAttrs) {
        Object.entries(extraAttrs).forEach(([k, v]) => element!.setAttribute(k, v));
      }
      document.head.appendChild(element);
    }
    element.setAttribute("href", hrefVal);
  };

  // 2. Standard Meta Tags
  setMeta("name", "description", options.description);
  if (options.keywords && options.keywords.length > 0) {
    setMeta("name", "keywords", options.keywords.join(", "));
  }
  if (SITE_CONFIG.googleSiteVerification) {
    setMeta("name", "google-site-verification", SITE_CONFIG.googleSiteVerification);
  }

  // Robots Tag (plus googlebot/bingbot alignment)
  const robotsValue = options.noindex
    ? "noindex, nofollow"
    : "index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1";
  setMeta("name", "robots", robotsValue);
  setMeta("name", "googlebot", robotsValue);
  setMeta("name", "bingbot", robotsValue);

  // 3. Canonical Link & Clean Hreflang (avoid duplicate same-URL language tags)
  setLink("canonical", fullUrl);
  setLink("alternate", null, { hreflang: "hi" });
  setLink("alternate", null, { hreflang: "en" });
  setLink("alternate", options.noindex ? null : fullUrl, { hreflang: "x-default" });

  // 4. OpenGraph Tags (defaulting to 1200x630 PNG social card)
  const isDefaultImg = !options.ogImage;
  const effectiveImage = options.ogImage || `${origin}/og-preview.png`;
  setMeta("property", "og:title", options.title);
  setMeta("property", "og:description", options.description);
  setMeta("property", "og:type", options.ogType || "website");
  setMeta("property", "og:url", fullUrl);
  setMeta("property", "og:image", effectiveImage);
  setMeta("property", "og:image:width", isDefaultImg ? "1200" : null);
  setMeta("property", "og:image:height", isDefaultImg ? "630" : null);
  setMeta("property", "og:image:alt", options.title);
  setMeta("property", "og:site_name", SITE_CONFIG.siteName);
  setMeta("property", "og:locale", "en_IN");
  setMeta("property", "og:locale:alternate", "hi_IN");

  // 5. Twitter Card Tags
  setMeta("name", "twitter:card", "summary_large_image");
  setMeta("name", "twitter:url", fullUrl);
  setMeta("name", "twitter:title", options.title);
  setMeta("name", "twitter:description", options.description);
  setMeta("name", "twitter:image", effectiveImage);
  setMeta("name", "twitter:image:alt", options.title);

  // 6. JSON-LD Schemas Injection
  const existingScripts = document.querySelectorAll("script[data-seo-jsonld]");
  existingScripts.forEach((el) => el.remove());

  if (options.jsonLdSchemas && options.jsonLdSchemas.length > 0) {
    options.jsonLdSchemas.forEach((schemaObj, index) => {
      const script = document.createElement("script");
      script.type = "application/ld+json";
      script.setAttribute("data-seo-jsonld", `schema-${index}`);
      script.textContent = JSON.stringify(schemaObj);
      document.head.appendChild(script);
    });
  }
}

export function generateSlug(title: string): string {
  if (!title) return `post-${Date.now().toString(36)}`;
  
  // Basic transliteration for common Hindi characters to make slugs more readable
  const hindiMap: Record<string, string> = {
    'अ': 'a', 'आ': 'aa', 'इ': 'i', 'ई': 'ee', 'उ': 'u', 'ऊ': 'oo', 'ऋ': 'ri',
    'ए': 'e', 'ऐ': 'ai', 'ओ': 'o', 'औ': 'au', 'क': 'k', 'ख': 'kh', 'ग': 'g',
    'घ': 'gh', 'च': 'ch', 'छ': 'chh', 'ज': 'j', 'झ': 'jh', 'ट': 't', 'ठ': 'th',
    'ड': 'd', 'ढ': 'dh', 'ण': 'n', 'त': 't', 'थ': 'th', 'द': 'd', 'ध': 'dh',
    'न': 'n', 'प': 'p', 'फ': 'ph', 'ब': 'b', 'भ': 'bh', 'म': 'm', 'य': 'y',
    'र': 'r', 'ल': 'l', 'व': 'v', 'श': 'sh', 'ष': 'sh', 'स': 's', 'ह': 'h',
    'ा': 'aa', 'ि': 'i', 'ी': 'ee', 'ु': 'u', 'ू': 'oo', 'ृ': 'ri', 'े': 'e',
    'ै': 'ai', 'ो': 'o', 'ौ': 'au', 'ं': 'n', 'ः': 'h', '्': '', '़': '',
  };

  let processed = title.toLowerCase().trim();
  
  // Replace Hindi characters if present
  let transliterated = "";
  for (const char of processed) {
    transliterated += hindiMap[char] || char;
  }
  
  return transliterated
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .substring(0, 80)
    .replace(/^-|-$/g, "") || `post-${Date.now().toString(36)}`;
}

export interface QuizSchemaQuestion {
  text?: string;
  question?: string;
  options?: string[];
  correctIndex?: number;
  correct_answer?: number;
  explanation?: string;
}

/**
 * Builds schema.org/Quiz structured data with Question & Answer elements
 * conforming to Google Search Central's Practice Problems rich results specification.
 */
export function buildQuizSchema(
  title: string,
  questions: QuizSchemaQuestion[],
  canonicalUrl?: string
): Record<string, any> {
  const origin = getCanonicalOrigin();
  const slice = (questions || []).slice(0, 10);
  return {
    "@context": "https://schema.org",
    "@type": "Quiz",
    "name": title,
    "description": `Practice ${title} multiple-choice questions with official answers and detailed explanations on Disha PYQ.`,
    "educationalLevel": "Intermediate",
    "learningResourceType": "Quiz",
    "url": canonicalUrl || `${origin}/topics`,
    "hasPart": slice.map((q) => {
      const qText = q.text || q.question || "";
      const opts = Array.isArray(q.options) ? q.options : [];
      const correctIdx = typeof q.correctIndex === "number" ? q.correctIndex : (q.correct_answer ?? 0);
      const correctOptText = opts[correctIdx] || "";
      return {
        "@type": "Question",
        "eduQuestionType": "Multiple choice",
        "text": qText,
        "suggestedAnswer": opts.map((opt, i) => ({
          "@type": "Answer",
          "position": i + 1,
          "text": opt,
        })),
        "acceptedAnswer": {
          "@type": "Answer",
          "position": correctIdx + 1,
          "text": correctOptText,
          "comment": {
            "@type": "Comment",
            "text": q.explanation || "Official answer key verified on Disha PYQ.",
          },
        },
      };
    }),
  };
}

export interface FAQItem {
  question: string;
  answer: string;
}

/**
 * Builds schema.org/FAQPage structured data for rich expandable search accordions in Google SERP.
 */
export function buildFAQSchema(faqs: FAQItem[]): Record<string, any> {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": (faqs || []).map((f) => ({
      "@type": "Question",
      "name": f.question,
      "acceptedAnswer": {
        "@type": "Answer",
        "text": f.answer,
      },
    })),
  };
}
