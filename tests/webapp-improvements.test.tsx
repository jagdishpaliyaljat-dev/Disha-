// @vitest-environment jsdom
import fs from "node:fs";
import path from "node:path";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { crossTabSync } from "../src/utils/crossTabSync";

const ROOT = path.resolve(import.meta.dirname, "..");

describe("Web App Capabilities, Performance & Security Improvements", () => {
  describe("Cross-Tab Synchronization Manager", () => {
    it("allows subscribing and receiving broadcast events", () => {
      const listener = vi.fn();
      const unsubscribe = crossTabSync.subscribe(listener);

      crossTabSync.simulateIncoming({ type: "THEME_CHANGED", darkMode: true });

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({ type: "THEME_CHANGED", darkMode: true })
      );

      unsubscribe();
      listener.mockClear();

      crossTabSync.simulateIncoming({ type: "THEME_CHANGED", darkMode: false });
      expect(listener).not.toHaveBeenCalled();
    });

    it("serializes and broadcasts message to localStorage for cross-tab storage event fallback", () => {
      crossTabSync.broadcast({ type: "PROGRESS_UPDATED", timestamp: 123456789 });
      const raw = localStorage.getItem("disha_cross_tab_broadcast_v1");
      expect(raw).toBeDefined();
      const parsed = JSON.parse(raw!);
      expect(parsed.type).toBe("PROGRESS_UPDATED");
      expect(parsed.timestamp).toBe(123456789);
    });
  });

  describe("Web Security Headers in vercel.json", () => {
    it("enforces X-Frame-Options, X-Content-Type-Options, HSTS, and Permissions-Policy", () => {
      const vercel = JSON.parse(fs.readFileSync(path.join(ROOT, "vercel.json"), "utf8"));
      expect(vercel.headers).toBeDefined();

      const globalHeaders = vercel.headers.find((h: any) => h.source === "/(.*)")?.headers;
      expect(globalHeaders).toBeDefined();

      const headerMap = Object.fromEntries(globalHeaders.map((h: any) => [h.key, h.value]));
      expect(headerMap["X-Frame-Options"]).toBe("SAMEORIGIN");
      expect(headerMap["X-Content-Type-Options"]).toBe("nosniff");
      expect(headerMap["Referrer-Policy"]).toBe("strict-origin-when-cross-origin");
      expect(headerMap["Permissions-Policy"]).toContain("camera=()");
      expect(headerMap["Strict-Transport-Security"]).toContain("max-age=63072000");
    });
  });

  describe("Web Print Stylesheet in index.css", () => {
    it("includes @media print rules that hide navbars and optimize readability", () => {
      const css = fs.readFileSync(path.join(ROOT, "src/index.css"), "utf8");
      expect(css).toContain("@media print");
      expect(css).toContain("#bottom-navigation-bar");
      expect(css).toContain("display: none !important");
      expect(css).toContain("page-break-inside: avoid");
    });
  });

  describe("Storage Quota Safeguard in questionsStorage.ts", () => {
    it("does not write individual full question JSON to localStorage", () => {
      const file = fs.readFileSync(path.join(ROOT, "src/utils/questionsStorage.ts"), "utf8");
      // Must not write individual questions into localStorage during updateQuestionInStore
      expect(file).not.toContain("localStorage.setItem(`disha2020_mcq_${updatedQuestion.id}`");
      expect(file).not.toContain("localStorage.setItem(`quizpro_mcq_${updatedQuestion.id}`");
    });
  });

  describe("PWA Install Wiring in StudentNavigationDrawer", () => {
    it("imports usePWAInstall and offers Install Web App action", () => {
      const drawer = fs.readFileSync(path.join(ROOT, "src/components/StudentNavigationDrawer.tsx"), "utf8");
      expect(drawer).toContain("usePWAInstall");
      expect(drawer).toContain("Install Web App");
      expect(drawer).toContain("install()");
    });
  });

  describe("Desktop Keyboard Navigation & Shortcuts Help", () => {
    it("provides KeyboardShortcutsModal component with shortcut definitions", () => {
      const modal = fs.readFileSync(path.join(ROOT, "src/components/KeyboardShortcutsModal.tsx"), "utf8");
      expect(modal).toContain("Keyboard Shortcuts");
      expect(modal).toContain("Ctrl");
      expect(modal).toContain("Esc");
      expect(modal).toContain("Alt");
    });

    it("wires up global ? and Alt+1..5 hotkeys in App.tsx", () => {
      const app = fs.readFileSync(path.join(ROOT, "src/App.tsx"), "utf8");
      expect(app).toContain("isKeyboardShortcutsOpen");
      expect(app).toContain("KeyboardShortcutsModal");
      expect(app).toContain("crossTabSync");
      expect(app).toContain("altKey");
    });
  });

  describe("Active Test Session Protection in MCQSessionModal", () => {
    it("registers beforeunload event listener during active test to prevent accidental refresh", () => {
      const modal = fs.readFileSync(path.join(ROOT, "src/components/MCQSessionModal.tsx"), "utf8");
      expect(modal).toContain('window.addEventListener("beforeunload"');
      expect(modal).toContain("Your test session is in progress");
    });
  });
});
