import { collection, doc, getDocs, query, orderBy } from "firebase/firestore";
import { db } from "../lib/firebase";
import { guardedSetDoc, guardedDeleteDoc } from "./quotaTracker";
import mammoth from "mammoth";
import DOMPurify from "dompurify";
import { NewsArticle, ArticleBlock, FAQItem } from "../types";
import {
  parseTableRowCells,
  isTableSeparatorRow,
  parseMarkdownTableLines,
} from "../components/news/ArticleTable";

export interface SEOAuditCheck {
  id: string;
  label: string;
  passed: boolean;
  tip: string;
  severity: "good" | "warning" | "error";
}

export interface InternalLinkSuggestion {
  articleId: string;
  title: string;
  slug: string;
  category: string;
  matchedKeyword: string;
}

export interface DuplicateDetectionResult {
  isDuplicate: boolean;
  matchType?: "exact_slug" | "similar_title" | "similar_content";
  matchedArticleTitle?: string;
  matchedArticleId?: string;
  similarityScore?: number; // 0-100%
}

export interface DetectedArticleMetadata {
  wordCount: number;
  readingTimeMinutes: number;
  language: "Hindi" | "English" | "Both";
  searchIntent: "Exam Alert" | "Comprehensive Guide" | "Syllabus Breakdown" | "Study Strategy" | "General Educational";
  headingsCount: { h1: number; h2: number; h3: number; h4: number };
  tablesCount: number;
  faqCount: number;
  keyPointsCount: number;
  ctaDetected: boolean;
  introDetected: boolean;
  conclusionDetected: boolean;
  internalLinksDetected: number;
  externalLinksDetected?: number;
  injectedLinksSummary?: Array<{
    type: "internal" | "external";
    keyword: string;
    url: string;
  }>;
}

export interface AutoLinkRule {
  id?: string;
  keywords: string[];
  url: string;
  type: "internal" | "external";
  description?: string;
  createdAt?: string;
}

const CUSTOM_AUTO_LINK_RULES_STORAGE_KEY = "quizpro_custom_auto_link_rules";

/**
 * Get custom auto link rules added by Admin from localStorage (Legacy/Cache)
 */
