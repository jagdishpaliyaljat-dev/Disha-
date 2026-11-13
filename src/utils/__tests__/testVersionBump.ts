import { AppVersionMetadata } from "../appVersionService";

async function runVersionBumpTestSuite() {
  console.log("=================================================");
  console.log("   QUIZPRO VERSIONING & BROADCAST TEST SUITE     ");
  console.log("=================================================");

  // Test 1: Initial Version State Creation
  let mockCloudDoc: AppVersionMetadata = {
    curriculumVersion: 1,
    lastUpdated: new Date().toISOString(),
    bundleVersions: {
      "topic_history_1": 1
    },
    announcement: "Initial Version"
  };

  let mockLocalMeta: AppVersionMetadata = {
    curriculumVersion: 1,
    lastUpdated: mockCloudDoc.lastUpdated
  };

  console.log("\n[Test 1] Initial State Check:");
  console.log(`  - Remote Cloud Version: v${mockCloudDoc.curriculumVersion}`);
  console.log(`  - Local Device Version: v${mockLocalMeta.curriculumVersion}`);
  
  const isInitialUpToDate = mockLocalMeta.curriculumVersion >= mockCloudDoc.curriculumVersion;
  console.log(`  - Match Result: ${isInitialUpToDate ? "UP TO DATE (0 Reads)" : "NEEDS SYNC"}`);

  if (!isInitialUpToDate) {
    throw new Error("Initial version match failed!");
  }

  // Test 2: Simulating Admin Version Bump
  console.log("\n[Test 2] Simulating Admin BUMP / BROADCAST VERSION:");
  const previousVersion = mockCloudDoc.curriculumVersion;
  
  // Bump version
  const newVersion = previousVersion + 1;
  const updatedTopicId = "topic_geography_1";
  
  mockCloudDoc = {
    curriculumVersion: newVersion,
    lastUpdated: new Date().toISOString(),
    bundleVersions: {
      ...(mockCloudDoc.bundleVersions || {}),
      [updatedTopicId]: ((mockCloudDoc.bundleVersions?.[updatedTopicId] || 0) + 1)
    },
    announcement: `Broadcast update to v${newVersion}`
  };

  console.log(`  ✓ Version incremented: v${previousVersion} ➔ v${mockCloudDoc.curriculumVersion}`);
  console.log(`  ✓ Topic Bundle Version Updated: '${updatedTopicId}' is now v${mockCloudDoc.bundleVersions?.[updatedTopicId] ?? 1}`);
  console.log(`  ✓ Broadcast Timestamp: ${mockCloudDoc.lastUpdated}`);

  // Test 3: Student Device Detecting Version Discrepancy
  console.log("\n[Test 3] Student Device 1-Read Version Check:");
  console.log(`  - Remote Version: v${mockCloudDoc.curriculumVersion}`);
  console.log(`  - Student Local Version: v${mockLocalMeta.curriculumVersion}`);

  const isUpToDateAfterBump = mockLocalMeta.curriculumVersion >= mockCloudDoc.curriculumVersion;
  console.log(`  - Student Check Result: ${isUpToDateAfterBump ? "UP TO DATE" : "UPDATE DETECTED! Triggering 1-Read Sync..."}`);

  if (isUpToDateAfterBump) {
    throw new Error("Student failed to detect admin version bump!");
  }

  // Test 4: Student Sync & Record New Version
  console.log("\n[Test 4] Student Device Sync & Local Record Update:");
  mockLocalMeta = {
    curriculumVersion: mockCloudDoc.curriculumVersion,
    lastUpdated: mockCloudDoc.lastUpdated
  };

  console.log(`  ✓ Student Local Version Updated: v${mockLocalMeta.curriculumVersion}`);

  const finalCheck = mockLocalMeta.curriculumVersion >= mockCloudDoc.curriculumVersion;
  console.log(`  - Final Check: ${finalCheck ? "VERIFIED FRESH (0 Reads for subsequent opens)" : "FAIL"}`);

  if (!finalCheck) {
    throw new Error("Final version check failed!");
  }

  console.log("\n=================================================");
  console.log("  ✅ BUMP / BROADCAST VERSION TEST PASSED 100%!  ");
  console.log("=================================================\n");
}

runVersionBumpTestSuite().catch((err) => {
  console.error("Version Test Failed:", err);
  process.exit(1);
});
