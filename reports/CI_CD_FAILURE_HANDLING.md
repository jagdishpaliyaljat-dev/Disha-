# DISHA 20-20 — Phase 12: CI/CD Failure Handling Runbook

**Project:** DISHA 20-20 (दिशा 20-20) Exam Prep Platform  
**Scope:** Automated Pipeline Incidents, Build Breakages, and Production Rollbacks  
**Date:** November 15, 2026  
**Auditor:** AntiGem DevSecOps Specialist (Jarvis Delegated Agent)  
**Status:** **OPERATIONAL & ENFORCED**

---

## 1. Executive Summary

This standard operating procedure (SOP) outlines deterministic protocols for diagnosing, triaging, and resolving failures in the DISHA 20-20 automated CI/CD pipeline and production hosting environment.

---

## 2. Failure Triage & Response Matrix

```
                      [ Failure Detected ]
                                │
        ┌───────────────────────┼───────────────────────┐
        ▼                       ▼                       ▼
 [ PR / CI Failure ]   [ Build Compilation ]   [ Production Outage ]
        │                       │                       │
 1. Check CI log         1. Identify stage:      1. Execute Rollback:
 2. Reproduce locally:      - Vite Client           `vercel rollback`
    `pnpm run lint`         - esbuild Serverless 2. Verify Health:
    `pnpm test`          2. Clear cache:            `/api/health`
 3. Fix & push commit       `pnpm run clean`     3. Post-Mortem Root Cause
```

---

## 3. Standard Incident Scenarios & Remediation Protocols

### Scenario 1: TypeScript Compile Failure (`pnpm run lint` / `tsc --noEmit`)
* **Symptom:** CI job `Typecheck` fails with exit code 1 and lists compiler diagnostic errors.
* **Triage Steps:**
  1. Inspect the CI log to pinpoint the offending file, line number, and error code (e.g. `TS2322`, `TS2345`).
  2. Reproduce locally in Termux or dev workstation:
     ```bash
     pnpm run lint
     ```
  3. Resolve type mismatch without using `any` casts. Update interfaces in `src/types.ts` if model schema evolved.
  4. Verify resolution locally before pushing commit:
     ```bash
     NODE_OPTIONS='--max-old-space-size=4096' tsc --noEmit
     ```

### Scenario 2: Firestore Security Rules Lint Failure (`eslint firestore.rules`)
* **Symptom:** ESLint detects invalid security rules syntax or parse error.
* **Triage Steps:**
  1. Run rules linting locally:
     ```bash
     pnpm exec eslint firestore.rules
     ```
  2. Check for missing semicolons, unbalanced braces, or deprecated helper functions.
  3. Ensure that write operations remain strictly locked to allowlisted, verified admins (`request.auth.token.email_verified == true`).

### Scenario 3: Vitest Automated Test Failure (`pnpm test`)
* **Symptom:** CI or pre-merge check fails during Vitest execution.
* **Triage Steps:**
  1. Identify failing suite from the Vitest summary report:
     ```bash
     pnpm exec vitest run tests/<failing-suite>.test.ts
     ```
  2. Differentiate between:
     - **Real Regression:** Bug introduced into business logic (e.g. Leitner revision intervals or score calculation changed unexpectedly). *Fix the code.*
     - **Mock Drift:** External API signature changed. *Update test mocks.*
  3. **Strict Rule:** Never comment out, delete, or add `.skip` to failing tests to bypass quality gates without documented architecture approval.

### Scenario 4: Production Build Compilation Failure (`pnpm run build`)
* **Symptom:** Vite bundler or esbuild fails to generate `dist/` or `api/index.js`.
* **Triage Steps:**
  1. Check which stage failed:
     - **Vite Stage:** Module resolution, missing CSS import, or invalid JSX syntax.
     - **esbuild Serverless Stage:** Broken import in `src/server/vercelHandler.ts` or invalid Node banner.
     - **esbuild Server Stage:** Syntax error in `server.ts`.
  2. Clean build cache and re-attempt:
     ```bash
     pnpm run clean
     pnpm run build
     ```

### Scenario 5: Production Edge Deployment Outage on Vercel
* **Symptom:** `https://disha-2020.vercel.app` returns HTTP 500, 502, or crash logs appear in Vercel Runtime Logs.
* **Emergency Rollback Protocol (Under 60 Seconds):**
  1. Identify the previous verified healthy deployment ID:
     ```bash
     # Known healthy rollback candidate:
     dpl_D2YWWKs5hELaAzhH9xcZMFUKd5zv
     ```
  2. Dispatch rollback via Vercel CLI:
     ```bash
     pnpm exec vercel rollback dpl_D2YWWKs5hELaAzhH9xcZMFUKd5zv --yes
     ```
  3. Confirm recovery:
     ```bash
     curl -I https://disha-2020.vercel.app/api/health
     ```
  4. Ensure response is `HTTP/2 200` with `status: "ok"`.

### Scenario 6: Accidental Secret or Credential Exposure
* **Symptom:** API key or Firebase Service Account credential committed to git history.
* **Emergency Protocol:**
  1. Immediately revoke the exposed credential in Google Cloud Console / Firebase Console / Cashfree Dashboard.
  2. Issue a rotated credential and update Vercel Project Environment Variables:
     ```bash
     pnpm exec vercel env add <VARIABLE_NAME> production
     ```
  3. Rewrite repository history using `git filter-repo` or BFG Repo-Cleaner before force-pushing the sanitized trunk branch.

---

## 4. On-Call Escalation Roster

| Role | Contact | Responsibility |
|---|---|---|
| **Lead Administrator** | `jagdishpaliyaljat@gmail.com` | Final merge approvals, DNS & domain authorization |
| **Autonomous Auditor** | AntiGem / Jarvis System Sub-Agent | Automated QA verification, regression audits, CI monitoring |
| **Platform Host** | Vercel Platform Support | Infrastructure availability, edge routing, DDoS mitigation |
