// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  cleanWordForPronunciation,
  isEligibleEnglishWord,
  resolveBestVoice,
  subscribePronunciation,
  stopPronunciation,
  playBritishPronunciation,
  speakEnglishText,
  getCurrentlyPlayingWord,
  clearVoiceCacheForTesting,
} from '../src/services/britishPronunciationService';

describe('English Vocabulary Pronunciation Service', () => {
  let mockVoices: SpeechSynthesisVoice[] = [];
  let speakMock: any;
  let cancelMock: any;
  let resumeMock: any;

  beforeEach(() => {
    mockVoices = [
      { name: 'Google UK English Female', lang: 'en-GB', default: false, localService: true, voiceURI: 'uk-female' } as SpeechSynthesisVoice,
      { name: 'Google US English', lang: 'en-US', default: false, localService: true, voiceURI: 'us-female' } as SpeechSynthesisVoice,
      { name: 'Google हिन्दी', lang: 'hi-IN', default: false, localService: true, voiceURI: 'hi-female' } as SpeechSynthesisVoice,
    ];

    speakMock = vi.fn();
    cancelMock = vi.fn();
    resumeMock = vi.fn();

    // Mock SpeechSynthesisUtterance
    global.SpeechSynthesisUtterance = class {
      text: string;
      lang = '';
      voice: any = null;
      rate = 1;
      pitch = 1;
      onstart: any = null;
      onend: any = null;
      onerror: any = null;
      constructor(text = '') {
        this.text = text;
      }
    } as any;

    // Mock window.speechSynthesis
    Object.defineProperty(window, 'speechSynthesis', {
      writable: true,
      configurable: true,
      value: {
        getVoices: vi.fn(() => mockVoices),
        speak: speakMock,
        cancel: cancelMock,
        resume: resumeMock,
        paused: false,
        speaking: false,
        pending: false,
        onvoiceschanged: null,
      },
    });

    // Mock window.Audio
    global.Audio = class {
      src = '';
      play = vi.fn().mockResolvedValue(undefined);
      pause = vi.fn();
      currentTime = 0;
      onplay: any = null;
      onended: any = null;
      onerror: any = null;
      constructor(src?: string) {
        if (src) this.src = src;
      }
    } as any;
  });

  afterEach(() => {
    stopPronunciation();
    clearVoiceCacheForTesting();
    vi.restoreAllMocks();
  });

  describe('cleanWordForPronunciation', () => {
    it('strips leading and trailing punctuation and quotes', () => {
      expect(cleanWordForPronunciation('"benevolent"')).toBe('benevolent');
      expect(cleanWordForPronunciation('“ephemeral”')).toBe('ephemeral');
      expect(cleanWordForPronunciation('meticulous,')).toBe('meticulous');
      expect(cleanWordForPronunciation('(ubiquitous)')).toBe('ubiquitous');
      expect(cleanWordForPronunciation('diligent...')).toBe('diligent');
    });

    it('returns empty string for falsy input', () => {
      expect(cleanWordForPronunciation('')).toBe('');
      expect(cleanWordForPronunciation('   ')).toBe('');
      expect(cleanWordForPronunciation('...')).toBe('');
    });
  });

  describe('isEligibleEnglishWord', () => {
    it('accepts standard English vocabulary words', () => {
      expect(isEligibleEnglishWord('benevolent')).toBe(true);
      expect(isEligibleEnglishWord('ephemeral')).toBe(true);
      expect(isEligibleEnglishWord('gregarious')).toBe(true);
      expect(isEligibleEnglishWord('ubiquitous')).toBe(true);
    });

    it('accepts hyphenated compound words and words with apostrophes', () => {
      expect(isEligibleEnglishWord('well-known')).toBe(true);
      expect(isEligibleEnglishWord('self-esteem')).toBe(true);
      expect(isEligibleEnglishWord("don't")).toBe(true);
      expect(isEligibleEnglishWord("it's")).toBe(true);
    });

    it('rejects single letters, numbers, and roman numerals', () => {
      expect(isEligibleEnglishWord('a')).toBe(false);
      expect(isEligibleEnglishWord('b')).toBe(false);
      expect(isEligibleEnglishWord('123')).toBe(false);
      expect(isEligibleEnglishWord('ii')).toBe(false);
      expect(isEligibleEnglishWord('iv')).toBe(false);
      expect(isEligibleEnglishWord('xii')).toBe(false);
    });

    it('rejects math symbols, formulas, and code tokens', () => {
      expect(isEligibleEnglishWord('a+b')).toBe(false);
      expect(isEligibleEnglishWord('x=y')).toBe(false);
      expect(isEligibleEnglishWord('\\sqrt')).toBe(false);
    });

    it('rejects non-English scripts (e.g. Hindi Devanagari)', () => {
      expect(isEligibleEnglishWord('समरूपी')).toBe(false);
      expect(isEligibleEnglishWord('भिन्नार्थक')).toBe(false);
      expect(isEligibleEnglishWord('शब्द')).toBe(false);
    });
  });

  describe('resolveBestVoice', () => {
    it('prioritizes British English voices when available', () => {
      const result = resolveBestVoice();
      expect(result.voice).toBeDefined();
      expect(result.voice?.name).toBe('Google UK English Female');
      expect(result.isBritish).toBe(true);
      expect(result.lang).toBe('en-GB');
    });

    it('falls back to Indian English or standard English when no UK voice is installed', () => {
      // Device with only Indian English and US English installed
      mockVoices = [
        { name: 'Google हिन्दी', lang: 'hi-IN', default: false } as SpeechSynthesisVoice,
        { name: 'English India', lang: 'en-IN', default: false } as SpeechSynthesisVoice,
        { name: 'English United States', lang: 'en-US', default: false } as SpeechSynthesisVoice,
      ];
      window.speechSynthesis.getVoices = vi.fn(() => mockVoices);

      const result = resolveBestVoice();
      expect(result.voice).toBeDefined();
      expect(result.voice?.lang).toBe('en-IN');
      expect(result.isBritish).toBe(false);
    });

    it('gracefully handles empty voices list before dynamic loading', () => {
      window.speechSynthesis.getVoices = vi.fn(() => []);
      const result = resolveBestVoice();
      // Even if voice object is not yet populated, lang is en-GB for Android TTS engine
      expect(result.lang).toBe('en-GB');
    });
  });

  describe('playBritishPronunciation', () => {
    it('speaks the word using SpeechSynthesis and notifies listeners', () => {
      let playingState: string | null = null;
      const unsubscribe = subscribePronunciation((word) => {
        playingState = word;
      });

      playBritishPronunciation('benevolent');

      expect(speakMock).toHaveBeenCalledTimes(1);
      const utterance = speakMock.mock.calls[0][0];
      expect(utterance.text).toBe('benevolent');
      expect(utterance.lang).toBe('en-GB');
      expect(utterance.rate).toBe(0.90);

      // Trigger utterance.onstart
      utterance.onstart();
      expect(getCurrentlyPlayingWord()).toBe('benevolent');
      expect(playingState).toBe('benevolent');

      // Trigger utterance.onend
      utterance.onend();
      expect(getCurrentlyPlayingWord()).toBeNull();
      expect(playingState).toBeNull();

      unsubscribe();
    });

    it('resumes paused SpeechSynthesis if stuck on Android', () => {
      window.speechSynthesis.paused = true;
      playBritishPronunciation('ephemeral');
      expect(resumeMock).toHaveBeenCalled();
    });

    it('stops previous speech when a new word is requested', () => {
      playBritishPronunciation('gregarious');
      playBritishPronunciation('meticulous');
      expect(cancelMock).toHaveBeenCalled();
    });

    it('does not speak invalid or non-English tokens', () => {
      playBritishPronunciation('123');
      playBritishPronunciation('समरूपी');
      expect(speakMock).not.toHaveBeenCalled();
    });
  });

  describe('speakEnglishText', () => {
    it('cleans markdown symbols and speaks full question in English', () => {
      speakEnglishText('**Choose** the correct synonym for *benevolent*:');
      expect(speakMock).toHaveBeenCalledTimes(1);
      const utterance = speakMock.mock.calls[0][0];
      expect(utterance.text).toBe('Choose the correct synonym for benevolent:');
      expect(utterance.lang).toBe('en-GB');
    });
  });
});
