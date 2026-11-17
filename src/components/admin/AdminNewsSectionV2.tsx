import * as React from "react";
import { motion, AnimatePresence } from "motion/react";
import { apiFetch } from "../../utils/api";
import {
  Newspaper,
  Plus,
  Edit2,
  Trash2,
  Eye,
  CheckCircle2,
  AlertCircle,
  Clock,
  Sparkles,
  RefreshCw,
  X,
  FileText,
  Upload,
  ArrowLeft,
  Search,
  Filter,
  ArrowUpDown,
  Pin,
  Star,
  Copy,
  Layers,
  MoveUp,
  MoveDown,
  Globe,
  Smartphone,
  Monitor,
  Wand2,
  BookOpen,
  HelpCircle,
  Link,
  Table,
  Quote,
  AlertTriangle,
  Lightbulb,
  CheckSquare,
  Youtube,
  Send,
  ListOrdered,
  Type,
  Maximize2,
  Check,
  Tag,
  Share2,
  ChevronRight,
  ChevronDown,
  MoreVertical,
  FolderPlus,
} from "lucide-react";
import { NewsArticle, ArticleBlock, ArticleBlockType, FAQItem } from "../../types";
import { ArticleSEOControlPanel } from "./ArticleSEOControlPanel";
import { ArticleBlockEditorModal } from "./ArticleBlockEditorModal";
import { SmartArticleImportModal } from "./SmartArticleImportModal";
import { ConfirmDialog } from "./ConfirmDialog";
import { AdminCard } from "./AdminCard";
import {
  fetchAllArticlesAdmin,
  fetchArticleByIdAdmin,
  saveArticleAdmin,
  deleteArticleAdmin,
  bulkSaveArticlesAdmin,
  bulkDeleteArticlesAdmin,
  bulkRefreshArticlesPublishDate,
  refreshSingleArticleDate,
  fetchArticleCategories,
  saveArticleCategory,
  deleteArticleCategory,
  DEFAULT_ARTICLE_CATEGORIES,
  SaveProgress,
  migrateMissingSlugsAdmin,
} from "../../utils/articleStorage";

interface AdminNewsSectionProps {
  onBackToAdmin?: () => void;
  onPreviewArticle?: (slug: string) => void;
}

console.log("[AdminNewsSection] React object:", React);

