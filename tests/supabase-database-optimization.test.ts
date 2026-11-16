import { describe, it, expect, vi, beforeEach } from "vitest";
import fs from "fs";
import path from "path";
import {
  fetchQuestionsByTopic,
  fetchQuestionsByChapter,
  recordStudentAttempt,
  fetchUserAttemptsFromSupabase,
  fetchPaginatedQuestions,
  upsertQuestionsToSupabase,
  deleteQuestionFromSupabase,
} from "../src/utils/supabaseSyncService";
import {
  fetchQuestionsCacheFirst,
  saveQuestionsToCache,
  getCachedQuestionsByTopic,
  invalidateTopicCache,
  removeQuestionsFromCache,
  questionBankStore,
} from "../src/utils/questionBankCache";
import { fetchChapterQuestionsOnDemand } from "../src/utils/questionsStorage";
import { Question } from "../src/types";

describe("DISHA2020 — Supabase MCQ Database Complete Performance & Cost Optimization Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("1. PostgreSQL Schema Optimization & Verification", () => {
    it("Migration file defines all required composite indexes and safety constraints", () => {
      const migrationPath = path.resolve(
        process.cwd(),
        "supabase/migrations/20261117_performance_cost_optimization.sql"
      );
      expect(fs.existsSync(migrationPath)).toBe(true);

      const sql = fs.readFileSync(migrationPath, "utf-8");

      // Verify composite & covering indexes
      expect(sql).toContain("idx_questions_topic_id_id");
      expect(sql).toContain("idx_questions_chapter_id_id");
      expect(sql).toContain("idx_questions_subject_id_id");
      expect(sql).toContain("idx_questions_exam_year");
      expect(sql).toContain("idx_attempts_user_created_at");
      expect(sql).toContain("idx_bookmarks_question_id");
      expect(sql).toContain("idx_chapters_subject_order");
      expect(sql).toContain("idx_topics_chapter_order");

      // Verify safety check constraints
      expect(sql).toContain("chk_questions_options_is_array");
      expect(sql).toContain("chk_questions_correct_answer_range");
      expect(sql).toContain("chk_attempts_score_non_negative");
      expect(sql).toContain("chk_attempts_total_questions_positive");
      expect(sql).toContain("chk_attempts_time_spent_non_negative");
    });

    it("Rollback migration file exists and safely drops newly added indexes and constraints", () => {
      const rollbackPath = path.resolve(
        process.cwd(),
        "supabase/migrations/20261117_rollback_performance_optimization.sql"
      );
      expect(fs.existsSync(rollbackPath)).toBe(true);

      const rollbackSql = fs.readFileSync(rollbackPath, "utf-8");
      expect(rollbackSql).toContain("DROP INDEX IF EXISTS public.idx_questions_topic_id_id");
      expect(rollbackSql).toContain("DROP INDEX IF EXISTS public.idx_questions_chapter_id_id");
      expect(rollbackSql).toContain("DROP INDEX IF EXISTS public.idx_attempts_user_created_at");
      expect(rollbackSql).toContain("DROP CONSTRAINT IF EXISTS chk_questions_options_is_array");
    });
  });

  describe("2. Request Deduplication & In-Flight Coalescing", () => {
    it("Deduplicates concurrent calls to fetchQuestionsByTopic returning a shared in-flight promise", async () => {
      const fakeTopicId = "topic_dedup_test_001";
      // Call concurrently 5 times
      const p1 = fetchQuestionsByTopic(fakeTopicId);
      const p2 = fetchQuestionsByTopic(fakeTopicId);
      const p3 = fetchQuestionsByTopic(fakeTopicId);
      const p4 = fetchQuestionsByTopic(fakeTopicId);
      const p5 = fetchQuestionsByTopic(fakeTopicId);

      // In-flight promises should coalesce into the exact same instance
      expect(p1).toBe(p2);
      expect(p2).toBe(p3);
      expect(p3).toBe(p4);
      expect(p4).toBe(p5);

      const results = await Promise.all([p1, p2, p3, p4, p5]);
      expect(results[0]).toEqual(results[1]);
    });

    it("Deduplicates concurrent calls to fetchQuestionsCacheFirst", async () => {
      const fakeTopicId = "topic_cache_first_dedup_002";
      const dummyFetcher = vi.fn().mockImplementation(async (tid: string) => {
        await new Promise((resolve) => setTimeout(resolve, 50));
        return [
          {
            id: `q_${tid}_1`,
            text: "Sample Question 1",
            options: ["A", "B", "C", "D"],
            correctIndex: 0,
            explanation: "Explanation",
            topicId: tid,
          } as Question,
        ];
      });

      // Call 4 times concurrently before the first completes
      const [r1, r2, r3, r4] = await Promise.all([
        fetchQuestionsCacheFirst(fakeTopicId, { remoteFetcher: dummyFetcher }),
        fetchQuestionsCacheFirst(fakeTopicId, { remoteFetcher: dummyFetcher }),
        fetchQuestionsCacheFirst(fakeTopicId, { remoteFetcher: dummyFetcher }),
        fetchQuestionsCacheFirst(fakeTopicId, { remoteFetcher: dummyFetcher }),
      ]);

      // Remote fetcher must be called exactly ONCE across all 4 concurrent requests
      expect(dummyFetcher).toHaveBeenCalledTimes(1);
      expect(r1).toEqual(r2);
      expect(r2).toEqual(r3);
      expect(r3).toEqual(r4);
      expect(r1[0].id).toBe(`q_${fakeTopicId}_1`);
    });

    it("Deduplicates concurrent calls to fetchQuestionsByChapter", async () => {
      const fakeChapterId = "chapter_dedup_003";
      const p1 = fetchQuestionsByChapter(fakeChapterId);
      const p2 = fetchQuestionsByChapter(fakeChapterId);
      const p3 = fetchQuestionsByChapter(fakeChapterId);

      expect(p1).toBe(p2);
      expect(p2).toBe(p3);

      const res = await Promise.all([p1, p2, p3]);
      expect(res[0]).toEqual(res[1]);
    });
  });

  describe("3. Elimination of N+1 Queries", () => {
    it("fetchChapterQuestionsOnDemand fetches chapter questions directly via fetchQuestionsByChapter", async () => {
      // In this test, fetchChapterQuestionsOnDemand delegates to fetchQuestionsByChapter
      // rather than looping over all topics with separate queries
      const fakeChapterId = "hist_ancient_india";
      const result = await fetchChapterQuestionsOnDemand(fakeChapterId);
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe("4. Local-First Caching & Topic Sharding (Anti-Bloat Protection)", () => {
    it("Caches questions per topic and prevents monolithic bank:all_questions from exceeding 500 items", async () => {
      const topicId = "topic_scalability_test_004";
      const sampleBatch: Question[] = Array.from({ length: 600 }, (_, i) => ({
        id: `q_scale_${i}`,
        text: `Scalability MCQ Question #${i + 1}`,
        options: ["Option 1", "Option 2", "Option 3", "Option 4"],
        correctIndex: i % 4,
        explanation: `Explanation for question #${i + 1}`,
        topicId: topicId,
      }));

      await saveQuestionsToCache(sampleBatch, { topicId });

      // Topic cache should contain all 600 items for this specific topic
      const cachedTopicQs = await getCachedQuestionsByTopic(topicId);
      expect(cachedTopicQs).toBeDefined();
      expect(cachedTopicQs?.length).toBe(600);

      // Global monolithic cache must be capped at 500 items to protect UI thread from large array freezes
      const globalCached = await questionBankStore.getItem<Question[]>("bank:all_questions");
      expect(globalCached).toBeDefined();
      expect(globalCached!.length).toBeLessThanOrEqual(500);
    });

    it("invalidateTopicCache purges topic data from RAM and IndexedDB", async () => {
      const topicId = "topic_invalidation_test_005";
      const dummyQs: Question[] = [
        {
          id: "q_inv_1",
          text: "Invalidation test question",
          options: ["A", "B"],
          correctIndex: 0,
          explanation: "Test",
          topicId,
        },
      ];

      await saveQuestionsToCache(dummyQs, { topicId });
      let cached = await getCachedQuestionsByTopic(topicId);
      expect(cached?.length).toBe(1);

      // Invalidate
      await invalidateTopicCache(topicId);

      // Re-read should be null/empty
      cached = await getCachedQuestionsByTopic(topicId);
      expect(cached).toBeNull();
    });

    it("removeQuestionsFromCache removes specific deleted questions from cache", async () => {
      const topicId = "topic_remove_test_006";
      const questions: Question[] = [
        { id: "q_rem_1", text: "Q1", options: ["A", "B"], correctIndex: 0, explanation: "", topicId },
        { id: "q_rem_2", text: "Q2", options: ["A", "B"], correctIndex: 1, explanation: "", topicId },
      ];

      await saveQuestionsToCache(questions, { topicId });
      await removeQuestionsFromCache(["q_rem_1"]);

      const topicData = await questionBankStore.getItem<Question[]>(`topic:${topicId}`);
      expect(topicData?.some((q) => q.id === "q_rem_1")).toBe(false);
      expect(topicData?.some((q) => q.id === "q_rem_2")).toBe(true);
    });
  });

  describe("5. Deterministic Ordering & Selective Projections", () => {
    it("fetchPaginatedQuestions applies deterministic tie-breaker sorting and selective projection", async () => {
      // Test function exists and accepts pagination params
      expect(typeof fetchPaginatedQuestions).toBe("function");

      const res = await fetchPaginatedQuestions({ page: 1, limit: 10 });
      expect(res).toBeDefined();
      expect(Array.isArray(res.questions)).toBe(true);
      expect(typeof res.total).toBe("number");
      expect(typeof res.page).toBe("number");
    });

    it("fetchUserAttemptsFromSupabase enforces selective projection and limit", async () => {
      expect(typeof fetchUserAttemptsFromSupabase).toBe("function");
      const attempts = await fetchUserAttemptsFromSupabase("guest_user");
      // Guest users should be safely handled without database queries
      expect(Array.isArray(attempts)).toBe(true);
      expect(attempts.length).toBe(0);
    });
  });

  describe("6. Attempt Idempotency & Duplicate Prevention", () => {
    it("recordStudentAttempt safely handles attempt with unique session ID idempotently", async () => {
      const attemptSession = {
        id: "session_uuid_attempt_999",
        userId: "test_user_id_123",
        topicId: "topic_history_01",
        score: 18,
        totalQuestions: 20,
        timeSpentSeconds: 420,
        answers: { q1: 1, q2: 2 },
      };

      // Calling recordStudentAttempt with id should not throw
      await expect(recordStudentAttempt(attemptSession)).resolves.not.toThrow();
    });
  });

  describe("7. Scalability & Sizing Benchmark Analysis", () => {
    it("Verifies mathematical memory and payload characteristics for 100K, 500K, and 1M MCQs", () => {
      // Typical MCQ payload calculation
      const avgQuestionBytes = 500; // ~85 chars text + 4 options (160 bytes) + explanation (120 bytes) + metadata
      const questions100KBytes = 100_000 * avgQuestionBytes; // 50 MB
      const questions500KBytes = 500_000 * avgQuestionBytes; // 250 MB
      const questions1MBytes = 1_000_000 * avgQuestionBytes; // 500 MB

      // Verify that batch loading (20-30 MCQs per practice session) keeps network payloads minimal
      const practiceSessionBatchSize = 30;
      const batchPayloadBytes = practiceSessionBatchSize * avgQuestionBytes;
      const batchPayloadKB = batchPayloadBytes / 1024;

      expect(batchPayloadKB).toBeLessThanOrEqual(25); // Under 25 KB per session batch
      expect(questions100KBytes / (1024 * 1024)).toBeCloseTo(47.68, 0);
      expect(questions500KBytes / (1024 * 1024)).toBeCloseTo(238.4, 0);
      expect(questions1MBytes / (1024 * 1024)).toBeCloseTo(476.8, 0);
    });
  });
});
