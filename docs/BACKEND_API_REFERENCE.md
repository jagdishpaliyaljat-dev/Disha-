# DISHA 20-20 — Backend API & Endpoint Reference

This reference documents the complete inventory of REST API endpoints exposed by the DISHA 20-20 server (`server.ts` and `src/server/vercelHandler.ts`).

---

## 1. Authentication & Security Middleware

Endpoints require one of three security tiers:
1. **Public:** Accessible without credentials. Rate limited by IP.
2. **Authenticated Student (`requireAuthenticatedUser`):** Requires `Authorization: Bearer <Firebase_ID_Token>`. Token must represent a non-blocked, valid user account.
3. **Verified Admin (`requireVerifiedAdmin`):** Requires `Authorization: Bearer <Firebase_ID_Token>`. The authenticated account must have `email_verified == true`, and match a super-admin email allowlist (`zdpaliyal@gmail.com`, `jagdishpaliyaljat@gmail.com`) or possess a valid, non-revoked custom admin claim.

---

## 2. System, Health & SEO Endpoints

### 2.1 Health Check
- **`GET /api/health`**
- **Auth:** Public
- **Description:** Verifies server runtime, Firebase Admin SDK initialization status, and timestamp.
- **Response (200 OK):**
```json
{
  "status": "ok",
  "appName": "DISHA 20-20 (दिशा 20-20)",
  "timestamp": "2026-11-15T03:45:00.000Z",
  "firebaseAdmin": "initialized"
}
```

### 2.2 XML Sitemap & Robots
- **`GET /sitemap.xml`**
  - **Auth:** Public
  - **Description:** Generates dynamic XML sitemap containing canonical URLs for all subjects, chapters, topics, published news articles, and informational pages.
  - **Response (200 OK):** `application/xml`
- **`GET /robots.txt`**
  - **Auth:** Public
  - **Description:** Declares crawler instructions and links to `/sitemap.xml`.
- **`POST /api/sitemap/generate`** / **`POST /api/sitemap/update`**
  - **Auth:** Verified Admin
  - **Description:** Forces regeneration and re-indexing of the dynamic sitemap.
- **`GET /api/sitemap/status`**
  - **Auth:** Public
  - **Description:** Returns metadata regarding the last sitemap generation time and total indexed URL count.

---

## 3. Static Quiz Assets & CDN Endpoints

These endpoints power DISHA's quota-defense strategy by delivering pre-bundled curriculum data with immutable HTTP cache headers (`Cache-Control: public, max-age=31536000, immutable`).

### 3.1 Quiz Version Manifest
- **`GET /api/quiz-assets/version`**
- **Auth:** Public
- **Headers Returned:** `Cache-Control: no-cache, must-revalidate`
- **Response (200 OK):**
```json
{
  "schemaVersion": 5,
  "appVersion": "1.2.0",
  "curriculumVersion": 14,
  "bundleVersions": {
    "top-history-01": 3,
    "top-geography-04": 2
  },
  "updatedAt": "2026-11-14T18:00:00.000Z"
}
```

### 3.2 Full Curriculum Tree
- **`GET /api/quiz-assets/curriculum`**
- **Auth:** Public
- **Query Params:** `?v=<version>`
- **Description:** Returns the entire hierarchy of subjects, chapters, and topics without embedding individual questions.
- **Response (200 OK):**
```json
{
  "version": 14,
  "subjects": [...],
  "chapters": [...],
  "topics": [...]
}
```

### 3.3 Topic Question Bundle
- **`GET /api/quiz-assets/bundle/:topicId`**
- **Auth:** Public
- **Query Params:** `?v=<version>`
- **Description:** Returns all verified questions for the specified `topicId`.
- **Response (200 OK):**
```json
{
  "topicId": "top-history-01",
  "version": 3,
  "count": 45,
  "questions": [
    {
      "id": "q-101",
      "topicId": "top-history-01",
      "chapterId": "chap-01",
      "text": "राजस्थान में 1857 की क्रांति का प्रथम विद्रोह कहाँ हुआ था?",
      "options": ["नसीराबाद", "नीमच", "एरिनपुरा", "कोटा"],
      "correctIndex": 0,
      "explanation": "राजस्थान में 1857 की क्रांति का प्रारंभ 28 मई 1857 को नसीराबाद छावनी से हुआ था।"
    }
  ]
}
```

### 3.4 PYQ Papers Bundle
- **`GET /api/quiz-assets/pyq-papers`**
- **Auth:** Public
- **Description:** Returns the list of all published previous year question papers.

### 3.5 Live Tests Bundle
- **`GET /api/quiz-assets/live-tests`**
- **Auth:** Public
- **Description:** Returns all scheduled and ongoing live test definitions (without answer keys).

### 3.6 Cache Invalidation
- **`POST /api/quiz-assets/invalidate`**
- **Auth:** Verified Admin
- **Description:** Flushes in-memory server bundles and increments version identifiers, prompting clients to fetch fresh assets.

---

## 4. Snapshot & Delta Synchronization Endpoints

### 4.1 Active Manifest
- **`GET /api/manifests/current.json`**
- **Auth:** Public
- **Description:** Returns metadata for the current published full database snapshot.

### 4.2 Snapshot Chunks
- **`GET /api/snapshots/:version/:filename`**
- **Auth:** Public
- **Description:** Streams compressed JSON chunks containing raw database snapshots.

### 4.3 Version Deltas
- **`GET /api/deltas/:filename`**
- **Auth:** Public
- **Description:** Delivers change diffs between two snapshot versions (`upsertSubjects`, `upsertMcqs`, `deletedMcqIds`).

