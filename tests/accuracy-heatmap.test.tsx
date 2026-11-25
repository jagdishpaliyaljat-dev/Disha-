// @vitest-environment jsdom
import React from "react";
import { describe, it, expect } from "vitest";
import { renderToString } from "react-dom/server";
import {
  classifyHealthTier,
  calculateTopicAccuracyMetrics,
  exportAccuracyHeatmapCSV,
  TopicAccuracyMetric,
} from "../src/utils/accuracyHeatmapService";
import { SubjectTopicAccuracyHeatmap } from "../src/components/admin/SubjectTopicAccuracyHeatmap";
import { AdminAnalyticsDashboard } from "../src/components/admin/AdminAnalyticsDashboard";

describe("accuracyHeatmapService", () => {
  describe("classifyHealthTier", () => {
    it("classifies < 50% with attempts > 0 as critical", () => {
      expect(classifyHealthTier(0, 10)).toBe("critical");
      expect(classifyHealthTier(35.5, 5)).toBe("critical");
      expect(classifyHealthTier(49.9, 12)).toBe("critical");
    });

    it("classifies 50% to 70% as moderate", () => {
      expect(classifyHealthTier(50, 10)).toBe("moderate");
      expect(classifyHealthTier(60, 20)).toBe("moderate");
      expect(classifyHealthTier(70, 15)).toBe("moderate");
    });

    it("classifies > 70% as healthy", () => {
      expect(classifyHealthTier(70.1, 8)).toBe("healthy");
      expect(classifyHealthTier(85, 25)).toBe("healthy");
      expect(classifyHealthTier(100, 30)).toBe("healthy");
    });

    it("classifies 0 attempts as unattempted rather than critical", () => {
      expect(classifyHealthTier(0, 0)).toBe("unattempted");
    });

    it("safely handles NaN and non-finite numbers", () => {
      expect(classifyHealthTier(NaN, 10)).toBe("critical");
      expect(classifyHealthTier(Infinity, 0)).toBe("unattempted");
    });
  });

  describe("calculateTopicAccuracyMetrics", () => {
    const mockSubjects = [
      { id: "sub-hindi", name: "सामान्य हिंदी", hindiName: "सामान्य हिंदी" },
      { id: "sub-polity", name: "भारतीय संविधान व राजव्यवस्था", hindiName: "भारतीय संविधान" },
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
          {
            id: "top-unattempted",
            name: "अव्ययीभाव समास (नया टॉपिक)",
            questions: [{ id: "q_new", text: "New Question" }],
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

    it("calculates accurate metrics and classifies 0-attempt topics as unattempted", () => {
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

      expect(result.totalTopics).toBe(4);
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

      // top-unattempted: 0 attempts -> unattempted (not buried under critical failures)
      const unattempted = result.metrics.find((m) => m.topicId === "top-unattempted");
      expect(unattempted?.accuracyPercentage).toBe(0);
      expect(unattempted?.totalAttempts).toBe(0);
      expect(unattempted?.healthTier).toBe("unattempted");

      // Summary counts
      expect(result.criticalCount).toBe(1);
      expect(result.moderateCount).toBe(1);
      expect(result.healthyCount).toBe(1);
      expect(result.unattemptedCount).toBe(1);

      // Real critical failure (sandhi 30%) must sort ahead of 0-attempt topic
      expect(result.metrics[0].topicId).toBe("top-sandhi-rules");
    });

    it("handles zero attempts safely without NaN or crash", () => {
      const result = calculateTopicAccuracyMetrics(mockSubjects, mockChapters, {});

      expect(result.totalTopics).toBe(4);
      expect(result.totalAttempts).toBe(0);
      expect(result.overallAccuracy).toBe(0);
      expect(result.unattemptedCount).toBe(4);
      expect(result.criticalCount).toBe(0);
      result.metrics.forEach((m) => {
        expect(Number.isNaN(m.accuracyPercentage)).toBe(false);
        expect(m.accuracyPercentage).toBe(0);
        expect(m.healthTier).toBe("unattempted");
      });
    });

    it("handles nullish/malformed inputs safely", () => {
      // @ts-expect-error test malformed inputs
      const result = calculateTopicAccuracyMetrics(null, undefined, null, null);
      expect(result.totalTopics).toBe(0);
      expect(result.totalAttempts).toBe(0);
      expect(result.overallAccuracy).toBe(0);
    });

    it("aggregates additional attempts from attemptLogs with questionId mapping", () => {
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
          isCorrect: false, // topicId missing in log, resolves via q1 belonging to top-sandhi-rules
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
          topicName: 'संधि "समास" व प्रत्यय',
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
      expect(csv).toContain('"संधि ""समास"" व प्रत्यय"');
      expect(csv).toContain("25,150,60,90,40,18,critical");
    });

    it("hardens against CSV formula injection (CWE-1236)", () => {
      const injectionMetrics: TopicAccuracyMetric[] = [
        {
          topicId: "top-injection",
          topicName: "=SUM(A1:A10)",
          chapterId: "chap-injection",
          chapterName: "@calc",
          subjectId: "sub-injection",
          subjectName: "+Malicious",
          totalQuestions: 1,
          totalAttempts: 0,
          correctAttempts: 0,
          wrongAttempts: 0,
          accuracyPercentage: 0,
          avgTimeSeconds: 0,
          healthTier: "unattempted",
        },
      ];

      const csv = exportAccuracyHeatmapCSV(injectionMetrics);
      expect(csv).toContain("\"'=SUM(A1:A10)\"");
      expect(csv).toContain("\"'@calc\"");
      expect(csv).toContain("\"'+Malicious\"");
    });
  });

  describe("UI Component Integration", () => {
    it("renders SubjectTopicAccuracyHeatmap component cleanly", () => {
      const html = renderToString(<SubjectTopicAccuracyHeatmap />);
      expect(html).toContain("Subject &amp; Topic Accuracy Heatmap");
      expect(html).toContain("Export CSV");
      expect(html).toContain("Critical Review");
      expect(html).toContain("High Mastery");
    });

    it("renders AdminAnalyticsDashboard with initialSection='heatmap'", () => {
      const html = renderToString(<AdminAnalyticsDashboard initialSection="heatmap" />);
      expect(html).toContain("Subject &amp; Topic Accuracy Heatmap");
      expect(html).toContain("एक्यूरेसी हीटमैप");
    });
  });
});
