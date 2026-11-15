# DISHA 20-20 — System Architecture & Data Engineering

## 1. High-Level Architectural Topology

**DISHA 20-20 (दिशा 20-20)** is designed as a multi-tier, offline-first educational platform combining a high-performance Single Page Application (SPA), a serverless edge API, authoritative cloud databases, and resilient AI services.

```
+-----------------------------------------------------------------------------------+
|                                CLIENT LAYER (PWA)                                 |
|  React 19 SPA · Vite 8 · Tailwind CSS v4 · Workbox Service Worker · IndexedDB v5  |
+-----------------------------------------+-----------------------------------------+
                                          |
                      HTTPS (JSON / REST) | Static Assets & Bundles
                                          v
+-----------------------------------------------------------------------------------+
|                         EDGE / SERVERLESS LAYER (VERCEL)                          |
|  Global Edge CDN · Express 4 API (Node.js 22) · Rate Limiting · Auth Middleware   |
+-------------------+--------------------+--------------------+---------------------+
                    |                    |                    |
        Auth / Data |        Static CDN  |   Encrypted Keys   | AI Prompts
                    v                    v                    v
+-----------------------+ +---------------------+ +-------------------------------+
|  GOOGLE CLOUD /       | | VERCEL BLOB /       | | MULTI-PROVIDER AI VAULT       |
|  FIREBASE SERVICES    | | STATIC ASSET CACHE  | | - Google Gemini 2.0 / 1.5     |
| - Firebase Auth       | | - /api/quiz-assets  | | - Anthropic Claude 3.5 Sonnet |
| - Cloud Firestore     | | - /api/snapshots    | | - OpenAI GPT-4o               |
| - Cloud Storage       | | - Immutable JSON    | | - Groq Llama 3.3              |
+-----------------------+ +---------------------+ +-------------------------------+
```

---

## 2. Five-Tier Data Storage & Caching Hierarchy

To guarantee sub-second interaction speeds and eliminate cloud database quota exhaustion, DISHA 20-20 organizes all application data into five distinct tiers:

```
[ Tier 1: React In-Memory Context (ProgressContext, QuestionsContext) ]
                                |
[ Tier 2: IndexedDB v5 Local Database (18 Object Stores, Zero-Latency Reads/Writes) ]
                                |
[ Tier 3: Service Worker Cache (Workbox CacheFirst for Immutable Static Quiz Assets) ]
                                |
[ Tier 4: Serverless Static Quiz Assets & Snapshot APIs (/api/quiz-assets/*) ]
                                |
[ Tier 5: Authoritative Cloud Firestore (Restricted Writes, Strict Security Rules) ]
```

### Tier 1: React In-Memory State
- **Modules:** `ProgressContext.tsx`, `QuestionsContext.tsx`, `questionBankCache.ts`.
- **Latency:** `< 1 ms`.
- **Function:** Holds the currently active question, active session state, immediate UI selections, and instant score counters. Changes update the UI instantaneously via React 19's concurrent scheduler.

### Tier 2: IndexedDB v5 Local Database
- **Modules:** `src/services/snapshot/indexedDbV5.ts`, `src/utils/localDatabaseEngine.ts`.
- **Database Name:** `DISHA_2020_LOCAL_V5`.
- **Latency:** `2 – 10 ms`.
- **Function:** Serves as the persistent client-side database. It stores the full curriculum tree, downloaded question banks, student attempt history, bookmarks, wrong questions, and the pending sync outbox. All student operations during active sessions are committed here first.

### Tier 3: Service Worker Cache (Workbox)
- **Modules:** `vite.config.ts`, `src/utils/quizAssetSwCache.ts`, `public/sw-push-handler.js`.
- **Latency:** `5 – 15 ms`.
- **Function:** Intercepts HTTP network requests. Implements a `CacheFirst` policy for version-keyed static quiz assets (`/api/quiz-assets/*?v=...`), Google Fonts, KaTeX fonts, and UI icons. Static assets have a 90-day retention policy (`maxAgeSeconds: 7776000`).

### Tier 4: Serverless Static Quiz Assets & Delta CDN
- **Modules:** `src/server/quizAssetsService.ts`, `src/server/snapshotPublishingService.ts`.
- **Latency:** `40 – 120 ms`.
- **Function:** Pre-renders subject and topic bundles into immutable JSON files. When a student opens a topic, the application requests the bundle from this tier with `Cache-Control: public, max-age=31536000, immutable`, completely avoiding Cloud Firestore read operations.

### Tier 5: Cloud Firestore (Authoritative Store)
- **Modules:** `src/lib/firebase.ts`, `server.ts`, `firestore.rules`.
- **Latency:** `150 – 400 ms`.
- **Function:** Authoritative cloud database storing verified administrative curriculum data, published articles, registered users, live test answer keys, and aggregated leaderboards. Direct writes from student clients are strictly restricted.

---

## 3. Quota Defense & 24-Hour Routine Sync Architecture

