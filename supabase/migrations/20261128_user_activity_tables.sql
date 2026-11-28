-- ============================================================
-- Disha PYQ — User Activity Analytics System
-- Migration: 20261128_user_activity_tables.sql
-- Creates 3 tables + 4 RPC functions + RLS policies
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- TABLE 1: user_activity_log
-- हर user action का log (page views, button clicks, features)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.user_activity_log (
  id           uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id      uuid        REFERENCES auth.users(id) ON DELETE CASCADE,
  event_name   text        NOT NULL,
  properties   jsonb       DEFAULT '{}'::jsonb,
  platform     text        DEFAULT 'web'  CHECK (platform IN ('web', 'android')),
  app_version  text,
  district     text,
  session_id   text,
  created_at   timestamptz DEFAULT now()
);

-- Indexes for fast admin queries
CREATE INDEX IF NOT EXISTS idx_ual_user_time    ON public.user_activity_log (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ual_event_time   ON public.user_activity_log (event_name, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ual_platform     ON public.user_activity_log (platform, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ual_created_at   ON public.user_activity_log (created_at DESC);

-- ─────────────────────────────────────────────────────────────
-- TABLE 2: quiz_attempts
-- हर test/quiz का detailed result
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.quiz_attempts (
  id           uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id      uuid        REFERENCES auth.users(id) ON DELETE CASCADE,
  topic_id     text,
  topic_name   text,
  subject      text,
  exam_type    text,
  total_q      int         DEFAULT 0,
  correct_q    int         DEFAULT 0,
  wrong_q      int         DEFAULT 0,
  skipped_q    int         DEFAULT 0,
  score_pct    numeric(5,2),
  duration_sec int         DEFAULT 0,
  platform     text        DEFAULT 'web' CHECK (platform IN ('web', 'android')),
  app_version  text,
  created_at   timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_qa_user_time     ON public.quiz_attempts (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_qa_subject       ON public.quiz_attempts (subject, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_qa_score         ON public.quiz_attempts (score_pct DESC);
CREATE INDEX IF NOT EXISTS idx_qa_created_at    ON public.quiz_attempts (created_at DESC);

-- ─────────────────────────────────────────────────────────────
-- TABLE 3: user_sessions
-- Session tracking — कितनी देर user ने app use की
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.user_sessions (
  id             uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id        uuid        REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id     text        NOT NULL UNIQUE,
  platform       text        DEFAULT 'web' CHECK (platform IN ('web', 'android')),
  app_version    text,
  started_at     timestamptz DEFAULT now(),
  ended_at       timestamptz,
  duration_sec   int         GENERATED ALWAYS AS (
                   EXTRACT(EPOCH FROM (ended_at - started_at))::int
                 ) STORED,
  pages_visited  int         DEFAULT 0,
  events_count   int         DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_us_user_time     ON public.user_sessions (user_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_us_platform      ON public.user_sessions (platform, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_us_started_at    ON public.user_sessions (started_at DESC);

-- ─────────────────────────────────────────────────────────────
-- ROW LEVEL SECURITY
-- ─────────────────────────────────────────────────────────────

-- user_activity_log RLS
ALTER TABLE public.user_activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own activity"
  ON public.user_activity_log FOR INSERT
  WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Users can read own activity"
  ON public.user_activity_log FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can read all activity"
  ON public.user_activity_log FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
  );

-- quiz_attempts RLS
ALTER TABLE public.quiz_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own attempts"
  ON public.quiz_attempts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can read own attempts"
  ON public.quiz_attempts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can read all attempts"
  ON public.quiz_attempts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
  );

-- user_sessions RLS
ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own sessions"
  ON public.user_sessions FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can read all sessions"
  ON public.user_sessions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
  );

-- ─────────────────────────────────────────────────────────────
-- RPC 1: get_admin_user_funnel
-- User Funnel — Register → Login → Quiz → Return
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_admin_user_funnel(p_days int DEFAULT 30)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_since       timestamptz := now() - (p_days || ' days')::interval;
  v_total       int;
  v_logged_in   int;
  v_attempted   int;
  v_returned    int;
BEGIN
  -- Total registered in period
  SELECT COUNT(*) INTO v_total
  FROM auth.users
  WHERE created_at >= v_since;

  -- Ever logged in (has last_sign_in_at)
  SELECT COUNT(*) INTO v_logged_in
  FROM auth.users
  WHERE created_at >= v_since
    AND last_sign_in_at IS NOT NULL;

  -- Attempted at least 1 quiz
  SELECT COUNT(DISTINCT user_id) INTO v_attempted
  FROM public.quiz_attempts
  WHERE created_at >= v_since;

  -- Returned more than once (2+ sessions)
  SELECT COUNT(DISTINCT user_id) INTO v_returned
  FROM public.user_sessions
  WHERE started_at >= v_since
  GROUP BY user_id
  HAVING COUNT(*) >= 2
  LIMIT 1;

  SELECT COUNT(*) INTO v_returned
  FROM (
    SELECT user_id
    FROM public.user_sessions
    WHERE started_at >= v_since
    GROUP BY user_id
    HAVING COUNT(*) >= 2
  ) sub;

  RETURN jsonb_build_object(
    'period_days',    p_days,
    'registered',     v_total,
    'logged_in',      v_logged_in,
    'login_pct',      ROUND(CASE WHEN v_total > 0 THEN v_logged_in * 100.0 / v_total ELSE 0 END, 1),
    'attempted_quiz', v_attempted,
    'quiz_pct',       ROUND(CASE WHEN v_logged_in > 0 THEN v_attempted * 100.0 / v_logged_in ELSE 0 END, 1),
    'returned',       v_returned,
    'return_pct',     ROUND(CASE WHEN v_attempted > 0 THEN v_returned * 100.0 / v_attempted ELSE 0 END, 1)
  );
END;
$$;

-- ─────────────────────────────────────────────────────────────
-- RPC 2: get_feature_adoption
-- Feature Adoption — कितने % users ने कौन सा feature use किया
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_feature_adoption(p_days int DEFAULT 30)
RETURNS TABLE(
  feature_name   text,
  feature_label  text,
  unique_users   bigint,
  adoption_pct   numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_total_users bigint;
BEGIN
  SELECT COUNT(DISTINCT id) INTO v_total_users
  FROM auth.users
  WHERE last_sign_in_at >= now() - (p_days || ' days')::interval;

  RETURN QUERY
  SELECT
    al.event_name,
    CASE al.event_name
      WHEN 'pyq_paper_view'   THEN 'PYQ Vault'
      WHEN 'quiz_start'       THEN 'Quiz/Practice'
      WHEN 'bookmark_add'     THEN 'Bookmarks'
      WHEN 'search_query'     THEN 'Search'
      WHEN 'tab_view_tests'   THEN 'Live Tests'
      WHEN 'tab_view_ai'      THEN 'AI Tutor'
      WHEN 'tab_view_profile' THEN 'Profile'
      ELSE al.event_name
    END::text AS feature_label,
    COUNT(DISTINCT al.user_id) AS unique_users,
    ROUND(
      CASE WHEN v_total_users > 0
        THEN COUNT(DISTINCT al.user_id) * 100.0 / v_total_users
        ELSE 0
      END, 1
    ) AS adoption_pct
  FROM public.user_activity_log al
  WHERE al.created_at >= now() - (p_days || ' days')::interval
    AND al.event_name IN (
      'pyq_paper_view', 'quiz_start', 'bookmark_add',
      'search_query', 'tab_view_tests', 'tab_view_ai', 'tab_view_profile'
    )
  GROUP BY al.event_name
  ORDER BY unique_users DESC;
END;
$$;

-- ─────────────────────────────────────────────────────────────
-- RPC 3: get_subject_analytics
-- Subject-wise performance across all students
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_subject_analytics(p_days int DEFAULT 30)
RETURNS TABLE(
  subject       text,
  total_attempts bigint,
  avg_score     numeric,
  weak_pct      numeric,
  unique_students bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    qa.subject,
    COUNT(*)                            AS total_attempts,
    ROUND(AVG(qa.score_pct), 1)         AS avg_score,
    ROUND(
      COUNT(*) FILTER (WHERE qa.score_pct < 50) * 100.0 / NULLIF(COUNT(*), 0), 1
    )                                   AS weak_pct,
    COUNT(DISTINCT qa.user_id)          AS unique_students
  FROM public.quiz_attempts qa
  WHERE qa.created_at >= now() - (p_days || ' days')::interval
    AND qa.subject IS NOT NULL
  GROUP BY qa.subject
  ORDER BY total_attempts DESC;
END;
$$;

-- ─────────────────────────────────────────────────────────────
-- RPC 4: get_top_active_users
-- Most active users with their stats for Admin table
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_top_active_users(p_limit int DEFAULT 50, p_days int DEFAULT 30)
RETURNS TABLE(
  user_id       uuid,
  user_email    text,
  user_name     text,
  district      text,
  platform      text,
  total_attempts bigint,
  avg_score     numeric,
  last_active   timestamptz,
  total_sessions bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    u.id                                             AS user_id,
    u.email                                          AS user_email,
    COALESCE(p.name, u.raw_user_meta_data->>'full_name', 'Student') AS user_name,
    p.district,
    COALESCE(
      (SELECT us.platform FROM public.user_sessions us
       WHERE us.user_id = u.id ORDER BY us.started_at DESC LIMIT 1),
      'web'
    )                                                AS platform,
    COUNT(qa.id)                                     AS total_attempts,
    ROUND(AVG(qa.score_pct), 1)                      AS avg_score,
    MAX(GREATEST(
      u.last_sign_in_at,
      (SELECT MAX(ual.created_at) FROM public.user_activity_log ual WHERE ual.user_id = u.id)
    ))                                               AS last_active,
    COUNT(DISTINCT us.id)                            AS total_sessions
  FROM auth.users u
  LEFT JOIN public.profiles p ON p.id = u.id
  LEFT JOIN public.quiz_attempts qa
         ON qa.user_id = u.id
        AND qa.created_at >= now() - (p_days || ' days')::interval
  LEFT JOIN public.user_sessions us
         ON us.user_id = u.id
        AND us.started_at >= now() - (p_days || ' days')::interval
  WHERE u.created_at IS NOT NULL
  GROUP BY u.id, u.email, p.name, p.district, u.raw_user_meta_data
  ORDER BY total_attempts DESC NULLS LAST
  LIMIT p_limit;
END;
$$;

-- ─────────────────────────────────────────────────────────────
-- GRANT permissions to anon + authenticated roles
-- ─────────────────────────────────────────────────────────────
GRANT EXECUTE ON FUNCTION public.get_admin_user_funnel(int)    TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_feature_adoption(int)     TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_subject_analytics(int)    TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_top_active_users(int,int) TO authenticated;

-- Allow insert/select on activity tables for authenticated users
GRANT INSERT, SELECT ON public.user_activity_log TO authenticated;
GRANT INSERT, SELECT ON public.quiz_attempts      TO authenticated;
GRANT INSERT, SELECT, UPDATE ON public.user_sessions TO authenticated;
