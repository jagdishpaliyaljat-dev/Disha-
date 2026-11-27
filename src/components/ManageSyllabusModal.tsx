import React, { useState } from "react";
import { Chapter, Topic, Subject } from "../types";
import {
  X,
  Edit3,
  Trash2,
  BookOpen,
  LayoutGrid,
  Layers,
  Check,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Plus,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { ConfirmDialog } from "./admin/ConfirmDialog";
import {
  getSubjectDisplayName,
  getSubjectSecondaryName,
  getChapterDisplayName,
  getChapterSecondaryTitle,
  getTopicDisplayName,
  getTopicSecondaryTitle,
} from "../utils/curriculumUtils";

interface ManageSyllabusModalProps {
  subjects?: Subject[];
  chapters: Chapter[];
  onClose: () => void;
  onEditSubject?: (subject: Subject) => void;
  onRemoveSubject?: (subjectId: string) => void;
  onEditChapter: (chapter: Chapter) => void;
  onRemoveChapter: (chapterId: string) => void;
  onEditTopic: (topic: Topic) => void;
  onRemoveTopic: (topicId: string, chapterId?: string) => void;
  onShowAddTopic?: (subjectId?: string, chapterId?: string) => void;
  onShowAddChapter?: (subjectId?: string) => void;
}

export const ManageSyllabusModal: React.FC<ManageSyllabusModalProps> = ({
  subjects = [],
  chapters,
  onClose,
  onEditSubject,
  onRemoveSubject,
  onEditChapter,
  onRemoveChapter,
  onEditTopic,
  onRemoveTopic,
  onShowAddTopic,
  onShowAddChapter,
}) => {
  const [activeTab, setActiveTab] = useState<"subjects" | "chapters" | "topics">("subjects");

  // Editing state for Subject
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null);
  const [subjectHindiName, setSubjectHindiName] = useState("");
  const [subjectName, setSubjectName] = useState("");

  // Editing state for Chapter
  const [editingChapter, setEditingChapter] = useState<Chapter | null>(null);
  const [chapterHindiTitle, setChapterHindiTitle] = useState("");
  const [chapterTitle, setChapterTitle] = useState("");

  // Editing state for Topic
  const [editingTopic, setEditingTopic] = useState<Topic | null>(null);
  const [topicHindiTitle, setTopicHindiTitle] = useState("");
  const [topicTitle, setTopicTitle] = useState("");
  
  // Chapter selection for bulk actions
  const [selectedChapterIds, setSelectedChapterIds] = useState<Set<string>>(new Set());

  // Delete confirmation modal state
  const [confirmDelete, setConfirmDelete] = useState<{
    type: "subject" | "chapter" | "topic";
    id: string;
    title: string;
    chapterId?: string;
  } | null>(null);

  // Toggle chapter selection
  const toggleChapterSelection = (id: string) => {
    const next = new Set(selectedChapterIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedChapterIds(next);
  };

  const bulkUpdateVisibility = (isPublished: boolean) => {
    selectedChapterIds.forEach(id => {
      const ch = chapters.find(c => c.id === id);
      if (ch) onEditChapter({...ch, isPublished});
    });
    setSelectedChapterIds(new Set());
  };

  // Start editing subject
  const startEditSubject = (subj: Subject) => {
    setEditingSubject(subj);
    setSubjectHindiName(subj.hindiName || "");
    setSubjectName(subj.name || "");
  };

  const saveEditSubject = () => {
    if (!editingSubject || !onEditSubject) return;
    const finalHindi = subjectHindiName.trim();
    const finalName = subjectName.trim();
    onEditSubject({
      ...editingSubject,
      hindiName: finalHindi || finalName || editingSubject.hindiName,
      name: finalName || finalHindi || editingSubject.name,
    });
    setEditingSubject(null);
  };

  // Start editing chapter
  const startEditChapter = (ch: Chapter) => {
    setEditingChapter(ch);
    setChapterHindiTitle(ch.hindiTitle || "");
    setChapterTitle(ch.title || "");
  };

  const saveEditChapter = () => {
    if (!editingChapter) return;
    const finalHindi = chapterHindiTitle.trim();
    const finalTitle = chapterTitle.trim();
    onEditChapter({
      ...editingChapter,
      hindiTitle: finalHindi || finalTitle || editingChapter.hindiTitle,
      title: finalTitle || finalHindi || editingChapter.title,
    });
    setEditingChapter(null);
  };

  // Start editing topic
  const startEditTopic = (t: Topic, chapterId?: string) => {
    setEditingTopic({ ...t, chapterId: t.chapterId || chapterId || "" });
    setTopicHindiTitle(t.hindiTitle || "");
    setTopicTitle(t.title || "");
  };

  const saveEditTopic = () => {
    if (!editingTopic) return;
    const finalHindi = topicHindiTitle.trim();
    const finalTitle = topicTitle.trim();
    onEditTopic({
      ...editingTopic,
      chapterId: editingTopic.chapterId,
      hindiTitle: finalHindi || finalTitle || editingTopic.hindiTitle,
      title: finalTitle || finalHindi || editingTopic.title,
    });
    setEditingTopic(null);
  };

  const executeDelete = () => {
    if (!confirmDelete) return;
    if (confirmDelete.type === "subject" && onRemoveSubject) {
      onRemoveSubject(confirmDelete.id);
    } else if (confirmDelete.type === "chapter") {
      onRemoveChapter(confirmDelete.id);
    } else if (confirmDelete.type === "topic") {
      onRemoveTopic(confirmDelete.id, confirmDelete.chapterId);
    }
    setConfirmDelete(null);
  };

  return (
    <div
      id="manage-syllabus-modal-backdrop"
      className="fixed inset-0 z-[1000] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-sm transition-all"
    >
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        onClick={onClose}
        className="absolute inset-0"
      />

      <motion.div
        id="manage-syllabus-modal-card"
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        className="w-full sm:max-w-2xl bg-white dark:bg-[#0B1220] border-t sm:border border-slate-200 dark:border-slate-800 rounded-t-[2rem] sm:rounded-[2.5rem] shadow-2xl flex flex-col max-h-[90dvh] sm:max-h-[85vh] relative z-10 overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 sm:p-6 pb-3 border-b border-slate-100 dark:border-slate-800/60 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white leading-tight">
                Manage Subjects
              </h2>
              <p className="text-[11px] font-bold text-slate-400">
                Rename, reorder, or delete subjects, chapters, and topics
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher: Subjects | Chapters | Topics */}
        <div className="px-4 sm:px-6 pt-3 pb-2 flex items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800/60 shrink-0 overflow-x-auto no-scrollbar scroll-smooth">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab("subjects")}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shrink-0 whitespace-nowrap min-h-[38px] ${
                activeTab === "subjects"
                  ? "bg-[#7045D8] text-white shadow-xs"
                  : "bg-slate-100 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 hover:bg-slate-200"
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Subjects ({subjects.length})</span>
            </button>

            <button
              onClick={() => setActiveTab("chapters")}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shrink-0 whitespace-nowrap min-h-[38px] ${
                activeTab === "chapters"
                  ? "bg-[#7045D8] text-white shadow-xs"
                  : "bg-slate-100 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 hover:bg-slate-200"
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>Chapters ({chapters.length})</span>
            </button>

            <button
              onClick={() => setActiveTab("topics")}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shrink-0 whitespace-nowrap min-h-[38px] ${
                activeTab === "topics"
                  ? "bg-purple-600 text-white shadow-xs"
                  : "bg-slate-100 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 hover:bg-slate-200"
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Topics ({chapters.reduce((acc, c) => acc + (c.topics?.length || 0), 0)})</span>
            </button>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {activeTab === "chapters" && onShowAddChapter && (
              <button
                onClick={() => onShowAddChapter()}
                className="px-3 py-1.5 rounded-xl bg-[#7045D8] text-white text-xs font-bold flex items-center gap-1 transition-all shadow-xs cursor-pointer active:scale-95 whitespace-nowrap"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Chapter</span>
              </button>
            )}
            {activeTab === "topics" && onShowAddTopic && (
              <button
                onClick={() => onShowAddTopic()}
                className="px-3 py-1.5 rounded-xl bg-purple-600 text-white text-xs font-bold flex items-center gap-1 transition-all shadow-xs cursor-pointer active:scale-95 whitespace-nowrap"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Topic</span>
              </button>
            )}
          </div>
        </div>

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-3 custom-scrollbar">
          {/* TAB 1: SUBJECTS MANAGEMENT */}
          {activeTab === "subjects" && (
            <div className="space-y-3">
              {subjects.length === 0 ? (
                <div className="py-12 text-center space-y-2 bg-slate-50/50 dark:bg-slate-900/30 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
                  <p className="text-sm font-bold text-slate-700 dark:text-slate-300">No Subjects Found</p>
                  <p className="text-xs text-slate-400">Add a subject from the syllabus section to begin organizing your course.</p>
                </div>
              ) : (
                subjects
                  .sort((a, b) => (a.name || "").localeCompare(b.name || ""))
                  .map((subj, idx) => {
                    const isEditing = editingSubject?.id === subj.id;
                    const subjChaptersCount = chapters.filter(
                      (c) => (c.subjectId || "economics") === subj.id
                    ).length;

                    return (
                      <div
                        key={subj.id}
                        className="p-4 bg-white dark:bg-[#111A2E] border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-xs space-y-2.5"
                      >
                        {isEditing ? (
                          <div className="space-y-3">
                            <div>
                              <label className="text-xs font-bold text-slate-500 block mb-1">
                                Subject Alternative Title
                              </label>
                              <input
                                type="text"
                                value={subjectHindiName}
                                onChange={(e) => setSubjectHindiName(e.target.value)}
                                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-bold"
                              />
                            </div>
                            <div>
                              <label className="text-xs font-bold text-slate-500 block mb-1">
                                Subject Name (English)
                              </label>
                              <input
                                type="text"
                                value={subjectName}
                                onChange={(e) => setSubjectName(e.target.value)}
                                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-bold"
                              />
                            </div>
                            <div className="flex justify-end gap-2 pt-1">
                              <button
                                onClick={() => setEditingSubject(null)}
                                className="px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-600"
                              >
                                Cancel
                              </button>
                              <button
                                onClick={saveEditSubject}
                                className="px-3.5 py-1.5 rounded-lg text-xs font-bold bg-[#7045D8] text-white flex items-center gap-1"
                              >
                                <Check className="w-3.5 h-3.5" />
                                <span>Save Changes</span>
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-[10px] font-black text-slate-500 shrink-0">
                                {idx + 1}
                              </div>
                              <div className="min-w-0">
                                <h4 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                                  {getSubjectDisplayName(subj)}
                                </h4>
                                <p className="text-[10px] text-slate-400 truncate uppercase font-black tracking-wider">
                                  {getSubjectSecondaryName(subj) ? `${getSubjectSecondaryName(subj)} • ` : ""}{subjChaptersCount} Chapters
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <button
                                onClick={() => startEditSubject(subj)}
                                className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 hover:bg-blue-100 transition-colors"
                                title="Edit Subject Name"
                              >
                                <Edit3 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() =>
                                  setConfirmDelete({
                                    type: "subject",
                                    id: subj.id,
                                    title: getSubjectDisplayName(subj),
                                  })
                                }
                                className="p-2 rounded-xl bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 hover:bg-rose-100 transition-colors"
                                title="Delete Subject"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })
              )}
            </div>
          )}

          {/* TAB 2: CHAPTERS MANAGEMENT */}
          {activeTab === "chapters" && (
            <div className="space-y-3">
              {selectedChapterIds.size > 0 && (
                <div className="p-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 rounded-2xl flex items-center justify-between">
                    <span className="text-xs font-bold text-blue-800 dark:text-blue-300">
                        {selectedChapterIds.size} Chapters Selected
                    </span>
                    <div className="flex gap-2">
                        <button onClick={() => bulkUpdateVisibility(true)} className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-[10px] font-black uppercase">Publish</button>
                        <button onClick={() => bulkUpdateVisibility(false)} className="px-3 py-1.5 rounded-lg bg-amber-600 text-white text-[10px] font-black uppercase">Draft</button>
                    </div>
                </div>
              )}
              {chapters
                .sort((a, b) => (a.number || 0) - (b.number || 0))
                .map((ch, idx) => {
                const isEditing = editingChapter?.id === ch.id;

                return (
                  <div
                    key={ch.id}
                    className={`p-4 bg-white dark:bg-[#111A2E] border ${selectedChapterIds.has(ch.id) ? 'border-blue-500' : 'border-slate-200/80'} dark:border-slate-800 rounded-2xl shadow-xs space-y-2.5`}
                  >
                    {isEditing ? (
                      <div className="space-y-3">
                        {/* ... (keep editing fields) */}
                        <div className="flex items-center gap-2">
                            <input 
                                type="checkbox" 
                                checked={ch.isPublished}
                                onChange={(e) => onEditChapter({...ch, isPublished: e.target.checked})}
                                className="rounded"
                            />
                            <label className="text-xs font-bold text-slate-500">Published</label>
                        </div>
                        {/* ... (save/cancel buttons) */}
                        <div className="space-y-3">
                          <div>
                            <label className="text-xs font-bold text-slate-500 block mb-1">
                              Chapter Alternative Title
                            </label>
                            <input
                              type="text"
                              value={chapterHindiTitle}
                              onChange={(e) => setChapterHindiTitle(e.target.value)}
                              className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-bold"
                            />
                          </div>
                          <div>
                            <label className="text-xs font-bold text-slate-500 block mb-1">
                              Chapter Title (English)
                            </label>
                            <input
                              type="text"
                              value={chapterTitle}
                              onChange={(e) => setChapterTitle(e.target.value)}
                              className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-bold"
                            />
                          </div>
                          <div className="flex justify-end gap-2 pt-1">
                            <button
                              onClick={() => setEditingChapter(null)}
                              className="px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-600"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={saveEditChapter}
                              className="px-3.5 py-1.5 rounded-lg text-xs font-bold bg-[#7045D8] text-white flex items-center gap-1"
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>Save Changes</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                            <input 
                                type="checkbox" 
                                checked={selectedChapterIds.has(ch.id)}
                                onChange={() => toggleChapterSelection(ch.id)}
                                className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                            />
                            <div className="min-w-0">
                                <span className="text-[10px] font-mono font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50 px-2 py-0.5 rounded-md">
                                    {idx + 1}
                                </span>
                                <h4 className="text-sm font-bold text-slate-900 dark:text-white truncate mt-1">
                                    {getChapterDisplayName(ch)}
                                </h4>
                                <p className="text-xs text-slate-400 truncate">
                                    {getChapterSecondaryTitle(ch) ? `${getChapterSecondaryTitle(ch)} • ` : ""}{(ch.topics?.length || 0)} Topics • {ch.isPublished ? 'Published' : 'Draft'}
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            onClick={() => startEditChapter(ch)}
                            className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 transition-colors"
                            title="Edit Chapter"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() =>
                              setConfirmDelete({
                                type: "chapter",
                                id: ch.id,
                                title: getChapterDisplayName(ch),
                              })
                            }
                            className="p-2 rounded-xl bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 hover:bg-rose-100 transition-colors"
                            title="Delete Chapter"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* TAB 3: TOPICS MANAGEMENT */}
          {activeTab === "topics" && (
            <div className="space-y-4">
              {chapters
                .sort((a, b) => (a.number || 0) - (b.number || 0))
                .map((ch) => (
                <div
                  key={ch.id}
                  className="bg-white dark:bg-[#111A2E] border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 space-y-3"
                >
                  <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                    <span className="text-xs font-black text-slate-900 dark:text-white">
                      {chapters.findIndex(c => c.id === ch.id) + 1}: {getChapterDisplayName(ch)}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-mono text-slate-400 font-bold">
                        {(ch.topics?.length || 0)} Topics
                      </span>
                      {onShowAddTopic && (
                        <button
                          type="button"
                          onClick={() => onShowAddTopic(ch.subjectId, ch.id)}
                          className="px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 text-[11px] font-black flex items-center gap-1 transition-all cursor-pointer active:scale-95"
                          title={`Add new topic under Chapter ${ch.number}`}
                        >
                          <Plus className="w-3 h-3 stroke-[3]" />
                          <span>Add Topic</span>
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    {(ch.topics?.length || 0) === 0 ? (
                      <p className="text-xs text-slate-400 italic">
                        No topics found
                      </p>
                    ) : (
                      (ch.topics || [])
                        .sort((a, b) => (a.number || 0) - (b.number || 0))
                        .map((t, tIdx) => {
                        const isEditing = editingTopic?.id === t.id;

                        return (
                          <div
                            key={`${t.id}-${tIdx}`}
                            className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl"
                          >
                            {isEditing ? (
                              <div className="space-y-2.5">
                                <div>
                                  <label className="text-[10px] font-bold text-slate-500 block mb-0.5">Topic Title (Primary)</label>
                                  <input
                                    type="text"
                                    value={topicTitle}
                                    onChange={(e) => {
                                      setTopicTitle(e.target.value);
                                      if (!topicHindiTitle) setTopicHindiTitle(e.target.value);
                                    }}
                                    placeholder="Topic Title"
                                    className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-xs font-bold"
                                  />
                                </div>
                                <div>
                                  <label className="text-[10px] font-bold text-slate-500 block mb-0.5">Alternative Title (Hindi/Secondary)</label>
                                  <input
                                    type="text"
                                    value={topicHindiTitle}
                                    onChange={(e) => setTopicHindiTitle(e.target.value)}
                                    placeholder="Alternative Title"
                                    className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-xs font-bold"
                                  />
                                </div>
                                <div className="flex justify-end gap-2 pt-1">
                                  <button
                                    onClick={() => setEditingTopic(null)}
                                    className="px-2.5 py-1 rounded text-xs font-bold text-slate-500"
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    onClick={saveEditTopic}
                                    className="px-3 py-1 rounded bg-purple-600 text-white text-xs font-bold flex items-center gap-1 cursor-pointer"
                                  >
                                    <Check className="w-3 h-3" />
                                    <span>Save</span>
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2 min-w-0 pr-2 flex-1">
                                  <div className="w-6 h-6 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-[10px] font-black text-slate-500 shrink-0">
                                    {tIdx + 1}
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block truncate">
                                      {getTopicDisplayName(t)}
                                    </span>
                                    <span className="text-[10px] text-slate-400 font-mono">
                                      {getTopicSecondaryTitle(t) ? `${getTopicSecondaryTitle(t)} • ` : ""}{t.questions.length} MCQs
                                    </span>
                                  </div>
                                </div>
                                <div className="flex items-center gap-1 shrink-0">
                                  <button
                                    onClick={() => startEditTopic(t, ch.id)}
                                    className="p-1.5 rounded-lg bg-slate-200/80 dark:bg-slate-700 text-purple-600 dark:text-purple-400 cursor-pointer"
                                  >
                                    <Edit3 className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() =>
                                      setConfirmDelete({
                                        type: "topic",
                                        id: t.id,
                                        title: getTopicDisplayName(t),
                                        chapterId: ch.id,
                                      })
                                    }
                                    className="p-1.5 rounded-lg bg-slate-200/80 dark:bg-slate-700 text-rose-600 dark:text-rose-400 cursor-pointer"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 shrink-0">
          <button
            onClick={onClose}
            className="w-full py-4 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-black uppercase tracking-widest text-xs hover:bg-slate-200 transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </motion.div>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={Boolean(confirmDelete)}
        title="Confirm Deletion"
        message={`Are you sure you want to delete "${confirmDelete?.title || ""}"? This action cannot be undone and will remove associated content.`}
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={executeDelete}
        onClose={() => setConfirmDelete(null)}
      />
    </div>
  );
};
