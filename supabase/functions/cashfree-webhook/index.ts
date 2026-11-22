import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

/**
 * Cashfree webhook signature verification.
 * expected = Base64(HMAC_SHA256(timestamp + RAW_BODY, secretKey))
 * The signature must be computed over the exact raw body, never a re-serialised object.
 */
function constantTimeEquals(a: string, b: string): boolean {
  if (a.length !== b.length) {
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
    const signatureBytes = await crypto.subtle.sign(
      "HMAC",
      key,
      encoder.encode(timestamp + rawBody)
    );
    const expected = btoa(String.fromCharCode(...new Uint8Array(signatureBytes)));
    return constantTimeEquals(expected, signature);
  } catch (err) {
    console.error("[Cashfree Webhook] Signature verification error:", err?.message || err);
    return false;
  }
}

/** Reject webhooks older than 5 minutes (replay protection). */
function isFreshTimestamp(timestamp: string): boolean {
  if (!/^\d{10,17}$/.test(timestamp)) return false;
  const value = Number(timestamp);
  // 10 digits => seconds, 13+ digits => milliseconds.
  const millis = value > 100000000000 ? value : value * 1000;
  return Math.abs(Date.now() - millis) <= 5 * 60 * 1000;
}

const DEFAULT_ORIGIN = "https://disha-2020.vercel.app";

