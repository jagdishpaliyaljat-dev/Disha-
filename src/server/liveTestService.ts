import type { VerifiedUserContext } from './authMiddleware';

const SAFE_ID_REGEX = /^[a-zA-Z0-9_.-]{1,128}$/;

export function isValidFirestoreDocId(id: unknown): id is string {
  return typeof id === 'string' && SAFE_ID_REGEX.test(id) && id !== '.' && id !== '..';
}

export function stripAnswerFieldsFromQuestion<T extends Record<string, any>>(q: T): Omit<T, 'correctIndex' | 'correctOption' | 'answer' | 'explanation' | 'solution' | 'importantFact' | 'correctOptionText'> {
  if (!q || typeof q !== 'object') return q;
  const {
    correctIndex: _ci,
    correctOption: _co,
    answer: _ans,
    explanation: _exp,
    solution: _sol,
    importantFact: _imp,
    correctOptionText: _cot,
    ...publicFields
  } = q;
  return publicFields;
}

export function sanitizeLiveTestForPublic<T extends Record<string, any>>(test: T): T {
  if (!test || typeof test !== 'object') return test;
  const {
    answerKey: _ak,
    answerKeys: _aks,
    answers: _as,
    correctAnswers: _cas,
    ...rest
  } = test;

  const sanitizedQuestions = Array.isArray(rest.questions)
    ? rest.questions.map((q: any) =>
        typeof q === 'object' && q !== null ? stripAnswerFieldsFromQuestion(q) : q
      )
    : rest.questions;

  return {
    ...rest,
    questions: sanitizedQuestions,
  } as unknown as T;
}

export interface AnswerKeyEntry {
  correctIndex: number;
  explanation?: string;
  importantFact?: string;
}

export interface LiveTestAnswerKeyDoc {
  testId: string;
  title: string;
  marksPerQuestion: number;
  negativeMarking: number;
  totalMarks: number;
  allowReattempt: boolean;
  updatedAt: string;
  answers: Record<string, AnswerKeyEntry>;
}

export function buildAnswerKeyFromTest(test: Record<string, any>): LiveTestAnswerKeyDoc {
  const answers: Record<string, AnswerKeyEntry> = {};
  const qs = Array.isArray(test.questions) ? test.questions : [];
  qs.forEach((q: any, idx: number) => {
    if (q && typeof q === 'object') {
      const qId = String(q.id || `live_${test.id}_q_${idx}`);
      const ci = typeof q.correctIndex === 'number' && Number.isInteger(q.correctIndex) ? q.correctIndex : -1;
      if (ci >= 0) {
        answers[qId] = {
          correctIndex: ci,
          ...(q.explanation ? { explanation: String(q.explanation) } : {}),
          ...(q.importantFact ? { importantFact: String(q.importantFact) } : {}),
        };
      }
    }
  });

  return {
    testId: String(test.id || ''),
    title: String(test.title || ''),
    marksPerQuestion: Number(test.marksPerQuestion ?? 2),
    negativeMarking: Number(test.negativeMarking ?? 0.66),
    totalMarks: Number(test.totalMarks ?? qs.length * Number(test.marksPerQuestion ?? 2)),
    allowReattempt: test.allowReattempt !== false,
    updatedAt: new Date().toISOString(),
    answers,
  };
}

export interface LiveTestSubmitInput {
  submissionId?: string;
  answers: Record<string, number | null>;
  timeSpentSeconds: number;
  userName?: string;
}

export interface GradeResult {
  status: number;
  body: Record<string, any>;
}

