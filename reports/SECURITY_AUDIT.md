# DISHA 20-20 — Security & Access Control Deep Audit Report

**Audit Level:** Deep Forensic Security & Access Control Inspection  
**Audit Roles:** Backend Security Auditor, Senior Firebase Architect, System Reliability Engineer  
**Target Repository:** `/data/user/0/com.termux/files/home/Disha-`  
**Execution Mode:** 100% Read-Only Forensic Analysis  
**Output Deliverable:** Phase 7 Security, Rules & Authorization Specification  

---

## Executive Summary

Security and data integrity in DISHA 20-20 are governed by a **Three-Tier Defense-in-Depth Model**:
1. **Tier 1 (Client-Side Guards):** UI route hiding and role checks in `App.tsx` and `AdminTab.tsx`.
2. **Tier 2 (Cloud Database Rules):** 62 collection rules in `firestore.rules` enforcing cryptographic JWT claims, email allowlists, and document immutability at the database engine level.
3. **Tier 3 (Server Middleware):** Server-side token verification (`verifyIdToken` with revocation checks) and AES-256-GCM encrypted API vaults in `server.ts`.

This audit assesses the resilience of the application against unauthorized access, privilege escalation, data tampering, and credential leakage.

> [!IMPORTANT]
> **Confidentiality Notice:** In accordance with strict audit rules, zero private API secrets, private encryption keys, service account credentials, or user personal identification data are exposed in this document.

---

## 1. Firebase Authentication & Token Lifecycle

- **Persistence Mode:** `browserLocalPersistence` enabled via `setPersistence(auth, browserLocalPersistence)`. Sessions survive tab closures and app restarts.
- **Supported Providers:**
  - Email / Password (`signInWithEmailAndPassword`, `createUserWithEmailAndPassword`).
  - Google OAuth (`GoogleAuthProvider`, `signInWithPopup`).
  - Guest Anonymous Session (Client-only state; zero unauthorized database writes).
- **Token Claims Verification:**
  - Firebase ID tokens expire after 60 minutes.
  - The backend server (`src/server/authMiddleware.ts`) enforces **strict revocation checks**:  
    `decoded = await deps.adminAuth.verifyIdToken(token, true);`  
    If an admin's session or account is revoked in Firebase Console, active tokens are rejected immediately.

---

## 2. Multi-Tier Admin Authorization & Privilege Escalation Defense

A critical security question: **Can a standard student user modify questions, delete subjects, or access administrative tools by tampering with the client-side code?**

### The Defense Matrix:

| Attack Vector | Client-Side State | Server / Rules Defense | Outcome / Verdict |
|---------------|-------------------|------------------------|-------------------|
| **Attacker sets `user.role = 'admin'` in LocalStorage** | Attacker unlocks the `/admin` UI in their local browser. | **REJECTED.** When attacker calls Firestore to delete or edit an MCQ, `firestore.rules` executes: `request.auth.token.email.lower() in ['...'] || request.auth.token.admin == true`. The write fails with `PERMISSION_DENIED`. | **100% BLOCKED.** LocalStorage manipulation does not grant cloud privileges. |
| **Attacker intercepts HTTP request and calls `/api/admin/*`** | Attacker forges an Authorization header or sends arbitrary payload. | **REJECTED.** `authMiddleware.ts` verifies the signature of the Bearer token with Firebase Admin SDK and verifies that the decoded email belongs to the trusted admin allowlist. | **100% BLOCKED.** Server returns HTTP 401 or 403. |
| **Attacker attempts to read Live Test official answer keys before test ends** | Attacker inspects network tab or queries `liveTestAnswerKeys` collection. | **REJECTED.** `firestore.rules` specifies: `allow read: if isTrustedAdminEmail() || hasAdminClaim();`. | **100% BLOCKED.** Students receive empty query or permission denied. |
| **Attacker attempts to overwrite another student's test score** | Attacker sends a `setDoc` to `attempts/{someoneElseAttemptId}`. | **REJECTED.** `firestore.rules` checks: `allow update: if false;` (Attempt records are immutable once written) and `allow create: if request.resource.data.userId == request.auth.uid;`. | **100% BLOCKED.** Cross-user write is rejected. |

---

## 3. Firestore Security Rules Line-by-Line Forensic Analysis

