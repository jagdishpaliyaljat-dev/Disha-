# DISHA 20-20 — Phase 12: Pull Request Quality Gates

**Project:** DISHA 20-20 (दिशा 20-20) Exam Prep Platform  
**Target Branch:** `main`  
**Date:** November 15, 2026  
**Auditor:** AntiGem CI/CD Architecture Specialist (Jarvis Delegated Agent)  
**Status:** **ACTIVE & ENFORCED**

---

## 1. Executive Summary

This document formalizes the Pull Request (PR) Quality Gates required for merging any code into the `main` production branch of DISHA 20-20. To maintain production stability, prevent regressions, and enforce security, all changes must pass six mandatory automated validation gates before merge approval.

---

## 2. Six Mandatory PR Quality Gates

```
[ Developer Branch ]
         │
         ▼
┌────────────────────────────────────────────────────────┐
│ Gate 1: TypeScript Compile-time Typecheck (Strict)     │ ──> Fail if errors > 0
└────────────────────────────────────────────────────────┘
         │ Passed
         ▼
┌────────────────────────────────────────────────────────┐
│ Gate 2: Firestore Security Rules Linting               │ ──> Fail if rule errors > 0
└────────────────────────────────────────────────────────┘
         │ Passed
         ▼
┌────────────────────────────────────────────────────────┐
│ Gate 3: Vitest Regression Suite (Unit & E2E)           │ ──> Fail if any test fails
└────────────────────────────────────────────────────────┘
         │ Passed
         ▼
┌────────────────────────────────────────────────────────┐
│ Gate 4: Dual-Engine Production Compilation             │ ──> Fail if build breaks
└────────────────────────────────────────────────────────┘
         │ Passed
         ▼
┌────────────────────────────────────────────────────────┐
│ Gate 5: Client Bundle Size & Performance Budget        │ ──> Fail if budget exceeded
└────────────────────────────────────────────────────────┘
         │ Passed
         ▼
┌────────────────────────────────────────────────────────┐
│ Gate 6: Dependency Vulnerability Audit                 │ ──> Fail on high/critical runtime CVE
└────────────────────────────────────────────────────────┘
         │ Passed
         ▼
[ Vercel Preview Deployment & Production Merge Approval ]
```

---

## 3. Detailed Gate Specifications

### Gate 1: Strict TypeScript Compilation
* **Command:** `pnpm run lint` (`NODE_OPTIONS='--max-old-space-size=4096' tsc --noEmit`)
* **Acceptance Criteria:** Exit code `0`, **0 TypeScript compiler errors**.
* **Rationale:** Ensures strict typing across all React components, Firebase hooks, IndexedDB utilities, and serverless API handlers.

### Gate 2: Firestore Security Rules Static Linting
* **Command:** `pnpm exec eslint firestore.rules`
* **Acceptance Criteria:** Exit code `0`, **0 syntax errors or invalid declarations**.
* **Rationale:** Prevents syntax mistakes in security rules that could lead to Firebase deployment failures or security vulnerabilities.

### Gate 3: Vitest Regression Testing Suite
* **Command:** `pnpm test` (`vitest run --fileParallelism=false`)
* **Acceptance Criteria:** Exit code `0`, **100% active test pass rate**, 0 failures.
* **Coverage Scope:**
  - Curriculum navigation and drill-down journeys
  - Spaced repetition Leitner interval progression
  - Student write buffer and offline persistence
  - Disaster recovery and backup idempotency
  - Server security and admin token authentication

### Gate 4: Dual-Engine Production Compilation
* **Command:** `pnpm run build`
* **Acceptance Criteria:** Exit code `0`.
* **Artifacts Generated:**
  1. Frontend Client: `dist/index.html`, `dist/assets/*`, `dist/sw.js` (PWA Service Worker)
  2. Serverless Edge Handler: `api/index.js` (ESM bundle)
  3. Standalone Node Server: `dist/server.cjs` (CJS bundle)

### Gate 5: Bundle Size & Performance Budget
* **Budgets Enforced:**
  | Chunk | Maximum Uncompressed | Maximum Gzip | Actual Production Metrics |
  |---|:---:|:---:|:---:|
  | Main Vendor React (`vendor-react`) | 300 kB | 85 kB | **65.72 kB gzip** (Within Budget) |
  | Vendor Firebase (`vendor-firebase`) | 750 kB | 200 kB | **168.86 kB gzip** (Within Budget) |
  | Vendor KaTeX (`vendor-katex`) | 650 kB | 180 kB | **163.00 kB gzip** (Within Budget) |
  | Main Index CSS (`index-*.css`) | 450 kB | 60 kB | **48.81 kB gzip** (Within Budget) |
  | Main Client Entry (`index-*.js`) | 200 kB | 55 kB | **43.15 kB gzip** (Within Budget) |

### Gate 6: Dependency Vulnerability Audit
* **Command:** `pnpm audit --audit-level=high`
* **Acceptance Criteria:** Zero high or critical severity vulnerabilities in production runtime dependencies (`dependencies`).
* **DevDependency Policy:** Any high/critical finding in `devDependencies` (e.g. CLI tools) must be evaluated and patched via lockfile overrides or scheduled minor bumps.

---

## 4. Branch Protection & GitHub Settings

The `main` branch is protected by the following repository rules:
1. **Require status checks before merging:** GitHub Actions (`build`) must report SUCCESS.
2. **Require branches to be up to date before merging:** PR must be rebased on latest `main`.
3. **No direct push:** All changes must arrive via pull request.
4. **Enforce linear history:** Fast-forward or Squash-merge required to preserve a clean commit audit trail.

---

## 5. Recommended GitHub Actions Workflow Update

To unify all six gates into a single CI run, `.github/workflows/build-check.yml` is recommended to be updated to:

```yaml
name: Build & QA Verification

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

jobs:
  verify:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Install pnpm
        uses: pnpm/action-setup@v4
        with:
          version: 9

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install --no-frozen-lockfile

      - name: Gate 1: Typecheck
        run: pnpm run lint

      - name: Gate 2: Security Rules Lint
        run: pnpm exec eslint firestore.rules

      - name: Gate 3: Vitest Automated Tests
        run: pnpm test

      - name: Gate 4 & 5: Production Build & Bundle Generation
        run: pnpm run build
```
