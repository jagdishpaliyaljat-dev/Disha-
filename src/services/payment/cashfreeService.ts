import { supabase } from "../../lib/supabase";
import confetti from "canvas-confetti";

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
 * Initiates complete Cashfree checkout flow:
 * 1. Calls Edge function to create order & get paymentSessionId
 * 2. Launches Cashfree modal checkout
 * 3. Immediately verifies payment on completion
 */
export async function initiateCashfreePayment(
  planId: string,
  onStatusUpdate?: (status: "creating_order" | "ready_to_pay" | "verifying" | "success" | "failed", msg?: string) => void
): Promise<{ success: boolean; orderId?: string; isPremium?: boolean; error?: string }> {
  try {
    onStatusUpdate?.("creating_order", "ऑर्डर तैयार किया जा रहा है...");

    // 1. Call create-cashfree-order Edge function
    const returnUrl = typeof window !== "undefined"
      ? `${window.location.origin}/?order_id={order_id}`
      : "https://disha-2020.vercel.app/?order_id={order_id}";

    const { data: orderData, error: orderError } = await supabase.functions.invoke("create-cashfree-order", {
      body: { planId, returnUrl },
    });

    if (orderError || !orderData?.paymentSessionId) {
      const errMsg = orderData?.error || orderError?.message || "ऑर्डर बनाने में समस्या आई";
      onStatusUpdate?.("failed", errMsg);
      return { success: false, error: errMsg };
    }

    const { paymentSessionId, orderId, environment } = orderData;
    const mode = environment === "SANDBOX" || environment === "TEST" ? "sandbox" : "production";

    onStatusUpdate?.("ready_to_pay", "आधिकारिक Cashfree पेमेंट पेज खोला जा रहा है...");

    // 2. Load SDK and launch official Cashfree checkout page
    try {
      const cashfree = await loadCashfreeSdk(mode);
      if (cashfree) {
        // Opens Cashfree's official full-page payment gateway
        cashfree.checkout({
          paymentSessionId,
          redirectTarget: "_self",
        });

        // Fallback safety timeout: If redirect hasn't happened in 2.5s, direct navigate
        setTimeout(() => {
          if (typeof window !== "undefined") {
            const hostedUrl = mode === "sandbox"
              ? `https://sandbox.cashfree.com/pg/orders/${paymentSessionId}`
              : `https://payments.cashfree.com/forms/${paymentSessionId}`;
            window.location.href = hostedUrl;
          }
        }, 2500);

        return { success: true, orderId };
      }
    } catch (sdkErr: any) {
      console.warn("[Cashfree] SDK error, using direct hosted checkout URL:", sdkErr);
      const hostedUrl = mode === "sandbox"
        ? `https://sandbox.cashfree.com/pg/orders/${paymentSessionId}`
        : `https://payments.cashfree.com/forms/${paymentSessionId}`;
      if (typeof window !== "undefined") {
        window.location.href = hostedUrl;
      }
      return { success: true, orderId };
    }

    return { success: false, orderId, error: "पेमेंट गेटवे लोड नहीं हो पाया" };
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
