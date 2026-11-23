import React, { useState } from "react";
import { Question } from "../types";
import { RichText } from "./RichText";
import { ImageBlock, MatchFollowingBlock } from "./MCQQuestionBlocks";
import { QuestionTable } from "./QuestionTable";
import { 
  Sparkles, 
  ChevronDown, 
  ChevronUp, 
  BookOpen,
  BadgeCheck,
  Landmark,
  Calendar,
  Flame,
  Award,
} from "lucide-react";

export interface ParsedQuestionData {
  type: string;
  intro: string;
  statements: any[];
  matchPairs: any[];
  conclusions: any[];
  assertion?: any;
  reason?: any;
  instruction?: string;
  sequenceItems?: any[];
  tableData?: any;
}

/**
 * Backwards compatibility helper for pdfGenerator or legacy references.
 */
export function parseQuestionContent(rawText: string): ParsedQuestionData {
  return {
    type: "direct",
    intro: rawText || "",
    statements: [],
    matchPairs: [],
    conclusions: [],
  };
}

interface ParsedQuestionProps {
  text: string;
  fontSizeClass?: string;
  question?: Question | any;
}

/**
 * ParsedQuestion component renders full question text exactly as stored,
 * keeping all lines in order with whitespace-pre-wrap, using RichText,
 * and renders any optional table or matchTable after the question text.
 */
import { detectQuestionExams } from "../lib/mcqImport/examDetector";

export const ParsedQuestion: React.FC<ParsedQuestionProps> = ({ 
  text, 
  fontSizeClass = "text-lg",
  question 
}) => {
  const [isExpandedExams, setIsExpandedExams] = useState(false);
  const rawText = (question?.text || question?.question || text || "").trim();

  // Dynamically extract all verified exam history or legacy exam/year from question metadata or text
  const detection = detectQuestionExams(question ? { ...question, text: rawText } : { text: rawText });
  const historyList = detection.examHistory || [];
  const verifiedHistory = historyList.filter((entry: any) => entry.verified !== false);
  const isPYQ = Boolean(
    verifiedHistory.length > 0 ||
    question?.isPYQ ||
    question?.questionClassification === "pyq" ||
    question?.questionClassification === "pyq_practice"
  );
  const fullText = detection.cleanText || rawText;

  const tableData = question?.table || question?.tableData;
  const matchTable = question?.matchTable || question?.matchData;
  const rawSvg = question?.image?.svg || question?.image?.content || question?.svgContent;
  const altText = question?.image?.alt || question?.image?.description || "Diagram";

  const visibleExams = isExpandedExams ? verifiedHistory : verifiedHistory.slice(0, 2);
  const hiddenCount = verifiedHistory.length - 2;

  return (
    <div className="space-y-3 sm:space-y-4 font-hindi w-full select-none break-words [overflow-wrap:anywhere] text-left">
      {/* Official Exam Provenance & Year Authenticity Strip */}
      {verifiedHistory.length > 0 ? (
        <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap pb-1.5 pt-0.5">
          {/* Certified PYQ Stamp Badge */}
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-gradient-to-r from-amber-500/15 to-[#C99A45]/25 dark:from-amber-400/20 dark:to-[#C99A45]/30 text-[#800020] dark:text-amber-300 border border-amber-500/30 text-[10px] font-black uppercase tracking-wider shrink-0 shadow-2xs">
            <BadgeCheck className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
            <span>PYQ Verified</span>
          </span>

          {/* Repeat Frequency Indicator (if asked multiple times) */}
          {verifiedHistory.length > 1 && (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-rose-500/15 dark:bg-rose-500/25 text-rose-700 dark:text-rose-300 border border-rose-500/30 text-[10px] font-black shrink-0">
              <Flame className="w-3.5 h-3.5 text-rose-500" />
              <span>{verifiedHistory.length} बार पूछा गया</span>
            </span>
          )}

          {/* Individual Exam & Year Badges */}
          {visibleExams.map((entry: any, eIdx: number) => (
            <span
              key={eIdx}
              className="inline-flex items-center gap-1.5 px-2.5 py-0.5 sm:px-3 sm:py-1 rounded-lg bg-white dark:bg-[#1A1428] text-slate-800 dark:text-[#E8D9C0] border border-[#E8D9C0] dark:border-[#3A2E56] shadow-2xs text-[11px] font-bold shrink-0 max-w-[260px] sm:max-w-none truncate group hover:border-[#800020] dark:hover:border-amber-400/50 transition-colors"
            >
              <Landmark className="w-3.5 h-3.5 text-[#800020] dark:text-amber-400 shrink-0" />
              <span className="truncate">{entry.examName}</span>
              {entry.year && (
                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded bg-[#C99A45]/15 dark:bg-[#C99A45]/25 text-[#800020] dark:text-amber-300 font-mono font-extrabold text-[10px]">
                  <Calendar className="w-2.5 h-2.5 text-amber-600 dark:text-amber-400" />
                  <span>{entry.year}</span>
                </span>
              )}
              {entry.shift && (
                <span className="text-[9.5px] font-medium text-slate-500 dark:text-slate-400">
                  ({entry.shift})
                </span>
              )}
            </span>
          ))}

          {/* Expand / Collapse Button (+N) */}
          {verifiedHistory.length > 2 && (
            <button
              type="button"
              onClick={() => setIsExpandedExams(!isExpandedExams)}
              className="inline-flex items-center gap-1 px-2.5 py-0.5 sm:px-3 sm:py-1 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 text-[10.5px] font-black cursor-pointer transition-colors shrink-0"
              title={isExpandedExams ? "Collapse exam list" : "Show all exams"}
            >
              <span>{isExpandedExams ? "Show Less" : `+${hiddenCount}`}</span>
              {isExpandedExams ? (
                <ChevronUp className="w-3 h-3" />
              ) : (
                <ChevronDown className="w-3 h-3" />
              )}
            </button>
          )}
        </div>
      ) : isPYQ ? (
        <div className="flex items-center gap-1.5 pb-1 pt-0.5">
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-gradient-to-r from-amber-500/15 to-[#C99A45]/25 dark:from-amber-400/20 dark:to-[#C99A45]/30 text-[#800020] dark:text-amber-300 border border-amber-500/30 text-[10px] font-black uppercase tracking-wider shrink-0 shadow-2xs">
            <Award className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
            <span>प्रमाणित पूर्व वर्ष प्रश्न (Official PYQ)</span>
          </span>
        </div>
      ) : null}

      <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 items-start">
        {(question?.imageUrl || rawSvg) && (
          <div className="w-full sm:w-1/2 lg:w-2/5 shrink-0">
            <ImageBlock 
              url={question?.imageUrl} 
              svgContent={rawSvg}
              caption={altText}
            />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <RichText 
            text={fullText} 
            enablePronunciation={true}
            className={`font-hindi text-slate-900 dark:text-slate-100 font-bold select-none leading-relaxed ${fontSizeClass}`} 
          />
        </div>
      </div>
      {matchTable && Array.isArray(matchTable.rows) && matchTable.rows.length > 0 && (
        <MatchFollowingBlock
          leftTitle={matchTable.leftTitle}
          rightTitle={matchTable.rightTitle}
          rows={matchTable.rows}
        />
      )}
      {tableData && <QuestionTable table={tableData} />}
    </div>
  );
};

export default ParsedQuestion;
