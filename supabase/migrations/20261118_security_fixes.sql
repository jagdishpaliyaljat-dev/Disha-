-- ============================================================================
-- DISHA 20-20: Security Hardening & Live DB RLS Parity Migration
-- Migration: 20261118_security_fixes.sql
-- Date: 2026-11-18
-- Target: Supabase PostgreSQL 17.12 (eaidivceejkdqsshlraj)
-- ============================================================================
-- IMPORTANT:
-- This migration hardens database access control, eliminates client-side
-- privilege escalation vectors, protects profiles against tampering,
-- and grants administrators proper visibility while keeping student data isolated.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. HARDENED is_admin() FUNCTION
-- ----------------------------------------------------------------------------
-- Security Note:
-- We REMOVE all client-controlled user_metadata checks and do NOT depend on
-- unverified or non-standard JWT claims. We strictly check the server-controlled
-- app_metadata.role = 'admin' claim in the verified cryptographic JWT.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT COALESCE(
    (auth.jwt() -> 'app_metadata' ->> 'role' = 'admin'),
    false
  );
$$;

REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin() TO anon, authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 2. SECURE PROFILES ROLE & ATTRIBUTE GUARD TRIGGER
-- ----------------------------------------------------------------------------
-- Even if an authenticated user attempts to send { role: 'admin' }, { id: '...' },
-- or forged { created_at: '...' }, this BEFORE UPDATE trigger intercepts and
-- neutralizes the change before writing to disk. Only an admin can change roles.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_profile_security_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- 1. Disallow changing the primary key ID
  IF NEW.id IS DISTINCT FROM OLD.id THEN
    RAISE EXCEPTION 'Modifying user profile ID is strictly forbidden';
  END IF;

  -- 2. Disallow students/non-admins from elevating their role
  IF NEW.role IS DISTINCT FROM OLD.role AND NOT public.is_admin() THEN
    NEW.role := OLD.role;
  END IF;

  -- 3. Prevent tampering with original registration timestamp
  IF NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    NEW.created_at := OLD.created_at;
  END IF;

  -- 4. Auto-update timestamp
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profile_security_guard ON public.profiles;
CREATE TRIGGER trg_profile_security_guard
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_profile_security_guard();

-- ----------------------------------------------------------------------------
-- 3. PROFILES POLICIES (Hardened UPDATE with check, Admin Read, Admin Delete)
-- ----------------------------------------------------------------------------
-- Drop existing loose/restrictive policies
DROP POLICY IF EXISTS "Profiles updateable" ON public.profiles;
DROP POLICY IF EXISTS "Profiles updateable by owner" ON public.profiles;
DROP POLICY IF EXISTS "Profiles viewable" ON public.profiles;
DROP POLICY IF EXISTS "Profiles are viewable by owner" ON public.profiles;
DROP POLICY IF EXISTS "Admins can delete profiles" ON public.profiles;

-- Owner can update own profile, but cannot change role unless admin
CREATE POLICY "Profiles updateable"
ON public.profiles
FOR UPDATE
USING ((SELECT auth.uid()) = id)
WITH CHECK (
  (SELECT auth.uid()) = id
  AND (
    role = (SELECT p.role FROM public.profiles p WHERE p.id = (SELECT auth.uid()))
    OR public.is_admin()
  )
);

-- Owner can view own profile; Admins can view all student profiles for management
CREATE POLICY "Profiles viewable"
ON public.profiles
FOR SELECT
USING ((SELECT auth.uid()) = id OR public.is_admin());

-- Only Administrators can delete user profiles
CREATE POLICY "Admins can delete profiles"
ON public.profiles
FOR DELETE
USING (public.is_admin());

-- ----------------------------------------------------------------------------
-- 4. BOOKMARKS POLICIES (Add UPDATE policy for safe upsert & Admin Read)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users bookmarks" ON public.bookmarks;
DROP POLICY IF EXISTS "Users can view own bookmarks" ON public.bookmarks;
DROP POLICY IF EXISTS "Users can insert own bookmarks" ON public.bookmarks;
DROP POLICY IF EXISTS "Users can update own bookmarks" ON public.bookmarks;
DROP POLICY IF EXISTS "Users can delete own bookmarks" ON public.bookmarks;

CREATE POLICY "Users can view own bookmarks"
ON public.bookmarks
FOR SELECT
USING ((SELECT auth.uid()) = user_id OR public.is_admin());

CREATE POLICY "Users can insert own bookmarks"
ON public.bookmarks
FOR INSERT
WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can update own bookmarks"
ON public.bookmarks
FOR UPDATE
USING ((SELECT auth.uid()) = user_id)
WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can delete own bookmarks"
ON public.bookmarks
FOR DELETE
USING ((SELECT auth.uid()) = user_id OR public.is_admin());

-- ----------------------------------------------------------------------------
-- 5. ATTEMPTS POLICIES (Immutable Student Log + Admin Read Visibility)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users attempts" ON public.attempts;
DROP POLICY IF EXISTS "Users can insert own attempts" ON public.attempts;
DROP POLICY IF EXISTS "Users can view own attempts" ON public.attempts;
DROP POLICY IF EXISTS "Admins can view all attempts" ON public.attempts;

