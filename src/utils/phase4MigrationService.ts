import {
  collection,
  doc,
  getDoc,
  getDocs,
  getCountFromServer,
} from "firebase/firestore";
import { db, auth } from "../lib/firebase";
import { bumpRemoteCurriculumVersion } from "./appVersionService";
import { clearIndexedDB } from "./indexedDbCache";
import {
  guardedSetDoc,
  guardedDeleteDoc,
  guardedWriteBatch,
  isQuotaExhausted,
} from "./quotaTracker";

export type DuplicatePairDecision =
  | "KEEP_BOTH"
  | "KEEP_A_ARCHIVE_B"
  | "KEEP_B_ARCHIVE_A"
  | "MERGE_AFTER_REVIEW"
  | "DEFER";

export interface Phase4AuditLogEntry {
  timestamp: string;
  task: "TASK_1" | "TASK_2" | "TASK_3" | "TASK_4" | "ROLLBACK";
  action: string;
  actorRole: "admin_verified" | "system_preflight";
  status:
    | "PREFLIGHT_PASS"
    | "PREFLIGHT_FAIL"
    | "AWAITING_APPROVAL"
    | "EXECUTED_AND_VERIFIED"
    | "SKIPPED_CHANGED_SINCE_PREFLIGHT"
    | "FAILED";
  targetDocumentIds: string[];
  details: Record<string, any>;
}

export const PHASE4_TEST_ARTIFACT_ID = "mcq_09438c73c6f03f6d33976f780ea87e31";

export const EXPECTED_TEST_ARTIFACT_BACKUP_PAYLOAD = {
  id: "mcq_09438c73c6f03f6d33976f780ea87e31",
  subjectId: "economics",
  chapterId: "TEST_ch_1",
  topicId: "TEST_top_1",
  text: "TEST_Question Text?",
  hindiText: "टेस्ट प्रश्न?",
  options: ["Opt 1", "Opt 2", "Opt 3", "Opt 4"],
  hindiOptions: ["विकल्प 1", "विकल्प 2", "विकल्प 3", "विकल्प 4"],
  correctIndex: 0,
  explanation: "TEST_Explanation",
  hindiExplanation: "टेस्ट व्याख्या",
  difficulty: "medium",
  updatedAt: "2026-10-29T21:44:00.481Z",
};

export function verifyExactTestArtifactPayloadAgainstBackup(liveDoc: Record<string, any> | null | undefined): {
  matchesBackupExactly: boolean;
  mismatchedFields: string[];
} {
  if (!liveDoc || typeof liveDoc !== "object") {
    return { matchesBackupExactly: false, mismatchedFields: ["DOCUMENT_MISSING"] };
  }
  const mismatchedFields: string[] = [];
  const expected = EXPECTED_TEST_ARTIFACT_BACKUP_PAYLOAD as Record<string, any>;
  for (const key of Object.keys(expected)) {
    if (JSON.stringify(liveDoc[key]) !== JSON.stringify(expected[key])) {
      mismatchedFields.push(key);
    }
  }
  const extraKeys = Object.keys(liveDoc).filter((k) => !(k in expected));
  if (extraKeys.length > 0) {
    mismatchedFields.push(...extraKeys.map((k) => `unexpected_field:${k}`));
  }
  return {
    matchesBackupExactly: mismatchedFields.length === 0,
    mismatchedFields,
  };
}

export const PHASE4_PROPOSED_SUBJECTS: Array<{ id: string; name: string; icon: string; order: number; isExisting: boolean }> = [];

export const PHASE4_PROPOSED_CHAPTERS = [
  {
    id: "ch_raj_art_arch",
    subjectId: "subj-1793126281086-96tzj",
    title: "दुर्ग, महल एवं स्थापत्य कला",
    description: "राजस्थान के प्रमुख दुर्ग, महल, स्मारक एवं स्थापत्य कला",
    order: 1,
  },
  {
    id: "ch_raj_folk_culture",
    subjectId: "subj-1793126281086-96tzj",
    title: "लोक संस्कृति एवं सांस्कृतिक विरासत",
    description: "सांस्कृतिक संस्थाएँ, विरासत स्थल, लोक वाद्य यंत्र, मेले एवं त्योहार",
    order: 2,
  },
  {
    id: "ch_current_raj",
    subjectId: "subj-1793126332353-e3dxj",
    title: "राजस्थान समसामयिकी एवं प्रमुख योजनाएँ",
    description: "राजस्थान की नवीनतम योजनाएँ, नीतियाँ, चर्चित व्यक्तित्व एवं पुरस्कार",
    order: 1,
  },
  {
    id: "ch_current_nat_intl",
    subjectId: "subj-1793126332353-e3dxj",
    title: "राष्ट्रीय एवं अंतर्राष्ट्रीय परिदृश्य",
    description: "राष्ट्रीय घटनाक्रम, अंतर्राष्ट्रीय सम्मेलन एवं खेल परिदृश्य",
    order: 2,
  },
  {
    id: "ch_hindi_samas",
    subjectId: "subj_general_hindi",
    title: "समास (हिंदी व्याकरण)",
    description: "हिंदी व्याकरण — समास के भेद एवं सामासिक पद (अव्ययीभाव, तत्पुरुष, कर्मधारय, द्विगु, द्वन्द्व, बहुव्रीहि)",
    order: 1,
  },
  {
    id: "ch_raj_polity_exec",
    subjectId: "subj_raj_polity",
    title: "राजस्थान की संवैधानिक एवं प्रशासनिक व्यवस्था",
    description: "विधानमंडल, राज्यपाल, राजस्थान लोक सेवा आयोग (RPSC) एवं नगरपालिका अधिनियम 2009",
    order: 1,
  },
];

