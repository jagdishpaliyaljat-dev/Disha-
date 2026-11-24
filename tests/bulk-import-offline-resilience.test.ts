// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { validateQuestion } from "../src/lib/mcqImport/validate";
import { processJSONImport } from "../src/lib/mcqImport";
import { commitQuestions } from "../src/lib/mcqImport/commit";
import { saveUserProfile } from "../src/utils/userProfileStorage";
import * as supabaseSyncService from "../src/utils/supabaseSyncService";
import * as localDatabaseEngine from "../src/utils/localDatabaseEngine";
import { Question } from "../src/types";

describe("Bulk MCQ Import - Target Curriculum Mapping & Local DB Resilience", () => {
  beforeEach(() => {
    localStorage.clear();
    // Set up authoritative admin profile
    saveUserProfile({
      id: "admin_test_user",
      name: "Admin User",
      email: "jagdishpaliyaljat@gmail.com",
      role: "admin",
      isAdmin: true,
      hasFullAccess: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      targetExam: "General",
      dailyGoal: 50,
      streak: 1,
      lastActiveDate: new Date().toISOString(),
      bookmarkedQuestions: [],
      attemptedQuestions: {},
      isGuest: false,
    });
  });

  it("marks questions as 'ready' and does not throw unmapped chapter warnings when target curriculum is explicitly provided", () => {
    const rawQuestion = {
      type: "single_correct" as const,
      question: "'ओर' और 'और' शब्दों के सही अर्थ क्रमशः क्या हैं?",
      options: ["तथा, दूसरा - तरफ", "तरफ - तथा, दूसरा", "दिशा - किनारा", "प्रथम - द्वितीय"],
      answer: "B",
      correctIndex: 1,
      chapter: "शब्द-युग्म",
      topic: "ओर - और",
    };

    const mockCurriculum = {
      subjects: [{ id: "sub_hindi", name: "Hindi", hindiName: "सामान्य हिंदी" }],
      chapters: [{ id: "chap_shabd", subjectId: "sub_hindi", title: "समरूपी भिन्नार्थक शब्द", hindiTitle: "समरूपी भिन्नार्थक शब्द" }],
      topics: [{ id: "top_mcq_03", chapterId: "chap_shabd", title: "MCQ 03", hindiTitle: "MCQ 03" }],
    };

    // When targetChapterId and targetTopicId are provided (as selected in Setup step):
    const res = validateQuestion(rawQuestion, 1, {
      curriculum: mockCurriculum,
      targetChapterId: "chap_shabd",
      targetTopicId: "top_mcq_03",
    });

    expect(res.isValid).toBe(true);
    expect(res.reviewCategory).toBe("ready");
    expect(res.warnings.some((w) => w.includes("could not be mapped"))).toBe(false);
  });

  it("processJSONImport marks questions as ready when targetChapterId and targetTopicId are provided", () => {
    const jsonInput = JSON.stringify({
      schemaVersion: 1,
      questions: [
        {
          question: "'ओर' और 'और' शब्दों के सही अर्थ क्रमशः क्या हैं?",
          options: ["तथा, दूसरा - तरफ", "तरफ - तथा, दूसरा", "दिशा - किनारा", "प्रथम - द्वितीय"],
          answer: "B",
          chapter: "शब्द-युग्म",
          topic: "ओर - और",
        },
      ],
    });

    const parsed = processJSONImport(jsonInput, new Set(), {
      curriculum: {
        subjects: [{ id: "sub_hindi", name: "Hindi" }],
        chapters: [{ id: "chap_shabd", title: "समरूपी भिन्नार्थक शब्द" }],
        topics: [{ id: "top_mcq_03", title: "MCQ 03" }],
      },
      targetChapterId: "chap_shabd",
      targetTopicId: "top_mcq_03",
    });

    expect(parsed.success).toBe(true);
    expect(parsed.results.length).toBe(1);
    expect(parsed.results[0].reviewCategory).toBe("ready");
    expect(parsed.results[0].isValid).toBe(true);
  });

  it("commitQuestions succeeds gracefully when questions are saved locally even if cloud sync is offline", async () => {
    // Mock localDatabaseEngine and supabaseSyncService
    vi.spyOn(localDatabaseEngine, "openLocalDatabase").mockResolvedValue({} as any);
    vi.spyOn(localDatabaseEngine, "idbPutBatch").mockResolvedValue(undefined as any);
    vi.spyOn(supabaseSyncService, "upsertQuestionsToSupabase").mockResolvedValue({
      success: true,
      count: 33,
      cloudSynced: false,
      message: "33 question(s) saved locally! Will sync when connected.",
    });

    const mockQuestions: Question[] = [
      {
        id: "q_test_bulk_01",
        text: "'ओर' और 'और' शब्दों के सही अर्थ क्रमशः क्या हैं?",
        options: ["तथा, दूसरा - तरफ", "तरफ - तथा, दूसरा", "दिशा - किनारा", "प्रथम - द्वितीय"],
        correctIndex: 1,
        explanation: "",
        subjectId: "sub_hindi",
        chapterId: "chap_shabd",
        topicId: "top_mcq_03",
        createdAt: new Date().toISOString(),
      },
    ];

    const result = await commitQuestions(mockQuestions, "batch_test_123");

    // Must NOT throw or return error; must succeed and report local commit with cloudSynced = false
    expect(result.success).toBe(true);
    expect(result.committedCount).toBe(1);
    expect(result.failedCount).toBe(0);
    expect(result.cloudSynced).toBe(false);
    expect(result.message).toContain("saved locally");
  });
});
