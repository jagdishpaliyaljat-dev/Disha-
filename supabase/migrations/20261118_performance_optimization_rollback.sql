-- ============================================================================
-- ROLLBACK: 20261118_performance_optimization.sql
-- ============================================================================
DROP INDEX IF EXISTS public.idx_questions_verified_subject;
DROP INDEX IF EXISTS public.idx_questions_verified_topic;
DROP INDEX IF EXISTS public.idx_questions_exam_year_subject;
DROP INDEX IF EXISTS public.idx_questions_question_trgm;
DROP INDEX IF EXISTS public.idx_questions_cursor_covering;
-- Keep base indexes (idx_attempts_user_created, idx_bookmarks_user_id) as they are pre-existing.