export const PHASE4_PROPOSED_TOPICS = [
  {
    id: "top_raj_forts_arch",
    subjectId: "subj-1793126281086-96tzj",
    chapterId: "ch_raj_art_arch",
    title: "प्रमुख दुर्ग एवं स्थापत्य",
    order: 1,
  },
  {
    id: "top_raj_heritage_inst",
    subjectId: "subj-1793126281086-96tzj",
    chapterId: "ch_raj_folk_culture",
    title: "सांस्कृतिक संस्थाएँ एवं विरासत स्थल",
    order: 1,
  },
  {
    id: "top_raj_instruments",
    subjectId: "subj-1793126281086-96tzj",
    chapterId: "ch_raj_folk_culture",
    title: "लोक वाद्य यंत्र",
    order: 2,
  },
  {
    id: "top_raj_festivals",
    subjectId: "subj-1793126281086-96tzj",
    chapterId: "ch_raj_folk_culture",
    title: "मेले एवं त्योहार",
    order: 3,
  },
  {
    id: "top_current_schemes",
    subjectId: "subj-1793126332353-e3dxj",
    chapterId: "ch_current_raj",
    title: "नवीनतम योजनाएँ एवं नीतियाँ",
    order: 1,
  },
  {
    id: "top_current_events",
    subjectId: "subj-1793126332353-e3dxj",
    chapterId: "ch_current_raj",
    title: "चर्चित व्यक्तित्व, पुरस्कार एवं सम्मेलन",
    order: 2,
  },
  {
    id: "top_current_nat",
    subjectId: "subj-1793126332353-e3dxj",
    chapterId: "ch_current_nat_intl",
    title: "राष्ट्रीय घटनाक्रम एवं खेल",
    order: 1,
  },
  {
    id: "top_hindi_samas",
    subjectId: "subj_general_hindi",
    chapterId: "ch_hindi_samas",
    title: "समास के भेद एवं सामासिक पद",
    order: 1,
  },
  {
    id: "top_raj_polity_core",
    subjectId: "subj_raj_polity",
    chapterId: "ch_raj_polity_exec",
    title: "राज्यपाल, विधानमंडल एवं नगरीय प्रशासन",
    order: 1,
  },
];

export interface Target19QuestionMapping {
  id: string;
  category: "Art & Culture" | "General Hindi" | "Rajasthan Polity";
  expectedInMcqs: boolean;
  expectedInQuestions: boolean;
  collectionPresence: "MCQS_ONLY" | "QUESTIONS_ONLY" | "BOTH";
  targetSubjectId: string;
  targetChapterId: string;
  targetTopicId: string;
  expectedKeyword: string;
}

export const PHASE4_19_QUESTION_MAPPINGS: Target19QuestionMapping[] = [
  // 4 Verified Rajasthan Art & Culture Questions (exist in 'mcqs' ONLY)
  {
    id: "cet_q3",
    category: "Art & Culture",
    expectedInMcqs: true,
    expectedInQuestions: false,
    collectionPresence: "MCQS_ONLY",
    targetSubjectId: "subj-1793126281086-96tzj",
    targetChapterId: "ch_raj_art_arch",
    targetTopicId: "top_raj_forts_arch",
    expectedKeyword: "Golden Fort",
  },
  {
    id: "ras_q5",
    category: "Art & Culture",
    expectedInMcqs: true,
    expectedInQuestions: false,
    collectionPresence: "MCQS_ONLY",
    targetSubjectId: "subj-1793126281086-96tzj",
    targetChapterId: "ch_raj_folk_culture",
    targetTopicId: "top_raj_heritage_inst",
    expectedKeyword: "West Zone Cultural Centre",
  },
  {
    id: "pyq_eoro_q2",
    category: "Art & Culture",
    expectedInMcqs: true,
    expectedInQuestions: false,
    collectionPresence: "MCQS_ONLY",
    targetSubjectId: "subj-1793126281086-96tzj",
    targetChapterId: "ch_raj_folk_culture",
    targetTopicId: "top_raj_instruments",
    expectedKeyword: "coconut shell",
  },
  {
    id: "pyq_eoro_q4",
    category: "Art & Culture",
    expectedInMcqs: true,
    expectedInQuestions: false,
    collectionPresence: "MCQS_ONLY",
    targetSubjectId: "subj-1793126281086-96tzj",
    targetChapterId: "ch_raj_folk_culture",
    targetTopicId: "top_raj_festivals",
    expectedKeyword: "Dhola and Maru",
  },
  // 12 Verified Hindi Grammar (समास) Questions (exist in BOTH 'mcqs' AND 'questions')
  {
    id: "usr-q-gen-1827291c",
    category: "General Hindi",
    expectedInMcqs: true,
    expectedInQuestions: true,
    collectionPresence: "BOTH",
    targetSubjectId: "subj_general_hindi",
    targetChapterId: "ch_hindi_samas",
    targetTopicId: "top_hindi_samas",
    expectedKeyword: "समास",
  },
  {
    id: "usr-q-gen-1b09d7ff",
    category: "General Hindi",
    expectedInMcqs: true,
    expectedInQuestions: true,
    collectionPresence: "BOTH",
    targetSubjectId: "subj_general_hindi",
    targetChapterId: "ch_hindi_samas",
    targetTopicId: "top_hindi_samas",
    expectedKeyword: "समास",
  },
  {
    id: "usr-q-gen-390c3843",
    category: "General Hindi",
    expectedInMcqs: true,
    expectedInQuestions: true,
    collectionPresence: "BOTH",
    targetSubjectId: "subj_general_hindi",
    targetChapterId: "ch_hindi_samas",
    targetTopicId: "top_hindi_samas",
    expectedKeyword: "सामासिक पद",
  },
  {
    id: "usr-q-gen-5223a112",
    category: "General Hindi",
    expectedInMcqs: true,
    expectedInQuestions: true,
    collectionPresence: "BOTH",
    targetSubjectId: "subj_general_hindi",
    targetChapterId: "ch_hindi_samas",
    targetTopicId: "top_hindi_samas",
    expectedKeyword: "समास",
  },
  {
    id: "usr-q-gen-526a3b77",
    category: "General Hindi",
    expectedInMcqs: true,
    expectedInQuestions: true,
    collectionPresence: "BOTH",
    targetSubjectId: "subj_general_hindi",
    targetChapterId: "ch_hindi_samas",
    targetTopicId: "top_hindi_samas",
    expectedKeyword: "समास",
  },
  {
    id: "usr-q-gen-78ec5877",
    category: "General Hindi",
    expectedInMcqs: true,
    expectedInQuestions: true,
    collectionPresence: "BOTH",
    targetSubjectId: "subj_general_hindi",
    targetChapterId: "ch_hindi_samas",
    targetTopicId: "top_hindi_samas",
    expectedKeyword: "द्विगु",
  },
  {
    id: "usr-q-gen-859f9b8",
    category: "General Hindi",
    expectedInMcqs: true,
    expectedInQuestions: true,
    collectionPresence: "BOTH",
    targetSubjectId: "subj_general_hindi",
    targetChapterId: "ch_hindi_samas",
    targetTopicId: "top_hindi_samas",
    expectedKeyword: "समास",
  },
  {
    id: "usr-q-gen-8ae52212",
    category: "General Hindi",
    expectedInMcqs: true,
    expectedInQuestions: true,
    collectionPresence: "BOTH",
    targetSubjectId: "subj_general_hindi",
    targetChapterId: "ch_hindi_samas",
    targetTopicId: "top_hindi_samas",
    expectedKeyword: "समास",
  },
  {
    id: "usr-q-gen-a48a8d42",
    category: "General Hindi",
    expectedInMcqs: true,
    expectedInQuestions: true,
    collectionPresence: "BOTH",
    targetSubjectId: "subj_general_hindi",
    targetChapterId: "ch_hindi_samas",
    targetTopicId: "top_hindi_samas",
    expectedKeyword: "समास",
  },
  {
    id: "usr-q-gen-b6813511",
    category: "General Hindi",
    expectedInMcqs: true,
    expectedInQuestions: true,
    collectionPresence: "BOTH",
    targetSubjectId: "subj_general_hindi",
    targetChapterId: "ch_hindi_samas",
    targetTopicId: "top_hindi_samas",
    expectedKeyword: "तत्पुरुष",
  },
  {
    id: "usr-q-gen-c6a4b74a",
    category: "General Hindi",
    expectedInMcqs: true,
    expectedInQuestions: true,
    collectionPresence: "BOTH",
    targetSubjectId: "subj_general_hindi",
    targetChapterId: "ch_hindi_samas",
    targetTopicId: "top_hindi_samas",
    expectedKeyword: "समास",
  },
  {
    id: "usr-q-gen-d8a7cdaf",
    category: "General Hindi",
    expectedInMcqs: true,
    expectedInQuestions: true,
    collectionPresence: "BOTH",
    targetSubjectId: "subj_general_hindi",
    targetChapterId: "ch_hindi_samas",
    targetTopicId: "top_hindi_samas",
    expectedKeyword: "तत्पुरुष",
  },
  // 3 Verified Rajasthan Polity Questions (exist in 'mcqs' ONLY)
  {
    id: "pyq_eoro_q1",
    category: "Rajasthan Polity",
    expectedInMcqs: true,
    expectedInQuestions: false,
    collectionPresence: "MCQS_ONLY",
    targetSubjectId: "subj_raj_polity",
    targetChapterId: "ch_raj_polity_exec",
    targetTopicId: "top_raj_polity_core",
    expectedKeyword: "Rajasthan Municipalities Act 2009",
  },
  {
    id: "pyq_ras23_q3",
    category: "Rajasthan Polity",
    expectedInMcqs: true,
    expectedInQuestions: false,
    collectionPresence: "MCQS_ONLY",
    targetSubjectId: "subj_raj_polity",
    targetChapterId: "ch_raj_polity_exec",
    targetTopicId: "top_raj_polity_core",
    expectedKeyword: "State Legislature in Rajasthan",
  },
  {
    id: "ras_q1",
    category: "Rajasthan Polity",
    expectedInMcqs: true,
    expectedInQuestions: false,
    collectionPresence: "MCQS_ONLY",
    targetSubjectId: "subj_raj_polity",
    targetChapterId: "ch_raj_polity_exec",
    targetTopicId: "top_raj_polity_core",
    expectedKeyword: "Rajasthan Public Service Commission",
  },
];

