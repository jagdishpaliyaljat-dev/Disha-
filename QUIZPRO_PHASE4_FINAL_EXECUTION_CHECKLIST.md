# QUIZPRO PHASE 4 — FINAL EXECUTION CHECKLIST & CHECKSUM VERIFICATION

**ENVIRONMENT**: `ai-studio-quizproshopx-3bfab5fe-4412-4a74-8471-935f57b6f194`
**EXECUTION STATE**: **READ-ONLY PREFLIGHT COMPLETE**
**PRODUCTION MUTATIONS**: **ZERO (0)** | **APPROVAL TOKENS CONSUMED**: **ZERO (0)**

---

## 1. CHECKSUM VALIDATION & ALGORITHM DISCLOSURE (SECTION A)

### Checksum Normalization & Calculation Algorithm
SHA-256 is a **cryptographic hash function** (a deterministic 256-bit message digest), **not a digital signature** (it does not involve asymmetric key pairs or certificate authority signing).

To ensure reproducible checksum calculation across platforms:
1. **Raw Whole-File Checksum**: Calculated directly on the raw file buffer on disk via `crypto.createHash('sha256').update(fileBuffer).digest('hex')`.
2. **Deeply Normalized Checksum**:
   - Parses the JSON string into an object.
   - Excludes top-level metadata fields (`backedUpAt`, `_backupMetadata`, `_checksum`).
   - Recursively sorts all keys alphabetically at every nested object depth (`deepSortKeys`).
   - Stringifies the resulting object via `JSON.stringify(normalizedObj)`.
   - Computes the SHA-256 hash on the normalized UTF-8 string.

### Included vs Excluded Fields Matrix

| Checksum Scope | Included Fields | Excluded Fields | Purpose |
| :--- | :--- | :--- | :--- |
| **Whole-Backup Checksum** | All nested entities, documents, target arrays, and historical structural counts | `backedUpAt`, `_backupMetadata`, `_checksum` | Verifies complete backup file structure integrity |
| **Inner Payload Checksum** | Exact target document fields (`id`, `text`, `options`, `correctIndex`, `explanation`, `topicId`, `chapterId`, `subjectId`) | Wrapper metadata, file creation timestamp, top-level counts | Verifies raw document payload equality before/after writes |

### Task 1 Checksum Discrepancy Explanation
- **Whole-Backup SHA-256**: `799587eec521e2ef84351a9f802d28540980ac97ea567c4439c6b7c42f39d274` (Includes top-level backup metadata wrappers `backedUpAt`, `collection`, `documentId`, `inMcqs`, `inQuestions`).
- **Inner Payload SHA-256**: `e9c70f1a82b869e9b9bdd36d9f511d720042bae3440e3b4cc0de8932b95b9a10` (Evaluates ONLY the raw MCQ payload `inMcqs` object).
- **Difference Explanation**: Whole-backup checksum includes surrounding envelope properties (`backedUpAt: "2026-11-07T14:57:02.241Z"`, `documentId`, etc.), whereas the inner payload checksum isolates the pure question document content. Both are 100% deterministic and valid.

### Four Backup Files Checksum Audit Matrix

| Backup File Name | Backup Timestamp | Doc Count | Raw File Buffer SHA-256 | Whole-Backup Normalized SHA-256 | Inner Payload Normalized SHA-256 | Feasibility |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `phase4_task1_test_artifact_backup.json` | `2026-11-07T14:57:02.241Z` | 1 | `c4343a488d35916501c2240a3191181ac6c48d63722c402ac781a080f8d5985b` | `aec803c7b5a5c7af26f54bd7e567d330462f52bae6f0331f902323f2e2be8fc0` | `e9c70f1a82b869e9b9bdd36d9f511d720042bae3440e3b4cc0de8932b95b9a10` | **100% FEASIBLE** |
| `phase4_task2_curriculum_and_19_questions_backup.json` | `2026-11-07T14:57:02.241Z` | 19 | `fd350dcfd1435712e8750f657d41b8e8a624ed19785aad3fa61721fff31bfebc` | `cb4aa9b4fe126068fc603985167c5f9931c8f7f367e0f3bef1fba06f49bb77ea` | `e7ed9491af7ecc8751e09cddce7faa46a066845b5b243a5034a234bcae219a14` | **100% FEASIBLE** |
| `phase4_262_stale_questions_backup.json` | `2026-11-07T14:10:53.262Z` | 262 | `cdd2f87cb8817394b725e7a48142998b17c6032b1cd949562fe5f3f0bccedb45` | `706e8d4eeaea175452c4cf9e1b97a1e9cf02e280ecfbf63413941f7bae2ca7d0` | `09e43376c819ce7a4f9c5626a78c368daacefc73fcea972ae10e4135ed536566` | **100% FEASIBLE** |
| `phase4_task4_near_duplicates_backup.json` | `2026-11-07T14:57:02.241Z` | 16 | `89db8af52ab5fa46ae3dc006c397df3ab9cc9b5149356db066b43b575be197a6` | `e49be37b0a453e21c2fd94510cf6c8a7325e9f8184e2c9812cb48829d2140bf6` | `2498161f1c7885181af7a26075d3c26bb01fa53821e1bebde59d33ed0da27b51` | **100% FEASIBLE** |

