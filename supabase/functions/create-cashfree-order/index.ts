import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

// Fixed plans. Unknown ids are rejected rather than silently mapped to the
// cheapest plan (which used to grant a 10-year "lifetime" subscription).
const PLANS: Record<string, { name: string; amount: number; days: number }> = {
  monthly: { name: "1 Month Pass", amount: 49.00, days: 30 },
  yearly: { name: "1 Year Super Pass", amount: 149.00, days: 365 },
  lifetime: { name: "Lifetime VIP Pass", amount: 249.00, days: 3650 },
};

const DEFAULT_RETURN_ORIGIN = "https://disha-2020.vercel.app";

function allowlistedOrigins(envValue: string): string[] {
  const fromEnv = (envValue || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return Array.from(new Set([DEFAULT_RETURN_ORIGIN, ...fromEnv]));
}

function corsHeaders(origin: string | null, allowed: string[]) {
  const allowedOrigin = origin && allowed.includes(origin) ? origin : allowed[0];
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

function safeReturnUrl(requested: unknown, orderId: string, allowed: string[]): string {
  const fallback = `${DEFAULT_RETURN_ORIGIN}/?order_id=${encodeURIComponent(orderId)}`;
  if (typeof requested !== "string" || !requested.startsWith("https://")) return fallback;
  try {
    const url = new URL(requested);
    if (!allowed.includes(url.origin)) return fallback;
    url.searchParams.set("order_id", orderId);
    return url.toString();
  } catch {
    return fallback;
  }
}

function makeOrderId(): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  const suffix = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `DPYQ_${Date.now()}_${suffix}`;
}

Deno.serve(async (req: Request) => {
  const returnOrigins = allowlistedOrigins(Deno.env.get("ALLOWED_RETURN_ORIGINS") || "");
  // WebView/Capacitor origins need CORS access but must NEVER be valid return URLs.
  const corsOrigins = Array.from(new Set([
    ...returnOrigins,
    "https://localhost",
    "http://localhost",
    "capacitor://localhost",
  ]));
  const cors = corsHeaders(req.headers.get("Origin"), corsOrigins);

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors });
  }
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

    // ---- 1. MANDATORY caller authentication (no anonymous order creation) ----
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
    if (!token || token === supabaseAnonKey) {
      return new Response(JSON.stringify({ error: "Please sign in before making a payment." }), {
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

    // ---- 2. Gateway credentials (env first, DB fallback via service role) ----
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
      console.error("[create-cashfree-order] Gateway credentials not configured");
      return new Response(JSON.stringify({ error: "Payment gateway is not configured." }), {
        status: 500,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // ---- 3. Body: only planId and returnUrl are accepted. Identity comes from JWT. ----
    const body = await req.json().catch(() => ({}));
    const planId = typeof body?.planId === "string" ? body.planId.trim() : "";
    if (!Object.prototype.hasOwnProperty.call(PLANS, planId)) {
      return new Response(JSON.stringify({ error: "Invalid subscription plan." }), {
        status: 400,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // ---- 4. Authoritative price from DB config; never from the browser ----
    let plan = PLANS[planId];
    const { data: configRow } = await supabaseAdmin
      .from("app_settings")
      .select("value")
      .eq("key", "premium_plans_config")
      .maybeSingle();

    if (configRow?.value && Array.isArray(configRow.value)) {
      const found = configRow.value.find((p: any) => p.id === planId);
      if (found && typeof found.amount === "number" && found.amount > 0 && found.amount < 1000000) {
        plan = { name: found.name || found.hindiName || plan.name, amount: Number(found.amount), days: plan.days };
      }
    }

    const orderId = makeOrderId();
    const baseUrl = cashfreeEnv === "SANDBOX" || cashfreeEnv === "TEST"
      ? "https://sandbox.cashfree.com/pg"
      : "https://api.cashfree.com/pg";

    const customerEmail = user.email || `student_${user.id.slice(0, 8)}@disha-pyq.app`;
    const customerName = user.user_metadata?.full_name || user.user_metadata?.name || "Student Aspirant";
    const customerPhone = user.phone || "9999999999";

    const orderPayload = {
      order_id: orderId,
      order_amount: plan.amount,
      order_currency: "INR",
      customer_details: {
        customer_id: user.id.substring(0, 50),
        customer_email: customerEmail,
        customer_phone: customerPhone,
        customer_name: customerName,
      },
      order_meta: {
        return_url: safeReturnUrl(body?.returnUrl, orderId, returnOrigins),
        notify_url: `${supabaseUrl}/functions/v1/cashfree-webhook`,
      },
      order_note: `Disha PYQ - ${plan.name}`,
      order_tags: { plan_id: planId, user_id: user.id },
    };

    // ---- 5. Create the Cashfree order ----
    const cfResponse = await fetch(`${baseUrl}/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-version": "2023-08-01",
        "x-client-id": cashfreeAppId,
        "x-client-secret": cashfreeSecret,
      },
      body: JSON.stringify(orderPayload),
    });
    const cfData = await cfResponse.json().catch(() => ({}));

    if (!cfResponse.ok || !cfData.payment_session_id) {
      console.error("[create-cashfree-order] Cashfree rejected order:", cfResponse.status, cfData?.message || cfData?.code);
      return new Response(JSON.stringify({ error: "Could not start payment. Please try again." }), {
        status: 502,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // ---- 6. Persist the order BEFORE handing the session to the browser ----
    const { error: dbError } = await supabaseAdmin.from("orders").insert({
      order_id: orderId,
      user_id: user.id,
      amount: plan.amount,
      currency: "INR",
      plan_id: planId,
      status: "PENDING",
      payment_session_id: cfData.payment_session_id,
    });

    if (dbError) {
      console.error("[create-cashfree-order] Failed to persist order:", dbError.message);
      return new Response(JSON.stringify({ error: "Could not record your order. Please try again." }), {
        status: 500,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        orderId,
        paymentSessionId: cfData.payment_session_id,
        amount: plan.amount,
        planId,
        planName: plan.name,
        environment: cashfreeEnv,
      }),
      { status: 200, headers: { ...cors, "Content-Type": "application/json" } },
    );
  } catch (err: any) {
    console.error("[create-cashfree-order] Exception:", err?.message || err);
    return new Response(JSON.stringify({ error: "Internal server error." }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
