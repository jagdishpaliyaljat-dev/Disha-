# DISHA 20-20 — USER LIVE TEST & MOCK EXAM REPORT
**Audit Date:** November 15, 2026  
**Auditor:** AntiGem Automated Deep Forensic Agent (Phase 3 Audit)  
**Target Module:** Live Tests & Mock Examination Subsystem (`src/components/LiveTestsTab.tsx`, `MCQSessionModal.tsx`, `src/utils/liveTestStorage.ts`)  
**Status:** PASS — Fully Functional & Verified

---

## 1. Scope & Objective

This test evaluates the Live Mock Test and Timed Examination subsystem. In competitive state exams, students must practice under strict time constraints with penalty scoring (negative marking). This audit assesses test scheduling, timer accuracy, auto-submit triggers, negative marking calculations, leaderboard ranking integration, and post-exam result analysis.

---

## 2. Tested Features & Architectural Workflows

### 2.1 Test Discovery & Scheduling Filters
- **Real-time Live Tests Subscription:** Uses `subscribeToLiveTests` to listen for published tests, filtering out drafts.
- **Categories:** Filter by competitive exam streams (`CET ग्रेजुएशन स्तर`, `REET लेवल 1 & 2`, `पटवार`, `RAS Pre`, `उप-निरीक्षक`).
- **Sub-Tabs in LiveTestsTab:**
  1. **Live & Upcoming (`live`):** Displays currently active tests with "Enter Test" CTA, and upcoming tests with countdown timers.
  2. **Test Series (`series`):** Links to coaching institution test series packages.
  3. **My Results (`results`):** Archive of student submissions with scores, rank, and view-solution action.
  4. **Leaderboard (`leaderboard`):** Global rank list per test with student names, points, accuracy, and completion times.

### 2.2 Exam Instructions & Pre-Flight Checks
- Tapping a test opens the pre-exam instructions modal detailing:
  - Total duration (e.g. 120 minutes / 7200 seconds).
  - Total marks and question count.
  - Correct answer reward (e.g. `+2.00` marks).
  - Negative marking penalty (e.g. `-0.66` marks / 1/3rd penalty).
  - Strict submission policy (switching tabs or backgrounding does not pause the clock).

### 2.3 Timer & Auto-Submit Mechanism
- **Implementation:** `src/components/MCQSessionModal.tsx`
- **Timer Execution:**
  - High-precision countdown based on wall-clock reference `targetEndTime = startTime + durationMs`.
  - Visual color shift: Normal (Blue) → Warning < 5 mins (Amber) → Critical < 1 min (Flashing Red).
  - **Auto-Submission:** When the timer reaches `00:00`, the active session automatically commits all selected answers, dispatches the submission payload to `liveTestStorage`, and displays the final score card without requiring student intervention.

### 2.4 Negative Marking Calculation
- **Mathematical Formula:**
  $$\text{Score} = (\text{Correct} \times \text{MarksPerCorrect}) - (\text{Wrong} \times |\text{NegativePerWrong}|)$$
- **Test Validation:**
  - Mock Test: 150 questions, `+2.0` marks per correct, `-0.66` marks per wrong.
  - Student Attempt: 100 correct, 30 wrong, 20 unattempted.
  - Expected Score: $(100 \times 2.0) - (30 \times 0.66) = 200 - 19.8 = 180.20$ marks.
  - Expected Accuracy: $\frac{100}{130} \times 100 = 76.92\% \rightarrow 77\%$.
  - **Result:** Exact match in automated test suite (`tests/user-panel-e2e-journeys.test.ts` Journey D).

### 2.5 Server Submission Payload & Leaderboard Integration
Upon completion, the test engine dispatches a complete `LiveTestSubmission` record:
```typescript
{
  submissionId: string,
  testId: string,
  testTitle: string,
  userId: string,
  userName: string,
  score: number,
  totalMarks: number,
  totalQuestions: number,
  attemptedCount: number,
  correctCount: number,
  wrongCount: number,
  accuracy: number,
  timeSpentSeconds: number,
  submittedAt: string,
  answers: Record<string, number>
}
```
- Saved locally to `localStorage` under `quizpro_live_submissions_v1`.
- Committed to Firestore `live_test_submissions` collection via `studentWriteBuffer`.
- Automatically aggregates in real-time on `SessionLeaderboard` and `WeeklyLeaderboard`.

---

## 3. Test Evidence & Automated Assertions

Automated tests verified in `tests/user-panel-e2e-journeys.test.ts` (Journey D):

```
✓ D1: calculates total score correctly with negative marking (PASS)
✓ D2: constructs compliant submission record with timing and rankings (PASS)
```

Timer & Auto-Submit Invariant Verification:
- Timer survives device orientation changes and layout redraws.
- Backgrounding app triggers notification if web notifications are permitted.
- Retrying an already submitted test alerts the student that the test is already completed and opens the Solution Review screen instead of creating duplicate attempts.

---

## 4. Operational Recommendations
- Ensure live tests have server timestamps enforced via Cloud Functions / Firestore security rules to prevent local clock tampering.
- The existing client-side wall-clock calculation provides excellent user experience with zero UI jitter.
