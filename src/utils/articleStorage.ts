import { NewsArticle, ArticleBlock, FAQItem } from "../types";
import { DEFAULT_ARTICLES } from "../data/defaultArticles";
import { isUserAdmin, loadUserProfile } from "./userProfileStorage";
import {
  parseTableRowCells,
  isTableSeparatorRow,
  parseMarkdownTableLines,
} from "../components/news/ArticleTable";
import { generateSlug } from "./seoHelper";
import { updateSitemapFileOnServer } from "./sitemapGenerator";

const LOCAL_ARTICLES_KEY = "disha2020_news_articles_v2";
const LEGACY_LOCAL_ARTICLES_KEY = "quizpro_news_articles_v2";
const DELETED_ARTICLES_KEY = "disha2020_deleted_articles_v1";
const LEGACY_DELETED_ARTICLES_KEY = "quizpro_deleted_articles_v1";
const CURRENT_STORAGE_VERSION = 2;

export function getDeletedArticleIds(): string[] {
  try {
    if (typeof window === "undefined" || !window.localStorage) return [];
    const raw = localStorage.getItem(DELETED_ARTICLES_KEY) || localStorage.getItem(LEGACY_DELETED_ARTICLES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function addDeletedArticleId(id: string): void {
  try {
    if (typeof window === "undefined" || !window.localStorage) return;
    const list = getDeletedArticleIds();
    if (!list.includes(id)) {
      list.push(id);
      localStorage.setItem(DELETED_ARTICLES_KEY, JSON.stringify(list));
    }
  } catch (err) {
    console.warn("Failed to record deleted article ID:", err);
  }
}

export function clearDeletedArticleIds(): void {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      localStorage.removeItem(DELETED_ARTICLES_KEY);
      localStorage.removeItem(LEGACY_DELETED_ARTICLES_KEY);
    }
  } catch (err) {
    console.warn("Failed to clear deleted articles cache:", err);
  }
}

/**
 * Normalizes an article object to guarantee required properties
 */
export function normalizeArticle(raw: any): NewsArticle {
  const parseJsonField = (field: any) => {
    if (typeof field === "string") {
      try {
        return JSON.parse(field);
      } catch (e) {
        return field;
      }
    }
    return field;
  };

  const parseBlocksSafely = (blocksRaw: any): ArticleBlock[] => {
    let blocks = parseJsonField(blocksRaw);
    if (!Array.isArray(blocks)) return [];
    return blocks.map((b: any, idx: number): ArticleBlock => {
      let bType = b.type;
      if (!["paragraph", "h2", "h3", "table", "callout", "faq", "keytakeaways", "quote"].includes(bType)) {
        bType = "paragraph";
      }

      let parsedTableData = undefined;
      if (bType === "table") {
        if (Array.isArray(b.tableData)) {
          parsedTableData = b.tableData;
        } else if (typeof b.content === "string" && b.content.includes("|")) {
          parsedTableData = parseMarkdownTableLines(b.content);
        }
      }

      let parsedFaqItems: FAQItem[] = [];
      if (bType === "faq") {
        if (Array.isArray(b.faqItems)) {
          parsedFaqItems = b.faqItems.map((fi: any) => ({
            question: fi.question || "",
            answer: fi.answer || "",
          }));
        } else if (typeof b.content === "string") {
          try {
            const parsed = JSON.parse(b.content);
            if (Array.isArray(parsed)) parsedFaqItems = parsed;
          } catch {}
        }
      }

      let parsedTakeaways: string[] = [];
      if (bType === "keytakeaways") {
        if (Array.isArray(b.takeaways)) {
          parsedTakeaways = b.takeaways;
        } else if (typeof b.content === "string") {
          try {
            const parsed = JSON.parse(b.content);
            if (Array.isArray(parsed)) parsedTakeaways = parsed;
            else parsedTakeaways = b.content.split("\n").filter(Boolean);
          } catch {
            parsedTakeaways = b.content.split("\n").filter(Boolean);
          }
        }
      }

      return {
        id: b.id || `blk_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 6)}`,
        type: bType,
        content: typeof b.content === "string" ? b.content : "",
        orderIndex: typeof b.orderIndex === "number" ? b.orderIndex : idx,
        calloutVariant: b.calloutVariant || "info",
        tableHeaders: Array.isArray(b.tableHeaders) ? b.tableHeaders : undefined,
        tableData: parsedTableData,
        faqItems: parsedFaqItems,
        takeaways: parsedTakeaways,
      };
    });
  };

  const parsedBlocks = parseBlocksSafely(raw.blocks);

  const reconstructContentFromBlocks = (blocks: ArticleBlock[]): string => {
    if (!blocks || blocks.length === 0) return "";
    return blocks
      .map((b) => {
        if (b.type === "h2") return `<h2>${b.content}</h2>`;
        if (b.type === "h3") return `<h3>${b.content}</h3>`;
        if (b.type === "quote") return `<blockquote>${b.content}</blockquote>`;
        if (b.type === "callout") return `<div class="callout callout-${b.calloutVariant || "info"}">${b.content}</div>`;
        if (b.type === "keytakeaways" && b.takeaways) {
          return `<ul>${b.takeaways.map((t) => `<li>${t}</li>`).join("")}</ul>`;
        }
        if (b.type === "faq" && b.faqItems) {
          return `<div class="faq-section">${b.faqItems.map((f) => `<div class="faq-item"><strong>${f.question}</strong><p>${f.answer}</p></div>`).join("")}</div>`;
        }
        if (b.type === "table") {
          let rowsHtml = "";
          if (b.tableHeaders) {
            rowsHtml += `<tr>${b.tableHeaders.map((h) => `<th>${h}</th>`).join("")}</tr>`;
          }
          if (b.tableData) {
            rowsHtml += b.tableData.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join("")}</tr>`).join("");
          }
          return `<table>${rowsHtml}</table>`;
        }
        return `<p>${b.content}</p>`;
      })
      .join("\n");
  };

  let rawContent = typeof raw.content === "string" ? raw.content : "";
  if (!rawContent && parsedBlocks.length > 0) {
    rawContent = reconstructContentFromBlocks(parsedBlocks);
  }

  const rawExcerpt = raw.excerpt || "";
  const autoExcerpt = rawExcerpt || rawContent.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 155);

  return {
    id: raw.id || `art_${Date.now()}`,
    slug: raw.slug || (raw.title ? generateSlug(raw.title) : `article-${Date.now()}`),
    title: raw.title || "Untitled Article",
    subtitle: raw.subtitle || "",
    excerpt: autoExcerpt,
    content: rawContent,
    blocks: parsedBlocks,
    category: raw.category || "General",
    tags: Array.isArray(raw.tags) ? raw.tags : [],
    coverImage: raw.coverImage || "",
    featuredImage: raw.featuredImage || raw.coverImage || "",
    authorName: !raw.authorName || raw.authorName === "QuizPro Editorial Team" ? "DISHA 20-20 Editorial Team" : raw.authorName,
    authorBio: !raw.authorBio || raw.authorBio.includes("QuizPro") ? "Senior Education Analyst & Competitive Exam Specialist at DISHA 20-20 (दिशा 20-20)." : raw.authorBio,
    authorPhotoUrl: raw.authorPhotoUrl && !raw.authorPhotoUrl.includes("unsplash.com") ? raw.authorPhotoUrl : "",
    status: raw.status || "published",
    isPinned: Boolean(raw.isPinned),
    readTimeMinutes: Number(raw.readTimeMinutes) || Math.max(1, Math.ceil((rawContent.length || 500) / 800)),
    viewsCount: Number(raw.viewsCount) || 0,
    storageVersion: CURRENT_STORAGE_VERSION,
    blockCount: parsedBlocks.length,
    seoTitle: raw.seoTitle || raw.title || "Untitled Article",
    seoDescription: raw.seoDescription || autoExcerpt,
    seoKeywords: Array.isArray(raw.seoKeywords) ? raw.seoKeywords : (Array.isArray(raw.tags) ? raw.tags : []),
    createdAt: raw.createdAt || new Date().toISOString(),
    updatedAt: raw.updatedAt || new Date().toISOString(),
    publishedAt: raw.publishedAt || raw.createdAt || new Date().toISOString(),
    scheduledFor: raw.scheduledFor || undefined,
  };
}

export async function fetchBlocksForArticle(articleId: string): Promise<ArticleBlock[]> {
  const local = getLocalArticles();
  const found = local.find(a => a.id === articleId);
  return found?.blocks || [];
}

export function getLocalArticles(): NewsArticle[] {
  try {
    if (typeof window === "undefined" || !window.localStorage) {
      return DEFAULT_ARTICLES.map(normalizeArticle);
    }
    const raw = localStorage.getItem(LOCAL_ARTICLES_KEY) || localStorage.getItem(LEGACY_LOCAL_ARTICLES_KEY);
    const deletedIds = new Set(getDeletedArticleIds());
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map(normalizeArticle).filter(a => !deletedIds.has(a.id));
      }
    }
    return DEFAULT_ARTICLES.filter(a => !deletedIds.has(a.id)).map(normalizeArticle);
  } catch (err) {
    console.warn("Failed to load local articles:", err);
    return DEFAULT_ARTICLES.map(normalizeArticle);
  }
}

export function saveLocalArticles(articles: NewsArticle[]): void {
  try {
    if (typeof window === "undefined" || !window.localStorage) return;
    localStorage.setItem(LOCAL_ARTICLES_KEY, JSON.stringify(articles));
  } catch (err) {
    console.warn("Failed to cache local articles:", err);
  }
}

/**
 * Fetch all published articles for public readers and guests.
 */
export async function fetchPublishedArticles(): Promise<NewsArticle[]> {
  const deletedIds = new Set(getDeletedArticleIds());
  const map = new Map<string, NewsArticle>();
  DEFAULT_ARTICLES.filter(a => !deletedIds.has(a.id)).map(normalizeArticle).forEach(a => map.set(a.id, a));
  getLocalArticles().forEach(a => map.set(a.id, a));

  const nowTime = Date.now();
  const combined = Array.from(map.values()).filter(a => {
    if (deletedIds.has(a.id)) return false;
    if (a.status === "published") return true;
    if (a.status === "scheduled" && a.scheduledFor) {
      return new Date(a.scheduledFor).getTime() <= nowTime;
    }
    return false;
  });

  combined.sort((a, b) => {
    if (a.isPinned && !b.isPinned) return -1;
    if (!a.isPinned && b.isPinned) return 1;
    return new Date(b.publishedAt || b.createdAt).getTime() - new Date(a.publishedAt || a.createdAt).getTime();
  });

  return combined;
}

/**
 * Fetch single article by slug
 */
export async function fetchArticleBySlug(slug: string): Promise<NewsArticle | null> {
  const cleanSlug = slug.trim().toLowerCase();
  const deletedIds = new Set(getDeletedArticleIds());
  const local = getLocalArticles();
  const found = local.find(a => (a.slug.toLowerCase() === cleanSlug || a.id.toLowerCase() === cleanSlug) && !deletedIds.has(a.id));
  return found ? normalizeArticle(found) : null;
}

/**
 * Admin: Fetch all articles including drafts and scheduled
 */
export async function fetchAllArticlesAdmin(): Promise<NewsArticle[]> {
  const profile = loadUserProfile();
  if (!isUserAdmin(profile)) {
    throw new Error("Unauthorized: Admin privilege required.");
  }
  return getLocalArticles();
}

/**
 * Admin: Fetch full article with blocks
 */
export async function fetchArticleByIdAdmin(id: string): Promise<NewsArticle | null> {
  const profile = loadUserProfile();
  if (!isUserAdmin(profile)) {
    throw new Error("Unauthorized: Admin privilege required.");
  }

  const local = getLocalArticles();
  const found = local.find(a => a.id === id);
  return found ? normalizeArticle(found) : null;
}

export interface SaveProgress {
  stage: "metadata" | "blocks";
  currentBatch: number;
  totalBatches: number;
  percent: number;
}

async function ensureUniqueSlug(slug: string, articleId: string): Promise<string> {
  const local = getLocalArticles();
  let currentSlug = slug;
  let counter = 1;
  while (local.some(a => a.slug === currentSlug && a.id !== articleId)) {
    currentSlug = `${slug}-${counter++}`;
  }
  return currentSlug;
}

/**
 * Admin: Save or update article (publishes or drafts)
 */
export async function saveArticleAdmin(
  article: Partial<NewsArticle>,
  onProgress?: (progress: SaveProgress) => void
): Promise<NewsArticle> {
  const profile = loadUserProfile();
  if (!isUserAdmin(profile)) {
    throw new Error("Unauthorized: Admin privilege required.");
  }

  const now = new Date().toISOString();
  const id = article.id || `art_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

  let slug = article.slug ? article.slug.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") : "";
  if (!slug) {
    slug = generateSlug(article.title || "");
  }

  slug = await ensureUniqueSlug(slug, id);

  const autoSeoTitle = article.seoTitle?.trim()
    ? article.seoTitle.trim()
    : (article.title || "Untitled Article");

  const rawHtmlContent = typeof article.content === "string" ? article.content : "";
  const plainTextExcerpt = rawHtmlContent
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 155);

  const autoSeoDescription = article.seoDescription?.trim()
    ? article.seoDescription.trim()
    : (article.excerpt?.trim() || plainTextExcerpt || "Read latest exam updates and study guide on DISHA 20-20.");

  const rawBlocks = Array.isArray(article.blocks) ? article.blocks : [];

  const fullArticle: NewsArticle = normalizeArticle({
    ...article,
    id,
    slug,
    title: article.title || "Untitled Article",
    content: rawHtmlContent,
    blocks: rawBlocks,
    updatedAt: now,
    createdAt: article.createdAt || now,
    seoTitle: autoSeoTitle,
    seoDescription: autoSeoDescription,
  });

  try {
    const list = getDeletedArticleIds().filter(delId => delId !== id);
    localStorage.setItem(DELETED_ARTICLES_KEY, JSON.stringify(list));
  } catch {}

  const local = getLocalArticles();
  const updatedLocal = [fullArticle, ...local.filter(a => a.id !== id && a.slug !== slug)];
  saveLocalArticles(updatedLocal);

  if (onProgress) onProgress({ stage: "metadata", currentBatch: 1, totalBatches: 1, percent: 100 });

  if (typeof window !== "undefined") {
    updateSitemapFileOnServer().catch(() => {});
  }

  return fullArticle;
}

export async function bulkSaveArticlesAdmin(
  articleIds: string[],
  updates: Partial<NewsArticle>
): Promise<void> {
  const profile = loadUserProfile();
  if (!isUserAdmin(profile)) {
    throw new Error("Unauthorized: Admin privilege required.");
  }

  const all = await fetchAllArticlesAdmin();
  for (const id of articleIds) {
    const target = all.find(a => a.id === id);
    if (target) {
      await saveArticleAdmin({ ...target, ...updates });
    }
  }
}

export async function bulkRefreshArticlesPublishDate(): Promise<{ success: boolean; count: number; message: string }> {
  const profile = loadUserProfile();
  if (!isUserAdmin(profile)) {
    throw new Error("Unauthorized: Admin privilege required.");
  }

  const now = new Date().toISOString();
  const allArticles = await fetchAllArticlesAdmin();
  const updatedArticles = allArticles.map(a => {
    if (!a.status || a.status === "published") {
      return {
        ...a,
        status: "published" as const,
        publishedAt: now,
        updatedAt: now,
      };
    }
    return a;
  });

  saveLocalArticles(updatedArticles);
  const count = updatedArticles.filter(a => a.status === "published").length;
  return {
    success: true,
    count,
    message: `Successfully refreshed ${count} article${count === 1 ? "" : "s"} to today's date!`,
  };
}

export async function refreshSingleArticleDate(articleId: string): Promise<NewsArticle> {
  const profile = loadUserProfile();
  if (!isUserAdmin(profile)) {
    throw new Error("Unauthorized: Admin privilege required.");
  }

  const all = await fetchAllArticlesAdmin();
  const target = all.find(a => a.id === articleId);
  if (!target) {
    throw new Error("Article not found.");
  }

  const now = new Date().toISOString();
  const updated: NewsArticle = {
    ...target,
    status: target.status === "draft" ? "published" : (target.status || "published"),
    publishedAt: now,
    updatedAt: now,
  };

  return await saveArticleAdmin(updated);
}

export async function migrateMissingSlugsAdmin(): Promise<{ success: boolean; count: number }> {
  const profile = loadUserProfile();
  if (!isUserAdmin(profile)) {
    throw new Error("Unauthorized: Admin privilege required.");
  }

  const all = await fetchAllArticlesAdmin();
  let count = 0;
  for (const art of all) {
    if (!art.slug || art.slug === art.id) {
      const newSlug = generateSlug(art.title);
      await saveArticleAdmin({ ...art, slug: newSlug });
      count++;
    }
  }

  return { success: true, count };
}

export async function bulkDeleteArticlesAdmin(articleIds: string[]): Promise<void> {
  const profile = loadUserProfile();
  if (!isUserAdmin(profile)) {
    throw new Error("Unauthorized: Admin privilege required.");
  }

  for (const id of articleIds) {
    await deleteArticleAdmin(id);
  }
}

export async function deleteArticleAdmin(id: string): Promise<void> {
  const profile = loadUserProfile();
  if (!isUserAdmin(profile)) {
    throw new Error("Unauthorized: Admin privilege required.");
  }

  addDeletedArticleId(id);
  const local = getLocalArticles().filter(a => a.id !== id);
  saveLocalArticles(local);

  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("disha2020_articles_updated", { detail: { deletedId: id } }));
    updateSitemapFileOnServer().catch(() => {});
  }
}

export const DEFAULT_ARTICLE_CATEGORIES = [
  "Economics & Survey",
  "Exam Notification",
  "Study Strategy",
  "Current Affairs",
  "General",
];

const LOCAL_CATEGORIES_KEY = "disha2020_article_categories_v1";
const LEGACY_LOCAL_CATEGORIES_KEY = "quizpro_article_categories_v1";

export async function fetchArticleCategories(): Promise<string[]> {
  const categoriesSet = new Set<string>(DEFAULT_ARTICLE_CATEGORIES);
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      const raw = localStorage.getItem(LOCAL_CATEGORIES_KEY) || localStorage.getItem(LEGACY_LOCAL_CATEGORIES_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          parsed.forEach((c: string) => c && categoriesSet.add(c.trim()));
        }
      }
    }
  } catch {}

  try {
    const articles = await fetchPublishedArticles();
    articles.forEach((a) => {
      if (a.category) categoriesSet.add(a.category.trim());
    });
  } catch {}

  return Array.from(categoriesSet).filter(Boolean);
}

