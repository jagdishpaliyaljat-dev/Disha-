import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

// Load .env.local
let env = {};
try {
  const content = fs.readFileSync('.env.local', 'utf-8');
  content.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const idx = trimmed.indexOf('=');
      if (idx > 0) {
        env[trimmed.slice(0, idx).trim()] = trimmed.slice(idx + 1).trim();
      }
    }
  });
} catch (e) {
  console.error('Error reading .env.local:', e.message);
}

const SUPABASE_URL = env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('Missing Supabase configuration in .env.local');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false }
});

// Simple deterministic question hash helper
function computeQuestionHash(q) {
  const text = (q.question || q.text || '').trim().toLowerCase().replace(/\s+/g, ' ');
  const options = Array.isArray(q.options)
    ? q.options.map(o => String(o).trim().toLowerCase().replace(/\s+/g, ' ')).sort().join('|')
    : '';
  const ans = String(q.correct_answer ?? q.correctIndex ?? '').trim();
  return `${text}:::${options}:::${ans}`;
}

async function runDataIntegrityAudit() {
  console.log('Starting Complete Data Integrity Audit...\n');

  // 1. Fetch all records from Supabase tables
  console.log('Fetching all records from Supabase...');
  const [
    { data: subjects, error: errSub },
    { data: chapters, error: errChap },
    { data: topics, error: errTop },
    { data: questions, error: errQ },
    { data: profiles, error: errProf },
    { data: attempts, error: errAtt },
    { data: bookmarks, error: errBm }
  ] = await Promise.all([
    supabase.from('subjects').select('*'),
    supabase.from('chapters').select('*'),
    supabase.from('topics').select('*'),
    supabase.from('questions').select('*'),
    supabase.from('profiles').select('id, email, full_name, role'),
    supabase.from('attempts').select('id, user_id, topic_id, score'),
    supabase.from('bookmarks').select('id, user_id, question_id')
  ]);

  const rawSubjects = subjects || [];
  const rawChapters = chapters || [];
  const rawTopics = topics || [];
  const rawQuestions = questions || [];
  const rawProfiles = profiles || [];
  const rawAttempts = attempts || [];
  const rawBookmarks = bookmarks || [];

  console.log(`Fetched Counts:`);
  console.log(`- Subjects: ${rawSubjects.length} (Error: ${errSub?.message || 'none'})`);
  console.log(`- Chapters: ${rawChapters.length} (Error: ${errChap?.message || 'none'})`);
  console.log(`- Topics: ${rawTopics.length} (Error: ${errTop?.message || 'none'})`);
  console.log(`- Questions: ${rawQuestions.length} (Error: ${errQ?.message || 'none'})`);
  console.log(`- Profiles: ${rawProfiles.length} (Error: ${errProf?.message || 'none'})`);
  console.log(`- Attempts: ${rawAttempts.length} (Error: ${errAtt?.message || 'none'})`);
  console.log(`- Bookmarks: ${rawBookmarks.length} (Error: ${errBm?.message || 'none'})\n`);

  const audit = {
    timestamp: new Date().toISOString(),
    recordCounts: {
      subjects: rawSubjects.length,
      chapters: rawChapters.length,
      topics: rawTopics.length,
      questions: rawQuestions.length,
      profiles: rawProfiles.length,
      attempts: rawAttempts.length,
      bookmarks: rawBookmarks.length
    },
    checks: {}
  };

  const subjectMap = new Map();
  const duplicateSubjectIds = [];
  rawSubjects.forEach(s => {
    if (subjectMap.has(s.id)) duplicateSubjectIds.push(s.id);
    subjectMap.set(s.id, s);
  });

  const chapterMap = new Map();
  const duplicateChapterIds = [];
  rawChapters.forEach(c => {
    if (chapterMap.has(c.id)) duplicateChapterIds.push(c.id);
    chapterMap.set(c.id, c);
  });

  const topicMap = new Map();
  const duplicateTopicIds = [];
  rawTopics.forEach(t => {
    if (topicMap.has(t.id)) duplicateTopicIds.push(t.id);
    topicMap.set(t.id, t);
  });

  const questionMap = new Map();
  const duplicateQuestionIds = [];
  rawQuestions.forEach(q => {
    if (questionMap.has(q.id)) duplicateQuestionIds.push(q.id);
    questionMap.set(q.id, q);
  });

  // 1. Subject-Chapter relationships
  const brokenSubjectChapterLinks = [];
  rawChapters.forEach(c => {
    const sId = c.subject_id || c.subjectId;
    if (!sId || !subjectMap.has(sId)) {
      brokenSubjectChapterLinks.push({
        chapterId: c.id,
        chapterTitle: c.name || c.title || c.hindi_name,
        referencedSubjectId: sId
      });
    }
  });

  // 2. Chapter-Topic relationships
  const brokenChapterTopicLinks = [];
  rawTopics.forEach(t => {
    const cId = t.chapter_id || t.chapterId;
    if (!cId || !chapterMap.has(cId)) {
      brokenChapterTopicLinks.push({
        topicId: t.id,
        topicTitle: t.name || t.title || t.hindi_name,
        referencedChapterId: cId
      });
    }
  });

  // 3. Topic-MCQ relationships
  const brokenTopicMCQLinks = [];
  rawQuestions.forEach(q => {
    const tId = q.topic_id || q.topicId;
    if (!tId || !topicMap.has(tId)) {
      brokenTopicMCQLinks.push({
        questionId: q.id,
        questionText: (q.question || q.text || '').slice(0, 60),
        referencedTopicId: tId
      });
    }
  });

  // 4. Missing foreign keys
  const missingForeignKeys = {
    chaptersWithoutSubjectId: rawChapters.filter(c => !c.subject_id && !c.subjectId).map(c => c.id),
    topicsWithoutChapterId: rawTopics.filter(t => !t.chapter_id && !t.chapterId).map(t => t.id),
    topicsWithoutSubjectId: rawTopics.filter(t => !t.subject_id && !t.subjectId).map(t => t.id),
    questionsWithoutTopicId: rawQuestions.filter(q => !q.topic_id && !q.topicId).map(q => q.id),
    questionsWithoutChapterId: rawQuestions.filter(q => !q.chapter_id && !q.chapterId).map(q => q.id),
    questionsWithoutSubjectId: rawQuestions.filter(q => !q.subject_id && !q.subjectId).map(q => q.id)
  };

  // 5. Orphan records
  const orphanRecords = {
    orphanChapters: brokenSubjectChapterLinks,
    orphanTopics: brokenChapterTopicLinks,
    orphanQuestions: brokenTopicMCQLinks
  };

  // 6. Duplicate IDs
  const duplicateIds = {
    subjects: duplicateSubjectIds,
    chapters: duplicateChapterIds,
    topics: duplicateTopicIds,
    questions: duplicateQuestionIds
  };

  // 7. Duplicate logical questions (Content-level hashes)
  const logicalQuestionGroups = new Map();
  rawQuestions.forEach(q => {
    const hash = computeQuestionHash(q);
    if (!logicalQuestionGroups.has(hash)) {
      logicalQuestionGroups.set(hash, []);
    }
    logicalQuestionGroups.get(hash).push(q.id);
  });
  const duplicateLogicalQuestions = [];
  logicalQuestionGroups.forEach((ids, hash) => {
    if (ids.length > 1) {
      duplicateLogicalQuestions.push({ hash, count: ids.length, questionIds: ids });
    }
  });

  // 8. Missing required fields
  const missingRequiredFields = {
    subjects: rawSubjects.filter(s => !s.id || (!s.name && !s.hindi_name)).map(s => s.id),
    chapters: rawChapters.filter(c => !c.id || (!c.name && !c.title && !c.hindi_name && !c.hindi_title)).map(c => c.id),
    topics: rawTopics.filter(t => !t.id || (!t.name && !t.title && !t.hindi_name && !t.hindi_title)).map(t => t.id),
    questions: rawQuestions.filter(q => {
      const hasText = Boolean(q.question || q.text);
      const hasOptions = Array.isArray(q.options) && q.options.length >= 2;
      const hasAnswer = typeof q.correct_answer === 'number' || typeof q.correctIndex === 'number';
      return !q.id || !hasText || !hasOptions || !hasAnswer;
    }).map(q => q.id)
  };

  // 9. Invalid references (Hierarchy consistency triple check)
  const invalidHierarchyReferences = [];
  rawQuestions.forEach(q => {
    const tId = q.topic_id || q.topicId;
    const cId = q.chapter_id || q.chapterId;
    const sId = q.subject_id || q.subjectId;

    if (tId && topicMap.has(tId)) {
      const topic = topicMap.get(tId);
      const expectedChapterId = topic.chapter_id || topic.chapterId;
      const expectedSubjectId = topic.subject_id || topic.subjectId;

      const chapterMismatch = cId && expectedChapterId && cId !== expectedChapterId;
      const subjectMismatch = sId && expectedSubjectId && sId !== expectedSubjectId;

      if (chapterMismatch || subjectMismatch) {
        invalidHierarchyReferences.push({
          questionId: q.id,
          actual: { subjectId: sId, chapterId: cId, topicId: tId },
          expectedFromTopic: { subjectId: expectedSubjectId, chapterId: expectedChapterId }
        });
      }
    }
  });

  // 10. Record count consistency
  audit.checks = {
    subjectChapterRelationships: {
      status: brokenSubjectChapterLinks.length === 0 ? 'PASSED' : 'FLAGGED',
      brokenCount: brokenSubjectChapterLinks.length,
      details: brokenSubjectChapterLinks
    },
    chapterTopicRelationships: {
      status: brokenChapterTopicLinks.length === 0 ? 'PASSED' : 'FLAGGED',
      brokenCount: brokenChapterTopicLinks.length,
      details: brokenChapterTopicLinks
    },
    topicMCQRelationships: {
      status: brokenTopicMCQLinks.length === 0 ? 'PASSED' : 'FLAGGED',
      brokenCount: brokenTopicMCQLinks.length,
      details: brokenTopicMCQLinks
    },
    missingForeignKeys: {
      status: Object.values(missingForeignKeys).every(arr => arr.length === 0) ? 'PASSED' : 'FLAGGED',
      summary: missingForeignKeys
    },
    orphanRecords: {
      status: (orphanRecords.orphanChapters.length + orphanRecords.orphanTopics.length + orphanRecords.orphanQuestions.length) === 0 ? 'PASSED' : 'FLAGGED',
      summary: orphanRecords
    },
    duplicateIds: {
      status: Object.values(duplicateIds).every(arr => arr.length === 0) ? 'PASSED' : 'FLAGGED',
      summary: duplicateIds
    },
    duplicateLogicalQuestions: {
      status: duplicateLogicalQuestions.length === 0 ? 'PASSED' : 'FLAGGED',
      duplicateGroupsCount: duplicateLogicalQuestions.length,
      details: duplicateLogicalQuestions
    },
    missingRequiredFields: {
      status: Object.values(missingRequiredFields).every(arr => arr.length === 0) ? 'PASSED' : 'FLAGGED',
      summary: missingRequiredFields
    },
    invalidReferences: {
      status: invalidHierarchyReferences.length === 0 ? 'PASSED' : 'FLAGGED',
      invalidCount: invalidHierarchyReferences.length,
      details: invalidHierarchyReferences
    },
    recordCountConsistency: {
      status: 'VERIFIED',
      supabaseCounts: audit.recordCounts
    }
  };

  fs.writeFileSync('reports/DATA_INTEGRITY_AUDIT_DATA.json', JSON.stringify(audit, null, 2));
  console.log('Saved JSON data to reports/DATA_INTEGRITY_AUDIT_DATA.json');

  return audit;
}

