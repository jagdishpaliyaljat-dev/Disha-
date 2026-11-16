-- ============================================================================
-- DISHA 20-20 — Rollback Migration: Hardened Curriculum Row Level Security
-- ============================================================================
-- ⚠️ SEVERE SECURITY WARNING ⚠️
-- Disabling Row Level Security (RLS) is NOT an acceptable routine rollback.
-- Executing this script revokes multi-tenant boundary protections and immediately
-- exposes public.subjects, public.chapters, public.topics, and public.questions
-- to unauthenticated write, update, and delete tampering by any client.
--
-- This script must ONLY be executed under emergency maintenance with the
-- API gateway paused or during disaster recovery where the database is
-- firewalled from public traffic.
-- ============================================================================

-- 1. Drop all fine-grained policies
DROP POLICY IF EXISTS "Public Read Subjects" ON public.subjects;
DROP POLICY IF EXISTS "Admin Insert Subjects" ON public.subjects;
DROP POLICY IF EXISTS "Admin Update Subjects" ON public.subjects;
DROP POLICY IF EXISTS "Admin Delete Subjects" ON public.subjects;

DROP POLICY IF EXISTS "Public Read Chapters" ON public.chapters;
DROP POLICY IF EXISTS "Admin Insert Chapters" ON public.chapters;
DROP POLICY IF EXISTS "Admin Update Chapters" ON public.chapters;
DROP POLICY IF EXISTS "Admin Delete Chapters" ON public.chapters;

DROP POLICY IF EXISTS "Public Read Topics" ON public.topics;
DROP POLICY IF EXISTS "Admin Insert Topics" ON public.topics;
DROP POLICY IF EXISTS "Admin Update Topics" ON public.topics;
DROP POLICY IF EXISTS "Admin Delete Topics" ON public.topics;

DROP POLICY IF EXISTS "Public Read Questions" ON public.questions;
DROP POLICY IF EXISTS "Admin Insert Questions" ON public.questions;
DROP POLICY IF EXISTS "Admin Update Questions" ON public.questions;
DROP POLICY IF EXISTS "Admin Delete Questions" ON public.questions;

-- 2. Disable Row Level Security
ALTER TABLE public.subjects DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.chapters DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.topics DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.questions DISABLE ROW LEVEL SECURITY;

-- 3. Restore default PostgREST role privileges
GRANT ALL ON TABLE public.subjects TO anon, authenticated;
GRANT ALL ON TABLE public.chapters TO anon, authenticated;
GRANT ALL ON TABLE public.topics TO anon, authenticated;
GRANT ALL ON TABLE public.questions TO anon, authenticated;
