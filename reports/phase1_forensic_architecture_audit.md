# QUIZPRO / DISHA 20-20 — FORENSIC ARCHITECTURE AUDIT REPORT
**Execution Mode:** Read-Only Audit (Phase 1)  
**Date:** November 14, 2026  
**Project ID:** `gen-lang-client-0811306192`  
**Firestore Database ID:** `ai-studio-quizproshopx-3bfab5fe-4412-4a74-8471-935f57b6f194`  
**Storage Bucket:** `gen-lang-client-0811306192.firebasestorage.app`  
**Region:** `asia-east1`  

---

## 1. Executive Summary

This forensic audit was conducted under strict read-only protocols across the entire codebase and cloud configuration. No production data was altered, no documents deleted, and no security rules weakened.

The audit identifies:
- **56 distinct Firestore collections and subcollections** actively referenced across `firestore.rules`, `firebase-blueprint.json`, server endpoints, and frontend services.
- **Hierarchical Document Relationships:** Strict parent-child linkage from `Subject` -> `Chapter` -> `Topic` -> `MCQ`/`Question`, plus assessment bindings (`LiveTest` -> `LiveTestAnswerKey` -> `LiveTestSubmission` -> `Leaderboard`).
- **Firebase Storage:** Provisioning state identified as unprovisioned on current Spark tier; the backup and restore system must gracefully handle both unprovisioned and populated storage buckets without failing.
- **Client & Local Caches:** Distinct delineation between authoritative cloud records and disposable local caches (IndexedDB `quizpro_persistent_cache_v1`, `quizpro-db-v4`, and student study `localStorage` items).
- **Security & Authorization:** Server-side admin verification using `createRequireVerifiedAdmin` (`adminAuth.verifyIdToken(token, true)` with allowlisted admin emails `zdpaliyal@gmail.com` and `jagdishpaliyaljat@gmail.com`).

---

## 2. Complete Firestore Collections & Subcollections Inventory

### A. Curriculum & Question Bank Collections
1. `subjects` — Active curriculum subjects (e.g. Rajasthan History, Economics, Art & Culture).
2. `chapters` — Active curriculum chapters linked via `subjectId`.
3. `topics` — Active curriculum topics linked via `chapterId` and `subjectId`.
4. `mcqs` — Primary question bank documents with `topicId`, `chapterId`, `subjectId`, options, explanation, difficulty.
5. `questions` — Secondary / legacy questions collection.
6. `question_bundles` — Bundled question sets per topic (`topicId` keyPath) for rapid offline synchronization.
7. `archived_mcqs` — Archived/soft-deleted question records for historical audit.
8. `customQuestions` — User-created custom practice questions.
9. `import_batches` — Metadata and tracking for bulk MCQ imports with rollback logs.
10. `curriculum_subjects` — Legacy curriculum subjects (v1 schema).
11. `curriculum_chapters` — Legacy curriculum chapters (v1 schema).
12. `curriculum_questions` — Legacy curriculum questions (v1 schema).
13. `curriculum` — Root curriculum document container (contains `/curriculum/main`).

### B. Assessments, Tests & PYQ Papers
14. `pyq_papers` — Past Year Question papers with metadata (board, year, duration, marks, questionCount).
15. `pyqPapers` — Alternate collection name supported by legacy components.
16. `live_tests` — Scheduled live mock tests.
17. `liveTests` — Active live tests collection used in `ManageLiveTestsModal.tsx`.
18. `live-tests` — Alias pattern mapped in security rules.
19. `tests` — Generic tests collection.
20. `liveTestAnswerKeys` — Admin-only answer keys (`/liveTestAnswerKeys/{testId}`) strictly hidden from students.
21. `exam_categories` — Exam boards/categories (RAS, 1st Grade, 2nd Grade, REET, Patwar).
22. `examCategories` — Active exam categories schema.
23. `coaching` — Coaching institute profiles.
24. `coaching_exams` — Coaching specific exam series.
25. `coaching_test_series` — Coaching mock test bundles.

### C. Student Activity & User Data
26. `users` — Student profiles, target exams, streaks, admin roles, and account statuses.
    - *Subcollections under `/users/{userId}`:*
      - `/progress/{questionId}` — Stage, review date, wrong counts, bookmarks.
      - `/history/{dateKey}` — Daily question attempts and study logs.
      - `/attempts/{attemptId}` — Full test attempt logs with answer choices.
      - `/wrong_questions/{questionId}` — Wrong answer review queue.
      - `/bookmarks/{questionId}` — Saved question bookmarks.
      - `/test_results/{resultId}` — Computed test results and scores.
      - `/revision_history/{recordId}` — Spaced repetition revision records.
      - `/study_logs/{logId}` — Time tracking and study session logs.
      - `/syllabus_progress/{id}` — Subject and chapter completion percentages.
      - `/sync_metadata/{id}` — Client sync checkpoint tracking.
      - `/featureUsage/{periodKey}` — Atomic usage records for quota-capped features.
27. `attempts` — Global test attempts aggregation.
28. `pyq_attempts` — Past year paper test attempts.
29. `leaderboard` — Public test rankings and scores (`{testId}_{userId}`).
30. `user_stats_weekly` — Weekly aggregated leaderboard performance (`{userId}_{weekId}`).
31. `liveTestSubmissions` — Student submission documents for live tests before automated grading.

