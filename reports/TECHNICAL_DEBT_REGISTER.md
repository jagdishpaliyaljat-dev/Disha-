# DISHA 20-20 — Phase 15: Technical Debt Register

**Audit Date:** November 15, 2026  
**Auditor:** Antigravity Autonomous Sub-Agent (Jarvis Delegation)  
**Scope:** Formal Inventory of Architectural Flaws, Code Complexity, State Inconsistencies, Circular Dependencies, and Schema Drift  
**Status:** 100% Read-Only Forensic Inspection Complete  

---

## Technical Debt Summary Dashboard

```
+---------------------------------------------------------------------------------+
| TOTAL REGISTERED TECHNICAL DEBT ITEMS: 16                                       |
+---------------------------------------------------------------------------------+
| Severity Breakdown:                                                             |
|   • CRITICAL:  3 items (Circular Imports, Monolithic Core Modals, Schema Drift) |
|   • HIGH:      5 items (Multiple Importers, Dual Parsers, Storage Duplication)  |
|   • MEDIUM:    5 items (Prop Drilling, Dead Files, Naming Collisions, Types)    |
|   • LOW:       3 items (Dead Public Assets, Unused UI Folder, Single-use Deps)  |
+---------------------------------------------------------------------------------+
```

---

## Technical Debt Item Register

### TD-01: Circular Dependency Loops in Core Data Utilities
- **Category:** Architecture / Module Loading
- **Severity:** **CRITICAL**
- **Affected Files:**
  - `src/utils/questionsStorage.ts` -> `dataIntegrityEngine.ts` -> `lib/mcqImport/index.ts` -> `lib/mcqImport/commit.ts` -> `permanentDataIntegrity.ts` -> `questionsStorage.ts`
  - `src/utils/questionsStorage.ts` -> `dataIntegrityEngine.ts` -> `lib/mcqImport/index.ts` -> `lib/mcqImport/commit.ts` -> `permanentDataIntegrity.ts` -> `scanMcqDuplicates.ts` -> `questionsStorage.ts`
  - `src/lib/mcqImport/index.ts` -> `smartImport.ts` -> `index.ts`
  - `src/utils/articleStorage.ts` -> `sitemapGenerator.ts` -> `articleStorage.ts`
- **Root Cause:** As data validation and integrity functions were introduced across Phases 2–6, higher-level storage modules imported low-level validation engines which in turn imported storage functions to write repairs, creating 4 direct circular import cycles.
- **Blast Radius:** Risk of `undefined` module exports during runtime initialization in production Vite/Rollup builds; breaks tree-shaking and causes subtle race conditions.
- **Remediation Strategy:** Extract common TypeScript interfaces and pure utility functions (`contentHash`, `normalize`, `verifyStructure`) into leaf modules that never import storage or commit services.
- **Estimated Effort:** 4 hours

---

### TD-02: Monolithic MCQ Session Component (`MCQSessionModal.tsx`)
- **Category:** Code Complexity / Maintainability
- **Severity:** **CRITICAL**
- **Affected Files:** `src/components/MCQSessionModal.tsx` (4,292 LOC, 199.1 KB)
- **Root Cause:** Single file handles test session state, question navigation, timer countdown, bilingual translation rendering, KaTeX math parsing, instant feedback, bookmarking, review palette, exit confirmation, explanation dialogs, audio cues, and results tabulation.
- **Blast Radius:** Extreme cognitive load for developers; modifying timer or explanation logic risks breaking active exam score tracking.
- **Remediation Strategy:** Deconstruct `MCQSessionModal.tsx` into focused sub-components:
  1. `SessionHeader.tsx` (Timer, progress bar, language toggle)
  2. `QuestionDisplay.tsx` (Question text, options, tables, math)
  3. `SessionPalette.tsx` (150-question navigation grid)
  4. `SessionReviewModal.tsx` (Final score, accuracy, answer key review)
  5. `useSessionTimer.ts` (Isolated countdown hook)
- **Estimated Effort:** 8 hours

---

