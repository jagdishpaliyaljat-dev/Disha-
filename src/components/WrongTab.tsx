import React, { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ProgressStore, MCQSession, Chapter, Question, BookmarkReasonTag } from "../types";
import { CHAPTERS_DATA, ALL_QUESTIONS } from "../data/questions";
import { getTodayDateString, sortQuestionsForRevision } from "../utils/revision";
import { getAllCachedBundles } from "../utils/indexedDbCache";
import { getAllCachedQuestions } from "../utils/questionBankCache";
import { triggerHaptic, playClickSound } from "../utils/audioFeedback";
import { useProgress } from "../context/ProgressContext";
import {
  BOOKMARK_REASON_TAGS,
  BookmarkTagFilter,
  buildBookmarkTagSession,
  computeBookmarkTagCounts,
  filterBookmarkedQuestionsByTag,
  getBookmarkTagMeta,
} from "../utils/bookmarkTags";
import { SmartBookmarkButton } from "./SmartBookmarkButton";
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
  Flag,
  Lock,
  Crown,
} from "lucide-react";
import { QuestionReportModal } from "./QuestionReportModal";
import { isFeatureVipLocked } from "../services/payment/premiumConfigService";
import { loadUserProfile } from "../utils/userProfileStorage";

interface WrongTabProps {
  progressStore: ProgressStore;
  chapters?: Chapter[];
  questions?: Question[];
  onSelectWrongChapter: (chapterId: string) => void;
  onStartSession: (session: MCQSession) => void;
  onToggleBookmark?: (questionId: string, tag?: BookmarkReasonTag | null) => void;
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
  const [bookmarkTagFilter, setBookmarkTagFilter] = useState<BookmarkTagFilter>("all");
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportingQuestion, setReportingQuestion] = useState<Question | null>(null);
  const [revealedIds, setRevealedIds] = useState<Record<string, boolean>>({});
  const [hydratedQuestions, setHydratedQuestions] = useState<Question[]>([]);
  const todayStr = getTodayDateString();
  const isMistakeLocked = useMemo(() => isFeatureVipLocked("mistake_bank", loadUserProfile()), []);

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
                const { data, error } = await supabase.from("questions").select("id,question,options,correct_answer,explanation,subject_id,chapter_id,topic_id,exam,year,level").in("id", stillMissing);
                if (!error && data && data.length > 0) {
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

  const bookmarkTagCounts = useMemo(
    () => computeBookmarkTagCounts(bookmarkedQuestions, progressStore),
    [bookmarkedQuestions, progressStore]
  );

  const filteredBookmarkedQuestions = useMemo(
    () => filterBookmarkedQuestionsByTag(bookmarkedQuestions, progressStore, bookmarkTagFilter),
    [bookmarkedQuestions, progressStore, bookmarkTagFilter]
  );

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

  const handleBookmarkClick = (questionId: string, tag?: BookmarkReasonTag | null) => {
    triggerHaptic("light");
    if (onToggleBookmark) {
      onToggleBookmark(questionId, tag);
    } else {
      contextToggleBookmark(questionId, tag);
    }
  };

  const toggleRevealAnswer = (questionId: string) => {
    triggerHaptic("light");
    setRevealedIds((prev) => ({ ...prev, [questionId]: !prev[questionId] }));
  };

  // Start practice of all wrong questions
  const handleStartAllMistakesPractice = () => {
    if (wrongQuestions.length === 0) return;

    // Check VIP paywall for Mistake Bank
    const profile = loadUserProfile();
    if (isFeatureVipLocked("mistake_bank", profile)) {
      triggerHaptic("warning");
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("disha_open_premium_modal", {
            detail: {
              trigger: "mistake_bank",
              title: "Mistake Bank Revision Locked",
              message: "Auto-spaced repetition mistake vault is a VIP Pass feature. Upgrade now to master every question you missed!",
            },
          })
        );
      }
      return;
    }

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

  // Start practice of all bookmarked questions (filtered by active reason tag)
  const handleStartAllBookmarksPractice = (startFromQuestionId?: string) => {
    const session = buildBookmarkTagSession(
      bookmarkedQuestions,
      progressStore,
      bookmarkTagFilter,
      startFromQuestionId
    );
    if (!session) return;
    triggerHaptic("light");
    playClickSound();
    onStartSession(session);
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
    const prog = progressStore[q.id];
    const isBookmarked = Boolean(prog?.bookmarked);
    const bookmarkTagMeta = isBookmarked ? getBookmarkTagMeta(prog?.bookmarkTag) : null;
    const isWrong = prog?.status === "wrong";
    const isRevealed = Boolean(revealedIds[q.id]);
    const ch = getQuestionChapter(q);
    const qText = q.text || (q as any).question || "Question";
    const options: string[] = Array.isArray(q.options) ? q.options : [];
    const correctIndex = typeof q.correctIndex === "number" ? q.correctIndex : (typeof (q as any).correctOption === "number" ? (q as any).correctOption : 0);

    return (
      <div
        key={`${badgeType}_${q.id}`}
        className="bg-white dark:bg-[#1B1536] border border-slate-200 dark:border-[#31275E] rounded-2xl p-4 shadow-2xs space-y-3 transition-all"
      >
        {/* Top Row: Badges & Bookmark Toggle */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5 min-w-0">
            <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-[#241D48] text-[#7045D8] dark:text-[#A78BFA] text-[11px] font-black tabular-nums">
              Q.{index + 1}
            </span>
            {isBookmarked && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#A78BFA]/15 text-[#946B1E] dark:text-[#E5BC6B] border border-[#A78BFA]/30 text-[11px] font-extrabold uppercase tracking-wider">
                <Bookmark size={10} className="fill-current" />
                Bookmarked
              </span>
            )}
            {bookmarkTagMeta && (
              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[11px] font-extrabold ${bookmarkTagMeta.badgeClass}`}
              >
                {bookmarkTagMeta.shortLabel}
              </span>
            )}
            {isWrong && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 border border-rose-200/60 dark:border-rose-800/50 text-[11px] font-extrabold uppercase tracking-wider">
                <XCircle size={10} />
                Mistake
              </span>
            )}
            {ch && (
              <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[11px] font-bold truncate max-w-[200px] font-hindi">
                {ch.title}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => {
                triggerHaptic("light");
                playClickSound();
                setReportingQuestion(q);
                setShowReportModal(true);
              }}
              title="Report Question / Raise Objection"
              className="w-10 h-10 rounded-xl flex items-center justify-center transition-all cursor-pointer active:scale-90 bg-slate-100 dark:bg-[#241D48] text-amber-600 dark:text-amber-400 border border-slate-200 dark:border-[#31275E] hover:bg-amber-50 dark:hover:bg-amber-950/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7045D8]"
              aria-label="Report Question"
            >
              <Flag size={15} />
            </button>

            <SmartBookmarkButton
              questionId={q.id}
              isBookmarked={isBookmarked}
              currentTag={prog?.bookmarkTag}
              onToggleBookmark={handleBookmarkClick}
              size="sm"
            />
          </div>
        </div>

        {/* Question Text */}
        <p className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-50 leading-relaxed font-hindi whitespace-pre-line">
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
                "bg-[#F8FAFC]/70 dark:bg-[#130E26]/60 border-slate-200 dark:border-[#31275E] text-slate-900 dark:text-slate-300";
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
                <button
                  key={optIdx}
                  type="button"
                  onClick={() => {
                    if (!isRevealed) toggleRevealAnswer(q.id);
                  }}
                  aria-label={`Option ${optionLetter}: ${opt}`}
                  className={`w-full text-left px-3 py-2.5 min-h-[44px] rounded-xl border text-xs flex items-start gap-2 transition-all cursor-pointer font-hindi focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7045D8] ${optStyle}`}
                >
                  <span
                    className={`w-5 h-5 rounded-md flex items-center justify-center text-[11px] font-black shrink-0 mt-0.5 ${
                      isRevealed && isCorrectOpt
                        ? "bg-emerald-600 text-white"
                        : "bg-slate-200/80 dark:bg-[#241D48] text-slate-700 dark:text-slate-300"
                    }`}
                  >
                    {optionLetter}
                  </span>
                  <span className="flex-1 leading-snug">{opt}</span>
                  {isRevealed && isCorrectOpt && (
                    <CheckCircle2 size={14} className="text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* Explanation Box when Revealed */}
        {isRevealed && q.explanation && (
          <div className="p-3 rounded-xl bg-slate-100/70 dark:bg-[#130E26] border border-slate-200 dark:border-[#31275E] text-xs text-slate-600 dark:text-slate-300 space-y-1 font-hindi">
            <div className="text-[11px] font-black uppercase tracking-wider text-[#7045D8] dark:text-[#A78BFA]">
              Explanation
            </div>
            <p className="leading-relaxed whitespace-pre-line">{q.explanation}</p>
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-1 border-t border-slate-200/60 dark:border-[#31275E]/60">
          <button
            type="button"
            onClick={() => toggleRevealAnswer(q.id)}
            className="inline-flex items-center gap-1.5 text-[11px] font-extrabold text-slate-600 dark:text-slate-300 hover:text-[#7045D8] dark:hover:text-[#A78BFA] transition-colors cursor-pointer"
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
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#7045D8]/10 dark:bg-[#7045D8]/15 text-[#7045D8] dark:text-[#A78BFA] text-[11px] font-extrabold hover:bg-[#7045D8] hover:text-white dark:hover:bg-[#7045D8] dark:hover:text-white transition-all cursor-pointer"
          >
            <Play size={11} className="fill-current" />
            <span>Practice</span>
          </button>
        </div>
      </div>
    );
  };

  return (
    <div id="wrong-tab-view" className="flex flex-col h-full bg-[#F8FAFC] dark:bg-[#130E26] overflow-y-auto pb-28 md:pb-8 select-none">
      {/* Header */}
      <header className="bg-white/95 dark:bg-[#130E26]/95 backdrop-blur-md border-b border-slate-200 dark:border-[#31275E] sticky top-0 md:top-14 z-30 select-none shadow-xs pt-[env(safe-area-inset-top,0px)] md:pt-0">
        <div className="px-4 py-2.5 min-h-[60px] flex items-center justify-between max-w-4xl mx-auto w-full">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#7045D8] dark:bg-[#A78BFA]" />
              <h1 className="text-lg font-black text-slate-900 dark:text-slate-50">Mistake Bank &amp; Bookmarks</h1>
            </div>
            <p className="text-slate-600 dark:text-slate-300 text-xs mt-0.5 font-medium">
              Review bookmarked questions and revise weak areas
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              triggerHaptic("light");
              setShowScheduleModal(true);
            }}
            className="w-11 h-11 rounded-xl bg-slate-100 dark:bg-[#241D48] border border-slate-200 dark:border-[#31275E] flex items-center justify-center text-[#7045D8] dark:text-[#A78BFA] active:scale-95 transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7045D8]"
            title="Revision Algorithm"
            aria-label="Revision Logic"
          >
            <Clock size={17} />
          </button>
        </div>
      </header>

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
            className="w-full bg-gradient-to-r from-[#7045D8] via-[#5B32BF] to-[#130E26] p-4 rounded-2xl text-white flex items-center justify-between shadow-md shadow-[#7045D8]/15 border border-[#A78BFA]/40 active:scale-[0.98] transition-all group text-left cursor-pointer"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-11 h-11 bg-[#A78BFA] rounded-xl flex items-center justify-center shrink-0 shadow-xs">
                <Bookmark size={20} fill="white" className="text-white" />
              </div>
              <div className="text-left min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="px-1.5 py-0.5 rounded bg-[#A78BFA]/25 text-white border border-[#A78BFA]/40 text-[11px] font-black uppercase tracking-wider">
                    SAVED MCQS
                  </span>
                </div>
                <h3 className="text-sm font-extrabold text-white mt-0.5 truncate">Bookmarked Questions</h3>
                <p className="text-white/85 text-xs mt-0.5 font-medium tabular-nums">
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
            className="w-full bg-white dark:bg-[#1B1536] p-4 rounded-2xl text-slate-900 dark:text-slate-50 flex items-center justify-between shadow-xs border border-slate-200 dark:border-[#31275E] hover:border-[#7045D8] dark:hover:border-[#A78BFA] active:scale-[0.98] transition-all group text-left cursor-pointer"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-11 h-11 bg-rose-500/12 text-rose-600 dark:text-rose-400 rounded-xl flex items-center justify-center shrink-0">
                <XCircle size={20} />
              </div>
              <div className="text-left min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-600 dark:text-rose-400 text-[11px] font-black uppercase tracking-wider">
                    PRIORITY REVISION
                  </span>
                  {isMistakeLocked && (
                    <span className="px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-700 dark:text-amber-400 text-[11px] font-black uppercase tracking-wider flex items-center gap-0.5">
                      <Lock size={9} /> VIP PASS
                    </span>
                  )}
                </div>
                <h3 className="text-sm font-extrabold text-slate-900 dark:text-slate-50 mt-0.5 truncate">
                  Practice All Mistakes
                </h3>
                <p className="text-slate-600 dark:text-slate-300 text-xs mt-0.5 font-medium tabular-nums">
                  {totalWrongCount > 0
                    ? `${totalWrongCount} Wrong Qs • Tap to Master`
                    : "0 Pending Mistakes"}
                </p>
              </div>
            </div>
            <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-[#241D48] flex items-center justify-center shrink-0 group-hover:translate-x-1 transition-transform">
              <ChevronRight size={18} className="text-[#7045D8] dark:text-[#A78BFA]" />
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
                    ? "bg-[#7045D8] dark:bg-[#7045D8] text-white shadow-xs"
                    : "bg-white dark:bg-[#1B1536] border border-slate-200 dark:border-[#31275E] text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
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
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <Bookmark size={16} className="text-amber-500 fill-amber-500" />
                <h2 className="text-sm font-black text-slate-900 dark:text-slate-50">
                  Bookmarked Questions ({filteredBookmarkedQuestions.length})
                </h2>
              </div>
              {filteredBookmarkedQuestions.length > 0 && (
                <button
                  type="button"
                  onClick={() => handleStartAllBookmarksPractice()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#7045D8] dark:bg-[#7045D8] text-white text-xs font-extrabold shadow-2xs active:scale-95 transition-all cursor-pointer"
                >
                  <Play size={12} className="fill-white" />
                  <span>
                    {bookmarkTagFilter === "all"
                      ? `Practice All (${filteredBookmarkedQuestions.length})`
                      : bookmarkTagFilter === "untagged"
                      ? `Practice Untagged (${filteredBookmarkedQuestions.length})`
                      : `Practice ${getBookmarkTagMeta(bookmarkTagFilter)?.labelHi || ""} (${filteredBookmarkedQuestions.length})`}
                  </span>
                </button>
              )}
            </div>

            {/* Reason-Based Smart Bookmark Tag Filter Bar */}
            {totalBookmarkedCount > 0 && (
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic("light");
                    setBookmarkTagFilter("all");
                  }}
                  className={`px-2.5 py-1.5 rounded-xl text-[11px] font-black border whitespace-nowrap transition-all cursor-pointer ${
                    bookmarkTagFilter === "all"
                      ? "bg-[#7045D8] dark:bg-[#7045D8] text-white border-transparent shadow-2xs"
                      : "bg-white dark:bg-[#1B1536] text-slate-600 dark:text-slate-300 border-slate-200 dark:border-[#31275E]"
                  }`}
                >
                  All ({bookmarkTagCounts.all})
                </button>
                {BOOKMARK_REASON_TAGS.map((tag) => {
                  const count = bookmarkTagCounts[tag.id];
                  const isActive = bookmarkTagFilter === tag.id;
                  return (
                    <button
                      key={tag.id}
                      type="button"
                      onClick={() => {
                        triggerHaptic("light");
                        setBookmarkTagFilter(tag.id);
                      }}
                      className={`px-2.5 py-1.5 rounded-xl text-[11px] font-black border whitespace-nowrap transition-all cursor-pointer ${
                        isActive
                          ? tag.activeButtonClass
                          : "bg-white dark:bg-[#1B1536] text-slate-600 dark:text-slate-300 border-slate-200 dark:border-[#31275E]"
                      }`}
                    >
                      {tag.shortLabel} ({count})
                    </button>
                  );
                })}
                {bookmarkTagCounts.untagged > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic("light");
                      setBookmarkTagFilter("untagged");
                    }}
                    className={`px-2.5 py-1.5 rounded-xl text-[11px] font-black border whitespace-nowrap transition-all cursor-pointer ${
                      bookmarkTagFilter === "untagged"
                        ? "bg-slate-700 text-white border-slate-700"
                        : "bg-white dark:bg-[#1B1536] text-slate-600 dark:text-slate-300 border-slate-200 dark:border-[#31275E]"
                    }`}
                  >
                    Untagged ({bookmarkTagCounts.untagged})
                  </button>
                )}
              </div>
            )}

            {bookmarkedQuestions.length === 0 ? (
              <div className="p-6 text-center bg-white dark:bg-[#1B1536] rounded-2xl border border-slate-200 dark:border-[#31275E] flex flex-col items-center">
                <div className="w-12 h-12 bg-[#A78BFA]/15 rounded-2xl flex items-center justify-center mb-2.5 text-[#946B1E] dark:text-[#E5BC6B]">
                  <Bookmark size={22} />
                </div>
                <p className="font-extrabold text-sm text-slate-900 dark:text-slate-50 mb-1">
                  No Bookmarked Questions Yet
                </p>
                <p className="text-slate-600 dark:text-slate-300 text-xs max-w-xs">
                  Tap the bookmark icon on any question during a quiz or test to save it with a reason tag for quick revision.
                </p>
              </div>
            ) : filteredBookmarkedQuestions.length === 0 ? (
              <div className="p-5 text-center bg-white dark:bg-[#1B1536] rounded-2xl border border-slate-200 dark:border-[#31275E] space-y-2">
                <p className="font-extrabold text-xs text-slate-900 dark:text-slate-50">
                  इस टैग में कोई बुकमार्क प्रश्न नहीं है
                </p>
                <p className="text-[11px] text-slate-600 dark:text-slate-300">
                  किसी भी प्रश्न के बुकमार्क बटन पर टैप करके उसे &quot;रटना है&quot;, &quot;कन्फ्यूजिंग पेयर&quot;, &quot;सिल्ली मिस्टेक&quot; या &quot;हाई-यील्ड PYQ&quot; टैग दे सकते हैं।
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredBookmarkedQuestions.map((q, idx) => renderQuestionCard(q, idx, "bookmarked"))}
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
                <h2 className="text-sm font-black text-slate-900 dark:text-slate-50">
                  Wrong Questions ({totalWrongCount})
                </h2>
              </div>
              {totalWrongCount > 0 && (
                <button
                  type="button"
                  onClick={handleStartAllMistakesPractice}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-extrabold shadow-2xs active:scale-95 transition-all cursor-pointer ${
                    isMistakeLocked
                      ? "bg-gradient-to-r from-amber-600 to-amber-500 text-white"
                      : "bg-rose-600 text-white"
                  }`}
                >
                  {isMistakeLocked ? <Lock size={12} /> : <Play size={12} className="fill-white" />}
                  <span>{isMistakeLocked ? "Unlock Mistake Bank" : `Practice Mistakes (${totalWrongCount})`}</span>
                </button>
              )}
            </div>

            {wrongQuestions.length === 0 ? (
              <div className="p-6 text-center bg-white dark:bg-[#1B1536] rounded-2xl border border-slate-200 dark:border-[#31275E] flex flex-col items-center">
                <div className="w-12 h-12 bg-emerald-500/10 rounded-2xl flex items-center justify-center mb-2.5 text-emerald-600 dark:text-emerald-400">
                  <Sparkles size={22} />
                </div>
                <p className="font-extrabold text-sm text-slate-900 dark:text-slate-50 mb-1">
                  Zero Pending Mistakes!
                </p>
                <p className="text-slate-600 dark:text-slate-300 text-xs max-w-xs">
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
              <BookOpen size={16} className="text-[#7045D8] dark:text-[#A78BFA]" />
              <h2 className="text-sm font-black text-slate-900 dark:text-slate-50">
                Chapter-wise Mistakes &amp; Bookmarks
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {chaptersBreakdown.length === 0 ? (
                <div className="md:col-span-2 p-8 text-center bg-white dark:bg-[#1B1536] rounded-2xl border border-slate-200 dark:border-[#31275E] flex flex-col items-center">
                  <div className="w-12 h-12 bg-[#7045D8]/10 dark:bg-[#7045D8]/15 rounded-2xl flex items-center justify-center mb-2.5">
                    <Sparkles size={22} className="text-[#7045D8] dark:text-[#A78BFA]" />
                  </div>
                  <p className="font-extrabold text-sm text-slate-900 dark:text-slate-50 mb-1">No Chapters Found</p>
                  <p className="text-slate-600 dark:text-slate-300 text-xs max-w-xs">
                    No chapters currently have wrong or bookmarked questions.
                  </p>
                </div>
              ) : (
                chaptersBreakdown.map(({ chapter, wrongQs, bookmarkedQs, wrongCount, bookmarkedCount }) => (
                  <div
                    key={chapter.id}
                    className="w-full bg-white dark:bg-[#1B1536] border border-slate-200 dark:border-[#31275E] rounded-2xl p-3.5 shadow-2xs space-y-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="text-xs font-bold text-slate-900 dark:text-slate-50 truncate font-hindi">
                        {chapter.title}
                      </h4>
                    </div>

                    <div className="flex items-center gap-2">
                      {bookmarkedCount > 0 && (
                        <button
                          type="button"
                          onClick={() => handleStartChapterRevision(chapter, wrongQs, bookmarkedQs, "bookmarked")}
                          className="flex-1 py-2 px-3 rounded-xl bg-[#A78BFA]/15 hover:bg-[#A78BFA]/25 text-[#946B1E] dark:text-[#E5BC6B] border border-[#A78BFA]/30 text-xs font-extrabold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
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
              className="w-full max-w-sm bg-white dark:bg-[#1B1536] border border-slate-200 dark:border-[#31275E] rounded-3xl p-5 shadow-2xl space-y-4"
            >
              <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-[#31275E]">
                <div className="flex items-center gap-2.5 text-[#7045D8] dark:text-[#A78BFA]">
                  <Calendar size={18} />
                  <h3 className="font-extrabold uppercase tracking-wider text-xs">Spaced Repetition</h3>
                </div>
                <button
                  onClick={() => setShowScheduleModal(false)}
                  className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-[#241D48] flex items-center justify-center text-slate-600 hover:text-slate-900 dark:hover:text-white cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="space-y-3">
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  Every incorrect question is automatically logged and scheduled for review using an algorithmic spaced repetition schedule:
                </p>

                <div className="bg-[#F8FAFC] dark:bg-[#130E26] p-3 rounded-2xl border border-slate-200 dark:border-[#31275E] text-center">
                  <p className="text-[#7045D8] dark:text-[#A78BFA] font-black text-xs tracking-widest tabular-nums">
                    DAY 3 → 7 → 21 → 45 → 75
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 font-bold uppercase mt-0.5">
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
                      <div className="w-1.5 h-1.5 rounded-full bg-[#7045D8] dark:bg-[#7045D8] mt-1.5 shrink-0" />
                      <p className="text-xs text-slate-600 dark:text-slate-300 font-medium">{text}</p>
                    </div>
                  ))}
                </div>
              </div>

              <button
                onClick={() => {
                  triggerHaptic("light");
                  setShowScheduleModal(false);
                }}
                className="w-full bg-[#7045D8] hover:bg-[#5B32BF] dark:bg-[#7045D8] dark:hover:bg-[#5B32BF] text-white py-3 rounded-xl font-extrabold text-xs active:scale-95 transition-all shadow-md cursor-pointer"
              >
                Got It
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <QuestionReportModal
        isOpen={showReportModal}
        onClose={() => {
          setShowReportModal(false);
          setReportingQuestion(null);
        }}
        question={reportingQuestion}
      />
    </div>
  );
};
