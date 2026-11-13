import {
  collection,
  doc,
  query,
  where,
  limit,
} from "firebase/firestore";
import { 
  guardedGetDoc,
  guardedGetDocs, 
  guardedSetDoc, 
  guardedDeleteDoc,
  guardedWriteBatch
} from "./quotaTracker";
import { db, auth } from "../lib/firebase";
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

const LOCAL_ARTICLES_KEY = "quizpro_news_articles_v2";
const DELETED_ARTICLES_KEY = "quizpro_deleted_articles_v1";
const CURRENT_STORAGE_VERSION = 2;

export function getDeletedArticleIds(): string[] {
  try {
    if (typeof window === "undefined" || !window.localStorage) return [];
    const raw = localStorage.getItem(DELETED_ARTICLES_KEY);
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
    }
  } catch {}
}

/**
 * Converts raw markdown text into structured ArticleBlock array,
 * automatically detecting tables, headings, callouts, lists, and faqs.
 */
export function convertMarkdownToBlocks(
  markdown: string,
  existingFaqs: FAQItem[] = []
): ArticleBlock[] {
  if (!markdown || !markdown.trim()) return [];

  const lines = markdown.split(/\r?\n/);
  const blocks: ArticleBlock[] = [];
  let blockCounter = 1;

  let currentParagraphLines: string[] = [];
  let currentListLines: string[] = [];
  let currentListType: "bullet" | "numbered" = "bullet";
  let currentTableLines: string[] = [];

  const flushParagraph = () => {
    if (currentParagraphLines.length > 0) {
      const text = currentParagraphLines.join("\n").trim();
      if (text) {
        blocks.push({
          id: `blk_${Date.now()}_${blockCounter++}`,
          type: "paragraph",
          text,
        });
      }
      currentParagraphLines = [];
    }
  };

  const flushList = () => {
    if (currentListLines.length > 0) {
      blocks.push({
        id: `blk_${Date.now()}_${blockCounter++}`,
        type: "key_points",
        listType: currentListType,
        listItems: [...currentListLines],
      });
      currentListLines = [];
    }
  };

  const flushTable = () => {
    if (currentTableLines.length > 0) {
      if (currentTableLines.length >= 2) {
        const parsed = parseMarkdownTableLines(currentTableLines);
        if (parsed) {
          blocks.push({
            id: `blk_${Date.now()}_${blockCounter++}`,
            type: "table",
            tableHeaders: parsed.headers,
            tableRows: parsed.rows,
            tableAlignments: parsed.alignments,
          });
        } else {
          currentParagraphLines.push(...currentTableLines);
        }
      } else {
        currentParagraphLines.push(...currentTableLines);
      }
      currentTableLines = [];
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const line = rawLine.trim();

    if (!line) {
      flushParagraph();
      flushList();
      flushTable();
      continue;
    }

    // Check table row
    const isTableRow = parseTableRowCells(line) !== null || isTableSeparatorRow(line);
    if (isTableRow) {
      flushParagraph();
      flushList();
      currentTableLines.push(line);
      continue;
    } else {
      flushTable();
    }

    // Check Heading
    const headingMatch = line.match(/^(#{1,6})\s+(.*)$/);
    if (headingMatch) {
      flushParagraph();
      flushList();
      const levelNum = headingMatch[1].length;
      const level = Math.min(Math.max(levelNum, 1), 4) as 1 | 2 | 3 | 4;
      blocks.push({
        id: `blk_${Date.now()}_${blockCounter++}`,
        type: "heading",
        level,
        text: headingMatch[2].trim(),
      });
      continue;
    }

    // Check Callout / Blockquote
    if (line.startsWith(">")) {
      flushParagraph();
      flushList();
      const calloutText = line.replace(/^>\s*/, "").trim();
      let calloutType: "info" | "warning" | "tip" | "important" = "info";
      let cleanText = calloutText;
      if (/^\[!(TIP)\]/i.test(calloutText)) {
        calloutType = "tip";
        cleanText = calloutText.replace(/^\[!TIP\]\s*/i, "");
      } else if (/^\[!(WARNING|CAUTION)\]/i.test(calloutText)) {
        calloutType = "warning";
        cleanText = calloutText.replace(/^\[!(WARNING|CAUTION)\]\s*/i, "");
      } else if (/^\[!(IMPORTANT)\]/i.test(calloutText)) {
        calloutType = "important";
        cleanText = calloutText.replace(/^\[!IMPORTANT\]\s*/i, "");
      } else if (/^\[!(NOTE|INFO)\]/i.test(calloutText)) {
        calloutType = "info";
        cleanText = calloutText.replace(/^\[!(NOTE|INFO)\]\s*/i, "");
      }

      blocks.push({
        id: `blk_${Date.now()}_${blockCounter++}`,
        type: "callout",
        calloutType,
        text: cleanText,
      });
      continue;
    }

    // Check Bullet or Numbered List
    const bulletMatch = line.match(/^[-*•]\s+(.*)$/);
    const numMatch = line.match(/^\d+[.)]\s+(.*)$/);
    if (bulletMatch) {
      flushParagraph();
      if (currentListLines.length > 0 && currentListType !== "bullet") {
        flushList();
      }
      currentListType = "bullet";
      currentListLines.push(bulletMatch[1].trim());
      continue;
    } else if (numMatch) {
      flushParagraph();
      if (currentListLines.length > 0 && currentListType !== "numbered") {
        flushList();
      }
      currentListType = "numbered";
      currentListLines.push(numMatch[1].trim());
      continue;
    } else {
      flushList();
    }

    // Standard paragraph line
    currentParagraphLines.push(rawLine);
  }

  flushParagraph();
  flushList();
  flushTable();

  // If FAQs provided, append FAQ block
  if (existingFaqs && existingFaqs.length > 0) {
    blocks.push({
      id: `blk_${Date.now()}_${blockCounter++}`,
      type: "faq",
      faqs: existingFaqs,
    });
  }

  return blocks;
}

/**
 * Normalizes an article document to ensure all properties and blocks exist.
 */
export function normalizeArticle(raw: any): NewsArticle {
  const content = raw.content || "";
  const faqs: FAQItem[] = Array.isArray(raw.faqs) ? raw.faqs : [];
  const blocks: ArticleBlock[] = Array.isArray(raw.blocks) && raw.blocks.length > 0
    ? raw.blocks
    : convertMarkdownToBlocks(content, faqs);

  return {
    id: String(raw.id || `art_${Date.now()}`),
    slug: String(raw.slug || raw.id || `article-${Date.now()}`),
    title: raw.title || "Untitled Article",
    subtitle: raw.subtitle || "",
    hindiTitle: raw.hindiTitle || "",
    excerpt: raw.excerpt || "",
    content,
    blocks,
    category: raw.category || "General",
    tags: Array.isArray(raw.tags) ? raw.tags : [],
    language: raw.language || "Both",
    coverImageUrl: raw.coverImageUrl && !raw.coverImageUrl.includes("unsplash.com") ? raw.coverImageUrl : "",
    authorName: !raw.authorName || raw.authorName === "QuizPro Editorial Team" ? "DISHA 20-20 Editorial Team" : raw.authorName,
    authorBio: !raw.authorBio || raw.authorBio.includes("QuizPro") ? "Senior Education Analyst & Competitive Exam Specialist at DISHA 20-20 (दिशा 20-20)." : raw.authorBio,
    authorPhotoUrl: raw.authorPhotoUrl && !raw.authorPhotoUrl.includes("unsplash.com") ? raw.authorPhotoUrl : "",
    status: raw.status || "published",
    scheduledFor: raw.scheduledFor,
    isFeatured: Boolean(raw.isFeatured),
    isPinned: Boolean(raw.isPinned),
    pinnedAt: raw.pinnedAt,
    styleVariant: raw.styleVariant || "default",
    layoutConfig: raw.layoutConfig || {
      showTableOfContents: true,
      showAuthorBox: true,
      showRelatedArticles: true,
      showShareButtons: true,
    },
    focusKeyword: raw.focusKeyword || "",
    canonicalUrl: raw.canonicalUrl || "",
    ogImageUrl: raw.ogImageUrl || raw.coverImageUrl,
    publishedAt: raw.publishedAt,
    createdAt: raw.createdAt || new Date().toISOString(),
    updatedAt: raw.updatedAt || new Date().toISOString(),
    views: typeof raw.views === "number" ? raw.views : 0,
    seoTitle: raw.seoTitle || raw.title,
    seoDescription: raw.seoDescription || raw.excerpt,
    faqs,
    storageVersion: raw.storageVersion || 1,
    blockCount: blocks.length,
  };
}

/**
 * Fetches blocks for an article from its subcollection
 */
async function fetchBlocksForArticle(articleId: string): Promise<ArticleBlock[]> {
  try {
    const blocksRef = collection(db, "articles", articleId, "blocks");
    const snap = await guardedGetDocs(blocksRef, "Student", `Fetch Blocks for ${articleId}`);
    if (snap.empty) return [];
    
    const blocks = snap.docs.map(d => ({
      ...d.data(),
      id: d.id
    })) as (ArticleBlock & { orderIndex?: number })[];
    
    // Sort by orderIndex if present, otherwise fallback to existing IDs or default order
    blocks.sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0));
    
    return blocks;
  } catch (err) {
    console.error(`Failed to fetch blocks for article ${articleId}:`, err);
    return [];
  }
}


