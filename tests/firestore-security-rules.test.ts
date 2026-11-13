import { describe, test, beforeAll, afterAll, beforeEach } from 'vitest';
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
  RulesTestEnvironment
} from '@firebase/rules-unit-testing';
import fs from 'fs';
import path from 'path';

let testEnv: RulesTestEnvironment;

const PROJECT_ID = 'demo-quizpro-security-test';
const RULES_PATH = path.join(process.cwd(), 'firestore.rules');

describe('QuizPro Phase 6.1 Hardened Firestore Security Rules Emulator Tests', () => {
  beforeAll(async () => {
    const rules = fs.readFileSync(RULES_PATH, 'utf8');
    testEnv = await initializeTestEnvironment({
      projectId: PROJECT_ID,
      firestore: {
        rules,
        host: '127.0.0.1',
        port: 8080
      }
    });
  }, 30000);

  afterAll(async () => {
    if (testEnv) {
      await testEnv.cleanup();
    }
  }, 15000);

  beforeEach(async () => {
    await testEnv.clearFirestore();
  }, 15000);

  // =========================================================================
  // 1. QUESTION BANK, CURRICULUM & ADMIN CRUD COMPATIBILITY
  // =========================================================================

  test('SEC-01: Unauthenticated user cannot create, update, or delete MCQs', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().collection('mcqs').doc('mcq_1').set({
        id: 'mcq_1',
        text: 'Existing MCQ',
        options: ['A', 'B', 'C', 'D'],
        correctIndex: 0
      });
    });

    const unauthDb = testEnv.unauthenticatedContext().firestore();
    await assertFails(unauthDb.collection('mcqs').doc('mcq_new').set({ text: 'Injected?' }));
    await assertFails(unauthDb.collection('mcqs').doc('mcq_1').update({ text: 'Tampered' }));
    await assertFails(unauthDb.collection('mcqs').doc('mcq_1').delete());
  });

  test('SEC-02: Authenticated student cannot create, update, or delete MCQs', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().collection('mcqs').doc('mcq_1').set({
        id: 'mcq_1',
        text: 'Existing MCQ',
        options: ['A', 'B', 'C', 'D'],
        correctIndex: 0
      });
    });

    const studentDb = testEnv.authenticatedContext('student_uid_101', {
      email: 'student@example.com',
      email_verified: true,
      firebase: { sign_in_provider: 'google.com' }
    }).firestore();

    await assertFails(studentDb.collection('mcqs').doc('mcq_new').set({ text: 'Student MCQ' }));
    await assertFails(studentDb.collection('mcqs').doc('mcq_1').update({ correctIndex: 2 }));
    await assertFails(studentDb.collection('mcqs').doc('mcq_1').delete());
  });

  test('SEC-03: Verified allowlisted Admin CAN perform full curriculum & MCQ CRUD', async () => {
    const adminDb = testEnv.authenticatedContext('admin_uid_001', {
      email: 'zdpaliyal@gmail.com',
      email_verified: true,
      firebase: { sign_in_provider: 'google.com' }
    }).firestore();

    await assertSucceeds(adminDb.collection('subjects').doc('sub_1').set({ id: 'sub_1', name: 'History' }));
    await assertSucceeds(adminDb.collection('chapters').doc('chap_1').set({ id: 'chap_1', subjectId: 'sub_1', name: 'Ancient' }));
    await assertSucceeds(adminDb.collection('topics').doc('top_1').set({ id: 'top_1', chapterId: 'chap_1', subjectId: 'sub_1', name: 'Vedic' }));
    await assertSucceeds(adminDb.collection('mcqs').doc('test_mcq_1').set({
      id: 'test_mcq_1',
      text: 'Admin Test Question',
      options: ['A', 'B', 'C', 'D'],
      correctIndex: 1
    }));
    await assertSucceeds(adminDb.collection('mcqs').doc('test_mcq_1').update({
      text: 'Updated Admin Question'
    }));
    await assertSucceeds(adminDb.collection('mcqs').doc('test_mcq_1').delete());
    await assertSucceeds(adminDb.collection('coaching').doc('coach_1').set({ id: 'coach_1', name: 'Utkarsh' }));
    await assertSucceeds(adminDb.collection('pyq_papers').doc('pyq_1').set({ id: 'pyq_1', title: 'RAS 2024' }));
    await assertSucceeds(adminDb.collection('liveTests').doc('lt_1').set({ id: 'lt_1', title: 'Live Mock' }));
  });

  test('SEC-04: Unverified email spoofing admin email CANNOT gain Admin write permissions', async () => {
    const spoofedDb = testEnv.authenticatedContext('attacker_uid_999', {
      email: 'zdpaliyal@gmail.com',
      email_verified: false,
      firebase: { sign_in_provider: 'password' }
    }).firestore();

    await assertFails(spoofedDb.collection('mcqs').doc('spoof_mcq').set({ text: 'Spoofed' }));
    await assertFails(spoofedDb.collection('subjects').doc('sub_1').set({ id: 'sub_1', name: 'Spoof' }));
  });

  test('SEC-05: Anonymous/guest auth user CANNOT write MCQs, users, attempts, or leaderboard', async () => {
    const anonDb = testEnv.authenticatedContext('anon_uid_001', {
      firebase: { sign_in_provider: 'anonymous' }
    }).firestore();

    await assertFails(anonDb.collection('mcqs').doc('anon_mcq').set({ text: 'Anon?' }));
    await assertFails(anonDb.collection('users').doc('anon_uid_001').set({ uid: 'anon_uid_001', role: 'student' }));
    await assertFails(anonDb.collection('attempts').doc('att_anon').set({ userId: 'anon_uid_001', score: 10 }));
    await assertFails(anonDb.collection('leaderboard').doc('anon_uid_001').set({ userId: 'anon_uid_001', score: 10 }));
    await assertFails(anonDb.collection('user_stats_weekly').doc('anon_uid_001_2026-W46').set({ userId: 'anon_uid_001', totalAttempted: 1, totalCorrect: 1 }));
  });

  test('SEC-06: Student cannot delete or modify subjects, chapters, topics, PYQs, live tests, or coaching', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().collection('subjects').doc('sub_hist').set({ id: 'sub_hist', name: 'History' });
      await ctx.firestore().collection('chapters').doc('chap_1').set({ id: 'chap_1', subjectId: 'sub_hist', name: 'Ancient' });
      await ctx.firestore().collection('topics').doc('top_1').set({ id: 'top_1', chapterId: 'chap_1', name: 'Vedic' });
      await ctx.firestore().collection('pyq_papers').doc('pyq_1').set({ id: 'pyq_1', title: 'RAS 2023' });
      await ctx.firestore().collection('liveTests').doc('lt_1').set({ id: 'lt_1', title: 'Live Mock 1' });
      await ctx.firestore().collection('coaching').doc('c_1').set({ id: 'c_1', name: 'Academy' });
      await ctx.firestore().collection('coaching_exams').doc('ce_1').set({ id: 'ce_1', name: 'RAS' });
      await ctx.firestore().collection('coaching_test_series').doc('cts_1').set({ id: 'cts_1', name: 'Series 1' });
    });

    const studentDb = testEnv.authenticatedContext('student_uid_101', {
      email: 'student@example.com',
      email_verified: true
    }).firestore();

    await assertFails(studentDb.collection('subjects').doc('sub_hist').delete());
    await assertFails(studentDb.collection('chapters').doc('chap_1').update({ name: 'Hacked' }));
    await assertFails(studentDb.collection('topics').doc('top_1').delete());
    await assertFails(studentDb.collection('pyq_papers').doc('pyq_1').set({ id: 'pyq_1', title: 'Fake' }));
    await assertFails(studentDb.collection('liveTests').doc('lt_1').delete());
    await assertFails(studentDb.collection('coaching').doc('c_1').delete());
    await assertFails(studentDb.collection('coaching_exams').doc('ce_1').update({ name: 'Fake' }));
    await assertFails(studentDb.collection('coaching_test_series').doc('cts_1').delete());
  });

  // =========================================================================
  // 2. USER PROFILE, FORGED LOCALSTORAGE ROLE & PRIVILEGE ESCALATION
  // =========================================================================

  test('SEC-07: Student (even with forged localStorage role) cannot escalate role or tamper protected fields', async () => {
    const studentDb = testEnv.authenticatedContext('student_uid_101', {
      email: 'student@example.com',
      email_verified: true
    }).firestore();

    // Simulating forged localStorage role payload sent on create
    await assertFails(studentDb.collection('users').doc('student_uid_101').set({
      uid: 'student_uid_101',
      email: 'student@example.com',
      role: 'admin'
    }));
    await assertFails(studentDb.collection('users').doc('student_uid_101').set({
      uid: 'student_uid_101',
      email: 'student@example.com',
      role: 'student',
      isAdmin: true
    }));
    await assertFails(studentDb.collection('users').doc('student_uid_101').set({
      uid: 'student_uid_101',
      email: 'student@example.com',
      role: 'student',
      isPremium: true
    }));

    // Seed legitimate student profile
    await assertSucceeds(studentDb.collection('users').doc('student_uid_101').set({
      uid: 'student_uid_101',
      email: 'student@example.com',
      role: 'student',
      status: 'active',
      blocked: false
    }));

    // Update attempting to escalate role or grant premium or unblock self blocked
    await assertFails(studentDb.collection('users').doc('student_uid_101').update({ role: 'admin' }));
    await assertFails(studentDb.collection('users').doc('student_uid_101').update({ isPremium: true }));
    await assertFails(studentDb.collection('users').doc('student_uid_101').update({ subscription: { active: true } }));
    await assertFails(studentDb.collection('users').doc('student_uid_101').update({ blocked: true }));
  });

  test('SEC-08: Student CAN create profile, sync settings, and manage own progress/history', async () => {
    const studentDb = testEnv.authenticatedContext('student_uid_101', {
      email: 'student@example.com',
      email_verified: true
    }).firestore();

    await assertSucceeds(studentDb.collection('users').doc('student_uid_101').set({
      uid: 'student_uid_101',
      email: 'student@example.com',
      displayName: 'Student User',
      role: 'student'
    }));

    await assertSucceeds(studentDb.collection('users').doc('student_uid_101').set({
      settings: { darkMode: true, dailyGoal: 50 }
    }, { merge: true }));

    await assertSucceeds(studentDb.collection('users').doc('student_uid_101').collection('progress').doc('q_1').set({
      questionId: 'q_1',
      correct: 1,
      wrong: 0
    }));
    await assertSucceeds(studentDb.collection('users').doc('student_uid_101').collection('history').doc('2026-11-13').set({
      date: '2026-11-13',
      answered: 10
    }));
  });

  test('SEC-09: Cross-user progress & subcollection read/write is strictly denied', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().collection('users').doc('student_uid_202').collection('progress').doc('q_1').set({
        correct: 3
      });
    });

    const studentDb = testEnv.authenticatedContext('student_uid_101', {
      email: 'student@example.com',
      email_verified: true
    }).firestore();

    await assertFails(studentDb.collection('users').doc('student_uid_202').get());
    await assertFails(studentDb.collection('users').doc('student_uid_202').collection('progress').doc('q_1').get());
    await assertFails(studentDb.collection('users').doc('student_uid_202').collection('attempts').doc('att_1').get());
    await assertFails(studentDb.collection('users').doc('student_uid_202').collection('progress').doc('q_1').set({ correct: 99 }));
  });

  // =========================================================================
  // 3. IMMUTABLE EXAM ATTEMPTS, CROSS-USER PROTECTION & PUBLIC READS
  // =========================================================================

  test('SEC-10: Attempts, pyq_attempts, and liveTestSubmissions enforce ownership and immutability', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().collection('attempts').doc('att_202').set({
        attemptId: 'att_202',
        userId: 'student_uid_202',
        score: 85
      });
    });

    const studentDb = testEnv.authenticatedContext('student_uid_101', {
      email: 'student@example.com',
      email_verified: true
    }).firestore();

    // Cross-user read/create/update denied
    await assertFails(studentDb.collection('attempts').doc('att_202').get());
    await assertFails(studentDb.collection('attempts').doc('att_202').update({ score: 0 }));
    await assertFails(studentDb.collection('attempts').doc('att_forged').set({
      attemptId: 'att_forged',
      userId: 'student_uid_202',
      score: 10
    }));
    await assertFails(studentDb.collection('pyq_attempts').doc('pyq_att_forged').set({
      attemptId: 'pyq_att_forged',
      paperId: 'paper_1',
      userId: 'student_uid_202'
    }));
    await assertFails(studentDb.collection('liveTestSubmissions').doc('sub_forged').set({
      submissionId: 'sub_forged',
      testId: 'lt_1',
      userId: 'student_uid_202'
    }));

    // Own initial creation allowed
    await assertSucceeds(studentDb.collection('attempts').doc('att_101').set({
      attemptId: 'att_101',
      userId: 'student_uid_101',
      score: 70
    }));
    await assertSucceeds(studentDb.collection('pyq_attempts').doc('pyq_att_101').set({
      attemptId: 'pyq_att_101',
      paperId: 'paper_1',
      userId: 'student_uid_101',
      score: 65,
      correctCount: 65,
      totalQuestions: 100
    }));
    await assertSucceeds(studentDb.collection('liveTestSubmissions').doc('sub_101').set({
      submissionId: 'sub_101',
      testId: 'lt_1',
      userId: 'student_uid_101',
      score: 80
    }));

    // Students CANNOT mutate or reassign submitted exam/attempt results!
    await assertFails(studentDb.collection('attempts').doc('att_101').update({ score: 100 }));
    await assertFails(studentDb.collection('attempts').doc('att_101').update({ userId: 'student_uid_202' }));
    await assertFails(studentDb.collection('pyq_attempts').doc('pyq_att_101').update({ score: 100, correctCount: 100 }));
    await assertFails(studentDb.collection('liveTestSubmissions').doc('sub_101').update({ score: 100 }));
  });

  test('SEC-11: Public curriculum, papers, coaching, and published articles readable; draft articles hidden', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().collection('subjects').doc('sub_1').set({ id: 'sub_1', name: 'Geography' });
      await ctx.firestore().collection('chapters').doc('chap_1').set({ id: 'chap_1', subjectId: 'sub_1', name: 'Rivers' });
      await ctx.firestore().collection('topics').doc('top_1').set({ id: 'top_1', chapterId: 'chap_1', name: 'Chambal' });
      await ctx.firestore().collection('mcqs').doc('mcq_1').set({ id: 'mcq_1', text: 'Origin of Chambal?' });
      await ctx.firestore().collection('question_bundles').doc('topic_top_1').set({ topicId: 'top_1', questions: [] });
      await ctx.firestore().collection('pyq_papers').doc('pyq_1').set({ id: 'pyq_1', title: 'RAS 2023' });
      await ctx.firestore().collection('liveTests').doc('lt_1').set({ id: 'lt_1', title: 'Live Mock 1' });
      await ctx.firestore().collection('coaching').doc('c_1').set({ id: 'c_1', name: 'Academy' });
      await ctx.firestore().collection('articles').doc('art_pub').set({ title: 'Published', status: 'published' });
      await ctx.firestore().collection('articles').doc('art_draft').set({ title: 'Draft', status: 'draft' });
      await ctx.firestore().collection('settings').doc('monetagAds').set({ masterEnabled: false });
      await ctx.firestore().collection('test').doc('connection').set({ ok: true });
    });

    const unauthDb = testEnv.unauthenticatedContext().firestore();
    await assertSucceeds(unauthDb.collection('subjects').doc('sub_1').get());
    await assertSucceeds(unauthDb.collection('chapters').doc('chap_1').get());
    await assertSucceeds(unauthDb.collection('topics').doc('top_1').get());
    await assertSucceeds(unauthDb.collection('mcqs').doc('mcq_1').get());
    await assertSucceeds(unauthDb.collection('question_bundles').doc('topic_top_1').get());
    await assertSucceeds(unauthDb.collection('pyq_papers').doc('pyq_1').get());
    await assertSucceeds(unauthDb.collection('liveTests').doc('lt_1').get());
    await assertSucceeds(unauthDb.collection('coaching').doc('c_1').get());
    await assertSucceeds(unauthDb.collection('articles').doc('art_pub').get());
    await assertSucceeds(unauthDb.collection('settings').doc('monetagAds').get());
    await assertSucceeds(unauthDb.collection('test').doc('connection').get());
    await assertFails(unauthDb.collection('articles').doc('art_draft').get());
  });

  test('SEC-12: Unauthorized question_bundles modification denied; Admin allowed', async () => {
    const studentDb = testEnv.authenticatedContext('student_uid_101', {
      email: 'student@example.com',
      email_verified: true
    }).firestore();

    await assertFails(studentDb.collection('question_bundles').doc('topic_top_1').set({
      topicId: 'top_1',
      questions: []
    }));

    const adminDb = testEnv.authenticatedContext('admin_uid_001', {
      email: 'jagdishpaliyaljat@gmail.com',
      email_verified: true
    }).firestore();

    await assertSucceeds(adminDb.collection('question_bundles').doc('topic_top_1').set({
      topicId: 'top_1',
      questions: [],
      bundleVersion: 1
    }));
  });

  // =========================================================================
  // 4. AUDIT LOG IMMUTABILITY, USER_STATS_WEEKLY PRIVACY & LEADERBOARD FIELDS
  // =========================================================================

  test('SEC-13: adminAuditLogs cannot be written by students and are immutable even for Admin', async () => {
    const studentDb = testEnv.authenticatedContext('student_uid_101', {
      email: 'student@example.com',
      email_verified: true
    }).firestore();
    const adminDb = testEnv.authenticatedContext('admin_uid_001', {
      email: 'zdpaliyal@gmail.com',
      email_verified: true
    }).firestore();

    const auditPayload = {
      id: 'audit_001',
      adminId: 'admin_uid_001',
      action: 'update_role',
      timestamp: new Date().toISOString()
    };

    await assertFails(studentDb.collection('adminAuditLogs').doc('audit_001').set(auditPayload));
    await assertSucceeds(adminDb.collection('adminAuditLogs').doc('audit_001').set(auditPayload));
    await assertFails(adminDb.collection('adminAuditLogs').doc('audit_001').update({ action: 'tampered' }));
    await assertFails(adminDb.collection('adminAuditLogs').doc('audit_001').delete());
  });

  test('SEC-14: user_stats_weekly is owner/admin-only and leaderboard exposes only allowed public fields', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().collection('user_stats_weekly').doc('student_uid_202_2026-W46').set({
        userId: 'student_uid_202',
        totalAttempted: 20,
        totalCorrect: 18
      });
    });

    const studentDb = testEnv.authenticatedContext('student_uid_101', {
      email: 'student@example.com',
      email_verified: true
    }).firestore();
    const unauthDb = testEnv.unauthenticatedContext().firestore();

    // user_stats_weekly privacy: unauth & cross-user reads DENIED
    await assertFails(unauthDb.collection('user_stats_weekly').doc('student_uid_202_2026-W46').get());
    await assertFails(studentDb.collection('user_stats_weekly').doc('student_uid_202_2026-W46').get());

    // Forging another user's leaderboard or stats entry DENIED
    await assertFails(studentDb.collection('leaderboard').doc('student_uid_202').set({
      userId: 'student_uid_202',
      score: 9999
    }));
    await assertFails(studentDb.collection('user_stats_weekly').doc('student_uid_202_2026-W46').set({
      userId: 'student_uid_202',
      totalAttempted: 100,
      totalCorrect: 100
    }));

    // Leaderboard PII injection DENIED (email / answers / phone not in allowlist)
    await assertFails(studentDb.collection('leaderboard').doc('test1_student_uid_101').set({
      userId: 'student_uid_101',
      score: 180,
      email: 'private@example.com',
      answers: [1, 2, 3]
    }));

    // Invalid stats where totalCorrect > totalAttempted DENIED
    await assertFails(studentDb.collection('user_stats_weekly').doc('student_uid_101_2026-W46').set({
      userId: 'student_uid_101',
      totalAttempted: 5,
      totalCorrect: 50
    }));

    // Own bounded writes & reads SUCCEED
    await assertSucceeds(studentDb.collection('leaderboard').doc('test1_student_uid_101').set({
      id: 'test1_student_uid_101',
      testId: 'test1',
      userId: 'student_uid_101',
      userName: 'Aspirant',
      score: 180
    }));
    await assertSucceeds(studentDb.collection('user_stats_weekly').doc('student_uid_101_2026-W46').set({
      userId: 'student_uid_101',
      totalAttempted: 20,
      totalCorrect: 15
    }));
    await assertSucceeds(studentDb.collection('user_stats_weekly').doc('student_uid_101_2026-W46').get());
  });

  // =========================================================================
  // 5. EXAM ANALYSES, PAYMENT LOCKDOWN, WILDCARD DENY, BLOCKED & STALE ADMIN
  // =========================================================================

  test('SEC-15: examPaperAnalyses and nested questions subcollection allow owner only', async () => {
    const studentADb = testEnv.authenticatedContext('student_uid_101', { email: 'a@example.com', email_verified: true }).firestore();
    const studentBDb = testEnv.authenticatedContext('student_uid_202', { email: 'b@example.com', email_verified: true }).firestore();

    await assertSucceeds(studentADb.collection('examPaperAnalyses').doc('ana_1').set({
      analysisId: 'ana_1',
      userId: 'student_uid_101'
    }));
    await assertSucceeds(studentADb.collection('examPaperAnalyses').doc('ana_1').collection('questions').doc('q_1').set({
      examQuestionId: 'q_1',
      reviewStatus: 'pending'
    }));

    await assertFails(studentBDb.collection('examPaperAnalyses').doc('ana_1').collection('questions').doc('q_1').get());
    await assertFails(studentBDb.collection('examPaperAnalyses').doc('ana_1').collection('questions').doc('q_1').set({
      reviewStatus: 'confirmed'
    }));
  });

  test('SEC-16: Payment, retired payment, scanUsage, and telemetry collections deny all client tampering', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().collection('payment_orders').doc('order_101').set({ userId: 'student_uid_101', amount: 199 });
      await ctx.firestore().collection('user_subscriptions').doc('student_uid_101').set({ userId: 'student_uid_101', active: true });
      await ctx.firestore().collection('payment_events').doc('evt_101').set({ event: 'PAYMENT_SUCCESS' });
    });

    const studentDb = testEnv.authenticatedContext('student_uid_101', {
      email: 'student@example.com',
      email_verified: true
    }).firestore();
    const otherDb = testEnv.authenticatedContext('student_uid_202', {
      email: 'other@example.com',
      email_verified: true
    }).firestore();
    const adminDb = testEnv.authenticatedContext('admin_uid_001', {
      email: 'zdpaliyal@gmail.com',
      email_verified: true
    }).firestore();

    // Owner can read own order/subscription; other student cannot
    await assertSucceeds(studentDb.collection('payment_orders').doc('order_101').get());
    await assertSucceeds(studentDb.collection('user_subscriptions').doc('student_uid_101').get());
    await assertFails(otherDb.collection('payment_orders').doc('order_101').get());
    await assertFails(otherDb.collection('user_subscriptions').doc('student_uid_101').get());

    // Neither student NOR client-side admin SDK can write payment_events, payment_orders, user_subscriptions
    await assertFails(studentDb.collection('payment_orders').doc('order_001').set({ amount: 500 }));
    await assertFails(studentDb.collection('payment_events').doc('evt_001').set({ event: 'PAYMENT_SUCCESS' }));
    await assertFails(adminDb.collection('payment_events').doc('evt_001').set({ event: 'CLIENT_FORGED' }));
    await assertFails(studentDb.collection('user_subscriptions').doc('student_uid_101').set({ active: true }));
    await assertFails(adminDb.collection('user_subscriptions').doc('student_uid_101').set({ active: true }));

    // Retired payment & open legacy collections locked
    await assertFails(studentDb.collection('paymentSubmissions').doc('sub_001').set({ utr: '123456' }));
    await assertFails(studentDb.collection('subscriptions').doc('sub_001').set({ active: true }));
    await assertFails(studentDb.collection('premiumPlans').doc('plan_001').set({ price: 100 }));
    await assertFails(studentDb.collection('scanUsage').doc('student_uid_101').set({ count: 0 }));
    await assertFails(studentDb.collection('customQuestions').doc('cq_1').set({ text: 'Hack' }));
    await assertFails(studentDb.collection('analytics_daily').doc('2026-11-13').set({ totalVisits: 999999 }));
    await assertFails(studentDb.collection('test').doc('connection').set({ ok: false }));
  });

  test('SEC-17: Unlisted collection path is denied by default even for Admin (no wildcard leak)', async () => {
    const studentDb = testEnv.authenticatedContext('student_uid_101', { email: 's@example.com', email_verified: true }).firestore();
    const adminDb = testEnv.authenticatedContext('admin_uid_001', { email: 'zdpaliyal@gmail.com', email_verified: true }).firestore();

    await assertFails(studentDb.collection('random_unlisted_collection').doc('doc1').get());
    await assertFails(studentDb.collection('random_unlisted_collection').doc('doc1').set({ x: 1 }));
    await assertFails(adminDb.collection('random_unlisted_collection').doc('doc1').get());
    await assertFails(adminDb.collection('random_unlisted_collection').doc('doc1').set({ x: 1 }));
  });

  test('SEC-18: Promoted unblocked admin CAN manage MCQs; Blocked Admin CANNOT regain access via any path', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().collection('users').doc('promoted_admin_1').set({
        uid: 'promoted_admin_1',
        role: 'admin',
        status: 'active',
        blocked: false
      });
      // Blocked promoted admin
      await ctx.firestore().collection('users').doc('blocked_admin_2').set({
        uid: 'blocked_admin_2',
        role: 'admin',
        status: 'blocked',
        blocked: true
      });
      // Blocked root-email + custom-claim admin (tests secondary path blocking!)
      await ctx.firestore().collection('users').doc('blocked_root_3').set({
        uid: 'blocked_root_3',
        email: 'zdpaliyal@gmail.com',
        role: 'admin',
        status: 'blocked',
        blocked: true
      });
    });

    const promotedAdminDb = testEnv.authenticatedContext('promoted_admin_1', {
      email: 'promoted@example.com',
      email_verified: true
    }).firestore();
    const blockedAdminDb = testEnv.authenticatedContext('blocked_admin_2', {
      email: 'blocked@example.com',
      email_verified: true
    }).firestore();
    const blockedRootDb = testEnv.authenticatedContext('blocked_root_3', {
      email: 'zdpaliyal@gmail.com',
      email_verified: true,
      admin: true
    }).firestore();

    await assertSucceeds(promotedAdminDb.collection('mcqs').doc('mcq_p1').set({ text: 'Promoted Admin Q' }));
    await assertFails(blockedAdminDb.collection('mcqs').doc('mcq_b1').set({ text: 'Blocked Admin Q' }));
    await assertFails(blockedRootDb.collection('mcqs').doc('mcq_b2').set({ text: 'Blocked Root Q' }));
    // Blocked user also cannot update own profile to unblock themselves
    await assertFails(blockedRootDb.collection('users').doc('blocked_root_3').update({ blocked: false, status: 'active' }));
  });

  test('SEC-19: User with revoked or stale Admin custom claims is denied when demoted in Firestore', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      // User demoted to student in Firestore, or explicitly revoked, while holding stale JWT claim
      await ctx.firestore().collection('users').doc('stale_claim_uid_1').set({
        uid: 'stale_claim_uid_1',
        email: 'demoted@example.com',
        role: 'student',
        status: 'active',
        blocked: false
      });
      await ctx.firestore().collection('users').doc('revoked_claim_uid_2').set({
        uid: 'revoked_claim_uid_2',
        email: 'revoked@example.com',
        role: 'admin',
        revokedAdmin: true,
        status: 'active',
        blocked: false
      });
    });

    const staleClaimDb = testEnv.authenticatedContext('stale_claim_uid_1', {
      email: 'demoted@example.com',
      email_verified: true,
      admin: true,
      role: 'admin'
    }).firestore();
    const revokedClaimDb = testEnv.authenticatedContext('revoked_claim_uid_2', {
      email: 'revoked@example.com',
      email_verified: true,
      admin: true
    }).firestore();

    await assertFails(staleClaimDb.collection('mcqs').doc('mcq_stale').set({ text: 'Stale Claim Write' }));
    await assertFails(staleClaimDb.collection('subjects').doc('sub_stale').set({ id: 'sub_stale', name: 'Stale' }));
    await assertFails(revokedClaimDb.collection('mcqs').doc('mcq_revoked').set({ text: 'Revoked Claim Write' }));
  });

  // =========================================================================
  // 6. PHASE 6.3 REMEDIATION TESTS (F-01, F-02, F-03)
  // =========================================================================

  test('SEC-20 (F-01): Draft article blocks cannot be read by public/students; published blocks readable; Admin reads all', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().collection('articles').doc('art_pub_blocks').set({
        id: 'art_pub_blocks',
        title: 'Published Article',
        status: 'published'
      });
      await ctx.firestore().collection('articles').doc('art_pub_blocks').collection('blocks').doc('b_1').set({
        id: 'b_1',
        type: 'paragraph',
        content: 'Public content'
      });
      await ctx.firestore().collection('articles').doc('art_draft_blocks').set({
        id: 'art_draft_blocks',
        title: 'Secret Draft Article',
        status: 'draft'
      });
      await ctx.firestore().collection('articles').doc('art_draft_blocks').collection('blocks').doc('b_secret').set({
        id: 'b_secret',
        type: 'paragraph',
        content: 'Confidential draft block'
      });
    });

    const unauthDb = testEnv.unauthenticatedContext().firestore();
    const studentDb = testEnv.authenticatedContext('student_uid_101', {
      email: 'student@example.com',
      email_verified: true
    }).firestore();
    const adminDb = testEnv.authenticatedContext('admin_uid_001', {
      email: 'zdpaliyal@gmail.com',
      email_verified: true
    }).firestore();

    await assertSucceeds(unauthDb.collection('articles').doc('art_pub_blocks').collection('blocks').doc('b_1').get());
    await assertFails(unauthDb.collection('articles').doc('art_draft_blocks').collection('blocks').doc('b_secret').get());
    await assertFails(studentDb.collection('articles').doc('art_draft_blocks').collection('blocks').doc('b_secret').get());
    await assertSucceeds(adminDb.collection('articles').doc('art_draft_blocks').collection('blocks').doc('b_secret').get());
  });

  test('SEC-21 (F-02): users/{uid}/attempts/{attemptId} is create-only for owner and immutable against update/delete', async () => {
    const studentDb = testEnv.authenticatedContext('student_uid_101', {
      email: 'student@example.com',
      email_verified: true
    }).firestore();
    const otherDb = testEnv.authenticatedContext('student_uid_202', {
      email: 'other@example.com',
      email_verified: true
    }).firestore();
    const adminDb = testEnv.authenticatedContext('admin_uid_001', {
      email: 'zdpaliyal@gmail.com',
      email_verified: true
    }).firestore();

    await assertSucceeds(
      studentDb.collection('users').doc('student_uid_101').collection('attempts').doc('sub_att_1').set({
        userId: 'student_uid_101',
        score: 75,
        testId: 't_1'
      })
    );

    // Owner and other students CANNOT update or delete submitted attempt
    await assertFails(
      studentDb.collection('users').doc('student_uid_101').collection('attempts').doc('sub_att_1').update({ score: 100 })
    );
    await assertFails(
      studentDb.collection('users').doc('student_uid_101').collection('attempts').doc('sub_att_1').delete()
    );
    await assertFails(
      otherDb.collection('users').doc('student_uid_101').collection('attempts').doc('sub_att_1').get()
    );

    // Admin can still audit/clean up
    await assertSucceeds(
      adminDb.collection('users').doc('student_uid_101').collection('attempts').doc('sub_att_1').get()
    );
  });

  test('SEC-22 (F-03): liveTestAnswerKeys is strictly Admin-only; unauthenticated and student reads/writes denied', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().collection('liveTestAnswerKeys').doc('lt_1').set({
        testId: 'lt_1',
        answers: { q_1: { correctIndex: 2, explanation: 'Secret explanation' } }
      });
    });

    const unauthDb = testEnv.unauthenticatedContext().firestore();
    const studentDb = testEnv.authenticatedContext('student_uid_101', {
      email: 'student@example.com',
      email_verified: true
    }).firestore();
    const adminDb = testEnv.authenticatedContext('admin_uid_001', {
      email: 'zdpaliyal@gmail.com',
      email_verified: true
    }).firestore();

    await assertFails(unauthDb.collection('liveTestAnswerKeys').doc('lt_1').get());
    await assertFails(studentDb.collection('liveTestAnswerKeys').doc('lt_1').get());
    await assertFails(studentDb.collection('liveTestAnswerKeys').doc('lt_1').set({ answers: {} }));
    await assertSucceeds(adminDb.collection('liveTestAnswerKeys').doc('lt_1').get());
    await assertSucceeds(adminDb.collection('liveTestAnswerKeys').doc('lt_2').set({
      testId: 'lt_2',
      answers: { q_1: { correctIndex: 1 } }
    }));
  });

  test('SEC-23 (F-03): liveTests public docs reject unsanitized correctIndex/answer payloads even from Admin; sanitized allowed', async () => {
    const adminDb = testEnv.authenticatedContext('admin_uid_001', {
      email: 'zdpaliyal@gmail.com',
      email_verified: true
    }).firestore();

    // Unsanitized questions containing answer key must be REJECTED
    await assertFails(
      adminDb.collection('liveTests').doc('lt_unsafe').set({
        id: 'lt_unsafe',
        title: 'Leaked Key Test',
        questions: [{ id: 'q_1', text: 'Capital?', options: ['A', 'B'], correctIndex: 0 }]
      })
    );
    await assertFails(
      adminDb.collection('liveTests').doc('lt_unsafe_top').set({
        id: 'lt_unsafe_top',
        title: 'Leaked Top Key',
        answerKey: { q_1: 0 }
      })
    );

    // Sanitized public payload succeeds
    await assertSucceeds(
      adminDb.collection('liveTests').doc('lt_safe').set({
        id: 'lt_safe',
        title: 'Safe Live Mock',
        questions: [{ id: 'q_1', text: 'Capital?', options: ['Jaipur', 'Kota'] }]
      })
    );
  });
});
