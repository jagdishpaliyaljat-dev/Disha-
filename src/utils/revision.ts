import { QuestionProgress, ProgressStore } from "../types";

export const INTERVALS = [3, 7, 21, 45, 75];

export function getTodayDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function addDaysToDate(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * REVISION LOGIC (implement exactly):
 * Intervals in days: [3, 7, 21, 45, 75]
 * - First answer, correct: status "correct", stage 0, nextReviewAt = today + 3 days.
 * - First answer, wrong: status "wrong", stage 0, nextReviewAt = today + 3 days, wrongCount + 1.
 * - Answered again, correct: status "correct" (it leaves the Wrong list), stage + 1 (max 4), nextReviewAt = today + intervals[stage].
 * - Answered again, wrong: status "wrong", stage reset to 0, nextReviewAt = today + 3 days, wrongCount + 1.
 */
export function calculateNextProgress(
  current: QuestionProgress | undefined,
  isCorrect: boolean,
  selectedOptionIndex: number,
  todayStr: string = getTodayDateString()
): QuestionProgress {
  const isFirstAttempt = !current || current.status === "unattempted";

  if (isFirstAttempt) {
    if (isCorrect) {
      return {
        status: "correct",
        stage: 0,
        nextReviewAt: addDaysToDate(todayStr, 3),
        wrongCount: 0,
        bookmarked: current?.bookmarked || false,
        lastAnsweredAt: todayStr,
        lastSelectedOption: selectedOptionIndex,
      };
    } else {
      return {
        status: "wrong",
        stage: 0,
        nextReviewAt: addDaysToDate(todayStr, 3),
        wrongCount: (current?.wrongCount || 0) + 1,
        bookmarked: current?.bookmarked || false,
        lastAnsweredAt: todayStr,
        lastSelectedOption: selectedOptionIndex,
      };
    }
  }

  // Subsequent answer
  if (isCorrect) {
    const nextStage = Math.min(4, current.stage + 1);
    const intervalDays = INTERVALS[nextStage];
    return {
      status: "correct",
      stage: nextStage,
      nextReviewAt: addDaysToDate(todayStr, intervalDays),
      wrongCount: current.wrongCount,
      bookmarked: current.bookmarked,
      lastAnsweredAt: todayStr,
      lastSelectedOption: selectedOptionIndex,
    };
  } else {
    return {
      status: "wrong",
      stage: 0,
      nextReviewAt: addDaysToDate(todayStr, 3),
      wrongCount: current.wrongCount + 1,
      bookmarked: current.bookmarked,
      lastAnsweredAt: todayStr,
      lastSelectedOption: selectedOptionIndex,
    };
  }
}

/**
 * Checks if question is due today or earlier.
 * "Due Today" = any attempted question with nextReviewAt <= today.
 */
export function isDueToday(progress: QuestionProgress | undefined, todayStr: string = getTodayDateString()): boolean {
  if (!progress || progress.status === "unattempted") return false;
  return progress.nextReviewAt <= todayStr;
}

/**
 * Priority order in every revision session:
 * most wrong times first (wrongCount descending),
 * then other wrong questions,
 * then due questions,
 * then bookmarked.
 */
export function sortQuestionsForRevision(questionIds: string[], progressMap: ProgressStore, todayStr: string = getTodayDateString()): string[] {
  return [...questionIds].sort((a, b) => {
    const pA = progressMap[a];
    const pB = progressMap[b];

    const wrongCountA = pA?.wrongCount || 0;
    const wrongCountB = pB?.wrongCount || 0;

    const isWrongA = pA?.status === "wrong" ? 1 : 0;
    const isWrongB = pB?.status === "wrong" ? 1 : 0;

    const isDueA = isDueToday(pA, todayStr) ? 1 : 0;
    const isDueB = isDueToday(pB, todayStr) ? 1 : 0;

    const isBookmarkedA = pA?.bookmarked ? 1 : 0;
    const isBookmarkedB = pB?.bookmarked ? 1 : 0;

    // 1. Most wrong times first
    if (wrongCountA !== wrongCountB) {
      return wrongCountB - wrongCountA;
    }
    // 2. Then currently wrong questions
    if (isWrongA !== isWrongB) {
      return isWrongB - isWrongA;
    }
    // 3. Then due questions
    if (isDueA !== isDueB) {
      return isDueB - isDueA;
    }
    // 4. Then bookmarked
    if (isBookmarkedA !== isBookmarkedB) {
      return isBookmarkedB - isBookmarkedA;
    }

    return 0;
  });
}
