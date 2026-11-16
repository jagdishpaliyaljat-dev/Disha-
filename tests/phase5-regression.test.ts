import { describe, test, expect, beforeEach } from 'vitest';
import { parseRawMcqText, parseAnswer } from '../src/utils/questionParser';
import { saveTopicToSupabase } from '../src/utils/supabaseSyncService';
import { saveChapterToSupabase } from '../src/utils/supabaseSyncService';
import { Topic, Chapter } from '../src/types';

describe('Phase 5 Regression & Verification Suite', () => {

  describe('Issue 2: 5-Option MCQ Parser & RPSC Option E Compliance', () => {
    test('P5-C1: Exactly matches QATestRunnerModal sample with 5 options & math formulas', () => {
      const sample = `Q1. यदि \\frac{d}{dx}[f(x)] = 4x^3 - \\frac{3}{x^4} हो तो f(x) ज्ञात कीजिए।
(A) x^4 + \\frac{1}{x^3} + C
(B) x^3 + \\frac{1}{x^4} + C
(C) x^4 - \\frac{1}{x^3} + C
(D) x^3 - \\frac{1}{x^4} + C
(E) अनुत्तरित प्रश्न (Question not attempted)
Answer: A
Explanation: समाकलन करने पर: $\\int (4x^3 - 3x^{-4}) dx = x^4 + x^{-3} + C$`;

      const result = parseRawMcqText(sample);
      expect(result.questions.length).toBe(1);

      const q = result.questions[0];
      expect(q.options.length).toBe(5);
      expect(q.options[0]).toContain('x⁴ +');
      expect(q.options[1]).toContain('x³ +');
      expect(q.options[2]).toContain('x⁴ -');
      expect(q.options[3]).toContain('x³ -');
      expect(q.options[4]).toContain('अनुत्तरित प्रश्न (Question not attempted)');
      expect(q.correctIndex).toBe(0);
      expect(q.answer).toBe('A');
      expect(q.explanation).toContain('समाकलन करने पर');
    });

    test('P5-C2: Correctly maps Option E (index 4) when Option E is the correct answer', () => {
      const sample = `Q. निम्न में से कौन सा विकल्प सही नहीं है?
(A) पहला विकल्प
(B) दूसरा विकल्प
(C) तीसरा विकल्प
(D) चौथा विकल्प
(E) अनुत्तरित प्रश्न
Answer: E
Explanation: अभ्यर्थी ने कोई उत्तर नहीं दिया।`;

      const result = parseRawMcqText(sample);
      expect(result.questions.length).toBe(1);
      const q = result.questions[0];
      expect(q.options.length).toBe(5);
      expect(q.correctIndex).toBe(4);
      expect(q.answer).toBe('E');
    });

    test('P5-C3: Hindi markers (क, ख, ग, घ, ङ) and answer mapping', () => {
      const sample = `प्रश्न. भारत का राष्ट्रीय पशु कौन सा है?
(क) शेर
(ख) बाघ
(ग) हाथी
(घ) चीता
(ङ) अनुत्तरित प्रश्न
उत्तर: (ख)
व्याख्या: रॉयल बंगाल टाइगर भारत का राष्ट्रीय पशु है।`;

      const result = parseRawMcqText(sample);
      expect(result.questions.length).toBe(1);
      const q = result.questions[0];
      expect(q.options.length).toBe(5);
      expect(q.options[0]).toBe('शेर');
      expect(q.options[1]).toBe('बाघ');
      expect(q.options[2]).toBe('हाथी');
      expect(q.options[3]).toBe('चीता');
      expect(q.options[4]).toBe('अनुत्तरित प्रश्न');
      expect(q.correctIndex).toBe(1);
    });

    test('P5-C4: Numeric markers (1, 2, 3, 4, 5) with answer 5 (index 4)', () => {
      const sample = `Q. What is 10 / 2?
(1) 2
(2) 3
(3) 4
(4) 5
(5) Unattempted
Answer: 4
Explanation: 10 / 2 = 5`;

      const result = parseRawMcqText(sample);
      expect(result.questions.length).toBe(1);
      const q = result.questions[0];
      expect(q.options.length).toBe(5);
      expect(q.correctIndex).toBe(3); // (4) maps to index 3
    });

    test('P5-C5: Chemistry symbols, subscripts and reactions preserved with 5 options', () => {
      const chemSample = `Q1. FeSO_4 + 2NaOH -> Fe(OH)_2 + Na_2SO_4 अभिक्रिया में अवक्षेप क्या है?
(A) Fe(OH)_2
(B) Fe_2O_3
(C) FeO
(D) NaOH
(E) अनुत्तरित प्रश्न
Answer: A
Explanation: Fe(OH)_2 का हरा अवक्षेप बनता है।`;

      const result = parseRawMcqText(chemSample);
      expect(result.questions.length).toBe(1);
      const q = result.questions[0];
      expect(q.options.length).toBe(5);
      expect(q.options[0]).toBe('Fe(OH)₂');
      expect(q.options[4]).toBe('अनुत्तरित प्रश्न');
      expect(q.correctIndex).toBe(0);
    });

    test('P5-C6: Rejects incomplete MCQs with clear validation errors instead of silent corruption', () => {
      const brokenSample = `Q. Broken question without options
Answer: A
Explanation: Missing all options.`;

      const result = parseRawMcqText(brokenSample);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].reason).toContain('Options nahi mile');
    });

    test('P5-C7: Inline 5 options parsing (a) x (b) y (c) z (d) w (e) v', () => {
      const inlineSample = `Q. Match values: (A) Alpha (B) Beta (C) Gamma (D) Delta (E) Epsilon
Answer: C
Explanation: Gamma is the 3rd Greek letter.`;

      const result = parseRawMcqText(inlineSample);
      expect(result.questions.length).toBe(1);
      const q = result.questions[0];
      expect(q.options.length).toBe(5);
      expect(q.options[4]).toBe('Epsilon');
      expect(q.correctIndex).toBe(2);
    });
  });

  describe('Issue 1: Syllabus Topic Subject ID Auto-Resolution', () => {
    test('P5-D1: saveTopicToSupabase resolves subject_id from parent chapter when subjectId is omitted', async () => {
      const { saveUserQuestionsStore, loadUserQuestionsStore } = await import('../src/utils/questionsStorage');
      const { supabase } = await import('../src/lib/supabase');

      const parentChapter: Chapter = {
        id: 'p5-test-chap-001',
        subjectId: 'p5-test-subj-001',
        title: 'Parent Chapter',
        hindiTitle: 'मूल अध्याय',
        number: 1,
        topics: []
      };

      const currentStore = loadUserQuestionsStore();
      saveUserQuestionsStore({
        ...currentStore,
        customChapters: [...(currentStore.customChapters || []), parentChapter]
      });

      let capturedPayload: any = null;
      const originalFrom = supabase.from;
      // @ts-ignore
      supabase.from = (table: string) => {
        if (table === 'topics') {
          return {
            upsert: (payload: any) => {
              capturedPayload = payload;
              return Promise.resolve({ error: null });
            }
          } as any;
        }
        return originalFrom.call(supabase, table);
      };

      try {
        const topicWithoutSubjectId: Topic = {
          id: 'p5-test-top-001',
          chapterId: 'p5-test-chap-001',
          // subjectId is intentionally missing
          title: 'Child Topic',
          hindiTitle: 'उप-विषय',
          number: 1,
          questions: []
        };

        const res = await saveTopicToSupabase(topicWithoutSubjectId);
        expect(res.success).toBe(true);
        expect(capturedPayload).toBeDefined();
        expect(capturedPayload.subject_id).toBe('p5-test-subj-001');
        expect(capturedPayload.chapter_id).toBe('p5-test-chap-001');
      } finally {
        supabase.from = originalFrom;
      }
    });
  });
});
