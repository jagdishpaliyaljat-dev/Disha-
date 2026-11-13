# QUIZPRO Security Specification

## Data Invariants

1. **User Identity & Authorization**: 
   - A user's `role` and `blocked` status are "Immortal Fields" (immutable) for the user themselves. They can only be modified by a verified administrator.
   - The `isAdmin()` check must be server-authoritative, checking against a list of trusted UIDs/Emails or a verified database role.

2. **Curriculum Integrity**:
   - `subjects`, `chapters`, `topics`, and `mcqs` form the core curriculum. 
   - These collections must be **Read-Only** for regular students and visitors.
   - **Write** access (Create, Update, Delete) is strictly reserved for verified administrators.

3. **User Data Privacy**:
   - `users/{userId}`, `users/{userId}/progress`, and `users/{userId}/history` contain PII and private study data.
   - Access is restricted to `isOwner(userId)` or `isAdmin()`.
   - Blanket `list` operations on the root `/users` collection are forbidden for non-admins to prevent email scraping.

4. **Administrative Integrity**:
   - `adminAuditLogs` and `login_attempts` are append-only for the system/admin and must not be editable or deletable by any client.
   - `ai_api_configs` and `_health` are sensitive system configurations and must be Admin-Only for all operations.

5. **Public Contributions**:
   - `contact_messages` allow public `create` (unauthenticated) but restricted `read/write` for admins.
   - `leaderboard` is publicly readable but `write` is restricted to the specific test attempt context.

## The "Dirty Dozen" Payloads (Red Team Targets)

| ID | Targeted Collection | Malicious Payload | Goal |
|---|---|---|---|
| P-01 | `/users/{myUid}` | `{ "role": "admin" }` | Privilege Escalation |
| P-02 | `/mcqs/{id}` | `{ "correctIndex": 1 }` (Update) | Curriculum Sabotage |
| P-03 | `/mcqs/{newId}` | `{ "text": "Hacked", ... }` (Create) | Unauthorized Content Injection |
| P-04 | `/users` | `getDocs(collection(db, 'users'))` | Directory Scraping / PII Leak |
| P-05 | `/users/{otherUid}` | `getDoc(...)` | Privacy Violation |
| P-06 | `/adminAuditLogs/{id}` | `deleteDoc(...)` | Evidence Tampering |
| P-07 | `/users/{myUid}` | `{ "blocked": false }` | Bypassing Administrative Block |
| P-08 | `/ai_api_configs/{id}` | `{ "apiKey": "fake" }` | Infrastructure Hijacking |
| P-09 | `/_health/admin_ping` | `deleteDoc(...)` | Denial of Service (Monitoring) |
| P-10 | `/subjects/{id}` | `deleteDoc(...)` | Data Wipeout |
| P-11 | `/adminAuditLogs/{newId}`| `{ "action": "fake", "adminEmail": "attacker@evil.com" }` | Log Spoofing |
| P-12 | `/leaderboard/{id}` | `{ "score": 9999 }` (Unauthorized Update) | Competitive Integrity Breach |

## Test Runner Verification (Simulated)

All Dirty Dozen payloads must return `PERMISSION_DENIED`.
Verified administrators must be able to perform legitimate operations (CRUD on curriculum, reading logs).
Students must be able to read curriculum and manage their own progress.
