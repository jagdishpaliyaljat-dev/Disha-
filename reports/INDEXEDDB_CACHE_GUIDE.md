# DISHA 20-20 — IndexedDB v5 Architecture & Cache Engineering

## 1. Local Storage Philosophy & Engineering

**DISHA 20-20 (दिशा 20-20)** implements a carrier-grade local database layer using browser **IndexedDB v5** (`DISHA_2020_LOCAL_V5`). 

IndexedDB v5 serves as the persistent offline runtime database for the entire platform:
- **Zero-Latency Reads:** Local queries for subjects, chapters, topics, and MCQs execute in $2 - 10$ milliseconds.
- **Offline Autonomy:** Complete mock exams, practice drills, and spaced repetition reviews function without network connectivity.
- **Quota Shielding:** Isolates student telemetries (answers, timers, bookmarks) from cloud Firestore writes.

```
+-------------------------------------------------------------------------------+
|                       INDEXEDDB V5 STORAGE ARCHITECTURE                       |
+-------------------+-------------------------------+---------------------------+
| CURRICULUM STORES | USER PROGRESS STORES          | SYSTEM & SYNC STORES      |
+-------------------+-------------------------------+---------------------------+
| - subjects        | - user_progress               | - pending_sync_queue      |
| - chapters        | - attempt_history             | - sync_metadata           |
| - topics          | - bookmarks                   | - snapshot_metadata       |
| - mcqs            | - wrong_questions             | - deleted_records         |
| - question_mapping| - revision_history            | - snapshot_staging        |
| - pyqs            | - test_history                |                           |
|                   | - study_sessions              |                           |
+-------------------+-------------------------------+---------------------------+
```

---

## 2. Complete Inventory of the 18 Object Stores

Implemented in `src/services/snapshot/indexedDbV5.ts`:

### 2.1 Curriculum & Academic Content Stores

#### 1. `subjects`
- **KeyPath:** `id`
- **Indexes:** None (Primary collection accessed as complete set).
- **Contents:** Subject entities (e.g., `rajasthan-history`, `rajasthan-geography`).

#### 2. `chapters`
- **KeyPath:** `id`
- **Indexes:**
  - `idx_chapters_subjectId` (`subjectId`): Enables instant filtering of chapters by parent subject.
- **Contents:** Chapter records with sequence numbers and question counts.

#### 3. `topics`
- **KeyPath:** `id`
- **Indexes:**
  - `idx_topics_chapterId` (`chapterId`): Fetches topics under a specific chapter.
  - `idx_topics_subjectId` (`subjectId`): Accelerates cross-chapter topic searches.
- **Contents:** Granular syllabus topics and student completion percentages.

#### 4. `mcqs`
- **KeyPath:** `id`
- **Indexes:**
  - `idx_mcqs_topicId` (`topicId`): Retrieves all practice questions for a topic.
  - `idx_mcqs_chapterId` (`chapterId`): Supports chapter-level mega sessions.
  - `idx_mcqs_subjectId` (`subjectId`): Queries full subject pools.
  - `idx_mcqs_difficulty` (`difficulty`): Filters by `"easy" | "medium" | "hard"`.
  - `idx_mcqs_isPYQ` (`isPYQ`): Filters authentic past year questions.
- **Contents:** Full question definitions, 0-based options, and Devanagari explanations.

#### 5. `question_mappings`
- **KeyPath:** `questionId`
- **Indexes:**
  - `idx_qm_topicId` (`topicId`): Fast secondary index mapping questions to topics.

#### 6. `pyqs`
- **KeyPath:** `id`
- **Indexes:**
  - `idx_pyqs_examBoard` (`examBoard`): Filters by RPSC, RSMSSB, etc.
  - `idx_pyqs_paperYear` (`paperYear`): Chronological filtering.
- **Contents:** Previous year question paper manifests and attempt records.

---

### 2.2 Student Telemetry & Progress Stores

#### 7. `user_progress`
- **KeyPath:** `id` (Formatted as `q_{questionId}`)
- **Indexes:**
  - `idx_up_stage` (`stage`): Queries Leitner stages ($0$ to $4$).
  - `idx_up_status` (`status`): Filters `"unattempted" | "correct" | "wrong"`.
  - `idx_up_nextReviewAt` (`nextReviewAt`): Retrieves questions due for spaced repetition review.
  - `idx_up_bookmarked` (`bookmarked`): Fast access to bookmarked questions.
- **Contents:** Spaced repetition state, wrong counts, and last answered timestamps.

#### 8. `attempt_history`
- **KeyPath:** `id` (UUID)
- **Indexes:**
  - `idx_ah_questionId` (`questionId`): Per-question attempt logs.
  - `idx_ah_userId` (`userId`): Multi-user isolation.
  - `idx_ah_attemptedAt` (`attemptedAt`): Time-series performance queries.

