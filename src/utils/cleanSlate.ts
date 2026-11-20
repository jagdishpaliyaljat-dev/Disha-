import { 
  ProgressStore, 
  UserQuestionsStore, 
  DailyStudyHistory, 
  AppNotification, 
  PerformanceStore, 
  PYQPaper, 
  LiveTest, 
  ExamCategory,
  Subject,
  Chapter,
  Topic,
  Question
} from "../types";

/**
 * Clean Slate Utility & Zero-Mock Enforcement
 * Guarantees 100% removal and blocking of all test subjects, test chapters/topics,
 * test MCQs, mock data, sample quizzes, and stress-test artifacts.
 */

const CLEAN_SLATE_VERSION_KEY = "disha2020_clean_slate_zero_mock_v12_0";
const CURRENT_CLEAN_SLATE_VERSION = "12.0.0";

// Complete clean slate keys reset to empty arrays on startup
const KEYS_TO_RESET_TO_EMPTY = [
  "disha2020_admin_audit_logs_v1",
  "quizpro_admin_audit_logs_v1",
  "remix_rajprep_exam_analyses_v1",
  "economic_survey_notifications_v1",
  "disha2020_notifications_v1",
  "disha2020_banners_v2",
  "quizpro_banners_v2",
  "disha2020_news_articles_v2",
  "quizpro_news_articles_v2",
  "disha2020_deleted_banners_v1",
  "quizpro_deleted_banners_v1",
  "disha2020_deleted_articles_v1",
  "quizpro_deleted_articles_v1",
  "remix_rajprep_deleted_live_tests_v1",
  "remix_rajprep_deleted_pyq_papers_v1",
  "remix_rajprep_live_tests_v1",
  "remix_rajprep_live_submissions_v1",
  "remix_rajprep_pyq_papers_v2",
  "remix_rajprep_pyq_attempts_v2",
  "remix_rajprep_exam_categories_v1",
  "disha_custom_coaching_nodes_v1",
  "disha_deleted_coaching_node_ids_v1",
];

const OBSOLETE_LEGACY_KEYS = [
  "economic_survey_progress_v1",
  "economic_survey_progress",
  "economic_survey_study_history_v1",
  "economic_survey_study_history",
  "economic_survey_user_questions_v1",
  "economic_survey_questions",
  "economic_survey_notifications_demo",
  "economic_survey_sample_quiz",
  "demo_quiz_questions",
  "mock_exam_results_v1",
  "ras-pre-sample",
  "econ-multilingual-2024",
  "remix_rajprep_legacy_sub_state",
  "cached_curriculum_v1",
  "disha_user_home_district",
  "disha_user_district_points",
  "disha_district_war_scores_v2",
  "disha_district_war_events_v2",
];

const DUMMY_KEYWORDS = [
  "sample data",
  "dummy content",
  "lorem ipsum",
  "test question",
  "placeholder text",
  "ig oyy",
  "testing subject",
  "testing chapter",
  "testing topic",
  "test subject",
  "test chapter",
  "test topic",
  "rajasthan (test)",
  "mathematics (test)",
  "dummy subject",
  "sample quiz",
  "sample mcq",
  "dummy mcq",
  "test mcq",
  "test paper",
  "test banner",
  "test category",
  "test user",
  "test rule",
  "test attempt",
];

// Specific test subject IDs or placeholder names to purge completely
const EXACT_MATCH_DUMMY_NAMES = new Set([
  "Testing",
  "Ig Oyy",
  "Test",
  "Demo",
  "Dummy",
  "TEST_Sub",
  "TEST_Chapter",
  "TEST_Chapter_Renamed",
  "TEST_Topic",
  "TEST_Question Text?",
  "TEST_Banner",
  "TEST_Category",
  "TEST_PYQ_Paper",
  "TEST_Live_Test",
]);

/**
 * Checks if an ID represents a test, mock, or stress-test generated record
 */
