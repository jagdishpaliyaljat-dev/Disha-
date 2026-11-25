/**
 * accuracyHeatmapService.ts
 *
 * Subject & Topic Accuracy Heatmap Engine for Disha 20-20 Exam Prep.
 * Aggregates student attempts, computes topic-level accuracy benchmarks,
 * classifies content quality health tiers, and generates audit reports.
 */

export type HealthTier = "critical" | "moderate" | "healthy" | "unattempted";

export interface TopicAccuracyMetric {
  topicId: string;
  topicName: string;
  chapterId: string;
  chapterName: string;
  subjectId: string;
  subjectName: string;
  totalQuestions: number;
  totalAttempts: number;
  correctAttempts: number;
  wrongAttempts: number;
  accuracyPercentage: number;
  avgTimeSeconds: number;
  healthTier: HealthTier;
}

export interface AccuracyHeatmapSummary {
  overallAccuracy: number;
  totalTopics: number;
  criticalCount: number;
  moderateCount: number;
  healthyCount: number;
  unattemptedCount: number;
  totalAttempts: number;
  metrics: TopicAccuracyMetric[];
}

export interface HeatmapSubjectInput {
  id: string;
  name?: string;
  hindiName?: string;
  [key: string]: any;
}

export interface HeatmapTopicInput {
  id: string;
  name?: string;
  title?: string;
  hindiTitle?: string;
  questions?: Array<{ id: string; text?: string; [key: string]: any }>;
  [key: string]: any;
}

export interface HeatmapChapterInput {
  id: string;
  subjectId?: string;
  name?: string;
  title?: string;
  hindiTitle?: string;
  topics?: HeatmapTopicInput[];
  [key: string]: any;
}

/**
 * Classifies an accuracy percentage into a health tier:
 * - Unattempted (0 attempts): Needs student attempts before diagnostic rating
 * - Critical (< 50%): Urgently needs question & explanation audit (high failure rate)
 * - Moderate (50% - 70%): Average comprehension, candidate for more practice MCQs
 * - Healthy (> 70%): High mastery, solid question framing
 */
export function classifyHealthTier(accuracy: number, totalAttempts = 1): HealthTier {
  if (totalAttempts <= 0) return "unattempted";
  if (!Number.isFinite(accuracy) || accuracy < 50) return "critical";
  if (accuracy <= 70) return "moderate";
  return "healthy";
}

/**
 * Aggregates attempts across subjects, chapters, and topics.
 * Tolerates empty or incomplete datasets, preventing NaN and crashes.
 */
