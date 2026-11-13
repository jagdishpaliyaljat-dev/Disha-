import * as React from "react";
import {
  CheckCircle2,
  XCircle,
  AlertCircle,
  Sparkles,
  Search,
  Monitor,
  Smartphone,
  Info,
  RefreshCw,
  Copy,
  ExternalLink,
  Tag,
  Wand2,
  Check,
  Link as LinkIcon,
} from "lucide-react";
import { NewsArticle } from "../../types";
import { autoInjectLinksToArticleBlocks } from "../../utils/smartArticleImporter";

interface ArticleSEOControlPanelProps {
  article: Partial<NewsArticle>;
  onChange: (updated: Partial<NewsArticle>) => void;
  onAiOptimize?: () => Promise<void>;
  aiLoading?: boolean;
}

export const ArticleSEOControlPanel: React.FC<ArticleSEOControlPanelProps> = ({
  article,
  onChange,
  onAiOptimize,
  aiLoading = false,
}) => {
  const [serpView, setSerpView] = React.useState<"desktop" | "mobile">("desktop");
  const [copiedSlug, setCopiedSlug] = React.useState(false);

  const handleAutoInjectLinks = () => {
    if (!article.blocks || article.blocks.length === 0) {
      alert("No content blocks to process.");
      return;
    }

    const res = autoInjectLinksToArticleBlocks(article.blocks);
    onChange({
      ...article,
      blocks: res.blocks,
    });

    alert(
      `Auto-Link Complete!\n• Internal Links Added: ${res.internalLinksCount}\n• External Links Added: ${res.externalLinksCount}`
    );
  };

  // Field values with auto fallbacks
  const title = article.seoTitle?.trim() || article.title?.trim() || "";
  const description = article.seoDescription?.trim() || article.excerpt?.trim() || "";
  const focusKeyword = article.focusKeyword?.trim() || "";
  const slug = article.slug?.trim() || "";
  const coverImageUrl = article.coverImageUrl?.trim() || "";
  const authorName = article.authorName?.trim() || "";
  const authorBio = article.authorBio?.trim() || "";
  const faqs = article.faqs || [];
  const blocks = article.blocks || [];

  // Content word count
  const allBlockText = blocks.map(b => b.text || (b.listItems || []).join(" ") || "").join(" ");
  const fullContent = (article.content || "") + " " + allBlockText;
  const wordCount = fullContent.trim().split(/\s+/).filter(Boolean).length;

  // Counts & Targets
  const titleLength = title.length;
  const descLength = description.length;
  const keywordWordCount = focusKeyword ? focusKeyword.split(/\s+/).length : 0;

  // Keyword presence checks
  const keywordLower = focusKeyword.toLowerCase();
  const keywordInTitle = Boolean(keywordLower && title.toLowerCase().includes(keywordLower));
  const keywordInDesc = Boolean(keywordLower && description.toLowerCase().includes(keywordLower));
  const keywordInContent = Boolean(keywordLower && fullContent.toLowerCase().includes(keywordLower));

  // Heading check
  const hasHeadings = blocks.some(b => b.type === "heading") || /#+\s+/.test(article.content || "");

  // Image Alt Text Checks
  const imageBlocks = blocks.filter(b => b.type === "image");
  const imagesWithAltCount = imageBlocks.filter(b => b.imageAlt && b.imageAlt.trim().length > 2).length;
  const imageAltCheck = imageBlocks.length === 0 || imagesWithAltCount === imageBlocks.length;

  // H1 Title Check
  const hasH1Title = Boolean(article.title && article.title.trim().length >= 10);

  // Checklist items
  const checklist = [
    {
      id: "h1_usage",
      label: "H1 Main Article Title Defined",
      pass: hasH1Title,
      current: article.title ? `${article.title.length} chars` : "Missing H1",
      target: "Unique H1 Title",
      tip: "The main article title serves as the single page H1 header tag for search engines.",
    },
    {
      id: "title_length",
      label: "SEO Title Length (30–60 characters max)",
      pass: titleLength >= 30 && titleLength <= 60,
      current: `${titleLength} chars`,
      target: "30–60 chars",
      tip: titleLength < 30 ? "Title is too short. Add focus keyword or exam brand." : titleLength > 60 ? "Title exceeds 60 chars max and may be truncated by Google." : "Perfect title length for Google search results.",
    },
    {
      id: "desc_length",
      label: "Meta Description Length (120–155 characters max)",
      pass: descLength >= 120 && descLength <= 155,
      current: `${descLength} chars`,
      target: "120–155 chars",
      tip: descLength < 120 ? "Description is too short. Add a call to action for students." : descLength > 155 ? "Description exceeds 155 chars max and will be clipped in search snippets." : "Optimal description length for high click-through rates.",
    },
    {
      id: "focus_keyword",
      label: "Focus Keyword Defined",
      pass: focusKeyword.length >= 3,
      current: focusKeyword || "Missing",
      target: "Primary keyword phrase",
      tip: "Define a 2–4 word primary keyword targeted by exam aspirants.",
    },
    {
      id: "kw_in_title",
      label: "Focus Keyword Presence in Title",
      pass: keywordInTitle,
      current: keywordInTitle ? "Present in Title" : "Missing from Title",
      target: "Keyword included in title",
      tip: "Include your primary keyword naturally near the beginning of the title.",
    },
    {
      id: "kw_in_desc",
      label: "Focus Keyword in Meta Description",
      pass: keywordInDesc,
      current: keywordInDesc ? "Present in Desc" : "Missing from Desc",
      target: "Keyword in meta description",
      tip: "Google bolds matching keywords in search snippets when searched.",
    },
    {
      id: "image_alt_text",
      label: "Image Alt Text Accessibility",
      pass: imageAltCheck,
      current: imageBlocks.length === 0 ? "No Image Blocks" : `${imagesWithAltCount}/${imageBlocks.length} Images Have Alt Text`,
      target: "Alt text on all images",
      tip: "Image alt text helps search crawlers index images and improves accessibility.",
    },
    {
      id: "kw_in_content",
      label: "Focus Keyword in Article Body",
      pass: keywordInContent,
      current: keywordInContent ? "Present" : "Missing",
      target: "Keyword in first 200 words",
      tip: "Use the focus keyword in introductory paragraphs and headings.",
    },
    {
      id: "content_depth",
      label: "Content Depth (300+ words)",
      pass: wordCount >= 300,
      current: `${wordCount} words`,
      target: "300+ words",
      tip: wordCount < 300 ? "Short content may be flagged as thin content by search crawlers." : "Thorough depth that answers student search queries.",
    },
    {
      id: "heading_structure",
      label: "Subheading Structure (H2 / H3)",
      pass: hasHeadings,
      current: hasHeadings ? "Present" : "No Headings",
      target: "At least one H2 subheading",
      tip: "Headings break up content and make articles scannable for users and bots.",
    },
    {
      id: "cover_image",
      label: "Cover Image & OpenGraph Asset",
      pass: Boolean(coverImageUrl && coverImageUrl.startsWith("http")),
      current: coverImageUrl ? "Configured" : "Missing",
      target: "Valid Image URL",
      tip: "Required for high-converting social media preview cards.",
    },
    {
      id: "faq_schema",
      label: "Schema.org FAQ Markup",
      pass: faqs.length >= 2,
      current: `${faqs.length} FAQs`,
      target: "2+ FAQ pairs",
      tip: "Adds rich expandable FAQ accordions directly into Google search results.",
    },
    {
      id: "clean_slug",
      label: "Clean URL Slug Format",
      pass: Boolean(slug && /^[a-z0-9\-]+$/.test(slug)),
      current: slug || "Missing",
      target: "kebab-case URL",
      tip: "Use lowercase alphanumeric characters separated by hyphens.",
    },
    {
      id: "eeat_author",
      label: "Author Attribution (Google EEAT)",
      pass: Boolean(authorName && authorBio),
      current: authorName || "Missing",
      target: "Author name & bio",
      tip: "Demonstrates Experience, Expertise, Authoritativeness, and Trustworthiness.",
    },
  ];

  const passedCount = checklist.filter(c => c.pass).length;
  const totalCount = checklist.length;
  const seoScore = Math.round((passedCount / totalCount) * 100);

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/30";
    if (score >= 50) return "text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/30";
    return "text-rose-600 dark:text-rose-400 bg-rose-500/10 border-rose-500/30";
  };

  const handleCopySlug = () => {
    if (!slug) return;
    navigator.clipboard.writeText(`https://disha2020.in/news/${slug}`);
    setCopiedSlug(true);
    setTimeout(() => setCopiedSlug(false), 2000);
  };

  /**
   * Helper to simulate Google's keyword bolding in search snippets
   */
  const renderSnippetWithBoldKeywords = (text: string, keyword: string) => {
    if (!text) return "Meta description snippet will render here as you type...";
    if (!keyword || keyword.trim().length < 2) return text;

    const kw = keyword.trim();
    const cleanKw = kw.replace(/[^a-zA-Z0-9\s]/g, "");
    if (!cleanKw) return text;

    const regex = new RegExp(`(${cleanKw})`, "gi");
    const parts = text.split(regex);

    return parts.map((part, i) =>
      part.toLowerCase() === cleanKw.toLowerCase() ? (
        <strong key={i} className="font-bold text-slate-900 dark:text-white bg-amber-500/10 dark:bg-amber-400/20 px-0.5 rounded">
          {part}
        </strong>
      ) : (
        <span key={i}>{part}</span>
      )
    );
  };

  /**
   * Generate SEO Defaults from title & first paragraph
   */
  const handleGenerateSeoDefaults = () => {
    const rawTitle = article.title?.trim() || "DISHA 20-20 Exam Notes & Study Guide";
    let proposedTitle = rawTitle;

    // 1. Proposed Meta Title (Target: 30-60 chars)
    if (proposedTitle.length < 40 && !proposedTitle.toLowerCase().includes("disha")) {
      proposedTitle = `${proposedTitle} — DISHA 20-20 Exam Prep`;
    }
    if (proposedTitle.length > 60) {
      proposedTitle = proposedTitle.substring(0, 57).trim() + "...";
    }

    // 2. First Paragraph Parsing for Meta Description
    let firstParagraphText = "";
    if (article.blocks && article.blocks.length > 0) {
      const paraBlock = article.blocks.find(b => b.type === "paragraph" && b.text && b.text.trim().length > 10)
        || article.blocks.find(b => b.text && b.text.trim().length > 10);
      if (paraBlock) {
        firstParagraphText = paraBlock.text || "";
      }
    }

    if (!firstParagraphText && article.excerpt) {
      firstParagraphText = article.excerpt;
    }

    if (!firstParagraphText && article.content) {
      firstParagraphText = article.content
        .replace(/#+\s+/g, "")
        .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
        .replace(/[*_~`]/g, "")
        .split("\n\n")
        .find(p => p.trim().length > 15) || "";
    }

    const cleanPara = firstParagraphText.replace(/\s+/g, " ").trim();
    let proposedDesc = cleanPara;

    if (proposedDesc.length > 150) {
      const truncated = proposedDesc.substring(0, 147);
      const lastSpace = truncated.lastIndexOf(" ");
      proposedDesc = (lastSpace > 80 ? truncated.substring(0, lastSpace) : truncated).trim() + "...";
    } else if (proposedDesc.length < 100 && proposedDesc.length > 0) {
      proposedDesc = `${proposedDesc} Practice bilingual MCQs and study guides on DISHA 20-20.`;
    }

    if (!proposedDesc) {
      proposedDesc = `Read comprehensive exam analysis for ${rawTitle}. Practice bilingual MCQs and revision notes on DISHA 20-20.`;
    }

    // 3. Proposed Slug (if missing)
    const proposedSlug = article.slug || rawTitle.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

    // 4. Proposed Focus Keyword
    const titleWords = rawTitle.replace(/[^a-zA-Z0-9\s]/g, "").split(/\s+/).filter(w => w.length > 3);
    const proposedKeyword = article.focusKeyword || titleWords.slice(0, 3).join(" ") || "Exam Preparation";

    onChange({
      ...article,
      seoTitle: proposedTitle,
      seoDescription: proposedDesc,
      slug: proposedSlug,
      focusKeyword: proposedKeyword,
    });
  };

  return (
    <div className="space-y-6 text-slate-800 dark:text-slate-100">
      {/* Top Banner with Real-time SEO Gauge */}
      <div className="p-5 rounded-3xl bg-gradient-to-r from-slate-900 via-[#111A2E] to-slate-900 text-white border border-slate-800 shadow-lg flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="space-y-1 text-center sm:text-left">
          <div className="flex items-center justify-center sm:justify-start gap-2">
            <span className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider border ${getScoreColor(seoScore)}`}>
              SEO Score: {seoScore}%
            </span>
            <span className="text-xs text-slate-400 font-bold">
              ({passedCount}/{totalCount} Checks Passed)
            </span>
          </div>
          <h3 className="text-lg font-black text-white">
            Article SEO & Search Snippet Control Panel
          </h3>
          <p className="text-xs text-slate-300 max-w-xl">
            Optimize your article for search engines. Real-time counters, Google SERP simulator, and Schema.org audit.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap shrink-0">
          <button
            type="button"
            onClick={handleAutoInjectLinks}
            className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-black flex items-center gap-2 shadow-md active:scale-95 cursor-pointer"
            title="Auto-detect keywords and inject internal & external links"
          >
            <LinkIcon className="w-4 h-4 text-indigo-200" />
            <span>Auto-Inject Links</span>
          </button>

          <button
            type="button"
            onClick={handleGenerateSeoDefaults}
            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-black flex items-center gap-2 shadow-md active:scale-95 cursor-pointer"
            title="Parse title and first paragraph to propose SEO title & meta description"
          >
            <Wand2 className="w-4 h-4 text-amber-300" />
            <span>Generate SEO Defaults</span>
          </button>

          {onAiOptimize && (
            <button
              type="button"
              onClick={onAiOptimize}
              disabled={aiLoading}
              className="px-4 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white rounded-xl text-xs font-black flex items-center gap-2 shadow-md active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              {aiLoading ? (
                <RefreshCw className="w-4 h-4 animate-spin text-amber-300" />
              ) : (
                <Sparkles className="w-4 h-4 text-amber-300 animate-pulse" />
              )}
              <span>AI Auto-Optimize</span>
            </button>
          )}
        </div>
      </div>

      {/* 2 Grid Layout: Inputs Left, SERP & Audit Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* LEFT COLUMN: REAL-TIME INPUTS & COUNTERS */}
        <div className="lg:col-span-7 space-y-4">
          {/* SEO Page Title */}
          <div className="p-4 rounded-2xl bg-white dark:bg-[#111A2E] border border-slate-200/80 dark:border-slate-800 space-y-2 shadow-xs">
            <div className="flex items-center justify-between">
              <label className="text-xs font-black uppercase text-slate-700 dark:text-slate-300 tracking-wider">
                SEO Title (&lt;title&gt;) *
              </label>
              <div className="flex items-center gap-2">
                <span className={`text-xs font-mono font-black px-2 py-0.5 rounded-full border ${
                  titleLength >= 30 && titleLength <= 60
                    ? "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
                    : "text-rose-600 dark:text-rose-400 bg-rose-500/10 border-rose-500/20"
                }`}>
                  {titleLength} / 60 chars
                </span>
                <button
                  type="button"
                  onClick={() => onChange({ ...article, seoTitle: article.title })}
                  className="text-[10px] font-bold text-blue-600 hover:underline"
                >
                  Use Main Title
                </button>
              </div>
            </div>

            <input
              type="text"
              value={article.seoTitle || ""}
              onChange={e => onChange({ ...article, seoTitle: e.target.value })}
              placeholder={`Auto fallback: ${article.title || "Main Title"}`}
              className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500/20"
            />

            {/* Title Length Indicator Bar */}
            <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-300 ${
                  titleLength < 30 ? "bg-amber-500" : titleLength <= 60 ? "bg-emerald-500" : "bg-rose-500"
                }`}
                style={{ width: `${Math.min(100, (titleLength / 60) * 100)}%` }}
              />
            </div>
            <p className="text-[10px] text-slate-400">
              Ideal length: 30–60 characters. Displayed as main header in Google search.
            </p>
          </div>

          {/* Meta Description */}
          <div className="p-4 rounded-2xl bg-white dark:bg-[#111A2E] border border-slate-200/80 dark:border-slate-800 space-y-2 shadow-xs">
            <div className="flex items-center justify-between">
              <label className="text-xs font-black uppercase text-slate-700 dark:text-slate-300 tracking-wider">
                Meta Description *
              </label>
              <div className="flex items-center gap-2">
                <span className={`text-xs font-mono font-black px-2 py-0.5 rounded-full border ${
                  descLength >= 120 && descLength <= 155
                    ? "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
                    : "text-rose-600 dark:text-rose-400 bg-rose-500/10 border-rose-500/20"
                }`}>
                  {descLength} / 155 chars
                </span>
                <button
                  type="button"
                  onClick={() => onChange({ ...article, seoDescription: article.excerpt })}
                  className="text-[10px] font-bold text-blue-600 hover:underline"
                >
                  Use Excerpt
                </button>
              </div>
            </div>

            <textarea
              rows={3}
              value={article.seoDescription || ""}
              onChange={e => onChange({ ...article, seoDescription: e.target.value })}
              placeholder={`Auto fallback: ${article.excerpt || "Article excerpt paragraph..."}`}
              className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-medium text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500/20 resize-none"
            />

            {/* Description Indicator Bar */}
            <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-300 ${
                  descLength < 120 ? "bg-amber-500" : descLength <= 155 ? "bg-emerald-500" : "bg-rose-500"
                }`}
                style={{ width: `${Math.min(100, (descLength / 155) * 100)}%` }}
              />
            </div>
            <p className="text-[10px] text-slate-400">
              Ideal length: 120–155 characters max. Include focus keyword and a clear call to action.
            </p>
          </div>

          {/* Focus Keyword & URL Slug */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-4 rounded-2xl bg-white dark:bg-[#111A2E] border border-slate-200/80 dark:border-slate-800 space-y-2 shadow-xs">
              <div className="flex items-center justify-between">
                <label className="text-xs font-black uppercase text-slate-700 dark:text-slate-300 tracking-wider">
                  Focus Keyword
                </label>
                <span className="text-[10px] font-mono text-slate-400">
                  {keywordWordCount} words
                </span>
              </div>
              <input
                type="text"
                value={article.focusKeyword || ""}
                onChange={e => onChange({ ...article, focusKeyword: e.target.value })}
                placeholder="e.g. Rajasthan Economic Survey 2024"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-900 dark:text-white"
              />
            </div>

            <div className="p-4 rounded-2xl bg-white dark:bg-[#111A2E] border border-slate-200/80 dark:border-slate-800 space-y-2 shadow-xs">
              <div className="flex items-center justify-between">
                <label className="text-xs font-black uppercase text-slate-700 dark:text-slate-300 tracking-wider">
                  Canonical URL Slug
                </label>
                <button
                  type="button"
                  onClick={handleCopySlug}
                  className="text-[10px] font-bold text-blue-600 hover:underline flex items-center gap-1"
                >
                  {copiedSlug ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedSlug ? "Copied" : "Copy Link"}</span>
                </button>
              </div>
              <input
                type="text"
                value={article.slug || ""}
                onChange={e => onChange({ ...article, slug: e.target.value.toLowerCase().replace(/[^a-z0-9\-]/g, "") })}
                placeholder="kebab-case-slug"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-mono text-slate-900 dark:text-white"
              />
            </div>
          </div>

          {/* Author EEAT & Social Media OpenGraph & Cover Image */}
          <div className="p-4 rounded-2xl bg-white dark:bg-[#111A2E] border border-slate-200/80 dark:border-slate-800 space-y-3 shadow-xs">
            <label className="text-xs font-black uppercase text-slate-700 dark:text-slate-300 tracking-wider">
              Author EEAT & Cover Image (OpenGraph Asset)
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                type="text"
                value={article.authorName || ""}
                onChange={e => onChange({ ...article, authorName: e.target.value })}
                placeholder="Author Name (e.g. DISHA 20-20 Editorial Team)"
                className="px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold"
              />
              <input
                type="text"
                value={article.authorBio || ""}
                onChange={e => onChange({ ...article, authorBio: e.target.value })}
                placeholder="Author Bio (e.g. Senior RPSC Analyst)"
                className="px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-medium"
              />
            </div>

            {/* Cover Image Upload / URL & Removal */}
            <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400">
                  Featured / Cover Image URL
                </label>
                {coverImageUrl && (
                  <button
                    type="button"
                    onClick={() => onChange({ ...article, coverImageUrl: "" })}
                    className="text-[10px] font-bold text-rose-600 dark:text-rose-400 hover:underline cursor-pointer flex items-center gap-1"
                  >
                    <span>Remove Cover Image</span>
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={article.coverImageUrl || ""}
                  onChange={e => onChange({ ...article, coverImageUrl: e.target.value })}
                  placeholder="https://images.unsplash.com/... or upload below"
                  className="flex-1 px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-mono"
                />

                <label className="px-3 py-2 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900/50 text-blue-700 dark:text-blue-300 rounded-xl text-xs font-bold cursor-pointer transition-colors flex items-center gap-1 shrink-0">
                  <span>Upload IMG</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={e => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onload = ev => {
                          if (ev.target?.result) {
                            onChange({ ...article, coverImageUrl: ev.target.result as string });
                          }
                        };
                        reader.readAsDataURL(file);
                      }
                    }}
                  />
                </label>
              </div>

              {coverImageUrl && (
                <div className="relative w-full h-32 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900">
                  <img
                    src={coverImageUrl}
                    alt="Cover preview"
                    className="w-full h-full object-cover"
                    onError={e => {
                      (e.target as any).style.display = "none";
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => onChange({ ...article, coverImageUrl: "" })}
                    className="absolute top-2 right-2 px-2 py-1 bg-rose-600/90 hover:bg-rose-700 text-white text-[10px] font-bold rounded-lg backdrop-blur-xs shadow-xs cursor-pointer"
                  >
                    Remove Image
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: SERP SIMULATOR & SEO CHECKLIST */}
        <div className="lg:col-span-5 space-y-4">
          {/* SERP SIMULATOR CARD */}
          <div className="p-4 rounded-3xl bg-white dark:bg-[#111A2E] border border-slate-200/80 dark:border-slate-800 space-y-3 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-extrabold text-slate-800 dark:text-slate-200">
                <Search className="w-3.5 h-3.5 text-blue-500" />
                <span>Google Search Snippet Preview</span>
                <span className="text-[10px] font-mono text-slate-400 font-bold ml-1">
                  (Live Typing)
                </span>
              </div>

              <div className="flex p-0.5 bg-slate-100 dark:bg-slate-900 rounded-lg border">
                <button
                  type="button"
                  onClick={() => setSerpView("desktop")}
                  className={`px-2.5 py-1 rounded-md text-[10px] font-bold cursor-pointer ${
                    serpView === "desktop" ? "bg-white dark:bg-slate-800 text-blue-600 shadow-xs" : "text-slate-400"
                  }`}
                >
                  <Monitor className="w-3 h-3 inline mr-1" /> Desktop
                </button>
                <button
                  type="button"
                  onClick={() => setSerpView("mobile")}
                  className={`px-2.5 py-1 rounded-md text-[10px] font-bold cursor-pointer ${
                    serpView === "mobile" ? "bg-white dark:bg-slate-800 text-blue-600 shadow-xs" : "text-slate-400"
                  }`}
                >
                  <Smartphone className="w-3 h-3 inline mr-1" /> Mobile
                </button>
              </div>
            </div>

            {/* Google Result Card Simulation */}
            <div className={`p-4 rounded-2xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1 font-sans ${
              serpView === "mobile" ? "max-w-xs mx-auto shadow-sm" : "w-full"
            }`}>
              {/* Site Identity & Breadcrumb */}
              <div className="flex items-center gap-2 text-[11px] text-slate-600 dark:text-slate-400">
                <div className="w-4 h-4 rounded-full bg-[#800020] text-[#FFF9EF] flex items-center justify-center font-black text-[8px] shrink-0">
                  D
                </div>
                <div className="truncate min-w-0">
                  <span className="font-bold text-slate-800 dark:text-slate-200">DISHA 20-20 Exam Prep</span>
                  <span className="text-slate-400 font-mono text-[10px] ml-1">
                    https://disha2020.in › news › {slug || "article-url-slug"}
                  </span>
                </div>
              </div>

              {/* Title with Truncation Warning */}
              <h4 className="text-base font-medium text-[#1a0dab] dark:text-[#8ab4f8] hover:underline cursor-pointer leading-snug break-words">
                {titleLength === 0 ? (
                  <span className="text-slate-400 italic">Type Meta Title above...</span>
                ) : titleLength > 60 ? (
                  <span>
                    {title.substring(0, 57)}
                    <span className="text-rose-500 font-bold bg-rose-50 dark:bg-rose-950/40 px-0.5 rounded">...</span>
                  </span>
                ) : (
                  title
                )}
              </h4>

              {/* Meta Snippet Paragraph with Focus Keyword Highlight */}
              <p className="text-xs text-[#4d5156] dark:text-[#bdc1c6] leading-relaxed break-words pt-0.5">
                {descLength === 0 ? (
                  <span className="text-slate-400 italic">Type Meta Description above to preview Google snippet...</span>
                ) : descLength > 155 ? (
                  <span>
                    {renderSnippetWithBoldKeywords(description.substring(0, 152), focusKeyword)}
                    <span className="text-rose-500 font-bold bg-rose-50 dark:bg-rose-950/40 px-0.5 rounded">...</span>
                  </span>
                ) : (
                  renderSnippetWithBoldKeywords(description, focusKeyword)
                )}
              </p>

              {/* SERP Meta Badge Footer */}
              <div className="pt-2 mt-2 border-t border-slate-100 dark:border-slate-900 flex items-center justify-between text-[9.5px] text-slate-400">
                <span>Google Search Snippet</span>
                <div className="flex items-center gap-2 font-mono">
                  <span className={titleLength > 60 ? "text-rose-500 font-bold" : ""}>Title: {titleLength}/60</span>
                  <span>•</span>
                  <span className={descLength > 155 ? "text-rose-500 font-bold" : ""}>Desc: {descLength}/155</span>
                </div>
              </div>
            </div>
          </div>

          {/* SEO BEST PRACTICES CHECKLIST */}
          <div className="p-4 rounded-3xl bg-white dark:bg-[#111A2E] border border-slate-200/80 dark:border-slate-800 space-y-3 shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
              <span className="text-xs font-black uppercase text-slate-800 dark:text-slate-200 tracking-wider">
                SEO Best Practices Audit ({passedCount}/{totalCount})
              </span>
              <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${getScoreColor(seoScore)}`}>
                {seoScore >= 80 ? "Search Ready" : seoScore >= 50 ? "Needs Polish" : "Low Score"}
              </span>
            </div>

            <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
              {checklist.map(item => (
                <div
                  key={item.id}
                  className={`p-2.5 rounded-xl border text-xs flex items-start gap-2.5 transition-colors ${
                    item.pass
                      ? "bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200/60 dark:border-emerald-900/40 text-emerald-950 dark:text-emerald-200"
                      : "bg-slate-50 dark:bg-slate-900/60 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400"
                  }`}
                >
                  {item.pass ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                  )}

                  <div className="space-y-0.5 min-w-0 flex-1">
                    <div className="flex items-center justify-between font-bold">
                      <span className={item.pass ? "text-slate-900 dark:text-white" : "text-slate-700 dark:text-slate-300"}>
                        {item.label}
                      </span>
                      <span className="text-[10px] font-mono opacity-80 shrink-0 ml-1">
                        {item.current}
                      </span>
                    </div>
                    <p className="text-[10.5px] opacity-80 leading-tight">
                      {item.tip}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
