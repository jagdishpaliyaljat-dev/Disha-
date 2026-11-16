import { describe, test, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Pilot Curriculum Import Readiness & Validation Suite', () => {
  const pilotDataPath = path.resolve(process.cwd(), 'pilots/sample_pilot_import.json');
  const pilotData = JSON.parse(fs.readFileSync(pilotDataPath, 'utf8'));

  test('PILOT-01: Scope validation matches exactly 1 Subject, 2 Chapters, 4 Topics, 10 MCQs', () => {
    expect(pilotData.subject).toBeDefined();
    expect(pilotData.subject.id).toBe('sub_raj_hist');

    expect(Array.isArray(pilotData.chapters)).toBe(true);
    expect(pilotData.chapters.length).toBe(2);

    expect(Array.isArray(pilotData.topics)).toBe(true);
    expect(pilotData.topics.length).toBe(4);

    expect(Array.isArray(pilotData.questions)).toBe(true);
    expect(pilotData.questions.length).toBe(10);
  });

  test('PILOT-02: Parent-Child referential integrity is 100% valid', () => {
    const subjectId = pilotData.subject.id;
    const chapterIds = new Set(pilotData.chapters.map((c: any) => c.id));
    const topicIds = new Set(pilotData.topics.map((t: any) => t.id));

    // Verify Chapters reference valid Subject
    for (const chap of pilotData.chapters) {
      expect(chap.subject_id).toBe(subjectId);
      expect(chap.name.length).toBeGreaterThan(0);
      expect(chap.hindi_name.length).toBeGreaterThan(0);
    }

    // Verify Topics reference valid Chapter and Subject
    for (const topic of pilotData.topics) {
      expect(topic.subject_id).toBe(subjectId);
      expect(chapterIds.has(topic.chapter_id)).toBe(true);
      expect(topic.name.length).toBeGreaterThan(0);
      expect(topic.hindi_name.length).toBeGreaterThan(0);
    }

    // Verify Questions reference valid Subject, Chapter, and Topic
    for (const q of pilotData.questions) {
      expect(q.subject_id).toBe(subjectId);
      expect(chapterIds.has(q.chapter_id)).toBe(true);
      expect(topicIds.has(q.topic_id)).toBe(true);
    }
  });

  test('PILOT-03: Question options, answers, and RPSC 5th Option compliance', () => {
    for (const q of pilotData.questions) {
      expect(typeof q.question).toBe('string');
      expect(q.question.trim().length).toBeGreaterThan(10);

      expect(Array.isArray(q.options)).toBe(true);
      expect([4, 5]).toContain(q.options.length);

      // Verify correct_answer index bounds
      expect(typeof q.correct_answer).toBe('number');
      expect(q.correct_answer).toBeGreaterThanOrEqual(0);
      expect(q.correct_answer).toBeLessThan(q.options.length);

      // Verify explanation exists
      expect(typeof q.explanation).toBe('string');
      expect(q.explanation.length).toBeGreaterThan(10);

      // If 5 options, Option E must be unattempted option
      if (q.options.length === 5) {
        expect(q.options[4]).toContain('अनुत्तरित प्रश्न');
      }
    }
  });

  test('PILOT-04: Duplicate prevention & unique ID validation', () => {
    const questionIds = new Set<string>();
    const questionTexts = new Set<string>();

    for (const q of pilotData.questions) {
      expect(questionIds.has(q.id)).toBe(false);
      questionIds.add(q.id);

      const normalizedText = q.question.trim().toLowerCase();
      expect(questionTexts.has(normalizedText)).toBe(false);
      questionTexts.add(normalizedText);
    }
  });

  test('PILOT-05: Student quiz attempt & scoring calculation verification', () => {
    // Simulate student attempting 10 questions:
    // 7 correct, 2 incorrect (-0.66 penalty), 1 unattempted shaded Option E (0 penalty)
    const simulatedAnswers: Record<number, number> = {
      0: pilotData.questions[0].correct_answer, // correct (+1)
      1: pilotData.questions[1].correct_answer, // correct (+1)
      2: pilotData.questions[2].correct_answer, // correct (+1)
      3: pilotData.questions[3].correct_answer, // correct (+1)
      4: pilotData.questions[4].correct_answer, // correct (+1)
      5: pilotData.questions[5].correct_answer, // correct (+1)
      6: pilotData.questions[6].correct_answer, // correct (+1)
      7: (pilotData.questions[7].correct_answer + 1) % 4, // incorrect (-0.33)
      8: (pilotData.questions[8].correct_answer + 1) % 4, // incorrect (-0.33)
      9: 4 // Option E shaded (0 penalty)
    };

    let score = 0;
    let correctCount = 0;
    let wrongCount = 0;
    let neutralCount = 0;

    pilotData.questions.forEach((q: any, idx: number) => {
      const selected = simulatedAnswers[idx];
      if (selected === q.correct_answer) {
        score += 1.0;
        correctCount++;
      } else if (selected === 4 && q.options.length === 5) {
        neutralCount++;
      } else {
        score -= 0.33;
        wrongCount++;
      }
    });

    expect(correctCount).toBe(7);
    expect(wrongCount).toBe(2);
    expect(neutralCount).toBe(1);
    expect(Math.round(score * 100) / 100).toBe(6.34);
  });
});
