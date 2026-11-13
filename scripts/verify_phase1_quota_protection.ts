import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { increment, serverTimestamp, deleteField } from "firebase/firestore";

// Provide deterministic in-memory localStorage + window shims BEFORE importing app modules
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

async function main() {
  const {
    __setFirestoreDriverForTests,
    __resetInMemoryStateForTests,
    guardedSetDoc,
    guardedUpdateDoc,
    guardedDeleteDoc,
    guardedAddDoc,
    guardedWriteBatch,
    guardedRunTransaction,
    isQuotaExhausted,
    setQuotaExhausted,
    getQuotaSummary,
    resetQuotaSummary,
    getPendingWrites,
    getPendingWritesCount,
    clearPendingWrites,
    clearCommittedIdempotencyKeys,
    flushPendingWrites,
    setSimulatedPacificDate,
    getCurrentQuotaDate,
    recordUsage,
  } = await import("../src/utils/quotaTracker");

  const {
    bumpRemoteCurriculumVersion,
    processPendingVersionBumps,
    getPendingVersionBumps,
    clearPendingVersionBumps,
  } = await import("../src/utils/appVersionService");

  const { sanitizeFirestorePayload } = await import("../src/utils/firebaseSyncService");
  const { db } = await import("../src/lib/firebase");

  function resetAllTestState() {
    localStorageShim.clear();
    __resetInMemoryStateForTests();
    clearPendingWrites();
    clearCommittedIdempotencyKeys();
    clearPendingVersionBumps();
    resetQuotaSummary();
  }

  function makeDocRef(collectionName: string, id: string) {
    return {
      id,
      path: `${collectionName}/${id}`,
    } as any;
  }

  function makeColRef(collectionName: string) {
    return {
      path: collectionName,
      id: collectionName,
    } as any;
  }

  let autoIdCounter = 0;

  // ---------------------------------------------------------------------------
  // TEST 1: Quota Breaker Activation (resource-exhausted + proactive threshold)
  // ---------------------------------------------------------------------------
  resetAllTestState();
  {
    let networkDisabledCalls = 0;
    let setDocCalls = 0;

    __setFirestoreDriverForTests({
      disableNetwork: (async () => {
        networkDisabledCalls++;
      }) as any,
      enableNetwork: (async () => {}) as any,
      setDoc: (async () => {
        setDocCalls++;
        const err: any = new Error("Quota limit exceeded");
        err.code = "resource-exhausted";
        throw err;
      }) as any,
    });

    await assert.rejects(
      () => guardedSetDoc(makeDocRef("mcqs", "q1"), { title: "A" }, undefined, "Student", "Test Quota Trip"),
      (err: any) => err?.code === "resource-exhausted"
    );

    assert.equal(isQuotaExhausted(), true, "Circuit breaker must trip on resource-exhausted");
    assert.ok(networkDisabledCalls >= 1, "disableNetwork must be called when breaker trips");
    assert.equal(localStorageShim.getItem("quizpro_quota_exhausted_v1"), "true");
    assert.equal(localStorageShim.getItem("quizpro_quota_exhausted_date_v1"), getCurrentQuotaDate());

    const summaryAfterTrip = getQuotaSummary();
    assert.equal(summaryAfterTrip.writes, 0, "Failed resource-exhausted write must NOT count in confirmed writes");
    assert.equal(summaryAfterTrip.successfulWrites, 0);
    assert.equal(summaryAfterTrip.failedWrites, 1);
    assert.equal(summaryAfterTrip.attemptedWrites, 1);
    assert.equal(getPendingWritesCount(), 1, "Blocked/failed write must be preserved in pending queue");

    // Subsequent write must NOT hit setDoc driver at all
    await assert.rejects(
      () => guardedSetDoc(makeDocRef("mcqs", "q2"), { title: "B" }, undefined, "Student", "Second Blocked Write"),
      (err: any) => err?.code === "resource-exhausted" && err?.isQuotaBlocked === true
    );
    assert.equal(setDocCalls, 1, "Circuit breaker must stop repeated writes after tripping");

    // Proactive threshold (>= 19,500) must also latch persistently
    resetAllTestState();
    __setFirestoreDriverForTests({
      disableNetwork: (async () => {}) as any,
      enableNetwork: (async () => {}) as any,
    });
    recordUsage({ category: "Student", actionName: "High Volume Bulk", collectionName: "mcqs", writes: 19500 });
    assert.equal(isQuotaExhausted(), true, "Proactive threshold >= 19500 must trip breaker");
    assert.equal(localStorageShim.getItem("quizpro_quota_exhausted_v1"), "true");
  }
  console.log("PASS [Test 1] Quota breaker activation & proactive latch verified.");

  // ---------------------------------------------------------------------------
  // TEST 2: Admin Write Protection (Admin category must NOT bypass breaker)
  // ---------------------------------------------------------------------------
  resetAllTestState();
  {
    let rawDriverCalls = 0;
    __setFirestoreDriverForTests({
      disableNetwork: (async () => {}) as any,
      enableNetwork: (async () => {}) as any,
      doc: ((_fs: any, ...segments: string[]) => {
        if (segments.length === 0) {
          autoIdCounter++;
          return makeDocRef("notifications", `gen_${autoIdCounter}`);
        }
        if (segments.length === 1 && typeof _fs?.path === "string") {
          return makeDocRef(_fs.path, segments[0]);
        }
        return makeDocRef(segments[0] || "general", segments[1] || "id");
      }) as any,
      setDoc: (async () => {
        rawDriverCalls++;
      }) as any,
      updateDoc: (async () => {
        rawDriverCalls++;
      }) as any,
      deleteDoc: (async () => {
        rawDriverCalls++;
      }) as any,
      writeBatch: (() => ({
        set: () => {},
        update: () => {},
        delete: () => {},
        commit: async () => {
          rawDriverCalls++;
        },
      })) as any,
    });

    setQuotaExhausted(true);
    assert.equal(isQuotaExhausted(), true);

    await assert.rejects(
      () => guardedSetDoc(makeDocRef("mcqs", "admin_q1"), { q: 1 }, undefined, "Admin", "Admin Set"),
      (e: any) => e?.code === "resource-exhausted" && e?.isQuotaBlocked === true
    );
    await assert.rejects(
      () => guardedUpdateDoc(makeDocRef("mcqs", "admin_q1"), { q: 2 }, "Admin", "Admin Update"),
      (e: any) => e?.code === "resource-exhausted" && e?.isQuotaBlocked === true
    );
    await assert.rejects(
      () => guardedDeleteDoc(makeDocRef("mcqs", "admin_q1"), "Admin", "Admin Delete"),
      (e: any) => e?.code === "resource-exhausted" && e?.isQuotaBlocked === true
    );
    await assert.rejects(
      () => guardedAddDoc(makeColRef("broadcast_notifications"), { msg: "hi" }, "Admin", "Admin Add"),
      (e: any) => e?.code === "resource-exhausted" && e?.isQuotaBlocked === true
    );
    const adminBatch = guardedWriteBatch(db);
    adminBatch.set(makeDocRef("subjects", "s1"), { name: "Math" });
    await assert.rejects(
      () => adminBatch.commit("Admin", "Admin Batch"),
      (e: any) => e?.code === "resource-exhausted" && e?.isQuotaBlocked === true
    );

    assert.equal(rawDriverCalls, 0, "Admin writes must NEVER bypass active quota circuit breaker");
    assert.equal(getPendingWritesCount(), 5, "All 5 Admin operations must be safely queued");
  }
  console.log("PASS [Test 2] Admin write protection & queue preservation verified.");

  // ---------------------------------------------------------------------------
  // TEST 3: Metadata Write Protection & Version Bump Non-Reset
  // ---------------------------------------------------------------------------
  resetAllTestState();
  {
    let metadataWrites = 0;
    let metadataReads = 0;
    __setFirestoreDriverForTests({
      disableNetwork: (async () => {}) as any,
      enableNetwork: (async () => {}) as any,
      getDoc: (async () => {
        metadataReads++;
        return { exists: () => false, metadata: { fromCache: false } } as any;
      }) as any,
      setDoc: (async () => {
        metadataWrites++;
      }) as any,
      updateDoc: (async () => {
        metadataWrites++;
      }) as any,
    });

    setQuotaExhausted(true);

    // Direct metadata setDoc must block & queue
    await assert.rejects(
      () => guardedSetDoc(makeDocRef("metadata", "app_version"), { curriculumVersion: 99 }, { merge: true }, "Admin", "Direct Metadata Write"),
      (e: any) => e?.code === "resource-exhausted" && e?.isQuotaBlocked === true
    );

    // bumpRemoteCurriculumVersion must NOT clear quota flag and must NOT hit Firestore
    await bumpRemoteCurriculumVersion(["topic_abc"], "Test");
    assert.equal(isQuotaExhausted(), true, "bumpRemoteCurriculumVersion must NEVER reset quotaExhausted latch");
    assert.equal(localStorageShim.getItem("quizpro_quota_exhausted_v1"), "true");
    assert.equal(metadataWrites, 0, "Metadata writes must be blocked when exhausted");
    assert.equal(metadataReads, 0, "bumpRemoteCurriculumVersion must short-circuit when exhausted");
    assert.equal(getPendingVersionBumps().length, 1, "Version bump must remain safely queued");

    const flushedWhileExhausted = await processPendingVersionBumps();
    assert.equal(flushedWhileExhausted, 0);
    assert.equal(getPendingVersionBumps().length, 1);
  }
  console.log("PASS [Test 3] Metadata write protection & version bump safety verified.");

  // ---------------------------------------------------------------------------
  // TEST 4: Raw SDK Write Protection Audit + FieldValue Sentinel Safety
  // ---------------------------------------------------------------------------
  {
    const srcDir = path.resolve(process.cwd(), "src");
    const rawWritePattern = /\b(setDoc|updateDoc|deleteDoc|addDoc|writeBatch|runTransaction)\s*\(/g;
    const violations: string[] = [];

    function walk(dir: string) {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (entry.name === "node_modules" || entry.name === "dist") continue;
          walk(full);
        } else if (/\.(ts|tsx)$/.test(entry.name)) {
          const rel = path.relative(process.cwd(), full);
          if (rel === "src/utils/quotaTracker.ts") continue;
          const content = fs.readFileSync(full, "utf-8");
          let match: RegExpExecArray | null;
          while ((match = rawWritePattern.exec(content)) !== null) {
            // Ignore comments
            const lineStart = content.lastIndexOf("\n", match.index) + 1;
            const line = content.slice(lineStart, content.indexOf("\n", match.index));
            if (line.trim().startsWith("//") || line.trim().startsWith("*")) continue;
            violations.push(`${rel}: ${line.trim()}`);
          }
        }
      }
    }
    walk(srcDir);
    assert.equal(violations.length, 0, `Found unguarded raw Firestore writes in src/: ${violations.join(" | ")}`);

    // Verify sanitizeFirestorePayload preserves Firestore FieldValue sentinels
    const payload = {
      count: increment(3),
      ts: serverTimestamp(),
      removed: deleteField(),
      nestedUndefined: undefined,
      normal: "ok",
    };
    const sanitized = sanitizeFirestorePayload(payload);
    assert.equal((sanitized.count as any)._methodName, "increment");
    assert.equal((sanitized.count as any)._operand, 3);
    assert.equal((sanitized.ts as any)._methodName, "serverTimestamp");
    assert.equal((sanitized.removed as any)._methodName, "deleteField");
    assert.equal("nestedUndefined" in sanitized, false);
    assert.equal(sanitized.normal, "ok");
  }
  console.log("PASS [Test 4] Static raw SDK write audit (0 unguarded writes in src/) & FieldValue preservation verified.");

  // ---------------------------------------------------------------------------
  // TEST 5: Batch Failure Handling (500-op cap, no timeout retry, permanent no-queue)
  // ---------------------------------------------------------------------------
  resetAllTestState();
  {
    let batchCommitAttempts = 0;
    __setFirestoreDriverForTests({
      disableNetwork: (async () => {}) as any,
      enableNetwork: (async () => {}) as any,
      writeBatch: (() => ({
        set: () => {},
        update: () => {},
        delete: () => {},
        commit: async () => {
          batchCommitAttempts++;
          const err: any = new Error("Timeout: Batch Commit");
          err.code = "deadline-exceeded";
          throw err;
        },
      })) as any,
    });

    // 5a: 500-op limit enforcement
    const oversizedBatch = guardedWriteBatch(db);
    for (let i = 0; i < 500; i++) {
      oversizedBatch.set(makeDocRef("mcqs", `doc_${i}`), { i });
    }
    assert.throws(
      () => oversizedBatch.set(makeDocRef("mcqs", "doc_500"), { i: 500 }),
      (e: any) => e?.code === "invalid-argument" && e?.message?.includes("Batch operation limit exceeded")
    );
    assert.equal(batchCommitAttempts, 0, "Oversized batch must reject before calling commit");

    // 5b: Ambiguous deadline-exceeded timeout MUST NOT auto-retry
    const timeoutBatch = guardedWriteBatch(db);
    timeoutBatch.set(makeDocRef("mcqs", "t1"), { a: 1 });
    timeoutBatch.set(makeDocRef("mcqs", "t2"), { a: 2 });
    await assert.rejects(
      () => timeoutBatch.commit("Admin", "Timeout Batch"),
      (e: any) => e?.code === "deadline-exceeded"
    );
    assert.equal(batchCommitAttempts, 1, "Ambiguous deadline-exceeded batch MUST NOT be retried blindly");
    assert.equal(getPendingWritesCount(), 1, "Timed-out batch must be preserved in pending queue");
    const s = getQuotaSummary();
    assert.equal(s.writes, 0, "Timed-out batch must NOT count as confirmed write");
    assert.equal(s.attemptedWrites, 2);
    assert.equal(s.failedWrites, 2);

    // 5c: Permanent failure (permission-denied) must NOT enqueue into recovery queue
    resetAllTestState();
    __setFirestoreDriverForTests({
      setDoc: (async () => {
        const err: any = new Error("Missing or insufficient permissions");
        err.code = "permission-denied";
        throw err;
      }) as any,
    });
    await assert.rejects(
      () => guardedSetDoc(makeDocRef("mcqs", "perm_fail"), { a: 1 }, undefined, "Admin", "Perm Denied Write")
    );
    assert.equal(getPendingWritesCount(), 0, "Permanent permission-denied failure must NOT be queued for retry");
  }
  console.log("PASS [Test 5] Batch limit (500), zero-retry timeout handling, and permanent error handling verified.");

  // ---------------------------------------------------------------------------
  // TEST 6: Transaction Failure Handling (contention retry + resource-exhausted)
  // ---------------------------------------------------------------------------
  resetAllTestState();
  {
    let contentionAttempts = 0;
    __setFirestoreDriverForTests({
      disableNetwork: (async () => {}) as any,
      enableNetwork: (async () => {}) as any,
      runTransaction: (async (_fs: any, fn: any) => {
        // Simulate 1 aborted contention attempt before commit succeeds on attempt 2
        contentionAttempts++;
        await fn({
          get: async () => ({ exists: () => true, data: () => ({ totalPoints: 10 }) }),
          set: () => {},
          update: () => {},
          delete: () => {},
        });
        contentionAttempts++;
        return await fn({
          get: async () => ({ exists: () => true, data: () => ({ totalPoints: 10 }) }),
          set: () => {},
          update: () => {},
          delete: () => {},
        });
      }) as any,
    });

    const out = await guardedRunTransaction(
      db,
      async (tx) => {
        await tx.get(makeDocRef("user_stats_weekly", "u1_2026-01-01"));
        tx.set(makeDocRef("user_stats_weekly", "u1_2026-01-01"), { totalPoints: 20 }, { merge: true });
        return "ok";
      },
      "Student",
      "Tx Contention Test"
    );
    assert.equal(out, "ok");
    assert.equal(contentionAttempts, 2);
    const txSummary = getQuotaSummary();
    assert.equal(txSummary.reads, 1, "Final committed tx read counted ONCE");
    assert.equal(txSummary.writes, 1, "Final committed tx write counted ONCE");
    assert.equal(txSummary.estimatedTransactionOps, 4, "Estimated tx ops captures all contention attempts (2*(1R+1W))");

    // resource-exhausted inside transaction must trip breaker & NOT retry
    let txCallsOnQuota = 0;
    __setFirestoreDriverForTests({
      disableNetwork: (async () => {}) as any,
      enableNetwork: (async () => {}) as any,
      runTransaction: (async () => {
        txCallsOnQuota++;
        const err: any = new Error("Quota limit exceeded");
        err.code = "resource-exhausted";
        throw err;
      }) as any,
    });
    await assert.rejects(
      () => guardedRunTransaction(db, async () => "fail", "Student", "Tx Quota Trip"),
      (e: any) => e?.code === "resource-exhausted"
    );
    assert.equal(txCallsOnQuota, 1);
    assert.equal(isQuotaExhausted(), true);

    await assert.rejects(
      () => guardedRunTransaction(db, async () => "blocked", "Student", "Tx Pre-Blocked"),
      (e: any) => e?.code === "resource-exhausted" && e?.isQuotaBlocked === true
    );
    assert.equal(txCallsOnQuota, 1, "Subsequent tx blocked before calling SDK runTransaction");
  }
  console.log("PASS [Test 6] Transaction semantics, contention op tracking, and breaker protection verified.");

  // ---------------------------------------------------------------------------
  // TEST 7: Retry Duplication Prevention (Idempotency Keys & Pre-generated addDoc ID)
  // ---------------------------------------------------------------------------
  resetAllTestState();
  {
    const writtenPaths: string[] = [];
    __setFirestoreDriverForTests({
      disableNetwork: (async () => {}) as any,
      enableNetwork: (async () => {}) as any,
      doc: ((colOrFs: any, ...segs: string[]) => {
        if (segs.length === 0 && colOrFs?.path) {
          autoIdCounter++;
          return makeDocRef(colOrFs.path, `deterministic_${autoIdCounter}`);
        }
        return makeDocRef(segs[0], segs[1]);
      }) as any,
      setDoc: (async (ref: any) => {
        writtenPaths.push(ref.path);
      }) as any,
    });

    await guardedSetDoc(makeDocRef("mcqs", "dup_doc"), { v: 1 }, undefined, "Admin", "Idemp Save", undefined, 30000, "idem_key_1");
    await guardedSetDoc(makeDocRef("mcqs", "dup_doc"), { v: 1 }, undefined, "Admin", "Idemp Save Replay", undefined, 30000, "idem_key_1");
    assert.equal(writtenPaths.length, 1, "Duplicate call with same idempotencyKey must NOT commit twice");

    // Test guardedAddDoc pre-generates ref when exhausted & replays to SAME path
    setQuotaExhausted(true);
    await assert.rejects(
      () => guardedAddDoc(makeColRef("broadcast_notifications"), { title: "Alert" }, "Admin", "Queued AddDoc"),
      (e: any) => e?.code === "resource-exhausted"
    );
    const pendingBefore = getPendingWrites();
    assert.equal(pendingBefore.length, 1);
    assert.ok(pendingBefore[0].path.startsWith("broadcast_notifications/deterministic_"), "guardedAddDoc must pre-generate doc ID");
  }
  console.log("PASS [Test 7] Idempotency deduplication & deterministic guardedAddDoc verified.");

  // ---------------------------------------------------------------------------
  // TEST 8 & TEST 9: Recovery After Quota Reset + App Restart With Pending Ops
  // ---------------------------------------------------------------------------
  resetAllTestState();
  {
    const committedWrites: Array<{ path: string; data: any }> = [];
    const committedDeletes: string[] = [];
    let enableCalls = 0;

    __setFirestoreDriverForTests({
      disableNetwork: (async () => {}) as any,
      enableNetwork: (async () => {
        enableCalls++;
      }) as any,
      doc: ((_fs: any, ...segments: string[]) => makeDocRef(segments[0], segments[1])) as any,
      setDoc: (async (ref: any, data: any) => {
        committedWrites.push({ path: ref.path, data });
      }) as any,
      updateDoc: (async (ref: any, data: any) => {
        committedWrites.push({ path: ref.path, data });
      }) as any,
      deleteDoc: (async (ref: any) => {
        committedDeletes.push(ref.path);
      }) as any,
    });

    // Session 1: Exhaust quota on day 2026-11-12 and queue writes with FieldValue sentinels
    setSimulatedPacificDate("2026-11-12");
    setQuotaExhausted(true);

    await assert.rejects(() =>
      guardedSetDoc(
        makeDocRef("metadata", "app_version"),
        { curriculumVersion: increment(1), ts: serverTimestamp() },
        { merge: true },
        "Admin",
        "Version Increment Queued"
      )
    );
    await assert.rejects(() =>
      guardedDeleteDoc(makeDocRef("mcqs", "obsolete_q"), "Admin", "Delete Queued")
    );
    assert.equal(getPendingWritesCount(), 2);

    // Simulate App Restart on SAME Pacific day ("2026-11-12"): wipe in-memory state ONLY, keep localStorage
    __resetInMemoryStateForTests();
    setSimulatedPacificDate("2026-11-12");

    assert.equal(isQuotaExhausted(), true, "Breaker must stay LATCHED across app restart on same Pacific day");
    assert.equal(getPendingWritesCount(), 2, "Pending writes must survive app restart");

    const blockedFlush = await flushPendingWrites(db);
    assert.equal(blockedFlush.abortedByQuota, true);
    assert.equal(blockedFlush.flushed, 0);
    assert.equal(getPendingWritesCount(), 2, "Pending queue must NOT be discarded when still exhausted");

    // Simulate Quota Reset on next Pacific day ("2026-11-13") + cold start
    __resetInMemoryStateForTests();
    setSimulatedPacificDate("2026-11-13");

    assert.equal(isQuotaExhausted(), false, "Breaker must reset cleanly after Pacific midnight date change");
    assert.ok(enableCalls >= 1, "enableNetwork must be triggered after Pacific date rollover");

    const flushRes = await flushPendingWrites(db);
    assert.equal(flushRes.flushed, 2);
    assert.equal(flushRes.remaining, 0);
    assert.equal(committedWrites.length, 1);
    assert.equal(committedWrites[0].path, "metadata/app_version");
    assert.equal((committedWrites[0].data.curriculumVersion as any)._methodName, "increment");
    assert.equal((committedWrites[0].data.ts as any)._methodName, "serverTimestamp");
    assert.deepEqual(committedDeletes, ["mcqs/obsolete_q"]);

    // Second flush must be a 0-op no-op
    const secondFlush = await flushPendingWrites(db);
    assert.equal(secondFlush.flushed, 0);
    assert.equal(secondFlush.remaining, 0);
  }
  console.log("PASS [Test 8 & 9] Quota reset recovery, sentinel rehydration, & app restart persistence verified.");

  // Reset simulated date before exit
  setSimulatedPacificDate(null);
  console.log("\nALL 9 PHASE 1 EMERGENCY FIREBASE QUOTA PROTECTION TESTS PASSED.");
}

main().catch((err) => {
  console.error("TEST SUITE FAILED:", err);
  process.exit(1);
});
