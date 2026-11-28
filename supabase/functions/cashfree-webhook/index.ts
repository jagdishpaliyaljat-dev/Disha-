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

// Public HTTPS origin for CORS. Configure via APP_URL in Supabase secrets.
const DEFAULT_ORIGIN = (() => {
  const raw = Deno.env.get("APP_URL") || Deno.env.get("NEXT_PUBLIC_APP_URL") || Deno.env.get("SITE_URL") || "";
  try {
    if (raw) {
      const value = raw.trim();
      const url = new URL(value.includes("://") ? value : `https://${value}`);
      const host = url.hostname.toLowerCase();
      if (url.protocol === "https:" && host !== "localhost" && host !== "127.0.0.1" && host !== "::1" && !host.endsWith(".localhost")) {
        return url.origin;
      }
    }
  } catch {}
  return "https://disha-2020.vercel.app";
})();

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

function json(body: unknown, status: number, cors: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...cors },
  });
}

function baseUrlFor(cashfreeEnv: string): string {
  return cashfreeEnv === "SANDBOX" || cashfreeEnv === "TEST"
    ? "https://sandbox.cashfree.com/pg"
    : "https://api.cashfree.com/pg";
}

function subscriptionHeaders(appId: string, secret: string): Record<string, string> {
  return {
    "Content-Type": "application/json",
    "x-api-version": "2026-01-01",
    "x-client-id": appId,
    "x-client-secret": secret,
  };
}

type Db = ReturnType<typeof createClient>;

/** Extract subscription identifiers from v2023/v2025/v2026 webhook shapes. */
function subscriptionIds(payload: any) {
  const d = payload?.data || {};
  const details = d.subscription_details || {};
  const subscriptionId = String(
    d.subscription_id || details.subscription_id || payload.subscription_id || ""
  );
  const cfSubscriptionId = String(
    d.cf_subscription_id || details.cf_subscription_id || ""
  );
  const cfPaymentId = String(
    d.cf_payment_id || d.payment?.cf_payment_id || d.payment_id || ""
  );
  return { subscriptionId, cfSubscriptionId, cfPaymentId, data: d, details };
}

const AUTH_SUCCESS = ["SUCCESS", "ACTIVE", "AUTHORIZED", "AUTHORISED"];
const CANCEL_STATUSES = ["CANCELLED", "CUSTOMER_CANCELLED", "EXPIRED", "COMPLETED", "CARD_EXPIRED", "LINK_EXPIRED"];

