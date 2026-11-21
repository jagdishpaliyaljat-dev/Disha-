import { describe, test, expect, beforeEach } from 'vitest';
import { 
  syncCurriculumAuthoritative, 
  fetchSubjects, 
  fetchChapters, 
  fetchTopics,
  saveSubjectToSupabase,
  deleteSubjectFromSupabase,
  saveChapterToSupabase,
  deleteChapterFromSupabase,
  saveTopicToSupabase,
  deleteTopicFromSupabase,
  upsertQuestionsToSupabase,
  deleteQuestionFromSupabase,
  deleteQuestionsBulkFromSupabase
} from '../src/utils/supabaseSyncService';
import { 
  idbPut, 
  idbGet, 
  idbGetAll, 
  idbDelete, 
  idbClear,
  STORES 
} from '../src/utils/localDatabaseEngine';
import { parseRawMcqText } from '../src/utils/questionParser';
import { supabase } from '../src/lib/supabase';
import { Subject, Chapter, Topic, Question } from '../src/types';

describe('Phase 6: Local Cache Integrity & Production Readiness Audit', () => {

  beforeEach(async () => {
    // Clear local stores before each test to ensure test isolation
    await idbClear(STORES.SUBJECTS);
    await idbClear(STORES.CHAPTERS);
    await idbClear(STORES.TOPICS);
    await idbClear(STORES.MCQS);
    await idbClear(STORES.CURRICULUM_METADATA);
  });

  describe('1. Authoritative Cache Synchronization & Stale Data Purging', () => {
    test('P6-1A: Authoritative sync prunes stale server-originated records when Supabase has 0 rows', async () => {
      // Simulate stale leftover server records in IndexedDB (from previous test session)
      const staleSubject: Subject = {
        id: 'stale-subj-999',
        name: 'Stale Server Subject',
        hindiName: 'बासी विषय',
        order: 1,
        isUserAdded: false, // Originated from server in a previous sync
      };
      const staleChapter: Chapter = {
        id: 'stale-chap-999',
        subjectId: 'stale-subj-999',
        title: 'Stale Server Chapter',
        hindiTitle: 'बासी अध्याय',
        number: 1,
        topics: [],
        isUserAdded: false,
      };

      await idbPut(STORES.SUBJECTS, staleSubject);
      await idbPut(STORES.CHAPTERS, staleChapter);

      // Verify they are initially in local cache
      const initialSubs = await idbGetAll<Subject>(STORES.SUBJECTS);
      expect(initialSubs.length).toBe(1);

      // Mock Supabase returning 0 records (clean-slate production database)
      const originalFrom = supabase.from;
      // @ts-ignore
      supabase.from = (table: string) => {
        const queryResult = Promise.resolve({ data: [], error: null });
        const mockBuilder: any = {
          order: () => mockBuilder,
          range: () => mockBuilder,
          limit: () => mockBuilder,
          then: queryResult.then.bind(queryResult),
          catch: queryResult.catch.bind(queryResult)
        };
        return {
          select: () => mockBuilder
        } as any;
      };

      try {
        const syncResult = await syncCurriculumAuthoritative({ force: true });
        expect(syncResult.prunedSubjects).toBe(1);
        expect(syncResult.prunedChapters).toBe(1);
        expect(syncResult.preservedDrafts).toBe(0);

        // Verify local IndexedDB was purged of stale records
        const afterSubs = await idbGetAll<Subject>(STORES.SUBJECTS);
        const afterChaps = await idbGetAll<Chapter>(STORES.CHAPTERS);
        expect(afterSubs.length).toBe(0);
        expect(afterChaps.length).toBe(0);

        // Verify cache version metadata was written
        const meta = await idbGet<any>(STORES.CURRICULUM_METADATA, 'curriculum_cache_sync');
        expect(meta).toBeDefined();
        expect(meta.serverSubjectsCount).toBe(0);
        expect(meta.serverChaptersCount).toBe(0);
        expect(meta.version).toBe(1);
      } finally {
        supabase.from = originalFrom;
      }
    });

    test('P6-1B: Authoritative sync strictly PRESERVES unsynced local drafts (isUserAdded=true, syncStatus=pending)', async () => {
      // Create a legitimate local-only user draft
      const userDraftSubject: Subject = {
        id: 'draft-subj-001',
        name: 'My Custom Draft Subject',
        hindiName: 'मेरा ड्राफ्ट विषय',
        order: 1,
        isUserAdded: true,
      };
      (userDraftSubject as any).syncStatus = 'pending';

      const userDraftChapter: Chapter = {
        id: 'draft-chap-001',
        subjectId: 'draft-subj-001',
        title: 'Draft Chapter 1',
        hindiTitle: 'ड्राफ्ट अध्याय',
        number: 1,
        topics: [],
        isUserAdded: true,
      };
      (userDraftChapter as any).syncStatus = 'pending';

      await idbPut(STORES.SUBJECTS, userDraftSubject);
      await idbPut(STORES.CHAPTERS, userDraftChapter);

      // Mock Supabase returning 0 records
      const originalFrom = supabase.from;
      // @ts-ignore
      supabase.from = (table: string) => {
        const queryResult = Promise.resolve({ data: [], error: null });
        const mockBuilder: any = {
          order: () => mockBuilder,
          range: () => mockBuilder,
          limit: () => mockBuilder,
          then: queryResult.then.bind(queryResult),
          catch: queryResult.catch.bind(queryResult)
        };
        return {
          select: () => mockBuilder
        } as any;
      };

      try {
        const syncResult = await syncCurriculumAuthoritative({ force: true });
        expect(syncResult.prunedSubjects).toBe(0);
        expect(syncResult.prunedChapters).toBe(0);
        expect(syncResult.preservedDrafts).toBe(2);

        // Verify draft records are completely intact in local cache
        const preservedSubs = await idbGetAll<Subject>(STORES.SUBJECTS);
        const preservedChaps = await idbGetAll<Chapter>(STORES.CHAPTERS);
        expect(preservedSubs.length).toBe(1);
        expect(preservedSubs[0].id).toBe('draft-subj-001');
        expect(preservedChaps.length).toBe(1);
        expect(preservedChaps[0].id).toBe('draft-chap-001');
      } finally {
        supabase.from = originalFrom;
      }
    });
  });

  describe('2. Network Failure & Server-First Mutation Consistency', () => {
    test('P6-2A: deleteSubjectFromSupabase does NOT delete locally when Supabase returns an error', async () => {
      const subject: Subject = {
        id: 'p6-safe-subj',
        name: 'Protected Subject',
        hindiName: 'सुरक्षित विषय',
        order: 1,
      };
      await idbPut(STORES.SUBJECTS, subject);

      // Mock Supabase delete failure (e.g., foreign key constraint or network drop)
      const originalFrom = supabase.from;
      // @ts-ignore
      supabase.from = (table: string) => {
        if (table === 'subjects') {
          return {
            delete: () => ({
              eq: () => Promise.resolve({ error: { message: 'FK constraint: subject has child chapters' } })
            })
          } as any;
        }
        return originalFrom.call(supabase, table);
      };

      try {
        const res = await deleteSubjectFromSupabase('p6-safe-subj');
        expect(res.success).toBe(false);
        expect(res.message).toContain('FK constraint');

        // Local cache must remain untouched
        const remaining = await idbGet<Subject>(STORES.SUBJECTS, 'p6-safe-subj');
        expect(remaining).not.toBeNull();
        expect(remaining?.name).toBe('Protected Subject');
      } finally {
        supabase.from = originalFrom;
      }
    });

    test('P6-2B: saveSubjectToSupabase does NOT create local record if Supabase rejects with error', async () => {
      const newSubject: Subject = {
        id: 'p6-rejected-subj',
        name: 'Unauthorized Subject',
        hindiName: 'अस्वीकृत विषय',
        order: 2,
      };

      // Mock Supabase upsert failure (e.g., RLS policy rejection)
      const originalFrom = supabase.from;
      // @ts-ignore
      supabase.from = (table: string) => {
        if (table === 'subjects') {
          return {
            upsert: () => Promise.resolve({ error: { message: 'RLS policy: admin authorization required' } })
          } as any;
        }
        return originalFrom.call(supabase, table);
      };

      try {
        const res = await saveSubjectToSupabase(newSubject);
        expect(res.success).toBe(false);
        expect(res.message).toContain('admin authorization required');

        // Local cache must not have this rejected record
        const check = await idbGet<Subject>(STORES.SUBJECTS, 'p6-rejected-subj');
        expect(check).toBeNull();
      } finally {
        supabase.from = originalFrom;
      }
    });

    test('P6-2C: deleteChapterFromSupabase and deleteTopicFromSupabase preserve local store on failure', async () => {
      const chap: Chapter = { id: 'c-err', subjectId: 's1', title: 'C', hindiTitle: 'क', number: 1, topics: [] };
      const top: Topic = { id: 't-err', chapterId: 'c-err', subjectId: 's1', title: 'T', hindiTitle: 'ट', number: 1, questions: [] };

      await idbPut(STORES.CHAPTERS, chap);
      await idbPut(STORES.TOPICS, top);

      const originalFrom = supabase.from;
      // @ts-ignore
      supabase.from = () => ({
        delete: () => ({
          eq: () => Promise.resolve({ error: { message: 'Network offline' } })
        })
      } as any);

      try {
        const cRes = await deleteChapterFromSupabase('c-err');
        expect(cRes.success).toBe(false);
        expect(await idbGet(STORES.CHAPTERS, 'c-err')).not.toBeNull();

        const tRes = await deleteTopicFromSupabase('t-err');
        expect(tRes.success).toBe(false);
        expect(await idbGet(STORES.TOPICS, 't-err')).not.toBeNull();
      } finally {
        supabase.from = originalFrom;
      }
    });

    test('P6-2D: deleteQuestionFromSupabase preserves local MCQ on network failure', async () => {
      const q: Question = {
        id: 'q-preserve',
        text: 'What is 5 x 5?',
        options: ['20', '25', '30', '35'],
        correctIndex: 1,
        explanation: '5 * 5 = 25',
      };
      await idbPut(STORES.MCQS, q);

      const originalFrom = supabase.from;
      // @ts-ignore
      supabase.from = () => ({
        delete: () => ({
          eq: () => Promise.resolve({ error: { message: 'Supabase gateway timeout' } })
        })
      } as any);

      try {
        const res = await deleteQuestionFromSupabase('q-preserve');
        expect(res.success).toBe(false);

        const storedQ = await idbGet<Question>(STORES.MCQS, 'q-preserve');
        expect(storedQ).not.toBeNull();
        expect(storedQ?.text).toBe('What is 5 x 5?');
      } finally {
        supabase.from = originalFrom;
      }
    });

    test('P6-2E: deleteQuestionsBulkFromSupabase handles failure cleanly without corrupting local store', async () => {
      const q1: Question = { id: 'bulk-1', text: 'Q1', options: ['A', 'B'], correctIndex: 0, explanation: '' };
      const q2: Question = { id: 'bulk-2', text: 'Q2', options: ['A', 'B'], correctIndex: 1, explanation: '' };
      await idbPut(STORES.MCQS, q1);
      await idbPut(STORES.MCQS, q2);

      const originalFrom = supabase.from;
      // @ts-ignore
      supabase.from = () => ({
        delete: () => ({
          in: () => Promise.resolve({ error: { message: 'Batch delete aborted' } })
        })
      } as any);

      try {
        const res = await deleteQuestionsBulkFromSupabase(['bulk-1', 'bulk-2']);
        expect(res.success).toBe(false);
        expect(res.count).toBe(0);

        // Verify neither question was deleted from local store
        expect(await idbGet(STORES.MCQS, 'bulk-1')).not.toBeNull();
        expect(await idbGet(STORES.MCQS, 'bulk-2')).not.toBeNull();
      } finally {
        supabase.from = originalFrom;
      }
    });
  });

  describe('3. MCQ Parser Option Count Invariance & Multi-Format Validation', () => {
    test('P6-3A: 2-Option MCQ (True/False / सत्य-असत्य) parses exactly 2 options without forced padding', () => {
      const sample = `Q. प्रकाश का वेग निर्वात में अधिकतम होता है।
(A) सत्य
(B) असत्य
Answer: A
Explanation: निर्वात में प्रकाश की चाल 3 x 10^8 m/s होती है।`;

      const result = parseRawMcqText(sample);
      expect(result.questions.length).toBe(1);
      const q = result.questions[0];
      expect(q.options.length).toBe(2);
      expect(q.options[0]).toBe('सत्य');
      expect(q.options[1]).toBe('असत्य');
      expect(q.correctIndex).toBe(0);
    });

    test('P6-3B: 4-Option MCQ (Standard SSC/CET Exam) parses exactly 4 options without forced Option E', () => {
      const sample = `Q. राजस्थान के प्रथम मुख्यमंत्री कौन थे?
(A) टीकाराम पालीवाल
(B) हीरालाल शास्त्री
(C) जय नारायण व्यास
(D) मोहनलाल सुखाड़िया
Answer: B
Explanation: पंडित हीरालाल शास्त्री राजस्थान के प्रथम मुख्यमंत्री थे।`;

      const result = parseRawMcqText(sample);
      expect(result.questions.length).toBe(1);
      const q = result.questions[0];
      expect(q.options.length).toBe(4);
      expect(q.options[0]).toBe('टीकाराम पालीवाल');
      expect(q.options[1]).toBe('हीरालाल शास्त्री');
      expect(q.options[2]).toBe('जय नारायण व्यास');
      expect(q.options[3]).toBe('मोहनलाल सुखाड़िया');
      expect(q.correctIndex).toBe(1);
      expect(q.answer).toBe('B');
    });

    test('P6-3C: 5-Option MCQ (RPSC 5th Option format) parses all 5 options with indices 0 to 4', () => {
      const sample = `Q. 1857 की क्रांति के समय राजस्थान में कितनी सैनिक छावनियां थीं?
(A) 4
(B) 6
(C) 8
(D) 10
(E) अनुत्तरित प्रश्न
Answer: B
Explanation: उस समय 6 छावनियां थीं: नसीराबाद, नीमच, देवली, ब्यावर, एरिनपुरा, खेरवाड़ा।`;

      const result = parseRawMcqText(sample);
      expect(result.questions.length).toBe(1);
      const q = result.questions[0];
      expect(q.options.length).toBe(5);
      expect(q.options[4]).toBe('अनुत्तरित प्रश्न');
      expect(q.correctIndex).toBe(1);
    });

    test('P6-3D: 5-Option MCQ where Option E is correct answer (candidate intentionally left unattempted)', () => {
      const sample = `Q. राजस्थान का राज्य पक्षी कौन सा है?
(A) मोर
(B) कबूतर
(C) गोडावण
(D) तोता
(E) अनुत्तरित प्रश्न
Answer: E
Explanation: अनुत्तरित प्रश्न (Question Not Attempted)`;

      const result = parseRawMcqText(sample);
      expect(result.questions.length).toBe(1);
      const q = result.questions[0];
      expect(q.options.length).toBe(5);
      expect(q.correctIndex).toBe(4);
      expect(q.answer).toBe('E');
    });

    test('P6-3E: Incomplete / Malformed question returns explicit validation error instead of silent corruption', () => {
      const malformedSample = `Q. Broken question without any options
Answer: A
Explanation: Missing all options.`;

      const result = parseRawMcqText(malformedSample);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].reason).toContain('Options nahi mile');
    });
  });

  describe('4. Multi-Device, Cache Invalidation & Force Refresh', () => {
    test('P6-4A: fetchSubjects with forceRefresh: true triggers authoritative reconciliation', async () => {
      // Mock Supabase returning updated server subjects
      const originalFrom = supabase.from;
      // @ts-ignore
      supabase.from = (table: string) => {
        if (table === 'subjects') {
          return {
            select: () => ({
              order: () => Promise.resolve({
                data: [
                  { id: 'fresh-subj-1', name: 'Fresh Server Subject', hindi_name: 'ताज़ा विषय', order_index: 1 }
                ],
                error: null
              })
            })
          } as any;
        }
        return {
          select: () => ({
            order: () => Promise.resolve({ data: [], error: null })
          })
        } as any;
      };

      try {
        const subjects = await fetchSubjects({ forceRefresh: true });
        expect(subjects.length).toBe(1);
        expect(subjects[0].id).toBe('fresh-subj-1');
        expect(subjects[0].name).toBe('Fresh Server Subject');

        // Verify IndexedDB now has this synchronized subject
        const stored = await idbGet<Subject>(STORES.SUBJECTS, 'fresh-subj-1');
        expect(stored).not.toBeNull();
        expect(stored?.hindiName).toBe('ताज़ा विषय');
      } finally {
        supabase.from = originalFrom;
      }
    });
  });
});
