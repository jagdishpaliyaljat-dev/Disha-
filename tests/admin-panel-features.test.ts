// @vitest-environment jsdom
import { describe, expect, it, beforeEach } from "vitest";
import type { UserQuestionsStore } from "../src/types";
import {
  ADMIN_EMAILS,
  isUserAdmin,
  loadUserProfile,
  saveUserProfile,
  clearUserProfile,
} from "../src/utils/userProfileStorage";
import {
  addSubject,
  editSubject,
  deleteSubject,
  addChapter,
  editChapter,
  deleteChapter,
  addTopic,
  editTopic,
  deleteTopic,
  bulkDeleteQuestions,
  bulkMoveQuestions,
  editQuestionInStore,
  getCombinedSubjects,
  getCombinedChapters,
  getCombinedQuestions,
  getReconciledCurriculumCounts,
  getTotalDisplayCount,
  getSubjectQuestionsCount,
  getChapterDisplayCount,
  getTopicQuestionsCount,
  deduplicateQuestions,
} from "../src/utils/questionsStorage";
import { getAdminDashboardMetrics } from "../src/utils/userManagementStorage";
import { checkSupabaseHealth } from "../src/utils/supabaseSyncService";
import { getSupabaseTableCounts } from "../src/utils/supabaseSyncService";

function makeStore(): UserQuestionsStore {
  return {
    customSubjects: [],
    customChapters: [],
    customTopics: [],
    customQuestions: [],
    cloudCacheQuestions: [],
    editedSubjects: {},
    editedChapters: {},
    editedTopics: {},
    editedQuestions: {},
    deletedSubjectIds: [],
    deletedChapterIds: [],
    deletedTopicIds: [],
    deletedQuestionIds: [],
  };
}

function seedAdminStore(store: UserQuestionsStore): UserQuestionsStore {
  const subject = {
    id: "sub_admin_audit",
    name: "Admin Audit Subject",
    hindiName: "प्रशासन ऑडिट विषय",
    description: "admin audit",
    icon: "book",
    color: "#123456",
    order: 1,
    isUserAdded: true,
  } as any;
  const chapter = {
    id: "ch_admin_audit",
    subjectId: "sub_admin_audit",
    title: "Admin Audit Chapter",
    hindiTitle: "प्रशासन ऑडिट अध्याय",
    number: 1,
    isUserAdded: true,
    topics: [],
  } as any;
  const topic = {
    id: "top_admin_audit",
    subjectId: "sub_admin_audit",
    chapterId: "ch_admin_audit",
    title: "Admin Audit Topic",
    hindiTitle: "प्रशासन ऑडिट टॉपिक",
    number: 1,
    isUserAdded: true,
    questions: [],
  } as any;
  const q = {
    id: "q_admin_audit_001",
    subjectId: "sub_admin_audit",
    chapterId: "ch_admin_audit",
    topicId: "top_admin_audit",
    text: "प्रशासनिक ऑडिट प्रश्न",
    question: "प्रशासनिक ऑडिट प्रश्न",
    options: ["a", "b", "c", "d"],
    correctIndex: 1,
    explanation: "exp",
    exam: "RAS",
    year: "2024",
    difficulty: "medium",
    isUserAdded: true,
  } as any;

  let s = addSubject(store, subject);
  s = addChapter(s, chapter);
  s = addTopic(s, topic, chapter.id);
  // attach question to the custom chapter topic
  const ch = s.customChapters?.find((c: any) => c.id === chapter.id);
  if (ch) {
    const t = ch.topics?.find((x: any) => x.id === topic.id);
    if (t) t.questions = [q];
  }
  if (s.customTopics) {
    const t = s.customTopics.find((x: any) => x.id === topic.id);
    if (t) t.questions = [q];
  }
  s.customQuestions = [q];
  return s;
}

