# DISHA 20-20 — Complete Admin Panel Function Inventory

**Target Application:** DISHA 20-20 (QuizPro Exam Prep Platform)  
**Root Path:** `/data/user/0/com.termux/files/home/Disha-`  
**Audit Scope:** Full Admin Surface (src/components/AdminTab.tsx, src/components/admin/*, Modals, Utilities, Storage, Security & Quota Layer)  
**Date of Audit:** November 15, 2026  
**Auditor:** Antigravity AI Functional & Security Assurance Engine  

---

## Executive Summary of Admin Architecture

The DISHA 20-20 Admin Panel is structured into 10 primary navigation groups within `src/components/AdminTab.tsx`, branching into 20 functional modules. The application employs React 19, Tailwind CSS, Lucide icons, and a hybrid client-server storage architecture combining Firebase Firestore, IndexedDB, and LocalStorage with aggressive client-side quota protection and deduplication guards.

```
AdminTab (Root)
 ├── 1. Dashboard & Statistics (Overview, Analytics, Realtime Health, Quick Actions)
 ├── 2. Subject Management (Add, Edit, Reorder, Delete, Multi-lingual Titles)
 ├── 3. Chapter Management (Add, Edit, Reorder, Delete, Subject Mapping)
 ├── 4. Topic Management (Add, Edit, Delete, Chapter Mapping)
 ├── 5. MCQ Management (Question Repository, Filter, Search, Virtualized List)
 ├── 6. Bulk MCQ Import (Manual, Paste, JSON, File Upload, AI Import, Excel/CSV, HTML Import)
 ├── 7. MCQ Edit & Delete (Single Edit, Inline Fix, Bulk Delete, Bulk Move, Deletion Safeguards)
 ├── 8. PYQ Vault (Past Year Papers, Year/Board Filter, Timed Tests, Marking Rules)
 ├── 9. Live Tests (Scheduled Tests, Realtime Attempts, Merit List PDF Generator, Leaderboards)
 ├── 10. Coaching Test Series (Coaching Institutes, Exams, Test Series Hierarchy)
 ├── 11. Banner Management (Carousels, Image Upload/Compression, Target Links, Reorder)
 ├── 12. Daily News & Articles (Block Editor, Markdown, SEO Panel, Auto-linking, Category Management)
 ├── 13. User Management (Directory, Role Elevation, Account Block/Unblock, Contact Messages)
 ├── 14. Data Export (Question Bank JSON, CSV Quota Logs, Merit List PDF, Syllabus Tree)
 ├── 15. Data Import & Restore (Disaster Recovery Engine, Backup Manifests, Dry-run Simulator)
 ├── 16. Database Management (Firestore Data Explorer, Quota Tracker, Audit Console, Stability Diagnostics)
 ├── 17. Deduplication Tools (MCQ Fingerprint Scanner, Similarity Hash, Merge Engine, Visibility Repair)
 ├── 18. Syllabus Management (Tree Visualizer, Category Tagging, Exam Board Mappings)
 ├── 19. Settings & Configuration (AI Provider Keys, Gemini/OpenAI/Claude/Groq, Sitemap Generator)
 └── 20. Admin Authentication & Permissions (Strict Email Whitelist, Custom Claims, Route/Tab Guards)
```

---

## Detailed Module Inventory

### Module 1: Dashboard and Statistics
* **File Locations:** `src/components/AdminTab.tsx`, `src/components/admin/AdminDashboardSection.tsx`, `src/components/admin/AdminAnalyticsDashboard.tsx`, `src/components/admin/QuickActionsWidget.tsx`, `src/components/admin/DatabaseStatusWidget.tsx`, `src/components/admin/AuditLogWidget.tsx`, `src/components/admin/RecentActivityWidget.tsx`, `src/components/admin/AdminQuotaAlert.tsx`
* **Tabs & Subtabs:**
  - `activeGroup === 'dashboard'`
  - Subtab: `overview` (System KPI cards, Quota status, Quick actions, Recent activity, Database status)
  - Subtab: `analytics` (Study trends, attempt volumes, registration metrics, accuracy distributions)
* **Buttons & Clickable Elements:**
  - `Refresh Data` button (Triggers manual fetch of registered users and banners)
  - `Check System Health` button (Pings `_health` collection with latency measurement and 60s cooldown)
  - Quick Action shortcuts: `Add Question`, `Upload Syllabus`, `Manage Users`, `View Audit Logs`, `Open Diagnostics`
  - `Open QA Test Runner` trigger button
* **Form & Input Fields:** None (Display & monitoring dashboard)
* **Dropdowns & Filters:** Date range picker in `AdminAnalyticsDashboard` (7 days, 30 days, 90 days, all time)
* **Search Functionality:** Filter activity log by keyword
* **Operations:**
  - Reads: `fetchRegisteredUsers()`, `fetchAllBanners()`, `runFirebaseHealthCheck()`, `getQuotaStats()`, `getTotalDisplayCount()`
  - Writes: `_health/ping` timestamp document
* **Modals & Confirmation:** QA Test Runner modal trigger
* **Permissions:** Requires `isUserAdmin(userProfile) === true`

---

### Module 2: Subject Management
* **File Locations:** `src/components/AddSubjectModal.tsx`, `src/components/admin/AdminSyllabusSection.tsx`, `src/utils/questionsStorage.ts`, `src/utils/firebaseSyncService.ts`
* **Tabs & Subtabs:** `activeGroup === 'syllabus'`, subview tab `subjects`
* **Buttons & Clickable Elements:**
  - `Add Subject` top bar button
  - Subject card `Delete Subject` button (Trash icon)
  - Subject card `Edit Subject` button
  - `Hierarchy Tree` button
* **Form & Input Fields:**
  - English Subject Name (`input[type="text"]`, required)
  - Hindi Subject Name (`input[type="text"]`, required)
  - Description (`textarea`, optional)
  - Icon selection (Radio or grid picker: TrendingUp, BookOpen, Layers, ShieldCheck, etc.)
  - Color theme selection (Emerald, Blue, Amber, Rose, Purple, Indigo)
  - Order priority number (`input[type="number"]`)
* **Dropdowns & Filters:** None
* **Operations:**
  - Add: Creates `Subject` object with deterministic or UUID ID, writes to local store and dispatches `saveSubjectToCloud()`
  - Edit: Mutates subject record, syncs to Firestore `subjects/{id}`
  - Delete: Prompts via `ConfirmDialog`, deletes from local store, marks `deletedSubjectIds`, deletes from cloud via `deleteSubjectFromCloud()`
* **Modals & Dialogs:** `AddSubjectModal`, `ConfirmDialog` (requires confirmation before deletion)
* **Data Flow & Integrity:** Prevents orphan chapters by cascading delete validation or warning

---

### Module 3: Chapter Management
* **File Locations:** `src/components/AddChapterModal.tsx`, `src/components/admin/AdminSyllabusSection.tsx`, `src/utils/questionsStorage.ts`, `src/utils/firebaseSyncService.ts`
* **Tabs & Subtabs:** `activeGroup === 'syllabus'`, subview tab `chapters`
* **Buttons & Clickable Elements:**
  - `Add Chapter` top action button
  - Chapter row `Delete Chapter` button
  - Chapter row `Add Topic` direct link
* **Form & Input Fields:**
  - Parent Subject Dropdown (`select`, required)
  - Chapter Number (`input[type="number"]`, required, positive integer)
  - English Chapter Title (`input[type="text"]`, required)
  - Hindi Chapter Title (`input[type="text"]`, required)
* **Dropdowns & Filters:** Subject filter to view chapters belonging to specific subject
* **Operations:**
  - Add: Generates chapter ID, updates `customChapters`, dispatches cloud write
  - Delete: Prompts via `ConfirmDialog`, removes chapter, updates `deletedChapterIds`
* **Modals & Dialogs:** `AddChapterModal`, `ConfirmDialog`

---

### Module 4: Topic Management
* **File Locations:** `src/components/AddTopicModal.tsx`, `src/components/admin/AdminSyllabusSection.tsx`, `src/components/ManageSyllabusModal.tsx`, `src/utils/questionsStorage.ts`
* **Buttons & Clickable Elements:**
  - `Add Topic` button in syllabus header
  - Inline `+ Add Topic` button inside chapter accordion
  - Topic delete / edit action buttons inside `ManageSyllabusModal`
* **Form & Input Fields:**
  - Subject selector (`select`)
  - Chapter selector (`select`, dynamic filtered by selected subject)
  - English Topic Title (`input[type="text"]`, required)
  - Hindi Topic Title (`input[type="text"]`, required)
* **Operations:**
  - Add Topic: Appends `Topic` object to target chapter's `topics` array
  - Delete Topic: Removes topic and marks `deletedTopicIds`
* **Modals & Dialogs:** `AddTopicModal`, `ManageSyllabusModal`

---

### Module 5: MCQ Management
* **File Locations:** `src/components/ManageQuestionsModal.tsx`, `src/components/QuestionTable.tsx`, `src/components/ManageQuestionRow.tsx`, `src/components/VirtualizedQuestionList.tsx`
* **Buttons & Clickable Elements:**
  - `Browse & Manage` button in Question Bank
  - Select All / Deselect All checkboxes
  - Individual question selection checkbox
  - Search clear button (`X`)
  - Pagination navigation (`Next`, `Prev`, direct page buttons)
  - Row expand / collapse details button
* **Form & Input Fields:**
  - Search input with debounce (searches question text, options, explanation)
* **Dropdowns & Filters:**
  - Subject dropdown filter
  - Chapter dropdown filter (cascading from selected subject)
  - Topic dropdown filter (cascading from selected chapter)
  - Source filter (All, Custom Added, System / PYQ)
* **Operations:**
  - Real-time client-side indexing and searching via `ultraFastSearchEngine` or regex
  - Pagination with configurable page sizes (25, 50, 100)
  - Virtualized rendering for high performance (60 FPS on mobile)

---

### Module 6: Bulk MCQ Import
* **File Locations:** `src/components/AddQuestionsModal.tsx`, `src/components/AIImportModal.tsx`, `src/components/admin/ExcelCsvQuestionImporter.tsx`, `src/components/admin/HTMLImportMCQModal.tsx`, `src/components/admin/ImportTemplatesModal.tsx`, `src/components/admin/SmartArticleImportModal.tsx`
* **Import Modes & Tabs:**
  1. **Manual Mode:** One-by-one form input with question, 4 options, radio select correct option, explanation, difficulty tag
  2. **Paste / Raw Text Mode:** Textarea accepting formatted text (`Q1. ... A) ... B) ... Ans: A`)
  3. **JSON Import Mode:** Structured JSON array input with live syntax validator and sample loader
  4. **File Upload Mode:** Drag-and-drop file upload (`.json`, `.txt`, `.docx`, `.csv`, `.xlsx`, `.html`)
  5. **AI Assistant Mode (AIImportModal):** Gemini AI prompt integration; automatically structures unformatted study material into standardized MCQs
  6. **Excel/CSV Importer:** Spreadsheet parser mapping columns (`Question`, `Option A`, `Option B`, `Option C`, `Option D`, `Correct`, `Explanation`)
  7. **HTML MCQ Importer:** Web scrapings and table parser with HTML sanitizer
* **Buttons & Clickable Elements:**
  - `Quick Add`, `Bulk Import`, `AI Import`, `Excel/CSV Import`, `HTML Import`
  - `Load Sample Data` button
  - `Validate & Parse` button
  - `Commit to Database` button with progress bar
* **Validation & Security:**
  - Minimum 2 options required, default 4 options
  - `correctIndex` bounds check (0 to `options.length - 1`)
  - Non-empty question text
  - Duplicate question hash detection (`generateQuestionHash`)

---

### Module 7: MCQ Edit / Delete
* **File Locations:** `src/components/ManageQuestionsModal.tsx`, `src/components/ManageQuestionsDialogs.tsx`, `src/components/admin/BulkQuestionDeleteModal.tsx`, `src/utils/questionsStorage.ts`
* **Buttons & Clickable Elements:**
  - `Edit` pencil icon on any question row
  - `Delete` trash icon on any question row
  - `Bulk Delete` action button (appears when >=1 item selected)
  - `Bulk Move` action button (re-assign questions to different chapter/topic)
  - `Confirm Bulk Delete` modal button (requires typing confirm keyword)
* **Form & Input Fields:**
  - Question text editor (`textarea`)
  - 4 Option text inputs (`input[type="text"]`)
  - Correct Option selector (`radio`)
  - Explanation editor (`textarea`)
  - Move target chapter selector (`select`)
  - Move target topic selector (`select`)
* **Operations:**
  - Single edit: Updates in-memory store and dispatches `saveQuestionToCloud()`
  - Single delete: Moves ID to `deletedQuestionIds` and calls `deleteQuestionFromCloud()`
  - Bulk delete: Batch deletes up to 500 items per Firestore batch
  - Bulk move: Updates `chapterId` and `topicId` attributes across selected items

---

### Module 8: PYQ Vault
* **File Locations:** `src/components/ManagePYQVaultModal.tsx`, `src/components/PYQVaultTab.tsx`, `src/utils/pyqStorage.ts`
* **Buttons & Clickable Elements:**
  - `Create Past Year Paper` button
  - `Edit Paper` button
  - `Delete Paper` button
  - `Add Questions from Store` button
  - `Import via AI / HTML` buttons
  - Paper publish toggle (`isPublished`)
* **Form & Input Fields:**
  - Exam Title (English & Hindi)
  - Exam Board (RPSC, RSSB, REET, UPSC, etc.)
  - Target Year (e.g., 2024, 2023, 2021)
  - Duration in Minutes (`input[type="number"]`)
  - Total Marks & Negative Marking fraction (`input[type="number"]`)
  - Instructions markdown
* **Operations:**
  - Storage in `pyqPapers` collection and localStorage cache
  - CRUD operations with question references

---

### Module 9: Live Tests
* **File Locations:** `src/components/ManageLiveTestsModal.tsx`, `src/components/LiveTestsTab.tsx`, `src/components/admin/MeritListPdfModal.tsx`, `src/utils/liveTestStorage.ts`
* **Buttons & Clickable Elements:**
  - `Create Live Test` button
  - `Edit Test` button
  - `Delete Test` button
  - `View Submissions / Leaderboard` button
  - `Generate Merit List PDF` button
  - `Share Results to Telegram/WhatsApp` copy button
* **Form & Input Fields:**
  - Test Title (Hindi & English)
  - Category selector (RAS, SI, Patwar, VDO, Teacher Grade I/II/III)
  - Start Time & End Time (`input[type="datetime-local"]`)
  - Test Duration (Minutes)
  - Total Questions & Passing Marks
  - Questions picker table
* **Operations:**
  - Saves to `liveTests` collection
  - Submissions aggregation from `liveTestSubmissions`
  - PDF generation via `jsPDF` table rendering

---

### Module 10: Coaching Test Series
* **File Locations:** `src/components/admin/ManageCoachingHierarchyModal.tsx`, `src/components/CoachingHierarchySection.tsx`, `src/components/TestSeriesPage.tsx`, `src/utils/coachingHierarchyStorage.ts`
* **Tabs & Subtabs:** Coaching Institutes, Exams, Test Series
* **Buttons & Clickable Elements:**
  - `Add Coaching Institute` button
  - `Add Coaching Exam` button
  - `Add Test Series` button
  - Edit / Delete buttons for all three levels
* **Form & Input Fields:**
  - Coaching Name, Logo URL, Description, Rating
  - Exam Name, Category, Target Year
  - Series Name, Total Tests, Free/Paid flag, Pricing
* **Operations:**
  - 3-tier hierarchical relationship: `Coaching -> CoachingExam -> CoachingTestSeries`

---

### Module 11: Banner Management
* **File Locations:** `src/components/admin/AdminBannerManagementSection.tsx`, `src/components/BannerSlides.tsx`, `src/utils/bannerStorage.ts`
* **Buttons & Clickable Elements:**
  - `Add Banner` button
  - `Upload Banner Image` file input
  - `Compress Image` automated trigger
  - `Move Up` / `Move Down` reordering buttons
  - `Active / Inactive` toggle switch
  - `Edit Banner` / `Delete Banner` buttons
* **Form & Input Fields:**
  - Banner Title (`input[type="text"]`)
  - Image URL or Base64 data URL
  - Click Action Type (External URL, Internal Tab, Test Series, Live Test)
  - Target Link / URL (`input[type="text"]`)
  - Order Priority (`input[type="number"]`)
* **Operations:**
  - Client-side image compression (`compressBannerImage`) to prevent large payload writes
  - Writes to `banners` collection

---

### Module 12: Daily News / Articles
* **File Locations:** `src/components/admin/AdminNewsSectionV2.tsx`, `src/components/admin/ArticleBlockEditorModal.tsx`, `src/components/admin/ArticleSEOControlPanel.tsx`, `src/components/admin/ArticleSectionReorderDnd.tsx`, `src/utils/articleStorage.ts`
* **Buttons & Clickable Elements:**
  - `New Article` button
  - `Edit Article` button
  - `Delete Article` button
  - `Publish / Unpublish` toggle
  - `Pin Article` toggle
  - `Smart Article Import` button
  - `Auto-Inject Links` button
  - `Reorder Blocks` drag-and-drop controls
* **Form & Input Fields:**
  - Article Title, Subtitle, Excerpt, Slug
  - Category selector & Category manager (Add/Delete categories)
  - Cover Image URL
  - Block Editor: Heading, Paragraph, List, Quote, Callout, MCQ Block, Table, Image, YouTube embed
  - SEO Panel: Meta Title, Meta Description, Focus Keyword, Canonical URL, SERP Preview (Desktop/Mobile)
* **Operations:**
  - CRUD operations in `newsArticles` collection
  - Slugs auto-generated and validated for unique index

---

### Module 13: User Management
* **File Locations:** `src/components/admin/AdminUserManagementSection.tsx`, `src/components/admin/AdminMessagesSection.tsx`, `src/components/admin/AdminNotificationBroadcastSection.tsx`, `src/components/admin/QuestionReportDesk.tsx`, `src/utils/userManagementStorage.ts`
* **Tabs & Subtabs:**
  - `directory`: Registered users list, profiles, roles
  - `messages`: In-app contact form queries
  - `reports`: Student question error reports
  - `notifications`: Push notification broadcast composer
* **Buttons & Clickable Elements:**
  - Role toggle: `Promote to Admin` / `Demote to Student`
  - Account status: `Block User` / `Activate User`
  - `Delete User Account` button with confirmation
  - `View User Activity` details button
  - `Send Push Broadcast` button
  - `Resolve Report` / `Fix Question` buttons
* **Form & Input Fields:**
  - User search (name, email, UID)
  - Notification Composer: Title (En/Hi), Body (En/Hi), Target Topic/URL, Priority
* **Operations:**
  - Writes to `users/{uid}`, `broadcast_notifications`, `questionReports`

---

### Module 14: Data Export
* **File Locations:** `src/components/admin/ExportDataWidget.tsx`, `src/components/PDFExportModal.tsx`, `src/utils/pdfGenerator.ts`
* **Buttons & Clickable Elements:**
  - `Export Data Registry` button (Downloads sanitized JSON of full question bank)
  - `Export Usage Logs (CSV)` button in Quota & Audit console
  - `Download Diagnostic Report (JSON)`
  - `Export Merit List (PDF)`
* **Operations:**
  - Client-side JSON blob generation and automatic file download trigger
  - Excludes sensitive credentials or admin secrets

---

### Module 15: Data Import / Restore
* **File Locations:** `src/components/admin/BackupRestoreSection.tsx`, `src/utils/disasterRecovery.ts`, `src/utils/permanentDataIntegrity.ts`
* **Buttons & Clickable Elements:**
  - `Create Full Snapshot Backup` button
  - `Upload Backup Archive (.zip / .json)`
  - `Verify Backup Integrity (SHA-256)`
  - `Run Dry-Run Restore Simulation`
  - `Execute Restore Job` with safety lock toggle
* **Form & Input Fields:**
  - File picker for `.json` and `.zip` backups
  - Destination collection conflict resolution mode (`merge`, `overwrite`, `skip_existing`)
* **Operations:**
  - Typed Firestore serialization/deserialization
  - Multi-collection atomic batch restore with rollback safety

---

### Module 16: Database Management & Quota
* **File Locations:** `src/components/admin/FirebaseDataExplorer.tsx`, `src/components/admin/FirebaseAuditConsole.tsx`, `src/components/admin/FirebaseStorageOverview.tsx`, `src/components/admin/FirebaseQuotaHealthPanel.tsx`, `src/components/admin/SyncHealthMonitorPanel.tsx`, `src/components/admin/ProductionStabilityPanel.tsx`, `src/components/admin/AdminDiagnosticsSection.tsx`, `src/utils/quotaTracker.ts`
* **Tabs & Subtabs:**
  - `diagnostics`: System health and collection counts
  - `explorer`: Interactive Firestore collection viewer with cursor pagination
  - `report`: Detailed health metrics report
  - `audit`: Real-time query/write audit stream
  - `quota`: Real-time daily quota tracker (reads, writes, deletes, Pacific Midnight reset timer)
  - `sync`: Sync health monitor and conflict resolver
  - `integrity`: Dual-write overlap and orphan scanner
* **Operations:**
  - `guardedGetDocs()`, `guardedGetDoc()`, `guardedSetDoc()`, `guardedDeleteDoc()`
  - Real-time event listener on local quota store

---

### Module 17: Deduplication Tools
* **File Locations:** `src/components/admin/McqDuplicateScannerWidget.tsx`, `src/utils/scanMcqDuplicates.ts`, `src/utils/duplicateAuditService.ts`
* **Buttons & Clickable Elements:**
  - `Run Duplicate Scan` button
  - `Safe Visibility Repair & Re-mapping Pass` button
  - Duplicate group expand / collapse buttons
  - `Merge Duplicate Pair` button
* **Operations:**
  - Computes normalized string hashes: ignores whitespace, punctuation, Hindi matras, and case
  - Detects duplicate questions across `mcqs`, `questions`, and `curriculum_questions`
  - Safe visibility verification: non-destructive, zero deletions, guarantees data preservation

---

### Module 18: Syllabus Management
* **File Locations:** `src/components/admin/AdminSyllabusSection.tsx`, `src/components/ManageSyllabusModal.tsx`, `src/components/ManageExamCategoriesModal.tsx`
* **Buttons & Clickable Elements:**
  - `Hierarchy Tree` visualizer
  - Reorder up / down controls
  - Exam Categories manager (Add, Edit, Delete categories)
* **Form & Input Fields:**
  - Category Name, Code, Exam Board, Icon
* **Operations:**
  - Tree structure integrity validator: checks Subject -> Chapter -> Topic relations

---

### Module 19: Settings and Configuration
* **File Locations:** `src/components/admin/AIApiManagementSection.tsx`, `src/components/admin/ApiSettingsModal.tsx`, `src/components/AppSettingsModal.tsx`, `src/components/admin/SitemapManagerModal.tsx`, `src/components/admin/UTMLinkBuilder.tsx`, `src/components/admin/AutoLinkRulesManagerModal.tsx`
* **Buttons & Clickable Elements:**
  - `Add AI Key` button
  - Provider selector tabs (Google Gemini, OpenAI, Anthropic Claude, Groq)
  - `Test Key Health` button
  - `Toggle Key Active/Inactive` switch
  - `Generate Sitemap` button
  - `Build UTM Link` copy button
* **Form & Input Fields:**
  - API Key input (masked password field)
  - Model selection dropdown (gemini-2.0-flash, gpt-4o-mini, claude-3-7-sonnet, etc.)
  - Daily request quota limit input
* **Operations:**
  - Stores encrypted or masked API configs in Firestore `_systemConfig/ai_keys` or localStorage

---

### Module 20: Admin Authentication & Permissions
* **File Locations:** `src/utils/userProfileStorage.ts`, `src/utils/permanentDataIntegrity.ts`, `firestore.rules`, `src/components/LoginPage.tsx`, `src/components/AdminTab.tsx`
* **Security Controls & Predicates:**
  - Client-side: `isUserAdmin(userProfile)` checks `ADMIN_EMAILS` whitelist (`zdpaliyal@gmail.com`, `jagdishpaliyaljat@gmail.com`), `ADMIN_UIDS`, and `profile.role === 'admin'`
  - Route Guard: In `AdminTab.tsx`, unauthenticated or non-admin users receive `Access Denied` UI with redirect to `/login`
  - Backend Rules: `firestore.rules` enforces `isTrustedAdminEmail()`, `hasAdminClaim()`, and `isServerApprovedAdminDoc()`; rejects student write operations on curriculum, mcqs, banners, and broadcasts

---

*Inventory completed and validated against source code.*
