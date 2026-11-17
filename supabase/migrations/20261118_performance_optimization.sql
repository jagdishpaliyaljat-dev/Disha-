-- ============================================================================
-- DISHA 20-20 — Performance Optimization Migration (backward-compatible)
-- File: supabase/migrations/20261118_performance_optimization.sql
-- ============================================================================
-- Safe, additive indexes. No data changes. All statements are idempotent.
-- Rollback: see 20261118_performance_optimization_rollback.sql
-- ============================================================================

-- Enable trigram search support for ILIKE on question text (optional but useful).
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Partial index for verified questions by subject (hot path for subject-wise loading).
CREATE INDEX IF NOT EXISTS idx_questions_verified_subject
  ON public.questions (subject_id, created_at DESC, id DESC)
  WHERE verified = TRUE;

-- Partial index for verified questions by topic (topic-wise filtering).
CREATE INDEX IF NOT EXISTS idx_questions_verified_topic
  ON public.questions (topic_id, created_at DESC, id DESC)
  WHERE verified = TRUE;

-- Composite index for exam + year filtering (PYQ / exam-wise retrieval).
CREATE INDEX IF NOT EXISTS idx_questions_exam_year_subject
  ON public.questions (exam, year, subject_id);

-- GIN trigram index for question text search (ILIKE '%term%').
CREATE INDEX IF NOT EXISTS idx_questions_question_trgm
  ON public.questions USING gin (question gin_trgm_ops);

-- Covering index for cursor pagination (avoids heap fetches for common columns).
CREATE INDEX IF NOT EXISTS idx_questions_cursor_covering
  ON public.questions (created_at DESC, id DESC)
  INCLUDE (subject_id, chapter_id, topic_id, exam, year, level);

-- Index for attempts analytics by user + created_at (already exists, ensure).
CREATE INDEX IF NOT EXISTS idx_attempts_user_created
  ON public.attempts (user_id, created_at DESC);

-- Index for bookmarks user lookup (already exists, ensure).
CREATE INDEX IF NOT EXISTS idx_bookmarks_user_id
  ON public.bookmarks (user_id);

-- Analyze tables to refresh planner statistics after index creation.
ANALYZE public.subjects;
ANALYZE public.chapters;
ANALYZE public.topics;
ANALYZE public.questions;
ANALYZE public.profiles;
ANALYZE public.attempts;
ANALYZE public.bookmarks;
