import assert from "node:assert/strict";

// -----------------------------------------------------------------------------
// DETERMINISTIC BROWSER SHIMS FOR NODE TEST EXECUTION (BEFORE APP IMPORTS)
// -----------------------------------------------------------------------------
function createStorageShim() {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
    setItem: (k: string, v: string) => {
      map.set(String(k), String(v));
    },
    removeItem: (k: string) => {
      map.delete(k);
    },
    clear: () => map.clear(),
    key: (idx: number) => Array.from(map.keys())[idx] ?? null,
    get length() {
      return map.size;
    },
    _dump: () => map,
  };
}

const localStorageShim = createStorageShim();
const sessionStorageShim = createStorageShim();
let simulatedOnline = true;

(globalThis as any).localStorage = localStorageShim;
(globalThis as any).sessionStorage = sessionStorageShim;

if (typeof (globalThis as any).navigator === "undefined") {
  Object.defineProperty(globalThis, "navigator", {
    value: {
      get onLine() {
        return simulatedOnline;
      },
    },
    configurable: true,
  });
} else {
  Object.defineProperty(globalThis.navigator, "onLine", {
    get() {
      return simulatedOnline;
    },
    configurable: true,
  });
}

if (typeof (globalThis as any).window === "undefined") {
  (globalThis as any).window = {
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => true,
  };
}

// -----------------------------------------------------------------------------
// MOCKED IN-MEMORY FIRESTORE BACKEND DRIVER (ZERO LIVE FIRESTORE ACCESS)
// -----------------------------------------------------------------------------
interface MockFirestoreStats {
  totalBatchCommits: number;
  maxBatchOpCount: number;
  batchDocWrites: number;
  setDocWrites: number;
  txExecutions: number;
  txWrites: number;
  totalLogicalWrites: number;
}

class MockFirestoreBackend {
  docs = new Map<string, any>();
  stats: MockFirestoreStats = {
    totalBatchCommits: 0,
    maxBatchOpCount: 0,
    batchDocWrites: 0,
    setDocWrites: 0,
    txExecutions: 0,
    txWrites: 0,
    totalLogicalWrites: 0,
  };
  failNextBatchError: Error | null = null;
  txSerializer: Promise<void> = Promise.resolve();

  reset() {
    this.docs.clear();
    this.failNextBatchError = null;
    this.txSerializer = Promise.resolve();
    this.resetStats();
  }

  resetStats() {
    this.stats = {
      totalBatchCommits: 0,
      maxBatchOpCount: 0,
      batchDocWrites: 0,
      setDocWrites: 0,
      txExecutions: 0,
      txWrites: 0,
      totalLogicalWrites: 0,
    };
  }

  makeDriver() {
    const self = this;
    return {
      disableNetwork: (async () => {}) as any,
      enableNetwork: (async () => {}) as any,
      doc: ((_fs: any, ...segments: string[]) => {
        const cleanPath = segments.join("/");
        const id = segments[segments.length - 1] || `auto_${Date.now()}`;
        return { id, path: cleanPath } as any;
      }) as any,
      setDoc: (async (ref: any, data: any, options?: any) => {
        const key = ref.path;
        const prev = self.docs.get(key) || {};
        const next = options?.merge ? { ...prev, ...data } : { ...data };
        self.docs.set(key, JSON.parse(JSON.stringify(next)));
        self.stats.setDocWrites += 1;
        self.stats.totalLogicalWrites += 1;
      }) as any,
      writeBatch: (() => {
        const ops: Array<{ ref: any; data: any; merge: boolean }> = [];
        return {
          set(ref: any, data: any, options?: any) {
            ops.push({ ref, data, merge: Boolean(options?.merge) });
          },
          update(ref: any, data: any) {
            ops.push({ ref, data, merge: true });
          },
          delete(ref: any) {
            ops.push({ ref, data: null, merge: false });
          },
          async commit() {
            if (ops.length > 500) {
              throw new Error(`Firestore 500-op WriteBatch limit exceeded: ${ops.length}`);
            }
            if (self.failNextBatchError) {
              const err = self.failNextBatchError;
              self.failNextBatchError = null;
              throw err;
            }
            self.stats.totalBatchCommits += 1;
            if (ops.length > self.stats.maxBatchOpCount) {
              self.stats.maxBatchOpCount = ops.length;
            }
            for (const op of ops) {
              if (op.data === null) {
                self.docs.delete(op.ref.path);
              } else {
                const prev = self.docs.get(op.ref.path) || {};
                const next = op.merge ? { ...prev, ...op.data } : { ...op.data };
                self.docs.set(op.ref.path, JSON.parse(JSON.stringify(next)));
              }
              self.stats.batchDocWrites += 1;
              self.stats.totalLogicalWrites += 1;
            }
          },
        } as any;
      }) as any,
      runTransaction: (async (_fs: any, updateFn: (tx: any) => Promise<any>) => {
        // Serialize concurrent transactions cleanly to model Firestore optimistic concurrency / retries
        const waitForPrev = self.txSerializer;
        let release!: () => void;
        self.txSerializer = new Promise<void>((res) => {
          release = res;
        });
        await waitForPrev;
        try {
          self.stats.txExecutions += 1;
          const pendingSets: Array<{ path: string; data: any; merge: boolean }> = [];
          const tx = {
            async get(ref: any) {
              const found = self.docs.get(ref.path);
              return {
                exists: () => found !== undefined,
                data: () => (found !== undefined ? JSON.parse(JSON.stringify(found)) : undefined),
              };
            },
            set(ref: any, data: any, options?: any) {
              pendingSets.push({ path: ref.path, data, merge: Boolean(options?.merge) });
            },
          };
          const res = await updateFn(tx);
          for (const item of pendingSets) {
            const prev = self.docs.get(item.path) || {};
            const next = item.merge ? { ...prev, ...item.data } : { ...item.data };
            self.docs.set(item.path, JSON.parse(JSON.stringify(next)));
            self.stats.txWrites += 1;
            self.stats.totalLogicalWrites += 1;
          }
          return res;
        } finally {
          release();
        }
      }) as any,
    };
  }
}

