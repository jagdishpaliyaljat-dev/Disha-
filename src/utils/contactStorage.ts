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

// Supabase integration (lazy-loaded to avoid circular imports)
let supabaseClient: any = null;
let isConfigured = false;

async function getSupabase() {
  if (supabaseClient !== null) return { client: supabaseClient, configured: isConfigured };
  try {
    const mod = await import("../lib/supabase");
    isConfigured = mod.isSupabaseConfigured();
    supabaseClient = isConfigured ? mod.supabase : null;
  } catch {
    isConfigured = false;
    supabaseClient = null;
  }
  return { client: supabaseClient, configured: isConfigured };
}

// Map DB row to ContactMessage
function rowToMessage(row: any): ContactMessage {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    subject: row.subject,
    message: row.message,
    createdAt: row.created_at,
    createdIso: row.created_at,
    status: row.status || "new",
  };
}

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

/**
 * Fetch contact messages from Supabase (shared) with localStorage fallback.
 * Admin-only on Supabase side (RLS); falls back to local if not admin or offline.
 */
export async function fetchContactMessages(): Promise<ContactMessage[]> {
  const { client, configured } = await getSupabase();
  if (configured && client) {
    try {
      const { data, error } = await client
        .from("contact_messages")
        .select("*")
        .order("created_at", { ascending: false });
      if (!error && Array.isArray(data)) {
        const msgs = data.map(rowToMessage);
        // Cache locally for offline admin access
        saveContactMessages(msgs);
        return msgs;
      }
    } catch (err) {
      console.warn("Supabase contact fetch failed, falling back to local:", err);
    }
  }
  return loadContactMessages();
}

/**
 * Update message status (admin only on Supabase side).
 */
export async function updateContactMessageStatus(
  id: string,
  newStatus: ContactMessage["status"]
): Promise<boolean> {
  const { client, configured } = await getSupabase();
  if (configured && client) {
    try {
      const { error } = await client
        .from("contact_messages")
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (!error) {
        // Update local cache
        const local = loadContactMessages();
        const updated = local.map((m) => (m.id === id ? { ...m, status: newStatus } : m));
        saveContactMessages(updated);
        return true;
      }
    } catch (err) {
      console.warn("Supabase status update failed:", err);
    }
  }
  // Local fallback
  const local = loadContactMessages();
  const updated = local.map((m) => (m.id === id ? { ...m, status: newStatus } : m));
  saveContactMessages(updated);
  return true;
}

/**
 * Delete a contact message (admin only on Supabase side).
 */
export async function deleteContactMessage(id: string): Promise<boolean> {
  const { client, configured } = await getSupabase();
  if (configured && client) {
    try {
      const { error } = await client.from("contact_messages").delete().eq("id", id);
      if (!error) {
        const local = loadContactMessages().filter((m) => m.id !== id);
        saveContactMessages(local);
        return true;
      }
    } catch (err) {
      console.warn("Supabase delete failed:", err);
    }
  }
  // Local fallback
  const local = loadContactMessages().filter((m) => m.id !== id);
  saveContactMessages(local);
  return true;
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
 * Persists a contact inquiry.
 * Tries Supabase first (shared storage), falls back to localStorage.
 * Returns structured result for UI feedback.
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

  // Try Supabase first (shared storage)
  const { client, configured } = await getSupabase();
  if (configured && client) {
    try {
      const { error } = await client.from("contact_messages").insert({
        id,
        name,
        email,
        subject,
        message,
        status: "new",
        created_at: new Date(now).toISOString(),
      });
      if (!error) {
        // Also cache locally
        saveContactMessages([entry, ...existing]);
        return {
          success: true,
          message: "Your message has been received.",
          id,
        };
      }
      console.warn("Supabase contact insert failed, falling back to local:", error.message);
    } catch (err) {
      console.warn("Supabase contact insert error, falling back to local:", err);
    }
  }

  // Fallback: localStorage (local-only)
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