function corsHeaders(origin: string | null): Record<string, string> {
  const allowed = [DEFAULT_ORIGIN, "https://localhost", "http://localhost", "capacitor://localhost"];
  const allowOrigin = origin && allowed.includes(origin) ? origin : allowed[0];
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-webhook-signature, x-webhook-timestamp",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

Deno.serve(async (req: Request) => {
  const cors = corsHeaders(req.headers.get("Origin"));

  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // ---- 1. Secret (env first, service-role DB fallback) ----
    let cashfreeSecret = Deno.env.get("CASHFREE_SECRET_KEY") || "";
    let cashfreeEnv = (Deno.env.get("CASHFREE_ENV") || "PRODUCTION").toUpperCase();
    let cashfreeAppId = Deno.env.get("CASHFREE_APP_ID") || "";

    if (!cashfreeSecret) {
      const { data: gwRow } = await supabaseAdmin
        .from("app_settings")
        .select("value")
        .eq("key", "payment_gateway_config")
        .maybeSingle();
      cashfreeSecret = (gwRow?.value?.cashfree?.secretKey || "").trim();
      cashfreeAppId = (gwRow?.value?.cashfree?.appId || "").trim();
      if (gwRow?.value?.cashfree?.environment) {
        cashfreeEnv = String(gwRow.value.cashfree.environment).toUpperCase();
      }
    }

    if (!cashfreeSecret) {
      console.error("[Cashfree Webhook] Secret not configured");
      return new Response(JSON.stringify({ error: "Webhook secret not configured" }), { status: 500 });
    }

    // ---- 2. Signature + freshness BEFORE any state change ----
    const rawBody = await req.text();
    const webhookSignature = req.headers.get("x-webhook-signature") || "";
    const webhookTimestamp = req.headers.get("x-webhook-timestamp") || "";

    if (!(await verifyCashfreeSignature(rawBody, webhookSignature, webhookTimestamp, cashfreeSecret))) {
      console.warn("[Cashfree Webhook] Rejected: invalid signature");
      return new Response(JSON.stringify({ error: "Invalid webhook signature" }), { status: 401 });
    }
    if (!isFreshTimestamp(webhookTimestamp)) {
      console.warn("[Cashfree Webhook] Rejected: stale timestamp");
      return new Response(JSON.stringify({ error: "Stale webhook timestamp" }), { status: 401 });
    }

    let payload: any;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400 });
    }

    const eventType = String(payload.type || payload.event || "").toUpperCase();
    const orderId = payload.data?.order?.order_id || payload.orderId || payload.order_id;
    // Log identifiers only — never the raw payload (contains customer PII).
    console.log("[Cashfree Webhook] event:", eventType, "order:", orderId || "-");

    const isSuccess = [
      "PAYMENT_SUCCESS_WEBHOOK", "PAYMENT.SUCCESS", "PAYMENT_SUCCESS",
      "ORDER.PAID", "ORDER_PAID",
    ].includes(eventType)
      || String(payload.data?.payment?.payment_status || payload.txStatus || "").toUpperCase() === "SUCCESS"
      || String(payload.data?.order?.order_status || "").toUpperCase() === "PAID";

    if (!isSuccess) {
      return new Response(JSON.stringify({ status: "ignored" }), { status: 200 });
    }

    if (typeof orderId !== "string" || !/^[A-Za-z0-9_-]{4,80}$/.test(orderId)) {
      return new Response(JSON.stringify({ error: "Invalid order reference" }), { status: 400 });
    }

    // ---- 3. Trust ONLY the stored order; never payload userId/planId ----
    const { data: dbOrder, error: orderErr } = await supabaseAdmin
      .from("orders")
      .select("order_id, user_id, plan_id, amount")
      .eq("order_id", orderId)
      .maybeSingle();

    if (orderErr || !dbOrder?.user_id) {
      console.error("[Cashfree Webhook] No stored order for:", orderId);
      // Non-2xx so Cashfree retries in case this webhook beat the DB write.
      return new Response(JSON.stringify({ error: "Order not found" }), { status: 500 });
    }

    // ---- 4. Re-verify with Cashfree: real PAID status and amount ----
    const baseUrl = cashfreeEnv === "SANDBOX" || cashfreeEnv === "TEST"
      ? "https://sandbox.cashfree.com/pg"
      : "https://api.cashfree.com/pg";

    const cfResponse = await fetch(`${baseUrl}/orders/${encodeURIComponent(orderId)}`, {
      method: "GET",
      headers: {
        "x-api-version": "2023-08-01",
        "x-client-id": cashfreeAppId,
        "x-client-secret": cashfreeSecret,
      },
    });
    const cfOrder = await cfResponse.json().catch(() => ({}));

    if (!cfResponse.ok || cfOrder.order_status !== "PAID") {
      console.error("[Cashfree Webhook] Gateway does not confirm PAID status for:", orderId);
      return new Response(JSON.stringify({ error: "Payment not confirmed by gateway" }), { status: 409 });
    }

    const paidAmount = Number(cfOrder.order_amount);
    if (!Number.isFinite(paidAmount) || Math.abs(paidAmount - Number(dbOrder.amount)) > 1) {
      console.error("[Cashfree Webhook] Amount mismatch for:", orderId);
      return new Response(JSON.stringify({ error: "Amount mismatch" }), { status: 409 });
    }

    // ---- 5. Activate via the hardened, idempotent RPC.
    //    The RPC is now the ONLY writer; no direct profiles fallback exists.
    //    Replays are rejected by the RPC via the unique order_id + status check.
    const { error: rpcErr } = await supabaseAdmin.rpc("activate_user_subscription", {
      p_user_id: dbOrder.user_id,
      p_order_id: orderId,
      p_plan_id: dbOrder.plan_id,
      p_cf_payment_id: payload.data?.payment?.cf_payment_id
        ? String(payload.data.payment.cf_payment_id)
        : null,
      p_payment_method: payload.data?.payment?.payment_group || "ONLINE",
      p_paid_amount: paidAmount,
    });

    if (rpcErr) {
      console.error("[Cashfree Webhook] Activation failed for:", orderId, rpcErr.message);
      // Non-2xx -> Cashfree retries.
      return new Response(JSON.stringify({ error: "Activation failed" }), { status: 500 });
    }

    console.log("[Cashfree Webhook] Activated order:", orderId);
    return new Response(JSON.stringify({ status: "ok" }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...cors },
    });
  } catch (err: any) {
    console.error("[Cashfree Webhook] Error:", err?.message || err);
    return new Response(JSON.stringify({ error: "Internal server error" }), { status: 500 });
  }
});