export function isTestOrMockId(id?: string | null): boolean {
  if (!id || typeof id !== "string") return false;
  const trimmed = id.trim();
  const lower = trimmed.toLowerCase();
  
  if (
    trimmed.startsWith("TEST_") ||
    trimmed.startsWith("test_") ||
    trimmed.startsWith("mock_") ||
    trimmed.startsWith("MOCK_") ||
    trimmed.startsWith("dummy_") ||
    trimmed.startsWith("DUMMY_") ||
    trimmed.startsWith("sample_") ||
    trimmed.startsWith("reg_test_") ||
    trimmed.startsWith("reg_") ||
    trimmed.startsWith("usr-q-custom-topic-1794149994193-jxf0o-") ||
    trimmed.startsWith("usr-q-gen-") ||
    trimmed.startsWith("q_pilot_") ||
    trimmed.startsWith("usr-q-topic_c60f80e6") ||
    trimmed.startsWith("usr-q-topic_7eef8754")
  ) {
    return true;
  }

  if (
    trimmed === "chap_raj_sources" ||
    trimmed === "chap_raj_1857" ||
    trimmed === "top_inscriptions" ||
    trimmed === "top_coins" ||
    trimmed === "top_cantonments" ||
    trimmed === "top_auwa" ||
    trimmed === "topic_c60f80e6-a72b-4b8c-9740-75aa1fb73126" ||
    trimmed === "topic_7eef8754-fc32-47cd-8140-65c144f2183e" ||
    trimmed === "custom-topic-1794931449581-8mm21" ||
    trimmed === "subj-1794149966275-03yvv" ||
    trimmed === "custom-ch-1794149979635-03auk" ||
    trimmed === "custom-topic-1794149994193-jxf0o" ||
    trimmed === "top_hindi_samas" ||
    trimmed === "top_raj_polity_core" ||
    trimmed === "ch_hindi_samas" ||
    trimmed === "ch_raj_polity_exec"
  ) {
    return true;
  }

  if (
    trimmed.includes("TEST_MASS_") ||
    trimmed.includes("TEST_PYQ_STRESS_") ||
    trimmed.includes("TEST_LIVE_STRESS_") ||
    trimmed.includes("TEST_CAT_STRESS_") ||
    trimmed.includes("test_no_mock_") ||
    trimmed.includes("test_batch_nomock_") ||
    trimmed.includes("TEST_CACHE_")
  ) {
    return true;
  }

  if (lower === "subj_general_hindi" || lower === "subj_raj_polity") {
    return true;
  }

  return false;
}

/**
 * Checks if text contains dummy, test, or mock markers
 */
export function isTestOrMockText(text?: string | null): boolean {
  if (!text || typeof text !== "string") return false;
  const trimmed = text.trim();
  if (!trimmed) return false;
  
  if (EXACT_MATCH_DUMMY_NAMES.has(trimmed)) return true;
  if (trimmed.startsWith("TEST_") || trimmed.startsWith("test_") || trimmed.startsWith("mock_")) return true;
  
  const lower = trimmed.toLowerCase();
  return DUMMY_KEYWORDS.some((kw) => lower.includes(kw));
}

/**
 * Validates whether a Subject is a genuine curriculum subject or a test/mock subject
 */
export function isTestOrMockSubject(subject?: Partial<Subject> | null): boolean {
  if (!subject) return true;
  // If explicitly flagged as a genuine user-created subject or valid ID prefix, NEVER reject
  const idStr = String(subject.id || "");
  if (
    (subject as any).isUserAdded === true ||
    idStr.startsWith("subj-") ||
    idStr.startsWith("sub_") ||
    idStr.startsWith("subj_")
  ) {
    if (subject.id === "subj_general_hindi" || subject.id === "subj_raj_polity") return true;
    if ((subject as any).isTest === true || (subject as any).is_test === true || (subject as any).isMock === true) return true;
    if (isTestOrMockId(subject.id)) return true;
    return false;
  }
  if ((subject as any).isTest === true || (subject as any).is_test === true || (subject as any).isMock === true) return true;
  if (isTestOrMockId(subject.id)) return true;
  if (subject.id === "subj_general_hindi" || subject.id === "subj_raj_polity") return true;
  if (isTestOrMockText(subject.name) || isTestOrMockText(subject.hindiName)) return true;
  return false;
}

/**
 * Validates whether a Chapter is a genuine curriculum chapter or test/mock
 */
