# DISHA 20-20 — Phase 15: Maintainability Scorecard & Quality Index

**Audit Date:** November 15, 2026  
**Auditor:** Antigravity Autonomous Sub-Agent (Jarvis Delegation)  
**Scope:** Quantitative Architectural Evaluation Across 10 Quality Dimensions  
**Status:** 100% Read-Only Forensic Inspection Complete  

---

## Executive Summary

To provide an objective, data-driven assessment of DISHA 20-20 (`/data/user/0/com.termux/files/home/Disha-`), this scorecard evaluates the codebase across **10 standard software engineering quality dimensions**. Each dimension is scored from **1.0 to 10.0** and weighted according to its impact on system stability, developer velocity, and student user experience.

The composite **Maintainability Quality Index (MQI)** establishes the baseline against which future simplification and refactoring phases (Phase 16 onwards) will be measured.

---

## 1. Quantitative Maintainability Scorecard

| # | Quality Dimension | Weight | Current Score (1–10) | Weighted Score | Grade | Key Empirical Findings & Root Causes |
|---|-------------------|--------|----------------------|----------------|-------|--------------------------------------|
| 1 | **Modularity & Cohesion** | 15% | **4.5** / 10 | 0.675 / 1.50 | **D** | 5 massive monolithic God-components (>1,500 LOC, `MCQSessionModal` at 4,292 LOC). Multiple mixed responsibilities. |
| 2 | **Code Reusability & DRY** | 12% | **4.0** / 10 | 0.480 / 1.20 | **F** | 5 separate question importers (10,219 LOC), 5 duplicate parsers (165 KB), 9 duplicate health widgets, 2 `ApiSettingsModal` files. |
| 3 | **Architectural Consistency** | 12% | **5.5** / 10 | 0.660 / 1.20 | **C-** | 4 circular dependency loops; 73 utilities sprawling across `src/utils/` without domain boundaries; dual sync engines. |
| 4 | **State Management Hygiene** | 10% | **5.0** / 10 | 0.500 / 1.00 | **C** | State split across Context, 20 root `useState` hooks, `studentWriteBuffer`, and IndexedDB; heavy prop drilling (23 props to `AdminTab`). |
| 5 | **Database & Schema Health** | 10% | **6.0** / 10 | 0.600 / 1.00 | **B-** | Strong IndexedDB V5 caching and write buffering; but schema drift (`tableData` vs `table`) and 6 ghost payment collection rules. |
| 6 | **Dependency Hygiene** | 8% | **6.5** / 10 | 0.520 / 0.80 | **B** | Cutting-edge core dependencies (React 19, Vite 8); but `@types/*` in prod dependencies, unused `dotenv`, single-use `d3` (260 KB) and `localforage`. |
| 7 | **Test Coverage & Verification** | 10% | **8.0** / 10 | 0.800 / 1.00 | **A-** | Robust automated test suites (`vitest`), comprehensive parser test samples, regression runners, and E2E journeys. |
| 8 | **Documentation & Code Clarity** | 8% | **7.5** / 10 | 0.600 / 0.80 | **B+** | Clear inline JSDoc comments on complex algorithms; extensive forensic audit reports from Phases 1–14. |
| 9 | **Runtime Performance & Quota** | 8% | **9.0** / 10 | 0.720 / 0.80 | **A** | Outstanding quota protection (write buffer cuts writes >90%); sub-second local retrieval via IndexedDB V5; PWA offline support. |
| 10 | **Security, Privacy & Resilience** | 7% | **8.5** / 10 | 0.595 / 0.70 | **A-** | Zero exposed secrets; sanitized HTML via `DOMPurify`; granular Firestore security rules for active student/admin collections. |
| **TOTALS** | **Composite Overall Evaluation** | **100%** | — | **6.150 / 10.0** | **C+** | **Current Maintainability Index: 61.5 / 100** |

---

## 2. Qualitative Grade Interpretation

