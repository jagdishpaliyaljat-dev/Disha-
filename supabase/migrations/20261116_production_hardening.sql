-- ============================================================================
-- DISHA 20-20 — Phase 2: Production Hardening & Scalability Migration
-- ============================================================================

-- 1. SECURE ADMIN AUTHORIZATION FUNCTION
-- Checks Supabase Auth JWT claims against authorized administrative identities
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT COALESCE(
    (auth.jwt()->>'email' IN ('jagdishpaliyaljat@gmail.com', 'zdpaliyal@gmail.com'))
    OR
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role = 'admin'
    ),
    false
  );
$$;

-- 2. PREVENT PRIVILEGE ESCALATION ON PROFILES
-- Guarantees users cannot alter their own 'role' field via client mutations
CREATE OR REPLACE FUNCTION public.handle_profile_role_guard()
RETURNS TRIGGER AS $$
BEGIN
  -- If role is being changed and caller is not a verified admin, reject/revert role change
  IF NEW.role IS DISTINCT FROM OLD.role AND NOT public.is_admin() THEN
    NEW.role := OLD.role;
  END IF;
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_profile_role_guard ON public.profiles;
CREATE TRIGGER trg_profile_role_guard
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.handle_profile_role_guard();

-- 3. RLS HARDENING: PROFILES TABLE
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Profiles are viewable by owner" ON public.profiles;
DROP POLICY IF EXISTS "Profiles updateable by owner" ON public.profiles;
DROP POLICY IF EXISTS "Profiles insertable by owner" ON public.profiles;

CREATE POLICY "Profiles are viewable by owner" 
ON public.profiles FOR SELECT 
USING (auth.uid() = id OR public.is_admin());

CREATE POLICY "Profiles updateable by owner" 
ON public.profiles FOR UPDATE 
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

CREATE POLICY "Profiles insertable by owner" 
ON public.profiles FOR INSERT 
WITH CHECK (auth.uid() = id);

-- 4. RLS HARDENING: ATTEMPTS TABLE (ATTEMPT INTEGRITY & TAMPER PREVENTION)
-- Once submitted, attempts cannot be updated or fabricated by students
ALTER TABLE public.attempts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage own attempts" ON public.attempts;
DROP POLICY IF EXISTS "Users can insert own attempts" ON public.attempts;
DROP POLICY IF EXISTS "Users can view own attempts" ON public.attempts;
DROP POLICY IF EXISTS "Admins can view all attempts" ON public.attempts;

CREATE POLICY "Users can insert own attempts" 
ON public.attempts FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own attempts" 
ON public.attempts FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all attempts" 
ON public.attempts FOR SELECT 
USING (public.is_admin());

-- Notice: No UPDATE policy on attempts! Student attempts are immutable audit records.

-- 5. RLS HARDENING: BOOKMARKS TABLE
ALTER TABLE public.bookmarks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage own bookmarks" ON public.bookmarks;

CREATE POLICY "Users can view own bookmarks" 
ON public.bookmarks FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own bookmarks" 
ON public.bookmarks FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own bookmarks" 
ON public.bookmarks FOR DELETE 
USING (auth.uid() = user_id);

-- 6. PERFORMANCE & SCALABILITY INDEXES FOR 100,000+ MCQS
-- High-throughput cursor seek index on created_at and id
CREATE INDEX IF NOT EXISTS idx_questions_cursor 
ON public.questions(created_at DESC, id DESC);

-- Composite index for fast faceted filtering on Exam, Year, and Subject
CREATE INDEX IF NOT EXISTS idx_questions_facet_filter 
ON public.questions(exam, year, subject_id);

-- Composite index for chapter and topic question seeks
CREATE INDEX IF NOT EXISTS idx_questions_hierarchy_seek 
ON public.questions(subject_id, chapter_id, topic_id);

-- User attempts chronological index
CREATE INDEX IF NOT EXISTS idx_attempts_user_created 
ON public.attempts(user_id, created_at DESC);

-- 7. STORAGE POLICIES (BANNERS & MATERIALS)
-- Banners: Public read, Admin write
-- Materials: Authenticated read, Admin write
INSERT INTO storage.buckets (id, name, public) 
VALUES ('banners', 'banners', true) 
ON CONFLICT (id) DO UPDATE SET public = true;

INSERT INTO storage.buckets (id, name, public) 
VALUES ('materials', 'materials', false) 
ON CONFLICT (id) DO NOTHING;

-- Storage RLS
CREATE POLICY "Public Read Banners" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'banners');

CREATE POLICY "Admin All Banners" 
ON storage.objects FOR ALL 
USING (bucket_id = 'banners' AND public.is_admin());

CREATE POLICY "Authenticated Read Materials" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'materials' AND auth.role() = 'authenticated');

CREATE POLICY "Admin All Materials" 
ON storage.objects FOR ALL 
USING (bucket_id = 'materials' AND public.is_admin());
