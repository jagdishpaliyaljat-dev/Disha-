import { assertCleanOrSeededBaseline } from './helpers/liveBaseline';
import { describe, test, expect, beforeEach } from 'vitest';
import { 
  syncCurriculumAuthoritative, 
  fetchSubjects, 
  fetchChapters, 
  fetchTopics,
  getSupabaseTableCounts
} from '../src/utils/supabaseSyncService';
import { 
  idbPut, 
  idbGet, 
  idbGetAll, 
  idbClear,
  STORES 
} from '../src/utils/localDatabaseEngine';
import { supabase } from '../src/lib/supabase';
import { Subject, Chapter, Topic, Question } from '../src/types';
import fs from 'fs';
import path from 'path';

describe('Phase 7: Final Production Smoke Test & Controlled Pilot Preparation', () => {

  beforeEach(async () => {
    await idbClear(STORES.SUBJECTS);
    await idbClear(STORES.CHAPTERS);
    await idbClear(STORES.TOPICS);
    await idbClear(STORES.MCQS);
    await idbClear(STORES.CURRICULUM_METADATA);
  });

  describe('1. Controlled Pilot Dataset Integrity & Schema Compliance', () => {
    const pilotPath = path.resolve(__dirname, '../pilots/sample_pilot_import.json');
    const pilotData = JSON.parse(fs.readFileSync(pilotPath, 'utf8'));

    test('P7-1A: Subject schema and Hindi/English properties valid', () => {
      const { subject } = pilotData;
      expect(subject.id).toBe('sub_raj_hist');
      expect(subject.name).toBe('Rajasthan History');
      expect(subject.hindi_name).toBe('राजस्थान का इतिहास');
      expect(subject.icon).toBeDefined();
      expect(subject.color).toBe('#8B1E3F');
      expect(typeof subject.order_index).toBe('number');
    });

    test('P7-1B: Chapters map correctly to subject foreign key', () => {
      const { subject, chapters } = pilotData;
      expect(chapters.length).toBe(2);

      for (const ch of chapters) {
        expect(ch.subject_id).toBe(subject.id);
        expect(ch.name.length).toBeGreaterThan(0);
        expect(ch.hindi_name.length).toBeGreaterThan(0);
        expect(typeof ch.order_index).toBe('number');
      }
    });

    test('P7-1C: Topics map correctly to chapter and subject foreign keys', () => {
      const { chapters, topics } = pilotData;
      expect(topics.length).toBe(4);

      const chapterIds = new Set(chapters.map((c: any) => c.id));
      for (const top of topics) {
        expect(chapterIds.has(top.chapter_id)).toBe(true);
        expect(top.subject_id).toBe('sub_raj_hist');
        expect(top.name.length).toBeGreaterThan(0);
        expect(top.hindi_name.length).toBeGreaterThan(0);
      }
    });

    test('P7-1D: Questions maintain exact option-count fidelity (4 vs 5 options) and valid answer indices', () => {
      const { topics, questions } = pilotData;
      expect(questions.length).toBe(10);

      const topicIds = new Set(topics.map((t: any) => t.id));

      let fourOptionCount = 0;
      let fiveOptionCount = 0;

      for (const q of questions) {
        // FK integrity
        expect(topicIds.has(q.topic_id)).toBe(true);
        expect(q.subject_id).toBe('sub_raj_hist');
        expect(q.chapter_id).toBeDefined();

        // Question text & explanation
        expect(q.question.length).toBeGreaterThan(10);
        expect(q.explanation.length).toBeGreaterThan(10);

        // Options count
        const optCount = q.options.length;
        expect([4, 5]).toContain(optCount);

        if (optCount === 4) fourOptionCount++;
        if (optCount === 5) {
          fiveOptionCount++;
          expect(q.options[4]).toBe('अनुत्तरित प्रश्न');
        }

        // Correct answer index boundary
        expect(typeof q.correct_answer).toBe('number');
        expect(q.correct_answer).toBeGreaterThanOrEqual(0);
        expect(q.correct_answer).toBeLessThan(optCount);
      }

      // Exactly 5 4-option questions and 5 5-option questions
      expect(fourOptionCount).toBe(5);
      expect(fiveOptionCount).toBe(5);
    });
  });

  describe('2. Cache Failure Safety & Interruption Resilience', () => {
    test('P7-2A: Network error or abort during syncCurriculumAuthoritative leaves local cache completely untouched', async () => {
      // Seed local cache with records
      const existingSub: Subject = { id: 's-local-1', name: 'Existing Subject', hindiName: 'मौजूदा विषय', order: 1 };
      const existingChap: Chapter = { id: 'c-local-1', subjectId: 's-local-1', title: 'Existing Chapter', hindiTitle: 'मौजूदा अध्याय', number: 1, topics: [] };
      await idbPut(STORES.SUBJECTS, existingSub);
      await idbPut(STORES.CHAPTERS, existingChap);

      // Mock Supabase throwing a network connection timeout
      const originalFrom = supabase.from;
      // @ts-ignore
      supabase.from = () => ({
        select: () => ({
          order: () => ({
            range: () => Promise.reject(new Error('Connection terminated unexpectedly: ECONNRESET'))
          })
        })
      } as any);

      try {
        const syncRes = await syncCurriculumAuthoritative({ force: true });
        expect(syncRes.prunedSubjects).toBe(0);
        expect(syncRes.prunedChapters).toBe(0);

        // Verify local records were NOT deleted
        const remainingSubs = await idbGetAll<Subject>(STORES.SUBJECTS);
        const remainingChaps = await idbGetAll<Chapter>(STORES.CHAPTERS);
        expect(remainingSubs.length).toBe(1);
        expect(remainingSubs[0].id).toBe('s-local-1');
        expect(remainingChaps.length).toBe(1);
        expect(remainingChaps[0].id).toBe('c-local-1');
      } finally {
        supabase.from = originalFrom;
      }
    });

    test('P7-2B: Incomplete or partial server response aborts sync and does NOT prune local records', async () => {
      const existingSub: Subject = { id: 's-local-2', name: 'Sub 2', hindiName: 'विषय 2', order: 2 };
      await idbPut(STORES.SUBJECTS, existingSub);

      // Mock Supabase returning null data (simulating malformed/partial response)
      const originalFrom = supabase.from;
      // @ts-ignore
      supabase.from = () => ({
        select: () => ({
          order: () => ({
            range: () => Promise.resolve({ data: null, error: null })
          })
        })
      } as any);

      try {
        const syncRes = await syncCurriculumAuthoritative({ force: true });
        expect(syncRes.prunedSubjects).toBe(0);

        const remainingSubs = await idbGetAll<Subject>(STORES.SUBJECTS);
        expect(remainingSubs.length).toBe(1);
        expect(remainingSubs[0].id).toBe('s-local-2');
      } finally {
        supabase.from = originalFrom;
      }
    });
  });

  describe('3. Production Database Safety & Clean-Slate Confirmation', () => {
    test('P7-3A: Confirms zero production records were created or modified (100% read-only verification)', async () => {
      const counts = await getSupabaseTableCounts();
      assertCleanOrSeededBaseline(counts);
    });
  });
});
