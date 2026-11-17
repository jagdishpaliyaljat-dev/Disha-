import { describe, expect, test } from 'vitest';
import { normalizePayload, readPayload } from '../scripts/lib/seedCurriculum.mjs';

describe('seed curriculum payload normalization', () => {
  test('handles the pilot shape and preserves column names', () => {
    const plan = normalizePayload({
      subject: { id: 'sub_x', name: 'History', order_index: 1 },
      chapters: [{ id: 'ch_1', subject_id: 'sub_x', name: 'Ch 1', order_index: 2 }],
      topics: [{ id: 'tp_1', subject_id: 'sub_x', chapter_id: 'ch_1', name: 'Tp 1' }],
      questions: [
        {
          id: 'q_1',
          subject_id: 'sub_x',
          question: 'Q?',
          options: ['a', 'b'],
          correct_answer: 1,
        },
      ],
    });

    const tables = Object.fromEntries(plan);
    expect(tables.subjects).toHaveLength(1);
    expect(tables.chapters[0]).toMatchObject({ subject_id: 'sub_x', order_index: 2 });
    expect(tables.topics[0]).toMatchObject({ chapter_id: 'ch_1' });
    expect(tables.questions[0]).toMatchObject({
      question: 'Q?',
      correct_answer: 1,
      options: ['a', 'b'],
      level: 'medium',
    });
  });

  test('handles the legacy camelCase shape', () => {
    const plan = normalizePayload({
      subjects: [{ id: 's1', name: 'Polity', order: 3 }],
      chapters: [{ id: 'c1', subjectId: 's1', title: 'Union', number: 1 }],
      topics: [{ id: 't1', subjectId: 's1', chapterId: 'c1', title: 'President' }],
      mcqs: [
        {
          id: 'm1',
          subjectId: 's1',
          chapterId: 'c1',
          topicId: 't1',
          text: 'Who?',
          options: ['A', 'B'],
          correctIndex: 0,
          data: { year: 2023 },
        },
      ],
    });

    const tables = Object.fromEntries(plan);
    expect(tables.subjects[0]).toMatchObject({
      id: 's1',
      hindi_name: 'Polity',
      order_index: 3,
    });
    expect(tables.chapters[0]).toMatchObject({ subject_id: 's1', name: 'Union' });
    expect(tables.topics[0]).toMatchObject({ chapter_id: 'c1', name: 'President' });
    expect(tables.questions[0]).toMatchObject({
      question: 'Who?',
      correct_answer: 0,
      year: '2023',
    });
  });

  test('readPayload fails loudly for a missing file', () => {
    expect(() => readPayload('/definitely/missing/seed.json')).toThrow(/not found/i);
  });
});
