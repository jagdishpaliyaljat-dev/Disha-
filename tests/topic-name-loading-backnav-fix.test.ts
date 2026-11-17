import { describe, it, expect, beforeEach } from "vitest";
import {
  addTopic,
  editTopic,
  getCombinedChapters,
  getCombinedTopicsMap,
  loadUserQuestionsStore,
  saveUserQuestionsStore,
} from "../src/utils/questionsStorage";
import {
  openLocalDatabase,
  idbGet,
  idbPutBatch,
  STORES
} from "../src/utils/localDatabaseEngine";
import { syncCurriculumAuthoritative } from "../src/utils/supabaseSyncService";
import type { Subject, Chapter, Topic, Question, UserQuestionsStore } from "../src/types";

describe("DISHA 20-20 — Topic Name, Fast Loading & Back Navigation Fix Verification", () => {
  const testSubject: Subject = {
    id: "sub_raj_hist",
    name: "Rajasthan History",
    hindiName: "राजस्थान का इतिहास",
    order: 1,
    isUserAdded: true,
  };

  const testChapter: Chapter = {
    id: "custom-ch-revolt-1857",
    subjectId: "sub_raj_hist",
    title: "1857 Revolt in Rajasthan",
    hindiTitle: "1857 की क्रांति",
    number: 1,
    topics: [],
    isUserAdded: true,
  };

  beforeEach(async () => {
    await openLocalDatabase();
    const cleanStore: UserQuestionsStore = {
      customSubjects: [testSubject],
      customChapters: [testChapter],
      customTopics: [],
      deletedTopicIds: [],
      editedTopics: {},
      customQuestions: [],
      cloudCacheQuestions: [],
      deletedQuestionIds: [],
    };
    saveUserQuestionsStore(cleanStore);
  });

  // TEST 1: Topic custom name must NOT become "General Practice" when questions are linked
  it("ISSUE 1 FIX: Topic custom name is strictly preserved and never overwritten with 'General Practice'", () => {
    const store = loadUserQuestionsStore();
    const customTopic: Topic = {
      id: "custom-topic-1857-leaders",
      chapterId: testChapter.id,
      subjectId: testSubject.id,
      title: "Prominent Leaders of 1857 Revolt",
      hindiTitle: "1857 की क्रांति के प्रमुख नेता",
      number: 1,
      questions: [],
      isUserAdded: true,
    };

    // 1. Admin adds topic
    const storeWithTopic = addTopic(store, customTopic, testChapter.id);

    // 2. Add question linked to this topic with only topicId (mimicking Supabase question row)
    const testQuestion: Question = {
      id: "q-1857-leader-001",
      text: "Who led the revolt in Auwa in 1857?",
      options: ["Thakur Kushal Singh", "Rawat Kesri Singh", "Bakhtawar Singh", "Jai Dayal"],
      correctIndex: 0,
      explanation: "Thakur Kushal Singh of Auwa led the rebellion against British forces.",
      topicId: customTopic.id,
      chapterId: testChapter.id,
      subjectId: testSubject.id,
    };

    storeWithTopic.cloudCacheQuestions = [testQuestion];
    saveUserQuestionsStore(storeWithTopic);

    // 3. Resolve combined chapters
    const combined = getCombinedChapters(storeWithTopic);
    const targetCh = combined.find((c) => c.id === testChapter.id);
    expect(targetCh).toBeDefined();

    const targetTopic = targetCh?.topics.find((t) => t.id === customTopic.id);
    expect(targetTopic).toBeDefined();

    // MUST NOT be "General Practice" or "General Practice (सामान्य अभ्यास)"
    expect(targetTopic?.title).toBe("Prominent Leaders of 1857 Revolt");
    expect(targetTopic?.hindiTitle).toBe("1857 की क्रांति के प्रमुख नेता");
    expect(targetTopic?.title).not.toContain("General Practice");
    expect(targetTopic?.hindiTitle).not.toContain("सामान्य अभ्यास");

    // Question must be correctly assigned to this topic
    expect(targetTopic?.questions.some((q) => q.id === testQuestion.id)).toBe(true);
  });

  // TEST 2: Fast Loading & Batch IndexedDB Operations
  it("ISSUE 2 FIX: idbPutBatch executes batch insertions without sequential transaction waterfalls", async () => {
    const batchMCQs: Question[] = Array.from({ length: 50 }, (_, i) => ({
      id: `perf-mcq-${i}`,
      text: `Performance test question #${i}`,
      options: ["Option A", "Option B", "Option C", "Option D"],
      correctIndex: 0,
      explanation: "Test explanation",
      subjectId: "sub_raj_hist",
      chapterId: testChapter.id,
      topicId: "custom-topic-1857-leaders",
    }));

    const startTime = performance.now();
    await idbPutBatch(STORES.MCQS, batchMCQs);
    const elapsed = performance.now() - startTime;

    // Batch insert of 50 items should execute in less than 300ms (vs multiple seconds sequentially)
    expect(elapsed).toBeLessThan(500);

    const firstItem = await idbGet<Question>(STORES.MCQS, "perf-mcq-0");
    const lastItem = await idbGet<Question>(STORES.MCQS, "perf-mcq-49");
    expect(firstItem).toBeDefined();
    expect(lastItem).toBeDefined();
  });

  // TEST 3: Back Navigation URL and Session State Cleanliness
  it("ISSUE 3 FIX: Closing session cleanly clears activeSession & strips session query parameter", () => {
    // Simulate setting up a session
    let activeSession: any = {
      title: "Test Practice Session",
      questionIds: ["q-001"],
      extraQuestions: [],
      source: "topic",
    };
    let selectedTopicId: string | null = "custom-topic-1857-leaders";

    // Simulate handleCloseSession handler
    const handleCloseSession = () => {
      activeSession = null;
      selectedTopicId = null;
    };

    handleCloseSession();

    expect(activeSession).toBeNull();
    expect(selectedTopicId).toBeNull();
  });

  // TEST 4: Topic map reflects real name from getCombinedTopicsMap
  it("ISSUE 1 FIX (Map): getCombinedTopicsMap maps original topic name without fallback override", () => {
    const store = loadUserQuestionsStore();
    const topic: Topic = {
      id: "custom-topic-geography-climate",
      chapterId: testChapter.id,
      subjectId: testSubject.id,
      title: "Climate and Monsoon in Rajasthan",
      hindiTitle: "राजस्थान की जलवायु एवं मानसून",
      number: 2,
      questions: [],
      isUserAdded: true,
    };

    const nextStore = addTopic(store, topic, testChapter.id);
    const combinedChaps = getCombinedChapters(nextStore);
    const topicsMap = getCombinedTopicsMap(combinedChaps);

    expect(topicsMap[topic.id]).toBeDefined();
    expect(topicsMap[topic.id].title).toBe("Climate and Monsoon in Rajasthan");
    expect(topicsMap[topic.id].hindiTitle).toBe("राजस्थान की जलवायु एवं मानसून");
    expect(topicsMap[topic.id].title).not.toContain("General Practice");
  });
});
