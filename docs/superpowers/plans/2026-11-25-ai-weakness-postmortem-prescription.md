# Disha AI Weakness Postmortem & Study Prescription Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the "छात्र की गलतियों का AI पोस्टमॉर्टम (Weakness Diagnosis & Study Prescription)" system in Disha 20-20 Exam Prep, providing clinical diagnosis of student errors, negative marking bleed metrics, impulse trap detection, bilingual study prescriptions, and 1-click remedial test launching.

**Architecture:**
- Create `src/services/aiWeaknessPrescriptionService.ts` for diagnostic aggregation and AI prescription generation.
- Upgrade `src/utils/aiTutorService.ts` system prompt for bilingual Hindi/Hinglish RPSC/RSSB tutoring.
- Integrate the diagnosis card and prescription modal into `src/components/AnalyticsTab.tsx`.
- Enhance `src/components/DishaAITutorModal.tsx` and `src/App.tsx` to pass study progress context so students can request an instant AI postmortem in the AI Tutor chat.
- Write unit tests in `tests/ai-weakness-prescription.test.ts` and verify with `pnpm build`.

---

### Task 1: Create `src/services/aiWeaknessPrescriptionService.ts`
- [ ] Define interfaces: `StudentWeaknessDiagnosis`, `WeakTopicDiagnosis`, `StudyPrescriptionStep`, `StudentAIPrescription`.
- [ ] Implement `diagnoseStudentWeaknesses(questions, chapters, subjects, progressStore, perfStore)`.
  - Calculate overall practiced, correct, wrong, accuracy, and `negativeMarksLost`.
  - Identify impulse mistakes (`timeTakenSeconds < 8` and `isCorrect === false`).
  - Classify topics into `critical` (< 45% or wrong >= 3), `borderline` (45%-70%), and `mastered` (>= 75%).
  - Detect vulnerable question formats (Match the Column, Assertion-Reason, "Not true/असत्य", Dates).
- [ ] Implement `generateAIWeaknessPrescription(diagnosis, options)`.
  - Check active credentials via `getActiveAICredentials()`.
  - If configured and not `forceHeuristic`, query Gemini/OpenRouter with targeted clinical prompt.
  - Implement heuristic fallback generating structured 3-step prescription in Hindi/English with actionable remedial pointers.
- [ ] Implement `createRemedialTestSession(diagnosis, maxQuestions)` generating an `MCQSession` payload.
- [ ] Add caching helpers `saveCachedPrescription` and `loadCachedPrescription`.

### Task 2: Upgrade `src/utils/aiTutorService.ts`
- [ ] Enhance `SYSTEM_PROMPT_STUDY_TUTOR` to naturally handle Hindi, English, and Hinglish.
- [ ] Add explicit instructions for RPSC/RSSB exam standards, official references (Hindi Granth Academy, NCERT, 2024-25 Economic Survey/Budget), and structured diagnostic output formatting.

### Task 3: Integrate into `DishaAITutorModal.tsx` & `App.tsx`
- [ ] Update `DishaAITutorModalProps` to optionally accept `progressStore`, `chapters`, `subjects`, `questions`, and `onStartSession`.
- [ ] Add Quick Suggestion: `"🩺 मेरा AI कमज़ोरी पोस्टमॉर्टम करो (Weakness Diagnosis)"`.
- [ ] When triggered, run `diagnoseStudentWeaknesses`, construct prompt with weak topics summary, and stream response.
- [ ] If prescription is generated, show a clean 1-click button: `"🔥 15 प्रश्नों का उपचारात्मक टेस्ट शुरू करें"`.
- [ ] In `src/App.tsx`, pass `progressStore`, `combinedChapters`, `combinedSubjects`, `combinedQuestions`, and `handleStartSession` to `DishaAITutorModal`.

### Task 4: Integrate AI Postmortem & Prescription into `AnalyticsTab.tsx`
- [ ] Add a prominent "Disha AI Weakness Postmortem" card at the top of `AnalyticsTab.tsx`.
- [ ] Show live pulse indicators:
  - 🩸 Negative Marks Lost (-X.XX)
  - 🚨 Top Critical Weakness
  - ⚡ Impulse / Hasty Errors Count
- [ ] Add "View Detailed Prescription" modal with:
  - Severity status breakdown.
  - The AI Prescription 3-step action plan.
  - "Launch Remedial Test (उपचारात्मक टेस्ट)" button that directly launches the session.

### Task 5: Unit Tests & Build Verification
- [ ] Create `tests/ai-weakness-prescription.test.ts` covering:
  - Weakness diagnosis computation.
  - Negative marking penalty calculation.
  - Impulse mistake detection.
  - Heuristic prescription generation.
  - Remedial session question curation.
- [ ] Run vitest: `pnpm vitest run tests/ai-weakness-prescription.test.ts`.
- [ ] Run full project build: `pnpm build`.
- [ ] Commit and push to git remotes.
