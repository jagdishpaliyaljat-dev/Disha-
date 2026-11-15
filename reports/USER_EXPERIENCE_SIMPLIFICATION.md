# DISHA 20-20 — Phase 15: Student User Experience (UX) Simplification Report

**Audit Date:** November 15, 2026  
**Auditor:** Antigravity Autonomous Sub-Agent (Jarvis Delegation)  
**Scope:** Student User Journey, Navigation Usability, Mobile Form-Factor Ergonomics, Practice Flow Friction, and Cognitive Load Reduction  
**Status:** 100% Read-Only Forensic Inspection Complete  

---

## Executive Summary

DISHA 20-20's primary audience consists of Hindi-medium and bilingual candidates across Rajasthan preparing for rigorous competitive exams (RAS, REET, CET, Patwar, Police Constable). Many students access the platform on budget Android smartphones (screen widths 360px–412px) in areas with intermittent 4G mobile connectivity.

A high-performing educational interface for this demographic must be:
1. **Zero-friction:** Immediate transition from opening the app to solving questions.
2. **Cognitively calm:** Minimal distracting badges, popups, or cluttered banners.
3. **Ergonomically thumb-friendly:** Critical navigation elements positioned within the lower half of the screen.

This audit evaluates the current Student UX, pinpoints friction points and UI clutter, and outlines a comprehensive UX simplification roadmap.

---

## 1. Current Navigation Architecture & Information Hierarchy

```
Current Navigation Layout:
┌─────────────────────────────────────────────────────────────┐
│ Header: [Logo] [Search] [Theme] [Bell] [Full Exam] [Login]  │ ◄── Cluttered Header (6 icon buttons)
├─────────────────────────────────────────────────────────────┤
│ Banner Carousel: [Auto-scrolling slides (160px height)]     │ ◄── Pushes curriculum below fold
├─────────────────────────────────────────────────────────────┤
│ Quick Actions: [Smart Test] [PYQ 2024] [Full RAS] [Revise]  │
├─────────────────────────────────────────────────────────────┤
│ Active Study Resume & Daily Target Card                     │
├─────────────────────────────────────────────────────────────┤
│ Subject Grid: [History] [Art&Culture] [Geo] [Polity] [Econ] │
├─────────────────────────────────────────────────────────────┤
│ BottomNav: [Home] [Topics] [PYQ] [Live] [Wrong] [Profile]   │ ◄── 6 tabs (cramped on 360px screens)
└─────────────────────────────────────────────────────────────┘
```

### Key Navigation Friction Points:
1. **Header Clutter:** The top app bar currently displays up to 6 action icons (`Search`, `Theme Toggle`, `Notification Bell`, `Full Exam Quick Link`, `API Settings`, and `User Login`). On a 360px width screen, these buttons compress or overflow.
2. **Bottom Navigation Overcrowding:** The bottom navigation bar contains **6 separate tabs** (`Home`, `Topics`, `PYQ Vault`, `Live Tests`, `Wrong Questions`, and `Profile`). Labels frequently wrap or get clipped on standard mobile devices.
3. **Curriculum Pushed Below the Fold:** The promotional banner carousel and multiple quick action pill rows push the actual subject list down, requiring vertical scrolling before a student can begin practice.

---

## 2. MCQ Practice Session Usability & Cognitive Load Analysis

The core value delivery occurs inside `MCQSessionModal.tsx` (4,292 LOC). While feature-rich, the screen currently overloads students with visual stimuli:

