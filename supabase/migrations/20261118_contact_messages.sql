-- ============================================================================
-- DISHA 20-20 — Contact Messages Table (Shared Storage)
-- File: supabase/migrations/20261118_contact_messages.sql
-- ============================================================================
-- Purpose: Shared contact-message storage so admin can read submissions from
-- any device. Falls back to localStorage when table/RLS unavailable.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.contact_messages (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    subject TEXT NOT NULL,
    message TEXT NOT NULL,
    status TEXT DEFAULT 'new' CHECK (status IN ('new','read','replied','archived')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.contact_messages ENABLE ROW LEVEL SECURITY;

-- PostgREST table privileges are required in addition to RLS policies.
GRANT INSERT ON TABLE public.contact_messages TO anon, authenticated;
GRANT SELECT, UPDATE, DELETE ON TABLE public.contact_messages TO authenticated;

-- Anyone (anon or authenticated) can submit a contact message.
CREATE POLICY "Anyone can submit contact message"
  ON public.contact_messages FOR INSERT
  WITH CHECK (true);

-- Only admins can read contact messages.
CREATE POLICY "Admins can view all contact messages"
  ON public.contact_messages FOR SELECT
  USING (public.is_admin());

-- Only admins can update contact messages (status changes).
CREATE POLICY "Admins can update contact messages"
  ON public.contact_messages FOR UPDATE
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Only admins can delete contact messages.
CREATE POLICY "Admins can delete contact messages"
  ON public.contact_messages FOR DELETE
  USING (public.is_admin());

-- Indexes for admin inbox performance.
CREATE INDEX IF NOT EXISTS idx_contact_messages_created
  ON public.contact_messages (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_contact_messages_status
  ON public.contact_messages (status);

ANALYZE public.contact_messages;
