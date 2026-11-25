import React, { useState } from "react";
import { Chapter, MCQSession, Topic, Question } from "../types";
import { useQuestions } from "../context/QuestionsContext";
import { useProgress } from "../context/ProgressContext";
import { CHAPTERS_MAP } from "../data/questions";
import { isDueToday, getTodayDateString } from "../utils/revision";
import {
  ArrowLeft,
  Bookmark,
  Sparkles,
  ChevronRight,
  TrendingUp,
  AlertCircle,
  BookOpen,
  Sprout,
  CheckCircle2,
  Clock,
  Layers,
  Zap,
  Share2,
} from "lucide-react";
import { AddTopicModal } from "./AddTopicModal";
import ShareModal, { ShareData } from "./ShareModal";
import { buildChapterShareData } from "../utils/shareService";
import { showAppToast } from "../utils/adminToast";
import { TopicInteractionModal } from "./TopicInteractionModal";
import { getChapterDisplayName, getTopicDisplayName } from "../utils/curriculumUtils";
import { getCombinedSubjects } from "../utils/questionsStorage";

interface ChapterDetailViewProps {
  chapterId: string;
  chaptersMap?: Record<string, Chapter>;
  selectedTopicId?: string | null;
  onSelectTopic?: (topicId: string | null) => void;
  onBack: () => void;
  onStartSession: (session: MCQSession) => void;
  onAddTopic: (chapterId: string, newTopic: Topic) => void;
  onEditTopic: (topic: Topic) => void;
  onRemoveTopic: (topicId: string) => void;
  onAddQuestions: (chapterId: string, topicId?: string) => void;
  isAdmin?: boolean;
}