/** Handle SUBSCRIPTION_* events. Returns null when the event is not a subscription event. */
async function handleSubscriptionEvent(
  payload: any,
  eventType: string,
  supabaseAdmin: Db,
  cashfreeAppId: string,
  cashfreeSecret: string,
  cashfreeEnv: string,
  cors: Record<string, string>
): Promise<Response | null> {
  const { subscriptionId, cfSubscriptionId, cfPaymentId, data, details } = subscriptionIds(payload);
  if (!subscriptionId || !/^[A-Za-z0-9_.-]{4,120}$/.test(subscriptionId)) {
    return json({ error: "Invalid subscription reference" }, 400, cors);
  }

  console.log("[Cashfree Webhook] subscription event:", eventType, "subscription:", subscriptionId);

  // Trust ONLY the stored subscription; never payload userId/planId/amount.
  const { data: dbSub, error: subErr } = await supabaseAdmin
    .from("cashfree_subscriptions")
    .select("subscription_id, cf_subscription_id, user_id, order_id, plan_id, recurring_amount, status")
    .eq("subscription_id", subscriptionId)
    .maybeSingle();

  if (subErr || !dbSub?.user_id) {
    console.error("[Cashfree Webhook] No stored subscription for:", subscriptionId);
    // Non-2xx so Cashfree retries in case this event beat our DB write.
    return json({ error: "Subscription not found" }, 500, cors);
  }

  // Authoritative re-fetch from Cashfree before any state change.
  const cfResponse = await fetch(
    `${baseUrlFor(cashfreeEnv)}/subscriptions/${encodeURIComponent(subscriptionId)}`,
    { method: "GET", headers: subscriptionHeaders(cashfreeAppId, cashfreeSecret) }
  );
  const cfSub = await cfResponse.json().catch(() => ({}));

  if (!cfResponse.ok) {
    console.error("[Cashfree Webhook] Gateway could not confirm subscription:", subscriptionId, cfResponse.status);
    return json({ error: "Subscription not confirmed by gateway" }, 409, cors);
  }

  // Bind the gateway record to the DB record (prevents cross-account mix-ups).
  const gatewayCfId = String(cfSub.cf_subscription_id || "");
  if (
    cfSubscriptionId && dbSub.cf_subscription_id &&
    cfSubscriptionId !== dbSub.cf_subscription_id
  ) {
    return json({ error: "Subscription reference mismatch" }, 409, cors);
  }
  if (gatewayCfId && dbSub.cf_subscription_id && gatewayCfId !== String(dbSub.cf_subscription_id)) {
    return json({ error: "Gateway subscription mismatch" }, 409, cors);
  }

  const status = String(
    cfSub.subscription_status || details.subscription_status || data.subscription_status || ""
  ).toUpperCase();
  const authStatus = String(
    cfSub.authorization_details?.authorization_status ||
    data.authorization_details?.authorization_status ||
    data.authorizationStatus || ""
  ).toUpperCase();
  const authAmount = Number(
    cfSub.authorization_details?.authorization_amount ??
    data.authorization_details?.authorization_amount ??
    1
  );
  const nextChargeAt = cfSub.next_schedule_date || cfSub.subscription_first_charge_time || null;

  // ---- Mandate authorised: activate the 7-day trial via the hardened RPC ----
  const isAuthEvent = eventType === "SUBSCRIPTION_AUTH_STATUS";
  const isStatusEvent = eventType === "SUBSCRIPTION_STATUS_CHANGED" || eventType === "SUBSCRIPTION_STATUS_CHANGE";

  if (isAuthEvent || isStatusEvent) {
    if (!AUTH_SUCCESS.includes(authStatus) && status !== "ACTIVE") {
      // Record the status but do not grant access.
      await supabaseAdmin.rpc("mark_cashfree_subscription", {
        p_subscription_id: subscriptionId,
        p_status: status || "INITIALIZED",
        p_authorization_status: authStatus || null,
        p_next_charge_at: nextChargeAt,
      });
      return json({ status: "pending" }, 200, cors);
    }

    if (Math.abs(authAmount - Number(dbSub.recurring_amount)) > 500 &&
        Math.abs(authAmount - 1) > 1) {
      console.error("[Cashfree Webhook] Unexpected authorisation amount:", authAmount);
      return json({ error: "Authorisation amount mismatch" }, 409, cors);
    }

    const { error: rpcErr } = await supabaseAdmin.rpc("activate_user_subscription", {
      p_user_id: dbSub.user_id,
      p_order_id: dbSub.order_id,
      p_plan_id: dbSub.plan_id,
      p_cf_payment_id: cfPaymentId || String(cfSub.authorization_details?.payment_id || "") || null,
      p_payment_method: String(cfSub.authorization_details?.payment_group || data.payment_type || "UPI_AUTOPAY"),
      p_paid_amount: authAmount,
    });

    if (rpcErr) {
      console.error("[Cashfree Webhook] Trial activation failed:", subscriptionId, rpcErr.message);
      return json({ error: "Trial activation failed" }, 500, cors);
    }

    await supabaseAdmin.rpc("mark_cashfree_subscription", {
      p_subscription_id: subscriptionId,
      p_status: "ACTIVE",
      p_authorization_status: authStatus || "ACTIVE",
      p_next_charge_at: nextChargeAt,
    });

    console.log("[Cashfree Webhook] Activated AutoPay trial:", subscriptionId);
    return json({ status: "ok", activated: "trial" }, 200, cors);
  }

  // ---- Recurring charge success: extend VIP idempotently ----
  if (eventType === "SUBSCRIPTION_PAYMENT_SUCCESS") {
    let paidAmount = Number(
      data.payment_amount ?? data.amount ?? data.payment?.payment_amount ??
      data.order?.order_amount ?? data.payment_details?.amount ?? 0
    );

    // When the gateway gives us an order id, re-verify the PAID amount there.
    const cfOrderId = String(data.cf_order_id || data.order_id || "");
    if (/^\d{4,}$/.test(cfOrderId)) {
      const orderResponse = await fetch(
        `${baseUrlFor(cashfreeEnv)}/orders/${encodeURIComponent(cfOrderId)}`,
        { method: "GET", headers: subscriptionHeaders(cashfreeAppId, cashfreeSecret) }
      );
      const cfOrder = await orderResponse.json().catch(() => ({}));
      if (!orderResponse.ok || cfOrder.order_status !== "PAID") {
        console.error("[Cashfree Webhook] Recurring payment not confirmed:", cfOrderId);
        return json({ error: "Payment not confirmed by gateway" }, 409, cors);
      }
      paidAmount = Number(cfOrder.order_amount);
    }

    if (!Number.isFinite(paidAmount) || paidAmount < Number(dbSub.recurring_amount) - 1) {
      console.error("[Cashfree Webhook] Renewal amount mismatch:", subscriptionId, paidAmount);
      return json({ error: "Amount mismatch" }, 409, cors);
    }
    if (status && !["ACTIVE", "ON_HOLD"].includes(status)) {
      return json({ error: "Subscription is not active" }, 409, cors);
    }
    if (!cfPaymentId) {
      return json({ error: "Missing payment reference" }, 400, cors);
    }

    const { error: renewErr } = await supabaseAdmin.rpc("activate_cashfree_subscription_renewal", {
      p_subscription_id: subscriptionId,
      p_cf_payment_id: cfPaymentId,
      p_paid_amount: paidAmount,
      p_next_charge_at: nextChargeAt,
    });

    if (renewErr) {
      console.error("[Cashfree Webhook] Renewal activation failed:", subscriptionId, renewErr.message);
      return json({ error: "Renewal activation failed" }, 500, cors);
    }

    console.log("[Cashfree Webhook] Renewed AutoPay:", subscriptionId, "payment:", cfPaymentId);
    return json({ status: "ok", activated: "renewal" }, 200, cors);
  }

  // ---- Cancellation / pause / other lifecycle events: record only ----
  if (isStatusEvent || CANCEL_STATUSES.includes(status)) {
    await supabaseAdmin.rpc("mark_cashfree_subscription", {
      p_subscription_id: subscriptionId,
      p_status: status || "UNKNOWN",
      p_authorization_status: authStatus || null,
      p_next_charge_at: nextChargeAt,
    });
  }

  return json({ status: "ignored" }, 200, cors);
}

