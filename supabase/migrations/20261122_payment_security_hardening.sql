-- ============================================================================
-- PAYMENT SECURITY HARDENING (run in Supabase SQL Editor)
--
-- Fixes:
--  1. activate_user_subscription was SECURITY DEFINER with default PUBLIC
--     EXECUTE -> anyone with the public anon key could activate VIP for free.
--  2. Unknown plan ids were mapped to a 10-year duration.
--  3. No order ownership / status / amount checks, no idempotency.
--  4. is_admin() and protect_profiles_role() trusted user-metadata.email,
--     which a signed-in user can edit themselves.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Remove duplicates so a unique index can be installed safely.
-- ----------------------------------------------------------------------------
DELETE FROM public.user_subscriptions a
USING public.user_subscriptions b
WHERE a.order_id IS NOT NULL
  AND a.order_id = b.order_id
  AND a.created_at < b.created_at;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_user_subscriptions_order_id
  ON public.user_subscriptions (order_id)
  WHERE order_id IS NOT NULL;

-- ----------------------------------------------------------------------------
-- 2. Replace the activation RPC.
--    Signature note: the old 5-argument function is dropped and replaced with
--    the same 5 arguments plus an OPTIONAL 6th (p_paid_amount), so all existing
--    callers keep working unchanged.
-- ----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.activate_user_subscription(uuid, text, text, text, text);

CREATE OR REPLACE FUNCTION public.activate_user_subscription(
    p_user_id UUID,
    p_order_id TEXT,
    p_plan_id TEXT,
    p_cf_payment_id TEXT DEFAULT NULL,
    p_payment_method TEXT DEFAULT NULL,
    p_paid_amount NUMERIC DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_order          public.orders%ROWTYPE;
    v_days           INTEGER;
    v_expected       NUMERIC;
    v_expires_at     TIMESTAMPTZ;
    v_updated        INTEGER := 0;
    v_existing       public.user_subscriptions%ROWTYPE;
BEGIN
    -- ---- 2a. Plan whitelist: never derive duration from an arbitrary string.
    v_days := CASE p_plan_id
        WHEN 'monthly'  THEN 30
        WHEN 'yearly'   THEN 365
        WHEN 'lifetime' THEN 3650
        ELSE NULL
    END;

    IF v_days IS NULL THEN
        RAISE EXCEPTION 'Invalid plan id: %', p_plan_id;
    END IF;

    -- ---- 2b. Lock the order and validate ownership / state.
    SELECT * INTO v_order
    FROM public.orders
    WHERE order_id = p_order_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Order not found';
    END IF;

    IF v_order.user_id <> p_user_id THEN
        RAISE EXCEPTION 'Order does not belong to this user';
    END IF;

    -- Idempotent replay: if the order was already activated, return the
    -- existing subscription instead of extending it again.
    SELECT * INTO v_existing
    FROM public.user_subscriptions
    WHERE order_id = p_order_id
    LIMIT 1;

    IF v_order.status = 'PAID' AND FOUND THEN
        RETURN jsonb_build_object(
            'success', true,
            'already_active', true,
            'user_id', p_user_id,
            'order_id', p_order_id,
            'plan_id', v_existing.plan_id,
            'expires_at', v_existing.expires_at
        );
    END IF;

    IF v_order.status NOT IN ('PENDING', 'PENDING_VERIFICATION') THEN
        RAISE EXCEPTION 'Order is not in an activatable state: %', v_order.status;
    END IF;

    -- ---- 2c. Amount reconciliation.
    -- Expected price comes from the admin-controlled plan config in the DB,
    -- never from the client. If the config is absent, fall back to the
    -- amount already stored on the order (created server-side by Edge Function).
    SELECT (elem ->> 'amount')::numeric
      INTO v_expected
      FROM public.app_settings s,
           jsonb_array_elements(s.value) AS elem
     WHERE s.key = 'premium_plans_config'
       AND elem ->> 'id' = p_plan_id
     LIMIT 1;

    IF v_expected IS NOT NULL AND v_order.amount < v_expected THEN
        RAISE EXCEPTION 'Paid amount (%) is below the configured plan price (%)', v_order.amount, v_expected;
    END IF;

    IF p_paid_amount IS NOT NULL
       AND abs(p_paid_amount - v_order.amount) > 1 THEN
        RAISE EXCEPTION 'Paid amount does not match the stored order amount';
    END IF;

    -- ---- 2d. Atomic state transition + activation.
    UPDATE public.orders
       SET status = 'PAID',
           cf_payment_id = COALESCE(p_cf_payment_id, cf_payment_id),
           payment_method = COALESCE(p_payment_method, payment_method),
           paid_at = now(),
           updated_at = now()
     WHERE order_id = p_order_id
       AND status IN ('PENDING', 'PENDING_VERIFICATION');

    GET DIAGNOSTICS v_updated = ROW_COUNT;

    IF v_updated = 0 THEN
        RAISE EXCEPTION 'Order was already activated by a concurrent request';
    END IF;

    v_expires_at := now() + make_interval(days => v_days);

    INSERT INTO public.user_subscriptions (
        user_id, plan_id, order_id, status, starts_at, expires_at, created_at, updated_at
    )
    VALUES (
        p_user_id, p_plan_id, p_order_id, 'active', now(), v_expires_at, now(), now()
    )
    ON CONFLICT (order_id) DO NOTHING;

    UPDATE public.profiles
       SET is_premium = true,
           premium_plan = p_plan_id,
           premium_until = v_expires_at,
           updated_at = now()
     WHERE id = p_user_id;

    RETURN jsonb_build_object(
        'success', true,
        'already_active', false,
        'user_id', p_user_id,
        'order_id', p_order_id,
        'plan_id', p_plan_id,
        'is_premium', true,
        'expires_at', v_expires_at
    );
END;
$$;

-- CRITICAL: remove the default PUBLIC grant. Only server-side Edge Functions
-- may call this function. Client code must use verified endpoints instead.
REVOKE ALL ON FUNCTION public.activate_user_subscription(uuid, text, text, text, text, numeric)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.activate_user_subscription(uuid, text, text, text, text, numeric)
  TO service_role;

-- ----------------------------------------------------------------------------
-- 3. Admin checks: stop trusting user_metadata.email (user-editable).
--    Top-level `email` in a Supabase JWT is signed and cannot be self-edited.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
    OR (LOWER(auth.jwt() ->> 'email') IN (
         'jagdishpaliyaljat@gmail.com',
         'jagdishpaliyaljat2003@gmail.com',
         'zdpaliyal@gmail.com',
         'kamleshchoudhary96022@gmail.com',
         'disha2020prep@gmail.com'
       ))
    OR EXISTS (
         SELECT 1 FROM public.profiles
         WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
       ),
    false
  );