### D. Content & Communications
32. `articles` — Educational articles and news updates.
    - *Subcollections under `/articles/{articleId}`:*
      - `/blocks/{blockId}` — Modular article content blocks (paragraphs, callouts, MCQs, images, PDFs).
33. `article_categories` — News and article categories.
34. `banners` — Home screen carousel promotional banners.
35. `link_rules` — Auto-linking rules for keyword to topic/article cross-references.
36. `notifications` — In-app notification messages.
37. `broadcast_notifications` — App-wide push notifications and broadcasts.
38. `contact_messages` — Inquiries and feedback submitted by users.

### E. Monetization & Subscriptions
39. `premiumPlans` — Subscription tiers (Free, Pro, Elite) and pricing configurations.
40. `payment_orders` — Cashfree / PG order records.
41. `payment_events` — Immutable webhook audit logs from payment gateways.
42. `user_subscriptions` — Active student subscription licenses.
43. `paymentSubmissions` — Manual payment verification requests.
44. `subscriptions` — Subscriptions ledger.
45. `scanUsage` — OCR and AI scan consumption tracking.

### F. System, Analytics, AI & Infrastructure
46. `metadata` — System state and curriculum metadata (`metadata/syllabus_tree`, `metadata/version`).
47. `settings` — System configurations.
48. `appSettings` — Global feature flags and quota limit policies (`appSettings/featureAccessControl`).
49. `examPaperAnalyses` — Statistical and AI analyses of exam papers.
    - *Subcollections under `/examPaperAnalyses/{analysisId}`:*
      - `/questions/{examQuestionId}` — Per-question item discrimination and difficulty analyses.
50. `ai_api_configs` — Multi-provider AI configurations (Gemini, Groq, OpenAI) with encrypted keys.
51. `usage_daily` — Daily system-wide resource usage.
    - *Subcollections under `/usage_daily/{date}`:*
      - `/devices/{deviceId}` — Unique daily active devices.
52. `analytics_daily` — Aggregated daily counters and metrics.
53. `login_attempts` — Security log of authentication successes and failures.
54. `adminAuditLogs` — Immutable audit trail of administrative actions.
55. `content_changelog` — Changelog entries for sync coordinator.
56. `_health` and `test` — Health probe ping documents (`/test/connection`).

---

## 3. Storage Asset Architecture
- **Bucket Identifier:** `gen-lang-client-0811306192.firebasestorage.app`
- **Expected Asset Paths:**
  - `articles/{articleId}/{filename}` — Article illustrations and inline figures.
  - `banners/{bannerId}/{filename}` — Carousel promotional banners.
  - `pyq_papers/{paperId}/{filename}.pdf` — Official exam paper question PDFs.
  - `diagrams/{questionId}/{filename}.svg` — Geometric and scientific question diagrams.
- **Current Provisioning State:** Unprovisioned on Spark free tier (`404 Not Found` returned on bucket API).
- **Backup Engine Contract:** The backup engine must inspect the bucket. When unprovisioned, it outputs an explicit status `status: 'unprovisioned'` in `storage_manifest.json` without throwing unhandled exceptions. When provisioned, it downloads all objects, preserves directory structures, extracts metadata, and records SHA-256 checksums.

---

## 4. Local Application Storage Architecture
- **IndexedDB Databases:**
  1. `quizpro_persistent_cache_v1` (Version 2):
     - `question_bundles` — Cached topic bundles.
     - `curriculum_cache` — Cached `syllabus_tree`.
     - `cache_metadata` — TTL timestamps.
     - `student_buffer_records` — Pending offline student writes.
     - `student_sync_outbox` — Resilient outbox for crash recovery.
  2. `quizpro-db-v4` (Version 1):
     - 17 unified learning activity stores.
- **LocalStorage Data:**
  - Student progress (`economic_survey_progress_v2`, `economic_survey_user_profile_v1`).
  - System cache versioning (`quizpro_storage_schema_version`, `quizpro_active_curriculum_version`).
  - Transient flags (`quizpro_quota_exhausted_v1`) — **strictly excluded from backup exports**.

---

## 5. Security & Authorization Architecture
- **Server Authentication:** `requireVerifiedAdmin` verifies Firebase ID token via `adminAuth.verifyIdToken(token, true)`:
  - Validates `email_verified === true`.
  - Blocks anonymous sessions (`sign_in_provider !== 'anonymous'`).
  - Strictly matches `AUTHORIZED_ADMIN_EMAILS` (`zdpaliyal@gmail.com`, `jagdishpaliyaljat@gmail.com`).
  - Checks `users/{userId}` document for `blocked !== true` and `revokedAdmin !== true`.
- **Client Security:** Firestore Security Rules enforce default deny `match /{document=**} { allow read, write: if false; }` with granular rules on all collections. Admin role verification is checked with `isAdmin()`.

---

## 6. Audit Conclusion & Readiness
The complete application data footprint is mapped. We now proceed to implement Phase 2 (Backup Engine), Phase 3 (Admin Panel UI), Phase 4 (Import & Preview Engine), Phase 5 (Restore Engine with Production Safeguards), and Phase 6 (End-to-End Verification).
