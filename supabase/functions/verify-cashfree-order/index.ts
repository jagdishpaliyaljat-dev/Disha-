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

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    let cashfreeAppId = Deno.env.get("CASHFREE_APP_ID") || "";
    let cashfreeSecret = Deno.env.get("CASHFREE_SECRET_KEY") || "";
    let cashfreeEnv = (Deno.env.get("CASHFREE_ENV") || "PRODUCTION").toUpperCase();

    // Fallback: Check app_settings table in DB
    if (!cashfreeAppId || !cashfreeSecret) {
      try {
        const { data: gwRow } = await supabaseAdmin
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
        console.warn("[verify-cashfree-order] Gateway config load note:", dbErr);
      }
    }

    const { orderId } = await req.json().catch(() => ({}));
    if (!orderId) {
      return new Response(
        JSON.stringify({ error: "Missing orderId" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 1. Fetch order directly from Cashfree API
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

    if (isPaid) {
      // Find plan_id and user_id from local order record or tags
      let planId = cfOrder.order_tags?.plan_id || "monthly";
      let targetUserId = cfOrder.order_tags?.user_id || cfOrder.customer_details?.customer_id;

      const { data: localOrder } = await supabaseAdmin
        .from("orders")
        .select("plan_id, user_id")
        .eq("order_id", orderId)
        .maybeSingle();

      if (localOrder?.plan_id) planId = localOrder.plan_id;
      if (localOrder?.user_id) targetUserId = localOrder.user_id;

      if (!targetUserId) {
        console.warn("[verify-cashfree-order] No user_id found for paid order:", orderId);
        return new Response(
          JSON.stringify({ success: false, error: "No user found for order" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Execute atomic activation RPC
      const { data: activationResult, error: rpcError } = await supabaseAdmin.rpc("activate_user_subscription", {
        p_user_id: targetUserId,
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
