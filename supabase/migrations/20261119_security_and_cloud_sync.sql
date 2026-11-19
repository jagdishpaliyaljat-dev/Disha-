-- Migration: 20261119_security_and_cloud_sync.sql
-- Description: Hardens RLS for live_tests, live_test_submissions, question_reports,
-- and provisions cloud sync tables with Realtime for banners, pyq_papers, and news_articles.

-- 1. HARDEN live_tests RLS
DROP POLICY IF EXISTS "Live tests insertable by all" ON public.live_tests;
DROP POLICY IF EXISTS "Live tests updatable by all" ON public.live_tests;
DROP POLICY IF EXISTS "Live tests deletable by all" ON public.live_tests;
DROP POLICY IF EXISTS "Live tests viewable by all" ON public.live_tests;

CREATE POLICY "Live tests viewable by all"
  ON public.live_tests FOR SELECT
  USING (true);

CREATE POLICY "Live tests insertable by admin"
  ON public.live_tests FOR INSERT
  WITH CHECK (public.is_admin());

CREATE POLICY "Live tests updatable by admin"
  ON public.live_tests FOR UPDATE
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "Live tests deletable by admin"
  ON public.live_tests FOR DELETE
  USING (public.is_admin());

-- 2. HARDEN live_test_submissions RLS
DROP POLICY IF EXISTS "Live test submissions viewable by all" ON public.live_test_submissions;
DROP POLICY IF EXISTS "Live test submissions insertable by all" ON public.live_test_submissions;
DROP POLICY IF EXISTS "Live test submissions updatable by all" ON public.live_test_submissions;
DROP POLICY IF EXISTS "Live test submissions deletable by all" ON public.live_test_submissions;

CREATE POLICY "Live test submissions viewable by all"
  ON public.live_test_submissions FOR SELECT
  USING (true);

CREATE POLICY "Live test submissions insertable by students"
  ON public.live_test_submissions FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Live test submissions updatable by owner or admin"
  ON public.live_test_submissions FOR UPDATE
  USING (public.is_admin() OR (auth.uid() IS NOT NULL AND auth.uid()::text = user_id))
  WITH CHECK (public.is_admin() OR (auth.uid() IS NOT NULL AND auth.uid()::text = user_id));

CREATE POLICY "Live test submissions deletable only by admin"
  ON public.live_test_submissions FOR DELETE
  USING (public.is_admin());

-- Trigger to safely synchronize live_tests.participant_count
CREATE OR REPLACE FUNCTION public.sync_live_test_participant_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_test_id text;
  v_count int;
BEGIN
  v_test_id := COALESCE(NEW.test_id, OLD.test_id);
  IF v_test_id IS NOT NULL THEN
    SELECT COUNT(*) INTO v_count FROM public.live_test_submissions WHERE test_id = v_test_id;
    UPDATE public.live_tests SET participant_count = v_count WHERE id = v_test_id;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trigger_sync_live_test_participant_count ON public.live_test_submissions;
CREATE TRIGGER trigger_sync_live_test_participant_count
AFTER INSERT OR DELETE OR UPDATE OF test_id ON public.live_test_submissions
FOR EACH ROW
EXECUTE FUNCTION public.sync_live_test_participant_count();

-- 3. HARDEN question_reports RLS
DROP POLICY IF EXISTS "Anyone can insert question reports" ON public.question_reports;
DROP POLICY IF EXISTS "Anyone can read question reports" ON public.question_reports;
DROP POLICY IF EXISTS "Anyone can update question reports" ON public.question_reports;
DROP POLICY IF EXISTS "Anyone can delete question reports" ON public.question_reports;

CREATE POLICY "Students can insert question reports"
  ON public.question_reports FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Only admin can view question reports"
  ON public.question_reports FOR SELECT
  USING (public.is_admin());

CREATE POLICY "Only admin can update question reports"
  ON public.question_reports FOR UPDATE
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "Only admin can delete question reports"
  ON public.question_reports FOR DELETE
  USING (public.is_admin());

-- 4. CREATE public.banners TABLE
CREATE TABLE IF NOT EXISTS public.banners (
  id text PRIMARY KEY,
  title text NOT NULL,
  subtitle text DEFAULT '',
  badge text DEFAULT '',
  color text DEFAULT 'from-[#800020] to-[#3B0613]',
  icon_name text DEFAULT 'Image',
  action_label text DEFAULT '',
  action_tab text,
  image_url text,
  is_active boolean DEFAULT true,
  display_order integer DEFAULT 0,
  created_at timestamptz DEFAULT NOW(),
  updated_at timestamptz DEFAULT NOW()
);

ALTER TABLE public.banners ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Banners viewable by all" ON public.banners;
DROP POLICY IF EXISTS "Banners insertable by admin" ON public.banners;
DROP POLICY IF EXISTS "Banners updatable by admin" ON public.banners;
DROP POLICY IF EXISTS "Banners deletable by admin" ON public.banners;

CREATE POLICY "Banners viewable by all" ON public.banners FOR SELECT USING (true);
CREATE POLICY "Banners insertable by admin" ON public.banners FOR INSERT WITH CHECK (public.is_admin());
CREATE POLICY "Banners updatable by admin" ON public.banners FOR UPDATE USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "Banners deletable by admin" ON public.banners FOR DELETE USING (public.is_admin());

ALTER TABLE public.banners REPLICA IDENTITY FULL;
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.banners;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

