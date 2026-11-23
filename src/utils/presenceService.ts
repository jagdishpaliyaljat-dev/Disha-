import { supabase, isSupabaseConfigured } from "../lib/supabase";
import { getDeviceCategory, getVisitorId } from "./analytics";
import type { RealtimeChannel } from "@supabase/supabase-js";

export interface LivePresenceUser {
  visitorId: string;
  device: "mobile" | "desktop";
  page: string;
  onlineAt: string;
  isLoggedIn: boolean;
  targetExam?: string;
  userName?: string;
}

export interface LivePresenceSummary {
  onlineCount: number;
  mobileCount: number;
  desktopCount: number;
  pageBreakdown: Record<string, number>;
  activeUsers: LivePresenceUser[];
}

const PRESENCE_CHANNEL_NAME = "disha_live_presence_pulse";

// Singleton channel & listener pool
let sharedPresenceChannel: RealtimeChannel | null = null;
let currentTrackedPayload: LivePresenceUser | null = null;
const adminListeners = new Set<(summary: LivePresenceSummary) => void>();

function calculatePresenceSummary(channel: RealtimeChannel): LivePresenceSummary {
  try {
    const state = channel.presenceState();
    const users: LivePresenceUser[] = [];
    let mobile = 0;
    let desktop = 0;
    const pages: Record<string, number> = {};

    Object.values(state).forEach((presences: any) => {
      if (Array.isArray(presences) && presences.length > 0) {
        const user = presences[0] as LivePresenceUser;
        users.push(user);
        if (user.device === "desktop") desktop++;
        else mobile++;

        const readablePage = user.page || "Home";
        pages[readablePage] = (pages[readablePage] || 0) + 1;
      }
    });

    const onlineCount = users.length > 0 ? users.length : 1;
    return {
      onlineCount,
      mobileCount: mobile,
      desktopCount: desktop,
      pageBreakdown: pages,
      activeUsers: users,
    };
  } catch (err) {
    console.warn("[Presence] Calculate error:", err);
    return {
      onlineCount: 1,
      mobileCount: 1,
      desktopCount: 0,
      pageBreakdown: { Home: 1 },
      activeUsers: [],
    };
  }
}

function notifyAdminListeners() {
  if (!sharedPresenceChannel || adminListeners.size === 0) return;
  const summary = calculatePresenceSummary(sharedPresenceChannel);
  adminListeners.forEach((listener) => {
    try {
      listener(summary);
    } catch (e) {
      console.warn("[Presence] Listener notify error:", e);
    }
  });
}

function getOrCreatePresenceChannel(): RealtimeChannel | null {
  if (!isSupabaseConfigured() || typeof window === "undefined") {
    return null;
  }

  if (sharedPresenceChannel) {
    return sharedPresenceChannel;
  }

  const visitorId = getVisitorId();

  try {
    const channel = supabase.channel(PRESENCE_CHANNEL_NAME, {
      config: {
        presence: {
          key: visitorId,
        },
      },
    });

    // CRITICAL: Attach .on("presence", ...) BEFORE calling .subscribe()
    channel
      .on("presence", { event: "sync" }, () => notifyAdminListeners())
      .on("presence", { event: "join" }, () => notifyAdminListeners())
      .on("presence", { event: "leave" }, () => notifyAdminListeners());

    channel.subscribe(async (status) => {
      if (status === "SUBSCRIBED" && currentTrackedPayload) {
        try {
          await channel.track(currentTrackedPayload);
        } catch (err) {
          console.warn("[Presence] Track error on subscribe:", err);
        }
        notifyAdminListeners();
      }
    });

    sharedPresenceChannel = channel;
    return channel;
  } catch (err) {
    console.warn("[Presence] Channel creation error:", err);
    return null;
  }
}

/**
 * Initializes live presence tracking for a student/visitor on web or app.
 */
export function initStudentPresence(info?: {
  page?: string;
  isLoggedIn?: boolean;
  targetExam?: string;
  userName?: string;
}): () => void {
  if (!isSupabaseConfigured() || typeof window === "undefined") {
    return () => {};
  }

  const visitorId = getVisitorId();
  const device = getDeviceCategory();

  currentTrackedPayload = {
    visitorId,
    device,
    page: info?.page || window.location.pathname || "Home",
    onlineAt: new Date().toISOString(),
    isLoggedIn: Boolean(info?.isLoggedIn),
    targetExam: info?.targetExam || "General",
    userName: info?.userName,
  };

  const channel = getOrCreatePresenceChannel();
  if (channel && channel.state === "joined") {
    channel.track(currentTrackedPayload).catch(() => {});
  }

  const handleVisibilityChange = () => {
    if (!sharedPresenceChannel || !currentTrackedPayload) return;
    if (document.visibilityState === "visible") {
      sharedPresenceChannel.track(currentTrackedPayload).catch(() => {});
    } else {
      sharedPresenceChannel.untrack().catch(() => {});
    }
  };

  document.addEventListener("visibilitychange", handleVisibilityChange);

  return () => {
    document.removeEventListener("visibilitychange", handleVisibilityChange);
    // Keep shared channel alive for admin or other listeners
  };
}

/**
 * Updates the current student's active page in presence tracking (on SPA route change)
 */
export function updateStudentPresencePage(newPage: string): void {
  if (!currentTrackedPayload) {
    currentTrackedPayload = {
      visitorId: getVisitorId(),
      device: getDeviceCategory(),
      page: newPage,
      onlineAt: new Date().toISOString(),
      isLoggedIn: false,
    };
  } else {
    currentTrackedPayload.page = newPage;
  }

  if (sharedPresenceChannel && sharedPresenceChannel.state === "joined") {
    sharedPresenceChannel.track(currentTrackedPayload).catch(() => {});
  }
}

/**
 * Subscribes to live presence updates for the Admin Analytics Dashboard.
 * Safe from "cannot add presence callbacks after subscribe" error.
 */
export function subscribeToAdminLivePresence(
  onUpdate: (summary: LivePresenceSummary) => void
): () => void {
  // Always register listener
  adminListeners.add(onUpdate);

  const fallbackSummary: LivePresenceSummary = {
    onlineCount: 1,
    mobileCount: 1,
    desktopCount: 0,
    pageBreakdown: { Home: 1 },
    activeUsers: [],
  };

  if (!isSupabaseConfigured() || typeof window === "undefined") {
    onUpdate(fallbackSummary);
    return () => {
      adminListeners.delete(onUpdate);
    };
  }

  try {
    const channel = getOrCreatePresenceChannel();
    if (channel) {
      // Immediately send current presence if available
      const current = calculatePresenceSummary(channel);
      onUpdate(current);
    } else {
      onUpdate(fallbackSummary);
    }
  } catch (err) {
    console.warn("[Presence] subscribeToAdminLivePresence error:", err);
    onUpdate(fallbackSummary);
  }

  return () => {
    adminListeners.delete(onUpdate);
  };
}
