import React from "react";

export { GfmMarkdown, normalizeGfmTables } from "./GfmMarkdown";

export type TableAlignment = "left" | "center" | "right";

export interface ArticleTableRow {
  cells: string[];
}

export interface ArticleTableProps {
  headers?: string[];
  rows: ArticleTableRow[];
  alignments?: TableAlignment[];
  caption?: string;
  className?: string;
  renderCell?: (cellText: string, rowIndex: number, colIndex: number) => React.ReactNode;
}

/**
 * Reusable ArticleTable component
 * Renders semantic, accessible HTML <table> with:
 * - <table>, <thead>, <tbody>, <tr>, <th>, <td>
 * - Responsive horizontally scrollable container preventing mobile page blowout
 * - Distinctive dark header background with bold white labels
 * - Subtle borders, comfortable cell padding, and alternating row backgrounds
 * - Support for English, Hindi, and mixed numeric content
 * - Column alignments (left, center, right)
 */
export const ArticleTable: React.FC<ArticleTableProps> = ({
  headers = [],
  rows = [],
  alignments = [],
  caption,
  className = "",
  renderCell,
}) => {
  // If no rows and no headers, don't render empty markup
  if ((!headers || headers.length === 0) && (!rows || rows.length === 0)) {
    return null;
  }

  // Determine max column count to keep grid consistent
  const colCount = Math.max(
    headers.length,
    ...rows.map((r) => (r.cells ? r.cells.length : 0)),
    1
  );

  // Dynamic min-width to prevent squishing columns on mobile while ensuring smooth horizontal scroll
  const minWidthPx = Math.max(460, colCount * 130);

  const getAlignmentClass = (colIdx: number): string => {
    const align = alignments[colIdx] || "left";
    if (align === "center") return "text-center";
    if (align === "right") return "text-right";
    return "text-left";
  };

  return (
    <div
      className={`article-table-wrapper my-6 sm:my-8 overflow-hidden rounded-2xl sm:rounded-3xl border border-[#E8D9C0] dark:border-[#31374A] bg-white dark:bg-[#1F2330] shadow-xs ${className}`}
    >
      {caption && (
        <div className="px-4 py-2.5 bg-[#F7EFE2] dark:bg-[#252A3A] border-b border-[#E8D9C0] dark:border-[#31374A] text-xs font-black text-[#171923] dark:text-[#FFF9EF] font-hindi flex items-center justify-between">
          <span>{caption}</span>
          <span className="text-[10px] text-[#52576A] dark:text-[#CBD2E1] font-normal">
            Swipe horizontally on mobile ↔
          </span>
        </div>
      )}

      <div className="overflow-x-auto w-full scrollbar-thin scrollbar-thumb-[#C99A45]/40 dark:scrollbar-thumb-[#31374A]">
        <table
          className="w-full text-left text-xs sm:text-sm border-collapse tabular-nums"
          style={{ minWidth: `${minWidthPx}px` }}
        >
          {headers.length > 0 && (
            <thead className="bg-gradient-to-r from-[#800020] to-[#5E0017] text-[#FFF9EF] border-b border-[#C99A45]/30">
              <tr>
                {headers.map((headerText, hi) => {
                  const alignClass = getAlignmentClass(hi);
                  return (
                    <th
                      key={hi}
                      scope="col"
                      className={`p-3.5 sm:p-4 font-black uppercase tracking-wider text-[11px] sm:text-xs text-[#FFF9EF] font-hindi ${alignClass}`}
                    >
                      {headerText}
                    </th>
                  );
                })}
              </tr>
            </thead>
          )}

          <tbody className="divide-y divide-[#E8D9C0]/70 dark:divide-[#31374A] font-hindi text-[#171923] dark:text-[#FFF9EF]">
            {rows.map((row, ri) => (
              <tr
                key={ri}
                className="hover:bg-[#F7EFE2]/70 dark:hover:bg-[#252A3A]/70 even:bg-[#FFF9EF]/70 dark:even:bg-[#252A3A]/35 transition-colors"
              >
                {row.cells.map((cellText, ci) => {
                  const alignClass = getAlignmentClass(ci);
                  const isFirstCol = ci === 0;

                  return (
                    <td
                      key={ci}
                      className={`p-3.5 sm:p-4 text-xs sm:text-sm leading-relaxed whitespace-normal break-words ${alignClass} ${
                        isFirstCol
                          ? "font-bold text-[#800020] dark:text-[#F47B20]"
                          : "font-medium"
                      }`}
                    >
                      {renderCell ? renderCell(cellText, ri, ci) : cellText}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="px-3.5 py-1.5 bg-[#FFF9EF] dark:bg-[#171923] border-t border-[#E8D9C0] dark:border-[#31374A] flex items-center justify-between text-[10px] text-[#52576A] dark:text-[#CBD2E1] tabular-nums">
        <span>{rows.length} {rows.length === 1 ? "Row" : "Rows"}</span>
        <span className="hidden sm:inline font-semibold text-[#800020] dark:text-[#C99A45]">DISHA 20-20 Exam Research Table</span>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────
// TABLE PARSING HELPERS (GFM, Format A, Format B, Format C)
// ─────────────────────────────────────────────────────────────

/**
 * Parses a single table row string into individual cell strings.
 * Handles:
 * - Format A / B / C: `Cell 1| Cell 2| Cell 3` (no leading or trailing pipe)
 * - Standard GFM: `| Cell 1 | Cell 2 | Cell 3 |`
 * - Mixed pipes: `| Cell 1 | Cell 2` or `Cell 1 | Cell 2 |`
 * - Tab-delimited rows: `Cell 1\tCell 2\tCell 3`
 */
export function parseTableRowCells(line: string): string[] | null {
  const trimmed = line.trim();
  if (!trimmed) return null;

  if (trimmed.includes("|")) {
    let parts = trimmed.split("|");
    // Strip leading empty element caused by starting pipe "| a | b"
    if (parts.length > 1 && parts[0].trim() === "") {
      parts.shift();
    }
    // Strip trailing empty element caused by ending pipe "a | b |"
    if (parts.length > 1 && parts[parts.length - 1].trim() === "") {
      parts.pop();
    }
    if (parts.length >= 2) {
      return parts.map((c) => c.trim());
    }
  }

  if (trimmed.includes("\t")) {
    const tabParts = trimmed.split("\t").map((c) => c.trim());
    if (tabParts.filter(Boolean).length >= 2) {
      return tabParts;
    }
  }

  return null;
}

/**
 * Checks if a line is a markdown separator row (e.g. `|---|---|` or `|:---|---:|` or `---|---`).
 */
export function isTableSeparatorRow(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return false;
  // Contains only |, -, :, spaces
  if (!/^[:|\-\s]+$/.test(trimmed)) {
    return false;
  }
  const cells = parseTableRowCells(line);
  if (!cells || cells.length < 2) return false;
  return cells.every((c) => /^:?-{2,}:?$/.test(c.trim()));
}

/**
 * Extracts alignments from a markdown separator row.
 */
export function parseTableAlignments(separatorLine: string): TableAlignment[] {
  const cells = parseTableRowCells(separatorLine);
  if (!cells) return [];
  return cells.map((cell) => {
    const c = cell.trim();
    const start = c.startsWith(":");
    const end = c.endsWith(":");
    if (start && end) return "center";
    if (end) return "right";
    return "left";
  });
}

/**
 * Extracts a complete table structure from a block of consecutive lines.
 */
export function parseMarkdownTableLines(lines: string[]): {
  headers: string[];
  rows: ArticleTableRow[];
  alignments: TableAlignment[];
} | null {
  if (lines.length < 2) return null;

  const firstRowCells = parseTableRowCells(lines[0]);
  if (!firstRowCells || firstRowCells.length < 2) return null;

  // Check if second line is a separator row
  let headers = firstRowCells;
  let alignments: TableAlignment[] = [];
  let bodyLines: string[] = [];

  if (lines.length >= 2 && isTableSeparatorRow(lines[1])) {
    alignments = parseTableAlignments(lines[1]);
    bodyLines = lines.slice(2);
  } else {
    // No separator row provided (like Format A, B, C): line 0 is header, rest are rows
    bodyLines = lines.slice(1);
  }

  const rows: ArticleTableRow[] = [];
  for (const bLine of bodyLines) {
    if (isTableSeparatorRow(bLine)) continue;
    const cells = parseTableRowCells(bLine);
    if (cells && cells.length > 0) {
      // Pad cells if row has fewer cells than headers
      while (cells.length < headers.length) {
        cells.push("-");
      }
      rows.push({ cells });
    }
  }

  if (rows.length === 0 && headers.length === 0) return null;

  return { headers, rows, alignments };
}

/**
 * Checks whether a text contains a table (at least 2 consecutive pipe-separated lines).
 */
export function hasMarkdownTable(text: string): boolean {
  if (!text || !text.includes("|")) return false;
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  let consecutive = 0;
  for (const line of lines) {
    if (parseTableRowCells(line) !== null || isTableSeparatorRow(line)) {
      consecutive++;
      if (consecutive >= 2) return true;
    } else {
      consecutive = 0;
    }
  }
  return false;
}

/**
 * Parses and renders text that might contain an embedded markdown table.
 * If no table is found, renders standard paragraph.
 * If a table is found, splits surrounding text and renders an ArticleTable.
 */
export function renderParagraphOrTable(
  text: string,
  keyPrefix: string | number,
  renderFormattedText: (t: string) => React.ReactNode,
  paragraphClassName?: string
): React.ReactNode {
  if (!text) return null;
  if (!hasMarkdownTable(text)) {
    return (
      <p key={keyPrefix} className={paragraphClassName}>
        {renderFormattedText(text)}
      </p>
    );
  }

  const lines = text.split("\n");
  const segments: Array<
    | { type: "text"; content: string }
    | { type: "table"; lines: string[] }
  > = [];

  let currentTextLines: string[] = [];
  let currentTableLines: string[] = [];

  const flushText = () => {
    if (currentTextLines.length > 0) {
      const content = currentTextLines.join("\n").trim();
      if (content) {
        segments.push({ type: "text", content });
      }
      currentTextLines = [];
    }
  };

  const flushTable = () => {
    if (currentTableLines.length > 0) {
      if (currentTableLines.length >= 2) {
        segments.push({ type: "table", lines: [...currentTableLines] });
      } else {
        currentTextLines.push(...currentTableLines);
      }
      currentTableLines = [];
    }
  };

  for (const line of lines) {
    const trimmed = line.trim();
    const isRow = parseTableRowCells(trimmed) !== null || isTableSeparatorRow(trimmed);
    if (isRow) {
      flushText();
      currentTableLines.push(trimmed);
    } else {
      flushTable();
      if (trimmed) {
        currentTextLines.push(line);
      }
    }
  }
  flushText();
  flushTable();

  return (
    <React.Fragment key={keyPrefix}>
      {segments.map((seg, sIdx) => {
        if (seg.type === "text") {
          return (
            <p key={`${keyPrefix}-txt-${sIdx}`} className={paragraphClassName}>
              {renderFormattedText(seg.content)}
            </p>
          );
        } else {
          const parsed = parseMarkdownTableLines(seg.lines);
          if (parsed) {
            return (
              <ArticleTable
                key={`${keyPrefix}-tbl-${sIdx}`}
                headers={parsed.headers}
                rows={parsed.rows}
                alignments={parsed.alignments}
                renderCell={(cell) => renderFormattedText(cell)}
              />
            );
          }
          return null;
        }
      })}
    </React.Fragment>
  );
}

