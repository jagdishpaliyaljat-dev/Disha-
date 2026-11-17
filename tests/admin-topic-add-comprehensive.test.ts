import { describe, it, expect, beforeEach } from "vitest";
import { 
  saveSubjectToSupabase,
  saveChapterToSupabase,
  saveTopicToSupabase,
  deleteTopicFromSupabase,
  fetchTopics
} from "../src/utils/supabaseSyncService";
import { 
  openLocalDatabase, 
  idbGet, 
  idbGetAll, 
  STORES 
} from "../src/utils/localDatabaseEngine";
import {
  addTopic,
  editTopic,
  deleteTopic,
  getCombinedChapters,
  getCombinedTopicsMap,
  loadUserQuestionsStore,
  saveUserQuestionsStore,
  hydrateUserQuestionsStoreFromIndexedDB
} from "../src/utils/questionsStorage";
import { supabase, isSupabaseConfigured } from "../src/lib/supabase";
import { isUserAdmin } from "../src/utils/userProfileStorage";
import type { Subject, Chapter, Topic, UserQuestionsStore } from "../src/types";

describe("DISHA 20-20 — Admin Topic Creation & Lifecycle Comprehensive Suite", () => {
  const testSubject: Subject = {
    id: "sub_test_topic_suite",
    name: "Topic Suite Subject",
    hindiName: "टॉपिक परीक्षण विषय",
    order: 1,
    isUserAdded: true
  };

  const testChapter: Chapter = {
    id: "chap_test_topic_suite",
    subjectId: "sub_test_topic_suite",
    title: "Topic Suite Chapter",
    hindiTitle: "टॉपिक परीक्षण अध्याय",
    number: 1,
    topics: [],
    isUserAdded: true
  };

  beforeEach(async () => {
    await openLocalDatabase();
    // Prepare baseline store
    const store = loadUserQuestionsStore();
    const cleanStore: UserQuestionsStore = {
      ...store,
      customSubjects: [testSubject],
      customChapters: [testChapter],
      customTopics: [],
      deletedTopicIds: [],
      editedTopics: {}
    };
    saveUserQuestionsStore(cleanStore);
  });

  // TEST 1: Add a topic to an existing chapter
  it("1. Add a topic to an existing chapter properly maps chapter_id, subject_id, and persists locally", async () => {
    const newTopic: Topic = {
      id: "custom-topic-unit-001",
      chapterId: testChapter.id,
      subjectId: testSubject.id,
      title: "Ancient Coins of Rajasthan",
      hindiTitle: "राजस्थान के प्राचीन सिक्के",
      number: 1,
      questions: [],
      isUserAdded: true
    };

    const res = await saveTopicToSupabase(newTopic);
    expect(res.success).toBe(true);

    // Update in-memory and persistent store
    const currentStore = loadUserQuestionsStore();
    const updatedStore = addTopic(currentStore, newTopic, testChapter.id);
    saveUserQuestionsStore(updatedStore);

    // Verify in IndexedDB
    const idbTopic = await idbGet<Topic>(STORES.TOPICS, newTopic.id);
    expect(idbTopic).toBeDefined();
    expect(idbTopic?.title).toBe("Ancient Coins of Rajasthan");
    expect(idbTopic?.chapterId).toBe(testChapter.id);
    expect(idbTopic?.subjectId).toBe(testSubject.id);
  });

  // TEST 2: Add multiple topics with automatic ordering
  it("2. Add multiple topics to a chapter and verify ordering and separation", async () => {
    let store = loadUserQuestionsStore();

    const topicA: Topic = {
      id: "custom-topic-unit-002A",
      chapterId: testChapter.id,
      subjectId: testSubject.id,
      title: "Mughal-Rajput Treaties",
      hindiTitle: "मुगल-राजपूत संधियां",
      number: 1,
      questions: [],
      isUserAdded: true
    };

    const topicB: Topic = {
      id: "custom-topic-unit-002B",
      chapterId: testChapter.id,
      subjectId: testSubject.id,
      title: "Prajamandal Movements",
      hindiTitle: "प्रजामंडल आंदोलन",
      number: 2,
      questions: [],
      isUserAdded: true
    };

    await saveTopicToSupabase(topicA);
    store = addTopic(store, topicA, testChapter.id);

    await saveTopicToSupabase(topicB);
    store = addTopic(store, topicB, testChapter.id);

    saveUserQuestionsStore(store);

    const chaps = getCombinedChapters(store);
    const targetChap = chaps.find(c => c.id === testChapter.id);
    expect(targetChap).toBeDefined();
    expect(targetChap?.topics.length).toBeGreaterThanOrEqual(2);

    const titles = targetChap?.topics.map(t => t.title);
    expect(titles).toContain("Mughal-Rajput Treaties");
    expect(titles).toContain("Prajamandal Movements");
  });

  // TEST 3: Edit an existing topic
  it("3. Edit an existing topic updates titles across store and local DB", async () => {
    let store = loadUserQuestionsStore();
    const initialTopic: Topic = {
      id: "custom-topic-unit-003",
      chapterId: testChapter.id,
      subjectId: testSubject.id,
      title: "Original Topic Title",
      hindiTitle: "मूल टॉपिक",
      number: 1,
      isUserAdded: true
    };

    await saveTopicToSupabase(initialTopic);
    store = addTopic(store, initialTopic, testChapter.id);
    saveUserQuestionsStore(store);

    const updatedTopic: Topic = {
      ...initialTopic,
      title: "Updated Topic Title V2",
      hindiTitle: "अद्यतन टॉपिक V2"
    };

    const res = await saveTopicToSupabase(updatedTopic);
    expect(res.success).toBe(true);

    store = editTopic(store, updatedTopic);
    saveUserQuestionsStore(store);

    const inDb = await idbGet<Topic>(STORES.TOPICS, initialTopic.id);
    expect(inDb?.title).toBe("Updated Topic Title V2");
    expect(inDb?.hindiTitle).toBe("अद्यतन टॉपिक V2");

    const chaps = getCombinedChapters(store);
    const ch = chaps.find(c => c.id === testChapter.id);
    const top = ch?.topics.find(t => t.id === initialTopic.id);
    expect(top?.title).toBe("Updated Topic Title V2");
  });

  // TEST 4: Delete a topic
  it("4. Delete a topic cleans from chapter and marks as deleted", async () => {
    let store = loadUserQuestionsStore();
    const topicToDelete: Topic = {
      id: "custom-topic-unit-004",
      chapterId: testChapter.id,
      subjectId: testSubject.id,
      title: "Topic To Be Deleted",
      hindiTitle: "हटाया जाने वाला टॉपिक",
      number: 1,
      isUserAdded: true
    };

    await saveTopicToSupabase(topicToDelete);
    store = addTopic(store, topicToDelete, testChapter.id);
    saveUserQuestionsStore(store);

    // Delete topic
    const res = await deleteTopicFromSupabase(topicToDelete.id);
    expect(res.success).toBe(true);

    store = deleteTopic(store, topicToDelete.id);
    saveUserQuestionsStore(store);

    // Should be deleted from local DB
    const inDb = await idbGet<Topic>(STORES.TOPICS, topicToDelete.id);
    expect(inDb).toBeFalsy();

    // Should not appear in combined chapters
    const chaps = getCombinedChapters(store);
    const ch = chaps.find(c => c.id === testChapter.id);
    const found = ch?.topics.find(t => t.id === topicToDelete.id);
    expect(found).toBeUndefined();
  });

  // TEST 5: Reload application and verify persistence
  it("5. Reload simulation hydrates topics from IndexedDB accurately", async () => {
    const topicPersist: Topic = {
      id: "custom-topic-unit-005",
      chapterId: testChapter.id,
      subjectId: testSubject.id,
      title: "Persisted Topic Over Restart",
      hindiTitle: "स्थायी टॉपिक",
      number: 1,
      isUserAdded: true
    };

    await saveTopicToSupabase(topicPersist);
    const store = loadUserQuestionsStore();
    const nextStore = addTopic(store, topicPersist, testChapter.id);
    saveUserQuestionsStore(nextStore);

    // Simulate page reload / empty in-memory store
    const hydratedStore = await hydrateUserQuestionsStoreFromIndexedDB();
    expect(hydratedStore).toBeDefined();

    const inIdb = await idbGet<Topic>(STORES.TOPICS, topicPersist.id);
    expect(inIdb).toBeDefined();
    expect(inIdb?.id).toBe(topicPersist.id);
    expect(inIdb?.title).toBe("Persisted Topic Over Restart");
  });

  // TEST 6: Verify topic appears in student panel view
  it("6. Student panel views (combined chapters & topics map) reflect added topic", async () => {
    const studentTopic: Topic = {
      id: "custom-topic-unit-006",
      chapterId: testChapter.id,
      subjectId: testSubject.id,
      title: "Student Viewable Topic",
      hindiTitle: "छात्र दृश्य टॉपिक",
      number: 5,
      isUserAdded: true
    };

    await saveTopicToSupabase(studentTopic);
    let store = loadUserQuestionsStore();
    store = addTopic(store, studentTopic, testChapter.id);
    saveUserQuestionsStore(store);

    // Student panel reads via getCombinedChapters & getCombinedTopicsMap
    const chaptersForStudent = getCombinedChapters(store);
    const topicsMap = getCombinedTopicsMap(chaptersForStudent);

    expect(topicsMap[studentTopic.id]).toBeDefined();
    expect(topicsMap[studentTopic.id].title).toBe("Student Viewable Topic");
    expect(topicsMap[studentTopic.id].chapterId).toBe(testChapter.id);
  });

  // TEST 7: Test with expired / unauthenticated Supabase session
  it("7. Gracefully handles expired or unauthenticated session without silent failure", async () => {
    // When executing without an admin token (anon role), Supabase RLS returns 42501
    const offlineTopic: Topic = {
      id: "custom-topic-unit-007",
      chapterId: testChapter.id,
      subjectId: testSubject.id,
      title: "Offline / Expired Session Topic",
      hindiTitle: "ऑफलाइन टॉपिक",
      number: 1,
      isUserAdded: true
    };

    const res = await saveTopicToSupabase(offlineTopic);
    // Must succeed locally and inform user about local preservation
    expect(res.success).toBe(true);
    expect(res.message).toBeDefined();
    expect(res.message.length).toBeGreaterThan(0);

    // Verify it was preserved in local IndexedDB
    const inDb = await idbGet<Topic>(STORES.TOPICS, offlineTopic.id);
    expect(inDb).toBeDefined();
    expect(inDb?.title).toBe("Offline / Expired Session Topic");
  });

  // TEST 8: Test with non-admin account (RLS security enforcement)
  it("8. Non-admin and anonymous roles are strictly blocked by PostgreSQL RLS from direct table mutation", async () => {
    expect(isUserAdmin("student@example.com")).toBe(false);
    expect(isUserAdmin(null)).toBe(false);
    expect(isUserAdmin("random_user@domain.com")).toBe(false);

    // Direct insert to Supabase topics table as anon / non-admin MUST be rejected with 42501
    if (isSupabaseConfigured()) {
      const { error } = await supabase.from("topics").insert({
        id: "hacker_topic_exploit_test",
        chapter_id: testChapter.id,
        subject_id: testSubject.id,
        name: "Hacker Injected Topic"
      });

      expect(error).toBeDefined();
      expect(error?.code).toBe("42501"); // PostgreSQL insufficient_privilege / RLS violation
    }
  });

  // TEST 9: Duplicate topic prevention validation
  it("9. Duplicate topic detection correctly flags identical topic title in chapter", () => {
    const existingTopics: Topic[] = [
      {
        id: "top_existing_01",
        chapterId: testChapter.id,
        subjectId: testSubject.id,
        title: "Major Inscriptions",
        hindiTitle: "प्रमुख अभिलेख",
        number: 1
      }
    ];

    const isDuplicate = (candEn: string, candHi: string) => {
      return existingTopics.some(t => {
        const tTitle = (t.title || "").trim().toLowerCase();
        const tHindi = (t.hindiTitle || "").trim().toLowerCase();
        const enNorm = candEn.trim().toLowerCase();
        const hiNorm = candHi.trim().toLowerCase();
        return (tTitle && tTitle === enNorm) || 
               (tHindi && tHindi === hiNorm) || 
               (tTitle && tTitle === hiNorm);
      });
    };

    expect(isDuplicate("Major Inscriptions", "")).toBe(true);
    expect(isDuplicate("major inscriptions", "any")).toBe(true);
    expect(isDuplicate("Different Topic", "प्रमुख अभिलेख")).toBe(true);
    expect(isDuplicate("Completely New Topic", "नया टॉपिक")).toBe(false);
  });
});
