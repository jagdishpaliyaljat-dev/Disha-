import React, { useState, useMemo, useRef, useEffect } from "react";
import { Chapter, Subject, Topic } from "../types";
import { 
  X, 
  Layers, 
  Plus, 
  BookOpen, 
  LayoutGrid, 
  CheckCircle2, 
  ChevronRight, 
  Search, 
  AlertCircle, 
  Check, 
  CornerDownLeft, 
  Loader2,
  FolderPlus
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface AddTopicModalProps {
  subjects?: Subject[];
  chapters: Chapter[];
  initialSubjectId?: string;
  initialChapterId?: string;
  onAddTopic: (chapterId: string, newTopic: Topic) => Promise<void> | void;
  onClose: () => void;
  onOpenAddChapter?: (subjectId?: string) => void;
}

export const AddTopicModal: React.FC<AddTopicModalProps> = ({
  subjects = [],
  chapters = [],
  initialSubjectId,
  initialChapterId,
  onAddTopic,
  onClose,
  onOpenAddChapter,
}) => {
  // Normalize subjects list (derive from existing chapters or fallback to standard subject if none defined)
  const normalizedSubjects = useMemo(() => {
    if (subjects && subjects.length > 0) return subjects;
    // Attempt to salvage subject info from chapters
    const derivedSubjIds = Array.from(new Set(chapters.map((c) => c.subjectId).filter(Boolean)));
    if (derivedSubjIds.length > 0) {
      return derivedSubjIds.map((id) => ({
        id: id as string,
        name: id === "sub_raj_hist" ? "Rajasthan History" : (id as string),
        hindiName: id === "sub_raj_hist" ? "राजस्थान का इतिहास" : (id as string),
      }));
    }
    return [{ id: "sub_raj_hist", name: "Rajasthan History", hindiName: "राजस्थान का इतिहास" }];
  }, [subjects, chapters]);

  // Determine initial subject and chapter
  const initialChapter = useMemo(() => {
    if (!initialChapterId) return null;
    return chapters.find((c) => c.id === initialChapterId) || null;
  }, [chapters, initialChapterId]);

  const defaultSubjectId = useMemo(() => {
    if (initialSubjectId) return initialSubjectId;
    if (initialChapter?.subjectId) return initialChapter.subjectId;
    // Prefer the first subject that actually contains chapters
    const subjectWithChaps = normalizedSubjects.find((s) =>
      chapters.some((c) => (c.subjectId || "") === s.id || c.subjectId === s.id)
    );
    return subjectWithChaps?.id || normalizedSubjects[0]?.id || "sub_raj_hist";
  }, [initialSubjectId, initialChapter, normalizedSubjects, chapters]);

  // Hierarchical states
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>(defaultSubjectId);
  const [subjectSearch, setSubjectSearch] = useState("");

  // Filter chapters belonging strictly to selected subject
  const availableChapters = useMemo(() => {
    if (!selectedSubjectId) return [];
    return chapters.filter((ch) => {
      const chSubj = ch.subjectId || "";
      return chSubj === selectedSubjectId || ch.subjectId === selectedSubjectId;
    });
  }, [chapters, selectedSubjectId]);

  // Selected chapter state
  const [selectedChapterId, setSelectedChapterId] = useState<string>(() => {
    if (initialChapterId && chapters.some((c) => c.id === initialChapterId)) {
      return initialChapterId;
    }
    return availableChapters[0]?.id || "";
  });
  const [chapterSearch, setChapterSearch] = useState("");

  // Keep state synchronized whenever incoming props update
  useEffect(() => {
    if (initialChapterId) {
      const targetChap = chapters.find((c) => c.id === initialChapterId);
      if (targetChap) {
        setSelectedChapterId(targetChap.id);
        if (targetChap.subjectId) {
          setSelectedSubjectId(targetChap.subjectId);
          return;
        }
      }
    }
    if (initialSubjectId) {
      setSelectedSubjectId(initialSubjectId);
      const chaps = chapters.filter(
        (c) => (c.subjectId || "") === initialSubjectId || c.subjectId === initialSubjectId
      );
      if (chaps.length > 0 && (!selectedChapterId || !chaps.some((c) => c.id === selectedChapterId))) {
        setSelectedChapterId(chaps[0].id);
      }
    } else if (!selectedSubjectId || selectedSubjectId === "economics") {
      const subWithChapters = normalizedSubjects.find((s) =>
        chapters.some((c) => (c.subjectId || "") === s.id || c.subjectId === s.id)
      );
      if (subWithChapters) {
        setSelectedSubjectId(subWithChapters.id);
        const firstCh = chapters.find(
          (c) => (c.subjectId || "") === subWithChapters.id || c.subjectId === subWithChapters.id
        );
        if (firstCh) setSelectedChapterId(firstCh.id);
      }
    }
  }, [initialSubjectId, initialChapterId, chapters, normalizedSubjects]);

  // Ensure chapter ID remains valid within current subject
  useEffect(() => {
    if (availableChapters.length > 0 && !availableChapters.some((c) => c.id === selectedChapterId)) {
      setSelectedChapterId(availableChapters[0].id);
    }
  }, [availableChapters, selectedChapterId]);

  // Topic form fields
  const [title, setTitle] = useState("");
  const [hindiTitle, setHindiTitle] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [videoDuration, setVideoDuration] = useState("");
  const [pdfUrl, setPdfUrl] = useState("");

  // Status & feedback states
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successInfo, setSuccessInfo] = useState<{
    topicTitle: string;
    chapterName: string;
    totalAdded: number;
  } | null>(null);
  const [sessionCreatedTopics, setSessionCreatedTopics] = useState<
    Array<{ id: string; title: string; chapterTitle: string }>
  >([]);

  const titleInputRef = useRef<HTMLInputElement>(null);

  // When subject changes, keep chapter in sync
  const handleSubjectChange = (newSubjectId: string) => {
    setSelectedSubjectId(newSubjectId);
    setError(null);
    setSuccessInfo(null);
    
    // Find eligible chapters under new subject
    const newChapters = chapters.filter((ch) => {
      const chSubj = ch.subjectId || "";
      return chSubj === newSubjectId || ch.subjectId === newSubjectId;
    });

    if (newChapters.length > 0) {
      setSelectedChapterId(newChapters[0].id);
    } else {
      setSelectedChapterId("");
    }
  };

  // Filtered lists for search UI
  const filteredSubjectsList = useMemo(() => {
    if (!subjectSearch.trim()) return normalizedSubjects;
    const q = subjectSearch.toLowerCase().trim();
    return normalizedSubjects.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        (s.hindiName && s.hindiName.toLowerCase().includes(q))
    );
  }, [normalizedSubjects, subjectSearch]);

  const filteredChaptersList = useMemo(() => {
    if (!chapterSearch.trim()) return availableChapters;
    const q = chapterSearch.toLowerCase().trim();
    return availableChapters.filter(
      (c) =>
        (c.title && c.title.toLowerCase().includes(q)) ||
        (c.hindiTitle && c.hindiTitle.toLowerCase().includes(q)) ||
        String(c.number).includes(q)
    );
  }, [availableChapters, chapterSearch]);

  const currentSubject = useMemo(
    () => normalizedSubjects.find((s) => s.id === selectedSubjectId) || normalizedSubjects[0],
    [normalizedSubjects, selectedSubjectId]
  );

  const currentChapter = useMemo(
    () => availableChapters.find((c) => c.id === selectedChapterId) || chapters.find((c) => c.id === selectedChapterId) || null,
    [availableChapters, chapters, selectedChapterId]
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving) return;

    if (!selectedSubjectId) {
      setError("Please select a target Subject first.");
      return;
    }

    if (!selectedChapterId) {
      setError("Please select a target Chapter under this Subject.");
      return;
    }

    const topicTitleTrimmed = title.trim();
    if (!topicTitleTrimmed) {
      setError("Please enter a Topic Name.");
      titleInputRef.current?.focus();
      return;
    }

    if (topicTitleTrimmed.length < 2) {
      setError("Topic Name must be at least 2 characters long.");
      titleInputRef.current?.focus();
      return;
    }

    const topicHindiTrimmed = hindiTitle.trim() || topicTitleTrimmed;

    // Duplicate topic prevention within target chapter
    const existingTopics = currentChapter?.topics || [];
    const isDuplicate = existingTopics.some((t) => {
      const tTitle = (t.title || (t as any).name || "").trim().toLowerCase();
      const tHindi = (t.hindiTitle || (t as any).hindi_name || "").trim().toLowerCase();
      const candEn = topicTitleTrimmed.toLowerCase();
      const candHi = topicHindiTrimmed.toLowerCase();
      return (tTitle && tTitle === candEn) || 
             (tHindi && tHindi === candHi) || 
             (tTitle && tTitle === candHi);
    });

    if (isDuplicate) {
      setError(`Topic "${topicTitleTrimmed}" already exists in this chapter. Duplicate topics are not allowed.`);
      titleInputRef.current?.focus();
      return;
    }

    setError(null);
    setIsSaving(true);

    const topicId = `custom-topic-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const nextNumber = existingTopics.length + 1;

    const newTopic: Topic = {
      id: topicId,
      chapterId: selectedChapterId,
      subjectId: selectedSubjectId,
      title: topicTitleTrimmed,
      hindiTitle: topicHindiTrimmed,
      number: nextNumber,
      questions: [],
      isUserAdded: true,
      videoUrl: videoUrl.trim() || undefined,
      videoDuration: videoDuration.trim() || undefined,
      pdfUrl: pdfUrl.trim() || undefined,
    };

    try {
      await onAddTopic(selectedChapterId, newTopic);

      // Track successful creation in current session
      const chName = currentChapter ? (currentChapter.title || currentChapter.hindiTitle) : "Chapter";
      const newCreatedList = [
        ...sessionCreatedTopics,
        { id: topicId, title: topicTitleTrimmed, chapterTitle: chName },
      ];
      setSessionCreatedTopics(newCreatedList);
      setSuccessInfo({
        topicTitle: topicTitleTrimmed,
        chapterName: chName,
        totalAdded: newCreatedList.length,
      });

      // KEY WORKFLOW BENEFIT: Keep Subject & Chapter intact, clear only topic fields for immediate next entry
      setTitle("");
      setHindiTitle("");
      setVideoUrl("");
      setVideoDuration("");
      setPdfUrl("");
      
      // Auto-focus back to title input for next topic
      setTimeout(() => {
        titleInputRef.current?.focus();
      }, 50);
    } catch (err: any) {
      setError(err?.message || "Failed to save topic. Please check your network and permissions.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      id="add-topic-modal-backdrop"
      className="fixed inset-0 z-[1000] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-sm transition-all"
    >
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        onClick={onClose}
        className="absolute inset-0"
      />

      <motion.div
        id="add-topic-modal-card"
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        className="w-full sm:max-w-xl bg-white dark:bg-[#0B1220] border-t sm:border border-slate-200 dark:border-slate-800 rounded-t-[2rem] sm:rounded-[2.5rem] shadow-2xl flex flex-col max-h-[92dvh] sm:max-h-[90vh] relative z-10 overflow-hidden"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between p-5 sm:p-6 pb-3 sm:pb-4 border-b border-slate-100 dark:border-slate-800/60 shrink-0">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 shadow-sm">
              <Layers className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white leading-tight">
                  Add New Topic
                </h2>
                {sessionCreatedTopics.length > 0 && (
                  <span className="text-[10px] font-mono font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50 px-2 py-0.5 rounded-full">
                    +{sessionCreatedTopics.length} Added
                  </span>
                )}
              </div>
              <p className="text-[10px] sm:text-[11px] font-black uppercase tracking-widest text-slate-400">
                Hierarchical Syllabus Workflow
              </p>
            </div>
          </div>
          <button
            id="btn-close-add-topic"
            onClick={onClose}
            className="w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer"
            title="Close"
          >
            <X className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>
        </div>

        {/* Visual Breadcrumb / Hierarchy Indicator */}
        <div className="bg-slate-50 dark:bg-slate-900/60 px-5 sm:px-6 py-2.5 border-b border-slate-100 dark:border-slate-800/60 flex items-center gap-2 text-xs font-bold overflow-x-auto no-scrollbar shrink-0">
          <span className="text-slate-400 text-[10px] uppercase tracking-wider shrink-0 font-black">Path:</span>
          <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300 min-w-0">
            <span className="px-2 py-0.5 rounded-md bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-blue-600 dark:text-blue-400 truncate max-w-[120px]">
              {currentSubject?.name || "Subject"}
            </span>
            <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span className="px-2 py-0.5 rounded-md bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-indigo-600 dark:text-indigo-400 truncate max-w-[140px]">
              {currentChapter ? `Ch ${currentChapter.number}: ${currentChapter.title || currentChapter.hindiTitle}` : "No Chapter"}
            </span>
            <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span className="px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60 font-black">
              {title.trim() ? title.trim() : "New Topic"}
            </span>
          </div>
        </div>

        {/* Scrollable Content Area */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 pt-4 space-y-5 custom-scrollbar">
          {/* Success Banner from consecutive creation */}
          <AnimatePresence>
            {successInfo && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="p-3.5 sm:p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 flex items-start gap-3"
              >
                <div className="w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0 mt-0.5">
                  <Check className="w-4 h-4 stroke-[3]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs sm:text-sm font-black text-emerald-900 dark:text-emerald-200 leading-tight">
                    Topic &ldquo;{successInfo.topicTitle}&rdquo; successfully added!
                  </p>
                  <p className="text-[11px] text-emerald-700 dark:text-emerald-400 mt-0.5">
                    Saved under <span className="font-bold">{successInfo.chapterName}</span>. Enter another topic name below to continue adding, or click <strong>Done</strong>.
                  </p>
                </div>
                <button
                  onClick={() => setSuccessInfo(null)}
                  className="text-emerald-600 hover:text-emerald-800 p-1 rounded-lg"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Error Banner */}
          {error && (
            <div className="p-3.5 sm:p-4 bg-rose-50 dark:bg-rose-500/10 border border-rose-100 dark:border-rose-500/20 rounded-2xl text-xs sm:text-sm text-rose-600 dark:text-rose-400 font-bold flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="flex-1">{error}</div>
            </div>
          )}

          <form id="add-topic-form" onSubmit={handleSubmit} className="space-y-5 text-left">
            {/* ══════════════════════════════════════════════════════
                STEP 1: SELECT SUBJECT
            ══════════════════════════════════════════════════════ */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="block text-[10px] sm:text-[11px] font-black uppercase tracking-widest text-slate-400">
                  Step 1: Select Subject <span className="text-rose-500">*</span>
                </label>
                <span className="text-[10px] font-bold text-slate-400">
                  {normalizedSubjects.length} Available
                </span>
              </div>

              {/* Subject Search Filter if > 4 subjects */}
              {normalizedSubjects.length > 4 && (
                <div className="relative mb-2">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={subjectSearch}
                    onChange={(e) => setSubjectSearch(e.target.value)}
                    placeholder="Search subjects..."
                    className="w-full h-8 pl-8 pr-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-slate-200 placeholder:text-slate-400 border-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              )}

              <div className="relative">
                <select
                  id="select-topic-subject"
                  value={selectedSubjectId}
                  onChange={(e) => handleSubjectChange(e.target.value)}
                  className="w-full appearance-none h-12 px-4 pr-10 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-sm font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 cursor-pointer transition-all"
                >
                  {filteredSubjectsList.map((s) => {
                    const chCount = chapters.filter(
                      (c) => (c.subjectId || "economics") === s.id || c.subjectId === s.id
                    ).length;
                    return (
                      <option key={s.id} value={s.id}>
                        {s.name} {s.hindiName ? `(${s.hindiName})` : ""} — {chCount} Chapters
                      </option>
                    );
                  })}
                </select>
                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                  <LayoutGrid className="w-4 h-4" />
                </div>
              </div>
            </div>

            {/* ══════════════════════════════════════════════════════
                STEP 2: SELECT CHAPTER (Dependent on Subject)
            ══════════════════════════════════════════════════════ */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="block text-[10px] sm:text-[11px] font-black uppercase tracking-widest text-slate-400">
                  Step 2: Select Chapter <span className="text-rose-500">*</span>
                </label>
                <span className="text-[10px] font-bold text-slate-400">
                  {availableChapters.length} in this Subject
                </span>
              </div>

              {availableChapters.length === 0 ? (
                /* Empty state when subject has no chapters */
                <div className="p-4 rounded-2xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-800/50 space-y-3">
                  <div className="flex items-start gap-2.5">
                    <BookOpen className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                    <div className="text-xs">
                      <p className="font-black text-amber-900 dark:text-amber-200">
                        No chapters found in &ldquo;{currentSubject?.name}&rdquo;
                      </p>
                      <p className="text-amber-700 dark:text-amber-400 mt-0.5">
                        A chapter must exist under this subject before you can add topics to it.
                      </p>
                    </div>
                  </div>

                  {onOpenAddChapter && (
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onOpenAddChapter(selectedSubjectId);
                      }}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-black shadow-sm transition-all cursor-pointer"
                    >
                      <FolderPlus className="w-3.5 h-3.5" />
                      <span>Create Chapter in {currentSubject?.name}</span>
                    </button>
                  )}
                </div>
              ) : (
                <>
                  {availableChapters.length > 6 && (
                    <div className="relative mb-2">
                      <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        value={chapterSearch}
                        onChange={(e) => setChapterSearch(e.target.value)}
                        placeholder="Search chapters in this subject..."
                        className="w-full h-8 pl-8 pr-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-slate-200 placeholder:text-slate-400 border-none focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>
                  )}

                  <div className="relative">
                    <select
                      id="select-topic-chapter"
                      value={selectedChapterId}
                      disabled={availableChapters.length === 0}
                      onChange={(e) => {
                        setSelectedChapterId(e.target.value);
                        if (error) setError(null);
                      }}
                      className="w-full appearance-none h-12 px-4 pr-10 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-sm font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 cursor-pointer transition-all disabled:opacity-50"
                    >
                      {filteredChaptersList.map((ch) => (
                        <option key={ch.id} value={ch.id}>
                          Ch {ch.number}: {ch.title || ch.hindiTitle} ({ch.topics?.length || 0} existing topics)
                        </option>
                      ))}
                    </select>
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                      <Layers className="w-4 h-4" />
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* ══════════════════════════════════════════════════════
                STEP 3: TOPIC DETAILS
            ══════════════════════════════════════════════════════ */}
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800/60 space-y-4">
              <div>
                <label className="block text-[10px] sm:text-[11px] font-black uppercase tracking-widest text-slate-400 mb-1.5">
                  Step 3: Topic Title (English) <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    ref={titleInputRef}
                    type="text"
                    id="input-topic-title-en"
                    required
                    autoComplete="off"
                    disabled={availableChapters.length === 0}
                    placeholder="e.g. Monetary Policy & RBI Operations"
                    value={title}
                    onChange={(e) => {
                      setTitle(e.target.value);
                      if (error) setError(null);
                    }}
                    className="w-full h-12 px-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-base sm:text-sm font-bold text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 disabled:opacity-50"
                  />
                  {title.trim() && (
                    <div className="absolute right-3.5 top-1/2 -translate-y-1/2 hidden sm:flex items-center gap-1 text-[10px] font-mono text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md pointer-events-none">
                      <CornerDownLeft className="w-3 h-3" />
                      <span>Enter to Save</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Optional Hindi / Alternative Title */}
              <div>
                <label className="block text-[10px] sm:text-[11px] font-black uppercase tracking-widest text-slate-400 mb-1.5">
                  Alternative Title (Hindi, Optional)
                </label>
                <input
                  type="text"
                  id="input-topic-title-hi"
                  autoComplete="off"
                  disabled={availableChapters.length === 0}
                  placeholder="e.g. Monetary Policy & RBI"
                  value={hindiTitle}
                  onChange={(e) => setHindiTitle(e.target.value)}
                  className="w-full h-12 px-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-base sm:text-sm font-bold text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 disabled:opacity-50"
                />
              </div>

              {/* YouTube Video URL / ID */}
              <div>
                <label className="block text-[10px] sm:text-[11px] font-black uppercase tracking-widest text-slate-400 mb-1.5 flex items-center justify-between">
                  <span>YouTube Video Link or ID (Optional)</span>
                  <span className="text-indigo-500 font-semibold normal-case">मुफ़्त वीडियो क्लास</span>
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    id="input-topic-video-url"
                    autoComplete="off"
                    disabled={availableChapters.length === 0}
                    placeholder="e.g. https://youtu.be/M7lc1UVf-VE or Video ID"
                    value={videoUrl}
                    onChange={(e) => setVideoUrl(e.target.value)}
                    className="flex-1 h-12 px-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-base sm:text-sm font-medium text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 disabled:opacity-50"
                  />
                  <input
                    type="text"
                    id="input-topic-video-duration"
                    autoComplete="off"
                    disabled={availableChapters.length === 0}
                    placeholder="25:30 min"
                    value={videoDuration}
                    onChange={(e) => setVideoDuration(e.target.value)}
                    className="w-28 h-12 px-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-base sm:text-sm font-medium text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 disabled:opacity-50 text-center"
                  />
                </div>
              </div>

              {/* Google Drive PDF Notes Link */}
              <div>
                <label className="block text-[10px] sm:text-[11px] font-black uppercase tracking-widest text-slate-400 mb-1.5 flex items-center justify-between">
                  <span>Google Drive PDF Link (Optional)</span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-semibold normal-case">हस्तलिखित नोट्स</span>
                </label>
                <input
                  type="text"
                  id="input-topic-pdf-url"
                  autoComplete="off"
                  disabled={availableChapters.length === 0}
                  placeholder="e.g. https://drive.google.com/file/d/1A2B3C.../view"
                  value={pdfUrl}
                  onChange={(e) => setPdfUrl(e.target.value)}
                  className="w-full h-12 px-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-base sm:text-sm font-medium text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 disabled:opacity-50"
                />
              </div>
            </div>

            {/* Quick Summary of Topics Added this Session */}
            {sessionCreatedTopics.length > 0 && (
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200/80 dark:border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Added this session ({sessionCreatedTopics.length}):
                  </span>
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">
                    Saved to Cloud & Store
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto custom-scrollbar">
                  {sessionCreatedTopics.map((item, idx) => (
                    <span
                      key={item.id}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 shadow-2xs"
                    >
                      <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" />
                      <span>{item.title}</span>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </form>
        </div>

        {/* Footer Buttons */}
        <div className="flex items-center gap-3 p-4 border-t border-slate-100 dark:border-slate-800/60 shrink-0 bg-white dark:bg-[#0B1220]">
          {sessionCreatedTopics.length > 0 ? (
            <>
              <button
                type="button"
                id="btn-done-add-topic"
                onClick={onClose}
                className="flex-1 py-3.5 sm:py-4 rounded-2xl border border-slate-200 dark:border-slate-700 text-xs font-black uppercase tracking-widest text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all cursor-pointer active:scale-95 flex items-center justify-center gap-1.5"
              >
                <Check className="w-4 h-4 text-emerald-500 stroke-[3]" />
                <span>Done ({sessionCreatedTopics.length} Added)</span>
              </button>
              <button
                form="add-topic-form"
                type="submit"
                id="btn-submit-add-topic"
                disabled={isSaving || availableChapters.length === 0 || !title.trim()}
                className="flex-1 py-3.5 sm:py-4 rounded-2xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:pointer-events-none text-white text-xs font-black uppercase tracking-widest shadow-xl shadow-indigo-500/20 flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-95"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4 stroke-[3]" />
                    <span>Add Another Topic</span>
                  </>
                )}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                id="btn-cancel-add-topic"
                onClick={onClose}
                className="flex-1 py-3.5 sm:py-4 rounded-2xl border border-slate-200 dark:border-slate-700 text-xs font-black uppercase tracking-widest text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all cursor-pointer active:scale-95"
              >
                Cancel
              </button>
              <button
                form="add-topic-form"
                type="submit"
                id="btn-submit-add-topic"
                disabled={isSaving || availableChapters.length === 0 || !title.trim()}
                className="flex-1 py-3.5 sm:py-4 rounded-2xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:pointer-events-none text-white text-xs font-black uppercase tracking-widest shadow-xl shadow-indigo-500/20 flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-95"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4 stroke-[3]" />
                    <span>Save Topic</span>
                  </>
                )}
              </button>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
};