```
┌─────────────────────────────────────────────────────────────┐
│ Header: [Exit X] [Timer 00:15:00] [Q 14/50] [Bookmark] [A/अ]│
├─────────────────────────────────────────────────────────────┤
│ Question Text: [Hindi / English text with KaTeX math]       │
├─────────────────────────────────────────────────────────────┤
│ Table / Diagram / Match Columns (if present)                │
├─────────────────────────────────────────────────────────────┤
│ Options:                                                    │
│   (A) Option 1 text                                         │
│   (B) Option 2 text                                         │
│   (C) Option 3 text                                         │
│   (D) Option 4 text                                         │
├─────────────────────────────────────────────────────────────┤
│ [Instant Check Button]  [Ask AI Tutor Button]               │
├─────────────────────────────────────────────────────────────┤
│ Immediate Feedback Card (Expands): Correct/Incorrect + Key  │
├─────────────────────────────────────────────────────────────┤
│ Footer: [Prev] [Palette Grid] [Clear] [Mark Review] [Next]  │
└─────────────────────────────────────────────────────────────┘
```

### Usability Bottlenecks Identified:
1. **Practice Mode vs Exam Mode Confusion:** Students are often confused by whether they are in "Immediate Explanation Mode" (practice) or "Timed Exam Mode" (real test). The UI attempts to do both simultaneously, displaying submit buttons alongside instant answer checks.
2. **Audio Feedback Overkill:** Audio chimes on every question tap can be disruptive in quiet study environments or libraries. While a mute toggle exists, it defaults to active in some guest flows.
3. **Thumb Reachability:** The "Next Question" action is positioned on the bottom right, but the "Bookmark" and "Language Toggle" actions are placed at the very top of tall screens, requiring awkward two-handed operation.

---

## 3. Wrong Questions & Weakness Revision Flow

The `WrongTab` is one of the highest-value features in DISHA 20-20. However, the current flow has friction:
- **Disjointed Error Categorization:** Mistakes are grouped only by date or subject. Students cannot filter by *why* they made the mistake (e.g. "Misread Question", "Factual Guess", "Concept Unclear").
- **Lack of "Mastery Clear":** When a student successfully solves a previously wrong question during revision, the UI does not celebrate or clearly indicate that the question has been "graduated" out of the mistake backlog.

---

## 4. Offline & Low-Bandwidth Experience

The app's offline resilience is a standout technical achievement, but student communication could be clearer:
- **Offline Banner Visibility:** The offline indicator appears as a small floating toast that dismisses automatically after a few seconds. Students often wonder whether their latest quiz progress will be saved.
- **Permanent "Offline-Ready" Badge:** Instead of fleeting toasts, an unobtrusive persistent dot icon (Green = Synced, Amber = Offline / Changes Buffered Locally) provides greater peace of mind.

---

## 5. Proposed Student UX Simplification Blueprint

### A. Streamlined 4-Tab Bottom Navigation
Consolidate the cramped 6-tab bottom bar into **4 intuitive pillars**:

```
Current (6 tabs):   [Home] [Topics] [PYQ Vault] [Live Tests] [Wrong] [Profile]
Proposed (4 tabs):  [Practice] [Tests] [Revision Hub] [Profile]
```
- **Tab 1: Practice (Curriculum):** Home feed + Subject / Chapter tree in a unified view.
- **Tab 2: Tests (Exam Center):** Combines Scheduled Live Tests, PYQ Vault, and Full 150-Q Mocks under one unified exam dashboard.
- **Tab 3: Revision Hub (Mistakes & Bookmarks):** Combines Wrong Questions, Bookmarked Questions, and Weakness Heatmaps.
- **Tab 4: Profile & Settings:** User profile, target exam, offline storage manager, and app settings.

### B. Cleaned-Up Header Bar
- Retain only **App Logo**, **Global Search**, and **User Avatar**.
- Move Theme toggle and API Settings inside the Profile screen.
- Move notifications into an in-app inbox accessed from the Profile or Practice top bar.

### C. Distraction-Free Practice Screen (Zen Mode)
- **Clear Mode Selection:** Prompt before session start:
  - *Learning Mode:* Instant explanations, no countdown pressure, hint button.
  - *Exam Mode:* Strict timer, question palette, results revealed only upon final submission.
- **Ergonomic Bottom Bar:** Group all primary controls (Language Toggle, Bookmark, Previous, Next) into a sticky bottom sheet easily reachable with one thumb.
