/**
 * DISHA 20-20 — Cross-Tab Synchronization Manager
 * Uses BroadcastChannel with localStorage fallback to keep multiple open browser tabs in sync
 * for Authentication state, Dark Mode theme, and Question Bookmark updates.
 */

export type CrossTabSyncEvent =
  | { type: "AUTH_STATE_CHANGED"; userId?: string | null }
  | { type: "THEME_CHANGED"; darkMode: boolean; amoledBlack?: boolean }
  | { type: "PROGRESS_UPDATED"; timestamp: number }
  | { type: "BOOKMARK_UPDATED"; questionId: string; bookmarked: boolean };

type SyncCallback = (event: CrossTabSyncEvent) => void;

class CrossTabSyncManager {
  private channel: BroadcastChannel | null = null;
  private listeners: Set<SyncCallback> = new Set();
  private storageKey = "disha_cross_tab_broadcast_v1";

  constructor() {
    if (typeof window !== "undefined" && "BroadcastChannel" in window) {
      try {
        this.channel = new BroadcastChannel("disha_cross_tab_sync");
        this.channel.onmessage = (messageEvent) => {
          if (messageEvent.data && typeof messageEvent.data.type === "string") {
            this.notifyListeners(messageEvent.data as CrossTabSyncEvent);
          }
        };
      } catch (e) {
        console.warn("[CrossTabSync] BroadcastChannel unavailable, using storage event fallback:", e);
      }
    }

    if (typeof window !== "undefined") {
      window.addEventListener("storage", (e) => {
        if (e.key === this.storageKey && e.newValue) {
          try {
            const data = JSON.parse(e.newValue);
            if (data && typeof data.type === "string") {
              this.notifyListeners(data as CrossTabSyncEvent);
            }
          } catch (_) {}
        }
      });
    }
  }

  public broadcast(event: CrossTabSyncEvent): void {
    if (this.channel) {
      try {
        this.channel.postMessage(event);
      } catch (err) {
        console.warn("[CrossTabSync] postMessage error:", err);
      }
    }
    if (typeof window !== "undefined" && typeof localStorage !== "undefined") {
      try {
        localStorage.setItem(
          this.storageKey,
          JSON.stringify({ ...event, _ts: Date.now() })
        );
      } catch (_) {}
    }
  }

  /**
   * Simulates receiving a cross-tab event from another tab (useful for testing or fallback hooks)
   */
  public simulateIncoming(event: CrossTabSyncEvent): void {
    this.notifyListeners(event);
  }

  public subscribe(callback: SyncCallback): () => void {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }

  private notifyListeners(event: CrossTabSyncEvent): void {
    this.listeners.forEach((listener) => {
      try {
        listener(event);
      } catch (err) {
        console.warn("[CrossTabSync] Listener error:", err);
      }
    });
  }
}

export const crossTabSync = new CrossTabSyncManager();