export const ChapterDetailView: React.FC<ChapterDetailViewProps> = ({
  chapterId,
  chaptersMap,
  selectedTopicId,
  onSelectTopic,
  onBack,
  onStartSession,
  onAddTopic,
  onEditTopic,
  onRemoveTopic,
  onAddQuestions,
  isAdmin = false,
}) => {
  const { progressStore } = useProgress();
  const { questionsStore } = useQuestions();
  const chapter = chaptersMap?.[chapterId] || CHAPTERS_MAP[chapterId];
  const [activeTab, setActiveTab] = useState<"topics" | "about">("topics");
  const [showAddTopicModal, setShowAddTopicModal] = useState(false);
  const [localTopicForModal, setLocalTopicForModal] = useState<Topic | null>(null);

  const selectedTopicForModal = React.useMemo(() => {
    if (selectedTopicId && chapter) {
      return (chapter.topics || []).find((t) => t.id === selectedTopicId) || null;
    }
    return localTopicForModal;
  }, [selectedTopicId, chapter, localTopicForModal]);

  if (!chapter) {
    return (
      <div className="p-6 text-center">
        <p className="text-sm text-slate-500">Chapter not found</p>
        <button
          onClick={onBack}
          className="mt-3 text-xs text-[#7045D8] dark:text-[#A78BFA] font-bold"
        >
          Go Back
        </button>
      </div>
    );
  }

  // Real question counts for the chapter
  const allChapterQuestions = (chapter.topics || []).flatMap((t) => (t && Array.isArray(t.questions)) ? t.questions : []).filter((q): q is Question => Boolean(q && q.id));
  
  // Real mastery calculation
  const correctInChapter = allChapterQuestions.filter(
    (q) => progressStore && q && q.id && progressStore[q.id]?.status === "correct"
  ).length;
  const mastery = allChapterQuestions.length > 0 
    ? Math.round((correctInChapter / allChapterQuestions.length) * 100) 
    : 0;

  const wrongInChapter = allChapterQuestions.filter(
    (q) => progressStore && q && q.id && progressStore[q.id]?.status === "wrong"
  ).length;

  const [shareModalConfig, setShareModalConfig] = useState<{ isOpen: boolean; data: ShareData }>({
    isOpen: false,
    data: { title: "", url: "" },
  });

  const handleShareChapter = () => {
    if (!chapter) return;
    setShareModalConfig({
      isOpen: true,
      data: buildChapterShareData(chapter),
    });
  };

  const handleStartTopic = async (topic: Topic) => {
    let extraQs: Question[] = [];

    if (Array.isArray(topic.questions) && topic.questions.length > 0) {
      extraQs = topic.questions;
    } else {
      try {
        const { getLocalMCQsByTopic } = await import("../utils/localDatabaseEngine");
        const local = await getLocalMCQsByTopic(topic.id);
        if (local && local.length > 0) {
          extraQs = local as any as Question[];
        }
      } catch (e) {
        console.error("Failed to fetch local MCQs for topic in chapter detail view", e);
      }
    }

    if (extraQs.length === 0) {
      try {
        const { fetchTopicQuestionsOnDemand } = await import("../utils/questionsStorage");
        const onDemand = await fetchTopicQuestionsOnDemand(topic.id);
        if (onDemand && onDemand.length > 0) {
          extraQs = onDemand;
        }
      } catch (e) {
        console.error("Failed to fetch on-demand questions for topic in chapter detail view", e);
      }
    }

    if (extraQs.length === 0) {
      try {
        const { fetchQuestionsByTopic } = await import("../utils/supabaseSyncService");
        const fromSb = await fetchQuestionsByTopic(topic.id);
        if (fromSb && fromSb.length > 0) {
          extraQs = fromSb;
        }
      } catch (e) {
        console.error("Failed to fetch Supabase questions for topic in chapter detail view", e);
      }
    }

    if (extraQs.length === 0) {
      extraQs = allChapterQuestions.filter((q) => q.topicId === topic.id);
    }

    if (extraQs.length === 0) {
      showAppToast(
        "Local content is currently unavailable. Connect to the internet during your sync cycle to download this topic.",
        "info",
        "Topic Content Unavailable"
      );
      return;
    }

    const questionIds = extraQs.map((q, qIdx) => q.id || `topic_${topic.id}_q_${qIdx}`);

    onStartSession({
      title: topic.title || topic.hindiTitle || "Topic Practice",
      subtitle: topic.hindiTitle || chapter.title || "Chapter",
      questionIds: questionIds,
      extraQuestions: extraQs,
      source: "topic",
      topicId: topic.id,
      chapterId: chapter.id,
    });
  };

  return (
    <div id="chapter-detail-screen" className="fixed inset-0 z-50 flex flex-col h-full bg-[#F8FAFC] dark:bg-[#130E26] text-slate-900 dark:text-slate-50 overflow-y-auto pb-24 select-none">
      {/* Header */}
      <div className="bg-white/95 dark:bg-[#1B1536]/95 backdrop-blur-md px-5 pt-4 pb-4 border-b border-slate-200 dark:border-[#31275E] sticky top-0 z-10 shadow-xs">
        <div className="flex items-center justify-between max-w-3xl mx-auto w-full">
          <button
            onClick={() => {
              if (selectedTopicForModal) {
                if (onSelectTopic) onSelectTopic(null);
                setLocalTopicForModal(null);
                return;
              }
              if (typeof onBack === "function") {
                onBack();
              } else if (typeof window !== "undefined" && window.history.length > 1) {
                window.history.back();
              }
            }}
            className="w-11 h-11 rounded-xl bg-slate-100 dark:bg-[#241D48] border border-slate-200 dark:border-[#31275E] flex items-center justify-center text-slate-900 dark:text-slate-50 active:scale-95 transition-transform cursor-pointer"
          >
            <ArrowLeft size={18} />
          </button>
          <div className="flex flex-col items-center min-w-0 px-2">
            <h1 className="text-sm font-bold text-slate-900 dark:text-slate-50 truncate max-w-[200px] sm:max-w-md font-hindi">
              {getChapterDisplayName(chapter)}
            </h1>
            <p className="text-[11px] font-bold text-[#7045D8] dark:text-[#A78BFA] uppercase tracking-widest mt-0.5 tabular-nums">
              Chapter {chapter.number}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleShareChapter}
              className="w-11 h-11 rounded-xl bg-[#7045D8]/10 dark:bg-[#7045D8]/15 border border-[#7045D8]/20 dark:border-[#A78BFA]/30 flex items-center justify-center text-[#7045D8] dark:text-[#A78BFA] hover:bg-[#7045D8]/15 active:scale-95 transition-transform cursor-pointer"
              title="Share Chapter"
              aria-label="Share chapter"
            >
              <Share2 size={18} />
            </button>
          </div>
        </div>
      </div>

      <main className="p-4 grid grid-cols-1 md:grid-cols-2 gap-2.5 max-w-3xl mx-auto w-full">
        {[...(chapter.topics || [])]
          .sort((a, b) => (a.number || 0) - (b.number || 0) || (a.title || "").localeCompare(b.title || ""))
          .map((topic, index) => {
            if (!topic) return null;
            const topicNum = index + 1;
            const qCount =
            Array.isArray(topic.questions) && topic.questions.length > 0
              ? topic.questions.length
              : typeof topic.questionCount === "number"
              ? topic.questionCount
              : 0;

          return (
            <div
              key={`${topic.id || 'topic'}-${index}`}
              onClick={() => {
                if (onSelectTopic && topic.id) {
                  onSelectTopic(topic.id);
                } else {
                  setLocalTopicForModal(topic);
                }
              }}
              className="w-full bg-white dark:bg-[#1B1536] border border-slate-200 dark:border-[#31275E] rounded-xl p-3.5 shadow-xs hover:border-[#7045D8]/50 dark:hover:border-[#A78BFA]/60 active:scale-[0.99] transition-all flex items-center justify-between group cursor-pointer min-h-[56px]"
            >
              <div className="flex items-center gap-3 min-w-0 flex-1 pr-3">
                <div className="w-9 h-9 rounded-xl bg-[#7045D8]/10 dark:bg-[#7045D8]/15 border border-[#7045D8]/20 dark:border-[#A78BFA]/30 flex items-center justify-center text-xs font-black text-[#7045D8] dark:text-[#A78BFA] shrink-0 font-mono tabular-nums">
                  {topicNum}
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="text-sm font-bold text-slate-900 dark:text-slate-50 group-hover:text-[#7045D8] dark:group-hover:text-[#7045D8] transition-colors truncate font-hindi">
                    {getTopicDisplayName(topic)}
                  </h4>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mt-0.5 tabular-nums">
                    {qCount} {qCount === 1 ? "Question" : "Questions"}
                  </p>
                </div>
              </div>

              <ChevronRight size={18} className="text-slate-400 group-hover:text-[#7045D8] dark:group-hover:text-[#7045D8] group-hover:translate-x-0.5 transition-all shrink-0" />
            </div>
          );
        })}
      </main>

      {/* Modals */}
      {selectedTopicForModal && (
        <TopicInteractionModal
          isOpen={Boolean(selectedTopicForModal)}
          topic={selectedTopicForModal}
          activeChapter={chapter}
          onClose={() => {
            if (onSelectTopic) {
              onSelectTopic(null);
            } else {
              setLocalTopicForModal(null);
            }
          }}
          onStartPractice={() => {
            const t = selectedTopicForModal;
            if (onSelectTopic) {
              onSelectTopic(null);
            } else {
              setLocalTopicForModal(null);
            }
            if (t) handleStartTopic(t);
          }}
        />
      )}
      {showAddTopicModal && (
        <AddTopicModal
          subjects={getCombinedSubjects(questionsStore)}
          chapters={Object.values(chaptersMap || {})}
          onClose={() => setShowAddTopicModal(false)}
          onAddTopic={(id, topic) => {
            onAddTopic(id, topic);
            setShowAddTopicModal(false);
          }}
          initialSubjectId={chapter.subjectId}
          initialChapterId={chapter.id}
        />
      )}

      {/* Share Modal */}
      <ShareModal
        isOpen={shareModalConfig.isOpen}
        onClose={() => setShareModalConfig((prev) => ({ ...prev, isOpen: false }))}
        data={shareModalConfig.data}
      />
    </div>
  );
};
