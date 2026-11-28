import React, { useState } from "react";
import { motion } from "motion/react";
import {
  ExamPaperAnalysis,
  ExamQuestionMatch,
  ExamMatchCategory,
  Question,
  MCQSession,
} from "../../types";
import { calculateCoverageMetrics } from "../../utils/examMatcher";
import { generateExamAnalysisPDF } from "../../utils/examPdfReport";
import {
  Download,
  Share2,
  ChevronRight,
  Filter,
  CheckCircle2,
  AlertTriangle,
  Play,
  RotateCcw,
  Sparkles,
  PieChart,
  BarChart2,
  Layers,
  BookOpen,
} from "lucide-react";

interface AnalysisReportViewProps {
  analysis: ExamPaperAnalysis;
  onOpenQuestionComparison: (match: ExamQuestionMatch) => void;
  onStartSession?: (session: MCQSession) => void;
  onNewAnalysis: () => void;
  onOpenHistory: () => void;
}

export const AnalysisReportView: React.FC<AnalysisReportViewProps> = ({
  analysis,
  onOpenQuestionComparison,
  onStartSession,
  onNewAnalysis,
  onOpenHistory,
}) => {
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [activeTab, setActiveTab] = useState<"questions" | "breakdowns">("questions");

  const coverage = calculateCoverageMetrics(analysis.questions);

  // Filter questions
  const filteredQuestions = analysis.questions.filter((q) => {
    if (filterCategory === "all") return true;
    if (filterCategory === "matched") return q.primaryMatchCategory !== "unmatched";
    if (filterCategory === "review") return q.processingStatus === "needs_review";
    return q.primaryMatchCategory === filterCategory;
  });

  // Practice only matched questions
  const handlePracticeMatched = () => {
    if (!onStartSession) return;
    const matchedQIds = analysis.questions
      .filter((q) => q.bestMatchQuestionId && q.primaryMatchCategory !== "unmatched")
      .map((q) => q.bestMatchQuestionId as string);

    if (matchedQIds.length === 0) return;

    onStartSession({
      title: `${analysis.examName} (${analysis.paperYear}) Matched Practice`,
      subtitle: `${matchedQIds.length} Questions from Question Bank`,
      questionIds: matchedQIds,
      source: "full-exam",
      isTestMode: false,
    });
  };

  return (
    <div className="space-y-4 max-w-2xl mx-auto pb-14">
      {/* Top Header Card */}
      <div className="bg-gradient-to-r from-[#7045D8] via-[#5B32BF] to-[#31275E] text-white rounded-3xl p-4 sm:p-5 shadow-xl border border-[#7045D8]/30 relative overflow-hidden">
        <div className="relative z-10 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="px-2.5 py-0.5 rounded-md bg-[#7045D8] text-white text-[10px] font-black uppercase tracking-wider flex items-center gap-1 shadow-xs">
              <Sparkles className="w-3 h-3 text-[#FFFFFF] fill-[#FFFFFF]" />
              Disha PYQ • Verified Analysis Report
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => generateExamAnalysisPDF(analysis)}
                className="px-2.5 py-1 rounded-xl bg-white/15 hover:bg-white/25 border border-[#7045D8]/30 text-[11px] font-bold text-[#FFFFFF] flex items-center gap-1 backdrop-blur-xs transition-colors cursor-pointer"
                title="Download PDF Report"
              >
                <Download className="w-3.5 h-3.5 text-[#7045D8] dark:text-[#A78BFA]" />
                <span>Export PDF</span>
              </button>
            </div>
          </div>

          <div>
            <h1 className="text-lg sm:text-xl font-black tracking-tight leading-tight text-[#FFFFFF]">
              {analysis.examName} ({analysis.paperYear})
            </h1>
            <p className="text-xs text-[#F8FAFC]/90 font-medium mt-0.5">
              {analysis.paperName} {analysis.shiftCode ? `• ${analysis.shiftCode}` : ""} • Analyzed {new Date(analysis.createdAt).toLocaleDateString()}
            </p>
          </div>
        </div>
      </div>

      {/* 3 MUTUALLY EXCLUSIVE COVERAGE METRICS (Strict Formulations) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        {/* Metric 1: Exact Coverage */}
        <div className="bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/40 rounded-2xl p-3.5 space-y-1">
          <span className="text-[10px] font-black uppercase text-emerald-800 dark:text-emerald-400 tracking-wider block">
            Exact Match Coverage
          </span>
          <div className="flex items-baseline gap-1.5 tabular-nums">
            <span className="text-2xl font-black text-emerald-900 dark:text-emerald-200">
              {coverage.exactCoverage}%
            </span>
            <span className="text-[10px] font-bold text-emerald-700/80 dark:text-emerald-400/80">
              ({coverage.exact}/{coverage.total})
            </span>
          </div>
          <p className="text-[9.5px] font-medium text-emerald-800/80 dark:text-emerald-300/80 leading-snug">
            Identical questions word-for-word in Question Bank.
          </p>
        </div>

        {/* Metric 2: Near-Exact Coverage */}
        <div className="bg-[#7045D8]/5 dark:bg-[#7045D8]/15 border border-[#7045D8]/20 dark:border-[#31275E] rounded-2xl p-3.5 space-y-1">
          <span className="text-[10px] font-black uppercase text-[#7045D8] dark:text-[#A78BFA] tracking-wider block">
            Near-Exact Coverage
          </span>
          <div className="flex items-baseline gap-1.5 tabular-nums">
            <span className="text-2xl font-black text-slate-900 dark:text-slate-50">
              {coverage.nearExactCoverage}%
            </span>
            <span className="text-[10px] font-bold text-[#7045D8]/80 dark:text-[#A78BFA]/80">
              ({coverage.exact + coverage.nearExact}/{coverage.total})
            </span>
          </div>
          <p className="text-[9.5px] font-medium text-slate-600 dark:text-slate-400 leading-snug">
            Exact + minor rephrasing with identical answers.
          </p>
        </div>

        {/* Metric 3: Related Question Coverage */}
        <div className="bg-[#F8FAFC] dark:bg-[#1B1536] border border-[#7045D8]/60 dark:border-[#A78BFA]/40 rounded-2xl p-3.5 space-y-1">
          <span className="text-[10px] font-black uppercase text-[#7045D8] dark:text-[#A78BFA] tracking-wider block">
            Related Question Coverage
          </span>
          <div className="flex items-baseline gap-1.5 tabular-nums">
            <span className="text-2xl font-black text-[#7045D8] dark:text-slate-50">
              {coverage.relatedCoverage}%
            </span>
            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-300">
              ({coverage.exact + coverage.nearExact + coverage.similar + coverage.concept}/{coverage.total})
            </span>
          </div>
          <p className="text-[9.5px] font-medium text-slate-600 dark:text-slate-400 leading-snug">
            All questions covering the same tested concepts.
          </p>
        </div>
      </div>

      {/* Primary KPI Breakdown Row */}
      <div className="bg-white dark:bg-[#1B1536] rounded-3xl p-3.5 border border-slate-200 dark:border-[#31275E] shadow-xs grid grid-cols-2 sm:grid-cols-6 gap-2 text-center tabular-nums">
        <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/30">
          <span className="text-[9.5px] font-bold text-emerald-700 dark:text-emerald-400 block uppercase">
            Exact
          </span>
          <span className="text-base font-black text-emerald-900 dark:text-emerald-200">
            {coverage.exact}
          </span>
        </div>

        <div className="p-2 rounded-xl bg-[#7045D8]/10 dark:bg-[#7045D8]/20">
          <span className="text-[9.5px] font-bold text-[#7045D8] dark:text-[#A78BFA] block uppercase">
            Near-Exact
          </span>
          <span className="text-base font-black text-slate-900 dark:text-slate-50">
            {coverage.nearExact}
          </span>
        </div>

        <div className="p-2 rounded-xl bg-[#7045D8]/10 dark:bg-[#7045D8]/20">
          <span className="text-[9.5px] font-bold text-[#5B32BF] dark:text-[#A78BFA] block uppercase">
            Similar
          </span>
          <span className="text-base font-black text-slate-900 dark:text-slate-50">
            {coverage.similar}
          </span>
        </div>

        <div className="p-2 rounded-xl bg-[#7045D8]/10 dark:bg-[#7045D8]/25">
          <span className="text-[9.5px] font-bold text-[#7045D8] dark:text-[#A78BFA] block uppercase">
            Related
          </span>
          <span className="text-base font-black text-[#7045D8] dark:text-slate-50">
            {coverage.concept}
          </span>
        </div>

        <div className="p-2 rounded-xl bg-slate-100 dark:bg-[#241D48]">
          <span className="text-[9.5px] font-bold text-slate-500 dark:text-slate-400 block uppercase">
            Unmatched
          </span>
          <span className="text-base font-black text-slate-900 dark:text-slate-50">
            {coverage.unmatched}
          </span>
        </div>

        <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/30">
          <span className="text-[9.5px] font-bold text-amber-700 dark:text-amber-400 block uppercase">
            Needs Review
          </span>
          <span className="text-base font-black text-amber-900 dark:text-amber-200">
            {coverage.needsReview}
          </span>
        </div>
      </div>

      {/* Action Buttons: Practice & New Analysis */}
      <div className="flex items-center gap-2">
        {coverage.exact + coverage.nearExact + coverage.similar + coverage.concept > 0 && onStartSession && (
          <button
            onClick={handlePracticeMatched}
            className="flex-1 py-2.5 px-3 rounded-2xl bg-[#7045D8] hover:bg-[#5B32BF] dark:bg-[#7045D8] dark:hover:bg-[#5B32BF] text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm transition-colors cursor-pointer tabular-nums"
          >
            <Play className="w-3.5 h-3.5 fill-white" />
            <span>Practice Matched Questions ({coverage.exact + coverage.nearExact + coverage.similar + coverage.concept})</span>
          </button>
        )}

        <button
          onClick={onNewAnalysis}
          className="py-2.5 px-3 rounded-2xl bg-white dark:bg-[#1B1536] border border-slate-200 dark:border-[#31275E] hover:border-[#7045D8] text-slate-900 dark:text-slate-50 font-bold text-xs flex items-center gap-1 transition-colors cursor-pointer"
        >
          <RotateCcw className="w-3.5 h-3.5 text-[#7045D8]" />
          <span>New Paper</span>
        </button>
      </div>

      {/* Tabs: Questions List vs Breakdowns */}
      <div className="flex border-b border-slate-200 dark:border-[#31275E]">
        <button
          onClick={() => setActiveTab("questions")}
          className={`py-2 px-4 text-xs font-black border-b-2 transition-colors cursor-pointer tabular-nums ${
            activeTab === "questions"
              ? "border-[#7045D8] dark:border-[#A78BFA] text-[#7045D8] dark:text-[#A78BFA]"
              : "border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
          }`}
        >
          Questions List ({analysis.questions.length})
        </button>

        <button
          onClick={() => setActiveTab("breakdowns")}
          className={`py-2 px-4 text-xs font-black border-b-2 transition-colors cursor-pointer ${
            activeTab === "breakdowns"
              ? "border-[#7045D8] dark:border-[#A78BFA] text-[#7045D8] dark:text-[#A78BFA]"
              : "border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
          }`}
        >
          Subject & Chapter Breakdown
        </button>
      </div>

      {activeTab === "questions" && (
        <div className="space-y-3">
          {/* Category Filter Controls */}
          <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-[#1B1536] border border-slate-200 dark:border-[#31275E] rounded-2xl overflow-x-auto scrollbar-none">
            {[
              { id: "all", label: "All Questions" },
              { id: "exact", label: "Exact" },
              { id: "near_exact", label: "Near-Exact" },
              { id: "similar", label: "Similar" },
              { id: "concept_related", label: "Related" },
              { id: "unmatched", label: "Unmatched" },
              { id: "review", label: "Needs Review" },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setFilterCategory(f.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer min-h-[36px] ${
                  filterCategory === f.id
                    ? "bg-[#7045D8] dark:bg-[#7045D8] text-white shadow-xs"
                    : "text-slate-600 dark:text-slate-300 hover:text-[#7045D8] dark:hover:text-white"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Question Match Cards */}
          <div className="space-y-2.5">
            {filteredQuestions.map((q, idx) => {
              let categoryTextColor = "text-slate-500 dark:text-slate-400";
              let badgeText = "Unmatched";

              if (q.primaryMatchCategory === "exact") {
                categoryTextColor = "text-emerald-700 dark:text-emerald-400";
                badgeText = "Exact Match";
              } else if (q.primaryMatchCategory === "near_exact") {
                categoryTextColor = "text-[#7045D8] dark:text-[#A78BFA]";
                badgeText = "Near-Exact Match";
              } else if (q.primaryMatchCategory === "similar") {
                categoryTextColor = "text-[#5B32BF] dark:text-[#A78BFA]";
                badgeText = "Similar Question";
              } else if (q.primaryMatchCategory === "concept_related") {
                categoryTextColor = "text-[#7045D8] dark:text-[#7045D8] dark:text-[#A78BFA]";
                badgeText = "Related Concept";
              }

              return (
                <div
                  key={q.examQuestionId || idx}
                  onClick={() => onOpenQuestionComparison(q)}
                  className="p-4 rounded-2xl bg-white dark:bg-[#1B1536] border border-slate-200 dark:border-[#31275E] shadow-2xs hover:border-[#7045D8] dark:hover:border-[#A78BFA] hover:shadow-xs transition-all cursor-pointer group space-y-2.5"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs">
                      <span className="w-6 h-6 rounded-lg bg-[#7045D8]/10 dark:bg-[#7045D8]/20 text-[#7045D8] dark:text-[#A78BFA] font-bold text-[11px] tabular-nums flex items-center justify-center shrink-0">
                        Q{q.originalQuestionNumber || idx + 1}
                      </span>
                      <span className={`font-black ${categoryTextColor}`}>
                        {badgeText}
                      </span>
                      {q.matchScore > 0 && (
                        <>
                          <span className="text-slate-300 dark:text-[#31275E]" aria-hidden="true">·</span>
                          <span className="text-slate-500 dark:text-slate-400 font-semibold text-[11px] tabular-nums">
                            {q.matchScore}% Score
                          </span>
                        </>
                      )}
                      <span className="text-slate-300 dark:text-[#31275E]" aria-hidden="true">·</span>
                      <span className="text-slate-500 dark:text-slate-400 text-[10.5px] tabular-nums">
                        Page {q.sourcePageNumber}
                      </span>
                      {q.processingStatus === "needs_review" && (
                        <>
                          <span className="text-slate-300 dark:text-[#31275E]" aria-hidden="true">·</span>
                          <span className="text-amber-600 dark:text-amber-400 text-[10.5px] font-bold flex items-center gap-0.5">
                            <AlertTriangle className="w-3 h-3" />
                            Needs Review
                          </span>
                        </>
                      )}
                    </div>

                    <div className="flex items-center gap-1 text-[11px] font-bold text-[#7045D8] dark:text-[#A78BFA] group-hover:translate-x-0.5 transition-transform shrink-0">
                      <span>Side-by-side</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </div>
                  </div>

                  <p className="text-xs font-medium text-slate-900 dark:text-slate-50 line-clamp-2 leading-relaxed">
                    {q.originalText}
                  </p>

                  {q.bestMatchQuestion && (
                    <div className="p-2.5 rounded-xl bg-[#F8FAFC] dark:bg-[#241D48] border border-slate-200 dark:border-[#31275E] text-[11px] text-slate-600 dark:text-slate-300 flex items-start gap-2">
                      <BookOpen className="w-3.5 h-3.5 text-[#7045D8] shrink-0 mt-0.5" />
                      <div className="min-w-0 flex-1">
                        <span className="font-bold text-[#7045D8] dark:text-slate-50 mr-1">
                          Question Bank Match:
                        </span>
                        <span className="italic line-clamp-1">
                          "{q.bestMatchQuestion.text}"
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {activeTab === "breakdowns" && (
        <div className="space-y-4">
          {/* Chapter / Subject Breakdown Table */}
          {analysis.chapterBreakdown && Object.keys(analysis.chapterBreakdown).length > 0 ? (
            <div className="bg-white dark:bg-[#1B1536] rounded-3xl p-4 border border-slate-200 dark:border-[#31275E] shadow-xs space-y-3">
              <h3 className="text-xs font-black uppercase text-[#7045D8] dark:text-[#A78BFA] tracking-wider">
                Chapter-Wise Coverage Breakdown
              </h3>

              <div className="space-y-2">
                {Object.entries(analysis.chapterBreakdown).map(([chId, stats]) => (
                  <div
                    key={chId}
                    className="p-3 rounded-2xl bg-[#F8FAFC] dark:bg-[#241D48] border border-slate-200 dark:border-[#31275E] flex items-center justify-between"
                  >
                    <div>
                      <h4 className="text-xs font-bold text-slate-900 dark:text-slate-50">
                        {stats.name || chId}
                      </h4>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 tabular-nums">
                        Exact: {stats.exact} • Near-Exact: {stats.nearExact} • Similar: {stats.similar} • Related: {stats.concept}
                      </p>
                    </div>

                    <div className="text-right">
                      <span className="text-xs font-black tabular-nums text-[#7045D8] dark:text-[#A78BFA]">
                        {stats.total} Questions
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="py-8 text-center text-slate-500 dark:text-slate-400 bg-white dark:bg-[#1B1536] rounded-3xl border border-slate-200 dark:border-[#31275E]">
              <p className="text-xs font-medium">Chapter breakdown will appear when questions are mapped to syllabus.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
