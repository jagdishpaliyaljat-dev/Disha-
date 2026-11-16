/**
 * Utility functions for table normalization and serialization.
 */

export function normalizeTable(data: any): any {
  if (!data || typeof data !== "object") return null;

  if (data.rowsJson && typeof data.rowsJson === "string") {
    try {
      const parsedRows = JSON.parse(data.rowsJson);
      return {
        caption: data.caption || undefined,
        headers: Array.isArray(data.headers) ? data.headers : [],
        rows: Array.isArray(parsedRows) ? parsedRows : [],
      };
    } catch {
      // ignore
    }
  }

  if (Array.isArray(data.rows)) {
    const rows = data.rows.map((r: any) => {
      if (Array.isArray(r)) return r;
      if (r && typeof r === "object" && Array.isArray(r.cells)) return r.cells;
      return [];
    });
    return {
      caption: data.caption || undefined,
      headers: Array.isArray(data.headers) ? data.headers : [],
      rows,
    };
  }

  return data;
}

export function serializeTable(data: any): any {
  if (!data || typeof data !== "object") return null;

  const caption = data.caption ? String(data.caption) : null;
  const headers = Array.isArray(data.headers) ? data.headers.map((h: any) => String(h ?? "")) : [];

  let rowsArray: string[][] = [];
  if (Array.isArray(data.rows)) {
    rowsArray = data.rows.map((r: any) => {
      if (Array.isArray(r)) return r.map((c: any) => String(c ?? ""));
      if (r && typeof r === "object" && Array.isArray(r.cells)) return r.cells.map((c: any) => String(c ?? ""));
      return [];
    });
  } else if (typeof data.rowsJson === "string") {
    try {
      rowsArray = JSON.parse(data.rowsJson);
    } catch {
      rowsArray = [];
    }
  }

  return {
    caption,
    headers,
    rowsJson: JSON.stringify(rowsArray),
    _serialized: true,
  };
}

export function sanitizePayload<T = any>(obj: T): T {
  if (obj === null || obj === undefined) {
    return null as any;
  }
  if (Array.isArray(obj)) {
    return obj
      .filter((item) => item !== undefined)
      .map((item) => {
        if (Array.isArray(item)) {
          return JSON.stringify(item);
        }
        return sanitizePayload(item);
      }) as any;
  }
  if (typeof obj === "object") {
    const cleaned: Record<string, any> = {};
    for (const [key, value] of Object.entries(obj)) {
      if (value === undefined) continue;
      if ((key === "table" || key === "tableData") && value && typeof value === "object") {
        cleaned[key] = serializeTable(value);
      } else {
        cleaned[key] = sanitizePayload(value);
      }
    }
    return cleaned as T;
  }
  return obj;
}

// Aliases for backward compatibility
export const normalizeTableFromFirestore = normalizeTable;
export const serializeTableForFirestore = serializeTable;
export const sanitizeFirestorePayload = sanitizePayload;
export const sanitizeData = sanitizePayload;