#### 9. `bookmarks`
- **KeyPath:** `id` (`questionId`)
- **Indexes:**
  - `idx_bm_userId` (`userId`)
  - `idx_bm_topicId` (`topicId`)
  - `idx_bm_createdAt` (`createdAt`)

#### 10. `wrong_questions`
- **KeyPath:** `id` (`questionId`)
- **Indexes:**
  - `idx_wq_userId` (`userId`)
  - `idx_wq_chapterId` (`chapterId`): Group mistakes by chapter.
  - `idx_wq_wrongCount` (`wrongCount`): Prioritizes repeatedly failed questions.

#### 11. `revision_history`
- **KeyPath:** `id`
- **Indexes:**
  - `idx_rh_questionId` (`questionId`)
  - `idx_rh_reviewedAt` (`reviewedAt`)

#### 12. `test_history`
- **KeyPath:** `id` (`testAttemptId`)
- **Indexes:**
  - `idx_th_testId` (`testId`)
  - `idx_th_userId` (`userId`)
  - `idx_th_attemptedAt` (`attemptedAt`)

#### 13. `study_sessions`
- **KeyPath:** `id`
- **Indexes:**
  - `idx_ss_userId` (`userId`)
  - `idx_ss_sessionDate` (`sessionDate`)

---

### 2.3 Synchronization & Outbox Stores

#### 14. `pending_sync_queue`
- **KeyPath:** `eventId` (UUID)
- **Indexes:**
  - `idx_psq_entityType` (`entityType`): `"progress" | "bookmark" | "attempt"`
  - `idx_psq_action` (`action`): `"upsert" | "delete"`
  - `idx_psq_createdAt` (`createdAt`)
- **Contents:** The local outbox buffer that accumulates modifications during study sessions until the 24-hour sync threshold is reached.

#### 15. `sync_metadata`
- **KeyPath:** `key`
- **Contents:** High-water mark timestamps (`lastRoutineSync`, `lastCurriculumSync`, `outboxDrainStatus`).

#### 16. `snapshot_metadata`
- **KeyPath:** `id`
- **Contents:** Local snapshot version (`snapshotVersion`), curriculum checksums, and schema versions.

#### 17. `deleted_records` (Tombstone Store)
- **KeyPath:** `id`
- **Indexes:**
  - `idx_dr_collectionName` (`collectionName`)
  - `idx_dr_deletedAt` (`deletedAt`)
- **Contents:** Preserves tombstone records for deleted topics or questions, preventing re-insertion during delta merges.

#### 18. `snapshot_staging`
- **KeyPath:** `key`
- **Contents:** Temporary staging buffer for streaming snapshot chunks during full database hydration.

---

## 3. Transaction Management & Concurrency Safety

### 3.1 Transaction Isolation
All IndexedDB operations in DISHA 20-20 strictly enforce transaction scoping:
- **Read Operations:** Executed in `readonly` transactions, allowing concurrent access across multiple UI components.
- **Batch Commits:** Executed in atomic `readwrite` transactions. If any individual operation fails (e.g. quota limit), the entire transaction rolls back, preventing partial or corrupted states.

```typescript
export async function batchUpsertMcqs(mcqs: Question[]): Promise<void> {
  const db = await getDbInstance();
  const tx = db.transaction([SNAPSHOT_STORES.MCQS], "readwrite");
  const store = tx.objectStore(SNAPSHOT_STORES.MCQS);

  for (const mcq of mcqs) {
    store.put(mcq);
  }

  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(new Error("Transaction Aborted"));
  });
}
```

---

## 4. Migration Architecture (v4 to v5)

Implemented in `src/services/snapshot/migrationV4toV5.ts`:
- When an existing student opens the updated application, `onupgradeneeded` detects the schema transition from legacy stores to v5.
- The migration coordinator:
  1. Inspects legacy stores (`questions`, `progress`).
  2. Remaps legacy option numbers to canonical 0-based indices ($0..3$).
  3. Reconstructs Leitner spaced repetition intervals to the 5-stage format (`[3, 7, 21, 45, 75]`).
  4. Populates newly indexed object stores without data loss.

---

## 5. Storage Quota & Browser Persistence Protection

Mobile browsers (especially mobile Safari and Chromium under storage pressure) may evict IndexedDB data if storage is not marked persistent.
DISHA 20-20 explicitly requests durable storage during app initialization (`bootstrapService.ts`):

```typescript
if (navigator.storage && navigator.storage.persist) {
  const isPersisted = await navigator.storage.persist();
  console.log(`[Storage] Persistent storage granted: ${isPersisted}`);
}
```
This protects offline question banks and spaced repetition error journals from being purged by the operating system.
