import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock localStorage & sessionStorage for Node.js test environment
const mockStorageData: Record<string, string> = {};
const mockSessionData: Record<string, string> = {};

const mockLocalStorage = {
  getItem: vi.fn((key: string) => mockStorageData[key] || null),
  setItem: vi.fn((key: string, val: string) => {
    mockStorageData[key] = String(val);
  }),
  removeItem: vi.fn((key: string) => {
    delete mockStorageData[key];
  }),
  clear: vi.fn(() => {
    for (const k in mockStorageData) delete mockStorageData[k];
  }),
};

const mockSessionStorage = {
  getItem: vi.fn((key: string) => mockSessionData[key] || null),
  setItem: vi.fn((key: string, val: string) => {
    mockSessionData[key] = String(val);
  }),
  removeItem: vi.fn((key: string) => {
    delete mockSessionData[key];
  }),
  clear: vi.fn(() => {
    for (const k in mockSessionData) delete mockSessionData[k];
  }),
};

(globalThis as any).localStorage = mockLocalStorage;
(globalThis as any).sessionStorage = mockSessionStorage;

const listeners: Record<string, Function[]> = {};
if (typeof (globalThis as any).window === "undefined") {
  (globalThis as any).window = {
    addEventListener: (event: string, cb: Function) => {
      listeners[event] = listeners[event] || [];
      listeners[event].push(cb);
    },
    removeEventListener: (event: string, cb: Function) => {
      if (!listeners[event]) return;
      listeners[event] = listeners[event].filter((f) => f !== cb);
    },
    dispatchEvent: (e: any) => {
      const cbs = listeners[e.type] || [];
      cbs.forEach((cb) => cb(e));
      return true;
    },
    localStorage: mockLocalStorage,
    sessionStorage: mockSessionStorage,
  };
}

if (typeof (globalThis as any).CustomEvent === "undefined") {
  (globalThis as any).CustomEvent = class CustomEvent {
    type: string;
    detail: any;
    constructor(type: string, params: any = {}) {
      this.type = type;
      this.detail = params.detail;
    }
  };
}

import {
  submitQuestionReport,
  getStoredReports,
  saveStoredReports,
  updateReportStatus,
  deleteReport,
  hasStudentReportedQuestion,
  markQuestionAsReported,
  REPORTS_STORAGE_KEY,
  LEGACY_REPORTS_STORAGE_KEY,
  REPORT_EVENT_NAME,
  QuestionReport,
  ISSUE_TYPE_LABELS,
} from "../src/utils/questionReportService";
import type { Question } from "../src/types";

