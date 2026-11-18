-- ============================================================================
-- DISHA 20-20: Admin Role Provisioning Script (Run via Supabase SQL Editor)
-- File: supabase/set_admin_role.sql
-- ============================================================================
-- Instructions:
-- 1. Open your Supabase Dashboard: https://supabase.com/dashboard/project/eaidivceejkdqsshlraj/sql
-- 2. Paste this entire script into the SQL Editor.
-- 3. Click "RUN".
-- 4. Log out and log back in (or refresh session) in the Disha app on all admin devices.
-- ============================================================================

DO $$
DECLARE
  v_admin_emails text[] := ARRAY[
    'jagdishpaliyaljat@gmail.com',
    'zdpaliyal@gmail.com',
    'kamleshchoudhary96022@gmail.com',
    'disha2020prep@gmail.com'
  ];
  v_email text;
  v_count integer;
BEGIN
  FOREACH v_email IN ARRAY v_admin_emails LOOP
    -- Check if user exists in auth.users
    SELECT COUNT(*) INTO v_count FROM auth.users WHERE LOWER(email) = LOWER(v_email);
    
    IF v_count > 0 THEN
      -- 1. Safely update server-controlled raw_app_meta_data in auth.users
      UPDATE auth.users
      SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || '{"role": "admin"}'::jsonb
      WHERE LOWER(email) = LOWER(v_email);

      -- 2. Update public.profiles role to match
      UPDATE public.profiles
      SET role = 'admin'
      WHERE LOWER(email) = LOWER(v_email);

      RAISE NOTICE 'SUCCESS: Granted app_metadata.role = "admin" to %', v_email;
    ELSE
      RAISE NOTICE 'SKIPPED: User % not found in auth.users (Must sign up first)', v_email;
    END IF;
  END LOOP;
END $$;

-- ----------------------------------------------------------------------------
-- VERIFICATION QUERY (Read-Only: Verify provisioned admins)
-- ----------------------------------------------------------------------------
SELECT 
  id, 
  email, 
  raw_app_meta_data ->> 'role' AS app_metadata_role,
  last_sign_in_at
FROM auth.users
WHERE LOWER(email) IN (
  'jagdishpaliyaljat@gmail.com',
  'zdpaliyal@gmail.com',
  'kamleshchoudhary96022@gmail.com',
  'disha2020prep@gmail.com'
);
