-- Migration: 20261119_audit_bug_fixes.sql
-- Description: Fix security vulnerabilities (BUG-13, BUG-14, BUG-15, BUG-07) and foreign key cascade (BUG-10)

-- 1. Helper function to check if caller is blocked
CREATE OR REPLACE FUNCTION public.is_user_blocked()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT COALESCE(
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND (profiles.status = 'blocked' OR profiles.blocked = true)
    ),
    false
  );
$$;

-- 2. BUG-13: Lock down contact_messages SELECT to admin only
DROP POLICY IF EXISTS "Contact messages viewable" ON public.contact_messages;
DROP POLICY IF EXISTS "Admins can view contact messages" ON public.contact_messages;
CREATE POLICY "Admins can view contact messages"
  ON public.contact_messages
  FOR SELECT
  USING (public.is_admin());

-- 3. BUG-14: Lock down attempts SELECT so students only see their own attempts; admin sees all
DROP POLICY IF EXISTS "Attempts viewable by all" ON public.attempts;
DROP POLICY IF EXISTS "Users view own attempts and admin views all" ON public.attempts;
CREATE POLICY "Users view own attempts and admin views all"
  ON public.attempts
  FOR SELECT
  USING (((auth.uid() = user_id) OR public.is_admin()));

-- BUG-07: Guard attempts writes against blocked users
DROP POLICY IF EXISTS "Attempts insertable by all" ON public.attempts;
DROP POLICY IF EXISTS "Users insert attempts if not blocked" ON public.attempts;
CREATE POLICY "Users insert attempts if not blocked"
  ON public.attempts
  FOR INSERT
  WITH CHECK (NOT public.is_user_blocked());

DROP POLICY IF EXISTS "Attempts updatable by admins and owners" ON public.attempts;
DROP POLICY IF EXISTS "Users update own attempts if not blocked" ON public.attempts;
CREATE POLICY "Users update own attempts if not blocked"
  ON public.attempts
  FOR UPDATE
  USING (((auth.uid() = user_id) AND NOT public.is_user_blocked()) OR public.is_admin())
  WITH CHECK (((auth.uid() = user_id) AND NOT public.is_user_blocked()) OR public.is_admin());

-- 4. BUG-15: Lock down telemetry tables
DROP POLICY IF EXISTS "AI telemetry viewable" ON public.ai_telemetry;
DROP POLICY IF EXISTS "AI telemetry viewable by admins only" ON public.ai_telemetry;
CREATE POLICY "AI telemetry viewable by admins only"
  ON public.ai_telemetry
  FOR SELECT
  USING (public.is_admin());

DROP POLICY IF EXISTS "Battle telemetry updateable" ON public.battle_telemetry;
CREATE POLICY "Battle telemetry updateable"
  ON public.battle_telemetry
  FOR UPDATE
  USING ((auth.uid() IS NOT NULL) OR public.is_admin());

-- 5. BUG-07: Guard live_test_submissions against blocked users
DROP POLICY IF EXISTS "Live test submissions insertable by students" ON public.live_test_submissions;
DROP POLICY IF EXISTS "Live test submissions insertable by non-blocked students" ON public.live_test_submissions;
CREATE POLICY "Live test submissions insertable by non-blocked students"
  ON public.live_test_submissions
  FOR INSERT
  WITH CHECK (NOT public.is_user_blocked());

DROP POLICY IF EXISTS "Live test submissions updatable by owner or admin" ON public.live_test_submissions;
CREATE POLICY "Live test submissions updatable by owner or admin"
  ON public.live_test_submissions
  FOR UPDATE
  USING (public.is_admin() OR (((auth.uid())::text = user_id) AND NOT public.is_user_blocked()))
  WITH CHECK (public.is_admin() OR (((auth.uid())::text = user_id) AND NOT public.is_user_blocked()));

-- BUG-07: Guard question_reports against blocked users
DROP POLICY IF EXISTS "Students can insert question reports" ON public.question_reports;
DROP POLICY IF EXISTS "Students can insert question reports if not blocked" ON public.question_reports;
CREATE POLICY "Students can insert question reports if not blocked"
  ON public.question_reports
  FOR INSERT
  WITH CHECK (NOT public.is_user_blocked());

-- 6. BUG-10: Cascade delete orphaned questions on parent deletion
ALTER TABLE public.questions DROP CONSTRAINT IF EXISTS questions_subject_id_fkey;
ALTER TABLE public.questions ADD CONSTRAINT questions_subject_id_fkey FOREIGN KEY (subject_id) REFERENCES public.subjects(id) ON DELETE CASCADE;

ALTER TABLE public.questions DROP CONSTRAINT IF EXISTS questions_chapter_id_fkey;
ALTER TABLE public.questions ADD CONSTRAINT questions_chapter_id_fkey FOREIGN KEY (chapter_id) REFERENCES public.chapters(id) ON DELETE CASCADE;

ALTER TABLE public.questions DROP CONSTRAINT IF EXISTS questions_topic_id_fkey;
ALTER TABLE public.questions ADD CONSTRAINT questions_topic_id_fkey FOREIGN KEY (topic_id) REFERENCES public.topics(id) ON DELETE CASCADE;
