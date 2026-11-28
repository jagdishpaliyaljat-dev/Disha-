import { supabase } from "../../lib/supabase";
import confetti from "canvas-confetti";
import { Capacitor } from "@capacitor/core";
import { Browser } from "@capacitor/browser";

import {
  buildCashfreeReturnUrl,
  getCashfreeMode,
  getCheckoutBridgeUrl,
  getSubscriptionCheckoutBridgeUrl,
} from "../../config/paymentConfig";
import { 
  AdminPremiumPlan, 
  getActivePremiumPlans, 
  DEFAULT_PREMIUM_PLANS 
} from "./premiumConfigService";

export type PremiumPlan = AdminPremiumPlan;

/**
 * Returns currently active plans dynamically configured from Admin Panel / Supabase
 */
export function getPremiumPlansList(): PremiumPlan[] {
  const active = getActivePremiumPlans();
  return active.length > 0 ? active : DEFAULT_PREMIUM_PLANS;
}

export const PREMIUM_PLANS: PremiumPlan[] = getPremiumPlansList();

declare global {
  interface Window {
    Cashfree?: any;
  }
}

let cashfreeSdkPromise: Promise<any> | null = null;

/**
 * Dynamically loads the official Cashfree JS SDK V3.
 */
export async function loadCashfreeSdk(mode: "production" | "sandbox" = "production"): Promise<any> {
  if (typeof window === "undefined") return null;

  if (window.Cashfree) {
    return window.Cashfree({ mode });
  }

  if (cashfreeSdkPromise) {
    return cashfreeSdkPromise;
  }

  cashfreeSdkPromise = new Promise((resolve, reject) => {
    const existing = document.getElementById("cashfree-js-sdk");
    if (existing) {
      if (window.Cashfree) return resolve(window.Cashfree({ mode }));
    }

    const script = document.createElement("script");
    script.id = "cashfree-js-sdk";
    script.src = "https://sdk.cashfree.com/js/v3/cashfree.js";
    script.async = true;

    script.onload = () => {
      if (window.Cashfree) {
        resolve(window.Cashfree({ mode }));
      } else {
        reject(new Error("Cashfree SDK object not found on window"));
      }
    };

    script.onerror = () => {
      cashfreeSdkPromise = null;
      reject(new Error("Failed to load Cashfree SDK script"));
    };

    document.head.appendChild(script);
  });

  return cashfreeSdkPromise;
}

/**
 * Directly submits an HTML form to Cashfree's official hosted checkout endpoint.
 * This directly posts to Cashfree's PG checkout endpoint without relying on external CDN scripts.
 */
export function openCashfreeHostedCheckout(paymentSessionId: string, mode: "production" | "sandbox" = "production"): void {
  if (typeof document === "undefined") return;

  const checkoutUrl = mode === "sandbox"
    ? "https://sandbox.cashfree.com/pg/view/sessions/checkout"
    : "https://api.cashfree.com/pg/view/sessions/checkout";

  // Remove existing form if any
  const oldForm = document.getElementById("cf-direct-checkout-form");
  if (oldForm) {
    oldForm.remove();
  }

  const form = document.createElement("form");
  form.id = "cf-direct-checkout-form";
  form.method = "POST";
  form.action = checkoutUrl;
  form.target = "_self";
  form.style.display = "none";

  const sessionInput = document.createElement("input");
  sessionInput.type = "hidden";
  sessionInput.name = "payment_session_id";
  sessionInput.value = paymentSessionId;
  form.appendChild(sessionInput);

  document.body.appendChild(form);
  form.submit();
}

/**
 * Initiates complete Cashfree checkout flow:
 * 1. Calls Edge function to create order & get paymentSessionId
 * 2. Launches Cashfree modal checkout
 * 3. Immediately verifies payment on completion
 */
