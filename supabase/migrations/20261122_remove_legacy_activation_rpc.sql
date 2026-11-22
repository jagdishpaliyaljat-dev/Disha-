-- Run this in Supabase SQL Editor if the main hardening migration was applied
-- but the OLD 5-argument activation RPC still exists.
--
-- Symptom: PostgREST returns HTTP 300 / PGRST203:
--   "Could not choose the best candidate function between:
--    activate_user_subscription(..., text, text)
--    activate_user_subscription(..., text, text, numeric)"
--
-- That means BOTH the legacy 5-arg function and the hardened 6-arg function
-- exist. The legacy one must be removed — it has no ownership / status /
-- amount checks and (if still granted to anon/authenticated) is a free-VIP path.

DROP FUNCTION IF EXISTS public.activate_user_subscription(uuid, text, text, text, text);

-- Verify exactly one hardened function remains:
SELECT p.oid::regprocedure AS signature, p.prosecdef AS security_definer
FROM pg_proc p
WHERE p.pronamespace = 'public'::regnamespace
  AND p.proname = 'activate_user_subscription';

-- Verify anon/authenticated have NO execute rights (only service_role should):
SELECT grantee, privilege_type
FROM information_schema.role_routine_grants
WHERE routine_schema = 'public'
  AND routine_name = 'activate_user_subscription'
ORDER BY grantee;
