import React from "react";
import { motion, AnimatePresence } from "motion/react";
import { PYQPaper, PYQPaperAttempt, MCQSession, Question, ActiveTab } from "../types";
import {
  fetchPYQPapers,
  loadLocalPYQAttempts,
  recordPYQAttempt,
  savePYQPaper,
  subscribeToPublishedPYQPapers,
} from "../utils/pyqStorage";
import { exportQuestionsToPDF } from "../utils/pdfGenerator";
import { triggerHaptic, playClickSound } from "../utils/audioFeedback";
import { RichText } from "./RichText";
import { ParsedQuestion } from "./ParsedQuestion";
import {
  FileText,
  Filter,
  CheckCircle2,
  Clock,
  Award,
  BookOpen,
  Download,
  Play,
  Eye,
  X,
  Sparkles,
  Zap,
  Layers,
  HelpCircle,
  RefreshCw,
  ArrowLeft,
  Share2,
} from "lucide-react";
import ShareModal, { ShareData } from "./ShareModal";
import { buildPYQShareData } from "../utils/shareService";
import { InlineSpinner } from "./ui/LoadingScreen";

interface PYQVaultTabProps {
  onStartSession: (session: MCQSession) => void;
  onNavigateTab?: (tab: ActiveTab) => void;
  isAdmin?: boolean;
  onOpenAdminManage?: () => void;
}

