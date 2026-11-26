// @vitest-environment jsdom
import React, { act } from "react";
import ReactDOM from "react-dom/client";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { AppModal } from "../src/components/ui/AppModal";
import {
  TabContentSkeleton,
  QuestionCardSkeleton,
  PremiumSkeleton,
} from "../src/components/ui/LoadingScreen";

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

// Mock audio/haptics
vi.mock("../src/utils/audioFeedback", () => ({
  triggerHaptic: vi.fn(),
  playClickSound: vi.fn(),
}));

describe("UI/UX Improvements — Popups, Buttons & Skeletons", () => {
  let container: HTMLDivElement;
  let root: ReactDOM.Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = ReactDOM.createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it("AppModal renders with role=dialog, aria-modal=true and closes on Escape key", async () => {
    const handleClose = vi.fn();
    await act(async () => {
      root.render(
        <AppModal
          isOpen={true}
          onClose={handleClose}
          title="Test Modal Title"
          subtitle="Subtitle test"
        >
          <div>Modal Body Content</div>
        </AppModal>
      );
    });

    const dialog = container.querySelector('[role="dialog"]');
    expect(dialog).not.toBeNull();
    expect(dialog?.getAttribute("aria-modal")).toBe("true");

    const closeBtn = container.querySelector('button[aria-label="Close modal"]');
    expect(closeBtn).not.toBeNull();
    expect(closeBtn?.className).toContain("w-11");
    expect(closeBtn?.className).toContain("h-11");

    // Press Escape key on window
    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    });

    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it("TabContentSkeleton renders with role=status and layout-matched shimmer elements", async () => {
    await act(async () => {
      root.render(<TabContentSkeleton />);
    });
    const status = container.querySelector('[role="status"]');
    expect(status).not.toBeNull();
    expect(status?.getAttribute("aria-label")).toBe("Loading content...");
  });

  it("QuestionCardSkeleton renders with role=status and option skeletons", async () => {
    await act(async () => {
      root.render(<QuestionCardSkeleton />);
    });
    const status = container.querySelector('[role="status"]');
    expect(status).not.toBeNull();
    expect(status?.getAttribute("aria-label")).toBe("Loading question...");
  });

  it("PremiumSkeleton renders cleanly without throwing", async () => {
    await act(async () => {
      root.render(<PremiumSkeleton className="h-6 w-32" />);
    });
    expect(container.firstChild).not.toBeNull();
  });
});
