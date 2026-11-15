# DISHA 20-20 — Firebase & Firestore Database Schema

## 1. Database Topology Overview

**DISHA 20-20** uses **Google Cloud Firestore** (Native Mode) as its primary cloud data store. The database encompasses **56 verified collections**, partitioned into:
1. **Core Curriculum Hierarchy** (Authoritative academic tree)
2. **Student State & Outbox Telemetry** (User documents and subcollections)
3. **Assessment & Testing** (Live tests, PYQ papers, submissions, leaderboards)
4. **Content Management & Publishing** (Articles, blocks, categories, banners)
5. **System Governance, AI Secrets & Auditing** (Logs, configurations, metrics)

---

## 2. Core Curriculum Relational Model

The academic question bank follows a strict 4-level parent-child relational hierarchy:

```
[ subjects ] (e.g. rajasthan-history)
     |
     +---> [ chapters ] (e.g. chap-1857-revolution, subjectId: rajasthan-history)
                |
                +---> [ topics ] (e.g. top-nasirabad-cantt, chapterId: chap-1857-revolution)
                           |
                           +---> [ mcqs / questions ] (topicId: top-nasirabad-cantt)
```

### 2.1 Collection: `subjects`
- **Path:** `/subjects/{id}`
- **Security:** Read: Public | Write: Verified Admin

| Field | Type | Required | Description |
|:---|:---|:---:|:---|
| `id` | String | Yes | Unique identifier (e.g., `"rajasthan-history"`, `"rajasthan-geography"`) |
| `name` | String | Yes | Display name in English / Transliteration |
| `hindiName` | String | Yes | Canonical Devanagari name (e.g., `"राजस्थान का इतिहास"`) |
| `slug` | String | No | URL-safe slug for SEO routing |
| `icon` | String | No | Lucide icon identifier (e.g., `"Landmark"`, `"Map"`) |
| `color` | String | No | Accent gradient / hex color code |
| `description` | String | No | Subject syllabus overview |
| `order` | Number | Yes | Numeric sort order in curriculum explorer |
| `questionCount` | Number | No | Denormalized count of active questions |
| `isUserAdded` | Boolean | No | Flags administrative draft vs production seed |
| `createdAt` | String | No | ISO 8601 creation timestamp |

### 2.2 Collection: `chapters`
- **Path:** `/chapters/{id}`
- **Security:** Read: Public | Write: Verified Admin

| Field | Type | Required | Description |
|:---|:---|:---:|:---|
| `id` | String | Yes | Unique identifier (e.g., `"chap-01"`, `"chap-hist-prajamandal"`) |
| `subjectId` | String | Yes | Foreign key reference to parent `subjects/{id}` |
| `number` | Number | Yes | Academic chapter index |
| `title` | String | Yes | Chapter title |
| `hindiTitle` | String | Yes | Devanagari chapter title |
| `questionCount` | Number | No | Denormalized question count across child topics |
| `isPublished` | Boolean | Yes | Publication visibility toggle |
| `isUserAdded` | Boolean | No | Draft / custom indicator |

### 2.3 Collection: `topics`
- **Path:** `/topics/{id}`
- **Security:** Read: Public | Write: Verified Admin

| Field | Type | Required | Description |
|:---|:---|:---:|:---|
| `id` | String | Yes | Unique identifier (e.g., `"top-nasirabad"`, `"top-general"`) |
| `chapterId` | String | Yes | Foreign key reference to parent `chapters/{id}` |
| `subjectId` | String | No | Denormalized subject reference for query acceleration |
| `title` | String | Yes | Topic title |
| `hindiTitle` | String | Yes | Devanagari topic title |
| `number` | Number | No | Topic sequence number within chapter |
| `slug` | String | No | URL slug |
| `questionCount` | Number | No | Total questions directly assigned to this topic |
| `introText` | String | No | Brief study notes or topic summary |
| `isUserAdded` | Boolean | No | Custom / user-added flag |

### 2.4 Collections: `mcqs` and `questions` (Dual-Write Parity)
- **Path:** `/mcqs/{id}` and `/questions/{id}`
- **Security:** Read: Public | Write: Verified Admin
- **Architecture Note:** The platform maintains dual-write parity between `questions` (legacy store) and `mcqs` (production store) via `mcqCollectionAdapter.ts`.

