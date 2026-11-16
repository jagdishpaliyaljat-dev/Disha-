-- ============================================================================
-- DISHA 20-20 — Rollback Migration for 20261117_performance_cost_optimization.sql
-- ============================================================================

-- 1. Drop Indexes
DROP INDEX IF EXISTS public.idx_questions_topic_id_id;
DROP INDEX IF EXISTS public.idx_questions_chapter_id_id;
DROP INDEX IF EXISTS public.idx_questions_subject_id_id;
DROP INDEX IF EXISTS public.idx_questions_exam_year;
DROP INDEX IF EXISTS public.idx_attempts_user_created_at;
DROP INDEX IF EXISTS public.idx_bookmarks_question_id;
DROP INDEX IF EXISTS public.idx_chapters_subject_order;
DROP INDEX IF EXISTS public.idx_topics_chapter_order;

-- 2. Drop Check Constraints
ALTER TABLE public.questions DROP CONSTRAINT IF EXISTS chk_questions_options_is_array;
ALTER TABLE public.questions DROP CONSTRAINT IF EXISTS chk_questions_correct_answer_range;
ALTER TABLE public.attempts DROP CONSTRAINT IF EXISTS chk_attempts_score_non_negative;
ALTER TABLE public.attempts DROP CONSTRAINT IF EXISTS chk_attempts_total_questions_positive;
ALTER TABLE public.attempts DROP CONSTRAINT IF EXISTS chk_attempts_time_spent_non_negative;

-- 3. Restore Previous RLS Policies
DROP POLICY IF EXISTS "Profiles viewable" ON public.profiles;
CREATE POLICY "Profiles viewable" ON public.profiles FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Profiles insertable" ON public.profiles;
CREATE POLICY "Profiles insertable" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Profiles updateable" ON public.profiles;
CREATE POLICY "Profiles updateable" ON public.profiles FOR UPDATE USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users attempts" ON public.attempts;
CREATE POLICY "Users attempts" ON public.attempts FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users bookmarks" ON public.bookmarks;
CREATE POLICY "Users bookmarks" ON public.bookmarks FOR ALL USING (auth.uid() = user_id);
