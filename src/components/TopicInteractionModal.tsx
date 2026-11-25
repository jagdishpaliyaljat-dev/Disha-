import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  X, Sparkles, BookOpen, Play, CheckCircle2, Award, FileText, 
  Layers, ChevronRight, HelpCircle, Flame, ArrowRight 
} from "lucide-react";
import { Topic, Chapter, Question } from "../types";
import { getLocalMCQsByTopic } from "../utils/localDatabaseEngine";

interface TopicInteractionModalProps {
  isOpen: boolean;
  topic: Topic | null;
  activeChapter: Chapter | null;
  onClose: () => void;
  onStartPractice: () => void;
}

export const TopicInteractionModal: React.FC<TopicInteractionModalProps> = ({
  isOpen,
  topic,
  activeChapter,
  onClose,
  onStartPractice,
}) => {
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [questionCount, setQuestionCount] = useState<number>(0);

  useEffect(() => {
    let isMounted = true;
    async function checkCount() {
      if (!topic) return;
      if (Array.isArray(topic.questions) && topic.questions.length > 0) {
        if (isMounted) setQuestionCount(topic.questions.length);
        return;
      }
      try {
        const mcqs = await getLocalMCQsByTopic(topic.id);
        if (mcqs && mcqs.length > 0) {
          if (isMounted) setQuestionCount(mcqs.length);
          return;
        }
        const { fetchTopicQuestionsOnDemand } = await import("../utils/questionsStorage");
        const onDemand = await fetchTopicQuestionsOnDemand(topic.id);
        if (isMounted) {
          setQuestionCount(onDemand ? onDemand.length : 0);
        }
      } catch {
        if (isMounted) setQuestionCount(0);
      }
    }
    if (isOpen && topic) {
      checkCount();
    }
    return () => {
      isMounted = false;
    };
  }, [isOpen, topic]);

  if (!isOpen || !topic) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#130E26]/70 backdrop-blur-sm animate-in fade-in">
        <motion.div
          initial={{ scale: 0.95, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 20 }}
          className="w-full max-w-lg bg-[#F8FAFC] dark:bg-[#1B1536] border border-slate-200 dark:border-[#31275E] rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        >
          {/* Header */}
          <div className="relative p-6 sm:p-7 bg-[#7045D8] text-white">
            <div className="flex items-center justify-between mb-3.5 relative z-10">
              <span className="text-[11px] font-black uppercase tracking-wider text-amber-500">
                {activeChapter?.title || "Topic Interaction"}
              </span>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center text-white transition-all cursor-pointer active:scale-95"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-1.5 relative z-10">
              <h2 className="text-xl sm:text-2xl font-black tracking-tight font-hindi leading-snug">
                {topic.title || topic.hindiTitle}
              </h2>
              {topic.hindiTitle && topic.title && topic.hindiTitle !== topic.title && (
                <p className="text-xs text-white/80 font-medium font-hindi">
                  {topic.hindiTitle}
                </p>
              )}
            </div>
          </div>

          {/* Body Content */}
          <div className="p-6 sm:p-7 space-y-5 overflow-y-auto flex-1">
            {/* Stats Overview */}
            <div className="grid grid-cols-2 gap-3.5">
              <div className="p-4 rounded-2xl bg-white dark:bg-[#241D48] border border-slate-200 dark:border-[#31275E] flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-[#7045D8] text-white flex items-center justify-center shrink-0">
                  <HelpCircle className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">Available</p>
                  <p className="text-base font-black text-slate-900 dark:text-slate-50 tabular-nums">{questionCount} MCQs</p>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-white dark:bg-[#241D48] border border-slate-200 dark:border-[#31275E] flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-[#7045D8] text-white flex items-center justify-center shrink-0">
                  <Award className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">Weightage</p>
                  <p className="text-base font-black text-slate-900 dark:text-slate-50">High Yield</p>
                </div>
              </div>
            </div>

            {/* Quick Notes / Summary Section */}
            <div className="p-5 rounded-2xl bg-slate-100/70 dark:bg-[#130E26] border border-slate-200 dark:border-[#31275E] space-y-2.5">
              <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-[#7045D8] dark:text-[#A78BFA]">
                <Sparkles className="w-4 h-4 text-[#7045D8]" />
                <span>Topic Overview & Key Objectives</span>
              </div>
              <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed font-hindi">
                {topic.introText || topic.seoDescription || `Master all core concepts, important previous year questions, and high-yield facts for ${topic.title || "this topic"}. Practice active recall and test your preparation level.`}
              </p>
            </div>

            {/* Action Buttons */}
            <div className="space-y-2.5 pt-1">
              <button
                onClick={() => {
                  onClose();
                  onStartPractice();
                }}
                className="w-full py-3 px-5 sm:px-6 rounded-xl bg-[#7045D8] hover:bg-[#5B32BF] dark:bg-[#7045D8] dark:hover:bg-[#5B32BF] text-white font-semibold text-sm border border-[#A78BFA]/30 shadow-md shadow-[#7045D8]/15 flex items-center justify-center gap-2.5 transition-all duration-180 active:scale-95 cursor-pointer group"
              >
                <Play className="w-4 h-4 fill-white group-hover:scale-105 transition-transform" />
                <span>Start Practice MCQs</span>
                <ArrowRight className="w-4 h-4 text-amber-500 group-hover:translate-x-0.5 transition-transform" />
              </button>

              <button
                onClick={onClose}
                className="w-full py-2.5 px-5 rounded-xl bg-slate-100 dark:bg-[#241D48] hover:bg-slate-200/60 dark:hover:bg-[#31275E] text-slate-900 dark:text-slate-50 font-semibold text-xs border border-slate-200 dark:border-[#31275E] transition-all duration-180 active:scale-95 cursor-pointer"
              >
                Back to Chapters
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
