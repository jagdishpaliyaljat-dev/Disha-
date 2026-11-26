// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import {
  isSubjectRecommendedForExam,
  sortSubjectsByTargetExam,
} from '../src/utils/examPersonalization';
import fs from 'node:fs';
import path from 'node:path';

describe('Task 4: Typography, Target Exam Personalization & A11y', () => {
  describe('Typography Font Loading in index.html', () => {
    it('loads 400 regular weight for Mukta and Plus Jakarta Sans in index.html', () => {
      const indexPath = path.resolve(import.meta.dirname, '../index.html');
      const html = fs.readFileSync(indexPath, 'utf8');

      expect(html).toContain('Mukta:wght@400;');
      expect(html).toContain('Plus+Jakarta+Sans:wght@400;');
    });
  });

  describe('Target Exam Subject Personalization', () => {
    it('identifies subjects relevant to the student target exam', () => {
      expect(isSubjectRecommendedForExam('राजस्थान का इतिहास एवं संस्कृति', 'RPSC RAS Pre')).toBe(true);
      expect(isSubjectRecommendedForExam('शिक्षण विधियां एवं बाल विकास', 'REET Level 1 & 2')).toBe(true);
      expect(isSubjectRecommendedForExam('कंप्यूटर एवं सूचना प्रौद्योगिकी', 'CET Graduate Level')).toBe(true);
      expect(isSubjectRecommendedForExam('Random Unrelated Topic', 'REET')).toBe(false);
    });

    it('prioritizes recommended subjects to the top of the curriculum list', () => {
      const mockSubjects: any[] = [
        { id: 'sub-general', name: 'सामान्य सामान्य ज्ञान' },
        { id: 'sub-reet-cdp', name: 'शिक्षण विधियां (Pedagogy)' },
        { id: 'sub-misc', name: 'अन्य विविध' },
      ];

      const sorted = sortSubjectsByTargetExam(mockSubjects, 'REET Level 2');
      expect(sorted[0].id).toBe('sub-reet-cdp');
    });
  });

  describe('Modal Keyboard Focus Trapping (A11y)', () => {
    it('AppModal source code contains keyboard focus trap handler for Tab / Shift+Tab', () => {
      const modalPath = path.resolve(import.meta.dirname, '../src/components/ui/AppModal.tsx');
      const modalCode = fs.readFileSync(modalPath, 'utf8');

      expect(modalCode).toContain('focusTrap');
      expect(modalCode).toContain('shiftKey');
    });
  });
});
