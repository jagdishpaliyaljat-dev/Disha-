import {
  Question,
  QuestionPerformance,
  PerformanceStore,
  PriorityLevel,
  RecentAttemptSummary,
  SpecialPerformanceTag,
  SmartTestConfig,
} from "../types";

/**
 * Baseline reference time in seconds per question for economics MCQ
 */
export const BASELINE_REFERENCE_TIME_SECONDS = 30;

/**
 * Calculates deterministic Smart Priority Score (0–100) based on:
 * 1. Wrong answers (+35 for latest, up to +50 for repeated)
 * 2. Time taken (speed vs reference/topic)
 * 3. Accuracy percentage
 * 4. Recency of mistakes (within 1d, 7d, 30d)
 * 5. Improvement in speed and consistency
 * 6. Special cases (Fast Wrong, Slow Recall, Strong)
 */
export function calculateSmartPriority(
  perf: Partial<QuestionPerformance>
): {
  score: number;
  level: PriorityLevel;
  specialTag: SpecialPerformanceTag;
} {
  const attemptCount = perf.attemptCount || 0;
  if (attemptCount === 0) {
    return {
      score: 0,
      level: "new",
      specialTag: null,
    };
  }

  const correctCount = perf.correctCount || 0;
  const wrongCount = perf.wrongCount || 0;
  const accuracy = attemptCount > 0 ? (correctCount / attemptCount) * 100 : 0;
  const recent = perf.recentAttempts || [];
  const latestAttempt = recent[0];
  const lastIsCorrect = latestAttempt ? latestAttempt.isCorrect : perf.lastResult === "correct";
  const lastTime = latestAttempt?.timeTakenSeconds ?? perf.lastTimeTakenSeconds ?? BASELINE_REFERENCE_TIME_SECONDS;
  const avgTime = perf.averageTimeSeconds || lastTime;

  // Check recent streak
  let consecutiveWrongs = 0;
  let consecutiveCorrects = 0;
  for (const a of recent) {
    if (!a.isCorrect) {
      if (consecutiveCorrects === 0) consecutiveWrongs++;
      else break;
    } else {
      if (consecutiveWrongs === 0) consecutiveCorrects++;
      else break;
    }
  }

  // ----------------------------------------------------
  // Special Case 1: Fast + Wrong ("Needs another attempt")
  // User answered very fast (< 10s) and got it wrong (likely careless/rush)
  // ----------------------------------------------------
  if (!lastIsCorrect && lastTime < 10) {
    return {
      score: 48,
      level: "attention",
      specialTag: "fast_wrong",
    };
  }

  // ----------------------------------------------------
  // Special Case 2: Slow + Correct ("Slow Recall")
  // High time (> 45s) and correct answer -> User knows concept but slow recall
  // ----------------------------------------------------
  if (lastIsCorrect && (lastTime > 45 || avgTime > 45)) {
    return {
      score: 55,
      level: "attention",
      specialTag: "slow_recall",
    };
  }

  // ----------------------------------------------------
  // Special Case 3: Repeated Correct Answers ("Strong")
  // 3+ consecutive correct answers with good speed (< 30s)
  // ----------------------------------------------------
  if (consecutiveCorrects >= 3 && avgTime <= 30) {
    return {
      score: 10,
      level: "low",
      specialTag: "strong",
    };
  }

  // ----------------------------------------------------
  // A. WRONG ANSWER SCORE (Max 50)
  // ----------------------------------------------------
  let wrongScore = 0;
  if (!lastIsCorrect) {
    wrongScore = 35;
    if (consecutiveWrongs >= 3) {
      wrongScore = 50;
    } else if (consecutiveWrongs === 2) {
      wrongScore = 45;
    } else if (wrongCount > 1) {
      wrongScore += Math.min(10, wrongCount * 3);
    }
  }

  // ----------------------------------------------------
  // B. TIME SCORE (Max 30)
  // ----------------------------------------------------
  let timeScore = 0;
  const effectiveTime = Math.max(lastTime, avgTime);
  if (effectiveTime > 45) {
    timeScore = 30; // Very slow
  } else if (effectiveTime >= 35) {
    timeScore = 20; // Slow
  } else if (effectiveTime >= 20) {
    timeScore = 10; // Normal
  } else {
    timeScore = 0; // Fast
  }

  // ----------------------------------------------------
  // C. ACCURACY SCORE (Max 20)
  // ----------------------------------------------------
  let accuracyScore = 0;
  if (accuracy <= 40) {
    accuracyScore = 20;
  } else if (accuracy <= 60) {
    accuracyScore = 15;
  } else if (accuracy <= 80) {
    accuracyScore = 8;
  } else {
    accuracyScore = 0;
  }

  // ----------------------------------------------------
  // D. RECENCY SCORE
  // ----------------------------------------------------
  let recencyScore = 0;
  if (!lastIsCorrect && latestAttempt?.attemptedAt) {
    const elapsedMs = Date.now() - new Date(latestAttempt.attemptedAt).getTime();
    const elapsedHours = elapsedMs / (1000 * 60 * 60);
    if (elapsedHours <= 24) {
      recencyScore = 10;
    } else if (elapsedHours <= 24 * 7) {
      recencyScore = 7;
    } else if (elapsedHours <= 24 * 30) {
      recencyScore = 4;
    } else {
      recencyScore = 1;
    }
  }

  // ----------------------------------------------------
  // E. IMPROVEMENT SCORE (Speed + Consistency)
  // ----------------------------------------------------
  let improvementBonus = 0;
  if (recent.length >= 2 && lastIsCorrect) {
    const previousTime = recent[1].timeTakenSeconds;
    if (lastTime <= previousTime - 5) {
      improvementBonus -= 15; // 5+ seconds faster and correct
    } else if (lastTime < previousTime) {
      improvementBonus -= 8;
    }
  } else if (recent.length >= 2 && !lastIsCorrect) {
    const previousTime = recent[1].timeTakenSeconds;
    if (lastTime >= previousTime + 10) {
      improvementBonus += 6; // Slower and wrong
    }
  }

  // Combine raw score
  let totalScore = wrongScore + timeScore + accuracyScore + recencyScore + improvementBonus;

  // Dampen score if last attempt is correct and accuracy is good
  if (lastIsCorrect && accuracy >= 80) {
    totalScore = Math.min(totalScore, 34);
  }

  // Bound score strictly between 0 and 100
  const finalScore = Math.round(Math.max(0, Math.min(100, totalScore)));

  // Priority Level mapping
  let level: PriorityLevel = "low";
  if (finalScore >= 80) {
    level = "high";
  } else if (finalScore >= 60) {
    level = "medium";
  } else if (finalScore >= 35) {
    level = "attention";
  } else {
    level = "low";
  }

  let specialTag: SpecialPerformanceTag = null;
  if (consecutiveCorrects >= 2 && finalScore <= 30) {
    specialTag = "strong";
  }

  return {
    score: finalScore,
    level,
    specialTag,
  };
}