| Field | Type | Required | Description |
|:---|:---|:---:|:---|
| `id` | String | Yes | Canonical UUID or slug (e.g., `"q_88921"`) |
| `topicId` | String | Yes | Foreign key reference to parent `topics/{id}` |
| `chapterId` | String | Yes | Foreign key reference to parent `chapters/{id}` |
| `subjectId` | String | No | Subject identifier |
| `text` | String | Yes | Primary question text in Devanagari or English |
| `options` | Array<String> | Yes | Array of 4 (or 5) option strings. **Strictly 0-based indexed.** |
| `correctIndex` | Number | Yes | Integer index of the correct option (`0` = A, `1` = B, `2` = C, `3` = D) |
| `explanation` | String | Yes | Comprehensive explanation detailing why the answer is correct |
| `importantFact` | String | No | High-yield memory mnemonic or supplementary exam fact |
| `difficulty` | String | No | `"easy"` \| `"medium"` \| `"hard"` |
| `isNegative` | Boolean | No | Flags negative question phrasing (e.g., "इनमें से कौन सा सही नहीं है?") |
| `questionType` | String | No | `"standard"` \| `"statement"` \| `"assertion_reason"` \| `"match_following"` \| `"table_based"` |
| `statements` | Array | No | Array of numbered statements for multi-statement questions |
| `assertion` | String | No | Assertion text (for Assertion-Reason questions) |
| `reason` | String | No | Reason text (for Assertion-Reason questions) |
| `matchData` | Object | No | `{ listI: string[], listII: string[] }` |
| `matchTable` | Object | No | `{ leftTitle, rightTitle, rows: [{left, right}] }` |
| `table` | Object | No | Structured tabular data `{ headers: string[], rows: string[][] }` |
| `imageUrl` | String | No | URL of reference diagram or map |
| `isPYQ` | Boolean | No | Flag indicating authentic past year question |
| `examName` | String | No | Name of original exam (e.g., `"RAS Pre 2023"`, `"Patwar 2021"`) |
| `examYear` | Number/String | No | Year of examination |
| `examHistory` | Array<Object>| No | Historical occurrences: `[{ examName, year, shift }]` |
| `importBatchId` | String | No | Tracking ID from bulk importer |
| `createdAt` | String | No | ISO 8601 creation timestamp |
| `updatedAt` | String | No | ISO 8601 update timestamp |

---

## 3. Student Profile & Subcollection Architecture

### 3.1 Collection: `users`
- **Path:** `/users/{userId}`
- **Security:** Read: Owner or Admin | Create/Update: Owner (guarded fields) | Admin: Full

```json
{
  "id": "usr_99812",
  "name": "Jagdish Paliyal",
  "email": "student@example.com",
  "role": "student",
  "status": "active",
  "blocked": false,
  "targetExam": "RAS Pre",
  "dailyGoalQuestions": 50,
  "streakDays": 12,
  "loginCount": 45,
  "createdAt": "2026-09-01T10:00:00.000Z",
  "lastLoginAt": "2026-11-15T02:30:00.000Z"
}
```

### 3.2 Subcollection: `users/{userId}/progress`
- **Path:** `/users/{userId}/progress/{questionId}`
- **Security:** Owner or Admin
- **Description:** Leitner spaced repetition tracking for individual questions.

| Field | Type | Description |
|:---|:---|:---|
| `status` | String | `"unattempted"` \| `"correct"` \| `"wrong"` |
| `stage` | Number | Leitner stage index (`0` to `4`) |
| `nextReviewAt` | String | Next due date formatted as `YYYY-MM-DD` |
| `wrongCount` | Number | Cumulative count of incorrect attempts |
| `bookmarked` | Boolean | User bookmark flag |
| `lastAnsweredAt`| String | ISO timestamp of most recent attempt |
| `lastSelectedOption` | Number | Index of selected option |
| `timesAttempted` | Number | Total lifetime attempts |

### 3.3 Subcollection: `users/{userId}/history`
- **Path:** `/users/{userId}/history/{dateKey}` (where `dateKey` is `YYYY-MM-DD`)
- **Description:** Aggregated daily learning statistics.
- **Fields:** `date`, `correct`, `wrong`, `total`, `accuracy`, `studyMinutes`.

### 3.4 Subcollection: `users/{userId}/attempts`
- **Path:** `/users/{userId}/attempts/{attemptId}`
- **Description:** Granular log of every individual question submission.
- **Fields:** `questionId`, `selectedOption`, `correctOption`, `isCorrect`, `timeTakenSeconds`, `attemptedAt`.

---

## 4. Assessment, Live Tests & PYQ Collections

