# DISHA 20-20 — USER REVISION SYSTEM REPORT
**Audit Date:** November 15, 2026  
**Auditor:** AntiGem Automated Deep Forensic Agent (Phase 3 Audit)  
**Target Module:** Spaced Repetition & Revision System (`src/utils/revision.ts`, `WrongTab.tsx`, `AnalyticsTab.tsx`)  
**Status:** PASS — Fully Functional & Verified

---

## 1. Scope & Objective

This test evaluates the Spaced Repetition System (SRS) of DISHA 20-20, designed to combat the Ebbinghaus forgetting curve for competitive exam aspirants. The audit examines interval transitions, stage graduation, reset penalties on error, due date determination, priority queue sorting, and user-facing integration.

---

## 2. Mathematical Model & Interval Specification

The DISHA 20-20 revision engine is parameterized by the constant array:
$$\text{INTERVALS} = [3, 7, 21, 45, 75] \text{ days}$$

Corresponding to 5 distinct memory consolidation stages ($S_0$ through $S_4$):

| Stage | Memory Horizon | Interval to Next Review | Cognitive State |
|---|---|---|---|
| **Stage 0** ($S_0$) | 3 Days | $T + 3$ days | Freshly learned / Unconsolidated |
| **Stage 1** ($S_1$) | 7 Days | $T + 7$ days | Early retention |
| **Stage 2** ($S_2$) | 21 Days | $T + 21$ days | Intermediate retention |
| **Stage 3** ($S_3$) | 45 Days | $T + 45$ days | Long-term memory consolidation |
| **Stage 4** ($S_4$) | 75 Days | $T + 75$ days | Mastered / Exam-ready |

---

## 3. Transition Rules & Verification

### 3.1 Initial Attempt (First Time Seen)
- **If Correct:**
  - `status: "correct"`, `stage: 0`, `nextReviewAt: today + 3 days`, `wrongCount: 0`.
- **If Incorrect:**
  - `status: "wrong"`, `stage: 0`, `nextReviewAt: today + 3 days`, `wrongCount: 1`.

### 3.2 Subsequent Attempts (Revision Session)
- **If Correct:**
  - Advances stage: $\text{stage} = \min(4, \text{stage} + 1)$.
  - Sets next review date: $\text{nextReviewAt} = \text{today} + \text{INTERVALS}[\text{stage}]$.
  - Preserves historical `wrongCount`.
  - Status sets to `"correct"`, effectively graduating out of the active Mistakes filter.
- **If Incorrect (Error Penalty):**
  - **Immediate Reset:** $\text{stage} = 0$.
  - Next review reset to: $\text{nextReviewAt} = \text{today} + 3\text{ days}$.
  - Increments failure counter: $\text{wrongCount} = \text{wrongCount} + 1$.
  - Status reverts to `"wrong"`, re-entering the Mistakes list.

### 3.3 Due Date Definition
A question is classified as **"Due Today"** if:
$$P.\text{status} \neq \text{"unattempted"} \quad \land \quad P.\text{nextReviewAt} \le \text{todayDate}$$
This accurately accounts for overdue questions that were missed on previous days.

---

## 4. Priority Queue Sorting Algorithm

When a student initiates a revision session, `sortQuestionsForRevision` sorts the question pool using a 4-tier lexicographical comparator:

```typescript
// Tier 1: Questions with highest wrongCount first (descending)
if (wrongCountA !== wrongCountB) return wrongCountB - wrongCountA;

// Tier 2: Currently wrong questions before correct ones
if (isWrongA !== isWrongB) return isWrongB - isWrongA;

// Tier 3: Due questions before non-due questions
if (isDueA !== isDueB) return isDueB - isDueA;

// Tier 4: Bookmarked questions
if (isBookmarkedA !== isBookmarkedB) return isBookmarkedB - isBookmarkedA;

return 0;
```

**Cognitive Benefit:** This ensures that the student always confronts their highest-risk questions first, maximizing revision efficiency during limited study windows.

---

## 5. Test Evidence & Automated Assertions

Automated tests verified in `tests/user-panel-e2e-journeys.test.ts` (Journey C):

```
✓ C1: first answer correct sets status="correct", stage=0, nextReviewAt=today+3 days (PASS)
✓ C2: first answer wrong sets status="wrong", stage=0, nextReviewAt=today+3 days, wrongCount=1 (PASS)
✓ C3: consecutive correct answers progress through intervals [3, 7, 21, 45, 75] (PASS)
✓ C4: answering wrong at any advanced stage resets stage to 0 and adds to wrongCount (PASS)
✓ C5: sorts questions for revision by priority: most wrong times -> currently wrong -> due -> bookmarked (PASS)
```

UI Integration Verification:
- `AnalyticsTab.tsx` accurately displays the breakdown of questions across Stages 0, 1, 2, 3, and 4.
- Questions in Stages 3 & 4 are correctly categorized as "Mastered" in the syllabus coverage scorecard.

---

## 6. Operational Recommendations
- The implementation strictly adheres to the requested Leitner/SuperMemo-derived intervals.
- The reset penalty ensures that illusory mastery is avoided: any mistake at Stage 4 restarts the consolidation cycle.
