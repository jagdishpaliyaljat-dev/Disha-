import * as React from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  X,
  Code,
  Eye,
  Columns,
  Save,
  Send,
  Settings,
  Image as ImageIcon,
  Link as LinkIcon,
  Table as TableIcon,
  Sparkles,
  Smartphone,
  Tablet,
  Monitor,
  Check,
  AlertCircle,
  FolderPlus,
  Tag,
  FileText,
  User,
  Globe,
  HelpCircle,
  Maximize2,
  Minimize2,
  Copy,
  Undo2,
  Redo2,
} from "lucide-react";
import { NewsArticle } from "../../types";
import { SaveProgress } from "../../utils/articleStorage";
import { RawHtmlArticleViewer } from "../news/RawHtmlArticleViewer";

export interface ArticleBlockEditorModalProps {
  isOpen: boolean;
  editingArticle: Partial<NewsArticle>;
  categories: string[];
  onSave: (articleToSave: Partial<NewsArticle>) => Promise<void>;
  onClose: () => void;
  actionLoading: string | null;
  saveProgress: SaveProgress | null;
  handleCreateCategory: (catName: string) => Promise<void>;
  handleAiOptimizeSeo?: () => Promise<void>;
  aiGenerating?: boolean;
}

/**
 * Blogger-Style Article Writing & Publishing Modal
 * Supports pasting 100% raw HTML/CSS code directly without stripping, formatting, or alterations.
 * Features:
 * - </> HTML View (Default / Primary): Raw code editor with snippet inserts and tab support
 * - 👁️ Compose / Live Preview: Instant live preview with responsive viewport switches
 * - 🗂️ Split View: Side-by-side editing and previewing for desktop screens
 * - Blogger Post Settings Drawer: Slug, Labels/Categories, Featured Image, SEO Excerpt, Author
 */
