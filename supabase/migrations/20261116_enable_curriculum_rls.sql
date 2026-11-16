-- ============================================================================
-- DISHA 20-20 — Production Curriculum Row Level Security (RLS) Remediation
-- File: supabase/migrations/20261116_enable_curriculum_rls.sql
-- ============================================================================
-- Security Standard: Strict Zero-Trust / Enterprise PostgreSQL
-- Scope: public.subjects, public.chapters, public.topics, public.questions
-- Note: Does NOT modify auth.users (handled via separate provisioning script).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. HARDENED ADMIN AUTHORIZATION FUNCTION
-- ----------------------------------------------------------------------------
-- Security Definer with empty search_path to prevent path hijacking.
-- Relies EXCLUSIVELY on server-controlled Supabase Auth app_metadata.
-- Zero trust in user_metadata, localStorage, or client-writable profile fields.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT COALESCE(
    (auth.jwt() -> 'app_metadata' ->> 'role' = 'admin'),
    false
  );
$$;

REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin() TO anon, authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 2. ENABLE ROW LEVEL SECURITY ON CURRICULUM TABLES
-- ----------------------------------------------------------------------------
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chapters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- 3. EXHAUSTIVE DYNAMIC POLICY PURGE
-- ----------------------------------------------------------------------------
-- Dynamically drops every existing policy on curriculum tables to eliminate
-- any legacy, permissive, or conflicting write rules before re-creation.
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN 
    SELECT policyname, tablename 
    FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename IN ('subjects', 'chapters', 'topics', 'questions')
  LOOP
    EXECUTE pg_catalog.format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, pol.tablename);
  END LOOP;
END $$;

-- ----------------------------------------------------------------------------
-- 4. CREATE EXACTLY 16 AUTHORITATIVE GRANULAR POLICIES (4 TABLES x 4 COMMANDS)
-- ----------------------------------------------------------------------------

-- === 4.1 SUBJECTS TABLE ===
CREATE POLICY "Public Read Subjects" 
ON public.subjects FOR SELECT 
USING (true);

CREATE POLICY "Admin Insert Subjects" 
ON public.subjects FOR INSERT 
WITH CHECK (public.is_admin());

CREATE POLICY "Admin Update Subjects" 
ON public.subjects FOR UPDATE 
USING (public.is_admin()) 
WITH CHECK (public.is_admin());

CREATE POLICY "Admin Delete Subjects" 
ON public.subjects FOR DELETE 
USING (public.is_admin());

-- === 4.2 CHAPTERS TABLE ===
CREATE POLICY "Public Read Chapters" 
ON public.chapters FOR SELECT 
USING (true);

CREATE POLICY "Admin Insert Chapters" 
ON public.chapters FOR INSERT 
WITH CHECK (public.is_admin());

CREATE POLICY "Admin Update Chapters" 
ON public.chapters FOR UPDATE 
USING (public.is_admin()) 
WITH CHECK (public.is_admin());

CREATE POLICY "Admin Delete Chapters" 
ON public.chapters FOR DELETE 
USING (public.is_admin());

-- === 4.3 TOPICS TABLE ===
CREATE POLICY "Public Read Topics" 
ON public.topics FOR SELECT 
USING (true);

CREATE POLICY "Admin Insert Topics" 
ON public.topics FOR INSERT 
WITH CHECK (public.is_admin());

CREATE POLICY "Admin Update Topics" 
ON public.topics FOR UPDATE 
USING (public.is_admin()) 
WITH CHECK (public.is_admin());

CREATE POLICY "Admin Delete Topics" 
ON public.topics FOR DELETE 
USING (public.is_admin());

-- === 4.4 QUESTIONS TABLE ===
CREATE POLICY "Public Read Questions" 
ON public.questions FOR SELECT 
USING (true);

CREATE POLICY "Admin Insert Questions" 
ON public.questions FOR INSERT 
WITH CHECK (public.is_admin());

CREATE POLICY "Admin Update Questions" 
ON public.questions FOR UPDATE 
USING (public.is_admin()) 
WITH CHECK (public.is_admin());

CREATE POLICY "Admin Delete Questions" 
ON public.questions FOR DELETE 
USING (public.is_admin());

-- ----------------------------------------------------------------------------
-- 5. LEAST-PRIVILEGE DEFENSE-IN-DEPTH GRANTS (STRIP UNNECESSARY PRIVILEGES)
-- ----------------------------------------------------------------------------
-- Strip all default table privileges from PUBLIC, anon, and authenticated
REVOKE ALL ON TABLE public.subjects, public.chapters, public.topics, public.questions FROM PUBLIC, anon, authenticated;

-- Strip TRUNCATE, TRIGGER, and REFERENCES privileges permanently from all API roles
REVOKE TRUNCATE, TRIGGER, REFERENCES ON TABLE public.subjects, public.chapters, public.topics, public.questions FROM PUBLIC, anon, authenticated;

-- Strip sequence privileges from PUBLIC and anon
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM PUBLIC, anon;

-- Explicitly grant SELECT only to anon role
GRANT SELECT ON TABLE public.subjects, public.chapters, public.topics, public.questions TO anon;

-- Explicitly grant DML to authenticated role (governed strictly by the 16 RLS policies above)
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.subjects, public.chapters, public.topics, public.questions TO authenticated;
