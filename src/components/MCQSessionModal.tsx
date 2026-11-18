import React, { useState, useMemo, useEffect, useRef } from "react";
import { MCQSession, AppSettings, Question, Chapter, UserProfile, ProgressStore } from "../types";
import { useProgress } from "../context/ProgressContext";
import { useQuestions } from "../context/QuestionsContext";
import { QUESTIONS_MAP, CHAPTERS_MAP, TOPICS_MAP } from "../data/questions";
import { motion, AnimatePresence } from "motion/react";
import {
  ArrowLeft,
  Bookmark,
  CheckCircle2,
  XCircle,
  Lightbulb,
  ArrowRight,
  RotateCcw,
  Sparkles,
  BookOpen,
  Layers,
  Award,
  Home,
  Shuffle,
  Play,
  Clock,
  Filter,
  Check,
  FileText,
  AlertCircle,
  HelpCircle,
  Send,
  X,
  Flame,
  Zap,
  TrendingDown,
  TrendingUp,
  Target,
  Settings2,
  MoreVertical,
  Flag,
  Maximize2,
  Minimize2,
  Grid,
  Trash2,
  Share2,
  Shield,
  Trophy,
  ChevronRight,
} from "lucide-react";
import confetti from "canvas-confetti";
import { MotionConfettiCelebration } from "./MotionConfettiCelebration";
import ShareModal, { ShareData } from "./ShareModal";
import { getShareUrl, buildPYQShareData, buildLiveTestShareData, buildTopicShareData } from "../utils/shareService";
import { SessionLeaderboard } from "./SessionLeaderboard";
import {
  recordQuestionAttempt,
  loadPerformanceStore,
  saveSmartTestRecord,
} from "../utils/performanceStorage";
import {
  flushStudentWriteBuffer,
  setAdminPreviewSession,
} from "../utils/studentWriteBuffer";
import { BASELINE_REFERENCE_TIME_SECONDS } from "../utils/smartPriority";
import { AppSettingsModal } from "./AppSettingsModal";
import { QuestionReportModal } from "./QuestionReportModal";
import { ParsedQuestion } from "./ParsedQuestion";
import { MathText } from "./MathText";
import { RichText } from "./RichText";
import {
  playCorrectSound,
  playWrongSound,
  playClickSound,
  triggerHaptic,
} from "../utils/audioFeedback";
import { apiFetch } from "../utils/api";

// Fisher-Yates shuffle algorithm for reliable randomisation
function shuffleArray<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = arr[i];
    arr[i] = arr[j];
    arr[j] = temp;
  }
  return arr;
}

interface MCQSessionModalProps {
  session: MCQSession;
  settings: AppSettings;
  userProfile?: UserProfile | null;
  questionsMap?: Record<string, Question>;
  chaptersMap?: Record<string, Chapter>;
  onUpdateProgress: (
    questionId: string,
    isCorrect: boolean,
    selectedOption: number
  ) => void;
  onToggleBookmark: (questionId: string) => void;
  onClose: () => void;
  onStartNewSession: (newSession: MCQSession) => void;
  onUpdateSettings?: (newSettings: Partial<AppSettings>) => void;
}

