/**
 * accuracyHeatmapService.ts
 *
 * Subject & Topic Accuracy Heatmap Engine for Disha 20-20 Exam Prep.
 * Aggregates student attempts, computes topic-level accuracy benchmarks,
 * classifies content quality health tiers, and generates audit reports.
 */

export type HealthTier = "critical" | "moderate" | "healthy";

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
 * - Critical (< 50%): Urgently needs question & explanation audit
 * - Moderate (50% - 70%): Average comprehension, candidate for more practice MCQs
 * - Healthy (> 70%): High mastery, solid question framing
 */
export function classifyHealthTier(accuracy: number): HealthTier {
  if (accuracy < 50) return "critical";
  if (accuracy <= 70) return "moderate";
  return "healthy";
}

/**
 * Aggregates attempts across subjects, chapters, and topics.
 * Tolerates empty or incomplete datasets, preventing NaN and crashes.
 */
export function calculateTopicAccuracyMetrics(
  subjects: HeatmapSubjectInput[],
  chapters: HeatmapChapterInput[],
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
  const subjectMap = new Map<string, string>();
  subjects.forEach((s) => {
    if (s?.id) {
      subjectMap.set(s.id, s.hindiName || s.name || s.id);
    }
  });

  const metrics: TopicAccuracyMetric[] = [];
  let totalGlobalAttempts = 0;
  let totalGlobalCorrect = 0;
  let criticalCount = 0;
  let moderateCount = 0;
  let healthyCount = 0;

  // Index attempt logs by topicId for fast lookups
  const topicLogsMap = new Map<string, typeof attemptLogs>();
  attemptLogs.forEach((log) => {
    if (log?.topicId) {
      const list = topicLogsMap.get(log.topicId) || [];
      list.push(log);
      topicLogsMap.set(log.topicId, list);
    }
  });

  chapters.forEach((chapter) => {
    const chapterId = chapter?.id || "unknown-chap";
    const chapterName = chapter?.hindiTitle || chapter?.title || chapter?.name || "Chapter";
    const subjectId = chapter?.subjectId || "unknown-sub";
    const subjectName = subjectMap.get(subjectId) || "Subject";
    const topics = chapter?.topics || [];

    topics.forEach((topic) => {
      const topicId = topic?.id || "unknown-top";
      const topicName = topic?.hindiTitle || topic?.title || topic?.name || "Topic";
      const questions = topic?.questions || [];
      const totalQuestions = questions.length;

      let topicAttempts = 0;
      let topicCorrect = 0;
      let topicWrong = 0;
      let topicTimeSeconds = 0;

      // 1. Aggregate from QuestionPerformance store
      questions.forEach((q) => {
        if (!q?.id) return;
        const perf = perfStore[q.id];
        if (perf) {
          const attempts = Number(perf.attemptCount) || 0;
          const correct = Number(perf.correctCount) || 0;
          const wrong = Number(perf.wrongCount) || (attempts >= correct ? attempts - correct : 0);
          const time = Number(perf.totalTimeSeconds) || (Number(perf.averageTimeSeconds) || 0) * attempts;

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
          topicTimeSeconds += Number(log.timeTakenSeconds) || 0;
        });
      }

      // Safe percentage calculation
      const accuracyPercentage =
        topicAttempts > 0
          ? Math.round((topicCorrect / topicAttempts) * 1000) / 10
          : 0;

      const avgTimeSeconds =
        topicAttempts > 0 ? Math.round(topicTimeSeconds / topicAttempts) : 0;

      const healthTier = classifyHealthTier(accuracyPercentage);

      // Accumulate summary counters
      totalGlobalAttempts += topicAttempts;
      totalGlobalCorrect += topicCorrect;

      if (healthTier === "critical") criticalCount++;
      else if (healthTier === "moderate") moderateCount++;
      else healthyCount++;

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
      ? Math.round((totalGlobalCorrect / totalGlobalAttempts) * 1000) / 10
      : 0;

  // Sort: Critical issues first, then lowest accuracy, then highest attempts
  metrics.sort((a, b) => {
    if (a.healthTier === "critical" && b.healthTier !== "critical") return -1;
    if (b.healthTier === "critical" && a.healthTier !== "critical") return 1;
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
    totalAttempts: totalGlobalAttempts,
    metrics,
  };
}

/**
 * Escapes a cell for CSV formatting, handling commas, newlines, and quotes.
 */
function escapeCSVCell(val: string | number | undefined | null): string {
  if (val === undefined || val === null) return '""';
  const str = String(val);
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
  URL.revokeObjectURL(url);
}