-- 5. CREATE public.pyq_papers TABLE
CREATE TABLE IF NOT EXISTS public.pyq_papers (
  id text PRIMARY KEY,
  title text NOT NULL,
  hindi_title text DEFAULT '',
  exam_board text DEFAULT 'RPSC',
  paper_year text DEFAULT '',
  exam_date text,
  category text DEFAULT '',
  description text DEFAULT '',
  hindi_description text,
  duration_minutes integer DEFAULT 180,
  total_marks numeric DEFAULT 200,
  marks_per_question numeric DEFAULT 2,
  negative_marking numeric DEFAULT 0.33,
  question_count integer DEFAULT 0,
  questions jsonb DEFAULT '[]'::jsonb,
  pdf_url text,
  official_key_released boolean DEFAULT false,
  is_published boolean DEFAULT true,
  attempt_stats jsonb DEFAULT '{"totalAttempts": 0, "averageScore": 0, "highestScore": 0}'::jsonb,
  created_at timestamptz DEFAULT NOW(),
  updated_at timestamptz DEFAULT NOW()
);

ALTER TABLE public.pyq_papers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "PYQ papers viewable by all" ON public.pyq_papers;
DROP POLICY IF EXISTS "PYQ papers insertable by admin" ON public.pyq_papers;
DROP POLICY IF EXISTS "PYQ papers updatable by admin" ON public.pyq_papers;
DROP POLICY IF EXISTS "PYQ papers deletable by admin" ON public.pyq_papers;

CREATE POLICY "PYQ papers viewable by all" ON public.pyq_papers FOR SELECT USING (true);
CREATE POLICY "PYQ papers insertable by admin" ON public.pyq_papers FOR INSERT WITH CHECK (public.is_admin());
CREATE POLICY "PYQ papers updatable by admin" ON public.pyq_papers FOR UPDATE USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "PYQ papers deletable by admin" ON public.pyq_papers FOR DELETE USING (public.is_admin());

ALTER TABLE public.pyq_papers REPLICA IDENTITY FULL;
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.pyq_papers;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

-- 6. CREATE public.news_articles TABLE
CREATE TABLE IF NOT EXISTS public.news_articles (
  id text PRIMARY KEY,
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  subtitle text,
  subject_name text,
  chapter_name text,
  topic_name text,
  hindi_title text,
  excerpt text NOT NULL DEFAULT '',
  content text NOT NULL DEFAULT '',
  blocks jsonb DEFAULT '[]'::jsonb,
  category text NOT NULL DEFAULT 'General',
  tags text[] DEFAULT '{}'::text[],
  language text DEFAULT 'Both',
  cover_image_url text,
  author_name text NOT NULL DEFAULT 'Disha 20-20 Team',
  author_bio text,
  author_photo_url text,
  status text NOT NULL DEFAULT 'draft',
  scheduled_for timestamptz,
  is_featured boolean DEFAULT false,
  is_pinned boolean DEFAULT false,
  pinned_at timestamptz,
  style_variant text DEFAULT 'default',
  layout_config jsonb DEFAULT '{}'::jsonb,
  focus_keyword text,
  canonical_url text,
  og_image_url text,
  published_at timestamptz,
  views integer DEFAULT 0,
  seo_title text,
  seo_description text,
  seo_keywords text[] DEFAULT '{}'::text[],
  faqs jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT NOW(),
  updated_at timestamptz DEFAULT NOW()
);

ALTER TABLE public.news_articles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "News articles viewable by all" ON public.news_articles;
DROP POLICY IF EXISTS "News articles insertable by admin" ON public.news_articles;
DROP POLICY IF EXISTS "News articles updatable by admin" ON public.news_articles;
DROP POLICY IF EXISTS "News articles deletable by admin" ON public.news_articles;

CREATE POLICY "News articles viewable by all" ON public.news_articles FOR SELECT USING (true);
CREATE POLICY "News articles insertable by admin" ON public.news_articles FOR INSERT WITH CHECK (public.is_admin());
CREATE POLICY "News articles updatable by admin" ON public.news_articles FOR UPDATE USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "News articles deletable by admin" ON public.news_articles FOR DELETE USING (public.is_admin());

ALTER TABLE public.news_articles REPLICA IDENTITY FULL;
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.news_articles;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

-- 7. ENABLE GUEST & CLIENT DIRECT DATA PIPELINE (Remove auth.users strict FK blocks)
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey;
ALTER TABLE public.attempts DROP CONSTRAINT IF EXISTS attempts_user_id_fkey;
ALTER TABLE public.bookmarks DROP CONSTRAINT IF EXISTS bookmarks_user_id_fkey;
ALTER TABLE public.live_test_submissions DROP CONSTRAINT IF EXISTS live_test_submissions_test_id_fkey;

-- Allow student profiles to insert and update their profile without requiring an auth session
DROP POLICY IF EXISTS "Profiles insertable" ON public.profiles;
DROP POLICY IF EXISTS "Profiles updateable" ON public.profiles;

CREATE POLICY "Profiles insertable"
  ON public.profiles FOR INSERT
  WITH CHECK ((role = 'student') OR (auth.uid() = id) OR public.is_admin());

CREATE POLICY "Profiles updateable"
  ON public.profiles FOR UPDATE
  USING (true)
  WITH CHECK ((role = 'student') OR (auth.uid() = id) OR public.is_admin());

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
  ALTER PUBLICATION supabase_realtime ADD TABLE public.ai_telemetry;
  ALTER PUBLICATION supabase_realtime ADD TABLE public.battle_telemetry;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

