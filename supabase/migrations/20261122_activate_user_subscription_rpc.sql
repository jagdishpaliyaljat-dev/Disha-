-- Atomic RPC to activate user subscription
CREATE OR REPLACE FUNCTION public.activate_user_subscription(
    p_user_id UUID,
    p_order_id TEXT,
    p_plan_id TEXT,
    p_cf_payment_id TEXT DEFAULT NULL,
    p_payment_method TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_expires_at TIMESTAMPTZ;
    v_result JSONB;
BEGIN
    -- Determine expiration date based on plan
    IF p_plan_id = 'monthly' THEN
        v_expires_at := now() + INTERVAL '30 days';
    ELSIF p_plan_id = 'yearly' THEN
        v_expires_at := now() + INTERVAL '365 days';
    ELSE -- lifetime
        v_expires_at := now() + INTERVAL '3650 days'; -- 10 years / lifetime
    END IF;

    -- 1. Update order status
    UPDATE public.orders
    SET status = 'PAID',
        cf_payment_id = COALESCE(p_cf_payment_id, cf_payment_id),
        payment_method = COALESCE(p_payment_method, payment_method),
        paid_at = now(),
        updated_at = now()
    WHERE order_id = p_order_id;

    -- 2. Insert or update subscription
    INSERT INTO public.user_subscriptions (
        user_id, plan_id, order_id, status, starts_at, expires_at, created_at, updated_at
    )
    VALUES (
        p_user_id, p_plan_id, p_order_id, 'active', now(), v_expires_at, now(), now()
    );

    -- 3. Update profiles table
    UPDATE public.profiles
    SET is_premium = true,
        premium_plan = p_plan_id,
        premium_until = v_expires_at,
        updated_at = now()
    WHERE id = p_user_id;

    v_result := jsonb_build_object(
        'success', true,
        'user_id', p_user_id,
        'order_id', p_order_id,
        'plan_id', p_plan_id,
        'is_premium', true,
        'expires_at', v_expires_at
    );

    RETURN v_result;
END;
$$;
