# DISHA 20-20 — Project Directory & Architecture Guide

This document provides a comprehensive mapping of every major directory, subsystem, and critical file in the **DISHA 20-20 (दिशा 20-20)** repository located at `/data/user/0/com.termux/files/home/Disha-`.

---

## 1. Top-Level Repository Structure

```
/data/user/0/com.termux/files/home/Disha-/
├── .env.local                   # Local environment variable overrides (NEVER commit secrets)
├── .firebaserc                  # Firebase project alias mapping
├── .gitignore                   # Git exclusion rules
├── .npmrc                       # Package manager configuration
├── .vercel/                     # Vercel deployment cache and project link metadata
├── .vercelignore                # Files excluded from Vercel Serverless deployments
├── api/                         # Vercel Serverless functions build target
│   └── index.js                 # Compiled serverless entrypoint for edge/node execution
├── backups/                     # Local archive store for JSON & ZIP database snapshots
├── dev-dist/                    # Development build cache for PWA service workers
├── dist/                        # Production build output (static assets and server bundles)
├── docs/                        # Complete Phase 16 developer documentation and handover guides
├── education-content/           # Static curriculum definitions, offline JSON dumps
├── eslint.config.js             # ESLint configuration
├── firebase.json                # Firebase hosting, firestore, and storage rules configuration
├── firestore.rules              # Cloud Firestore security rules (role checks & schema enforcement)
├── index.html                   # HTML entrypoint with viewport, PWA meta, and KaTeX fonts
├── package.json                 # Project dependencies, scripts, and runtime engine specifications
├── pnpm-lock.yaml               # Deterministic pnpm dependency lockfile
├── public/                      # Static assets served at root (PWA icons, manifest, sounds)
├── recovery_manifest.json       # Canonical baseline manifest for disaster recovery verification
├── reports/                     # Audit logs, benchmarks, and multi-phase certification reports
├── scripts/                     # Operational automation, migration, and diagnostic scripts
├── server.ts                    # Dual-mode server: Express API + Vite HMR development server
├── src/                         # Application source code (React 19 + TypeScript)
├── tests/                       # Automated test suites (Vitest, stress tests, security tests)
├── tsconfig.json                # Strict TypeScript configuration
├── vercel.json                  # Vercel Serverless routing, functions, and rewrite rules
└── vite.config.ts               # Vite build configuration, PWA Workbox plugins & chunk splitting
```

---

## 2. Root Configuration & Server Files

| File | Primary Responsibility |
|:---|:---|
| `server.ts` | **Central Backend Server (107 KB):** Express 4 application providing all `/api/*` endpoints. In development, mounts Vite HMR middleware (`vite.middlewares`). In production, serves static assets from `dist/` or handles API requests. Includes rate limiting, CORS, compression, and error handlers. |
| `vite.config.ts` | **Bundler & PWA Config:** Configures React 19 plugin, Tailwind CSS v4, manual Rollup chunk splitting (`vendor-react`, `vendor-firebase`, `vendor-katex`, `vendor-pdf`), and Workbox Service Worker caching rules for offline operation. |
| `vercel.json` | **Edge Deployment Config:** Declares serverless function resource allocation (`memory: 1024`, `maxDuration: 60`), included files (`education-content/**`), and URL rewrite routes mapping `/api/*`, `/news/*`, `/sitemap.xml` to `api/index.js`. |
| `firestore.rules` | **Cloud Database Security:** Comprehensive security rules for all 56 Firestore collections. Enforces default-deny, verifies admin allowlist email & custom claims, and restricts student writes. |
| `package.json` | **Package Manifest:** Declares Node 22 runtime engine, dependencies (`react@19`, `firebase@12`, `motion@12`, `katex@0.19`), and build/test scripts (`pnpm dev`, `pnpm build`, `pnpm test`). |
| `tsconfig.json` | **TypeScript Compiler Configuration:** Configures ES2020 target, strict type safety, JSX transform (`react-jsx`), and path aliases (`@/*`). |

---

## 3. Source Directory Breakdown (`src/`)

