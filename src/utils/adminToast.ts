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
      ? "Data Removed (Live)"
      : "Data Saved Live";
  const defaultMessage =
    type === "delete"
      ? "Removed from student app immediately."
      : "Immediately live in student app.";

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
  typeOrPayloadOrMessage:
    | "add"
    | "delete"
    | "success"
    | "error"
    | "info"
    | "update"
    | string
    | {
        type?: "add" | "delete" | "success" | "error" | "info" | "update";
        title?: string;
        message: string;
        itemName?: string;
        count?: number;
        category?: string;
      },
  titleOrType?: string,
  message?: string,
  extra?: { itemName?: string; count?: number; category?: string }
) {
  if (typeof window !== "undefined") {
    let toastDetail: AdminToastPayload;
    if (typeof typeOrPayloadOrMessage === "object" && typeOrPayloadOrMessage !== null) {
      toastDetail = {
        type: typeOrPayloadOrMessage.type || "info",
        title: typeOrPayloadOrMessage.title || "Admin Notice",
        message: typeOrPayloadOrMessage.message,
        itemName: typeOrPayloadOrMessage.itemName,
        category: typeOrPayloadOrMessage.category,
        count: typeOrPayloadOrMessage.count,
      };
    } else if (
      titleOrType &&
      ["add", "delete", "success", "error", "info", "update"].includes(titleOrType)
    ) {
      // Called as: triggerAdminToast("Some message", "success")
      toastDetail = {
        type: titleOrType as AdminToastPayload["type"],
        title: "Admin Notice",
        message: String(typeOrPayloadOrMessage || ""),
        ...extra,
      };
    } else {
      const toastType: AdminToastPayload["type"] =
        typeof typeOrPayloadOrMessage === "string" &&
        ["add", "delete", "success", "error", "info", "update"].includes(typeOrPayloadOrMessage)
          ? (typeOrPayloadOrMessage as AdminToastPayload["type"])
          : "info";
      toastDetail = {
        type: toastType,
        title: titleOrType || "",
        message: message || (typeof typeOrPayloadOrMessage === "string" ? typeOrPayloadOrMessage : ""),
        ...extra,
      };
    }
    window.dispatchEvent(
      new CustomEvent("disha2020_admin_toast", { detail: toastDetail })
    );
  }
}

export function showAdminToast(
  message: string,
  type: "add" | "delete" | "success" | "error" | "info" | "update" = "info",
  title?: string
) {
  triggerAdminToast(type, title || "Admin Notice", message);
}