describe("Admin Panel — Core Features & Functions", () => {
  beforeEach(() => {
    localStorage.clear();
    clearUserProfile();
  });

  describe("1. Admin Access Control", () => {
    it("ADM-ACL-01 whitelisted admin email grants admin (case/space insensitive)", () => {
      expect(isUserAdmin(ADMIN_EMAILS[0].toUpperCase())).toBe(true);
      expect(isUserAdmin(`  ${ADMIN_EMAILS[1]}  `)).toBe(true);
    });

    it("ADM-ACL-02 non-admin email is rejected", () => {
      expect(isUserAdmin("student@example.com")).toBe(false);
      expect(isUserAdmin("notadmin@gmail.com")).toBe(false);
    });

    it("ADM-ACL-03 DB role cannot elevate a non-whitelisted profile", () => {
      const fake = { id: "u1", name: "Fake", email: "fake@example.com", role: "admin" } as any;
      expect(isUserAdmin(fake)).toBe(false);
    });

    it("ADM-ACL-04 saveUserProfile normalizes role based on whitelist", () => {
      saveUserProfile({ id: "u1", name: "A", email: ADMIN_EMAILS[0], role: "student" } as any);
      expect(loadUserProfile()?.role).toBe("admin");

      saveUserProfile({ id: "u2", name: "B", email: "student@example.com", role: "admin" } as any);
      expect(loadUserProfile()?.role).toBe("student");
    });

    it("ADM-ACL-05 clearUserProfile removes admin session", () => {
      saveUserProfile({ id: "u1", name: "A", email: ADMIN_EMAILS[0], role: "student" } as any);
      expect(isUserAdmin()).toBe(true);
      clearUserProfile();
      expect(isUserAdmin()).toBe(false);
    });
  });

  describe("2. Dashboard Metrics & Curriculum Counts", () => {
    it("ADM-DASH-01 reconciled counts reflect seeded custom syllabus", () => {
      const store = seedAdminStore(makeStore());
      const counts = getReconciledCurriculumCounts(store);
      expect(counts.totalSubjects).toBe(1);
      expect(counts.totalChapters).toBe(1);
      expect(counts.totalTopics).toBe(1);
      expect(counts.totalQuestions).toBeGreaterThanOrEqual(1);
    });

    it("ADM-DASH-02 total display count matches reconciled total", () => {
      const store = seedAdminStore(makeStore());
      expect(getTotalDisplayCount(store)).toBe(getReconciledCurriculumCounts(store).totalQuestions);
    });

    it("ADM-DASH-03 subject/chapter/topic question counts are positive", () => {
      const store = seedAdminStore(makeStore());
      expect(getSubjectQuestionsCount("sub_admin_audit", store)).toBeGreaterThanOrEqual(1);
      expect(getChapterDisplayCount("ch_admin_audit", store)).toBeGreaterThanOrEqual(1);
      expect(getTopicQuestionsCount("top_admin_audit", store)).toBeGreaterThanOrEqual(1);
    });

    it("ADM-DASH-04 counts drop after bulk delete of question", () => {
      const store = seedAdminStore(makeStore());
      const before = getReconciledCurriculumCounts(store).totalQuestions;
      const after = bulkDeleteQuestions(store, ["q_admin_audit_001"]);
      expect(getReconciledCurriculumCounts(after).totalQuestions).toBeLessThan(before);
    });

    it("ADM-DASH-05 getAdminDashboardMetrics returns banner counts (no network)", async () => {
      const m = await getAdminDashboardMetrics();
      expect(typeof m.totalRegisteredUsers).toBe("number");
      expect(typeof m.totalBanners).toBe("number");
      expect(m.totalBanners).toBeGreaterThanOrEqual(0);
    });
  });

  describe("3. Syllabus CRUD", () => {
    it("ADM-SYL-01 addSubject persists subject and survives getCombinedSubjects", () => {
      const store = addSubject(makeStore(), {
        id: "sub_admin_audit2",
        name: "S2",
        hindiName: "एस2",
        icon: "book",
        color: "#000",
        order: 2,
        isUserAdded: true,
      } as any);
      const subjects = getCombinedSubjects(store);
      expect(subjects.some((s: any) => s.id === "sub_admin_audit2")).toBe(true);
    });

    it("ADM-SYL-02 editSubject trims and harmonizes names", () => {
      const store = addSubject(makeStore(), { id: "sub_edit", name: "  Old  ", hindiName: "  पुराना  ", isUserAdded: true } as any);
      const updated = editSubject(store, { id: "sub_edit", name: "  New  ", hindiName: "" } as any);
      const s = getCombinedSubjects(updated).find((x: any) => x.id === "sub_edit") as any;
      expect(s.name).toBe("New");
      expect(s.hindiName).toBe("New");
    });

    it("ADM-SYL-03 deleteSubject removes subject and cascades chapters/topics", () => {
      const store = seedAdminStore(makeStore());
      const after = deleteSubject(store, "sub_admin_audit");
      expect(getCombinedSubjects(after).some((s: any) => s.id === "sub_admin_audit")).toBe(false);
      expect(getCombinedChapters(after).some((c: any) => c.id === "ch_admin_audit")).toBe(false);
    });

    it("ADM-SYL-04 addChapter + editChapter", () => {
      let store = addSubject(makeStore(), { id: "sub_c", name: "S", isUserAdded: true } as any);
      store = addChapter(store, { id: "ch_c", subjectId: "sub_c", title: "Old Chapter", isUserAdded: true } as any);
      expect(getCombinedChapters(store).some((c: any) => c.id === "ch_c")).toBe(true);
      const edited = editChapter(store, { id: "ch_c", title: "  New Chapter  " } as any);
      const ch = getCombinedChapters(edited).find((x: any) => x.id === "ch_c") as any;
      expect(ch.title).toBe("New Chapter");
    });

    it("ADM-SYL-05 deleteChapter removes chapter and its topics", () => {
      const store = seedAdminStore(makeStore());
      const after = deleteChapter(store, "ch_admin_audit");
      expect(getCombinedChapters(after).some((c: any) => c.id === "ch_admin_audit")).toBe(false);
    });

    it("ADM-SYL-06 addTopic resolves parent and editTopic harmonizes", () => {
      const store = seedAdminStore(makeStore());
      const newTopic = { id: "top_new", title: "  New Topic  ", hindiTitle: "", isUserAdded: true } as any;
      const added = addTopic(store, newTopic, "ch_admin_audit");
      expect(getCombinedChapters(added).some((c: any) => (c.topics || []).some((t: any) => t.id === "top_new"))).toBe(true);

      const edited = editTopic(added, { id: "top_new", title: "Updated Topic", hindiTitle: "" } as any);
      const ch = getCombinedChapters(edited).find((c: any) => c.id === "ch_admin_audit") as any;
      const t = ch.topics.find((x: any) => x.id === "top_new");
      expect(t.title).toBe("Updated Topic");
    });

    it("ADM-SYL-07 deleteTopic removes topic", () => {
      const store = seedAdminStore(makeStore());
      const after = deleteTopic(store, "top_admin_audit");
      const ch = getCombinedChapters(after).find((c: any) => c.id === "ch_admin_audit") as any;
      expect((ch?.topics || []).some((t: any) => t.id === "top_admin_audit")).toBe(false);
    });

    it("ADM-SYL-08 re-adding a deleted subject clears its tombstone", () => {
      const store = seedAdminStore(makeStore());
      const deleted = deleteSubject(store, "sub_admin_audit");
      expect((deleted.deletedSubjectIds || []).includes("sub_admin_audit")).toBe(true);
      const readded = addSubject(deleted, { id: "sub_admin_audit", name: "Back", isUserAdded: true } as any);
      expect((readded.deletedSubjectIds || []).includes("sub_admin_audit")).toBe(false);
    });
  });

  describe("4. Question Bank", () => {
    it("ADM-QB-01 bulkDeleteQuestions removes questions and records tombstones", () => {
      const store = seedAdminStore(makeStore());
      const after = bulkDeleteQuestions(store, ["q_admin_audit_001"]);
      expect((after.deletedQuestionIds || []).includes("q_admin_audit_001")).toBe(true);
      expect(getCombinedQuestions(getCombinedChapters(after), after).some((q: any) => q.id === "q_admin_audit_001")).toBe(false);
    });

    it("ADM-QB-02 bulkMoveQuestions updates chapter/topic/subject", () => {
      const store = seedAdminStore(makeStore());
      // create destination chapter+topic
      let s = addChapter(store, { id: "ch_dest", subjectId: "sub_admin_audit", title: "Dest", isUserAdded: true } as any);
      s = addTopic(s, { id: "top_dest", title: "Dest Topic", isUserAdded: true } as any, "ch_dest");
      const combined = getCombinedQuestions(getCombinedChapters(s), s);
      const map: Record<string, any> = {};
      combined.forEach((q: any) => { map[q.id] = q; });
      const after = bulkMoveQuestions(s, ["q_admin_audit_001"], "ch_dest", "top_dest", map, "sub_admin_audit");
      const moved = getCombinedQuestions(getCombinedChapters(after), after).find((q: any) => q.id === "q_admin_audit_001") as any;
      expect(moved?.chapterId).toBe("ch_dest");
      expect(moved?.topicId).toBe("top_dest");
    });

    it("ADM-QB-03 editQuestionInStore updates text and records editedQuestions", () => {
      const store = seedAdminStore(makeStore());
      const q = getCombinedQuestions(getCombinedChapters(store), store).find((x: any) => x.id === "q_admin_audit_001") as any;
      const updated = { ...q, text: "प्रश्न अपडेट", question: "प्रश्न अपडेट" };
      const after = editQuestionInStore(store, updated);
      expect(after.editedQuestions?.["q_admin_audit_001"]).toBeDefined();
      const found = getCombinedQuestions(getCombinedChapters(after), after).find((x: any) => x.id === "q_admin_audit_001") as any;
      expect(found?.text || found?.question).toBe("प्रश्न अपडेट");
    });

    it("ADM-QB-04 deduplicateQuestions removes duplicate IDs", () => {
      const q = { id: "q_dup", text: "x" } as any;
      expect(deduplicateQuestions([q, { ...q }, { id: "q_other", text: "y" } as any])).toHaveLength(2);
    });

    it("ADM-QB-05 normalizeQuestionText normalizes for dedupe scan", async () => {
      const { normalizeQuestionText } = await import("../src/utils/scanMcqDuplicates");
      expect(normalizeQuestionText("<b>Hello!</b>  WORLD")).toBe("hello world");
      expect(normalizeQuestionText("राजस्थान, का इतिहास")).toBe("राजस्थान का इतिहास");
    });

    it("ADM-QB-06 scanMcqCollectionDuplicates runs on empty DB without throwing", async () => {
      const { scanMcqCollectionDuplicates } = await import("../src/utils/scanMcqDuplicates");
      const res = await scanMcqCollectionDuplicates("questions", 10);
      expect(res).toBeDefined();
      expect(typeof res.totalScanned).toBe("number");
      expect(Array.isArray(res.duplicateGroups)).toBe(true);
    });
  });

  describe("5. Exams & Tests (PYQ + Live + Categories)", () => {
    it("ADM-EXAM-01 savePYQPaper creates and fetchPYQPapers lists it", async () => {
      const { savePYQPaper, fetchPYQPapers, deletePYQPaper, getDeletedPYQIds } = await import("../src/utils/pyqStorage");
      const paper = { id: "pyq_admin_audit", title: "Audit PYQ", isPublished: true } as any;
      await savePYQPaper(paper);
      const list = await fetchPYQPapers();
      expect(list.some((p: any) => p.id === "pyq_admin_audit")).toBe(true);
      await deletePYQPaper("pyq_admin_audit");
      expect((await fetchPYQPapers()).some((p: any) => p.id === "pyq_admin_audit")).toBe(false);
      expect(getDeletedPYQIds()).toContain("pyq_admin_audit");
    });

    it("ADM-EXAM-02 clearDeletedPYQIds restores tombstone state", async () => {
      const { addDeletedPYQId, getDeletedPYQIds, clearDeletedPYQIds } = await import("../src/utils/pyqStorage");
      addDeletedPYQId("pyq_tomb");
      expect(getDeletedPYQIds()).toContain("pyq_tomb");
      clearDeletedPYQIds();
      expect(getDeletedPYQIds()).not.toContain("pyq_tomb");
    });

    it("ADM-EXAM-03 saveLiveTest dedupes questions and counts", async () => {
      const { saveLiveTest, loadLocalLiveTests, deleteLiveTest, getDeletedLiveTestIds, clearDeletedLiveTestIds } = await import("../src/utils/liveTestStorage");
      const q = { id: "q_live_1", text: "Q1", options: ["a", "b"], correctIndex: 0 } as any;
      const tests = await saveLiveTest({ id: "lt_admin_audit", title: "Audit Live Test", questions: [q, { ...q }] } as any);
      const saved = tests.find((t: any) => t.id === "lt_admin_audit") as any;
      expect(saved.questionCount).toBe(1);
      expect(loadLocalLiveTests().some((t: any) => t.id === "lt_admin_audit")).toBe(true);

      await deleteLiveTest("lt_admin_audit");
      expect(loadLocalLiveTests().some((t: any) => t.id === "lt_admin_audit")).toBe(false);
      expect(getDeletedLiveTestIds()).toContain("lt_admin_audit");
      clearDeletedLiveTestIds();
    });

    it("ADM-EXAM-04 sanitizeLiveTestForPublic strips answer fields", async () => {
      const { sanitizeLiveTestForPublic } = await import("../src/utils/liveTestStorage");
      const t = { id: "lt", title: "T", questions: [{ id: "q", text: "Q", options: ["a"], correctIndex: 2, explanation: "secret", importantFact: "fact" }] } as any;
      const safe = sanitizeLiveTestForPublic(t);
      const q = safe.questions[0];
      expect(q.correctIndex).toBeUndefined();
      expect(q.explanation).toBeUndefined();
      expect(q.importantFact).toBeUndefined();
      expect(q.text).toBe("Q");
    });

    it("ADM-EXAM-05 exam categories CRUD + ordering", async () => {
      const { saveExamCategory, fetchExamCategories, deleteExamCategory } = await import("../src/utils/categoryStorage");
      await saveExamCategory({ id: "cat_audit", name: "Audit Cat", order: 5 } as any);
      await saveExamCategory({ id: "cat_audit2", name: "Audit Cat2", order: 1 } as any);
      const cats = await fetchExamCategories();
      expect(cats[0].id).toBe("cat_audit2");
      await deleteExamCategory("cat_audit");
      await deleteExamCategory("cat_audit2");
      const after = await fetchExamCategories();
      expect(after.some((c: any) => c.id === "cat_audit")).toBe(false);
    });

    it("ADM-EXAM-06 hydrateLiveTestForAdmin hides answers for non-admin", async () => {
      const { hydrateLiveTestForAdmin } = await import("../src/utils/liveTestStorage");
      clearUserProfile();
      const t = { id: "lt", title: "T", questions: [{ id: "q", text: "Q", options: ["a"], correctIndex: 1, explanation: "e" }] } as any;
      const res = await hydrateLiveTestForAdmin(t);
      expect(res.questions[0].correctIndex).toBeUndefined();
    });
  });

  describe("6. Users & Audit", () => {
    it("ADM-USR-01 registerUserToDirectory is a no-op for missing id", async () => {
      const { registerUserToDirectory } = await import("../src/utils/userManagementStorage");
      await expect(registerUserToDirectory({} as any)).resolves.toBeUndefined();
    });

    it("ADM-USR-02 logAdminAction prepends audit entry locally", async () => {
      saveUserProfile({ id: "admin1", name: "Admin", email: ADMIN_EMAILS[0], role: "student" } as any);
      const { logAdminAction, getLocalAuditLogs } = await import("../src/utils/userManagementStorage");
      const entry = await logAdminAction("update_role", { id: "u2", name: "User", email: "u2@x.com" } as any, "test");
      expect(entry.adminEmail).toBe(ADMIN_EMAILS[0]);
      expect(getLocalAuditLogs()[0].id).toBe(entry.id);
    });

    it("ADM-USR-03 updateUserAccountStatus blocks self-action", async () => {
      saveUserProfile({ id: "admin1", name: "Admin", email: ADMIN_EMAILS[0], role: "student" } as any);
      const { updateUserAccountStatus } = await import("../src/utils/userManagementStorage");
      await expect(updateUserAccountStatus("admin1", "blocked")).rejects.toThrow(/cannot/i);
    });

    it("ADM-USR-04 updateUserAccountStatus rejects non-admin", async () => {
      saveUserProfile({ id: "stu1", name: "Stu", email: "student@example.com", role: "student" } as any);
      const { updateUserAccountStatus } = await import("../src/utils/userManagementStorage");
      await expect(updateUserAccountStatus("u2", "blocked")).rejects.toThrow(/Unauthorized/i);
    });

    it("ADM-USR-05 updateUserRole rejects non-admin", async () => {
      saveUserProfile({ id: "stu1", name: "Stu", email: "student@example.com", role: "student" } as any);
      const { updateUserRole } = await import("../src/utils/userManagementStorage");
      await expect(updateUserRole("u2", "admin")).rejects.toThrow(/Unauthorized/i);
    });

    it("ADM-USR-06 updateUserRole rejects self-demotion", async () => {
      saveUserProfile({ id: "admin1", name: "Admin", email: ADMIN_EMAILS[0], role: "student" } as any);
      const { updateUserRole } = await import("../src/utils/userManagementStorage");
      await expect(updateUserRole("admin1", "student")).rejects.toThrow(/cannot/i);
    });

    it("ADM-USR-07 findSuspiciousProfiles flags blank/odd profiles", async () => {
      const { setLocalUsersDirectory, findSuspiciousProfiles } = await import("../src/utils/userManagementStorage");
      setLocalUsersDirectory([
        { id: "u1", name: "admin user", email: "", role: "student" } as any,
        { id: "u2", name: "Normal", email: "ok@example.com", role: "student" } as any,
      ]);
      const suspicious = await findSuspiciousProfiles();
      expect(suspicious.some((u: any) => u.id === "u1")).toBe(true);
      expect(suspicious.some((u: any) => u.id === "u2")).toBe(false);
    });

    it("ADM-USR-08 deleteUserAccount removes from local directory", async () => {
      const { setLocalUsersDirectory, deleteUserAccount } = await import("../src/utils/userManagementStorage");
      setLocalUsersDirectory([{ id: "u_del", name: "Del", email: "del@x.com", role: "student" } as any]);
      await deleteUserAccount("u_del");
      const { getLocalUsersDirectory } = await import("../src/utils/userManagementStorage");
      expect(getLocalUsersDirectory().some((u: any) => u.id === "u_del")).toBe(false);
    });

    it("ADM-USR-09 deleteUserAccount refuses self-delete", async () => {
      saveUserProfile({ id: "admin1", name: "Admin", email: ADMIN_EMAILS[0], role: "student" } as any);
      const { deleteUserAccount } = await import("../src/utils/userManagementStorage");
      await expect(deleteUserAccount("admin1")).rejects.toThrow(/cannot/i);
    });
  });

  describe("7. Supabase Health & Counts", () => {
    it("ADM-SUP-01 getSupabaseTableCounts returns 7 numeric fields", async () => {
      const counts = await getSupabaseTableCounts();
      for (const k of ["subjects", "chapters", "topics", "questions", "profiles", "attempts", "bookmarks"]) {
        expect(typeof (counts as any)[k]).toBe("number");
      }
    });

    it("ADM-SUP-02 checkSupabaseHealth returns latency and healthy flag", async () => {
      const h = await checkSupabaseHealth();
      expect(typeof h.healthy).toBe("boolean");
      expect(typeof h.latencyMs).toBe("number");
    });
  });
});
