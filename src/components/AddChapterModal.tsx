import React, { useState, useEffect, useMemo } from "react";
import { Chapter, Subject } from "../types";
import { X, BookOpen, Plus } from "lucide-react";
import { motion } from "motion/react";

interface AddChapterModalProps {
  chapters?: Chapter[];
  subjects?: Subject[];
  initialSubjectId?: string;
  onAddChapter: (newChapter: Chapter) => void;
  onClose: () => void;
}

export const AddChapterModal: React.FC<AddChapterModalProps> = ({
  chapters = [],
  subjects = [],
  initialSubjectId,
  onAddChapter,
  onClose,
}) => {
  const normalizedSubjects = useMemo(() => {
    if (subjects && subjects.length > 0) return subjects;
    return [{ id: "sub_raj_hist", name: "Rajasthan History", hindiName: "Rajasthan History" }];
  }, [subjects]);

  const [subjectId, setSubjectId] = useState<string>(initialSubjectId || normalizedSubjects[0]?.id || "sub_raj_hist");

  const nextNum = useMemo(() => {
    const subjChapters = chapters.filter(c => (c.subjectId || "sub_raj_hist") === subjectId);
    return subjChapters.length + 1;
  }, [chapters, subjectId]);

  const [chapterNumber, setChapterNumber] = useState<number>(nextNum);

  useEffect(() => {
    const subjChapters = chapters.filter(c => (c.subjectId || "sub_raj_hist") === subjectId);
    setChapterNumber(subjChapters.length + 1);
  }, [subjectId, chapters]);
  const [title, setTitle] = useState("");
  const [hindiTitle, setHindiTitle] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanTitle = title.trim();
    const cleanHindiTitle = hindiTitle.trim();
    if (!cleanTitle && !cleanHindiTitle) {
      setError("Please enter a chapter title");
      return;
    }

    const targetSubjId = subjectId || normalizedSubjects[0]?.id || "sub_raj_hist";
    const isDuplicate = chapters.some(
      (c) =>
        (c.subjectId || "sub_raj_hist") === targetSubjId &&
        ((cleanTitle && c.title && c.title.trim().toLowerCase() === cleanTitle.toLowerCase()) ||
         (cleanHindiTitle && c.hindiTitle && c.hindiTitle.trim().toLowerCase() === cleanHindiTitle.toLowerCase()))
    );

    if (isDuplicate) {
      setError(`Chapter "${cleanHindiTitle || cleanTitle}" already exists in this subject. Duplicate chapters are not allowed.`);
      return;
    }

    const chapterId = `custom-ch-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

    const newChapter: Chapter = {
      id: chapterId,
      subjectId: targetSubjId,
      number: chapterNumber > 0 ? chapterNumber : nextNum,
      title: cleanTitle || cleanHindiTitle,
      hindiTitle: cleanHindiTitle || cleanTitle,
      topics: [],
      isUserAdded: true,
    };

    onAddChapter(newChapter);
    onClose();
  };

  return (
    <div
      id="add-chapter-modal-backdrop"
      className="fixed inset-0 z-[1000] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-sm transition-all"
    >
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        onClick={onClose}
        className="absolute inset-0"
      />
      
      <motion.div
        id="add-chapter-modal-card"
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        className="w-full sm:max-w-lg bg-white dark:bg-[#0B1220] border-t sm:border border-slate-200 dark:border-slate-800 rounded-t-[2rem] sm:rounded-[2.5rem] shadow-2xl flex flex-col max-h-[90dvh] sm:max-h-[90vh] relative z-10 overflow-hidden"
      >
        {/* Modal Header - Fixed */}
        <div className="flex items-center justify-between p-5 sm:p-6 pb-3 sm:pb-4 border-b border-slate-100 dark:border-slate-800/60 shrink-0">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 shadow-sm">
              <BookOpen className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white leading-tight">
                Add New Chapter
              </h2>
              <p className="text-[10px] sm:text-[11px] font-black uppercase tracking-widest text-slate-400">
                Chapter Creation
              </p>
            </div>
          </div>
          <button
            id="btn-close-add-chapter"
            onClick={onClose}
            className="w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer"
          >
            <X className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>
        </div>

        {/* Scrollable Content Area */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 pt-4 space-y-5 sm:space-y-6 custom-scrollbar">
          {error && (
            <div className="p-4 bg-rose-50 dark:bg-rose-500/10 border border-rose-100 dark:border-rose-500/20 rounded-2xl text-sm text-rose-600 dark:text-rose-400 font-bold">
              {error}
            </div>
          )}

          <form id="add-chapter-form" onSubmit={handleSubmit} className="space-y-5 sm:space-y-6 text-left">
            {/* Subject Selector */}
            {subjects.length > 0 && (
              <div>
                <label className="block text-[10px] sm:text-[11px] font-black uppercase tracking-widest text-slate-400 mb-1.5 sm:mb-2">
                  Target Subject <span className="text-rose-500">*</span>
                </label>
                <select
                  value={subjectId}
                  onChange={(e) => setSubjectId(e.target.value)}
                  className="w-full h-12 px-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-sm font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                >
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name || s.hindiName}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Chapter Number & Title */}
            <div className="grid grid-cols-4 gap-3 sm:gap-4">
              <div className="col-span-1">
                <label className="block text-[10px] sm:text-[11px] font-black uppercase tracking-widest text-slate-400 mb-1.5 sm:mb-2">
                  No.
                </label>
                <input
                  type="number"
                  id="input-chapter-number"
                  value={chapterNumber}
                  min={1}
                  max={99}
                  inputMode="numeric"
                  autoComplete="off"
                  onChange={(e) => setChapterNumber(parseInt(e.target.value) || nextNum)}
                  className="w-full h-12 sm:h-14 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-base sm:text-sm font-mono font-black text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-center"
                />
              </div>
              <div className="col-span-3">
                <label className="block text-[10px] sm:text-[11px] font-black uppercase tracking-widest text-slate-400 mb-1.5 sm:mb-2">
                  Title (English) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  id="input-chapter-title-en"
                  required
                  autoComplete="off"
                  placeholder="e.g. Services Sector"
                  value={title}
                  onChange={(e) => {
                    setTitle(e.target.value);
                    if (error) setError(null);
                  }}
                  className="w-full h-12 sm:h-14 px-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-base sm:text-sm font-bold text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                />
              </div>
            </div>

            {/* Hindi Title */}
            <div>
              <label className="block text-[10px] sm:text-[11px] font-black uppercase tracking-widest text-slate-400 mb-1.5 sm:mb-2">
                Alternative Title (Optional)
              </label>
              <input
                type="text"
                id="input-chapter-title-hi"
                autoComplete="off"
                placeholder="e.g. Secondary Title"
                value={hindiTitle}
                onChange={(e) => setHindiTitle(e.target.value)}
                className="w-full h-12 sm:h-14 px-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-base sm:text-sm font-bold text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
              />
            </div>

          </form>
        </div>

        {/* Footer Buttons - Fixed */}
        <div className="flex items-center gap-3 p-4 border-t border-slate-100 dark:border-slate-800/60 shrink-0 bg-white dark:bg-[#0B1220]">
          <button
            type="button"
            id="btn-cancel-add-chapter"
            onClick={onClose}
            className="flex-1 py-4 rounded-2xl border border-slate-200 dark:border-slate-700 text-xs font-black uppercase tracking-widest text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all cursor-pointer active:scale-95"
          >
            Cancel
          </button>
          <button
            form="add-chapter-form"
            type="submit"
            id="btn-submit-add-chapter"
            className="flex-1 py-4 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-black uppercase tracking-widest shadow-xl shadow-blue-500/20 flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-95"
          >
            <Plus className="w-5 h-5 stroke-[3]" />
            <span>Save</span>
          </button>
        </div>
      </motion.div>
    </div>
  );
};