export async function initiateCashfreePayment(
  planId: string,
  userProfile?: { id?: string; email?: string; name?: string; phone?: string } | null,
  onStatusUpdate?: (status: "creating_order" | "ready_to_pay" | "verifying" | "success" | "failed", msg?: string) => void
): Promise<{
  success: boolean;
  orderId?: string;
  subscriptionId?: string;
  isAutoPay?: boolean;
  isPremium?: boolean;
  error?: string;
}> {
  try {
    onStatusUpdate?.("creating_order", "ऑर्डर तैयार किया जा रहा है...");

    // 1. Call create-cashfree-order Edge function.
    // The return URL is always a public HTTPS origin from config (VITE_APP_URL /
    // NEXT_PUBLIC_APP_URL / APP_URL). localhost and capacitor:// are never sent
    // to Cashfree because they cannot be whitelisted.
    const returnUrl = buildCashfreeReturnUrl();

    const { data: orderData, error: orderError } = await supabase.functions.invoke("create-cashfree-order", {
      body: { 
        planId, 
        returnUrl,
      },
    });

    if (orderError || !orderData?.success) {
      let errMsg = orderData?.error || orderError?.message || "ऑर्डर बनाने में समस्या आई";
      try {
        if (orderError && "context" in orderError && (orderError as any).context) {
          const bodyJson = await (orderError as any).context.json?.();
          if (bodyJson?.error) errMsg = bodyJson.error;
        }
      } catch {}
      onStatusUpdate?.("failed", errMsg);
      return { success: false, error: errMsg };
    }

    const isAutoPay = orderData.isAutoPay === true;
    const paymentSessionId = String(orderData.paymentSessionId || "");
    const subscriptionSessionId = String(orderData.subscriptionSessionId || "");
    const subscriptionId = String(orderData.subscriptionId || "");
    const orderId = String(orderData.orderId || "");
    const mode = getCashfreeMode(orderData.environment);

    // Never launch checkout with a missing session id. AutoPay needs the
    // subscription session (+ subscription id for the verification fallback),
    // one-time orders need the payment session.
    if (!orderId || (isAutoPay ? (!subscriptionSessionId || !subscriptionId) : !paymentSessionId)) {
      const errMsg = "पेमेंट सेशन तैयार नहीं हो सका। कृपया दोबारा प्रयास करें।";
      onStatusUpdate?.("failed", errMsg);
      return { success: false, error: errMsg };
    }

    const verifyAfterCheckout = async (): Promise<boolean> => {
      const result = isAutoPay
        ? await verifyCashfreeSubscription(subscriptionId)
        : await verifyCashfreeOrder(orderId);
      return Boolean(result.success || result.isPremium);
    };

    onStatusUpdate?.(
      "ready_to_pay",
      isAutoPay
        ? "₹1 ट्रायल के लिए UPI AutoPay मैंडेट शुरू किया जा रहा है..."
        : "आधिकारिक Cashfree पेमेंट पेज खोला जा रहा है..."
    );

    // 2. Launch official Cashfree checkout page.
    // Native app: open the hosted-checkout bridge on the configured public HTTPS
    // domain via Chrome Custom Tabs. No localhost/capacitor origin ever reaches
    // Cashfree, so the "https://localhost/ is not enabled" error cannot occur.
    if (Capacitor.isNativePlatform()) {
      const checkoutBridgeUrl = isAutoPay
        ? getSubscriptionCheckoutBridgeUrl(subscriptionSessionId, subscriptionId, orderId, mode)
        : getCheckoutBridgeUrl(paymentSessionId, orderId, mode);
      try {
        // Automatically verify as soon as the user returns from the payment window.
        let finishedListener: any = null;
        finishedListener = await Browser.addListener("browserFinished", async () => {
          try {
            finishedListener?.remove?.();
          } catch (_) {}
          onStatusUpdate?.("verifying", "पेमेंट सत्यापन किया जा रहा है...");
          try {
            if (await verifyAfterCheckout()) {
              onStatusUpdate?.("success", "VIP पास सक्रिय हो गया!");
            }
          } catch (_) {}
        });

        await Browser.open({
          url: checkoutBridgeUrl,
          windowName: "_blank",
          presentationStyle: "popover",
        });

        return { success: true, orderId, subscriptionId, isAutoPay };
      } catch (nativeBrowserErr) {
        console.warn("[Cashfree] Native Browser open error, opening system browser:", nativeBrowserErr);
        if (typeof window !== "undefined") {
          window.open(checkoutBridgeUrl, "_system");
          return { success: true, orderId, subscriptionId, isAutoPay };
        }
      }
      return { success: true, orderId, subscriptionId, isAutoPay };
    }

    // Web (configured public domain): use the official SDK. AutoPay mandates
    // must use subscriptionsCheckout with the subscription session id.
    try {
      const cashfree = await loadCashfreeSdk(mode).catch(() => null);
      if (cashfree) {
        if (isAutoPay && typeof cashfree.subscriptionsCheckout === "function") {
          cashfree.subscriptionsCheckout({
            subsSessionId: subscriptionSessionId,
            redirectTarget: "_self",
          });
          return { success: true, orderId, subscriptionId, isAutoPay };
        }
        if (!isAutoPay && typeof cashfree.checkout === "function") {
          cashfree.checkout({
            paymentSessionId,
            redirectTarget: "_self",
          });
          return { success: true, orderId, isAutoPay };
        }
      }
    } catch (sdkErr: any) {
      console.warn("[Cashfree] SDK error, using hosted checkout fallback:", sdkErr);
    }

    if (isAutoPay) {
      // No safe direct-POST fallback for subscription sessions: let the public
      // bridge page retry the official SDK with a fresh load.
      const bridgeUrl = getSubscriptionCheckoutBridgeUrl(subscriptionSessionId, subscriptionId, orderId, mode);
      if (typeof window !== "undefined") {
        window.location.assign(bridgeUrl);
        return { success: true, orderId, subscriptionId, isAutoPay };
      }
      return { success: false, error: "AutoPay checkout could not be opened." };
    }

    // Direct hosted checkout fallback for one-time orders.
    openCashfreeHostedCheckout(paymentSessionId, mode);
    return { success: true, orderId, isAutoPay };
  } catch (err: any) {
    console.error("[Cashfree] Payment initiation error:", err);
    onStatusUpdate?.("failed", err.message || "कुछ गड़बड़ हुई");
    return { success: false, error: err.message };
  }
}

