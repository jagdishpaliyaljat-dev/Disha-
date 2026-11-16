# DISHA 20-20 — Firestore Collection & Schema Audit Report

**Audit Level:** Deep Forensic Database Schema & Relationship Inspection  
**Audit Roles:** Senior Firebase Architect, Database Optimization Specialist  
**Target Repository:** `/data/user/0/com.termux/files/home/Disha-`  
**Execution Mode:** 100% Read-Only Forensic Analysis  
**Output Deliverable:** Phase 5 Collection-by-Collection Schema Specification  

---

## Executive Summary

This report performs a comprehensive structural analysis of all collections and subcollections in DISHA 20-20's dedicated Google Cloud Firestore database (`ai-studio-quizproshopx-3bfab5fe-4412-4a74-8471-935f57b6f194`).

Every active and legacy collection is documented with its primary purpose, document fields, relational foreign keys, code read/write sites, consumer features, ID stability conventions, and composite index requirements.

> [!CAUTION]
> **Zero Modification Rule:** This audit is 100% read-only. No records, collections, documents, or schema properties have been altered, deleted, or migrated.

---

## 1. Inventory & Structural Profiles of All Firestore Collections

---

### Collection 01: `subjects` (and `curriculum`)
- **Primary Purpose:** Top-level curriculum domain (e.g., Rajasthan History, Art & Culture, Geography, Polity, Economics).
- **Document Structure:**
  ```json
  {
    "id": "sub_rajasthan_history",
    "name": "राजस्थान का इतिहास",
    "englishName": "History of Rajasthan",
    "icon": "Landmark",
    "order": 1,
    "chapterCount": 14,
    "questionCount": 1250,
    "updatedAt": "2026-11-14T10:00:00.000Z"
  }
  ```
- **Document ID Stability:** **Deterministic** (`sub_<slug>`). Stable across environments.
- **Relational Keys:** Parent to `chapters.subjectId`.
- **Read Sites in Code:** `useFirebaseSync.ts`, `localDatabaseEngine.ts`, `questionsStorage.ts`.
- **Write Sites in Code:** `AddSubjectModal.tsx`, `questionsStorage.ts` (`addSubject`, `deleteSubject`).
- **User Features:** `TopicsTab`, `HomeTab` Quick Grid, `AnalyticsTab`.
- **Admin Features:** `AdminSyllabusSection`, `ManageSyllabusModal`.
- **Indexing:** Ascending index on `order` for sorted UI rendering.

---

### Collection 02: `chapters`
- **Primary Purpose:** Curricular chapters belonging to subjects (e.g., Prajamandal Movement, 1857 Revolt).
- **Document Structure:**
  ```json
  {
    "id": "chap_prajamandal",
    "subjectId": "sub_rajasthan_history",
    "title": "राजस्थान के प्रजामण्डल आन्दोलन",
    "englishTitle": "Prajamandal Movements in Rajasthan",
    "order": 4,
    "topicCount": 6,
    "questionCount": 185,
    "updatedAt": "2026-11-14T10:00:00.000Z"
  }
  ```
- **Document ID Stability:** **Deterministic** (`chap_<slug>`).
- **Relational Keys:** Foreign key `subjectId` -> `subjects.id`. Parent to `topics.chapterId`.
- **Read/Write Sites:** `useFirebaseSync.ts`, `AddChapterModal.tsx`, `questionsStorage.ts`.
- **User Features:** `ChapterDetailView`, `TopicsTab`, `AnalyticsTab`.
- **Admin Features:** `AdminSyllabusSection`, `BulkQuestionDeleteModal`.
- **Indexing:** Composite index on `(subjectId ASC, order ASC)`.

---

### Collection 03: `topics`
- **Primary Purpose:** Granular practice topics within chapters (e.g., Mewar Prajamandal, Marwar Lok Parishad).
- **Document Structure:**
  ```json
  {
    "id": "top_mewar_prajamandal",
    "chapterId": "chap_prajamandal",
    "subjectId": "sub_rajasthan_history",
    "title": "मेवाड़ प्रजामण्डल",
    "order": 1,
    "questionCount": 35,
    "bundleHash": "811c9dc59e3779b9",
    "updatedAt": "2026-11-14T10:00:00.000Z"
  }
  ```
- **Document ID Stability:** **Deterministic** (`top_<slug>`).
- **Relational Keys:** Foreign key `chapterId` -> `chapters.id`, `subjectId` -> `subjects.id`.
- **User Features:** `TopicInteractionModal`, `MCQSessionModal`.
- **Admin Features:** `AddTopicModal`, `ExcelCsvQuestionImporter`.
- **Indexing:** Composite index on `(chapterId ASC, order ASC)`.

---

