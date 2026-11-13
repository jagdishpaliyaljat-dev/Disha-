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
      <div className="bg-gradient-to-r from-[#800020] via-[#6A001A] to-[#4A0012] text-white rounded-3xl p-4 sm:p-5 shadow-xl border border-[#C99A45]/40 relative overflow-hidden">
        <div className="relative z-10 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="px-2.5 py-0.5 rounded-md bg-[#F47B20] text-white text-[10px] font-black uppercase tracking-wider flex items-center gap-1 shadow-xs">
              <Sparkles className="w-3 h-3 text-[#FFF9EF] fill-[#FFF9EF]" />
              DISHA 20-20 • Verified Analysis Report
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => generateExamAnalysisPDF(analysis)}
                className="px-2.5 py-1 rounded-xl bg-white/15 hover:bg-white/25 border border-[#C99A45]/40 text-[11px] font-bold text-[#FFF9EF] flex items-center gap-1 backdrop-blur-xs transition-colors cursor-pointer"
                title="Download PDF Report"
              >
                <Download className="w-3.5 h-3.5 text-[#C99A45]" />
                <span>Export PDF</span>
              </button>
            </div>
          </div>

          <div>
            <h1 className="text-lg sm:text-xl font-black tracking-tight leading-tight text-[#FFF9EF]">
              {analysis.examName} ({analysis.paperYear})
            </h1>
            <p className="text-xs text-[#F7EFE2]/90 font-medium mt-0.5">
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
        <div className="bg-teal-50/70 dark:bg-teal-950/20 border border-teal-200 dark:border-teal-900/40 rounded-2xl p-3.5 space-y-1">
          <span className="text-[10px] font-black uppercase text-teal-800 dark:text-teal-400 tracking-wider block">
            Near-Exact Coverage
          </span>
          <div className="flex items-baseline gap-1.5 tabular-nums">
            <span className="text-2xl font-black text-teal-900 dark:text-teal-200">
              {coverage.nearExactCoverage}%
            </span>
            <span className="text-[10px] font-bold text-teal-700/80 dark:text-teal-400/80">
              ({coverage.exact + coverage.nearExact}/{coverage.total})
            </span>
          </div>
          <p className="text-[9.5px] font-medium text-teal-800/80 dark:text-teal-300/80 leading-snug">
            Exact + minor rephrasing with identical answers.
          </p>
        </div>

        {/* Metric 3: Related Question Coverage */}
        <div className="bg-[#FFF9EF] dark:bg-[#1F2330] border border-[#C99A45]/60 dark:border-[#F47B20]/40 rounded-2xl p-3.5 space-y-1">
          <span className="text-[10px] font-black uppercase text-[#800020] dark:text-[#F47B20] tracking-wider block">
            Related Question Coverage
          </span>
          <div className="flex items-baseline gap-1.5 tabular-nums">
            <span className="text-2xl font-black text-[#800020] dark:text-[#FFF9EF]">
              {coverage.relatedCoverage}%
            </span>
            <span className="text-[10px] font-bold text-[#6E6254] dark:text-[#C4B9A8]">
              ({coverage.exact + coverage.nearExact + coverage.similar + coverage.concept}/{coverage.total})
            </span>
          </div>
          <p className="text-[9.5px] font-medium text-[#5C5346] dark:text-[#A39887] leading-snug">
            All questions covering the same tested concepts.
          </p>
        </div>
      </div>

      {/* Primary KPI Breakdown Row */}
      <div className="bg-white dark:bg-[#1F2330] rounded-3xl p-3.5 border border-[#E8D9C0] dark:border-[#31374A] shadow-xs grid grid-cols-2 sm:grid-cols-6 gap-2 text-center tabular-nums">
        <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/30">
          <span className="text-[9.5px] font-bold text-emerald-700 dark:text-emerald-400 block uppercase">
            Exact
          </span>
          <span className="text-base font-black text-emerald-900 dark:text-emerald-200">
            {coverage.exact}
          </span>
        </div>

        <div className="p-2 rounded-xl bg-teal-50 dark:bg-teal-950/30">
          <span className="text-[9.5px] font-bold text-teal-700 dark:text-teal-400 block uppercase">
            Near-Exact
          </span>
          <span className="text-base font-black text-teal-900 dark:text-teal-200">
            {coverage.nearExact}
          </span>
        </div>

        <div className="p-2 rounded-xl bg-[#F47B20]/10 dark:bg-[#F47B20]/15">
          <span className="text-[9.5px] font-bold text-[#E06A12] dark:text-[#F47B20] block uppercase">
            Similar
          </span>
          <span className="text-base font-black text-[#171923] dark:text-[#FFF9EF]">
            {coverage.similar}
          </span>
        </div>

        <div className="p-2 rounded-xl bg-[#800020]/10 dark:bg-[#800020]/25">
          <span className="text-[9.5px] font-bold text-[#800020] dark:text-[#F47B20] block uppercase">
            Related
          </span>
          <span className="text-base font-black text-[#800020] dark:text-[#FFF9EF]">
            {coverage.concept}
          </span>
        </div>

        <div className="p-2 rounded-xl bg-[#F7EFE2] dark:bg-[#252A3A]">
          <span className="text-[9.5px] font-bold text-[#6E6254] dark:text-[#A39887] block uppercase">
            Unmatched
          </span>
          <span className="text-base font-black text-[#171923] dark:text-[#FFF9EF]">
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
            className="flex-1 py-2.5 px-3 rounded-2xl bg-[#800020] hover:bg-[#5E0017] dark:bg-[#F47B20] dark:hover:bg-[#E06A12] text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm transition-colors cursor-pointer tabular-nums"
          >
            <Play className="w-3.5 h-3.5 fill-white" />
            <span>Practice Matched Questions ({coverage.exact + coverage.nearExact + coverage.similar + coverage.concept})</span>
          </button>
        )}

        <button
          onClick={onNewAnalysis}
          className="py-2.5 px-3 rounded-2xl bg-white dark:bg-[#1F2330] border border-[#E8D9C0] dark:border-[#31374A] hover:border-[#800020] text-[#171923] dark:text-[#FFF9EF] font-bold text-xs flex items-center gap-1 transition-colors cursor-pointer"
        >
          <RotateCcw className="w-3.5 h-3.5 text-[#F47B20]" />
          <span>New Paper</span>
        </button>
      </div>

      {/* Tabs: Questions List vs Breakdowns */}
      <div className="flex border-b border-[#E8D9C0] dark:border-[#31374A]">
        <button
          onClick={() => setActiveTab("questions")}
          className={`py-2 px-4 text-xs font-black border-b-2 transition-colors cursor-pointer tabular-nums ${
            activeTab === "questions"
              ? "border-[#800020] dark:border-[#F47B20] text-[#800020] dark:text-[#F47B20]"
              : "border-transparent text-[#6E6254] dark:text-[#A39887] hover:text-[#171923] dark:hover:text-white"
          }`}
        >
          Questions List ({analysis.questions.length})
        </button>

        <button
          onClick={() => setActiveTab("breakdowns")}
          className={`py-2 px-4 text-xs font-black border-b-2 transition-colors cursor-pointer ${
            activeTab === "breakdowns"
              ? "border-[#800020] dark:border-[#F47B20] text-[#800020] dark:text-[#F47B20]"
              : "border-transparent text-[#6E6254] dark:text-[#A39887] hover:text-[#171923] dark:hover:text-white"
          }`}
        >
          Subject & Chapter Breakdown
        </button>
      </div>

      {activeTab === "questions" && (
        <div className="space-y-3">
          {/* Category Filter Controls */}
          <div className="flex items-center gap-1 p-1 bg-[#F7EFE2] dark:bg-[#1F2330] border border-[#E8D9C0] dark:border-[#31374A] rounded-2xl overflow-x-auto scrollbar-none">
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
                    ? "bg-[#800020] dark:bg-[#F47B20] text-white shadow-xs"
                    : "text-[#5C5346] dark:text-[#C4B9A8] hover:text-[#800020] dark:hover:text-white"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Question Match Cards */}
          <div className="space-y-2.5">
            {filteredQuestions.map((q, idx) => {
              let categoryTextColor = "text-[#6E6254] dark:text-[#A39887]";
              let badgeText = "Unmatched";

              if (q.primaryMatchCategory === "exact") {
                categoryTextColor = "text-emerald-700 dark:text-emerald-400";
                badgeText = "Exact Match";
              } else if (q.primaryMatchCategory === "near_exact") {
                categoryTextColor = "text-teal-700 dark:text-teal-400";
                badgeText = "Near-Exact Match";
              } else if (q.primaryMatchCategory === "similar") {
                categoryTextColor = "text-[#E06A12] dark:text-[#F47B20]";
                badgeText = "Similar Question";
              } else if (q.primaryMatchCategory === "concept_related") {
                categoryTextColor = "text-[#800020] dark:text-[#C99A45]";
                badgeText = "Related Concept";
              }

              return (
                <div
                  key={q.examQuestionId || idx}
                  onClick={() => onOpenQuestionComparison(q)}
                  className="p-4 rounded-2xl bg-white dark:bg-[#1F2330] border border-[#E8D9C0] dark:border-[#31374A] shadow-2xs hover:border-[#800020] dark:hover:border-[#F47B20] hover:shadow-xs transition-all cursor-pointer group space-y-2.5"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs">
                      <span className="w-6 h-6 rounded-lg bg-[#800020]/10 dark:bg-[#F47B20]/15 text-[#800020] dark:text-[#F47B20] font-bold text-[11px] tabular-nums flex items-center justify-center shrink-0">
                        Q{q.originalQuestionNumber || idx + 1}
                      </span>
                      <span className={`font-black ${categoryTextColor}`}>
                        {badgeText}
                      </span>
                      {q.matchScore > 0 && (
                        <>
                          <span className="text-[#E8D9C0] dark:text-[#31374A]" aria-hidden="true">·</span>
                          <span className="text-[#6E6254] dark:text-[#A39887] font-semibold text-[11px] tabular-nums">
                            {q.matchScore}% Score
                          </span>
                        </>
                      )}
                      <span className="text-[#E8D9C0] dark:text-[#31374A]" aria-hidden="true">·</span>
                      <span className="text-[#6E6254] dark:text-[#A39887] text-[10.5px] tabular-nums">
                        Page {q.sourcePageNumber}
                      </span>
                      {q.processingStatus === "needs_review" && (
                        <>
                          <span className="text-[#E8D9C0] dark:text-[#31374A]" aria-hidden="true">·</span>
                          <span className="text-amber-600 dark:text-amber-400 text-[10.5px] font-bold flex items-center gap-0.5">
                            <AlertTriangle className="w-3 h-3" />
                            Needs Review
                          </span>
                        </>
                      )}
                    </div>

                    <div className="flex items-center gap-1 text-[11px] font-bold text-[#800020] dark:text-[#F47B20] group-hover:translate-x-0.5 transition-transform shrink-0">
                      <span>Side-by-side</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </div>
                  </div>

                  <p className="text-xs font-medium text-[#171923] dark:text-[#FFF9EF] line-clamp-2 leading-relaxed">
                    {q.originalText}
                  </p>

                  {q.bestMatchQuestion && (
                    <div className="p-2.5 rounded-xl bg-[#FFF9EF] dark:bg-[#252A3A] border border-[#E8D9C0] dark:border-[#31374A] text-[11px] text-[#5C5346] dark:text-[#C4B9A8] flex items-start gap-2">
                      <BookOpen className="w-3.5 h-3.5 text-[#F47B20] shrink-0 mt-0.5" />
                      <div className="min-w-0 flex-1">
                        <span className="font-bold text-[#800020] dark:text-[#FFF9EF] mr-1">
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
            <div className="bg-white dark:bg-[#1F2330] rounded-3xl p-4 border border-[#E8D9C0] dark:border-[#31374A] shadow-xs space-y-3">
              <h3 className="text-xs font-black uppercase text-[#800020] dark:text-[#F47B20] tracking-wider">
                Chapter-Wise Coverage Breakdown
              </h3>

              <div className="space-y-2">
                {Object.entries(analysis.chapterBreakdown).map(([chId, stats]) => (
                  <div
                    key={chId}
                    className="p-3 rounded-2xl bg-[#FFF9EF] dark:bg-[#252A3A] border border-[#E8D9C0] dark:border-[#31374A] flex items-center justify-between"
                  >
                    <div>
                      <h4 className="text-xs font-bold text-[#171923] dark:text-[#FFF9EF]">
                        {stats.name || chId}
                      </h4>
                      <p className="text-[10px] text-[#6E6254] dark:text-[#A39887] mt-0.5 tabular-nums">
                        Exact: {stats.exact} • Near-Exact: {stats.nearExact} • Similar: {stats.similar} • Related: {stats.concept}
                      </p>
                    </div>

                    <div className="text-right">
                      <span className="text-xs font-black tabular-nums text-[#800020] dark:text-[#F47B20]">
                        {stats.total} Questions
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="py-8 text-center text-[#6E6254] dark:text-[#A39887] bg-white dark:bg-[#1F2330] rounded-3xl border border-[#E8D9C0] dark:border-[#31374A]">
              <p className="text-xs font-medium">Chapter breakdown will appear when questions are mapped to syllabus.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