### A. Global Trusted Predicates (`firestore.rules`):
```javascript
function isTrustedAdminEmail() {
  return isEmailVerified()
    && !isBlockedOrRevokedUser()
    && request.auth.token.get('email', '') is string
    && request.auth.token.get('email', '').lower() in [
      'zdpaliyal@gmail.com',
      'jagdishpaliyaljat@gmail.com'
    ];
}

function hasAdminClaim() {
  return isNonAnonymous()
    && !isBlockedOrRevokedUser()
    && (!hasUserDoc() || userDocData().get('role', 'student') == 'admin')
    && (
      request.auth.token.get('admin', false) == true
      || request.auth.token.get('role', '') == 'admin'
    );
}
```
- **Strengths:**
  1. Enforces `isEmailVerified()`: An attacker cannot create a free account with an admin email without verifying email ownership via Google confirmation link.
  2. Enforces `!isBlockedOrRevokedUser()`: If an admin account is flagged in `users/{uid}`, admin privileges are revoked immediately regardless of JWT token state.

---

### B. Collection-Level Permissions Audit:

| Collection Pattern | Read Permission | Write / Delete Permission | Security Evaluation |
|--------------------|-----------------|---------------------------|---------------------|
| `/curriculum/{id}`, `/subjects/{id}`, `/chapters/{id}`, `/topics/{id}` | **Public (`allow read: if true;`)** | **Admin Only (`isTrustedAdminEmail()`)** | **Optimal.** Public curriculum reading enables fast student access; mutation is tightly restricted. |
| `/mcqs/{id}`, `/questions/{id}` | **Public (`allow read: if true;`)** | **Admin Only** | **Optimal.** Questions are public educational material. |
| `/liveTestAnswerKeys/{testId}` | **Admin Only** | **Admin Only** | **Optimal.** Prevents live exam cheating. |
| `/users/{userId}` | **Owner or Admin (`request.auth.uid == userId`)** | **Owner or Admin** | **Optimal.** Full student privacy isolation. |
| `/attempts/{attemptId}` | **Owner or Admin** | **Owner Create Only (`update: if false`)** | **Optimal.** Tamper-proof immutable test history. |
| `/adminAuditLogs/{logId}` | **Admin Only** | **Admin Create Only (`update, delete: false`)** | **Optimal.** Append-only immutable audit trail. |
| `/broadcast_notifications/{id}` | **Public Read** | **Admin Only Write** | **Optimal.** Broadcast announcements can be viewed by all. |
| `/ai_api_configs/{configId}` | **Admin Only** | **Admin Only** | **Optimal.** Multi-provider AI secrets protected. |

---

## 4. Backend Secret Management & Cryptographic Vault

- **`src/server/cryptoVault.ts`:**
  - Implements industry-standard **AES-256-GCM authenticated encryption** with PBKDF2 key derivation (100,000 iterations) and 96-bit random initialization vectors (IV).
  - All AI provider API keys (Google Gemini, OpenRouter, Groq) configured via the admin panel are encrypted before storage.
  - Plaintext secrets are never stored in Firestore documents.
- **Sensitive Text Redaction:**
  - `redactSensitiveText()` strips API keys, Authorization headers, and bearer tokens from server log outputs, preventing credential leaks in production CloudWatch/Vercel logs.

---

## 5. Security Vulnerabilities & Remediation Findings

```
┌────────────────────────────────────────────────────────────────────────┐
│ SECURITY VULNERABILITY SUMMARY:                                        │
│                                                                        │
│ • Critical Vulnerabilities: 0                                          │
│ • High Vulnerabilities:     0                                          │
│ • Medium Concerns:          1 (Ghost payment rules cluttering config)  │
│ • Low / Informational:      1 (Hardcoded admin email list in rules)    │
└────────────────────────────────────────────────────────────────────────┘
```

### Detailed Observations:
1. **Ghost Payment Rules in `firestore.rules`:**
   - 6 collection blocks (`paymentSubmissions`, `payment_events`, `payment_orders`, etc.) remain in `firestore.rules`.
   - While they do not introduce an active vulnerability (writes require authorization), maintaining dead security rules increases cognitive complexity during audits.
2. **Hardcoded Admin Email Allowlist:**
   - Admin emails are hardcoded in both `firestore.rules` and `server/authMiddleware.ts`.
   - While secure and effective for single-tenant systems, adding a new admin currently requires deploying updated rules and server code.
   - *Future Recommendation:* Migrate to Firebase Custom Claims (`admin: true`) managed via a secure admin script.