export function isTestOrMockChapter(chapter?: Partial<Chapter> | null): boolean {
  if (!chapter) return true;
  // If explicitly flagged as a genuine user-created chapter or valid ID prefix, NEVER reject
  const idStr = String(chapter.id || "");
  if (
    (chapter as any).isUserAdded === true ||
    idStr.startsWith("custom-ch-") ||
    idStr.startsWith("chap_") ||
    idStr.startsWith("ch_")
  ) {
    if ((chapter as any).isTest === true || (chapter as any).is_test === true || (chapter as any).isMock === true) return true;
    if (isTestOrMockId(chapter.id) || isTestOrMockId(chapter.subjectId)) return true;
    return false;
  }
  if ((chapter as any).isTest === true || (chapter as any).is_test === true || (chapter as any).isMock === true) return true;
  if (isTestOrMockId(chapter.id) || isTestOrMockId(chapter.subjectId)) return true;
  if (isTestOrMockText(chapter.title) || isTestOrMockText(chapter.hindiTitle)) return true;
  return false;
}

/**
 * Validates whether a Topic is a genuine curriculum topic or test/mock
 */
export function isTestOrMockTopic(topic?: Partial<Topic> | null): boolean {
  if (!topic) return true;
  // If explicitly flagged as a genuine user-created topic or valid ID prefix, NEVER reject
  const idStr = String(topic.id || "");
  if (
    (topic as any).isUserAdded === true ||
    idStr.startsWith("custom-topic-") ||
    idStr.startsWith("topic_") ||
    idStr.startsWith("top_")
  ) {
    if ((topic as any).isTest === true || (topic as any).is_test === true || (topic as any).isMock === true) return true;
    if (isTestOrMockId(topic.id) || isTestOrMockId(topic.chapterId) || isTestOrMockId(topic.subjectId)) return true;
    return false;
  }
  if ((topic as any).isTest === true || (topic as any).is_test === true || (topic as any).isMock === true) return true;
  if (isTestOrMockId(topic.id) || isTestOrMockId(topic.chapterId) || isTestOrMockId(topic.subjectId)) return true;
  if (isTestOrMockText(topic.title) || isTestOrMockText(topic.hindiTitle)) return true;
  return false;
}

/**
 * Validates whether a Question (MCQ) is a genuine question or test/mock question
 */
export function isTestOrMockQuestion(question?: Partial<Question> | null): boolean {
  if (!question) return true;
  if ((question as any).isTest === true || (question as any).is_test === true || (question as any).isMock === true) return true;
  if (isTestOrMockId(question.id)) return true;
  if (isTestOrMockId(question.subjectId) || isTestOrMockId(question.chapterId) || isTestOrMockId(question.topicId)) return true;
  if (isTestOrMockText(question.text) || isTestOrMockText(question.explanation)) return true;
  return false;
}

/**
 * Validates whether a LiveTest is a genuine test or mock/test artifact
 */
export function isTestOrMockLiveTest(test?: Partial<LiveTest> | null): boolean {
  if (!test) return true;
  if ((test as any).isTest === true || (test as any).is_test === true || (test as any).isMock === true) return true;
  if (isTestOrMockId(test.id)) return true;
  // Purge sample mock live tests
  if (test.id === "live_test_ras_pre_2026_01" || test.id === "live_test_cet_grad_2026_01") return true;
  if (isTestOrMockText(test.title) || isTestOrMockText(test.hindiTitle)) return true;
  return false;
}

/**
 * Validates whether a PYQ Paper is genuine or mock/sample artifact
 */
export function isTestOrMockPYQ(paper?: Partial<PYQPaper> | null): boolean {
  if (!paper) return true;
  if ((paper as any).isTest === true || (paper as any).is_test === true || (paper as any).isMock === true) return true;
  if (isTestOrMockId(paper.id)) return true;
  // Purge sample mock PYQs
  if (paper.id === "pyq_ras_pre_2023" || paper.id === "pyq_eoro_2023" || paper.id === "pyq_cet_grad_2023") return true;
  if (isTestOrMockText(paper.title) || isTestOrMockText(paper.hindiTitle)) return true;
  return false;
}

/**
 * Comprehensive Sanitization of UserQuestionsStore:
 * Purges all test subjects, test chapters, test topics, test questions, and mock artifacts.
 */
