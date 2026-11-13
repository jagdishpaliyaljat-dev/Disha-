/**
 * Idempotency utilities for Firestore question uploads and deduplication
 */

export function generateContentHash(questionText: string, options: string[], answer?: string | number): string {
  const normText = (questionText || "")
    .toLowerCase()
    .replace(/[\s\r\n\t]+/g, " ")
    .replace(/[^\w\u0900-\u097F]/gu, "")
    .trim();

  const normOpts = (Array.isArray(options) ? options : [])
    .map((opt) => String(opt || "").toLowerCase().replace(/[^\w\u0900-\u097F]/gu, "").trim())
    .sort()
    .join("|");

  const combined = `${normText}::${normOpts}::${String(answer ?? "")}`;

  let hash = 5381;
  for (let i = 0; i < combined.length; i++) {
    hash = (hash * 33) ^ combined.charCodeAt(i);
  }
  return (hash >>> 0).toString(16);
}

/**
 * Computes deterministic Firestore question doc ID
 */
export function getDeterministicQuestionId(topicId: string, questionText: string, options: string[], answer?: string | number): string {
  const hash = generateContentHash(questionText, options, answer);
  const cleanTopicId = (topicId || "gen").trim().replace(/[^a-zA-Z0-9_-]/g, "_");
  return `usr-q-${cleanTopicId}-${hash}`;
}
