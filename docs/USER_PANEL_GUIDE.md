# DISHA 20-20 — Student Panel User Guide

## 1. Onboarding & Aspirant Profile Setup

The DISHA 20-20 student panel delivers an exam-focused, distraction-free environment for competitive exam preparation.

```
+-------------------------------------------------------------------------------+
|                             STUDENT LEARNING CYCLE                            |
+-------------------+-------------------------------+---------------------------+
| 1. DISCOVER       | 2. PRACTICE & EVALUATE        | 3. MASTER & RETAIN        |
+-------------------+-------------------------------+---------------------------+
| - Target Exam     | - Curriculum Practice Session | - Spaced Repetition (0-4) |
| - Syllabus Tree   | - RPSC 5th Option 'E' Rules   | - Error Journal (Wrong Qs)|
| - PYQ Vault       | - Timed Live Test Simulation  | - Weakness Heatmap        |
| - Scanned Papers  | - Immediate Devanagari Answer | - Adaptive Smart Tests    |
+-------------------+-------------------------------+---------------------------+
```

### 1.1 Account Creation & Sign-In
- Aspirants can sign in using **Google One-Tap Authentication** or **Email/Password**.
- **Guest Practice Mode (`guestManager.ts`):** Unauthenticated users can start practicing immediately. All question attempts, streak counts, and progress are cached in local IndexedDB v5 storage and automatically migrate to the student's cloud account upon signing in.

### 1.2 Target Exam Configuration
Upon initial login, students select their primary target examination:
- **RPSC RAS (Preliminary)**
- **RPSC 1st & 2nd Grade Teacher**
- **REET (Level 1 / Level 2)**
- **RSMSSB Patwar & VDO**
- **RSMSSB CET (Graduate / 10+2)**
- **Rajasthan Police Sub-Inspector (SI)**

Setting a target exam filters curriculum subjects and personalizes the home screen with relevant high-yield topics and upcoming live tests.

---

## 2. Home Dashboard (`HomeTab.tsx`)

The central command dashboard gives students an immediate overview of their daily progress:
1. **Daily Study Streak:** Tracks consecutive active practice days.
2. **Daily Goal Ring:** Visualizes progress toward the daily target (e.g., 50 questions/day).
3. **Quick Action Hub:**
   - **Resume Last Session:** Jumps directly to the last active topic.
   - **Revise Due Today:** Opens questions due for spaced repetition review.
   - **Smart Weakness Test:** Generates a custom test focusing on past mistakes.
4. **Motivational & Notification Banners:** Displays announcements regarding exam dates, syllabus updates, and scheduled live mock tests.

---

## 3. Curriculum & Topic Explorer (`TopicsTab.tsx`)

### 3.1 Navigating the Academic Hierarchy
1. Select a **Subject** (e.g., *राजस्थान का इतिहास - कला एवं संस्कृति*).
2. Browse through numbered **Chapters** (e.g., *1857 की क्रांति*, *प्रजामंडल आंदोलन*).
3. Click a **Topic** to view:
   - Total questions in the bank.
   - Student's current mastery percentage.
   - Number of unattempted, correct, and wrong questions.
4. Click **Start Practice** to launch the MCQ session.

---

## 4. Intelligent MCQ Practice Engine (`MCQSessionModal.tsx`)

The question engine supports two primary operating modes:
- **Practice Mode (Instant Feedback):** Selecting an option immediately reveals whether the choice is correct, accompanied by a detailed Devanagari explanation, mnemonics, and reference facts.
- **Test / Simulation Mode:** Feedback is deferred until the entire test is submitted, simulating real exam conditions with a countdown timer.

### 4.1 RPSC 5th Option 'E' Compliance
In accordance with Rajasthan Public Service Commission standards, every question offers five options:
- **Options (A), (B), (C), (D):** Substantive answer choices.
- **Option (E) — अनुत्तरित प्रश्न (Question Not Attempted):** If a student does not know the answer, they must bubble Option (E) to avoid negative marking.
- **Evaluation Mechanics:**
  - Correct answer: $+2.0$ marks (or full marks).
  - Incorrect answer: $-1/3$ negative penalty.
  - Option (E) selected: $0.0$ marks (no penalty).
  - Left completely blank: $-1/3$ negative penalty (penalized for failing to bubble Option E).
  - Leaving $> 10\%$ questions blank results in disqualification.

