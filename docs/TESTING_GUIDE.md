# DISHA 20-20 — Comprehensive Testing & Quality Assurance Guide

## 1. Quality Assurance Philosophy & Multi-Tier Matrix

**DISHA 20-20 (दिशा 20-20)** implements a rigorous multi-tier testing strategy ensuring that every layer—from client-side state transitions to cryptographic backup validation—is automatically verified prior to deployment.

```
+-------------------------------------------------------------------------------+
|                            TESTING PYRAMID LAYERS                             |
+-------------------+-------------------------------+---------------------------+
| TIER              | TARGET SCOPE                  | TOOLS & SUITES            |
+-------------------+-------------------------------+---------------------------+
| 1. Unit Tests     | Parsers, Leitner Intervals,   | Vitest 5.1.0, JSDOM 30    |
|                   | Typographical KaTeX Formatting| UniversalSmartParser.test |
| 2. Integration    | 24h Sync Buffer, Outbox Queue,| strict_24h_sync_master    |
|                   | Reversible Type Serialization | server-security-auth      |
| 3. Security Rules | Firestore Security Rules      | @firebase/rules-unit-test |
|                   | Default-Deny & Admin Claims   | firestore-security-rules  |
| 4. User Journeys  | Full End-to-End Simulation    | user-panel-e2e-journeys   |
|                   | Practice, Tests, Error Journal| curriculum-single-listener|
| 5. Stress & Scale | 1,000 Concurrent Users        | concurrency_1000_users    |
|                   | Memory Leak & Heap Stability  | scalability_phase13_stress|
| 6. Disaster Rec.  | 56 Collections Export/Restore | disaster-recovery-backup  |
|                   | Reversible Typing & Checksums | phase8-disaster-recovery  |
+-------------------+-------------------------------+---------------------------+
```

---

## 2. Test Execution Commands

### 2.1 Standard Automated Suite
Execute the entire Vitest test suite:
```bash
pnpm test
```
*(Runs `vitest run --fileParallelism=false`. Evaluates 10 test files and 89 test assertions).*

### 2.2 Running Individual Test Suites
```bash
# Student Panel End-to-End Journeys
npx vitest run tests/user-panel-e2e-journeys.test.ts

# 24-Hour Sync & Quota Defense Engine
npx vitest run tests/strict_24h_sync_master_test.ts

# Server Authentication & Security Middleware
npx vitest run tests/server-security-auth.test.ts

# Disaster Recovery, Backup & 5 Restore Modes
npx vitest run tests/disaster-recovery-backup-restore.test.ts

# Static Quiz Assets & Service Worker Caching
npx vitest run tests/quiz-assets-sw-cache.test.ts

# Curriculum Single Listener Memoization
npx vitest run tests/curriculum-single-listener.test.ts
```

### 2.3 Executing Concurrency & Stress Benchmarks
```bash
# 1,000 Synthetic Concurrent Users Benchmark
npx tsx tests/concurrency_1000_users_stress_test.ts

# Scalability & Stress Harness
npx tsx tests/scalability_phase13_stress_harness.ts
```

### 2.4 Executing Integrity & Phase Audit Scripts
```bash
# Phase 2 Write Optimization & Integrity Verification
pnpm run test:integrity

# Phase 3 User Panel Deep Forensic Audit
pnpm run test:phase3

# Phase 4 Controlled Database Migration Audit
pnpm run test:phase4

# Production Live Health Check
npx tsx scripts/run_production_health_check.ts
```

---

## 3. Catalog of Core Test Suites

### 3.1 `tests/user-panel-e2e-journeys.test.ts` (19 Tests)
Simulates realistic student journeys from onboarding to live test submission:
- **Journey A (Curriculum Navigation):** Validates subject tree drill-down, chapter topic resolution, and question count denormalization.
- **Journey B (MCQ Execution):** Tests 5 question formats (SCQ, Multiple Statements, Assertion/Reason, Match the Following, and LaTeX equations).
- **Journey C (RPSC 5th Option 'E' & Evaluation):** Validates $+2.0$ for correct, $-0.66$ for wrong, $0.0$ for Option 'E', and $-0.66$ penalty for unbubbled questions. Verifies automatic disqualification when $> 10\%$ questions are left blank.
- **Journey D (Leitner Spaced Repetition):** Validates interval transitions (`[3, 7, 21, 45, 75]` days), correct question promotion, and reset to Stage 0 on failure.

### 3.2 `tests/strict_24h_sync_master_test.ts` (24 Tests)
Validates the quota defense engine under simulated clock injections:
- **Zero Routine Writes:** Verifies that answering 100 questions issues **0 direct writes** to Firestore during an active session.
- **Clock Injection Tests:**
  - Elapsed Time $+1$ Hour: Sync blocked (`canPerformRoutineSync() === false`).
  - Elapsed Time $+12$ Hours: Sync blocked.
  - Elapsed Time $+23$ Hours $59$ Minutes: Sync blocked.
  - Elapsed Time $+24$ Hours: Sync permitted (`canPerformRoutineSync() === true`).
- **Outbox Deduplication:** Ensures multiple attempts on the same question collapse into a single atomic update.
- **Admin Preview Isolation:** Verifies admin test runs bypass cloud writes entirely.

### 3.3 `tests/server-security-auth.test.ts` (11 Tests)
Tests HTTP security and authorization middleware in `src/server/authMiddleware.ts`:
- Rejects requests missing `Authorization` header with HTTP 401.
- Rejects requests with malformed or forged JWT tokens with HTTP 401.
- Rejects authenticated non-admin users attempting administrative actions with HTTP 403.
- Enforces `email_verified == true` for super-admin operations.
- Confirms successful HTTP 200 authorization for verified allowlist emails (`zdpaliyal@gmail.com`).

### 3.4 `tests/disaster-recovery-backup-restore.test.ts` (15 Tests)
Validates backup archive generation and the 5 restore modes:
- **Completeness:** Confirms all 56 collections are discovered and exported.
- **Reversible Types:** Verifies round-trip preservation of Firestore `Timestamp`, `GeoPoint`, and `DocumentReference` objects.
- **Idempotency:** Confirms restoring the same archive twice produces zero duplicate records.
- **Relational Integrity:** Verifies all `subjectId`, `chapterId`, and `topicId` relationships remain valid post-restoration.

---

## 4. Writing New Tests with Mock Drivers

When writing new tests that interact with Firestore, use `MockFirestoreDriver` (`src/utils/mockFirestoreDriver.ts`) to avoid connecting to live production databases or requiring physical Google Service Account keys:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { createMockFirestoreDriver } from '../src/utils/mockFirestoreDriver';

describe('New Curriculum Feature', () => {
  let mockDriver: any;

  beforeEach(() => {
    mockDriver = createMockFirestoreDriver();
  });

  it('correctly creates a new academic subject', async () => {
    await mockDriver.collection('subjects').doc('rajasthan-polity').set({
      name: 'Rajasthan Polity',
      hindiName: 'राजस्थान की राजव्यवस्था',
      order: 3
    });

    const doc = await mockDriver.collection('subjects').doc('rajasthan-polity').get();
    expect(doc.exists).toBe(true);
    expect(doc.data().hindiName).toBe('राजस्थान की राजव्यवस्था');
  });
});
```