export function AdminNewsSection({
  onBackToAdmin,
  onPreviewArticle,
}: AdminNewsSectionProps) {
  React.useEffect(() => {
    console.log("[AdminNewsSection] Mounted successfully");
  }, []);

  const [articles, setArticles] = React.useState<NewsArticle[]>([]);
  const [categories, setCategories] = React.useState<string[]>(DEFAULT_ARTICLE_CATEGORIES);
  const [loading, setLoading] = React.useState(true);
  const [actionLoading, setActionLoading] = React.useState<string | null>(null);
  const [notification, setNotification] = React.useState<{ type: "success" | "error"; message: string } | null>(null);

  // Category Management State
  const [isManageCategoriesOpen, setIsManageCategoriesOpen] = React.useState(false);
  const [newCategoryInput, setNewCategoryInput] = React.useState("");
  const [isCreatingCategoryInline, setIsCreatingCategoryInline] = React.useState(false);
  const [inlineCategoryInput, setInlineCategoryInput] = React.useState("");

  // Filters & Search
  const [searchQuery, setSearchQuery] = React.useState("");
  const [categoryFilter, setCategoryFilter] = React.useState<string>("all");
  const [statusFilter, setStatusFilter] = React.useState<string>("all");
  const [languageFilter, setLanguageFilter] = React.useState<string>("all");
  const [sortBy, setSortBy] = React.useState<"date" | "views" | "title">("date");
  const [selectedIds, setSelectedIds] = React.useState<string[]>([]);

  // Editor Modal State
  const [isEditorOpen, setIsEditorOpen] = React.useState(false);
  const [editingArticle, setEditingArticle] = React.useState<Partial<NewsArticle> | null>(null);
  const [editorTab, setEditorTab] = React.useState<"blocks" | "seo" | "preview">("blocks");
  const [previewDevice, setPreviewDevice] = React.useState<"mobile" | "desktop">("mobile");
  const [isConfirmRefreshAllOpen, setIsConfirmRefreshAllOpen] = React.useState(false);
  const [deleteConfirmTarget, setDeleteConfirmTarget] = React.useState<{ id: string; title: string } | null>(null);
  const [isBulkDeleteConfirmOpen, setIsBulkDeleteConfirmOpen] = React.useState(false);
  const [categoryDeleteTarget, setCategoryDeleteTarget] = React.useState<string | null>(null);

  // AI Modal State
  const [isAiModalOpen, setIsAiModalOpen] = React.useState(false);
  const [aiTopic, setAiTopic] = React.useState("");
  const [aiExamTarget, setAiExamTarget] = React.useState("RPSC RAS & State Exams");
  const [aiLanguage, setAiLanguage] = React.useState<"Hindi" | "English" | "Both">("Both");
  const [aiCategory, setAiCategory] = React.useState("Economics & Survey");
  const [aiGenerating, setAiGenerating] = React.useState(false);

  // Smart Article Import Modal State
  const [isSmartImportOpen, setIsSmartImportOpen] = React.useState(false);

  const [saveProgress, setSaveProgress] = React.useState<SaveProgress | null>(null);

  const handleSaveImportedArticle = async (
    articleToSave: Partial<NewsArticle>,
    onProgress?: (progress: any) => void
  ) => {
    setActionLoading("import-save");
    setSaveProgress({ percent: 0, stage: "metadata", currentBatch: 0, totalBatches: 1 });
    try {
      const saved = await saveArticleAdmin(articleToSave, (p) => {
        setSaveProgress(p);
        if (onProgress) onProgress(p);
      });
      setArticles(prev => {
        const filtered = prev.filter(a => a.id !== saved.id);
        return [saved, ...filtered];
      });
      setNotification({ type: "success", message: `Article "${saved.title}" saved & structured successfully!` });
      setTimeout(() => setNotification(null), 3500);
    } catch (err: any) {
      setNotification({ type: "error", message: err.message || "Failed to save imported article." });
      throw err;
    } finally {
      setActionLoading(null);
      setSaveProgress(null);
    }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [artList, catList] = await Promise.all([
        fetchAllArticlesAdmin(),
        fetchArticleCategories()
      ]);
      setArticles(artList);
      setCategories(catList);
      if (catList.length > 0 && !catList.includes(aiCategory)) {
        setAiCategory(catList[0]);
      }
    } catch (err: any) {
      setNotification({ type: "error", message: err.message || "Failed to load articles." });
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    loadData();
  }, []);

  const handleCreateCategory = async (catName: string) => {
    const name = catName.trim();
    if (!name) return;

    try {
      const updatedCats = await saveArticleCategory(name);
      setCategories(updatedCats);
      setNewCategoryInput("");
      setInlineCategoryInput("");
      setIsCreatingCategoryInline(false);

      if (editingArticle) {
        setEditingArticle(prev => ({ ...prev, category: name }));
      }

      setNotification({ type: "success", message: `Category "${name}" created successfully!` });
      setTimeout(() => setNotification(null), 3000);
    } catch (err: any) {
      setNotification({ type: "error", message: err.message || "Failed to create category." });
    }
  };

  const handleDeleteCategory = (catName: string) => {
    setCategoryDeleteTarget(catName);
  };

  const executeDeleteCategory = async () => {
    if (!categoryDeleteTarget) return;
    const catName = categoryDeleteTarget;
    try {
      const updatedCats = await deleteArticleCategory(catName);
      setCategories(updatedCats);
      setNotification({ type: "success", message: `Category "${catName}" removed.` });
      setTimeout(() => setNotification(null), 3000);
    } catch (err: any) {
      setNotification({ type: "error", message: err.message || "Failed to delete category." });
    } finally {
      setCategoryDeleteTarget(null);
    }
  };

  const handleOpenCreate = () => {
    setEditingArticle({
      title: "",
      slug: "",
      category: categories[0] || "General",
      excerpt: "",
      content: "",
      blocks: [],
      status: "published",
      coverImageUrl: "https://images.unsplash.com/photo-1457369804613-52c61a468e7d?auto=format&fit=crop&w=1200&q=80",
      authorName: "DISHA 20-20 Editorial",
      tags: [],
      faqs: [],
    });
    setIsEditorOpen(true);
  };

  const handleOpenEdit = async (article: NewsArticle) => {
    setActionLoading(`load-${article.id}`);
    try {
      const fullArt = await fetchArticleByIdAdmin(article.id);
      if (!fullArt) throw new Error("Article not found in cloud.");

      setEditingArticle({
        ...fullArt,
        content: fullArt.content || "",
        blocks: Array.isArray(fullArt.blocks) ? fullArt.blocks : [],
      });
      setIsEditorOpen(true);
    } catch (err: any) {
      setNotification({ type: "error", message: "Failed to load full article: " + err.message });
    } finally {
      setActionLoading(null);
    }
  };

  const handleSave = async (articleToSave?: Partial<NewsArticle>, e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const target = articleToSave || editingArticle;
    if (!target?.title) {
      alert("Title is required.");
      return;
    }

    setActionLoading("save");
    setSaveProgress({ percent: 0, stage: "metadata", currentBatch: 0, totalBatches: 1 });
    try {
      const saved = await saveArticleAdmin(target, (p) => {
        setSaveProgress(p);
      });
      setArticles(prev => {
        const filtered = prev.filter(a => a.id !== saved.id);
        return [saved, ...filtered];
      });
      setIsEditorOpen(false);
      setEditingArticle(null);
      setNotification({ type: "success", message: `Article "${saved.title}" saved successfully!` });
      setTimeout(() => setNotification(null), 3000);
    } catch (err: any) {
      setNotification({ type: "error", message: err.message || "Failed to save article." });
    } finally {
      setActionLoading(null);
      setSaveProgress(null);
    }
  };

  const handleDelete = (id: string, title: string) => {
    setDeleteConfirmTarget({ id, title });
  };

  const executeDeleteArticle = async () => {
    if (!deleteConfirmTarget) return;
    const { id, title } = deleteConfirmTarget;

    setActionLoading(`delete-${id}`);
    try {
      await deleteArticleAdmin(id);
      setArticles(prev => prev.filter(a => a.id !== id));
      setSelectedIds(prev => prev.filter(item => item !== id));
      setNotification({ type: "success", message: `Article "${title}" deleted successfully.` });
      setTimeout(() => setNotification(null), 3000);
    } catch (err: any) {
      setNotification({ type: "error", message: err.message || "Failed to delete article." });
    } finally {
      setActionLoading(null);
      setDeleteConfirmTarget(null);
    }
  };

  const handleTogglePin = async (article: NewsArticle) => {
    const updated = { ...article, isPinned: !article.isPinned, pinnedAt: !article.isPinned ? new Date().toISOString() : undefined };
    try {
      await saveArticleAdmin(updated);
      setArticles(prev => prev.map(a => (a.id === article.id ? updated : a)));
      setNotification({ type: "success", message: updated.isPinned ? "Article pinned to top!" : "Article unpinned." });
      setTimeout(() => setNotification(null), 2500);
    } catch (err: any) {
      alert("Failed to update pin status: " + err.message);
    }
  };

  const handleToggleFeature = async (article: NewsArticle) => {
    const updated = { ...article, isFeatured: !article.isFeatured };
    try {
      await saveArticleAdmin(updated);
      setArticles(prev => prev.map(a => (a.id === article.id ? updated : a)));
      setNotification({ type: "success", message: updated.isFeatured ? "Article marked as featured!" : "Article unfeatured." });
      setTimeout(() => setNotification(null), 2500);
    } catch (err: any) {
      alert("Failed to update featured status: " + err.message);
    }
  };

  // Bulk Actions
  const handleToggleSelect = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    if (selectedIds.length === filteredArticles.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredArticles.map(a => a.id));
    }
  };

  const handleBulkStatus = async (status: "published" | "draft") => {
    if (selectedIds.length === 0) return;
    try {
      await bulkSaveArticlesAdmin(selectedIds, { status });
      setArticles(prev => prev.map(a => selectedIds.includes(a.id) ? { ...a, status } : a));
      setSelectedIds([]);
      setNotification({ type: "success", message: `Updated ${selectedIds.length} article(s) to ${status}.` });
      setTimeout(() => setNotification(null), 3000);
    } catch (err: any) {
      alert("Bulk update failed: " + err.message);
    }
  };

  const handleBulkDelete = () => {
    if (selectedIds.length === 0) return;
    setIsBulkDeleteConfirmOpen(true);
  };

  const executeBulkDeleteArticles = async () => {
    if (selectedIds.length === 0) {
      setIsBulkDeleteConfirmOpen(false);
      return;
    }

    setActionLoading("bulk-delete");
    try {
      await bulkDeleteArticlesAdmin(selectedIds);
      setArticles(prev => prev.filter(a => !selectedIds.includes(a.id)));
      const count = selectedIds.length;
      setSelectedIds([]);
      setNotification({ type: "success", message: `Successfully deleted ${count} article(s).` });
      setTimeout(() => setNotification(null), 3000);
    } catch (err: any) {
      setNotification({ type: "error", message: err.message || "Bulk delete failed." });
    } finally {
      setActionLoading(null);
      setIsBulkDeleteConfirmOpen(false);
    }
  };

  const handleInitiateRefreshAll = () => {
    setIsConfirmRefreshAllOpen(true);
  };

  const executeRefreshAllDates = async () => {
    setIsConfirmRefreshAllOpen(false);
    setActionLoading("refresh-all-dates");
    try {
      const result = await bulkRefreshArticlesPublishDate();
      await loadData(); // Reload to see the changes
      setNotification({ type: "success", message: result.message || "All articles updated to today's date!" });
      setTimeout(() => setNotification(null), 4000);
    } catch (err: any) {
      console.error("Refresh all dates error:", err);
      setNotification({ type: "error", message: err.message || "Failed to force refresh dates." });
      setTimeout(() => setNotification(null), 4000);
    } finally {
      setActionLoading(null);
    }
  };

  const handleRefreshSingleArticleDate = async (articleId: string) => {
    setActionLoading(`refresh-date-${articleId}`);
    try {
      const updated = await refreshSingleArticleDate(articleId);
      setArticles(prev => prev.map(a => a.id === articleId ? updated : a));
      setNotification({ type: "success", message: `Updated date for "${updated.title}" to today!` });
      setTimeout(() => setNotification(null), 3500);
    } catch (err: any) {
      console.error("Single article date update error:", err);
      setNotification({ type: "error", message: err.message || "Failed to update article date." });
      setTimeout(() => setNotification(null), 3500);
    } finally {
      setActionLoading(null);
    }
  };

  const handleMigrateSlugs = async () => {
    if (!confirm("This will automatically generate slugs for all articles that are missing them. Continue?")) return;
    setActionLoading("migrate-slugs");
    try {
      const res = await migrateMissingSlugsAdmin();
      await loadData();
      setNotification({ type: "success", message: `Successfully migrated ${res.count} articles with new slugs!` });
      setTimeout(() => setNotification(null), 4000);
    } catch (err: any) {
      setNotification({ type: "error", message: err.message || "Migration failed." });
    } finally {
      setActionLoading(null);
    }
  };

  // AI Write Call
  const handleGenerateAiArticle = async () => {
    if (!aiTopic.trim()) {
      alert("Please enter a topic for AI generation.");
      return;
    }
    setAiGenerating(true);
    try {
      const res = await apiFetch("/api/admin/news/ai-write", {
        method: "POST",
        body: JSON.stringify({
          topic: aiTopic,
          examTarget: aiExamTarget,
          language: aiLanguage,
          category: aiCategory,
        })
      });
      const data = await res.json();
      if (data.success && data.article) {
        setEditingArticle(data.article);
        setIsAiModalOpen(false);
        setIsEditorOpen(true);
        setEditorTab("blocks");
        setNotification({ type: "success", message: "AI article generated! Review and publish below." });
        setTimeout(() => setNotification(null), 4000);
      } else {
        alert(data.error || "Failed to generate AI article.");
      }
    } catch (err: any) {
      alert("Error calling AI service: " + err.message);
    } finally {
      setAiGenerating(false);
    }
  };

  // AI SEO Auto-Optimize
  const handleAiOptimizeSeo = async () => {
    if (!editingArticle?.title) {
      alert("Please enter an article title first.");
      return;
    }
    setAiGenerating(true);
    try {
      const res = await apiFetch("/api/admin/news/ai-assist", {
        method: "POST",
        body: JSON.stringify({
          action: "seo_optimize",
          title: editingArticle.title,
          text: editingArticle.excerpt || editingArticle.content,
        })
      });
      const data = await res.json();
      if (data.success && data.result) {
        setEditingArticle(prev => ({
          ...prev,
          seoTitle: data.result.seoTitle || prev?.seoTitle,
          seoDescription: data.result.seoDescription || prev?.seoDescription,
          focusKeyword: data.result.focusKeyword || prev?.focusKeyword,
          slug: data.result.suggestedSlug || prev?.slug,
          tags: data.result.tags || prev?.tags,
        }));
        setNotification({ type: "success", message: "SEO fields auto-optimized with AI!" });
        setTimeout(() => setNotification(null), 3000);
      } else {
        alert(data.error || "AI SEO optimization failed.");
      }
    } catch (err: any) {
      alert("Error calling AI service: " + err.message);
    } finally {
      setAiGenerating(false);
    }
  };

  // Filtered Articles List
  const filteredArticles = articles.filter(a => {
    const q = searchQuery.toLowerCase().trim();
    const matchSearch = !q || a.title.toLowerCase().includes(q) || (a.hindiTitle || "").toLowerCase().includes(q) || a.slug.includes(q);
    const matchCategory = categoryFilter === "all" || a.category === categoryFilter;
    const matchStatus = statusFilter === "all" || a.status === statusFilter;
    const matchLang = languageFilter === "all" || a.language === languageFilter;
    return matchSearch && matchCategory && matchStatus && matchLang;
  }).sort((a, b) => {
    if (a.isPinned && !b.isPinned) return -1;
    if (!a.isPinned && b.isPinned) return 1;
    if (sortBy === "views") return (b.views || 0) - (a.views || 0);
    if (sortBy === "title") return a.title.localeCompare(b.title);
    return new Date(b.publishedAt || b.createdAt).getTime() - new Date(a.publishedAt || a.createdAt).getTime();
  });

  // SEO Score Calculator
  const calculateSeoScore = (art: Partial<NewsArticle>): number => {
    let score = 0;
    if (art.title && art.title.length >= 20 && art.title.length <= 70) score += 20;
    if (art.seoDescription && art.seoDescription.length >= 120 && art.seoDescription.length <= 160) score += 20;
    if (art.focusKeyword && art.focusKeyword.trim().length > 2) score += 15;
    if (art.coverImageUrl) score += 10;
    if (art.slug && !art.slug.includes(" ")) score += 10;
    if (art.blocks && art.blocks.length >= 3) score += 15;
    if (art.faqs && art.faqs.length >= 2) score += 10;
    return Math.min(100, score);
  };

  return (
    <div className="space-y-5 sm:space-y-6 max-w-7xl mx-auto pb-24 px-3.5 sm:px-4">
      {/* 1. Page Header — Phase 1 Redesign */}
      <div className="bg-white border border-slate-100 rounded-2xl p-6 sm:p-8 relative overflow-hidden shadow-sm">
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              <Newspaper className="w-3.5 h-3.5" />
              <span>Editorial Registry</span>
            </div>
            <div className="space-y-1">
              <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">News & Content Management</h2>
              <p className="text-xs sm:text-sm text-slate-500 font-medium max-w-xl">
                Maintain exam updates, study guides, and educational insights using the block editor and AI-assisted drafting.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button 
              onClick={() => setIsManageCategoriesOpen(true)}
              className="px-4 py-2 bg-white border border-slate-100 text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded-xl text-[11px] font-bold uppercase tracking-tight transition-all"
            >
              Categories
            </button>
            <div className="w-px h-6 bg-slate-100 mx-1 hidden sm:block" />
            <button 
              onClick={() => setIsSmartImportOpen(true)}
              className="px-4 py-2 bg-slate-900 text-white hover:bg-slate-800 rounded-xl text-[11px] font-bold uppercase tracking-tight transition-all flex items-center gap-2"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Import</span>
            </button>
            <button 
              onClick={() => setIsAiModalOpen(true)}
              className="px-4 py-2 bg-slate-900 text-white hover:bg-slate-800 rounded-xl text-[11px] font-bold uppercase tracking-tight transition-all flex items-center gap-2"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>AI Write</span>
            </button>
            <button 
              onClick={handleOpenCreate}
              className="px-4 py-2 bg-slate-900 text-white hover:bg-slate-800 rounded-xl text-[11px] font-bold uppercase tracking-tight transition-all flex items-center gap-2"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Article</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. Quick Actions — Phase 1 Redesign */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Import Banner */}
        <div className="bg-slate-50 border border-slate-100 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-white border border-slate-100 flex items-center justify-center text-slate-900 shrink-0">
              <Upload className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-900">Document Importer</h4>
              <p className="text-[11px] text-slate-500 font-medium leading-relaxed mt-0.5">
                Bulk import .docx or .html with automated table parsing and schema mapping.
              </p>
            </div>
          </div>
          <button
            onClick={() => setIsSmartImportOpen(true)}
            className="px-4 py-2 bg-white border border-slate-200 text-slate-900 rounded-xl text-[11px] font-bold uppercase tracking-tight hover:bg-slate-50 transition-colors shrink-0"
          >
            Launch Importer
          </button>
        </div>

        {/* Freshness Banner */}
        <div className="bg-slate-50 border border-slate-100 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-white border border-slate-100 flex items-center justify-center text-slate-900 shrink-0">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-900">SEO Freshness Sync</h4>
              <p className="text-[11px] text-slate-500 font-medium leading-relaxed mt-0.5">
                Update publication dates to today to maintain high SEO relevance and signals.
              </p>
            </div>
          </div>
          <button
            onClick={handleInitiateRefreshAll}
            disabled={actionLoading === "refresh-all-dates"}
            className="px-4 py-2 bg-white border border-slate-200 text-slate-900 rounded-xl text-[11px] font-bold uppercase tracking-tight hover:bg-slate-50 transition-colors shrink-0 disabled:opacity-50"
          >
            {actionLoading === "refresh-all-dates" ? "Syncing..." : "Sync All Dates"}
          </button>
        </div>
      </div>

      {/* 3. Directory Controls — Phase 2 Redesign */}
      <div className="bg-white border border-slate-100 rounded-2xl overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-slate-50 border border-slate-100 text-slate-900 flex items-center justify-center">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-tight">Article Repository</h3>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Master Content Registry</p>
            </div>
          </div>
          <button 
            onClick={loadData}
            className="p-2 text-slate-400 hover:text-slate-900 transition-colors"
            title="Reload Registry"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search by title, slug or ID..."
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-slate-900 transition-colors placeholder:text-slate-400"
              />
            </div>
            <div className="flex items-center gap-2">
              <select
                value={categoryFilter}
                onChange={e => setCategoryFilter(e.target.value)}
                className="px-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl text-[11px] font-bold uppercase tracking-tight text-slate-900 focus:outline-none focus:border-slate-900 cursor-pointer appearance-none"
              >
                <option value="all">All Categories</option>
                {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
              </select>
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                className="px-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl text-[11px] font-bold uppercase tracking-tight text-slate-900 focus:outline-none focus:border-slate-900 cursor-pointer appearance-none"
              >
                <option value="all">All Status</option>
                <option value="published">Published</option>
                <option value="draft">Drafts</option>
              </select>
            </div>
          </div>

          {/* Bulk Selection (Minimal Inline) */}
          <AnimatePresence>
            {selectedIds.length > 0 && (
              <motion.div 
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="flex items-center justify-between p-3 bg-slate-900 rounded-xl">
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] font-bold text-white uppercase tracking-widest ml-2">
                      {selectedIds.length} Nodes Selected
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleBulkStatus("published")}
                      className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg text-[10px] font-bold uppercase tracking-tight"
                    >
                      Publish
                    </button>
                    <button
                      onClick={handleBulkDelete}
                      className="px-3 py-1.5 bg-rose-500 hover:bg-rose-600 text-white rounded-lg text-[10px] font-bold uppercase tracking-tight"
                    >
                      Delete
                    </button>
                    <button
                      onClick={() => setSelectedIds([])}
                      className="p-1.5 text-white/50 hover:text-white"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* 4. Article Directory Content */}
      <div className="space-y-4">
        {loading ? (
          <div className="py-24 text-center bg-white dark:bg-[#111A2E] rounded-2xl border border-slate-200/80 dark:border-slate-800 space-y-4">
            <RefreshCw className="w-10 h-10 text-[#1E5BF0] animate-spin mx-auto opacity-50" />
            <p className="text-xs font-black uppercase tracking-widest text-slate-400">Synchronizing Repository...</p>
          </div>
        ) : filteredArticles.length === 0 ? (
          <div className="py-24 text-center bg-white dark:bg-[#111A2E] border-2 border-dashed border-slate-100 dark:border-slate-800 rounded-2xl space-y-4">
            <div className="w-20 h-20 bg-slate-50 dark:bg-slate-900 rounded-full flex items-center justify-center mx-auto">
              <Search className="w-10 h-10 text-slate-200 dark:text-slate-700" />
            </div>
            <div className="space-y-1">
              <p className="text-lg font-black text-slate-900 dark:text-white">No articles matching filters</p>
              <p className="text-xs text-slate-500 font-medium">Try resetting filters or use the "Force Refresh All" utility.</p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* MOBILE CARDS VIEW (< sm) — Phase 3 Redesign */}
            <div className="block sm:hidden space-y-3">
              {filteredArticles.map(article => {
                const isSelected = selectedIds.includes(article.id);
                const statusColor = article.status === "published" ? "text-emerald-600" : "text-amber-600";
                const statusDot = article.status === "published" ? "bg-emerald-500" : "bg-amber-500";
                
                return (
                  <div
                    key={article.id}
                    className={`p-4 rounded-xl bg-white border transition-all ${
                      isSelected ? "border-slate-900 shadow-sm" : "border-slate-100"
                    } space-y-4`}
                  >
                    <div className="flex items-start gap-4">
                      <div className="pt-1">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleSelect(article.id)}
                          className="w-5 h-5 rounded border-slate-200 text-slate-900 focus:ring-slate-900"
                        />
                      </div>
                      
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-tight ${statusColor}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${statusDot}`} />
                            {article.status}
                          </span>
                          {article.isPinned && (
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight flex items-center gap-1">
                              <Pin className="w-3 h-3" /> Pinned
                            </span>
                          )}
                        </div>
                        
                        <h3 className="text-sm font-bold text-slate-900 leading-snug line-clamp-2">
                          {article.title}
                        </h3>
                        
                        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-slate-400 font-medium">
                          <span className="text-slate-900">{article.category}</span>
                          <span>/</span>
                          <span className="font-mono text-[10px] uppercase">/{article.slug.slice(0, 15)}...</span>
                        </div>
                      </div>

                      {article.coverImageUrl && (
                        <img
                          src={article.coverImageUrl}
                          alt=""
                          className="w-16 h-16 rounded-lg object-cover shrink-0 border border-slate-50"
                        />
                      )}
                    </div>

                    <div className="flex items-center justify-between pt-4 border-t border-slate-50">
                      <div className="flex items-center gap-3 text-[10px] font-bold text-slate-400 uppercase tracking-tighter tabular-nums">
                        <div className="flex items-center gap-1">
                          <Eye className="w-3 h-3" />
                          <span>{article.views || 0}</span>
                        </div>
                        <span>·</span>
                        <span>{new Date(article.publishedAt || article.createdAt).toLocaleDateString()}</span>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleRefreshSingleArticleDate(article.id)}
                          disabled={actionLoading === `refresh-date-${article.id}`}
                          className="p-2 text-slate-400 hover:text-slate-900 hover:bg-slate-50 rounded-lg transition-colors"
                          title="Sync Date"
                        >
                          <Clock className={`w-4 h-4 ${actionLoading === `refresh-date-${article.id}` ? "animate-spin" : ""}`} />
                        </button>
                        <button
                          onClick={() => handleOpenEdit(article)}
                          className="p-2 text-slate-400 hover:text-slate-900 hover:bg-slate-50 rounded-lg transition-colors"
                          title="Edit"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(article.id, article.title)}
                          className="p-2 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* DESKTOP TABLE VIEW (>= sm) — Phase 3 Redesign */}
            <div className="hidden sm:block bg-white border border-slate-100 rounded-2xl overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/50 border-b border-slate-100">
                      <th className="px-6 py-4 w-10">
                        <input
                          type="checkbox"
                          checked={selectedIds.length === filteredArticles.length && filteredArticles.length > 0}
                          onChange={handleSelectAll}
                          className="w-4 h-4 rounded border-slate-200 text-slate-900 focus:ring-slate-900"
                        />
                      </th>
                      <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Article Identity</th>
                      <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Status</th>
                      <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Metrics</th>
                      <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {filteredArticles.map(article => {
                      const isSelected = selectedIds.includes(article.id);
                      const statusColor = article.status === "published" ? "text-emerald-600" : "text-amber-600";
                      const statusDot = article.status === "published" ? "bg-emerald-500" : "bg-amber-500";

                      return (
                        <tr key={article.id} className={`group hover:bg-slate-50/50 transition-colors ${isSelected ? 'bg-slate-50/30' : ''}`}>
                          <td className="px-6 py-4">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => handleToggleSelect(article.id)}
                              className="w-4 h-4 rounded border-slate-200 text-slate-900 focus:ring-slate-900"
                            />
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-4">
                              <div className="w-12 h-12 rounded-xl bg-slate-50 border border-slate-100 overflow-hidden shrink-0">
                                {article.coverImageUrl ? (
                                  <img src={article.coverImageUrl} alt="" className="w-full h-full object-cover" />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center text-slate-300">
                                    <Newspaper className="w-6 h-6" />
                                  </div>
                                )}
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-2 mb-0.5">
                                  <span className="text-xs font-bold text-slate-900 truncate max-w-[300px]">{article.title}</span>
                                  {article.isPinned && <Pin className="w-3 h-3 text-slate-400" />}
                                </div>
                                <div className="flex items-center gap-2 text-[10px] font-medium text-slate-400 uppercase tracking-tighter">
                                  <span className="text-slate-900">{article.category}</span>
                                  <span>/</span>
                                  <span className="font-mono">/{article.slug.slice(0, 20)}</span>
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex justify-center">
                              <span className={`flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-tight ${statusColor}`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${statusDot}`} />
                                {article.status}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex flex-col items-end">
                              <span className="text-xs font-bold text-slate-900 tabular-nums">{article.views || 0} views</span>
                              <span className="text-[10px] font-medium text-slate-400 tabular-nums">
                                {new Date(article.publishedAt || article.createdAt).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={() => handleRefreshSingleArticleDate(article.id)}
                                disabled={actionLoading === `refresh-date-${article.id}`}
                                className="p-2 text-slate-400 hover:text-slate-900 hover:bg-white rounded-lg border border-transparent hover:border-slate-100 transition-all"
                                title="Sync Date"
                              >
                                <Clock className={`w-3.5 h-3.5 ${actionLoading === `refresh-date-${article.id}` ? "animate-spin" : ""}`} />
                              </button>
                              <button
                                onClick={() => handleTogglePin(article)}
                                className={`p-2 rounded-lg transition-all ${article.isPinned ? 'text-slate-900 bg-slate-100' : 'text-slate-400 hover:text-slate-900 hover:bg-slate-50'}`}
                                title="Pin"
                              >
                                <Pin className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleOpenEdit(article)}
                                className="p-2 text-slate-400 hover:text-slate-900 hover:bg-white rounded-lg border border-transparent hover:border-slate-100 transition-all"
                                title="Edit"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDelete(article.id, article.title)}
                                className="p-2 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                                title="Delete"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 4. MANAGE CATEGORIES MODAL */}
      {isManageCategoriesOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in">
          <div className="bg-white dark:bg-[#111A2E] w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 space-y-6 my-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400">
                  <FolderPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                    Article Categories
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Create, view, or remove news categories.
                  </p>
                </div>
              </div>
              <button onClick={() => setIsManageCategoriesOpen(false)} className="p-2 rounded-xl text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Create Category Input */}
            <form onSubmit={(e) => { e.preventDefault(); handleCreateCategory(newCategoryInput); }} className="space-y-2">
              <label className="text-[10px] font-bold uppercase text-slate-500">Create New Category</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newCategoryInput}
                  onChange={(e) => setNewCategoryInput(e.target.value)}
                  placeholder="e.g. Result & Answer Key"
                  className="flex-1 px-3.5 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-900 dark:text-white"
                />
                <button
                  type="submit"
                  disabled={!newCategoryInput.trim()}
                  className="px-4 py-2 bg-[#1E5BF0] hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer disabled:opacity-50 shrink-0"
                >
                  Create
                </button>
              </div>
            </form>

            {/* Categories List */}
            <div className="space-y-1.5 pt-2">
              <label className="text-[10px] font-bold uppercase text-slate-500 block">Existing Categories ({categories.length})</label>
              <div className="max-h-60 overflow-y-auto space-y-1.5 pr-1">
                {categories.map((cat) => {
                  const isDefault = DEFAULT_ARTICLE_CATEGORIES.includes(cat);
                  return (
                    <div
                      key={cat}
                      className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800 text-xs font-bold text-slate-800 dark:text-slate-200"
                    >
                      <div className="flex items-center gap-2">
                        <Tag className="w-3.5 h-3.5 text-blue-500" />
                        <span>{cat}</span>
                        {isDefault && (
                          <span className="text-[9px] px-2 py-0.2 bg-slate-200 dark:bg-slate-800 text-slate-500 rounded-full font-medium">Default</span>
                        )}
                      </div>

                      {!isDefault && (
                        <button
                          onClick={() => handleDeleteCategory(cat)}
                          className="p-1 text-slate-400 hover:text-rose-500 transition-colors cursor-pointer"
                          title="Delete Category"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 5. AI WRITE ASSIST MODAL */}
      {isAiModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in">
          <div className="bg-white dark:bg-[#111A2E] w-full max-w-lg rounded-[32px] shadow-2xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 space-y-6 my-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                    AI Article Writer
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Generates full structured blocks, FAQs, and SEO tags.
                  </p>
                </div>
              </div>
              <button onClick={() => setIsAiModalOpen(false)} className="p-2 rounded-xl text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3.5">
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase text-slate-500">Article Topic / Keyword *</label>
                <input
                  type="text"
                  value={aiTopic}
                  onChange={e => setAiTopic(e.target.value)}
                  placeholder="e.g. Rajasthan Economic Survey 2023-24 Sectoral Highlights"
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-medium text-slate-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase text-slate-500">Exam Target</label>
                  <input
                    type="text"
                    value={aiExamTarget}
                    onChange={e => setAiExamTarget(e.target.value)}
                    placeholder="RPSC RAS Pre & Mains"
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-medium text-slate-900 dark:text-white"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase text-slate-500">Language</label>
                  <select
                    value={aiLanguage}
                    onChange={e => setAiLanguage(e.target.value as any)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-medium text-slate-900 dark:text-white"
                  >
                    <option value="Both">Both (Bilingual English + Hindi)</option>
                    <option value="Hindi">Hindi Only</option>
                    <option value="English">English Only</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase text-slate-500">Category</label>
                <select
                  value={aiCategory}
                  onChange={e => setAiCategory(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-medium text-slate-900 dark:text-white"
                >
                  {categories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <button
                onClick={handleGenerateAiArticle}
                disabled={aiGenerating || !aiTopic.trim()}
                className="w-full py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-2xl text-xs font-black flex items-center justify-center gap-2 shadow-md active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                {aiGenerating ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Writing Article & Generating Blocks...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 text-amber-300" />
                    <span>Generate Complete Article Now</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}



      {/* 7. REDESIGNED MOBILE & DESKTOP FRIENDLY SEO BLOCK EDITOR MODAL */}
      {isEditorOpen && editingArticle && (
        <ArticleBlockEditorModal
          isOpen={isEditorOpen}
          editingArticle={editingArticle}
          categories={categories}
          onSave={handleSave}
          onClose={() => {
            setIsEditorOpen(false);
            setEditingArticle(null);
          }}
          actionLoading={actionLoading}
          saveProgress={saveProgress}
          handleCreateCategory={handleCreateCategory}
          handleAiOptimizeSeo={handleAiOptimizeSeo}
          aiGenerating={aiGenerating}
        />
      )}

      {/* 8. SMART SEO ARTICLE IMPORT & STRUCTURING MODAL */}
      {isSmartImportOpen && (
        <SmartArticleImportModal
          isOpen={isSmartImportOpen}
          onClose={() => setIsSmartImportOpen(false)}
          existingArticles={articles}
          categories={categories}
          onSaveArticle={handleSaveImportedArticle}
        />
      )}

      {/* Floating Notification Toast */}
      <AnimatePresence>
        {notification && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[100] w-[calc(100vw-32px)] max-w-md"
          >
            <div className={`p-4 rounded-2xl shadow-2xl border flex items-start gap-3 ${
              notification.type === 'success' 
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-950/90 dark:border-emerald-800 dark:text-emerald-200' 
                : 'bg-rose-50 border-rose-200 text-rose-800 dark:bg-rose-950/90 dark:border-rose-800 dark:text-rose-200'
            }`}>
              {notification.type === 'success' ? (
                <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-500 mt-0.5" />
              ) : (
                <AlertCircle className="w-5 h-5 shrink-0 text-rose-500 mt-0.5" />
              )}
              <div className="flex-1">
                <p className="text-sm font-black leading-tight">{notification.message}</p>
              </div>
              <button onClick={() => setNotification(null)} className="p-1 hover:bg-black/5 dark:hover:bg-white/5 rounded-lg transition-colors">
                <X className="w-4 h-4 opacity-50" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Confirm Refresh All Dates Modal Dialog */}
      <ConfirmDialog
        isOpen={isConfirmRefreshAllOpen}
        title="Refresh All Article Dates"
        message="Are you sure you want to update publication dates for all published articles to today? This will refresh SEO freshness signals and show today's date across DISHA 20-20."
        confirmText="Refresh All Dates"
        cancelText="Cancel"
        isDeleting={false}
        onConfirm={executeRefreshAllDates}
        onClose={() => setIsConfirmRefreshAllOpen(false)}
      />

      {/* Confirm Delete Single Article Dialog */}
      <ConfirmDialog
        isOpen={Boolean(deleteConfirmTarget)}
        title="Delete Article"
        message={`Are you sure you want to permanently delete "${deleteConfirmTarget?.title || 'this article'}"? This action cannot be undone.`}
        confirmText="Delete Article"
        cancelText="Cancel"
        isDeleting={Boolean(actionLoading && deleteConfirmTarget && actionLoading === `delete-${deleteConfirmTarget.id}`)}
        onConfirm={executeDeleteArticle}
        onClose={() => setDeleteConfirmTarget(null)}
      />

      {/* Confirm Bulk Delete Articles Dialog */}
      <ConfirmDialog
        isOpen={isBulkDeleteConfirmOpen}
        title="Bulk Delete Articles"
        message={`Are you sure you want to delete ${selectedIds.length} selected article(s)? This action will remove them permanently.`}
        confirmText={`Delete ${selectedIds.length} Articles`}
        cancelText="Cancel"
        isDeleting={actionLoading === "bulk-delete"}
        onConfirm={executeBulkDeleteArticles}
        onClose={() => setIsBulkDeleteConfirmOpen(false)}
      />

      {/* Confirm Delete Category Dialog */}
      <ConfirmDialog
        isOpen={Boolean(categoryDeleteTarget)}
        title="Delete Category"
        message={`Are you sure you want to delete category "${categoryDeleteTarget}"?`}
        confirmText="Delete Category"
        cancelText="Cancel"
        isDeleting={false}
        onConfirm={executeDeleteCategory}
        onClose={() => setCategoryDeleteTarget(null)}
      />
    </div>
  );
};
