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
      ? "डेटा हटाया गया (Live)"
      : "डेटा लाइव सेव हो गया";
  const defaultMessage =
    type === "delete"
      ? "यूजर ऐप से हटा दिया गया है।"
      : "यूजर ऐप में तुरंत लाइव उपलब्ध है।";

  const eventDetail: AdminToastPayload = {
    title: detail.title || defaultTitle,
    message: detail.message || defaultMessage,
    itemName: detail.itemName,
    category: detail.category,
    count: detail.count,
    type,
  };

  // Dispatch only the saved event. triggerAdminToast handles the admin_toast
  // event separately to avoid duplicate popups for a single action.
  window.dispatchEvent(
    new CustomEvent("disha2020_saved", { detail: eventDetail })
  );
}

/**
 * Standard admin toast dispatcher. Automatically dispatches the top-mid
 * DatabaseSaved popup for all add/delete/update operations.
 */
export function triggerAdminToast(
  typeOrPayload:
    | "add"
    | "delete"
    | "success"
    | "error"
    | "info"
    | "update"
    | {
        type?: "add" | "delete" | "success" | "error" | "info" | "update";
        title?: string;
        message: string;
        itemName?: string;
        count?: number;
        category?: string;
      },
  title?: string,
  message?: string,
  extra?: { itemName?: string; count?: number; category?: string }
) {
  if (typeof window !== "undefined") {
    let toastDetail: AdminToastPayload;
    if (typeof typeOrPayload === "object" && typeOrPayload !== null) {
      toastDetail = {
        type: typeOrPayload.type || "info",
        title: typeOrPayload.title || "Admin Notice",
        message: typeOrPayload.message,
        itemName: typeOrPayload.itemName,
        category: typeOrPayload.category,
        count: typeOrPayload.count,
      };
    } else {
      const toastType: AdminToastPayload["type"] =
        typeof typeOrPayload === "string" ? typeOrPayload : "info";
      toastDetail = {
        type: toastType,
        title: title || "",
        message: message || "",
        ...extra,
      };
    }
    window.dispatchEvent(
      new CustomEvent("disha2020_admin_toast", { detail: toastDetail })
    );
  }
}
