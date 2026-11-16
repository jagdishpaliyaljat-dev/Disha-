import { ShareData } from "../components/ShareModal";
import { PYQPaper, LiveTest, Chapter, Subject, Question, NewsArticle, Topic } from "../types";
import { supabase } from "../lib/supabase";
import { normalizeTable } from "./tableUtils";
import { loadLocalPYQPapers } from "./pyqStorage";
import { loadLocalLiveTests } from "./liveTestStorage";
import { fetchArticleBySlug } from "./articleStorage";
import { fetchQuestionsByTopic } from "./supabaseSyncService";

export type ShareContentType =
  | "test"
  | "pyq"
  | "practice"
  | "subject"
  | "chapter"
  | "topic"
  | "livetest"
  | "news"
  | "question";

export interface ResolvedShareContent {
  type: ShareContentType;
  id: string;
  data?: any;
  title?: string;
  subtitle?: string;
}

/**
 * Generates a unique, canonical share URL for any content item
 */
export function getShareUrl(type: ShareContentType, id: string): string {
  const origin =
    typeof window !== "undefined" && window.location?.origin
      ? window.location.origin
      : "https://disha2020.in";
  return `${origin}/share/${type}/${encodeURIComponent(id)}`;
}

/**
 * Parses pathname and search parameters to extract share content type and ID
 */
export function parseShareUrl(
  pathname: string,
  search: string
): { type: ShareContentType; id: string } | null {
  if (!pathname) return null;

  // 1. Check standard /share/:type/:id format
  if (pathname.startsWith("/share/")) {
    const parts = pathname.replace("/share/", "").split("/").filter(Boolean);
    if (parts.length >= 2) {
      const type = parts[0].toLowerCase() as ShareContentType;
      const id = decodeURIComponent(parts.slice(1).join("/"));
      if (id && id.trim()) {
        return { type, id: id.trim() };
      }
    }
  }

  // 2. Check direct URL routes (e.g., /pyq/123, /livetest/456, /chapter/789, /news/slug)
  const directMatch = pathname.match(
    /^\/(pyq|livetest|chapter|topic|subject|test|practice|news|question)\/([^\/]+)/i
  );
  if (directMatch) {
    const type = directMatch[1].toLowerCase() as ShareContentType;
    const id = decodeURIComponent(directMatch[2]);
    if (id && id.trim()) {
      return { type, id: id.trim() };
    }
  }

  // 3. Check search params (e.g., ?shareType=pyq&shareId=123 or ?share=test&id=123)
  if (search) {
    const params = new URLSearchParams(search);
    const shareType = params.get("shareType") || params.get("share") || params.get("type");
    const shareId = params.get("shareId") || params.get("id");

    if (shareType && shareId && shareId.trim()) {
      return {
        type: shareType.toLowerCase() as ShareContentType,
        id: shareId.trim(),
      };
    }
  }

  return null;
}

/**
 * Builds ShareData payload for PYQ Paper
 */
export function buildPYQShareData(paper: PYQPaper): ShareData {
  const url = getShareUrl("pyq", paper.id);
  const title = paper.title || `${paper.examBoard} ${paper.paperYear} PYQ Paper`;
  const text = `Solve authentic ${paper.examBoard || "Official"} ${paper.paperYear || ""} Previous Year Question Paper on DISHA 20-20 with verified answer key & explanations.`;
  return {
    title,
    text,
    url,
    category: "PYQ Paper",
  };
}

/**
 * Builds ShareData payload for Live Test
 */
export function buildLiveTestShareData(test: LiveTest): ShareData {
  const url = getShareUrl("livetest", test.id);
  const title = test.title || "Live Mock Exam";
  const text = `Attempt live mock test for ${test.examCategory || "Competitive Exams"} on DISHA 20-20 with instant score analysis and state ranking.`;
  return {
    title,
    text,
    url,
    category: "Live Test Series",
  };
}

/**
 * Builds ShareData payload for Chapter / Practice Set
 */
export function buildChapterShareData(chapter: Chapter, subjectName?: string): ShareData {
  const url = getShareUrl("chapter", chapter.id);
  const title = chapter.title || "Chapter MCQs Practice";
  const text = `Practice bilingual multiple-choice questions for ${chapter.title} (${subjectName || "DISHA 20-20"}) with instant explanations.`;
  return {
    title,
    text,
    url,
    category: "Chapter Practice",
  };
}

/**
 * Builds ShareData payload for News Article
 */
export function buildNewsShareData(article: NewsArticle): ShareData {
  const url = getShareUrl("news", article.slug || article.id);
  const title = article.title;
  const text = article.excerpt || "Read verified exam notifications and study strategies on DISHA 20-20.";
  return {
    title,
    text,
    url,
    category: "Exam News & Strategy",
  };
}

/**
 * Builds ShareData payload for Topic Practice
 */
export function buildTopicShareData(topic: Topic, subjectName?: string): ShareData {
  const url = getShareUrl("topic", topic.id);
  const title = topic.title || "Topic MCQs Practice";
  const text = `Attempt specialized practice quiz on ${topic.title} (${subjectName || "DISHA 20-20"}) with conceptual notes and instant result analysis.`;
  return {
    title,
    text,
    url,
    category: "Topic Quiz",
  };
}

/**
 * Builds ShareData payload for Custom Test
 */
export function buildCustomTestShareData(testTitle: string, testId: string): ShareData {
  const url = getShareUrl("test", testId);
  return {
    title: testTitle || "Practice MCQ Test",
    text: `Take this timed practice test "${testTitle}" on DISHA 20-20.`,
    url,
    category: "Mock Test",
  };
}

/**
 * Attempts to fetch content if not present in local state
 */
export async function fetchShareContentFromCloud(
  type: ShareContentType,
  id: string
): Promise<any | null> {
  try {
    if (type === "pyq") {
      const list = loadLocalPYQPapers();
      const match = list.find((p) => p.id === id);
      if (match) return match;
    }

    if (type === "livetest") {
      const list = loadLocalLiveTests();
      const match = list.find((t) => t.id === id);
      if (match) return match;
    }

    if (type === "news") {
      return await fetchArticleBySlug(id);
    }

    if (type === "question") {
      const { data } = await supabase.from("questions").select("*").eq("id", id).maybeSingle();
      if (data) {
        return {
          id: data.id,
          topicId: data.topic_id,
          chapterId: data.chapter_id,
          subjectId: data.subject_id,
          question: data.question,
          options: data.options || [],
          correctAnswer: data.correct_answer,
          explanation: data.explanation || "",
          table: data.table_data ? normalizeTable(data.table_data) : undefined,
          source: data.source,
          examYear: data.exam_year,
          category: data.category,
        } as Question;
      }
    }

    if (type === "topic") {
      const { data: topicData } = await supabase.from("topics").select("*").eq("id", id).maybeSingle();
      if (topicData) {
        const questions = await fetchQuestionsByTopic(id);
        return {
          id: topicData.id,
          name: topicData.name,
          hindiName: topicData.hindi_name,
          chapterId: topicData.chapter_id,
          questions,
        };
      }
    }
  } catch (err) {
    console.warn(`[ShareService] Fetch notice for ${type}:${id}`, err);
  }

  return null;
}
