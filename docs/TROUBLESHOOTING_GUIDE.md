# DISHA 20-20 — Comprehensive Troubleshooting & Triage Guide

This guide documents known operational edge cases, symptoms, root causes, and definitive resolutions across local development, testing, staging, and production environments.

---

## 1. Quick Diagnostic Triage Table

| Symptom / Error | Root Cause | Immediate Action |
|:---|:---|:---|
| `MetadataLookupWarning` or `Could not load default credentials` | Node attempting GCP metadata lookup without ADC in local environment | Safe to ignore in local dev; server falls back to mock driver automatically. |
| `FATAL ERROR: Ineffective mark-compacts near heap limit Allocation failed` | Termux / Android process memory exhaustion during `tsc` or `build` | Export `NODE_OPTIONS="--max-old-space-size=4096"` before running commands. |
| Student practice updates not visible in Cloud Firestore | 24-hour sync gate actively buffering writes to protect cloud quota | Expected behavior. Data is safe in IndexedDB v5. Use Force Sync if immediate push needed. |
| HTTP 403 Forbidden on `/api/admin/*` endpoints | User email not on allowlist or `email_verified == false` | Verify email in Firebase Auth console; ensure email matches allowlist. |
| PWA shows outdated questions after administrative edits | Service Worker `CacheFirst` asset caching active in browser | Call `/api/quiz-assets/invalidate` from Admin panel or tap "Update Available" toast. |
| AI features fail with `rate_limited` or `status: 429` | Gemini / OpenAI provider rate limit hit | System auto-cooldowns key for 5 mins and rotates provider; reset manually in Admin. |
| HTTP 413 `Payload Too Large` on bulk question import | Import payload exceeds 15 MB Express body parser threshold | Split spreadsheet or import in batches of $\le 500$ questions. |

---

## 2. Detailed Issue Scenarios & Resolutions

### Scenario 1: GoogleAuth MetadataLookupWarning During Tests
- **Log Output:**
  ```text
  [Firebase Admin] No Service Account JSON found — using Application Default Credentials (local dev mode)
  (node:18892) MetadataLookupWarning: received unexpected error = All promises were rejected code = ETIMEDOUT, ENOTFOUND
  Unhandled Rejection: Could not load the default credentials.
  ```
- **Root Cause:** When running in local development or test runners without an active `GOOGLE_APPLICATION_CREDENTIALS` path, Google Auth Library attempts to ping the Google Cloud Compute Engine metadata server (`169.254.169.254`). Because the developer is running locally (e.g. on Android/Termux), the connection times out.
- **Resolution:**
  - This warning **does not affect test correctness**. All 89 test assertions pass because DISHA's internal test drivers use `mockFirestoreDriver.ts`.
  - To eliminate the warning entirely in local development, point `GOOGLE_APPLICATION_CREDENTIALS` to a real service account JSON file in `.env.local`:
    ```bash
    export GOOGLE_APPLICATION_CREDENTIALS="/data/user/0/com.termux/files/home/Disha-/serviceAccountKey.json"
    ```

---

### Scenario 2: Memory Exhaustion in Termux (Android OOM)
- **Log Output:**
  ```text
  <--- Last few GCs --->
  [21034:0x...] 45210 ms: Mark-Compact 2045.2 (2080.1) -> 2040.1 (2080.1) MB, 1420.50 / 0.00 ms
  FATAL ERROR: CALL_AND_RETRY_LAST Allocation failed - JavaScript heap out of memory
  ```
- **Root Cause:** By default, Node.js limits its V8 heap size to ~2 GB on 64-bit systems. Compiling thousands of TypeScript files and complex Tailwind v4 CSS modules simultaneously in mobile Termux exhausts this limit.
- **Resolution:**
  - In `package.json`, the `lint` command is already hardened:
    ```json
    "lint": "NODE_OPTIONS='--max-old-space-size=4096' tsc --noEmit"
    ```
  - For manual shell commands, export the environment variable:
    ```bash
    export NODE_OPTIONS="--max-old-space-size=4096"
    ```

---

### Scenario 3: Student Writes Not Appearing in Cloud Firestore
- **Symptom:** A student answers 50 questions, bookmarks 5 items, and studies for 45 minutes, but the Firestore console under `/users/{uid}/progress` shows zero updates.
- **Root Cause:** This is **intentional core system behavior**. The `StudentWriteBuffer` queues all modifications in local IndexedDB v5 (`pending_sync_queue`). Writes to Cloud Firestore are blocked by `canPerformRoutineSync()` until **24 hours** have elapsed since the last cloud sync.
- **Verification:**
  1. Open Chrome DevTools -> Application -> IndexedDB -> `DISHA_2020_LOCAL_V5`.
  2. Inspect the `pending_sync_queue` object store. All answered questions will be safely preserved.
  3. Inspect `user_progress` and `wrong_questions`. All local UI and spaced repetition queues reflect these updates immediately.
- **Force Sync (If Testing or Immediate Cloud Push Desired):**
  - In the student panel, navigate to **Profile -> Settings -> Sync Status**.
  - Tap **Force Sync Now**. This passes `force: true` to `flushStudentWriteBuffer()`, bypassing the 24-hour gate and executing the cloud batch write immediately.

---

### Scenario 4: Admin Access Denied (HTTP 401 / 403)
- **Symptom:** Clicking the **Admin** tab redirects to login or reports "Unauthorized Access".
- **Resolution Checklist:**
  1. **Check Email Address:** Ensure you are signed in with one of the authorized super-admin addresses:
     - `zdpaliyal@gmail.com`
     - `jagdishpaliyaljat@gmail.com`
  2. **Check Email Verification Status:** Firebase Auth strictly requires `email_verified == true`.
     - In the Firebase Console -> Authentication -> Users, find the user account.
     - If the "Verified" column shows a cross, click "Send verification email" or mark it verified in the console.
  3. **Check User Document:**
     - In Firestore under `/users/{uid}`, verify that `blocked != true` and `role == 'admin'`.

---

### Scenario 5: PWA Service Worker Serving Stale Content
- **Symptom:** Questions edited in the Admin panel still appear with previous text on student mobile devices.
- **Root Cause:** Workbox uses a `CacheFirst` strategy with a 90-day expiration window for static quiz assets (`/api/quiz-assets/*`).
- **Resolution:**
  1. **Server Invalidation:** In the Admin panel, click **Publish Snapshot** or trigger:
     ```bash
     curl -X POST https://disha-2020.vercel.app/api/quiz-assets/invalidate \
       -H "Authorization: Bearer <ADMIN_TOKEN>"
     ```
     This increments the server's `curriculumVersion`, signaling Service Workers to fetch fresh bundles.
  2. **Client Update:** When the client detects the new version, the `PWAUpdateToast` widget appears. Tap **Update App** to purge the cache and reload the application.

---

### Scenario 6: AI API Rate Limits & Cooldown
- **Symptom:** AI question formatting or OCR scanning fails with:
  ```json
  {"error": "AI Provider rate limited or quota exceeded. Key placed in cooldown."}
  ```
- **Resolution:**
  - The multi-provider resilience engine automatically marks the failing key as `rate_limited`, sets a 5-minute cooldown timer, and routes subsequent requests to secondary configured providers (e.g., Claude or Groq).
  - To clear the cooldown immediately after adding quota, navigate to **Admin -> AI API Settings**, select the key, and click **Reset Cooldown**.