### TD-03: Question Schema Drift & Redundant Field Mapping
- **Category:** Database / Data Integrity
- **Severity:** **CRITICAL**
- **Affected Files:** `src/types.ts` (`Question` interface), `src/utils/questionsStorage.ts`, `UniversalSmartParser.ts`
- **Root Cause:** Across 14 phases, different importers introduced overlapping property names for the same data points:
  - `table` vs `tableData` (80 occurrences across codebase)
  - `matchTable` vs `matchData` (20 occurrences across codebase)
  - `exam` vs `examName`
  - `year` vs `examYear`
  - `text` vs `question`
  - `correctIndex` vs `correctAnswer`
- **Blast Radius:** Every consumer must write defensive fallback checks (`q.table || q.tableData`, `q.correctIndex ?? q.correctAnswer`), increasing code footprint and risking bugs if one field is populated while another is empty.
- **Remediation Strategy:** Run an idempotent normalization pass to standardize the database to canonical field names (`table`, `matchTable`, `examName`, `examYear`, `text`, `correctIndex`), then update the `Question` interface and remove defensive fallbacks.
- **Estimated Effort:** 6 hours

---

### TD-04: Question Ingestion Modality Fragmentation (5 Separate Modals)
- **Category:** Architecture / User Experience
- **Severity:** **HIGH**
- **Affected Files:**
  - `src/components/AddQuestionsModal.tsx` (4,089 LOC)
  - `src/components/AIImportModal.tsx` (3,043 LOC)
  - `src/components/admin/HTMLImportMCQModal.tsx` (1,737 LOC)
  - `src/components/admin/ExcelCsvQuestionImporter.tsx` (740 LOC)
  - `src/components/analyzer/ExamPaperAnalyzerModal.tsx` (610 LOC)
  - Total: 10,219 LOC across 5 modals
- **Root Cause:** Feature additions in each phase created standalone modals for each new file format instead of extending a single importer.
- **Blast Radius:** Inconsistent validation rules across formats; 5 separate editable preview tables and 5 different commit handlers.
- **Remediation Strategy:** Merge all 5 modals into a single `UniversalQuestionImporterModal.tsx` with unified tabs (Manual, Paste/AI, Spreadsheet, HTML/Document).
- **Estimated Effort:** 10 hours

---

### TD-05: Dual Monolithic Question Parsers (`questionsParser` vs `questionParser`)
- **Category:** Code Duplication / Maintainability
- **Severity:** **HIGH**
- **Affected Files:**
  - `src/utils/questionsParser.ts` (2,423 LOC, 103.9 KB)
  - `src/utils/questionParser.ts` (1,259 LOC, 61.2 KB)
  - `src/utils/UniversalSmartParser.ts` (210 LOC, 8.3 KB)
- **Root Cause:** A rewrite was attempted to create `questionParser.ts`, but older modals (`AddQuestionsModal`) continue importing both, and `questionParser.ts` still imports regexes from `questionsParser.ts`.
- **Blast Radius:** Singular vs plural filename confusion; duplicate regexes; high risk of bug divergence.
- **Remediation Strategy:** Consolidate into a single well-tested parser module `UniversalMcqParser.ts`.
- **Estimated Effort:** 5 hours

---

### TD-06: Storage & Database Caching Layer Sprawl (6 Layers)
- **Category:** State Management / Architecture
- **Severity:** **HIGH**
- **Affected Files:** `storage.ts`, `safeStorage.ts`, `localDatabaseEngine.ts`, `indexedDbCache.ts`, `indexedDbV5.ts`, `localforage` (npm)
- **Root Cause:** Successive storage optimizations layered new caching solutions on top of older ones without decommissioning the predecessors.
- **Blast Radius:** Inconsistent data reads (some components read from LocalStorage, others from IndexedDB v4, others from v5); cache invalidation discrepancies.
- **Remediation Strategy:** Standardize all persistent data storage on `indexedDbV5.ts` for large entities (Questions, History, PYQ) and `safeStorage.ts` for small user preferences (Theme, Sound, Auth tokens).
- **Estimated Effort:** 6 hours

---

