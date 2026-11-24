// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import {
  classifyHealthTier,
  calculateTopicAccuracyMetrics,
  exportAccuracyHeatmapCSV,
  TopicAccuracyMetric,
} from "../src/utils/accuracyHeatmapService";

describe("accuracyHeatmapService", () => {
  describe("classifyHealthTier", () => {
    it("classifies < 50% as critical", () => {
      expect(classifyHealthTier(0)).toBe("critical");
      expect(classifyHealthTier(35.5)).toBe("critical");
      expect(classifyHealthTier(49.9)).toBe("critical");
    });

    it("classifies 50% to 70% as moderate", () => {
      expect(classifyHealthTier(50)).toBe("moderate");
      expect(classifyHealthTier(60)).toBe("moderate");
      expect(classifyHealthTier(70)).toBe("moderate");
    });

    it("classifies > 70% as healthy", () => {
      expect(classifyHealthTier(70.1)).toBe("healthy");
      expect(classifyHealthTier(85)).toBe("healthy");
      expect(classifyHealthTier(100)).toBe("healthy");
    });
  });

  describe("calculateTopicAccuracyMetrics", () => {
    const mockSubjects = [
      { id: "sub-hindi", name: "सामान्य हिंदी" },
      { id: "sub-polity", name: "भारतीय संविधान व राजव्यवस्था" },
    ];

    const mockChapters = [
      {
        id: "chap-sandhi",
        subjectId: "sub-hindi",
        name: "संधि एवं समास",
        topics: [
          {
            id: "top-sandhi-rules",
            name: "संधि के नियम",
            questions: [
              { id: "q1", text: "Question 1" },
              { id: "q2", text: "Question 2" },
            ],
          },
          {
            id: "top-samas-bhed",
            name: "समास के भेद",
            questions: [{ id: "q3", text: "Question 3" }],
          },
        ],
      },
      {
        id: "chap-fundamental-rights",
        subjectId: "sub-polity",
        name: "मौलिक अधिकार",
        topics: [
          {
            id: "top-article-21",
            name: "अनुच्छेद 21 (प्राण एवं दैहिक स्वतंत्रता)",
            questions: [{ id: "q4", text: "Question 4" }],
          },
        ],
      },
    ];

    it("calculates accurate metrics when performanceStore has data", () => {
      const mockPerfStore: Record<string, any> = {
        q1: {
          attemptCount: 10,
          correctCount: 4,
          wrongCount: 6,
          totalTimeSeconds: 120,
          averageTimeSeconds: 12,
        },
        q2: {
          attemptCount: 10,
          correctCount: 2,
          wrongCount: 8,
          totalTimeSeconds: 80,
          averageTimeSeconds: 8,
        },
        q3: {
          attemptCount: 20,
          correctCount: 16,
          wrongCount: 4,
          totalTimeSeconds: 200,
          averageTimeSeconds: 10,
        },
        q4: {
          attemptCount: 10,
          correctCount: 6,
          wrongCount: 4,
          totalTimeSeconds: 150,
          averageTimeSeconds: 15,
        },
      };

      const result = calculateTopicAccuracyMetrics(mockSubjects, mockChapters, mockPerfStore);

      expect(result.totalTopics).toBe(3);
      expect(result.totalAttempts).toBe(50); // 10+10+20+10

      // top-sandhi-rules: 6 correct / 20 attempts = 30% -> critical
      const sandhi = result.metrics.find((m) => m.topicId === "top-sandhi-rules");
      expect(sandhi).toBeDefined();
      expect(sandhi?.totalQuestions).toBe(2);
      expect(sandhi?.totalAttempts).toBe(20);
      expect(sandhi?.correctAttempts).toBe(6);
      expect(sandhi?.wrongAttempts).toBe(14);
      expect(sandhi?.accuracyPercentage).toBe(30);
      expect(sandhi?.healthTier).toBe("critical");
      expect(sandhi?.subjectName).toBe("सामान्य हिंदी");

      // top-samas-bhed: 16 correct / 20 attempts = 80% -> healthy
      const samas = result.metrics.find((m) => m.topicId === "top-samas-bhed");
      expect(samas?.accuracyPercentage).toBe(80);
      expect(samas?.healthTier).toBe("healthy");

      // top-article-21: 6 correct / 10 attempts = 60% -> moderate
      const polity = result.metrics.find((m) => m.topicId === "top-article-21");
      expect(polity?.accuracyPercentage).toBe(60);
      expect(polity?.healthTier).toBe("moderate");

      // Summary counts
      expect(result.criticalCount).toBe(1);
      expect(result.moderateCount).toBe(1);
      expect(result.healthyCount).toBe(1);
      // Overall accuracy: (6+16+6)/50 = 28/50 = 56%
      expect(result.overallAccuracy).toBe(56);
    });

    it("handles zero attempts safely without NaN or crash", () => {
      const result = calculateTopicAccuracyMetrics(mockSubjects, mockChapters, {});

      expect(result.totalTopics).toBe(3);
      expect(result.totalAttempts).toBe(0);
      expect(result.overallAccuracy).toBe(0);
      result.metrics.forEach((m) => {
        expect(Number.isNaN(m.accuracyPercentage)).toBe(false);
        expect(m.accuracyPercentage).toBe(0);
      });
    });

    it("aggregates additional attempts from attemptLogs array", () => {
      const mockAttemptLogs = [
        {
          questionId: "q1",
          topicId: "top-sandhi-rules",
          chapterId: "chap-sandhi",
          subjectId: "sub-hindi",
          isCorrect: true,
          timeTakenSeconds: 15,
        },
        {
          questionId: "q1",
          topicId: "top-sandhi-rules",
          chapterId: "chap-sandhi",
          subjectId: "sub-hindi",
          isCorrect: false,
          timeTakenSeconds: 25,
        },
      ];

      const result = calculateTopicAccuracyMetrics(mockSubjects, mockChapters, {}, mockAttemptLogs);
      const sandhi = result.metrics.find((m) => m.topicId === "top-sandhi-rules");
      expect(sandhi?.totalAttempts).toBe(2);
      expect(sandhi?.correctAttempts).toBe(1);
      expect(sandhi?.accuracyPercentage).toBe(50);
      expect(sandhi?.healthTier).toBe("moderate");
    });
  });

  describe("exportAccuracyHeatmapCSV", () => {
    it("generates well-formed CSV with headers and escaped fields", () => {
      const sampleMetrics: TopicAccuracyMetric[] = [
        {
          topicId: "top-1",
          topicName: "संधि, समास व प्रत्यय",
          chapterId: "chap-1",
          chapterName: "व्याकरण",
          subjectId: "sub-1",
          subjectName: "हिंदी",
          totalQuestions: 25,
          totalAttempts: 150,
          correctAttempts: 60,
          wrongAttempts: 90,
          accuracyPercentage: 40.0,
          avgTimeSeconds: 18,
          healthTier: "critical",
        },
      ];

      const csv = exportAccuracyHeatmapCSV(sampleMetrics);
      expect(csv).toContain("Subject,Chapter,Topic,Total Questions,Total Attempts,Correct,Wrong,Accuracy (%),Avg Time (s),Health Tier");
      expect(csv).toContain('"हिंदी"');
      expect(csv).toContain('"व्याकरण"');
      expect(csv).toContain('"संधि, समास व प्रत्यय"');
      expect(csv).toContain("25,150,60,90,40,18,critical");
    });
  });
});
