import { supabase, isSupabaseConfigured } from "../lib/supabase";
import { getDeviceCategory, getVisitorId } from "./analytics";

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

let activeStudentChannel: any = null;

/**
 * Initializes live presence tracking for a student/visitor on web or app.
 * Automatically untracks when the tab closes or becomes inactive.
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

  // Avoid duplicate channels
  if (activeStudentChannel) {
    try {
      supabase.removeChannel(activeStudentChannel);
    } catch {}
    activeStudentChannel = null;
  }

  const visitorId = getVisitorId();
  const device = getDeviceCategory();

  const channel = supabase.channel(PRESENCE_CHANNEL_NAME, {
    config: {
      presence: {
        key: visitorId,
      },
    },
  });

  const trackState = async (pageName?: string) => {
    try {
      const payload: LivePresenceUser = {
        visitorId,
        device,
        page: pageName || info?.page || window.location.pathname || "Home",
        onlineAt: new Date().toISOString(),
        isLoggedIn: Boolean(info?.isLoggedIn),
        targetExam: info?.targetExam || "General",
        userName: info?.userName,
      };
      await channel.track(payload);
    } catch (err) {
      console.warn("[Presence] Track error:", err);
    }
  };

  channel.subscribe(async (status) => {
    if (status === "SUBSCRIBED") {
      await trackState();
    }
  });

  activeStudentChannel = channel;

  // Handle visibility changes (pause tracking if user switches apps/tabs)
  const handleVisibilityChange = () => {
    if (document.visibilityState === "visible") {
      trackState();
    } else {
      try {
        channel.untrack();
      } catch {}
    }
  };

  document.addEventListener("visibilitychange", handleVisibilityChange);

  // Return cleanup function
  return () => {
    document.removeEventListener("visibilitychange", handleVisibilityChange);
    try {
      channel.untrack();
      supabase.removeChannel(channel);
    } catch {}
    if (activeStudentChannel === channel) {
      activeStudentChannel = null;
    }
  };
}

/**
 * Updates the current student's active page in presence tracking (on SPA route change)
 */
export function updateStudentPresencePage(newPage: string): void {
  if (activeStudentChannel) {
    try {
      const visitorId = getVisitorId();
      const device = getDeviceCategory();
      activeStudentChannel.track({
        visitorId,
        device,
        page: newPage,
        onlineAt: new Date().toISOString(),
      });
    } catch {}
  }
}

/**
 * Subscribes to live presence updates for the Admin Analytics Dashboard.
 */
export function subscribeToAdminLivePresence(
  onUpdate: (summary: LivePresenceSummary) => void
): () => void {
  if (!isSupabaseConfigured() || typeof window === "undefined") {
    onUpdate({
      onlineCount: 1,
      mobileCount: 1,
      desktopCount: 0,
      pageBreakdown: { Home: 1 },
      activeUsers: [],
    });
    return () => {};
  }

  const channel = supabase.channel(PRESENCE_CHANNEL_NAME);

  const calculateSummary = () => {
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

      const onlineCount = users.length > 0 ? users.length : 1; // At least admin themselves
      onUpdate({
        onlineCount,
        mobileCount: mobile,
        desktopCount: desktop,
        pageBreakdown: pages,
        activeUsers: users,
      });
    } catch (err) {
      console.warn("[Presence] Calculate error:", err);
    }
  };

  channel
    .on("presence", { event: "sync" }, calculateSummary)
    .on("presence", { event: "join" }, calculateSummary)
    .on("presence", { event: "leave" }, calculateSummary)
    .subscribe((status) => {
      if (status === "SUBSCRIBED") {
        calculateSummary();
      }
    });

  return () => {
    try {
      supabase.removeChannel(channel);
    } catch {}
  };
}
