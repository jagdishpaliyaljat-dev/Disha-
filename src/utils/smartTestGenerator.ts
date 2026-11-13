import {
  Chapter,
  Topic,
  Question,
  PerformanceStore,
  ProgressStore,
} from "../types";
import { calculateSmartPriority } from "./smartPriority";

export interface GenerateSmartTestParams {
  type: "topic" | "chapter" | "all-chapters";
  targetCount: number;
  allQuestions: Question[];
  chapters: Chapter[];
  targetChapterId?: string;
  targetTopicId?: string;
  perfStore?: PerformanceStore;
  progressStore?: ProgressStore;
}

export interface GeneratedSmartTestResult {
  selectedQuestionIds: string[];
  totalSelected: number;
  topicBreakdown: Record<string, number>;
  averagePriorityScore: number;
  weakAreaCount: number;
}

/**
 * Checks if two questions are near duplicates (text token overlap > 85%)
 */
export function areQuestionsNearDuplicate(q1: Question, q2: Question): boolean {
  if (q1.id === q2.id) return true;
  const t1 = (q1.text || "").toLowerCase().replace(/[^a-z0-9\u0900-\u097F]/g, "");
  const t2 = (q2.text || "").toLowerCase().replace(/[^a-z0-9\u0900-\u097F]/g, "");

  if (t1 === t2) return true;
  if (t1.length > 20 && t2.length > 20 && (t1.includes(t2) || t2.includes(t1))) return true;

  return false;
}

/**
 * Intelligent Test Selection Engine
 * Selects questions based on weak areas, revision needs, and balanced topic coverage.
 */