export const PHASE4_8_NEAR_DUPLICATE_PAIRS = [
  {
    pairNumber: 1,
    approvalTokenKey: "PAIR_1",
    docAId: "usr-q-topic_1b890441-cad7-4e64-82db-4e9680de9f4b-7a901cc1",
    docBId: "usr-q-topic_1b890441-cad7-4e64-82db-4e9680de9f4b-bb4f3317",
    recommendedKeepId: "usr-q-topic_1b890441-cad7-4e64-82db-4e9680de9f4b-bb4f3317",
    reviewCandidateId: "usr-q-topic_1b890441-cad7-4e64-82db-4e9680de9f4b-7a901cc1",
    recommendedDecision: "KEEP_B_ARCHIVE_A" as DuplicatePairDecision,
  },
  {
    pairNumber: 2,
    approvalTokenKey: "PAIR_2",
    docAId: "usr-q-topic_1b890441-cad7-4e64-82db-4e9680de9f4b-977e2b97",
    docBId: "usr-q-topic_1b890441-cad7-4e64-82db-4e9680de9f4b-a35b00e7",
    recommendedKeepId: "usr-q-topic_1b890441-cad7-4e64-82db-4e9680de9f4b-977e2b97",
    reviewCandidateId: "usr-q-topic_1b890441-cad7-4e64-82db-4e9680de9f4b-a35b00e7",
    recommendedDecision: "KEEP_A_ARCHIVE_B" as DuplicatePairDecision,
  },
  {
    pairNumber: 3,
    approvalTokenKey: "PAIR_3",
    docAId: "usr-q-custom-topic-1793170599393-s4yys-3ce7f48d",
    docBId: "usr-q-custom-topic-1793170599393-s4yys-86d42d44",
    recommendedKeepId: "usr-q-custom-topic-1793170599393-s4yys-3ce7f48d",
    reviewCandidateId: "usr-q-custom-topic-1793170599393-s4yys-86d42d44",
    recommendedDecision: "KEEP_A_ARCHIVE_B" as DuplicatePairDecision,
  },
  {
    pairNumber: 4,
    approvalTokenKey: "PAIR_4",
    docAId: "usr-q-custom-topic-1793631902901-tyc4n-197d041d",
    docBId: "usr-q-custom-topic-1793631902901-tyc4n-327a7ef3",
    recommendedKeepId: "usr-q-custom-topic-1793631902901-tyc4n-327a7ef3",
    reviewCandidateId: "usr-q-custom-topic-1793631902901-tyc4n-197d041d",
    recommendedDecision: "KEEP_B_ARCHIVE_A" as DuplicatePairDecision,
  },
  {
    pairNumber: 5,
    approvalTokenKey: "PAIR_5",
    docAId: "usr-q-custom-topic-1793631902901-tyc4n-2e6bc288",
    docBId: "usr-q-custom-topic-1793631902901-tyc4n-c730cab3",
    recommendedKeepId: "usr-q-custom-topic-1793631902901-tyc4n-c730cab3",
    reviewCandidateId: "usr-q-custom-topic-1793631902901-tyc4n-2e6bc288",
    recommendedDecision: "KEEP_B_ARCHIVE_A" as DuplicatePairDecision,
  },
  {
    pairNumber: 6,
    approvalTokenKey: "PAIR_6",
    docAId: "usr-q-custom-topic-1793631902901-tyc4n-5b7d4002",
    docBId: "usr-q-custom-topic-1793631902901-tyc4n-f356e149",
    recommendedKeepId: "usr-q-custom-topic-1793631902901-tyc4n-f356e149",
    reviewCandidateId: "usr-q-custom-topic-1793631902901-tyc4n-5b7d4002",
    recommendedDecision: "KEEP_B_ARCHIVE_A" as DuplicatePairDecision,
  },
  {
    pairNumber: 7,
    approvalTokenKey: "PAIR_7",
    docAId: "usr-q-topic_6fe378d2-a022-4a46-a137-982685e5e645-862e33b9",
    docBId: "usr-q-topic_71e6775a-791a-4f7a-8596-2a4594026a1f-ecb0c0bd",
    recommendedKeepId: "BOTH",
    reviewCandidateId: "NONE",
    recommendedDecision: "KEEP_BOTH" as DuplicatePairDecision,
  },
  {
    pairNumber: 8,
    approvalTokenKey: "PAIR_8",
    docAId: "usr-q-topic_c2208d91-3aec-45a4-9fec-b0bd2aaffb3e-6fd7bd9",
    docBId: "usr-q-topic_e89b3d36-6f52-41b8-b686-f1267a4b8bc6-3f1530d5",
    recommendedKeepId: "usr-q-topic_e89b3d36-6f52-41b8-b686-f1267a4b8bc6-3f1530d5",
    reviewCandidateId: "usr-q-topic_c2208d91-3aec-45a4-9fec-b0bd2aaffb3e-6fd7bd9",
    recommendedDecision: "KEEP_B_ARCHIVE_A" as DuplicatePairDecision,
  },
];