export function getLocalArticles(): NewsArticle[] {
  const deletedIds = new Set(getDeletedArticleIds());
  const defaultList = DEFAULT_ARTICLES.filter(a => !deletedIds.has(a.id)).map(normalizeArticle);
  try {
    if (typeof window === "undefined" || !window.localStorage) return defaultList;
    const raw = localStorage.getItem(LOCAL_ARTICLES_KEY);
    if (!raw) return defaultList;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      const cached = parsed.filter(a => a && a.id && !deletedIds.has(a.id)).map(normalizeArticle);
      const map = new Map<string, NewsArticle>();
      defaultList.forEach(a => map.set(a.id, a));
      cached.forEach(a => map.set(a.id, a));
      return Array.from(map.values()).filter(a => !deletedIds.has(a.id));
    }
    return defaultList;
  } catch {
    return defaultList;
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
 * Drafts and future scheduled articles are never returned to public users.
 */
export async function fetchPublishedArticles(): Promise<NewsArticle[]> {
  try {
    const articlesRef = collection(db, "articles");
    const q = query(articlesRef, limit(100));
    const snap = await guardedGetDocs(q, "Student", "Fetch Published Articles");

    if (snap && !snap.empty) {
      const deletedIds = new Set(getDeletedArticleIds());
      const remote = snap.docs.map((d) => {
        const data = d.data() as NewsArticle;
        return normalizeArticle({ ...data, id: d.id });
      });
      
      const filteredRemote = remote.filter(a => !deletedIds.has(a.id));

      // Merge with default articles omitting deleted IDs
      const map = new Map<string, NewsArticle>();
      DEFAULT_ARTICLES.filter(a => !deletedIds.has(a.id)).map(normalizeArticle).forEach(a => map.set(a.id, a));
      remote.forEach(a => map.set(a.id, a));

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

      saveLocalArticles(combined);
      return combined;
    }
  } catch (err) {
    console.warn("Firestore fetchPublishedArticles fallback to local cache:", err);
  }

  // Fallback to local cached / default articles
  const local = getLocalArticles().filter(a => a.status === "published");
  return local;
}

/**
 * Fetch single article by slug
 */
export async function fetchArticleBySlug(slug: string): Promise<NewsArticle | null> {
  const cleanSlug = slug.trim().toLowerCase();
  const deletedIds = new Set(getDeletedArticleIds());
  try {
    const articlesRef = collection(db, "articles");
    const q = query(articlesRef, where("slug", "==", cleanSlug), limit(1));
    const snap = await guardedGetDocs(q, "Student", "Fetch Article By Slug");
    if (!snap.empty) {
      const d = snap.docs[0];
      if (deletedIds.has(d.id)) return null;
      const data = d.data() as NewsArticle;
      const article = normalizeArticle({ ...data, id: d.id });
      
      // If v2 storage, fetch blocks from subcollection
      if (article.storageVersion === 2 && (!article.blocks || article.blocks.length === 0)) {
        article.blocks = await fetchBlocksForArticle(article.id);
      }
      
      return article;
    } else {
      // Fallback: Check if cleanSlug is a document ID
      try {
        const docSnap = await guardedGetDoc(doc(db, "articles", cleanSlug), "Student", "Fetch Article By ID Fallback");
        if (docSnap.exists() && !deletedIds.has(docSnap.id)) {
          const data = docSnap.data() as NewsArticle;
          const article = normalizeArticle({ ...data, id: docSnap.id });
          if (article.storageVersion === 2 && (!article.blocks || article.blocks.length === 0)) {
            article.blocks = await fetchBlocksForArticle(article.id);
          }
          return article;
        }
      } catch {}
    }
  } catch (err) {
    console.warn("fetchArticleBySlug Firestore read error:", err);
  }

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

  try {
    const articlesRef = collection(db, "articles");
    const snap = await guardedGetDocs(articlesRef, "Admin", "Fetch All Articles Admin");
    if (!snap.empty) {
      const deletedIds = new Set(getDeletedArticleIds());
      const remote = snap.docs.map((d) => {
        const data = d.data() as NewsArticle;
        return normalizeArticle({ ...data, id: d.id });
      });
      
      const filteredRemote = remote.filter(a => !deletedIds.has(a.id));

      const map = new Map<string, NewsArticle>();
      DEFAULT_ARTICLES.filter(a => !deletedIds.has(a.id)).map(normalizeArticle).forEach(a => map.set(a.id, a));
      remote.forEach(a => map.set(a.id, a));
      const combined = Array.from(map.values()).filter(a => !deletedIds.has(a.id));
      combined.sort((a, b) => new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime());
      saveLocalArticles(combined);
      return combined;
    }
  } catch (err) {
    console.warn("fetchAllArticlesAdmin fallback:", err);
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

  try {
    const docRef = doc(db, "articles", id);
    const snap = await guardedGetDoc(docRef, "Admin", "Fetch Full Article Admin");
    if (snap.exists()) {
      const article = normalizeArticle({ ...snap.data(), id: snap.id });
      if (article.storageVersion === 2 && (!article.blocks || article.blocks.length === 0)) {
        article.blocks = await fetchBlocksForArticle(id);
      }
      return article;
    }
  } catch (err) {
    console.warn("fetchArticleByIdAdmin error:", err);
  }

  const local = getLocalArticles();
  const found = local.find(a => a.id === id);
  return found ? normalizeArticle(found) : null;
}

/**
 * Admin: Save or update article (publishes or drafts)
 */
export interface SaveProgress {
  stage: "metadata" | "blocks";
  currentBatch: number;
  totalBatches: number;
  percent: number;
}

/**
 * Ensures a slug is unique in the articles collection.
 */
async function ensureUniqueSlug(slug: string, articleId: string): Promise<string> {
  let currentSlug = slug;
  let counter = 1;
  let isUnique = false;
  let attempts = 0;
  
  while (!isUnique && attempts < 10) {
    attempts++;
    const articlesRef = collection(db, "articles");
    const q = query(articlesRef, where("slug", "==", currentSlug), limit(1));
    const snap = await guardedGetDocs(q, "Admin", "Check Slug Uniqueness");
    
    if (snap.empty) {
      isUnique = true;
    } else {
      const docSnap = snap.docs[0];
      if (docSnap.id === articleId) {
        isUnique = true;
      } else {
        currentSlug = `${slug}-${counter++}`;
      }
    }
  }
  return currentSlug;
}

/**
 * Admin: Save or update article (publishes or drafts)
 * Supports chunked, idempotent writes for content blocks.
 */
export async function saveArticleAdmin(
  article: Partial<NewsArticle>,
  onProgress?: (progress: SaveProgress) => void
): Promise<NewsArticle> {
  const profile = loadUserProfile();
  if (!isUserAdmin(profile)) {
    throw new Error("Unauthorized: Admin privilege required.");
  }

  // DOUBLE-CHECK: Ensure Firebase Auth user is actually present and valid
  if (!auth.currentUser || auth.currentUser.isAnonymous) {
     const isAnon = auth.currentUser?.isAnonymous;
     const localEmail = profile?.email;
     console.error("[Save Article] Auth failure identity check:", { 
       hasAuthUser: !!auth.currentUser, 
       isAnonymous: isAnon, 
       localProfileEmail: localEmail,
       providerData: auth.currentUser?.providerData
     });
     
     throw new Error(isAnon 
       ? "Authentication Required: You are currently signed in as a Guest. Please sign in with your Google Admin account to save articles."
       : "Authentication Required: Your session may have expired. Please log in with Google to save changes to the cloud."
     );
  }

  // Force token refresh
  try {
    await auth.currentUser.getIdToken(true);
    console.log("[Auth] Token refreshed successfully before save.");
  } catch (tokenErr) {
    console.error("[Auth] Token refresh failed:", tokenErr);
    throw new Error("Authentication Error: Failed to verify your session. Please try logging in again.");
  }
  
  const currentEmail = auth.currentUser.email?.trim().toLowerCase();
  const { ADMIN_EMAILS } = await import("./userProfileStorage");
  if (!currentEmail || !ADMIN_EMAILS.includes(currentEmail)) {
     console.error("[Identity Check] Permission denied for email:", currentEmail, "Provider Data:", auth.currentUser.providerData);
     throw new Error(`Unauthorized: The account ${currentEmail || 'unknown'} does not have cloud write permissions.`);
  }

  const now = new Date().toISOString();
  const id = article.id || `art_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  
  // Robust slug generation
  let slug = article.slug ? article.slug.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") : "";
  if (!slug) {
    slug = generateSlug(article.title || "");
  }
  
  // Ensure uniqueness in Firestore
  slug = await ensureUniqueSlug(slug, id);

  // Auto-generate SEO fields if blank
  const autoSeoTitle = article.seoTitle?.trim()
    ? article.seoTitle.trim()
    : (article.title || "Untitled Article");

  const cleanContentText = (article.content || "")
    .replace(/#+\s+/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[*_~`]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  const firstParagraph = cleanContentText.slice(0, 155);
  const autoSeoDescription = article.seoDescription?.trim()
    ? article.seoDescription.trim()
    : (article.excerpt?.trim() || firstParagraph || "Read latest exam updates and study guide on DISHA 20-20.");

  const rawBlocks = article.blocks && article.blocks.length > 0
    ? article.blocks
    : convertMarkdownToBlocks(article.content || "", article.faqs);

  const fullArticle: NewsArticle = normalizeArticle({
    ...article,
    id,
    slug,
    title: article.title || "Untitled Article",
    blocks: rawBlocks,
    updatedAt: now,
    createdAt: article.createdAt || now,
    seoTitle: autoSeoTitle,
    seoDescription: autoSeoDescription,
  });

  // 1. Sync to local cache
  try {
    const list = getDeletedArticleIds().filter(delId => delId !== id);
    localStorage.setItem(DELETED_ARTICLES_KEY, JSON.stringify(list));
  } catch {}
  const local = getLocalArticles();
  const updatedLocal = [fullArticle, ...local.filter(a => a.id !== id && a.slug !== slug)];
  saveLocalArticles(updatedLocal);

  // 2. Sync to Firestore using split storage strategy
  try {
    const articleDocRef = doc(db, "articles", id);
    const hasProvidedBlocks = Array.isArray(article.blocks);
    const blocks = fullArticle.blocks || [];
    
    // Prepare metadata document (exclude heavy content fields)
    const metadata: any = {
      ...fullArticle,
      storageVersion: CURRENT_STORAGE_VERSION,
      blockCount: fullArticle.blockCount || blocks.length,
      // We clear the heavy blocks and content from the main document to keep it < 1MB
      blocks: [], 
      content: "", 
    };

    // Step A: Save metadata first
    if (onProgress) onProgress({ stage: "metadata", currentBatch: 0, totalBatches: 1, percent: 5 });
    await guardedSetDoc(articleDocRef, metadata, { merge: true }, "Admin", "Save Article Metadata");

    // Step B: Save blocks in subcollection ONLY if they were provided in the input
    // This prevents bulk status updates from wiping blocks because they weren't in the initial list.
    if (hasProvidedBlocks) {
      const batchSize = 400; // Slightly smaller batch for better stability
      const batchesCount = Math.ceil(blocks.length / batchSize);
      
      for (let i = 0; i < batchesCount; i++) {
        if (onProgress) {
          onProgress({ 
            stage: "blocks", 
            currentBatch: i + 1, 
            totalBatches: batchesCount, 
            percent: Math.round(10 + ((i / batchesCount) * 90)) 
          });
        }

        const batch = guardedWriteBatch(db);
        const start = i * batchSize;
        const end = Math.min(start + batchSize, blocks.length);
        const chunk = blocks.slice(start, end);

        chunk.forEach((block, idx) => {
          const blockRef = doc(db, "articles", id, "blocks", block.id);
          batch.set(blockRef, {
            ...block,
            orderIndex: start + idx,
            updatedAt: now
          });
        });

        // Use a slightly longer timeout for larger batches if needed
        await batch.commit("Admin", `Save Article Blocks Batch ${i+1}/${batchesCount}`, "CMS", 60000);
      }
    }

    if (onProgress) onProgress({ stage: "blocks", currentBatch: 1, totalBatches: 1, percent: 100 });

  } catch (err: any) {
    console.error(`Firestore saveArticleAdmin failed [ID: ${id}]:`, {
      code: err.code,
      message: err.message,
      articleId: id,
      blockCount: fullArticle.blockCount
    });
    throw err;
  }

  // Automatically keep sitemap updated in background
  if (typeof window !== "undefined") {
    updateSitemapFileOnServer().catch(() => {});
  }

  return fullArticle;
}

/**
 * Admin: Bulk status updates (Publish, Draft, Scheduled, Delete, Category change)
 */
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

/**
 * Admin: Refresh all articles' publication date to today
 */
export async function bulkRefreshArticlesPublishDate(): Promise<{ success: boolean; count: number; message: string }> {
  const profile = loadUserProfile();
  if (!isUserAdmin(profile)) {
    throw new Error("Unauthorized: Admin privilege required.");
  }

  try {
    const now = new Date().toISOString();

    // 1. Fetch current articles (remote + default, or local cache)
    const allArticles = await fetchAllArticlesAdmin();

    // 2. Refresh publication & update timestamps for all published articles
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

    // 3. Immediately persist to LocalStorage so UI updates without delay
    saveLocalArticles(updatedArticles);

    // 4. Concurrently sync to Cloud Firestore
    const targetArticles = updatedArticles.filter(a => a.status === "published");
    await Promise.allSettled(
      targetArticles.map(async (art) => {
        try {
          // Use saveArticleAdmin to ensure proper storage versioning and block migration
          await saveArticleAdmin(art);
        } catch (setErr) {
          console.warn(`Firestore sync note for article ${art.id}:`, setErr);
        }
      })
    );

    const count = targetArticles.length;
    return {
      success: true,
      count,
      message: `Successfully refreshed ${count} article${count === 1 ? "" : "s"} to today's date!`,
    };
  } catch (err: any) {
    console.error("bulkRefreshArticlesPublishDate failed:", err);
    throw err;
  }
}

/**
 * Admin: Refresh a single article's publication date to now
 */
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

/**
 * Admin: Migrates all articles missing slugs by generating them from titles.
 */
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
      // We don't use saveArticleAdmin here to avoid the complexity of full save if only slug is needed,
      // but saveArticleAdmin is safer as it handles blocks etc.
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

/**
 * Admin: Delete an article
 */
export async function deleteArticleAdmin(id: string): Promise<void> {
  const profile = loadUserProfile();
  if (!isUserAdmin(profile)) {
    throw new Error("Unauthorized: Admin privilege required.");
  }

  // 1. Record in deleted IDs set so it never resurrects
  addDeletedArticleId(id);

  // 2. Remove from local storage
  const local = getLocalArticles().filter(a => a.id !== id);
  saveLocalArticles(local);

  // 3. Dispatch in-app update event
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("quizpro_articles_updated", { detail: { deletedId: id } }));
  }

  // 4. Remove from Firestore
  try {
    await guardedDeleteDoc(doc(db, "articles", id), "Admin", "Delete Article Admin");
  } catch (err: any) {
    console.warn("Firestore deleteArticleAdmin remote delete note:", err?.message || err);
  }

  // Automatically keep sitemap updated in background after deletion
  if (typeof window !== "undefined") {
    updateSitemapFileOnServer().catch(() => {});
  }
}

