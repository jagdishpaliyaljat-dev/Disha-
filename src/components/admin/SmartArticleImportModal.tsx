import * as React from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  FileText,
  Upload,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  X,
  Smartphone,
  Monitor,
  Copy,
  Check,
  RefreshCw,
  Eye,
  Link,
  Layers,
  HelpCircle,
  Table as TableIcon,
  Search,
  BookOpen,
  ArrowRight,
  ShieldCheck,
  FileCode,
  Sliders,
  Trash2,
  Plus,
  Send,
  AlertCircle,
  GripVertical,
  ArrowUp,
  ArrowDown,
  CheckSquare,
  ListFilter
} from "lucide-react";
import { NewsArticle, ArticleBlock } from "../../types";
import { SaveProgress } from "../../utils/articleStorage";
import { ArticleSectionReorderDnd } from "./ArticleSectionReorderDnd";
import { ArticleCalloutBox } from "../news/ArticleCallouts";
import { ArticleTable } from "../news/ArticleTable";
import { AutoLinkRulesManagerModal } from "./AutoLinkRulesManagerModal";
import {
  parseSmartText,
  parseSmartHtml,
  parseUploadedArticleFile,
  autoInjectLinksToArticleBlocks,
  calculateSeoAudit,
  generateArticleJsonLd,
  ParsedImportResult,
  SEOAuditCheck,
  InternalLinkSuggestion,
  DuplicateDetectionResult
} from "../../utils/smartArticleImporter";

interface SmartArticleImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  existingArticles: NewsArticle[];
  categories: string[];
  onSaveArticle: (article: Partial<NewsArticle>, onProgress?: (p: SaveProgress) => void) => Promise<void>;
}

const SAMPLE_DEMO_ARTICLE = `# RPSC RAS 2025: Complete Exam Pattern, Syllabus & Preparation Strategy
The Rajasthan Public Service Commission (RPSC) RAS examination is the premier administrative service in the state. This comprehensive guide details the syllabus, examination pattern, cut-off trends, and preparation strategies.

**Key Points:**
* The RAS Preliminary exam consists of 150 multiple choice questions (MCQ) for 200 marks.
* 1/3 (0.33) negative marking applies to every incorrect answer.
* 25-30% of questions come directly from the Rajasthan Economic Survey and Current Affairs.
* Regular mock tests and previous year solved papers (PYQ) are key to exam success.

## 1. Exam Pattern & Marking Scheme
The RAS Preliminary exam is screening in nature, and marks scored do not count towards the final merit list.

| Exam Stage | Questions | Total Marks | Duration | Negative Marking |
| Pre Exam (Prelims) | 150 | 200 Marks | 3 Hours | 1/3 (0.33) |
| Mains Exam (Written) | 4 Descriptive Papers | 800 Marks | 3 Hours each | None |
| Personality Test (Interview) | Viva Voce | 100 Marks | Board Panel | None |

## 2. High-Yield Topics for Rajasthan Economy
The Rajasthan Economy section is one of the highest scoring and decisive segments of the RAS Preliminary examination.

### 2.1 Key Statistical Targets & Indicators
Pay special attention to the latest Economic Survey indicators such as Gross State Domestic Product (GSDP) and agricultural growth rates.

#### 2.1.1 Sectoral Contribution Breakdown
Mastering the exact sectoral contribution ratio of agriculture, industry, and service sectors yields direct marks in the exam.

> Important: Maintain dedicated notes for state budget allocations, notification dates, and nodal departments for all flagship schemes.

* Rajasthan Agriculture & Allied Sectors: Cropping patterns, micro-irrigation, and agri-infra funds
* Industrial Landscape: RIICO industrial areas, SEZ policies, and MSME initiatives
* Renewable Energy: National achievements of Rajasthan in solar and wind power
* Social Welfare Schemes: Anuprati, Annapurna, and Palanhar schemes

## Conclusion & Action Strategy
Consistent practice, thorough revision of official Economic Survey data, and time-bound mock tests will ensure you clear the prelims cutoff with a high margin.

## Frequently Asked Questions (FAQ)

Q1: Is the RAS examination bilingual?
A1: Yes, the question paper is bilingual (English and Hindi). Candidates can attempt questions in either language.

Q2: What is considered a safe score in the Preliminary exam?
A2: A score between 85 to 95 marks for the General category is considered safe, depending on paper difficulty.

Q3: What study materials are available on DISHA 20-20?
A3: DISHA 20-20 offers chapter-wise MCQs, previous year solved question papers, and topic-wise live test series.

Attempt DISHA 20-20 Full Mock Test and evaluate your state rank today!`;

