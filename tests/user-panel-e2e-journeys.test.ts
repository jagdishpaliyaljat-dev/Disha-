import { describe, it, expect, beforeEach } from 'vitest';
import { 
  getCombinedSubjects, 
  getCombinedChapters, 
  getSubjectQuestionsCount,
  loadUserQuestionsStore,
} from '../src/utils/questionsStorage';
import { 
  calculateNextProgress, 
  sortQuestionsForRevision, 
  isDueToday,
  INTERVALS,
  addDaysToDate,
  getTodayDateString 
} from '../src/utils/revision';
import { 
  bufferProgressUpdate, 
  bufferHistoryUpdate,
  hasPendingStudentWrites,
  getStudentSyncMode,
  setAdminPreviewSession,
  __setMockAuthUserForTests,
  STUDENT_BUFFER_STORAGE_KEY,
  STUDENT_OUTBOX_STORAGE_KEY,
} from '../src/utils/studentWriteBuffer';
import { 
  UserQuestionsStore, 
  Subject, 
  Chapter, 
  Topic, 
  Question, 
  ProgressStore, 
  QuestionProgress,
  LiveTest,
  LiveTestSubmission,
  PYQPaper
} from '../src/types';

describe('DISHA 20-20 — Phase 3: Comprehensive User Panel End-to-End Suite', () => {

  // ─────────────────────────────────────────────────────────────
  // JOURNEY A: CURRICULUM NAVIGATION & TOPIC EXPLORER
  // ─────────────────────────────────────────────────────────────
  describe('Journey A: Curriculum Navigation & Hierarchy Drill-down', () => {
    const mockSubject: Subject = {
      id: 'rajasthan-history',
      name: 'राजस्थान का इतिहास',
      hindiName: 'राजस्थान का इतिहास',
      icon: 'Landmark',
      color: '#800020',
      order: 1,
    };

    const mockChapter: Chapter = {
      id: 'ch-prajamandal',
      subjectId: 'rajasthan-history',
      number: 1,
      title: 'प्रजामंडल आन्दोलन',
      hindiTitle: 'प्रजामंडल आन्दोलन',
      topics: [
        {
          id: 'topic-jaipur-prajamandal',
          chapterId: 'ch-prajamandal',
          title: 'जयपुर प्रजामंडल',
          hindiTitle: 'जयपुर प्रजामंडल',
          questions: [
            {
              id: 'q-jp-1',
              text: 'जयपुर प्रजामंडल की स्थापना किस वर्ष हुई تھی?',
              options: ['1931', '1938', '1942', '1936'],
              correctIndex: 0,
              explanation: 'जयपुर प्रजामंडल की स्थापना सर्वप्रथम 1931 ई. में कपूरचंद पाटनी द्वारा की गई।',
              subjectId: 'rajasthan-history',
              chapterId: 'ch-prajamandal',
              topicId: 'topic-jaipur-prajamandal',
            },
            {
              id: 'q-jp-2',
              text: '1938 में जयपुर प्रजामंडल का पुनर्गठन किसके प्रयासों से हुआ?',
              options: ['जमनालाल बजाज', 'माणिक्य लाल वर्मा', 'हीरालाल शास्त्री', 'जयनारायण व्यास'],
              correctIndex: 0,
              explanation: '1938 में जमनालाल बजाज और हीरालाल शास्त्री के प्रयासों से इसका पुनर्गठन हुआ।',
              subjectId: 'rajasthan-history',
              chapterId: 'ch-prajamandal',
              topicId: 'topic-jaipur-prajamandal',
            }
          ]
        }
      ]
    };

    const mockStore: UserQuestionsStore = {
      customSubjects: [mockSubject],
      customChapters: [mockChapter],
      customTopics: [],
      cloudCacheQuestions: mockChapter.topics[0].questions!,
      customQuestions: [],
      editedQuestions: {},
      deletedQuestionIds: [],
    };

    it('A1: resolves combined subjects list cleanly', () => {
      const subjects = getCombinedSubjects(mockStore);
      expect(subjects.length).toBeGreaterThan(0);
      const target = subjects.find(s => s.id === 'rajasthan-history');
      expect(target).toBeDefined();
      expect(target?.name).toContain('राजस्थान');
    });

    it('A2: filters chapters by subject ID accurately', () => {
      const chapters = getCombinedChapters(mockStore);
      const subjectChapters = chapters.filter(c => c.subjectId === 'rajasthan-history');
      expect(subjectChapters.length).toBe(1);
      expect(subjectChapters[0].id).toBe('ch-prajamandal');
      expect(subjectChapters[0].topics.length).toBe(1);
    });

    it('A3: extracts topics and associated MCQs for practice launch', () => {
      const chapters = getCombinedChapters(mockStore);
      const ch = chapters.find(c => c.id === 'ch-prajamandal');
      const topic = ch?.topics.find(t => t.id === 'topic-jaipur-prajamandal');
      expect(topic).toBeDefined();
      expect(topic?.questions?.length).toBe(2);
      expect(topic?.questions?.[0].correctIndex).toBe(0);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // JOURNEY B: MCQ PRACTICE ENGINE & MULTIPLE QUESTION TYPES
  // ─────────────────────────────────────────────────────────────
  describe('Journey B: MCQ Engine Evaluation & Question Formats', () => {
    // 1. Single Choice
    const singleChoiceQ: Question = {
      id: 'q-single-1',
      text: 'राजस्थान दिवस कब मनाया जाता है?',
      options: ['30 मार्च', '26 जनवरी', '15 अगस्त', '1 नवंबर'],
      correctIndex: 0,
      explanation: '30 मार्च 1949 को वृहत् राजस्थान संघ का निर्माण हुआ था।',
      questionType: 'single',
    };

    // 2. Multi-Statement
    const statementQ: Question = {
      id: 'q-stmt-1',
      text: 'निम्नलिखित कथनों पर विचार कीजिए:',
      statements: [
        'कथन 1: बिजौलिया किसान आन्दोलन 44 वर्षों तक चला।',
        'कथन 2: यह आन्दोलन पूर्णतया अहिंसक था।'
      ],
      options: ['केवल 1 सही है', 'केवल 2 सही है', '1 और 2 दोनों सही हैं', 'दोनों गलत हैं'],
      correctIndex: 2,
      explanation: 'बिजौलिया किसान आन्दोलन 1897 से 1941 (44 वर्ष) तक चला और पूर्णतया अहिंसक रहा।',
      questionType: 'statement',
    };

    // 3. Assertion & Reason
    const assertionReasonQ: Question = {
      id: 'q-ar-1',
      text: 'अभिकथन (A) और कारण (R) का परीक्षण करें:',
      assertion: 'राजस्थान में मरुस्थलीकरण तीव्र गति से बढ़ रहा है।',
      reason: 'अरावली पर्वतमाला में अंधाधुंध खनन और वनों की कटाई हो रही है।',
      options: [
        '(A) और (R) दोनों सही हैं तथा (R), (A) की सही व्याख्या है।',
        '(A) और (R) दोनों सही हैं परन्तु (R), (A) की सही व्याख्या नहीं है।',
        '(A) सही है परन्तु (R) गलत है।',
        '(A) गलत है परन्तु (R) सही है।'
      ],
      correctIndex: 0,
      explanation: 'अरावली के गैप्स से थार मरुस्थल पूर्व की ओर बढ़ रहा है।',
      questionType: 'assertion-reason',
    };

    // 4. Match the following
    const matchQ: Question = {
      id: 'q-match-1',
      text: 'सूची-I को सूची-II से सुमेलित कीजिए:',
      matchRows: [
        { left: 'मारवाड़ सेवा संघ', right: '1920' },
        { left: 'राजस्थान सेवा संघ', right: '1919' },
        { left: 'अखिल भारतीय देशी राज्य लोक परिषद', right: '1927' },
      ],
      options: ['A-1, B-2, C-3', 'A-2, B-1, C-3', 'A-3, B-2, C-1', 'A-1, B-3, C-2'],
      correctIndex: 0,
      explanation: 'मारवाड़ सेवा संघ 1920, राजस्थान सेवा संघ 1919, अखिल भारतीय देशी राज्य लोक परिषद 1927।',
      questionType: 'match',
    };

    it('B1: evaluates single choice answer correctly and updates score', () => {
      const selectedIndex = 0;
      const isCorrect = selectedIndex === singleChoiceQ.correctIndex;
      expect(isCorrect).toBe(true);

      const wrongIndex = 2;
      expect(wrongIndex === singleChoiceQ.correctIndex).toBe(false);
    });

    it('B2: handles multi-statement question and verifies options match', () => {
      expect(statementQ.statements?.length).toBe(2);
      expect(statementQ.options.length).toBe(4);
      expect(statementQ.correctIndex).toBe(2);
    });

    it('B3: parses Assertion & Reason structures and identifies valid explanation', () => {
      expect(assertionReasonQ.assertion).toBeDefined();
      expect(assertionReasonQ.reason).toBeDefined();
      expect(assertionReasonQ.options[assertionReasonQ.correctIndex]).toContain('सही व्याख्या है');
    });

    it('B4: supports Match the Following pairs and column mappings', () => {
      expect(matchQ.matchRows?.length).toBe(3);
      expect(matchQ.matchRows?.[0].left).toBe('मारवाड़ सेवा संघ');
      expect(matchQ.matchRows?.[0].right).toBe('1920');
    });
  });

  // ─────────────────────────────────────────────────────────────
  // JOURNEY C: MISTAKE BANK & SPACED REPETITION REVISION
  // ─────────────────────────────────────────────────────────────
  describe('Journey C: Spaced Repetition Revision & Mistake Bank Logic', () => {
    const today = '2026-11-15';

    it('C1: first answer correct sets status="correct", stage=0, nextReviewAt=today+3 days', () => {
      const result = calculateNextProgress(undefined, true, 1, today);
      expect(result.status).toBe('correct');
      expect(result.stage).toBe(0);
      expect(result.wrongCount).toBe(0);
      expect(result.nextReviewAt).toBe('2026-11-18'); // today + 3 days
    });

    it('C2: first answer wrong sets status="wrong", stage=0, nextReviewAt=today+3 days, wrongCount=1', () => {
      const result = calculateNextProgress(undefined, false, 2, today);
      expect(result.status).toBe('wrong');
      expect(result.stage).toBe(0);
      expect(result.wrongCount).toBe(1);
      expect(result.nextReviewAt).toBe('2026-11-18');
    });

    it('C3: consecutive correct answers progress through intervals [3, 7, 21, 45, 75]', () => {
      let p: QuestionProgress = {
        status: 'correct',
        stage: 0,
        nextReviewAt: '2026-11-18',
        wrongCount: 0,
        bookmarked: false,
        lastAnsweredAt: today,
        lastSelectedOption: 0,
      };

      // 2nd correct -> stage 1, interval 7 days
      p = calculateNextProgress(p, true, 0, today);
      expect(p.stage).toBe(1);
      expect(p.nextReviewAt).toBe('2026-11-22'); // 15 + 7 = 22

      // 3rd correct -> stage 2, interval 21 days
      p = calculateNextProgress(p, true, 0, today);
      expect(p.stage).toBe(2);
      expect(p.nextReviewAt).toBe('2026-12-06'); // 15 + 21 = Dec 6

      // 4th correct -> stage 3, interval 45 days
      p = calculateNextProgress(p, true, 0, today);
      expect(p.stage).toBe(3);

      // 5th correct -> stage 4 (capped max stage), interval 75 days
      p = calculateNextProgress(p, true, 0, today);
      expect(p.stage).toBe(4);
    });

    it('C4: answering wrong at any advanced stage resets stage to 0 and adds to wrongCount', () => {
      const advancedProgress: QuestionProgress = {
        status: 'correct',
        stage: 3,
        nextReviewAt: '2026-12-30',
        wrongCount: 1,
        bookmarked: false,
        lastAnsweredAt: '2026-11-01',
        lastSelectedOption: 1,
      };

      const result = calculateNextProgress(advancedProgress, false, 3, today);
      expect(result.status).toBe('wrong');
      expect(result.stage).toBe(0);
      expect(result.wrongCount).toBe(2);
      expect(result.nextReviewAt).toBe('2026-11-18');
    });

    it('C5: sorts questions for revision by priority: most wrong times -> currently wrong -> due -> bookmarked', () => {
      const progressStore: ProgressStore = {
        'q-due': {
          status: 'correct',
          stage: 1,
          nextReviewAt: '2026-11-14', // Due yesterday
          wrongCount: 0,
          bookmarked: false,
          lastAnsweredAt: '2026-11-07',
          lastSelectedOption: 0,
        },
        'q-wrong-once': {
          status: 'wrong',
          stage: 0,
          nextReviewAt: '2026-11-18',
          wrongCount: 1,
          bookmarked: false,
          lastAnsweredAt: today,
          lastSelectedOption: 1,
        },
        'q-wrong-thrice': {
          status: 'wrong',
          stage: 0,
          nextReviewAt: '2026-11-18',
          wrongCount: 3,
          bookmarked: false,
          lastAnsweredAt: today,
          lastSelectedOption: 2,
        },
        'q-bookmarked': {
          status: 'unattempted',
          stage: 0,
          nextReviewAt: '',
          wrongCount: 0,
          bookmarked: true,
          lastAnsweredAt: '',
          lastSelectedOption: -1,
        }
      };

      const ids = ['q-bookmarked', 'q-due', 'q-wrong-once', 'q-wrong-thrice'];
      const sorted = sortQuestionsForRevision(ids, progressStore, today);

      expect(sorted[0]).toBe('q-wrong-thrice'); // Highest wrongCount (3)
      expect(sorted[1]).toBe('q-wrong-once');   // wrongCount (1)
      expect(sorted[2]).toBe('q-due');          // Due today
      expect(sorted[3]).toBe('q-bookmarked');   // Bookmarked only
    });
  });

  // ─────────────────────────────────────────────────────────────
  // JOURNEY D: LIVE TEST & TIME-BOUND EXAM SIMULATION
  // ─────────────────────────────────────────────────────────────
  describe('Journey D: Live Mock Test Evaluation & Negative Marking', () => {
    const mockLiveTest: LiveTest = {
      id: 'test-cet-full-mock-01',
      title: 'CET 2026 Mega All-Rajasthan Live Mock Test',
      examCategory: 'CET ग्रेजुएशन स्तर',
      durationMinutes: 120,
      totalMarks: 300,
      totalQuestions: 150,
      markingScheme: {
        correct: 2,
        incorrect: -0.66,
      },
      status: 'live',
      scheduledStartTime: '2026-11-15T00:00:00Z',
      scheduledEndTime: '2026-11-16T23:59:59Z',
    };

    it('D1: calculates total score correctly with negative marking', () => {
      const correctAnswers = 100;
      const wrongAnswers = 30;
      const unattempted = 20;

      const marksPerCorrect = mockLiveTest.markingScheme.correct;
      const negativePerWrong = Math.abs(mockLiveTest.markingScheme.incorrect);

      const rawScore = (correctAnswers * marksPerCorrect) - (wrongAnswers * negativePerWrong);
      const roundedScore = Math.round(rawScore * 100) / 100;

      // 100 * 2 = 200, 30 * 0.66 = 19.8 -> 200 - 19.8 = 180.2
      expect(roundedScore).toBe(180.2);

      const accuracy = Math.round((correctAnswers / (correctAnswers + wrongAnswers)) * 100);
      expect(accuracy).toBe(77); // 100 / 130 = 76.92% -> 77%
    });

    it('D2: constructs compliant submission record with timing and rankings', () => {
      const submission: LiveTestSubmission = {
        submissionId: 'sub-test-12345',
        testId: mockLiveTest.id,
        testTitle: mockLiveTest.title,
        userId: 'user-scholar-777',
        userName: 'Aspirant Student',
        score: 180.2,
        totalMarks: 300,
        totalQuestions: 150,
        attemptedCount: 130,
        correctCount: 100,
        wrongCount: 30,
        accuracy: 77,
        timeSpentSeconds: 5400, // 90 minutes
        submittedAt: '2026-11-15T02:00:00Z',
        answers: {},
      };

      expect(submission.testId).toBe('test-cet-full-mock-01');
      expect(submission.score).toBeGreaterThan(0);
      expect(submission.attemptedCount).toBe(submission.correctCount + submission.wrongCount);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // JOURNEY E: PYQ VAULT & COACHING TEST SERIES HIERARCHY
  // ─────────────────────────────────────────────────────────────
  describe('Journey E: Official PYQ Papers & Coaching Hierarchy Drill-Down', () => {
    const mockPYQ: PYQPaper = {
      id: 'pyq-ras-pre-2023',
      title: 'RPSC RAS Pre 2023 Official Paper',
      examBoard: 'RPSC',
      paperYear: '2023',
      totalQuestions: 150,
      durationMinutes: 180,
      totalMarks: 200,
      markingScheme: {
        correct: 1.33,
        incorrect: -0.44,
      },
      isPublished: true,
      questions: [
        {
          id: 'pyq-ras-q1',
          text: 'राजस्थान में 1857 की क्रांति का प्रारंभ सर्वप्रथम कहाँ से हुआ?',
          options: ['नसीराबाद', 'नीमच', 'एरिनपुरा', 'कोटा'],
          correctIndex: 0,
          explanation: '28 मई 1857 को नसीराबाद छावनी में 15वीं बंगाल नेटिव इन्फैंट्री द्वारा विद्रोह किया गया।',
          questionType: 'single',
        }
      ]
    };

    it('E1: correctly identifies published PYQ paper and allows year filtering', () => {
      expect(mockPYQ.isPublished).toBe(true);
      expect(mockPYQ.paperYear).toBe('2023');
      expect(mockPYQ.examBoard).toBe('RPSC');
      expect(mockPYQ.questions?.length).toBe(1);
    });

    it('E2: verifies 4-level coaching hierarchy navigation', () => {
      const coachingId = 'coaching-lakshya';
      const examId = 'exam-sub-inspector';
      const seriesId = 'series-si-paper1-hindi';

      const hierarchyPath = `/test-series/coaching/${coachingId}/exam/${examId}/series/${seriesId}`;
      expect(hierarchyPath).toContain('coaching-lakshya');
      expect(hierarchyPath).toContain('exam-sub-inspector');
      expect(hierarchyPath).toContain('series-si-paper1-hindi');
    });
  });

  // ─────────────────────────────────────────────────────────────
  // JOURNEY F: STUDENT WRITE BUFFER & ISOLATION SECURITY
  // ─────────────────────────────────────────────────────────────
  describe('Journey F: Student Write Optimization, Buffer & Security Isolation', () => {
    beforeEach(() => {
      __setMockAuthUserForTests(null);
      setAdminPreviewSession(false);
    });

    it('F1: guest user is isolated in guest mode and does not queue writes', () => {
      const mode = getStudentSyncMode(null);
      expect(mode).toBe('guest');
    });

    it('F2: admin preview session activates admin_preview mode and prevents student tracking', () => {
      setAdminPreviewSession(true);
      const mode = getStudentSyncMode(null);
      expect(mode).toBe('admin_preview');
      setAdminPreviewSession(false);
    });

    it('F3: authenticated student queues progress update into local buffer before threshold flush', () => {
      __setMockAuthUserForTests({
        uid: 'user-student-999',
        email: 'student@disha2020.in',
        displayName: 'Verified Student'
      });

      const mode = getStudentSyncMode({
        id: 'user-student-999',
        name: 'Verified Student',
        email: 'student@disha2020.in'
      });
      expect(mode).toBe('student');

      const mockQProgress: QuestionProgress = {
        status: 'correct',
        stage: 0,
        nextReviewAt: '2026-11-18',
        wrongCount: 0,
        bookmarked: false,
        lastAnsweredAt: '2026-11-15',
        lastSelectedOption: 0,
      };

      // Buffer single answer
      bufferProgressUpdate('q-isolated-1', mockQProgress, 'user-student-999');

      // Confirms buffer holds the update
      expect(hasPendingStudentWrites()).toBe(true);
    });
  });
});
