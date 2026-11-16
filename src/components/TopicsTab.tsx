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
} from "lucide-react";
import ShareModal, { ShareData } from "./ShareModal";
import { buildTopicShareData } from "../utils/shareService";
import { getSubjectQuestionsCount } from "../utils/questionsStorage";
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
}) => {
  const [searchQuery, setSearchQuery] = React.useState("");
  const [shareData, setShareData] = React.useState<ShareData | null>(null);
  const [internalSelectedTopicId, setInternalSelectedTopicId] = React.useState<string | null>(null);

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
    return chapters.find((c) => c.id === selectedChapterId) || null;
  }, [chapters, selectedChapterId]);

  const activeTopic = React.useMemo(() => {
    if (!currentTopicId || !activeChapter) return null;
    return (activeChapter.topics || []).find((t) => t.id === currentTopicId) || null;
  }, [currentTopicId, activeChapter]);

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
      <TopicDetailView
        topic={activeTopic}
        activeChapter={activeChapter}
        activeSubject={activeSubject}
        onBack={() => {
          // Robust hierarchical back: Ensure we return to topic list (chapter view)
          if (currentTopicId) {
            handleSelectTopic(null);
          } else if (typeof window !== "undefined" && window.history.length > 1) {
            window.history.back();
          } else {
            onSelectChapter(null);
          }
        }}
        onStartSession={onStartSession}
      />
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
                // If we are in the topics list of a chapter, return to the chapter list (subject view)
                if (activeChapter) {
                  onSelectChapter(null);
                } else if (typeof window !== "undefined" && window.history.length > 1) {
                  window.history.back();
                } else {
                  onSelectSubject(null);
                }
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
                // If we are in the chapters list of a subject, return to the subject list (all subjects)
                if (activeSubject) {
                  onSelectSubject(null);
                } else if (typeof window !== "undefined" && window.history.length > 1) {
                  window.history.back();
                } else {
                  onBack?.();
                }
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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
                  className="bg-white dark:bg-[#1F2330] border border-[#E8D9C0] dark:border-[#31374A] rounded-2xl p-4 flex items-center justify-between gap-4 group hover:border-[#800020]/50 dark:hover:border-[#F47B20]/60 transition-all shadow-xs cursor-pointer"
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-[#800020]/10 dark:bg-[#F47B20]/15 border border-[#800020]/20 dark:border-[#F47B20]/30 flex items-center justify-center text-[#800020] dark:text-[#F47B20] font-mono font-black text-sm shrink-0 tabular-nums">
                      {idx + 1}
                    </div>
                    <div className="text-left min-w-0">
                      <h4 className="text-base font-extrabold text-[#171923] dark:text-[#FFF9EF] truncate group-hover:text-[#800020] dark:group-hover:text-[#F47B20] transition-colors leading-tight">
                        {getSubjectDisplayName(subject)}
                      </h4>
                      {getSubjectSecondaryName(subject) && (
                        <p className="text-xs text-slate-500 dark:text-slate-400 font-hindi truncate mt-0.5">
                          {getSubjectSecondaryName(subject)}
                        </p>
                      )}
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider mt-0.5 tabular-nums">
                        {stats.questionsCount} {stats.questionsCount === 1 ? "Question" : "Questions"}
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-[#800020] dark:group-hover:text-[#F47B20] group-hover:translate-x-0.5 transition-all shrink-0" />
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
}

const TopicListItem: React.FC<TopicListItemProps> = ({ topic, idx, onClickTopic }) => {
  const topicNum = idx + 1;
  const qCount =
    topic.questions && topic.questions.length > 0
      ? topic.questions.length
      : topic.questionCount || 0;

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
      className="w-full bg-white dark:bg-[#1F2330] border border-[#E8D9C0] dark:border-[#31374A] rounded-xl p-3.5 flex items-center justify-between gap-3 group cursor-pointer select-none hover:border-[#800020]/50 dark:hover:border-[#F47B20]/60 transition-all shadow-xs"
    >
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <div className="w-9 h-9 rounded-xl bg-[#800020]/10 dark:bg-[#F47B20]/15 border border-[#800020]/20 dark:border-[#F47B20]/30 flex items-center justify-center text-xs font-black text-[#800020] dark:text-[#F47B20] shrink-0 font-mono tabular-nums">
          {topicNum}
        </div>
        <div className="min-w-0 flex-1">
          <h4 className="text-sm font-bold text-[#171923] dark:text-[#FFF9EF] group-hover:text-[#800020] dark:group-hover:text-[#F47B20] transition-colors font-hindi truncate">
            {topicNum}. {getTopicDisplayName(topic)}
          </h4>
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mt-0.5 tabular-nums">
            {qCount} {qCount === 1 ? "Question" : "Questions"}
          </p>
        </div>
      </div>
      <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-[#800020] dark:group-hover:text-[#F47B20] group-hover:translate-x-0.5 transition-all shrink-0" />
    </motion.div>
  );
};

interface TopicDetailViewProps {
  topic: Topic;
  activeChapter: Chapter;
  activeSubject: Subject | null;
  onBack: () => void;
  onStartSession: (session: MCQSession) => void;
}

const TopicDetailView: React.FC<TopicDetailViewProps> = ({
  topic,
  activeChapter,
  activeSubject,
  onBack,
  onStartSession,
}) => {
  const [isFetching, setIsFetching] = React.useState(false);

  const isCompleteQ = (q: any): q is Question =>
    Boolean(q && (q.text || (q as any).question) && Array.isArray(q.options) && q.options.length >= 2);

  const handleStartTopicMCQ = async () => {
    if (isFetching) return;
    setIsFetching(true);

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
      <header className="px-4 pt-4 pb-4 bg-white/95 dark:bg-[#1F2330]/95 backdrop-blur-md border-b border-[#E8D9C0] dark:border-[#31374A] sticky top-0 z-40">
        <div className="flex items-center gap-3 max-w-3xl mx-auto w-full">
          <button
            onClick={onBack}
            className="w-9 h-9 rounded-xl bg-[#F7EFE2] dark:bg-[#252A3A] border border-[#E8D9C0] dark:border-[#31374A] flex items-center justify-center text-[#171923] dark:text-[#FFF9EF] active:scale-95 transition-all cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold text-[#800020] dark:text-[#C99A45] uppercase tracking-wider truncate">
              {getSubjectDisplayName(activeSubject)} · {getChapterDisplayName(activeChapter)}
            </p>
            <h2 className="text-sm font-extrabold text-[#171923] dark:text-[#FFF9EF] truncate font-hindi">
              {getTopicDisplayName(topic)}
            </h2>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 max-w-2xl mx-auto w-full pb-24">
        <div className="bg-white dark:bg-[#1F2330] border border-[#E8D9C0] dark:border-[#31374A] rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
          <div className="space-y-2">
            <span className="inline-block text-[10px] font-black uppercase tracking-wider text-[#800020] dark:text-[#C99A45]">
              Topic View & Overview
            </span>
            <h1 className="text-xl sm:text-2xl font-black text-[#171923] dark:text-[#FFF9EF] font-hindi leading-snug">
              {getTopicDisplayName(topic)}
            </h1>
            {getTopicSecondaryTitle(topic) && (
              <p className="text-xs text-slate-500 dark:text-slate-400 font-hindi">
                {getTopicSecondaryTitle(topic)}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 rounded-2xl bg-[#FFF9EF] dark:bg-[#252A3A] border border-[#E8D9C0] dark:border-[#31374A] flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-[#800020] text-[#FFF9EF] flex items-center justify-center shrink-0">
                <HelpCircle className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">Questions</p>
                <p className="text-base font-black text-[#171923] dark:text-[#FFF9EF] tabular-nums">{questionCount} MCQs</p>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-[#FFF9EF] dark:bg-[#252A3A] border border-[#E8D9C0] dark:border-[#31374A] flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-[#F47B20] text-white flex items-center justify-center shrink-0">
                <Award className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">Priority</p>
                <p className="text-base font-black text-[#171923] dark:text-[#FFF9EF]">High Yield</p>
              </div>
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-[#F7EFE2]/60 dark:bg-[#171923] border border-[#E8D9C0] dark:border-[#31374A] space-y-2">
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-[#800020] dark:text-[#C99A45]">
              <Sparkles className="w-4 h-4 text-[#F47B20]" />
              <span>Core Concepts & Objectives</span>
            </div>
            <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed font-hindi">
              {topic.introText || topic.seoDescription || `Master essential concepts, core definitions, and high-yield questions for ${topic.title || "this topic"}. Practice active recall and track your accuracy.`}
            </p>
          </div>

          <div className="pt-2">
            <button
              onClick={handleStartTopicMCQ}
              disabled={isFetching}
              className="w-full py-3 px-5 sm:px-6 rounded-xl bg-[#800020] hover:bg-[#5E0017] dark:bg-[#800020] dark:hover:bg-[#650019] text-white font-semibold text-sm border border-[#C99A45]/30 shadow-md shadow-[#800020]/15 flex items-center justify-center gap-2.5 transition-all duration-180 active:scale-95 cursor-pointer disabled:opacity-50 group"
            >
              {isFetching ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-[#C99A45]" />
                  <span>Preparing Practice Session...</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-white group-hover:scale-105 transition-transform" />
                  <span>Start Practice MCQs</span>
                  <ChevronRight className="w-4 h-4 text-[#C99A45] group-hover:translate-x-0.5 transition-transform" />
                </>
              )}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
};

export default TopicsTab;