### 4.4 Snapshot Publishing
- **`POST /api/admin/snapshots/publish`**
- **Auth:** Verified Admin
- **Description:** Scans Firestore collections, generates new immutable chunk files, computes SHA-256 checksums, and updates `current.json`.

---

## 5. Live Test Room & Exam Evaluation

### 5.1 Test Room Question Fetch
- **`GET /api/live-tests/:testId`**
- **Auth:** Public / Authenticated
- **Description:** Fetches live test questions. Official answer keys and explanations are omitted from the response until the test window has closed.

### 5.2 Test Submission & Official Evaluation
- **`POST /api/live-tests/:testId/submit`**
- **Auth:** Authenticated Student
- **Request Body:**
```json
{
  "answers": {
    "q-101": 0,
    "q-102": 4,
    "q-103": -1
  },
  "timeSpentSeconds": 5420,
  "submittedAt": "2026-11-15T03:30:00.000Z"
}
```
- **Evaluation Rules Applied:**
  - `Correct Answer`: $+2.0$ marks.
  - `Incorrect Answer`: $-0.66$ marks (1/3 negative marking).
  - `Option 'E' (Not Attempted)`: $0.0$ penalty (validly unattempted).
  - `Completely Blank (-1)`: $-0.66$ penalty (violating RPSC mandatory bubbling rule).
  - `Disqualification Check`: If $> 10\%$ of questions are left completely blank, the submission is flagged `isRpscDisqualified: true`.
- **Response (200 OK):**
```json
{
  "submissionId": "sub_88291",
  "score": 142.66,
  "totalMarks": 200,
  "correctCount": 75,
  "wrongCount": 14,
  "unattemptedECount": 11,
  "completelyBlankCount": 0,
  "isRpscDisqualified": false,
  "accuracy": 84.26,
  "rank": 4
}
```

---

## 6. AI Intelligence & Exam Paper Scanner

### 6.1 Question Paper OCR Extraction
- **`POST /api/exam-paper/extract`**
- **Auth:** Authenticated Student
- **Request Body:**
```json
{
  "imageBase64": "data:image/jpeg;base64,...",
  "mimeType": "image/jpeg",
  "pageNumber": 1
}
```
- **Description:** Invokes multimodal Gemini 2.0 to extract structured questions, options, question numbers, and Devanagari text from scanned OMR/exam sheets.

### 6.2 Semantic Question Matcher
- **`POST /api/exam-paper/match`**
- **Auth:** Authenticated Student
- **Request Body:**
```json
{
  "extractedQuestions": [
    {
      "tempId": "t-1",
      "originalQuestionNumber": 14,
      "text": "राजस्थान का राज्य पक्षी कौन सा है?",
      "options": ["गोडावण", "मोर", "तोता", "कबूतर"]
    }
  ]
}
```
- **Description:** Compares extracted questions against the DISHA question bank using fuzzy token matching and vector embeddings, returning matching scores and categorizations (`exact`, `near_exact`, `similar`, `unmatched`).

### 6.3 MCQ Auto-Formatter
- **`POST /api/ai/format-mcq`**
- **Auth:** Authenticated Student / Admin
- **Description:** Converts unstructured text into a clean, zero-based indexed MCQ JSON schema with Devanagari explanations.

---

## 7. Administrative Backup & Disaster Recovery

### 7.1 Collection Inventory
- **`GET /api/admin/backup/collections`**
- **Auth:** Verified Admin
- **Description:** Returns the complete list of 56 discovered collections available for export.

### 7.2 Trigger Backup Export
- **`POST /api/admin/backup/export`**
- **Auth:** Verified Admin
- **Request Body:**
```json
{
  "scope": "full" // or "selective"
  // "selectedCollections": ["subjects", "chapters", "topics", "mcqs"]
}
```
- **Response (200 OK):**
```json
{
  "jobId": "job_exp_1731632400",
  "status": "running"
}
```

### 7.3 Backup Job Status
- **`GET /api/admin/backup/jobs/:jobId`**
- **Auth:** Verified Admin
- **Description:** Polls ongoing export or restore progress (`progressPercent`, `phase`, `exportedDocuments`).

### 7.4 Download Backup Archive
- **`GET /api/admin/backup/download/:backupId`**
- **Auth:** Verified Admin
- **Description:** Streams the generated `.zip` backup archive.

### 7.5 Validate Uploaded Backup
- **`POST /api/admin/backup/upload-validate`**
- **Auth:** Verified Admin
- **Description:** Verifies zip integrity, parses internal manifests, validates SHA-256 checksums, and reports document counts without modifying database state.

### 7.6 Execute Restore
- **`POST /api/admin/backup/restore`**
- **Auth:** Verified Admin
- **Request Body:**
```json
{
  "backupId": "backup_2026-11-15T02-00-00",
  "strategy": "MERGE_UPSERT" // CLEAN_RESTORE | SKIP_EXISTING | DRY_RUN | MIGRATION_RESTORE
}
```

---

## 8. Administrative AI API Management

- **`GET /api/admin/ai-configs`** — Lists all configured AI provider keys (Gemini, Claude, OpenAI, Groq) with masked secrets and usage metrics.
- **`POST /api/admin/ai-configs`** — Encrypts and adds a new API key to the secure vault.
- **`PUT /api/admin/ai-configs/:id`** — Updates key metadata, priority, or assigned model.
- **`PUT /api/admin/ai-configs/:id/toggle`** — Toggles key active/inactive state.
- **`POST /api/admin/ai-configs/:id/reset`** — Clears error cooldowns and resets failure counts.
- **`DELETE /api/admin/ai-configs/:id`** — Deletes key from encrypted store.
- **`POST /api/ai/test-key`** — Performs an end-to-end test prompt to verify key validity and measure response latency in milliseconds.
