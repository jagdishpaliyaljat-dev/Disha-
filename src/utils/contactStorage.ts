// Canonical shape shared with the admin inbox (AdminMessagesSection).
export interface ContactMessage {
  id: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  createdAt: any;
  createdIso?: string;
  statusText?: string;
  status: "new" | "read" | "replied" | "archived";
}

const STORAGE_KEY = "disha2020_contact_messages_v1";
const LEGACY_STORAGE_KEY = "quizpro_contact_messages_v1";

let inMemoryMessages: ContactMessage[] = [];

export function loadContactMessages(): ContactMessage[] {
  try {
    if (typeof window === "undefined" || typeof localStorage === "undefined") {
      return inMemoryMessages;
    }
    const raw = localStorage.getItem(STORAGE_KEY) || localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!raw) {
      inMemoryMessages = [];
      return inMemoryMessages;
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      inMemoryMessages = parsed;
      return parsed;
    }
    return inMemoryMessages;
  } catch (err) {
    console.warn("Failed to load contact messages:", err);
    return inMemoryMessages;
  }
}

export function saveContactMessages(messages: ContactMessage[]): void {
  try {
    if (typeof window === "undefined" || typeof localStorage === "undefined") {
      inMemoryMessages = messages;
      return;
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    inMemoryMessages = messages;
  } catch (err) {
    console.warn("Failed to save contact messages:", err);
    throw err;
  }
}

export interface SubmitContactPayload {
  name: string;
  email: string;
  subject: string;
  message: string;
}

export interface SubmitContactResult {
  success: boolean;
  message: string;
  id?: string;
}

const DUPLICATE_WINDOW_MS = 60_000;

/**
 * Persists a contact inquiry into the same local store that the admin inbox
 * reads from. Returns a structured result so the UI can distinguish success
 * from a real failure (storage full, duplicate, invalid payload, ...).
 */
export async function submitContactMessage(
  payload: SubmitContactPayload
): Promise<SubmitContactResult> {
  const name = (payload?.name || "").trim();
  const email = (payload?.email || "").trim();
  const subject = (payload?.subject || "").trim();
  const message = (payload?.message || "").trim();

  if (!name || !email || !subject || !message) {
    return { success: false, message: "All required fields must be provided." };
  }
  if (message.length < 10) {
    return { success: false, message: "Message must be at least 10 characters long." };
  }

  const existing = loadContactMessages();
  const now = Date.now();
  const duplicate = existing.find((m) => {
    const created = m.createdIso ? new Date(m.createdIso).getTime() : 0;
    return (
      m.email === email &&
      m.message === message &&
      now - created < DUPLICATE_WINDOW_MS
    );
  });
  if (duplicate) {
    return {
      success: false,
      message: "A similar message was already submitted recently. Please wait before sending again.",
    };
  }

  const id = `msg_${now}_${Math.random().toString(36).slice(2, 8)}`;
  const entry: ContactMessage = {
    id,
    name,
    email,
    subject,
    message,
    createdAt: new Date(now).toISOString(),
    createdIso: new Date(now).toISOString(),
    status: "new",
  };

  try {
    saveContactMessages([entry, ...existing]);
  } catch (err) {
    console.error("Contact message persistence failed:", err);
    return {
      success: false,
      message: "We couldn't save your message right now. Please check your connection and try again.",
    };
  }

  return {
    success: true,
    message: "Your message has been received.",
    id,
  };
}
