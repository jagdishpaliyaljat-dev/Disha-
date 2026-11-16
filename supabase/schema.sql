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
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ----------------------------------------------------------------------------
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chapters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookmarks ENABLE ROW LEVEL SECURITY;

-- Curriculum & Questions: Public Read (Students can read without quota limit)
CREATE POLICY "Public Read Subjects" ON public.subjects FOR SELECT USING (true);
CREATE POLICY "Public Read Chapters" ON public.chapters FOR SELECT USING (true);
CREATE POLICY "Public Read Topics" ON public.topics FOR SELECT USING (true);
CREATE POLICY "Public Read Questions" ON public.questions FOR SELECT USING (true);

-- Admin Only Writes for Curriculum & Questions
CREATE POLICY "Admin All Subjects" ON public.subjects FOR ALL USING (
    auth.jwt()->>'email' = 'jagdishpaliyaljat@gmail.com'
);
CREATE POLICY "Admin All Chapters" ON public.chapters FOR ALL USING (
    auth.jwt()->>'email' = 'jagdishpaliyaljat@gmail.com'
);
CREATE POLICY "Admin All Topics" ON public.topics FOR ALL USING (
    auth.jwt()->>'email' = 'jagdishpaliyaljat@gmail.com'
);
CREATE POLICY "Admin All Questions" ON public.questions FOR ALL USING (
    auth.jwt()->>'email' = 'jagdishpaliyaljat@gmail.com'
);

-- User Profiles: Read public, update own
CREATE POLICY "Profiles are viewable by owner" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Profiles updateable by owner" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Profiles insertable by owner" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Attempts & Bookmarks: User isolated
CREATE POLICY "Users can manage own attempts" ON public.attempts FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage own bookmarks" ON public.bookmarks FOR ALL USING (auth.uid() = user_id);