### 3.1 The Quota Exhaustion Threat
Google Cloud Firestore charges per document read, write, and delete operation. A typical competitive exam student answers 150–300 MCQs daily. If each answer, bookmark, or review interval update were written directly to Firestore:
- 1,000 active students $\times$ 200 questions = **200,000 writes/day**.
- 10,000 active students $\times$ 200 questions = **2,000,000 writes/day**.

This volume rapidly exceeds standard free/low-tier limits and generates unsustainable cloud infrastructure costs.

### 3.2 The StudentWriteBuffer Engine
To solve this, DISHA 20-20 implements the `StudentWriteBuffer` (`src/utils/studentWriteBuffer.ts`):

```
Student Answers MCQ
       |
       v
Write to In-Memory State (Tier 1)
       |
       v
Commit to IndexedDB v5 (Tier 2: user_progress, wrong_questions)
       |
       v
Append Mutation to Local Outbox (pending_sync_queue)
       |
       v
Check Sync Eligibility: canPerformRoutineSync()?
   |                                    |
   |-- [ElapsedTime < 24 Hours] ------> REJECT: Remain in Local Outbox (0 Firestore Writes)
   |
   +-- [ElapsedTime >= 24 Hours] -----> ALLOW: Flush Outbox as Single Atomic Batch (1 Firestore Write)
```

### 3.3 The 24-Hour Eligibility Rule
Routine background synchronization is permitted only if **at least 24 hours (86,400,000 milliseconds)** have elapsed since the user's last recorded sync checkpoint:
```typescript
export function canPerformRoutineSync(lastSyncTimestamp: number | null): boolean {
  if (!lastSyncTimestamp) return true; // First-time initialization permitted
  const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;
  return Date.now() - lastSyncTimestamp >= TWENTY_FOUR_HOURS_MS;
}
```

### 3.4 Outbox Batch Aggregation
When the 24-hour threshold is met, the outbox processor aggregates all pending modifications into a single consolidated payload:
- Individual progress updates for the same question are collapsed into the latest state.
- Attempt counts and study times are summed.
- A single write operation updates `/users/{uid}/progress_summary` and `/users/{uid}/sync_metadata`, resulting in a **99.7% reduction in cloud database operations**.

---

## 4. Security Architecture & Trust Boundaries

```
[ UNTRUSTED PUBLIC CLIENT ]
  - React 19 App in Student Browser
  - Stores only VITE_ public config
  - Zero private credentials
          |
          | HTTPS + Authorization: Bearer <Firebase_ID_Token>
          v
[ TRUST BOUNDARY: SERVERLESS API MIDDLEWARE ]
  - authMiddleware.ts (Firebase Admin SDK)
  - Verify Token Signature & Expiration
  - Enforce email_verified == true
  - Check Admin Email Allowlist & Custom Claims
          |
          +---> [ AUTHORIZED ADMIN ROUTES ]
          |        - AI API Management
          |        - Database Backup & Restore
          |        - Snapshot Publishing
          |        - Curriculum Mutations
          |
          +---> [ AUTHORIZED STUDENT ROUTES ]
                   - Live Test Submissions
                   - Scanned Exam Matching
```

### 4.1 Secret Isolation Principles
1. **No Server Secrets in Client Bundles:** Only configuration keys prefixed with `VITE_` (`VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_PROJECT_ID`, etc.) are compiled into client assets. Private keys, service account JSON files, and database passwords are never exposed.
2. **AES-256-GCM Crypto Vault:** Administrative AI API keys (for Gemini, Claude, OpenAI, and Groq) are stored encrypted in Cloud Firestore using AES-256-GCM (`src/server/cryptoVault.ts`). The symmetric master key (`AI_ENCRYPTION_KEY`) resides exclusively in server environment variables.
3. **Admin Verification Predicate:** Super-admin operations require:
   - Non-anonymous authentication (`sign_in_provider != 'anonymous'`).
   - Verified email address (`email_verified == true`).
   - Exact email presence on the trusted allowlist:
     - `zdpaliyal@gmail.com`
     - `jagdishpaliyaljat@gmail.com`
   - Non-revoked, non-blocked account status (`blocked != true`).

---

## 5. Network Resilience & Offline Fallbacks

DISHA 20-20 employs automated fallback mechanisms across network fluctuations:
- **Offline Detection (`useOnlineStatus.ts`):** Actively listens to `window.addEventListener('online')` and `window.addEventListener('offline')`. When offline, UI indicators notify the student while local practice continues uninterrupted.
- **Circuit Breaker for AI Services (`aiProviderService.ts`):** If an AI provider returns HTTP 429 (Rate Limit) or HTTP 503 (Unavailable), the system automatically triggers an exponential cooldown period and routes subsequent requests to secondary configured providers (e.g., falling back from Gemini to Groq).
- **Graceful Font & Asset Fallback:** KaTeX mathematical fonts and Google Inter fonts are pre-cached locally; if CDN connectivity fails, system typography fallbacks ensure Hindi and mathematical symbols remain legible.
