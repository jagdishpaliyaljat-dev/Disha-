import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const ADMIN_EMAILS = new Set([
  "jagdishpaliyaljat@gmail.com",
  "jagdishpaliyaljat2003@gmail.com",
  "zdpaliyal@gmail.com",
  "kamleshchoudhary96022@gmail.com",
  "disha2020prep@gmail.com",
]);

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

    // ---- MANDATORY admin authentication (signed JWT only) ----
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
    if (!token || token === supabaseAnonKey) {
      return new Response(JSON.stringify({ error: "Authentication required" }), {
        status: 401,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const authClient = createClient(supabaseUrl, supabaseAnonKey);
    const { data: { user }, error: authError } = await authClient.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Session expired" }), {
        status: 401,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const isAdmin =
      user.app_metadata?.role === "admin" ||
      ADMIN_EMAILS.has(String(user.email || "").toLowerCase());

    if (!isAdmin) {
      console.warn("[admin-manage-orders] Rejected non-admin caller");
      return new Response(JSON.stringify({ error: "Administrator access required" }), {
        status: 403,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || "");

    // ---- LIST pending orders ----
    if (action === "list") {
      const { data, error } = await supabaseAdmin
        .from("orders")
        .select("order_id, user_id, amount, plan_id, payment_method, status, created_at")
        .in("status", ["PENDING", "PENDING_VERIFICATION"])
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) {
        console.error("[admin-manage-orders] List failed:", error.message);
        return new Response(JSON.stringify({ error: "Could not load orders" }), {
          status: 500,
          headers: { ...cors, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ success: true, orders: data || [] }), {
        status: 200,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    if (action !== "approve" && action !== "reject") {
      return new Response(JSON.stringify({ error: "Invalid action" }), {
        status: 400,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const orderId = String(body?.orderId || "");
    if (!/^[A-Za-z0-9_-]{4,80}$/.test(orderId)) {
      return new Response(JSON.stringify({ error: "Invalid order reference" }), {
        status: 400,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // Always re-read the order server-side: never trust user/plan/amount from the browser.
    const { data: order, error: findErr } = await supabaseAdmin
      .from("orders")
      .select("order_id, user_id, plan_id, amount, status")
      .eq("order_id", orderId)
      .maybeSingle();

    if (findErr || !order) {
      return new Response(JSON.stringify({ error: "Order not found" }), {
        status: 404,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    if (!["PENDING", "PENDING_VERIFICATION"].includes(order.status)) {
      return new Response(JSON.stringify({ error: "Order is no longer pending" }), {
        status: 409,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    if (action === "approve") {
      const { error: rpcErr } = await supabaseAdmin.rpc("activate_user_subscription", {
        p_user_id: order.user_id,
        p_order_id: order.order_id,
        p_plan_id: order.plan_id,
        p_cf_payment_id: null,
        p_payment_method: "UPI_QR_MANUAL",
        p_paid_amount: Number(order.amount),
      });

      if (rpcErr) {
        console.error("[admin-manage-orders] Activation failed:", rpcErr.message);
        return new Response(JSON.stringify({ error: "Activation failed" }), {
          status: 500,
          headers: { ...cors, "Content-Type": "application/json" },
        });
      }
    } else {
      const { error: rejectErr } = await supabaseAdmin
        .from("orders")
        .update({ status: "REJECTED", updated_at: new Date().toISOString() })
        .eq("order_id", orderId)
        .in("status", ["PENDING", "PENDING_VERIFICATION"]);

      if (rejectErr) {
        console.error("[admin-manage-orders] Reject failed:", rejectErr.message);
        return new Response(JSON.stringify({ error: "Could not reject order" }), {
          status: 500,
          headers: { ...cors, "Content-Type": "application/json" },
        });
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("[admin-manage-orders] Exception:", err?.message || err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
