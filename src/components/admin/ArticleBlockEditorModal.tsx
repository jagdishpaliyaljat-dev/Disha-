import * as React from "react";
import { motion } from "motion/react";
import {
  X,
  Type,
  FileText,
  CheckSquare,
  Lightbulb,
  ListOrdered,
  Table as TableIcon,
  Quote,
  Upload,
  HelpCircle,
  Link as LinkIcon,
  MoveUp,
  MoveDown,
  Trash2,
  Plus,
  ChevronDown,
  ChevronUp,
  Smartphone,
  Monitor,
  Sparkles,
  Copy,
  Check,
  Clock,
  AlertTriangle,
  Info,
  Zap,
  BookOpen,
  Wand2,
  Layers,
  LayoutTemplate,
  Calendar,
  Eye,
  FileSpreadsheet,
  Maximize2,
  ExternalLink,
  ChevronRight,
  FileDown,
  GraduationCap,
} from "lucide-react";
import { NewsArticle, ArticleBlock, ArticleBlockType, FAQItem } from "../../types";
import { SaveProgress } from "../../utils/articleStorage";
import { ArticleSEOControlPanel } from "./ArticleSEOControlPanel";
import { ArticleCalloutBox } from "../news/ArticleCallouts";
import { ArticleTable } from "../news/ArticleTable";
import { PdfBlockEditor } from "./PdfBlockEditor";
import { BookCourseBlockEditor } from "./BookCourseBlockEditor";
import { AutoLinkRulesManagerModal } from "./AutoLinkRulesManagerModal";
import { autoInjectLinksToArticleBlocks } from "../../utils/smartArticleImporter";

