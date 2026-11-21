import { describe, it, expect } from "vitest";
import {
  resolveCorrectIndex,
  shuffleQuestionOptions,
  formatToBattleQuestion,
  calculateRoundScore,
  getBattleQuestions,
} from "../src/utils/realtimeBattleService";
import type { BattleQuestion } from "../src/components/battle/types";

describe("Live Battle - Option Selection, Question Formatting & Scoring Engine", () => {
  const sampleOptions = [
    "मुहम्मद गोरी",
    "कुतुबुद्दीन ऐबक",
    "महमूद गजनवी",
    "इल्तुतमिश",
  ];

  describe("1. resolveCorrectIndex (Answer Normalization)", () => {
    it("resolves 0-based integer correctly", () => {
      expect(resolveCorrectIndex({ correctIndex: 0 }, sampleOptions)).toBe(0);
      expect(resolveCorrectIndex({ correctIndex: 2 }, sampleOptions)).toBe(2);
    });

    it("resolves 0-based index and converts out-of-bounds 1-based index (e.g. 4 -> 3)", () => {
      expect(resolveCorrectIndex({ correct_answer: 1 }, sampleOptions)).toBe(1);
      expect(resolveCorrectIndex({ correct_answer: 4 }, sampleOptions)).toBe(3);
    });

    it("resolves string numbers ('0', '1', '2', '3')", () => {
      expect(resolveCorrectIndex({ answer: "0" }, sampleOptions)).toBe(0);
      expect(resolveCorrectIndex({ answer: "2" }, sampleOptions)).toBe(2);
    });

    it("resolves English option letters ('A', 'B', 'C', 'D')", () => {
      expect(resolveCorrectIndex({ answer: "A" }, sampleOptions)).toBe(0);
      expect(resolveCorrectIndex({ answer: "B" }, sampleOptions)).toBe(1);
      expect(resolveCorrectIndex({ answer: "C" }, sampleOptions)).toBe(2);
      expect(resolveCorrectIndex({ answer: "D" }, sampleOptions)).toBe(3);
      expect(resolveCorrectIndex({ answer: "b" }, sampleOptions)).toBe(1);
    });

    it("resolves Hindi option letters ('क', 'ख', 'ग', 'घ')", () => {
      expect(resolveCorrectIndex({ answer: "क" }, sampleOptions)).toBe(0);
      expect(resolveCorrectIndex({ answer: "ख" }, sampleOptions)).toBe(1);
      expect(resolveCorrectIndex({ answer: "ग" }, sampleOptions)).toBe(2);
      expect(resolveCorrectIndex({ answer: "घ" }, sampleOptions)).toBe(3);
    });

    it("resolves matching text in options directly", () => {
      expect(resolveCorrectIndex({ answer: "कुतुबुद्दीन ऐबक" }, sampleOptions)).toBe(1);
      expect(resolveCorrectIndex({ correctAnswer: "इल्तुतमिश" }, sampleOptions)).toBe(3);
    });

    it("falls back to 0 safely when unknown or undefined", () => {
      expect(resolveCorrectIndex({}, sampleOptions)).toBe(0);
      expect(resolveCorrectIndex({ answer: null }, sampleOptions)).toBe(0);
    });
  });

  describe("2. shuffleQuestionOptions (Option Randomization & Integrity)", () => {
    it("maintains the exact correct answer text after shuffling options", () => {
      const q: BattleQuestion = {
        id: "test_q1",
        text: "तराइन का प्रथम युद्ध किसने जीता?",
        options: ["मुहम्मद गोरी", "कुतुबुद्दीन ऐबक", "महमूद गजनवी", "इल्तुतमिश"],
        correctIndex: 0, // 'मुहम्मद गोरी'
      };

      const originalCorrectAnswer = q.options[q.correctIndex];

      // Shuffle 10 times to test random distributions
      for (let i = 0; i < 10; i++) {
        const shuffled = shuffleQuestionOptions(q);
        expect(shuffled.options.length).toBe(4);
        expect(shuffled.options[shuffled.correctIndex]).toBe(originalCorrectAnswer);
      }
    });

    it("does not shuffle if options contain 'उपर्युक्त सभी' or 'all of the above'", () => {
      const q: BattleQuestion = {
        id: "test_q2",
        text: "इनमें से कौनसे कथन सत्य हैं?",
        options: ["कथन 1", "कथन 2", "कथन 3", "उपर्युक्त सभी"],
        correctIndex: 3,
      };

      const unchanged = shuffleQuestionOptions(q);
      expect(unchanged.options[3]).toBe("उपर्युक्त सभी");
      expect(unchanged.correctIndex).toBe(3);
    });
  });

  describe("3. calculateRoundScore (Scoring Engine)", () => {
    it("awards full points + speed bonus for fast correct answers", () => {
      const { points, newStreak } = calculateRoundScore(true, 500, 10, 0);
      expect(points).toBeGreaterThanOrEqual(140);
      expect(newStreak).toBe(1);
    });

    it("awards streak bonus for consecutive correct answers", () => {
      const score1 = calculateRoundScore(true, 3000, 10, 0);
      const score2 = calculateRoundScore(true, 3000, 10, 2);
      expect(score2.points).toBeGreaterThan(score1.points);
      expect(score2.newStreak).toBe(3);
    });

    it("gives 0 points and resets streak on incorrect answers", () => {
      const { points, newStreak } = calculateRoundScore(false, 1500, 10, 5);
      expect(points).toBe(0);
      expect(newStreak).toBe(0);
    });
  });

  describe("4. formatToBattleQuestion & getBattleQuestions", () => {
    it("converts raw app question into standard BattleQuestion", () => {
      const raw = {
        id: "raw_1",
        question: "राजस्थान का राज्य वृक्ष कौनसा है?",
        options: ["रोहिड़ा", "खेजड़ी", "बबूल", "धोकड़ा"],
        correct_answer: "B",
      };

      const formatted = formatToBattleQuestion(raw);
      expect(formatted.id).toBe("raw_1");
      expect(formatted.text).toBe("राजस्थान का राज्य वृक्ष कौनसा है?");
      expect(formatted.options.length).toBe(4);
      expect(formatted.correctIndex).toBe(1); // 'B' -> 1 -> खेजड़ी
    });

    it("returns requested number of questions with valid 0-based correctIndex", () => {
      const questions = getBattleQuestions({ category: "all", count: 10 });
      expect(questions.length).toBe(10);
      questions.forEach((q) => {
        expect(q.id).toBeDefined();
        expect(q.text.length).toBeGreaterThan(0);
        expect(q.options.length).toBeGreaterThanOrEqual(2);
        expect(q.correctIndex).toBeGreaterThanOrEqual(0);
        expect(q.correctIndex).toBeLessThan(q.options.length);
      });
    });
  });
});
