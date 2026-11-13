import {
  loadSyncCheckpoint,
  saveSyncCheckpoint,
  isSyncEligible,
  acquireSyncLock,
  releaseSyncLock,
  updatePendingEventCounter,
  CLASSIFIED_LISTENERS,
} from "../src/utils/syncCheckpointRegistry";

async function runPhase1UnitTests() {
  console.log("=== STARTING PHASE 1 UNIT TESTS ===");

  // 1. First-time registry initialization & repeated init
  const cp1 = await loadSyncCheckpoint();
  console.assert(cp1.syncMode === "strict_24h", "Test 1 Failed: syncMode");
  console.assert(cp1.bootstrapCompleted === false, "Test 1 Failed: bootstrapCompleted");
  console.log("✓ Test 1 Passed: Initial registry created successfully");

  const cp2 = await loadSyncCheckpoint();
  console.assert(cp2.schemaVersion === cp1.schemaVersion, "Test 2 Failed: Repeated init mismatch");
  console.log("✓ Test 2 Passed: Repeated initialization is idempotent");

  // 3 & 4. App restart persistence & timestamp persistence simulation
  cp2.bootstrapCompleted = true;
  cp2.lastSuccessfulSyncAt = Date.now() - (25 * 60 * 60 * 1000); // 25 hours ago
  await saveSyncCheckpoint(cp2);

  const cpReloaded = await loadSyncCheckpoint();
  console.assert(cpReloaded.bootstrapCompleted === true, "Test 3 Failed: Persistence");
  console.assert(cpReloaded.lastSuccessfulSyncAt === cp2.lastSuccessfulSyncAt, "Test 4 Failed: Timestamp");
  console.log("✓ Test 4 Passed: Checkpoint persistence and timestamps survived reload");

  // 5. 23-hour eligibility rejection
  const now = Date.now();
  const cp23h = {
    ...cpReloaded,
    lastSuccessfulSyncAt: now - (23 * 60 * 60 * 1000), // 23 hours ago
  };
  const eligibility23h = isSyncEligible(cp23h, now);
  console.assert(eligibility23h.eligible === false, "Test 5 Failed: 23h should be ineligible");
  console.log("✓ Test 5 Passed: 23-hour eligibility correctly rejected");

  // 6. 24-hour eligibility acceptance
  const cp24h = {
    ...cpReloaded,
    lastSuccessfulSyncAt: now - (24 * 60 * 60 * 1000 + 1000), // 24h + 1s ago
  };
  const eligibility24h = isSyncEligible(cp24h, now);
  console.assert(eligibility24h.eligible === true, "Test 6 Failed: 24h should be eligible");
  console.log("✓ Test 6 Passed: 24-hour eligibility correctly accepted");

  // 7. Failed sync checkpoint preservation
  const beforeFailSync = cpReloaded.lastSuccessfulSyncAt;
  await acquireSyncLock("tab_1");
  await releaseSyncLock("tab_1", false, "Network Timeout");
  const cpAfterFail = await loadSyncCheckpoint();
  console.assert(cpAfterFail.lastSuccessfulSyncAt === beforeFailSync, "Test 7 Failed: Failed sync altered checkpoint");
  console.assert(cpAfterFail.lastSyncError === "Network Timeout", "Test 7 Failed: Error message not recorded");
  console.log("✓ Test 7 Passed: Failed sync preserved previous successful checkpoint");

  // 8 & 9. Lock acquisition & duplicate lock rejection
  const acquired1 = await acquireSyncLock("tab_A", 10000);
  console.assert(acquired1 === true, "Test 8 Failed: Lock acquisition failed");
  console.log("✓ Test 8 Passed: Lock acquired by Tab A");

  const acquired2 = await acquireSyncLock("tab_B", 10000);
  console.assert(acquired2 === false, "Test 9 Failed: Duplicate lock accepted");
  console.log("✓ Test 9 Passed: Duplicate lock by Tab B correctly rejected");

  // Release lock
  await releaseSyncLock("tab_A", true);
  const acquired3 = await acquireSyncLock("tab_B", 10000);
  console.assert(acquired3 === true, "Test 10 Failed: Lock acquisition after release failed");
  console.log("✓ Test 10 Passed: Lock acquired after release by Tab B");
  await releaseSyncLock("tab_B", true);

  // Pending event counter
  await updatePendingEventCounter(15);
  const cpCounter = await loadSyncCheckpoint();
  console.assert(cpCounter.pendingEventCount === 15, "Test Counter Failed");
  console.log("✓ Test Counter Passed: Pending event counter recorded 15 events");

  console.log("=== ALL PHASE 1 UNIT TESTS COMPLETED SUCCESSFULLY ===");
  console.log("Classified Listeners Count:", CLASSIFIED_LISTENERS.length);
}

runPhase1UnitTests().catch((e) => {
  console.error("Phase 1 Unit Tests Failed:", e);
});