```
src/
├── App.tsx                      # Root component: active tab switching, modal orchestration, notifications
├── main.tsx                     # Entrypoint: React DOM root mounting, PWA update listener, crash recovery
├── index.css                    # Tailwind CSS v4 root stylesheet, typography rules, custom scrollbars
├── types.ts                     # Universal TypeScript data contracts, interfaces, and enums
├── vite-env.d.ts                # Vite client environment type declarations
├── components/                  # Student interface and general user components
│   ├── admin/                   # Administrative panels, CMS editors, and management tools
│   ├── analyzer/                # AI Exam paper scanner, OCR extractor, and question matcher
│   ├── news/                    # Educational news, exam notifications, and article viewers
│   └── ui/                      # Reusable atom UI components (Button, Modal, Input, Badge)
├── config/                      # Application-wide static configuration
│   └── siteConfig.ts            # Site branding, SEO metadata, contact details, social links
├── context/                     # React Context providers for global reactive state
│   ├── ProgressContext.tsx      # Student question progress, Leitner stages, and review queues
│   ├── QuestionsContext.tsx     # Curriculum tree, custom questions, and active question store
│   └── QuizProProvider.tsx      # Composite top-level state provider wrapping the application
├── data/                        # Static seeds, mock data, and fallback curriculum files
├── hooks/                       # Custom React lifecycle and state synchronization hooks
│   ├── useCurriculumManager.ts  # Curriculum drill-down navigation and topic filtering
│   ├── useFirebaseSync.ts       # Shared memoized listener for remote curriculum updates
│   ├── useModalState.ts         # Generic modal open/close and history back-button binding
│   ├── useNavigation.ts         # Browser URL hash and active tab navigation
│   ├── useOnlineStatus.ts       # Network online/offline detection listener
│   ├── usePWAInstall.ts         # PWA install prompt handler
│   └── useSnapshotSync.ts       # Client-side snapshot and delta sync manager
├── lib/                         # External SDK wrappers and base clients
│   ├── firebase.ts              # Firebase client SDK initialization (Auth, Firestore, Storage)
│   ├── firestore-errors.ts      # Standardized Firestore error parser and offline fallbacks
│   └── mcqImport/               # CSV, TSV, and plain-text question parsing engines
├── server/                      # Server-side service modules shared between server.ts and vercelHandler.ts
│   ├── authMiddleware.ts        # Express authentication & admin claim verification middleware
│   ├── backupEngine.ts          # Complete backup, restore, validation, and disaster recovery engine
│   ├── cryptoVault.ts           # AES-256-GCM symmetric encryption for AI API keys
│   ├── liveTestService.ts       # Live test submission processing, scoring, and leaderboard ranking
│   ├── quizAssetsService.ts     # Versioned static quiz asset bundling and immutable cache responses
│   ├── rateLimiter.ts           # Token bucket rate limiting middleware for public endpoints
│   ├── snapshotPublishingService.ts # Admin snapshot generator and delta calculation service
│   ├── typedSerialization.ts    # Reversible Firestore type serialization (Timestamps, GeoPoints)
│   ├── vercelHandler.ts         # Serverless entrypoint exporting Express app for Vercel functions
│   └── zipEngine.ts             # In-memory ZIP archive creation, extraction, and SHA-256 checksums
├── services/                    # Specialized client data services
│   ├── britishPronunciationService.ts # Oxford English pronunciation audio proxy client
│   ├── firestoreDataService.ts  # Direct Firestore query abstractions for admin operations
│   └── snapshot/                # Snapshot synchronization client subsystem
│       ├── checksumValidator.ts # Client SHA-256 integrity verification
│       ├── deltaProcessor.ts    # Merging deltas into IndexedDB v5
│       ├── indexedDbV5.ts       # 18-store IndexedDB implementation with transactional safety
│       ├── manifestManager.ts   # Manifest retrieval and version comparison
│       ├── migrationV4toV5.ts   # Automated database migration from legacy stores to v5
│       ├── snapshotManager.ts   # Chunker and loader for complete database snapshots
│       ├── syncScheduler.ts     # Periodic sync worker and idle-time scheduler
│       ├── types.ts             # Snapshot, manifest, and delta TypeScript contracts
│       └── userActivityQueue.ts # Local activity queue for deferred background sync
├── styles/                      # Theme tokens and style constants
└── utils/                       # Core business logic and algorithmic engines
    ├── UniversalSmartParser.ts  # Multi-format question parser (Text, Docx, HTML, Markdown)
    ├── adminToast.ts            # Admin panel feedback notification dispatcher
    ├── aiFormatter.ts           # AI prompt builder for question structuring
    ├── aiMultiProviderService.ts# Client client for multi-provider AI routing
    ├── aiProviderService.ts     # Server AI provider client (Gemini, Claude, GPT, Groq)
    ├── analytics.ts             # User performance statistics and telemetry aggregator
    ├── api.ts                   # Fetch API wrapper with timeout and error handling
    ├── appVersionService.ts     # App version detection and service worker reload notifier
    ├── articleStorage.ts        # Article CMS storage and IndexedDB cache
    ├── audioFeedback.ts         # Audio synthesis for correct/wrong answer sounds
    ├── bannerStorage.ts         # Promotional and notification banner store
    ├── bootstrapService.ts      # App boot sequence: DB init, cache hydration, auth check
    ├── bulkSyncService.ts       # Admin bulk collection synchronization
    ├── categoryStorage.ts       # Exam category metadata storage
    ├── cleanSlate.ts            # Emergency cache purge and reset utility
    ├── coachingHierarchyStorage.ts # Coaching -> Exam -> Test Series relational storage
    ├── contentHash.ts           # MD5/SHA-256 question content hashing for deduplication
    ├── curriculumUtils.ts       # Tree traversal, topic flattening, and question counting
    ├── dataIntegrityEngine.ts   # Database integrity scanner and orphan repair engine
    ├── duplicateAuditService.ts # Background question duplicate detection service
    ├── examMatcher.ts           # Fuzzy and semantic question matcher for paper scans
    ├── examOcrExtractor.ts      # Optical character recognition extractor for uploaded tests
    ├── examPaperStorage.ts      # Scanned paper analyses and OCR result storage
    ├── examPdfReport.ts         # PDF generation for exam performance reports
    ├── featureAccessService.ts  # Role-based feature gatekeeper and subscription checker
    ├── firebaseSyncService.ts   # Background Firestore synchronization engine
    ├── fullExamGenerator.ts     # Random full-length mock exam generator
    ├── guestManager.ts          # Anonymous guest session and local progress persistence
    ├── htmlMcqParser.ts         # Specialized DOM parser for table-based MCQ imports
    ├── idempotency.ts           # Client-side request deduplication and idempotency keys
    ├── indexedDbCache.ts        # Legacy IndexedDB cache adapter
    ├── liveTestStorage.ts       # Live test definitions, registrations, and cached results
    ├── localDatabaseEngine.ts   # High-level IndexedDB query and transaction interface
    ├── mcqCollectionAdapter.ts  # Dual-write bridge syncing `questions` and `mcqs`
    ├── pdfGenerator.ts          # Client-side PDF export engine using jsPDF & html2canvas
    ├── performanceStorage.ts    # Question-level response time and accuracy metrics
    ├── permanentDataIntegrity.ts# Strict relational referential constraint validator
    ├── phase4MigrationService.ts# Migration coordinator for schema upgrades
    ├── productionMonitoring.ts  # Error boundary reporter and production health logger
    ├── pyqStorage.ts            # Previous year question papers and attempt store
    ├── questionBankCache.ts     # In-memory LRU cache for high-frequency questions
    ├── questionBundleService.ts # Client bundle loader for topic questions
    ├── questionsParser.ts       # Comprehensive question parsing and validation suite
    ├── questionsStorage.ts      # Central facade for question CRUD operations
    ├── quizAssetSwCache.ts      # Service Worker static asset cache coordinator
    ├── quotaTracker.ts          # Client-side read/write counter and quota alert dispatcher
    ├── revision.ts              # Spaced repetition Leitner box scheduler
    ├── safeStorage.ts           # Fail-safe wrapper around localStorage with memory fallback
    ├── scanMcqDuplicates.ts     # Levenshtein and token-overlap duplicate detector
    ├── seo.ts                   # Dynamic OpenGraph, Twitter card, and meta tag manager
    ├── shareService.ts          # Web Share API wrapper with clipboard fallback
    ├── sitemapGenerator.ts      # Dynamic XML sitemap generator
    ├── smartArticleImporter.ts  # Markdown and HTML article parser
    ├── smartPriority.ts         # Weakness score and priority question selector
    ├── smartTestGenerator.ts    # Adaptive test generator based on student weaknesses
    ├── storage.ts               # LocalStorage key registry
    ├── studentWriteBuffer.ts    # 24-hour sync write buffer and outbox queue
    ├── syncCheckpointRegistry.ts# Synchronization checkpoint tracker
    ├── syncCoordinator.ts       # Master sync coordinator managing write limits
    ├── syncPolicyManager.ts     # Online/offline sync policy rules
    └── ultraFastSearchEngine.ts # In-memory inverted index for sub-3ms Hindi search
```

