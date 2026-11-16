import { describe, test, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import http from 'node:http';
import crypto from 'node:crypto';
import { createServerApp } from '../server';
import { encryptSecret, decryptSecret, redactSensitiveText } from '../src/server/cryptoVault';
import { stripAnswerFieldsFromQuestion, sanitizeLiveTestForPublic } from '../src/server/liveTestService';

interface TokenRecord {
  uid: string;
  email?: string;
  email_verified?: boolean;
  admin?: boolean;
  role?: string;
  firebase?: { sign_in_provider?: string };
}

function createInMemoryFirestore(initialData: Record<string, Record<string, any>> = {}) {
  const store: Record<string, Record<string, any>> = {};
  for (const [col, docs] of Object.entries(initialData)) {
    store[col] = {};
    for (const [id, data] of Object.entries(docs)) {
      store[col][id] = JSON.parse(JSON.stringify(data));
    }
  }

  const ensureCol = (colName: string) => {
    if (!store[colName]) store[colName] = {};
    return store[colName];
  };

  const makeSnap = (id: string, data: any | undefined) => ({
    id,
    exists: data !== undefined,
    data: () => (data !== undefined ? JSON.parse(JSON.stringify(data)) : undefined),
  });

  const makeQuery = (colName: string, filters: Array<{ field: string; val: any }> = [], limitNum?: number) => ({
    where(field: string, op: string, val: any) {
      if (op !== '==') throw new Error(`Unsupported mock query op ${op}`);
      return makeQuery(colName, [...filters, { field, val }], limitNum);
    },
    limit(n: number) {
      return makeQuery(colName, filters, n);
    },
    async get() {
      const col = ensureCol(colName);
      let entries = Object.entries(col).filter(([, d]) =>
        filters.every((f) => d && d[f.field] === f.val)
      );
      if (typeof limitNum === 'number') {
        entries = entries.slice(0, limitNum);
      }
      const docs = entries.map(([id, d]) => makeSnap(id, d));
      return {
        empty: docs.length === 0,
        size: docs.length,
        docs,
        forEach(fn: (docSnap: any) => void) {
          docs.forEach(fn);
        },
      };
    },
  });

  return {
    _store: store,
    async listCollections() {
      return Object.keys(store).map((id) => ({ id }));
    },
    collection(colName: string) {
      return {
        ...makeQuery(colName),
        doc(docId: string) {
          return {
            id: docId,
            async get() {
              const col = ensureCol(colName);
              return makeSnap(docId, col[docId]);
            },
            async set(data: any, opts?: { merge?: boolean }) {
              const col = ensureCol(colName);
              if (opts?.merge && col[docId]) {
                col[docId] = { ...col[docId], ...JSON.parse(JSON.stringify(data)) };
              } else {
                col[docId] = JSON.parse(JSON.stringify(data));
              }
            },
            async create(data: any) {
              const col = ensureCol(colName);
              if (col[docId] !== undefined) {
                const err: any = new Error(`Document already exists: ${colName}/${docId}`);
                err.code = 6;
                throw err;
              }
              col[docId] = JSON.parse(JSON.stringify(data));
            },
            async delete() {
              const col = ensureCol(colName);
              delete col[docId];
            },
          };
        },
      };
    },
  };
}

describe('QuizPro Phase 6.3 Backend Authorization, Secrets & Live Test Security Suite', () => {
  let server: http.Server;
  let baseUrl = '';
  let mockDb: ReturnType<typeof createInMemoryFirestore>;

  const tokens: Record<string, TokenRecord> = {
    'valid-admin-token': {
      uid: 'admin_uid_1',
      email: 'zdpaliyal@gmail.com',
      email_verified: true,
      firebase: { sign_in_provider: 'google.com' },
    },
    'valid-student-token': {
      uid: 'student_uid_1',
      email: 'student@example.com',
      email_verified: true,
      firebase: { sign_in_provider: 'google.com' },
    },
    'anon-token': {
      uid: 'anon_uid_1',
      firebase: { sign_in_provider: 'anonymous' },
    },
    'unverified-admin-email-token': {
      uid: 'attacker_uid_2',
      email: 'zdpaliyal@gmail.com',
      email_verified: false,
      firebase: { sign_in_provider: 'password' },
    },
    'blocked-admin-token': {
      uid: 'blocked_admin_uid',
      email: 'zdpaliyal@gmail.com',
      email_verified: true,
      admin: true,
      firebase: { sign_in_provider: 'google.com' },
    },
    'demoted-admin-token': {
      uid: 'demoted_admin_uid',
      email: 'demoted@example.com',
      email_verified: true,
      admin: true,
      role: 'admin',
      firebase: { sign_in_provider: 'google.com' },
    },
    'revoked-admin-token': {
      uid: 'revoked_admin_uid',
      email: 'revoked@example.com',
      email_verified: true,
      admin: true,
      firebase: { sign_in_provider: 'google.com' },
    },
    'promoted-admin-token': {
      uid: 'promoted_admin_uid',
      email: 'promoted@example.com',
      email_verified: true,
      firebase: { sign_in_provider: 'google.com' },
    },
  };

  const mockAdminAuth = {
    async verifyIdToken(token: string, checkRevoked?: boolean) {
      expect(checkRevoked).toBe(true);
      if (token === 'expired-or-revoked-token') {
        const err: any = new Error('Firebase ID token has been revoked.');
        err.code = 'auth/id-token-revoked';
        throw err;
      }
      const record = tokens[token];
      if (!record) {
        const err: any = new Error('Invalid Firebase ID token.');
        err.code = 'auth/argument-error';
        throw err;
      }
      return record;
    },
  };

  beforeAll(async () => {
    mockDb = createInMemoryFirestore();
    const app = createServerApp({
      adminAuth: mockAdminAuth,
      adminDb: mockDb,
      geminiClientFactory: () => ({
        models: {
          generateContent: async () => ({
            text: JSON.stringify({
              ok: true,
              title: 'Mock Generated',
              slug: 'mock-generated',
              summary: 'Summary',
              excerpt: 'Excerpt',
              blocks: [],
              questions: [],
              seoTitle: 'SEO Title',
              seoDescription: 'SEO Description',
              focusKeyword: 'keyword',
              suggestedSlug: 'mock-slug',
              tags: ['tag1'],
            }),
          }),
        },
      }),
    });

    await new Promise<void>((resolve) => {
      server = app.listen(0, '127.0.0.1', () => {
        const addr = server.address() as any;
        baseUrl = `http://127.0.0.1:${addr.port}`;
        resolve();
      });
    });
  });

  afterAll(async () => {
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  beforeEach(() => {
    mockDb._store['users'] = {
      admin_uid_1: { uid: 'admin_uid_1', email: 'zdpaliyal@gmail.com', role: 'admin', status: 'active', blocked: false },
      student_uid_1: { uid: 'student_uid_1', email: 'student@example.com', role: 'student', status: 'active', blocked: false },
      blocked_admin_uid: { uid: 'blocked_admin_uid', email: 'zdpaliyal@gmail.com', role: 'admin', status: 'blocked', blocked: true },
      demoted_admin_uid: { uid: 'demoted_admin_uid', email: 'demoted@example.com', role: 'student', status: 'active', blocked: false },
      revoked_admin_uid: { uid: 'revoked_admin_uid', email: 'revoked@example.com', role: 'admin', revokedAdmin: true, status: 'active', blocked: false },
      promoted_admin_uid: { uid: 'promoted_admin_uid', email: 'promoted@example.com', role: 'admin', status: 'active', blocked: false },
    };

    mockDb._store['liveTests'] = {
      lt_secure_1: {
        id: 'lt_secure_1',
        title: 'RAS Mock Exam 1',
        status: 'live',
        marksPerQuestion: 2,
        negativeMarking: 0.66,
        totalMarks: 4,
        allowReattempt: false,
        questions: [
          {
            id: 'q_1',
            text: 'Capital of Rajasthan?',
            options: ['Jodhpur', 'Jaipur', 'Kota', 'Udaipur'],
            correctIndex: 1, // Simulates unmigrated legacy field on DB that GET must still strip!
            explanation: 'Jaipur is the capital.',
          },
          {
            id: 'q_2',
            text: 'Aravalli highest peak?',
            options: ['Guru Shikhar', 'Ser', 'Delwara', 'Achalgarh'],
          },
        ],
      },
    };

    mockDb._store['liveTestAnswerKeys'] = {
      lt_secure_1: {
        testId: 'lt_secure_1',
        title: 'RAS Mock Exam 1',
        marksPerQuestion: 2,
        negativeMarking: 0.66,
        totalMarks: 4,
        allowReattempt: false,
        answers: {
          q_1: { correctIndex: 1, explanation: 'Jaipur is the Pink City.' },
          q_2: { correctIndex: 0, explanation: 'Guru Shikhar is 1722m high.' },
        },
      },
    };

    mockDb._store['liveTestSubmissions'] = {};
    mockDb._store['articles'] = {
      art_1: { id: 'art_1', title: 'Pub', slug: 'pub-art', status: 'published', publishedAt: '2026-11-01T00:00:00Z' },
    };
  });

  // =========================================================================
  // PHASE 1: ADMIN & AUTH NEGATIVE SECURITY TESTS
  // =========================================================================

  test('AUTH-01: Missing Authorization header fails with 401 across protected admin and student AI routes', async () => {
    const routes: Array<[string, string, any?]> = [
      ['GET', '/api/admin/firebase-info'],
      ['GET', '/api/admin/firebase-storage-metrics'],
      ['GET', '/api/admin/ai-rotation/status'],
      ['POST', '/api/admin/ai-rotation/policy', { policy: 'round_robin' }],
      ['GET', '/api/admin/ai-configs'],
      ['POST', '/api/admin/ai-configs', { name: 'x', provider: 'gemini', apiKey: 'AIzaSyFakeSecret1234567890' }],
      ['PUT', '/api/admin/ai-configs/c1', { name: 'y' }],
      ['DELETE', '/api/admin/ai-configs/c1'],
      ['PUT', '/api/admin/ai-configs/c1/toggle', { enabled: false }],
      ['POST', '/api/admin/ai-configs/c1/reset'],
      ['POST', '/api/admin/ai-configs/reorder', { priorities: {} }],
      ['POST', '/api/admin/ai-configs/sync', { configs: [] }],
      ['POST', '/api/admin/news/ai-write', { topic: 'Budget' }],
      ['POST', '/api/admin/news/ai-assist', { action: 'seo_optimize', title: 'Test' }],
      ['POST', '/api/ai/test-key', { provider: 'gemini', apiKey: 'AIzaSyFakeSecret1234567890' }],
      ['POST', '/api/ai/ai-mcq-import', { jsonContent: { rawText: 'sample' } }],
      ['POST', '/api/sitemap/generate'],
      ['POST', '/api/sitemap/update'],
      ['POST', '/api/exam-paper/extract', { rawText: '1. Q' }],
      ['POST', '/api/ai/format-mcq', { rawText: '1. Q' }],
      ['POST', '/api/exam-paper/match', { extractedQuestions: [], bankQuestions: [] }],
      ['POST', '/api/live-tests/lt_secure_1/submit', { answers: { q_1: 1 }, timeSpentSeconds: 10 }],
    ];

    for (const [method, endpoint, body] of routes) {
      const res = await fetch(`${baseUrl}${endpoint}`, {
        method,
        headers: { 'Content-Type': 'application/json' },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      });
      expect(res.status, `${method} ${endpoint} should return 401 without token`).toBe(401);
    }
  });

  test('AUTH-02: Invalid/malformed, expired/revoked, and anonymous Bearer tokens fail with 401', async () => {
    for (const token of ['not-a-valid-jwt', 'expired-or-revoked-token', 'anon-token']) {
      const resAdmin = await fetch(`${baseUrl}/api/admin/ai-configs`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(resAdmin.status).toBe(401);

      const resStudentAi = await fetch(`${baseUrl}/api/exam-paper/extract`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ rawText: '1. Test question' }),
      });
      expect(resStudentAi.status).toBe(401);
    }
  });

  test('AUTH-03: Spoofed x-admin-role, x-admin-email, x-admin-uid, ?email=, and x-admin-secret bypasses fail completely', async () => {
    // 1. Without token + full spoofed headers -> 401
    const unauthSpoof = await fetch(`${baseUrl}/api/admin/firebase-storage-metrics?email=zdpaliyal@gmail.com`, {
      headers: {
        'x-admin-role': 'admin',
        'x-admin-email': 'zdpaliyal@gmail.com',
        'x-admin-uid': 'admin_uid_1',
        'x-admin-secret': 'quizpro-admin-secure',
      },
    });
    expect(unauthSpoof.status).toBe(401);

    // 2. With valid Student token + full spoofed headers -> 403
    const studentSpoof = await fetch(`${baseUrl}/api/admin/ai-configs?email=zdpaliyal@gmail.com`, {
      headers: {
        Authorization: 'Bearer valid-student-token',
        'x-admin-role': 'admin',
        'x-admin-email': 'zdpaliyal@gmail.com',
        'x-admin-uid': 'admin_uid_1',
        'x-admin-secret': 'quizpro-admin-secure',
      },
    });
    expect(studentSpoof.status).toBe(403);
  });

  test('AUTH-04: Valid Student token is denied (403) on ALL admin endpoints', async () => {
    const adminRoutes: Array<[string, string, any?]> = [
      ['GET', '/api/admin/firebase-info'],
      ['GET', '/api/admin/firebase-storage-metrics'],
      ['GET', '/api/admin/ai-rotation/status'],
      ['POST', '/api/admin/ai-rotation/policy', { policy: 'round_robin' }],
      ['GET', '/api/admin/ai-configs'],
      ['POST', '/api/admin/ai-configs', { name: 's', provider: 'gemini', apiKey: 'AIzaSyFakeSecret1234567890' }],
      ['DELETE', '/api/admin/ai-configs/c1'],
      ['POST', '/api/admin/news/ai-write', { topic: 'Budget' }],
      ['POST', '/api/admin/news/ai-assist', { action: 'seo_optimize', title: 'Test' }],
      ['POST', '/api/ai/test-key', { provider: 'gemini', apiKey: 'AIzaSyFakeSecret1234567890' }],
      ['POST', '/api/ai/ai-mcq-import', { jsonContent: { rawText: 'sample' } }],
      ['POST', '/api/sitemap/generate'],
    ];

    for (const [method, endpoint, body] of adminRoutes) {
      const res = await fetch(`${baseUrl}${endpoint}`, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid-student-token',
        },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      });
      expect(res.status, `Student should receive 403 on ${method} ${endpoint}`).toBe(403);
    }
  });

  test('AUTH-05: Blocked admin, demoted admin, revoked admin, and unverified admin email all receive 403', async () => {
    for (const token of [
      'blocked-admin-token',
      'demoted-admin-token',
      'revoked-admin-token',
      'unverified-admin-email-token',
    ]) {
      const res = await fetch(`${baseUrl}/api/admin/firebase-info`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(res.status, `${token} must be denied with 403`).toBe(403);
    }
  });

  test('AUTH-06: Verified allowlisted Admin & promoted unblocked Admin succeed (200) on admin routes', async () => {
    for (const token of ['valid-admin-token', 'promoted-admin-token']) {
      const infoRes = await fetch(`${baseUrl}/api/admin/firebase-info`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(infoRes.status).toBe(200);

      const writeRes = await fetch(`${baseUrl}/api/admin/news/ai-write`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          'x-ai-api-key': 'AIzaSyTestFakeKey1234567890ABCDEF',
        },
        body: JSON.stringify({ topic: 'Rajasthan Economy', language: 'English' }),
      });
      expect(writeRes.status).toBe(200);
    }
  });

  // =========================================================================
  // PHASE 2 & 3: AI ENDPOINT SECURITY + AES-256-GCM SECRET VAULT
  // =========================================================================

  test('SEC-CRYPTO-01: Secrets use AES-256-GCM (never Base64) and GET /api/admin/ai-configs never leaks raw or encrypted keys', async () => {
    const rawKey = 'AIzaSySuperSecretKey1234567890ABCD';
    const encrypted = encryptSecret(rawKey);
    expect(encrypted.startsWith('v1:')).toBe(true);
    expect(Buffer.from(encrypted, 'base64').toString('utf8')).not.toContain(rawKey);
    expect(decryptSecret(encrypted)).toBe(rawKey);

    // Reject forged legacy Base64 strings
    const legacyB64 = Buffer.from(rawKey, 'utf8').toString('base64');
    expect(decryptSecret(legacyB64)).toBe('');

    // Redaction utility strips secrets from log strings
    expect(redactSensitiveText(`Error using key ${rawKey} and Bearer eyJabc.def`)).not.toContain(rawKey);
    expect(redactSensitiveText(`Error using key ${rawKey} and Bearer eyJabc.def`)).not.toContain('eyJabc.def');

    // Create AI config via Admin API -> check sanitized response
    const createRes = await fetch(`${baseUrl}/api/admin/ai-configs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer valid-admin-token',
      },
      body: JSON.stringify({
        name: 'Vault Test Key',
        provider: 'gemini',
        apiKey: rawKey,
        model: 'gemini-2.5-flash',
      }),
    });
    expect(createRes.status).toBe(200);
    const createdBody = await createRes.json();
    expect(JSON.stringify(createdBody)).not.toContain(rawKey);
    expect(createdBody.config.encryptedApiKey).toBeUndefined();
    expect(createdBody.config.apiKey).toBe('•••••••••••••');

    const listRes = await fetch(`${baseUrl}/api/admin/ai-configs`, {
      headers: { Authorization: 'Bearer valid-admin-token' },
    });
    expect(listRes.status).toBe(200);
    const listBody = await listRes.json();
    expect(JSON.stringify(listBody)).not.toContain(rawKey);
    expect(JSON.stringify(listBody)).not.toContain('v1:');
  });

  test('SEC-AI-01: Authenticated student can use /api/exam-paper/match cleanly and oversized payloads are rejected (400)', async () => {
    const okRes = await fetch(`${baseUrl}/api/exam-paper/match`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer valid-student-token',
      },
      body: JSON.stringify({
        extractedQuestions: [{ examQuestionId: 'e1', text: 'Capital of Rajasthan' }],
        bankQuestions: [{ id: 'b1', text: 'Capital of Rajasthan?', subjectId: 's1' }],
      }),
    });
    expect(okRes.status).toBe(200);

    const oversizedRes = await fetch(`${baseUrl}/api/exam-paper/extract`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer valid-student-token',
      },
      body: JSON.stringify({
        rawText: 'A'.repeat(85000),
      }),
    });
    expect(oversizedRes.status).toBe(400);
  });

  // =========================================================================
  // PHASE 4: LIVE TEST ANSWER STRIPPING & SERVER-SIDE GRADING
  // =========================================================================

  test('SEC-LIVETEST-01: GET /api/live-tests/:testId strips correctIndex, answer, explanation, and importantFact', () => {
    const stripped = stripAnswerFieldsFromQuestion({
      id: 'q1',
      text: 'Question?',
      options: ['A', 'B'],
      correctIndex: 1,
      answer: 'B',
      explanation: 'Secret',
      importantFact: 'Fact',
    });
    expect(stripped).not.toHaveProperty('correctIndex');
    expect(stripped).not.toHaveProperty('answer');
    expect(stripped).not.toHaveProperty('explanation');
    expect(stripped).not.toHaveProperty('importantFact');

    const pub = sanitizeLiveTestForPublic({
      id: 't1',
      title: 'T',
      answerKey: { q1: 1 },
      questions: [{ id: 'q1', text: 'Q', options: ['A', 'B'], correctIndex: 0 }],
    });
    expect(pub).not.toHaveProperty('answerKey');
    expect(pub.questions[0]).not.toHaveProperty('correctIndex');
  });

  test('SEC-LIVETEST-02: GET /api/live-tests/:testId returns public questions ONLY without answers; POST /submit grades server-side & rejects duplicates (409)', async () => {
    // 1. Fetch public test
    const getRes = await fetch(`${baseUrl}/api/live-tests/lt_secure_1`);
    expect(getRes.status).toBe(200);
    const getData = await getRes.json();
    expect(getData.success).toBe(true);
    expect(getData.test.questions).toHaveLength(2);
    expect(getData.test.questions[0].correctIndex).toBeUndefined();
    expect(getData.test.questions[0].explanation).toBeUndefined();

    // 2. Unknown question ID is rejected with 400
    const badQRes = await fetch(`${baseUrl}/api/live-tests/lt_secure_1/submit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer valid-student-token',
      },
      body: JSON.stringify({
        submissionId: 'sub_bad_q',
        answers: { unknown_q_id: 0 },
        timeSpentSeconds: 30,
      }),
    });
    expect(badQRes.status).toBe(400);

    // 3. Valid submission (q_1=1 correct -> +2, q_2=1 wrong -> -0.66 => score 1.34)
    const subRes = await fetch(`${baseUrl}/api/live-tests/lt_secure_1/submit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer valid-student-token',
      },
      body: JSON.stringify({
        submissionId: 'sub_student_1_first',
        answers: { q_1: 1, q_2: 1 },
        timeSpentSeconds: 120,
        userName: 'Student Tester',
      }),
    });
    expect(subRes.status).toBe(200);
    const subData = await subRes.json();
    expect(subData.success).toBe(true);
    expect(subData.submission.userId).toBe('student_uid_1');
    expect(subData.submission.correctCount).toBe(1);
    expect(subData.submission.wrongCount).toBe(1);
    expect(subData.submission.score).toBe(1.34);
    expect(subData.submission.gradedServerSide).toBe(true);
    expect(subData.results.q_1.isCorrect).toBe(true);
    expect(subData.results.q_1.explanation).toBe('Jaipur is the Pink City.');
    expect(subData.results.q_2.isCorrect).toBe(false);
    expect(subData.results.q_2.correctIndex).toBe(0);

    // Persisted in DB
    expect(mockDb._store['liveTestSubmissions']['sub_student_1_first']).toBeDefined();

    // 4. Duplicate submission replay rejected with 409 (allowReattempt: false)
    const replayRes = await fetch(`${baseUrl}/api/live-tests/lt_secure_1/submit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer valid-student-token',
      },
      body: JSON.stringify({
        submissionId: 'sub_student_1_second',
        answers: { q_1: 1, q_2: 0 },
        timeSpentSeconds: 90,
      }),
    });
    expect(replayRes.status).toBe(409);
  });

  test('AUTH-FAILCLOSED: Server returns 503 when Firebase Admin auth or database dependencies are unavailable', async () => {
    const degradedApp = createServerApp({
      adminAuth: null,
      adminDb: null,
    });
    const degradedServer = await new Promise<http.Server>((resolve) => {
      const s = degradedApp.listen(0, '127.0.0.1', () => resolve(s));
    });
    const addr = degradedServer.address() as any;
    const degradedUrl = `http://127.0.0.1:${addr.port}`;

    try {
      const res = await fetch(`${degradedUrl}/api/admin/firebase-info`, {
        headers: { Authorization: 'Bearer valid-admin-token' },
      });
      expect(res.status).toBe(503);
    } finally {
      await new Promise<void>((resolve) => degradedServer.close(() => resolve()));
    }
  });
});
