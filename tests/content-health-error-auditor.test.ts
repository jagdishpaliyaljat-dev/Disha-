import { describe, it, expect, beforeEach } from "vitest";
import {
  auditQuestionHealth,
  auditQuestionBank,
  detectDuplicateOptions,
  detectAnswerKeyContradiction,
  validateLatexSyntax,
  validateImageIntegrity,
  detectPerformanceAnomalies,
  auditQuestionWithAI,
  applyAuditFixToQuestion,
  autoFixSafeFormatting,
  normalizeOptionText,
} from "../src/services/contentHealthAuditorService";
import { Question, PerformanceStore, UserQuestionsStore } from "../src/types";

describe("Content Health & Question Error Auditor Test Suite", () => {
  let mockStore: UserQuestionsStore;

  beforeEach(() => {
    mockStore = {
      customSubjects: [],
      customChapters: [],
      customTopics: [],
      customQuestions: [],
      cloudCacheQuestions: [],
      editedQuestions: {},
      deletedQuestionIds: [],
    };
  });

  describe("1. Automated Question Error Scanner", () => {
    it("should detect missing mandatory fields (empty text, missing options, invalid index)", () => {
      const invalidQ: Question = {
        id: "q_test_missing_01",
        topicId: "t_01",
        chapterId: "ch_01",
        text: "",
        options: [],
        correctIndex: -1,
        explanation: "",
      };

      const result = auditQuestionHealth(invalidQ);
      expect(result.score).toBeLessThan(50);
      expect(result.rating).toBe("critical");

      const issueTypes = result.issues.map((i) => i.type);
      expect(issueTypes).toContain("missing_field");
      expect(issueTypes).toContain("invalid_answer_key");
      expect(issueTypes).toContain("missing_explanation");
    });

    it("should detect duplicate options in multiple-choice questions", () => {
      const duplicateQ: Question = {
        id: "q_test_dup_01",
        topicId: "t_01",
        chapterId: "ch_01",
        text: "What is the repo rate announced by RBI in the latest monetary policy review?",
        options: ["6.50%", "6.25%", "6.50%", "6.00%"], // Options A and C are identical
        correctIndex: 0,
        explanation: "The Monetary Policy Committee retained the repo rate at 6.50%.",
      };

      const dupCheck = detectDuplicateOptions(duplicateQ.options);
      expect(dupCheck.hasDuplicates).toBe(true);
      expect(dupCheck.duplicatePairs.length).toBeGreaterThan(0);
      expect(dupCheck.duplicatePairs[0].indices).toEqual([0, 2]);

      const result = auditQuestionHealth(duplicateQ);
      expect(result.issues.some((i) => i.type === "duplicate_options")).toBe(true);
      expect(result.score).toBeLessThanOrEqual(75);
    });

    it("should detect shallow or placeholder explanations", () => {
      const shallowQ: Question = {
        id: "q_test_shallow_01",
        topicId: "t_01",
        chapterId: "ch_01",
        text: "Which curve illustrates the inverse relationship between unemployment and inflation?",
        options: ["Lorenz Curve", "Phillips Curve", "Laffer Curve", "Kuznets Curve"],
        correctIndex: 1,
        explanation: "N/A", // Placeholder
      };

      const result = auditQuestionHealth(shallowQ);
      expect(result.issues.some((i) => i.type === "shallow_explanation")).toBe(true);
    });

    it("should detect broken LaTeX syntax (unclosed delimiters & mismatched brackets)", () => {
      // 1. Unclosed single $
      const unclosedDollar = "Calculate the elasticity of demand where $E_d = \\frac{\\Delta Q}{\\Delta P}";
      const check1 = validateLatexSyntax(unclosedDollar);
      expect(check1.isValid).toBe(false);
      expect(check1.errors.some((e) => e.includes("Unclosed single '$'"))).toBe(true);

      // 2. Mismatched curly braces
      const mismatchedBraces = "Given formula $x = \\frac{a+b}{c$ in equilibrium.";
      const check2 = validateLatexSyntax(mismatchedBraces);
      expect(check2.isValid).toBe(false);

      // 3. Valid LaTeX passes cleanly
      const validLatex = "The consumer surplus is $\\int_{0}^{Q} P(q) dq - P_0 Q_0$.";
      const check3 = validateLatexSyntax(validLatex);
      expect(check3.isValid).toBe(true);
      expect(check3.errors.length).toBe(0);
    });

    it("should detect missing referenced images or diagrams", () => {
      const imgQ: Question = {
        id: "q_test_img_01",
        topicId: "t_01",
        chapterId: "ch_01",
        text: "दिए गए चित्र में दिखाए गए समोत्पाद वक्र (Isoquant curve) का ढलान क्या दर्शाता है?",
        options: ["MRTS", "MRS", "Opportunity Cost", "Elasticity"],
        correctIndex: 0,
        explanation: "दिए गए आरेख में समोत्पाद वक्र तकनीकी प्रतिस्थापन की सीमांत दर (MRTS) को दर्शाता है।",
        // No imageUrl provided
      };

      const imgCheck = validateImageIntegrity(imgQ);
      expect(imgCheck.isValid).toBe(false);
      expect(imgCheck.issues.length).toBeGreaterThan(0);

      const result = auditQuestionHealth(imgQ);
      expect(result.issues.some((i) => i.type === "broken_image")).toBe(true);
    });

    it("should detect answer key contradiction between correctIndex and explanation", () => {
      const contradictoryQ: Question = {
        id: "q_test_contra_01",
        topicId: "t_01",
        chapterId: "ch_01",
        text: "What is the primary objective of Open Market Operations (OMO)?",
        options: [
          "Regulating money supply in the economy",
          "Fixing exchange rates directly",
          "Managing government taxation",
          "Controlling industrial subsidies",
        ],
        correctIndex: 2, // Marked as Option C (index 2)
        explanation:
          "Open Market Operations involve sale and purchase of government securities by RBI. अतः विकल्प (A) सही है क्योंकि इसका मुख्य उद्देश्य अर्थव्यवस्था में मुद्रा आपूर्ति को विनियमित करना है।",
      };

      const contradiction = detectAnswerKeyContradiction(contradictoryQ);
      expect(contradiction.hasContradiction).toBe(true);
      expect(contradiction.claimedIndex).toBe(0);

      const result = auditQuestionHealth(contradictoryQ);
      expect(result.issues.some((i) => i.type === "answer_key_contradiction")).toBe(true);
      expect(result.rating).toBe("critical");
      expect(result.aiCorrection).toBeDefined();
      expect(result.aiCorrection?.suggestedCorrectIndex).toBe(0);
    });
  });

  describe("2. Student Performance Anomaly Detection", () => {
    it("should flag extreme student failure rate anomaly (< 15% accuracy)", () => {
      const q: Question = {
        id: "q_anom_fail",
        topicId: "t_01",
        chapterId: "ch_01",
        text: "Which Article of the Constitution deals with the Annual Financial Statement?",
        options: ["Article 110", "Article 112", "Article 114", "Article 280"],
        correctIndex: 1,
        explanation: "Article 112 refers to the Annual Financial Statement (Budget).",
      };

      const mockPerfStore: PerformanceStore = {
        q_anom_fail: {
          questionId: "q_anom_fail",
          chapterId: "ch_01",
          topicId: "t_01",
          attemptCount: 15,
          correctCount: 1,
          wrongCount: 14,
          accuracy: 6.67, // < 15%
          totalTimeSeconds: 450,
          averageTimeSeconds: 30,
          lastTimeTakenSeconds: 28,
          fastestTimeSeconds: 15,
          slowestTimeSeconds: 45,
          lastResult: "wrong",
          lastAttemptAt: new Date().toISOString(),
          recentAttempts: [],
          smartPriorityScore: 90,
          priorityLevel: "high",
          updatedAt: new Date().toISOString(),
        },
      };

      const anomalies = detectPerformanceAnomalies("q_anom_fail", mockPerfStore);
      expect(anomalies.anomalies.some((a) => a.type === "performance_extreme_failure")).toBe(true);

      const result = auditQuestionHealth(q, mockPerfStore);
      expect(result.performanceMetrics?.accuracy).toBe(7);
      expect(result.issues.some((i) => i.type === "performance_extreme_failure")).toBe(true);
    });

    it("should flag fast-wrong trap anomaly when students fail in < 5 seconds", () => {
      const mockPerfStore: PerformanceStore = {
        q_fast_wrong: {
          questionId: "q_fast_wrong",
          chapterId: "ch_01",
          topicId: "t_01",
          attemptCount: 8,
          correctCount: 2,
          wrongCount: 6,
          accuracy: 25,
          totalTimeSeconds: 40,
          averageTimeSeconds: 5,
          lastTimeTakenSeconds: 3,
          fastestTimeSeconds: 2, // Rapid failure
          slowestTimeSeconds: 8,
          lastResult: "wrong",
          lastAttemptAt: new Date().toISOString(),
          recentAttempts: [],
          smartPriorityScore: 85,
          priorityLevel: "high",
          specialTag: "fast_wrong",
          updatedAt: new Date().toISOString(),
        },
      };

      const anomalies = detectPerformanceAnomalies("q_fast_wrong", mockPerfStore);
      expect(anomalies.anomalies.some((a) => a.type === "performance_fast_wrong")).toBe(true);
    });
  });

  describe("3. Question Health Score Rubric (0-100)", () => {
    it("should assign Optimal rating (>= 90) to perfectly authored questions", () => {
      const perfectQ: Question = {
        id: "q_perfect_01",
        topicId: "t_01",
        chapterId: "ch_01",
        subject: "Economics",
        chapter: "Fiscal Policy",
        text: "What constitutes Revenue Deficit in the Union Budget of India?",
        options: [
          "Revenue Expenditure - Revenue Receipts",
          "Fiscal Deficit - Interest Payments",
          "Total Expenditure - Total Receipts",
          "Capital Expenditure - Capital Receipts",
        ],
        correctIndex: 0,
        explanation:
          "Revenue Deficit refers to the excess of government's revenue expenditure over revenue receipts: $\\text{Revenue Deficit} = \\text{Revenue Expenditure} - \\text{Revenue Receipts}$. It signifies dissaving on government account.",
        difficulty: "medium",
        year: 2024,
        examName: "UPSC CSE Prelims",
      };

      const result = auditQuestionHealth(perfectQ);
      expect(result.score).toBeGreaterThanOrEqual(90);
      expect(result.rating).toBe("optimal");
      expect(result.issues.length).toBe(0);
    });

    it("should aggregate whole bank statistics accurately", () => {
      const questions: Question[] = [
        {
          id: "q_agg_1",
          topicId: "t1",
          chapterId: "c1",
          text: "Question 1 text with good explanation",
          options: ["A", "B", "C", "D"],
          correctIndex: 0,
          explanation: "Comprehensive explanation for question 1.",
        },
        {
          id: "q_agg_2",
          topicId: "t1",
          chapterId: "c1",
          text: "Question 2 with duplicate options",
          options: ["Same", "Same", "C", "D"],
          correctIndex: 0,
          explanation: "Explanation here.",
        },
      ];

      const summary = auditQuestionBank(questions);
      expect(summary.totalAudited).toBe(2);
      expect(summary.issueCounts.duplicate_options).toBe(1);
      expect(summary.averageHealthScore).toBeGreaterThan(0);
      expect(summary.averageHealthScore).toBeLessThan(100);
    });
  });

  describe("4. AI Answer-Key & Explanation Auditor & Human Approval", () => {
    it("should generate heuristic auditor correction for contradiction and allow 1-click apply", async () => {
      const targetQ: Question = {
        id: "q_apply_test_01",
        topicId: "t1",
        chapterId: "c1",
        text: "Which institution publishes the World Economic Outlook report?",
        options: ["World Bank", "International Monetary Fund (IMF)", "WTO", "WEF"],
        correctIndex: 0, // Wrong: World Bank marked instead of IMF
        explanation: "The World Economic Outlook is a survey published biannually by the International Monetary Fund (IMF). Therefore, Option B is correct.",
      };

      // Add to mockStore
      mockStore.customQuestions = [targetQ];

      // Audit with AI / Heuristic (using heuristic mode for fast deterministic unit test)
      const correction = await auditQuestionWithAI(targetQ, undefined, { forceHeuristic: true });
      expect(correction.suggestedCorrectIndex).toBe(1); // Option B (IMF)
      expect(correction.confidence).toBeGreaterThan(0.7);

      // Apply fix to question in store
      const { updatedStore, updatedQuestion } = await applyAuditFixToQuestion(
        targetQ.id,
        correction,
        mockStore
      );

      expect(updatedQuestion.correctIndex).toBe(1);
      expect(updatedQuestion.healthScore).toBe(98);

      // Verify updated question in edited questions map
      expect(updatedStore.editedQuestions?.[targetQ.id]?.correctIndex).toBe(1);
    });
  });

  describe("5. Safe Formatting & LaTeX Auto-Fixer", () => {
    it("should safely close unclosed single $ delimiters in batch pass", () => {
      const qWithBrokenLatex: Question = {
        id: "q_latex_fix",
        topicId: "t1",
        chapterId: "c1",
        text: "Calculate the value of $x^2 + y^2", // Missing closing $
        options: [" 10 ", " 20 ", "30", "40"], // Untrimmed whitespace
        correctIndex: 0,
        explanation: "Using Pythagoras theorem $a^2 + b^2 = c^2",
      };

      mockStore.customQuestions = [qWithBrokenLatex];

      const { updatedStore, fixedCount, fixedQuestionIds } = autoFixSafeFormatting(
        [qWithBrokenLatex],
        mockStore
      );

      expect(fixedCount).toBe(1);
      expect(fixedQuestionIds).toContain("q_latex_fix");

      const fixedQ = updatedStore.editedQuestions?.["q_latex_fix"];
      expect(fixedQ).toBeDefined();
      expect(fixedQ.text.endsWith("$")).toBe(true);
      expect(fixedQ.options[0]).toBe("10"); // Trimmed
    });
  });
});