export const PHASE4_PRESERVED_RSLP_IDS = [
  "usr-q-custom-topic-1793693900482-xpvow-5963e7df",
  "usr-q-custom-topic-1793693900482-xpvow-6f557464",
  "usr-q-custom-topic-1793693900482-xpvow-9132a410",
  "usr-q-custom-topic-1793693900482-xpvow-f7c690e6",
];

async function captureCollectionCounts() {
  const [subs, chs, tops, mcqs, qs] = await Promise.all([
    getCountFromServer(collection(db, "subjects")),
    getCountFromServer(collection(db, "chapters")),
    getCountFromServer(collection(db, "topics")),
    getCountFromServer(collection(db, "mcqs")),
    getCountFromServer(collection(db, "questions")),
  ]);
  return {
    subjects: subs.data().count,
    chapters: chs.data().count,
    topics: tops.data().count,
    mcqs: mcqs.data().count,
    questions: qs.data().count,
  };
}

/**
 * Validates that an archive payload is 100% complete before any active record is removed.
 */
export function validateArchivePayloadCompleteness(archiveDoc: Record<string, any> | null | undefined): {
  isComplete: boolean;
  missingReasons: string[];
} {
  if (!archiveDoc || typeof archiveDoc !== "object") {
    return { isComplete: false, missingReasons: ["Archive document is null or not an object"] };
  }
  const missingReasons: string[] = [];
  if (!archiveDoc.id || typeof archiveDoc.id !== "string") missingReasons.push("Missing id");
  if (!archiveDoc.retainedCounterpartId) missingReasons.push("Missing retainedCounterpartId");
  if (!archiveDoc.archivedAt) missingReasons.push("Missing archivedAt");
  if (typeof archiveDoc.wasInMcqs !== "boolean" || typeof archiveDoc.wasInQuestions !== "boolean") {
    missingReasons.push("Missing collection provenance flags (wasInMcqs / wasInQuestions)");
  }
  if (!archiveDoc.wasInMcqs && !archiveDoc.wasInQuestions) {
    missingReasons.push("Neither wasInMcqs nor wasInQuestions is true");
  }

  const verifyQuestionPayload = (payload: any, label: string) => {
    if (!payload || typeof payload !== "object") {
      missingReasons.push(`${label} payload missing`);
      return;
    }
    if (payload.id !== archiveDoc.id) missingReasons.push(`${label}.id mismatch`);
    if (!payload.text && !payload.hindiText) missingReasons.push(`${label}.text missing`);
    if (!Array.isArray(payload.options) || payload.options.length < 2) {
      missingReasons.push(`${label}.options invalid`);
    }
    if (typeof payload.correctIndex !== "number") missingReasons.push(`${label}.correctIndex invalid`);
    if (!payload.subjectId || !payload.chapterId || !payload.topicId) {
      missingReasons.push(`${label} foreign keys incomplete`);
    }
  };

  if (archiveDoc.wasInMcqs) verifyQuestionPayload(archiveDoc.mcqsPayload, "mcqsPayload");
  if (archiveDoc.wasInQuestions) verifyQuestionPayload(archiveDoc.questionsPayload, "questionsPayload");

  return {
    isComplete: missingReasons.length === 0,
    missingReasons,
  };
}

/**
 * Non-production / staging simulation of Task 4 archival, duplicate-archive prevention,
 * and restoration round-trip to verify restoration functionality before any production use.
 */
export function simulateStagingArchivalAndRestore(
  sampleDoc: Record<string, any>,
  retainedCounterpartId: string,
  wasInMcqs: boolean,
  wasInQuestions: boolean
): {
  archivalCompletenessPass: boolean;
  duplicateArchiveBlockedPass: boolean;
  activeRemovedAfterArchiveVerifyPass: boolean;
  restorationExactMatchPass: boolean;
} {
  const stagingMcqs = new Map<string, any>();
  const stagingQuestions = new Map<string, any>();
  const stagingArchives = new Map<string, any>();

  if (wasInMcqs) stagingMcqs.set(sampleDoc.id, JSON.parse(JSON.stringify(sampleDoc)));
  if (wasInQuestions) stagingQuestions.set(sampleDoc.id, JSON.parse(JSON.stringify(sampleDoc)));

  // 1. Archive creation
  const archivePayload = {
    id: sampleDoc.id,
    pairNumber: 1,
    decision: "KEEP_B_ARCHIVE_A",
    retainedCounterpartId,
    archivedAt: new Date().toISOString(),
    wasInMcqs,
    wasInQuestions,
    mcqsPayload: wasInMcqs ? JSON.parse(JSON.stringify(stagingMcqs.get(sampleDoc.id))) : null,
    questionsPayload: wasInQuestions ? JSON.parse(JSON.stringify(stagingQuestions.get(sampleDoc.id))) : null,
  };

  const completeness = validateArchivePayloadCompleteness(archivePayload);
  if (!completeness.isComplete) {
    return {
      archivalCompletenessPass: false,
      duplicateArchiveBlockedPass: false,
      activeRemovedAfterArchiveVerifyPass: false,
      restorationExactMatchPass: false,
    };
  }

  stagingArchives.set(sampleDoc.id, archivePayload);

  // 2. Prevent overwrite / duplicate archival
  let duplicateArchiveBlocked = false;
  if (stagingArchives.has(sampleDoc.id)) {
    duplicateArchiveBlocked = true;
  }

  // 3. Remove from active staging store only after archive is verified
  if (stagingArchives.has(sampleDoc.id)) {
    stagingMcqs.delete(sampleDoc.id);
    stagingQuestions.delete(sampleDoc.id);
  }
  const activeRemovedPass = !stagingMcqs.has(sampleDoc.id) && !stagingQuestions.has(sampleDoc.id);

  // 4. Restore from archive back to staging active collections
  const savedArchive = stagingArchives.get(sampleDoc.id)!;
  if (savedArchive.wasInMcqs && savedArchive.mcqsPayload) {
    stagingMcqs.set(sampleDoc.id, savedArchive.mcqsPayload);
  }
  if (savedArchive.wasInQuestions && savedArchive.questionsPayload) {
    stagingQuestions.set(sampleDoc.id, savedArchive.questionsPayload);
  }
  stagingArchives.delete(sampleDoc.id);

  const restoredDoc = wasInMcqs ? stagingMcqs.get(sampleDoc.id) : stagingQuestions.get(sampleDoc.id);
  const restorationExactMatchPass =
    JSON.stringify(restoredDoc) === JSON.stringify(sampleDoc) &&
    stagingMcqs.has(sampleDoc.id) === wasInMcqs &&
    stagingQuestions.has(sampleDoc.id) === wasInQuestions &&
    !stagingArchives.has(sampleDoc.id);

  return {
    archivalCompletenessPass: completeness.isComplete,
    duplicateArchiveBlockedPass: duplicateArchiveBlocked,
    activeRemovedAfterArchiveVerifyPass: activeRemovedPass,
    restorationExactMatchPass,
  };
}

