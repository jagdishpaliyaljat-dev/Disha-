import {
  Question,
  Chapter,
  Topic,
  Subject,
  ExtractedQuestionDraft,
  ExamQuestionMatch,
  UserQuestionsStore,
} from "../types";
import { loadUserQuestionsStore, saveUserQuestionsStore } from "./questionsStorage";
import { matchQuestionAgainstBank, calculateCoverageMetrics } from "./examMatcher";

export const STANDARD_ECONOMICS_CHAPTERS: Chapter[] = [];
export const STANDARD_ECONOMICS_TEST_QUESTIONS: Question[] = [];

export function generateAndInjectSampleTestData(): void {
  // No-op: zero mock data requested
}