interface ArticleBlockEditorModalProps {
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

export const ArticleBlockEditorModal: React.FC<ArticleBlockEditorModalProps> = ({
  isOpen,
  editingArticle: initialArticle,
  categories,
  onSave,
  onClose,
  actionLoading,
  saveProgress,
  handleCreateCategory,
  handleAiOptimizeSeo,
  aiGenerating = false,
}) => {
  const [article, setArticle] = React.useState<Partial<NewsArticle>>(initialArticle);
  const [editorTab, setEditorTab] = React.useState<"blocks" | "seo" | "preview">("blocks");
  const [previewDevice, setPreviewDevice] = React.useState<"desktop" | "mobile">("desktop");

  // Inline Category Creation
  const [isCreatingCategoryInline, setIsCreatingCategoryInline] = React.useState(false);
  const [inlineCategoryInput, setInlineCategoryInput] = React.useState("");

  // Block Collapsing State: Set of block IDs that are collapsed
  const [collapsedBlocks, setCollapsedBlocks] = React.useState<Record<string, boolean>>({});

  // Fast Chunk Paste & Auto-Add Bar State
  const [isChunkBarOpen, setIsChunkBarOpen] = React.useState(true);
  const [chunkText, setChunkText] = React.useState("");
  const [chunkFeedback, setChunkFeedback] = React.useState<string | null>(null);

  // Quick Table Paste Modal / Popover
  const [activeTableBlockIdx, setActiveTableBlockIdx] = React.useState<number | null>(null);
  const [tablePasteText, setTablePasteText] = React.useState("");

  // Quick FAQ Paste State
  const [activeFaqBlockIdx, setActiveFaqBlockIdx] = React.useState<number | null>(null);
  const [faqPasteText, setFaqPasteText] = React.useState("");

  // Block Multi-line Paste
  const [activeListBlockIdx, setActiveListBlockIdx] = React.useState<number | null>(null);
  const [listPasteText, setListPasteText] = React.useState("");

  // Auto Link Rules Manager Modal State
  const [isRulesManagerOpen, setIsRulesManagerOpen] = React.useState(false);

  const handleAutoInjectLinks = () => {
    if (!article.blocks || article.blocks.length === 0) {
      alert("No content blocks available to process.");
      return;
    }

    const res = autoInjectLinksToArticleBlocks(article.blocks);
    setArticle(prev => ({
      ...prev,
      blocks: res.blocks,
    }));

    showFeedback(`Auto-linked ${res.internalLinksCount} internal & ${res.externalLinksCount} external keywords across article blocks!`);
  };

  if (!isOpen) return null;

  // Toggle single block collapse
  const toggleBlockCollapse = (id: string) => {
    setCollapsedBlocks(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const collapseAllBlocks = () => {
    const map: Record<string, boolean> = {};
    (article.blocks || []).forEach(b => {
      map[b.id] = true;
    });
    setCollapsedBlocks(map);
  };

  const expandAllBlocks = () => {
    setCollapsedBlocks({});
  };

  // Block Helpers
  const addBlock = (type: ArticleBlockType, customProps: Partial<ArticleBlock> = {}) => {
    const uniqueId = `blk_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    let defaultData: Partial<ArticleBlock> = {};

    switch (type) {
      case "heading":
        defaultData = { level: 2, text: "Section Heading" };
        break;
      case "paragraph":
        defaultData = { text: "Explain your point or concept clearly for students here..." };
        break;
      case "key_points":
        defaultData = {
          listItems: [
            "Official notification released with key eligibility details",
            "Exam date announced; registration starts this week",
            "High-yield syllabus topics highlighted for revision",
          ],
        };
        break;
      case "callout":
        defaultData = {
          calloutType: "important",
          text: "Important: Last date to fill application form is approaching. Keep required documents ready.",
        };
        break;
      case "table":
        defaultData = {
          tableHeaders: ["Parameter / Event", "Details / Dates", "Official Status"],
          tableRows: [
            { cells: ["Notification Release", "Official Date", "Confirmed"] },
            { cells: ["Online Application", "Available Now", "Active"] },
            { cells: ["Exam Mode", "OMR / Offline", "Pen & Paper"] },
          ],
        };
        break;
      case "faq":
        defaultData = {
          faqs: [
            { question: "What is the minimum eligibility qualification?", answer: "Candidates must hold a Bachelor's degree from a recognized university." },
            { question: "Is there any negative marking in the exam?", answer: "Yes, 1/3rd negative marking applies for each incorrect answer." },
          ],
        };
        break;
      case "list":
        defaultData = {
          listType: "numbered",
          listItems: [
            "Visit the official recruitment portal",
            "Click on the Apply Online / Registration link",
            "Fill in personal and educational details",
            "Upload photo, signature, and submit application fee",
          ],
        };
        break;
      case "image":
        defaultData = {
          imageUrl: "https://images.unsplash.com/photo-1457369804613-52c61a468e7d?auto=format&fit=crop&w=1200&q=80",
          imageAlt: "Official Exam Notification and Syllabus Overview",
          imageCaption: "Official Rajasthan Exam Notification released on public portal.",
        };
        break;
      case "cta":
        defaultData = {
          ctaText: "Practice Free Mock Test & PYQ Vault",
          ctaUrl: "/topics",
        };
        break;
      case "quote":
        defaultData = {
          text: "Consistent revision of previous years' questions is the most dependable path to cracking state competitive exams.",
        };
        break;
      case "pdf_download":
        defaultData = {
          pdfTitle: "Official Exam Syllabus & Detailed Guidelines PDF",
          pdfUrl: "https://example.com/syllabus.pdf",
          pdfFileSize: "2.4 MB • Official PDF",
          pdfBadge: "Official Document",
          pdfDescription: "Download the complete syllabus, subject-wise marks distribution, and official exam pattern in PDF format.",
          pdfButtonText: "Download PDF Now",
        };
        break;
      case "book_course":
        defaultData = {
          itemType: "book",
          itemTitle: "Rajasthan CET & RAS Pre Complete Preparation Book",
          itemSubtitle: "By Senior Expert Faculty • Theory + 1,500+ Practice MCQs with Explanations",
          itemUrl: "https://amazon.in",
          itemImageUrl: "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=600&q=80",
          itemPrice: "₹349",
          itemOriginalPrice: "₹599",
          itemBadge: "Top Recommended",
          itemAuthor: "DISHA 20-20 Editorial Team",
          itemFeatures: [
            "Complete syllabus coverage for 2026",
            "Chapter-wise previous year question papers",
            "Free online test series coupon inside"
          ],
          itemButtonText: "Buy Now / View Details",
        };
        break;
      default:
        break;
    }

    const newBlock: ArticleBlock = {
      id: uniqueId,
      type,
      ...defaultData,
      ...customProps,
    };

    setArticle(prev => ({
      ...prev,
      blocks: [...(prev.blocks || []), newBlock],
    }));

    // Auto-scroll or feedback
    return uniqueId;
  };

  const updateBlock = (index: number, updated: ArticleBlock) => {
    const list = [...(article.blocks || [])];
    list[index] = updated;
    setArticle(prev => ({ ...prev, blocks: list }));
  };

  const removeBlock = (index: number) => {
    const list = [...(article.blocks || [])].filter((_, i) => i !== index);
    setArticle(prev => ({ ...prev, blocks: list }));
  };

  const duplicateBlock = (index: number) => {
    const blockToCopy = (article.blocks || [])[index];
    if (!blockToCopy) return;
    const duplicated: ArticleBlock = {
      ...JSON.parse(JSON.stringify(blockToCopy)),
      id: `blk_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    };
    const list = [...(article.blocks || [])];
    list.splice(index + 1, 0, duplicated);
    setArticle(prev => ({ ...prev, blocks: list }));
  };

  const moveBlock = (index: number, direction: "up" | "down") => {
    const list = [...(article.blocks || [])];
    const targetIdx = direction === "up" ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= list.length) return;
    const temp = list[index];
    list[index] = list[targetIdx];
    list[targetIdx] = temp;
    setArticle(prev => ({ ...prev, blocks: list }));
  };

  // ─────────────────────────────────────────────────────────────
  // ⚡ CHUNK PARSER LOGIC ("अलग-अलग टुकड़ों में पेस्ट करने के लिए")
  // ─────────────────────────────────────────────────────────────
  const handleAutoDetectAndAdd = (textToParse: string) => {
    const trimmed = textToParse.trim();
    if (!trimmed) return;

    const lines = trimmed.split("\n").map(l => l.trim()).filter(Boolean);

    // 1. Check if it's Table Data (contains tabs \t or pipes |)
    const hasTabs = lines.some(l => l.includes("\t"));
    const hasPipes = lines.some(l => l.includes("|"));
    if ((hasTabs || hasPipes) && lines.length >= 2) {
      const delimiter = hasTabs ? "\t" : "|";
      const parsedRows = lines.map(line =>
        line
          .split(delimiter)
          .map(c => c.trim().replace(/^\||\|$/g, ""))
          .filter(c => c.length > 0)
      ).filter(r => r.length > 0);

      if (parsedRows.length >= 2) {
        const headers = parsedRows[0];
        const bodyRows = parsedRows.slice(1).filter(r => !r.every(cell => cell.startsWith("---") || cell.startsWith(":--")));
        addBlock("table", {
          tableHeaders: headers,
          tableRows: bodyRows.map(cells => ({ cells })),
        });
        showFeedback("Added as Structured Data Table!");
        setChunkText("");
        return;
      }
    }

    // 2. Check if it's FAQ Q&A pattern (Q: ... A: ... or lines with ?)
    const isQnAPattern = lines.some(l => /^(Q\d*[:.]|\?|प्रश्न[:.])/i.test(l));
    if (isQnAPattern) {
      const faqs: FAQItem[] = [];
      let currentQ = "";
      let currentA = "";

      lines.forEach(l => {
        if (/^(Q\d*[:.]|प्रश्न[:.])/i.test(l)) {
          if (currentQ) {
            faqs.push({ question: currentQ, answer: currentA || "Answer details..." });
            currentA = "";
          }
          currentQ = l.replace(/^(Q\d*[:.]|प्रश्न[:.])/i, "").trim();
        } else if (/^(A\d*[:.]|उत्तर[:.])/i.test(l)) {
          currentA = l.replace(/^(A\d*[:.]|उत्तर[:.])/i, "").trim();
        } else if (l.endsWith("?") && !currentQ) {
          currentQ = l;
        } else if (currentQ && !currentA) {
          currentA = l;
        } else if (currentQ && currentA) {
          currentA += " " + l;
        }
      });
      if (currentQ) {
        faqs.push({ question: currentQ, answer: currentA || "Answer details..." });
      }

      if (faqs.length > 0) {
        addBlock("faq", { faqs });
        showFeedback(`Added as FAQ Block (${faqs.length} Q&As)!`);
        setChunkText("");
        return;
      }
    }

    // 3. Check if it's Bullet/List (lines start with •, -, *, or numbers)
    const bulletLines = lines.filter(l => /^(\*|-|•|\d+\.)\s+/.test(l));
    if (bulletLines.length >= 2 || (lines.length >= 3 && bulletLines.length >= lines.length * 0.6)) {
      const items = lines.map(l => l.replace(/^(\*|-|•|\d+\.)\s+/, "").trim());
      addBlock("key_points", { listItems: items });
      showFeedback(`Added as Key Highlights (${items.length} points)!`);
      setChunkText("");
      return;
    }

    // 4. Check if it's Heading (Single short line <= 90 characters, or starts with #)
    if (lines.length === 1 && (trimmed.startsWith("#") || trimmed.length <= 80) && !trimmed.endsWith(".")) {
      const cleanH = trimmed.replace(/^#+\s*/, "");
      const isSub = trimmed.startsWith("###");
      addBlock("heading", { level: isSub ? 3 : 2, text: cleanH });
      showFeedback(`Added as ${isSub ? "H3 Subheading" : "H2 Heading"}!`);
      setChunkText("");
      return;
    }

    // 5. Check if it's an Alert or Notice (contains alert keywords)
    if (
      /warning|alert|important|ध्यान दें|सूचना|नोटिस|last date|अंतिम तिथि/i.test(trimmed) &&
      trimmed.length <= 300
    ) {
      const type: "important" | "warning" | "info" = /last date|अंतिम तिथि|alert/i.test(trimmed)
        ? "important"
        : "warning";
      addBlock("callout", { calloutType: type, text: trimmed });
      showFeedback("Added as Alert Notice Box!");
      setChunkText("");
      return;
    }

    // 6. Default fallback: Paragraph
    addBlock("paragraph", { text: trimmed });
    showFeedback("Added as Paragraph Block!");
    setChunkText("");
  };

  const showFeedback = (msg: string) => {
    setChunkFeedback(msg);
    setTimeout(() => setChunkFeedback(null), 3000);
  };

  // Explicit Chunk Adders
  const addChunkAsH2 = () => {
    if (!chunkText.trim()) return;
    addBlock("heading", { level: 2, text: chunkText.trim().replace(/^#+\s*/, "") });
    setChunkText("");
    showFeedback("Added as H2 Section Heading!");
  };

  const addChunkAsH3 = () => {
    if (!chunkText.trim()) return;
    addBlock("heading", { level: 3, text: chunkText.trim().replace(/^#+\s*/, "") });
    setChunkText("");
    showFeedback("Added as H3 Subheading!");
  };

  const addChunkAsParagraph = () => {
    if (!chunkText.trim()) return;
    addBlock("paragraph", { text: chunkText.trim() });
    setChunkText("");
    showFeedback("Added as Paragraph!");
  };

  const addChunkAsKeyPoints = () => {
    if (!chunkText.trim()) return;
    const items = chunkText
      .split("\n")
      .map(l => l.replace(/^(\*|-|•|\d+\.)\s+/, "").trim())
      .filter(Boolean);
    addBlock("key_points", { listItems: items.length > 0 ? items : [chunkText.trim()] });
    setChunkText("");
    showFeedback(`Added as Key Highlights (${items.length} points)!`);
  };

  const addChunkAsAlert = (type: "important" | "warning" | "tip" | "info" = "important") => {
    if (!chunkText.trim()) return;
    addBlock("callout", { calloutType: type, text: chunkText.trim() });
    setChunkText("");
    showFeedback("Added as Important Notice Alert!");
  };

  const addChunkAsTable = () => {
    if (!chunkText.trim()) return;
    const lines = chunkText.trim().split("\n").filter(Boolean);
    const hasTabs = lines.some(l => l.includes("\t"));
    const delimiter = hasTabs ? "\t" : lines[0].includes(",") ? "," : "|";

    const rows = lines.map(line =>
      line
        .split(delimiter)
        .map(c => c.trim().replace(/^\||\|$/g, ""))
        .filter(c => c.length > 0)
    );

    const headers = rows[0] || ["Column 1", "Column 2", "Column 3"];
    const bodyRows = rows.slice(1).length > 0 ? rows.slice(1) : [{ cells: ["Value 1", "Value 2", "Value 3"] }];

    addBlock("table", {
      tableHeaders: headers,
      tableRows: bodyRows.map(cells => (Array.isArray(cells) ? { cells } : cells)),
    });
    setChunkText("");
    showFeedback("Added as Structured Table!");
  };

  const addChunkAsFaq = () => {
    if (!chunkText.trim()) return;
    const lines = chunkText.trim().split("\n").filter(Boolean);
    const faqs: FAQItem[] = [];
    let curQ = "";
    let curA = "";

    lines.forEach(l => {
      if (/^(Q\d*[:.]|\?|प्रश्न[:.])/i.test(l)) {
        if (curQ) {
          faqs.push({ question: curQ, answer: curA || "Details..." });
          curA = "";
        }
        curQ = l.replace(/^(Q\d*[:.]|\?|प्रश्न[:.])/i, "").trim();
      } else if (/^(A\d*[:.]|उत्तर[:.])/i.test(l)) {
        curA = l.replace(/^(A\d*[:.]|उत्तर[:.])/i, "").trim();
      } else if (l.endsWith("?") && !curQ) {
        curQ = l;
      } else if (curQ && !curA) {
        curA = l;
      } else if (curQ && curA) {
        curA += " " + l;
      }
    });
    if (curQ) faqs.push({ question: curQ, answer: curA || "Details..." });

    addBlock("faq", {
      faqs: faqs.length > 0 ? faqs : [{ question: chunkText.slice(0, 80) + "?", answer: chunkText }],
    });
    setChunkText("");
    showFeedback("Added as FAQ Block!");
  };

  // Pre-Built SEO Article Skeletons (One-Click Templates)
  const applyTemplate = (templateType: "notification" | "strategy" | "result") => {
    if (article.blocks && article.blocks.length > 0) {
      if (!window.confirm("Do you want to append this SEO template to your current article?")) {
        return;
      }
    }

    if (templateType === "notification") {
      addBlock("key_points", {
        listItems: [
          "Official Notification released with comprehensive exam schedule",
          "Eligibility criteria, age relaxation, and reservation guidelines specified",
          "Direct link to download official PDF notice and syllabus breakdown",
        ],
      });
      addBlock("callout", {
        calloutType: "important",
        text: "Important Date Alert: Online registration opens this week. Application deadline strictly enforced.",
      });
      addBlock("heading", { level: 2, text: "Exam Overview & Key Highlights" });
      addBlock("paragraph", {
        text: "The state recruitment commission has officially issued the examination advertisement for upcoming vacancies. Aspirants are advised to verify eligibility conditions and complete online registration well in advance of the deadline.",
      });
      addBlock("heading", { level: 2, text: "Important Dates & Event Schedule" });
      addBlock("table", {
        tableHeaders: ["Event / Milestone", "Official Date", "Status"],
        tableRows: [
          { cells: ["Notification Released", "Official Today", "Active"] },
          { cells: ["Online Application Start", "Immediate", "Open"] },
          { cells: ["Last Date to Apply", "Upcoming", "Strict Deadline"] },
          { cells: ["Admit Card Release", "10 Days before Exam", "To be announced"] },
        ],
      });
      addBlock("heading", { level: 2, text: "Eligibility Criteria & Qualification" });
      addBlock("paragraph", {
        text: "Candidates must hold an authorized degree from a recognized institution. Detailed relaxation applicable as per state reservation norms.",
      });
      addBlock("cta", {
        ctaText: "Practice Official Topic-Wise MCQs Free",
        ctaUrl: "/topics",
      });
      addBlock("heading", { level: 2, text: "Frequently Asked Questions (FAQs)" });
      addBlock("faq", {
        faqs: [
          { question: "What is the official application fee?", answer: "Fee structure is determined based on reservation category as specified in the recruitment advertisement." },
          { question: "Is there any negative marking in the exam?", answer: "Yes, 1/3rd mark penalty applies for every wrong response." },
        ],
      });
      showFeedback("Loaded Rajasthan Exam Notification Template!");
    } else if (templateType === "strategy") {
      addBlock("key_points", {
        listItems: [
          "High-scoring strategy for upcoming competitive examination",
          "Subject-wise weighting and prioritized revision schedule",
          "Proven memory recall and error prevention techniques",
        ],
      });
      addBlock("heading", { level: 2, text: "Core Concepts & Syllabus Prioritization" });
      addBlock("paragraph", {
        text: "To maximize scores, aspirants must identify high-yield chapters that consistently appear across previous exam sessions. Devote 70% of study time to practicing standard MCQs and clarifying conceptual doubts.",
      });
      addBlock("callout", {
        calloutType: "tip",
        text: "Pro Tip: Use DISHA 20-20 PYQ Vault to solve actual previous papers with timer to build exam-hall temperament.",
      });
      addBlock("heading", { level: 2, text: "Recommended 3-Phase Study Plan" });
      addBlock("list", {
        listType: "numbered",
        listItems: [
          "Phase 1: Syllabus Coverage & Foundation Building (Days 1–30)",
          "Phase 2: Topic-wise MCQ Practice & Error Log Review (Days 31–60)",
          "Phase 3: Full-Length Mock Exams & Speed Optimization (Final 15 Days)",
        ],
      });
      addBlock("cta", {
        ctaText: "Start Live Test & Check Your Ranking",
        ctaUrl: "/live_tests",
      });
      showFeedback("Loaded Study Strategy Template!");
    } else if (templateType === "result") {
      addBlock("callout", {
        calloutType: "important",
        text: "Result & Answer Key Update: Official scorecard and provisional answer key released on portal.",
      });
      addBlock("heading", { level: 2, text: "Official Cut-Off Marks Breakdown" });
      addBlock("table", {
        tableHeaders: ["Category", "Expected Cut-Off", "Previous Year Cut-Off"],
        tableRows: [
          { cells: ["General / Unreserved", "100 - 105", "100.69"] },
          { cells: ["OBC / EWS", "98 - 102", "99.12"] },
          { cells: ["SC / ST", "85 - 92", "88.45"] },
        ],
      });
      addBlock("heading", { level: 2, text: "Steps to Download Scorecard / Result PDF" });
      addBlock("list", {
        listType: "numbered",
        listItems: [
          "Visit the official examination board website",
          "Click on the Candidate Information / Result section",
          "Enter your Roll Number and Date of Birth (DOB)",
          "Download and save the verified scorecard for counseling",
        ],
      });
      showFeedback("Loaded Result & Cut-off Template!");
    }
  };

  // SEO Score calculation
  const calculateSeoScore = (): { score: number; checks: { label: string; passed: boolean }[] } => {
    const checks = [
      {
        label: "Title Length (20-70 chars)",
        passed: !!(article.title && article.title.length >= 20 && article.title.length <= 70),
      },
      {
        label: "H2 Headings included (min 2)",
        passed: (article.blocks || []).filter(b => b.type === "heading" && b.level === 2).length >= 2,
      },
      {
        label: "Key Highlights / Takeaways block present",
        passed: (article.blocks || []).some(b => b.type === "key_points"),
      },
      {
        label: "Structured Data Table present",
        passed: (article.blocks || []).some(b => b.type === "table"),
      },
      {
        label: "FAQ Rich Snippet block present",
        passed: (article.blocks || []).some(b => b.type === "faq") || ((article.faqs || []).length >= 2),
      },
      {
        label: "SEO Meta Description configured",
        passed: !!(article.seoDescription && article.seoDescription.length >= 100),
      },
      {
        label: "Focus Keyword set",
        passed: !!(article.focusKeyword && article.focusKeyword.trim().length >= 3),
      },
    ];

    const passedCount = checks.filter(c => c.passed).length;
    const score = Math.round((passedCount / checks.length) * 100);
    return { score, checks };
  };

  const seoData = calculateSeoScore();

  // Handle Save
  const handleFinalSave = (statusOverride?: "published" | "draft") => {
    if (!article.title?.trim()) {
      alert("Please provide an Article Title.");
      return;
    }
    const updated: Partial<NewsArticle> = {
      ...article,
      status: statusOverride || article.status || "published",
      updatedAt: new Date().toISOString(),
    };
    onSave(updated);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-md flex items-center justify-center p-0 sm:p-4 overflow-y-auto animate-in fade-in">
      <div className="bg-white dark:bg-[#111A2E] w-full h-full sm:h-[94vh] sm:max-w-6xl sm:rounded-[32px] shadow-2xl border-0 sm:border border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden">
        
        {/* ─────────────────────────────────────────────────────────────
            MODAL TOP HEADER WITH PROMINENT SAVE ACTION
        ───────────────────────────────────────────────────────────── */}
        <div className="p-3.5 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0 bg-white/95 dark:bg-[#111A2E]/95 backdrop-blur-md">
          <div className="flex items-center justify-between w-full sm:w-auto gap-2">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center font-black shadow-md shadow-blue-500/20 shrink-0">
                <BookOpen className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white leading-tight">
                    {article.id ? "Edit Article" : "Create SEO Article"}
                  </h3>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                      seoData.score >= 80
                        ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                        : seoData.score >= 50
                        ? "bg-amber-500/10 text-amber-600 border-amber-500/20"
                        : "bg-rose-500/10 text-rose-600 border-rose-500/20"
                    }`}
                  >
                    SEO: {seoData.score}%
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 hidden sm:block">
                  Modular SEO Content Blocks · Chunk-by-Chunk Fast Publishing
                </p>
              </div>
            </div>

            {saveProgress && (
              <div className="hidden lg:flex flex-col flex-1 max-w-[200px] mx-4 space-y-1">
                <div className="flex items-center justify-between text-[9px] font-black uppercase tracking-wider text-blue-600 dark:text-blue-400">
                  <span>{saveProgress.stage === 'metadata' ? 'Metadata' : `Blocks (${saveProgress.currentBatch}/${saveProgress.totalBatches})`}</span>
                  <span>{saveProgress.percent}%</span>
                </div>
                <div className="h-1 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden border border-blue-500/10">
                  <motion.div 
                    className="h-full bg-blue-600 shadow-[0_0_8px_rgba(37,99,235,0.4)]"
                    initial={{ width: 0 }}
                    animate={{ width: `${saveProgress.percent}%` }}
                  />
                </div>
              </div>
            )}

            {/* Mobile Header Save & Close Buttons */}
            <div className="flex items-center gap-1.5 sm:hidden">
              <button
                type="button"
                onClick={() => handleFinalSave()}
                disabled={actionLoading === "save"}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black flex items-center gap-1 shadow-sm cursor-pointer disabled:opacity-50"
              >
                {actionLoading === "save" ? (
                  <Clock className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Check className="w-3.5 h-3.5" />
                )}
                <span>Save</span>
              </button>
              <button
                onClick={onClose}
                className="p-1.5 rounded-xl text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Navigation Tab Switcher & Top Save Button */}
          <div className="flex items-center justify-between sm:justify-end gap-2 w-full sm:w-auto">
            <div className="flex p-1 bg-slate-100 dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 w-full sm:w-auto overflow-x-auto scrollbar-none">
              <button
                onClick={() => setEditorTab("blocks")}
                className={`flex-1 sm:flex-initial px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all text-center whitespace-nowrap cursor-pointer flex items-center justify-center gap-1.5 ${
                  editorTab === "blocks"
                    ? "bg-white dark:bg-slate-800 text-[#1E5BF0] shadow-xs"
                    : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Blocks ({article.blocks?.length || 0})</span>
              </button>
              <button
                onClick={() => setEditorTab("seo")}
                className={`flex-1 sm:flex-initial px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all text-center whitespace-nowrap cursor-pointer flex items-center justify-center gap-1.5 ${
                  editorTab === "seo"
                    ? "bg-white dark:bg-slate-800 text-[#1E5BF0] shadow-xs"
                    : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>SEO & Meta</span>
              </button>
              <button
                onClick={() => setEditorTab("preview")}
                className={`flex-1 sm:flex-initial px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all text-center whitespace-nowrap cursor-pointer flex items-center justify-center gap-1.5 ${
                  editorTab === "preview"
                    ? "bg-white dark:bg-slate-800 text-[#1E5BF0] shadow-xs"
                    : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                }`}
              >
                <Eye className="w-3.5 h-3.5" />
                <span>Live Preview</span>
              </button>
            </div>

            {/* Desktop Header Save Button */}
            <button
              type="button"
              onClick={() => handleFinalSave()}
              disabled={actionLoading === "save"}
              className="hidden sm:flex px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black items-center gap-1.5 shadow-md transition-all active:scale-95 cursor-pointer disabled:opacity-50 shrink-0"
            >
              {actionLoading === "save" ? (
                <>
                  <Clock className="w-3.5 h-3.5 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Save Article</span>
                </>
              )}
            </button>

            <button
              onClick={onClose}
              className="hidden sm:block p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-500 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ─────────────────────────────────────────────────────────────
            TAB 1: CONTENT BLOCKS EDITOR
        ───────────────────────────────────────────────────────────── */}
        {editorTab === "blocks" && (
          <div className="flex-1 overflow-y-auto p-3.5 sm:p-6 space-y-4">
            
            {/* 1. Article Core Meta Banner (Responsive Inputs) */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                <div className="lg:col-span-2 space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider">
                      Article Title (English) *
                    </label>
                    <span className="text-[10px] font-medium text-slate-400">
                      {(article.title || "").length} / 70 chars
                    </span>
                  </div>
                  <input
                    type="text"
                    required
                    value={article.title || ""}
                    onChange={e => {
                      const t = e.target.value;
                      const s = !article.id
                        ? t.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
                        : article.slug || "";
                      setArticle(prev => ({ ...prev, title: t, slug: s }));
                    }}
                    placeholder="e.g. Rajasthan Economic Survey 2024 Sectoral Highlights"
                    className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider">
                    Alternative / Hindi Title
                  </label>
                  <input
                    type="text"
                    value={article.hindiTitle || ""}
                    onChange={e => setArticle(prev => ({ ...prev, hindiTitle: e.target.value }))}
                    placeholder="e.g. Rajasthan Economic Survey 2024 Key Points"
                    className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>

                {/* Category with Inline Add */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider">
                      Category
                    </label>
                    <button
                      type="button"
                      onClick={() => setIsCreatingCategoryInline(!isCreatingCategoryInline)}
                      className="text-[10px] font-bold text-[#1E5BF0] hover:underline cursor-pointer flex items-center gap-0.5"
                    >
                      <Plus className="w-3 h-3" />
                      <span>New</span>
                    </button>
                  </div>
                  {isCreatingCategoryInline ? (
                    <div className="flex items-center gap-1">
                      <input
                        type="text"
                        value={inlineCategoryInput}
                        onChange={e => setInlineCategoryInput(e.target.value)}
                        placeholder="Category name..."
                        className="flex-1 px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-blue-500 rounded-xl text-xs font-bold text-slate-900 dark:text-white"
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={async () => {
                          if (inlineCategoryInput.trim()) {
                            await handleCreateCategory(inlineCategoryInput.trim());
                            setArticle(prev => ({ ...prev, category: inlineCategoryInput.trim() }));
                            setInlineCategoryInput("");
                            setIsCreatingCategoryInline(false);
                          }
                        }}
                        className="p-1.5 bg-blue-600 text-white rounded-lg text-xs font-bold cursor-pointer"
                      >
                        <Check className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsCreatingCategoryInline(false)}
                        className="p-1.5 bg-slate-200 text-slate-600 rounded-lg text-xs font-bold cursor-pointer"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <select
                      value={article.category || categories[0] || "General"}
                      onChange={e => setArticle(prev => ({ ...prev, category: e.target.value }))}
                      className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white cursor-pointer"
                    >
                      {categories.map(cat => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                {/* Publish Date with "Today" Quick button */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider">
                      Publish Date
                    </label>
                    <button
                      type="button"
                      onClick={() => setArticle(prev => ({ ...prev, publishedAt: new Date().toISOString() }))}
                      className="text-[10px] font-bold text-amber-600 dark:text-amber-400 hover:underline cursor-pointer flex items-center gap-0.5"
                    >
                      <Clock className="w-3 h-3" />
                      <span>Today</span>
                    </button>
                  </div>
                  <input
                    type="date"
                    value={
                      article.publishedAt
                        ? new Date(article.publishedAt).toISOString().split("T")[0]
                        : new Date().toISOString().split("T")[0]
                    }
                    onChange={e => {
                      const val = e.target.value;
                      if (val) {
                        setArticle(prev => ({ ...prev, publishedAt: new Date(val).toISOString() }));
                      }
                    }}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white"
                  />
                </div>
              </div>
            </div>

            {/* ─────────────────────────────────────────────────────────────
                2. ⚡ FAST CHUNK PASTE BAR
            ───────────────────────────────────────────────────────────── */}
            <div className="p-4 rounded-2xl bg-gradient-to-r from-blue-50/90 via-indigo-50/80 to-purple-50/90 dark:from-blue-950/30 dark:via-indigo-950/30 dark:to-purple-950/30 border border-blue-200/80 dark:border-blue-900/60 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-blue-600 text-white shadow-xs">
                    <Wand2 className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs sm:text-sm font-black text-slate-900 dark:text-white">
                      ⚡ Quick Chunk Paste &amp; Fast Publishing
                    </h4>
                    <p className="text-[10px] sm:text-[11px] text-slate-500 dark:text-slate-400">
                      Copy raw text from notifications, syllabus, or web pages, paste below, and generate formatted content blocks in 1 click.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setIsChunkBarOpen(!isChunkBarOpen)}
                    className="p-1.5 text-slate-500 hover:text-slate-800 dark:hover:text-white transition-colors cursor-pointer"
                  >
                    {isChunkBarOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {isChunkBarOpen && (
                <div className="space-y-3 pt-1">
                  <textarea
                    rows={3}
                    value={chunkText}
                    onChange={e => setChunkText(e.target.value)}
                    placeholder="📋 Paste any text chunk here (e.g. Section title, paragraph, bullet points, tab-delimited table, Q&A, or exam date alert)..."
                    className="w-full p-3 bg-white dark:bg-slate-900 border border-blue-200 dark:border-blue-900/80 rounded-xl text-xs font-medium text-slate-900 dark:text-white shadow-inner focus:ring-2 focus:ring-blue-500/20"
                  />

                  {/* Fast Chunk Action Buttons */}
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleAutoDetectAndAdd(chunkText)}
                      disabled={!chunkText.trim()}
                      className="px-3.5 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl text-xs font-black flex items-center gap-1.5 shadow-sm active:scale-95 disabled:opacity-40 cursor-pointer"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                      <span>⚡ Auto-Detect &amp; Add Block</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleAutoInjectLinks}
                      className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black flex items-center gap-1.5 shadow-sm active:scale-95 cursor-pointer"
                      title="Automatically scan blocks and inject internal & external links"
                    >
                      <LinkIcon className="w-3.5 h-3.5 text-indigo-200" />
                      <span>🔗 Auto-Inject Links</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setIsRulesManagerOpen(true)}
                      className="px-3 py-2 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-indigo-600 dark:text-indigo-400 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1"
                    >
                      <span>Manage Rules</span>
                    </button>

                    <div className="flex flex-wrap items-center gap-1.5 text-slate-700 dark:text-slate-200">
                      <button
                        type="button"
                        onClick={addChunkAsH2}
                        disabled={!chunkText.trim()}
                        className="px-2.5 py-1.5 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-lg text-[11px] font-bold disabled:opacity-40 cursor-pointer flex items-center gap-1"
                      >
                        <Type className="w-3 h-3 text-blue-500" />
                        <span>+ H2 Heading</span>
                      </button>
                      <button
                        type="button"
                        onClick={addChunkAsParagraph}
                        disabled={!chunkText.trim()}
                        className="px-2.5 py-1.5 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-lg text-[11px] font-bold disabled:opacity-40 cursor-pointer flex items-center gap-1"
                      >
                        <FileText className="w-3 h-3 text-slate-500" />
                        <span>+ Paragraph</span>
                      </button>
                      <button
                        type="button"
                        onClick={addChunkAsKeyPoints}
                        disabled={!chunkText.trim()}
                        className="px-2.5 py-1.5 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-lg text-[11px] font-bold disabled:opacity-40 cursor-pointer flex items-center gap-1"
                      >
                        <CheckSquare className="w-3 h-3 text-emerald-500" />
                        <span>+ Key Highlights</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => addChunkAsAlert("important")}
                        disabled={!chunkText.trim()}
                        className="px-2.5 py-1.5 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-lg text-[11px] font-bold disabled:opacity-40 cursor-pointer flex items-center gap-1"
                      >
                        <AlertTriangle className="w-3 h-3 text-amber-500" />
                        <span>+ Alert Notice</span>
                      </button>
                      <button
                        type="button"
                        onClick={addChunkAsTable}
                        disabled={!chunkText.trim()}
                        className="px-2.5 py-1.5 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-lg text-[11px] font-bold disabled:opacity-40 cursor-pointer flex items-center gap-1"
                      >
                        <TableIcon className="w-3 h-3 text-cyan-500" />
                        <span>+ Table</span>
                      </button>
                      <button
                        type="button"
                        onClick={addChunkAsFaq}
                        disabled={!chunkText.trim()}
                        className="px-2.5 py-1.5 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-lg text-[11px] font-bold disabled:opacity-40 cursor-pointer flex items-center gap-1"
                      >
                        <HelpCircle className="w-3 h-3 text-purple-500" />
                        <span>+ FAQ</span>
                      </button>
                    </div>
                  </div>

                  {/* Feedback toast */}
                  {chunkFeedback && (
                    <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-xs font-bold flex items-center gap-2 animate-in fade-in">
                      <Check className="w-4 h-4 text-emerald-600" />
                      <span>{chunkFeedback}</span>
                    </div>
                  )}

                  {/* Pre-Built Article Templates Selector */}
                  <div className="pt-2 border-t border-blue-200/60 dark:border-blue-900/40 flex flex-wrap items-center gap-2">
                    <span className="text-[10px] font-black uppercase text-blue-700 dark:text-blue-300 flex items-center gap-1">
                      <LayoutTemplate className="w-3.5 h-3.5" />
                      <span>Load Pre-Built SEO Skeleton:</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => applyTemplate("notification")}
                      className="px-2.5 py-1 bg-white/80 dark:bg-slate-800 hover:bg-white text-slate-800 dark:text-slate-200 rounded-lg text-[10px] font-bold border border-blue-200 dark:border-blue-800 cursor-pointer"
                    >
                      📋 Exam Notification
                    </button>
                    <button
                      type="button"
                      onClick={() => applyTemplate("strategy")}
                      className="px-2.5 py-1 bg-white/80 dark:bg-slate-800 hover:bg-white text-slate-800 dark:text-slate-200 rounded-lg text-[10px] font-bold border border-blue-200 dark:border-blue-800 cursor-pointer"
                    >
                      📘 Study Strategy &amp; Notes
                    </button>
                    <button
                      type="button"
                      onClick={() => applyTemplate("result")}
                      className="px-2.5 py-1 bg-white/80 dark:bg-slate-800 hover:bg-white text-slate-800 dark:text-slate-200 rounded-lg text-[10px] font-bold border border-blue-200 dark:border-blue-800 cursor-pointer"
                    >
                      🎯 Result &amp; Cut-Off Marks
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* ─────────────────────────────────────────────────────────────
                3. CATEGORIZED BLOCK ADDER PALETTE
            ───────────────────────────────────────────────────────────── */}
            <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                  <Plus className="w-3.5 h-3.5 text-blue-600" />
                  <span>Add Content Block:</span>
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={collapseAllBlocks}
                    className="text-[10px] font-bold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer"
                  >
                    Collapse All
                  </button>
                  <span className="text-slate-300 dark:text-slate-700">·</span>
                  <button
                    type="button"
                    onClick={expandAllBlocks}
                    className="text-[10px] font-bold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer"
                  >
                    Expand All
                  </button>
                </div>
              </div>

              {/* Categorized Action Palette Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2">
                {/* 1. H2 Section */}
                <button
                  type="button"
                  onClick={() => addBlock("heading", { level: 2 })}
                  className="p-2 rounded-xl bg-blue-50/80 hover:bg-blue-100/80 dark:bg-blue-950/20 dark:hover:bg-blue-900/30 border border-blue-200/80 dark:border-blue-900/40 text-left transition-all active:scale-95 cursor-pointer group"
                >
                  <div className="flex items-center gap-1.5 font-bold text-xs text-blue-700 dark:text-blue-300">
                    <Type className="w-3.5 h-3.5 text-blue-600" />
                    <span>H2 Section</span>
                  </div>
                  <span className="text-[9.5px] text-slate-400 block mt-0.5">Primary Heading</span>
                </button>

                {/* 2. H3 Subheading */}
                <button
                  type="button"
                  onClick={() => addBlock("heading", { level: 3 })}
                  className="p-2 rounded-xl bg-indigo-50/80 hover:bg-indigo-100/80 dark:bg-indigo-950/20 dark:hover:bg-indigo-900/30 border border-indigo-200/80 dark:border-indigo-900/40 text-left transition-all active:scale-95 cursor-pointer group"
                >
                  <div className="flex items-center gap-1.5 font-bold text-xs text-indigo-700 dark:text-indigo-300">
                    <Type className="w-3.5 h-3.5 text-indigo-600" />
                    <span>H3 Subheading</span>
                  </div>
                  <span className="text-[9.5px] text-slate-400 block mt-0.5">Sub-section Heading</span>
                </button>

                {/* 3. Paragraph */}
                <button
                  type="button"
                  onClick={() => addBlock("paragraph")}
                  className="p-2 rounded-xl bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/60 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 text-left transition-all active:scale-95 cursor-pointer group"
                >
                  <div className="flex items-center gap-1.5 font-bold text-xs text-slate-800 dark:text-slate-200">
                    <FileText className="w-3.5 h-3.5 text-slate-600" />
                    <span>Paragraph</span>
                  </div>
                  <span className="text-[9.5px] text-slate-400 block mt-0.5">Explanatory Text</span>
                </button>

                {/* 4. Key Highlights */}
                <button
                  type="button"
                  onClick={() => addBlock("key_points")}
                  className="p-2 rounded-xl bg-emerald-50/80 hover:bg-emerald-100/80 dark:bg-emerald-950/20 dark:hover:bg-emerald-900/30 border border-emerald-200/80 dark:border-emerald-900/40 text-left transition-all active:scale-95 cursor-pointer group"
                >
                  <div className="flex items-center gap-1.5 font-bold text-xs text-emerald-700 dark:text-emerald-300">
                    <CheckSquare className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Key Highlights</span>
                  </div>
                  <span className="text-[9.5px] text-slate-400 block mt-0.5">Takeaway Card</span>
                </button>

                {/* 5. Notice Alert */}
                <button
                  type="button"
                  onClick={() => addBlock("callout")}
                  className="p-2 rounded-xl bg-amber-50/80 hover:bg-amber-100/80 dark:bg-amber-950/20 dark:hover:bg-amber-900/30 border border-amber-200/80 dark:border-amber-900/40 text-left transition-all active:scale-95 cursor-pointer group"
                >
                  <div className="flex items-center gap-1.5 font-bold text-xs text-amber-700 dark:text-amber-300">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                    <span>Notice / Alert</span>
                  </div>
                  <span className="text-[9.5px] text-slate-400 block mt-0.5">Date / Warning Box</span>
                </button>

                {/* 6. Data Table */}
                <button
                  type="button"
                  onClick={() => addBlock("table")}
                  className="p-2 rounded-xl bg-cyan-50/80 hover:bg-cyan-100/80 dark:bg-cyan-950/20 dark:hover:bg-cyan-900/30 border border-cyan-200/80 dark:border-cyan-900/40 text-left transition-all active:scale-95 cursor-pointer group"
                >
                  <div className="flex items-center gap-1.5 font-bold text-xs text-cyan-700 dark:text-cyan-300">
                    <TableIcon className="w-3.5 h-3.5 text-cyan-600" />
                    <span>Data Table</span>
                  </div>
                  <span className="text-[9.5px] text-slate-400 block mt-0.5">Cut-off / Vacancies</span>
                </button>

                {/* 7. Step-by-Step List */}
                <button
                  type="button"
                  onClick={() => addBlock("list")}
                  className="p-2 rounded-xl bg-indigo-50/80 hover:bg-indigo-100/80 dark:bg-indigo-950/20 dark:hover:bg-indigo-900/30 border border-indigo-200/80 dark:border-indigo-900/40 text-left transition-all active:scale-95 cursor-pointer group"
                >
                  <div className="flex items-center gap-1.5 font-bold text-xs text-indigo-700 dark:text-indigo-300">
                    <ListOrdered className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Step Guide</span>
                  </div>
                  <span className="text-[9.5px] text-slate-400 block mt-0.5">Numbered / Bullets</span>
                </button>

                {/* 8. FAQs Accordion */}
                <button
                  type="button"
                  onClick={() => addBlock("faq")}
                  className="p-2 rounded-xl bg-purple-50/80 hover:bg-purple-100/80 dark:bg-purple-950/20 dark:hover:bg-purple-900/30 border border-purple-200/80 dark:border-purple-900/40 text-left transition-all active:scale-95 cursor-pointer group"
                >
                  <div className="flex items-center gap-1.5 font-bold text-xs text-purple-700 dark:text-purple-300">
                    <HelpCircle className="w-3.5 h-3.5 text-purple-600" />
                    <span>FAQs Block</span>
                  </div>
                  <span className="text-[9.5px] text-slate-400 block mt-0.5">Google Schema FAQ</span>
                </button>

                {/* 9. Image with Alt */}
                <button
                  type="button"
                  onClick={() => addBlock("image")}
                  className="p-2 rounded-xl bg-rose-50/80 hover:bg-rose-100/80 dark:bg-rose-950/20 dark:hover:bg-rose-900/30 border border-rose-200/80 dark:border-rose-900/40 text-left transition-all active:scale-95 cursor-pointer group"
                >
                  <div className="flex items-center gap-1.5 font-bold text-xs text-rose-700 dark:text-rose-300">
                    <Upload className="w-3.5 h-3.5 text-rose-600" />
                    <span>Image + Alt</span>
                  </div>
                  <span className="text-[9.5px] text-slate-400 block mt-0.5">SEO Image &amp; Caption</span>
                </button>

                {/* 10. Official Links / CTA */}
                <button
                  type="button"
                  onClick={() => addBlock("cta")}
                  className="p-2 rounded-xl bg-blue-50/80 hover:bg-blue-100/80 dark:bg-blue-950/20 dark:hover:bg-blue-900/30 border border-blue-200/80 dark:border-blue-900/40 text-left transition-all active:scale-95 cursor-pointer group"
                >
                  <div className="flex items-center gap-1.5 font-bold text-xs text-blue-700 dark:text-blue-300">
                    <LinkIcon className="w-3.5 h-3.5 text-blue-600" />
                    <span>Official Link</span>
                  </div>
                  <span className="text-[9.5px] text-slate-400 block mt-0.5">Download / Quiz CTA</span>
                </button>

                {/* 11. Quote / Pro Tip */}
                <button
                  type="button"
                  onClick={() => addBlock("quote")}
                  className="p-2 rounded-xl bg-amber-50/80 hover:bg-amber-100/80 dark:bg-amber-950/20 dark:hover:bg-amber-900/30 border border-amber-200/80 dark:border-amber-900/40 text-left transition-all active:scale-95 cursor-pointer group"
                >
                  <div className="flex items-center gap-1.5 font-bold text-xs text-amber-700 dark:text-amber-300">
                    <Quote className="w-3.5 h-3.5 text-amber-600" />
                    <span>Quote / Tip</span>
                  </div>
                  <span className="text-[9.5px] text-slate-400 block mt-0.5">Strategy Highlight</span>
                </button>

                {/* 12. PDF Document / Syllabus Upload */}
                <button
                  type="button"
                  onClick={() => addBlock("pdf_download")}
                  className="p-2 rounded-xl bg-rose-50/80 hover:bg-rose-100/80 dark:bg-rose-950/20 dark:hover:bg-rose-900/30 border border-rose-200/80 dark:border-rose-900/40 text-left transition-all active:scale-95 cursor-pointer group"
                >
                  <div className="flex items-center gap-1.5 font-bold text-xs text-rose-700 dark:text-rose-300">
                    <FileDown className="w-3.5 h-3.5 text-rose-600" />
                    <span>PDF Download</span>
                  </div>
                  <span className="text-[9.5px] text-slate-400 block mt-0.5">Syllabus / Notes PDF</span>
                </button>

                {/* 13. Book & Course Recommendation */}
                <button
                  type="button"
                  onClick={() => addBlock("book_course")}
                  className="p-2 rounded-xl bg-indigo-50/80 hover:bg-indigo-100/80 dark:bg-indigo-950/20 dark:hover:bg-indigo-900/30 border border-indigo-200/80 dark:border-indigo-900/40 text-left transition-all active:scale-95 cursor-pointer group"
                >
                  <div className="flex items-center gap-1.5 font-bold text-xs text-indigo-700 dark:text-indigo-300">
                    <GraduationCap className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Book &amp; Course</span>
                  </div>
                  <span className="text-[9.5px] text-slate-400 block mt-0.5">Book / Batch Link</span>
                </button>
              </div>
            </div>

            {/* ─────────────────────────────────────────────────────────────
                4. BLOCKS LIST (MOBILE & DESKTOP ERGONOMIC CARDS)
            ───────────────────────────────────────────────────────────── */}
            <div className="space-y-3.5">
              {(article.blocks || []).length === 0 && (
                <div className="p-8 text-center rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800 space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-blue-500/10 text-blue-600 flex items-center justify-center mx-auto">
                    <Wand2 className="w-6 h-6" />
                  </div>
                  <h4 className="text-sm font-black text-slate-900 dark:text-white">
                    No Content Blocks Yet
                  </h4>
                  <p className="text-xs text-slate-500 max-w-md mx-auto">
                    Use the Quick Chunk Paste box above to paste segments directly, or pick one of the pre-built article templates to get started in 10 seconds!
                  </p>
                  <div className="flex justify-center gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => applyTemplate("notification")}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold cursor-pointer"
                    >
                      Insert Notification Template
                    </button>
                  </div>
                </div>
              )}

              {(article.blocks || []).map((blk, idx) => {
                const isCollapsed = !!collapsedBlocks[blk.id];
                const blockTypeLabel =
                  blk.type === "heading"
                    ? blk.level === 3
                      ? "H3 Subheading"
                      : "H2 Section Heading"
                    : blk.type === "key_points"
                    ? "Key Takeaways"
                    : blk.type === "callout"
                    ? "Notice / Alert Box"
                    : blk.type === "table"
                    ? "Data Table"
                    : blk.type === "faq"
                    ? "FAQ Accordion"
                    : blk.type === "cta"
                    ? "Official Link / CTA"
                    : blk.type.toUpperCase();

                return (
                  <div
                    key={blk.id || idx}
                    className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs overflow-hidden transition-all"
                  >
                    {/* Block Card Header Bar */}
                    <div className="p-3 sm:px-4 bg-slate-50/90 dark:bg-slate-800/40 border-b border-slate-100 dark:border-slate-800/80 flex items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-2 min-w-0">
                        <button
                          type="button"
                          onClick={() => toggleBlockCollapse(blk.id)}
                          className="p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 transition-colors cursor-pointer shrink-0"
                          title={isCollapsed ? "Expand Block" : "Collapse Block"}
                        >
                          {isCollapsed ? (
                            <ChevronRight className="w-4 h-4" />
                          ) : (
                            <ChevronDown className="w-4 h-4" />
                          )}
                        </button>

                        <span className="w-5 h-5 rounded-md bg-slate-200 dark:bg-slate-700 flex items-center justify-center font-bold text-[10px] text-slate-700 dark:text-slate-300 shrink-0">
                          {idx + 1}
                        </span>

                        <span
                          className={`font-black text-[10px] tracking-wider uppercase px-2 py-0.5 rounded-md border shrink-0 ${
                            blk.type === "heading"
                              ? "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20"
                              : blk.type === "key_points"
                              ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20"
                              : blk.type === "callout"
                              ? "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20"
                              : blk.type === "table"
                              ? "bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border-cyan-500/20"
                              : blk.type === "faq"
                              ? "bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/20"
                              : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200"
                          }`}
                        >
                          {blockTypeLabel}
                        </span>

                        {/* Collapsed Excerpt Preview */}
                        {isCollapsed && (
                          <span className="text-[11px] text-slate-500 dark:text-slate-400 truncate max-w-[200px] sm:max-w-md font-medium">
                            {blk.type === "heading"
                              ? blk.text || "Empty Heading"
                              : blk.type === "paragraph"
                              ? blk.text?.slice(0, 60) || "Empty Paragraph"
                              : blk.type === "key_points"
                              ? `${blk.listItems?.length || 0} bullet items`
                              : blk.type === "table"
                              ? `${blk.tableRows?.length || 0} rows table`
                              : blk.type === "faq"
                              ? `${blk.faqs?.length || 0} FAQ Q&As`
                              : blk.text?.slice(0, 50) || ""}
                          </span>
                        )}
                      </div>

                      {/* Control Actions: Reorder, Duplicate, Delete */}
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => moveBlock(idx, "up")}
                          disabled={idx === 0}
                          className="p-1.5 rounded-lg bg-white dark:bg-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-white disabled:opacity-25 transition-all cursor-pointer shadow-2xs"
                          title="Move Up"
                        >
                          <MoveUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => moveBlock(idx, "down")}
                          disabled={idx === (article.blocks?.length || 1) - 1}
                          className="p-1.5 rounded-lg bg-white dark:bg-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-white disabled:opacity-25 transition-all cursor-pointer shadow-2xs"
                          title="Move Down"
                        >
                          <MoveDown className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => duplicateBlock(idx)}
                          className="p-1.5 rounded-lg bg-white dark:bg-slate-800 text-slate-500 hover:text-blue-600 transition-all cursor-pointer shadow-2xs"
                          title="Duplicate Block"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => removeBlock(idx)}
                          className="p-1.5 rounded-lg bg-rose-50 dark:bg-rose-950/30 text-rose-600 hover:bg-rose-100 transition-all cursor-pointer shadow-2xs"
                          title="Delete Block"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Block Card Body (Rendered when expanded) */}
                    {!isCollapsed && (
                      <div className="p-3.5 sm:p-5 space-y-3">
                        {/* 1. HEADING BLOCK */}
                        {blk.type === "heading" && (
                          <div className="space-y-2">
                            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
                              <div className="space-y-1">
                                <label className="text-[10px] font-bold uppercase text-slate-500">
                                  Level
                                </label>
                                <select
                                  value={blk.level || 2}
                                  onChange={e =>
                                    updateBlock(idx, {
                                      ...blk,
                                      level: Number(e.target.value) as 1 | 2 | 3 | 4,
                                    })
                                  }
                                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white cursor-pointer"
                                >
                                  <option value={1}>H1 (Main Heading)</option>
                                  <option value={2}>H2 (Major Section)</option>
                                  <option value={3}>H3 (Sub-section)</option>
                                  <option value={4}>H4 (Minor Section)</option>
                                </select>
                              </div>
                              <div className="sm:col-span-3 space-y-1">
                                <label className="text-[10px] font-bold uppercase text-slate-500">
                                  Heading Text (English or Hindi)
                                </label>
                                <input
                                  type="text"
                                  value={blk.text || ""}
                                  onChange={e => updateBlock(idx, { ...blk, text: e.target.value })}
                                  placeholder="e.g. Eligibility Criteria & Age Limit..."
                                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white"
                                />
                              </div>
                            </div>
                            <div className="text-[10px] text-slate-400 flex items-center gap-1.5">
                              <span className="font-bold">Anchor Tag:</span>
                              <code className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 font-mono text-[9.5px]">
                                #
                                {(blk.text || "")
                                  .toLowerCase()
                                  .replace(/[^a-z0-9]+/g, "-")
                                  .replace(/^-|-$/g, "") || "section"}
                              </code>
                              <span>(Appears in public Table of Contents automatically)</span>
                            </div>
                          </div>
                        )}

                        {/* INTRO BLOCK */}
                        {blk.type === "intro" && (
                          <div className="space-y-1.5 p-3.5 rounded-xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200/60 dark:border-blue-900/40">
                            <div className="flex items-center justify-between text-[10px] font-bold text-blue-700 dark:text-blue-400 uppercase">
                              <span>Article Introduction / Hook Lead</span>
                              <span>{(blk.text || "").length} characters</span>
                            </div>
                            <textarea
                              rows={4}
                              value={blk.text || ""}
                              onChange={e => updateBlock(idx, { ...blk, text: e.target.value })}
                              placeholder="Write engaging introductory hook (English or Hindi)..."
                              className="w-full p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-900 dark:text-white leading-relaxed focus:ring-2 focus:ring-blue-500/20"
                            />
                          </div>
                        )}

                        {/* CONCLUSION BLOCK */}
                        {blk.type === "conclusion" && (
                          <div className="space-y-1.5 p-3.5 rounded-xl bg-purple-50/50 dark:bg-purple-950/20 border border-purple-200/60 dark:border-purple-900/40">
                            <div className="flex items-center justify-between text-[10px] font-bold text-purple-700 dark:text-purple-400 uppercase">
                              <span>Article Conclusion & Final Takeaway</span>
                              <span>{(blk.text || "").length} characters</span>
                            </div>
                            <textarea
                              rows={4}
                              value={blk.text || ""}
                              onChange={e => updateBlock(idx, { ...blk, text: e.target.value })}
                              placeholder="Write concluding takeaways and exam advice (English or Hindi)..."
                              className="w-full p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-900 dark:text-white leading-relaxed focus:ring-2 focus:ring-purple-500/20"
                            />
                          </div>
                        )}

                        {/* 2. PARAGRAPH BLOCK */}
                        {blk.type === "paragraph" && (
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between text-[10px] font-bold text-slate-500 uppercase">
                              <span>Paragraph Content (Supports Markdown **bold** and *italic*)</span>
                              <span>{(blk.text || "").length} characters</span>
                            </div>
                            <textarea
                              rows={4}
                              value={blk.text || ""}
                              onChange={e => updateBlock(idx, { ...blk, text: e.target.value })}
                              placeholder="Write paragraph text (English or Hindi)..."
                              className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-900 dark:text-white leading-relaxed focus:ring-2 focus:ring-blue-500/20"
                            />
                          </div>
                        )}

                        {/* 3. KEY POINTS / HIGHLIGHTS BLOCK */}
                        {blk.type === "key_points" && (
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <label className="text-[10px] font-black uppercase text-emerald-600 tracking-wider">
                                Key Takeaways (Highlights with Green Checkmarks)
                              </label>
                              <button
                                type="button"
                                onClick={() => {
                                  const updated = [...(blk.listItems || []), "New key point..."];
                                  updateBlock(idx, { ...blk, listItems: updated });
                                }}
                                className="text-[10px] font-bold text-emerald-600 hover:underline cursor-pointer flex items-center gap-0.5"
                              >
                                <Plus className="w-3 h-3" />
                                <span>Add Point</span>
                              </button>
                            </div>

                            <div className="space-y-2">
                              {(blk.listItems || []).map((point, pIdx) => (
                                <div key={pIdx} className="flex items-center gap-2">
                                  <span className="w-5 h-5 rounded-full bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0">
                                    <Check className="w-3 h-3" />
                                  </span>
                                  <input
                                    type="text"
                                    value={point}
                                    onChange={e => {
                                      const updated = [...(blk.listItems || [])];
                                      updated[pIdx] = e.target.value;
                                      updateBlock(idx, { ...blk, listItems: updated });
                                    }}
                                    className="flex-1 px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-900 dark:text-white"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const updated = (blk.listItems || []).filter((_, i) => i !== pIdx);
                                      updateBlock(idx, { ...blk, listItems: updated });
                                    }}
                                    className="p-1.5 text-slate-400 hover:text-rose-500 cursor-pointer"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              ))}
                            </div>

                            {/* Multi-line paste helper for bullets */}
                            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                              <span className="text-[10px] text-slate-400">
                                Want to paste multiple points at once?
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  const pasted = prompt("Paste multiple bullet lines here (one per line):");
                                  if (pasted) {
                                    const lines = pasted
                                      .split("\n")
                                      .map(l => l.replace(/^(\*|-|•|\d+\.)\s+/, "").trim())
                                      .filter(Boolean);
                                    updateBlock(idx, { ...blk, listItems: [...(blk.listItems || []), ...lines] });
                                  }
                                }}
                                className="text-[10px] font-bold text-[#1E5BF0] hover:underline cursor-pointer"
                              >
                                Paste Multi-Line Points
                              </button>
                            </div>
                          </div>
                        )}

                        {/* 4. CALLOUT / ALERT BLOCK */}
                        {blk.type === "callout" && (
                          <div className="space-y-2.5">
                            <div className="flex flex-wrap items-center gap-2">
                              <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider">
                                Alert Type:
                              </label>
                              <div className="flex flex-wrap gap-1.5">
                                {[
                                  { type: "important", label: "⚠️ Urgent Alert (Red)", color: "text-rose-600 bg-rose-50 border-rose-200" },
                                  { type: "warning", label: "📅 Date / Schedule (Amber)", color: "text-amber-600 bg-amber-50 border-amber-200" },
                                  { type: "tip", label: "💡 Pro Tip (Emerald)", color: "text-emerald-600 bg-emerald-50 border-emerald-200" },
                                  { type: "info", label: "ℹ️ Official Notice (Blue)", color: "text-blue-600 bg-blue-50 border-blue-200" },
                                ].map(option => (
                                  <button
                                    key={option.type}
                                    type="button"
                                    onClick={() =>
                                      updateBlock(idx, {
                                        ...blk,
                                        calloutType: option.type as any,
                                      })
                                    }
                                    className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                                      (blk.calloutType || "info") === option.type
                                        ? "ring-2 ring-blue-500 " + option.color
                                        : "bg-slate-50 text-slate-600 border-slate-200"
                                    }`}
                                  >
                                    {option.label}
                                  </button>
                                ))}
                              </div>
                            </div>

                            <textarea
                              rows={3}
                              value={blk.text || ""}
                              onChange={e => updateBlock(idx, { ...blk, text: e.target.value })}
                              placeholder="Write notice or alert message here..."
                              className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white"
                            />
                          </div>
                        )}

                        {/* 5. DATA TABLE BLOCK */}
                        {blk.type === "table" && (
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <label className="text-[10px] font-black uppercase text-cyan-600 tracking-wider">
                                  Data Table ({blk.tableHeaders?.length || 0} cols × {blk.tableRows?.length || 0} rows)
                                </label>
                              </div>

                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => {
                                    const pasted = prompt("Paste TSV / CSV / Tab-delimited spreadsheet data here:");
                                    if (pasted) {
                                      const lines = pasted.trim().split("\n").filter(Boolean);
                                      const delim = lines[0].includes("\t") ? "\t" : ",";
                                      const rows = lines.map(l => l.split(delim).map(c => c.trim()));
                                      if (rows.length >= 1) {
                                        const headers = rows[0];
                                        const body = rows.slice(1);
                                        updateBlock(idx, {
                                          ...blk,
                                          tableHeaders: headers,
                                          tableRows: body.map(cells => ({ cells })),
                                        });
                                      }
                                    }
                                  }}
                                  className="text-[10px] font-bold text-cyan-600 dark:text-cyan-400 hover:underline cursor-pointer flex items-center gap-1"
                                >
                                  <FileSpreadsheet className="w-3.5 h-3.5" />
                                  <span>Paste Spreadsheet (TSV/CSV)</span>
                                </button>
                                <span className="text-slate-300">·</span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const colName = prompt("Enter new column name:", "Status");
                                    if (colName) {
                                      const headers = [...(blk.tableHeaders || []), colName];
                                      const rows = (blk.tableRows || []).map(r => ({
                                        cells: [...r.cells, "-"],
                                      }));
                                      updateBlock(idx, { ...blk, tableHeaders: headers, tableRows: rows });
                                    }
                                  }}
                                  className="text-[10px] font-bold text-blue-600 hover:underline cursor-pointer"
                                >
                                  + Column
                                </button>
                                <span className="text-slate-300">·</span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const colCount = blk.tableHeaders?.length || 2;
                                    const newRow = { cells: new Array(colCount).fill("Detail") };
                                    updateBlock(idx, {
                                      ...blk,
                                      tableRows: [...(blk.tableRows || []), newRow],
                                    });
                                  }}
                                  className="text-[10px] font-bold text-blue-600 hover:underline cursor-pointer"
                                >
                                  + Row
                                </button>
                              </div>
                            </div>

                            {/* Table Editor Grid */}
                            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700 max-h-72">
                              <table className="w-full text-left text-xs border-collapse">
                                <thead className="bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-black">
                                  <tr>
                                    {(blk.tableHeaders || []).map((h, hIdx) => (
                                      <th key={hIdx} className="p-2 border-b border-r border-slate-200 dark:border-slate-700">
                                        <input
                                          type="text"
                                          value={h}
                                          onChange={e => {
                                            const updated = [...(blk.tableHeaders || [])];
                                            updated[hIdx] = e.target.value;
                                            updateBlock(idx, { ...blk, tableHeaders: updated });
                                          }}
                                          className="w-full bg-transparent font-black text-xs text-slate-900 dark:text-white border-b border-transparent focus:border-blue-500"
                                        />
                                      </th>
                                    ))}
                                    <th className="p-2 w-8"></th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {(blk.tableRows || []).map((row, rIdx) => (
                                    <tr key={rIdx} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50/50">
                                      {row.cells.map((cell, cIdx) => (
                                        <td key={cIdx} className="p-2 border-r border-slate-100 dark:border-slate-800">
                                          <input
                                            type="text"
                                            value={cell}
                                            onChange={e => {
                                              const rows = JSON.parse(JSON.stringify(blk.tableRows || []));
                                              rows[rIdx].cells[cIdx] = e.target.value;
                                              updateBlock(idx, { ...blk, tableRows: rows });
                                            }}
                                            className="w-full bg-transparent text-xs font-medium text-slate-800 dark:text-slate-200"
                                          />
                                        </td>
                                      ))}
                                      <td className="p-1 text-center">
                                        <button
                                          type="button"
                                          onClick={() => {
                                            const rows = (blk.tableRows || []).filter((_, i) => i !== rIdx);
                                            updateBlock(idx, { ...blk, tableRows: rows });
                                          }}
                                          className="p-1 text-slate-300 hover:text-rose-500 cursor-pointer"
                                          title="Delete row"
                                        >
                                          <Trash2 className="w-3 h-3" />
                                        </button>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}

                        {/* 6. FAQ ACCORDION BLOCK (Rich Schema Support) */}
                        {blk.type === "faq" && (
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <label className="text-[10px] font-black uppercase text-purple-600 tracking-wider">
                                FAQ Items (Generates Google FAQPage Schema automatically)
                              </label>
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => {
                                    const pasted = prompt("Paste FAQs (e.g. Q: Question? A: Answer):");
                                    if (pasted) {
                                      const lines = pasted.split("\n").filter(Boolean);
                                      const faqs: FAQItem[] = [];
                                      let q = "";
                                      let a = "";
                                      lines.forEach(l => {
                                        if (/^q[:.]/i.test(l) || l.endsWith("?")) {
                                          if (q) faqs.push({ question: q, answer: a || "Details..." });
                                          q = l.replace(/^q[:.]/i, "").trim();
                                          a = "";
                                        } else if (/^a[:.]/i.test(l)) {
                                          a = l.replace(/^a[:.]/i, "").trim();
                                        } else if (q) {
                                          a += " " + l;
                                        }
                                      });
                                      if (q) faqs.push({ question: q, answer: a || "Details..." });
                                      updateBlock(idx, { ...blk, faqs: [...(blk.faqs || []), ...faqs] });
                                    }
                                  }}
                                  className="text-[10px] font-bold text-purple-600 hover:underline cursor-pointer"
                                >
                                  Paste Q&amp;A
                                </button>
                                <span className="text-slate-300">·</span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const updated = [
                                      ...(blk.faqs || []),
                                      { question: "New Question?", answer: "Clear answer for students..." },
                                    ];
                                    updateBlock(idx, { ...blk, faqs: updated });
                                  }}
                                  className="text-[10px] font-bold text-purple-600 hover:underline cursor-pointer flex items-center gap-0.5"
                                >
                                  <Plus className="w-3 h-3" />
                                  <span>Add FAQ Item</span>
                                </button>
                              </div>
                            </div>

                            <div className="space-y-2.5">
                              {(blk.faqs || []).map((faq, fIdx) => (
                                <div
                                  key={fIdx}
                                  className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700 space-y-2"
                                >
                                  <div className="flex items-center gap-2">
                                    <span className="w-5 h-5 rounded-md bg-purple-500/10 text-purple-600 text-xs font-black flex items-center justify-center shrink-0">
                                      Q
                                    </span>
                                    <input
                                      type="text"
                                      value={faq.question}
                                      onChange={e => {
                                        const updated = JSON.parse(JSON.stringify(blk.faqs || []));
                                        updated[fIdx].question = e.target.value;
                                        updateBlock(idx, { ...blk, faqs: updated });
                                      }}
                                      placeholder="Question?"
                                      className="flex-1 px-2.5 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold text-slate-900 dark:text-white"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const updated = (blk.faqs || []).filter((_, i) => i !== fIdx);
                                        updateBlock(idx, { ...blk, faqs: updated });
                                      }}
                                      className="p-1 text-slate-400 hover:text-rose-500 cursor-pointer"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                  <div className="flex items-start gap-2">
                                    <span className="w-5 h-5 rounded-md bg-slate-200 dark:bg-slate-700 text-slate-500 text-xs font-black flex items-center justify-center shrink-0 mt-1">
                                      A
                                    </span>
                                    <textarea
                                      rows={2}
                                      value={faq.answer}
                                      onChange={e => {
                                        const updated = JSON.parse(JSON.stringify(blk.faqs || []));
                                        updated[fIdx].answer = e.target.value;
                                        updateBlock(idx, { ...blk, faqs: updated });
                                      }}
                                      placeholder="Answer details..."
                                      className="flex-1 p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-medium text-slate-800 dark:text-slate-200"
                                    />
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* 7. STEP-BY-STEP LIST BLOCK */}
                        {blk.type === "list" && (
                          <div className="space-y-2.5">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <label className="text-[10px] font-black uppercase text-indigo-600 tracking-wider">
                                  Step Guide / List
                                </label>
                                <select
                                  value={blk.listType || "numbered"}
                                  onChange={e =>
                                    updateBlock(idx, {
                                      ...blk,
                                      listType: e.target.value as any,
                                    })
                                  }
                                  className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-slate-100 dark:bg-slate-800 border"
                                >
                                  <option value="numbered">1. 2. 3. Numbered Steps</option>
                                  <option value="bullet">• Bullet List</option>
                                </select>
                              </div>

                              <button
                                type="button"
                                onClick={() => {
                                  const updated = [...(blk.listItems || []), "Next step..."];
                                  updateBlock(idx, { ...blk, listItems: updated });
                                }}
                                className="text-[10px] font-bold text-indigo-600 hover:underline cursor-pointer flex items-center gap-0.5"
                              >
                                <Plus className="w-3 h-3" />
                                <span>Add Step</span>
                              </button>
                            </div>

                            <div className="space-y-1.5">
                              {(blk.listItems || []).map((item, lIdx) => (
                                <div key={lIdx} className="flex items-center gap-2">
                                  <span className="w-5 h-5 rounded-md bg-indigo-500/10 text-indigo-600 text-[10px] font-bold flex items-center justify-center shrink-0">
                                    {blk.listType === "bullet" ? "•" : lIdx + 1}
                                  </span>
                                  <input
                                    type="text"
                                    value={item}
                                    onChange={e => {
                                      const updated = [...(blk.listItems || [])];
                                      updated[lIdx] = e.target.value;
                                      updateBlock(idx, { ...blk, listItems: updated });
                                    }}
                                    className="flex-1 px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-900 dark:text-white"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const updated = (blk.listItems || []).filter((_, i) => i !== lIdx);
                                      updateBlock(idx, { ...blk, listItems: updated });
                                    }}
                                    className="p-1.5 text-slate-400 hover:text-rose-500 cursor-pointer"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* 8. IMAGE BLOCK WITH SEO ALT TAG */}
                        {blk.type === "image" && (
                          <div className="space-y-2.5">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                              <div className="space-y-1">
                                <div className="flex items-center justify-between">
                                  <label className="text-[10px] font-bold uppercase text-slate-500">
                                    Image URL (HTTPS)
                                  </label>
                                  {blk.imageUrl && (
                                    <button
                                      type="button"
                                      onClick={() => updateBlock(idx, { ...blk, imageUrl: "" })}
                                      className="text-[10px] font-bold text-rose-600 dark:text-rose-400 hover:underline cursor-pointer"
                                    >
                                      Remove Image
                                    </button>
                                  )}
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <input
                                    type="url"
                                    value={blk.imageUrl || ""}
                                    onChange={e => updateBlock(idx, { ...blk, imageUrl: e.target.value })}
                                    placeholder="https://images.unsplash.com/... or upload"
                                    className="flex-1 px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-900 dark:text-white"
                                  />
                                  <label className="px-2.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold cursor-pointer transition-colors flex items-center gap-1 shrink-0">
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
                                            if (ev.target?.result) {
                                              updateBlock(idx, { ...blk, imageUrl: ev.target.result as string });
                                            }
                                          };
                                          reader.readAsDataURL(file);
                                        }
                                      }}
                                    />
                                  </label>
                                </div>
                              </div>
                              <div className="space-y-1">
                                <label className="text-[10px] font-bold uppercase text-slate-500">
                                  SEO Alt Tag (Crucial for Google Image Search) *
                                </label>
                                <input
                                  type="text"
                                  value={blk.imageAlt || ""}
                                  onChange={e => updateBlock(idx, { ...blk, imageAlt: e.target.value })}
                                  placeholder="Describe the image content for SEO..."
                                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-900 dark:text-white"
                                />
                              </div>
                            </div>
                            <div className="space-y-1">
                              <label className="text-[10px] font-bold uppercase text-slate-500">
                                Caption (Visible under image)
                              </label>
                              <input
                                type="text"
                                value={blk.imageCaption || ""}
                                onChange={e => updateBlock(idx, { ...blk, imageCaption: e.target.value })}
                                placeholder="e.g. Official RPSC vacancy notification snapshot..."
                                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-900 dark:text-white"
                              />
                            </div>
                            {blk.imageUrl && (
                              <div className="w-full h-32 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 relative group">
                                <img
                                  src={blk.imageUrl}
                                  alt={blk.imageAlt || "Preview"}
                                  className="w-full h-full object-cover"
                                  onError={e => {
                                    (e.target as any).style.display = "none";
                                  }}
                                />
                                <button
                                  type="button"
                                  onClick={() => updateBlock(idx, { ...blk, imageUrl: "" })}
                                  className="absolute top-2 right-2 px-2.5 py-1 bg-rose-600/90 hover:bg-rose-700 text-white text-[10px] font-bold rounded-lg shadow-xs cursor-pointer"
                                >
                                  Remove Image
                                </button>
                              </div>
                            )}
                          </div>
                        )}

