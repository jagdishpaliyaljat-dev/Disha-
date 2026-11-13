import { ParsedQuestionDraft } from "../types";
import { parseRawMcqText } from "./questionParser";
import { formatBatchQuestionsWithAI } from "./aiFormatter";
import {
  parseJSONWithLocation,
  extractQuestionsFromSingleObject,
  normalizeQuestion,
  validateQuestion,
} from "../lib/mcqImport";

export class UniversalSmartParser {
  static async parse(raw: string, chapterId: string = "", topicId: string = ""): Promise<ParsedQuestionDraft[]> {
    const trimmed = raw.trim();
    if (!trimmed) return [];

    // 1. First check if input contains JSON
    const { data: jsonParsed, error: jsonErr } = parseJSONWithLocation(trimmed);
    if (jsonParsed && !jsonErr) {
      try {
        const drafts = this.parseJSON(jsonParsed, chapterId, topicId);
        if (drafts && drafts.length > 0) {
          return drafts;
        }
      } catch {
        // Fall back to text parsing
      }
    }

    // 2. Parse using the comprehensive MCQ text parser
    const { questions } = parseRawMcqText(trimmed, chapterId, topicId);
    if (questions && questions.length > 0) {
      return questions.map((q, idx) => {
        const normalized = normalizeQuestion({
          type: q.questionType || q.type || "single_correct",
          questionType: q.questionType || q.type || "single_correct",
          question: q.text || q.question || "",
          text: q.text || q.question || "",
          options: Array.isArray(q.options) ? q.options.filter((o) => String(o ?? "").trim() !== "") : [],
          correctIndex: typeof q.correctIndex === "number" ? q.correctIndex : -1,
          answer: q.answer || (q.correctIndex >= 0 ? ["A", "B", "C", "D", "E"][q.correctIndex] || "" : ""),
          explanation: q.explanation || "",
          statements: q.statements,
          assertion: q.assertion,
          reason: q.reason,
          instruction: q.instruction || q.askLine,
          matchTable: q.matchTable,
          table: (q as any).table || q.tableData,
          tableData: (q as any).table || q.tableData,
          subject: q.meta?.subject,
          chapter: q.meta?.chapter,
          topic: q.meta?.topic,
          examHistory: q.examHistory || q.meta?.examHistory,
          questionClassification: q.questionClassification,
          isPYQ: q.isPYQ,
          rawInput: q.rawInput || trimmed,
        });
        const validation = validateQuestion(normalized, idx + 1);

        return {
          ...normalized,
          tempId: q.id || `draft-text-${Date.now()}-${idx}`,
          chapterId: q.chapterId || chapterId,
          topicId: q.topicId || topicId,
          text: normalized.question,
          options: normalized.options,
          correctIndex: validation.correctIndex,
          answer: validation.correctIndex >= 0 ? ["A", "B", "C", "D", "E"][validation.correctIndex] : normalized.answer,
          explanation: normalized.explanation || "",
          difficulty: "medium",
          createdAt: new Date().toISOString(),
          isValid: validation.isValid,
          needsReview: validation.needsReview,
          reviewCategory: validation.reviewCategory,
          errorCategories: validation.errorCategories,
          errors: validation.errors,
          warnings: validation.warnings,
          questionNumber: (q as any).questionNumber || idx + 1,
          questionType: normalized.questionType || normalized.type || "single_correct",
          type: normalized.type || "single_correct",
          statements: normalized.statements,
          assertion: normalized.assertion,
          reason: normalized.reason,
          matchTable: normalized.matchTable,
          table: normalized.table,
          tableData: normalized.table,
          examHistory: normalized.examHistory,
          questionClassification: normalized.questionClassification,
          isPYQ: normalized.isPYQ,
          rawInput: q.rawInput || trimmed,
        } as unknown as ParsedQuestionDraft;
      });
    }

    // 3. Fallback: Parse using AI if deterministic parser found no questions
    try {
      const aiResults = await formatBatchQuestionsWithAI(trimmed);
      if (aiResults && aiResults.length > 0) {
        return aiResults.map((q, idx) => {
          const normalized = normalizeQuestion({
            ...q,
            question: q.text || (q as any).question || "",
            options: Array.isArray(q.options) ? q.options.filter((o) => String(o ?? "").trim() !== "") : [],
            correctIndex: typeof q.correctIndex === "number" ? q.correctIndex : -1,
            answer:
              typeof q.correctIndex === "number" && q.correctIndex >= 0
                ? ["A", "B", "C", "D", "E"][q.correctIndex] || ""
                : (q as any).answer || "",
            rawInput: trimmed,
          });
          const validation = validateQuestion(normalized, idx + 1);

          return {
            ...normalized,
            tempId: `draft-ai-${Date.now()}-${idx}`,
            chapterId,
            topicId,
            text: normalized.question,
            options: normalized.options,
            correctIndex: validation.correctIndex,
            explanation: normalized.explanation || "",
            difficulty: "medium",
            createdAt: new Date().toISOString(),
            isValid: validation.isValid,
            needsReview: true,
            reviewCategory: validation.isValid ? "needs_review" : validation.reviewCategory,
            errorCategories: validation.errorCategories,
            errors: validation.errors,
            warnings: [...validation.warnings, "Parsed via AI assistant; please review before importing."],
            questionNumber: idx + 1,
            questionType: normalized.questionType || normalized.type || "single_correct",
            type: normalized.type || "single_correct",
            statements: normalized.statements,
            assertion: normalized.assertion,
            reason: normalized.reason,
            matchTable: normalized.matchTable,
            table: normalized.table,
            tableData: normalized.table,
            rawInput: trimmed,
            source: "ai",
          } as unknown as ParsedQuestionDraft;
        });
      }
    } catch (aiErr) {
      console.warn("UniversalSmartParser AI fallback parsing failed:", aiErr);
    }

    return [];
  }

