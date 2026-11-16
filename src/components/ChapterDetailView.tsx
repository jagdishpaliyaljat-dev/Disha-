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
import { TopicInteractionModal } from "./TopicInteractionModal";
import { getChapterDisplayName, getTopicDisplayName } from "../utils/curriculumUtils";

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
          className="mt-3 text-xs text-[#800020] dark:text-[#F47B20] font-bold"
        >
          Go Back
        </button>
      </div>
    );
  }

  // Real question counts for the chapter
  const allChapterQuestions = (chapter.topics || []).flatMap((t) => t.questions || []);
  
  // Real mastery calculation
  const correctInChapter = allChapterQuestions.filter(
    (q) => progressStore[q.id]?.status === "correct"
  ).length;
  const mastery = allChapterQuestions.length > 0 
    ? Math.round((correctInChapter / allChapterQuestions.length) * 100) 
    : 0;

  const wrongInChapter = allChapterQuestions.filter(
    (q) => progressStore[q.id]?.status === "wrong"
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
      alert("Local content is currently unavailable. Please connect to the internet during your next 24-hour sync cycle to download this topic's questions.");
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
    <div id="chapter-detail-screen" className="fixed inset-0 z-50 flex flex-col h-full bg-[#FFF9EF] dark:bg-[#171923] text-[#171923] dark:text-[#FFF9EF] overflow-y-auto pb-24 select-none">
      {/* Header */}
      <div className="bg-white/95 dark:bg-[#1F2330]/95 backdrop-blur-md px-5 pt-4 pb-4 border-b border-[#E8D9C0] dark:border-[#31374A] sticky top-0 z-10 shadow-xs">
        <div className="flex items-center justify-between max-w-3xl mx-auto w-full">
          <button
            onClick={() => {
              // Priority: clear local state to return to subject view
              if (typeof onBack === "function") {
                onBack();
              } else if (typeof window !== "undefined" && window.history.length > 1) {
                window.history.back();
              }
            }}
            className="w-10 h-10 rounded-xl bg-[#F7EFE2] dark:bg-[#252A3A] border border-[#E8D9C0] dark:border-[#31374A] flex items-center justify-center text-[#171923] dark:text-[#FFF9EF] active:scale-95 transition-transform cursor-pointer"
          >
            <ArrowLeft size={18} />
          </button>
          <div className="flex flex-col items-center min-w-0 px-2">
            <h1 className="text-sm font-bold text-[#171923] dark:text-[#FFF9EF] truncate max-w-[200px] sm:max-w-md font-hindi">
              {getChapterDisplayName(chapter)}
            </h1>
            <p className="text-[10px] font-bold text-[#800020] dark:text-[#C99A45] uppercase tracking-widest mt-0.5 tabular-nums">
              Chapter {chapter.number}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleShareChapter}
              className="w-10 h-10 rounded-xl bg-[#800020]/10 dark:bg-[#F47B20]/15 border border-[#800020]/20 dark:border-[#F47B20]/30 flex items-center justify-center text-[#800020] dark:text-[#F47B20] hover:bg-[#800020]/15 active:scale-95 transition-transform cursor-pointer"
              title="Share Chapter"
              aria-label="Share chapter"
            >
              <Share2 size={18} />
            </button>
          </div>
        </div>
      </div>

      <main className="p-4 grid grid-cols-1 md:grid-cols-2 gap-2.5 max-w-3xl mx-auto w-full">
        {(chapter.topics || []).map((topic, index) => {
          const topicNum = index + 1;
          const qCount =
            topic.questions && topic.questions.length > 0
              ? topic.questions.length
              : topic.questionCount || 0;

          return (
            <div
              key={`${topic.id}-${index}`}
              onClick={() => {
                if (onSelectTopic) {
                  onSelectTopic(topic.id);
                } else {
                  setLocalTopicForModal(topic);
                }
              }}
              className="w-full bg-white dark:bg-[#1F2330] border border-[#E8D9C0] dark:border-[#31374A] rounded-xl p-3.5 shadow-xs hover:border-[#800020]/50 dark:hover:border-[#F47B20]/60 active:scale-[0.99] transition-all flex items-center justify-between group cursor-pointer"
            >
              <div className="flex items-center gap-3 min-w-0 flex-1 pr-3">
                <div className="w-9 h-9 rounded-xl bg-[#800020]/10 dark:bg-[#F47B20]/15 border border-[#800020]/20 dark:border-[#F47B20]/30 flex items-center justify-center text-xs font-black text-[#800020] dark:text-[#F47B20] shrink-0 font-mono tabular-nums">
                  {topicNum}
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="text-sm font-bold text-[#171923] dark:text-[#FFF9EF] group-hover:text-[#800020] dark:group-hover:text-[#F47B20] transition-colors truncate font-hindi">
                    {getTopicDisplayName(topic)}
                  </h4>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mt-0.5 tabular-nums">
                    {qCount} {qCount === 1 ? "Question" : "Questions"}
                  </p>
                </div>
              </div>
              <ChevronRight size={18} className="text-slate-400 group-hover:text-[#800020] dark:group-hover:text-[#F47B20] group-hover:translate-x-0.5 transition-all shrink-0" />
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
          chapters={Object.values(chaptersMap || {})}
          onClose={() => setShowAddTopicModal(false)}
          onAddTopic={(id, topic) => {
            onAddTopic(id, topic);
            setShowAddTopicModal(false);
          }}
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
