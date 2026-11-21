import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ExtractedQuestionDraft } from "../../types";
import {
  CheckCircle2,
  AlertTriangle,
  Edit2,
  Trash2,
  Plus,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  FileCheck,
} from "lucide-react";

interface ExtractionReviewSectionProps {
  questions: ExtractedQuestionDraft[];
  totalPages: number;
  onProceedToMatch: (reviewedQuestions: ExtractedQuestionDraft[]) => void;
  onBackToUpload: () => void;
  isMatching: boolean;
}

export const ExtractionReviewSection: React.FC<ExtractionReviewSectionProps> = ({
  questions: initialQuestions,
  totalPages,
  onProceedToMatch,
  onBackToUpload,
  isMatching,
}) => {
  const [questions, setQuestions] = useState<ExtractedQuestionDraft[]>(initialQuestions);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [editOptions, setEditOptions] = useState<string[]>([]);

  const handleStartEdit = (q: ExtractedQuestionDraft) => {
    setEditingId(q.tempId);
    setEditText(q.originalText);
    setEditOptions(q.extractedOptions || ["Option A", "Option B", "Option C", "Option D"]);
  };

  const handleSaveEdit = (tempId: string) => {
    setQuestions((prev) =>
      prev.map((q) => {
        if (q.tempId === tempId) {
          return {
            ...q,
            originalText: editText.trim(),
            extractedOptions: editOptions.map((o) => o.trim()),
            ocrStatus: "edited",
            isFlaggedForReview: false,
          };
        }
        return q;
      })
    );
    setEditingId(null);
  };

  const handleDelete = (tempId: string) => {
    setQuestions((prev) => prev.filter((q) => q.tempId !== tempId));
  };

  const handleAddNewQuestion = () => {
    const newQ: ExtractedQuestionDraft = {
      tempId: `manual-q-${Date.now()}`,
      originalQuestionNumber: questions.length + 1,
      sourcePageNumber: 1,
      originalText: "New question statement...",
      extractedOptions: ["Option A", "Option B", "Option C", "Option D"],
      ocrStatus: "edited",
      ocrConfidence: 1.0,
      questionType: "standard",
      isFlaggedForReview: false,
    };
    setQuestions((prev) => [...prev, newQ]);
    handleStartEdit(newQ);
  };

  return (
    <div className="space-y-4 max-w-2xl mx-auto pb-24">
      {/* Top Banner */}
      <div className="bg-white dark:bg-[#1F2330] rounded-3xl p-4 sm:p-5 border border-[#E8D9C0] dark:border-[#31374A] shadow-xs flex items-center justify-between gap-3">
        <div>
          <span className="text-[10px] font-black uppercase text-[#7045D8] dark:text-[#A78BFA] tracking-wider flex items-center gap-1">
            <FileCheck className="w-3.5 h-3.5 text-[#7045D8] dark:text-[#A78BFA]" />
            Disha PYQ • OCR Extraction Review
          </span>
          <h2 className="text-base sm:text-lg font-black text-[#171923] dark:text-[#FFF9EF] mt-0.5 tabular-nums">
            Review Extracted Questions ({questions.length})
          </h2>
          <p className="text-[11px] font-medium text-[#6E6254] dark:text-[#A39887]">
            Verify question statements and options before matching against the Question Bank.
          </p>
        </div>

        <button
          onClick={handleAddNewQuestion}
          className="px-3 py-1.5 rounded-xl bg-[#800020]/10 dark:bg-[#F47B20]/15 text-[#800020] dark:text-[#F47B20] font-bold text-xs flex items-center gap-1 hover:bg-[#800020]/20 transition-colors cursor-pointer shrink-0"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add Question</span>
        </button>
      </div>

      {/* Questions Review List */}
      <div className="space-y-3">
        {questions.map((q, idx) => {
          const isEditing = editingId === q.tempId;

          return (
            <motion.div
              key={q.tempId}
              layout
              className={`p-4 rounded-2xl border transition-all ${
                q.isFlaggedForReview
                  ? "bg-amber-50/40 dark:bg-amber-950/20 border-amber-300 dark:border-amber-900/60"
                  : "bg-white dark:bg-[#1F2330] border-[#E8D9C0] dark:border-[#31374A] shadow-xs"
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 text-xs">
                  <span className="w-7 h-7 rounded-xl bg-[#800020]/10 dark:bg-[#F47B20]/15 text-[#800020] dark:text-[#F47B20] font-black text-xs tabular-nums flex items-center justify-center shrink-0">
                    Q{q.originalQuestionNumber || idx + 1}
                  </span>
                  <span className="text-[#6E6254] dark:text-[#A39887] font-bold text-[11px] tabular-nums">
                    Page {q.sourcePageNumber}
                  </span>
                  {q.isFlaggedForReview && (
                    <>
                      <span className="text-[#E8D9C0] dark:text-[#31374A]" aria-hidden="true">·</span>
                      <span className="text-amber-600 dark:text-amber-400 text-[11px] font-bold flex items-center gap-1">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        Low Confidence
                      </span>
                    </>
                  )}
                  {q.ocrStatus === "edited" && (
                    <>
                      <span className="text-[#E8D9C0] dark:text-[#31374A]" aria-hidden="true">·</span>
                      <span className="text-[#800020] dark:text-[#F47B20] text-[11px] font-bold">
                        Edited
                      </span>
                    </>
                  )}
                </div>

                <div className="flex items-center gap-1">
                  {!isEditing ? (
                    <button
                      onClick={() => handleStartEdit(q)}
                      className="p-2 rounded-xl text-[#6E6254] hover:text-[#800020] dark:hover:text-[#F47B20] hover:bg-[#FFF9EF] dark:hover:bg-[#252A3A] transition-colors cursor-pointer"
                      title="Edit text"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                  ) : null}
                  <button
                    onClick={() => handleDelete(q.tempId)}
                    className="p-2 rounded-xl text-[#6E6254] hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                    title="Delete question"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {isEditing ? (
                <div className="space-y-3 pt-1">
                  <div>
                    <label className="text-[10px] font-bold uppercase text-[#6E6254] dark:text-[#A39887] block mb-1">
                      Question Statement:
                    </label>
                    <textarea
                      rows={3}
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      className="w-full p-2.5 rounded-xl bg-[#FFF9EF] dark:bg-[#252A3A] border border-[#E8D9C0] dark:border-[#31374A] text-xs text-[#171923] dark:text-[#FFF9EF] leading-relaxed focus:outline-hidden focus:ring-1 focus:ring-[#800020] dark:focus:ring-[#F47B20]"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase text-[#6E6254] dark:text-[#A39887] block">
                      Options (A, B, C, D):
                    </label>
                    {editOptions.map((opt, optIdx) => (
                      <div key={optIdx} className="flex items-center gap-2">
                        <span className="text-xs font-bold text-[#800020] dark:text-[#F47B20] w-4">
                          {String.fromCharCode(65 + optIdx)}.
                        </span>
                        <input
                          type="text"
                          value={opt}
                          onChange={(e) => {
                            const updated = [...editOptions];
                            updated[optIdx] = e.target.value;
                            setEditOptions(updated);
                          }}
                          className="flex-1 px-2.5 py-1.5 rounded-lg bg-[#FFF9EF] dark:bg-[#252A3A] border border-[#E8D9C0] dark:border-[#31374A] text-xs text-[#171923] dark:text-[#FFF9EF]"
                        />
                      </div>
                    ))}
                  </div>

                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      onClick={() => setEditingId(null)}
                      className="px-3 py-1.5 rounded-xl text-xs font-bold text-[#6E6254] dark:text-[#A39887] hover:bg-[#FFF9EF] dark:hover:bg-[#252A3A]"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => handleSaveEdit(q.tempId)}
                      className="px-4 py-1.5 rounded-xl bg-[#800020] hover:bg-[#5E0017] dark:bg-[#F47B20] dark:hover:bg-[#E06A12] text-white font-bold text-xs"
                    >
                      Save Changes
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-[#171923] dark:text-[#FFF9EF] leading-relaxed whitespace-pre-line">
                    {q.originalText}
                  </p>

                  {q.extractedOptions && q.extractedOptions.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1">
                      {q.extractedOptions.map((opt, i) => (
                        <div
                          key={i}
                          className="px-2.5 py-1 rounded-lg bg-[#FFF9EF] dark:bg-[#252A3A] border border-[#E8D9C0] dark:border-[#31374A] text-[11px] text-[#5C5346] dark:text-[#C4B9A8] flex items-start gap-1.5"
                        >
                          <span className="font-bold text-[#800020] dark:text-[#F47B20]">
                            {String.fromCharCode(65 + i)}.
                          </span>
                          <span className="truncate">{opt}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          );
        })}
      </div>

      {/* Bottom Sticky Action Bar */}
      <div className="sticky bottom-4 z-20 bg-[#FFF9EF]/95 dark:bg-[#1F2330]/95 backdrop-blur-md p-3 rounded-2xl border border-[#E8D9C0] dark:border-[#31374A] shadow-xl flex items-center justify-between gap-3">
        <button
          onClick={onBackToUpload}
          className="px-4 py-2.5 rounded-xl text-[#5C5346] dark:text-[#C4B9A8] font-bold text-xs flex items-center gap-1.5 hover:bg-[#F7EFE2] dark:hover:bg-[#252A3A] transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Upload</span>
        </button>

        <button
          onClick={() => onProceedToMatch(questions)}
          disabled={isMatching || questions.length === 0}
          className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#800020] to-[#5E0017] hover:from-[#6A001A] hover:to-[#4A0012] dark:from-[#F47B20] dark:to-[#E06A12] text-white font-black text-xs flex items-center gap-2 shadow-md transition-all active:scale-[0.98] cursor-pointer disabled:opacity-50"
        >
          {isMatching ? (
            <>
              <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              <span>Matching Against Question Bank...</span>
            </>
          ) : (
            <>
              <Sparkles className="w-3.5 h-3.5 text-[#C99A45] dark:text-white" />
              <span>Match Against Question Bank ➔</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
