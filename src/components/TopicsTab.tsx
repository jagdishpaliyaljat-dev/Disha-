import React from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Chapter,
  ProgressStore,
  MCQSession,
  UserQuestionsStore,
  Subject,
  Topic,
  Question,
} from "../types";
import {
  Search,
  ChevronRight,
  ArrowLeft,
  TrendingUp,
  Landmark,
  Globe,
  BookOpen,
  Cpu,
  Award,
  Shield,
  Compass,
  FileText,
  Sparkles,
  Layers,
  Play,
  HelpCircle,
  FileDown,
  Share2,
  RefreshCw,
  CheckCircle2,
  Video,
  Clock,
  ExternalLink,
  Edit3,
  Save,
  X,
  Plus,
} from "lucide-react";
import ShareModal, { ShareData } from "./ShareModal";
import { CoachingVideoPlayer } from "./CoachingVideoPlayer";
import { InAppPdfViewer } from "./InAppPdfViewer";
import { buildTopicShareData } from "../utils/shareService";
import { getSubjectQuestionsCount } from "../utils/questionsStorage";
import { triggerHaptic, playClickSound } from "../utils/audioFeedback";
import {
  getSubjectDisplayName,
  getSubjectSecondaryName,
  getChapterDisplayName,
  getChapterSecondaryTitle,
  getTopicDisplayName,
  getTopicSecondaryTitle,
} from "../utils/curriculumUtils";

interface TopicsTabProps {
  progressStore: ProgressStore;
  subjects: Subject[];
  chapters: Chapter[];
  questionsStore?: UserQuestionsStore;
  selectedSubjectId: string | null;
  onSelectSubject: (subjectId: string | null) => void;
  selectedChapterId: string | null;
  onSelectChapter: (chapterId: string | null) => void;
  selectedTopicId?: string | null;
  onSelectTopic?: (topicId: string | null) => void;
  onStartSession: (session: MCQSession) => void;
  onOpenPDFExport?: (config?: {
    subjectId?: string | null;
    chapterId?: string | null;
    topicId?: string | null;
    filterType?: "all" | "wrong" | "bookmarked";
  }) => void;
  onBack?: () => void;
  isAdmin?: boolean;
  onEditTopic?: (topic: Topic) => void;
}

// Icon helper to render subject icon
const renderSubjectIcon = (iconName?: string, className = "w-6 h-6") => {
  switch (iconName) {
    case "TrendingUp":
      return <TrendingUp className={className} />;
    case "Landmark":
      return <Landmark className={className} />;
    case "Globe":
      return <Globe className={className} />;
    case "BookOpen":
      return <BookOpen className={className} />;
    case "Cpu":
      return <Cpu className={className} />;
    case "Award":
      return <Award className={className} />;
    case "Shield":
      return <Shield className={className} />;
    case "Compass":
      return <Compass className={className} />;
    case "FileText":
      return <FileText className={className} />;
    default:
      return <Sparkles className={className} />;
  }
};