/**
 * Generates an updated QuestionPerformance record after an attempt
 */
export function updateQuestionPerformanceRecord(
  prevPerf: QuestionPerformance | undefined,
  attempt: {
    questionId: string;
    chapterId: string;
    topicId: string;
    subjectId?: string;
    timeTakenSeconds: number;
    isCorrect: boolean;
    selectedOption: string;
    correctOption: string;
    timestamp?: string;
  }
): QuestionPerformance {
  const now = attempt.timestamp || new Date().toISOString();
  // Safe bounds on timeTaken: between 1 and 180 seconds
  const safeTime = Math.max(1, Math.min(180, Math.round(attempt.timeTakenSeconds)));

  const attemptCount = (prevPerf?.attemptCount || 0) + 1;
  const correctCount = (prevPerf?.correctCount || 0) + (attempt.isCorrect ? 1 : 0);
  const wrongCount = (prevPerf?.wrongCount || 0) + (!attempt.isCorrect ? 1 : 0);
  const totalTimeSeconds = (prevPerf?.totalTimeSeconds || 0) + safeTime;
  const averageTimeSeconds = Math.round((totalTimeSeconds / attemptCount) * 10) / 10;
  const fastestTimeSeconds = prevPerf
    ? Math.min(prevPerf.fastestTimeSeconds, safeTime)
    : safeTime;
  const slowestTimeSeconds = prevPerf
    ? Math.max(prevPerf.slowestTimeSeconds, safeTime)
    : safeTime;

  const newRecentAttempt: RecentAttemptSummary = {
    timeTakenSeconds: safeTime,
    isCorrect: attempt.isCorrect,
    attemptedAt: now,
    selectedOption: attempt.selectedOption,
    correctOption: attempt.correctOption,
  };

  // Keep only latest 10 recent attempts
  const recentAttempts: RecentAttemptSummary[] = [
    newRecentAttempt,
    ...(prevPerf?.recentAttempts || []),
  ].slice(0, 10);

  const accuracy = Math.round((correctCount / attemptCount) * 100);

  const draftPerf: Partial<QuestionPerformance> = {
    attemptCount,
    correctCount,
    wrongCount,
    totalTimeSeconds,
    averageTimeSeconds,
    lastTimeTakenSeconds: safeTime,
    fastestTimeSeconds,
    slowestTimeSeconds,
    lastResult: attempt.isCorrect ? "correct" : "wrong",
    lastAttemptAt: now,
    recentAttempts,
    accuracy,
  };

  const { score, level, specialTag } = calculateSmartPriority(draftPerf);

  return {
    questionId: attempt.questionId,
    chapterId: attempt.chapterId,
    topicId: attempt.topicId,
    subjectId: attempt.subjectId || "economic-survey-2024",
    attemptCount,
    correctCount,
    wrongCount,
    totalTimeSeconds,
    averageTimeSeconds,
    lastTimeTakenSeconds: safeTime,
    fastestTimeSeconds,
    slowestTimeSeconds,
    lastResult: attempt.isCorrect ? "correct" : "wrong",
    lastAttemptAt: now,
    recentAttempts,
    accuracy,
    smartPriorityScore: score,
    priorityLevel: level,
    specialTag,
    updatedAt: now,
  };
}

