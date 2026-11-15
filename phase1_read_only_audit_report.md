# PHASE 1 – READ-ONLY ARCHITECTURE AUDIT REPORT
**QUIZPRO / DISHA 20-20 — SNAPSHOT-BASED SYNCHRONIZATION MIGRATION**
**Date:** November 14, 2026  
**Execution Mode:** Read-Only Audit (Phase 1)  
**Database:** Firebase Firestore (`ai-studio-quizproshopx-3bfab5fe-4412-4a74-8471-935f57b6f194`)  
**Project ID:** `gen-lang-client-0811306192`  
**Storage Bucket:** `gen-lang-client-0811306192.firebasestorage.app`  

---

## 1. Executive Summary & Objective

In accordance with the **Master Implementation Prompt**, a complete read-only engineering audit was conducted across the codebase, database schemas, caching layers, and synchronization mechanisms.

The objective is to replace the existing fragmented, multi-layer Firebase optimization and caching architecture (which evolved through multiple caching patches, bucket patterns, and quota workarounds) with a **unified Snapshot-Based Synchronization Architecture**:
1. **Local-First Database (IndexedDB):** Primary offline repository for all educational content and user activity.
2. **Version Manifest:** Centralized metadata detailing `snapshotVersion`, `previousSnapshotVersion`, `curriculumVersion`, `mcqVersion`, `checksum`, `publishedAt`, and delta bundles.
3. **Snapshot Storage:** Immutable chunked snapshots stored in Cloud Storage / CDN (`manifests/`, `snapshots/vXXX/`, `deltas/`, `checksums/`).
4. **24-Hour Scheduled Sync Policy:** Deterministic client sync scheduler running local-first on subsequent launches, checking manifests every 24 hours, downloading delta packages or falling back to full snapshots.
5. **Decoupled User Activity Sync:** Durable pending activity queue (`sync_queue`) synchronizing attempts, test results, bookmarks, wrong questions, and revisions independently from educational content.

---

## 2. Complete Inventory of Existing Firebase Optimization & Caching Mechanisms

The audit inspected all caching and sync files across `src/` and identified **8 legacy optimization mechanisms and competing sync engines**:

### 1. `firestoreCache` (5-Minute TTL In-Memory Cache)
- **Location:** `src/utils/quotaTracker.ts` (lines 300–340)
- **Mechanism:** In-memory `Map<string, CacheEntry>` with `CACHE_TTL = 300000` (5 minutes) and `guardedInFlightRequests` deduplication map.
- **Dependencies:** `guardedGetDoc`, `guardedGetDocs`, `clearFirestoreCache`, `getReadOptimizationStats`.
- **Issues Identified:**
  - Designed as a workaround for repeated Firestore queries during rapid navigation.
  - Fragile: resets on page refresh; does not survive tab switches or offline sessions.
  - Obsolete under Snapshot architecture: static educational content is served directly from IndexedDB, requiring 0 Firestore document reads.

### 2. Multi-Store IndexedDB Fragmentation (3 Competing Databases)
- **Database 1 (`quizpro-db-v4`):**
  - **Location:** `src/utils/localDatabaseEngine.ts`
  - **Stores (17):** `subjects`, `chapters`, `topics`, `mcqs`, `pyqs`, `exams`, `curriculum_metadata`, `user_attempts`, `wrong_questions`, `bookmarks`, `test_results`, `revision_history`, `study_logs`, `syllabus_progress`, `sync_queue`, `sync_metadata`, `sync_staging`.
- **Database 2 (`quizpro_persistent_cache_v1`):**
  - **Location:** `src/utils/indexedDbCache.ts`
  - **Stores (5):** `question_bundles`, `curriculum_cache`, `cache_metadata`, `student_buffer_records`, `student_sync_outbox`.
- **Database 3 (`QuizProDB` via localforage):**
  - **Location:** `src/utils/questionBankCache.ts`
  - **Stores (2):** `question_bank_cache`, `question_bank_meta`.
- **Issues Identified:**
  - Three independent IndexedDB databases running concurrently in the user's browser.
  - Questions and curriculum are stored in duplicate copies across `localDatabaseEngine`, `indexedDbCache`, and `questionBankCache`, increasing client storage footprint by 300% and risking stale cache discrepancies.

### 3. Duplicate User Activity Queues
- **Queue A:** `src/utils/studentWriteBuffer.ts` (buffers progress, daily history, and test attempts into `quizpro_student_buffer_v1` / `quizpro_student_outbox_v1` in `quizpro_persistent_cache_v1`).
- **Queue B:** `src/utils/localDatabaseEngine.ts` (`sync_queue` store with `SyncQueueEvent` for attempts, wrong questions, bookmarks, test results, revisions, study logs, syllabus progress).
- **Issues Identified:**
  - When a student answers an MCQ in `App.tsx` (lines 510–530), the event is buffered into `studentWriteBuffer` AND saved into `localDatabaseEngine` revision records.
  - Two competing outboxes attempt to flush progress on network resume, creating potential race conditions and duplicate write attempts.

