import React, { useState, useEffect, useMemo } from "react";
import {
  ArrowLeft,
  Calendar,
  Clock,
  Share2,
  BookOpen,
  Sparkles,
  Search,
  Tag,
  CheckCircle2,
  ExternalLink,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Bookmark,
  LogIn,
  Lightbulb,
  AlertTriangle,
  Info,
  CheckSquare,
  HelpCircle,
  Quote,
  Table as TableIcon,
  PlayCircle,
  Award,
  List,
  Sun,
  Moon,
  Send,
  X,
  Maximize2,
  ArrowUpRight,
  Zap,
  TrendingUp,
  Flame,
  Eye,
  Compass,
  Rss,
  Newspaper,
  ShieldCheck,
  Check,
  AlertCircle,
  FileDown,
  Download,
  GraduationCap,
  ShoppingBag,
} from "lucide-react";
import { NewsArticle, ArticleBlock } from "../../types";
import {
  fetchPublishedArticles,
  fetchArticleBySlug,
  fetchArticleCategories,
  injectInternalLinks,
} from "../../utils/articleStorage";
import ShareModal, { ShareData } from "../ShareModal";
import { updateSEOHead } from "../../utils/seoHelper";
import { SITE_CONFIG } from "../../config/siteConfig";
import { parseSmartText } from "../../utils/smartArticleImporter";
import {
  ArticleCalloutBox,
  AutoIdentifiedCallout,
  identifyCalloutFromContent,
} from "./ArticleCallouts";
import {
  ArticleTable,
  renderParagraphOrTable,
  hasMarkdownTable,
  GfmMarkdown,
} from "./ArticleTable";
import { RawHtmlArticleViewer } from "./RawHtmlArticleViewer";

interface NewsPageProps {
  initialSlug?: string | null;
  isAuthenticated: boolean;
  onOpenLogin: () => void;
  onNavigateHome: () => void;
  onSelectArticleSlug?: (slug: string | null) => void;
  onNavigateAdminNews?: () => void;
  onNavigateTab?: (tab: any) => void;
  isAdmin?: boolean;
}