export const MCQSessionModal: React.FC<MCQSessionModalProps> = ({
  session,
  settings,
  userProfile,
  questionsMap = QUESTIONS_MAP,
  chaptersMap = CHAPTERS_MAP,
  onUpdateProgress,
  onToggleBookmark,
  onClose,
  onStartNewSession,
  onUpdateSettings,
}) => {
  const { progressStore, updateProgress, toggleBookmark } = useProgress();
  const { questionsStore } = useQuestions();
  // Practice session vs Official Exam / Test Mode
  // "Practice session ko chodkar baki wale live test, Pyq test as exam hona chahiye, last me result show hona chahiye"
  const isExamMode = Boolean(
    session.testType === "live" ||
    session.testType === "pyq" ||
    session.testType === "subject" ||
    session.isLiveTest ||
    session.isPYQ ||
    session.isExamSimulation ||
    session.source === "full-exam" ||
    session.isTestMode ||
    session.liveTestDetails ||
    session.pyqDetails ||
    session.source === "all-chapters" ||
    session.source === "chapter"
  );

  const isTestMode = isExamMode;
  const isLiveOrPYQTest = isExamMode;

  // Session setup vs active question view (topic practice opens immediately)
  const [isStarted, setIsStarted] = useState(() => {
    return session.source === "topic" || !isExamMode;
  });

  // Active question ID ordering
  const [activeQuestionIds, setActiveQuestionIds] = useState<string[]>(() => {
    const allIds = session.questionIds && session.questionIds.length > 0 
      ? session.questionIds 
      : [
          ...(session.extraQuestions || []),
          ...(session.liveTestDetails?.questions || []),
          ...(session.pyqDetails?.questions || []),
        ].map((q, idx) => q.id || `q_${idx}`);
    const uniqueIds = Array.from(new Set(allIds));
    const shouldShuffle = Boolean(session.shuffleQuestions ?? settings.shuffleQuestions ?? false);
    return shouldShuffle ? shuffleArray(uniqueIds) : uniqueIds;
  });

  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOptionIndex, setSelectedOptionIndex] = useState<number | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [showPalette, setShowPalette] = useState(false);
  const [sessionResults, setSessionResults] = useState<
    Record<string, { selectedIndex: number; isCorrect: boolean; isSubmitted: boolean }>
  >({});
  const isLiveTestSession = Boolean(
    session.isLiveTest || session.testType === "live" || session.liveTestDetails
  );
  const [serverGradedQuestions, setServerGradedQuestions] = useState<
    Record<string, { correctIndex: number; explanation?: string; importantFact?: string }>
  >({});
  const [serverLiveSubmission, setServerLiveSubmission] = useState<any | null>(null);
  const [liveSubmitError, setLiveSubmitError] = useState<string | null>(null);
  const [isSubmittingLiveTest, setIsSubmittingLiveTest] = useState(false);
  const [showPerfectCelebration, setShowPerfectCelebration] = useState(false);
  const [shareData, setShareData] = useState<ShareData | null>(null);
  const hasTriggered100CelebrationRef = useRef(false);

  // Auto-advance state for Test Mode
  const [isAdvancing, setIsAdvancing] = useState(false);
  const autoAdvanceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const hasRecordedAnswersRef = useRef(false);
  const latestSessionMetaRef = useRef({
    userProfile,
    session,
    elapsedSeconds: 0,
  });
  latestSessionMetaRef.current = { userProfile, session, elapsedSeconds: 0 };

  useEffect(() => {
    setAdminPreviewSession(Boolean(session.isAdminPreview));
    return () => {
      setAdminPreviewSession(false);
    };
  }, [session.isAdminPreview]);

  useEffect(() => {
    return () => {
      if (hasRecordedAnswersRef.current) {
        const snap = latestSessionMetaRef.current;
        flushStudentWriteBuffer({
          trigger: "session_close",
          userProfile: snap.userProfile,
          sessionMeta: {
            testId: snap.session.testId,
            testTitle: snap.session.title,
            testType: snap.session.testType || (snap.session.source as string),
            timeSpentSeconds: snap.elapsedSeconds,
            isAdminPreview: snap.session.isAdminPreview,
          },
        }).catch(() => {});
      }
    };
  }, []);

  // Test Timer with single source of truth & timestamp calculation
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  latestSessionMetaRef.current.elapsedSeconds = elapsedSeconds;
  const sessionStartTimeRef = useRef<number | null>(null);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const hasSubmittedRef = useRef<boolean>(false);
  const isNavigatingRef = useRef<boolean>(false);

  // Per-question timing tracking (seconds)
  const questionStartTimeRef = useRef<number>(Date.now());
  const questionElapsedBeforeInactiveRef = useRef<number>(0);
  const [questionTimes, setQuestionTimes] = useState<Record<string, number>>({});

  // Confirmation dialogs in Test Mode
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);

  // Review & Visited states for Live / PYQ tests
  const [reviewStates, setReviewStates] = useState<Record<string, boolean>>({});
  const [visitedStates, setVisitedStates] = useState<Record<string, boolean>>({});

  // Shuffle questions toggle state
  const [shuffleQuestions, setShuffleQuestions] = useState<boolean>(() =>
    Boolean(session.shuffleQuestions ?? settings.shuffleQuestions ?? false)
  );

  // Results screen filter in Test Mode
  const [analyticsFilter, setAnalyticsFilter] = useState<"all" | "correct" | "wrong" | "skipped">("all");

  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportingQuestion, setReportingQuestion] = useState<Question | null>(null);

  // Shuffled options order map: questionId -> array of original indices
  const [shuffledOptionsOrder, setShuffledOptionsOrder] = useState<Record<string, number[]>>({});

  // Effective combined questions map resolving embedded Live Test & PYQ questions
  const effectiveQuestionsMap = useMemo(() => {
    const map: Record<string, Question> = {
      ...QUESTIONS_MAP,
      ...(questionsMap || {}),
    };

    // Include any questions from cloudCacheQuestions & customQuestions in local storage
    try {
      const storeRaw = localStorage.getItem("economic_survey_user_questions_v2");
      if (storeRaw) {
        const store = JSON.parse(storeRaw);
        const storeQs = [...(store.customQuestions || []), ...(store.cloudCacheQuestions || [])];
        storeQs.forEach((q: any) => {
          if (q && q.id && !map[q.id] && (q.text || q.question) && Array.isArray(q.options) && q.options.length >= 2) {
            map[q.id] = q;
          }
        });
      }
    } catch {}

    const embedded = [
      ...(session.extraQuestions || []),
      ...(session.liveTestDetails?.questions || []),
      ...(session.pyqDetails?.questions || []),
    ];

    embedded.forEach((q, idx) => {
      if (q && (q.text || (q as any).question) && Array.isArray(q.options) && q.options.length >= 2) {
        const id = q.id || `embedded_q_${idx}`;
        map[id] = { ...q, id };
      }
    });

    if (Object.keys(serverGradedQuestions).length > 0) {
      Object.entries(serverGradedQuestions).forEach(([qId, graded]) => {
        if (map[qId]) {
          map[qId] = {
            ...map[qId],
            correctIndex: graded.correctIndex,
            ...(graded.explanation ? { explanation: graded.explanation } : {}),
            ...(graded.importantFact ? { importantFact: graded.importantFact } : {}),
          };
        }
      });
    }

    return map;
  }, [questionsMap, session.extraQuestions, session.liveTestDetails, session.pyqDetails, serverGradedQuestions]);

  const allSessionQuestionIds = useMemo(() => {
    let ids: string[] = [];
    if (session.questionIds && session.questionIds.length > 0) {
      ids = session.questionIds;
    } else {
      const embedded = [
        ...(session.extraQuestions || []),
        ...(session.liveTestDetails?.questions || []),
        ...(session.pyqDetails?.questions || []),
      ];
      ids = embedded.map((q, idx) => q.id || `embedded_q_${idx}`);
    }

    // Fallback: If still empty, search questionsMap for matching topicId or chapterId
    if (ids.length === 0 && (session.topicId || session.chapterId)) {
      const allQs = Object.values(questionsMap || {});
      const matched = allQs.filter(
        q => (session.topicId && (q.topicId === session.topicId || (q as any).topic === session.topicId)) ||
             (session.chapterId && (q.chapterId === session.chapterId || (q as any).chapter === session.chapterId))
      );
      if (matched.length > 0) {
        ids = matched.map((q, idx) => q.id || `fallback_q_${idx}`);
      }
    }

    return ids;
  }, [session.questionIds, session.extraQuestions, session.liveTestDetails, session.pyqDetails, session.topicId, session.chapterId, questionsMap]);

  // Helper to shuffle options while keeping "All of the above" type options at the bottom
  const getShuffledOptionIndices = (options: string[], q?: Question | any) => {
    if (!Array.isArray(options) || options.length === 0) {
      return [0, 1, 2, 3];
    }
    const indices = options.map((_, i) => i);

    if (q) {
      const qType = ((q.questionType || q.type) as string || "").toLowerCase();
      const textLower = (q.text || "").toLowerCase();

      // Rule 5: Option shuffling MUST be OFF for assertion_reason, match_list, and statement_based questions
      const isNonShufflableType = 
        qType.includes("assertion") || 
        qType.includes("match") || 
        qType.includes("statement") || 
        qType.includes("sequence") ||
        qType.includes("pair") ||
        textLower.includes("कथन") ||
        textLower.includes("सूची-i") ||
        textLower.includes("list-i") ||
        textLower.includes("अभिकथन") ||
        textLower.includes("assertion") ||
        textLower.includes("match list");

      if (isNonShufflableType) {
        return indices;
      }
    }
    
    // Check if any option refers to other options by label (e.g. "Both A and B", "Only 1 and 2")
    const refersToOtherOptions = options.some(text => 
      /\b[Oo]ption\s+[A-D]\b/.test(text) || 
      /\b[Aa]\s+and\s+[Bb]\b/.test(text) || 
      /\b[Bb]\s+and\s+[Cc]\b/.test(text) ||
      /\b[Aa],\s*[Bb]\s+and\s*[Cc]\b/.test(text) ||
      /\b[विकल्प]\s+[A-D]\b/.test(text) ||
      /\b[क]\s+और\s+[ख]\b/.test(text)
    );

    if (refersToOtherOptions) {
      return indices;
    }

    const bottomKeywords = [
      "all of the above", "none of the above", "above mentioned",
      "उपरोक्त सभी", "इनमें से कोई नहीं", "उपरोक्त में से कोई नहीं",
      "अनुत्तरित प्रश्न", "question not attempted"
    ];
    
    const bottomIndices: number[] = [];
    const shufflableIndices: number[] = [];
    
    indices.forEach(i => {
      const text = options[i].toLowerCase();
      if (bottomKeywords.some(kw => text.includes(kw))) {
        bottomIndices.push(i);
      } else {
        shufflableIndices.push(i);
      }
    });
    
    return [...shuffleArray(shufflableIndices), ...bottomIndices];
  };

  // Format time utility (Supports HH:MM:SS and MM:SS without string concatenation)
  const formatTime = (totalSeconds: number) => {
    const safeSecs = Math.max(0, Math.floor(Number(totalSeconds) || 0));
    const hrs = Math.floor(safeSecs / 3600);
    const mins = Math.floor((safeSecs % 3600) / 60);
    const secs = safeSecs % 60;
    if (hrs > 0) {
      return `${String(hrs).padStart(2, "0")}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
    }
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };

  // Timer effect using single source of truth & real timestamp-based calculation
  useEffect(() => {
    if (!isStarted || isCompleted || hasSubmittedRef.current) {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
      return;
    }

    if (sessionStartTimeRef.current === null) {
      sessionStartTimeRef.current = Date.now();
    }

    const tick = () => {
      if (hasSubmittedRef.current || sessionStartTimeRef.current === null) return;
      const now = Date.now();
      const currentElapsed = Math.max(0, Math.floor((now - sessionStartTimeRef.current) / 1000));
      setElapsedSeconds(currentElapsed);
    };

    tick();

    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
    }
    timerIntervalRef.current = setInterval(tick, 1000);

    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
    };
  }, [isStarted, isCompleted]);

  // Tab visibility listener for accurate active time tracking & timer resync
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        questionElapsedBeforeInactiveRef.current += Math.max(
          0,
          (Date.now() - questionStartTimeRef.current) / 1000
        );
      } else {
        questionStartTimeRef.current = Date.now();
        // Immediately sync elapsed timer from timestamp when user returns to tab
        if (isStarted && !isCompleted && !hasSubmittedRef.current && sessionStartTimeRef.current !== null) {
          const currentElapsed = Math.max(0, Math.floor((Date.now() - sessionStartTimeRef.current) / 1000));
          setElapsedSeconds(currentElapsed);
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [isStarted, isCompleted]);

  // Reset per-question timing timer when currentIndex or session start changes
  useEffect(() => {
    questionStartTimeRef.current = Date.now();
    questionElapsedBeforeInactiveRef.current = 0;
  }, [currentIndex, isStarted]);

  const calculateQuestionElapsedSeconds = (): number => {
    const activeElapsed = (Date.now() - questionStartTimeRef.current) / 1000;
    const total = questionElapsedBeforeInactiveRef.current + activeElapsed;
    // Bound reasonably between 1s and 120s
    return Math.max(1, Math.min(120, Math.round(total)));
  };

  // Clean up auto-advance timer on unmount
  useEffect(() => {
    return () => {
      if (autoAdvanceTimeoutRef.current) {
        clearTimeout(autoAdvanceTimeoutRef.current);
      }
    };
  }, []);

  // Android hardware Back button protection during active timed test/exam mode
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!isExamMode || isCompleted) return;

    // Push a sentinel history entry to intercept accidental Android Back button presses
    const sentinelState = { dishaTestActive: true, quizProTestActive: true, timestamp: Date.now() };
    window.history.pushState(sentinelState, "", window.location.href);

    const handleTestPopState = () => {
      // 1. If any drawer or internal overlay is open, close that first and keep test guarded
      if (showPalette) {
        setShowPalette(false);
        window.history.pushState(sentinelState, "", window.location.href);
        return;
      }
      if (showSettingsModal) {
        setShowSettingsModal(false);
        window.history.pushState(sentinelState, "", window.location.href);
        return;
      }
      if (showSubmitConfirm) {
        setShowSubmitConfirm(false);
        window.history.pushState(sentinelState, "", window.location.href);
        return;
      }

      // 2. If exit confirmation dialog is ALREADY showing, this is the user's SECOND back press.
      // Under Requirement 5: "Do not trap the user in an infinite loop where Back does nothing. (A second Back press or explicit exit should always work)."
      // Allow exit cleanly!
      if (showExitConfirm) {
        setShowExitConfirm(false);
        onClose();
        return;
      }

      // 3. First back press: prompt with in-app confirmation dialog and re-push sentinel so test remains intact
      setShowExitConfirm(true);
      window.history.pushState(sentinelState, "", window.location.href);
    };

    window.addEventListener("popstate", handleTestPopState);
    return () => {
      window.removeEventListener("popstate", handleTestPopState);
    };
  }, [isExamMode, isCompleted, showExitConfirm, showPalette, showSettingsModal, showSubmitConfirm, onClose]);

  // Stable unique session identity key
  const sessionKey = useMemo(() => {
    return (
      session.testId ||
      session.liveTestDetails?.id ||
      session.pyqDetails?.id ||
      `${session.source}_${session.chapterId || ""}_${session.topicId || ""}_${session.title}_${session.isTestMode ? "test" : "practice"}`
    );
  }, [
    session.testId,
    session.liveTestDetails?.id,
    session.pyqDetails?.id,
    session.source,
    session.chapterId,
    session.topicId,
    session.title,
    session.isTestMode,
  ]);

  const activeSessionKeyRef = useRef<string | null>(null);

  // Reset when session changes (guarded strictly by sessionKey to prevent mid-session re-shuffle or index/timer reset)
  useEffect(() => {
    if (activeSessionKeyRef.current === sessionKey) {
      // Session has not changed; do not reset mid-session state
      return;
    }
    activeSessionKeyRef.current = sessionKey;

    const initialShuffle = Boolean(session.shuffleQuestions ?? settings.shuffleQuestions ?? false);
    setShuffleQuestions(initialShuffle);

    const candidateIds = allSessionQuestionIds && allSessionQuestionIds.length > 0
      ? allSessionQuestionIds
      : (session.questionIds || []);
    const uniqueIds = Array.from(new Set(candidateIds.filter(Boolean)));
    const newQuestionIds = initialShuffle ? shuffleArray([...uniqueIds]) : [...uniqueIds];
    setActiveQuestionIds(newQuestionIds);

    // Pre-shuffle options for all questions in the session
    const newShuffledOptions: Record<string, number[]> = {};
    uniqueIds.forEach((id) => {
      const q = effectiveQuestionsMap[id] || questionsMap[id] || QUESTIONS_MAP[id];
      if (q && Array.isArray(q.options) && q.options.length > 0) {
        newShuffledOptions[id] = getShuffledOptionIndices(q.options, q);
      }
    });
    setShuffledOptionsOrder(newShuffledOptions);

    const willStart = session.source === "topic" || !isExamMode;
    setIsStarted(willStart);
    setCurrentIndex(0);
    setSelectedOptionIndex(null);
    setIsSubmitted(false);
    setIsCompleted(false);
    setSessionResults({});
    setReviewStates({});
    setVisitedStates({});
    setElapsedSeconds(0);
    setIsAdvancing(false);
    setShowExitConfirm(false);
    setShowSubmitConfirm(false);
    setAnalyticsFilter("all");
    hasSubmittedRef.current = false;
    sessionStartTimeRef.current = willStart ? Date.now() : null;
    questionStartTimeRef.current = Date.now();
    questionElapsedBeforeInactiveRef.current = 0;
    if (autoAdvanceTimeoutRef.current) {
      clearTimeout(autoAdvanceTimeoutRef.current);
      autoAdvanceTimeoutRef.current = null;
    }
  }, [sessionKey]);

  // Handle late-loading questions for the current session
  useEffect(() => {
    if (!isStarted && !isCompleted) return;
    
    let hasUpdates = false;
    const nextShuffledOptions = { ...shuffledOptionsOrder };
    
    allSessionQuestionIds.forEach(id => {
      if (!nextShuffledOptions[id]) {
        const q = effectiveQuestionsMap[id] || questionsMap[id] || QUESTIONS_MAP[id];
        if (q && Array.isArray(q.options) && q.options.length > 0) {
          nextShuffledOptions[id] = getShuffledOptionIndices(q.options, q);
          hasUpdates = true;
        }
      }
    });
    
    if (hasUpdates) {
      setShuffledOptionsOrder(nextShuffledOptions);
    }
  }, [effectiveQuestionsMap, allSessionQuestionIds, questionsMap]);

  // Base raw questions from session
  const baseQuestions: Question[] = useMemo(() => {
    const raw = allSessionQuestionIds
      .map((id) => effectiveQuestionsMap[id] || questionsMap[id] || QUESTIONS_MAP[id])
      .filter((q): q is Question => Boolean(q));
    const deduped = new Map<string, Question>();
    raw.forEach(q => deduped.set(q.id, q));
    return Array.from(deduped.values());
  }, [allSessionQuestionIds, effectiveQuestionsMap, questionsMap]);

  // Active ordered questions (guaranteed 1-to-1 mapped with activeQuestionIds, immune to async loading shift)
  const questions: Question[] = useMemo(() => {
    const isFullQ = (q: any): boolean =>
      Boolean(q && (q.text || (q as any).question) && Array.isArray(q.options) && q.options.length >= 2);

    const list = activeQuestionIds.map((id) => {
      const q = effectiveQuestionsMap[id] || questionsMap[id] || QUESTIONS_MAP[id];
      if (isFullQ(q)) {
        return { ...q, id: q.id || id };
      }
      return {
        id,
        text: (q as any)?.text || "लोड हो रहा है... (Loading question...)",
        options: Array.isArray(q?.options) && q.options.length >= 2 ? q.options : ["(A)", "(B)", "(C)", "(D)"],
        correctIndex: q?.correctIndex ?? 0,
        explanation: q?.explanation || "",
      } as Question;
    });

    if (list.length === 0 && session.extraQuestions && session.extraQuestions.length > 0) {
      return session.extraQuestions
        .filter(isFullQ)
        .map((q, idx) => ({ ...q, id: q.id || `extra_q_${idx}` }));
    }
    return list;
  }, [activeQuestionIds, effectiveQuestionsMap, questionsMap, session.extraQuestions]);

  // Trigger Framer-Motion Confetti celebration when a student completes a full MCQ session with 100% accuracy
  useEffect(() => {
    if (isCompleted && !hasTriggered100CelebrationRef.current) {
      const totalAttempted = Object.keys(sessionResults).length;
      const totalCorrect = Object.values(sessionResults).filter((r) => r.isCorrect).length;
      const isFullSession = questions.length > 0 && totalAttempted === questions.length;
      const is100Accuracy = isFullSession && totalCorrect === questions.length;

      if (is100Accuracy) {
        hasTriggered100CelebrationRef.current = true;
        setShowPerfectCelebration(true);
      }
    }
  }, [isCompleted, sessionResults, questions.length]);

  const safeCurrentIndex = (questions && questions.length > 0)
    ? Math.max(0, Math.min(currentIndex, questions.length - 1))
    : 0;
  const currentQuestion = (questions && questions.length > 0)
    ? questions[safeCurrentIndex]
    : undefined;
  const currentProgress = currentQuestion && currentQuestion.id
    ? progressStore[currentQuestion.id]
    : undefined;
  const isBookmarked = Boolean(currentProgress?.bookmarked);

  // Derived titles
  const chapter = session.chapterId ? chaptersMap[session.chapterId] || CHAPTERS_MAP[session.chapterId] : null;
  const displayTitle = chapter ? chapter.title : session.title;

  // Derived question metadata for per-question analysis
  const currentChapter = useMemo(() => {
    if (!currentQuestion) return null;
    const chapId = currentQuestion.chapterId || session.chapterId;
    return chapId ? chaptersMap[chapId] || CHAPTERS_MAP[chapId] || null : null;
  }, [currentQuestion, session.chapterId, chaptersMap]);

  const currentTopic = useMemo(() => {
    if (!currentQuestion) return null;
    const topId = currentQuestion.topicId;
    if (topId && TOPICS_MAP[topId]) return TOPICS_MAP[topId];
    if (currentChapter && topId) {
      return (currentChapter.topics || []).find((t: any) => t.id === topId) || null;
    }
    return null;
  }, [currentChapter, currentQuestion]);

  const chapterDisplay = (currentQuestion as any)?.chapterName || currentChapter?.title || "";
  const topicDisplay = (currentQuestion as any)?.topicName || currentTopic?.title || "";
  const examDisplay = (currentQuestion as any)?.exam || (currentQuestion as any)?.examName || "";
  const yearDisplay = (currentQuestion as any)?.year || (currentQuestion as any)?.examYear;

  // Auto-scroll to top when question index changes
  useEffect(() => {
    const scrollEl = document.getElementById("mcq-content-scroll");
    if (scrollEl) {
      scrollEl.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [currentIndex]);

  // Options letter labels (Supports RPSC 5-option standard)
  const optionLabels = ["A", "B", "C", "D", "E"];

  // Option list respecting shuffleOptions setting and RPSC 5th Option
  const displayedOptions = useMemo(() => {
    if (!currentQuestion) return [];
    
    let baseOptions: string[] = Array.isArray(currentQuestion.options) && currentQuestion.options.length > 0
      ? [...currentQuestion.options]
      : ["(A)", "(B)", "(C)", "(D)"];

    // For match-the-following, sometimes the raw options array includes the list items themselves.
    const qType = currentQuestion.questionType?.toLowerCase() || "";
    const isMatch = qType === "match_following" || qType === "match_column" || qType === "match" || qType === "pair_based" || qType === "pairs";
    
    if (isMatch) {
      const looksLikePairing = (text: string) => /[-–—]/.test(text) || /\([a-z]\)/i.test(text) || /,\s*\d+/.test(text);
      const pairings = baseOptions.filter(looksLikePairing);
      if (pairings.length >= 2) {
        baseOptions = pairings;
      } else if (baseOptions.length > 4) {
        baseOptions = baseOptions.slice(-4);
      }
    }

    // RPSC 5th Option standard: append Option E if question has 4 options
    if (baseOptions.length === 4) {
      baseOptions.push("अनुत्तरित प्रश्न (Question not attempted)");
    }

    // Map to objects with original index
    const base = baseOptions.map((text, idx) => ({
      text,
      originalIndex: idx,
    }));

    // Apply shuffled order if available for this question, keeping Option E at the end
    const order = shuffledOptionsOrder[currentQuestion.id];
    if (order && order.length === base.length) {
      return order.map(originalIdx => base[originalIdx]);
    }
    if (order && base.length === 5 && order.length === 4) {
      return [...order.map(originalIdx => base[originalIdx]), base[4]];
    }

    return base;
  }, [currentQuestion?.id, currentQuestion?.options, shuffledOptionsOrder]);

  // Filter questions for the detailed analytics section
  const filteredAnalyticsQuestions = useMemo(() => {
    const list = questions.filter((q) => {
      const res = sessionResults[q.id];
      if (analyticsFilter === "correct") return res?.isCorrect === true;
      if (analyticsFilter === "wrong") return res && !res.isCorrect;
      if (analyticsFilter === "skipped") return !res;
      return true;
    });
    const deduped = new Map<string, Question>();
    list.forEach(q => deduped.set(q.id, q));
    return Array.from(deduped.values());
  }, [questions, sessionResults, analyticsFilter]);

  // Toggle shuffle questions in setup view
  const handleToggleShuffleQuestions = () => {
    const nextVal = !shuffleQuestions;
    setShuffleQuestions(nextVal);
    onUpdateSettings?.({ shuffleQuestions: nextVal });
  };

  // Start the session with current setup preferences
  const handleStartSession = () => {
    const candidateIds = allSessionQuestionIds && allSessionQuestionIds.length > 0 
      ? allSessionQuestionIds 
      : (session.questionIds || []);
    const uniqueIds = Array.from(new Set(candidateIds));
    if (shuffleQuestions) {
      setActiveQuestionIds(shuffleArray(uniqueIds));
    } else {
      setActiveQuestionIds(uniqueIds);
    }

    // Fresh shuffle for options at every explicit session start
    const newShuffledOptions: Record<string, number[]> = {};
    uniqueIds.forEach(id => {
      const q = effectiveQuestionsMap[id] || questionsMap[id] || QUESTIONS_MAP[id];
      if (q && Array.isArray(q.options) && q.options.length > 0) {
        newShuffledOptions[id] = getShuffledOptionIndices(q.options, q);
      }
    });
    setShuffledOptionsOrder(newShuffledOptions);

    setCurrentIndex(0);
    setSelectedOptionIndex(null);
    setIsSubmitted(false);
    hasSubmittedRef.current = false;
    sessionStartTimeRef.current = Date.now();
    questionStartTimeRef.current = Date.now();
    questionElapsedBeforeInactiveRef.current = 0;
    setElapsedSeconds(0);
    setIsStarted(true);
  };

  // Allow toggling shuffle mid-session or re-shuffling remaining (for non-test mode)
  const handleInSessionShuffleToggle = () => {
    const nextShuffle = !shuffleQuestions;
    setShuffleQuestions(nextShuffle);
    onUpdateSettings?.({ shuffleQuestions: nextShuffle });
    if (nextShuffle) {
      const answered = activeQuestionIds.slice(0, currentIndex + 1);
      const remaining = activeQuestionIds.slice(currentIndex + 1);
      const shuffledRemaining = shuffleArray(remaining);
      setActiveQuestionIds([...answered, ...shuffledRemaining]);
    } else {
      const answeredSet = new Set(activeQuestionIds.slice(0, currentIndex + 1));
      const remainingOriginal = session.questionIds.filter((id) => !answeredSet.has(id));
      setActiveQuestionIds([...activeQuestionIds.slice(0, currentIndex + 1), ...remainingOriginal]);
    }
  };

  // Typography sizing classes from settings (Compact refinement: Reduced by exactly 20%)
  const questionFontSizeClass =
    settings.textSize === "S"
      ? "text-[0.965rem] sm:text-[1.03rem] leading-snug font-bold"
      : settings.textSize === "L"
      ? "text-[1.24rem] sm:text-[1.37rem] leading-snug font-black"
      : "text-[1.10rem] sm:text-[1.22rem] leading-snug font-extrabold";

  const optionFontSizeClass =
    settings.textSize === "S"
      ? "text-[0.87rem] sm:text-[0.92rem] leading-snug font-bold"
      : settings.textSize === "L"
      ? "text-[1.03rem] sm:text-[1.15rem] leading-snug font-extrabold"
      : "text-[0.965rem] sm:text-[1.03rem] leading-snug font-bold";

  // Progress percentage
  const totalQuestions = questions.length;
  const answeredCountInTest = Object.keys(sessionResults).length;
  const progressPercent = Math.round(
    isTestMode
      ? ((currentIndex + 1) / Math.max(1, totalQuestions)) * 100
      : ((currentIndex + (isSubmitted ? 1 : 0)) / Math.max(1, totalQuestions)) * 100
  );

  // ────────────────── TEST MODE: SELECT OPTION & AUTO ADVANCE ──────────────────
  // "question attend krte hi next Q Ana chahiye acotamtic"
  const handleOptionSelectTestMode = (selectedOriginalIndex: number) => {
    if (isAdvancing || !currentQuestion) return;

    setSelectedOptionIndex(selectedOriginalIndex);
    const isUnattemptedE = selectedOriginalIndex === 4;
    const isCorrect = isLiveTestSession
      ? false
      : (!isUnattemptedE && selectedOriginalIndex === currentQuestion.correctIndex);

    const timeSpent = calculateQuestionElapsedSeconds();
    setQuestionTimes((prev) => ({
      ...prev,
      [currentQuestion.id]: timeSpent,
    }));

    // Record in session results
    const nextEntry = {
      selectedIndex: selectedOriginalIndex,
      isCorrect,
      isUnattemptedE,
      isSubmitted: true,
    };
    const nextResultsSnapshot = {
      ...sessionResults,
      [currentQuestion.id]: nextEntry,
    };
    setSessionResults(nextResultsSnapshot);

    // Record attempt immediately only for non-live tests (Live Tests grade server-side on submit)
    hasRecordedAnswersRef.current = true;
    if (!isLiveTestSession) {
      recordQuestionAttempt(
        {
          questionId: currentQuestion.id,
          testId: session.testId,
          subjectId: session.subjectId,
          chapterId: currentQuestion.chapterId,
          topicId: currentQuestion.topicId,
          timeTakenSeconds: timeSpent,
          isCorrect,
          selectedOption: optionLabels[selectedOriginalIndex] || String(selectedOriginalIndex),
          correctOption: optionLabels[currentQuestion.correctIndex] || String(currentQuestion.correctIndex),
        },
        { isAdminPreview: session.isAdminPreview }
      );

      // Update progress store only if candidate actually answered (not unattempted Option E)
      if (!isUnattemptedE) {
        onUpdateProgress(currentQuestion.id, isCorrect, selectedOriginalIndex);
      }
    }

    // Play neutral click sound in Exam Mode (DO NOT reveal correct/wrong audio during exam)
    playClickSound(settings.soundEffects !== false);
    triggerHaptic("light", settings.hapticFeedback !== false);

    setIsAdvancing(true);

    // Auto-advance after 260ms for smooth tactile confirmation
    if (autoAdvanceTimeoutRef.current) {
      clearTimeout(autoAdvanceTimeoutRef.current);
    }

    autoAdvanceTimeoutRef.current = setTimeout(() => {
      setIsAdvancing(false);
      if (currentIndex < questions.length - 1) {
        const nextIdx = currentIndex + 1;
        setCurrentIndex(nextIdx);
        // Pre-load answered choice if revisiting
        const nextQ = questions[nextIdx];
        const prevAnswer = nextResultsSnapshot[nextQ?.id]?.selectedIndex;
        setSelectedOptionIndex(prevAnswer !== undefined ? prevAnswer : null);
      } else {
        // Last question answered - Check if any previous questions were skipped
        const unansweredIdx = questions.findIndex(q => !nextResultsSnapshot[q.id]);
        if (unansweredIdx !== -1) {
          handleNavigateQuestionTestMode(unansweredIdx);
        } else {
          if (isLiveTestSession) {
            handleConfirmSubmitTest(nextResultsSnapshot);
            return;
          }
          // All answered - Complete test & flush buffered student writes
          if (timerIntervalRef.current) {
            clearInterval(timerIntervalRef.current);
            timerIntervalRef.current = null;
          }
          hasSubmittedRef.current = true;
          setIsCompleted(true);
          flushStudentWriteBuffer({
            trigger: "session_complete",
            userProfile,
            sessionMeta: {
              testId: session.testId,
              testTitle: session.title,
              testType: session.testType || (session.source as string),
              timeSpentSeconds: elapsedSeconds,
              isAdminPreview: session.isAdminPreview,
            },
          }).catch(() => {});
          if (typeof window !== 'undefined' && isExamMode) {
            window.history.back();
          }
          try {
            confetti({
              particleCount: 45,
              spread: 60,
              origin: { y: 0.7 },
            });
          } catch (e) {
            // Safe fail
          }
        }
      }
    }, 260);
  };

  // Jump/Navigate between questions in Test Mode
  const handleNavigateQuestionTestMode = (targetIndex: number) => {
    if (targetIndex < 0 || targetIndex >= questions.length) return;
    if (autoAdvanceTimeoutRef.current) {
      clearTimeout(autoAdvanceTimeoutRef.current);
      autoAdvanceTimeoutRef.current = null;
    }
    setIsAdvancing(false);
    setCurrentIndex(targetIndex);
    const targetQ = questions[targetIndex];
    const prevAnswer = sessionResults[targetQ?.id]?.selectedIndex;
    setSelectedOptionIndex(prevAnswer !== undefined ? prevAnswer : null);
  };

  // Skip current question in Test Mode
  const handleSkipQuestionTestMode = () => {
    if (autoAdvanceTimeoutRef.current) {
      clearTimeout(autoAdvanceTimeoutRef.current);
      autoAdvanceTimeoutRef.current = null;
    }
    setIsAdvancing(false);
    if (currentIndex < questions.length - 1) {
      const nextIdx = currentIndex + 1;
      setCurrentIndex(nextIdx);
      const nextQ = questions[nextIdx];
      const prevAnswer = sessionResults[nextQ?.id]?.selectedIndex;
      setSelectedOptionIndex(prevAnswer !== undefined ? prevAnswer : null);
    } else {
      // Trying to skip/finish on last question - check for unanswered
      const unansweredIdx = questions.findIndex(q => !sessionResults[q.id]);
      if (unansweredIdx !== -1 && unansweredIdx !== currentIndex) {
        handleNavigateQuestionTestMode(unansweredIdx);
      } else {
        setShowSubmitConfirm(true);
      }
    }
  };

  // Finish/Submit Test Mode immediately
  const handleConfirmSubmitTest = async (
    overrideResults?: Record<string, { selectedIndex: number; isCorrect: boolean; isSubmitted: boolean }>
  ) => {
    if (hasSubmittedRef.current) return;
    hasSubmittedRef.current = true;
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }

    // 1. Immediately hide dialogs and show results screen via state
    setShowSubmitConfirm(false);
    setShowExitConfirm(false);
    if (autoAdvanceTimeoutRef.current) {
      clearTimeout(autoAdvanceTimeoutRef.current);
      autoAdvanceTimeoutRef.current = null;
    }
    setIsAdvancing(false);
    setIsCompleted(true);
    if (!isLiveTestSession) {
      flushStudentWriteBuffer({
        trigger: "test_submission",
        userProfile,
        sessionMeta: {
          testId: session.testId,
          testTitle: session.title,
          testType: session.testType || (session.source as string),
          timeSpentSeconds: elapsedSeconds,
          isAdminPreview: session.isAdminPreview,
        },
      }).catch(() => {});
    }

    if (typeof window !== "undefined" && window.history.state && (window.history.state.dishaTestActive || window.history.state.quizProTestActive)) {
      window.history.replaceState({ dishaTestCompleted: true, quizProTestCompleted: true }, "", window.location.href);
    }

    // 2. Local state capture for the submission payload
    const currentResults = { ...(overrideResults || sessionResults) };
    if (currentQuestion && selectedOptionIndex !== null && !currentResults[currentQuestion.id]) {
      const isCorrect = isLiveTestSession
        ? false
        : selectedOptionIndex === currentQuestion.correctIndex;
      currentResults[currentQuestion.id] = {
        selectedIndex: selectedOptionIndex,
        isCorrect,
        isSubmitted: true,
      };
      setSessionResults((prev) => ({ ...prev, [currentQuestion.id]: currentResults[currentQuestion.id] }));
    }

    const totalAttempted = Object.keys(currentResults).length;
    const totalCorrect = Object.values(currentResults).filter((r) => r.isCorrect).length;
    const totalWrong = totalAttempted - totalCorrect;
    const totalSkipped = Math.max(0, questions.length - totalAttempted);
    const sessionAccuracy = totalAttempted > 0 ? Math.round((totalCorrect / totalAttempted) * 100) : 0;

    // 3. Initiate authoritative server grading / cloud sync
    console.log("[MCQSession] Starting submission process...", {
      testType: session.testType,
      isLive: session.isLiveTest,
      isPYQ: session.isPYQ,
      totalAttempted
    });

    try {
      if (isLiveTestSession) {
        const testId = session.testId || session.liveTestDetails?.id || session.title;
        const subId = `sub_${userProfile?.id || 'guest'}_${testId}_${Date.now()}`;
        const answersMap: Record<string, number> = {};
        Object.entries(currentResults).forEach(([qId, res]) => {
          if (res && typeof res.selectedIndex === "number" && res.selectedIndex >= 0) {
            answersMap[qId] = res.selectedIndex;
          }
        });

        setIsSubmittingLiveTest(true);
        setLiveSubmitError(null);
        try {
          const response = await apiFetch(`/api/live-tests/${encodeURIComponent(testId)}/submit`, {
            method: "POST",
            body: JSON.stringify({
              submissionId: subId,
              answers: answersMap,
              timeSpentSeconds: elapsedSeconds,
              userName: userProfile?.name || "Aspirant",
            }),
          });

          const data = await response.json().catch(() => ({}));
          if (!response.ok || !data?.success) {
            setLiveSubmitError(data?.error || `Server grading failed (HTTP ${response.status}).`);
          } else {
            if (data.submission) {
              setServerLiveSubmission(data.submission);
              const { loadLocalLiveSubmissions, saveLocalLiveSubmissions } = await import("../utils/liveTestStorage");
              const existingLocal = loadLocalLiveSubmissions().filter(
                (s) => s.submissionId !== data.submission.submissionId
              );
              saveLocalLiveSubmissions([data.submission, ...existingLocal]);
            }

            if (data.results && typeof data.results === "object") {
              const gradedSessionResults: Record<string, { selectedIndex: number; isCorrect: boolean; isSubmitted: boolean }> = {};
              const gradedQMeta: Record<string, { correctIndex: number; explanation?: string; importantFact?: string }> = {};

              Object.entries(data.results as Record<string, any>).forEach(([qId, r]) => {
                if (typeof r?.correctIndex === "number") {
                  gradedQMeta[qId] = {
                    correctIndex: r.correctIndex,
                    ...(r.explanation ? { explanation: r.explanation } : {}),
                    ...(r.importantFact ? { importantFact: r.importantFact } : {}),
                  };
                }
                if (typeof r?.selectedIndex === "number" && r.selectedIndex >= 0) {
                  const wasCorrect = Boolean(r.isCorrect);
                  gradedSessionResults[qId] = {
                    selectedIndex: r.selectedIndex,
                    isCorrect: wasCorrect,
                    isSubmitted: true,
                  };
                  const qObj = questions.find((item) => item.id === qId);
                  recordQuestionAttempt(
                    {
                      questionId: qId,
                      testId: session.testId,
                      subjectId: session.subjectId,
                      chapterId: qObj?.chapterId || session.chapterId || "",
                      topicId: qObj?.topicId || session.topicId || "",
                      timeTakenSeconds: questionTimes[qId] || 1,
                      isCorrect: wasCorrect,
                      selectedOption: optionLabels[r.selectedIndex] || String(r.selectedIndex),
                      correctOption: optionLabels[r.correctIndex] || String(r.correctIndex),
                    },
                    { isAdminPreview: session.isAdminPreview }
                  );
                  onUpdateProgress(qId, wasCorrect, r.selectedIndex);
                }
              });

              setServerGradedQuestions(gradedQMeta);
              setSessionResults((prev) => ({ ...prev, ...gradedSessionResults }));
              flushStudentWriteBuffer({
                trigger: "test_submission",
                userProfile,
                sessionMeta: {
                  testId: session.testId,
                  testTitle: session.title,
                  testType: session.testType || (session.source as string),
                  timeSpentSeconds: elapsedSeconds,
                  isAdminPreview: session.isAdminPreview,
                },
              }).catch(() => {});
            }
          }
        } finally {
          setIsSubmittingLiveTest(false);
        }
      }

      if (session.isPYQ || session.pyqDetails || (session.source as any) === "pyq" || session.testType === "pyq") {
        const marksPerQ = session.marksPerQuestion || 1;
        const negMarksPerQ = session.negativeMarking ?? Number((marksPerQ / 3).toFixed(2));
        const rawScore = totalCorrect * marksPerQ - totalWrong * negMarksPerQ;
        const finalScore = Math.max(0, Number(rawScore.toFixed(2)));
        const paperId = session.pyqDetails?.id || session.testId || session.title;
        const paperTitle = session.pyqDetails?.title || session.title;
        const totalMarks = session.pyqDetails?.totalMarks || questions.length * marksPerQ;
        const attemptId = `pyq_att_${userProfile?.id || 'guest'}_${paperId}_${Date.now()}`;
        
        const selectedAnswers: Record<string, number> = {};
        Object.entries(currentResults).forEach(([qId, res]) => {
          if (res && res.selectedIndex !== undefined && res.selectedIndex !== null) {
            selectedAnswers[qId] = res.selectedIndex;
          }
        });

        const attempt = {
          attemptId,
          userId: userProfile?.id || 'guest_user',
          paperId,
          paperTitle,
          score: finalScore,
          totalMarks,
          correctCount: totalCorrect,
          wrongCount: totalWrong,
          unattemptedCount: totalSkipped,
          accuracy: sessionAccuracy,
          timeSpentSeconds: elapsedSeconds,
          attemptedAt: new Date().toISOString(),
          selectedAnswers,
        };

        const { recordPYQAttempt } = await import("../utils/pyqStorage");
        await recordPYQAttempt(attempt);
      }
      // Save unified Smart Test Result and Study Session Log locally
      const smartMarksPerQ = session.marksPerQuestion || (isLiveTestSession ? 2 : 1);
      const smartNegMarksPerQ = session.negativeMarking ?? (isLiveTestSession ? 0.66 : Number((smartMarksPerQ / 3).toFixed(2)));
      const rawSmartScore = totalCorrect * smartMarksPerQ - totalWrong * smartNegMarksPerQ;
      const finalSmartScore = Math.max(0, Number(rawSmartScore.toFixed(2)));

      const smartRecord: any = {
        testId: session.testId || `test_${Date.now()}`,
        title: session.title,
        testType: session.testType || (session.source as string) || "practice",
        totalQuestions: questions.length,
        attemptedQuestions: totalAttempted,
        correctAnswers: totalCorrect,
        wrongAnswers: totalWrong,
        skippedQuestions: totalSkipped,
        accuracy: sessionAccuracy,
        timeSpentSeconds: elapsedSeconds,
        completedAt: new Date().toISOString(),
        score: finalSmartScore,
        maxScore: Number((questions.length * smartMarksPerQ).toFixed(2)),
      };
      saveSmartTestRecord(smartRecord);


      import("../utils/localDatabaseEngine").then(({ recordLocalStudySession }) => {
        const uid = userProfile?.id || "guest";
        recordLocalStudySession({
          sessionId: `study_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          userId: uid,
          date: new Date().toISOString().slice(0, 10),
          subjectId: session.subjectId,
          topicId: session.topicId,
          durationMinutes: Math.max(1, Math.round(elapsedSeconds / 60)),
          timestamp: Date.now(),
          syncStatus: "pending",
        }).catch(() => {});
      }).catch(() => {});
    } catch (syncErr: any) {
      console.warn("[MCQSession] Submission background sync failed:", syncErr);
      if (isLiveTestSession) {
        setLiveSubmitError(syncErr?.message || "Failed to contact live test grading server.");
        setIsSubmittingLiveTest(false);
      }
    }
    
    // 4. Celebration Sequence
    const duration = 3 * 1000;
    const animationEnd = Date.now() + duration;
    const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 };
    const randomInRange = (min: number, max: number) => Math.random() * (max - min) + min;

    const interval: any = setInterval(function() {
      const timeLeft = animationEnd - Date.now();
      if (timeLeft <= 0) return clearInterval(interval);
      const particleCount = 50 * (timeLeft / duration);
      confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 } });
      confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 } });
    }, 250);
  };

  // ────────────────── STANDARD PRACTICE MODE HANDLERS ──────────────────
  // Exactly: Question → Answer (select option) → Result → Full Analysis → Next Question
  const handleSelectOptionPractice = (selectedOriginalIndex: number) => {
    if (isSubmitted || !currentQuestion) return;

    setSelectedOptionIndex(selectedOriginalIndex);
    setIsSubmitted(true);
    const isUnattemptedE = selectedOriginalIndex === 4;
    const isCorrect = !isUnattemptedE && selectedOriginalIndex === currentQuestion.correctIndex;

    const timeSpent = calculateQuestionElapsedSeconds();
    setQuestionTimes((prev) => ({
      ...prev,
      [currentQuestion.id]: timeSpent,
    }));

    setSessionResults((prev) => ({
      ...prev,
      [currentQuestion.id]: {
        selectedIndex: selectedOriginalIndex,
        isCorrect,
        isUnattemptedE,
        isSubmitted: true,
      },
    }));

    // Record attempt for smart performance analytics
    hasRecordedAnswersRef.current = true;
    recordQuestionAttempt(
      {
        questionId: currentQuestion.id,
        testId: session.testId,
        subjectId: session.subjectId,
        chapterId: currentQuestion.chapterId,
        topicId: currentQuestion.topicId,
        timeTakenSeconds: timeSpent,
        isCorrect,
        selectedOption: optionLabels[selectedOriginalIndex] || String(selectedOriginalIndex),
        correctOption: optionLabels[currentQuestion.correctIndex] || String(currentQuestion.correctIndex),
      },
      { isAdminPreview: session.isAdminPreview }
    );

    if (isUnattemptedE) {
      triggerHaptic("light", settings.hapticFeedback !== false);
    } else if (isCorrect) {
      playCorrectSound(settings.soundEffects !== false);
      triggerHaptic("success", settings.hapticFeedback !== false);
      try {
        confetti({
          particleCount: 25,
          spread: 45,
          origin: { y: 0.8 },
        });
      } catch (e) {
        // Safe fail
      }
    } else {
      playWrongSound(settings.soundEffects !== false);
      triggerHaptic("warning", settings.hapticFeedback !== false);
    }

    if (!isUnattemptedE) {
      onUpdateProgress(currentQuestion.id, isCorrect, selectedOriginalIndex);
    }
  };

  const handleNextQuestionPractice = () => {
    if (isNavigatingRef.current) return;
    isNavigatingRef.current = true;
    setTimeout(() => {
      isNavigatingRef.current = false;
    }, 120);

    if (currentIndex < questions.length - 1) {
      const nextIdx = currentIndex + 1;
      setCurrentIndex(nextIdx);
      
      // Restore state for next question if already visited
      const nextQ = questions[nextIdx];
      const prevResult = sessionResults[nextQ?.id];
      if (prevResult) {
        setSelectedOptionIndex(prevResult.selectedIndex);
        setIsSubmitted(prevResult.isSubmitted);
      } else {
        setSelectedOptionIndex(null);
        setIsSubmitted(false);
      }

      setTimeout(() => {
        const scrollEl = document.getElementById("mcq-content-scroll");
        if (scrollEl) {
          scrollEl.scrollTo({ top: 0, behavior: "smooth" });
        }
      }, 30);
    } else {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
      hasSubmittedRef.current = true;
      setIsCompleted(true);
      flushStudentWriteBuffer({
        trigger: "session_complete",
        userProfile,
        sessionMeta: {
          testId: session.testId,
          testTitle: session.title,
          testType: session.testType || (session.source as string),
          timeSpentSeconds: elapsedSeconds,
          isAdminPreview: session.isAdminPreview,
        },
      }).catch(() => {});
    }
  };

  const handlePrevQuestionPractice = () => {
    if (isNavigatingRef.current) return;
    isNavigatingRef.current = true;
    setTimeout(() => {
      isNavigatingRef.current = false;
    }, 120);

    if (currentIndex > 0) {
      const prevIdx = currentIndex - 1;
      setCurrentIndex(prevIdx);
      
      const prevQ = questions[prevIdx];
      const prevResult = sessionResults[prevQ?.id];
      if (prevResult) {
        setSelectedOptionIndex(prevResult.selectedIndex);
        setIsSubmitted(prevResult.isSubmitted);
      } else {
        setSelectedOptionIndex(null);
        setIsSubmitted(false);
      }

      setTimeout(() => {
        const scrollEl = document.getElementById("mcq-content-scroll");
        if (scrollEl) {
          scrollEl.scrollTo({ top: 0, behavior: "smooth" });
        }
      }, 30);
    }
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const targetTag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (targetTag === "input" || targetTag === "textarea") return;

      if (e.key === "Escape") {
        e.preventDefault();
        if (isTestMode && isStarted && !isCompleted) {
          setShowExitConfirm(true);
        } else {
          onClose();
        }
        return;
      }

      // If in setup view: Enter/Space starts session
      if (!isStarted) {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleStartSession();
          return;
        }
        return;
      }

      const key = e.key.toLowerCase();

      // Optional Bookmark shortcut via Ctrl+B / Cmd+B
      if ((e.ctrlKey || e.metaKey) && key === "b") {
        if (currentQuestion) {
          e.preventDefault();
          onToggleBookmark(currentQuestion.id);
        }
        return;
      }

      // Keys '1'-'5' or 'a'-'e' (case-insensitive) select option 0..4
      let optIdx: number | null = null;
      if (key === "1" || key === "a") optIdx = 0;
      else if (key === "2" || key === "b") optIdx = 1;
      else if (key === "3" || key === "c") optIdx = 2;
      else if (key === "4" || key === "d") optIdx = 3;
      else if (key === "5" || key === "e") optIdx = 4;

      if (optIdx !== null && optIdx < displayedOptions.length) {
        e.preventDefault();
        if (isTestMode) {
          handleOptionSelectTestMode(displayedOptions[optIdx].originalIndex);
        } else if (!isSubmitted) {
          handleSelectOptionPractice(displayedOptions[optIdx].originalIndex);
        }
        return;
      }

      if (e.key === "ArrowRight") {
        e.preventDefault();
        if (isTestMode) {
          handleSkipQuestionTestMode();
        } else if (isSubmitted || currentIndex < questions.length - 1) {
          handleNextQuestionPractice();
        }
        return;
      }

      if (e.key === "ArrowLeft") {
        e.preventDefault();
        if (isTestMode) {
          handleNavigateQuestionTestMode(currentIndex - 1);
        } else if (currentIndex > 0) {
          handlePrevQuestionPractice();
        }
        return;
      }

      // Space / Enter advances in practice mode after submission
      if (!isTestMode && isSubmitted && (e.key === "Enter" || e.key === " ")) {
        e.preventDefault();
        handleNextQuestionPractice();
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    isStarted,
    isCompleted,
    isTestMode,
    isSubmitted,
    selectedOptionIndex,
    currentIndex,
    questions.length,
    displayedOptions,
    currentQuestion,
  ]);

  // If questions empty
  if (questions.length === 0) {
    return (
      <div className="fixed inset-0 z-[100] bg-slate-50 dark:bg-[#0B1220] flex items-center justify-center p-6">
        <div className="bg-white dark:bg-[#111A2E] border border-slate-200 dark:border-slate-800 rounded-3xl p-6 text-center max-w-sm w-full space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 flex items-center justify-center mx-auto">
            <BookOpen className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-sm font-black text-slate-900 dark:text-white">
              {isLiveOrPYQTest ? "Live Test questions are being prepared" : "No MCQs currently available for this topic."}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {isLiveOrPYQTest ? "Questions are syncing. Click Retry to reload questions." : "No MCQs available for this topic yet."}
            </p>
          </div>
          <div className="flex items-center gap-2 pt-2">
            <button
              onClick={() => {
                if (onStartNewSession && session) {
                  onStartNewSession(session);
                } else {
                  window.location.reload();
                }
              }}
              className="flex-1 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold cursor-pointer transition-all"
            >
              Retry
            </button>
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold cursor-pointer transition-all"
            >
              Go Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ──────────────────────────────────────────────────────────────────────────
  // SCREEN: RESULTS & EACH QUESTION DETAILED ANALYTICS
  // "last me result, each question ANALYTICS daital me"
  // ──────────────────────────────────────────────────────────────────────────
  if (isCompleted) {
    if (isLiveOrPYQTest) {
      return (
        <RedesignedTestResultView
          session={session}
          questions={questions}
          sessionResults={sessionResults}
          elapsedSeconds={elapsedSeconds}
          questionTimes={questionTimes}
          shuffledOptionsOrder={shuffledOptionsOrder}
          progressStore={progressStore}
          userProfile={userProfile}
          onToggleBookmark={onToggleBookmark}
          onClose={onClose}
          onRestart={handleStartSession}
          serverSubmission={serverLiveSubmission}
          isGradingLiveTest={isSubmittingLiveTest}
          liveSubmitError={liveSubmitError}
        />
      );
    }

    const totalAttempted = Object.keys(sessionResults).length;
    const totalCorrect = Object.values(sessionResults).filter(
      (r) => r.isCorrect
    ).length;
    const totalWrong = totalAttempted - totalCorrect;
    const totalSkipped = questions.length - totalAttempted;
    const sessionAccuracy =
      totalAttempted > 0
        ? Math.round((totalCorrect / totalAttempted) * 100)
        : 0;
    const avgTimePerQuestion =
      totalAttempted > 0 ? (elapsedSeconds / totalAttempted).toFixed(1) : "0";

    const wrongQuestionIds = questions
      .filter((q) => sessionResults[q.id] && !sessionResults[q.id].isCorrect)
      .map((q) => q.id);

    const perfStore = loadPerformanceStore(progressStore);

    // Categorize performance insights
    const needPracticeQuestions = questions.filter((q) => {
      const res = sessionResults[q.id];
      if (res && !res.isCorrect) return true;
      const perf = perfStore[q.id];
      return (perf?.smartPriorityScore || 0) >= 60;
    });

    const slowRecallQuestions = questions.filter((q) => {
      const res = sessionResults[q.id];
      const time = questionTimes[q.id] || 0;
      return res?.isCorrect && time >= 35;
    });

    const performingWellQuestions = questions.filter((q) => {
      const res = sessionResults[q.id];
      const time = questionTimes[q.id] || 0;
      return res?.isCorrect && time < 25;
    });

    const priorityQuestionIds = Array.from(
      new Set([
        ...needPracticeQuestions.map((q) => q.id),
        ...slowRecallQuestions.map((q) => q.id),
      ])
    );

    // Filter questions for the detailed analytics section (uses top-level filteredAnalyticsQuestions)
    const is100Accuracy =
      totalAttempted > 0 &&
      totalAttempted === questions.length &&
      totalCorrect === questions.length;

    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 24, filter: "blur(8px)" }}
        animate={{ opacity: 1, scale: 1, y: 0, filter: "blur(0px)" }}
        exit={{ opacity: 0, scale: 0.96, y: -20, filter: "blur(8px)" }}
        transition={{ duration: 0.48, ease: [0.16, 1, 0.3, 1] }}
        id="session-summary-screen"
        className="fixed inset-0 z-[100] bg-[#FFF9EF] dark:bg-[#120E10] flex flex-col w-full"
      >
        {/* Sticky Header for Result Page */}
        <header className="sticky top-0 z-[110] bg-[#FFF9EF]/90 dark:bg-[#120E10]/90 backdrop-blur-md border-b border-[#E8D9C0] dark:border-[#2D2226] px-4 py-3 flex items-center justify-between shrink-0">
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-xl bg-white dark:bg-[#1C1518] border border-[#E8D9C0] dark:border-[#2D2226] text-[#800020] dark:text-[#E5B869] flex items-center justify-center transition-all active:scale-90 shadow-sm cursor-pointer"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1 px-4 text-center min-w-0">
            <h2 className="text-sm font-black text-[#171923] dark:text-[#FFF9EF] truncate">
              Analysis Report
            </h2>
            <p className="text-[10px] font-bold text-[#800020] dark:text-[#C99A45] uppercase tracking-widest">
              Performance Summary
            </p>
          </div>
          <div className="w-10" />
        </header>

        <div className="flex-1 overflow-y-auto overscroll-y-contain flex flex-col items-center justify-start p-3 sm:p-6 w-full">
        {/* Framer-Motion Confetti Animation for 100% Accuracy Perfect Score */}
        {showPerfectCelebration && (
          <MotionConfettiCelebration
            isOpen={showPerfectCelebration}
            onClose={() => setShowPerfectCelebration(false)}
            totalQuestions={questions.length}
            sessionTitle={session.title}
            accuracy={100}
            soundEnabled={settings.soundEffects !== false}
            hapticEnabled={settings.hapticFeedback !== false}
          />
        )}

        {/* Decorative Background for Results (DISHA Burgundy & Gold ambient glow) */}
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-4xl h-[450px] bg-gradient-to-b from-[#800020]/10 via-[#C99A45]/5 to-transparent dark:from-[#800020]/15 dark:via-[#C99A45]/5 rounded-full blur-[120px]" />
        </div>

        <div className="w-full max-w-2xl space-y-4 sm:space-y-6 pb-[calc(env(safe-area-inset-bottom,20px)+64px)] relative z-10">
          {/* Top Results Card: High-Fidelity Performance Summary */}
          <motion.div 
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="bg-white dark:bg-[#1A1417] border border-[#E8D9C0] dark:border-[#2F2227] rounded-2xl sm:rounded-3xl p-4 sm:p-5 shadow-[0_12px_32px_rgba(128,0,32,0.06)] dark:shadow-none text-center space-y-3.5 sm:space-y-4 overflow-hidden relative"
          >
            {/* DISHA Brand Gradient Top Accent Line & Subtle Gold Glow */}
            <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-[#800020] via-[#C99A45] to-[#800020]" />
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-48 bg-[#C99A45]/10 rounded-full blur-[60px] pointer-events-none" />
            
            <motion.div 
              initial={{ scale: 0, rotate: -15 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", damping: 12, delay: 0.2 }}
              className="w-13 h-13 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-br from-[#800020] via-[#660019] to-[#520014] text-[#E5B869] border border-[#C99A45]/40 flex items-center justify-center mx-auto shadow-lg shadow-[#800020]/25 relative"
            >
              <Trophy className="w-6 h-6 sm:w-7 sm:h-7 text-[#E5B869]" />
              <div className="absolute -top-1 -right-1 w-4.5 h-4.5 bg-[#C99A45] rounded-full border-2 border-white dark:border-[#1A1417] flex items-center justify-center">
                <Check className="w-2.5 h-2.5 text-[#520014]" strokeWidth={3.5} />
              </div>
            </motion.div>

            <div className="space-y-1 relative z-10">
              <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-[#FAF5ED] dark:bg-[#251A1E] border border-[#E8D9C0] dark:border-[#38262C] text-[9px] font-black uppercase tracking-[0.2em] text-[#800020] dark:text-[#E5B869] font-mono shadow-sm">
                <Sparkles className="w-3 h-3 text-[#C99A45]" />
                {session.isSmartTest ? "Mastery Achieved" : isTestMode ? "Examination Finalized" : "Practice Session Completed"}
              </span>
              <h2 className="text-xl sm:text-2xl font-black text-[#171923] dark:text-[#FFF9EF] leading-tight tracking-tight pt-0.5">
                {sessionAccuracy >= 80 ? "Outstanding Mastery!" : sessionAccuracy >= 50 ? "Solid Progress!" : "Keep Pushing Forward!"}
              </h2>
              <div className="text-[11px] font-bold text-[#718096] dark:text-[#9E8E95] flex items-center justify-center gap-1.5 flex-wrap px-2">
                <span className="text-[#171923] dark:text-[#FAF5ED]">{session.title}</span>
                {session.subtitle && (
                  <>
                    <span className="w-1 h-1 rounded-full bg-[#C99A45]" />
                    <span>{session.subtitle}</span>
                  </>
                )}
              </div>
            </div>

            {/* Main Score & Accuracy Grid */}
            <div className="grid grid-cols-2 gap-2.5 sm:gap-3.5 items-stretch pt-0.5 relative z-10">
              <div className="bg-[#FAF5ED] dark:bg-[#20181B] rounded-xl sm:rounded-2xl p-3 sm:p-3.5 border border-[#E8D9C0] dark:border-[#33252A] flex flex-col items-center justify-center">
                <span className="text-[9px] font-black uppercase tracking-widest text-[#800020] dark:text-[#E5B869] mb-1">
                  Score Achieved
                </span>
                <div className="flex items-baseline gap-1 font-mono">
                  <span className="text-2xl sm:text-3xl font-black text-[#171923] dark:text-[#FFF9EF]">
                    {totalCorrect}
                  </span>
                  <span className="text-xs sm:text-sm font-bold text-[#718096] dark:text-[#8C7D83]">
                    / {questions.length}
                  </span>
                </div>
                <span className="text-[9px] font-bold text-[#718096] dark:text-[#8C7D83] mt-0.5">
                  {Math.round((totalCorrect / Math.max(1, questions.length)) * 100)}% Marks
                </span>
              </div>

              <div className="bg-[#FAF5ED] dark:bg-[#20181B] rounded-xl sm:rounded-2xl p-3 sm:p-3.5 border border-[#E8D9C0] dark:border-[#33252A] flex flex-col items-center justify-center">
                <span className="text-[9px] font-black uppercase tracking-widest text-[#800020] dark:text-[#E5B869] mb-1">
                  Accuracy Rate
                </span>
                <div className="flex items-baseline gap-0.5 font-mono">
                  <span className={`text-2xl sm:text-3xl font-black ${
                    sessionAccuracy >= 75 ? 'text-emerald-700 dark:text-emerald-400' :
                    sessionAccuracy >= 50 ? 'text-[#800020] dark:text-[#E5B869]' :
                    'text-rose-700 dark:text-rose-400'
                  }`}>
                    {sessionAccuracy}
                  </span>
                  <span className="text-xs sm:text-sm font-bold text-[#718096] dark:text-[#8C7D83]">%</span>
                </div>
                <span className="text-[9px] font-bold text-emerald-700 dark:text-emerald-400 mt-0.5">
                  {sessionAccuracy >= 75 ? "Target Benchmark Achieved" : sessionAccuracy >= 50 ? "Average Pace" : "Focus on Revision"}
                </span>
              </div>
            </div>

            {/* Celebration Highlight Card (100% Accuracy) */}
            {is100Accuracy && (
              <motion.div
                initial={{ scale: 0.96, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.35 }}
                className="p-3 sm:p-3.5 rounded-xl sm:rounded-2xl bg-gradient-to-r from-[#800020]/10 via-[#C99A45]/20 to-[#800020]/10 border border-[#C99A45]/40 flex items-center gap-3 text-left shadow-sm relative overflow-hidden"
              >
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#800020] to-[#520014] border border-[#C99A45] text-[#E5B869] flex items-center justify-center shrink-0">
                  <Sparkles className="w-5 h-5 fill-current" />
                </div>
                
                <div className="flex-1 min-w-0 relative z-10">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className="text-[9px] font-black uppercase tracking-[0.15em] text-[#800020] dark:text-[#E5B869] font-mono">100% Accuracy</span>
                    <span className="w-1 h-1 rounded-full bg-[#C99A45]" />
                    <span className="text-[9px] font-black uppercase tracking-[0.15em] text-[#800020] dark:text-[#E5B869] font-mono">Perfect Score!</span>
                  </div>
                  <div className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-[#C99A45]/20 border border-[#C99A45]/30 text-[8px] font-black text-[#800020] dark:text-[#E5B869] uppercase tracking-wider mb-1">
                    Flawless
                  </div>
                  <p className="text-[11px] text-[#171923] dark:text-[#FAF5ED] font-bold leading-tight">
                    Outstanding performance! You answered all questions correctly.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setShowPerfectCelebration(true)}
                  className="px-3 py-1.5 rounded-lg bg-[#800020] hover:bg-[#660019] text-[#FFF9EF] font-black text-[10px] uppercase tracking-wider active:scale-95 transition-all shadow cursor-pointer relative z-10 flex items-center gap-1.5 border border-[#C99A45]/40"
                >
                  <span>Replay</span>
                  <span>🎉</span>
                </button>
              </motion.div>
            )}

            {/* Quick Stats Grid (2x2) */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-2.5 pt-0.5 relative z-10">
              {[
                { label: "CORRECT", val: totalCorrect, color: "text-emerald-700 dark:text-emerald-400", bg: "bg-emerald-50/70 dark:bg-emerald-950/20", border: "border-emerald-200 dark:border-emerald-900/40", icon: CheckCircle2 },
                { label: "INCORRECT", val: totalWrong, color: "text-rose-700 dark:text-rose-400", bg: "bg-rose-50/70 dark:bg-rose-950/20", border: "border-rose-200 dark:border-rose-900/40", icon: XCircle },
                { label: "SKIPPED", val: totalSkipped, color: "text-stone-700 dark:text-stone-300", bg: "bg-[#FAF5ED] dark:bg-[#1E171A]", border: "border-[#E8D9C0] dark:border-[#33252A]", icon: Filter },
                { label: "AVG / Q", val: `${avgTimePerQuestion}s`, color: "text-[#800020] dark:text-[#E5B869]", bg: "bg-[#FAF5ED] dark:bg-[#1E171A]", border: "border-[#E8D9C0] dark:border-[#33252A]", icon: Clock },
              ].map((m, i) => {
                const Icon = m.icon;
                return (
                  <div 
                    key={i} 
                    className={`${m.bg} border ${m.border} rounded-xl sm:rounded-2xl py-2 px-2.5 sm:py-2.5 sm:px-3 flex flex-col items-center justify-center transition-all`}
                  >
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <Icon className={`w-3.5 h-3.5 ${m.color}`} />
                      <span className={`text-xl sm:text-2xl font-black font-mono ${m.color}`}>
                        {m.val}
                      </span>
                    </div>
                    <span className="text-[9px] font-black text-[#718096] dark:text-[#8C7D83] uppercase tracking-[0.15em]">
                      {m.label}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Action Buttons (Consistent dimensions, DISHA brand colours) */}
            <div className="flex flex-col gap-2 pt-2 relative z-10">
              <motion.button
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
                onClick={onClose}
                className="w-full h-11 sm:h-12 bg-[#800020] hover:bg-[#660019] text-white rounded-xl font-black text-xs sm:text-sm shadow-md shadow-[#800020]/20 flex items-center justify-center gap-2.5 active:scale-95 transition-all cursor-pointer border border-[#C99A45]/40"
              >
                <div className="w-7 h-7 rounded-lg bg-white/15 flex items-center justify-center text-[#E5B869]">
                  <Home className="w-3.5 h-3.5" />
                </div>
                <span>Return to Dashboard</span>
              </motion.button>

              <div className={`grid ${wrongQuestionIds.length > 0 ? "grid-cols-2" : "grid-cols-1"} gap-2`}>
                <motion.button
                  whileHover={{ y: -1 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => {
                    const title = `🎯 I scored ${sessionAccuracy}% in "${session.title}" on DISHA 20-20!`;
                    const text = `Score: ${totalCorrect}/${questions.length} | Accuracy: ${sessionAccuracy}% | Time: ${formatTime(elapsedSeconds)}.\nPractice with me on DISHA 20-20:`;
                    setShareData({
                      title,
                      text,
                      url: window.location.origin,
                      category: "Quiz Scorecard",
                    });
                  }}
                  className="h-11 px-3 bg-[#FAF5ED] dark:bg-[#1E171A] hover:bg-[#F5EBE1] text-[#800020] dark:text-[#E5B869] rounded-xl font-black text-xs flex items-center justify-center gap-2 active:scale-95 transition-all cursor-pointer border border-[#C99A45]/40"
                >
                  <Share2 className="w-3.5 h-3.5 text-[#800020] dark:text-[#E5B869]" />
                  <span>Share Result</span>
                </motion.button>

                {wrongQuestionIds.length > 0 && (
                  <motion.button
                    whileHover={{ y: -1 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => {
                      onStartNewSession({
                        title: `Review Mistakes (${wrongQuestionIds.length})`,
                        subtitle: session.title,
                        questionIds: wrongQuestionIds,
                        source: "all-wrong",
                        shuffleQuestions: true,
                      });
                    }}
                    className="h-11 px-3 bg-rose-50 dark:bg-rose-950/30 hover:bg-rose-100 dark:hover:bg-rose-900/40 text-rose-700 dark:text-rose-300 rounded-xl font-black text-xs flex items-center justify-center gap-2 active:scale-95 transition-all cursor-pointer border border-rose-200 dark:border-rose-800"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Review Errors ({wrongQuestionIds.length})</span>
                  </motion.button>
                )}
              </div>
            </div>
          </motion.div>

          {/* Performance Visualization Dashboard */}
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="bg-white dark:bg-[#1A1417] border border-[#E8D9C0] dark:border-[#2F2227] rounded-2xl sm:rounded-3xl p-4 sm:p-5 shadow-sm space-y-4"
          >
            {/* Analytics Header */}
            <div className="flex items-center justify-between border-b border-[#E8D9C0]/70 dark:border-[#2F2227] pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-[#FAF5ED] dark:bg-[#20181B] text-[#800020] dark:text-[#E5B869] border border-[#C99A45]/40 flex items-center justify-center">
                  <Target className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs sm:text-sm font-black text-[#171923] dark:text-[#FFF9EF] uppercase tracking-wider">
                    Performance Analytics
                  </h3>
                  <p className="text-[10px] font-bold text-[#718096] dark:text-[#8C7D83]">
                    Attempt breakdown & examination readiness
                  </p>
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-full bg-[#FAF5ED] dark:bg-[#20181B] border border-[#C99A45]/30 text-[9px] font-black text-[#800020] dark:text-[#E5B869] font-mono">
                {sessionAccuracy}% ACC
              </span>
            </div>

            {/* 1. Proportional Attempt Distribution Bar */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-[11px] font-bold">
                <span className="text-[#171923] dark:text-[#FAF5ED]">Attempt Distribution</span>
                <span className="text-[#718096] dark:text-[#8C7D83] font-mono">
                  {totalAttempted}/{questions.length} Attempted ({Math.round((totalAttempted / Math.max(1, questions.length)) * 100)}%)
                </span>
              </div>
              
              <div className="h-3.5 w-full bg-[#FAF5ED] dark:bg-[#20181B] rounded-full overflow-hidden flex border border-[#E8D9C0]/80 dark:border-[#33252A]">
                {totalCorrect > 0 && (
                  <div 
                    style={{ width: `${(totalCorrect / questions.length) * 100}%` }} 
                    className="h-full bg-emerald-600 transition-all duration-500" 
                    title={`Correct: ${totalCorrect}`}
                  />
                )}
                {totalWrong > 0 && (
                  <div 
                    style={{ width: `${(totalWrong / questions.length) * 100}%` }} 
                    className="h-full bg-rose-600 transition-all duration-500" 
                    title={`Incorrect: ${totalWrong}`}
                  />
                )}
                {totalSkipped > 0 && (
                  <div 
                    style={{ width: `${(totalSkipped / questions.length) * 100}%` }} 
                    className="h-full bg-[#E8D9C0] dark:bg-[#3D2D34] transition-all duration-500" 
                    title={`Skipped: ${totalSkipped}`}
                  />
                )}
              </div>

              {/* Distribution Legend */}
              <div className="flex items-center justify-between text-[10px] font-bold pt-0.5 flex-wrap gap-1">
                <div className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400">
                  <span className="w-2 h-2 rounded-full bg-emerald-600" />
                  <span>Correct: {totalCorrect} ({Math.round((totalCorrect / Math.max(1, questions.length)) * 100)}%)</span>
                </div>
                <div className="flex items-center gap-1.5 text-rose-700 dark:text-rose-400">
                  <span className="w-2 h-2 rounded-full bg-rose-600" />
                  <span>Wrong: {totalWrong} ({Math.round((totalWrong / Math.max(1, questions.length)) * 100)}%)</span>
                </div>
                <div className="flex items-center gap-1.5 text-[#718096] dark:text-[#9E8E95]">
                  <span className="w-2 h-2 rounded-full bg-[#E8D9C0] dark:bg-[#3D2D34]" />
                  <span>Skipped: {totalSkipped} ({Math.round((totalSkipped / Math.max(1, questions.length)) * 100)}%)</span>
                </div>
              </div>
            </div>

            {/* 2. Target Benchmark Meter */}
            <div className="space-y-1.5 pt-1">
              <div className="flex items-center justify-between text-[11px] font-bold">
                <div className="flex items-center gap-1.5 text-[#171923] dark:text-[#FAF5ED]">
                  <Award className="w-3.5 h-3.5 text-[#C99A45]" />
                  <span>Target Benchmark (75% Accuracy)</span>
                </div>
                <span className={`font-mono ${sessionAccuracy >= 75 ? 'text-emerald-700 dark:text-emerald-400' : 'text-[#800020] dark:text-[#E5B869]'}`}>
                  {sessionAccuracy >= 75 ? `+${sessionAccuracy - 75}% Above Benchmark` : `${75 - sessionAccuracy}% to Target`}
                </span>
              </div>
              <div className="relative h-2 w-full bg-[#FAF5ED] dark:bg-[#20181B] rounded-full overflow-hidden border border-[#E8D9C0]/80 dark:border-[#33252A]">
                <div className="absolute top-0 bottom-0 left-[75%] w-0.5 bg-[#800020] dark:bg-[#C99A45] z-10" />
                <div
                  style={{ width: `${Math.min(100, sessionAccuracy)}%` }}
                  className={`h-full transition-all duration-500 ${
                    sessionAccuracy >= 75
                      ? "bg-emerald-600"
                      : sessionAccuracy >= 50
                      ? "bg-[#C99A45]"
                      : "bg-rose-600"
                  }`}
                />
              </div>
            </div>

            {/* 3. Time Management Summary */}
            <div className="grid grid-cols-2 gap-2.5 pt-1">
              <div className="p-3 rounded-xl bg-[#FAF5ED] dark:bg-[#20181B] border border-[#E8D9C0] dark:border-[#33252A] flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-white dark:bg-[#1A1417] border border-[#E8D9C0] dark:border-[#2F2227] flex items-center justify-center text-[#800020] dark:text-[#E5B869] shrink-0">
                  <Clock className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <span className="text-[9px] font-black uppercase tracking-wider text-[#718096] dark:text-[#8C7D83] block leading-none mb-1">
                    Total Time
                  </span>
                  <span className="text-sm font-black font-mono text-[#171923] dark:text-[#FFF9EF] block leading-none">
                    {formatTime(elapsedSeconds)}
                  </span>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-[#FAF5ED] dark:bg-[#20181B] border border-[#E8D9C0] dark:border-[#33252A] flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-white dark:bg-[#1A1417] border border-[#E8D9C0] dark:border-[#2F2227] flex items-center justify-center text-[#800020] dark:text-[#E5B869] shrink-0">
                  <Zap className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <span className="text-[9px] font-black uppercase tracking-wider text-[#718096] dark:text-[#8C7D83] block leading-none mb-1">
                    Avg Pace / Q
                  </span>
                  <span className="text-sm font-black font-mono text-[#171923] dark:text-[#FFF9EF] block leading-none">
                    {avgTimePerQuestion}s
                  </span>
                </div>
              </div>
            </div>

            {/* 4. Strategic Performance Insights */}
            <div className="p-3 rounded-xl bg-gradient-to-r from-[#800020]/10 via-[#FAF5ED] to-[#800020]/5 dark:from-[#800020]/20 dark:via-[#1D1619] dark:to-[#800020]/10 border border-[#C99A45]/30 flex items-start gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-[#800020] text-[#E5B869] flex items-center justify-center shrink-0 mt-0.5">
                <TrendingUp className="w-3.5 h-3.5" />
              </div>
              <div className="space-y-0.5 min-w-0">
                <span className="text-[9px] font-black uppercase tracking-widest text-[#800020] dark:text-[#E5B869]">
                  Performance Insight
                </span>
                <p className="text-[11px] font-bold text-[#171923] dark:text-[#FAF5ED] leading-snug">
                  {sessionAccuracy >= 85
                    ? "🔥 Excellent accuracy and strong conceptual clarity. Keep this precision level across full length tests."
                    : sessionAccuracy >= 65
                    ? `🎯 Strong baseline (${sessionAccuracy}%). Reviewing the ${totalWrong} incorrect questions will help eliminate negative marks.`
                    : totalSkipped > questions.length * 0.35
                    ? `⚡ High unattempted rate (${totalSkipped} questions). Revisit syllabus topics to increase overall attempt volume.`
                    : `💡 Prioritize targeted revision: ${totalWrong} questions require concept re-reading. Check the Mastery Keys in the audit below.`}
                </p>
              </div>
            </div>
          </motion.div>

          {/* Live Aspirants Leaderboard */}
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.25 }}
            id="session-leaderboard-section"
          >
            <SessionLeaderboard
              testId={session.testId || (session as any).id || session.title}
              testTitle={session.title}
              currentScore={totalCorrect}
              maxScore={questions.length}
              accuracy={sessionAccuracy}
              timeSpentSeconds={elapsedSeconds}
              userProfile={userProfile}
              allowCloudWrite={false}
            />
          </motion.div>

          {/* Performance Grid Section */}
          <motion.div 
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="bg-white dark:bg-[#1A1417] border border-[#E8D9C0] dark:border-[#2F2227] rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-sm space-y-5"
          >
            <div className="space-y-3">
              <div>
                <h3 className="text-xs sm:text-sm font-black text-[#171923] dark:text-[#FFF9EF] uppercase tracking-[0.15em]">
                  Performance Grid
                </h3>
                <p className="text-[10px] font-bold text-[#718096] dark:text-[#8C7D83] uppercase mt-0.5 tracking-wider">
                  Quick jump to question review
                </p>
              </div>

              {/* Zero-Pill Legend */}
              <div className="flex items-center gap-4 flex-wrap">
                <div className="flex items-center gap-1.5 text-[10px] font-black text-emerald-700 dark:text-emerald-400 uppercase tracking-widest">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-600 shadow-[0_0_8px_rgba(16,185,129,0.4)]" />
                  <span>Correct</span>
                </div>
                <div className="flex items-center gap-1.5 text-[10px] font-black text-rose-700 dark:text-rose-400 uppercase tracking-widest">
                  <div className="w-2.5 h-2.5 rounded-full bg-rose-600 shadow-[0_0_8px_rgba(244,63,94,0.4)]" />
                  <span>Wrong</span>
                </div>
                <div className="flex items-center gap-1.5 text-[10px] font-black text-[#718096] dark:text-[#9E8E95] uppercase tracking-widest">
                  <div className="w-2.5 h-2.5 rounded-full bg-[#E8D9C0] dark:bg-[#3D2D34]" />
                  <span>Skipped</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-6 sm:grid-cols-8 gap-2.5 sm:gap-3">
              {questions.map((q, idx) => {
                const res = sessionResults[q.id];
                let btnClass = "bg-[#FAF5ED] dark:bg-[#20181B] border-[#E8D9C0] dark:border-[#33252A] text-[#718096] dark:text-[#8C7D83]";
                if (res) {
                  btnClass = res.isCorrect 
                    ? "bg-emerald-600 border-emerald-600 text-white shadow-md shadow-emerald-600/20" 
                    : "bg-rose-600 border-rose-600 text-white shadow-md shadow-rose-600/20";
                }

                return (
                  <motion.button
                    key={`${q.id}-${idx}`}
                    whileHover={{ y: -2, scale: 1.05 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => {
                      const el = document.getElementById(`analytics-q-${q.id}`);
                      if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
                    }}
                    className={`aspect-square rounded-xl sm:rounded-2xl text-[12px] font-black font-mono border-2 flex items-center justify-center transition-all cursor-pointer ${btnClass}`}
                  >
                    {idx + 1}
                  </motion.button>
                );
              })}
            </div>
          </motion.div>

          {/* Detailed Question Solutions Section */}
          <div className="space-y-4" id="each-question-analytics-section">
            <div className="flex items-center justify-between gap-4 px-2">
              <h3 className="text-xs sm:text-sm font-black text-[#171923] dark:text-[#FFF9EF] uppercase tracking-wider flex items-center gap-2">
                <FileText className="w-4 h-4 text-[#800020] dark:text-[#E5B869]" />
                Solution Audit
              </h3>
              <div className="h-[1px] flex-1 bg-[#E8D9C0] dark:border-[#2D2226]" />
            </div>

            {/* Segmented Filter Control (DISHA 20-20 Burgundy Styling) */}
            <div className="p-1 bg-[#FAF5ED] dark:bg-[#181114] border border-[#E8D9C0] dark:border-[#2D2226] rounded-2xl flex items-center gap-1">
              {[
                { id: "all", label: "All", count: questions.length },
                { id: "wrong", label: "Wrong", count: totalWrong },
                { id: "correct", label: "Correct", count: totalCorrect },
                { id: "skipped", label: "Skipped", count: totalSkipped },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setAnalyticsFilter(tab.id as any)}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                    analyticsFilter === tab.id
                      ? "bg-[#800020] text-white shadow-sm"
                      : "text-[#718096] hover:text-[#171923] dark:text-[#8C7D83] dark:hover:text-[#FFF9EF]"
                  }`}
                >
                  <span>{tab.label}</span>
                  <span className={`px-1.5 rounded-md text-[10px] font-mono ${
                    analyticsFilter === tab.id 
                      ? "bg-[#C99A45]/30 text-white" 
                      : "bg-[#E8D9C0]/50 dark:bg-[#2A2024] text-[#718096] dark:text-[#8C7D83]"
                  }`}>
                    {tab.count}
                  </span>
                </button>
              ))}
            </div>

            {/* List of Detailed Question Analytics Cards */}
            <div className="space-y-4">
              {filteredAnalyticsQuestions.map((q, idx) => {
                const questionNumber = questions.findIndex((item) => item.id === q.id) + 1;
                const result = sessionResults[q.id];
                const wasAttempted = Boolean(result);
                const isCorrect = result?.isCorrect === true;
                const selectedOptIdx = result?.selectedIndex;
                const correctOptIdx = q.correctIndex;
                const isQBookmarked = Boolean(progressStore[q.id]?.bookmarked);

                return (
                  <motion.div
                    key={`${q.id}-${idx}`}
                    initial={{ y: 24, opacity: 0 }}
                    whileInView={{ y: 0, opacity: 1 }}
                    viewport={{ once: true, margin: "-100px" }}
                    id={`analytics-q-${q.id}`}
                    className="bg-white dark:bg-[#1A1417] border border-[#E8D9C0] dark:border-[#2F2227] rounded-2xl sm:rounded-3xl overflow-hidden shadow-sm hover:shadow-md transition-shadow flex flex-col"
                  >
                    {/* Audit Card Header */}
                    <div className="px-4 py-3 sm:px-5 sm:py-3.5 border-b border-[#E8D9C0]/80 dark:border-[#2F2227] flex items-center justify-between gap-3 bg-[#FAF5ED]/50 dark:bg-[#1F181B]/50">
                      <div className="flex items-center gap-2.5">
                        <span className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-[#800020] text-white font-mono font-black text-xs flex items-center justify-center border border-[#C99A45]/30">
                          #{questionNumber}
                        </span>
                        
                        <div className="flex flex-col">
                          <span className="text-[9px] font-black text-[#718096] dark:text-[#8C7D83] uppercase tracking-widest leading-none mb-1">Question Status</span>
                          {wasAttempted ? (
                            <div className="flex items-center gap-2">
                              <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md flex items-center gap-1.5 ${
                                isCorrect ? "bg-emerald-600 text-white" : "bg-rose-600 text-white"
                              }`}>
                                {isCorrect ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                                {isCorrect ? "Correct" : "Incorrect"}
                              </span>
                              {questionTimes[q.id] !== undefined && (
                                <span className="text-[10px] font-black font-mono bg-[#FAF5ED] dark:bg-[#251B1F] border border-[#E8D9C0] dark:border-[#33252A] text-[#800020] dark:text-[#E5B869] px-2 py-0.5 rounded-md flex items-center gap-1">
                                  <Clock size={11} /> {questionTimes[q.id]}s
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-[#718096] text-white">Skipped</span>
                          )}
                        </div>
                      </div>

                      <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => onToggleBookmark(q.id)}
                        className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl border flex items-center justify-center transition-all cursor-pointer ${
                          isQBookmarked
                            ? "bg-[#C99A45] border-[#C99A45] text-white shadow-md shadow-[#C99A45]/20"
                            : "bg-white dark:bg-[#20181B] border-[#E8D9C0] dark:border-[#33252A] text-[#718096]"
                        }`}
                      >
                        <Bookmark className={`w-4 h-4 sm:w-5 sm:h-5 ${isQBookmarked ? 'fill-current' : ''}`} />
                      </motion.button>
                    </div>

                    <div className="p-4 sm:p-6 space-y-5">
                      {/* Question Content */}
                      <div className="font-hindi text-[#171923] dark:text-[#FFF9EF] text-sm sm:text-base font-black leading-relaxed">
                        <ParsedQuestion text={q.text} fontSizeClass="text-sm sm:text-base" question={q} />
                      </div>

                      {/* Options Breakdown */}
                      <div className="space-y-2">
                        {(() => {
                          const order = shuffledOptionsOrder[q.id];
                          const optList = Array.isArray(q.options) ? q.options : [];
                          const displayIndices = order && order.length === optList.length ? order : optList.map((_, i) => i);
                          
                          return displayIndices.map((originalIdx, displayIdx) => {
                            const optText = optList[originalIdx] || "";
                            const isThisCorrect = originalIdx === correctOptIdx;
                            const isUserSelection = selectedOptIdx === originalIdx;
                            
                            const qType = q.questionType?.toLowerCase() || "";
                            const isMatch = qType === "match_following" || qType === "match" || qType === "pair_based" || qType === "pairs";
                            
                            if (isMatch && optList.length > 4) {
                              const looksLikePairing = /[-–—]/.test(optText) || /\([a-z]\)/i.test(optText) || /,\s*\d+/.test(optText);
                              if (!looksLikePairing) return null;
                            }

                            let cardClass = "bg-[#FAF5ED]/50 dark:bg-[#1E171A]/50 border-[#E8D9C0] dark:border-[#2F2227] text-[#171923] dark:text-[#E2D9D2]";
                            let badgeClass = "bg-[#E8D9C0]/50 dark:bg-[#2F2227] text-[#718096] dark:text-[#8C7D83]";

                            if (isThisCorrect) {
                              cardClass = "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-500 text-emerald-950 dark:text-emerald-50 ring-2 ring-emerald-500/20";
                              badgeClass = "bg-emerald-600 text-white font-black";
                            } else if (isUserSelection && !isThisCorrect) {
                              cardClass = "bg-rose-50 dark:bg-rose-950/20 border-rose-500 text-rose-950 dark:text-rose-50 ring-2 ring-rose-500/20";
                              badgeClass = "bg-rose-600 text-white font-black";
                            }

                            return (
                              <div
                                key={originalIdx}
                                className={`p-3 sm:p-3.5 rounded-xl sm:rounded-2xl border flex items-start gap-3 transition-all duration-300 ${cardClass}`}
                              >
                                <span className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl flex items-center justify-center font-mono text-xs shrink-0 mt-0.5 ${badgeClass}`}>
                                  {optionLabels[displayIdx]}
                                </span>
                                <div className="font-hindi flex-1 leading-snug pt-0.5 min-w-0 font-bold text-xs sm:text-sm">
                                  <RichText text={optText} />
                                </div>
                                {isThisCorrect && <Check size={16} className="text-emerald-600 shrink-0 mt-1" strokeWidth={3} />}
                                {isUserSelection && !isThisCorrect && <X size={16} className="text-rose-600 shrink-0 mt-1" strokeWidth={3} />}
                              </div>
                            );
                          });
                        })()}
                      </div>

                      {/* Explanation Block */}
                      {q.explanation && (
                        <div className="bg-[#1C1518] dark:bg-[#150F12] border border-[#C99A45]/30 rounded-2xl p-4 sm:p-5 shadow-lg">
                          <div className="flex items-center gap-2 mb-3">
                            <div className="w-8 h-8 rounded-xl bg-[#C99A45]/20 text-[#E5B869] border border-[#C99A45]/30 flex items-center justify-center">
                              <FileText size={16} />
                            </div>
                            <h4 className="text-xs font-black text-[#E5B869] uppercase tracking-[0.2em]">Mastery Keys</h4>
                          </div>
                          <div className="text-[13px] sm:text-[14px] text-[#FAF5ED] font-hindi leading-relaxed font-bold">
                            <RichText text={q.explanation} enablePronunciation={true} />
                          </div>
                        </div>
                      )}

                      {/* Expert Tip / Fact */}
                      {q.importantFact && (
                        <div className="bg-[#FAF5ED] dark:bg-[#1D171A] border border-[#C99A45]/40 rounded-2xl p-4 flex gap-3">
                          <div className="w-8 h-8 rounded-lg bg-[#C99A45] text-white flex items-center justify-center shrink-0 mt-0.5">
                            <Lightbulb size={18} fill="currentColor" />
                          </div>
                          <div className="space-y-0.5">
                            <span className="text-[9px] font-black text-[#800020] dark:text-[#E5B869] uppercase tracking-widest">Expert Tip</span>
                            <p className="font-hindi text-xs sm:text-sm text-[#171923] dark:text-[#FAF5ED] leading-relaxed font-black">
                              {q.importantFact}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </div>

        {shareData && (
          <ShareModal
            isOpen={!!shareData}
            onClose={() => setShareData(null)}
            data={shareData}
          />
        )}
        </div>
      </motion.div>
    );
  }

  // ──────────────────────────────────────────────────────────────────────────
  // SCREEN: SESSION SETUP VIEW (shown before starting questions)
  // ──────────────────────────────────────────────────────────────────────────
  if (!isStarted) {
    if (isLiveOrPYQTest) {
      return (
        <RedesignedTestInstructionsView
          session={session}
          questions={questions}
          onStartSession={handleStartSession}
          onClose={onClose}
        />
      );
    }

    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] bg-[#FFF9EF] dark:bg-[#171923] flex flex-col w-full"
        id="mcq-setup-screen"
      >
        {/* Sticky Header */}
        <header className="sticky top-0 z-20 bg-white/95 dark:bg-[#1F2330]/95 backdrop-blur-md border-b border-[#E8D9C0] dark:border-[#31374A] px-4 py-3 flex items-center justify-between">
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-2xl bg-[#F7EFE2] dark:bg-[#252A3A] text-[#171923] dark:text-[#FFF9EF] flex items-center justify-center transition-all active:scale-90 cursor-pointer border border-[#E8D9C0] dark:border-[#31374A]"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1 px-4 text-center min-w-0">
            <h2 className="text-sm font-black text-[#171923] dark:text-[#FFF9EF] truncate">
              Session Setup
            </h2>
            <p className="text-[10px] font-bold text-[#800020] dark:text-[#F47B20] uppercase tracking-widest">{isTestMode ? "Exam Mode" : "Practice Mode"}</p>
          </div>
          <div className="w-10" />
        </header>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto overscroll-contain">
          <div className="max-w-2xl mx-auto p-5 space-y-6">
            {/* Hero Card */}
            <div className="bg-white dark:bg-[#1F2330] border border-[#E8D9C0] dark:border-[#31374A] rounded-[32px] p-6 shadow-sm text-center space-y-4 relative overflow-hidden">
              <div className="flex items-center justify-between mb-2">
                <div className="w-14 h-14 rounded-[22px] bg-[#800020] text-white flex items-center justify-center shadow-lg shadow-[#800020]/25">
                  <BookOpen className="w-7 h-7" />
                </div>
                <button
                  onClick={() => {
                    triggerHaptic("light");
                    let sharePayload: ShareData;
                    if (session.topicId) {
                      sharePayload = {
                        title: session.title,
                        text: `Solve MCQ practice on ${session.title} on DISHA 20-20!`,
                        url: getShareUrl("topic", session.topicId),
                        category: "Topic Practice",
                      };
                    } else if (session.isPYQ && session.pyqDetails) {
                      sharePayload = buildPYQShareData(session.pyqDetails);
                    } else if (session.isLiveTest && session.liveTestDetails) {
                      sharePayload = buildLiveTestShareData(session.liveTestDetails);
                    } else {
                      sharePayload = {
                        title: session.title,
                        text: "Practice this test on DISHA 20-20!",
                        url: getShareUrl("test", session.testId || session.title),
                        category: "Mock Test",
                      };
                    }
                    setShareData(sharePayload);
                  }}
                  className="w-10 h-10 rounded-xl bg-[#F7EFE2] dark:bg-[#252A3A] text-[#800020] dark:text-[#F47B20] flex items-center justify-center active:scale-90 transition-transform cursor-pointer border border-[#E8D9C0] dark:border-[#31374A] shadow-2xs"
                  title="Share Test"
                >
                  <Share2 className="w-5 h-5" />
                </button>
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-900 dark:text-white leading-tight">
                  {displayTitle}
                </h3>
                {session.subtitle && (
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-medium italic">
                    "{session.subtitle}"
                  </p>
                )}
              </div>

              {/* Stats Row */}
              <div className="grid grid-cols-3 gap-2 pt-4 border-t border-slate-100 dark:border-slate-800">
                <div className="flex flex-col items-center">
                  <span className="text-xl font-black text-slate-900 dark:text-white font-mono">{baseQuestions.length}</span>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Questions</span>
                </div>
                <div className="flex flex-col items-center">
                  <span className="text-xl font-black text-blue-600 dark:text-blue-400 font-mono">{isTestMode ? "Off" : "On"}</span>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Feedback</span>
                </div>
                <div className="flex flex-col items-center">
                  <span className="text-xl font-black text-emerald-600 dark:text-emerald-400 font-mono">24/7</span>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Support</span>
                </div>
              </div>
            </div>

            {/* Config Section */}
            <div className="space-y-4">
              <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] px-1">Environment Config</h4>
              
              {/* Shuffle Toggle */}
              <button 
                onClick={handleToggleShuffleQuestions}
                className={`w-full p-5 rounded-[24px] border-2 transition-all flex items-center justify-between text-left ${
                  shuffleQuestions 
                    ? "bg-white dark:bg-slate-900 border-blue-500 shadow-lg shadow-blue-500/5" 
                    : "bg-slate-50 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800"
                }`}
              >
                <div className="flex items-center gap-4">
                  <div className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all ${
                    shuffleQuestions ? "bg-blue-600 text-white rotate-12" : "bg-slate-200 dark:bg-slate-800 text-slate-500"
                  }`}>
                    <Shuffle className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[13px] font-black text-slate-900 dark:text-white block uppercase tracking-tight">Shuffle Content</span>
                    <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block">Randomize question order</span>
                  </div>
                </div>
                <div className={`w-12 h-6 rounded-full relative p-1 transition-colors ${shuffleQuestions ? "bg-blue-600" : "bg-slate-300 dark:bg-slate-700"}`}>
                  <div className={`w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-300 ${shuffleQuestions ? "translate-x-6" : "translate-x-0"}`} />
                </div>
              </button>

              {/* Mode Description */}
              <div className="p-5 rounded-[24px] bg-white dark:bg-[#111A2E] border border-slate-200 dark:border-slate-800 space-y-3">
                <div className="flex items-center gap-2 text-xs font-black text-slate-900 dark:text-white uppercase tracking-widest">
                  <Sparkles className="w-4 h-4 text-amber-500" />
                  <span>Session Type: {isTestMode ? "Examination" : "Practice"}</span>
                </div>
                <p className="text-[12px] font-medium text-slate-600 dark:text-slate-400 leading-relaxed">
                  {isTestMode 
                    ? "Timed session with real exam constraints. No instant feedback. Detailed analysis only after submission."
                    : "Flexible session with instant correct/incorrect feedback and detailed explanations after every response."}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Start Button */}
        <footer className="p-4 bg-white dark:bg-[#1F2330] border-t border-[#E8D9C0] dark:border-[#31374A] pb-[calc(16px+env(safe-area-inset-bottom,0px))]">
          <div className="max-w-2xl mx-auto">
            <button
              id="btn-start-mcq-session"
              onClick={handleStartSession}
              className="w-full h-14 bg-gradient-to-r from-[#800020] via-[#5E0017] to-[#171923] text-white rounded-2xl font-black text-base shadow-xl shadow-[#800020]/25 flex items-center justify-between px-6 group transition-all active:scale-95 cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <Play className="w-5 h-5 fill-[#F47B20] text-[#F47B20]" />
                <span>START SESSION</span>
              </div>
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        </footer>
      </motion.div>
    );
  }

  // Active Live Exam / PYQ Test View
  if (isLiveOrPYQTest) {
    return (
      <>
        <RedesignedLiveAndPYQTestView
          session={session}
          questions={questions}
          currentIndex={currentIndex}
          setCurrentIndex={setCurrentIndex}
          selectedOptionIndex={selectedOptionIndex}
          setSelectedOptionIndex={setSelectedOptionIndex}
          sessionResults={sessionResults}
          setSessionResults={setSessionResults}
          reviewStates={reviewStates}
          setReviewStates={setReviewStates}
          visitedStates={visitedStates}
          setVisitedStates={setVisitedStates}
          elapsedSeconds={elapsedSeconds}
          onUpdateProgress={onUpdateProgress}
          onToggleBookmark={onToggleBookmark}
          isBookmarked={Boolean(currentQuestion && progressStore[currentQuestion.id]?.bookmarked)}
          onClose={onClose}
          showSubmitConfirm={showSubmitConfirm}
          setShowSubmitConfirm={setShowSubmitConfirm}
          showExitConfirm={showExitConfirm}
          setShowExitConfirm={setShowExitConfirm}
          onConfirmSubmit={handleConfirmSubmitTest}
          settings={settings}
          displayedOptions={displayedOptions}
          optionLabels={optionLabels}
          calculateQuestionElapsedSeconds={calculateQuestionElapsedSeconds}
          setQuestionTimes={setQuestionTimes}
          onUpdateSettings={onUpdateSettings}
          onOpenReport={(q) => {
            setReportingQuestion(q);
            setShowReportModal(true);
          }}
          onMarkAnswerRecorded={() => {
            hasRecordedAnswersRef.current = true;
          }}
        />
        <QuestionReportModal
          isOpen={showReportModal}
          onClose={() => {
            setShowReportModal(false);
            setReportingQuestion(null);
          }}
          question={reportingQuestion || currentQuestion}
          userProfile={userProfile}
          subjectName={session.subjectName || session.title}
          chapterName={session.chapterName || session.subtitle}
          topicName={session.topicName}
        />
      </>
    );
  }

  const isCurrentCorrect =
    isSubmitted && currentQuestion && selectedOptionIndex === currentQuestion.correctIndex;
  return (
    <>
        <div
          className="fixed inset-0 z-[100] bg-[#FFF9EF] dark:bg-[#171923] flex flex-col items-center justify-start transition-colors duration-200 overflow-hidden w-full"
          id="mcq-screen-container"
        >
      <div className="w-full max-w-3xl mx-auto flex flex-col h-full relative overflow-hidden bg-[#FFF9EF] dark:bg-[#171923]">
        {/* Sticky Header */}
        <header className="sticky top-0 z-50 bg-white/95 dark:bg-[#1F2330]/95 backdrop-blur-md border-b border-[#E8D9C0] dark:border-[#31374A] px-3 py-2.5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <button
              onClick={onClose}
              className="w-10 h-10 rounded-2xl bg-[#F7EFE2] dark:bg-[#252A3A] text-[#171923] dark:text-[#FFF9EF] border border-[#E8D9C0] dark:border-[#31374A] flex items-center justify-center shrink-0 active:scale-90 transition-transform cursor-pointer"
              title="Exit Practice"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex flex-col min-w-0">
              <h2 className="text-[13px] font-black text-[#171923] dark:text-[#FFF9EF] truncate max-w-[120px] sm:max-w-xs leading-none font-hindi">
                {displayTitle}
              </h2>
              <span className="text-[9px] font-black text-[#800020] dark:text-[#F47B20] uppercase tracking-widest mt-1">
                {isTestMode ? "Exam Session" : "DISHA 20-20 Practice"}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#F7EFE2] dark:bg-[#252A3A] border border-[#E8D9C0] dark:border-[#31374A]">
              <Clock className="w-3.5 h-3.5 text-[#800020] dark:text-[#F47B20]" />
              <span className="text-xs font-black text-[#171923] dark:text-[#FFF9EF] font-mono tabular-nums">
                {formatTime(elapsedSeconds)}
              </span>
            </div>

            <button
              onClick={() => setShowPalette(!showPalette)}
              className={`w-9 h-9 rounded-xl border flex items-center justify-center transition-all active:scale-90 cursor-pointer ${
                showPalette
                  ? "bg-[#800020] border-[#800020] text-white shadow-lg shadow-[#800020]/25"
                  : "bg-white dark:bg-[#252A3A] border-[#E8D9C0] dark:border-[#31374A] text-[#52576A] dark:text-[#CBD2E1]"
              }`}
            >
              <Grid className="w-4.5 h-4.5" />
            </button>

            <button
              onClick={() => {
                triggerHaptic("light");
                let sharePayload: ShareData;
                if (session.topicId) {
                  sharePayload = {
                    title: session.title,
                    text: `Attempt specialized MCQ practice on ${session.title} with bilingual explanations and conceptual notes on DISHA 20-20.`,
                    url: getShareUrl("topic", session.topicId),
                    category: "Topic Practice",
                  };
                } else if (session.chapterId) {
                  sharePayload = {
                    title: session.title,
                    text: `Master ${session.title} with bilingual MCQ practice on DISHA 20-20.`,
                    url: getShareUrl("chapter", session.chapterId),
                    category: "Chapter Practice",
                  };
                } else {
                  sharePayload = {
                    title: session.title,
                    text: "Practice these bilingual MCQs on DISHA 20-20!",
                    url: getShareUrl("practice", session.title),
                    category: "Practice Set",
                  };
                }
                setShareData(sharePayload);
              }}
              className="w-9 h-9 rounded-xl border bg-white dark:bg-[#252A3A] border-[#E8D9C0] dark:border-[#31374A] text-[#800020] dark:text-[#F47B20] flex items-center justify-center active:scale-90 transition-transform cursor-pointer"
              title="Share Practice"
            >
              <Share2 className="w-4.5 h-4.5" />
            </button>

            <button
              onClick={() => {
                if (currentQuestion) {
                  playClickSound();
                  setReportingQuestion(currentQuestion);
                  setShowReportModal(true);
                }
              }}
              className="w-9 h-9 rounded-xl border bg-white dark:bg-[#252A3A] border-[#E8D9C0] dark:border-[#31374A] text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/20 flex items-center justify-center active:scale-90 transition-transform cursor-pointer"
              title="प्रश्न पर दावा / आपत्ति दर्ज करें (Report Question)"
              aria-label="Report Question"
            >
              <Flag className="w-4.5 h-4.5" />
            </button>

            <button
              onClick={() => currentQuestion && onToggleBookmark(currentQuestion.id)}
              className={`w-9 h-9 rounded-xl border flex items-center justify-center transition-all active:scale-90 cursor-pointer ${
                isBookmarked
                  ? "bg-[#C99A45] border-[#C99A45] text-white shadow-lg shadow-[#C99A45]/25"
                  : "bg-white dark:bg-[#252A3A] border-[#E8D9C0] dark:border-[#31374A] text-[#52576A] dark:text-[#CBD2E1]"
              }`}
            >
              <Bookmark className={`w-4.5 h-4.5 ${isBookmarked ? 'fill-current' : ''}`} />
            </button>
          </div>
        </header>

        {/* Progress Tracker */}
        <div className="w-full h-1.5 bg-[#E8D9C0]/60 dark:bg-[#252A3A] relative shrink-0">
          <motion.div 
            initial={{ width: 0 }}
            animate={{ width: `${progressPercent}%` }}
            className="absolute top-0 left-0 h-full bg-gradient-to-r from-[#800020] to-[#F47B20] transition-all duration-500 rounded-r-full"
          />
        </div>

        {/* Question Canvas */}
        <div 
          id="mcq-content-scroll"
          ref={scrollRef}
          className="flex-1 overflow-y-auto overscroll-contain px-3.5 sm:px-4 pt-4 pb-20 space-y-4"
        >
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-lg bg-[#800020] dark:bg-[#F47B20] text-white text-[11px] font-black font-mono tabular-nums uppercase tracking-widest">
              Q{currentIndex + 1} of {totalQuestions}
            </span>
            <div className="h-[2px] flex-1 bg-[#E8D9C0] dark:bg-[#31374A]" />
          </div>

          <div key={currentQuestion?.id || 'q'} className="bg-white dark:bg-[#1F2330] p-[0.85rem] sm:p-[1.19rem] rounded-[21px] border border-[#E8D9C0] dark:border-[#31374A] shadow-2xs">
            <ParsedQuestion 
              text={currentQuestion?.text || ""} 
              fontSizeClass={questionFontSizeClass} 
              question={currentQuestion}
            />
          </div>

          <div className="space-y-2.5">
            {displayedOptions.map((opt, idx) => {
              const isSelected = selectedOptionIndex === opt.originalIndex;
              const isCorrectOption = currentQuestion ? opt.originalIndex === currentQuestion.correctIndex : false;

              let cardStyles = "bg-white dark:bg-[#111A2E] border-slate-200 dark:border-slate-800";
              let labelStyles = "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400";
              let textStyles = "text-slate-900 dark:text-white";

              if (!isTestMode && isSubmitted) {
                if (isCorrectOption) {
                  cardStyles = "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-500 shadow-sm shadow-emerald-500/10";
                  labelStyles = "bg-emerald-600 text-white";
                  textStyles = "text-emerald-900 dark:text-emerald-50 font-black";
                } else if (isSelected && opt.originalIndex === 4) {
                  // Option E selected in practice: Unattempted neutral
                  cardStyles = "bg-amber-50 dark:bg-amber-950/20 border-amber-500 shadow-sm shadow-amber-500/10";
                  labelStyles = "bg-amber-600 text-white";
                  textStyles = "text-amber-900 dark:text-amber-50 font-bold";
                } else if (isSelected && !isCorrectOption) {
                  cardStyles = "bg-rose-50 dark:bg-rose-950/20 border-rose-500 shadow-sm shadow-rose-500/10";
                  labelStyles = "bg-rose-600 text-white";
                  textStyles = "text-rose-900 dark:text-rose-50 font-black";
                } else {
                  cardStyles = "bg-slate-50/50 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800 opacity-60";
                  labelStyles = "bg-slate-100 dark:bg-slate-800 text-slate-400";
                  textStyles = "text-slate-500 dark:text-slate-400 font-bold";
                }
              } else if (isSelected) {
                if (opt.originalIndex === 4) {
                  // Option E in active test
                  cardStyles = "bg-amber-600 border-amber-600 shadow-lg shadow-amber-600/20 scale-[1.02]";
                  labelStyles = "bg-white/20 text-white";
                  textStyles = "text-white font-black";
                } else {
                  // Strict Exam Mode: Blue highlight without revealing correct or wrong answers
                  cardStyles = "bg-blue-600 border-blue-600 shadow-lg shadow-blue-600/20 scale-[1.02]";
                  labelStyles = "bg-white/20 text-white";
                  textStyles = "text-white font-black";
                }
              }

              const feedbackAnimation = (!isTestMode && isSubmitted)
                ? isCorrectOption
                  ? { scale: [1, 1.05, 1], transition: { duration: 0.3 } }
                  : isSelected
                  ? { x: [0, -10, 10, -10, 10, 0], transition: { duration: 0.4 } }
                  : {}
                : isSelected
                ? { scale: 1.02 }
                : { scale: 1 };

              return (
                <motion.button
                  key={`${currentQuestion?.id || 'q'}-opt-${opt.originalIndex}`}
                  disabled={!isTestMode && isSubmitted}
                  onClick={() => {
                    if (isTestMode) {
                      handleOptionSelectTestMode(opt.originalIndex);
                    } else {
                      handleSelectOptionPractice(opt.originalIndex);
                    }
                  }}
                  animate={feedbackAnimation}
                  whileTap={isTestMode || !isSubmitted ? { scale: 0.96 } : undefined}
                  className={`w-full text-left p-[0.68rem] sm:p-[0.85rem] rounded-[17px] border-2 flex items-center justify-between gap-3.5 transition-all duration-200 cursor-pointer ${cardStyles}`}
                >
                  <div className="flex items-start gap-2.5 sm:gap-3 flex-1 min-w-0">
                    <span className={`shrink-0 w-[1.53rem] h-[1.53rem] sm:w-[1.72rem] sm:h-[1.72rem] rounded-lg sm:rounded-xl flex items-center justify-center font-black text-xs sm:text-[13px] font-mono transition-all ${labelStyles}`}>
                      {optionLabels[idx]}
                    </span>
                    <div className={`flex-1 pt-0.5 font-hindi leading-snug font-bold min-w-0 break-words [overflow-wrap:anywhere] ${textStyles} ${optionFontSizeClass}`}>
                      <RichText text={opt.text} />
                    </div>
                  </div>

                  {/* Feedback Badge Icon only in Practice Mode */}
                  {!isTestMode && isSubmitted && isCorrectOption && (
                    <motion.div
                      initial={{ scale: 0, rotate: -45 }}
                      animate={{ scale: 1, rotate: 0 }}
                      className="shrink-0 w-7 h-7 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-lg"
                    >
                      <CheckCircle2 size={18} />
                    </motion.div>
                  )}
                  {!isTestMode && isSubmitted && isSelected && !isCorrectOption && (
                    <motion.div
                      initial={{ scale: 0, rotate: 45 }}
                      animate={{ scale: 1, rotate: 0 }}
                      className="shrink-0 w-7 h-7 rounded-full bg-rose-500 text-white flex items-center justify-center shadow-lg"
                    >
                      <XCircle size={18} />
                    </motion.div>
                  )}
                </motion.button>
              );
            })}
          </div>

          {/* Explanation Section only in Practice Mode */}
          <AnimatePresence>
            {!isTestMode && isSubmitted && (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                className="space-y-4 pt-4"
              >
                <div className="bg-slate-900 dark:bg-slate-800 rounded-[28px] p-5 sm:p-7 shadow-xl shadow-slate-900/10">
                  <div className="flex items-center gap-2.5 mb-4">
                    <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center text-white border border-white/10">
                      <FileText size={20} />
                    </div>
                    <h4 className="text-sm font-black text-white uppercase tracking-widest">Mastery Keys</h4>
                  </div>
                  <div className="text-[15px] sm:text-[16px] text-slate-100 font-hindi leading-relaxed font-bold">
                    <RichText text={currentQuestion.explanation} enablePronunciation={true} />
                  </div>
                  <div className="pt-3.5 mt-3.5 border-t border-white/10 flex items-center justify-between flex-wrap gap-2.5">
                    <button
                      type="button"
                      onClick={() => {
                        if (currentQuestion) {
                          playClickSound();
                          window.dispatchEvent(new CustomEvent("disha2020_open_ai_tutor", { detail: { question: currentQuestion } }));
                        }
                      }}
                      className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-indigo-500 via-purple-600 to-pink-500 hover:from-indigo-600 hover:to-purple-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-indigo-500/20 active:scale-95 transition-all cursor-pointer"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-amber-300 animate-spin" style={{ animationDuration: '3s' }} />
                      <span>✨ AI से समझें (Explain with AI)</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        if (currentQuestion) {
                          playClickSound();
                          setReportingQuestion(currentQuestion);
                          setShowReportModal(true);
                        }
                      }}
                      className="text-xs font-bold text-amber-300 hover:text-amber-200 flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Flag className="w-3.5 h-3.5 fill-current" />
                      <span>प्रश्न / उत्तर में कोई त्रुटि या मिसप्रिंट है? दावा / रिपोर्ट करें</span>
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

            {/* Floating Action Footer */}
        <footer className="w-full bg-white dark:bg-[#1F2330] border-t border-[#E8D9C0] dark:border-[#31374A] px-4 py-3 shrink-0 z-40 pb-[calc(12px+env(safe-area-inset-bottom,0px))]">
          <div className="max-w-3xl mx-auto flex gap-3">
            <button
              onClick={handlePrevQuestionPractice}
              disabled={currentIndex === 0}
              className="h-12 sm:h-14 w-12 sm:w-14 rounded-2xl bg-[#F7EFE2] dark:bg-[#252A3A] text-[#171923] dark:text-[#FFF9EF] border border-[#E8D9C0] dark:border-[#31374A] flex items-center justify-center disabled:opacity-30 active:scale-90 transition-transform cursor-pointer shrink-0"
              title="Previous Question"
            >
              <ArrowLeft size={22} />
            </button>

            {isTestMode ? (
              <div className="flex-1 flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const nextReview = !reviewStates[currentQuestion.id];
                    setReviewStates((prev) => ({ ...prev, [currentQuestion.id]: nextReview }));
                  }}
                  className={`px-3 sm:px-4 h-12 sm:h-14 rounded-2xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    reviewStates[currentQuestion.id]
                      ? "bg-[#C99A45] text-white shadow-md shadow-[#C99A45]/20"
                      : "bg-[#F7EFE2] dark:bg-[#252A3A] text-[#52576A] dark:text-[#CBD2E1] border border-[#E8D9C0] dark:border-[#31374A]"
                  }`}
                >
                  <Bookmark className={`w-4 h-4 ${reviewStates[currentQuestion.id] ? "fill-current" : ""}`} />
                  <span className="hidden sm:inline">{reviewStates[currentQuestion.id] ? "Marked" : "Mark Review"}</span>
                </button>

                {currentIndex < questions.length - 1 ? (
                  <button
                    type="button"
                    onClick={() => {
                      const nextIdx = currentIndex + 1;
                      setCurrentIndex(nextIdx);
                      const nextQ = questions[nextIdx];
                      const prevAnswer = sessionResults[nextQ?.id]?.selectedIndex;
                      setSelectedOptionIndex(prevAnswer !== undefined ? prevAnswer : null);
                    }}
                    className="flex-1 h-12 sm:h-14 bg-[#800020] hover:bg-[#5E0017] dark:bg-[#F47B20] dark:hover:bg-[#E06A12] text-white rounded-2xl font-black text-xs sm:text-sm shadow-lg shadow-[#800020]/20 flex items-center justify-center gap-2 active:scale-95 transition-all cursor-pointer"
                  >
                    <span>Next Question</span>
                    <ArrowRight size={18} />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowSubmitConfirm(true)}
                    className="flex-1 h-12 sm:h-14 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-black text-xs sm:text-sm shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2 active:scale-95 transition-all cursor-pointer"
                  >
                    <CheckCircle2 size={18} />
                    <span>SUBMIT EXAMINATION</span>
                  </button>
                )}
              </div>
            ) : (
              !isSubmitted ? (
                <div className="flex-1 flex items-center justify-center bg-[#FFF9EF] dark:bg-[#171923] rounded-2xl border-2 border-dashed border-[#E8D9C0] dark:border-[#31374A]">
                  <span className="text-[11px] font-black text-[#787D91] dark:text-[#929AB0] uppercase tracking-[0.15em]">Select an Answer</span>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleNextQuestionPractice}
                  className="flex-1 h-14 bg-[#800020] hover:bg-[#5E0017] dark:bg-[#F47B20] dark:hover:bg-[#E06A12] text-white rounded-2xl font-black text-base shadow-xl shadow-[#800020]/25 flex items-center justify-center gap-2 active:scale-95 transition-all cursor-pointer"
                >
                  <span>{currentIndex < questions.length - 1 ? "Next Question" : "View Final Result"}</span>
                  <ArrowRight size={20} />
                </button>
              )
            )}
          </div>
        </footer>
      </div>


        {/* 8. QUESTION PALETTE OVERLAY */}
        {showPalette && (
          <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center bg-black/40 backdrop-blur-[2px] animate-in fade-in duration-300">
            <div className="bg-white dark:bg-[#111A2E] w-full max-w-2xl rounded-t-[32px] sm:rounded-[32px] overflow-hidden shadow-2xl animate-in slide-in-from-bottom-10 duration-300 max-h-[80vh] flex flex-col">
              <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                    <Layers className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">Question Navigator</h3>
                    <p className="text-[10px] font-bold text-slate-500 uppercase">Jump to any question</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowPalette(false)}
                  className="w-10 h-10 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-5 scrollbar-hide">
                <div className="grid grid-cols-5 sm:grid-cols-8 gap-3">
                  {questions.map((q, idx) => {
                    const qid = q.id;
                    const result = sessionResults[qid];
                    const isBookmarked = progressStore[qid]?.bookmarked;
                    const isCurrent = idx === currentIndex;
                    
                    let bgClass = "bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400";
                    if (isCurrent) bgClass = "bg-blue-600 border-blue-600 text-white ring-4 ring-blue-600/10";
                    else if (result?.isSubmitted) {
                      if (isTestMode) bgClass = "bg-slate-800 border-slate-800 text-white";
                      else bgClass = result.isCorrect ? "bg-emerald-500 border-emerald-500 text-white" : "bg-rose-500 border-rose-500 text-white";
                    }

                    return (
                      <button
                        key={`pal-${qid}`}
                        onClick={() => {
                          if (isTestMode) handleNavigateQuestionTestMode(idx);
                          else {
                            setCurrentIndex(idx);
                            const res = sessionResults[qid];
                            if (res) {
                              setSelectedOptionIndex(res.selectedIndex);
                              setIsSubmitted(res.isSubmitted);
                            } else {
                              setSelectedOptionIndex(null);
                              setIsSubmitted(false);
                            }
                          }
                          setShowPalette(false);
                        }}
                        className={`aspect-square rounded-2xl border-2 flex items-center justify-center text-xs font-black font-mono transition-all relative cursor-pointer active:scale-90 ${bgClass}`}
                      >
                        {idx + 1}
                        {isBookmarked && (
                          <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-amber-500 rounded-full ring-2 ring-white dark:ring-[#111A2E]" />
                        )}
                      </button>
                    );
                  })}
                </div>
                
                {/* Legend */}
                <div className="mt-8 grid grid-cols-2 gap-4 pt-6 border-t border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-2.5">
                    <div className="w-4 h-4 rounded bg-blue-600" />
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Current</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <div className="w-4 h-4 rounded bg-slate-800 dark:bg-slate-700" />
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Answered</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <div className="w-4 h-4 rounded bg-emerald-500" />
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Correct</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <div className="w-4 h-4 rounded bg-rose-500" />
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Incorrect</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* CONFIRM EXIT TEST MODAL */}
      {showExitConfirm && (
        <div className="fixed inset-0 z-[200] bg-[#0F172A]/80 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full text-center space-y-4 shadow-2xl">
            <div className="w-12 h-12 rounded-2xl bg-[#D97706]/10 text-[#D97706] flex items-center justify-center mx-auto">
              <AlertCircle size={24} />
            </div>
            <div>
              <h4 className="text-lg font-bold text-[#202838]">Quit Test?</h4>
              <p className="text-sm text-[#687386] mt-1">You have answered {answeredCountInTest} of {totalQuestions} questions. Progress will be saved.</p>
            </div>
            <div className="space-y-3 pt-2">
              <button
                onClick={() => handleConfirmSubmitTest()}
                className="w-full py-3.5 bg-[#3557D5] text-white text-sm font-bold rounded-2xl active:scale-95 transition-all shadow-md shadow-blue-500/20"
              >
                Submit & Exit
              </button>
              <button
                onClick={() => setShowExitConfirm(false)}
                className="w-full py-3.5 bg-[#F6F8FC] text-[#202838] text-sm font-bold rounded-2xl active:scale-95 transition-all"
              >
                Continue Answering
              </button>
              <button
                onClick={onClose}
                className="w-full py-2 text-[#DC2626] text-xs font-bold"
              >
                Discard & Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRM SUBMIT TEST MODAL */}
      {showSubmitConfirm && (
        <div className="fixed inset-0 z-[200] bg-[#0F172A]/80 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full text-center space-y-4 shadow-2xl">
            <div className="w-12 h-12 rounded-2xl bg-[#15803D]/10 text-[#15803D] flex items-center justify-center mx-auto">
              <CheckCircle2 size={24} />
            </div>
            <div>
              <h4 className="text-lg font-bold text-[#202838]">Final Submission</h4>
              <p className="text-sm text-[#687386] mt-1">Ready to submit? You have answered {answeredCountInTest} out of {totalQuestions} questions.</p>
            </div>
            <div className="space-y-3 pt-2">
              <button
                onClick={() => handleConfirmSubmitTest()}
                className="w-full py-3.5 bg-[#15803D] text-white text-sm font-bold rounded-2xl active:scale-95 transition-all shadow-md shadow-emerald-500/20"
              >
                Yes, Submit Now
              </button>
              <button
                onClick={() => setShowSubmitConfirm(false)}
                className="w-full py-3.5 bg-[#F6F8FC] text-[#202838] text-sm font-bold rounded-2xl active:scale-95 transition-all"
              >
                Go Back
              </button>
            </div>
          </div>
        </div>
      )}

      {/* App Settings Modal */}
      {showSettingsModal && onUpdateSettings && (
        <AppSettingsModal
          settings={settings}
          onUpdateSettings={onUpdateSettings}
          onClose={() => setShowSettingsModal(false)}
        />
      )}
      {/* 9. REPORT MODAL */}
      <QuestionReportModal
        isOpen={showReportModal}
        onClose={() => {
          setShowReportModal(false);
          setReportingQuestion(null);
        }}
        question={reportingQuestion || currentQuestion}
        userProfile={userProfile}
        subjectName={session.subjectName || session.title}
        chapterName={session.chapterName || session.subtitle}
        topicName={session.topicName}
      />
    </>
  );
};

interface RedesignedLiveAndPYQTestViewProps {
  session: MCQSession;
  questions: Question[];
  currentIndex: number;
  setCurrentIndex: (idx: number) => void;
  selectedOptionIndex: number | null;
  setSelectedOptionIndex: (idx: number | null) => void;
  sessionResults: Record<string, { selectedIndex: number; isCorrect: boolean; isSubmitted: boolean }>;
  setSessionResults: React.Dispatch<React.SetStateAction<Record<string, { selectedIndex: number; isCorrect: boolean; isSubmitted: boolean }>>>;
  reviewStates: Record<string, boolean>;
  setReviewStates: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  visitedStates: Record<string, boolean>;
  setVisitedStates: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  elapsedSeconds: number;
  onUpdateProgress: (questionId: string, isCorrect: boolean, selectedOption: number) => void;
  onToggleBookmark: (questionId: string) => void;
  isBookmarked: boolean;
  onClose: () => void;
  showSubmitConfirm: boolean;
  setShowSubmitConfirm: (val: boolean) => void;
  showExitConfirm: boolean;
  setShowExitConfirm: (val: boolean) => void;
  onConfirmSubmit: () => void;
  settings: AppSettings;
  displayedOptions: { text: string; originalIndex: number }[];
  optionLabels: string[];
  calculateQuestionElapsedSeconds: () => number;
  setQuestionTimes: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  onUpdateSettings?: (newSettings: Partial<AppSettings>) => void;
  onMarkAnswerRecorded?: () => void;
  onOpenReport?: (q: Question) => void;
}

function RedesignedLiveAndPYQTestView({
  session,
  questions,
  currentIndex,
  setCurrentIndex,
  selectedOptionIndex,
  setSelectedOptionIndex,
  sessionResults,
  setSessionResults,
  reviewStates,
  setReviewStates,
  visitedStates,
  setVisitedStates,
  elapsedSeconds,
  onUpdateProgress,
  onToggleBookmark,
  isBookmarked,
  onClose,
  showSubmitConfirm,
  setShowSubmitConfirm,
  showExitConfirm,
  setShowExitConfirm,
  onConfirmSubmit,
  settings,
  displayedOptions,
  optionLabels,
  calculateQuestionElapsedSeconds,
  setQuestionTimes,
  onUpdateSettings,
  onMarkAnswerRecorded,
  onOpenReport,
}: RedesignedLiveAndPYQTestViewProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showPaletteDrawer, setShowPaletteDrawer] = useState(false);
  const [shareData, setShareData] = useState<ShareData | null>(null);

  // Debounce duplicate taps on Prev/Next navigation buttons.
  const isNavigatingRef = useRef<boolean>(false);

  const safeCurrentIndex = (questions && questions.length > 0)
    ? Math.max(0, Math.min(currentIndex, questions.length - 1))
    : 0;
  const currentQuestion = (questions && questions.length > 0)
    ? questions[safeCurrentIndex]
    : undefined;
  const totalQuestions = questions.length;
  const isLive = session.testType === "live" || Boolean(session.isLiveTest);

  // Stats calculation for palette
  const answeredCount = Object.keys(sessionResults).filter(
    (id) => sessionResults[id]?.selectedIndex !== null && sessionResults[id]?.selectedIndex !== undefined
  ).length;
  const reviewCount = Object.keys(reviewStates).filter((id) => reviewStates[id]).length;
  const visitedCount = Object.keys(visitedStates).filter((id) => visitedStates[id]).length;
  const notAnsweredCount = Math.max(0, visitedCount - answeredCount);
  const notVisitedCount = Math.max(0, totalQuestions - visitedCount);

  // Time Limit and Countdown Timer
  const timeLimitMinutes = session.timeLimitMinutes || (isLive ? 120 : 180);
  const totalLimitSecs = timeLimitMinutes * 60;
  const remainingSecs = Math.max(0, totalLimitSecs - elapsedSeconds);
  const isTimeUrgent = remainingSecs <= 300; // < 5 mins left

  const formatCountdown = (secs: number) => {
    const safeSecs = Math.max(0, Math.floor(Number(secs) || 0));
    const h = Math.floor(safeSecs / 3600);
    const m = Math.floor((safeSecs % 3600) / 60);
    const s = safeSecs % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  const hasAutoSubmittedRef = useRef(false);

  // Auto-submit when countdown timer reaches zero (fires exactly once)
  useEffect(() => {
    if (totalLimitSecs > 0 && elapsedSeconds >= totalLimitSecs && !hasAutoSubmittedRef.current) {
      hasAutoSubmittedRef.current = true;
      onConfirmSubmit();
    }
  }, [elapsedSeconds, totalLimitSecs, onConfirmSubmit]);

  // Mark current question visited
  useEffect(() => {
    if (currentQuestion) {
      setVisitedStates((prev) => ({ ...prev, [currentQuestion.id]: true }));
      const existingRes = sessionResults[currentQuestion.id];
      setSelectedOptionIndex(existingRes?.selectedIndex !== undefined ? existingRes.selectedIndex : null);
    }
  }, [currentIndex, currentQuestion?.id]);

  // Fullscreen Handler
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen?.().catch(() => {});
      setIsFullscreen(false);
    }
  };

  // Option selection
  const handleSelectOption = (originalOptIdx: number) => {
    if (!currentQuestion) return;
    setSelectedOptionIndex(originalOptIdx);
    const isCorrect = isLive
      ? false
      : originalOptIdx === currentQuestion.correctIndex;
    const timeSpent = calculateQuestionElapsedSeconds();

    setQuestionTimes((prev) => ({
      ...prev,
      [currentQuestion.id]: timeSpent,
    }));

    setSessionResults((prev) => ({
      ...prev,
      [currentQuestion.id]: {
        selectedIndex: originalOptIdx,
        isCorrect,
        isSubmitted: true,
      },
    }));

    onMarkAnswerRecorded?.();
    // For Live Tests, authoritative grading + progress recording happens server-side on submission
    if (!isLive) {
      recordQuestionAttempt(
        {
          questionId: currentQuestion.id,
          testId: session.testId,
          subjectId: session.subjectId,
          chapterId: currentQuestion.chapterId,
          topicId: currentQuestion.topicId,
          timeTakenSeconds: timeSpent,
          isCorrect,
          selectedOption: optionLabels[originalOptIdx] || String(originalOptIdx),
          correctOption: optionLabels[currentQuestion.correctIndex] || String(currentQuestion.correctIndex),
        },
        { isAdminPreview: session.isAdminPreview }
      );

      onUpdateProgress(currentQuestion.id, isCorrect, originalOptIdx);
    }
  };

  // Clear Response
  const handleClearResponse = () => {
    if (!currentQuestion) return;
    setSelectedOptionIndex(null);
    setSessionResults((prev) => {
      const next = { ...prev };
      delete next[currentQuestion.id];
      return next;
    });
  };

  // Toggle Review Status
  const handleToggleReview = () => {
    if (!currentQuestion) return;
    setReviewStates((prev) => ({
      ...prev,
      [currentQuestion.id]: !prev[currentQuestion.id],
    }));
  };

  const isCurrentMarkedForReview = Boolean(currentQuestion && reviewStates[currentQuestion.id]);

  // Keyboard Shortcuts for CBT Exam Mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const targetTag = target?.tagName?.toLowerCase();
      if (targetTag === "input" || targetTag === "textarea" || target?.isContentEditable) return;

      const key = e.key.toLowerCase();
      let optIdx: number | null = null;
      if (key === "1" || key === "a") optIdx = 0;
      else if (key === "2" || key === "b") optIdx = 1;
      else if (key === "3" || key === "c") optIdx = 2;
      else if (key === "4" || key === "d") optIdx = 3;
      else if (key === "5" || key === "e") optIdx = 4;

      if (optIdx !== null && optIdx < displayedOptions.length) {
        e.preventDefault();
        handleSelectOption(displayedOptions[optIdx].originalIndex);
        return;
      }

      if (e.key === "ArrowRight") {
        e.preventDefault();
        if (currentIndex < totalQuestions - 1) {
          setCurrentIndex(currentIndex + 1);
        }
        return;
      }

      if (e.key === "ArrowLeft") {
        e.preventDefault();
        if (currentIndex > 0) {
          setCurrentIndex(currentIndex - 1);
        }
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentIndex, totalQuestions, displayedOptions, handleSelectOption, setCurrentIndex]);

  return (
    <div
      className="fixed inset-0 z-[100] bg-[#FFF9EF] dark:bg-[#171923] flex flex-col w-full h-[100dvh] overflow-hidden select-none"
      id="live-pyq-test-viewport"
    >
      {/* 1. STICKY EXAM HEADER */}
      <header className="sticky top-0 z-30 bg-white/95 dark:bg-[#1F2330]/95 backdrop-blur-md border-b border-[#E8D9C0] dark:border-[#31374A] px-4 py-2.5 flex items-center justify-between shrink-0 shadow-2xs">
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            onClick={() => setShowExitConfirm(true)}
            className="w-9 h-9 rounded-xl bg-[#F7EFE2] dark:bg-[#252A3A] text-[#171923] dark:text-[#FFF9EF] border border-[#E8D9C0] dark:border-[#31374A] flex items-center justify-center shrink-0 active:scale-90 transition-transform cursor-pointer"
          >
            <ArrowLeft size={18} />
          </button>
          <div className="flex flex-col min-w-0">
            <h1 className="text-[13px] font-black text-[#171923] dark:text-[#FFF9EF] truncate max-w-[110px] sm:max-w-xs leading-none font-hindi">
              {session.title}
            </h1>
            <div className="flex items-center gap-1.5 mt-1">
              <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded-md ${isLive ? 'bg-[#F47B20] text-white' : 'bg-[#800020] text-white'}`}>
                {isLive ? 'Live Exam' : 'Official PYQ'}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Timer with Warning State */}
          <motion.div 
            animate={isTimeUrgent ? {
              scale: [1, 1.05, 1],
              backgroundColor: ["#E11D48", "#BE123C", "#E11D48"],
            } : {}}
            transition={{ repeat: Infinity, duration: 2 }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border-2 font-mono tabular-nums font-black text-[13px] transition-colors duration-300 shadow-2xs ${
              isTimeUrgent 
                ? 'text-white border-rose-600' 
                : 'bg-[#FFF9EF] dark:bg-[#171923] border-[#E8D9C0] dark:border-[#31374A] text-[#171923] dark:text-[#FFF9EF]'
            }`}
          >
            <Clock size={14} className={isTimeUrgent ? '' : 'text-[#800020] dark:text-[#F47B20]'} />
            <span>{formatCountdown(remainingSecs)}</span>
          </motion.div>

          <button
            onClick={() => {
              triggerHaptic("light");
              let sharePayload: ShareData;
              if (session.isPYQ && session.pyqDetails) {
                sharePayload = buildPYQShareData(session.pyqDetails);
              } else if (session.isLiveTest && session.liveTestDetails) {
                sharePayload = buildLiveTestShareData(session.liveTestDetails);
              } else if (session.chapterId) {
                sharePayload = {
                  title: session.title,
                  text: "Practice this chapter test on DISHA 20-20!",
                  url: getShareUrl("chapter", session.chapterId),
                  category: "Chapter Practice",
                };
              } else {
                sharePayload = {
                  title: session.title,
                  text: "Practice this test on DISHA 20-20!",
                  url: getShareUrl("test", session.testId || session.title),
                  category: "Mock Test",
                };
              }
              setShareData(sharePayload);
            }}
            className="w-10 h-10 rounded-xl bg-[#F7EFE2] dark:bg-[#252A3A] text-[#171923] dark:text-[#FFF9EF] flex items-center justify-center active:scale-90 transition-transform cursor-pointer border border-[#E8D9C0] dark:border-[#31374A]"
            title="Share Test"
            aria-label="Share test"
          >
            <Share2 size={18} className="text-[#800020] dark:text-[#F47B20]" />
          </button>

          {onOpenReport && currentQuestion && (
            <button
              type="button"
              onClick={() => {
                playClickSound();
                onOpenReport(currentQuestion);
              }}
              className="w-10 h-10 rounded-xl bg-[#F7EFE2] dark:bg-[#252A3A] text-amber-600 dark:text-amber-400 flex items-center justify-center active:scale-90 transition-transform cursor-pointer border border-[#E8D9C0] dark:border-[#31374A]"
              title="प्रश्न पर दावा / आपत्ति दर्ज करें (Report Question)"
              aria-label="Report Question"
            >
              <Flag size={18} />
            </button>
          )}

          <button
            onClick={() => setShowPaletteDrawer(true)}
            className="w-10 h-10 rounded-xl bg-[#800020] dark:bg-[#F47B20] text-white flex lg:hidden items-center justify-center shadow-md active:scale-90 transition-transform cursor-pointer"
            title="Question Palette"
          >
            <Grid size={20} />
          </button>

          <button
            onClick={() => setShowSubmitConfirm(true)}
            className="px-3 sm:px-3.5 h-10 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase tracking-wider flex items-center gap-1.5 shadow-md shadow-emerald-600/20 active:scale-95 transition-all cursor-pointer"
            title="Submit Examination"
          >
            <CheckCircle2 size={16} />
            <span className="hidden xs:inline">Submit</span>
          </button>
        </div>
      </header>

      {/* 2. PROGRESS BAR */}
      <div className="w-full bg-[#E8D9C0]/60 dark:bg-[#252A3A] h-1.5 shrink-0 overflow-hidden">
        <motion.div 
          initial={{ width: 0 }}
          animate={{ width: `${((currentIndex + 1) / totalQuestions) * 100}%` }}
          className="h-full bg-gradient-to-r from-[#800020] to-[#F47B20] transition-all duration-300 rounded-r-full"
        />
      </div>

      {/* 3. QUESTION CANVAS & CBT SPLIT-SCREEN LAYOUT */}
      <main className="flex-1 overflow-y-auto overscroll-contain bg-[#FFF9EF] dark:bg-[#171923] px-3 sm:px-4 py-4 sm:py-5">
        <div className="max-w-3xl lg:max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-5 lg:gap-6 items-start">
          {/* Left Column: Question Text & Options */}
          <div className="lg:col-span-8 space-y-5">
            <div className="flex items-center justify-between px-1">
              <span className="text-[11px] font-black text-[#787D91] dark:text-[#929AB0] uppercase tracking-[0.2em] font-mono tabular-nums">Question {currentIndex + 1} / {totalQuestions}</span>
              <div className="flex items-center gap-2">
                <span className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-md text-[10px] font-black font-mono tabular-nums">+{session.marksPerQuestion || (isLive ? 2 : 1)}.0</span>
                <span className="bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 px-2 py-0.5 rounded-md text-[10px] font-black font-mono tabular-nums">-{session.negativeMarking ?? (isLive ? 0.66 : 0.33)}</span>
              </div>
            </div>

            <div key={currentQuestion?.id} className="bg-white dark:bg-[#1F2330] p-[1.06rem] sm:p-[1.7rem] rounded-[26px] border border-[#E8D9C0] dark:border-[#31374A] shadow-2xs">
              <div className="text-[1.10rem] sm:text-[1.22rem] font-bold text-[#171923] dark:text-[#FFF9EF] leading-snug font-hindi">
                <ParsedQuestion text={currentQuestion?.text || ""} fontSizeClass="text-[1.10rem] sm:text-[1.22rem]" question={currentQuestion} />
              </div>
            </div>

            <div className="space-y-2.5">
              {displayedOptions.map((opt, idx) => {
                const isSelected = selectedOptionIndex === opt.originalIndex;
                return (
                  <motion.button
                    key={`${currentQuestion?.id}-opt-${opt.originalIndex}`}
                    onClick={() => handleSelectOption(opt.originalIndex)}
                    whileTap={{ scale: 0.97 }}
                    className={`w-full p-[0.85rem] sm:p-[1.06rem] rounded-[18px] border-2 text-left flex items-start gap-3.5 transition-all duration-200 cursor-pointer ${
                      isSelected
                        ? "bg-[#800020] dark:bg-[#F47B20] border-[#800020] dark:border-[#F47B20] shadow-lg shadow-[#800020]/20"
                        : "bg-white dark:bg-[#1F2330] border-[#E8D9C0] dark:border-[#31374A] hover:border-[#800020]/50 dark:hover:border-[#F47B20]/50 shadow-2xs"
                    }`}
                  >
                    <span className={`shrink-0 w-[1.53rem] h-[1.53rem] sm:w-[1.72rem] sm:h-[1.72rem] rounded-lg sm:rounded-xl flex items-center justify-center font-black text-xs sm:text-[13px] font-mono transition-all ${
                      isSelected ? 'bg-white/20 text-white' : 'bg-[#F7EFE2] dark:bg-[#252A3A] text-[#52576A] dark:text-[#CBD2E1]'
                    }`}>
                      {optionLabels[idx]}
                    </span>
                    <div className={`flex-1 pt-0.5 font-hindi font-bold min-w-0 break-words [overflow-wrap:anywhere] text-[0.965rem] sm:text-[1.03rem] leading-snug ${
                      isSelected ? 'text-white' : 'text-[#171923] dark:text-[#FFF9EF]'
                    }`}>
                      <RichText text={opt.text} />
                    </div>
                    {isSelected && (
                      <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 400 }} className="mt-1">
                        <div className="w-6 h-6 rounded-full bg-white flex items-center justify-center">
                          <Check size={14} className="text-[#800020] dark:text-[#F47B20]" strokeWidth={4} />
                        </div>
                      </motion.div>
                    )}
                  </motion.button>
                );
              })}
            </div>
          </div>

          {/* Right Column: CBT Sticky Question Palette (Desktop lg+ screens) */}
          <aside className="hidden lg:flex lg:col-span-4 flex-col gap-3.5 sticky top-2 bg-white dark:bg-[#1F2330] p-5 rounded-[26px] border border-[#E8D9C0] dark:border-[#31374A] shadow-2xs">
            <div className="flex items-center justify-between pb-3 border-b border-[#E8D9C0] dark:border-[#31374A]">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-[#800020]/10 dark:bg-[#F47B20]/15 text-[#800020] dark:text-[#F47B20] flex items-center justify-center">
                  <Grid size={18} />
                </div>
                <div>
                  <h3 className="text-xs font-black uppercase tracking-wider text-[#171923] dark:text-[#FFF9EF]">Question Palette</h3>
                  <p className="text-[10px] font-bold text-[#787D91] dark:text-[#929AB0]">{answeredCount} / {totalQuestions} Answered</p>
                </div>
              </div>
            </div>

            {/* Status Legend */}
            <div className="grid grid-cols-2 gap-2 text-[10.5px] font-bold text-[#52576A] dark:text-[#CBD2E1] pb-3 border-b border-[#E8D9C0]/60 dark:border-[#31374A]/60">
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-md bg-emerald-600 shrink-0" />
                <span>Answered ({answeredCount})</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-md bg-amber-500 shrink-0" />
                <span>Review ({reviewCount})</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-md bg-rose-600 shrink-0" />
                <span>Unanswered ({notAnsweredCount})</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-md bg-[#F7EFE2] dark:bg-[#252A3A] border border-[#E8D9C0] dark:border-[#31374A] shrink-0" />
                <span>Not Visited ({notVisitedCount})</span>
              </div>
            </div>

            {/* 1..N Question Grid */}
            <div className="max-h-[calc(100vh-340px)] min-h-[180px] overflow-y-auto pr-1">
              <div className="grid grid-cols-5 gap-2">
                {questions.map((q, idx) => {
                  const isAns = Boolean(sessionResults[q.id]);
                  const isRev = Boolean(reviewStates[q.id]);
                  const isVis = Boolean(visitedStates[q.id]);
                  const isCurr = idx === currentIndex;

                  let bg = "bg-[#F7EFE2] dark:bg-[#252A3A] border-[#E8D9C0] dark:border-[#31374A] text-[#52576A] dark:text-[#CBD2E1]";
                  if (isRev) bg = "bg-amber-500 border-amber-500 text-white shadow-xs shadow-amber-500/20";
                  else if (isAns) bg = "bg-emerald-600 border-emerald-600 text-white shadow-xs shadow-emerald-600/20";
                  else if (isVis) bg = "bg-rose-600 border-rose-600 text-white shadow-xs shadow-rose-600/20";

                  return (
                    <button
                      key={`cbt-${q.id}`}
                      onClick={() => setCurrentIndex(idx)}
                      className={`h-9 rounded-xl flex items-center justify-center font-black text-xs font-mono border-2 transition-all cursor-pointer active:scale-95 ${bg} ${
                        isCurr ? 'ring-2 ring-[#800020] dark:ring-[#F47B20] scale-105 z-10 !border-[#800020] dark:!border-[#F47B20]' : ''
                      }`}
                      title={`Jump to Question ${idx + 1}`}
                    >
                      {idx + 1}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Quick Submit */}
            <div className="pt-2 border-t border-[#E8D9C0] dark:border-[#31374A]">
              <button
                onClick={() => setShowSubmitConfirm(true)}
                className="w-full h-10 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-md shadow-emerald-600/20 transition-all cursor-pointer"
              >
                <CheckCircle2 size={16} />
                <span>Submit Exam</span>
              </button>
            </div>
          </aside>
        </div>
      </main>

      {/* 4. SMART BOTTOM NAVIGATION */}
      <footer className="sticky bottom-0 z-30 px-4 py-3 bg-white dark:bg-[#1F2330] border-t border-[#E8D9C0] dark:border-[#31374A] shadow-[0_-4px_20px_rgba(0,0,0,0.03)] pb-[calc(12px+env(safe-area-inset-bottom,0px))]">
        <div className="max-w-3xl lg:max-w-7xl mx-auto flex items-center justify-between gap-3">
          <button
            onClick={() => {
              if (isNavigatingRef.current) return;
              isNavigatingRef.current = true;
              setTimeout(() => {
                isNavigatingRef.current = false;
              }, 120);
              if (currentIndex > 0) setCurrentIndex(currentIndex - 1);
            }}
            disabled={currentIndex === 0}
            className="w-12 h-12 rounded-xl bg-[#F7EFE2] dark:bg-[#252A3A] text-[#171923] dark:text-[#FFF9EF] border border-[#E8D9C0] dark:border-[#31374A] flex items-center justify-center disabled:opacity-30 active:scale-90 transition-transform cursor-pointer shrink-0"
            title="Previous Question"
          >
            <ArrowLeft size={24} />
          </button>
          
          <button
            onClick={handleToggleReview}
            className={`flex-1 h-12 rounded-xl font-black text-[11px] uppercase tracking-widest flex flex-col items-center justify-center gap-0.5 transition-all active:scale-95 border-2 ${
              isCurrentMarkedForReview
                ? "bg-[#C99A45] border-[#C99A45] text-white shadow-sm shadow-[#C99A45]/20"
                : "bg-white dark:bg-[#252A3A] border-[#E8D9C0] dark:border-[#31374A] text-[#C99A45]"
            }`}
          >
            <Flag size={14} fill={isCurrentMarkedForReview ? "white" : "none"} />
            <span>Review</span>
          </button>

          <button
            onClick={handleClearResponse}
            disabled={selectedOptionIndex === null}
            className="flex-1 h-12 rounded-xl bg-[#F7EFE2] dark:bg-[#252A3A] text-[#52576A] dark:text-[#CBD2E1] border border-[#E8D9C0] dark:border-[#31374A] font-black text-[11px] uppercase tracking-widest disabled:opacity-30 active:scale-95 transition-all flex flex-col items-center justify-center gap-0.5"
          >
            <RotateCcw size={14} />
            <span>Clear</span>
          </button>

          <button
            onClick={() => {
              if (isNavigatingRef.current) return;
              isNavigatingRef.current = true;
              setTimeout(() => {
                isNavigatingRef.current = false;
              }, 120);
              if (currentIndex < totalQuestions - 1) {
                setCurrentIndex(currentIndex + 1);
              } else {
                setShowSubmitConfirm(true);
              }
            }}
            className="flex-[2] h-12 rounded-xl bg-[#800020] hover:bg-[#5E0017] dark:bg-[#F47B20] dark:hover:bg-[#E06A12] text-white font-black text-[12px] uppercase tracking-widest shadow-lg shadow-[#800020]/20 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>{currentIndex === totalQuestions - 1 ? "Submit Test" : "Save & Next"}</span>
            <ArrowRight size={16} />
          </button>
        </div>
      </footer>

      {/* 5. QUESTION PALETTE DRAWER */}
      <AnimatePresence>
        {showPaletteDrawer && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-end justify-center sm:items-center sm:p-5"
          >
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="bg-white dark:bg-[#111A2E] w-full max-w-lg h-[85vh] sm:rounded-[40px] rounded-t-[40px] flex flex-col overflow-hidden shadow-2xl"
            >
              {/* Drawer Handle */}
              <div className="flex justify-center pt-3 pb-1 shrink-0">
                <div className="w-12 h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full" />
              </div>

              <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                  <div className="bg-blue-600/10 p-2.5 rounded-2xl text-blue-600 dark:text-blue-400">
                    <Grid size={22} />
                  </div>
                  <div>
                    <h3 className="font-black text-slate-900 dark:text-white uppercase tracking-wider text-sm">Exam Navigator</h3>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Global Question Status</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowPaletteDrawer(false)}
                  className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 flex items-center justify-center active:scale-90 transition-transform cursor-pointer"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Status Stats */}
              <div className="p-5 bg-slate-50/50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-800 shrink-0 grid grid-cols-2 gap-3">
                {[
                  { label: "Answered", count: answeredCount, color: "emerald" },
                  { label: "Review", count: reviewCount, color: "amber" },
                  { label: "Unsolved", count: notAnsweredCount, color: "rose" },
                  { label: "Unvisited", count: notVisitedCount, color: "slate" }
                ].map((item) => (
                  <div key={item.label} className="bg-white dark:bg-[#111A2E] p-3 rounded-2xl border border-slate-200 dark:border-slate-800 flex items-center gap-3 shadow-sm">
                    <div className={`w-3 h-3 rounded-full bg-${item.color}-500 shadow-[0_0_8px_rgba(0,0,0,0.1)]`} />
                    <span className="text-[11px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      {item.label}: <span className="text-slate-900 dark:text-white font-mono">{item.count}</span>
                    </span>
                  </div>
                ))}
              </div>

              {/* Grid of Numbers */}
              <div className="flex-1 overflow-y-auto p-6 scrollbar-hide">
                <div className="grid grid-cols-5 gap-4">
                  {questions.map((q, idx) => {
                    const isAns = Boolean(sessionResults[q.id]);
                    const isRev = Boolean(reviewStates[q.id]);
                    const isVis = Boolean(visitedStates[q.id]);
                    const isCurr = idx === currentIndex;

                    let bg = "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400";
                    if (isRev) bg = "bg-amber-500 border-amber-500 text-white shadow-md shadow-amber-500/20";
                    else if (isAns) bg = "bg-emerald-600 border-emerald-600 text-white shadow-md shadow-emerald-600/20";
                    else if (isVis) bg = "bg-rose-600 border-rose-600 text-white shadow-md shadow-rose-600/20";

                    return (
                      <button
                        key={`drawer-${q.id}`}
                        onClick={() => {
                          setCurrentIndex(idx);
                          setShowPaletteDrawer(false);
                        }}
                        className={`h-11 rounded-[14px] flex items-center justify-center font-black text-sm font-mono border-2 transition-all active:scale-90 ${bg} ${isCurr ? 'ring-4 ring-blue-600/20 scale-110 z-10 !border-blue-600' : ''}`}
                      >
                        {idx + 1}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Submit CTA */}
              <div className="p-6 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-[#111A2E] space-y-4 pb-[calc(16px+env(safe-area-inset-bottom,0px))]">
                <div className="flex justify-between items-center px-1">
                  <span className="text-slate-500 dark:text-slate-400 font-bold uppercase tracking-widest text-[11px]">Submission Progress</span>
                  <span className="text-slate-900 dark:text-white font-black font-mono">{answeredCount} / {totalQuestions} Answered</span>
                </div>
                <button
                  onClick={() => {
                    setShowPaletteDrawer(false);
                    setShowSubmitConfirm(true);
                  }}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white h-14 rounded-2xl font-black text-base flex items-center justify-center gap-3 shadow-xl shadow-emerald-600/25 active:scale-95 transition-all cursor-pointer"
                >
                  <CheckCircle2 size={22} />
                  SUBMIT EXAMINATION
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      {/* Share Modal */}
      {shareData && (
        <ShareModal
          isOpen={!!shareData}
          onClose={() => setShareData(null)}
          data={shareData}
        />
      )}

      {/* CONFIRM SUBMIT TEST MODAL FOR LIVE & PYQ */}
      {showSubmitConfirm && (
        <div className="fixed inset-0 z-[200] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white dark:bg-[#111A2E] rounded-3xl p-6 sm:p-8 max-w-sm w-full text-center space-y-5 shadow-2xl border border-slate-200 dark:border-slate-800 animate-in zoom-in-95">
            <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
              <CheckCircle2 size={32} />
            </div>
            <div>
              <h4 className="text-xl font-black text-slate-900 dark:text-white">Final Submission</h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-medium">
                Are you ready to submit? You have answered {answeredCount} out of {totalQuestions} questions.
              </p>
            </div>
            <div className="space-y-2.5 pt-2">
              <button
                onClick={() => {
                  setShowSubmitConfirm(false);
                  onConfirmSubmit();
                }}
                className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-black uppercase tracking-wider rounded-2xl transition-all shadow-lg shadow-emerald-600/25 flex items-center justify-center gap-2 cursor-pointer"
              >
                <CheckCircle2 size={16} />
                Yes, Submit Examination
              </button>
              <button
                onClick={() => setShowSubmitConfirm(false)}
                className="w-full py-3.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-2xl transition-all cursor-pointer"
              >
                Continue Answering
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRM EXIT TEST MODAL FOR LIVE & PYQ */}
      {showExitConfirm && (
        <div className="fixed inset-0 z-[200] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white dark:bg-[#111A2E] rounded-3xl p-6 sm:p-8 max-w-sm w-full text-center space-y-5 shadow-2xl border border-slate-200 dark:border-slate-800 animate-in zoom-in-95">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto">
              <AlertCircle size={32} />
            </div>
            <div>
              <h4 className="text-xl font-black text-slate-900 dark:text-white">Quit Test?</h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-medium">
                You have answered {answeredCount} of {totalQuestions} questions. Your progress will be submitted.
              </p>
            </div>
            <div className="space-y-2.5 pt-2">
              <button
                onClick={() => {
                  setShowExitConfirm(false);
                  onConfirmSubmit();
                }}
                className="w-full py-4 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-xs font-black uppercase tracking-wider rounded-2xl transition-all shadow-lg shadow-blue-600/25 cursor-pointer"
              >
                Submit & View Results
              </button>
              <button
                onClick={() => setShowExitConfirm(false)}
                className="w-full py-3.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-2xl transition-all cursor-pointer"
              >
                Continue Test
              </button>
              <button
                onClick={onClose}
                className="w-full py-2 text-rose-600 dark:text-rose-400 text-xs font-bold hover:underline cursor-pointer"
              >
                Discard & Exit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface RedesignedTestInstructionsViewProps {
  session: MCQSession;
  questions: Question[];
  onStartSession: () => void;
  onClose: () => void;
}

const RedesignedTestInstructionsView: React.FC<RedesignedTestInstructionsViewProps> = ({
  session,
  questions,
  onStartSession,
  onClose,
}) => {
  const [confirmed, setConfirmed] = useState(true);

  const isLive = session.testType === "live" || session.isLiveTest;
  const isPYQ = session.testType === "pyq" || session.isPYQ;

  const liveDetails = session.liveTestDetails;
  const pyqDetails = session.pyqDetails;

  const totalQuestions = questions.length;
  const marksPerQ = session.marksPerQuestion || (isLive ? 2 : 1);
  const totalMarks = totalQuestions * marksPerQ;
  const durationMins = session.timeLimitMinutes || (isLive ? 120 : 180);
  const negMarking = session.negativeMarking ?? (isLive ? 0.66 : 0.33);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] bg-[#FFF9EF] dark:bg-[#171923] flex flex-col w-full"
      id="test-instructions-screen"
    >
      {/* Sticky Header */}
      <header className="sticky top-0 z-20 bg-white/95 dark:bg-[#1F2330]/95 backdrop-blur-md border-b border-[#E8D9C0] dark:border-[#31374A] px-4 py-3 flex items-center justify-between">
        <button
          onClick={onClose}
          className="w-10 h-10 rounded-2xl bg-[#F7EFE2] dark:bg-[#252A3A] text-[#171923] dark:text-[#FFF9EF] border border-[#E8D9C0] dark:border-[#31374A] flex items-center justify-center transition-all active:scale-90 cursor-pointer"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 px-4 text-center min-w-0">
          <h1 className="text-sm font-black text-[#171923] dark:text-[#FFF9EF] truncate font-hindi">
            {session.title}
          </h1>
          <p className="text-[10px] font-bold text-[#800020] dark:text-[#F47B20] uppercase tracking-widest">DISHA 20-20 Examination</p>
        </div>
        <div className="w-10" />
      </header>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto overscroll-contain">
        <div className="max-w-2xl mx-auto p-5 space-y-6">
          {/* Badge Section */}
          <div className="flex justify-center">
            {isLive ? (
              <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-wider bg-[#F47B20] text-white shadow-md">
                <Flame className="w-4 h-4 fill-white" /> LIVE MOCK TEST
              </span>
            ) : (
              <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-wider bg-[#800020] text-white shadow-md">
                <FileText className="w-4 h-4" /> OFFICIAL PYQ PAPER
              </span>
            )}
          </div>

          {/* Paper Context Card */}
          {(pyqDetails || liveDetails) && (
            <div className="p-4 rounded-[24px] bg-gradient-to-br from-[#800020] via-[#5E0017] to-[#171923] text-white shadow-xl border border-[#C99A45]/30">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-[#C99A45]/40">
                  <Award className="w-6 h-6 text-[#F47B20]" />
                </div>
                <div>
                  <h3 className="text-sm font-black leading-tight">
                    {pyqDetails ? `${pyqDetails.examBoard} ${pyqDetails.paperYear}` : "Live Mock Session"}
                  </h3>
                  <p className="text-[11px] text-[#FFF9EF]/80 font-bold uppercase tracking-wider mt-0.5">
                    {pyqDetails?.category || liveDetails?.examCategory || "Official Content"}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Highlights Grid */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "Questions", value: `${totalQuestions} Qs`, icon: Layers },
              { label: "Total Marks", value: `${totalMarks}`, icon: Target },
              { label: "Duration", value: `${durationMins} Mins`, icon: Clock },
              { label: "Marking", value: `+${marksPerQ} / -${negMarking}`, icon: Sparkles },
            ].map((item, i) => (
              <div key={i} className="bg-white dark:bg-[#1F2330] border border-[#E8D9C0] dark:border-[#31374A] p-4 rounded-[24px] shadow-2xs flex flex-col items-center text-center gap-1.5">
                <div className="w-8 h-8 rounded-xl bg-[#800020]/10 dark:bg-[#F47B20]/15 flex items-center justify-center text-[#800020] dark:text-[#F47B20] mb-0.5">
                  <item.icon className="w-4.5 h-4.5" />
                </div>
                <span className="text-[10px] font-black text-[#787D91] dark:text-[#929AB0] uppercase tracking-widest">{item.label}</span>
                <span className="text-sm font-black text-[#171923] dark:text-[#FFF9EF] font-mono tabular-nums">{item.value}</span>
              </div>
            ))}
          </div>

          {/* Rules Section */}
          <div className="bg-white dark:bg-[#1F2330] border border-[#E8D9C0] dark:border-[#31374A] rounded-[28px] p-5 space-y-4">
            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-[#171923] dark:text-[#FFF9EF] flex items-center gap-2">
              <Shield className="w-4 h-4 text-[#800020] dark:text-[#F47B20]" />
              Examination Protocol
            </h3>
            <div className="space-y-4">
              {[
                "Paper contains bilingual questions (Hindi & English).",
                `Correct choice awards ${marksPerQ} mark(s).`,
                `Wrong response incurs -${negMarking} negative mark.`,
                "Paper will auto-submit when timer hits 00:00.",
                "Results with detailed analysis shown instantly after submission."
              ].map((text, i) => (
                <div key={i} className="flex gap-3">
                  <div className="w-5 h-5 rounded-full bg-[#F7EFE2] dark:bg-[#252A3A] text-[#800020] dark:text-[#F47B20] font-black text-[10px] flex items-center justify-center shrink-0 mt-0.5 font-mono tabular-nums border border-[#E8D9C0] dark:border-[#31374A]">
                    {i + 1}
                  </div>
                  <p className="text-[12px] font-bold text-[#52576A] dark:text-[#CBD2E1] leading-snug">{text}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Confirmation */}
          <button 
            onClick={() => setConfirmed(!confirmed)}
            className={`w-full p-4 rounded-[24px] border-2 transition-all flex items-start gap-3 text-left ${
              confirmed 
                ? "bg-[#800020]/5 dark:bg-[#F47B20]/10 border-[#800020] dark:border-[#F47B20]" 
                : "bg-white dark:bg-[#1F2330] border-[#E8D9C0] dark:border-[#31374A]"
            }`}
          >
            <div className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 mt-0.5 border-2 transition-colors ${
              confirmed ? "bg-[#800020] dark:bg-[#F47B20] border-[#800020] dark:border-[#F47B20] text-white" : "border-[#E8D9C0] dark:border-[#31374A]"
            }`}>
              {confirmed && <Check className="w-4 h-4" strokeWidth={4} />}
            </div>
            <div className="flex-1">
              <span className="text-[13px] font-black text-[#171923] dark:text-[#FFF9EF] block">Ready to Begin?</span>
              <span className="text-[11px] font-bold text-[#52576A] dark:text-[#CBD2E1] block mt-0.5">I have read and understood all the test rules and guidelines.</span>
            </div>
          </button>
        </div>
      </div>

      {/* Start Button */}
      <footer className="p-4 bg-white dark:bg-[#1F2330] border-t border-[#E8D9C0] dark:border-[#31374A] pb-[calc(16px+env(safe-area-inset-bottom,0px))]">
        <div className="max-w-2xl mx-auto">
          <button
            id="btn-start-test-action"
            disabled={!confirmed}
            onClick={onStartSession}
            className={`w-full h-14 rounded-2xl font-black text-base flex items-center justify-center gap-3 transition-all ${
              confirmed
                ? "bg-gradient-to-r from-[#800020] via-[#5E0017] to-[#171923] text-white shadow-xl shadow-[#800020]/25 active:scale-95 cursor-pointer"
                : "bg-[#F7EFE2] dark:bg-[#252A3A] text-[#787D91] cursor-not-allowed opacity-70"
            }`}
          >
            <Play className="w-5 h-5 fill-[#F47B20] text-[#F47B20]" />
            <span>START EXAMINATION</span>
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      </footer>
    </motion.div>
  );
};

interface RedesignedTestResultViewProps {
  session: MCQSession;
  questions: Question[];
  sessionResults: Record<string, { selectedIndex: number; isCorrect: boolean; isSubmitted: boolean }>;
  elapsedSeconds: number;
  questionTimes: Record<string, number>;
  shuffledOptionsOrder: Record<string, number[]>;
  progressStore?: ProgressStore;
  userProfile?: UserProfile | null;
  onToggleBookmark?: (questionId: string) => void;
  onClose: () => void;
  onRestart: () => void;
  serverSubmission?: any | null;
  isGradingLiveTest?: boolean;
  liveSubmitError?: string | null;
}

const RedesignedTestResultView: React.FC<RedesignedTestResultViewProps> = ({
  session,
  questions,
  sessionResults,
  elapsedSeconds,
  shuffledOptionsOrder,
  progressStore = {},
  userProfile = null,
  onToggleBookmark = () => {},
  onClose,
  onRestart,
  serverSubmission = null,
  isGradingLiveTest = false,
  liveSubmitError = null,
}) => {
  const optionLabels = ["A", "B", "C", "D", "E", "F"];
  const [filter, setFilter] = useState<"all" | "correct" | "wrong" | "skipped">("all");
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportingQuestion, setReportingQuestion] = useState<any>(null);

  const isLive = session.testType === "live" || session.isLiveTest;

  const totalQuestions = questions.length;

  let localCorrect = 0;
  let localWrong = 0;
  let localUnattemptedE = 0;
  let localCompletelyBlank = 0;

  questions.forEach((q) => {
    const res = sessionResults[q.id];
    if (!res || res.selectedIndex === undefined || res.selectedIndex === null || res.selectedIndex === -1) {
      localCompletelyBlank++;
    } else if (res.selectedIndex === 4) {
      localUnattemptedE++;
    } else if (res.isCorrect) {
      localCorrect++;
    } else {
      localWrong++;
    }
  });

  const totalCorrect = serverSubmission ? Number(serverSubmission.correctCount ?? localCorrect) : localCorrect;
  const totalWrong = serverSubmission ? Number(serverSubmission.wrongCount ?? localWrong) : localWrong;
  const totalUnattemptedE = serverSubmission ? Number(serverSubmission.unattemptedECount ?? localUnattemptedE) : localUnattemptedE;
  const totalCompletelyBlank = serverSubmission ? Number(serverSubmission.completelyBlankCount ?? localCompletelyBlank) : localCompletelyBlank;
  const totalSkipped = totalUnattemptedE + totalCompletelyBlank;
  const totalAttempted = totalCorrect + totalWrong;

  const isPerfectScore =
    totalQuestions > 0 &&
    totalAttempted === totalQuestions &&
    totalCorrect === totalQuestions;
  const [showPerfectCelebration, setShowPerfectCelebration] = useState(isPerfectScore);
  const [shareData, setShareData] = useState<ShareData | null>(null);

  const marksPerQ = session.marksPerQuestion || (isLive ? 2 : 1);
  const negMarksPerQ = session.negativeMarking ?? (isLive ? 0.66 : Number((marksPerQ / 3).toFixed(2)));
  const blankPenaltyPerQ = Number((marksPerQ / 3).toFixed(2));
  const blankPenalty = Number((totalCompletelyBlank * blankPenaltyPerQ).toFixed(2));

  const rawScore = (totalCorrect * marksPerQ) - (totalWrong * negMarksPerQ) - blankPenalty;
  const obtainedMarks = serverSubmission ? Number(serverSubmission.score ?? Math.max(0, Number(rawScore.toFixed(2)))) : Math.max(0, Number(rawScore.toFixed(2)));
  const maxMarks = serverSubmission ? Number(serverSubmission.totalMarks ?? totalQuestions * marksPerQ) : totalQuestions * marksPerQ;
  const scorePercent = maxMarks > 0 ? Math.round((obtainedMarks / maxMarks) * 100) : 0;
  const accuracy = serverSubmission ? Number(serverSubmission.accuracy ?? (totalAttempted > 0 ? Math.round((totalCorrect / totalAttempted) * 100) : 0)) : (totalAttempted > 0 ? Math.round((totalCorrect / totalAttempted) * 100) : 0);
  const isRpscDisqualified = serverSubmission ? Boolean(serverSubmission.isRpscDisqualified) : (totalQuestions > 0 && totalCompletelyBlank > totalQuestions * 0.10);

  const avgTimePerQuestion = totalAttempted > 0 ? (elapsedSeconds / totalAttempted).toFixed(1) : "0";

  const formatTime = (totalSecs: number) => {
    const safeSecs = Math.max(0, Math.floor(Number(totalSecs) || 0));
    const hrs = Math.floor(safeSecs / 3600);
    const mins = Math.floor((safeSecs % 3600) / 60);
    const secs = safeSecs % 60;
    if (hrs > 0) {
      return `${String(hrs).padStart(2, "0")}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
    }
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };

  const handleShareResult = () => {
    const title = `🎯 I scored ${scorePercent}% (${obtainedMarks}/${maxMarks}) in "${session.title}" on DISHA 20-20!`;
    const text = `Accuracy: ${accuracy}% | Correct: ${totalCorrect}/${totalQuestions} | Option E: ${totalUnattemptedE} | Time: ${formatTime(elapsedSeconds)}.\nPractice this quiz and official PYQs with explanations on DISHA 20-20:`;
    setShareData({
      title,
      text,
      url: typeof window !== "undefined" ? window.location.origin : "https://disha2020.in",
      category: "Quiz Scorecard",
    });
  };

  const filteredQuestions = useMemo(() => {
    const list = questions.filter((q) => {
      const res = sessionResults[q.id];
      if (filter === "correct") return res?.isCorrect === true;
      if (filter === "wrong") return res && !res.isCorrect;
      if (filter === "skipped") return !res;
      return true;
    });
    const deduped = new Map<string, Question>();
    list.forEach(q => deduped.set(q.id, q));
    return Array.from(deduped.values());
  }, [questions, sessionResults, filter]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
      id="test-result-screen"
      className="fixed inset-0 z-[100] bg-[#FFF9EF] dark:bg-[#120E10] flex flex-col w-full"
    >
      {/* Sticky Header for Result Page */}
      <header className="sticky top-0 z-[110] bg-[#FFF9EF]/90 dark:bg-[#120E10]/90 backdrop-blur-md border-b border-[#E8D9C0] dark:border-[#2D2226] px-4 py-3 flex items-center justify-between shrink-0">
        <button
          onClick={onClose}
          className="w-10 h-10 rounded-xl bg-white dark:bg-[#1C1518] border border-[#E8D9C0] dark:border-[#2D2226] text-[#800020] dark:text-[#E5B869] flex items-center justify-center transition-all active:scale-90 shadow-sm cursor-pointer"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 px-4 text-center min-w-0">
          <h2 className="text-sm font-black text-[#171923] dark:text-[#FFF9EF] truncate">
            {session.title}
          </h2>
          <p className="text-[10px] font-bold text-[#800020] dark:text-[#C99A45] uppercase tracking-widest">
            Scorecard & Analysis
          </p>
        </div>
        <div className="w-10" />
      </header>

      <div className="flex-1 overflow-y-auto overscroll-y-contain flex flex-col items-center justify-start p-3 sm:p-6 w-full">
      {/* Framer-Motion Confetti Animation for 100% Accuracy Perfect Score */}
      {showPerfectCelebration && (
        <MotionConfettiCelebration
          isOpen={showPerfectCelebration}
          onClose={() => setShowPerfectCelebration(false)}
          totalQuestions={totalQuestions}
          sessionTitle={session.title}
          accuracy={100}
        />
      )}

      {/* Decorative Background for Results (DISHA Burgundy & Gold ambient glow) */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-4xl h-[450px] bg-gradient-to-b from-[#800020]/10 via-[#C99A45]/5 to-transparent dark:from-[#800020]/15 dark:via-[#C99A45]/5 rounded-full blur-[120px]" />
      </div>

      <motion.div 
        variants={{
          hidden: { opacity: 0, y: 20 },
          show: { 
            opacity: 1, 
            y: 0,
            transition: {
              staggerChildren: 0.08,
              delayChildren: 0.1,
              duration: 0.5,
              ease: [0.16, 1, 0.3, 1]
            }
          }
        }}
        initial="hidden"
        animate="show"
        className="w-full max-w-2xl space-y-4 sm:space-y-6 pb-[calc(env(safe-area-inset-bottom,20px)+64px)] relative z-10"
      >
        {isLive && (isGradingLiveTest || liveSubmitError) && (
          <div
            className={`rounded-2xl p-3.5 border text-xs font-bold flex items-center gap-2.5 ${
              liveSubmitError
                ? "bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300"
                : "bg-[#FAF5ED] dark:bg-[#20181B] border-[#C99A45]/40 text-[#800020] dark:text-[#E5B869]"
            }`}
          >
            <AlertCircle className="w-4 h-4 shrink-0 text-[#800020] dark:text-[#E5B869]" />
            <span>
              {liveSubmitError
                ? liveSubmitError
                : "Evaluating live test answers securely on server..."}
            </span>
          </div>
        )}
        {/* RPSC 10% Blank Rule Disqualification Alert */}
        {isRpscDisqualified && (
          <div className="p-3.5 sm:p-4 rounded-2xl bg-rose-500/10 border-2 border-rose-500/30 text-rose-800 dark:text-rose-200 text-left space-y-1.5 shadow-sm">
            <div className="flex items-center gap-2 font-black text-xs sm:text-sm text-rose-600 dark:text-rose-400">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400" />
              <span>⚠️ RPSC नियम चेतावनी: उम्मीदवारी अयोग्य (Disqualified)!</span>
            </div>
            <p className="text-[11px] sm:text-xs leading-relaxed text-rose-700 dark:text-rose-300">
              आपने <strong>{totalCompletelyBlank} प्रश्न</strong> बिना 5वां विकल्प (Option E) भरे रिक्त छोड़ दिए हैं ({((totalCompletelyBlank / Math.max(1, totalQuestions)) * 100).toFixed(1)}%)। RPSC के आधिकारिक नियम के अनुसार 10% से अधिक प्रश्न खाली छोड़ने पर अभ्यर्थी को परीक्षा से अयोग्य घोषित कर दिया जाता है।
            </p>
          </div>
        )}

        {/* Header & Score Card: High-Fidelity Performance Summary */}
        <motion.div 
          variants={{
            hidden: { opacity: 0, y: 20, scale: 0.95 },
            show: { opacity: 1, y: 0, scale: 1 }
          }}
          className="bg-white dark:bg-[#1A1417] border border-[#E8D9C0] dark:border-[#2F2227] rounded-2xl sm:rounded-3xl p-4 sm:p-5 shadow-[0_12px_32px_rgba(128,0,32,0.06)] dark:shadow-none text-center space-y-3.5 sm:space-y-4 relative overflow-hidden"
        >
          {/* DISHA Top Accent Gradient Line */}
          <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-[#800020] via-[#C99A45] to-[#800020]" />
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-48 bg-[#C99A45]/10 rounded-full blur-[60px] pointer-events-none" />

          <motion.div 
            variants={{
              hidden: { opacity: 0, scale: 0.8 },
              show: { opacity: 1, scale: 1 }
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-[0.2em] bg-[#FAF5ED] dark:bg-[#251A1E] text-[#800020] dark:text-[#E5B869] border border-[#E8D9C0] dark:border-[#38262C] font-mono shadow-sm"
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-[#C99A45]" />
            <span>Examination Complete</span>
          </motion.div>

          <div className="relative z-10 space-y-0.5">
            <h1 className="text-xl sm:text-2xl font-black text-[#171923] dark:text-[#FFF9EF] tracking-tight">
              {session.title}
            </h1>
            <p className="text-[11px] font-bold text-[#718096] dark:text-[#9E8E95] uppercase tracking-widest">
              {isLive ? "Official Live Mock Results" : "Official Past Paper Results"}
            </p>
          </div>

          <div className="grid grid-cols-3 gap-2 sm:gap-2.5 pt-0.5 relative z-10">
            <div className="p-2.5 sm:p-3 rounded-xl sm:rounded-2xl bg-[#FAF5ED] dark:bg-[#20181B] border border-[#E8D9C0] dark:border-[#33252A] shadow-sm">
              <span className="text-[8px] sm:text-[9px] font-black uppercase tracking-wider text-[#800020] dark:text-[#E5B869] block mb-0.5">Marks</span>
              <span className="text-lg sm:text-xl font-black text-[#171923] dark:text-[#FFF9EF] font-mono block">
                {obtainedMarks}
              </span>
              <span className="text-[9px] font-bold text-[#718096] dark:text-[#8C7D83] mt-0.5 block">/ {maxMarks}</span>
            </div>

            <div className="p-2.5 sm:p-3 rounded-xl sm:rounded-2xl bg-[#FAF5ED] dark:bg-[#20181B] border border-[#E8D9C0] dark:border-[#33252A] shadow-sm">
              <span className="text-[8px] sm:text-[9px] font-black uppercase tracking-wider text-[#C99A45] block mb-0.5">Score</span>
              <span className="text-lg sm:text-xl font-black text-[#171923] dark:text-[#FFF9EF] font-mono block">
                {scorePercent}%
              </span>
              <span className="text-[9px] font-bold text-[#718096] dark:text-[#8C7D83] mt-0.5 block">Percentile</span>
            </div>

            <div className="p-2.5 sm:p-3 rounded-xl sm:rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-900/40 shadow-sm">
              <span className="text-[8px] sm:text-[9px] font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-400 block mb-0.5">Accuracy</span>
              <span className="text-lg sm:text-xl font-black text-emerald-800 dark:text-emerald-300 font-mono block">
                {accuracy}%
              </span>
              <span className="text-[9px] font-bold text-emerald-700 dark:text-emerald-400 mt-0.5 block">Precision</span>
            </div>
          </div>

          {/* Positive vs Negative Marking Breakdown */}
          <div className="flex flex-wrap items-center justify-center gap-2 text-[10px] sm:text-[11px] font-black font-mono pt-1 pb-0.5 relative z-10">
            <span className="px-2.5 py-1 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200/80 dark:border-emerald-800/60">
              +{Number((totalCorrect * marksPerQ).toFixed(2))} Gained
            </span>
            <span className="text-[#E8D9C0] dark:text-[#33252A]">•</span>
            <span className="px-2.5 py-1 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border border-rose-200/80 dark:border-rose-800/60">
              -{Number((totalWrong * negMarksPerQ).toFixed(2))} Wrong (-1/3)
            </span>
            {blankPenalty > 0 && (
              <>
                <span className="text-[#E8D9C0] dark:text-[#33252A]">•</span>
                <span className="px-2.5 py-1 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-200/80 dark:border-amber-800/60">
                  -{blankPenalty} Blank Penalty
                </span>
              </>
            )}
          </div>

          <div className="grid grid-cols-4 gap-1.5 sm:gap-2 pt-2 border-t border-[#E8D9C0]/80 dark:border-[#2F2227] relative z-10">
            {[
              { label: "Correct", value: totalCorrect, color: "text-emerald-700 dark:text-emerald-400" },
              { label: "Incorrect", value: totalWrong, color: "text-rose-700 dark:text-rose-400" },
              { label: "Option E", value: totalUnattemptedE, color: "text-[#800020] dark:text-[#E5B869]" },
              { label: "Duration", value: formatTime(elapsedSeconds), color: "text-[#171923] dark:text-[#FFF9EF]" }
            ].map((item, i) => (
              <motion.div 
                key={i} 
                variants={{
                  hidden: { opacity: 0 },
                  show: { opacity: 1 }
                }}
                className="text-center"
              >
                <span className="text-[8px] sm:text-[9px] font-black text-[#718096] dark:text-[#8C7D83] block uppercase tracking-wider mb-0.5">{item.label}</span>
                <span className={`text-xs sm:text-sm font-black ${item.color} font-mono`}>{item.value}</span>
              </motion.div>
            ))}
          </div>

          {/* 100% Accuracy Highlight */}
          {isPerfectScore && (
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.25 }}
              className="mt-2 p-3 sm:p-3.5 rounded-xl sm:rounded-2xl bg-gradient-to-r from-[#800020]/10 via-[#C99A45]/20 to-[#800020]/10 border border-[#C99A45]/40 flex items-center justify-between gap-3 text-left shadow-sm relative z-10"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#800020] to-[#520014] border border-[#C99A45] text-[#E5B869] flex items-center justify-center shrink-0">
                  <Sparkles className="w-4 h-4 fill-current" />
                </div>
                <div className="min-w-0">
                  <span className="text-[9px] font-black uppercase tracking-[0.15em] text-[#800020] dark:text-[#E5B869] font-mono block mb-0.5">
                    100% Perfect Score
                  </span>
                  <p className="text-[11px] text-[#171923] dark:text-[#FAF5ED] font-bold leading-tight truncate">
                    Outstanding performance! You answered all questions correctly.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowPerfectCelebration(true)}
                className="px-3 py-1.5 rounded-lg bg-[#800020] hover:bg-[#660019] text-[#FFF9EF] font-black text-[10px] active:scale-95 transition-all shadow cursor-pointer shrink-0 border border-[#C99A45]/40"
              >
                🎉 REPLAY
              </button>
            </motion.div>
          )}

          {/* Quick Review Mistakes Action */}
          {totalWrong > 0 && (
            <div className="pt-1.5 relative z-10">
              <button
                type="button"
                onClick={() => {
                  setFilter("wrong");
                  const el = document.getElementById("solutions-audit-section");
                  if (el) el.scrollIntoView({ behavior: "smooth" });
                }}
                className="w-full py-2.5 px-3 rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/50 text-rose-700 dark:text-rose-300 border border-rose-200/80 dark:border-rose-800/60 font-black text-xs flex items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer"
              >
                <XCircle className="w-4 h-4" />
                <span>REVIEW {totalWrong} MISTAKES</span>
              </button>
            </div>
          )}

          {/* Social Share Call to Action */}
          <div className="pt-1.5 relative z-10">
            <button
              type="button"
              onClick={handleShareResult}
              className="w-full py-2.5 sm:py-3 px-4 rounded-xl bg-[#FAF5ED] dark:bg-[#1E171A] hover:bg-[#F5EBE1] text-[#800020] dark:text-[#E5B869] border border-[#C99A45]/40 font-black text-xs sm:text-sm active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm"
            >
              <Share2 className="w-4 h-4 text-[#800020] dark:text-[#E5B869]" />
              <span>SHARE SCORECARD</span>
            </button>
          </div>
        </motion.div>

        {/* Performance Visualization Dashboard (Test View) */}
        <motion.div
          variants={{
            hidden: { opacity: 0, y: 20 },
            show: { opacity: 1, y: 0 }
          }}
          className="bg-white dark:bg-[#1A1417] border border-[#E8D9C0] dark:border-[#2F2227] rounded-2xl sm:rounded-3xl p-4 sm:p-5 shadow-sm space-y-4"
        >
          {/* Analytics Header */}
          <div className="flex items-center justify-between border-b border-[#E8D9C0]/70 dark:border-[#2F2227] pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-[#FAF5ED] dark:bg-[#20181B] text-[#800020] dark:text-[#E5B869] border border-[#C99A45]/40 flex items-center justify-center">
                <Target className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs sm:text-sm font-black text-[#171923] dark:text-[#FFF9EF] uppercase tracking-wider">
                  Test Performance Analytics
                </h3>
                <p className="text-[10px] font-bold text-[#718096] dark:text-[#8C7D83]">
                  Sectional metrics & negative marking impact
                </p>
              </div>
            </div>
            <span className="px-2.5 py-1 rounded-full bg-[#FAF5ED] dark:bg-[#20181B] border border-[#C99A45]/30 text-[9px] font-black text-[#800020] dark:text-[#E5B869] font-mono">
              {scorePercent}% MARKS
            </span>
          </div>

          {/* 1. Proportional Attempt Distribution Bar */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-[11px] font-bold">
              <span className="text-[#171923] dark:text-[#FAF5ED]">Attempt Breakdown</span>
              <span className="text-[#718096] dark:text-[#8C7D83] font-mono">
                {totalAttempted}/{totalQuestions} Attempted ({Math.round((totalAttempted / Math.max(1, totalQuestions)) * 100)}%)
              </span>
            </div>
            
            <div className="h-3.5 w-full bg-[#FAF5ED] dark:bg-[#20181B] rounded-full overflow-hidden flex border border-[#E8D9C0]/80 dark:border-[#33252A]">
              {totalCorrect > 0 && (
                <div 
                  style={{ width: `${(totalCorrect / totalQuestions) * 100}%` }} 
                  className="h-full bg-emerald-600 transition-all duration-500" 
                  title={`Correct: ${totalCorrect}`}
                />
              )}
              {totalWrong > 0 && (
                <div 
                  style={{ width: `${(totalWrong / totalQuestions) * 100}%` }} 
                  className="h-full bg-rose-600 transition-all duration-500" 
                  title={`Incorrect: ${totalWrong}`}
                />
              )}
              {totalUnattemptedE > 0 && (
                <div 
                  style={{ width: `${(totalUnattemptedE / totalQuestions) * 100}%` }} 
                  className="h-full bg-[#C99A45] transition-all duration-500" 
                  title={`Option E: ${totalUnattemptedE}`}
                />
              )}
              {totalCompletelyBlank > 0 && (
                <div 
                  style={{ width: `${(totalCompletelyBlank / totalQuestions) * 100}%` }} 
                  className="h-full bg-stone-400 transition-all duration-500" 
                  title={`Completely Blank: ${totalCompletelyBlank}`}
                />
              )}
            </div>

            {/* Distribution Legend */}
            <div className="flex items-center justify-between text-[10px] font-bold pt-0.5 flex-wrap gap-1">
              <div className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400">
                <span className="w-2 h-2 rounded-full bg-emerald-600" />
                <span>Correct: {totalCorrect}</span>
              </div>
              <div className="flex items-center gap-1.5 text-rose-700 dark:text-rose-400">
                <span className="w-2 h-2 rounded-full bg-rose-600" />
                <span>Wrong: {totalWrong}</span>
              </div>
              <div className="flex items-center gap-1.5 text-[#800020] dark:text-[#E5B869]">
                <span className="w-2 h-2 rounded-full bg-[#C99A45]" />
                <span>Option E: {totalUnattemptedE}</span>
              </div>
              {totalCompletelyBlank > 0 && (
                <div className="flex items-center gap-1.5 text-stone-500">
                  <span className="w-2 h-2 rounded-full bg-stone-400" />
                  <span>Blank: {totalCompletelyBlank}</span>
                </div>
              )}
            </div>
          </div>

          {/* 2. Qualifying Cutoff Benchmark */}
          <div className="space-y-1.5 pt-1">
            <div className="flex items-center justify-between text-[11px] font-bold">
              <div className="flex items-center gap-1.5 text-[#171923] dark:text-[#FAF5ED]">
                <Award className="w-3.5 h-3.5 text-[#C99A45]" />
                <span>Qualifying Cutoff Benchmark (40%)</span>
              </div>
              <span className={`font-mono ${scorePercent >= 40 ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400'}`}>
                {scorePercent >= 40 ? `+${scorePercent - 40}% Above Cutoff` : `${40 - scorePercent}% Below Cutoff`}
              </span>
            </div>
            <div className="relative h-2 w-full bg-[#FAF5ED] dark:bg-[#20181B] rounded-full overflow-hidden border border-[#E8D9C0]/80 dark:border-[#33252A]">
              <div className="absolute top-0 bottom-0 left-[40%] w-0.5 bg-[#800020] dark:bg-[#C99A45] z-10" />
              <div
                style={{ width: `${Math.min(100, scorePercent)}%` }}
                className={`h-full transition-all duration-500 ${
                  scorePercent >= 60
                    ? "bg-emerald-600"
                    : scorePercent >= 40
                    ? "bg-[#C99A45]"
                    : "bg-rose-600"
                }`}
              />
            </div>
          </div>

          {/* 3. Time Management Summary */}
          <div className="grid grid-cols-2 gap-2.5 pt-1">
            <div className="p-3 rounded-xl bg-[#FAF5ED] dark:bg-[#20181B] border border-[#E8D9C0] dark:border-[#33252A] flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-white dark:bg-[#1A1417] border border-[#E8D9C0] dark:border-[#2F2227] flex items-center justify-center text-[#800020] dark:text-[#E5B869] shrink-0">
                <Clock className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <span className="text-[9px] font-black uppercase tracking-wider text-[#718096] dark:text-[#8C7D83] block leading-none mb-1">
                  Duration
                </span>
                <span className="text-sm font-black font-mono text-[#171923] dark:text-[#FFF9EF] block leading-none">
                  {formatTime(elapsedSeconds)}
                </span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-[#FAF5ED] dark:bg-[#20181B] border border-[#E8D9C0] dark:border-[#33252A] flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-white dark:bg-[#1A1417] border border-[#E8D9C0] dark:border-[#2F2227] flex items-center justify-center text-[#800020] dark:text-[#E5B869] shrink-0">
                <Zap className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <span className="text-[9px] font-black uppercase tracking-wider text-[#718096] dark:text-[#8C7D83] block leading-none mb-1">
                  Avg Pace / Q
                </span>
                <span className="text-sm font-black font-mono text-[#171923] dark:text-[#FFF9EF] block leading-none">
                  {avgTimePerQuestion}s
                </span>
              </div>
            </div>
          </div>

          {/* 4. Strategic Performance Insights */}
          <div className="p-3 rounded-xl bg-gradient-to-r from-[#800020]/10 via-[#FAF5ED] to-[#800020]/5 dark:from-[#800020]/20 dark:via-[#1D1619] dark:to-[#800020]/10 border border-[#C99A45]/30 flex items-start gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-[#800020] text-[#E5B869] flex items-center justify-center shrink-0 mt-0.5">
              <TrendingUp className="w-3.5 h-3.5" />
            </div>
            <div className="space-y-0.5 min-w-0">
              <span className="text-[9px] font-black uppercase tracking-widest text-[#800020] dark:text-[#E5B869]">
                Examination Strategy Insight
              </span>
              <p className="text-[11px] font-bold text-[#171923] dark:text-[#FAF5ED] leading-snug">
                {scorePercent >= 70
                  ? "🔥 Merit Level Performance! You have scored comfortably above competitive exam cutoffs. Focus on speed drills."
                  : scorePercent >= 40
                  ? `🎯 Qualified! You secured ${obtainedMarks} marks. Reducing negative marking (-${Number((totalWrong * negMarksPerQ).toFixed(2))}) will elevate your rank significantly.`
                  : isRpscDisqualified
                  ? `⚠️ Attention: High blank question count triggered RPSC disqualification threshold. Always bubble Option E for unattempted questions.`
                  : `💡 Score below 40% threshold. Analyze question-by-question explanations in the audit below to bridge subject gaps.`}
              </p>
            </div>
          </div>
        </motion.div>

        {/* Live Aspirants Leaderboard */}
        <motion.div
          variants={{
            hidden: { opacity: 0, y: 20 },
            show: { opacity: 1, y: 0 }
          }}
          id="session-leaderboard-section"
        >
          <SessionLeaderboard
            testId={session.testId || (session as any).id || session.title}
            testTitle={session.title}
            currentScore={totalCorrect}
            maxScore={totalQuestions}
            accuracy={accuracy}
            timeSpentSeconds={elapsedSeconds}
            userProfile={userProfile}
            allowCloudWrite={Boolean(
              !isLive && (
                session.isPYQ ||
                session.testType === "pyq" ||
                session.pyqDetails ||
                (session.source as any) === "pyq"
              )
            )}
          />
        </motion.div>

        {/* Detailed Solutions */}
        <motion.div 
          variants={{
            hidden: { opacity: 0, y: 20 },
            show: { opacity: 1, y: 0 }
          }}
          id="solutions-audit-section"
          className="bg-white dark:bg-[#1A1417] border border-[#E8D9C0] dark:border-[#2F2227] rounded-2xl sm:rounded-3xl p-4 sm:p-5 space-y-4 shadow-sm"
        >
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h3 className="text-xs sm:text-sm font-black uppercase tracking-wider text-[#171923] dark:text-[#FFF9EF] flex items-center gap-2">
              <FileText className="w-4 h-4 text-[#800020] dark:text-[#E5B869]" />
              Solutions & Answer Key
            </h3>
            <span className="text-[10px] font-mono text-[#718096] dark:text-[#8C7D83] font-bold">Showing {filteredQuestions.length} Qs</span>
          </div>

          {/* Segmented Filter Control */}
          <div className="p-1 bg-[#FAF5ED] dark:bg-[#181114] border border-[#E8D9C0] dark:border-[#2D2226] rounded-2xl flex items-center gap-1">
            {[
              { id: "all", label: "All", count: totalQuestions },
              { id: "correct", label: "Correct", count: totalCorrect },
              { id: "wrong", label: "Wrong", count: totalWrong },
              { id: "skipped", label: "Skipped", count: totalSkipped },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setFilter(tab.id as any)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                  filter === tab.id
                    ? "bg-[#800020] text-white shadow-sm"
                    : "text-[#718096] hover:text-[#171923] dark:text-[#8C7D83] dark:hover:text-[#FFF9EF]"
                }`}
              >
                <span>{tab.label}</span>
                <span className={`px-1.5 rounded-md text-[10px] font-mono ${
                  filter === tab.id 
                    ? "bg-[#C99A45]/30 text-white" 
                    : "bg-[#E8D9C0]/50 dark:bg-[#2A2024] text-[#718096] dark:text-[#8C7D83]"
                }`}>
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

          <motion.div 
            variants={{
              hidden: { opacity: 0 },
              show: { 
                opacity: 1,
                transition: { staggerChildren: 0.05 }
              }
            }}
            className="space-y-4 pt-1"
          >
            {filteredQuestions.map((q, idx) => {
              const res = sessionResults[q.id];
              const isUserCorrect = res?.isCorrect;
              const userPick = res?.selectedIndex;
              const hasAttempted = res !== undefined;
              const isQBookmarked = Boolean(progressStore[q.id]?.bookmarked);

              return (
                <motion.div
                  key={`${q.id}-${idx}`}
                  variants={{
                    hidden: { opacity: 0, x: -10 },
                    show: { opacity: 1, x: 0 }
                  }}
                  className="bg-white dark:bg-[#1A1417] border border-[#E8D9C0] dark:border-[#2F2227] rounded-2xl sm:rounded-3xl overflow-hidden shadow-sm hover:shadow-md transition-shadow flex flex-col"
                >
                  {/* Audit Card Header */}
                  <div className="px-4 py-3 sm:px-5 sm:py-3.5 border-b border-[#E8D9C0]/80 dark:border-[#2F2227] flex items-center justify-between gap-3 bg-[#FAF5ED]/50 dark:bg-[#1F181B]/50">
                    <div className="flex items-center gap-2.5">
                      <span className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-[#800020] text-white font-mono font-black text-xs flex items-center justify-center border border-[#C99A45]/30">
                        #{questions.findIndex(item => item.id === q.id) + 1}
                      </span>
                      
                      <div className="flex flex-col">
                        <span className="text-[9px] font-black text-[#718096] dark:text-[#8C7D83] uppercase tracking-widest leading-none mb-1">Status</span>
                        {hasAttempted ? (
                          <div className="flex items-center gap-2">
                            <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md flex items-center gap-1.5 ${
                              isUserCorrect ? "bg-emerald-600 text-white" : "bg-rose-600 text-white"
                            }`}>
                              {isUserCorrect ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                              {isUserCorrect ? "Correct" : "Incorrect"}
                            </span>
                          </div>
                        ) : (
                          <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-[#718096] text-white">Skipped</span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => {
                          playClickSound();
                          setReportingQuestion(q);
                          setShowReportModal(true);
                        }}
                        className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl border flex items-center justify-center transition-all cursor-pointer bg-white dark:bg-[#20181B] border-[#E8D9C0] dark:border-[#33252A] text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/20"
                        title="प्रश्न पर दावा / आपत्ति दर्ज करें (Report Question)"
                        aria-label="Report Question"
                      >
                        <Flag className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
                      </motion.button>

                      <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => onToggleBookmark(q.id)}
                        className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl border flex items-center justify-center transition-all cursor-pointer ${
                          isQBookmarked
                            ? "bg-[#C99A45] border-[#C99A45] text-white shadow-md shadow-[#C99A45]/20"
                            : "bg-white dark:bg-[#20181B] border-[#E8D9C0] dark:border-[#33252A] text-[#718096]"
                        }`}
                        title={isQBookmarked ? "Remove Bookmark" : "Bookmark Question"}
                      >
                        <Bookmark className={`w-4 h-4 sm:w-5 sm:h-5 ${isQBookmarked ? 'fill-current' : ''}`} />
                      </motion.button>
                    </div>
                  </div>

                  <div className="p-4 sm:p-6 space-y-5">
                    {/* Question Content */}
                    <div className="font-hindi text-[#171923] dark:text-[#FFF9EF] text-sm sm:text-base font-black leading-relaxed">
                      <ParsedQuestion text={q.text} fontSizeClass="text-sm sm:text-base" question={q} />
                    </div>

                    {/* Options Breakdown */}
                    <div className="space-y-2">
                      {(() => {
                        const order = shuffledOptionsOrder[q.id];
                        const optList = Array.isArray(q.options) ? q.options : [];
                        const displayIndices = order && order.length === optList.length ? order : optList.map((_, i) => i);
                        
                        return displayIndices.map((originalIdx, displayIdx) => {
                          const optText = optList[originalIdx] || "";
                          const isThisCorrect = originalIdx === q.correctIndex;
                          const isUserSelection = userPick === originalIdx;
                          
                          const qType = q.questionType?.toLowerCase() || "";
                          const isMatch = qType === "match_following" || qType === "match" || qType === "pair_based" || qType === "pairs";
                          
                          if (isMatch && optList.length > 4) {
                            const looksLikePairing = /[-–—]/.test(optText) || /\([a-z]\)/i.test(optText) || /,\s*\d+/.test(optText);
                            if (!looksLikePairing) return null;
                          }

                          let cardClass = "bg-[#FAF5ED]/50 dark:bg-[#1E171A]/50 border-[#E8D9C0] dark:border-[#2F2227] text-[#171923] dark:text-[#E2D9D2]";
                          let badgeClass = "bg-[#E8D9C0]/50 dark:bg-[#2F2227] text-[#718096] dark:text-[#8C7D83]";

                          if (isThisCorrect) {
                            cardClass = "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-500 text-emerald-950 dark:text-emerald-50 ring-2 ring-emerald-500/20";
                            badgeClass = "bg-emerald-600 text-white font-black";
                          } else if (isUserSelection && !isThisCorrect) {
                            cardClass = "bg-rose-50 dark:bg-rose-950/20 border-rose-500 text-rose-950 dark:text-rose-50 ring-2 ring-rose-500/20";
                            badgeClass = "bg-rose-600 text-white font-black";
                          }

                          return (
                            <div
                              key={originalIdx}
                              className={`p-3 sm:p-3.5 rounded-xl sm:rounded-2xl border flex items-start gap-3 transition-all duration-300 ${cardClass}`}
                            >
                              <span className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl flex items-center justify-center font-mono text-xs shrink-0 mt-0.5 ${badgeClass}`}>
                                {optionLabels[displayIdx]}
                              </span>
                              <div className="font-hindi flex-1 leading-snug pt-0.5 min-w-0 font-bold text-xs sm:text-sm">
                                <RichText text={optText} />
                              </div>
                              {isThisCorrect && <Check size={16} className="text-emerald-600 shrink-0 mt-1" strokeWidth={3} />}
                              {isUserSelection && !isThisCorrect && <X size={16} className="text-rose-600 shrink-0 mt-1" strokeWidth={3} />}
                            </div>
                          );
                        });
                      })()}
                    </div>

                    {/* Explanation Block */}
                    {q.explanation && (
                      <div className="bg-[#1C1518] dark:bg-[#150F12] border border-[#C99A45]/30 rounded-2xl p-4 sm:p-5 shadow-lg">
                        <div className="flex items-center gap-2 mb-3">
                          <div className="w-8 h-8 rounded-xl bg-[#C99A45]/20 text-[#E5B869] border border-[#C99A45]/30 flex items-center justify-center">
                            <FileText size={16} />
                          </div>
                          <h4 className="text-xs font-black text-[#E5B869] uppercase tracking-[0.2em]">Solution Insight</h4>
                        </div>
                        <div className="text-[13px] sm:text-[14px] text-[#FAF5ED] font-hindi leading-relaxed font-bold">
                          <RichText text={q.explanation} enablePronunciation={true} />
                        </div>
                        <div className="pt-3 mt-3 border-t border-white/10 flex items-center justify-between flex-wrap gap-2.5">
                          <button
                            type="button"
                            onClick={() => {
                              playClickSound();
                              window.dispatchEvent(new CustomEvent("disha2020_open_ai_tutor", { detail: { question: q } }));
                            }}
                            className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-indigo-500 via-purple-600 to-pink-500 hover:from-indigo-600 hover:to-purple-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-indigo-500/20 active:scale-95 transition-all cursor-pointer"
                          >
                            <Sparkles className="w-3.5 h-3.5 text-amber-300 animate-spin" style={{ animationDuration: '3s' }} />
                            <span>✨ AI से समझें (Explain with AI)</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              playClickSound();
                              setReportingQuestion(q);
                              setShowReportModal(true);
                            }}
                            className="text-xs font-bold text-amber-300/90 hover:text-amber-200 flex items-center gap-1.5 transition-colors cursor-pointer"
                          >
                            <Flag className="w-3.5 h-3.5 fill-current" />
                            <span>प्रश्न / समाधान पर आपत्ति दर्ज करें (Report Question)</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        </motion.div>

        {/* Actions */}
        <motion.div 
          variants={{
            hidden: { opacity: 0, y: 10 },
            show: { opacity: 1, y: 0 }
          }}
          className="flex items-center gap-3 pt-2"
        >
          <button
            id="btn-retake-test"
            onClick={onRestart}
            className="flex-1 h-12 px-4 rounded-xl sm:rounded-2xl bg-[#FAF5ED] dark:bg-[#1E171A] border border-[#C99A45]/40 text-[#800020] dark:text-[#E5B869] font-black text-xs sm:text-sm hover:bg-[#F5EBE1] transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95 shadow-sm"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Re-take Test</span>
          </button>

          <button
            id="btn-back-to-hub"
            onClick={onClose}
            className="flex-1 h-12 px-4 rounded-xl sm:rounded-2xl bg-[#800020] hover:bg-[#660019] text-white font-black text-xs sm:text-sm shadow-md shadow-[#800020]/20 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95 border border-[#C99A45]/40"
          >
            <Home className="w-4 h-4 text-[#E5B869]" />
            <span>Return to Dashboard</span>
          </button>
        </motion.div>
      </motion.div>
      {shareData && (
        <ShareModal
          isOpen={!!shareData}
          onClose={() => setShareData(null)}
          data={shareData}
        />
      )}
      <QuestionReportModal
        isOpen={showReportModal}
        onClose={() => {
          setShowReportModal(false);
          setReportingQuestion(null);
        }}
        question={reportingQuestion}
        userProfile={userProfile}
        subjectName={session.subjectName || session.title}
        chapterName={session.chapterName || session.subtitle}
        topicName={session.topicName}
      />
      </div>
    </motion.div>
  );
};