export const TopicsTab: React.FC<TopicsTabProps> = ({
  progressStore,
  subjects,
  chapters,
  questionsStore,
  selectedSubjectId,
  onSelectSubject,
  selectedChapterId,
  onSelectChapter,
  selectedTopicId,
  onSelectTopic,
  onStartSession,
  onOpenPDFExport,
  onBack,
  isAdmin = false,
  onEditTopic,
}) => {
  const [searchQuery, setSearchQuery] = React.useState("");
  const [shareData, setShareData] = React.useState<ShareData | null>(null);
  const [internalSelectedTopicId, setInternalSelectedTopicId] = React.useState<string | null>(null);

  // Local overrides for instant UI updates upon editing video/PDF links
  const [mediaOverrides, setMediaOverrides] = React.useState<Record<string, Partial<Topic>>>({});

  // Editing state for video & PDF (Admin)
  const [editingTopic, setEditingTopic] = React.useState<Topic | null>(null);
  const [formVideoUrl, setFormVideoUrl] = React.useState("");
  const [formVideoTitle, setFormVideoTitle] = React.useState("");
  const [formVideoDuration, setFormVideoDuration] = React.useState("");
  const [formPdfUrl, setFormPdfUrl] = React.useState("");
  const [formPdfTitle, setFormPdfTitle] = React.useState("");
  const [formSummary, setFormSummary] = React.useState("");
  const [isSavingMedia, setIsSavingMedia] = React.useState(false);

  const handleOpenEditMedia = (topic: Topic) => {
    triggerHaptic("light");
    playClickSound();
    setEditingTopic(topic);
    setFormVideoUrl(topic.videoUrl || "");
    setFormVideoTitle(topic.videoTitle || "");
    setFormVideoDuration(topic.videoDuration || "");
    setFormPdfUrl(topic.pdfUrl || "");
    setFormPdfTitle(topic.pdfTitle || "");
    setFormSummary(topic.guideSummary || "");
  };

  const handleSaveMedia = async () => {
    if (!editingTopic) return;
    setIsSavingMedia(true);
    triggerHaptic("medium");

    const updated: Topic = {
      ...editingTopic,
      videoUrl: formVideoUrl.trim() || undefined,
      videoTitle: formVideoTitle.trim() || undefined,
      videoDuration: formVideoDuration.trim() || undefined,
      pdfUrl: formPdfUrl.trim() || undefined,
      pdfTitle: formPdfTitle.trim() || undefined,
      guideSummary: formSummary.trim() || undefined,
    };

    setMediaOverrides((prev) => ({
      ...prev,
      [editingTopic.id]: updated,
    }));

    if (onEditTopic) {
      try {
        await onEditTopic(updated);
      } catch (e) {
        console.warn("Failed to propagate topic update", e);
      }
    }

    try {
      const { saveTopicToSupabase } = await import("../utils/supabaseSyncService");
      await saveTopicToSupabase(updated);
    } catch (e) {
      console.warn("Supabase topic direct save notice:", e);
    }

    setIsSavingMedia(false);
    setEditingTopic(null);
  };

  const renderMediaModal = () => (
    <AnimatePresence>
      {editingTopic && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[120] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="bg-white dark:bg-[#1E2230] rounded-3xl border border-[#E8D9C0] dark:border-[#31374A] max-w-lg w-full p-5 sm:p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between pb-3 border-b border-[#E8D9C0] dark:border-[#31374A]">
              <div>
                <h3 className="text-base font-black text-[#171923] dark:text-[#FFF9EF]">
                  वीडियो व PDF लिंक जोड़ें / बदलें
                </h3>
                <p className="text-xs text-[#52576A] dark:text-[#929AB0]">
                  {editingTopic.hindiTitle || editingTopic.title}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingTopic(null)}
                className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3.5">
              <div>
                <label className="block text-[11px] font-black uppercase text-slate-500 mb-1">
                  YouTube Video Link / ID
                </label>
                <input
                  type="text"
                  value={formVideoUrl}
                  onChange={(e) => setFormVideoUrl(e.target.value)}
                  placeholder="https://www.youtube.com/watch?v=... या Video ID"
                  className="w-full h-11 px-3.5 rounded-xl bg-[#FAF5EB] dark:bg-[#171923] border border-[#E8D9C0] dark:border-[#31374A] text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#800020]/40"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-black uppercase text-slate-500 mb-1">
                    Video Duration
                  </label>
                  <input
                    type="text"
                    value={formVideoDuration}
                    onChange={(e) => setFormVideoDuration(e.target.value)}
                    placeholder="उदा. 24:15 min"
                    className="w-full h-11 px-3.5 rounded-xl bg-[#FAF5EB] dark:bg-[#171923] border border-[#E8D9C0] dark:border-[#31374A] text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#800020]/40"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-black uppercase text-slate-500 mb-1">
                    Video Title (Optional)
                  </label>
                  <input
                    type="text"
                    value={formVideoTitle}
                    onChange={(e) => setFormVideoTitle(e.target.value)}
                    placeholder="लेक्चर का शीर्षक"
                    className="w-full h-11 px-3.5 rounded-xl bg-[#FAF5EB] dark:bg-[#171923] border border-[#E8D9C0] dark:border-[#31374A] text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#800020]/40"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-black uppercase text-slate-500 mb-1">
                  Google Drive / Direct PDF Link
                </label>
                <input
                  type="text"
                  value={formPdfUrl}
                  onChange={(e) => setFormPdfUrl(e.target.value)}
                  placeholder="https://drive.google.com/file/d/.../view"
                  className="w-full h-11 px-3.5 rounded-xl bg-[#FAF5EB] dark:bg-[#171923] border border-[#E8D9C0] dark:border-[#31374A] text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#800020]/40"
                />
              </div>

              <div>
                <label className="block text-[11px] font-black uppercase text-slate-500 mb-1">
                  PDF Title (Optional)
                </label>
                <input
                  type="text"
                  value={formPdfTitle}
                  onChange={(e) => setFormPdfTitle(e.target.value)}
                  placeholder="उदा. हस्तलिखित नोट्स भाग 1"
                  className="w-full h-11 px-3.5 rounded-xl bg-[#FAF5EB] dark:bg-[#171923] border border-[#E8D9C0] dark:border-[#31374A] text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#800020]/40"
                />
              </div>

              <div>
                <label className="block text-[11px] font-black uppercase text-slate-500 mb-1">
                  Guide Summary / Key Concepts
                </label>
                <textarea
                  rows={3}
                  value={formSummary}
                  onChange={(e) => setFormSummary(e.target.value)}
                  placeholder="मुख्य अध्ययन बिंदु जो छात्रों को वीडियो के नीचे दिखेंगे..."
                  className="w-full p-3 rounded-xl bg-[#FAF5EB] dark:bg-[#171923] border border-[#E8D9C0] dark:border-[#31374A] text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#800020]/40 resize-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#E8D9C0] dark:border-[#31374A]">
              <button
                type="button"
                onClick={() => setEditingTopic(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer"
              >
                रद्द करें
              </button>
              <button
                type="button"
                onClick={handleSaveMedia}
                disabled={isSavingMedia}
                className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-[#800020] hover:bg-[#600018] dark:bg-[#F47B20] dark:hover:bg-[#d66512] transition-all flex items-center gap-1.5 shadow-md active:scale-95 cursor-pointer disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                <span>{isSavingMedia ? "सेव हो रहा है..." : "सेव करें (Save)"}</span>
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  const currentTopicId = selectedTopicId !== undefined ? selectedTopicId : internalSelectedTopicId;
  const handleSelectTopic = onSelectTopic || setInternalSelectedTopicId;

  const activeSubject = React.useMemo(() => {
    if (!selectedSubjectId) return null;
    return subjects.find((s) => s.id === selectedSubjectId) || null;
  }, [subjects, selectedSubjectId]);

  const subjectChapters = React.useMemo(() => {
    if (!selectedSubjectId) return chapters;
    const sNorm = selectedSubjectId.toLowerCase().replace(/[-_]/g, "").trim();
    const targetSubject = subjects.find(
      (s) => s.id.toLowerCase().replace(/[-_]/g, "").trim() === sNorm ||
             (s.slug && s.slug.toLowerCase().replace(/[-_]/g, "").trim() === sNorm)
    );
    const sSlugNorm = targetSubject?.slug ? targetSubject.slug.toLowerCase().replace(/[-_]/g, "").trim() : "";

    return chapters.filter((c) => {
      const cSubNorm = (c.subjectId || "").toLowerCase().replace(/[-_]/g, "").trim();
      return cSubNorm === sNorm || (sSlugNorm && cSubNorm === sSlugNorm);
    });
  }, [chapters, selectedSubjectId, subjects]);

  const activeChapter = React.useMemo(() => {
    if (!selectedChapterId) return null;
    const ch = chapters.find((c) => c.id === selectedChapterId) || null;
    if (!ch) return null;
    // Apply local media overrides to topics
    return {
      ...ch,
      topics: (ch.topics || []).map((t) => {
        if (mediaOverrides[t.id]) {
          return { ...t, ...mediaOverrides[t.id] };
        }
        return t;
      }),
    };
  }, [chapters, selectedChapterId, mediaOverrides]);

  const activeTopic = React.useMemo(() => {
    if (!currentTopicId || !activeChapter) return null;
    const base = (activeChapter.topics || []).find((t) => t.id === currentTopicId) || null;
    if (base && mediaOverrides[base.id]) {
      return { ...base, ...mediaOverrides[base.id] };
    }
    return base;
  }, [currentTopicId, activeChapter, mediaOverrides]);

  const getSubjectStats = (subjectId: string) => {
    const sNorm = subjectId.toLowerCase().replace(/[-_]/g, "").trim();
    const targetSubject = subjects.find(
      (s) => s.id.toLowerCase().replace(/[-_]/g, "").trim() === sNorm ||
             (s.slug && s.slug.toLowerCase().replace(/[-_]/g, "").trim() === sNorm)
    );
    const sSlugNorm = targetSubject?.slug ? targetSubject.slug.toLowerCase().replace(/[-_]/g, "").trim() : "";

    const chs = chapters.filter((c) => {
      const cSubNorm = (c.subjectId || "").toLowerCase().replace(/[-_]/g, "").trim();
      return cSubNorm === sNorm || (sSlugNorm && cSubNorm === sSlugNorm);
    });

    const questionsCount = getSubjectQuestionsCount(subjectId, questionsStore);
    const allQuestions = chs.flatMap((c) => (c.topics || []).flatMap((t) => t.questions || []));
    const correct = allQuestions.filter(
      (q) => progressStore[q.id]?.status === "correct"
    );
    return {
      chaptersCount: chs.length,
      questionsCount,
      progressPct: questionsCount > 0 ? Math.round((correct.length / questionsCount) * 100) : 0,
    };
  };

  // ─────────────────────────────────────────────────────────────
  // LEVEL 4: SPECIFIC TOPIC VIEW (Detailed Topic Explorer)
  // ─────────────────────────────────────────────────────────────
  if (activeTopic && activeChapter) {
    return (
      <>
        <TopicDetailView
          topic={activeTopic}
          activeChapter={activeChapter}
          activeSubject={activeSubject}
          onBack={() => {
            // Robust hierarchical back: Return to topic list (chapter view)
            handleSelectTopic(null);
          }}
          onStartSession={onStartSession}
          isAdmin={isAdmin}
          onOpenEditMedia={handleOpenEditMedia}
        />
        {renderMediaModal()}
      </>
    );
  }

  // ─────────────────────────────────────────────────────────────
  // LEVEL 3: TOPICS OF A CHAPTER (Topic List)
  // ─────────────────────────────────────────────────────────────
  if (activeChapter) {
    return (
      <div className="flex flex-col h-full bg-[#FFF9EF] dark:bg-[#171923]" id="topics-explorer">
        <header className="px-4 pt-4 pb-4 bg-white/95 dark:bg-[#1F2330]/95 backdrop-blur-md border-b border-[#E8D9C0] dark:border-[#31374A] sticky top-0 z-40">
          <div className="flex items-center gap-3 max-w-4xl mx-auto w-full">
            <button
              onClick={() => {
                // Return to chapter list (subject view)
                onSelectChapter(null);
              }}
              className="w-9 h-9 rounded-xl bg-[#F7EFE2] dark:bg-[#252A3A] border border-[#E8D9C0] dark:border-[#31374A] flex items-center justify-center text-[#171923] dark:text-[#FFF9EF] active:scale-95 transition-all cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-bold text-[#800020] dark:text-[#C99A45] uppercase tracking-wider truncate">
                {activeSubject?.name || "Subject"} · Chapter {activeChapter.number || 1}
              </p>
              <h2 className="text-sm font-extrabold text-[#171923] dark:text-[#FFF9EF] truncate font-hindi">
                {activeChapter.title || activeChapter.hindiTitle}
              </h2>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto px-4 pt-4 pb-20 max-w-4xl mx-auto w-full">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            {(activeChapter.topics || [])
              .sort((a, b) => (a.number || 0) - (b.number || 0))
              .map((topic, idx) => (
                <TopicListItem
                  key={`${topic.id || 'topic'}-${idx}`}
                  topic={topic}
                  idx={idx}
                  onClickTopic={() => handleSelectTopic(topic.id)}
                  isAdmin={isAdmin}
                  onOpenEditMedia={handleOpenEditMedia}
                />
              ))}
          </div>
        </main>

        {shareData && (
          <ShareModal
            isOpen={!!shareData}
            onClose={() => setShareData(null)}
            data={shareData}
          />
        )}
        {renderMediaModal()}
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────
  // LEVEL 2: CHAPTERS OF A SUBJECT
  // ─────────────────────────────────────────────────────────────
  if (activeSubject) {
    return (
      <div className="flex flex-col h-full bg-[#FFF9EF] dark:bg-[#171923]" id="subject-chapters">
        <header className="px-4 pt-4 pb-4 bg-white/95 dark:bg-[#1F2330]/95 backdrop-blur-md border-b border-[#E8D9C0] dark:border-[#31374A] sticky top-0 z-40">
          <div className="flex items-center gap-3 max-w-4xl mx-auto w-full">
            <button
              onClick={() => {
                // Return to subject list (all subjects)
                onSelectSubject(null);
              }}
              className="w-9 h-9 rounded-xl bg-[#F7EFE2] dark:bg-[#252A3A] border border-[#E8D9C0] dark:border-[#31374A] flex items-center justify-center text-[#171923] dark:text-[#FFF9EF] active:scale-95 transition-all cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-bold text-[#800020] dark:text-[#C99A45] uppercase tracking-wider truncate">
                DISHA 20-20 Syllabus
              </p>
              <h2 className="text-sm font-extrabold text-[#171923] dark:text-[#FFF9EF] truncate font-hindi">
                {getSubjectDisplayName(activeSubject)}
              </h2>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto px-4 pt-4 pb-20 max-w-4xl mx-auto w-full">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            {subjectChapters.map((chapter, idx) => {
              const chNum = idx + 1;
              const chQuestionCount =
                (chapter.topics || []).reduce(
                  (sum, t) =>
                    sum +
                    (t.questions && t.questions.length > 0
                      ? t.questions.length
                      : t.questionCount || 0),
                  0
                ) ||
                chapter.questionCount ||
                0;

              return (
                <motion.button
                  key={`${chapter.id || 'ch'}-${idx}`}
                  whileTap={{ scale: 0.99 }}
                  onClick={() => onSelectChapter(chapter.id)}
                  className="w-full bg-white dark:bg-[#1F2330] border border-[#E8D9C0] dark:border-[#31374A] rounded-xl p-3.5 flex items-center gap-3.5 group hover:border-[#800020]/50 dark:hover:border-[#F47B20]/60 transition-all text-left shadow-xs cursor-pointer"
                >
                  <div className="w-9 h-9 rounded-xl bg-[#800020]/10 dark:bg-[#F47B20]/15 border border-[#800020]/20 dark:border-[#F47B20]/30 flex items-center justify-center text-xs font-black text-[#800020] dark:text-[#F47B20] shrink-0 font-mono tabular-nums">
                    {chNum}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="text-sm font-bold text-[#171923] dark:text-[#FFF9EF] group-hover:text-[#800020] dark:group-hover:text-[#F47B20] transition-colors font-hindi truncate">
                      {chNum}. {getChapterDisplayName(chapter)}
                    </h4>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mt-0.5 tabular-nums">
                      {(chapter.topics || []).length} Topics · {chQuestionCount} {chQuestionCount === 1 ? "Question" : "Questions"}
                    </p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-[#800020] dark:group-hover:text-[#F47B20] group-hover:translate-x-0.5 transition-all shrink-0" />
                </motion.button>
              );
            })}
          </div>
        </main>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────
  // LEVEL 1: ALL SUBJECTS
  // ─────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full bg-[#FFF9EF] dark:bg-[#171923]" id="all-subjects">
      <header className="px-3.5 py-2.5 bg-white/95 dark:bg-[#1F2330]/95 backdrop-blur-md border-b border-[#E8D9C0] dark:border-[#31374A] sticky top-0 z-40 select-none shadow-[0_2px_10px_rgba(23,25,35,0.03)]">
        <div className="max-w-4xl mx-auto w-full space-y-2">
          <div className="flex items-center justify-between gap-2">
            <button
              onClick={() => {
                // Priority: clear state/navigate tab via prop
                if (typeof onBack === "function") {
                  onBack();
                } else if (typeof window !== "undefined" && window.history.length > 1) {
                  window.history.back();
                }
              }}
              className="w-9 h-9 rounded-xl bg-[#F7EFE2] dark:bg-[#252A3A] border border-[#E8D9C0] dark:border-[#31374A] flex items-center justify-center text-[#171923] dark:text-[#FFF9EF] active:scale-95 transition-all cursor-pointer shrink-0"
              aria-label="Back"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="flex-1 text-center min-w-0 px-2">
              <h1 className="text-base font-extrabold text-[#171923] dark:text-[#FFF9EF] leading-none truncate">
                Curriculum & Subjects
              </h1>
              <p className="text-[10px] font-medium text-[#800020] dark:text-[#C99A45] mt-0.5 truncate">
                Subject & Chapter-wise Practice
              </p>
            </div>
            <button
              onClick={() => onOpenPDFExport?.()}
              className="w-9 h-9 rounded-xl bg-[#800020]/10 dark:bg-[#F47B20]/15 border border-[#800020]/20 dark:border-[#F47B20]/30 text-[#800020] dark:text-[#F47B20] flex items-center justify-center active:scale-95 transition-all cursor-pointer shrink-0"
              title="Download PDF"
              aria-label="Export PDF"
            >
              <FileDown className="w-4 h-4" />
            </button>
          </div>
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search subjects or chapters..."
              className="w-full bg-[#F7EFE2]/70 dark:bg-[#252A3A] border border-[#E8D9C0] dark:border-[#31374A] rounded-xl py-2 pl-9 pr-3 text-xs focus:ring-2 focus:ring-[#800020]/25 dark:focus:ring-[#F47B20]/30 focus:outline-none transition-all placeholder:text-slate-400 text-[#171923] dark:text-[#FFF9EF]"
            />
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto px-4 pt-5 pb-20 max-w-4xl mx-auto w-full">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 sm:gap-3">
          {(() => {
            const q = (searchQuery || "").trim().toLowerCase();
            const filteredSubjects = subjects
              .filter(s => {
                if (!s) return false;
                if (!q) return true;
                const matchName = (s.name || "").toLowerCase().includes(q);
                const matchHindi = (s.hindiName || "").toLowerCase().includes(q);
                return matchName || matchHindi;
              })
              .sort((a, b) => (a.order || 0) - (b.order || 0) || (a.name || "").localeCompare(b.name || ""));

            if (filteredSubjects.length === 0) {
              return (
                <div className="md:col-span-2 py-12 px-4 text-center space-y-3 bg-white dark:bg-[#1F2330] border border-[#E8D9C0] dark:border-[#31374A] rounded-3xl shadow-xs">
                  <div className="w-12 h-12 rounded-2xl bg-[#800020]/10 dark:bg-[#F47B20]/15 text-[#800020] dark:text-[#F47B20] flex items-center justify-center mx-auto shadow-xs">
                    <BookOpen className="w-6 h-6" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-sm font-black text-[#171923] dark:text-[#FFF9EF]">
                      {searchQuery ? "No matching subjects found" : "No Subjects Available"}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs mx-auto">
                      {searchQuery
                        ? "Try searching for a different keyword or clear search filter."
                        : "No subjects available currently. Add subjects from Admin panel."}
                    </p>
                  </div>
                </div>
              );
            }

            return filteredSubjects.map((subject, idx) => {
              const stats = getSubjectStats(subject.id);
              return (
                <motion.button
                  key={`${subject.id || 'sub'}-${idx}`}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => onSelectSubject(subject.id)}
                  className="bg-white dark:bg-[#1F2330] border border-[#E8D9C0] dark:border-[#31374A] rounded-xl sm:rounded-2xl py-3 px-3.5 sm:p-4 flex items-center justify-between gap-3 sm:gap-4 group hover:border-[#800020]/50 dark:hover:border-[#F47B20]/60 transition-all shadow-xs cursor-pointer"
                >
                  <div className="flex items-center gap-3 sm:gap-3.5 min-w-0">
                    <div className="w-8.5 h-8.5 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-[#800020]/10 dark:bg-[#F47B20]/15 border border-[#800020]/20 dark:border-[#F47B20]/30 flex items-center justify-center text-[#800020] dark:text-[#F47B20] font-mono font-black text-xs sm:text-sm shrink-0 tabular-nums">
                      {idx + 1}
                    </div>
                    <div className="text-left min-w-0">
                      <h4 className="text-[14.5px] sm:text-base font-extrabold text-[#171923] dark:text-[#FFF9EF] truncate group-hover:text-[#800020] dark:group-hover:text-[#F47B20] transition-colors leading-snug">
                        {getSubjectDisplayName(subject)}
                      </h4>
                      {getSubjectSecondaryName(subject) && (
                        <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 font-hindi truncate mt-0.5">
                          {getSubjectSecondaryName(subject)}
                        </p>
                      )}
                      <p className="text-[10px] sm:text-[11px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider mt-0.5 tabular-nums">
                        {stats.questionsCount} {stats.questionsCount === 1 ? "Question" : "Questions"}
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="w-4.5 h-4.5 sm:w-5 sm:h-5 text-slate-400 group-hover:text-[#800020] dark:group-hover:text-[#F47B20] group-hover:translate-x-0.5 transition-all shrink-0" />
                </motion.button>
              );
            });
          })()}
        </div>
      </main>
    </div>
  );
};

interface TopicListItemProps {
  topic: Topic;
  idx: number;
  onClickTopic: () => void;
  isAdmin?: boolean;
  onOpenEditMedia?: (topic: Topic) => void;
}

function TopicListItem({
  topic,
  idx,
  onClickTopic,
  isAdmin = false,
  onOpenEditMedia,
}: TopicListItemProps) {
  const topicNum = idx + 1;
  const qCount =
    topic.questions && topic.questions.length > 0
      ? topic.questions.length
      : topic.questionCount || 0;

  const hasVideo = Boolean(topic.videoUrl);
  const hasPdf = Boolean(topic.pdfUrl);

  return (
    <motion.div
      key={`${topic.id || 'topic'}-${idx}`}
      whileTap={{ scale: 0.99 }}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClickTopic();
        }
      }}
      onClick={onClickTopic}
      className="w-full bg-white dark:bg-[#1F2330] border border-[#E8D9C0] dark:border-[#31374A] rounded-xl p-3 sm:p-3.5 flex items-center justify-between gap-3 group cursor-pointer select-none hover:border-[#800020]/50 dark:hover:border-[#F47B20]/60 transition-all shadow-xs"
    >
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <div className="w-9 h-9 rounded-xl bg-[#800020]/10 dark:bg-[#F47B20]/15 border border-[#800020]/20 dark:border-[#F47B20]/30 flex items-center justify-center text-xs font-black text-[#800020] dark:text-[#F47B20] shrink-0 font-mono tabular-nums">
          {topicNum}
        </div>
        <div className="min-w-0 flex-1">
          <h4 className="text-sm font-bold text-[#171923] dark:text-[#FFF9EF] group-hover:text-[#800020] dark:group-hover:text-[#F47B20] transition-colors font-hindi truncate">
            {topicNum}. {getTopicDisplayName(topic)}
          </h4>
          <div className="flex flex-wrap items-center gap-1.5 mt-1">
            {topic.videoDuration ? (
              <span className="text-[10px] font-semibold text-[#52576A] dark:text-[#929AB0] flex items-center gap-0.5">
                <Clock className="w-3 h-3 text-[#800020] dark:text-[#F47B20]" />
                {topic.videoDuration}
              </span>
            ) : hasVideo ? (
              <span className="text-[9.5px] font-bold text-[#800020] dark:text-[#F47B20] bg-[#800020]/10 dark:bg-[#F47B20]/15 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                <Video className="w-3 h-3" />
                वीडियो
              </span>
            ) : null}

            {hasPdf && (
              <span className="text-[9.5px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                <FileText className="w-3 h-3" />
                PDF नोट्स
              </span>
            )}

            {qCount > 0 ? (
              <span className="text-[9.5px] font-bold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-1.5 py-0.5 rounded">
                {qCount} Qs
              </span>
            ) : (
              <span className="text-[9.5px] text-slate-400">
                0 Qs
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        {isAdmin && onOpenEditMedia && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onOpenEditMedia(topic);
            }}
            className="p-1.5 rounded-lg bg-[#FAF5EB] dark:bg-[#262B3D] text-[#800020] dark:text-[#F47B20] hover:bg-[#800020]/15 active:scale-95 transition-all cursor-pointer border border-[#E8D9C0]/50 dark:border-[#31374A]/50"
            title="वीडियो व PDF लिंक जोड़ें या बदलें"
          >
            <Edit3 className="w-3.5 h-3.5" />
          </button>
        )}
        <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-[#800020] dark:group-hover:text-[#F47B20] group-hover:translate-x-0.5 transition-all" />
      </div>
    </motion.div>
  );
};

interface TopicDetailViewProps {
  topic: Topic;
  activeChapter: Chapter;
  activeSubject: Subject | null;
  onBack: () => void;
  onStartSession: (session: MCQSession) => void;
  isAdmin?: boolean;
  onOpenEditMedia?: (topic: Topic) => void;
}

function TopicDetailView({
  topic,
  activeChapter,
  activeSubject,
  onBack,
  onStartSession,
  isAdmin = false,
  onOpenEditMedia,
}: TopicDetailViewProps) {
  const [isFetching, setIsFetching] = React.useState(false);
  const [activeFolderTab, setActiveFolderTab] = React.useState<"all" | "video" | "pdf" | "test">("all");

  const isCompleteQ = (q: any): q is Question =>
    Boolean(q && (q.text || (q as any).question) && Array.isArray(q.options) && q.options.length >= 2);

  const handleStartTopicMCQ = async () => {
    if (isFetching) return;
    setIsFetching(true);
    triggerHaptic("medium");
    playClickSound();

    try {
      let validQuestions: Question[] = [];

      if (Array.isArray(topic.questions) && topic.questions.length > 0) {
        validQuestions = topic.questions.filter(isCompleteQ);
      }

      if (validQuestions.length === 0) {
        const { loadUserQuestionsStore } = await import("../utils/questionsStorage");
        const store = loadUserQuestionsStore();
        const allStoreQs = [...(store.customQuestions || []), ...(store.cloudCacheQuestions || [])].filter(isCompleteQ);
        const matchingTopic = allStoreQs.filter((q) => q.topicId === topic.id || (q as any).topic === topic.id);
        if (matchingTopic.length > 0) {
          validQuestions = matchingTopic;
        }
      }

      if (validQuestions.length === 0) {
        const { getLocalMCQsByTopic } = await import("../utils/localDatabaseEngine");
        const localQs = await getLocalMCQsByTopic(topic.id);
        if (localQs && localQs.length > 0) {
          validQuestions = localQs.filter(isCompleteQ);
        }
      }

      if (validQuestions.length === 0) {
        const { fetchTopicQuestionsOnDemand } = await import("../utils/questionsStorage");
        const onDemandQs = await fetchTopicQuestionsOnDemand(topic.id);
        if (onDemandQs && onDemandQs.length > 0) {
          validQuestions = onDemandQs.filter(isCompleteQ);
        }
      }

      if (validQuestions.length === 0) {
        try {
          const { fetchQuestionsByTopic } = await import("../utils/supabaseSyncService");
          const sbQs = await fetchQuestionsByTopic(topic.id);
          if (sbQs && sbQs.length > 0) {
            validQuestions = sbQs.filter(isCompleteQ);
          }
        } catch (sbErr) {
          console.warn("[TopicsTab] Supabase topic fetch notice:", sbErr);
        }
      }

      if (validQuestions.length === 0) {
        alert("No questions available for this topic yet.");
        return;
      }

      const extraQs = validQuestions.map((q, qIdx) => ({
        ...q,
        id: q.id || `topic_${topic.id}_q_${qIdx}`,
        topicId: topic.id,
        chapterId: activeChapter.id,
      }));
      const questionIds = extraQs.map((q) => q.id);

      onStartSession({
        title: topic.title || topic.hindiTitle || "Topic Practice",
        subtitle: `${activeChapter.title || "Chapter"} • Topic Practice`,
        questionIds: questionIds,
        extraQuestions: extraQs,
        source: "topic",
        topicId: topic.id,
        chapterId: activeChapter.id,
      });
    } catch (e) {
      console.error("Failed to start topic MCQ session:", e);
    } finally {
      setIsFetching(false);
    }
  };

  const initialCount =
    topic.questions && topic.questions.length > 0
      ? topic.questions.length
      : topic.questionCount || 0;
  const [topicCount, setTopicCount] = React.useState<number>(initialCount);

  React.useEffect(() => {
    let isMounted = true;
    if ((topic.questions?.length || 0) === 0) {
      if (topic.questionCount && topic.questionCount > 0) {
        setTopicCount(topic.questionCount);
      }
      import("../utils/localDatabaseEngine").then(({ getLocalMCQsByTopic }) => {
        getLocalMCQsByTopic(topic.id).then((qs) => {
          if (isMounted && qs && qs.length > 0) {
            setTopicCount(qs.length);
          } else {
            import("../utils/questionsStorage").then(({ fetchTopicQuestionsOnDemand }) => {
              fetchTopicQuestionsOnDemand(topic.id).then((onDemand) => {
                if (isMounted && onDemand && onDemand.length > 0) {
                  setTopicCount(onDemand.length);
                }
              }).catch(() => {});
            }).catch(() => {});
          }
        }).catch(() => {});
      });
    } else {
      setTopicCount(topic.questions.length);
    }
    return () => { isMounted = false; };
  }, [topic.id, topic.questions?.length, topic.questionCount]);

  const questionCount = topicCount;

  return (
    <div className="flex flex-col h-full bg-[#FFF9EF] dark:bg-[#171923]" id="topic-detail-view">
      {/* Sticky Header */}
      <header className="px-4 pt-3.5 pb-3.5 bg-white/95 dark:bg-[#1F2330]/95 backdrop-blur-md border-b border-[#E8D9C0] dark:border-[#31374A] sticky top-0 z-40">
        <div className="flex items-center justify-between gap-3 max-w-4xl mx-auto w-full">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={onBack}
              className="w-9 h-9 rounded-xl bg-[#F7EFE2] dark:bg-[#252A3A] border border-[#E8D9C0] dark:border-[#31374A] flex items-center justify-center text-[#171923] dark:text-[#FFF9EF] active:scale-95 transition-all cursor-pointer shrink-0"
              title="पीछे जाएं"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="min-w-0">
              <p className="text-[10px] font-bold text-[#800020] dark:text-[#C99A45] uppercase tracking-wider truncate">
                {getSubjectDisplayName(activeSubject)} · {getChapterDisplayName(activeChapter)}
              </p>
              <h2 className="text-sm font-extrabold text-[#171923] dark:text-[#FFF9EF] truncate font-hindi">
                {getTopicDisplayName(topic)}
              </h2>
            </div>
          </div>

          {isAdmin && onOpenEditMedia && (
            <button
              type="button"
              onClick={() => onOpenEditMedia(topic)}
              className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl bg-[#800020] text-white hover:bg-[#600018] dark:bg-[#F47B20] transition-all cursor-pointer shadow-xs active:scale-95 shrink-0"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">वीडियो/PDF बदलें</span>
            </button>
          )}
        </div>
      </header>

      {/* Main All-In-One Coaching Content */}
      <main className="flex-1 overflow-y-auto p-3.5 sm:p-6 space-y-4 sm:space-y-5 max-w-4xl mx-auto w-full pb-24">
        {/* Topic Title Card */}
        <div className="bg-white dark:bg-[#1F2330] border border-[#E8D9C0] dark:border-[#31374A] rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
            <span className="inline-block text-[10px] font-black uppercase tracking-wider text-[#800020] dark:text-[#C99A45] bg-[#800020]/10 dark:bg-[#C99A45]/15 px-2.5 py-1 rounded-full">
              विषय अध्ययन सामग्री • Study Desk
            </span>
            {topic.videoDuration && (
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#52576A] dark:text-[#929AB0] bg-[#FAF5EB] dark:bg-[#262B3D] px-2.5 py-1 rounded-lg">
                <Clock className="w-3.5 h-3.5 text-[#800020] dark:text-[#F47B20]" />
                {topic.videoDuration}
              </span>
            )}
          </div>

          <h1 className="text-lg sm:text-2xl font-black text-[#171923] dark:text-[#FFF9EF] font-hindi leading-snug">
            {getTopicDisplayName(topic)}
          </h1>
          {getTopicSecondaryTitle(topic) && (
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-hindi mt-1">
              {getTopicSecondaryTitle(topic)}
            </p>
          )}

          {/* Folder / Tab Selector (Coaching Style) */}
          <div className="flex items-center gap-1.5 sm:gap-2 mt-4 pt-4 border-t border-[#E8D9C0] dark:border-[#31374A] overflow-x-auto no-scrollbar">
            <button
              onClick={() => setActiveFolderTab("all")}
              className={`px-3 py-1.5 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer shrink-0 ${
                activeFolderTab === "all"
                  ? "bg-[#800020] text-white shadow-xs"
                  : "bg-[#FAF5EB] dark:bg-[#262B3D] text-[#52576A] dark:text-[#929AB0] hover:bg-[#800020]/10"
              }`}
            >
              📁 सभी (All Content)
            </button>
            <button
              onClick={() => setActiveFolderTab("video")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer shrink-0 ${
                activeFolderTab === "video"
                  ? "bg-[#800020] text-white shadow-xs"
                  : "bg-[#FAF5EB] dark:bg-[#262B3D] text-[#52576A] dark:text-[#929AB0] hover:bg-[#800020]/10"
              }`}
            >
              <Video className="w-4 h-4" />
              <span>वीडियो {topic.videoUrl ? "✓" : ""}</span>
            </button>
            <button
              onClick={() => setActiveFolderTab("pdf")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer shrink-0 ${
                activeFolderTab === "pdf"
                  ? "bg-[#800020] text-white shadow-xs"
                  : "bg-[#FAF5EB] dark:bg-[#262B3D] text-[#52576A] dark:text-[#929AB0] hover:bg-[#800020]/10"
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>PDF नोट्स {topic.pdfUrl ? "✓" : ""}</span>
            </button>
            <button
              onClick={() => setActiveFolderTab("test")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer shrink-0 ${
                activeFolderTab === "test"
                  ? "bg-[#800020] text-white shadow-xs"
                  : "bg-[#FAF5EB] dark:bg-[#262B3D] text-[#52576A] dark:text-[#929AB0] hover:bg-[#800020]/10"
              }`}
            >
              <Award className="w-4 h-4" />
              <span>20-20 टेस्ट ({questionCount})</span>
            </button>
          </div>
        </div>

        {/* FOLDER 1: 🎥 COACHING VIDEO LECTURE */}
        {(activeFolderTab === "all" || activeFolderTab === "video") && (
          <div className="bg-white dark:bg-[#1F2330] border border-[#E8D9C0] dark:border-[#31374A] rounded-2xl sm:rounded-3xl p-4 sm:p-5 shadow-xs space-y-3">
            {topic.videoUrl ? (
              <CoachingVideoPlayer
                videoUrl={topic.videoUrl}
                title={topic.videoTitle || getTopicDisplayName(topic)}
                duration={topic.videoDuration}
                subjectName={getSubjectDisplayName(activeSubject)}
                chapterName={getChapterDisplayName(activeChapter)}
              />
            ) : (
              <div className="p-6 text-center bg-[#FAF5EB] dark:bg-[#262B3D] rounded-xl border border-dashed border-[#E8D9C0] dark:border-[#31374A]">
                <Video className="w-10 h-10 text-[#800020]/40 dark:text-[#F47B20]/40 mx-auto mb-2" />
                <p className="text-xs sm:text-sm font-semibold text-[#171923] dark:text-[#FFF9EF] mb-1">
                  इस टॉपिक की वीडियो क्लास जल्द ही अपडेट की जाएगी।
                </p>
                <p className="text-xs text-[#52576A] dark:text-[#929AB0]">
                  तब तक आप नीचे दिए गए PDF नोट्स पढ़ सकते हैं और 20-20 टेस्ट का अभ्यास कर सकते हैं।
                </p>
                {isAdmin && onOpenEditMedia && (
                  <button
                    type="button"
                    onClick={() => onOpenEditMedia(topic)}
                    className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-[#800020] text-white hover:bg-[#600018] dark:bg-[#F47B20] transition-all cursor-pointer shadow-xs active:scale-95"
                  >
                    <Plus className="w-4 h-4" />
                    <span>+ वीडियो क्लास लिंक जोड़ें</span>
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* FOLDER 2: 📄 STUDY NOTES & IN-APP PDF VIEWER */}
        {(activeFolderTab === "all" || activeFolderTab === "pdf") && (
          <div className="bg-white dark:bg-[#1F2330] border border-[#E8D9C0] dark:border-[#31374A] rounded-2xl sm:rounded-3xl p-4 sm:p-5 shadow-xs space-y-3">
            {topic.pdfUrl ? (
              <InAppPdfViewer
                pdfUrl={topic.pdfUrl}
                title={topic.pdfTitle || `${getTopicDisplayName(topic)} - हस्तलिखित नोट्स`}
                subjectName={getSubjectDisplayName(activeSubject)}
                chapterName={getChapterDisplayName(activeChapter)}
              />
            ) : (
              <div className="p-6 text-center bg-[#FAF5EB] dark:bg-[#262B3D] rounded-xl border border-dashed border-[#E8D9C0] dark:border-[#31374A]">
                <FileText className="w-10 h-10 text-[#800020]/40 dark:text-[#F47B20]/40 mx-auto mb-2" />
                <p className="text-xs sm:text-sm font-semibold text-[#171923] dark:text-[#FFF9EF] mb-1">
                  इस टॉपिक के लिए अभी PDF लिंक उपलब्ध नहीं है।
                </p>
                <p className="text-xs text-[#52576A] dark:text-[#929AB0]">
                  एडमिन जल्द ही इस टॉपिक के अध्ययन नोट्स संलग्न करेगा।
                </p>
                {isAdmin && onOpenEditMedia && (
                  <button
                    type="button"
                    onClick={() => onOpenEditMedia(topic)}
                    className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-[#800020] text-white hover:bg-[#600018] dark:bg-[#F47B20] transition-all cursor-pointer shadow-xs active:scale-95"
                  >
                    <Plus className="w-4 h-4" />
                    <span>+ PDF नोट्स लिंक जोड़ें</span>
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* FOLDER 3: 📝 20-20 PRACTICE TEST */}
        {(activeFolderTab === "all" || activeFolderTab === "test") && (
          <div className="bg-white dark:bg-[#1F2330] border border-[#E8D9C0] dark:border-[#31374A] rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm sm:text-base font-bold text-[#171923] dark:text-[#FFF9EF] flex items-center gap-2">
                <Award className="w-4.5 h-4.5 text-[#800020] dark:text-[#F47B20]" />
                <span>20-20 टेस्ट सिम्युलेशन (Topic MCQs Test)</span>
              </h2>
              <span className="text-xs font-bold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-2.5 py-1 rounded-lg">
                High Yield Practice
              </span>
            </div>

            <p className="text-xs sm:text-sm text-[#52576A] dark:text-[#929AB0]">
              इस टॉपिक में कुल <strong>{questionCount}</strong> मानक प्रश्न हैं, जिसमें RPSC व RSMSSB विगत परीक्षाओं के PYQ और परीक्षा-उन्मुख सम्भावित प्रश्न शामिल हैं।
            </p>

            <div className="grid grid-cols-2 gap-3">
              <div className="p-3.5 rounded-xl bg-[#FAF5EB] dark:bg-[#262B3D] border border-[#E8D9C0] dark:border-[#31374A] flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-[#800020] text-white flex items-center justify-center shrink-0">
                  <HelpCircle className="w-4.5 h-4.5" />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase text-slate-500 dark:text-slate-400">कुल प्रश्न</p>
                  <p className="text-sm sm:text-base font-black text-[#171923] dark:text-[#FFF9EF] tabular-nums">{questionCount} MCQs</p>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-[#FAF5EB] dark:bg-[#262B3D] border border-[#E8D9C0] dark:border-[#31374A] flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-[#F47B20] text-white flex items-center justify-center shrink-0">
                  <Award className="w-4.5 h-4.5" />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase text-slate-500 dark:text-slate-400">मार्किंग</p>
                  <p className="text-sm sm:text-base font-black text-[#171923] dark:text-[#FFF9EF]">20-20 टेस्ट</p>
                </div>
              </div>
            </div>

            <button
              onClick={handleStartTopicMCQ}
              disabled={isFetching}
              className="w-full py-3.5 px-6 rounded-xl sm:rounded-2xl bg-[#800020] hover:bg-[#600018] text-white font-bold text-sm sm:text-base border border-[#C99A45]/30 shadow-md flex items-center justify-center gap-2.5 transition-all duration-180 active:scale-98 cursor-pointer disabled:opacity-50"
            >
              {isFetching ? (
                <>
                  <RefreshCw className="w-4.5 h-4.5 animate-spin text-[#C99A45]" />
                  <span>टेस्ट लोड हो रहा है...</span>
                </>
              ) : (
                <>
                  <Play className="w-4.5 h-4.5 fill-white" />
                  <span>अभ्यास टेस्ट शुरू करें ({questionCount} प्रश्न)</span>
                  <ChevronRight className="w-4 h-4 text-[#C99A45]" />
                </>
              )}
            </button>
          </div>
        )}

        {/* SECTION 4: 📌 KEY CONCEPTS & SUMMARY */}
        {(activeFolderTab === "all" || activeFolderTab === "video") && (
          <div className="bg-[#FAF5EB]/80 dark:bg-[#1E2230] border border-[#E8D9C0] dark:border-[#31374A] rounded-2xl sm:rounded-3xl p-4 sm:p-5 shadow-xs space-y-2">
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-[#800020] dark:text-[#C99A45]">
              <Sparkles className="w-4 h-4 text-[#F47B20]" />
              <span>मुख्य अध्ययन बिंदु (Key Concepts & Exam Pointers)</span>
            </div>

            {topic.guideSummary ? (
              <div className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed font-hindi whitespace-pre-line">
                {topic.guideSummary}
              </div>
            ) : (
              <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed font-hindi">
                {topic.introText || topic.seoDescription || `इस टॉपिक में ${topic.hindiTitle || topic.title} से संबंधित महत्वपूर्ण बिंदु, परिभाषाएं और विगत परीक्षाओं के ट्रेंड शामिल हैं।`}
              </p>
            )}
          </div>
        )}
      </main>
    </div>
  );
};

export default TopicsTab;
