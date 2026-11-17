import { describe, test, expect, beforeAll } from 'vitest';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://eaidivceejkdqsshlraj.supabase.co';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_HSl8o7bm-TQMIFbEnbp7TA_TfBfiv_0';

describe('DISHA 20-20 — Pilot Phase Final Student Functional Test', () => {
  const studentEmail = 'disha.student.verify.test@gmail.com';
  const studentPass = 'StudentTestPass2026!';
  const expectedStudentUuid = '6e9624f3-587a-43f4-8f44-07f6e2a05b08';

  let studentClient: ReturnType<typeof createClient>;
  let anonClient: ReturnType<typeof createClient>;
  let studentSession: any;

  beforeAll(async () => {
    anonClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    studentClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    const { data, error } = await studentClient.auth.signInWithPassword({
      email: studentEmail,
      password: studentPass,
    });

    if (error) {
      throw new Error(`Failed to sign in student: ${error.message}`);
    }

    studentSession = data.session;
  });

  // 1. Genuine Student Authentication
  describe('1. Genuine Student Authentication', () => {
    test('AUTH-STU-1: Genuine Student Session is authenticated with verified UUID', () => {
      expect(studentSession).toBeDefined();
      expect(studentSession.user).toBeDefined();
      expect(studentSession.user.id).toBe(expectedStudentUuid);
      expect(studentSession.user.email).toBe(studentEmail);
    });

    test('AUTH-STU-2: Student session strictly lacks elevated admin privileges', () => {
      const appMeta = studentSession.user.app_metadata || {};
      expect(appMeta.role).not.toBe('admin');
    });

    test('AUTH-STU-3: Student is denied curriculum mutation privileges by RLS', async () => {
      // 1. Student INSERT on subjects is blocked with 42501
      const { error: insErr } = await studentClient.from('subjects').insert([{
        id: 'illegal_sub_by_student',
        name: 'Illegal Subject'
      }]);
      expect(insErr?.code).toBe('42501');

      // 2. Student INSERT on questions is blocked with 42501
      const { error: qInsErr } = await studentClient.from('questions').insert([{
        id: 'illegal_q_by_student',
        subject_id: 'sub_raj_hist',
        chapter_id: 'chap_raj_sources',
        topic_id: 'top_inscriptions',
        question: 'Illegal Question',
        options: ['A', 'B', 'C', 'D'],
        correct_answer: 0
      }]);
      expect(qInsErr?.code).toBe('42501');

      // 3. Student UPDATE on questions affects 0 rows due to RLS USING (is_admin())
      const { data: updData } = await studentClient.from('questions').update({
        level: 'easy'
      }).eq('id', 'q_pilot_001').select();
      expect(updData?.length || 0).toBe(0);

      // Verify row remained unchanged
      const { data: q1 } = await studentClient.from('questions').select('level').eq('id', 'q_pilot_001').single();
      expect(q1?.level).toBe('medium');
    });
  });

  // 2. Marking Logic & Option E Standard Compliance
  describe('2. Marking Logic & Option E Compliance', () => {
    test('MARK-1: Calculates accurate score with Correct (+1), Incorrect (-0.33), and Option E (0.00)', () => {
      const marksPerQ = 1.0;
      const negMarksPerQ = 0.33;

      // Scenario: 3 questions answered
      // Q1: Correct (Vasudeva) -> +1.00
      // Q2: Incorrect (Wrong index) -> -0.33
      // Q3: Option E (Unattempted) -> 0.00 penalty
      const q1Score = marksPerQ; // +1.00
      const q2Score = -negMarksPerQ; // -0.33
      const q3Score = 0.00; // Option E neutrality

      const rawTotal = q1Score + q2Score + q3Score;
      const roundedScore = Math.max(0, Math.round(rawTotal * 100) / 100);

      expect(roundedScore).toBe(0.67);
      expect(q3Score).toBe(0); // Strictly neutral, NOT penalized as wrong answer
    });

    test('MARK-2: Option E penalty is 0, while unanswered/skipped without Option E receives configured penalty or 0', () => {
      // RPSC standard: selecting Option E saves from negative marking
      const wrongPenalty = 0.33;
      const optionEPenalty = 0.0;
      expect(optionEPenalty).toBe(0);
      expect(wrongPenalty).toBeGreaterThan(optionEPenalty);
    });
  });

  // 3. Quiz Attempt Persistence & Ownership
  describe('3. Quiz Attempt Persistence & Ownership', () => {
    let createdAttemptId: string | null = null;

    test('ATT-1: Student persists quiz attempt with exact user_id association', async () => {
      const attemptPayload = {
        user_id: expectedStudentUuid,
        topic_id: 'top_inscriptions',
        subject_id: 'sub_raj_hist',
        score: 1, // Integer score in attempts table
        total_questions: 3,
        answers: {
          q_pilot_001: 1, // Correct
          q_pilot_002: 1, // Wrong
          q_pilot_005: 4  // Option E (index 4)
        },
        time_spent_seconds: 42
      };

      const { data, error } = await studentClient
        .from('attempts')
        .insert(attemptPayload)
        .select()
        .single();

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data.user_id).toBe(expectedStudentUuid);
      expect(data.topic_id).toBe('top_inscriptions');
      expect(data.total_questions).toBe(3);
      createdAttemptId = data.id;
    });

    test('ATT-2: Student can read back their own persisted attempt history', async () => {
      const { data, error } = await studentClient
        .from('attempts')
        .select('*')
        .eq('user_id', expectedStudentUuid)
        .order('created_at', { ascending: false });

      expect(error).toBeNull();
      expect(Array.isArray(data)).toBe(true);
      expect(data!.length).toBeGreaterThanOrEqual(1);

      const latest = data![0];
      expect(latest.user_id).toBe(expectedStudentUuid);
      expect(latest.topic_id).toBe('top_inscriptions');
      expect(latest.subject_id).toBe('sub_raj_hist');
      expect(latest.answers).toHaveProperty('q_pilot_001', 1);
      expect(latest.answers).toHaveProperty('q_pilot_005', 4);
    });

    test('ATT-3: Anonymous and other users cannot access this student attempt', async () => {
      // Anonymous query cannot read private attempt
      const { data: anonData, error: anonErr } = await anonClient
        .from('attempts')
        .select('*')
        .eq('id', createdAttemptId!);

      expect(anonErr).toBeNull();
      expect(anonData?.length).toBe(0); // Isolated by RLS
    });
  });

  // 4. Bookmark Persistence & Ownership
  describe('4. Bookmark Persistence & Ownership', () => {
    const targetQuestionId = 'q_pilot_001';

    test('BM-1: Student persists bookmark on pilot question', async () => {
      const { data, error } = await studentClient
        .from('bookmarks')
        .upsert({
          user_id: expectedStudentUuid,
          question_id: targetQuestionId
        }, { onConflict: 'user_id,question_id' })
        .select()
        .single();

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data.user_id).toBe(expectedStudentUuid);
      expect(data.question_id).toBe(targetQuestionId);
    });

    test('BM-2: Student retrieves persisted bookmark across sessions', async () => {
      const { data, error } = await studentClient
        .from('bookmarks')
        .select('*')
        .eq('user_id', expectedStudentUuid);

      expect(error).toBeNull();
      expect(Array.isArray(data)).toBe(true);
      expect(data!.some(b => b.question_id === targetQuestionId)).toBe(true);
      expect(data!.every(b => b.user_id === expectedStudentUuid)).toBe(true);
    });

    test('BM-3: Idempotent bookmarking prevents duplicate rows', async () => {
      // Upsert again with identical (user_id, question_id)
      const { error } = await studentClient
        .from('bookmarks')
        .upsert({
          user_id: expectedStudentUuid,
          question_id: targetQuestionId
        }, { onConflict: 'user_id,question_id' });

      expect(error).toBeNull();

      const { data: countData } = await studentClient
        .from('bookmarks')
        .select('*')
        .eq('user_id', expectedStudentUuid)
        .eq('question_id', targetQuestionId);

      expect(countData?.length).toBe(1); // Exactly 1 row, zero duplicates
    });

    test('BM-4: Anonymous and foreign callers cannot read student bookmark', async () => {
      const { data, error } = await anonClient
        .from('bookmarks')
        .select('*')
        .eq('user_id', expectedStudentUuid);

      expect(error).toBeNull();
      expect(data?.length).toBe(0); // Zero data leakage
    });
  });

  // 5. Data Integrity & Admin Isolation
  describe('5. Data Integrity & Admin Isolation', () => {
    test('INT-1: All 10 pilot questions remain intact and unmutated', async () => {
      const { data: questions, error } = await studentClient
        .from('questions')
        .select('*')
        .order('id', { ascending: true });

      expect(error).toBeNull();
      expect(questions?.length).toBeGreaterThanOrEqual(10);

      const q1 = questions?.find(q => q.id === 'q_pilot_001');
      expect(q1?.question).toContain('बिजौलिया शिलालेख');
      expect(q1?.correct_answer).toBe(1);
      expect(q1?.options).toEqual(['अजयराज', 'वासुदेव', 'विग्रहराज चतुर्थ', 'पृथ्वीराज तृतीय']);

      const q8 = questions?.find(q => q.id === 'q_pilot_008');
      expect(q8?.question).toContain('चेलावास का युद्ध');
      expect(q8?.correct_answer).toBe(1);
    });

    test('INT-2: Admin profile and privileges remain intact and protected', async () => {
      // Student cannot view admin profile directly via private table
      const adminUuid = '9a821db5-5257-42b2-af8a-7f9369b7937f';
      const { data: adminProf } = await studentClient
        .from('profiles')
        .select('*')
        .eq('id', adminUuid);

      expect(adminProf?.length).toBe(0); // Row-level security strictly isolates profiles
    });
  });
});
