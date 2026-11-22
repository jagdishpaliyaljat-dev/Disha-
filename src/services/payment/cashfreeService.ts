import { supabase } from "../../lib/supabase";
import confetti from "canvas-confetti";

export interface PremiumPlan {
  id: "monthly" | "yearly" | "lifetime";
  name: string;
  hindiName: string;
  amount: number;
  originalAmount: number;
  duration: string;
  tag?: string;
  isPopular?: boolean;
  features: string[];
}

export const PREMIUM_PLANS: PremiumPlan[] = [
  {
    id: "monthly",
    name: "1 Month Pass",
    hindiName: "1 माह पास",
    amount: 49,
    originalAmount: 99,
    duration: "30 दिन",
    tag: "स्टार्टर",
    features: [
      "सभी RPSC & RSMSSB Mock Tests अनलॉक",
      "Disha AI Tutor अनलिमिटेड 24/7 उपयोग",
      "असीमित PYQ Vault और टॉपिक वाइज़ प्रैक्टिस",
      "1v1 लाइव बैटल मोड असीमित खेलें",
    ],
  },
  {
    id: "yearly",
    name: "1 Year Super Pass",
    hindiName: "1 वर्ष सुपर पास",
    amount: 149,
    originalAmount: 499,
    duration: "365 दिन (1 साल)",
    tag: "🔥 सबसे लोकप्रिय",
    isPopular: true,
    features: [
      "पूरे 1 साल के लिए सभी Mock Tests & पेपर्स",
      "राज्य-स्तरीय मेरिट रैंकिंग और विस्तृत विश्लेषण",
      "Disha AI Tutor द्वारा कठिन प्रश्नों का तुरंत हल",
      "सभी नए टेस्ट पेपर्स तुरंत मुफ्त अपडेट",
      "ऑफ़लाइन टेस्ट डाउनलोड और पूर्ण विज्ञापन-मुक्त",
    ],
  },
  {
    id: "lifetime",
    name: "Lifetime VIP Pass",
    hindiName: "लाइफटाइम VIP पास",
    amount: 249,
    originalAmount: 999,
    duration: "आजीवन (Lifetime)",
    tag: "💎 बेस्ट वैल्यू",
    features: [
      "आजीवन सभी आगामी परीक्षाओं के पेपर्स अनलॉक",
      "भविष्य में आने वाले सभी नए फ़ीचर्स हमेशा मुफ़्त",
      "गोल्डन VIP प्रोफाइल बैज और प्राथमिकता सहायता",
      "असीमित लाइव टेस्ट सीरीज़ व लीडरबोर्ड एक्सेस",
      "एक बार भुगतान — कभी दोबारा रिन्यूअल नहीं",
    ],
  },
];

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
    const { data: orderData, error: orderError } = await supabase.functions.invoke("create-cashfree-order", {
      body: { planId },
    });

    if (orderError || !orderData?.paymentSessionId) {
      const errMsg = orderData?.error || orderError?.message || "ऑर्डर बनाने में समस्या आई";
      onStatusUpdate?.("failed", errMsg);
      return { success: false, error: errMsg };
    }

    const { paymentSessionId, orderId, environment } = orderData;
    const mode = environment === "SANDBOX" || environment === "TEST" ? "sandbox" : "production";

    onStatusUpdate?.("ready_to_pay", "पेमेंट गेटवे लोड हो रहा है...");

    // 2. Load SDK and launch checkout
    const cashfree = await loadCashfreeSdk(mode);
    if (!cashfree) {
      throw new Error("Cashfree SDK load failed");
    }

    return new Promise((resolve) => {
      const checkoutOptions = {
        paymentSessionId,
        redirectTarget: "_modal",
      };

      cashfree.checkout(checkoutOptions).then(async (result: any) => {
        if (result?.error) {
          console.warn("[Cashfree] Checkout dismissed or error:", result.error);
          onStatusUpdate?.("failed", result.error.message || "भुगतान रद्द कर दिया गया");
          resolve({ success: false, orderId, error: result.error.message });
          return;
        }

        // 3. Verify Payment with verify-cashfree-order
        onStatusUpdate?.("verifying", "भुगतान सत्यापित किया जा रहा है...");

        try {
          const { data: verifyData } = await supabase.functions.invoke("verify-cashfree-order", {
            body: { orderId },
          });

          if (verifyData?.success || verifyData?.isPremium) {
            triggerSuccessCelebration();
            onStatusUpdate?.("success", "बधाई हो! आपका Disha PYQ प्रीमियम सक्रिय हो गया है!");

            // Notify app components to refresh user profile instantly
            if (typeof window !== "undefined") {
              window.dispatchEvent(
                new CustomEvent("disha_subscription_updated", {
                  detail: { isPremium: true, planId, orderId },
                })
              );
            }

            resolve({ success: true, orderId, isPremium: true });
          } else {
            onStatusUpdate?.("failed", "भुगतान अधूरा रहा या बैंक द्वारा अस्वीकृत हुआ।");
            resolve({ success: false, orderId, error: "Payment verification failed" });
          }
        } catch (vErr: any) {
          console.error("[Cashfree] Verification error:", vErr);
          // Still dispatch check in background
          resolve({ success: false, orderId, error: vErr.message });
        }
      });
    });
  } catch (err: any) {
    console.error("[Cashfree] Payment initiation error:", err);
    onStatusUpdate?.("failed", err.message || "कुछ गड़बड़ हुई");
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
