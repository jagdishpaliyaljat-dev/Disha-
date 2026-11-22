import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Plan configurations
const PLANS: Record<string, { name: string; amount: number; days: number }> = {
  monthly: { name: "1 Month Pass", amount: 49.00, days: 30 },
  yearly: { name: "1 Year Super Pass", amount: 149.00, days: 365 },
  lifetime: { name: "Lifetime VIP Pass", amount: 249.00, days: 3650 },
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";

    let cashfreeAppId = Deno.env.get("CASHFREE_APP_ID") || "";
    let cashfreeSecret = Deno.env.get("CASHFREE_SECRET_KEY") || "";
    let cashfreeEnv = (Deno.env.get("CASHFREE_ENV") || "PRODUCTION").toUpperCase();

    // Fallback: Check app_settings table if env secrets are not set
    if (!cashfreeAppId || !cashfreeSecret) {
      try {
        const supabaseAdminInit = createClient(supabaseUrl, supabaseServiceKey);
        const { data: gwRow } = await supabaseAdminInit
          .from("app_settings")
          .select("value")
          .eq("key", "payment_gateway_config")
          .maybeSingle();

        if (gwRow?.value?.cashfree?.appId && gwRow?.value?.cashfree?.secretKey) {
          cashfreeAppId = gwRow.value.cashfree.appId.trim();
          cashfreeSecret = gwRow.value.cashfree.secretKey.trim();
          if (gwRow.value.cashfree.environment) {
            cashfreeEnv = gwRow.value.cashfree.environment.toUpperCase();
          }
        }
      } catch (dbErr) {
        console.warn("[create-cashfree-order] Note: Could not load gateway config from DB:", dbErr);
      }
    }

    if (!cashfreeAppId || !cashfreeSecret) {
      return new Response(
        JSON.stringify({ 
          error: "Cashfree API credentials not configured in Supabase Secrets or Admin Gateway Settings (CASHFREE_APP_ID / CASHFREE_SECRET_KEY)" 
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 1. Verify User Session from Authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing Authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseAuthClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await supabaseAuthClient.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized user session" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const { planId, returnUrl } = await req.json();

    // Dynamically load pricing configured by Admin from app_settings
    let activePlan = PLANS[planId] || PLANS.monthly;
    try {
      const { data: configRow } = await supabaseAdmin
        .from("app_settings")
        .select("value")
        .eq("key", "premium_plans_config")
        .maybeSingle();

      if (configRow?.value && Array.isArray(configRow.value)) {
        const found = configRow.value.find((p: any) => p.id === planId);
        if (found && typeof found.amount === "number" && found.amount > 0) {
          activePlan = {
            name: found.name || found.hindiName || planId,
            amount: Number(found.amount),
            days: planId === "monthly" ? 30 : planId === "yearly" ? 365 : 3650,
          };
        }
      }
    } catch (cfgErr) {
      console.warn("Could not load dynamic plan, using static default:", cfgErr);
    }

    const plan = activePlan;

    const cashfreeBaseUrl = cashfreeEnv === "SANDBOX" || cashfreeEnv === "TEST"
      ? "https://sandbox.cashfree.com/pg"
      : "https://api.cashfree.com/pg";

    const uniqueSuffix = Math.random().toString(36).substring(2, 7);
    const orderId = `DPYQ_${Date.now()}_${uniqueSuffix}`;

    const customerPhone = user.phone || "9999999999";
    const customerEmail = user.email || `student_${user.id.slice(0, 8)}@disha-pyq.app`;
    const customerName = user.user_metadata?.full_name || user.user_metadata?.name || "Student Aspirant";

    const resolvedReturnUrl = returnUrl
      ? (returnUrl.includes("{order_id}") ? returnUrl : `${returnUrl}${returnUrl.includes("?") ? "&" : "?"}order_id=${orderId}`)
      : `https://disha-2020.vercel.app/?order_id=${orderId}`;

    const orderPayload = {
      order_id: orderId,
      order_amount: plan.amount,
      order_currency: "INR",
      customer_details: {
        customer_id: user.id,
        customer_email: customerEmail,
        customer_phone: customerPhone,
        customer_name: customerName,
      },
      order_meta: {
        return_url: resolvedReturnUrl,
        notify_url: `${supabaseUrl}/functions/v1/cashfree-webhook`,
      },
      order_note: `Disha PYQ - ${plan.name}`,
      order_tags: {
        plan_id: planId,
        user_id: user.id,
      },
    };

    // 2. Call Cashfree Orders API
    const cfResponse = await fetch(`${cashfreeBaseUrl}/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-version": "2023-08-01",
        "x-client-id": cashfreeAppId,
        "x-client-secret": cashfreeSecret,
      },
      body: JSON.stringify(orderPayload),
    });

    const cfData = await cfResponse.json();

    if (!cfResponse.ok || !cfData.payment_session_id) {
      console.error("[Cashfree] Order creation error:", cfData);
      return new Response(
        JSON.stringify({ 
          error: cfData.message || "Failed to create Cashfree order",
          details: cfData 
        }),
        { status: cfResponse.status || 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. Save Order to Supabase using Admin Client
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
      console.warn("[Orders] DB insert note:", dbError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        orderId: orderId,
        paymentSessionId: cfData.payment_session_id,
        amount: plan.amount,
        planId: planId,
        planName: plan.name,
        environment: cashfreeEnv,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("[create-cashfree-order] Exception:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
