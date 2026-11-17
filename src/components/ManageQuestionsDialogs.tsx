import React, { useState } from "react";
import { Chapter, Question } from "../types";
import { FolderInput, MoveRight, Trash2, X, Sparkles, Loader2 } from "lucide-react";
import { formatQuestionWithAI } from "../utils/aiFormatter";
import { QuestionTable } from "./QuestionTable";

// ==========================================
// BULK MOVE QUESTIONS DIALOG
// ==========================================
export interface MoveQuestionsDialogProps {
  questionCount: number;
  currentChapterTitle?: string;
  currentTopicTitle?: string;
  currentChapterId?: string;
  currentTopicId?: string;
  chapters: Chapter[];
  isMoving?: boolean;
  onConfirmMove: (targetChapterId: string, targetTopicId: string) => void;
  onCancel: () => void;
}

export const MoveQuestionsDialog: React.FC<MoveQuestionsDialogProps> = ({
  questionCount,
  currentChapterTitle,
  currentTopicTitle,
  currentChapterId,
  currentTopicId,
  chapters,
  isMoving = false,
  onConfirmMove,
  onCancel,
}) => {
  // Find initial chapter: prefer another chapter or same chapter if multiple topics exist
  const [targetChapterId, setTargetChapterId] = useState(() => {
    return chapters[0]?.id || "";
  });
  const targetChapter = chapters.find((c) => c.id === targetChapterId) || chapters[0];

  const [targetTopicId, setTargetTopicId] = useState(() => {
    // If target chapter is the current chapter, prefer a different topic if available
    const available = targetChapter?.topics || [];
    const differentTopic = available.find((t) => t.id !== currentTopicId);
    return differentTopic ? differentTopic.id : (available[0]?.id || "");
  });

  const handleChapterChange = (chId: string) => {
    if (isMoving) return;
    setTargetChapterId(chId);
    const ch = chapters.find((c) => c.id === chId);
    if (ch && (ch.topics?.length || 0) > 0) {
      const differentTopic = ch.topics?.find((t) => t.id !== currentTopicId);
      setTargetTopicId(differentTopic ? differentTopic.id : (ch.topics?.[0]?.id || ""));
    }
  };

  const selectedTopic = targetChapter?.topics?.find((t) => t.id === targetTopicId);

  // Check if target is identical to source
  const isSameLocation = Boolean(
    currentChapterId &&
    currentTopicId &&
    currentChapterId === targetChapterId &&
    currentTopicId === targetTopicId
  );

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="move-dialog-title"
      className="fixed inset-0 z-60 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-y-auto"
    >
      <div className="w-full sm:max-w-md bg-white dark:bg-[#111A2E] border-t sm:border border-slate-200 dark:border-slate-800 rounded-t-3xl sm:rounded-3xl p-5 sm:p-6 shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between pb-1">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-50 dark:bg-blue-950/70 text-blue-600 dark:text-blue-400 flex items-center justify-center shadow-xs">
              <FolderInput className="w-5 h-5" />
            </div>
            <div>
              <h3 id="move-dialog-title" className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                Move {questionCount} Question{questionCount > 1 ? "s" : ""}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Reassign syllabus topic
              </p>
            </div>
          </div>

          <button
            onClick={onCancel}
            disabled={isMoving}
            className="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 flex items-center justify-center cursor-pointer active:scale-95 transition-all disabled:opacity-40"
            aria-label="Close move dialog"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Current Origin vs Destination Pathway */}
        <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-2.5">
          {currentChapterTitle && currentTopicTitle && (
            <div className="text-xs">
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
                Current Location:
              </span>
              <span className="text-slate-700 dark:text-slate-300 font-medium">
                {currentChapterTitle} › {currentTopicTitle}
              </span>
            </div>
          )}

          <div className="flex items-center justify-center py-1">
            <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 text-xs font-bold bg-blue-50 dark:bg-blue-950/60 px-3 py-1 rounded-xl border border-blue-200/50 dark:border-blue-900/50">
              <span>Moving {questionCount} item(s)</span>
              <MoveRight className="w-4 h-4 animate-pulse" />
            </div>
          </div>

          <div className="text-xs">
            <span className="text-[10px] uppercase font-bold text-blue-500 tracking-wider block">
              Destination:
            </span>
            <span className="text-slate-900 dark:text-white font-bold">
              {targetChapter?.title} › {selectedTopic?.title || "Select Topic"}
            </span>
          </div>
        </div>

        {isSameLocation && (
          <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 rounded-xl text-xs text-amber-800 dark:text-amber-300 font-bold">
            ⚠️ Source and destination are identical. Please choose a different target chapter or topic.
          </div>
        )}

        {/* Target Chapter Selection */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
            Target Chapter
          </label>
          <select
            value={targetChapterId}
            disabled={isMoving}
            onChange={(e) => handleChapterChange(e.target.value)}
            className="w-full p-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs sm:text-sm text-slate-900 dark:text-slate-100 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer disabled:opacity-50"
          >
            {chapters.map((ch) => (
              <option key={ch.id} value={ch.id}>
                {ch.number}. {ch.title} ({ch.hindiTitle})
              </option>
            ))}
          </select>
        </div>

        {/* Target Topic Selection */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
            Target Topic
          </label>
          <select
            value={targetTopicId}
            disabled={isMoving}
            onChange={(e) => setTargetTopicId(e.target.value)}
            className="w-full p-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs sm:text-sm text-slate-900 dark:text-slate-100 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer disabled:opacity-50"
          >
            {(targetChapter?.topics || []).map((t, tIdx) => (
              <option key={`${t.id}-${tIdx}`} value={t.id}>
                {t.title} ({t.hindiTitle}) — {t.questions?.length || 0} Qs
              </option>
            ))}
          </select>
        </div>

        {questionCount >= 100 && (
          <p className="text-[11px] text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 p-2.5 rounded-xl font-medium">
            ⚡ Batched Atomic Move: {questionCount} questions will be safely remapped in Supabase PostgreSQL in 100-item chunks. Record IDs are preserved with zero duplicates.
          </p>
        )}

        {/* Action Buttons */}
        <div className="flex items-center gap-3 pt-2">
          <button
            onClick={onCancel}
            disabled={isMoving}
            className="flex-1 py-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 rounded-2xl text-xs sm:text-sm font-bold transition-all cursor-pointer active:scale-95 disabled:opacity-40"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirmMove(targetChapterId, targetTopicId)}
            disabled={isMoving || isSameLocation || !targetTopicId}
            className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl text-xs sm:text-sm font-bold shadow-md shadow-blue-600/20 flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isMoving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Moving {questionCount}...</span>
              </>
            ) : (
              <>
                <FolderInput className="w-4 h-4" />
                <span>Confirm Move ({questionCount})</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

// ==========================================
// BULK DELETE CONFIRMATION DIALOG
// ==========================================
export interface BulkDeleteConfirmDialogProps {
  questionCount: number;
  customCount: number;
  baseCount: number;
  onConfirmDelete: () => void;
  onCancel: () => void;
}

export const BulkDeleteConfirmDialog: React.FC<BulkDeleteConfirmDialogProps> = ({
  questionCount,
  customCount,
  baseCount,
  onConfirmDelete,
  onCancel,
}) => {
  const [confirmed, setConfirmed] = React.useState(questionCount < 10);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-dialog-title"
      className="fixed inset-0 z-60 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-y-auto"
    >
      <div className="w-full sm:max-w-sm bg-white dark:bg-[#111A2E] border-t sm:border border-slate-200 dark:border-slate-800 rounded-t-3xl sm:rounded-3xl p-5 sm:p-6 shadow-2xl space-y-4 animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-150 text-center">
        {/* Warning Icon */}
        <div className="w-14 h-14 rounded-3xl bg-rose-50 dark:bg-rose-950/70 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto shadow-sm">
          <Trash2 className="w-7 h-7" />
        </div>

        <div>
          <h3 id="delete-dialog-title" className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
            Delete {questionCount} Question{questionCount > 1 ? "s" : ""}?
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Are you sure you want to permanently remove these questions from your syllabus?
          </p>
        </div>

        {/* Breakdown badge */}
        <div className="bg-slate-50 dark:bg-slate-800/60 rounded-2xl p-3.5 text-xs space-y-1.5 text-left border border-slate-100 dark:border-slate-800">
          <div className="flex justify-between text-slate-600 dark:text-slate-300">
            <span>Custom User Questions:</span>
            <span className="font-bold text-purple-600 dark:text-purple-400 font-mono">
              {customCount}
            </span>
          </div>
          {baseCount > 0 && (
            <div className="flex justify-between text-slate-600 dark:text-slate-300">
              <span>Default Syllabus Questions:</span>
              <span className="font-bold text-slate-500 font-mono">{baseCount}</span>
            </div>
          )}
          <p className="text-[11px] text-rose-600 dark:text-rose-400 pt-1 font-semibold">
            ⚠️ This action cannot be undone.
          </p>
        </div>

        {questionCount >= 10 && (
          <label className="flex items-start gap-2 text-left p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
              className="mt-0.5 rounded text-rose-600 focus:ring-rose-500"
            />
            <span className="text-[11px] font-semibold text-amber-900 dark:text-amber-200 leading-tight">
              I understand that {questionCount} questions will be deleted permanently.
            </span>
          </label>
        )}

        {/* Buttons */}
        <div className="flex items-center gap-3 pt-1">
          <button
            onClick={onCancel}
            className="flex-1 py-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 rounded-2xl text-xs sm:text-sm font-bold cursor-pointer active:scale-95 transition-all"
          >
            Cancel
          </button>
          <button
            disabled={!confirmed}
            onClick={onConfirmDelete}
            className="flex-1 py-3 bg-rose-600 hover:bg-rose-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-2xl text-xs sm:text-sm font-bold shadow-md shadow-rose-600/20 flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 transition-all"
          >
            <Trash2 className="w-4 h-4" />
            <span>Yes, Delete</span>
          </button>
        </div>
      </div>
    </div>
  );
};

