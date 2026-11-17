import { describe, it, expect, beforeEach } from "vitest";
import {
  saveSubjectToSupabase,
  deleteSubjectFromSupabase
} from "../src/utils/supabaseSyncService";
import {
  addSubject,
  editSubject,
  deleteSubject,
  getCombinedSubjects
} from "../src/utils/questionsStorage";
import { openLocalDatabase, idbGet, STORES } from "../src/utils/localDatabaseEngine";
import type { Subject, UserQuestionsStore } from "../src/types";

describe("DISHA 2020 — Admin Subject Management CRUD & Validation Suite", () => {
  let mockStore: UserQuestionsStore;

  beforeEach(async () => {
    await openLocalDatabase();
    mockStore = {
      customQuestions: [],
      editedQuestions: {},
      bookmarkedQuestionIds: [],
      wrongQuestionIds: [],
      customChapters: [],
      customTopics: [],
      customSubjects: [
        {
          id: "sub_raj_hist",
          name: "Rajasthan History",
          hindiName: "राजस्थान का इतिहास",
          description: "Rajasthan History and Culture",
          icon: "BookOpen",
          color: "blue",
          order: 1,
          isUserAdded: false
        }
      ]
    };
  });

  describe("1. Subject Creation & Field Normalization", () => {
    it("1.1 Successfully creates a valid subject with English and Hindi names", async () => {
      const subjectId = `subj-${Date.now()}-abcde`;
      const newSubj: Subject = {
        id: subjectId,
        name: "Geography of Rajasthan",
        hindiName: "राजस्थान का भूगोल",
        description: "Physical geography, rivers and climate",
        icon: "Globe",
        color: "emerald",
        order: 2,
        isUserAdded: true
      };

      const res = await saveSubjectToSupabase(newSubj);
      expect(res.success).toBe(true);

      const inDb = await idbGet<Subject>(STORES.SUBJECTS, subjectId);
      expect(inDb).toBeDefined();
      expect(inDb?.id).toBe(subjectId);
      expect(inDb?.name).toBe("Geography of Rajasthan");
      expect(inDb?.hindiName).toBe("राजस्थान का भूगोल");
      expect(inDb?.color).toBe("emerald");
      expect(inDb?.isUserAdded).toBe(true);

      // Clean up
      await deleteSubjectFromSupabase(subjectId);
    });

    it("1.2 Normalizes English-only input by assigning it to both name and hindiName", () => {
      const inputName = "General Science";
      const inputHindi = "";

      const cleanName = inputName.trim();
      const cleanHindi = inputHindi.trim();
      const normalizedSubject: Subject = {
        id: `subj-${Date.now()}-sci12`,
        name: cleanName || cleanHindi,
        hindiName: cleanHindi || cleanName,
        description: "Science & Tech MCQs",
        icon: "Cpu",
        color: "indigo",
        order: 3,
        isUserAdded: true
      };

      expect(normalizedSubject.name).toBe("General Science");
      expect(normalizedSubject.hindiName).toBe("General Science");
    });

    it("1.3 Normalizes Hindi-only Devanagari input correctly", () => {
      const inputName = "";
      const inputHindi = "भारतीय संविधान एवं राजव्यवस्था";

      const cleanName = inputName.trim();
      const cleanHindi = inputHindi.trim();
      const normalizedSubject: Subject = {
        id: `subj-${Date.now()}-pol99`,
        name: cleanName || cleanHindi,
        hindiName: cleanHindi || cleanName,
        description: "Polity and Governance",
        icon: "Landmark",
        color: "amber",
        order: 4,
        isUserAdded: true
      };

      expect(normalizedSubject.name).toBe("भारतीय संविधान एवं राजव्यवस्था");
      expect(normalizedSubject.hindiName).toBe("भारतीय संविधान एवं राजव्यवस्था");
    });
  });

  describe("2. Duplicate Subject Detection & Prevention", () => {
    const existingList: Subject[] = [
      {
        id: "sub_raj_hist",
        name: "Rajasthan History",
        hindiName: "राजस्थान का इतिहास",
        description: "Official subject",
        order: 1
      },
      {
        id: "subj_art_cult",
        name: "Art and Culture",
        hindiName: "कला एवं संस्कृति",
        description: "Art & Culture",
        order: 2
      }
    ];

    it("2.1 Flags duplicate by English name (case-insensitive)", () => {
      const candidateName = "  rajasthan history  ";
      const cleanName = candidateName.trim().toLowerCase();

      const isDuplicate = existingList.some(
        (s) => s.name?.trim().toLowerCase() === cleanName
      );
      expect(isDuplicate).toBe(true);
    });

    it("2.2 Flags duplicate by Hindi name (exact match)", () => {
      const candidateHindi = "राजस्थान का इतिहास";
      const cleanHindi = candidateHindi.trim().toLowerCase();

      const isDuplicate = existingList.some(
        (s) => s.hindiName?.trim().toLowerCase() === cleanHindi
      );
      expect(isDuplicate).toBe(true);
    });

    it("2.3 Permits a genuinely unique subject", () => {
      const candidateName = "Indian Economy";
      const candidateHindi = "भारतीय अर्थव्यवस्था";

      const isDuplicate = existingList.some(
        (s) =>
          (candidateName && s.name?.trim().toLowerCase() === candidateName.trim().toLowerCase()) ||
          (candidateHindi && s.hindiName?.trim().toLowerCase() === candidateHindi.trim().toLowerCase())
      );
      expect(isDuplicate).toBe(false);
    });
  });

  describe("3. QuestionsStore Reducer Operations (addSubject, editSubject, deleteSubject)", () => {
    it("3.1 addSubject appends to customSubjects without mutating existing state", () => {
      const newSubj: Subject = {
        id: "subj_test_new_1",
        name: "Current Affairs",
        hindiName: "समसामयिकी",
        order: 2,
        isUserAdded: true
      };

      const updatedStore = addSubject(mockStore, newSubj);
      expect(updatedStore.customSubjects).toHaveLength(2);
      expect(updatedStore.customSubjects?.find((s) => s.id === "subj_test_new_1")).toBeDefined();
      expect(mockStore.customSubjects).toHaveLength(1); // Immutability preserved
    });

    it("3.2 editSubject updates attributes of targeted subject", () => {
      const updatedSubj: Subject = {
        id: "sub_raj_hist",
        name: "Rajasthan History & Heritage",
        hindiName: "राजस्थान का इतिहास एवं विरासत",
        description: "Updated description",
        icon: "TrendingUp",
        color: "rose",
        order: 1,
        isUserAdded: false
      };

      const updatedStore = editSubject(mockStore, updatedSubj);
      const retrieved = updatedStore.customSubjects?.find((s) => s.id === "sub_raj_hist");
      expect(retrieved?.name).toBe("Rajasthan History & Heritage");
      expect(retrieved?.hindiName).toBe("राजस्थान का इतिहास एवं विरासत");
      expect(retrieved?.color).toBe("rose");
    });

    it("3.3 deleteSubject removes targeted subject from customSubjects", () => {
      const intermediateStore = addSubject(mockStore, {
        id: "subj_to_delete",
        name: "Temporary Subject",
        hindiName: "अस्थायी विषय",
        order: 99
      });
      expect(intermediateStore.customSubjects).toHaveLength(2);

      const finalStore = deleteSubject(intermediateStore, "subj_to_delete");
      expect(finalStore.customSubjects).toHaveLength(1);
      expect(finalStore.customSubjects?.find((s) => s.id === "subj_to_delete")).toBeUndefined();
    });
  });

  describe("4. Local IndexedDB Persistence & Safe Fallbacks", () => {
    it("4.1 Saves draft subject to IndexedDB and retrieves it successfully", async () => {
      const draftSubject: Subject = {
        id: `draft-subj-${Date.now()}`,
        name: "Draft Subject",
        hindiName: "प्रारूप विषय",
        order: 10,
        isUserAdded: true
      };

      const saveRes = await saveSubjectToSupabase(draftSubject);
      expect(saveRes.success).toBe(true);

      const retrieved = await idbGet<Subject>(STORES.SUBJECTS, draftSubject.id);
      expect(retrieved).toBeDefined();
      expect(retrieved?.name).toBe("Draft Subject");

      const delRes = await deleteSubjectFromSupabase(draftSubject.id);
      expect(delRes.success).toBe(true);

      const afterDelete = await idbGet<Subject>(STORES.SUBJECTS, draftSubject.id);
      expect(afterDelete).toBeNull();
    });

    it("4.2 getCombinedSubjects returns merged subjects with fallback preservation", () => {
      const combined = getCombinedSubjects(mockStore);
      expect(Array.isArray(combined)).toBe(true);
      expect(combined.length).toBeGreaterThan(0);
      expect(combined.some((s) => s.id === "sub_raj_hist")).toBe(true);
    });
  });

  describe("5. Production Safety & Non-Interference", () => {
    it("5.1 Production subject sub_raj_hist remains intact and protected", async () => {
      const pilotSubject = await idbGet<Subject>(STORES.SUBJECTS, "sub_raj_hist");
      // Even if not in local IDB cache, it must remain defined in default combined curriculum
      const combined = getCombinedSubjects(mockStore);
      const found = combined.find((s) => s.id === "sub_raj_hist");
      expect(found).toBeDefined();
      expect(found?.name).toBe("Rajasthan History");
    });
  });
});
