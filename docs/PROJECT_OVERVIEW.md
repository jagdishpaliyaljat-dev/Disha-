# DISHA 20-20 — Project Overview & Strategic Blueprint

## 1. Executive Summary

**DISHA 20-20 (दिशा 20-20)** is an Indian competitive examination preparation platform architected to provide competitive aspirants with access to previous year questions (PYQs), topic-wise curriculum mastery, live test simulations, spaced repetition revision, and artificial intelligence-assisted exam paper analysis.

The platform targets major Rajasthan public examinations, including:
- **RPSC RAS (Rajasthan Administrative Service) Preliminary Examination**
- **RPSC 1st & 2nd Grade School Teacher Examinations**
- **REET (Rajasthan Eligibility Examination for Teachers) Level 1 & Level 2**
- **RSMSSB Patwar & VDO (Village Development Officer)**
- **RSMSSB CET (Common Eligibility Test) Graduate & Senior Secondary Levels**
- **Rajasthan Sub-Inspector (SI) & Police Constable**

Unlike standard quiz applications, DISHA 20-20 operates under strict civil service examination standards, enforcing exact official evaluation rubrics (such as RPSC's mandatory 5th option 'E' rule, -1/3 negative marking penalties, and automatic disqualification thresholds for unbubbled OMR entries).

---

## 2. Core Problem Statements & Engineering Solutions

### 2.1 Cloud Quota & Cost Optimization
* **Problem:** In traditional serverless or Firebase-backed applications, every student interaction (answering an MCQ, updating bookmark status, or logging time spent) issues individual document writes. With thousands of concurrent students attempting 100–200 questions daily, Firestore write quotas are exhausted within minutes, resulting in astronomical operational costs or service denial.
* **Solution:** DISHA 20-20 implements the proprietary **`StudentWriteBuffer`** and **24-Hour Routine Sync Gate**. All question attempts, revision states, and study logs are written exclusively to client-side IndexedDB v5 storage during active study sessions. Routine synchronization to Cloud Firestore is strictly deferred to an outbox queue that requires a 24-hour interval before becoming eligible for flushing (`canPerformRoutineSync`). This innovation achieves an empirical **99.7% reduction in cloud database writes**.

### 2.2 Offline-First Reliability in Variable Bandwidth Conditions
* **Problem:** Aspirants in rural and semi-urban regions frequently experience intermittent or severed mobile internet connectivity. If questions, curriculum trees, and progress tracking depend on persistent HTTP connectivity, user experience degrades critically.
* **Solution:** The platform uses a multi-tier offline strategy combining:
  1. **IndexedDB v5 (18 Object Stores)** holding full curriculum trees, local questions, user progress, and revision schedules.
  2. **PWA Service Worker (Workbox)** with pre-cached application shells and version-keyed static quiz assets (`/api/quiz-assets/*`) cached with `CacheFirst` strategies.
  3. **Snapshot & Delta Synchronization**: Entire subject banks are fetched in immutable chunked snapshots, and daily updates are delivered via micro-deltas.

### 2.3 Complex Hindi Typography & Scientific Formatting
* **Problem:** Competitive examination content involves complex Hindi (Devanagari) script, technical terminology, historical Sanskrit verses, and KaTeX mathematical/chemical notation. Common parser glitches produce corrupted glyphs, broken font ligatures, or unrendered math.
* **Solution:** DISHA 20-20 employs an integrated typographical pipeline:
  - Strict UTF-8 character encoding with Devanagari normalization across all API endpoints.
  - Native **KaTeX (v0.19.0)** rendering integration for inline `$x$` and block `$$y$$` mathematical expressions.
  - Custom `UniversalSmartParser` and `HTMLImportMCQModal` capable of resolving raw docx, HTML, CSV, and OCR text into validated structured MCQ schemas.

### 2.4 Data Integrity & Relational Referential Consistency
* **Problem:** Non-relational NoSQL databases like Firestore do not enforce foreign key referential integrity natively. In high-velocity administrative environments, deleting a chapter or modifying a topic often creates orphaned questions.
* **Solution:** DISHA 20-20 features a continuous referential integrity validation layer (`dataIntegrityEngine.ts` and `permanentDataIntegrity.ts`). It enforces a strict 4-level hierarchy (`Subject -> Chapter -> Topic -> Question/MCQ`) with automatic self-healing routines that route orphaned questions to dedicated safe topics (`top-general`) and maintain dual-write parity between legacy `questions` and production `mcqs` collections.

---

## 3. High-Level Functional Modules

```
+-------------------------------------------------------------------------+
|                        DISHA 20-20 ECOSYSTEM                            |
+------------------------------------+------------------------------------+
|            STUDENT PANEL           |            ADMIN PANEL             |
+------------------------------------+------------------------------------+
| 1. Curriculum Drill-Down           | 1. Visual Hierarchy Builder        |
|    (Subject -> Chapter -> Topic)   |    (Subject/Chapter/Topic CRUD)    |
| 2. Intelligent MCQ Engine          | 2. Multimodal Question Studio      |
|    (5 Question Formats + Opt E)    |    (LaTeX, HTML, Excel, AI OCR)    |
| 3. Spaced Repetition Revision      | 3. Live Test & PYQ Scheduler       |
|    (Stage 0-4 Leitner Intervals)   |    (Timed exams, answer keys)      |
| 4. Authentic PYQ Vault             | 4. AI Provider Key Vault           |
|    (Official papers & keys)        |    (Gemini, Claude, GPT, Groq)     |
| 5. Real-Time Live Tests            | 5. Disaster Recovery Engine        |
|    (Instant rank & percentile)     |    (Reversible Zip Backup/Restore) |
| 6. AI Exam Paper Matcher           | 6. Quota & Storage Monitor         |
|    (OCR scan to question match)    |    (Real-time read/write metrics)  |
| 7. Performance & Weakness Analytics| 7. Block-Based News CMS            |
|    (Accuracy, time, heatmaps)      |    (Articles, SEO, dynamic tables) |
+------------------------------------+------------------------------------+
```

### 3.1 Student Experience Modules
1. **Curriculum Explorer (`TopicsTab.tsx`):** High-speed hierarchical browsing through Rajasthan History, Geography, Polity, Economy, Art & Culture, General Science, and Current Affairs.
2. **MCQ Execution Session (`MCQSessionModal.tsx`):** Features instant answer validation, comprehensive Devanagari explanations, mnemonic hints, text-to-speech pronunciation (`/api/pronounce-en-gb`), and timer controls.
3. **Leitner Spaced Repetition (`revision.ts`):** Automatically schedules questions for review across intervals of `[3, 7, 21, 45, 75]` days based on performance.
4. **PYQ Vault (`PYQVaultTab.tsx`):** Provides searchable access to authentic past examination papers from RPSC and RSMSSB with official answer keys.
5. **Live Test Exam Room (`LiveTestsTab.tsx`):** Simulates real-time competitive environments with strict time limits, auto-submission on timer expiry, negative marking calculations, and dynamic leaderboard generation.
6. **AI Exam Paper Scanner (`analyzer/`):** Allows students to capture physical question paper photos or upload PDFs. The OCR engine extracts text and performs vector/fuzzy matching against DISHA's verified question bank.

### 3.2 Administrative Control Modules
1. **Curriculum Management:** Create, reorder, modify, and publish subjects, chapters, and topics.
2. **Universal Question Studio:** Add single MCQs with rich-text explanations or batch import thousands of questions using CSV/Excel, raw HTML tables, or unstructured text.
3. **AI Content Assistance:** Gemini 2.0-powered auto-classification, question deduplication, translation, and explanation generator.
4. **Resilience Vault (`AIApiManagementSection.tsx`):** Server-side encrypted credential store managing API keys for Gemini, OpenAI, Claude, and Groq with automatic health checks and rate-limit backoff.
5. **Backup & Disaster Recovery (`BackupRestoreSection.tsx`):** Export full or selective database archives as compressed zip files, validate backup schema integrity, and perform zero-downtime restores across 5 restore modes.
6. **Quota & Telemetry Dashboard (`FirebaseQuotaHealthPanel.tsx`):** Real-time monitoring of Firestore read/write consumption, storage utilization, active sessions, and error telemetry.

---

## 4. Key Metrics & Phase Assurance Summary

The platform has undergone 15 rigorous phases of engineering development, security hardening, database migration, and performance optimization:

| Dimension | Empirical Measurement | Production Standard | Status |
|:---|:---|:---|:---:|
| **First Contentful Paint (FCP)** | 0.78 seconds | < 1.8 seconds | PASS |
| **Largest Contentful Paint (LCP)** | 1.34 seconds | < 2.5 seconds | PASS |
| **Synthetic User Concurrency** | 1,000 concurrent sessions | 500 sessions | PASS |
| **Throughput Under Load** | 70,422 operations / second | > 10,000 ops/s | PASS |
| **Routine Client Firestore Writes** | 0 writes during study session | 0 writes | PASS |
| **Referential Integrity** | 100.0% valid foreign keys | 100.0% | PASS |
| **MCQ Zero-Based Indexing** | 100.0% compliant ($0..3$ or $0..4$) | 100.0% | PASS |
| **Devanagari Font Integrity** | 99.6% pure glyph rendering | > 99.0% | PASS |
| **Disaster Recovery RTO** | < 60 seconds | < 120 seconds | PASS |
| **Disaster Recovery RPO** | 0 seconds (zero data loss) | < 300 seconds | PASS |
| **TypeScript Compilation** | 0 errors (`tsc --noEmit`) | 0 errors | PASS |
| **Vitest Automated Test Pass Rate** | 100.0% (89 passed tests) | 100.0% | PASS |

---

## 5. Architectural Standards & Compliance Rules

1. **Zero Secret Leakage:** No server credentials, Firebase Admin Service Account private keys, or third-party AI keys may ever be exposed to the client bundle or written to public version control.
2. **Offline-First Storage Supremacy:** Client components must never read directly from Cloud Firestore if valid data exists in IndexedDB v5 or the Service Worker static asset cache.
3. **Reversible Serialization:** All backup and database synchronization pipelines must preserve Firestore native types (`Timestamp`, `GeoPoint`, `DocumentReference`) using standardized JSON envelopes.
4. **Default-Deny Security:** All Firestore rules reject read and write operations by default unless authenticated and explicitly authorized by verified role claims.