// ==========================================
// EDIT QUESTION DIALOG
// ==========================================
export interface EditQuestionDialogProps {
  question: Question;
  onSave: (updated: Question) => void;
  onCancel: () => void;
}

export const EditQuestionDialog: React.FC<EditQuestionDialogProps> = ({
  question,
  onSave,
  onCancel,
}) => {
  const [text, setText] = useState(question.text);
  const [options, setOptions] = useState<[string, string, string, string]>([
    question.options[0],
    question.options[1],
    question.options[2],
    question.options[3],
  ]);
  const [correctIndex, setCorrectIndex] = useState(question.correctIndex);
  const [explanation, setExplanation] = useState(question.explanation);
  const [importantFact, setImportantFact] = useState(question.importantFact || "");
  const [isFormatting, setIsFormatting] = useState(false);
  const [aiSuccessMsg, setAiSuccessMsg] = useState("");

  const handleFormatWithAI = async () => {
    const rawContent = [
      text,
      options.map((o, i) => `${["A", "B", "C", "D"][i]}. ${o}`).join("\n"),
      `Answer: ${["A", "B", "C", "D"][correctIndex]}`,
      explanation ? `Explanation: ${explanation}` : "",
      importantFact ? `Fact: ${importantFact}` : ""
    ].filter(Boolean).join("\n");

    try {
      setIsFormatting(true);
      setAiSuccessMsg("");
      const res = await formatQuestionWithAI(rawContent);
      setText(res.text);
      setOptions(res.options);
      setCorrectIndex(res.correctIndex);
      if (res.explanation) setExplanation(res.explanation);
      if (res.importantFact) setImportantFact(res.importantFact);
      setAiSuccessMsg("✨ Question formatted and structured with AI!");
      setTimeout(() => setAiSuccessMsg(""), 4000);
    } catch (err: any) {
      alert(err?.message || "Failed to format with AI.");
    } finally {
      setIsFormatting(false);
    }
  };

  const handleSave = () => {
    onSave({
      ...question,
      text: text.trim(),
      options: [
        options[0].trim(),
        options[1].trim(),
        options[2].trim(),
        options[3].trim(),
      ],
      correctIndex,
      explanation: explanation.trim(),
      importantFact: importantFact.trim() || undefined,
    });
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-dialog-title"
      className="fixed inset-0 z-60 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-y-auto"
    >
      <div className="w-full sm:max-w-lg bg-white dark:bg-[#111A2E] border-t sm:border border-slate-200 dark:border-slate-800 rounded-t-3xl sm:rounded-3xl p-5 sm:p-6 shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-150">
        <div className="flex items-center justify-between pb-1">
          <h3 id="edit-dialog-title" className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
            Edit Question
          </h3>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleFormatWithAI}
              disabled={isFormatting}
              className="px-3 py-1.5 rounded-xl bg-linear-to-r from-amber-500 via-purple-600 to-blue-600 hover:from-amber-600 hover:to-blue-700 text-white text-xs font-bold shadow-md flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 disabled:opacity-60"
              title="Auto-reorganize messy text into structured Question, Options A-D, Answer & Explanation"
            >
              {isFormatting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Sparkles className="w-3.5 h-3.5 text-amber-200 animate-pulse" />
              )}
              <span>{isFormatting ? "Formatting..." : "Format with AI"}</span>
            </button>
            <button
              onClick={onCancel}
              className="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 flex items-center justify-center cursor-pointer active:scale-95 transition-all"
              aria-label="Close edit dialog"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {aiSuccessMsg && (
          <div className="px-3.5 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs font-bold flex items-center gap-2">
            <Sparkles className="w-4 h-4 shrink-0" />
            <span>{aiSuccessMsg}</span>
          </div>
        )}

        <div>
          <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
            Question Text
          </label>
          <textarea
            rows={3}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Enter question in Hindi..."
            className="w-full p-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs sm:text-sm font-hindi text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 leading-relaxed"
          />
          {(question.table || question.tableData) && (
            <div className="mt-2 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
              <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                Attached Table (Read-Only Preview)
              </span>
              <QuestionTable table={question.table || question.tableData} />
            </div>
          )}
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
              Options (Tap letter to select Correct Answer)
            </label>
            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">
              Option {["A", "B", "C", "D"][correctIndex]} is Correct
            </span>
          </div>

          {["A", "B", "C", "D"].map((letter, idx) => {
            const isCorrect = correctIndex === idx;
            return (
              <div key={letter} className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCorrectIndex(idx)}
                  className={`w-10 h-10 rounded-xl text-xs font-mono font-bold shrink-0 transition-all cursor-pointer flex items-center justify-center active:scale-95 ${
                    isCorrect
                      ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/30"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200"
                  }`}
                  title={`Mark Option ${letter} as correct`}
                >
                  {letter}
                </button>
                <input
                  type="text"
                  value={options[idx]}
                  onChange={(e) => {
                    const copy: [string, string, string, string] = [...options];
                    copy[idx] = e.target.value;
                    setOptions(copy);
                  }}
                  placeholder={`Option ${letter}`}
                  className={`flex-1 p-2.5 rounded-xl text-xs sm:text-sm font-hindi border transition-colors ${
                    isCorrect
                      ? "bg-emerald-50/60 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-100 font-bold"
                      : "bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200"
                  }`}
                />
              </div>
            );
          })}
        </div>

        <div>
          <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
            Explanation
          </label>
          <textarea
            rows={2}
            value={explanation}
            onChange={(e) => setExplanation(e.target.value)}
            placeholder="Detailed explanation..."
            className="w-full p-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs sm:text-sm font-hindi text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 leading-relaxed"
          />
        </div>

        <div>
          <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
            Important Fact (Optional)
          </label>
          <input
            type="text"
            value={importantFact}
            onChange={(e) => setImportantFact(e.target.value)}
            placeholder="e.g., Target growth rate is 6.5%"
            className="w-full p-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs sm:text-sm font-hindi text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex items-center gap-3 pt-2">
          <button
            onClick={onCancel}
            className="flex-1 py-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 rounded-2xl text-xs sm:text-sm font-bold cursor-pointer active:scale-95 transition-all"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl text-xs sm:text-sm font-bold shadow-md shadow-blue-600/20 cursor-pointer active:scale-95 transition-all"
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
};
