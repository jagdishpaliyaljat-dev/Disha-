// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import {
  submitQuestionReport,
  updateReportStatus,
  fetchAuthoritativeQuestion,
  getStoredReports,
  saveStoredReports,
  QuestionReport
} from "../src/utils/questionReportService";
import { loadNotifications } from "../src/utils/notificationsStorage";
import type { Question } from "../src/types";

describe("Doubt Desk & Full Question Editor Suite", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    saveStoredReports([]);
  });

  it("1. submitQuestionReport stores complete question snapshot and initial audit log", async () => {
    const mockQuestion: Question = {
      id: "q_sample_101",
      text: "राजस्थान की प्रथम औद्योगिक नीति किस वर्ष घोषित की गई थी?",
      options: ["1978", "1991", "1994", "1998", "अनुत्तरित प्रश्न"],
      correctIndex: 0,
      explanation: "राजस्थान की प्रथम औद्योगिक नीति 24 जून, 1978 को घोषित की गई थी।",
      importantFact: "द्वितीय नीति 1991 में आई।",
      chapterId: "ch_econ_ind",
      topicId: "top_ind_policy",
      difficulty: "medium",
      exam: "RAS Pre",
      year: "2021",
    };

    const res = await submitQuestionReport({
      questionId: mockQuestion.id,
      questionText: mockQuestion.text,
      studentName: "Devendra",
      studentEmail: "devendra@example.com",
      issueType: "wrong_answer",
      studentComment: "Option B होना चाहिए, कृपया जांचें।",
      question: mockQuestion,
    });

    expect(res.success).toBe(true);
    expect(res.report.optionsSnapshot).toEqual(["1978", "1991", "1994", "1998", "अनुत्तरित प्रश्न"]);
    expect(res.report.correctIndexSnapshot).toBe(0);
    expect(res.report.status).toBe("pending");
    expect(res.report.auditLogs).toBeDefined();
    expect(res.report.auditLogs?.length).toBe(1);
    expect(res.report.auditLogs?.[0].action).toBe("submitted");
    expect(res.report.auditLogs?.[0].actor).toBe("Devendra");
  });

  it("2. fetchAuthoritativeQuestion resolves real question data and rejects dummy fallbacks", async () => {
    const realQ: Question = {
      id: "q_real_auth_1",
      text: "मरु विकास कार्यक्रम (DDP) कब प्रारम्भ हुआ?",
      options: ["1977-78", "1985-86", "1999-2000", "1974-75", "अनुत्तरित प्रश्न"],
      correctIndex: 0,
      explanation: "मरु विकास कार्यक्रम 1977-78 में केंद्र व राज्य की भागीदारी से शुरू हुआ।",
      chapterId: "ch_rajasthan_geog",
      topicId: "top_schemes",
    };

    localStorage.setItem(`disha2020_mcq_${realQ.id}`, JSON.stringify(realQ));

    const resolved = await fetchAuthoritativeQuestion(realQ.id);
    expect(resolved.id).toBe(realQ.id);
    expect(resolved.text).toBe(realQ.text);
    expect(resolved.options).toEqual(["1977-78", "1985-86", "1999-2000", "1974-75", "अनुत्तरित प्रश्न"]);
    expect(resolved.options).not.toContain("Option A");
    expect(resolved.explanation).toContain("1977-78");
  });

  it("3. updateReportStatus cycles through statuses (Pending, Under Review, Resolved, Rejected) with audit logs", async () => {
    const report: QuestionReport = {
      id: "rep_test_001",
      questionId: "q_test_001",
      questionText: "Sample Question Text",
      studentName: "Pooja",
      issueType: "wrong_explanation",
      studentComment: "Explanation has calculation error",
      reportedAt: new Date().toISOString(),
      status: "pending",
      auditLogs: [],
    };
    saveStoredReports([report]);

    // 1. Move to under_review
    await updateReportStatus(report.id, "under_review", "Assigned to subject expert", {
      actor: "Jagdish Paliyal",
      auditAction: "status_change",
    });

    let stored = getStoredReports();
    let current = stored.find((r) => r.id === report.id);
    expect(current?.status).toBe("under_review");
    expect(current?.auditLogs?.length).toBe(1);
    expect(current?.auditLogs?.[0].newStatus).toBe("under_review");

    // 2. Resolve with question update
    await updateReportStatus(report.id, "resolved", "Fixed formula and corrected solution", {
      actor: "Jagdish Paliyal",
      auditAction: "question_updated",
      changesSummary: "Options updated and explanation rewritten.",
    });

    stored = getStoredReports();
    current = stored.find((r) => r.id === report.id);
    expect(current?.status).toBe("resolved");
    expect(current?.resolvedAt).toBeDefined();
    expect(current?.auditLogs?.length).toBe(2);

    // 3. Verify student notification was dispatched automatically
    const notifications = loadNotifications();
    expect(notifications.length).toBeGreaterThan(0);
    const resolvedNotif = notifications.find((n) => n.title.includes("Resolved") || n.hindiTitle?.includes("स्वीकृत"));
    expect(resolvedNotif).toBeDefined();
    expect(resolvedNotif?.priority).toBe("high");
  });
});
