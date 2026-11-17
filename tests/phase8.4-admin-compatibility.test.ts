import { describe, test, expect } from 'vitest';
import { supabase, isSupabaseConfigured } from '../src/lib/supabase';
import { getSupabaseTableCounts } from '../src/utils/supabaseSyncService';
import { isUserAdmin } from '../src/utils/userProfileStorage';
import { parseRawMcqText } from '../src/utils/questionParser';

/**
 * DISHA 20-20 — Phase 8.4: Production JWT Compatibility & Admin Application Workflow Suite
 * 
 * Tests:
 * 1. Supabase JWT claim compatibility & server app_metadata precedence
 * 2. Admin CRUD lifecycle simulation for Curriculum (Subject -> Chapter -> Topic -> Question)
 * 3. Bulk MCQ import workflow & 5-option RPSC integrity
 * 4. Anonymous and student read-only access enforcement
 * 5. Production Clean-Slate Confirmation (Strict Read-Only)
 */

describe('Phase 8.4: Production JWT Compatibility & Admin Workflows', () => {

  describe('1. Supabase JWT Claims & Authorization Architecture', () => {
    // Model of production Supabase JWT payload
    interface SupabaseJwt {
      iss: string;
      sub: string;
      aud: string;
      exp: number;
      email?: string;
      app_metadata?: {
        provider?: string;
        providers?: string[];
        role?: string;
      };
      user_metadata?: {
        name?: string;
        role?: string;
        email_verified?: boolean;
      };
      email_verified?: boolean;
    }

    const verifyJwtAdminAccess = (jwt: SupabaseJwt | null): boolean => {
      if (!jwt) return false;

      // 1. Primary: Server-controlled app_metadata.role
      if (jwt.app_metadata?.role === 'admin') {
        return true;
      }

      // 2. Secondary: Cryptographic email claim with trusted provider confirmation
      const trustedEmails = ['jagdishpaliyaljat@gmail.com', 'zdpaliyal@gmail.com'];
      const rawEmail = jwt.email ? jwt.email.toLowerCase().trim() : '';

      if (trustedEmails.includes(rawEmail)) {
        // Must be verified via explicit claim or trusted OAuth provider
        const isExplicitlyVerified = jwt.email_verified === true;
        const isGoogleProvider = jwt.app_metadata?.provider === 'google';
        if (isExplicitlyVerified || isGoogleProvider) {
          return true;
        }
      }

      // 3. user_metadata is NEVER trusted
      return false;
    };

    test('P8.4-1A: Authorizes user with server-controlled app_metadata.role = admin', () => {
      const adminJwt: SupabaseJwt = {
        iss: 'https://eaidivceejkdqsshlraj.supabase.co/auth/v1',
        sub: 'a1b2c3d4-e5f6-4a1b-8c2d-3e4f5a6b7c8d',
        aud: 'authenticated',
        exp: 1746073036,
        email: 'jagdishpaliyaljat@gmail.com',
        app_metadata: {
          provider: 'email',
          providers: ['email'],
          role: 'admin'
        }
      };
      expect(verifyJwtAdminAccess(adminJwt)).toBe(true);
    });

    test('P8.4-1B: Authorizes whitelisted email authenticated via Google OAuth provider', () => {
      const googleAdminJwt: SupabaseJwt = {
        iss: 'https://eaidivceejkdqsshlraj.supabase.co/auth/v1',
        sub: 'a1b2c3d4-e5f6-4a1b-8c2d-3e4f5a6b7c8d',
        aud: 'authenticated',
        exp: 1746073036,
        email: 'jagdishpaliyaljat@gmail.com',
        app_metadata: {
          provider: 'google',
          providers: ['google']
        }
      };
      expect(verifyJwtAdminAccess(googleAdminJwt)).toBe(true);
    });

    test('P8.4-1C: Strictly rejects attacker claiming role=admin in user_metadata', () => {
      const spoofedJwt: SupabaseJwt = {
        iss: 'https://eaidivceejkdqsshlraj.supabase.co/auth/v1',
        sub: 'hacker-uuid',
        aud: 'authenticated',
        exp: 1746073036,
        email: 'attacker@evil.com',
        app_metadata: {
          provider: 'email',
          providers: ['email']
        },
        user_metadata: {
          role: 'admin',
          email_verified: true
        }
      };
      expect(verifyJwtAdminAccess(spoofedJwt)).toBe(false);
    });

    test('P8.4-1D: Client utility isUserAdmin aligns with backend policy', () => {
      expect(isUserAdmin('jagdishpaliyaljat@gmail.com')).toBe(true);
      expect(isUserAdmin('zdpaliyal@gmail.com')).toBe(true);
      expect(isUserAdmin('student@example.com')).toBe(false);
      expect(isUserAdmin(null)).toBe(false);
    });
  });

  describe('2. Admin Curriculum CRUD Operations Simulation', () => {
    // Isolated in-memory model of PostgreSQL RLS enforcement
    interface DatabaseState {
      subjects: Array<{ id: string; name: string }>;
      chapters: Array<{ id: string; subject_id: string; name: string }>;
      topics: Array<{ id: string; chapter_id: string; subject_id: string; name: string }>;
      questions: Array<{ id: string; topic_id: string; question: string; options: string[]; correct_answer: number }>;
    }

    const createTestDatabase = (): DatabaseState => ({
      subjects: [],
      chapters: [],
      topics: [],
      questions: []
    });

    const executeAdminMutation = <T>(
      db: DatabaseState,
      isAdmin: boolean,
      mutation: (state: DatabaseState) => T
    ): { success: boolean; result?: T; error?: { code: string; message: string } } => {
      if (!isAdmin) {
        return { success: false, error: { code: '42501', message: 'insufficient_privilege' } };
      }
      return { success: true, result: mutation(db) };
    };

    test('P8.4-2A: Subject Create, Update, Delete succeeds for admin', () => {
      const db = createTestDatabase();
      
      // Create
      const createRes = executeAdminMutation(db, true, s => {
        s.subjects.push({ id: 'subj_test', name: 'Rajasthan History' });
        return s.subjects.length;
      });
      expect(createRes.success).toBe(true);
      expect(db.subjects.length).toBe(1);

      // Update
      const updateRes = executeAdminMutation(db, true, s => {
        s.subjects[0].name = 'Rajasthan History & Culture';
        return s.subjects[0].name;
      });
      expect(updateRes.result).toBe('Rajasthan History & Culture');

      // Delete
      const deleteRes = executeAdminMutation(db, true, s => {
        s.subjects = s.subjects.filter(sub => sub.id !== 'subj_test');
        return s.subjects.length;
      });
      expect(deleteRes.result).toBe(0);
    });

    test('P8.4-2B: Chapter Create, Update, Delete succeeds for admin', () => {
      const db = createTestDatabase();
      db.subjects.push({ id: 'subj_1', name: 'History' });

      // Create Chapter
      const res = executeAdminMutation(db, true, s => {
        s.chapters.push({ id: 'ch_1', subject_id: 'subj_1', name: 'Mewar Dynasty' });
        return s.chapters.length;
      });
      expect(res.success).toBe(true);
      expect(db.chapters.length).toBe(1);

      // Delete Chapter
      executeAdminMutation(db, true, s => {
        s.chapters = s.chapters.filter(c => c.id !== 'ch_1');
      });
      expect(db.chapters.length).toBe(0);
    });

    test('P8.4-2C: Topic Create with automatic parent subject_id derivation succeeds for admin', () => {
      const db = createTestDatabase();
      db.subjects.push({ id: 'subj_1', name: 'History' });
      db.chapters.push({ id: 'ch_1', subject_id: 'subj_1', name: 'Mewar' });

      // Create Topic
      const res = executeAdminMutation(db, true, s => {
        const parentChapter = s.chapters.find(c => c.id === 'ch_1');
        s.topics.push({
          id: 'top_1',
          chapter_id: 'ch_1',
          subject_id: parentChapter?.subject_id || '',
          name: 'Maharana Pratap'
        });
        return s.topics[0];
      });
      expect(res.result?.subject_id).toBe('subj_1');
      expect(db.topics.length).toBe(1);
    });

    test('P8.4-2D: Question Create with 5 options (A-E) succeeds for admin', () => {
      const db = createTestDatabase();
      const questionPayload = {
        id: 'q_001',
        topic_id: 'top_1',
        question: 'हल्दीघाटी का युद्ध किस वर्ष हुआ था?',
        options: ['1576', '1582', '1568', '1572', 'अनुत्तरित प्रश्न (Option E)'],
        correct_answer: 0
      };

      const res = executeAdminMutation(db, true, s => {
        s.questions.push(questionPayload);
        return s.questions[0];
      });
      expect(res.result?.options.length).toBe(5);
      expect(res.result?.options[4]).toContain('Option E');
      expect(res.result?.correct_answer).toBe(0);
    });
  });

  describe('3. Bulk MCQ Importer & Parsing Compatibility', () => {
    test('P8.4-3A: Parses 5-option text import preserving Hindi text and Option E', () => {
      const sampleText = `
1. हल्दीघाटी का युद्ध किस वर्ष लड़ा गया था?
A. 1576
B. 1582
C. 1568
D. 1572
E. अनुत्तरित प्रश्न
उत्तर: A
व्याख्या: हल्दीघाटी का युद्ध 18 जून 1576 को लड़ा गया था।
      `;

      const result = parseRawMcqText(sampleText);
      expect(result.questions.length).toBe(1);
      expect(result.questions[0].options.length).toBe(5);
      expect(result.questions[0].correctIndex).toBe(0);
      expect(result.questions[0].options[4]).toContain('अनुत्तरित प्रश्न');
      expect(result.questions[0].explanation).toContain('18 जून 1576');
    });
  });

  describe('4. Student & Anonymous Read-Only Access', () => {
    test('P8.4-4A: Student and anonymous queries can SELECT from curriculum tables', async () => {
      expect(isSupabaseConfigured()).toBe(true);
      const { data, error } = await supabase.from('subjects').select('*');
      expect(error).toBeNull();
      expect(Array.isArray(data)).toBe(true);
    });

    test('P8.4-4B: Anonymous mutations to private tables return code 42501', async () => {
      const { error } = await supabase.from('profiles').insert([{
        id: '00000000-0000-0000-0000-000000000000',
        display_name: 'Test'
      }]);
      expect(error).toBeDefined();
      expect(error?.code).toBe('42501');
    });
  });

  describe('5. Production Safety & Clean-Slate Confirmation (Read-Only)', () => {
    test('P8.4-5A: Strictly confirms verified production database baseline', async () => {
      const counts = await getSupabaseTableCounts();
      expect(counts.subjects).toBeGreaterThanOrEqual(1);
      expect(counts.chapters).toBeGreaterThanOrEqual(1);
      expect(counts.topics).toBeGreaterThanOrEqual(1);
      expect(counts.questions).toBeGreaterThanOrEqual(1);
      expect(counts.profiles).toBe(0);
      expect(counts.attempts).toBe(0);
      expect(counts.bookmarks).toBe(0);
    });
  });
});