export const SmartArticleImportModal: React.FC<SmartArticleImportModalProps> = ({
  isOpen,
  onClose,
  existingArticles,
  categories,
  onSaveArticle
}) => {
  // Modal Stages: 1. input -> 2. structuring -> 3. review
  const [currentStage, setCurrentStage] = React.useState<"input" | "structuring" | "review">("input");

  // Input State
  const [activeInputTab, setActiveInputTab] = React.useState<"paste" | "upload" | "html">("paste");
  const [pastedText, setPastedText] = React.useState("");
  const [htmlInput, setHtmlInput] = React.useState("");
  const [uploadedFile, setUploadedFile] = React.useState<File | null>(null);
  const [isProcessing, setIsProcessing] = React.useState(false);
  const [saveLoading, setSaveLoading] = React.useState(false);
  const [saveProgress, setSaveProgress] = React.useState<SaveProgress | null>(null);

  // Parsed Result State
  const [importResult, setImportResult] = React.useState<ParsedImportResult | null>(null);
  const [editingArticleData, setEditingArticleData] = React.useState<Partial<NewsArticle> | null>(null);

  // Structuring Stage State
  const [structuringFilter, setStructuringFilter] = React.useState<"all" | "intro" | "sections" | "tables" | "faq" | "cta">("all");
  const [draggedBlockIndex, setDraggedBlockIndex] = React.useState<number | null>(null);
  const [dragOverBlockIndex, setDragOverBlockIndex] = React.useState<number | null>(null);

  // Review Stage State
  const [previewDevice, setPreviewDevice] = React.useState<"desktop" | "mobile">("desktop");
  const [reviewTab, setReviewTab] = React.useState<"blocks" | "seo" | "audit" | "schema" | "links">("blocks");
  const [copiedSchema, setCopiedSchema] = React.useState(false);
  const [isRulesManagerOpen, setIsRulesManagerOpen] = React.useState(false);
  const [customRules, setCustomRules] = React.useState<any[]>([]);

  const fileInputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (isOpen) {
      const loadRules = async () => {
        try {
          const { fetchCustomAutoLinkRules } = await import("../../utils/smartArticleImporter");
          const rules = await fetchCustomAutoLinkRules();
          setCustomRules(rules);
        } catch (err) {
          console.error("Failed to load custom rules:", err);
        }
      };
      loadRules();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Process text or html input -> moves to Content Structuring stage
  const handleProcessInput = async () => {
    setIsProcessing(true);
    try {
      let result: ParsedImportResult;
      if (activeInputTab === "paste") {
        if (!pastedText.trim()) {
          alert("Please paste article content first.");
          setIsProcessing(false);
          return;
        }
        result = parseSmartText(pastedText, existingArticles, customRules);
      } else if (activeInputTab === "html") {
        if (!htmlInput.trim()) {
          alert("Please enter HTML content first.");
          setIsProcessing(false);
          return;
        }
        result = parseSmartHtml(htmlInput, existingArticles, customRules);
      } else {
        if (!uploadedFile) {
          alert("Please select a file to import (.docx, .txt, .html).");
          setIsProcessing(false);
          return;
        }
        result = await parseUploadedArticleFile(uploadedFile, existingArticles, customRules);
      }

      setImportResult(result);
      setEditingArticleData(result.article);
      setCurrentStage("structuring");
    } catch (err: any) {
      alert("Failed to process article: " + (err.message || "Unknown error"));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploadedFile(file);
    }
  };

  const handleLoadSample = () => {
    setActiveInputTab("paste");
    setPastedText(SAMPLE_DEMO_ARTICLE);
  };

  const handleClear = () => {
    setPastedText("");
    setHtmlInput("");
    setUploadedFile(null);
    setImportResult(null);
    setEditingArticleData(null);
    setCurrentStage("input");
  };

  const handleUpdateArticleField = (field: keyof NewsArticle, value: any) => {
    if (!editingArticleData) return;
    const updated = { ...editingArticleData, [field]: value };
    setEditingArticleData(updated);

    if (["title", "slug", "focusKeyword", "seoDescription", "coverImageUrl", "excerpt"].includes(field)) {
      const newAudit = calculateSeoAudit(updated);
      const newSchema = generateArticleJsonLd(updated);
      setImportResult(prev => prev ? { ...prev, seoAudit: newAudit, jsonLdSchema: newSchema, article: updated } : null);
    }
  };

  // Block modifiers
  const handleUpdateBlockText = (index: number, newText: string) => {
    if (!editingArticleData?.blocks) return;
    const blocks = [...editingArticleData.blocks];
    blocks[index] = { ...blocks[index], text: newText };
    setEditingArticleData(prev => ({ ...prev, blocks }));
  };

  const handleDeleteBlock = (index: number) => {
    if (!editingArticleData?.blocks) return;
    const blocks = editingArticleData.blocks.filter((_, i) => i !== index);
    setEditingArticleData(prev => ({ ...prev, blocks }));
  };

  // Reordering: Move Up / Move Down
  const handleMoveBlock = (index: number, direction: "up" | "down") => {
    if (!editingArticleData?.blocks) return;
    const blocks = [...editingArticleData.blocks];
    const targetIdx = direction === "up" ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= blocks.length) return;
    const temp = blocks[index];
    blocks[index] = blocks[targetIdx];
    blocks[targetIdx] = temp;
    setEditingArticleData(prev => ({ ...prev, blocks }));
  };

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedBlockIndex(index);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragOverBlockIndex !== index) {
      setDragOverBlockIndex(index);
    }
  };

  const handleDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    if (draggedBlockIndex === null || draggedBlockIndex === targetIndex) {
      setDraggedBlockIndex(null);
      setDragOverBlockIndex(null);
      return;
    }
    const blocks = [...(editingArticleData?.blocks || [])];
    const itemToMove = blocks.splice(draggedBlockIndex, 1)[0];
    blocks.splice(targetIndex, 0, itemToMove);
    setEditingArticleData(prev => ({ ...prev, blocks }));
    setDraggedBlockIndex(null);
    setDragOverBlockIndex(null);
  };

  // Quick Preset Ordering: Standard SEO Flow
  const handleApplyStandardSeoFlow = () => {
    if (!editingArticleData?.blocks) return;
    const blocks = [...editingArticleData.blocks];
    const typePriority: Record<string, number> = {
      intro: 1,
      key_points: 2,
      callout: 3,
      heading: 4,
      paragraph: 5,
      list: 6,
      table: 7,
      conclusion: 8,
      faq: 9,
      cta: 10
    };
    blocks.sort((a, b) => (typePriority[a.type] || 50) - (typePriority[b.type] || 50));
    setEditingArticleData(prev => ({ ...prev, blocks }));
  };

  const handleCopySchema = () => {
    if (!importResult?.jsonLdSchema) return;
    navigator.clipboard.writeText(JSON.stringify(importResult.jsonLdSchema, null, 2));
    setCopiedSchema(true);
    setTimeout(() => setCopiedSchema(false), 2500);
  };

  const handleInsertInternalLink = (suggestion: InternalLinkSuggestion) => {
    if (!editingArticleData?.blocks) return;
    const newBlock: ArticleBlock = {
      id: `blk_link_${Date.now()}`,
      type: "callout",
      calloutType: "info",
      text: `Related Read: ${suggestion.title}`
    };
    setEditingArticleData(prev => ({
      ...prev,
      blocks: [...(prev?.blocks || []), newBlock]
    }));
    alert(`Internal link box added for "${suggestion.title}"!`);
  };

  const handleFinalSave = async (status: "published" | "draft", overrideExistingId?: string) => {
    if (!editingArticleData?.title) {
      alert("Article title is required.");
      return;
    }

    setSaveLoading(true);
    setSaveProgress({ stage: "metadata", currentBatch: 0, totalBatches: 1, percent: 0 });
    try {
      const payload: Partial<NewsArticle> = {
        ...editingArticleData,
        id: overrideExistingId || editingArticleData.id,
        status,
        updatedAt: new Date().toISOString(),
        publishedAt: status === "published" ? (editingArticleData.publishedAt || new Date().toISOString()) : undefined
      };

      await onSaveArticle(payload, (p) => setSaveProgress(p));
      onClose();
    } catch (err: any) {
      console.error("Article save failed:", err);
      let errMsg = err.message || "Unknown error";
      if (err.code === 'permission-denied') {
        errMsg = "Permission Denied: You do not have administrator privileges to save articles to the cloud. Please ensure you are logged in with an authorized admin account.";
      } else if (err.code === 'deadline-exceeded') {
        errMsg = "Timeout: The operation took too long. Please check your internet connection and try again.";
      } else if (err.message?.includes("Document size")) {
        errMsg = "Error: Article content exceeds Firestore size limit. Try removing some blocks or breaking the article into two parts.";
      }
      alert("Failed to save imported article: " + errMsg);
    } finally {
      setSaveLoading(false);
      setSaveProgress(null);
    }
  };

  // Group counting for structuring bar
  const blockCounts = {
    intro: (editingArticleData?.blocks || []).filter(b => b.type === "intro").length,
    sections: (editingArticleData?.blocks || []).filter(b => ["heading", "paragraph", "list", "key_points", "callout"].includes(b.type)).length,
    tables: (editingArticleData?.blocks || []).filter(b => b.type === "table").length,
    faq: (editingArticleData?.blocks || []).filter(b => b.type === "faq").length,
    cta: (editingArticleData?.blocks || []).filter(b => b.type === "cta").length,
    conclusion: (editingArticleData?.blocks || []).filter(b => b.type === "conclusion").length,
  };

  // Filter blocks in structuring stage
  const visibleBlocksWithIndices = (editingArticleData?.blocks || []).map((block, originalIndex) => ({
    block,
    originalIndex
  })).filter(({ block }) => {
    if (structuringFilter === "intro") return block.type === "intro";
    if (structuringFilter === "sections") return ["heading", "paragraph", "list", "key_points", "callout", "conclusion"].includes(block.type);
    if (structuringFilter === "tables") return block.type === "table";
    if (structuringFilter === "faq") return block.type === "faq";
    if (structuringFilter === "cta") return block.type === "cta";
    return true;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, y: 10, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 10, scale: 0.98 }}
        className="w-full h-full sm:h-[92vh] sm:max-w-6xl bg-white dark:bg-[#111A2E] rounded-none sm:rounded-3xl border-0 sm:border border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col overflow-hidden my-auto"
      >
        {/* Top Modal Header with Stage Progress Stepper */}
        <div className="px-4 sm:px-8 py-3.5 sm:py-4 border-b border-slate-200/80 dark:border-slate-800 flex flex-col gap-3 bg-slate-50/90 dark:bg-slate-900/60 shrink-0">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20 shrink-0">
                <Sparkles className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm sm:text-lg font-black text-slate-900 dark:text-white truncate">
                    Smart Article Import
                  </h3>
                  <span className="hidden xs:inline-block px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 text-[10px] font-black uppercase tracking-wider shrink-0">
                    SEO Ready
                  </span>
                </div>
                <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 font-medium truncate hidden sm:block">
                  Auto-extracts H1-H4, Tables, FAQs, Key Points, and Structures Content
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              type="button"
              className="min-w-[40px] min-h-[40px] p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors flex items-center justify-center shrink-0 cursor-pointer"
              aria-label="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Workflow Stage Stepper Buttons */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar bg-slate-200/60 dark:bg-slate-800/80 p-1 rounded-2xl w-full sm:w-auto self-start">
            <button
              type="button"
              onClick={() => setCurrentStage("input")}
              className={`min-h-[38px] px-3.5 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-2 shrink-0 cursor-pointer ${
                currentStage === "input"
                  ? "bg-white dark:bg-slate-900 text-blue-600 dark:text-white shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <span className="w-5 h-5 rounded-full bg-blue-500/20 text-blue-600 flex items-center justify-center text-[10px] font-bold">1</span>
              <span>1. Ingest Text</span>
            </button>

            <button
              type="button"
              disabled={!importResult}
              onClick={() => setCurrentStage("structuring")}
              className={`min-h-[38px] px-3.5 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-2 shrink-0 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer ${
                currentStage === "structuring"
                  ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-white shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <span className="w-5 h-5 rounded-full bg-indigo-500/20 text-indigo-600 flex items-center justify-center text-[10px] font-bold">2</span>
              <span>2. Structure Blocks</span>
            </button>

            <button
              type="button"
              disabled={!importResult}
              onClick={() => setCurrentStage("review")}
              className={`min-h-[38px] px-3.5 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-2 shrink-0 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer ${
                currentStage === "review"
                  ? "bg-white dark:bg-slate-900 text-emerald-600 dark:text-white shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-600 flex items-center justify-center text-[10px] font-bold">3</span>
              <span>3. SEO & Publish</span>
            </button>
          </div>
        </div>

        {/* ───────────── STAGE 1: INPUT INGESTION ───────────── */}
        {currentStage === "input" && (
          <div className="flex-1 p-4 sm:p-8 overflow-y-auto space-y-5 bg-white dark:bg-[#111A2E]">
            <div className="p-4 rounded-2xl bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 border border-blue-200/80 dark:border-blue-900/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 shadow-xs">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 mt-0.5 shadow-sm">
                  <BookOpen className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs sm:text-sm font-black text-slate-900 dark:text-white">
                    Need a sample article to test auto-import?
                  </h4>
                  <p className="text-[11px] sm:text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                    Click to load a complete sample RPSC RAS exam article with H1-H4 headings, Tables, Key Points, Conclusion, and FAQs.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleLoadSample}
                className="min-h-[44px] px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black shadow-md shadow-blue-500/20 transition-all active:scale-95 shrink-0 flex items-center justify-center gap-2 cursor-pointer"
              >
                <Sparkles className="w-4 h-4" />
                <span>Load Sample Article</span>
              </button>
            </div>

            {/* Input Method Selector Tabs */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar border-b border-slate-200 dark:border-slate-800 pb-3">
              <button
                type="button"
                onClick={() => setActiveInputTab("paste")}
                className={`min-h-[42px] flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all shrink-0 cursor-pointer ${
                  activeInputTab === "paste"
                    ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
                }`}
              >
                <FileText className="w-4 h-4" />
                <span>Paste Text / Markdown</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveInputTab("upload")}
                className={`min-h-[42px] flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all shrink-0 cursor-pointer ${
                  activeInputTab === "upload"
                    ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
                }`}
              >
                <Upload className="w-4 h-4" />
                <span>Upload File (.docx, .txt, .html)</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveInputTab("html")}
                className={`min-h-[42px] flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all shrink-0 cursor-pointer ${
                  activeInputTab === "html"
                    ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
                }`}
              >
                <FileCode className="w-4 h-4" />
                <span>Raw HTML Code</span>
              </button>
            </div>

            {activeInputTab === "paste" && (
              <div className="space-y-2.5">
                <div className="flex items-center justify-between text-xs text-slate-500 font-medium px-1">
                  <span>Paste complete unformatted text, Word document paste, or Markdown</span>
                  <span>{pastedText.length} chars</span>
                </div>
                <textarea
                  value={pastedText}
                  onChange={e => setPastedText(e.target.value)}
                  placeholder={`# Your Article Title Here\n\nIntroductory overview paragraph...\n\nKey Points:\n* Highlight 1\n* Highlight 2\n\n## 1. Exam Pattern & Marking Scheme\n| Stage | Marks | Duration |\n| Prelims | 200 | 3 Hours |\n\n## Conclusion\nSummary and strategy advice...\n\n## Frequently Asked Questions\nQ: What is the age limit?\nA: 21 to 40 years as of official notification.`}
                  rows={12}
                  className="w-full p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-xs sm:text-sm font-mono text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 resize-y"
                />
              </div>
            )}

            {activeInputTab === "upload" && (
              <div className="space-y-4">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  accept=".docx,.txt,.html,.htm"
                  className="hidden"
                />
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-blue-500 dark:hover:border-blue-400 rounded-3xl p-6 sm:p-12 text-center cursor-pointer transition-all bg-slate-50/50 dark:bg-slate-900/20 group"
                >
                  <div className="w-14 h-14 rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform">
                    <Upload className="w-7 h-7" />
                  </div>
                  <h4 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">
                    {uploadedFile ? uploadedFile.name : "Click to select or drag & drop document file"}
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto">
                    Supported formats: Microsoft Word (.docx), Plain Text (.txt), and Web Pages (.html)
                  </p>
                  {uploadedFile && (
                    <div className="mt-4 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-black">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Ready to parse ({(uploadedFile.size / 1024).toFixed(1)} KB)</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeInputTab === "html" && (
              <div className="space-y-2.5">
                <div className="flex items-center justify-between text-xs text-slate-500 font-medium px-1">
                  <span>Paste clean or rich HTML code exported from CMS or Google Docs</span>
                  <span>{htmlInput.length} chars</span>
                </div>
                <textarea
                  value={htmlInput}
                  onChange={e => setHtmlInput(e.target.value)}
                  placeholder={`<h1>RPSC RAS 2025 Complete Guide</h1>\n<p>Overview text...</p>\n<table>\n  <tr><th>Subject</th><th>Marks</th></tr>\n  <tr><td>General Knowledge</td><td>200</td></tr>\n</table>`}
                  rows={12}
                  className="w-full p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-xs sm:text-sm font-mono text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 resize-y"
                />
              </div>
            )}

            <div className="flex flex-col-reverse sm:flex-row sm:items-center justify-between gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={handleClear}
                className="min-h-[44px] px-4 py-2 text-xs font-black text-slate-500 hover:text-rose-600 transition-colors cursor-pointer text-center"
              >
                Clear Input
              </button>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                <button
                  type="button"
                  onClick={onClose}
                  className="min-h-[44px] px-5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-black text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer text-center"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleProcessInput}
                  disabled={isProcessing}
                  className="min-h-[44px] px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl text-xs font-black shadow-lg shadow-blue-500/25 transition-all active:scale-95 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isProcessing ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Parsing & Structuring...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>Process & Structure Content →</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ───────────── STAGE 2: CONTENT STRUCTURING & DRAG-AND-DROP REORDERING ───────────── */}
        {currentStage === "structuring" && editingArticleData && (
          <div className="flex-1 flex flex-col overflow-hidden bg-white dark:bg-[#111A2E]">
            {/* Structuring Top Bar with Logical Block Counters */}
            <div className="px-4 sm:px-8 py-3.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                  <Layers className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs sm:text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                    <span>Content Structuring Stage</span>
                    <span className="px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-[10px] font-bold">
                      {editingArticleData.blocks?.length || 0} Total Blocks
                    </span>
                  </h4>
                  <p className="text-[11px] text-slate-500 font-medium hidden xs:block">
                    Reorder sections and check headers before final SEO optimization
                  </p>
                </div>
              </div>

              {/* Action Buttons for Structuring */}
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={handleApplyStandardSeoFlow}
                  className="min-h-[38px] flex-1 sm:flex-initial px-3 py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 text-xs font-black flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                  title="Auto-order blocks: Intro → Key Points → Main Sections → Tables → Conclusion → FAQs → CTA"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span className="truncate">Auto SEO Flow</span>
                </button>

                <button
                  type="button"
                  onClick={() => setCurrentStage("review")}
                  className="min-h-[38px] flex-1 sm:flex-initial px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black shadow-sm transition-all active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
                >
                  <span>Review SEO</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Filter Pills for Logical Sections */}
            <div className="px-4 sm:px-8 py-2.5 bg-slate-100/60 dark:bg-slate-900/60 border-b border-slate-200/80 dark:border-slate-800 flex items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1 mr-1 shrink-0">
                <ListFilter className="w-3.5 h-3.5" />
                <span className="hidden xs:inline">Filter:</span>
              </span>

              <button
                type="button"
                onClick={() => setStructuringFilter("all")}
                className={`min-h-[36px] px-3 py-1 rounded-xl text-xs font-black transition-all shrink-0 cursor-pointer ${
                  structuringFilter === "all" ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs" : "text-slate-600 dark:text-slate-400 hover:bg-slate-200/60"
                }`}
              >
                All ({editingArticleData.blocks?.length || 0})
              </button>

              <button
                type="button"
                onClick={() => setStructuringFilter("intro")}
                className={`min-h-[36px] px-3 py-1 rounded-xl text-xs font-black transition-all shrink-0 cursor-pointer ${
                  structuringFilter === "intro" ? "bg-blue-600 text-white shadow-xs" : "text-slate-600 dark:text-slate-400 hover:bg-slate-200/60"
                }`}
              >
                Intro ({blockCounts.intro})
              </button>

              <button
                type="button"
                onClick={() => setStructuringFilter("sections")}
                className={`min-h-[36px] px-3 py-1 rounded-xl text-xs font-black transition-all shrink-0 cursor-pointer ${
                  structuringFilter === "sections" ? "bg-indigo-600 text-white shadow-xs" : "text-slate-600 dark:text-slate-400 hover:bg-slate-200/60"
                }`}
              >
                Sections ({blockCounts.sections})
              </button>

              <button
                type="button"
                onClick={() => setStructuringFilter("tables")}
                className={`min-h-[36px] px-3 py-1 rounded-xl text-xs font-black transition-all shrink-0 cursor-pointer ${
                  structuringFilter === "tables" ? "bg-cyan-600 text-white shadow-xs" : "text-slate-600 dark:text-slate-400 hover:bg-slate-200/60"
                }`}
              >
                Tables ({blockCounts.tables})
              </button>

              <button
                type="button"
                onClick={() => setStructuringFilter("faq")}
                className={`min-h-[36px] px-3 py-1 rounded-xl text-xs font-black transition-all shrink-0 cursor-pointer ${
                  structuringFilter === "faq" ? "bg-amber-600 text-white shadow-xs" : "text-slate-600 dark:text-slate-400 hover:bg-slate-200/60"
                }`}
              >
                FAQ ({blockCounts.faq})
              </button>

              <button
                type="button"
                onClick={() => setStructuringFilter("cta")}
                className={`min-h-[36px] px-3 py-1 rounded-xl text-xs font-black transition-all shrink-0 cursor-pointer ${
                  structuringFilter === "cta" ? "bg-emerald-600 text-white shadow-xs" : "text-slate-600 dark:text-slate-400 hover:bg-slate-200/60"
                }`}
              >
                CTA ({blockCounts.cta})
              </button>
            </div>

            {/* Draggable & Reorderable Article Sections UI Component */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-8 space-y-4 bg-slate-50/40 dark:bg-[#0B1120]">
              <div className="max-w-4xl mx-auto space-y-3">
                <ArticleSectionReorderDnd
                  blocks={visibleBlocksWithIndices.map(item => item.block)}
                  onReorderBlocks={(reordered) => setEditingArticleData(prev => ({ ...prev, blocks: reordered }))}
                  onDeleteBlock={handleDeleteBlock}
                  onUpdateBlockText={handleUpdateBlockText}
                  onUpdateHeadingLevel={(idx, level) => {
                    if (!editingArticleData?.blocks) return;
                    const blocks = [...editingArticleData.blocks];
                    blocks[idx] = { ...blocks[idx], level };
                    setEditingArticleData(prev => ({ ...prev, blocks }));
                  }}
                />
              </div>
            </div>

            {/* Structuring Bottom Action Bar */}
            <div className="px-4 sm:px-8 py-3.5 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111A2E] flex flex-col-reverse sm:flex-row sm:items-center justify-between gap-2.5 shrink-0">
              <button
                type="button"
                onClick={() => setCurrentStage("input")}
                className="min-h-[44px] px-4 py-2 text-xs font-black text-slate-500 hover:text-slate-800 dark:hover:text-white transition-colors cursor-pointer text-center"
              >
                ← Back to Ingest
              </button>

              <div className="flex items-center gap-2.5 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => setCurrentStage("review")}
                  className="min-h-[44px] w-full sm:w-auto px-6 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl text-xs font-black shadow-lg shadow-emerald-600/20 transition-all active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>Accept Structure & Continue to SEO Review</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ───────────── STAGE 3: SEO REVIEW, AUDIT & PUBLISH ───────────── */}
        {currentStage === "review" && importResult && editingArticleData && (
          <div className="flex-1 flex flex-col overflow-hidden bg-white dark:bg-[#111A2E]">
            {importResult.duplicateWarning?.isDuplicate && (
              <div className="px-4 sm:px-6 py-3 bg-amber-500/10 border-b border-amber-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-amber-700 dark:text-amber-400 text-xs font-medium shrink-0">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>
                    <strong>Potential Duplicate:</strong> Matches "{importResult.duplicateWarning.matchedArticleTitle}" ({importResult.duplicateWarning.similarityScore}% similarity).
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleFinalSave("published", importResult.duplicateWarning?.matchedArticleId)}
                    className="min-h-[36px] px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-[10px] font-black uppercase tracking-wider transition-colors cursor-pointer"
                  >
                    Update Existing
                  </button>
                </div>
              </div>
            )}

            {/* Review Navigation Bar */}
            <div className="px-4 sm:px-8 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 flex flex-wrap items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className={`px-3 py-1 rounded-full text-xs font-black flex items-center gap-1.5 ${
                  importResult.seoAudit.score >= 80
                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                    : importResult.seoAudit.score >= 50
                    ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                    : "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20"
                }`}>
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>SEO: {importResult.seoAudit.score}/100</span>
                </div>

                <div className="hidden lg:flex items-center gap-2 text-xs text-slate-500 font-semibold">
                  <span>{importResult.detectedMeta.wordCount} words</span>
                  <span>•</span>
                  <span>{importResult.detectedMeta.readingTimeMinutes} min read</span>
                  <span>•</span>
                  <span className="font-mono text-blue-600 dark:text-blue-400">
                    {importResult.detectedMeta.headingsCount.h1}H1/{importResult.detectedMeta.headingsCount.h2}H2/{importResult.detectedMeta.headingsCount.h3}H3
                  </span>
                </div>
              </div>
              
              {saveProgress && (
                <div className="flex-1 max-w-xs mx-4 space-y-1">
                  <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-wider text-blue-600 dark:text-blue-400">
                    <span>{saveProgress.stage === 'metadata' ? 'Saving Metadata...' : `Saving Blocks (Batch ${saveProgress.currentBatch}/${saveProgress.totalBatches})`}</span>
                    <span>{saveProgress.percent}%</span>
                  </div>
                  <div className="h-1.5 w-full bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden border border-blue-500/10">
                    <motion.div 
                      className="h-full bg-blue-600 shadow-[0_0_8px_rgba(37,99,235,0.4)]"
                      initial={{ width: 0 }}
                      animate={{ width: `${saveProgress.percent}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Review Tabs & Device Toggles */}
              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar w-full sm:w-auto">
                <div className="flex items-center gap-1 bg-slate-200/70 dark:bg-slate-800 p-1 rounded-xl shrink-0">
                  <button
                    type="button"
                    onClick={() => setReviewTab("blocks")}
                    className={`min-h-[36px] px-3 py-1 rounded-lg text-xs font-black transition-all cursor-pointer ${
                      reviewTab === "blocks"
                        ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs"
                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                    }`}
                  >
                    Preview ({editingArticleData?.blocks?.length || 0})
                  </button>
                  <button
                    type="button"
                    onClick={() => setReviewTab("seo")}
                    className={`min-h-[36px] px-3 py-1 rounded-lg text-xs font-black transition-all cursor-pointer ${
                      reviewTab === "seo"
                        ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs"
                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                    }`}
                  >
                    SEO Meta
                  </button>
                  <button
                    type="button"
                    onClick={() => setReviewTab("audit")}
                    className={`min-h-[36px] px-3 py-1 rounded-lg text-xs font-black transition-all cursor-pointer ${
                      reviewTab === "audit"
                        ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs"
                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                    }`}
                  >
                    Audit
                  </button>
                  <button
                    type="button"
                    onClick={() => setReviewTab("schema")}
                    className={`min-h-[36px] px-3 py-1 rounded-lg text-xs font-black transition-all cursor-pointer ${
                      reviewTab === "schema"
                        ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs"
                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                    }`}
                  >
                    JSON-LD
                  </button>
                  <button
                    type="button"
                    onClick={() => setReviewTab("links")}
                    className={`min-h-[36px] px-3 py-1 rounded-lg text-xs font-black transition-all cursor-pointer ${
                      reviewTab === "links"
                        ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs"
                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                    }`}
                  >
                    Links ({importResult.internalLinkingSuggestions.length})
                  </button>
                </div>

                {/* Mobile / Desktop Preview Toggle */}
                <div className="hidden xs:flex items-center gap-1 bg-slate-200/70 dark:bg-slate-800 p-1 rounded-xl shrink-0">
                  <button
                    type="button"
                    onClick={() => setPreviewDevice("desktop")}
                    className={`min-h-[36px] min-w-[36px] p-1.5 rounded-lg flex items-center justify-center cursor-pointer ${previewDevice === "desktop" ? "bg-white dark:bg-slate-900 text-blue-600 shadow-xs" : "text-slate-400"}`}
                    title="Desktop View"
                  >
                    <Monitor className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewDevice("mobile")}
                    className={`min-h-[36px] min-w-[36px] p-1.5 rounded-lg flex items-center justify-center cursor-pointer ${previewDevice === "mobile" ? "bg-white dark:bg-slate-900 text-blue-600 shadow-xs" : "text-slate-400"}`}
                    title="Mobile View"
                  >
                    <Smartphone className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Tab Content Panels */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-8 bg-slate-50/50 dark:bg-[#0B1120]">
              <div className={`mx-auto ${previewDevice === "mobile" ? "max-w-md bg-white dark:bg-[#111A2E] rounded-[32px] border-4 border-slate-300 dark:border-slate-700 shadow-2xl p-4 sm:p-5" : "max-w-5xl"}`}>
                
                {/* 1. BLOCKS PREVIEW TAB */}
                {reviewTab === "blocks" && (
                  <div className="space-y-5">
                    <div className="space-y-2 border-b border-slate-200 dark:border-slate-800 pb-4">
                      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 text-blue-600 text-[10px] font-black uppercase tracking-wider">
                        <span>{editingArticleData?.category || "General"}</span>
                        <span>•</span>
                        <span>{importResult.detectedMeta.searchIntent}</span>
                      </div>
                      <input
                        type="text"
                        value={editingArticleData?.title || ""}
                        onChange={e => handleUpdateArticleField("title", e.target.value)}
                        placeholder="Article Title..."
                        className="w-full text-lg sm:text-2xl font-black text-slate-900 dark:text-white bg-transparent border-b border-slate-200 dark:border-slate-800 focus:border-blue-500 focus:outline-none transition-all py-1.5"
                      />
                      {editingArticleData?.hindiTitle && (
                        <input
                          type="text"
                          value={editingArticleData.hindiTitle}
                          onChange={e => handleUpdateArticleField("hindiTitle", e.target.value)}
                          placeholder="Hindi Title Translation..."
                          className="w-full text-xs sm:text-sm font-bold text-slate-600 dark:text-slate-300 bg-transparent border-b border-slate-200 dark:border-slate-800 focus:border-blue-500 focus:outline-none py-1"
                        />
                      )}
                    </div>

                    <div className="space-y-3.5">
                      {editingArticleData?.blocks?.map((block, idx) => (
                        <div
                          key={block.id || idx}
                          className="group relative p-3.5 sm:p-4 rounded-2xl bg-white dark:bg-[#111A2E] border border-slate-200 dark:border-slate-800 hover:border-blue-500/40 shadow-xs transition-all"
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-[10px] font-black uppercase tracking-wider">
                              Block {idx + 1}: {block.type} {block.level ? `(H${block.level})` : ""}
                            </span>
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => handleMoveBlock(idx, "up")}
                                disabled={idx === 0}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-800 dark:hover:text-white disabled:opacity-30 cursor-pointer"
                                title="Move up"
                              >
                                <ArrowUp className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleMoveBlock(idx, "down")}
                                disabled={idx === (editingArticleData.blocks?.length || 0) - 1}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-800 dark:hover:text-white disabled:opacity-30 cursor-pointer"
                                title="Move down"
                              >
                                <ArrowDown className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteBlock(idx)}
                                className="text-slate-400 hover:text-rose-500 p-1.5 rounded-lg transition-colors cursor-pointer"
                                title="Delete block"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          {block.type === "heading" && (
                            <div className="space-y-1.5">
                              <div className="flex items-center gap-2">
                                <select
                                  value={block.level || 2}
                                  onChange={e => {
                                    if (!editingArticleData?.blocks) return;
                                    const blocks = [...editingArticleData.blocks];
                                    blocks[idx] = { ...blocks[idx], level: Number(e.target.value) as 1 | 2 | 3 | 4 };
                                    setEditingArticleData(prev => ({ ...prev, blocks }));
                                  }}
                                  className="px-2 py-1 rounded-md bg-slate-100 dark:bg-slate-800 text-[10px] font-black uppercase text-blue-600 dark:text-blue-400 border border-slate-200 dark:border-slate-700"
                                >
                                  <option value={1}>H1 Main Heading</option>
                                  <option value={2}>H2 Section Heading</option>
                                  <option value={3}>H3 Sub-Heading</option>
                                  <option value={4}>H4 Minor Heading</option>
                                </select>
                              </div>
                              <input
                                type="text"
                                value={block.text || ""}
                                onChange={e => handleUpdateBlockText(idx, e.target.value)}
                                className={`w-full font-black text-slate-900 dark:text-white bg-transparent border-none focus:outline-none ${
                                  block.level === 1 ? "text-lg sm:text-2xl" : block.level === 3 ? "text-base sm:text-lg" : block.level === 4 ? "text-xs sm:text-base text-slate-700 dark:text-slate-300" : "text-base sm:text-xl"
                                }`}
                              />
                            </div>
                          )}

                          {block.type === "intro" && (
                            <div className="p-3.5 rounded-xl bg-blue-50/50 dark:bg-blue-950/20 border-l-4 border-l-blue-600 border-y border-r border-blue-200/60 dark:border-blue-900/40 space-y-2">
                              <div className="flex items-center gap-2 text-xs font-black text-blue-700 dark:text-blue-400">
                                <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" />
                                <span>Article Introduction / Hook</span>
                              </div>
                              <textarea
                                value={block.text || ""}
                                onChange={e => handleUpdateBlockText(idx, e.target.value)}
                                rows={3}
                                className="w-full text-xs sm:text-sm text-slate-800 dark:text-slate-200 font-medium leading-relaxed bg-transparent border-none focus:outline-none resize-y"
                              />
                            </div>
                          )}

                          {block.type === "conclusion" && (
                            <div className="p-3.5 rounded-xl bg-gradient-to-r from-purple-50/60 to-indigo-50/60 dark:from-purple-950/20 dark:to-indigo-950/20 border border-purple-200/60 dark:border-purple-900/40 space-y-2">
                              <div className="flex items-center gap-2 text-xs font-black text-purple-700 dark:text-purple-400">
                                <CheckCircle2 className="w-4 h-4 text-purple-600" />
                                <span>Article Conclusion / Final Takeaway</span>
                              </div>
                              <textarea
                                value={block.text || ""}
                                onChange={e => handleUpdateBlockText(idx, e.target.value)}
                                rows={3}
                                className="w-full text-xs sm:text-sm text-slate-800 dark:text-slate-200 font-medium leading-relaxed bg-transparent border-none focus:outline-none resize-y"
                              />
                            </div>
                          )}

                          {block.type === "paragraph" && (
                            <textarea
                              value={block.text || ""}
                              onChange={e => handleUpdateBlockText(idx, e.target.value)}
                              rows={3}
                              className="w-full text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed bg-transparent border-none focus:outline-none resize-y"
                            />
                          )}

                          {block.type === "key_points" && (
                            <div className="p-3.5 rounded-xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-900/40 space-y-2">
                              <div className="flex items-center gap-2 text-xs font-black text-amber-700 dark:text-amber-400">
                                <Sparkles className="w-4 h-4" />
                                <span>Key Points & Highlights</span>
                              </div>
                              <ul className="space-y-1.5 pl-4 list-disc text-xs sm:text-sm text-slate-800 dark:text-slate-200">
                                {block.listItems?.map((item, i) => (
                                  <li key={i}>{item}</li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {block.type === "callout" && (
                            <ArticleCalloutBox
                              variant={block.calloutType || "info"}
                              text={block.text}
                              className="my-2"
                            />
                          )}

                          {block.type === "table" && (
                            <div className="space-y-2">
                              <div className="flex items-center justify-between text-xs font-bold text-slate-500">
                                <div className="flex items-center gap-1.5">
                                  <TableIcon className="w-4 h-4 text-blue-600" />
                                  <span>Responsive Data Table ({block.tableRows?.length || 0} rows)</span>
                                </div>
                                <span className="text-[10px] text-slate-400">Mobile scroll enabled</span>
                              </div>
                              <ArticleTable
                                headers={block.tableHeaders}
                                rows={block.tableRows || []}
                                alignments={block.tableAlignments}
                                caption={block.tableCaption}
                              />
                            </div>
                          )}

                          {block.type === "image" && (
                            <div className="space-y-2.5 p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                              <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
                                <span>SEO Image Block</span>
                                {block.imageUrl && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (!editingArticleData?.blocks) return;
                                      const blocks = [...editingArticleData.blocks];
                                      blocks[idx] = { ...blocks[idx], imageUrl: "" };
                                      setEditingArticleData(prev => ({ ...prev, blocks }));
                                    }}
                                    className="min-h-[32px] px-2 text-[10px] font-bold text-rose-600 dark:text-rose-400 hover:underline cursor-pointer flex items-center"
                                  >
                                    Remove Image
                                  </button>
                                )}
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                <div className="flex items-center gap-1.5">
                                  <input
                                    type="text"
                                    value={block.imageUrl || ""}
                                    onChange={e => {
                                      if (!editingArticleData?.blocks) return;
                                      const blocks = [...editingArticleData.blocks];
                                      blocks[idx] = { ...blocks[idx], imageUrl: e.target.value };
                                      setEditingArticleData(prev => ({ ...prev, blocks }));
                                    }}
                                    placeholder="Image URL or upload file"
                                    className="flex-1 p-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono"
                                  />
                                  <label className="min-h-[40px] px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold cursor-pointer flex items-center gap-1 shrink-0">
                                    <Upload className="w-3.5 h-3.5" />
                                    <span>Upload</span>
                                    <input
                                      type="file"
                                      accept="image/*"
                                      className="hidden"
                                      onChange={e => {
                                        const file = e.target.files?.[0];
                                        if (file) {
                                          const reader = new FileReader();
                                          reader.onload = ev => {
                                            if (ev.target?.result && editingArticleData?.blocks) {
                                              const blocks = [...editingArticleData.blocks];
                                              blocks[idx] = { ...blocks[idx], imageUrl: ev.target.result as string };
                                              setEditingArticleData(prev => ({ ...prev, blocks }));
                                            }
                                          };
                                          reader.readAsDataURL(file);
                                        }
                                      }}
                                    />
                                  </label>
                                </div>
                                <input
                                  type="text"
                                  value={block.imageAlt || ""}
                                  onChange={e => {
                                    if (!editingArticleData?.blocks) return;
                                    const blocks = [...editingArticleData.blocks];
                                    blocks[idx] = { ...blocks[idx], imageAlt: e.target.value };
                                    setEditingArticleData(prev => ({ ...prev, blocks }));
                                  }}
                                  placeholder="SEO Alt text..."
                                  className="p-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium"
                                />
                              </div>
                              {block.imageUrl && (
                                <div className="relative w-full h-36 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800">
                                  <img
                                    src={block.imageUrl}
                                    alt={block.imageAlt || "Preview"}
                                    className="w-full h-full object-cover"
                                    onError={e => {
                                      (e.target as any).style.display = "none";
                                    }}
                                  />
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (!editingArticleData?.blocks) return;
                                      const blocks = [...editingArticleData.blocks];
                                      blocks[idx] = { ...blocks[idx], imageUrl: "" };
                                      setEditingArticleData(prev => ({ ...prev, blocks }));
                                    }}
                                    className="absolute top-2 right-2 min-h-[32px] px-2.5 py-1 bg-rose-600/90 text-white text-[10px] font-bold rounded-lg shadow-xs cursor-pointer flex items-center"
                                  >
                                    Remove Image
                                  </button>
                                </div>
                              )}
                            </div>
                          )}

                          {block.type === "list" && (
                            <ul className={`pl-4 text-xs sm:text-sm text-slate-700 dark:text-slate-300 space-y-1 ${block.listType === "numbered" ? "list-decimal" : "list-disc"}`}>
                              {block.listItems?.map((li, i) => (
                                <li key={i}>{li}</li>
                              ))}
                            </ul>
                          )}

                          {block.type === "faq" && (
                            <div className="space-y-3">
                              <div className="flex items-center gap-2 text-xs font-black text-slate-900 dark:text-white">
                                <HelpCircle className="w-4 h-4 text-indigo-600" />
                                <span>FAQ Accordion Section ({block.faqs?.length || 0} Questions)</span>
                              </div>
                              <div className="space-y-2">
                                {block.faqs?.map((f, fIdx) => (
                                  <div key={fIdx} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 space-y-1">
                                    <p className="text-xs font-black text-slate-900 dark:text-white">Q: {f.question}</p>
                                    <p className="text-xs text-slate-600 dark:text-slate-400">A: {f.answer}</p>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {block.type === "cta" && (
                            <div className="p-4 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white flex items-center justify-between gap-3">
                              <div>
                                <h5 className="text-xs sm:text-sm font-black">{block.ctaText || "Start Practicing"}</h5>
                                <p className="text-[10px] text-blue-100 mt-0.5">DISHA 20-20 Online Mock Test Series</p>
                              </div>
                              <span className="px-3 py-1.5 rounded-lg bg-white/20 hover:bg-white/30 text-xs font-black uppercase tracking-wider transition-colors shrink-0">
                                Practice Now
                              </span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 2. SEO META TAB */}
                {reviewTab === "seo" && (
                  <div className="space-y-5 bg-white dark:bg-[#111A2E] p-4 sm:p-6 rounded-2xl border border-slate-200 dark:border-slate-800">
                    <h4 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                      <Sliders className="w-4 h-4 text-blue-600" />
                      <span>SEO & Metadata Configuration</span>
                    </h4>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-700 dark:text-slate-300">URL Slug</label>
                        <input
                          type="text"
                          value={editingArticleData?.slug || ""}
                          onChange={e => handleUpdateArticleField("slug", e.target.value)}
                          className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-mono"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Focus Keyword</label>
                        <input
                          type="text"
                          value={editingArticleData?.focusKeyword || ""}
                          onChange={e => handleUpdateArticleField("focusKeyword", e.target.value)}
                          className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-bold"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Category</label>
                        <select
                          value={editingArticleData?.category || categories[0]}
                          onChange={e => handleUpdateArticleField("category", e.target.value)}
                          className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-bold"
                        >
                          {categories.map(c => (
                            <option key={c} value={c}>{c}</option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Language</label>
                        <select
                          value={editingArticleData?.language || "Both"}
                          onChange={e => handleUpdateArticleField("language", e.target.value)}
                          className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-bold"
                        >
                          <option value="Both">Both (Hindi & English)</option>
                          <option value="Hindi">Hindi Only</option>
                          <option value="English">English Only</option>
                        </select>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-slate-700 dark:text-slate-300">SEO Meta Title</label>
                        <span className={`text-[10px] font-bold ${
                          (editingArticleData?.seoTitle || "").length >= 30 && (editingArticleData?.seoTitle || "").length <= 70
                            ? "text-emerald-500"
                            : "text-amber-500"
                        }`}>
                          {(editingArticleData?.seoTitle || "").length} / 70 chars
                        </span>
                      </div>
                      <input
                        type="text"
                        value={editingArticleData?.seoTitle || ""}
                        onChange={e => handleUpdateArticleField("seoTitle", e.target.value)}
                        className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-medium"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Meta Description</label>
                        <span className={`text-[10px] font-bold ${
                          (editingArticleData?.seoDescription || "").length >= 110 && (editingArticleData?.seoDescription || "").length <= 160
                            ? "text-emerald-500"
                            : "text-amber-500"
                        }`}>
                          {(editingArticleData?.seoDescription || "").length} / 160 chars
                        </span>
                      </div>
                      <textarea
                        value={editingArticleData?.seoDescription || ""}
                        onChange={e => handleUpdateArticleField("seoDescription", e.target.value)}
                        rows={3}
                        className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-medium resize-y"
                      />
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Cover Image / Featured Image</label>
                        {editingArticleData?.coverImageUrl && (
                          <button
                            type="button"
                            onClick={() => handleUpdateArticleField("coverImageUrl", "")}
                            className="min-h-[32px] px-2 text-[10px] font-bold text-rose-600 dark:text-rose-400 hover:underline cursor-pointer flex items-center"
                          >
                            Remove Cover Image
                          </button>
                        )}
                      </div>
                      <div className="flex flex-col xs:flex-row items-stretch xs:items-center gap-2">
                        <input
                          type="text"
                          value={editingArticleData?.coverImageUrl || ""}
                          onChange={e => handleUpdateArticleField("coverImageUrl", e.target.value)}
                          placeholder="https://images.unsplash.com/... or upload below"
                          className="flex-1 p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-mono"
                        />
                        <label className="min-h-[44px] px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold cursor-pointer transition-colors flex items-center justify-center gap-1.5 shrink-0">
                          <Upload className="w-3.5 h-3.5" />
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
                                    handleUpdateArticleField("coverImageUrl", ev.target.result as string);
                                  }
                                };
                                reader.readAsDataURL(file);
                              }
                            }}
                          />
                        </label>
                      </div>
                      {editingArticleData?.coverImageUrl && (
                        <div className="relative w-full h-40 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900">
                          <img
                            src={editingArticleData.coverImageUrl}
                            alt="Cover preview"
                            className="w-full h-full object-cover"
                            onError={e => {
                              (e.target as any).style.display = "none";
                            }}
                          />
                          <button
                            type="button"
                            onClick={() => handleUpdateArticleField("coverImageUrl", "")}
                            className="absolute top-2 right-2 min-h-[36px] px-3 py-1 bg-rose-600/90 hover:bg-rose-700 text-white text-[10px] font-bold rounded-lg shadow-xs cursor-pointer flex items-center"
                          >
                            Remove Cover Image
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* 3. AUDIT CHECKLIST TAB */}
                {reviewTab === "audit" && (
                  <div className="space-y-4 bg-white dark:bg-[#111A2E] p-4 sm:p-6 rounded-2xl border border-slate-200 dark:border-slate-800">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4 text-emerald-600" />
                        <span>SEO Quality Audit Checklist</span>
                      </h4>
                      <span className="text-xs font-black text-emerald-600">
                        {importResult.seoAudit.checks.filter(c => c.passed).length} of {importResult.seoAudit.checks.length} Passed
                      </span>
                    </div>

                    <div className="space-y-2.5">
                      {importResult.seoAudit.checks.map(check => (
                        <div
                          key={check.id}
                          className={`p-3.5 rounded-xl border flex items-start gap-3 transition-colors ${
                            check.passed
                              ? "bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/40"
                              : check.severity === "error"
                              ? "bg-rose-50/40 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/40"
                              : "bg-amber-50/40 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/40"
                          }`}
                        >
                          {check.passed ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                          ) : (
                            <AlertTriangle className={`w-4 h-4 shrink-0 mt-0.5 ${check.severity === "error" ? "text-rose-600" : "text-amber-600"}`} />
                          )}
                          <div className="space-y-0.5">
                            <p className="text-xs font-black text-slate-900 dark:text-white">{check.label}</p>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400">{check.tip}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 4. JSON-LD SCHEMA TAB */}
                {reviewTab === "schema" && (
                  <div className="space-y-4 bg-white dark:bg-[#111A2E] p-4 sm:p-6 rounded-2xl border border-slate-200 dark:border-slate-800">
                    <div className="flex flex-col xs:flex-row items-start xs:items-center justify-between gap-3">
                      <div className="space-y-0.5">
                        <h4 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                          <FileCode className="w-4 h-4 text-blue-600" />
                          <span>Generated Schema.org JSON-LD</span>
                        </h4>
                        <p className="text-xs text-slate-500">Google NewsArticle, BreadcrumbList, and FAQPage schemas</p>
                      </div>
                      <button
                        type="button"
                        onClick={handleCopySchema}
                        className="min-h-[40px] px-3.5 py-1.5 rounded-xl bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 hover:bg-blue-100 text-xs font-black flex items-center justify-center gap-1.5 transition-colors cursor-pointer w-full xs:w-auto"
                      >
                        {copiedSchema ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copiedSchema ? "Copied!" : "Copy JSON-LD"}</span>
                      </button>
                    </div>

                    <pre className="p-4 rounded-xl bg-slate-900 text-emerald-400 text-xs font-mono overflow-x-auto max-h-96">
                      {JSON.stringify(importResult.jsonLdSchema, null, 2)}
                    </pre>
                  </div>
                )}

                {/* 5. INTERNAL & EXTERNAL LINKS TAB */}
                {reviewTab === "links" && (
                  <div className="space-y-5 bg-white dark:bg-[#111A2E] p-4 sm:p-6 rounded-2xl border border-slate-200 dark:border-slate-800">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-200 dark:border-slate-800">
                      <div className="space-y-0.5">
                        <h4 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                          <Link className="w-4 h-4 text-indigo-600" />
                          <span>Auto-Injected Internal & External Links</span>
                        </h4>
                        <p className="text-xs text-slate-500">
                          Embeds internal links (/live_tests, /pyq_vault, /topics) and reference links (RPSC, RSMSSB, DIPR) into article blocks.
                        </p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto">
                        <button
                          type="button"
                          onClick={() => setIsRulesManagerOpen(true)}
                          className="min-h-[40px] px-3.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 hover:bg-slate-100 text-xs font-black flex items-center justify-center gap-1.5 transition-all cursor-pointer flex-1 sm:flex-initial"
                        >
                          <Sliders className="w-3.5 h-3.5" />
                          <span>Manage Custom Rules</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            if (!editingArticleData?.blocks) return;
                            const res = autoInjectLinksToArticleBlocks(editingArticleData.blocks, existingArticles);
                            setEditingArticleData(prev => ({ ...prev, blocks: res.blocks }));
                            if (importResult) {
                              setImportResult({
                                ...importResult,
                                detectedMeta: {
                                  ...importResult.detectedMeta,
                                  internalLinksDetected: res.internalLinksCount,
                                  externalLinksDetected: res.externalLinksCount,
                                  injectedLinksSummary: res.injectedLinksSummary
                                }
                              });
                            }
                            alert(`Auto-linked ${res.internalLinksCount} internal and ${res.externalLinksCount} external links across article blocks!`);
                          }}
                          className="min-h-[40px] px-3.5 py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 text-xs font-black flex items-center justify-center gap-1.5 transition-all shrink-0 cursor-pointer flex-1 sm:flex-initial"
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>Re-apply Auto Links</span>
                        </button>
                      </div>
                    </div>

                    {/* Auto Links Badges Summary */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      <div className="p-4 rounded-xl bg-blue-50/60 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/40">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-black text-blue-700 dark:text-blue-300">Internal Links Auto-Added</span>
                          <span className="px-2.5 py-0.5 rounded-full bg-blue-600 text-white text-xs font-black">
                            {importResult.detectedMeta.internalLinksDetected || 0}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                          Links to Live Tests, PYQ Vault, Syllabus Topics, News, and Pro Membership.
                        </p>
                      </div>

                      <div className="p-4 rounded-xl bg-purple-50/60 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-900/40">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-black text-purple-700 dark:text-purple-300">External Links Auto-Added</span>
                          <span className="px-2.5 py-0.5 rounded-full bg-purple-600 text-white text-xs font-black">
                            {importResult.detectedMeta.externalLinksDetected || 0}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                          Authoritative reference links to RPSC, RSMSSB, DIPR Rajasthan & Govt Portals.
                        </p>
                      </div>
                    </div>

                    {/* Injected Links List */}
                    {importResult.detectedMeta.injectedLinksSummary && importResult.detectedMeta.injectedLinksSummary.length > 0 && (
                      <div className="space-y-2 pt-2">
                        <h5 className="text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                          Injected Links Summary ({importResult.detectedMeta.injectedLinksSummary.length}):
                        </h5>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {importResult.detectedMeta.injectedLinksSummary.map((item, idx) => (
                            <div key={idx} className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 flex items-center justify-between gap-2 text-xs">
                              <div className="truncate">
                                <span className="font-bold text-slate-900 dark:text-white">{item.keyword}</span>
                                <span className="text-[10px] text-slate-400 block truncate">{item.url}</span>
                              </div>
                              <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase shrink-0 ${
                                item.type === "internal" ? "bg-blue-500/10 text-blue-600" : "bg-purple-500/10 text-purple-600"
                              }`}>
                                {item.type}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Published Articles Internal Linking Suggestions */}
                    <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-3">
                      <h5 className="text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                        Related Published Articles ({importResult.internalLinkingSuggestions.length}):
                      </h5>
                      {importResult.internalLinkingSuggestions.length === 0 ? (
                        <div className="p-4 text-center text-xs text-slate-400 border border-dashed rounded-xl">
                          No other published articles directly matched.
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {importResult.internalLinkingSuggestions.map((item, i) => (
                            <div
                              key={i}
                              className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-col xs:flex-row xs:items-center justify-between gap-3 bg-slate-50/50 dark:bg-slate-900/30"
                            >
                              <div className="space-y-0.5 min-w-0">
                                <span className="text-[10px] font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                                  Matched: "{item.matchedKeyword}"
                                </span>
                                <h5 className="text-xs font-black text-slate-900 dark:text-white truncate">{item.title}</h5>
                                <p className="text-[10px] text-slate-500 font-mono truncate">/news/{item.slug}</p>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleInsertInternalLink(item)}
                                className="min-h-[36px] px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-black shrink-0 transition-colors cursor-pointer text-center"
                              >
                                + Insert Link Box
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

              </div>
            </div>

            {/* Stage 3 Bottom Action Bar */}
            <div className="px-4 sm:px-8 py-3.5 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111A2E] flex flex-col-reverse sm:flex-row sm:items-center justify-between gap-2.5 shrink-0">
              <button
                type="button"
                onClick={() => setCurrentStage("structuring")}
                className="min-h-[44px] px-4 py-2 text-xs font-black text-slate-500 hover:text-slate-800 dark:hover:text-white transition-colors cursor-pointer text-center"
              >
                ← Back to Structuring
              </button>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => handleFinalSave("draft")}
                  disabled={saveLoading}
                  className="min-h-[44px] px-5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-black text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-50 cursor-pointer text-center"
                >
                  Save as Draft
                </button>

                <button
                  type="button"
                  onClick={() => handleFinalSave("published")}
                  disabled={saveLoading}
                  className="min-h-[44px] px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black shadow-lg shadow-emerald-600/20 transition-all active:scale-95 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {saveLoading ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                  <span>Publish Article</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </motion.div>

      <AutoLinkRulesManagerModal
        isOpen={isRulesManagerOpen}
        onClose={() => setIsRulesManagerOpen(false)}
      />
    </div>
  );
};
