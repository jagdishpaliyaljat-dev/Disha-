import {
  PerformanceStore,
  QuestionPerformance,
  QuestionAttemptRecord,
  SmartTestRecord,
  ProgressStore,
} from "../types";
import { ALL_QUESTIONS } from "../data/questions";
import { updateQuestionPerformanceRecord } from "./smartPriority";
import { bufferQuestionAttempt } from "./studentWriteBuffer";

const PERFORMANCE_STORAGE_KEY = "economic_survey_question_perf_v1";
const ATTEMPTS_STORAGE_KEY = "economic_survey_attempts_log_v1";
const SMART_TEST_HISTORY_KEY = "economic_survey_smart_tests_v1";
const PENDING_OFFLINE_ATTEMPTS_KEY = "economic_survey_pending_attempts_v1";

/**
 * Generates an empty initial performance store (clean slate)
 */
export function generateInitialPerformanceSeed(progressStore?: ProgressStore): PerformanceStore {
  return {};
}

/**
 * Loads Performance Store from localStorage
 */
export function loadPerformanceStore(progressStore?: ProgressStore): PerformanceStore {
  try {
    const raw = localStorage.getItem(PERFORMANCE_STORAGE_KEY);
    if (!raw) {
      const seed = generateInitialPerformanceSeed(progressStore);
      savePerformanceStore(seed);
      return seed;
    }
    return JSON.parse(raw) as PerformanceStore;
  } catch (e) {
    console.error("Failed to load performance store", e);
    return {};
  }
}

/**
 * Saves Performance Store to localStorage
 */
export function savePerformanceStore(store: PerformanceStore): void {
  try {
    localStorage.setItem(PERFORMANCE_STORAGE_KEY, JSON.stringify(store));
  } catch (e) {
    console.error("Failed to save performance store", e);
  }
}

/**
 * Records an individual question attempt and updates QuestionPerformance
 */
export function recordQuestionAttempt(
  attempt: {
    questionId: string;
    testId?: string;
    subjectId?: string;
    chapterId: string;
    topicId: string;
    timeTakenSeconds: number;
    isCorrect: boolean;
    selectedOption: string;
    correctOption: string;
  },
  opts?: {
    deferFlush?: boolean;
    skipCloud?: boolean;
    isAdminPreview?: boolean;
  }
): {
  updatedPerformance: QuestionPerformance;
  attemptRecord: QuestionAttemptRecord;
} {
  const currentPerfStore = loadPerformanceStore();
  const existingPerf = currentPerfStore[attempt.questionId];

  // Update question performance using smart priority calculation
  const updatedPerf = updateQuestionPerformanceRecord(existingPerf, attempt);
  currentPerfStore[attempt.questionId] = updatedPerf;
  savePerformanceStore(currentPerfStore);

  // Generate unique attempt record
  const attemptRecord: QuestionAttemptRecord = {
    attemptId: `att-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    questionId: attempt.questionId,
    testId: attempt.testId,
    subjectId: attempt.subjectId || "economic-survey-2024",
    chapterId: attempt.chapterId,
    topicId: attempt.topicId,
    timeTakenSeconds: Math.max(1, Math.min(180, Math.round(attempt.timeTakenSeconds))),
    selectedOption: attempt.selectedOption,
    correctOption: attempt.correctOption,
    isCorrect: attempt.isCorrect,
    attemptNumber: updatedPerf.attemptCount,
    attemptedAt: new Date().toISOString(),
  };

  // Buffer synchronously in persistent IndexedDB/localStorage buffer (no immediate cloud write per MCQ!)
  bufferQuestionAttempt(attemptRecord, {
    deferFlush: opts?.deferFlush,
    skipCloud: opts?.skipCloud,
    isAdminPreview: opts?.isAdminPreview,
  });

  // Persist into unified IndexedDB user_attempts repository & durable sync queue
  import("./localDatabaseEngine").then(({ recordLocalAttempt, recordLocalWrongQuestion }) => {
    import("../lib/firebase").then(({ auth }) => {
      const uid = auth.currentUser?.uid || "guest";
      recordLocalAttempt(attemptRecord, uid).catch(() => {});

      if (!attempt.isCorrect) {
        recordLocalWrongQuestion({
          questionId: attempt.questionId,
          userId: uid,
          subjectId: attempt.subjectId,
          chapterId: attempt.chapterId,
          topicId: attempt.topicId,
          wrongCount: 1,
          lastWrongAt: Date.now(),
          reviewStatus: "needs_review",
          lastSelectedOption: Number(attempt.selectedOption),
          correctIndex: Number(attempt.correctOption),
          syncStatus: "pending",
        }).catch(() => {});
      }
    }).catch(() => {});
  }).catch(() => {});

  // Append to local attempt logs (keep latest 500 attempts for offline history)
  try {
    const rawLogs = localStorage.getItem(ATTEMPTS_STORAGE_KEY);
    const logs: QuestionAttemptRecord[] = rawLogs ? JSON.parse(rawLogs) : [];
    logs.unshift(attemptRecord);
    if (logs.length > 500) logs.length = 500;
    localStorage.setItem(ATTEMPTS_STORAGE_KEY, JSON.stringify(logs));
  } catch (e) {
    // safe fail
  }

  return {
    updatedPerformance: updatedPerf,
    attemptRecord,
  };
}

/**
 * Smart Test History Storage
 */
export function loadSmartTestHistory(): SmartTestRecord[] {
  try {
    const raw = localStorage.getItem(SMART_TEST_HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

export function saveSmartTestRecord(record: SmartTestRecord): void {
  try {
    const history = loadSmartTestHistory();
    history.unshift(record);
    if (history.length > 50) history.length = 50;
    localStorage.setItem(SMART_TEST_HISTORY_KEY, JSON.stringify(history));
  } catch (e) {
    console.error("Failed to save smart test record", e);
  }

  // Persist into unified IndexedDB test_results repository & sync to Supabase
  import("./localDatabaseEngine").then(({ saveLocalTestResult }) => {
    import("../lib/supabase").then(({ supabase, isSupabaseConfigured }) => {
      if (isSupabaseConfigured()) {
        supabase.auth.getUser().then(({ data: { user } }) => {
          const uid = user?.id || "guest";
          saveLocalTestResult(record, uid).catch(() => {});
          if (user?.id) {
            import("./supabaseSyncService").then(({ recordStudentAttempt }) => {
              recordStudentAttempt({
                userId: user.id,
                score: record.score || 0,
                totalQuestions: record.totalQuestions || 0,
                answers: record.answers || {},
                timeSpentSeconds: record.timeSpentSeconds || 0,
              }).catch(() => {});
            }).catch(() => {});
          }
        }).catch(() => {
          saveLocalTestResult(record, "guest").catch(() => {});
        });
      } else {
        saveLocalTestResult(record, "guest").catch(() => {});
      }
    }).catch(() => {});
  }).catch(() => {});
}
