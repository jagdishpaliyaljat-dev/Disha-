export interface AdminToastPayload {
  type: "add" | "delete" | "success" | "error" | "info" | "update";
  title: string;
  message: string;
  itemName?: string;
  category?: string;
  count?: number;
}

export interface DatabaseSavedEventPayload {
  title?: string;
  message?: string;
  itemName?: string;
  category?: string;
  count?: number;
  type?: "add" | "delete" | "success" | "error" | "info" | "update";
}

/**
 * Triggers the ultra-premium top-center (top-mid) pill popup.
 * Confirms that content has been securely committed to Supabase
 * and is immediately live & accessible (or removed) in the user app.
 */
export function triggerDatabaseSavedToast(payload?: DatabaseSavedEventPayload | string) {
  if (typeof window === "undefined") return;

  const detail: DatabaseSavedEventPayload =
    typeof payload === "string"
      ? { message: payload }
      : payload || {};

  const type = detail.type || "add";
  const defaultTitle =
    type === "delete"
      ? "Supabase से डेटा हटाया गया (Live)"
      : "डेटा Supabase में लाइव हो गया!";
  const defaultMessage =
    type === "delete"
      ? "यह डेटा Supabase डेटाबेस से सुरक्षित हटा दिया गया है और अब यूजर ऐप से तुरंत रिमूव हो चुका है।"
      : "डेटा Supabase में सुरक्षित सेव हो गया है और अब यूजर ऐप में तुरंत लाइव उपलब्ध है।";

  const eventDetail: AdminToastPayload = {
    title: detail.title || defaultTitle,
    message: detail.message || defaultMessage,
    itemName: detail.itemName,
    category: detail.category,
    count: detail.count,
    type,
  };

  window.dispatchEvent(
    new CustomEvent("disha2020_saved", { detail: eventDetail })
  );
  window.dispatchEvent(
    new CustomEvent("disha2020_admin_toast", { detail: eventDetail })
  );
}

/**
 * Standard admin toast dispatcher. Automatically dispatches the top-mid
 * DatabaseSaved popup for all add/delete/update operations.
 */
export function triggerAdminToast(
  type: "add" | "delete" | "success" | "error" | "info" | "update",
  title: string,
  message: string,
  extra?: { itemName?: string; count?: number; category?: string }
) {
  if (typeof window !== "undefined") {
    const toastDetail: AdminToastPayload = { type, title, message, ...extra };
    window.dispatchEvent(
      new CustomEvent("disha2020_admin_toast", { detail: toastDetail })
    );

    // Also mirror to top-mid live confirmation popup
    triggerDatabaseSavedToast({
      title,
      message,
      type,
      ...extra,
    });
  }
}
