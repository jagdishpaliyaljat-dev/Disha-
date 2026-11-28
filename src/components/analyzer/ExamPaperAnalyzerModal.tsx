import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Subject,
  Chapter,
  Question,
  MCQSession,
  ExamPaperAnalysis,
  ExtractedQuestionDraft,
  ExamQuestionMatch,
  ExamMatchCategory,
} from "../../types";
import { PaperUploadSection, UploadedFileItem, ExamMetadata } from "./PaperUploadSection";
import { ExtractionReviewSection } from "./ExtractionReviewSection";
import { AnalysisReportView } from "./AnalysisReportView";
import { QuestionComparisonModal } from "./QuestionComparisonModal";
import { AnalysesHistoryModal } from "./AnalysesHistoryModal";
import {
  saveExamAnalysis,
  getAnalysesHistory,
  deleteLocalAnalysis,
  clearAllLocalAnalyses,
  updateQuestionMatchReview,
} from "../../utils/examPaperStorage";
import {
  extractQuestionsFromImage,
  extractQuestionsFromText,
} from "../../utils/examOcrExtractor";
import {
  matchQuestionAgainstBank,
  calculateCoverageMetrics,
} from "../../utils/examMatcher";
import { apiFetch } from "../../utils/api";
import { recordAIUsage } from "../../utils/aiUsageTracker";
import { ApiSettingsModal } from "../ApiSettingsModal";
import {
  X,
  Sparkles,
  ArrowLeft,
  History,
  FileCheck,
  CheckCircle2,
  AlertCircle,
  Key,
  Loader2,
} from "lucide-react";
import { InlineSpinner } from "../ui/LoadingScreen";

interface ExamPaperAnalyzerModalProps {
  isOpen: boolean;
  onClose: () => void;
  subjects: Subject[];
  chapters: Chapter[];
  questions: Question[];
  onStartSession?: (session: MCQSession) => void;
  onNavigateToChapter?: (chapterId: string) => void;
}