### TD-07: Dual Synchronization Stacks (Real-time vs Snapshot)
- **Category:** Architecture / Network Efficiency
- **Severity:** **HIGH**
- **Affected Files:** `src/utils/firebaseSyncService.ts` (2,593 LOC) vs `src/services/snapshot/` (8 files)
- **Root Cause:** Phase 4/8 designed an offline-first snapshot manifest sync engine, but the app root still mounts the original real-time sync service `useFirebaseSync.ts`.
- **Blast Radius:** Redundant sync logic and unnecessary document listener overhead.
- **Remediation Strategy:** Fully activate the Snapshot Sync pipeline with `studentWriteBuffer.ts` and deprecate legacy real-time listener loops.
- **Estimated Effort:** 6 hours

---

### TD-08: Observability & Health Panel Fragmentation (9 Widgets)
- **Category:** Admin UX / Redundancy
- **Severity:** **HIGH**
- **Affected Files:** 9 admin widgets in `src/components/admin/` totaling 160.8 KB
- **Root Cause:** Separate widgets were created in Phase 1, 3, and 5 to monitor reads, writes, quotas, errors, and database status.
- **Blast Radius:** Cluttered admin navigation (scattered across 4 sub-tabs); redundant telemetry queries.
- **Remediation Strategy:** Consolidate into a unified `AdminSystemHealthHub.tsx` with 3 clean cards: Quota & Reads/Writes, Sync Status, and Error Log.
- **Estimated Effort:** 4 hours

---

### TD-09: Severe Prop Drilling in `App.tsx` and `AdminTab.tsx`
- **Category:** State Management / Architecture
- **Severity:** **MEDIUM**
- **Affected Files:** `src/App.tsx` (1,929 LOC), `src/components/AdminTab.tsx` (1,526 LOC)
- **Root Cause:** State is stored at the root of `App.tsx` and passed down through 4–6 levels of component props rather than using existing React Contexts (`QuestionsContext`, `ProgressContext`).
- **Blast Radius:** Unnecessary re-renders of parent containers; bulky component signatures (over 20 callbacks on `AdminTab`).
- **Remediation Strategy:** Leverage `useQuestions()` and `useProgress()` directly inside child components instead of routing handlers through `App.tsx`.
- **Estimated Effort:** 4 hours

---

### TD-10: Identical Basename Collision (`ApiSettingsModal.tsx`)
- **Category:** Code Cleanliness / DX
- **Severity:** **MEDIUM**
- **Affected Files:**
  - `src/components/ApiSettingsModal.tsx` (User Gemini Key modal)
  - `src/components/admin/ApiSettingsModal.tsx` (Admin multi-provider config modal)
- **Root Cause:** Both modals were named `ApiSettingsModal.tsx` despite serving different personas and having completely different props.
- **Blast Radius:** High risk of accidental wrong imports by IDEs; confusion during maintenance.
- **Remediation Strategy:** Rename `src/components/admin/ApiSettingsModal.tsx` to `AdminAiProviderModal.tsx`.
- **Estimated Effort:** 30 minutes

---

### TD-11: Unimported Dead Source Code (11 Files, 2,507 LOC)
- **Category:** Code Cleanliness / Maintenance
- **Severity:** **MEDIUM**
- **Affected Files:** 11 unimported files identified in `UNUSED_CODE_AUDIT.md` (`SitemapManagerModal.tsx`, `UTMLinkBuilder.tsx`, `engagement.ts`, `useModalState.ts`, `usePWAInstall.ts`, `useSnapshotSync.ts`, `featureAccessService.ts`, `idempotency.ts`, `phase4MigrationService.ts`, `seo.ts`).
- **Root Cause:** Abandoned experiments and one-time migration scripts left in `src/`.
- **Blast Radius:** Developer confusion; bloats search results; risks accidental re-use of obsolete logic.
- **Remediation Strategy:** Delete the 11 dead files cleanly.
- **Estimated Effort:** 1 hour

---

### TD-12: Abandoned Payment System Residue
- **Category:** Schema & Asset Hygiene
- **Severity:** **MEDIUM**
- **Affected Files:**
  - `public/assets/payment-logos/` (5 SVGs)
  - `firestore.rules` (6 payment rules: `paymentSubmissions`, `payment_orders`, `payment_events`, `premiumPlans`, `subscriptions`, `user_subscriptions`)
  - `src/server/backupEngine.ts` (3 collection backup entries)
