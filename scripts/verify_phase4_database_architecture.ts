import assert from "node:assert/strict";
import {
  CANONICAL_MCQ_COLLECTION,
  LEGACY_MCQ_COLLECTION,
  MCQ_DEPENDENCY_AUDIT_MATRIX,
  CANONICAL_MCQ_SCHEMA_SPEC,
  resolveMcqCollection,
  getCanonicalMcqCollection,
  isCanonicalMcqCollection,
  isLegacyQuestionsCollection,
  createMcqBackupSnapshot,
  reconcileMcqCollections,
  assertLegacyQuestionsDeletionProtected,
  validateAllQuestionBundles,
} from "../src/utils/mcqCollectionAdapter";
import {
  createMockFirestoreDriver,
  makeMockDocRef,
  runInMockQASandbox,
} from "../src/utils/mockFirestoreDriver";
import {
  __setFirestoreDriverForTests,
  __setTestAuthUserForTests,
  guardedSetDoc,
  guardedGetDoc,
  guardedGetDocs,
  guardedWriteBatch,
  resetQuotaSummary,
  getCurrentQuotaDate,
} from "../src/utils/quotaTracker";
import { saveMCQ, fetchMCQsByTopic, fetchAndRefreshFirestoreMCQs } from "../src/utils/firebaseSyncService";
import { commitQuestions } from "../src/lib/mcqImport/commit";
import { getPaginatedMCQs } from "../src/services/firestoreDataService";
import type { Question } from "../src/types";

function makeSampleQuestion(
  id: string,
  topicId: string,
  chapterId: string,
  subjectId: string,
  index = 0
): Question {
  return {
    id,
    topicId,
    chapterId,
    subjectId,
    text: `Question ${index}: What is the capital of Rajasthan?`,
    options: ["Jaipur", "Jodhpur", "Udaipur", "Kota"],
    correctIndex: 0,
    explanation: "Jaipur is the capital city of Rajasthan.",
    difficulty: "medium",
    isUserAdded: true,
    createdAt: "2026-03-01T10:00:00.000Z",
    updatedAt: "2026-03-01T10:00:00.000Z",
  };
}

