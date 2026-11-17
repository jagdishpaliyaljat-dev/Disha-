import React, { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ProgressStore, MCQSession, Chapter, Question } from "../types";
import { CHAPTERS_DATA, ALL_QUESTIONS } from "../data/questions";
import { getTodayDateString, sortQuestionsForRevision } from "../utils/revision";
import { getAllCachedBundles } from "../utils/indexedDbCache";
import { getAllCachedQuestions } from "../utils/questionBankCache";
import { triggerHaptic, playClickSound } from "../utils/audioFeedback";
import { useProgress } from "../context/ProgressContext";
import {
  Clock,
  ChevronRight,
  Play,
  Bookmark,
  Calendar,
  X,
  Sparkles,
  XCircle,
  Eye,
  EyeOff,
  CheckCircle2,
  BookOpen,
} from "lucide-react";

interface WrongTabProps {
  progressStore: ProgressStore;
  chapters?: Chapter[];
  questions?: Question[];
  onSelectWrongChapter: (chapterId: string) => void;
  onStartSession: (session: MCQSession) => void;
  onToggleBookmark?: (questionId: string) => void;
  onOpenPDFExport?: (config?: {
    chapterId?: string | null;
    filterType?: "all" | "wrong" | "bookmarked";
  }) => void;
}

export const WrongTab: React.FC<WrongTabProps> = ({
  progressStore,
  chapters = CHAPTERS_DATA,
  questions = ALL_QUESTIONS,
  onStartSession,
  onToggleBookmark,
}) => {
  const { toggleBookmark: contextToggleBookmark } = useProgress();
  const [activeFilter, setActiveFilter] = useState<"bookmarked" | "mistakes" | "by-chapter">("bookmarked");
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [revealedIds, setRevealedIds] = useState<Record<string, boolean>>({});
  const [hydratedQuestions, setHydratedQuestions] = useState<Question[]>([]);
  const todayStr = getTodayDateString();

  // Hydrate questions from IndexedDB bundles & questionBankCache, and fetch any still-missing bookmarked/wrong IDs from Supabase database
  useEffect(() => {
    let isMounted = true;

    async function hydrateMissingQuestions() {
      try {
        const [bundles, bankQs] = await Promise.all([
          getAllCachedBundles().catch(() => []),
          getAllCachedQuestions().catch(() => []),
        ]);

        const map = new Map<string, Question>();
        (questions || []).forEach((q) => {
          if (q && q.id) map.set(q.id, q);
        });
        (chapters || []).forEach((ch) => {
          (ch.topics || []).forEach((t) => {
            (t.questions || []).forEach((q) => {
              if (q && q.id) {
                map.set(q.id, {
                  ...q,
                  topicId: q.topicId || t.id,
                  chapterId: q.chapterId || ch.id,
                });
              }
            });
          });
        });
        (bankQs || []).forEach((q) => {
          if (q && q.id && !map.has(q.id)) map.set(q.id, q);
        });
        (bundles || []).forEach((b) => {
          const rawTopicId = String(
            b?.topicId?.startsWith("topic_") ? b.topicId.slice(6) : b?.topicId || ""
          ).trim();
          (b?.questions || []).forEach((q) => {
            if (q && q.id && !map.has(q.id)) {
              map.set(q.id, rawTopicId && !q.topicId ? { ...q, topicId: rawTopicId } : q);
            }
          });
        });

        // Check if any bookmarked or wrong question IDs in progressStore are still missing
        const targetIds = Object.entries(progressStore || {})
          .filter(([, p]) => p && (p.bookmarked || p.status === "wrong"))
          .map(([qId]) => qId);

        const missingIds = targetIds.filter((qId) => !map.has(qId));

        if (missingIds.length > 0) {
          const { getLocalMCQById } = await import("../utils/localDatabaseEngine");
          const localDocs = await Promise.all(
            missingIds.map(async (qId) => {
              try {
                return await getLocalMCQById(qId);
              } catch {
                return null;
              }
            })
          );
          localDocs.forEach((q) => {
            if (q && q.id) map.set(q.id, q);
          });

          // Fallback to Supabase for any remaining missing IDs
          const stillMissing = missingIds.filter((qId) => !map.has(qId));
          if (stillMissing.length > 0) {
            try {
              const { supabase, isSupabaseConfigured } = await import("../lib/supabase");
              if (isSupabaseConfigured()) {
                const { data } = await supabase.from("questions").select("id,question,options,correct_answer,explanation,subject_id,chapter_id,topic_id,exam,year,level").in("id", stillMissing);
                if (data && data.length > 0) {
                  data.forEach((q) => {
                    map.set(q.id, {
                      id: q.id,
                      text: q.question,
                      options: Array.isArray(q.options) ? q.options : [],
                      correctIndex: q.correct_answer ?? 0,
                      explanation: q.explanation || "",
                      subjectId: q.subject_id,
                      chapterId: q.chapter_id,
                      topicId: q.topic_id,
                      exam: q.exam,
                      year: q.year,
                      difficulty: q.level || "medium",
                      isUserAdded: false,
                    });
                  });
                }
              }
            } catch {}
          }
        }

        if (isMounted) {
          setHydratedQuestions(Array.from(map.values()));
        }
      } catch {}
    }

    hydrateMissingQuestions();
    return () => {
      isMounted = false;
    };
  }, [questions, chapters, progressStore]);

  // Unified map of all known questions
  const allQuestionsMap = useMemo(() => {
    const map = new Map<string, Question>();
    (questions || []).forEach((q) => {
      if (q && q.id) map.set(q.id, q);
    });
    (chapters || []).forEach((ch) => {
      (ch.topics || []).forEach((t) => {
        (t.questions || []).forEach((q) => {
          if (q && q.id) {
            map.set(q.id, {
              ...q,
              topicId: q.topicId || t.id,
              chapterId: q.chapterId || ch.id,
            });
          }
        });
      });
    });
    (hydratedQuestions || []).forEach((q) => {
      if (q && q.id && !map.has(q.id)) {
        map.set(q.id, q);
      }
    });
    return map;
  }, [questions, chapters, hydratedQuestions]);

  // TopicId -> Chapter lookup for displaying chapter titles on question cards
  const chapterLookup = useMemo(() => {
    const byChapterId = new Map<string, Chapter>();
    const byTopicId = new Map<string, Chapter>();
    (chapters || []).forEach((ch) => {
      byChapterId.set(ch.id, ch);
      (ch.topics || []).forEach((t) => {
        byTopicId.set(t.id, ch);
      });
    });
    return { byChapterId, byTopicId };
  }, [chapters]);

  const getQuestionChapter = (q: Question): Chapter | undefined => {
    if (q.chapterId && chapterLookup.byChapterId.has(q.chapterId)) {
      return chapterLookup.byChapterId.get(q.chapterId);
    }
    if (q.topicId && chapterLookup.byTopicId.has(q.topicId)) {
      return chapterLookup.byTopicId.get(q.topicId);
    }
    return undefined;
  };

  // All real wrong questions
  const wrongQuestions = useMemo(() => {
    const list: Question[] = [];
    allQuestionsMap.forEach((q) => {
      if (progressStore[q.id]?.status === "wrong") {
        list.push(q);
      }
    });
    return list;
  }, [allQuestionsMap, progressStore]);

  // All real bookmarked questions
  const bookmarkedQuestions = useMemo(() => {
    const list: Question[] = [];
    allQuestionsMap.forEach((q) => {
      if (progressStore[q.id]?.bookmarked) {
        list.push(q);
      }
    });
    return list;
  }, [allQuestionsMap, progressStore]);

  const totalWrongCount = wrongQuestions.length;
  const totalBookmarkedCount = bookmarkedQuestions.length;

  // Chapter-wise breakdown (grouping both from ch.topics and from allQuestionsMap via chapterId/topicId)
  const chaptersBreakdown = useMemo(() => {
    return (chapters || [])
      .map((ch) => {
        const topicIds = new Set((ch.topics || []).map((t) => t.id));
        const chQsMap = new Map<string, Question>();

        (ch.topics || []).forEach((t) => {
          (t.questions || []).forEach((q) => {
            if (q && q.id) chQsMap.set(q.id, q);
          });
        });

        allQuestionsMap.forEach((q) => {
          if (q.chapterId === ch.id || (q.topicId && topicIds.has(q.topicId))) {
            chQsMap.set(q.id, q);
          }
        });

        const chQuestions = Array.from(chQsMap.values());
        const wrongQs = chQuestions.filter((q) => progressStore[q.id]?.status === "wrong");
        const bookmarkedQs = chQuestions.filter((q) => progressStore[q.id]?.bookmarked);

        return {
          chapter: ch,
          wrongQs,
          bookmarkedQs,
          wrongCount: wrongQs.length,
          bookmarkedCount: bookmarkedQs.length,
        };
      })
      .filter((item) => {
        if (activeFilter === "bookmarked") return item.bookmarkedCount > 0;
        if (activeFilter === "mistakes") return item.wrongCount > 0;
        return item.wrongCount > 0 || item.bookmarkedCount > 0;
      });
  }, [chapters, allQuestionsMap, activeFilter, progressStore]);

  const handleBookmarkClick = (questionId: string) => {
    triggerHaptic("light");
    if (onToggleBookmark) {
      onToggleBookmark(questionId);
    } else {
      contextToggleBookmark(questionId);
    }
  };

  const toggleRevealAnswer = (questionId: string) => {
    triggerHaptic("light");
    setRevealedIds((prev) => ({ ...prev, [questionId]: !prev[questionId] }));
  };

  // Start practice of all wrong questions
  const handleStartAllMistakesPractice = () => {
    if (wrongQuestions.length === 0) return;
    triggerHaptic("light");
    playClickSound();

    const idsToPractice = wrongQuestions.map((q) => q.id);
    const sorted = sortQuestionsForRevision(idsToPractice, progressStore, todayStr);

    onStartSession({
      title: "Mistake Bank Revision",
      subtitle: `${sorted.length} Questions to Master`,
      questionIds: sorted,
      extraQuestions: wrongQuestions,
      source: "all-wrong",
    });
  };

  // Start practice of all bookmarked questions
  const handleStartAllBookmarksPractice = (startFromQuestionId?: string) => {
    if (bookmarkedQuestions.length === 0) return;
    triggerHaptic("light");
    playClickSound();

    let ordered = [...bookmarkedQuestions];
    if (startFromQuestionId) {
      const idx = ordered.findIndex((q) => q.id === startFromQuestionId);
      if (idx > 0) {
        ordered = [...ordered.slice(idx), ...ordered.slice(0, idx)];
      }
    }

    onStartSession({
      title: "Bookmarked Questions Revision",
      subtitle: `${ordered.length} Saved Questions`,
      questionIds: ordered.map((q) => q.id),
      extraQuestions: ordered,
      source: "all-wrong",
    });
  };

  // Start practice for a specific chapter
  const handleStartChapterRevision = (
    chapter: Chapter,
    wrongQs: Question[],
    bookmarkedQs: Question[],
    mode: "wrong" | "bookmarked"
  ) => {
    const targetQs = mode === "bookmarked" ? bookmarkedQs : wrongQs;
    if (targetQs.length === 0) return;

    triggerHaptic("light");
    playClickSound();

    const sortedIds = sortQuestionsForRevision(
      targetQs.map((q) => q.id),
      progressStore,
      todayStr
    );

    onStartSession({
      title: `${chapter.title} • ${mode === "bookmarked" ? "Bookmarked" : "Mistakes"}`,
      subtitle: `${sortedIds.length} Questions`,
      questionIds: sortedIds,
      extraQuestions: targetQs,
      source: "wrong-chapter",
      chapterId: chapter.id,
    });
  };

  const renderQuestionCard = (q: Question, index: number, badgeType: "bookmarked" | "wrong") => {
    const isBookmarked = Boolean(progressStore[q.id]?.bookmarked);
    const isWrong = progressStore[q.id]?.status === "wrong";
    const isRevealed = Boolean(revealedIds[q.id]);
    const ch = getQuestionChapter(q);
    const qText = q.text || (q as any).question || "Question";
    const options: string[] = Array.isArray(q.options) ? q.options : [];
    const correctIndex = typeof q.correctIndex === "number" ? q.correctIndex : (typeof (q as any).correctOption === "number" ? (q as any).correctOption : 0);

    return (
      <div
        key={`${badgeType}_${q.id}`}
        className="bg-white dark:bg-[#1F2330] border border-[#E8D9C0] dark:border-[#31374A] rounded-2xl p-4 shadow-2xs space-y-3 transition-all"
      >
        {/* Top Row: Badges & Bookmark Toggle */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5 min-w-0">
            <span className="px-2 py-0.5 rounded-md bg-[#F7EFE2] dark:bg-[#252A3A] text-[#800020] dark:text-[#F47B20] text-[10px] font-black tabular-nums">
              Q.{index + 1}
            </span>
            {isBookmarked && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#C99A45]/15 text-[#946B1E] dark:text-[#E5BC6B] border border-[#C99A45]/30 text-[10px] font-extrabold uppercase tracking-wider">
                <Bookmark size={10} className="fill-current" />
                Bookmarked
              </span>
            )}
            {isWrong && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 border border-rose-200/60 dark:border-rose-800/50 text-[10px] font-extrabold uppercase tracking-wider">
                <XCircle size={10} />
                Mistake
              </span>
            )}
            {ch && (
              <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-[#52576A] dark:text-[#CBD2E1] text-[10px] font-bold truncate max-w-[200px] font-hindi">
                {ch.title}
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={() => handleBookmarkClick(q.id)}
            title={isBookmarked ? "Remove Bookmark" : "Bookmark Question"}
            className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 transition-all cursor-pointer active:scale-90 ${
              isBookmarked
                ? "bg-[#C99A45]/20 text-[#946B1E] dark:text-[#E5BC6B] border border-[#C99A45]/40"
                : "bg-[#F7EFE2] dark:bg-[#252A3A] text-[#787D91] dark:text-[#929AB0] border border-[#E8D9C0] dark:border-[#31374A]"
            }`}
          >
            <Bookmark size={15} className={isBookmarked ? "fill-current" : ""} />
          </button>
        </div>

        {/* Question Text */}
        <p className="text-xs sm:text-sm font-bold text-[#171923] dark:text-[#FFF9EF] leading-relaxed font-hindi whitespace-pre-line">
          {qText}
        </p>

        {/* Options List */}
        {options.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-0.5">
            {options.map((opt: string, optIdx: number) => {
              const isCorrectOpt = optIdx === correctIndex;
              const userLastSelected = progressStore[q.id]?.lastSelectedOption === optIdx;
              const optionLetter = String.fromCharCode(65 + optIdx);

              let optStyle =
                "bg-[#FFF9EF]/70 dark:bg-[#171923]/60 border-[#E8D9C0] dark:border-[#31374A] text-[#171923] dark:text-[#CBD2E1]";
              if (isRevealed) {
                if (isCorrectOpt) {
                  optStyle =
                    "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-400 dark:border-emerald-700 text-emerald-900 dark:text-emerald-200 font-bold";
                } else if (userLastSelected) {
                  optStyle =
                    "bg-rose-50 dark:bg-rose-950/30 border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-300";
                }
              }

              return (
                <div
                  key={optIdx}
                  onClick={() => {
                    if (!isRevealed) toggleRevealAnswer(q.id);
                  }}
                  className={`px-3 py-2 rounded-xl border text-xs flex items-start gap-2 transition-all cursor-pointer font-hindi ${optStyle}`}
                >
                  <span
                    className={`w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-black shrink-0 mt-0.5 ${
                      isRevealed && isCorrectOpt
                        ? "bg-emerald-600 text-white"
                        : "bg-[#E8D9C0]/60 dark:bg-[#252A3A] text-[#52576A] dark:text-[#929AB0]"
                    }`}
                  >
                    {optionLetter}
                  </span>
                  <span className="flex-1 leading-snug">{opt}</span>
                  {isRevealed && isCorrectOpt && (
                    <CheckCircle2 size={14} className="text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Explanation Box when Revealed */}
        {isRevealed && q.explanation && (
          <div className="p-3 rounded-xl bg-[#F7EFE2]/70 dark:bg-[#171923] border border-[#E8D9C0] dark:border-[#31374A] text-xs text-[#52576A] dark:text-[#CBD2E1] space-y-1 font-hindi">
            <div className="text-[10px] font-black uppercase tracking-wider text-[#800020] dark:text-[#F47B20]">
              Explanation
            </div>
            <p className="leading-relaxed whitespace-pre-line">{q.explanation}</p>
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-1 border-t border-[#E8D9C0]/60 dark:border-[#31374A]/60">
          <button
            type="button"
            onClick={() => toggleRevealAnswer(q.id)}
            className="inline-flex items-center gap-1.5 text-[11px] font-extrabold text-[#52576A] dark:text-[#CBD2E1] hover:text-[#800020] dark:hover:text-[#F47B20] transition-colors cursor-pointer"
          >
            {isRevealed ? <EyeOff size={13} /> : <Eye size={13} />}
            <span>{isRevealed ? "Hide Answer" : "Show Answer"}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              if (badgeType === "bookmarked") {
                handleStartAllBookmarksPractice(q.id);
              } else {
                onStartSession({
                  title: "Question Revision",
                  subtitle: ch?.title || "Mistake Bank",
                  questionIds: [q.id],
                  extraQuestions: [q],
                  source: "all-wrong",
                });
              }
            }}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#800020]/10 dark:bg-[#F47B20]/15 text-[#800020] dark:text-[#F47B20] text-[11px] font-extrabold hover:bg-[#800020] hover:text-white dark:hover:bg-[#F47B20] dark:hover:text-white transition-all cursor-pointer"
          >
            <Play size={11} className="fill-current" />
            <span>Practice</span>
          </button>
        </div>
      </div>
    );
  };

  return (
    <div id="wrong-tab-view" className="flex flex-col h-full bg-[#FFF9EF] dark:bg-[#171923] overflow-y-auto pb-24 select-none">
      {/* Header */}
      <div className="bg-white/95 dark:bg-[#1F2330]/95 backdrop-blur-md px-4 pt-4 pb-3 border-b border-[#E8D9C0] dark:border-[#31374A] sticky top-0 z-20">
        <div className="flex items-center justify-between max-w-4xl mx-auto w-full">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#800020] dark:bg-[#F47B20]" />
              <h1 className="text-lg font-black text-[#171923] dark:text-[#FFF9EF]">Mistake Bank &amp; Bookmarks</h1>
            </div>
            <p className="text-[#52576A] dark:text-[#CBD2E1] text-xs mt-0.5 font-medium">
              Review bookmarked questions and revise weak areas
            </p>
          </div>
          <button
            onClick={() => {
              triggerHaptic("light");
              setShowScheduleModal(true);
            }}
            className="w-9 h-9 rounded-xl bg-[#F7EFE2] dark:bg-[#252A3A] border border-[#E8D9C0] dark:border-[#31374A] flex items-center justify-center text-[#800020] dark:text-[#F47B20] active:scale-95 transition-all cursor-pointer"
            title="Revision Algorithm"
            aria-label="Revision Logic"
          >
            <Clock size={16} />
          </button>
        </div>
      </div>

      <main className="p-4 space-y-4 max-w-4xl mx-auto w-full">
        {/* Top Summary CTA Cards: Mistakes & Bookmarked */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Bookmarked Questions Quick Card */}
          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={() => {
              if (totalBookmarkedCount > 0) {
                handleStartAllBookmarksPractice();
              } else {
                setActiveFilter("bookmarked");
              }
            }}
            className="w-full bg-gradient-to-r from-[#800020] via-[#5E0017] to-[#171923] p-4 rounded-2xl text-white flex items-center justify-between shadow-md shadow-[#800020]/15 border border-[#C99A45]/40 active:scale-[0.98] transition-all group text-left cursor-pointer"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-11 h-11 bg-[#C99A45] rounded-xl flex items-center justify-center shrink-0 shadow-xs">
                <Bookmark size={20} fill="white" className="text-white" />
              </div>
              <div className="text-left min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="px-1.5 py-0.5 rounded bg-[#C99A45]/25 text-[#FFF9EF] border border-[#C99A45]/40 text-[9px] font-black uppercase tracking-wider">
                    SAVED MCQS
                  </span>
                </div>
                <h3 className="text-sm font-extrabold text-white mt-0.5 truncate">Bookmarked Questions</h3>
                <p className="text-[#FFF9EF]/85 text-xs mt-0.5 font-medium tabular-nums">
                  {totalBookmarkedCount > 0
                    ? `${totalBookmarkedCount} Bookmarked • Tap to Practice`
                    : "0 Bookmarked Questions"}
                </p>
              </div>
            </div>
            <div className="w-8 h-8 rounded-full bg-white/15 flex items-center justify-center shrink-0 group-hover:translate-x-1 transition-transform">
              <ChevronRight size={18} className="text-white" />
            </div>
          </motion.button>

          {/* Wrong Questions Quick Card */}
          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={() => {
              if (totalWrongCount > 0) {
                handleStartAllMistakesPractice();
              } else {
                setActiveFilter("mistakes");
              }
            }}
            className="w-full bg-white dark:bg-[#1F2330] p-4 rounded-2xl text-[#171923] dark:text-[#FFF9EF] flex items-center justify-between shadow-xs border border-[#E8D9C0] dark:border-[#31374A] hover:border-[#800020] dark:hover:border-[#F47B20] active:scale-[0.98] transition-all group text-left cursor-pointer"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-11 h-11 bg-rose-500/12 text-rose-600 dark:text-rose-400 rounded-xl flex items-center justify-center shrink-0">
                <XCircle size={20} />
              </div>
              <div className="text-left min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-600 dark:text-rose-400 text-[9px] font-black uppercase tracking-wider">
                    PRIORITY REVISION
                  </span>
                </div>
                <h3 className="text-sm font-extrabold text-[#171923] dark:text-[#FFF9EF] mt-0.5 truncate">
                  Practice All Mistakes
                </h3>
                <p className="text-[#52576A] dark:text-[#CBD2E1] text-xs mt-0.5 font-medium tabular-nums">
                  {totalWrongCount > 0
                    ? `${totalWrongCount} Wrong Qs • Tap to Master`
                    : "0 Pending Mistakes"}
                </p>
              </div>
            </div>
            <div className="w-8 h-8 rounded-full bg-[#F7EFE2] dark:bg-[#252A3A] flex items-center justify-center shrink-0 group-hover:translate-x-1 transition-transform">
              <ChevronRight size={18} className="text-[#800020] dark:text-[#F47B20]" />
            </div>
          </motion.button>
        </div>

        {/* Segmented Filter Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
          {[
            { id: "bookmarked", label: `Bookmarked (${totalBookmarkedCount})` },
            { id: "mistakes", label: `Mistakes (${totalWrongCount})` },
            { id: "by-chapter", label: "By Chapter" },
          ].map((tab) => {
            const isActive = activeFilter === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  triggerHaptic("light");
                  setActiveFilter(tab.id as any);
                }}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 active:scale-95 cursor-pointer tabular-nums flex items-center gap-1.5 ${
                  isActive
                    ? "bg-[#800020] dark:bg-[#F47B20] text-white shadow-xs"
                    : "bg-white dark:bg-[#1F2330] border border-[#E8D9C0] dark:border-[#31374A] text-[#52576A] dark:text-[#CBD2E1] hover:text-[#171923] dark:hover:text-white"
                }`}
              >
                {tab.id === "bookmarked" && (
                  <Bookmark size={12} className={isActive ? "fill-white" : ""} />
                )}
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* 1. BOOKMARKED QUESTIONS SECTION */}
        {activeFilter === "bookmarked" && (
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bookmark size={16} className="text-[#C99A45] fill-[#C99A45]" />
                <h2 className="text-sm font-black text-[#171923] dark:text-[#FFF9EF]">
                  Bookmarked Questions ({totalBookmarkedCount})
                </h2>
              </div>
              {totalBookmarkedCount > 0 && (
                <button
                  type="button"
                  onClick={() => handleStartAllBookmarksPractice()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#800020] dark:bg-[#F47B20] text-white text-xs font-extrabold shadow-2xs active:scale-95 transition-all cursor-pointer"
                >
                  <Play size={12} className="fill-white" />
                  <span>Practice All ({totalBookmarkedCount})</span>
                </button>
              )}
            </div>

            {bookmarkedQuestions.length === 0 ? (
              <div className="p-6 text-center bg-white dark:bg-[#1F2330] rounded-2xl border border-[#E8D9C0] dark:border-[#31374A] flex flex-col items-center">
                <div className="w-12 h-12 bg-[#C99A45]/15 rounded-2xl flex items-center justify-center mb-2.5 text-[#946B1E] dark:text-[#E5BC6B]">
                  <Bookmark size={22} />
                </div>
                <p className="font-extrabold text-sm text-[#171923] dark:text-[#FFF9EF] mb-1">
                  No Bookmarked Questions Yet
                </p>
                <p className="text-[#52576A] dark:text-[#CBD2E1] text-xs max-w-xs">
                  Tap the bookmark icon on any question during a quiz or test to save it here for quick revision.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {bookmarkedQuestions.map((q, idx) => renderQuestionCard(q, idx, "bookmarked"))}
              </div>
            )}
          </section>
        )}

        {/* 2. WRONG QUESTIONS SECTION */}
        {activeFilter === "mistakes" && (
          <section className="space-y-3 pt-1">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <XCircle size={16} className="text-rose-600 dark:text-rose-400" />
                <h2 className="text-sm font-black text-[#171923] dark:text-[#FFF9EF]">
                  Wrong Questions ({totalWrongCount})
                </h2>
              </div>
              {totalWrongCount > 0 && (
                <button
                  type="button"
                  onClick={handleStartAllMistakesPractice}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-600 text-white text-xs font-extrabold shadow-2xs active:scale-95 transition-all cursor-pointer"
                >
                  <Play size={12} className="fill-white" />
                  <span>Practice Mistakes ({totalWrongCount})</span>
                </button>
              )}
            </div>

            {wrongQuestions.length === 0 ? (
              <div className="p-6 text-center bg-white dark:bg-[#1F2330] rounded-2xl border border-[#E8D9C0] dark:border-[#31374A] flex flex-col items-center">
                <div className="w-12 h-12 bg-emerald-500/10 rounded-2xl flex items-center justify-center mb-2.5 text-emerald-600 dark:text-emerald-400">
                  <Sparkles size={22} />
                </div>
                <p className="font-extrabold text-sm text-[#171923] dark:text-[#FFF9EF] mb-1">
                  Zero Pending Mistakes!
                </p>
                <p className="text-[#52576A] dark:text-[#CBD2E1] text-xs max-w-xs">
                  All your attempted questions are clean. Keep practicing to build mastery!
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {wrongQuestions.map((q, idx) => renderQuestionCard(q, idx, "wrong"))}
              </div>
            )}
          </section>
        )}

        {/* 3. CHAPTER-WISE BREAKDOWN (Shown in "by-chapter" view) */}
        {activeFilter === "by-chapter" && (
          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <BookOpen size={16} className="text-[#800020] dark:text-[#F47B20]" />
              <h2 className="text-sm font-black text-[#171923] dark:text-[#FFF9EF]">
                Chapter-wise Mistakes &amp; Bookmarks
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {chaptersBreakdown.length === 0 ? (
                <div className="md:col-span-2 p-8 text-center bg-white dark:bg-[#1F2330] rounded-2xl border border-[#E8D9C0] dark:border-[#31374A] flex flex-col items-center">
                  <div className="w-12 h-12 bg-[#800020]/10 dark:bg-[#F47B20]/15 rounded-2xl flex items-center justify-center mb-2.5">
                    <Sparkles size={22} className="text-[#800020] dark:text-[#F47B20]" />
                  </div>
                  <p className="font-extrabold text-sm text-[#171923] dark:text-[#FFF9EF] mb-1">No Chapters Found</p>
                  <p className="text-[#52576A] dark:text-[#CBD2E1] text-xs max-w-xs">
                    No chapters currently have wrong or bookmarked questions.
                  </p>
                </div>
              ) : (
                chaptersBreakdown.map(({ chapter, wrongQs, bookmarkedQs, wrongCount, bookmarkedCount }) => (
                  <div
                    key={chapter.id}
                    className="w-full bg-white dark:bg-[#1F2330] border border-[#E8D9C0] dark:border-[#31374A] rounded-2xl p-3.5 shadow-2xs space-y-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="text-xs font-bold text-[#171923] dark:text-[#FFF9EF] truncate font-hindi">
                        {chapter.title}
                      </h4>
                    </div>

                    <div className="flex items-center gap-2">
                      {bookmarkedCount > 0 && (
                        <button
                          type="button"
                          onClick={() => handleStartChapterRevision(chapter, wrongQs, bookmarkedQs, "bookmarked")}
                          className="flex-1 py-2 px-3 rounded-xl bg-[#C99A45]/15 hover:bg-[#C99A45]/25 text-[#946B1E] dark:text-[#E5BC6B] border border-[#C99A45]/30 text-xs font-extrabold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                        >
                          <Bookmark size={13} className="fill-current" />
                          <span>{bookmarkedCount} Bookmarked</span>
                        </button>
                      )}
                      {wrongCount > 0 && (
                        <button
                          type="button"
                          onClick={() => handleStartChapterRevision(chapter, wrongQs, bookmarkedQs, "wrong")}
                          className="flex-1 py-2 px-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 text-rose-600 dark:text-rose-400 border border-rose-200/70 dark:border-rose-800/50 text-xs font-extrabold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                        >
                          <XCircle size={13} />
                          <span>{wrongCount} Wrong</span>
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        )}
      </main>

      {/* Spaced Repetition Logic Modal */}
      <AnimatePresence>
        {showScheduleModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-sm bg-white dark:bg-[#1F2330] border border-[#E8D9C0] dark:border-[#31374A] rounded-3xl p-5 shadow-2xl space-y-4"
            >
              <div className="flex items-center justify-between pb-2 border-b border-[#E8D9C0] dark:border-[#31374A]">
                <div className="flex items-center gap-2.5 text-[#800020] dark:text-[#F47B20]">
                  <Calendar size={18} />
                  <h3 className="font-extrabold uppercase tracking-wider text-xs">Spaced Repetition</h3>
                </div>
                <button
                  onClick={() => setShowScheduleModal(false)}
                  className="w-8 h-8 rounded-lg bg-[#F7EFE2] dark:bg-[#252A3A] flex items-center justify-center text-[#52576A] hover:text-[#171923] dark:hover:text-[#FFF9EF] cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="space-y-3">
                <p className="text-xs text-[#52576A] dark:text-[#CBD2E1] leading-relaxed">
                  Every incorrect question is automatically logged and scheduled for review using an algorithmic spaced repetition schedule:
                </p>

                <div className="bg-[#FFF9EF] dark:bg-[#171923] p-3 rounded-2xl border border-[#E8D9C0] dark:border-[#31374A] text-center">
                  <p className="text-[#800020] dark:text-[#F47B20] font-black text-xs tracking-widest tabular-nums">
                    DAY 3 → 7 → 21 → 45 → 75
                  </p>
                  <p className="text-[9.5px] text-[#787D91] dark:text-[#929AB0] font-bold uppercase mt-0.5">
                    Scientific Mastery Intervals
                  </p>
                </div>

                <div className="space-y-2">
                  {[
                    "Weak questions appear with top revision priority",
                    "Correct answers advance question to next interval",
                    "Mistakes reset the interval for complete mastery",
                  ].map((text, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-[#800020] dark:bg-[#F47B20] mt-1.5 shrink-0" />
                      <p className="text-xs text-[#52576A] dark:text-[#CBD2E1] font-medium">{text}</p>
                    </div>
                  ))}
                </div>
              </div>

              <button
                onClick={() => {
                  triggerHaptic("light");
                  setShowScheduleModal(false);
                }}
                className="w-full bg-[#800020] hover:bg-[#5E0017] dark:bg-[#F47B20] dark:hover:bg-[#E06A12] text-white py-3 rounded-xl font-extrabold text-xs active:scale-95 transition-all shadow-md cursor-pointer"
              >
                Got It
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