- **Root Cause:** An earlier phase prototyped Cashfree payment integration before the decision was solidified to keep DISHA 20-20 100% free and open.
- **Blast Radius:** Misleading artifacts in security rules and public assets.
- **Remediation Strategy:** Delete payment SVGs, remove payment rules from `firestore.rules`, remove payment collections from `backupEngine.ts`.
- **Estimated Effort:** 1 hour

---

### TD-13: Misclassified TypeScript Types in Production Dependencies
- **Category:** Build & Bundle Hygiene
- **Severity:** **MEDIUM**
- **Affected Files:** `package.json`
- **Root Cause:** Five `@types/*` packages placed in `"dependencies"` instead of `"devDependencies"`.
- **Blast Radius:** Unnecessary dependency weight in production deployments.
- **Remediation Strategy:** Move `@types/*` to `"devDependencies"`, remove `dotenv`.
- **Estimated Effort:** 15 minutes

---

### TD-14: Completely Unused `src/components/ui/` Atomic Library
- **Category:** Code Cleanliness
- **Severity:** **LOW**
- **Affected Files:** `src/components/ui/AppCard.tsx`, `AppHeader.tsx`, `AppBadge.tsx`, `AppModal.tsx`, `AppEmptyState.tsx`, `AppButton.tsx`, `index.ts`
- **Root Cause:** Abandoned atomic UI initiative.
- **Blast Radius:** Clutter; dead code.
- **Remediation Strategy:** Deprecate and remove or systematically adopt.
- **Estimated Effort:** 1 hour

---

### TD-15: Single-Use Heavy External Dependencies (`d3`, `mammoth`, `localforage`)
- **Category:** Bundle Weight / Performance
- **Severity:** **LOW**
- **Affected Files:** `package.json`, `StudyAnalyticsChart.tsx`, `smartArticleImporter.ts`, `questionBankCache.ts`
- **Root Cause:** Heavy libraries imported for single isolated components.
- **Blast Radius:** Added bundle size (~300 KB gzipped) on mobile devices.
- **Remediation Strategy:** Replace D3 chart with lightweight canvas/SVG; replace `localforage` with native IndexedDB; keep `mammoth` strictly code-split.
- **Estimated Effort:** 4 hours

---

### TD-16: Dead Static Files in `public/assets/` (~942 KB)
- **Category:** CDN & Deployment Weight
- **Severity:** **LOW**
- **Affected Files:** `public/assets/aistudio/*` (8 files including a 185 KB HTML test dump and OCR screenshots)
- **Root Cause:** Development assets inadvertently committed to public directory.
- **Blast Radius:** Increases deployment package size; serves test data over public web.
- **Remediation Strategy:** Delete `public/assets/aistudio/` test files.
- **Estimated Effort:** 15 minutes

---

## Technical Debt Remediation Priority Matrix

```
┌────────────────────────────────────────────────────────────────────────┐
│ SPRINT 1 (Phase 16 - Quick Wins & Critical Safety):                    │
│   1. TD-01: Break 4 Circular Dependency Loops                          │
│   2. TD-10: Disambiguate ApiSettingsModal Basename                     │
│   3. TD-11: Delete 11 Dead Unimported Source Files                     │
│   4. TD-12: Purge Abandoned Payment Rules & SVGs                       │
│   5. TD-13: Clean package.json (move @types, remove dotenv)            │
│   6. TD-16: Clean public/assets/aistudio/ test files                   │
│                                                                        │
│ SPRINT 2 (Phase 17 - Ingestion & Parser Consolidation):                │
│   7. TD-05: Merge dual parsers into UniversalMcqParser                 │
│   8. TD-04: Merge 5 question importers into Universal Importer Modal   │
│   9. TD-03: Canonicalize Question schema (drop tableData/matchData)    │
│                                                                        │
│ SPRINT 3 (Phase 18 - Observability & Architectural Modularization):    │
│   10. TD-08: Consolidate 9 health widgets into AdminSystemHealthHub    │
│   11. TD-02: Modularize MCQSessionModal (4,292 LOC -> 4 subcomponents)│
│   12. TD-06: Unify Storage Engines on IndexedDB V5                     │
│   13. TD-09: Eliminate Prop Drilling via React Context                 │
└────────────────────────────────────────────────────────────────────────┘
```