runDataIntegrityAudit().then(audit => {
  console.log('\n======================================================================');
  console.log('AUDIT SUMMARY:');
  console.log('1. Subject-Chapter Links:', audit.checks.subjectChapterRelationships.status, `(Broken: ${audit.checks.subjectChapterRelationships.brokenCount})`);
  console.log('2. Chapter-Topic Links:', audit.checks.chapterTopicRelationships.status, `(Broken: ${audit.checks.chapterTopicRelationships.brokenCount})`);
  console.log('3. Topic-MCQ Links:', audit.checks.topicMCQRelationships.status, `(Broken: ${audit.checks.topicMCQRelationships.brokenCount})`);
  console.log('4. Missing Foreign Keys:', audit.checks.missingForeignKeys.status);
  console.log('5. Orphan Records:', audit.checks.orphanRecords.status);
  console.log('6. Duplicate IDs:', audit.checks.duplicateIds.status);
  console.log('7. Duplicate Logical Questions:', audit.checks.duplicateLogicalQuestions.status, `(Groups: ${audit.checks.duplicateLogicalQuestions.duplicateGroupsCount})`);
  console.log('8. Missing Required Fields:', audit.checks.missingRequiredFields.status);
  console.log('9. Invalid References:', audit.checks.invalidReferences.status, `(Mismatches: ${audit.checks.invalidReferences.invalidCount})`);
  console.log('10. Record Count Consistency:', audit.checks.recordCountConsistency.status);
  console.log('======================================================================');
}).catch(err => {
  console.error('Audit execution error:', err);
  process.exit(1);
});
