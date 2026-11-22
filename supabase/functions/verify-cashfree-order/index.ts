import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";

    const cashfreeAppId = Deno.env.get("CASHFREE_APP_ID") || "";
    const cashfreeSecret = Deno.env.get("CASHFREE_SECRET_KEY") || "";
    const cashfreeEnv = (Deno.env.get("CASHFREE_ENV") || "PRODUCTION").toUpperCase();

    // 1. Verify User Session
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

    const { orderId } = await req.json();
    if (!orderId) {
      return new Response(
        JSON.stringify({ error: "Missing orderId" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Fetch order from Cashfree
    const cashfreeBaseUrl = cashfreeEnv === "SANDBOX" || cashfreeEnv === "TEST"
      ? "https://sandbox.cashfree.com/pg"
      : "https://api.cashfree.com/pg";

    const cfResponse = await fetch(`${cashfreeBaseUrl}/orders/${orderId}`, {
      method: "GET",
      headers: {
        "x-api-version": "2023-08-01",
        "x-client-id": cashfreeAppId,
        "x-client-secret": cashfreeSecret,
      },
    });

    const cfOrder = await cfResponse.json();

    if (!cfResponse.ok) {
      return new Response(
        JSON.stringify({ error: cfOrder.message || "Could not fetch order from Cashfree", details: cfOrder }),
        { status: cfResponse.status || 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const isPaid = cfOrder.order_status === "PAID";
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    if (isPaid) {
      // Find plan_id from local order record or tags
      let planId = cfOrder.order_tags?.plan_id || "monthly";
      const { data: localOrder } = await supabaseAdmin
        .from("orders")
        .select("plan_id, user_id")
        .eq("order_id", orderId)
        .maybeSingle();

      if (localOrder?.plan_id) {
        planId = localOrder.plan_id;
      }

      // Execute atomic activation RPC
      const { data: activationResult, error: rpcError } = await supabaseAdmin.rpc("activate_user_subscription", {
        p_user_id: user.id,
        p_order_id: orderId,
        p_plan_id: planId,
        p_cf_payment_id: cfOrder.cf_order_id ? String(cfOrder.cf_order_id) : null,
        p_payment_method: "ONLINE",
      });

      if (rpcError) {
        console.error("[Activation] RPC error:", rpcError);
      }

      return new Response(
        JSON.stringify({
          success: true,
          status: "PAID",
          isPremium: true,
          orderId: orderId,
          planId: planId,
          activation: activationResult,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        success: false,
        status: cfOrder.order_status,
        isPremium: false,
        orderId: orderId,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("[verify-cashfree-order] Exception:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