  private static parseJSON(data: any, chapterId: string = "", topicId: string = ""): ParsedQuestionDraft[] {
    let rawQuestions: any[] = [];
    if (data?.isMultiBlock && Array.isArray(data.blocks)) {
      rawQuestions = data.blocks.flatMap((b: any) => extractQuestionsFromSingleObject(b));
    } else {
      rawQuestions = extractQuestionsFromSingleObject(data);
    }

    return rawQuestions.map((q: any, idx: number) => {
      const normalized = normalizeQuestion(q);
      const validation = validateQuestion(normalized, idx + 1);

      return {
        ...normalized,
        tempId: `draft-json-${Date.now()}-${idx}`,
        chapterId,
        topicId,
        text: normalized.question,
        options: normalized.options,
        correctIndex: validation.correctIndex,
        answer: validation.correctIndex >= 0 ? ["A", "B", "C", "D", "E"][validation.correctIndex] : normalized.answer,
        explanation: normalized.explanation || "",
        difficulty: "medium",
        createdAt: new Date().toISOString(),
        isValid: validation.isValid,
        needsReview: validation.needsReview,
        reviewCategory: validation.reviewCategory,
        errorCategories: validation.errorCategories,
        errors: validation.errors,
        warnings: validation.warnings,
        type: normalized.type || "single_correct",
        questionType: normalized.questionType || normalized.type || "single_correct",
        questionNumber: idx + 1,
        statements: normalized.statements,
        assertion: normalized.assertion,
        reason: normalized.reason,
        table: normalized.table,
        tableData: normalized.table,
        matchTable: normalized.matchTable,
        image: normalized.image,
        imageUrl: normalized.imageUrl,
        examHistory: normalized.examHistory,
        questionClassification: normalized.questionClassification,
        isPYQ: normalized.isPYQ,
        rawInput: q,
      } as unknown as ParsedQuestionDraft;
    });
  }
}

