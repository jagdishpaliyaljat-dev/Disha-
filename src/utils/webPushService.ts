/**
 * DISHA 20-20 — Web Push Notification & Service Worker Messaging Service
 * Provides full support for browser Push API, system notifications, and study alerts.
 */

const PUSH_SUB_KEY = "disha_push_subscription_v1";

export interface PushNotificationPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  url?: string;
  tag?: string;
  category?: string;
  actions?: Array<{ action: string; title: string }>;
}

/**
 * Checks if the current browser environment supports Push Notifications and Service Workers.
 */
export function isPushNotificationSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "Notification" in window
  );
}

/**
 * Returns the current notification permission status.
 */
export function getNotificationPermission(): NotificationPermission | "unsupported" {
  if (!isPushNotificationSupported()) return "unsupported";
  return Notification.permission;
}

/**
 * Requests notification permission from the user.
 */
export async function requestNotificationPermission(): Promise<NotificationPermission | "unsupported"> {
  if (!isPushNotificationSupported()) return "unsupported";
  try {
    const permission = await Notification.requestPermission();
    return permission;
  } catch (error) {
    console.error("Error requesting notification permission:", error);
    return Notification.permission;
  }
}

/**
 * Converts a base64 URL-safe string to a Uint8Array for VAPID applicationServerKey.
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Registers or retrieves the Web Push subscription from the Service Worker.
 */
export async function registerPushSubscription(
  vapidPublicKey?: string
): Promise<PushSubscription | null> {
  if (!isPushNotificationSupported()) return null;

  try {
    const registration = await navigator.serviceWorker.ready;
    if (!registration.pushManager) {
      console.warn("PushManager is not available in current service worker registration.");
      return null;
    }

    let subscription = await registration.pushManager.getSubscription();

    if (!subscription && vapidPublicKey) {
      const convertedVapidKey = urlBase64ToUint8Array(vapidPublicKey);
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: convertedVapidKey as unknown as BufferSource,
      });
    }

    if (subscription) {
      try {
        localStorage.setItem(PUSH_SUB_KEY, JSON.stringify(subscription));
      } catch {}
    }

    return subscription;
  } catch (error) {
    console.error("Failed to register push subscription:", error);
    return null;
  }
}

/**
 * Retrieves cached push subscription.
 */
export function getCachedPushSubscription(): PushSubscription | null {
  try {
    const raw = localStorage.getItem(PUSH_SUB_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/**
 * Triggers a local device notification via the Service Worker or standard Notification API.
 */
export async function triggerLocalNotification(
  payload: PushNotificationPayload
): Promise<boolean> {
  if (!isPushNotificationSupported()) {
    console.warn("Notifications not supported in this environment.");
    return false;
  }

  if (Notification.permission !== "granted") {
    const perm = await requestNotificationPermission();
    if (perm !== "granted") return false;
  }

  const {
    title,
    body,
    icon = "/pwa-192x192.png",
    badge = "/icon.svg",
    url = "/",
    tag = "disha-notification",
    actions,
  } = payload;

  try {
    if ("serviceWorker" in navigator) {
      const registration = await navigator.serviceWorker.ready;
      if (registration && registration.showNotification) {
        const notifOptions: any = {
          body,
          icon,
          badge,
          tag,
          renotify: true,
          data: { url, timestamp: Date.now() },
          actions: actions || [
            { action: "open_app", title: "🚀 Open App" },
            { action: "dismiss", title: "Dismiss" },
          ],
        };
        await registration.showNotification(title, notifOptions);
        return true;
      }
    }

    // Direct fallback if registration is not immediately ready
    new Notification(title, {
      body,
      icon,
      badge,
      tag,
      data: { url },
    });
    return true;
  } catch (error) {
    console.error("Failed to trigger local notification:", error);
    return false;
  }
}

/**
 * Schedules a daily study reminder check at the specified "HH:MM" string.
 */
export function setupDailyStudyNotificationTimer(
  timeStr: string, // e.g. "08:30"
  callback?: () => void
): () => void {
  let timerId: any = null;

  const checkAndTrigger = () => {
    const now = new Date();
    const [targetHour, targetMin] = timeStr.split(":").map(Number);
    if (
      isNaN(targetHour) ||
      isNaN(targetMin) ||
      targetHour < 0 ||
      targetHour > 23 ||
      targetMin < 0 ||
      targetMin > 59
    ) {
      return;
    }

    const currentHour = now.getHours();
    const currentMin = now.getMinutes();

    const lastTriggerDate = localStorage.getItem("disha_last_study_reminder_date");
    const todayStr = now.toISOString().slice(0, 10);

    if (currentHour === targetHour && currentMin === targetMin && lastTriggerDate !== todayStr) {
      localStorage.setItem("disha_last_study_reminder_date", todayStr);
      triggerLocalNotification({
        title: "📚 DISHA 20-20 — Study Time!",
        body: "Complete today's 20-question practice test and boost your leaderboard rank.",
        url: "/",
        tag: "daily-study-reminder",
      });
      if (callback) callback();
    }
  };

  // Run check every 30 seconds
  timerId = setInterval(checkAndTrigger, 30000);
  checkAndTrigger();

  return () => {
    if (timerId) clearInterval(timerId);
  };
}