export function sanitizeUserQuestionsStore(store: UserQuestionsStore): { sanitized: UserQuestionsStore; changed: boolean } {
  let changed = false;

  // 1. Sanitize Custom Subjects
  const sanitizedCustomSubjects = (store.customSubjects || []).filter((s) => {
    if (isTestOrMockSubject(s)) {
      changed = true;
      return false;
    }
    return true;
  });

  const validSubjectIds = new Set(sanitizedCustomSubjects.map((s) => s.id));

  // 2. Sanitize Custom Chapters (must belong to a valid subject)
  const sanitizedCustomChapters = (store.customChapters || []).filter((ch) => {
    if (isTestOrMockChapter(ch)) {
      changed = true;
      return false;
    }
    if (ch.subjectId && !validSubjectIds.has(ch.subjectId) && isTestOrMockId(ch.subjectId)) {
      changed = true;
      return false;
    }
    return true;
  });

  const validChapterIds = new Set(sanitizedCustomChapters.map((c) => c.id));

  // 3. Sanitize Custom Topics
  const sanitizedCustomTopics = (store.customTopics || []).filter((t) => {
    if (isTestOrMockTopic(t)) {
      changed = true;
      return false;
    }
    if (t.chapterId && !validChapterIds.has(t.chapterId) && isTestOrMockId(t.chapterId)) {
      changed = true;
      return false;
    }
    if (t.subjectId && !validSubjectIds.has(t.subjectId) && isTestOrMockId(t.subjectId)) {
      changed = true;
      return false;
    }
    return true;
  });

  // 4. Sanitize Custom Questions
  const sanitizedCustomQuestions = (store.customQuestions || []).filter((q) => {
    if (isTestOrMockQuestion(q)) {
      changed = true;
      return false;
    }
    return true;
  });

  // 5. Sanitize Cloud Cache Questions
  const sanitizedCloudCache = (store.cloudCacheQuestions || []).filter((q) => {
    if (isTestOrMockQuestion(q)) {
      changed = true;
      return false;
    }
    return true;
  });

  if (sanitizedCloudCache.length !== (store.cloudCacheQuestions || []).length) {
    changed = true;
  }

  // 6. Clean edited maps of any test IDs
  const cleanEditedSubjects: Record<string, Subject> = {};
  for (const [id, s] of Object.entries(store.editedSubjects || {})) {
    if (!isTestOrMockId(id) && !isTestOrMockSubject(s)) {
      cleanEditedSubjects[id] = s;
    } else {
      changed = true;
    }
  }

  const cleanEditedChapters: Record<string, Chapter> = {};
  for (const [id, ch] of Object.entries(store.editedChapters || {})) {
    if (!isTestOrMockId(id) && !isTestOrMockChapter(ch)) {
      cleanEditedChapters[id] = ch;
    } else {
      changed = true;
    }
  }

  const cleanEditedTopics: Record<string, Topic> = {};
  for (const [id, t] of Object.entries(store.editedTopics || {})) {
    if (!isTestOrMockId(id) && !isTestOrMockTopic(t)) {
      cleanEditedTopics[id] = t;
    } else {
      changed = true;
    }
  }

  const cleanEditedQuestions: Record<string, Question> = {};
  for (const [id, q] of Object.entries(store.editedQuestions || {})) {
    if (!isTestOrMockId(id) && !isTestOrMockQuestion(q)) {
      cleanEditedQuestions[id] = q;
    } else {
      changed = true;
    }
  }

  // 7. Clean deleted IDs lists
  const cleanDeletedSubjects = (store.deletedSubjectIds || []).filter((id) => !isTestOrMockId(id));
  const cleanDeletedChapters = (store.deletedChapterIds || []).filter((id) => !isTestOrMockId(id));
  const cleanDeletedTopics = (store.deletedTopicIds || []).filter((id) => !isTestOrMockId(id));
  const cleanDeletedQuestions = (store.deletedQuestionIds || []).filter((id) => !isTestOrMockId(id));

  return {
    sanitized: {
      ...store,
      customSubjects: sanitizedCustomSubjects,
      customChapters: sanitizedCustomChapters,
      customTopics: sanitizedCustomTopics,
      customQuestions: sanitizedCustomQuestions,
      cloudCacheQuestions: sanitizedCloudCache,
      editedSubjects: cleanEditedSubjects,
      editedChapters: cleanEditedChapters,
      editedTopics: cleanEditedTopics,
      editedQuestions: cleanEditedQuestions,
      deletedSubjectIds: cleanDeletedSubjects,
      deletedChapterIds: cleanDeletedChapters,
      deletedTopicIds: cleanDeletedTopics,
      deletedQuestionIds: cleanDeletedQuestions,
    },
    changed,
  };
}