---

## 4. Key Subsystem Responsibilities

### 4.1 Client Presentation Layer (`src/components/`)
- **`App.tsx`:** Primary single-page application shell. Maintains `activeTab` state, mounts bottom navigation (`BottomNav.tsx`), handles modal visibility (`MCQSessionModal`, `GlobalSearchModal`, `ApiSettingsModal`), and binds browser history navigation.
- **`components/admin/`:** Dedicated administrative interface containing 45+ components for managing curriculum, importing questions, viewing quota consumption, rotating AI keys, managing articles, and executing database backups.
- **`components/analyzer/`:** Specialized exam scanner interface that coordinates client-side image preprocessing, OCR extraction, and interactive side-by-side matching against the question repository.
- **`components/news/`:** Student-facing news portal rendering educational notifications, syllabus updates, and rich articles created in the block editor.

### 4.2 Offline & Storage Subsystem (`src/services/snapshot/` & `src/utils/`)
- **`indexedDbV5.ts`:** Manages an IndexedDB database (`DISHA_2020_LOCAL_V5`) featuring 18 dedicated object stores. Provides fully indexed local reads for subjects, chapters, topics, MCQs, and student progress records.
- **`studentWriteBuffer.ts`:** Intercepts student telemetry (answers, scores, bookmarks) and commits them to IndexedDB. Maintains an `outbox` queue and evaluates `canPerformRoutineSync()` before allowing remote writes to Firestore.
- **`quizAssetSwCache.ts`:** Coordinates with the Service Worker to fetch pre-bundled, immutable JSON representations of topics from `/api/quiz-assets/*`, completely bypassing Firestore for standard practice sessions.

