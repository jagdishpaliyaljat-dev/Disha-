// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  safeGetSessionStorageItem,
  safeSetSessionStorageItem,
  safeRemoveSessionStorageItem,
  safeClearSessionStorage,
  safeGetLocalStorageItem,
  safeSetLocalStorageItem,
  safeRemoveLocalStorageItem,
  safeClearLocalStorage,
} from '../src/utils/safeStorage';
import {
  getCombinedChapters,
  getCombinedQuestions,
  getCombinedSubjects,
  getCombinedChaptersMap,
  getCombinedQuestionsMap,
} from '../src/utils/questionsStorage';
import type { UserQuestionsStore } from '../src/types';

describe('Root Cause Fix & In-App WebView Resilience Suite', () => {
  beforeEach(() => {
    safeClearSessionStorage();
    safeClearLocalStorage();
  });

  describe('Layer 1: Restricted In-App WebView Storage Immunity (Instagram / Facebook)', () => {
    it('gracefully handles SecurityError when sessionStorage property is denied', () => {
      // Simulate restricted webview where sessionStorage throws SecurityError
      const originalSessionStorage = window.sessionStorage;
      Object.defineProperty(window, 'sessionStorage', {
        configurable: true,
        get() {
          throw new DOMException('The operation is insecure.', 'SecurityError');
        },
      });

      // Writes should NOT throw and fallback to in-memory store
      expect(() => safeSetSessionStorageItem('test_key', 'test_value')).not.toThrow();
      expect(safeGetSessionStorageItem('test_key')).toBe('test_value');

      // Removal should NOT throw
      expect(() => safeRemoveSessionStorageItem('test_key')).not.toThrow();
      expect(safeGetSessionStorageItem('test_key')).toBeNull();

      // Restore
      Object.defineProperty(window, 'sessionStorage', {
        configurable: true,
        value: originalSessionStorage,
      });
    });

    it('gracefully handles QuotaExceededError or SecurityError on localStorage', () => {
      const originalLocalStorage = window.localStorage;
      Object.defineProperty(window, 'localStorage', {
        configurable: true,
        get() {
          throw new DOMException('Access is denied for this document.', 'SecurityError');
        },
      });

      expect(() => safeSetLocalStorageItem('pref_key', 'dark')).not.toThrow();
      expect(safeGetLocalStorageItem('pref_key')).toBe('dark');
      expect(() => safeRemoveLocalStorageItem('pref_key')).not.toThrow();
      expect(safeGetLocalStorageItem('pref_key')).toBeNull();

      Object.defineProperty(window, 'localStorage', {
        configurable: true,
        value: originalLocalStorage,
      });
    });
  });

  describe('Layer 2: Defensive Curriculum Assembly with Corrupt Data', () => {
    it('getCombinedChapters never throws on null, undefined, or malformed store data', () => {
      const corruptStores: any[] = [
        null,
        undefined,
        {},
        { customChapters: null, deletedQuestionIds: null },
        { customChapters: [{ id: 'ch-1', title: 'Chapter 1', topics: null }] },
        { customChapters: [{ id: 'ch-2', topics: [{ id: 'top-1', questions: null }] }] },
      ];

      for (const store of corruptStores) {
        expect(() => {
          const chapters = getCombinedChapters(store as UserQuestionsStore);
          expect(Array.isArray(chapters)).toBe(true);
        }).not.toThrow();
      }
    });

    it('getCombinedQuestions never throws on malformed chapters or store', () => {
      const corruptChapters: any[] = [
        null,
        undefined,
        [{ id: 'c1', topics: null }],
        [{ id: 'c2', topics: [{ id: 't1', questions: null }] }],
        [{ id: 'c3', topics: [{ id: 't2', questions: [null, undefined, {}] }] }],
      ];

      for (const chaps of corruptChapters) {
        expect(() => {
          const qs = getCombinedQuestions(chaps as any);
          expect(Array.isArray(qs)).toBe(true);
        }).not.toThrow();
      }
    });

    it('getCombinedSubjects never throws and always returns valid array', () => {
      const corruptStore: any = {
        customSubjects: 'invalid-string-instead-of-array',
        deletedSubjectIds: null,
        editedSubjects: null,
      };

      expect(() => {
        const subs = getCombinedSubjects(corruptStore as UserQuestionsStore);
        expect(Array.isArray(subs)).toBe(true);
      }).not.toThrow();
    });

    it('getCombinedChaptersMap and getCombinedQuestionsMap return safe Record dictionaries', () => {
      const chaptersMap = getCombinedChaptersMap(null as any);
      expect(typeof chaptersMap).toBe('object');
      expect(chaptersMap).not.toBeNull();

      const questionsMap = getCombinedQuestionsMap(null as any);
      expect(typeof questionsMap).toBe('object');
      expect(questionsMap).not.toBeNull();
    });
  });

  describe('Layer 3: Self-Healing Error Recovery Hooks', () => {
    it('sets and retrieves reload lock safely', () => {
      const RELOAD_KEY = 'disha_chunk_reload_lock';
      const now = Date.now();
      safeSetSessionStorageItem(RELOAD_KEY, String(now));
      expect(safeGetSessionStorageItem(RELOAD_KEY)).toBe(String(now));
    });
  });
});
