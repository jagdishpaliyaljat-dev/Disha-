import { JSDOM } from "jsdom";

// 1. Setup JSDOM Environment before any React or component imports
const dom = new JSDOM('<!DOCTYPE html><html><body><div id="root"></div></body></html>', {
  url: "https://ais-dev-422fu3mfig24fzwwfhtxqh-33243668096.asia-east1.run.app/admin",
  pretendToBeVisual: true,
});

const globalKeys = [
  "window",
  "document",
  "localStorage",
  "sessionStorage",
  "location",
  "history",
  "HTMLElement",
  "HTMLInputElement",
  "HTMLButtonElement",
  "HTMLSelectElement",
  "Element",
  "Node",
  "CustomEvent",
  "MouseEvent",
  "KeyboardEvent",
  "Event",
];

for (const key of globalKeys) {
  try {
    Object.defineProperty(globalThis, key, {
      value: (dom.window as any)[key],
      configurable: true,
      writable: true,
    });
  } catch (e) {}
}

try {
  Object.defineProperty(globalThis, "navigator", {
    value: dom.window.navigator,
    configurable: true,
    writable: true,
  });
} catch (e) {}

(globalThis as any).requestAnimationFrame = (cb: FrameRequestCallback) => setTimeout(cb, 16);
(globalThis as any).cancelAnimationFrame = (id: number) => clearTimeout(id);

import { db, firebaseConfig, auth } from "../src/lib/firebase";
import { doc, collection } from "firebase/firestore";
import { saveMCQ, deleteMCQFromCloud } from "../src/utils/firebaseSyncService";
import { guardedGetDoc, guardedOnSnapshot } from "../src/utils/quotaTracker";

// Set mock authenticated admin user for headless CLI runner
let mockUserVal: any = {
  uid: "test-admin-qa-999",
  email: "jagdishpaliyaljat@gmail.com",
  emailVerified: true,
  isAnonymous: false,
  _startProactiveRefresh: () => {},
  _stopProactiveRefresh: () => {},
  getIdToken: async () => "mock-token",
  stsTokenManager: {
    accessToken: "mock-token",
    refreshToken: "mock-refresh-token",
    expirationTime: Date.now() + 3600000,
  },
};

Object.defineProperty(auth, "currentUser", {
  get() { return mockUserVal; },
  set(v) { if (v) mockUserVal = v; },
  configurable: true,
});

async function verifyListenerReceipt(collectionName: string, docId: string): Promise<boolean> {
  return new Promise((resolve) => {
    let resolved = false;
    const q = collection(db, collectionName);
    const unsubscribe = guardedOnSnapshot(
      q,
      "QA",
      `Verify Listener ${collectionName}`,
      (snapshot) => {
        const found = snapshot.docs.some((d: any) => d.id === docId && (d.data() as any).isTest === true);
        if (found && !resolved) {
          resolved = true;
          unsubscribe();
          resolve(true);
        }
      },
      (err) => {
        console.error("Listener error:", err);
      }
    );

    setTimeout(() => {
      if (!resolved) {
        resolved = true;
        unsubscribe();
        resolve(false);
      }
    }, 4000);
  });
}