/**
 * Fisher-Yates array shuffling
 */
function shuffle<T>(arr: T[]): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = result[i];
    result[i] = result[j];
    result[j] = temp;
  }
  return result;
}

/**
 * Smart Test Question Selection Engine
 * Selects questions based on user performance, filters, and priority algorithm
 */
export function selectSmartTestQuestions(
  allQuestions: Question[],
  perfStore: PerformanceStore,
  config: SmartTestConfig
): {
  selectedQuestions: Question[];
  totalAvailable: number;
  isPoolLimited: boolean;
  categoryCounts: {
    high: number;
    medium: number;
    attention: number;
    low: number;
    new: number;
  };
} {
  // 1. Filter by Chapter, Topic, Difficulty
  let filtered = allQuestions.filter((q) => {
    if (config.chapterId && config.chapterId !== "all" && q.chapterId !== config.chapterId) {
      return false;
    }
    if (config.topicId && config.topicId !== "all" && q.topicId !== config.topicId) {
      return false;
    }
    if (config.difficulty && config.difficulty !== "mixed") {
      const qDiff = q.difficulty || "medium";
      if (qDiff !== config.difficulty) return false;
    }
    return true;
  });

  // 2. Filter by Question Source (New / Previously Attempted / Both)
  const isAttempted = (qId: string) => Boolean(perfStore[qId]?.attemptCount && perfStore[qId].attemptCount > 0);

  if (config.questionSource === "new") {
    filtered = filtered.filter((q) => !isAttempted(q.id));
  } else if (config.questionSource === "attempted") {
    filtered = filtered.filter((q) => isAttempted(q.id));
  }

  const totalAvailable = filtered.length;
  const requestedCount =
    config.questionCount === "custom"
      ? config.customCount || 20
      : Number(config.questionCount);

  // If Smart Priority is DISABLED: return randomized subset
  if (!config.smartPriorityEnabled) {
    const shuffled = shuffle(filtered);
    const selected = shuffled.slice(0, Math.min(requestedCount, totalAvailable));
    return {
      selectedQuestions: selected,
      totalAvailable,
      isPoolLimited: requestedCount > totalAvailable,
      categoryCounts: { high: 0, medium: 0, attention: 0, low: 0, new: 0 },
    };
  }

  // 3. Categorize into Priority Bands
  const highPool: Question[] = [];
  const mediumPool: Question[] = [];
  const attentionPool: Question[] = [];
  const lowPool: Question[] = [];
  const newPool: Question[] = [];

  for (const q of filtered) {
    const p = perfStore[q.id];
    if (!p || p.attemptCount === 0) {
      newPool.push(q);
    } else {
      const score = p.smartPriorityScore ?? 0;
      if (score >= 80) highPool.push(q);
      else if (score >= 60) mediumPool.push(q);
      else if (score >= 35) attentionPool.push(q);
      else lowPool.push(q);
    }
  }

  // Sort each pool with slight internal randomization for non-identical tests
  const highShuffled = shuffle(highPool);
  const medShuffled = shuffle(mediumPool);
  const attShuffled = shuffle(attentionPool);
  const lowShuffled = shuffle(lowPool);
  const newShuffled = shuffle(newPool);

  const categoryCounts = {
    high: highPool.length,
    medium: mediumPool.length,
    attention: attentionPool.length,
    low: lowPool.length,
    new: newPool.length,
  };

  const highMedCombined = [...highShuffled, ...medShuffled];

  const selectedSet = new Set<string>();
  const selectedList: Question[] = [];

  const addFromPool = (pool: Question[], needed: number) => {
    for (const q of pool) {
      if (selectedList.length >= requestedCount) break;
      if (needed <= 0) break;
      if (!selectedSet.has(q.id)) {
        selectedSet.add(q.id);
        selectedList.push(q);
        needed--;
      }
    }
  };

  // 4. Source-based Selection Allocation
  if (config.questionSource === "both") {
    // 50% High/Medium, 20% Attention, 20% New, 10% Low
    const targetHighMed = Math.round(requestedCount * 0.5);
    const targetAtt = Math.round(requestedCount * 0.2);
    const targetNew = Math.round(requestedCount * 0.2);
    const targetLow = Math.max(1, requestedCount - targetHighMed - targetAtt - targetNew);

    addFromPool(highMedCombined, targetHighMed);
    addFromPool(attShuffled, targetAtt);
    addFromPool(newShuffled, targetNew);
    addFromPool(lowShuffled, targetLow);

    // If still need more questions, spill over sequentially from highest priority
    addFromPool(highMedCombined, requestedCount - selectedList.length);
    addFromPool(attShuffled, requestedCount - selectedList.length);
    addFromPool(newShuffled, requestedCount - selectedList.length);
    addFromPool(lowShuffled, requestedCount - selectedList.length);
  } else if (config.questionSource === "attempted") {
    // Sort strictly by priority tiers: High -> Medium -> Attention -> Low
    addFromPool(highMedCombined, requestedCount);
    addFromPool(attShuffled, requestedCount - selectedList.length);
    addFromPool(lowShuffled, requestedCount - selectedList.length);
  } else {
    // "new"
    addFromPool(newShuffled, requestedCount);
  }

  return {
    selectedQuestions: selectedList,
    totalAvailable,
    isPoolLimited: requestedCount > totalAvailable,
    categoryCounts,
  };
}
