import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-webhook-signature, x-webhook-timestamp",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
      },
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

    const rawBody = await req.text();
    let payload: any = {};
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400 });
    }

    const eventType = (payload.type || payload.event || "").toUpperCase();
    console.log("[Cashfree Webhook] Received event:", eventType, "raw payload:", JSON.stringify(payload).slice(0, 300));

    const order = payload.data?.order;
    const payment = payload.data?.payment;
    const customer = payload.data?.customer_details;

    // Support both v3 nested format and legacy root format
    const orderId = order?.order_id || payload.orderId || payload.order_id;
    const paymentStatus = (payment?.payment_status || payload.txStatus || payload.payment_status || "").toUpperCase();
    const orderStatus = (order?.order_status || "").toUpperCase();

    const isSuccess =
      paymentStatus === "SUCCESS" ||
      orderStatus === "PAID" ||
      eventType === "PAYMENT_SUCCESS_WEBHOOK" ||
      eventType === "PAYMENT.SUCCESS" ||
      eventType === "PAYMENT_SUCCESS" ||
      eventType === "ORDER.PAID" ||
      eventType === "ORDER_PAID";

    if (orderId && isSuccess) {
      const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

      // 1. Find user and plan from database
      const { data: dbOrder } = await supabaseAdmin
        .from("orders")
        .select("user_id, plan_id")
        .eq("order_id", orderId)
        .maybeSingle();

      const userId = dbOrder?.user_id || customer?.customer_id || order?.order_tags?.user_id || payload.userId;
      const planId = dbOrder?.plan_id || order?.order_tags?.plan_id || payload.planId || "monthly";

      // 2. Mark order as PAID in orders table
      await supabaseAdmin
        .from("orders")
        .update({ status: "PAID", updated_at: new Date().toISOString() })
        .eq("order_id", orderId);

      // 3. Activate VIP Subscription for the user
      if (userId) {
        const { error: rpcErr } = await supabaseAdmin.rpc("activate_user_subscription", {
          p_user_id: userId,
          p_order_id: orderId,
          p_plan_id: planId,
          p_cf_payment_id: payment?.cf_payment_id ? String(payment.cf_payment_id) : (payload.referenceId ? String(payload.referenceId) : null),
          p_payment_method: payment?.payment_group || payload.paymentMode || "ONLINE",
        });

        if (rpcErr) {
          console.warn("[Cashfree Webhook] RPC note:", rpcErr);
          // Fallback: update profiles table directly if RPC encountered a constraint
          await supabaseAdmin
            .from("profiles")
            .update({ is_premium: true, subscription_tier: "vip", updated_at: new Date().toISOString() })
            .eq("id", userId);
        }

        console.log(`[Cashfree Webhook] Successfully activated subscription for user ${userId}, plan ${planId}`);
      }
    }

    return new Response(JSON.stringify({ status: "ok" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("[Cashfree Webhook] Error processing webhook:", err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
});