async function runMCQCycle(cycleNum: number): Promise<boolean> {
  const testId = `TEST_q_sandbox_cycle_${cycleNum}_${Date.now()}`;
  console.log(`\n=== Starting QA Sandbox MCQ Cycle ${cycleNum} ===`);
  console.log(`[Config Check] Project ID: ${firebaseConfig.projectId}, Database ID: ${firebaseConfig.firestoreDatabaseId}`);
  console.log(`[Target Path] /mcqs/${testId}`);

  const testQ: any = {
    id: testId,
    chapterId: "TEST_ch_sandbox_1",
    topicId: "TEST_top_sandbox_1",
    text: `TEST_Sandbox Question Cycle ${cycleNum}?`,
    hindiText: `टेस्ट प्रश्न साइकल ${cycleNum}?`,
    options: ["Option A", "Option B", "Option C", "Option D"],
    hindiOptions: ["विकल्प ए", "विकल्प बी", "विकल्प सी", "विकल्प डी"],
    correctAnswer: 0,
    explanation: `TEST_Explanation for Cycle ${cycleNum}`,
    hindiExplanation: `टेस्ट व्याख्या साइकल ${cycleNum}`,
    difficulty: "medium",
    isUserAdded: true,
    createdAt: new Date().toISOString(),
    isTest: true,
  };

  const start = Date.now();

  // Step 1: Save MCQ
  console.log(`Step 1: Saving test MCQ to Firestore path /mcqs/${testId}...`);
  const saveResult = await saveMCQ(testQ);
  console.log(`  Save Result: success=${saveResult.success}, isFirebase=${saveResult.isFirebase}, msg=${saveResult.message}`);
  if (!saveResult.success) {
    throw new Error(`SAVE_FAILED: ${saveResult.error || saveResult.message}`);
  }

  // Step 2: Read MCQ back directly by document ID
  console.log(`Step 2: Reading back document from /mcqs/${testId}...`);
  const snap = await guardedGetDoc(doc(db, "mcqs", testId), "QA", `Read MCQ Cycle ${cycleNum}`);
  console.log(`  Read Result: exists=${snap.exists()}`);
  if (!snap.exists()) {
    throw new Error(`DOCUMENT_DOES_NOT_EXIST: Document /mcqs/${testId} was not found after save!`);
  }

  const data = snap.data();
  console.log(`  Saved Document Data:`, JSON.stringify(data, null, 2));

  // Step 3: Field Integrity Checks
  if (data.isTest !== true) {
    throw new Error(`MCQ_READ_FAILED: Field 'isTest' is ${data.isTest} (Expected true)`);
  }
  if (data.text !== testQ.text) {
    throw new Error(`FIELD_MISMATCH: text '${data.text}' !== '${testQ.text}'`);
  }
  if (data.topicId !== testQ.topicId) {
    throw new Error(`FIELD_MISMATCH: topicId '${data.topicId}' !== '${testQ.topicId}'`);
  }
  console.log(`  Step 3 PASSED: All saved fields verified successfully.`);

  // Step 4 & 5: Register Snapshot Listener and verify receipt
  console.log(`Step 4: Subscribing snapshot listener on collection 'mcqs'...`);
  const received = await verifyListenerReceipt("mcqs", testId);
  console.log(`  Listener Receipt Verified: ${received}`);
  if (!received) {
    throw new Error("LISTENER_TIMEOUT_4S: Snapshot listener did not receive the expected test document in time.");
  }
  console.log(`  Step 5 PASSED: Snapshot listener received matching document /mcqs/${testId}.`);

  // Step 6 & 7: Cleanup exact test document
  console.log(`Step 6: Cleaning up exact test document /mcqs/${testId}...`);
  const delResult = await deleteMCQFromCloud(testId);
  console.log(`  Delete Result: success=${delResult.success}, msg=${delResult.message}`);

  // Step 8: Verify Cleanup
  const postDelSnap = await guardedGetDoc(doc(db, "mcqs", testId), "QA", `Verify Clean MCQ Cycle ${cycleNum}`);
  console.log(`  Post-Delete Check: exists=${postDelSnap.exists()}`);
  if (postDelSnap.exists()) {
    throw new Error("CLEANUP_FAILED: Document still exists after delete!");
  }
  console.log(`  Step 8 PASSED: Post-delete verification confirmed document removed.`);

  const duration = Date.now() - start;
  console.log(`=== Cycle ${cycleNum} PASSED (${duration}ms) ===\n`);
  return true;
}

async function runAllCycles() {
  console.log("=================================================");
  console.log("QA SANDBOX MCQ ROUND-TRIP ISOLATED TEST HARNESS");
  console.log("=================================================");

  try {
    for (let cycle = 1; cycle <= 3; cycle++) {
      await runMCQCycle(cycle);
      // Brief pause between cycles
      await new Promise((r) => setTimeout(r, 500));
    }
    console.log("SUCCESS: 3/3 CONSECUTIVE QA SANDBOX MCQ CYCLES PASSED 100%!");
    process.exit(0);
  } catch (err: any) {
    console.error("CYCLE_FAILURE:", err.message || String(err));
    process.exit(1);
  }
}

runAllCycles();