```
+--------------------------------------------------------------------------------+
| COMPOSITE MAINTAINABILITY INDEX: 61.5 / 100                                    |
| LETTER GRADE: C+ (MODERATE TECHNICAL DEBT)                                     |
+--------------------------------------------------------------------------------+
| Assessment:                                                                    |
| DISHA 20-20 is a production-hardened, performant, and resilient application    |
| from the perspective of an end-user. It does not crash, protects cloud quotas, |
| and operates offline smoothly.                                                 |
|                                                                                |
| However, from an engineering and maintainability perspective, the codebase     |
| is burdened by substantial horizontal redundancy, 4 circular dependency loops, |
| monolithic file bloat, and utility sprawl. Developer velocity is hindered by   |
| the fear of modifying 4,000-line components.                                   |
+--------------------------------------------------------------------------------+
```

---

## 3. Dimension-by-Dimension Strengths and Deficits

### Dimensions with Outstanding Marks (Grade A– to A):
1. **Runtime Performance & Quota (9.0/10):** The `studentWriteBuffer.ts` architecture is an exemplary piece of engineering that prevents Firestore quota exhaustion. Offline IndexedDB V5 delivers near-instant question browsing.
2. **Security & Privacy (8.5/10):** Secrets are handled exclusively server-side via `cryptoVault.ts`. DOM injection is guarded by `dompurify`. Firestore rules prevent unauthorized privilege escalation.
3. **Test Automation & Verification (8.0/10):** More than 15 automated test harnesses verify math parsing, curriculum integrity, disaster recovery, and concurrent loads.

### Dimensions Requiring Urgent Intervention (Grade D to F):
1. **Code Reusability & DRY (4.0/10):** 10,219 lines of code exist across 5 separate question importers doing essentially the same task. 4 duplicate parsers and 9 duplicate health panels represent severe copy-paste evolution.
2. **Modularity & Cohesion (4.5/10):** Massive files like `MCQSessionModal.tsx` (4,292 LOC) and `AddQuestionsModal.tsx` (4,089 LOC) bundle UI, data fetching, business rules, timers, and storage into single monolithic files.
3. **Architectural Consistency (5.5/10):** 4 circular dependency loops between storage and validation modules violate clean layering principles.

---

## 4. Target Post-Refactoring Scorecard (Phase 16 Projection)

Upon executing the recommendations outlined in the Technical Debt Register and Simplification reports, the Maintainability Quality Index is projected to improve dramatically:

| Quality Dimension | Current Score | Target Score (Post-Phase 16) | Target Weighted Score | Key Refactoring Enabler |
|-------------------|---------------|------------------------------|-----------------------|-------------------------|
| Modularity & Cohesion | 4.5 / 10 | **9.0** / 10 | 1.350 / 1.50 | Deconstruct `MCQSessionModal` and `AddQuestionsModal` into sub-components. |
| Code Reusability & DRY | 4.0 / 10 | **9.0** / 10 | 1.080 / 1.20 | Consolidate 5 importers into 1; unify dual parsers into `UniversalMcqParser`. |
| Architectural Consistency | 5.5 / 10 | **9.5** / 10 | 1.140 / 1.20 | Break all 4 circular imports; organize `src/utils/` into domain services. |
| State Management | 5.0 / 10 | **8.5** / 10 | 0.850 / 1.00 | Eliminate prop drilling via Context; replace 20 `useState` hooks with modal store. |
| Database & Schema | 6.0 / 10 | **9.0** / 10 | 0.900 / 1.00 | Prune 6 ghost payment rules; canonicalize `tableData` and `matchData`. |
| Dependency Hygiene | 6.5 / 10 | **9.0** / 10 | 0.720 / 0.80 | Move `@types` to devDeps; prune `dotenv` and `localforage`. |
| Test Coverage | 8.0 / 10 | **9.0** / 10 | 0.900 / 1.00 | Maintain comprehensive regression coverage on unified modules. |
| Documentation & Clarity | 7.5 / 10 | **9.0** / 10 | 0.720 / 0.80 | Clean documentation and unified naming conventions. |
| Runtime Performance | 9.0 / 10 | **9.5** / 10 | 0.760 / 0.80 | Reduced bundle size from removing duplicate importers and parsers. |
| Security & Resilience | 8.5 / 10 | **9.0** / 10 | 0.630 / 0.70 | Streamlined rules file without obsolete payment logic. |
| **PROJECTED TOTALS** | **61.5 / 100 (C+)**| — | **9.050 / 10.0** | **Projected Score: 90.5 / 100 (Grade: A)** |
