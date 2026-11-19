import React, { useState, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Subject,
  Chapter,
  Topic,
  ProgressStore,
} from "../types";
import {
  Play,
  FileText,
  ArrowLeft,
  Search,
  ExternalLink,
  Clock,
  Sparkles,
  BookOpen,
  Video,
  ChevronRight,
  Layers,
  Share2,
  CheckCircle2,
  AlertCircle,
  Edit3,
  Plus,
  X,
  Save,
} from "lucide-react";
import { triggerHaptic, playClickSound } from "../utils/audioFeedback";
import {
  getSubjectDisplayName,
  getSubjectSecondaryName,
  getChapterDisplayName,
  getChapterSecondaryTitle,
  getTopicDisplayName,
  getTopicSecondaryTitle,
} from "../utils/curriculumUtils";
import { SAMPLE_VIDEO_SUBJECTS, SAMPLE_VIDEO_CHAPTERS } from "../data/sampleVideoClasses";

interface VideoClassesTabProps {
  subjects: Subject[];
  chapters: Chapter[];
  progressStore?: ProgressStore;
  selectedSubjectId: string | null;
  onSelectSubject: (id: string | null) => void;
  selectedChapterId: string | null;
  onSelectChapter: (id: string | null) => void;
  selectedTopicId: string | null;
  onSelectTopic: (id: string | null) => void;
  onBack?: () => void;
  isAdmin?: boolean;
  onEditTopic?: (topic: Topic) => void;
}

// Utility to safely extract YouTube video ID from various link formats
export function extractYoutubeId(url?: string): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  // Already an 11-char ID
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) return trimmed;

  const regExp = /(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/))([\w-]{11})/;
  const match = trimmed.match(regExp);
  return match ? match[1] : null;
}

// Utility to convert Google Drive link to direct in-app embed preview URL
export function getDrivePreviewUrl(url?: string): string | null {
  if (!url) return null;
  const trimmed = url.trim();

  // Pattern: drive.google.com/file/d/FILE_ID/
  const matchFile = trimmed.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (matchFile && matchFile[1]) {
    return `https://drive.google.com/file/d/${matchFile[1]}/preview`;
  }

  // Pattern: drive.google.com/open?id=FILE_ID
  const matchId = trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (matchId && matchId[1]) {
    return `https://drive.google.com/file/d/${matchId[1]}/preview`;
  }

  // If already preview URL or generic web URL, return as is
  return trimmed;
}

