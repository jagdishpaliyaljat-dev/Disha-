# DISHA 20-20 — Frontend Architecture & UI Engineering

## 1. Frontend Framework & Foundation

**DISHA 20-20**'s frontend is constructed with **React 19.0.1** and **TypeScript 7.0.2**, bundled with **Vite 8.3.0**, styled using **Tailwind CSS v4.3.3**, and delivered as a Progressive Web Application (PWA).

The frontend prioritizes:
- **Instantaneous Touch Response:** Sub-50ms user action response times using React 19's concurrent rendering primitives.
- **Zero-Layout-Shift Fluid Design:** Adaptive mobile-first UI with 0px horizontal overflow across viewports ranging from 320px mobile screens to 4K desktop displays.
- **Offline Autonomy:** Full interactivity and question execution when disconnected from the internet.
- **Scientific Typography:** Native Devanagari Hindi font rendering and KaTeX mathematical formula formatting.

---

## 2. Component Hierarchy & Navigation Routing

### 2.1 State-Driven View Architecture
Rather than relying on heavy client-side router packages with URL churn, DISHA 20-20 utilizes an ergonomic, state-driven navigation architecture orchestrated by `useNavigation.ts` and managed in `App.tsx`:

```
                                  [ main.tsx ]
                                       |
                               [ QuizProProvider ]
                                       |
                           +-----------+-----------+
                           |                       |
                  [ QuestionsContext ]    [ ProgressContext ]
                           |                       |
                           +-----------+-----------+
                                       |
                                   [ App.tsx ]
                                       |
             +-------------------------+-------------------------+
             |                                                   |
      [ TopHeaderBar ]                                     [ BottomNav ]
             |                                                   |
             +-------------------------+-------------------------+
                                       |
                       Current View State (`viewState`)
                                       |
       +-------------------------------+-------------------------------+
       |                               |                               |
[ ViewState: "tab" ]         [ ViewState: "chapter" ]        [ ViewState: "mcq" ]
       |                               |                               |
  ActiveTab:                 [ ChapterDetailView ]            [ MCQSessionModal ]
  - HomeTab                          (Drill down into                 (Full Screen
  - TopicsTab                         topics & MCQs)                   Test Session)
  - AnalyticsTab
  - WrongTab
  - LiveTestsTab
  - PYQVaultTab
  - NewsPage
  - AdminTab
```

### 2.2 Navigation States & Tabs
The navigation state is defined in `src/types.ts`:
```typescript
export type ActiveTab =
  | "home" | "topics" | "analytics" | "wrong" | "profile"
  | "admin" | "notifications" | "analyzer" | "pyq_vault"
  | "live_tests" | "test_series" | "news" | "admin_news"
  | "about" | "privacy-policy" | "terms-of-service"
  | "contact" | "disclaimer";

export type ViewState =
  | { type: "tab" }
  | { type: "chapter"; chapterId: string }
  | { type: "chapter-wrong-list"; chapterId: string }
  | { type: "mcq"; session: MCQSession };
```

- **Back-Button Trapping (`useModalState.ts`):** When full-screen modals or MCQ sessions are opened, a dummy state is pushed to `window.history`. When the student presses the device's hardware back button, the modal intercepts the `popstate` event, closing the modal instead of exiting the application.

---

## 3. Global State Management & React Context

Global state is partitioned into two specialized React Context providers:

### 3.1 QuestionsContext (`src/context/QuestionsContext.tsx`)
Manages the curriculum hierarchy and active question stores:
- **`subjects`:** Array of verified academic subjects (e.g., Rajasthan History, Geography, Polity).
- **`chapters`:** List of chapters linked to parent `subjectId`.
- **`topics`:** Granular topics mapped to parent `chapterId`.
- **`questions`:** In-memory collection of active practice questions.
- **`userStore`:** User-created custom questions, subject extensions, or draft additions.

### 3.2 ProgressContext (`src/context/ProgressContext.tsx`)
Manages student learning telemetry, mastery levels, and Leitner review intervals:
- **`progress`:** Dictionary mapping `questionId -> QuestionProgress`:
  - `status`: `"unattempted" | "correct" | "wrong"`
  - `stage`: `0` to `4` (Leitner Leitner box level)
  - `nextReviewAt`: String in `YYYY-MM-DD` format
  - `wrongCount`: Total number of incorrect attempts
  - `bookmarked`: Boolean flag
  - `lastAnsweredAt`: ISO timestamp
- **`todayStats`:** Real-time counters tracking questions answered today, accuracy percentage, and study minutes.

### 3.3 QuizProProvider (`src/context/QuizProProvider.tsx`)
A composite provider wrapper mounted in `main.tsx` that ensures consistent dependency injection order and avoids unnecessary re-renders.

