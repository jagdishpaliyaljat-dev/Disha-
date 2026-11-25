import { describe, test, expect, beforeEach, vi } from 'vitest';

// Mock storage for Node test environment
const mockStorageData: Record<string, string> = {};
const mockLocalStorage = {
  getItem: vi.fn((key: string) => mockStorageData[key] || null),
  setItem: vi.fn((key: string, val: string) => {
    mockStorageData[key] = String(val);
  }),
  removeItem: vi.fn((key: string) => {
    delete mockStorageData[key];
  }),
  clear: vi.fn(() => {
    for (const k in mockStorageData) delete mockStorageData[k];
  }),
};
(globalThis as any).localStorage = mockLocalStorage;

import {
  isProfileAuthenticated,
  loadUserProfile,
  saveUserProfile,
  clearUserProfile,
  DEFAULT_USER_PROFILE,
} from '../src/utils/userProfileStorage';
import { UserProfile } from '../src/types';
import { supabase, isSupabaseConfigured, SUPABASE_URL, SUPABASE_ANON_KEY } from '../src/lib/supabase';
import {
  parseAuthTokensFromUrl,
  NATIVE_CUSTOM_SCHEME,
  GOOGLE_WEB_CLIENT_ID,
} from '../src/utils/mobileAuthService';

describe('Mandatory Google Login Gate & Auth State Suite', () => {
  beforeEach(() => {
    clearUserProfile();
    mockLocalStorage.clear();
  });

  test('GATE-01: Unauthenticated and Guest profiles are strictly rejected by auth gate', () => {
    // 1. null profile
    expect(isProfileAuthenticated(null)).toBe(false);

    // 2. Default initial guest with empty email
    const guestProfile: UserProfile = {
      ...DEFAULT_USER_PROFILE,
      id: 'test-guest-uuid-1234',
      email: '',
      name: 'Guest Aspirant',
    };
    expect(isProfileAuthenticated(guestProfile)).toBe(false);

    // 3. Fallback dummy student
    const dummyStudent: UserProfile = {
      ...DEFAULT_USER_PROFILE,
      id: 'student_default',
      email: 'student_default@example.com',
    };
    expect(isProfileAuthenticated(dummyStudent)).toBe(false);

    // 4. White-space only email
    const whitespaceEmail: UserProfile = {
      ...DEFAULT_USER_PROFILE,
      id: 'test-user-1',
      email: '   ',
    };
    expect(isProfileAuthenticated(whitespaceEmail)).toBe(false);
  });

  test('GATE-02: Verified Google user profile passes auth gate', () => {
    const verifiedStudent: UserProfile = {
      ...DEFAULT_USER_PROFILE,
      id: 'google-oauth2-sub-998877',
      email: 'student.aspirant@gmail.com',
      name: 'Aspirant Student',
      role: 'student',
    };

    expect(isProfileAuthenticated(verifiedStudent)).toBe(true);

    const verifiedAdmin: UserProfile = {
      ...DEFAULT_USER_PROFILE,
      id: 'google-oauth2-admin-112233',
      email: 'director@disha2020.com',
      name: 'Admin Director',
      role: 'admin',
    };

    expect(isProfileAuthenticated(verifiedAdmin)).toBe(true);
  });

  test('GATE-03: Login persistence and logout teardown flow', () => {
    // Before login, storage is clean
    const preLoginProfile = loadUserProfile();
    expect(isProfileAuthenticated(preLoginProfile)).toBe(false);

    // Simulate Google Sign-In Success
    const activeStudent: UserProfile = {
      ...DEFAULT_USER_PROFILE,
      id: 'google-user-777',
      email: 'student777@gmail.com',
      name: 'Student 777',
    };
    saveUserProfile(activeStudent);

    // Verified persistent session
    const loadedProfile = loadUserProfile();
    expect(loadedProfile).not.toBeNull();
    expect(loadedProfile?.email).toBe('student777@gmail.com');
    expect(isProfileAuthenticated(loadedProfile)).toBe(true);

    // User triggers handleLogout() -> clearUserProfile()
    clearUserProfile();

    // After logout, profile must be revoked back to unauthenticated
    const postLogoutProfile = loadUserProfile();
    expect(isProfileAuthenticated(postLogoutProfile)).toBe(false);
  });

  test('GATE-04: Live Supabase Google Auth Provider connectivity', async () => {
    expect(isSupabaseConfigured()).toBe(true);

    // Check remote Supabase auth provider settings
    const response = await fetch(`${SUPABASE_URL}/auth/v1/settings`, {
      headers: {
        apikey: SUPABASE_ANON_KEY,
      },
    });

    expect(response.status).toBe(200);
    const settings = await response.json();
    expect(settings?.external?.google).toBe(true);
  });

  test('GATE-05: Google OAuth URL generation with Native Custom Scheme', async () => {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: NATIVE_CUSTOM_SCHEME,
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    });

    expect(error).toBeNull();
    expect(data?.url).toBeDefined();
    expect(data.url).toContain('/auth/v1/authorize?provider=google');
    expect(data.url).toContain(encodeURIComponent(NATIVE_CUSTOM_SCHEME));
  });

  test('GATE-06: Deep link token parsing for Native Android callbacks', () => {
    const mockCallbackUrl = `${NATIVE_CUSTOM_SCHEME}#access_token=mock_jwt_access_token&refresh_token=mock_refresh_token&token_type=bearer&expires_in=3600`;
    const parsed = parseAuthTokensFromUrl(mockCallbackUrl);

    expect(parsed.accessToken).toBe('mock_jwt_access_token');
    expect(parsed.refreshToken).toBe('mock_refresh_token');
    expect(parsed.errorDescription).toBeNull();

    // Verify Google Web Client ID for Android One-Tap
    expect(GOOGLE_WEB_CLIENT_ID).toBeDefined();
    expect(GOOGLE_WEB_CLIENT_ID).toContain('.apps.googleusercontent.com');
  });
});
