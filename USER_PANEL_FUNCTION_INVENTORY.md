# DISHA 20-20 — USER PANEL FUNCTION INVENTORY
**Audit Date:** November 15, 2026  
**Auditor:** AntiGem Automated Deep Forensic Agent (Phase 3 Audit)  
**Target Application:** DISHA 20-20 Student Portal (`/data/user/0/com.termux/files/home/Disha-`)  
**Architecture:** Vite + React 19 + TypeScript + Tailwind CSS v4 + Firebase 12 + IndexedDB v5 + PWA Service Worker

---

## 1. Executive Summary & Architecture Overview

The DISHA 20-20 user-facing frontend is a high-performance, mobile-first Progressive Web Application (PWA) tailored for competitive examination aspirants (RPSC, RSMSSB, REET, CET, RAS). The user interface is driven by a unified state machine in `src/App.tsx`, controlled via canonical deep-linking routes and supported by an offline-first data synchronization engine (`IndexedDB v5` snapshot sync + `studentWriteBuffer`).

All user functions operate with complete isolation between unauthenticated guests, authenticated student accounts, and admin previews, ensuring that student performance tracking and question progress do not pollute administrative environments or exceed Firestore free-tier quotas.

---

## 2. Screen & Page Inventory

| # | View / Component | Primary Route / Tab | File Path | Purpose & Capabilities |
|---|---|---|---|---|
| 1 | **Home Dashboard** (`HomeTab`) | `/` (`home`) | [src/components/HomeTab.tsx](file:///data/user/0/com.termux/files/home/Disha-/src/components/HomeTab.tsx) | Preparation overview, accuracy gauge, real-time promotional banner carousel, 4-action practice matrix, AI setup shortcuts, mobile navigation drawer. |
| 2 | **Curriculum Explorer** (`TopicsTab`) | `/topics` (`topics`) | [src/components/TopicsTab.tsx](file:///data/user/0/com.termux/files/home/Disha-/src/components/TopicsTab.tsx) | 4-tier hierarchical syllabus navigation: Subject → Chapter → Topic → MCQ Listing with search, progress badges, and direct practice triggers. |
| 3 | **Chapter Detail View** (`ChapterDetailView`) | Modal / Drill-down | [src/components/ChapterDetailView.tsx](file:///data/user/0/com.termux/files/home/Disha-/src/components/ChapterDetailView.tsx) | Deep chapter analytics, topic completion percentage, full-chapter quiz launcher, and chapter question bank inspection. |
| 4 | **Topic Interaction Modal** (`TopicInteractionModal`) | Modal overlay | [src/components/TopicInteractionModal.tsx](file:///data/user/0/com.termux/files/home/Disha-/src/components/TopicInteractionModal.tsx) | Granular topic study: start practice session, view topic notes, export topic PDF, and launch smart test generator. |
| 5 | **MCQ Practice Engine** (`MCQSessionModal`) | Modal overlay | [src/components/MCQSessionModal.tsx](file:///data/user/0/com.termux/files/home/Disha-/src/components/MCQSessionModal.tsx) | Practice & Exam engine supporting 5 MCQ types, instant feedback / exam simulation, KaTeX math formulas, timer, review palette, and audio feedback. |
| 6 | **Mistake Bank & Bookmarks** (`WrongTab`) | `/wrong` (`wrong`) | [src/components/WrongTab.tsx](file:///data/user/0/com.termux/files/home/Disha-/src/components/WrongTab.tsx) | Revision hub: filter by Bookmarked, Mistakes, or Chapter-wise; toggle solution reveal, trigger spaced repetition sessions, clear mistakes. |
| 7 | **Live Tests & Mock Exams** (`LiveTestsTab`) | `/live_tests` (`live_tests`) | [src/components/LiveTestsTab.tsx](file:///data/user/0/com.termux/files/home/Disha-/src/components/LiveTestsTab.tsx) | Real-time scheduled mock exams, negative marking rules, timer auto-submission, live ranking leaderboards, and historical result analysis. |
| 8 | **Official PYQ Vault** (`PYQVaultTab`) | `/pyq_vault` (`pyq_vault`) | [src/components/PYQVaultTab.tsx](file:///data/user/0/com.termux/files/home/Disha-/src/components/PYQVaultTab.tsx) | Previous Year Question papers organized by exam board and year; official answer key comparison and full-length exam replay. |
| 9 | **Coaching Test Series** (`TestSeriesPage`) | `/test-series` (`test_series`) | [src/components/TestSeriesPage.tsx](file:///data/user/0/com.termux/files/home/Disha-/src/components/TestSeriesPage.tsx) | 4-level institutional series: Coaching Institute → Exam → Series → Individual Test with enrollment and merit tracking. |
| 10 | **Student Analytics Hub** (`AnalyticsTab`) | `/analytics` (`analytics`) | [src/components/AnalyticsTab.tsx](file:///data/user/0/com.termux/files/home/Disha-/src/components/AnalyticsTab.tsx) | 7-day study streak, subject-level mastery breakdown, syllabus coverage bar, Leitner stage distribution, and AI Weakness Heatmap. |
| 11 | **User Profile & Settings** (`ProfileTab`) | `/profile` (`profile`) | [src/components/ProfileTab.tsx](file:///data/user/0/com.termux/files/home/Disha-/src/components/ProfileTab.tsx) | Profile customization, target exam selection, study scorecard, offline cache reset, data export/import, and authentication management. |
| 12 | **Current Affairs & News** (`NewsPage`) | `/news` (`news`) | [src/components/news/NewsPage.tsx](file:///data/user/0/com.termux/files/home/Disha-/src/components/news/NewsPage.tsx) | Educational updates, vacancy circulars, syllabus notices with rich Markdown and interactive callouts. |
| 13 | **Notifications Center** (`NotificationsPage`) | `/notifications` | [src/components/NotificationsPage.tsx](file:///data/user/0/com.termux/files/home/Disha-/src/components/NotificationsPage.tsx) | Real-time broadcast alerts, daily study reminder history, and unread badge management. |
| 14 | **Authentication Portal** (`LoginPage`) | Modal / Tab | [src/components/LoginPage.tsx](file:///data/user/0/com.termux/files/home/Disha-/src/components/LoginPage.tsx) | Firebase Auth integration: Email/Password login, registration, password reset, and Guest mode transition. |

---

## 3. Navigation Controls & Shell Components

### 3.1 Top Navigation & Header
- **Mobile Header** (`src/components/HomeTab.tsx` L185-256):
  - Brand identity with SVG logo and non-wrapping `DISHA 20-20` badge.
  - Hamburger drawer button activating full navigation drawer.
  - Quick action icons: Notification bell with unread badge counter, Dark/Light mode toggle (`Sun`/`Moon`), and dynamic Auth CTA / Avatar.
- **Navigation Drawer** (`src/components/HomeTab.tsx` L470-650):
  - Student profile badge with avatar and target exam.
  - Navigation links: Home, Syllabus, PYQ Vault, Live Tests, Mistake Bank, Analytics, Test Series, News, Settings, About Us.
  - Quick utility links: Dark mode toggle, PWA install prompt, Logout/Login trigger.

### 3.2 Primary Bottom Navigation Bar (`BottomNav.tsx`)
- **Fixed Persistent Bar** (`src/components/BottomNav.tsx` L39-89):
  - 5 core destinations: Home (`Home`), Subjects (`BookOpen`), Paper Scan (`Scan`), Tests (`Trophy` with pulse indicator for live events), Profile (`User`).
  - Conditional Admin icon (`ShieldCheck`) automatically injected when authenticated user has allowlisted admin claims.
  - Full safe-area inset compliance for mobile notched displays (`env(safe-area-inset-bottom)`).

---

## 4. Modals & Interactive Overlays

| Component | Trigger | Key Functionalities |
|---|---|---|
| **MCQSessionModal** | Topic, Chapter, PYQ, or Live Test start | Full question carousel, virtualized option selector, KaTeX formulas, statement cards, assertion-reason parser, timer countdown, review palette, and instant celebration. |
| **CustomSmartTestModal** | Home quick action matrix | Multi-subject selection, question count slider (10 to 100), difficulty weighting, and randomized test bundle generator. |
| **FullExamModal** | Subject or chapter action | Full timed mock exam mode with official negative marking and final report generation. |
| **AppSettingsModal** | Profile / Settings | Toggle sound effects, haptic vibration, font size adjustments, auto-advance delay, and high-contrast night mode. |
| **ApiSettingsModal** | Home setup card / Profile | Personal Gemini API key configuration, multi-key fallback pool, and BYOK validation. |
| **PDFExportModal** | Topic / Chapter / Wrong list | Client-side jsPDF generator for offline question paper and answer key export with watermark and branding. |
| **ShareModal** | Share buttons across app | Web Share API integration with fallback clipboard URL copy, QR code display, and WhatsApp deep-link. |
| **GlobalSearchModal** | Header search icon | Ultra-fast client-side indexing of subjects, chapters, topics, and MCQs with instant keyboard navigation. |
| **ExamPaperAnalyzerModal** | BottomNav "Paper Scan" | OCR / camera-based paper extraction, question segmentation, and syllabus matching. |

---

## 5. MCQ Question Types & Evaluation Engine

The practice engine supports 5 distinct question architectures:
1. **Single-Choice Standard MCQ**: 4 options with single correct choice, comprehensive explanation, and reference notes.
2. **Multi-Statement Evaluation**: Statement 1, 2, 3 cards with compound options (`Only 1`, `1 and 2`, etc.).
3. **Assertion & Reason (A/R)**: Formal assertion `(A)` and reason `(R)` blocks with standard RPSC 4-choice relation evaluation.
4. **Match the Following**: Two-column layout (List-I and List-II) with pairing codes (`A-1, B-2, C-3`).
5. **Mathematical & Scientific Formula MCQs**: Inline and display LaTeX equations rendered via KaTeX engine (`src/components/MathText.tsx`).

---

## 6. Data Synchronization & Persistence Hierarchy

1. **Memory State**: Instant UI updates via React Context (`QuestionsContext`, `ProgressContext`).
2. **Local Database Engine (`localDatabaseEngine.ts`)**: Browser IndexedDB cache (`quizpro_cache_v5`) holding curriculum and MCQs.
3. **Student Write Buffer (`studentWriteBuffer.ts`)**:
   - Aggregates student answers in memory and IndexedDB outbox.
   - Flushes in chunks of max 400 operations upon threshold (10 answers) or test completion.
4. **Cloud Synchronization (`useFirebaseSync.ts` & `useSnapshotSync.ts`)**:
   - Incremental version checks (`metadata/app_version`).
   - Zero Firestore read cost for static curriculum via Service Worker asset caching.
   - Encrypted token authentication for verified progress syncing.
