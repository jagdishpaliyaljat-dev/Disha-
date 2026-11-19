import {
  ProgressStore,
  AppSettings,
  QuestionProgress,
  UserQuestionsStore,
  DailyStudyHistory,
  DailyStudyRecord,
} from "../types";
import { getTodayDateString, addDaysToDate } from "./revision";
import { ALL_QUESTIONS } from "../data/questions";
import { recordLocalChange } from "./syncStorage";

const PROGRESS_STORAGE_KEY = "economic_survey_progress_v2";
const SETTINGS_STORAGE_KEY = "economic_survey_settings_v2";
const CLEARED_FLAG_KEY = "economic_survey_cleared_flag_v2";
const STUDY_HISTORY_STORAGE_KEY = "economic_survey_study_history_v2";

export const DEFAULT_SETTINGS: AppSettings = {
  darkMode: false,
  textSize: "M",
  shuffleQuestions: false,
  lastTopicId: "ch-1-t-1",
  todayDate: getTodayDateString(),
  todayAnsweredCount: 0,
  studyTimeMinutes: 0,
  dailyGoal: 30,
  soundEffects: true,
  hapticFeedback: true,
  instantExplanation: true,
  geminiApiKey: "",
  useCustomApiKey: false,
  aiMode: "platform_default",
  personalAiKeys: [],
  activePersonalKeyId: undefined,
};

// Generates an empty initial store (clean slate)
function generateInitialSeed(): ProgressStore {
  return {};
}

export function loadProgressFromStorage(): ProgressStore {
  try {
    const isCleared = localStorage.getItem(CLEARED_FLAG_KEY);
    if (isCleared === "true") {
      const raw = localStorage.getItem(PROGRESS_STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    }

    const raw = localStorage.getItem(PROGRESS_STORAGE_KEY);
    if (!raw) {
      const initialSeed = generateInitialSeed();
      saveProgressToStorage(initialSeed);
      return initialSeed;
    }
    return JSON.parse(raw) as ProgressStore;
  } catch (e) {
    console.error("Failed to load progress from localStorage", e);
    return {};
  }
}

export function saveProgressToStorage(store: ProgressStore): void {
  try {
    localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify(store));
    recordLocalChange();
  } catch (e) {
    console.error("Failed to save progress to localStorage", e);
  }
}

/**
 * Merge progress that was persisted to disk (e.g. while the app was in the
 * background on another tab) into the in-memory store without discarding
 * newer in-memory answers. Newer timestamps win; bookmark flags are additive.
 */
export function mergeRealtimeProgressDelta(
  current: ProgressStore,
  incoming: ProgressStore
): { merged: ProgressStore; changedCount: number } {
  const merged: ProgressStore = { ...current };
  let changedCount = 0;

  const timestampOf = (p?: QuestionProgress): string =>
    p?.updatedAt || p?.lastAnsweredAt || "";

  for (const [questionId, next] of Object.entries(incoming || {})) {
    if (!next) continue;
    const prev = merged[questionId];

    if (!prev) {
      merged[questionId] = next;
      changedCount++;
      continue;
    }

    if (timestampOf(next) > timestampOf(prev)) {
      merged[questionId] = { ...prev, ...next };
      changedCount++;
      continue;
    }

    // Bookmarks can be toggled independently of answer timestamps.
    if (next.bookmarked && !prev.bookmarked) {
      merged[questionId] = { ...prev, bookmarked: true };
      changedCount++;
    }
  }

  return { merged, changedCount };
}

export function loadSettingsFromStorage(): AppSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS, todayDate: getTodayDateString() };
    const parsed = JSON.parse(raw) as AppSettings;
    const today = getTodayDateString();
    if (parsed.todayDate !== today) {
      parsed.todayDate = today;
      parsed.todayAnsweredCount = 0;
    }
    // Auto-heal invalid or discontinued models (3.5, 3.8, 3.1, legacy flash) to gemini-2.0-flash
    if (Array.isArray(parsed.personalAiKeys)) {
      let modified = false;
      parsed.personalAiKeys = parsed.personalAiKeys.map((k: any) => {
        if (k && (k.provider === "gemini" || !k.provider)) {
          if (!k.model || k.model.includes("3.5") || k.model.includes("3.8") || k.model.includes("3.1") || k.model === "default" || k.model === "gemini-flash-latest") {
            modified = true;
            return { ...k, model: "gemini-2.0-flash" };
          }
        }
        return k;
      });
      if (modified) {
        try {
          localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(parsed));
        } catch (_) {}
      }
    }
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch (e) {
    console.error("Failed to load settings from localStorage", e);
    return { ...DEFAULT_SETTINGS, todayDate: getTodayDateString() };
  }
}