export const ArticleBlockEditorModal: React.FC<ArticleBlockEditorModalProps> = ({
  isOpen,
  editingArticle: initialArticle,
  categories,
  onSave,
  onClose,
  actionLoading,
  saveProgress,
  handleCreateCategory,
}) => {
  const [article, setArticle] = React.useState<Partial<NewsArticle>>(() => {
    // Preserve raw HTML content if present, or reconstruct if only blocks existed
    let initialContent = initialArticle.content || "";
    return {
      ...initialArticle,
      content: initialContent,
      category: initialArticle.category || (categories[0] || "General"),
      authorName: initialArticle.authorName || "Disha PYQ Editorial",
      status: initialArticle.status || "published",
      coverImageUrl: initialArticle.coverImageUrl || "",
    };
  });

  // Editor View Mode: "html" (default), "preview", or "split"
  const [viewMode, setViewMode] = React.useState<"html" | "preview" | "split">("html");
  // Device Preview: "desktop" | "tablet" | "mobile"
  const [previewDevice, setPreviewDevice] = React.useState<"desktop" | "tablet" | "mobile">("desktop");
  // Post Settings Drawer open state
  const [isSettingsOpen, setIsSettingsOpen] = React.useState(false);
  // Fullscreen modal state
  const [isFullscreen, setIsFullscreen] = React.useState(false);

  // Category creation inline
  const [isAddingCategory, setIsAddingCategory] = React.useState(false);
  const [newCategoryName, setNewCategoryName] = React.useState("");
  const [isSubmittingCat, setIsSubmittingCat] = React.useState(false);

  // Textarea reference for quick tag inserts
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const [copyFeedback, setCopyFeedback] = React.useState(false);

  // Sync state if initialArticle changes
  React.useEffect(() => {
    setArticle((prev) => ({
      ...prev,
      ...initialArticle,
      content: initialArticle.content !== undefined ? initialArticle.content : prev.content || "",
    }));
  }, [initialArticle]);

  if (!isOpen) return null;

  // Insert HTML Snippet at cursor in HTML View
  const insertHtmlSnippet = (startTag: string, endTag: string = "", placeholder: string = "") => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const startPos = textarea.selectionStart;
    const endPos = textarea.selectionEnd;
    const currentVal = article.content || "";
    const selectedText = currentVal.substring(startPos, endPos) || placeholder;

    const replacement = `${startTag}${selectedText}${endTag}`;
    const newContent = currentVal.substring(0, startPos) + replacement + currentVal.substring(endPos);

    setArticle((prev) => ({ ...prev, content: newContent }));

    setTimeout(() => {
      textarea.focus();
      const newCursorPos = startPos + startTag.length + selectedText.length;
      textarea.setSelectionRange(newCursorPos, newCursorPos);
    }, 10);
  };

  // Handle Tab key in Textarea to insert 2 spaces
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Tab") {
      e.preventDefault();
      const textarea = e.currentTarget;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const val = textarea.value;

      const updated = val.substring(0, start) + "  " + val.substring(end);
      setArticle((prev) => ({ ...prev, content: updated }));

      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd = start + 2;
      }, 0);
    }
  };

  // Generate URL Slug from Title
  const handleGenerateSlug = () => {
    if (!article.title) return;
    const generated = article.title
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, "")
      .replace(/[\s_-]+/g, "-")
      .replace(/^-+|-+$/g, "");
    setArticle((prev) => ({ ...prev, slug: generated }));
  };

  // Graceful title fallback for editor preview
  const getEditorPreviewTitle = (art: Partial<NewsArticle>): string => {
    const t = art.title?.trim();
    if (t && t !== "Untitled Article" && t !== "Untitled") return t;
    if (art.seoTitle?.trim() && art.seoTitle !== "Untitled Article") return art.seoTitle.trim();
    if (art.category) return `${art.category} — Complete Exam Guide`;
    return "Competitive Exam Preparation: Complete Study Guide & Notes";
  };

  // Handle Save (Draft or Publish)
  const handleSubmit = async (publish: boolean) => {
    const validTitle =
      article.title?.trim() && article.title.trim() !== "Untitled Article"
        ? article.title.trim()
        : article.seoTitle?.trim() ||
          (article.category ? `${article.category} — Complete Exam Guide` : "Competitive Exam Preparation: Complete Study Guide & Notes");

    const toSave: Partial<NewsArticle> = {
      ...article,
      title: validTitle,
      content: article.content || "",
      status: publish ? "published" : "draft",
      updatedAt: new Date().toISOString(),
      ...(publish && !article.publishedAt ? { publishedAt: new Date().toISOString() } : {}),
    };
    await onSave(toSave);
  };

  // Add category inline
  const handleAddCategorySubmit = async () => {
    const trimmed = newCategoryName.trim();
    if (!trimmed) return;
    try {
      setIsSubmittingCat(true);
      await handleCreateCategory(trimmed);
      setArticle((prev) => ({ ...prev, category: trimmed }));
      setNewCategoryName("");
      setIsAddingCategory(false);
    } catch (err) {
      console.error("Failed to add category:", err);
    } finally {
      setIsSubmittingCat(false);
    }
  };

  // Copy raw HTML to clipboard
  const handleCopyRaw = () => {
    if (!article.content) return;
    navigator.clipboard.writeText(article.content);
    setCopyFeedback(true);
    setTimeout(() => setCopyFeedback(false), 2000);
  };

  const rawHtml = article.content || "";
  const charCount = rawHtml.length;
  const wordCount = rawHtml.trim() ? rawHtml.trim().split(/\s+/).length : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-2 sm:p-4 overflow-hidden animate-in fade-in duration-200">
      <div
        className={`bg-white dark:bg-[#1A1D27] rounded-2xl sm:rounded-3xl shadow-2xl flex flex-col border border-[#E8D9C0] dark:border-[#2D3345] transition-all duration-200 ${
          isFullscreen ? "w-full h-full rounded-none" : "w-full max-w-[96vw] xl:max-w-7xl h-[94vh]"
        }`}
      >
        {/* ========================================================= */}
        {/* TOP BAR: Title, View Switcher, Snippet Tools & Actions   */}
        {/* ========================================================= */}
        <header className="px-4 py-3 sm:px-6 sm:py-3.5 border-b border-[#E8D9C0] dark:border-[#2D3345] bg-[#FFF9EF]/80 dark:bg-[#141721]/80 backdrop-blur-md flex flex-col md:flex-row md:items-center justify-between gap-3 shrink-0">
          {/* Post Title Input */}
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-[#800020] text-[#FFF9EF] flex items-center justify-center font-black shrink-0 shadow-sm">
              <Code className="w-5 h-5" />
            </div>
            <input
              type="text"
              value={article.title || ""}
              onChange={(e) => setArticle((prev) => ({ ...prev, title: e.target.value }))}
              placeholder="Post Title: Enter article headline..."
              className="w-full bg-transparent text-base sm:text-lg font-bold text-[#171923] dark:text-[#FFF9EF] placeholder-[#8C93A8] focus:outline-hidden"
            />
          </div>

          {/* Mode Switchers & Actions */}
          <div className="flex items-center gap-2 flex-wrap justify-between md:justify-end">
            {/* View Mode Toggle: </> HTML | 👁️ Preview | 🗂️ Split */}
            <div className="inline-flex rounded-xl bg-[#EFE4D2] dark:bg-[#202534] p-1 border border-[#E8D9C0] dark:border-[#31374A]">
              <button
                type="button"
                onClick={() => setViewMode("html")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                  viewMode === "html"
                    ? "bg-[#800020] text-white shadow-xs"
                    : "text-[#52576A] dark:text-[#A0AEC0] hover:text-[#171923] dark:hover:text-white"
                }`}
                title="Blogger-Style Raw HTML Code Editor"
              >
                <Code className="w-3.5 h-3.5" />
                <span>&lt;/&gt; HTML View</span>
              </button>

              <button
                type="button"
                onClick={() => setViewMode("preview")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                  viewMode === "preview"
                    ? "bg-[#800020] text-white shadow-xs"
                    : "text-[#52576A] dark:text-[#A0AEC0] hover:text-[#171923] dark:hover:text-white"
                }`}
                title="Live Rendered Preview"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>Compose / Preview</span>
              </button>

              <button
                type="button"
                onClick={() => setViewMode("split")}
                className={`hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                  viewMode === "split"
                    ? "bg-[#800020] text-white shadow-xs"
                    : "text-[#52576A] dark:text-[#A0AEC0] hover:text-[#171923] dark:hover:text-white"
                }`}
                title="Side-by-Side Code and Live Preview"
              >
                <Columns className="w-3.5 h-3.5" />
                <span>Split</span>
              </button>
            </div>

            {/* Post Settings Toggle */}
            <button
              type="button"
              onClick={() => setIsSettingsOpen(!isSettingsOpen)}
              className={`p-2 rounded-xl border transition-colors ${
                isSettingsOpen
                  ? "bg-[#800020]/10 border-[#800020] text-[#800020] dark:text-[#F47B20]"
                  : "border-[#E8D9C0] dark:border-[#31374A] text-[#52576A] dark:text-[#A0AEC0] hover:bg-[#EFE4D2] dark:hover:bg-[#202534]"
              }`}
              title="Post Settings (Slug, Category, Featured Image, SEO)"
            >
              <Settings className="w-4 h-4" />
            </button>

            {/* Fullscreen Toggle */}
            <button
              type="button"
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="p-2 rounded-xl border border-[#E8D9C0] dark:border-[#31374A] text-[#52576A] dark:text-[#A0AEC0] hover:bg-[#EFE4D2] dark:hover:bg-[#202534] transition-colors hidden sm:block"
              title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>

            {/* Save Draft Button */}
            <button
              type="button"
              disabled={!!actionLoading}
              onClick={() => handleSubmit(false)}
              className="px-3.5 py-1.5 rounded-xl border border-[#D5C2A5] dark:border-[#3D455D] text-xs font-extrabold text-[#52576A] dark:text-[#CBD2E1] hover:bg-[#EFE4D2] dark:hover:bg-[#252A3A] transition-colors flex items-center gap-1.5 disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Draft</span>
            </button>

            {/* Direct Publish Button */}
            <button
              type="button"
              disabled={!!actionLoading}
              onClick={() => handleSubmit(true)}
              className="px-4 py-1.5 rounded-xl bg-gradient-to-r from-[#800020] to-[#A00028] text-white text-xs font-black shadow-md shadow-[#800020]/25 hover:brightness-110 active:scale-95 transition-all flex items-center gap-1.5 disabled:opacity-50"
            >
              {actionLoading ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  <span>{article.id ? "Update" : "Publish"}</span>
                </>
              )}
            </button>

            {/* Close Button */}
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-[#8C93A8] hover:text-[#171923] dark:hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* Progress Bar during saves */}
        {saveProgress && (
          <div className="bg-[#800020]/10 px-4 py-1.5 text-xs text-[#800020] dark:text-[#F47B20] font-bold flex items-center justify-between border-b border-[#800020]/20">
            <span>Saving article ({saveProgress.stage})...</span>
            <span>{Math.round(saveProgress.percent)}%</span>
          </div>
        )}

        {/* ========================================================= */}
        {/* QUICK HTML SNIPPETS TOOLBAR (When in HTML or Split Mode)   */}
        {/* ========================================================= */}
        {viewMode !== "preview" && (
          <div className="px-4 py-2 border-b border-[#E8D9C0] dark:border-[#2D3345] bg-[#FDF8F0] dark:bg-[#161924] flex items-center gap-1.5 overflow-x-auto text-xs shrink-0 select-none">
            <span className="text-[10px] font-bold text-[#8C93A8] uppercase tracking-wider mr-1">
              Insert:
            </span>

            <button
              type="button"
              onClick={() => insertHtmlSnippet("<h2>", "</h2>", "Section Heading")}
              className="px-2 py-1 rounded-md bg-white dark:bg-[#202534] border border-[#E8D9C0] dark:border-[#31374A] font-mono text-[11px] font-bold hover:bg-[#800020] hover:text-white transition-colors"
              title="Add <h2> Section Heading"
            >
              &lt;h2&gt;
            </button>

            <button
              type="button"
              onClick={() => insertHtmlSnippet("<h3>", "</h3>", "Sub-heading")}
              className="px-2 py-1 rounded-md bg-white dark:bg-[#202534] border border-[#E8D9C0] dark:border-[#31374A] font-mono text-[11px] font-bold hover:bg-[#800020] hover:text-white transition-colors"
              title="Add <h3> Sub-heading"
            >
              &lt;h3&gt;
            </button>

            <button
              type="button"
              onClick={() => insertHtmlSnippet("<strong>", "</strong>", "bold text")}
              className="px-2 py-1 rounded-md bg-white dark:bg-[#202534] border border-[#E8D9C0] dark:border-[#31374A] font-bold hover:bg-[#800020] hover:text-white transition-colors"
              title="Bold Text"
            >
              B
            </button>

            <button
              type="button"
              onClick={() =>
                insertHtmlSnippet(
                  `<table class="table-auto w-full border-collapse border border-gray-300 my-4">\n  <thead>\n    <tr class="bg-gray-100 dark:bg-gray-800">\n      <th class="border border-gray-300 p-2">Header 1</th>\n      <th class="border border-gray-300 p-2">Header 2</th>\n    </tr>\n  </thead>\n  <tbody>\n    <tr>\n      <td class="border border-gray-300 p-2">Data 1</td>\n      <td class="border border-gray-300 p-2">Data 2</td>\n    </tr>\n  </tbody>\n</table>\n`
                )
              }
              className="px-2 py-1 rounded-md bg-white dark:bg-[#202534] border border-[#E8D9C0] dark:border-[#31374A] flex items-center gap-1 font-bold hover:bg-[#800020] hover:text-white transition-colors"
              title="Insert Clean HTML Table"
            >
              <TableIcon className="w-3 h-3" />
              <span>Table</span>
            </button>

            <button
              type="button"
              onClick={() =>
                insertHtmlSnippet(
                  `<style>\n  /* Custom Styles */\n  .custom-highlight {\n    background-color: #fff9ef;\n    border-left: 4px solid #800020;\n    padding: 12px 16px;\n    border-radius: 8px;\n  }\n</style>\n`
                )
              }
              className="px-2 py-1 rounded-md bg-white dark:bg-[#202534] border border-[#E8D9C0] dark:border-[#31374A] flex items-center gap-1 font-mono text-[11px] font-bold hover:bg-[#800020] hover:text-white transition-colors"
              title="Insert <style> block"
            >
              &lt;style&gt;
            </button>

            <button
              type="button"
              onClick={() =>
                insertHtmlSnippet(
                  `<div style="background: rgba(128, 0, 32, 0.06); border-left: 4px solid #800020; padding: 14px 18px; border-radius: 8px; margin: 16px 0;">\n  <strong>Important Note:</strong> Enter your key announcement or note here.\n</div>\n`
                )
              }
              className="px-2 py-1 rounded-md bg-white dark:bg-[#202534] border border-[#E8D9C0] dark:border-[#31374A] flex items-center gap-1 font-bold hover:bg-[#800020] hover:text-white transition-colors"
              title="Callout Box"
            >
              <span>Callout</span>
            </button>

            <button
              type="button"
              onClick={() =>
                insertHtmlSnippet(
                  `<iframe width="100%" height="400" src="https://www.youtube.com/embed/VIDEO_ID" frameborder="0" allowfullscreen style="border-radius: 12px; margin: 16px 0;"></iframe>\n`
                )
              }
              className="px-2 py-1 rounded-md bg-white dark:bg-[#202534] border border-[#E8D9C0] dark:border-[#31374A] font-mono text-[11px] font-bold hover:bg-[#800020] hover:text-white transition-colors"
              title="Embed <iframe> Video"
            >
              &lt;iframe&gt;
            </button>

            <button
              type="button"
              onClick={() =>
                insertHtmlSnippet('<a href="https://example.com" target="_blank" rel="noopener noreferrer">', "</a>", "Link Text")
              }
              className="px-2 py-1 rounded-md bg-white dark:bg-[#202534] border border-[#E8D9C0] dark:border-[#31374A] flex items-center gap-1 font-bold hover:bg-[#800020] hover:text-white transition-colors"
              title="Insert Hyperlink"
            >
              <LinkIcon className="w-3 h-3" />
              <span>Link</span>
            </button>

            <button
              type="button"
              onClick={() =>
                insertHtmlSnippet(
                  `<img src="https://example.com/image.jpg" alt="Description" style="max-width: 100%; height: auto; border-radius: 12px; margin: 16px 0;" />\n`
                )
              }
              className="px-2 py-1 rounded-md bg-white dark:bg-[#202534] border border-[#E8D9C0] dark:border-[#31374A] flex items-center gap-1 font-bold hover:bg-[#800020] hover:text-white transition-colors"
              title="Insert Image Tag"
            >
              <ImageIcon className="w-3 h-3" />
              <span>Img</span>
            </button>

            <button
              type="button"
              onClick={() =>
                insertHtmlSnippet(
                  `<a href="/practice" style="display: inline-block; background-color: #800020; color: #ffffff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; margin: 16px 0;">Start Practice Test →</a>\n`
                )
              }
              className="px-2 py-1 rounded-md bg-white dark:bg-[#202534] border border-[#E8D9C0] dark:border-[#31374A] font-bold hover:bg-[#800020] hover:text-white transition-colors"
              title="CTA Practice Button"
            >
              CTA Button
            </button>

            <div className="ml-auto flex items-center gap-2 text-[11px] text-[#8C93A8]">
              <button
                type="button"
                onClick={handleCopyRaw}
                className="flex items-center gap-1 px-2 py-1 rounded-md hover:bg-[#EFE4D2] dark:hover:bg-[#202534] text-[#52576A] dark:text-[#A0AEC0] transition-colors"
                title="Copy Raw HTML"
              >
                {copyFeedback ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                <span>{copyFeedback ? "Copied" : "Copy Code"}</span>
              </button>
              <span className="hidden sm:inline">|</span>
              <span className="font-mono hidden sm:inline">{wordCount} words</span>
              <span className="font-mono">{charCount} chars</span>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* MAIN BODY: HTML Editor / Live Preview / Split View        */}
        {/* ========================================================= */}
        <div className="flex-1 flex overflow-hidden relative">
          {/* Main Work Area */}
          <div className="flex-1 flex flex-col min-w-0 bg-white dark:bg-[#1A1D27] overflow-hidden">
            {/* 1. HTML VIEW (RAW CODE EDITOR) */}
            {viewMode === "html" && (
              <div className="flex-1 flex flex-col p-4 overflow-hidden bg-[#FAFAF8] dark:bg-[#13151D]">
                <div className="text-[11px] text-[#8C93A8] mb-1.5 flex items-center justify-between font-sans">
                  <span>
                    Paste your raw HTML/CSS code directly below. All &lt;style&gt;, &lt;table&gt;, &lt;iframe&gt;, and inline styles are preserved 100% as-is:
                  </span>
                  <span className="text-[10px] bg-[#EFE4D2] dark:bg-[#202534] px-2 py-0.5 rounded font-mono">
                    Tab key inserts 2 spaces
                  </span>
                </div>
                <textarea
                  ref={textareaRef}
                  value={article.content || ""}
                  onChange={(e) => setArticle((prev) => ({ ...prev, content: e.target.value }))}
                  onKeyDown={handleKeyDown}
                  placeholder="<h2>Article Headline</h2>&#10;<p>Paste your raw HTML or CSS code here...</p>&#10;<style>&#10;  .custom-box { background: #fdf; }&#10;</style>"
                  spellCheck={false}
                  className="flex-1 w-full p-4 font-mono text-sm leading-relaxed text-[#171923] dark:text-[#E2E8F0] bg-white dark:bg-[#181B26] border border-[#E8D9C0] dark:border-[#2D3345] rounded-xl focus:outline-hidden focus:border-[#800020] dark:focus:border-[#F47B20] resize-none shadow-inner"
                />
              </div>
            )}

            {/* 2. LIVE PREVIEW VIEW */}
            {viewMode === "preview" && (
              <div className="flex-1 flex flex-col overflow-hidden bg-[#F6F7FA] dark:bg-[#11131A]">
                {/* Viewport Width Toolbar */}
                <div className="px-4 py-2 border-b border-[#E8D9C0] dark:border-[#2D3345] bg-white dark:bg-[#181B26] flex items-center justify-between shrink-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-[#52576A] dark:text-[#A0AEC0]">Device Preview:</span>
                    <div className="inline-flex rounded-lg bg-[#EFE4D2] dark:bg-[#202534] p-0.5 border border-[#E8D9C0] dark:border-[#31374A]">
                      <button
                        type="button"
                        onClick={() => setPreviewDevice("desktop")}
                        className={`p-1.5 rounded-md text-xs transition-colors ${
                          previewDevice === "desktop"
                            ? "bg-[#800020] text-white"
                            : "text-[#52576A] dark:text-[#A0AEC0]"
                        }`}
                        title="Desktop View (100%)"
                      >
                        <Monitor className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setPreviewDevice("tablet")}
                        className={`p-1.5 rounded-md text-xs transition-colors ${
                          previewDevice === "tablet"
                            ? "bg-[#800020] text-white"
                            : "text-[#52576A] dark:text-[#A0AEC0]"
                        }`}
                        title="Tablet View (768px)"
                      >
                        <Tablet className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setPreviewDevice("mobile")}
                        className={`p-1.5 rounded-md text-xs transition-colors ${
                          previewDevice === "mobile"
                            ? "bg-[#800020] text-white"
                            : "text-[#52576A] dark:text-[#A0AEC0]"
                        }`}
                        title="Mobile View (375px)"
                      >
                        <Smartphone className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <span className="text-xs text-[#8C93A8]">
                    Exact live rendering as seen in Disha PYQ App
                  </span>
                </div>

                {/* Preview Frame Container */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-6 flex justify-center">
                  <div
                    className={`bg-white dark:bg-[#1A1D27] p-6 sm:p-8 rounded-2xl shadow-md border border-[#E8D9C0] dark:border-[#2D3345] transition-all duration-200 ${
                      previewDevice === "desktop"
                        ? "w-full max-w-4xl"
                        : previewDevice === "tablet"
                        ? "w-[768px] max-w-full"
                        : "w-[375px] max-w-full"
                    }`}
                  >
                    {/* Render Title */}
                    <h1 className="text-2xl sm:text-3xl font-black text-[#171923] dark:text-[#FFF9EF] mb-4 pb-3 border-b border-[#E8D9C0] dark:border-[#2D3345]">
                      {getEditorPreviewTitle(article)}
                    </h1>

                    {/* Render Raw HTML directly via RawHtmlArticleViewer */}
                    {article.content && article.content.trim() ? (
                      <RawHtmlArticleViewer htmlContent={article.content} />
                    ) : (
                      <div className="py-16 text-center text-[#8C93A8]">
                        <Code className="w-10 h-10 mx-auto mb-2 opacity-40" />
                        <p className="text-sm font-semibold">No HTML content yet.</p>
                        <p className="text-xs mt-1">Switch to &lt;/&gt; HTML View to paste your code.</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* 3. SPLIT VIEW (Code Left, Preview Right) */}
            {viewMode === "split" && (
              <div className="flex-1 flex overflow-hidden">
                {/* Code Left */}
                <div className="w-1/2 flex flex-col p-4 border-r border-[#E8D9C0] dark:border-[#2D3345] bg-[#FAFAF8] dark:bg-[#13151D]">
                  <div className="text-[11px] font-bold text-[#8C93A8] mb-1.5 flex items-center justify-between">
                    <span>RAW HTML/CSS CODE:</span>
                    <span className="font-mono text-[10px]">{charCount} chars</span>
                  </div>
                  <textarea
                    ref={textareaRef}
                    value={article.content || ""}
                    onChange={(e) => setArticle((prev) => ({ ...prev, content: e.target.value }))}
                    onKeyDown={handleKeyDown}
                    placeholder="Paste raw HTML/CSS here..."
                    spellCheck={false}
                    className="flex-1 w-full p-4 font-mono text-xs leading-relaxed text-[#171923] dark:text-[#E2E8F0] bg-white dark:bg-[#181B26] border border-[#E8D9C0] dark:border-[#2D3345] rounded-xl focus:outline-hidden focus:border-[#800020] dark:focus:border-[#F47B20] resize-none shadow-inner"
                  />
                </div>

                {/* Preview Right */}
                <div className="w-1/2 flex flex-col overflow-y-auto p-6 bg-white dark:bg-[#1A1D27]">
                  <div className="text-[11px] font-bold text-[#8C93A8] uppercase tracking-wider mb-3 pb-2 border-b border-[#E8D9C0] dark:border-[#2D3345]">
                    Live Output:
                  </div>
                  <h1 className="text-2xl font-black text-[#171923] dark:text-[#FFF9EF] mb-4 pb-2 border-b border-[#E8D9C0] dark:border-[#2D3345]">
                    {getEditorPreviewTitle(article)}
                  </h1>
                  {article.content && article.content.trim() ? (
                    <RawHtmlArticleViewer htmlContent={article.content} />
                  ) : (
                    <div className="py-12 text-center text-[#8C93A8] text-xs">
                      Type or paste HTML on the left to see live preview
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* ========================================================= */}
          {/* BLOGGER-STYLE POST SETTINGS DRAWER (Right Sidebar)       */}
          {/* ========================================================= */}
          <AnimatePresence>
            {isSettingsOpen && (
              <motion.aside
                initial={{ width: 0, opacity: 0 }}
                animate={{ width: 340, opacity: 1 }}
                exit={{ width: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="border-l border-[#E8D9C0] dark:border-[#2D3345] bg-[#FDFBF7] dark:bg-[#161924] flex flex-col shrink-0 overflow-y-auto"
              >
                <div className="p-4 border-b border-[#E8D9C0] dark:border-[#2D3345] flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm font-black text-[#171923] dark:text-[#FFF9EF]">
                    <Settings className="w-4 h-4 text-[#800020] dark:text-[#F47B20]" />
                    <span>Post Settings</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsSettingsOpen(false)}
                    className="p-1 rounded-lg text-[#8C93A8] hover:text-[#171923] dark:hover:text-white"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="p-4 space-y-5 text-xs">
                  {/* 1. Category / Labels */}
                  <div>
                    <label className="block text-[11px] font-black uppercase tracking-wider text-[#52576A] dark:text-[#A0AEC0] mb-1.5 flex items-center justify-between">
                      <span className="flex items-center gap-1">
                        <Tag className="w-3 h-3 text-[#800020] dark:text-[#F47B20]" />
                        <span>Category / Labels</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => setIsAddingCategory(!isAddingCategory)}
                        className="text-[#800020] dark:text-[#F47B20] hover:underline normal-case font-bold"
                      >
                        + New
                      </button>
                    </label>

                    {isAddingCategory && (
                      <div className="mb-2 p-2 bg-[#FFF9EF] dark:bg-[#202534] rounded-xl border border-[#E8D9C0] dark:border-[#31374A] flex items-center gap-1.5">
                        <input
                          type="text"
                          value={newCategoryName}
                          onChange={(e) => setNewCategoryName(e.target.value)}
                          placeholder="Category name..."
                          className="flex-1 bg-white dark:bg-[#161924] px-2 py-1 rounded-lg border border-[#E8D9C0] dark:border-[#31374A] text-xs focus:outline-hidden"
                        />
                        <button
                          type="button"
                          disabled={isSubmittingCat || !newCategoryName.trim()}
                          onClick={handleAddCategorySubmit}
                          className="px-2.5 py-1 bg-[#800020] text-white rounded-lg font-bold text-xs hover:brightness-110 disabled:opacity-50"
                        >
                          Add
                        </button>
                      </div>
                    )}

                    <select
                      value={article.category || ""}
                      onChange={(e) => setArticle((prev) => ({ ...prev, category: e.target.value }))}
                      className="w-full bg-white dark:bg-[#202534] border border-[#E8D9C0] dark:border-[#31374A] rounded-xl px-3 py-2 text-xs font-semibold text-[#171923] dark:text-[#FFF9EF] focus:outline-hidden focus:border-[#800020]"
                    >
                      {categories.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* 2. Permalink / Custom Slug */}
                  <div>
                    <label className="block text-[11px] font-black uppercase tracking-wider text-[#52576A] dark:text-[#A0AEC0] mb-1.5 flex items-center justify-between">
                      <span className="flex items-center gap-1">
                        <Globe className="w-3 h-3 text-[#800020] dark:text-[#F47B20]" />
                        <span>Permalink / Slug</span>
                      </span>
                      <button
                        type="button"
                        onClick={handleGenerateSlug}
                        className="text-[#800020] dark:text-[#F47B20] hover:underline normal-case font-bold"
                      >
                        Auto-generate
                      </button>
                    </label>
                    <input
                      type="text"
                      value={article.slug || ""}
                      onChange={(e) => setArticle((prev) => ({ ...prev, slug: e.target.value }))}
                      placeholder="e.g. rajasthan-cet-2026-syllabus"
                      className="w-full bg-white dark:bg-[#202534] border border-[#E8D9C0] dark:border-[#31374A] rounded-xl px-3 py-2 text-xs font-mono text-[#171923] dark:text-[#FFF9EF] focus:outline-hidden focus:border-[#800020]"
                    />
                    <p className="text-[10px] text-[#8C93A8] mt-1">
                      URL: /news/{article.slug || "your-slug-here"}
                    </p>
                  </div>

                  {/* 3. Featured Image URL */}
                  <div>
                    <label className="block text-[11px] font-black uppercase tracking-wider text-[#52576A] dark:text-[#A0AEC0] mb-1.5 flex items-center gap-1">
                      <ImageIcon className="w-3 h-3 text-[#800020] dark:text-[#F47B20]" />
                      <span>Featured Image URL</span>
                    </label>
                    <input
                      type="url"
                      value={article.coverImageUrl || ""}
                      onChange={(e) => setArticle((prev) => ({ ...prev, coverImageUrl: e.target.value }))}
                      placeholder="https://images.unsplash.com/..."
                      className="w-full bg-white dark:bg-[#202534] border border-[#E8D9C0] dark:border-[#31374A] rounded-xl px-3 py-2 text-xs text-[#171923] dark:text-[#FFF9EF] focus:outline-hidden focus:border-[#800020]"
                    />
                    {article.coverImageUrl && (
                      <div className="mt-2 rounded-xl overflow-hidden border border-[#E8D9C0] dark:border-[#31374A] max-h-32">
                        <img
                          src={article.coverImageUrl}
                          alt="Thumbnail preview"
                          className="w-full h-auto object-cover"
                          onError={(e) => {
                            (e.target as HTMLElement).style.display = "none";
                          }}
                        />
                      </div>
                    )}
                  </div>

                  {/* 4. Search Description / SEO Excerpt */}
                  <div>
                    <label className="block text-[11px] font-black uppercase tracking-wider text-[#52576A] dark:text-[#A0AEC0] mb-1.5 flex items-center gap-1">
                      <FileText className="w-3 h-3 text-[#800020] dark:text-[#F47B20]" />
                      <span>Search Description / Excerpt</span>
                    </label>
                    <textarea
                      rows={3}
                      value={article.excerpt || ""}
                      onChange={(e) => setArticle((prev) => ({ ...prev, excerpt: e.target.value }))}
                      placeholder="Short summary for Google search and social cards..."
                      className="w-full bg-white dark:bg-[#202534] border border-[#E8D9C0] dark:border-[#31374A] rounded-xl p-2.5 text-xs text-[#171923] dark:text-[#FFF9EF] focus:outline-hidden focus:border-[#800020] resize-none"
                    />
                  </div>

                  {/* 5. Author Name */}
                  <div>
                    <label className="block text-[11px] font-black uppercase tracking-wider text-[#52576A] dark:text-[#A0AEC0] mb-1.5 flex items-center gap-1">
                      <User className="w-3 h-3 text-[#800020] dark:text-[#F47B20]" />
                      <span>Author</span>
                    </label>
                    <input
                      type="text"
                      value={article.authorName || ""}
                      onChange={(e) => setArticle((prev) => ({ ...prev, authorName: e.target.value }))}
                      placeholder="Disha PYQ Editorial"
                      className="w-full bg-white dark:bg-[#202534] border border-[#E8D9C0] dark:border-[#31374A] rounded-xl px-3 py-2 text-xs font-semibold text-[#171923] dark:text-[#FFF9EF] focus:outline-hidden focus:border-[#800020]"
                    />
                  </div>

                  {/* 6. Publication Status */}
                  <div className="pt-2 border-t border-[#E8D9C0] dark:border-[#2D3345]">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-[#171923] dark:text-[#FFF9EF]">
                        Publish Status:
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                          article.status === "published"
                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                            : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                        }`}
                      >
                        {article.status === "published" ? "Published" : "Draft"}
                      </span>
                    </div>
                  </div>
                </div>
              </motion.aside>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};