/**
 * Verifies a completed Cashfree order and activates VIP subscription
 */
export async function verifyCashfreeOrder(
  orderId: string
): Promise<{ success: boolean; isPremium?: boolean; planId?: string; error?: string }> {
  try {
    const { data: verifyData, error: verifyError } = await supabase.functions.invoke("verify-cashfree-order", {
      body: { orderId },
    });

    if (verifyError) {
      return { success: false, error: verifyError.message };
    }

    if (verifyData?.success || verifyData?.isPremium) {
      triggerSuccessCelebration();
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("disha_subscription_updated", {
            detail: { isPremium: true, orderId, planId: verifyData.planId },
          })
        );
      }
      return { success: true, isPremium: true, planId: verifyData.planId };
    }

    return { success: false, error: "भुगतान पूर्ण नहीं हुआ या लंबित है" };
  } catch (err: any) {
    console.error("[Cashfree] Verification exception:", err);
    return { success: false, error: err.message };
  }
}

type SubscriptionAction = "verify" | "status" | "cancel";

/**
 * Single server-side entry point for mandate state. All actions require the
 * signed-in user to own the subscription (enforced by the Edge Function).
 */
async function callCashfreeSubscription<T = any>(
  action: SubscriptionAction,
  subscriptionId: string
): Promise<{ success: boolean; data?: T; error?: string }> {
  try {
    const { data, error } = await supabase.functions.invoke("cashfree-subscription", {
      body: { action, subscriptionId },
    });
    if (error) {
      let msg = error.message || "AutoPay request failed";
      try {
        if ("context" in error && (error as any).context) {
          const bodyJson = await (error as any).context.json?.();
          if (bodyJson?.error) msg = bodyJson.error;
        }
      } catch {}
      return { success: false, error: msg };
    }
    if (data?.error) return { success: false, error: data.error };
    return { success: true, data: data as T };
  } catch (err: any) {
    return { success: false, error: err?.message || "AutoPay request failed" };
  }
}

/**
 * Fallback activation after the AutoPay return redirect. The webhook is the
 * primary path; this only re-fetches the mandate from Cashfree and activates
 * the 7-day trial if Cashfree already authorised it.
 */
export async function verifyCashfreeSubscription(
  subscriptionId: string
): Promise<{
  success: boolean;
  isPremium?: boolean;
  subscriptionId?: string;
  orderId?: string;
  error?: string;
}> {
  if (!subscriptionId || !/^[A-Za-z0-9_.-]{4,120}$/.test(subscriptionId)) {
    return { success: false, error: "अमान्य सब्सक्रिप्शन आईडी" };
  }
  const res = await callCashfreeSubscription<any>("verify", subscriptionId);
  if (!res.success || !res.data?.success) {
    return {
      success: false,
      error: res.error || res.data?.message || "AutoPay मैंडेट अभी सक्रिय नहीं हुआ है",
    };
  }

  triggerSuccessCelebration();
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("disha_subscription_updated", {
        detail: {
          isPremium: true,
          isAutoPay: true,
          subscriptionId,
          orderId: res.data.orderId,
        },
      })
    );
  }
  return {
    success: true,
    isPremium: true,
    subscriptionId,
    orderId: res.data.orderId,
  };
}

