import { describe, it, expect, vi } from "vitest";
import {
  generateRoomCode,
  FALLBACK_BATTLE_QUESTIONS,
  getBattleQuestions,
  calculateRoundScore,
  getBattleShareInfo,
  getUserCustomQuestionsList,
  getAvailableChaptersList,
  RealtimeBattleManager,
} from "../src/utils/realtimeBattleService";
import type { BattlePlayer } from "../src/components/battle/types";

describe("Realtime Battle Service Tests", () => {
  it("should generate a valid 6-character room code", () => {
    const code = generateRoomCode();
    expect(code).toBeDefined();
    expect(code).toHaveLength(6);
    expect(code).toMatch(/^[1-9A-Z]{6}$/);
  });

  it("should have authentic curated fallback questions with valid structure", () => {
    expect(FALLBACK_BATTLE_QUESTIONS.length).toBeGreaterThanOrEqual(15);
    FALLBACK_BATTLE_QUESTIONS.forEach((q) => {
      expect(q.id).toBeDefined();
      expect(q.text.length).toBeGreaterThan(10);
      expect(q.options.length).toBe(4);
      expect(q.correctIndex).toBeGreaterThanOrEqual(0);
      expect(q.correctIndex).toBeLessThan(4);
      expect(q.explanation).toBeDefined();
    });
  });

  it("should sample battle questions based on count and category", () => {
    const sample5 = getBattleQuestions("all", 5);
    expect(sample5).toHaveLength(5);

    const sampleGeo = getBattleQuestions("geography", 3);
    expect(sampleGeo).toHaveLength(3);
    sampleGeo.forEach((q) => {
      expect(q.category).toBe("geography");
    });
  });

  it("should support custom question selection options and manual pick", () => {
    // Curated options object
    const sampleOpt = getBattleQuestions({
      category: "history",
      count: 4,
      questionSource: "curated",
    });
    expect(sampleOpt).toHaveLength(4);
    sampleOpt.forEach((q) => {
      expect(q.category).toBe("history");
    });

    // Manual pick of specific question IDs
    const manualPicked = getBattleQuestions({
      questionSource: "manual_pick",
      selectedQuestionIds: ["hist_1", "geo_1", "cult_1"],
      count: 3,
    });
    expect(manualPicked).toHaveLength(3);
    expect(manualPicked.map((q) => q.id)).toEqual(
      expect.arrayContaining(["hist_1", "geo_1", "cult_1"])
    );
  });

  it("should calculate speed-based round score correctly for 10-second timer", () => {
    // 10s default test: 1 sec fast answer
    const fast10s = calculateRoundScore(true, 1000, 10, 0);
    expect(fast10s.points).toBeGreaterThanOrEqual(140); // 100 base + ~45 speed bonus
    expect(fast10s.newStreak).toBe(1);

    // 10s test: 9.5 sec slow answer
    const slow10s = calculateRoundScore(true, 9500, 10, 0);
    expect(slow10s.points).toBeLessThan(fast10s.points);
    expect(slow10s.points).toBeGreaterThanOrEqual(100);

    // Streak bonus in 10s timer
    const streakResult = calculateRoundScore(true, 1000, 10, 2);
    expect(streakResult.newStreak).toBe(3);
    expect(streakResult.points).toBeGreaterThan(fast10s.points); // +40 for streak >= 3

    // Wrong answer gives 0 and resets streak
    const wrongResult = calculateRoundScore(false, 2000, 10, 5);
    expect(wrongResult.points).toBe(0);
    expect(wrongResult.newStreak).toBe(0);
  });

  it("should generate proper WhatsApp and web share links with 10s timer & unlimited friends notice", () => {
    const info = getBattleShareInfo("849201", 10);
    expect(info.url).toContain("battle=849201");
    expect(info.text).toContain("849201");
    expect(info.text).toContain("10 seconds");
    expect(info.text).toContain("friends");
    expect(info.whatsappUrl).toContain("https://api.whatsapp.com/send?text=");
  });

  it("should instantiate RealtimeBattleManager and handle safe disconnect", () => {
    const mockPlayer: BattlePlayer = {
      id: "test_player_1",
      name: "Tester",
      avatar: "🦁",
      isHost: true,
      isReady: true,
      score: 0,
      streak: 0,
      correctCount: 0,
      wrongCount: 0,
      avgResponseTimeMs: 0,
    };

    const onEvent = vi.fn();
    const onPresence = vi.fn();

    const manager = new RealtimeBattleManager("ABC123", mockPlayer, onEvent, onPresence);
    expect(manager).toBeDefined();

    expect(() => manager.connect()).not.toThrow();
    expect(() => manager.disconnect()).not.toThrow();
  });
});
