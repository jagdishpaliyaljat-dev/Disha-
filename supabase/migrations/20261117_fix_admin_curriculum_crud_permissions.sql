-- ============================================================================
-- DISHA 20-20 — Admin Curriculum CRUD Permission & Authorization Fix
-- File: supabase/migrations/20261117_fix_admin_curriculum_crud_permissions.sql
-- ============================================================================
-- Purpose:
-- 1. Hardens public.is_admin() to recognize verified administrator emails
--    (jagdishpaliyaljat@gmail.com, zdpaliyal@gmail.com) directly from JWT claims
--    in addition to app_metadata.role = 'admin'.
-- 2. Ensures administrators can add, update, and delete subjects, chapters,
--    topics, and questions without being blocked by RLS.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT COALESCE(
    (auth.jwt() -> 'app_metadata' ->> 'role' = 'admin') OR
    (LOWER(auth.jwt() ->> 'email') IN ('jagdishpaliyaljat@gmail.com', 'zdpaliyal@gmail.com')),
    false
  );
$$;

REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin() TO anon, authenticated, service_role;

-- Verification
SELECT proname, prosrc FROM pg_proc WHERE proname = 'is_admin';
