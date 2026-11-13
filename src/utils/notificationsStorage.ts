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
