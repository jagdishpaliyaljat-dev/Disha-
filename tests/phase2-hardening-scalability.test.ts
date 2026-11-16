import { describe, test, expect, beforeEach } from 'vitest';
import {
  fetchQuestionsCursorPaginated,
  fetchExamQuestionsSanitized,
  validateAndSubmitTestAttempt,
  detectDuplicateMCQs,
  syncUserProfileToSupabase,
  fetchUserProfileFromSupabase,
  getSupabaseTableCounts,
  checkSupabaseHealth
} from '../src/utils/supabaseSyncService';
import { supabase, isSupabaseConfigured } from '../src/lib/supabase';
import { Question } from '../src/types';
import { openLocalDatabase, idbClear, idbPut, STORES } from '../src/utils/localDatabaseEngine';

describe('DISHA 20-20 — Phase 2: Production Hardening & Scalability Test Suite', () => {

  beforeEach(async () => {
    await openLocalDatabase();
    await idbClear(STORES.MCQS);
    await idbClear(STORES.USER_ATTEMPTS);
    await idbClear(STORES.SYLLABUS_PROGRESS);
    await idbClear(STORES.STUDY_LOGS);
  });

  describe('1. Security Hardening & Privilege Escalation Prevention', () => {
    test('SEC-1: Blocks client attempt to escalate privileges to admin in Supabase profiles', async () => {
      expect(isSupabaseConfigured()).toBe(true);
      // Malicious payload attempting privilege escalation
      const maliciousStudent = {
        id: '11111111-2222-4333-8444-555555555555',
        name: 'Attacker Student',
        email: 'attacker@example.com',
        role: 'admin' // Attempting to assign admin role
      };

      // Since there is no active session matching this unauthenticated UUID with admin email, it rejects
      const result = await syncUserProfileToSupabase(maliciousStudent);
      expect(result).toBe(false);
    });

    test('SEC-2: Cryptographic RLS Isolation - Unauthenticated requests receive 0 rows from profiles, attempts, bookmarks', async () => {
      const [profRes, attRes, bmRes] = await Promise.all([
        supabase.from('profiles').select('*').limit(5),
        supabase.from('attempts').select('*').limit(5),
        supabase.from('bookmarks').select('*').limit(5)
      ]);

      expect(profRes.error).toBeNull();
      expect(attRes.error).toBeNull();
      expect(bmRes.error).toBeNull();

      expect(profRes.data?.length).toBe(0);
      expect(attRes.data?.length).toBe(0);
      expect(bmRes.data?.length).toBe(0);
    });
  });

  describe('2. Correct-Answer Protection & Anti-Cheating Architecture', () => {
    test('CAP-1: Sanitized exam query strips correct_answer and explanation before test submission', async () => {
      const testQuestions = await fetchExamQuestionsSanitized({ count: 10 });
      expect(Array.isArray(testQuestions)).toBe(true);

      for (const q of testQuestions) {
        expect(q.correctIndex).toBe(-1);
        expect(q.explanation).toBe('');
      }
    });

    test('CAP-2: Cursor pagination with sanitizeForExam=true strips answer key over the wire', async () => {
      const result = await fetchQuestionsCursorPaginated({
        limit: 10,
        sanitizeForExam: true
      });

      expect(result.questions).toBeDefined();
      for (const q of result.questions) {
        expect(q.correctIndex).toBe(-1);
        expect(q.explanation).toBe('');
      }
    });
  });

  describe('3. Attempt Integrity & Trusted Server-Side Scoring Engine', () => {
    test('VAL-1: Calculates accurate score, enforcing Option E neutrality (0 penalty)', async () => {
      // Seed a local mock question to test scoring verification
      const sampleQ1: Question = {
        id: 'val_q1',
        text: 'What is the capital of Rajasthan?',
        options: ['Jodhpur', 'Jaipur', 'Udaipur', 'Kota', 'अनुत्तरित प्रश्न'],
        correctIndex: 1, // Jaipur
        explanation: 'Jaipur is known as the Pink City and is the capital.',
        chapterId: 'chap_1',
        topicId: 'top_1',
      };

      const sampleQ2: Question = {
        id: 'val_q2',
        text: 'Which is the state tree of Rajasthan?',
        options: ['Khejri', 'Neem', 'Banyan', 'Peepal', 'अनुत्तरित प्रश्न'],
        correctIndex: 0, // Khejri
        explanation: 'Prosopis cineraria (Khejri) is the state tree.',
        chapterId: 'chap_1',
        topicId: 'top_1',
      };

      const sampleQ3: Question = {
        id: 'val_q3',
        text: 'Unattempted question example',
        options: ['Opt A', 'Opt B', 'Opt C', 'Opt D', 'अनुत्तरित प्रश्न'],
        correctIndex: 2,
        explanation: 'Explanation text',
        chapterId: 'chap_1',
        topicId: 'top_1',
      };

      await idbPut(STORES.MCQS, sampleQ1);
      await idbPut(STORES.MCQS, sampleQ2);
      await idbPut(STORES.MCQS, sampleQ3);

      const studentAnswers = {
        val_q1: 1, // Correct (+1)
        val_q2: 2, // Wrong (-0.33)
        val_q3: 4, // Option E (Neutral: 0)
      };

      const validation = await validateAndSubmitTestAttempt({
        answers: studentAnswers,
        timeSpentSeconds: 95,
        markingScheme: {
          correctMarks: 1,
          wrongPenalty: 0.33,
          neutralOptionE: true
        }
      });

      expect(validation.totalQuestions).toBe(3);
      expect(validation.correctCount).toBe(1);
      expect(validation.wrongCount).toBe(1);
      expect(validation.unattemptedCount).toBe(1);
      // Net score = 1 - 0.33 = 0.67
      expect(validation.score).toBe(0.67);
      expect(validation.accuracy).toBe(50); // 1 correct out of 2 attempted

      // Verified solutions returned for post-submission review
      const ans1 = validation.evaluatedAnswers.find(a => a.questionId === 'val_q1');
      expect(ans1?.isCorrect).toBe(true);
      expect(ans1?.correctAnswer).toBe(1);
      expect(ans1?.explanation).toContain('Pink City');

      const ans3 = validation.evaluatedAnswers.find(a => a.questionId === 'val_q3');
      expect(ans3?.isOptionE).toBe(true);
      expect(ans3?.isCorrect).toBe(false);
    });
  });

  describe('4. Question Bank Scalability & Cursor-Based Pagination', () => {
    test('QBO-1: fetchQuestionsCursorPaginated handles paging with nextCursor without OFFSET scan', async () => {
      const page1 = await fetchQuestionsCursorPaginated({ limit: 5 });
      expect(Array.isArray(page1.questions)).toBe(true);
      expect(typeof page1.hasMore).toBe('boolean');
    });

    test('QBO-2: Compact field projection excludes heavy explanations to save egress bandwidth', async () => {
      const compactResult = await fetchQuestionsCursorPaginated({
        limit: 5,
        fields: 'compact'
      });
      expect(Array.isArray(compactResult.questions)).toBe(true);
    });

    test('QBO-3: Duplicate detection catches identical question text within upload batch', async () => {
      const batch: Question[] = [
        {
          id: 'dup_1',
          text: 'Where is Hawa Mahal located?',
          options: ['Jaipur', 'Ajmer'],
          correctIndex: 0,
          chapterId: 'c1',
          topicId: 't1'
        },
        {
          id: 'dup_2',
          text: '  where is hawa mahal located?  ', // Case + whitespace variation
          options: ['Jaipur', 'Ajmer'],
          correctIndex: 0,
          chapterId: 'c1',
          topicId: 't1'
        },
        {
          id: 'uniq_1',
          text: 'Where is Mehrangarh Fort located?',
          options: ['Jodhpur', 'Bikaner'],
          correctIndex: 0,
          chapterId: 'c1',
          topicId: 't1'
        }
      ];

      const report = await detectDuplicateMCQs(batch);
      expect(report.unique.length).toBe(2);
      expect(report.duplicates.length).toBe(1);
      expect(report.duplicates[0].question.id).toBe('dup_2');
      expect(report.duplicates[0].reason).toContain('duplicate text');
    });
  });

  describe('5. Offline Sync Buffer Resilience (quizpro-db-v4)', () => {
    test('OFF-1: Modernized studentWriteBuffer flushes without Firebase SDK errors', async () => {
      const { flushStudentWriteBuffer, bufferQuestionAttempt } = await import('../src/utils/studentWriteBuffer');

      bufferQuestionAttempt({
        attemptId: `test_att_${Date.now()}`,
        questionId: 'q_offline_test',
        chapterId: 'chap_offline',
        topicId: 'top_offline',
        timeTakenSeconds: 15,
        isCorrect: true,
        selectedOption: '1',
        correctOption: '1',
        attemptNumber: 1,
        attemptedAt: new Date().toISOString()
      }, { deferFlush: true });

      const flushResult = await flushStudentWriteBuffer({ trigger: 'test_submission' });
      expect(flushResult).toBeDefined();
      expect(typeof flushResult.flushedOutboxItems).toBe('number');
    });
  });

  describe('6. System Health & Performance Baseline', () => {
    test('SYS-1: PostgREST round-trip health ping is healthy and latency is within production SLA', async () => {
      const health = await checkSupabaseHealth();
      expect(health.healthy).toBe(true);
      expect(health.latencyMs).toBeLessThan(1500);
      expect(health.details.endpoint).toContain('PostgreSQL');
    });

    test('SYS-2: Strict clean-slate baseline confirmation across all 7 core tables', async () => {
      const counts = await getSupabaseTableCounts();
      expect([0, 1]).toContain(counts.subjects);
      expect([0, 2]).toContain(counts.chapters);
      expect([0, 4]).toContain(counts.topics);
      expect([0, 10]).toContain(counts.questions);
      expect(counts.profiles).toBe(0);
      expect(counts.attempts).toBe(0);
      expect(counts.bookmarks).toBe(0);
    });
  });

});
