import { supabase } from "../../lib/supabase";
import confetti from "canvas-confetti";
import { Capacitor } from "@capacitor/core";
import { Browser } from "@capacitor/browser";

import {
  buildCashfreeReturnUrl,
  getCashfreeMode,
  getCheckoutBridgeUrl,
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
): Promise<{ success: boolean; orderId?: string; isPremium?: boolean; error?: string }> {
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

    if (orderError || !orderData?.paymentSessionId) {
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

    const { paymentSessionId, orderId, environment } = orderData;
    const mode = getCashfreeMode(environment);

    onStatusUpdate?.("ready_to_pay", "आधिकारिक Cashfree पेमेंट पेज खोला जा रहा है...");

    // 2. Launch official Cashfree checkout page.
    // Native app: open the hosted-checkout bridge on the configured public HTTPS
    // domain via Chrome Custom Tabs. No localhost/capacitor origin ever reaches
    // Cashfree, so the "https://localhost/ is not enabled" error cannot occur.
    if (Capacitor.isNativePlatform()) {
      try {
        const checkoutBridgeUrl = getCheckoutBridgeUrl(paymentSessionId, orderId, mode);

        // Automatically verify subscription as soon as user returns from payment window
        let finishedListener: any = null;
        finishedListener = await Browser.addListener("browserFinished", async () => {
          try {
            finishedListener?.remove?.();
          } catch (_) {}
          onStatusUpdate?.("verifying", "पेमेंट सत्यापन किया जा रहा है...");
          try {
            const verifyRes = await verifyCashfreeOrder(orderId);
            if (verifyRes.success || verifyRes.isPremium) {
              onStatusUpdate?.("success", "VIP पास सक्रिय हो गया!");
            }
          } catch (_) {}
        });

        await Browser.open({
          url: checkoutBridgeUrl,
          windowName: "_blank",
          presentationStyle: "popover",
        });

        return { success: true, orderId };
      } catch (nativeBrowserErr) {
        console.warn("[Cashfree] Native Browser open error, falling back to direct submit:", nativeBrowserErr);
      }
    }

    // On Web (configured public domain), use official SDK or hosted checkout POST
    try {
      const cashfree = await loadCashfreeSdk(mode).catch(() => null);
      if (cashfree && typeof cashfree.checkout === "function") {
        cashfree.checkout({
          paymentSessionId,
          redirectTarget: "_self",
        });
        return { success: true, orderId };
      }
    } catch (sdkErr: any) {
      console.warn("[Cashfree] SDK error, using direct hosted checkout POST:", sdkErr);
    }

    // Direct hosted checkout fallback (submits form to https://api.cashfree.com/pg/view/sessions/checkout)
    openCashfreeHostedCheckout(paymentSessionId, mode);
    return { success: true, orderId };
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