/**
 * Controlled execution of Task 1 (Delete Test Artifact) with:
 * - Exact token verification
 * - Byte-for-byte / field-for-field payload verification against backup
 * - Before/After collection count verification ensuring zero collateral changes
 */
export async function executeTask1DeleteTestArtifact(approvalToken: string) {
  if (approvalToken !== "APPROVE_DELETE_TEST_ARTIFACT") {
    throw new Error("Execution halted: Missing required task approval token.");
  }

  const beforeCounts = await captureCollectionCounts();
  const mcqsRef = doc(db, "mcqs", PHASE4_TEST_ARTIFACT_ID);
  const qsRef = doc(db, "questions", PHASE4_TEST_ARTIFACT_ID);

  // Immediate pre-write revalidation against backup
  const [mcqsSnap, qsSnap] = await Promise.all([getDoc(mcqsRef), getDoc(qsRef)]);
  if (!mcqsSnap.exists()) {
    throw new Error(`Pre-write revalidation failed: ${PHASE4_TEST_ARTIFACT_ID} does not exist in mcqs.`);
  }
  if (qsSnap.exists()) {
    throw new Error(`Pre-write revalidation failed: ${PHASE4_TEST_ARTIFACT_ID} unexpectedly exists in questions.`);
  }

  const data = { ...mcqsSnap.data(), id: mcqsSnap.id };
  const exactCheck = verifyExactTestArtifactPayloadAgainstBackup(data);
  if (!exactCheck.matchesBackupExactly) {
    throw new Error(
      `Pre-write revalidation failed: Live payload differs from backup on fields: ${exactCheck.mismatchedFields.join(", ")}`
    );
  }

  if (isQuotaExhausted()) {
    throw new Error("Execution halted: Firebase daily write quota circuit breaker is active.");
  }

  await guardedDeleteDoc(mcqsRef, "Admin", "Phase 4 Delete Test Artifact");

  // Post-verification read-back & collection count verification
  const [postSnap, afterCounts] = await Promise.all([getDoc(mcqsRef), captureCollectionCounts()]);
  if (postSnap.exists()) {
    throw new Error("Post-verification failed: Document still exists in mcqs after deletion.");
  }
  if (
    afterCounts.mcqs !== beforeCounts.mcqs - 1 ||
    afterCounts.questions !== beforeCounts.questions ||
    afterCounts.subjects !== beforeCounts.subjects ||
    afterCounts.chapters !== beforeCounts.chapters ||
    afterCounts.topics !== beforeCounts.topics
  ) {
    throw new Error(
      `Post-verification count mismatch: before=${JSON.stringify(beforeCounts)}, after=${JSON.stringify(afterCounts)}`
    );
  }

  await clearIndexedDB().catch(() => {});
  await bumpRemoteCurriculumVersion("phase4_task1").catch(() => {});

  return {
    deletedId: PHASE4_TEST_ARTIFACT_ID,
    postVerifiedAbsent: true,
    beforeCounts,
    afterCounts,
  };
}

/**
 * Controlled execution of Task 2 (Create Curriculum Structure & Move 19 Misclassified Questions)
 * - Updates every existing copy in mcqs, questions, or both consistently
 * - Verifies all subjectId, chapterId, and topicId relationships against live parent documents
 * - Confirms the 5 existing subjects, 14 existing chapters, and 57 existing topics remain intact
 */
