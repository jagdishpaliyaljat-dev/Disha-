import { supabase, isSupabaseConfigured } from "../lib/supabase";
import { AppNotification } from "../types";

export interface BroadcastNotification {
  id: string;
  title: string;
  hindiTitle: string;
  message: string;
  hindiMessage: string;
  category: "exam" | "test" | "update" | "streak" | "general";
  priority: "low" | "normal" | "high" | "urgent";
  targetExam: string; // 'all' or specific exam like 'RAS', 'CET', etc.
  actionType: "none" | "open_link" | "open_tab" | "start_test";
  actionUrl?: string;
  actionPayload?: Record<string, any>;
  sentBy?: string;
  createdAt: string;
  isActive: boolean;
}

const LOCAL_BROADCASTS_KEY = "disha2020_admin_broadcasts_v2";
const SEEN_BROADCAST_IDS_KEY = "disha2020_seen_broadcast_ids_v1";

/**
 * Send a new broadcast notification from Admin (persists to Supabase & local cache)
 */
export async function sendBroadcastNotification(
  input: Omit<BroadcastNotification, "id" | "createdAt" | "isActive">
): Promise<{ success: boolean; id: string; error?: string }> {
  const id = `bcast_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const createdAt = new Date().toISOString();

  const record: BroadcastNotification = {
    id,
    ...input,
    createdAt,
    isActive: true,
  };

  // 1. Always update local storage cache immediately
  try {
    const raw = localStorage.getItem(LOCAL_BROADCASTS_KEY);
    const list: BroadcastNotification[] = raw ? JSON.parse(raw) : [];
    const updated = [record, ...list.filter((b) => b.id !== id)].slice(0, 100);
    localStorage.setItem(LOCAL_BROADCASTS_KEY, JSON.stringify(updated));
  } catch (err) {
    console.warn("[Broadcast] Failed to save to local cache:", err);
  }

  // 2. Persist to Supabase if configured
  if (isSupabaseConfigured()) {
    try {
      const { error } = await supabase.from("broadcast_notifications").insert({
        id: record.id,
        title: record.title,
        hindi_title: record.hindiTitle,
        message: record.message,
        hindi_message: record.hindiMessage,
        category: record.category,
        priority: record.priority,
        target_exam: record.targetExam || "all",
        action_type: record.actionType,
        action_url: record.actionUrl || null,
        action_payload: record.actionPayload || null,
        sent_by: record.sentBy || "Admin",
        created_at: record.createdAt,
        is_active: true,
      });

      if (error) {
        console.warn("[Broadcast] Supabase insert warning:", error.message);
        return { success: true, id, error: error.message };
      }
    } catch (err: any) {
      console.warn("[Broadcast] Supabase network error:", err?.message);
    }
  }

  return { success: true, id };
}

/**
 * Fetch active broadcast notifications (Supabase first, fallback to local cache)
 */
export async function fetchActiveBroadcasts(): Promise<BroadcastNotification[]> {
  if (isSupabaseConfigured()) {
    try {
      const { data, error } = await supabase
        .from("broadcast_notifications")
        .select("*")
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(50);

      if (!error && Array.isArray(data)) {
        const mapped: BroadcastNotification[] = data.map((row: any) => ({
          id: row.id,
          title: row.title,
          hindiTitle: row.hindi_title || row.title,
          message: row.message,
          hindiMessage: row.hindi_message || row.message,
          category: row.category || "general",
          priority: row.priority || "normal",
          targetExam: row.target_exam || "all",
          actionType: row.action_type || "none",
          actionUrl: row.action_url || undefined,
          actionPayload: row.action_payload || undefined,
          sentBy: row.sent_by,
          createdAt: row.created_at,
          isActive: row.is_active ?? true,
        }));

        try {
          localStorage.setItem(LOCAL_BROADCASTS_KEY, JSON.stringify(mapped));
        } catch {}

        return mapped;
      }
    } catch (err) {
      console.warn("[Broadcast] Fetch error, falling back to local cache:", err);
    }
  }

  // Fallback to local storage
  try {
    const raw = localStorage.getItem(LOCAL_BROADCASTS_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch {}

  return [];
}

/**
 * Delete / deactivate a broadcast notification
 */
export async function deleteBroadcastNotification(id: string): Promise<boolean> {
  // Update local cache
  try {
    const raw = localStorage.getItem(LOCAL_BROADCASTS_KEY);
    if (raw) {
      const list: BroadcastNotification[] = JSON.parse(raw);
      const filtered = list.filter((b) => b.id !== id);
      localStorage.setItem(LOCAL_BROADCASTS_KEY, JSON.stringify(filtered));
    }
  } catch {}

  // Update Supabase
  if (isSupabaseConfigured()) {
    try {
      const { error } = await supabase
        .from("broadcast_notifications")
        .update({ is_active: false })
        .eq("id", id);
      return !error;
    } catch {
      return false;
    }
  }
  return true;
}

/**
 * Merge new broadcasts into student user notifications list
 */
export function mergeBroadcastsIntoUserNotifications(
  currentNotifications: AppNotification[],
  broadcasts: BroadcastNotification[],
  userTargetExam?: string
): { updatedNotifications: AppNotification[]; newCount: number } {
  let seenIds: string[] = [];
  try {
    const rawSeen = localStorage.getItem(SEEN_BROADCAST_IDS_KEY);
    if (rawSeen) seenIds = JSON.parse(rawSeen);
  } catch {}

  const seenSet = new Set(seenIds);
  const existingNotificationIds = new Set(currentNotifications.map((n) => n.id));

  const eligibleBroadcasts = broadcasts.filter((b) => {
    if (!b.isActive) return false;
    // Target exam match: 'all' or matches student's target exam
    if (b.targetExam && b.targetExam !== "all") {
      if (userTargetExam && !userTargetExam.toLowerCase().includes(b.targetExam.toLowerCase())) {
        return false;
      }
    }
    return !existingNotificationIds.has(b.id);
  });

  if (eligibleBroadcasts.length === 0) {
    return { updatedNotifications: currentNotifications, newCount: 0 };
  }

  const newAppNotifications: AppNotification[] = eligibleBroadcasts.map((b) => {
    // If not in seenSet, mark as unread
    const isUnread = !seenSet.has(b.id);

    return {
      id: b.id,
      title: b.title,
      hindiTitle: b.hindiTitle,
      message: b.message,
      hindiMessage: b.hindiMessage,
      category: b.category as any,
      priority: b.priority as any,
      timestamp: b.createdAt,
      read: !isUnread,
      actionType: b.actionType !== "none" ? (b.actionType as any) : undefined,
      actionData: b.actionUrl ? { url: b.actionUrl } : b.actionPayload,
    };
  });

  const merged = [...newAppNotifications, ...currentNotifications];

  // Update seen set
  eligibleBroadcasts.forEach((b) => seenSet.add(b.id));
  try {
    localStorage.setItem(SEEN_BROADCAST_IDS_KEY, JSON.stringify(Array.from(seenSet).slice(-200)));
  } catch {}

  const newCount = newAppNotifications.filter((n) => !n.read).length;
  return { updatedNotifications: merged, newCount };
}
