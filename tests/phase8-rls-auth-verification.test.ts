import { describe, test, expect, beforeEach } from 'vitest';
import { 
  syncUserProfileToSupabase,
  fetchUserProfileFromSupabase,
  syncCurriculumAuthoritative,
  getSupabaseTableCounts
} from '../src/utils/supabaseSyncService';
import { isUserAdmin } from '../src/utils/userProfileStorage';
import { supabase, isSupabaseConfigured } from '../src/lib/supabase';
import { idbPut, idbGet, idbGetAll, idbClear, STORES } from '../src/utils/localDatabaseEngine';
import { Subject, UserProfile } from '../src/types';

describe('Phase 8: Deployment Gap & Authentication UUID Final Verification', () => {

  beforeEach(async () => {
    await idbClear(STORES.SUBJECTS);
    await idbClear(STORES.CHAPTERS);
    await idbClear(STORES.TOPICS);
    await idbClear(STORES.MCQS);
    await idbClear(STORES.CURRICULUM_METADATA);
  });

  describe('1. UUID Authentication & Profile Isolation', () => {
    test('P8-1A: Reject non-UUID IDs (e.g. usr_admin_jagdish) safely without crashing or throwing Postgres syntax errors', async () => {
      const mockLegacyAdminProfile = {
        id: 'usr_admin_jagdish',
        name: 'Jagdish Jat',
        email: 'jagdishpaliyaljat@gmail.com',
        role: 'admin',
        status: 'active'
      };

      const result = await syncUserProfileToSupabase(mockLegacyAdminProfile);
      // Must cleanly return false without throwing "invalid input syntax for type uuid"
      expect(result).toBe(false);

      const fetchResult = await fetchUserProfileFromSupabase('usr_admin_jagdish');
      expect(fetchResult).toBeNull();
    });

    test('P8-1B: Reject guest and default IDs (student_default, guest_*) without touching PostgreSQL profiles', async () => {
      expect(await syncUserProfileToSupabase({ id: 'student_default' })).toBe(false);
      expect(await syncUserProfileToSupabase({ id: 'guest_1794829302' })).toBe(false);
      expect(await fetchUserProfileFromSupabase('student_default')).toBeNull();
      expect(await fetchUserProfileFromSupabase('guest_1794829302')).toBeNull();
    });

    test('P8-1C: Requires active matching Supabase session before attempting profile write', async () => {
      // Valid UUID format, but no matching session in test environment
      const dummyValidUuid = 'a1b2c3d4-e5f6-4a1b-8c2d-3e4f5a6b7c8d';
      const profile = {
        id: dummyValidUuid,
        name: 'Test Student',
        email: 'student@example.com',
        role: 'student'
      };

      const result = await syncUserProfileToSupabase(profile);
      // Because there is no active session matching dummyValidUuid, it safely aborts and returns false
      expect(result).toBe(false);
    });

    test('P8-1D: Admin email authorization is strictly independent of profile UUID identity', () => {
      // Authorized admin email regardless of UUID
      expect(isUserAdmin('jagdishpaliyaljat@gmail.com')).toBe(true);
      expect(isUserAdmin('JAGDISHPALIYALJAT@GMAIL.COM ')).toBe(true);
      expect(isUserAdmin({ id: 'any-uuid-or-id', email: 'jagdishpaliyaljat@gmail.com' } as any)).toBe(true);

      // Unauthorized accounts
      expect(isUserAdmin('student@example.com')).toBe(false);
      expect(isUserAdmin('admin@fake.com')).toBe(false);
      expect(isUserAdmin(null)).toBe(false);
    });
  });

  describe('2. Live Supabase RLS (Row Level Security) Verification', () => {
    test('P8-2A: Anonymous caller cannot access private profiles table (RLS row isolation)', async () => {
      expect(isSupabaseConfigured()).toBe(true);
      const { data, error } = await supabase.from('profiles').select('*').limit(10);
      expect(error).toBeNull();
      // Anonymous caller receives 0 rows because auth.uid() is null
      expect(Array.isArray(data)).toBe(true);
      expect(data?.length).toBe(0);
    });

    test('P8-2B: Anonymous caller cannot access private attempts table (RLS user isolation)', async () => {
      const { data, error } = await supabase.from('attempts').select('*').limit(10);
      expect(error).toBeNull();
      expect(Array.isArray(data)).toBe(true);
      expect(data?.length).toBe(0);
    });

    test('P8-2C: Anonymous caller cannot access private bookmarks table (RLS user isolation)', async () => {
      const { data, error } = await supabase.from('bookmarks').select('*').limit(10);
      expect(error).toBeNull();
      expect(Array.isArray(data)).toBe(true);
      expect(data?.length).toBe(0);
    });

    test('P8-2D: Anonymous caller is blocked from unauthorized write to private tables with code 42501', async () => {
      // 1. profiles table blocks anon write
      const { error: profErr } = await supabase.from('profiles').insert([{
        id: '00000000-0000-0000-0000-000000000000',
        display_name: 'Hacker'
      }]);
      expect(profErr).toBeDefined();
      expect(profErr?.code).toBe('42501');

      // 2. attempts table blocks anon write
      const { error: attErr } = await supabase.from('attempts').insert([{
        user_id: '00000000-0000-0000-0000-000000000000',
        score: 10
      }]);
      expect(attErr).toBeDefined();
      expect(attErr?.code).toBe('42501');

      // 3. bookmarks table blocks anon write
      const { error: bmErr } = await supabase.from('bookmarks').insert([{
        user_id: '00000000-0000-0000-0000-000000000000',
        question_id: 'q_test'
      }]);
      expect(bmErr).toBeDefined();
      expect(bmErr?.code).toBe('42501');
    });

    test('P8-2E: Anonymous caller is allowed read-only access to public curriculum tables', async () => {
      const { data: subs, error: subErr } = await supabase.from('subjects').select('*');
      expect(subErr).toBeNull();
      expect(Array.isArray(subs)).toBe(true);

      const { data: chaps, error: chapErr } = await supabase.from('chapters').select('*');
      expect(chapErr).toBeNull();
      expect(Array.isArray(chaps)).toBe(true);

      const { data: qs, error: qErr } = await supabase.from('questions').select('*');
      expect(qErr).toBeNull();
      expect(Array.isArray(qs)).toBe(true);
    });
  });

  describe('3. Production Cache Failure Safety Verification', () => {
    test('P8-3A: Distinguishes authoritative empty server response from request failures', async () => {
      // 1. Authoritative empty response prunes stale server-originated records
      const staleSub: Subject = { id: 'old-server-sub', name: 'Old', hindiName: 'पुराना', order: 1, isUserAdded: false };
      await idbPut(STORES.SUBJECTS, staleSub);

      const syncResult = await syncCurriculumAuthoritative({ force: true });
      expect(syncResult.prunedSubjects).toBe(1);
      expect(await idbGet(STORES.SUBJECTS, 'old-server-sub')).toBeNull();

      // 2. Network error does NOT prune records
      const freshSub: Subject = { id: 'kept-sub', name: 'Kept', hindiName: 'सुरक्षित', order: 1, isUserAdded: false };
      await idbPut(STORES.SUBJECTS, freshSub);

      const originalFrom = supabase.from;
      // @ts-ignore
      supabase.from = () => ({
        select: () => ({
          order: () => Promise.reject(new Error('Network offline'))
        })
      } as any);

      try {
        const failedSync = await syncCurriculumAuthoritative({ force: true });
        expect(failedSync.prunedSubjects).toBe(0);
        // Record must remain in cache!
        expect(await idbGet(STORES.SUBJECTS, 'kept-sub')).not.toBeNull();
      } finally {
        supabase.from = originalFrom;
      }
    });

    test('P8-3B: Pending offline drafts are strictly preserved across syncs', async () => {
      const draftSub: Subject = { id: 'my-draft', name: 'Draft', hindiName: 'ड्राफ्ट', order: 1, isUserAdded: true };
      (draftSub as any).syncStatus = 'pending';
      await idbPut(STORES.SUBJECTS, draftSub);

      const syncRes = await syncCurriculumAuthoritative({ force: true });
      expect(syncRes.preservedDrafts).toBe(1);
      expect(await idbGet(STORES.SUBJECTS, 'my-draft')).not.toBeNull();
    });
  });

  describe('4. Strict Production Safety & Clean-Slate Confirmation', () => {
    test('P8-4A: Confirms zero production database modifications occurred', async () => {
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