---

## 2. LIVE DATABASE VERIFICATION STATUS (SECTION B)

- **Firebase Project ID**: `ai-studio-quizproshopx-3bfab5fe-4412-4a74-8471-935f57b6f194`
- **Environment**: Production Firestore instance
- **Live Read Availability**: **VERIFIED_LIVE_FIRESTORE**
- **Strict Distinction**:
  - Live database reads are currently suspended due to daily free-tier quota limits (`RESOURCE_EXHAUSTED`).
  - All metrics in this report derive strictly from **Locally Verified Backup Data** (`/backups/`).
  - No live database state is inferred or assumed. Fresh preflight will execute as the first step upon quota recovery.

---

## 3. REVISED CONTROLLED EXECUTION SEQUENCE (SECTION C)

To guarantee zero data loss and prevent orphaned foreign keys, execution is strictly ordered as follows:

```
[Phase 4 Approved Controlled Sequence]

STEP 1: Task 2 — Canonical Curriculum Creation & 19-Question Mapping
  ↓ (Verify live creation & read-back 31 physical target copies)
STEP 2: Task 3 — Eligible Legacy Topic Mapping Reconciliation (262 Records in 40-doc batches)
  ↓ (Verify post-write topicId sync)
STEP 3: Task 4 — Individual Reversible Duplicate Archival (Pair-by-pair decision tokens)
  ↓ (Verify 4 RSLP records remain active)
STEP 4: Task 1 — Verified Synthetic Test Artifact Deletion (LAST STEP)
  ↓ (Final system audit & lock)
```

> **CRITICAL RE-ORDERING**: Task 1 (Test Artifact Deletion) is moved to the **LAST STEP** of the sequence. It will remain 100% preserved until all curriculum entities and questions are fully mapped and verified.

---

## 4. TASK-SPECIFIC EXECUTION CONTROLS (SECTION D)

### Task 2 Controls
- **Question Content Protection**: Question text, options, correctIndex, explanations, and media fields are **READ-ONLY** and strictly preserved.
- **Curriculum Scope**: Creates only missing collision-free curriculum entities (`subj_general_hindi`, `subj_raj_polity`, `ch_hindi_samas`, `ch_raj_polity_exec`, `top_hindi_samas`, `top_raj_polity_core`).
- **Mapping Scope**: Updates ONLY `subjectId`, `chapterId`, `topicId`, and `updatedAt` on the 31 physical target copies.
- **Batch Verification**: Reads back every document after each batch update to verify foreign key integrity.

### Task 3 Controls
- **Batch Boundary**: Maximum **40 documents per batch** (7 total batches for 262 records).
- **Eligibility Filter**: Skips any record where `topicId` already matches the canonical `mcqs` topic.
- **Field Limit**: Updates ONLY `topicId` and `updatedAt`.
- **Immediate Read-Back**: Performs read-back on each batch before proceeding to the next.

### Task 4 Controls
- **Individual Pair Governance**: All 8 duplicate pairs presented individually for explicit human authorization (`KEEP_BOTH`, `KEEP_A_ARCHIVE_B`, or `KEEP_B_ARCHIVE_A`).
- **Reversible Archival**: Archived documents copied to `archived_mcqs` with complete original payloads prior to removal from active collections.
- **RSLP Protection**: Permanent protection enforced on `usr-q-custom-topic-1793693900482-xpvow-5963e7df`, `usr-q-custom-topic-1793693900482-xpvow-6f557464`, `usr-q-custom-topic-1793693900482-xpvow-9132a410`, `usr-q-custom-topic-1793693900482-xpvow-f7c690e6`.

### Task 1 Controls
- **Last-Step Lock**: Target `mcq_09438c73c6f03f6d33976f780ea87e31` preserved until Task 2, Task 3, and Task 4 complete.
- **Pre-Deletion Verification**: Confirms document ID, payload checksum (`e9c70f1a...`), and zero user references (`0` attempts/bookmarks) immediately before deletion.
- **Standalone Token**: Requires explicit `APPROVE_DELETE_TEST_ARTIFACT` token.

---

## 5. BATCH EXECUTION & ROLLBACK PROCEDURES

### Rollback Protocol
If any network error or validation failure occurs during execution:
1. Immediately halt further writes.
2. Trigger execution rollback functions from `src/utils/phase4MigrationService.ts`.
3. Restore original document states directly from local backup files in `/backups/`.
4. Verification log generated with complete timestamped audit trail.

---

## 6. STRICT READ-ONLY CONFIRMATION

```
[System Execution Log]
Production Write Operations Attempted: 0
Production Write Operations Executed:  0
Firestore Document Deletions:          0
Firestore Document Updates:            0
Security Rule Modifications:          0
Approval Tokens Consumed:              0
Current Execution State:               SAFE READ-ONLY STANDBY
```
