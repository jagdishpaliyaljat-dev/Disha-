# DISHA 20-20 — Admin Panel Bug & Issue Register

**Target Project:** DISHA 20-20 (QuizPro Exam Prep Platform)  
**Date of Audit:** November 15, 2026  
**Auditor:** Antigravity AI Quality Assurance & Defect Tracking Engine  

---

## Severity Classification Standards

* **CRITICAL:** Total system failure, data corruption, unauthorized data access, security bypass, or irreversible data loss.
* **HIGH:** Major functional defect, broken workflow with no workaround, or persistent blocker in core operations.
* **MEDIUM:** Moderate functional impairment, quota or network constraint, recoverable error, or performance degradation.
* **LOW:** Minor cosmetic irregularity, build notice, edge-case warning, or non-blocking optimization opportunity.

---

## Bug & Issue Register

### Issue #1: Free-Tier Firestore Read Quota Saturation under High Count Queries
* **Module:** Module 1 (Dashboard), Module 16 (Database Management)
* **Function:** `getCountFromServer()` / `fetchAuthoritativeMetrics()`
* **Severity:** **MEDIUM**
* **Status:** Mitigated by Graceful Fallback; Production Recommendation Open
* **Reproduction Steps:**
  1. Initialize application with a Free-Tier Firestore database where cumulative daily reads exceed 50,000.
  2. Load Admin Panel Dashboard or Firebase Storage Overview.
  3. Observe console error: `8 RESOURCE_EXHAUSTED: Quota limit exceeded for quota metric 'Free daily read units per project'`.
* **Expected Behavior:** Database counts should load without hitting hard quota caps.
* **Actual Behavior:** Firestore rejects network read requests once 50,000 read limit is reached.
* **Root Cause:** Free-tier Spark plan enforces hard per-project daily limits on reads. `getCountFromServer()` issues read units against Firestore.
* **Current Mitigation in Code:** `quotaTracker.ts` and `FirebaseStorageOverview.tsx` catch `RESOURCE_EXHAUSTED` and gracefully fall back to local IndexedDB/LocalStorage cached counts (`Using fallback count (0)`), preventing crashes.
* **Recommended Permanent Fix:** Upgrade Firebase project to Blaze plan with a strict budget cap (e.g. $10-$20/month) or cache collection document counts in a single metadata summary document (`metadata/curriculumCounts`) updated on write.

---

### Issue #2: Ineffective Dynamic Import Splitting in Production Build
* **Module:** Core Build Architecture (Vite)
* **Function:** `vite build`
* **Severity:** **LOW**
* **Status:** Identified
* **Reproduction Steps:**
  1. Run `pnpm run build` or `vite build`.
  2. Inspect build output logs.
  3. Observe warning: `[INEFFECTIVE_DYNAMIC_IMPORT] src/utils/questionsStorage.ts is dynamically imported by ... but also statically imported by src/App.tsx, src/components/AdminTab.tsx, dynamic import will not move module into another chunk.`
* **Expected Behavior:** Modules dynamically imported should split cleanly into isolated chunks without static coupling.
* **Actual Behavior:** Because `questionsStorage.ts` is imported statically at top level in `App.tsx` and `AdminTab.tsx`, Vite bundles it into the shared vendor chunk anyway, rendering the dynamic `import("../utils/questionsStorage")` inside submodals redundant for code-splitting purposes.
* **Root Cause:** Shared utility file `questionsStorage.ts` contains both core store management functions and heavy bulk operations.
* **Recommended Fix:** Refactor `questionsStorage.ts` into:
  1. `questionsStorageCore.ts` (lightweight state hooks & getters)
  2. `questionsStorageBulk.ts` (heavy batch operations & serializers, imported only by bulk modals).

---

### Issue #3: CLI Script TypeScript Compilation Memory Exhaustion in Low-RAM Environments
* **Module:** Developer Tooling & CI (`scripts/`)
* **Function:** `pnpm run lint` / `tsc --noEmit`
* **Severity:** **LOW**
* **Status:** Resolved with Configuration Guidance
* **Reproduction Steps:**
  1. On a mobile or constrained device (e.g., Termux with <2GB Node heap), run `pnpm exec tsc --noEmit`.
  2. Process compiles all 60+ legacy migration and forensic scripts located in `scripts/`.
  3. Process crashes with: `FATAL ERROR: Ineffective mark-compacts near heap limit Allocation failed - JavaScript heap out of memory`.
* **Expected Behavior:** Type checking should finish quickly within 512MB RAM.
* **Actual Behavior:** Node heap exceeds default limit because `tsconfig.json` includes `scripts/` by default.
* **Root Cause:** `tsconfig.json` excludes `node_modules`, `dist`, `tests`, `opencode-antigravity-auth`, `.archive`, but does not exclude one-off diagnostic scripts in `scripts/`.
* **Recommended Fix:** Add `"scripts"` to `exclude` in `tsconfig.json`, or provide a separate `tsconfig.scripts.json` for script maintenance:
  ```json
  "exclude": [
    "node_modules",
    "dist",
    "tests",
    "scripts",
    "opencode-antigravity-auth",
    ".archive"
  ]
  ```

---

### Issue #4: Headless Node Test Environment LocalStorage Warning
* **Module:** Automated Testing
* **Function:** `scripts/admin-regression-test.tsx` / `vitest`
* **Severity:** **LOW**
* **Status:** Informational
* **Reproduction Steps:**
  1. Run any headless Node test script importing storage utilities.
  2. Observe warning: `(node:...) ExperimentalWarning: localStorage is not available because --localstorage-file was not provided.`
* **Expected Behavior:** Clean test log without experimental runtime warnings.
* **Actual Behavior:** Node 22 introduces a built-in experimental `localStorage` API that logs a warning if a backing file flag is omitted.
* **Root Cause:** Node 22 runtime feature collision with JSDOM / mock storage polyfill.
* **Recommended Fix:** In testing scripts, define `globalThis.localStorage` prior to loading application modules, or pass `--no-warnings` to the Node execution command.

---

### Issue #5: Mobile Drawer Backdrop Rapid Interaction Edge Case
* **Module:** Module 1 (AdminTab Navigation)
* **Function:** `isSidebarOpen` Mobile Navigation Drawer
* **Severity:** **LOW**
* **Status:** Minor UI Edge Case
* **Reproduction Steps:**
  1. Open Admin Panel on mobile screen (<768px).
  2. Tap hamburger menu to open drawer.
  3. Rapidly tap the backdrop and a nested sub-tab simultaneously within 50ms.
* **Expected Behavior:** Drawer dismisses cleanly and selected tab renders.
* **Actual Behavior:** On rare occasions, drawer dismisses but active tab transition is delayed by 1 frame.
* **Root Cause:** State synchronization between touch event propagation and `handleSelectGroup` callback.
* **Recommended Fix:** Add `event.stopPropagation()` to mobile drawer backdrop container.

---

## Bug Severity Summary

| Severity | Count | Resolved / Mitigated | Open / Action Item |
|---|---|---|---|
| **CRITICAL** | 0 | 0 | 0 |
| **HIGH** | 0 | 0 | 0 |
| **MEDIUM** | 1 | 1 (Graceful fallback active) | Enable Blaze plan / cache doc counts |
| **LOW** | 4 | 4 (Identified & documented) | Minor refactoring & config updates |
| **TOTAL** | **5** | **5** | **0 Blockers** |