                        {/* 9. CTA / OFFICIAL LINK BLOCK */}
                        {blk.type === "cta" && (
                          <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase text-blue-600 tracking-wider">
                              Official Resource / Practice Test CTA Button
                            </label>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                              <input
                                type="text"
                                value={blk.ctaText || ""}
                                onChange={e => updateBlock(idx, { ...blk, ctaText: e.target.value })}
                                placeholder="Button Text (e.g. Download Notification PDF / Practice MCQs)"
                                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white"
                              />
                              <input
                                type="text"
                                value={blk.ctaUrl || ""}
                                onChange={e => updateBlock(idx, { ...blk, ctaUrl: e.target.value })}
                                placeholder="Link URL (e.g. https://rpsc.rajasthan.gov.in or /topics)"
                                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-900 dark:text-white"
                              />
                            </div>
                          </div>
                        )}

                        {/* 10. QUOTE BLOCK */}
                        {blk.type === "quote" && (
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-bold uppercase text-slate-500">
                              Quote / Strategy Highlight
                            </label>
                            <textarea
                              rows={2}
                              value={blk.text || ""}
                              onChange={e => updateBlock(idx, { ...blk, text: e.target.value })}
                              placeholder="An inspiring quote or strategic principle..."
                              className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium italic text-slate-900 dark:text-white"
                            />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ─────────────────────────────────────────────────────────────
            TAB 2: SEO & SETTINGS (ArticleSEOControlPanel)
        ───────────────────────────────────────────────────────────── */}
        {editorTab === "seo" && (
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
            <ArticleSEOControlPanel
              article={article}
              onChange={updated => setArticle(prev => ({ ...prev, ...updated }))}
              onAiOptimize={handleAiOptimizeSeo}
              aiLoading={aiGenerating}
            />
          </div>
        )}

        {/* ─────────────────────────────────────────────────────────────
            TAB 3: LIVE PREVIEW (DESKTOP VS MOBILE SWITCHER)
        ───────────────────────────────────────────────────────────── */}
        {editorTab === "preview" && (
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
            <div className="flex items-center justify-between p-2.5 rounded-2xl bg-slate-100 dark:bg-slate-900">
              <span className="text-xs font-bold text-slate-500">Live Device Simulation</span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setPreviewDevice("mobile")}
                  className={`px-3 py-1 rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer transition-all ${
                    previewDevice === "mobile"
                      ? "bg-white dark:bg-slate-800 text-blue-600 shadow-xs"
                      : "text-slate-500"
                  }`}
                >
                  <Smartphone className="w-3.5 h-3.5" />
                  <span>Mobile View</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewDevice("desktop")}
                  className={`px-3 py-1 rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer transition-all ${
                    previewDevice === "desktop"
                      ? "bg-white dark:bg-slate-800 text-blue-600 shadow-xs"
                      : "text-slate-500"
                  }`}
                >
                  <Monitor className="w-3.5 h-3.5" />
                  <span>Desktop View</span>
                </button>
              </div>
            </div>

            {/* Simulated Frame */}
            <div
              className={`mx-auto bg-white dark:bg-[#0D1524] border border-slate-200 dark:border-slate-800 rounded-3xl p-4 sm:p-6 shadow-sm overflow-y-auto transition-all ${
                previewDevice === "mobile" ? "max-w-sm min-h-[500px]" : "w-full min-h-[500px]"
              }`}
            >
              <div className="space-y-4 text-slate-900 dark:text-slate-100">
                <div className="flex items-center gap-2 text-xs font-black uppercase text-blue-600 dark:text-blue-400">
                  <span>{article.category}</span>
                  <span>·</span>
                  <span>
                    {new Date(article.publishedAt || article.createdAt || Date.now()).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </span>
                </div>

                <h1 className="text-xl sm:text-3xl font-black font-hindi leading-snug">
                  {article.title || "Untitled Article"}
                </h1>
                {article.hindiTitle && (
                  <h2 className="text-sm sm:text-base font-bold text-slate-500 font-hindi">
                    {article.hindiTitle}
                  </h2>
                )}

                {/* Rendered Preview Blocks */}
                <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                  {(article.blocks || []).map((blk, i) => (
                    <div key={i}>
                      {blk.type === "heading" && blk.level === 3 ? (
                        <h3 className="text-base sm:text-lg font-black text-blue-600 dark:text-blue-400 mt-4 mb-2 font-hindi">
                          {blk.text}
                        </h3>
                      ) : blk.type === "heading" ? (
                        <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white mt-6 mb-3 pt-3 border-t border-slate-100 dark:border-slate-800 font-hindi">
                          {blk.text}
                        </h2>
                      ) : blk.type === "paragraph" ? (
                        <p className="text-sm sm:text-base text-slate-700 dark:text-slate-300 font-hindi leading-relaxed">
                          {blk.text}
                        </p>
                      ) : blk.type === "key_points" ? (
                        <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 space-y-2">
                          <span className="text-[10px] font-black text-emerald-800 dark:text-emerald-300 uppercase tracking-wider flex items-center gap-1.5">
                            <CheckSquare className="w-3.5 h-3.5" />
                            <span>Key Takeaways</span>
                          </span>
                          <ul className="space-y-1.5 pl-1 text-xs sm:text-sm font-bold text-emerald-950 dark:text-emerald-100 font-hindi">
                            {(blk.listItems || []).map((pt, pIdx) => (
                              <li key={pIdx} className="flex items-start gap-2">
                                <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                                <span>{pt}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : blk.type === "callout" ? (
                        <ArticleCalloutBox
                          variant={blk.calloutType || "info"}
                          text={blk.text}
                          className="my-2"
                        />
                      ) : blk.type === "table" ? (
                        <ArticleTable
                          headers={blk.tableHeaders}
                          rows={blk.tableRows || []}
                          alignments={blk.tableAlignments}
                          caption={blk.tableCaption}
                        />
                      ) : blk.type === "faq" ? (
                        <div className="space-y-2">
                          <div className="text-xs font-black uppercase tracking-wider text-purple-600 flex items-center gap-1.5">
                            <HelpCircle className="w-4 h-4" />
                            <span>Frequently Asked Questions</span>
                          </div>
                          <div className="space-y-2">
                            {(blk.faqs || []).map((faq, fIdx) => (
                              <div
                                key={fIdx}
                                className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900"
                              >
                                <div className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white flex items-center gap-2">
                                  <span className="w-4 h-4 rounded bg-purple-500/10 text-purple-600 text-[10px] flex items-center justify-center font-bold">
                                    Q
                                  </span>
                                  <span>{faq.question}</span>
                                </div>
                                <div className="mt-1.5 pl-6 text-xs text-slate-600 dark:text-slate-300 font-medium font-hindi leading-relaxed">
                                  {faq.answer}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : blk.type === "cta" ? (
                        <div className="p-5 rounded-2xl bg-[#111B32] text-white flex flex-col sm:flex-row items-center justify-between gap-3">
                          <div className="space-y-1 text-center sm:text-left">
                            <h4 className="text-sm font-black text-white">{blk.ctaText}</h4>
                            <p className="text-[11px] text-slate-300">Official Resource &amp; Quiz link</p>
                          </div>
                          <button
                            type="button"
                            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold shrink-0"
                          >
                            Explore Now →
                          </button>
                        </div>
                      ) : blk.type === "pdf_download" ? (
                        <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/40 flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-rose-500/10 text-rose-600 flex items-center justify-center shrink-0">
                              <FileDown className="w-5 h-5" />
                            </div>
                            <div>
                              <span className="text-[9px] font-black uppercase text-rose-600 tracking-wider">
                                {blk.pdfBadge || "Official PDF"} • {blk.pdfFileSize || "Document"}
                              </span>
                              <h4 className="text-xs sm:text-sm font-black font-hindi text-slate-900 dark:text-white">
                                {blk.pdfTitle}
                              </h4>
                            </div>
                          </div>
                          <span className="px-3 py-1.5 rounded-xl bg-rose-600 text-white font-bold text-xs shrink-0">
                            {blk.pdfButtonText || "Download"}
                          </span>
                        </div>
                      ) : blk.type === "book_course" ? (
                        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-900/40 flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3">
                            {blk.itemImageUrl && (
                              <img src={blk.itemImageUrl} alt="" className="w-12 h-16 object-contain rounded-lg bg-slate-100 dark:bg-slate-800" />
                            )}
                            <div>
                              <span className="text-[9px] font-black uppercase text-indigo-600 tracking-wider">
                                {blk.itemBadge || "Recommended"}
                              </span>
                              <h4 className="text-xs sm:text-sm font-black font-hindi text-slate-900 dark:text-white">
                                {blk.itemTitle}
                              </h4>
                              {blk.itemPrice && (
                                <span className="text-xs font-bold text-emerald-600">{blk.itemPrice}</span>
                              )}
                            </div>
                          </div>
                          <span className="px-3 py-1.5 rounded-xl bg-indigo-600 text-white font-bold text-xs shrink-0">
                            {blk.itemButtonText || "View Details"}
                          </span>
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ─────────────────────────────────────────────────────────────
            MODAL BOTTOM ACTION CONTROLS (STICKY ERGONOMIC BAR)
        ───────────────────────────────────────────────────────────── */}
        <div className="p-3.5 sm:p-5 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-[#111A2E] flex items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold cursor-pointer transition-all"
          >
            Cancel
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setEditorTab(editorTab === "preview" ? "blocks" : "preview")}
              className="px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold cursor-pointer transition-all flex items-center gap-1.5"
            >
              <Eye className="w-4 h-4 text-slate-500" />
              <span className="hidden sm:inline">
                {editorTab === "preview" ? "Back to Blocks" : "Quick Preview"}
              </span>
            </button>

            <button
              type="button"
              onClick={() => handleFinalSave("draft")}
              disabled={actionLoading === "save"}
              className="px-3.5 sm:px-4 py-2.5 border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold cursor-pointer transition-all disabled:opacity-50"
            >
              Save as Draft
            </button>

            <button
              type="button"
              onClick={() => handleFinalSave("published")}
              disabled={actionLoading === "save"}
              className="px-5 sm:px-6 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl text-xs font-black flex items-center gap-2 shadow-md transition-all active:scale-95 cursor-pointer disabled:opacity-50"
            >
              {actionLoading === "save" ? (
                <>
                  <Clock className="w-4 h-4 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>Save &amp; Publish Article</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      <AutoLinkRulesManagerModal
        isOpen={isRulesManagerOpen}
        onClose={() => setIsRulesManagerOpen(false)}
      />
    </div>
  );
};