export interface CashfreeSubscriptionStatus {
  subscriptionId: string;
  gatewayStatus: string | null;
  authorizationStatus: string | null;
  recurringAmount: number;
  nextChargeAt: string | null;
  cancelledAt: string | null;
  /** Fresh session id — subscription sessions expire in about 2 hours. */
  subscriptionSessionId: string | null;
  isAuthorised: boolean;
}

export async function getCashfreeSubscriptionStatus(
  subscriptionId: string
): Promise<{ success: boolean; status?: CashfreeSubscriptionStatus; error?: string }> {
  if (!subscriptionId || !/^[A-Za-z0-9_.-]{4,120}$/.test(subscriptionId)) {
    return { success: false, error: "अमान्य सब्सक्रिप्शन आईडी" };
  }
  const res = await callCashfreeSubscription<CashfreeSubscriptionStatus>("status", subscriptionId);
  if (!res.success || !res.data) {
    return { success: false, error: res.error || "सब्सक्रिप्शन स्थिति नहीं मिली" };
  }
  return { success: true, status: res.data as CashfreeSubscriptionStatus };
}

/**
 * Cancel future debits. Already-paid VIP time is NOT revoked.
 */
export async function cancelCashfreeSubscription(
  subscriptionId: string
): Promise<{ success: boolean; alreadyCancelled?: boolean; status?: string; error?: string }> {
  if (!subscriptionId || !/^[A-Za-z0-9_.-]{4,120}$/.test(subscriptionId)) {
    return { success: false, error: "अमान्य सब्सक्रिप्शन आईडी" };
  }
  const res = await callCashfreeSubscription<any>("cancel", subscriptionId);
  if (!res.success || !res.data?.success) {
    return { success: false, error: res.error || "AutoPay रद्द नहीं हो सका" };
  }
  return {
    success: true,
    alreadyCancelled: Boolean(res.data.alreadyCancelled),
    status: res.data.status,
  };
}

/**
 * Reopen the mandate checkout when the original session has expired.
 */
export async function resumeCashfreeSubscriptionCheckout(
  subscriptionId: string,
  orderId?: string
): Promise<{ success: boolean; error?: string }> {
  const statusRes = await getCashfreeSubscriptionStatus(subscriptionId);
  const sessionId = statusRes.status?.subscriptionSessionId;
  if (!sessionId) {
    return {
      success: false,
      error: statusRes.error || "चेकआउट सेशन समाप्त हो गया। कृपया दोबारा प्रयास करें।",
    };
  }

  const mode = getCashfreeMode();
  const bridgeUrl = getSubscriptionCheckoutBridgeUrl(
    sessionId,
    subscriptionId,
    orderId || subscriptionId,
    mode
  );

  if (Capacitor.isNativePlatform()) {
    try {
      await Browser.open({ url: bridgeUrl, windowName: "_blank", presentationStyle: "popover" });
      return { success: true };
    } catch (err: any) {
      if (typeof window !== "undefined") {
        window.open(bridgeUrl, "_system");
        return { success: true };
      }
      return { success: false, error: err?.message || "AutoPay खोला नहीं जा सका" };
    }
  }

  try {
    const cashfree = await loadCashfreeSdk(mode).catch(() => null);
    if (cashfree && typeof cashfree.subscriptionsCheckout === "function") {
      cashfree.subscriptionsCheckout({ subsSessionId: sessionId, redirectTarget: "_self" });
      return { success: true };
    }
  } catch {}

  if (typeof window !== "undefined") {
    window.location.assign(bridgeUrl);
    return { success: true };
  }
  return { success: false, error: "AutoPay checkout could not be opened." };
}

/**
 * Triggers joyful celebration confetti on successful subscription.
 */
export function triggerSuccessCelebration() {
  try {
    confetti({
      particleCount: 80,
      spread: 70,
      origin: { y: 0.6 },
      colors: ["#7045D8", "#A78BFA", "#F59E0B", "#10B981", "#FFFFFF"],
    });
  } catch {}
}