export function calculateTopicAccuracyMetrics(
  subjects: HeatmapSubjectInput[] = [],
  chapters: HeatmapChapterInput[] = [],
  perfStore: Record<string, any> = {},
  attemptLogs: Array<{
    questionId?: string;
    topicId?: string;
    chapterId?: string;
    subjectId?: string;
    isCorrect?: boolean;
    timeTakenSeconds?: number;
  }> = []
): AccuracyHeatmapSummary {
  const safeSubjects = Array.isArray(subjects) ? subjects : [];
  const safeChapters = Array.isArray(chapters) ? chapters : [];
  const safePerf = perfStore && typeof perfStore === "object" ? perfStore : {};
  const safeLogs = Array.isArray(attemptLogs) ? attemptLogs : [];

  const subjectMap = new Map<string, string>();
  safeSubjects.forEach((s) => {
    if (s?.id) {
      subjectMap.set(s.id, String(s.hindiName || s.name || s.id));
    }
  });

  // Map questionId -> topicId for resolving logs missing explicit topicId
  const questionToTopicMap = new Map<string, string>();
  safeChapters.forEach((chapter) => {
    const topics = Array.isArray(chapter?.topics) ? chapter.topics : [];
    topics.forEach((topic) => {
      const topicId = String(topic?.id || "");
      const questions = Array.isArray(topic?.questions) ? topic.questions : [];
      questions.forEach((q) => {
        if (q?.id && topicId) {
          questionToTopicMap.set(String(q.id), topicId);
        }
      });
    });
  });

  // Index attempt logs by topicId
  const topicLogsMap = new Map<string, typeof safeLogs>();
  safeLogs.forEach((log) => {
    const resolvedTopicId = String(
      log?.topicId || (log?.questionId ? questionToTopicMap.get(String(log.questionId)) : "") || ""
    );
    if (resolvedTopicId) {
      const list = topicLogsMap.get(resolvedTopicId) || [];
      list.push(log);
      topicLogsMap.set(resolvedTopicId, list);
    }
  });

  const metrics: TopicAccuracyMetric[] = [];
  let totalGlobalAttempts = 0;
  let totalGlobalCorrect = 0;
  let criticalCount = 0;
  let moderateCount = 0;
  let healthyCount = 0;
  let unattemptedCount = 0;

  safeChapters.forEach((chapter) => {
    const chapterId = String(chapter?.id || "unknown-chap");
    const chapterName = String(chapter?.hindiTitle || chapter?.title || chapter?.name || "Chapter");
    const subjectId = String(chapter?.subjectId || "unknown-sub");
    const subjectName = subjectMap.get(subjectId) || "Subject";
    const topics = Array.isArray(chapter?.topics) ? chapter.topics : [];

    topics.forEach((topic) => {
      const topicId = String(topic?.id || "unknown-top");
      const topicName = String(topic?.hindiTitle || topic?.title || topic?.name || "Topic");
      const questions = Array.isArray(topic?.questions) ? topic.questions : [];
      const totalQuestions = Number.isFinite(topic?.questionCount)
        ? Math.max(topic.questionCount, questions.length)
        : questions.length;

      let topicAttempts = 0;
      let topicCorrect = 0;
      let topicWrong = 0;
      let topicTimeSeconds = 0;

      // 1. Aggregate from QuestionPerformance store
      questions.forEach((q) => {
        if (!q?.id) return;
        const perf = safePerf[q.id];
        if (perf) {
          const attempts = Number.isFinite(perf.attemptCount) ? Math.max(0, perf.attemptCount) : 0;
          const correct = Number.isFinite(perf.correctCount) ? Math.max(0, perf.correctCount) : 0;
          const wrong = Number.isFinite(perf.wrongCount)
            ? Math.max(0, perf.wrongCount)
            : Math.max(0, attempts - correct);
          const time = Number.isFinite(perf.totalTimeSeconds)
            ? Math.max(0, perf.totalTimeSeconds)
            : Math.max(0, (Number(perf.averageTimeSeconds) || 0) * attempts);

          topicAttempts += attempts;
          topicCorrect += correct;
          topicWrong += wrong;
          topicTimeSeconds += time;
        }
      });

      // 2. Aggregate any supplementary individual attempt logs
      const extraLogs = topicLogsMap.get(topicId);
      if (extraLogs && extraLogs.length > 0) {
        extraLogs.forEach((log) => {
          topicAttempts += 1;
          if (log.isCorrect) {
            topicCorrect += 1;
          } else {
            topicWrong += 1;
          }
          topicTimeSeconds += Number.isFinite(log.timeTakenSeconds) ? Math.max(0, log.timeTakenSeconds!) : 0;
        });
      }

      // Safe percentage calculation clamped to 0-100
      const rawAccuracy =
        topicAttempts > 0
          ? Math.min(100, Math.max(0, Math.round((topicCorrect / topicAttempts) * 1000) / 10))
          : 0;
      const accuracyPercentage = Number.isFinite(rawAccuracy) ? rawAccuracy : 0;

      const avgTimeSeconds =
        topicAttempts > 0 && Number.isFinite(topicTimeSeconds)
          ? Math.round(topicTimeSeconds / topicAttempts)
          : 0;

      const healthTier = classifyHealthTier(accuracyPercentage, topicAttempts);

      // Accumulate summary counters
      totalGlobalAttempts += topicAttempts;
      totalGlobalCorrect += topicCorrect;

      if (healthTier === "critical") criticalCount++;
      else if (healthTier === "moderate") moderateCount++;
      else if (healthTier === "healthy") healthyCount++;
      else unattemptedCount++;

      metrics.push({
        topicId,
        topicName,
        chapterId,
        chapterName,
        subjectId,
        subjectName,
        totalQuestions,
        totalAttempts: topicAttempts,
        correctAttempts: topicCorrect,
        wrongAttempts: topicWrong,
        accuracyPercentage,
        avgTimeSeconds,
        healthTier,
      });
    });
  });

  const overallAccuracy =
    totalGlobalAttempts > 0
      ? Math.min(100, Math.max(0, Math.round((totalGlobalCorrect / totalGlobalAttempts) * 1000) / 10))
      : 0;

  // Sorting hierarchy:
  // 1. Critical topics with real failures (accuracy < 50% and attempts > 0) at the very top
  // 2. Moderate topics (50% - 70%)
  // 3. Healthy topics (> 70%)
  // 4. Unattempted topics at the bottom of audit
  metrics.sort((a, b) => {
    if (a.healthTier === "critical" && b.healthTier !== "critical") return -1;
    if (b.healthTier === "critical" && a.healthTier !== "critical") return 1;

    if (a.healthTier === "moderate" && b.healthTier !== "moderate" && b.healthTier !== "critical") return -1;
    if (b.healthTier === "moderate" && a.healthTier !== "moderate" && a.healthTier !== "critical") return 1;

    // Prioritize topics with actual attempt evidence over 0 attempts
    if (a.totalAttempts > 0 && b.totalAttempts === 0) return -1;
    if (b.totalAttempts > 0 && a.totalAttempts === 0) return 1;

    if (a.accuracyPercentage !== b.accuracyPercentage) {
      return a.accuracyPercentage - b.accuracyPercentage;
    }
    return b.totalAttempts - a.totalAttempts;
  });

  return {
    overallAccuracy,
    totalTopics: metrics.length,
    criticalCount,
    moderateCount,
    healthyCount,
    unattemptedCount,
    totalAttempts: totalGlobalAttempts,
    metrics,
  };
}

