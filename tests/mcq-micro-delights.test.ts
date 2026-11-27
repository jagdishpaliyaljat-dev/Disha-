import { describe, it, expect } from "vitest";
import {
  calculateNextStreak,
  getStreakBadgeTier,
  shouldTriggerStreakCelebration,
  getOptionMicroDelightStyles,
} from "../src/utils/streakManager";

describe("Phase 1: MCQ Micro-Delights & Combo Streak Manager", () => {
  describe("calculateNextStreak", () => {
    it("increments streak when answer is correct", () => {
      expect(calculateNextStreak(0, true)).toBe(1);
      expect(calculateNextStreak(1, true)).toBe(2);
      expect(calculateNextStreak(2, true)).toBe(3);
      expect(calculateNextStreak(5, true)).toBe(6);
    });

    it("resets streak to 0 when answer is incorrect", () => {
      expect(calculateNextStreak(3, false)).toBe(0);
      expect(calculateNextStreak(10, false)).toBe(0);
    });

    it("resets streak to 0 when option E (unattempted) is chosen", () => {
      expect(calculateNextStreak(4, false, true)).toBe(0);
    });
  });

  describe("getStreakBadgeTier", () => {
    it("returns null for streak less than 3", () => {
      expect(getStreakBadgeTier(0)).toBeNull();
      expect(getStreakBadgeTier(1)).toBeNull();
      expect(getStreakBadgeTier(2)).toBeNull();
    });

    it("returns 'flame' tier for streak 3 and 4", () => {
      const tier3 = getStreakBadgeTier(3);
      expect(tier3).not.toBeNull();
      expect(tier3?.tier).toBe("flame");
      expect(tier3?.icon).toBe("🔥");
      expect(tier3?.label).toContain("3");
      expect(tier3?.subLabel).toContain("लगातार सही");

      const tier4 = getStreakBadgeTier(4);
      expect(tier4?.tier).toBe("flame");
      expect(tier4?.icon).toBe("🔥");
    });

    it("returns 'lightning' tier for streak 5 to 9", () => {
      const tier5 = getStreakBadgeTier(5);
      expect(tier5).not.toBeNull();
      expect(tier5?.tier).toBe("lightning");
      expect(tier5?.icon).toBe("⚡");
      expect(tier5?.label).toContain("5");
      expect(tier5?.subLabel).toContain("शानदार");

      const tier9 = getStreakBadgeTier(9);
      expect(tier9?.tier).toBe("lightning");
    });

    it("returns 'crown' tier for streak 10 and above", () => {
      const tier10 = getStreakBadgeTier(10);
      expect(tier10).not.toBeNull();
      expect(tier10?.tier).toBe("crown");
      expect(tier10?.icon).toBe("👑");
      expect(tier10?.label).toContain("10");
      expect(tier10?.subLabel).toContain("अजेय");

      const tier15 = getStreakBadgeTier(15);
      expect(tier15?.tier).toBe("crown");
      expect(tier15?.icon).toBe("👑");
    });
  });

  describe("shouldTriggerStreakCelebration", () => {
    it("returns true on major streak milestones (3, 5, 10, 15, 20)", () => {
      expect(shouldTriggerStreakCelebration(2, 3)).toBe(true);
      expect(shouldTriggerStreakCelebration(4, 5)).toBe(true);
      expect(shouldTriggerStreakCelebration(9, 10)).toBe(true);
      expect(shouldTriggerStreakCelebration(14, 15)).toBe(true);
      expect(shouldTriggerStreakCelebration(19, 20)).toBe(true);
    });

    it("returns false for non-milestone streaks", () => {
      expect(shouldTriggerStreakCelebration(0, 1)).toBe(false);
      expect(shouldTriggerStreakCelebration(1, 2)).toBe(false);
      expect(shouldTriggerStreakCelebration(3, 4)).toBe(false);
      expect(shouldTriggerStreakCelebration(5, 6)).toBe(false);
      expect(shouldTriggerStreakCelebration(6, 7)).toBe(false);
      expect(shouldTriggerStreakCelebration(7, 8)).toBe(false);
      expect(shouldTriggerStreakCelebration(8, 9)).toBe(false);
    });

    it("returns false on streak reset", () => {
      expect(shouldTriggerStreakCelebration(5, 0)).toBe(false);
      expect(shouldTriggerStreakCelebration(10, 0)).toBe(false);
    });
  });

  describe("getOptionMicroDelightStyles", () => {
    it("returns correct emerald ripple styling when submitted and option is correct", () => {
      const styles = getOptionMicroDelightStyles({
        isSubmitted: true,
        isCorrectOption: true,
        isSelected: true,
        isTestMode: false,
      });

      expect(styles.cardClass).toContain("border-emerald-500");
      expect(styles.hasRippleGlow).toBe(true);
      expect(styles.animationType).toBe("correct-bounce");
    });

    it("returns correct styling when submitted and correct option was NOT selected (revealing the answer)", () => {
      const styles = getOptionMicroDelightStyles({
        isSubmitted: true,
        isCorrectOption: true,
        isSelected: false,
        isTestMode: false,
      });

      expect(styles.cardClass).toContain("border-emerald-500");
      expect(styles.hasRippleGlow).toBe(true);
      expect(styles.animationType).toBe("revealed");
    });

    it("returns rose shake styling when submitted and option is selected and incorrect", () => {
      const styles = getOptionMicroDelightStyles({
        isSubmitted: true,
        isCorrectOption: false,
        isSelected: true,
        isTestMode: false,
      });

      expect(styles.cardClass).toContain("border-rose-500");
      expect(styles.hasRippleGlow).toBe(false);
      expect(styles.animationType).toBe("wrong-shake");
    });

    it("returns neutral styling in Test Mode without revealing answer", () => {
      const styles = getOptionMicroDelightStyles({
        isSubmitted: false,
        isCorrectOption: true,
        isSelected: true,
        isTestMode: true,
      });

      expect(styles.hasRippleGlow).toBe(false);
      expect(styles.cardClass).toContain("border-blue-600");
      expect(styles.animationType).toBe("selected-neutral");
    });
  });

  describe("Practice Session Streak Simulation", () => {
    it("simulates a 10-question practice flow with streaks, resets, and milestones", () => {
      let streak = 0;
      let maxStreak = 0;
      const celebrations: number[] = [];

      const answers = [
        true,  // Q1: 1
        true,  // Q2: 2
        true,  // Q3: 3 -> Milestone! (Tier: flame)
        true,  // Q4: 4 -> Tier: flame
        true,  // Q5: 5 -> Milestone! (Tier: lightning)
        false, // Q6: 0 -> Reset!
        true,  // Q7: 1
        true,  // Q8: 2
        true,  // Q9: 3 -> Milestone! (Tier: flame)
        false, // Q10: 0 -> Reset via Option E (unattempted)
      ];

      answers.forEach((ans, idx) => {
        const isUnattempted = idx === 9;
        const nextStreak = calculateNextStreak(streak, ans, isUnattempted);
        if (shouldTriggerStreakCelebration(streak, nextStreak)) {
          celebrations.push(nextStreak);
        }
        streak = nextStreak;
        maxStreak = Math.max(maxStreak, streak);
      });

      expect(maxStreak).toBe(5);
      expect(streak).toBe(0);
      expect(celebrations).toEqual([3, 5, 3]);
    });
  });
});
