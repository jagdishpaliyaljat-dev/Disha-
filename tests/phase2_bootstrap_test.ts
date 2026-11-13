import { executeInitialBootstrap } from "../src/utils/bootstrapService";
import { loadSyncCheckpoint } from "../src/utils/syncCheckpointRegistry";
import { getQuestionBankCacheStats } from "../src/utils/questionBankCache";

async function runPhase2UnitTests() {
  console.log("=== STARTING PHASE 2 BOOTSTRAP UNIT TESTS ===");

  // 1. Check initial checkpoint state before bootstrap
  const initialCp = await loadSyncCheckpoint();
  console.log("Initial Bootstrap Completed Status:", initialCp.bootstrapCompleted);

  // 2. Execute bootstrap simulation (will gracefully handle offline or execute pagination if online)
  const res = await executeInitialBootstrap((state) => {
    console.log(`[Bootstrap Progress] Status: ${state.status}, Dataset: ${state.datasetName}, Count: ${state.downloadedCount}, Progress: ${state.progressPercentage}%`);
  });

  console.log("Bootstrap Execution Result:", res);

  // 3. Verify IndexedDB cache stats after bootstrap attempt
  const stats = await getQuestionBankCacheStats();
  console.log("IndexedDB Question Bank Stats:", stats);

  console.log("=== PHASE 2 BOOTSTRAP UNIT TESTS COMPLETED ===");
}

runPhase2UnitTests().catch((e) => {
  console.error("Phase 2 Tests Failed:", e);
});