CREATE POLICY "Users can insert own attempts"
ON public.attempts
FOR INSERT
WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can view own attempts"
ON public.attempts
FOR SELECT
USING ((SELECT auth.uid()) = user_id OR public.is_admin());

CREATE POLICY "Admins can delete attempts"
ON public.attempts
FOR DELETE
USING (public.is_admin());

-- ----------------------------------------------------------------------------
-- 6. QUESTIONS POLICY (Protect unverified draft questions from public)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Public Read Questions" ON public.questions;
CREATE POLICY "Public Read Questions"
ON public.questions
FOR SELECT
USING (COALESCE(verified, true) = true OR public.is_admin());

-- ----------------------------------------------------------------------------
-- 7. QUESTION REPORTS TABLE & POLICIES (Students view own grievances)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.question_reports (
    id TEXT PRIMARY KEY,
    question_id TEXT REFERENCES public.questions(id) ON DELETE SET NULL,
    question_text TEXT,
    subject_name TEXT,
    chapter_name TEXT,
    topic_name TEXT,
    student_name TEXT,
    student_email TEXT,
    student_uid UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    issue_type TEXT NOT NULL,
    student_comment TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'resolved', 'dismissed')),
    admin_notes TEXT,
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.question_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can submit question report" ON public.question_reports;
DROP POLICY IF EXISTS "Students can view own reports" ON public.question_reports;
DROP POLICY IF EXISTS "Admins can update reports" ON public.question_reports;
DROP POLICY IF EXISTS "Admins can delete reports" ON public.question_reports;

CREATE POLICY "Anyone can submit question report"
ON public.question_reports
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Students can view own reports"
ON public.question_reports
FOR SELECT
USING ((SELECT auth.uid()) = student_uid OR public.is_admin());

CREATE POLICY "Admins can update reports"
ON public.question_reports
FOR UPDATE
USING (public.is_admin())
WITH CHECK (public.is_admin());

CREATE POLICY "Admins can delete reports"
ON public.question_reports
FOR DELETE
USING (public.is_admin());

GRANT SELECT, INSERT ON TABLE public.question_reports TO anon, authenticated;
GRANT UPDATE, DELETE ON TABLE public.question_reports TO authenticated;

-- ----------------------------------------------------------------------------
-- 8. PERFORMANCE LINTER: DROP DUPLICATE INDEX ON ATTEMPTS
-- ----------------------------------------------------------------------------
DROP INDEX IF EXISTS public.idx_attempts_user_created_at;

-- ----------------------------------------------------------------------------
-- 9. AUTOMATED PROFILE SYNC TRIGGER (auth.users -> public.profiles)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name, photo_url, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url',
    CASE
      WHEN NEW.raw_app_meta_data->>'role' = 'admin' THEN 'admin'
      ELSE 'student'
    END
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    role = CASE WHEN NEW.raw_app_meta_data->>'role' = 'admin' THEN 'admin' ELSE profiles.role END;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Backfill any existing user in auth.users missing from public.profiles
INSERT INTO public.profiles (id, email, display_name, role)
SELECT 
  u.id, 
  u.email, 
  COALESCE(u.raw_user_meta_data->>'full_name', split_part(u.email, '@', 1)),
  CASE 
    WHEN u.raw_app_meta_data->>'role' = 'admin' THEN 'admin'
    ELSE 'student'
  END
FROM auth.users u
LEFT JOIN public.profiles p ON u.id = p.id
WHERE p.id IS NULL
ON CONFLICT (id) DO NOTHING;

-- ----------------------------------------------------------------------------
-- 10. STORAGE BUCKETS (BANNERS & MATERIALS) WITH SIZE & MIME LIMITS
-- ----------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'banners',
    'banners',
    true,
    2097152, -- 2MB max
    ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']
)
ON CONFLICT (id) DO UPDATE SET
    public = true,
    file_size_limit = 2097152,
    allowed_mime_types = ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'materials',
    'materials',
    false,
    10485760, -- 10MB max
    ARRAY['application/pdf', 'image/png', 'image/jpeg']
)
ON CONFLICT (id) DO UPDATE SET
    public = false,
    file_size_limit = 10485760,
    allowed_mime_types = ARRAY['application/pdf', 'image/png', 'image/jpeg'];

-- Storage RLS Policies
DROP POLICY IF EXISTS "Public Read Banners" ON storage.objects;
DROP POLICY IF EXISTS "Admin All Banners" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Read Materials" ON storage.objects;
DROP POLICY IF EXISTS "Admin All Materials" ON storage.objects;

CREATE POLICY "Public Read Banners" ON storage.objects FOR SELECT USING (bucket_id = 'banners');
CREATE POLICY "Admin All Banners" ON storage.objects FOR ALL USING (bucket_id = 'banners' AND public.is_admin());
CREATE POLICY "Authenticated Read Materials" ON storage.objects FOR SELECT USING (bucket_id = 'materials' AND auth.role() = 'authenticated');
CREATE POLICY "Admin All Materials" ON storage.objects FOR ALL USING (bucket_id = 'materials' AND public.is_admin());

