import React from "react";
import { FileText, Layers, Table as TableIcon, Maximize2, X, Loader2 } from "lucide-react";
import { RichText } from "./RichText";
import { sanitizeSvgContent } from "../utils/svgSanitizer";

interface Statement {
  label: string;
  body: string;
}

/**
 * StatementBlock: Renders statements cleanly using RichText.
 */
export const StatementBlock: React.FC<{ statements: string[] | Statement[] }> = ({ statements }) => {
  return (
    <div className="space-y-2.5 sm:space-y-3.5 my-3 sm:my-4 w-full">
      <div className="space-y-3 sm:space-y-4">
        {statements.map((stmt, idx) => {
          const rawBody = typeof stmt === "string" ? stmt : stmt.body;
          const body = rawBody.replace(/^(?:कथन|Statement|\d+)\s*\(?\d+\)?[\.\:\-\s]*\s*/i, "").trim();
          
          let label = typeof stmt === "string" ? `Statement ${idx + 1}` : stmt.label;
          if (label && !label.endsWith(":") && !label.endsWith("：")) {
            label += ":";
          }
          
          return (
            <div
              key={idx}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-[0.7875rem] sm:p-[0.9rem] rounded-xl sm:rounded-2xl shadow-sm transition-colors flex flex-col gap-2.5"
            >
              <div className="flex items-center gap-2.5">
                <span className="shrink-0 px-2.5 py-0.5 rounded-lg bg-blue-600 text-white font-black text-[11px] sm:text-[11px] uppercase tracking-wider shadow-sm">
                  {label}
                </span>
                <div className="h-[1px] flex-grow bg-slate-100 dark:bg-slate-800/80" />
              </div>
              <div className="text-[1.07rem] sm:text-[1.2rem] text-slate-900 dark:text-slate-100 leading-[1.6] sm:leading-relaxed font-black">
                <RichText text={body} enablePronunciation={true} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

/**
 * MatchFollowingBlock: Renders Column 1 and Column 2 side-by-side using RichText.
 */
export const MatchFollowingBlock: React.FC<{
  listI?: string[];
  listII?: string[];
  leftTitle?: string;
  rightTitle?: string;
  rows?: { left: string; right: string }[];
}> = ({ listI = [], listII = [], leftTitle, rightTitle, rows: propRows }) => {
  const maxLen = Math.max(listI.length, listII.length);
  const rows = propRows || Array.from({ length: maxLen }, (_, i) => ({
    left: listI[i] || "",
    right: listII[i] || "",
  }));

  const lTitle = leftTitle || "LIST-I";
  const rTitle = rightTitle || "LIST-II";

  const getRoman = (num: number) => {
    const romans = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];
    return romans[num - 1] || num.toString();
  };

  const splitBadgeAndText = (raw: string, fallbackBadge: string) => {
    const trimmed = String(raw || "").trim();
    const match = trimmed.match(/^(?:\(([0-9]+|[a-zA-Z]|[IVXivx]+|[क-ङअ-द])\)|([0-9]+|[a-zA-Z]|[IVXivx]+|[क-ङअ-द])[.):\-–])\s*(.+)$/);
    if (match) {
      const badge = (match[1] || match[2] || fallbackBadge).trim();
      const body = (match[3] || "").trim();
      return { badge, body: body || trimmed };
    }
    return { badge: fallbackBadge, body: trimmed };
  };

  return (
    <div className="my-4 sm:my-6 w-full border border-slate-200 dark:border-slate-800 rounded-xl sm:rounded-3xl overflow-hidden bg-white dark:bg-[#0D1425] shadow-sm">
      <div className="grid grid-cols-2 divide-x divide-slate-100 dark:divide-slate-800/60">
        <div className="bg-slate-50/80 dark:bg-slate-900/40 px-[0.675rem] sm:px-[1.125rem] py-[0.675rem] sm:py-[0.9rem] border-b border-slate-200 dark:border-slate-800/60">
          <span className="text-[11px] sm:text-[11px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest flex items-center gap-1.5 sm:gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
            <span className="whitespace-normal leading-tight font-black">{lTitle}</span>
          </span>
        </div>
        <div className="bg-slate-50/80 dark:bg-slate-900/40 px-[0.675rem] sm:px-[1.125rem] py-[0.675rem] sm:py-[0.9rem] border-b border-slate-200 dark:border-slate-800/60">
          <span className="text-[11px] sm:text-[11px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest flex items-center gap-1.5 sm:gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
            <span className="whitespace-normal leading-tight font-black">{rTitle}</span>
          </span>
        </div>

        {rows.map((row, idx) => {
          const leftParsed = splitBadgeAndText(row.left, String.fromCharCode(65 + idx));
          const rightParsed = splitBadgeAndText(row.right, String(idx + 1));
          return (
            <React.Fragment key={idx}>
              <div className={`px-[0.675rem] sm:px-[1.125rem] py-[0.7875rem] sm:py-[1.125rem] flex gap-2 sm:gap-3.5 items-start ${idx !== rows.length - 1 ? 'border-b border-slate-100 dark:border-slate-800/40' : ''}`}>
                <span className="shrink-0 w-[1.125rem] h-[1.125rem] sm:w-[1.35rem] sm:h-[1.35rem] rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center text-[11px] sm:text-[11px] font-black font-mono border border-blue-100/50 dark:border-blue-800/50 mt-0.5">
                  {leftParsed.badge}
                </span>
                <div className="text-[1.07rem] sm:text-[1.2rem] font-black text-slate-800 dark:text-slate-200 leading-relaxed break-words overflow-hidden w-full">
                  <RichText text={leftParsed.body} enablePronunciation={true} />
                </div>
              </div>
              <div className={`px-[0.675rem] sm:px-[1.125rem] py-[0.7875rem] sm:py-[1.125rem] flex gap-2 sm:gap-3.5 items-start ${idx !== rows.length - 1 ? 'border-b border-slate-100 dark:border-slate-800/40' : ''}`}>
                <span className="shrink-0 w-[1.125rem] h-[1.125rem] sm:w-[1.35rem] sm:h-[1.35rem] rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-[11px] sm:text-[11px] font-black font-mono border border-emerald-100/50 dark:border-emerald-800/50 mt-0.5">
                  {rightParsed.badge || getRoman(idx + 1)}
                </span>
                <div className="text-[1.07rem] sm:text-[1.2rem] font-black text-slate-800 dark:text-slate-200 leading-relaxed break-words overflow-hidden w-full">
                  <RichText text={rightParsed.body} enablePronunciation={true} />
                </div>
              </div>
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};

/**
 * AssertionReasonBlock: Renders Assertion (A) and Reason (R) inline using RichText.
 */
export const AssertionReasonBlock: React.FC<{ assertion: string; reason: string }> = ({ assertion, reason }) => {
  const cleanA = assertion.replace(/^(?:अभिकथन|Assertion|कथन)?\s*\(?A\)?[\:\-\s]*/i, "").trim();
  const cleanR = reason.replace(/^(?:कारण|Reason)?\s*\(?R\)?[\:\-\s]*/i, "").trim();

  return (
    <div className="space-y-2.5 sm:space-y-3.5 my-2.5 sm:my-3 w-full">
      {cleanA && (
        <div className="text-[1.07rem] sm:text-[1.2rem] text-slate-900 dark:text-slate-100 font-black leading-[1.4] sm:leading-relaxed break-words">
          <span className="text-blue-600 dark:text-blue-400 font-extrabold mr-2">Assertion (A):</span>
          <RichText text={cleanA} inline enablePronunciation={true} />
        </div>
      )}
      {cleanR && (
        <div className="text-[1.07rem] sm:text-[1.2rem] text-slate-900 dark:text-slate-100 font-black leading-[1.4] sm:leading-relaxed break-words">
          <span className="text-amber-600 dark:text-amber-400 font-extrabold mr-2">Reason (R):</span>
          <RichText text={cleanR} inline enablePronunciation={true} />
        </div>
      )}
    </div>
  );
};

/**
 * PassageBlock: Renders passage text with RichText.
 */
export const PassageBlock: React.FC<{ passage: string; title?: string }> = ({ passage, title = "Reading Passage" }) => {
  return (
    <div className="my-4 sm:my-6 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-2xl sm:rounded-[28px] p-[0.9rem] sm:p-[1.575rem]">
      <div className="flex items-center gap-2 mb-3 sm:mb-4">
        <FileText className="w-4 h-4 text-slate-400" />
        <h3 className="text-[11px] sm:text-xs font-black text-slate-500 uppercase tracking-widest">{title}</h3>
      </div>
      <div className="text-[1.07rem] sm:text-[1.2rem] text-slate-800 dark:text-slate-200 leading-[1.5] sm:leading-relaxed border-l-4 border-blue-600 dark:border-blue-400 pl-3.5 sm:pl-4 py-0.5 sm:py-1 font-black">
        <RichText text={passage} enablePronunciation={true} />
      </div>
    </div>
  );
};

/**
 * SequenceBlock: Renders items in sequence using RichText.
 */
export const SequenceBlock: React.FC<{ items: (string | { number?: number; text: string })[] }> = ({ items }) => {
  if (!items || items.length === 0) return null;

  return (
    <div className="space-y-2 sm:space-y-2.5 my-2.5 sm:my-3.5 w-full">
      <div className="text-[11px] sm:text-[11px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest pb-0.5 flex items-center gap-1.5">
        <Layers className="w-3.5 h-3.5 text-indigo-500" />
        <span>Arrange in Sequence:</span>
      </div>
      <div className="flex flex-col gap-1.5 sm:gap-2">
        {items.map((item, idx) => {
          const rawText = typeof item === "string" ? item : item.text || "";
          const cleanText = rawText
            .replace(/^(?:(?:\*|\-|\•)\s*)?(?:(?:\d+|[IVX]+)[\.\)\:\-]|(?:\((\d+|[IVX]+)\)))\s*/i, "")
            .trim();
          const displayNumber = typeof item === "object" && item.number ? item.number : idx + 1;

          return (
            <div
              key={idx}
              className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 p-[0.5625rem] sm:p-[0.7875rem] rounded-xl sm:rounded-2xl flex items-start gap-2.5 sm:gap-3"
            >
              <span className="w-[1.35rem] h-[1.35rem] sm:w-[1.575rem] sm:h-[1.575rem] rounded-lg sm:rounded-xl bg-indigo-50 dark:bg-indigo-950/70 border border-indigo-200/60 dark:border-indigo-800/50 flex items-center justify-center text-[11px] sm:text-xs font-black text-indigo-700 dark:text-indigo-300 font-mono shrink-0 mt-0.5">
                {displayNumber}.
              </span>
              <div className="text-[13.9px] sm:text-[15px] font-bold text-slate-850 dark:text-slate-100 leading-[1.5] sm:leading-relaxed pt-0.5 flex-1 min-w-0">
                <RichText text={cleanText || rawText} enablePronunciation={true} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

/**
 * DataTableBlock: Renders tabular data with horizontal scroll for mobile.
 */
export const DataTableBlock: React.FC<{ headers: string[]; rows: { cells: string[] }[] }> = ({ headers, rows }) => {
  return (
    <div className="my-4 sm:my-5 w-full overflow-hidden border border-slate-200/90 dark:border-slate-800 rounded-2xl sm:rounded-3xl bg-white dark:bg-slate-950">
      <div className="bg-slate-50/80 dark:bg-slate-900/60 px-[0.7875rem] sm:px-[0.9rem] py-[0.45rem] border-b border-slate-200/70 dark:border-slate-800 flex items-center justify-between text-[11px] font-black text-slate-500 dark:text-slate-400">
        <span className="flex items-center gap-1.5 uppercase tracking-wider font-mono">
          <TableIcon className="w-3.5 h-3.5 text-teal-500" />
          <span>Data Table</span>
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[280px] sm:min-w-[360px]">
          <thead>
            <tr className="bg-slate-100/60 dark:bg-slate-900/40">
              {headers.map((h, i) => (
                <th key={i} className="px-3.5 sm:px-4 py-2.5 sm:py-3 text-[11px] sm:text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-wide border-b border-slate-200/80 dark:border-slate-800">
                  <RichText text={h} inline />
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
            {rows.map((row, ri) => (
              <tr key={ri} className="group hover:bg-slate-50/60 dark:hover:bg-slate-900/30 transition-colors">
                {row.cells.map((cell, ci) => (
                  <td key={ci} className="px-3.5 sm:px-4 py-2.5 sm:py-3 text-[12.8px] sm:text-[15px] font-black text-slate-850 dark:text-slate-100 leading-relaxed min-w-[90px] font-hindi">
                    <RichText text={cell} inline />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

/**
 * ImageBlock: Renders an image or inline SVG with responsive constraints and zoom capability.
 */
export const ImageBlock: React.FC<{ url?: string; svgContent?: string; caption?: string }> = ({ url, svgContent, caption }) => {
  const [isZoomed, setIsZoomed] = React.useState(false);
  const [hasError, setHasError] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(!!url && !url.startsWith("data:") && !svgContent);

  const sanitizedSvg = React.useMemo(() => {
    if (!svgContent) return null;
    let clean = sanitizeSvgContent(svgContent);
    // Ensure preserveAspectRatio is set for better responsiveness if not present
    if (clean && !clean.includes("preserveAspectRatio")) {
      clean = clean.replace("<svg", '<svg preserveAspectRatio="xMidYMid meet"');
    }
    // Remove fixed width/height attributes if present to allow CSS responsiveness
    clean = clean.replace(/width=["'][^"']*["']/gi, "");
    clean = clean.replace(/height=["'][^"']*["']/gi, "");
    return clean;
  }, [svgContent]);

  // If sanitizedSvg is present, we are not loading an external image
  React.useEffect(() => {
    if (sanitizedSvg) {
      setIsLoading(false);
      setHasError(false);
    }
  }, [sanitizedSvg]);

  if (!url && !svgContent) return null;

  return (
    <div className="my-4 space-y-2 w-full">
      <div className="relative rounded-2xl overflow-hidden bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 group transition-all min-h-[120px] flex items-center justify-center">
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-100 dark:bg-slate-900 animate-pulse z-20">
            <Loader2 className="w-8 h-8 text-indigo-500/40 animate-spin" />
          </div>
        )}

        {hasError ? (
          <div className="flex flex-col items-center justify-center p-8 text-slate-400 bg-slate-50 dark:bg-slate-900/50 w-full h-full">
            <X className="w-8 h-8 mb-2 opacity-20" />
            <p className="text-[11px] font-black uppercase tracking-widest text-center">Diagram Unavailable</p>
            <p className="text-[11px] mt-1 opacity-60 text-center">Failed to load visual resource.</p>
          </div>
        ) : (
          <div className="w-full h-full flex items-center justify-center relative">
            {sanitizedSvg ? (
              <div 
                className="w-full h-auto max-h-[380px] flex items-center justify-center p-4 sm:p-6 cursor-zoom-in hover:brightness-95 transition-all svg-container overflow-visible [&>svg]:max-w-full [&>svg]:h-auto [&>svg]:max-h-[350px] [&>svg]:w-auto [&>svg]:mx-auto [&>svg]:overflow-visible"
                onClick={() => setIsZoomed(true)}
                dangerouslySetInnerHTML={{ __html: sanitizedSvg }}
              />
            ) : (
              <img 
                src={url} 
                alt={caption || "Question visual"} 
                className={`w-full h-auto max-h-[420px] object-contain mx-auto cursor-zoom-in hover:brightness-95 transition-all duration-300 ${isLoading ? 'opacity-0' : 'opacity-100'}`}
                onLoad={() => setIsLoading(false)}
                onError={() => {
                  setHasError(true);
                  setIsLoading(false);
                }}
                onClick={() => setIsZoomed(true)}
                referrerPolicy="no-referrer"
              />
            )}
            
            {!isLoading && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsZoomed(true);
                }}
                className="absolute bottom-3 right-3 p-2 rounded-xl bg-white/90 dark:bg-slate-950/90 text-slate-700 dark:text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity shadow-sm backdrop-blur-sm cursor-pointer z-10 hover:scale-110 active:scale-95"
                title="View Full Size"
              >
                <Maximize2 className="w-4 h-4" />
              </button>
            )}
          </div>
        )}
      </div>
      
      {caption && (
        <p className="text-center text-[11px] font-black text-slate-500 uppercase tracking-widest italic px-4">
          {caption}
        </p>
      )}

      {/* Zoom Modal */}
      {isZoomed && (
        <div 
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md cursor-zoom-out animate-in fade-in"
          onClick={() => setIsZoomed(false)}
        >
          <div className="relative max-w-5xl max-h-[90vh] w-full flex flex-col items-center">
            <button 
              className="absolute -top-12 right-0 p-2 text-white hover:text-slate-300"
              onClick={() => setIsZoomed(false)}
            >
              <X className="w-6 h-6" />
            </button>
            
            {sanitizedSvg ? (
              <div 
                className="max-h-[85vh] w-full bg-white dark:bg-slate-900 p-4 rounded-xl shadow-2xl flex items-center justify-center overflow-auto [&>svg]:max-w-full [&>svg]:h-auto [&>svg]:max-h-[80vh]"
                dangerouslySetInnerHTML={{ __html: sanitizedSvg }}
              />
            ) : (
              <img 
                src={url} 
                alt={caption || "Zoomed view"} 
                className="max-h-[85vh] w-auto object-contain rounded-xl shadow-2xl"
              />
            )}

            {caption && (
              <p className="mt-4 text-white text-sm font-bold bg-black/40 px-4 py-2 rounded-full backdrop-blur-sm">
                {caption}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
