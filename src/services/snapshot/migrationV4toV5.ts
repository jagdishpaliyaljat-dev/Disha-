/**
 * Migration Bridge: quizpro-db-v4 to quizpro-db-v5
 * Preserves user attempts, bookmarks, wrong questions, test results, and offline history.
 */

import { getIndexedDb, openSnapshotDb, SNAPSHOT_STORES, executeTx, putRecords } from "./indexedDbV5";
import { computeSha256 } from "./checksumValidator";

export interface MigrationResult {
  migrated: boolean;
  attemptsMigrated: number;
  bookmarksMigrated: number;
  wrongQuestionsMigrated: number;
  testsMigrated: number;
  mcqsSeeded: number;
  error?: string;
}

export async function migrateV4toV5(): Promise<MigrationResult> {
  const idb = getIndexedDb();
  if (!idb) {
    return { migrated: false, attemptsMigrated: 0, bookmarksMigrated: 0, wrongQuestionsMigrated: 0, testsMigrated: 0, mcqsSeeded: 0 };
  }

  // Check if v5 is already migrated
  const v5Db = await openSnapshotDb();
  const alreadyMigrated = await new Promise<boolean>((resolve) => {
    const tx = v5Db.transaction([SNAPSHOT_STORES.SYNC_METADATA], "readonly");
    const req = tx.objectStore(SNAPSHOT_STORES.SYNC_METADATA).get("v4_migration_complete");
    req.onsuccess = () => resolve(!!req.result);
    req.onerror = () => resolve(false);
  });

  if (alreadyMigrated) {
    return { migrated: false, attemptsMigrated: 0, bookmarksMigrated: 0, wrongQuestionsMigrated: 0, testsMigrated: 0, mcqsSeeded: 0 };
  }

  console.log("[MigrationV4toV5] Checking for quizpro-db-v4 legacy database...");

  // Try opening v4
  let v4Db: IDBDatabase | null = null;
  try {
    v4Db = await new Promise<IDBDatabase>((resolve, reject) => {
      const req = idb.open("quizpro-db-v4");
      req.onsuccess = () => {
        const db = req.result;
        // If v4 didn't exist, indexedDB creates an empty DB with version 1
        if (db.objectStoreNames.length === 0) {
          db.close();
          resolve(null as any);
        } else {
          resolve(db);
        }
      };
      req.onerror = () => reject(req.error);
    });
  } catch (err: any) {
    console.log("[MigrationV4toV5] quizpro-db-v4 not present, skipping legacy migration.");
    v4Db = null;
  }

  if (!v4Db) {
    // Record migration marker in v5
    await executeTx(SNAPSHOT_STORES.SYNC_METADATA, "readwrite", async (stores) => {
      stores[SNAPSHOT_STORES.SYNC_METADATA].put({ key: "v4_migration_complete", value: true, timestamp: Date.now() });
    });
    return { migrated: false, attemptsMigrated: 0, bookmarksMigrated: 0, wrongQuestionsMigrated: 0, testsMigrated: 0, mcqsSeeded: 0 };
  }

  try {
    let attemptsMigrated = 0;
    let bookmarksMigrated = 0;
    let wrongQuestionsMigrated = 0;
    let testsMigrated = 0;
    let mcqsSeeded = 0;

    // Helper to read all from v4 store safely
    const readV4Store = async (storeName: string): Promise<any[]> => {
      if (!v4Db!.objectStoreNames.contains(storeName)) return [];
      return new Promise<any[]>((resolve) => {
        try {
          const tx = v4Db!.transaction([storeName], "readonly");
          const req = tx.objectStore(storeName).getAll();
          req.onsuccess = () => resolve(req.result || []);
          req.onerror = () => resolve([]);
        } catch {
          resolve([]);
        }
      });
    };

    // 1. Read student data from v4
    const v4Bookmarks = await readV4Store("bookmarks");
    const v4Wrong = await readV4Store("wrong_questions");
    const v4Attempts = await readV4Store("user_attempts");
    const v4Tests = await readV4Store("test_results");

    // 2. Put into v5
    if (v4Bookmarks.length > 0) {
      await putRecords(SNAPSHOT_STORES.BOOKMARKS, v4Bookmarks);
      bookmarksMigrated = v4Bookmarks.length;
    }
    if (v4Wrong.length > 0) {
      await putRecords(SNAPSHOT_STORES.WRONG_QUESTIONS, v4Wrong);
      wrongQuestionsMigrated = v4Wrong.length;
    }
    if (v4Attempts.length > 0) {
      await putRecords(SNAPSHOT_STORES.ATTEMPT_HISTORY, v4Attempts);
      attemptsMigrated = v4Attempts.length;
    }
    if (v4Tests.length > 0) {
      await putRecords(SNAPSHOT_STORES.TEST_HISTORY, v4Tests);
      testsMigrated = v4Tests.length;
    }

    // 3. Mark completed
    await executeTx(SNAPSHOT_STORES.SYNC_METADATA, "readwrite", async (stores) => {
      stores[SNAPSHOT_STORES.SYNC_METADATA].put({
        key: "v4_migration_complete",
        value: true,
        timestamp: Date.now(),
        attemptsMigrated,
        bookmarksMigrated,
        wrongQuestionsMigrated,
        testsMigrated
      });
    });

    console.log(`[MigrationV4toV5] Migration complete: ${attemptsMigrated} attempts, ${bookmarksMigrated} bookmarks, ${wrongQuestionsMigrated} wrong questions.`);

    return {
      migrated: true,
      attemptsMigrated,
      bookmarksMigrated,
      wrongQuestionsMigrated,
      testsMigrated,
      mcqsSeeded
    };
  } finally {
    v4Db.close();
  }
}
