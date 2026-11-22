-- Migration: 20261122_restrict_gateway_config_read.sql
--
-- PROBLEM:
--   app_settings has a public SELECT policy (USING true). The Cashfree secret key
--   is stored in the `payment_gateway_config` row, so ANY client holding the
--   public/anon key can read the live secret key.
--
-- FIX:
--   Exclude `payment_gateway_config` from the public SELECT policy.
--
--   - Regular users: can no longer read the gateway credentials row.
--   - Admins: still read it via the existing "Admins can manage app_settings"
--     FOR ALL policy (is_admin() based on JWT role/email).
--   - Edge Functions: use SUPABASE_SERVICE_ROLE_KEY, which bypasses RLS, so
--     create-cashfree-order / verify-cashfree-order / cashfree-webhook keep
--     reading the secret exactly as before. No function code change needed
--     for this part.
--
-- NOTE: This secret was publicly readable before this migration. Rotate it in
-- the Cashfree dashboard and update app_settings + MCP config after applying.

DROP POLICY IF EXISTS "Public can view app_settings" ON public.app_settings;

CREATE POLICY "Public can view app_settings"
  ON public.app_settings
  FOR SELECT
  USING (key <> 'payment_gateway_config');

-- Defense in depth: explicit admin read for the sensitive row.
-- (The FOR ALL "Admins can manage app_settings" policy already covers this.)
DROP POLICY IF EXISTS "Admins can view gateway config" ON public.app_settings;
CREATE POLICY "Admins can view gateway config"
  ON public.app_settings
  FOR SELECT
  USING (key = 'payment_gateway_config' AND public.is_admin());
