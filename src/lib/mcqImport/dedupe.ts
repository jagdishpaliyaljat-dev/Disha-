import { MCQImportQuestion } from "./schema";

/**
 * Generates a stable deterministic hash for duplicate detection based on question text and options.
 */
export const generateQuestionHash = (q: MCQImportQuestion): string => {
  const qClean = (q.question || (q as any).text || "")
    .toLowerCase()
    .replace(/[^\w\u0900-\u097F]/gu, "")
    .trim();

  const optClean = (Array.isArray(q.options) ? q.options : [])
    .map((opt) => String(opt || "").toLowerCase().replace(/[^\w\u0900-\u097F]/gu, "").trim())
    .sort()
    .join("|");

  let tableClean = "";
  const t = q.table || (q as any).tableData;
  if (t && typeof t === "object") {
    const headers = (Array.isArray(t.headers) ? t.headers : [])
      .map((h: any) => String(h || "").toLowerCase().trim())
      .join(",");
    const rows = (Array.isArray(t.rows) ? t.rows : [])
      .map((r: any) => {
        const cells = Array.isArray(r)
          ? r
          : (r && typeof r === "object" && Array.isArray(r.cells) ? r.cells : []);
        return cells.map((c: any) => String(c || "").toLowerCase().trim()).join(",");
      })
      .join(";");
    tableClean = `${t.caption || ""}::${headers}::${rows}`;
  }

  let matchClean = "";
  const mt = q.matchTable || (q as any).matchData;
  if (mt && typeof mt === "object") {
    if (Array.isArray(mt.rows)) {
      matchClean = mt.rows
        .map((r: any) => `${String(r?.left || "").toLowerCase().trim()}=${String(r?.right || "").toLowerCase().trim()}`)
        .join(";");
    } else if (Array.isArray(mt.listI) || Array.isArray(mt.listII)) {
      const l1 = (mt.listI || []).map((x: any) => String(x || "").toLowerCase().trim()).join(",");
      const l2 = (mt.listII || []).map((x: any) => String(x || "").toLowerCase().trim()).join(",");
      matchClean = `${l1}::${l2}`;
    }
  }

  const combined = matchClean
    ? `${qClean}::${optClean}::${tableClean}::${matchClean}`
    : `${qClean}::${optClean}::${tableClean}`;

  let hash = 5381;
  for (let i = 0; i < combined.length; i++) {
    hash = (hash * 33) ^ combined.charCodeAt(i);
  }
  return (hash >>> 0).toString(16);
};

/**
 * Checks if question is duplicate against a set of existing question hashes.
 */
export const isDuplicateQuestion = (
  q: MCQImportQuestion,
  existingHashes: Set<string>
): boolean => {
  const hash = generateQuestionHash(q);
  return existingHashes.has(hash);
};

export { mergeExamHistories } from "./examDetector";

