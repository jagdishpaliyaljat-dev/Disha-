# DISHA 20-20 — Phase 15: Architecture & Maintainability Report

**Audit Date:** November 15, 2026  
**Auditor:** Antigravity Autonomous Sub-Agent (Jarvis Delegation)  
**Scope:** Architectural Topology, Component Hierarchy, State Management, Circular Dependencies, and Utility Sprawl  
**Status:** 100% Read-Only Forensic Inspection Complete  

---

## Executive Summary

DISHA 20-20 is built on a hybrid architecture: a modern **React 19 + TypeScript + Vite + Tailwind CSS v4** Progressive Web Application (PWA) client paired with a dual-target server layer (**Node.js/Express `server.ts`** for local Termux execution, and **`api/index.js` via `vercelHandler.ts`** for cloud serverless deployment), backed by Google Cloud Firestore and native browser IndexedDB.

While the application achieves impressive runtime performance and offline capabilities, the codebase has suffered from evolutionary architectural drift. Rapid iterative delivery across 14 phases introduced:
1. **Monolithic God-Components:** 5 core components exceeding 1,500 to 4,200 LOC.
2. **Circular Dependency Loops:** 4 distinct circular import cycles spanning storage, validation, and parsing modules.
3. **Severe Utility Sprawl:** `src/utils/` has bloated into 73 disparate files totaling over 1.1 MB of logic without domain grouping.
4. **State Management Fragmentation:** State is split across 5 conflicting paradigms (Context, prop-drilled `useState`, write buffer, IndexedDB, and direct Firestore listeners).

This report provides an in-depth architectural breakdown and a structural reorganization plan.

---

## 1. Architectural Topology Overview

```
                      ┌──────────────────────────────────────┐
                      │    Client Browser / PWA (React 19)   │
                      └──────────────────┬───────────────────┘
                                         │
                 ┌───────────────────────┴───────────────────────┐
                 ▼                                               ▼
     ┌────────────────────────┐                     ┌────────────────────────┐
     │  Offline Local Tier    │                     │   Network Sync Tier    │
     │  • IndexedDB V5        │                     │   • studentWriteBuffer │
     │  • SafeLocalStorage    │                     │   • BulkSyncService    │
     │  • ServiceWorker Cache │                     │   • Snapshot Sync      │
     └───────────┬────────────┘                     └────────────┬───────────┘
                 │                                               │
                 └───────────────────────┬───────────────────────┘
                                         ▼
                 ┌───────────────────────────────────────────────┐
                 │          Backend Cloud Infrastructure         │
                 │  • Cloud Firestore (Curriculum, Users, PYQ)   │
                 │  • Express API (Gemini Proxy, Backup Engine)  │
                 │  • Vercel Edge Serverless Handlers            │
                 └───────────────────────────────────────────────┘
```

---

## 2. Monolithic Component Analysis

The codebase contains several "God Components" that bundle multiple distinct responsibilities into single massive files.

