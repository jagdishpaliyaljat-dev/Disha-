import { Chapter, Question, Subject, Topic } from "../types";
import { generateQuestionHash } from "../lib/mcqImport";

export interface OrphanResolutionRecord {
  id: string;
  originalSubjectId?: string;
  originalChapterId?: string;
  originalTopicId?: string;
  resolvedSubjectId: string;
  resolvedChapterId: string;
  resolvedTopicId: string;
  resolvedChapterTitle: string;
  resolvedTopicTitle: string;
}

export interface DataIntegrityAuditReport {
  rawMcqsCount: number;
  rawQuestionsCount: number;
  inBothCount: number;
  onlyInMcqsCount: number;
  onlyInQuestionsCount: number;
  reconciledUniqueIdCount: number;
  uniqueContentHashCount: number;
  duplicateIdCount: number;
  missingQuestionCount: number;
  orphanedBeforeReconciliationCount: number;
  orphanedAfterReconciliationCount: number;
  invalidSubjectIdCount: number;
  invalidChapterIdCount: number;
  invalidTopicIdCount: number;
  resolvedOrphans: OrphanResolutionRecord[];
}

function normalizeQuestionRecord(q: Question): Question {
  const stem = q.text || (q as any).question || "";
  let correctIndex = q.correctIndex;
  if (typeof correctIndex !== "number") {
    if (typeof (q as any).correctAnswer === "number") {
      correctIndex = (q as any).correctAnswer;
    } else if (typeof (q as any).answer === "string") {
      const ans = String((q as any).answer).trim().toUpperCase();
      const map: Record<string, number> = { A: 0, B: 1, C: 2, D: 3, "1": 0, "2": 1, "3": 2, "4": 3 };
      if (ans in map) correctIndex = map[ans];
    }
  }
  return {
    ...q,
    text: stem,
    correctIndex: typeof correctIndex === "number" ? correctIndex : 0,
  };
}

/**
 * Reconciles documents from question collections by stable document ID.
 * Never deletes or discards any question; merges properties with newer updatedAt taking precedence.
 */
export function reconcileMcqsAndQuestionsCollections(
  mcqsDocs: Question[],
  questionsDocs: Question[]
): Question[] {
  const dedupedById = new Map<string, Question>();

  for (let i = 0; i < (questionsDocs || []).length; i++) {
    const q = questionsDocs[i];
    if (q && q.id && (q.text || (q as any).question)) {
      dedupedById.set(q.id, normalizeQuestionRecord(q));
    }
  }

  for (let i = 0; i < (mcqsDocs || []).length; i++) {
    const q = mcqsDocs[i];
    if (!q || !q.id || !(q.text || (q as any).question)) continue;
    const normalizedQ = normalizeQuestionRecord(q);
    const existing = dedupedById.get(q.id);
    if (existing) {
      const tExisting = new Date((existing as any).updatedAt || existing.createdAt || 0).getTime() || 0;
      const tNew = new Date((normalizedQ as any).updatedAt || normalizedQ.createdAt || 0).getTime() || 0;
      dedupedById.set(
        q.id,
        tNew >= tExisting ? { ...existing, ...normalizedQ } : { ...normalizedQ, ...existing }
      );
    } else {
      dedupedById.set(q.id, normalizedQ);
    }
  }

  return Array.from(dedupedById.values());
}

/**
 * Deterministically resolves legacy / orphaned foreign keys (such as the 31 legacy questions
 * with topicId='gen', 'geography', 'history', 'art_culture', 'polity', 'economy', etc.)
 * into valid canonical (subjectId, chapterId, topicId) from the active syllabus hierarchy.
 */
