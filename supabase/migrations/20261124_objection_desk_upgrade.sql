-- ============================================================================
-- Migration: 20261124_objection_desk_upgrade.sql
-- Description: Upgrades public.question_reports for Full Question Editor,
-- Multi-status tracking (Pending, Under Review, Resolved, Rejected),
-- Audit Log history, and snapshots.
-- ============================================================================

-- 1. Ensure columns exist on question_reports
ALTER TABLE public.question_reports
ADD COLUMN IF NOT EXISTS options_snapshot TEXT[] DEFAULT NULL,
ADD COLUMN IF NOT EXISTS correct_index_snapshot INTEGER DEFAULT NULL,
ADD COLUMN IF NOT EXISTS source_exam TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS audit_logs JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ DEFAULT NULL;

-- 2. Drop legacy status check constraint and update to include 'under_review' and 'rejected'
ALTER TABLE public.question_reports 
DROP CONSTRAINT IF EXISTS question_reports_status_check;

ALTER TABLE public.question_reports
ADD CONSTRAINT question_reports_status_check 
CHECK (status IN ('pending', 'under_review', 'resolved', 'rejected', 'dismissed'));

-- 3. Ensure indexing for doubt desk status filtering
CREATE INDEX IF NOT EXISTS idx_question_reports_status_created 
ON public.question_reports(status, created_at DESC);
