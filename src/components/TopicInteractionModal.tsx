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
        if (isMounted) {
          setQuestionCount(mcqs ? mcqs.length : 0);
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
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#171923]/70 backdrop-blur-sm animate-in fade-in">
        <motion.div
          initial={{ scale: 0.95, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 20 }}
          className="w-full max-w-lg bg-[#FFF9EF] dark:bg-[#1F2330] border border-[#E8D9C0] dark:border-[#31374A] rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        >
          {/* Header */}
          <div className="relative p-6 sm:p-7 bg-[#800020] text-[#FFF9EF]">
            <div className="flex items-center justify-between mb-3.5 relative z-10">
              <span className="text-[10px] font-black uppercase tracking-wider text-[#C99A45]">
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
                <p className="text-xs text-[#FFF9EF]/80 font-medium font-hindi">
                  {topic.hindiTitle}
                </p>
              )}
            </div>
          </div>

          {/* Body Content */}
          <div className="p-6 sm:p-7 space-y-5 overflow-y-auto flex-1">
            {/* Stats Overview */}
            <div className="grid grid-cols-2 gap-3.5">
              <div className="p-4 rounded-2xl bg-white dark:bg-[#252A3A] border border-[#E8D9C0] dark:border-[#31374A] flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-[#800020] text-[#FFF9EF] flex items-center justify-center shrink-0">
                  <HelpCircle className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">Available</p>
                  <p className="text-base font-black text-[#171923] dark:text-[#FFF9EF] tabular-nums">{questionCount} MCQs</p>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-white dark:bg-[#252A3A] border border-[#E8D9C0] dark:border-[#31374A] flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-[#F47B20] text-white flex items-center justify-center shrink-0">
                  <Award className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">Weightage</p>
                  <p className="text-base font-black text-[#171923] dark:text-[#FFF9EF]">High Yield</p>
                </div>
              </div>
            </div>

            {/* Quick Notes / Summary Section */}
            <div className="p-5 rounded-2xl bg-[#F7EFE2]/70 dark:bg-[#171923] border border-[#E8D9C0] dark:border-[#31374A] space-y-2.5">
              <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-[#800020] dark:text-[#C99A45]">
                <Sparkles className="w-4 h-4 text-[#F47B20]" />
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
                className="w-full py-3 px-5 sm:px-6 rounded-xl bg-[#800020] hover:bg-[#5E0017] dark:bg-[#800020] dark:hover:bg-[#650019] text-white font-semibold text-sm border border-[#C99A45]/30 shadow-md shadow-[#800020]/15 flex items-center justify-center gap-2.5 transition-all duration-180 active:scale-95 cursor-pointer group"
              >
                <Play className="w-4 h-4 fill-white group-hover:scale-105 transition-transform" />
                <span>Start Practice MCQs</span>
                <ArrowRight className="w-4 h-4 text-[#C99A45] group-hover:translate-x-0.5 transition-transform" />
              </button>

              <button
                onClick={onClose}
                className="w-full py-2.5 px-5 rounded-xl bg-[#F7EFE2] dark:bg-[#252A3A] hover:bg-[#E8D9C0]/60 dark:hover:bg-[#31374A] text-[#171923] dark:text-[#FFF9EF] font-semibold text-xs border border-[#E8D9C0] dark:border-[#31374A] transition-all duration-180 active:scale-95 cursor-pointer"
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