/**
 * Article Category Management
 */
export const DEFAULT_ARTICLE_CATEGORIES = [
  "Economics & Survey",
  "Exam Notification",
  "Study Strategy",
  "Current Affairs",
  "General",
];

const LOCAL_CATEGORIES_KEY = "quizpro_article_categories_v1";

export async function fetchArticleCategories(): Promise<string[]> {
  const categoriesSet = new Set<string>(DEFAULT_ARTICLE_CATEGORIES);

  // 1. Read from LocalStorage
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      const raw = localStorage.getItem(LOCAL_CATEGORIES_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          parsed.forEach((c: string) => c && categoriesSet.add(c.trim()));
        }
      }
    }
  } catch {}

  // 2. Read from Firestore
  try {
    const snap = await guardedGetDocs(collection(db, "article_categories"), "Student", "Fetch Article Categories");
    snap.docs.forEach((docSnap) => {
      const data = docSnap.data();
      if (data && data.name) {
        categoriesSet.add(data.name.trim());
      }
    });
  } catch (err) {
    console.warn("Firestore fetchArticleCategories warning:", err);
  }

  // 3. Include categories from active articles
  try {
    const articles = await fetchPublishedArticles();
    articles.forEach((a) => {
      if (a.category) categoriesSet.add(a.category.trim());
    });
  } catch {}

  return Array.from(categoriesSet).filter(Boolean);
}

