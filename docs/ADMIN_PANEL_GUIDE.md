# DISHA 20-20 — Admin Panel Operational Guide

## 1. Authentication & Access Control

Access to the DISHA 20-20 Administrative Console (`AdminTab.tsx`) is strictly governed by multi-factor administrative predicates:
1. **Verified Authentication:** The user must be authenticated through Firebase Auth. Anonymous sessions are blocked.
2. **Email Verification:** `request.auth.token.email_verified == true`.
3. **Allowlist Enforcement:** The account email must match the trusted administrator allowlist:
   - `zdpaliyal@gmail.com`
   - `jagdishpaliyaljat@gmail.com`
   *(Or possess an active, non-revoked custom claim with `role == 'admin'`)*.
4. **Account State:** Accounts with `blocked == true` or `status == 'blocked'` are automatically locked out by both client guards and `firestore.rules`.

---

## 2. Admin Dashboard & Subsystem Overview

The administrative control center is organized into specialized workspaces accessible from the sidebar and quick-action widgets:

```
+-------------------------------------------------------------------------------+
|                       DISHA 20-20 ADMIN CONTROL SUITE                         |
+-------------------+-------------------------------+---------------------------+
| CURRICULUM & CMS  | QUESTION STUDIO & IMPORTERS   | GOVERNANCE & TELEMETRY    |
+-------------------+-------------------------------+---------------------------+
| - Syllabus Tree   | - Single Question Editor      | - Multi-Provider AI Vault |
| - Coaching Series | - Excel / CSV Bulk Importer   | - Backup & Recovery Hub   |
| - Block Editor v2 | - Universal Smart Parser      | - Quota Health Dashboard  |
| - Banner Manager  | - HTML Table Importer         | - Security Audit Logs     |
| - Live Test Desk  | - Duplicate Question Scanner  | - User Access Management  |
| - PYQ Vault       | - Question Report Desk        | - System Diagnostics      |
+-------------------+-------------------------------+---------------------------+
```

---

## 3. Curriculum & Hierarchy Builder

### 3.1 Managing Subjects (`AddSubjectModal.tsx`)
1. Navigate to **Admin -> Syllabus & Hierarchy**.
2. Click **Add New Subject**.
3. Provide:
   - **Display Name:** Transliterated or English name (e.g., `Rajasthan History`).
   - **Hindi Title:** Canonical Devanagari name (e.g., `राजस्थान का इतिहास`).
   - **Icon & Color:** Select a Lucide icon identifier and primary color theme.
   - **Order:** Numerical sequence value.
4. Click **Save Subject**. The subject is committed to `/subjects/{id}` and updates the client cache.

### 3.2 Managing Chapters & Topics (`AddChapterModal.tsx`, `AddTopicModal.tsx`)
- Chapters map to parent `subjectId` and topics map to parent `chapterId`.
- **Referential Integrity:** Deleting a topic or chapter automatically triggers `dataIntegrityEngine.ts` to inspect for child questions. Any orphaned questions are safely reassigned to the default topic (`top-general`) to prevent data loss.

### 3.3 Coaching & Test Series Hierarchy (`ManageCoachingHierarchyModal.tsx`)
- Structure: `Coaching Institute -> Targeted Examination -> Test Series -> Test Links`.
- Allows bundling of private coaching test series with access code restrictions.

---

## 4. Question Management Studio & Importers

### 4.1 Single Question Editor (`AddQuestionsModal.tsx`)
Supports five distinct competitive question types:
1. **Single Choice Question (SCQ):** Standard 4-option question. Correct index is 0, 1, 2, or 3.
2. **Multiple Statements Question:** Add numbered statements ($1, 2, 3$). The student must choose the correct combination (e.g., "केवल 1 और 2 सही हैं").
3. **Assertion & Reason (A/R):** Separate input fields for Assertion (कथन) and Reason (कारण).
4. **Match the Following:** Define List I and List II pairs. The editor automatically generates matching permutations.
5. **LaTeX Mathematical / Numerical Question:** Use `$formula$` for inline math or `$$equation$$` for block equations. Live preview renders via KaTeX v0.19.0.

### 4.2 Excel / CSV Importer (`ExcelCsvQuestionImporter.tsx`)
- Accepts `.xlsx`, `.xls`, and `.csv` spreadsheets.
- **Expected Columns:** `Subject`, `Chapter`, `Topic`, `Question Text`, `Option A`, `Option B`, `Option C`, `Option D`, `Correct Option` (A/B/C/D), `Explanation`, `Exam Name`, `Exam Year`.
- Automatically maps option letters `A-D` to zero-based indices `0-3`.