export function resolveCanonicalForeignKeys(
  questions: Question[],
  subjects: Subject[],
  chapters: Chapter[],
  topics: Topic[]
): {
  reconciledQuestions: Question[];
  resolvedOrphans: OrphanResolutionRecord[];
} {
  const subjectMap = new Map<string, Subject>();
  (subjects || []).forEach((s) => {
    if (s && s.id) subjectMap.set(s.id, s);
  });

  // Build unified chapter & topic lookup from chapters + topics
  const chapterMap = new Map<string, Chapter>();
  const topicMap = new Map<string, { topic: Topic; chapter: Chapter }>();

  const extraTopicsByChapter = new Map<string, Topic[]>();
  (topics || []).forEach((t) => {
    if (t && t.id && t.chapterId) {
      const list = extraTopicsByChapter.get(t.chapterId) || [];
      list.push(t);
      extraTopicsByChapter.set(t.chapterId, list);
    }
  });

  (chapters || []).forEach((ch) => {
    if (!ch || !ch.id) return;
    const mergedTopicsMap = new Map<string, Topic>();
    (ch.topics || []).forEach((t) => {
      if (t && t.id) mergedTopicsMap.set(t.id, t);
    });
    (extraTopicsByChapter.get(ch.id) || []).forEach((t) => {
      if (t && t.id && !mergedTopicsMap.has(t.id)) mergedTopicsMap.set(t.id, t);
    });
    const mergedTopics = Array.from(mergedTopicsMap.values());
    const enrichedCh: Chapter = { ...ch, topics: mergedTopics };
    chapterMap.set(ch.id, enrichedCh);

    mergedTopics.forEach((t) => {
      topicMap.set(t.id, { topic: t, chapter: enrichedCh });
      topicMap.set(t.id.toLowerCase(), { topic: t, chapter: enrichedCh });
    });
  });

  // Helper to find a chapter by id or title keyword
  const findChapterByIdOrKeyword = (chapterIdHint?: string, titleKeyword?: string): Chapter | undefined => {
    if (chapterIdHint && chapterMap.has(chapterIdHint)) {
      return chapterMap.get(chapterIdHint);
    }
    if (titleKeyword) {
      const kw = titleKeyword.toLowerCase();
      for (const ch of chapterMap.values()) {
        if (
          (ch.title || "").toLowerCase().includes(kw) ||
          (ch.hindiTitle || "").toLowerCase().includes(kw)
        ) {
          return ch;
        }
      }
    }
    return undefined;
  };

  const resolvedOrphans: OrphanResolutionRecord[] = [];
  const allChaptersList = Array.from(chapterMap.values());

  const reconciledQuestions = (questions || []).map((q) => {
    if (!q) return q;

    // 1. Check if q.topicId directly matches an existing canonical topic
    if (q.topicId) {
      const match = topicMap.get(q.topicId) || topicMap.get(q.topicId.toLowerCase());
      if (match) {
        const canonicalChapter = match.chapter;
        const canonicalSubjectId = canonicalChapter.subjectId || q.subjectId || subjects[0]?.id || "economics";
        if (
          q.topicId === match.topic.id &&
          q.chapterId === canonicalChapter.id &&
          q.subjectId === canonicalSubjectId
        ) {
          return q;
        }
        return {
          ...q,
          topicId: match.topic.id,
          chapterId: canonicalChapter.id,
          subjectId: canonicalSubjectId,
        };
      }
    }

    // 2. Question has an orphaned/unmapped topicId (e.g. one of the 31 legacy questions)
    const origSub = (q.subjectId || "").toLowerCase().trim();
    const origChap = (q.chapterId || "").toLowerCase().trim();
    const origTop = (q.topicId || "").toLowerCase().trim();

    let targetChapter: Chapter | undefined;
    let targetTopic: Topic | undefined;

    // Semantic mapping rules for known legacy/orphaned categories
    if (origChap === "drainage_system") {
      targetChapter = findChapterByIdOrKeyword("custom-ch-1793631882188-aw7g0", "अपवाह");
    } else if (origChap === "national_parks" || origChap === "sanctuaries" || origChap === "rajasthan_geo" || origTop === "environment") {
      targetChapter = findChapterByIdOrKeyword("custom-ch-1793808219116-u7vwa", "वन्य जीव");
    } else if (origChap === "demographics") {
      targetChapter = findChapterByIdOrKeyword("custom-ch-1793196395934-v2yex", "विस्तार");
    } else if (origChap === "freedom_movement" || origChap === "peasant_movements") {
      targetChapter = findChapterByIdOrKeyword("custom-ch-1793292191934-f9c1l", "प्रजामंडल");
    } else if (
      origChap === "inscriptions" ||
      origChap === "mewar_history" ||
      origSub === "history" ||
      origSub === "art_culture" ||
      origTop === "history" ||
      origTop === "art_culture"
    ) {
      targetChapter = findChapterByIdOrKeyword("custom-ch-1793114583187-txi6p", "प्राचीन सभ्यता");
    } else if (origSub === "economy" || origTop === "economy" || origChap === "welfare_schemes" || origChap === "rajasthan_economy") {
      targetChapter = findChapterByIdOrKeyword("custom-ch-1793972492646-jg9yy", "कृषि एवं संबद्ध");
    } else if (origSub === "geography" || origTop === "geography") {
      targetChapter = findChapterByIdOrKeyword("custom-ch-1793170570488-95wl6", "भौतिक प्रदेश");
    } else if (origTop === "gen" || origChap === "chapter_general" || origSub === "economics" || origSub === "polity") {
      // Map general practice questions to the canonical 'General Practice' topic in भौतिक प्रदेश if present
      const genMatch = topicMap.get("topic_3da7035f-1933-4615-820a-3f862a957ec6");
      if (genMatch) {
        targetChapter = genMatch.chapter;
        targetTopic = genMatch.topic;
      } else {
        targetChapter = findChapterByIdOrKeyword("custom-ch-1793170570488-95wl6", "भौतिक प्रदेश");
      }
    }

    // Fallback: check if q.chapterId is already a valid chapter
    if (!targetChapter && q.chapterId && chapterMap.has(q.chapterId)) {
      targetChapter = chapterMap.get(q.chapterId);
    }

    // Fallback: check if q.subjectId matches any chapter's subjectId
    if (!targetChapter && q.subjectId) {
      targetChapter = allChaptersList.find((c) => c.subjectId === q.subjectId && (c.topics || []).length > 0);
    }

    // Final fallback: first chapter that has at least 1 canonical topic
    if (!targetChapter) {
      targetChapter = allChaptersList.find((c) => (c.topics || []).length > 0) || allChaptersList[0];
    }

    if (targetChapter) {
      if (!targetTopic) {
        // Prefer 'General Practice' topic inside targetChapter if available, otherwise first topic
        targetTopic =
          (targetChapter.topics || []).find((t) =>
            (t.title || "").toLowerCase().includes("general")
          ) || (targetChapter.topics || [])[0];
      }

      if (targetTopic) {
        const resolvedSubId = targetChapter.subjectId || subjects[0]?.id || "economics";
        resolvedOrphans.push({
          id: q.id,
          originalSubjectId: q.subjectId,
          originalChapterId: q.chapterId,
          originalTopicId: q.topicId,
          resolvedSubjectId: resolvedSubId,
          resolvedChapterId: targetChapter.id,
          resolvedTopicId: targetTopic.id,
          resolvedChapterTitle: targetChapter.title || targetChapter.hindiTitle || targetChapter.id,
          resolvedTopicTitle: targetTopic.title || targetTopic.hindiTitle || targetTopic.id,
        });

        return {
          ...q,
          subjectId: resolvedSubId,
          chapterId: targetChapter.id,
          topicId: targetTopic.id,
        };
      }
    }

    return q;
  });

  return { reconciledQuestions, resolvedOrphans };
}

