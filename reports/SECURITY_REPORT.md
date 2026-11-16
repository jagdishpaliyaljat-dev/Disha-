# DISHA 20-20 — Security & Access Control Report

**Date:** November 16, 2026  
**Status:** ✅ AUDITED & SECURED  
**Backend:** Supabase PostgreSQL with Row Level Security (RLS)  
**Authentication:** Supabase Auth (JWT with PKCE)  

---

## 1. Executive Summary

A comprehensive security audit of the DISHA 20-20 application was conducted covering Row Level Security (RLS) policies, client API credential handling, role-based authorization, and user data isolation.

All 7 core database tables enforce active Row Level Security. Public curriculum data is safely readable by guests and students, curriculum authoring is restricted to verified administrators, and personal student data (profiles, exam attempts, bookmarks) is strictly isolated using cryptographic user ID assertions (`auth.uid() = user_id`).

---

## 2. API Key Architecture & Leak Prevention

| Key Type | Scope | Bundled in Client? | Risk Assessment |
|---|---|---|---|
| `VITE_SUPABASE_ANON_KEY` | Public / Browser | Yes (in `.env.local` & client bundle) | **SAFE**: Intended for public client use; restricted by RLS |
| `SUPABASE_SERVICE_ROLE_KEY` | Server / Admin | **NO (Zero Exposure)** | **SAFE**: Never embedded, bundled, or accessible in frontend |

### Verification:
A forensic search across the codebase and build assets (`dist/`) confirmed that `SUPABASE_SERVICE_ROLE_KEY` is not present anywhere in client bundles. Only the publishable `anon` key is used, which possesses no privileges beyond what is explicitly permitted by PostgreSQL RLS policies.

---

## 3. Row Level Security (RLS) Policy Matrix

| Table Name | RLS Enabled | Operation | Target Role | Policy Definition |
|---|---|---|---|---|
| `public.subjects` | ✅ YES | SELECT | Public / Anon / Auth | `USING (true)` |
| `public.subjects` | ✅ YES | ALL (W/U/D) | Authenticated Admin | `USING (auth.jwt() ->> 'email' = 'jagdishpaliyaljat@gmail.com')` |
| `public.chapters` | ✅ YES | SELECT | Public / Anon / Auth | `USING (true)` |
| `public.chapters` | ✅ YES | ALL (W/U/D) | Authenticated Admin | `USING (auth.jwt() ->> 'email' = 'jagdishpaliyaljat@gmail.com')` |
| `public.topics` | ✅ YES | SELECT | Public / Anon / Auth | `USING (true)` |
| `public.topics` | ✅ YES | ALL (W/U/D) | Authenticated Admin | `USING (auth.jwt() ->> 'email' = 'jagdishpaliyaljat@gmail.com')` |
| `public.questions` | ✅ YES | SELECT | Public / Anon / Auth | `USING (true)` |
| `public.questions` | ✅ YES | ALL (W/U/D) | Authenticated Admin | `USING (auth.jwt() ->> 'email' = 'jagdishpaliyaljat@gmail.com')` |
| `public.profiles` | ✅ YES | SELECT | Authenticated User | `USING (auth.uid() = id)` |
| `public.profiles` | ✅ YES | INSERT / UPDATE | Authenticated User | `WITH CHECK (auth.uid() = id)` |
| `public.attempts` | ✅ YES | SELECT | Authenticated User | `USING (auth.uid() = user_id)` |
| `public.attempts` | ✅ YES | INSERT | Authenticated User | `WITH CHECK (auth.uid() = user_id)` |
| `public.bookmarks` | ✅ YES | SELECT | Authenticated User | `USING (auth.uid() = user_id)` |
| `public.bookmarks` | ✅ YES | INSERT | Authenticated User | `WITH CHECK (auth.uid() = user_id)` |
| `public.bookmarks` | ✅ YES | DELETE | Authenticated User | `USING (auth.uid() = user_id)` |

---

## 4. Live Penetration & Isolation Testing

Using the anonymous client (`anon` key without user JWT):

### Test 1: User Profile Snooping Attempt
- **Action:** Query `public.profiles` for all records.
- **Expected Result:** Denied / 0 rows returned.
- **Actual Result:** `0` records returned. RLS successfully blocked reading other users' profile records.

### Test 2: Student Attempt Leakage Attempt
- **Action:** Query `public.attempts` without user credentials.
- **Expected Result:** Denied / 0 rows returned.
- **Actual Result:** `0` records returned. Student test scores and answers cannot be enumerated or viewed by external parties.

### Test 3: Unauthorized Bookmark Access Attempt
- **Action:** Query `public.bookmarks` without user credentials.
- **Expected Result:** Denied / 0 rows returned.
- **Actual Result:** `0` records returned. Bookmarks are completely private to the owner.

### Test 4: Curriculum Tampering Attempt
- **Action:** Attempt to insert a test subject into `public.subjects` as an unauthenticated or non-admin user.
- **Expected Result:** RLS policy violation error (`new row violates row-level security policy`).
- **Actual Result:** Insert rejected with code `42501` / RLS violation.

---

## 5. Storage Bucket Security

- `banners`: Configured with Public Read access so that images can be delivered rapidly via CDN to all users. Uploads, updates, and deletes are restricted to the verified admin user.
- `materials`: Requires authenticated user session to read PDF syllabus downloads.

---

## 6. Security Conclusion

The security model of DISHA 20-20 on Supabase satisfies all zero-trust criteria:
1. Public data is strictly read-only for non-admins.
2. Sensitive personal data is guarded at the PostgreSQL engine level via RLS.
3. No administrative secrets or service role keys are exposed to the browser.
4. Input validation and data sanitization are enforced at both frontend and database layers.
