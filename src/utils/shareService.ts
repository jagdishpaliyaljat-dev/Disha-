import { ShareData } from "../components/ShareModal";
import { PYQPaper, LiveTest, Chapter, Subject, Question, NewsArticle, Topic } from "../types";
import { db } from "../lib/firebase";
import { doc } from "firebase/firestore";
import { guardedGetDoc } from "./quotaTracker";
import { normalizeTableFromFirestore } from "./firebaseSyncService";

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
 * Attempts to fetch content from Cloud Firestore if not present in local state
 */
export async function fetchShareContentFromCloud(
  type: ShareContentType,
  id: string
): Promise<any | null> {
  try {
    if (type === "pyq") {
      const docRef = doc(db, "pyq_papers", id);
      const docSnap = await guardedGetDoc(docRef, "Student", "Fetch Shared PYQ Paper");
      if (docSnap.exists()) {
        const data = docSnap.data() as PYQPaper;
        if (Array.isArray(data.questions)) {
          data.questions = data.questions.map((q: any) => {
            const qObj = { ...q };
            if (qObj.table) qObj.table = normalizeTableFromFirestore(qObj.table);
            if (qObj.tableData) qObj.tableData = normalizeTableFromFirestore(qObj.tableData);
            return qObj;
          });
        }
        return data;
      }
    }

    if (type === "livetest") {
      const docRef = doc(db, "liveTests", id);
      const docSnap = await guardedGetDoc(docRef, "Student", "Fetch Shared Live Test");
      if (docSnap.exists()) {
        const data = docSnap.data() as LiveTest;
        if (Array.isArray(data.questions)) {
          data.questions = data.questions.map((q: any) => {
            const qObj = { ...q };
            if (qObj.table) qObj.table = normalizeTableFromFirestore(qObj.table);
            if (qObj.tableData) qObj.tableData = normalizeTableFromFirestore(qObj.tableData);
            return qObj;
          });
        }
        return data;
      }
    }

    if (type === "news") {
      const docRef = doc(db, "articles", id);
      const docSnap = await guardedGetDoc(docRef, "Student", "Fetch Shared Article");
      if (docSnap.exists()) {
        return docSnap.data() as NewsArticle;
      }
    }

    if (type === "question") {
      const docRef = doc(db, "mcqs", id);
      const docSnap = await guardedGetDoc(docRef, "Student", "Fetch Shared Question");
      if (docSnap.exists()) {
        const data = docSnap.data() as Question;
        if (data.table) data.table = normalizeTableFromFirestore(data.table);
        if (data.tableData) data.tableData = normalizeTableFromFirestore(data.tableData);
        return data;
      }
    }

    if (type === "topic") {
      const docRef = doc(db, "topics", id);
      const docSnap = await guardedGetDoc(docRef, "Student", "Fetch Shared Topic");
      if (docSnap.exists()) {
        const topicData = { ...docSnap.data(), id: docSnap.id } as Topic;
        // Fetch questions for this topic
        const { fetchMCQsByTopic } = await import("./firebaseSyncService");
        const questions = await fetchMCQsByTopic(id);
        const normalizedQuestions = questions.map((q: any) => {
          const qObj = { ...q };
          if (qObj.table) qObj.table = normalizeTableFromFirestore(qObj.table);
          if (qObj.tableData) qObj.tableData = normalizeTableFromFirestore(qObj.tableData);
          return qObj;
        });
        return {
          ...topicData,
          questions: normalizedQuestions,
        };
      }
    }
  } catch (err) {
    console.warn(`[ShareService] Cloud fetch notice for ${type}:${id}`, err);
  }

  return null;
}