### 4.3 Universal Smart Parser (`UniversalSmartParser.ts`)
- Allows pasting unstructured text directly from PDFs, Word documents (`.docx`), or web pages.
- Uses regex pattern recognition to identify questions, extract option blocks, detect answer keys, and flag missing fields.

### 4.4 Bulk HTML Importer (`HTMLImportMCQModal.tsx`)
- Ingests raw HTML table dumps from educational portals, stripping malicious scripts using `DOMPurify` before compiling into the question schema.

---

## 5. Content Quality & Duplicate Resolution

### 5.1 MCQ Duplicate Scanner (`McqDuplicateScannerWidget.tsx`)
- Runs fuzzy token-matching and Levenshtein similarity across all questions in a selected topic.
- Questions with similarity $\ge 85\%$ appear side-by-side. The administrator can merge attempts, archive one question, or dismiss the flag.

### 5.2 Question Report Desk (`QuestionReportDesk.tsx`)
- Aggregates student error reports submitted during practice sessions.
- Displays student notes (e.g., "उत्तर कुंजी गलत है - सही उत्तर (B) होना चाहिए").
- Allows one-click correction of answer keys or explanations.

---

## 6. Live Test Scheduler & PYQ Vault

### 6.1 Creating Live Tests (`ManageLiveTestsModal.tsx`)
1. Specify **Exam Category** (e.g., `RAS Pre`, `RSMSSB Patwar`).
2. Set **Start Time** and **End Time** (ISO window).
3. Configure **Timing & Marking**:
   - Duration (e.g., 180 minutes)
   - Total Marks (e.g., 200)
   - Marks Per Question (e.g., 1.33)
   - Negative Marking (e.g., 0.33)
4. Select Questions from the bank.
5. Save. The test definition is published to `live_tests`, while the answer key is securely written to `liveTestAnswerKeys` (admin-only).

### 6.2 Generating Merit Lists & Scorecards (`MeritListPdfModal.tsx`)
- When a live test concludes, the admin can trigger automated leaderboard evaluation.
- Ranks are computed based on `score DESC`, followed by `timeSpentSeconds ASC`.
- Export a branded official Merit List PDF via `jspdf` and `html2canvas`.

---

## 7. Block-Based News & Article CMS

### 7.1 Article Editor v2 (`ArticleBlockEditorModal.tsx`)
Construct long-form educational posts using modular blocks:
- **Heading Block:** H1 through H4 with automatic anchor links for the Table of Contents.
- **Paragraph Block:** Markdown text with bold, italic, and hyperlink formatting.
- **Callout Block:** Visual alerts (`info`, `warning`, `tip`, `important`).
- **Dynamic Table Block:** Customizable columns, headers, and cell alignments.
- **Interactive Quiz Block:** Embeds specific practice topics directly into study articles.
- **FAQ Block:** Collapsible accordion with schema.org microdata for Google Search Rich Snippets.

### 7.2 SEO Control Panel (`ArticleSEOControlPanel.tsx`)
- Real-time Google Search SERP snippet preview (Mobile & Desktop).
- Meta title, description, focus keyword density analysis, and canonical URL definition.

---

## 8. Multi-Provider AI API Key Vault

Managed in `AIApiManagementSection.tsx`:
1. **Adding API Keys:**
   - Select Provider: **Google Gemini**, **Anthropic Claude**, **OpenAI**, or **Groq**.
   - Paste API key and select model (e.g., `gemini-2.0-flash-exp`, `claude-3-5-sonnet-20241022`).
   - The key is sent over HTTPS to `/api/admin/ai-configs`, encrypted with AES-256-GCM, and stored in Firestore.
2. **Testing Latency:** Click **Test Key** to dispatch a benchmark prompt. Latency is reported in milliseconds.
3. **Resetting Cooldown:** If a key enters `rate_limited` status due to HTTP 429 errors, click **Reset Cooldown** after quota refreshes.

---

## 9. Backup, Restore & Quota Monitoring

### 9.1 Database Export (`BackupRestoreSection.tsx`)
1. Click **Create New Backup**.
2. Select **Full Backup** (all 56 collections) or **Selective Backup** (specific collections).
3. The server exports documents, serializes native types, compiles a SHA-256 manifest, and downloads a `.zip` archive.

### 9.2 Restoration Execution
- Upload a previously generated backup archive.
- The validation engine inspects JSON syntax, verifies file hashes, and previews document counts.
- Choose a restoration strategy (**Merge/Upsert**, **Clean Restore**, or **Skip Existing**) and execute.
