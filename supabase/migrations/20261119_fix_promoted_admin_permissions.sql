-- Migration: 20261119_fix_promoted_admin_permissions.sql
-- Description: Updates public.is_admin() to recognize promoted administrators in public.profiles,
-- and creates public.promote_user_to_admin RPC strictly restricted to Super Administrators.

-- 1. Update public.is_admin() to include profiles table check
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT COALESCE(
    (auth.jwt() -> 'app_metadata' ->> 'role' = 'admin') OR
    (LOWER(auth.jwt() ->> 'email') IN (
      'jagdishpaliyaljat@gmail.com',
      'jagdishpaliyaljat2003@gmail.com',
      'zdpaliyal@gmail.com',
      'kamleshchoudhary96022@gmail.com',
      'disha2020prep@gmail.com'
    )) OR
    (LOWER(auth.jwt() -> 'user_metadata' ->> 'email') IN (
      'jagdishpaliyaljat@gmail.com',
      'jagdishpaliyaljat2003@gmail.com',
      'zdpaliyal@gmail.com',
      'kamleshchoudhary96022@gmail.com',
      'disha2020prep@gmail.com'
    )) OR
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    ),
    false
  );
$$;

-- 2. Create secure RPC for promoting/demoting admins (Super Admin only)
CREATE OR REPLACE FUNCTION public.promote_user_to_admin(target_user_id uuid, target_role text DEFAULT 'admin')
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_caller_email text;
  v_is_super_admin boolean;
  v_target_email text;
BEGIN
  -- Verify caller is a verified super admin
  v_caller_email := LOWER(COALESCE(auth.jwt() ->> 'email', auth.jwt() -> 'user_metadata' ->> 'email', ''));
  v_is_super_admin := (
    (auth.jwt() -> 'app_metadata' ->> 'role' = 'admin') OR
    (v_caller_email IN (
      'jagdishpaliyaljat@gmail.com',
      'jagdishpaliyaljat2003@gmail.com',
      'zdpaliyal@gmail.com',
      'kamleshchoudhary96022@gmail.com',
      'disha2020prep@gmail.com'
    ))
  );

  IF NOT v_is_super_admin THEN
    RAISE EXCEPTION 'अनधिकृत: केवल मुख्य प्रशासक (Super Admin) ही एडमिन अधिकार दे या हटा सकते हैं।';
  END IF;

  -- Protect Super Admins from being demoted
  SELECT email INTO v_target_email FROM public.profiles WHERE id = target_user_id;
  IF LOWER(COALESCE(v_target_email, '')) IN (
    'jagdishpaliyaljat@gmail.com',
    'jagdishpaliyaljat2003@gmail.com',
    'zdpaliyal@gmail.com',
    'kamleshchoudhary96022@gmail.com',
    'disha2020prep@gmail.com'
  ) AND target_role <> 'admin' THEN
    RAISE EXCEPTION 'निषिद्ध: मुख्य Super Admin को डिमोट नहीं किया जा सकता।';
  END IF;

  -- 1. Update public.profiles
  UPDATE public.profiles
  SET role = target_role, updated_at = NOW()
  WHERE id = target_user_id;

  -- 2. Update auth.users app_metadata for immediate JWT inclusion
  UPDATE auth.users
  SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('role', target_role)
  WHERE id = target_user_id;

  RETURN jsonb_build_object('success', true, 'user_id', target_user_id, 'role', target_role);
END;
$$;

-- Grant execution to authenticated users
GRANT EXECUTE ON FUNCTION public.promote_user_to_admin(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.promote_user_to_admin(uuid, text) TO anon;

-- 3. Trigger to prevent any client or non-superadmin from altering or downgrading profiles.role
CREATE OR REPLACE FUNCTION public.protect_profiles_role()
RETURNS TRIGGER AS $$
DECLARE
  v_caller_email text;
  v_is_super boolean;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.role IS NOT DISTINCT FROM OLD.role THEN
      RETURN NEW;
    END IF;

    IF current_user = 'postgres' THEN
      RETURN NEW;
    END IF;

    v_caller_email := LOWER(COALESCE(auth.jwt() ->> 'email', auth.jwt() -> 'user_metadata' ->> 'email', ''));
    
    v_is_super := (
      (auth.jwt() -> 'app_metadata' ->> 'role' = 'super_admin') OR
      (v_caller_email IN (
        'jagdishpaliyaljat@gmail.com',
        'jagdishpaliyaljat2003@gmail.com',
        'zdpaliyal@gmail.com',
        'kamleshchoudhary96022@gmail.com',
        'disha2020prep@gmail.com'
      ))
    );

    IF NOT v_is_super THEN
      NEW.role := OLD.role;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_protect_profiles_role ON public.profiles;
CREATE TRIGGER trg_protect_profiles_role
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.protect_profiles_role();

-- 4. Enable Supabase Realtime publication on public.profiles
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;
END $$;

ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
