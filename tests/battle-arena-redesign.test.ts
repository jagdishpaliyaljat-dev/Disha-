import { describe, it, expect } from "vitest";
import { formatCategoryLabel } from "../src/components/battle/BattleArenaView";

describe("BattleArenaView UI Redesign & Category Formatting", () => {
  describe("formatCategoryLabel", () => {
    it("returns 'राजस्थान ज्ञान' for missing, empty, or generic categories", () => {
      expect(formatCategoryLabel(undefined)).toBe("राजस्थान ज्ञान");
      expect(formatCategoryLabel("")).toBe("राजस्थान ज्ञान");
      expect(formatCategoryLabel("all")).toBe("राजस्थान ज्ञान");
      expect(formatCategoryLabel("General")).toBe("राजस्थान ज्ञान");
    });

    it("eliminates raw database IDs like 'Subj-1793126120889-Ojzu2'", () => {
      const result = formatCategoryLabel("Subj-1793126120889-Ojzu2");
      expect(result).not.toContain("Subj-");
      expect(result).not.toContain("1793126120889");
    });

    it("eliminates chapter or topic raw IDs like 'ch-9874' or 'top-456'", () => {
      const resultCh = formatCategoryLabel("ch-9874123");
      expect(resultCh).not.toContain("ch-");
      const resultTop = formatCategoryLabel("top-12345");
      expect(resultTop).not.toContain("top-");
    });

    it("preserves human-readable categories", () => {
      expect(formatCategoryLabel("राजस्थान का भूगोल")).toBe("राजस्थान का भूगोल");
      expect(formatCategoryLabel("इतिहास व संस्कृति")).toBe("इतिहास व संस्कृति");
    });
  });

  describe("Option Prefix Cleaning", () => {
    it("cleans redundant prefixes like A., (1), or B)", () => {
      const cleanPrefix = (text: string) =>
        String(text || "")
          .replace(/^(?:[A-Da-d1-4][\.\)\:\-]\s*|\([A-Da-d1-4]\)\s*|[क-घ][\.\)\:\-]\s*)/, "")
          .trim();

      expect(cleanPrefix("A. ईसरदा")).toBe("ईसरदा");
      expect(cleanPrefix("(B) नन्दसमंद")).toBe("नन्दसमंद");
      expect(cleanPrefix("3) बीसलपुर")).toBe("बीसलपुर");
      expect(cleanPrefix("घ. मातृकुंडिया")).toBe("मातृकुंडिया");
      expect(cleanPrefix("मातृकुंडिया")).toBe("मातृकुंडिया");
    });
  });
});