### 4.2 Interactive Question Formats
The engine renders five distinct question formats:
1. **Standard SCQ:** Single direct question with four options.
2. **Multiple Statements:** Numbered assertions ($1, 2, 3$); student evaluates which statements are true.
3. **Assertion & Reason (कथन एवं कारण):** Tests logical causation between statements.
4. **Match the Following (सुमेलित कीजिए):** Interlinked table matching List I with List II.
5. **LaTeX Mathematical / Numerical Problems:** Complex formulas and equations rendered with crisp KaTeX typography.

### 4.3 Session Controls & Audio Assistance
- **Audio Pronunciation:** Tap the speaker icon to hear the British English pronunciation of technical terms (`/api/pronounce-en-gb`).
- **Sound & Haptic Feedback:** Subtle vibration and audio tones confirm correct/wrong answers (configurable in Settings).
- **Bookmark & Notebook:** Save challenging questions for quick revision.
- **Report Question:** Flag suspected inaccuracies directly to the administrative review desk.

---

## 5. Spaced Repetition Revision & Error Journal (`WrongTab.tsx`)

### 5.1 The Leitner Spaced Repetition Queue
Questions answered correctly during practice are scheduled for future review across 5 stages:
- **Stage 0:** Practice immediately / within 3 days.
- **Stage 1:** Review after 7 days.
- **Stage 2:** Review after 21 days.
- **Stage 3:** Review after 45 days.
- **Stage 4:** Permanent memory (review after 75 days).

Questions appearing in the **"Due Today"** tab are prioritized to ensure knowledge is retained long-term.

### 5.2 Error Journal (Mistake Bank)
The Error Journal records every question the student has answered incorrectly:
- **Filter by Chapter / Subject:** Focus review on high-error topics.
- **Attempt History:** Shows how many times a question has been missed.
- **"Clear Mistake" Progression:** Answering an error question correctly moves it into Stage 1 of the Leitner queue.

---

## 6. Real-Time Live Tests & Merit Lists (`LiveTestsTab.tsx`)

1. **Test Registration:** Browse upcoming live state-level mock tests.
2. **Exam Room Simulation:**
   - Full-screen distraction-free mode.
   - Question palette with status indicators (Answered, Not Answered, Marked for Review).
   - Auto-submission when the timer expires.
3. **Instant Performance Scorecard:**
   - Net marks obtained (accounting for negative marking and blank penalties).
   - State-level rank and percentile.
   - Category-wise breakdown (History, Geography, Polity).
   - Downloadable PDF performance certificate.

---

## 7. Authentic PYQ Vault (`PYQVaultTab.tsx`)

- Provides access to authentic past examination papers from RPSC and RSMSSB from 2013 to 2026.
- Filter by Exam Board, Year, and Examination.
- Practice past papers under exact historical time constraints or download official PDF papers.

---

## 8. AI Exam Paper Scanner & Matcher (`analyzer/`)

Students can upload photos or PDF scans of physical exam papers:
1. **Capture / Upload:** Take a photo of an offline coaching or previous exam paper.
2. **AI OCR Extraction:** Gemini 2.0 extracts the question text, options, and question numbers.
3. **Semantic Matching:** The engine searches DISHA's verified database and identifies exact or similar questions, providing instant verified answer keys and detailed explanations.

---

## 9. Personalization & Settings (`ProfileTab.tsx`)

- **Appearance:** Toggle between Light and Dark mode.
- **Font Sizing:** Adjust Devanagari typography scale (Small, Medium, Large).
- **Personal AI API Keys:** Power users can add their own Google Gemini or OpenAI API keys for unlimited, personal AI explanations.
