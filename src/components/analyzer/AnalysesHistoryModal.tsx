import React from "react";
import { motion, AnimatePresence } from "motion/react";
import { ExamPaperAnalysis } from "../../types";
import { generateExamAnalysisPDF } from "../../utils/examPdfReport";
import {
  X,
  History,
  Trash2,
  Download,
  ChevronRight,
  Sparkles,
  Calendar,
  Layers,
} from "lucide-react";

interface AnalysesHistoryModalProps {
  analyses: ExamPaperAnalysis[];
  onSelectAnalysis: (analysis: ExamPaperAnalysis) => void;
  onDeleteAnalysis: (analysisId: string) => void;
  onClose: () => void;
}

export const AnalysesHistoryModal: React.FC<AnalysesHistoryModalProps> = ({
  analyses,
  onSelectAnalysis,
  onDeleteAnalysis,
  onClose,
}) => {
  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-[#171923]/75 backdrop-blur-xs">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="bg-[#FFF9EF] dark:bg-[#1F2330] rounded-3xl max-w-xl w-full max-h-[85vh] flex flex-col shadow-2xl border border-[#E8D9C0] dark:border-[#31374A] overflow-hidden"
        >
          {/* Header */}
          <div className="px-5 py-4 border-b border-[#E8D9C0] dark:border-[#31374A] flex items-center justify-between shrink-0 bg-white dark:bg-[#252A3A]">
            <div className="flex items-center gap-2">
              <History className="w-5 h-5 text-[#800020] dark:text-[#F47B20]" />
              <div>
                <h3 className="text-sm font-black text-[#171923] dark:text-[#FFF9EF]">
                  Past Exam Paper Analyses
                </h3>
                <p className="text-[11px] font-medium text-[#6E6254] dark:text-[#A39887]">
                  Revisit your previously matched examination papers
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 rounded-xl hover:bg-[#FFF9EF] dark:hover:bg-[#1F2330] text-[#6E6254] hover:text-[#800020] dark:hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* List */}
          <div className="p-4 overflow-y-auto space-y-3">
            {analyses.length === 0 ? (
              <div className="py-12 text-center text-[#6E6254] dark:text-[#A39887] space-y-2">
                <History className="w-8 h-8 mx-auto text-[#C99A45]" />
                <p className="text-xs font-bold text-[#171923] dark:text-[#FFF9EF]">
                  No previous analyses found
                </p>
                <p className="text-[11px] text-[#6E6254] dark:text-[#A39887]">
                  Scan or upload an exam paper to view coverage matches here.
                </p>
              </div>
            ) : (
              analyses.map((a) => {
                const total = a.detectedQuestionCount || a.questions?.length || 1;
                const relatedCount =
                  a.exactMatchCount +
                  a.nearExactMatchCount +
                  a.similarMatchCount +
                  a.conceptMatchCount;
                const relatedPct = Math.round((relatedCount / total) * 100);

                return (
                  <div
                    key={a.analysisId}
                    className="p-4 rounded-2xl bg-white dark:bg-[#252A3A] border border-[#E8D9C0] dark:border-[#31374A] hover:border-[#800020] dark:hover:border-[#F47B20] transition-all space-y-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div
                        onClick={() => {
                          onSelectAnalysis(a);
                          onClose();
                        }}
                        className="cursor-pointer flex-1 min-w-0"
                      >
                        <h4 className="text-xs sm:text-sm font-black text-[#171923] dark:text-[#FFF9EF] leading-tight">
                          {a.examName} ({a.paperYear})
                        </h4>
                        <div className="flex items-center gap-2 mt-1 text-[11px] tabular-nums text-[#6E6254] dark:text-[#A39887]">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3 text-[#F47B20]" />
                            {new Date(a.createdAt).toLocaleDateString()}
                          </span>
                          <span>•</span>
                          <span>{total} Questions</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            generateExamAnalysisPDF(a);
                          }}
                          className="p-2 rounded-xl text-[#6E6254] hover:text-[#800020] dark:hover:text-[#F47B20] hover:bg-[#FFF9EF] dark:hover:bg-[#1F2330] transition-colors"
                          title="Download PDF"
                        >
                          <Download className="w-4 h-4" />
                        </button>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteAnalysis(a.analysisId);
                          }}
                          className="p-2 rounded-xl text-[#6E6254] hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                          title="Delete Analysis"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* KPI badges */}
                    <div
                      onClick={() => {
                        onSelectAnalysis(a);
                        onClose();
                      }}
                      className="cursor-pointer grid grid-cols-2 gap-2 pt-1 border-t border-[#E8D9C0] dark:border-[#31374A] tabular-nums"
                    >
                      <div className="px-2.5 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 text-[11px] font-bold">
                        Exact Matches: {a.exactMatchCount}
                      </div>

                      <div className="px-2.5 py-1.5 rounded-xl bg-[#800020]/10 dark:bg-[#F47B20]/15 text-[#800020] dark:text-[#F47B20] text-[11px] font-bold">
                        Related Coverage: {relatedPct}%
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
