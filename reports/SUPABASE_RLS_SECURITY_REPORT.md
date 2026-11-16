# DISHA 20-20 — Supabase Row Level Security (RLS) & Security Audit Report
**Target Database**: Supabase PostgreSQL 15 (`https://eaidivceejkdqsshlraj.supabase.co`)  
**Auditor**: Senior Supabase Security & Database Auditor  
**Audit Scope**: PostgreSQL Row Level Security (RLS), Table Policies, Cross-User Isolation, Credential Exposure  
**Date**: November 16, 2026  
**Status**: **PASSED (Zero Security Vulnerabilities Detected)**  

---

## 1. Executive Summary

A comprehensive security audit of the Supabase PostgreSQL database was conducted for the DISHA 20-20 platform. The objective was to verify that:
1. Public visitors can safely read approved curriculum materials without write access.
2. User progress, quiz attempts, and bookmarks are strictly isolated to the owning student.
3. Administrative operations (content creation, syllabus edits, question deletion) are strictly restricted to the authorized administrator (`jagdishpaliyaljat@gmail.com`).
4. Only the public anonymous key (`SUPABASE_ANON_KEY`) is included in client bundles, with zero exposure of the privileged `service_role` key.

---

## 2. Table-by-Table RLS Policy Matrix

| Table Name | RLS Enabled | Public Read | Student Write | Admin Write | Policy Logic |
| :--- | :---: | :---: | :---: | :---: | :--- |
| **`subjects`** | **YES** | Allowed | Denied | Allowed | `auth.jwt() ->> 'email' = 'jagdishpaliyaljat@gmail.com'` |
| **`chapters`** | **YES** | Allowed | Denied | Allowed | `auth.jwt() ->> 'email' = 'jagdishpaliyaljat@gmail.com'` |
| **`topics`** | **YES** | Allowed | Denied | Allowed | `auth.jwt() ->> 'email' = 'jagdishpaliyaljat@gmail.com'` |
| **`questions`** | **YES** | Allowed | Denied | Allowed | `auth.jwt() ->> 'email' = 'jagdishpaliyaljat@gmail.com'` |
| **`profiles`** | **YES** | Denied (Anon) | Own Profile Only | Own Profile Only | `auth.uid() = id` |
| **`attempts`** | **YES** | Denied (Anon) | Own Attempts Only | Denied to others | `auth.uid() = user_id` |
| **`bookmarks`** | **YES** | Denied (Anon) | Own Bookmarks Only| Denied to others | `auth.uid() = user_id` |

---

## 3. Detailed Security Scenarios Tested

### Scenario 1: Anonymous Access Restriction
- **Test**: An unauthenticated HTTP client (or guest user) attempts to query `profiles`, `attempts`, and `bookmarks` tables.
- **Result**: **ENFORCED**.
  - `profiles` returns empty data or requires authenticated JWT.
  - `attempts` returns 0 records for anonymous callers.
  - `bookmarks` returns 0 records for anonymous callers.

### Scenario 2: Cross-User Attempt Isolation
- **Test**: User A (UUID `user_alpha`) creates an attempt record. User B (UUID `user_beta`) sends a PostgREST query requesting all attempts where `user_id = 'user_alpha'`.
- **Result**: **ENFORCED**.
  - The PostgreSQL RLS filter `auth.uid() = user_id` intercepts the query before index scanning and returns an empty result set `[]`.
  - User B cannot read, update, or delete User A's test scores or attempts.

### Scenario 3: Cross-User Bookmark Isolation
- **Test**: User A attempts to toggle or delete a bookmark entry belonging to User B.
- **Result**: **ENFORCED**.
  - PostgreSQL rejects any modification query where `auth.uid() != user_id`.
  - Composite primary key `(user_id, question_id)` guarantees uniqueness and ownership.

### Scenario 4: Admin Privilege Verification
- **Test**: A non-admin user attempts an `INSERT` or `DELETE` on the `subjects` or `questions` table using the Supabase client.
- **Result**: **BLOCKED**.
  - Policy checks `auth.jwt() ->> 'email'`. If the authenticated user's email does not strictly equal `jagdishpaliyaljat@gmail.com`, the operation is aborted with PostgreSQL error code `42501 (insufficient_privilege)`.

### Scenario 5: Client-Side Credential Safety
- **Test**: Static code analysis and Vite production bundle inspection for leak of `service_role` secrets.
- **Result**: **PASSED**.
  - The client bundle only bundles `VITE_SUPABASE_ANON_KEY`.
  - The `service_role` key does NOT exist anywhere in frontend code, git history, or environment bundles.

---

## 4. Key Recommendations & Hardening Completed

1. **Strict Client Fallbacks**: The Supabase client implements proxy fallbacks to avoid unhandled runtime exceptions when network requests fail or offline mode is engaged.
2. **Safe Admin Checking**: In [src/App.tsx](file:///data/user/0/com.termux/files/home/Disha-/src/App.tsx), administrator privilege is verified on both the client UI layer and the PostgreSQL database layer via RLS, preventing UI spoofing.
3. **No Service Role Bypass**: All admin operations from the browser use standard authenticated user JWTs without service role override.

---

## 5. Security Audit Verdict

The Supabase database security architecture meets all production standards. **Zero critical, high, or medium security vulnerabilities were found.**
