import { AppNotification } from "../types";

const STORAGE_KEY = "rajprep_notifications_v1";
const SETTINGS_KEY = "rajprep_notification_settings_v1";

export interface NotificationSettings {
  studyReminders: boolean;
  reminderTime: string; // e.g. "08:00"
  examUpdates: boolean;
  performanceMilestones: boolean;
  soundEnabled: boolean;
}

export const defaultNotificationSettings: NotificationSettings = {
  studyReminders: true,
  reminderTime: "08:30",
  examUpdates: true,
  performanceMilestones: true,
  soundEnabled: true,
};

export const defaultNotifications: AppNotification[] = [];

export function loadNotifications(): AppNotification[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed;
    }
    return [];
  } catch (e) {
    console.warn("Failed to load notifications", e);
    return [];
  }
}

export function saveNotifications(notifications: AppNotification[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notifications));
  } catch (e) {
    console.error("Failed to save notifications to localStorage", e);
  }
}

export const NOTIFICATIONS_UPDATED_EVENT = "disha_notifications_updated";

/**
 * Prepend a new student notification and broadcast event to subscribers.
 */
export function addNotification(
  notifInput: Omit<AppNotification, "id" | "timestamp" | "read"> & Partial<Pick<AppNotification, "id" | "timestamp" | "read">>
): AppNotification {
  const newNotif: AppNotification = {
    id: notifInput.id || `notif_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    title: notifInput.title,
    hindiTitle: notifInput.hindiTitle || notifInput.title,
    message: notifInput.message,
    hindiMessage: notifInput.hindiMessage || notifInput.message,
    category: notifInput.category || "study",
    timestamp: notifInput.timestamp || new Date().toISOString(),
    read: notifInput.read ?? false,
    priority: notifInput.priority || "normal",
    actionType: notifInput.actionType || "none",
    actionData: notifInput.actionData,
  };

  try {
    const current = loadNotifications();
    const updated = [newNotif, ...current.filter((n) => n.id !== newNotif.id)].slice(0, 150);
    saveNotifications(updated);

    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent(NOTIFICATIONS_UPDATED_EVENT, { detail: newNotif }));
    }
  } catch (err) {
    console.warn("[NotificationsStorage] Error adding notification:", err);
  }

  return newNotif;
}

export function loadNotificationSettings(): NotificationSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return defaultNotificationSettings;
    return { ...defaultNotificationSettings, ...JSON.parse(raw) };
  } catch {
    return defaultNotificationSettings;
  }
}

export function saveNotificationSettings(settings: NotificationSettings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch (e) {
    console.error("Failed to save notification settings", e);
  }
}
