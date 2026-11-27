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
  Download,
  Share2,
  RefreshCw,
  CheckCircle2,
  ExternalLink,
  Edit3,
  Save,
  X,
  Plus,
  Zap,
  Target,
  Clock,
  Sparkle,
} from "lucide-react";
import ShareModal, { ShareData } from "./ShareModal";
import { buildTopicShareData } from "../utils/shareService";
import { sortSubjectsByTargetExam, isSubjectRecommendedForExam } from "../utils/examPersonalization";
import { loadUserProfile } from "../utils/userProfileStorage";
import { getSubjectQuestionsCount } from "../utils/questionsStorage";
import { triggerHaptic, playClickSound } from "../utils/audioFeedback";
import { showAppToast } from "../utils/adminToast";
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

    const chs = chapters.filter((c) => {
      const cSubNorm = (c.subjectId || "").toLowerCase().replace(/[-_]/g, "").trim();
      return cSubNorm === sNorm || (sSlugNorm && cSubNorm === sSlugNorm);
    });

    return [...chs].sort(
      (a, b) => (a.number || 0) - (b.number || 0) || (a.title || "").localeCompare(b.title || "")
    );
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
          // Robust hierarchical back: Return to topic list (chapter view)
          handleSelectTopic(null);
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
      <div className="flex flex-col h-full bg-[#F8FAFC] dark:bg-[#130E26]" id="topics-explorer">
        <header className="bg-white/95 dark:bg-[#130E26]/95 backdrop-blur-md border-b border-slate-200 dark:border-[#31275E] sticky top-0 md:top-14 z-30 pt-[env(safe-area-inset-top,0px)] md:pt-0">
          <div className="px-4 py-2.5 min-h-[60px] flex items-center gap-3 max-w-4xl mx-auto w-full">
            <button
              type="button"
              onClick={() => {
                // Return to chapter list (subject view)
                onSelectChapter(null);
              }}
              aria-label="Back to chapters"
              className="w-11 h-11 rounded-xl bg-slate-100 dark:bg-[#241D48] border border-slate-200 dark:border-[#31275E] flex items-center justify-center text-slate-900 dark:text-slate-50 active:scale-95 transition-all cursor-pointer shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7045D8]"
            >
              <ArrowLeft className="w-4.5 h-4.5" />
            </button>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-bold text-[#7045D8] dark:text-[#A78BFA] uppercase tracking-wider truncate">
                {activeSubject?.name || "Subject"} · Chapter {activeChapter.number || 1}
              </p>
              <h2 className="text-sm font-extrabold text-slate-900 dark:text-slate-50 truncate font-hindi">
                {getChapterDisplayName(activeChapter)}
              </h2>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto px-4 pt-4 pb-28 md:pb-8 max-w-4xl mx-auto w-full">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            {[...(activeChapter.topics || [])]
              .sort((a, b) => (a.number || 0) - (b.number || 0) || (a.title || "").localeCompare(b.title || ""))
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
      <div className="flex flex-col h-full bg-[#F8FAFC] dark:bg-[#130E26]" id="subject-chapters">
        <header className="bg-white/95 dark:bg-[#130E26]/95 backdrop-blur-md border-b border-slate-200 dark:border-[#31275E] sticky top-0 md:top-14 z-30 pt-[env(safe-area-inset-top,0px)] md:pt-0">
          <div className="px-4 py-2.5 min-h-[60px] flex items-center gap-3 max-w-4xl mx-auto w-full">
            <button
              type="button"
              onClick={() => {
                // Return to subject list (all subjects)
                onSelectSubject(null);
              }}
              aria-label="Back to subjects"
              className="w-11 h-11 rounded-xl bg-slate-100 dark:bg-[#241D48] border border-slate-200 dark:border-[#31275E] flex items-center justify-center text-slate-900 dark:text-slate-50 active:scale-95 transition-all cursor-pointer shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7045D8]"
            >
              <ArrowLeft className="w-4.5 h-4.5" />
            </button>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-bold text-[#7045D8] dark:text-[#A78BFA] uppercase tracking-wider truncate">
                Disha PYQ Syllabus
              </p>
              <h2 className="text-sm font-extrabold text-slate-900 dark:text-slate-50 truncate font-hindi">
                {getSubjectDisplayName(activeSubject)}
              </h2>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto px-4 pt-4 pb-28 md:pb-8 max-w-4xl mx-auto w-full">
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
                  type="button"
                  whileTap={{ scale: 0.99 }}
                  onClick={() => onSelectChapter(chapter.id)}
                  className="w-full min-h-[64px] bg-white dark:bg-[#1B1536] border border-slate-200 dark:border-[#31275E] rounded-xl p-3.5 flex items-center gap-3.5 group hover:border-[#7045D8]/60 dark:hover:border-[#A78BFA]/60 transition-all text-left shadow-xs cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7045D8]"
                >
                  <div className="w-9 h-9 rounded-xl bg-[#7045D8]/10 dark:bg-[#A78BFA]/15 border border-[#7045D8]/20 dark:border-[#A78BFA]/30 flex items-center justify-center text-xs font-black text-[#7045D8] dark:text-[#A78BFA] shrink-0 font-mono tabular-nums">
                    {chNum}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="text-sm font-bold text-slate-900 dark:text-slate-50 group-hover:text-[#7045D8] dark:group-hover:text-[#A78BFA] transition-colors font-hindi truncate">
                      {getChapterDisplayName(chapter)}
                    </h4>
                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mt-0.5 tabular-nums">
                      {(chapter.topics || []).length} Topics · {chQuestionCount} {chQuestionCount === 1 ? "Question" : "Questions"}
                    </p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-[#7045D8] dark:group-hover:text-[#A78BFA] group-hover:translate-x-0.5 transition-all shrink-0" />
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
    <div className="flex flex-col h-full bg-[#F8FAFC] dark:bg-[#130E26]" id="all-subjects">
      <header className="bg-white/95 dark:bg-[#130E26]/95 backdrop-blur-md border-b border-slate-200 dark:border-[#31275E] sticky top-0 md:top-14 z-30 select-none shadow-xs pt-[env(safe-area-inset-top,0px)] md:pt-0">
        <div className="max-w-4xl mx-auto w-full px-3.5 sm:px-4 py-2.5 space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => {
                // Priority: clear state/navigate tab via prop
                if (typeof onBack === "function") {
                  onBack();
                } else if (typeof window !== "undefined" && window.history.length > 1) {
                  window.history.back();
                }
              }}
              className="md:hidden w-11 h-11 rounded-xl bg-slate-100 dark:bg-[#241D48] border border-slate-200 dark:border-[#31275E] flex items-center justify-center text-slate-900 dark:text-slate-50 active:scale-95 transition-all cursor-pointer shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7045D8]"
              aria-label="Back"
            >
              <ArrowLeft className="w-4.5 h-4.5" />
            </button>
            <div className="flex-1 text-center md:text-left min-w-0 px-2 md:px-0">
              <h1 className="text-base font-extrabold text-slate-900 dark:text-slate-50 leading-none truncate">
                Curriculum &amp; Subjects
              </h1>
              <p className="text-[11px] font-semibold text-[#7045D8] dark:text-[#A78BFA] mt-1 truncate">
                Subject &amp; Chapter-wise Practice
              </p>
            </div>
            <button
              type="button"
              onClick={() => onOpenPDFExport?.()}
              className="w-11 h-11 rounded-xl bg-[#7045D8]/10 dark:bg-[#A78BFA]/15 border border-[#7045D8]/20 dark:border-[#A78BFA]/30 text-[#7045D8] dark:text-[#A78BFA] flex items-center justify-center active:scale-95 transition-all cursor-pointer shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7045D8]"
              title="Download PDF"
              aria-label="Export PDF"
            >
              <FileDown className="w-4.5 h-4.5" />
            </button>
          </div>
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search subjects or chapters..."
              className="w-full min-h-[44px] bg-slate-100/80 dark:bg-[#241D48] border border-slate-200 dark:border-[#31275E] rounded-xl py-2 pl-10 pr-3 text-xs sm:text-sm focus:ring-2 focus:ring-[#7045D8]/35 focus:outline-none transition-all placeholder:text-slate-400 text-slate-900 dark:text-slate-50"
            />
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto px-4 pt-5 pb-28 md:pb-8 max-w-4xl mx-auto w-full">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 sm:gap-3">
          {(() => {
            const q = (searchQuery || "").trim().toLowerCase();
            const activeUser = loadUserProfile();
            const targetExam = activeUser?.targetExam;
            const matchingSubjects = subjects
              .filter(s => {
                if (!s) return false;
                if (!q) return true;
                const matchName = (s.name || "").toLowerCase().includes(q);
                const matchHindi = (s.hindiName || "").toLowerCase().includes(q);
                return matchName || matchHindi;
              })
              .sort((a, b) => (a.order || 0) - (b.order || 0) || (a.name || "").localeCompare(b.name || ""));

            const filteredSubjects = sortSubjectsByTargetExam(matchingSubjects, targetExam);

            if (filteredSubjects.length === 0) {
              return (
                <div className="md:col-span-2 py-12 px-4 text-center space-y-3 bg-white dark:bg-[#1B1536] border border-slate-200 dark:border-[#31275E] rounded-3xl shadow-xs">
                  <div className="w-12 h-12 rounded-2xl bg-[#7045D8]/10 dark:bg-[#A78BFA]/15 text-[#7045D8] dark:text-[#A78BFA] flex items-center justify-center mx-auto shadow-xs">
                    <BookOpen className="w-6 h-6" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-sm font-black text-slate-900 dark:text-slate-50">
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
                  type="button"
                  whileTap={{ scale: 0.98 }}
                  onClick={() => onSelectSubject(subject.id)}
                  className="bg-white dark:bg-[#1B1536] border border-slate-200 dark:border-[#31275E] rounded-2xl py-3.5 px-4 flex items-center justify-between gap-3 sm:gap-4 group hover:border-[#7045D8]/60 dark:hover:border-[#A78BFA]/60 transition-all shadow-xs cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7045D8]"
                >
                  <div className="flex items-center gap-3 sm:gap-3.5 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-[#7045D8]/10 dark:bg-[#A78BFA]/15 border border-[#7045D8]/20 dark:border-[#A78BFA]/30 flex items-center justify-center text-[#7045D8] dark:text-[#A78BFA] font-mono font-black text-xs sm:text-sm shrink-0 tabular-nums">
                      {idx + 1}
                    </div>
                    <div className="text-left min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <h4 className="text-[14.5px] sm:text-base font-extrabold text-slate-900 dark:text-slate-50 truncate group-hover:text-[#7045D8] dark:group-hover:text-[#A78BFA] transition-colors leading-snug">
                          {getSubjectDisplayName(subject)}
                        </h4>
                        {isSubjectRecommendedForExam(subject.name || subject.hindiName || '', targetExam) && (
                          <span className="shrink-0 px-2 py-0.5 rounded-md bg-[#7045D8]/10 text-[#7045D8] dark:bg-[#A78BFA]/20 dark:text-[#A78BFA] text-[10px] font-black uppercase tracking-wider">
                            🎯 लक्ष्य
                          </span>
                        )}
                      </div>
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
                  <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-[#7045D8] dark:group-hover:text-[#A78BFA] group-hover:translate-x-0.5 transition-all shrink-0" />
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

function TopicListItem({
  topic,
  idx,
  onClickTopic,
}: TopicListItemProps) {
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
      className="w-full bg-white dark:bg-[#1B1536] border border-slate-200 dark:border-[#31275E] rounded-xl p-3 sm:p-3.5 flex items-center justify-between gap-3 group cursor-pointer select-none hover:border-[#7045D8]/50 dark:hover:border-[#A78BFA]/60 transition-all shadow-xs"
    >
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <div className="w-9 h-9 rounded-xl bg-[#7045D8]/10 dark:bg-[#7045D8]/15 border border-[#7045D8]/20 dark:border-[#A78BFA]/30 flex items-center justify-center text-xs font-black text-[#7045D8] dark:text-[#A78BFA] shrink-0 font-mono tabular-nums">
          {topicNum}
        </div>
        <div className="min-w-0 flex-1">
          <h4 className="text-sm font-bold text-slate-900 dark:text-slate-50 group-hover:text-[#7045D8] dark:group-hover:text-[#7045D8] transition-colors font-hindi truncate">
            {getTopicDisplayName(topic)}
          </h4>
          <div className="flex flex-wrap items-center gap-1.5 mt-1">
            {qCount > 0 ? (
              <span className="text-[11px] font-bold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-1.5 py-0.5 rounded">
                {qCount} Qs
              </span>
            ) : (
              <span className="text-[11px] text-slate-400">
                0 Qs
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-[#7045D8] dark:group-hover:text-[#7045D8] group-hover:translate-x-0.5 transition-all" />
      </div>
    </motion.div>
  );
}

interface TopicDetailViewProps {
  topic: Topic;
  activeChapter: Chapter;
  activeSubject: Subject | null;
  onBack: () => void;
  onStartSession: (session: MCQSession) => void;
}

function TopicDetailView({
  topic,
  activeChapter,
  activeSubject,
  onBack,
  onStartSession,
}: TopicDetailViewProps) {
  const [isFetching, setIsFetching] = React.useState(false);

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
        showAppToast("No questions available for this topic yet.", "info", "Topic Empty");
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
  const [isDownloaded, setIsDownloaded] = React.useState(false);
  const [isDownloading, setIsDownloading] = React.useState(false);

  React.useEffect(() => {
    let active = true;
    import("../utils/indexedDbCache").then(({ getCachedQuestionBundle }) => {
      getCachedQuestionBundle(topic.id).then((cached) => {
        if (active && cached && cached.length > 0) {
          setIsDownloaded(true);
        }
      }).catch(() => {});
    });
    return () => { active = false; };
  }, [topic.id]);

  const handleOfflineDownload = async () => {
    setIsDownloading(true);
    try {
      const { fetchTopicQuestionsOnDemand } = await import("../utils/questionsStorage");
      const { saveCachedQuestionBundle } = await import("../utils/indexedDbCache");
      const qs = await fetchTopicQuestionsOnDemand(topic.id);
      if (qs && qs.length > 0) {
        await saveCachedQuestionBundle(topic.id, qs);
        setIsDownloaded(true);
      }
    } catch (err) {
      console.warn("Offline download failed:", err);
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#F8FAFC] dark:bg-[#0F0A1E]" id="topic-detail-view">
      {/* Modern Sticky App Bar */}
      <header className="bg-white/95 dark:bg-[#130E26]/95 backdrop-blur-xl border-b border-slate-200/80 dark:border-white/10 sticky top-0 md:top-14 z-30 shadow-xs pt-[env(safe-area-inset-top,0px)] md:pt-0">
        <div className="px-4 py-3 min-h-[64px] flex items-center justify-between gap-3 max-w-4xl mx-auto w-full">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={onBack}
              className="w-10 h-10 rounded-2xl bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/15 border border-slate-200/60 dark:border-white/10 flex items-center justify-center text-slate-800 dark:text-slate-100 active:scale-95 transition-all cursor-pointer shrink-0 shadow-xs"
              title="Go Back"
              aria-label="Go Back"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="min-w-0">
              <p className="text-[11px] font-black tracking-wider uppercase text-purple-600 dark:text-purple-400 truncate flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-purple-500 inline-block animate-pulse" />
                {getSubjectDisplayName(activeSubject)} · {getChapterDisplayName(activeChapter)}
              </p>
              <h2 className="text-base font-black text-slate-900 dark:text-white truncate">
                {getTopicDisplayName(topic)}
              </h2>
            </div>
          </div>
        </div>
      </header>

      {/* Main MCQ Practice & Test Series Canvas */}
      <main className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 max-w-4xl mx-auto w-full pb-36 md:pb-16">
        {/* TOPIC BANNER - Professional Test Series Aesthetic */}
        <div className="relative overflow-hidden rounded-3xl p-5 sm:p-7 bg-gradient-to-br from-[#7045D8] via-[#5B32BF] to-[#3B1F8E] text-white shadow-xl shadow-purple-600/20 border border-white/15">
          <div className="absolute -top-12 -right-12 w-48 h-48 bg-white/10 rounded-full blur-2xl pointer-events-none" />
          <div className="absolute -bottom-10 -left-10 w-44 h-44 bg-amber-400/20 rounded-full blur-2xl pointer-events-none" />

          {/* Badges Row */}
          <div className="relative z-10 flex flex-wrap items-center justify-between gap-2.5 mb-3.5">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-extrabold uppercase tracking-wider bg-white/20 backdrop-blur-md text-white border border-white/20 shadow-xs">
                <Sparkle className="w-3.5 h-3.5 text-amber-300 fill-amber-300" />
                Test Series Module
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-400/20 border border-amber-300/30 text-amber-200">
                <Zap className="w-3 h-3 text-amber-300" />
                High Yield PYQs
              </span>
            </div>

            <button
              type="button"
              onClick={handleOfflineDownload}
              disabled={isDownloading || isDownloaded}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 backdrop-blur-md transition-all active:scale-95 shadow-xs border ${
                isDownloaded
                  ? "bg-emerald-500/20 text-emerald-200 border-emerald-400/40"
                  : "bg-white/15 hover:bg-white/25 text-white border-white/25 cursor-pointer"
              }`}
            >
              {isDownloaded ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300" />
                  <span>Offline Ready</span>
                </>
              ) : isDownloading ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Downloading...</span>
                </>
              ) : (
                <>
                  <Download className="w-3.5 h-3.5 text-white" />
                  <span>Save Offline</span>
                </>
              )}
            </button>
          </div>

          {/* Title Area */}
          <div className="relative z-10">
            <h1 className="text-xl sm:text-3xl font-black text-white leading-tight tracking-tight drop-shadow-xs">
              {getTopicDisplayName(topic)}
            </h1>
            {getTopicSecondaryTitle(topic) && (
              <p className="text-xs sm:text-sm text-purple-100/90 mt-1">
                {getTopicSecondaryTitle(topic)}
              </p>
            )}
            <p className="text-xs sm:text-sm text-purple-200/90 mt-2 font-medium">
              Previous year exam questions (PYQs) and mock questions for RPSC and RSMSSB exams.
            </p>
          </div>
        </div>

        {/* MCQ PRACTICE & TEST SIMULATION CARD */}
        <div className="bg-white dark:bg-[#1B1536] border border-slate-200/80 dark:border-white/10 rounded-3xl p-5 sm:p-6 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-purple-50 dark:bg-purple-950/60 border border-purple-200 dark:border-purple-800 flex items-center justify-center text-[#7045D8] dark:text-[#A78BFA] shadow-xs">
                <Target className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-extrabold text-slate-900 dark:text-white">
                  Exam Practice &amp; Test Simulation
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Real Exam Simulation with Instant Analytics &amp; Explanations
                </p>
              </div>
            </div>
            <span className="hidden sm:inline-block text-xs font-bold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50 px-3 py-1 rounded-full">
              OMR 5th Option
            </span>
          </div>

          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed mb-4">
            This test session contains <strong>{questionCount}</strong> high-yield standard questions designed to test your accuracy and exam readiness.
          </p>

          {/* Compact Premium Specs Grid */}
          <div className="grid grid-cols-2 gap-2.5 mb-4">
            <div className="py-2.5 px-3 rounded-xl bg-slate-50/90 dark:bg-white/5 border border-slate-200/60 dark:border-white/10 flex items-center gap-2.5 backdrop-blur-sm">
              <div className="w-8 h-8 rounded-lg bg-purple-500/10 dark:bg-purple-400/15 text-[#7045D8] dark:text-[#A78BFA] flex items-center justify-center shrink-0">
                <HelpCircle className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-400 truncate">Total Questions</p>
                <p className="text-sm font-black text-slate-900 dark:text-white tabular-nums">{questionCount} MCQs</p>
              </div>
            </div>

            <div className="py-2.5 px-3 rounded-xl bg-slate-50/90 dark:bg-white/5 border border-slate-200/60 dark:border-white/10 flex items-center gap-2.5 backdrop-blur-sm">
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 dark:bg-amber-400/15 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                <Award className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-400 truncate">Marking Rule</p>
                <p className="text-sm font-black text-slate-900 dark:text-white truncate">1/3 Penalty / 5th OMR</p>
              </div>
            </div>
          </div>

          {/* Primary Full Width Start Button */}
          <button
            onClick={handleStartTopicMCQ}
            disabled={isFetching}
            className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-[#7045D8] to-[#5B32BF] hover:from-[#6339CA] hover:to-[#4F29AC] text-white font-extrabold text-base shadow-lg shadow-purple-600/30 hover:shadow-purple-600/40 border border-white/20 flex items-center justify-center gap-3 transition-all duration-150 active:scale-[0.98] cursor-pointer disabled:opacity-50"
          >
            {isFetching ? (
              <>
                <RefreshCw className="w-5 h-5 animate-spin text-amber-300" />
                <span>Loading Test Session...</span>
              </>
            ) : (
              <>
                <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center">
                  <Play className="w-4 h-4 fill-white text-white translate-x-0.5" />
                </div>
                <span>Start Practice Test ({questionCount} Qs)</span>
                <ChevronRight className="w-5 h-5 text-amber-300" />
              </>
            )}
          </button>
        </div>

        {/* KEY CONCEPTS & SUMMARY CARD */}
        {(topic.introText || topic.seoDescription) && (
          <div className="bg-white dark:bg-[#1B1536] border border-slate-200/80 dark:border-white/10 rounded-3xl p-5 shadow-xs space-y-2.5">
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-purple-600 dark:text-purple-400">
              <Sparkles className="w-4 h-4 text-purple-600 dark:text-purple-400" />
              <span>Key Concepts &amp; Exam Pointers</span>
            </div>
            <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed font-hindi">
              {topic.introText || topic.seoDescription}
            </p>
          </div>
        )}
      </main>
    </div>
  );
}

export default TopicsTab;