$$;

-- protect_profiles_role(): same fix (the user_metadata branch allowed role
-- escalation by editing your own user metadata).
CREATE OR REPLACE FUNCTION public.protect_profiles_role()
RETURNS TRIGGER AS $$
DECLARE
  v_caller_email text;
  v_is_super boolean;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.role IS NOT DISTINCT FROM OLD.role THEN
      RETURN NEW;
    END IF;

    IF current_user = 'postgres' THEN
      RETURN NEW;
    END IF;

    v_caller_email := LOWER(COALESCE(auth.jwt() ->> 'email', ''));

    v_is_super := (
      (auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin'
      OR (v_caller_email IN (
        'jagdishpaliyaljat@gmail.com',
        'jagdishpaliyaljat2003@gmail.com',
        'zdpaliyal@gmail.com',
        'kamleshchoudhary96022@gmail.com',
        'disha2020prep@gmail.com'
      ))
    );

    IF NOT v_is_super THEN
      NEW.role := OLD.role;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- promote_user_to_admin(): remove the user_metadata fallback as well.
CREATE OR REPLACE FUNCTION public.promote_user_to_admin(target_user_id uuid, target_role text DEFAULT 'admin')
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_email text;
  v_is_super_admin boolean;
  v_target_email text;
BEGIN
  v_caller_email := LOWER(COALESCE(auth.jwt() ->> 'email', ''));
  v_is_super_admin := (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
    OR (v_caller_email IN (
      'jagdishpaliyaljat@gmail.com',
      'jagdishpaliyaljat2003@gmail.com',
      'zdpaliyal@gmail.com',
      'kamleshchoudhary96022@gmail.com',
      'disha2020prep@gmail.com'
    ))
  );

  IF NOT v_is_super_admin THEN
    RAISE EXCEPTION 'Unauthorized: only a super admin can change admin rights.';
  END IF;

  SELECT email INTO v_target_email FROM public.profiles WHERE id = target_user_id;
  IF LOWER(COALESCE(v_target_email, '')) IN (
    'jagdishpaliyaljat@gmail.com',
    'jagdishpaliyaljat2003@gmail.com',
    'zdpaliyal@gmail.com',
    'kamleshchoudhary96022@gmail.com',
    'disha2020prep@gmail.com'
  ) AND target_role <> 'admin' THEN
    RAISE EXCEPTION 'Super admin accounts cannot be demoted.';
  END IF;

  UPDATE public.profiles
     SET role = target_role, updated_at = now()
   WHERE id = target_user_id;

  -- Keep the signed JWT's app_metadata in sync for immediate admin checks.
  UPDATE auth.users
     SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('role', target_role)
   WHERE id = target_user_id;

  RETURN jsonb_build_object('success', true, 'user_id', target_user_id, 'role', target_role);
END;
$$;

REVOKE ALL ON FUNCTION public.promote_user_to_admin(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.promote_user_to_admin(uuid, text) TO authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 4. Admin approval of UPI orders must go through a service-role endpoint.
--    This function is callable only by authenticated admins. It never trusts
--    user_id / plan_id / amount from the browser; everything is read from the
--    stored order.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_get_pending_upi_orders()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  RETURN COALESCE(
    (
      SELECT jsonb_agg(
               jsonb_build_object(
                 'order_id', o.order_id,
                 'user_id', o.user_id,
                 'plan_id', o.plan_id,
                 'amount', o.amount,
                 'payment_method', o.payment_method,
                 'created_at', o.created_at
               )
               ORDER BY o.created_at DESC
             )
      FROM (
        SELECT * FROM public.orders
        WHERE status IN ('PENDING', 'PENDING_VERIFICATION')
        ORDER BY created_at DESC
        LIMIT 50
      ) o
    ),
    '[]'::jsonb
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_get_pending_upi_orders() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_pending_upi_orders() TO service_role;