/**
 * Performs a complete read-only integrity audit across 'mcqs', 'questions', 'subjects', 'chapters', and 'topics'.
 */
export function runDataIntegrityAudit(
  mcqsDocs: Question[],
  questionsDocs: Question[],
  subjects: Subject[],
  chapters: Chapter[],
  topics: Topic[]
): DataIntegrityAuditReport {
  const mcqsIds = new Set((mcqsDocs || []).map((d) => d.id));
  const qsIds = new Set((questionsDocs || []).map((d) => d.id));

  let inBothCount = 0;
  let onlyInMcqsCount = 0;
  let onlyInQuestionsCount = 0;

  mcqsIds.forEach((id) => {
    if (qsIds.has(id)) inBothCount++;
    else onlyInMcqsCount++;
  });
  qsIds.forEach((id) => {
    if (!mcqsIds.has(id)) onlyInQuestionsCount++;
  });

  const mergedUnique = reconcileMcqsAndQuestionsCollections(mcqsDocs, questionsDocs);

  // Content hashes check
  const contentHashes = new Set<string>();
  mergedUnique.forEach((q) => {
    const h = generateQuestionHash({
      question: q.text || (q as any).question || "",
      options: q.options || [],
      table: q.table,
    } as any);
    contentHashes.add(h);
  });

  // Valid ID sets
  const validSubjectIds = new Set((subjects || []).map((s) => s.id));
  const validChapterIds = new Set((chapters || []).map((c) => c.id));
  const validTopicIds = new Set((topics || []).map((t) => t.id));
  (chapters || []).forEach((c) => (c.topics || []).forEach((t) => validTopicIds.add(t.id)));

  const orphanedBefore = mergedUnique.filter(
    (q) => !q.topicId || !validTopicIds.has(q.topicId)
  ).length;

  const { reconciledQuestions, resolvedOrphans } = resolveCanonicalForeignKeys(
    mergedUnique,
    subjects,
    chapters,
    topics
  );

  const invalidSubjectIdCount = reconciledQuestions.filter(
    (q) => !q.subjectId || !validSubjectIds.has(q.subjectId)
  ).length;
  const invalidChapterIdCount = reconciledQuestions.filter(
    (q) => !q.chapterId || !validChapterIds.has(q.chapterId)
  ).length;
  const invalidTopicIdCount = reconciledQuestions.filter(
    (q) => !q.topicId || !validTopicIds.has(q.topicId)
  ).length;

  const uniqueAfterIds = new Set(reconciledQuestions.map((q) => q.id));
  const missingQuestionCount = mergedUnique.length - uniqueAfterIds.size;
  const duplicateIdCount = reconciledQuestions.length - uniqueAfterIds.size;

  return {
    rawMcqsCount: mcqsIds.size,
    rawQuestionsCount: qsIds.size,
    inBothCount,
    onlyInMcqsCount,
    onlyInQuestionsCount,
    reconciledUniqueIdCount: mergedUnique.length,
    uniqueContentHashCount: contentHashes.size,
    duplicateIdCount,
    missingQuestionCount,
    orphanedBeforeReconciliationCount: orphanedBefore,
    orphanedAfterReconciliationCount: invalidTopicIdCount,
    invalidSubjectIdCount,
    invalidChapterIdCount,
    invalidTopicIdCount,
    resolvedOrphans,
  };
}