export function getCustomAutoLinkRulesLocal(): AutoLinkRule[] {
  try {
    const raw = localStorage.getItem(CUSTOM_AUTO_LINK_RULES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error("Error reading custom link rules from local:", err);
    return [];
  }
}

export function getCustomAutoLinkRules(): AutoLinkRule[] {
  return getCustomAutoLinkRulesLocal();
}

export function saveCustomAutoLinkRules(rules: AutoLinkRule[]): void {
  try {
    localStorage.setItem(CUSTOM_AUTO_LINK_RULES_STORAGE_KEY, JSON.stringify(rules));
  } catch (err) {
    console.error("Error saving custom link rules:", err);
  }
}

/**
 * Fetch custom auto link rules from Firestore
 */
export async function fetchCustomAutoLinkRules(): Promise<AutoLinkRule[]> {
  try {
    const rulesRef = collection(db, "link_rules");
    const q = query(rulesRef, orderBy("createdAt", "desc"));
    const snap = await getDocs(q);
    const rules = snap.docs.map(d => ({ ...d.data(), id: d.id } as AutoLinkRule));
    
    // Update local cache
    localStorage.setItem(CUSTOM_AUTO_LINK_RULES_STORAGE_KEY, JSON.stringify(rules));
    return rules;
  } catch (err) {
    console.warn("Error fetching link rules from Firestore, falling back to local:", err);
    return getCustomAutoLinkRulesLocal();
  }
}

/**
 * Save a custom auto link rule to Firestore
 */
export async function saveCustomAutoLinkRule(rule: AutoLinkRule): Promise<void> {
  try {
    const id = rule.id || `rule_${Date.now()}`;
    const ruleRef = doc(db, "link_rules", id);
    const data = {
      ...rule,
      id,
      createdAt: rule.createdAt || new Date().toISOString()
    };
    // @ts-ignore
    await guardedSetDoc(ruleRef, data, { merge: true }, "Admin", "Save Custom Auto Link Rule");
    
    // Sync local
    const local = getCustomAutoLinkRulesLocal();
    const updated = [data, ...local.filter(r => r.id !== id)];
    localStorage.setItem(CUSTOM_AUTO_LINK_RULES_STORAGE_KEY, JSON.stringify(updated));
  } catch (err) {
    console.error("Error saving link rule to Firestore:", err);
    throw err;
  }
}

/**
 * Delete a custom auto link rule from Firestore
 */
export async function deleteCustomAutoLinkRule(id: string): Promise<void> {
  try {
    await guardedDeleteDoc(doc(db, "link_rules", id), "Admin", "Delete Custom Auto Link Rule");
    
    // Sync local
    const local = getCustomAutoLinkRulesLocal();
    const updated = local.filter(r => r.id !== id);
    localStorage.setItem(CUSTOM_AUTO_LINK_RULES_STORAGE_KEY, JSON.stringify(updated));
  } catch (err) {
    console.error("Error deleting link rule from Firestore:", err);
    throw err;
  }
}

export const AUTO_INTERNAL_LINK_RULES: AutoLinkRule[] = [
  {
    keywords: ["Live Test", "Live Tests", "Mock Test", "Mock Tests", "मॉक टेस्ट", "ऑनलाइन टेस्ट", "Test Series", "टेस्ट सीरीज़"],
    url: "/live_tests",
    type: "internal",
    description: "Live & Mock Tests Engine"
  },
  {
    keywords: ["Previous Year Questions", "Previous Year Papers", "PYQ", "PYQs", "पुराने प्रश्न पत्र", "पीवाइक्यू"],
    url: "/pyq_vault",
    type: "internal",
    description: "PYQ Papers Vault"
  },
  {
    keywords: ["Syllabus", "Syllabus Breakdown", "MCQ Practice", "पाठ्यक्रम", "अभ्यास प्रश्न", "Chapter Wise MCQs", "अध्यायवार प्रश्न"],
    url: "/topics",
    type: "internal",
    description: "Syllabus & Practice Topics"
  },
  {
    keywords: ["Current Affairs", "Daily Current Affairs", "समसामयिकी", "डेली करंट अफेयर्स", "न्यूज"],
    url: "/news",
    type: "internal",
    description: "Current Affairs & News"
  }
];

export const AUTO_EXTERNAL_LINK_RULES: AutoLinkRule[] = [
  {
    keywords: ["RPSC", "RPSC RAS", "आरपीएससी", "राजस्थान लोक सेवा आयोग"],
    url: "https://rpsc.rajasthan.gov.in",
    type: "external",
    description: "RPSC Official Portal"
  },
  {
    keywords: ["RSMSSB", "RSSB", "राजस्थान कर्मचारी चयन बोर्ड", "कर्मचारी चयन बोर्ड"],
    url: "https://rsmssb.rajasthan.gov.in",
    type: "external",
    description: "RSMSSB Official Portal"
  },
  {
    keywords: ["Economic Survey", "Rajasthan Economic Survey", "आर्थिक समीक्षा", "राजस्थान बजट", "DIPR Rajasthan"],
    url: "https://dipr.rajasthan.gov.in",
    type: "external",
    description: "DIPR Rajasthan Official"
  },
  {
    keywords: ["Government of India", "PIB", "भारत सरकार", "Press Information Bureau"],
    url: "https://www.india.gov.in",
    type: "external",
    description: "National Portal of India"
  },
  {
    keywords: ["NITI Aayog", "नीति आयोग"],
    url: "https://www.niti.gov.in",
    type: "external",
    description: "NITI Aayog Official"
  },
  {
    keywords: ["Indian Constitution", "भारतीय संविधान"],
    url: "https://hi.wikipedia.org/wiki/%E0%A4%AD%E0%A4%BE%E0%A4%B0%E0%A4%A4%E0%A5%80%E0%A4%AF_%E0%A4%B8%E0%A4%82%E0%A4%B5%E0%A4%BF%E0%A4%A0%E0%A4%BE%E0%A4%A0",
    type: "external",
    description: "Wikipedia Educational Reference"
  }
];

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Automatically injects internal and external links into article blocks based on keyword matching
 */
export function autoInjectLinksToArticleBlocks(
  blocks: ArticleBlock[],
  existingArticles: NewsArticle[] = [],
  providedCustomRules: AutoLinkRule[] = []
): {
  blocks: ArticleBlock[];
  internalLinksCount: number;
  externalLinksCount: number;
  injectedLinksSummary: Array<{ type: "internal" | "external"; keyword: string; url: string }>;
} {
  const injectedLinksSummary: Array<{ type: "internal" | "external"; keyword: string; url: string }> = [];
  const usedUrls = new Set<string>();
  const usedKeywords = new Set<string>();

  let internalLinksCount = 0;
  let externalLinksCount = 0;

  // Fetch admin custom rules
  const storedCustomRules = getCustomAutoLinkRules();
  const customRules = providedCustomRules.length > 0 ? providedCustomRules : storedCustomRules;

  // Build full rules list including existing published articles
  const articleRules: AutoLinkRule[] = [];
  if (existingArticles && existingArticles.length > 0) {
    for (const art of existingArticles) {
      if (art.status === "published" && art.title && art.slug) {
        const keywords = [art.title];
        if (art.focusKeyword && art.focusKeyword.length > 3) {
          keywords.push(art.focusKeyword);
        }
        articleRules.push({
          keywords,
          url: `/news/${art.slug}`,
          type: "internal",
          description: `Article: ${art.title}`
        });
      }
    }
  }

  const allRules: AutoLinkRule[] = [
    ...customRules,
    ...AUTO_INTERNAL_LINK_RULES,
    ...articleRules,
    ...AUTO_EXTERNAL_LINK_RULES
  ];

  const processedBlocks: ArticleBlock[] = blocks.map((block) => {
    if (
      block.type !== "paragraph" &&
      block.type !== "intro" &&
      block.type !== "conclusion" &&
      block.type !== "list" &&
      block.type !== "key_points"
    ) {
      return block;
    }

    if (block.text) {
      let currentText = block.text;

      for (const rule of allRules) {
        if (usedUrls.has(rule.url)) continue;

        for (const kw of rule.keywords) {
          if (usedKeywords.has(kw.toLowerCase())) continue;

          // Replace unlinked keyword with markdown link [Keyword](URL)
          // Using custom boundaries instead of \b to support Hindi (Devanagari) characters
          const boundaryStart = '(?<![a-zA-Z0-9\\u0900-\\u097F])';
          const boundaryEnd = '(?![a-zA-Z0-9\\u0900-\\u097F])';
          const noPrevLink = '(?<!\\[|\\(|<a[^>]*>|href=")';
          const noNextLink = '(?![^\\[]*\\]|[^<]*>|\\))';
          
          const regex = new RegExp(`${boundaryStart}${noPrevLink}(${escapeRegExp(kw)})${noNextLink}${boundaryEnd}`, "i");

          if (regex.test(currentText)) {
            currentText = currentText.replace(regex, `[$1](${rule.url})`);
            usedUrls.add(rule.url);
            usedKeywords.add(kw.toLowerCase());

            if (rule.type === "internal") internalLinksCount++;
            else externalLinksCount++;

            injectedLinksSummary.push({
              type: rule.type,
              keyword: kw,
              url: rule.url
            });

            break;
          }
        }
      }

      return { ...block, text: currentText };
    }

    if (block.listItems && block.listItems.length > 0) {
      const updatedItems = block.listItems.map((item) => {
        let currentItem = item;

        for (const rule of allRules) {
          if (usedUrls.has(rule.url)) continue;

          for (const kw of rule.keywords) {
            if (usedKeywords.has(kw.toLowerCase())) continue;

            const boundaryStart = '(?<![a-zA-Z0-9\\u0900-\\u097F])';
            const boundaryEnd = '(?![a-zA-Z0-9\\u0900-\\u097F])';
            const noPrevLink = '(?<!\\[|\\(|<a[^>]*>|href=")';
            const noNextLink = '(?![^\\[]*\\]|[^<]*>|\\))';
            
            const regex = new RegExp(`${boundaryStart}${noPrevLink}(${escapeRegExp(kw)})${noNextLink}${boundaryEnd}`, "i");

            if (regex.test(currentItem)) {
              currentItem = currentItem.replace(regex, `[$1](${rule.url})`);
              usedUrls.add(rule.url);
              usedKeywords.add(kw.toLowerCase());

              if (rule.type === "internal") internalLinksCount++;
              else externalLinksCount++;

              injectedLinksSummary.push({
                type: rule.type,
                keyword: kw,
                url: rule.url
              });

              break;
            }
          }
        }

        return currentItem;
      });

      return { ...block, listItems: updatedItems };
    }

    return block;
  });

  return {
    blocks: processedBlocks,
    internalLinksCount,
    externalLinksCount,
    injectedLinksSummary
  };
}

export interface ParsedImportResult {
  article: Partial<NewsArticle>;
  detectedMeta: DetectedArticleMetadata;
  seoAudit: {
    score: number;
    checks: SEOAuditCheck[];
  };
  internalLinkingSuggestions: InternalLinkSuggestion[];
  duplicateWarning: DuplicateDetectionResult | null;
  jsonLdSchema: Record<string, any>;
  rawExtractedText: string;
}

/**
 * Generate a clean, SEO-friendly URL slug handling both English and transliterated Hindi
 */
export function generateSmartSlug(title: string): string {
  if (!title) return `article-${Date.now()}`;
  
  const translitMap: Record<string, string> = {
    "परीक्षा": "pariksha",
    "सिलेबस": "syllabus",
    "कटऑफ": "cutoff",
    "तैयारी": "taiyari",
    "योजना": "yojana",
    "प्रश्नोत्तरी": "quiz",
    "नोटिफिकेशन": "notification",
    "परिणाम": "result",
    "रणनीति": "strategy",
    "अर्थव्यवस्था": "economics",
    "राजस्थान": "rajasthan",
    "भारत": "india",
    "भर्ती": "recruitment",
    "महत्वपूर्ण": "important",
    "प्रारंभिक": "prelims",
    "मुख्य": "mains",
    "निष्कर्ष": "conclusion",
    "मार्गदर्शन": "guidance"
  };

  let clean = title.trim();
  for (const [hindi, latin] of Object.entries(translitMap)) {
    clean = clean.split(hindi).join(` ${latin} `);
  }

  let slug = clean
    .toLowerCase()
    .replace(/[^\w\s\u0900-\u097F-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/--+/g, "-")
    .trim();

  slug = slug
    .replace(/[\u0900-\u097F]+/g, (match) => {
      let hash = 0;
      for (let i = 0; i < match.length; i++) hash = (hash << 5) - hash + match.charCodeAt(i);
      return `hi-${Math.abs(hash).toString(36).substring(0, 5)}`;
    })
    .replace(/^-+|-+$/g, "");

  if (!slug || slug === "hi") {
    slug = `article-${Date.now().toString(36)}`;
  }

  return slug.substring(0, 80);
}

/**
 * Detect language of the text: Hindi, English, or Both
 */
export function detectLanguage(text: string): "Hindi" | "English" | "Both" {
  const devanagariMatches = (text.match(/[\u0900-\u097F]/g) || []).length;
  const latinMatches = (text.match(/[a-zA-Z]/g) || []).length;

  if (devanagariMatches > 40 && latinMatches > 40) return "Both";
  if (devanagariMatches > latinMatches) return "Hindi";
  return "English";
}

/**
 * Extract keywords & search intent
 */
export function extractKeywordsAndIntent(text: string, title: string): {
  focusKeyword: string;
  tags: string[];
  searchIntent: DetectedArticleMetadata["searchIntent"];
  category: string;
} {
  const lower = (title + " " + text).toLowerCase();

  let searchIntent: DetectedArticleMetadata["searchIntent"] = "General Educational";
  if (lower.includes("notification") || lower.includes("vigyapti") || lower.includes("विज्ञप्ति") || lower.includes("भर्ती") || lower.includes("date") || lower.includes("तारीख")) {
    searchIntent = "Exam Alert";
  } else if (lower.includes("syllabus") || lower.includes("पाठ्यक्रम") || lower.includes("pattern") || lower.includes("मार्किंग")) {
    searchIntent = "Syllabus Breakdown";
  } else if (lower.includes("strategy") || lower.includes("how to prepare") || lower.includes("रणनीति") || lower.includes("tips") || lower.includes("टाइम टेबल")) {
    searchIntent = "Study Strategy";
  } else if (lower.includes("survey") || lower.includes("economics") || lower.includes("बजट") || lower.includes("योजना") || lower.includes("जीडीपी")) {
    searchIntent = "Comprehensive Guide";
  }

  let category = "General";
  if (lower.includes("ras") || lower.includes("rpsc") || lower.includes("rsmssb") || lower.includes("cet") || lower.includes("rajasthan")) {
    category = "Exam Notification";
  }
  if (lower.includes("economics") || lower.includes("survey") || lower.includes("budget") || lower.includes("अर्थव्यवस्था") || lower.includes("आर्थिक समीक्षा")) {
    category = "Economics & Survey";
  } else if (lower.includes("strategy") || lower.includes("tips") || lower.includes("guide")) {
    category = "Study Strategy";
  } else if (lower.includes("current") || lower.includes("samayiki") || lower.includes("समसामयिकी")) {
    category = "Current Affairs";
  }

  const tagCandidates = [
    "RPSC RAS",
    "RAS Pre 2025",
    "RSMSSB CET",
    "Rajasthan Economy",
    "Economic Survey",
    "Current Affairs",
    "Exam Strategy",
    "Study Notes",
    "Syllabus & Pattern",
    "Mock Test Guide",
    "Previous Year Papers"
  ];

  const matchedTags: string[] = [];
  tagCandidates.forEach(tag => {
    if (lower.includes(tag.toLowerCase())) {
      matchedTags.push(tag);
    }
  });

  if (matchedTags.length === 0) {
    matchedTags.push("Exam Preparation", "Competitive Exams");
  }

  const cleanTitleWords = title
    .replace(/[^\w\s\u0900-\u097F]/g, "")
    .split(/\s+/)
    .filter(w => w.length > 3 && !["this", "that", "with", "from", "your", "guide", "कैलेंडर", "और", "का", "की", "के"].includes(w.toLowerCase()));

  const focusKeyword = cleanTitleWords.slice(0, 3).join(" ") || "Exam Preparation Guide";

  return {
    focusKeyword,
    tags: matchedTags.slice(0, 5),
    searchIntent,
    category
  };
}

/**
 * Check for duplicate or similar articles
 */
export function checkDuplicateArticle(
  title: string,
  slug: string,
  content: string,
  existingArticles: NewsArticle[] = []
): DuplicateDetectionResult | null {
  if (!existingArticles || existingArticles.length === 0) return null;

  const normSlug = slug.toLowerCase().trim();
  const normTitle = title.toLowerCase().trim();

  for (const art of existingArticles) {
    if (art.slug && art.slug.toLowerCase().trim() === normSlug) {
      return {
        isDuplicate: true,
        matchType: "exact_slug",
        matchedArticleTitle: art.title,
        matchedArticleId: art.id,
        similarityScore: 100
      };
    }

    const artTitle = art.title.toLowerCase().trim();
    if (artTitle === normTitle) {
      return {
        isDuplicate: true,
        matchType: "similar_title",
        matchedArticleTitle: art.title,
        matchedArticleId: art.id,
        similarityScore: 100
      };
    }

    const titleWordsA = new Set(normTitle.split(/\s+/).filter(w => w.length > 2));
    const titleWordsB = new Set(artTitle.split(/\s+/).filter(w => w.length > 2));
    if (titleWordsA.size > 0 && titleWordsB.size > 0) {
      let intersection = 0;
      titleWordsA.forEach(w => {
        if (titleWordsB.has(w)) intersection++;
      });
      const dice = (2 * intersection) / (titleWordsA.size + titleWordsB.size);
      if (dice > 0.75) {
        return {
          isDuplicate: true,
          matchType: "similar_title",
          matchedArticleTitle: art.title,
          matchedArticleId: art.id,
          similarityScore: Math.round(dice * 100)
        };
      }
    }
  }

  return null;
}

/**
 * Find internal linking suggestions based on existing published articles
 */
export function findInternalLinkingSuggestions(
  text: string,
  existingArticles: NewsArticle[] = []
): InternalLinkSuggestion[] {
  if (!existingArticles || existingArticles.length === 0) return [];

  const lowerContent = text.toLowerCase();
  const suggestions: InternalLinkSuggestion[] = [];

  for (const art of existingArticles) {
    if (art.status !== "published" || !art.title) continue;

    const titleLower = art.title.toLowerCase();
    if (lowerContent.includes(titleLower)) {
      suggestions.push({
        articleId: art.id,
        title: art.title,
        slug: art.slug,
        category: art.category,
        matchedKeyword: art.title
      });
      continue;
    }

    if (art.focusKeyword && art.focusKeyword.length > 3) {
      const kwLower = art.focusKeyword.toLowerCase();
      if (lowerContent.includes(kwLower)) {
        suggestions.push({
          articleId: art.id,
          title: art.title,
          slug: art.slug,
          category: art.category,
          matchedKeyword: art.focusKeyword
        });
      }
    }
  }

  return suggestions.slice(0, 5);
}

/**
 * Generates Google-compliant JSON-LD structured data (Article, FAQPage, BreadcrumbList)
 */
export function generateArticleJsonLd(article: Partial<NewsArticle>): Record<string, any> {
  const siteUrl = window.location.origin || "https://disha2020.in";
  const articleUrl = `${siteUrl}/news/${article.slug || "article"}`;
  const nowIso = new Date().toISOString();

  const graphs: any[] = [
    {
      "@type": "NewsArticle",
      "@id": `${articleUrl}#article`,
      "isPartOf": {
        "@type": "WebSite",
        "@id": `${siteUrl}#website`,
        "name": "DISHA 20-20 Exam Prep",
        "url": siteUrl
      },
      "headline": article.title || "Exam Preparation Guide",
      "name": article.title || "Exam Preparation Guide",
      "description": article.seoDescription || article.excerpt || "",
      "url": articleUrl,
      "datePublished": article.publishedAt || article.createdAt || nowIso,
      "dateModified": article.updatedAt || nowIso,
      "inLanguage": article.language === "Hindi" ? "hi-IN" : "en-IN",
      "mainEntityOfPage": articleUrl,
      "image": [
        article.coverImageUrl || "https://images.unsplash.com/photo-1457369804613-52c61a468e7d?auto=format&fit=crop&w=1200&q=80"
      ],
      "author": {
        "@type": "Person",
        "name": article.authorName || "DISHA 20-20 Editorial Team"
      },
      "publisher": {
        "@type": "Organization",
        "name": "DISHA 20-20 Exam Prep",
        "url": siteUrl,
        "logo": {
          "@type": "ImageObject",
          "url": `${siteUrl}/logo.png`
        }
      },
      "keywords": (article.tags || []).join(", ")
    },
    {
      "@type": "BreadcrumbList",
      "@id": `${articleUrl}#breadcrumb`,
      "itemListElement": [
        {
          "@type": "ListItem",
          "position": 1,
          "name": "Home",
          "item": siteUrl
        },
        {
          "@type": "ListItem",
          "position": 2,
          "name": article.category || "News",
          "item": `${siteUrl}/news`
        },
        {
          "@type": "ListItem",
          "position": 3,
          "name": article.title,
          "item": articleUrl
        }
      ]
    }
  ];

  if (article.faqs && article.faqs.length > 0) {
    graphs.push({
      "@type": "FAQPage",
      "@id": `${articleUrl}#faq`,
      "mainEntity": article.faqs.map(faq => ({
        "@type": "Question",
        "name": faq.question,
        "acceptedAnswer": {
          "@type": "Answer",
          "text": faq.answer
        }
      }))
    });
  }

  return {
    "@context": "https://schema.org",
    "@graph": graphs
  };
}

/**
 * Calculates a comprehensive SEO Score (0-100) and actionable checklist
 */
export function calculateSeoAudit(article: Partial<NewsArticle>): {
  score: number;
  checks: SEOAuditCheck[];
} {
  const checks: SEOAuditCheck[] = [];
  let earnedScore = 0;

  // 1. Title Length
  const titleLen = (article.title || "").trim().length;
  if (titleLen >= 30 && titleLen <= 70) {
    checks.push({
      id: "title_length",
      label: "Title Length (30-70 characters)",
      passed: true,
      tip: `Optimal title length (${titleLen} chars) prevents SERP truncation.`,
      severity: "good"
    });
    earnedScore += 15;
  } else {
    checks.push({
      id: "title_length",
      label: "Title Length (30-70 characters)",
      passed: false,
      tip: titleLen < 30 ? `Title is too short (${titleLen} chars). Add exam year or descriptive context.` : `Title is too long (${titleLen} chars) and may be truncated on Google.`,
      severity: titleLen === 0 ? "error" : "warning"
    });
    if (titleLen > 15) earnedScore += 5;
  }

  // 2. Meta Description
  const metaDescLen = (article.seoDescription || article.excerpt || "").trim().length;
  if (metaDescLen >= 110 && metaDescLen <= 160) {
    checks.push({
      id: "meta_desc",
      label: "Meta Description (110-160 characters)",
      passed: true,
      tip: `Great SERP snippet summary (${metaDescLen} chars).`,
      severity: "good"
    });
    earnedScore += 15;
  } else {
    checks.push({
      id: "meta_desc",
      label: "Meta Description (110-160 characters)",
      passed: false,
      tip: metaDescLen < 110 ? `Meta description is short (${metaDescLen} chars). Aim for 120-160 chars with key benefits.` : `Meta description exceeds 160 characters (${metaDescLen} chars).`,
      severity: metaDescLen === 0 ? "error" : "warning"
    });
    if (metaDescLen > 50) earnedScore += 5;
  }

  // 3. Focus Keyword in Title
  const focusKw = (article.focusKeyword || "").trim().toLowerCase();
  const titleLower = (article.title || "").toLowerCase();
  if (focusKw && titleLower.includes(focusKw)) {
    checks.push({
      id: "keyword_in_title",
      label: "Focus Keyword in Title",
      passed: true,
      tip: `Focus keyword "${article.focusKeyword}" is present in the main title.`,
      severity: "good"
    });
    earnedScore += 15;
  } else {
    checks.push({
      id: "keyword_in_title",
      label: "Focus Keyword in Title",
      passed: false,
      tip: focusKw ? `Include "${article.focusKeyword}" near the beginning of your title.` : "Specify a primary focus keyword.",
      severity: "warning"
    });
  }

  // 4. URL Slug Format
  const slug = (article.slug || "").trim();
  const slugValid = slug.length > 3 && !slug.includes(" ") && !/[A-Z]/.test(slug) && !slug.includes("--");
  if (slugValid) {
    checks.push({
      id: "slug_clean",
      label: "Clean & Canonical URL Slug",
      passed: true,
      tip: `Slug "/news/${slug}" is clean and crawlable.`,
      severity: "good"
    });
    earnedScore += 10;
  } else {
    checks.push({
      id: "slug_clean",
      label: "Clean & Canonical URL Slug",
      passed: false,
      tip: "Slug should be lowercase with hyphens, without special symbols or spaces.",
      severity: "error"
    });
  }

  // 5. Headings Structure (H1, H2, H3, H4)
  const blocks = article.blocks || [];
  const h2Count = blocks.filter(b => b.type === "heading" && b.level === 2).length;
  const h3Count = blocks.filter(b => b.type === "heading" && b.level === 3).length;
  const h4Count = blocks.filter(b => b.type === "heading" && b.level === 4).length;
  if (h2Count >= 2) {
    checks.push({
      id: "heading_hierarchy",
      label: `Heading Hierarchy (${h2Count} H2s, ${h3Count} H3s, ${h4Count} H4s)`,
      passed: true,
      tip: "Solid semantic outline for search crawlers.",
      severity: "good"
    });
    earnedScore += 15;
  } else {
    checks.push({
      id: "heading_hierarchy",
      label: "Heading Hierarchy (At least 2 H2 sections)",
      passed: false,
      tip: "Break article into at least 2 distinct H2 sub-sections for better readability.",
      severity: "warning"
    });
    if (h2Count === 1) earnedScore += 7;
  }

  // 6. Structured Content Sections (Intro, Conclusion, Table, Key Points)
  const hasIntro = blocks.some(b => b.type === "intro");
  const hasConclusion = blocks.some(b => b.type === "conclusion");
  const hasTable = blocks.some(b => b.type === "table");
  const hasKeyPoints = blocks.some(b => b.type === "key_points" || b.type === "callout");
  const hasCta = blocks.some(b => b.type === "cta");

  if ((hasIntro || hasConclusion) && (hasTable || hasKeyPoints)) {
    checks.push({
      id: "structured_blocks",
      label: "SEO Section Completeness (Intro, Highlights, Table, Conclusion)",
      passed: true,
      tip: "Rich structural mix provides maximum user dwell time and SEO value.",
      severity: "good"
    });
    earnedScore += 15;
  } else {
    checks.push({
      id: "structured_blocks",
      label: "Structured Sections",
      passed: false,
      tip: "Include an explicit Intro hook, Key Points table/box, and Conclusion takeaway.",
      severity: "warning"
    });
    if (hasTable || hasKeyPoints) earnedScore += 7;
  }

  // 7. FAQ Section for Rich Snippets
  const faqCount = (article.faqs || []).length;
  if (faqCount >= 2) {
    checks.push({
      id: "faq_schema",
      label: `FAQ Section (${faqCount} Q&As with FAQPage Schema)`,
      passed: true,
      tip: "Eligible for Google FAQ Accordion rich snippets.",
      severity: "good"
    });
    earnedScore += 10;
  } else {
    checks.push({
      id: "faq_schema",
      label: "FAQ Section (At least 2 Q&As)",
      passed: false,
      tip: "Include FAQs to win Google search answer boxes.",
      severity: "warning"
    });
    if (faqCount === 1) earnedScore += 5;
  }

  // 8. Featured Cover Image & CTA
  if (article.coverImageUrl && hasCta) {
    checks.push({
      id: "featured_image_cta",
      label: "Visual Cover Image & Call-to-Action (CTA)",
      passed: true,
      tip: "Cover image configured and conversion CTA active.",
      severity: "good"
    });
    earnedScore += 10;
  } else {
    checks.push({
      id: "featured_image_cta",
      label: "Visual Cover Image & CTA",
      passed: false,
      tip: "Add cover image and high-converting CTA button.",
      severity: "warning"
    });
    if (article.coverImageUrl || hasCta) earnedScore += 5;
  }

  const finalScore = Math.min(100, Math.max(10, earnedScore));
  return { score: finalScore, checks };
}

/**
 * Smart Text Parser: Converts raw text/markdown into structured blocks, SEO fields, tables, FAQs, etc.
 */
export function parseSmartText(
  rawInput: string,
  existingArticles: NewsArticle[] = [],
  customRules: AutoLinkRule[] = []
): ParsedImportResult {
  const text = rawInput.trim();
  const lines = text.split(/\r?\n/);
  
  let detectedTitle = "";
  let detectedHindiTitle = "";
  const blocks: ArticleBlock[] = [];
  const extractedFaqs: FAQItem[] = [];

  let lineIdx = 0;

  // 1. Detect Title from first non-empty lines
  while (lineIdx < lines.length && !lines[lineIdx].trim()) lineIdx++;

  if (lineIdx < lines.length) {
    const firstLine = lines[lineIdx].trim();
    if (firstLine.startsWith("# ")) {
      detectedTitle = firstLine.replace(/^#\s+/, "").trim();
      lineIdx++;
    } else if (firstLine.toLowerCase().startsWith("title:") || firstLine.startsWith("शीर्षक:")) {
      detectedTitle = firstLine.replace(/^(title|शीर्षक):\s*/i, "").trim();
      lineIdx++;
    } else if (firstLine.length > 5 && firstLine.length < 120 && !firstLine.startsWith("|") && !firstLine.startsWith("-")) {
      detectedTitle = firstLine.replace(/^\*+|\*+$/g, "").trim();
      lineIdx++;
    }
  }

  // Check if second line is a Hindi translation or subtitle
  if (lineIdx < lines.length) {
    const secondLine = lines[lineIdx].trim();
    if (secondLine.toLowerCase().startsWith("hindi title:") || secondLine.startsWith("हिंदी शीर्षक:")) {
      detectedHindiTitle = secondLine.replace(/^(hindi title|हिंदी शीर्षक):\s*/i, "").trim();
      lineIdx++;
    } else if (/[\u0900-\u097F]/.test(secondLine) && secondLine.length < 100 && !secondLine.startsWith("-") && !secondLine.startsWith("|")) {
      detectedHindiTitle = secondLine;
      lineIdx++;
    }
  }

  if (!detectedTitle) {
    detectedTitle = "Exam Preparation & Comprehensive Syllabus Guide";
  }

  let tableCount = 0;
  let keyPointsCount = 0;
  let ctaDetected = false;
  let introDetected = false;
  let conclusionDetected = false;
  let h1Count = 1;
  let h2Count = 0;
  let h3Count = 0;
  let h4Count = 0;

  // Track if we have encountered the first major heading (H2)
  let seenFirstSectionHeading = false;

  // Process remaining content lines
  while (lineIdx < lines.length) {
    const rawLine = lines[lineIdx];
    const line = rawLine.trim();

    if (!line) {
      lineIdx++;
      continue;
    }

    // A. Detect FAQ Section
    const isFaqHeader = /^(###?|\*\*|)(faq|faqs|frequently asked questions|अक्सर पूछे जाने वाले प्रश्न|सवाल और जवाब)/i.test(line);
    if (isFaqHeader) {
      seenFirstSectionHeading = true;
      lineIdx++;
      while (lineIdx < lines.length) {
        const fLine = lines[lineIdx].trim();
        if (!fLine) {
          lineIdx++;
          continue;
        }
        if (/^##\s+/.test(fLine) && !/faq/i.test(fLine)) break;

        const qMatch = fLine.match(/^(?:Q\d*[:.]|\*\*Q\d*[:.]\*\*|प्रश्न\s*\d*[:.]|\*\*प्रश्न\s*\d*[:.]\*\*|###?\s*)(.+)/i);
        if (qMatch) {
          const questionText = qMatch[1].replace(/\*\*$/, "").trim();
          lineIdx++;
          let answerText = "";
          while (lineIdx < lines.length) {
            const aLine = lines[lineIdx].trim();
            if (!aLine) {
              lineIdx++;
              if (answerText) break;
              continue;
            }
            if (/^(?:Q\d*[:.]|\*\*Q\d*[:.]\*\*|प्रश्न\s*\d*[:.]|###?\s*)/i.test(aLine)) {
              break;
            }
            const aMatch = aLine.match(/^(?:A\d*[:.]|\*\*A\d*[:.]\*\*|उत्तर\s*\d*[:.]|\*\*उत्तर\s*\d*[:.]\*\*)\s*(.+)/i);
            if (aMatch) {
              answerText += (answerText ? " " : "") + aMatch[1].trim();
            } else {
              answerText += (answerText ? " " : "") + aLine;
            }
            lineIdx++;
          }
          if (questionText && answerText) {
            extractedFaqs.push({
              question: questionText,
              answer: answerText
            });
          }
        } else {
          lineIdx++;
        }
      }
      continue;
    }

    // B. Detect Tables (Markdown tables: Format A, Format B, Format C, GFM, or Tab-separated columns)
    const isTableCandidate = parseTableRowCells(line) !== null || isTableSeparatorRow(line);
    if (isTableCandidate) {
      const tableLines: string[] = [];
      let lookaheadIdx = lineIdx;
      while (
        lookaheadIdx < lines.length &&
        lines[lookaheadIdx].trim() &&
        (parseTableRowCells(lines[lookaheadIdx]) !== null || isTableSeparatorRow(lines[lookaheadIdx]))
      ) {
        tableLines.push(lines[lookaheadIdx].trim());
        lookaheadIdx++;
      }

      if (tableLines.length >= 2) {
        const parsedTable = parseMarkdownTableLines(tableLines);
        if (parsedTable && (parsedTable.rows.length > 0 || parsedTable.headers.length > 0)) {
          blocks.push({
            id: `blk_tbl_${Date.now()}_${blocks.length}`,
            type: "table",
            tableHeaders: parsedTable.headers,
            tableRows: parsedTable.rows,
            tableAlignments: parsedTable.alignments.length > 0 ? parsedTable.alignments : undefined
          });
          tableCount++;
          lineIdx = lookaheadIdx;
          continue;
        }
      }
    }

    // C. Detect Headings (H1, H2, H3, H4)
    if (line.startsWith("# ")) {
      h1Count++;
      seenFirstSectionHeading = true;
      blocks.push({
        id: `blk_h1_${Date.now()}_${blocks.length}`,
        type: "heading",
        level: 1,
        text: line.replace(/^#\s+/, "").trim()
      });
      lineIdx++;
      continue;
    }

    if (line.startsWith("## ")) {
      h2Count++;
      seenFirstSectionHeading = true;
      blocks.push({
        id: `blk_h2_${Date.now()}_${blocks.length}`,
        type: "heading",
        level: 2,
        text: line.replace(/^##\s+/, "").trim()
      });
      lineIdx++;
      continue;
    }

    if (line.startsWith("### ")) {
      h3Count++;
      seenFirstSectionHeading = true;
      blocks.push({
        id: `blk_h3_${Date.now()}_${blocks.length}`,
        type: "heading",
        level: 3,
        text: line.replace(/^###\s+/, "").trim()
      });
      lineIdx++;
      continue;
    }

    if (line.startsWith("#### ")) {
      h4Count++;
      seenFirstSectionHeading = true;
      blocks.push({
        id: `blk_h4_${Date.now()}_${blocks.length}`,
        type: "heading",
        level: 4,
        text: line.replace(/^####\s+/, "").trim()
      });
      lineIdx++;
      continue;
    }

    // Numbered or bold standalone headings:
    // e.g. **1. Overview** or 1. Exam Pattern -> H2
    // e.g. **1.1 Details** -> H3
    // e.g. **1.1.1 Sub-item** -> H4
    const numSubHeadingMatch = line.match(/^\*?(\d+\.\d+\.\d+\.?\s+[^:\n]+)\*?$/);
    if (numSubHeadingMatch) {
      h4Count++;
      seenFirstSectionHeading = true;
      blocks.push({
        id: `blk_h4_${Date.now()}_${blocks.length}`,
        type: "heading",
        level: 4,
        text: numSubHeadingMatch[1].trim()
      });
      lineIdx++;
      continue;
    }

    const numH3Match = line.match(/^\*?(\d+\.\d+\.?\s+[^:\n]+)\*?$/);
    if (numH3Match) {
      h3Count++;
      seenFirstSectionHeading = true;
      blocks.push({
        id: `blk_h3_${Date.now()}_${blocks.length}`,
        type: "heading",
        level: 3,
        text: numH3Match[1].trim()
      });
      lineIdx++;
      continue;
    }

    const numH2Match = line.match(/^\*?(\d+\.?\s+[A-Za-z\u0900-\u097F][^:\n]{3,60})\*?$/);
    if (numH2Match && !line.includes("।") && !line.includes("?") && !line.startsWith("|")) {
      h2Count++;
      seenFirstSectionHeading = true;
      blocks.push({
        id: `blk_h2_${Date.now()}_${blocks.length}`,
        type: "heading",
        level: 2,
        text: numH2Match[1].trim()
      });
      lineIdx++;
      continue;
    }

    // D. Detect Key Points / Highlights Section
    const isKeyPointsHeader = /^(###?|\*\*|)(key points|key highlights|मुख्य बातें|महत्वपूर्ण बिंदु|highlights|key takeaways|महत्वपूर्ण तथ्य|प्रमुख बिंदु)/i.test(line);
    if (isKeyPointsHeader) {
      lineIdx++;
      const items: string[] = [];
      while (lineIdx < lines.length) {
        const kLine = lines[lineIdx].trim();
        if (!kLine) {
          lineIdx++;
          continue;
        }
        if (kLine.startsWith("#") || kLine.startsWith("|") || /^\d+\.\s+[A-Z]/.test(kLine)) break;
        if (kLine.startsWith("* ") || kLine.startsWith("- ") || kLine.startsWith("• ") || /^\d+\.\s+/.test(kLine)) {
          items.push(kLine.replace(/^[*|-|•]\s+|\d+\.\s+/, "").trim());
          lineIdx++;
        } else if (items.length > 0) {
          break;
        } else {
          items.push(kLine);
          lineIdx++;
          break;
        }
      }
      if (items.length > 0) {
        blocks.push({
          id: `blk_kp_${Date.now()}_${blocks.length}`,
          type: "key_points",
          listItems: items
        });
        keyPointsCount++;
      }
      continue;
    }

    // E. Detect Conclusion Section
    const isConclusionHeader = /^(##|###|\*\*)?\s*(conclusion|निष्कर्ष|final thoughts|summary|wrapping up|सारांश|अंतिम निष्कर्ष|way forward|आगे की राह)/i.test(line);
    if (isConclusionHeader) {
      conclusionDetected = true;
      lineIdx++;
      let conclusionText = "";
      while (lineIdx < lines.length) {
        const cLine = lines[lineIdx].trim();
        if (!cLine) {
          lineIdx++;
          if (conclusionText) break;
          continue;
        }
        if (cLine.startsWith("#") || cLine.startsWith("|") || /^(faq|cta|join|attempt)/i.test(cLine)) break;
        conclusionText += (conclusionText ? " " : "") + cLine;
        lineIdx++;
      }
      if (conclusionText) {
        blocks.push({
          id: `blk_conclusion_${Date.now()}_${blocks.length}`,
          type: "conclusion",
          text: conclusionText
        });
      }
      continue;
    }

    // F. Detect Call to Action (CTA)
    const isCtaLine = /^(join|attempt|start test|डाउनलोड करें|टेस्ट दें|तैयारी शुरू करें|click here to practice|take free test)/i.test(line);
    if (isCtaLine) {
      ctaDetected = true;
      blocks.push({
        id: `blk_cta_${Date.now()}_${blocks.length}`,
        type: "cta",
        ctaText: line.replace(/[*_#]/g, "").trim(),
        ctaUrl: "/live_tests"
      });
      lineIdx++;
      continue;
    }

    // G. Detect Callout / Important Note
    if (line.startsWith("> ") || /^(\*\*note|\*\*warning|\*\*important|ध्यान दें|महत्वपूर्ण:)/i.test(line)) {
      const calloutText = line.replace(/^>\s*|^\*\*(note|warning|important):\*\*\s*|^ध्यान दें:\s*|^महत्वपूर्ण:\s*/i, "").trim();
      blocks.push({
        id: `blk_callout_${Date.now()}_${blocks.length}`,
        type: "callout",
        calloutType: line.toLowerCase().includes("warn") ? "warning" : "important",
        text: calloutText
      });
      lineIdx++;
      continue;
    }

    // H. Detect Bullet Lists
    if (line.startsWith("* ") || line.startsWith("- ") || line.startsWith("• ")) {
      const listItems: string[] = [];
      while (lineIdx < lines.length && (lines[lineIdx].trim().startsWith("* ") || lines[lineIdx].trim().startsWith("- ") || lines[lineIdx].trim().startsWith("• "))) {
        listItems.push(lines[lineIdx].trim().replace(/^[*|-|•]\s+/, ""));
        lineIdx++;
      }
      blocks.push({
        id: `blk_list_${Date.now()}_${blocks.length}`,
        type: "list",
        listType: "bullet",
        listItems
      });
      continue;
    }

    // I. Detect Numbered Lists
    if (/^\d+\.\s+/.test(line)) {
      const listItems: string[] = [];
      while (lineIdx < lines.length && /^\d+\.\s+/.test(lines[lineIdx].trim())) {
        listItems.push(lines[lineIdx].trim().replace(/^\d+\.\s+/, ""));
        lineIdx++;
      }
      blocks.push({
        id: `blk_list_${Date.now()}_${blocks.length}`,
        type: "list",
        listType: "numbered",
        listItems
      });
      continue;
    }

    // J. Paragraph: Check if it's the Intro Hook or Standard Paragraph
    const isExplicitIntro = /^(introduction|परिचय|प्रस्तावना|overview|भूमिका):/i.test(line);
    if (isExplicitIntro || (!seenFirstSectionHeading && !introDetected && blocks.length <= 1)) {
      introDetected = true;
      const cleanIntroText = line.replace(/^(introduction|परिचय|प्रस्तावना|overview|भूमिका):\s*/i, "");
      blocks.push({
        id: `blk_intro_${Date.now()}_${blocks.length}`,
        type: "intro",
        text: cleanIntroText
      });
      lineIdx++;
      continue;
    }

    // Standard Paragraph
    blocks.push({
      id: `blk_p_${Date.now()}_${blocks.length}`,
      type: "paragraph",
      text: line
    });
    lineIdx++;
  }

  // If FAQs were extracted, attach an explicit FAQ block
  if (extractedFaqs.length > 0) {
    blocks.push({
      id: `blk_faq_${Date.now()}`,
      type: "faq",
      faqs: extractedFaqs
    });
  }

  // If no CTA was explicitly present, automatically append a smart conversion CTA
  if (!ctaDetected) {
    blocks.push({
      id: `blk_cta_auto_${Date.now()}`,
      type: "cta",
      ctaText: `Attempt DISHA 20-20 Full Mock Test & Chapter MCQs for ${detectedTitle.split(":")[0]}`,
      ctaUrl: "/live_tests"
    });
    ctaDetected = true;
  }

  // Automatically inject internal & external links into article blocks
  const autoLinksResult = autoInjectLinksToArticleBlocks(blocks, existingArticles, customRules);
  const finalBlocks = autoLinksResult.blocks;

  // Compute text statistics
  const fullExtractedContent = finalBlocks.map(b => b.text || (b.listItems || []).join(" ") || "").join(" ");
  const wordCount = fullExtractedContent.trim().split(/\s+/).filter(Boolean).length;
  const readingTimeMinutes = Math.max(1, Math.ceil(wordCount / 180));
  const language = detectLanguage(detectedTitle + " " + fullExtractedContent);

  // Excerpt & Meta Description
  const introBlock = finalBlocks.find(b => b.type === "intro" || b.type === "paragraph");
  const firstParagraph = introBlock?.text || "";
  const excerpt = firstParagraph.length > 150 ? firstParagraph.substring(0, 147) + "..." : firstParagraph || `${detectedTitle} - Complete breakdown, official pattern, and high-yield notes.`;

  // Keywords and Intent
  const kwResult = extractKeywordsAndIntent(fullExtractedContent, detectedTitle);
  const slug = generateSmartSlug(detectedTitle);

  let seoTitle = detectedTitle;
  if (seoTitle.length < 40) {
    seoTitle = `${detectedTitle} | Complete Guide & Notes`;
  }
  let seoDescription = excerpt;
  if (seoDescription.length < 110) {
    seoDescription = `${detectedTitle}. Check official syllabus, important exam dates, key points, eligibility criteria, and preparation strategy on DISHA 20-20.`;
  }
  if (seoDescription.length > 160) {
    seoDescription = seoDescription.substring(0, 157) + "...";
  }

  const articleDraft: Partial<NewsArticle> = {
    title: detectedTitle,
    hindiTitle: detectedHindiTitle || undefined,
    slug,
    category: kwResult.category,
    language,
    excerpt,
    content: fullExtractedContent,
    blocks: finalBlocks,
    status: "published",
    authorName: "DISHA 20-20 Editorial Team",
    focusKeyword: kwResult.focusKeyword,
    seoTitle,
    seoDescription,
    tags: kwResult.tags,
    faqs: extractedFaqs,
    coverImageUrl: "https://images.unsplash.com/photo-1457369804613-52c61a468e7d?auto=format&fit=crop&w=1200&q=80",
    featuredImageAlt: `${detectedTitle} overview banner`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    publishedAt: new Date().toISOString()
  };

  const detectedMeta: DetectedArticleMetadata = {
    wordCount,
    readingTimeMinutes,
    language,
    searchIntent: kwResult.searchIntent,
    headingsCount: { h1: h1Count, h2: h2Count, h3: h3Count, h4: h4Count },
    tablesCount: tableCount,
    faqCount: extractedFaqs.length,
    keyPointsCount,
    ctaDetected,
    introDetected,
    conclusionDetected,
    internalLinksDetected: autoLinksResult.internalLinksCount,
    externalLinksDetected: autoLinksResult.externalLinksCount,
    injectedLinksSummary: autoLinksResult.injectedLinksSummary
  };

  const seoAudit = calculateSeoAudit(articleDraft);
  const internalLinkingSuggestions = findInternalLinkingSuggestions(fullExtractedContent, existingArticles);
  const duplicateWarning = checkDuplicateArticle(detectedTitle, slug, fullExtractedContent, existingArticles);
  const jsonLdSchema = generateArticleJsonLd(articleDraft);

  return {
    article: articleDraft,
    detectedMeta,
    seoAudit,
    internalLinkingSuggestions,
    duplicateWarning,
    jsonLdSchema,
    rawExtractedText: text
  };
}

/**
 * Smart HTML Parser: Parses semantic HTML nodes into rich blocks and structures
 */
export function parseSmartHtml(
  rawHtml: string,
  existingArticles: NewsArticle[] = [],
  customRules: AutoLinkRule[] = []
): ParsedImportResult {
  // Support isomorphic / ESM environments (Node.js Vitest and Browser)
  const purify =
    (DOMPurify as any)?.sanitize
      ? DOMPurify
      : (DOMPurify as any)?.default?.sanitize
      ? (DOMPurify as any).default
      : typeof DOMPurify === "function" && typeof window !== "undefined"
      ? (DOMPurify as any)(window)
      : null;

  // Preserve any custom embedded <style> tags from rawHtml if sanitized by DOMPurify
  const styleMatches = rawHtml.match(/<style[\s\S]*?<\/style>/gi) || [];
  const preservedStyles = styleMatches.join("\n");

  const sanitizeOptions = {
    USE_PROFILES: { html: true },
    FORCE_BODY: false,
    ADD_TAGS: [
      "table", "thead", "tbody", "tr", "th", "td",
      "h1", "h2", "h3", "h4", "h5", "h6",
      "dl", "dt", "dd", "style", "div", "span", "section", "article",
      "p", "strong", "em", "b", "i", "u", "br", "hr", "ul", "ol", "li",
      "blockquote", "code", "pre", "details", "summary", "a", "img", "iframe"
    ],
    ADD_ATTR: [
      "class", "id", "style", "target", "rel", "href", "src", "alt",
      "title", "width", "height", "frameborder", "allowfullscreen"
    ]
  };

  let cleanHtml =
    purify && typeof purify.sanitize === "function"
      ? purify.sanitize(rawHtml, sanitizeOptions)
      : rawHtml;

  if (preservedStyles && !cleanHtml.includes("<style")) {
    cleanHtml = `${preservedStyles}\n${cleanHtml}`;
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(cleanHtml, "text/html");

  let detectedTitle = "";
  const blocks: ArticleBlock[] = [];
  const extractedFaqs: FAQItem[] = [];

  const h1El = doc.querySelector("h1");
  if (h1El && h1El.textContent?.trim()) {
    detectedTitle = h1El.textContent.trim();
  } else {
    const titleTag = doc.querySelector("title");
    if (titleTag && titleTag.textContent?.trim()) {
      detectedTitle = titleTag.textContent.trim();
    } else {
      const firstH2 = doc.querySelector("h2");
      const leadStrong = doc.querySelector(".lead strong, p.lead strong, .note strong");
      if (leadStrong && leadStrong.textContent?.trim()) {
        detectedTitle = `${leadStrong.textContent.trim()} — संपूर्ण गाइड व PYQ`;
      } else if (firstH2 && firstH2.textContent?.trim()) {
        detectedTitle = firstH2.textContent.trim();
      }
    }
  }

  // Graceful fallback if no explicit title tag/h1/h2 could be extracted
  if (!detectedTitle || detectedTitle === "Untitled Article") {
    const firstP = doc.querySelector("p");
    if (firstP && firstP.textContent?.trim()) {
      const pText = firstP.textContent.trim();
      const firstSentence = pText.split(/[।\.?!]/)[0]?.trim();
      if (firstSentence && firstSentence.length > 8 && firstSentence.length < 90) {
        detectedTitle = firstSentence;
      } else if (firstSentence && firstSentence.length >= 90) {
        detectedTitle = firstSentence.substring(0, 80) + "...";
      }
    }
  }
  if (!detectedTitle || detectedTitle === "Untitled Article") {
    detectedTitle = "राजस्थान भर्ती परीक्षा: संपूर्ण गाइड व PYQ नोट्स";
  }

  // Detect explicit custom excerpt from .lead or .intro
  const leadEl = doc.querySelector(".lead, .intro, p.lead");
  let customExcerpt = "";
  if (leadEl && leadEl.textContent?.trim()) {
    customExcerpt = leadEl.textContent.trim();
  }

  // Flatten top-level wrapper elements (e.g. <div class="rx">, <div class="container">, <article>)
  // so that child elements (lead, note, h2, table, ul, card) are parsed into individual semantic blocks
  let bodyNodes: Element[] = [];
  const rawChildren = Array.from(doc.body.children).filter(el => el.tagName.toLowerCase() !== "style");

  if (rawChildren.length === 1 && ["div", "article", "section", "main"].includes(rawChildren[0].tagName.toLowerCase())) {
    bodyNodes = Array.from(rawChildren[0].children);
  } else if (rawChildren.length > 0 && rawChildren.every(c => c.tagName.toLowerCase() === "div" && c.children.length > 1)) {
    bodyNodes = rawChildren.flatMap(c => Array.from(c.children));
  } else {
    bodyNodes = rawChildren;
  }

  let tableCount = 0;
  let keyPointsCount = 0;
  let ctaDetected = false;
  let introDetected = false;
  let conclusionDetected = false;
  let inFaqSection = false;
  let h1Count = 1;
  let h2Count = 0;
  let h3Count = 0;
  let h4Count = 0;

  for (const node of bodyNodes) {
    const tag = node.tagName.toLowerCase();
    const text = node.textContent?.trim() || "";

    if (!text && tag !== "img" && tag !== "hr") continue;

    // H1
    if (tag === "h1") {
      inFaqSection = false;
      if (!detectedTitle) {
        detectedTitle = text;
      } else {
        h1Count++;
        blocks.push({
          id: `blk_h1_${Date.now()}_${blocks.length}`,
          type: "heading",
          level: 1,
          text
        });
      }
      continue;
    }

    // H2
    if (tag === "h2") {
      h2Count++;
      const isFaqHeading = /faq|अक्सर पूछे|सवाल-जवाब|प्रश्न-उत्तर|प्रश्नोत्तर|frequently asked/i.test(text);
      inFaqSection = isFaqHeading;

      blocks.push({
        id: `blk_h2_${Date.now()}_${blocks.length}`,
        type: "heading",
        level: 2,
        text
      });
      continue;
    }

    // H3
    if (tag === "h3") {
      h3Count++;
      const isFaqHeading = /faq|अक्सर पूछे|सवाल-जवाब|प्रश्न-उत्तर|प्रश्नोत्तर|frequently asked/i.test(text);
      if (isFaqHeading) inFaqSection = true;

      blocks.push({
        id: `blk_h3_${Date.now()}_${blocks.length}`,
        type: "heading",
        level: 3,
        text
      });
      continue;
    }

    // H4
    if (tag === "h4") {
      h4Count++;
      blocks.push({
        id: `blk_h4_${Date.now()}_${blocks.length}`,
        type: "heading",
        level: 4,
        text
      });
      continue;
    }

    // If within FAQ section or node contains an FAQ pattern
    if (inFaqSection || node.classList.contains("card")) {
      const strongEl = node.querySelector("strong, b");
      if (strongEl && strongEl.textContent?.trim()) {
        const strongText = strongEl.textContent.trim();
        const hasFaqSignal = inFaqSection || /^[प्रQ][\.\:\s]|प्रश्न|सवाल|\?/i.test(strongText);
        if (hasFaqSignal) {
          const q = strongText.replace(/^[प्रQ]\.\s*|^\d+[\.\)]\s*/i, "");
          const clone = node.cloneNode(true) as HTMLElement;
          const s = clone.querySelector("strong, b");
          if (s) s.remove();
          let a = clone.textContent?.trim() || "";
          a = a.replace(/^[उA]\.\s*|^\:+\s*/i, "").trim();
          if (q && a) {
            extractedFaqs.push({ question: q, answer: a });
            continue;
          }
        }
      }
    }

    // FAQ definition lists (<dl>)
    if (tag === "dl") {
      const dts = Array.from(node.querySelectorAll("dt"));
      const dds = Array.from(node.querySelectorAll("dd"));
      for (let i = 0; i < Math.min(dts.length, dds.length); i++) {
        extractedFaqs.push({
          question: dts[i].textContent?.trim().replace(/^[प्रQ]\.\s*|^\d+[\.\)]\s*/i, "") || "",
          answer: dds[i].textContent?.trim().replace(/^[उA]\.\s*/i, "") || ""
        });
      }
      continue;
    }

    // Note / Callout Box (.note or blockquote)
    if (node.classList.contains("note") || tag === "blockquote") {
      blocks.push({
        id: `blk_callout_${Date.now()}_${blocks.length}`,
        type: "callout",
        calloutType: "info",
        text
      });
      continue;
    }

    // Tags container (.tags)
    if (node.classList.contains("tags")) {
      // Tags are preserved in HTML, skip creating generic block
      continue;
    }

    // Table
    if (tag === "table" || node.querySelector("table")) {
      const tableEl = tag === "table" ? node : node.querySelector("table");
      if (tableEl) {
        const headers: string[] = [];
        const ths = Array.from(tableEl.querySelectorAll("th"));
        if (ths.length > 0) {
          ths.forEach(th => headers.push(th.textContent?.trim() || ""));
        }

        const rows: { cells: string[] }[] = [];
        const trs = Array.from(tableEl.querySelectorAll("tr"));
        trs.forEach(tr => {
          const tds = Array.from(tr.querySelectorAll("td"));
          if (tds.length > 0) {
            rows.push({ cells: tds.map(td => td.textContent?.trim() || "") });
          }
        });

        if (rows.length > 0) {
          let tableHeaders = headers;
          let tableRows = rows;
          if (tableHeaders.length === 0 && rows.length > 0) {
            tableHeaders = rows[0].cells;
            tableRows = rows.slice(1);
          }

          blocks.push({
            id: `blk_tbl_${Date.now()}_${blocks.length}`,
            type: "table",
            tableHeaders,
            tableRows
          });
          tableCount++;
        }
      }
      continue;
    }

    // Lists
    if (tag === "ul" || tag === "ol") {
      const items = Array.from(node.querySelectorAll("li")).map(li => li.textContent?.trim() || "").filter(Boolean);
      if (items.length > 0) {
        const prevBlock = blocks[blocks.length - 1];
        const isHighlightContext = prevBlock && prevBlock.type === "heading" && /key|highlight|मुख्य|points/i.test(prevBlock.text || "");

        if (isHighlightContext) {
          blocks.push({
            id: `blk_kp_${Date.now()}_${blocks.length}`,
            type: "key_points",
            listItems: items
          });
          keyPointsCount++;
        } else {
          blocks.push({
            id: `blk_list_${Date.now()}_${blocks.length}`,
            type: "list",
            listType: tag === "ol" ? "numbered" : "bullet",
            listItems: items
          });
        }
      }
      continue;
    }

    // Paragraph
    const prevBlock = blocks[blocks.length - 1];
    const isConclusionSection = prevBlock && prevBlock.type === "heading" && /conclusion|निष्कर्ष|summary|सारांश/i.test(prevBlock.text || "");
    const isExplicitIntro = node.classList.contains("intro") || node.classList.contains("lead") || (!introDetected && h2Count === 0 && blocks.length <= 1);

    if (isConclusionSection) {
      conclusionDetected = true;
      blocks.push({
        id: `blk_conclusion_${Date.now()}_${blocks.length}`,
        type: "conclusion",
        text
      });
    } else if (isExplicitIntro) {
      introDetected = true;
      blocks.push({
        id: `blk_intro_${Date.now()}_${blocks.length}`,
        type: "intro",
        text
      });
    } else {
      blocks.push({
        id: `blk_p_${Date.now()}_${blocks.length}`,
        type: "paragraph",
        text
      });
    }
  }

  if (extractedFaqs.length > 0) {
    blocks.push({
      id: `blk_faq_${Date.now()}`,
      type: "faq",
      faqs: extractedFaqs
    });
  }

  if (!detectedTitle) {
    detectedTitle = "Imported Educational Article";
  }

  // Automatically inject internal & external links into article blocks
  const autoLinksResult = autoInjectLinksToArticleBlocks(blocks, existingArticles, customRules);
  const finalBlocks = autoLinksResult.blocks;

  const fullContent = finalBlocks.map(b => b.text || (b.listItems || []).join(" ") || "").join(" ");
  const wordCount = fullContent.trim().split(/\s+/).filter(Boolean).length;
  const readingTimeMinutes = Math.max(1, Math.ceil(wordCount / 180));
  const language = detectLanguage(detectedTitle + " " + fullContent);
  const kwResult = extractKeywordsAndIntent(fullContent, detectedTitle);
  const slug = generateSmartSlug(detectedTitle);

  const introBlock = finalBlocks.find(b => b.type === "intro" || b.type === "paragraph");
  const firstParagraph = introBlock?.text || "";
  const excerpt = customExcerpt
    ? (customExcerpt.length > 160 ? customExcerpt.substring(0, 157) + "..." : customExcerpt)
    : (firstParagraph.length > 150 ? firstParagraph.substring(0, 147) + "..." : firstParagraph || `${detectedTitle} - Comprehensive overview and exam breakdown.`);

  const articleDraft: Partial<NewsArticle> = {
    title: detectedTitle,
    slug,
    category: kwResult.category,
    language,
    excerpt,
    content: cleanHtml || rawHtml,
    blocks: finalBlocks,
    status: "published",
    authorName: "DISHA 20-20 Editorial Team",
    focusKeyword: kwResult.focusKeyword,
    seoTitle: `${detectedTitle} | Complete Guide`,
    seoDescription: excerpt,
    tags: kwResult.tags,
    faqs: extractedFaqs,
    coverImageUrl: "https://images.unsplash.com/photo-1457369804613-52c61a468e7d?auto=format&fit=crop&w=1200&q=80",
    featuredImageAlt: `${detectedTitle} banner`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    publishedAt: new Date().toISOString()
  };

  const detectedMeta: DetectedArticleMetadata = {
    wordCount,
    readingTimeMinutes,
    language,
    searchIntent: kwResult.searchIntent,
    headingsCount: { h1: h1Count, h2: h2Count, h3: h3Count, h4: h4Count },
    tablesCount: tableCount,
    faqCount: extractedFaqs.length,
    keyPointsCount,
    ctaDetected,
    introDetected,
    conclusionDetected,
    internalLinksDetected: autoLinksResult.internalLinksCount,
    externalLinksDetected: autoLinksResult.externalLinksCount,
    injectedLinksSummary: autoLinksResult.injectedLinksSummary
  };

  const seoAudit = calculateSeoAudit(articleDraft);
  const internalLinkingSuggestions = findInternalLinkingSuggestions(fullContent, existingArticles);
  const duplicateWarning = checkDuplicateArticle(detectedTitle, slug, fullContent, existingArticles);
  const jsonLdSchema = generateArticleJsonLd(articleDraft);

  return {
    article: articleDraft,
    detectedMeta,
    seoAudit,
    internalLinkingSuggestions,
    duplicateWarning,
    jsonLdSchema,
    rawExtractedText: fullContent
  };
}

/**
 * File Importer: Dispatches file processing based on extension (.docx, .html, .txt)
 */
export async function parseUploadedArticleFile(
  file: File,
  existingArticles: NewsArticle[] = [],
  customRules: AutoLinkRule[] = []
): Promise<ParsedImportResult> {
  const fileName = file.name.toLowerCase();

  if (fileName.endsWith(".docx") || file.type.includes("wordprocessingml")) {
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.convertToHtml({ arrayBuffer });
    const html = result.value;
    return parseSmartHtml(html, existingArticles, customRules);
  }

  if (fileName.endsWith(".html") || fileName.endsWith(".htm") || file.type.includes("html")) {
    const htmlText = await file.text();
    return parseSmartHtml(htmlText, existingArticles, customRules);
  }

  const rawText = await file.text();
  return parseSmartText(rawText, existingArticles, customRules);
}