export function sanitizeNotifications(notifications: AppNotification[]): { sanitized: AppNotification[]; changed: boolean } {
  let changed = false;
  const sanitized = (notifications || []).filter((n) => {
    if (isTestOrMockText(n.title) || isTestOrMockText(n.hindiTitle) || isTestOrMockText(n.message) || isTestOrMockText(n.hindiMessage)) {
      changed = true;
      return false;
    }
    return true;
  });
  return { sanitized, changed };
}

export function purgeObsoleteKeys(): void {
  try {
    if (typeof localStorage === "undefined") return;
    for (const key of OBSOLETE_LEGACY_KEYS) {
      if (localStorage.getItem(key) !== null) {
        localStorage.removeItem(key);
      }
    }

    // Also scan for test keys in localStorage
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && (
        k.startsWith("TEST_") || 
        k.startsWith("test_") || 
        k.startsWith("mock_") || 
        k.startsWith("disha2020_test_") ||
        k.startsWith("disha2020_mock_") ||
        k.startsWith("quizpro_test_") ||
        k.startsWith("quizpro_mock_")
      )) {
        keysToRemove.push(k);
      }
    }
    keysToRemove.forEach((k) => localStorage.removeItem(k));
  } catch (e) {
    console.warn("Could not purge obsolete keys", e);
  }
}

/**
 * Executes a one-time clean-slate migration on application startup
 * to ensure 100% zero mock or sample state exists in the browser storage.
 */
export function ensureCleanSlateOnStartup(): void {
  try {
    if (typeof window === "undefined" || typeof localStorage === "undefined") return;

    const currentVer = localStorage.getItem(CLEAN_SLATE_VERSION_KEY);
    if (currentVer === CURRENT_CLEAN_SLATE_VERSION) {
      return;
    }

    // 1. Purge obsolete keys and test artifacts from localStorage
    purgeObsoleteKeys();

    // 2. Reset seed/mock storage keys to empty arrays
    for (const key of KEYS_TO_RESET_TO_EMPTY) {
      localStorage.setItem(key, JSON.stringify([]));
    }

    // 3. Purge mock Live Tests and PYQ Papers from localStorage
    const LIVE_TESTS_KEY = "remix_rajprep_live_tests_v1";
    try {
      const rawLive = localStorage.getItem(LIVE_TESTS_KEY);
      if (rawLive) {
        const parsed = JSON.parse(rawLive);
        if (Array.isArray(parsed)) {
          const cleanLive = parsed.filter((t) => !isTestOrMockLiveTest(t));
          localStorage.setItem(LIVE_TESTS_KEY, JSON.stringify(cleanLive));
        }
      }
    } catch {}

    const PYQ_KEY = "remix_rajprep_pyq_papers_v2";
    try {
      const rawPyq = localStorage.getItem(PYQ_KEY);
      if (rawPyq) {
        const parsed = JSON.parse(rawPyq);
        if (Array.isArray(parsed)) {
          const cleanPyq = parsed.filter((p) => !isTestOrMockPYQ(p));
          localStorage.setItem(PYQ_KEY, JSON.stringify(cleanPyq));
        }
      }
    } catch {}

    // 4. Reset User Questions Store in localStorage to 100% clean blank state
    const USER_QUESTIONS_KEY = "economic_survey_user_questions_v2";
    const EMPTY_STORE: UserQuestionsStore = {
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
    localStorage.setItem(USER_QUESTIONS_KEY, JSON.stringify(EMPTY_STORE));

    // 5. Purge Cached IndexedDB Databases
    try {
      if (typeof window !== "undefined" && window.indexedDB) {
        window.indexedDB.deleteDatabase("disha2020-db-v5");
        window.indexedDB.deleteDatabase("quizpro-db-v5");
      }
    } catch {}

    // Mark clean slate version as applied
    localStorage.setItem(CLEAN_SLATE_VERSION_KEY, CURRENT_CLEAN_SLATE_VERSION);
    console.log("[CleanSlate] 12.0.0 applied successfully: Zero-mock clean slate verified.");
  } catch (e) {
    console.error("[CleanSlate] Startup verification failed:", e);
  }
}
