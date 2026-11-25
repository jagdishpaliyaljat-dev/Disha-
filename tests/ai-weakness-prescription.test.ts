import { describe, it, expect, beforeEach } from "vitest";
import { Question, Chapter, Subject, ProgressStore, PerformanceStore } from "../src/types";
import {
  diagnoseStudentWeaknesses,
  generateAIWeaknessPrescription,
  createRemedialTestSession,
} from "../src/services/aiWeaknessPrescriptionService";

describe("Disha AI Weakness Postmortem & Study Prescription", () => {
  let mockQuestions: Question[];
  let mockChapters: Chapter[];
  let mockSubjects: Subject[];
  let mockProgressStore: ProgressStore;
  let mockPerfStore: PerformanceStore;

  beforeEach(() => {
    mockSubjects = [
      { id: "sub-geo", name: "राजस्थान का भूगोल", questionCount: 10, topics: [] },
      { id: "sub-hist", name: "राजस्थान का इतिहास", questionCount: 10, topics: [] },
    ];

    mockChapters = [
      {
        id: "ch-minerals",
        title: "खनिज एवं ऊर्जा संसाधन",
        subjectId: "sub-geo",
        topics: [
          { id: "top-metallic", name: "धात्विक खनिज", questionCount: 5, questions: [] },
        ],
      },
      {
        id: "ch-1857",
        title: "1857 की क्रांति",
        subjectId: "sub-hist",
        topics: [
          { id: "top-cantonments", name: "सैनिक छावनियां", questionCount: 5, questions: [] },
        ],
      },
    ];

    mockQuestions = [
      {
        id: "q-1",
        text: "जामर कोटड़ा किसके खनन के लिए प्रसिद्ध है?",
        options: ["रॉक फॉस्फेट", "जिप्सम", "तांबा", "सीसा-जस्ता"],
        correctIndex: 0,
        chapterId: "ch-minerals",
        topicId: "top-metallic",
      },
      {
        id: "q-2",
        text: "राजस्थान में देबारी किसके लिए प्रसिद्ध है?",
        options: ["जिंक स्मेल्टर", "सीमेंट", "कांच", "कपड़ा"],
        correctIndex: 0,
        chapterId: "ch-minerals",
        topicId: "top-metallic",
      },
      {
        id: "q-3",
        text: "सूची-I को सूची-II से सुमेलित कीजिए...",
        options: ["A-1, B-2", "A-2, B-1", "A-3, B-4", "A-4, B-3"],
        correctIndex: 0,
        chapterId: "ch-minerals",
        topicId: "top-metallic",
      },
      {
        id: "q-4",
        text: "1857 की क्रांति के समय नसीराबाद छावनी में किस रेजिमेंट ने विद्रोह किया?",
        options: ["15वीं बंगाल नेटिव इन्फैंट्री", "34वीं", "20वीं", "मेवाड़ भील कोर"],
        correctIndex: 0,
        chapterId: "ch-1857",
        topicId: "top-cantonments",
      },
      {
        id: "q-5",
        text: "निम्न में से कौन-सा सुमेलित नहीं है?",
        options: ["नसीराबाद", "एरिनपुरा", "ब्यावर", "नीमच"],
        correctIndex: 2,
        chapterId: "ch-1857",
        topicId: "top-cantonments",
      },
    ];

    // Student performance setup:
    // q-1: wrong (impulse error < 8s)
    // q-2: wrong
    // q-3: wrong (match matrix)
    // q-4: correct
    // q-5: wrong (negative wording "नहीं है")
    mockProgressStore = {
      "q-1": { status: "wrong", stage: 0, nextReviewAt: "2026-11-26", wrongCount: 2, bookmarked: false, lastAnsweredAt: "2026-11-25T08:00:00Z" },
      "q-2": { status: "wrong", stage: 0, nextReviewAt: "2026-11-26", wrongCount: 1, bookmarked: false, lastAnsweredAt: "2026-11-25T08:05:00Z" },
      "q-3": { status: "wrong", stage: 0, nextReviewAt: "2026-11-26", wrongCount: 1, bookmarked: false, lastAnsweredAt: "2026-11-25T08:10:00Z" },
      "q-4": { status: "correct", stage: 1, nextReviewAt: "2026-12-02", wrongCount: 0, bookmarked: false, lastAnsweredAt: "2026-11-25T08:15:00Z" },
      "q-5": { status: "wrong", stage: 0, nextReviewAt: "2026-11-26", wrongCount: 1, bookmarked: false, lastAnsweredAt: "2026-11-25T08:20:00Z" },
    };

    mockPerfStore = {
      "q-1": {
        questionId: "q-1",
        chapterId: "ch-minerals",
        topicId: "top-metallic",
        attemptCount: 1,
        correctCount: 0,
        wrongCount: 1,
        totalTimeSeconds: 5,
        averageTimeSeconds: 5,
        lastTimeTakenSeconds: 5, // < 8s => Impulse mistake!
        fastestTimeSeconds: 5,
        slowestTimeSeconds: 5,
        lastResult: "wrong",
        lastAttemptAt: "2026-11-25T08:00:00Z",
        recentAttempts: [],
        accuracy: 0,
        smartPriorityScore: 90,
        priorityLevel: "high",
        updatedAt: "2026-11-25T08:00:00Z",
      },
    };
  });

  describe("diagnoseStudentWeaknesses", () => {
    it("accurately calculates total practiced, accuracy, and negative marks lost", () => {
      const diag = diagnoseStudentWeaknesses(
        mockQuestions,
        mockChapters,
        mockSubjects,
        mockProgressStore,
        mockPerfStore
      );

      expect(diag.totalPracticed).toBe(5);
      expect(diag.totalCorrect).toBe(1);
      expect(diag.totalWrong).toBe(4);
      expect(diag.overallAccuracy).toBe(20); // 1/5 = 20%
      // 4 wrong * 0.33 = 1.32 marks lost
      expect(diag.negativeMarksLost).toBeCloseTo(1.32, 2);
    });

    it("detects hasty impulse mistakes answered in under 8 seconds", () => {
      const diag = diagnoseStudentWeaknesses(
        mockQuestions,
        mockChapters,
        mockSubjects,
        mockProgressStore,
        mockPerfStore
      );

      expect(diag.impulseMistakesCount).toBe(1);
      expect(diag.impulseQuestions.some((q) => q.id === "q-1")).toBe(true);
    });

    it("classifies metallic minerals as critical weak topic due to 0% accuracy", () => {
      const diag = diagnoseStudentWeaknesses(
        mockQuestions,
        mockChapters,
        mockSubjects,
        mockProgressStore,
        mockPerfStore
      );

      expect(diag.criticalWeakTopics.length).toBeGreaterThanOrEqual(1);
      const topWeak = diag.criticalWeakTopics[0];
      expect(topWeak.name).toContain("धात्विक खनिज");
      expect(topWeak.wrong).toBe(3);
      expect(topWeak.accuracy).toBe(0);
      expect(topWeak.status).toBe("critical");
    });

    it("identifies vulnerable question patterns (Match Matrix, 'नहीं है')", () => {
      const diag = diagnoseStudentWeaknesses(
        mockQuestions,
        mockChapters,
        mockSubjects,
        mockProgressStore,
        mockPerfStore
      );

      expect(diag.vulnerablePatterns.length).toBeGreaterThan(0);
      const hasMatch = diag.vulnerablePatterns.some((p) => p.pattern.includes("सुमेलित कीजिए"));
      const hasNegative = diag.vulnerablePatterns.some((p) => p.pattern.includes("नहीं है"));
      expect(hasMatch).toBe(true);
      expect(hasNegative).toBe(true);
    });
  });

  describe("generateAIWeaknessPrescription (Heuristic Engine)", () => {
    it("generates a structured 3-step prescription with actionable remedies", async () => {
      const diag = diagnoseStudentWeaknesses(
        mockQuestions,
        mockChapters,
        mockSubjects,
        mockProgressStore,
        mockPerfStore
      );

      const prescription = await generateAIWeaknessPrescription(diag, { forceHeuristic: true });

      expect(prescription).toBeDefined();
      expect(prescription.diagnosisSummary).toContain("धात्विक खनिज");
      expect(prescription.dailySteps.length).toBe(3);
      expect(prescription.dailySteps[0].title).toBeDefined();
      expect(prescription.dailySteps[0].actionItem).toBeDefined();
      expect(prescription.dailySteps[0].mnemonicOrTip).toBeDefined();
      expect(prescription.officialSourcesCitations.length).toBeGreaterThan(0);
    });
  });

  describe("createRemedialTestSession", () => {
    it("creates a targeted remedial test session with only the student's weak questions", () => {
      const diag = diagnoseStudentWeaknesses(
        mockQuestions,
        mockChapters,
        mockSubjects,
        mockProgressStore,
        mockPerfStore
      );

      const session = createRemedialTestSession(diag, 15);

      expect(session.title).toContain("उपचारात्मक");
      expect(session.questionIds.length).toBe(4); // All 4 wrong questions
      expect(session.questionIds).toContain("q-1"); // Impulse mistake
      expect(session.questionIds).toContain("q-2");
      expect(session.questionIds).toContain("q-3");
      expect(session.questionIds).toContain("q-5");
      expect(session.questionIds).not.toContain("q-4"); // Correct question excluded
    });
  });
});