---

## 4. Custom Hooks Catalog

| Hook | Purpose & Implementation |
|:---|:---|
| `useCurriculumManager.ts` | Provides optimized tree-traversal functions: `getChaptersBySubject()`, `getTopicsByChapter()`, and dynamic question count aggregations. |
| `useFirebaseSync.ts` | **Single Memoized Curriculum Listener:** Ensures only one physical connection listens for remote curriculum changes. Hydrates curriculum trees via static service worker assets (`/api/quiz-assets/curriculum`) with zero Firestore client reads. |
| `useNavigation.ts` | Synchronizes URL hash fragments with the `activeTab` state, supporting direct linking and bookmarking of specific tabs. |
| `useModalState.ts` | Handles modal lifecycles with keyboard accessibility (Escape key closing) and mobile hardware back-button trapping. |
| `useOnlineStatus.ts` | Listens to browser network transitions (`online` / `offline`), updating connection banners across the UI. |
| `usePWAInstall.ts` | Captures the browser's `beforeinstallprompt` event and triggers the customized native install modal. |
| `useSnapshotSync.ts` | Connects the client to the snapshot synchronization subsystem, validating local versions against remote manifest files. |

---

## 5. Styling, Theming & Typography

### 5.1 Tailwind CSS v4 Architecture
The project uses the latest **Tailwind CSS v4** engine (`@tailwindcss/vite`), featuring CSS-first configuration in `src/index.css`. This eliminates legacy `tailwind.config.js` overhead and accelerates compilation.

- **Theme Tokens:** Primary branding uses saffron and royal indigo accents:
  - Brand Primary: `#E65100` (Deep Saffron / Amber)
  - Brand Secondary: `#1E3A8A` (Civil Services Navy)
  - Dark Surface: `#0F172A` (Slate 900) / Card Surface: `#1E293B` (Slate 800)
- **Dark Mode Support:** Managed via the `.dark` class toggled on the `<html>` root element. All components implement explicit `dark:` variant classes.

### 5.2 Mathematical & Hindi Typography
- **KaTeX Integration (`MathText.tsx`):** Parses text containing LaTeX syntax (`$a^2 + b^2 = c^2$` or `$$\int_0^1 f(x)dx$$`) and renders accessible mathematical typography via KaTeX v0.19.0.
- **Devanagari Font Smoothing:** Utilizes high-legibility Google fonts (Noto Sans Devanagari and Inter) with optimized subpixel rendering rules in `src/index.css` to prevent glyph clipping.

---

## 6. Rendering Performance & Code Splitting

### 6.1 Virtualized Question Lists
Large question sets (such as comprehensive full exams containing 150–200 questions) use virtualized rendering (`src/components/VirtualizedQuestionList.tsx` via `react-window`). Only the questions visible within the active viewport window are rendered to the DOM, keeping DOM node counts `< 300` and memory usage low.

### 6.2 Manual Rollup Chunk Splitting
In `vite.config.ts`, heavy third-party vendor dependencies are partitioned into isolated chunks to maximize browser caching and avoid monolithic bundle downloads:

```typescript
rollupOptions: {
  output: {
    manualChunks: (id) => {
      if (id.includes('node_modules/react/') || id.includes('node_modules/react-dom/')) return 'vendor-react';
      if (id.includes('node_modules/firebase/')) return 'vendor-firebase';
      if (id.includes('node_modules/lucide-react/')) return 'vendor-icons';
      if (id.includes('node_modules/motion/') || id.includes('node_modules/framer-motion/')) return 'vendor-motion';
      if (id.includes('node_modules/katex/')) return 'vendor-katex';
      if (id.includes('node_modules/jspdf/') || id.includes('node_modules/html2canvas/')) return 'vendor-pdf';
    }
  }
}
```

---

## 7. Progressive Web Application (PWA) & Service Worker

The PWA subsystem (`vite-plugin-pwa` v2.0.0) enables installation on Android, iOS, and desktop browsers:
- **Manifest (`manifest.json`):** Defines `standalone` display mode, start URL (`/`), theme color (`#FFFFFF`), and maskable vector icons (`pwa-192x192.png`, `pwa-512x512.png`).
- **Workbox Caching Strategies:**
  - `CacheFirst`: Version-keyed static quiz assets (`/api/quiz-assets/*`), Google Fonts, KaTeX assets, and media files (90-day retention).
  - `StaleWhileRevalidate`: Core navigation routes (`/topics`, `/profile`, `/study`, `/analytics`, `/news`).
  - `NetworkFirst`: Dynamic live test submissions, user profile syncs, and fresh notifications.
- **Web Push Notifications (`sw-push-handler.js`):** Receives background push notifications for upcoming live tests and daily revision reminders.