### 4.1 Collection: `live_tests` / `liveTests`
- **Path:** `/live_tests/{id}`
- **Fields:**
  - `id`: Unique test ID (e.g., `"live-ras-pre-mock-01"`).
  - `title`, `hindiTitle`: Test title in English and Devanagari.
  - `examCategory`: Target examination (e.g., `"RAS Pre"`, `"REET"`).
  - `status`: `"live"` \| `"upcoming"` \| `"ended"` \| `"draft"`.
  - `startTime`, `endTime`: ISO scheduling window.
  - `durationMinutes`: Allowed time (e.g., `180`).
  - `totalMarks`: Maximum attainable score (e.g., `200`).
  - `marksPerQuestion`: Standard mark weight (e.g., `1.33` or `2.0`).
  - `negativeMarking`: Negative penalty fraction (e.g., `0.33` = 1/3).
  - `questionCount`: Total questions.
  - `questions`: Array of Question objects (answer keys stripped for students).

### 4.2 Collection: `liveTestAnswerKeys`
- **Path:** `/liveTestAnswerKeys/{testId}`
- **Security:** Read: Verified Admin | Write: Verified Admin (Students can NEVER read this directly).
- **Fields:** `testId`, `keys: Record<questionId, correctIndex>`.

### 4.3 Collection: `liveTestSubmissions`
- **Path:** `/liveTestSubmissions/{submissionId}`
- **Security:** Create: Authenticated Student (own UID) | Read: Owner or Admin.
- **Fields:** `submissionId`, `userId`, `userName`, `testId`, `score`, `totalMarks`, `correctCount`, `wrongCount`, `unattemptedCount`, `unattemptedECount`, `completelyBlankCount`, `isRpscDisqualified`, `accuracy`, `timeSpentSeconds`, `submittedAt`, `rank`.

### 4.4 Collection: `pyq_papers` / `pyqPapers`
- **Path:** `/pyq_papers/{id}`
- **Fields:** `id`, `title`, `hindiTitle`, `examBoard`, `paperYear`, `examDate`, `durationMinutes`, `totalMarks`, `marksPerQuestion`, `negativeMarking`, `questionCount`, `questions`, `pdfUrl`, `isPublished`.

---

## 5. Content Management & News System

### 5.1 Collection: `articles`
- **Path:** `/articles/{articleId}`
- **Fields:**
  - `id`, `slug`, `title`, `hindiTitle`, `subtitle`, `excerpt`.
  - `content`: Markdown text.
  - `blocks`: Array of rich blocks (for `storageVersion == 1`).
  - `category`: `"Exam Notification"` \| `"Study Strategy"` \| `"General"`.
  - `status`: `"published"` \| `"draft"` \| `"scheduled"`.
  - `authorName`, `authorPhotoUrl`.
  - `seoTitle`, `seoDescription`, `canonicalUrl`, `ogImageUrl`.
  - `storageVersion`: `1` (single doc) or `2` (subcollection chunking).

### 5.2 Subcollection: `articles/{articleId}/blocks`
- **Path:** `/articles/{articleId}/blocks/{blockId}`
- **Description:** Used in `storageVersion: 2` for large articles exceeding 1 MB document limits.

### 5.3 Collection: `banners`
- **Path:** `/banners/{id}`
- **Fields:** `id`, `title`, `subtitle`, `badge`, `color`, `iconName`, `actionLabel`, `actionTab`, `isActive`, `order`.

---

## 6. System Governance, Vault & Security Collections

| Collection | Key Fields | Purpose |
|:---|:---|:---|
| `ai_api_configs` | `id`, `name`, `provider`, `apiKey` (AES-256 encrypted), `model`, `enabled`, `priority`, `status`, `cooldownUntil` | Encrypted multi-provider AI credentials |
| `adminAuditLogs` | `id`, `adminId`, `adminEmail`, `action`, `targetUserId`, `reason`, `timestamp`, `details` | Immutable administrative audit trail |
| `login_attempts` | `id`, `email`, `success`, `timestamp`, `reason` | Security login telemetry and brute-force detection |
| `usage_daily` | `date`, `reads`, `writes`, `deletes`, `activeUsers` | Firestore quota consumption tracking |
| `_health` | `id`, `lastPing`, `version` | Server heartbeat and connectivity verification |

---

## 7. Required Firestore Composite Indexes

For multi-property sorting and filtering queries without performance degradation, configure these composite indexes in `firestore.indexes.json`:

```json
{
  "indexes": [
    {
      "collectionGroup": "mcqs",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "topicId", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "liveTestSubmissions",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "testId", "order": "ASCENDING" },
        { "fieldPath": "score", "order": "DESCENDING" },
        { "fieldPath": "timeSpentSeconds", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "articles",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "status", "order": "ASCENDING" },
        { "fieldPath": "publishedAt", "order": "DESCENDING" }
      ]
    }
  ]
}
```
