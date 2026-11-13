import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  ExamQuestionMatch,
  ExamMatchCategory,
  Question,
} from "../../types";
import { RichText } from "../RichText";
import {
  X,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  BookOpen,
  ArrowRight,
  ShieldAlert,
  Sparkles,
  Info,
  Edit3,
} from "lucide-react";

interface QuestionComparisonModalProps {
  questionMatch: ExamQuestionMatch | null;
  onClose: () => void;
  onOpenInQuestionBank?: (questionId: string) => void;
  onUpdateCategory?: (
    examQuestionId: string,
    newCategory: ExamMatchCategory,
    notes?: string
  ) => void;
  availableQuestions?: Question[];
}

export const QuestionComparisonModal: React.FC<QuestionComparisonModalProps> = ({
  questionMatch,
  onClose,
  onOpenInQuestionBank,
  onUpdateCategory,
  availableQuestions = [],
}) => {
  const [selectedCategory, setSelectedCategory] = useState<ExamMatchCategory | null>(
    questionMatch?.primaryMatchCategory || null
  );
  const [reviewNotes, setReviewNotes] = useState("");
  const [isSaved, setIsSaved] = useState(false);

  if (!questionMatch) return null;

  const handleSaveReview = () => {
    if (selectedCategory && onUpdateCategory) {
      onUpdateCategory(questionMatch.examQuestionId, selectedCategory, reviewNotes);
      setIsSaved(true);
      setTimeout(() => {
        setIsSaved(false);
        onClose();
      }, 700);
    }
  };

  const getBadgeStyle = (cat: ExamMatchCategory) => {
    switch (cat) {
      case "exact":
        return "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800";
      case "near_exact":
        return "bg-teal-100 text-teal-800 dark:bg-teal-950/60 dark:text-teal-300 border-teal-300 dark:border-teal-800";
      case "similar":
        return "bg-[#F47B20]/15 text-[#9A3412] dark:text-[#F47B20] border-[#F47B20]/40";
      case "concept_related":
        return "bg-[#800020]/10 text-[#800020] dark:bg-[#800020]/25 dark:text-[#C99A45] border-[#800020]/30 dark:border-[#C99A45]/40";
      default:
        return "bg-[#F7EFE2] text-[#5C5346] dark:bg-[#252A3A] dark:text-[#C4B9A8] border-[#E8D9C0] dark:border-[#31374A]";
    }
  };

  const getCategoryTitle = (cat: ExamMatchCategory) => {
    switch (cat) {
      case "exact":
        return "Exact Match";
      case "near_exact":
        return "Near-Exact Match";
      case "similar":
        return "Similar Question";
      case "concept_related":
        return "Related Concept";
      default:
        return "No Reliable Match";
    }
  };

  const getHindiSubtitle = (cat: ExamMatchCategory) => {
    switch (cat) {
      case "exact":
        return "Word-for-word exact question match";
      case "near_exact":
        return "Similar wording with identical answer";
      case "similar":
        return "Shared core facts and question structure";
      case "concept_related":
        return "Related topic and concept";
      default:
        return "No verified match in question bank";
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-[#171923]/75 backdrop-blur-xs">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="bg-[#FFF9EF] dark:bg-[#1F2330] rounded-3xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-[#E8D9C0] dark:border-[#31374A] overflow-hidden"
        >
          {/* Header */}
          <div className="px-5 py-4 border-b border-[#E8D9C0] dark:border-[#31374A] flex items-center justify-between shrink-0 bg-white dark:bg-[#252A3A]">
            <div className="flex items-center gap-2.5">
              <span className="w-8 h-8 rounded-xl bg-[#800020] text-[#FFF9EF] font-black text-xs tabular-nums flex items-center justify-center">
                Q{questionMatch.originalQuestionNumber}
              </span>
              <div>
                <h3 className="text-sm font-black text-[#171923] dark:text-[#FFF9EF]">
                  Exam Question vs DISHA 20-20 Question Bank
                </h3>
                <p className="text-[11px] font-medium tabular-nums text-[#6E6254] dark:text-[#A39887]">
                  Source Page: {questionMatch.sourcePageNumber} • Score: {questionMatch.matchScore}%
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

          {/* Body */}
          <div className="p-4 sm:p-5 overflow-y-auto space-y-4 text-xs">
            {/* Match Status Banner */}
            <div
              className={`p-4 rounded-2xl border flex items-start gap-3 ${getBadgeStyle(
                questionMatch.primaryMatchCategory
              )}`}
            >
              <Sparkles className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="space-y-1 min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                  <span className="font-black text-sm tracking-tight">
                    {getCategoryTitle(questionMatch.primaryMatchCategory)}
                  </span>
                  <span className="opacity-50" aria-hidden="true">·</span>
                  <span className="text-[11px] font-bold tabular-nums">
                    {questionMatch.matchScore}% Confidence
                  </span>
                  <span className="opacity-50" aria-hidden="true">·</span>
                  <span className="text-[11px] font-medium opacity-90">
                    {getHindiSubtitle(questionMatch.primaryMatchCategory)}
                  </span>
                </div>
                <p className="text-[11.5px] leading-relaxed opacity-95">
                  {questionMatch.matchExplanation || "Evaluated by DISHA 20-20 AI Question Matcher."}
                </p>
              </div>
            </div>

            {/* Meaningful Differences (if any) */}
            {questionMatch.meaningfulDifferences && questionMatch.meaningfulDifferences.length > 0 && (
              <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/40 rounded-2xl">
                <div className="flex items-center gap-1.5 text-amber-800 dark:text-amber-300 font-bold mb-1">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>Important Differences Detected:</span>
                </div>
                <ul className="list-disc list-inside space-y-1 text-amber-900 dark:text-amber-200/90 text-[11px]">
                  {questionMatch.meaningfulDifferences.map((diff, i) => (
                    <li key={i}>{diff}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Comparison Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {/* Left Column: Exam Paper Question */}
              <div className="p-3.5 rounded-2xl bg-white dark:bg-[#252A3A] border border-[#E8D9C0] dark:border-[#31374A] space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase text-[#6E6254] dark:text-[#A39887] tracking-wider">
                    Exam Paper Question
                  </span>
                  <span className="text-[10px] font-bold tabular-nums text-[#6E6254] dark:text-[#A39887]">
                    Page {questionMatch.sourcePageNumber}
                  </span>
                </div>

                <p className="text-[#171923] dark:text-[#FFF9EF] font-semibold leading-relaxed whitespace-pre-line">
                  {questionMatch.originalText}
                </p>

                {questionMatch.extractedOptions && questionMatch.extractedOptions.length > 0 && (
                  <div className="space-y-1 pt-1">
                    <span className="text-[10px] font-bold text-[#6E6254] dark:text-[#A39887] uppercase">Extracted Options:</span>
                    {questionMatch.extractedOptions.map((opt, i) => (
                      <div
                        key={i}
                        className="px-2.5 py-1.5 rounded-xl bg-[#FFF9EF] dark:bg-[#1F2330] border border-[#E8D9C0] dark:border-[#31374A] text-[11px] text-[#171923] dark:text-[#FFF9EF] flex items-start gap-1.5"
                      >
                        <span className="font-bold text-[#800020] dark:text-[#F47B20]">{String.fromCharCode(65 + i)}.</span>
                        <span>{opt}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Right Column: Question Bank Match */}
              <div className="p-3.5 rounded-2xl bg-white dark:bg-[#252A3A] border-2 border-[#C99A45]/60 dark:border-[#F47B20]/40 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase text-[#800020] dark:text-[#F47B20] tracking-wider">
                    DISHA 20-20 Question Bank Match
                  </span>
                  {questionMatch.bestMatchQuestionId && (
                    <span className="text-[10px] font-mono text-[#800020] dark:text-[#F47B20]">
                      ID: {questionMatch.bestMatchQuestionId.slice(0, 10)}
                    </span>
                  )}
                </div>

                {questionMatch.bestMatchQuestion ? (
                  <>
                    <p className="text-[#171923] dark:text-[#FFF9EF] font-semibold leading-relaxed whitespace-pre-line">
                      {questionMatch.bestMatchQuestion.text}
                    </p>

                    {questionMatch.bestMatchQuestion.options && (
                      <div className="space-y-1 pt-1">
                        <span className="text-[10px] font-bold text-[#800020] dark:text-[#F47B20] uppercase">
                          Options & Correct Answer:
                        </span>
                        {questionMatch.bestMatchQuestion.options.map((opt, i) => {
                          const isCorrect = i === questionMatch.bestMatchQuestion?.correctIndex;
                          return (
                            <div
                              key={i}
                              className={`px-2.5 py-1.5 rounded-xl border text-[11px] flex items-start gap-1.5 ${
                                isCorrect
                                  ? "bg-emerald-50 dark:bg-emerald-950/50 border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 font-bold"
                                  : "bg-[#FFF9EF] dark:bg-[#1F2330] border-[#E8D9C0] dark:border-[#31374A] text-[#171923] dark:text-[#FFF9EF]"
                              }`}
                            >
                              <span className="font-bold">{String.fromCharCode(65 + i)}.</span>
                              <RichText text={opt} className="flex-1 min-w-0 break-words [overflow-wrap:anywhere]" />
                              {isCorrect && (
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {questionMatch.bestMatchQuestion.explanation && (
                      <div className="p-2.5 rounded-xl bg-[#FFF9EF] dark:bg-[#1F2330] border border-[#E8D9C0] dark:border-[#31374A] text-[11px] text-[#5C5346] dark:text-[#C4B9A8]">
                        <span className="font-bold text-[#800020] dark:text-[#F47B20] block mb-0.5">
                          Explanation:
                        </span>
                        <RichText text={questionMatch.bestMatchQuestion.explanation} enablePronunciation={true} />
                      </div>
                    )}

                    {onOpenInQuestionBank && (
                      <button
                        onClick={() => {
                          if (questionMatch.bestMatchQuestionId) {
                            onOpenInQuestionBank(questionMatch.bestMatchQuestionId);
                            onClose();
                          }
                        }}
                        className="w-full mt-2 py-2 px-3 rounded-xl bg-[#800020] hover:bg-[#5E0017] dark:bg-[#F47B20] dark:hover:bg-[#E06A12] text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm transition-colors cursor-pointer"
                      >
                        <BookOpen className="w-3.5 h-3.5" />
                        <span>Open in Question Bank</span>
                      </button>
                    )}
                  </>
                ) : (
                  <div className="py-8 text-center text-[#6E6254] dark:text-[#A39887]">
                    <p className="font-medium text-xs">No candidate question matched from Question Bank.</p>
                  </div>
                )}
              </div>
            </div>

            {/* Alternative Candidate Matches */}
            {questionMatch.alternativeMatches && questionMatch.alternativeMatches.length > 0 && (
              <div className="space-y-1.5 pt-2">
                <span className="text-[10px] font-black uppercase text-[#6E6254] dark:text-[#A39887] tracking-wider">
                  Alternative Candidates Considered:
                </span>
                <div className="space-y-1.5">
                  {questionMatch.alternativeMatches.map((alt, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 rounded-xl bg-white dark:bg-[#252A3A] border border-[#E8D9C0] dark:border-[#31374A] flex items-center justify-between gap-2"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] font-medium text-[#171923] dark:text-[#FFF9EF] truncate">
                          "{alt.questionText}"
                        </p>
                        <span className="text-[9.5px] tabular-nums text-[#6E6254] dark:text-[#A39887]">
                          {alt.category} • {alt.score}% match
                        </span>
                      </div>
                      {onOpenInQuestionBank && (
                        <button
                          onClick={() => {
                            onOpenInQuestionBank(alt.questionId);
                            onClose();
                          }}
                          className="px-2.5 py-1 rounded-lg bg-[#800020]/10 dark:bg-[#F47B20]/15 hover:bg-[#800020] hover:text-white text-[10px] font-bold text-[#800020] dark:text-[#F47B20] transition-colors"
                        >
                          View
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Manual Review / Reclassify Section */}
            {onUpdateCategory && (
              <div className="p-3.5 rounded-2xl bg-white dark:bg-[#252A3A] border border-[#E8D9C0] dark:border-[#31374A] space-y-2">
                <span className="text-[10px] font-black uppercase text-[#800020] dark:text-[#F47B20] tracking-wider flex items-center gap-1">
                  <Edit3 className="w-3 h-3" />
                  Manual Match Review & Override:
                </span>

                <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
                  {(
                    [
                      { id: "exact", label: "Exact" },
                      { id: "near_exact", label: "Near-Exact" },
                      { id: "similar", label: "Similar" },
                      { id: "concept_related", label: "Related" },
                      { id: "unmatched", label: "Unmatched" },
                    ] as const
                  ).map((cat) => (
                    <button
                      key={cat.id}
                      onClick={() => setSelectedCategory(cat.id)}
                      className={`py-1.5 px-2 rounded-xl text-[10.5px] font-bold border transition-all cursor-pointer ${
                        selectedCategory === cat.id
                          ? "bg-[#800020] dark:bg-[#F47B20] text-white border-[#800020] dark:border-[#F47B20] shadow-xs"
                          : "bg-[#FFF9EF] dark:bg-[#1F2330] text-[#171923] dark:text-[#FFF9EF] border-[#E8D9C0] dark:border-[#31374A]"
                      }`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="text"
                    placeholder="Optional review notes..."
                    value={reviewNotes}
                    onChange={(e) => setReviewNotes(e.target.value)}
                    className="flex-1 px-3 py-1.5 rounded-xl bg-[#FFF9EF] dark:bg-[#1F2330] border border-[#E8D9C0] dark:border-[#31374A] text-[11px] text-[#171923] dark:text-[#FFF9EF] focus:outline-hidden focus:ring-1 focus:ring-[#800020] dark:focus:ring-[#F47B20]"
                  />
                  <button
                    onClick={handleSaveReview}
                    disabled={isSaved}
                    className="px-4 py-1.5 rounded-xl bg-[#800020] hover:bg-[#5E0017] dark:bg-[#F47B20] dark:hover:bg-[#E06A12] text-white font-bold text-xs transition-colors shrink-0 cursor-pointer"
                  >
                    {isSaved ? "Saved!" : "Confirm Review"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