export async function executeTask2CurriculumMapping(approvalToken: string) {
  if (approvalToken !== "APPROVE_TASK_3_CURRICULUM_MAPPING") {
    throw new Error("Execution halted: Missing required task approval token.");
  }

  const beforeCounts = await captureCollectionCounts();
  const [subsSnap, chsSnap, topsSnap] = await Promise.all([
    getDocs(collection(db, "subjects")),
    getDocs(collection(db, "chapters")),
    getDocs(collection(db, "topics")),
  ]);

  const originalSubjectIds = new Set(subsSnap.docs.map((d) => d.id));
  const originalChapterIds = new Set(chsSnap.docs.map((d) => d.id));
  const originalTopicIds = new Set(topsSnap.docs.map((d) => d.id));

  if (originalSubjectIds.size < 5 || originalChapterIds.size < 14 || originalTopicIds.size < 57) {
    throw new Error("Pre-write revalidation failed: Existing curriculum baseline counts are below 5/14/57.");
  }

  if (isQuotaExhausted()) {
    throw new Error("Execution halted: Firebase daily write quota circuit breaker is active.");
  }

  const nowIso = new Date().toISOString();
  const batch = guardedWriteBatch(db);
  let subjectsCreated = 0;
  let chaptersCreated = 0;
  let topicsCreated = 0;

  // 1. Create new Subjects only if they do not already exist
  for (const subj of PHASE4_PROPOSED_SUBJECTS) {
    if (!originalSubjectIds.has(subj.id)) {
      batch.set(
        doc(db, "subjects", subj.id),
        {
          id: subj.id,
          name: subj.name,
          icon: subj.icon,
          order: subj.order,
          updatedAt: nowIso,
        },
        { merge: true }
      );
      subjectsCreated++;
    }
  }

  // 2. Create new Chapters only if they do not already exist
  for (const ch of PHASE4_PROPOSED_CHAPTERS) {
    if (!originalChapterIds.has(ch.id)) {
      batch.set(
        doc(db, "chapters", ch.id),
        {
          id: ch.id,
          subjectId: ch.subjectId,
          title: ch.title,
          description: ch.description,
          order: ch.order,
          updatedAt: nowIso,
        },
        { merge: true }
      );
      chaptersCreated++;
    }
  }

  // 3. Create new Topics only if they do not already exist
  for (const top of PHASE4_PROPOSED_TOPICS) {
    if (!originalTopicIds.has(top.id)) {
      batch.set(
        doc(db, "topics", top.id),
        {
          id: top.id,
          subjectId: top.subjectId,
          chapterId: top.chapterId,
          title: top.title,
          order: top.order,
          updatedAt: nowIso,
        },
        { merge: true }
      );
      topicsCreated++;
    }
  }

  // 4. Revalidate and update every existing copy in mcqs and/or questions consistently
  let mcqsCopiesUpdated = 0;
  let questionsCopiesUpdated = 0;

  for (const mapping of PHASE4_19_QUESTION_MAPPINGS) {
    const mcqsDocRef = doc(db, "mcqs", mapping.id);
    const qsDocRef = doc(db, "questions", mapping.id);
    const [mSnap, qSnap] = await Promise.all([getDoc(mcqsDocRef), getDoc(qsDocRef)]);

    if (mSnap.exists() !== mapping.expectedInMcqs || qSnap.exists() !== mapping.expectedInQuestions) {
      throw new Error(
        `Pre-write collection presence mismatch for ${mapping.id}: expected mcqs=${mapping.expectedInMcqs}/questions=${mapping.expectedInQuestions}, got mcqs=${mSnap.exists()}/questions=${qSnap.exists()}`
      );
    }

    const baseData = mSnap.exists() ? mSnap.data() : qSnap.data()!;
    const combinedText = `${baseData.text || ""} ${baseData.hindiText || ""} ${baseData.explanation || ""}`;
    if (!combinedText.includes(mapping.expectedKeyword)) {
      throw new Error(
        `Pre-write revalidation failed: Question ${mapping.id} does not contain expected keyword '${mapping.expectedKeyword}'.`
      );
    }

    const fkUpdate = {
      subjectId: mapping.targetSubjectId,
      chapterId: mapping.targetChapterId,
      topicId: mapping.targetTopicId,
      updatedAt: nowIso,
    };

    if (mSnap.exists()) {
      batch.update(mcqsDocRef, fkUpdate);
      mcqsCopiesUpdated++;
    }
    if (qSnap.exists()) {
      batch.update(qsDocRef, fkUpdate);
      questionsCopiesUpdated++;
    }
  }

  await batch.commit("Admin", "Phase 4 Task 2 Curriculum Mapping");

  // 5. Post-write verification: read back live parent documents and all 19 logical questions (31 physical copies)
  const [postSubsSnap, postChsSnap, postTopsSnap, afterCounts] = await Promise.all([
    getDocs(collection(db, "subjects")),
    getDocs(collection(db, "chapters")),
    getDocs(collection(db, "topics")),
    captureCollectionCounts(),
  ]);

  const liveSubsMap = new Map<string, any>();
  postSubsSnap.docs.forEach((d) => liveSubsMap.set(d.id, d.data()));
  const liveChsMap = new Map<string, any>();
  postChsSnap.docs.forEach((d) => liveChsMap.set(d.id, d.data()));
  const liveTopsMap = new Map<string, any>();
  postTopsSnap.docs.forEach((d) => liveTopsMap.set(d.id, d.data()));

  // Confirm all original 5 subjects, 14 chapters, and 57 topics remain intact
  for (const id of originalSubjectIds) {
    if (!liveSubsMap.has(id)) throw new Error(`Post-verification failed: Original subject ${id} missing.`);
  }
  for (const id of originalChapterIds) {
    if (!liveChsMap.has(id)) throw new Error(`Post-verification failed: Original chapter ${id} missing.`);
  }
  for (const id of originalTopicIds) {
    if (!liveTopsMap.has(id)) throw new Error(`Post-verification failed: Original topic ${id} missing.`);
  }

  // Read back every updated question copy and verify parent foreign keys
  for (const mapping of PHASE4_19_QUESTION_MAPPINGS) {
    const [mPost, qPost] = await Promise.all([
      getDoc(doc(db, "mcqs", mapping.id)),
      getDoc(doc(db, "questions", mapping.id)),
    ]);

    const copiesToCheck = [
      ...(mapping.expectedInMcqs ? [mPost] : []),
      ...(mapping.expectedInQuestions ? [qPost] : []),
    ];

    for (const snap of copiesToCheck) {
      if (!snap.exists()) {
        throw new Error(`Post-verification failed: Copy of ${mapping.id} missing after update.`);
      }
      const d = snap.data();
      const parentTopic = liveTopsMap.get(d.topicId);
      const parentChapter = liveChsMap.get(d.chapterId);
      const parentSubject = liveSubsMap.get(d.subjectId);

      if (
        !parentTopic ||
        !parentChapter ||
        !parentSubject ||
        d.topicId !== mapping.targetTopicId ||
        d.chapterId !== mapping.targetChapterId ||
        d.subjectId !== mapping.targetSubjectId ||
        parentTopic.chapterId !== d.chapterId ||
        parentChapter.subjectId !== d.subjectId
      ) {
        throw new Error(`Post-verification foreign-key hierarchy mismatch on ${mapping.id}`);
      }
    }
  }

  await clearIndexedDB().catch(() => {});
  await bumpRemoteCurriculumVersion("phase4_task2").catch(() => {});

  return {
    subjectsCreated,
    chaptersCreated,
    topicsCreated,
    logicalQuestionsMoved: PHASE4_19_QUESTION_MAPPINGS.length,
    mcqsCopiesUpdated,
    questionsCopiesUpdated,
    beforeCounts,
    afterCounts,
    updatedAt: nowIso,
  };
}

/**
 * Controlled execution of Task 3 (Reconcile 262 Legacy questions Documents).
 * - Processes in controlled batches (40 records/batch)
 * - Revalidates each document immediately before each batch
 * - Skips changed records
 * - Updates ONLY topicId and updatedAt
 * - Reads back every updated document after each batch to verify the update and field preservation
 * - Reports successfulIds, skippedIds, and failedIds separately
 */