export async function gradeAndSubmitLiveTest(params: {
  testId: string;
  authUser: VerifiedUserContext;
  body: any;
  adminDb: any;
}): Promise<GradeResult> {
  const { testId, authUser, body, adminDb } = params;

  if (!isValidFirestoreDocId(testId)) {
    return {
      status: 400,
      body: { success: false, error: 'Invalid live test ID.' },
    };
  }

  if (!adminDb) {
    return {
      status: 503,
      body: { success: false, error: 'Database service unavailable for grading.' },
    };
  }

  if (!body || typeof body !== 'object' || !body.answers || typeof body.answers !== 'object' || Array.isArray(body.answers)) {
    return {
      status: 400,
      body: { success: false, error: 'Invalid submission payload: answers map is required.' },
    };
  }

  const rawTime = Number(body.timeSpentSeconds ?? 0);
  if (!Number.isFinite(rawTime) || rawTime < 0 || rawTime > 86400) {
    return {
      status: 400,
      body: { success: false, error: 'Invalid timeSpentSeconds value.' },
    };
  }

  const submittedAnswers = body.answers as Record<string, unknown>;
  const answerEntries = Object.entries(submittedAnswers);
  if (answerEntries.length > 500) {
    return {
      status: 400,
      body: { success: false, error: 'Too many answer entries in submission.' },
    };
  }

  for (const [qId, selected] of answerEntries) {
    if (!qId || typeof qId !== 'string' || qId.length > 128) {
      return {
        status: 400,
        body: { success: false, error: 'Invalid question ID in answers map.' },
      };
    }
    if (selected !== null && selected !== undefined) {
      if (typeof selected !== 'number' || !Number.isInteger(selected) || selected < -1 || selected > 11) {
        return {
          status: 400,
          body: { success: false, error: `Invalid answer index for question ${qId}.` },
        };
      }
    }
  }

  const requestedSubId = typeof body.submissionId === 'string' && body.submissionId.trim()
    ? body.submissionId.trim()
    : `sub_${authUser.uid}_${testId}_${Date.now()}`;

  if (!isValidFirestoreDocId(requestedSubId)) {
    return {
      status: 400,
      body: { success: false, error: 'Invalid submissionId format.' },
    };
  }

  // Fetch public live test metadata + private answer key doc
  const [testSnap, keySnap] = await Promise.all([
    adminDb.collection('liveTests').doc(testId).get(),
    adminDb.collection('liveTestAnswerKeys').doc(testId).get(),
  ]);

  if (!testSnap.exists && !keySnap.exists) {
    return {
      status: 404,
      body: { success: false, error: 'Live test not found.' },
    };
  }

  const testData: Record<string, any> = testSnap.exists ? (testSnap.data() || {}) : {};
  const keyDoc: Record<string, any> = keySnap.exists ? (keySnap.data() || {}) : {};

  if (testData.status === 'draft' && !authUser.isAdmin) {
    return {
      status: 403,
      body: { success: false, error: 'This live test is not published.' },
    };
  }

  // Extract authoritative answer key map (private collection first, fallback to unmigrated legacy test doc on server only)
  let answerKeyMap: Record<string, AnswerKeyEntry> = {};
  if (keyDoc.answers && typeof keyDoc.answers === 'object') {
    answerKeyMap = keyDoc.answers as Record<string, AnswerKeyEntry>;
  } else {
    const legacyKey = buildAnswerKeyFromTest({ ...testData, id: testId });
    answerKeyMap = legacyKey.answers;
  }

  const questionIds = Array.from(
    new Set([
      ...Object.keys(answerKeyMap),
      ...(Array.isArray(testData.questions)
        ? testData.questions.map((q: any, idx: number) =>
            typeof q === 'string' ? q : String(q?.id || `live_${testId}_q_${idx}`)
          )
        : []),
    ])
  );

  if (Object.keys(answerKeyMap).length === 0) {
    return {
      status: 422,
      body: { success: false, error: 'Server answer key is not configured for this live test.' },
    };
  }

  // Reject replay of existing submissionId
  const existingSubSnap = await adminDb.collection('liveTestSubmissions').doc(requestedSubId).get();
  if (existingSubSnap.exists) {
    return {
      status: 409,
      body: { success: false, error: 'Duplicate submission ID.' },
    };
  }

  // Enforce single-attempt policy when allowReattempt === false
  const allowReattempt =
    testData.allowReattempt !== undefined
      ? testData.allowReattempt !== false
      : keyDoc.allowReattempt !== false;

  if (!allowReattempt) {
    const priorSnap = await adminDb
      .collection('liveTestSubmissions')
      .where('userId', '==', authUser.uid)
      .where('testId', '==', testId)
      .limit(1)
      .get();

    if (priorSnap && !priorSnap.empty) {
      return {
        status: 409,
        body: {
          success: false,
          error: 'Duplicate submission: you have already submitted this live test and reattempts are disabled.',
        },
      };
    }
  }

  // Validate that all submitted question IDs belong to this live test
  const validQuestionSet = new Set(questionIds);
  for (const [qId] of answerEntries) {
    if (!validQuestionSet.has(qId)) {
      return {
        status: 400,
        body: { success: false, error: `Unknown question ID '${qId}' for live test '${testId}'.` },
      };
    }
  }

  const marksPerQ = Number(testData.marksPerQuestion ?? keyDoc.marksPerQuestion ?? 2);
  const negMarksPerQ = Number(testData.negativeMarking ?? keyDoc.negativeMarking ?? 0.66);
  const totalQuestionCount = Math.max(questionIds.length, Number(testData.questionCount || 0));
  const totalMarks = Number(testData.totalMarks ?? keyDoc.totalMarks ?? totalQuestionCount * marksPerQ);

  let correctCount = 0;
  let wrongCount = 0;
  let unattemptedECount = 0;
  let completelyBlankCount = 0;

  const questionResults: Record<
    string,
    {
      selectedIndex: number;
      correctIndex: number;
      isCorrect: boolean;
      isUnattemptedE?: boolean;
      isCompletelyBlank?: boolean;
      explanation?: string;
      importantFact?: string;
    }
  > = {};

  for (const qId of questionIds) {
    const keyEntry = answerKeyMap[qId];
    if (!keyEntry) continue;

    const rawSel = submittedAnswers[qId];
    if (rawSel === 4) {
      // Option E (index 4): candidate intentionally filled 'अनुत्तरित प्रश्न' (0 penalty under RPSC rules)
      unattemptedECount++;
      questionResults[qId] = {
        selectedIndex: 4,
        correctIndex: keyEntry.correctIndex,
        isCorrect: false,
        isUnattemptedE: true,
        ...(keyEntry.explanation ? { explanation: keyEntry.explanation } : {}),
        ...(keyEntry.importantFact ? { importantFact: keyEntry.importantFact } : {}),
      };
    } else if (typeof rawSel === 'number' && Number.isInteger(rawSel) && rawSel >= 0 && rawSel <= 3) {
      const isCorrect = rawSel === keyEntry.correctIndex;
      if (isCorrect) correctCount++;
      else wrongCount++;

      questionResults[qId] = {
        selectedIndex: rawSel,
        correctIndex: keyEntry.correctIndex,
        isCorrect,
        ...(keyEntry.explanation ? { explanation: keyEntry.explanation } : {}),
        ...(keyEntry.importantFact ? { importantFact: keyEntry.importantFact } : {}),
      };
    } else {
      // Completely blank / unmarked question (Incurs 1/3 negative marking under RPSC rules)
      completelyBlankCount++;
      questionResults[qId] = {
        selectedIndex: -1,
        correctIndex: keyEntry.correctIndex,
        isCorrect: false,
        isCompletelyBlank: true,
        ...(keyEntry.explanation ? { explanation: keyEntry.explanation } : {}),
        ...(keyEntry.importantFact ? { importantFact: keyEntry.importantFact } : {}),
      };
    }
  }

  const attemptedCount = correctCount + wrongCount;
  const unattemptedCount = unattemptedECount + completelyBlankCount;
  const blankPenalty = completelyBlankCount * (marksPerQ / 3);
  const rawScore = correctCount * marksPerQ - wrongCount * negMarksPerQ - blankPenalty;
  const finalScore = Math.max(0, Number(rawScore.toFixed(2)));
  const accuracy = attemptedCount > 0 ? Math.round((correctCount / attemptedCount) * 100) : 0;
  const isRpscDisqualified = totalQuestionCount > 0 && completelyBlankCount > totalQuestionCount * 0.10;

  const safeUserName =
    typeof body.userName === 'string' && body.userName.trim()
      ? body.userName.trim().slice(0, 80)
      : String(authUser.userDoc?.displayName || authUser.userDoc?.name || 'Aspirant').slice(0, 80);

  const submission = {
    submissionId: requestedSubId,
    userId: authUser.uid,
    userName: safeUserName,
    userEmail: authUser.email || '',
    testId,
    testTitle: String(testData.title || keyDoc.title || testId),
    score: finalScore,
    totalMarks,
    correctCount,
    wrongCount,
    unattemptedCount,
    unattemptedECount,
    completelyBlankCount,
    blankPenalty: Number(blankPenalty.toFixed(2)),
    isRpscDisqualified,
    accuracy,
    timeSpentSeconds: Math.round(rawTime),
    submittedAt: new Date().toISOString(),
    gradedServerSide: true,
  };

  await adminDb.collection('liveTestSubmissions').doc(requestedSubId).create(submission);

  return {
    status: 200,
    body: {
      success: true,
      submission,
      results: questionResults,
    },
  };
}
