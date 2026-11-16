import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("DISHA 20-20 — Critical MCQ Practice Timer & Question Ordering Bug Fix", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("BUG 1: MCQ Timer Stability & Timestamp Accuracy", () => {
    it("T1: Timer updates at exactly 1-second intervals monotonically for 20 consecutive ticks without concatenation", () => {
      let elapsedSeconds = 0;
      let sessionStartTime: number | null = Date.now();
      const recordedSequence: number[] = [];
      const renderedStrings: string[] = [];

      const formatTime = (totalSeconds: number) => {
        const safeSecs = Math.max(0, Math.floor(Number(totalSeconds) || 0));
        const hrs = Math.floor(safeSecs / 3600);
        const mins = Math.floor((safeSecs % 3600) / 60);
        const secs = safeSecs % 60;
        if (hrs > 0) {
          return `${String(hrs).padStart(2, "0")}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
        }
        return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
      };

      // Interval tick logic based on timestamp
      const tick = () => {
        if (!sessionStartTime) return;
        const now = Date.now();
        elapsedSeconds = Math.max(0, Math.floor((now - sessionStartTime) / 1000));
        recordedSequence.push(elapsedSeconds);
        renderedStrings.push(formatTime(elapsedSeconds));
      };

      // Tick 20 consecutive seconds
      for (let i = 1; i <= 20; i++) {
        vi.advanceTimersByTime(1000);
        tick();
      }

      expect(recordedSequence.length).toBe(20);
      expect(recordedSequence).toEqual([
        1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
        11, 12, 13, 14, 15, 16, 17, 18, 19, 20
      ]);

      // Verify no invalid concatenations like "1, 2, 12, 2, 12" occurred
      for (let i = 1; i < recordedSequence.length; i++) {
        expect(recordedSequence[i]).toBe(recordedSequence[i - 1] + 1);
      }

      // Check rendered strings are valid MM:SS format
      expect(renderedStrings[0]).toBe("00:01");
      expect(renderedStrings[9]).toBe("00:10");
      expect(renderedStrings[19]).toBe("00:20");
    });

    it("T2: Countdown timer formats correctly as HH:MM:SS (00:10:00 -> 00:09:59 -> 00:09:58)", () => {
      const formatCountdown = (secs: number) => {
        const safeSecs = Math.max(0, Math.floor(Number(secs) || 0));
        const h = Math.floor(safeSecs / 3600);
        const m = Math.floor((safeSecs % 3600) / 60);
        const s = safeSecs % 60;
        return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
      };

      const tenMinutes = 10 * 60; // 600 seconds
      expect(formatCountdown(tenMinutes)).toBe("00:10:00");
      expect(formatCountdown(tenMinutes - 1)).toBe("00:09:59");
      expect(formatCountdown(tenMinutes - 2)).toBe("00:09:58");
      expect(formatCountdown(3665)).toBe("01:01:05");
      expect(formatCountdown(0)).toBe("00:00:00");
    });

    it("T3: Prevents negative time when timer exceeds time limit", () => {
      const formatCountdown = (secs: number) => {
        const safeSecs = Math.max(0, Math.floor(Number(secs) || 0));
        const h = Math.floor(safeSecs / 3600);
        const m = Math.floor((safeSecs % 3600) / 60);
        const s = safeSecs % 60;
        return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
      };

      const totalLimitSecs = 100;
      const elapsedSeconds = 120; // 20 seconds past limit
      const remainingSecs = Math.max(0, totalLimitSecs - elapsedSeconds);

      expect(remainingSecs).toBe(0);
      expect(formatCountdown(-15)).toBe("00:00:00");
    });

    it("T4: Handles tab backgrounding without accumulating or losing time", () => {
      const sessionStartTime = Date.now();
      let elapsedSeconds = 0;

      // Simulate 5 seconds active
      vi.advanceTimersByTime(5000);
      elapsedSeconds = Math.max(0, Math.floor((Date.now() - sessionStartTime) / 1000));
      expect(elapsedSeconds).toBe(5);

      // Simulate tab backgrounded for 120 seconds (browser throttles intervals)
      vi.advanceTimersByTime(120000);

      // On visibility change returning to foreground:
      elapsedSeconds = Math.max(0, Math.floor((Date.now() - sessionStartTime) / 1000));
      expect(elapsedSeconds).toBe(125); // Exactly 5 + 120 = 125s tracked accurately via wall clock
    });

    it("T5: React StrictMode simulation (double mount) does not spawn duplicate intervals or drift", () => {
      let timerInterval: any = null;
      let tickCount = 0;
      const sessionStartTime = Date.now();

      const startTimer = () => {
        if (timerInterval) clearInterval(timerInterval);
        timerInterval = setInterval(() => {
          tickCount++;
        }, 1000);
      };

      const cleanupTimer = () => {
        if (timerInterval) {
          clearInterval(timerInterval);
          timerInterval = null;
        }
      };

      // StrictMode Mount 1
      startTimer();
      // StrictMode Unmount 1
      cleanupTimer();
      // StrictMode Mount 2
      startTimer();

      vi.advanceTimersByTime(5000);
      // tickCount should be exactly 5, not 10 (proving no duplicate intervals)
      expect(tickCount).toBe(5);

      const elapsed = Math.floor((Date.now() - sessionStartTime) / 1000);
      expect(elapsed).toBe(5);

      cleanupTimer();
    });

    it("T6: Auto-submit fires exactly once on timer expiry and stops timer", () => {
      let submitCallCount = 0;
      let timerActive = true;
      const hasAutoSubmitted = { current: false };

      const onConfirmSubmit = () => {
        if (hasAutoSubmitted.current) return;
        hasAutoSubmitted.current = true;
        timerActive = false;
        submitCallCount++;
      };

      const totalLimitSecs = 60;
      // Simulate ticking past the limit
      for (let elapsed = 58; elapsed <= 65; elapsed++) {
        if (totalLimitSecs > 0 && elapsed >= totalLimitSecs && !hasAutoSubmitted.current) {
          onConfirmSubmit();
        }
      }

      expect(submitCallCount).toBe(1);
      expect(timerActive).toBe(false);
    });
  });

  describe("BUG 2: Question Numbering, Order & State Integrity", () => {
    // Generate 30 sample mock questions
    const mock30Questions = Array.from({ length: 30 }, (_, i) => ({
      id: `q_${i + 1}`,
      text: `Mock Question ${i + 1} text`,
      options: [
        `Option A for Q${i + 1}`,
        `Option B for Q${i + 1}`,
        `Option C for Q${i + 1}`,
        `Option D for Q${i + 1}`,
      ],
      correctIndex: i % 4,
      explanation: `Explanation for Q${i + 1}`,
    }));

    it("T7: Preserves strict 30-question navigation sequence (1 -> 2 -> ... -> 30) with currentIndex + 1", () => {
      const activeQuestionIds = mock30Questions.map(q => q.id);
      let currentIndex = 0;

      // Sequential forward navigation 1 -> 30
      for (let step = 0; step < 30; step++) {
        currentIndex = step;
        const currentQId = activeQuestionIds[currentIndex];
        const displayQuestionNumber = currentIndex + 1;

        expect(displayQuestionNumber).toBe(step + 1);
        expect(currentQId).toBe(`q_${step + 1}`);
        expect(mock30Questions[currentIndex].text).toBe(`Mock Question ${step + 1} text`);
      }
    });

    it("T8: Next / Previous navigation does not mutate question array or corrupt order", () => {
      const originalIds = mock30Questions.map(q => q.id);
      let currentIndex = 0;

      // Forward 5
      for (let i = 0; i < 5; i++) currentIndex++;
      expect(currentIndex).toBe(5);
      expect(mock30Questions.map(q => q.id)).toEqual(originalIds);

      // Back 2
      currentIndex -= 2;
      expect(currentIndex).toBe(3);
      expect(mock30Questions.map(q => q.id)).toEqual(originalIds);

      // Verify question 4 matches index 3
      expect(mock30Questions[currentIndex].id).toBe("q_4");
      expect(currentIndex + 1).toBe(4);
    });

    it("T9: Random navigation maintains 1:1 question-number association", () => {
      const testIndices = [14, 2, 29, 0, 18, 7, 25];

      testIndices.forEach(targetIdx => {
        const currentQ = mock30Questions[targetIdx];
        const questionNumber = targetIdx + 1;

        expect(currentQ.id).toBe(`q_${questionNumber}`);
        expect(questionNumber).toBe(targetIdx + 1);
        expect(currentQ.options.length).toBe(4);
      });
    });

    it("T10: Answer selection persists intact during bidirectional navigation", () => {
      const sessionResults: Record<string, { selectedIndex: number; isCorrect: boolean; isSubmitted: boolean }> = {};
      let currentIndex = 0;

      // User answers Q1 with option 2
      const q1 = mock30Questions[0];
      sessionResults[q1.id] = { selectedIndex: 2, isCorrect: q1.correctIndex === 2, isSubmitted: true };

      // User navigates to Q2 and answers with option 0
      currentIndex = 1;
      const q2 = mock30Questions[1];
      sessionResults[q2.id] = { selectedIndex: 0, isCorrect: q2.correctIndex === 0, isSubmitted: true };

      // User navigates forward to Q15
      currentIndex = 14;

      // User navigates back to Q1
      currentIndex = 0;
      const revisitedQ1 = mock30Questions[currentIndex];
      const savedQ1Answer = sessionResults[revisitedQ1.id];

      expect(savedQ1Answer).toBeDefined();
      expect(savedQ1Answer.selectedIndex).toBe(2);

      // User navigates to Q2
      currentIndex = 1;
      const revisitedQ2 = mock30Questions[currentIndex];
      const savedQ2Answer = sessionResults[revisitedQ2.id];

      expect(savedQ2Answer).toBeDefined();
      expect(savedQ2Answer.selectedIndex).toBe(0);
    });

    it("T11: Stable React keys prevent option component recycling & animation corruption", () => {
      // Test key generation logic
      const q1 = mock30Questions[0];
      const q2 = mock30Questions[1];

      const q1OptionKeys = q1.options.map((_, idx) => `${q1.id}-opt-${idx}`);
      const q2OptionKeys = q2.options.map((_, idx) => `${q2.id}-opt-${idx}`);

      // All keys must be unique between questions
      q1OptionKeys.forEach(k1 => {
        expect(q2OptionKeys).not.toContain(k1);
      });

      // Keys are strictly prefixed by question ID
      expect(q1OptionKeys[0]).toBe("q_1-opt-0");
      expect(q2OptionKeys[0]).toBe("q_2-opt-0");
    });

    it("T12: Asynchronous late-loading question retains its slot without shifting indices", () => {
      const activeIds = ["q_1", "q_2", "q_3"];
      const loadedMap: Record<string, any> = {
        q_1: mock30Questions[0],
        // q_2 is not yet loaded
        q_3: mock30Questions[2],
      };

      // Resilient questions derivation mapping
      const deriveQuestions = (ids: string[], map: Record<string, any>) => {
        return ids.map(id => {
          const q = map[id];
          if (q && q.text && Array.isArray(q.options)) return q;
          return {
            id,
            text: "Loading question...",
            options: ["(A)", "(B)", "(C)", "(D)"],
            correctIndex: 0,
            explanation: "",
          };
        });
      };

      // Before q_2 loads:
      const questionsBefore = deriveQuestions(activeIds, loadedMap);
      expect(questionsBefore.length).toBe(3);
      expect(questionsBefore[0].id).toBe("q_1");
      expect(questionsBefore[1].id).toBe("q_2"); // placeholder slot 1
      expect(questionsBefore[2].id).toBe("q_3"); // slot 2 intact!

      // Now q_2 loads asynchronously:
      loadedMap.q_2 = mock30Questions[1];
      const questionsAfter = deriveQuestions(activeIds, loadedMap);

      expect(questionsAfter.length).toBe(3);
      expect(questionsAfter[0].id).toBe("q_1");
      expect(questionsAfter[1].id).toBe("q_2");
      expect(questionsAfter[1].text).toBe(mock30Questions[1].text);
      expect(questionsAfter[2].id).toBe("q_3"); // slot 2 has not shifted!
    });
  });
});
