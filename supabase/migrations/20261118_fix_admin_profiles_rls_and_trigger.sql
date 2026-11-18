-- Migration: 20261118_fix_admin_profiles_rls_and_trigger.sql
-- Description: Enables Admin full visibility & management over student profiles, test attempts,
-- and bookmarks via public.is_admin(), adds automated auth.users -> public.profiles trigger,
-- and backfills missing metadata columns (status, blocked, target_exam, etc.).

-- 1. Ensure columns exist on public.profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS status text DEFAULT 'active';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS blocked boolean DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS target_exam text DEFAULT 'Competitive Exams';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS daily_goal_questions integer DEFAULT 30;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS streak_days integer DEFAULT 0;

-- 2. Update is_admin function to recognize all verified admin emails and roles
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
      'zdpaliyal@gmail.com',
      'kamleshchoudhary96022@gmail.com',
      'disha2020prep@gmail.com'
    )) OR
    (LOWER(auth.jwt() -> 'user_metadata' ->> 'email') IN (
      'jagdishpaliyaljat@gmail.com',
      'zdpaliyal@gmail.com',
      'kamleshchoudhary96022@gmail.com',
      'disha2020prep@gmail.com'
    )),
    false
  );
$$;

-- 3. Configure RLS policies on public.profiles to allow Admins full visibility & management
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Profiles viewable" ON public.profiles;
DROP POLICY IF EXISTS "Profiles are viewable by owner" ON public.profiles;
CREATE POLICY "Profiles viewable" ON public.profiles 
FOR SELECT 
USING (
  (auth.uid() = id) OR public.is_admin()
);

DROP POLICY IF EXISTS "Profiles insertable" ON public.profiles;
DROP POLICY IF EXISTS "Profiles insertable by owner" ON public.profiles;
CREATE POLICY "Profiles insertable" ON public.profiles 
FOR INSERT 
WITH CHECK (
  (auth.uid() = id) OR public.is_admin()
);

DROP POLICY IF EXISTS "Profiles updateable" ON public.profiles;
DROP POLICY IF EXISTS "Profiles updateable by owner" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update profiles" ON public.profiles;
CREATE POLICY "Profiles updateable" ON public.profiles 
FOR UPDATE 
USING (
  (auth.uid() = id) OR public.is_admin()
)
WITH CHECK (
  (auth.uid() = id) OR public.is_admin()
);

DROP POLICY IF EXISTS "Profiles deleteable" ON public.profiles;
DROP POLICY IF EXISTS "Admins can delete profiles" ON public.profiles;
CREATE POLICY "Profiles deleteable" ON public.profiles 
FOR DELETE 
USING (
  public.is_admin()
);

-- 4. Configure RLS policies on attempts & bookmarks so Admins can inspect student performance
ALTER TABLE public.attempts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users attempts" ON public.attempts;
DROP POLICY IF EXISTS "Attempts are viewable by owner" ON public.attempts;
CREATE POLICY "Users attempts" ON public.attempts
FOR ALL
USING (
  (auth.uid() = user_id) OR public.is_admin()
)
WITH CHECK (
  (auth.uid() = user_id) OR public.is_admin()
);

ALTER TABLE public.bookmarks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users bookmarks" ON public.bookmarks;
DROP POLICY IF EXISTS "Bookmarks are viewable by owner" ON public.bookmarks;
CREATE POLICY "Users bookmarks" ON public.bookmarks
FOR ALL
USING (
  (auth.uid() = user_id) OR public.is_admin()
)
WITH CHECK (
  (auth.uid() = user_id) OR public.is_admin()
);

-- 5. Create automated auth trigger to ensure every login/signup is immediately in public.profiles
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_display_name text;
  v_photo_url text;
  v_role text;
  v_email text;
BEGIN
  v_email := LOWER(COALESCE(NEW.email, ''));
  v_display_name := COALESCE(
    NULLIF(TRIM(NEW.raw_user_meta_data->>'full_name'), ''),
    NULLIF(TRIM(NEW.raw_user_meta_data->>'name'), ''),
    NULLIF(split_part(NEW.email, '@', 1), ''),
    'Student'
  );
  v_photo_url := COALESCE(
    NEW.raw_user_meta_data->>'avatar_url',
    NEW.raw_user_meta_data->>'picture',
    ''
  );
  IF v_email IN (
    'jagdishpaliyaljat@gmail.com',
    'zdpaliyal@gmail.com',
    'kamleshchoudhary96022@gmail.com',
    'disha2020prep@gmail.com'
  ) OR (NEW.raw_app_meta_data->>'role' = 'admin') THEN
    v_role := 'admin';
  ELSE
    v_role := 'student';
  END IF;

  INSERT INTO public.profiles (id, email, display_name, photo_url, role, updated_at)
  VALUES (
    NEW.id,
    NEW.email,
    v_display_name,
    v_photo_url,
    v_role,
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    display_name = CASE 
      WHEN profiles.display_name IS NULL OR profiles.display_name = '' OR profiles.display_name = 'Student' OR profiles.display_name = 'User'
      THEN EXCLUDED.display_name
      ELSE profiles.display_name
    END,
    photo_url = CASE 
      WHEN profiles.photo_url IS NULL OR profiles.photo_url = '' 
      THEN EXCLUDED.photo_url 
      ELSE profiles.photo_url 
    END,
    role = CASE
      WHEN v_role = 'admin' THEN 'admin'
      ELSE profiles.role
    END,
    updated_at = NOW();

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT OR UPDATE ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- 6. Backfill all existing users from auth.users into public.profiles
INSERT INTO public.profiles (id, email, display_name, photo_url, role, created_at, updated_at)
SELECT
  u.id,
  u.email,
  COALESCE(
    NULLIF(TRIM(u.raw_user_meta_data->>'full_name'), ''),
    NULLIF(TRIM(u.raw_user_meta_data->>'name'), ''),
    NULLIF(split_part(u.email, '@', 1), ''),
    'Student'
  ) AS display_name,
  COALESCE(
    u.raw_user_meta_data->>'avatar_url',
    u.raw_user_meta_data->>'picture',
    ''
  ) AS photo_url,
  CASE
    WHEN LOWER(COALESCE(u.email, '')) IN (
      'jagdishpaliyaljat@gmail.com',
      'zdpaliyal@gmail.com',
      'kamleshchoudhary96022@gmail.com',
      'disha2020prep@gmail.com'
    ) OR (u.raw_app_meta_data->>'role' = 'admin') THEN 'admin'
    ELSE 'student'
  END AS role,
  u.created_at,
  NOW()
FROM auth.users u
ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email,
  display_name = CASE 
    WHEN profiles.display_name IS NULL OR profiles.display_name = '' OR profiles.display_name = 'Student' OR profiles.display_name = 'User'
    THEN EXCLUDED.display_name
    ELSE profiles.display_name
  END,
  photo_url = CASE 
    WHEN profiles.photo_url IS NULL OR profiles.photo_url = '' 
    THEN EXCLUDED.photo_url 
    ELSE profiles.photo_url 
  END,
  role = CASE
    WHEN EXCLUDED.role = 'admin' THEN 'admin'
    ELSE profiles.role
  END,
  updated_at = NOW();
