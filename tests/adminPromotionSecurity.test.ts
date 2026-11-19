// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import {
  isSuperAdmin,
  isUserAdmin,
  saveUserProfile,
  loadUserProfile,
  clearUserProfile,
  ADMIN_EMAILS,
  ADMIN_UIDS,
  DEFAULT_USER_PROFILE,
} from '../src/utils/userProfileStorage';
import { updateUserRole, promoteUserByEmail } from '../src/utils/userManagementStorage';
import type { UserProfile } from '../src/types';

describe('Admin Promotion & Super Admin Security Architecture', () => {
  beforeEach(() => {
    clearUserProfile();
    if (typeof localStorage !== 'undefined') {
      localStorage.clear();
    }
  });

  describe('1. Super Admin Identity Verification', () => {
    it('verifies all primary super admin emails with case-insensitivity and whitespace trim', () => {
      ADMIN_EMAILS.forEach((email) => {
        expect(isSuperAdmin(email)).toBe(true);
        expect(isSuperAdmin(email.toUpperCase())).toBe(true);
        expect(isSuperAdmin(`  ${email}  `)).toBe(true);
        expect(isSuperAdmin({ ...DEFAULT_USER_PROFILE, email })).toBe(true);
      });
    });

    it('verifies all super admin UIDs', () => {
      ADMIN_UIDS.forEach((uid) => {
        expect(isSuperAdmin(uid)).toBe(true);
        expect(isSuperAdmin({ ...DEFAULT_USER_PROFILE, id: uid })).toBe(true);
      });
    });

    it('strictly denies super admin status to regular students and promoted admins', () => {
      expect(isSuperAdmin('student@example.com')).toBe(false);
      expect(isSuperAdmin('random_user@domain.in')).toBe(false);
      expect(isSuperAdmin({ ...DEFAULT_USER_PROFILE, id: 'promoted_admin_123', email: 'promoted@test.com', role: 'admin' })).toBe(false);
      expect(isSuperAdmin(null)).toBe(false);
      expect(isSuperAdmin(undefined)).toBe(false);
    });
  });

  describe('2. Promoted Admin Role Integrity (isUserAdmin & Local Storage)', () => {
    it('recognizes both Super Admins and Promoted Admins as active administrators', () => {
      // Super Admin
      expect(isUserAdmin('jagdishpaliyaljat@gmail.com')).toBe(true);

      // Promoted Admin with role="admin"
      const promotedAdmin: UserProfile = {
        ...DEFAULT_USER_PROFILE,
        id: 'new-admin-uuid-001',
        name: 'New Promoted Admin',
        email: 'promoted@example.com',
        role: 'admin',
      };
      expect(isUserAdmin(promotedAdmin)).toBe(true);
    });

    it('preserves role="admin" when saved via saveUserProfile (does not demote to student)', () => {
      const promotedAdmin: UserProfile = {
        ...DEFAULT_USER_PROFILE,
        id: 'new-admin-uuid-002',
        name: 'Assistant Admin',
        email: 'assistant@disha.edu',
        role: 'admin',
      };

      saveUserProfile(promotedAdmin);
      const reloaded = loadUserProfile();

      expect(reloaded).not.toBeNull();
      expect(reloaded?.role).toBe('admin');
      expect(isUserAdmin(reloaded)).toBe(true);
    });

    it('correctly keeps student role for regular students', () => {
      const student: UserProfile = {
        ...DEFAULT_USER_PROFILE,
        id: 'student-uuid-999',
        name: 'Regular Student',
        email: 'student@disha.edu',
        role: 'student',
      };

      saveUserProfile(student);
      const reloaded = loadUserProfile();

      expect(reloaded).not.toBeNull();
      expect(reloaded?.role).toBe('student');
      expect(isUserAdmin(reloaded)).toBe(false);
    });
  });

  describe('3. Super Admin Role Management Security Gates', () => {
    it('blocks regular admin or student from promoting another user to admin', async () => {
      // Set current session as a promoted (non-super) admin
      saveUserProfile({
        ...DEFAULT_USER_PROFILE,
        id: 'promoted-admin-abc',
        email: 'promoted_staff@disha.edu',
        role: 'admin',
      });

      await expect(
        updateUserRole('target-student-1', 'admin')
      ).rejects.toThrow(/अनधिकृत: केवल मुख्य प्रशासक/);
    });

    it('blocks regular admin or student from demoting an existing user', async () => {
      // Set current session as student
      saveUserProfile({
        ...DEFAULT_USER_PROFILE,
        id: 'student-hacker',
        email: 'student@evil.com',
        role: 'student',
      });

      await expect(
        updateUserRole('target-admin-1', 'student')
      ).rejects.toThrow(/अनधिकृत: केवल मुख्य प्रशासक/);
    });

    it('strictly forbids demoting a Super Admin', async () => {
      // Set current session as Super Admin
      saveUserProfile({
        ...DEFAULT_USER_PROFILE,
        id: ADMIN_UIDS[0],
        email: ADMIN_EMAILS[0],
        role: 'admin',
      });

      await expect(
        updateUserRole(ADMIN_UIDS[1], 'student')
      ).rejects.toThrow(/निषिद्ध: मुख्य Super Admin को डिमोट नहीं किया जा सकता/);
    });

    it('validates email format in promoteUserByEmail', async () => {
      // Set current session as Super Admin
      saveUserProfile({
        ...DEFAULT_USER_PROFILE,
        id: ADMIN_UIDS[0],
        email: ADMIN_EMAILS[0],
        role: 'admin',
      });

      await expect(
        promoteUserByEmail('not-an-email')
      ).rejects.toThrow(/मान्य ईमेल/);
    });
  });
});