### 4.3 Serverless & Express Backend (`server.ts` & `src/server/`)
- **`server.ts`:** Boots the Express server on port 3000 (or `process.env.PORT`). Serves both API routes and the client bundle. Handles Vite HMR during development.
- **`vercelHandler.ts`:** Serverless entrypoint bundled with `esbuild`. Normalizes incoming Vercel serverless requests and proxies them through the Express route handlers.
- **`authMiddleware.ts`:** Verifies incoming `Authorization: Bearer <token>` headers using Firebase Admin SDK. Validates email verification and cross-references user UIDs against administrative allowlists.
- **`backupEngine.ts`:** Handles full and selective database exports, converts Firestore documents into reversibly typed JSON, compresses them into `.zip` archives with SHA-256 manifests, and executes transactional restorations.

### 4.4 Quality Assurance & Testing Suite (`tests/` & `scripts/`)
- **`tests/`:** Contains automated test suites covering end-to-end student journeys (`user-panel-e2e-journeys.test.ts`), 24-hour sync quota defense (`strict_24h_sync_master_test.ts`), server authentication (`server-security-auth.test.ts`), disaster recovery (`disaster-recovery-backup-restore.test.ts`), and 1,000-user concurrency stress tests.
- **`scripts/`:** Operational scripts for database verification, orphan deletion, sitemap generation, and staging environment validation.
