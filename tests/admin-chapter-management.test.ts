import { describe, it, expect, beforeEach } from "vitest";
import {
  saveChapterToSupabase,
  deleteChapterFromSupabase
} from "../src/utils/supabaseSyncService";
import {
  addChapter,
  editChapter,
  deleteChapter,
  getCombinedChapters
} from "../src/utils/questionsStorage";
import { openLocalDatabase, idbGet, STORES } from "../src/utils/localDatabaseEngine";
import type { Chapter, Topic, Question, UserQuestionsStore } from "../src/types";

describe("DISHA 2020 — Admin Chapter Management CRUD & Verification Suite", () => {
  let mockStore: UserQuestionsStore;

  beforeEach(async () => {
    await openLocalDatabase();
    mockStore = {
      customQuestions: [],
      editedQuestions: {},
      bookmarkedQuestionIds: [],
      wrongQuestionIds: [],
      customChapters: [
        {
          id: "ch_raj_hist_01",
          subjectId: "sub_raj_hist",
          number: 1,
          title: "Sources of Rajasthan History",
          hindiTitle: "राजस्थान के इतिहास के स्रोत",
          topics: [],
          isUserAdded: false
        }
      ],
      customTopics: [],
      customSubjects: [
        {
          id: "sub_raj_hist",
          name: "Rajasthan History",
          hindiName: "राजस्थान का इतिहास",
          order: 1
        }
      ]
    };
  });

  describe("1. Chapter Creation & Normalization", () => {
    it("1.1 Successfully creates a valid chapter linked to subject and persists to IndexedDB", async () => {
      const chapterId = `custom-ch-${Date.now()}-abc1`;
      const newChapter: Chapter = {
        id: chapterId,
        subjectId: "sub_raj_hist",
        number: 2,
        title: "Major Dynasties of Rajasthan",
        hindiTitle: "राजस्थान के प्रमुख राजवंश",
        topics: [],
        isUserAdded: true
      };

      const res = await saveChapterToSupabase(newChapter);
      expect(res.success).toBe(true);

      const inDb = await idbGet<Chapter>(STORES.CHAPTERS, chapterId);
      expect(inDb).toBeDefined();
      expect(inDb?.id).toBe(chapterId);
      expect(inDb?.subjectId).toBe("sub_raj_hist");
      expect(inDb?.title).toBe("Major Dynasties of Rajasthan");
      expect(inDb?.number).toBe(2);

      // Clean up
      await deleteChapterFromSupabase(chapterId);
    });

    it("1.2 Normalizes English-only title by filling hindiTitle with fallback", () => {
      const storeWithNew = addChapter(mockStore, {
        id: "ch_eng_only",
        subjectId: "sub_raj_hist",
        number: 3,
        title: "Freedom Movement in Rajasthan",
        hindiTitle: "",
        topics: []
      });

      const ch = storeWithNew.customChapters?.find((c) => c.id === "ch_eng_only");
      expect(ch).toBeDefined();
      expect(ch?.title).toBe("Freedom Movement in Rajasthan");
      expect(ch?.hindiTitle).toBe("Freedom Movement in Rajasthan");
      expect(ch?.isUserAdded).toBe(true);
    });

    it("1.3 Normalizes Hindi-only title by filling title with fallback", () => {
      const storeWithNew = addChapter(mockStore, {
        id: "ch_hi_only",
        subjectId: "sub_raj_hist",
        number: 4,
        title: "",
        hindiTitle: "1857 की क्रान्ति एवं राजस्थान",
        topics: []
      });

      const ch = storeWithNew.customChapters?.find((c) => c.id === "ch_hi_only");
      expect(ch).toBeDefined();
      expect(ch?.title).toBe("1857 की क्रान्ति एवं राजस्थान");
      expect(ch?.hindiTitle).toBe("1857 की क्रान्ति एवं राजस्थान");
    });
  });

  describe("2. Duplicate Chapter Detection & Prevention", () => {
    const existingChapters: Chapter[] = [
      {
        id: "ch_1",
        subjectId: "sub_raj_hist",
        number: 1,
        title: "Ancient Civilizations",
        hindiTitle: "प्राचीन सभ्यताएं",
        topics: []
      },
      {
        id: "ch_2",
        subjectId: "sub_geog",
        number: 1,
        title: "Physical Divisions",
        hindiTitle: "भौतिक प्रदेश",
        topics: []
      }
    ];

    it("2.1 Flags duplicate chapter within same subject by English title", () => {
      const candidateTitle = "  ancient civilizations  ";
      const targetSubj = "sub_raj_hist";

      const isDupe = existingChapters.some(
        (c) =>
          c.subjectId === targetSubj &&
          c.title?.trim().toLowerCase() === candidateTitle.trim().toLowerCase()
      );
      expect(isDupe).toBe(true);
    });

    it("2.2 Flags duplicate chapter within same subject by Hindi title", () => {
      const candidateHindi = "प्राचीन सभ्यताएं";
      const targetSubj = "sub_raj_hist";

      const isDupe = existingChapters.some(
        (c) =>
          c.subjectId === targetSubj &&
          c.hindiTitle?.trim().toLowerCase() === candidateHindi.trim().toLowerCase()
      );
      expect(isDupe).toBe(true);
    });

    it("2.3 Allows chapter with same title under a DIFFERENT subject", () => {
      const candidateTitle = "Introduction & Overview";
      const targetSubj = "sub_polity";

      const isDupe = existingChapters.some(
        (c) =>
          c.subjectId === targetSubj &&
          c.title?.trim().toLowerCase() === candidateTitle.trim().toLowerCase()
      );
      expect(isDupe).toBe(false);
    });
  });

  describe("3. QuestionsStore Reducer Operations (addChapter, editChapter, deleteChapter)", () => {
    it("3.1 addChapter preserves store immutability and appends custom chapter", () => {
      const newCh: Chapter = {
        id: "ch_immutability_test",
        subjectId: "sub_raj_hist",
        number: 5,
        title: "Integration of Rajasthan",
        hindiTitle: "राजस्थान का एकीकरण",
        topics: []
      };

      const nextStore = addChapter(mockStore, newCh);
      expect(nextStore.customChapters?.length).toBe(2);
      expect(mockStore.customChapters?.length).toBe(1); // Original untouched
    });

    it("3.2 editChapter updates targeted chapter in customChapters", () => {
      const updatedCh: Chapter = {
        id: "ch_raj_hist_01",
        subjectId: "sub_raj_hist",
        number: 1,
        title: "Archeological & Literary Sources of Rajasthan",
        hindiTitle: "राजस्थान के पुरातात्विक एवं साहित्यिक स्रोत",
        topics: []
      };

      const nextStore = editChapter(mockStore, updatedCh);
      const found = nextStore.customChapters?.find((c) => c.id === "ch_raj_hist_01");
      expect(found?.title).toBe("Archeological & Literary Sources of Rajasthan");
      expect(found?.hindiTitle).toBe("राजस्थान के पुरातात्विक एवं साहित्यिक स्रोत");
    });

    it("3.3 deleteChapter cascades removal of associated child topics and questions", () => {
      const testChId = "ch_to_cascade";
      const populatedStore: UserQuestionsStore = {
        ...mockStore,
        customChapters: [
          ...(mockStore.customChapters || []),
          {
            id: testChId,
            subjectId: "sub_raj_hist",
            number: 10,
            title: "To Be Deleted",
            hindiTitle: "हटाने हेतु",
            topics: []
          }
        ],
        customTopics: [
          {
            id: "top_child_1",
            chapterId: testChId,
            subjectId: "sub_raj_hist",
            number: 1,
            title: "Child Topic 1",
            hindiTitle: "बाल टॉपिक 1"
          }
        ],
        customQuestions: [
          {
            id: "q_child_1",
            subjectId: "sub_raj_hist",
            chapterId: testChId,
            topicId: "top_child_1",
            text: "Question under deleted chapter?",
            options: ["A", "B", "C", "D"],
            correctIndex: 0
          }
        ]
      };

      expect(populatedStore.customChapters?.length).toBe(2);
      expect(populatedStore.customTopics?.length).toBe(1);
      expect(populatedStore.customQuestions?.length).toBe(1);

      const afterDelete = deleteChapter(populatedStore, testChId);

      expect(afterDelete.customChapters?.find((c) => c.id === testChId)).toBeUndefined();
      expect(afterDelete.customTopics?.find((t) => t.chapterId === testChId)).toBeUndefined();
      expect(afterDelete.customQuestions?.find((q) => q.chapterId === testChId)).toBeUndefined();
      expect(afterDelete.deletedChapterIds).toContain(testChId);
    });
  });

  describe("4. Local IndexedDB Persistence & Safe Fallbacks", () => {
    it("4.1 Saves and deletes draft chapter from IndexedDB cleanly", async () => {
      const draftChapter: Chapter = {
        id: `draft-ch-${Date.now()}`,
        subjectId: "sub_raj_hist",
        number: 99,
        title: "Draft Chapter Test",
        hindiTitle: "प्रारूप अध्याय परीक्षण",
        topics: [],
        isUserAdded: true
      };

      const saveRes = await saveChapterToSupabase(draftChapter);
      expect(saveRes.success).toBe(true);

      const inDb = await idbGet<Chapter>(STORES.CHAPTERS, draftChapter.id);
      expect(inDb).toBeDefined();
      expect(inDb?.title).toBe("Draft Chapter Test");

      const delRes = await deleteChapterFromSupabase(draftChapter.id);
      expect(delRes.success).toBe(true);

      const afterDel = await idbGet<Chapter>(STORES.CHAPTERS, draftChapter.id);
      expect(afterDel).toBeNull();
    });

    it("4.2 getCombinedChapters returns chapters with correct subject associations", () => {
      const combined = getCombinedChapters(mockStore);
      expect(Array.isArray(combined)).toBe(true);
      expect(combined.length).toBeGreaterThan(0);
      expect(combined.some((c) => c.subjectId === "sub_raj_hist")).toBe(true);
    });
  });
});
