import assert from "node:assert/strict";

// In-memory localStorage + window shims BEFORE importing app modules
const store = new Map<string, string>();
const localStorageShim = {
  getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
  setItem: (k: string, v: string) => {
    store.set(k, String(v));
  },
  removeItem: (k: string) => {
    store.delete(k);
  },
  clear: () => store.clear(),
  key: (idx: number) => Array.from(store.keys())[idx] ?? null,
  get length() {
    return store.size;
  },
};

(globalThis as any).localStorage = localStorageShim;
if (typeof (globalThis as any).window === "undefined") {
  (globalThis as any).window = {
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => true,
  };
}

function makeSampleQuestion(id: string, topicId: string, chapterId: string, subjectId: string, idx: number) {
  return {
    id,
    topicId,
    chapterId,
    subjectId,
    text: `Question ${idx} (${id}) about Rajasthan Economics & Governance?`,
    options: [`Option A ${idx}`, `Option B ${idx}`, `Option C ${idx}`, `Option D ${idx}`],
    correctIndex: idx % 4,
    explanation: `Detailed explanation #${idx} for ${id}.`,
    difficulty: "medium" as const,
  };
}

async function main() {
  const quotaTracker = await import("../src/utils/quotaTracker");
  const mockDriverMod = await import("../src/utils/mockFirestoreDriver");
  const bulkSyncMod = await import("../src/utils/bulkSyncService");
  const versionMod = await import("../src/utils/appVersionService");
  const bundleMod = await import("../src/utils/questionBundleService");
  const syncServiceMod = await import("../src/utils/firebaseSyncService");
  const commitMod = await import("../src/lib/mcqImport/commit");
  const questionsStorageMod = await import("../src/utils/questionsStorage");

  const {
    __setFirestoreDriverForTests,
    __setTestAuthUserForTests,
    __resetInMemoryStateForTests,
    clearPendingWrites,
    clearCommittedIdempotencyKeys,
    resetQuotaSummary,
    getQuotaSummary,
    saveQuotaSummary,
    getCurrentQuotaDate,
    isQuotaExhausted,
    setQuotaExhausted,
    recordUsage,
    guardedSetDoc,
    guardedWriteBatch,
  } = quotaTracker;

  const { createMockFirestoreDriver, runInMockQASandbox } = mockDriverMod;
  const { executeBulkSync } = bulkSyncMod;
  const {
    bumpRemoteCurriculumVersion,
    processPendingVersionBumps,
    getPendingVersionBumps,
    clearPendingVersionBumps,
    __resetVersionServiceCacheForTests,
  } = versionMod;
  const {
    prepareVerifiedBundlePayload,
    verifyBundleConsistency,
    saveQuestionBundleForTopic,
    packAllQuestionsIntoTopicBundles,
    clearSyncedBundleHashes,
  } = bundleMod;
  const {
    deleteSubjectFromCloud,
    deleteChapterFromCloud,
    deleteTopicFromCloud,
    purgeAllTestAndMockCloudData,
  } = syncServiceMod;
  const { commitQuestions, undoImportBatch } = commitMod;
  const { saveUserQuestionsStore } = questionsStorageMod;

  let activeMock = createMockFirestoreDriver();

  function resetEnv() {
    localStorageShim.clear();
    saveUserQuestionsStore({
      customSubjects: [],
      customChapters: [],
      customTopics: [],
      customQuestions: [],
      cloudCacheQuestions: [],
      deletedQuestionIds: [],
      deletedChapterIds: [],
      deletedTopicIds: [],
      deletedSubjectIds: [],
    } as any);
    __resetInMemoryStateForTests();
    __resetVersionServiceCacheForTests();
    clearSyncedBundleHashes();
    clearPendingWrites();
    clearCommittedIdempotencyKeys();
    clearPendingVersionBumps();
    resetQuotaSummary();
    activeMock = createMockFirestoreDriver();
    __setFirestoreDriverForTests(activeMock.driver);
    __setTestAuthUserForTests({ uid: "admin_uid_1", email: "zdpaliyal@gmail.com" });
  }

  // =========================================================================
  // TEST 1: Bulk Sync Change Detection (120 MCQs, 0-write repeat, 1-MCQ diff)
  // =========================================================================
  resetEnv();
  {
    const subjects = [
      { id: "subj_1", name: "Economics", icon: "BarChart", order: 1 },
      { id: "subj_2", name: "Polity", icon: "Shield", order: 2 },
    ];
    const chapters = [
      { id: "chap_1", subjectId: "subj_1", title: "Fiscal Policy", number: 1, topics: [{ id: "top_1", title: "Budget" }, { id: "top_2", title: "GST" }] },
      { id: "chap_2", subjectId: "subj_2", title: "Constitution", number: 1, topics: [{ id: "top_3", title: "Preamble" }, { id: "top_4", title: "Rights" }] },
    ];
    const topics = ["top_1", "top_2", "top_3", "top_4"];
    const mcqs = Array.from({ length: 120 }, (_, i) => {
      const tIdx = i % 4;
      const tId = topics[tIdx];
      const cId = tIdx < 2 ? "chap_1" : "chap_2";
      const sId = tIdx < 2 ? "subj_1" : "subj_2";
      return makeSampleQuestion(`mcq_sync_${i}`, tId, cId, sId, i);
    });

    const store1 = {
      customChapters: chapters as any,
      customQuestions: mcqs as any,
      cloudCacheQuestions: [],
      deletedQuestionIds: [],
    };
    saveUserQuestionsStore(store1 as any);
    localStorageShim.setItem("quizpro_custom_subjects_v1", JSON.stringify(subjects));
    localStorageShim.setItem("remix_rajprep_pyq_papers_v2", "[]");
    localStorageShim.setItem("remix_rajprep_live_tests_v1", "[]");
    localStorageShim.setItem("quizpro_banners_v1", "[]");

    const res1 = await executeBulkSync(store1 as any);
    assert.equal(res1.success, true, `Initial bulk sync failed: ${res1.errorDetails.join("; ")}`);
    assert.equal(activeMock.listCollection("mcqs").length, 120, "Initial bulk sync should write all 120 MCQs");
    assert.equal(activeMock.listCollection("question_bundles").length, 4, "Should pack all 4 topic bundles");
    assert.ok((activeMock.getRawDoc("metadata/app_version")?.curriculumVersion || 0) >= 2, "Should bump curriculum version once on initial sync");
    const writesAfterFirst = activeMock.stats.writes;
    const versionAfterFirst = activeMock.getRawDoc("metadata/app_version")?.curriculumVersion;
    assert.ok(writesAfterFirst >= 125, `Sanity: initial sync performed expected writes (got ${writesAfterFirst})`);

    // 2nd sync with 0 changes -> MUST perform 0 Firestore writes!
    const res2 = await executeBulkSync(store1 as any);
    assert.equal(res2.success, true);
    assert.equal(res2.created + res2.updated + res2.deleted, 0, "Repeat sync with unchanged data must write 0 docs");
    assert.equal(activeMock.getRawDoc("metadata/app_version")?.curriculumVersion, versionAfterFirst, "Repeat sync must not bump curriculum version");
    assert.equal(activeMock.stats.writes, writesAfterFirst, "Mock driver write count must remain unchanged on 0-diff sync");

    // Modify exactly 1 MCQ out of 120 -> ONLY that 1 MCQ + its dirty bundle + version bump should write
    mcqs[17].explanation = "Updated explanation for MCQ #17!";
    const store1Edited = {
      customChapters: chapters as any,
      customQuestions: mcqs as any,
      cloudCacheQuestions: [],
      deletedQuestionIds: [],
    };
    saveUserQuestionsStore(store1Edited as any);

    const writesBeforeOneEdit = activeMock.stats.writes;
    const res3 = await executeBulkSync(store1Edited as any);
    assert.equal(res3.success, true);
    assert.equal(res3.updated, 1, "1 modified MCQ updates 1 doc in mcqs");
    assert.ok(res3.unchanged >= 119, "All other unchanged docs must be skipped");
    const deltaWrites = activeMock.stats.writes - writesBeforeOneEdit;
    // 1 MCQ + 1 dirty bundle + 1 version bump
    assert.ok(deltaWrites <= 4, `Expected <= 4 writes for 1 modified MCQ, got ${deltaWrites}`);
    console.log(`[PASS] Test 1: Bulk Sync 120 MCQs -> 0-write repeat sync, 1-MCQ edit wrote ${deltaWrites} docs (${res3.unchanged} unchanged skipped)`);
  }

  // =========================================================================
  // TEST 2: Bulk Sync 500 MCQs (Chunked <= 400 ops, 1 Single Version Bump)
  // =========================================================================
  resetEnv();
  {
    const chapters = [
      { id: "chap_500", subjectId: "subj_500", title: "Big Chapter", number: 1, topics: Array.from({ length: 5 }, (_, t) => ({ id: `top_500_${t}`, title: `T${t}` })) },
    ];
    const mcqs500 = Array.from({ length: 500 }, (_, i) =>
      makeSampleQuestion(`mcq_500_${i}`, `top_500_${i % 5}`, "chap_500", "subj_500", i)
    );
    const store500 = {
      customChapters: chapters as any,
      customQuestions: mcqs500 as any,
      cloudCacheQuestions: [],
      deletedQuestionIds: [],
    };
    saveUserQuestionsStore(store500 as any);
    localStorageShim.setItem("quizpro_custom_subjects_v1", JSON.stringify([{ id: "subj_500", name: "Big Subject" }]));
    localStorageShim.setItem("remix_rajprep_pyq_papers_v2", "[]");
    localStorageShim.setItem("remix_rajprep_live_tests_v1", "[]");
    localStorageShim.setItem("quizpro_banners_v1", "[]");

    const res = await executeBulkSync(store500 as any);
    assert.equal(res.success, true, `500-MCQ sync failed: ${res.errorDetails.join("; ")}`);
    assert.equal(activeMock.listCollection("mcqs").length, 500);
    assert.equal(activeMock.listCollection("question_bundles").length, 5);
    const metaVersion = activeMock.getRawDoc("metadata/app_version");
    assert.equal(metaVersion?.curriculumVersion, 2, "Version must bump exactly once for entire 500-MCQ bulk sync (1 -> 2)");

    // Immediate re-sync -> 0 writes
    const writesSnap = activeMock.stats.writes;
    const resAgain = await executeBulkSync(store500 as any);
    assert.equal(resAgain.created + resAgain.updated + resAgain.deleted, 0);
    assert.equal(activeMock.stats.writes, writesSnap, "Immediate re-sync after 500-MCQ sync must perform 0 writes");
    console.log(`[PASS] Test 2: Bulk Sync 500 MCQs chunked safely, 1 single version bump, 0-write re-sync`);
  }

  // =========================================================================
  // TEST 3: Version Bump Optimization (Digest Skip, Single-Flight Concurrency, Coalescing)
  // =========================================================================
  resetEnv();
  {
    // Unchanged digest skipping
    const b1 = await bumpRemoteCurriculumVersion(["t_v1"], undefined, { contentDigest: "hash_alpha" });
    assert.equal(b1, 2);

    const writesBeforeDupBump = activeMock.stats.writes;
    const b2 = await bumpRemoteCurriculumVersion(["t_v1"], undefined, { contentDigest: "hash_alpha" });
    assert.equal(b2, 2, "Unchanged contentDigest should skip remote version bump and return 2");
    assert.equal(activeMock.stats.writes, writesBeforeDupBump, "Skipped version bump must emit 0 writes");

    // 5 concurrent bumps -> serialized without lost updates
    const concurrentResults = await Promise.all([
      bumpRemoteCurriculumVersion(["t_a"], undefined, { contentDigest: "d1" }),
      bumpRemoteCurriculumVersion(["t_b"], undefined, { contentDigest: "d2" }),
      bumpRemoteCurriculumVersion(["t_c"], undefined, { contentDigest: "d3" }),
      bumpRemoteCurriculumVersion(["t_d"], undefined, { contentDigest: "d4" }),
      bumpRemoteCurriculumVersion(["t_e"], undefined, { contentDigest: "d5" }),
    ]);
    const finalVer = activeMock.getRawDoc("metadata/app_version")?.curriculumVersion;
    assert.equal(finalVer, 7, "All 5 concurrent version bumps must serialize monotonically (2 -> 7)");
    assert.deepEqual(
      concurrentResults.slice().sort((a, b) => a - b),
      [3, 4, 5, 6, 7],
      "Concurrent bumps must produce strictly distinct sequential version numbers"
    );

    // Coalescing queued version bumps after quota exhaustion
    setQuotaExhausted(true);
    for (let i = 0; i < 8; i++) {
      const queuedVer = await bumpRemoteCurriculumVersion([`t_q_${i}`], undefined, { contentDigest: `qd_${i}` });
      assert.equal(queuedVer, 7, "Version bump while quota exhausted must queue cleanly without incrementing");
    }
    assert.equal(getPendingVersionBumps().length, 1, "Pending version bumps must coalesce into 1 single entry");

    setQuotaExhausted(false);
    const txBeforeFlush = activeMock.stats.txCommits;
    const flushRes = await processPendingVersionBumps();
    assert.equal(flushRes, 1, "Coalesced queue flushes cleanly");
    assert.equal(activeMock.stats.txCommits - txBeforeFlush, 1, "8 pending bumps must coalesce into 1 single transaction");
    assert.equal(activeMock.getRawDoc("metadata/app_version")?.curriculumVersion, 8);
    console.log(`[PASS] Test 3: Version bump digest skip, 5-way single-flight serialization, and 8-to-1 coalesced flush`);
  }

  // =========================================================================
  // TEST 4: Import Optimization (Dedup, Modified Skip, Single Batch Meta, Undo)
  // =========================================================================
  resetEnv();
  {
    const qs = Array.from({ length: 10 }, (_, i) =>
      makeSampleQuestion(`imp_q_${i}`, "top_imp", "chap_imp", "subj_imp", i)
    );
    const r1 = await commitQuestions(qs as any, "batch_imp_1", undefined, { mirrorToLegacyQuestions: true });
    assert.equal(r1.success, true);
    assert.equal(r1.committedCount, 10);
    assert.equal(r1.skippedCount, 0);
    assert.ok(activeMock.getRawDoc("import_batches/batch_imp_1"), "Batch metadata doc written once");
    assert.equal(activeMock.listCollection("mcqs").length, 10);
    assert.equal(activeMock.listCollection("questions").length, 10);
    assert.ok(activeMock.getRawDoc("question_bundles/topic_top_imp"), "Dirty topic bundle repacked on commit");

    // Re-import identical questions -> 0 writes!
    const writesBeforeDupImport = activeMock.stats.writes;
    const rDup = await commitQuestions(qs as any, "batch_imp_dup");
    assert.equal(rDup.success, true);
    assert.equal(rDup.committedCount, 0);
    assert.equal(rDup.skippedCount, 10);
    assert.equal(activeMock.stats.writes, writesBeforeDupImport, "Duplicate import must perform 0 Firestore writes");

    // Modify 1 question and re-import all 10 -> only 1 written, 9 skipped
    const modifiedBatch = qs.map((q, idx) =>
      idx === 3 ? { ...q, explanation: "Edited explanation #3" } : q
    );
    const rMod = await commitQuestions(modifiedBatch as any, "batch_imp_mod");
    assert.equal(rMod.success, true);
    assert.equal(rMod.committedCount, 1, "Only 1 modified MCQ should be committed");
    assert.equal(rMod.skippedCount, 9, "9 unchanged MCQs must be skipped");

    // Undo batch_imp_1 -> removes all from BOTH mcqs & questions, cleans bundle & batch doc
    const undoRes = await undoImportBatch("batch_imp_1");
    assert.equal(undoRes.success, true, `undoImportBatch failed: ${undoRes.error}`);
    assert.equal(undoRes.deletedCount, 10);
    assert.equal(activeMock.listCollection("mcqs").length, 0, "mcqs must be empty after undo");
    assert.equal(activeMock.listCollection("questions").length, 0, "Mirror questions must also be deleted after undo");
    assert.equal(activeMock.getRawDoc("import_batches/batch_imp_1"), undefined, "Batch metadata doc deleted");
    assert.equal(activeMock.getRawDoc("question_bundles/topic_top_imp"), undefined, "Empty topic bundle removed after undo");
    console.log(`[PASS] Test 4: Import dedup (0 writes), 1/10 modified delta import, and full mirror+bundle undo`);
  }

  // =========================================================================
  // TEST 5: Cascade Deletes + Partial Failure + Purge Mock Data
  // =========================================================================
  resetEnv();
  {
    // Seed Subject 1 hierarchy + unrelated Subject KEEP
    activeMock.seedDoc("subjects/sub_del", { id: "sub_del", name: "To Delete" });
    activeMock.seedDoc("chapters/ch_del_1", {
      id: "ch_del_1",
      subjectId: "sub_del",
      title: "Ch 1",
      topics: [{ id: "top_del_1" }, { id: "top_del_2" }],
    });
    activeMock.seedDoc("topics/top_del_1", { id: "top_del_1", subjectId: "sub_del", chapterId: "ch_del_1", title: "T1" });
    activeMock.seedDoc("topics/top_del_2", { id: "top_del_2", subjectId: "sub_del", chapterId: "ch_del_1", title: "T2" });
    activeMock.seedDoc("question_bundles/topic_top_del_1", { topicId: "top_del_1", count: 3, questions: [] });
    activeMock.seedDoc("question_bundles/topic_top_del_2", { topicId: "top_del_2", count: 2, questions: [] });
    for (let i = 0; i < 3; i++) {
      activeMock.seedDoc(`mcqs/m_t1_${i}`, makeSampleQuestion(`m_t1_${i}`, "top_del_1", "ch_del_1", "sub_del", i));
      activeMock.seedDoc(`questions/m_t1_${i}`, makeSampleQuestion(`m_t1_${i}`, "top_del_1", "ch_del_1", "sub_del", i));
    }
    for (let i = 0; i < 2; i++) {
      activeMock.seedDoc(`mcqs/m_t2_${i}`, makeSampleQuestion(`m_t2_${i}`, "top_del_2", "ch_del_1", "sub_del", i));
      activeMock.seedDoc(`questions/m_t2_${i}`, makeSampleQuestion(`m_t2_${i}`, "top_del_2", "ch_del_1", "sub_del", i));
    }

    // Unrelated production data that MUST survive
    activeMock.seedDoc("subjects/sub_keep", { id: "sub_keep", name: "Keep Subject" });
    activeMock.seedDoc("chapters/ch_keep", { id: "ch_keep", subjectId: "sub_keep", title: "Keep Ch", topics: [{ id: "top_keep" }] });
    activeMock.seedDoc("topics/top_keep", { id: "top_keep", subjectId: "sub_keep", chapterId: "ch_keep", title: "Keep Top" });
    activeMock.seedDoc("mcqs/m_keep", makeSampleQuestion("m_keep", "top_keep", "ch_keep", "sub_keep", 1));

    // 5a. Delete topic top_del_1 (with known chapterId) -> should NOT scan chapters collection
    const readsBeforeTopicDel = activeMock.stats.reads;
    const topDelRes = await deleteTopicFromCloud("top_del_1", "ch_del_1");
    assert.equal(topDelRes.success, true, `deleteTopicFromCloud failed: ${topDelRes.error}`);
    assert.equal(activeMock.getRawDoc("topics/top_del_1"), undefined);
    assert.equal(activeMock.getRawDoc("question_bundles/topic_top_del_1"), undefined);
    assert.equal(activeMock.getRawDoc("mcqs/m_t1_0"), undefined);
    assert.equal(activeMock.getRawDoc("questions/m_t1_0"), undefined);
    const chAfterTopDel = activeMock.getRawDoc("chapters/ch_del_1");
    assert.deepEqual(chAfterTopDel?.topics, [{ id: "top_del_2" }], "Parent chapter must only drop top_del_1");
    // Ch_keep was NEVER read (0 full chapters collection scan!)
    assert.ok(activeMock.stats.reads - readsBeforeTopicDel <= 12, "Topic delete must use targeted reads only");

    // 5b. Delete chapter ch_del_1 -> cascades to top_del_2 + its MCQs & bundle
    const chDelRes = await deleteChapterFromCloud("ch_del_1");
    assert.equal(chDelRes.success, true, `deleteChapterFromCloud failed: ${chDelRes.error}`);
    assert.equal(activeMock.getRawDoc("chapters/ch_del_1"), undefined);
    assert.equal(activeMock.getRawDoc("topics/top_del_2"), undefined);
    assert.equal(activeMock.getRawDoc("mcqs/m_t2_0"), undefined);

    // 5c. Delete subject sub_del -> test with a new 430-MCQ child tree to verify >400 batched delete!
    activeMock.seedDoc("chapters/ch_big", { id: "ch_big", subjectId: "sub_del", title: "Big" });
    activeMock.seedDoc("topics/top_big", { id: "top_big", subjectId: "sub_del", chapterId: "ch_big", title: "BigT" });
    for (let i = 0; i < 430; i++) {
      activeMock.seedDoc(`mcqs/mb_${i}`, makeSampleQuestion(`mb_${i}`, "top_big", "ch_big", "sub_del", i));
    }
    const subDelRes = await deleteSubjectFromCloud("sub_del");
    assert.equal(subDelRes.success, true, `deleteSubjectFromCloud failed: ${subDelRes.error}`);
    assert.ok((subDelRes.deletedCount || 0) >= 433, `Expected >= 433 deleted paths, got ${subDelRes.deletedCount}`);
    assert.equal(activeMock.getRawDoc("subjects/sub_del"), undefined);
    assert.equal(activeMock.getRawDoc("chapters/ch_big"), undefined);
    assert.equal(activeMock.getRawDoc("topics/top_big"), undefined);
    assert.equal(activeMock.listCollection("mcqs").filter((d) => d.data.subjectId === "sub_del").length, 0);

    // Unrelated data must be 100% preserved!
    assert.ok(activeMock.getRawDoc("subjects/sub_keep"), "Unrelated subject must remain untouched");
    assert.ok(activeMock.getRawDoc("chapters/ch_keep"), "Unrelated chapter must remain untouched");
    assert.ok(activeMock.getRawDoc("topics/top_keep"), "Unrelated topic must remain untouched");
    assert.ok(activeMock.getRawDoc("mcqs/m_keep"), "Unrelated MCQ must remain untouched");

    // 5d. Partial failure check during cascade delete
    activeMock.seedDoc("topics/top_partial", { id: "top_partial", subjectId: "sub_keep", title: "Partial" });
    for (let i = 0; i < 450; i++) {
      activeMock.seedDoc(`mcqs/mp_${i}`, makeSampleQuestion(`mp_${i}`, "top_partial", "ch_keep", "sub_keep", i));
    }
    let commitCount = 0;
    const partialMock = createMockFirestoreDriver({
      onBeforeCommit: () => {
        commitCount++;
        if (commitCount === 2) {
          const err: any = new Error("Simulated transient network failure on 2nd delete chunk");
          err.code = "unavailable";
          throw err;
        }
      },
    });
    // Copy docs into partialMock
    for (const [k, v] of activeMock.docs.entries()) partialMock.seedDoc(k, v);
    __setFirestoreDriverForTests(partialMock.driver);
    const partialRes = await deleteTopicFromCloud("top_partial");
    assert.equal(partialRes.success, false, "Partial delete chunk failure must return success: false");
    assert.equal(partialRes.partialFailure, true, "Partial failure flag must be set");
    assert.ok((partialRes.deletedIds?.length || 0) > 0, "Should track successfully deleted IDs");
    assert.ok((partialRes.failedIds?.length || 0) > 0, "Should track failed IDs");

    // 5e. purgeAllTestAndMockCloudData preserves real docs and purges TEST_ docs in batches
    __setFirestoreDriverForTests(activeMock.driver);
    activeMock.seedDoc("subjects/TEST_CAT_STRESS_1", { id: "TEST_CAT_STRESS_1", name: "Test Sub", isTest: true });
    activeMock.seedDoc("mcqs/TEST_mcq_1", { id: "TEST_mcq_1", text: "Mock Question", isTest: true });
    activeMock.seedDoc("liveTests/TEST_lt_1", { id: "TEST_lt_1", title: "Test Live", isTest: true });
    activeMock.seedDoc("question_bundles/topic_TEST_top_1", { topicId: "TEST_top_1", isTest: true });
    const purgeRes = await purgeAllTestAndMockCloudData();
    assert.equal(purgeRes.success, true);
    assert.equal(purgeRes.totalDeleted, 4);
    assert.ok(activeMock.getRawDoc("subjects/sub_keep"), "Purge must never delete real subjects");
    assert.ok(activeMock.getRawDoc("mcqs/m_keep"), "Purge must never delete real MCQs");
    console.log(`[PASS] Test 5: Cascade deletes (<=400 batches, 0 full scans), partial failure tracking, & test purge`);
  }

  // =========================================================================
  // TEST 6: Interrupted Batch Operation (Mid-Batch Quota Error -> Safe Halt & Resume)
  // =========================================================================
  resetEnv();
  {
    let batchAttempt = 0;
    const interruptedMock = createMockFirestoreDriver({
      onBeforeCommit: () => {
        batchAttempt++;
        if (batchAttempt === 2) {
          const err: any = new Error("Quota limit exceeded mid-batch");
          err.code = "resource-exhausted";
          throw err;
        }
      },
    });
    __setFirestoreDriverForTests(interruptedMock.driver);

    const qs450 = Array.from({ length: 450 }, (_, i) =>
      makeSampleQuestion(`mcq_int_${i}`, "top_int", "chap_int", "subj_int", i)
    );
    const resMidFail = await commitQuestions(qs450 as any, "batch_int_1");
    assert.equal(resMidFail.success, true, "First 200 succeeded before chunk 2 tripped quota");
    assert.equal(resMidFail.committedCount, 200);
    assert.equal(resMidFail.failedCount, 250);
    assert.equal(isQuotaExhausted(), true, "Circuit breaker must trip on mid-batch resource-exhausted");
    assert.equal(interruptedMock.listCollection("mcqs").length, 200);

    // Now clear quota exhaustion and resume with the SAME 450 questions
    setQuotaExhausted(false);
    const cleanResumeMock = createMockFirestoreDriver();
    for (const [k, v] of interruptedMock.docs.entries()) cleanResumeMock.seedDoc(k, v);
    __setFirestoreDriverForTests(cleanResumeMock.driver);

    const resResume = await commitQuestions(qs450 as any, "batch_int_2");
    assert.equal(resResume.success, true);
    assert.equal(resResume.committedCount, 250, "Resume must write ONLY the 250 uncommitted MCQs");
    assert.equal(resResume.skippedCount, 200, "Resume must skip the 200 already committed MCQs (0 duplicate writes)");
    assert.equal(cleanResumeMock.listCollection("mcqs").length, 450);
    console.log(`[PASS] Test 6: Interrupted 450-MCQ import halted safely at quota, resumed with 200 skipped & 250 written`);
  }

  // =========================================================================
  // TEST 7: Question Bundle Optimization & Consistency Verification
  // =========================================================================
  resetEnv();
  {
    const topicQs = Array.from({ length: 15 }, (_, i) =>
      makeSampleQuestion(`bq_${i}`, "top_bundle_1", "chap_b", "subj_b", i)
    );
    const b1 = await saveQuestionBundleForTopic("top_bundle_1", topicQs as any);
    assert.equal(b1.written, true);
    assert.equal(b1.skipped, false);
    assert.equal(b1.questionCount, 15);

    const remoteBundle = activeMock.getRawDoc("question_bundles/topic_top_bundle_1");
    assert.ok(remoteBundle && remoteBundle.questionCount === 15);
    const checkOk = verifyBundleConsistency(remoteBundle as any, topicQs as any);
    assert.equal(checkOk.consistent, true, `Bundle consistency check failed`);

    // Repeat save with identical questions -> skipped (0 writes)!
    const writesBeforeBundleDup = activeMock.stats.writes;
    const b2 = await saveQuestionBundleForTopic("top_bundle_1", topicQs as any);
    assert.equal(b2.written, false);
    assert.equal(b2.skipped, true, "Unchanged bundle must be skipped cleanly");
    assert.equal(activeMock.stats.writes, writesBeforeBundleDup, "Skipped bundle must emit 0 writes");

    // Prepare payload deduplicates duplicate IDs & filters mismatched topicId
    const withDup = prepareVerifiedBundlePayload("top_bundle_1", [
      ...topicQs,
      topicQs[0],
      makeSampleQuestion("bq_wrong", "other_topic", "chap_b", "subj_b", 99),
    ] as any);
    assert.equal(withDup.payload.questionCount, 15, "Bundle preparation must deduplicate duplicate question IDs");
    assert.equal(withDup.mismatchedCount, 1, "Bundle preparation must catch mismatched topicId");

    // Inconsistent bundle caught by verifyBundleConsistency
    const brokenCheck = verifyBundleConsistency(remoteBundle as any, topicQs.slice(0, 14) as any);
    assert.equal(brokenCheck.consistent, false, "Consistency verifier must catch count/question mismatch");
    assert.ok(brokenCheck.extraIds.includes("bq_14"));

    // packAllQuestionsIntoTopicBundles repacks ONLY changed topic
    const t2Qs = Array.from({ length: 5 }, (_, i) =>
      makeSampleQuestion(`bq2_${i}`, "top_bundle_2", "chap_b", "subj_b", i)
    );
    await saveQuestionBundleForTopic("top_bundle_2", t2Qs as any);

    const packUnchanged = await packAllQuestionsIntoTopicBundles([...topicQs, ...t2Qs] as any);
    assert.equal(packUnchanged.bundleCount, 0, "packAllQuestionsIntoTopicBundles must skip all unchanged bundles");
    assert.equal(packUnchanged.skippedCount, 2);

    // Edit 1 question in top_bundle_1 while top_bundle_2 stays untouched
    const modifiedTop1 = topicQs.map((q, idx) => idx === 0 ? { ...q, text: "Modified bundle Q0?" } : q);
    const packOneDirty = await packAllQuestionsIntoTopicBundles([...modifiedTop1, ...t2Qs] as any);
    assert.equal(packOneDirty.bundleCount, 1, "Must repack ONLY the 1 modified topic bundle");
    assert.equal(packOneDirty.skippedCount, 1, "Unchanged topic bundle must stay skipped");
    assert.deepEqual(packOneDirty.packedTopicIds, ["top_bundle_1"]);
    assert.deepEqual(packOneDirty.skippedTopicIds, ["top_bundle_2"]);
    console.log(`[PASS] Test 7: Bundle optimization (0-write skip, dirty-only repack, deduplication, consistency check)`);
  }

  // =========================================================================
  // TEST 8: QA Runner Isolation (0 Prod Writes + Preserved Pre-Run Quota Summary)
  // =========================================================================
  resetEnv();
  {
    const prodMock = createMockFirestoreDriver();
    __setFirestoreDriverForTests(prodMock.driver);
    const todayKey = getCurrentQuotaDate();
    const baseSummary = getQuotaSummary(todayKey);
    saveQuotaSummary({
      ...baseSummary,
      date: todayKey,
      reads: 42,
      writes: 17,
      deletes: 3,
      successfulWrites: 14,
      confirmedDeletes: 3,
      failedReads: 1,
      failedWrites: 0,
      topActions: { "Student: Load Topic": { actionName: "Student: Load Topic", count: 5, reads: 42, writes: 0, deletes: 0, failedCount: 1, category: "Student" } },
      logs: [{ id: "real_log_1", timestamp: Date.now(), operation: "write", category: "Student", collectionName: "attempts", actionName: "Real Attempt", reads: 0, writes: 17, deletes: 0, failed: false }],
      lastUpdatedAt: Date.now(),
    });

    const prodWritesBeforeQA = prodMock.stats.writes;

    const { mockStats } = await runInMockQASandbox(async (qaMock) => {
      // Simulate heavy QA operations including quota reset & batch writes
      resetQuotaSummary(todayKey);
      const batch = guardedWriteBatch({} as any);
      for (let i = 0; i < 25; i++) {
        batch.set({ id: `q_${i}`, path: `_health/q_${i}` } as any, { isTest: true });
      }
      await batch.commit("QA", "Simulated QA Stress Batch");
      await guardedSetDoc({ id: "ping", path: "_health/ping" } as any, { ping: true }, undefined, "QA", "QA Ping");
      recordUsage({ category: "QA", actionName: "QA Sim Event", reads: 99, writes: 99 });
      assert.ok(qaMock.stats.writes >= 26, "QA writes must land on isolated QA mock driver");
    });

    // Reinstall prodMock to confirm prodMock received 0 writes during QA
    assert.ok(mockStats.writes >= 26);
    assert.equal(prodMock.stats.writes, prodWritesBeforeQA, "Production Firestore driver must receive 0 writes during Mock QA");

    // Verify real daily quota summary & logs are 100% preserved verbatim
    const afterQuota = getQuotaSummary(todayKey);
    assert.equal(afterQuota.reads, 42, "Real quota reads must be preserved after Mock QA");
    assert.equal(afterQuota.writes, 17, "Real quota writes must be preserved after Mock QA");
    assert.equal(afterQuota.deletes, 3, "Real quota deletes must be preserved after Mock QA");
    assert.equal(afterQuota.logs.length, 1, "Real quota logs must be preserved verbatim");
    assert.equal(afterQuota.logs[0].id, "real_log_1");
    console.log(`[PASS] Test 8: QA Runner isolation (${mockStats.writes} mock writes, 0 prod writes, real telemetry preserved)`);
  }

  console.log("\nALL PHASE 3 ADMIN & BULK SYNC OPTIMIZATION TESTS PASSED SUCCESSFULLY.");
}

main().catch((err) => {
  console.error("PHASE 3 VERIFICATION FAILED:", err);
  process.exit(1);
});