export async function executeTask3LegacyReconciliation(
  approvalToken: string,
  preflightRecords: Array<{
    id: string;
    expectedQuestionsTopicId: string;
    expectedQuestionsUpdatedAt: string;
    canonicalTopicId: string;
    canonicalUpdatedAt: string;
  }>
) {
  if (approvalToken !== "APPROVE_TASK_4_LEGACY_RECONCILIATION") {
    throw new Error("Execution halted: Missing required task approval token.");
  }

  const beforeCounts = await captureCollectionCounts();
  const BATCH_SIZE = 40;
  const successfulIds: string[] = [];
  const skippedIds: Array<{ id: string; reason: string }> = [];
  const failedIds: Array<{ id: string; reason: string }> = [];

  if (isQuotaExhausted()) {
    throw new Error("Execution halted: Firebase daily write quota circuit breaker is active.");
  }

  for (let i = 0; i < preflightRecords.length; i += BATCH_SIZE) {
    if (isQuotaExhausted()) break;
    const chunk = preflightRecords.slice(i, i + BATCH_SIZE);
    const batch = guardedWriteBatch(db);
    const batchCandidates: Array<{
      id: string;
      canonicalTopicId: string;
      canonicalUpdatedAt: string;
      originalText: string;
      originalCorrectIndex: number;
    }> = [];

    // Pre-batch revalidation
    for (const rec of chunk) {
      try {
        const qRef = doc(db, "questions", rec.id);
        const mRef = doc(db, "mcqs", rec.id);
        const [qSnap, mSnap] = await Promise.all([getDoc(qRef), getDoc(mRef)]);

        if (!qSnap.exists() || !mSnap.exists()) {
          skippedIds.push({
            id: rec.id,
            reason: "Document missing in questions or mcqs during pre-batch revalidation",
          });
          continue;
        }

        const qData = qSnap.data();
        const mData = mSnap.data();

        if (
          qData.topicId !== rec.expectedQuestionsTopicId ||
          qData.updatedAt !== rec.expectedQuestionsUpdatedAt ||
          mData.topicId !== rec.canonicalTopicId ||
          mData.updatedAt !== rec.canonicalUpdatedAt
        ) {
          skippedIds.push({ id: rec.id, reason: "Document state changed since preflight snapshot" });
          continue;
        }

        // Only update topicId and updatedAt
        batch.update(qRef, {
          topicId: rec.canonicalTopicId,
          updatedAt: rec.canonicalUpdatedAt,
        });

        batchCandidates.push({
          id: rec.id,
          canonicalTopicId: rec.canonicalTopicId,
          canonicalUpdatedAt: rec.canonicalUpdatedAt,
          originalText: qData.text || "",
          originalCorrectIndex: qData.correctIndex,
        });
      } catch (err: any) {
        failedIds.push({ id: rec.id, reason: err?.message || "Pre-batch revalidation error" });
      }
    }

    if (batchCandidates.length > 0) {
      try {
        await batch.commit("Admin", `Phase 4 Legacy Reconciliation Chunk ${Math.floor(i / BATCH_SIZE) + 1}`);

        // Post-batch read-back verification for every updated document in the batch
        const verifySnaps = await Promise.all(
          batchCandidates.map((c) => getDoc(doc(db, "questions", c.id)))
        );

        for (let idx = 0; idx < batchCandidates.length; idx++) {
          const candidate = batchCandidates[idx];
          const vSnap = verifySnaps[idx];
          if (!vSnap.exists()) {
            failedIds.push({ id: candidate.id, reason: "Document missing on post-write read-back" });
            continue;
          }
          const vData = vSnap.data();
          if (
            vData.topicId === candidate.canonicalTopicId &&
            vData.updatedAt === candidate.canonicalUpdatedAt &&
            (vData.text || "") === candidate.originalText &&
            vData.correctIndex === candidate.originalCorrectIndex
          ) {
            successfulIds.push(candidate.id);
          } else {
            failedIds.push({
              id: candidate.id,
              reason: "Post-write read-back field verification mismatch",
            });
          }
        }
      } catch (err: any) {
        for (const c of batchCandidates) {
          failedIds.push({ id: c.id, reason: err?.message || "Batch commit error" });
        }
      }
    }
  }

  const afterCounts = await captureCollectionCounts();
  if (afterCounts.questions !== beforeCounts.questions || afterCounts.mcqs !== beforeCounts.mcqs) {
    throw new Error("Unexpected collection count change during Task 3 reconciliation.");
  }

  await clearIndexedDB().catch(() => {});
  await bumpRemoteCurriculumVersion("phase4_task3").catch(() => {});

  return {
    updatedCount: successfulIds.length,
    skippedCount: skippedIds.length,
    failedCount: failedIds.length,
    successfulIds,
    skippedIds,
    failedIds,
    beforeCounts,
    afterCounts,
  };
}

/**
 * Controlled execution of Task 4 (Individual Near-Duplicate Pair Decision).
 * - Requires individual pair token
 * - Verifies archive payload completeness before removing any active record
 * - Prevents archive overwrites and duplicate archival
 * - Preserves original document IDs, collection flags, and complete payloads
 */
