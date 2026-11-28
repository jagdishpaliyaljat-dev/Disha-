import React, { useState, useMemo, useEffect, useRef } from "react";
import { Chapter, ProgressStore, Subject, PYQPaper, LiveTest } from "../types";
import {
  X,
  Printer,
  Eye,
  Layers,
  ArrowLeft,
  Sliders,
  Check,
  FileText,
  FileCheck,
  FileCode,
  FileQuestion,
  CheckCircle2,
  Download,
  Loader2,
  AlertTriangle,
  ZoomIn,
  ZoomOut,
  Hash,
  Lock,
  Sparkles,
  ChevronDown,
  ChevronUp,
  BookOpen,
  Bookmark,
  XCircle,
} from "lucide-react";
import {
  PDFFormatCard,
  ContentSourceType,
  PDFExportOptions,
  PDFGenerationProgress,
  filterQuestionsForExport,
  generateDisha2020PDFHTML,
  generateAndDownloadPDF,
  openQuestionBankInNewTab,
  downloadJSON,
} from "../utils/pdfGenerator";
import { loadLocalPYQPapers, fetchPYQPapers, INITIAL_PYQ_PAPERS } from "../utils/pyqStorage";
import { loadLocalLiveTests, fetchLiveTests, INITIAL_LIVE_TESTS } from "../utils/liveTestStorage";
import {
  getSubjectDisplayName,
  getChapterDisplayName,
  getTopicDisplayName,
} from "../utils/curriculumUtils";
import {
  usePdfConfig,
  getTodayPDFDownloadCount,
  incrementTodayPDFDownloadCount,
} from "../utils/pdfConfigService";
import { loadUserProfile, isUserAdmin } from "../utils/userProfileStorage";

interface PDFExportModalProps {
  subjects: Subject[];
  chapters: Chapter[];
  progressStore: ProgressStore;
  initialSubjectId?: string | null;
  initialChapterId?: string | null;
  initialTopicId?: string | null;
  initialFilterType?: "all" | "wrong" | "bookmarked";
  onClose: () => void;
}

