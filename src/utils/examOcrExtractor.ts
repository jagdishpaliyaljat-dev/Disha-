import { parseRawMcqText } from "./questionParser";
import { ExtractedQuestionDraft } from "../types";
import { apiFetch } from "./api";

/**
 * Perform real Multimodal Gemini Vision OCR on an uploaded exam paper image via secure server endpoint
 */
export async function extractQuestionsFromImage(
  base64Data: string,
  mimeType: string = "image/jpeg",
  userApiKey?: string
): Promise<ExtractedQuestionDraft[]> {
  try {
    const customHeaders: Record<string, string> = {};
    if (userApiKey?.trim()) {
      customHeaders["X-Gemini-Api-Key"] = userApiKey.trim();
      customHeaders["X-AI-Api-Key"] = userApiKey.trim();
    }

    const res = await apiFetch("/api/exam-paper/extract", {
      method: "POST",
      headers: customHeaders,
      body: JSON.stringify({
        files: [
          {
            id: `file-${Date.now()}`,
            name: "exam-page.jpg",
            mimeType,
            pageNumber: 1,
            base64Data,
          },
        ],
      }),
    });

    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.questions) && data.questions.length > 0) {
        return data.questions;
      }
    }
  } catch (err) {
    console.warn("Vision OCR extraction request error:", err);
  }

  return [];
}

/**
 * Extract questions from raw pasted or OCR text using our high-accuracy parser.
 * Falls back to local heuristic parser if AI sync fails.
 */
export async function extractQuestionsFromText(rawText: string, userApiKey?: string): Promise<ExtractedQuestionDraft[]> {
  if (!rawText || !rawText.trim() || rawText.trim().length < 10) return [];

  // Try AI-powered server-side extraction first for high fidelity
  try {
    const customHeaders: Record<string, string> = {};
    if (userApiKey?.trim()) {
      customHeaders["X-Gemini-Api-Key"] = userApiKey.trim();
      customHeaders["X-AI-Api-Key"] = userApiKey.trim();
    }

    const res = await apiFetch("/api/exam-paper/extract", {
      method: "POST",
      headers: customHeaders,
      body: JSON.stringify({ rawText }),
    });

    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.questions) && data.questions.length > 0) {
        return data.questions;
      }
    }
  } catch (err) {
    console.warn("AI text extraction request notice:", err);
  }

  // Local heuristic fallback parser
  const parseRes = parseRawMcqText(rawText);
  if (parseRes.questions && parseRes.questions.length > 0) {
    return parseRes.questions.map((q, idx) => ({
      tempId: q.tempId || `draft-text-local-${Date.now()}-${idx + 1}`,
      originalQuestionNumber: idx + 1,
      sourcePageNumber: 1,
      originalText: q.question || q.text || rawText,
      extractedOptions: q.options && q.options.length >= 2 ? q.options : ["A", "B", "C", "D"],
      ocrStatus: "high" as const,
      ocrConfidence: q.confidence || 0.95,
      questionType: q.type || "standard",
      isFlaggedForReview: !q.isValid,
    }));
  }

  return [];
}
