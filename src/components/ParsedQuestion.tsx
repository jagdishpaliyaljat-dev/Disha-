import React, { useState } from "react";
import { Question } from "../types";
import { RichText } from "./RichText";
import { ImageBlock, MatchFollowingBlock } from "./MCQQuestionBlocks";
import { QuestionTable } from "./QuestionTable";
import { Sparkles, ChevronDown, ChevronUp, BookOpen } from "lucide-react";

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
      {/* Classification & Multi-Exam History Bar */}
      {verifiedHistory.length > 0 ? (
        <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap pb-1.5 pt-0.5">

          {/* Exam Tags */}
          {visibleExams.map((entry: any, eIdx: number) => (
            <React.Fragment key={eIdx}>
              {eIdx > 0 && (
                <span className="text-slate-300 dark:text-slate-600 select-none text-xs font-normal px-0.5">|</span>
              )}
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 sm:px-3 sm:py-1 rounded-full bg-red-50/90 dark:bg-red-950/40 text-red-900 dark:text-red-200 border border-red-100/80 dark:border-red-900/50 text-xs sm:text-xs font-bold shrink-0 max-w-[220px] sm:max-w-none truncate">
                <span>{entry.examName}</span>
                {entry.year && (
                  <>
                    <span className="text-red-400 dark:text-red-500 font-normal select-none">•</span>
                    <span className="font-semibold text-red-800 dark:text-red-300">{entry.year}</span>
                  </>
                )}
                {entry.shift && <span className="text-[10px] text-red-500 font-normal">({entry.shift})</span>}
              </span>
            </React.Fragment>
          ))}

          {/* Expand / Collapse Button (+N) */}
          {verifiedHistory.length > 2 && (
            <button
              type="button"
              onClick={() => setIsExpandedExams(!isExpandedExams)}
              className="inline-flex items-center gap-1 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full bg-red-50 hover:bg-red-100 dark:bg-red-950/60 dark:hover:bg-red-900/60 text-red-900 dark:text-red-200 border border-red-100 dark:border-red-900/50 text-xs font-bold cursor-pointer transition-colors shrink-0"
              title={isExpandedExams ? "Collapse exam list" : "Show all exams"}
            >
              <span>{isExpandedExams ? "Show Less" : `+${hiddenCount}`}</span>
              {isExpandedExams ? (
                <ChevronUp className="w-3 h-3 text-red-800 dark:text-red-300" />
              ) : (
                <ChevronDown className="w-3 h-3 text-red-800 dark:text-red-300" />
              )}
            </button>
          )}
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
