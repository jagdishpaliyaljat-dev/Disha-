-- ============================================================================
-- DISHA 20-20 — Administrator Provisioning Script
-- File: supabase/migrations/20261116_provision_admin_app_metadata.sql
-- ============================================================================
-- Purpose: Safely provisions server-controlled app_metadata.role = 'admin'
-- in auth.users for verified project administrators.
--
-- Security Notes:
-- 1. app_metadata is strictly server-controlled; clients cannot modify it.
-- 2. Once executed, existing logged-in sessions must REFRESH their session or
--    SIGN IN AGAIN to receive an updated cryptographic JWT containing the claim.
-- 3. Only the explicit project administrator accounts authorized by the owner
--    are targeted.
-- ============================================================================

DO $$
DECLARE
  v_target_email text := 'jagdishpaliyaljat@gmail.com';
  v_user_count integer;
BEGIN
  -- 1. Verify existence of the target administrator account in auth.users
  SELECT COUNT(*) INTO v_user_count 
  FROM auth.users 
  WHERE email = v_target_email;

  IF v_user_count = 0 THEN
    RAISE NOTICE 'Target user % not found in auth.users. The user must first sign up via Supabase Auth before this script is executed.', v_target_email;
  ELSE
    -- 2. Safely merge role = 'admin' into server-controlled raw_app_meta_data
    UPDATE auth.users 
    SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || '{"role": "admin"}'::jsonb 
    WHERE email = v_target_email;

    RAISE NOTICE 'Successfully provisioned app_metadata.role = "admin" for % (Affected rows: %)', v_target_email, v_user_count;
  END IF;
END $$;

-- Verification query (Read-Only) to confirm provisioning
SELECT 
  id, 
  email, 
  raw_app_meta_data ->> 'role' AS provisioned_role,
  last_sign_in_at
FROM auth.users 
WHERE email = 'jagdishpaliyaljat@gmail.com';
