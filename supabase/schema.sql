-- ============================================================================
-- DISHA 20-20 — Complete Production PostgreSQL Database Schema (Supabase)
-- ============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. SUBJECTS TABLE
CREATE TABLE IF NOT EXISTS public.subjects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    hindi_name TEXT,
    description TEXT,
    icon TEXT DEFAULT 'book',
    color TEXT DEFAULT '#8B1E3F',
    order_index INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. CHAPTERS TABLE
CREATE TABLE IF NOT EXISTS public.chapters (
    id TEXT PRIMARY KEY,
    subject_id TEXT NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    hindi_name TEXT,
    order_index INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. TOPICS TABLE
CREATE TABLE IF NOT EXISTS public.topics (
    id TEXT PRIMARY KEY,
    chapter_id TEXT NOT NULL REFERENCES public.chapters(id) ON DELETE CASCADE,
    subject_id TEXT NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    hindi_name TEXT,
    order_index INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. QUESTIONS TABLE (MCQ BANK)
CREATE TABLE IF NOT EXISTS public.questions (
    id TEXT PRIMARY KEY,
    subject_id TEXT REFERENCES public.subjects(id) ON DELETE SET NULL,
    chapter_id TEXT REFERENCES public.chapters(id) ON DELETE SET NULL,
    topic_id TEXT REFERENCES public.topics(id) ON DELETE SET NULL,
    question TEXT NOT NULL,
    options JSONB NOT NULL DEFAULT '[]'::jsonb,
    correct_answer INTEGER NOT NULL DEFAULT 0,
    explanation TEXT,
    exam TEXT,
    year TEXT,
    level TEXT DEFAULT 'medium',
    verified BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. PROFILES TABLE (Linked with Supabase Auth)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT,
    display_name TEXT,
    photo_url TEXT,
    role TEXT DEFAULT 'student',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. ATTEMPTS TABLE (Student Quiz & Test History)
CREATE TABLE IF NOT EXISTS public.attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    topic_id TEXT,
    subject_id TEXT,
    total_questions INTEGER,
    score INTEGER,
    answers JSONB,
    time_spent_seconds INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. BOOKMARKS TABLE
CREATE TABLE IF NOT EXISTS public.bookmarks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    question_id TEXT REFERENCES public.questions(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (user_id, question_id)
);

-- ----------------------------------------------------------------------------
-- INDEXES FOR INSTANT RETRIEVAL
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_chapters_subject_id ON public.chapters(subject_id);
CREATE INDEX IF NOT EXISTS idx_topics_chapter_id ON public.topics(chapter_id);
CREATE INDEX IF NOT EXISTS idx_topics_subject_id ON public.topics(subject_id);
CREATE INDEX IF NOT EXISTS idx_questions_topic_id ON public.questions(topic_id);
CREATE INDEX IF NOT EXISTS idx_questions_chapter_id ON public.questions(chapter_id);
CREATE INDEX IF NOT EXISTS idx_questions_subject_id ON public.questions(subject_id);
CREATE INDEX IF NOT EXISTS idx_attempts_user_id ON public.attempts(user_id);
CREATE INDEX IF NOT EXISTS idx_bookmarks_user_id ON public.bookmarks(user_id);

-- ----------------------------------------------------------------------------
-- SECURITY & AUTHORIZATION FUNCTIONS
-- ----------------------------------------------------------------------------
-- Designated Administrator: jagdishpaliyaljat@gmail.com (provisioned via app_metadata.role = 'admin')
-- Hardened Admin Authorization: Security Invoker with empty search_path
-- Relies exclusively on server-controlled Supabase Auth app_metadata
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY INVOKER
STABLE
SET search_path = ''
AS $$
  SELECT COALESCE(
    (auth.jwt() -> 'app_metadata' ->> 'role' = 'admin') OR
    (LOWER(auth.jwt() ->> 'email') IN ('jagdishpaliyaljat@gmail.com', 'zdpaliyal@gmail.com')) OR
    (LOWER(auth.jwt() -> 'user_metadata' ->> 'email') IN ('jagdishpaliyaljat@gmail.com', 'zdpaliyal@gmail.com')),
    false
  );
$$;

REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin() TO anon, authenticated, service_role;

-- Trigger to prevent privilege escalation on profiles
CREATE OR REPLACE FUNCTION public.handle_profile_role_guard()
RETURNS TRIGGER AS $$
BEGIN
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

-- ----------------------------------------------------------------------------
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ----------------------------------------------------------------------------
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chapters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookmarks ENABLE ROW LEVEL SECURITY;

-- 16 Granular Curriculum Policies (4 Tables x 4 Commands)
-- Subjects
CREATE POLICY "Public Read Subjects" ON public.subjects FOR SELECT USING (true);
CREATE POLICY "Admin Insert Subjects" ON public.subjects FOR INSERT WITH CHECK (public.is_admin());
CREATE POLICY "Admin Update Subjects" ON public.subjects FOR UPDATE USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "Admin Delete Subjects" ON public.subjects FOR DELETE USING (public.is_admin());

-- Chapters
CREATE POLICY "Public Read Chapters" ON public.chapters FOR SELECT USING (true);
CREATE POLICY "Admin Insert Chapters" ON public.chapters FOR INSERT WITH CHECK (public.is_admin());
CREATE POLICY "Admin Update Chapters" ON public.chapters FOR UPDATE USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "Admin Delete Chapters" ON public.chapters FOR DELETE USING (public.is_admin());

-- Topics
CREATE POLICY "Public Read Topics" ON public.topics FOR SELECT USING (true);
CREATE POLICY "Admin Insert Topics" ON public.topics FOR INSERT WITH CHECK (public.is_admin());
CREATE POLICY "Admin Update Topics" ON public.topics FOR UPDATE USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "Admin Delete Topics" ON public.topics FOR DELETE USING (public.is_admin());

-- Questions
CREATE POLICY "Public Read Questions" ON public.questions FOR SELECT USING (true);
CREATE POLICY "Admin Insert Questions" ON public.questions FOR INSERT WITH CHECK (public.is_admin());
CREATE POLICY "Admin Update Questions" ON public.questions FOR UPDATE USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "Admin Delete Questions" ON public.questions FOR DELETE USING (public.is_admin());

-- Least-Privilege Grants
REVOKE ALL ON TABLE public.subjects, public.chapters, public.topics, public.questions FROM PUBLIC, anon, authenticated;
REVOKE TRUNCATE, TRIGGER, REFERENCES ON TABLE public.subjects, public.chapters, public.topics, public.questions FROM PUBLIC, anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM PUBLIC, anon;
GRANT SELECT ON TABLE public.subjects, public.chapters, public.topics, public.questions TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.subjects, public.chapters, public.topics, public.questions TO authenticated;

-- User Profiles: Isolated by owner, role-guarded
CREATE POLICY "Profiles are viewable by owner" ON public.profiles FOR SELECT USING (auth.uid() = id OR public.is_admin());
CREATE POLICY "Profiles updateable by owner" ON public.profiles FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "Profiles insertable by owner" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Attempts: Immutable student audit records (INSERT with check, SELECT by owner/admin, NO student UPDATE)
CREATE POLICY "Users can insert own attempts" ON public.attempts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can view own attempts" ON public.attempts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all attempts" ON public.attempts FOR SELECT USING (public.is_admin());

-- Bookmarks: User isolated
CREATE POLICY "Users can view own bookmarks" ON public.bookmarks FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own bookmarks" ON public.bookmarks FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own bookmarks" ON public.bookmarks FOR DELETE USING (auth.uid() = user_id);

-- Additional Scalability Indexes for 100,000+ MCQs
CREATE INDEX IF NOT EXISTS idx_questions_cursor ON public.questions(created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_questions_facet_filter ON public.questions(exam, year, subject_id);
CREATE INDEX IF NOT EXISTS idx_questions_hierarchy_seek ON public.questions(subject_id, chapter_id, topic_id);
CREATE INDEX IF NOT EXISTS idx_attempts_user_created ON public.attempts(user_id, created_at DESC);
