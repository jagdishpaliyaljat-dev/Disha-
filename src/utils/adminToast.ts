export interface AdminToastPayload {
  type: "add" | "delete" | "success" | "error";
  title: string;
  message: string;
}

export interface DatabaseSavedEventPayload {
  title?: string;
  message?: string;
  itemName?: string;
  category?: string;
  count?: number;
}

/**
 * Triggers the ultra-premium top-center (top-mid) 1-2 second pill popup.
 * Informs the admin that their content has been securely committed to Supabase / Database
 * and is immediately live & accessible to students/users.
 */
export function triggerDatabaseSavedToast(payload?: DatabaseSavedEventPayload | string) {
  if (typeof window === "undefined") return;

  const detail: DatabaseSavedEventPayload =
    typeof payload === "string"
      ? { message: payload }
      : payload || {};

  const eventDetail = {
    title: detail.title || "Saved Securely to Database!",
    message:
      detail.message ||
      "Your data was successfully saved to the backend and is now live for users.",
    itemName: detail.itemName,
    category: detail.category,
    count: detail.count,
  };

  window.dispatchEvent(
    new CustomEvent("disha2020_saved", { detail: eventDetail })
  );
}

/**
 * Standard admin toast dispatcher. Automatically dispatches the top-mid
 * DatabaseSaved popup for all successful add/save/create operations.
 */
export function triggerAdminToast(
  type: "add" | "delete" | "success" | "error",
  title: string,
  message: string
) {
  if (typeof window !== "undefined") {
    const toastDetail = { type, title, message };
    window.dispatchEvent(
      new CustomEvent("disha2020_admin_toast", { detail: toastDetail })
    );

    // If an addition or successful cloud operation occurred, also mirror to top-mid DatabaseSaved banner
    if (type === "add" || type === "success") {
      triggerDatabaseSavedToast({
        title,
        message,
      });
    }
  }
}