export function saveSettingsToStorage(settings: AppSettings): void {
  try {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch (e) {
    console.error("Failed to save settings to localStorage", e);
  }
}

export function clearAllStorage(): void {
  try {
    const keys = [
      PROGRESS_STORAGE_KEY,
      SETTINGS_STORAGE_KEY,
      STUDY_HISTORY_STORAGE_KEY,
      "economic_survey_user_questions_v2",
      "economic_survey_pyqs_data_v2",
      "economic_survey_pending_attempts_v1",
      "economic_survey_performance_v1",
      "economic_survey_pyq_analysis_v1",
      "economic_survey_question_pyq_matches_v1",
      "question_pyq_matches",
      "economic_survey_smart_priority_config"
    ];
    
    keys.forEach(key => localStorage.removeItem(key));
    localStorage.setItem(CLEARED_FLAG_KEY, "true");
  } catch (e) {
    console.error("Failed to clear localStorage", e);
  }
}

// ──────────────────────────────────────────
// STUDY ANALYTICS & DAILY HISTORY STORAGE
// ──────────────────────────────────────────

// Generates an empty study history (clean slate)
export function generateInitialStudyHistory(): DailyStudyHistory {
  return {};
}

export function loadStudyHistoryFromStorage(): DailyStudyHistory {
  try {
    const isCleared = localStorage.getItem(CLEARED_FLAG_KEY);
    if (isCleared === "true") {
      const raw = localStorage.getItem(STUDY_HISTORY_STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    }

    const raw = localStorage.getItem(STUDY_HISTORY_STORAGE_KEY);
    if (!raw) {
      const seed = generateInitialStudyHistory();
      saveStudyHistoryToStorage(seed);
      return seed;
    }
    return JSON.parse(raw) as DailyStudyHistory;
  } catch (e) {
    console.error("Failed to load study history from localStorage", e);
    return {};
  }
}

export function saveStudyHistoryToStorage(history: DailyStudyHistory): void {
  try {
    localStorage.setItem(STUDY_HISTORY_STORAGE_KEY, JSON.stringify(history));
    recordLocalChange();
  } catch (e) {
    console.error("Failed to save study history to localStorage", e);
  }
}

export function recordStudyAnswerToHistory(
  isCorrect: boolean,
  dateStr: string = getTodayDateString()
): DailyStudyHistory {
  const current = loadStudyHistoryFromStorage();
  const existing = current[dateStr] || { correct: 0, wrong: 0 };
  const updated: DailyStudyHistory = {
    ...current,
    [dateStr]: {
      correct: isCorrect ? existing.correct + 1 : existing.correct,
      wrong: !isCorrect ? existing.wrong + 1 : existing.wrong,
    },
  };
  saveStudyHistoryToStorage(updated);
  return updated;
}

export function getLast7DaysStudyData(
  history: DailyStudyHistory,
  progressStore?: ProgressStore,
  todayStr: string = getTodayDateString()
): DailyStudyRecord[] {
  const records: DailyStudyRecord[] = [];
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const monthNames = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];

  for (let i = 6; i >= 0; i--) {
    const dStr = addDaysToDate(todayStr, -i);
    // Parse date components safely without UTC timezone shift
    const [y, m, d] = dStr.split("-").map(Number);
    const dateObj = new Date(y, m - 1, d);
    const dayLabel = dayNames[dateObj.getDay()];
    const fullDateLabel = `${monthNames[dateObj.getMonth()]} ${dateObj.getDate()}`;

    let correct = history[dStr]?.correct || 0;
    let wrong = history[dStr]?.wrong || 0;

    // Complement with progressStore for today if history is zero
    if (progressStore && correct === 0 && wrong === 0) {
      let pCorrect = 0;
      let pWrong = 0;
      Object.values(progressStore).forEach((p) => {
        if (p.lastAnsweredAt === dStr) {
          if (p.status === "correct") pCorrect++;
          else if (p.status === "wrong") pWrong++;
        }
      });
      if (pCorrect > 0 || pWrong > 0) {
        correct = pCorrect;
        wrong = pWrong;
      }
    }

    const total = correct + wrong;
    const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;

    records.push({
      date: dStr,
      dayLabel: i === 0 ? "Today" : dayLabel,
      fullDateLabel,
      correct,
      wrong,
      total,
      accuracy,
    });
  }

  return records;
}

export function exportDataAsJson(
  progress: ProgressStore,
  settings: AppSettings,
  questionsStore?: UserQuestionsStore,
  studyHistory?: DailyStudyHistory
): string {
  return JSON.stringify(
    {
      version: 2,
      exportedAt: new Date().toISOString(),
      progress,
      settings,
      questionsStore: questionsStore || null,
      studyHistory: studyHistory || loadStudyHistoryFromStorage(),
    },
    null,
    2
  );
}

export function importDataFromJson(jsonStr: string): {
  progress: ProgressStore;
  settings: AppSettings;
  questionsStore?: UserQuestionsStore | null;
  studyHistory?: DailyStudyHistory | null;
} | null {
  try {
    const data = JSON.parse(jsonStr);
    if (data && typeof data.progress === "object") {
      if (data.studyHistory) {
        saveStudyHistoryToStorage(data.studyHistory);
      }
      return {
        progress: data.progress as ProgressStore,
        settings: { ...DEFAULT_SETTINGS, ...(data.settings || {}) },
        questionsStore: data.questionsStore || null,
        studyHistory: data.studyHistory || null,
      };
    }
    return null;
  } catch (e) {
    console.error("Failed to parse JSON backup", e);
    return null;
  }
}

