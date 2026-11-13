export interface AdminToastPayload {
  type: "add" | "delete" | "success" | "error";
  title: string;
  message: string;
}

export interface FirebaseSavedEventPayload {
  title?: string;
  message?: string;
  itemName?: string;
  category?: string;
  count?: number;
}

/**
 * Triggers the ultra-premium top-center (top-mid) 1-2 second pill popup.
 * Informs the admin that their content has been securely committed to Firebase Firestore
 * and is immediately live & accessible to students/users.
 */
export function triggerFirebaseSavedToast(payload?: FirebaseSavedEventPayload | string) {
  if (typeof window === "undefined") return;

  const detail: FirebaseSavedEventPayload =
    typeof payload === "string"
      ? { message: payload }
      : payload || {};

  window.dispatchEvent(
    new CustomEvent("quizpro_firebase_saved", {
      detail: {
        title: detail.title || "Saved Securely to Database!",
        message:
          detail.message ||
          "Your data was successfully saved to the backend and is now live for users.",
        itemName: detail.itemName,
        category: detail.category,
        count: detail.count,
      },
    })
  );
}

/**
 * Standard admin toast dispatcher. Automatically dispatches the top-mid
 * FirebaseSaved popup for all successful add/save/create operations.
 */
export function triggerAdminToast(
  type: "add" | "delete" | "success" | "error",
  title: string,
  message: string
) {
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("quizpro_admin_toast", {
        detail: { type, title, message },
      })
    );

    // If an addition or successful cloud operation occurred, also mirror to top-mid FirebaseSaved banner
    if (type === "add" || type === "success") {
      triggerFirebaseSavedToast({
        title,
        message,
      });
    }
  }
}