export const ExamPaperAnalyzerModal: React.FC<ExamPaperAnalyzerModalProps> = ({
  isOpen,
  onClose,
  subjects,
  chapters,
  questions,
  onStartSession,
  onNavigateToChapter,
}) => {
  // Step state: "upload" | "review_extracted" | "report"
  const [currentStep, setCurrentStep] = useState<"upload" | "review_extracted" | "report">("upload");
  const [extractedQuestions, setExtractedQuestions] = useState<ExtractedQuestionDraft[]>([]);
  const [activeAnalysis, setActiveAnalysis] = useState<ExamPaperAnalysis | null>(null);
  const [savedAnalyses, setSavedAnalyses] = useState<ExamPaperAnalysis[]>([]);

  // Sub-modals
  const [selectedMatchForComparison, setSelectedMatchForComparison] = useState<ExamQuestionMatch | null>(null);
  const [showHistoryModal, setShowHistoryModal] = useState(false);

  // Loading & status states
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractionProgress, setExtractionProgress] = useState("");
  const [extractionError, setExtractionError] = useState<string | null>(null);
  const [requiresApiKey, setRequiresApiKey] = useState(false);
  const [isApiSettingsOpen, setIsApiSettingsOpen] = useState(false);
  const [isMatching, setIsMatching] = useState(false);
  const [matchingStatusText, setMatchingStatusText] = useState("");
  const [activeMetadata, setActiveMetadata] = useState<ExamMetadata | null>(null);

  // Load history on mount or open
  useEffect(() => {
    if (isOpen) {
      getAnalysesHistory().then((list) => {
        setSavedAnalyses(list);
      });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // 1. Handle Start Analysis (OCR & Extraction step)
  const handleStartAnalysis = async (
    files: UploadedFileItem[],
    rawText: string,
    metadata: ExamMetadata
  ) => {
    setActiveMetadata(metadata);
    setIsExtracting(true);
    setExtractionError(null);
    setRequiresApiKey(false);
    setExtractionProgress("Initializing AI Exam OCR Engine...");

    const allQuestions: ExtractedQuestionDraft[] = [];

    try {
      // Flow A: Multi-page or Single-page Image/PDF Upload
      if (files && files.length > 0) {
        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          setExtractionProgress(
            files.length > 1
              ? `Scanning page ${i + 1} of ${files.length} with AI Vision...`
              : "Scanning exam paper with Gemini Vision OCR..."
          );

          const lightFile = {
            id: file.id,
            name: file.name,
            mimeType: file.mimeType,
            pageNumber: file.pageNumber || i + 1,
            base64Data: file.base64Data,
          };

          const response = await apiFetch("/api/exam-paper/extract", {
            method: "POST",
            body: JSON.stringify({
              files: [lightFile],
              examMetadata: metadata,
            }),
          }).catch((err) => {
            console.warn(`Extraction request failed for page ${i + 1}:`, err);
            return null;
          });

          if (response && response.ok) {
            const data = await response.json();
            if (data.requiresApiKey) {
              setRequiresApiKey(true);
              setExtractionError(
                data.error ||
                  "Google Gemini API Key is required to scan images. Please configure your key in AI API Settings."
              );
              setIsExtracting(false);
              return;
            }

            if (Array.isArray(data.questions) && data.questions.length > 0) {
              allQuestions.push(...data.questions);
            }
          }
        }
      }

      // Flow B: Pasted Exam Text or Uploaded JSON
      if (rawText && rawText.trim()) {
        setExtractionProgress("Parsing questions and options with AI...");

        const response = await apiFetch("/api/exam-paper/extract", {
          method: "POST",
          body: JSON.stringify({
            rawText,
            examMetadata: metadata,
          }),
        }).catch((err) => {
          console.warn("Server text extraction notice:", err);
          return null;
        });

        if (response && response.ok) {
          const data = await response.json();
          if (Array.isArray(data.questions) && data.questions.length > 0) {
            allQuestions.push(...data.questions);
          }
        }

        // Local smart regex parser fallback for pasted text
        if (allQuestions.length === 0) {
          const localParsed = await extractQuestionsFromText(rawText);
          if (localParsed.length > 0) {
            allQuestions.push(...localParsed);
          }
        }
      }

      if (allQuestions.length > 0) {
        // Re-number sequentially if duplicates exist
        const normalized = allQuestions.map((q, idx) => ({
          ...q,
          originalQuestionNumber: q.originalQuestionNumber || idx + 1,
        }));
        setExtractedQuestions(normalized);
        setCurrentStep("review_extracted");

        recordAIUsage({
          queryType: "exam_ocr_extraction",
          model: "gemini-2.0-flash",
          inputChars: rawText ? rawText.length : 1500,
          outputChars: JSON.stringify(normalized).length,
          status: "success",
          promptSnippet: `Exam paper extraction: ${files.length} files, ${normalized.length} questions`,
          responseSnippet: `Extracted ${normalized.length} questions`,
        });
      } else {
        setExtractionError(
          files && files.length > 0
            ? "Could not detect readable multiple-choice questions from this document/image. Please make sure the paper is sharp, well-lit, upright, or try pasting the questions directly in 'Paste Exam Text'."
            : "Could not parse multiple-choice questions from the provided text. Please ensure question statements and options (A, B, C, D) are present."
        );
      }
    } catch (err: any) {
      console.warn("Scan AI extraction error:", err);
      // Attempt local regex fallback if raw text was provided
      if (rawText && rawText.trim()) {
        const localParsed = await extractQuestionsFromText(rawText);
        if (localParsed.length > 0) {
          setExtractedQuestions(localParsed);
          setCurrentStep("review_extracted");
          return;
        }
      }

      setExtractionError(
        err?.message ||
          "An unexpected error occurred while processing the exam paper. Please check your network connection or API settings."
      );
    } finally {
      setIsExtracting(false);
      setExtractionProgress("");
    }
  };

  // 2. Handle Proceed to Matching (Matches against Question Bank)
  const handleProceedToMatch = async (reviewedDrafts: ExtractedQuestionDraft[]) => {
    setIsMatching(true);
    setMatchingStatusText("Normalizing questions and searching Question Bank...");

    let targetBank = questions;
    if (activeMetadata?.selectedSubjectId && activeMetadata.selectedSubjectId !== "all") {
      targetBank = questions.filter(
        (q) => (q.subjectId || "economics") === activeMetadata.selectedSubjectId
      );
    }

    try {
      setMatchingStatusText("Executing staged hybrid matching & AI semantic comparison...");

      const response = await apiFetch("/api/exam-paper/match", {
        method: "POST",
        body: JSON.stringify({
          extractedQuestions: reviewedDrafts,
          questionBank: targetBank,
          examMetadata: activeMetadata || {},
        }),
      }).catch((fetchErr) => {
        console.warn("API match fetch unavailable, using client-side matcher:", fetchErr);
        return null;
      });

      if (response && response.ok) {
        const data = await response.json();
        if (data.analysis) {
          setActiveAnalysis(data.analysis);
          await saveExamAnalysis(data.analysis);
          setSavedAnalyses((prev) => [data.analysis, ...prev]);
          setCurrentStep("report");
          setIsMatching(false);
          return;
        }
      }

      // Offline / Fallback Matcher: Run deterministic algorithm locally
      const localMatches: ExamQuestionMatch[] = reviewedDrafts.map((draft) =>
        matchQuestionAgainstBank(draft, targetBank)
      );

      const coverage = calculateCoverageMetrics(localMatches);
      const localAnalysis: ExamPaperAnalysis = {
        analysisId: `analysis-local-${Date.now()}`,
        userId: "local-user",
        examId: activeMetadata?.examId || "exam",
        examName: activeMetadata?.examName || "Real Examination Paper",
        paperYear: activeMetadata?.paperYear || "2023",
        paperDate: activeMetadata?.paperDate || new Date().toISOString().split("T")[0],
        paperName: activeMetadata?.paperName || "General Paper",
        shiftCode: activeMetadata?.shiftCode || "",
        status: "completed",
        totalPages: 1,
        detectedQuestionCount: localMatches.length,
        analyzedQuestionCount: localMatches.length,
        exactMatchCount: coverage.exact,
        nearExactMatchCount: coverage.nearExact,
        similarMatchCount: coverage.similar,
        conceptMatchCount: coverage.concept,
        unmatchedCount: coverage.unmatched,
        needsReviewCount: coverage.needsReview,
        createdAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        schemaVersion: 1,
        questions: localMatches,
      };

      setActiveAnalysis(localAnalysis);
      await saveExamAnalysis(localAnalysis);
      setSavedAnalyses((prev) => [localAnalysis, ...prev]);
      setCurrentStep("report");
    } catch (err) {
      console.warn("Matching fallback triggered:", err);
      const localMatches: ExamQuestionMatch[] = reviewedDrafts.map((draft) =>
        matchQuestionAgainstBank(draft, targetBank)
      );
      const coverage = calculateCoverageMetrics(localMatches);
      const localAnalysis: ExamPaperAnalysis = {
        analysisId: `analysis-local-${Date.now()}`,
        userId: "local-user",
        examId: activeMetadata?.examId || "exam",
        examName: activeMetadata?.examName || "Real Examination Paper",
        paperYear: activeMetadata?.paperYear || "2023",
        paperDate: activeMetadata?.paperDate || new Date().toISOString().split("T")[0],
        paperName: activeMetadata?.paperName || "General Paper",
        shiftCode: activeMetadata?.shiftCode || "",
        status: "completed",
        totalPages: 1,
        detectedQuestionCount: localMatches.length,
        analyzedQuestionCount: localMatches.length,
        exactMatchCount: coverage.exact,
        nearExactMatchCount: coverage.nearExact,
        similarMatchCount: coverage.similar,
        conceptMatchCount: coverage.concept,
        unmatchedCount: coverage.unmatched,
        needsReviewCount: coverage.needsReview,
        createdAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        schemaVersion: 1,
        questions: localMatches,
      };
      setActiveAnalysis(localAnalysis);
      await saveExamAnalysis(localAnalysis);
      setSavedAnalyses((prev) => [localAnalysis, ...prev]);
      setCurrentStep("report");
    } finally {
      setIsMatching(false);
    }
  };

  // 3. Handle Manual Review Override on a question
  const handleUpdateCategory = async (
    examQuestionId: string,
    newCategory: ExamMatchCategory,
    notes?: string
  ) => {
    if (!activeAnalysis) return;

    const updated = await updateQuestionMatchReview(
      activeAnalysis.analysisId,
      examQuestionId,
      newCategory,
      notes
    );

    if (updated) {
      setActiveAnalysis({ ...updated });
    }
  };

  // 4. Handle "Open in Question Bank"
  const handleOpenInQuestionBank = (questionId: string) => {
    if (!onStartSession) return;
    const found = questions.find((q) => q.id === questionId);
    if (found) {
      onStartSession({
        title: `Question Bank View`,
        subtitle: `Exam Matched Question`,
        questionIds: [questionId],
        source: "topic",
        topicId: found.topicId,
        chapterId: found.chapterId,
        subjectId: found.subjectId,
        isTestMode: false,
      });
      onClose();
    }
  };

  // Delete analysis
  const handleDeleteAnalysis = (analysisId: string) => {
    deleteLocalAnalysis(analysisId);
    setSavedAnalyses((prev) => prev.filter((a) => a.analysisId !== analysisId));
    if (activeAnalysis?.analysisId === analysisId) {
      setActiveAnalysis(null);
      setCurrentStep("upload");
    }
  };

  // Clear all analyses strictly from local device
  const handleClearAllAnalyses = async () => {
    await clearAllLocalAnalyses();
    setSavedAnalyses([]);
    setActiveAnalysis(null);
    setCurrentStep("upload");
  };

  return (
    <div className="fixed inset-x-0 top-0 bottom-[60px] md:bottom-0 z-40 overflow-y-auto bg-[#F8FAFC] dark:bg-[#130E26] flex flex-col pb-32 md:pb-12">
      {/* Top Navigation Bar with Step Progression */}
      <header className="sticky top-0 z-30 bg-white/95 dark:bg-[#130E26]/95 backdrop-blur-md border-b border-slate-200 dark:border-[#31275E] px-3.5 sm:px-5 pt-[calc(0.625rem+env(safe-area-inset-top,0px))] pb-2.5 shadow-2xs">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => {
                if (currentStep === "report") setCurrentStep("upload");
                else if (currentStep === "review_extracted") setCurrentStep("upload");
                else onClose();
              }}
              className="p-2 rounded-xl bg-white dark:bg-[#241D48] border border-slate-200 dark:border-[#31275E] text-[#7045D8] dark:text-slate-50 hover:border-[#7045D8] transition-colors cursor-pointer shadow-2xs"
              title="Go Back"
            >
              <ArrowLeft className="w-4.5 h-4.5" />
            </button>

            <div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <Sparkles className="w-4 h-4 text-[#7045D8] dark:text-[#A78BFA]" />
                <h1 className="text-sm font-black text-slate-900 dark:text-slate-50 leading-tight">
                  AI Exam Paper Analyzer
                </h1>
                <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-[#7045D8] text-[#FFFFFF] border border-[#A78BFA]/30">
                  Disha PYQ
                </span>
              </div>
              <p className="text-[10px] font-medium text-slate-500 dark:text-slate-400">
                {currentStep === "upload" && "Upload or capture exam paper to cross-match syllabus questions"}
                {currentStep === "review_extracted" && "Review extracted questions before database matching"}
                {currentStep === "report" && "Verified coverage & question similarity analysis"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setShowHistoryModal(true)}
              className="px-2.5 py-1.5 rounded-xl bg-white dark:bg-[#241D48] border border-slate-200 dark:border-[#31275E] hover:border-[#7045D8] text-[#7045D8] dark:text-slate-50 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
              title="Analysis History"
            >
              <History className="w-3.5 h-3.5 text-[#7045D8] dark:text-[#A78BFA]" />
              <span className="hidden sm:inline">History</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-[#31275E] text-slate-500 hover:text-[#7045D8] dark:hover:text-white transition-colors cursor-pointer"
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 3-Step Breadcrumbs Bar */}
        <div className="max-w-4xl mx-auto mt-2 pt-2 border-t border-slate-200/50 dark:border-[#31275E]/50 flex items-center justify-between gap-1 text-[11px]">
          <div
            className={`flex-1 flex items-center justify-center gap-1.5 py-1 px-2 rounded-lg transition-all ${
              currentStep === "upload"
                ? "bg-[#7045D8]/10 dark:bg-[#7045D8]/25 text-[#7045D8] dark:text-[#A78BFA] font-black border border-[#7045D8]/25"
                : "text-slate-500 dark:text-slate-400 font-medium"
            }`}
          >
            <span className="w-4 h-4 rounded-full bg-[#7045D8] text-white text-[9px] font-black flex items-center justify-center">
              1
            </span>
            <span>Upload & Scan</span>
          </div>

          <span className="text-slate-400 text-xs">➔</span>

          <div
            className={`flex-1 flex items-center justify-center gap-1.5 py-1 px-2 rounded-lg transition-all ${
              currentStep === "review_extracted"
                ? "bg-[#7045D8]/10 dark:bg-[#7045D8]/25 text-[#7045D8] dark:text-[#A78BFA] font-black border border-[#7045D8]/25"
                : "text-slate-500 dark:text-slate-400 font-medium"
            }`}
          >
            <span className={`w-4 h-4 rounded-full text-white text-[9px] font-black flex items-center justify-center ${
              currentStep === "report" ? "bg-emerald-600" : currentStep === "review_extracted" ? "bg-[#7045D8]" : "bg-stone-400"
            }`}>
              2
            </span>
            <span>Review OCR</span>
          </div>

          <span className="text-slate-400 text-xs">➔</span>

          <div
            className={`flex-1 flex items-center justify-center gap-1.5 py-1 px-2 rounded-lg transition-all ${
              currentStep === "report"
                ? "bg-[#7045D8]/10 dark:bg-[#7045D8]/25 text-[#7045D8] dark:text-[#A78BFA] font-black border border-[#7045D8]/25"
                : "text-slate-500 dark:text-slate-400 font-medium"
            }`}
          >
            <span className={`w-4 h-4 rounded-full text-white text-[9px] font-black flex items-center justify-center ${
              currentStep === "report" ? "bg-[#7045D8]" : "bg-stone-400"
            }`}>
              3
            </span>
            <span>Match Report</span>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 p-4 sm:p-6 max-w-4xl w-full mx-auto">
        {/* Real-time Extraction Status Banner */}
        {isExtracting && extractionProgress && (
          <div className="mb-4 p-4 rounded-2xl bg-white dark:bg-[#1B1536] border border-[#7045D8]/30 flex items-center gap-3.5 shadow-xs">
            <InlineSpinner size="md" />
            <div>
              <p className="text-xs font-bold text-slate-900 dark:text-slate-50">{extractionProgress}</p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">Processing Hindi & English text with Disha PYQ Vision OCR...</p>
            </div>
          </div>
        )}

        {/* Extraction Error Alert */}
        {extractionError && (
          <div className="mb-4 p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
            <div className="flex items-start gap-2.5">
              <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold text-rose-900 dark:text-rose-200">{extractionError}</p>
                <p className="text-[11px] text-rose-600 dark:text-rose-400 mt-0.5">
                  Make sure the exam paper is clear and right-side-up, or configure your Gemini API Key.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
              <button
                onClick={() => setIsApiSettingsOpen(true)}
                className="px-3 py-1.5 rounded-xl bg-[#7045D8] hover:bg-[#5B32BF] dark:bg-[#7045D8] dark:hover:bg-[#5B32BF] text-white font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
              >
                <Key className="w-3.5 h-3.5" />
                <span>AI Settings</span>
              </button>
              <button
                onClick={() => setExtractionError(null)}
                className="p-1 rounded-lg text-rose-400 hover:text-rose-600 transition-colors cursor-pointer"
                title="Dismiss"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {currentStep === "upload" && (
          <PaperUploadSection
            subjects={subjects}
            onStartAnalysis={handleStartAnalysis}
            isLoading={isExtracting}
            onOpenHistory={() => setShowHistoryModal(true)}
          />
        )}

        {currentStep === "review_extracted" && (
          <ExtractionReviewSection
            questions={extractedQuestions}
            totalPages={1}
            onProceedToMatch={handleProceedToMatch}
            onBackToUpload={() => setCurrentStep("upload")}
            isMatching={isMatching}
          />
        )}

        {currentStep === "report" && activeAnalysis && (
          <AnalysisReportView
            analysis={activeAnalysis}
            onOpenQuestionComparison={(match) => setSelectedMatchForComparison(match)}
            onStartSession={onStartSession}
            onNewAnalysis={() => setCurrentStep("upload")}
            onOpenHistory={() => setShowHistoryModal(true)}
          />
        )}
      </main>

      {/* Question Comparison Modal */}
      {selectedMatchForComparison && (
        <QuestionComparisonModal
          questionMatch={selectedMatchForComparison}
          onClose={() => setSelectedMatchForComparison(null)}
          onOpenInQuestionBank={handleOpenInQuestionBank}
          onUpdateCategory={handleUpdateCategory}
          availableQuestions={questions}
        />
      )}

      {/* History Modal */}
      {showHistoryModal && (
        <AnalysesHistoryModal
          analyses={savedAnalyses}
          onSelectAnalysis={(a) => {
            setActiveAnalysis(a);
            setCurrentStep("report");
          }}
          onDeleteAnalysis={handleDeleteAnalysis}
          onClearAll={handleClearAllAnalyses}
          onClose={() => setShowHistoryModal(false)}
        />
      )}

      {/* AI API Settings Modal */}
      {isApiSettingsOpen && (
        <ApiSettingsModal onClose={() => setIsApiSettingsOpen(false)} />
      )}
    </div>
  );
};
