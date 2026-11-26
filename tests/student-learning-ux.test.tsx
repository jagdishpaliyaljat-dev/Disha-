// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleSwipeGesture } from '../src/utils/swipeNavigation';
import { speakHindiQuestion, stopHindiSpeech, isHindiSpeechSupported } from '../src/utils/hindiSpeechReader';
import fs from 'node:fs';
import path from 'node:path';

describe('Task 2: Student Learning UX', () => {
  describe('Touch Swipe Navigation', () => {
    it('triggers onSwipeLeft when swiping left horizontally beyond threshold', () => {
      const onSwipeLeft = vi.fn();
      const onSwipeRight = vi.fn();

      const result = handleSwipeGesture({
        startX: 250,
        startY: 300,
        endX: 120, // deltaX = -130
        endY: 310, // deltaY = 10
        onSwipeLeft,
        onSwipeRight,
      });

      expect(result).toBe('left');
      expect(onSwipeLeft).toHaveBeenCalledTimes(1);
      expect(onSwipeRight).not.toHaveBeenCalled();
    });

    it('triggers onSwipeRight when swiping right horizontally beyond threshold', () => {
      const onSwipeLeft = vi.fn();
      const onSwipeRight = vi.fn();

      const result = handleSwipeGesture({
        startX: 100,
        startY: 300,
        endX: 240, // deltaX = +140
        endY: 295, // deltaY = -5
        onSwipeLeft,
        onSwipeRight,
      });

      expect(result).toBe('right');
      expect(onSwipeRight).toHaveBeenCalledTimes(1);
      expect(onSwipeLeft).not.toHaveBeenCalled();
    });

    it('ignores vertical scrolls where deltaY exceeds deltaX', () => {
      const onSwipeLeft = vi.fn();
      const onSwipeRight = vi.fn();

      const result = handleSwipeGesture({
        startX: 200,
        startY: 200,
        endX: 180, // deltaX = -20
        endY: 350, // deltaY = 150 (vertical scroll)
        onSwipeLeft,
        onSwipeRight,
      });

      expect(result).toBe(null);
      expect(onSwipeLeft).not.toHaveBeenCalled();
      expect(onSwipeRight).not.toHaveBeenCalled();
    });

    it('ignores micro taps or small gestures below threshold', () => {
      const onSwipeLeft = vi.fn();
      const onSwipeRight = vi.fn();

      const result = handleSwipeGesture({
        startX: 200,
        startY: 200,
        endX: 215, // deltaX = +15 (< 50)
        endY: 205,
        onSwipeLeft,
        onSwipeRight,
      });

      expect(result).toBe(null);
      expect(onSwipeLeft).not.toHaveBeenCalled();
      expect(onSwipeRight).not.toHaveBeenCalled();
    });
  });

  describe('Hindi Text-to-Speech (Audio Reader)', () => {
    let mockSpeak: any;
    let mockCancel: any;

    beforeEach(() => {
      mockSpeak = vi.fn();
      mockCancel = vi.fn();
      window.speechSynthesis = {
        speak: mockSpeak,
        cancel: mockCancel,
        speaking: false,
        paused: false,
        pending: false,
        getVoices: vi.fn().mockReturnValue([]),
      } as any;

      (window as any).SpeechSynthesisUtterance = class MockUtterance {
        text: string;
        lang: string = '';
        rate: number = 1;
        pitch: number = 1;
        voice: any = null;
        onend?: () => void;
        onerror?: (e: any) => void;
        constructor(text: string) {
          this.text = text;
        }
      };
    });

    it('cleans markdown and prepares SpeechSynthesisUtterance with hi-IN language', () => {
      expect(isHindiSpeechSupported()).toBe(true);

      const utterance = speakHindiQuestion({
        questionText: 'राजस्थान की **राजधानी** कौन सी है?',
        options: ['जयपुर', 'जोधपुर', 'उदयपुर', 'बीकानेर'],
      });

      expect(mockCancel).toHaveBeenCalled();
      expect(mockSpeak).toHaveBeenCalledTimes(1);
      expect(utterance).toBeDefined();
      expect(utterance?.lang).toBe('hi-IN');
      expect(utterance?.text).toContain('राजस्थान की राजधानी कौन सी है?');
      expect(utterance?.text).toContain('विकल्प 1: जयपुर');
    });

    it('cancels speech cleanly on stopHindiSpeech', () => {
      stopHindiSpeech();
      expect(mockCancel).toHaveBeenCalled();
    });
  });

  describe('Bookmarks Hub Visibility in Source', () => {
    it('WrongTab.tsx contains prominent segmented toggle for Bookmarked questions', () => {
      const wrongPath = path.resolve(import.meta.dirname, '../src/components/WrongTab.tsx');
      const content = fs.readFileSync(wrongPath, 'utf8');
      expect(content).toContain('बुकमार्क');
      expect(content).toContain('activeFilter');
    });

    it('MCQSessionModal.tsx wires touch handlers and speakHindiQuestion', () => {
      const mcqPath = path.resolve(import.meta.dirname, '../src/components/MCQSessionModal.tsx');
      const content = fs.readFileSync(mcqPath, 'utf8');
      expect(content).toContain('handleSwipeGesture');
      expect(content).toContain('speakHindiQuestion');
    });
  });
});
