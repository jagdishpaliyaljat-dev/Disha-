import { describe, it, expect, beforeEach } from "vitest";
import { 
  saveSubjectToSupabase,
  deleteSubjectFromSupabase,
  saveChapterToSupabase,
  deleteChapterFromSupabase,
  saveTopicToSupabase,
  deleteTopicFromSupabase,
  upsertQuestionsToSupabase,
  deleteQuestionFromSupabase
} from "../src/utils/supabaseSyncService";
import { openLocalDatabase, idbGet, STORES } from "../src/utils/localDatabaseEngine";
import type { Subject, Chapter, Topic, Question } from "../src/types";

describe("DISHA2020 — Admin Panel Curriculum & MCQ CRUD Functionality", () => {
  beforeEach(async () => {
    await openLocalDatabase();
  });

  const testSubject: Subject = {
    id: "sub_test_admin_crud",
    name: "Test Admin Subject",
    hindiName: "टेस्ट विषय",
    description: "Subject created by admin panel",
    icon: "book",
    color: "#8B1E3F",
    order: 99
  };

  const testChapter: Chapter = {
    id: "chap_test_admin_crud",
    subjectId: "sub_test_admin_crud",
    title: "Test Admin Chapter",
    hindiTitle: "टेस्ट अध्याय",
    number: 1,
    isUserAdded: true
  };

  const testTopic: Topic = {
    id: "top_test_admin_crud",
    chapterId: "chap_test_admin_crud",
    subjectId: "sub_test_admin_crud",
    title: "Test Admin Topic",
    hindiTitle: "टेस्ट टॉपिक",
    number: 1,
    isUserAdded: true
  };

  const testQuestion: Question = {
    id: "q_test_admin_crud_001",
    subjectId: "sub_test_admin_crud",
    chapterId: "chap_test_admin_crud",
    topicId: "top_test_admin_crud",
    text: "प्रशासनिक टेस्ट प्रश्न: राजस्थान का राज्य वृक्ष क्या है?",
    options: ["रोहिड़ा", "खेजड़ी", "बबूल", "नीम"],
    correctIndex: 1,
    explanation: "खेजड़ी (Prosopis cineraria) राजस्थान का राज्य वृक्ष है।",
    exam: "RAS / RPSC",
    year: "2024",
    difficulty: "easy",
    isUserAdded: true
  };

  it("1. Add / Save Subject persists to local DB and returns success", async () => {
    const res = await saveSubjectToSupabase(testSubject);
    expect(res.success).toBe(true);
    expect(res.message).toBeDefined();

    const inDb = await idbGet<Subject>(STORES.SUBJECTS, testSubject.id);
    expect(inDb).toBeDefined();
    expect(inDb?.name).toBe("Test Admin Subject");
  });

  it("2. Edit Subject updates local DB successfully", async () => {
    const updatedSubject: Subject = {
      ...testSubject,
      name: "Updated Admin Subject"
    };
    const res = await saveSubjectToSupabase(updatedSubject);
    expect(res.success).toBe(true);

    const inDb = await idbGet<Subject>(STORES.SUBJECTS, testSubject.id);
    expect(inDb?.name).toBe("Updated Admin Subject");
  });

  it("3. Add / Save Chapter persists to local DB and returns success", async () => {
    const res = await saveChapterToSupabase(testChapter);
    expect(res.success).toBe(true);

    const inDb = await idbGet<Chapter>(STORES.CHAPTERS, testChapter.id);
    expect(inDb).toBeDefined();
    expect(inDb?.title).toBe("Test Admin Chapter");
  });

  it("4. Edit Chapter updates local DB successfully", async () => {
    const updatedChapter: Chapter = {
      ...testChapter,
      title: "Updated Admin Chapter"
    };
    const res = await saveChapterToSupabase(updatedChapter);
    expect(res.success).toBe(true);

    const inDb = await idbGet<Chapter>(STORES.CHAPTERS, testChapter.id);
    expect(inDb?.title).toBe("Updated Admin Chapter");
  });

  it("5. Add / Save Topic persists to local DB and returns success", async () => {
    const res = await saveTopicToSupabase(testTopic);
    expect(res.success).toBe(true);

    const inDb = await idbGet<Topic>(STORES.TOPICS, testTopic.id);
    expect(inDb).toBeDefined();
    expect(inDb?.title).toBe("Test Admin Topic");
  });

  it("6. Edit Topic updates local DB successfully", async () => {
    const updatedTopic: Topic = {
      ...testTopic,
      title: "Updated Admin Topic"
    };
    const res = await saveTopicToSupabase(updatedTopic);
    expect(res.success).toBe(true);

    const inDb = await idbGet<Topic>(STORES.TOPICS, testTopic.id);
    expect(inDb?.title).toBe("Updated Admin Topic");
  });

  it("7. Add / Edit Question persists to local DB and returns success", async () => {
    const res = await upsertQuestionsToSupabase([testQuestion]);
    expect(res.success).toBe(true);
    expect(res.count).toBe(1);

    const inDb = await idbGet<Question>(STORES.MCQS, testQuestion.id);
    expect(inDb).toBeDefined();
    expect(inDb?.text).toContain("राजस्थान");
    expect(inDb?.options).toContain("खेजड़ी");
    expect(inDb?.options).toHaveLength(4);
  });

  it("8. Delete Question removes from local DB and returns success", async () => {
    const res = await deleteQuestionFromSupabase(testQuestion.id);
    expect(res.success).toBe(true);

    const inDb = await idbGet<Question>(STORES.MCQS, testQuestion.id);
    expect(inDb).toBeFalsy();
  });

  it("9. Delete Topic removes from local DB and returns success", async () => {
    const res = await deleteTopicFromSupabase(testTopic.id);
    expect(res.success).toBe(true);

    const inDb = await idbGet<Topic>(STORES.TOPICS, testTopic.id);
    expect(inDb).toBeFalsy();
  });

  it("10. Delete Chapter removes from local DB and returns success", async () => {
    const res = await deleteChapterFromSupabase(testChapter.id);
    expect(res.success).toBe(true);

    const inDb = await idbGet<Chapter>(STORES.CHAPTERS, testChapter.id);
    expect(inDb).toBeFalsy();
  });

  it("11. Delete Subject removes from local DB and returns success", async () => {
    const res = await deleteSubjectFromSupabase(testSubject.id);
    expect(res.success).toBe(true);

    const inDb = await idbGet<Subject>(STORES.SUBJECTS, testSubject.id);
    expect(inDb).toBeFalsy();
  });

  it("12. Production Pilot Questions (q_pilot_001 to q_pilot_010) remain untouched", async () => {
    const { fetchPYQQuestionsFromSupabase, fetchQuestionsByTopic } = await import("../src/utils/supabaseSyncService");
    const pilotQuestions = await fetchPYQQuestionsFromSupabase();
    expect(pilotQuestions.length).toBeGreaterThan(0);
    const pilot1 = pilotQuestions.find(q => q.id === "q_pilot_001");
    expect(pilot1).toBeDefined();
    expect(pilot1?.year).toBe("2021");
  });
});
