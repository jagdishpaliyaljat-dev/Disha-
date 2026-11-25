import { describe, it, expect, beforeEach } from "vitest";
import { Question, UserQuestionsStore, Chapter } from "../src/types";
import {
  auditQuestionForStaleness,
  scanQuestionBankForOutdatedFacts,
  refreshQuestionWithAI,
  applyRefreshedDataToQuestion,
  tagHistoricalProvenanceBadge,
  archiveQuestionToVault,
  restoreQuestionFromVault,
  bulkArchiveQuestionsToVault,
  OFFICIAL_BENCHMARKS_2024_25,
} from "../src/services/outdatedFactArchiverService";
import { getCombinedQuestions } from "../src/utils/questionsStorage";

describe("Outdated Data & Fact Expiry Controller (outdatedFactArchiverService)", () => {
  let mockStore: UserQuestionsStore;

  beforeEach(() => {
    mockStore = {
      customQuestions: [],
      cloudCacheQuestions: [],
      recycleBinQuestions: [],
      archivedQuestions: [],
      archivedQuestionIds: [],
    };
  });

  describe("auditQuestionForStaleness & Staleness Classification", () => {
    it("classifies static evergreen questions as evergreen with zero risk", () => {
      const q: Question = {
        id: "q-static-1",
        text: "राजस्थान का राज्य पुष्प कौन सा है?",
        options: ["रोहिड़ा", "खेजड़ी", "गुलाब", "कमल"],
        correctIndex: 0,
        explanation: "रोहिड़ा राजस्थान का राज्य पुष्प है जिसे 1983 में घोषित किया गया।",
      };

      const result = auditQuestionForStaleness(q);
      expect(result.classification).toBe("evergreen");
      expect(result.riskScore).toBe(0);
      expect(result.indicators.length).toBe(0);
    });

    it("detects obsolete Rajasthan districts (33 districts) as critical_superseded", () => {
      const q: Question = {
        id: "q-districts-1",
        text: "राजस्थान में कुल 33 जिले हैं। इनमें से सबसे बड़ा जिला कौन सा है?",
        options: ["जैसलमेर", "बीकानेर", "बाड़मेर", "जोधपुर"],
        correctIndex: 0,
        explanation: "राजस्थान में 33 जिले हैं।",
      };

      const result = auditQuestionForStaleness(q);
      expect(result.classification).toBe("critical_superseded");
      expect(result.riskScore).toBe(95);
      expect(result.indicators.some((i) => i.category === "demographic_districts")).toBe(true);
      expect(result.suggested2024Fix).toBeDefined();
      expect(result.suggested2024Fix?.updatedText).toContain("50 जिले");
    });

    it("detects dynamic RBI repo rate with 'वर्तमान में' as critical_superseded", () => {
      const q: Question = {
        id: "q-repo-1",
        text: "वर्तमान में भारतीय रिजर्व बैंक (RBI) की रेपो दर कितनी है?",
        options: ["4.00%", "5.15%", "6.50%", "6.75%"],
        correctIndex: 0,
        explanation: "वर्तमान में रेपो दर 4.00% है।",
      };

      const result = auditQuestionForStaleness(q);
      expect(result.classification).toBe("critical_superseded");
      expect(result.riskScore).toBe(95);
      expect(result.indicators.some((i) => i.category === "economic_rate")).toBe(true);
      expect(result.suggested2024Fix?.updatedOptions).toContain(OFFICIAL_BENCHMARKS_2024_25.repoRate);
    });

    it("identifies past fiscal years in economic contexts as needs_refresh", () => {
      const q: Question = {
        id: "q-budget-1",
        text: "वित्तीय वर्ष 2018-19 में भारत का राजकोषीय घाटा जीडीपी का कितना प्रतिशत था?",
        options: ["3.4%", "4.5%", "4.9%", "5.1%"],
        correctIndex: 0,
        explanation: "2018-19 के बजट अनुसार राजकोषीय घाटा 3.4% था।",
      };

      const result = auditQuestionForStaleness(q);
      expect(result.classification).toBe("needs_refresh");
      expect(result.riskScore).toBe(75);
      expect(result.indicators.some((i) => i.category === "fiscal_year")).toBe(true);
    });

    it("classifies authentic past-year exam questions as historical_pyq", () => {
      const q: Question = {
        id: "q-pyq-1",
        text: "RAS Pre 2018: वर्ष 2017-18 के आर्थिक सर्वेक्षण के अनुसार राजस्थान की विकास दर क्या थी?",
        options: ["7.1%", "6.5%", "5.8%", "8.2%"],
        correctIndex: 0,
        isPYQ: true,
        examName: "RPSC RAS Pre",
        year: 2018,
      };

      const result = auditQuestionForStaleness(q);
      expect(result.classification).toBe("historical_pyq");
      expect(result.riskScore).toBe(60);
      expect(result.hasProvenanceBadge).toBe(false);
    });
  });

  describe("Heuristic & AI 2024-25 Refresh Engine", () => {
    it("generates 2024-25 refresh accurately via forceHeuristic fallback", async () => {
      const q: Question = {
        id: "q-repo-update",
        text: "वर्तमान में भारतीय रिजर्व बैंक की रेपो दर क्या है?",
        options: ["4.00%", "5.50%", "6.00%", "5.15%"],
        correctIndex: 0,
        explanation: "पुरानी दर 4% थी।",
      };

      const audit = auditQuestionForStaleness(q);
      const fix = await refreshQuestionWithAI(q, audit.indicators, { forceHeuristic: true });

      expect(fix).toBeDefined();
      expect(fix.updatedOptions).toContain("6.50%");
      expect(fix.updatedOptions[fix.updatedCorrectIndex]).toBe("6.50%");
      expect(fix.sourceCitation).toContain("2024-25");
    });

    it("applies refreshed 2024-25 data to the question store", async () => {
      const q: Question = {
        id: "q-edit-target",
        text: "राजस्थान में कुल 33 जिले हैं।",
        options: ["33", "28", "25", "30"],
        correctIndex: 0,
        explanation: "33 जिले हैं।",
      };
      mockStore.customQuestions = [q];

      const fix = {
        updatedText: "नवीनतम पुनर्गठन के अनुसार राजस्थान में कितने जिले हैं?",
        updatedOptions: ["50", "33", "45", "40"],
        updatedCorrectIndex: 0,
        updatedExplanation: "राजस्थान में अब 50 जिले हैं।",
        sourceCitation: "Rajasthan Gazette 2024",
        confidence: 0.95,
      };

      const { nextStore, updatedQuestion } = await applyRefreshedDataToQuestion(
        mockStore,
        "q-edit-target",
        fix
      );

      expect(updatedQuestion.text).toBe(fix.updatedText);
      expect(updatedQuestion.correctIndex).toBe(0);
      expect(updatedQuestion.refreshedToYear).toBe("2024-25");
      expect(updatedQuestion.outdatedFactType).toBe("evergreen");

      const inStore = nextStore.customQuestions?.find((item) => item.id === "q-edit-target");
      expect(inStore?.text).toBe(fix.updatedText);
      expect(inStore?.options).toEqual(["50", "33", "45", "40"]);
    });
  });

  describe("Provenance Tagging for Authentic Historical PYQs", () => {
    it("tags historical provenance badge without overwriting exam facts", async () => {
      const pyq: Question = {
        id: "pyq-ras-2016",
        text: "राजस्थान की 12वीं पंचवर्षीय योजना में विकास दर का क्या लक्ष्य रखा गया था?",
        options: ["7.7%", "8.5%", "9.0%", "6.5%"],
        correctIndex: 0,
        year: 2016,
        examName: "RAS Pre 2016",
        isPYQ: true,
      };
      mockStore.customQuestions = [pyq];

      const { nextStore, taggedQuestion } = await tagHistoricalProvenanceBadge(
        mockStore,
        "pyq-ras-2016",
        2016
      );

      expect(taggedQuestion.historicalProvenanceBadge).toContain("2016");
      expect(taggedQuestion.explanation).toContain("[ऐतिहासिक PYQ: यह प्रश्न वर्ष 2016");
      expect(taggedQuestion.outdatedFactType).toBe("historical_pyq");

      const inStore = nextStore.customQuestions?.find((item) => item.id === "pyq-ras-2016");
      expect(inStore?.historicalProvenanceBadge).toBeDefined();
    });
  });

  describe("Archive Vault Operations & Student Practice Exclusion", () => {
    it("archives an outdated question safely to the vault without data loss", async () => {
      const q: Question = {
        id: "q-to-archive",
        text: "योजना आयोग के वर्तमान उपाध्यक्ष कौन हैं?",
        options: ["मोंटेक सिंह अहलूवालिया", "अरविंद पनगढ़िया", "राजीव कुमार", "सुमन बेरी"],
        correctIndex: 0,
      };
      mockStore.customQuestions = [q];

      const { nextStore, archivedQuestion } = await archiveQuestionToVault(
        mockStore,
        "q-to-archive",
        "योजना आयोग समाप्त होकर नीति आयोग में परिवर्तित हो गया है।"
      );

      expect(archivedQuestion.isArchived).toBe(true);
      expect(archivedQuestion.archivedReason).toContain("योजना आयोग");
      expect(nextStore.archivedQuestionIds).toContain("q-to-archive");
      expect(nextStore.archivedQuestions?.some((item) => item.id === "q-to-archive")).toBe(true);
      expect(nextStore.customQuestions?.some((item) => item.id === "q-to-archive")).toBe(false);
    });

    it("restores an archived question back to the active question bank", async () => {
      const archivedQ: Question = {
        id: "q-archived-item",
        text: "आर्काइव किया गया प्रश्न",
        options: ["A", "B"],
        correctIndex: 0,
        isArchived: true,
      };
      mockStore.archivedQuestions = [archivedQ];
      mockStore.archivedQuestionIds = ["q-archived-item"];

      const { nextStore, restoredQuestion } = await restoreQuestionFromVault(
        mockStore,
        "q-archived-item"
      );

      expect(restoredQuestion.isArchived).toBe(false);
      expect(nextStore.archivedQuestionIds).not.toContain("q-archived-item");
      expect(nextStore.archivedQuestions?.length).toBe(0);
      expect(nextStore.customQuestions?.some((item) => item.id === "q-archived-item")).toBe(true);
    });

    it("bulk archives multiple questions efficiently", async () => {
      const q1: Question = { id: "bulk-1", text: "Old fact 1", options: ["A", "B"], correctIndex: 0 };
      const q2: Question = { id: "bulk-2", text: "Old fact 2", options: ["A", "B"], correctIndex: 0 };
      mockStore.customQuestions = [q1, q2];

      const { nextStore, archivedCount } = await bulkArchiveQuestionsToVault(
        mockStore,
        ["bulk-1", "bulk-2"],
        "Bulk year-end cleanup"
      );

      expect(archivedCount).toBe(2);
      expect(nextStore.archivedQuestionIds).toEqual(["bulk-1", "bulk-2"]);
      expect(nextStore.customQuestions?.length).toBe(0);
    });

    it("ensures getCombinedQuestions automatically excludes archived questions from student tests", () => {
      const activeQ: Question = {
        id: "active-1",
        text: "सक्रिय प्रश्न",
        options: ["विकल्प 1", "विकल्प 2"],
        correctIndex: 0,
      };
      const archivedQ: Question = {
        id: "archived-1",
        text: "आर्काइव्ड प्रश्न",
        options: ["विकल्प 1", "विकल्प 2"],
        correctIndex: 0,
        isArchived: true,
      };

      const testStore: UserQuestionsStore = {
        customQuestions: [activeQ, archivedQ],
        archivedQuestions: [archivedQ],
        archivedQuestionIds: ["archived-1"],
      };

      const chapters: Chapter[] = [];
      // Default: exclude archived
      const studentQuestions = getCombinedQuestions(chapters, testStore);
      expect(studentQuestions.some((q) => q.id === "active-1")).toBe(true);
      expect(studentQuestions.some((q) => q.id === "archived-1")).toBe(false);

      // With { includeArchived: true }
      const allQuestions = getCombinedQuestions(chapters, testStore, { includeArchived: true });
      expect(allQuestions.some((q) => q.id === "active-1")).toBe(true);
      expect(allQuestions.some((q) => q.id === "archived-1")).toBe(true);
    });
  });

  describe("scanQuestionBankForOutdatedFacts summary", () => {
    it("generates correct aggregate metrics for an entire question batch", () => {
      const questions: Question[] = [
        { id: "1", text: "राजस्थान में कुल 33 जिले हैं।", options: ["A", "B"], correctIndex: 0 },
        { id: "2", text: "2018-19 में राजकोषीय घाटा कितना था?", options: ["A", "B"], correctIndex: 0 },
        { id: "3", text: "RAS Pre 2021: 2020-21 की वृद्धि दर क्या थी?", options: ["A", "B"], correctIndex: 0, isPYQ: true },
        { id: "4", text: "राजस्थान की राजधानी जयपुर है।", options: ["A", "B"], correctIndex: 0 },
      ];

      const summary = scanQuestionBankForOutdatedFacts(questions, mockStore);
      expect(summary.totalScanned).toBe(4);
      expect(summary.criticalSupersededCount).toBe(1);
      expect(summary.needsRefreshCount).toBe(1);
      expect(summary.historicalPyqCount).toBe(1);
      expect(summary.evergreenCount).toBe(1);
    });
  });
});
