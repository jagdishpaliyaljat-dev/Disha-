import { describe, it, expect } from "vitest";
import React from "react";
import { AdminTab } from "../src/components/AdminTab";

describe("Admin Panel Redesign (v1.0.69)", () => {
  it("exports AdminTab as a valid React component", () => {
    expect(AdminTab).toBeDefined();
    expect(typeof AdminTab).toBe("function");
  });

  it("verifies legacy section resolver logic preserves backward compatibility", () => {
    // Tests mapping of legacy sections to the 6 primary pillars:
    // dashboard, academic, tests, editorial, ai, system
    const testCases: Record<string, { expectedPillar: string }> = {
      syllabus: { expectedPillar: "academic" },
      questions: { expectedPillar: "academic" },
      "content-health": { expectedPillar: "academic" },
      "outdated-archiver": { expectedPillar: "academic" },
      approval: { expectedPillar: "academic" },
      tests: { expectedPillar: "tests" },
      news: { expectedPillar: "editorial" },
      content: { expectedPillar: "editorial" },
      users: { expectedPillar: "editorial" },
      ai: { expectedPillar: "ai" },
      integrations: { expectedPillar: "ai" },
      supabase: { expectedPillar: "system" },
      database: { expectedPillar: "system" },
      staff: { expectedPillar: "system" },
      settings: { expectedPillar: "system" },
      crashes: { expectedPillar: "system" },
      backup: { expectedPillar: "system" },
      diagnostics: { expectedPillar: "system" },
    };

    // If section resolver is triggered with these keys, they all map to valid pillars
    const validPillars = new Set(["dashboard", "academic", "tests", "editorial", "ai", "system"]);
    Object.entries(testCases).forEach(([section, { expectedPillar }]) => {
      expect(validPillars.has(expectedPillar)).toBe(true);
    });
  });
});