export const PDFExportModal: React.FC<PDFExportModalProps> = ({
  subjects,
  chapters,
  progressStore,
  initialSubjectId,
  initialChapterId,
  initialTopicId,
  initialFilterType = "all",
  onClose,
}) => {
  const { config: pdfConfig } = usePdfConfig();
  const userProfile = useMemo(() => loadUserProfile(), []);
  const isVipOrAdmin = Boolean(userProfile?.isPremium || isUserAdmin(userProfile));
  const isLoggedIn = Boolean(userProfile?.email);

  const [activeTab, setActiveTab] = useState<"config" | "preview">("config");
  const [pyqPapers, setPyqPapers] = useState<PYQPaper[]>(INITIAL_PYQ_PAPERS);
  const [liveTests, setLiveTests] = useState<LiveTest[]>(INITIAL_LIVE_TESTS);

  useEffect(() => {
    async function loadData() {
      try {
        const localPYQs = loadLocalPYQPapers();
        if (localPYQs?.length) setPyqPapers(localPYQs);
        const remotePYQs = await fetchPYQPapers();
        if (remotePYQs?.length) setPyqPapers(remotePYQs);

        const localLive = loadLocalLiveTests();
        if (localLive?.length) setLiveTests(localLive);
        const remoteLive = await fetchLiveTests();
        if (remoteLive?.length) setLiveTests(remoteLive);
      } catch {}
    }
    loadData();
  }, []);

  // 1. Clean 5-mode Content Source
  const initialSource: ContentSourceType =
    initialFilterType === "wrong"
      ? "wrong_review"
      : initialFilterType === "bookmarked"
      ? "bookmarked"
      : initialTopicId
      ? "topic"
      : initialChapterId
      ? "chapter"
      : "subject";

  const [contentType, setContentType] = useState<ContentSourceType>(initialSource);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | "all">(initialSubjectId || "all");
  const [selectedChapterId, setSelectedChapterId] = useState<string | "all">(initialChapterId || "all");
  const [selectedTopicId, setSelectedTopicId] = useState<string | "all">(initialTopicId || "all");
  const [selectedPYQId, setSelectedPYQId] = useState<string>(pyqPapers[0]?.id || "");
  const [selectedTestId, setSelectedTestId] = useState<string>(liveTests[0]?.id || "");

  // Derive filterType automatically from contentType
  const filterType: "all" | "wrong" | "bookmarked" =
    contentType === "wrong_practice" || contentType === "wrong_review"
      ? "wrong"
      : contentType === "bookmarked"
      ? "bookmarked"
      : "all";

  // 2. Question Limit & Range (respecting Admin maxQuestionsFree)
  const [questionLimit, setQuestionLimit] = useState<number | "all">("all");
  const [useCustomRange, setUseCustomRange] = useState(false);
  const [customRangeStart, setCustomRangeStart] = useState<number>(1);
  const [customRangeEnd, setCustomRangeEnd] = useState<number>(25);

  const effectiveMaxQuestions =
    !isVipOrAdmin && pdfConfig.maxQuestionsFree > 0 ? pdfConfig.maxQuestionsFree : 0;

  // 3. PDF Format (auto-pick first enabled format from Admin config)
  const enabledFormats = useMemo(() => {
    const list: PDFFormatCard[] = [];
    if (pdfConfig.allowedFormats.question_paper) list.push("question_paper");
    if (pdfConfig.allowedFormats.question_paper_omr) list.push("question_paper_omr");
    if (pdfConfig.allowedFormats.answer_key) list.push("answer_key");
    if (pdfConfig.allowedFormats.detailed_solutions) list.push("detailed_solutions");
    if (pdfConfig.allowJsonExport) list.push("json");
    return list.length > 0 ? list : (["question_paper"] as PDFFormatCard[]);
  }, [pdfConfig]);

  const [formatCard, setFormatCard] = useState<PDFFormatCard>(enabledFormats[0]);

  useEffect(() => {
    if (!enabledFormats.includes(formatCard)) {
      setFormatCard(enabledFormats[0]);
    }
  }, [enabledFormats, formatCard]);

  // 4. Document Settings (default to Book 2-Column layout & Admin default Color Mode)
  const [layout, setLayout] = useState<"single" | "compact">("compact");
  const [fontSize, setFontSize] = useState<"normal" | "large">("normal");
  const [colorMode, setColorMode] = useState<"color" | "bw">(() => pdfConfig.defaultColorMode || "color");
  const [includeCoverPage, setIncludeCoverPage] = useState(true);
  const [showPageNumbers, setShowPageNumbers] = useState(true);
  const [includeTestInstructions, setIncludeTestInstructions] = useState(true);
  const [showPersonalize, setShowPersonalize] = useState(false);
  const [studentName, setStudentName] = useState(userProfile?.name && userProfile?.email ? userProfile.name : "");
  const [rollNumber, setRollNumber] = useState("");
  const [customTitle, setCustomTitle] = useState("");

  // Preview & Generation States (Mobile-friendly Fit-to-Screen scaling)
  const [previewZoom, setPreviewZoom] = useState<number>(100);
  const previewContainerRef = useRef<HTMLDivElement>(null);
  const previewIframeRef = useRef<HTMLIFrameElement>(null);
  const [previewContainerWidth, setPreviewContainerWidth] = useState<number>(
    typeof window !== "undefined" ? Math.min(window.innerWidth, 768) : 360
  );
  const [previewDocHeight, setPreviewDocHeight] = useState<number>(1120);

  useEffect(() => {
    if (activeTab !== "preview") return;
    const el = previewContainerRef.current;
    if (!el) return;
    const updateWidth = () => {
      if (el.clientWidth > 0) setPreviewContainerWidth(el.clientWidth);
    };
    updateWidth();
    if (typeof ResizeObserver !== "undefined") {
      const ro = new ResizeObserver(updateWidth);
      ro.observe(el);
      return () => ro.disconnect();
    }
  }, [activeTab]);

  const fitScale = useMemo(() => {
    const naturalPagePx = 740;
    return Math.min(1, Math.max(0.32, (previewContainerWidth - 16) / naturalPagePx));
  }, [previewContainerWidth]);

  const effectiveScale = useMemo(() => {
    return (fitScale * previewZoom) / 100;
  }, [fitScale, previewZoom]);

  const handlePreviewIframeLoad = () => {
    try {
      const doc = previewIframeRef.current?.contentDocument;
      if (doc?.documentElement) {
        const h = Math.max(doc.documentElement.scrollHeight, doc.body?.scrollHeight || 0, 1050);
        setPreviewDocHeight(h + 24);
      }
    } catch {}
  };
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [pdfProgress, setPdfProgress] = useState<PDFGenerationProgress | null>(null);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [dailyDownloadsUsed, setDailyDownloadsUsed] = useState<number>(() => getTodayPDFDownloadCount());

  const availableChapters = useMemo(() => {
    if (selectedSubjectId === "all") return chapters;
    return chapters.filter((c) => c.subjectId === selectedSubjectId);
  }, [chapters, selectedSubjectId]);

  const availableTopics = useMemo(() => {
    if (selectedChapterId === "all") return [];
    const ch = chapters.find((c) => c.id === selectedChapterId);
    return ch ? ch.topics : [];
  }, [chapters, selectedChapterId]);

  // Apply Admin Free-tier question cap cleanly
  const resolvedLimit = useMemo(() => {
    if (effectiveMaxQuestions <= 0) return questionLimit;
    if (questionLimit === "all") return effectiveMaxQuestions;
    return Math.min(questionLimit, effectiveMaxQuestions);
  }, [questionLimit, effectiveMaxQuestions]);

  const exportOptions: PDFExportOptions = useMemo(
    () => ({
      contentType,
      subjectId: selectedSubjectId,
      chapterId: selectedChapterId,
      topicId: selectedTopicId,
      pyqId: selectedPYQId,
      testId: selectedTestId,
      filterType,
      format: formatCard,
      layout,
      fontSize,
      colorMode,
      questionLimit: resolvedLimit,
      customRangeStart: useCustomRange ? customRangeStart : undefined,
      customRangeEnd: useCustomRange
        ? effectiveMaxQuestions > 0
          ? Math.min(customRangeEnd, customRangeStart + effectiveMaxQuestions - 1)
          : customRangeEnd
        : undefined,
      shuffle: false,
      includeCoverPage,
      showPageNumbers,
      showHeaderFooter: pdfConfig.forceBranding ? true : true,
      includeTestInstructions,
      includeSubjectTopicNames: true,
      includeBlankAnswerSheet: formatCard === "question_paper_omr",
      customTitle:
        customTitle.trim() ||
        (pdfConfig.forceBranding && pdfConfig.brandTitle ? pdfConfig.brandTitle : undefined),
      studentName: studentName.trim() || undefined,
      rollNumber: rollNumber.trim() || undefined,
      instructionsText:
        pdfConfig.forceBranding && pdfConfig.watermarkText
          ? pdfConfig.watermarkText
          : undefined,
    }),
    [
      contentType,
      selectedSubjectId,
      selectedChapterId,
      selectedTopicId,
      selectedPYQId,
      selectedTestId,
      filterType,
      formatCard,
      layout,
      fontSize,
      resolvedLimit,
      useCustomRange,
      customRangeStart,
      customRangeEnd,
      effectiveMaxQuestions,
      includeCoverPage,
      showPageNumbers,
      includeTestInstructions,
      customTitle,
      studentName,
      rollNumber,
      pdfConfig,
    ]
  );

  const filteredResult = useMemo(() => {
    return filterQuestionsForExport(
      subjects,
      chapters,
      progressStore,
      exportOptions,
      pyqPapers,
      liveTests
    );
  }, [subjects, chapters, progressStore, exportOptions, pyqPapers, liveTests]);

  const generatedHTML = useMemo(() => {
    if (filteredResult.count === 0) return "";
    return generateDisha2020PDFHTML(filteredResult.questions, {
      subjectTitle: filteredResult.subjectTitle,
      chapterTitle: filteredResult.chapterTitle,
      topicTitle: filteredResult.topicTitle,
      testTitle: filteredResult.testTitle,
      examName: filteredResult.examName,
      examYear: filteredResult.examYear,
      filterType,
      format: formatCard,
      layout,
      fontSize,
      colorMode,
      includeCoverPage,
      showPageNumbers,
      showHeaderFooter: true,
      includeTestInstructions,
      includeSubjectTopicNames: true,
      includeBlankAnswerSheet: formatCard === "question_paper_omr",
      customTitle:
        customTitle.trim() ||
        (pdfConfig.forceBranding && pdfConfig.brandTitle ? pdfConfig.brandTitle : undefined),
      studentName: studentName.trim() || undefined,
      rollNumber: rollNumber.trim() || undefined,
      maxMarks: filteredResult.maxMarks,
      durationMinutes: filteredResult.durationMinutes,
      instructionsText: filteredResult.instructionsText,
      progressStore,
    });
  }, [
    filteredResult,
    filterType,
    formatCard,
    layout,
    fontSize,
    includeCoverPage,
    showPageNumbers,
    includeTestInstructions,
    customTitle,
    studentName,
    rollNumber,
    progressStore,
    pdfConfig,
  ]);

  // Access Guard Checks from Admin Policy
  const accessBlockReason = useMemo(() => {
    if (!pdfConfig.enabled) {
      return pdfConfig.disabledMessage || "PDF Downloads are currently paused by Admin.";
    }
    if (pdfConfig.accessTier === "vip_only" && !isVipOrAdmin) {
      return "PDF Downloads are currently enabled for Disha VIP members only.";
    }
    if (pdfConfig.accessTier === "login_required" && !isLoggedIn && !isVipOrAdmin) {
      return "Please sign in with your account to download PDFs.";
    }
    if (!isVipOrAdmin && pdfConfig.dailyQuotaFree > 0 && dailyDownloadsUsed >= pdfConfig.dailyQuotaFree) {
      return `Daily free limit reached (${dailyDownloadsUsed}/${pdfConfig.dailyQuotaFree} PDFs today). Upgrade to VIP for unlimited downloads.`;
    }
    return null;
  }, [pdfConfig, isVipOrAdmin, isLoggedIn, dailyDownloadsUsed]);

  const handleExport = async () => {
    if (accessBlockReason) {
      setToastMessage({ text: accessBlockReason, type: "error" });
      return;
    }

    if (formatCard === "json") {
      const cleanTitle = (filteredResult.testTitle || filteredResult.subjectTitle || "Disha_PYQ")
        .replace(/[^a-zA-Z0-9\u0900-\u097F]/g, "_");
      downloadJSON(filteredResult.questions, `Disha_PYQ_${cleanTitle}.json`);
      setDailyDownloadsUsed(incrementTodayPDFDownloadCount());
      setToastMessage({ text: "JSON exported successfully!", type: "success" });
      setTimeout(() => setToastMessage(null), 4000);
      return;
    }

    if (!generatedHTML || isGeneratingPDF) return;
    setIsGeneratingPDF(true);
    setToastMessage(null);

    const cleanTitle = (filteredResult.testTitle || filteredResult.subjectTitle || "Disha_PYQ_Paper")
      .replace(/[^a-zA-Z0-9\u0900-\u097F]/g, "_");
    const filename = `Disha_PYQ_${cleanTitle}_${formatCard}.pdf`;

    try {
      const success = await generateAndDownloadPDF(generatedHTML, filename, (p) => setPdfProgress(p));
      if (success) {
        setDailyDownloadsUsed(incrementTodayPDFDownloadCount());
        setToastMessage({ text: `${filename} downloaded successfully!`, type: "success" });
        setTimeout(() => setToastMessage(null), 4000);
      } else {
        setToastMessage({ text: "Could not save binary PDF. Use 'Print / Save' button.", type: "error" });
      }
    } catch {
      setToastMessage({ text: "PDF export error. Try 'Print / Save' instead.", type: "error" });
    } finally {
      setIsGeneratingPDF(false);
      setPdfProgress(null);
    }
  };

  const handleOpenNewTab = () => {
    if (!generatedHTML || accessBlockReason) return;
    openQuestionBankInNewTab(generatedHTML);
  };

  const sourceCards = [
    { id: "subject", label: "Syllabus", sub: "Subject / Topic", icon: BookOpen },
    { id: "pyq", label: "PYQ Papers", sub: "Official Exams", icon: FileText },
    { id: "mock_test", label: "Mock Tests", sub: "Test Series", icon: Layers },
    { id: "wrong_review", label: "Mistakes", sub: "Wrong Qs", icon: XCircle },
    { id: "bookmarked", label: "Bookmarks", sub: "Saved Qs", icon: Bookmark },
  ];

  const formatCards = [
    {
      id: "question_paper" as PDFFormatCard,
      title: "Question Paper",
      badge: "Practice",
      desc: "Clean questions & options for offline solving",
      icon: FileQuestion,
    },
    {
      id: "question_paper_omr" as PDFFormatCard,
      title: "Paper + OMR",
      badge: "Exam Mode",
      desc: "Questions with printable 5-option OMR sheet",
      icon: FileCode,
    },
    {
      id: "answer_key" as PDFFormatCard,
      title: "Answer Key",
      badge: "Quick Check",
      desc: "Questions with compact answer key grid",
      icon: FileCheck,
    },
    {
      id: "detailed_solutions" as PDFFormatCard,
      title: "With Solutions",
      badge: "Complete",
      desc: "Questions, answers & detailed explanations",
      icon: Sparkles,
    },
  ].filter((f) => enabledFormats.includes(f.id));

  return (
    <div
      id="pdf-export-modal-backdrop"
      className="fixed inset-0 z-60 bg-[#130E26]/80 backdrop-blur-xs flex flex-col sm:items-center sm:justify-center animate-in fade-in duration-200"
    >
      <div
        id="pdf-export-modal-dialog"
        className="w-full h-full sm:h-[92vh] sm:max-w-3xl bg-[#F8FAFC] dark:bg-[#130E26] sm:rounded-3xl border border-slate-200 dark:border-[#31275E] shadow-2xl flex flex-col overflow-hidden"
      >
        {/* TOP HEADER */}
        <header className="px-4 pt-[calc(0.75rem+env(safe-area-inset-top,0px))] pb-3 bg-gradient-to-r from-[#4A154B] via-[#7045D8] to-[#5B32BF] dark:from-[#1E1238] dark:via-[#2D1B54] dark:to-[#1B1536] text-white shrink-0 flex flex-col gap-3 border-b border-white/10">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <button
                id="btn-close-pdf-export"
                onClick={onClose}
                className="w-9 h-9 rounded-xl bg-white/15 hover:bg-white/25 active:scale-95 flex items-center justify-center transition-all cursor-pointer shrink-0 border border-white/15"
                aria-label="Close"
              >
                <ArrowLeft className="w-4.5 h-4.5 sm:hidden" />
                <X className="w-4.5 h-4.5 hidden sm:block" />
              </button>

              <div className="min-w-0">
                <h2 className="text-sm sm:text-base font-black tracking-tight text-white truncate">
                  Download Study PDF
                </h2>
                <p className="text-[11px] text-white/80 truncate">
                  {pdfConfig.brandTitle || "Disha PYQ"} • Printable Exam Sheet
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs font-extrabold tabular-nums text-white bg-white/15 border border-white/20 px-2.5 py-1 rounded-xl">
                {filteredResult.count} Qs
              </span>
            </div>
          </div>

          {/* 2-Tab Switcher */}
          <div className="flex bg-black/25 p-1 rounded-xl border border-white/10">
            <button
              id="tab-btn-config"
              onClick={() => setActiveTab("config")}
              className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                activeTab === "config"
                  ? "bg-white text-[#7045D8] shadow-xs font-black"
                  : "text-white/80 hover:text-white"
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>Customize PDF</span>
            </button>

            <button
              id="tab-btn-preview"
              onClick={() => setActiveTab("preview")}
              disabled={filteredResult.count === 0}
              className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                activeTab === "preview"
                  ? "bg-white text-[#7045D8] shadow-xs font-black"
                  : "text-white/80 hover:text-white disabled:opacity-40"
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Live Preview</span>
            </button>
          </div>
        </header>

        {/* Toast Alert */}
        {toastMessage && (
          <div
            className={`py-2 px-4 text-xs font-bold flex items-center justify-between shrink-0 ${
              toastMessage.type === "success" ? "bg-emerald-600 text-white" : "bg-rose-600 text-white"
            }`}
          >
            <div className="flex items-center gap-2">
              {toastMessage.type === "success" ? (
                <CheckCircle2 className="w-4 h-4 shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 shrink-0" />
              )}
              <span>{toastMessage.text}</span>
            </div>
            <button onClick={() => setToastMessage(null)} className="p-1 cursor-pointer">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Admin Restriction / Quota Notice */}
        {accessBlockReason && (
          <div className="m-4 p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 flex items-start gap-3">
            <Lock className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-extrabold text-rose-900 dark:text-rose-200">
                PDF Download Restricted
              </p>
              <p className="text-xs text-rose-700 dark:text-rose-300 mt-0.5">{accessBlockReason}</p>
            </div>
          </div>
        )}

        {/* BODY */}
        {activeTab === "config" ? (
          <div className="flex-1 overflow-y-auto overscroll-contain p-4 sm:p-5 space-y-5">
            {/* Free Tier Limits Pill (only if Admin set limits) */}
            {!isVipOrAdmin && (effectiveMaxQuestions > 0 || pdfConfig.dailyQuotaFree > 0) && (
              <div className="px-3.5 py-2 rounded-xl bg-[#7045D8]/10 border border-[#7045D8]/20 flex flex-wrap items-center justify-between gap-2 text-[11px] font-bold text-[#7045D8] dark:text-[#A78BFA]">
                <span>
                  {effectiveMaxQuestions > 0 && `Max ${effectiveMaxQuestions} Qs/PDF`}
                  {effectiveMaxQuestions > 0 && pdfConfig.dailyQuotaFree > 0 && " · "}
                  {pdfConfig.dailyQuotaFree > 0 &&
                    `Daily Quota: ${dailyDownloadsUsed}/${pdfConfig.dailyQuotaFree}`}
                </span>
                <span className="text-[10px] uppercase tracking-wider">Free Plan</span>
              </div>
            )}

            {/* STEP 1: CONTENT SOURCE */}
            <section className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-[#7045D8] dark:text-[#A78BFA] uppercase tracking-wider flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5" />
                  1. Select Content
                </span>
              </div>

              <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                {sourceCards.map((item) => {
                  const Icon = item.icon;
                  const isSelected =
                    item.id === "subject"
                      ? contentType === "subject" || contentType === "chapter" || contentType === "topic" || contentType === "question_bank"
                      : contentType === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setContentType(item.id as ContentSourceType);
                        setSelectedSubjectId("all");
                        setSelectedChapterId("all");
                        setSelectedTopicId("all");
                      }}
                      className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer active:scale-95 flex flex-col gap-1 ${
                        isSelected
                          ? "bg-[#7045D8] text-white border-[#7045D8] shadow-sm"
                          : "bg-white dark:bg-[#1B1536] border-slate-200 dark:border-[#31275E] text-slate-900 dark:text-slate-50 hover:border-[#7045D8]"
                      }`}
                    >
                      <Icon className={`w-4 h-4 ${isSelected ? "text-white" : "text-[#7045D8] dark:text-[#A78BFA]"}`} />
                      <span className="text-xs font-bold truncate">{item.label}</span>
                      <span className={`text-[10px] truncate ${isSelected ? "text-white/80" : "text-slate-500 dark:text-slate-400"}`}>
                        {item.sub}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Cascading Selectors */}
              {(contentType === "subject" || contentType === "chapter" || contentType === "topic" || contentType === "question_bank") && (
                <div className="p-3.5 bg-white dark:bg-[#1B1536] border border-slate-200 dark:border-[#31275E] rounded-2xl grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400">Subject</label>
                    <select
                      value={selectedSubjectId}
                      onChange={(e) => {
                        const val = e.target.value;
                        setSelectedSubjectId(val);
                        setSelectedChapterId("all");
                        setSelectedTopicId("all");
                        setContentType(val === "all" ? "question_bank" : "subject");
                      }}
                      className="w-full h-10 px-3 bg-[#F8FAFC] dark:bg-[#241D48] border border-slate-200 dark:border-[#31275E] rounded-xl text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#7045D8]"
                    >
                      <option value="all">All Subjects</option>
                      {subjects.map((s) => (
                        <option key={s.id} value={s.id}>
                          {getSubjectDisplayName(s)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400">Chapter</label>
                    <select
                      value={selectedChapterId}
                      onChange={(e) => {
                        const val = e.target.value;
                        setSelectedChapterId(val);
                        setSelectedTopicId("all");
                        if (val !== "all") setContentType("chapter");
                      }}
                      className="w-full h-10 px-3 bg-[#F8FAFC] dark:bg-[#241D48] border border-slate-200 dark:border-[#31275E] rounded-xl text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#7045D8]"
                    >
                      <option value="all">All Chapters</option>
                      {availableChapters.map((ch) => (
                        <option key={ch.id} value={ch.id}>
                          Ch {ch.number}: {getChapterDisplayName(ch)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400">Topic</label>
                    <select
                      value={selectedTopicId}
                      disabled={selectedChapterId === "all" || availableTopics.length === 0}
                      onChange={(e) => {
                        const val = e.target.value;
                        setSelectedTopicId(val);
                        if (val !== "all") setContentType("topic");
                      }}
                      className="w-full h-10 px-3 bg-[#F8FAFC] dark:bg-[#241D48] border border-slate-200 dark:border-[#31275E] rounded-xl text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#7045D8] disabled:opacity-50"
                    >
                      <option value="all">All Topics</option>
                      {availableTopics.map((top, idx) => (
                        <option key={`${top.id}-${idx}`} value={top.id}>
                          {getTopicDisplayName(top)} ({top.questions.length})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {contentType === "pyq" && (
                <div className="p-3.5 bg-white dark:bg-[#1B1536] border border-slate-200 dark:border-[#31275E] rounded-2xl space-y-1">
                  <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400">Select Exam Paper</label>
                  <select
                    value={selectedPYQId}
                    onChange={(e) => setSelectedPYQId(e.target.value)}
                    className="w-full h-10 px-3 bg-[#F8FAFC] dark:bg-[#241D48] border border-slate-200 dark:border-[#31275E] rounded-xl text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#7045D8]"
                  >
                    {pyqPapers.map((paper) => (
                      <option key={paper.id} value={paper.id}>
                        {paper.hindiTitle || paper.title} ({paper.paperYear})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {(contentType === "practice_test" || contentType === "mock_test" || contentType === "live_test") && (
                <div className="p-3.5 bg-white dark:bg-[#1B1536] border border-slate-200 dark:border-[#31275E] rounded-2xl space-y-1">
                  <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400">Select Mock Test</label>
                  <select
                    value={selectedTestId}
                    onChange={(e) => setSelectedTestId(e.target.value)}
                    className="w-full h-10 px-3 bg-[#F8FAFC] dark:bg-[#241D48] border border-slate-200 dark:border-[#31275E] rounded-xl text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#7045D8]"
                  >
                    {liveTests.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.hindiTitle || t.title} ({t.examCategory})
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </section>

            {/* STEP 2: PDF FORMAT */}
            <section className="space-y-2.5">
              <span className="text-xs font-black text-[#7045D8] dark:text-[#A78BFA] uppercase tracking-wider flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5" />
                2. Choose PDF Format
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {formatCards.map((card) => {
                  const Icon = card.icon;
                  const isSelected = formatCard === card.id;
                  return (
                    <button
                      key={card.id}
                      type="button"
                      onClick={() => setFormatCard(card.id)}
                      className={`p-3.5 rounded-2xl border-2 text-left transition-all cursor-pointer flex items-start justify-between gap-2 ${
                        isSelected
                          ? "bg-white dark:bg-[#1B1536] border-[#7045D8] dark:border-[#A78BFA] shadow-sm ring-2 ring-[#7045D8]/15"
                          : "bg-white/80 dark:bg-[#1B1536]/60 border-slate-200 dark:border-[#31275E] hover:border-[#A78BFA]"
                      }`}
                    >
                      <div className="flex items-start gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-[#7045D8]/10 text-[#7045D8] dark:text-[#A78BFA] flex items-center justify-center shrink-0">
                          <Icon className="w-4.5 h-4.5" />
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <h4 className="text-xs font-black text-slate-900 dark:text-white">{card.title}</h4>
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#7045D8]/10 text-[#7045D8] dark:text-[#A78BFA]">
                              {card.badge}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{card.desc}</p>
                        </div>
                      </div>
                      {isSelected && (
                        <div className="w-5 h-5 rounded-full bg-[#7045D8] text-white flex items-center justify-center shrink-0">
                          <Check className="w-3 h-3" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </section>

            {/* STEP 3: QUESTION COUNT & PRINT OPTIONS */}
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-[#7045D8] dark:text-[#A78BFA] uppercase tracking-wider flex items-center gap-1.5">
                  <Hash className="w-3.5 h-3.5" />
                  3. Count &amp; Layout
                </span>
                <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400">
                  {filteredResult.totalCandidateCount} Available
                </span>
              </div>

              <div className="grid grid-cols-5 gap-1.5">
                {[
                  { val: "all", label: "All" },
                  { val: 25, label: "25" },
                  { val: 50, label: "50" },
                  { val: 100, label: "100" },
                  { val: "custom", label: "Range" },
                ].map((lim) => {
                  const isCustomBtn = lim.val === "custom";
                  const isSelected = isCustomBtn ? useCustomRange : !useCustomRange && questionLimit === lim.val;
                  const isBlockedByAdmin =
                    effectiveMaxQuestions > 0 && typeof lim.val === "number" && lim.val > effectiveMaxQuestions;
                  return (
                    <button
                      key={String(lim.val)}
                      type="button"
                      disabled={isBlockedByAdmin}
                      onClick={() => {
                        if (isCustomBtn) {
                          setUseCustomRange(true);
                        } else {
                          setUseCustomRange(false);
                          setQuestionLimit(lim.val as any);
                        }
                      }}
                      className={`py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer disabled:opacity-40 ${
                        isSelected
                          ? "bg-[#7045D8] text-white border-[#7045D8] shadow-xs"
                          : "bg-white dark:bg-[#1B1536] border-slate-200 dark:border-[#31275E] text-slate-700 dark:text-slate-200"
                      }`}
                    >
                      {lim.label}
                    </button>
                  );
                })}
              </div>

              {useCustomRange && (
                <div className="grid grid-cols-2 gap-2.5 p-3 rounded-xl bg-white dark:bg-[#1B1536] border border-slate-200 dark:border-[#31275E]">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500">From Q#</label>
                    <input
                      type="number"
                      min={1}
                      value={customRangeStart}
                      onChange={(e) => setCustomRangeStart(Math.max(1, Number(e.target.value) || 1))}
                      className="w-full h-9 px-3 rounded-lg bg-[#F8FAFC] dark:bg-[#241D48] border border-slate-200 dark:border-[#31275E] text-xs font-bold"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500">To Q#</label>
                    <input
                      type="number"
                      min={customRangeStart}
                      value={customRangeEnd}
                      onChange={(e) => setCustomRangeEnd(Math.max(customRangeStart, Number(e.target.value) || customRangeStart))}
                      className="w-full h-9 px-3 rounded-lg bg-[#F8FAFC] dark:bg-[#241D48] border border-slate-200 dark:border-[#31275E] text-xs font-bold"
                    />
                  </div>
                </div>
              )}

              {/* Compact Layout, Font & Color Mode Pills */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div className="flex p-1 bg-white dark:bg-[#1B1536] rounded-xl border border-slate-200 dark:border-[#31275E]">
                  {[
                    { id: "compact", label: "Book 2-Col" },
                    { id: "single", label: "1-Column" },
                  ].map((l) => (
                    <button
                      key={l.id}
                      type="button"
                      onClick={() => setLayout(l.id as any)}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        layout === l.id
                          ? "bg-[#7045D8] text-white"
                          : "text-slate-600 dark:text-slate-300"
                      }`}
                    >
                      {l.label}
                    </button>
                  ))}
                </div>

                <div className="flex p-1 bg-white dark:bg-[#1B1536] rounded-xl border border-slate-200 dark:border-[#31275E]">
                  {[
                    { id: "normal", label: "Normal Text" },
                    { id: "large", label: "Large Text" },
                  ].map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setFontSize(f.id as any)}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        fontSize === f.id
                          ? "bg-[#7045D8] text-white"
                          : "text-slate-600 dark:text-slate-300"
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>

                <div className="flex p-1 bg-white dark:bg-[#1B1536] rounded-xl border border-slate-200 dark:border-[#31275E]">
                  {[
                    { id: "color", label: "Color" },
                    { id: "bw", label: "Black & White" },
                  ].map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setColorMode(m.id as "color" | "bw")}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        colorMode === m.id
                          ? m.id === "bw"
                            ? "bg-slate-900 text-white"
                            : "bg-[#7045D8] text-white"
                          : "text-slate-600 dark:text-slate-300"
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Compact Toggle Chips */}
              <div className="flex flex-wrap gap-2">
                {[
                  { label: "Cover Page", val: includeCoverPage, set: setIncludeCoverPage },
                  { label: "Instructions", val: includeTestInstructions, set: setIncludeTestInstructions },
                  { label: "Page Numbers", val: showPageNumbers, set: setShowPageNumbers },
                ].map((tog) => (
                  <button
                    key={tog.label}
                    type="button"
                    onClick={() => tog.set(!tog.val)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer flex items-center gap-1.5 ${
                      tog.val
                        ? "bg-[#7045D8]/10 text-[#7045D8] dark:text-[#A78BFA] border-[#7045D8]/30"
                        : "bg-white dark:bg-[#1B1536] text-slate-500 dark:text-slate-400 border-slate-200 dark:border-[#31275E]"
                    }`}
                  >
                    <Check className={`w-3.5 h-3.5 ${tog.val ? "opacity-100" : "opacity-30"}`} />
                    <span>{tog.label}</span>
                  </button>
                ))}

                <button
                  type="button"
                  onClick={() => setShowPersonalize(!showPersonalize)}
                  className="px-3 py-1.5 rounded-xl text-xs font-bold border bg-white dark:bg-[#1B1536] text-slate-700 dark:text-slate-200 border-slate-200 dark:border-[#31275E] flex items-center gap-1 cursor-pointer"
                >
                  <span>Personalize</span>
                  {showPersonalize ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>
              </div>

              {showPersonalize && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 p-3 rounded-2xl bg-white dark:bg-[#1B1536] border border-slate-200 dark:border-[#31275E]">
                  <input
                    type="text"
                    placeholder="Paper Title (Optional)"
                    value={customTitle}
                    onChange={(e) => setCustomTitle(e.target.value)}
                    className="px-3 py-2 bg-[#F8FAFC] dark:bg-[#241D48] border border-slate-200 dark:border-[#31275E] rounded-xl text-xs font-bold text-slate-900 dark:text-white"
                  />
                  <input
                    type="text"
                    placeholder="Candidate Name"
                    value={studentName}
                    onChange={(e) => setStudentName(e.target.value)}
                    className="px-3 py-2 bg-[#F8FAFC] dark:bg-[#241D48] border border-slate-200 dark:border-[#31275E] rounded-xl text-xs font-bold text-slate-900 dark:text-white"
                  />
                  <input
                    type="text"
                    placeholder="Roll Number"
                    value={rollNumber}
                    onChange={(e) => setRollNumber(e.target.value)}
                    className="px-3 py-2 bg-[#F8FAFC] dark:bg-[#241D48] border border-slate-200 dark:border-[#31275E] rounded-xl text-xs font-bold text-slate-900 dark:text-white"
                  />
                </div>
              )}
            </section>
          </div>
        ) : (
          /* TAB 2: LIVE PDF PREVIEW */
          <div className="flex-1 flex flex-col bg-slate-100 dark:bg-[#130E26] overflow-hidden">
            <div className="px-4 py-2.5 bg-white dark:bg-[#1B1536] border-b border-slate-200 dark:border-[#31275E] flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-900 dark:text-slate-50">
                <Eye className="w-4 h-4 text-[#7045D8] dark:text-[#A78BFA]" />
                <span>Preview ({filteredResult.count} Questions)</span>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setPreviewZoom((z) => Math.max(60, z - 20))}
                  className="w-7 h-7 rounded-lg bg-[#F8FAFC] dark:bg-[#241D48] border border-slate-200 dark:border-[#31275E] flex items-center justify-center cursor-pointer"
                  title="Zoom Out"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setPreviewZoom(100)}
                  className="px-2 h-7 rounded-lg bg-[#F8FAFC] dark:bg-[#241D48] border border-slate-200 dark:border-[#31275E] text-[11px] font-bold tabular-nums cursor-pointer"
                  title="Fit to Screen"
                >
                  {previewZoom === 100 ? "Fit" : `${previewZoom}%`}
                </button>
                <button
                  onClick={() => setPreviewZoom((z) => Math.min(200, z + 20))}
                  className="w-7 h-7 rounded-lg bg-[#F8FAFC] dark:bg-[#241D48] border border-slate-200 dark:border-[#31275E] flex items-center justify-center cursor-pointer"
                  title="Zoom In"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div
              ref={previewContainerRef}
              className="flex-1 overflow-auto p-2 sm:p-4 flex justify-center items-start"
            >
              <div
                className="relative shrink-0"
                style={{
                  width: `${Math.round(740 * effectiveScale)}px`,
                  height: `${Math.round(previewDocHeight * effectiveScale)}px`,
                }}
              >
                <div
                  className="bg-white shadow-xl rounded-md overflow-hidden border border-slate-200 origin-top-left"
                  style={{
                    width: "740px",
                    height: `${previewDocHeight}px`,
                    transform: `scale(${effectiveScale})`,
                  }}
                >
                  <iframe
                    ref={previewIframeRef}
                    onLoad={handlePreviewIframeLoad}
                    title="Disha PYQ Live PDF Preview"
                    srcDoc={generatedHTML}
                    className="w-full h-full border-none"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* STICKY FOOTER */}
        <footer className="px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] bg-white dark:bg-[#1B1536] border-t border-slate-200 dark:border-[#31275E] shrink-0 flex flex-col gap-2">
          {isGeneratingPDF && pdfProgress && (
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs font-bold tabular-nums text-[#7045D8] dark:text-[#A78BFA]">
                <span>{pdfProgress.message}</span>
                <span>{pdfProgress.percent}%</span>
              </div>
              <div className="w-full h-1.5 bg-slate-100 dark:bg-[#241D48] rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#7045D8] transition-all duration-200"
                  style={{ width: `${pdfProgress.percent}%` }}
                />
              </div>
            </div>
          )}

          <div className="flex items-center gap-2">
            <button
              id="btn-generate-pdf-primary"
              type="button"
              disabled={filteredResult.count === 0 || isGeneratingPDF || Boolean(accessBlockReason)}
              onClick={handleExport}
              className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-[#7045D8] to-[#5B32BF] hover:brightness-105 text-white font-bold text-xs sm:text-sm shadow-sm active:scale-98 transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-40"
            >
              {isGeneratingPDF ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Generating...</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  <span>
                    Download {formatCard === "json" ? "JSON" : "PDF"} ({filteredResult.count} Qs)
                  </span>
                </>
              )}
            </button>

            <button
              id="btn-preview-pdf-secondary"
              type="button"
              disabled={filteredResult.count === 0}
              onClick={() => setActiveTab(activeTab === "config" ? "preview" : "config")}
              className="py-3 px-3.5 rounded-xl bg-slate-100 dark:bg-[#241D48] border border-slate-200 dark:border-[#31275E] text-[#7045D8] dark:text-[#A78BFA] font-bold text-xs cursor-pointer flex items-center gap-1.5 disabled:opacity-40"
            >
              <Eye className="w-4 h-4" />
              <span className="hidden sm:inline">{activeTab === "config" ? "Preview" : "Edit"}</span>
            </button>

            {pdfConfig.allowPrint && (
              <button
                id="btn-open-new-tab"
                type="button"
                disabled={filteredResult.count === 0 || Boolean(accessBlockReason)}
                onClick={handleOpenNewTab}
                className="py-3 px-3.5 rounded-xl bg-slate-100 dark:bg-[#241D48] border border-slate-200 dark:border-[#31275E] text-slate-800 dark:text-slate-100 font-bold text-xs cursor-pointer flex items-center gap-1.5 disabled:opacity-40"
                title="Print / Open in New Tab"
              >
                <Printer className="w-4 h-4 text-[#7045D8] dark:text-[#A78BFA]" />
                <span className="hidden sm:inline">Print</span>
              </button>
            )}
          </div>
        </footer>
      </div>
    </div>
  );
};
