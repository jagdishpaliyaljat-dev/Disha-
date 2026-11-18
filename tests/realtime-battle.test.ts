import { describe, it, expect, vi } from "vitest";
import {
  generateRoomCode,
  FALLBACK_BATTLE_QUESTIONS,
  getBattleQuestions,
  calculateRoundScore,
  getBattleShareInfo,
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

  it("should calculate speed-based round score correctly", () => {
    // Correct fast answer (e.g. 1 sec out of 15 sec)
    const fastResult = calculateRoundScore(true, 1000, 15, 0);
    expect(fastResult.points).toBeGreaterThanOrEqual(140); // 100 base + speed bonus
    expect(fastResult.newStreak).toBe(1);

    // Correct slow answer (e.g. 14.5 sec out of 15 sec)
    const slowResult = calculateRoundScore(true, 14500, 15, 0);
    expect(slowResult.points).toBeLessThan(fastResult.points);
    expect(slowResult.points).toBeGreaterThanOrEqual(100); // at least base 100

    // Streak bonus
    const streakResult = calculateRoundScore(true, 1000, 15, 2);
    expect(streakResult.newStreak).toBe(3);
    expect(streakResult.points).toBeGreaterThan(fastResult.points); // +40 for streak >= 3

    // Wrong answer
    const wrongResult = calculateRoundScore(false, 2000, 15, 5);
    expect(wrongResult.points).toBe(0);
    expect(wrongResult.newStreak).toBe(0);
  });

  it("should generate proper WhatsApp and web share links", () => {
    const info = getBattleShareInfo("849201");
    expect(info.url).toContain("battle=849201");
    expect(info.text).toContain("849201");
    expect(info.whatsappUrl).toContain("https://api.whatsapp.com/send?text=");
  });

  it("should instantiate RealtimeBattleManager and handle safe disconnect", () => {
    const mockPlayer: BattlePlayer = {
      id: "test_player_1",
      name: "परीक्षक",
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