export const NewsPage: React.FC<NewsPageProps> = ({
  initialSlug,
  isAuthenticated,
  onOpenLogin,
  onNavigateHome,
  onSelectArticleSlug,
  onNavigateAdminNews,
  onNavigateTab,
  isAdmin = false,
}) => {
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [dynamicCategories, setDynamicCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSlug, setSelectedSlug] = useState<string | null>(initialSlug || null);
  const [activeArticle, setActiveArticle] = useState<NewsArticle | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [shareData, setShareData] = useState<ShareData | null>(null);
  const [readingProgress, setReadingProgress] = useState(0);
  const [tocOpen, setTocOpen] = useState(true);
  const [activeSectionId, setActiveSectionId] = useState<string>("");
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      return document.documentElement.classList.contains("dark");
    }
    return false;
  });
  const [singleLoading, setSingleLoading] = useState<boolean>(false);
  const [zoomedImage, setZoomedImage] = useState<{ url: string; alt: string } | null>(null);

  // Sync dark mode state with document
  const toggleDarkMode = () => {
    const nextMode = !isDarkMode;
    setIsDarkMode(nextMode);
    if (nextMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  };

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [list, catList] = await Promise.all([
          fetchPublishedArticles(),
          fetchArticleCategories(),
          import("../../utils/articleStorage").then(m => m.fetchAndCacheLinkRules())
        ]);
        setArticles(list);
        setDynamicCategories(catList);
      } catch (err) {
        console.warn("Failed to load articles/categories/rules:", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  useEffect(() => {
    if (initialSlug !== undefined) {
      setSelectedSlug(initialSlug);
    }
  }, [initialSlug]);

  // Handle Scroll Progress & Section Highlighting for Active Article
  useEffect(() => {
    const handleScroll = () => {
      const totalHeight = document.documentElement.scrollHeight - window.innerHeight;
      if (totalHeight > 0) {
        const currentProgress = (window.scrollY / totalHeight) * 100;
        setReadingProgress(Math.min(100, Math.max(0, currentProgress)));
      }

      // Check active heading section
      if (activeArticle) {
        const headings = document.querySelectorAll("article h2[id], article h3[id]");
        let currentActive = "";
        headings.forEach((h) => {
          const rect = h.getBoundingClientRect();
          if (rect.top <= 140) {
            currentActive = h.id;
          }
        });
        if (currentActive) {
          setActiveSectionId(currentActive);
        }
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [activeArticle]);

  useEffect(() => {
    if (!selectedSlug) {
      setActiveArticle(null);
      updateSEOHead({
        title: "Exam News, Economic Analysis & Preparation Guides — DISHA 20-20",
        description:
          "Stay updated with Rajasthan Economic Survey highlights, RPSC RAS exam strategies, notification updates, and preparation guides on DISHA 20-20.",
        canonicalUrl:
          typeof window !== "undefined"
            ? `${window.location.origin}/news`
            : `${SITE_CONFIG.domain}/news`,
        ogType: "website",
      });
      return;
    }
    async function loadSingle() {
      setSingleLoading(true);
      try {
        const art = await fetchArticleBySlug(selectedSlug!);
        setActiveArticle(art);
        const origin =
          typeof window !== "undefined" ? window.location.origin : SITE_CONFIG.domain;

        if (art) {
          const fullUrl = `${origin}/news/${art.slug}`;
          const jsonLdSchemas: object[] = [
            {
              "@context": "https://schema.org",
              "@type": "NewsArticle",
              headline: art.title,
              description: art.excerpt,
              image: [art.coverImageUrl || `${origin}/logo.svg`],
              datePublished: art.publishedAt || art.createdAt,
              dateModified: art.updatedAt || art.publishedAt || art.createdAt,
              author: [{ "@type": "Person", name: art.authorName || "DISHA 20-20 Editorial Team" }],
              publisher: {
                "@type": "Organization",
                name: "DISHA 20-20",
                logo: { "@type": "ImageObject", url: `${origin}/logo.svg` },
              },
              mainEntityOfPage: { "@type": "WebPage", "@id": fullUrl },
            },
            {
              "@context": "https://schema.org",
              "@type": "BreadcrumbList",
              itemListElement: [
                { "@type": "ListItem", position: 1, name: "Home", item: origin },
                { "@type": "ListItem", position: 2, name: "Exam News & Guides", item: `${origin}/news` },
                { "@type": "ListItem", position: 3, name: art.title, item: fullUrl },
              ],
            },
          ];

          if (art.faqs && art.faqs.length > 0) {
            jsonLdSchemas.push({
              "@context": "https://schema.org",
              "@type": "FAQPage",
              mainEntity: art.faqs.map((f) => ({
                "@type": "Question",
                name: f.question,
                acceptedAnswer: {
                  "@type": "Answer",
                  text: f.answer,
                },
              })),
            });
          }

          updateSEOHead({
            title: art.seoTitle ? `${art.seoTitle} | DISHA 20-20` : `${art.title} — DISHA 20-20 Editorial`,
            description: art.seoDescription || art.excerpt || art.title,
            canonicalUrl: fullUrl,
            ogType: "article",
            ogImage: art.coverImageUrl,
            publishedAt: art.publishedAt || art.createdAt,
            modifiedAt: art.updatedAt || art.publishedAt || art.createdAt,
            authorName: art.authorName || "DISHA 20-20 Editorial Team",
            category: art.category,
            jsonLdSchemas,
          });
        } else {
          updateSEOHead({
            title: "Article Not Found | DISHA 20-20",
            description: "The requested article could not be found or may have been unlisted.",
            canonicalUrl: `${origin}/news`,
            ogType: "website",
          });
        }
      } catch (err) {
        console.warn("loadSingle article error:", err);
      } finally {
        setSingleLoading(false);
      }
    }
    loadSingle();
  }, [selectedSlug]);

  const handleSelectArticle = (slug: string) => {
    setSelectedSlug(slug);
    onSelectArticleSlug?.(slug);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleBackToList = () => {
    if (typeof window !== "undefined" && window.history.length > 1 && window.location.pathname.startsWith("/news/")) {
      window.history.back();
    } else {
      setSelectedSlug(null);
      setActiveArticle(null);
      onSelectArticleSlug?.(null);
    }
  };

  const handleOpenShare = (art?: NewsArticle | null) => {
    const targetArt = art || activeArticle;
    if (!targetArt) return;

    const origin = typeof window !== "undefined" ? window.location.origin : SITE_CONFIG.domain;
    const fullUrl = `${origin}/news/${targetArt.slug}`;
    setShareData({
      title: targetArt.title,
      text: targetArt.excerpt || "Read the complete update and preparation guide on DISHA 20-20.",
      url: fullUrl,
      category: targetArt.category || "DISHA 20-20 Exam Guide",
    });
  };

  const handleNativeOrModalShare = async (art?: NewsArticle | null) => {
    const targetArt = art || activeArticle;
    if (!targetArt) return;

    const origin = typeof window !== "undefined" ? window.location.origin : SITE_CONFIG.domain;
    const fullUrl = `${origin}/news/${targetArt.slug}`;

    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title: targetArt.title,
          text: targetArt.excerpt || "Read this complete update and preparation guide on DISHA 20-20.",
          url: fullUrl,
        });
        return;
      } catch (err: any) {
        if (err && err.name === "AbortError") return;
      }
    }
    handleOpenShare(targetArt);
  };

  const categories = [
    "All",
    ...(dynamicCategories.length > 0
      ? dynamicCategories
      : [
          "Economics & Survey",
          "Exam Notification",
          "Study Strategy",
          "Current Affairs",
          "General",
        ]),
  ];

  const filteredArticles = useMemo(() => {
    return articles.filter((a) => {
      const matchCategory = selectedCategory === "All" || a.category === selectedCategory;
      const q = searchQuery.toLowerCase().trim();
      const matchQuery =
        !q ||
        a.title.toLowerCase().includes(q) ||
        a.excerpt.toLowerCase().includes(q) ||
        (a.hindiTitle && a.hindiTitle.toLowerCase().includes(q));
      return matchCategory && matchQuery;
    });
  }, [articles, selectedCategory, searchQuery]);

  // Featured Hero Article (First published article marked featured or latest)
  const heroArticle = useMemo(() => {
    if (filteredArticles.length === 0) return null;
    return filteredArticles.find((a) => a.isFeatured) || filteredArticles[0];
  }, [filteredArticles]);

  // Remaining articles excluding hero article when on 'All' category and no search
  const gridArticles = useMemo(() => {
    if (!heroArticle || searchQuery.trim() || selectedCategory !== "All") {
      return filteredArticles;
    }
    return filteredArticles.filter((a) => a.id !== heroArticle.id);
  }, [filteredArticles, heroArticle, searchQuery, selectedCategory]);

  // Smart recommendation engine for Related Articles
  const relatedArticles = useMemo(() => {
    if (!activeArticle || !articles || articles.length === 0) return [];

    const otherArticles = articles.filter(
      (a) => a.id !== activeArticle.id && a.slug !== activeArticle.slug
    );

    if (otherArticles.length === 0) return [];

    const currentCategory = activeArticle.category;
    const currentKeyword = activeArticle.focusKeyword ? activeArticle.focusKeyword.toLowerCase() : "";
    const currentTags = (activeArticle.tags || []).map((t: string) => t.toLowerCase());

    const scored = otherArticles.map((art) => {
      let score = 0;
      if (art.category === currentCategory) score += 10;

      if (currentKeyword && art.focusKeyword && art.focusKeyword.toLowerCase().includes(currentKeyword)) {
        score += 5;
      }

      const artTags = (art.tags || []).map((t: string) => t.toLowerCase());
      artTags.forEach((t: string) => {
        if (currentTags.includes(t)) score += 3;
      });

      return { article: art, score };
    });

    scored.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      const dateA = new Date(a.article.publishedAt || a.article.createdAt).getTime();
      const dateB = new Date(b.article.publishedAt || b.article.createdAt).getTime();
      return dateB - dateA;
    });

    return scored.slice(0, 4).map((s) => s.article);
  }, [activeArticle, articles]);

  const getReadingTime = (text?: string) => {
    const words = text ? text.split(/\s+/).filter(Boolean).length : 250;
    const minutes = Math.max(1, Math.ceil(words / 180));
    return `${minutes} min read`;
  };

  // 1. Unified Blocks: Use stored blocks or dynamically parse Markdown / Text
  const effectiveBlocks = useMemo<ArticleBlock[]>(() => {
    if (!activeArticle) return [];
    if (activeArticle.blocks && activeArticle.blocks.length > 0) {
      return activeArticle.blocks;
    }
    if (activeArticle.content && activeArticle.content.trim()) {
      const parsed = parseSmartText(activeArticle.content);
      return parsed.article.blocks || [];
    }
    return [];
  }, [activeArticle]);

  // 2. Generate Table of Contents with Hierarchical Numbering (1. for H2, 1.1 for H3)
  const tableOfContents = useMemo(() => {
    const items: {
      id: string;
      numbering: string;
      text: string;
      level: 2 | 3;
    }[] = [];

    // Parse from raw HTML if present
    if (activeArticle?.content && activeArticle.content.trim()) {
      if (typeof window !== "undefined") {
        try {
          const parser = new DOMParser();
          const doc = parser.parseFromString(activeArticle.content, "text/html");
          const headings = doc.querySelectorAll("h2, h3");
          let h2Counter = 0;
          let h3Counter = 0;

          headings.forEach((h, idx) => {
            const cleanText = h.textContent?.trim() || "";
            if (!cleanText) return;
            const lower = cleanText.toLowerCase();
            if (
              lower.startsWith("faq") ||
              lower.startsWith("frequently asked") ||
              lower.includes("अक्सर पूछे") ||
              lower.includes("सवाल और जवाब") ||
              lower.startsWith("cta") ||
              lower.includes("call to action") ||
              lower.includes("practice free mcqs")
            ) {
              return;
            }

            const isH2 = h.tagName.toLowerCase() === "h2";
            const headingId = h.id || `heading-anchor-${idx}`;

            if (isH2) {
              h2Counter++;
              h3Counter = 0;
              items.push({
                id: headingId,
                numbering: `${h2Counter}.`,
                text: cleanText,
                level: 2,
              });
            } else {
              h3Counter++;
              const num = h2Counter > 0 ? `${h2Counter}.${h3Counter}` : `${h3Counter}.`;
              items.push({
                id: headingId,
                numbering: num,
                text: cleanText,
                level: 3,
              });
            }
          });

          if (items.length > 0) return items;
        } catch (e) {
          console.error("Error parsing TOC from HTML:", e);
        }
      }
    }

    // Fallback for legacy block-based articles
    if (!effectiveBlocks || effectiveBlocks.length === 0) return [];
    let h2Counter = 0;
    let h3Counter = 0;

    effectiveBlocks.forEach((b, idx) => {
      if (b.type !== "heading" || !b.text) return;
      const cleanText = b.text.trim();
      const lower = cleanText.toLowerCase();

      // Exclude FAQ, CTA, and metadata labels from TOC
      if (
        lower.startsWith("faq") ||
        lower.startsWith("frequently asked") ||
        lower.includes("अक्सर पूछे") ||
        lower.includes("सवाल और जवाब") ||
        lower.startsWith("cta") ||
        lower.includes("call to action") ||
        lower.includes("practice free mcqs")
      ) {
        return;
      }

      const level = b.level === 3 ? 3 : (b.level === 2 ? 2 : (b.level === 1 || b.level === 4 ? null : 2));
      if (!level) return;

      if (level === 2) {
        h2Counter++;
        h3Counter = 0;
        items.push({
          id: `heading-anchor-${idx}`,
          numbering: `${h2Counter}.`,
          text: cleanText,
          level: 2,
        });
      } else if (level === 3) {
        h3Counter++;
        const num = h2Counter > 0 ? `${h2Counter}.${h3Counter}` : `${h3Counter}.`;
        items.push({
          id: `heading-anchor-${idx}`,
          numbering: num,
          text: cleanText,
          level: 3,
        });
      }
    });

    return items;
  }, [activeArticle?.content, effectiveBlocks]);

  const handleInternalLinkClick = (url: string) => {
    if (!url) return;
    
    // Check if it's an article link
    if (url.includes("/news/")) {
      const slug = url.split("/news/").pop()?.split("?")[0].split("#")[0];
      if (slug) {
        handleSelectArticle(slug);
        return;
      }
    }

    // Check for other app tabs
    const tabMappings: Record<string, string> = {
      "/topics": "topics",
      "/live_tests": "live_tests",
      "/pyq_vault": "pyq_vault",
      "/profile": "profile",
      "/news": "news",
      "/about": "about",
      "/contact": "contact",
      "/privacy-policy": "privacy-policy",
      "/terms-of-service": "terms-of-service",
      "/disclaimer": "disclaimer"
    };

    const matchedTab = tabMappings[url] || (url.startsWith("/") ? tabMappings[url.split("?")[0]] : null);
    if (matchedTab && onNavigateTab) {
      if (matchedTab === "news") {
        handleBackToList();
      } else {
        onNavigateTab(matchedTab);
      }
      return;
    }

    // Fallback for unknown internal links: if it's relative, maybe it's home or just reload
    if (url.startsWith("/")) {
      onNavigateHome();
    }
  };

  const renderFormattedTextWithLinks = (text?: string) => {
    if (!text) return null;
    const trimmed = text.trim();
    if (trimmed === "---" || trimmed === "___" || trimmed === "***") {
      return (
        <div className="my-8 flex items-center justify-center gap-3">
          <span className="h-px bg-gradient-to-r from-transparent via-[#C99A45]/50 to-transparent flex-1" />
          <span className="w-1.5 h-1.5 rotate-45 bg-[#C99A45]" />
          <span className="h-px bg-gradient-to-r from-transparent via-[#C99A45]/50 to-transparent flex-1" />
        </div>
      );
    }

    const parts: React.ReactNode[] = [];
    const regex = /(\*\*.*?\*\*|\*.*?\*|`.*?`|\[.*?\]\(.*?\))/g;
    const tokens = text.split(regex);

    tokens.forEach((token, idx) => {
      if (!token) return;
      if (token.startsWith("**") && token.endsWith("**") && token.length >= 4) {
        parts.push(
          <strong key={idx} className="font-extrabold text-[#171923] dark:text-[#FFF9EF]">
            {token.slice(2, -2)}
          </strong>
        );
      } else if (token.startsWith("*") && token.endsWith("*") && token.length >= 2) {
        parts.push(
          <em key={idx} className="italic text-[#171923] dark:text-[#FFF9EF]/90">
            {token.slice(1, -1)}
          </em>
        );
      } else if (token.startsWith("`") && token.endsWith("`") && token.length >= 2) {
        parts.push(
          <code key={idx} className="px-1.5 py-0.5 rounded-md bg-[#F7EFE2] dark:bg-[#252A3A] text-xs font-mono font-bold text-[#800020] dark:text-[#F47B20] border border-[#E8D9C0] dark:border-[#31374A]">
            {token.slice(1, -1)}
          </code>
        );
      } else if (token.startsWith("[") && token.includes("](")) {
        const match = token.match(/\[(.*?)\]\((.*?)\)/);
        if (match) {
          const label = match[1];
          const url = match[2];
          const isInternal = url.includes("/news/") || url.startsWith("/");
          
          const handleClick = (e: React.MouseEvent) => {
            if (isInternal) {
              e.preventDefault();
              handleInternalLinkClick(url);
            }
          };

          parts.push(
            <a
              key={idx}
              href={url}
              onClick={handleClick}
              target={isInternal ? "_self" : "_blank"}
              rel={!isInternal ? "noopener noreferrer" : undefined}
              className="text-[#800020] dark:text-[#F47B20] font-extrabold underline underline-offset-4 hover:text-[#5E0017] dark:hover:text-[#E06A12] transition-colors cursor-pointer"
            >
              {label}
            </a>
          );
        } else {
          parts.push(token);
        }
      } else {
        parts.push(token);
      }
    });

    return parts;
  };

  // ─────────────────────────────────────────────────────────────
  // RENDERER FOR INDIVIDUAL RICH ARTICLE BLOCKS
  // ─────────────────────────────────────────────────────────────
  const renderBlock = (blk: ArticleBlock, idx: number) => {
    const anchorId = `heading-anchor-${idx}`;

    switch (blk.type) {
      case "heading": {
        if (blk.level === 1) {
          return (
            <h1
              key={blk.id || idx}
              id={anchorId}
              className="text-2xl sm:text-3xl font-black text-[#171923] dark:text-[#FFF9EF] mt-10 mb-4 scroll-mt-24 font-hindi tracking-tight leading-snug break-words"
            >
              {blk.text}
            </h1>
          );
        }
        if (blk.level === 3) {
          return (
            <h3
              key={blk.id || idx}
              id={anchorId}
              className="text-lg sm:text-xl font-bold text-[#800020] dark:text-[#F47B20] mt-7 mb-3 scroll-mt-24 font-hindi tracking-tight leading-snug break-words"
            >
              {blk.text}
            </h3>
          );
        }
        if (blk.level === 4) {
          return (
            <h4
              key={blk.id || idx}
              id={anchorId}
              className="text-base sm:text-lg font-bold text-[#171923] dark:text-[#FFF9EF] mt-5 mb-2 scroll-mt-24 font-hindi tracking-tight leading-snug break-words"
            >
              {blk.text}
            </h4>
          );
        }
        return (
          <h2
            key={blk.id || idx}
            id={anchorId}
            className="text-xl sm:text-2xl font-black text-[#171923] dark:text-[#FFF9EF] mt-10 mb-4 pt-4 border-t border-[#E8D9C0] dark:border-[#31374A] scroll-mt-24 font-hindi tracking-tight leading-snug break-words"
          >
            {blk.text}
          </h2>
        );
      }

      case "intro":
        return (
          <div
            key={blk.id || idx}
            className="my-6 p-5 sm:p-6 rounded-2xl sm:rounded-3xl bg-[#F7EFE2]/70 dark:bg-[#1F2330] border border-[#E8D9C0] dark:border-[#31374A] shadow-xs space-y-2.5"
          >
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-[#800020] dark:text-[#F47B20]">
              <BookOpen className="w-4 h-4 shrink-0" />
              <span>ARTICLE OVERVIEW &amp; INTRO</span>
            </div>
            <p className="text-[17px] sm:text-[18.5px] leading-[1.8] font-medium text-[#171923] dark:text-[#FFF9EF] break-words">
              {renderFormattedTextWithLinks(injectInternalLinks(blk.text))}
            </p>
          </div>
        );

      case "conclusion":
        return (
          <div
            key={blk.id || idx}
            className="my-8 p-6 sm:p-7 rounded-2xl sm:rounded-3xl bg-gradient-to-br from-[#FFF9EF] via-[#F7EFE2]/70 to-[#FFF9EF] dark:from-[#1F2330] dark:via-[#252A3A]/70 dark:to-[#1F2330] border border-[#C99A45]/40 dark:border-[#C99A45]/30 shadow-xs space-y-3"
          >
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-[#800020] dark:text-[#F47B20]">
              <CheckCircle2 className="w-4 h-4 text-[#800020] dark:text-[#F47B20]" />
              <span>Conclusion &amp; Final Takeaways</span>
            </div>
            <p className="text-[17px] sm:text-[18.5px] leading-[1.8] font-normal text-[#171923] dark:text-[#FFF9EF]/90 break-words">
              {renderFormattedTextWithLinks(injectInternalLinks(blk.text))}
            </p>
          </div>
        );

      case "paragraph": {
        const pText = blk.text || "";
        const detected = identifyCalloutFromContent(pText);
        if (detected.matchedPattern) {
          return (
            <ArticleCalloutBox
              key={blk.id || idx}
              variant={detected.variant}
              text={detected.cleanText}
              renderFormattedText={renderFormattedTextWithLinks}
            />
          );
        }
        if (hasMarkdownTable(pText)) {
          return (
            <div key={blk.id || idx} className="my-5 overflow-x-auto rounded-2xl border border-[#E8D9C0] dark:border-[#31374A] shadow-xs">
              <GfmMarkdown content={injectInternalLinks(pText)} onLinkClick={handleInternalLinkClick} />
            </div>
          );
        }
        return (
          <p
            key={blk.id || idx}
            className="text-[17.5px] sm:text-[19px] leading-[1.85] font-normal text-[#171923] dark:text-[#FFF9EF]/90 my-5 max-w-[720px] break-words tracking-normal"
          >
            {renderFormattedTextWithLinks(injectInternalLinks(blk.text))}
          </p>
        );
      }

      case "key_points":
        if (!blk.listItems || blk.listItems.length === 0) return null;
        return (
          <div
            key={blk.id || idx}
            className="my-7 p-5 sm:p-6 rounded-2xl sm:rounded-3xl bg-emerald-50/70 dark:bg-emerald-950/25 border border-emerald-200 dark:border-emerald-800/50 space-y-3.5 shadow-xs"
          >
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
              <CheckSquare className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>KEY TAKEAWAYS &amp; SUMMARY POINTS</span>
            </div>
            <ul className="space-y-3 pl-1">
              {blk.listItems.map((item, i) => (
                <li
                  key={i}
                  className="flex items-start gap-3 text-sm sm:text-base font-semibold text-emerald-950 dark:text-emerald-100 leading-relaxed break-words"
                >
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-1" />
                  <span>{renderFormattedTextWithLinks(item)}</span>
                </li>
              ))}
            </ul>
          </div>
        );

      case "callout":
        return (
          <AutoIdentifiedCallout
            key={blk.id || idx}
            rawText={blk.text || ""}
            explicitVariant={blk.calloutType}
            renderFormattedText={renderFormattedTextWithLinks}
          />
        );

      case "list":
        return (
          <div key={blk.id || idx} className="my-5 max-w-[700px]">
            {blk.listType === "numbered" ? (
              <ol className="space-y-2.5 pl-6 list-decimal text-[17.5px] sm:text-[18.5px] text-[#171923] dark:text-[#FFF9EF]/90 font-hindi leading-relaxed">
                {(blk.listItems || []).map((item, i) => (
                  <li key={i} className="pl-1 font-medium">
                    {item}
                  </li>
                ))}
              </ol>
            ) : (
              <ul className="space-y-2.5 pl-6 list-disc text-[17.5px] sm:text-[18.5px] text-[#171923] dark:text-[#FFF9EF]/90 font-hindi leading-relaxed">
                {(blk.listItems || []).map((item, i) => (
                  <li key={i} className="pl-1 font-medium">
                    {item}
                  </li>
                ))}
              </ul>
            )}
          </div>
        );

      case "quote":
        return (
          <blockquote
            key={blk.id || idx}
            className="my-7 p-6 bg-[#F7EFE2]/80 dark:bg-[#1F2330] border border-[#E8D9C0] dark:border-[#31374A] rounded-3xl text-base sm:text-lg font-bold italic text-[#171923] dark:text-[#FFF9EF] font-hindi space-y-2 shadow-xs"
          >
            <Quote className="w-6 h-6 text-[#800020]/40 dark:text-[#F47B20]/40 rotate-180" />
            <p className="leading-relaxed">"{blk.text}"</p>
          </blockquote>
        );

      case "image":
        return (
          <figure key={blk.id || idx} className="my-7 space-y-2">
            <div className="relative group overflow-hidden rounded-3xl border border-[#E8D9C0] dark:border-[#31374A] bg-[#F7EFE2] dark:bg-[#1F2330] aspect-[16/9] max-h-96 shadow-sm">
              <img
                src={blk.imageUrl}
                alt={blk.imageAlt || "Article Image"}
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover group-hover:scale-102 transition-transform duration-300 cursor-zoom-in"
                onClick={() =>
                  setZoomedImage({
                    url: blk.imageUrl || "",
                    alt: blk.imageAlt || "Article Image",
                  })
                }
                loading="lazy"
              />
              <button
                onClick={() =>
                  setZoomedImage({
                    url: blk.imageUrl || "",
                    alt: blk.imageAlt || "Article Image",
                  })
                }
                className="absolute top-3 right-3 p-2 bg-black/60 hover:bg-black/80 text-white rounded-xl backdrop-blur-xs opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                title="Expand image"
              >
                <Maximize2 className="w-4 h-4" />
              </button>
            </div>
            {blk.imageAlt && (
              <figcaption className="text-center text-xs text-[#52576A] dark:text-[#CBD2E1] italic">
                {blk.imageAlt}
              </figcaption>
            )}
          </figure>
        );

      case "table":
        return (
          <ArticleTable
            key={blk.id || idx}
            headers={blk.tableHeaders}
            rows={blk.tableRows || []}
            alignments={blk.tableAlignments}
            caption={blk.tableCaption}
            renderCell={(cell) => renderFormattedTextWithLinks(injectInternalLinks(cell))}
          />
        );

      case "related_quiz":
        return (
          <div
            key={blk.id || idx}
            className="my-8 p-6 rounded-3xl bg-gradient-to-br from-[#FFF9EF] to-[#F7EFE2] dark:from-[#1F2330] dark:to-[#252A3A] border border-[#E8D9C0] dark:border-[#31374A] flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-[#800020] text-[#FFF9EF] flex items-center justify-center font-black shrink-0 shadow-md shadow-[#800020]/20">
                <BookOpen className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-[#800020] dark:text-[#F47B20]">
                  DISHA 20-20 · Related Quiz Topic
                </span>
                <h4 className="text-sm sm:text-base font-extrabold text-[#171923] dark:text-[#FFF9EF] mt-0.5">
                  {blk.relatedQuizTopicTitle || "Practice Related Questions"}
                </h4>
                <p className="text-xs text-[#52576A] dark:text-[#CBD2E1] mt-0.5">
                  Practice free MCQs with detailed explanations &amp; timer on DISHA 20-20
                </p>
              </div>
            </div>
            <button
              onClick={onNavigateHome}
              className="w-full sm:w-auto px-5 py-2.5 bg-[#800020] hover:bg-[#5E0017] dark:bg-[#F47B20] dark:hover:bg-[#E06A12] text-white rounded-xl text-xs font-black transition-all shadow-md active:scale-95 cursor-pointer shrink-0 text-center whitespace-nowrap"
            >
              Practice Free MCQs →
            </button>
          </div>
        );

      case "cta":
        return (
          <div
            key={blk.id || idx}
            className="my-8 p-6 sm:p-7 rounded-3xl bg-gradient-to-r from-[#800020] via-[#6A001A] to-[#4A0012] text-white border border-[#C99A45]/30 flex flex-col sm:flex-row items-center justify-between gap-5 shadow-xl relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-48 h-48 bg-[#F47B20]/15 rounded-full blur-2xl pointer-events-none" />
            <div className="space-y-1.5 text-center sm:text-left relative z-10">
              <span className="inline-block text-[10px] font-black uppercase tracking-wider text-[#C99A45]">
                DISHA 20-20 · Free Mock Simulation
              </span>
              <h4 className="text-base sm:text-lg font-black text-white">
                {blk.ctaText || "Test Your Preparation Level"}
              </h4>
              <p className="text-xs text-[#FFF9EF]/80 max-w-md">
                Practice topic-wise MCQs with official timer, negative marking, and instant answers on DISHA 20-20.
              </p>
            </div>
            <button
              onClick={onNavigateHome}
              className="w-full sm:w-auto px-5 py-3 bg-[#F47B20] hover:bg-[#E06A12] text-white font-black rounded-xl text-xs transition-all shadow-md active:scale-95 cursor-pointer shrink-0 flex items-center justify-center gap-1.5 relative z-10 whitespace-nowrap"
            >
              <span>Practice Free MCQs</span>
              <ArrowRightIcon className="w-4 h-4" />
            </button>
          </div>
        );

      case "diagram":
        return (
          <div
            key={blk.id || idx}
            className="my-10 p-1 bg-gradient-to-br from-[#F7EFE2] to-[#E8D9C0]/60 dark:from-[#252A3A] dark:to-[#1F2330] rounded-3xl border border-[#E8D9C0] dark:border-[#31374A] shadow-xs"
          >
            <div className="bg-white dark:bg-[#171923] rounded-[22px] p-6 sm:p-8">
              {blk.diagramType === "active_recall" && (
                <div className="flex flex-col items-center space-y-8 py-4">
                  <div className="flex flex-wrap justify-center gap-4 sm:gap-12 relative">
                    <div className="flex flex-col items-center gap-3 group">
                      <div className="w-20 h-20 rounded-2xl bg-[#800020]/10 text-[#800020] dark:text-[#F47B20] flex items-center justify-center group-hover:scale-105 transition-transform">
                        <HelpCircle className="w-10 h-10" />
                      </div>
                      <span className="text-sm font-black uppercase text-[#171923] dark:text-[#FFF9EF]">
                        Question
                      </span>
                    </div>
                    <div className="flex flex-col items-center gap-3 group">
                      <div className="w-20 h-20 rounded-2xl bg-[#F47B20]/15 text-[#F47B20] flex items-center justify-center group-hover:scale-105 transition-transform">
                        <Sparkles className="w-10 h-10" />
                      </div>
                      <span className="text-sm font-black uppercase text-[#171923] dark:text-[#FFF9EF]">
                        Retrieve
                      </span>
                    </div>
                    <div className="flex flex-col items-center gap-3 group">
                      <div className="w-20 h-20 rounded-2xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center group-hover:scale-105 transition-transform">
                        <CheckCircle2 className="w-10 h-10" />
                      </div>
                      <span className="text-sm font-black uppercase text-[#171923] dark:text-[#FFF9EF]">
                        Correct
                      </span>
                    </div>
                  </div>
                  <div className="max-w-md text-center space-y-2">
                    <h4 className="text-lg font-black text-[#171923] dark:text-[#FFF9EF]">
                      Active Recall Cycle
                    </h4>
                    <p className="text-xs text-[#52576A] dark:text-[#CBD2E1]">
                      Try to recall before checking answers (Retrieval Practice) to reinforce neural connections.
                    </p>
                  </div>
                </div>
              )}

              {blk.diagramType === "spaced_repetition" && (
                <div className="space-y-6 py-4">
                  <div className="h-48 w-full relative flex items-end justify-between border-b-2 border-l-2 border-[#E8D9C0] dark:border-[#31374A] pb-2 pl-2">
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-10">
                      <TrendingUp className="w-32 h-32 text-[#800020] rotate-180" />
                    </div>

                    {[
                      { label: "Day 0", h: "h-full", color: "bg-[#800020]" },
                      { label: "Day 1", h: "h-[85%]", color: "bg-[#9E1B32]" },
                      { label: "Day 3", h: "h-[90%]", color: "bg-[#C99A45]" },
                      { label: "Day 7", h: "h-[95%]", color: "bg-[#F47B20]" },
                      { label: "Day 14", h: "h-full", color: "bg-emerald-600" },
                    ].map((bar, i) => (
                      <div key={i} className="flex flex-col items-center gap-2 flex-1 group">
                        <div
                          className={`w-4 sm:w-8 ${bar.h} ${bar.color} rounded-t-lg transition-all group-hover:brightness-110`}
                        />
                        <span className="text-[10px] font-bold text-[#52576A] dark:text-[#CBD2E1] tabular-nums">{bar.label}</span>
                      </div>
                    ))}
                  </div>
                  <div className="text-center space-y-2">
                    <h4 className="text-lg font-black text-[#171923] dark:text-[#FFF9EF]">
                      Spaced Repetition Curve
                    </h4>
                    <p className="text-xs text-[#52576A] dark:text-[#CBD2E1]">
                      Systematic revision intervals preserve long-term memory retention near 100%.
                    </p>
                  </div>
                </div>
              )}

              {blk.diagramType === "pomodoro" && (
                <div className="flex flex-col items-center gap-6 py-4">
                  <div className="w-32 h-32 rounded-full border-8 border-[#800020]/15 dark:border-[#F47B20]/20 flex items-center justify-center relative">
                    <div className="w-24 h-24 rounded-full border-8 border-[#800020] dark:border-[#F47B20] border-t-transparent flex items-center justify-center">
                      <Clock className="w-10 h-10 text-[#800020] dark:text-[#F47B20]" />
                    </div>
                    <div className="absolute -top-4 bg-[#800020] text-white text-[10px] font-black px-2 py-1 rounded-lg tabular-nums">
                      25 MIN
                    </div>
                    <div className="absolute -bottom-4 bg-emerald-600 text-white text-[10px] font-black px-2 py-1 rounded-lg tabular-nums">
                      5 MIN BREAK
                    </div>
                  </div>
                  <div className="text-center space-y-2">
                    <h4 className="text-lg font-black text-[#171923] dark:text-[#FFF9EF]">
                      Pomodoro Focus Timer
                    </h4>
                    <p className="text-xs text-[#52576A] dark:text-[#CBD2E1]">
                      25 minutes of deep focus followed by a 5-minute break prevents mental fatigue.
                    </p>
                  </div>
                </div>
              )}
            </div>
            {blk.text && (
              <div className="px-6 py-3 text-center text-xs font-bold text-[#52576A] dark:text-[#CBD2E1] border-t border-[#E8D9C0] dark:border-[#31374A]">
                {blk.text}
              </div>
            )}
          </div>
        );

      case "faq":
        return (
          <div
            key={blk.id || idx}
            className="my-8 p-6 sm:p-7 rounded-3xl bg-white dark:bg-[#1F2330] border border-[#E8D9C0] dark:border-[#31374A] shadow-xs space-y-4"
          >
            <div className="flex items-center gap-2.5 text-xs font-black uppercase tracking-wider text-[#800020] dark:text-[#F47B20]">
              <div className="w-7 h-7 rounded-lg bg-[#800020]/10 dark:bg-[#F47B20]/15 text-[#800020] dark:text-[#F47B20] flex items-center justify-center font-black">
                ?
              </div>
              <span>Frequently Asked Questions (FAQ)</span>
            </div>
            <div className="space-y-3 pt-1">
              {(blk.faqs || []).map((faq, fIdx) => (
                <details
                  key={fIdx}
                  className="group bg-[#FFF9EF] dark:bg-[#171923] rounded-2xl border border-[#E8D9C0] dark:border-[#31374A] p-4 transition-all"
                >
                  <summary className="flex items-center justify-between font-extrabold text-sm sm:text-base text-[#171923] dark:text-[#FFF9EF] cursor-pointer select-none font-hindi list-none gap-3">
                    <span className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-[#800020]/10 dark:bg-[#F47B20]/15 text-[#800020] dark:text-[#F47B20] text-xs flex items-center justify-center font-bold shrink-0">
                        Q
                      </span>
                      {faq.question}
                    </span>
                    <ChevronDown className="w-4 h-4 text-[#52576A] group-open:rotate-180 transition-transform shrink-0" />
                  </summary>
                  <div className="mt-3 pt-3 border-t border-[#E8D9C0] dark:border-[#31374A] text-xs sm:text-sm text-[#52576A] dark:text-[#CBD2E1] font-hindi leading-relaxed pl-7">
                    {faq.answer}
                  </div>
                </details>
              ))}
            </div>
          </div>
        );

      case "pdf_download": {
        const title = blk.pdfTitle || blk.text || "Download Official PDF Document";
        const url = blk.pdfUrl || "#";
        const badge = blk.pdfBadge || "Official PDF";
        const sizeInfo = blk.pdfFileSize || "PDF Document";
        const desc = blk.pdfDescription || "Click below to view or download the full document.";
        const btnText = blk.pdfButtonText || "Download PDF Now";

        return (
          <div
            key={blk.id || idx}
            className="my-8 p-5 sm:p-6 rounded-3xl bg-gradient-to-br from-[#FFF9EF] via-[#F7EFE2]/70 to-white dark:from-[#1F2330] dark:via-[#252A3A]/70 dark:to-[#171923] border border-[#E8D9C0] dark:border-[#31374A] shadow-sm transition-all hover:shadow-md"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-2xl bg-[#800020]/10 dark:bg-[#F47B20]/15 text-[#800020] dark:text-[#F47B20] flex items-center justify-center shrink-0 border border-[#800020]/20 dark:border-[#F47B20]/25">
                  <FileDown className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap text-[11px] font-bold">
                    <span className="text-[#800020] dark:text-[#F47B20] uppercase tracking-wider font-black">
                      {badge}
                    </span>
                    <span className="text-[#E8D9C0] dark:text-[#31374A]">·</span>
                    <span className="font-mono text-[#52576A] dark:text-[#CBD2E1] tabular-nums">
                      {sizeInfo}
                    </span>
                  </div>
                  <h4 className="text-base sm:text-lg font-black text-[#171923] dark:text-[#FFF9EF] font-hindi leading-snug">
                    {title}
                  </h4>
                  {desc && (
                    <p className="text-xs sm:text-sm text-[#52576A] dark:text-[#CBD2E1] font-hindi leading-relaxed max-w-xl">
                      {desc}
                    </p>
                  )}
                </div>
              </div>
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                download={url.startsWith("data:") ? `${title.replace(/[^a-z0-9]/gi, "_")}.pdf` : undefined}
                className="w-full sm:w-auto px-5 py-3 rounded-2xl bg-[#800020] hover:bg-[#5E0017] dark:bg-[#F47B20] dark:hover:bg-[#E06A12] active:scale-95 text-white font-black text-xs sm:text-sm transition-all shadow-md flex items-center justify-center gap-2 shrink-0 cursor-pointer text-center whitespace-nowrap"
              >
                <Download className="w-4 h-4" />
                <span>{btnText}</span>
              </a>
            </div>
          </div>
        );
      }

      case "book_course": {
        const itemType = blk.itemType || "book";
        const title = blk.itemTitle || blk.text || "Recommended Book / Course";
        const subtitle = blk.itemSubtitle || blk.itemAuthor;
        const url = blk.itemUrl || "#";
        const price = blk.itemPrice;
        const originalPrice = blk.itemOriginalPrice;
        const badge = blk.itemBadge || (itemType === "book" ? "Recommended Book" : itemType === "course" ? "Featured Course" : "Study Material");
        const features = blk.itemFeatures || [];
        const btnText = blk.itemButtonText || (itemType === "book" ? "Buy Book / Order Now" : itemType === "course" ? "Enroll in Course" : "Explore Details");
        const imageUrl = blk.itemImageUrl;

        return (
          <div
            key={blk.id || idx}
            className="my-8 rounded-3xl bg-white dark:bg-[#1F2330] border border-[#E8D9C0] dark:border-[#31374A] shadow-md overflow-hidden"
          >
            <div className="flex flex-col md:flex-row">
              {/* Product / Book Cover Thumbnail */}
              <div className="md:w-56 bg-[#F7EFE2] dark:bg-[#252A3A] shrink-0 relative overflow-hidden flex items-center justify-center p-4 border-b md:border-b-0 md:border-r border-[#E8D9C0] dark:border-[#31374A]">
                {imageUrl ? (
                  <img
                    src={imageUrl}
                    alt={title}
                    referrerPolicy="no-referrer"
                    className="max-h-48 md:max-h-60 w-auto object-contain rounded-xl shadow-md transition-transform hover:scale-105 duration-300"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-36 h-48 rounded-xl bg-gradient-to-br from-[#800020] to-[#4A0012] border border-[#C99A45]/40 text-white p-4 flex flex-col justify-between shadow-md">
                    <span className="text-[9px] font-black uppercase tracking-wider text-[#C99A45]">DISHA 20-20</span>
                    <BookOpen className="w-8 h-8 text-[#F47B20] mx-auto" />
                    <span className="text-[11px] font-bold leading-snug line-clamp-2 text-center">{title}</span>
                  </div>
                )}
                <span className="absolute top-3 left-3 px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider bg-[#800020] text-white shadow-xs">
                  {badge}
                </span>
              </div>

              {/* Details & Features */}
              <div className="p-5 sm:p-6 flex-1 flex flex-col justify-between gap-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-[#800020] dark:text-[#F47B20]">
                      <GraduationCap className="w-3.5 h-3.5" />
                      {itemType === "book" ? "Book" : itemType === "course" ? "Online Course" : "Exam Prep Resource"}
                    </span>
                    {price && (
                      <div className="flex items-center gap-2 tabular-nums">
                        <span className="text-base sm:text-lg font-black text-emerald-600 dark:text-emerald-400">
                          {price}
                        </span>
                        {originalPrice && (
                          <span className="text-xs line-through text-[#52576A] dark:text-[#CBD2E1] font-medium">
                            {originalPrice}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  <h3 className="text-lg sm:text-xl font-black text-[#171923] dark:text-[#FFF9EF] leading-snug">
                    {title}
                  </h3>
                  {subtitle && (
                    <p className="text-xs sm:text-sm text-[#52576A] dark:text-[#CBD2E1]">
                      {subtitle}
                    </p>
                  )}

                  {features.length > 0 && (
                    <ul className="pt-2 space-y-1.5">
                      {features.map((feat, fIdx) => (
                        <li key={fIdx} className="flex items-center gap-2 text-xs sm:text-sm text-[#171923] dark:text-[#FFF9EF]/90">
                          <CheckCircle2 className="w-3.5 h-3.5 text-[#800020] dark:text-[#F47B20] shrink-0" />
                          <span>{feat}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="pt-2 flex items-center justify-between gap-3 flex-wrap">
                  <div className="text-[11px] text-[#52576A] dark:text-[#CBD2E1] flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Verified Recommendation by DISHA 20-20 Editorial</span>
                  </div>
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-[#800020] hover:bg-[#5E0017] dark:bg-[#F47B20] dark:hover:bg-[#E06A12] active:scale-95 text-white font-black text-xs sm:text-sm transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap"
                  >
                    <ShoppingBag className="w-4 h-4" />
                    <span>{btnText}</span>
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>
            </div>
          </div>
        );
      }

      case "divider":
        return <hr key={blk.id || idx} className="my-8 border-[#E8D9C0] dark:border-[#31374A]" />;

      default:
        return null;
    }
  };

  const renderRajasthanHero = () => (
    <div className="w-full aspect-[16/9] max-h-[420px] rounded-3xl overflow-hidden bg-gradient-to-br from-[#800020] via-[#5E0017] to-[#2A000B] text-white relative shadow-xl flex flex-col justify-between p-6 sm:p-10 border border-[#C99A45]/35">
      <div className="absolute inset-0 opacity-20 pointer-events-none bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-[#F47B20] via-transparent to-transparent" />

      <div className="relative z-10 flex items-center justify-between">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-[#F47B20] text-white text-xs font-black uppercase tracking-wider shadow-xs">
          <Compass className="w-3.5 h-3.5" />
          <span>DISHA 20-20 · Rajasthan Exam Special</span>
        </div>
        <div className="px-3 py-1.5 rounded-xl bg-white/10 border border-[#C99A45]/40 text-[#FFF9EF] font-black flex items-center gap-1.5 text-xs shadow-sm">
          <span>DISHA</span>
          <span className="text-[#F47B20]">20-20</span>
        </div>
      </div>

      <div className="relative z-10 space-y-2 max-w-2xl">
        <h2 className="text-xl sm:text-3xl font-black text-[#FFF9EF] tracking-tight leading-snug drop-shadow-md">
          {activeArticle?.title}
        </h2>
        <p className="text-xs sm:text-sm text-[#FFF9EF]/80 font-medium">
          DISHA 20-20 Expert Research &amp; Exam Analysis · Right Direction, Accurate Preparation
        </p>
      </div>
    </div>
  );

  const renderCtaCard = (key: string | number) => (
    <div
      key={key}
      className="my-8 sm:my-10 p-6 sm:p-8 rounded-3xl bg-gradient-to-r from-[#800020] via-[#6A001A] to-[#4A0012] text-white border border-[#C99A45]/35 shadow-xl relative overflow-hidden"
    >
      <div className="absolute top-0 right-0 w-64 h-64 bg-[#F47B20]/15 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />
      <div className="relative z-10 flex flex-col sm:flex-row items-center justify-between gap-6">
        <div className="space-y-2 text-center sm:text-left">
          <span className="inline-block text-[11px] font-black uppercase tracking-wider text-[#C99A45]">
            DISHA 20-20 · Exam Prep
          </span>
          <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight">
            Test Your Knowledge — Take a Free Mock Test Today!
          </h3>
          <p className="text-xs sm:text-sm text-[#FFF9EF]/85 max-w-lg">
            Ensure success in competitive exams with topic-wise questions, official PYQ vault, and live mock tests.
          </p>
        </div>
        <button
          onClick={onNavigateHome}
          className="w-full sm:w-auto px-6 py-3.5 bg-[#F47B20] hover:bg-[#E06A12] text-white font-black rounded-2xl text-sm transition-all shadow-lg active:scale-95 cursor-pointer shrink-0 flex items-center justify-center gap-2 whitespace-nowrap"
        >
          <span>Start Free Mock Test</span>
          <ArrowRightIcon className="w-4 h-4 text-white" />
        </button>
      </div>
    </div>
  );

  function ArrowRightIcon({ className }: { className?: string }) {
    return (
      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14 5l7 7m0 0l-7 7m7-7H3" />
      </svg>
    );
  }

  // ─────────────────────────────────────────────────────────────
  // 1. PUBLIC ARTICLE DETAIL VIEW (/news/:slug)
  // ─────────────────────────────────────────────────────────────
  if (selectedSlug) {
    if (singleLoading) {
      return (
        <div className="min-h-screen bg-[#FFF9EF] dark:bg-[#171923] flex flex-col items-center justify-center p-6 text-center">
          <div className="w-12 h-12 border-4 border-[#800020] dark:border-[#F47B20] border-t-transparent rounded-full animate-spin mb-4" />
          <p className="text-[#52576A] dark:text-[#CBD2E1] font-bold">Loading article...</p>
        </div>
      );
    }

    if (!activeArticle) {
      return (
        <div className="min-h-screen bg-[#FFF9EF] dark:bg-[#171923] flex flex-col items-center justify-center p-6 text-center">
          <div className="max-w-md w-full bg-white dark:bg-[#1F2330] rounded-3xl p-8 border border-[#E8D9C0] dark:border-[#31374A] shadow-xl space-y-4">
            <div className="w-16 h-16 bg-red-100 dark:bg-red-950/50 text-red-600 rounded-2xl flex items-center justify-center mx-auto">
              <AlertCircle className="w-8 h-8" />
            </div>
            <h1 className="text-2xl font-black text-[#171923] dark:text-[#FFF9EF]">Article Not Found</h1>
            <p className="text-sm text-[#52576A] dark:text-[#CBD2E1]">
              This article is unavailable or has been removed. Please browse the main news archive.
            </p>
            <div className="pt-2">
              <button
                onClick={handleBackToList}
                className="w-full py-3.5 bg-[#800020] hover:bg-[#5E0017] dark:bg-[#F47B20] dark:hover:bg-[#E06A12] text-white font-black rounded-2xl text-sm transition-all shadow-md active:scale-95 cursor-pointer"
              >
                Back to Exam News &amp; Guides
              </button>
            </div>
          </div>
        </div>
      );
    }

    const publishedFormatted = new Date(
      activeArticle.publishedAt || activeArticle.createdAt
    ).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
    const updatedFormatted = activeArticle.updatedAt
      ? new Date(activeArticle.updatedAt).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        })
      : null;

    return (
      <article className="min-h-full bg-[#FFF9EF] dark:bg-[#171923] pb-28 text-[#171923] dark:text-[#FFF9EF] selection:bg-[#800020] selection:text-white">
        {/* Sticky Header with Scroll Reading Progress Indicator */}
        <header className="sticky top-0 z-40 bg-[#FFF9EF]/95 dark:bg-[#1F2330]/95 backdrop-blur-md border-b border-[#E8D9C0] dark:border-[#31374A] shadow-xs">
          <div className="h-1 bg-[#E8D9C0]/60 dark:bg-[#31374A] w-full">
            <div
              className="h-full bg-gradient-to-r from-[#800020] to-[#F47B20] transition-all duration-150"
              style={{ width: `${readingProgress}%` }}
            />
          </div>

          <div className="px-4 py-3 max-w-5xl mx-auto flex items-center justify-between gap-4">
            <div className="flex items-center gap-2.5 min-w-0">
              <button
                onClick={handleBackToList}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-[#252A3A] border border-[#E8D9C0] dark:border-[#31374A] text-xs font-bold text-[#171923] dark:text-[#FFF9EF] hover:border-[#800020] dark:hover:border-[#F47B20] transition-colors cursor-pointer group shrink-0"
              >
                <ArrowLeft className="w-3.5 h-3.5 text-[#800020] dark:text-[#F47B20] group-hover:-translate-x-0.5 transition-transform" />
                <span>Exam News &amp; Guides</span>
              </button>
              <span className="hidden sm:inline-block text-[11px] font-black text-[#800020] dark:text-[#C99A45] truncate">
                DISHA 20-20 · Right Direction, Accurate Preparation
              </span>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {isAdmin && onNavigateAdminNews && (
                <button
                  onClick={onNavigateAdminNews}
                  className="px-3 py-1.5 bg-[#F47B20] hover:bg-[#E06A12] text-white rounded-xl text-xs font-black transition-all shadow-xs flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                  title="Edit article in Admin panel"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Edit in Admin</span>
                </button>
              )}

              <button
                onClick={toggleDarkMode}
                className="p-2 rounded-xl bg-white dark:bg-[#252A3A] hover:bg-[#F7EFE2] dark:hover:bg-[#31374A] text-[#52576A] dark:text-[#CBD2E1] border border-[#E8D9C0] dark:border-[#31374A] transition-colors cursor-pointer"
                title="Toggle Theme"
              >
                {isDarkMode ? <Sun className="w-4 h-4 text-[#F47B20]" /> : <Moon className="w-4 h-4 text-[#800020]" />}
              </button>

              <button
                onClick={() => handleNativeOrModalShare(activeArticle)}
                className="p-2 sm:px-3 sm:py-1.5 rounded-xl bg-white hover:bg-[#F7EFE2] dark:bg-[#252A3A] dark:hover:bg-[#31374A] text-[#171923] dark:text-[#FFF9EF] border border-[#E8D9C0] dark:border-[#31374A] transition-colors cursor-pointer text-xs flex items-center gap-1.5 font-bold active:scale-95 whitespace-nowrap"
                title="Share article"
              >
                <Share2 className="w-3.5 h-3.5 text-[#800020] dark:text-[#F47B20]" />
                <span className="hidden sm:inline">Share</span>
              </button>

              {!isAuthenticated && (
                <button
                  onClick={onOpenLogin}
                  className="px-3 py-1.5 bg-[#800020] hover:bg-[#5E0017] dark:bg-[#F47B20] dark:hover:bg-[#E06A12] text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                >
                  <LogIn className="w-3.5 h-3.5" />
                  <span>Login</span>
                </button>
              )}
            </div>
          </div>
        </header>

        {/* Main Content Area */}
        <div className="max-w-4xl mx-auto px-4 py-6 sm:py-8 space-y-8">
          {/* Breadcrumb Navigation */}
          <nav className="flex items-center gap-1.5 text-xs text-[#52576A] dark:text-[#CBD2E1] font-bold">
            <button onClick={onNavigateHome} className="hover:text-[#800020] dark:hover:text-[#F47B20] transition-colors cursor-pointer">
              Home
            </button>
            <span>›</span>
            <button onClick={handleBackToList} className="hover:text-[#800020] dark:hover:text-[#F47B20] transition-colors cursor-pointer">
              Exam News &amp; Guides
            </button>
            <span>›</span>
            <span className="text-[#800020] dark:text-[#F47B20] font-extrabold truncate max-w-[200px] sm:max-w-xs">
              {activeArticle.category}
            </span>
          </nav>

          {/* Article Header */}
          <header className="space-y-4">
            <div className="flex flex-wrap items-center gap-2 text-xs font-black uppercase tracking-wider text-[#800020] dark:text-[#F47B20] tabular-nums">
              <span>{activeArticle.category}</span>
              <span className="text-[#E8D9C0] dark:text-[#31374A]">·</span>
              <span className="text-[#52576A] dark:text-[#CBD2E1] font-bold flex items-center gap-1 normal-case">
                <Clock className="w-3.5 h-3.5 text-[#800020] dark:text-[#F47B20]" />
                <span>{getReadingTime(activeArticle.content)}</span>
              </span>
            </div>

            <h1 className="text-2xl sm:text-4xl lg:text-[42px] font-black text-[#171923] dark:text-[#FFF9EF] leading-[1.22] tracking-tight font-hindi">
              {activeArticle.title}
            </h1>

            {activeArticle.excerpt && (
              <div className="p-4 sm:p-5 rounded-2xl bg-[#F7EFE2]/80 dark:bg-[#1F2330] border border-[#E8D9C0] dark:border-[#31374A]">
                <p className="text-base sm:text-lg font-medium text-[#171923] dark:text-[#FFF9EF]/90 leading-relaxed font-hindi">
                  {activeArticle.excerpt}
                </p>
              </div>
            )}

            {/* Author Bar & Date Metadata */}
            <div className="flex flex-wrap items-center justify-between gap-4 pt-3 border-y border-[#E8D9C0] dark:border-[#31374A] py-3 text-xs text-[#52576A] dark:text-[#CBD2E1]">
              <div className="flex items-center gap-3">
                {activeArticle.authorPhotoUrl ? (
                  <img
                    src={activeArticle.authorPhotoUrl}
                    alt=""
                    referrerPolicy="no-referrer"
                    className="w-10 h-10 rounded-full object-cover ring-2 ring-[#800020]/20 dark:ring-[#F47B20]/25 shadow-xs"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-[#800020] text-[#FFF9EF] flex items-center justify-center font-extrabold text-sm ring-2 ring-[#C99A45]/30">
                    {activeArticle.authorName ? activeArticle.authorName[0] : "D"}
                  </div>
                )}
                <div>
                  <p className="font-black text-[#171923] dark:text-[#FFF9EF] text-xs sm:text-sm">
                    {activeArticle.authorName || "DISHA 20-20 Editorial Team"}
                  </p>
                  <p className="text-[11px] text-[#52576A] dark:text-[#CBD2E1] font-medium">
                    DISHA 20-20 · Senior Exam Research Analyst
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 text-xs text-[#52576A] dark:text-[#CBD2E1] tabular-nums font-bold">
                <Calendar className="w-3.5 h-3.5 text-[#800020] dark:text-[#F47B20]" />
                <span>Published {publishedFormatted}</span>
                {updatedFormatted && updatedFormatted !== publishedFormatted && (
                  <>
                    <span>·</span>
                    <span>Updated {updatedFormatted}</span>
                  </>
                )}
              </div>
            </div>
          </header>

          {/* Featured Image or Default Banner */}
          <figure className="space-y-2">
            {activeArticle.coverImageUrl &&
            !activeArticle.coverImageUrl.includes("unsplash.com/photo-1599839575945") ? (
              <div className="w-full aspect-[16/9] max-h-[420px] rounded-3xl overflow-hidden bg-[#F7EFE2] dark:bg-[#1F2330] border border-[#E8D9C0] dark:border-[#31374A] shadow-xs relative">
                <img
                  src={activeArticle.coverImageUrl}
                  alt={activeArticle.title}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover cursor-zoom-in"
                  onClick={() =>
                    setZoomedImage({
                      url: activeArticle.coverImageUrl || "",
                      alt: activeArticle.title,
                    })
                  }
                />
              </div>
            ) : (
              renderRajasthanHero()
            )}
          </figure>

          {/* Layout Container: ToC Sticky Sidebar + Article Body */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Table of Contents */}
            {tableOfContents.length > 0 && (
              <aside className="lg:col-span-4 space-y-4 lg:sticky lg:top-20 order-1 lg:order-2">
                <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-[#1F2330] border border-[#E8D9C0] dark:border-[#31374A] shadow-xs">
                  <button
                    onClick={() => setTocOpen(!tocOpen)}
                    className="w-full flex items-center justify-between text-xs font-black uppercase tracking-wider text-[#171923] dark:text-[#FFF9EF] cursor-pointer select-none"
                  >
                    <span className="flex items-center gap-2">
                      <List className="w-4 h-4 text-[#800020] dark:text-[#F47B20]" />
                      <span>Table of Contents ({tableOfContents.length})</span>
                    </span>
                    {tocOpen ? (
                      <ChevronUp className="w-4 h-4 text-[#52576A]" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-[#52576A]" />
                    )}
                  </button>

                  {tocOpen && (
                    <nav className="mt-3 pt-3 border-t border-[#E8D9C0] dark:border-[#31374A] space-y-1 max-h-72 overflow-y-auto pr-1">
                      {tableOfContents.map((item) => (
                        <a
                          key={item.id}
                          href={`#${item.id}`}
                          onClick={(e) => {
                            e.preventDefault();
                            const el = document.getElementById(item.id);
                            if (el) {
                              el.scrollIntoView({ behavior: "smooth", block: "start" });
                              setActiveSectionId(item.id);
                            }
                          }}
                          className={`flex items-start gap-2 text-xs transition-colors rounded-lg px-2.5 py-1.5 leading-snug cursor-pointer ${
                            activeSectionId === item.id
                              ? "bg-[#800020]/10 dark:bg-[#F47B20]/15 text-[#800020] dark:text-[#F47B20] font-extrabold"
                              : "text-[#52576A] dark:text-[#CBD2E1] hover:text-[#171923] dark:hover:text-[#FFF9EF]"
                          } ${item.level === 3 ? "pl-5 text-[11.5px]" : "font-bold"}`}
                        >
                          <span className="font-mono font-bold shrink-0 opacity-80 tabular-nums">{item.numbering}</span>
                          <span className="truncate">{item.text}</span>
                        </a>
                      ))}
                    </nav>
                  )}
                </div>
              </aside>
            )}

            {/* Article Body Content */}
            <main
              className={`${
                tableOfContents.length > 0 ? "lg:col-span-8" : "lg:col-span-12"
              } order-2 lg:order-1 space-y-4`}
            >
              {activeArticle.content && activeArticle.content.trim() ? (
                <RawHtmlArticleViewer htmlContent={activeArticle.content} />
              ) : effectiveBlocks && effectiveBlocks.length > 0 ? (
                effectiveBlocks.map((blk, idx) => (
                  <React.Fragment key={blk.id || idx}>
                    {renderBlock(blk, idx)}
                  </React.Fragment>
                ))
              ) : (
                /* Fallback for markdown / plain text content using remark-gfm */
                <div className="space-y-4 max-w-[720px] break-words">
                  <GfmMarkdown content={injectInternalLinks(activeArticle.content || "")} />
                </div>
              )}

              {/* End-of-article CTA Card */}
              {renderCtaCard("end-cta")}

              {/* General Quiz Practice Callout Card */}
              <div className="my-8 p-5 sm:p-6 rounded-3xl bg-gradient-to-br from-[#FFF9EF] to-[#F7EFE2] dark:from-[#1F2330] dark:to-[#252A3A] border border-[#E8D9C0] dark:border-[#31374A] flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xs">
                <div className="flex items-center gap-3.5">
                  <div className="w-12 h-12 rounded-2xl bg-[#800020] text-[#FFF9EF] flex items-center justify-center font-black shrink-0 shadow-md shadow-[#800020]/20">
                    <BookOpen className="w-6 h-6" />
                  </div>
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-wider text-[#800020] dark:text-[#F47B20]">
                      DISHA 20-20 · Practice Hub
                    </span>
                    <h4 className="text-sm sm:text-base font-extrabold text-[#171923] dark:text-[#FFF9EF] mt-0.5">
                      Practice Exam Questions &amp; PYQ Vault
                    </h4>
                    <p className="text-xs text-[#52576A] dark:text-[#CBD2E1]">
                      Solve official MCQs with timer, negative marking, and performance analytics
                    </p>
                  </div>
                </div>
                <button
                  onClick={onNavigateHome}
                  className="w-full sm:w-auto px-4 py-2.5 bg-[#800020] hover:bg-[#5E0017] dark:bg-[#F47B20] dark:hover:bg-[#E06A12] text-white rounded-xl text-xs font-black transition-all shadow-xs shrink-0 cursor-pointer text-center whitespace-nowrap"
                >
                  Start Practice →
                </button>
              </div>

              {/* Frequently Asked Questions (FAQ) Accordion (if not already included as a block) */}
              {(() => {
                const hasFaqBlock = effectiveBlocks.some((b) => b.type === "faq");
                const faqsToRender = !hasFaqBlock && activeArticle.faqs && activeArticle.faqs.length > 0 ? activeArticle.faqs : [];
                if (faqsToRender.length === 0) return null;

                return (
                  <section className="mt-10 pt-8 border-t border-[#E8D9C0] dark:border-[#31374A] space-y-4">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-xl bg-[#800020]/10 dark:bg-[#F47B20]/15 text-[#800020] dark:text-[#F47B20] flex items-center justify-center font-extrabold text-base shrink-0">
                        ?
                      </div>
                      <div>
                        <h3 className="text-lg font-black text-[#171923] dark:text-[#FFF9EF]">
                          Frequently Asked Questions (FAQ)
                        </h3>
                        <p className="text-xs text-[#52576A] dark:text-[#CBD2E1] font-bold">
                          Expert answers to common queries
                        </p>
                      </div>
                    </div>

                    <div className="space-y-3 pt-2">
                      {faqsToRender.map((faq, idx) => (
                        <details
                          key={idx}
                          className="group bg-white dark:bg-[#1F2330] rounded-2xl border border-[#E8D9C0] dark:border-[#31374A] p-4 transition-all"
                        >
                          <summary className="flex items-center justify-between font-extrabold text-sm sm:text-base text-[#171923] dark:text-[#FFF9EF] cursor-pointer select-none list-none gap-3">
                            <span className="flex items-center gap-2.5">
                              <span className="w-5 h-5 rounded-full bg-[#800020]/10 dark:bg-[#F47B20]/15 text-[#800020] dark:text-[#F47B20] text-[11px] font-black flex items-center justify-center shrink-0 tabular-nums">
                                {idx + 1}
                              </span>
                              <span>{faq.question}</span>
                            </span>
                            <ChevronDown className="w-4 h-4 text-[#52576A] group-open:rotate-180 transition-transform duration-200 shrink-0 ml-2" />
                          </summary>
                          <div className="mt-3 pt-3 border-t border-[#E8D9C0] dark:border-[#31374A] text-xs sm:text-sm text-[#52576A] dark:text-[#CBD2E1] leading-relaxed pl-7 break-words">
                            {renderFormattedTextWithLinks(faq.answer)}
                          </div>
                        </details>
                      ))}
                    </div>
                  </section>
                );
              })()}

              {/* Related Articles / Related Section */}
              {relatedArticles.length > 0 && (
                <section className="mt-10 pt-8 border-t border-[#E8D9C0] dark:border-[#31374A] space-y-5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-[#800020]/10 dark:bg-[#F47B20]/15 text-[#800020] dark:text-[#F47B20] flex items-center justify-center font-extrabold shrink-0">
                        <BookOpen className="w-4 h-4" />
                      </div>
                      <div>
                        <h3 className="text-lg font-black text-[#171923] dark:text-[#FFF9EF] leading-tight">
                          Related Articles &amp; Guides
                        </h3>
                        <p className="text-xs text-[#52576A] dark:text-[#CBD2E1]">
                          Recommended articles and strategy guides for exam preparation
                        </p>
                      </div>
                    </div>
                    <span className="hidden sm:inline-block text-[11px] font-black uppercase tracking-wider text-[#800020] dark:text-[#C99A45]">
                      DISHA 20-20 · Editor's Pick
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {relatedArticles.map((relArt) => (
                      <div
                        key={relArt.id}
                        onClick={() => handleSelectArticle(relArt.slug)}
                        className="p-4 rounded-2xl bg-white dark:bg-[#1F2330] border border-[#E8D9C0] dark:border-[#31374A] hover:border-[#800020]/50 dark:hover:border-[#F47B20]/50 hover:shadow-md transition-all duration-200 cursor-pointer flex flex-col justify-between space-y-3 group"
                      >
                        <div className="space-y-2">
                          {relArt.coverImageUrl ? (
                            <div className="w-full aspect-[16/9] max-h-36 rounded-xl overflow-hidden bg-[#F7EFE2] dark:bg-[#252A3A]">
                              <img
                                src={relArt.coverImageUrl}
                                alt={relArt.title}
                                referrerPolicy="no-referrer"
                                className="w-full h-full object-cover group-hover:scale-103 transition-transform duration-300"
                                loading="lazy"
                              />
                            </div>
                          ) : (
                            <div className="w-full h-24 rounded-xl overflow-hidden bg-gradient-to-br from-[#800020] via-[#5E0017] to-[#2A000B] border border-[#C99A45]/30 p-3 flex items-center justify-between text-white">
                              <div className="space-y-0.5 min-w-0">
                                <span className="text-[9px] font-black uppercase tracking-wider text-[#C99A45] block">
                                  DISHA 20-20 · {relArt.category}
                                </span>
                                <span className="text-xs font-black text-[#FFF9EF] line-clamp-1">
                                  {relArt.title}
                                </span>
                              </div>
                              <Compass className="w-6 h-6 text-[#F47B20] shrink-0 ml-2" />
                            </div>
                          )}

                          <div className="flex items-center gap-2 text-[10px] font-black text-[#800020] dark:text-[#F47B20] uppercase tracking-wider tabular-nums">
                            <span>{relArt.category}</span>
                            <span className="text-[#E8D9C0] dark:text-[#31374A]">·</span>
                            <span className="text-[#52576A] dark:text-[#CBD2E1]">{getReadingTime(relArt.content)}</span>
                          </div>

                          <h4 className="text-sm font-black text-[#171923] dark:text-[#FFF9EF] line-clamp-2 leading-snug group-hover:text-[#800020] dark:group-hover:text-[#F47B20] transition-colors">
                            {relArt.title}
                          </h4>

                          <p className="text-xs text-[#52576A] dark:text-[#CBD2E1] line-clamp-2 leading-relaxed">
                            {relArt.excerpt}
                          </p>
                        </div>

                        <div className="flex items-center justify-between pt-2 border-t border-[#E8D9C0]/60 dark:border-[#31374A] text-[11px] tabular-nums">
                          <span className="text-[#52576A] dark:text-[#CBD2E1] font-bold">
                            {new Date(relArt.publishedAt || relArt.createdAt).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                            })}
                          </span>
                          <span className="font-extrabold text-[#800020] dark:text-[#F47B20] flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                            Read →
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Author Info Box Card */}
              <div className="mt-10 p-5 rounded-3xl bg-white dark:bg-[#1F2330] border border-[#E8D9C0] dark:border-[#31374A] flex items-center gap-4 shadow-xs">
                {activeArticle.authorPhotoUrl ? (
                  <img
                    src={activeArticle.authorPhotoUrl}
                    alt=""
                    referrerPolicy="no-referrer"
                    className="w-12 h-12 rounded-full object-cover shrink-0 ring-2 ring-[#800020]/20 dark:ring-[#F47B20]/25"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-[#800020] text-[#FFF9EF] flex items-center justify-center font-extrabold text-base shrink-0 ring-2 ring-[#C99A45]/30">
                    {activeArticle.authorName ? activeArticle.authorName[0] : "D"}
                  </div>
                )}
                <div className="space-y-1 text-xs">
                  <span className="text-[10px] uppercase font-black tracking-wider text-[#800020] dark:text-[#F47B20]">
                    Written by · DISHA 20-20
                  </span>
                  <h4 className="text-sm font-black text-[#171923] dark:text-[#FFF9EF]">
                    {activeArticle.authorName || "DISHA 20-20 Editorial Team"}
                  </h4>
                  <p className="text-[#52576A] dark:text-[#CBD2E1] leading-relaxed">
                    {activeArticle.authorBio ||
                      "Senior Exam Research Analyst & Competitive Exam Content Specialist at DISHA 20-20."}
                  </p>
                </div>
              </div>

              {/* Join Telegram Channel Callout Card */}
              {SITE_CONFIG.telegramChannelUrl && (
                <div className="mt-6 p-5 rounded-3xl bg-[#0088cc]/10 border border-[#0088cc]/30 flex flex-col sm:flex-row items-center justify-between gap-3 text-[#171923] dark:text-[#FFF9EF]">
                  <div className="flex items-center gap-3">
                    <Send className="w-6 h-6 text-[#0088cc] shrink-0" />
                    <div>
                      <h4 className="text-sm font-black text-[#171923] dark:text-[#FFF9EF]">
                        Get Real-Time Exam Updates on Telegram
                      </h4>
                      <p className="text-xs text-[#52576A] dark:text-[#CBD2E1] font-medium">
                        Join our official DISHA 20-20 channel for daily PDFs and notifications.
                      </p>
                    </div>
                  </div>
                  <a
                    href={SITE_CONFIG.telegramChannelUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full sm:w-auto px-4 py-2 bg-[#0088cc] hover:bg-[#0077b5] text-white rounded-xl text-xs font-bold transition-colors text-center shrink-0 cursor-pointer whitespace-nowrap"
                  >
                    Join Telegram →
                  </a>
                </div>
              )}
            </main>
          </div>
        </div>

        {/* Floating Mobile Bottom Sticky Action Bar */}
        <div className="block md:hidden fixed bottom-0 left-0 right-0 z-50 p-3 bg-[#FFF9EF]/95 dark:bg-[#1F2330]/95 backdrop-blur-md border-t border-[#E8D9C0] dark:border-[#31374A] shadow-2xl">
          <div className="max-w-md mx-auto flex items-center gap-2.5">
            <button
              onClick={() => handleNativeOrModalShare(activeArticle)}
              className="h-12 px-4 rounded-xl bg-white hover:bg-[#F7EFE2] dark:bg-[#252A3A] dark:hover:bg-[#31374A] text-[#171923] dark:text-[#FFF9EF] font-extrabold text-xs flex items-center justify-center gap-1.5 active:scale-95 cursor-pointer shrink-0 border border-[#E8D9C0] dark:border-[#31374A]"
            >
              <Share2 className="w-4 h-4 text-[#800020] dark:text-[#F47B20]" />
              <span>Share</span>
            </button>
            <button
              onClick={onNavigateHome}
              className="flex-1 h-12 px-4 rounded-xl bg-[#800020] hover:bg-[#5E0017] dark:bg-[#F47B20] dark:hover:bg-[#E06A12] text-white font-extrabold text-xs shadow-md active:scale-95 cursor-pointer flex items-center justify-center gap-2"
            >
              <span>Practice Free MCQs</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Fullscreen Image Lightbox */}
        {zoomedImage && (
          <div
            className="fixed inset-0 z-50 bg-black/90 backdrop-blur-xs flex items-center justify-center p-4"
            onClick={() => setZoomedImage(null)}
          >
            <div className="relative max-w-4xl max-h-[90vh]">
              <img
                src={zoomedImage.url}
                alt={zoomedImage.alt}
                referrerPolicy="no-referrer"
                className="max-w-full max-h-[85vh] object-contain rounded-2xl"
              />
              <button
                onClick={() => setZoomedImage(null)}
                className="absolute -top-10 right-0 p-2 text-white hover:text-slate-300 cursor-pointer"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
          </div>
        )}

        {shareData && (
          <ShareModal
            isOpen={!!shareData}
            onClose={() => setShareData(null)}
            data={shareData}
          />
        )}
      </article>
    );
  }

  // ─────────────────────────────────────────────────────────────
  // 2. NEWS & GUIDES DIRECTORY LISTING VIEW (/news)
  // ─────────────────────────────────────────────────────────────
  return (
    <div className="min-h-full bg-[#FFF9EF] dark:bg-[#171923] pb-24 text-[#171923] dark:text-[#FFF9EF]">
      {/* Top Brand Navigation Header */}
      <header className="sticky top-0 z-40 bg-gradient-to-r from-[#800020] via-[#6A001A] to-[#4A0012] text-white border-b border-[#C99A45]/35 px-4 py-3.5 shadow-md">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={onNavigateHome}
              className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-all active:scale-95 cursor-pointer flex items-center justify-center shrink-0 border border-[#C99A45]/30"
              aria-label="Back to Home"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-black text-white leading-tight truncate">
                  Exam News &amp; Preparation Guides
                </h1>
                <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-md text-[9.5px] font-black uppercase tracking-wider bg-[#F47B20] text-white shrink-0">
                  DISHA 20-20
                </span>
              </div>
              <p className="text-[11px] font-semibold text-[#FFF9EF]/80 truncate">
                DISHA 20-20 · Exam News, Economic Review &amp; Strategy Guides
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={toggleDarkMode}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer border border-[#C99A45]/30"
              title="Toggle Dark Mode"
            >
              {isDarkMode ? <Sun className="w-4 h-4 text-[#F47B20]" /> : <Moon className="w-4 h-4 text-[#FFF9EF]" />}
            </button>

            {isAdmin && onNavigateAdminNews && (
              <button
                onClick={onNavigateAdminNews}
                className="px-3 py-1.5 bg-[#F47B20] hover:bg-[#E06A12] text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer whitespace-nowrap"
              >
                CMS Admin
              </button>
            )}

            {!isAuthenticated ? (
              <button
                onClick={onOpenLogin}
                className="px-3.5 py-1.5 bg-[#F47B20] hover:bg-[#E06A12] text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Login</span>
              </button>
            ) : (
              <button
                onClick={onNavigateHome}
                className="px-3.5 py-1.5 bg-white/10 hover:bg-white/20 text-white border border-[#C99A45]/35 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap"
              >
                Practice Hub
              </button>
            )}
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 pt-6 space-y-6">
        {/* Search Input & Category Filter Row */}
        <div className="space-y-4">
          <div className="relative max-w-xl mx-auto">
            <Search className="w-4 h-4 absolute left-3.5 top-3 text-[#800020] dark:text-[#F47B20]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search exam updates, economic survey, preparation guides..."
              className="w-full pl-10 pr-9 py-2.5 bg-white dark:bg-[#1F2330] border border-[#E8D9C0] dark:border-[#31374A] rounded-2xl text-xs font-bold text-[#171923] dark:text-[#FFF9EF] placeholder:text-[#52576A]/70 dark:placeholder:text-[#CBD2E1]/60 focus:outline-none focus:ring-2 focus:ring-[#800020]/30 dark:focus:ring-[#F47B20]/30 shadow-xs"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3.5 top-3 text-[#52576A] hover:text-[#800020] dark:text-[#CBD2E1] dark:hover:text-[#F47B20] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Interactive Category Filter Buttons */}
          <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar justify-start sm:justify-center -mx-1 px-1">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer active:scale-95 shrink-0 ${
                  selectedCategory === cat
                    ? "bg-[#800020] dark:bg-[#F47B20] text-white shadow-sm"
                    : "bg-white dark:bg-[#1F2330] text-[#52576A] dark:text-[#CBD2E1] border border-[#E8D9C0] dark:border-[#31374A] hover:border-[#800020]/40 dark:hover:border-[#F47B20]/40 hover:text-[#171923] dark:hover:text-[#FFF9EF] shadow-xs"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Featured Hero Article Banner */}
        {!loading && heroArticle && selectedCategory === "All" && !searchQuery.trim() && (
          <div
            onClick={() => handleSelectArticle(heroArticle.slug)}
            className="group relative bg-white dark:bg-[#1F2330] rounded-3xl border border-[#E8D9C0] dark:border-[#31374A] overflow-hidden shadow-sm hover:border-[#800020]/50 dark:hover:border-[#F47B20]/50 hover:shadow-md transition-all cursor-pointer grid grid-cols-1 md:grid-cols-12 gap-0 items-stretch"
          >
            <div className="md:col-span-7 aspect-[16/9] md:aspect-auto relative overflow-hidden bg-[#F7EFE2] dark:bg-[#252A3A]">
              {heroArticle.coverImageUrl ? (
                <img
                  src={heroArticle.coverImageUrl}
                  alt={heroArticle.title}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover group-hover:scale-103 transition-transform duration-500"
                />
              ) : (
                <div className="w-full h-full min-h-[220px] bg-gradient-to-br from-[#800020] via-[#5E0017] to-[#2A000B] flex flex-col items-center justify-center text-white p-6 text-center gap-2">
                  <Compass className="w-12 h-12 text-[#F47B20]" />
                  <span className="text-xs font-black uppercase tracking-wider text-[#C99A45]">
                    DISHA 20-20 · Right Direction, Accurate Preparation
                  </span>
                </div>
              )}
              <span className="absolute top-3 left-3 bg-[#800020] text-[#FFF9EF] border border-[#C99A45]/40 text-[9.5px] font-black uppercase px-2.5 py-1 rounded-md tracking-wider shadow-sm">
                FEATURED GUIDE
              </span>
            </div>

            <div className="md:col-span-5 p-5 sm:p-7 flex flex-col justify-between space-y-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-wider text-[#800020] dark:text-[#F47B20] tabular-nums">
                  <span>{heroArticle.category}</span>
                  <span className="text-[#E8D9C0] dark:text-[#31374A]">·</span>
                  <span className="text-[#52576A] dark:text-[#CBD2E1]">{getReadingTime(heroArticle.content)}</span>
                </div>

                <h2 className="text-lg sm:text-2xl font-black text-[#171923] dark:text-[#FFF9EF] leading-snug group-hover:text-[#800020] dark:group-hover:text-[#F47B20] transition-colors">
                  {heroArticle.title}
                </h2>

                <p className="text-xs sm:text-sm text-[#52576A] dark:text-[#CBD2E1] line-clamp-3 leading-relaxed">
                  {heroArticle.excerpt}
                </p>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-[#E8D9C0]/70 dark:border-[#31374A] text-xs text-[#52576A] dark:text-[#CBD2E1] tabular-nums font-bold">
                <span>
                  {new Date(
                    heroArticle.publishedAt || heroArticle.createdAt
                  ).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </span>
                <span className="font-extrabold text-[#800020] dark:text-[#F47B20] flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                  Read Guide →
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Article Grid / Skeleton Loading States */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <div
                key={n}
                className="bg-white dark:bg-[#1F2330] rounded-3xl border border-[#E8D9C0] dark:border-[#31374A] p-4 space-y-3 animate-pulse"
              >
                <div className="w-full aspect-[16/9] bg-[#F7EFE2] dark:bg-[#252A3A] rounded-2xl" />
                <div className="h-3 bg-[#F7EFE2] dark:bg-[#252A3A] rounded-full w-1/3" />
                <div className="h-4 bg-[#F7EFE2] dark:bg-[#252A3A] rounded-full w-full" />
                <div className="h-4 bg-[#F7EFE2] dark:bg-[#252A3A] rounded-full w-2/3" />
                <div className="h-3 bg-[#F7EFE2] dark:bg-[#252A3A] rounded-full w-1/2 pt-2" />
              </div>
            ))}
          </div>
        ) : gridArticles.length === 0 ? (
          <div className="py-16 text-center bg-white dark:bg-[#1F2330] rounded-3xl border border-[#E8D9C0] dark:border-[#31374A] p-8 space-y-2 shadow-xs">
            <BookOpen className="w-8 h-8 text-[#800020]/40 dark:text-[#F47B20]/40 mx-auto" />
            <h3 className="text-sm font-black text-[#171923] dark:text-[#FFF9EF]">
              No exam news or guides found
            </h3>
            <p className="text-xs text-[#52576A] dark:text-[#CBD2E1] font-medium">
              Try clearing your search terms or picking another category.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {gridArticles.map((article) => (
              <div
                key={article.id}
                onClick={() => handleSelectArticle(article.slug)}
                className="bg-white dark:bg-[#1F2330] rounded-3xl border border-[#E8D9C0] dark:border-[#31374A] p-4 shadow-xs hover:border-[#800020]/50 dark:hover:border-[#F47B20]/50 hover:-translate-y-0.5 hover:shadow-md transition-all duration-200 cursor-pointer flex flex-col justify-between space-y-3 group"
              >
                <div className="space-y-3">
                  {article.coverImageUrl ? (
                    <div className="w-full aspect-[16/9] rounded-2xl overflow-hidden bg-[#F7EFE2] dark:bg-[#252A3A]">
                      <img
                        src={article.coverImageUrl}
                        alt={article.title}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover group-hover:scale-103 transition-transform duration-300"
                        loading="lazy"
                      />
                    </div>
                  ) : (
                    <div className="w-full aspect-[16/9] rounded-2xl overflow-hidden bg-gradient-to-br from-[#800020] via-[#5E0017] to-[#2A000B] border border-[#C99A45]/30 p-4 flex flex-col justify-between text-white relative">
                      <div className="flex items-center justify-between gap-2">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#F47B20] text-white text-[9px] font-black uppercase tracking-wider">
                          <Compass className="w-3 h-3" />
                          <span>DISHA 20-20</span>
                        </span>
                        <span className="text-[9.5px] font-black uppercase tracking-wider text-[#C99A45] truncate max-w-[140px]">
                          {article.category}
                        </span>
                      </div>
                      <p className="text-xs sm:text-sm font-black text-[#FFF9EF] line-clamp-2 leading-snug font-hindi">
                        {article.hindiTitle || article.title}
                      </p>
                    </div>
                  )}

                  {/* Category & Read Time Metadata */}
                  <div className="flex items-center gap-2 text-[10px] font-black text-[#800020] dark:text-[#F47B20] uppercase tracking-wider tabular-nums">
                    <span>{article.category}</span>
                    <span className="text-[#E8D9C0] dark:text-[#31374A]">·</span>
                    <span className="text-[#52576A] dark:text-[#CBD2E1]">{getReadingTime(article.content)}</span>
                  </div>

                  <h3 className="text-sm sm:text-base font-black text-[#171923] dark:text-[#FFF9EF] leading-snug line-clamp-2 font-hindi group-hover:text-[#800020] dark:group-hover:text-[#F47B20] transition-colors">
                    {article.title}
                  </h3>

                  <p className="text-xs text-[#52576A] dark:text-[#CBD2E1] line-clamp-2 leading-relaxed font-hindi">
                    {article.excerpt}
                  </p>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-[#E8D9C0]/70 dark:border-[#31374A] text-[11px] text-[#52576A] dark:text-[#CBD2E1] tabular-nums font-bold">
                  <span>
                    {new Date(
                      article.publishedAt || article.createdAt
                    ).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOpenShare(article);
                    }}
                    className="p-1.5 rounded-lg hover:bg-[#F7EFE2] dark:hover:bg-[#252A3A] text-[#52576A] dark:text-[#CBD2E1] hover:text-[#800020] dark:hover:text-[#F47B20] transition-colors cursor-pointer flex items-center gap-1 font-bold text-[11px]"
                    title="Share article"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                    <span>Share</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {shareData && (
        <ShareModal
          isOpen={!!shareData}
          onClose={() => setShareData(null)}
          data={shareData}
        />
      )}
    </div>
  );
};
