// @vitest-environment jsdom
import React, { act } from 'react';
import ReactDOM from 'react-dom/client';
import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

let deepLinkCallback: ((session: any) => void) | null = null;

const { mockSignInWithOAuth, mockOpenOAuthBrowser } = vi.hoisted(() => ({
  mockSignInWithOAuth: vi.fn(async () => ({
    data: { url: 'https://eaidivceejkdqsshlraj.supabase.co/auth/v1/authorize?provider=google&redirect_to=com.rajexam.prep%3A%2F%2Fauth-callback' },
    error: null,
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
  registerMobileDeepLinkListener: (cb: (session: any) => void) => {
    deepLinkCallback = cb;
    return () => {
      deepLinkCallback = null;
    };
  },
}));

import { LoginPage } from '../src/components/LoginPage';

describe('LoginPage Google Sign-In Flow', () => {
  let container: HTMLDivElement;
  let root: ReactDOM.Root;

  beforeEach(() => {
    vi.clearAllMocks();
    deepLinkCallback = null;
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

  test('clicking "Continue with Google" triggers Supabase OAuth with custom scheme redirect and opens browser', async () => {
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

    // Supabase OAuth should have been called with custom scheme redirect
    expect(mockSignInWithOAuth).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: 'google',
        options: expect.objectContaining({
          redirectTo: 'com.rajexam.prep://auth-callback',
        }),
      })
    );

    // openOAuthBrowser should have been called with the authorization URL
    expect(mockOpenOAuthBrowser).toHaveBeenCalledWith(
      'https://eaidivceejkdqsshlraj.supabase.co/auth/v1/authorize?provider=google&redirect_to=com.rajexam.prep%3A%2F%2Fauth-callback'
    );
  });

  test('completes login when mobile deep link callback receives authenticated session', async () => {
    const onLoginSuccessMock = vi.fn();
    await act(async () => {
      root.render(<LoginPage onLoginSuccess={onLoginSuccessMock} isMandatory={true} />);
    });

    expect(deepLinkCallback).toBeTruthy();

    // Simulate incoming deep link callback from Android appUrlOpen
    await act(async () => {
      if (deepLinkCallback) {
        await deepLinkCallback({
          user: {
            id: 'google-user-999',
            email: 'jagdishpaliyaljat@gmail.com',
            user_metadata: {
              full_name: 'JAGDISH CHOUDHARY',
            },
            created_at: '2026-11-28T12:00:00.000Z',
          },
          access_token: 'valid_mock_access_token',
          refresh_token: 'valid_mock_refresh_token',
        });
      }
      await new Promise((r) => setTimeout(r, 200));
    });

    expect(onLoginSuccessMock).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'jagdishpaliyaljat@gmail.com',
        name: 'JAGDISH CHOUDHARY',
      })
    );
  });
});
