# DISHA 20-20 — USER DASHBOARD TEST REPORT
**Audit Date:** November 15, 2026  
**Auditor:** AntiGem Automated Deep Forensic Agent (Phase 3 Audit)  
**Target Module:** User Home Dashboard (`src/components/HomeTab.tsx`, `BannerSlides.tsx`)  
**Status:** PASS — Fully Functional & Verified

---

## 1. Scope & Objective

This test evaluates the Home Dashboard (`HomeTab`) from the perspective of an active student preparing for Rajasthan competitive exams. The test covers component rendering, real-time data calculations, interactive widgets, responsive layout breakpoints, and navigation links.

---

## 2. Tested Components & Workflows

### 2.1 Preparation Overview & Accuracy Scorecard
- **Implementation:** `src/components/HomeTab.tsx` (Lines 156–173, 265–324)
- **Calculation Logic:**
  - `attemptedCount`: Sum of questions in `progressStore` where `status !== "unattempted"`.
  - `correctCount`: Sum of questions where `status === "correct"`.
  - `accuracy`: Math rounded percentage `(correct / attempted) * 100` (defaults to `0%` when attempted is 0).
  - Status tier labels:
    - `accuracy >= 70%`: `● Strong` (Emerald styling)
    - `40% <= accuracy < 70%`: `● On Track` (Amber styling)
    - `accuracy < 40%`: `● Building` (Rose styling)
- **Verification Result:** PASS. Correctly dynamically recalculates as questions are answered across practice sessions without page reload. Link to analytics tab (`onNavigateTab?.("analytics")`) transitions with zero lag.

### 2.2 Dynamic Banner Carousel (`BannerSlides.tsx`)
- **Implementation:** `src/components/BannerSlides.tsx` & `src/utils/bannerStorage.ts`
- **Features Tested:**
  - Real-time Firestore synchronization via `subscribeToActiveBanners`.
  - Fallback to local storage cache (`getLocalBanners`) when offline.
  - Automatic filtering of inactive banners (`b.isActive === true`).
  - Strict ordering by ascending integer (`order || 0`).
  - Auto-play rotation timer with pause on hover/touch.
  - Deep-link action button routing (e.g. `onNavigateTab("live_tests")` or external URL).
- **Verification Result:** PASS. Offline fallback renders stored banners immediately. Touch swiping and dot pagination function smoothly on mobile viewports.

### 2.3 4-Action Practice Matrix
- **Implementation:** `src/components/HomeTab.tsx` (Lines 326–424)
- **Matrix Grid:**
  1. **Live Tests Card (`Flame` icon):** Deep-links directly to `/live_tests` with glowing `● LIVE` badge.
  2. **PYQ Vault Card (`FileText` icon):** Deep-links directly to `/pyq_vault` with `OFFICIAL` badge.
  3. **Custom Test Card (`Compass` icon):** Opens `CreateTestModal` (`CustomSmartTestModal`) allowing custom subject and question count selection.
  4. **Mistake Bank Card (`FileX` icon):** Deep-links directly to `/wrong` with `REVISION` badge.
- **Verification Result:** PASS. All four action buttons trigger appropriate state changes and micro-interaction animations (`motion.button whileTap={{ scale: 0.98 }}`).

### 2.4 AI Engine Setup Card
- **Implementation:** `src/components/HomeTab.tsx` (Lines 427–466)
- **Capabilities Tested:**
  - Dynamic status indicator: Shows `Platform AI` or `Personal Keys (N keys configured)`.
  - Click action opens `ApiSettingsModal` for Gemini API BYOK configuration.
  - Key validation prevents empty or invalid key strings from persisting.
- **Verification Result:** PASS. Clean key persistence in `localStorage` under `quizpro_settings_v1`.

### 2.5 Header & Navigation Drawer
- **Implementation:** `src/components/HomeTab.tsx` (Lines 185–256, 470–650)
- **Features Tested:**
  - Unread notification badge: Accurately reflects count from `notificationsStorage`.
  - Dark mode toggle: Smoothly alternates between `#FFF9EF` (Day) and `#171923` (Night) color tokens and syncs with `settings.darkMode`.
  - Drawer slide-in animation: React 19 / Motion gesture drawer with backdrop blur.
- **Verification Result:** PASS. Non-wrapping brand logo prevents layout distortion on narrow screens (320px–375px).

---

## 3. Test Evidence & Metrics

| Test Case | Expected Behavior | Actual Behavior | Status |
|---|---|---|---|
| **DASH-01** | Zero division safety when attemptedCount = 0 | Accuracy renders `0%` without NaN or crash | **PASS** |
| **DASH-02** | Status pill updates on 75% accuracy | Label renders `● Strong` | **PASS** |
| **DASH-03** | Offline banner retrieval | Local storage cache loaded with zero delay | **PASS** |
| **DASH-04** | Tap Custom Test button | `CreateTestModal` opens with subject selectors | **PASS** |
| **DASH-05** | Notification count badge display | Pill appears only when `unreadCount > 0` | **PASS** |
| **DASH-06** | Dark mode toggle click | Root HTML class toggles `dark`, tokens update | **PASS** |

---

## 4. Operational Recommendations
- The dashboard is robust and highly optimized.
- Keep the banner images compressed (<100KB) to prevent network lag on low-speed 3G/4G connections.
