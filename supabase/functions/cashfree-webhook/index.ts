import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

/**
 * Cashfree webhook signature verification.
 * Docs: https://www.cashfree.com/docs/payments/online/webhooks/signature-verification.md
 *
 * expected = Base64(HMAC_SHA256(timestamp + RAW_BODY, secretKey))
 * The signature must be computed over the exact raw body, never a parsed/re-serialised object.
 */
function constantTimeEquals(a: string, b: string): boolean {
  if (a.length !== b.length) {
    // Do comparable work even on length mismatch to avoid a trivial timing oracle.
    let diff = a.length ^ b.length;
    for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ 0;
    return false;
  }
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function verifyCashfreeSignature(
  rawBody: string,
  signature: string,
  timestamp: string,
  secret: string
): Promise<boolean> {
  if (!signature || !timestamp || !secret) return false;

  try {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const signedPayload = encoder.encode(timestamp + rawBody);
    const signatureBytes = await crypto.subtle.sign("HMAC", key, signedPayload);
    const expected = btoa(String.fromCharCode(...new Uint8Array(signatureBytes)));
    return constantTimeEquals(expected, signature);
  } catch (err) {
    console.error("[Cashfree Webhook] Signature verification error:", err);
    return false;
  }
}

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

    // --- Signature verification (must run before any state change) ---
    let cashfreeSecret = Deno.env.get("CASHFREE_SECRET_KEY") || "";
    if (!cashfreeSecret) {
      // Same fallback used by create/verify Edge Functions: Admin Gateway Settings in DB.
      const adminClient = createClient(supabaseUrl, supabaseServiceKey);
      const { data: gwRow } = await adminClient
        .from("app_settings")
        .select("value")
        .eq("key", "payment_gateway_config")
        .maybeSingle();
      cashfreeSecret = (gwRow?.value?.cashfree?.secretKey || "").trim();
    }

    if (!cashfreeSecret) {
      console.error("[Cashfree Webhook] No secret key configured; cannot verify signature");
      return new Response(JSON.stringify({ error: "Webhook secret not configured" }), { status: 500 });
    }

    const rawBody = await req.text();
    const webhookSignature = req.headers.get("x-webhook-signature") || "";
    const webhookTimestamp = req.headers.get("x-webhook-timestamp") || "";

    if (!(await verifyCashfreeSignature(rawBody, webhookSignature, webhookTimestamp, cashfreeSecret))) {
      console.warn("[Cashfree Webhook] Invalid/missing signature - rejecting request");
      return new Response(JSON.stringify({ error: "Invalid webhook signature" }), { status: 401 });
    }
    // --- End signature verification ---

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
