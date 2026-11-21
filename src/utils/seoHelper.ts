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
  jsonLdSchemas?: object[];
}

export function updateSEOHead(options: SEOOptions) {
  if (typeof window === "undefined" || typeof document === "undefined") return;

  const origin = window.location.origin;
  const currentPath = window.location.pathname;
  const fullUrl = options.canonicalUrl || `${origin}${currentPath}`;

  // 1. Page Title
  document.title = options.title;

  // Helper to set/update meta tag
  const setMeta = (attrName: string, attrVal: string, content: string) => {
    let element = document.querySelector(`meta[${attrName}="${attrVal}"]`);
    if (!element) {
      element = document.createElement("meta");
      element.setAttribute(attrName, attrVal);
      document.head.appendChild(element);
    }
    element.setAttribute("content", content);
  };

  // Helper to set/update link tag
  const setLink = (relVal: string, hrefVal: string, extraAttrs?: Record<string, string>) => {
    let selector = `link[rel="${relVal}"]`;
    if (extraAttrs) {
      const extraStr = Object.entries(extraAttrs)
        .map(([k, v]) => `[${k}="${v}"]`)
        .join("");
      selector += extraStr;
    }
    let element = document.querySelector(selector);
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

  // Robots Tag
  if (options.noindex) {
    setMeta("name", "robots", "noindex, nofollow");
  } else {
    setMeta("name", "robots", "index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1");
  }

  // 3. Canonical Link & Hreflang
  setLink("canonical", fullUrl);
  setLink("alternate", fullUrl, { hreflang: "hi" });
  setLink("alternate", fullUrl, { hreflang: "en" });
  setLink("alternate", fullUrl, { hreflang: "x-default" });

  // 4. OpenGraph Tags
  const defaultImage = options.ogImage || `${origin}/og-preview.png`;
  setMeta("property", "og:title", options.title);
  setMeta("property", "og:description", options.description);
  setMeta("property", "og:type", options.ogType || "website");
  setMeta("property", "og:url", fullUrl);
  setMeta("property", "og:image", defaultImage);
  setMeta("property", "og:site_name", "Disha PYQ");
  setMeta("property", "og:locale", "en_IN");
  setMeta("property", "og:locale:alternate", "en_US");

  // 5. Twitter Card Tags
  setMeta("name", "twitter:card", "summary_large_image");
  setMeta("name", "twitter:title", options.title);
  setMeta("name", "twitter:description", options.description);
  setMeta("name", "twitter:image", defaultImage);

  // 6. JSON-LD Schemas Injections
  // Remove existing dynamic jsonld scripts
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