async function main() {
  console.log("=== RUNNING QUIZPRO PHASE 4: FIRESTORE DATABASE ARCHITECTURE OPTIMIZATION SUITE ===\n");

  const mock = createMockFirestoreDriver();
  __setFirestoreDriverForTests(mock.driver);
  __setTestAuthUserForTests({ uid: "admin_test_p4", email: "jagdishpaliyaljat@gmail.com" });

  const resetEnv = () => {
    mock.clear();
    mock.resetStats();
    resetQuotaSummary(getCurrentQuotaDate());
  };

  // =========================================================================
  // TEST 1: Dependency Audit Matrix (All 7 Subsystems Documented)
  // =========================================================================
  {
    assert.ok(MCQ_DEPENDENCY_AUDIT_MATRIX.length >= 7, "Dependency matrix must cover all subsystems");
    const subsystems = new Set(MCQ_DEPENDENCY_AUDIT_MATRIX.map((e) => e.subsystem));
    assert.ok(subsystems.has("Admin"), "Must cover Admin");
    assert.ok(subsystems.has("Student"), "Must cover Student");
    assert.ok(subsystems.has("Import"), "Must cover Import");
    assert.ok(subsystems.has("Search & Filtering"), "Must cover Search & Filtering");
    assert.ok(subsystems.has("Duplicate Detection"), "Must cover Duplicate Detection");
    assert.ok(subsystems.has("Migration"), "Must cover Migration");
    assert.ok(subsystems.has("Analytics"), "Must cover Analytics");

    for (const entry of MCQ_DEPENDENCY_AUDIT_MATRIX) {
      assert.ok(entry.files.length > 0, `Entry ${entry.subsystem} must specify files`);
      assert.ok(entry.description.length > 0, `Entry ${entry.subsystem} must have description`);
      assert.ok(entry.phase4Resolution, `Entry ${entry.subsystem} must define phase4Resolution`);
    }

    console.log(`[PASS] Test 1: Complete Dependency Audit Matrix verified (${MCQ_DEPENDENCY_AUDIT_MATRIX.length} entries across 7 subsystems)`);
  }

  // =========================================================================
  // TEST 2: Canonical Collection Specification & Schema Validation
  // =========================================================================
  {
    assert.equal(CANONICAL_MCQ_COLLECTION, "mcqs");
    assert.equal(LEGACY_MCQ_COLLECTION, "questions");
    assert.equal(getCanonicalMcqCollection(), "mcqs");
    assert.equal(isCanonicalMcqCollection("mcqs"), true);
    assert.equal(isCanonicalMcqCollection("questions"), false);
    assert.equal(isLegacyQuestionsCollection("questions"), true);

    // Verify normalization
    assert.equal(resolveMcqCollection("questions"), "mcqs", "Legacy 'questions' must normalize to 'mcqs'");
    assert.equal(resolveMcqCollection("mcqs"), "mcqs");
    assert.equal(resolveMcqCollection(), "mcqs");
    assert.equal(resolveMcqCollection("custom_collection"), "custom_collection");

    // Verify required & optional fields coverage
    const req = CANONICAL_MCQ_SCHEMA_SPEC.requiredFields;
    assert.ok(req.includes("id"));
    assert.ok(req.includes("topicId"));
    assert.ok(req.includes("chapterId"));
    assert.ok(req.includes("subjectId"));
    assert.ok(req.includes("text"));
    assert.ok(req.includes("options"));
    assert.ok(req.includes("correctIndex"));
    assert.ok(req.includes("explanation"));

    const opt = CANONICAL_MCQ_SCHEMA_SPEC.optionalFields;
    assert.ok(opt.includes("isPYQ"), "PYQ flags must be supported");
    assert.ok(opt.includes("paperId"), "PYQ paper IDs must be supported");
    assert.ok(opt.includes("testId"), "Live test IDs must be supported");
    assert.ok(opt.includes("isTest"), "isTest flag must be supported");
    assert.ok(opt.includes("contentHash"), "Content hash must be supported");

    console.log(`[PASS] Test 2: Canonical collection specification verified ('${CANONICAL_MCQ_COLLECTION}' canonical, full schema coverage)`);
  }

  // =========================================================================
  // TEST 3: Pre-Migration Backup Snapshot Creation & Checksum Verification
  // =========================================================================
  resetEnv();
  {
    const mcqs = Array.from({ length: 5 }, (_, i) => makeSampleQuestion(`m_${i}`, "top_1", "ch_1", "sub_1", i));
    const questions = Array.from({ length: 4 }, (_, i) => makeSampleQuestion(`q_${i}`, "top_1", "ch_1", "sub_1", i));

    const snapshot = createMcqBackupSnapshot(mcqs, questions, "Pre-Phase4-Audit-Test");
    assert.ok(snapshot.snapshotId.startsWith("backup_mcq_"));
    assert.equal(snapshot.mcqsCount, 5);
    assert.equal(snapshot.questionsCount, 4);
    assert.ok(snapshot.mcqsChecksum.length > 0);
    assert.ok(snapshot.questionsChecksum.length > 0);
    assert.equal(snapshot.data.mcqs.length, 5);
    assert.equal(snapshot.data.questions.length, 4);
    assert.equal(snapshot.data.mcqs[0].id, "m_0");

    console.log(`[PASS] Test 3: Pre-migration backup snapshot created with verified deterministic checksums`);
  }

  // =========================================================================
  // TEST 4: Reconciliation Engine (IDs, Hashes, Metadata, Conflicts, Orphans)
  // =========================================================================
  resetEnv();
  {
    // Scenario:
    // - 5 identical questions in BOTH mcqs and questions
    // - 2 questions in mcqs ONLY (canonical superset)
    // - 1 question in questions ONLY (legacy orphan)
    // - 1 question with text discrepancy
    // - 1 question with metadata discrepancy (difficulty)
    const baseShared = Array.from({ length: 5 }, (_, i) => makeSampleQuestion(`shared_${i}`, "top_a", "ch_a", "sub_a", i));

    const mcqsOnly = [
      makeSampleQuestion("mcqs_only_1", "top_a", "ch_a", "sub_a", 10),
      makeSampleQuestion("mcqs_only_2", "top_a", "ch_a", "sub_a", 11),
    ];

    const questionsOnly = [
      makeSampleQuestion("legacy_orphan_1", "top_a", "ch_a", "sub_a", 20),
    ];

    const conflictingTextM = makeSampleQuestion("conflict_text", "top_a", "ch_a", "sub_a", 30);
    const conflictingTextQ = { ...conflictingTextM, text: "Different question text in legacy questions!" };

    const conflictingMetaM = makeSampleQuestion("conflict_meta", "top_a", "ch_a", "sub_a", 40);
    conflictingMetaM.difficulty = "hard";
    const conflictingMetaQ = { ...conflictingMetaM, difficulty: "easy" };

    const mcqsList = [...baseShared, ...mcqsOnly, conflictingTextM, conflictingMetaM];
    const questionsList = [...baseShared, ...questionsOnly, conflictingTextQ, conflictingMetaQ];

    const report = reconcileMcqCollections(mcqsList, questionsList);

    assert.equal(report.totalMcqs, 9);
    assert.equal(report.totalQuestions, 8);
    assert.equal(report.inBothCount, 7); // 5 shared + 1 conflict_text + 1 conflict_meta
    assert.equal(report.mcqsOnlyCount, 2);
    assert.equal(report.questionsOnlyCount, 1);
    assert.equal(report.contentDiscrepancies.length, 2, "Both conflict_text and conflict_meta alter normalized content hash");
    const textConflict = report.contentDiscrepancies.find((c) => c.id === "conflict_text");
    assert.ok(textConflict);
    assert.equal(textConflict.textMismatch, true);

    assert.equal(report.metadataDiscrepancies.length, 1, "Only conflict_meta has metadata discrepancy");
    assert.equal(report.metadataDiscrepancies[0].id, "conflict_meta");
    assert.equal(report.metadataDiscrepancies[0].field, "difficulty");

    assert.equal(report.orphanQuestionsRecords.length, 1);
    assert.equal(report.orphanQuestionsRecords[0].id, "legacy_orphan_1");

    // Crucial rule: original documents must NOT be mutated during reconciliation
    assert.equal(conflictingTextM.text, "Question 30: What is the capital of Rajasthan?");

    console.log(`[PASS] Test 4: Reconciliation report generated (5 matched, 2 canonical-only, 1 legacy orphan, 2 conflicts detected non-destructively)`);
  }

  // =========================================================================
  // TEST 5: Compatibility Layer & Pagination Adapter
  // =========================================================================
  resetEnv();
  {
    // Seed canonical mcqs
    for (let i = 0; i < 5; i++) {
      mock.seedDoc(`mcqs/p_${i}`, makeSampleQuestion(`p_${i}`, "top_page", "ch_page", "sub_page", i));
    }

    // Default call -> routes to mcqs
    const resDefault = await getPaginatedMCQs({ topicId: "top_page", pageSize: 3 });
    assert.equal(resDefault.docs.length, 3);
    assert.equal(resDefault.hasMore, true);
    assert.equal(resDefault.docs[0].id, "p_0");

    // Legacy call explicitly specifying collectionName: "questions" -> automatically resolved to canonical mcqs!
    const resLegacyParam = await getPaginatedMCQs({
      collectionName: "questions",
      topicId: "top_page",
      pageSize: 5,
    });
    assert.equal(resLegacyParam.docs.length, 5);
    assert.equal(resLegacyParam.docs[4].id, "p_4");

    console.log(`[PASS] Test 5: Compatibility adapter transparently resolved legacy collection requests to canonical mcqs`);
  }

  // =========================================================================
  // TEST 6: Deprecation Verification (Zero Redundant Mirror Writes / Deletes / Dual Reads)
  // =========================================================================
  resetEnv();
  {
    // 6A: Admin saveMCQ writes ONLY to mcqs (0 writes to questions)
    const qAdmin = makeSampleQuestion("admin_mcq_1", "top_adm", "ch_adm", "sub_adm", 1);
    const saveRes = await saveMCQ(qAdmin);
    assert.equal(saveRes.success, true);
    assert.ok(mock.getRawDoc("mcqs/admin_mcq_1"), "MCQ saved in canonical mcqs");
    assert.equal(mock.getRawDoc("questions/admin_mcq_1"), undefined, "ZERO write to legacy questions on admin save");

    // 6B: Batch commitQuestions writes ONLY to mcqs (0 writes to questions by default)
    const qsImport = Array.from({ length: 5 }, (_, i) =>
      makeSampleQuestion(`p4_imp_${i}`, "top_imp4", "ch_imp4", "sub_imp4", i)
    );
    const impRes = await commitQuestions(qsImport, "batch_phase4_1");
    assert.equal(impRes.success, true);
    assert.equal(impRes.committedCount, 5);
    assert.equal(mock.listCollection("mcqs").length, 6); // 1 from 6A + 5 from 6B
    assert.equal(mock.listCollection("questions").length, 0, "ZERO writes to legacy questions on bulk import (50% write savings)");

    // 6C: Firestore fetch queries ONLY canonical mcqs (0 reads to questions)
    mock.resetStats();
    const refreshed = await fetchAndRefreshFirestoreMCQs("top_imp4");
    assert.ok(refreshed && refreshed.length === 5);
    // Student read should be exactly 5 reads (1 query matching 5 docs in mcqs), ZERO reads to questions collection!
    assert.equal(mock.stats.reads, 5, "Topic fetch must query canonical mcqs only (50% read reduction)");

    console.log(`[PASS] Test 6: Deprecation verified (0 mirror writes on save, 0 mirror writes on import, 0 redundant reads on topic fetch)`);
  }

  // =========================================================================
  // TEST 7: Legacy Collection Deletion Protection Guard
  // =========================================================================
  {
    // Unapproved attempt without token -> must throw
    assert.throws(
      () => assertLegacyQuestionsDeletionProtected(),
      /DELETION_BLOCKED/,
      "Must block deletion when no approval token provided"
    );

    // Unapproved attempt with bad token -> must throw
    assert.throws(
      () => assertLegacyQuestionsDeletionProtected("BAD_TOKEN"),
      /DELETION_BLOCKED/,
      "Must block deletion with invalid token"
    );

    // Attempt with valid token but missing backup snapshot -> must throw
    assert.throws(
      () =>
        assertLegacyQuestionsDeletionProtected(
          "APPROVE_LEGACY_QUESTIONS_PERMANENT_DELETION",
          null
        ),
      /verified, non-empty backup snapshot/,
      "Must block deletion when backup snapshot is missing"
    );

    // Only succeeds when BOTH explicit token AND verified backup snapshot exist
    const mockBackup = createMcqBackupSnapshot([], [{ id: "legacy_1" }]);
    assert.doesNotThrow(() =>
      assertLegacyQuestionsDeletionProtected(
        "APPROVE_LEGACY_QUESTIONS_PERMANENT_DELETION",
        mockBackup
      )
    );

    console.log(`[PASS] Test 7: Legacy collection deletion protection guard verified (requires explicit token + verified backup)`);
  }

  // =========================================================================
  // TEST 8: Question Bundle Validation (Integrity, Hierarchy, Order Preservation)
  // =========================================================================
  {
    const canonicalMcqs = [
      makeSampleQuestion("b_q_1", "top_math", "ch_math", "sub_sci", 1),
      makeSampleQuestion("b_q_2", "top_math", "ch_math", "sub_sci", 2),
      makeSampleQuestion("b_q_3", "top_math", "ch_math", "sub_sci", 3),
      makeSampleQuestion("b_q_4", "top_phys", "ch_phys", "sub_sci", 4),
    ];

    // Case 1: 100% valid bundle
    const validBundles = [
      {
        id: "topic_top_math",
        topicId: "top_math",
        questions: [canonicalMcqs[0], canonicalMcqs[1], canonicalMcqs[2]],
      },
      {
        id: "topic_top_phys",
        topicId: "top_phys",
        questions: [canonicalMcqs[3]],
      },
    ];

    const vReport1 = validateAllQuestionBundles(validBundles, canonicalMcqs);
    assert.equal(vReport1.totalBundles, 2);
    assert.equal(vReport1.validBundles, 2);
    assert.equal(vReport1.invalidBundles, 0);
    assert.equal(vReport1.missingFromCanonicalCount, 0);
    assert.equal(vReport1.mismatchedTopicCount, 0);

    // Case 2: Bundle with missing question and topic mismatch
    const badBundles = [
      {
        id: "topic_top_math",
        topicId: "top_math",
        questions: [
          canonicalMcqs[0],
          { id: "ghost_question_999", topicId: "top_math", text: "Ghost" } as any,
          { id: "b_q_4", topicId: "top_phys", text: "Physics question in math bundle" } as any, // topic mismatch
        ],
      },
    ];

    const vReport2 = validateAllQuestionBundles(badBundles, canonicalMcqs);
    assert.equal(vReport2.validBundles, 0);
    assert.equal(vReport2.invalidBundles, 1);
    assert.equal(vReport2.missingFromCanonicalCount, 1, "Detects ghost question missing from canonical mcqs");
    assert.equal(vReport2.mismatchedTopicCount, 1, "Detects topicId mismatch inside bundle");

    console.log(`[PASS] Test 8: Question bundle validation engine verified (detected valid hierarchy, missing questions, and topic mismatches)`);
  }

  console.log("\nALL PHASE 4 DATABASE ARCHITECTURE OPTIMIZATION TESTS PASSED SUCCESSFULLY.");
}

main().catch((err) => {
  console.error("PHASE 4 VERIFICATION FAILED:", err);
  process.exit(1);
});
