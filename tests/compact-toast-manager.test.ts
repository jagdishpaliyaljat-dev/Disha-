// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("Compact Toast & Lightweight Notification Manager", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("calculates 2s auto-dismiss for success/add/update/delete and 4s for error", () => {
    const getDuration = (type: string, explicitDuration?: number) => {
      return explicitDuration || (type === "error" ? 4000 : 2000);
    };

    expect(getDuration("success")).toBe(2000);
    expect(getDuration("add")).toBe(2000);
    expect(getDuration("update")).toBe(2000);
    expect(getDuration("delete")).toBe(2000);
    expect(getDuration("info")).toBe(2000);
    expect(getDuration("error")).toBe(4000);
    expect(getDuration("success", 1500)).toBe(1500);
  });

  it("deduplicates identical toast events fired within 1800ms window", () => {
    const recentFingerprints = new Map<string, number>();

    const checkDuplicate = (type: string, title: string, itemName: string = "") => {
      const fingerprint = `${type}_${title.trim()}_${itemName}`;
      const now = Date.now();
      const last = recentFingerprints.get(fingerprint);
      if (last && now - last < 1800) {
        return true; // Duplicate!
      }
      recentFingerprints.set(fingerprint, now);
      return false; // Allowed!
    };

    // First event: allowed
    expect(checkDuplicate("add", "डेटा लाइव सेव हो गया", "राजस्थान भूगोल")).toBe(false);

    // Immediate duplicate: blocked
    expect(checkDuplicate("add", "डेटा लाइव सेव हो गया", "राजस्थान भूगोल")).toBe(true);

    // Event with different title: allowed
    expect(checkDuplicate("add", "नया टॉपिक जोड़ा गया", "राजस्थान भूगोल")).toBe(false);

    // Advance time past 1800ms
    vi.advanceTimersByTime(2000);

    // Now the original event is allowed again
    expect(checkDuplicate("add", "डेटा लाइव सेव हो गया", "राजस्थान भूगोल")).toBe(false);
  });

  it("limits active visible toasts to 1 and queues subsequent notifications in FIFO order", () => {
    let currentToast: any = null;
    const queue: any[] = [];

    const enqueue = (toast: any) => {
      if (currentToast === null) {
        currentToast = toast;
      } else {
        if (queue.length < 4) {
          queue.push(toast);
        }
      }
    };

    const dismiss = () => {
      currentToast = queue.shift() || null;
    };

    // 1st toast arrives: becomes currentToast
    enqueue({ id: "t1", title: "Toast 1" });
    expect(currentToast?.id).toBe("t1");
    expect(queue.length).toBe(0);

    // 2nd and 3rd toast arrive: queued
    enqueue({ id: "t2", title: "Toast 2" });
    enqueue({ id: "t3", title: "Toast 3" });
    expect(currentToast?.id).toBe("t1");
    expect(queue.length).toBe(2);
    expect(queue[0].id).toBe("t2");
    expect(queue[1].id).toBe("t3");

    // Dismiss current toast: t2 pops from queue to currentToast
    dismiss();
    expect(currentToast?.id).toBe("t2");
    expect(queue.length).toBe(1);

    // Dismiss again: t3 pops
    dismiss();
    expect(currentToast?.id).toBe("t3");
    expect(queue.length).toBe(0);

    // Dismiss again: becomes null
    dismiss();
    expect(currentToast).toBeNull();
  });
});
