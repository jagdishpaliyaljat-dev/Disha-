-- ============================================================================
-- MIGRATION: 20261124_enterprise_staff_rbac.sql
-- DESCRIPTION: Enterprise Multi-Role Staff Management & RBAC
-- Predefined Roles: Super Admin, SME/Teacher, Content Reviewer, Support Agent
-- Question Approval Workflow, Staff Invitations, and Immutable Staff Audit Logs
-- ============================================================================

-- 1. Extend profiles table with Staff RBAC attributes
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS staff_role TEXT DEFAULT 'student',
  ADD COLUMN IF NOT EXISTS staff_status TEXT DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS staff_permissions JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS assigned_subjects TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS invited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS invited_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMPTZ;

-- Constrain staff_role and staff_status if not already constrained
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_profiles_staff_role'
  ) THEN
    ALTER TABLE public.profiles ADD CONSTRAINT chk_profiles_staff_role
      CHECK (staff_role IN ('super_admin', 'admin', 'sme_teacher', 'content_reviewer', 'support_agent', 'student', 'user'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_profiles_staff_status'
  ) THEN
    ALTER TABLE public.profiles ADD CONSTRAINT chk_profiles_staff_status
      CHECK (staff_status IN ('active', 'suspended', 'invited'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_profiles_staff_role ON public.profiles(staff_role);
CREATE INDEX IF NOT EXISTS idx_profiles_staff_status ON public.profiles(staff_status);

-- 2. Extend questions table with Approval Workflow attributes
ALTER TABLE public.questions
  ADD COLUMN IF NOT EXISTS approval_status TEXT DEFAULT 'published',
  ADD COLUMN IF NOT EXISTS submitted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS review_notes TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_questions_approval_status'
  ) THEN
    ALTER TABLE public.questions ADD CONSTRAINT chk_questions_approval_status
      CHECK (approval_status IN ('draft', 'pending_review', 'approved', 'rejected', 'published'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_questions_approval_status ON public.questions(approval_status);
CREATE INDEX IF NOT EXISTS idx_questions_submitted_by ON public.questions(submitted_by);
CREATE INDEX IF NOT EXISTS idx_questions_reviewed_by ON public.questions(reviewed_by);

-- 3. Staff Invitations Table
CREATE TABLE IF NOT EXISTS public.staff_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'sme_teacher'
    CHECK (role IN ('super_admin', 'admin', 'sme_teacher', 'content_reviewer', 'support_agent')),
  permissions JSONB DEFAULT '{}'::jsonb,
  assigned_subjects TEXT[] DEFAULT '{}',
  token TEXT NOT NULL UNIQUE,
  invited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'expired', 'revoked')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days')
);

CREATE INDEX IF NOT EXISTS idx_staff_invitations_email ON public.staff_invitations(email);
CREATE INDEX IF NOT EXISTS idx_staff_invitations_token ON public.staff_invitations(token);
CREATE INDEX IF NOT EXISTS idx_staff_invitations_status ON public.staff_invitations(status);

-- 4. Staff Audit Logs Table (Immutable Audit Trail)
CREATE TABLE IF NOT EXISTS public.staff_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_email TEXT NOT NULL,
  actor_role TEXT NOT NULL,
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT,
  details JSONB DEFAULT '{}'::jsonb,
  ip_address TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_staff_audit_logs_actor ON public.staff_audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_staff_audit_logs_created_at ON public.staff_audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_staff_audit_logs_action ON public.staff_audit_logs(action);

-- 5. Helper Functions for RBAC
CREATE OR REPLACE FUNCTION public.get_staff_role(target_id UUID)
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT COALESCE(
    (SELECT staff_role FROM public.profiles WHERE id = target_id),
    (SELECT role FROM public.profiles WHERE id = target_id),
    'student'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT COALESCE(
    (auth.jwt() -> 'app_metadata' ->> 'role' IN ('super_admin', 'admin')),
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() 
      AND (staff_role IN ('super_admin') OR role = 'admin')
      AND staff_status = 'active'
    ),
    false
  );
$$;

CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT COALESCE(
    public.is_super_admin(),
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND staff_role IN ('super_admin', 'admin', 'sme_teacher', 'content_reviewer', 'support_agent')
      AND staff_status = 'active'
    ),
    false
  );
$$;

CREATE OR REPLACE FUNCTION public.can_review_questions()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT COALESCE(
    public.is_super_admin(),
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND staff_role IN ('super_admin', 'admin', 'content_reviewer')
      AND staff_status = 'active'
    ),
    false
  );
$$;

-- 6. Row Level Security (RLS) Enablement & Policies
ALTER TABLE public.staff_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_audit_logs ENABLE ROW LEVEL SECURITY;

-- Staff Invitations Policies
DROP POLICY IF EXISTS "Staff invitations readable by staff" ON public.staff_invitations;
CREATE POLICY "Staff invitations readable by staff" ON public.staff_invitations
  FOR SELECT USING (public.is_staff());

DROP POLICY IF EXISTS "Super admins manage invitations" ON public.staff_invitations;
CREATE POLICY "Super admins manage invitations" ON public.staff_invitations
  FOR ALL USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

-- Staff Audit Logs Policies
DROP POLICY IF EXISTS "Audit logs readable by staff" ON public.staff_audit_logs;
CREATE POLICY "Audit logs readable by staff" ON public.staff_audit_logs
  FOR SELECT USING (public.is_staff());

DROP POLICY IF EXISTS "Staff can insert audit logs" ON public.staff_audit_logs;
CREATE POLICY "Staff can insert audit logs" ON public.staff_audit_logs
  FOR INSERT WITH CHECK (public.is_staff());

-- Questions Policy Update for Approval Workflow
DROP POLICY IF EXISTS "Public Read Questions" ON public.questions;
CREATE POLICY "Public Read Questions" ON public.questions
  FOR SELECT USING (
    ((deleted_at IS NULL AND approval_status = 'published' AND COALESCE(verified, true) = true))
    OR public.is_staff()
  );

DROP POLICY IF EXISTS "Staff insert questions" ON public.questions;
CREATE POLICY "Staff insert questions" ON public.questions
  FOR INSERT WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS "Staff update questions" ON public.questions;
CREATE POLICY "Staff update questions" ON public.questions
  FOR UPDATE USING (public.is_staff()) WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS "Staff delete questions" ON public.questions;
CREATE POLICY "Staff delete questions" ON public.questions
  FOR DELETE USING (public.is_super_admin() OR public.can_review_questions());

-- Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.staff_invitations TO authenticated;
GRANT SELECT, INSERT ON TABLE public.staff_audit_logs TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_staff_role(UUID) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.is_super_admin() TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.is_staff() TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.can_review_questions() TO authenticated, anon, service_role;
