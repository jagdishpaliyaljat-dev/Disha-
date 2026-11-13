import React, { useState, useRef } from "react";
import { RichText } from './RichText';

export interface QuestionTableData {
  caption?: string;
  headers: string[];
  rows: (string[] | { cells: string[] })[];
}

export interface QuestionTableProps {
  table?: QuestionTableData | null;
  className?: string;
}

export const QuestionTable: React.FC<QuestionTableProps> = ({ table, className = '' }) => {
  if (!table || typeof table !== 'object') return null;

  let rawRows = Array.isArray(table.rows) ? table.rows : [];
  if (rawRows.length === 0 && (table as any).rowsJson && typeof (table as any).rowsJson === 'string') {
    try {
      const parsed = JSON.parse((table as any).rowsJson);
      if (Array.isArray(parsed)) rawRows = parsed;
    } catch {
      // ignore
    }
  }

  let headers = Array.isArray(table.headers) ? table.headers.map((h) => String(h ?? '')) : [];
  let rows: string[][] = rawRows.map((r: any) => {
    if (Array.isArray(r)) {
      return r.map((c: any) => String(c ?? ''));
    } else if (r && typeof r === 'object' && Array.isArray(r.cells)) {
      return r.cells.map((c: any) => String(c ?? ''));
    }
    return [];
  }).filter((r) => r.length > 0);

  // If headers are missing but rows are present, promote first row to headers
  if (headers.length === 0 && rows.length > 1) {
    headers = rows[0];
    rows = rows.slice(1);
  }

  if (headers.length === 0 && rows.length === 0) return null;

  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);

  // Virtualization parameters for high-performance rendering on large datasets
  const ROW_HEIGHT = 44; // estimated row height in pixels
  const VISIBLE_COUNT = 12; // number of rendered visible rows buffer
  const threshold = 15; // apply virtualization when row count exceeds 15

  const isVirtualized = rows.length > threshold;
  const totalHeight = rows.length * ROW_HEIGHT;

  const startIndex = isVirtualized ? Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - 3) : 0;
  const endIndex = isVirtualized ? Math.min(rows.length, startIndex + VISIBLE_COUNT + 6) : rows.length;

  const visibleRows = isVirtualized ? rows.slice(startIndex, endIndex) : rows;
  const offsetY = startIndex * ROW_HEIGHT;

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (isVirtualized) {
      setScrollTop(e.currentTarget.scrollTop);
    }
  };

  return (
    <div className={`my-3 sm:my-4 w-full text-left select-none font-hindi ${className}`}>
      {table.caption && (
        <div className="mb-1.5 text-xs font-bold text-slate-700 dark:text-slate-300">
          <RichText text={table.caption} inline />
        </div>
      )}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className={`w-full overflow-x-auto overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs bg-white dark:bg-slate-900/80 ${
          isVirtualized ? 'max-h-[380px]' : ''
        }`}
      >
        <table className="w-full min-w-full text-left text-sm border-collapse relative">
          <thead className="sticky top-0 z-10">
            <tr className="bg-slate-100 dark:bg-slate-800/95 text-slate-900 dark:text-slate-100 border-b border-slate-200 dark:border-slate-700 shadow-xs">
              {headers.map((headerText, hIdx) => (
                <th
                  key={hIdx}
                  className="px-3 py-2.5 font-bold text-xs sm:text-sm border-r last:border-r-0 border-slate-200 dark:border-slate-700 min-w-[70px] sm:min-w-[90px] break-words [overflow-wrap:anywhere]"
                >
                  <RichText text={headerText} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody
            className="divide-y divide-slate-200 dark:divide-slate-800 relative"
            style={isVirtualized ? { height: `${totalHeight}px` } : undefined}
          >
            {isVirtualized && offsetY > 0 && (
              <tr aria-hidden="true" style={{ height: `${offsetY}px`, border: 'none' }}>
                <td colSpan={headers.length} style={{ padding: 0, border: 'none' }} />
              </tr>
            )}
            {visibleRows.map((row, idx) => {
              const rIdx = isVirtualized ? startIndex + idx : idx;
              return (
                <tr
                  key={rIdx}
                  className={`text-slate-800 dark:text-slate-200 ${
                    rIdx % 2 === 0
                      ? 'bg-white dark:bg-slate-900/90'
                      : 'bg-slate-50/60 dark:bg-slate-900/40'
                  }`}
                  style={isVirtualized ? { height: `${ROW_HEIGHT}px` } : undefined}
                >
                  {row.map((cellText, cIdx) => (
                    <td
                      key={cIdx}
                      className="px-3 py-2 text-xs sm:text-sm border-r last:border-r-0 border-slate-200/80 dark:border-slate-800 min-w-[70px] sm:min-w-[90px] break-words [overflow-wrap:anywhere] align-middle"
                    >
                      <RichText text={cellText} />
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default QuestionTable;
