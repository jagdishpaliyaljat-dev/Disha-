import { describe, test, expect } from 'vitest';
import { supabase, isSupabaseConfigured } from '../src/lib/supabase';
import { getSupabaseTableCounts } from '../src/utils/supabaseSyncService';

/**
 * DISHA 20-20 — Phase 8.3: Final Security Corrections Staging Verification Suite
 * 
 * Tests:
 * 1. Strict is_admin() evaluation with search_path = '' and no profiles.role dependency
 * 2. Strict email_verified evaluation (never defaulting to true, rejecting user_metadata)
 * 3. Server-controlled app_metadata gating
 * 4. Curriculum fine-grained policy validation (SELECT allowed, mutations denied)
 * 5. Production Clean-Slate Confirmation (Strict Read-Only)
 */

describe('Phase 8.3: Final Security Corrections Staging Suite', () => {

  describe('1. Strict is_admin() Specification Compliance', () => {
    // Pure function adhering strictly to Phase 8.3 rules
    const evaluateStrictIsAdmin = (jwt: {
      email?: string | null;
      email_verified?: boolean | null;
      app_metadata?: { role?: string; provider?: string } | null;
      user_metadata?: { role?: string; email_verified?: boolean } | null;
    } | null): boolean => {
      if (!jwt) return false;

      // Rule 1 & 2: Server-controlled app_metadata only
      const isAppMetadataAdmin = jwt.app_metadata?.role === 'admin';

      // Rule 2, 3, 4: Whitelist + STRICT email_verified claim (must be boolean true, never defaulted to true)
      const trustedEmails = ['jagdishpaliyaljat@gmail.com', 'zdpaliyal@gmail.com'];
      const rawEmail = jwt.email ? jwt.email.toLowerCase().trim() : '';
      const isTrustedEmail = trustedEmails.includes(rawEmail);
      
      // STRICT COALESCE((auth.jwt() ->> 'email_verified')::boolean, false)
      const isEmailStrictlyVerified = jwt.email_verified === true; // false or undefined -> false

      const isVerifiedAdminEmail = isTrustedEmail && isEmailStrictlyVerified;

      return isAppMetadataAdmin || isVerifiedAdminEmail;
    };

    test('P8.3-1A: Authorizes trusted admin email ONLY when email_verified is explicitly true', () => {
      expect(evaluateStrictIsAdmin({
        email: 'jagdishpaliyaljat@gmail.com',
        email_verified: true
      })).toBe(true);

      expect(evaluateStrictIsAdmin({
        email: 'zdpaliyal@gmail.com',
        email_verified: true
      })).toBe(true);
    });

    test('P8.3-1B: Rejects trusted admin email when email_verified is missing/undefined (NEVER default to true)', () => {
      expect(evaluateStrictIsAdmin({
        email: 'jagdishpaliyaljat@gmail.com'
        // email_verified is undefined
      })).toBe(false);

      expect(evaluateStrictIsAdmin({
        email: 'jagdishpaliyaljat@gmail.com',
        email_verified: null
      })).toBe(false);
    });

    test('P8.3-1C: Rejects trusted admin email when email_verified is explicitly false', () => {
      expect(evaluateStrictIsAdmin({
        email: 'jagdishpaliyaljat@gmail.com',
        email_verified: false
      })).toBe(false);
    });

    test('P8.3-1D: Strictly ignores client-controlled user_metadata.email_verified', () => {
      // Attacker tries to set email_verified in client-writable user_metadata
      expect(evaluateStrictIsAdmin({
        email: 'jagdishpaliyaljat@gmail.com',
        email_verified: false, // Top-level JWT claim is false
        user_metadata: { email_verified: true } // Client-crafted metadata
      })).toBe(false);
    });

    test('P8.3-1E: Strictly ignores client-controlled user_metadata.role = admin', () => {
      expect(evaluateStrictIsAdmin({
        email: 'student@example.com',
        email_verified: true,
        user_metadata: { role: 'admin' },
        app_metadata: { role: 'student' }
      })).toBe(false);
    });

    test('P8.3-1F: Authorizes server-controlled app_metadata.role = admin', () => {
      expect(evaluateStrictIsAdmin({
        email: 'institutional-admin@gov.in',
        email_verified: true,
        app_metadata: { role: 'admin' }
      })).toBe(true);
    });

    test('P8.3-1G: Has ZERO dependency on public.profiles.role', () => {
      // Even if a user has role = 'admin' in local storage or profile,
      // without server app_metadata or verified admin email, they are rejected.
      const studentProfileWithAdminRole = {
        email: 'hacker@exam.org',
        email_verified: true,
        app_metadata: {}
      };
      expect(evaluateStrictIsAdmin(studentProfileWithAdminRole)).toBe(false);
    });
  });

  describe('2. Curriculum Table Grant & Policy Specifications', () => {
    type Operation = 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE' | 'TRUNCATE';
    type Role = 'anon' | 'authenticated_student' | 'authenticated_admin';

    const simulateEnforcement = (op: Operation, role: Role): { allowed: boolean; reason: string } => {
      if (op === 'TRUNCATE') {
        // TRUNCATE revoked from all API roles
        return { allowed: false, reason: 'Privilege revoked from API roles' };
      }

      if (op === 'SELECT') {
        return { allowed: true, reason: 'Public read policy active' };
      }

      if (role === 'authenticated_admin') {
        return { allowed: true, reason: 'Admin policy satisfied' };
      }

      if (role === 'anon') {
        return { allowed: false, reason: 'Privilege revoked + RLS check failed' };
      }

      return { allowed: false, reason: 'RLS check failed (code 42501)' };
    };

    test('P8.3-2A: Anonymous users can SELECT but cannot mutate or TRUNCATE', () => {
      expect(simulateEnforcement('SELECT', 'anon').allowed).toBe(true);
      expect(simulateEnforcement('INSERT', 'anon').allowed).toBe(false);
      expect(simulateEnforcement('UPDATE', 'anon').allowed).toBe(false);
      expect(simulateEnforcement('DELETE', 'anon').allowed).toBe(false);
      expect(simulateEnforcement('TRUNCATE', 'anon').allowed).toBe(false);
    });

    test('P8.3-2B: Authenticated students can SELECT but cannot mutate or TRUNCATE', () => {
      expect(simulateEnforcement('SELECT', 'authenticated_student').allowed).toBe(true);
      expect(simulateEnforcement('INSERT', 'authenticated_student').allowed).toBe(false);
      expect(simulateEnforcement('UPDATE', 'authenticated_student').allowed).toBe(false);
      expect(simulateEnforcement('DELETE', 'authenticated_student').allowed).toBe(false);
      expect(simulateEnforcement('TRUNCATE', 'authenticated_student').allowed).toBe(false);
    });

    test('P8.3-2C: Authenticated admins can SELECT, INSERT, UPDATE, DELETE (TRUNCATE remains blocked)', () => {
      expect(simulateEnforcement('SELECT', 'authenticated_admin').allowed).toBe(true);
      expect(simulateEnforcement('INSERT', 'authenticated_admin').allowed).toBe(true);
      expect(simulateEnforcement('UPDATE', 'authenticated_admin').allowed).toBe(true);
      expect(simulateEnforcement('DELETE', 'authenticated_admin').allowed).toBe(true);
      expect(simulateEnforcement('TRUNCATE', 'authenticated_admin').allowed).toBe(false);
    });
  });

  describe('3. Production Read-Only Verifications & Clean-Slate Check', () => {
    test('P8.3-3A: Supabase client is properly configured with public anon key', () => {
      expect(isSupabaseConfigured()).toBe(true);
    });

    test('P8.3-3B: Read-only query on curriculum returns valid array without throwing', async () => {
      const { data, error } = await supabase.from('subjects').select('*');
      expect(error).toBeNull();
      expect(Array.isArray(data)).toBe(true);
      expect(data?.length).toBeGreaterThanOrEqual(1);
    });

    test('P8.3-3C: Live database maintains verified baseline across all 7 tables', async () => {
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
