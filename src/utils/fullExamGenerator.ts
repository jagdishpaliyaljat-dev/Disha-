import { Chapter, Question, Subject, MCQSession, FullExamPreset } from "../types";

export const DEFAULT_EXAM_PRESETS: FullExamPreset[] = [
  {
    id: "full-standard-100",
    title: "Full Standard Exam Paper",
    hindiTitle: "Full Standard Exam Paper",
    description: "100 Questions • 120 Minutes (2 Hours) • 1/3 (0.33) Negative Marking • Balanced across all subjects",
    questionCount: 100,
    durationMinutes: 120,
    negativeMarking: 0.33,
    marksPerQuestion: 1,
    badge: "Most Recommended",
  },
  {
    id: "mini-mock-50",
    title: "Speed Mock Test",
    hindiTitle: "Speed Mock Test (50 Questions)",
    description: "50 Questions • 60 Minutes (1 Hour) • 1/3 (0.33) Negative Marking • Fast-paced practice",
    questionCount: 50,
    durationMinutes: 60,
    negativeMarking: 0.33,
    marksPerQuestion: 1,
    badge: "Speed Test",
  },
  {
    id: "quick-exam-25",
    title: "Quick Power Mock",
    hindiTitle: "Quick Power Mock (25 Questions)",
    description: "25 Questions • 30 Minutes • 1/3 Negative Marking • Daily speed & accuracy drill",
    questionCount: 25,
    durationMinutes: 30,
    negativeMarking: 0.33,
    marksPerQuestion: 1,
    badge: "Quick",
  },
];

// Fisher-Yates Shuffle
function shuffle<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = result[i];
    result[i] = result[j];
    result[j] = temp;
  }
  return result;
}

/**
 * Proportionally samples questions from across all subjects and chapters to simulate a real exam
 */
export function generateFullExamQuestionIds(params: {
  allQuestions: Question[];
  chapters: Chapter[];
  targetCount: number;
  subjectIds?: string[];
}): {
  selectedQuestionIds: string[];
  subjectDistribution: Record<string, { name: string; count: number }>;
} {
  const { allQuestions, chapters, targetCount, subjectIds } = params;

  // Filter questions if specific subjects requested
  let pool = allQuestions;
  if (subjectIds && subjectIds.length > 0) {
    const allowedSubjectSet = new Set(subjectIds);
    pool = allQuestions.filter((q) => !q.subjectId || allowedSubjectSet.has(q.subjectId));
  }

  if (pool.length === 0) {
    return { selectedQuestionIds: [], subjectDistribution: {} };
  }

  const effectiveCount = Math.min(targetCount, pool.length);

  // Group by chapter to ensure widespread representation
  const questionsByChapter: Record<string, Question[]> = {};
  chapters.forEach((ch) => {
    questionsByChapter[ch.id] = [];
  });

  pool.forEach((q) => {
    const chId = q.chapterId || "general";
    if (!questionsByChapter[chId]) {
      questionsByChapter[chId] = [];
    }
    questionsByChapter[chId].push(q);
  });

  // Calculate proportional allocation per chapter
  const activeChapterIds = Object.keys(questionsByChapter).filter(
    (id) => questionsByChapter[id].length > 0
  );

  const selectedSet = new Set<string>();
  const subjectDistribution: Record<string, { name: string; count: number }> = {};

  if (activeChapterIds.length > 0) {
    // Round-robin or proportional pick across chapters
    const shuffledChapters = shuffle(activeChapterIds);
    let currentPoolByChapter: Record<string, Question[]> = {};
    shuffledChapters.forEach((chId) => {
      currentPoolByChapter[chId] = shuffle(questionsByChapter[chId]);
    });

    let pointer = 0;
    while (selectedSet.size < effectiveCount) {
      let anyAddedInCycle = false;
      for (const chId of shuffledChapters) {
        if (selectedSet.size >= effectiveCount) break;
        const chQuestions = currentPoolByChapter[chId];
        if (chQuestions && chQuestions.length > 0) {
          const nextQ = chQuestions.pop();
          if (nextQ && !selectedSet.has(nextQ.id)) {
            selectedSet.add(nextQ.id);
            anyAddedInCycle = true;
          }
        }
      }
      if (!anyAddedInCycle) break;
      pointer++;
    }
  }

  // If still need more questions, fill randomly from remaining pool
  if (selectedSet.size < effectiveCount) {
    const remaining = shuffle(pool.filter((q) => !selectedSet.has(q.id)));
    for (const q of remaining) {
      if (selectedSet.size >= effectiveCount) break;
      selectedSet.add(q.id);
    }
  }

  // Shuffle selected questions so topics are interspersed like a real exam
  const selectedQuestionIds = shuffle(Array.from(selectedSet));

  // Compute distribution breakdown for user visibility
  const questionsMap = new Map(pool.map((q) => [q.id, q]));
  const chaptersMap = new Map(chapters.map((c) => [c.id, c]));

  selectedQuestionIds.forEach((id) => {
    const q = questionsMap.get(id);
    if (q) {
      const ch = q.chapterId ? chaptersMap.get(q.chapterId) : null;
      const groupName = ch ? ch.title || ch.hindiTitle : "सामान्य ज्ञान / विविध";
      if (!subjectDistribution[groupName]) {
        subjectDistribution[groupName] = { name: groupName, count: 0 };
      }
      subjectDistribution[groupName].count++;
    }
  });

  return { selectedQuestionIds, subjectDistribution };
}
