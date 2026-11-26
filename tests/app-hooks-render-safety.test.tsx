// @vitest-environment jsdom
import React, { act } from 'react';
import ReactDOM from 'react-dom/client';
import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { saveUserProfile, DEFAULT_USER_PROFILE } from '../src/utils/userProfileStorage';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

// Prevent live Supabase WebSocket/network handles in jsdom UI render tests
vi.mock('../src/lib/supabase', () => {
  const noopSub = { unsubscribe: vi.fn() };
  const chain: any = {
    select: () => chain,
    eq: () => chain,
    neq: () => chain,
    in: () => chain,
    order: () => chain,
    limit: () => chain,
    maybeSingle: async () => ({ data: null, error: null }),
    single: async () => ({ data: null, error: null }),
    then: (resolve: any) => resolve({ data: [], error: null }),
  };
  return {
    isSupabaseConfigured: () => false,
    SUPABASE_URL: 'https://example.supabase.co',
    SUPABASE_ANON_KEY: 'anon',
    supabase: {
      auth: {
        getSession: async () => ({ data: { session: null }, error: null }),
        onAuthStateChange: () => ({ data: { subscription: noopSub } }),
      },
      from: () => chain,
      channel: () => ({
        on: function () { return this; },
        subscribe: () => ({ unsubscribe: vi.fn() }),
        track: async () => 'ok',
        presenceState: () => ({}),
      }),
      removeChannel: vi.fn(),
    },
  };
});

// Minimal DOM shims for jsdom boot
if (typeof window !== 'undefined' && !window.matchMedia) {
  (window as any).matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
}
if (typeof globalThis.ResizeObserver === 'undefined') {
  (globalThis as any).ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}
if (typeof window !== 'undefined' && !window.scrollTo) {
  window.scrollTo = vi.fn();
}

import App from '../src/App';
import { Disha2020Provider } from '../src/context/Disha2020Provider';
import { AppErrorBoundary } from '../src/components/AppErrorBoundary';

describe('Root App Render & Hooks Order Safety', () => {
  let container: HTMLDivElement;
  let root: ReactDOM.Root;

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    saveUserProfile({
      ...DEFAULT_USER_PROFILE,
      id: 'user-render-safety-1',
      name: 'Test Aspirant',
      email: 'aspirant@example.com',
      role: 'student',
    });
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

  test('renders authenticated App across isAuthReady transition without violating Rules of Hooks', async () => {
    const consoleErrors: string[] = [];
    const origError = console.error;
    console.error = (...args: any[]) => {
      consoleErrors.push(args.map(String).join(' '));
      origError(...args);
    };

    try {
      await act(async () => {
        root.render(
          <AppErrorBoundary>
            <Disha2020Provider>
              <App />
            </Disha2020Provider>
          </AppErrorBoundary>
        );
      });

      for (let i = 0; i < 6; i++) {
        await act(async () => {
          await new Promise((r) => setTimeout(r, 50));
        });
      }

      const text = container.textContent || '';
      expect(text).not.toContain('System Auto-Repair');
      expect(consoleErrors.join('\n')).not.toMatch(/Rendered more hooks than during the previous render/i);
    } finally {
      console.error = origError;
    }
  }, 15000);
});