export const VideoClassesTab: React.FC<VideoClassesTabProps> = ({
  subjects,
  chapters,
  progressStore = {},
  selectedSubjectId,
  onSelectSubject,
  selectedChapterId,
  onSelectChapter,
  selectedTopicId,
  onSelectTopic,
  onBack,
  isAdmin = false,
  onEditTopic,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeMediaTab, setActiveMediaTab] = useState<"video" | "pdf">("video");

  // Local overrides for instant UI update upon editing media
  const [mediaOverrides, setMediaOverrides] = useState<Record<string, Partial<Topic>>>({});

  // Editing state for video & PDF
  const [editingTopic, setEditingTopic] = useState<Topic | null>(null);
  const [formVideoUrl, setFormVideoUrl] = useState("");
  const [formVideoTitle, setFormVideoTitle] = useState("");
  const [formVideoDuration, setFormVideoDuration] = useState("");
  const [formPdfUrl, setFormPdfUrl] = useState("");
  const [formPdfTitle, setFormPdfTitle] = useState("");
  const [formSummary, setFormSummary] = useState("");
  const [isSavingMedia, setIsSavingMedia] = useState(false);

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

  // Merge provided subjects with sample video classes so demo data is always available
  const effectiveSubjects = useMemo(() => {
    const list = [...SAMPLE_VIDEO_SUBJECTS];
    if (subjects && subjects.length > 0) {
      subjects.forEach((s) => {
        if (!list.some((demo) => demo.id === s.id)) {
          list.push(s);
        }
      });
    }
    return list;
  }, [subjects]);

  const effectiveChapters = useMemo(() => {
    const list = [...SAMPLE_VIDEO_CHAPTERS];
    if (chapters && chapters.length > 0) {
      chapters.forEach((c) => {
        if (!list.some((demo) => demo.id === c.id)) {
          list.push(c);
        }
      });
    }
    // Apply local media overrides
    return list.map((c) => ({
      ...c,
      topics: (c.topics || []).map((t) => {
        if (mediaOverrides[t.id]) {
          return { ...t, ...mediaOverrides[t.id] };
        }
        return t;
      }),
    }));
  }, [chapters, mediaOverrides]);

  // Current Subject, Chapter, Topic objects
  const currentSubject = useMemo(
    () => effectiveSubjects.find((s) => s.id === selectedSubjectId) || null,
    [effectiveSubjects, selectedSubjectId]
  );

  const currentSubjectChapters = useMemo(() => {
    if (!selectedSubjectId) return [];
    return effectiveChapters.filter(
      (c) => c.subjectId === selectedSubjectId || (!c.subjectId && selectedSubjectId === effectiveSubjects[0]?.id)
    );
  }, [effectiveChapters, selectedSubjectId, effectiveSubjects]);

  const currentChapter = useMemo(
    () => currentSubjectChapters.find((c) => c.id === selectedChapterId) || null,
    [currentSubjectChapters, selectedChapterId]
  );

  const currentTopic = useMemo(() => {
    if (!currentChapter) return null;
    return currentChapter.topics.find((t) => t.id === selectedTopicId) || null;
  }, [currentChapter, selectedTopicId]);

  // Video stats per subject
  const subjectStats = useMemo(() => {
    const stats: Record<string, { totalTopics: number; videoCount: number; pdfCount: number }> = {};
    effectiveSubjects.forEach((sub) => {
      const subChaps = effectiveChapters.filter(
        (c) => c.subjectId === sub.id || (!c.subjectId && sub.id === effectiveSubjects[0]?.id)
      );
      let totalTopics = 0;
      let videoCount = 0;
      let pdfCount = 0;

      subChaps.forEach((chap) => {
        chap.topics.forEach((t) => {
          totalTopics++;
          if (t.videoUrl) videoCount++;
          if (t.pdfUrl) pdfCount++;
        });
      });

      stats[sub.id] = { totalTopics, videoCount, pdfCount };
    });
    return stats;
  }, [effectiveSubjects, effectiveChapters]);

  // Global search across topics
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase().trim();
    const results: { subject: Subject; chapter: Chapter; topic: Topic }[] = [];

    effectiveSubjects.forEach((sub) => {
      const subChaps = effectiveChapters.filter(
        (c) => c.subjectId === sub.id || (!c.subjectId && sub.id === effectiveSubjects[0]?.id)
      );
      subChaps.forEach((chap) => {
        chap.topics.forEach((topic) => {
          const title = (topic.hindiTitle || topic.title || "").toLowerCase();
          const chapTitle = (chap.hindiTitle || chap.title || "").toLowerCase();
          const subTitle = (sub.hindiName || sub.name || "").toLowerCase();

          if (title.includes(q) || chapTitle.includes(q) || subTitle.includes(q)) {
            results.push({ subject: sub, chapter: chap, topic });
          }
        });
      });
    });

    return results.slice(0, 30);
  }, [searchQuery, effectiveSubjects, effectiveChapters]);

  // Handlers
  const handleSubjectClick = (subId: string) => {
    triggerHaptic("light");
    playClickSound();
    onSelectSubject(subId);
    onSelectChapter(null);
    onSelectTopic(null);
  };

  const handleChapterClick = (chapId: string) => {
    triggerHaptic("light");
    playClickSound();
    onSelectChapter(chapId);
    onSelectTopic(null);
  };

  const handleTopicClick = (topId: string) => {
    triggerHaptic("light");
    playClickSound();
    onSelectTopic(topId);
    setActiveMediaTab("video");
  };

  const handleBackNavigation = () => {
    triggerHaptic("light");
    playClickSound();
    if (selectedTopicId) {
      onSelectTopic(null);
    } else if (selectedChapterId) {
      onSelectChapter(null);
    } else if (selectedSubjectId) {
      onSelectSubject(null);
    } else if (onBack) {
      onBack();
    }
  };

  // -------------------------------------------------------------
  // VIEW 4: TOPIC VIDEO PLAYER & STUDY DESK
  // -------------------------------------------------------------
  if (currentTopic && currentChapter && currentSubject) {
    const youtubeId = extractYoutubeId(currentTopic.videoUrl);
    const drivePreview = getDrivePreviewUrl(currentTopic.pdfUrl);

    return (
      <div className="max-w-4xl mx-auto px-3 sm:px-4 py-4 pb-24 md:pb-12">
        {/* Navigation Bar */}
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={handleBackNavigation}
            className="flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-[#800020] dark:text-[#F47B20] bg-white dark:bg-[#1E2230] px-3 py-1.5 rounded-xl border border-[#E8D9C0] dark:border-[#31374A] shadow-xs active:scale-95 transition-all cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>वापस (Back)</span>
          </button>

          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#800020] dark:text-[#F47B20] bg-[#800020]/10 dark:bg-[#F47B20]/15 px-2.5 py-1 rounded-full">
              {getSubjectDisplayName(currentSubject)}
            </span>
            {isAdmin && (
              <button
                onClick={() => handleOpenEditMedia(currentTopic)}
                className="flex items-center gap-1.5 text-xs font-bold text-white bg-[#800020] hover:bg-[#600018] dark:bg-[#F47B20] dark:hover:bg-[#d66512] px-3 py-1.5 rounded-xl shadow-xs active:scale-95 transition-all cursor-pointer"
                title="वीडियो व PDF लिंक अपडेट करें"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>वीडियो / PDF जोड़ें</span>
              </button>
            )}
          </div>
        </div>

        {/* Video Player Card */}
        <div className="bg-white dark:bg-[#1E2230] rounded-2xl border border-[#E8D9C0] dark:border-[#31374A] overflow-hidden shadow-md mb-4">
          {youtubeId ? (
            <div className="relative w-full aspect-video bg-black">
              <iframe
                src={`https://www.youtube-nocookie.com/embed/${youtubeId}?rel=0&modestbranding=1&enablejsapi=1`}
                title={currentTopic.videoTitle || currentTopic.hindiTitle || currentTopic.title}
                className="absolute inset-0 w-full h-full border-0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          ) : (
            <div className="w-full aspect-video bg-linear-to-br from-[#800020]/15 via-[#FFF9EF] to-[#F47B20]/15 dark:from-[#800020]/30 dark:via-[#171923] dark:to-[#F47B20]/20 flex flex-col items-center justify-center p-6 text-center">
              <div className="w-16 h-16 rounded-2xl bg-[#800020]/10 dark:bg-[#F47B20]/20 flex items-center justify-center text-[#800020] dark:text-[#F47B20] mb-3 shadow-inner">
                <Video className="w-8 h-8" />
              </div>
              <h3 className="text-base sm:text-lg font-bold text-[#171923] dark:text-[#FFF9EF] mb-1">
                {currentTopic.hindiTitle || currentTopic.title}
              </h3>
              <p className="text-xs sm:text-sm text-[#52576A] dark:text-[#929AB0] max-w-md">
                इस टॉपिक की वीडियो क्लास जल्द ही अपडेट की जाएगी। तब तक आप नीचे दिए गए PDF नोट्स पढ़ सकते हैं।
              </p>
              {isAdmin && (
                <button
                  onClick={() => handleOpenEditMedia(currentTopic)}
                  className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-[#800020] text-white hover:bg-[#600018] dark:bg-[#F47B20] transition-all cursor-pointer shadow-xs active:scale-95"
                >
                  <Plus className="w-4 h-4" />
                  <span>+ वीडियो क्लास लिंक जोड़ें</span>
                </button>
              )}
            </div>
          )}

          {/* Topic Title and Details */}
          <div className="p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
              <h1 className="text-lg sm:text-xl font-bold text-[#171923] dark:text-[#FFF9EF]">
                {currentTopic.hindiTitle || currentTopic.title}
              </h1>
              {currentTopic.videoDuration && (
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#52576A] dark:text-[#929AB0] bg-[#FAF5EB] dark:bg-[#262B3D] px-2.5 py-1 rounded-lg">
                  <Clock className="w-3.5 h-3.5 text-[#800020] dark:text-[#F47B20]" />
                  {currentTopic.videoDuration}
                </span>
              )}
            </div>

            <p className="text-xs sm:text-sm text-[#52576A] dark:text-[#929AB0] mb-4">
              {getChapterDisplayName(currentChapter)} • {getSubjectDisplayName(currentSubject)}
            </p>

            {/* Media Tabs Selector */}
            <div className="flex items-center gap-2 border-b border-[#E8D9C0] dark:border-[#31374A] pb-3">
              <button
                onClick={() => setActiveMediaTab("video")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                  activeMediaTab === "video"
                    ? "bg-[#800020] text-white shadow-xs"
                    : "text-[#52576A] dark:text-[#929AB0] hover:bg-[#FAF5EB] dark:hover:bg-[#262B3D]"
                }`}
              >
                <Video className="w-4 h-4" />
                <span>क्लास विवरण</span>
              </button>

              <button
                onClick={() => setActiveMediaTab("pdf")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                  activeMediaTab === "pdf"
                    ? "bg-[#800020] text-white shadow-xs"
                    : "text-[#52576A] dark:text-[#929AB0] hover:bg-[#FAF5EB] dark:hover:bg-[#262B3D]"
                }`}
              >
                <FileText className="w-4 h-4" />
                <span>PDF नोट्स {currentTopic.pdfUrl ? "✓" : ""}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Tab 1: Lecture Info */}
        {activeMediaTab === "video" && (
          <div className="bg-white dark:bg-[#1E2230] rounded-2xl border border-[#E8D9C0] dark:border-[#31374A] p-5 shadow-xs">
            <h2 className="text-sm sm:text-base font-bold text-[#171923] dark:text-[#FFF9EF] mb-3 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#800020] dark:text-[#F47B20]" />
              मुख्य अध्ययन बिंदु (Key Concepts)
            </h2>

            {currentTopic.guideSummary ? (
              <div className="prose dark:prose-invert text-xs sm:text-sm text-[#52576A] dark:text-[#929AB0] leading-relaxed whitespace-pre-line">
                {currentTopic.guideSummary}
              </div>
            ) : (
              <p className="text-xs sm:text-sm text-[#52576A] dark:text-[#929AB0] leading-relaxed">
                इस कक्षा में <strong>{currentTopic.hindiTitle || currentTopic.title}</strong> से संबंधित परीक्षा-उन्मुख महत्वपूर्ण तथ्यों, विगत वर्षों में पूछे गए प्रश्नों के प्रकार और समाधान ट्रिक्स को समझाया गया है।
              </p>
            )}

            {currentTopic.pdfUrl && (
              <div className="mt-5 pt-4 border-t border-[#E8D9C0] dark:border-[#31374A] flex flex-wrap items-center justify-end gap-3">
                <button
                  onClick={() => setActiveMediaTab("pdf")}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-[#FAF5EB] dark:bg-[#262B3D] text-[#800020] dark:text-[#F47B20] text-xs sm:text-sm font-bold px-4 py-2.5 rounded-xl border border-[#E8D9C0] dark:border-[#31374A] hover:bg-white dark:hover:bg-[#1E2230] transition-all cursor-pointer"
                >
                  <FileText className="w-4 h-4" />
                  <span>PDF नोट्स पढ़ें</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Drive PDF Notes */}
        {activeMediaTab === "pdf" && (
          <div className="bg-white dark:bg-[#1E2230] rounded-2xl border border-[#E8D9C0] dark:border-[#31374A] p-4 sm:p-5 shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm sm:text-base font-bold text-[#171923] dark:text-[#FFF9EF] flex items-center gap-2">
                <FileText className="w-4 h-4 text-[#800020] dark:text-[#F47B20]" />
                {currentTopic.pdfTitle || "हस्तलिखित नोट्स व अध्ययन गाइड"}
              </h2>

              {currentTopic.pdfUrl && (
                <a
                  href={currentTopic.pdfUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs font-bold text-[#800020] dark:text-[#F47B20] hover:underline"
                >
                  <span>Drive में खोलें</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
            </div>

            {drivePreview ? (
              <div className="w-full h-[520px] rounded-xl overflow-hidden border border-[#E8D9C0] dark:border-[#31374A] bg-[#FAF5EB] dark:bg-[#171923]">
                <iframe
                  src={drivePreview}
                  title="PDF Notes"
                  className="w-full h-full border-0"
                  allow="autoplay"
                />
              </div>
            ) : (
              <div className="p-8 text-center bg-[#FAF5EB] dark:bg-[#262B3D] rounded-xl border border-dashed border-[#E8D9C0] dark:border-[#31374A]">
                <FileText className="w-10 h-10 text-[#800020]/40 dark:text-[#F47B20]/40 mx-auto mb-2" />
                <p className="text-xs sm:text-sm font-semibold text-[#171923] dark:text-[#FFF9EF] mb-1">
                  इस टॉपिक के लिए अभी PDF लिंक उपलब्ध नहीं है।
                </p>
                <p className="text-xs text-[#52576A] dark:text-[#929AB0]">
                  एडमिन जल्द ही इस टॉपिक के अध्ययन नोट्स संलग्न करेगा।
                </p>
                {isAdmin && (
                  <button
                    onClick={() => handleOpenEditMedia(currentTopic)}
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

        {/* Render Media Modal */}
        {renderMediaModal()}
      </div>
    );
  }

  // -------------------------------------------------------------
  // VIEW 3: CHAPTER TOPICS LIST
  // -------------------------------------------------------------
  if (currentChapter && currentSubject) {
    return (
      <div className="max-w-4xl mx-auto px-3 sm:px-4 py-4 pb-24 md:pb-12">
        {/* Navigation Breadcrumb */}
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={handleBackNavigation}
            className="flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-[#800020] dark:text-[#F47B20] bg-white dark:bg-[#1E2230] px-3 py-1.5 rounded-xl border border-[#E8D9C0] dark:border-[#31374A] shadow-xs active:scale-95 transition-all cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>अध्याय सूची (Chapters)</span>
          </button>

          <span className="text-[11px] font-bold text-[#800020] dark:text-[#F47B20] bg-[#800020]/10 dark:bg-[#F47B20]/15 px-2.5 py-1 rounded-full">
            {getSubjectDisplayName(currentSubject)}
          </span>
        </div>

        {/* Chapter Header */}
        <div className="bg-white dark:bg-[#1E2230] rounded-2xl border border-[#E8D9C0] dark:border-[#31374A] p-4 sm:p-5 shadow-xs mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-[#800020]/10 dark:bg-[#F47B20]/15 text-[#800020] dark:text-[#F47B20] flex items-center justify-center font-bold text-lg">
              {currentChapter.number || 1}
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-bold text-[#171923] dark:text-[#FFF9EF]">
                {getChapterDisplayName(currentChapter)}
              </h1>
              <p className="text-xs text-[#52576A] dark:text-[#929AB0]">
                कुल {currentChapter.topics.length} टॉपिक्स • वीडियो व नोट्स
              </p>
            </div>
          </div>
        </div>

        {/* Topics List */}
        <div className="space-y-2.5">
          {currentChapter.topics.map((topic, idx) => {
            const hasVideo = Boolean(topic.videoUrl);
            const hasPdf = Boolean(topic.pdfUrl);

            return (
              <motion.div
                key={topic.id}
                whileHover={{ scale: 1.005 }}
                whileTap={{ scale: 0.99 }}
                onClick={() => handleTopicClick(topic.id)}
                className="bg-white dark:bg-[#1E2230] rounded-xl border border-[#E8D9C0] dark:border-[#31374A] p-3.5 sm:p-4 flex items-center justify-between gap-3 shadow-xs hover:border-[#800020]/40 dark:hover:border-[#F47B20]/40 transition-all cursor-pointer"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                      hasVideo
                        ? "bg-[#800020] text-white shadow-xs"
                        : "bg-[#FAF5EB] dark:bg-[#262B3D] text-[#52576A] dark:text-[#929AB0]"
                    }`}
                  >
                    <Play className="w-4 h-4 fill-current ml-0.5" />
                  </div>

                  <div className="min-w-0">
                    <h3 className="text-xs sm:text-sm font-bold text-[#171923] dark:text-[#FFF9EF] truncate">
                      {topic.hindiTitle || topic.title}
                    </h3>
                    <div className="flex items-center gap-2 mt-1">
                      {topic.videoDuration ? (
                        <span className="text-[10px] font-semibold text-[#52576A] dark:text-[#929AB0] flex items-center gap-0.5">
                          <Clock className="w-3 h-3 text-[#800020] dark:text-[#F47B20]" />
                          {topic.videoDuration}
                        </span>
                      ) : (
                        <span className="text-[10px] text-[#52576A] dark:text-[#929AB0]">
                          टॉपिक #{idx + 1}
                        </span>
                      )}

                      {hasPdf && (
                        <span className="text-[9.5px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.5 rounded">
                          PDF नोट्स
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {isAdmin && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenEditMedia(topic);
                      }}
                      className="p-1.5 sm:p-2 rounded-xl bg-[#FAF5EB] dark:bg-[#262B3D] text-[#800020] dark:text-[#F47B20] hover:bg-[#800020]/15 active:scale-95 transition-all cursor-pointer border border-[#E8D9C0]/50 dark:border-[#31374A]/50"
                      title="वीडियो / PDF लिंक जोड़ें या बदलें"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <span className="text-xs font-bold text-[#800020] dark:text-[#F47B20] hidden sm:inline">
                    देखें
                  </span>
                  <ChevronRight className="w-4 h-4 text-[#800020] dark:text-[#F47B20]" />
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Render Media Modal */}
        {renderMediaModal()}
      </div>
    );
  }

  // -------------------------------------------------------------
  // VIEW 2: SUBJECT'S CHAPTERS LIST
  // -------------------------------------------------------------
  if (currentSubject) {
    return (
      <div className="max-w-4xl mx-auto px-3 sm:px-4 py-4 pb-24 md:pb-12">
        {/* Navigation Breadcrumb */}
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={handleBackNavigation}
            className="flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-[#800020] dark:text-[#F47B20] bg-white dark:bg-[#1E2230] px-3 py-1.5 rounded-xl border border-[#E8D9C0] dark:border-[#31374A] shadow-xs active:scale-95 transition-all cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>सभी विषय (Subjects)</span>
          </button>

          <span className="text-[11px] font-bold text-[#800020] dark:text-[#F47B20] bg-[#800020]/10 dark:bg-[#F47B20]/15 px-2.5 py-1 rounded-full">
            {currentSubjectChapters.length} अध्याय
          </span>
        </div>

        {/* Subject Banner */}
        <div className="bg-linear-to-r from-[#800020] to-[#550015] rounded-2xl p-5 text-white shadow-md mb-4">
          <div className="flex items-center gap-2 text-xs font-bold text-[#F47B20] uppercase tracking-wider mb-1">
            <Video className="w-4 h-4" />
            <span>वीडियो क्लास रूम</span>
          </div>
          <h1 className="text-lg sm:text-xl font-bold mb-1">
            {getSubjectDisplayName(currentSubject)}
          </h1>
          <p className="text-xs text-white/80">
            {getSubjectSecondaryName(currentSubject)}
          </p>
        </div>

        {/* Chapters Grid / List */}
        <div className="space-y-3">
          {currentSubjectChapters.map((chapter) => {
            let totalVids = 0;
            let totalPdfs = 0;
            chapter.topics.forEach((t) => {
              if (t.videoUrl) totalVids++;
              if (t.pdfUrl) totalPdfs++;
            });

            return (
              <motion.div
                key={chapter.id}
                whileHover={{ scale: 1.005 }}
                whileTap={{ scale: 0.99 }}
                onClick={() => handleChapterClick(chapter.id)}
                className="bg-white dark:bg-[#1E2230] rounded-xl border border-[#E8D9C0] dark:border-[#31374A] p-4 flex items-center justify-between gap-4 shadow-xs hover:border-[#800020]/40 dark:hover:border-[#F47B20]/40 transition-all cursor-pointer"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-[#800020]/10 dark:bg-[#F47B20]/15 text-[#800020] dark:text-[#F47B20] flex items-center justify-center font-bold text-sm shrink-0">
                    {chapter.number || 1}
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-xs sm:text-sm font-bold text-[#171923] dark:text-[#FFF9EF] truncate">
                      {getChapterDisplayName(chapter)}
                    </h3>
                    <p className="text-[11px] text-[#52576A] dark:text-[#929AB0] mt-0.5">
                      {chapter.topics.length} टॉपिक्स • {totalVids > 0 ? `${totalVids} वीडियो क्लास` : "क्लासेस उपलब्ध"}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs font-bold text-[#800020] dark:text-[#F47B20] hidden sm:inline">
                    टॉपिक्स देखें
                  </span>
                  <ChevronRight className="w-4 h-4 text-[#800020] dark:text-[#F47B20]" />
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // VIEW 1: ROOT - SUBJECTS LIST & SEARCH
  // -------------------------------------------------------------
  return (
    <div className="max-w-4xl mx-auto px-3 sm:px-4 py-4 pb-24 md:pb-12">
      {/* Header Banner */}
      <div className="bg-linear-to-r from-[#800020] via-[#650019] to-[#800020] rounded-2xl p-5 sm:p-6 text-white shadow-md mb-5">
        <div className="flex items-center gap-2 text-xs font-bold text-[#F47B20] uppercase tracking-wider mb-1.5">
          <Play className="w-4 h-4 fill-[#F47B20]" />
          <span>दिशा 20-20 वीडियो लेक्चर हब</span>
        </div>
        <h1 className="text-xl sm:text-2xl font-black mb-1.5">
          वीडियो क्लासेज एवं अध्ययन सामग्री
        </h1>
        <p className="text-xs sm:text-sm text-white/80 max-w-xl">
          RPSC एवं RSMSSB की सभी परीक्षाओं के लिए विषयवार उच्च-गुणवत्ता वीडियो व्याख्यान एवं हस्तलिखित PDF अध्ययन नोट्स।
        </p>

        {/* Search Bar */}
        <div className="relative mt-4">
          <Search className="w-4 h-4 text-white/50 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="विषय, अध्याय या टॉपिक खोजें (जैसे: प्रजामंडल, खनिज, सभ्यता)..."
            className="w-full bg-white/10 text-white placeholder-white/60 text-xs sm:text-sm rounded-xl pl-9.5 pr-4 py-2.5 border border-white/20 focus:outline-none focus:ring-2 focus:ring-[#F47B20] backdrop-blur-md"
          />
        </div>
      </div>

      {/* If Search Query Active */}
      {searchQuery.trim() ? (
        <div>
          <h2 className="text-xs sm:text-sm font-bold text-[#52576A] dark:text-[#929AB0] uppercase tracking-wider mb-3">
            खोज परिणाम ({searchResults.length})
          </h2>

          {searchResults.length === 0 ? (
            <div className="text-center py-12 bg-white dark:bg-[#1E2230] rounded-2xl border border-[#E8D9C0] dark:border-[#31374A] p-6">
              <Search className="w-10 h-10 text-[#800020]/40 dark:text-[#F47B20]/40 mx-auto mb-2" />
              <p className="text-sm font-bold text-[#171923] dark:text-[#FFF9EF]">
                कोई टॉपिक नहीं मिला
              </p>
              <p className="text-xs text-[#52576A] dark:text-[#929AB0] mt-1">
                कृपया दूसरे कीवर्ड से खोजें।
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {searchResults.map(({ subject, chapter, topic }) => (
                <div
                  key={topic.id}
                  onClick={() => {
                    onSelectSubject(subject.id);
                    onSelectChapter(chapter.id);
                    onSelectTopic(topic.id);
                  }}
                  className="bg-white dark:bg-[#1E2230] p-3.5 rounded-xl border border-[#E8D9C0] dark:border-[#31374A] flex items-center justify-between cursor-pointer hover:border-[#800020]/40 dark:hover:border-[#F47B20]/40 transition-all"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-[#800020]/10 dark:bg-[#F47B20]/15 text-[#800020] dark:text-[#F47B20] flex items-center justify-center shrink-0">
                      <Play className="w-3.5 h-3.5 fill-current" />
                    </div>
                    <div>
                      <h4 className="text-xs sm:text-sm font-bold text-[#171923] dark:text-[#FFF9EF]">
                        {topic.hindiTitle || topic.title}
                      </h4>
                      <p className="text-[10px] text-[#52576A] dark:text-[#929AB0]">
                        {getSubjectDisplayName(subject)} • {getChapterDisplayName(chapter)}
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-[#800020] dark:text-[#F47B20]" />
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* Subjects Grid */
        <div>
          <h2 className="text-xs sm:text-sm font-bold text-[#52576A] dark:text-[#929AB0] uppercase tracking-wider mb-3 flex items-center justify-between">
            <span>विषय चुनें (Select Subject)</span>
            <span className="text-[11px] font-normal lowercase">{effectiveSubjects.length} उपलब्ध</span>
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {effectiveSubjects.map((sub, idx) => {
              const stats = subjectStats[sub.id] || { totalTopics: 0, videoCount: 0, pdfCount: 0 };
              return (
                <motion.div
                  key={sub.id}
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  onClick={() => handleSubjectClick(sub.id)}
                  className="bg-white dark:bg-[#1E2230] rounded-2xl border border-[#E8D9C0] dark:border-[#31374A] p-4.5 flex flex-col justify-between shadow-xs hover:border-[#800020]/50 dark:hover:border-[#F47B20]/50 hover:shadow-md transition-all cursor-pointer group"
                >
                  <div>
                    <div className="flex items-center justify-between mb-2.5">
                      <div className="w-10 h-10 rounded-xl bg-[#800020]/10 dark:bg-[#F47B20]/15 text-[#800020] dark:text-[#F47B20] flex items-center justify-center font-bold text-sm">
                        <BookOpen className="w-5 h-5" />
                      </div>
                      <span className="text-[10px] font-bold text-[#800020] dark:text-[#F47B20] bg-[#800020]/5 dark:bg-[#F47B20]/10 px-2 py-0.5 rounded-full">
                        विषय #{idx + 1}
                      </span>
                    </div>

                    <h3 className="text-sm sm:text-base font-bold text-[#171923] dark:text-[#FFF9EF] group-hover:text-[#800020] dark:group-hover:text-[#F47B20] transition-colors">
                      {getSubjectDisplayName(sub)}
                    </h3>
                    <p className="text-xs text-[#52576A] dark:text-[#929AB0] line-clamp-1 mt-0.5">
                      {getSubjectSecondaryName(sub)}
                    </p>
                  </div>

                  <div className="mt-4 pt-3 border-t border-[#E8D9C0]/60 dark:border-[#31374A]/60 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-3 text-[#52576A] dark:text-[#929AB0]">
                      <span className="flex items-center gap-1 text-[11px] font-semibold">
                        <Video className="w-3.5 h-3.5 text-[#800020] dark:text-[#F47B20]" />
                        {stats.totalTopics} टॉपिक्स
                      </span>
                      {stats.pdfCount > 0 && (
                        <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
                          <FileText className="w-3.5 h-3.5" />
                          {stats.pdfCount} PDFs
                        </span>
                      )}
                    </div>
                    <ChevronRight className="w-4 h-4 text-[#800020] dark:text-[#F47B20] group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}

      {/* Render Media Modal */}
      {renderMediaModal()}
    </div>
  );
};

export default VideoClassesTab;
