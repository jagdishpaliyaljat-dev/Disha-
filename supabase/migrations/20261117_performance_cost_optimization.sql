-- ============================================================================
-- DISHA 20-20 — Complete Database Performance, Scaling & Cost Optimization
-- Target: 100,000 to 1,000,000+ MCQs, Zero Table Scans, Optimized InitPlan RLS
-- ============================================================================

-- 1. DATA INTEGRITY & CHECK CONSTRAINTS
-- Ensure questions have valid array options and reasonable correct_answer index
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_questions_options_is_array'
  ) THEN
    ALTER TABLE public.questions
    ADD CONSTRAINT chk_questions_options_is_array
    CHECK (jsonb_typeof(options) = 'array');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_questions_correct_answer_range'
  ) THEN
    ALTER TABLE public.questions
    ADD CONSTRAINT chk_questions_correct_answer_range
    CHECK (correct_answer >= 0 AND correct_answer <= 10);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_attempts_score_non_negative'
  ) THEN
    ALTER TABLE public.attempts
    ADD CONSTRAINT chk_attempts_score_non_negative
    CHECK (score IS NULL OR score >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_attempts_total_questions_positive'
  ) THEN
    ALTER TABLE public.attempts
    ADD CONSTRAINT chk_attempts_total_questions_positive
    CHECK (total_questions IS NULL OR total_questions >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_attempts_time_spent_non_negative'
  ) THEN
    ALTER TABLE public.attempts
    ADD CONSTRAINT chk_attempts_time_spent_non_negative
    CHECK (time_spent_seconds IS NULL OR time_spent_seconds >= 0);
  END IF;
END $$;

-- 2. HIGH-SCALE COMPOSITE & COVERING INDEXES
-- Index for deterministic keyset pagination and topic filtering (O(log N))
CREATE INDEX IF NOT EXISTS idx_questions_topic_id_id
ON public.questions (topic_id, id);

-- Index for chapter-level practice/exam queries
CREATE INDEX IF NOT EXISTS idx_questions_chapter_id_id
ON public.questions (chapter_id, id);

-- Index for subject-level practice/exam queries
CREATE INDEX IF NOT EXISTS idx_questions_subject_id_id
ON public.questions (subject_id, id);

-- Composite index for PYQ Vault exam & year filtering
CREATE INDEX IF NOT EXISTS idx_questions_exam_year
ON public.questions (exam, year);

-- Covering index for attempts queries (user_id + created_at DESC)
-- Eliminates Seq Scan and Quicksort for student attempts & stats
CREATE INDEX IF NOT EXISTS idx_attempts_user_created_at
ON public.attempts (user_id, created_at DESC);

-- Covering index for bookmarks foreign key lookup on question deletion/update
CREATE INDEX IF NOT EXISTS idx_bookmarks_question_id
ON public.bookmarks (question_id);

-- Curriculum deterministic ordering indexes
CREATE INDEX IF NOT EXISTS idx_chapters_subject_order
ON public.chapters (subject_id, order_index ASC);

CREATE INDEX IF NOT EXISTS idx_topics_chapter_order
ON public.topics (chapter_id, order_index ASC);

-- 3. RLS INITPLAN OPTIMIZATION
-- Replaces per-row auth.uid() function re-evaluation with cached InitPlan (select auth.uid())

-- PROFILES
DROP POLICY IF EXISTS "Profiles viewable" ON public.profiles;
CREATE POLICY "Profiles viewable"
ON public.profiles FOR SELECT
USING ((select auth.uid()) = id);

DROP POLICY IF EXISTS "Profiles insertable" ON public.profiles;
CREATE POLICY "Profiles insertable"
ON public.profiles FOR INSERT
WITH CHECK ((select auth.uid()) = id);

DROP POLICY IF EXISTS "Profiles updateable" ON public.profiles;
CREATE POLICY "Profiles updateable"
ON public.profiles FOR UPDATE
USING ((select auth.uid()) = id);

-- ATTEMPTS
DROP POLICY IF EXISTS "Users attempts" ON public.attempts;
CREATE POLICY "Users attempts"
ON public.attempts FOR ALL
USING ((select auth.uid()) = user_id);

-- BOOKMARKS
DROP POLICY IF EXISTS "Users bookmarks" ON public.bookmarks;
CREATE POLICY "Users bookmarks"
ON public.bookmarks FOR ALL
USING ((select auth.uid()) = user_id);
