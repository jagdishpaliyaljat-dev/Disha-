import React from "react";
import katex from 'katex';
import { Image as ImageIcon } from 'lucide-react';
import 'katex/dist/contrib/mhchem.min.js';

import { 
  isEligibleEnglishWord, 
  playBritishPronunciation, 
  subscribePronunciation 
} from "../services/britishPronunciationService";

export interface RichTextProps {
  text?: string;
  content?: string;
  className?: string;
  inline?: boolean;
  enablePronunciation?: boolean;
}

const PronounceableWord: React.FC<{ word: string }> = ({ word }) => {
  const [isPlaying, setIsPlaying] = React.useState(false);

  React.useEffect(() => {
    return subscribePronunciation((current) => {
      setIsPlaying(Boolean(current && current.toLowerCase() === word.toLowerCase()));
    });
  }, [word]);

  return (
    <span
      onClick={(e) => {
        e.stopPropagation();
        playBritishPronunciation(word);
      }}
      className={`inline cursor-pointer select-text transition-colors duration-150 ${
        isPlaying
          ? 'text-indigo-600 dark:text-indigo-400 font-extrabold underline decoration-indigo-400/80 underline-offset-2'
          : 'hover:text-indigo-600 dark:hover:text-indigo-400 hover:underline hover:decoration-indigo-300/60 underline-offset-2'
      }`}
      title={`Tap to listen: ${word} (British English)`}
    >
      {word}
    </span>
  );
};

interface Segment {
  type: 'text' | 'inline-math' | 'display-math' | 'image';
  content: string;
}

/**
 * Splits text into plain text segments, explicit math segments ($...$, $$...$$, \(...\), \[...\]),
 * and image placeholders ([image:...], [diagram:...], [चित्र:...]).
 * Strictly NO auto-detection or auto-wrapping of chemistry or math on plain text outside explicit delimiters.
 */
function parseRichTextSegments(rawText: string): Segment[] {
  if (!rawText) return [];

  const segments: Segment[] = [];
  let index = 0;

  // Match only explicit math delimiters or image placeholders:
  // 1. $$ ... $$
  // 2. \[ ... \]
  // 3. $ ... $
  // 4. \( ... \)
  // 5. [image: ...], [diagram: ...], [चित्र: ...]
  const delimiterRegex = /(\$\$[\s\S]+?\$\$|\\\[[\s\S]+?\\\]|\$[^$\n]+?\$|\\\([\s\S]+?\\\)|\[(?:image|diagram|चित्र)\s*[:：]\s*[\s\S]+?\])/gi;

  let match: RegExpExecArray | null;

  while ((match = delimiterRegex.exec(rawText)) !== null) {
    if (match.index > index) {
      segments.push({
        type: 'text',
        content: rawText.slice(index, match.index)
      });
    }

    const matchedStr = match[0];
    if (matchedStr.startsWith('$$') && matchedStr.endsWith('$$')) {
      segments.push({
        type: 'display-math',
        content: matchedStr.slice(2, -2)
      });
    } else if (matchedStr.startsWith('\\[') && matchedStr.endsWith('\\]')) {
      segments.push({
        type: 'display-math',
        content: matchedStr.slice(2, -2)
      });
    } else if (matchedStr.startsWith('$') && matchedStr.endsWith('$')) {
      segments.push({
        type: 'inline-math',
        content: matchedStr.slice(1, -1)
      });
    } else if (matchedStr.startsWith('\\(') && matchedStr.endsWith('\\)')) {
      segments.push({
        type: 'inline-math',
        content: matchedStr.slice(2, -2)
      });
    } else if (/^\[(?:image|diagram|चित्र)/i.test(matchedStr)) {
      const colonIndex = matchedStr.indexOf(':') !== -1 ? matchedStr.indexOf(':') : matchedStr.indexOf('：');
      segments.push({
        type: 'image',
        content: matchedStr.slice(colonIndex + 1, -1).trim()
      });
    }

    index = match.index + matchedStr.length;
  }

  if (index < rawText.length) {
    segments.push({
      type: 'text',
      content: rawText.slice(index)
    });
  }

  return segments;
}

export const RichText: React.FC<RichTextProps> = ({ 
  text, 
  content, 
  className = '', 
  inline = false,
  enablePronunciation = false 
}) => {
  const targetText = content || text || "";
  if (!targetText) return null;

  const segments = parseRichTextSegments(targetText);

  const renderKaTeX = (math: string, displayMode: boolean) => {
    try {
      const html = katex.renderToString(math, {
        displayMode,
        throwOnError: false,
        strict: false
      });
      return <span dangerouslySetInnerHTML={{ __html: html }} />;
    } catch (e) {
      return <span>{math}</span>;
    }
  };

  const WrapperTag = inline ? 'span' : 'div';

  return (
    <WrapperTag className={`rich-text-container ${inline ? 'inline' : 'block'} whitespace-pre-wrap break-words [overflow-wrap:anywhere] ${className}`}>
      {segments.map((segment, idx) => {
        if (segment.type === 'text') {
          if (!enablePronunciation) {
            return <span key={idx}>{segment.content}</span>;
          }
          const tokens = segment.content.split(/([a-zA-Z]+(?:-[a-zA-Z]+)*)/g);
          return (
            <span key={idx}>
              {tokens.map((token, tIdx) => {
                if (!token) return null;
                if (isEligibleEnglishWord(token)) {
                  return <PronounceableWord key={tIdx} word={token} />;
                }
                return <span key={tIdx}>{token}</span>;
              })}
            </span>
          );
        }
        if (segment.type === 'display-math') {
          return (
            <span key={idx} className="block my-1">
              {renderKaTeX(segment.content, true)}
            </span>
          );
        }
        if (segment.type === 'inline-math') {
          return (
            <span key={idx} className="inline-block px-0.5">
              {renderKaTeX(segment.content, false)}
            </span>
          );
        }
        if (segment.type === 'image') {
          const isUrl = segment.content.startsWith('http') || segment.content.startsWith('data:image') || segment.content.startsWith('/api/diagrams') || segment.content.startsWith('/');
          return (
            <div key={idx} className="my-3 sm:my-4">
              {isUrl ? (
                <div className="relative group rounded-2xl overflow-hidden bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-2 max-w-md mx-auto shadow-xs">
                  <img
                    src={segment.content}
                    alt="Question Diagram"
                    className="w-full h-auto max-h-[320px] object-contain mx-auto transition-transform group-hover:scale-[1.02]"
                    onError={(e) => {
                      (e.currentTarget as HTMLElement).style.display = 'none';
                      const parent = e.currentTarget.parentElement;
                      if (parent) {
                        parent.innerHTML = `<div class="p-3 text-center text-xs text-rose-500 font-bold">⚠️ Diagram image failed to load</div>`;
                      }
                    }}
                  />
                </div>
              ) : (
                <div className="p-3 sm:p-4 border border-indigo-200/80 dark:border-indigo-900/60 rounded-2xl bg-indigo-50/40 dark:bg-indigo-950/20 flex flex-col gap-1.5 shadow-2xs">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-md bg-indigo-600 text-white font-black text-[10px] uppercase">
                      📐 Diagram
                    </span>
                  </div>
                  <span className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-200 leading-relaxed">
                    {segment.content}
                  </span>
                </div>
              )}
            </div>
          );
        }
        return null;
      })}
    </WrapperTag>
  );
};

export default RichText;
