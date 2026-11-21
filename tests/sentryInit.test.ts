import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  initSentry,
  setSentryUser,
  clearSentryUser,
  captureSentryError,
  addSentryBreadcrumb,
} from '../src/utils/sentryInit';

describe('sentryInit utility', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('runs initSentry without throwing when DSN is undefined in non-prod', () => {
    expect(() => initSentry()).not.toThrow();
  });

  it('safely handles setSentryUser and clearSentryUser calls', () => {
    expect(() => setSentryUser('test-user-123')).not.toThrow();
    expect(() => clearSentryUser()).not.toThrow();
  });

  it('safely handles captureSentryError with and without context', () => {
    const error = new Error('Test runtime error');
    expect(() => captureSentryError(error)).not.toThrow();
    expect(() => captureSentryError(error, { component: 'TestComponent' })).not.toThrow();
  });

  it('safely handles addSentryBreadcrumb', () => {
    expect(() => addSentryBreadcrumb('User tapped live test', 'ui.click')).not.toThrow();
  });
});
