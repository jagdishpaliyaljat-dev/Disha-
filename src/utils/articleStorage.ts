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
import { supabase, isSupabaseConfigured } from "../lib/supabase";

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

  const VALID_BLOCK_TYPES = new Set<string>([
    "heading", "paragraph", "intro", "conclusion", "list", "image", "table",
    "quote", "callout", "key_points", "faq", "cta", "embed", "related_quiz",
    "diagram", "divider", "pdf_download", "book_course",
  ]);

  const normalizeBlockType = (rawType: any): ArticleBlock["type"] => {
    if (rawType === "h2" || rawType === "h3" || rawType === "h4") return "heading";
    if (rawType === "keytakeaways") return "key_points";
    if (typeof rawType === "string" && VALID_BLOCK_TYPES.has(rawType)) {
      return rawType as ArticleBlock["type"];
    }
    return "paragraph";
  };

  const parseBlocksSafely = (blocksRaw: any): ArticleBlock[] => {
    const blocks = parseJsonField(blocksRaw);
    if (!Array.isArray(blocks)) return [];

    return blocks.map((b: any, idx: number): ArticleBlock => {
      const type = normalizeBlockType(b?.type);
      const legacyText = typeof b?.text === "string"
        ? b.text
        : (typeof b?.content === "string" ? b.content : "");

      const block: ArticleBlock = {
        id: b?.id || `blk_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 6)}`,
        type,
        text: legacyText,
      };

      // Preserve all currently-supported optional fields when present.
      const copyIfPresent = (key: keyof ArticleBlock) => {
        if (b?.[key] !== undefined && b?.[key] !== null) {
          (block as any)[key] = b[key];
        }
      };
      ([
        "level", "calloutType", "listType", "listItems", "imageUrl", "imageAlt",
        "imageCaption", "tableHeaders", "tableRows", "tableAlignments",
        "tableCaption", "faqs", "ctaText", "ctaUrl", "embedType", "embedUrl",
        "relatedQuizTopicId", "relatedQuizTopicTitle", "relatedQuizSubjectId",
        "diagramType", "diagramData", "pdfTitle", "pdfUrl", "pdfFileSize",
        "pdfDescription", "pdfButtonText", "pdfBadge", "itemType", "itemTitle",
        "itemSubtitle", "itemUrl", "itemImageUrl", "itemPrice",
      ] as (keyof ArticleBlock)[]).forEach(copyIfPresent);

      if (type === "heading") {
        block.level = (b?.level === 1 || b?.level === 3 || b?.level === 4)
          ? b.level
          : (b?.type === "h3" ? 3 : 2);
      }

      if (type === "callout") {
        block.calloutType = b?.calloutType || b?.calloutVariant || "info";
      }

      if (type === "list" || type === "key_points") {
        const listSource = b?.listItems ?? b?.takeaways;
        if (Array.isArray(listSource)) {
          block.listItems = listSource.map((item: any) => String(item));
        } else if (legacyText) {
          const parsed = (() => {
            try {
              const candidate = JSON.parse(legacyText);
              return Array.isArray(candidate) ? candidate : null;
            } catch {
              return null;
            }
          })();
          block.listItems = (parsed || legacyText.split("\n"))
            .map((item: any) => String(item).trim())
            .filter(Boolean);
        }
        if (b?.listType === "numbered") block.listType = "numbered";
      }

      if (type === "table") {
        const headerSource = b?.tableHeaders;
        if (Array.isArray(headerSource)) {
          block.tableHeaders = headerSource.map((h: any) => String(h));
        }

        if (Array.isArray(b?.tableRows)) {
          block.tableRows = b.tableRows.map((row: any) => ({
            cells: Array.isArray(row?.cells)
              ? row.cells.map((c: any) => String(c))
              : (Array.isArray(row) ? row.map((c: any) => String(c)) : []),
          }));
        } else if (Array.isArray(b?.tableData)) {
          block.tableRows = b.tableData.map((row: any) => ({
            cells: Array.isArray(row) ? row.map((c: any) => String(c)) : [],
          }));
        } else if (legacyText.includes("|")) {
          const parsedTable = parseMarkdownTableLines(legacyText.split("\n"));
          if (parsedTable) {
            block.tableHeaders = parsedTable.headers;
            block.tableRows = parsedTable.rows;
            block.tableAlignments = parsedTable.alignments;
          }
        }
      }

      if (type === "faq") {
        const faqSource = b?.faqs ?? b?.faqItems;
        if (Array.isArray(faqSource)) {
          block.faqs = faqSource.map((fi: any) => ({
            question: fi?.question || "",
            answer: fi?.answer || "",
          }));
        } else if (legacyText) {
          try {
            const parsed = JSON.parse(legacyText);
            if (Array.isArray(parsed)) block.faqs = parsed;
          } catch {}
        }
      }

      if (type === "image") {
        block.imageUrl = b?.imageUrl || b?.url || "";
        block.imageAlt = b?.imageAlt || b?.alt || "";
        block.imageCaption = b?.imageCaption || b?.caption || "";
      }

      return block;
    });
  };

  const parsedBlocks = parseBlocksSafely(raw.blocks);

  const reconstructContentFromBlocks = (blocks: ArticleBlock[]): string => {
    if (!blocks || blocks.length === 0) return "";
    return blocks
      .map((b) => {
        const text = b.text || "";
        switch (b.type) {
          case "heading":
            return `<h${b.level || 2}>${text}</h${b.level || 2}>`;
          case "quote":
            return `<blockquote>${text}</blockquote>`;
          case "callout":
            return `<div class="callout callout-${b.calloutType || "info"}">${text}</div>`;
          case "list":
          case "key_points": {
            const tag = b.listType === "numbered" ? "ol" : "ul";
            return `<${tag}>${(b.listItems || []).map((item) => `<li>${item}</li>`).join("")}</${tag}>`;
          }
          case "faq":
            return `<div class="faq-section">${(b.faqs || []).map((f) => `<div class="faq-item"><strong>${f.question}</strong><p>${f.answer}</p></div>`).join("")}</div>`;
          case "table": {
            let rowsHtml = "";
            if (b.tableHeaders?.length) {
              rowsHtml += `<tr>${b.tableHeaders.map((h) => `<th>${h}</th>`).join("")}</tr>`;
            }
            if (b.tableRows?.length) {
              rowsHtml += b.tableRows
                .map((r) => `<tr>${(r.cells || []).map((c) => `<td>${c}</td>`).join("")}</tr>`)
                .join("");
            }
            return `<table>${rowsHtml}</table>`;
          }
          case "image":
            return b.imageUrl
              ? `<figure><img src="${b.imageUrl}" alt="${b.imageAlt || ""}" />${b.imageCaption ? `<figcaption>${b.imageCaption}</figcaption>` : ""}</figure>`
              : "";
          case "divider":
            return "<hr />";
          case "cta":
            return b.ctaUrl ? `<p><a href="${b.ctaUrl}">${b.ctaText || text}</a></p>` : `<p>${text}</p>`;
          default:
            return text ? `<p>${text}</p>` : "";
        }
      })
      .filter(Boolean)
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
    coverImageUrl: raw.coverImageUrl || raw.coverImage || raw.featuredImage || "",
    authorName: !raw.authorName || raw.authorName === "QuizPro Editorial Team" ? "DISHA 20-20 Editorial Team" : raw.authorName,
    authorBio: !raw.authorBio || raw.authorBio.includes("QuizPro") ? "Senior Education Analyst & Competitive Exam Specialist at DISHA 20-20." : raw.authorBio,
    authorPhotoUrl: raw.authorPhotoUrl && !raw.authorPhotoUrl.includes("unsplash.com") ? raw.authorPhotoUrl : "",
    status: raw.status || "published",
    isPinned: Boolean(raw.isPinned),
    views: Number(raw.views ?? raw.viewsCount) || 0,
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

export function mapRowToArticle(r: any): NewsArticle {
  return normalizeArticle({
    id: r.id,
    slug: r.slug,
    title: r.title,
    subtitle: r.subtitle || undefined,
    subjectName: r.subject_name || undefined,
    chapterName: r.chapter_name || undefined,
    topicName: r.topic_name || undefined,
    hindiTitle: r.hindi_title || undefined,
    excerpt: r.excerpt || "",
    content: r.content || "",
    blocks: Array.isArray(r.blocks) ? r.blocks : [],
    category: r.category || "General",
    tags: Array.isArray(r.tags) ? r.tags : [],
    language: r.language || "Both",
    coverImageUrl: r.cover_image_url || undefined,
    authorName: r.author_name || "Disha 20-20 Team",
    authorBio: r.author_bio || undefined,
    authorPhotoUrl: r.author_photo_url || undefined,
    status: r.status || "draft",
    scheduledFor: r.scheduled_for || undefined,
    isFeatured: Boolean(r.is_featured),
    isPinned: Boolean(r.is_pinned),
    pinnedAt: r.pinned_at || undefined,
    styleVariant: r.style_variant || "default",
    layoutConfig: r.layout_config || undefined,
    focusKeyword: r.focus_keyword || undefined,
    canonicalUrl: r.canonical_url || undefined,
    ogImageUrl: r.og_image_url || undefined,
    publishedAt: r.published_at || undefined,
    views: Number(r.views) || 0,
    seoTitle: r.seo_title || undefined,
    seoDescription: r.seo_description || undefined,
    seoKeywords: Array.isArray(r.seo_keywords) ? r.seo_keywords : [],
    faqs: Array.isArray(r.faqs) ? r.faqs : [],
    createdAt: r.created_at || new Date().toISOString(),
    updatedAt: r.updated_at || new Date().toISOString(),
  });
}

export function mapArticleToRow(a: NewsArticle): any {
  return {
    id: a.id,
    slug: a.slug,
    title: a.title,
    subtitle: a.subtitle || null,
    subject_name: a.subjectName || null,
    chapter_name: a.chapterName || null,
    topic_name: a.topicName || null,
    hindi_title: a.hindiTitle || null,
    excerpt: a.excerpt || "",
    content: a.content || "",
    blocks: a.blocks || [],
    category: a.category || "General",
    tags: a.tags || [],
    language: a.language || "Both",
    cover_image_url: a.coverImageUrl || null,
    author_name: a.authorName || "Disha 20-20 Team",
    author_bio: a.authorBio || null,
    author_photo_url: a.authorPhotoUrl || null,
    status: a.status || "draft",
    scheduled_for: a.scheduledFor || null,
    is_featured: Boolean(a.isFeatured),
    is_pinned: Boolean(a.isPinned),
    pinned_at: a.pinnedAt || null,
    style_variant: a.styleVariant || "default",
    layout_config: a.layoutConfig || {},
    focus_keyword: a.focusKeyword || null,
    canonical_url: a.canonicalUrl || null,
    og_image_url: a.ogImageUrl || null,
    published_at: a.publishedAt || (a.status === "published" ? new Date().toISOString() : null),
    views: a.views || 0,
    seo_title: a.seoTitle || null,
    seo_description: a.seoDescription || null,
    seo_keywords: a.seoKeywords || [],
    faqs: a.faqs || [],
    created_at: a.createdAt || new Date().toISOString(),
    updated_at: new Date().toISOString(),
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

  if (isSupabaseConfigured()) {
    try {
      const { data, error } = await supabase
        .from("news_articles")
        .select("*")
        .eq("status", "published")
        .order("created_at", { ascending: false });

      if (!error && Array.isArray(data)) {
        data.forEach((r) => {
          const art = mapRowToArticle(r);
          if (!deletedIds.has(art.id)) {
            map.set(art.id, art);
          }
        });
      }
    } catch (err) {
      console.warn("[ArticleStorage] Cloud fetch published notice:", err);
    }
  }

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
  // BUG-09: Sanitize slug to prevent PostgREST filter injection
  const cleanSlug = slug.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "");
  if (!cleanSlug) return null;
  const deletedIds = new Set(getDeletedArticleIds());
  const local = getLocalArticles();
  const found = local.find(a => (a.slug.toLowerCase() === cleanSlug || a.id.toLowerCase() === cleanSlug) && !deletedIds.has(a.id));
  if (found) return normalizeArticle(found);

  if (isSupabaseConfigured()) {
    try {
      const { data, error } = await supabase
        .from("news_articles")
        .select("*")
        .or(`slug.eq.${cleanSlug},id.eq.${cleanSlug}`)
        .maybeSingle();

      if (!error && data && !deletedIds.has(data.id)) {
        return mapRowToArticle(data);
      }
    } catch (err) {
      console.warn("[ArticleStorage] Cloud fetch slug notice:", err);
    }
  }

  return null;
}

/**
 * Admin: Fetch all articles including drafts and scheduled
 */
export async function fetchAllArticlesAdmin(): Promise<NewsArticle[]> {
  const profile = loadUserProfile();
  if (!isUserAdmin(profile)) {
    throw new Error("Unauthorized: Admin privilege required.");
  }

  const deletedIds = new Set(getDeletedArticleIds());
  const map = new Map<string, NewsArticle>();
  getLocalArticles().forEach(a => map.set(a.id, a));

  if (isSupabaseConfigured()) {
    try {
      const { data, error } = await supabase
        .from("news_articles")
        .select("*")
        .order("created_at", { ascending: false });

      if (!error && Array.isArray(data)) {
        data.forEach((r) => {
          const art = mapRowToArticle(r);
          if (!deletedIds.has(art.id)) {
            map.set(art.id, art);
          }
        });
      }
    } catch (err) {
      console.warn("[ArticleStorage] Cloud fetch admin notice:", err);
    }
  }

  return Array.from(map.values()).filter(a => !deletedIds.has(a.id));
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

  if (isSupabaseConfigured()) {
    try {
      const row = mapArticleToRow(fullArticle);
      const { error } = await supabase.from("news_articles").upsert(row);
      if (error) {
        console.warn("[ArticleStorage] Cloud upsert notice:", error.message);
      }
    } catch (cloudErr) {
      console.warn("[ArticleStorage] Cloud save exception:", cloudErr);
    }
  }

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

  if (isSupabaseConfigured()) {
    try {
      const { error } = await supabase.from("news_articles").delete().eq("id", id);
      if (error) {
        console.warn("[ArticleStorage] Cloud delete notice:", error.message);
      }
    } catch (cloudErr) {
      console.warn("[ArticleStorage] Cloud delete exception:", cloudErr);
    }
  }

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
const DELETED_ARTICLE_CATEGORIES_KEY = "disha2020_deleted_article_categories_v1";

export function getDeletedArticleCategories(): string[] {
  try {
    if (typeof window === "undefined" || !window.localStorage) return [];
    const raw = localStorage.getItem(DELETED_ARTICLE_CATEGORIES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function addDeletedArticleCategory(name: string): void {
  try {
    const clean = name.trim();
    if (!clean) return;
    const ids = getDeletedArticleCategories();
    if (!ids.includes(clean)) {
      ids.push(clean);
      if (typeof window !== "undefined" && window.localStorage) {
        localStorage.setItem(DELETED_ARTICLE_CATEGORIES_KEY, JSON.stringify(ids));
      }
    }
  } catch {}
}

export function clearDeletedArticleCategories(): void {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      localStorage.removeItem(DELETED_ARTICLE_CATEGORIES_KEY);
    }
  } catch {}
}

export async function fetchArticleCategories(): Promise<string[]> {
  const deleted = new Set(getDeletedArticleCategories());
  const categoriesSet = new Set<string>();
  DEFAULT_ARTICLE_CATEGORIES.forEach((c) => {
    if (!deleted.has(c)) categoriesSet.add(c);
  });
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      const raw = localStorage.getItem(LOCAL_CATEGORIES_KEY) || localStorage.getItem(LEGACY_LOCAL_CATEGORIES_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          parsed.forEach((c: string) => {
            const clean = (c || "").trim();
            if (clean && !deleted.has(clean)) categoriesSet.add(clean);
          });
        }
      }
    }
  } catch {}

  try {
    const articles = await fetchPublishedArticles();
    articles.forEach((a) => {
      const clean = (a.category || "").trim();
      if (clean && !deleted.has(clean)) categoriesSet.add(clean);
    });
  } catch {}

  return Array.from(categoriesSet).filter(Boolean);
}

export async function saveArticleCategory(name: string, _hindiName?: string): Promise<string[]> {
  const cleanName = name.trim();
  if (!cleanName) return fetchArticleCategories();

  // Re-adding a previously deleted category restores it.
  try {
    const deleted = getDeletedArticleCategories().filter((c) => c !== cleanName);
    if (typeof window !== "undefined" && window.localStorage) {
      localStorage.setItem(DELETED_ARTICLE_CATEGORIES_KEY, JSON.stringify(deleted));
    }
  } catch {}

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

  addDeletedArticleCategory(cleanName);

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
