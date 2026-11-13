import React from "react";
import { Question } from "../types";
import { CheckSquare, Square, FolderInput, Edit3, Trash2 } from "lucide-react";
import { RichText } from "./RichText";
import { QuestionTable } from "./QuestionTable";

interface RowProps {
  data: {
    q: Question;
    idx: number;
    isSelected: boolean;
    isDeletingSingle: boolean;
    handleToggleSelectQuestion: (id: string) => void;
    setSingleDeletingQuestionId: (id: string | null) => void;
    setEditingQuestion: (q: Question) => void;
    setSelectedQuestionIds: (ids: Set<string>) => void;
    setShowBulkMoveModal: (show: boolean) => void;
    showNotification: (msg: string) => void;
    onDeleteQuestion: (id: string) => void;
  };
  style: React.CSSProperties;
}

const ManageQuestionRowComponent: React.FC<RowProps> = ({ data, style }) => {
  const { 
    q, idx, isSelected, isDeletingSingle, 
    handleToggleSelectQuestion, setSingleDeletingQuestionId,
    setEditingQuestion, setSelectedQuestionIds, setShowBulkMoveModal,
    showNotification, onDeleteQuestion
  } = data;

  return (
    <div style={style} className="px-3">
        <div
            className={`bg-white dark:bg-[#111A2E] border rounded-2xl p-4 sm:p-5 shadow-xs space-y-3 transition-all ${
                isSelected
                ? "border-blue-500 ring-2 ring-blue-500/20 bg-blue-50/20 dark:bg-blue-950/20"
                : "border-slate-200/80 dark:border-slate-800"
            }`}
        >
        {/* Top Card Bar */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
            {/* Checkbox with generous touch area */}
            <button
                type="button"
                onClick={() => handleToggleSelectQuestion(q.id)}
                className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                title={isSelected ? "Deselect question" : "Select question"}
            >
                {isSelected ? (
                <CheckSquare className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                ) : (
                <Square className="w-4 h-4 text-slate-400 hover:text-slate-600" />
                )}
            </button>

            <span className="font-mono text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/80 px-2 py-0.5 rounded-md">
                Q{idx + 1}
            </span>

            {q.isUserAdded ? (
                <span className="px-2 py-0.5 rounded bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-400 text-[10px] font-bold border border-purple-200/50 dark:border-purple-800/50">
                User Added
                </span>
            ) : (
                <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 text-[10px] font-medium">
                Base
                </span>
            )}
            </div>

            {/* Quick Card Action Buttons */}
            <div className="flex items-center gap-1.5">
            <button
                onClick={() => {
                    setSelectedQuestionIds(new Set([q.id]));
                    setShowBulkMoveModal(true);
                }}
                className="px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer active:scale-95"
                title="Move this question to another topic"
            >
                <FolderInput className="w-3.5 h-3.5 text-blue-500" />
                <span>Move</span>
            </button>

            <button
                onClick={() => setEditingQuestion(q)}
                className="px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer active:scale-95"
            >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Edit</span>
            </button>

            <button
                onClick={() => setSingleDeletingQuestionId(q.id)}
                className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 flex items-center justify-center transition-colors cursor-pointer active:scale-95"
                title="Delete question"
            >
                <Trash2 className="w-4 h-4" />
            </button>
            </div>
        </div>

        {/* Question Text */}
        <div className="font-hindi text-sm font-semibold text-slate-900 dark:text-slate-100 leading-relaxed pt-1">
            <RichText text={q.text} enablePronunciation={true} />
            {(q.table || q.tableData) && (
            <QuestionTable table={q.table || q.tableData} />
            )}
        </div>

        {/* Options */}
        <div className="space-y-1.5 font-hindi text-xs pt-1">
            {q.options.map((opt, oIdx) => {
            const isCorrect = q.correctIndex === oIdx;
            const labels = ["A", "B", "C", "D"];
            return (
                <div
                key={oIdx}
                className={`px-3 py-2 rounded-xl flex items-center gap-2.5 transition-colors ${
                    isCorrect
                    ? "bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 font-bold"
                    : "bg-slate-50/70 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 text-slate-700 dark:text-slate-300"
                }`}
                >
                <span className={`w-5 h-5 rounded-md flex items-center justify-center text-[11px] font-mono font-bold shrink-0 ${
                    isCorrect 
                    ? "bg-emerald-600 text-white" 
                    : "bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300"
                }`}>
                    {labels[oIdx]}
                </span>
                <div className={`flex-1 leading-snug min-w-0 font-hindi ${
                    isCorrect
                    ? "text-emerald-900 dark:text-emerald-300"
                    : "text-[#172033] dark:text-slate-200"
                }`}>
                    <RichText text={opt} />
                </div>
                </div>
            );
            })}
        </div>

        {/* Explanation */}
        {q.explanation && (
            <div className="bg-slate-50 dark:bg-slate-800/60 rounded-xl p-3 text-xs font-hindi text-slate-600 dark:text-slate-300 border border-slate-100 dark:border-slate-800 leading-relaxed">
            <span className="font-bold text-slate-800 dark:text-slate-200 text-[11px] font-sans block uppercase tracking-wider mb-1">
                Explanation:
            </span>
            <RichText text={q.explanation} enablePronunciation={true} />
            </div>
        )}

        {/* Single Delete inline prompt */}
        {isDeletingSingle && (
            <div className="bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900 p-3.5 rounded-2xl text-xs space-y-2.5 animate-in fade-in duration-150">
            <p className="font-bold text-rose-700 dark:text-rose-300">
                Delete this question permanently from syllabus?
            </p>
            <div className="flex items-center gap-2">
                <button
                onClick={() => {
                    onDeleteQuestion(q.id);
                    setSingleDeletingQuestionId(null);
                    showNotification("Question deleted.");
                }}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-xs cursor-pointer active:scale-95 transition-all"
                >
                Yes, Delete
                </button>
                <button
                onClick={() => setSingleDeletingQuestionId(null)}
                className="px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold text-xs cursor-pointer active:scale-95 transition-all"
                >
                Cancel
                </button>
            </div>
            </div>
        )}
        </div>
    </div>
  );
};

export const ManageQuestionRow = React.memo(ManageQuestionRowComponent, (prevProps, nextProps) => {
  return (
    prevProps.data.q === nextProps.data.q &&
    prevProps.data.idx === nextProps.data.idx &&
    prevProps.data.isSelected === nextProps.data.isSelected &&
    prevProps.data.isDeletingSingle === nextProps.data.isDeletingSingle
  );
});
