import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { RichText } from "./RichText";
import { normalizeGfmTables } from "./news/GfmMarkdown";

interface AIMessageRendererProps {
  content: string;
  className?: string;
}

/**
 * Checks if a string or child contains math expressions ($...$, $$...$$, \(...\), \[...\])
 * and renders them via RichText; otherwise returns original text.
 */
function renderContentWithMath(child: React.ReactNode): React.ReactNode {
  if (typeof child === "string") {
    if (
      child.includes("$") ||
      child.includes("\\[") ||
      child.includes("\\(") ||
      child.includes("[image:") ||
      child.includes("[diagram:") ||
      child.includes("[चित्र:")
    ) {
      return <RichText content={child} inline />;
    }
    return child;
  }
  return child;
}

export const AIMessageRenderer: React.FC<AIMessageRendererProps> = ({
  content,
  className = "",
}) => {
  if (!content) return null;

  const normalized = normalizeGfmTables(content);

  return (
    <div className={`ai-message-markdown leading-relaxed text-xs sm:text-sm text-slate-800 dark:text-slate-100 ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ node, children, className: pClass, ...props }) => (
            <p className={`mb-2.5 last:mb-0 leading-relaxed ${pClass || ""}`} {...props}>
              {React.Children.map(children, renderContentWithMath)}
            </p>
          ),
          strong: ({ node, children, ...props }) => (
            <strong className="font-extrabold text-indigo-950 dark:text-indigo-200" {...props}>
              {children}
            </strong>
          ),
          em: ({ node, children, ...props }) => (
            <em className="italic text-slate-700 dark:text-slate-300 font-medium" {...props}>
              {children}
            </em>
          ),
          h1: ({ node, children, ...props }) => (
            <h1 className="font-black text-sm sm:text-base text-indigo-950 dark:text-indigo-100 mt-3 mb-1.5 border-b border-indigo-100 dark:border-slate-700/60 pb-1" {...props}>
              {children}
            </h1>
          ),
          h2: ({ node, children, ...props }) => (
            <h2 className="font-bold text-xs sm:text-sm text-indigo-950 dark:text-indigo-100 mt-2.5 mb-1 border-b border-indigo-50 dark:border-slate-700/40 pb-0.5" {...props}>
              {children}
            </h2>
          ),
          h3: ({ node, children, ...props }) => (
            <h3 className="font-bold text-xs sm:text-sm text-indigo-900 dark:text-indigo-200 mt-2 mb-1" {...props}>
              {children}
            </h3>
          ),
          ul: ({ node, children, ...props }) => (
            <ul className="list-disc pl-5 space-y-1.5 my-2 text-slate-800 dark:text-slate-200" {...props}>
              {children}
            </ul>
          ),
          ol: ({ node, children, ...props }) => (
            <ol className="list-decimal pl-5 space-y-1.5 my-2 text-slate-800 dark:text-slate-200" {...props}>
              {children}
            </ol>
          ),
          li: ({ node, children, ...props }) => (
            <li className="leading-relaxed pl-0.5" {...props}>
              {React.Children.map(children, renderContentWithMath)}
            </li>
          ),
          blockquote: ({ node, children, ...props }) => (
            <blockquote className="border-l-3 border-indigo-500 pl-3 py-1.5 my-2 bg-indigo-50/60 dark:bg-indigo-950/40 rounded-r-lg italic text-slate-700 dark:text-slate-300 text-xs sm:text-sm" {...props}>
              {children}
            </blockquote>
          ),
          code: ({ node, className: codeClass, children, ...props }: any) => {
            const isBlock = codeClass || (typeof children === "string" && children.includes("\n"));
            if (!isBlock) {
              return (
                <code className="px-1.5 py-0.5 rounded-md bg-indigo-50 dark:bg-slate-800 text-indigo-700 dark:text-indigo-300 font-mono text-[11px] sm:text-xs font-semibold border border-indigo-100 dark:border-slate-700" {...props}>
                  {children}
                </code>
              );
            }
            return (
              <pre className="p-3 my-2 rounded-xl bg-slate-900 text-slate-100 font-mono text-[11px] sm:text-xs overflow-x-auto border border-slate-800">
                <code className={codeClass} {...props}>
                  {children}
                </code>
              </pre>
            );
          },
          table: ({ node, children, ...props }) => (
            <div className="my-3 overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">
              <div className="overflow-x-auto w-full">
                <table className="w-full text-left text-xs border-collapse min-w-[320px]" {...props}>
                  {children}
                </table>
              </div>
            </div>
          ),
          thead: ({ node, children, ...props }) => (
            <thead className="bg-indigo-50 dark:bg-slate-800 text-indigo-950 dark:text-indigo-200 border-b border-slate-200 dark:border-slate-700" {...props}>
              {children}
            </thead>
          ),
          tbody: ({ node, children, ...props }) => (
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800" {...props}>
              {children}
            </tbody>
          ),
          tr: ({ node, children, ...props }) => (
            <tr className="even:bg-slate-50/50 dark:even:bg-slate-800/30 transition-colors" {...props}>
              {children}
            </tr>
          ),
          th: ({ node, children, ...props }) => (
            <th className="p-2 sm:p-2.5 font-bold uppercase text-[10px] sm:text-[11px] tracking-wider" {...props}>
              {children}
            </th>
          ),
          td: ({ node, children, ...props }) => (
            <td className="p-2 sm:p-2.5 text-xs font-medium" {...props}>
              {children}
            </td>
          ),
          hr: ({ node, ...props }) => (
            <hr className="my-2.5 border-slate-200 dark:border-slate-700" {...props} />
          ),
          a: ({ node, href, children, ...props }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-indigo-600 dark:text-indigo-400 font-bold underline underline-offset-2 hover:text-indigo-800 dark:hover:text-indigo-300"
              {...props}
            >
              {children}
            </a>
          ),
        }}
      >
        {normalized}
      </ReactMarkdown>
    </div>
  );
};
