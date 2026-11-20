import { describe, test, expect } from 'vitest';
import { supabase, isSupabaseConfigured, SUPABASE_URL, SUPABASE_ANON_KEY } from '../src/lib/supabase';
import { loadUserProfile, saveUserProfile, isUserAdmin, clearUserProfile } from '../src/utils/userProfileStorage';
import { UserProfile } from '../src/types';

describe('DISHA 20-20 Login System Comprehensive Test Suite', () => {

  test('AUTH-01: Supabase Configuration & Fallback Credentials Check', () => {
    expect(isSupabaseConfigured()).toBe(true);
    expect(SUPABASE_URL).toBeDefined();
    expect(SUPABASE_URL).toMatch(/^https:\/\/[a-z0-9]+\.supabase\.co/);
    expect(SUPABASE_ANON_KEY).toBeDefined();
    expect(SUPABASE_ANON_KEY.length).toBeGreaterThan(20);
  });

  test('AUTH-02: Live Supabase Auth Endpoint Connectivity Check', async () => {
    const response = await fetch(`${SUPABASE_URL}/auth/v1/settings`, {
      headers: {
        apikey: SUPABASE_ANON_KEY,
      },
    });

    expect(response.status).toBe(200);
    const settings = await response.json();
    expect(settings).toBeDefined();
    expect(settings.external).toBeDefined();
    // Verify enabled authentication providers
    expect(settings.external.email).toBe(true);
    expect(settings.external.google).toBe(true);
  });

  test('AUTH-03: Email/Password Auth - Rejection of Invalid Credentials', async () => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: 'nonexistent.student.test998@disha2020.com',
      password: 'WrongPassword123!',
    });

    expect(data.session).toBeNull();
    expect(error).not.toBeNull();
    expect(error?.message?.toLowerCase()).toContain('invalid login credentials');
  });

  test('AUTH-04: Google OAuth Authorization URL Generation', async () => {
    const redirectTarget = 'https://disha-2020.vercel.app';
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectTarget,
      },
    });

    expect(error).toBeNull();
    expect(data).toBeDefined();
    expect(data?.url).toBeDefined();
    // Supabase generates authorize endpoint pointing to Google provider and preserving redirect_to
    expect(data.url).toContain('/auth/v1/authorize?provider=google');
    expect(data.url).toContain(encodeURIComponent(redirectTarget));
  });

  test('AUTH-05: Guest Login Profile Structure & Persistence', () => {
    // 1. Clear any existing profile - app returns default persistent guest profile with UUID
    clearUserProfile();
    const guestAfterClear = loadUserProfile();
    expect(guestAfterClear).not.toBeNull();
    expect(guestAfterClear?.role).toBe('student');
    // Ensure automatic UUID assignment for default guests
    expect(guestAfterClear?.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(isUserAdmin(guestAfterClear!)).toBe(false);

    // 2. Create custom student profile
    const customProfile: UserProfile = {
      id: 'student_custom_123',
      name: 'Custom Student',
      email: 'custom@student.disha',
      role: 'student',
      status: 'active',
      createdAt: new Date().toISOString(),
    };

    saveUserProfile(customProfile);
    const loaded = loadUserProfile();
    expect(loaded).not.toBeNull();
    expect(loaded?.id).toBe('student_custom_123');
    expect(loaded?.name).toBe('Custom Student');
    expect(loaded?.role).toBe('student');
    expect(isUserAdmin(loaded!)).toBe(false);

    // 3. Cleanup
    clearUserProfile();
    const cleaned = loadUserProfile();
    expect(cleaned).not.toBeNull();
    expect(cleaned?.role).toBe('student');
  });

  test('AUTH-06: Admin vs Student Role Resolution', () => {
    const studentUser: UserProfile = {
      id: 'student_123',
      name: 'Ravi Kumar',
      email: 'ravi@example.com',
      role: 'student',
      status: 'active',
    };
    expect(isUserAdmin(studentUser)).toBe(false);

    const adminUser: UserProfile = {
      id: 'admin_123',
      name: 'Jagdish Paliyal',
      email: 'jagdishpaliyaljat@gmail.com',
      role: 'admin',
      status: 'active',
    };
    expect(isUserAdmin(adminUser)).toBe(true);
  });

});