Deno.serve(async (req: Request) => {
  const cors = corsHeaders(req.headers.get("Origin"));

  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405, cors);
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
      return json({ error: "Webhook secret not configured" }, 500, cors);
    }

    // ---- 2. Signature + freshness BEFORE any state change ----
    const rawBody = await req.text();
    const webhookSignature = req.headers.get("x-webhook-signature") || "";
    const webhookTimestamp = req.headers.get("x-webhook-timestamp") || "";

    if (!(await verifyCashfreeSignature(rawBody, webhookSignature, webhookTimestamp, cashfreeSecret))) {
      console.warn("[Cashfree Webhook] Rejected: invalid signature");
      return json({ error: "Invalid webhook signature" }, 401, cors);
    }
    if (!isFreshTimestamp(webhookTimestamp)) {
      console.warn("[Cashfree Webhook] Rejected: stale timestamp");
      return json({ error: "Stale webhook timestamp" }, 401, cors);
    }

    let payload: any;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return json({ error: "Invalid JSON" }, 400, cors);
    }

    const eventType = String(payload.type || payload.event || "").toUpperCase();
    console.log("[Cashfree Webhook] event:", eventType);

    // ---- 3. Subscription lifecycle events ----
    if (eventType.startsWith("SUBSCRIPTION_")) {
      const response = await handleSubscriptionEvent(
        payload, eventType, supabaseAdmin, cashfreeAppId, cashfreeSecret, cashfreeEnv, cors
      );
      if (response) return response;
    }

    // ---- 4. Ordinary one-time payment events ----
    const orderId = payload.data?.order?.order_id || payload.orderId || payload.order_id;
    const isSuccess = [
      "PAYMENT_SUCCESS_WEBHOOK", "PAYMENT.SUCCESS", "PAYMENT_SUCCESS",
      "ORDER.PAID", "ORDER_PAID",
    ].includes(eventType)
      || String(payload.data?.payment?.payment_status || payload.txStatus || "").toUpperCase() === "SUCCESS"
      || String(payload.data?.order?.order_status || "").toUpperCase() === "PAID";

    if (!isSuccess) {
      return json({ status: "ignored" }, 200, cors);
    }

    if (typeof orderId !== "string" || !/^[A-Za-z0-9_-]{4,80}$/.test(orderId)) {
      return json({ error: "Invalid order reference" }, 400, cors);
    }

    // Trust ONLY the stored order; never payload userId/planId.
    const { data: dbOrder, error: orderErr } = await supabaseAdmin
      .from("orders")
      .select("order_id, user_id, plan_id, amount")
      .eq("order_id", orderId)
      .maybeSingle();

    if (orderErr || !dbOrder?.user_id) {
      console.error("[Cashfree Webhook] No stored order for:", orderId);
      return json({ error: "Order not found" }, 500, cors);
    }

    const cfResponse = await fetch(`${baseUrlFor(cashfreeEnv)}/orders/${encodeURIComponent(orderId)}`, {
      method: "GET",
      headers: subscriptionHeaders(cashfreeAppId, cashfreeSecret),
    });
    const cfOrder = await cfResponse.json().catch(() => ({}));

    if (!cfResponse.ok || cfOrder.order_status !== "PAID") {
      console.error("[Cashfree Webhook] Gateway does not confirm PAID status for:", orderId);
      return json({ error: "Payment not confirmed by gateway" }, 409, cors);
    }

    const paidAmount = Number(cfOrder.order_amount);
    if (!Number.isFinite(paidAmount) || Math.abs(paidAmount - Number(dbOrder.amount)) > 1) {
      console.error("[Cashfree Webhook] Amount mismatch for:", orderId);
      return json({ error: "Amount mismatch" }, 409, cors);
    }

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
      return json({ error: "Activation failed" }, 500, cors);
    }

    console.log("[Cashfree Webhook] Activated order:", orderId);
    return json({ status: "ok" }, 200, cors);
  } catch (err: any) {
    console.error("[Cashfree Webhook] Error:", err?.message || err);
    return json({ error: "Internal server error" }, 500, cors);
  }
});