describe("Question Reporting & Student Grievance System (प्रश्न आपत्ति एवं दावा प्रणाली)", () => {
  beforeEach(() => {
    mockLocalStorage.clear();
    mockSessionStorage.clear();
    vi.clearAllMocks();
  });

  const mockQuestion: Question = {
    id: "q-rajasthan-forts-01",
    text: "राजस्थान के किस दुर्ग को 'यूनेस्को विश्व धरोहर' में शामिल किया गया है?",
    options: ["आमेर दुर्ग", "गागरोन दुर्ग", "कुम्भलगढ़ दुर्ग", "उपर्युक्त सभी"],
    correctIndex: 3,
    explanation: "वर्ष 2013 में राजस्थान के 6 पहाड़ी दुर्गों को यूनेस्को ने विश्व धरोहर घोषित किया।",
    chapterId: "ch-architecture-01",
    topicId: "tp-forts-01",
    exam: "RAS Pre",
    year: "2021",
  };

  it("1. should submit a valid question report with category and student comment", async () => {
    let capturedEvent: any = null;
    const handler = (e: any) => {
      capturedEvent = e;
    };
    window.addEventListener(REPORT_EVENT_NAME, handler);

    const result = await submitQuestionReport({
      questionId: mockQuestion.id,
      questionText: mockQuestion.text,
      subjectName: "राजस्थान का इतिहास व कला-संस्कृति",
      chapterName: "दुर्ग एवं स्थापत्य कला",
      topicName: "राजस्थान के प्रमुख किले",
      studentName: "सुरेश बिश्नोई (Aspirant)",
      studentEmail: "suresh.b@gmail.com",
      issueType: "wrong_answer",
      studentComment: "सर ऑप्शन 4 सही होना चाहिए, लेकिन कुंजी में ऑप्शन 1 दिखाया गया है।",
      question: mockQuestion,
    });

    expect(result.success).toBe(true);
    expect(result.report).toBeDefined();
    expect(result.report.id).toMatch(/^rep_/);
    expect(result.report.questionId).toBe(mockQuestion.id);
    expect(result.report.issueType).toBe("wrong_answer");
    expect(result.report.status).toBe("pending");
    expect(result.report.sourceExam).toBe("RAS Pre");
    expect(result.report.optionsSnapshot).toEqual(mockQuestion.options);
    expect(result.report.correctIndexSnapshot).toBe(3);

    // Event verification
    expect(capturedEvent).not.toBeNull();
    expect(capturedEvent.detail.report.id).toBe(result.report.id);

    window.removeEventListener(REPORT_EVENT_NAME, handler);
  });

  it("2. should persist submitted reports to local storage and sync with legacy storage key", async () => {
    await submitQuestionReport({
      questionId: "q-typo-02",
      questionText: "1857 की क्रांति का प्रारंभ नसीराबाद में कब हुआ था?",
      issueType: "typo",
      studentComment: "तारीख 28 मई 1857 होनी चाहिए, टाइपिंग में मार्च लिखा आ रहा है।",
      question: mockQuestion,
    });

    const storedReports = getStoredReports();
    expect(storedReports.length).toBe(1);
    expect(storedReports[0].questionId).toBe("q-typo-02");
    expect(storedReports[0].issueType).toBe("typo");

    // Mirror in legacy key
    const rawLegacy = mockLocalStorage.getItem(LEGACY_REPORTS_STORAGE_KEY);
    expect(rawLegacy).toBeTruthy();
    const parsedLegacy = JSON.parse(rawLegacy!);
    expect(parsedLegacy[0].questionId).toBe("q-typo-02");
  });

  it("3. should track that a student has reported a question to prevent duplicates", async () => {
    expect(hasStudentReportedQuestion("q-test-claim-99")).toBe(false);

    await submitQuestionReport({
      questionId: "q-test-claim-99",
      questionText: "कालीबंगा सभ्यता किस नदी के किनारे स्थित थी?",
      issueType: "wrong_explanation",
      studentComment: "व्याख्या में घग्घर नदी की जगह लूणी नदी लिखा है।",
    });

    expect(hasStudentReportedQuestion("q-test-claim-99")).toBe(true);
  });

  it("4. should support all standard competitive exam objection categories with Hindi descriptions", () => {
    const requiredCategories = [
      "wrong_answer",
      "typo",
      "incomplete_options",
      "wrong_explanation",
      "ambiguous",
      "outdated",
      "other",
    ] as const;

    requiredCategories.forEach((cat) => {
      const meta = ISSUE_TYPE_LABELS[cat];
      expect(meta).toBeDefined();
      expect(meta.hi.length).toBeGreaterThan(5);
      expect(meta.description.length).toBeGreaterThan(10);
    });
  });

  it("5. should allow admin to update report status to resolved or dismissed", async () => {
    const submission = await submitQuestionReport({
      questionId: mockQuestion.id,
      questionText: mockQuestion.text,
      issueType: "ambiguous",
      studentComment: "प्रश्न की भाषा में स्पष्टता नहीं है।",
    });

    const reportId = submission.report.id;
    expect(submission.report.status).toBe("pending");

    // Resolve report
    const ok = await updateReportStatus(reportId, "resolved", "उत्तर कुंजी व व्याख्या संशोधित की गई");
    expect(ok).toBe(true);

    const reportsAfter = getStoredReports();
    const resolvedReport = reportsAfter.find((r) => r.id === reportId);
    expect(resolvedReport?.status).toBe("resolved");
    expect(resolvedReport?.adminNotes).toBe("उत्तर कुंजी व व्याख्या संशोधित की गई");
    expect(resolvedReport?.resolvedAt).toBeTruthy();
  });

  it("6. should allow deleting a report permanently", async () => {
    const sub1 = await submitQuestionReport({
      questionId: "q-del-1",
      questionText: "Question 1",
      issueType: "other",
      studentComment: "Spam comment test",
    });

    const sub2 = await submitQuestionReport({
      questionId: "q-del-2",
      questionText: "Question 2",
      issueType: "wrong_answer",
      studentComment: "Valid question objection",
    });

    expect(getStoredReports().length).toBe(2);

    const delResult = await deleteReport(sub1.report.id);
    expect(delResult).toBe(true);

    const remaining = getStoredReports();
    expect(remaining.length).toBe(1);
    expect(remaining[0].id).toBe(sub2.report.id);
  });
});