export async function saveArticleCategory(name: string, hindiName?: string): Promise<string[]> {
  const cleanName = name.trim();
  if (!cleanName) return fetchArticleCategories();

  // Save Local
  try {
    const categories = await fetchArticleCategories();
    if (!categories.includes(cleanName)) {
      categories.push(cleanName);
    }
    if (typeof window !== "undefined" && window.localStorage) {
      localStorage.setItem(LOCAL_CATEGORIES_KEY, JSON.stringify(categories));
    }
  } catch {}

  // Save Firestore
  try {
    const catId = `cat_${cleanName.toLowerCase().replace(/[^a-z0-9]+/g, "_")}`;
    await guardedSetDoc(doc(db, "article_categories", catId), {
      id: catId,
      name: cleanName,
      hindiName: hindiName || "",
      createdAt: new Date().toISOString(),
    }, { merge: true }, "Admin", "Save Article Category");
  } catch (err) {
    console.warn("Firestore saveArticleCategory warning:", err);
  }

  return fetchArticleCategories();
}

export async function deleteArticleCategory(name: string): Promise<string[]> {
  const cleanName = name.trim();
  if (!cleanName) return fetchArticleCategories();

  // Local
  try {
    const categories = (await fetchArticleCategories()).filter((c) => c !== cleanName);
    if (typeof window !== "undefined" && window.localStorage) {
      localStorage.setItem(LOCAL_CATEGORIES_KEY, JSON.stringify(categories));
    }
  } catch {}

  // Firestore
  try {
    const catId = `cat_${cleanName.toLowerCase().replace(/[^a-z0-9]+/g, "_")}`;
    await guardedDeleteDoc(doc(db, "article_categories", catId), "Admin", "Delete Article Category");
  } catch (err) {
    console.warn("Firestore deleteArticleCategory warning:", err);
  }

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
  try {
    const rulesRef = collection(db, "link_rules");
    const snap = await guardedGetDocs(rulesRef, "Student", "Fetch Link Rules");
    cachedLinkRules = snap.docs.map(d => {
      const data = d.data();
      return {
        keywords: data.keywords || [],
        url: data.url || ""
      };
    });
  } catch (err) {
    console.warn("Failed to fetch link rules from Firestore:", err);
  }
}

export function injectInternalLinks(text?: string): string {
  if (!text) return "";
  let processed = text;
  
  if (processed.length < 5) return processed;

  // Use both built-in and cached Firestore rules
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