### 4. Firestore "Bucket Pattern" Bundles (`question_bundles`)
- **Location:** `src/utils/questionBundleService.ts`
- **Mechanism:** Serializes all questions of a topic into a single Firestore document `question_bundles/topic_{topicId}`.
- **Issues Identified:**
  - Topic bundles exceed Firestore document size limits (1 MB) when topics have more than 300–400 MCQs.
  - Causes duplicate storage: questions exist both as individual documents in `mcqs` and embedded in `question_bundles`.
  - Content snapshots in Cloud Storage/IndexedDB render Firestore document bundling obsolete.

### 5. Multi-Fallback Firestore MCQ Fetcher
- **Location:** `src/utils/firebaseSyncService.ts` (`fetchMCQsByTopic`, lines 29–257)
- **Mechanism:** Evaluates 5 cascading fallback queries:
  1. `localDatabaseEngine` check
  2. `loadUserQuestionsStore` (localStorage)
  3. `questionBankCache` (localforage)
  4. Firestore `mcqs` query by `topicId`
  5. Firestore legacy `questions` query by `topicId`
  6. Firestore `mcqs` query by `topic` name
  7. Firestore `questions` query by `topic` name
  8. `fetchAndRefreshFirestoreMCQs` background refresher
- **Issues Identified:**
  - On a cache miss or network glitch, triggers cascading Firestore queries across multiple collections, rapidly consuming daily read quotas.
  - Should be replaced by a single deterministic local IndexedDB lookup backed by Snapshot Manager.

### 6. Legacy Version Checking & Atomic Bump Lock
- **Location:** `src/utils/appVersionService.ts`
- **Mechanism:** Reads `metadata/app_version` document; uses in-process promise locks and `guardedRunTransaction` to bump versions.
- **Dependencies:** `useFirebaseSync.ts`, `syncCoordinator.ts`.
- **Issues Identified:**
  - Lacks SHA-256 checksum validation, delta manifest references, and chunked snapshot file pointers.
  - Reads Firestore `metadata/app_version` directly instead of reading an immutable version manifest.

### 7. Dual Sync Schedulers & Coordinators
- **Coordinator 1:** `src/hooks/useFirebaseSync.ts` (manages `subscribeToMemoizedCurriculumTree`, `flushBufferedWrites`, and manual bulk sync triggers).
- **Coordinator 2:** `src/utils/syncCoordinator.ts` (manages 24-hour sync eligibility, `sync_staging`, cross-tab locking, and changelog downloading).
- **Issues Identified:**
  - Two sync engines running side-by-side in `App.tsx`: `useFirebaseSync` is mounted on line 472, while `syncCoordinator.initializeSync()` is called on line 783.
  - Violates the core rule: *"Do not leave two competing synchronization engines running simultaneously."*

### 8. Real-Time Broadcast & Audit Listeners
- **Location:** `src/App.tsx` (lines 390–465)
- **Mechanism:** Attaches real-time `onSnapshot` listener to `broadcast_notifications` with limit(50).
- **Issues Identified:**
  - While acceptable for push announcements, static educational content listeners must remain strictly detached for students.

---

## 3. Production Data & Entity Counts

An inspection of backup archives, Firestore schema definitions, and local repositories confirms:

| Entity Type | Canonical Collection | Verified Count | Storage Location |
| :--- | :--- | :--- | :--- |
| **MCQs (Question Bank)** | `mcqs` | **576 verified records** | `full_production_backup_576.json`, Firestore `mcqs` |
| **Subjects** | `subjects` | Active curriculum subjects | `recovery_manifest.json`, Firestore `subjects` |
| **Chapters** | `chapters` | Active curriculum chapters | `recovery_manifest.json`, Firestore `chapters` |
| **Topics** | `topics` | Active curriculum topics | `recovery_manifest.json`, Firestore `topics` |
| **Past Year Papers** | `pyq_papers` | 50 papers | Local DB & Firestore |
| **Live Mock Tests** | `liveTests` | Scheduled test suite | Local DB & Firestore |
| **Student Progress** | `users/{uid}/progress` | Dynamic | Local `quizpro-db-v4` & Firestore |
| **Student Attempts** | `attempts` / `user_attempts` | Dynamic | Local `user_attempts` & Firestore `attempts` |

---

## 4. Protected Production Systems (DO NOT REMOVE)

In strict accordance with Section 2 ("CRITICAL SAFETY RULE"):
- **Firebase Authentication:** `src/lib/firebase.ts`, `authMiddleware.ts` (Google Auth, Phone Auth, Anonymous auth).
- **Firestore Security Rules:** `firestore.rules` (723 lines of hardened rules: admin email whitelist, non-anonymous verification, document validators).
- **Server Authorization:** `createRequireVerifiedAdmin`, `createRequireAuthenticatedUser` in `server.ts`.
- **Question IDs:** Stable IDs (`mcq_...`, deterministic hashes) preserved across all transitions.
- **Disaster Recovery & Backup Engine:** `src/server/backupEngine.ts`, `zipEngine.ts`, `typedSerialization.ts` (15/15 passing tests).