| Component | File Path | LOC | Size | Responsibilities Bundled | Refactoring Recommendation |
|-----------|-----------|-----|------|--------------------------|----------------------------|
| **`MCQSessionModal`** | `src/components/MCQSessionModal.tsx` | 4,292 | 199.1 KB | Question display, Timer, KaTeX math, Translation toggle, Answer review, Bookmark toggling, Question palette, Explanation dialog, Score calculations, Audio feedback, and Exit prompts. | Extract into 5 sub-components: `SessionHeader`, `QuestionCard`, `QuestionPalette`, `SessionSummary`, and `useSessionTimer`. |
| **`AddQuestionsModal`** | `src/components/AddQuestionsModal.tsx` | 4,089 | 204.6 KB | Form creation, Raw text paste parser, JSON array input, Duplicate detection, Math LaTeX preview table, In-line editing grid, Chapter/Topic tree binding. | Extract parsing to `UniversalMcqParser` and preview table to reusable `QuestionDraftTable`. |
| **`AIImportModal`** | `src/components/AIImportModal.tsx` | 3,043 | 162.6 KB | File upload, Gemini API streaming, Prompt construction, OCR extraction, Batch error correction, Draft question table, Batch commit. | Delegate AI communication to `aiProviderService` and share the `QuestionDraftTable`. |
| **`NewsPage`** | `src/components/news/NewsPage.tsx` | 2,179 | 100.1 KB | Article listing, Category filtering, Search bar, Deep-linked article reader, Markdown rendering, Social share modal, SEO head updates. | Deconstruct into `NewsList`, `ArticleViewer`, `ArticleSidebar`, and `ArticleShareModal`. |
| **`QATestRunnerModal`** | `src/components/QATestRunnerModal.tsx` | 2,046 | 79.2 KB | In-browser test runner, 50+ hardcoded test fixtures, execution harness, results report rendering. | Move fixtures into `tests/fixtures/` and isolate test execution engine. |
| **`App.tsx`** | `src/App.tsx` | 1,929 | 78.2 KB | Routing logic, URL canonicalization, 20 modal booleans, Auth listener, Notification polling, Prop drilling to Admin & Student tabs. | Move modal management to custom hook, route handlers to layout wrappers. |
| **`AdminTab`** | `src/components/AdminTab.tsx` | 1,526 | 79.5 KB | 11 sub-tab navigation, 20+ prop callbacks, Delete confirmations, Sync triggering, Notification banners. | Decompose into separate tab page views (`AdminCurriculumView`, `AdminQuestionsView`, etc.). |

---

## 3. Circular Dependency Forensics

Using directed graph cycle detection (`scripts/phase15_audit_scanner.py`), 4 dangerous circular dependencies were identified in `src/`:

### Cycle 1 & 2: Curriculum Storage & Verification Cycle
```
┌────────────────────────────────┐
│  src/utils/questionsStorage.ts  │
└───────────────┬────────────────┘
                │ imports verifyCurriculumIntegrity
                ▼
┌────────────────────────────────┐
│ src/utils/dataIntegrityEngine.ts│
└───────────────┬────────────────┘
                │ imports commitBatch
                ▼
┌────────────────────────────────┐
│   src/lib/mcqImport/index.ts   │
└───────────────┬────────────────┘
                │ imports commitToFirestore
                ▼
┌────────────────────────────────┐
│  src/lib/mcqImport/commit.ts   │
└───────────────┬────────────────┘
                │ imports verifyDatabaseIntegrity
                ▼
┌────────────────────────────────┐
│src/utils/permanentDataIntegrity│
└───────────────┬────────────────┘
                │ imports loadUserQuestionsStore
                ▼
┌────────────────────────────────┐
│  src/utils/questionsStorage.ts  │  ◄── CYCLE CLOSES (Deadly Loop)
└────────────────────────────────┘
```
**Why this happened:** `questionsStorage.ts` wants to ensure data is clean before returning it, so it calls `dataIntegrityEngine.ts`. However, `permanentDataIntegrity.ts` wants to reload questions from disk after repairing errors, so it imports `questionsStorage.ts`.

### Cycle 3: MCQ Import Barrel Cycle
```
src/lib/mcqImport/index.ts ──(imports smartImport)──► src/lib/mcqImport/smartImport.ts
          ▲                                                           │
          └─────────────(imports * from './index')────────────────────┘
```
**Why this happened:** `smartImport.ts` imports utility helpers from its parent barrel file `index.ts`, while `index.ts` re-exports `smartImport.ts`.

### Cycle 4: Article Storage & Sitemap Cycle
```
src/utils/articleStorage.ts ──(imports updateSitemapAfterArticleChange)──► src/utils/sitemapGenerator.ts
          ▲                                                                           │
          └─────────────────────(imports loadArticlesFromStorage)────────────────────┘
```
**Why this happened:** When an article is added or deleted in `articleStorage.ts`, it tries to automatically regenerate the XML sitemap. But `sitemapGenerator.ts` needs to load the articles from `articleStorage.ts`.