### Collection 04: `mcqs` (and legacy `questions`)
- **Primary Purpose:** Master repository of authentic multiple-choice questions.
- **Document Structure:**
  ```json
  {
    "id": "mcq-mewar-1857-042",
    "topicId": "top_mewar_prajamandal",
    "chapterId": "chap_prajamandal",
    "subjectId": "sub_rajasthan_history",
    "text": "मेवाड़ प्रजामण्डल की स्थापना किस वर्ष हुई थी?",
    "options": ["1934", "1936", "1938", "1942"],
    "correctIndex": 2,
    "explanation": "मेवाड़ प्रजामण्डल की स्थापना 24 अप्रैल 1938 को बलवंत सिंह मेहता की अध्यक्षता में माणिक्य लाल वर्मा द्वारा की गई थी।",
    "difficulty": "medium",
    "type": "standard",
    "examMeta": {
      "examName": "RAS Pre",
      "examYear": 2021,
      "isPYQ": true
    },
    "contentHash": "a1b2c3d4e5f60718",
    "createdAt": "2026-11-10T00:00:00.000Z",
    "updatedAt": "2026-11-14T10:00:00.000Z"
  }
  ```
- **Document ID Stability:** **Deterministic** (`mcq-<topicPrefix>-<hash>`).
- **Relational Keys:** Foreign key `topicId` -> `topics.id`.
- **Identified Schema Drift:** Older documents contain `tableData` instead of `table`, `matchData` instead of `matchTable`, and `question` instead of `text`.
- **Read Sites in Code:** `commit.ts`, `bulkSyncService.ts`, `AdminDiagnosticsSection.tsx`.
- **User Features:** `MCQSessionModal`, `FullExamModal`, `WrongTab`.
- **Admin Features:** `ManageQuestionsModal`, `BulkQuestionDeleteModal`, `HTMLImportMCQModal`.
- **Indexing:** Single-field index on `topicId ASC`.

---

### Collection 05: `question_bundles`
- **Primary Purpose:** Pre-packaged, compressed JSON documents containing all questions for a single topic. Enables 1-read topic downloading.
- **Document Structure:**
  ```json
  {
    "topicId": "top_mewar_prajamandal",
    "questionCount": 35,
    "contentHash": "9e3779b9811c9dc5",
    "questions": [ /* Array of 35 Question objects */ ],
    "updatedAt": "2026-11-14T10:00:00.000Z"
  }
  ```
- **Document ID Stability:** **Deterministic** (Identical to `topicId`).
- **User Features:** Downloaded by `useFirebaseSync.ts` and unpacked into client IndexedDB.
- **Admin Features:** Written by `commitBatch()` and `bulkSyncService.ts`.
- **Performance Impact:** Eliminates 35 individual question reads down to **1 single bundle read**.

---

### Collection 06: `users`
- **Primary Purpose:** Student user profiles, exam preferences, and security claims.
- **Document Structure:**
  ```json
  {
    "uid": "usr_9J2xK8...",
    "email": "student@example.com",
    "name": "Pooja Sharma",
    "targetExam": "RAS 2026",
    "role": "student",
    "status": "active",
    "createdAt": "2026-10-15T08:00:00.000Z",
    "lastLoginAt": "2026-11-15T12:00:00.000Z"
  }
  ```
- **Document ID Stability:** Binds strictly to Firebase Auth `uid`.
- **User Features:** `ProfileTab`, `BrandSplashAndOnboarding`.
- **Admin Features:** `AdminUserManagementSection` (Promotion to admin, account blocking).

---

### Collection 07: `attempts`
- **Primary Purpose:** Permanent historical record of completed tests and mock exams.
- **Document Structure:**
  ```json
  {
    "attemptId": "att_20261115_001",
    "userId": "usr_9J2xK8...",
    "userName": "Pooja Sharma",
    "testId": "live_ras_pre_mock_01",
    "score": 142.5,
    "accuracy": 84.2,
    "totalQuestions": 150,
    "correctCount": 115,
    "wrongCount": 25,
    "unattemptedCount": 10,
    "timeTakenSeconds": 7200,
    "completedAt": "2026-11-15T10:30:00.000Z"
  }
  ```
- **Relational Keys:** Foreign key `userId` -> `users.uid`.
- **User Features:** `AnalyticsTab`, `SessionLeaderboard`.
- **Admin Features:** `MeritListPdfModal`, `AdminAnalyticsDashboard`.
- **Indexing:** Composite index on `(testId ASC, score DESC)` for live exam merit rank generation.

---

### Collection 08: `live_tests` (and legacy `liveTests`)
- **Primary Purpose:** Scheduled statewide mock exams with live countdown windows.
- **Document Structure:**
  ```json
  {
    "id": "live_ras_2026_01",
    "title": "RAS Pre 2026 Full Length Mock #1",
    "startTime": "2026-11-20T10:00:00.000Z",
    "endTime": "2026-11-20T13:00:00.000Z",
    "durationMinutes": 180,
    "totalQuestions": 150,
    "negativeMarking": 0.33,
    "questionIds": ["mcq-01", "mcq-02", "..."],
    "status": "scheduled"
  }
  ```
- **User Features:** `LiveTestsTab`.
- **Admin Features:** `ManageLiveTestsModal`.

---