export async function saveArticleCategory(name: string, _hindiName?: string): Promise<string[]> {
  const cleanName = name.trim();
  if (!cleanName) return fetchArticleCategories();

  try {
    const categories = await fetchArticleCategories();
    if (!categories.includes(cleanName)) {
      categories.push(cleanName);
    }
    if (typeof window !== "undefined" && window.localStorage) {
      localStorage.setItem(LOCAL_CATEGORIES_KEY, JSON.stringify(categories));
    }
  } catch {}

  return fetchArticleCategories();
}

export async function deleteArticleCategory(name: string): Promise<string[]> {
  const cleanName = name.trim();
  if (!cleanName) return fetchArticleCategories();

  try {
    const categories = (await fetchArticleCategories()).filter((c) => c !== cleanName);
    if (typeof window !== "undefined" && window.localStorage) {
      localStorage.setItem(LOCAL_CATEGORIES_KEY, JSON.stringify(categories));
    }
  } catch {}

  return fetchArticleCategories();
}

export interface InternalLinkRule {
  keywords: string[];
  url: string;
}

export const INTERNAL_LINK_RULES: InternalLinkRule[] = [
  { keywords: ["Rajasthan Economic Survey", "राजस्थान आर्थिक समीक्षा", "आर्थिक समीक्षा"], url: "/news/rajasthan-economic-survey-2023-24-key-highlights" },
  { keywords: ["RAS Prelims", "RPSC RAS Prelims", "आरपीएससी", "RAS Pre"], url: "/news/ras-prelims-exam-pattern-negative-marking-strategy" },
  { keywords: ["Social Welfare Schemes", "सामाजिक सुरक्षा योजनाएं", "कल्याणकारी योजनाएं"], url: "/news/major-welfare-schemes-social-security-rajasthan" },
  { keywords: ["10 Hours Daily", "10 घंटे पढ़ाई", "Study Plan"], url: "/news/how-to-study-efficiently-for-10-hours-daily" },
  { keywords: ["MCQ Practice", "मॉक टेस्ट", "Live Test", "Test Series"], url: "/live_tests" },
  { keywords: ["Syllabus", "पाठ्यक्रम", "Chapter Wise MCQs"], url: "/topics" },
  { keywords: ["Previous Year Questions", "PYQ", "पुराने प्रश्न पत्र"], url: "/pyq_vault" },
];

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

let cachedLinkRules: InternalLinkRule[] = [];

export async function fetchAndCacheLinkRules(): Promise<void> {
  cachedLinkRules = [];
}

export function injectInternalLinks(text?: string): string {
  if (!text) return "";
  let processed = text;
  
  if (processed.length < 5) return processed;

  const allRules = [...INTERNAL_LINK_RULES, ...cachedLinkRules];

  for (const rule of allRules) {
    if (!rule.keywords || !rule.url) continue;
    for (const kw of rule.keywords) {
      const boundaryStart = '(?<![a-zA-Z0-9\\u0900-\\u097F])';
      const boundaryEnd = '(?![a-zA-Z0-9\\u0900-\\u097F])';
      const noPrevLink = '(?<!\\[|\\(|<a[^>]*>|href=")';
      const noNextLink = '(?![^\\[]*\\]|[^<]*>|\\))';
      
      const regex = new RegExp(`${boundaryStart}${noPrevLink}(${escapeRegExp(kw)})${noNextLink}${boundaryEnd}`, "i");
      
      if (regex.test(processed)) {
        processed = processed.replace(regex, `[$1](${rule.url})`);
        break; 
      }
    }
  }

  return processed;
}