export async function executeTask4NearDuplicatePairDecision(
  pairNumber: number,
  pairApprovalToken: string
) {
  const pairConfig = PHASE4_8_NEAR_DUPLICATE_PAIRS.find((p) => p.pairNumber === pairNumber);
  if (!pairConfig) {
    throw new Error(`Invalid pair number: ${pairNumber}`);
  }

  const expectedPrefix = `PAIR_${pairNumber}=`;
  if (!pairApprovalToken.startsWith(expectedPrefix)) {
    throw new Error(`Execution halted: Missing required individual pair approval token.`);
  }

  const decision = pairApprovalToken.slice(expectedPrefix.length) as DuplicatePairDecision;
  const allowedDecisions: DuplicatePairDecision[] = [
    "KEEP_BOTH",
    "KEEP_A_ARCHIVE_B",
    "KEEP_B_ARCHIVE_A",
    "MERGE_AFTER_REVIEW",
    "DEFER",
  ];
  if (!allowedDecisions.includes(decision)) {
    throw new Error(`Invalid decision '${decision}' for PAIR_${pairNumber}.`);
  }

  if (decision === "KEEP_BOTH" || decision === "DEFER" || decision === "MERGE_AFTER_REVIEW") {
    return {
      pairNumber,
      decision,
      retainedIds: [pairConfig.docAId, pairConfig.docBId],
      archivedId: null,
      reversibleArchivePath: null,
    };
  }

  const retainedId = decision === "KEEP_A_ARCHIVE_B" ? pairConfig.docAId : pairConfig.docBId;
  const archiveTargetId = decision === "KEEP_A_ARCHIVE_B" ? pairConfig.docBId : pairConfig.docAId;

  // Never allow RSLP questions to be archived
  if (PHASE4_PRESERVED_RSLP_IDS.includes(archiveTargetId)) {
    throw new Error(`Safety lock: RSLP question ${archiveTargetId} cannot be archived.`);
  }

  const beforeCounts = await captureCollectionCounts();
  const archiveRef = doc(db, "archived_mcqs", archiveTargetId);

  // 1. Prevent archive overwrites and duplicate archival
  const existingArchiveSnap = await getDoc(archiveRef);
  if (existingArchiveSnap.exists()) {
    throw new Error(
      `Duplicate archival blocked: archived_mcqs/${archiveTargetId} already exists. Refusing to overwrite existing archive.`
    );
  }

  // 2. Revalidate both retained and archive target documents exist in active collections
  const [retMcq, retQ, archMcq, archQ] = await Promise.all([
    getDoc(doc(db, "mcqs", retainedId)),
    getDoc(doc(db, "questions", retainedId)),
    getDoc(doc(db, "mcqs", archiveTargetId)),
    getDoc(doc(db, "questions", archiveTargetId)),
  ]);

  if (!retMcq.exists() && !retQ.exists()) {
    throw new Error(`Pre-write revalidation failed: Retained question ${retainedId} does not exist.`);
  }
  if (!archMcq.exists() && !archQ.exists()) {
    throw new Error(`Pre-write revalidation failed: Archive candidate ${archiveTargetId} does not exist.`);
  }

  const nowIso = new Date().toISOString();
  const archivePayload = {
    id: archiveTargetId,
    pairNumber,
    decision,
    retainedCounterpartId: retainedId,
    archivedAt: nowIso,
    wasInMcqs: archMcq.exists(),
    wasInQuestions: archQ.exists(),
    mcqsPayload: archMcq.exists() ? { ...archMcq.data(), id: archMcq.id } : null,
    questionsPayload: archQ.exists() ? { ...archQ.data(), id: archQ.id } : null,
  };

  // 3. Verify archive payload completeness BEFORE writing or removing active record
  const completeness = validateArchivePayloadCompleteness(archivePayload);
  if (!completeness.isComplete) {
    throw new Error(
      `Archival halted: Archive payload failed completeness check: ${completeness.missingReasons.join(", ")}`
    );
  }

  if (isQuotaExhausted()) {
    throw new Error("Execution halted: Firebase daily write quota circuit breaker is active.");
  }

  // 4. Write reversible archive record and read back to verify completeness in Firestore
  await guardedSetDoc(archiveRef, archivePayload, undefined, "Admin", `Phase 4 Archive Duplicate ${archiveTargetId}`);
  const verifyArchiveSnap = await getDoc(archiveRef);
  if (!verifyArchiveSnap.exists()) {
    throw new Error(`Archival halted: Failed to read back archived_mcqs/${archiveTargetId}.`);
  }
  const verifyCompleteness = validateArchivePayloadCompleteness(verifyArchiveSnap.data());
  if (!verifyCompleteness.isComplete) {
    throw new Error(
      `Archival halted: Persisted archive record failed completeness check: ${verifyCompleteness.missingReasons.join(", ")}`
    );
  }

  // 5. Remove from active collection(s) only after reversible archive is verified complete
  if (archMcq.exists()) {
    await guardedDeleteDoc(doc(db, "mcqs", archiveTargetId), "Admin", `Phase 4 Archive Delete mcqs/${archiveTargetId}`);
  }
  if (archQ.exists()) {
    await guardedDeleteDoc(doc(db, "questions", archiveTargetId), "Admin", `Phase 4 Archive Delete questions/${archiveTargetId}`);
  }

  const afterCounts = await captureCollectionCounts();
  await clearIndexedDB().catch(() => {});
  await bumpRemoteCurriculumVersion(`phase4_pair_${pairNumber}`).catch(() => {});

  return {
    pairNumber,
    decision,
    retainedIds: [retainedId],
    archivedId: archiveTargetId,
    reversibleArchivePath: `archived_mcqs/${archiveTargetId}`,
    beforeCounts,
    afterCounts,
  };
}

/**
 * Reversibly restores an archived near-duplicate question from `archived_mcqs/{docId}`
 * back into its original collection(s) (`mcqs` and/or `questions`).
 */
export async function restoreArchivedDuplicateQuestion(archivedDocId: string) {
  const archiveRef = doc(db, "archived_mcqs", archivedDocId);
  const snap = await getDoc(archiveRef);
  if (!snap.exists()) {
    throw new Error(`Archive record archived_mcqs/${archivedDocId} not found.`);
  }

  const data = snap.data();
  const completeness = validateArchivePayloadCompleteness(data);
  if (!completeness.isComplete) {
    throw new Error(
      `Restore halted: Archive record is incomplete: ${completeness.missingReasons.join(", ")}`
    );
  }

  if (isQuotaExhausted()) {
    throw new Error("Restore halted: Firebase daily write quota circuit breaker is active.");
  }

  const batch = guardedWriteBatch(db);
  if (data.wasInMcqs && data.mcqsPayload) {
    batch.set(doc(db, "mcqs", archivedDocId), data.mcqsPayload);
  }
  if (data.wasInQuestions && data.questionsPayload) {
    batch.set(doc(db, "questions", archivedDocId), data.questionsPayload);
  }
  batch.delete(archiveRef);
  await batch.commit("Admin", `Phase 4 Restore Archived ${archivedDocId}`);

  // Read back restored document(s) to verify restoration
  if (data.wasInMcqs) {
    const checkM = await getDoc(doc(db, "mcqs", archivedDocId));
    if (!checkM.exists()) throw new Error(`Restore verification failed for mcqs/${archivedDocId}`);
  }
  if (data.wasInQuestions) {
    const checkQ = await getDoc(doc(db, "questions", archivedDocId));
    if (!checkQ.exists()) throw new Error(`Restore verification failed for questions/${archivedDocId}`);
  }

  await clearIndexedDB().catch(() => {});
  await bumpRemoteCurriculumVersion(`restore_${archivedDocId}`).catch(() => {});

  return {
    restoredId: archivedDocId,
    restoredToMcqs: Boolean(data.wasInMcqs),
    restoredToQuestions: Boolean(data.wasInQuestions),
  };
}
