# DISHA 20-20 — Developer Handover & Knowledge Transfer Checklist

This checklist provides incoming software engineers, DevOps leads, and system administrators with a comprehensive guide to assuming full operational ownership of **DISHA 20-20 (दिशा 20-20)**.

---

## 1. Access & Account Provisioning

Ensure the incoming engineer has been granted appropriate role-based access across all platform consoles:

| Infrastructure Layer | Service / Console | Required Permission Level | Verification Step | Completed? |
|:---|:---|:---|:---|:---:|
| **Source Control** | GitHub Repository | `Admin` / `Maintainer` | Clone repo, create branch, push PR | [ ] |
| **Hosting & Edge** | Vercel Team Dashboard | `Member` / `Owner` | View deployments, inspect runtime logs | [ ] |
| **Database & Auth** | Firebase Console (`disha-2020`) | `Editor` / `Owner` | Inspect Firestore collections & Auth users | [ ] |
| **Cloud Storage** | Google Cloud Console | `Storage Admin` | Verify bucket access and CORS policies | [ ] |
| **AI Intelligence** | Google AI Studio (Gemini) | API Key Access | Test API key via `/api/ai/test-key` | [ ] |
| **AI Fallback** | Anthropic / OpenAI / Groq | API Key Access | Confirm backup providers in AI Vault | [ ] |
| **Domain & DNS** | DNS Provider / Registrar | DNS Record Management | Verify `disha-2020.vercel.app` CNAME/A records | [ ] |

---

## 2. Workstation Setup & Verification Checklist

Complete the local workstation setup following [LOCAL_DEVELOPMENT_SETUP.md](file:///data/user/0/com.termux/files/home/Disha-/docs/LOCAL_DEVELOPMENT_SETUP.md):

- [ ] **Node.js 22.x Installed:** Verified via `node -v` (Must output `v22.x.x`).
- [ ] **pnpm Installed:** Verified via `pnpm -v` (Must be $\ge 9.0.0$).
- [ ] **Repository Cloned:** Cloned to target directory.
- [ ] **Dependencies Installed:** `pnpm install` completed with zero missing dependencies.
- [ ] **Environment File Configured:** `.env.local` populated with public `VITE_` variables and private server secrets.
- [ ] **TypeScript Linting Passed:** `pnpm lint` passes with **0 errors**.
- [ ] **Automated Test Suite Passed:** `pnpm test` passes with **89 passed assertions**.
- [ ] **Local Server Verified:** `pnpm dev` launches development server at `http://localhost:3000`.

---

## 3. Inviolable Architectural & Coding Principles

Incoming engineers must strictly uphold the following core architectural invariants:

### Rule 1: Never Bypass the StudentWriteBuffer
- **Standard:** Student practice interactions (answering MCQs, bookmarking questions, logging study minutes) **must never issue direct writes to Cloud Firestore**.
- **Reason:** Direct writes immediately exhaust Firestore monthly write quotas and generate severe cloud costs.
- **Implementation:** Always commit modifications through `src/utils/studentWriteBuffer.ts` into IndexedDB v5. Routine cloud sync is permitted only when `canPerformRoutineSync()` validates that 24 hours have elapsed.

### Rule 2: Strict Zero-Based MCQ Indexing ($0..3$ or $0..4$)
- **Standard:** In all database documents, parser outputs, and frontend state, `correctIndex` and selected option indices must be **zero-based integers** ($0$ = Option A, $1$ = Option B, $2$ = Option C, $3$ = Option D, $4$ = Option E).
- **Reason:** Legacy 1-based indexing ($1..4$) corrupts answer evaluations and breaks user scorecards.

### Rule 3: Maintain Referential Hierarchy & Orphan Defense
- **Standard:** Questions must always be linked to a valid `topicId`, which must link to a valid `chapterId`, which must link to a valid `subjectId`.
- **Implementation:** Never delete parent chapters or topics without executing the orphan defense routine (`dataIntegrityEngine.ts`). Any displaced questions must be reassigned to the default topic (`top-general`).

### Rule 4: Strict Security Isolation of AI Secrets
- **Standard:** AI API keys (Gemini, Claude, OpenAI, Groq) must **never be embedded in client-side code** or prefixed with `VITE_`.
- **Implementation:** Keys must be encrypted using AES-256-GCM via `src/server/cryptoVault.ts` using the master `AI_ENCRYPTION_KEY` and stored server-side.

### Rule 5: Reversible Serialization for Backups
- **Standard:** Database export and restore utilities must preserve native Firestore types (`Timestamp`, `GeoPoint`, `DocumentReference`) using standardized JSON envelopes (`typedSerialization.ts`).

---

## 4. Operational Runbooks & Key File Pointers

| Operational Task | Guide / Reference File | Key Command or Endpoint |
|:---|:---|:---|
| **Deploying to Production** | [DEPLOYMENT_RELEASE_GUIDE.md](file:///data/user/0/com.termux/files/home/Disha-/docs/DEPLOYMENT_RELEASE_GUIDE.md) | `git push origin main` or `vercel --prod` |
| **Instant Rollback** | [DEPLOYMENT_RELEASE_GUIDE.md](file:///data/user/0/com.termux/files/home/Disha-/docs/DEPLOYMENT_RELEASE_GUIDE.md) | Vercel Dashboard -> Deployments -> Instant Rollback |
| **Full Database Backup** | [BACKUP_RESTORE_GUIDE.md](file:///data/user/0/com.termux/files/home/Disha-/docs/BACKUP_RESTORE_GUIDE.md) | `POST /api/admin/backup/export` |
| **Database Disaster Recovery** | [BACKUP_RESTORE_GUIDE.md](file:///data/user/0/com.termux/files/home/Disha-/docs/BACKUP_RESTORE_GUIDE.md) | `POST /api/admin/backup/restore` |
| **Publishing Snapshot CDN** | [SYSTEM_ARCHITECTURE.md](file:///data/user/0/com.termux/files/home/Disha-/docs/SYSTEM_ARCHITECTURE.md) | `POST /api/admin/snapshots/publish` |
| **Purging Static Cache** | [BACKEND_API_REFERENCE.md](file:///data/user/0/com.termux/files/home/Disha-/docs/BACKEND_API_REFERENCE.md) | `POST /api/quiz-assets/invalidate` |
| **Adding AI API Keys** | [ADMIN_PANEL_GUIDE.md](file:///data/user/0/com.termux/files/home/Disha-/docs/ADMIN_PANEL_GUIDE.md) | Admin Console -> AI API Settings |
| **Running Stress Tests** | [TESTING_GUIDE.md](file:///data/user/0/com.termux/files/home/Disha-/docs/TESTING_GUIDE.md) | `npx tsx tests/concurrency_1000_users_stress_test.ts` |
| **Production Health Check** | [TESTING_GUIDE.md](file:///data/user/0/com.termux/files/home/Disha-/docs/TESTING_GUIDE.md) | `npx tsx scripts/run_production_health_check.ts` |

---

## 5. Formal Handover Sign-Off

```
Handover Project: DISHA 20-20 (दिशा 20-20) Exam Preparation Platform
Location: /data/user/0/com.termux/files/home/Disha-
Audit Phase: Phase 16 Complete Developer Knowledge Transfer
Date of Completion: November 15, 2026

Delivered By:
Automated Production Assurance Lead (Delegated by Jarvis)
AntiGem Sub-Agent System

Accepted By:
Lead Engineer / Platform Administrator: ___________________________
Signature: ___________________________ Date: ___________________
```
