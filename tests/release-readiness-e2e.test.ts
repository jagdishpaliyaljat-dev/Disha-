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

  test('1. Admin Panel can create, retrieve, and delete a Subject in Supabase', async () => {
    const newSubject: Subject = {
      id: TEST_SUBJ_ID,
      name: 'राजस्थान कला एवं संस्कृति',
      hindiName: 'राजस्थान कला एवं संस्कृति',
      description: 'सत्यापित पाठ्यक्रम',
      icon: 'palette',
      color: '#D47311',
      order: 1
    };

    // Create
    const saveRes = await saveSubjectToSupabase(newSubject);
    expect(saveRes.success).toBe(true);

    // Retrieve
    const subjects = await fetchSubjects();
    const found = subjects.find(s => s.id === TEST_SUBJ_ID);
    expect(found).toBeDefined();
    expect(found?.name).toBe('राजस्थान कला एवं संस्कृति');

    // Clean up
    const delRes = await deleteSubjectFromSupabase(TEST_SUBJ_ID);
    expect(delRes.success).toBe(true);
  });

  test('2. Admin Panel can create, retrieve, and delete a Chapter in Supabase', async () => {
    // First create parent subject
    await saveSubjectToSupabase({
      id: TEST_SUBJ_ID,
      name: 'राजस्थान कला एवं संस्कृति',
      hindiName: 'राजस्थान कला एवं संस्कृति'
    });

    const newChapter: Chapter = {
      id: TEST_CHAP_ID,
      subjectId: TEST_SUBJ_ID,
      title: 'दुर्ग एवं स्थापत्य',
      hindiTitle: 'दुर्ग एवं स्थापत्य',
      number: 1,
      topics: []
    };

    // Create
    const saveRes = await saveChapterToSupabase(newChapter);
    expect(saveRes.success).toBe(true);

    // Retrieve
    const chapters = await fetchChapters(TEST_SUBJ_ID);
    const found = chapters.find(c => c.id === TEST_CHAP_ID);
    expect(found).toBeDefined();
    expect(found?.title).toBe('दुर्ग एवं स्थापत्य');

    // Clean up chapter
    const delRes = await deleteChapterFromSupabase(TEST_CHAP_ID);
    expect(delRes.success).toBe(true);
  });

  test('3. Admin Panel can create, retrieve, and delete a Topic in Supabase', async () => {
    const newChapter: Chapter = {
      id: TEST_CHAP_ID,
      subjectId: TEST_SUBJ_ID,
      title: 'दुर्ग एवं स्थापत्य',
      hindiTitle: 'दुर्ग एवं स्थापत्य',
      number: 1,
      topics: []
    };
    await saveChapterToSupabase(newChapter);

    const newTopic: Topic = {
      id: TEST_TOPIC_ID,
      chapterId: TEST_CHAP_ID,
      subjectId: TEST_SUBJ_ID,
      title: 'चित्तौड़गढ़ दुर्ग',
      hindiTitle: 'चित्तौड़गढ़ दुर्ग',
      number: 1,
      questions: []
    };

    // Create
    const saveRes = await saveTopicToSupabase(newTopic);
    expect(saveRes.success).toBe(true);

    // Retrieve
    const topics = await fetchTopics(TEST_CHAP_ID);
    const found = topics.find(t => t.id === TEST_TOPIC_ID);
    expect(found).toBeDefined();
    expect(found?.title).toBe('चित्तौड़गढ़ दुर्ग');

    // Clean up topic & chapter
    await deleteTopicFromSupabase(TEST_TOPIC_ID);
    await deleteChapterFromSupabase(TEST_CHAP_ID);
  });

  test('4. Admin Panel can upload questions and User App retrieves them on-demand', async () => {
    // Ensure parent hierarchy exists
    await saveSubjectToSupabase({ id: TEST_SUBJ_ID, name: 'कला', hindiName: 'कला' });
    await saveChapterToSupabase({ id: TEST_CHAP_ID, subjectId: TEST_SUBJ_ID, title: 'दुर्ग', hindiTitle: 'दुर्ग', number: 1, topics: [] });
    await saveTopicToSupabase({ id: TEST_TOPIC_ID, chapterId: TEST_CHAP_ID, subjectId: TEST_SUBJ_ID, title: 'चित्तौड़गढ़', hindiTitle: 'चित्तौड़गढ़', number: 1, questions: [] });

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

    // Upload
    const uploadRes = await upsertQuestionsToSupabase([newQuestion]);
    expect(uploadRes.success).toBe(true);
    expect(uploadRes.count).toBe(1);

    // User App fetches on-demand
    const fetchedQs = await fetchQuestionsByTopic(TEST_TOPIC_ID);
    expect(fetchedQs.length).toBeGreaterThan(0);
    const q = fetchedQs.find(item => item.id === TEST_Q_ID);
    expect(q).toBeDefined();
    expect(q?.options.length).toBe(4);
    expect(q?.correctIndex).toBe(0);

    // Clean up everything to leave Supabase 100% clean
    await deleteQuestionFromSupabase(TEST_Q_ID);
    await deleteTopicFromSupabase(TEST_TOPIC_ID);
    await deleteChapterFromSupabase(TEST_CHAP_ID);
    await deleteSubjectFromSupabase(TEST_SUBJ_ID);
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
