-- ============================================================================
-- Migration: 20261123_question_recycle_bin_soft_delete.sql
-- Description: Adds soft deletion support (deleted_at) and index to public.questions
-- for Question Recycle Bin & Accidental Delete Recovery.
-- ============================================================================

-- 1. Add deleted_at column to public.questions
ALTER TABLE public.questions 
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

-- 2. Create index for fast retrieval of active vs soft-deleted questions
CREATE INDEX IF NOT EXISTS idx_questions_deleted_at ON public.questions(deleted_at);

-- 3. Composite indexes for topic/chapter queries filtering deleted_at
CREATE INDEX IF NOT EXISTS idx_questions_topic_active ON public.questions(topic_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_questions_chapter_active ON public.questions(chapter_id) WHERE deleted_at IS NULL;

-- 4. Update Public Read Questions RLS Policy to filter out soft-deleted questions
DROP POLICY IF EXISTS "Public Read Questions" ON public.questions;
CREATE POLICY "Public Read Questions" ON public.questions FOR SELECT USING (
  (deleted_at IS NULL AND COALESCE(verified, true) = true) OR public.is_admin()
);