### Solution to Eliminate All 4 Cycles:
1. Extract shared type definitions and pure read-only functions (`normalizeTopicId`, `computeContentHash`, `readArticleManifest`) into leaf utility files with zero dependencies.
2. Invert dependencies: instead of `articleStorage.ts` directly invoking `sitemapGenerator.ts`, emit an event or call sitemap generation from the caller/controller layer.

---

## 4. State Management Fragmentation

DISHA 20-20 currently has 5 disjointed mechanisms for reading and writing application state:

```
Mechanism 1: React Context (ProgressContext, QuestionsContext)
  - Provides questions and user progress to components.
  - Problem: Frequently out of sync with App.tsx local state; components often bypass it to read directly from storage.

Mechanism 2: Root Local State in App.tsx (20 useState hooks)
  - Manages modal visibility, active navigation tabs, and selected syllabus nodes.
  - Problem: Forces heavy prop drilling (20+ props passed through AdminTab and child modals).

Mechanism 3: Student Write Buffer (studentWriteBuffer.ts)
  - Queues student answer logs and progress updates to prevent Firestore quota exhaustion.
  - Status: Working well, but lacks tight integration with ProgressContext.

Mechanism 4: Native IndexedDB V5 (indexedDbV5.ts / localDatabaseEngine.ts)
  - Caches offline question banks and curriculum metadata.
  - Problem: Some components query IndexedDB directly while others read from localStorage.

Mechanism 5: Direct Firestore Real-time Listeners (useFirebaseSync.ts)
  - Subscribes to collection snapshots over WebSockets.
  - Problem: Causes excessive document reads if not carefully throttled.
```

### Unification Strategy:
1. Migrate the 20 modal booleans in `App.tsx` into a lightweight `useModalStore` (or active modal state machine: `{ modal: 'ai_import' | 'none', payload?: any }`).
2. Centralize all client data access in `QuestionsContext` and `ProgressContext`, making them the single source of truth backed transparently by `studentWriteBuffer` and `indexedDbV5`.

---

## 5. Utility Sprawl: Reorganizing `src/utils/`

`src/utils/` currently contains **73 files** (106 KB + 62 KB + 99 KB + 76 KB + ...). Finding the right function is difficult, and developers frequently recreate existing utilities because they cannot find them.

### Proposed Domain-Driven Directory Restructuring:

```
src/
  ├── services/
  │    ├── curriculum/          # Curriculum storage, hierarchy, categories
  │    │    ├── curriculumService.ts
  │    │    └── hierarchyStorage.ts
  │    ├── mcq/                 # Parsing, validation, deduplication
  │    │    ├── universalParser.ts
  │    │    ├── contentHash.ts
  │    │    ├── duplicateScanner.ts
  │    │    └── ocrExtractor.ts
  │    ├── sync/                # Snapshot engine & offline write buffer
  │    │    ├── snapshotManager.ts
  │    │    ├── studentWriteBuffer.ts
  │    │    └── bulkSyncService.ts
  │    ├── analytics/           # Study analytics, weakness heuristics
  │    │    ├── studyAnalytics.ts
  │    │    └── smartPriority.ts
  │    ├── observability/       # Quota tracking, error monitoring
  │    │    ├── quotaTracker.ts
  │    │    └── productionMonitoring.ts
  │    └── export/              # PDF and document generators
  │         └── pdfGenerator.ts
  ├── context/                  # Consolidated React contexts
  └── components/               # Domain-isolated UI components
```

---

## 6. Architecture Maintainability Verdict

- **Current Architecture Grade:** **C+**
- **Strengths:** Excellent offline-first capability, robust quota protection (write buffer), responsive PWA performance, zero critical runtime crashes.
- **Weaknesses:** Excessive monolithic file sizes, 4 circular dependency loops, dual sync stacks, 5 redundant question importers, utility sprawl.
- **Maintainability Trajectory:** Without systematic refactoring, adding new features will become progressively slower and carry high regression risk. Executing the Phase 16 refactoring roadmap will elevate the codebase to an **A** grade.
