import { generateExamAnalysisPDF } from "../src/utils/examPdfReport";
import { ExamPaperAnalysis, ExamQuestionMatch } from "../src/types";

console.log("Testing PDF Generation for Exam Paper Analysis...");

const dummyAnalysis: ExamPaperAnalysis = {
  analysisId: "test-analysis-1",
  userId: "user-1",
  examId: "ras-pre-2023",
  examName: "RAS Pre Examination",
  paperYear: "2023",
  paperDate: "2023-10-01",
  paperName: "General Knowledge & General Science",
  shiftCode: "Series A",
  status: "completed",
  totalPages: 2,
  detectedQuestionCount: 3,
  analyzedQuestionCount: 3,
  exactMatchCount: 1,
  nearExactMatchCount: 1,
  similarMatchCount: 0,
  conceptMatchCount: 1,
  unmatchedCount: 0,
  needsReviewCount: 0,
  createdAt: new Date().toISOString(),
  completedAt: new Date().toISOString(),
  schemaVersion: 1,
  questions: [
    {
      examQuestionId: "q1",
      originalQuestionNumber: 1,
      sourcePageNumber: 1,
      originalText: "राजस्थान की नवीनतम सौर ऊर्जा नीति किस वर्ष जारी की गई थी?",
      normalizedText: "राजस्थान की नवीनतम सौर ऊर्जा नीति किस वर्ष जारी की गई थी",
      extractedOptions: ["2018", "2019", "2021", "2023"],
      ocrStatus: "high",
      reviewStatus: "confirmed",
      primaryMatchCategory: "exact",
      bestMatchQuestionId: "qb-101",
      bestMatchQuestion: {
        id: "qb-101",
        text: "राजस्थान में नवीनतम सौर ऊर्जा नीति किस वर्ष जारी की गई थी?",
        options: ["2018", "2019", "2021", "2023"],
        correctIndex: 1,
        explanation: "वर्ष 2019 में सौर ऊर्जा नीति जारी की गई।",
      },
      matchScore: 100,
      matchExplanation: "शब्द-दर-शब्द पूर्ण मेल (Exact Match)।",
      processingStatus: "completed",
    },
    {
      examQuestionId: "q2",
      originalQuestionNumber: 2,
      sourcePageNumber: 1,
      originalText: "वर्ष 2023-24 में राजस्थान की प्रति व्यक्ति आय प्रचलित मूल्यों पर कितनी थी?",
      normalizedText: "वर्ष 2023-24 में राजस्थान की प्रति व्यक्ति आय प्रचलित मूल्यों पर कितनी थी",
      extractedOptions: ["₹1,56,149", "₹1,75,000", "₹1,80,000", "₹1,60,000"],
      ocrStatus: "high",
      reviewStatus: "pending",
      primaryMatchCategory: "concept_related",
      bestMatchQuestionId: "qb-102",
      bestMatchQuestion: {
        id: "qb-102",
        text: "वर्ष 2021-22 में राजस्थान की प्रति व्यक्ति आय प्रचलित मूल्यों पर कितनी थी?",
        options: ["₹1,35,962", "₹1,56,149", "₹1,20,000", "₹1,40,000"],
        correctIndex: 0,
        explanation: "वर्ष 2021-22 की समीक्षा के अनुसार।",
      },
      matchScore: 45,
      matchExplanation: "संबद्ध अवधारणा (Related Concept): दोनों प्रश्न प्रति व्यक्ति आय से संबंधित हैं, किंतु संदर्भ वर्ष 2021-22 vs 2023-24 भिन्न है।",
      meaningfulDifferences: ["Different reference financial years: 2023-24 vs 2021-22."],
      processingStatus: "completed",
    },
  ],
};

// Check if pdf generation executes cleanly
try {
  generateExamAnalysisPDF(dummyAnalysis);
  console.log("✅ [PASS] PDF report generated successfully without errors!");
} catch (e) {
  console.error("❌ [FAIL] PDF generation failed:", e);
  process.exit(1);
}
