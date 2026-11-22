import { supabase, isSupabaseConfigured } from "../../lib/supabase";

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

    const randomPart = new Uint8Array(6);
    crypto.getRandomValues(randomPart);
    const orderId = `UPI_${Date.now()}_${Array.from(randomPart, (b) => b.toString(16).padStart(2, "0")).join("")}`;

    // NOTE: approval is NEVER decided in the browser. autoApprove was removed
    // from client config; every payment requires admin verification server-side.
    const { error: insertErr } = await supabase.from("orders").insert({
      order_id: orderId,
      user_id: userId,
      user_email: userEmail || "student@disha-pyq.app",
      user_name: userName || "Student Aspirant",
      amount: amount,
      currency: "INR",
      plan_id: planId,
      status: "PENDING_VERIFICATION",
      payment_method: "UPI_QR",
      utr_number: cleanUtr,
    });

    if (insertErr) {
      console.error("[UPI Order] Could not record order:", insertErr.message);
      return { success: false, error: "ऑर्डर सुरक्षित करने में त्रुटि हुई।" };
    }

    return { success: true, orderId, isPremium: false };
  } catch (err: any) {
    console.error("[UPI Payment] Exception:", err);
    return { success: false, error: err?.message || "भुगतान दर्ज करने में त्रुटि हुई।" };
  }
}

/** All admin payment actions go through a server-side, JWT-verified endpoint. */
async function callAdminOrders(
  action: "list" | "approve" | "reject",
  extra: Record<string, unknown> = {}
): Promise<{ success: boolean; error?: string; data?: any }> {
  if (!isSupabaseConfigured()) return { success: false, error: "Database not configured." };
  try {
    const { data, error } = await supabase.functions.invoke("admin-manage-orders", {
      body: { action, ...extra },
    });
    if (error) return { success: false, error: error.message || "Request failed." };
    if (data?.error) return { success: false, error: String(data.error) };
    return { success: true, data };
  } catch (err: any) {
    return { success: false, error: err?.message || "Request failed." };
  }
}

/**
 * Admin: Fetch all pending student UPI orders awaiting verification.
 * The server re-checks admin rights and returns only pending orders.
 */
export async function fetchPendingOrders(): Promise<StudentOrderRecord[]> {
  const result = await callAdminOrders("list");
  return result.success ? ((result.data?.orders as StudentOrderRecord[]) || []) : [];
}

/**
 * Admin: Approve a student's payment. The server re-reads the order and
 * validates status/plan/amount; the browser cannot supply any of them.
 */
export async function approveStudentOrder(
  order: StudentOrderRecord
): Promise<{ success: boolean; error?: string }> {
  const result = await callAdminOrders("approve", { orderId: order.order_id });
  return { success: result.success, error: result.error };
}

/**
 * Admin: Reject a student's payment order.
 */
export async function rejectStudentOrder(
  orderId: string,
  _notes?: string
): Promise<{ success: boolean; error?: string }> {
  const result = await callAdminOrders("reject", { orderId });
  return { success: result.success, error: result.error };
}