/**
 * Escapes a cell for CSV formatting, handling commas, newlines, quotes,
 * and hardens against CSV formula injection (CWE-1236).
 */
function escapeCSVCell(val: string | number | undefined | null): string {
  if (val === undefined || val === null) return '""';
  let str = String(val);
  // Hardening against formula injection in Excel/Calc: prefix leading formula characters with '
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }
  return `"${str.replace(/"/g, '""')}"`;
}

/**
 * Exports accuracy heatmap metrics to a standards-compliant CSV string.
 * Includes UTF-8 BOM (\uFEFF) for proper multilingual / Hindi rendering in Excel.
 */
export function exportAccuracyHeatmapCSV(metrics: TopicAccuracyMetric[]): string {
  const headers = [
    "Subject",
    "Chapter",
    "Topic",
    "Total Questions",
    "Total Attempts",
    "Correct",
    "Wrong",
    "Accuracy (%)",
    "Avg Time (s)",
    "Health Tier",
  ];

  const rows = metrics.map((m) => [
    escapeCSVCell(m.subjectName),
    escapeCSVCell(m.chapterName),
    escapeCSVCell(m.topicName),
    m.totalQuestions,
    m.totalAttempts,
    m.correctAttempts,
    m.wrongAttempts,
    m.accuracyPercentage,
    m.avgTimeSeconds,
    m.healthTier,
  ]);

  const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\r\n");
  return `\uFEFF${csvContent}`;
}

/**
 * Initiates a browser download of the Accuracy Heatmap CSV file.
 * Defers URL object revocation to prevent premature abort on mobile WebViews.
 */
export function downloadAccuracyHeatmapCSV(
  metrics: TopicAccuracyMetric[],
  filename = `disha-accuracy-heatmap-${new Date().toISOString().slice(0, 10)}.csv`
): void {
  if (typeof window === "undefined" || !window.Blob) return;
  const csvData = exportAccuracyHeatmapCSV(metrics);
  const blob = new Blob([csvData], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => {
    try {
      URL.revokeObjectURL(url);
    } catch {}
  }, 1500);
}
