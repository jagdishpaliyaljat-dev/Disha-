import { LiveTest, LiveTestSubmission, Question } from "../types";
import { deduplicateQuestions } from "./questionsStorage";
import { isUserAdmin, loadUserProfile } from "./userProfileStorage";
import { safeSetLocalStorageItem } from "./safeStorage";
import { supabase, isSupabaseConfigured } from "../lib/supabase";

const LIVE_TESTS_STORAGE_KEY = "remix_rajprep_live_tests_v1";
const LIVE_SUBMISSIONS_STORAGE_KEY = "remix_rajprep_live_submissions_v1";
const DELETED_LIVE_TESTS_KEY = "remix_rajprep_deleted_live_tests_v1";

let inMemoryLiveTests: LiveTest[] | null = null;

export const INITIAL_LIVE_TESTS: LiveTest[] = [];

/**
 * Strips confidential answer fields and explanations before serving questions to regular students.
 */
export function stripAnswerFieldsFromQuestion<T extends Record<string, any>>(q: T): T {
  if (!q || typeof q !== "object") return q;
  const {
    correctIndex: _ci,
    correctOption: _co,
    answer: _ans,
    explanation: _exp,
    importantFact: _imp,
    ...safeQ
  } = q;
  return safeQ as T;
}

/**
 * Sanitizes a live test by stripping answer fields from its questions for students.
 */
export function sanitizeLiveTestForPublic(test: LiveTest): LiveTest {
  if (!test) return test;
  return {
    ...test,
    questions: Array.isArray(test.questions)
      ? test.questions.map((q) => stripAnswerFieldsFromQuestion(q))
      : [],
  };
}