---

## 5. Architectural Blueprint for the New System

```
                  +-----------------------------------+
                  |        MOBILE / WEB CLIENT        |
                  +-----------------------------------+
                                    |
                           [APP INITIALIZATION]
                                    |
                                    v
                  +-----------------------------------+
                  |          LOCAL DATABASE           |
                  |         IndexedDB (Unified)       |
                  |         `quizpro-db-v5`           |
                  +-----------------------------------+
                                    |
                           [SNAPSHOT MANAGER]
                                    |
                        (24-Hour Policy Evaluator)
                                    |
               +--------------------+--------------------+
               |                                         |
     [First Installation]                       [Returning User]
               |                                         |
               v                                         v
   Fetch Version Manifest                     Fetch Version Manifest
   (Cloud Storage / CDN)                      (Cloud Storage / CDN)
               |                                         |
   Download Full Snapshot Chunk               Compare Local vs Cloud Version
   Validate SHA-256 Checksum                             |
   Validate Schema & Relational Integrity       +--------+--------+
   Atomic Local Import (Staging -> Commit)      | Same            | Different
               |                                v                 v
               |                            Skip Download    Download Delta Bundle
               |                                             Apply Tombstones/Upserts
               |                                             Validate Integrity
               +--------------------+------------------------+
                                    |
                                    v
                  +-----------------------------------+
                  |         APPLICATION READY         |
                  +-----------------------------------+

               === SEPARATE USER ACTIVITY SYNC FLOW ===

                       [USER PRACTICE / ACTIVITY]
                                    |
                                    v
                  +-----------------------------------+
                  |      LOCAL ACTIVITY DATABASE      |
                  |        (IndexedDB Stores)         |
                  +-----------------------------------+
                                    |
                                    v
                  +-----------------------------------+
                  |        DURABLE SYNC QUEUE         |
                  |    (Idempotent Event Stream)      |
                  +-----------------------------------+
                                    |
                                    v
                  +-----------------------------------+
                  |     BATCH UPLOAD TO FIRESTORE     |
                  |      (Scheduled / 24h Gate)       |
                  +-----------------------------------+
                                    |
                                    v
                  +-----------------------------------+
                  |        SYNC ACKNOWLEDGEMENT       |
                  |     (Mark Synced in Local DB)     |
                  +-----------------------------------+
```

---

## 6. Detailed Migration Plan (Phases 2 through 6)

1. **Phase 2 — Production Backup & Verification:**
   - Create a fresh, verified snapshot backup of all 576 MCQs, curriculum hierarchy, settings, and indexes.
   - Verify backup readability and hash consistency before any architectural changes.

2. **Phase 3 — Unified Snapshot Architecture Implementation:**
   - **`SnapshotManager` (`src/services/snapshot/snapshotManager.ts`):** Orchestrates full snapshot download, checksum validation, chunked unzipping, schema checking, and staging commit.
   - **`ManifestManager` (`src/services/snapshot/manifestManager.ts`):** Manages `VersionManifest` fetching, parsing, caching, and comparison.
   - **`DeltaProcessor` (`src/services/snapshot/deltaProcessor.ts`):** Applies incremental changes, handles tombstones for deletions, updates moved questions across topic mappings.
   - **`UnifiedLocalDatabase` (`src/services/snapshot/localDbRepository.ts`):** Consolidates `quizpro-db-v4`, `quizpro_persistent_cache_v1`, and `question_bank_cache` into a single, clean IndexedDB instance with transactional integrity.
   - **`SyncScheduler` (`src/services/snapshot/syncScheduler.ts`):** Enforces strict 24-hour content synchronization policy without duplicate execution locks.
   - **`UserActivityQueue` (`src/services/snapshot/userActivityQueue.ts`):** Unified, resilient event queue for user attempts, test results, bookmarks, wrong questions, and revisions.

3. **Phase 4 — Controlled Migration:**
   - Migrate existing user progress, bookmarks, and local data cleanly without data loss.
   - Use a feature flag `ENABLE_SNAPSHOT_SYNC` to verify side-by-side without competing engines.

4. **Phase 5 — Legacy Code Removal:**
   - Remove obsolete `firestoreCache` from `quotaTracker.ts`.
   - Remove duplicate `questionBankCache.ts` and `studentWriteBuffer.ts`.
   - Deprecate old `useFirebaseSync` duplicate listeners and replace with `useSnapshotSync`.

5. **Phase 6 & 7 — Verification & Final Acceptance:**
   - Run the 24 mandatory test scenarios (first boot, offline mode, network drops, corrupted checksum, delta sync, question moves, tombstone deletions).
   - Generate performance and billing report with measured read/write reductions.
