// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import {
  DEFAULT_APP_FEATURES,
  getLocalAppFeatures,
  isAppFeatureEnabled,
  toggleSingleFeature,
  FeatureKey
} from "../src/utils/featureControlService";

describe("Feature Control Service", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("should have all 10 default features initialized and enabled", () => {
    const features = getLocalAppFeatures();
    const keys = Object.keys(features) as FeatureKey[];

    expect(keys.length).toBe(10);
    expect(keys).toContain("disha_ai");
    expect(keys).toContain("live_battle");
    expect(keys).toContain("video_classes");
    expect(keys).toContain("live_tests");
    expect(keys).toContain("pyq_vault");
    expect(keys).toContain("custom_test");
    expect(keys).toContain("news_articles");
    expect(keys).toContain("omr_scanner");
    expect(keys).toContain("pdf_export");
    expect(keys).toContain("guest_mode");

    expect(isAppFeatureEnabled("disha_ai")).toBe(true);
    expect(isAppFeatureEnabled("live_battle")).toBe(true);
    expect(isAppFeatureEnabled("video_classes")).toBe(true);
  });

  it("should toggle a feature state and update local check", async () => {
    // Disable disha_ai
    await toggleSingleFeature("disha_ai", false, "admin@test.com", "Under maintenance");
    expect(isAppFeatureEnabled("disha_ai")).toBe(false);

    const current = getLocalAppFeatures();
    expect(current.disha_ai.enabled).toBe(false);
    expect(current.disha_ai.maintenanceMessage).toBe("Under maintenance");

    // Re-enable disha_ai
    await toggleSingleFeature("disha_ai", true, "admin@test.com");
    expect(isAppFeatureEnabled("disha_ai")).toBe(true);
  });

  it("should preserve other features when toggling one feature", async () => {
    await toggleSingleFeature("live_battle", false, "admin@test.com");

    expect(isAppFeatureEnabled("live_battle")).toBe(false);
    expect(isAppFeatureEnabled("video_classes")).toBe(true);
    expect(isAppFeatureEnabled("live_tests")).toBe(true);
    expect(isAppFeatureEnabled("pyq_vault")).toBe(true);
  });
});
