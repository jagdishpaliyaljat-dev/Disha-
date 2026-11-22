import { supabase, isSupabaseConfigured } from "../../lib/supabase";
import { getLocalPaymentGatewayConfig } from "./premiumConfigService";
import confetti from "canvas-confetti";

export interface StudentOrderRecord {
  id?: string;
  order_id: string;
  user_id: string;
  user_email?: string;
  user_name?: string;
  amount: number;
  plan_id: string;
  status: "PENDING" | "PENDING_VERIFICATION" | "PAID" | "REJECTED" | "FAILED";
  payment_method: string;
  utr_number?: string;
  cf_payment_id?: string;
  admin_notes?: string;
  created_at?: string;
  paid_at?: string;
}

/**
 * Generates official UPI Payment URI for Indian Banking / NPCI
 */
export function generateUpiDeepLink(
  upiId: string,
  payeeName: string,
  amount: number,
  planTitle: string = "Disha VIP"
): string {
  const cleanUpi = upiId.trim();
  const cleanName = encodeURIComponent(payeeName.trim() || "Disha PYQ");
  const note = encodeURIComponent(`Disha PYQ ${planTitle}`);
  return `upi://pay?pa=${cleanUpi}&pn=${cleanName}&am=${amount.toFixed(2)}&cu=INR&tn=${note}`;
}

/**
 * Generates a high-quality SVG QR Code image URL for scanning via GPay / PhonePe / Paytm
 */
export function generateUpiQrUrl(upiDeepLink: string, size: number = 240): string {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&margin=10&data=${encodeURIComponent(
    upiDeepLink
  )}`;
}

/**
 * Submits student's UPI payment with UTR / Transaction ID
 */
export async function submitStudentUpiPayment(params: {
  userId: string;
  userEmail?: string;
  userName?: string;
  planId: string;
  amount: number;
  utrNumber: string;
}): Promise<{ success: boolean; orderId?: string; isPremium?: boolean; error?: string }> {
  try {
    if (!isSupabaseConfigured()) {
      return { success: false, error: "Database connectivity error." };
    }

    const { userId, userEmail, userName, planId, amount, utrNumber } = params;
    const cleanUtr = utrNumber.trim();

    if (!cleanUtr || cleanUtr.length < 6) {
      return { success: false, error: "कृपया मान्य 12 अंकों का UTR या Transaction ID दर्ज करें।" };
    }

    const uniqueSuffix = Math.random().toString(36).substring(2, 7);
    const orderId = `UPI_${Date.now()}_${uniqueSuffix}`;

    const gwConfig = getLocalPaymentGatewayConfig();

    // 1. Insert order record
    const { error: insertErr } = await supabase.from("orders").insert({
      order_id: orderId,
      user_id: userId,
      user_email: userEmail || "student@disha-pyq.app",
      user_name: userName || "Student Aspirant",
      amount: amount,
      currency: "INR",
      plan_id: planId,
      status: gwConfig.autoApprove ? "PAID" : "PENDING_VERIFICATION",
      payment_method: "UPI_QR",
      utr_number: cleanUtr,
    });

    if (insertErr) {
      console.error("[UPI Order] Insert error:", insertErr);
      return { success: false, error: insertErr.message || "ऑर्डर सुरक्षित करने में त्रुटि हुई।" };
    }

    // 2. If Auto-approve is enabled in admin settings, activate immediately
    if (gwConfig.autoApprove) {
      try {
        await supabase.rpc("activate_user_subscription", {
          p_user_id: userId,
          p_order_id: orderId,
          p_plan_id: planId,
          p_cf_payment_id: cleanUtr,
          p_payment_method: "UPI_QR_AUTO",
        });

        if (typeof window !== "undefined") {
          try {
            confetti({ particleCount: 90, spread: 80, origin: { y: 0.6 } });
          } catch {}
          window.dispatchEvent(
            new CustomEvent("disha_subscription_updated", {
              detail: { isPremium: true, planId, orderId },
            })
          );
        }

        return { success: true, orderId, isPremium: true };
      } catch (actErr: any) {
        console.warn("[AutoApprove] Activation note:", actErr);
      }
    }

    return { success: true, orderId, isPremium: false };
  } catch (err: any) {
    console.error("[UPI Payment] Exception:", err);
    return { success: false, error: err?.message || "भुगतान दर्ज करने में त्रुटि हुई।" };
  }
}

/**
 * Admin: Fetch all pending student UPI orders awaiting verification
 */
export async function fetchPendingOrders(): Promise<StudentOrderRecord[]> {
  if (!isSupabaseConfigured()) return [];
  try {
    const { data, error } = await supabase
      .from("orders")
      .select("*")
      .in("status", ["PENDING_VERIFICATION", "PENDING"])
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      console.warn("[PendingOrders] Fetch note:", error);
      return [];
    }
    return (data as StudentOrderRecord[]) || [];
  } catch (e) {
    console.error("[PendingOrders] Exception:", e);
    return [];
  }
}

/**
 * Admin: Approve student's payment and activate VIP immediately
 */
export async function approveStudentOrder(
  order: StudentOrderRecord
): Promise<{ success: boolean; error?: string }> {
  if (!isSupabaseConfigured()) return { success: false, error: "Database not configured." };
  try {
    const { error: rpcErr } = await supabase.rpc("activate_user_subscription", {
      p_user_id: order.user_id,
      p_order_id: order.order_id,
      p_plan_id: order.plan_id,
      p_cf_payment_id: order.utr_number || order.cf_payment_id || null,
      p_payment_method: order.payment_method || "UPI_QR_MANUAL",
    });

    if (rpcErr) {
      return { success: false, error: rpcErr.message };
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || "मंजूरी देने में विफल।" };
  }
}

/**
 * Admin: Reject student's payment order with optional note
 */
export async function rejectStudentOrder(
  orderId: string,
  notes?: string
): Promise<{ success: boolean; error?: string }> {
  if (!isSupabaseConfigured()) return { success: false, error: "Database not configured." };
  try {
    const { error } = await supabase
      .from("orders")
      .update({
        status: "REJECTED",
        admin_notes: notes || "अमान्य UTR या भुगतान नहीं मिला",
        updated_at: new Date().toISOString(),
      })
      .eq("order_id", orderId);

    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || "खारिज करने में विफल।" };
  }
}