export const PYQVaultTab: React.FC<PYQVaultTabProps> = ({
  onStartSession,
  onNavigateTab,
  isAdmin = false,
  onOpenAdminManage,
}) => {
  const [papers, setPapers] = React.useState<PYQPaper[]>([]);
  const [attempts, setAttempts] = React.useState<PYQPaperAttempt[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);

  // Filters - Year filter
  const [selectedYear, setSelectedYear] = React.useState<string>("all");

  // Solution Viewer Modal
  const [viewingSolutionPaper, setViewingSolutionPaper] = React.useState<PYQPaper | null>(null);
  const [activeQuestionIndex, setActiveQuestionIndex] = React.useState(0);
  const [fetchingPaperId, setFetchingPaperId] = React.useState<string | null>(null);

  // Share Modal State
  const [shareModalConfig, setShareModalConfig] = React.useState<{ isOpen: boolean; data: ShareData }>({
    isOpen: false,
    data: { title: "", url: "" },
  });

  const handleSharePYQ = (paper: PYQPaper) => {
    triggerHaptic("light");
    setShareModalConfig({
      isOpen: true,
      data: buildPYQShareData(paper),
    });
  };

  // Load Papers and Attempts with real-time onSnapshot sync
  React.useEffect(() => {
    setIsLoading(true);

    const unsubscribe = subscribeToPublishedPYQPapers((data) => {
      setPapers(data.filter((p) => p.isPublished !== false));
      setIsLoading(false);
    });

    const localAttempts = loadLocalPYQAttempts();
    setAttempts(localAttempts);

    return () => {
      unsubscribe();
    };
  }, []);

  // Year filter options
  const yearOptions = React.useMemo(() => {
    const set = new Set<string>();
    papers.forEach((p) => p.paperYear && set.add(p.paperYear));
    return ["all", ...Array.from(set)].sort((a, b) => b.localeCompare(a));
  }, [papers]);

  // Filtered Papers List (Filtered by Year)
  const filteredPapers = React.useMemo(() => {
    return papers.filter((paper) => {
      const matchYear = selectedYear === "all" || paper.paperYear === selectedYear;
      return matchYear;
    });
  }, [papers, selectedYear]);

  // Get best attempt for paper
  const getPaperBestAttempt = (paperId: string) => {
    const paperAttempts = attempts.filter((a) => a.paperId === paperId);
    if (paperAttempts.length === 0) return null;
    return paperAttempts.reduce((best, curr) => (curr.score > best.score ? curr : best));
  };

  // Safe Title Normalization Helper (prevents "6", "R", "", null, undefined)
  const getSafePaperTitle = (paper: PYQPaper): string => {
    const t = paper.title || (paper as any).name || (paper as any).paperTitle;
    if (
      !t ||
      typeof t !== "string" ||
      t.trim().length <= 2 ||
      ["undefined", "null", "nan"].includes(t.trim().toLowerCase())
    ) {
      return `${paper.examBoard || "Official"} ${paper.paperYear || ""} Previous Year Question Paper`.trim();
    }
    return t.trim();
  };

  // Handler to Start Full PYQ Exam Mode
  const handleStartPYQExam = async (paper: PYQPaper) => {
    if (fetchingPaperId) return;
    triggerHaptic("light");
    playClickSound();

    setFetchingPaperId(paper.id);

    try {
      const isCompleteQ = (q: any) =>
        Boolean(q && (q.text || q.question) && Array.isArray(q.options) && q.options.length >= 2);

      let rawQuestions: any[] = [];

      if (Array.isArray(paper.questions) && paper.questions.length > 0) {
        rawQuestions = paper.questions.filter(isCompleteQ);
      }

      if (rawQuestions.length === 0) {
        const { fetchMCQsByPYQPaper } = await import("../utils/pyqStorage");
        const fetched = await fetchMCQsByPYQPaper(paper.id);
        if (fetched && fetched.length > 0) {
          rawQuestions = fetched.filter(isCompleteQ);
        }
      }

      if (rawQuestions.length === 0) {
        const candidateIds = [
          ...(Array.isArray(paper.questions) ? paper.questions.map((q: any) => typeof q === "string" ? q : q?.id) : []),
          ...(Array.isArray((paper as any).questionIds) ? (paper as any).questionIds : [])
        ].filter(Boolean);

        if (candidateIds.length > 0) {
          const { loadUserQuestionsStore } = await import("../utils/questionsStorage");
          const store = loadUserQuestionsStore();
          const allQs = [...(store.customQuestions || []), ...(store.cloudCacheQuestions || [])];
          const qMap = new Map(allQs.map((q) => [q.id, q]));
          const matched = candidateIds.map((id) => qMap.get(id)).filter(isCompleteQ);
          if (matched.length > 0) {
            rawQuestions = matched;
          }
        }
      }

      if (rawQuestions.length === 0) {
        const { loadUserQuestionsStore } = await import("../utils/questionsStorage");
        const store = loadUserQuestionsStore();
        const allStoreQs = [...(store.customQuestions || []), ...(store.cloudCacheQuestions || [])].filter(isCompleteQ);
        if (allStoreQs.length > 0) {
          rawQuestions = allStoreQs.slice(0, 30);
        }
      }

      if (rawQuestions.length === 0) {
        const { getAllLocalMCQs } = await import("../utils/localDatabaseEngine");
        rawQuestions = await getAllLocalMCQs();
      }

      const extraQs = rawQuestions.map((q, idx) => ({
        ...q,
        id: q.id || `pyq_${paper.id}_q_${idx}`
      }));
      const questionIds = extraQs.map(q => q.id);

      onStartSession({
        title: getSafePaperTitle(paper),
        subtitle: `${paper.examBoard || "Official"} ${paper.paperYear || ""} • Official PYQ Exam`,
        questionIds: questionIds,
        source: "full-exam",
        testType: "pyq",
        isPYQ: true,
        pyqDetails: {
          ...paper,
          questions: extraQs,
          questionCount: extraQs.length,
        },
        isTestMode: true,
        isExamSimulation: true,
        timeLimitMinutes: paper.durationMinutes || 180,
        marksPerQuestion: paper.marksPerQuestion || 1,
        negativeMarking: paper.negativeMarking || 0.33,
        extraQuestions: extraQs,
      });
    } catch (e) {
      console.error("Failed to start PYQ exam session:", e);
    } finally {
      setFetchingPaperId(null);
    }
  };

  // Handler to Export PDF
  const handleExportPDF = (paper: PYQPaper) => {
    const rawList = Array.isArray(paper.questions) ? paper.questions : [];
    if (rawList.length === 0) {
      alert("No questions available in this paper for PDF export.");
      return;
    }
    triggerHaptic("light");
    playClickSound();

    const sanitized = rawList.map((q: any, idx: number) => ({
      ...q,
      id: q?.id || `pyq_${paper.id}_q_${idx + 1}`,
      text: q?.text || q?.question || `Question ${idx + 1}`,
      options: Array.isArray(q?.options) && q.options.length > 0
        ? q.options
        : ["(A) Option 1", "(B) Option 2", "(C) Option 3", "(D) Option 4"],
      correctIndex: typeof q?.correctIndex === "number" ? q.correctIndex : 0,
      explanation: q?.explanation || "",
    }));

    exportQuestionsToPDF({
      title: getSafePaperTitle(paper),
      subtitle: `${paper.examBoard || "Official"} • Official Question Paper (${paper.paperYear || ""})`,
      questions: sanitized,
      includeExplanations: true,
      filterType: "all",
    });
  };

  return (
    <div
      className="flex flex-col w-full min-h-full bg-[#FFF9EF] dark:bg-[#171923] pb-32 overflow-y-auto text-[#171923] dark:text-[#FFF9EF] select-none"
      id="pyq-vault-view"
    >
      {/* 1. HEADER DESIGN */}
      <header className="bg-white/95 dark:bg-[#1F2330]/95 backdrop-blur-md px-4 py-3 border-b border-[#E8D9C0] dark:border-[#31374A] sticky top-0 z-30 select-none shadow-[0_2px_10px_rgba(23,25,35,0.03)]">
        <div className="flex items-center justify-between gap-3 max-w-4xl mx-auto w-full">
          <div className="flex items-center gap-3 min-w-0">
            {onNavigateTab && (
              <button
                onClick={() => {
                  triggerHaptic("light");
                  onNavigateTab("home");
                }}
                className="w-9 h-9 rounded-xl bg-[#F7EFE2] hover:bg-[#E8D9C0]/60 dark:bg-[#252A3A] dark:hover:bg-[#31374A] flex items-center justify-center text-[#171923] dark:text-[#FFF9EF] active:scale-95 transition-all cursor-pointer shrink-0 border border-[#E8D9C0] dark:border-[#31374A]"
                aria-label="Back to home"
              >
                <ArrowLeft size={18} />
              </button>
            )}
            <div className="min-w-0">
              <h1 className="text-base sm:text-lg font-extrabold text-[#171923] dark:text-[#FFF9EF] leading-tight truncate">
                PYQ Vault
              </h1>
              <p className="text-[#800020] dark:text-[#C99A45] text-[11px] font-medium leading-none mt-0.5 truncate">
                Official Previous Year Papers (2013–2026)
              </p>
            </div>
          </div>

          {isAdmin && onOpenAdminManage && (
            <button
              onClick={() => {
                triggerHaptic("light");
                onOpenAdminManage();
              }}
              className="px-3 py-1.5 rounded-xl bg-[#800020] hover:bg-[#5E0017] dark:bg-[#F47B20] dark:hover:bg-[#E06A12] text-white font-extrabold text-xs shadow-sm active:scale-95 transition-all cursor-pointer shrink-0 flex items-center gap-1"
            >
              <span>+ Upload PYQ</span>
            </button>
          )}
        </div>
      </header>

      {/* MAIN CONTENT CONTAINER */}
      <main className="p-4 space-y-4 max-w-4xl mx-auto w-full">
        {/* 2. YEAR FILTER SECTION */}
        <section aria-label="Year Filters">
          <div className="bg-white dark:bg-[#1F2330] p-3 rounded-2xl border border-[#E8D9C0] dark:border-[#31374A] shadow-xs">
            <div className="flex items-center gap-2 overflow-x-auto pb-1 -mx-1 px-1 snap-x no-scrollbar">
              <div className="bg-[#800020]/10 dark:bg-[#F47B20]/15 p-2 rounded-xl text-[#800020] dark:text-[#F47B20] shrink-0 border border-[#800020]/20 dark:border-[#F47B20]/30">
                <Filter size={16} />
              </div>
              {yearOptions.map((yr) => {
                const isActive = selectedYear === yr;
                return (
                  <button
                    key={yr}
                    onClick={() => {
                      triggerHaptic("light");
                      setSelectedYear(yr);
                    }}
                    className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all shrink-0 snap-start active:scale-95 cursor-pointer tabular-nums ${
                      isActive
                        ? "bg-[#800020] dark:bg-[#F47B20] text-white shadow-sm"
                        : "bg-[#F7EFE2] dark:bg-[#252A3A] text-slate-600 dark:text-slate-300 border border-[#E8D9C0] dark:border-[#31374A] hover:text-[#171923] dark:hover:text-white"
                    }`}
                  >
                    {yr === "all" ? "All Years" : yr}
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        {/* 3. PREVIOUS YEAR PAPER CARDS LIST */}
        {isLoading ? (
          <div className="p-12 text-center bg-white dark:bg-[#1F2330] rounded-3xl border border-[#E8D9C0] dark:border-[#31374A] flex flex-col items-center shadow-xs">
            <RefreshCw size={28} className="text-[#800020] dark:text-[#F47B20] animate-spin mb-3" />
            <p className="font-extrabold text-sm text-[#171923] dark:text-[#FFF9EF]">
              Accessing PYQ Vault...
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Loading official question papers
            </p>
          </div>
        ) : filteredPapers.length === 0 ? (
          <div className="p-10 text-center bg-white dark:bg-[#1F2330] rounded-3xl border border-[#E8D9C0] dark:border-[#31374A] flex flex-col items-center shadow-xs">
            <div className="w-14 h-14 rounded-2xl bg-[#F7EFE2] dark:bg-[#252A3A] flex items-center justify-center text-[#800020] dark:text-[#F47B20] mb-3">
              <FileText size={28} />
            </div>
            <h3 className="font-extrabold text-sm text-[#171923] dark:text-[#FFF9EF] mb-1">
              No Papers Found for this Filter
            </h3>
            <p className="text-slate-500 dark:text-slate-400 text-xs mb-4 max-w-xs">
              No question papers available for year &quot;{selectedYear}&quot;. Try selecting &quot;All Years&quot;.
            </p>
            <button
              onClick={() => {
                triggerHaptic("light");
                setSelectedYear("all");
              }}
              className="px-4 py-2 rounded-xl bg-[#800020] dark:bg-[#F47B20] text-white text-xs font-bold active:scale-95 transition-all shadow-sm cursor-pointer"
            >
              Reset to All Years
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredPapers.map((paper) => {
              const bestAttempt = getPaperBestAttempt(paper.id);
              const safeTitle = getSafePaperTitle(paper);
              const questionCount =
                paper.questionCount || (paper.questions ? paper.questions.length : 0);
              const durationMinutes = paper.durationMinutes || 180;
              const totalMarks = paper.totalMarks || (questionCount > 0 ? questionCount * 2 : 200);

              return (
                <article
                  key={paper.id}
                  className="bg-white dark:bg-[#1F2330] rounded-3xl border border-[#E8D9C0] dark:border-[#31374A] p-4.5 shadow-[0_4px_20px_rgba(23,25,35,0.03)] space-y-4 transition-all"
                >
                  <div className="flex justify-between items-center gap-2">
                    <div className="flex items-center gap-2">
                      <span className="bg-[#800020]/10 dark:bg-[#F47B20]/15 text-[#800020] dark:text-[#F47B20] text-[10px] font-black uppercase px-2.5 py-1 rounded-lg tracking-wider border border-[#800020]/20 dark:border-[#F47B20]/30">
                        {paper.examBoard || "RPSC"}
                      </span>
                      <span className="bg-[#F7EFE2] dark:bg-[#252A3A] text-[#171923] dark:text-slate-200 text-[10px] font-bold px-2.5 py-1 rounded-lg border border-[#E8D9C0] dark:border-[#31374A] tabular-nums">
                        {paper.paperYear || "2023"}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      {bestAttempt && (
                        <span className="bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 text-[10px] font-black px-2.5 py-1 rounded-lg border border-emerald-200/50 dark:border-emerald-800/50 tabular-nums">
                          Best: {bestAttempt.score}/{bestAttempt.totalMarks}
                        </span>
                      )}
                      <button
                        onClick={() => handleSharePYQ(paper)}
                        className="p-2 rounded-xl bg-[#F7EFE2] dark:bg-[#252A3A] hover:bg-[#E8D9C0]/60 dark:hover:bg-[#31374A] text-[#800020] dark:text-[#F47B20] transition-all cursor-pointer border border-[#E8D9C0] dark:border-[#31374A] active:scale-95"
                        title="Share PYQ Paper"
                        aria-label="Share paper"
                      >
                        <Share2 size={15} />
                      </button>
                    </div>
                  </div>

                  <h3
                    onClick={() => handleStartPYQExam(paper)}
                    className="text-base sm:text-lg font-extrabold text-[#171923] dark:text-[#FFF9EF] leading-snug cursor-pointer hover:text-[#800020] dark:hover:text-[#F47B20] transition-colors font-hindi"
                  >
                    {safeTitle}
                  </h3>

                  <div className="grid grid-cols-3 gap-2 sm:gap-2.5">
                    <div className="bg-[#FFF9EF] dark:bg-[#171923] p-2.5 rounded-xl text-center border border-[#E8D9C0] dark:border-[#31374A] flex flex-col items-center justify-center">
                      <div className="flex items-center gap-1 mb-0.5 text-[#800020] dark:text-[#F47B20]">
                        <HelpCircle size={13} className="shrink-0" />
                        <p className="text-[9.5px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                          QUESTIONS
                        </p>
                      </div>
                      <p className="text-sm sm:text-base font-extrabold text-[#171923] dark:text-[#FFF9EF] tabular-nums">
                        {questionCount}
                      </p>
                    </div>

                    <div className="bg-[#FFF9EF] dark:bg-[#171923] p-2.5 rounded-xl text-center border border-[#E8D9C0] dark:border-[#31374A] flex flex-col items-center justify-center">
                      <div className="flex items-center gap-1 mb-0.5 text-emerald-700 dark:text-emerald-400">
                        <Clock size={13} className="shrink-0" />
                        <p className="text-[9.5px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                          DURATION
                        </p>
                      </div>
                      <p className="text-sm sm:text-base font-extrabold text-[#171923] dark:text-[#FFF9EF] tabular-nums">
                        {durationMinutes}m
                      </p>
                    </div>

                    <div className="bg-[#FFF9EF] dark:bg-[#171923] p-2.5 rounded-xl text-center border border-[#E8D9C0] dark:border-[#31374A] flex flex-col items-center justify-center">
                      <div className="flex items-center gap-1 mb-0.5 text-[#C99A45]">
                        <Award size={13} className="shrink-0" />
                        <p className="text-[9.5px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                          MARKS
                        </p>
                      </div>
                      <p className="text-sm sm:text-base font-extrabold text-[#171923] dark:text-[#FFF9EF] tabular-nums">
                        {totalMarks}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2.5 pt-1">
                    <button
                      id={`btn-start-pyq-${paper.id}`}
                      onClick={() => handleStartPYQExam(paper)}
                      className="bg-gradient-to-r from-[#F47B20] to-[#E06716] hover:brightness-105 active:scale-95 text-white py-2.5 px-2 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 border border-[#C99A45]/40 shadow-[0_3px_10px_rgba(244,123,32,0.3)] transition-all duration-180 cursor-pointer"
                    >
                      {fetchingPaperId === paper.id ? (
                         <InlineSpinner size="xs" />
                      ) : (
                         <Play size={14} fill="currentColor" />
                      )}
                      <span className="uppercase tracking-wider">{fetchingPaperId === paper.id ? "लोडिंग..." : "Exam"}</span>
                    </button>

                    <button
                      onClick={async () => {
                        triggerHaptic("light");
                        playClickSound();
                        
                        let paperWithQs = { ...paper };
                        if (!paper.questions || paper.questions.length === 0 || !paper.questions[0].text) {
                           setFetchingPaperId(paper.id);
                           try {
                             const { fetchMCQsByPYQPaper } = await import("../utils/pyqStorage");
                             const fetched = await fetchMCQsByPYQPaper(paper.id);
                             if (fetched && fetched.length > 0) {
                                paperWithQs.questions = fetched;
                             }
                           } catch (e) {
                             console.error("Failed to fetch questions for key", e);
                           } finally {
                             setFetchingPaperId(null);
                           }
                        }
                        
                        setViewingSolutionPaper(paperWithQs);
                        setActiveQuestionIndex(0);
                      }}
                      className="bg-white hover:bg-[#F7EFE2] dark:bg-[#1A2234] dark:hover:bg-[#252E42] border border-[#E8D9C0] dark:border-[#2C374E] text-[#171923] dark:text-[#FFF9EF] py-2.5 px-2 rounded-xl font-semibold text-xs flex items-center justify-center gap-1.5 active:scale-95 transition-all duration-180 cursor-pointer shadow-xs"
                    >
                      {fetchingPaperId === paper.id ? (
                        <InlineSpinner size="xs" />
                      ) : (
                        <Eye size={14} className="text-[#C99A45]" />
                      )}
                      <span className="uppercase tracking-wider">Key</span>
                    </button>

                    <button
                      onClick={() => handleExportPDF(paper)}
                      className="bg-white hover:bg-[#F7EFE2] dark:bg-[#252A3A] dark:hover:bg-[#31374A] border border-[#E8D9C0] dark:border-[#31374A] text-[#171923] dark:text-[#FFF9EF] py-2.5 px-2 rounded-xl font-semibold text-xs flex items-center justify-center gap-1.5 active:scale-95 transition-all duration-180 cursor-pointer shadow-xs"
                    >
                      <Download size={14} className="text-emerald-700 dark:text-emerald-400" />
                      <span className="uppercase tracking-wider">PDF</span>
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </main>

      {/* Answer Key / Solution Viewer Modal */}
      <AnimatePresence>
        {viewingSolutionPaper && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-[#171923]/70 backdrop-blur-xs flex items-end justify-center sm:items-center sm:p-5"
          >
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="bg-[#FFF9EF] dark:bg-[#171923] w-full max-w-lg h-[90vh] sm:h-[80vh] sm:rounded-[32px] rounded-t-[32px] flex flex-col overflow-hidden border border-[#E8D9C0] dark:border-[#31374A] shadow-2xl"
            >
              {/* Modal Header */}
              <div className="px-5 py-4 border-b border-[#E8D9C0] dark:border-[#31374A] flex items-center justify-between bg-white dark:bg-[#1F2330] shrink-0">
                <div className="min-w-0 pr-2">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-[10px] font-black text-[#800020] dark:text-[#C99A45] uppercase tracking-wider">
                      {viewingSolutionPaper.examBoard} · {viewingSolutionPaper.paperYear}
                    </span>
                  </div>
                  <h2 className="text-sm font-extrabold text-[#171923] dark:text-[#FFF9EF] truncate font-hindi">
                    {getSafePaperTitle(viewingSolutionPaper)}
                  </h2>
                </div>
                <button
                  onClick={() => {
                    triggerHaptic("light");
                    setViewingSolutionPaper(null);
                  }}
                  className="w-9 h-9 rounded-xl bg-[#F7EFE2] dark:bg-[#252A3A] text-[#171923] dark:text-[#FFF9EF] flex items-center justify-center active:scale-95 transition-transform cursor-pointer shrink-0"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Question Jump Bar */}
              <div className="px-4 py-2.5 border-b border-[#E8D9C0] dark:border-[#31374A] flex items-center gap-2 overflow-x-auto no-scrollbar shrink-0 bg-[#F7EFE2] dark:bg-[#1F2330]">
                {viewingSolutionPaper.questions.map((q, idx) => (
                  <button
                    key={`${q.id || 'q'}-${idx}`}
                    onClick={() => {
                      triggerHaptic("light");
                      setActiveQuestionIndex(idx);
                    }}
                    className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 transition-all cursor-pointer tabular-nums ${
                      activeQuestionIndex === idx
                        ? "bg-[#800020] dark:bg-[#F47B20] text-white shadow-sm scale-105"
                        : "bg-white dark:bg-[#252A3A] border border-[#E8D9C0] dark:border-[#31374A] text-slate-600 dark:text-slate-300"
                    }`}
                  >
                    {idx + 1}
                  </button>
                ))}
              </div>

              {/* Modal Body */}
              <div className="flex-1 overflow-y-auto p-5 space-y-5">
                {viewingSolutionPaper.questions[activeQuestionIndex] && (() => {
                  const q = viewingSolutionPaper.questions[activeQuestionIndex];
                  return (
                    <>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-500 dark:text-slate-400 tabular-nums">
                            Question {activeQuestionIndex + 1} of {viewingSolutionPaper.questions.length}
                          </span>
                          {q.conceptName && (
                            <span className="text-[10px] font-bold text-[#800020] dark:text-[#C99A45] uppercase">
                              {q.conceptName}
                            </span>
                          )}
                        </div>
                        <div className="p-4 bg-white dark:bg-[#1F2330] rounded-2xl border border-[#E8D9C0] dark:border-[#31374A]">
                          <ParsedQuestion text={q.text} fontSizeClass="text-sm sm:text-base" question={q} />
                        </div>
                      </div>

                      <div className="space-y-2.5">
                        <p className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                          Options &amp; Answer Key
                        </p>
                        {q.options.map((opt, optIdx) => {
                          const isCorrect = optIdx === q.correctIndex;
                          const labels = ["A", "B", "C", "D"];
                          return (
                            <div
                              key={optIdx}
                              className={`p-3.5 rounded-2xl border flex items-center justify-between transition-all ${
                                isCorrect
                                  ? "bg-emerald-50/90 dark:bg-emerald-950/30 border-emerald-400 dark:border-emerald-700 shadow-xs"
                                  : "bg-white dark:bg-[#1F2330] border-[#E8D9C0] dark:border-[#31374A]"
                              }`}
                            >
                              <div className="flex items-center gap-3 min-w-0 pr-2 flex-1">
                                <span
                                  className={`w-7 h-7 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 ${
                                    isCorrect
                                      ? "bg-emerald-700 text-white"
                                      : "bg-[#F7EFE2] dark:bg-[#252A3A] text-[#171923] dark:text-slate-300"
                                  }`}
                                >
                                  {labels[optIdx]}
                                </span>
                                <div
                                  className={`text-xs sm:text-sm font-bold flex-1 min-w-0 break-words [overflow-wrap:anywhere] ${
                                    isCorrect
                                      ? "text-emerald-900 dark:text-emerald-300"
                                      : "text-[#171923] dark:text-[#FFF9EF]"
                                  }`}
                                >
                                  <RichText text={opt} />
                                </div>
                              </div>
                              {isCorrect && <CheckCircle2 size={18} className="text-emerald-700 dark:text-emerald-400 shrink-0" />}
                            </div>
                          );
                        })}
                      </div>

                      {q.explanation && (
                        <div className="p-4 bg-[#F7EFE2]/70 dark:bg-[#1F2330] rounded-2xl border border-[#C99A45]/40 space-y-1.5">
                          <div className="flex items-center gap-2 text-[#800020] dark:text-[#C99A45]">
                            <Sparkles size={15} />
                            <span className="text-xs font-extrabold uppercase tracking-wider">Solution Explanation</span>
                          </div>
                          <div className="text-xs sm:text-sm text-[#171923] dark:text-slate-200 leading-relaxed font-medium">
                            <RichText text={q.explanation} enablePronunciation={true} />
                          </div>
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>

              {/* Modal Footer */}
              <div className="px-5 py-3.5 border-t border-[#E8D9C0] dark:border-[#31374A] flex items-center justify-between bg-white dark:bg-[#1F2330] shrink-0 gap-2">
                <button
                  disabled={activeQuestionIndex === 0}
                  onClick={() => {
                    triggerHaptic("light");
                    setActiveQuestionIndex((prev) => Math.max(0, prev - 1));
                  }}
                  className="flex-1 bg-[#F7EFE2] dark:bg-[#252A3A] text-[#171923] dark:text-slate-200 py-2.5 rounded-xl font-bold text-xs disabled:opacity-40 active:scale-95 transition-all cursor-pointer"
                >
                  Previous
                </button>
                <button
                  onClick={() => {
                    setViewingSolutionPaper(null);
                    handleStartPYQExam(viewingSolutionPaper);
                  }}
                  className="flex-1 bg-[#800020] hover:bg-[#5E0017] dark:bg-[#800020] dark:hover:bg-[#650019] text-white py-2.5 rounded-xl font-semibold text-xs border border-[#C99A45]/35 shadow-sm active:scale-95 transition-all duration-180 cursor-pointer"
                >
                  Start Exam Mode
                </button>
                <button
                  disabled={activeQuestionIndex === viewingSolutionPaper.questions.length - 1}
                  onClick={() => {
                    triggerHaptic("light");
                    setActiveQuestionIndex((prev) => Math.min(viewingSolutionPaper.questions.length - 1, prev + 1));
                  }}
                  className="flex-1 bg-[#F7EFE2] dark:bg-[#252A3A] text-[#171923] dark:text-slate-200 py-2.5 rounded-xl font-bold text-xs disabled:opacity-40 active:scale-95 transition-all cursor-pointer"
                >
                  Next
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Share Modal */}
      <ShareModal
        isOpen={shareModalConfig.isOpen}
        onClose={() => setShareModalConfig((prev) => ({ ...prev, isOpen: false }))}
        data={shareModalConfig.data}
      />
    </div>
  );
};
