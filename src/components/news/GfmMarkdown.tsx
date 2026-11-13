import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface GfmMarkdownProps {
  content: string;
  className?: string;
  onLinkClick?: (url: string) => void;
}

/**
 * Normalizes table syntax so that remark-gfm can parse both standard GFM tables
 * and tables without separator lines (Format A, B, C).
 */
export function normalizeGfmTables(markdown: string): string {
  if (!markdown || !markdown.includes("|")) return markdown;

  const lines = markdown.split("\n");
  const result: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    // Check if this line looks like a table row (has pipe and at least 2 non-empty cell segments)
    if (trimmed.includes("|")) {
      const segments = trimmed.split("|").map(s => s.trim()).filter(Boolean);
      if (segments.length >= 2) {
        // Collect consecutive table-like lines
        const tableLines: string[] = [line];
        let nextIdx = i + 1;
        while (nextIdx < lines.length && lines[nextIdx].trim().includes("|")) {
          const nextSegs = lines[nextIdx].trim().split("|").map(s => s.trim()).filter(Boolean);
          if (nextSegs.length >= 2 || /^[:|\-\s]+$/.test(lines[nextIdx].trim())) {
            tableLines.push(lines[nextIdx]);
            nextIdx++;
          } else {
            break;
          }
        }

        // If we found at least 2 table lines
        if (tableLines.length >= 2) {
          const secondLine = tableLines[1].trim();
          const hasSeparator = /^[:|\-\s]+$/.test(secondLine) && secondLine.includes("-");

          // Ensure proper formatting for remark-gfm
          if (!hasSeparator) {
            // Insert separator row after header line
            const colCount = segments.length;
            const separator = "|" + new Array(colCount).fill("---").join("|") + "|";
            result.push(tableLines[0]);
            result.push(separator);
            for (let k = 1; k < tableLines.length; k++) {
              result.push(tableLines[k]);
            }
          } else {
            for (const tl of tableLines) {
              result.push(tl);
            }
          }
          i = nextIdx;
          continue;
        }
      }
    }

    result.push(line);
    i++;
  }

  return result.join("\n");
}

/**
 * GfmMarkdown renders Markdown with GitHub Flavored Markdown (remark-gfm).
 * Specifically converts tables into responsive HTML <table> elements with
 * the required article-table-wrapper and responsive mobile styling.
 */
export const GfmMarkdown: React.FC<GfmMarkdownProps> = ({
  content,
  className = "",
  onLinkClick,
}) => {
  const normalized = normalizeGfmTables(content);

  return (
    <div className={`gfm-markdown-container ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          table: ({ children, ...props }) => (
            <div className="article-table-wrapper my-6 sm:my-8 overflow-hidden rounded-2xl sm:rounded-3xl border border-[#E8D9C0] dark:border-[#31374A] bg-white dark:bg-[#1F2330] shadow-xs">
              <div className="overflow-x-auto w-full scrollbar-thin scrollbar-thumb-[#C99A45]/40 dark:scrollbar-thumb-[#31374A]">
                <table
                  className="w-full text-left text-xs sm:text-sm border-collapse min-w-[480px] tabular-nums"
                  {...props}
                >
                  {children}
                </table>
              </div>
              <div className="px-3.5 py-1.5 bg-[#FFF9EF] dark:bg-[#171923] border-t border-[#E8D9C0] dark:border-[#31374A] flex items-center justify-between text-[10px] text-[#52576A] dark:text-[#CBD2E1]">
                <span className="font-semibold text-[#800020] dark:text-[#C99A45]">DISHA 20-20 Exam Research Table</span>
                <span className="hidden sm:inline">Swipe horizontally on mobile ↔</span>
              </div>
            </div>
          ),
          thead: ({ children, ...props }) => (
            <thead
              className="bg-gradient-to-r from-[#800020] to-[#5E0017] text-[#FFF9EF] border-b border-[#C99A45]/30"
              {...props}
            >
              {children}
            </thead>
          ),
          tbody: ({ children, ...props }) => (
            <tbody
              className="divide-y divide-[#E8D9C0]/70 dark:divide-[#31374A] font-hindi text-[#171923] dark:text-[#FFF9EF]"
              {...props}
            >
              {children}
            </tbody>
          ),
          tr: ({ children, ...props }) => (
            <tr
              className="hover:bg-[#F7EFE2]/70 dark:hover:bg-[#252A3A]/70 even:bg-[#FFF9EF]/70 dark:even:bg-[#252A3A]/35 transition-colors"
              {...props}
            >
              {children}
            </tr>
          ),
          th: ({ children, ...props }) => (
            <th
              scope="col"
              className="p-3.5 sm:p-4 font-black uppercase tracking-wider text-[11px] sm:text-xs text-[#FFF9EF] font-hindi"
              {...props}
            >
              {children}
            </th>
          ),
          td: ({ children, ...props }) => (
            <td
              className="p-3.5 sm:p-4 text-xs sm:text-sm leading-relaxed whitespace-normal break-words font-medium first:font-bold first:text-[#800020] dark:first:text-[#F47B20] font-hindi"
              {...props}
            >
              {children}
            </td>
          ),
          p: ({ children, ...props }) => (
            <p
              className="text-[17px] sm:text-[18.5px] leading-[1.8] font-normal text-[#171923] dark:text-[#FFF9EF]/90 font-hindi my-4 max-w-[720px] break-words"
              {...props}
            >
              {children}
            </p>
          ),
          a: ({ href, children, ...props }) => {
            const isInternal = href?.startsWith("/") || href?.includes(window.location.origin);
            const handleClick = (e: React.MouseEvent) => {
              if (isInternal && onLinkClick && href) {
                e.preventDefault();
                onLinkClick(href);
              }
            };

            return (
              <a
                href={href}
                onClick={handleClick}
                target={!isInternal ? "_blank" : "_self"}
                rel={!isInternal ? "noopener noreferrer" : undefined}
                className="text-[#800020] dark:text-[#F47B20] font-extrabold underline underline-offset-4 hover:text-[#5E0017] dark:hover:text-[#E06A12] transition-colors cursor-pointer"
                {...props}
              >
                {children}
              </a>
            );
          },
          strong: ({ children, ...props }) => (
            <strong className="font-extrabold text-[#171923] dark:text-[#FFF9EF]" {...props}>
              {children}
            </strong>
          ),
          em: ({ children, ...props }) => (
            <em className="italic text-[#171923] dark:text-[#FFF9EF]/90" {...props}>
              {children}
            </em>
          ),
        }}
      >
        {normalized}
      </ReactMarkdown>
    </div>
  );
};
