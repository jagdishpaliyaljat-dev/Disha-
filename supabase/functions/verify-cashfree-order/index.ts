import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

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
  const allowed = [
    DEFAULT_ORIGIN,
    ...(Deno.env.get("ALLOWED_RETURN_ORIGINS") || "").split(",").map((s) => s.trim()).filter(Boolean),
    "https://localhost",
    "http://localhost",
    "capacitor://localhost",
  ];
  const allowOrigin = origin && allowed.includes(origin) ? origin : allowed[0];
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // ---- 1. MANDATORY caller authentication ----
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
    if (!token || token === supabaseAnonKey) {
      return new Response(JSON.stringify({ error: "Please sign in to verify a payment." }), {
        status: 401,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const authClient = createClient(supabaseUrl, supabaseAnonKey);
    const { data: { user }, error: authError } = await authClient.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Session expired. Please sign in again." }), {
        status: 401,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const { orderId } = await req.json().catch(() => ({}));
    if (typeof orderId !== "string" || !/^[A-Za-z0-9_-]{4,80}$/.test(orderId)) {
      return new Response(JSON.stringify({ error: "Invalid order reference." }), {
        status: 400,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // ---- 2. Trusted local order record (also enforces ownership) ----
    const { data: localOrder, error: orderErr } = await supabaseAdmin
      .from("orders")
      .select("order_id, user_id, plan_id, amount, status")
      .eq("order_id", orderId)
      .maybeSingle();

    if (orderErr || !localOrder) {
      console.warn("[verify-cashfree-order] Unknown order referenced");
      return new Response(JSON.stringify({ error: "Order not found." }), {
        status: 404,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    if (localOrder.user_id !== user.id) {
      return new Response(JSON.stringify({ error: "This order belongs to another account." }), {
        status: 403,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // ---- 3. Gateway credentials ----
    let cashfreeAppId = Deno.env.get("CASHFREE_APP_ID") || "";
    let cashfreeSecret = Deno.env.get("CASHFREE_SECRET_KEY") || "";
    let cashfreeEnv = (Deno.env.get("CASHFREE_ENV") || "PRODUCTION").toUpperCase();

    if (!cashfreeAppId || !cashfreeSecret) {
      const { data: gwRow } = await supabaseAdmin
        .from("app_settings")
        .select("value")
        .eq("key", "payment_gateway_config")
        .maybeSingle();
      cashfreeAppId = (gwRow?.value?.cashfree?.appId || "").trim();
      cashfreeSecret = (gwRow?.value?.cashfree?.secretKey || "").trim();
      if (gwRow?.value?.cashfree?.environment) {
        cashfreeEnv = String(gwRow.value.cashfree.environment).toUpperCase();
      }
    }

    if (!cashfreeAppId || !cashfreeSecret) {
      console.error("[verify-cashfree-order] Gateway credentials not configured");
      return new Response(JSON.stringify({ error: "Payment gateway is not configured." }), {
        status: 500,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const baseUrl = cashfreeEnv === "SANDBOX" || cashfreeEnv === "TEST"
      ? "https://sandbox.cashfree.com/pg"
      : "https://api.cashfree.com/pg";

    // ---- 4. Ask Cashfree itself; never trust a client-supplied status ----
    const cfResponse = await fetch(`${baseUrl}/orders/${encodeURIComponent(orderId)}`, {
      method: "GET",
      headers: {
        "x-api-version": "2023-08-01",
        "x-client-id": cashfreeAppId,
        "x-client-secret": cashfreeSecret,
      },
    });
    const cfOrder = await cfResponse.json().catch(() => ({}));

    if (!cfResponse.ok) {
      console.error("[verify-cashfree-order] Cashfree fetch failed:", cfResponse.status, cfOrder?.message || cfOrder?.code);
      return new Response(JSON.stringify({ error: "Could not verify payment with the gateway." }), {
        status: 502,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    if (cfOrder.order_status !== "PAID") {
      return new Response(JSON.stringify({
        success: false,
        status: cfOrder.order_status || "UNKNOWN",
        isPremium: false,
        orderId,
      }), { status: 200, headers: { ...cors, "Content-Type": "application/json" } });
    }

    // ---- 5. Amount reconciliation ----
    const paidAmount = Number(cfOrder.order_amount);
    if (!Number.isFinite(paidAmount) || Math.abs(paidAmount - Number(localOrder.amount)) > 1) {
      console.error("[verify-cashfree-order] Amount mismatch for order:", orderId);
      return new Response(JSON.stringify({ error: "Payment amount does not match this order." }), {
        status: 409,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // ---- 6. Activate. RPC error is fatal: never claim success on failure. ----
    const { data: activationResult, error: rpcError } = await supabaseAdmin.rpc("activate_user_subscription", {
      p_user_id: localOrder.user_id,
      p_order_id: orderId,
      p_plan_id: localOrder.plan_id,
      p_cf_payment_id: cfOrder.cf_order_id ? String(cfOrder.cf_order_id) : null,
      p_payment_method: "ONLINE",
      p_paid_amount: paidAmount,
    });

    if (rpcError) {
      console.error("[verify-cashfree-order] Activation failed:", rpcError.message);
      return new Response(JSON.stringify({ error: "Payment verified but activation is pending. Please contact support." }), {
        status: 500,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({
      success: true,
      status: "PAID",
      isPremium: true,
      orderId,
      planId: localOrder.plan_id,
      activation: activationResult,
    }), { status: 200, headers: { ...cors, "Content-Type": "application/json" } });
  } catch (err: any) {
    console.error("[verify-cashfree-order] Exception:", err?.message || err);
    return new Response(JSON.stringify({ error: "Internal server error." }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
