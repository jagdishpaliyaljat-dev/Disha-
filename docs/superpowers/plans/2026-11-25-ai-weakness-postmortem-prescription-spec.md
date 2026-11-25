# Disha AI Weakness Postmortem & Study Prescription (कमजोरी पोस्टमॉर्टम व अध्ययन नुस्खा)

## Overview & Executive Summary
Disha 20-20 Exam Prep is an intensive, pure MCQ practice platform for Rajasthan and National competitive exams (RPSC RAS, REET, CET, Patwar, Police SI, SSC, UPSC).
While standard quiz apps merely tally raw scores (e.g. 60/100 correct), students consistently suffer from:
1. **Blindspot Persistence**: Repeating the same conceptual mistakes across subsequent mock tests.
2. **Negative Marking Bleed**: Losing 1/3 mark on every hasty or blind guess without realizing the cumulative score penalty.
3. **Lack of Actionable Remediation**: Not knowing *what* to study today to fix the specific topics that caused their failures.

This feature introduces the **Disha AI Weakness Postmortem & Study Prescription System**:
- Automatically audits student attempt records from `ProgressStore` and `PerformanceStore`.
- Generates a clinical-grade diagnostic report ("Postmortem") breaking down:
  - Critical Topic Gaps (< 40% accuracy or ≥ 3 errors).
  - Negative Marking Bleed (exact marks lost to 0.33 penalties).
  - Hasty Guess Traps (questions answered in < 8 seconds and answered wrong).
  - Chronology / Elimination / Match-the-pair vulnerability patterns.
- Delivers an actionable, bilingual 3-Step **"Study Prescription"** (अध्ययन नुस्खा) with memory mnemonics and high-yield review pointers.
- Provides a **1-Click Remedial Booster Drill** directly launching a targeted test of the student's exact weak questions.
- Accessible directly within **AnalyticsTab** (via a dedicated Postmortem Banner & Modal) and inside **DishaAITutorModal** (via a 1-tap "🩺 मेरा AI कमज़ोरी पोस्टमॉर्टम करो" action).

---

## Technical Architecture

### 1. New Service: `src/services/aiWeaknessPrescriptionService.ts`
- **Data Extractor**: `diagnoseStudentWeaknesses(questions, chapters, subjects, progressStore, perfStore)`
  - Aggregates performance by topic, chapter, and subject.
  - Computes:
    - `totalAttempted`, `totalCorrect`, `totalWrong`, `accuracyPercent`.
    - `negativeMarksLost` (wrongCount * 0.33).
    - `impulseMistakes` (questions with `lastTimeTakenSeconds < 8` and `lastResult === "wrong"`).
    - `criticalWeakTopics` (accuracy < 45% or wrong >= 3).
    - `borderlineTopics` (accuracy 45%-70%).
    - `masteredTopics` (accuracy >= 75%).
    - `vulnerableQuestionTypes` (e.g. "कथन/कारण", "सुमेलित कीजिए", "नहीं है", "वर्ष/तारीख").
- **AI Generator / Heuristic Fallback**: `generateAIWeaknessPrescription(diagnosis, options)`
  - Calls Gemini/OpenRouter via `executeAICompletion` with prompt tuned for RPSC/RSSB academic mentoring in Hindi/English.
  - Includes robust offline-first heuristic fallback that generates a structured prescription with 3 actionable steps even when offline or without API key.
- **Cache Layer**: `saveCachedPrescription` and `loadCachedPrescription` in `localStorage` keyed by student attempt hash to prevent redundant API calls.

### 2. Integration in `DishaAITutorModal.tsx`
- Add Quick Suggestion chip: `"🩺 मेरा AI कमज़ोरी पोस्टमॉर्टम करो (Weakness Diagnosis)"`.
- Add prop support for `progressStore`, `chapters`, `subjects`, `questions`.
- When triggered, extracts current student weak points, constructs a personalized diagnostic prompt, and streams/displays the prescription directly in the chat.
- Embeds a 1-Click Action button in the chat message to immediately launch a Remedial Booster session.

### 3. Integration in `AnalyticsTab.tsx`
- Add an elevated, medical/clinical themed **"Disha AI Postmortem & Prescription"** card at the top of AnalyticsTab.
- Shows live metrics:
  - 🩸 **Negative Marks Bleed**: -X.XX marks lost.
  - 🚨 **Primary Weak Area**: e.g., "राजस्थान का भूगोल: खनिज एवं ऊर्जा संसाधन".
  - ⚡ **Impulse Traps**: X hasty mistakes detected.
- Features:
  - **"View Full AI Postmortem (विस्तृत पोस्टमॉर्टम)"** modal showing the complete diagnosis and prescription.
  - **"Launch 15-Q Remedial Booster (उपचारात्मक टेस्ट)"** button that immediately loads the weak questions into `MCQSessionModal`.

### 4. Integration in `src/utils/aiTutorService.ts`
- Upgrade `SYSTEM_PROMPT_STUDY_TUTOR` to naturally handle Hindi/Hinglish student queries, RPSC/RSSB exam standards, and structured prescriptions with KaTeX/Markdown formatting.

---

## Verification & Acceptance Criteria
1. `tests/ai-weakness-prescription.test.ts`:
   - Correctly aggregates `ProgressStore` and identifies critical vs borderline topics.
   - Calculates negative marks lost accurately (wrong * 0.33).
   - Detects hasty impulse mistakes (< 8s).
   - Heuristic generator produces valid 3-step prescription without API key.
   - 1-Click remedial question pool selects only relevant weak questions.
2. UI rendering tests:
   - DishaAITutorModal renders postmortem prompt and accepts progress store context.
   - AnalyticsTab renders AI Postmortem card and modal without crashes.
3. Production verification:
   - `pnpm vitest run tests/ai-weakness-prescription.test.ts` passes 100%.
   - `pnpm build` compiles with zero errors.
