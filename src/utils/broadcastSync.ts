/**
 * Cross-Tab and Multi-Tab Synchronization Service
 * Uses BroadcastChannel with localStorage storage-event fallback to synchronize state across multiple tabs
 * while guarding against infinite echo loops and handling missing storage gracefully.
 */

const CHANNEL_NAME = "quizpro_tab_sync_v1";

export interface SyncMessage {
  type: "CURRICULUM_UPDATED" | "MCQ_CACHE_INVALIDATED" | "VERSION_BUMPED";
  sourceTabId: string;
  topicId?: string;
  timestamp: number;
}

const localTabId = typeof window !== "undefined"
  ? `tab_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`
  : "server_env";

let channel: BroadcastChannel | null = null;

if (typeof window !== "undefined" && typeof BroadcastChannel !== "undefined") {
  try {
    channel = new BroadcastChannel(CHANNEL_NAME);
  } catch (_) {
    channel = null;
  }
}

/**
 * Broadcast an update event to all other open tabs/windows
 */
export function broadcastCurriculumUpdate(topicId?: string): void {
  const msg: SyncMessage = {
    type: "CURRICULUM_UPDATED",
    sourceTabId: localTabId,
    topicId,
    timestamp: Date.now(),
  };

  // 1. Post to BroadcastChannel
  if (channel) {
    try {
      channel.postMessage(msg);
    } catch (_) {}
  }

  // 2. Storage event fallback for cross-tab notification
  if (typeof window !== "undefined" && typeof localStorage !== "undefined") {
    try {
      localStorage.setItem("quizpro_cross_tab_signal", JSON.stringify(msg));
    } catch (_) {}
  }

  // 3. Local same-tab custom event (dedicated event name so it never collides with UserQuestionsStore in quizpro_store_updated)
  if (typeof window !== "undefined") {
    try {
      window.dispatchEvent(new CustomEvent("quizpro_cross_tab_event", { detail: msg }));
    } catch (_) {}
  }
}

/**
 * Subscribe to cross-tab updates. Prevents self-echo loops by ignoring sourceTabId === localTabId.
 */
export function subscribeCrossTabSync(callback: (msg: SyncMessage) => void): () => void {
  if (typeof window === "undefined") return () => {};

  const processMessage = (msg: SyncMessage) => {
    // Prevent infinite loop by ignoring messages originated by this same tab
    if (msg && msg.sourceTabId === localTabId) return;
    callback(msg);
  };

  // 1. BroadcastChannel listener
  const bcListener = (event: MessageEvent<SyncMessage>) => {
    if (event.data && event.data.type) {
      processMessage(event.data);
    }
  };

  if (channel) {
    channel.addEventListener("message", bcListener);
  }

  // 2. LocalStorage fallback listener
  const storageListener = (e: StorageEvent) => {
    if (e.key === "quizpro_cross_tab_signal" && e.newValue) {
      try {
        const parsed: SyncMessage = JSON.parse(e.newValue);
        processMessage(parsed);
      } catch (_) {}
    }
  };
  window.addEventListener("storage", storageListener);

  // 3. Same-tab CustomEvent listener
  const customEventListener = (e: Event) => {
    const detail = (e as CustomEvent).detail;
    if (detail && detail.sourceTabId !== localTabId) {
      callback(detail);
    }
  };
  window.addEventListener("quizpro_cross_tab_event", customEventListener);

  return () => {
    if (channel) {
      channel.removeEventListener("message", bcListener);
    }
    window.removeEventListener("storage", storageListener);
    window.removeEventListener("quizpro_cross_tab_event", customEventListener);
  };
}
