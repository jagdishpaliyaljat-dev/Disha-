-- ============================================================================
-- DISHA 20-20 — Rollback: Contact Messages Table
-- File: supabase/migrations/20261118_contact_messages_rollback.sql
-- ============================================================================
-- DESTRUCTIVE: drops the shared contact inbox table and ALL stored messages.
-- Only run this if you intentionally want to remove the shared contact inbox
-- and return the app to its localStorage-only behaviour.
--
-- The application degrades gracefully: submitContactMessage() falls back to
-- localStorage when the table is unavailable, so no code change is required.
-- ============================================================================

DROP TABLE IF EXISTS public.contact_messages;
