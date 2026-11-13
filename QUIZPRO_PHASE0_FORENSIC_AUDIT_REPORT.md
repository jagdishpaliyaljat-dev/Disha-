# QUIZPRO – PHASE 0: FORENSIC AUDIT REPORT
**Strict 24-Hour Bidirectional Offline-First Sync Architecture**

## 1. Executive Summary
This forensic audit report inspects the existing QuizPro application architecture to establish a strict 24-hour, local-first, offline-first synchronization model. The goal is to eliminate normal-use Firestore reads and per-activity writes, ensuring that students study 100% locally against IndexedDB, while bidirectional synchronization occurs strictly every 24 hours or on explicit demand.

---

## 2. Codebase Inspection & Findings

### A. Existing Firestore Reads & Writes
- **Normal UI Reads:** The UI layer (`TopicsTab`, `ChapterDetailView`, `WrongTab`) has been migrated to read from local combined stores (`questionsStore`), pre-warmed IndexedDB (`questionBankStore` via `localforage`), and base dataset (`CHAPTERS_DATA`).
- **Real-time Listeners (`onSnapshot`):** 
  - `src/hooks/useFirebaseSync.ts` contains a single memoized curriculum listener on `metadata/app_version` (`subscribeToMemoizedCurriculumTree`) which checks curriculum version updates (0 reads when up-to-date).
  - User progress listeners (`subscribeToUserProgressAndHistory`) listen on `users/{uid}/progress` and `users/{uid}/history`. Under the new 24-hour sync model, these active `onSnapshot` listeners must be disabled during normal study mode.
- **Writes:** Individual student activities are buffered in `studentWriteBuffer.ts` and committed in batched chunks.

### B. Existing IndexedDB & LocalForage Implementations
- **`src/utils/indexedDbCache.ts`**: Implements `QuizProDB` (v2) with object stores:
  - `question_bundles`: Topic-wise MCQ bundles (`topicId` key).
  - `curriculum_cache`: Syllabus tree (`syllabus_tree` key).
  - `cache_metadata`: System metadata and timestamps.
  - `student_buffer_records`: Durable uncommitted student writes.
  - `student_sync_outbox`: Durable crash-recovery sync outbox (`opId` key).
- **`src/utils/questionBankCache.ts`**: Implements robust localforage multi-driver storage (`QuizProDB` / `question_bank_cache` and `question_bank_meta`) with hot memory caching and pre-warming capabilities (`warmQuestionBankCache`).

### C. Authentication & Guest-to-Google Migration
- **Auth Flows:** Supports Firebase Auth (Google Sign-In and Anonymous/Guest mode).
- **Guest Migration:** `guestManager.ts` and `useFirebaseSync.ts` handle transferring local guest attempts and progress to cloud accounts upon successful Google sign-in.

---

## 3. Architecture Gaps & Required Adjustments for 24-Hour Strict Sync

1. **Active Real-Time Listeners:** `useFirebaseSync.ts` currently attaches real-time `onSnapshot` listeners for user progress and history. These must be bypassed or turned off during normal study mode to strictly satisfy *“No automatic real-time progress synchronization”* and *“No unnecessary Firestore listeners.”*
2. **24-Hour Sync Checkpoint Enforcement:** A persistent timestamp tracker (`last_successful_sync_timestamp`) must be enforced in `IndexedDB` or `localStorage` to ensure the Strict Sync Engine rejects any sync request if 24 hours have not elapsed since the last successful sync.
3. **Initial Bootstrap Session:** A dedicated resumable bootstrap loader must verify and download full curriculum and MCQ manifests on first app open, storing everything in IndexedDB without subsequent normal-use reads.

---

## 4. Conclusion & Readiness for Phase 1
Phase 0 Read-Only Forensic Audit is successfully completed without modifying any production data or files. We are fully prepared to proceed to **Phase 1: Local Database Foundation & 24-Hour Sync Checkpoint Registry**.
