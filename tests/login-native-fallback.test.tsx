// @vitest-environment jsdom
import React, { act } from 'react';
import ReactDOM from 'react-dom/client';
import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const { mockSignInWithOAuth, mockPerformNativeGoogleLogin, mockOpenOAuthBrowser } = vi.hoisted(() => ({
  mockSignInWithOAuth: vi.fn(async () => ({
    data: { url: 'https://accounts.google.com/o/oauth2/auth?mock=1' },
    error: null,
  })),
  mockPerformNativeGoogleLogin: vi.fn(async () => ({
    success: false,
    cancelled: true,
    error: 'Google Sign-In cancelled by user',
    isNative: true,
  })),
  mockOpenOAuthBrowser: vi.fn(async () => {}),
}));

vi.mock('../src/lib/supabase', () => ({
  isSupabaseConfigured: () => true,
  supabase: {
    auth: {
      signInWithOAuth: mockSignInWithOAuth,
    },
  },
}));

vi.mock('../src/utils/mobileAuthService', () => ({
  isNativePlatform: () => true,
  getOAuthRedirectUrl: () => 'com.rajexam.prep://auth-callback',
  openOAuthBrowser: mockOpenOAuthBrowser,
  registerMobileDeepLinkListener: () => () => {},
  performNativeGoogleLogin: mockPerformNativeGoogleLogin,
}));

import { LoginPage } from '../src/components/LoginPage';

describe('LoginPage Native Picker Cancellation & Browser Fallback', () => {
  let container: HTMLDivElement;
  let root: ReactDOM.Root;

  beforeEach(() => {
    vi.clearAllMocks();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = ReactDOM.createRoot(container);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  test('does not launch browser OAuth when user explicitly cancels native picker', async () => {
    mockPerformNativeGoogleLogin.mockResolvedValueOnce({
      success: false,
      cancelled: true,
      error: 'Google Sign-In cancelled by user',
      isNative: true,
    });

    await act(async () => {
      root.render(<LoginPage onLoginSuccess={vi.fn()} isMandatory={true} />);
    });

    const primaryBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Continue with Google')
    );
    expect(primaryBtn).toBeTruthy();

    await act(async () => {
      primaryBtn!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await new Promise((r) => setTimeout(r, 20));
    });

    // Browser OAuth should NOT have been triggered on user cancellation
    expect(mockSignInWithOAuth).not.toHaveBeenCalled();
    expect(mockOpenOAuthBrowser).not.toHaveBeenCalled();
  });

  test('does not auto-redirect to browser when native picker encounters an error, displays notice', async () => {
    mockPerformNativeGoogleLogin.mockResolvedValueOnce({
      success: false,
      cancelled: false,
      error: '10: Developer error / SHA-1 mismatch',
      isNative: true,
    });

    await act(async () => {
      root.render(<LoginPage onLoginSuccess={vi.fn()} isMandatory={true} />);
    });

    const primaryBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Continue with Google')
    );
    expect(primaryBtn).toBeTruthy();

    await act(async () => {
      primaryBtn!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await new Promise((r) => setTimeout(r, 20));
    });

    // Should NOT automatically open browser or navigate away!
    expect(mockSignInWithOAuth).not.toHaveBeenCalled();
    expect(mockOpenOAuthBrowser).not.toHaveBeenCalled();

    // Should show clear error notice on screen
    const textAfterError = container.textContent || '';
    expect(textAfterError).toContain('10: Developer error / SHA-1 mismatch');
  });

  test('successfully completes login when native picker returns verified profile directly', async () => {
    const onLoginSuccessMock = vi.fn();
    mockPerformNativeGoogleLogin.mockResolvedValueOnce({
      success: true,
      profile: {
        id: 'google_12345',
        email: 'student@example.com',
        name: 'Jagdish Student',
        role: 'student',
        status: 'active',
        createdAt: '2026-11-28T00:00:00.000Z',
      },
      isNative: true,
    });

    await act(async () => {
      root.render(<LoginPage onLoginSuccess={onLoginSuccessMock} isMandatory={true} />);
    });

    const primaryBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Continue with Google')
    );
    expect(primaryBtn).toBeTruthy();

    await act(async () => {
      primaryBtn!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await new Promise((r) => setTimeout(r, 20));
    });

    expect(onLoginSuccessMock).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'student@example.com',
        name: 'Jagdish Student',
        role: 'student',
      })
    );
    expect(mockSignInWithOAuth).not.toHaveBeenCalled();
  });

  test('allows manual browser sign-in when user explicitly clicks the browser alternative button', async () => {
    await act(async () => {
      root.render(<LoginPage onLoginSuccess={vi.fn()} isMandatory={true} />);
    });

    const browserAltBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Sign in via Browser')
    );
    expect(browserAltBtn).toBeTruthy();

    await act(async () => {
      browserAltBtn!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await new Promise((r) => setTimeout(r, 20));
    });

    expect(mockSignInWithOAuth).toHaveBeenCalledTimes(1);
    expect(mockOpenOAuthBrowser).toHaveBeenCalledWith(
      'https://accounts.google.com/o/oauth2/auth?mock=1'
    );
  });
});