export function generateIntelligentTest({
  type,
  targetCount,
  allQuestions,
  chapters,
  targetChapterId,
  targetTopicId,
  perfStore = {},
  progressStore = {},
}: GenerateSmartTestParams): GeneratedSmartTestResult {
  const selectedQuestions: Question[] = [];
  const selectedIdsSet = new Set<string>();

  // Helper to score a question
  const scoreQuestion = (q: Question) => {
    const perf = perfStore[q.id];
    const prog = progressStore[q.id];
    let score = 50;
    const tags: string[] = [];

    if (perf) {
      const smart = calculateSmartPriority(perf);
      score = smart.score;
      if (smart.specialTag === "fast_wrong") {
        tags.push("Weak Area");
      }
      if (smart.level === "high" || smart.level === "attention") {
        tags.push("Needs Practice");
      }
    }
    if (prog && prog.status === "wrong") {
      score = Math.max(score, 75);
      if (!tags.includes("Weak Area")) tags.push("Weak Area");
    }

    return { score, tags };
  };

  // ──────────────────────────────────────────
  // 1. TOPIC TEST
  // ──────────────────────────────────────────
  if (type === "topic" && targetTopicId) {
    const topicPool = allQuestions.filter((q) => q.topicId === targetTopicId);

    // Score and rank questions
    const scoredList = topicPool.map((q) => ({
      question: q,
      ...scoreQuestion(q),
    }));

    // Sort by priority score descending, with slight jitter for variety
    scoredList.sort((a, b) => {
      const scoreDiff = b.score - a.score;
      if (Math.abs(scoreDiff) > 5) return scoreDiff;
      return Math.random() - 0.5;
    });

    for (const item of scoredList) {
      if (selectedQuestions.length >= targetCount) break;

      // Duplicate suppression
      const isDuplicate = selectedQuestions.some((sq) =>
        areQuestionsNearDuplicate(sq, item.question)
      );
      if (!isDuplicate) {
        selectedQuestions.push(item.question);
        selectedIdsSet.add(item.question.id);
      }
    }
  }

  // ──────────────────────────────────────────
  // 2. CHAPTER / SECTION TEST
  // ──────────────────────────────────────────
  else if (type === "chapter" && targetChapterId) {
    const chapter = chapters.find((c) => c.id === targetChapterId);
    const chapterQuestions = allQuestions.filter((q) => q.chapterId === targetChapterId);

    if (chapter && chapter.topics.length > 0) {
      const topics = chapter.topics;
      const effectiveCount = Math.min(targetCount, chapterQuestions.length);

      // Balanced weights for each topic
      const topicWeights: Record<string, number> = {};
      let totalWeight = 0;

      topics.forEach((t) => {
        topicWeights[t.id] = 1.0;
        totalWeight += 1.0;
      });

      // Calculate quotas per topic
      const topicQuotas: Record<string, number> = {};
      let allocatedCount = 0;

      topics.forEach((t) => {
        const quota = Math.max(1, Math.round((topicWeights[t.id] / totalWeight) * effectiveCount));
        topicQuotas[t.id] = quota;
        allocatedCount += quota;
      });

      // Adjust to match targetCount exactly
      while (allocatedCount > effectiveCount) {
        const highestTopic = Object.keys(topicQuotas).reduce((maxT, currT) =>
          topicQuotas[currT] > topicQuotas[maxT] ? currT : maxT
        );
        topicQuotas[highestTopic]--;
        allocatedCount--;
      }

      // Pick top scored questions for each topic
      topics.forEach((t) => {
        const quota = topicQuotas[t.id] || 1;
        const pool = chapterQuestions.filter((q) => q.topicId === t.id);

        const scored = pool
          .map((q) => ({ question: q, ...scoreQuestion(q) }))
          .sort((a, b) => b.score - a.score);

        let addedForTopic = 0;
        for (const item of scored) {
          if (addedForTopic >= quota || selectedQuestions.length >= targetCount) break;

          const isDuplicate = selectedQuestions.some((sq) =>
            areQuestionsNearDuplicate(sq, item.question)
          );
          if (!isDuplicate && !selectedIdsSet.has(item.question.id)) {
            selectedQuestions.push(item.question);
            selectedIdsSet.add(item.question.id);
            addedForTopic++;
          }
        }
      });

      // If we still have remaining slots, fill with highest remaining from chapter
      if (selectedQuestions.length < effectiveCount) {
        const remaining = chapterQuestions
          .filter((q) => !selectedIdsSet.has(q.id))
          .map((q) => ({ question: q, ...scoreQuestion(q) }))
          .sort((a, b) => b.score - a.score);

        for (const item of remaining) {
          if (selectedQuestions.length >= effectiveCount) break;
          const isDuplicate = selectedQuestions.some((sq) =>
            areQuestionsNearDuplicate(sq, item.question)
          );
          if (!isDuplicate && !selectedIdsSet.has(item.question.id)) {
            selectedQuestions.push(item.question);
            selectedIdsSet.add(item.question.id);
          }
        }
      }
    }
  }

  // ──────────────────────────────────────────
  // 3. ALL CHAPTERS TEST (BALANCED EXAM)
  // ──────────────────────────────────────────
  else {
    const effectiveCount = Math.min(targetCount, allQuestions.length);

    // Balanced chapter weights
    const chapterWeights: Record<string, number> = {};
    let totalWeight = 0;

    chapters.forEach((ch) => {
      chapterWeights[ch.id] = 1.0;
      totalWeight += 1.0;
    });

    // Calculate chapter quotas
    const chapterQuotas: Record<string, number> = {};
    let totalAllocated = 0;

    chapters.forEach((ch) => {
      const qInChapter = allQuestions.filter((q) => q.chapterId === ch.id).length;
      if (qInChapter === 0) return;
      const quota = Math.min(
        qInChapter,
        Math.max(1, Math.round((chapterWeights[ch.id] / totalWeight) * effectiveCount))
      );
      chapterQuotas[ch.id] = quota;
      totalAllocated += quota;
    });

    // Adjust quotas to match exact count
    while (totalAllocated > effectiveCount) {
      const maxCh = Object.keys(chapterQuotas).reduce((maxC, currC) =>
        chapterQuotas[currC] > chapterQuotas[maxC] ? currC : maxC
      );
      if (chapterQuotas[maxCh] > 1) {
        chapterQuotas[maxCh]--;
        totalAllocated--;
      } else {
        break;
      }
    }

    // Pick within each chapter across topics
    chapters.forEach((ch) => {
      const quota = chapterQuotas[ch.id] || 0;
      if (quota <= 0) return;

      const chQuestions = allQuestions.filter((q) => q.chapterId === ch.id);
      const scored = chQuestions
        .map((q) => ({ question: q, ...scoreQuestion(q) }))
        .sort((a, b) => {
          const diff = b.score - a.score;
          if (Math.abs(diff) > 8) return diff;
          return Math.random() - 0.5;
        });

      let added = 0;
      for (const item of scored) {
        if (added >= quota || selectedQuestions.length >= targetCount) break;

        const isDuplicate = selectedQuestions.some((sq) =>
          areQuestionsNearDuplicate(sq, item.question)
        );
        if (!isDuplicate && !selectedIdsSet.has(item.question.id)) {
          selectedQuestions.push(item.question);
          selectedIdsSet.add(item.question.id);
          added++;
        }
      }
    });

    // Fill any remainder
    if (selectedQuestions.length < effectiveCount) {
      const remaining = allQuestions
        .filter((q) => !selectedIdsSet.has(q.id))
        .map((q) => ({ question: q, ...scoreQuestion(q) }))
        .sort((a, b) => b.score - a.score);

      for (const item of remaining) {
        if (selectedQuestions.length >= effectiveCount) break;
        const isDuplicate = selectedQuestions.some((sq) =>
          areQuestionsNearDuplicate(sq, item.question)
        );
        if (!isDuplicate && !selectedIdsSet.has(item.question.id)) {
          selectedQuestions.push(item.question);
          selectedIdsSet.add(item.question.id);
        }
      }
    }
  }

  // Calculate statistics
  const topicBreakdown: Record<string, number> = {};
  let totalScore = 0;
  let weakAreaCount = 0;

  selectedQuestions.forEach((q) => {
    topicBreakdown[q.topicId] = (topicBreakdown[q.topicId] || 0) + 1;
    const scoreObj = scoreQuestion(q);
    totalScore += scoreObj.score;
    if (scoreObj.tags.includes("Weak Area") || scoreObj.tags.includes("Needs Practice")) {
      weakAreaCount++;
    }
  });

  return {
    selectedQuestionIds: selectedQuestions.map((q) => q.id),
    totalSelected: selectedQuestions.length,
    topicBreakdown,
    averagePriorityScore:
      selectedQuestions.length > 0 ? Math.round(totalScore / selectedQuestions.length) : 50,
    weakAreaCount,
  };
}
