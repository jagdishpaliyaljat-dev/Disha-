// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Wiring guards for the shared contact inbox.
 *
 * These tests lock in the architecture: the admin inbox must go through the
 * async Supabase-aware storage helpers instead of reading/writing localStorage
 * directly, so a future refactor cannot silently drop cross-device support.
 */
describe("Admin contact inbox wiring", () => {
  const componentSource = readFileSync(
    resolve(__dirname, "../src/components/admin/AdminMessagesSection.tsx"),
    "utf8"
  );

  it("CI-01 loads messages through the shared fetch helper", () => {
    expect(componentSource).toContain("fetchContactMessages");
    expect(componentSource).not.toContain("loadContactMessages");
  });

  it("CI-02 persists status changes through the shared update helper", () => {
    expect(componentSource).toContain("updateContactMessageStatus");
    expect(componentSource).not.toContain("saveContactMessages");
  });

  it("CI-03 deletes through the shared delete helper", () => {
    expect(componentSource).toContain("deleteContactMessage");
  });

  it("CI-04 surfaces a failed status update instead of faking success", () => {
    expect(componentSource).toMatch(/const ok = await updateContactMessageStatus/);
    expect(componentSource).toMatch(/if \(!ok\)/);
  });

  it("CI-05 surfaces a failed delete instead of faking success", () => {
    expect(componentSource).toMatch(/const ok = await deleteContactMessage/);
  });

  it("CI-06 keeps loading and empty states for the inbox", () => {
    expect(componentSource).toContain("loading");
    expect(componentSource).toMatch(/filteredMessages\.length === 0/);
  });
});