async function main() {
  const {
    __setFirestoreDriverForTests,
    __resetInMemoryStateForTests,
    clearPendingWrites,
    clearCommittedIdempotencyKeys,
    getQuotaSummary,
    resetQuotaSummary,
    setQuotaExhausted,
  } = await import("../src/utils/quotaTracker");

  const {
    SAFE_BATCH_CHUNK_SIZE,
    BATCH_FLUSH_QUESTION_THRESHOLD,
    bufferProgressUpdate,
    bufferHistoryUpdate,
    flushStudentWriteBuffer,
    getCurrentWeekId,
    getStudentBufferSnapshot,
    getStudentSyncMode,
    hasPendingStudentWrites,
    isStudentTrackingAllowed,
    rehydrateStudentWriteBuffer,
    setAdminPreviewSession,
    commitWeeklyStatsDeltaIdempotent,
    __simulateProcessRestartForTests,
    __clearStudentWriteBufferForTests,
    __setStudentBufferTestHooks,
    __setMockAuthUserForTests,
  } = await import("../src/utils/studentWriteBuffer");

  const { recordQuestionAttempt } = await import("../src/utils/performanceStorage");
  const {
    recordAttemptToCloud,
    updateLeaderboardToCloud,
  } = await import("../src/utils/firebaseSyncService");
  const { recordPYQAttempt } = await import("../src/utils/pyqStorage");
  const { submitLiveTestSubmission } = await import("../src/utils/liveTestStorage");
  const { saveUserProfile } = await import("../src/utils/userProfileStorage");

  const backend = new MockFirestoreBackend();
  const studentProfile = {
    id: "student_uid_001",
    name: "Aarav Aspirant",
    email: "aarav@example.com",
    role: "student" as const,
    status: "active" as const,
    createdAt: "2026-01-01T00:00:00.000Z",
  };
  const adminProfile = {
    id: "admin_uid_999",
    name: "Admin User",
    email: "admin@quizpro.shop",
    role: "admin" as const,
    status: "active" as const,
    createdAt: "2026-01-01T00:00:00.000Z",
  };
  const guestProfile = {
    id: "student_default",
    name: "Guest",
    email: "",
    role: "student" as const,
    status: "active" as const,
    createdAt: "2026-01-01T00:00:00.000Z",
  };

  async function resetScenario(profile: any = studentProfile) {
    simulatedOnline = true;
    localStorageShim.clear();
    sessionStorageShim.clear();
    __resetInMemoryStateForTests();
    clearPendingWrites();
    clearCommittedIdempotencyKeys();
    resetQuotaSummary();
    await __clearStudentWriteBufferForTests();
    __setStudentBufferTestHooks(null);
    backend.reset();
    __setFirestoreDriverForTests(backend.makeDriver());
    if (profile && profile.id !== "student_default") {
      saveUserProfile(profile);
      __setMockAuthUserForTests({
        uid: profile.id,
        email: profile.email || `${profile.id}@example.com`,
        displayName: profile.name,
        photoURL: "",
        isAnonymous: false,
      });
    } else {
      if (profile) saveUserProfile(profile);
      __setMockAuthUserForTests(null);
    }
  }

  function simulateAnswerQuestion(
    qIdx: number,
    isCorrect: boolean,
    opts?: { deferFlush?: boolean; userProfile?: any; isAdminPreview?: boolean; dateStr?: string }
  ) {
    const qId = `q_${qIdx}`;
    const dateStr = opts?.dateStr || "2026-11-12";
    const profile = opts?.userProfile || studentProfile;

    bufferProgressUpdate(
      qId,
      {
        status: isCorrect ? "correct" : "wrong",
        stage: isCorrect ? 1 : 0,
        nextReviewAt: dateStr,
        wrongCount: isCorrect ? 0 : 1,
        bookmarked: false,
        lastAnsweredAt: dateStr,
        timesAttempted: 1,
        lastSelectedOption: isCorrect ? 0 : 1,
        updatedAt: new Date(1700000000000 + qIdx).toISOString(),
      },
      { userProfile: profile, isAdminPreview: opts?.isAdminPreview }
    );

    const prevHistRaw = localStorageShim.getItem(`sim_hist_${dateStr}`);
    const prevHist = prevHistRaw ? JSON.parse(prevHistRaw) : { correct: 0, wrong: 0 };
    const nextHist = {
      correct: prevHist.correct + (isCorrect ? 1 : 0),
      wrong: prevHist.wrong + (isCorrect ? 0 : 1),
    };
    localStorageShim.setItem(`sim_hist_${dateStr}`, JSON.stringify(nextHist));

    bufferHistoryUpdate(dateStr, nextHist, {
      userProfile: profile,
      isAdminPreview: opts?.isAdminPreview,
    });

    recordQuestionAttempt(
      {
        questionId: qId,
        chapterId: "ch_1",
        topicId: "top_1",
        timeTakenSeconds: 18,
        isCorrect,
        selectedOption: isCorrect ? "A" : "B",
        correctOption: "A",
      },
      {
        deferFlush: opts?.deferFlush,
        isAdminPreview: opts?.isAdminPreview,
      }
    );
  }

  const sleep = (ms = 25) => new Promise((r) => setTimeout(r, ms));

  // ---------------------------------------------------------------------------
  // SCENARIO 1: 10 MCQs Practice Simulation (Q1-Q9 = 0 writes, Q10 triggers batch)
  // ---------------------------------------------------------------------------
  await resetScenario(studentProfile);
  {
    assert.equal(BATCH_FLUSH_QUESTION_THRESHOLD, 10);
    for (let i = 1; i <= 9; i++) {
      simulateAnswerQuestion(i, i <= 7, { userProfile: studentProfile });
    }
    await sleep(30);
    assert.equal(
      backend.stats.totalLogicalWrites,
      0,
      "Q1-Q9 MUST trigger 0 Firestore writes"
    );
    assert.equal(hasPendingStudentWrites(), true, "Pending staging writes must exist after 9 MCQs");

    // Answering 10th MCQ automatically triggers flush
    simulateAnswerQuestion(10, true, { userProfile: studentProfile });
    await sleep(50);

    // 10 progress + 1 history + 1 aggregated attemptSummary + 1 weekly tx = 13 writes (vs Old: 41 writes!)
    const newWrites10 = backend.stats.totalLogicalWrites;
    const oldWrites10 = 10 * 4 + 1; // 10 progress + 10 history + 10 attempt + 10 weekly tx + 1 casual leaderboard = 41
    const reduction10 = ((oldWrites10 - newWrites10) / oldWrites10) * 100;

    assert.equal(backend.stats.totalBatchCommits, 1, "10-MCQ practice should commit in 1 batch");
    assert.equal(backend.stats.txExecutions, 1, "10-MCQ practice should run 1 weekly tx (not 10)");
    assert.equal(newWrites10, 13, `Expected 13 logical writes for 10 MCQs, got ${newWrites10}`);
    assert.equal(hasPendingStudentWrites(), false, "Buffer and outbox must be clean after commit");

    const weekId = getCurrentWeekId();
    const weeklyDoc = backend.docs.get(`user_stats_weekly/${studentProfile.id}_${weekId}`);
    assert.ok(weeklyDoc, "Weekly stats doc must exist with schema preserved");
    assert.equal(weeklyDoc.totalAttempted, 10);
    assert.equal(weeklyDoc.totalCorrect, 8);
    assert.equal(weeklyDoc.totalPoints, 80);
    assert.equal(weeklyDoc.averageAccuracy, 80);

    // Verify aggregated attempt doc schema & itemAttempts
    const attemptKeys = Array.from(backend.docs.keys()).filter((k) => k.startsWith("attempts/"));
    assert.equal(attemptKeys.length, 1, "Exactly 1 aggregated attempt document per 10-MCQ batch");
    const attemptDoc = backend.docs.get(attemptKeys[0]);
    assert.equal(attemptDoc.questionCount, 10);
    assert.equal(attemptDoc.correctCount, 8);
    assert.equal(attemptDoc.itemAttempts.length, 10);

    console.log(
      `PASS [Scenario 1: 10 MCQs Practice] Old=${oldWrites10}, New=${newWrites10} (${reduction10.toFixed(1)}% reduction), 0 writes for Q1-Q9.`
    );
  }

  // ---------------------------------------------------------------------------
  // SCENARIO 2: 50 MCQs Practice Simulation (5 batches, accurate weekly total)
  // ---------------------------------------------------------------------------
  await resetScenario(studentProfile);
  {
    let expectedCorrect = 0;
    for (let i = 1; i <= 50; i++) {
      const correct = i % 10 < 7; // 35 correct, 15 wrong
      if (correct) expectedCorrect++;
      simulateAnswerQuestion(i, correct, { userProfile: studentProfile });
      if (i % 10 === 0) {
        await sleep(30); // allow threshold_10 auto-flush to finish cleanly per 10-question block
      }
    }
    await sleep(60);

    const newWrites50 = backend.stats.totalLogicalWrites;
    const oldWrites50 = 50 * 4 + 1; // 201 writes
    const reduction50 = ((oldWrites50 - newWrites50) / oldWrites50) * 100;

    assert.equal(backend.stats.totalBatchCommits, 5, "50 MCQs should flush in 5 batch commits");
    assert.equal(backend.stats.txExecutions, 5, "50 MCQs should run 5 serialized weekly txs");
    assert.equal(newWrites50, 65, `Expected 65 writes for 50 MCQs, got ${newWrites50}`);

    const weekId = getCurrentWeekId();
    const weeklyDoc = backend.docs.get(`user_stats_weekly/${studentProfile.id}_${weekId}`);
    assert.equal(weeklyDoc.totalAttempted, 50);
    assert.equal(weeklyDoc.totalCorrect, expectedCorrect);
    assert.equal(weeklyDoc.totalPoints, expectedCorrect * 10);
    assert.equal(getQuotaSummary().successfulWrites, 65, "Quota tracker must accurately match 65 confirmed writes");

    console.log(
      `PASS [Scenario 2: 50 MCQs Practice] Old=${oldWrites50}, New=${newWrites50} (${reduction50.toFixed(1)}% reduction).`
    );
  }

  // ---------------------------------------------------------------------------
  // SCENARIO 3: 100 MCQs Full Exam + >400-op Batch Chunking Verification
  // ---------------------------------------------------------------------------
  await resetScenario(studentProfile);
  {
    for (let i = 1; i <= 100; i++) {
      simulateAnswerQuestion(i, i <= 75, { deferFlush: true, userProfile: studentProfile });
    }
    await sleep(30);
    assert.equal(
      backend.stats.totalLogicalWrites,
      0,
      "Deferred Full Exam loop MUST perform 0 Firestore writes until submit"
    );

    const flushRes = await flushStudentWriteBuffer({
      trigger: "test_submission",
      userProfile: studentProfile,
      sessionMeta: {
        testId: "full-standard-100",
        testTitle: "Full Mock 100",
        testType: "full_exam",
        timeSpentSeconds: 3600,
      },
    });

    const newWrites100 = backend.stats.totalLogicalWrites;
    const oldWrites100 = 100 * 4; // 400 writes (100 colliding transactions!)
    const reduction100 = ((oldWrites100 - newWrites100) / oldWrites100) * 100;

    assert.equal(flushRes.totalFirestoreWrites, 103);
    assert.equal(backend.stats.totalBatchCommits, 1, "100-MCQ Full Exam must fit in 1 batch commit");
    assert.equal(backend.stats.txExecutions, 1, "100-MCQ Full Exam must use 1 single weekly tx (0 collisions)");
    assert.equal(newWrites100, 103);

    const weekId = getCurrentWeekId();
    const weeklyDoc = backend.docs.get(`user_stats_weekly/${studentProfile.id}_${weekId}`);
    assert.equal(weeklyDoc.totalAttempted, 100);
    assert.equal(weeklyDoc.totalCorrect, 75);
    assert.equal(weeklyDoc.totalPoints, 750);

    // Chunking stress check: 450 buffered items (> SAFE_BATCH_CHUNK_SIZE=400)
    await resetScenario(studentProfile);
    for (let i = 1; i <= 450; i++) {
      simulateAnswerQuestion(i, i % 2 === 0, { deferFlush: true, userProfile: studentProfile });
    }
    const largeRes = await flushStudentWriteBuffer({
      trigger: "test_submission",
      userProfile: studentProfile,
      sessionMeta: { testTitle: "Mega 450 Exam", testType: "full_exam" },
    });
    assert.equal(backend.stats.totalBatchCommits, 2, "452 ops must auto-split into 2 batch chunks");
    assert.ok(
      backend.stats.maxBatchOpCount <= SAFE_BATCH_CHUNK_SIZE,
      `Every batch chunk must stay <= ${SAFE_BATCH_CHUNK_SIZE} ops (got ${backend.stats.maxBatchOpCount})`
    );
    assert.equal(largeRes.remainingOutboxItems, 0);

    console.log(
      `PASS [Scenario 3: 100 MCQs Full Exam] Old=${oldWrites100}, New=${newWrites100} (${reduction100.toFixed(1)}% reduction); 450-op chunk max=${backend.stats.maxBatchOpCount}/${SAFE_BATCH_CHUNK_SIZE}.`
    );
  }

  // ---------------------------------------------------------------------------
  // SCENARIO 4: Network Disconnect During Sync -> Reconnect Recovery
  // ---------------------------------------------------------------------------
  await resetScenario(studentProfile);
  {
    for (let i = 1; i <= 10; i++) {
      simulateAnswerQuestion(i, i <= 6, { deferFlush: true, userProfile: studentProfile });
    }
    const offlineErr: any = new Error("Failed to get document because the client is offline.");
    offlineErr.code = "unavailable";
    backend.failNextBatchError = offlineErr;

    const failedFlush = await flushStudentWriteBuffer({
      trigger: "session_complete",
      userProfile: studentProfile,
    });
    assert.equal(failedFlush.abortedByOffline, true, "Unavailable error must abort cleanly as offline");
    assert.equal(failedFlush.remainingOutboxItems, 1, "Failed outbox item MUST be preserved");
    assert.equal(backend.stats.totalLogicalWrites, 0, "0 writes committed while disconnected");

    // Reconnect and replay
    simulatedOnline = true;
    const replayRes = await flushStudentWriteBuffer({
      trigger: "online_resume",
      userProfile: studentProfile,
    });
    assert.equal(replayRes.flushedOutboxItems, 1);
    assert.equal(replayRes.remainingOutboxItems, 0);
    assert.equal(backend.stats.totalLogicalWrites, 13);

    const weekId = getCurrentWeekId();
    assert.equal(backend.docs.get(`user_stats_weekly/${studentProfile.id}_${weekId}`).totalAttempted, 10);
    assert.equal(backend.docs.get(`user_stats_weekly/${studentProfile.id}_${weekId}`).totalCorrect, 6);

    console.log("PASS [Scenario 4: Network Disconnect During Sync] Zero data loss; clean replay on reconnect.");
  }

  // ---------------------------------------------------------------------------
  // SCENARIO 5: App Crash Before Sync
  // ---------------------------------------------------------------------------
  await resetScenario(studentProfile);
  {
    for (let i = 1; i <= 7; i++) {
      simulateAnswerQuestion(i, i <= 5, { deferFlush: true, userProfile: studentProfile });
    }
    assert.equal(backend.stats.totalLogicalWrites, 0);

    // Wipe all RAM state (simulates sudden tab/browser/app crash before sync!)
    __simulateProcessRestartForTests();

    await rehydrateStudentWriteBuffer();
    assert.equal(hasPendingStudentWrites(), true, "Rehydrated buffer MUST recover all 7 staged answers");
    const recoveredSnap = getStudentBufferSnapshot();
    assert.equal(Object.keys(recoveredSnap.staging.pendingProgress).length, 7);
    assert.equal(recoveredSnap.staging.pendingAttempts.length, 7);

    const recoveryRes = await flushStudentWriteBuffer({
      trigger: "crash_recovery",
      userProfile: studentProfile,
    });
    assert.equal(recoveryRes.flushedOutboxItems, 1);
    assert.equal(recoveryRes.totalFirestoreWrites, 10, "7 progress + 1 history + 1 attempt + 1 weekly = 10");
    assert.equal(hasPendingStudentWrites(), false);

    const weekId = getCurrentWeekId();
    const weeklyDoc = backend.docs.get(`user_stats_weekly/${studentProfile.id}_${weekId}`);
    assert.equal(weeklyDoc.totalAttempted, 7);
    assert.equal(weeklyDoc.totalPoints, 50);

    console.log("PASS [Scenario 5: App Crash Before Sync] All 7 unsynced MCQs recovered and committed.");
  }

  // ---------------------------------------------------------------------------
  // SCENARIO 6: App Crash After Commit Before Ack (Zero Duplicate Records)
  // ---------------------------------------------------------------------------
  await resetScenario(studentProfile);
  {
    for (let i = 1; i <= 10; i++) {
      simulateAnswerQuestion(i, i <= 8, { deferFlush: true, userProfile: studentProfile });
    }

    __setStudentBufferTestHooks({
      onAfterNetworkCommitBeforeAck: () => {
        throw new Error("SIMULATED_POWER_LOSS_BEFORE_ACK");
      },
    });

    const interruptedRes = await flushStudentWriteBuffer({
      trigger: "session_complete",
      userProfile: studentProfile,
    });
    assert.equal(interruptedRes.remainingOutboxItems, 1, "Unacknowledged item stays in persistent outbox");
    assert.equal(backend.stats.totalLogicalWrites, 13, "Firestore commit already succeeded before crash");

    // Even stronger check: simulate complete loss of local idempotency keys AND weeklyCommitted flag,
    // keeping ONLY the recovered outbox item (worst-case crash before local checkpoint persisted)
    const rawOutbox = JSON.parse(localStorageShim.getItem("quizpro_student_outbox_v1") || "[]");
    rawOutbox[0].status = "in_flight";
    rawOutbox[0].weeklyCommitted = false;
    rawOutbox[0].committedChunks = [];
    localStorageShim.setItem("quizpro_student_outbox_v1", JSON.stringify(rawOutbox));
    clearCommittedIdempotencyKeys();

    __setStudentBufferTestHooks(null);
    __simulateProcessRestartForTests();
    await rehydrateStudentWriteBuffer();

    const recoveredOutbox = getStudentBufferSnapshot().outbox;
    assert.equal(recoveredOutbox.length, 1);
    assert.equal(recoveredOutbox[0].status, "pending", "Interrupted in_flight item resets to pending cleanly");

    backend.resetStats();
    await flushStudentWriteBuffer({
      trigger: "crash_recovery",
      userProfile: studentProfile,
    });

    const weekId = getCurrentWeekId();
    const weeklyDoc = backend.docs.get(`user_stats_weekly/${studentProfile.id}_${weekId}`);
    assert.equal(weeklyDoc.totalAttempted, 10, "Weekly stats MUST NOT double-count after crash before ack");
    assert.equal(weeklyDoc.totalCorrect, 8);
    assert.equal(weeklyDoc.totalPoints, 80, "Points MUST stay exactly 80 (server processedOpIds dedup)");
    assert.equal(backend.stats.txWrites, 0, "Weekly transaction must skip duplicate opId cleanly");
    assert.equal(getStudentBufferSnapshot().outbox.length, 0, "Outbox acked and cleared after verification");

    console.log("PASS [Scenario 6: App Crash After Commit Before Ack] Zero duplicate points/records via opId dedup.");
  }

  // ---------------------------------------------------------------------------
  // SCENARIO 7: Repeated Sync Idempotency & Quota Exhaustion Protection
  // ---------------------------------------------------------------------------
  await resetScenario(studentProfile);
  {
    for (let i = 1; i <= 10; i++) {
      simulateAnswerQuestion(i, true, { deferFlush: true, userProfile: studentProfile });
    }
    const r1 = await flushStudentWriteBuffer({ trigger: "explicit_sync", userProfile: studentProfile });
    assert.equal(r1.totalFirestoreWrites, 13);

    backend.resetStats();
    const r2 = await flushStudentWriteBuffer({ trigger: "explicit_sync", userProfile: studentProfile });
    const r3 = await flushStudentWriteBuffer({ trigger: "explicit_sync", userProfile: studentProfile });
    assert.equal(r2.skippedReason, "empty");
    assert.equal(r3.skippedReason, "empty");
    assert.equal(backend.stats.totalLogicalWrites, 0, "Repeated sync must execute 0 extra writes");

    // Quota exhaustion test
    setQuotaExhausted(true);
    for (let i = 11; i <= 15; i++) {
      simulateAnswerQuestion(i, true, { deferFlush: true, userProfile: studentProfile });
    }
    const quotaFlush = await flushStudentWriteBuffer({
      trigger: "session_complete",
      userProfile: studentProfile,
    });
    assert.equal(quotaFlush.abortedByQuota, true);
    assert.equal(backend.stats.totalLogicalWrites, 0, "Quota exhaustion must execute 0 writes");
    assert.equal(getStudentBufferSnapshot().outbox.length, 1, "Unflushed batch preserved in outbox until quota resets");

    // Recover after quota reset (e.g., midnight Pacific rollover)
    setQuotaExhausted(false);
    resetQuotaSummary();
    __resetInMemoryStateForTests();
    const postQuotaFlush = await flushStudentWriteBuffer({
      trigger: "app_resume",
      userProfile: studentProfile,
    });
    assert.equal(postQuotaFlush.flushedOutboxItems, 1);
    assert.equal(backend.docs.get(`user_stats_weekly/${studentProfile.id}_${getCurrentWeekId()}`).totalAttempted, 15);

    console.log("PASS [Scenario 7: Repeated Sync & Quota Exhaustion] Zero duplicate writes; pending queue safely replayed.");
  }

  // ---------------------------------------------------------------------------
  // SCENARIO 8: Two Devices Using Same Account (Concurrent Weekly Tx Safety)
  // ---------------------------------------------------------------------------
  await resetScenario(studentProfile);
  {
    const weekId = getCurrentWeekId();
    // Simulate Device A and Device B concurrently committing two distinct session flushes to the same userId_weekId
    await Promise.all([
      commitWeeklyStatsDeltaIdempotent(
        {
          userId: studentProfile.id,
          weekId,
          userName: "Device A",
          userPhoto: "",
          attemptedDelta: 20,
          correctDelta: 15,
          pointsDelta: 150,
        },
        "deviceA_op_1",
        "Device A Flush"
      ),
      commitWeeklyStatsDeltaIdempotent(
        {
          userId: studentProfile.id,
          weekId,
          userName: "Device B",
          userPhoto: "",
          attemptedDelta: 12,
          correctDelta: 9,
          pointsDelta: 90,
        },
        "deviceB_op_1",
        "Device B Flush"
      ),
    ]);

    const weeklyDoc = backend.docs.get(`user_stats_weekly/${studentProfile.id}_${weekId}`);
    assert.equal(weeklyDoc.totalAttempted, 32, "Concurrent multi-device attempted totals must sum accurately");
    assert.equal(weeklyDoc.totalCorrect, 24);
    assert.equal(weeklyDoc.totalPoints, 240);
    assert.deepEqual(weeklyDoc.processedOpIds, ["deviceA_op_1", "deviceB_op_1"]);

    console.log("PASS [Scenario 8: Two Devices Using Same Account] Concurrent deltas preserved (32 attempts, 240 pts).");
  }

  // ---------------------------------------------------------------------------
  // SCENARIO 9: Guest, Admin Preview, Admin Normal Practice, Leaderboard & Live/PYQ
  // ---------------------------------------------------------------------------
  {
    // 9a: Guest session -> 0 cloud writes
    await resetScenario(guestProfile);
    assert.equal(getStudentSyncMode(guestProfile), "guest");
    assert.equal(isStudentTrackingAllowed(guestProfile), false);
    for (let i = 1; i <= 10; i++) {
      simulateAnswerQuestion(i, true, { userProfile: guestProfile });
    }
    const guestFlush = await flushStudentWriteBuffer({ trigger: "session_complete", userProfile: guestProfile });
    assert.equal(guestFlush.skippedReason, "guest");
    assert.equal(backend.stats.totalLogicalWrites, 0, "Guest session must generate 0 Firestore writes");

    // 9b: Admin Preview session -> 0 cloud writes
    await resetScenario(adminProfile);
    setAdminPreviewSession(true);
    assert.equal(getStudentSyncMode(adminProfile), "admin_preview");
    assert.equal(isStudentTrackingAllowed(adminProfile), false);
    for (let i = 1; i <= 10; i++) {
      simulateAnswerQuestion(i, true, { userProfile: adminProfile, isAdminPreview: true });
    }
    await recordAttemptToCloud({
      attemptId: "preview_att_1",
      userId: adminProfile.id,
      testId: "t1",
      correctCount: 5,
    });
    await updateLeaderboardToCloud({
      testId: "t1",
      userId: adminProfile.id,
      userName: "Admin Preview",
      score: 10,
    });
    const previewFlush = await flushStudentWriteBuffer({
      trigger: "test_submission",
      userProfile: adminProfile,
      sessionMeta: { isAdminPreview: true },
    });
    assert.equal(previewFlush.skippedReason, "admin_preview");
    assert.equal(backend.stats.totalLogicalWrites, 0, "Admin preview session must generate 0 Firestore writes");
    setAdminPreviewSession(false);

    // 9c: Admin practicing normally (NOT preview) -> allowed as student!
    await resetScenario(adminProfile);
    assert.equal(getStudentSyncMode(adminProfile), "student");
    assert.equal(isStudentTrackingAllowed(adminProfile), true);
    for (let i = 1; i <= 10; i++) {
      simulateAnswerQuestion(i, true, { userProfile: adminProfile });
    }
    await sleep(50);
    assert.equal(
      backend.stats.totalLogicalWrites,
      13,
      "Admin in normal Student Practice mode must NOT be misclassified as guest"
    );

    // 9d: Official Live Test & PYQ submissions still write when genuine student, blocked when guest
    await resetScenario(guestProfile);
    await submitLiveTestSubmission({
      submissionId: "guest_live_1",
      userId: guestProfile.id,
      userName: "Guest",
      userEmail: "",
      testId: "live_1",
      testTitle: "Live 1",
      score: 10,
      totalMarks: 20,
      correctCount: 5,
      wrongCount: 0,
      unattemptedCount: 5,
      accuracy: 100,
      timeSpentSeconds: 60,
      submittedAt: new Date().toISOString(),
    });
    await recordPYQAttempt({
      attemptId: "guest_pyq_1",
      userId: guestProfile.id,
      paperId: "pyq_1",
      paperTitle: "PYQ 1",
      score: 10,
      totalMarks: 20,
      correctCount: 5,
      wrongCount: 0,
      unattemptedCount: 5,
      accuracy: 100,
      timeSpentSeconds: 60,
      attemptedAt: new Date().toISOString(),
      selectedAnswers: {},
    });
    assert.equal(backend.stats.totalLogicalWrites, 0, "Guest Live Test & PYQ attempts stay local-only");

    await resetScenario(studentProfile);
    await submitLiveTestSubmission({
      submissionId: "stu_live_1",
      userId: studentProfile.id,
      userName: studentProfile.name,
      userEmail: studentProfile.email,
      testId: "live_1",
      testTitle: "Live 1",
      score: 18,
      totalMarks: 20,
      correctCount: 9,
      wrongCount: 1,
      unattemptedCount: 0,
      accuracy: 90,
      timeSpentSeconds: 120,
      submittedAt: new Date().toISOString(),
    });
    await recordPYQAttempt({
      attemptId: "stu_pyq_1",
      userId: studentProfile.id,
      paperId: "pyq_1",
      paperTitle: "PYQ 1",
      score: 16,
      totalMarks: 20,
      correctCount: 8,
      wrongCount: 2,
      unattemptedCount: 0,
      accuracy: 80,
      timeSpentSeconds: 150,
      attemptedAt: new Date().toISOString(),
      selectedAnswers: { q1: 0 },
    });
    assert.ok(backend.docs.has("liveTestSubmissions/stu_live_1"), "Official Live Test submission preserved");
    assert.ok(backend.docs.has("pyq_attempts/stu_pyq_1"), "Official PYQ attempt preserved");

    console.log("PASS [Scenario 9: Session Modes, Admin Practice & Official Live/PYQ] All guards verified.");
  }

  console.log("\nALL PHASE 2 STUDENT WRITE OPTIMIZATION SIMULATIONS PASSED!");
}

main().catch((err) => {
  console.error("PHASE 2 VERIFICATION FAILED:", err);
  process.exit(1);
});
