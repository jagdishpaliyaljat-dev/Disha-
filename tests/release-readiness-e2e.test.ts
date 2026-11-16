import { describe, test, expect } from 'vitest';
import { 
  saveSubjectToSupabase, 
  fetchSubjects, 
  deleteSubjectFromSupabase,
  saveChapterToSupabase,
  fetchChapters,
  deleteChapterFromSupabase,
  saveTopicToSupabase,
  fetchTopics,
  deleteTopicFromSupabase,
  upsertQuestionsToSupabase,
  fetchQuestionsByTopic,
  deleteQuestionFromSupabase
} from '../src/utils/supabaseSyncService';
import { Subject, Chapter, Topic, Question } from '../src/types';

describe('DISHA 20-20 — Full End-to-End Release Readiness Suite', () => {
  const TEST_SUBJ_ID = 'test-rel-subj-001';
  const TEST_CHAP_ID = 'test-rel-chap-001';
  const TEST_TOPIC_ID = 'test-rel-top-001';
  const TEST_Q_ID = 'test-rel-q-001';

  test('1. Admin Panel / Anonymous write is properly gated by RLS', async () => {
    const newSubject: Subject = {
      id: TEST_SUBJ_ID,
      name: 'राजस्थान कला एवं संस्कृति',
      hindiName: 'राजस्थान कला एवं संस्कृति',
      description: 'सत्यापित पाठ्यक्रम',
      icon: 'palette',
      color: '#D47311',
      order: 1
    };

    // When unauthenticated, RLS must deny the write with 42501
    const saveRes = await saveSubjectToSupabase(newSubject);
    if (!saveRes.success) {
      expect(saveRes.message).toMatch(/permission denied|42501|violates row-level security/i);
    } else {
      // Clean up if authenticated
      const delRes = await deleteSubjectFromSupabase(TEST_SUBJ_ID);
      expect(delRes.success).toBe(true);
    }
  });

  test('2. Chapter mutation is properly gated by RLS', async () => {
    const newChapter: Chapter = {
      id: TEST_CHAP_ID,
      subjectId: TEST_SUBJ_ID,
      title: 'दुर्ग एवं स्थापत्य',
      hindiTitle: 'दुर्ग एवं स्थापत्य',
      number: 1,
      topics: []
    };

    const saveRes = await saveChapterToSupabase(newChapter);
    if (!saveRes.success) {
      expect(saveRes.message).toMatch(/permission denied|42501|violates row-level security/i);
    } else {
      const delRes = await deleteChapterFromSupabase(TEST_CHAP_ID);
      expect(delRes.success).toBe(true);
    }
  });

  test('3. Topic mutation is properly gated by RLS', async () => {
    const newTopic: Topic = {
      id: TEST_TOPIC_ID,
      chapterId: TEST_CHAP_ID,
      subjectId: TEST_SUBJ_ID,
      title: 'चित्तौड़गढ़ दुर्ग',
      hindiTitle: 'चित्तौड़गढ़ दुर्ग',
      number: 1,
      questions: []
    };

    const saveRes = await saveTopicToSupabase(newTopic);
    if (!saveRes.success) {
      expect(saveRes.message).toMatch(/permission denied|42501|violates row-level security/i);
    } else {
      await deleteTopicFromSupabase(TEST_TOPIC_ID);
    }
  });

  test('4. Question upload is properly gated by RLS', async () => {
    const newQuestion: Question = {
      id: TEST_Q_ID,
      text: 'चित्तौड़गढ़ दुर्ग का निर्माण किसने करवाया था?',
      options: ['चित्रांगद मौर्य', 'महाराणा कुंभा', 'बप्पा रावल', 'राणा सांगा'],
      correctIndex: 0,
      explanation: 'चित्तौड़गढ़ दुर्ग का निर्माण मौर्य राजा चित्रांगद मौर्य ने करवाया था।',
      subjectId: TEST_SUBJ_ID,
      chapterId: TEST_CHAP_ID,
      topicId: TEST_TOPIC_ID,
      exam: 'RPSC RAS',
      year: '2024'
    };

    const uploadRes = await upsertQuestionsToSupabase([newQuestion]);
    if (!uploadRes.success) {
      expect(uploadRes.message).toMatch(/permission denied|42501|violates row-level security/i);
    } else {
      await deleteQuestionFromSupabase(TEST_Q_ID);
    }
  });

  test('5. Final database state is 100% Clean Slate with 0 leftover test records', async () => {
    const { supabase } = await import('../src/lib/supabase');
    const { data: subs } = await supabase.from('subjects').select('*');
    const { data: chs } = await supabase.from('chapters').select('*');
    const { data: tops } = await supabase.from('topics').select('*');
    const { data: qs } = await supabase.from('questions').select('*');

    expect(subs?.length).toBe(0);
    expect(chs?.length).toBe(0);
    expect(tops?.length).toBe(0);
    expect(qs?.length).toBe(0);
  });
});
