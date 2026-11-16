import React, { useState, useMemo, useEffect, useRef } from "react";
import { Chapter, ProgressStore, Subject, PYQPaper, LiveTest } from "../types";
import {
  X,
  Printer,
  Eye,
  BookOpen,
  Filter,
  Sparkles,
  Layers,
  ArrowLeft,
  AlertCircle,
  Sliders,
  Check,
  Share2,
  FileText,
  FileCheck,
  FileCode,
  FileQuestion,
  RotateCcw,
  CheckCircle2,
  Download,
  Loader2,
  AlertTriangle,
  HelpCircle,
  Info,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Calendar,
  Award,
  Hash,
  Shield,
  FileDown,
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
  printQuestionBankHTML,
  downloadQuestionBankHTML,
  downloadJSON,
} from "../utils/pdfGenerator";
import { loadLocalPYQPapers, fetchPYQPapers, INITIAL_PYQ_PAPERS } from "../utils/pyqStorage";
import { loadLocalLiveTests, fetchLiveTests, INITIAL_LIVE_TESTS } from "../utils/liveTestStorage";
import {
  getSubjectDisplayName,
  getChapterDisplayName,
  getTopicDisplayName,
} from "../utils/curriculumUtils";

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
  // Mobile Top Tab: "config" vs "preview"
  const [activeTab, setActiveTab] = useState<"config" | "preview">("config");

  // Dynamic Data Sources
  const [pyqPapers, setPyqPapers] = useState<PYQPaper[]>(INITIAL_PYQ_PAPERS);
  const [liveTests, setLiveTests] = useState<LiveTest[]>(INITIAL_LIVE_TESTS);

  useEffect(() => {
    async function loadData() {
      try {
        const localPYQs = loadLocalPYQPapers();
        if (localPYQs && localPYQs.length > 0) setPyqPapers(localPYQs);
        const remotePYQs = await fetchPYQPapers();
        if (remotePYQs && remotePYQs.length > 0) setPyqPapers(remotePYQs);

        const localLive = loadLocalLiveTests();
        if (localLive && localLive.length > 0) setLiveTests(localLive);
        const remoteLive = await fetchLiveTests();
        if (remoteLive && remoteLive.length > 0) setLiveTests(remoteLive);
      } catch (e) {
        // Fallback to initial seeds
      }
    }
    loadData();
  }, []);

  // 1. CONTENT SOURCE SELECTION
  const [contentType, setContentType] = useState<ContentSourceType>(
    initialTopicId ? "topic" : initialChapterId ? "chapter" : initialSubjectId ? "subject" : "question_bank"
  );

  const [selectedSubjectId, setSelectedSubjectId] = useState<string | "all">(
    initialSubjectId || "all"
  );
  const [selectedChapterId, setSelectedChapterId] = useState<string | "all">(
    initialChapterId || "all"
  );
  const [selectedTopicId, setSelectedTopicId] = useState<string | "all">(
    initialTopicId || "all"
  );
  const [selectedPYQId, setSelectedPYQId] = useState<string>(pyqPapers[0]?.id || "");
  const [selectedTestId, setSelectedTestId] = useState<string>(liveTests[0]?.id || "");

  const [filterType, setFilterType] = useState<"all" | "wrong" | "bookmarked">(
    initialFilterType
  );

  // 2. QUESTION COUNT & RANGE
  const [questionLimit, setQuestionLimit] = useState<number | "all">("all");
  const [useCustomRange, setUseCustomRange] = useState(false);
  const [customRangeStart, setCustomRangeStart] = useState<number>(1);
  const [customRangeEnd, setCustomRangeEnd] = useState<number>(25);

  // 3. PDF FORMAT CARD (The 4 Primary Options)
  const [formatCard, setFormatCard] = useState<PDFFormatCard>("question_paper");

  // 4. DOCUMENT SETTINGS (TOGGLES)
  const [includeCoverPage, setIncludeCoverPage] = useState(true);
  const [showPageNumbers, setShowPageNumbers] = useState(true);
  const [showHeaderFooter, setShowHeaderFooter] = useState(true);
  const [includeTestInstructions, setIncludeTestInstructions] = useState(true);
  const [includeSubjectTopicNames, setIncludeSubjectTopicNames] = useState(true);
  const [includeBlankAnswerSheet, setIncludeBlankAnswerSheet] = useState(false);

  // Layout & Formatting
  const [layout, setLayout] = useState<"single" | "compact">("single");
  const [fontSize, setFontSize] = useState<"normal" | "large">("normal");
  const [shuffle, setShuffle] = useState(false);

  // Personalization
  const [studentName, setStudentName] = useState("");
  const [rollNumber, setRollNumber] = useState("");
  const [customTitle, setCustomTitle] = useState("");

  // Preview & Zoom States
  const [previewZoom, setPreviewZoom] = useState<number>(100);

  // Generation state & Progress
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [pdfProgress, setPdfProgress] = useState<PDFGenerationProgress | null>(null);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  // Available chapters for selected subject
  const availableChapters = useMemo(() => {
    if (selectedSubjectId === "all") return chapters;
    return chapters.filter((c) => c.subjectId === selectedSubjectId);
  }, [chapters, selectedSubjectId]);

  // Available topics for selected chapter
  const availableTopics = useMemo(() => {
    if (selectedChapterId === "all") return [];
    const ch = chapters.find((c) => c.id === selectedChapterId);
    return ch ? ch.topics : [];
  }, [chapters, selectedChapterId]);

  // Compute filtered questions
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
      questionLimit,
      customRangeStart: useCustomRange ? customRangeStart : undefined,
      customRangeEnd: useCustomRange ? customRangeEnd : undefined,
      shuffle,

      includeCoverPage,
      showPageNumbers,
      showHeaderFooter,
      includeTestInstructions,
      includeSubjectTopicNames,
      includeBlankAnswerSheet: formatCard === "question_paper_omr" ? true : includeBlankAnswerSheet,

      customTitle: customTitle.trim() || undefined,
      studentName: studentName.trim() || undefined,
      rollNumber: rollNumber.trim() || undefined,
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
      questionLimit,
      useCustomRange,
      customRangeStart,
      customRangeEnd,
      shuffle,
      includeCoverPage,
      showPageNumbers,
      showHeaderFooter,
      includeTestInstructions,
      includeSubjectTopicNames,
      includeBlankAnswerSheet,
      customTitle,
      studentName,
      rollNumber,
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

  // Generate document HTML
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
      includeCoverPage,
      showPageNumbers,
      showHeaderFooter,
      includeTestInstructions,
      includeSubjectTopicNames,
      includeBlankAnswerSheet: formatCard === "question_paper_omr" ? true : includeBlankAnswerSheet,
      customTitle: customTitle.trim() || undefined,
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
    showHeaderFooter,
    includeTestInstructions,
    includeSubjectTopicNames,
    includeBlankAnswerSheet,
    customTitle,
    studentName,
    rollNumber,
    progressStore,
  ]);

  // Handle Export
  const handleExport = async () => {
    if (formatCard === "json") {
      const cleanTitle = (filteredResult.testTitle || filteredResult.subjectTitle || "DISHA_20_20_Data")
        .replace(/[^a-zA-Z0-9\u0900-\u097F]/g, "_");
      downloadJSON(filteredResult.questions, `DISHA_20_20_${cleanTitle}.json`);
      setToastMessage({ text: `✓ JSON data successfully downloaded!`, type: "success" });
      setTimeout(() => setToastMessage(null), 5000);
      return;
    }

    if (!generatedHTML || isGeneratingPDF) return;
    setIsGeneratingPDF(true);
    setToastMessage(null);

    const cleanTitle = (filteredResult.testTitle || filteredResult.subjectTitle || "DISHA_20_20_Paper")
      .replace(/[^a-zA-Z0-9\u0900-\u097F]/g, "_");
    
    let formatSuffix = "Question_Paper";
    if (formatCard === "question_paper_omr") formatSuffix = "Question_Paper_With_Answer_Sheet";
    else if (formatCard === "answer_key") formatSuffix = "Answer_Key";
    else if (formatCard === "detailed_solutions") formatSuffix = "Detailed_Solutions";

    const filename = `DISHA_20_20_${cleanTitle}_${formatSuffix}.pdf`;

    try {
      const success = await generateAndDownloadPDF(
        generatedHTML,
        filename,
        (progress) => setPdfProgress(progress)
      );

      if (success) {
        setToastMessage({ text: `✓ ${filename} successfully downloaded!`, type: "success" });
        setTimeout(() => setToastMessage(null), 5000);
      } else {
        setToastMessage({ text: "Error generating PDF binary. Use 'Open in New Tab' to save directly.", type: "error" });
        setTimeout(() => setToastMessage(null), 6000);
      }
    } catch (err) {
      console.error("PDF generation caught error:", err);
      setToastMessage({ text: "PDF generation issue. Opening in new tab for direct print/save.", type: "error" });
      setTimeout(() => setToastMessage(null), 6000);
    } finally {
      setIsGeneratingPDF(false);
      setPdfProgress(null);
    }
  };

  const handleOpenNewTab = () => {
    if (!generatedHTML) return;
    openQuestionBankInNewTab(generatedHTML);
  };

  const handlePrint = () => {
    if (!generatedHTML) return;
    printQuestionBankHTML(generatedHTML);
  };

  return (
    <div
      id="pdf-export-modal-backdrop"
      className="fixed inset-0 z-60 bg-[#171923]/80 backdrop-blur-xs flex flex-col sm:items-center sm:justify-center animate-in fade-in duration-200"
    >
      <div
        id="pdf-export-modal-dialog"
        className="w-full h-full sm:h-[92vh] sm:max-w-3xl bg-[#FFF9EF] dark:bg-[#171923] sm:rounded-3xl border border-[#E8D9C0] dark:border-[#31374A] shadow-2xl flex flex-col overflow-hidden animate-in fade-in sm:zoom-in-95 duration-200"
      >
        {/* STICKY HEADER */}
        <header className="px-4 py-3 bg-gradient-to-r from-[#800020] via-[#6A001A] to-[#4A0012] text-white shrink-0 flex flex-col gap-2.5 z-10 border-b border-[#C99A45]/30">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <button
                id="btn-close-pdf-export"
                onClick={onClose}
                className="w-9 h-9 rounded-xl bg-white/10 text-white hover:bg-white/20 active:scale-95 flex items-center justify-center transition-all cursor-pointer shrink-0 border border-white/10"
                aria-label="Close"
              >
                <ArrowLeft className="w-5 h-5 sm:hidden" />
                <X className="w-5 h-5 hidden sm:block" />
              </button>

              <div className="min-w-0">
                <h2 className="text-base sm:text-lg font-black tracking-tight text-white flex items-center gap-2 flex-wrap">
                  <span>Download Your PDF</span>
                  <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-[#F47B20] text-white shrink-0 shadow-xs">
                    DISHA 20-20
                  </span>
                </h2>
                <p className="text-xs text-[#F7EFE2]/90 truncate font-medium">
                  Create your personalized practice paper • Printable MCQ Exam PDF
                </p>
              </div>
            </div>

            {/* Quick Action Badges */}
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs font-bold tabular-nums text-[#FFF9EF] bg-[#F47B20]/25 border border-[#C99A45]/40 px-2.5 py-1 rounded-lg">
                {filteredResult.count} Questions
              </span>
            </div>
          </div>

          {/* Segmented Controls: Customizer vs PDF Preview */}
          <div className="flex bg-black/25 p-1 rounded-xl border border-white/10">
            <button
              id="tab-btn-config"
              onClick={() => setActiveTab("config")}
              className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                activeTab === "config"
                  ? "bg-[#FFF9EF] text-[#800020] shadow-xs font-black"
                  : "text-white/80 hover:text-white"
              }`}
            >
              <Sliders className="w-4 h-4" />
              <span>Configure Paper Settings</span>
            </button>

            <button
              id="tab-btn-preview"
              onClick={() => setActiveTab("preview")}
              disabled={filteredResult.count === 0}
              className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                activeTab === "preview"
                  ? "bg-[#FFF9EF] text-[#800020] shadow-xs font-black"
                  : "text-white/80 hover:text-white disabled:opacity-40"
              }`}
            >
              <Eye className="w-4 h-4" />
              <span>PDF Live Preview</span>
            </button>
          </div>
        </header>

        {/* Toast Alerts */}
        {toastMessage && (
          <div
            className={`py-2 px-4 text-xs font-bold flex items-center justify-between shrink-0 shadow-md ${
              toastMessage.type === "success"
                ? "bg-emerald-600 text-white"
                : "bg-rose-600 text-white"
            }`}
          >
            <div className="flex items-center gap-2 mx-auto">
              {toastMessage.type === "success" ? (
                <CheckCircle2 className="w-4 h-4 shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 shrink-0" />
              )}
              <span>{toastMessage.text}</span>
            </div>
            <button
              onClick={() => setToastMessage(null)}
              className="p-1 hover:bg-black/20 rounded cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* TAB 1: CONFIGURATION SCREEN */}
        {activeTab === "config" ? (
          <div className="flex-1 overflow-y-auto overscroll-contain p-4 sm:p-6 space-y-6 text-[#171923] dark:text-[#FFF9EF]">
            {/* SECTION A: SELECT CONTENT */}
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-black text-[#800020] dark:text-[#F47B20] uppercase tracking-wider">
                  <Layers className="w-4 h-4 text-[#F47B20]" />
                  <span>A. Select Content Source</span>
                </div>
                <span className="text-[11px] font-bold text-[#6E6254] dark:text-[#A39887]">
                  Dynamic Database
                </span>
              </div>

              {/* Content Type Selector Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {[
                  {
                    id: "subject",
                    label: "Subject-wise",
                    sub: "By Subject",
                  },
                  {
                    id: "chapter",
                    label: "Chapter-wise",
                    sub: "By Chapter",
                  },
                  {
                    id: "topic",
                    label: "Topic-wise",
                    sub: "Specific Topics",
                  },
                  {
                    id: "practice_test",
                    label: "Practice Test",
                    sub: "MCQ Sets",
                  },
                  {
                    id: "mock_test",
                    label: "Mock Test",
                    sub: "Full Exam",
                  },
                  {
                    id: "pyq",
                    label: "PYQs",
                    sub: "Previous Years",
                  },
                  {
                    id: "wrong_practice",
                    label: "Wrong (Practice)",
                    sub: "Unanswered",
                  },
                  {
                    id: "wrong_review",
                    label: "Wrong (Review)",
                    sub: "With Solution",
                  },
                  {
                    id: "bookmarked",
                    label: "Bookmarks",
                    sub: "Important Qs",
                  },
                  {
                    id: "question_bank",
                    label: "Full Bank",
                    sub: "All MCQs",
                  },
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setContentType(item.id as ContentSourceType);
                      setSelectedSubjectId("all");
                      setSelectedChapterId("all");
                      setSelectedTopicId("all");
                    }}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer active:scale-95 flex flex-col ${
                      contentType === item.id
                        ? "bg-[#800020] text-white border-[#800020] shadow-md"
                        : "bg-white dark:bg-[#1F2330] border-[#E8D9C0] dark:border-[#31374A] text-[#171923] dark:text-[#FFF9EF] hover:border-[#C99A45]"
                    }`}
                  >
                    <span className="text-xs font-bold truncate">{item.label}</span>
                    <span
                      className={`text-[10px] ${
                        contentType === item.id ? "text-[#F7EFE2]/80" : "text-[#6E6254] dark:text-[#A39887]"
                      }`}
                    >
                      {item.sub}
                    </span>
                  </button>
                ))}
              </div>

              {/* Dynamic Select Dropdowns based on Content Type */}
              <div className="p-3.5 bg-white dark:bg-[#1F2330] border border-[#E8D9C0] dark:border-[#31374A] rounded-2xl space-y-3 shadow-2xs">
                {/* Subject Selector */}
                {(contentType === "subject" || contentType === "chapter" || contentType === "topic" || contentType === "question_bank") && (
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-[#5C5346] dark:text-[#C4B9A8]">
                      Subject
                    </label>
                    <select
                      value={selectedSubjectId}
                      onChange={(e) => {
                        setSelectedSubjectId(e.target.value);
                        setSelectedChapterId("all");
                        setSelectedTopicId("all");
                      }}
                      className="w-full h-10 px-3 bg-[#FFF9EF] dark:bg-[#252A3A] border border-[#E8D9C0] dark:border-[#31374A] rounded-xl text-xs font-bold text-[#171923] dark:text-white focus:outline-none focus:border-[#800020] dark:focus:border-[#F47B20]"
                    >
                      <option value="all">★ All Subjects</option>
                      {subjects.map((s) => (
                        <option key={s.id} value={s.id}>
                          {getSubjectDisplayName(s)}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Chapter Selector */}
                {(contentType === "chapter" || contentType === "topic") && (
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-[#5C5346] dark:text-[#C4B9A8]">
                      Chapter
                    </label>
                    <select
                      value={selectedChapterId}
                      onChange={(e) => {
                        setSelectedChapterId(e.target.value);
                        setSelectedTopicId("all");
                      }}
                      className="w-full h-10 px-3 bg-[#FFF9EF] dark:bg-[#252A3A] border border-[#E8D9C0] dark:border-[#31374A] rounded-xl text-xs font-bold text-[#171923] dark:text-white focus:outline-none focus:border-[#800020] dark:focus:border-[#F47B20]"
                    >
                      <option value="all">★ All Chapters</option>
                      {availableChapters.map((ch) => (
                        <option key={ch.id} value={ch.id}>
                          Chapter {ch.number}: {getChapterDisplayName(ch)}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Topic Selector */}
                {contentType === "topic" && availableTopics.length > 0 && (
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-[#5C5346] dark:text-[#C4B9A8]">
                      Topic
                    </label>
                    <select
                      value={selectedTopicId}
                      onChange={(e) => setSelectedTopicId(e.target.value)}
                      className="w-full h-10 px-3 bg-[#FFF9EF] dark:bg-[#252A3A] border border-[#E8D9C0] dark:border-[#31374A] rounded-xl text-xs font-bold text-[#171923] dark:text-white focus:outline-none focus:border-[#800020] dark:focus:border-[#F47B20]"
                    >
                      <option value="all">★ All Topics in Chapter</option>
                      {availableTopics.map((top, topIdx) => (
                        <option key={`${top.id}-${topIdx}`} value={top.id}>
                          {getTopicDisplayName(top)} ({top.questions.length} Qs)
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* PYQ Paper Selector */}
                {contentType === "pyq" && (
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-[#5C5346] dark:text-[#C4B9A8]">
                      Previous Year Exam Paper
                    </label>
                    <select
                      value={selectedPYQId}
                      onChange={(e) => setSelectedPYQId(e.target.value)}
                      className="w-full h-10 px-3 bg-[#FFF9EF] dark:bg-[#252A3A] border border-[#E8D9C0] dark:border-[#31374A] rounded-xl text-xs font-bold text-[#171923] dark:text-white focus:outline-none focus:border-[#800020] dark:focus:border-[#F47B20]"
                    >
                      {pyqPapers.map((paper) => (
                        <option key={paper.id} value={paper.id}>
                          {paper.hindiTitle || paper.title} ({paper.paperYear})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Test Selector */}
                {(contentType === "practice_test" || contentType === "mock_test" || contentType === "live_test") && (
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-[#5C5346] dark:text-[#C4B9A8]">
                      Select Test Series
                    </label>
                    <select
                      value={selectedTestId}
                      onChange={(e) => setSelectedTestId(e.target.value)}
                      className="w-full h-10 px-3 bg-[#FFF9EF] dark:bg-[#252A3A] border border-[#E8D9C0] dark:border-[#31374A] rounded-xl text-xs font-bold text-[#171923] dark:text-white focus:outline-none focus:border-[#800020] dark:focus:border-[#F47B20]"
                    >
                      {liveTests.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.hindiTitle || t.title} ({t.examCategory})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            </section>

            {/* SECTION B: QUESTION COUNT */}
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-black text-[#800020] dark:text-[#F47B20] uppercase tracking-wider">
                  <Hash className="w-4 h-4 text-[#F47B20]" />
                  <span>B. Question Count</span>
                </div>
                <span className="text-xs font-black tabular-nums text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-900/50 px-2 py-0.5 rounded-md">
                  Available: {filteredResult.totalCandidateCount} Questions
                </span>
              </div>

              <div className="grid grid-cols-5 gap-1.5">
                {[
                  { val: "all", label: "All" },
                  { val: 25, label: "25 Qs" },
                  { val: 50, label: "50 Qs" },
                  { val: 100, label: "100 Qs" },
                  { val: "custom", label: "Custom" },
                ].map((lim) => {
                  const isCustomBtn = lim.val === "custom";
                  const isSelected = isCustomBtn ? useCustomRange : !useCustomRange && questionLimit === lim.val;
                  const isDisabled = !isCustomBtn && typeof lim.val === "number" && filteredResult.totalCandidateCount < lim.val;

                  return (
                    <button
                      key={String(lim.val)}
                      type="button"
                      disabled={isDisabled}
                      onClick={() => {
                        if (isCustomBtn) {
                          setUseCustomRange(true);
                        } else {
                          setUseCustomRange(false);
                          setQuestionLimit(lim.val as any);
                        }
                      }}
                      className={`py-2 rounded-xl text-xs font-bold tabular-nums transition-all border cursor-pointer active:scale-95 disabled:opacity-30 ${
                        isSelected
                          ? "bg-[#F47B20] text-white border-[#F47B20] shadow-xs"
                          : "bg-white dark:bg-[#1F2330] border-[#E8D9C0] dark:border-[#31374A] text-[#171923] dark:text-[#FFF9EF] hover:border-[#C99A45]"
                      }`}
                    >
                      {lim.label}
                    </button>
                  );
                })}
              </div>

              {/* Custom Range Inputs */}
              {useCustomRange && (
                <div className="p-3 bg-white dark:bg-[#1F2330] border border-[#E8D9C0] dark:border-[#31374A] rounded-xl flex items-center gap-3 animate-in fade-in duration-150">
                  <div className="flex-1 space-y-1">
                    <label className="text-[10px] font-bold text-[#6E6254] dark:text-[#A39887] uppercase block">From Question</label>
                    <input
                      type="number"
                      min={1}
                      max={filteredResult.totalCandidateCount || 1}
                      value={customRangeStart}
                      onChange={(e) => setCustomRangeStart(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-full h-9 px-3 bg-[#FFF9EF] dark:bg-[#252A3A] border border-[#E8D9C0] dark:border-[#31374A] rounded-lg text-xs font-bold tabular-nums text-[#171923] dark:text-white"
                    />
                  </div>
                  <span className="text-[#6E6254] font-bold pt-4">to</span>
                  <div className="flex-1 space-y-1">
                    <label className="text-[10px] font-bold text-[#6E6254] dark:text-[#A39887] uppercase block">To Question</label>
                    <input
                      type="number"
                      min={customRangeStart}
                      max={filteredResult.totalCandidateCount || 1}
                      value={customRangeEnd}
                      onChange={(e) => setCustomRangeEnd(Math.min(filteredResult.totalCandidateCount, parseInt(e.target.value) || customRangeStart))}
                      className="w-full h-9 px-3 bg-[#FFF9EF] dark:bg-[#252A3A] border border-[#E8D9C0] dark:border-[#31374A] rounded-lg text-xs font-bold tabular-nums text-[#171923] dark:text-white"
                    />
                  </div>
                </div>
              )}
            </section>

            {/* SECTION C: PDF FORMAT (THE 5 SELECTION CARDS) */}
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-black text-[#800020] dark:text-[#F47B20] uppercase tracking-wider">
                  <FileText className="w-4 h-4 text-[#F47B20]" />
                  <span>C. PDF Format Selection</span>
                </div>
                <span className="text-[11px] font-bold text-[#F47B20]">
                  Select Format
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* CARD 1: Question Paper Only */}
                <div
                  id="card-format-question-paper"
                  onClick={() => setFormatCard("question_paper")}
                  className={`p-3.5 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between relative overflow-hidden ${
                    formatCard === "question_paper"
                      ? "bg-white dark:bg-[#1F2330] border-[#800020] dark:border-[#F47B20] shadow-md ring-2 ring-[#800020]/15 dark:ring-[#F47B20]/20"
                      : "bg-white/70 dark:bg-[#1F2330]/60 border-[#E8D9C0] dark:border-[#31374A] hover:border-[#C99A45]"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-xl bg-[#800020]/10 dark:bg-[#800020]/25 text-[#800020] dark:text-[#F47B20] flex items-center justify-center font-bold">
                        <FileQuestion className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="text-xs font-black text-[#171923] dark:text-white">Question Paper Only</h4>
                        <span className="text-[10px] font-extrabold text-[#800020] dark:text-[#F47B20] uppercase">No Answers</span>
                      </div>
                    </div>
                    {formatCard === "question_paper" && (
                      <div className="w-5 h-5 rounded-full bg-[#800020] dark:bg-[#F47B20] text-white flex items-center justify-center">
                        <Check className="w-3.5 h-3.5" />
                      </div>
                    )}
                  </div>
                  <p className="text-[11px] font-medium text-[#5C5346] dark:text-[#A39887] mt-2.5">
                    Questions and options without answers for offline solving.
                  </p>
                </div>

                {/* CARD 2: Question Paper + Blank Answer Sheet */}
                <div
                  id="card-format-question-paper-omr"
                  onClick={() => setFormatCard("question_paper_omr")}
                  className={`p-3.5 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between relative overflow-hidden ${
                    formatCard === "question_paper_omr"
                      ? "bg-white dark:bg-[#1F2330] border-[#800020] dark:border-[#F47B20] shadow-md ring-2 ring-[#800020]/15 dark:ring-[#F47B20]/20"
                      : "bg-white/70 dark:bg-[#1F2330]/60 border-[#E8D9C0] dark:border-[#31374A] hover:border-[#C99A45]"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-xl bg-[#F47B20]/15 text-[#F47B20] flex items-center justify-center font-bold">
                        <FileCode className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="text-xs font-black text-[#171923] dark:text-white">Question Paper + Answer Sheet</h4>
                        <span className="text-[10px] font-extrabold text-[#F47B20] uppercase">Printable OMR</span>
                      </div>
                    </div>
                    {formatCard === "question_paper_omr" && (
                      <div className="w-5 h-5 rounded-full bg-[#800020] dark:bg-[#F47B20] text-white flex items-center justify-center">
                        <Check className="w-3.5 h-3.5" />
                      </div>
                    )}
                  </div>
                  <p className="text-[11px] font-medium text-[#5C5346] dark:text-[#A39887] mt-2.5">
                    Printable question paper with a separate OMR answer sheet.
                  </p>
                </div>

                {/* CARD 3: Answer Key Only */}
                <div
                  id="card-format-answer-key"
                  onClick={() => setFormatCard("answer_key")}
                  className={`p-3.5 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between relative overflow-hidden ${
                    formatCard === "answer_key"
                      ? "bg-white dark:bg-[#1F2330] border-[#800020] dark:border-[#F47B20] shadow-md ring-2 ring-[#800020]/15 dark:ring-[#F47B20]/20"
                      : "bg-white/70 dark:bg-[#1F2330]/60 border-[#E8D9C0] dark:border-[#31374A] hover:border-[#C99A45]"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-xl bg-emerald-100 dark:bg-emerald-950 text-emerald-600 flex items-center justify-center font-bold">
                        <FileCheck className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="text-xs font-black text-[#171923] dark:text-white">Answer Key Only</h4>
                        <span className="text-[10px] font-extrabold text-emerald-600 uppercase">Verification Table</span>
                      </div>
                    </div>
                    {formatCard === "answer_key" && (
                      <div className="w-5 h-5 rounded-full bg-[#800020] dark:bg-[#F47B20] text-white flex items-center justify-center">
                        <Check className="w-3.5 h-3.5" />
                      </div>
                    )}
                  </div>
                  <p className="text-[11px] font-medium text-[#5C5346] dark:text-[#A39887] mt-2.5">
                    Correct answers for checking your responses quickly.
                  </p>
                </div>

                {/* CARD 4: Detailed Solutions */}
                <div
                  id="card-format-detailed-solutions"
                  onClick={() => setFormatCard("detailed_solutions")}
                  className={`p-3.5 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between relative overflow-hidden ${
                    formatCard === "detailed_solutions"
                      ? "bg-white dark:bg-[#1F2330] border-[#800020] dark:border-[#F47B20] shadow-md ring-2 ring-[#800020]/15 dark:ring-[#F47B20]/20"
                      : "bg-white/70 dark:bg-[#1F2330]/60 border-[#E8D9C0] dark:border-[#31374A] hover:border-[#C99A45]"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-xl bg-[#C99A45]/20 text-[#9A7026] dark:text-[#C99A45] flex items-center justify-center font-bold">
                        <BookOpen className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="text-xs font-black text-[#171923] dark:text-white">Detailed Solutions</h4>
                        <span className="text-[10px] font-extrabold text-[#9A7026] dark:text-[#C99A45] uppercase">Complete Explanations</span>
                      </div>
                    </div>
                    {formatCard === "detailed_solutions" && (
                      <div className="w-5 h-5 rounded-full bg-[#800020] dark:bg-[#F47B20] text-white flex items-center justify-center">
                        <Check className="w-3.5 h-3.5" />
                      </div>
                    )}
                  </div>
                  <p className="text-[11px] font-medium text-[#5C5346] dark:text-[#A39887] mt-2.5">
                    Questions, correct answers, and detailed explanations.
                  </p>
                </div>
                
                {/* CARD 5: JSON Export */}
                <div
                  id="card-format-json"
                  onClick={() => setFormatCard("json")}
                  className={`p-3.5 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between relative overflow-hidden ${
                    formatCard === "json"
                      ? "bg-white dark:bg-[#1F2330] border-[#800020] dark:border-[#F47B20] shadow-md ring-2 ring-[#800020]/15 dark:ring-[#F47B20]/20"
                      : "bg-white/70 dark:bg-[#1F2330]/60 border-[#E8D9C0] dark:border-[#31374A] hover:border-[#C99A45]"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-xl bg-[#F7EFE2] dark:bg-[#252A3A] text-[#5C5346] dark:text-[#C4B9A8] flex items-center justify-center font-bold">
                        <FileCode className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="text-xs font-black text-[#171923] dark:text-white">JSON Export</h4>
                        <span className="text-[10px] font-extrabold text-[#6E6254] dark:text-[#A39887] uppercase">Raw Data</span>
                      </div>
                    </div>
                    {formatCard === "json" && (
                      <div className="w-5 h-5 rounded-full bg-[#800020] dark:bg-[#F47B20] text-white flex items-center justify-center">
                        <Check className="w-3.5 h-3.5" />
                      </div>
                    )}
                  </div>
                  <p className="text-[11px] font-medium text-[#5C5346] dark:text-[#A39887] mt-2.5">
                    Download raw question data in JSON format.
                  </p>
                </div>
              </div>
            </section>


            {/* SECTION D: DOCUMENT SETTINGS */}
            <section className="space-y-3">
              <div className="flex items-center gap-2 text-xs font-black text-[#800020] dark:text-[#F47B20] uppercase tracking-wider">
                <Sliders className="w-4 h-4 text-[#F47B20]" />
                <span>D. Document Toggles & Settings</span>
              </div>

              <div className="p-3.5 bg-white dark:bg-[#1F2330] border border-[#E8D9C0] dark:border-[#31374A] rounded-2xl grid grid-cols-1 sm:grid-cols-2 gap-2.5 shadow-2xs">
                {/* Toggle: Cover Page */}
                <label className="flex items-center justify-between p-2.5 rounded-xl bg-[#FFF9EF] dark:bg-[#252A3A] border border-[#E8D9C0] dark:border-[#31374A] cursor-pointer">
                  <span className="text-xs font-bold text-[#171923] dark:text-[#FFF9EF]">Include A4 Cover Page</span>
                  <input
                    type="checkbox"
                    checked={includeCoverPage}
                    onChange={(e) => setIncludeCoverPage(e.target.checked)}
                    className="w-4 h-4 accent-[#800020] dark:accent-[#F47B20] rounded cursor-pointer"
                  />
                </label>

                {/* Toggle: Page Numbers */}
                <label className="flex items-center justify-between p-2.5 rounded-xl bg-[#FFF9EF] dark:bg-[#252A3A] border border-[#E8D9C0] dark:border-[#31374A] cursor-pointer">
                  <span className="text-xs font-bold text-[#171923] dark:text-[#FFF9EF]">Show Page Numbers</span>
                  <input
                    type="checkbox"
                    checked={showPageNumbers}
                    onChange={(e) => setShowPageNumbers(e.target.checked)}
                    className="w-4 h-4 accent-[#800020] dark:accent-[#F47B20] rounded cursor-pointer"
                  />
                </label>

                {/* Toggle: Header and Footer */}
                <label className="flex items-center justify-between p-2.5 rounded-xl bg-[#FFF9EF] dark:bg-[#252A3A] border border-[#E8D9C0] dark:border-[#31374A] cursor-pointer">
                  <span className="text-xs font-bold text-[#171923] dark:text-[#FFF9EF]">Show Header and Footer</span>
                  <input
                    type="checkbox"
                    checked={showHeaderFooter}
                    onChange={(e) => setShowHeaderFooter(e.target.checked)}
                    className="w-4 h-4 accent-[#800020] dark:accent-[#F47B20] rounded cursor-pointer"
                  />
                </label>

                {/* Toggle: Test Instructions */}
                <label className="flex items-center justify-between p-2.5 rounded-xl bg-[#FFF9EF] dark:bg-[#252A3A] border border-[#E8D9C0] dark:border-[#31374A] cursor-pointer">
                  <span className="text-xs font-bold text-[#171923] dark:text-[#FFF9EF]">Include Test Instructions</span>
                  <input
                    type="checkbox"
                    checked={includeTestInstructions}
                    onChange={(e) => setIncludeTestInstructions(e.target.checked)}
                    className="w-4 h-4 accent-[#800020] dark:accent-[#F47B20] rounded cursor-pointer"
                  />
                </label>

                {/* Toggle: Subject and Topic Names */}
                <label className="flex items-center justify-between p-2.5 rounded-xl bg-[#FFF9EF] dark:bg-[#252A3A] border border-[#E8D9C0] dark:border-[#31374A] cursor-pointer">
                  <span className="text-xs font-bold text-[#171923] dark:text-[#FFF9EF]">Include Subject & Topic Names</span>
                  <input
                    type="checkbox"
                    checked={includeSubjectTopicNames}
                    onChange={(e) => setIncludeSubjectTopicNames(e.target.checked)}
                    className="w-4 h-4 accent-[#800020] dark:accent-[#F47B20] rounded cursor-pointer"
                  />
                </label>

                {/* Toggle: Blank Answer Sheet Append */}
                <label className="flex items-center justify-between p-2.5 rounded-xl bg-[#FFF9EF] dark:bg-[#252A3A] border border-[#E8D9C0] dark:border-[#31374A] cursor-pointer">
                  <span className="text-xs font-bold text-[#171923] dark:text-[#FFF9EF]">Append Blank Answer Sheet</span>
                  <input
                    type="checkbox"
                    checked={includeBlankAnswerSheet}
                    onChange={(e) => setIncludeBlankAnswerSheet(e.target.checked)}
                    className="w-4 h-4 accent-[#800020] dark:accent-[#F47B20] rounded cursor-pointer"
                  />
                </label>
              </div>

              {/* Personalization Inputs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                <input
                  type="text"
                  placeholder="Candidate Name (Optional)"
                  value={studentName}
                  onChange={(e) => setStudentName(e.target.value)}
                  className="px-3 py-2.5 bg-white dark:bg-[#1F2330] border border-[#E8D9C0] dark:border-[#31374A] rounded-xl text-xs font-bold text-[#171923] dark:text-white focus:outline-none focus:border-[#800020] dark:focus:border-[#F47B20]"
                />
                <input
                  type="text"
                  placeholder="Roll Number (Optional)"
                  value={rollNumber}
                  onChange={(e) => setRollNumber(e.target.value)}
                  className="px-3 py-2.5 bg-white dark:bg-[#1F2330] border border-[#E8D9C0] dark:border-[#31374A] rounded-xl text-xs font-bold text-[#171923] dark:text-white focus:outline-none focus:border-[#800020] dark:focus:border-[#F47B20]"
                />
              </div>
            </section>
          </div>
        ) : (
          /* TAB 2: LIVE PDF PREVIEW SCREEN */
          <div className="flex-1 flex flex-col bg-[#F7EFE2] dark:bg-[#171923] overflow-hidden relative">
            {/* Preview Toolbar */}
            <div className="px-4 py-2.5 bg-white dark:bg-[#1F2330] border-b border-[#E8D9C0] dark:border-[#31374A] flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2 text-xs font-bold text-[#171923] dark:text-[#FFF9EF]">
                <Eye className="w-4 h-4 text-[#800020] dark:text-[#F47B20]" />
                <span>Page Preview ({filteredResult.count} Questions)</span>
              </div>

              {/* Zoom Controls */}
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setPreviewZoom((z) => Math.max(50, z - 15))}
                  className="w-7 h-7 rounded-lg bg-[#FFF9EF] dark:bg-[#252A3A] border border-[#E8D9C0] dark:border-[#31374A] flex items-center justify-center text-[#171923] dark:text-[#FFF9EF] hover:border-[#800020]"
                  title="Zoom Out"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <span className="text-[11px] font-bold tabular-nums text-[#5C5346] dark:text-[#C4B9A8] w-10 text-center">
                  {previewZoom}%
                </span>
                <button
                  onClick={() => setPreviewZoom((z) => Math.min(150, z + 15))}
                  className="w-7 h-7 rounded-lg bg-[#FFF9EF] dark:bg-[#252A3A] border border-[#E8D9C0] dark:border-[#31374A] flex items-center justify-center text-[#171923] dark:text-[#FFF9EF] hover:border-[#800020]"
                  title="Zoom In"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setPreviewZoom(100)}
                  className="w-8 h-7 rounded-lg bg-[#FFF9EF] dark:bg-[#252A3A] border border-[#E8D9C0] dark:border-[#31374A] flex items-center justify-center text-[#171923] dark:text-[#FFF9EF] hover:border-[#800020] text-[10px] font-extrabold tabular-nums"
                  title="Reset Zoom"
                >
                  100%
                </button>
              </div>
            </div>

            {/* Live Render Frame */}
            <div className="flex-1 overflow-auto p-4 flex justify-center items-start">
              <div
                className="bg-white shadow-2xl transition-all duration-150 origin-top rounded-md overflow-hidden border border-[#E8D9C0]"
                style={{
                  width: `${(794 * previewZoom) / 100}px`,
                  minHeight: `${(1123 * previewZoom) / 100}px`,
                }}
              >
                <iframe
                  title="DISHA 20-20 Live PDF Preview"
                  srcDoc={generatedHTML}
                  className="w-full h-full border-none min-h-[900px]"
                />
              </div>
            </div>
          </div>
        )}

        {/* SECTION E: ACTION BUTTONS (STICKY FOOTER) */}
        <footer className="p-4 bg-white dark:bg-[#1F2330] border-t border-[#E8D9C0] dark:border-[#31374A] shrink-0 flex flex-col gap-2">
          {/* Progress Indicator */}
          {isGeneratingPDF && pdfProgress && (
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs font-bold tabular-nums text-[#800020] dark:text-[#F47B20]">
                <span>{pdfProgress.message}</span>
                <span>{pdfProgress.percent}%</span>
              </div>
              <div className="w-full h-2 bg-[#F7EFE2] dark:bg-[#252A3A] rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-[#800020] to-[#F47B20] transition-all duration-200"
                  style={{ width: `${pdfProgress.percent}%` }}
                />
              </div>
            </div>
          )}

          {/* Primary Action Buttons */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <button
              id="btn-generate-pdf-primary"
              type="button"
              disabled={filteredResult.count === 0 || isGeneratingPDF}
              onClick={handleExport}
              className="col-span-2 py-2.5 px-4 rounded-xl bg-gradient-to-r from-[#800020] to-[#5E0017] hover:from-[#5E0017] hover:to-[#4A0012] dark:from-[#800020] dark:to-[#5E0017] dark:hover:from-[#650019] dark:hover:to-[#4A0012] text-white font-semibold text-xs sm:text-sm border border-[#C99A45]/35 shadow-sm active:scale-98 transition-all duration-180 cursor-pointer flex items-center justify-center gap-2 disabled:opacity-40 group"
            >
              {isGeneratingPDF ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Generating Export...</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4 text-[#C99A45] dark:text-white" />
                  <span>Generate & Download {formatCard === "json" ? "JSON" : "PDF"}</span>
                </>
              )}
            </button>

            <button
              id="btn-preview-pdf-secondary"
              type="button"
              disabled={filteredResult.count === 0}
              onClick={() => setActiveTab(activeTab === "config" ? "preview" : "config")}
              className="py-3 px-3 rounded-xl bg-[#FFF9EF] dark:bg-[#252A3A] border border-[#E8D9C0] dark:border-[#31374A] text-[#800020] dark:text-[#FFF9EF] font-bold text-xs hover:bg-[#F7EFE2] dark:hover:bg-[#31374A] transition-all cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-40"
            >
              <Eye className="w-4 h-4 text-[#F47B20]" />
              <span>{activeTab === "config" ? "Preview PDF" : "Edit Config"}</span>
            </button>

            <button
              id="btn-open-new-tab"
              type="button"
              disabled={filteredResult.count === 0}
              onClick={handleOpenNewTab}
              className="py-3 px-3 rounded-xl bg-[#F7EFE2] dark:bg-[#252A3A] border border-[#E8D9C0] dark:border-[#31374A] text-[#171923] dark:text-[#FFF9EF] font-bold text-xs hover:bg-[#E8D9C0]/60 dark:hover:bg-[#31374A] transition-all cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-40"
            >
              <Printer className="w-4 h-4 text-[#F47B20]" />
              <span>Print / Open</span>
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
};