### Collection 09: `liveTestAnswerKeys`
- **Primary Purpose:** Official answer keys for live tests. Protected with strict admin-only read rules to prevent client-side cheating before test completion.
- **Security Rule:** `allow read: if isTrustedAdminEmail() || hasAdminClaim();`
- **Server Role:** Server function `/api/live-tests/:id/submit` uses the Admin SDK to read this collection and grade answers securely.

---

### Collection 10: `pyq_papers` (and legacy `pyqPapers`)
- **Primary Purpose:** Previous year exam question papers with metadata and PDF links.
- **Document Structure:**
  ```json
  {
    "id": "pyq_ras_pre_2023",
    "title": "RPSC RAS Pre Exam 2023",
    "examName": "RAS Pre",
    "year": 2023,
    "questionCount": 150,
    "pdfUrl": "https://storage.googleapis.com/.../ras_pre_2023.pdf",
    "isOfficialKeyVerified": true
  }
  ```
- **User Features:** `PYQVaultTab`.
- **Admin Features:** `ManagePYQVaultModal`.

---

### Collection 11: `articles`
- **Primary Purpose:** Educational news, vacancy circulars, syllabus breakdowns, study articles.
- **Document Structure:**
  ```json
  {
    "slug": "rajasthan-cet-graduation-level-exam-date-2026",
    "title": "राजस्थान CET (स्नातक स्तर) परीक्षा तिथि व विस्तृत पाठ्यक्रम 2026",
    "category": "Exam Notifications",
    "blocks": [ /* Array of rich-text / markdown blocks */ ],
    "publishedAt": "2026-11-14T08:00:00.000Z",
    "isPublished": true,
    "seo": { "metaTitle": "...", "metaDescription": "..." }
  }
  ```
- **Document ID Stability:** Deterministic SEO slug.
- **User Features:** `NewsPage`.
- **Admin Features:** `AdminNewsSectionV2`, `ArticleBlockEditorModal`.
- **Indexing:** Single-field index on `publishedAt DESC`.

---

### Collection 12: `banners`
- **Primary Purpose:** Home screen sliding promotional slides.
- **User Features:** `BannerSlides.tsx` in `HomeTab`.
- **Admin Features:** `AdminBannerManagementSection`.

---

### Collection 13: `broadcast_notifications`
- **Primary Purpose:** Real-time push alerts sent to all student devices.
- **User Features:** Real-time listener in `App.tsx`, displayed in `NotificationsPage`.
- **Admin Features:** `AdminNotificationBroadcastSection`.

---

### Collection 14: `question_reports` & `contact_messages`
- **Primary Purpose:** Inbound error reports submitted by students on typos/answers, plus contact inquiries.
- **User Features:** "Report Error" button inside `MCQSessionModal`.
- **Admin Features:** `QuestionReportDesk`, `AdminMessagesSection`.

---

### Collection 15: `metadata`
- **Primary Purpose:** Global system version counters and checksum digests.
- **Key Document:** `metadata/version` -> `{ appVersion: 142, updatedAt: "..." }`.
- **Significance:** Monitored by online students' single listener in `useFirebaseSync.ts` to trigger global cache invalidation.

---

### Collection 16: `adminAuditLogs`
- **Primary Purpose:** Immutable log of administrative operations (deleting subjects, importing MCQs, granting admin roles).
- **Security Rule:** Append-only (`allow create: if isTrustedAdminEmail(); allow update, delete: if false;`).

---

## 2. Ghost & Obsolete Collections Identified

The following collections exist as security rules in `firestore.rules` and target lists in `backupEngine.ts`, but have **0 active runtime UI producers**:

```
Ghost Collections:
  ├── paymentSubmissions       (Abandoned Cashfree payment prototype)
  ├── payment_events           (Abandoned Cashfree payment prototype)
  ├── payment_orders           (Abandoned Cashfree payment prototype)
  ├── premiumPlans             (Abandoned commercial paywall prototype)
  ├── subscriptions            (Abandoned subscription prototype)
  └── user_subscriptions       (Abandoned subscription prototype)
```

### Risk & Inefficiency:
- `backupEngine.ts` executes empty query streams for these 6 collections on every backup job.
- `firestore.rules` parses 120+ lines of redundant security rule blocks.
- **Recommendation:** Prune these collections from `firestore.rules` and `backupEngine.ts`.

---

## 3. Database Health Assessment

```
┌────────────────────────────────────────────────────────────────────────┐
│ FIRESTORE DATABASE HEALTH SCORECARD:                                   │
│                                                                        │
│ • Deterministic ID Stability:  9.5 / 10 (Subjects, Topics, Bundles)    │
│ • Read-Optimization Pattern:  9.0 / 10 (Bundling cuts reads by 95%)   │
│ • Subcollection Isolation:    8.5 / 10 (Clean root separation)         │
│ • Legacy Schema Drift:        5.0 / 10 (tableData/matchData residue)   │
│ • Ghost Collection Hygiene:   6.0 / 10 (6 payment collections remain)  │
│                                                                        │
│ OVERALL DATABASE EFFICIENCY:  7.6 / 10.0 (HEALTHY WITH DEBT)           │
└────────────────────────────────────────────────────────────────────────┘
```