export function getDeletedLiveTestIds(): string[] {
  try {
    const raw = localStorage.getItem(DELETED_LIVE_TESTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function addDeletedLiveTestId(id: string): void {
  try {
    const ids = getDeletedLiveTestIds();
    if (!ids.includes(id)) {
      ids.push(id);
      localStorage.setItem(DELETED_LIVE_TESTS_KEY, JSON.stringify(ids));
    }
  } catch {}
}

/** Clears the local tombstones after a full cloud sync/restore. */
export function clearDeletedLiveTestIds(): void {
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.removeItem(DELETED_LIVE_TESTS_KEY);
    }
  } catch {}
}

export function loadLocalLiveTests(): LiveTest[] {
  try {
    if (typeof window === "undefined" || !window.localStorage) {
      return inMemoryLiveTests || INITIAL_LIVE_TESTS;
    }
    const raw = localStorage.getItem(LIVE_TESTS_STORAGE_KEY);
    if (!raw) {
      inMemoryLiveTests = INITIAL_LIVE_TESTS;
      return INITIAL_LIVE_TESTS;
    }
    const parsed = JSON.parse(raw);
    const result = Array.isArray(parsed) ? parsed : INITIAL_LIVE_TESTS;
    inMemoryLiveTests = result;
    return result;
  } catch (e) {
    console.error("Error loading local live tests:", e);
    return INITIAL_LIVE_TESTS;
  }
}

export function saveLocalLiveTests(tests: LiveTest[]): void {
  inMemoryLiveTests = tests;
  safeSetLocalStorageItem(LIVE_TESTS_STORAGE_KEY, JSON.stringify(tests));
}

export async function hydrateLiveTestForAdmin(test: LiveTest): Promise<LiveTest> {
  if (!test || !test.id) return test;
  const admin = isUserAdmin(loadUserProfile());
  if (admin) {
    // If questions were stripped locally, try to hydrate from Supabase
    if (isSupabaseConfigured() && (!test.questions || test.questions.length === 0 || !("correctIndex" in (test.questions[0] || {})))) {
      try {
        const { data } = await supabase.from("live_tests").select("questions").eq("id", test.id).maybeSingle();
        if (data && Array.isArray(data.questions) && data.questions.length > 0) {
          return { ...test, questions: data.questions };
        }
      } catch (_) {}
    }
    return test;
  }
  return sanitizeLiveTestForPublic(test);
}

/**
 * Fetches all live tests from Supabase with offline-first fallback to local storage.
 */
export async function fetchLiveTests(): Promise<LiveTest[]> {
  const admin = isUserAdmin(loadUserProfile());
  const deletedIds = new Set(getDeletedLiveTestIds());

  if (isSupabaseConfigured()) {
    try {
      const { data, error } = await supabase
        .from("live_tests")
        .select("*")
        .order("created_at", { ascending: false });

      if (!error && Array.isArray(data)) {
        const mappedTests: LiveTest[] = data.map((row: any) => ({
          id: row.id,
          title: row.title,
          hindiTitle: row.hindi_title || row.title,
          examCategory: row.exam_category || "RAS Pre",
          status: row.status || "upcoming",
          startTime: row.start_time || undefined,
          endTime: row.end_time || undefined,
          durationMinutes: Number(row.duration_minutes) || 120,
          totalMarks: Number(row.total_marks) || 200,
          marksPerQuestion: Number(row.marks_per_question) || 2,
          negativeMarking: Number(row.negative_marking) || 0.66,
          questionCount: Number(row.question_count) || (Array.isArray(row.questions) ? row.questions.length : 0),
          questions: Array.isArray(row.questions) ? row.questions : [],
          instructions: row.instructions || "",
          participantCount: Number(row.participant_count) || 0,
          createdAt: row.created_at || new Date().toISOString(),
          updatedAt: row.updated_at || new Date().toISOString(),
        }));

        const local = loadLocalLiveTests();
        const serverIds = new Set(mappedTests.map((t) => t.id));
        const stagedLocal = local.filter((t) => !serverIds.has(t.id) && !deletedIds.has(t.id));
        const merged = [...mappedTests.filter((t) => !deletedIds.has(t.id)), ...stagedLocal];

        saveLocalLiveTests(merged);
        return merged.map((t) => (admin ? t : sanitizeLiveTestForPublic(t)));
      }
    } catch (e) {
      console.warn("[LiveTestStorage] Error fetching live tests from Supabase:", e);
    }
  }

  const local = loadLocalLiveTests()
    .filter((t) => !deletedIds.has(t.id))
    .map((t) => (admin ? t : sanitizeLiveTestForPublic(t)));
  return local;
}

/**
 * Saves or updates a Live Test in Supabase and local storage.
 */
export async function saveLiveTest(test: Partial<LiveTest> & { id: string; title: string }): Promise<LiveTest[]> {
  const current = loadLocalLiveTests();
  const idx = current.findIndex((t) => t.id === test.id);
  const questions = Array.isArray(test.questions) ? deduplicateQuestions(test.questions) : [];

  const updatedTest: LiveTest = {
    ...current[idx],
    ...test,
    questions,
    updatedAt: new Date().toISOString(),
    questionCount: questions.length,
    createdAt: idx >= 0 && current[idx]?.createdAt ? current[idx].createdAt : (test.createdAt || new Date().toISOString()),
  };

  let newList: LiveTest[];
  if (idx >= 0) {
    newList = [...current];
    newList[idx] = updatedTest;
  } else {
    newList = [updatedTest, ...current];
  }

  saveLocalLiveTests(newList);

  // Sync to Supabase
  if (isSupabaseConfigured()) {
    try {
      await supabase.from("live_tests").upsert({
        id: updatedTest.id,
        title: updatedTest.title,
        hindi_title: updatedTest.hindiTitle || updatedTest.title,
        exam_category: updatedTest.examCategory || "RAS Pre",
        status: updatedTest.status || "live",
        start_time: updatedTest.startTime || null,
        end_time: updatedTest.endTime || null,
        duration_minutes: Number(updatedTest.durationMinutes) || 120,
        total_marks: Number(updatedTest.totalMarks) || 200,
        marks_per_question: Number(updatedTest.marksPerQuestion) || 2,
        negative_marking: Number(updatedTest.negativeMarking) || 0.66,
        question_count: updatedTest.questionCount,
        questions: updatedTest.questions,
        instructions: updatedTest.instructions || "",
        participant_count: Number(updatedTest.participantCount) || 0,
        updated_at: updatedTest.updatedAt,
      });
    } catch (e) {
      console.error("[LiveTestStorage] Failed to save live test to Supabase:", e);
    }
  }

  return newList;
}

/**
 * Deletes a Live Test from Supabase and local storage.
 */
export async function deleteLiveTest(testId: string): Promise<LiveTest[]> {
  const current = loadLocalLiveTests();
  const newList = current.filter((t) => t.id !== testId);
  saveLocalLiveTests(newList);
  addDeletedLiveTestId(testId);

  if (isSupabaseConfigured()) {
    try {
      await supabase.from("live_tests").delete().eq("id", testId);
    } catch (e) {
      console.error("[LiveTestStorage] Failed to delete live test from Supabase:", e);
    }
  }

  return newList;
}

export function loadLocalLiveSubmissions(): LiveTestSubmission[] {
  try {
    const raw = localStorage.getItem(LIVE_SUBMISSIONS_STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (e) {
    console.error("Error loading local live submissions:", e);
    return [];
  }
}

export function saveLocalLiveSubmissions(subs: LiveTestSubmission[]): void {
  safeSetLocalStorageItem(LIVE_SUBMISSIONS_STORAGE_KEY, JSON.stringify(subs));
}

/**
 * Fetches Live Test submissions from Supabase with local fallback, sorted by highest score.
 */
export async function fetchLiveTestSubmissions(testId?: string): Promise<LiveTestSubmission[]> {
  if (isSupabaseConfigured()) {
    try {
      let query = supabase
        .from("live_test_submissions")
        .select("*")
        .order("score", { ascending: false });

      if (testId) {
        query = query.eq("test_id", testId);
      }

      const { data, error } = await query;
      if (!error && Array.isArray(data)) {
        const mappedSubs: LiveTestSubmission[] = data.map((r: any, idx: number) => ({
          submissionId: r.submission_id,
          testId: r.test_id,
          userId: r.user_id,
          userName: r.user_name || "Aspirant",
          userEmail: r.user_email || undefined,
          testTitle: r.test_title || "",
          score: Number(r.score) || 0,
          totalMarks: Number(r.total_marks) || 200,
          correctCount: Number(r.correct_count) || 0,
          wrongCount: Number(r.wrong_count) || 0,
          unattemptedCount: Number(r.unattempted_count) || 0,
          unattemptedECount: Number(r.unattempted_e_count) || 0,
          completelyBlankCount: Number(r.completely_blank_count) || 0,
          blankPenalty: Number(r.blank_penalty) || 0,
          isRpscDisqualified: Boolean(r.is_rpsc_disqualified),
          accuracy: Number(r.accuracy) || 0,
          timeSpentSeconds: Number(r.time_spent_seconds) || 0,
          submittedAt: r.submitted_at || new Date().toISOString(),
          rank: idx + 1,
        }));

        const local = loadLocalLiveSubmissions();
        const serverIds = new Set(mappedSubs.map((s) => s.submissionId));
        const localOnly = local.filter((s) => !serverIds.has(s.submissionId) && (!testId || s.testId === testId));
        const merged = [...mappedSubs, ...localOnly].sort((a, b) => b.score - a.score);

        merged.forEach((sub, i) => {
          sub.rank = i + 1;
        });

        saveLocalLiveSubmissions(merged);
        return merged;
      }
    } catch (e) {
      console.warn("[LiveTestStorage] Error fetching submissions from Supabase:", e);
    }
  }

  const local = loadLocalLiveSubmissions()
    .filter((s) => !testId || s.testId === testId)
    .sort((a, b) => b.score - a.score);
  local.forEach((sub, i) => {
    sub.rank = i + 1;
  });
  return local;
}

/**
 * Subscribes to live tests with Realtime support.
 */
export function subscribeToLiveTests(
  callback: (tests: LiveTest[]) => void
): () => void {
  const deletedIds = new Set(getDeletedLiveTestIds());
  const admin = isUserAdmin(loadUserProfile());
  const initial = loadLocalLiveTests()
    .filter((t) => !deletedIds.has(t.id))
    .map((t) => (admin ? t : sanitizeLiveTestForPublic(t)));
  callback(initial);

  fetchLiveTests().then((fresh) => {
    callback(fresh);
  }).catch(() => {});

  let channel: any = null;
  if (isSupabaseConfigured()) {
    try {
      channel = supabase
        .channel("public:live_tests_changes")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "live_tests" },
          () => {
            fetchLiveTests().then((updated) => callback(updated)).catch(() => {});
          }
        )
        .subscribe();
    } catch (err) {
      console.warn("[LiveTestStorage] Realtime subscription error:", err);
    }
  }

  return () => {
    if (channel) {
      try {
        supabase.removeChannel(channel);
      } catch (_) {}
    }
  };
}

export async function submitLiveTestSubmission(submission: LiveTestSubmission): Promise<void> {
  const local = loadLocalLiveSubmissions();
  const existingIdx = local.findIndex(
    (s) => s.submissionId === submission.submissionId || (s.testId === submission.testId && s.userId === submission.userId)
  );
  if (existingIdx >= 0) {
    local[existingIdx] = submission;
  } else {
    local.unshift(submission);
  }
  saveLocalLiveSubmissions(local);

  if (isSupabaseConfigured()) {
    try {
      await supabase.from("live_test_submissions").upsert({
        submission_id: submission.submissionId,
        test_id: submission.testId,
        user_id: submission.userId,
        user_name: submission.userName,
        user_email: submission.userEmail || null,
        test_title: submission.testTitle,
        score: submission.score,
        total_marks: submission.totalMarks,
        correct_count: submission.correctCount,
        wrong_count: submission.wrongCount,
        unattempted_count: submission.unattemptedCount,
        unattempted_e_count: submission.unattemptedECount || 0,
        completely_blank_count: submission.completelyBlankCount || 0,
        blank_penalty: submission.blankPenalty || 0,
        is_rpsc_disqualified: Boolean(submission.isRpscDisqualified),
        accuracy: submission.accuracy,
        time_spent_seconds: submission.timeSpentSeconds,
        submitted_at: submission.submittedAt,
      });

      if (isUserAdmin(loadUserProfile())) {
        const { count } = await supabase
          .from("live_test_submissions")
          .select("*", { count: "exact", head: true })
          .eq("test_id", submission.testId);

        if (typeof count === "number") {
          await supabase.from("live_tests").update({ participant_count: count }).eq("id", submission.testId);
        }
      }
    } catch (err) {
      console.warn("[LiveTestStorage] Supabase submission sync error:", err);
    }
  }
}

export async function fetchMCQsByLiveTest(testId: string): Promise<any[]> {
  const admin = isUserAdmin(loadUserProfile());
  const localTests = loadLocalLiveTests();
  const found = localTests.find((t) => t.id === testId);
  if (found && Array.isArray(found.questions) && found.questions.length > 0) {
    return admin ? found.questions : found.questions.map(stripAnswerFieldsFromQuestion);
  }

  if (isSupabaseConfigured()) {
    try {
      const { data } = await supabase
        .from("live_tests")
        .select("questions")
        .eq("id", testId)
        .maybeSingle();

      if (data && Array.isArray(data.questions) && data.questions.length > 0) {
        return admin ? data.questions : data.questions.map(stripAnswerFieldsFromQuestion);
      }
    } catch (_) {}
  }

  return [];
}

export interface DirectGradeOptions {
  submissionId: string;
  testId: string;
  answers: Record<string, number>;
  timeSpentSeconds: number;
  userProfile?: any;
  sessionDetails?: any;
  fallbackQuestions?: Question[];
}

/**
 * Authoritative grading and cloud submission engine for Live Tests.
 * Ensures tests are graded with the official questions and synced directly to Supabase.
 */
export async function gradeAndSubmitLiveTestDirectly(options: DirectGradeOptions): Promise<{
  success: boolean;
  submission: LiveTestSubmission;
  results: Record<string, { selectedIndex: number; isCorrect: boolean; correctIndex: number; explanation?: string; importantFact?: string }>;
  error?: string;
}> {
  const { submissionId, testId, answers, timeSpentSeconds, userProfile, sessionDetails, fallbackQuestions = [] } = options;

  let testQuestions: Question[] = [];
  let testTitle = sessionDetails?.title || "Live Mock Test";
  let marksPerQuestion = Number(sessionDetails?.marksPerQuestion) || 2;
  let negativeMarking = sessionDetails?.negativeMarking !== undefined ? Number(sessionDetails?.negativeMarking) : 0.66;
  let totalMarks = Number(sessionDetails?.totalMarks) || 200;

  // 1. Fetch authoritative questions with correct answers from Supabase
  if (isSupabaseConfigured()) {
    try {
      const { data } = await supabase
        .from("live_tests")
        .select("*")
        .eq("id", testId)
        .maybeSingle();

      if (data) {
        if (Array.isArray(data.questions) && data.questions.length > 0) {
          testQuestions = data.questions;
        }
        if (data.title) testTitle = data.title;
        if (data.marks_per_question) marksPerQuestion = Number(data.marks_per_question);
        if (data.negative_marking !== undefined && data.negative_marking !== null) negativeMarking = Number(data.negative_marking);
        if (data.total_marks) totalMarks = Number(data.total_marks);
      }
    } catch (e) {
      console.warn("[LiveTestStorage] Error fetching test for direct grading:", e);
    }
  }

  // Fallback to local memory/storage or session
  if (testQuestions.length === 0) {
    const local = loadLocalLiveTests();
    const found = local.find((t) => t.id === testId);
    if (found && Array.isArray(found.questions) && found.questions.length > 0) {
      testQuestions = found.questions;
      if (found.title) testTitle = found.title;
      if (found.marksPerQuestion) marksPerQuestion = found.marksPerQuestion;
      if (found.negativeMarking !== undefined) negativeMarking = found.negativeMarking;
      if (found.totalMarks) totalMarks = found.totalMarks;
    } else if (fallbackQuestions.length > 0) {
      testQuestions = fallbackQuestions;
    }
  }

  // 2. Grade each question
  const results: Record<string, { selectedIndex: number; isCorrect: boolean; correctIndex: number; explanation?: string; importantFact?: string }> = {};
  let correctCount = 0;
  let wrongCount = 0;
  let unattemptedCount = 0;
  let unattemptedECount = 0;

  testQuestions.forEach((q, idx) => {
    const qId = q.id || `q_${idx}`;
    const selected = answers[qId] !== undefined ? answers[qId] : answers[String(idx)];
    const correctIdx = typeof q.correctIndex === "number" ? q.correctIndex : (typeof (q as any).correct_answer === "number" ? (q as any).correct_answer : 0);

    const hasAnswered = typeof selected === "number" && selected >= 0;
    const isOptionE = selected === 4;

    let isCorrect = false;
    if (hasAnswered) {
      if (isOptionE) {
        unattemptedECount++;
      } else if (selected === correctIdx) {
        isCorrect = true;
        correctCount++;
      } else {
        wrongCount++;
      }
    } else {
      unattemptedCount++;
    }

    results[qId] = {
      selectedIndex: hasAnswered ? selected : -1,
      isCorrect,
      correctIndex: correctIdx,
      explanation: q.explanation,
      importantFact: q.importantFact,
    };
  });

  const rawScore = correctCount * marksPerQuestion - wrongCount * negativeMarking;
  const finalScore = Math.max(0, Number(rawScore.toFixed(2)));
  const accuracy = (correctCount + wrongCount) > 0 ? Math.round((correctCount / (correctCount + wrongCount)) * 100) : 0;

  const submission: LiveTestSubmission = {
    submissionId: submissionId || `sub_${userProfile?.id || "guest"}_${testId}_${Date.now()}`,
    userId: userProfile?.id || "guest_user",
    userName: userProfile?.name || "Aspirant",
    userEmail: userProfile?.email,
    testId,
    testTitle,
    score: finalScore,
    totalMarks,
    correctCount,
    wrongCount,
    unattemptedCount,
    unattemptedECount,
    completelyBlankCount: unattemptedCount,
    blankPenalty: 0,
    isRpscDisqualified: false,
    accuracy,
    timeSpentSeconds,
    submittedAt: new Date().toISOString(),
  };

  // 3. Save to Supabase and update local storage
  await submitLiveTestSubmission(submission);

  return {
    success: true,
    submission,
    results,
  };
}
